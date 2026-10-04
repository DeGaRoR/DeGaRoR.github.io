// metla_toggle_far.js - METLA-TAXI (G1435): metla_ab --toggle's snippet. At the middle of the taxi: every drawable of
// the premises whose world bounding sphere lies wholly past FAR m from the camera (Metlakatla is 9-10 km from HOME) is
// hidden - the frames' second half ('h1') against the first ('h0') is the far town's DRAW cost (its CPU ticks run on:
// a hidden object is skipped by the renderer, not by the premises' tick). Returns the census of what it hid.
(() => {
  const FAR = 4000;
  const W = window.FLIGHT_PROBE && FLIGHT_PROBE.world && FLIGHT_PROBE.world(), P = W && W.premises, cam = W && W.camera;
  if (!P || !P.root || !cam) return JSON.stringify({ err: 'no premises root / camera' });
  const c = cam.getWorldPosition(new cam.position.constructor()), S = new (cam.position.constructor)();
  const out = { far: FAR, hidden: 0, kept: 0, spanning: 0, byName: {}, big: [] };
  P.root.traverse(o => {
    if (!(o.isMesh || o.isPoints || o.isLine) || !o.visible || !o.geometry) return;
    const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); const bs = g.boundingSphere; if (!bs) return;
    S.copy(bs.center).applyMatrix4(o.matrixWorld); const sc = o.matrixWorld.getMaxScaleOnAxis(), r = bs.radius * sc, d = S.distanceTo(c);
    const tris = (g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0)) / 3 * (o.isInstancedMesh ? o.count : 1);
    const k = (o.isBatchedMesh ? 'B:' : o.isInstancedMesh ? 'I:' : '') + (o.name || (o.parent && o.parent.name) || '?');
    if (d - r > FAR) { o.visible = false; out.hidden++; const e = out.byName[k] = out.byName[k] || { n: 0, tris: 0, shadow: 0 }; e.n++; e.tris += Math.round(tris); if (o.castShadow) e.shadow++; }
    else { out.kept++; if (d + r > FAR) { out.spanning++; if (out.big.length < 12) out.big.push(k + ' d' + Math.round(d) + ' r' + Math.round(r) + ' tris ' + Math.round(tris)); } }
  });
  return JSON.stringify(out);
})()
