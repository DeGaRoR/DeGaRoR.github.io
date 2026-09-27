// pavement_census.js - the page-side census of the pavement and the strip stones (A2-RUNWAYS G663/G667,
// playtest 2026-09-26), for rollout_perf's --eval:  node tools/rollout_perf.js --eval @tools/pavement_census.js
// One expression. Read-only: counts the pavement meshes (strips, roads, paved polygons) and how many of them the
// camera's frustum holds now (three culls the rest since G663), the strip stones' meshes and casters, the
// ground patch's sunk vertices (G660), and the CPU time of renderer.render() over 30 frames.
(async () => {
  const W = window.WORLD, sc = W.scene, R = W.renderer, cam = W.camera || (W.cam && W.cam());
  const fr = new THREE.Frustum(), pm = new THREE.Matrix4();
  if (cam) { cam.updateMatrixWorld(); pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); fr.setFromProjectionMatrix(pm); }
  const pav = { strip: 0, road: 0, poly: 0, culled: 0, inView: 0, unculled: 0, order: [] }, rocks = { meshes: 0, casters: 0, instances: 0, castInst: 0 };
  let sunk = null;
  sc.traverse(o => {
    if (o.name === 'premises:patch' && o.userData && o.userData.sunk !== undefined) sunk = o.userData.sunk;
    if (!o.isMesh) return;
    const n = o.name || '';
    const k = /^pavement:/.test(n) ? 'strip' : /^road:/.test(n) && o.material && o.material.userData && o.material.userData.pav ? 'road' : /^pave:/.test(n) ? 'poly' : null;
    if (k) {
      pav[k]++;
      if (!o.frustumCulled) pav.unculled++;
      const g = o.geometry; if (g && !g.boundingSphere) g.computeBoundingSphere();
      const s = g && g.boundingSphere ? g.boundingSphere.clone().applyMatrix4(o.matrixWorld) : null;
      if (!o.frustumCulled || !cam || (s && fr.intersectsSphere(s))) pav.inView++; else pav.culled++;
      if (k === 'strip') pav.order.push(n + '@' + o.renderOrder.toFixed(4) + (o.material.uniforms && o.material.uniforms.uSide ? ' side ' + o.material.uniforms.uSide.value.x + ' keep ' + o.material.uniforms.uKeepN.value : ''));
    }
    if (/^rocks:/.test(n) && o.isInstancedMesh) { rocks.meshes++; rocks.instances += o.count; if (o.castShadow) { rocks.casters++; rocks.castInst += o.count; } }
  });
  // renderer.render CPU over 30 frames
  const rr = R.render; let ms = 0, n = 0;
  R.render = function () { const t = performance.now(); const x = rr.apply(this, arguments); ms += performance.now() - t; n++; return x; };
  await new Promise(res => { let f = 0; const tick = () => (++f >= 30 ? res() : requestAnimationFrame(tick)); requestAnimationFrame(tick); });
  R.render = rr;
  return { pavement: pav, rocks, patchSunk: sunk, renderCallsIn30: n, renderMsPerCall: n ? +(ms / n).toFixed(2) : null };
})()
