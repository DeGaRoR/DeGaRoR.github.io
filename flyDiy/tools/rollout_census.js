// rollout_census.js - the page-side census rollout_perf's --eval reads (A1-STAND G600, playtest 2026-09-26):
//   node tools/rollout_perf.js --eval @tools/rollout_census.js
// One expression (a promise): the scene's object / caster / near-map census, one scene walk timed, and the
// draws of every renderer.render() over the next 30 frames by target (the main frame, the mirror, the probes,
// the shadow maps inside them), and the cover ring's stat. Read, never written: it moves nothing.
(async () => {
  const W = window.WORLD, sc = W.scene, R = W.renderer, NL = window.SHADOW_NEAR ? SHADOW_NEAR.NEAR_LAYER : 3, FL = window.SHADOW_NEAR ? SHADOW_NEAR.FAR_LAYER : 2;
  let objects = 0, meshes = 0, casters = 0, nearCasters = 0, farCasters = 0, nearTris = 0, frozen = 0;
  const nearBy = {};
  const t0 = performance.now();
  sc.traverse(o => {
    objects++; if (!o.matrixWorldAutoUpdate) frozen++;
    if (!o.isMesh) return; meshes++;
    if (!o.castShadow) return; casters++;
    if (o.layers.isEnabled(FL)) farCasters++;
    let vis = true; for (let p = o; p; p = p.parent) if (!p.visible) { vis = false; break; }
    if (o.layers.isEnabled(NL) && vis && !o.isInstancedMesh) {
      nearCasters++;
      const g = o.geometry; nearTris += g ? (g.index ? g.index.count : g.attributes.position.count) / 3 : 0;
      let top = o; while (top.parent && top.parent !== sc) top = top.parent;
      const k = (top.name || top.type) + (o.userData.craft ? ' (craft)' : '');
      nearBy[k] = (nearBy[k] || 0) + 1;
    }
  });
  const walkMs = performance.now() - t0;
  // what three's per-frame updateMatrixWorld still composes (matrixAutoUpdate) and visits, by top-level child
  const composed = {}, visited = {};
  for (const top of sc.children) { let c = 0, v = 0; const walk = o => { v++; if (o.matrixAutoUpdate) c++; if (o.updateMatrixWorld !== THREE.Object3D.prototype.updateMatrixWorld && o !== top && !o.isCamera) return; for (const ch of o.children) walk(ch); }; walk(top);
    const k = top.name || (top.type + '#' + sc.children.indexOf(top)); composed[k] = (composed[k] || 0) + c; visited[k] = (visited[k] || 0) + v; }
  // what makes three draw the opaque scene a SECOND time (its transmission pass): a visible transmissive material
  const transmissive = []; sc.traverse(o => { if (!o.isMesh || !o.material) return; const ms = Array.isArray(o.material) ? o.material : [o.material];
    if (ms.some(m => m.transmission > 0)) { let v = true; for (let p = o; p; p = p.parent) if (!p.visible) v = false; let top = o; while (top.parent && top.parent !== sc) top = top.parent;
      transmissive.push((top.name || top.type) + '/' + (o.name || o.type) + (v ? '' : ' (hidden)')); } });
  // the draws per render() over 30 frames: renderer.info is per call when autoReset (three resets it at each render)
  const passes = {};
  const rr = R.render, SM = R.shadowMap, sr = SM.render;
  let inShadow = null;
  SM.render = function (lights) { const c0 = R.info.render.calls; const t = performance.now(); const x = sr.apply(this, arguments);
    const k = 'shadow:' + lights.filter(l => l.shadow && (l.shadow.autoUpdate || l.shadow.needsUpdate)).map(l => l.name || 'sun').join('+');
    const p = passes[k] = passes[k] || { n: 0, calls: 0, ms: 0 }; p.n++; p.calls += R.info.render.calls - c0; p.ms += performance.now() - t; inShadow = R.info.render.calls - c0; return x; };
  R.render = function (scene, camera) { inShadow = 0; const t = performance.now(); const x = rr.apply(this, arguments);
    const tg = R.getRenderTarget(); const k = (scene === sc ? 'world' : (scene.name || scene.type)) + '>' + (tg ? (tg.texture && tg.texture.name) || (tg.width + 'x' + tg.height) : 'canvas');
    const p = passes[k] = passes[k] || { n: 0, calls: 0, ms: 0 }; p.n++; p.calls += R.info.render.calls - (inShadow || 0); p.ms += performance.now() - t; return x; };
  await new Promise(res => { let n = 0; const f = () => (++n >= 30 ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  R.render = rr; SM.render = sr;
  // THE DRAWS BY OWNER over ONE world frame (the main pass into the big target, and the shadow maps inside it):
  // renderer.renderBufferDirect sees every draw three makes. Keyed by the scene's top-level child (an unnamed one by
  // its type and index) and the drawn object's own name / cover kind / type; (T) a transparent material.
  const draws = { main: {}, shadow: {} }; let counting = false, inSh = false;
  const rbd = R.renderBufferDirect;
  R.renderBufferDirect = function (camera, scene, geometry, material, object) {
    if (counting) { let top = object; while (top.parent && top.parent !== sc) top = top.parent;
      const tk = top.name || (top.type + '#' + sc.children.indexOf(top)), k = tk + ' / ' + (object.userData.coverKind || object.name || object.type) + (material && material.transparent ? ' (T)' : '');
      const d = draws[inSh ? 'shadow' : 'main']; d[k] = (d[k] || 0) + 1; }
    return rbd.apply(this, arguments); };
  SM.render = function () { inSh = true; try { return sr.apply(this, arguments); } finally { inSh = false; } };
  let counted = 0;
  R.render = function (scene) { const rt = R.getRenderTarget(); counting = !counted && scene === sc && (!rt || rt.width >= 1000); const x = rr.apply(this, arguments); if (counting) counted++; counting = false; return x; };
  await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
  R.render = rr; SM.render = sr; R.renderBufferDirect = rbd;
  const byTop = { main: {}, shadow: {} }; for (const w of ['main', 'shadow']) for (const k in draws[w]) { const t = k.split(' / ')[0]; byTop[w][t] = (byTop[w][t] || 0) + draws[w][k]; }
  const sortE = o => Object.entries(o).sort((a, b) => b[1] - a[1]);
  for (const k in passes) { const p = passes[k]; p.calls = +(p.calls / p.n).toFixed(1); p.ms = +(p.ms / p.n).toFixed(2); }
  const ring = window.TREE_FILL && TREE_FILL.cover ? TREE_FILL.cover() : null, cov = ring ? ring.stat() : null;
  return { composedByTop: Object.entries(composed).sort((a, b) => b[1] - a[1]).slice(0, 10), visitedByTop: Object.entries(visited).sort((a, b) => b[1] - a[1]).slice(0, 10), transmissive: transmissive.slice(0, 20), nTransmissive: transmissive.length, objects, meshes, casters, farCasters, nearCasters, nearTris: Math.round(nearTris), frozen, walkMs: +walkMs.toFixed(2),
    drawsMain: Object.values(draws.main).reduce((a, b) => a + b, 0), drawsShadow: Object.values(draws.shadow).reduce((a, b) => a + b, 0),
    mainByTop: sortE(byTop.main).slice(0, 25), shadowByTop: sortE(byTop.shadow).slice(0, 15), mainTop: sortE(draws.main).slice(0, 25),
    nearBy: Object.entries(nearBy).sort((a, b) => b[1] - a[1]).slice(0, 12), passes, programs: R.info.programs ? R.info.programs.length : null,
    cover: cov ? { draws: cov.draws, blocks: cov.blocks, shown: cov.shown, live: cov.live, instances: cov.instances } : null };
})()
