// mix_meter.js - THE PAGE'S MIX, METERED ON THE REAL PAGE (G1720, SND-MIX; for the Coordinator's box: cloud sessions
// cannot render the game). The offline render (tools/audio/mix_render.js) measured the mix from the page's own files in
// node; this is the same table read off the running page, from the browser's own graph.
//
// USE: open the page (dev.html or index.html), click once (the sound starts on the first gesture), open the DevTools
// console, paste this whole file, then fly the states and mark each one while it is steady:
//     SNDMIX.mark('jodel idle cockpit')            6 s of every bus, then one row printed (and kept)
//     SNDMIX.mark('jodel cruise chase', 8)         another length
//     SNDMIX.split('jodel cruise cockpit')         the same, then the ENGINE alone (the airframe row at 0) and the
//                                                  AIRFRAME alone (the engine row at 0), 4 s each - the settings put back
//     SNDMIX.table()                               every row so far, as a console.table and as markdown (copied when
//                                                  the page has focus: paste it into HANDOVER / the evidence)
//     SNDMIX.stop()                                the taps removed (the page's graph exactly as it was)
// THE STATES (the offline table's): idle on the stand; taxi ~1500 rpm at 5 m/s; climb at full power, Vy; cruise 75 %, Vc
// with Radio Jolene on and 'music in flight' on - in the cockpit (the canopy closed, headset off) and in chase.
//
// WHAT IT TAPS (read-only: an extra connection from each bus to a meter, never into the speakers): AUDIO.bus('aircraft')
// (the engine, the prop, the airframe - after the viewpoint and the interior trim), 'ambience' (the beds and the
// emitters), 'music' (the music and Norman), 'ui', and the MASTER after the soft limiter is read as the bus 'master' x
// the fade (the limiter's own reduction: AUDIO.bus('limiter').reduction, sampled every 50 ms - its max and its mean).
// Each tap: K-weighting as two BiquadFilters (a +4 dB high shelf at 1.5 kHz and a 38 Hz high-pass: BS.1770's stages to
// within ~0.5 dB over the band) -> an AnalyserNode; every 100 ms the last 400 ms are read (the momentary blocks), and the
// mark's integrated loudness is BS.1770's gating over them (-70 LUFS absolute, -10 LU relative). Peak: the unweighted
// sample peak of each bus (a second, plain analyser). The volumes and the master are inside every bus's level: the rows
// read what the speakers get from each bus, the way the offline table does.
(function () {
  'use strict';
  const A = window.AUDIO;
  if (!A || !A.ctx) { console.warn('SNDMIX: no sound yet - click the page once (the sound starts on the first gesture), then paste again'); return; }
  if (window.SNDMIX && window.SNDMIX.stop) window.SNDMIX.stop();
  const ctx = A.ctx, BUSES = ['aircraft', 'ambience', 'music', 'ui', 'master'];
  const taps = [], rows = [];
  function tap(name) {
    const src = A.bus(name); if (!src) return null;
    const sh = ctx.createBiquadFilter(); sh.type = 'highshelf'; sh.frequency.value = 1500; sh.gain.value = 4;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 38; hp.Q.value = 0.5;
    // an AnalyserNode down-mixes to mono: each channel through its own (BS.1770 sums the channels' mean squares)
    const sp = ctx.createChannelSplitter(2), an = [ctx.createAnalyser(), ctx.createAnalyser()];
    for (const a of an) a.fftSize = 32768;
    const pk = ctx.createAnalyser(); pk.fftSize = 4096;
    src.connect(sh); sh.connect(hp); hp.connect(sp); sp.connect(an[0], 0); sp.connect(an[1], 1); src.connect(pk);
    const buf = new Float32Array(32768), pbuf = new Float32Array(pk.fftSize);
    const t = { name, src, nodes: [sh, hp, sp, pk, an[0], an[1]], an, pk, buf, pbuf, blocks: [], peak: 0 };
    taps.push(t); return t;
  }
  for (const b of BUSES) tap(b);
  const made = performance.now();   // (a fresh analyser reads silence for its first second: the first mark waits it out)
  const lim = A.bus('limiter');
  let grMax = 0, grSum = 0, grN = 0, timer = 0, gtimer = 0, on = false;
  const ms = (x, a, b) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return s / Math.max(1, b - a); };
  function sample() {
    const n400 = Math.round(0.4 * ctx.sampleRate);
    for (const t of taps) {
      let z = 0;
      for (const a of t.an) { a.getFloatTimeDomainData(t.buf); z += ms(t.buf, t.buf.length - n400, t.buf.length); }
      t.blocks.push(z);
      t.pk.getFloatTimeDomainData(t.pbuf);
      for (let i = 0; i < t.pbuf.length; i++) { const v = Math.abs(t.pbuf[i]); if (v > t.peak) t.peak = v; }
    }
  }
  function grSample() { if (!lim) return; const r = -lim.reduction || 0; if (r > grMax) grMax = r; grSum += r; grN++; }
  const LU = s => -0.691 + 10 * Math.log10(Math.max(1e-30, s));
  function integrated(z) {
    const g1 = z.filter(s => LU(s) > -70); if (!g1.length) return -Infinity;
    const rel = LU(g1.reduce((a, b) => a + b, 0) / g1.length) - 10, g2 = g1.filter(s => LU(s) > rel);
    return g2.length ? LU(g2.reduce((a, b) => a + b, 0) / g2.length) : -Infinity;
  }
  const dB = x => 20 * Math.log10(Math.max(1e-9, x));
  function state() {
    const P = A.params; if (!P) return {};
    const s = P.s, I = P.I;
    return { V: +s[I.V].toFixed(1), agl: +s[I.agl].toFixed(0), rpm: P.rpmEng ? Math.round(P.rpmEng[0]) : null, thr: P.thr ? +P.thr[0].toFixed(2) : null,
             interior: s[I.interior] > 0, onGround: s[I.onGround] > 0, garage: s[I.inGarage] > 0 };
  }
  function measure(sec) {
    return new Promise(res => {
      for (const t of taps) { t.blocks = []; t.peak = 0; }
      grMax = 0; grSum = 0; grN = 0; on = true;
      timer = setInterval(sample, 100); gtimer = setInterval(grSample, 50);
      setTimeout(() => {
        clearInterval(timer); clearInterval(gtimer); on = false;
        const out = {};
        for (const t of taps) out[t.name] = { lufs: +integrated(t.blocks.slice(4)).toFixed(1), peak: +dB(t.peak).toFixed(1) };
        res({ buses: out, limiter: { grMaxDb: +grMax.toFixed(2), grMeanDb: +(grN ? grSum / grN : 0).toFixed(3) } });
      }, sec * 1000 + 450);
    });
  }
  async function mark(label, sec) {
    const s = sec || 6, st = state();
    const w = 1500 - (performance.now() - made); if (w > 0) await new Promise(f => setTimeout(f, w));
    console.log('SNDMIX: measuring "' + label + '" for ' + s + ' s - hold the state steady');
    const m = await measure(s);
    const row = Object.assign({ label, state: st, settings: { master: A.get('master'), engine: A.get('engine'), airframe: A.get('aircraft'), environment: A.get('environment'), music: A.get('music'), musicFlight: A.get('musicFlight'), headset: A.get('headset') }, mix: A.MIX || null }, m);
    rows.push(row);
    const b = m.buses;
    console.log('SNDMIX ' + label.padEnd(26) + ' aircraft ' + b.aircraft.lufs + '  ambience ' + b.ambience.lufs + '  music ' + b.music.lufs + '  master ' + b.master.lufs + ' LUFS (pk ' + b.master.peak + ' dBFS)  limiter GR max ' + m.limiter.grMaxDb + ' dB');
    return row;
  }
  // the engine and the airframe apart: their own volumes at 0 in turn (put back after, whatever happens)
  async function split(label, sec) {
    const s = sec || 4, e0 = A.get('engine'), a0 = A.get('aircraft');
    const r = await mark(label, s);
    try {
      A.set('aircraft', 0); await new Promise(f => setTimeout(f, 1200));
      const e = await measure(s); r.engineOnly = e.buses.aircraft;
      A.set('aircraft', a0); A.set('engine', 0); await new Promise(f => setTimeout(f, 1200));
      const a = await measure(s); r.airframeOnly = a.buses.aircraft;
    } finally { A.set('engine', e0); A.set('aircraft', a0); }
    console.log('SNDMIX ' + label.padEnd(26) + ' engine+prop ' + r.engineOnly.lufs + '  airframe ' + r.airframeOnly.lufs + ' LUFS');
    return r;
  }
  function table() {
    const f = x => (x && isFinite(x.lufs) ? x.lufs.toFixed(1) : '-');
    const md = ['| state | engine+prop | airframe | aircraft | ambience | music (+voice) | master | peak | GR max |', '|---|---|---|---|---|---|---|---|---|']
      .concat(rows.map(r => '| ' + r.label + ' | ' + f(r.engineOnly) + ' | ' + f(r.airframeOnly) + ' | ' + f(r.buses.aircraft) + ' | ' + f(r.buses.ambience) + ' | ' + f(r.buses.music) + ' | ' + f(r.buses.master) + ' | ' + r.buses.master.peak + ' | ' + r.limiter.grMaxDb + ' |')).join('\n');
    console.table(rows.map(r => ({ state: r.label, engine: f(r.engineOnly), airframe: f(r.airframeOnly), aircraft: f(r.buses.aircraft), ambience: f(r.buses.ambience), music: f(r.buses.music), master: f(r.buses.master), peak: r.buses.master.peak, gr: r.limiter.grMaxDb })));
    console.log(md);
    try { if (navigator.clipboard) navigator.clipboard.writeText(md + '\n\n' + JSON.stringify(rows, null, 1)); } catch (e) {}
    return md;
  }
  function stop() {
    if (on) { clearInterval(timer); clearInterval(gtimer); on = false; }
    for (const t of taps) { try { t.src.disconnect(t.nodes[0]); } catch (e) {} try { t.src.disconnect(t.nodes[3]); } catch (e) {} for (const n of t.nodes) { try { n.disconnect(); } catch (e) {} } }
    taps.length = 0;
  }
  window.SNDMIX = { mark, split, table, stop, rows, state };
  console.log('SNDMIX ready: SNDMIX.mark(label), SNDMIX.split(label), SNDMIX.table(), SNDMIX.stop()');
})();
