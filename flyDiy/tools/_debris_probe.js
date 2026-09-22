// THE DEBRIS GATE'S INSTRUMENT (2026-09-22): every piece the COVER RING planted, bucketed by what
// coverAt says under it. The rocks the aerodrome's shoulder scatter plants (render_world standRocks,
// 7-30 cm pebbles in a band off the strip edge) share the coast scans' geometry, so they are counted
// apart - mistaking them for debris is what made the gate look broken.
window.DEBRIS_PROBE = () => {
  const M = new THREE.Matrix4(), V = new THREE.Vector3(), w = FLIGHT_PROBE.world();
  const mk = () => ({ onSurface: 0, band: 0, fade: 0, classNoKill: 0, clear: 0, n: 0 });
  const b = { debris: mk(), shoulder: mk() };
  const DEB = new Set([912, 1200, 900, 150]);
  WORLD.scene.traverse(o => {
    if (!o.isInstancedMesh || !o.count) return;
    const g = o.geometry, t = g.index ? g.index.count / 3 : 0;
    const shoulder = /^rocks:/.test(o.name || '');
    const isDeb = !shoulder && (DEB.has(t) || (t >= 1503 && t <= 2260));
    if (!isDeb && !shoulder) return;
    const bucket = shoulder ? b.shoulder : b.debris;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, M); V.setFromMatrixPosition(M);
      const c = w.coverAt(V.x, V.z); bucket.n++;
      if (!c) { bucket.clear++; continue; }
      const k = c.kill || 0;
      if (k >= 1) bucket.onSurface++;
      else if (c.cls && k >= 0.5) bucket.band++;
      else if (k > 0) bucket.fade++;
      else if (c.cls) bucket.classNoKill++;
      else bucket.clear++;
    }
  });
  return JSON.stringify(b);
};
