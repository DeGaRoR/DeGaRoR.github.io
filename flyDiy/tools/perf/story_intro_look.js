#!/usr/bin/env node
// story_intro_look.js - THE OPENING'S TIMED LOOK (G3380-G3389 STORY-INTRO), one pass on the box's GPU in headed Chrome
// (master_bench.js's CDP rig and its frame / long-task recorder), this tree served by tools/_serve.js.
//   1 COLD NEW CAREER  a fresh profile, index.html?mode=career (a New career: no saved career in it) - the boot, then the
//                      opening as the screen lifts: per-frame times through the warm views, the shots, the fade to black,
//                      the swap and the garage's first seconds; long tasks over 100 ms; the page's exceptions. NO stills.
//   2 PLAYED (stills)  the career removed, the page loaded again (a New career on the warm profile): the tuning stills at
//                      set times of the shots (Page.captureScreenshot - they disturb the frames, so this row's times are
//                      INFO), written to --stills (outside the repo: never shown to the user)
//   3 SKIPPED          the career removed again: Esc at 5 s - the garage, the story at T0, the frames round the swap
//     (--profile: run 3 is a played New career under a CPU profile instead - self time by function through the shots)
// The profile is under the system temp dir (C:), deleted at the end. GPU lock first (the caller): it is timed.
// Usage: node tools/perf/story_intro_look.js --port 8791 [--stills <dir>] [--out <json>] [--size 2216x1023] [--plan]
//   (no --help: an unknown flag is ignored)
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const STILL_T = [0.5, 4, 8, 10.5, 12, 15, 19, 21, 23, 26, 29, 31.5, 33];
if (flag('plan')) {
  console.log('  1 cold New career: ~90 s boot + 36 s opening + 5 s garage');
  console.log('  2 played, stills at ' + STILL_T.join(', ') + ' s: ~60 s + 40 s');
  console.log('  3 skipped (Esc at 5 s): ~60 s + 12 s');
  console.log('  ~6-8 min with Chrome starts; GPU lock first');
  process.exit(0);
}
if (!argv.includes('--size')) process.argv.push('--size', '2216x1023');
const MB = require('../master_bench.js');
const PORT = +opt('port', 0);
const stamp = new Date().toISOString().slice(5, 16).replace(/[-T:]/g, '');
const UDD = path.join(os.tmpdir(), 'sil' + stamp);
const STILLS = opt('stills', null) ? path.resolve(opt('stills')) : null;
const OUT = path.resolve(opt('out', path.join(os.tmpdir(), 'story_intro_look_' + stamp + '.json')));
const log = (...a) => console.log('[' + new Date().toISOString().slice(11, 19) + ']', ...a);

// the opening's states on the page clock, every 25 ms: [t, state, shot clock]
const WATCH = `(() => { if (window.__SI) return 'on'; const S = window.__SI = { st: [], t0: performance.now() }; let last = null;
  setInterval(() => { const I = window.FLYDIY_INTRO, s = I && I.state ? I.state() : null, L = window.FLYDIY_INTRO_LAST;
    const k = s ? s.st : (L ? 'done:' + L.how : (document.getElementById('stIntro') ? 'curtain' : 'none'));
    if (k !== last) { S.st.push([Math.round(performance.now()), k, s ? +s.t.toFixed(2) : null]); last = k; } }, 25); return 'set'; })()`;
const READ = `JSON.stringify({ birth: (() => { const e = document.getElementById('dfBirth'); return !!(e && !e.hidden); })(), bootLog: ((window.BOOT && BOOT.log) || []).filter(e => e.k === 'step' || e.k === 'landing' || e.k === 'ready').map(e => [e.k, e.id || '', e.t]), ln: (__MB.ln || []).map(e => [Math.round(e[0]), Math.round(e[1])]), prog: (window.FLYDIY_RENDERER && FLYDIY_RENDERER.info && FLYDIY_RENDERER.info.programs) ? FLYDIY_RENDERER.info.programs.length : null, st: (window.__SI || {}).st || [], fr: __MB.fr.slice(-20000), lt: __MB.lt, sc: __MB.sc || [],
  story: window.FLYDIY_STORY ? window.FLYDIY_STORY.story() : null, last: window.FLYDIY_INTRO_LAST || null,
  plan: window.FLYDIY_INTRO && window.FLYDIY_INTRO.plan ? (p => ({ T: p.T, shed: p.shed, gap: p.gap, side: p.side, anchor: p.anchor })) (window.FLYDIY_INTRO.plan()) : null,
  here: (() => { try { return window.FLYDIY_PLAYER.doc().here; } catch (e) { return null; } })(),
  hold: !!window.FLYDIY_MUSIC_HOLD, curtain: !!document.getElementById('stIntro'), bodyIntro: document.body.classList.contains('stIntro'),
  card: (() => { const c = document.getElementById('stCard'); return c ? { hidden: c.hidden, text: c.textContent.slice(0, 80) } : null; })() })`;
// a career removed, so the next load is a New career
const FRESH = `(() => { try { localStorage.removeItem('flydiy.career.main'); localStorage.removeItem('flydiy.career.main.prev'); for (const k of Object.keys(localStorage)) if (k.indexOf('flydiy.build.') === 0) localStorage.removeItem(k); } catch (e) {} return 'ok'; })()`;

// a CPU profile -> self time per function (name, file:line), largest first
function top(P) {
  if (!P || !P.nodes) return [];
  const byId = new Map(P.nodes.map(n => [n.id, n])), self = new Map();
  for (let i = 0; i < P.samples.length; i++) { const dt = (P.timeDeltas[i + 1] || P.timeDeltas[i] || 0) / 1000; const n = byId.get(P.samples[i]); if (!n) continue;
    const cf = n.callFrame, k = (cf.functionName || '(anon)') + ' ' + String(cf.url || '').split('/').pop().split('?')[0] + ':' + (cf.lineNumber + 1); self.set(k, (self.get(k) || 0) + dt); }
  return [...self].map(([fn, ms]) => ({ fn, ms: Math.round(ms) })).sort((a, b) => b.ms - a.ms).slice(0, 40);
}
function windows(d) {
  const at = k => { const r = d.st.find(x => x[1] === k || (k === 'done' && /^done:/.test(x[1]))); return r ? r[0] : null; };
  return { warm: at('warm'), shots: at('shots'), out: at('out'), garage: at('garage'), done: at('done') };
}
function rows(d, label) {
  const W = windows(d), R = [];
  const add = (name, t0, t1) => { if (t0 == null || t1 == null || t1 <= t0) return; const s = MB.stat(d.fr, d.lt, t0, t1, d.sc); R.push(Object.assign({ row: label, scene: name, sec: +((t1 - t0) / 1000).toFixed(1) }, s || { frames: 0 })); };
  add('warm views (black)', W.warm, W.shots || W.out);
  const tLast = d.fr.length ? d.fr[d.fr.length - 1][0] : null;
  add('the shots', W.shots, W.out || W.garage || tLast);
  if (W.out) add('the skip fade', W.out, W.garage);
  add('round the swap (-1 s, +3 s)', (W.garage || 0) - 1000, (W.garage || 0) + 3000);
  add('the garage after (+1..+5 s)', (W.garage || 0) + 1000, (W.garage || 0) + 5000);
  const t0 = W.warm || W.shots, t1 = (W.garage || 0) + 3000;
  const long = d.lt.filter(x => x[0] + x[1] > t0 && x[0] < t1 && x[1] > 100).map(x => ({ at: +((x[0] - (W.shots || t0)) / 1000).toFixed(2), ms: x[1] }));
  return { W, rows: R, long };
}
const show = r => log('   ' + r.scene.padEnd(30) + (r.frames ? r.fps + ' fps, p50 ' + r.p50 + ', p90 ' + r.p90 + ', p99 ' + r.p99 + ', worst ' + r.worst + ' ms, >100 ms ' + r.over100 + ', tasks>=200 ' + r.tasks200 : 'no frames'));

(async () => {
  if (!PORT) { console.error('story_intro_look: --port is required'); process.exit(2); }
  if (await MB.serveRoot(PORT)) { console.error('story_intro_look: port ' + PORT + ' is taken'); process.exit(4); }
  const srv = MB.serve(PORT); await sleep(800);
  const root = await MB.serveRoot(PORT);
  const R = { meta: { date: new Date().toISOString(), root, udd: UDD }, runs: [] };
  const url = 'http://localhost:' + PORT + '/flyDiy/index.html?mode=career';
  let b = null;
  const kill = () => { try { srv.kill(); if (process.platform === 'win32') require('child_process').execSync('taskkill /PID ' + srv.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} };
  try {
    if (STILLS) fs.mkdirSync(STILLS, { recursive: true });
    process.env.MB_CHROME_FLAGS = ((process.env.MB_CHROME_FLAGS || '') + ' --autoplay-policy=no-user-gesture-required').trim();
    b = await MB.browser(UDD);
    // (the bench's route pref is a sandbox flight's from HOME: a New career has none)
    const pre = MB.preScript('default', null) + '\ntry{localStorage.removeItem("flydiy.route")}catch(e){}\n' + `(function(){ var w = function(){ if (window.FLYDIY_PACE) { try { (0, eval)(${JSON.stringify(WATCH)}); } catch (e) {} } else setTimeout(w, 20); }; w(); })();`;
    const one = async (label, opts) => {
      const l = await b.load(url, opts.fresh ? pre + ";" + FRESH + ";" : pre);
      log(label + ': boot ' + l.sec + ' s (' + l.state + ')');
      await b.ev(WATCH);
      const tEnd = Date.now() + 150000, shots = [];
      let si = 0, pressed = false, profOn = false;
      while (Date.now() < tEnd) {
        const s = JSON.parse(await b.ev("JSON.stringify((window.FLYDIY_INTRO && FLYDIY_INTRO.state && FLYDIY_INTRO.state()) || { st: window.FLYDIY_INTRO_LAST ? 'done' : 'none', t: 0 })"));
        if (s.st === 'done' || (s.st === 'none' && Date.now() > tEnd - 140000)) break;
        if (opts.profile && !profOn && s.st === 'shots') { await b.cmd('Profiler.enable'); await b.cmd('Profiler.setSamplingInterval', { interval: 250 }); await b.cmd('Profiler.start'); profOn = true; log('   profiling the shots'); }
        if (opts.skipAt != null && !pressed && s.st === 'shots' && s.t >= opts.skipAt) {
          await b.cmd('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
          await b.cmd('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
          pressed = true; log('   Esc at ' + s.t.toFixed(2) + ' s');
        }
        if (opts.stills && s.st === 'shots' && si < STILL_T.length && s.t >= STILL_T[si]) {
          const img = await b.cmd('Page.captureScreenshot', { format: 'jpeg', quality: 72 });
          const f = path.join(STILLS, label.replace(/\W+/g, '_') + '_' + String(si).padStart(2, '0') + '_t' + s.t.toFixed(1) + '.jpg');
          if (img.result && img.result.data) { fs.writeFileSync(f, Buffer.from(img.result.data, 'base64')); shots.push(f); }
          si++;
          continue;
        }
        await sleep(opts.stills ? 30 : 100);
      }
      let prof = null;
      if (profOn) { const pr = await b.cmd('Profiler.stop'); prof = top(pr.result && pr.result.profile); log('   the shots, self time by function (top 15):'); for (const x of prof.slice(0, 15)) log('     ' + String(x.ms).padStart(7) + ' ms  ' + x.fn); }
      await sleep(5500);   // the garage's first seconds
      if (opts.stills && STILLS) {   // the garage after the fade (+2 s past the curtain)
        const img = await b.cmd('Page.captureScreenshot', { format: 'jpeg', quality: 72 });
        if (img.result && img.result.data) { const f = path.join(STILLS, label.replace(/\W+/g, '_') + '_garage.jpg'); fs.writeFileSync(f, Buffer.from(img.result.data, 'base64')); shots.push(f); }
      }
      const d = JSON.parse(await b.ev(READ, 30000));
      const A = rows(d, label);
      const bl = d.bootLog || [], ii = bl.findIndex(e => e[0] === 'step' && e[1] === 'intro'), introMs = ii >= 0 && bl[ii + 1] ? bl[ii + 1][2] - bl[ii][2] : null, readyT = (bl.find(e => e[0] === 'ready') || [])[2];
      const run = { birth: d.birth, profile: prof, introStepMs: introMs, bootReadyMs: readyT, bootLog: bl, ln: d.ln, label, boot: l, states: d.st, plan: d.plan, last: d.last, here: d.here, beat: d.story ? d.story.beat : null, hold: d.hold, curtain: d.curtain,
        bodyIntro: d.bodyIntro, card: d.card, rows: A.rows, long: A.long, exc: b.exc.splice(0), stills: shots };
      R.runs.push(run);
      log(label + ': the boot step intro ' + introMs + ' ms (boot ready at ' + readyT + ' ms); the New aeroplane chooser ' + (d.birth ? 'SHOWN' : 'not shown')); log(label + ': ' + (d.last ? d.last.how : 'NO OPENING') + ', here ' + d.here + ', beat ' + run.beat + ', radio held ' + d.hold + ', curtain left ' + d.curtain + ', card ' + JSON.stringify(d.card));
      for (const r of A.rows) show(r);
      log('   long tasks > 100 ms in the opening: ' + (A.long.length ? A.long.map(x => x.ms + ' ms at ' + x.at + ' s').join(', ') : 'none') + (run.exc.length ? ' · exceptions: ' + run.exc.join(' | ') : ''));
      return run;
    };
    await one('1 cold New career', {});
    if (!flag('nostills')) await one('2 played stills', { stills: !!STILLS, fresh: true });
    if (!flag('only1')) { if (flag('profile')) await one('3 profiled (timing INFO)', { profile: true, fresh: true }); else await one('3 skipped', { skipAt: 5, fresh: true }); }
  } catch (e) { R.error = String(e && e.stack || e); log('ERROR ' + R.error); }
  finally {
    if (b) await b.close();
    kill();
    await sleep(1500);
    try { fs.rmSync(UDD, { recursive: true, force: true }); log('profile deleted: ' + UDD); } catch (e) { log('profile NOT deleted: ' + UDD + ' - ' + e.message); }
  }
  fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
  log('-> ' + OUT);
  process.exit(R.error ? 1 : 0);
})();
