// shell_ab.js - THE MERGED SHED, PIXEL FOR PIXEL (A1-STAND G600, playtest 2026-09-26). A page-side expression for
// frame_perf's --eval (the game rolled out and paused at the stand):
//   node tools/frame_perf.js --url http://localhost:<port>/flyDiy/index.html?world=jolene --places stand --tiers gfx --frames 10 --eval @tools/shell_ab.js
// The club hangar is drawn from four fixed cameras into an offscreen target, synchronously in one task (nothing else
// runs between the pictures): as built (WORLD.shell({ merge: false }), 278 meshes), merged with every piece still
// casting (castMin 0: the same shadows - the geometry's own witness), and the default (castMin 0.5) with both sun
// maps redrawn - which shows what the small pieces' shadows were worth. A repeat of the first picture proves the
// render is deterministic. Returns the differing pixel counts, the largest channel step, and the draws per picture.
(async () => {
  const W = window.WORLD, R = W.renderer, sc = W.scene;
  const shed = sc.children.find(o => o.isLOD && o.levels && o.levels.length === 2 && o.levels[1].distance === 320);
  if (!shed) return { error: 'no shed LOD in the scene' };
  const c = shed.position, ry = shed.rotation.y;
  const w = 960, h = 540, rt = new THREE.WebGLRenderTarget(w, h);
  const cam = new THREE.PerspectiveCamera(50, w / h, 0.5, 3000);
  cam.layers.mask = W.camera.layers.mask;
  // the doors' end (-x local), the back, a corner from above, and one close at the eaves
  const views = [[-45, 8, 0], [45, 12, 10], [-30, 40, 35], [-16, 5, 18]].map(([x, y, z]) =>
    [c.x + x * Math.cos(ry) + z * Math.sin(ry), c.y + y, c.z - x * Math.sin(ry) + z * Math.cos(ry)]);
  const lights = []; sc.traverse(o => { if (o.isDirectionalLight && o.castShadow) lights.push(o); });
  const shots = (redrawMaps) => views.map(v => {
    cam.position.set(v[0], v[1], v[2]); cam.lookAt(c.x, c.y + 4, c.z); cam.updateMatrixWorld();
    if (redrawMaps) for (const L of lights) L.shadow.needsUpdate = true;
    const prev = R.getRenderTarget(); R.setRenderTarget(rt); R.clear(); R.render(sc, cam);
    const calls = R.info.render.calls; const px = new Uint8Array(w * h * 4); R.readRenderTargetPixels(rt, 0, 0, w, h, px); R.setRenderTarget(prev);
    return { px, calls };
  });
  const diff = (A, B) => A.map((a, i) => { const b = B[i]; let n = 0, mx = 0; for (let k = 0; k < a.px.length; k += 4) { const d = Math.max(Math.abs(a.px[k] - b.px[k]), Math.abs(a.px[k + 1] - b.px[k + 1]), Math.abs(a.px[k + 2] - b.px[k + 2])); if (d > 0) { n++; if (d > mx) mx = d; } } return { differ: n, maxStep: mx, calls: [a.calls, b.calls] }; });
  const was = W.shell({});
  const asBuilt = W.shell({ merge: false });
  const A = shots(false);
  const A2 = shots(false);
  const merged = W.shell({ merge: true, castMin: 0 });
  const M0 = shots(false);
  // the default, with the maps drawn again, against the unmerged shed with the maps drawn again
  W.shell({ merge: false }); const AS = shots(true);
  const def = W.shell({ merge: true, castMin: was.castMin }); const DS = shots(true);
  rt.dispose();
  return { pixels: w * h, meshes: { asBuilt: asBuilt.meshes, merged: merged.meshes, def: def.meshes },
    repeat: diff(A, A2), mergedSameShadows: diff(A, M0), defaultVsBuiltMapsRedrawn: diff(AS, DS) };
})()
