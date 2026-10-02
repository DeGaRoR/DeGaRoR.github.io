#!/usr/bin/env node
// locswitch_probe.js - G1180 (LOC-SWITCH): ONE BUILD'S TRIPS, STEP BY STEP. A load, the first roll-out (HOME, or the SEA
// lane for a float build), the way back, then a roll-out to each --places id and back - each trip with the roll-out
// screen's own step timings (BOOT.log 'step' rows: id, ms), the long tasks in it (>= 200 ms, the worst), the frames the
// loop drew (the master bench's ring) split IN / OUT of a screen, and a screenshot half-way through (what the player sees).
// Usage: node tools/perf/locswitch_probe.js --port 8652 --udd <short dir> [--build cub|floats|twinFloats|...]
//        [--places w3,mn_strip] [--shots <dir>] [--water 10] [--label x] [--query a=1]
// GPU lock first (a browser run). No --help: an unknown flag is ignored.
'use strict';
const fs = require('fs'), path = require('path');
const MB = require('../master_bench.js');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const REPO = path.resolve(__dirname, '..', '..', '..');
const PORT = +opt('port', 0), UDD = opt('udd', null), BK = opt('build', 'cub'), LABEL = opt('label', BK), Q = opt('query', '');
const PLACES = opt('places', 'w3').split(',').filter(Boolean), SHOTS = opt('shots', null), WATER = +opt('water', 10);
if (!PORT || !UDD) { console.error('locswitch_probe: --port and --udd are required'); process.exit(2); }

(async () => {
  if (await MB.serveRoot(PORT)) { console.error('port ' + PORT + ' is taken'); process.exit(4); }
  const srv = MB.serve(PORT, null); await sleep(800);
  const root = await MB.serveRoot(PORT);
  if (!root || path.resolve(root) !== REPO) { console.error('the server serves ' + root); srv.kill(); process.exit(4); }
  const b = await MB.browser(path.resolve(UDD));
  const B = MB.BUILDS[BK];
  const out = { label: LABEL, build: BK, trips: [], scenes: [] };
  const log = s => console.log('  ' + s);
  const shot = async name => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true });
    const r = await b.cmd('Page.captureScreenshot', { format: 'jpeg', quality: 60 }); if (r.result && r.result.data) fs.writeFileSync(path.join(SHOTS, LABEL + '_' + name + '.jpg'), Buffer.from(r.result.data, 'base64')); };
  // the page's screen state, sampled by the page itself (every 50 ms): [t, BOOT.state, overlay shown]
  const SAMPLER = "(() => { if (window.__LS) return 1; const L = window.__LS = []; let k = ''; setInterval(() => { const el = document.getElementById('boot');"
    + " const vis = !!(el && !el.hidden && getComputedStyle(el).display !== 'none' && +getComputedStyle(el).opacity > 0.05); const s = (window.BOOT ? BOOT.state : '?') + '|' + vis;"
    + " if (s !== k) { k = s; L.push([Math.round(performance.now()), BOOT.state, vis]); } }, 50); return 1; })()";
  // --trace: the house worker's queue through the trip (every answer's arrival: seq, kind, id; the head's wait), the stream
  const TRACE = "(() => { const W = window.WORLD, P = W && W.premises, H = P && P.hw; if (!H) return 'no hw'; window.FLYDIY_WORLD_SETTLE = null; const T = window.__TR = { a: [], s: [], t0: performance.now(), k: 0, c: 0 };"
    + " if (!H.arrived.__tr) { H.arrived.__tr = 1; const set0 = H.arrived.set.bind(H.arrived); H.arrived.set = (k, v) => { const j = H.jobs.get(k); window.__TR.a.push([Math.round(performance.now() - window.__TR.t0), k, j && j.kind, j && j.p && j.p.id, v && v.miss ? 'miss ' + v.miss : '', v && v.ms != null ? Math.round(v.ms) : null]); return set0(k, v); }; }"
    + " let k = ''; T.iv = setInterval(() => { const h0 = H.order[0], j = h0 != null ? H.jobs.get(h0) : null, S = P.streamState;"
    + " const rs = W.ringStat ? W.ringStat() : null; let c = 0; if (++T.k % 5 === 0) { W.scene.traverse(() => { c++; }); T.c = c; }"
    + " const s = [H.order.length, h0, j && j.p && j.p.id, j && j.kind, j && j.sent, S && S.near, BOOT.state, BOOT.current && BOOT.current.id, rs ? 'fill busy ' + rs.busy + ' q ' + rs.queued + ' live ' + rs.live + ' base ' + rs.base + ' fill ' + rs.fill : '-', 'objs ' + T.c, (() => { const K = window.PARKED; if (!K) return 'no parked'; const C = K.COOK || {}; return 'pk q ' + K.queued() + ' async ' + K.async + ' cookPend ' + C.pending + ' cookAll ' + !!C.all + ' allDone ' + !!C.allDone + ' waiting ' + (C.waiting ? C.waiting.size : '-') + ' pend ' + (K.pending ? K.pending.length : '-'); })(), 'settled ' + !!window.FLYDIY_WORLD_SETTLE].join('|'); if (s !== k) { k = s; T.s.push([Math.round(performance.now() - T.t0), s]); } }, 100); return 'ok'; })()";
  const l = await b.load('http://localhost:' + PORT + '/flyDiy/' + opt('page', 'index.html') + (Q ? '?' + Q : ''), MB.preScript(B.build, opt("gfx", null) ? JSON.parse(opt("gfx")) : null, B.patch));
  log('load ' + l.sec + ' s (' + l.state + ')'); out.load = l.sec;
  await b.ev(SAMPLER);
  // the holds and the compile's activity, sampled every 50 ms from the page (changes only)
  await b.ev("(() => { const L = window.__HD = []; let k = ''; setInterval(() => { const h = window.FLYDIY_HOLDS ? FLYDIY_HOLDS() : {};"
    + " const s = JSON.stringify(h) + ' linking ' + (window.__MB && __MB.ln ? __MB.ln.filter(e => e[1] < 0).length : '-') + ' hy ' + (window.__hyWarm ? (window.__hyWarm.drawn != null ? 'drawn' : 'warming') : '-');"
    + " if (s !== k) { k = s; L.push([Math.round(performance.now()), s]); } }, 50); return 1; })()");
  out.bootInfo = JSON.parse(await b.ev("JSON.stringify({ pace: !!window.FLYDIY_PACE, hooked: !!(window.FLYDIY_PACE && FLYDIY_PACE.__mb), fr: __MB.fr.length, state: FLYDIY_PACE && FLYDIY_PACE.state ? FLYDIY_PACE.state() : null,"
    + " trips: (window.FLYDIY_TRIPS || []).map(t => t.kind + ': ' + t.steps.filter(s => s.ran).map(s => s.id).join(' ')), boot: BOOT.log.filter(e => e.k === 'step' || e.k === 'fail' || e.k === 'show' || e.k === 'gone').map(e => [e.k, e.id || e.set || e.reason || '', e.t, e.ms]) })"));
  await sleep(3000); out.bootInfo.fr3 = await b.ev('__MB.fr.length');
  log('boot info ' + JSON.stringify(out.bootInfo).slice(0, 2500));
  out.bootSettle = JSON.parse(await b.ev('JSON.stringify(window.FLYDIY_WORLD_SETTLE || null)')); log('boot settle ' + JSON.stringify(out.bootSettle));
  const trip = async (name, kind, action, mid) => {
    const n0 = await b.ev(MB.A.trips), t0 = await b.ev('performance.now()'), lg0 = await b.ev('BOOT.log.length');
    const w0 = Date.now(); const pressed = await b.ev(action);
    let d = null, shotDone = !mid; const tEnd = Date.now() + 300000;
    while (Date.now() < tEnd) {
      d = JSON.parse(await b.ev(MB.A.lastTrip, 30000));
      if (d.n > n0 && d.kind === kind && d.done && d.boot === 'gone') break;
      if (!shotDone && Date.now() - w0 > mid * 1000) { shotDone = true; await shot(name.replace(/\W+/g, '_') + '_mid'); }
      d = null; await sleep(150);
    }
    const t1 = await b.ev('performance.now()');
    const P = JSON.parse(await b.ev('JSON.stringify({ fr: __MB.fr.filter(r => r[0] > ' + t0 + '), lt: __MB.lt.filter(x => x[0] + x[1] > ' + t0 + '), ls: (window.__LS || []).filter(x => x[0] >= ' + (t0 - 100) + '), steps: BOOT.log.slice(' + lg0 + ').filter(e => e.k === "step" || e.k === "show" || e.k === "gone").map(e => [e.k, e.id || e.set || "", e.t, e.ms]) })', 20000));
    const tasks = P.lt.map(x => x[1]);
    const gaps = P.fr.map(r => r[1]).filter(x => x > 0);
    const screenMs = (() => { let s = 0, on = null; for (const x of P.ls) { const up = x[1] !== 'gone' && x[2]; if (up && on == null) on = x[0]; if (!up && on != null) { s += x[0] - on; on = null; } } if (on != null) s += t1 - on; return Math.round(s); })();
    const row = { name, kind, pressed, ms: d ? d.ms : null, wall: +((Date.now() - w0) / 1000).toFixed(1), ran: d ? d.ran : null, anim: d ? d.anim : null,
      steps: P.steps.filter(e => e[0] === 'step').map(e => e[1] + ' ' + (e[3] != null ? (e[3] / 1000).toFixed(1) + ' s' : '?')),
      frames: gaps.length, worstFrame: gaps.length ? Math.round(Math.max(...gaps)) : null, screenMs, screens: P.ls,
      tasks200: tasks.filter(x => x >= 200).length, tasks1s: tasks.filter(x => x >= 1000).length, worstTask: tasks.length ? Math.max(...tasks) : 0,
      links: await b.links(t0, t1) };
    if (argv.includes('--trace')) { row.trace = JSON.parse(await b.ev('JSON.stringify(window.__TR ? { a: __TR.a, s: __TR.s } : null)')); row.bootLog = JSON.parse(await b.ev('JSON.stringify(BOOT.log.slice(' + lg0 + ').filter(e => e.k !== "phase"))')); }
    // the steps that ran, and why: a key that moved is shown where it first differs (the aircraft's are the build's JSON)
    row.why = JSON.parse(await b.ev("JSON.stringify((() => { const L = window.FLYDIY_TRIPS || []; const t = L[L.length - 1]; if (!t) return []; return t.steps.filter(s => s.ran).map(s => {"
      + " const a = typeof s.was === 'string' ? s.was : '', k = typeof s.key === 'string' ? s.key : ''; let i = 0; while (i < a.length && a[i] === k[i]) i++;"
      + " return { id: s.id, why: s.why, diff: s.why === 'key' ? { was: a.slice(Math.max(0, i - 160), i + 160), now: k.slice(Math.max(0, i - 160), i + 160) } : undefined }; }); })())"));
    for (const w of row.why) if (w.diff) log('    key ' + w.id + ': was ...' + w.diff.was + ' | now ...' + w.diff.now);
    out.trips.push(row);
    log(name.padEnd(30) + ' ' + (row.ms / 1000).toFixed(1) + ' s  screen ' + (screenMs / 1000).toFixed(1) + ' s  frames ' + row.frames + ' worst ' + row.worstFrame + ' ms  task worst ' + row.worstTask + ' ms (>=1 s: ' + row.tasks1s + ')  links ' + row.links.n + '  [' + row.steps.join(', ') + ']');
    return row;
  };
  const scene = async (name, sec) => { const t0 = await b.ev('performance.now()'); await sleep(4000); await shot(name.replace(/\W+/g, '_') + '_4s'); await sleep(Math.max(0, sec * 1000 - 4000)); const t1 = await b.ev('performance.now()');
    const P = JSON.parse(await b.ev('JSON.stringify({ fr: __MB.fr.slice(-30000), lt: __MB.lt })', 20000));
    const st = MB.stat(P.fr, P.lt, t0, t1); out.scenes.push(Object.assign({ scene: name }, st || { frames: 0 }));
    const gaps = P.fr.filter(r => r[0] > t0 && r[0] <= t1 && r[1] > 100).map(r => [Math.round(r[0] - r[1] - t0), Math.round(r[1]), r[3], r[4]]);
    if (gaps.length) { const HD = JSON.parse(await b.ev('JSON.stringify(window.__HD || [])')); out.scenes[out.scenes.length - 1].holds = HD.filter(x => x[0] > t0 - 20000 && x[0] < t1).map(x => [Math.round(x[0] - t0), x[1]]); log('    holds: ' + JSON.stringify(out.scenes[out.scenes.length - 1].holds).slice(0, 3000)); out.scenes[out.scenes.length - 1].gaps = gaps; log('    gaps > 100 ms [start in scene, ms, Vg, agl]: ' + JSON.stringify(gaps.slice(0, 12))); }
    log(name.padEnd(30) + ' ' + (st ? st.fps + ' fps, uneven ' + (100 * st.uneven).toFixed(0) + ' %, p99 ' + st.p99 + ', worst ' + st.worst + ' ms, tasks>=200 ' + st.tasks200 + ' (worst ' + st.taskWorst + ')' : 'NO FRAMES (ring ' + P.fr.length + ')')); };
  const flying = async () => { await sleep(1500); const a = await b.ev(MB.A.simT); await sleep(1200); const c = await b.ev(MB.A.simT); if (!(c > a)) await b.ev(MB.A.run); };
  await trip('garage -> world (first)', 'rollout', MB.A.rollOut, 4); await flying();
  if (B.patch || /float/i.test(BK)) { await b.ev(MB.A.cam('chase')); await scene('water taxi @SEA', WATER); }
  await shot('first_world');
  await trip('world -> garage', 'rollin', MB.A.rollIn, 0);
  for (const id of PLACES) {
    const r = await b.ev(MB.A.setFrom(id)); if (r !== id) { log('route pick ' + id + ': ' + r); continue; }
    if (argv.includes('--trace')) await b.ev(TRACE);
    await trip('garage -> world @' + id, 'rollout', MB.A.rollOut, 14); await flying();
    await shot(id + '_world');
    await trip('world -> garage @' + id, 'rollin', MB.A.rollIn, 0);
  }
  out.exceptions = b.exc.slice(0, 20);
  const f = path.join(__dirname, 'locswitch_' + LABEL + '.json'); fs.writeFileSync(f, JSON.stringify(out, null, 1)); log('-> ' + f);
  await b.close(); try { srv.kill(); require('child_process').execSync('taskkill /PID ' + srv.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {}
  process.exit(0);
})().catch(e => { console.error('locswitch_probe: ' + (e && e.stack || e)); process.exit(1); });
