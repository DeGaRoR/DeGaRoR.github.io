#!/usr/bin/env node
// cessna_links.js - WHY A WARM LOAD RE-LINKS (CESSNA-LINKS, G1220). The metal Cessna's warm loads ran 7 links over 5 s on
// every load (master_bench / metla_ab) while the Cub's hit the GPU program cache. Per load (navigation -> garage, each in
// its OWN Chrome on ONE fresh profile, so the second meets the first's disk cache): every linkProgram timed (master_bench's
// recorder) AND hashed (vertex + fragment source, FNV-1a), then between loads: the slow links whose program an EARLIER load
// of the same profile already linked (the cache should have held it: capacity / key) vs the ones whose source is NEW (a
// source that differs per load: the cause this rig looks for). --dump <dir> writes the differing sources (load a / load b)
// for a diff.
// Usage: node tools/perf/cessna_links.js --port 8650 [--udd D:/cl1] [--builds metal,metal,metal] [--slow 1000] [--dump <dir>] [--fallback D:/Dev/DeGaRoR.github.io]
//        [--out <file.json>]     (GPU lock first; --udd a SHORT fresh path; no --help: an unknown flag runs it)
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const MB = require('../master_bench.js');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const PORT = +opt('port', 0), SLOW = +opt('slow', 1000), DUMP = opt('dump', null), OUT = opt('out', null);
const UDD = path.resolve(opt('udd', path.join(os.tmpdir(), 'cl' + Date.now().toString(36).slice(-5))));
const LOADS = opt('builds', 'metal,metal,metal').split(',');
const sleep = ms => new Promise(r => setTimeout(r, ms));
if (!PORT) { console.error('cessna_links: --port is required'); process.exit(2); }

// the source recorder, after master_bench's (its linkProgram wrapper times; this one hashes)
const HASH = `(function(){ if (window.__CL) return; var C = window.__CL = { ln: [], src: {}, cx: [] }, CX = new WeakMap();
  var h = function (s) { var a = 0x811c9dc5 >>> 0; for (var i = 0; i < s.length; i++) { a ^= s.charCodeAt(i); a = Math.imul(a, 16777619) >>> 0; } return ('0000000' + a.toString(16)).slice(-8); };
  var SH = new WeakMap(), PR = new WeakMap(), P = WebGL2RenderingContext.prototype, cs = P.createShader, ss = P.shaderSource, at = P.attachShader, lp = P.linkProgram;
  P.createShader = function (t) { var s = cs.call(this, t); if (s) SH.set(s, { t: t, src: '' }); return s; };
  P.shaderSource = function (s, src) { var r = SH.get(s); if (r) r.src = src; return ss.call(this, s, src); };
  P.attachShader = function (p, s) { var a = PR.get(p); if (!a) PR.set(p, a = []); a.push(s); return at.call(this, p, s); };
  P.linkProgram = function (p) { var vs = '', fs = ''; (PR.get(p) || []).forEach(function (s) { var r = SH.get(s); if (r) { if (r.t === 0x8B31) vs = r.src; else fs = r.src; } });
    var hv = h(vs), hf = h(fs); C.src[hv] = vs; C.src[hf] = fs; var cx = CX.get(this); if (cx == null) { CX.set(this, cx = C.cx.length); var a = this.getContextAttributes() || {}; C.cx.push({ aa: a.antialias, alpha: a.alpha, depth: a.depth, stencil: a.stencil, pdb: a.preserveDrawingBuffer, pp: a.powerPreference, w: this.drawingBufferWidth, h: this.drawingBufferHeight, ext: (this.getSupportedExtensions() || []).length, t: Math.round(performance.now()) }); } C.ln.push([performance.now(), hv, hf, cx]); return lp.apply(this, arguments); };
})();`;

(async () => {
  if (await MB.serveRoot(PORT)) { console.error('cessna_links: port ' + PORT + ' is taken'); process.exit(4); }
  const srv = MB.serve(PORT, opt('fallback', null)); await sleep(800);
  const BASE = 'http://localhost:' + PORT + '/flyDiy/index.html';
  const R = { udd: UDD, loads: [] }, seen = new Map();   // program key (hv+hf) -> the first load that linked it
  // --one: every load in ONE Chrome (metla_ab's / master_bench's way: the GPU process and its in-memory program cache live
  // through the loads); --fly: after the garage, the roll-out and 15 s of taxi (the flight's programs join the cache)
  const ONE = argv.includes('--one'), FLY = argv.includes('--fly');
  let b1 = null;
  for (let li = 0; li < LOADS.length; li++) {
    const key = LOADS[li], B = MB.BUILDS[key];
    const b = ONE ? (b1 = b1 || await MB.browser(UDD)) : await MB.browser(UDD);
    const l = await b.load(BASE, MB.preScript(B.build, null, B.patch) + '\n' + HASH);
    await sleep(3000);   // the garage's own links settle
    const tG = await b.ev('performance.now()');
    let fly = null;
    if (FLY) { const n0 = await b.ev(MB.A.trips), w0 = Date.now(); await b.ev(MB.A.rollOut);
      for (const tEnd = Date.now() + 300000; Date.now() < tEnd; await sleep(200)) { const d = JSON.parse(await b.ev(MB.A.lastTrip, 30000)); if (d.n > n0 && d.kind === 'rollout' && d.done && d.boot === 'gone') break; }
      fly = +((Date.now() - w0) / 1000).toFixed(1); await sleep(2500); await b.ev(MB.A.run).catch(() => 0); await b.ev(MB.A.cam('chase')).catch(() => 0); await sleep(15000); }
    // master_bench's ln rows [t0, ms] and ours [t0, hv, hf] were pushed in the same call: zip by order
    const d = JSON.parse(await b.ev('JSON.stringify({ t: (__MB.ln || []).map(e => [Math.round(e[0]), Math.round(e[1])]), h: __CL.ln.map(e => [e[1], e[2], e[3]]), cx: __CL.cx })', 30000));
    const all = d.t.map((t, i) => ({ t0: t[0], ms: t[1], k: d.h[i] ? d.h[i][0] + d.h[i][1] : '?', vs: d.h[i] && d.h[i][0], fs: d.h[i] && d.h[i][1] }));
    all.forEach((r, i) => r.cx = d.h[i] && d.h[i][2]);
    const rows = all.filter(r => r.t0 <= tG), flown = all.filter(r => r.t0 > tG);
    const slow = rows.filter(r => r.ms > SLOW);
    const cls = r => seen.has(r.k) ? 'seen@' + seen.get(r.k) : 'NEW';
    const row = { i: li, build: key, sec: l.sec, state: l.state, rollout: fly, flownLinks: flown.length, flownNew: flown.filter(r => !seen.has(r.k)).length, links: rows.length, distinct: new Set(rows.map(r => r.k)).size,
      newPrograms: rows.filter(r => !seen.has(r.k)).length, over1s: rows.filter(r => r.ms > 1000).length, over5s: rows.filter(r => r.ms > 5000).length,
      slow: slow.map(r => ({ t0: r.t0, ms: r.ms, k: r.k, was: cls(r) })), keys: rows.map(r => r.k + ':' + r.ms + ':' + r.cx), contexts: d.cx, hist: await b.cmd('Browser.getHistograms', { query: 'ProgramCache' }).then(x => (x.result && x.result.histograms || []).map(h => [h.name, h.count, h.sum])).catch(e => String(e)), cache: MB.cacheMB(UDD), exc: b.exc.slice(0, 5) };
    // the NEW programs of a warm load against the same build's earlier load: pair them by the vertex OR fragment hash kept
    if (DUMP && li > 0) {
      fs.mkdirSync(DUMP, { recursive: true });
      const src = JSON.parse(await b.ev('JSON.stringify(__CL.src)', 60000));
      const prevSrc = R.__src || {};
      const neu = rows.filter(r => !seen.has(r.k) && seen.size);
      neu.slice(0, 12).forEach((r, j) => {
        const half = [...seen.keys()].find(k => k.slice(0, 8) === r.vs || k.slice(8) === r.fs);
        fs.writeFileSync(path.join(DUMP, 'L' + li + '_' + j + '_new_vs.glsl'), src[r.vs] || ''); fs.writeFileSync(path.join(DUMP, 'L' + li + '_' + j + '_new_fs.glsl'), src[r.fs] || '');
        if (half) { fs.writeFileSync(path.join(DUMP, 'L' + li + '_' + j + '_old_vs.glsl'), prevSrc[half.slice(0, 8)] || ''); fs.writeFileSync(path.join(DUMP, 'L' + li + '_' + j + '_old_fs.glsl'), prevSrc[half.slice(8)] || ''); }
      });
      R.__src = Object.assign(prevSrc, src);
    } else if (DUMP) R.__src = JSON.parse(await b.ev('JSON.stringify(__CL.src)', 60000));
    if (DUMP) { fs.mkdirSync(DUMP, { recursive: true }); const src = R.__src || {};   // the heavy ones (> 5 s), whatever load: their sources, to name them
      rows.filter(r => r.ms > 5000).forEach(r => { const f = path.join(DUMP, 'heavy_' + r.k + '_fs.glsl'); if (!fs.existsSync(f)) { fs.writeFileSync(f, src[r.fs] || ''); fs.writeFileSync(path.join(DUMP, 'heavy_' + r.k + '_vs.glsl'), src[r.vs] || ''); } }); }
    for (const r of all) if (!seen.has(r.k)) seen.set(r.k, li);
    R.loads.push(row);
    console.log('L' + li + ' ' + key + ' ' + l.sec + ' s (' + l.state + ') links ' + row.links + ' distinct ' + row.distinct + ' new ' + row.newPrograms
      + ' >1s ' + row.over1s + ' >5s ' + row.over5s + (FLY ? ' | roll-out ' + fly + ' s, flown links ' + row.flownLinks + ' new ' + row.flownNew : '') + ' GPU cache ' + row.cache.gpuCache + ' MB' + (row.exc.length ? ' EXC ' + row.exc[0] : ''));
    for (const s of row.slow) console.log('    ' + String(s.t0).padStart(6) + ' ms  link ' + (s.ms / 1000).toFixed(1) + ' s  ' + s.k + '  ' + s.was);
    if (!ONE) await b.close();
  }
  if (b1) await b1.close();
  delete R.__src;
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
  try { srv.kill(); require('child_process').execSync('taskkill /PID ' + srv.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {}
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
