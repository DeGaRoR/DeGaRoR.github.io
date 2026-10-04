// metla_toggle_far.js - METLA-TAXI (G1435): metla_ab --toggle's snippet. At the middle of the taxi: every drawable of
// the premises whose world bounding sphere lies wholly past FAR m from the camera (Metlakatla is 9-10 km from HOME) is
// hidden - the frames' second half ('h1') against the first ('h0') is the far town's DRAW cost (its CPU ticks run on:
// a hidden object is skipped by the renderer, not by the premises' tick). Returns the census of what it hid, by the
// premises' top group (premises:roads, :lots, :houses, :trees, ...) - `drawn` = visible down its whole ancestry (a THREE.LOD's
// unused rungs are invisible groups) and inside the camera's frustum, i.e. what the main pass draws - and the scene's
// node counts (all / auto-updated matrices: scene.updateMatrixWorld's walk).
(() => {
  const FAR = 4000;
  const W = window.WORLD, P = W && W.premises, cam = W && W.camera;   // the RENDER world (app.js window.WORLD = WF), not FLIGHT_PROBE.world() (the core's)
  if (!P || !P.root || !cam) return JSON.stringify({ err: 'no premises root / camera' });
  const V3 = cam.position.constructor, c = cam.getWorldPosition(new V3()), S = new V3();
  let frustum = null; try { const T3 = window.THREE; if (T3) { frustum = new T3.Frustum(); frustum.setFromProjectionMatrix(new T3.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)); } } catch (e) {}
  const out = { far: FAR, hidden: 0, kept: 0, groups: {}, nodes: 0, autoNodes: 0, premNodes: 0, premAuto: 0 };
  W.scene.traverse(o => { out.nodes++; if (o.matrixWorldAutoUpdate !== false) out.autoNodes++; });
  // the walk updateMatrixWorld really takes (it does not descend into a child whose matrixWorldAutoUpdate is false) and
  // the nodes projectObject visits (visible ones), per top-level child of the scene and per premises group
  const walkOf = (o, acc) => { acc.walk++; if (o.matrixAutoUpdate) acc.compose++; for (const ch of o.children) if (ch.matrixWorldAutoUpdate !== false) walkOf(ch, acc); };
  const projOf = (o, acc) => { acc.proj++; if (!o.visible) return; if (o.isLOD) acc.lods++; for (const ch of o.children) projOf(ch, acc); };   // projectObject's visits (it stops at an invisible node)
  out.sceneTop = {}; for (const ch of W.scene.children) { const k = ch.name || ch.type; const a = out.sceneTop[k] = out.sceneTop[k] || { walk: 0, compose: 0, proj: 0, lods: 0 }; if (ch.matrixWorldAutoUpdate !== false) walkOf(ch, a); projOf(ch, a); }
  out.premTop = {}; for (const ch of P.root.children) { const a = out.premTop[ch.name || '?'] = { walk: 0, compose: 0, proj: 0, lods: 0, kids: ch.children.length }; if (ch.matrixWorldAutoUpdate !== false) walkOf(ch, a); projOf(ch, a); }
  const top = o => { let p = o; while (p.parent && p.parent !== P.root) p = p.parent; return p.name || '?'; };
  const shown = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  const hide = [];
  P.root.traverse(o => {
    out.premNodes++; if (o.matrixWorldAutoUpdate !== false) out.premAuto++;
    if (!(o.isMesh || o.isPoints || o.isLine) || !o.visible || !o.geometry) return;
    const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); const bs = o.boundingSphere || g.boundingSphere; if (!bs) return;
    S.copy(bs.center).applyMatrix4(o.matrixWorld); const r = bs.radius * o.matrixWorld.getMaxScaleOnAxis(), d = S.distanceTo(c);
    if (d - r <= FAR) { out.kept++; return; }
    const k = top(o) + (o.isInstancedMesh ? ' I' : o.isBatchedMesh ? ' B' : ''), e = out.groups[k] = out.groups[k] || { n: 0, shown: 0, drawn: 0, shadow: 0 };
    e.n++; const sh = shown(o); if (sh) { e.shown++; if (o.castShadow) e.shadow++; if (!frustum || o.frustumCulled === false || frustum.intersectsObject(o)) e.drawn++; }
    hide.push(o); out.hidden++;
  });
  for (const o of hide) o.visible = false;
  return JSON.stringify(out);
})()
