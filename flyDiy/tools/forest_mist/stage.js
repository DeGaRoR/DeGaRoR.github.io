// FOREST-MIST stage for tools/soft_still.js (2026-11-09): a list of views x variants from one boot.
//   FM_OUT   output dir
//   FM_SHOTS JSON [{tag, eye:[x, agl|y, z], abs?, yaw (deg, 0 = -z, 90 = +x), pitch (deg), fov, day:{DAY_CLOCK.set}, pre:'js',
//                   vars:[{tag, js, frames}] }]
//   FM_VARS  default variants [{tag, js}]
// Each still is followed by its numbers (renderer.info over one frame, FMIST.stats, the day) in rows.json.
const fs = require('fs'), path = require('path');
module.exports = async (page, { frames, shot, log }) => {
  const OUT = process.env.FM_OUT; fs.mkdirSync(OUT, { recursive: true });
  const ev = s => page.evaluate(s);
  const SHOTS = JSON.parse(process.env.FM_SHOTS || '[]');
  const VARS = JSON.parse(process.env.FM_VARS || '[{"tag":"base","js":"1"}]');
  await ev("(()=>{const b=document.getElementById('bPause'); if (b && /pause/i.test(b.textContent)) b.click(); return 1;})()");
  const gpu = await ev(`(()=>{ try { const r = FLIGHT_PROBE.renderer(); const gl = r.getContext(); const x = gl.getExtension('WEBGL_debug_renderer_info'); return gl.getParameter(x ? x.UNMASKED_RENDERER_WEBGL : gl.RENDERER); } catch (e) { return String(e); } })()`);
  log('FM gpu', gpu);
  const rows = [];
  const count = () => ev(`new Promise(res => { const r = FLIGHT_PROBE.renderer(); r.info.autoReset = false; r.info.reset();
      requestAnimationFrame(() => requestAnimationFrame(() => { const o = { calls: r.info.render.calls, tris: r.info.render.triangles, programs: (r.info.programs || []).length };
      r.info.autoReset = true; res(JSON.stringify(o)); })); })`);
  for (const V of SHOTS) {
    if (V.day) { await ev(`(()=>{ DAY_CLOCK.set(${JSON.stringify(V.day)}); if (DAY_CLOCK.rate) DAY_CLOCK.rate(0); return 1; })()`); }
    if (V.pre) await ev(`(()=>{ ${V.pre}; return 1; })()`);
    const e = V.eye;
    await ev(`(()=>{ const W = FLIGHT_PROBE.world(); const gy = ${V.abs ? 0 : `Math.max(W.terrainH(${e[0]}, ${e[2]}), W.waterH ? W.waterH(${e[0]}, ${e[2]}) : -1e9)`};
      FLIGHT_PROBE.devFree(${e[0]}, gy + ${e[1]}, ${e[2]}, ${(V.yaw || 0) * Math.PI / 180}, ${(V.pitch || 0) * Math.PI / 180});
      ${V.fov ? 'const cam = typeof FLIGHT_PROBE.camera === "function" ? FLIGHT_PROBE.camera() : FLIGHT_PROBE.camera; cam.fov = ' + V.fov + '; cam.updateProjectionMatrix();' : ''} return 1; })()`);
    await frames(V.settle || 6);
    for (const X of (V.vars || VARS)) {
      await ev(`(()=>{ ${X.js}; return 1; })()`);
      await frames(X.frames || 4);
      const f = path.join(OUT, `${V.tag}_${X.tag}.jpg`);
      const A = await shot(f);
      let n = null; try { n = JSON.parse(await count()); } catch (err) { n = { err: String(err) }; }
      let st = null; try { st = JSON.parse(await ev(`JSON.stringify({ fm: window.FMIST ? FMIST.stats() : null, clouds: window.CLOUDS ? { active: CLOUDS.active, stats: CLOUDS.stats } : null,
        day: (() => { const d = DAY_CLOCK.day(); return { sunEl: d.sunEl, rh: d.rh, mistRho0: d.mistRho0, rain: d.rain, cover: d.cloudCoverEff, base: d.cloudBase }; })(),
        mist: window.ATMO ? { on: ATMO.MIST.on, relief: ATMO.MIST.relief, patch: ATMO.MIST.patch, rho0: ATMO.MIST.rho0 } : null })`)); } catch (err) { st = { err: String(err) }; }
      log('FM shot', V.tag, X.tag, JSON.stringify(n), JSON.stringify(st));
      rows.push({ view: V.tag, var: X.tag, file: path.basename(f), info: n, st, A });
      fs.writeFileSync(path.join(OUT, 'rows.json'), JSON.stringify({ gpu, rows }, null, 1));
      if (X.undo) await ev(`(()=>{ ${X.undo}; return 1; })()`);
    }
  }
  return { skipMain: true, n: rows.length };
};
