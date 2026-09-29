// _sheyes_movers.js - SHADOW-EYES (G1080): an in-page census (live_driver POST /eval @file) of every caster the FAR map
// draws (castShadow, visible, FAR_LAYER, instanced or not) that MOVED between two instants half a second apart while the
// aeroplane moves - whatever its bounding sphere claims (a skinned mesh's sphere can sit at its bind pose). The user's A/B
// (2026-09-29): only drawing the far map every frame changed the soft trailing shadow, yet no aeroplane mesh is on
// FAR_LAYER by the craft's sphere - so: what in the far map moves with the aeroplane?
(async () => {
  const SN = SHADOW_NEAR, sc = WORLD.scene, T = THREE;
  const pathOf = o => { const a = []; for (let p = o; p && p !== sc; p = p.parent) a.push(p.name || p.type); return a.reverse().join('/'); };
  const casters = [];
  sc.traverse(o => {
    if (!(o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.isBatchedMesh || o.isPoints || o.isLine) || !o.castShadow || !o.layers.isEnabled(SN.FAR_LAYER)) return;
    let vis = true; for (let p = o; p; p = p.parent) if (!p.visible) { vis = false; break; }
    if (vis) casters.push(o);
  });
  const sig = o => {
    const e = o.matrixWorld.elements, a = [e[12], e[13], e[14]];
    if (o.isSkinnedMesh && o.skeleton) { const b = o.skeleton.bones[0]; if (b) { const f = b.matrixWorld.elements; a.push(f[12], f[13], f[14]); } }
    if (o.isInstancedMesh && o.count) { const f = o.instanceMatrix.array; a.push(f[12], f[13], f[14], o.instanceMatrix.version); }
    return a;
  };
  const P0 = SN.drawnPoint(), s0 = casters.map(sig);
  await new Promise(r => setTimeout(r, 500));
  const P1 = SN.drawnPoint(), s1 = casters.map(sig);
  const moved = [];
  casters.forEach((o, i) => { const a = s0[i], b = s1[i]; let d = 0; for (let k = 0; k < Math.min(a.length, b.length); k++) d = Math.max(d, Math.abs(a[k] - b[k])); if (d > 1e-4) moved.push({ path: pathOf(o), type: o.type, d: +d.toFixed(3), skinned: !!o.isSkinnedMesh, inst: !!o.isInstancedMesh, fc: o.frustumCulled }); });
  return JSON.stringify({ craftMoved: P0 && P1 ? +Math.hypot(P1[0] - P0[0], P1[2] - P0[2]).toFixed(2) : null, casters: casters.length, moved: moved.slice(0, 60), nMoved: moved.length });
})()
