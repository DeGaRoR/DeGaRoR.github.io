// flown_bake.js — THE FLOWN AEROPLANE, TEXTURE-BAKED (C4a, G870; ARCH-2026-09-27 §7).
//
// The user: "texture bake our planes before getting in game for the better texture averaging of colors blending,
// less pixel harshness, lower need for anti-aliasing". The live AEROSKIN shader computes the livery, the decals, the
// weathering, the rivets, the seams, the panel lines and the relief per fragment, every frame; what it computes at
// distance aliases (ten fwidth/dFdx uses AA some of it analytically, the rest shimmers). A texture has mipmaps: the
// same answer, computed ONCE, prefiltered for every distance.
//
// ON G569's MACHINERY (parked.js "THE FAR LEVELS BAKED"): the exterior's charts (PARKED.unwrap: welded, cut where
// the facing turns, laid flat, packed), the flown shader itself drawn in atlas space writing MATERIAL PARAMETERS
// instead of lit colour (so the clear coat and anything view- or time-dependent stay live), the dilation, and an
// IndexedDB cache keyed by the build's content and the game's build. Four differences:
//   1  THE FLOWN MESH KEEPS ITS VERTICES. The snapshot's buckets are true soups (every corner a vertex of its own,
//      _cage_join.js pushV), so a vertex belongs to ONE triangle, one chart and one atlas texel: the bake is a
//      per-vertex attribute (`uv1`, Uint16 normalised) on the very arrays the rigs bind, the flex writes and the
//      hinges turn. Nothing is re-meshed; a vertex two charts share (none in a soup, but a payload is not a promise)
//      is split, every per-vertex array with it (split()).
//   2  TANGENT-SPACE NORMALS. G569 wrote object space: right for a rigid parked aeroplane, wrong for a wing that
//      flexes and a surface that hinges. The bake writes the flown normal in THE FRAME THREE WILL REBUILD AT RUNTIME
//      (getTangentFrame over the atlas uv, r186's normal_fragment_begin): the same cotangent frame, solved for the
//      tangent-space vector (inverse(tbn) * N). The frame is intrinsic to the surface's uv, so it rides the flex.
//   3  TOKSVIG IN THE MIPS. The mip chain is made on the CPU: the albedo averaged in linear light, the normals
//      averaged as vectors (the average of the level-0 unit normals under each texel: its shortening is the normal
//      variance the mip hides) and the roughness - and the clear coat's - widened by that variance (Karis' GGX form,
//      as UE4's composite texture does it), so the rivets and the seams stop sparkling where they fold into one texel.
//   4  2048^2, a 4-texel gutter (the flown aeroplane is seen from 1 m to 3 km; G569's 1024 and 1 texel were for L1+).
//
// THE MAPS. T0 albedo (sRGB) + A = the back face is inside (the live uInside.y: exterior skin darkens behind, from
// the cockpit); T1 the tangent-space normal; T2 R clear coat, G roughness, B metalness, A clear-coat roughness. One
// MeshPhysicalMaterial (Standard when nothing is varnished) samples them through `uv1` (texture.channel 1), with a
// small hook: the clear coat on the perturbed normal (G206's rule), its roughness from T2.A, the cabin's darkness
// and the footwell on the back faces (AERO_CABIN_FS's arithmetic, the flag from T0.A).
//
// WHAT BAKES. An AEROSKIN bucket: a finish, not glass, not a turning blade or spinner, not see-through, not the facia
// (C4a baked the exterior only and kept the controls', the gauges' and the links' buckets live; C4b bakes those and
// the cabin too - see bakedSets). Glass, the lamps, the crew, the panel's faces and hands, the tanks, the blades stay
// LIVE. The garage never sees a bake (the editor draws its own meshes).
//
// WHEN (the user, 2026-09-28: "no impact on performance below 30 fps"): only under the roll-out screen, as its own
// step ('bake', after 'sync'), sliced so no task passes 1 s; a cached build only reads, unzips, makes its mips and
// uploads. Never in the garage's idle time, never in flight. The step then rebuilds the model once if 'sync' had
// already built it live (GARAGE_SPEC.update -> setAircraft); B8B9's restructure is asked to order snapshot -> bake
// -> apply so that rebuild goes away.
//
// THE A/B DIAL. `?fbake=0` (window.FLYDIY_FLOWN_BAKE = 0) flies the live shader. FLOWN_BAKE.ab = true before a build
// keeps each baked mesh's live material and attributes beside the bake so FLOWN_BAKE.show(false|true) flips them in
// place (merged still meshes carry no live twin: set FLYDIY_CRAFT_MERGE = 0 with it for a complete flip).
//
// C4b (G875-G878): THE ONE-MATERIAL FLOWN MODEL.
//   THE FOLD (mergeModel): every mesh on a baked material folds into a handful of draws - the model group's own into a
//     plain Mesh, a moving part's (a wheel, the castor, an engine unit, a control) into ONE SkinnedMesh with the part
//     as its bone; the rigs keep writing their attribute objects, whose arrays are now views into the fold. The
//     Cessna's flown model: 261 draws -> 90 in the main pass, 226 -> 40 in the shadow pass (GATE FRAMECOST's census).
//   TWO ATLASES: the exterior's (2048², as C4a) and the cabin's ('in', 2048², a 2-texel gutter: its thousands of small
//     charts) - the cabin seen through the glazing draws on its baked material; the COCKPIT VIEW flies the cabin's
//     live shader (its meshes kept, hidden, on the same arrays: the fold's view(on)), because at arm's length no
//     atlas is a match for the procedural grain.
//   THE WORKER: the unwrap, the gutters and the mips run in a Blob worker made from these functions' own text (the
//     page the fallback); the GL passes stay on the page's context (the flown programs live there) and read back
//     asynchronously.
//   DIALS: `?fbake=foldab` keeps every fold's members (FLOWN_BAKE.showFold(false|true|null): C4a's draws | the folds |
//     the cockpit's rule), `?fbake=ext` the exterior's atlas only, window.FLYDIY_FLOWN_MERGE = 0 no fold.
'use strict';
(function () {
  const W = (typeof window !== 'undefined') ? window : globalThis;
  const FB = { V: 2, S: 2048, Sin: 2048, gutter: 4, gutterIn: 2, keep: 4, on: true, ab: false, quiet: false, sliceMs: 40, worker: true,
                hybrid: true, hyA: 1.0, hyB: 1.25,   // G1325 HYBRID-FARTHER's band (the live aeroplane from 1 px a texel; was 1.6-2.0), back with G1490: train 29 took it out (live at the taxi, the way back cost 2.8 s and the next roll-out a 5.2 s link - the band twins drawn in the shed's lights, see rest()); ?fbake=hy1.6-2.0 the old band
                hyEase: 0.5,   // G1494 ON BY DEFAULT (the user, 2026-10-05: "dissolve"): the band crossed over 0.5 s, no steady dither, +1.4 ms at the taxi chase vs +2.15 hard (?fbake=hyease=0 the hard band)
                eyeR: 1.5, eyeOnly: true, shadowFolds: true,
                cockpitLive: true,                 // train 21 (the user, 2026-10-01: "ship the live cockpit exterior"): the eye's zone live in the cockpit, the detailed textures at the seat (~+0.6 ms Cub/Cessna render); ?fbake=cockpitbake restores the bake there
                swingPad: 0.5 };   // G1170.2: a moving part's travel beyond its turn (a Fowler flap's run, the gear's stroke), m   // G1124.1: the exterior live in the cockpit (the eye's zone) - off: +2.4 ms there (the Cessna)   // G1124: the eye zone's reach past the cabin (m); the cockpit's cuts   // THE HYBRID (below): the live shader from hyA screen pixels a texel, whole at hyB
  const log = (...a) => { if (FB.quiet) return; console.log('flown bake:', ...a); };
  const tick = () => new Promise(r => setTimeout(r, 0));
  // the dials in the URL: ?fbake=0 the live shader; ?fbake=ab the A/B build (live twins kept, the still merge off);
  // ?fbake=nocache bakes whatever the cache holds
  try {
    const q = /[?&]fbake=([^&]*)/.exec((W.location && W.location.search) || '');
    const on = new Set(q ? decodeURIComponent(q[1]).split(',') : []);   // C4b: several, comma-separated
    if (on.has('0')) W.FLYDIY_FLOWN_BAKE = 0;
    if (on.has('ab')) { FB.ab = true; W.FLYDIY_CRAFT_MERGE = 0; }
    if (on.has('nocache')) FB.noCache = true;   // the rig's warm MISS: the cache is not read (it is written)
    if (on.has('foldab')) FB.foldAB = true;     // C4b's A/B: the folds keep their members (showFold flips them)
    if (on.has('ext')) FB.Sin = 0;              // C4b: the exterior's atlas only (the cabin flies live, as C4a)
    if (on.has('nohy')) FB.hybrid = false;      // the hybrid off: the bake at every distance (C4b as it landed)
    if (on.has('alleye')) FB.eyeOnly = false;   // G1124 off: the whole exterior live in the cockpit
    if (on.has('cockpitlive')) FB.cockpitLive = true;
    if (on.has('cockpitbake')) FB.cockpitLive = false;   // train 21: the fallback dial (the cockpit on the bake, as before)   // G1124.1: the eye's zone live in the cockpit (the follow-up's dial)
    if (on.has('nowarm')) FB.noWarm = true;   // train 20's isolation: the kept meshes neither compiled by stand-in nor warm-drawn (not resident)
    if (on.has('nowarmdraw')) FB.noWarmDraw = true;       // isolation: the kept stand-ins compiled, not warm-drawn
    if (on.has('nokeptcompile')) FB.noKeptCompile = true; // isolation: the kept stand-ins warm-drawn, not compiled first
    if (on.has('noband')) FB.noBand = true;   // isolation: no band twins compiled or drawn (a crossing would link them)
    if (on.has('warmkey')) FB.warmKey = true;        // (a): the warm draws one stand-in a program key, not one a view (G1170: the views share the fold's buffers)
    if (on.has('warmcanvas')) FB.warmCanvas = true;  // (b): the warm draws into the canvas, not the AA's intermediate target
    if (on.has('warmfree')) FB.warmFree = true;    // isolation: the warm draw's buffers freed once it is done (resident, or first-drawn?)
    if (on.has('noshadowfolds')) FB.shadowFolds = false;   // G1124 off: the live meshes cast their own shadows
    if (on.has('norest')) FB.noRest = true;   // G1490's A/B: the way back leaves the flown model as the flight left it (no rest())
    if (on.has('hyease')) FB.hyEase = 0.5;    // G1494: the band crossed in TIME (see nearT), seconds
    for (const x of on) { const m = /^hyease=([\d.]+)$/.exec(x); if (m) FB.hyEase = +m[1]; }
    for (const x of on) { const m = /^hy([\d.]+)-([\d.]+)$/.exec(x); if (m) { FB.hyA = +m[1]; FB.hyB = Math.max(+m[1] + 0.01, +m[2]); } }   // the band
    for (const x of on) { const m = /^hy=([\d.]+)$/.exec(x); if (m) FB.hyForce = Math.min(1, Math.max(0, +m[1])); }   // t held (the A/B rigs)
  } catch (e) {}

  // ---- which buckets bake, into which atlas ------------------------------------------------------------------------
  // An AEROSKIN bucket: a finish, not glass, not a turning blade or spinner (the disc reads their material's colour, and
  // they hide as it takes over), not see-through, not the facia (its cut-out). C4b: TWO ATLASES - 'ext' the exterior
  // (FB.S), 'in' the cabin (FB.Sin: the inside buckets, seen through the glazing from outside; the cockpit view flies
  // their live shader, see mergeModel's keep). And no longer 'never a bucket that also rides a control, a gauge or a
  // link' (C4a): nothing writes those meshes' materials (the cockpit lights its lamps and its needles, both live), the
  // fold makes their part a bone, and the pick reads the part through the fold.
  const bakes = m => !!(m && m.fin && m.fin !== 'glass' && !m.spin && !(m.opacity < 1) && m.sec !== 'dashFace');
  const setOf = m => (m.inside ? 'in' : 'ext');
  const SETS = ['ext', 'in'];
  // name -> 'ext' | 'in'
  function bakedSets(vis) {
    const out = new Map();
    for (const k in vis.groups || {}) if (bakes(vis.mats[k])) out.set(k, setOf(vis.mats[k]));
    for (const p of vis.parts || []) for (const k in p.groups) if (bakes(vis.mats[k])) out.set(k, setOf(vis.mats[k]));
    return out;
  }
  function bakedNames(vis, set) {
    const out = new Set();
    for (const [k, s] of bakedSets(vis)) if (!set || s === set) out.add(k);
    return out;
  }
  // the baked groups in the payload's own order (the cache stores per-group arrays in it): { k, g, at }
  function groupsOf(vis, names) {
    const out = [];
    for (const k in vis.groups || {}) if (names.has(k)) out.push({ k, g: vis.groups[k], at: null });
    for (const p of vis.parts || []) for (const k in p.groups) if (names.has(k)) out.push({ k, g: p.groups[k], at: p.stretch ? null : p.pivot });
    return out;
  }

  // ---- the rest positions: copied when the snapshot is taken (app.js syncBuildSteps), before any pose writes them --
  const REST = new WeakMap();
  function note(vis) {
    if (!vis || !vis.cage) return;
    const names = bakedNames(vis);
    for (const e of groupsOf(vis, names)) if (!REST.has(e.g)) REST.set(e.g, (e.g.base0 || e.g.pos).slice());
  }
  const restOf = g => REST.get(g) || g.base0 || g.pos;

  // ---- the key -----------------------------------------------------------------------------------------------------
  function hash(str) {
    let h1 = 0x811c9dc5, h2 = 0x01000193 ^ str.length;
    for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ c, 2246822519) ^ (h2 >>> 13); }
    return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
  }
  // the build's whole content (the spec carries the livery, the finishes and the weathering macros), the game's
  // build (the shaders the bake ran), this file's dials, and what the snapshot made of it (the groups' sizes)
  function keyOf(list, spec, set) {
    let nv = 0; for (const e of list) nv += e.g.pos.length / 3;
    return ['fb', FB.V, set || 'ext', set === 'in' ? FB.Sin : FB.S, set === 'in' ? FB.gutterIn : FB.gutter, W.FLYDIY_BUILD || 'dev', (typeof GEN_SPEC_V !== 'undefined') ? GEN_SPEC_V : 0,
            list.length, nv, hash(JSON.stringify(spec || {}))].join('|');
  }

  // ---- the unwrap: the baked groups as one soup, PARKED.unwrap, a uv per vertex ----------------------------------
  function extOf(list) {
    let nv = 0, ni = 0;
    for (const e of list) { nv += e.g.pos.length / 3; ni += e.g.idx.length; }
    const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), idx = new Uint32Array(ni);
    const bb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    let vo = 0, io = 0;
    for (const e of list) {
      const P = restOf(e.g), n = e.g.pos.length / 3, a = e.at || [0, 0, 0];
      for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) {
        const v = P[i * 3 + c] + a[c]; pos[(vo + i) * 3 + c] = v;
        if (v < bb[c]) bb[c] = v; if (v > bb[c + 3]) bb[c + 3] = v;
      }
      if (e.g.nrm) nrm.set(e.g.nrm.subarray(0, n * 3), vo * 3);
      for (let i = 0; i < e.g.idx.length; i++) idx[io + i] = e.g.idx[i] + vo;
      e.v0 = vo; e.i0 = io; vo += n; io += e.g.idx.length;
    }
    for (let a = 0; a < 3; a++) if (bb[a + 3] - bb[a] < 1e-3) bb[a + 3] = bb[a] + 1e-3;
    return { pos, nrm, idx, nt: ni / 3, bb };
  }
  const Q = 65535;
  // per group: its vertices' atlas uv (Uint16, normalised), splitting a vertex that two wedges claim
  function uvsOf(list, uw) {
    let split = 0;
    for (const e of list) {
      const g = e.g, n = g.pos.length / 3, own = new Int32Array(n).fill(-1);
      const extra = [];                                     // [vertex, wedge] for a vertex's second wedge
      const idx2 = new Uint32Array(g.idx.length);
      for (let c = 0; c < g.idx.length; c++) {
        const v = g.idx[c], w = uw.idx[e.i0 + c];
        if (own[v] < 0 || own[v] === w) { own[v] = w; idx2[c] = v; continue; }
        let j = -1; for (let q = 0; q < extra.length; q++) if (extra[q][0] === v && extra[q][1] === w) { j = q; break; }
        if (j < 0) { j = extra.length; extra.push([v, w]); }
        idx2[c] = n + j;
      }
      if (extra.length) { split += extra.length; splitGroup(g, extra.map(x => x[0]), idx2); }
      const m = g.pos.length / 3, uv = new Uint16Array(m * 2);
      for (let v = 0; v < m; v++) {
        const w = v < n ? own[v] : extra[v - n][1];
        if (w < 0) continue;                                 // a vertex no triangle uses
        uv[v * 2] = Math.round(Math.min(1, Math.max(0, uw.uv[w * 2])) * Q);
        uv[v * 2 + 1] = Math.round(Math.min(1, Math.max(0, uw.uv[w * 2 + 1])) * Q);
      }
      e.uv = uv;
    }
    return split;
  }
  // a split: every per-vertex array of the group grows by the listed vertices (a copy each), the index is the new
  // one; a rig's pristine copy (base0) is dropped with the old arrays
  function splitGroup(g, src, idx2) {
    const n = g.pos.length / 3, m = n + src.length;
    for (const k of Object.keys(g)) {
      const a = g[k];
      if (k === 'idx' || !ArrayBuffer.isView(a) || a.length % n) continue;
      const s = a.length / n, b = new a.constructor(m * s);
      b.set(a);
      for (let j = 0; j < src.length; j++) for (let q = 0; q < s; q++) b[(n + j) * s + q] = a[src[j] * s + q];
      g[k] = b;
    }
    g.idx = idx2; g.nv = m;
    if (REST.has(g)) { const r = REST.get(g), b = new Float32Array(m * 3); b.set(r); for (let j = 0; j < src.length; j++) for (let q = 0; q < 3; q++) b[(n + j) * 3 + q] = r[src[j] * 3 + q]; REST.set(g, b); }
    delete g.base0;
  }

  // ---- the materials the bake draws: the flown factory's own (app.js buildModel matFor, the cage branch) ----------
  // THE SAME ARGUMENTS as app.js and parked.js hand AEROSKIN.aeroMaterial (GATE FLOWNBAKE compares the three lists)
  function aeroArgs(THREE, m) {
    const op = m.opacity !== undefined ? m.opacity : 1;
    return { finish: m.fin, tintLin: m.color,
      grm: m.grm || '', struct: m.grm ? 1 : 0,
      opacity: op, fieldM: m.fieldM || 1, surf: m.surf ? 1 : 0,
      boxDet: m.boxDet || 0, boxPlane: m.boxPlane || 0,
      detRot: m.detRot || 0,
      spin: m.spin || 0,
      hole: m.sec === 'dashFace' ? 1 : 0,
      wing: m.wing || 0,
      tileK: m.tileK, roughK: m.roughK, nrmK: m.nrmK,
      ccK: m.ccK, fieldK: m.fieldK,
      fieldLK: m.fieldLK,
      inside: m.inside || 0,
      decals: m.noDec ? 0 : 1,
      memF: m.memF || null,
      metalK: m.metalK || 0,
      ribM: m.ribM, wearK: m.wearK, wearM: m.wearM,
      side: THREE.DoubleSide };
  }
  function hookOf(m) {
    if (Object.prototype.hasOwnProperty.call(m, 'onBeforeCompile')) return m.onBeforeCompile;
    return m._atmoHook || null;
  }
  // THE BAKE VARIANT OF A FLOWN PROGRAM: its own hook first (on the block with the bake's craft frame), then two
  // splices at the very end of main - the vertex lands at its atlas texel, the fragment writes what the lighting
  // would have read. uFbOut 0: albedo (sRGB) + the back-face-inside flag in A (0.5 + 0.5 in: A > 0 = written);
  // 1: the TANGENT-SPACE normal in three's own cotangent frame over the atlas uv; 2: clear coat, roughness,
  // metalness, clear-coat roughness. One wrapper per source hook, its text the program's cache key.
  const FB_U = { uFbOut: { value: 0 } };
  const WRAP = new Map();
  const BAKE_VS = '  vFbUv = aFbUv;\n  gl_Position = vec4(aFbUv * 2.0 - 1.0, 0.0, 1.0);\n';
  const BAKE_FS = `
  {
    vec3 fbNg = normalize(vNormal);
    vec3 fbNf = normalize(normal);
    // getTangentFrame(-vViewPosition, N, uv1), r186 normal_fragment_begin, front face: the frame the runtime rebuilds
    vec3 fbQ0 = dFdx(-vViewPosition), fbQ1 = dFdy(-vViewPosition);
    vec2 fbS0 = dFdx(vFbUv), fbS1 = dFdy(vFbUv);
    vec3 fbQ1p = cross(fbQ1, fbNg), fbQ0p = cross(fbNg, fbQ0);
    vec3 fbT = fbQ1p * fbS0.x + fbQ0p * fbS1.x, fbB = fbQ1p * fbS0.y + fbQ0p * fbS1.y;
    float fbDet = max(dot(fbT, fbT), dot(fbB, fbB));
    float fbSc = fbDet == 0.0 ? 0.0 : inversesqrt(fbDet);
    mat3 fbTBN = mat3(fbT * fbSc, fbB * fbSc, fbNg);
    vec3 fbM = vec3(0.0, 0.0, 1.0);
    if (abs(determinant(fbTBN)) > 1e-5) fbM = inverse(fbTBN) * fbNf;
    fbM = normalize(fbM);
    if (fbM.z < 0.05) fbM = normalize(vec3(fbM.xy, 0.05));
    vec3 fbA = clamp(diffuseColor.rgb, 0.0, 1.0);
    float fbR = 0.8, fbMe = 0.0, fbC = 0.0, fbCR = 0.2;
  #ifdef STANDARD
    fbR = roughnessFactor; fbMe = metalnessFactor;
  #endif
  #ifdef USE_CLEARCOAT
    fbC = material.clearcoat; fbCR = material.clearcoatRoughness;
  #endif
    gl_FragColor = uFbOut < 0.5 ? vec4(sRGBTransferOETF(vec4(fbA, 1.0)).rgb, 0.25 + 0.25 * clamp(uInside.y, 0.0, 1.0) + 0.75 * clamp(uInside.x, 0.0, 1.0))
                 : uFbOut < 1.5 ? vec4(fbM * 0.5 + 0.5, 1.0)
                 : vec4(clamp(fbC, 0.0, 1.0), clamp(fbR, 0.0, 1.0), clamp(fbMe, 0.0, 1.0), clamp(fbCR, 0.0, 1.0));
  }
`;
  function bakeHook(h) {
    let w = WRAP.get(h);
    if (w) return w;
    w = function (sh, r) {
      if (h) h.call(this, sh, r);
      sh.uniforms.uFbOut = FB_U.uFbOut;
      sh.vertexShader = 'attribute vec2 aFbUv;\nvarying vec2 vFbUv;\n' + sh.vertexShader.replace(/\}\s*$/, BAKE_VS + '}\n');
      sh.fragmentShader = 'uniform float uFbOut;\nvarying vec2 vFbUv;\n' + sh.fragmentShader.replace(/\}\s*$/, BAKE_FS + '}\n');
    };
    w.toString = () => 'flown.bake|' + FB.V + '|' + (h ? h.toString() : '');
    WRAP.set(h, w);
    return w;
  }
  function renderer() {
    const R = FB.renderer || W.FLYDIY_RENDERER || null;
    return R && R.isWebGLRenderer && typeof R.readRenderTargetPixels === 'function' ? R : null;
  }
  const craftP = THREE => new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1);   // model (x aft, y up, z left) -> craft (x lat, y aft, z up)

  // THE SHARED BLOCK AS THE FLOWN AEROPLANE WEARS IT - the calls buildModel and setAircraft make, from the payload's own
  // numbers (parked.js does the same for a parked build); the caller restores the block after
  function blockFor(THREE, vis, spec) {
    const A = W.AEROSKIN, WX = (typeof W.AEROWX !== 'undefined') ? W.AEROWX : null;
    if (A.aeroSetCabin) A.aeroSetCabin(THREE, { coverage: Object.keys(vis.mats).some(k => vis.mats[k] && vis.mats[k].fin === 'glass') ? 1 : 0.4 });
    if (A.aeroSetFootwell) A.aeroSetFootwell(THREE, vis.footwell || null);
    if (A.aeroSetHoles) A.aeroSetHoles(THREE, vis.holes || null);
    if (WX && WX.aeroWxSetSources) WX.aeroWxSetSources(THREE, Object.assign({ pivot: 1 }, vis.weather || {}));
    if (spec && A.aeroApplySpecDecals) A.aeroApplySpecDecals(THREE, spec);
    if (spec && WX && WX.aeroWxSetMacro && WX.aeroWxMacroFromSpec) WX.aeroWxSetMacro(THREE, WX.aeroWxMacroFromSpec(spec));
    if (spec && WX && WX.aeroWxSetSpiral && A.aeroDecalMerge) WX.aeroWxSetSpiral(THREE, A.aeroDecalMerge(spec));
  }
  const cloneVal = v => (v == null || typeof v !== 'object' || v.isTexture) ? v : Array.isArray(v) ? v.map(cloneVal) : (typeof v.clone === 'function' ? v.clone() : v);
  const copyVal = (d, s) => { if (s == null || typeof s !== 'object' || s.isTexture) return s; if (Array.isArray(s)) { for (let i = 0; i < s.length; i++) d[i] = copyVal(d[i], s[i]); return d; } if (d && typeof d.copy === 'function') { d.copy(s); return d; } return cloneVal(s); };

  // the flown materials drawn into the atlas: each group's soup with its own attributes, the rest positions, its
  // cavity (AEROWX's, on the same geometry the flight computes it on) and the atlas uv; the edges first (lines
  // reach charts too small for a texel centre), the faces over them; three passes read back
  async function bakeAtlas(THREE, R, vis, list, t, S) {
    const A = W.AEROSKIN, WX = (typeof W.AEROWX !== 'undefined') ? W.AEROWX : null;
    const U = A.aeroSharedU(THREE);
    const block = Object.assign({}, U, { uCraftInv: { value: craftP(THREE) } });
    const solid = new THREE.Scene(), wire = new THREE.Scene(), made = [];
    const PK = W.PARKED;
    let cc = 0;
    const srcOf = new Map();
    for (const e of list) {
      const m = vis.mats[e.k] || {}, g = e.g, n = g.pos.length / 3;
      let src = srcOf.get(e.k);
      if (!src) { src = A.aeroMaterial(THREE, aeroArgs(THREE, m)); srcOf.set(e.k, src); if (src.clearcoat > 0) cc++; }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(restOf(g).subarray(0, n * 3)), 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(g.nrm, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(g.uv || new Float32Array(n * 2), 2));
      if (g.srf) geo.setAttribute('aStruct', new THREE.BufferAttribute(g.srf, 4));
      const f = new Float32Array(n * 2); for (let i = 0; i < n * 2; i++) f[i] = e.uv[i] / Q;
      geo.setAttribute('aFbUv', new THREE.BufferAttribute(f, 2));
      geo.setIndex(new THREE.BufferAttribute(g.idx, 1));
      if (WX && WX.aeroWxBakeCavity) WX.aeroWxBakeCavity(THREE, geo, m.fieldM || 1);
      for (const wf of [false, true]) {
        const bm = PK.dupe(src, block);
        bm.onBeforeCompile = bakeHook(hookOf(bm));
        bm.transparent = false; bm.blending = THREE.NoBlending; bm.depthTest = false; bm.depthWrite = false;
        bm.side = THREE.DoubleSide; bm.alphaTest = 0; bm.wireframe = wf; bm.needsUpdate = true;
        const mesh = new THREE.Mesh(geo, bm);
        mesh.frustumCulled = false;
        if (e.at) mesh.position.set(e.at[0], e.at[1], e.at[2]);   // a part's object space is its own, as flown
        (wf ? wire : solid).add(mesh);
        made.push(bm);
      }
      made.push(geo);
    }
    solid.updateMatrixWorld(true); wire.updateMatrixWorld(true);
    const cam = new THREE.PerspectiveCamera();
    cam.matrixAutoUpdate = false; cam.matrixWorld.identity(); cam.matrixWorldInverse.identity();
    const rt = new THREE.WebGLRenderTarget(S, S, { depthBuffer: false, stencilBuffer: false, generateMipmaps: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    const out = [];
    try {
      // the programs linked off the main thread (KHR_parallel_shader_compile), awaited: the target bound for the call only
      let t0 = performance.now();
      if (R.compileAsync) {
        const prev = R.getRenderTarget(); let p = null;
        try { R.setRenderTarget(rt); p = Promise.all([R.compileAsync(solid, cam), R.compileAsync(wire, cam)]); } catch (e) { p = null; } finally { R.setRenderTarget(prev); }
        if (p) { try { await p; } catch (e) {} }
      }
      t.compile = Math.round(performance.now() - t0);
      t0 = performance.now();
      // C4b: THE READ-BACK IS ASYNCHRONOUS (a pixel-pack buffer and a fence: the page never stalls on the GPU); the copy
      // is queued before the next pass draws over the target, so the three passes go back to back and are awaited together
      const reads = [];
      let tMain = 0;
      for (let k = 0; k < 3; k++) {
        await tick();                                       // a pass a task
        const tk = performance.now();
        const prevRT = R.getRenderTarget(), prevAC = R.autoClear, ccol = R.getClearColor(new THREE.Color()), ca = R.getClearAlpha(), prevSM = R.shadowMap.enabled;
        try {
          R.shadowMap.enabled = false; R.autoClear = false;
          R.setRenderTarget(rt); R.setClearColor(0x000000, 0);
          FB_U.uFbOut.value = k;
          for (const m of made) if (m.isMaterial) m.uniformsNeedUpdate = true;
          R.clear(true, false, false);
          R.render(wire, cam); R.render(solid, cam);
          const buf = new Uint8Array(S * S * 4);
          let p = null;
          if (FB.asyncRead !== false && typeof R.readRenderTargetPixelsAsync === 'function') { try { p = R.readRenderTargetPixelsAsync(rt, 0, 0, S, S, buf); } catch (e) { p = null; } }
          if (p && typeof p.then === 'function') reads.push(p.then(() => buf, () => { R.readRenderTargetPixels(rt, 0, 0, S, S, buf); return buf; }));
          else { R.readRenderTargetPixels(rt, 0, 0, S, S, buf); reads.push(buf); }
        } finally { R.setRenderTarget(prevRT); R.setClearColor(ccol, ca); R.autoClear = prevAC; R.shadowMap.enabled = prevSM; }
        tMain += performance.now() - tk;
      }
      for (const b of await Promise.all(reads)) out.push(b);
      t.render = Math.round(performance.now() - t0); t.renderMain = Math.round(tMain);
    } finally {
      rt.dispose();
      for (const m of made) m.dispose();
    }
    return { tex: out, cc: cc > 0 };
  }
  // every texel the bake did not write takes its nearest written neighbour's (all four channels; four-connected BFS);
  // written = A of the albedo pass > 0. Returns the share written.
  function dilate(bufs, S) {
    const n = S * S, src = new Int32Array(n).fill(-1), queue = new Int32Array(n), A = bufs[0];
    let qt = 0;
    for (let i = 0; i < n; i++) if (A[i * 4 + 3] > 0) { src[i] = i; queue[qt++] = i; }
    const written = qt;
    if (!written) return 0;
    for (let qh = 0; qh < qt; qh++) {
      const i = queue[qh], x = i % S, s = src[i];
      if (x > 0 && src[i - 1] < 0) { src[i - 1] = s; queue[qt++] = i - 1; }
      if (x < S - 1 && src[i + 1] < 0) { src[i + 1] = s; queue[qt++] = i + 1; }
      if (i >= S && src[i - S] < 0) { src[i - S] = s; queue[qt++] = i - S; }
      if (i < n - S && src[i + S] < 0) { src[i + S] = s; queue[qt++] = i + S; }
    }
    for (const B of bufs) for (let i = 0; i < n; i++) {
      const s = src[i];
      if (s !== i) { B[i * 4] = B[s * 4]; B[i * 4 + 1] = B[s * 4 + 1]; B[i * 4 + 2] = B[s * 4 + 2]; B[i * 4 + 3] = B[s * 4 + 3]; }
    }
    // the inside flag back to 0 / 128 / 255 = none / the back face / both faces (it rode 64 / 128 / 255 so an unwritten
    // texel read 0; C4b: the cabin's buckets are inside on both faces, uInside.x)
    for (let i = 0; i < n; i++) { const a = A[i * 4 + 3]; A[i * 4 + 3] = a >= 192 ? 255 : a >= 96 ? 128 : 0; }
    return written / n;
  }

  // ---- THE MIPS, WITH TOKSVIG ----------------------------------------------------------------------------------------
  // levels[k] = { data, width, height } for T0 (albedo averaged in LINEAR light), T1 (the normal: the mean of the
  // level-0 unit vectors under the texel, renormalised; its length |n| is what the texel hides) and T2 (cc / rough /
  // metal / ccR averaged, rough and ccR widened by the normal variance: Karis' GGX form - a = r^2, a2 = a^2,
  // var = (1 - |n|) / |n|, B = 2 var (a2 - 1), a2' = (B - a2) / (B - 1), r' = a2'^(1/4)). A generator: a task's
  // worth of rows at a time.
  const LUTS = 'const S2L = new Float32Array(256); for (let i = 0; i < 256; i++) { const c = i / 255; S2L[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }\n' +
               'const L2S = new Uint8Array(4096); for (let i = 0; i < 4096; i++) { const c = i / 4095; L2S[i] = Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)); }';
  const { S2L, L2S } = new Function(LUTS + '\nreturn { S2L, L2S };')();
  function toksvig(r, len) {
    if (len >= 0.9999) return r;
    const v = Math.max(0, (1 - len) / Math.max(len, 1e-4) - 0.00004);
    const a = r * r, a2 = a * a, B = 2 * v * (a2 - 1);
    const a2b = Math.min(1, Math.max(a2, (B - a2) / (B - 1)));
    return Math.min(1, Math.sqrt(Math.sqrt(a2b)));
  }
  function* mipSteps(tex, S, out) {
    const L0 = tex.map(d => ({ data: d, width: S, height: S }));
    const lv = [[L0[0]], [L0[1]], [L0[2]]];
    // the chain averages the level-0 VALUES (the normals as unit vectors, never the renormalised ones; the albedo in
    // linear light): level 1 reads the bytes, every level past it the previous level's floats
    let nv = null, al = null, orm = null;
    const B0 = tex[0], B1 = tex[1], B2 = tex[2];
    let s = S, t0 = performance.now();
    while (s > 1) {
      const h = s >> 1, first = s === S;
      const nv2 = new Float32Array(h * h * 3), al2 = new Float32Array(h * h * 4), orm2 = new Float32Array(h * h * 4);
      const A = new Uint8Array(h * h * 4), N = new Uint8Array(h * h * 4), O = new Uint8Array(h * h * 4);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < h; x++) {
          const o = y * h + x, a = (2 * y) * s + 2 * x, b = a + 1, c = a + s, d = c + 1;
          if (first) {
            // each byte normal back to UNIT length first: 8-bit rounding shortens a vector by up to ~0.5 %, which the
            // variance below would read as ~0.3 of roughness on a glossy paint
            for (const p of [a, b, c, d]) {
              const ux = B1[p * 4] / 127.5 - 1, uy = B1[p * 4 + 1] / 127.5 - 1, uz = B1[p * 4 + 2] / 127.5 - 1, ul = 0.25 / (Math.hypot(ux, uy, uz) || 1);
              nv2[o * 3] += ux * ul; nv2[o * 3 + 1] += uy * ul; nv2[o * 3 + 2] += uz * ul;
            }
            for (let q = 0; q < 3; q++) al2[o * 4 + q] = 0.25 * (S2L[B0[a * 4 + q]] + S2L[B0[b * 4 + q]] + S2L[B0[c * 4 + q]] + S2L[B0[d * 4 + q]]);
            al2[o * 4 + 3] = (B0[a * 4 + 3] + B0[b * 4 + 3] + B0[c * 4 + 3] + B0[d * 4 + 3]) / 1020;
            for (let q = 0; q < 4; q++) orm2[o * 4 + q] = (B2[a * 4 + q] + B2[b * 4 + q] + B2[c * 4 + q] + B2[d * 4 + q]) / 1020;
          } else {
            for (let q = 0; q < 3; q++) nv2[o * 3 + q] = 0.25 * (nv[a * 3 + q] + nv[b * 3 + q] + nv[c * 3 + q] + nv[d * 3 + q]);
            for (let q = 0; q < 4; q++) { al2[o * 4 + q] = 0.25 * (al[a * 4 + q] + al[b * 4 + q] + al[c * 4 + q] + al[d * 4 + q]);
                                          orm2[o * 4 + q] = 0.25 * (orm[a * 4 + q] + orm[b * 4 + q] + orm[c * 4 + q] + orm[d * 4 + q]); }
          }
          const nx = nv2[o * 3], ny = nv2[o * 3 + 1], nz = nv2[o * 3 + 2], len = Math.hypot(nx, ny, nz) || 1e-6;
          A[o * 4] = L2S[Math.min(4095, Math.round(al2[o * 4] * 4095))]; A[o * 4 + 1] = L2S[Math.min(4095, Math.round(al2[o * 4 + 1] * 4095))];
          A[o * 4 + 2] = L2S[Math.min(4095, Math.round(al2[o * 4 + 2] * 4095))]; A[o * 4 + 3] = Math.round(al2[o * 4 + 3] * 255);
          N[o * 4] = Math.round((nx / len * 0.5 + 0.5) * 255); N[o * 4 + 1] = Math.round((ny / len * 0.5 + 0.5) * 255); N[o * 4 + 2] = Math.round((nz / len * 0.5 + 0.5) * 255); N[o * 4 + 3] = 255;
          const L = Math.min(1, len);
          O[o * 4] = Math.round(orm2[o * 4] * 255); O[o * 4 + 1] = Math.round(toksvig(orm2[o * 4 + 1], L) * 255);
          O[o * 4 + 2] = Math.round(orm2[o * 4 + 2] * 255); O[o * 4 + 3] = Math.round(toksvig(orm2[o * 4 + 3], L) * 255);
        }
        if (performance.now() - t0 > FB.sliceMs) { yield; t0 = performance.now(); }
      }
      lv[0].push({ data: A, width: h, height: h }); lv[1].push({ data: N, width: h, height: h }); lv[2].push({ data: O, width: h, height: h });
      nv = nv2; al = al2; orm = orm2; s = h;
    }
    out.levels = lv;
  }
  function drive(g) {
    return new Promise((res, rej) => {
      const step = () => { let r; try { r = g.next(); } catch (e) { rej(e); return; } if (r.done) res(r.value); else setTimeout(step, 0); };
      step();
    });
  }

  // ---- C4b (G877): THE BAKE'S CPU STAGES IN A WORKER ------------------------------------------------------------------
  // The unwrap (PARKED.unwrap: the weld, the charts, the packing - the bake's biggest single task), the dilation and the
  // mip chain run in a Blob worker made from these very functions' text (G569's decimator precedent: one source, the
  // page's own inline path the fallback - file://, a sandbox, the node census). The GL passes stay on the page: they
  // ARE the flown programs (three, AEROSKIN, the weathering, the decal atlas and its textures live on the page's
  // context), and with the asynchronous read-back they cost the page a few hundred draw calls and no stall. (An
  // OffscreenCanvas context in the worker would need that whole stack carried into it - three, AEROSKIN, AEROWX, ATMO's
  // hook, the decals' canvas textures - to issue draws the page issues in a few milliseconds.)
  function wkMain(e) {
    const d = e.data;
    try {
      if (d.op === 'unwrap') {
        const uw = unwrap(d.ext, { S: d.S, gutter: d.gutter });
        if (!uw) { self.postMessage({ id: d.id, uw: null }); return; }
        const r = { uv: uw.uv, idx: uw.idx, charts: uw.charts, axis: uw.axis, fill: uw.fill, density: uw.density };
        self.postMessage({ id: d.id, uw: r }, [r.uv.buffer, r.idx.buffer]);
      } else if (d.op === 'finish') {
        const t0 = Date.now(), cov = d.dilate ? dilate(d.tex, d.S) : 1, t1 = Date.now();
        const mo = {}, g = mipSteps(d.tex, d.S, mo);
        while (!g.next().done) { /* no slices: this thread has nothing else to do */ }
        const bufs = new Set(); for (const lv of mo.levels) for (const L of lv) bufs.add(L.data.buffer);
        self.postMessage({ id: d.id, cov, levels: mo.levels, ms: { dilate: t1 - t0, mips: Date.now() - t1 } }, [...bufs]);
      }
    } catch (err) { self.postMessage({ id: d.id, error: String(err && err.stack || err) }); }
  }
  // the worker's whole text: no closure crosses (GATE FLOWNBAKE runs it alone and compares it with the page's answers)
  function workerSource() {
    return [LUTS, 'const BAKE = { S: ' + FB.S + ', gutter: ' + FB.gutter + ' };', 'const FB = { sliceMs: 1e9 };',
            'const unwrap = ' + W.PARKED.unwrap.toString() + ';', toksvig.toString(), dilate.toString(), mipSteps.toString(),
            'self.onmessage = ' + wkMain.toString() + ';'].join('\n');
  }
  let WK = null;
  function worker() {
    if (WK !== null) return WK;
    WK = false;
    try {
      if (!FB.worker || typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL ||
          !W.PARKED || !W.PARKED.unwrap) return WK;
      const url = URL.createObjectURL(new Blob([workerSource()], { type: 'text/javascript' }));
      const w = new Worker(url), pend = new Map();
      let id = 0;
      const fail = why => { for (const q of pend.values()) q.rej(new Error(why)); pend.clear(); WK = false; try { w.terminate(); } catch (e) {} };
      w.onmessage = e => { const q = pend.get(e.data.id); if (!q) return; pend.delete(e.data.id); if (e.data.error) q.rej(new Error(e.data.error)); else q.res(e.data); };
      w.onerror = e => fail((e && e.message) || 'the worker failed');
      WK = { call: (msg, tr) => new Promise((res, rej) => { msg.id = ++id; pend.set(msg.id, { res, rej }); w.postMessage(msg, tr || []); }), kill: () => fail('stopped') };
    } catch (e) { WK = false; }
    return WK;
  }
  // the unwrap of a set's groups: in the worker (the soup's arrays go over), else on the page in one task
  async function unwrapOff(list, S, G, t) {
    let ext = extOf(list);
    const nt = ext.nt, Wk = worker();
    if (Wk) {
      try {
        const r = await Wk.call({ op: 'unwrap', ext: { pos: ext.pos, nrm: ext.nrm, idx: ext.idx, nt: ext.nt, bb: ext.bb }, S, gutter: G },
                                [ext.pos.buffer, ext.nrm.buffer, ext.idx.buffer]);
        t.thread = 'worker';
        return { uw: r.uw, nt };
      } catch (e) { console.warn('flown bake: the worker could not unwrap, the page does -', e && e.message || e); ext = extOf(list); }
    }
    t.thread = 'page';
    return { uw: W.PARKED.unwrap(ext, { S, gutter: G }), nt };
  }
  // the gutters and the mips: in the worker (the three passes go over and come back as the chains), else on the page,
  // the mips a slice at a time. Null when the worker failed with the passes in its hands.
  async function finishOff(tex, S, dil, t) {
    const Wk = worker();
    if (Wk) {
      try {
        const r = await Wk.call({ op: 'finish', tex, S, dilate: dil }, tex.map(b => b.buffer));
        if (dil) t.dilate = r.ms.dilate;
        t.mips = r.ms.mips;
        return { cov: r.cov, levels: r.levels };
      } catch (e) { console.warn('flown bake: the worker could not finish the maps -', e && e.message || e); return null; }
    }
    let t0 = performance.now();
    const cov = dil ? dilate(tex, S) : 1;
    if (dil) t.dilate = Math.round(performance.now() - t0);
    t0 = performance.now();
    const mo = {}; await drive(mipSteps(tex, S, mo));
    t.mips = Math.round(performance.now() - t0);
    return { cov, levels: mo.levels };
  }

  // ---- THE RUNTIME MATERIAL ------------------------------------------------------------------------------------------
  // the clear coat on the perturbed normal (G206), its roughness from T2.A (three's own clamps and geometryRoughness),
  // and the cabin's darkness + the footwell on the back faces the albedo's A flags (AERO_CABIN_FS, uInside.y per texel)
  // G1350 THE RIBS AT A LOW SUN (LIGHT-SMOOTH, 2026-10-03; the user: "clear stripes across the wings and tail" of the
  // stock Cub at golden hour, read as banded self-shadow). Measured in the page: the stripes stay with the craft's
  // receiveShadow OFF and with the cascade's bias x20, and they go with this bake's normalScale 0 - they are the BAKED
  // NORMAL MAP's rib tapes and stitching. Under a sun that grazes the skin (N.L 0.14 on a wing at 8 deg) a tape's two
  // flanks tilt to N.L ~0.3 and ~0, so a millimetre of relief became a lit / black band a rib apart. The relief now
  // fades with the geometric normal's angle to the sun: full above N.L 0.5 (every sun over ~30 deg on a wing, so noon
  // is untouched), down to uFbGraze (0.25) of itself at a grazing sun. The sun is directional light 0 (the near map's
  // black light shares its direction). FLOWN_BAKE graze 1 is the old relief.
  FB_U.uFbGraze = { value: 0.25 };
  // G1358 THE GLINT, A LITTLE LESS (LIGHT-SMOOTH, 2026-10-04; the user, on the one-frame white flash off the wing in
  // flight and the blown fuselage patch at golden hour: "try a little less, ok"). The clear coat's roughness floor is
  // 0.0525 (G206, below): a sun highlight a fraction of a degree wide, so a flat wing or a fuselage side passing the
  // mirror angle went white for a frame and the bloom spread it. For the SUN's direct light only, the base and the
  // clear coat take a floor of uFbSun round the direct loop (lights_fragment_begin) and get their own roughness back
  // before the environment's reflection (lights_fragment_maps / _end): the sky, the hangar and the ground reflect in
  // the skin exactly as before - the aeroplane is not made matte, its sun glint is wider and lower. A uniform, so no
  // new program; FLOWN_BAKE.sunRough.value 0 is the old glint.
  FB_U.uFbSun = { value: 0.12 };
  const FB_HOOK = function (sh) {
    if (typeof ATMO !== 'undefined') ATMO.inject(sh);
    sh.uniforms.uFbGraze = FB_U.uFbGraze; sh.uniforms.uFbSun = FB_U.uFbSun;
    const d = this.userData.aeroD;
    if (d) for (const k of ['uCraftInv', 'uCabin', 'uFootA', 'uFootB']) if (d[k]) sh.uniforms[k] = d[k];
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', 'uniform mat4 uCraftInv;\nvarying vec3 vFbCraft;\n#include <common>')
      .replace('#include <project_vertex>', 'vFbCraft = (uCraftInv * modelMatrix * vec4(transformed, 1.0)).xyz;\n#include <project_vertex>');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', 'uniform float uFbGraze;\nuniform float uFbSun;\nuniform mat4 uCraftInv;\nuniform vec4 uCabin;\nuniform vec4 uFootA;\nuniform vec4 uFootB;\nvarying vec3 vFbCraft;\n#include <common>')
      .replace('#include <map_fragment>', '#include <map_fragment>\n  float fbIn = sampledDiffuseColor.a;\n  diffuseColor.a = opacity;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n#if defined( USE_NORMALMAP ) && ( NUM_DIR_LIGHTS > 0 )\n  normal = normalize( mix( nonPerturbedNormal, normal, mix( uFbGraze, 1.0, smoothstep( 0.0, 0.5, abs( dot( nonPerturbedNormal, directionalLights[ 0 ].direction ) ) ) ) ) );\n#endif')
      .replace('#include <clearcoat_normal_fragment_begin>', '#ifdef USE_CLEARCOAT\n  vec3 clearcoatNormal = normal;\n#endif')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\n  material.clearcoatRoughness = min(max(texture2D(clearcoatMap, vClearcoatMapUv).a, 0.0525) + geometryRoughness, 1.0);\n#endif')
      .replace('#include <lights_fragment_begin>', '  float fbR0 = material.roughness; material.roughness = max(fbR0, uFbSun);\n#ifdef USE_CLEARCOAT\n  float fbC0 = material.clearcoatRoughness; material.clearcoatRoughness = max(fbC0, uFbSun);\n#endif\n#include <lights_fragment_begin>\n  material.roughness = fbR0;\n#ifdef USE_CLEARCOAT\n  material.clearcoatRoughness = fbC0;\n#endif')
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  {
    float fbInK = max(clamp(2.0 * fbIn - 1.0, 0.0, 1.0), min(1.0, 2.0 * fbIn) * step(faceDirection, 0.0));   // both faces | the back
    float fbCab = 1.0 - uCabin.x * fbInK;
    float fbFdK = clamp((uFootA.z - vFbCraft.z) / max(uFootA.z - uFootA.w, 0.05), 0.0, 1.0);
    float fbFx = 1.0 - smoothstep(uFootA.x, uFootA.x + uFootB.y, abs(vFbCraft.x));
    float fbFz = 1.0 - smoothstep(uFootA.z - 0.08, uFootA.z, vFbCraft.z);
    float fbFy = 1.0 - smoothstep(uFootA.y, uFootA.y + mix(uFootB.z, uFootB.w, fbFdK), vFbCraft.y);
    fbCab *= 1.0 - uFootB.x * fbFx * fbFy * fbFz * (0.5 + 0.5 * fbFdK) * fbInK;
    reflectedLight.directDiffuse *= fbCab; reflectedLight.indirectDiffuse *= fbCab;
    reflectedLight.directSpecular *= fbCab; reflectedLight.indirectSpecular *= fbCab;
  }`);
  };
  FB_HOOK.toString = () => 'flown.baked|' + FB.V;
  // ---- THE HYBRID (2026-09-30, the user: "either we do higher res texture, or we go back" - then option b, "the hybrid,
  // if you can do that clean and the normal performance is OK, and the transition is seamless visually and performance
  // wise"). Close up a texel of the atlas (0.7-0.8 cm) covers several pixels: the livery's stripes and the letters
  // stair-step and the skin goes soft, where the live shader draws them per pixel. So the flown aeroplane keeps BOTH:
  // the folds on the bake (C4b's handful of draws) and its live meshes on the fold's own arrays (the keep path the
  // cabin already had: hidden, the rigs' writes land in both), on copies of their live materials. ONE number says which
  // is drawn - t, from the pixels a texel covers at the aeroplane (nearT: the ext atlas's cm, the camera's distance, its
  // fov, the drawing buffer's height): 0 the bake (far, the default chase), 1 the live shader (the close chase, the
  // cockpit), between them a DITHERED band (A2-FADES' interleaved gradient, fixed on the screen): each fragment of the
  // bake stays where the noise is >= t, each of the live copy where it is < t - one surface, no pop, no double blend.
  // Outside the band only one of the two is drawn at all (the folds or the live meshes hidden).
  const FB_FADE = { value: 0 };
  const FADE_N = 'fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))';
  const fadeFs = (fs, live) => fs.replace('#include <common>', '#include <common>\nuniform float uFbFade;')
    .replace(/void\s+main\s*\(\s*\)\s*\{/, mm => mm + (live ? '\n  if (uFbFade > 0.0 && uFbFade < 1.0 && ' + FADE_N + ' >= uFbFade) discard;'
                                                        : '\n  if (uFbFade > 0.0 && uFbFade < 1.0 && ' + FADE_N + ' < uFbFade) discard;'));
  // (each side discards only INSIDE the band: outside it the one not wanted is hidden, and a model whose fold failed
  // draws its live meshes whole)
  // G1123: THE DISCARD ONLY IN THE BAND'S OWN PROGRAMS. A shader that CAN discard loses the GPU's early depth test
  // wherever it draws, discard taken or not: with the band's discard in the baked program the taxi's render rose 0.4-0.9
  // ms at t = 0 (rollout_perf, three alternated pairs, the metal Cessna, the bake drawn alone). So the baked program is
  // C4b's, the live copies run their pool's own program, and each has a BAND TWIN (bandOf: the same material, the
  // discard added) that a fold's meshes wear only while 0 < t < 1 (out.fade swaps them in and back) - compiled and drawn
  // once under the craft step's screen with the rest (warmPairs).
  const FB_BAND_HOOK = function (sh, r) { FB_HOOK.call(this, sh, r); sh.uniforms.uFbFade = FB_FADE; sh.fragmentShader = fadeFs(sh.fragmentShader, false); };
  FB_BAND_HOOK.toString = () => 'flown.baked.band|' + FB.V;
  const BANDS = new WeakMap();
  function copyMat(m, hook, name, tag) {
    let c;
    const ud = m.userData; m.userData = {};
    try { c = new m.constructor(); c.copy(m); } finally { m.userData = ud; }
    c.userData = Object.assign({}, ud, tag);
    if (m.defines) c.defines = Object.assign({}, m.defines);
    for (const k of ['clearcoat', 'clearcoatRoughness', 'transmission', 'envMapIntensity']) if (m[k] !== undefined && c[k] !== undefined) c[k] = m[k];
    if (hook) c.onBeforeCompile = hook;   // (none: the prototype's, as the material's own)
    c.name = name;
    c.needsUpdate = true;
    return c;
  }
  function bandOf(m) {
    if (!m || !m.isMaterial) return m;
    let b = BANDS.get(m);
    if (b) return b;
    b = m.userData && m.userData.flownBaked ? copyMat(m, FB_BAND_HOOK, (m.name || 'flown:baked') + ':band', { flownBand: 1 })
                                           : copyMat(m, liveHook(hookOf(m)), (m.name || 'aeroskin') + ':band', { flownBand: 1 });
    BANDS.set(m, b);
    return b;
  }
  // the live copies: the material as the live build made it on its own hook (its pool's program); the band's discard
  // is its band twin's (liveHook)
  const LIVE_WRAP = new Map(), TWINS = new WeakMap();
  function liveHook(h) {
    let w = LIVE_WRAP.get(h);
    if (w) return w;
    w = function (sh, r) { if (h) h.call(this, sh, r); sh.uniforms.uFbFade = FB_FADE; sh.fragmentShader = fadeFs(sh.fragmentShader, true); };
    w.toString = () => 'flown.live|' + (h ? h.toString() : '');
    LIVE_WRAP.set(h, w);
    return w;
  }
  // a pooled live material's copy for the hybrid's kept meshes (its own: the pool's is shared with what never bakes -
  // a spinner on the same finish must not dither out)
  // (G1124: one copy per ZONE - the eye's and the far's - so G576's still merge never folds the two zones together)
  const POOL = new WeakMap();
  function liveTwin(m, zone) {
    if (!m || !m.isMaterial) return m;
    zone = zone || 'far';
    let z = TWINS.get(m);
    if (!z) TWINS.set(m, z = {});
    if (z[zone]) return z[zone];
    const c = copyMat(m, hookOf(m), (m.name || 'aeroskin') + ':live' + (zone === 'far' ? '' : ':' + zone), { flownLive: 1, flownZone: zone });
    POOL.set(c, m); z[zone] = c;
    return c;
  }
  // G1124 (b) THE EYE'S ZONE: the exterior's kept meshes whose sphere comes within FB.eyeR of the cabin's (the cockpit's
  // own buckets, in the model group's frame) - the cowl, the windscreen's frame, the wing's centre and its top, the
  // doors; the rest (the rear fuselage, the tail, the outer wing, the gear) is the FAR zone. Each zone folds apart; in
  // the cockpit only the eye's is live (the far zone is 3-8 m off, where the bake's texel is near a pixel)
  function eyeZone(THREE, grp, cab, ext) {
    const eye = [], far = [];
    // (G1124.4: no split under the fallback - the eye's zone is never live there, and the split's extra folds, plain and
    // skinned on the one baked material, interleaved their programs in the sort: +2 program switches a frame in the cockpit)
    if (!FB.eyeOnly || !FB.cockpitLive || !cab || !cab.length) return { eye, far: ext.slice() };
    grp.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(grp.matrixWorld).invert(), M = new THREE.Matrix4(), s = new THREE.Sphere(), all = new THREE.Sphere();
    const sph = m => { const g = m.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); return s.copy(g.boundingSphere).applyMatrix4(M.multiplyMatrices(inv, m.matrixWorld)); };
    let n = 0;
    for (const m of cab) { const q = sph(m); if (n++) all.union(q); else all.copy(q); }
    const R = all.radius + FB.eyeR;
    for (const m of ext) { const q = sph(m); (q.center.distanceTo(all.center) - q.radius < R ? eye : far).push(m); }
    for (const m of eye) m.material = liveTwin(POOL.get(m.material) || m.material, 'eye');
    FB.eyeZoneN = { eye: eye.length, far: far.length, r: +R.toFixed(2) };
    return { eye, far };
  }
  // G1124 (a) THE SHADOWS FROM THE FOLDS, ALWAYS: the same arrays, so the same shadow as C4b's - and the fold's handful of
  // casters instead of the live meshes' hundreds. three builds the main pass's lists BEFORE its shadow pass (and tests a
  // caster's layers against the MAIN camera: SHADOW-EYES G1080.2), so the swap is visibility, made where the pass
  // starts: the near light's updateMatrices (the craft's map; the far map never draws the craft, G1080.2) shows the folds
  // and hides the live meshes, and the next frame's hybrid() puts them back before its main pass.
  let casting = false, castL = null, FOLD_CASTS = false;
  // (G1124.2: the EXTERIOR's folds only - the cabin casts as C4b did, its live meshes at arm's length in the cockpit and
  // its fold stale while hidden: swapping it made the cabin fold upload its rigs' writes every frame in the cockpit)
  function shadowFolds(on) { if (on === casting) return; casting = on; for (const F of FOLDS) if (F.shadowSwap && F.set !== 'in') F.shadowSwap(on); }
  function hookShadow() {
    if (!FB.shadowFolds || (castL && castL.parent)) return;
    const SN = W.SHADOW_NEAR, sc = SN && SN.C1 && SN.C1.scene;
    const L = sc && sc.getObjectByName ? sc.getObjectByName('sunNear') : null;
    if (!L || !L.shadow || typeof L.shadow.updateMatrices !== 'function') return;
    castL = L; FOLD_CASTS = true;
    const sh = L.shadow, um = sh.updateMatrices;
    sh.updateMatrices = function () { if (FB.shadowFolds && FB.hybrid) shadowFolds(true); return um.apply(this, arguments); };
  }
  // t for a camera looking at a point: the screen pixels one texel of the exterior's atlas covers there, through the band
  const _hyP = { x: 0, y: 0, z: 0 };
  function nearT(cam, P, H) {
    const M = MEMS.ext, cm = M && M.stats && M.stats.cm;
    if (!FB.hybrid || !(cm > 0) || !cam || !cam.isPerspectiveCamera || !(H > 0)) return 0;
    const e = cam.matrixWorld.elements, d = Math.max(0.05, Math.hypot(e[12] - P.x, e[13] - P.y, e[14] - P.z));
    const px = 2 * d * Math.tan(cam.fov * Math.PI / 360) / (cam.zoom || 1) / H;
    const mag = cm / 100 / px;
    FB.hyMag = mag;
    if (FB.hyEase > 0) return eased(mag);
    return Math.min(1, Math.max(0, (mag - FB.hyA) / (FB.hyB - FB.hyA)));
  }
  // G1494 (?fbake=hyease[=s], off by default) THE BAND IN TIME. The chase taxi stands at 1.05-1.12 px a texel: INSIDE
  // G1325's 1.0-1.25 band, so every frame draws BOTH surfaces, each on its discarding band twin (no early-Z) - rollout_perf:
  // ~0.85 ms render over the live aeroplane alone, and a still dither on the skin. Here the band is a DISSOLVE: the live
  // shader is wanted from hyA (back to the bake under hyA x hyEaseLo: no flicker on the edge) and t walks to it over hyEase
  // seconds - the dither only while it walks; a steady distance draws one surface. rest() starts it at the bake.
  const HE = { t: 0, go: 0, at: 0 };
  function eased(mag) {
    const now = performance.now(), dt = HE.at ? Math.min(0.1, (now - HE.at) / 1000) : 0;
    HE.at = now;
    if (mag >= FB.hyA) HE.go = 1; else if (mag < FB.hyA * (FB.hyEaseLo || 0.9)) HE.go = 0;
    const s = dt / FB.hyEase;
    HE.t += Math.max(-s, Math.min(s, HE.go - HE.t));
    return HE.t;
  }
  // every frame (app.js): t (1 in the cockpit), then the folds and their live meshes shown by it - once per change
  // (G1124: tEye for the cabin and the eye's zone - the cockpit gives 1 there and 0 to the far zone; the chase one t)
  // ?fbake=warmfree (the cockpit's +0.6 ms isolation): once the craft step's warm draw is done, every geometry it drew
  // (the folds and their views) disposed - their buffers and vertex arrays freed, and made again by the next frame
  // that draws one - so only what the frame draws stays resident: a cost that goes with it is residency, not first draws
  let warmFreed = false;
  function warmFree() {
    warmFreed = true; const seen = new Set();
    for (const F of FOLDS) for (const [o] of (F.pairs ? F.pairs() : [])) { const g = o && o.geometry; if (g && !seen.has(g)) { seen.add(g); g.dispose(); } }
    if (W.__hyWarm) W.__hyWarm.freed = seen.size;
  }
  function hybrid(t, tEye) {
    if (FB.warmFree && !warmFreed && W.__hyWarm && W.__hyWarm.drawn != null) warmFree();
    shadowFolds(false); hookShadow();         // (G1124 a: last frame's shadow swap put back before this frame's main pass)
    if (FB.hyForce != null) t = tEye = FB.hyForce;   // the rigs' hold (FB.hyForce, ?fbake=hy=0.5): a number, or null for the rule
    if (tEye == null) tEye = t;
    // G1124.1 THE FALLBACK: where the caller gives the eye more than the rest (the cockpit: app.js hybrid(0, 1)), the CABIN
    // takes it (live at arm's length, as C4b) and the eye's zone stays with the rest on the bake - unless FB.cockpitLive
    let tIn = tEye;
    if (!FB.cockpitLive && FB.hyForce == null && tEye > t) { tIn = tEye; tEye = t; }
    const q = x => x <= 0.002 ? 0 : x >= 0.998 ? 1 : x;
    t = q(t); tEye = q(tEye); tIn = q(tIn);
    FB_FADE.value = t > 0 && t < 1 ? t : tEye > 0 && tEye < 1 ? tEye : tIn;
    FB.hyT = t; FB.hyTEye = tEye; FB.hyTIn = tIn;
    for (const F of FOLDS) if (F.fade) F.fade(F.set === 'in' ? tIn : F.zone === 'eye' ? tEye : t);
    return t;
  }
  // G1490 HYBRID-TRIPS: THE HYBRID IS A FLIGHT STATE. Only the flight's loop sets t (app.js, every frame); the shed never
  // does - so the craft went back into the room as the last flight frame left it: inside the band (G1325's 1.0-1.25 px
  // put the taxi's chase at t 0.33-0.48) every flown mesh wore its BAND TWIN and the live views stood in the graph. The
  // shed and the next roll-out's shot then drew that model in the HANGAR's lights (five shadowed lamps, the craft's own:
  // spotLights[6], spotShadowMap[5]) - programs no compile ever keyed, linked in the shot's first frame (round trip 2:
  // five band twins, 5.2 s in one task). The way back puts it AT REST: t 0, the folds on their own baked material, the
  // live meshes parked - the model the shed's compiles and the shot have always been keyed for (the band 1.6-2.0's
  // taxi already left it so). The next flight frame sets t again, on the programs the craft step warmed in the world.
  function rest() {
    if (FB.noRest) return;
    HE.t = HE.go = HE.at = 0;   // (G1494's dissolve starts at the bake too)
    shadowFolds(false);
    FB_FADE.value = 0; FB.hyT = FB.hyTEye = FB.hyTIn = 0;
    for (const F of FOLDS) if (F.fade) F.fade(0);
  }
  function materialOf(THREE, d, set) {
    const mk = (lv, srgb) => {
      const t = new THREE.DataTexture(lv[0].data, d.S, d.S, THREE.RGBAFormat, THREE.UnsignedByteType);
      t.mipmaps = lv; t.generateMipmaps = false;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.flipY = false; t.channel = 1;
      t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      t.anisotropy = W.FLYDIY_ANISO || 8;
      t.needsUpdate = true;
      // the CPU copies go once the GPU has them (~64 MB a build; the cache write holds its own reference to level 0)
      if (!FB.keepCpu) t.onUpdate = () => { for (const L of t.mipmaps) L.data = null; t.image = { data: null, width: d.S, height: d.S }; t.onUpdate = null; };
      return t;
    };
    const map = mk(d.levels[0], true), nmap = mk(d.levels[1], false), orm = mk(d.levels[2], false);
    const o = { map, normalMap: nmap, normalMapType: THREE.TangentSpaceNormalMap, roughnessMap: orm, metalnessMap: orm,
                roughness: 1, metalness: 1, side: THREE.DoubleSide };
    const mat = d.cc ? new THREE.MeshPhysicalMaterial(Object.assign(o, { clearcoat: 1, clearcoatMap: orm, clearcoatRoughness: 1 }))
                     : new THREE.MeshStandardMaterial(o);
    mat.name = set === 'in' ? 'flown:baked:in' : 'flown:baked';
    mat.userData.flownBaked = 1;
    mat.userData.aeroD = W.AEROSKIN.aeroSharedU(THREE);   // the craft frame, the cabin, the footwell: the flight's own block
    mat.onBeforeCompile = FB_HOOK;
    return mat;
  }
  let bytes = 0;
  const gpuBytes = lv => lv.reduce((s, L) => s + L.data.length, 0);

  // ---- IndexedDB: the last FB.keep builds ------------------------------------------------------------------------------
  const DB = { name: 'flydiy.flown', store: 'bake', p: null };
  function db() {
    if (DB.p) return DB.p;
    DB.p = new Promise((res, rej) => {
      try {
        const rq = indexedDB.open(DB.name, 1);
        rq.onupgradeneeded = () => { const d = rq.result; if (!d.objectStoreNames.contains(DB.store)) d.createObjectStore(DB.store); };
        rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
      } catch (e) { rej(e); }
    });
    return DB.p;
  }
  async function squeeze(u8) {
    if (typeof CompressionStream === 'undefined') return u8;
    try { return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()); } catch (e) { return u8; }
  }
  async function unsqueeze(v, n) {
    if (v && v.length === n) return v;
    return new Uint8Array(await new Response(new Blob([v]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  }
  const idb = (mode, fn) => db().then(d => new Promise((res, rej) => { const tx = d.transaction(DB.store, mode); const r = fn(tx.objectStore(DB.store)); tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error); }));
  async function cacheGet(ck) {
    try { return (await idb('readonly', st => st.get(ck))) || null; } catch (e) { return null; }
  }
  async function cachePut(ck, rec) {
    const v = { ck, when: Date.now(), S: rec.S, cc: rec.cc, sig: rec.sig, stats: rec.stats,
                tex: await Promise.all(rec.tex.map(squeeze)), uv: await squeeze(new Uint8Array(rec.uv.buffer, rec.uv.byteOffset, rec.uv.byteLength)) };
    await idb('readwrite', st => st.put(v, ck));
    // the last FB.keep builds stay (a record an atlas: the outside and the cabin)
    const all = await idb('readonly', st => st.getAllKeys());
    if (all && all.length > FB.keep * SETS.length) {
      const whens = await Promise.all(all.map(k => idb('readonly', st => st.get(k)).then(r => [k, r ? r.when : 0])));
      whens.sort((a, b) => a[1] - b[1]);
      for (const [k] of whens.slice(0, whens.length - FB.keep * SETS.length)) await idb('readwrite', st => st.delete(k));
    }
  }

  // ---- the payload's bake: what buildModel reads -------------------------------------------------------------------------
  // BAKED: payload -> { key, names: Map(name -> set), mats: { ext, in }, uv: Map(group -> Uint16Array), inner: Set(group),
  // stats }. MEMS: per set, the last bake (the round trip's reuse); OLD: the materials they replaced, freed after the
  // rebuild.
  const BAKED = new WeakMap();
  const BUILT_LIVE = new WeakSet();     // payloads a model was built from without their bake
  const LIVE = [];                      // the A/B dial: [mesh, live material, baked material] of the current build
  const MEMS = {}, OLD = [];
  const sigOk = (sig, list) => !!sig && sig.length === list.length && sig.every((n, i) => n === list[i].g.pos.length / 3);
  function remember(set, key, mat, stats, list) {
    const M = MEMS[set];
    if (M && M.mat !== mat) OLD.push(M.mat);
    MEMS[set] = { key, mat, stats, uvs: list.map(e => e.uv), sig: list.map(e => e.g.pos.length / 3) };
  }
  function attach(vis, jobs, res, key) {
    const names = new Map(), uv = new Map(), inner = new Set(), mats = {}, stats = {};
    for (const j of jobs) {
      const r = res[j.set];
      if (!r) continue;                  // a set that did not bake flies its live shader
      mats[j.set] = r.mat; stats[j.set] = r.stats;
      for (const e of j.list) { names.set(e.k, j.set); uv.set(e.g, e.uv); if (j.set === 'in') inner.add(e.g); }
    }
    BAKED.set(vis, { key, names, mats, uv, inner, stats });
  }
  function freeOld() {
    for (const M of OLD.splice(0)) {
      for (const k of ['map', 'normalMap', 'roughnessMap']) if (M[k]) M[k].dispose();
      M.dispose();
    }
  }
  // buildModel's door: null = fly the live shader
  function forPayload(vis) {
    if (!vis || !vis.cage) return null;
    const b = BAKED.get(vis);
    if (!b || W.FLYDIY_FLOWN_BAKE === 0 || !FB.on) { BUILT_LIVE.add(vis); return null; }
    LIVE.length = 0; FOLDS.length = 0;
    const baked = new Set(Object.values(b.mats));
    return {
      mat: b.mats.ext || null, mats: b.mats, ab: !!FB.ab,
      has: name => b.names.has(name),
      // the cabin's buckets keep their live material on their own meshes (the cockpit view) and fold on the 'in' one
      inner: name => b.names.get(name) === 'in',
      innerGroup: g => b.inner.has(g),
      // THE HYBRID: every baked bucket keeps its live mesh (on a live copy of its material) and folds onto the bake
      hybrid: !!FB.hybrid && !FB.ab,
      live: name => b.names.get(name) === 'in' || (!!FB.hybrid && !FB.ab && b.names.has(name)),
      liveGroup: g => b.inner.has(g) || (!!FB.hybrid && !FB.ab && b.uv.has(g)),
      twin: liveTwin,
      matOf: name => b.mats[b.names.get(name)] || null,
      baked: m => baked.has(m),
      uv: g => b.uv.get(g) || null,
      // the A/B build: the live twin, and the cavity its shader reads (the flight's cavity pass skips a baked mesh)
      made: (mesh, liveMat) => {
        if (!FB.ab) return;
        LIVE.push([mesh, liveMat, mesh.material]);
        const WX = (typeof W.AEROWX !== 'undefined') ? W.AEROWX : null;
        if (WX && WX.aeroWxBakeCavity) WX.aeroWxBakeCavity(W.THREE, mesh.geometry, (liveMat.userData || {}).aeroFieldM || 1);
      },
    };
  }
  function show(on) {
    let n = 0;
    for (const [mesh, live, bm] of LIVE) { mesh.material = on ? bm : live; n++; }
    return n;
  }
  // C4b's A/B (`?fbake=foldab`: every fold keeps its members, on the same arrays): true = the folds (C4b), false = the
  // meshes they fold (C4a's draws: the exterior's baked meshes, the cabin's live ones), null = the cockpit's rule again;
  // `only` ('ext' | 'in') flips one atlas's folds.
  // Returns how many members flipped.
  const FOLDS = [];
  function showFold(on, only) {
    let n = 0;
    for (const F of FOLDS) { if (only && F.set !== only) continue; F.held = on !== null; if (on !== null) F.apply(!on); n += F.live.length; }
    return n;
  }

  // ---- C4b (G875): THE ONE-MATERIAL MODEL - every baked mesh of the build folded into a handful of draws ------------
  // A baked mesh reads position, normal and its atlas uv, on ONE material: nothing but its motion keeps it a draw of its
  // own. Two kinds of motion, two answers:
  //   THE VERTICES A RIG WRITES (the flex, the hinges, the struts, the legs, the links, the anchors, the floats - all of
  //   poseModel's per-vertex rigs, on the CPU as before): each baked mesh's position and normal arrays become VIEWS into
  //   one merged buffer, so a rig writes straight into what is drawn (the attribute objects the rigs hold are the same
  //   ones, only their arrays moved); each frame the ranges whose attribute's version moved are flagged on the merged
  //   buffer (written buckets first, so they are one range) - no copy, the upload the per-bucket buffers made before.
  //   THE PARTS THAT MOVE AS A WHOLE (a wheel, the castor, an engine unit, a surface's pivot group - anything the build
  //   hangs under its own Object3D): a BONE each. The merged mesh is a SkinnedMesh; a vertex has one bone at weight 1;
  //   a bone's matrix is its part's transform relative to the model group (poseRigid's hand-set matrix where it wrote
  //   one, else position / quaternion / scale), composed on the CPU in double every frame - small numbers, so float32 on
  //   the GPU is exact enough - with the bind matrix the identity (bindMode 'detached'). Three's own skinning is used, so
  //   every depth pass (the sun's cascades, the craft's cascade, an override material) and the raycast skin it too.
  // The meshes the model group itself holds need no bone: they fold into a plain Mesh (no skinning in the vertex
  // shader for the fuselage's hundred thousand vertices). The keys that split a fold: moves (skinned) or not, G564's
  // crumb class as the roll-out will read it (a crumb casts nothing after the roll-out; a wheel's part over 4 cm casts:
  // G1005) - so the shadows are the ones C4a cast - and the draw state (castShadow, receiveShadow, renderOrder, layers).
  // Not folded (each for a reason the code states): a mesh with children, its own callbacks or userData, a pose of its
  // own (not the rest transform), other attributes, or a hidden ancestor. The A/B build folds nothing (its live twins
  // flip per mesh). `window.FLYDIY_FLOWN_MERGE = 0` before a build is the dial.
  // opt.keep (THE CABIN, 'in'): the members are the LIVE meshes (their own material, every live attribute, plus uv1);
  // they stay where they are, hidden, and the fold draws them on the baked cabin material - until the cockpit view, which
  // flies the live shader at arm's length (the fold's view(on)). Their arrays are views into the fold's as well, so
  // whichever is drawn draws the rigs' latest.
  const I16 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const atRest = m => m.position.x === 0 && m.position.y === 0 && m.position.z === 0 &&
    m.quaternion.x === 0 && m.quaternion.y === 0 && m.quaternion.z === 0 && m.quaternion.w === 1 &&
    m.scale.x === 1 && m.scale.y === 1 && m.scale.z === 1 && (m.matrixAutoUpdate || m.matrix.elements.every((v, i) => v === I16[i]));
  function mergeModel(THREE, grp, mat, opt) {
    if (!mat || FB.ab || W.FLYDIY_FLOWN_MERGE === 0 || !THREE.SkinnedMesh || !THREE.BufferGeometry || !grp || !grp.traverse) return null;
    const o = opt || {}, wheel = o.wheel || new Set(), written = o.written || new Set();
    const CR = o.crumb != null ? o.crumb : 0.15, WR = o.wheelCrumb != null ? o.wheelCrumb : 0.04;
    const keep = !!o.keep || !!FB.foldAB, subs = o.members ? o.members.slice() : [], set = o.set || (o.keep ? 'in' : 'ext'), zone = o.zone || null;
    // G1170 (o.views, the hybrid's exterior): the live side drawn as VIEWS on the fold's own geometry - see below
    const VIEWS = !!o.views && keep && !FB.foldAB;
    if (!o.members) grp.traverse(m => { if (m.isMesh && m.material === mat) subs.push(m); });
    const skip = {}, why = k => { skip[k] = (skip[k] || 0) + 1; };
    const folds = new Map();
    for (const m of subs) {
      const g = m.geometry, at = g && g.attributes;
      if (m.isSkinnedMesh || m.isInstancedMesh || !g || !g.index || !at.position || !at.normal || !at.uv1 || (!keep && Object.keys(at).length !== 3) ||
          g.groups.length || (g.morphAttributes && Object.keys(g.morphAttributes).length) ||
          at.position.isInterleavedBufferAttribute || at.normal.isInterleavedBufferAttribute) { why('attributes'); continue; }
      if (!keep && (m.children.length || Object.keys(m.userData).length || Object.prototype.hasOwnProperty.call(m, 'onBeforeRender') ||
          m.customDepthMaterial || m.customDistanceMaterial)) { why('own'); continue; }
      if (!atRest(m)) { why('posed'); continue; }
      let p = m.parent, shown = m.visible;
      while (p && p !== grp) { if (!p.visible) shown = false; p = p.parent; }
      if (!p) { why('outside'); continue; }
      if (!shown) { why('hidden'); continue; }
      if (!g.boundingSphere) g.computeBoundingSphere();
      const r = g.boundingSphere.radius;
      const crumb = m.castShadow && r < CR && !(wheel.has(m) && r >= WR);
      const moves = m.parent !== grp;
      const k = [moves ? 'bone' : 'rest', crumb ? 'crumb' : '', m.castShadow, m.receiveShadow, m.renderOrder, m.layers.mask, m.frustumCulled].join('|');
      let F = folds.get(k);
      if (!F) folds.set(k, F = { moves, crumb, list: [], rMax: 0, m0: m });
      F.list.push(m); F.rMax = Math.max(F.rMax, r);
    }
    const out = { meshes: [], kept: [], from: 0, to: 0, bones: 0, verts: 0, skip, of: new Map() };
    for (const F of folds.values()) {
      if (F.moves && new Set(F.list.map(m => m.parent)).size > 256) { why('bones'); continue; }   // a Uint8 bone index
      // the buckets a rig writes first: their ranges are one span of the merged buffer
      const wr = m => written.has(m.geometry.attributes.position) ? 1 : 0, mk = m => (m.material && m.material.uuid) || '';
      const list = F.list.slice().sort((a, b) => (wr(b) - wr(a)) || (VIEWS ? (mk(a) < mk(b) ? -1 : mk(a) > mk(b) ? 1 : 0) : 0));
      let nV = 0, nI = 0;
      for (const m of list) { nV += m.geometry.attributes.position.count; nI += m.geometry.index.count; }
      const P = new Float32Array(nV * 3), N = new Float32Array(nV * 3), U = new Uint16Array(nV * 2);
      const IX = nV > 65535 ? new Uint32Array(nI) : new Uint16Array(nI);
      const bones = [], boneOf = new Map();
      const SI = F.moves ? new Uint8Array(nV * 4) : null, SW = F.moves ? new Uint8Array(nV * 4) : null;
      const views = [], members = [], mirs = [];
      let vo = 0, io = 0;
      for (const m of list) {
        const g = m.geometry, n = g.attributes.position.count, pa = g.attributes.position, na = g.attributes.normal;
        const bs = g.boundingSphere;
        members.push({ i0: io, i1: io + g.index.count, c: bs.center.clone(), r0: bs.radius, r: bs.radius * 1.1 + 0.05, b: F.moves ? (boneOf.has(m.parent) ? boneOf.get(m.parent) : bones.length) : -1 });
        P.set(pa.array.subarray(0, n * 3), vo * 3); N.set(na.array.subarray(0, n * 3), vo * 3);
        U.set(g.attributes.uv1.array.subarray(0, n * 2), vo * 2);
        const ix = g.index.array; for (let i = 0; i < g.index.count; i++) IX[io + i] = ix[i] + vo;
        mirs.push([g, { ix: IX, io, vo, n: g.index.count, attr: null }]);
        if (F.moves) {
          let b = boneOf.get(m.parent);
          if (b === undefined) { b = bones.length; boneOf.set(m.parent, b); bones.push(m.parent); }
          for (let i = 0; i < n; i++) { SI[(vo + i) * 4] = b; SW[(vo + i) * 4] = 255; }
        }
        // THE RIGS' ARRAYS MOVE INTO THE MERGED ONE: same attribute objects, their arrays now views
        pa.array = P.subarray(vo * 3, (vo + n) * 3); na.array = N.subarray(vo * 3, (vo + n) * 3);
        views.push({ pa, na, o: vo * 3, n: n * 3, vp: pa.version, vn: na.version });
        vo += n; io += g.index.count;
      }
      const geo = new THREE.BufferGeometry();
      // G1170: the live side's own attributes (uv, the surface field, ...), merged once into the fold - zero where a member
      // has none (its material is then one that reads none: the material keys on the surface field's presence)
      if (VIEWS) {
        const extra = new Map();
        for (const m of list) for (const [k, a] of Object.entries(m.geometry.attributes))
          if (k !== 'position' && k !== 'normal' && k !== 'uv1' && !a.isInterleavedBufferAttribute && !extra.has(k)) extra.set(k, a.itemSize);
        for (const [k, sz] of extra) {
          const A = new Float32Array(nV * sz);
          let q = 0;
          for (const m of list) { const a = m.geometry.attributes[k], c = m.geometry.attributes.position.count;
            if (a && a.itemSize === sz) A.set(a.array.subarray(0, c * sz), q * sz);
            q += c; }
          geo.setAttribute(k, new THREE.BufferAttribute(A, sz));
        }
      }
      const aP = new THREE.BufferAttribute(P, 3), aN = new THREE.BufferAttribute(N, 3);
      geo.setAttribute('position', aP); geo.setAttribute('normal', aN);
      geo.setAttribute('uv1', new THREE.BufferAttribute(U, 2, true));
      if (F.moves) { geo.setAttribute('skinIndex', new THREE.BufferAttribute(SI, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4, true)); }
      geo.setIndex(new THREE.BufferAttribute(IX, 1));
      // G1864 (DMG-D4b): each member's INDEX MIRROR. The positions are views (the rigs write what is drawn); the index is
      // a copy, so a triangle the wreck removes from a member's own index (skin_break's tear, a debris part leaving) is
      // carried into the fold by app.js idxMirror through this - before it, the fold drew a torn skin whole
      for (const [g, M] of mirs) { M.attr = geo.index; (g.userData.ixMirror || (g.userData.ixMirror = [])).push(M); }
      geo.computeBoundingSphere();
      const mesh = F.moves ? new THREE.SkinnedMesh(geo, mat) : new THREE.Mesh(geo, mat);
      const m0 = F.m0;
      mesh.name = set === 'in' ? 'flownBakedIn' : 'flownBaked';
      mesh.castShadow = m0.castShadow; mesh.receiveShadow = m0.receiveShadow; mesh.renderOrder = m0.renderOrder;
      mesh.layers.mask = m0.layers.mask; mesh.frustumCulled = m0.frustumCulled;
      mesh.userData.flownMerge = { subs: list.length, bones: bones.length, verts: nV };
      // the roll-out's crumb rule (G564) reads this, not the merged sphere: a crumb fold casts nothing out there
      if (F.crumb) mesh.userData.crumbR = F.rMax;
      // the bones: stand-ins outside the graph, their matrixWorld the part's transform in the model group's frame
      let boneMat = null;
      if (F.moves) {
        const B = bones.map(() => { const b = new THREE.Bone(); b.matrixAutoUpdate = false; b.matrixWorldAutoUpdate = false; return b; });
        const sk = new THREE.Skeleton(B, B.map(() => new THREE.Matrix4()));
        mesh.bindMode = THREE.DetachedBindMode || 'detached';
        mesh.bind(sk, new THREE.Matrix4());
        const L = new THREE.Matrix4();
        boneMat = () => {
          for (let i = 0; i < bones.length; i++) {
            const M = B[i].matrixWorld; M.identity();
            for (let q = bones[i]; q && q !== grp; q = q.parent) {
              if (q.matrixAutoUpdate) L.compose(q.position, q.quaternion, q.scale); else L.copy(q.matrix);
              M.premultiply(L);
            }
          }
        };
        boneMat();
        // its sphere where the parts stand, not round their pivot-local vertices (the craft's cascade is fitted to the
        // meshes' spheres: shadow_near.js tagCraft)
        const all = new THREE.Sphere(), sp = new THREE.Sphere();
        members.forEach((q, i) => { sp.center.copy(q.c).applyMatrix4(B[q.b].matrixWorld); sp.radius = q.r0; if (i) all.union(sp); else all.copy(sp); });
        geo.boundingSphere = all;
        // G1170.1: ...and the OBJECT's sphere set here (a SkinnedMesh's own, which three computes at its first frustum test by
        // walking every vertex through the bones: 2.3 s at the hybrid's first crossing, a view on the fold's whole geometry
        // each). G1170.2: one that holds the parts at ANY turn about their pivots - each member within (its distance from
        // its part's pivot + its radius) of the pivot's rest place - plus FB.swingPad for a part's travel, so a surface at
        // full deflection, a leg at its stroke or a door open is never culled at the frame's edge
        const swing = new THREE.Sphere(), sw = new THREE.Sphere();
        members.forEach((q, i) => { sw.center.setFromMatrixPosition(B[q.b].matrixWorld); sw.radius = q.c.length() + q.r0 + FB.swingPad; if (i) swing.union(sw); else swing.copy(sw); });
        mesh.boundingSphere = swing;
      }
      // THE RAYCAST (the cockpit's pick every 80 ms, the sun's glare rays): member by member as the separate meshes were
      // - the ray into the member's frame, its own sphere first, then its triangles at their current (rig-written)
      // positions - never the whole fold's triangles behind one sphere round the aeroplane. A hit names the part the
      // member rides (`part`: the object a bone stands for), so the pick still finds the lever it hit.
      const side = mat.side, R3 = new THREE.Ray(), SP = new THREE.Sphere(), MM = new THREE.Matrix4(), MI = new THREE.Matrix4();
      const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3(), hitP = new THREE.Vector3();
      const Bs = F.moves ? null : [];
      // (G1171: one cast for the fold and for each of its views, over the members it draws - three's own on a view walked
      // every vertex of its range through the bones behind the fold's whole sphere, hidden or not: the cockpit's pick
      // +0.4 ms a frame, the live census A/B)
      const castOver = list => function (rc, hits) {
        if (!this.visible) return;          // a hidden fold stands for meshes that are shown (the cabin's, in the cockpit)
        const mw = this.matrixWorld, Bn = this.skeleton ? this.skeleton.bones : Bs;
        for (const q of list) {
          if (q.b >= 0) MM.multiplyMatrices(mw, Bn[q.b].matrixWorld); else MM.copy(mw);
          MI.copy(MM).invert();
          R3.copy(rc.ray).applyMatrix4(MI);
          SP.center.copy(q.c); SP.radius = q.r;
          if (!R3.intersectsSphere(SP)) continue;
          for (let t = q.i0; t < q.i1; t += 3) {
            const a = IX[t], b = IX[t + 1], c = IX[t + 2];
            vA.fromArray(P, a * 3); vB.fromArray(P, b * 3); vC.fromArray(P, c * 3);
            if (!R3.intersectTriangle(vA, vB, vC, side === THREE.FrontSide, hitP)) continue;
            hitP.applyMatrix4(MM);
            const d = rc.ray.origin.distanceTo(hitP);
            if (d < rc.near || d > rc.far) continue;
            hits.push({ distance: d, point: hitP.clone(), object: this, faceIndex: t / 3, face: { a, b, c, materialIndex: 0 },
                        part: q.b >= 0 ? bones[q.b] : null });
          }
        }
      };
      mesh.raycast = castOver(members);
      mesh.userData.flownMerge.parts = bones;
      // EVERY FRAME, before three reads the buffers (the scene's matrix pass precedes each render's projection)
      const upd = mesh.updateMatrixWorld;
      const ranges = [];
      let stale = false;
      mesh.updateMatrixWorld = function (force) {
        ranges.length = 0;
        let nd = 0;
        for (const v of views) {
          const dp = v.pa.version !== v.vp, dn = v.na.version !== v.vn;
          if (dp) v.vp = v.pa.version;
          if (dn) v.vn = v.na.version;
          if (dp || dn) { nd++; const last = ranges[ranges.length - 1];
            if (last && last.e === v.o) { last.e = v.o + v.n; last.p = last.p || dp; last.nn = last.nn || dn; }
            else ranges.push({ s: v.o, e: v.o + v.n, p: dp, nn: dn }); }
        }
        if (nd || stale) {
          // a fold that is not drawn (the cabin's in the cockpit, the whole model in the shed) uploads nothing: three
          // only clears its ranges on an upload, so they would pile up frame after frame - it owes ONE whole upload instead
          let shown = this.visible || (FOLD_CASTS && this.castShadow && set !== 'in') || !!out.viewsOn;   // (G1124 a: an exterior fold that casts draws in the shadow pass; G1170: a fold drawn through its views)
          for (let q = this.parent; q && shown; q = q.parent) if (!q.visible) shown = false;
          if (!shown) stale = true;
          else if (stale || aP.updateRanges.length > 32 || aN.updateRanges.length > 32) {
            stale = false;
            aP.clearUpdateRanges(); aN.clearUpdateRanges(); aP.needsUpdate = true; aN.needsUpdate = true;
          } else for (const r of ranges) {
            if (r.p) { aP.addUpdateRange(r.s, r.e - r.s); aP.needsUpdate = true; }
            if (r.nn) { aN.addUpdateRange(r.s, r.e - r.s); aN.needsUpdate = true; }
          }
        }
        if (boneMat) boneMat();
        return upd.call(this, force);
      };
      // the fold replaces its members in the graph, where the first of them stood among the model group's children
      const at0 = grp.children.indexOf(list.find(m => m.parent === grp) || null);
      // a kept member stands at rest (atRest, above) under its part: its matrix frozen there - the hidden hundred of the
      // hybrid then cost three's walk nothing but the visit (GATE FRAMECOST: updateMatrix +102 a frame on the Cub before)
      if (VIEWS) {
        // G1170 THE NEAR VIEW FROM THE FOLD'S OWN BUFFERS. The kept live meshes were a SECOND RESIDENT SET - their own position,
        // normal, uv, surface-field, uv1 and index buffers and VAOs, ~1 000 GL buffers and ~47 MB on the Cessna, held even where
        // never drawn: +0.9-1.1 ms render in the cockpit (the isolation: ?fbake=nowarm = master). A VIEW is a geometry over
        // the fold's SAME attribute objects (three keys its GL buffers on the attribute: shared, uploaded once) drawing one
        // material's index range (the members sorted by material above), on that live material; a moving part's view is a
        // SkinnedMesh on the fold's own skeleton. The members leave the graph as the plain fold's do; the views are kept
        // (parked, the band, the near view, the warm) where the members were.
        let r0 = 0;
        while (r0 < list.length) {
          let r1 = r0 + 1; const mat0 = list[r0].material;
          while (r1 < list.length && list[r1].material === mat0) r1++;
          const vg = new THREE.BufferGeometry();
          for (const k of Object.keys(geo.attributes)) vg.setAttribute(k, geo.attributes[k]);
          vg.setIndex(geo.index);
          vg.setDrawRange(members[r0].i0, members[r1 - 1].i1 - members[r0].i0);
          vg.boundingSphere = geo.boundingSphere;
          const v = F.moves ? new THREE.SkinnedMesh(vg, mat0) : new THREE.Mesh(vg, mat0);
          if (F.moves) { v.bindMode = mesh.bindMode; v.bind(mesh.skeleton, mesh.bindMatrix); v.boundingSphere = mesh.boundingSphere.clone(); }   // (G1170.1-.2: the fold's swing sphere: no per-vertex walk at its first frustum test)
          v.name = 'flownLive'; v.castShadow = false; v.receiveShadow = list[r0].receiveShadow; v.renderOrder = list[r0].renderOrder;
          v.layers.mask = list[r0].layers.mask; v.frustumCulled = mesh.frustumCulled; v.visible = false;
          v.matrixAutoUpdate = false; v.userData.flownView = { subs: r1 - r0 };
          v.raycast = castOver(members.slice(r0, r1));   // G1171: the fold's member cast over its own range (never three's per-vertex walk)
          grp.add(v); out.kept.push(v);
          r0 = r1;
        }
        for (const m of list) { m.parent.remove(m); out.of.set(m, mesh); }
      }
      else if (keep) for (const m of list) { m.visible = false; if (m.matrixAutoUpdate) { m.updateMatrix(); m.matrixAutoUpdate = false; } out.kept.push(m); }
      else for (const m of list) { m.parent.remove(m); out.of.set(m, mesh); }
      grp.add(mesh);
      if (at0 >= 0) { grp.children.splice(grp.children.indexOf(mesh), 1); grp.children.splice(Math.min(at0, grp.children.length), 0, mesh); }
      out.meshes.push(mesh); out.from += list.length; out.to++; out.bones += bones.length; out.verts += nV;
    }
    (FB.merge || (FB.merge = {}))[set] = { from: out.from, to: out.to, bones: out.bones, verts: out.verts, skip };
    // the cockpit's swap (keep): the folds hide and the live members show, or back - once per change
    if (keep) {
      let cur = false;
      out.live = out.kept.slice();
      // G1121: A LIVE MESH NOT DRAWN IS OUT OF THE GRAPH. Hidden, it still cost three's matrix walk every frame (the
      // aeroplane moves, so a moving parent forces its children's world matrices whatever their own flags: GATE
      // FRAMECOST's updateMatrixWorld +100 a frame on the Cub) - so it leaves its parent while the bake is drawn and goes
      // back (the same parent) when the band or the near view draws it. Nothing reads a kept mesh through the graph: the
      // rigs write its attributes (views into the fold), the pick and the sun's rays hit the fold member by member, the
      // warm draw stands it in by prototype. out.park() after the build (app.js, after G576's still merge) takes them out.
      // G1124.5: BACK WHERE IT STOOD - a kept mesh leaves at its index among its parent's children (all the indices read
      // before any leaves) and goes back to that index (ascending: the earlier ones first), not appended: the scene's
      // order is three's walk order, and a sort tie broken differently put the cabin's still meshes elsewhere in the
      // cockpit's draw sequence (+2 program switches a frame, the node census, the same draws)
      const HOME = new Map();
      const put = list => {
        list.sort((x, y) => HOME.get(x)[1] - HOME.get(y)[1]);
        for (const m of list) {
          const [h, i] = HOME.get(m);
          h.add(m);
          const ch = h.children, j = ch.indexOf(m);
          if (i >= 0 && j !== i && i < ch.length) { ch.splice(j, 1); ch.splice(i, 0, m); }
        }
      };
      const liveOn = on => {
        out.viewsOn = !!on;   // (G1170: a fold drawn through its views uploads its rigs' writes)
        if (on) { put(out.live.filter(m => !m.parent && HOME.has(m))); for (const m of out.live) m.visible = true; return; }
        const go = out.live.filter(m => m.parent);
        for (const m of go) HOME.set(m, [m.parent, m.parent.children.indexOf(m)]);
        for (const m of out.live) m.visible = false;
        for (const m of go) m.parent.remove(m);
      };
      out.park = () => { if (!cur) liveOn(false); };
      // G1121.1: a walk that must see the kept meshes (SHADOW_NEAR.tagCraft: the craft's layers, its near-only define,
      // receiveShadow, renderOrder) runs with them back in the graph, hidden as they are, and parked again after
      out.unpark = () => {
        const moved = [];
        for (const m of out.live) if (!m.parent && HOME.has(m)) moved.push(m);
        put(moved);
        return () => { for (const m of moved) if (m.parent && !m.visible) m.parent.remove(m); };
      };
      out.apply = on => {
        on = !!on;
        if (on === cur) return;
        cur = on;
        for (const f of out.meshes) f.visible = !on;
        liveOn(on);
      };
      out.view = on => { if (!out.held) out.apply(on); };
      // the hybrid's band (hybrid()): the folds drawn below t = 1, the live meshes above t = 0, both inside the band
      let cf = -1;
      const ORIG = new Map(), inBand = x => x > 0 && x < 1;
      const setBand = on => {
        for (const o of out.meshes.concat(out.live)) {
          if (!ORIG.has(o)) ORIG.set(o, o.material);
          o.material = on ? bandOf(ORIG.get(o)) : ORIG.get(o);
        }
      };
      // [object, material] the craft step compiles and warm-draws (by stand-in): the live meshes on their own and their
      // band twins, the folds' band twins (the folds' own are in the graph)
      out.pairs = () => {
        const P = [];
        for (const m of out.live) { const n = ORIG.get(m) || m.material; P.push([m, n]); if (!FB.noBand) P.push([m, bandOf(n)]); }
        if (!FB.noBand) for (const f of out.meshes) P.push([f, bandOf(ORIG.get(f) || f.material)]);
        return P;
      };
      out.fade = t => {
        if (out.held || t === cf) return;
        const was = cf; cf = t;
        if (inBand(t) !== inBand(was)) setBand(inBand(t));
        if (t >= 1) { cur = true; if (was < 1) { for (const f of out.meshes) f.visible = false; liveOn(true); } return; }
        if (t <= 0) { cur = false; if (was !== 0) { for (const f of out.meshes) f.visible = true; liveOn(false); } return; }
        if (was <= 0 || was >= 1) { cur = true; for (const f of out.meshes) f.visible = true; liveOn(true); }
      };
      // G1124 (a): the shadow pass's swap - the folds shown, the live meshes hidden - and back exactly as they stood
      let saved = null;
      out.shadowSwap = on => {
        if (on) { if (saved) return; saved = [out.meshes.map(f => f.visible), out.live.map(m => m.visible)]; for (const f of out.meshes) f.visible = true; for (const m of out.live) m.visible = false; }
        else if (saved) { out.meshes.forEach((f, i) => { f.visible = saved[0][i]; }); out.live.forEach((m, i) => { m.visible = saved[1][i]; }); saved = null; }
      };
      out.set = set; out.zone = zone;
      FOLDS.push(out);
    }
    return out;
  }

  // ---- ONE ATLAS: the cache, else the bake ----------------------------------------------------------------------------
  // j: { set, list, key, S }. Resolves { mat, stats } (null: this set flies live). The page's own tasks: the cache read
  // (async), the unzip (a stream), the charts' uv per vertex, the compile (awaited, parallel), a pass a task, the upload.
  async function bakeSet(THREE, R, vis, spec, j, phase) {
    const { set, list, key, S } = j, t = {};
    const M = MEMS[set];
    // THE ROUND TRIP: a new snapshot of the build the last bake was made for (the shed and back) - the material and the
    // uv arrays are reused as they stand (the groups' sizes agree: the same build snapshots the same soups)
    if (M && M.key === key && sigOk(M.sig, list)) {
      list.forEach((e, i) => { e.uv = M.uvs[i]; });
      return { mat: M.mat, stats: Object.assign({}, M.stats, { hit: 'memory' }) };
    }
    // THE CACHE
    phase('baking your aeroplane: the cache', 0.05);
    let t0 = performance.now();
    const hit = FB.noCache ? null : await cacheGet(key);
    t.read = Math.round(performance.now() - t0);
    if (hit && sigOk(hit.sig, list) && hit.S === S) {
      t0 = performance.now();
      const n = S * S * 4, tex = [];
      for (const v of hit.tex) tex.push(await unsqueeze(v, n));
      let nuv = 0; for (const e of list) nuv += e.g.pos.length / 3 * 2;
      const u8 = await unsqueeze(hit.uv, nuv * 2), uvAll = new Uint16Array(u8.buffer, u8.byteOffset, nuv);
      let o = 0; for (const e of list) { const m = e.g.pos.length / 3 * 2; e.uv = uvAll.slice(o, o + m); o += m; }
      t.unzip = Math.round(performance.now() - t0);
      if (tex.every(x => x.length === n)) {
        phase('baking your aeroplane: the mips', 0.5);
        const fo = await finishOff(tex, S, false, t);
        if (fo) {
          const mat = materialOf(THREE, { S, cc: hit.cc, levels: fo.levels }, set);
          const stats = Object.assign({}, hit.stats, { hit: 'idb', t, bytes: fo.levels.reduce((s2, lv) => s2 + gpuBytes(lv), 0) });
          remember(set, key, mat, stats, list);
          return { mat, stats };
        }
      }
    }
    // THE BAKE
    phase('baking your aeroplane: the charts', 0.1);
    await tick();
    t0 = performance.now();
    const U0 = await unwrapOff(list, S, set === 'in' ? FB.gutterIn : FB.gutter, t), uw = U0.uw;
    if (!uw) { console.warn('flown bake: the charts do not pack (' + set + ')'); return null; }
    const t1 = performance.now();
    const split = uvsOf(list, uw);
    t.unwrap = Math.round(t1 - t0); t.uvs = Math.round(performance.now() - t1);
    phase('baking your aeroplane: the programs', 0.25);
    await tick();
    // the shared block as the flown aeroplane wears it, for the bake only
    const A = W.AEROSKIN, WX = (typeof W.AEROWX !== 'undefined') ? W.AEROWX : null;
    const U = A.aeroSharedU(THREE), saved = {}; for (const k in U) saved[k] = { value: cloneVal(U[k].value) };
    const macro0 = (WX && WX.aeroWxSetMacro) ? Object.assign({}, WX.aeroWxSetMacro(THREE, null)) : null;
    let at;
    try {
      blockFor(THREE, vis, spec);
      at = await bakeAtlas(THREE, R, vis, list, t, S);
    } catch (e) {
      console.warn('flown bake failed (' + set + '), the live shader flies:', e && e.message || e);
      return null;
    } finally {
      for (const k in saved) U[k].value = copyVal(U[k].value, saved[k].value);
      if (WX && macro0) WX.aeroWxSetMacro(THREE, macro0);
    }
    phase('baking your aeroplane: the gutters and the mips', 0.6);
    await tick();
    const fo = await finishOff(at.tex, S, true, t);
    if (!fo) return null;
    if (fo.cov < 0.05) { console.warn('flown bake wrote', (fo.cov * 100).toFixed(1), '% of the ' + set + ' atlas: the live shader flies'); return null; }
    const mat = materialOf(THREE, { S, cc: at.cc, levels: fo.levels }, set);
    let nvt = 0; for (const e of list) nvt += e.uv.length / 2;
    const stats = { hit: false, t, S, bytes: fo.levels.reduce((s2, lv) => s2 + gpuBytes(lv), 0), groups: list.length, verts: nvt, tris: U0.nt, split,
                    charts: uw.charts, axis: uw.axis, fill: +uw.fill.toFixed(3), cm: +(100 / uw.density).toFixed(2), cov: +fo.cov.toFixed(3), cc: at.cc };
    remember(set, key, mat, stats, list);
    // the cache, off the screen's clock (gzip streams run off the main thread)
    const uvAll = new Uint16Array(nvt * 2); { let o = 0; for (const e of list) { uvAll.set(e.uv, o); o += e.uv.length; } }
    cachePut(key, { S, cc: at.cc, tex: fo.levels.map(lv => lv[0].data), uv: uvAll, sig: list.map(e => e.g.pos.length / 3), stats: Object.assign({}, stats, { t: undefined }) })
      .then(() => log('cached', key)).catch(e => console.warn('flown bake: not cached', e && e.message || e));
    return { mat, stats };
  }

  // ---- THE STEP ---------------------------------------------------------------------------------------------------------
  // opt: { payload, spec, phase(label, frac), rebuild() }. Resolves with the stats (null = nothing baked: the live shader
  // flies). The exterior's atlas, then the cabin's; each a cache hit or a bake (bakeSet). No task over ~1 s.
  async function step(opt) {
    const T0 = performance.now();
    const THREE = W.THREE, vis = opt && opt.payload, spec = opt && opt.spec;
    const phase = (l, f) => { if (opt && opt.phase) try { opt.phase(l, f); } catch (e) {} };
    if (!FB.on || W.FLYDIY_FLOWN_BAKE === 0 || !THREE || !vis || !vis.cage || !W.AEROSKIN || !W.PARKED || !W.PARKED.unwrap) return null;
    // G1523 (POTATO-DEEP): a build budget without the bake (potato) - the live shader flies, nothing baked nor held
    if (W.GFX && typeof W.GFX.budget === 'function' && W.GFX.budget().flownBake === false) { log('the budget makes no bake (' + W.GFX.budget().preset + ')'); return null; }
    const R = renderer();
    if (!R) return null;
    const sets = bakedSets(vis), jobs = [];
    for (const set of SETS) {
      const names = new Set(); for (const [k, s2] of sets) if (s2 === set) names.add(k);
      const list = groupsOf(vis, names);
      const S = set === 'in' ? FB.Sin : FB.S;
      if (list.length && S > 0) jobs.push({ set, list, key: keyOf(list, spec, set), S });
    }
    if (!jobs.length) return null;
    const key = jobs.map(j => j.key).join('#');
    const done = stats => {
      FB.last = stats;
      if (BUILT_LIVE.has(vis) && opt.rebuild) { const t1 = performance.now(); try { opt.rebuild(); } catch (e) { console.error('flown bake: rebuild', e); } stats.rebuild = Math.round(performance.now() - t1); }
      freeOld();
      stats.total = Math.round(performance.now() - T0);
      log(stats.hit ? 'cache hit' : 'baked', JSON.stringify(stats));
      return stats;
    };
    // the stats: the exterior's at the top (C4a's shape: the rigs read it), every set's under `sets`
    const statsOf = (per) => {
      const first = per.ext || per.in, out = Object.assign({}, first);
      out.sets = per; out.bytes = 0; for (const k in per) out.bytes += per[k].bytes || 0;
      bytes = out.bytes;
      return out;
    };
    const prev = BAKED.get(vis);
    if (prev && prev.key === key) return done(Object.assign(statsOf(prev.stats), { hit: 'memory' }));
    const res = {};
    for (let i = 0; i < jobs.length; i++) {
      const j = jobs[i];
      const r = await bakeSet(THREE, R, vis, spec, j, (l, f) => phase(l + (jobs.length > 1 ? ' (' + (j.set === 'in' ? 'the cabin' : 'the outside') + ')' : ''), (i + f) / jobs.length));
      if (r) res[j.set] = r;
    }
    if (!Object.keys(res).length) return null;
    attach(vis, jobs, res, key);
    const per = {}; for (const k in res) per[k] = res[k].stats;
    return done(statsOf(per));
  }

  W.FLOWN_BAKE = { FB, step, note, forPayload, show, showFold, mergeModel, hybrid, rest, nearT, liveTwin, bandOf, FB_FADE, folds: () => FOLDS.slice(),
                   warmPairs: () => FB.noWarm ? [] : FOLDS.flatMap(F => F.pairs ? F.pairs() : []), eyeZone, shadowFolds,
                   withKept: fn => { const back = FOLDS.map(F => F.unpark ? F.unpark() : null); try { return fn(); } finally { for (const b of back) if (b) b(); } }, workerSource, bakedNames, bakedSets, groupsOf, keyOf, extOf, uvsOf, splitGroup, aeroArgs, mipSteps, toksvig, dilate,
                   bakeHook, FB_HOOK, BAKE_FS, graze: FB_U.uFbGraze, sunRough: FB_U.uFbSun,   // G1350: graze.value 1 = the old relief at a low sun; G1358: sunRough.value 0 = the old glint
                   get bytes() { return bytes; },
                   clear: () => idb('readwrite', st => st.clear()) };
})();
