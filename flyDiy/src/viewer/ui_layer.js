// ============================================================================
// ui_layer.js — THE UI LAYER (G1370, UI-LAYER)
//
// The user, 2026-10-03: the autopilot's path ribbons "reflect, and they're not hidden in screenshot mode. They
// should be clearly considered UI elements." An in-world helper - the pattern's ribbons and the pilot's planned
// legs (pattern_vis.js), the CG / NP posts and their labels (app.js gGrp), the editor's selection outlines
// (editor.js hiEdges / hiSilPair) - is drawn ON the picture, not IN the world. So it lives on a layer of its own:
//
//   - ONLY the main camera sees it (app.js enables it once, on `camera`; a clone of it - the warm-up views -
//     inherits it). Every other camera is born on layer 0 alone and so never draws it: the water's planar mirror
//     (water.js MIR.cam - blind() called on it every capture all the same, so a future layers.copy cannot leak it
//     back), the shed's reflection probe (the CubeCamera's six), the world's FAR / COVER maps, the bakers;
//   - PHOTO MODE (app.js shotSet, "screenshot") takes the layer OFF the main camera: one switch hides every
//     helper, whichever module made it;
//   - it NEVER CASTS: three r186's shadow walk tests an object's layers against the MAIN camera (G1080.2), so a
//     helper the eye sees is walked - claim() turns castShadow / receiveShadow off, and shadow_near.js's tagging
//     (tag / tagCraft / apply) leaves a claimed object's mask alone, so no NEAR / CRAFT / FAR bit ever puts it
//     back in front of a camera the UI layer is off for;
//   - a Raycaster (layer 0 by default) no longer hits it: the pick code already skipped every overlay.
//
//   UI_LAYER.LAYER         30 (29 is the warm-up's, 31 shadow_near's empty layer; 2-5 the shadow scheme's)
//   UI_LAYER.claim(obj)    obj and every descendant onto the UI layer alone (mask = 1 << 30), castShadow /
//                          receiveShadow off, userData.uiLayer = true; returns obj. Call it on what you ADD
//                          (an object made later under a claimed group is not claimed by its parent's mask)
//   UI_LAYER.see(cam, on)  the camera sees the UI layer (on !== false) or not
//   UI_LAYER.blind(cam)    see(cam, false)
//   UI_LAYER.is(obj)       claimed?
//   UI_LAYER.drawn(mesh)   would a picture's camera draw it (not the UI layer alone, a material that shows)? - FRAME-DRAWN
// ============================================================================
var UI_LAYER = (function () {
  'use strict';
  const LAYER = 30;
  function claim(o) {
    if (!o || typeof o.traverse !== 'function') return o;
    o.traverse(m => {
      if (m.layers && typeof m.layers.set === 'function') m.layers.set(LAYER);
      m.castShadow = false; m.receiveShadow = false;
      if (m.userData) m.userData.uiLayer = true;
    });
    return o;
  }
  function see(cam, on) {
    if (cam && cam.layers && typeof cam.layers.enable === 'function') { if (on === false) cam.layers.disable(LAYER); else cam.layers.enable(LAYER); }
    return cam;
  }
  const blind = cam => see(cam, false);
  const is = o => !!(o && o.userData && o.userData.uiLayer);
  // FRAME-DRAWN (the user 22 Nov: "in the generated pictures, some of them are poorly centered ... at the bottom right
  // corner rather than being well centered like the others"): a picture frames what its camera DRAWS. A visible mesh on
  // the UI layer alone (a helper: photo mode and every picture's camera are blind to it) or whose every material is hidden
  // or writes no colour is drawn by nobody, yet traverseVisible walks it - and the frame made room for it. The portraits
  // (plane_shot), the player's thumbnails (plane_thumb) and the fiche (plane_fiche) frame through this one test.
  function drawn(m) {
    if (!m || !m.isMesh || !m.geometry) return false;
    if (m.layers && (m.layers.mask & ~(1 << LAYER)) === 0) return false;
    const M = [].concat(m.material || []);
    return M.some(x => x && x.visible !== false && x.colorWrite !== false);
  }
  // ...AND OF A DRAWN MESH, ONLY THE VERTICES IT DRAWS (the cause, found 22 Nov: B-ITES' and the electric twin's portraits
  // framed a nose 3.7-4.5 m ahead of the spinner - the page's cage sheet carries face GROUPS whose material is hidden, the
  // cowl's own path drawing that skin instead, and every buffer vertex was read). drawnPoints(mesh, max, fn) calls fn with
  // the index of each sampled vertex (about `max`) of the groups whose material shows, inside the draw range, through
  // the index - never a vertex no drawn triangle uses. Returns the count; 0 when the mesh is not drawn.
  function drawnPoints(m, max, fn) {
    if (!drawn(m)) return 0;
    const g = m.geometry, pa = g.attributes && g.attributes.position; if (!pa) return 0;
    const ix = g.index, len = ix ? ix.count : pa.count, dr = g.drawRange || { start: 0, count: Infinity };
    const shows = x => !!x && x.visible !== false && x.colorWrite !== false;
    const multi = Array.isArray(m.material) && g.groups && g.groups.length;
    const groups = multi ? g.groups.filter(gr => shows(m.material[gr.materialIndex])) : [{ start: 0, count: len }];
    const spans = []; let total = 0;
    for (const gr of groups) { const s = Math.max(gr.start, dr.start), e = Math.min(gr.start + gr.count, dr.start + dr.count, len); if (e > s) { spans.push([s, e]); total += e - s; } }
    const step = Math.max(1, Math.floor(total / (max || 300)));
    let n = 0;
    for (const [s, e] of spans) for (let k = s; k < e; k += step) { fn(ix ? ix.getX(k) : k); n++; }
    return n;
  }
  return { LAYER, claim, see, blind, is, drawn, drawnPoints };
})();
if (typeof window !== 'undefined') window.UI_LAYER = UI_LAYER;
if (typeof module !== 'undefined') module.exports = UI_LAYER;
