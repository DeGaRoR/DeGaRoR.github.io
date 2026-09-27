// debris_eval.js - NOTHING LOOSE ON A PAVEMENT, counted (A6-GROUND G1003), for rollout_perf's --eval:
//   node tools/rollout_perf.js --secs 30 --eval @tools/debris_eval.js
// One expression. Every instance of every loose-thing mesh in the scene - the strips' band stones (rocks:*), the cover
// ring's rocks / debris / shrubs (cover:*), the scenery life's pieces (life:*) - at its world position, asked whether it
// lies ON a pavement: the premises' pavedAt (a strip, a road, a paved polygon: d > 0) or a PAVED surface polygon
// (surfaceAt 5, the editor's aprons). The same test on master and on the branch (pavedNear is the branch's). Returns
// the counts per mesh group and per pavement kind, and the first few positions. Read-only.
(async () => {
  const W = window.WORLD, sc = W.scene, world = window.FLIGHT_PROBE.world(), PO = world.premises && world.premises.overlay;
  if (!PO) return { err: 'no premises overlay' };
  const M = new THREE.Matrix4(), V = new THREE.Vector3();
  const out = {}, where = [];
  let total = 0;
  const test = (x, z) => { const q = PO.pavedAt(x, z); if (q) return q.kind + ':' + q.cls; return PO.surfaceAt && PO.surfaceAt(x, z) === 5 ? 'surface:paved' : null; };
  sc.traverse(o => {
    const n = o.name || '';
    if (!/^(rocks:|cover:|life:)/.test(n)) return;
    const grp = n.replace(/^(rocks):.*$/, '$1').replace(/^(life):(pieces).*/, '$1:$2');
    const count = o.isInstancedMesh ? o.count : o.isBatchedMesh ? (o._instanceInfo ? o._instanceInfo.length : 0) : 0;
    if (!count) return;
    o.updateWorldMatrix(true, false);
    for (let i = 0; i < count; i++) {
      if (o.isBatchedMesh && o.getVisibleAt && !o.getVisibleAt(i)) continue;
      try { o.getMatrixAt(i, M); } catch (e) { continue; }
      V.setFromMatrixPosition(M).applyMatrix4(o.matrixWorld);
      total++;
      const t = test(V.x, V.z);
      const G = out[grp] = out[grp] || { n: 0, on: 0, by: {} };
      G.n++;
      if (t) { G.on++; G.by[t] = (G.by[t] || 0) + 1; if (where.length < 24) where.push([grp, t, +V.x.toFixed(1), +V.z.toFixed(1)]); }
    }
  });
  return { total, groups: out, first: where };
})()
