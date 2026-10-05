#!/usr/bin/env node
// hybrid_trips.js - WHICH PROGRAM RE-LINKS ON THE TRIP AFTER A TAXI (HYBRID-TRIPS, G1490). Train 28's strict gate: with
// HYBRID-FARTHER's band (FB.hyA/hyB 1.0/1.25) the Cub's world -> garage after the taxi went 0.3 -> 2.8 s and the next
// garage -> world 8.9 -> 14.1 s with ONE 5.2 s link. This rig runs master_bench's own HOME sequence (a warm-up load +
// roll-out, then in a fresh Chrome on the same profile: the Cub's load, the roll-out @HOME, a taxi in the chase, the way
// back, round trip 2) and records:
//   - every linkProgram: its page time, its duration (KHR_parallel_shader_compile polled, as master_bench), the vertex +
//     fragment source hashed (cessna_links' FNV-1a), the JS stack that issued it (who: a compile, a warm draw, a frame),
//     and whether that SOURCE was linked earlier in this Chrome (seen: Chrome's program cache should have held it) or
//     is NEW (a key that changed);
//   - per phase (after the load, the roll-out, the taxi, each trip) three's live programs (renderer.info.programs: id,
//     name, cacheKey hashed, usedTimes, its source hash) and the diff to the phase before (linked / disposed);
//   - the hybrid's t during the taxi (FLOWN_BAKE.FB.hyT / hyMag), sampled.
// Usage: node tools/perf/hybrid_trips.js --port 8811 --udd D:/ht1 [--fbake hy1-1.25] [--taxi 15] [--fallback D:/Dev/DeGaRoR.github.io]
//        [--out <file.json>] [--dump <dir>]   (GPU lock first; --udd a SHORT fresh path; no --help)
'use strict';
const fs = require('fs'), path = require('path');
const MB = require('../master_bench.js');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const PORT = +opt('port', 0), OUT = opt('out', null), DUMP = opt('dump', null), TAXI = +opt('taxi', 15), FBAKE = opt('fbake', null);
const BUILD = opt('build', 'cub'), EXTRA = opt('q', null);
const UDD = path.resolve(opt('udd', ''));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const flag = k => argv.includes('--' + k);
// a CPU profile's functions by self time (and total: self + descendants, each node counted once per path)
function topSelf(pr, n) {
  const byId = new Map(pr.nodes.map(x => [x.id, x])), dt = new Map();
  for (let i = 0; i < pr.samples.length; i++) dt.set(pr.samples[i], (dt.get(pr.samples[i]) || 0) + (pr.timeDeltas[i] || 0) / 1000);
  const tot = new Map(); const walk = x => { let t = dt.get(x.id) || 0; for (const c of x.children || []) t += walk(byId.get(c)); tot.set(x.id, t); return t; };
  walk(pr.nodes[0]);
  const agg = new Map();
  for (const x of pr.nodes) { const cf = x.callFrame, k = cf.functionName + '|' + cf.url.split('/').pop() + ':' + cf.lineNumber; const a = agg.get(k) || { fn: cf.functionName || '(anon)', at: cf.url.split('/').pop().replace(/\?.*/, '') + ':' + (cf.lineNumber + 1), ms: 0, tot: 0 };
    a.ms += dt.get(x.id) || 0; a.tot = Math.max(a.tot, tot.get(x.id) || 0); agg.set(k, a); }
  return [...agg.values()].sort((a, b) => b.ms - a.ms).slice(0, n).map(a => ({ fn: a.fn, at: a.at, ms: Math.round(a.ms), tot: Math.round(a.tot) }));
}
if (!PORT || !opt('udd', null)) { console.error('hybrid_trips: --port and --udd are required'); process.exit(2); }

const HOOK = `(function(){ if (window.__HT) return; var C = window.__HT = { ln: [], src: {}, keyOf: new WeakMap() };
  var h = function (s) { var a = 0x811c9dc5 >>> 0; for (var i = 0; i < s.length; i++) { a ^= s.charCodeAt(i); a = Math.imul(a, 16777619) >>> 0; } return ('0000000' + a.toString(16)).slice(-8); };
  C.h = h;
  var SH = new WeakMap(), PR = new WeakMap(), P = WebGL2RenderingContext.prototype, cs = P.createShader, ss = P.shaderSource, at = P.attachShader, lp = P.linkProgram, gp = P.getProgramParameter;
  var seen = {};
  P.createShader = function (t) { var s = cs.call(this, t); if (s) SH.set(s, { t: t, src: '' }); return s; };
  P.shaderSource = function (s, src) { var r = SH.get(s); if (r) r.src = src; return ss.call(this, s, src); };
  P.attachShader = function (p, s) { var a = PR.get(p); if (!a) PR.set(p, a = []); a.push(s); return at.call(this, p, s); };
  var stack = function () { return String(new Error().stack || '').split(String.fromCharCode(10)).slice(2, 14).map(function (x) { x = x.trim().replace(/^at /, ''); var m = /^(\\S+) \\((.*)\\)$/.exec(x); var fn = m ? m[1] : '', loc = (m ? m[2] : x).split('/flyDiy/').pop().replace(/\\?v=[^:]*/, ''); return fn + '@' + loc.split('/').pop(); }).join(' < '); };
  P.linkProgram = function (p) { var vs = '', fs = ''; (PR.get(p) || []).forEach(function (s) { var r = SH.get(s); if (r) { if (r.t === 0x8B31) vs = r.src; else fs = r.src; } });
    var hv = h(vs), hf = h(fs), k = hv + hf; C.src[hv] = vs; C.src[hf] = fs; C.keyOf.set(p, k);
    var nm = (/#define SHADER_NAME (.*)/.exec(fs) || [])[1] || '';
    var e = { t: performance.now(), ms: -1, k: k, nm: nm, was: seen[k] ? 'seen' : 'NEW', st: stack(), sync: 0, p: p, gl: this };
    seen[k] = 1; C.ln.push(e); return lp.apply(this, arguments); };
  // a LINK_STATUS asked before the completion: the main thread waits for the link (the 5 s task)
  // (three asks getProgramInfoLog on a program's first use - the wait G1063.2's profile found under it)
  var waited = function (f0, p, self, args) { for (var i = C.ln.length - 1; i >= 0 && i > C.ln.length - 400; i--) { var e = C.ln[i]; if (e.p === p && e.ms < 0) { var t = performance.now(); var r = f0.apply(self, args); var d = performance.now() - t; e.ms = performance.now() - e.t; e.sync = +d.toFixed(1); e.syncSt = d > 50 ? stack() : ''; e.p = e.gl = null; return { r: r }; } } return null; };
  P.getProgramParameter = function (p, n) { if (n === 0x8B82) { var w = waited(gp, p, this, arguments); if (w) return w.r; } return gp.call(this, p, n); };
  var gil = P.getProgramInfoLog;
  P.getProgramInfoLog = function (p) { var w = waited(gil, p, this, arguments); return w ? w.r : gil.apply(this, arguments); };
  var poll = function () { var t = performance.now(); for (var i = Math.max(0, C.ln.length - 400); i < C.ln.length; i++) { var e = C.ln[i]; if (e.ms >= 0 || !e.p) continue; var ok = true; try { ok = gp.call(e.gl, e.p, 0x91B1); } catch (x) {} if (ok) { e.ms = t - e.t; e.p = e.gl = null; } } setTimeout(poll, 25); };
  poll();
  // three's live programs
  C.progs = function () { var R = window.FLYDIY_RENDERER, L = (R && R.info && R.info.programs) || []; return L.map(function (q) { return { id: q.id, name: q.name, ck: h(q.cacheKey || ''), used: q.usedTimes, k: C.keyOf.get(q.program) || '?', ckLen: (q.cacheKey || '').length }; }); };
  C.hy = []; setInterval(function () { var F = window.FLOWN_BAKE && FLOWN_BAKE.FB; if (F) C.hy.push([Math.round(performance.now()), F.hyT, F.hyMag == null ? null : +F.hyMag.toFixed(3)]); if (C.hy.length > 20000) C.hy.splice(0, 5000); }, 250);
})();`;

(async () => {
  if (await MB.serveRoot(PORT)) { console.error('hybrid_trips: port ' + PORT + ' is taken'); process.exit(4); }
  const srv = MB.serve(PORT, opt('fallback', null)); await sleep(800);
  const q = [FBAKE ? 'fbake=' + encodeURIComponent(FBAKE) : null, EXTRA].filter(Boolean).join('&');
  const BASE = 'http://localhost:' + PORT + '/flyDiy/index.html' + (q ? '?' + q : '');
  const R = { meta: { date: new Date().toISOString(), fbake: FBAKE, q: EXTRA, taxi: TAXI, udd: UDD, build: BUILD, url: BASE }, phases: [], trips: [] };
  const log = s => console.log('  ' + s);
  const fresh = !fs.existsSync(UDD);
  const tripRun = async (b, kind, action) => {
    const n0 = await b.ev(MB.A.trips), t0 = await b.ev('performance.now()'), w0 = Date.now(); await b.ev(action);
    let d = null;
    for (const tEnd = Date.now() + 300000; Date.now() < tEnd; await sleep(150)) { d = JSON.parse(await b.ev(MB.A.lastTrip, 30000)); if (d.n > n0 && d.kind === kind && d.done && d.boot === 'gone') break; d = null; }
    const t1 = await b.ev('performance.now()');
    return { t0, t1, ms: d ? d.ms : null, wall: +((Date.now() - w0) / 1000).toFixed(1), ran: d ? d.ran : null };
  };
  const flying = async b => { await sleep(1500); const t1 = await b.ev(MB.A.simT); await sleep(1200); const t2 = await b.ev(MB.A.simT); if (!(t2 > t1)) await b.ev(MB.A.run); };
  // the warm-up (master_bench's: the default build, a roll-out) on a fresh profile
  if (fresh) { log('warm-up in ' + UDD); const b = await MB.browser(UDD); await b.load(BASE, MB.preScript('default', null)); await tripRun(b, 'rollout', MB.A.rollOut); await sleep(3000); await b.close(); }
  const B = MB.BUILDS[BUILD];
  const b = await MB.browser(UDD);
  const l = await b.load(BASE, MB.preScript(B.build, null, B.patch) + '\n' + HOOK);
  log(BUILD + ' load ' + l.sec + ' s (' + l.state + ')');
  await sleep(1500);
  let prev = [];
  const linksIn = async (t0, t1) => JSON.parse(await b.ev('JSON.stringify(__HT.ln.filter(e => e.t >= ' + t0 + ' && e.t <= ' + t1 + ').map(e => ({ t: Math.round(e.t), ms: Math.round(e.ms), k: e.k, nm: e.nm, was: e.was, sync: e.sync, st: e.st, syncSt: e.syncSt || "" })))', 30000));
  const phase = async (name, extra) => {
    const progs = JSON.parse(await b.ev('JSON.stringify(__HT.progs())', 30000));
    const byCk = new Map(prev.map(p => [p.ck + ':' + p.id, p])), now = new Map(progs.map(p => [p.ck + ':' + p.id, p]));
    const added = progs.filter(p => !byCk.has(p.ck + ':' + p.id)), gone = prev.filter(p => !now.has(p.ck + ':' + p.id));
    const row = Object.assign({ phase: name, n: progs.length, added: added.map(p => [p.id, p.name, p.ck, p.k]), gone: gone.map(p => [p.id, p.name, p.ck, p.k]), progs }, extra || {});
    R.phases.push(row); prev = progs;
    log('[' + name + '] programs ' + progs.length + '  +' + added.length + ' -' + gone.length + (gone.length ? '  gone: ' + gone.slice(0, 12).map(p => p.name + '#' + p.id).join(' ') : ''));
    return row;
  };
  const tripRow = async (name, kind, action) => {
    const tr = await tripRun(b, kind, action);
    const L = await linksIn(tr.t0, tr.t1 + 2000);
    const slow = L.filter(e => e.ms > 500 || e.sync > 50);
    const row = Object.assign({ trip: name }, tr, { links: L.length, newSrc: L.filter(e => e.was === 'NEW').length, seenSrc: L.filter(e => e.was === 'seen').length, slow });
    R.trips.push(row);
    log(name.padEnd(30) + ' ' + (tr.ms / 1000).toFixed(2) + ' s (wall ' + tr.wall + ') links ' + L.length + ' (new ' + row.newSrc + ', seen ' + row.seenSrc + ') ran [' + (tr.ran || []).join(' ') + ']');
    for (const e of slow) log('    link ' + e.ms + ' ms sync ' + e.sync + ' ms ' + e.was + ' ' + e.k + ' ' + e.nm + '\n        by ' + e.st + (e.syncSt ? '\n        waited by ' + e.syncSt : ''));
    await phase('after ' + name, { links: L });
    return row;
  };
  await phase('garage (load)');
  await tripRow('garage -> world (first) @HOME', 'rollout', MB.A.rollOut); await flying(b);
  await b.ev(MB.A.cam('chase'));
  const tx0 = await b.ev('performance.now()');
  await sleep(TAXI * 1000);
  const tx1 = await b.ev('performance.now()');
  const hy = JSON.parse(await b.ev('JSON.stringify(__HT.hy.filter(r => r[0] >= ' + tx0 + ' && r[0] <= ' + tx1 + '))'));
  const ts = hy.map(r => r[1]).filter(x => x != null);
  const taxiLinks = await linksIn(tx0, tx1);
  R.taxi = { t0: tx0, t1: tx1, tMin: Math.min(...ts), tMax: Math.max(...ts), tMean: +(ts.reduce((a, x) => a + x, 0) / Math.max(1, ts.length)).toFixed(3), magMin: Math.min(...hy.map(r => r[2]).filter(x => x != null)), magMax: Math.max(...hy.map(r => r[2]).filter(x => x != null)), links: taxiLinks };
  log('taxi ' + TAXI + ' s: hybrid t ' + R.taxi.tMin + '..' + R.taxi.tMax + ' (mean ' + R.taxi.tMean + '), px/texel ' + R.taxi.magMin + '..' + R.taxi.magMax + ', links ' + taxiLinks.length + ' (new ' + taxiLinks.filter(e => e.was === 'NEW').length + ')');
  for (const e of taxiLinks) log('    taxi link ' + e.ms + ' ms sync ' + e.sync + ' ' + e.was + ' ' + e.k + ' ' + e.nm + '\n        by ' + e.st);
  await phase('after the taxi', { links: taxiLinks });
  // --prof: the way back under the CPU profiler (where world -> garage's seconds go when no link is slow)
  if (flag('prof')) { await b.cmd('Profiler.enable'); await b.cmd('Profiler.setSamplingInterval', { interval: 500 }); await b.cmd('Profiler.start'); }
  await tripRow('world -> garage @HOME', 'rollin', MB.A.rollIn);
  if (flag('prof')) { const pr = (await b.cmd('Profiler.stop')).result.profile; R.prof = topSelf(pr, 40);
    if (DUMP) { fs.mkdirSync(DUMP, { recursive: true }); fs.writeFileSync(path.join(DUMP, 'rollin.cpuprofile'), JSON.stringify(pr)); }
    for (const r of R.prof.slice(0, 25)) log('    self ' + String(r.ms).padStart(6) + ' ms  total ' + String(r.tot).padStart(6) + ' ms  ' + r.fn + ' ' + r.at); }
  await tripRow('round trip 2: garage -> world', 'rollout', MB.A.rollOut); await flying(b);
  await tripRow('round trip 2: world -> garage', 'rollin', MB.A.rollIn);
  R.allLinks = await linksIn(0, 1e12);
  if (DUMP) { fs.mkdirSync(DUMP, { recursive: true }); const src = JSON.parse(await b.ev('JSON.stringify(__HT.src)', 60000));
    const ks = new Set(); for (const t of R.trips) for (const e of t.slow) ks.add(e.k); for (const e of R.taxi.links) ks.add(e.k);
    // --dumpre <regex>: every program whose SHADER_NAME matches, whenever it linked (the band twins before and after a trip)
    if (opt('dumpre', null)) { const re = new RegExp(opt('dumpre')); for (const e of R.allLinks) if (re.test(e.nm)) ks.add(e.k); }
    for (const k of ks) { fs.writeFileSync(path.join(DUMP, k + '_vs.glsl'), src[k.slice(0, 8)] || ''); fs.writeFileSync(path.join(DUMP, k + '_fs.glsl'), src[k.slice(8)] || ''); } }
  R.exc = b.exc.slice(0, 20);
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
  await Promise.race([b.close(), sleep(15000)]);   // (Browser.close can go unanswered: the JSON is written first)
  try { srv.kill(); require('child_process').execSync('taskkill /PID ' + srv.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {}
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
