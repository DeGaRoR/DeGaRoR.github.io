#!/usr/bin/env node
// gl_census.js - WHAT A STEADY FRAME ASKS OF WEBGL, IN CHROME (C4b, 2026-10-01): the hybrid's cockpit costs ~+0.6 ms of
// render over master with the node census all-equal - so count it where it is paid. Drives a page kept up by
// tools/live_driver.js: rolls the build out, holds the flight (the world still, the frames still drawn), sets the view
// (VIEW=cockpit | chase), lets SETTLE s pass, then over FRAMES frames:
//   1. untouched: each frame's time (rAF to rAF) and, where EXT_disjoint_timer_query_webgl2 is offered, its GPU time
//      (one TIME_ELAPSED query from one rAF to the next) - PROF=1 also takes a CPU profile of this stretch (<out>.cpuprofile);
//   2. then every WebGL2 call counted by name, and every draw by three's program (draws, vertices x instances) - the
//      calls a frame, which a second tree's census is diffed against.
// Usage: node tools/gl_census.js <cmdPort> <out.json> [frames=300]      (a GPU measurement: take the GPU lock first)
//        node tools/gl_census.js --diff <a.json> <b.json>                 (the per-frame differences, b - a)
'use strict';
const fs = require('fs'), path = require('path');
if (process.argv[2] === '--diff') {
  const A = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')), B = JSON.parse(fs.readFileSync(process.argv[4], 'utf8'));
  const f = x => (x == null ? '-' : (+x).toFixed(2));
  console.log('frame ms   a ' + f(A.frameMs) + '  b ' + f(B.frameMs) + '   GPU ms  a ' + f(A.gpuMs) + '  b ' + f(B.gpuMs) + ' (n ' + A.gpuN + ' / ' + B.gpuN + ')');
  const diff = (a, b, what, fmt) => {
    const ks = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]), rows = [];
    for (const k of ks) { const x = fmt((a || {})[k]), y = fmt((b || {})[k]); if (Math.abs(y - x) > 0.05) rows.push([k, x, y]); }
    rows.sort((p, q) => Math.abs(q[2] - q[1]) - Math.abs(p[2] - p[1]));
    console.log(what + ': ' + rows.length + ' differ');
    for (const [k, x, y] of rows.slice(0, 40)) console.log('  ' + (y - x >= 0 ? '+' : '') + (y - x).toFixed(2).padStart(9) + '  ' + x.toFixed(2).padStart(9) + ' -> ' + y.toFixed(2).padStart(9) + '  ' + k);
  };
  diff(A.calls, B.calls, 'WebGL calls a frame', v => v || 0);
  diff(A.programs, B.programs, 'draws a frame by program', v => (v ? v.draws : 0));
  diff(A.programs, B.programs, 'vertices a frame by program (k)', v => (v ? v.verts / 1000 : 0));
  process.exit(0);
}
const PORT = +(process.argv[2] || 8642), OUT = path.resolve(process.argv[3] || 'gl_census.json'), FRAMES = +(process.argv[4] || 300);
const VIEW = process.env.VIEW || 'cockpit', SETTLE = +(process.env.SETTLE || 20);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async (p, body) => { const r = await fetch('http://127.0.0.1:' + PORT + p, { method: 'POST', body }); return r.text(); };
const run = async body => { const t = await post('/run', body); try { return JSON.parse(t); } catch (e) { return t; } };
const until = async (cond, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await run('return !!(' + cond + ');')) === true) return true; await sleep(500); } throw new Error('timed out: ' + what); };
(async () => {
  await until(`window.BOOT && BOOT.state === 'gone'`, 600000, 'the garage boot');
  await sleep(1500);
  await run(`document.getElementById('bGo').click(); return 1;`);
  await until(`window.BOOT && BOOT.state === 'gone' && /Fly the circuit/.test((document.getElementById('bGo') || {}).textContent || '') && window.FLIGHT_PROBE && FLIGHT_PROBE.model()`, 900000, 'the roll-out');
  await sleep(2000);
  if (!(await run('return !!window.FLYDIY_HELD;'))) await run(`document.getElementById('bPause').click(); return 1;`);
  await run(`FLIGHT_PROBE.camMode(${JSON.stringify(VIEW)}); return 1;`);
  await sleep(SETTLE * 1000);
  if (process.env.PROF) await fetch('http://127.0.0.1:' + PORT + '/prof?op=start');
  const timed = await run(`
    const gl = FLIGHT_PROBE.renderer().getContext(), X = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    const N = ${FRAMES}, ft = [], gpu = [], open = [];
    await new Promise(r => {
      let i = 0, last = performance.now(), q = null;
      const f = now => {
        if (X && q) { gl.endQuery(X.TIME_ELAPSED_EXT); open.push(q); q = null; }
        for (let k = open.length - 1; k >= 0; k--) { const o = open[k];
          if (gl.getQueryParameter(o, gl.QUERY_RESULT_AVAILABLE)) { if (!gl.getParameter(X.GPU_DISJOINT_EXT)) gpu.push(gl.getQueryParameter(o, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(o); open.splice(k, 1); } }
        if (i) ft.push(now - last); last = now;
        if (++i > N) return r();
        if (X) { q = gl.createQuery(); gl.beginQuery(X.TIME_ELAPSED_EXT, q); }
        requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    });
    const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
    return { timer: !!X, frameMs: med(ft), gpuMs: med(gpu), gpuN: gpu.length, gpuMean: gpu.length ? gpu.reduce((s, v) => s + v, 0) / gpu.length : null };`);
  if (process.env.PROF) await fetch('http://127.0.0.1:' + PORT + '/prof?op=stop&f=' + encodeURIComponent(OUT.replace(/\.json$/, '') + '.cpuprofile'));
  const counted = await run(`
    const R = FLIGHT_PROBE.renderer(), byGl = new Map();
    const name = p => { let pr = byGl.get(p); if (!pr) { for (const x of R.info.programs) byGl.set(x.program, x); pr = byGl.get(p); } return pr ? pr.name + ' #' + pr.id : '?'; };
    const Pr = WebGL2RenderingContext.prototype, calls = {}, progs = {}, orig = {}; let cur = null;
    for (const fn of Object.getOwnPropertyNames(Pr)) {
      let f; try { f = Pr[fn]; } catch (e) { continue; }
      if (typeof f !== 'function' || fn === 'constructor') continue;
      orig[fn] = f;
      Pr[fn] = function () { calls[fn] = (calls[fn] || 0) + 1;
        if (fn === 'useProgram') cur = arguments[0];
        else if (fn.startsWith('draw')) { const k = name(cur), p = progs[k] || (progs[k] = { draws: 0, verts: 0 });
          const n = fn === 'drawElements' || fn === 'drawArrays' ? arguments[fn === 'drawArrays' ? 2 : 1] : fn === 'drawRangeElements' ? arguments[3] : arguments[fn === 'drawArraysInstanced' ? 2 : 1] * (arguments[fn === 'drawArraysInstanced' ? 3 : 4] || 1);
          p.draws++; p.verts += n || 0; }
        return f.apply(this, arguments); };
    }
    const N = ${FRAMES};
    await new Promise(r => { let i = 0; const f = () => (++i > N ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
    for (const fn in orig) Pr[fn] = orig[fn];
    for (const k in calls) calls[k] = +(calls[k] / N).toFixed(3);
    for (const k in progs) { progs[k].draws = +(progs[k].draws / N).toFixed(3); progs[k].verts = Math.round(progs[k].verts / N); }
    const FB = window.FLOWN_BAKE && FLOWN_BAKE.FB;
    // the graph the frame walks (updateMatrixWorld, the render's projection, a pick's raycast): the scene's objects and
    // the aeroplane's, all and visible, and the aeroplane's visible meshes by name
    const graph = {}; try {
      const g = (root, k) => { let all = 0, vis = 0, mesh = 0; root.traverse(() => all++); root.traverseVisible(o => { vis++; if (o.isMesh) mesh++; }); graph[k] = { all, vis, mesh }; };
      g(WORLD.scene, 'scene'); const M = FLIGHT_PROBE.model(); const root = M && (M.isObject3D ? M : M.group || M.root);
      if (root && root.isObject3D) { g(root, 'craft'); const by = {}; root.traverseVisible(o => { if (o.isMesh) { const k = (o.name || o.type).replace(/[\d_.:-]+$/, ''); by[k] = (by[k] || 0) + 1; } });
        graph.craftMeshes = Object.fromEntries(Object.entries(by).sort((x, y) => y[1] - x[1]).slice(0, 40)); }
    } catch (e) { graph.err = String(e); }
    return { graph, calls, programs: progs, info: { calls: R.info.render.calls, triangles: R.info.render.triangles, programs: R.info.programs.length, geometries: R.info.memory.geometries, textures: R.info.memory.textures },
      hyT: FB ? FB.hyT : null, warm: window.__hyWarm ? { n: window.__hyWarm.n, drawn: window.__hyWarm.drawn } : null, url: location.href };`);
  const out = Object.assign({ view: VIEW, frames: FRAMES }, timed, counted);
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  const tot = Object.values(out.calls || {}).reduce((s, v) => s + v, 0), draws = Object.values(out.programs || {}).reduce((s, v) => s + v.draws, 0);
  console.log(JSON.stringify({ view: VIEW, frameMs: out.frameMs, gpuMs: out.gpuMs, gpuMean: out.gpuMean, gpuN: out.gpuN, glCalls: +tot.toFixed(1), draws: +draws.toFixed(1), info: out.info, graph: out.graph && { scene: out.graph.scene, craft: out.graph.craft, err: out.graph.err }, hyT: out.hyT, warm: out.warm }));
})().catch(e => { console.error('gl_census: ' + (e && e.stack || e)); process.exit(1); });
