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
// WHAT BAKES. An exterior AEROSKIN bucket: a finish, not glass, not inside, not a turning blade or spinner (their
// weathering reads a rotating frame), not see-through, not the facia; and never a bucket that also rides a cockpit
// control, a gauge or a link. Glass, the interior, the lamps, the crew, the panel, the tanks, the blades stay LIVE.
// The garage never sees a bake (the editor draws its own meshes).
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
'use strict';
(function () {
  const W = (typeof window !== 'undefined') ? window : globalThis;
  const FB = { V: 1, S: 2048, gutter: 4, keep: 4, on: true, ab: false, quiet: false, sliceMs: 40 };
  const log = (...a) => { if (FB.quiet) return; console.log('flown bake:', ...a); };
  const tick = () => new Promise(r => setTimeout(r, 0));
  // the dials in the URL: ?fbake=0 the live shader; ?fbake=ab the A/B build (live twins kept, the still merge off);
  // ?fbake=nocache bakes whatever the cache holds
  try {
    const q = /[?&]fbake=([^&]*)/.exec((W.location && W.location.search) || '');
    if (q && q[1] === '0') W.FLYDIY_FLOWN_BAKE = 0;
    if (q && q[1] === 'ab') { FB.ab = true; W.FLYDIY_CRAFT_MERGE = 0; }
    if (q && q[1] === 'nocache') FB.noCache = true;   // the rig's warm MISS: the cache is not read (it is written)
  } catch (e) {}

  // ---- which buckets bake ----------------------------------------------------------------------------------------
  const EXCL_PART = { gauge: 1, ctlMove: 1, ctlLink: 1 };
  const bakes = m => !!(m && m.fin && m.fin !== 'glass' && !m.inside && !m.spin && !(m.opacity < 1) && m.sec !== 'dashFace');
  function bakedNames(vis) {
    const out = new Set(), no = new Set();
    for (const k in vis.groups || {}) if (bakes(vis.mats[k])) out.add(k);
    for (const p of vis.parts || []) for (const k in p.groups) { if (EXCL_PART[p.kind]) no.add(k); else if (bakes(vis.mats[k])) out.add(k); }
    for (const k of no) out.delete(k);
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
  function keyOf(list, spec) {
    let nv = 0; for (const e of list) nv += e.g.pos.length / 3;
    return ['fb', FB.V, FB.S, FB.gutter, W.FLYDIY_BUILD || 'dev', (typeof GEN_SPEC_V !== 'undefined') ? GEN_SPEC_V : 0,
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
    gl_FragColor = uFbOut < 0.5 ? vec4(sRGBTransferOETF(vec4(fbA, 1.0)).rgb, 0.5 + 0.5 * clamp(uInside.y, 0.0, 1.0))
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
  async function bakeAtlas(THREE, R, vis, list, t) {
    const S = FB.S, A = W.AEROSKIN, WX = (typeof W.AEROWX !== 'undefined') ? W.AEROWX : null;
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
      for (let k = 0; k < 3; k++) {
        await tick();                                       // a pass a task
        const prevRT = R.getRenderTarget(), prevAC = R.autoClear, ccol = R.getClearColor(new THREE.Color()), ca = R.getClearAlpha(), prevSM = R.shadowMap.enabled;
        try {
          R.shadowMap.enabled = false; R.autoClear = false;
          R.setRenderTarget(rt); R.setClearColor(0x000000, 0);
          FB_U.uFbOut.value = k;
          for (const m of made) if (m.isMaterial) m.uniformsNeedUpdate = true;
          R.clear(true, false, false);
          R.render(wire, cam); R.render(solid, cam);
          const buf = new Uint8Array(S * S * 4);
          R.readRenderTargetPixels(rt, 0, 0, S, S, buf);
          out.push(buf);
        } finally { R.setRenderTarget(prevRT); R.setClearColor(ccol, ca); R.autoClear = prevAC; R.shadowMap.enabled = prevSM; }
      }
      t.render = Math.round(performance.now() - t0);
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
    // the inside flag back to 0 / 255 (it rode 128 / 255 so an unwritten texel read 0)
    for (let i = 0; i < n; i++) A[i * 4 + 3] = A[i * 4 + 3] >= 192 ? 255 : 0;
    return written / n;
  }

  // ---- THE MIPS, WITH TOKSVIG ----------------------------------------------------------------------------------------
  // levels[k] = { data, width, height } for T0 (albedo averaged in LINEAR light), T1 (the normal: the mean of the
  // level-0 unit vectors under the texel, renormalised; its length |n| is what the texel hides) and T2 (cc / rough /
  // metal / ccR averaged, rough and ccR widened by the normal variance: Karis' GGX form - a = r^2, a2 = a^2,
  // var = (1 - |n|) / |n|, B = 2 var (a2 - 1), a2' = (B - a2) / (B - 1), r' = a2'^(1/4)). A generator: a task's
  // worth of rows at a time.
  const S2L = new Float32Array(256); for (let i = 0; i < 256; i++) { const c = i / 255; S2L[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  const L2S = new Uint8Array(4096); for (let i = 0; i < 4096; i++) { const c = i / 4095; L2S[i] = Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)); }
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

  // ---- THE RUNTIME MATERIAL ------------------------------------------------------------------------------------------
  // the clear coat on the perturbed normal (G206), its roughness from T2.A (three's own clamps and geometryRoughness),
  // and the cabin's darkness + the footwell on the back faces the albedo's A flags (AERO_CABIN_FS, uInside.y per texel)
  const FB_HOOK = function (sh) {
    if (typeof ATMO !== 'undefined') ATMO.inject(sh);
    const d = this.userData.aeroD;
    if (d) for (const k of ['uCraftInv', 'uCabin', 'uFootA', 'uFootB']) if (d[k]) sh.uniforms[k] = d[k];
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', 'uniform mat4 uCraftInv;\nvarying vec3 vFbCraft;\n#include <common>')
      .replace('#include <project_vertex>', 'vFbCraft = (uCraftInv * modelMatrix * vec4(transformed, 1.0)).xyz;\n#include <project_vertex>');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', 'uniform mat4 uCraftInv;\nuniform vec4 uCabin;\nuniform vec4 uFootA;\nuniform vec4 uFootB;\nvarying vec3 vFbCraft;\n#include <common>')
      .replace('#include <map_fragment>', '#include <map_fragment>\n  float fbIn = sampledDiffuseColor.a;\n  diffuseColor.a = opacity;')
      .replace('#include <clearcoat_normal_fragment_begin>', '#ifdef USE_CLEARCOAT\n  vec3 clearcoatNormal = normal;\n#endif')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\n  material.clearcoatRoughness = min(max(texture2D(clearcoatMap, vClearcoatMapUv).a, 0.0525) + geometryRoughness, 1.0);\n#endif')
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  {
    float fbInK = fbIn * step(faceDirection, 0.0);
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
  function materialOf(THREE, d) {
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
    mat.name = 'flown:baked';
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
    // the last FB.keep builds stay
    const all = await idb('readonly', st => st.getAllKeys());
    if (all && all.length > FB.keep) {
      const whens = await Promise.all(all.map(k => idb('readonly', st => st.get(k)).then(r => [k, r ? r.when : 0])));
      whens.sort((a, b) => a[1] - b[1]);
      for (const [k] of whens.slice(0, whens.length - FB.keep)) await idb('readwrite', st => st.delete(k));
    }
  }

  // ---- the payload's bake: what buildModel reads -------------------------------------------------------------------------
  const BAKED = new WeakMap();          // payload -> { key, names, mat, uv: Map(group -> Uint16Array), stats }
  const BUILT_LIVE = new WeakSet();     // payloads a model was built from without their bake
  const LIVE = [];                      // the A/B dial: [mesh, live material] of the current build
  let MEM = null, OLD = null;           // the last bake (the round trip's reuse); the one it replaced, freed after the rebuild
  function attach(vis, list, mat, key, stats) {
    const uv = new Map(); for (const e of list) uv.set(e.g, e.uv);
    BAKED.set(vis, { key, names: new Set(list.map(e => e.k)), mat, uv, stats });
    if (MEM && MEM.mat !== mat) OLD = MEM.mat;
    MEM = { key, mat, stats, uvs: list.map(e => e.uv), sig: list.map(e => e.g.pos.length / 3) };
  }
  function freeOld() {
    if (!OLD) return;
    for (const k of ['map', 'normalMap', 'roughnessMap']) if (OLD[k]) OLD[k].dispose();
    OLD.dispose(); OLD = null;
  }
  // buildModel's door: null = fly the live shader
  function forPayload(vis) {
    if (!vis || !vis.cage) return null;
    const b = BAKED.get(vis);
    if (!b || W.FLYDIY_FLOWN_BAKE === 0 || !FB.on) { BUILT_LIVE.add(vis); return null; }
    LIVE.length = 0;
    return {
      mat: b.mat, ab: !!FB.ab,
      has: name => b.names.has(name),
      uv: g => b.uv.get(g) || null,
      // the A/B build: the live twin, and the cavity its shader reads (the flight's cavity pass skips a baked mesh)
      made: (mesh, liveMat) => {
        if (!FB.ab) return;
        LIVE.push([mesh, liveMat]);
        const WX = (typeof W.AEROWX !== 'undefined') ? W.AEROWX : null;
        if (WX && WX.aeroWxBakeCavity) WX.aeroWxBakeCavity(W.THREE, mesh.geometry, (liveMat.userData || {}).aeroFieldM || 1);
      },
    };
  }
  function show(on) {
    let n = 0;
    for (const [mesh, live] of LIVE) { const b = BAKED.get(W.CAGE_VISUAL); if (!b) break; mesh.material = on ? b.mat : live; n++; }
    return n;
  }

  // ---- THE STEP ---------------------------------------------------------------------------------------------------------
  // opt: { payload, spec, phase(label, frac), rebuild() }. Resolves with the stats (null = nothing baked: the live shader
  // flies). No task over ~1 s: the unwrap | the compile (awaited) | a pass a task | the dilation | the mips a slice at a
  // time | the IndexedDB write (async, not awaited).
  async function step(opt) {
    const T0 = performance.now(), t = {};
    const THREE = W.THREE, vis = opt && opt.payload, spec = opt && opt.spec;
    const phase = (l, f) => { if (opt && opt.phase) try { opt.phase(l, f); } catch (e) {} };
    if (!FB.on || W.FLYDIY_FLOWN_BAKE === 0 || !THREE || !vis || !vis.cage || !W.AEROSKIN || !W.PARKED || !W.PARKED.unwrap) return null;
    const R = renderer();
    if (!R) return null;
    const names = bakedNames(vis), list = groupsOf(vis, names);
    if (!list.length) return null;
    const key = keyOf(list, spec);
    const done = stats => {
      FB.last = stats;
      if (BUILT_LIVE.has(vis) && opt.rebuild) { const t1 = performance.now(); try { opt.rebuild(); } catch (e) { console.error('flown bake: rebuild', e); } stats.rebuild = Math.round(performance.now() - t1); }
      freeOld();
      stats.total = Math.round(performance.now() - T0);
      log(stats.hit ? 'cache hit' : 'baked', JSON.stringify(stats));
      return stats;
    };
    const prev = BAKED.get(vis);
    if (prev && prev.key === key) return done(Object.assign({}, prev.stats, { hit: 'memory' }));
    // THE ROUND TRIP: a new snapshot of the build the last bake was made for (the shed and back) - the material and
    // the uv arrays are reused as they stand (the groups' sizes agree: the same build snapshots the same soups)
    if (MEM && MEM.key === key && MEM.sig.length === list.length && MEM.sig.every((n, i) => n === list[i].g.pos.length / 3)) {
      list.forEach((e, i) => { e.uv = MEM.uvs[i]; });
      attach(vis, list, MEM.mat, key, MEM.stats);
      return done(Object.assign({}, MEM.stats, { hit: 'memory' }));
    }
    // THE CACHE
    phase('baking your aeroplane: the cache', 0.05);
    let t0 = performance.now();
    const hit = FB.noCache ? null : await cacheGet(key);
    t.read = Math.round(performance.now() - t0);
    if (hit && hit.sig && hit.sig.length === list.length && hit.sig.every((n, i) => n === list[i].g.pos.length / 3)) {
      t0 = performance.now();
      const S = hit.S, n = S * S * 4;
      const tex = [];
      for (const v of hit.tex) tex.push(await unsqueeze(v, n));
      let nuv = 0; for (const e of list) nuv += e.g.pos.length / 3 * 2;
      const u8 = await unsqueeze(hit.uv, nuv * 2), uvAll = new Uint16Array(u8.buffer, u8.byteOffset, nuv);
      let o = 0; for (const e of list) { const m = e.g.pos.length / 3 * 2; e.uv = uvAll.slice(o, o + m); o += m; }
      t.unzip = Math.round(performance.now() - t0);
      if (tex.every(x => x.length === n)) {
        phase('baking your aeroplane: the mips', 0.5);
        t0 = performance.now();
        const mo = {}; await drive(mipSteps(tex, S, mo));
        t.mips = Math.round(performance.now() - t0);
        const mat = materialOf(THREE, { S, cc: hit.cc, levels: mo.levels });
        bytes = mo.levels.reduce((s, lv) => s + gpuBytes(lv), 0);
        const stats = Object.assign({}, hit.stats, { hit: 'idb', t, bytes });
        attach(vis, list, mat, key, stats);
        return done(stats);
      }
    }
    // THE BAKE
    phase('baking your aeroplane: the charts', 0.1);
    await tick();
    t0 = performance.now();
    const ext = extOf(list);
    const uw = W.PARKED.unwrap(ext, { S: FB.S, gutter: FB.gutter });
    if (!uw) { console.warn('flown bake: the charts do not pack'); return null; }
    const split = uvsOf(list, uw);
    t.unwrap = Math.round(performance.now() - t0);
    phase('baking your aeroplane: the programs', 0.25);
    await tick();
    // the shared block as the flown aeroplane wears it, for the bake only
    const A = W.AEROSKIN, WX = (typeof W.AEROWX !== 'undefined') ? W.AEROWX : null;
    const U = A.aeroSharedU(THREE), saved = {}; for (const k in U) saved[k] = { value: cloneVal(U[k].value) };
    const macro0 = (WX && WX.aeroWxSetMacro) ? Object.assign({}, WX.aeroWxSetMacro(THREE, null)) : null;
    let at;
    try {
      blockFor(THREE, vis, spec);
      at = await bakeAtlas(THREE, R, vis, list, t);
    } catch (e) {
      console.warn('flown bake failed, the live shader flies:', e && e.message || e);
      return null;
    } finally {
      for (const k in saved) U[k].value = copyVal(U[k].value, saved[k].value);
      if (WX && macro0) WX.aeroWxSetMacro(THREE, macro0);
    }
    phase('baking your aeroplane: the gutters', 0.6);
    await tick();
    t0 = performance.now();
    const cov = dilate(at.tex, FB.S);
    t.dilate = Math.round(performance.now() - t0);
    if (cov < 0.05) { console.warn('flown bake wrote', (cov * 100).toFixed(1), '% of the atlas: the live shader flies'); return null; }
    phase('baking your aeroplane: the mips', 0.75);
    t0 = performance.now();
    const mo = {}; await drive(mipSteps(at.tex, FB.S, mo));
    t.mips = Math.round(performance.now() - t0);
    const mat = materialOf(THREE, { S: FB.S, cc: at.cc, levels: mo.levels });
    bytes = mo.levels.reduce((s, lv) => s + gpuBytes(lv), 0);
    let nvt = 0; for (const e of list) nvt += e.uv.length / 2;
    const stats = { hit: false, t, bytes, groups: list.length, verts: nvt, tris: ext.nt, split, charts: uw.charts, axis: uw.axis,
                    fill: +uw.fill.toFixed(3), cm: +(100 / uw.density).toFixed(2), cov: +cov.toFixed(3), cc: at.cc };
    attach(vis, list, mat, key, stats);
    // the cache, off the screen's clock (gzip streams run off the main thread)
    const uvAll = new Uint16Array(nvt * 2); { let o = 0; for (const e of list) { uvAll.set(e.uv, o); o += e.uv.length; } }
    cachePut(key, { S: FB.S, cc: at.cc, tex: at.tex, uv: uvAll, sig: list.map(e => e.g.pos.length / 3), stats: Object.assign({}, stats, { t: undefined }) })
      .then(() => log('cached', key)).catch(e => console.warn('flown bake: not cached', e && e.message || e));
    return done(stats);
  }

  W.FLOWN_BAKE = { FB, step, note, forPayload, show, bakedNames, groupsOf, keyOf, extOf, uvsOf, splitGroup, aeroArgs, mipSteps, toksvig, dilate,
                   bakeHook, FB_HOOK, BAKE_FS,
                   get bytes() { return bytes; },
                   clear: () => idb('readwrite', st => st.clear()) };
})();
