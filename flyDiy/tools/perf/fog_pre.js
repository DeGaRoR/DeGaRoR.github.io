// fog study probes (frame_perf --pre): every probe RESETS to base first, then applies its own state
window.__FOG = {
  quads: null,
  farQuads() { if (this.quads) return this.quads; const q = []; WORLD.scene.traverse(o => { if (o.isMesh && o.geometry && o.geometry.index && o.geometry.index.count > 3e5 && (o.geometry.boundingSphere || (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere)).radius > 3000) q.push(o); }); this.quads = q; return q; },
  reset() {
    ATMO.MIST.on = true; ATMO.MIST.k = 1;
    if (window.__setAP) { ATMO.setAP = window.__setAP; window.__setAP = null; } ATMO.setAP(true);
    WORLD.camera.far = 100000; WORLD.camera.updateProjectionMatrix();
    CLOUDS.S.maxKm = 60;
    for (const m of this.farQuads()) m.visible = true;
    if (window.TREE_LOD && this.lod0) TREE_LOD.set(this.lod0);
  },
  apOff() { window.__setAP = ATMO.setAP; ATMO.setAP = () => {}; ATMO.apUniforms.uAtmoAP.value[2] = 0; },
  far(m) { WORLD.camera.far = m; WORLD.camera.updateProjectionMatrix(); },
  quadsCull(m) { const e = WORLD.camera.position; for (const q of this.farQuads()) { const s = q.geometry.boundingSphere, c = s.center.clone().applyMatrix4(q.matrixWorld); q.visible = c.distanceTo(e) - s.radius < m; } },
  count() { return JSON.stringify({ quads: this.farQuads().length, visible: this.farQuads().filter(q => q.visible).length, tris: this.farQuads().map(q => q.geometry.index.count / 3 | 0) }); },
};
