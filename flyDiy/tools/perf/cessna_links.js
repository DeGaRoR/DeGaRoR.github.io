#!/usr/bin/env node
// cessna_links.js - WHY A WARM LOAD RE-LINKS (CESSNA-LINKS, G1220). The metal Cessna's warm loads ran 7 links over 5 s on
// every load (master_bench / metla_ab) while the Cub's hit the GPU program cache. Per load (navigation -> garage, each in
// its OWN Chrome on ONE fresh profile, so the second meets the first's disk cache): every linkProgram timed (master_bench's
// recorder) AND hashed (vertex + fragment source, FNV-1a), then between loads: the slow links whose program an EARLIER load
// of the same profile already linked (the cache should have held it: capacity / key) vs the ones whose source is NEW (a
// source that differs per load: the cause this rig looks for). --dump <dir> writes the differing sources (load a / load b)
// for a diff.
// Usage: node tools/perf/cessna_links.js --port 8650 [--udd D:/cl1] [--builds metal,metal,metal | cub@town=0,cub@town=1] [--slow 1000] [--dump <dir>] [--fallback D:/Dev/DeGaRoR.github.io]
//        [--fly-sec 15] [--ck] [--hist ProgramCache,Shader]   (BOOT-PROGRAMS 9 Nov: --ck names each source linked twice in one load by
//        the three cacheKeys of its programs, cut to where they differ; --hist the CDP histogram queries)
//        [--lights] [--cam chase|cockpit|chase,cockpit]   (CRAFT-LIGHT RE-KEY 10 Nov: every change of the light count three keys a render on, per
//        scene, named - see LIGHTS_HOOK; --cam the flight's view, chase by default; 'chase,cockpit' splits --fly-sec between them in turn)
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
const LIGHTS = argv.includes('--lights'), CAM = opt('cam', 'chase');
const FLY_SEC = +opt('fly-sec', 15), SETTLE = +opt('settle', -1), CK = argv.includes('--ck'), HIST = opt('hist', 'ProgramCache').split(',');
// --lights (CRAFT-LIGHT RE-KEY, 10 Nov): every change of the light count three would key a render on, per scene, named.
// three r186 counts a light when it is visible through every parent and on the camera's layers (WebGLRenderer.render:
// traverseVisible + layers.test). The page hook keeps the scenes' lights (re-listed in idle time every 3 s, never inside a
// frame) and, per render, counts those whose chain is visible and whose layers test the camera's: a few dozen parent walks.
// A change is logged with the time, the scene, the camera (type, layer mask), the target, the counts, the craft's
// visibility chain and the caller (the stack under render): [t, scene, cam, mask, rt, 'dir,point,spot', stack]
const LIGHTS_HOOK = `(() => { const R = window.FLIGHT_PROBE && FLIGHT_PROBE.renderer && FLIGHT_PROBE.renderer(); if (!R || R.__lh) return R ? 1 : 0;
  const orig = R.render, LH = window.__LH = { log: [], scenes: new Map(), last: new Map(), n: 0 };
  const list = sc => { const ls = []; sc.traverse(o => { if (o.isLight && !o.isAmbientLight) ls.push(o); }); LH.scenes.set(sc, ls); };
  const relist = () => { for (const sc of LH.scenes.keys()) list(sc); setTimeout(() => (window.requestIdleCallback || (f => f()))(relist), 3000); };
  relist();
  const shown = (o, sc) => { for (let x = o; x; x = x.parent) { if (x.visible === false) return false; if (x === sc) return true; } return false; };
  R.render = function (sc, cam) {
    try {
      if (sc && cam && sc.isScene) {
        if (!LH.scenes.has(sc)) list(sc);
        let d = 0, p = 0, s = 0; const hid = [];
        for (const L of LH.scenes.get(sc)) { const on = shown(L, sc) && L.layers.test(cam.layers); if (on) { if (L.isDirectionalLight) d++; else if (L.isPointLight) p++; else if (L.isSpotLight) s++; } else if (L.isPointLight || L.isSpotLight) hid.push(L); }
        const k = d + ',' + p + ',' + s, prev = LH.last.get(sc);
        if (prev !== k) { LH.last.set(sc, k);
          if (LH.log.length < 600) { const why = hid.slice(0, 3).map(L => { let x = L, w = ''; for (; x && x !== sc; x = x.parent) if (x.visible === false) { w = 'hidden:' + (x.name || x.type); break; } return (L.name || L.type) + '<' + (L.parent && (L.parent.name || L.parent.type)) + (w ? ' ' + w : !L.layers.test(cam.layers) ? ' layers ' + L.layers.mask : x ? '' : ' off-scene'); });
            LH.log.push([Math.round(performance.now()), sc.name || 'scene#' + sc.id, (cam.name || cam.type), cam.layers.mask, (R.getRenderTarget() ? 'rt' : 'screen'), k, why.join(' | '),
              (new Error().stack || '').split('\\n').slice(2, 6).map(l => l.trim().replace(/^at /, '').replace(/\\(.*\\/([^/]+:\\d+):\\d+\\)$/, '($1)')).join(' < ')]); } }
      }
    } catch (e) {}
    return orig.apply(this, arguments);
  };
  R.__lh = 1; return 1; })()`;
// BOOT-PROGRAMS (A0 9 Nov; BOOT-PROGRAMS-2026-11-03: ~90 links a nav of a source the same load already linked, same context,
// the first program still live = three keyed one source twice): per source linked more than once in a load, the cacheKeys of
// its programs (renderer.info.programs: the GL program -> three's WebGLProgram), cut to the part that differs
const CKR = `JSON.stringify((() => { var R = window.FLIGHT_PROBE && FLIGHT_PROBE.renderer ? FLIGHT_PROBE.renderer() : null, L = (R && R.info && R.info.programs) || [], M = new Map();
  for (var i = 0; i < L.length; i++) M.set(L[i].program, L[i]);
  // who owns a program: the materials of the world and the shed (renderer.properties' programs), the first object met
  var W = new Map(), root = function (o) { while (o && o.parent) o = o.parent; return o; }, P0 = window.FLIGHT_PROBE || {}, roots = [];
  try { if (P0.craft && P0.craft()) roots.push(root(P0.craft())); } catch (e) {} try { if (P0.hangarScene && P0.hangarScene()) roots.push(P0.hangarScene()); } catch (e) {}
  roots.forEach(function (sc) { if (sc) sc.traverse(function (o) { if (!o.material) return; (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { if (!m || !R) return; var pp = R.properties.get(m).programs; if (!pp) return;
    pp.forEach(function (pg) { if (pg && pg.program && !W.has(pg.program)) W.set(pg.program, { np: pp.size, mt: m.type, mn: m.name || '', ob: (o.name || o.type || '').slice(0, 40), lights: !!m.lights, gf: !!m.groundFamily, hook: m.onBeforeCompile !== Object.getPrototypeOf(m).onBeforeCompile, def: Object.keys(m.defines || {}).slice(0, 6).join(' '), uni: Object.keys(m.uniforms || {}).slice(0, 8).join(' ') }); }); }); }); });
  var by = new Map(); for (var j = 0; j < __CL.ln.length; j++) { var k = __CL.ln[j][1] + __CL.ln[j][2], a = by.get(k); if (!a) by.set(k, a = []); a.push(j); }
  var cut = function (a, b) { var p = 0; while (p < a.length && p < b.length && a[p] === b[p]) p++; var q = 0; while (q < a.length - p && q < b.length - p && a[a.length - 1 - q] === b[b.length - 1 - q]) q++; return [p, a.slice(Math.max(0, p - 60), a.length - q).slice(0, 400), b.slice(Math.max(0, p - 60), b.length - q).slice(0, 400)]; };
  var out = []; by.forEach(function (ix, k) { if (ix.length < 2) return; var P = ix.map(function (j) { return M.get(__CL.gp[j]) || null; }), f = P.find(function (x) { return x; });
    out.push({ who: ix.map(function (j) { return W.get(__CL.gp[j]) || null; }), k: k, n: ix.length, t: ix.map(function (j) { return Math.round(__CL.ln[j][0]); }), live: P.map(function (x) { return !!x; }), name: f ? f.name : null,
      d: f ? P.filter(function (x) { return x && x !== f; }).map(function (x) { return cut(String(f.cacheKey), String(x.cacheKey)); }) : [] }); });
  return { programs: L.length, renderer: !!R, dups: out, own: __CL.gp.map(function (p) { var w = W.get(p); return w ? w.mt + '/' + (w.mn || w.ob) + (w.gf ? ' GROUND' : '') + (w.np > 1 ? ' [' + w.np + ' programs: re-keyed]' : '') : null; }) }; })())`;
// the burst: links per second over the load (the most in any 1 s, and the 5 s bins)
const burst = rows => { const t = rows.map(r => r.t0).sort((a, b) => a - b); let mx = 0; for (let i = 0, j = 0; i < t.length; i++) { while (t[i] - t[j] > 1000) j++; mx = Math.max(mx, i - j + 1); }
  const bins = {}; for (const x of t) { const k = Math.floor(x / 5000) * 5; bins[k] = (bins[k] || 0) + 1; } return { max1s: mx, bins5s: bins }; };
const hists = async b => { const o = []; for (const q of HIST) { const x = await b.cmd('Browser.getHistograms', { query: q }).catch(e => ({ err: String(e) }));
  for (const h of ((x.result && x.result.histograms) || [])) if (!o.find(e => e.name === h.name)) o.push({ name: h.name, count: h.count, sum: h.sum, buckets: (h.buckets || []).map(k => [k.low, k.high, k.count]) }); } return o; };
if (!PORT) { console.error('cessna_links: --port is required'); process.exit(2); }

// the source recorder, after master_bench's (its linkProgram wrapper times; this one hashes)
const HASH = `(function(){ if (window.__CL) return; var C = window.__CL = { ln: [], src: {}, cx: [], gp: [] }, CX = new WeakMap();
  var h = function (s) { var a = 0x811c9dc5 >>> 0; for (var i = 0; i < s.length; i++) { a ^= s.charCodeAt(i); a = Math.imul(a, 16777619) >>> 0; } return ('0000000' + a.toString(16)).slice(-8); };
  var SH = new WeakMap(), PR = new WeakMap(), P = WebGL2RenderingContext.prototype, cs = P.createShader, ss = P.shaderSource, at = P.attachShader, lp = P.linkProgram;
  P.createShader = function (t) { var s = cs.call(this, t); if (s) SH.set(s, { t: t, src: '' }); return s; };
  P.shaderSource = function (s, src) { var r = SH.get(s); if (r) r.src = src; return ss.call(this, s, src); };
  P.attachShader = function (p, s) { var a = PR.get(p); if (!a) PR.set(p, a = []); a.push(s); return at.call(this, p, s); };
  P.linkProgram = function (p) { var vs = '', fs = ''; (PR.get(p) || []).forEach(function (s) { var r = SH.get(s); if (r) { if (r.t === 0x8B31) vs = r.src; else fs = r.src; } });
    var hv = h(vs), hf = h(fs); C.src[hv] = vs; C.src[hf] = fs; var cx = CX.get(this); if (cx == null) { CX.set(this, cx = C.cx.length); var a = this.getContextAttributes() || {}; C.cx.push({ aa: a.antialias, alpha: a.alpha, depth: a.depth, stencil: a.stencil, pdb: a.preserveDrawingBuffer, pp: a.powerPreference, w: this.drawingBufferWidth, h: this.drawingBufferHeight, ext: (this.getSupportedExtensions() || []).length, t: Math.round(performance.now()) }); } C.ln.push([performance.now(), hv, hf, cx]); C.gp.push(p); return lp.apply(this, arguments); };
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
    // G2060 (METLA-COOK): a load may carry its page query - 'cub@town=0', 'cub@town=1' (the town's first visit on a profile)
    const key = LOADS[li], [bk, qs] = key.split('@'), B = MB.BUILDS[bk];
    const b = ONE ? (b1 = b1 || await MB.browser(UDD)) : await MB.browser(UDD);
    const l = await b.load(BASE + (qs ? '?' + qs : ''), MB.preScript(B.build, null, B.patch) + '\n' + HASH);
    if (LIGHTS) console.log('  lights hook: ' + await b.ev(LIGHTS_HOOK).catch(e => 'failed ' + e.message));
    await sleep(3000);   // the garage's own links settle
    // --settle N (WARM-CACHE, 10 Nov): before the reading, wait until no program is still linking (renderer.info.programs, isReady), up to
    // 120 s, then N s more - the last links' binaries reach Chrome's program cache before the browser closes (MB_CLOSE_WAIT: the close's wait)
    if (SETTLE >= 0) { const w0 = Date.now(); for (; Date.now() - w0 < 120000; await sleep(500)) { const n = +(await b.ev('(() => { const r = window.FLIGHT_PROBE && FLIGHT_PROBE.renderer && FLIGHT_PROBE.renderer(); const L = r && r.info && r.info.programs; let n = 0; if (L) for (const p of L) if (p && p.isReady && !p.isReady()) n++; return n; })()', 30000)); if (!(n > 0)) break; }
      console.log('  settle: links done after ' + ((Date.now() - w0) / 1000).toFixed(1) + ' s, +' + SETTLE + ' s'); await sleep(SETTLE * 1000); }
    const tG = await b.ev('performance.now()');
    let fly = null, frm = null;
    const hangs = [];   // [s after the press, s unanswered] - the roll-out polls the page did not answer in 30 s
    if (FLY) { const n0 = await b.ev(MB.A.trips), w0 = Date.now(), tR = await b.ev('performance.now()'); await b.ev(MB.A.rollOut);
      // (10 Nov A/B: a 30 s eval timeout here killed 3 loads of 8 - the page did not answer: counted as a hang, the poll goes on)
      for (const tEnd = Date.now() + 300000; Date.now() < tEnd; await sleep(200)) { const t0h = Date.now(), raw = await b.ev(MB.A.lastTrip, 30000).catch(() => "__timeout"); if (raw === "__timeout") { hangs.push([Math.round((t0h - w0) / 1000), Math.round((Date.now() - t0h) / 1000)]); continue; } const d = JSON.parse(raw); if (d.n > n0 && d.kind === 'rollout' && d.done && d.boot === 'gone') break; }
      fly = +((Date.now() - w0) / 1000).toFixed(1); const tD = await b.ev('performance.now()'); await sleep(2500); await b.ev(MB.A.run).catch(() => 0); { const cs = CAM.split(','); for (const c of cs) { await b.ev(MB.A.cam(c)).catch(() => 0); await sleep(FLY_SEC * 1000 / cs.length); } }
      // (BOOT-PROGRAMS A/B) the frames: the roll-out's (press -> done) and the first flight's 17.5 s, over 100 ms and the worst
      const fr = JSON.parse(await b.ev('JSON.stringify((window.__MB && __MB.fr || []).map(e => [e[0], e[1]]))', 30000).catch(() => '[]') || '[]');
      const part = (a, z) => { const d = fr.filter(e => e[0] > a && e[0] <= z && e[1] > 0).map(e => e[1]).sort((x, y) => x - y); return { n: d.length, over100: d.filter(x => x > 100).length, over250: d.filter(x => x > 250).length, p99: d.length ? d[Math.min(d.length - 1, Math.floor(d.length * 0.99))] : null, worst: d.length ? d[d.length - 1] : null }; };
      frm = { rollout: part(tR, tD), flight: part(tD, tD + 1e9), tD: Math.round(tD), hangs, slow: fr.filter(e => e[0] > tD && e[1] > 250).map(e => [Math.round((e[0] - tD) / 100) / 10, Math.round(e[1])]) }; }
    // master_bench's ln rows [t0, ms] and ours [t0, hv, hf] were pushed in the same call: zip by order
    let dRaw = "__timeout"; for (let k = 0; k < 4 && dRaw === "__timeout"; k++) dRaw = await b.ev('JSON.stringify({ t: (__MB.ln || []).map(e => [Math.round(e[0]), Math.round(e[1])]), h: __CL.ln.map(e => [e[1], e[2], e[3]]), cx: __CL.cx })', 30000).catch(() => "__timeout");
    if (dRaw === "__timeout") throw new Error("the page did not answer the link read in 4 x 30 s");
    const d = JSON.parse(dRaw);
    const all = d.t.map((t, i) => ({ t0: t[0], ms: t[1], k: d.h[i] ? d.h[i][0] + d.h[i][1] : '?', vs: d.h[i] && d.h[i][0], fs: d.h[i] && d.h[i][1] }));
    all.forEach((r, i) => r.cx = d.h[i] && d.h[i][2]);
    const rows = all.filter(r => r.t0 <= tG), flown = all.filter(r => r.t0 > tG);
    const slow = rows.filter(r => r.ms > SLOW);
    const cls = r => seen.has(r.k) ? 'seen@' + seen.get(r.k) : 'NEW';
    const row = { i: li, build: key, sec: l.sec, state: l.state, rollout: fly, frames: frm, flownLinks: flown.length, flownNew: flown.filter(r => !seen.has(r.k)).length, links: rows.length, distinct: new Set(rows.map(r => r.k)).size,
      newPrograms: rows.filter(r => !seen.has(r.k)).length, over1s: rows.filter(r => r.ms > 1000).length, over5s: rows.filter(r => r.ms > 5000).length,
      slow: slow.map(r => ({ t0: r.t0, ms: r.ms, k: r.k, was: cls(r), j: all.indexOf(r) })), keys: rows.map(r => r.k + ':' + r.ms + ':' + r.cx), contexts: d.cx, hist: await hists(b), burst: burst(all), ck: CK ? JSON.parse(await b.ev(CKR, 60000)) : null, cache: MB.cacheMB(UDD), exc: b.exc.slice(0, 5) };
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
      + ' >1s ' + row.over1s + ' >5s ' + row.over5s + (FLY ? ' | roll-out ' + fly + ' s, flown links ' + row.flownLinks + ' new ' + row.flownNew + (frm ? ' | frames roll-out ' + JSON.stringify(frm.rollout) + ' flight ' + JSON.stringify(frm.flight) : '') : '') + ' GPU cache ' + row.cache.gpuCache + ' MB' + (row.exc.length ? ' EXC ' + row.exc[0] : ''));
    if (row.ck) { const d = row.ck.dups, extra = d.reduce((a, e) => a + e.n - 1, 0), g = new Map();
      for (const e of d) for (const x of e.d) { const w = (e.who || []).find(Boolean), sig = (w ? w.mt + '/' + (w.mn || w.ob) + (w.lights ? ' LIT' : '') + (w.hook ? ' hook' : '') + ' {' + w.uni.slice(0, 50) + '}' : (e.name || '?')) + ' || ' + x[1].slice(-120) + ' || ' + x[2].slice(-120); g.set(sig, (g.get(sig) || 0) + 1); }
      console.log('  dups: ' + d.length + ' sources linked more than once, ' + extra + ' extra links; renderer ' + row.ck.renderer + ', programs live ' + row.ck.programs + '; dead first programs ' + d.filter(e => !e.live[0]).length);
      [...g].sort((a, b) => b[1] - a[1]).slice(0, 30).forEach(([k, n]) => console.log('    ' + String(n).padStart(3) + 'x  ' + k)); }
    console.log('  burst: most links in 1 s ' + row.burst.max1s + '; per 5 s ' + JSON.stringify(row.burst.bins5s));
    if (row.ck && row.ck.own) for (const s of row.slow) s.own = row.ck.own[s.j] || null;
    if (frm) { const after = all.map((r, j) => [r, j]).filter(([r]) => r.t0 > frm.tD - 2000);
      row.flown = after.map(([r, j]) => ({ t: +((r.t0 - frm.tD) / 1000).toFixed(1), ms: r.ms, k: r.k, own: row.ck && row.ck.own ? row.ck.own[j] : null }));
      console.log('  after the reveal: ' + row.flown.length + ' links; frames > 250 ms (s after, ms): ' + JSON.stringify(frm.slow) + (frm.hangs.length ? '; roll-out HANGS (s after the press, s unanswered): ' + JSON.stringify(frm.hangs) : ''));
      if (LIGHTS) { row.lights = JSON.parse(await b.ev('JSON.stringify(window.__LH ? __LH.log : [])', 30000).catch(() => '[]') || '[]');
        console.log('  light counts (dir,point,spot) per scene, each change: ' + row.lights.length + (row.lights.length >= 600 ? ' (capped)' : ''));
        for (const e of row.lights) console.log('    ' + ((e[0] - frm.tD) / 1000).toFixed(1).padStart(7) + ' s  ' + e[1] + '  ' + e[2] + ' mask ' + e[3] + ' ' + e[4] + '  ' + e[5] + (e[6] ? '  off: ' + e[6] : '') + '  @ ' + e[7]); }
      for (const x of row.flown) console.log('    +' + x.t + ' s  link ' + (x.ms / 1000).toFixed(1) + ' s  ' + x.k + '  ' + (x.own || '?')); }
    for (const s of row.slow) console.log('    ' + String(s.t0).padStart(6) + ' ms  link ' + (s.ms / 1000).toFixed(1) + ' s  ' + s.k + '  ' + s.was + (s.own ? '  ' + s.own : ''));
    if (!ONE) await b.close();
  }
  if (b1) await b1.close();
  delete R.__src;
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
  try { srv.kill(); require('child_process').execSync('taskkill /PID ' + srv.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {}
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
