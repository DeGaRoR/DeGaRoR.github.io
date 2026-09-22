// GENERATED FILE - DO NOT EDIT. Built by tools/lot_tex_prep.js from
// assets/lot/ (CC0: ambientCG; see CREDITS.md). The files live under
// media/tex/lot/ (hash-in-filename); a map's Image is made when a consumer
// first reads it (a getter), and every consumer waits on img.complete/onload.
// The TABLE below is the baker's; LOT_GROUND after the rule line is hand-
// written and kept across re-bakes (see lot_tex_prep.js).
//
// THE LOT'S GROUND (G290): five sets the lot ground shader splats by the
// plan's own weights - grass and dense grass mixed on a noise, dry ground
// under the buildings, pebbles at the seafront, dirt on the paths.
const LOT_TEX_SETS = (typeof Image !== 'undefined') ? (() => {
  const B = (typeof FLYDIY_ASSET_BASE !== 'undefined') ? FLYDIY_ASSET_BASE : '';
  // A SET LOADS WHEN IT IS READ (LOADING S4.1): the maps are getters, the
  // Image made on first access (one per url); nothing here fetches at script eval
  const IM = {};
  const mk = src => IM[src] || (IM[src] = (() => { const i = new Image(); i.src = B + src; return i; })());
  return {
    lush: { name: 'dense grass', tile: 2.4, px: 512,
      get diff() { return mk('media/tex/lot/lush_diff_512.90a67ae0.jpg'); },
      get nor() { return mk('media/tex/lot/lush_nor_gl_512.379ad06b.jpg'); },
      get rough() { return mk('media/tex/lot/lush_rough_512.8f65b07b.jpg'); } },
    grass: { name: 'grass', tile: 2.4, px: 512,
      get diff() { return mk('media/tex/lot/grass_diff_512.7cc9f4c2.jpg'); },
      get nor() { return mk('media/tex/lot/grass_nor_gl_512.151550a5.jpg'); },
      get rough() { return mk('media/tex/lot/grass_rough_512.f5626b4f.jpg'); } },
    pebble: { name: 'pebbles', tile: 4.5, px: 512,
      get diff() { return mk('media/tex/lot/pebble_diff_512.00fbe38a.jpg'); },
      get nor() { return mk('media/tex/lot/pebble_nor_gl_512.b29a459b.jpg'); },
      get rough() { return mk('media/tex/lot/pebble_rough_512.d985d705.jpg'); } },
    dry: { name: 'dry ground', tile: 2.2, px: 512,
      get diff() { return mk('media/tex/lot/dry_diff_512.9f177ab8.jpg'); },
      get nor() { return mk('media/tex/lot/dry_nor_gl_512.89d1ffc2.jpg'); },
      get rough() { return mk('media/tex/lot/dry_rough_512.8360b752.jpg'); } },
    dirt: { name: 'dirt path', tile: 1.8, px: 512,
      get diff() { return mk('media/tex/lot/dirt_diff_512.c5983cf7.jpg'); },
      get nor() { return mk('media/tex/lot/dirt_nor_gl_512.27f8e9b2.jpg'); },
      get rough() { return mk('media/tex/lot/dirt_rough_512.a924c560.jpg'); } },
  };
})() : null;

// ---------------------------------------------------------------------------
// THE LOT'S GROUND, DRAWN (G290; moved here from tools/_village.html at G378
// so the premises bench draws the same patch - one keeper): one patch per
// lot from the plan's own splat (tools/_village_gen.js lotGround): five sets
// in world metres, the two grasses mixed on the slow noise the plan carried
// and a finer one here, the dense grass pulled in by the fences, dry ground
// under the buildings, dirt on the paths, pebbles at the seafront, a slow
// colour tint over the grass so no two lawns match, the skirt's darkening
// folded in, and an alpha that fades the patch into the terrain across the
// margin. `material(THREE, onLoad)` is ONE material for every patch;
// `mesh(THREE, parent, L, onLoad)` stands a lotGround plan under `parent`.
// ---------------------------------------------------------------------------
const LOT_GROUND = (() => {
  const LOT = LOT_TEX_SETS || null;
  const LOT_TEX = {};
  function lotTex(THREE, onLoad, k, m, srgb) {
  const ck = k + '|' + m;
  if (LOT_TEX[ck]) return LOT_TEX[ck];
  const img = LOT[k][m];
  const t = new THREE.Texture(img);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  const ok = () => { t.needsUpdate = true; if (onLoad) onLoad(); };
  if (img.complete && img.naturalWidth) t.needsUpdate = true;
  else img.addEventListener('load', ok);
  LOT_TEX[ck] = t;
  return t;
  }
  let LOT_MAT = null;
  function material(THREE, onLoad) {
  if (LOT_MAT) return LOT_MAT;
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0,
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  if (LOT) {
    m.map = lotTex(THREE, onLoad, 'grass', 'diff', true);
    m.normalMap = lotTex(THREE, onLoad, 'grass', 'nor', false);
    m.normalScale = new THREE.Vector2(0.8, 0.8);
    m.roughness = 0.98;                        // matte, like the terrain
  }
  const U = {
    uLushN: { value: LOT ? lotTex(THREE, onLoad, 'lush', 'nor', false) : null },
    uDryN: { value: LOT ? lotTex(THREE, onLoad, 'dry', 'nor', false) : null },
    uDirtN: { value: LOT ? lotTex(THREE, onLoad, 'dirt', 'nor', false) : null },
    uPebN: { value: LOT ? lotTex(THREE, onLoad, 'pebble', 'nor', false) : null },
    uLush: { value: LOT ? lotTex(THREE, onLoad, 'lush', 'diff', true) : null },
    uDry: { value: LOT ? lotTex(THREE, onLoad, 'dry', 'diff', true) : null },
    uDirt: { value: LOT ? lotTex(THREE, onLoad, 'dirt', 'diff', true) : null },
    uPeb: { value: LOT ? lotTex(THREE, onLoad, 'pebble', 'diff', true) : null },
    uTiles: { value: new THREE.Vector4(LOT ? LOT.lush.tile : 2.4, LOT ? LOT.dry.tile : 2.2, LOT ? LOT.dirt.tile : 1.8, LOT ? LOT.pebble.tile : 1.6) },
    uGrassTile: { value: LOT ? LOT.grass.tile : 2.4 },
    // THE LAWN'S GRADE (2026-09-22, the user: "don't you find the grass of the patches a tad too
    // green?"): the two grass sets are a temperate nursery green - beside the muskeg, the dry grass
    // and the beige street of an Alaskan village they read as astroturf. (saturation, value, warmth):
    // the saturation pulled toward the luma, the value down a touch, a little warmth back in so the
    // lawn keeps its life. LOT_GROUND.grade(s, v, w) moves it live (the A/B is one step).
    uLawn: { value: new THREE.Vector3(0.70, 0.93, 0.5) },
  };
  m.onBeforeCompile = sh => {
    for (const k in U) sh.uniforms[k] = U[k];
    if (typeof ATMO !== 'undefined') ATMO.inject(sh);   // S4: the aerial-perspective sampler (a hook of its own loses the prototype's)
    sh.vertexShader = 'attribute vec4 aSplat;\nattribute vec2 aTone;\nattribute float aAlpha;\n' +
      'varying vec4 vSplat;\nvarying vec2 vTone;\nvarying float vAlpha;\nvarying vec3 vLotP;\n' +
      sh.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n  vSplat = aSplat; vTone = aTone; vAlpha = aAlpha; vLotP = transformed;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n  vMapUv = position.xz / ' + (LOT ? LOT.grass.tile : 2.4).toFixed(3) + ';');
    sh.fragmentShader = 'varying vec4 vSplat;\nvarying vec2 vTone;\nvarying float vAlpha;\nvarying vec3 vLotP;\n' +
      'uniform sampler2D uLush, uDry, uDirt, uPeb;\nuniform sampler2D uLushN, uDryN, uDirtN, uPebN;\nuniform vec4 uTiles;\nuniform vec3 uLawn;\n' +
      'float lwGm, lwDry, lwPeb, lwDirt;\n' +
      'float lHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n' +
      'float lNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);\n' +
      '  return mix(mix(lHash(i), lHash(i + vec2(1, 0)), f.x), mix(lHash(i + vec2(0, 1)), lHash(i + vec2(1, 1)), f.x), f.y); }\n' +
      'float lFbm(vec2 p) { return lNoise(p) * 0.5 + lNoise(p * 2.1 + 3.7) * 0.3 + lNoise(p * 4.3 + 9.1) * 0.2; }\n' +
      sh.fragmentShader.replace('#include <map_fragment>',
        '  {\n' +
        '    vec2 w = vLotP.xz;\n' +
        '    vec4 cGrass = texture2D(map, vMapUv);\n' +
        '    vec4 cLush = texture2D(uLush, w / uTiles.x);\n' +
        '    vec4 cDry = texture2D(uDry, w / uTiles.y);\n' +
        '    vec4 cDirt = texture2D(uDirt, w / uTiles.z);\n' +
        '    vec4 cPeb = texture2D(uPeb, w / uTiles.w);\n' +
        '    float n1 = lFbm(w * 0.35), n2 = lFbm(w * 1.7 + 5.0);\n' +
        // THE TWO GRASSES on a noise: the plan's slow mask, a finer one here,
        // and the fences pulling the dense grass in
        '    float gm = smoothstep(0.35, 0.65, vSplat.x * 0.6 + n1 * 0.4);\n' +
        '    gm = max(gm, vTone.y * (0.7 + 0.3 * n2));\n' +
        '    vec3 col = mix(cGrass.rgb, cLush.rgb, gm);\n' +
        // the tint: a slow drift of hue and value over the lawn
        '    float t1 = lFbm(w * 0.06 + 20.0), t2 = lFbm(w * 0.11 + 40.0);\n' +
        '    col *= mix(vec3(1.06, 0.98, 0.86), vec3(0.88, 1.0, 0.92), t1) * (0.82 + 0.36 * t2);\n' +
        // dense grass by the fence is also a shade darker and greener
        '    col *= mix(vec3(1.0), vec3(0.86, 0.94, 0.84), vTone.y);\n' +
        // THE LAWN'S GRADE: the grass only (the dry, the pebbles and the dirt are mixed in below)
        '    {\n' +
        '      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));\n' +
        '      vec3 warm = mix(vec3(1.0), vec3(1.05, 0.995, 0.90), uLawn.z);\n' +
        '      col = mix(vec3(lum), col, uLawn.x) * uLawn.y * warm;\n' +
        '    }\n' +
        // dry under the buildings, pebbles at the seafront, dirt on the paths -
        // each edge broken by the finer noise
        '    float wd = smoothstep(0.25, 0.75, vSplat.y + (n2 - 0.5) * 0.35);\n' +
        '    col = mix(col, cDry.rgb, wd);\n' +
        '    float wp = smoothstep(0.3, 0.7, vSplat.w + (n2 - 0.5) * 0.3);\n' +
        '    col = mix(col, cPeb.rgb, wp);\n' +
        '    float wt = smoothstep(0.3, 0.75, vSplat.z + (n2 - 0.5) * 0.3);\n' +
        '    col = mix(col, cDirt.rgb, wt);\n' +
        '    lwGm = gm; lwDry = wd; lwPeb = wp; lwDirt = wt;\n' +
        // the skirt's darkening, folded in
        '    col *= 1.0 - vTone.x;\n' +
        '    diffuseColor = vec4(col, vAlpha);\n' +
        '  }')
      // EACH SET ITS OWN NORMAL (G293, the user: "I feel like there is still
      // a single normal map for all materials"): the five normal maps
      // blended by the same weights the colours were, then perturbed once
      .replace('#include <normal_fragment_maps>',
        '  {\n' +
        '    vec2 w2 = vLotP.xz;\n' +
        '    vec3 nG = texture2D(normalMap, vMapUv).xyz * 2.0 - 1.0;\n' +
        '    vec3 nL = texture2D(uLushN, w2 / uTiles.x).xyz * 2.0 - 1.0;\n' +
        '    vec3 nD = texture2D(uDryN, w2 / uTiles.y).xyz * 2.0 - 1.0;\n' +
        '    vec3 nT = texture2D(uDirtN, w2 / uTiles.z).xyz * 2.0 - 1.0;\n' +
        '    vec3 nP = texture2D(uPebN, w2 / uTiles.w).xyz * 2.0 - 1.0;\n' +
        '    vec3 mapN = mix(nG, nL, lwGm);\n' +
        '    mapN = mix(mapN, nD, lwDry); mapN = mix(mapN, nP, lwPeb); mapN = mix(mapN, nT, lwDirt);\n' +
        '    mapN = normalize(mapN);\n' +
        '    mapN.xy *= normalScale;\n' +
        '    normal = normalize(tbn * mapN);\n' +
        '  }');
  };
  m.userData.uLawn = U.uLawn;
  LOT_MAT = m;
  return m;
  }
  function mesh(THREE, parent, L, onLoad) {
  if (!L.idx.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(L.pos), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(L.uv), 2));
  geo.setAttribute('aSplat', new THREE.BufferAttribute(new Float32Array(L.splat), 4));
  geo.setAttribute('aTone', new THREE.BufferAttribute(new Float32Array(L.tone), 2));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(L.alpha), 1));
  geo.setIndex(L.idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, material(THREE, onLoad));
  m.renderOrder = 3;
  m.receiveShadow = true; m.castShadow = false;
  parent.add(m);
  return L;
  }

  // the lawn's grade, live: LOT_GROUND.grade(saturation, value, warmth) - the A/B in one step
  function grade(sat, val, warm) {
    if (!LOT_MAT || !LOT_MAT.userData.uLawn) return null;
    const v = LOT_MAT.userData.uLawn.value;
    if (sat !== undefined && sat !== null) v.x = +sat;
    if (val !== undefined && val !== null) v.y = +val;
    if (warm !== undefined && warm !== null) v.z = +warm;
    return [v.x, v.y, v.z];
  }
  return { material, mesh, grade };
})();
if (typeof window !== 'undefined') window.LOT_GROUND = LOT_GROUND;
