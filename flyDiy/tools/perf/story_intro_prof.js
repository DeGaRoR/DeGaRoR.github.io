#!/usr/bin/env node
// story_intro_prof.js - WHERE THE OPENING'S BOOT SECONDS GO (G3380-G3389 STORY-INTRO; the user, 21 Oct: "15 seconds for a
// moving camera? Whyyyy?"). Headed Chrome on the box (master_bench.js's CDP rig), this tree served by tools/_serve.js; each
// row a cold New career in a FRESH profile under the system temp dir (C:), deleted after:
//   1 BASE   index.html?mode=career&intro=0 - a New career without the opening: the boot's seconds (BOOT.log 'ready')
//   2 INTRO  index.html?mode=career - the boot's seconds and the 'intro' step's; a CPU PROFILE over that step (CDP Profiler,
//            started when BOOT.current is 'intro', stopped when it moves on): self time by function, inclusive time by
//            function; the step's own ledger (window.FLYDIY_INTRO_PREP: per shot the phases, the lights, the new programs and
//            how their keys differ); then a second profile from the shots' last 2 s to the garage + 4 s (the swap's tasks)
//   3 HIGH   the same with G3386's high ending (introend=high): is the swap's long task the eye-level end's?
// Usage: node tools/perf/story_intro_prof.js --port 8793 [--out <json>] [--reps 1]   (GPU lock first; no --help)
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
if (!argv.includes('--size')) process.argv.push('--size', '2216x1023');
const MB = require('../master_bench.js');
const PORT = +opt('port', 0), REPS = +opt('reps', 1);
const stamp = new Date().toISOString().slice(5, 16).replace(/[-T:]/g, '');
const OUT = path.resolve(opt('out', path.join(os.tmpdir(), 'story_intro_prof_' + stamp + '.json')));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log('[' + new Date().toISOString().slice(11, 19) + ']', ...a);
// a CPU profile -> self and inclusive time per function (name file:line), ms, largest first
function digest(P, n) {
  if (!P || !P.nodes) return null;
  const byId = new Map(P.nodes.map(x => [x.id, x])), self = new Map(), parent = new Map();
  for (const x of P.nodes) for (const c of x.children || []) parent.set(c, x.id);
  for (let i = 0; i < P.samples.length; i++) self.set(P.samples[i], (self.get(P.samples[i]) || 0) + (P.timeDeltas[i] || 0) / 1000);
  const key = x => { const cf = x.callFrame; return (cf.functionName || '(anon)') + ' ' + String(cf.url || '').split('/').pop().split('?')[0] + ':' + (cf.lineNumber + 1); };
  const S = new Map(), T = new Map();
  for (const [id, ms] of self) {
    const x = byId.get(id); if (!x) continue;
    S.set(key(x), (S.get(key(x)) || 0) + ms);
    const seen = new Set();   // inclusive: every distinct function on the sample's stack
    for (let y = id; y != null; y = parent.get(y)) { const k = key(byId.get(y)); if (seen.has(k)) continue; seen.add(k); T.set(k, (T.get(k) || 0) + ms); }
  }
  const top = M => [...M].map(([fn, ms]) => ({ fn, ms: Math.round(ms) })).sort((a, b) => b.ms - a.ms).slice(0, n || 30);
  const total = [...self.values()].reduce((a, b) => a + b, 0);
  return { ms: Math.round(total), self: top(S), incl: top(T) };
}
const READY_MS = "(() => { const L = (window.BOOT && BOOT.log) || []; const r = L.find(e => e.k === 'ready'); return r ? r.t : null; })()";
const STEP_MS = "JSON.stringify(((window.BOOT && BOOT.log) || []).filter(e => e.k === 'step' || e.k === 'ready').map(e => [e.id || e.k, e.t]))";
async function one(label, q, prof) {
  const udd = path.join(os.tmpdir(), 'sip' + stamp + label.replace(/\W/g, ''));
  const b = await MB.browser(udd);
  const row = { label, q };
  try {
    const pre = MB.preScript('default', null) + '\ntry{localStorage.removeItem("flydiy.route")}catch(e){}\n';
    await b.cmd('Page.addScriptToEvaluateOnNewDocument', { source: pre });
    await b.cmd('Page.navigate', { url: 'http://localhost:' + PORT + '/flyDiy/index.html?mode=career' + (q ? '&' + q : '') });
    const t0 = Date.now();
    let on = false, done = false;
    while (Date.now() - t0 < 300000 && !done) {
      let cur = null;
      try { cur = await b.ev("(window.BOOT ? (BOOT.current ? BOOT.current.id : BOOT.state) : 'none')", 5000); } catch (e) { cur = 'err'; }
      if (prof && !on && cur === 'intro') { await b.cmd('Profiler.enable'); await b.cmd('Profiler.setSamplingInterval', { interval: 500 }); await b.cmd('Profiler.start'); on = true; log('   profiling the intro step'); }
      if (prof && on && cur !== 'intro') { const r = await b.cmd('Profiler.stop'); row.stepProfile = digest(r.result && r.result.profile, 30); on = false; log('   the step profiled: ' + (row.stepProfile ? row.stepProfile.ms + ' ms of samples' : 'none')); }
      if (cur === 'ready' || cur === 'gone') done = true;
      await sleep(on ? 60 : 150);
    }
    await sleep(1500);
    row.readyMs = await b.ev(READY_MS); row.steps = JSON.parse(await b.ev(STEP_MS));
    const ii = row.steps.findIndex(s => s[0] === 'intro'); row.introStepMs = ii >= 0 && row.steps[ii + 1] ? row.steps[ii + 1][1] - row.steps[ii][1] : null;
    log(label + ': boot ready at ' + row.readyMs + ' ms; the intro step ' + row.introStepMs + ' ms');
    if (prof) {
      // the swap: from the shots' last 2 s to the garage + 4 s
      const tEnd = Date.now() + 90000; let started = false;
      while (Date.now() < tEnd) {
        const s = JSON.parse(await b.ev("JSON.stringify((window.FLYDIY_INTRO && FLYDIY_INTRO.state && FLYDIY_INTRO.state()) || { st: window.FLYDIY_INTRO_LAST ? 'done' : 'none', t: 0 })"));
        if (!started && s.st === 'shots' && s.t >= 32) { await b.cmd('Profiler.enable'); await b.cmd('Profiler.setSamplingInterval', { interval: 500 }); await b.cmd('Profiler.start'); started = true; }
        if (s.st === 'done' || s.st === 'garage') { row.swapPage = Math.round(await b.ev('performance.now()')); break; }
        await sleep(100);
      }
      await sleep(4000);
      if (started) { const r = await b.cmd('Profiler.stop'); row.swapProfile = digest(r.result && r.result.profile, 25); }
      row.prep = await b.ev('JSON.stringify(window.FLYDIY_INTRO_PREP || null)').then(JSON.parse);
      row.long = JSON.parse(await b.ev('JSON.stringify(__MB.lt.filter(x => x[1] > 150))'));
      log('   long tasks > 150 ms (s from the swap): ' + row.long.map(x => x[1] + ' ms at ' + (row.swapPage != null ? ((x[0] - row.swapPage) / 1000).toFixed(2) : x[0])).join(', '));
      if (row.prep) for (const sh of row.prep.shots) log('   shot ' + sh.n + ': updates ' + sh.updates + ' ms (lights ' + sh.lights0 + ' -> ' + sh.lights1 + ', objects ' + sh.objs0 + ' -> ' + sh.objs1 + '), compile ' + sh.compile + ' (' + sh.newProgs + ' new), depth ' + sh.depth + ', links ' + sh.links + ', draws ' + sh.draws + '; key diffs ' + JSON.stringify(sh.keyDiff));
      const show = (k, P) => { if (!P) return; log('   ' + k + ' (' + P.ms + ' ms sampled) - self: ' + P.self.slice(0, 10).map(x => x.ms + ' ' + x.fn).join(' | ')); log('     inclusive: ' + P.incl.slice(0, 14).map(x => x.ms + ' ' + x.fn).join(' | ')); };
      show('the intro step', row.stepProfile); show('the swap', row.swapProfile);
    }
    row.exc = b.exc.splice(0);
  } catch (e) { row.error = String(e && e.stack || e); log(label + ' ERROR ' + row.error); }
  finally { await b.close(); await sleep(1500); try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) { log('profile NOT deleted: ' + udd); } }
  return row;
}
(async () => {
  if (!PORT) { console.error('story_intro_prof: --port is required'); process.exit(2); }
  if (await MB.serveRoot(PORT)) { console.error('story_intro_prof: port ' + PORT + ' is taken'); process.exit(4); }
  const srv = MB.serve(PORT); await sleep(800);
  const R = { meta: { date: new Date().toISOString(), root: await MB.serveRoot(PORT) }, rows: [] };
  try {
    for (let r = 1; r <= REPS; r++) {
      R.rows.push(await one('base' + r, 'intro=0', false));
      R.rows.push(await one('intro' + r, '', true));
      R.rows.push(await one('high' + r, 'introend=high', true));   // the swap's task: the eye end's, or the high end's too?
    }
  } finally { try { srv.kill(); if (process.platform === 'win32') require('child_process').execSync('taskkill /PID ' + srv.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} }
  const base = R.rows.filter(x => /^base/.test(x.label)).map(x => x.readyMs), intro = R.rows.filter(x => /^intro/.test(x.label)).map(x => x.readyMs);
  log('boot ready: base ' + base.join(', ') + ' ms; intro ' + intro.join(', ') + ' ms');
  fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
  log('-> ' + OUT);
})();
