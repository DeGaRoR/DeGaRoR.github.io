// cowl_study/clear.js - how far the drawn engine stands through the drawn cowl (PROPER-COWLS): every engine vertex
// (spinner and blades aside) against the cowl's own surface on the same ray from the axis, in the cowl's frame.
//   const C = require('./clear.js'); C.clearance(sceneBuildResult) -> { n, worst, at: {z, y, x}, over: [..] }
'use strict';
function clearance(S, THREE) {
  const W = S.W, CW = W.COWL_GEN;
  let eng = null, cowl = null;
  S.scene.traverse(o => { if (o.name === 'cageLayer:eng') eng = o; if (o.name === 'cageLayer:cowl') cowl = o; });
  if (!eng || !cowl) return null;
  eng.updateMatrixWorld(true); cowl.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(cowl.matrixWorld).invert();
  const ze = CW.zEnd(), v = new THREE.Vector3();
  const N = 360, cache = new Map();
  const ring = z => {                         // the surface's polar outline at station z, about the spine
    const k = Math.round(z * 200);
    if (cache.has(k)) return cache.get(k);
    const zz = k / 200, cy = CW.spineY(zz), r = new Float32Array(N);
    for (let i = 0; i < 720; i++) {
      const p = CW.surfPoint(i / 720 * 2 * Math.PI, zz);
      const a = Math.atan2(p[1] - cy, p[0]), j = ((Math.round(a / (2 * Math.PI) * N) % N) + N) % N;
      r[j] = Math.max(r[j], Math.hypot(p[0], p[1] - cy));
    }
    // an angular bin no sample landed in reads 0: take the nearer filled neighbours' (the outline is continuous)
    for (let pass = 0; pass < 3; pass++) for (let j = 0; j < N; j++) if (!r[j]) {
      let a = 0, b = 0;
      for (let d = 1; d < 12 && !a; d++) a = r[(j - d + N) % N];
      for (let d = 1; d < 12 && !b; d++) b = r[(j + d) % N];
      r[j] = Math.min(a || b, b || a);
    }
    cache.set(k, r); return r;
  };
  let worst = 0, at = null, n = 0; const pts = [];
  eng.traverse(o => {
    if (!o.isMesh || /spin|prop|shaft/i.test(o.name)) return;
    const pa = o.geometry.attributes.position;
    for (let i = 0; i < pa.count; i += 2) {
      v.fromBufferAttribute(pa, i); o.localToWorld(v); v.applyMatrix4(inv);
      if (v.z < 0.01 || v.z > ze - 0.01) continue;
      // the HEADS' band: the flanks, about the axis (the exhaust stubs leaving under the cowl and the mount are not it)
      if (Math.abs(v.x) < 0.6 * CW.P.aftW || Math.abs(v.y - CW.spineY(v.z)) > 0.5 * CW.P.aftH) continue;
      const cy = CW.spineY(v.z), a = Math.atan2(v.y - cy, v.x), j = ((Math.round(a / (2 * Math.PI) * N) % N) + N) % N;
      const d = Math.hypot(v.x, v.y - cy) - ring(v.z)[j];
      if (d > 0) { n++; pts.push([v.x, v.y, v.z, d]); if (d > worst) { worst = d; at = { x: +v.x.toFixed(3), y: +v.y.toFixed(3), z: +v.z.toFixed(3) }; } }
    }
  });
  return { n, worst: +worst.toFixed(4), at, pts };
}
module.exports = { clearance };
