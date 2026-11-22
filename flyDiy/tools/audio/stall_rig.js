#!/usr/bin/env node
// stall_rig.js - AUDIO-ROBUST's PROOF (22 Nov 2026). The user: "the sound has been behaving super strange when there are lags
// and freezes; huge saturation, slow-down and speeds up, pitch variation". This records what the PAGE ITSELF plays (its last
// node before the speakers, tapped on the audio thread by AUDIO.record - audio.js), in two phases per pass:
//   LOAD   a trusted click as the boot starts (the gesture: the sound's context is made), then the whole cold load recorded
//          mono at 24 kHz - the loading screens' music (objective 11: audible, uninterrupted)
//   STALL  flying (page_rig's Go), AUDIO.stallTest: a 300 ms and a 1 s MAIN-THREAD BLOCK (a busy wait) and a 2.5 s LAG
//          (150 ms frames), recorded stereo at 48 kHz with the frame trace (gap, dt, pumped, stall, rpm, doppler, lag)
// Each pass is one cold boot. --passes before,after (default) runs ?audiorobust=0 then the default, one Chrome at a time.
// Writes <out>/<pass>_load.wav, <pass>_stall.wav, <pass>.json (the trace, the marks, the analysis) and summary.json:
//   the engine's pitch track (autocorrelation, 30-250 Hz, 50 ms windows): its worst departure in the 1.5 s after each block
//   from the 1 s before it, in cents; the sample peak and the samples at full scale; the loading recording's level per
//   second and its silent seconds (music interrupted).
//   node tools/audio/stall_rig.js --out <dir> [--passes before,after,lat:audiolat=playback] [--q k=v] [--live] [--headed]
//        [--cap 1500] [--seed '{...}'] [--noload] [--analyse <dir>]  (--analyse: re-read the WAVs, no browser)
//        [--air 300] the stall test IN FLIGHT: paused, the aircraft lifted <m> over where it stands and given 50 m/s along its
//                    nose (FLIGHT_PROBE.place by/dv, G1096), resumed, 4 s to settle - Go alone leaves it idling on the stand
//        [--menu]    the welcome menu shown (?welcome=1) and its Sandbox pressed by a TRUSTED click, as a player does: the
//                    music starts on the menu (menu_music.js) and the loading recording begins at that click
// A BOX RUN: A0's slot (tools/RIG-PROCEDURE.md 1), boxlock.sh take gpu AUDIO, one Chrome, nice 19, the CPU under 80 C.
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- WAV in / out ---------------------------------------------------------------------------------------------------
function wavWrite(file, pcm, sr, ch) {
  const b = Buffer.alloc(44 + pcm.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + pcm.length * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(ch, 22); b.writeUInt32LE(sr, 24);
  b.writeUInt32LE(sr * ch * 2, 28); b.writeUInt16LE(ch * 2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(pcm.length * 2, 40);
  for (let i = 0; i < pcm.length; i++) b.writeInt16LE(pcm[i], 44 + i * 2);
  fs.writeFileSync(file, b);
}
function wavRead(file) {
  const b = fs.readFileSync(file), ch = b.readUInt16LE(22), sr = b.readUInt32LE(24), n = (b.length - 44) / 2;
  const y = new Float32Array(n / ch);
  for (let i = 0; i < y.length; i++) { let s = 0; for (let c = 0; c < ch; c++) s += b.readInt16LE(44 + (i * ch + c) * 2); y[i] = s / ch / 32768; }
  return { y, sr, ch };
}

// ---- THE ANALYSIS ---------------------------------------------------------------------------------------------------
// the dominant period in 30-250 Hz by normalised autocorrelation over a window (the engine's firing / the prop's BPF)
function pitchAt(y, sr, a, n) {
  const lo = Math.floor(sr / 250), hi = Math.ceil(sr / 30);
  let best = 0, bl = 0;
  for (let l = lo; l <= hi; l++) {
    let s = 0, e0 = 0, e1 = 0;
    for (let i = a; i < a + n; i++) { const u = y[i], v = y[i + l] || 0; s += u * v; e0 += u * u; e1 += v * v; }
    const r = s / Math.sqrt(e0 * e1 + 1e-12);
    if (r > best) { best = r; bl = l; }
  }
  if (!bl || best < 0.3) return { hz: 0, r: best };
  // parabolic refinement
  const ac = l => { let s = 0; for (let i = a; i < a + n; i++) s += y[i] * (y[i + l] || 0); return s; };
  const c0 = ac(bl - 1), c1 = ac(bl), c2 = ac(bl + 1), d = (c0 - c2) / (2 * (c0 - 2 * c1 + c2) || 1);
  return { hz: sr / (bl + (Math.abs(d) < 1 ? d : 0)), r: best };
}
function track(y, sr, hop) {
  const n = Math.round(0.05 * sr), h = Math.round(hop * sr), out = [];
  for (let a = 0; a + n + Math.ceil(sr / 30) < y.length; a += h) out.push({ t: a / sr, ...pitchAt(y, sr, a, n) });
  return out;
}
const cents = (f, f0) => 1200 * Math.log2(f / f0);
function analyseStall(w, marks, ctxT0) {
  const { y, sr } = w;
  let peak = 0, full = 0; for (let i = 0; i < y.length; i++) { const a = Math.abs(y[i]); if (a > peak) peak = a; if (a >= 0.999) full++; }
  const tr = track(y, sr, 0.025);
  const med = a => { const s = a.slice().sort((p, q) => p - q); return s.length ? s[s.length >> 1] : 0; };
  const events = (marks || []).filter(m => m.kind === 'block').map(m => {
    const t = m.ctxT - ctxT0;
    const pre = tr.filter(p => p.hz > 0 && p.t > t - 1.0 && p.t < t - 0.05).map(p => p.hz);
    const f0 = med(pre);
    const post = tr.filter(p => p.hz > 0 && p.t >= t && p.t < t + m.ms / 1000 + 1.5);
    let worst = 0, at = 0;
    for (const p of post) { const c = cents(p.hz, f0); if (Math.abs(c) > Math.abs(worst)) { worst = c; at = p.t - t; } }
    // the level: rms over 50 ms, the worst jump against the 1 s before
    const rms = (a, b) => { let s = 0; a = Math.max(0, Math.floor(a * sr)); b = Math.min(y.length, Math.floor(b * sr)); for (let i = a; i < b; i++) s += y[i] * y[i]; return Math.sqrt(s / Math.max(1, b - a)); };
    const r0 = rms(t - 1, t);
    let rmax = 0; for (let u = t; u < t + m.ms / 1000 + 1.5; u += 0.05) rmax = Math.max(rmax, rms(u, u + 0.05));
    return { blockMs: m.ms, atS: +t.toFixed(3), f0: +f0.toFixed(2), worstCents: +worst.toFixed(1), worstAtS: +at.toFixed(3),
             levelJumpDb: +(20 * Math.log10((rmax + 1e-9) / (r0 + 1e-9))).toFixed(2) };
  });
  return { peak: +peak.toFixed(4), peakDbfs: +(20 * Math.log10(peak + 1e-9)).toFixed(2), fullScale: full, events };
}
function analyseLoad(w) {
  const { y, sr } = w, secs = Math.floor(y.length / sr), lv = [];
  let silent = 0, run = 0, longest = 0;
  for (let s = 0; s < secs; s++) {
    let e = 0; for (let i = s * sr; i < (s + 1) * sr; i++) e += y[i] * y[i];
    const db = 10 * Math.log10(e / sr + 1e-12); lv.push(+db.toFixed(1));
    if (db < -60) { silent++; run++; longest = Math.max(longest, run); } else run = 0;
  }
  return { seconds: secs, silentSeconds: silent, longestSilenceS: longest, levelDbPerS: lv };
}

// ---- THE PAGE --------------------------------------------------------------------------------------------------------
const B64 = `(r => { const u = new Uint8Array(r.pcm.buffer); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); r.b64 = btoa(s); delete r.pcm; return r; })`;
async function pass(name, q, out, o) {
  const PR = require(path.join(__dirname, '..', 'page_rig.js'));
  const res = { pass: name, q };
  let loadStarted = false;
  const rig = await PR.start({ cap: +opt('cap', 1500), q: flag('menu') ? [q, 'welcome=1'].filter(Boolean).join('&') : q, seed: o.seed, headed: flag('headed') || flag('live'), live: flag('live'), name: 'stall_rig_' + name,
    onNavigate: async r => {
      if (flag('noload')) return;
      if (flag('menu')) {   // the menu: wait for it, press Sandbox with a trusted click (the gesture), record from there
        let at = null;
        for (let i = 0; i < 120 && !at; i++) { at = await r.J("(() => { const b = document.querySelector('#welcome [data-mode=sandbox]'); if (!b) return null; const q = b.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; })()").catch(() => null); if (!at) await sleep(250); }
        if (!at) throw new Error('stall_rig: the welcome menu never showed (?welcome=1)');
        res.menuRow = await r.J("(() => { const b = document.querySelector('#welcome .wmusicbtn'), s = document.querySelector('#welcome .wmusicsel'); return b ? { pill: b.textContent, station: s && s.value } : null; })()").catch(() => null);
        for (const type of ['mousePressed', 'mouseReleased']) await r.cmd('Input.dispatchMouseEvent', { type, x: at[0], y: at[1], button: 'left', clickCount: 1 });
        await sleep(1500);
        res.menuMusic = await r.J("window.MENU_MUSIC ? { playing: MENU_MUSIC.playing, track: MENU_MUSIC.track, station: MENU_MUSIC.station } : null").catch(() => null);
        console.log('stall_rig: the menu pressed; its music ' + JSON.stringify(res.menuMusic) + ' (' + name + ')');
      }
      // the gesture: a TRUSTED click (CDP input) as soon as the page has a body and AUDIO is armed
      for (let i = 0; i < 240; i++) { if (await r.ev("!!(document.body && window.AUDIO && window.AUDIO.enabled)").catch(() => false)) break; await sleep(250); }
      for (const type of ['mousePressed', 'mouseReleased']) await r.cmd('Input.dispatchMouseEvent', { type, x: 6, y: 6, button: 'left', clickCount: 1 });
      for (let i = 0; i < 40; i++) { if (await r.ev("!!(window.AUDIO && window.AUDIO.ctx)").catch(() => false)) break; await sleep(100); }
      loadStarted = await r.ev("window.AUDIO.record.start({ mono: true, decim: 2 })").catch(e => { console.log('record start: ' + e.message); return false; });
      console.log('stall_rig: the loading recording ' + (loadStarted ? 'started' : 'did NOT start') + ' (' + name + ')');
    } });
  try {
    if (loadStarted) {
      const r = await rig.ev('window.AUDIO.record.stop().then(' + B64 + ')', 60000);
      const pcm = new Int16Array(Buffer.from(r.b64, 'base64').buffer.slice(0));
      wavWrite(path.join(out, name + '_load.wav'), pcm, r.sr, r.ch); delete r.b64;
      res.load = Object.assign(r, analyseLoad(wavRead(path.join(out, name + '_load.wav'))));
      res.load.music = await rig.J("window.AUDIO_MUSIC ? { context: AUDIO_MUSIC.context, now: AUDIO_MUSIC.nowPlaying && AUDIO_MUSIC.nowPlaying(), musicLoading: AUDIO.get('musicLoading') } : null");
      console.log('stall_rig: load ' + res.load.seconds + ' s recorded, ' + res.load.silentSeconds + ' silent, music ' + JSON.stringify(res.load.music));
    }
    await rig.fly();
    // THE LOOP MUST BE DRIVING THE SOUND (22 Nov, the first slot): a UI hold (the fleet screen, the new-plane card, a plane's
    // fiche: app.js returns before AUDIO.update) left the audio on its 2 Hz pump with no aeroplane - the recordings held
    // ambience only. Look: AUDIO.update calls over 1 s; under 20, say what holds, press Escape (trusted), look again
    const driven = async () => rig.J("new Promise(r => { const c0 = AUDIO.stats.calls, p0 = AUDIO.pumped; setTimeout(() => r({ calls: AUDIO.stats.calls - c0, pumped: AUDIO.pumped - p0, fleet: !!(window.FLEET_SCREEN && FLEET_SCREEN.isOpen()), newPlane: !!(window.NEW_PLANE && NEW_PLANE.isOpen()) }), 1000); })");
    for (let i = 0; i < 3; i++) {
      const d = await driven().catch(e => ({ error: String(e.message || e) }));
      (res.driven = res.driven || []).push(d);
      console.log('stall_rig: the loop drives the sound? ' + JSON.stringify(d));
      if (d.calls - d.pumped >= 20) break;
      for (const type of ['keyDown', 'keyUp']) await rig.cmd('Input.dispatchKeyEvent', { type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await sleep(1500);
    }
    if (opt('air')) {   // the stall test in flight (above)
      await rig.pause();
      res.air = await rig.J(`(async () => { const s = FLIGHT_PROBE.sim(), d = FLIGHT_PROBE.def(), p = s.p;
        const avg = l => { let x = 0, y = 0, z = 0; for (const j of l) { x += p[3 * j]; y += p[3 * j + 1]; z += p[3 * j + 2]; } return [x / l.length, y / l.length, z / l.length]; };
        const n = avg(d.refs.noseFrame), t = avg(d.refs.tailMid); let fx = n[0] - t[0], fz = n[2] - t[2]; const L = Math.hypot(fx, fz) || 1; fx /= L; fz /= L;
        const cg = await FLIGHT_PROBE.place({ by: [0, ${+opt('air')}, 0], dv: [fx * 50, 0, fz * 50] }); return { cg, fwd: [fx, fz] }; })()`).catch(e => ({ error: String(e.message || e) }));
      await rig.ev("(() => { const b = document.getElementById('bPause'); if (b && !/pause/i.test(b.textContent)) b.click(); return b && b.textContent; })()");
      console.log('stall_rig: in the air ' + JSON.stringify(res.air));
      await sleep(4000);
      res.drivenAir = await driven().catch(e => ({ error: String(e.message || e) }));
      console.log('stall_rig: in the air, the loop drives the sound? ' + JSON.stringify(res.drivenAir));
    }
    if (!(await rig.ev('!!(window.AUDIO && window.AUDIO.ctx)'))) {   // no load phase: the gesture now
      for (const type of ['mousePressed', 'mouseReleased']) await rig.cmd('Input.dispatchMouseEvent', { type, x: 6, y: 6, button: 'left', clickCount: 1 });
    }
    await sleep(8000);
    res.before = await rig.J("({ state: AUDIO.state, latency: AUDIO.ctx && [AUDIO.ctx.baseLatency, AUDIO.ctx.outputLatency], robust: AUDIO.robust, sim: (() => { try { const s = FLIGHT_PROBE.sim(); return { V: s.out.V, rpm: s.out.rpm && s.out.rpm[0], agl: s.out.agl }; } catch (e) { return null; } })() })");
    const r = await rig.ev('window.AUDIO.stallTest({ seconds: 14, blocks: [[3, 300], [7, 1000]], lag: [10, 2.5, 150] }).then(' + B64 + ')', 90000);
    const pcm = new Int16Array(Buffer.from(r.b64, 'base64').buffer.slice(0));
    wavWrite(path.join(out, name + '_stall.wav'), pcm, r.sr, r.ch); delete r.b64;
    res.stall = Object.assign(r, { analysis: analyseStall(wavRead(path.join(out, name + '_stall.wav')), r.marks, r.ctxT0) });   // (the marks carry ctx times; r.ctxT0 = the recording's start)
    res.why = await rig.why();
  } catch (e) { res.error = String(e && e.message || e); res.why = await rig.why(); }
  await rig.close();
  fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify(res, null, 1));
  return res;
}

(async () => {
  const out = opt('out') || opt('analyse');
  if (!out) { console.log('usage: node tools/audio/stall_rig.js --out <dir> [--passes before,after] [--q k=v] [--live] [--analyse <dir>]'); process.exit(2); }
  fs.mkdirSync(out, { recursive: true });
  const passes = opt('passes', 'before,after').split(',');
  const seed = opt('seed') ? JSON.parse(opt('seed')) : null;   // (the loading music is on by default since AUDIO-ROBUST 3: no seed)
  const sum = {};
  for (const spec of passes) {
    // a pass is 'name' or 'name:k=v+k2=v2' (its own query); 'before' alone = ?audiorobust=0
    const [p, pq] = spec.split(':');
    if (flag('analyse') || argv.includes('--analyse')) {
      const j = JSON.parse(fs.readFileSync(path.join(out, p + '.json'), 'utf8'));
      if (j.stall) j.stall.analysis = analyseStall(wavRead(path.join(out, p + '_stall.wav')), j.stall.marks, j.stall.ctxT0 || 0);
      if (j.load) Object.assign(j.load, analyseLoad(wavRead(path.join(out, p + '_load.wav'))));
      sum[p] = j; continue;
    }
    const q = [pq ? pq.replace(/\+/g, '&') : (p === 'before' ? 'audiorobust=0' : ''), opt('q', '')].filter(Boolean).join('&');
    sum[p] = await pass(p, q, out, { seed });
  }
  const brief = {};
  for (const p of Object.keys(sum)) { const j = sum[p]; brief[p] = { error: j.error, stall: j.stall && j.stall.analysis, lateTicks: j.stall && j.stall.lateTicks, stallFrames: j.stall && j.stall.stallFrames, playout: j.stall && j.stall.playout,
    load: j.load && { seconds: j.load.seconds, silentSeconds: j.load.silentSeconds, longestSilenceS: j.load.longestSilenceS, music: j.load.music } }; }
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(brief, null, 1));
  console.log(JSON.stringify(brief, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
