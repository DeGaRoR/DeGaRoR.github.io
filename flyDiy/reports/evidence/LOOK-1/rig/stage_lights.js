// LOOK-1-STUDY stage for tools/soft_still.js: one held night (or day) at the stand, a free eye on named conifers,
// and a list of variants (JS run in the page before each still). env:
//   L1_OUT   output dir            L1_DAY  JSON for DAY_CLOCK.set (default: 24 Dec 2026 03:00Z, full moon 22 deg, clear)
//   L1_KEYS  species prefixes      L1_VIEWS JSON [{key, d, h, side:'moon'|'away'|'side', fov, tag}]
//   L1_VARS  JSON [{tag, js, undo}] L1_BANDS JSON [l0,l1,near] (default far)
const fs = require('fs'), path = require('path');
module.exports = async (page, { frames, shot, log }) => {
  const OUT = process.env.L1_OUT;
  fs.mkdirSync(OUT, { recursive: true });
  const ev = s => page.evaluate(s);
  const DAY = process.env.L1_DAY || JSON.stringify({ date: '2026-12-24', utc: 3 * 3600, rate: 0, cloudCover: 0 });
  const BANDS = process.env.L1_BANDS || '[60,270,270]';
  const VIEWS = JSON.parse(process.env.L1_VIEWS || '[{"key":"cedar","d":28,"h":1.7,"side":"moon","tag":"near"},{"key":"cedar","d":180,"h":6,"side":"moon","tag":"far"}]');
  const VARS = JSON.parse(process.env.L1_VARS || '[{"tag":"base","js":"1"}]');
  await ev("(()=>{const b=document.getElementById('bPause'); if (b && /pause/i.test(b.textContent)) b.click(); return 1;})()");
  await ev(`(()=>{ DAY_CLOCK.set(${DAY}); if (DAY_CLOCK.rate) DAY_CLOCK.rate(0); return 1; })()`);
  await ev(`(()=>{ TREE_LOD.set(${BANDS}); return 1; })()`);
  await frames(6);
  const info = JSON.parse(await ev(`JSON.stringify((()=>{ const d = DAY_CLOCK.day(); const g = FLIGHT_PROBE.camGet();
    const r = FLIGHT_PROBE.renderer(); return { sunEl: d.sunEl, moonEl: d.moonEl, moon: d.moon, sun: d.sun, cg: g.target, ex: r.toneMappingExposure,
      gpu: (()=>{ try { const gl = r.getContext(); const x = gl.getExtension('WEBGL_debug_renderer_info'); return gl.getParameter(x ? x.UNMASKED_RENDERER_WEBGL : gl.RENDERER); } catch (e) { return null; } })(),
      bands: TREE_LOD.get(), lit: (window.WORLD && WORLD.treeLod && WORLD.treeLod.lit) ? WORLD.treeLod.lit.value : null }; })())`));
  log('L1 info', JSON.stringify(info));
  const rows = [];
  for (const V of VIEWS) {
    if (V.pre) { await ev(`(()=>{ ${V.pre}; return 1; })()`); await frames(V.preFrames || 8); }
    const pick = JSON.parse(await ev(`JSON.stringify((()=>{ const cg = FLIGHT_PROBE.camGet().target;
      const t = TREE_LOD.find('${V.key}', cg[0], cg[2], ${V.r0 || 15}, ${V.r1 || 600}, 40); const d = DAY_CLOCK.day();
      const L = '${V.light || (V.side === 'sun' ? 'sun' : 'moon')}' === 'sun' ? d.sun : d.moon; const lx = L[0], lz = L[2], ln = Math.hypot(lx, lz) || 1;
      const s = '${V.side || 'moon'}'; let ax = lx / ln, az = lz / ln;
      if (s === 'away') { ax = -ax; az = -az; } else if (s === 'side') { const q = ax; ax = -az; az = q; }
      for (const tr of t) { const ex = tr.x + ax * ${V.d}, ez = tr.z + az * ${V.d};
        const W = FLIGHT_PROBE.world(); const gy = W && W.terrainH ? W.terrainH(ex, ez) : null;
        return { tr, eye: [ex, ez], gy }; }
      return null; })())`));
    if (!pick) { log('L1 no tree for', V.key); continue; }
    const H = pick.tr.s * 20;   // a rough crown height; the aim is a third up
    const ey = (pick.gy != null ? pick.gy : pick.tr.y) + V.h;
    const ty = pick.tr.y + Math.min(8, H * 0.35);
    const fx = pick.tr.x - pick.eye[0], fz = pick.tr.z - pick.eye[1], fy = ty - ey;
    const yaw = Math.atan2(fx, -fz), pitch = V.pitch != null ? V.pitch * Math.PI / 180 : Math.atan2(fy, Math.hypot(fx, fz));
    await ev(`(()=>{ FLIGHT_PROBE.devFree(${pick.eye[0]}, ${ey}, ${pick.eye[1]}, ${yaw}, ${pitch}); ${V.fov ? 'FLIGHT_PROBE.camera.fov = ' + V.fov + '; FLIGHT_PROBE.camera.updateProjectionMatrix();' : ''} return 1; })()`);
    for (const X of (V.vars || VARS)) {
      await ev(`(()=>{ ${X.js}; return 1; })()`);
      await frames(X.frames || 4);
      const f = path.join(OUT, `${V.tag}_${X.tag}.jpg`);
      const A = await shot(f);
      const lights = JSON.parse(await ev(`JSON.stringify((()=>{ const o = { ex: FLIGHT_PROBE.renderer().toneMappingExposure, d: [], h: [], env: !!(WORLD.scene && WORLD.scene.environment) }; const sc = WORLD.scene;
        if (sc) sc.traverse(l => { if (l.isDirectionalLight && l.visible) o.d.push([+l.intensity.toFixed(5), l.color.toArray().map(v => +v.toFixed(3))]); if (l.isHemisphereLight && l.visible) o.h.push([+l.intensity.toFixed(5), l.color.toArray().map(v => +v.toFixed(3)), l.groundColor.toArray().map(v => +v.toFixed(3))]); });
        const d = DAY_CLOCK.day(); o.sunEl = d.sunEl; o.moonEl = d.moonEl; o.isMoon = !!(window.SKY_LIGHT && SKY_LIGHT.isMoon); return o; })())`) || 'null');
      log('L1 lights', X.tag, JSON.stringify(lights));
      rows.push({ view: V.tag, var: X.tag, file: path.basename(f), tree: pick.tr, eye: [pick.eye[0], ey, pick.eye[1]], A, lights });
      if (X.undo) await ev(`(()=>{ ${X.undo}; return 1; })()`);
    }
  }
  fs.writeFileSync(path.join(OUT, 'rows.json'), JSON.stringify({ info, rows }, null, 1));
  return { skipMain: true, info, n: rows.length };
};
