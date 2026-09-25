// ============================================================================
// shader_warm.js — THE PROGRAMS A FRAME WILL ASK FOR, BUILT BEFORE IT ASKS (G570)
//
// The roll-out's compile step (app.js rollOutScreen 'compile') hands the world
// scene to renderer.compileAsync, which links every program on the driver's
// threads while the loading screen moves. What it cannot see links on the
// first frame instead, synchronously, one program at a time. The census of
// that residue (two headless boots, every linkProgram recorded with the boot
// step it ran in - futureDesigns/PERF-2026-09-23.md G570) found:
//
//   THE SHADOW PASS'S DEPTH PROGRAMS, ALL OF THEM. The old warm-up (app.js
//   compileDepthVariants, S3) built MeshDepthMaterial({ RGBADepthPacking })
//   one per side and compiled them against a helper scene with no lights. In
//   r186 the shadow map draws with three's OWN depth material - BasicDepthPacking
//   (3200) - in the LIT scene's light state (USE_SHADOWMAP, the shadow type),
//   with the caster's map / alphaMap / alphaTest / displacement / side copied
//   onto it (WebGLShadowMap getDepthMaterial). So the eight programs the
//   warm-up linked were never drawn with, and the ~12 the shadow pass does
//   draw with linked on the first frame.
//
//   THE PASSES OUTSIDE THE SCENE. The AA resolve's blit, the bloom chain and
//   the clouds' bake / march / shadow draw full-screen quads in scenes of their
//   own: compileAsync(scene) never meets them. Each module now lists its own
//   (aa_resolve / post_fx / clouds warmList()) and the step compiles them too.
//
// depthVariants() mirrors getDepthMaterial exactly (three r186; GATE PROGRAMS
// renders the real shadow pass in node on a fake GL context and holds every
// depth program it draws with to this warm-up, so a three upgrade that moves
// the rule turns the gate red rather than the first frame slow).
//
//   PROG_WARM.depthVariants(THREE, renderer, scenes, opt) -> { helper, n }
//     scenes: the lit scene(s) whose casters the shadow pass will draw
//     helper: a THREE.Scene of stand-ins (the caster's own geometry, instance /
//             skin / batch kind, never its data), one per distinct depth
//             program; compile it with the lit scene as targetScene, its fog
//             lifted (fogless: the pass draws with none), and a plain render
//             target bound (a shadow map is one: linear, no tone map)
//   PROG_WARM.passes(THREE, lists) -> [{ helper, target }]
//     lists: [{ m, to }] from the modules' warmList(); `to` null = the canvas,
//            'rt' = any plain render target; one helper scene per kind
// ============================================================================
'use strict';
var PROG_WARM = (() => {
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  // A STAND-IN, NOT A CLONE: an object whose prototype is the caster, so every
  // property the program key reads (isInstancedMesh, instanceColor, isSkinnedMesh,
  // isBatchedMesh, _colorsTexture, morphTargetInfluences, the geometry's attributes)
  // is the caster's own, while its material, parent and children are its own. A
  // clone(false) of an InstancedMesh copied its whole instance buffer to compile
  // one program (the cover ring's tufts: 60 000 matrices a block).
  function standIn(o, mat) {
    const s = Object.create(o);
    s.parent = null; s.children = []; s.material = mat; s.visible = true;
    s._listeners = undefined;   // the caster's own listeners must not hear the helper's 'added'
    return s;
  }
  // a copy of a material that keys the SAME program: its type, its defines, its
  // hook and its own cache key (the hook through ATMO's accessor: the material's own
  // hook is `_atmoHook`, and assigning the served wrapper would wrap it twice -
  // app.js compileXrayVariants learnt that first)
  function twin(m) {
    const t = new m.constructor();
    t.copy(m);
    if (m.defines) t.defines = Object.assign({}, m.defines);
    t.userData = m.userData;
    const hook = own(m, '_atmoHook') ? m._atmoHook : own(m, 'onBeforeCompile') ? m.onBeforeCompile : undefined;
    if (hook !== undefined) t.onBeforeCompile = hook;
    if (own(m, 'customProgramCacheKey')) t.customProgramCacheKey = m.customProgramCacheKey;
    return t;
  }
  // three r186 WebGLShadowMap: which caster materials get a depth material of their own
  const needsOwn = (renderer, m) => (renderer.localClippingEnabled && m.clipShadows === true && Array.isArray(m.clippingPlanes) && m.clippingPlanes.length !== 0)
    || (m.displacementMap && m.displacementScale !== 0) || (m.alphaMap && m.alphaTest > 0) || (m.map && m.alphaTest > 0) || m.alphaToCoverage === true;

  function depthVariants(THREE, renderer, scenes, opt) {
    opt = opt || {};
    const helper = new THREE.Scene(), seen = new Set();
    const vsm = renderer.shadowMap && renderer.shadowMap.type === THREE.VSMShadowMap;
    const FLIP = { [THREE.FrontSide]: THREE.BackSide, [THREE.BackSide]: THREE.FrontSide, [THREE.DoubleSide]: THREE.DoubleSide };
    const base = new THREE.MeshDepthMaterial(), baseDist = THREE.MeshDistanceMaterial ? new THREE.MeshDistanceMaterial() : null;
    // what the pass draws with, as a light kind asks: point lights draw distance, the rest depth
    let kinds = { depth: false, distance: false };
    for (const sc of scenes) if (sc) sc.traverse(o => { if (o.isLight && o.castShadow && o.shadow) { if (o.isPointLight) kinds.distance = true; else kinds.depth = true; } });
    if (opt.kinds) kinds = opt.kinds;
    const variant = (o, R, dist) => {
      const custom = dist ? o.customDistanceMaterial : o.customDepthMaterial;
      const src = custom || (dist ? baseDist : base);
      if (!src) return;
      const side = vsm ? (R.shadowSide !== null ? R.shadowSide : R.side) : (R.shadowSide !== null ? R.shadowSide : FLIP[R.side]);
      const alphaTest = R.alphaToCoverage === true ? 0.5 : R.alphaTest;
      // the key's reads, as a signature: one stand-in per distinct answer
      const sig = [src.uuid, custom ? 'c' : (needsOwn(renderer, R) ? 'own' : 'base'), side, !!R.map, !!R.alphaMap, alphaTest > 0 ? 1 : 0,
        !!(R.displacementMap && R.displacementScale !== 0), R.clipShadows && R.clippingPlanes ? R.clippingPlanes.length : 0, R.visible, R.wireframe,
        o.isInstancedMesh ? 'i' + (o.instanceColor ? 'c' : '') + (o.morphTexture ? 'm' : '') : '', o.isSkinnedMesh ? 's' : '',
        o.isBatchedMesh ? 'b' + (o._colorsTexture ? 'c' : '') : '', o.morphTargetInfluences ? 'mt' + o.morphTargetInfluences.length : '',
        Object.keys((o.geometry && o.geometry.attributes) || {}).sort().join('.'), Object.keys((o.geometry && o.geometry.morphAttributes) || {}).sort().join('.')].join('|');
      if (seen.has(sig)) return; seen.add(sig);
      const d = custom ? twin(custom) : new src.constructor();
      d.visible = true; d.wireframe = R.wireframe; d.side = side;
      d.alphaMap = R.alphaMap; d.alphaTest = alphaTest; d.map = R.map;
      d.clipShadows = R.clipShadows; d.clippingPlanes = R.clippingPlanes; d.clipIntersection = R.clipIntersection;
      d.displacementMap = R.displacementMap; d.displacementScale = R.displacementScale; d.displacementBias = R.displacementBias;
      helper.add(standIn(o, d));
    };
    for (const sc of scenes) if (sc) sc.traverse(o => {
      if (!(o.isMesh || o.isLine || o.isPoints) || !o.castShadow || !o.material) return;
      const mats = Array.isArray(o.material) ? (o.geometry && o.geometry.groups && o.geometry.groups.length ? o.geometry.groups.map(g => o.material[g.materialIndex]) : o.material) : [o.material];
      for (const R of mats) {
        if (!R || !R.visible) continue;
        if (kinds.depth) variant(o, R, false);
        if (kinds.distance) variant(o, R, true);
      }
    });
    return { helper, n: helper.children.length };
  }

  // fogless(scene, fn): fn() with the scene's fog lifted. The shadow pass draws with no scene (three's empty one: no
  // fog), and the fog is in the program key (fogExp2: '' under a THREE.Fog, false under none) though a depth
  // program never reads it - compiled with the world's fog on, every warmed depth program keyed apart from the one
  // the pass asks for and linked AGAIN on the first frame, same source (the second census). The lights stay: they
  // are the shadow map's key (USE_SHADOWMAP, the shadow type)
  function fogless(scene, fn) { const f = scene.fog; scene.fog = null; try { return fn(); } finally { scene.fog = f; } }

  // the full-screen passes: one quad per material, grouped by where it draws
  function passes(THREE, lists) {
    const by = new Map();
    for (const list of lists) for (const e of (list || [])) {
      if (!e || !e.m) continue;
      const k = e.to === null ? 'canvas' : 'rt';
      let g = by.get(k); if (!g) by.set(k, g = { helper: new THREE.Scene(), target: k === 'canvas' ? null : 'rt', mats: new Set() });
      if (g.mats.has(e.m)) continue; g.mats.add(e.m);
      const q = new THREE.Mesh(passes.quad || (passes.quad = new THREE.PlaneGeometry(2, 2)), e.m); q.frustumCulled = false;
      g.helper.add(q);
    }
    return [...by.values()];
  }
  const api = { depthVariants, fogless, passes, twin, standIn };
  if (typeof window !== 'undefined') window.PROG_WARM = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
