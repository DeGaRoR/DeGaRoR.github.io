// ============================================================================
// garage_view.js — THE WORLD OUT OF THE HANGAR'S DOOR, COOKED (GARAGE-VIEW, 22 Nov 2026)
//
// The user, 22 Nov: "the world outside keeps being really, really ugly ... recreate as accurately as possible the real
// world, including with its nice ground shading ... and the accurate distances for everything. It will measure in the
// world what are the distances ... something which looks as close as possible to the game, but without costing much on
// the garage."
//
// What stood outside the club hangar and the large hangar was drawn by hand in hangar.js (a flat field, the strip and
// the aprons through the analytic field's quarter turn - 41 degrees off Jolene's real sheds - box cars, a ring of tree
// cards). This is the MEASURED world instead, cooked once by tools/garage_view/ (measure.js, census.js, capture.js,
// ground_merge.js, cook.js) into one scene both sheds share:
//   ground   the game's own terrain heights, wearing the game's own ground seen from above (two resolutions: about a
//            centimetre a texel in front of each door, the whole pavement under it), then the land out to the skyline
//   trees    every tree the game draws within 700 m, at its place, height and sink, as a card of its species' own
//            impostor sheet (the game draws impostors past 30 m: the nearest tree is 62 m from a door), lit by the sun
//            through the sheet's own normals
//   props    the buildings and the vehicles near, the game's own shapes
//   far      everything past 700 m (the far forest, the ridges, the summits) as one band of the game's own pixels
// The SKY, the clouds, the sun and the hour stay the room's (hangar.js applyDay: the game's atmosphere in the shed's
// frame). The scene is static geometry: 6-8 draws, 4 small programs, no per-frame work but one haze colour.
//
//   GARAGE_VIEW.find(world, field, shed) -> Promise<row | null>  the cooked scene for a room: src/core/garage_view_packs.json
//                                          (tools/garage_view/install.js writes it: one row an airfield, the sheds it serves)
//   GARAGE_VIEW.load(base)              -> Promise<pack>  scene.json + scene.bin + its pictures, off the main path (the room
//                                          stands without it: it arrives behind the first garage view)
//   GARAGE_VIEW.build(THREE, pack, o)   -> { group, mats, stats, update(day), dispose() }
//                                          o.shed { x, y, z, ry } the room's shed in the world (its TRUE yaw); the group is
//                                          the scene in the room's frame (the door at local -x, the floor at y 0)
//                                          o.outdoor(mat) the room's own list of outdoor materials (lit off the sky's probe)
//   GARAGE_VIEW.S                       the dials (the sky's gain, the haze, the cards' gain, the apron's step under the sill)
// ============================================================================
'use strict';
var GARAGE_VIEW = (() => {
  const S = {
    sill: -0.02,        // the scene under the room's floor by this much (hangar.js Y_APRON: the sill is a step, nothing coplanar)
    hemi: 2.0,          // the sky's light over the alps anchor (render_world's island row: hemi 0.55 over 0.274), as the WORLD lights its ground
    hemiUnder: 0.0,     // a gain of its own under a cloud, over the game's law (clouds.js hemiUnder, taken in update), 0 until judged
    gnd: [0.10, 0.11, 0.07],   // the land's mean albedo (linear): what the ground throws back up under a card or an eave (sky_light groundHalf)
    haze: 1.6,          // the haze's colour: the sky's mean radiance x this (the horizon is brighter than the mean)
    hazeK: 5.5e-5,      // its density (1 / m): the far ridges fade into the sky as the game's aerial perspective fades them
    unit: Math.PI,      // THE WORLD'S UNIT (render_world LIGHT_UNIT): the scene is lit as the world lights its ground. At the room's own unit (1) the
                        // shade fell into the tone curve's toe (22 Nov: the apron black under a cloud, where the game shows it blue-grey)
    cloudFar: 0.6,      // far from the shed the sun is the SKY's mean (1 - this x the cover), not the one cloud over the door: the game's cloud shadow is a patch
    cloudR: [60, 420],  // ...from the door's cloud to the mean, over these metres
    treeGain: 2.0,      // the cards' gain: the game lights a leaf by its environment too (measured 22 Nov at noon: the cards a third of the game's against the sky)
    shadow: 0.92,       // the shed's own shadow on the apron: this much of the SUN's share of the light goes (the sky's stays)
  };
  const NL = String.fromCharCode(10);
  // THE SCENE'S LIGHT IS THE WORLD'S, NOT THE ROOM'S (the first garage pictures, 22 Nov: the apron came out warm and four times too
  // bright against the sky - the room's lamps and its probe were lighting the outdoors, as they light hangar.js's own slab). The
  // scene's materials are UNLIT for three and carry the day themselves: the sun (the room's key: its colour and strength, the cloud's
  // transmittance in it) on N.L, and the sky's hemisphere (sky_light.js's own law: K_HEMI x the sky's irradiance x the island's gain,
  // the ground's half below) - the two lights the world's ground is lit by, in the units the room's sky dome is drawn in. No lamp,
  // no probe, no shadow map: one small program (two with the cards' normal map).
  const U = { sun: { value: null }, sky: { value: null }, gnd: { value: null }, dir: { value: null }, haze: { value: null }, cloud: { value: null } };
  const lit = (THREE, mat, nrm) => {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uGvSun = U.sun; sh.uniforms.uGvSky = U.sky; sh.uniforms.uGvGnd = U.gnd; sh.uniforms.uGvDir = U.dir; sh.uniforms.uGvHaze = U.haze; sh.uniforms.uGvCloud = U.cloud;
      if (nrm) sh.uniforms.uGvNrm = { value: nrm };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>' + NL + 'varying float vGvDist;' + NL + 'varying vec3 vGvN;')
        .replace('#include <project_vertex>', '#include <project_vertex>' + NL + '  vGvDist = length(mvPosition.xyz);' + NL + '  vGvN = normalize(mat3(modelMatrix) * normal);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>' + NL + 'varying float vGvDist;' + NL + 'varying vec3 vGvN;' + NL +
          'uniform vec3 uGvSun, uGvSky, uGvGnd, uGvDir;' + NL + 'uniform vec4 uGvHaze, uGvCloud;' + (nrm ? NL + 'uniform sampler2D uGvNrm;' : ''))
        .replace('#include <opaque_fragment>', [
          '  vec3 gvN = normalize(vGvN);',
          // a card: its sheet's normal (right, up, toward the eye) stood in the card's own frame (the card is upright: its right = up x its face)
          nrm ? '  { vec3 t = texture2D(uGvNrm, vMapUv).xyz * 2.0 - 1.0; vec3 f = normalize(vec3(gvN.x, 0.0, gvN.z)); vec3 r = normalize(cross(vec3(0.0, 1.0, 0.0), f)); gvN = normalize(t.x * r + t.y * vec3(0.0, 1.0, 0.0) + t.z * f); }' : '',
          // (a card is leaves: the game's own WRAP past the terminator, trees.js LEAF_TERMS - a leaf is thin and its normal a fiction)
          nrm ? '  float gvL = dot(gvN, uGvDir); gvL = max(gvL, 0.0) + (max(0.0, (gvL + 0.8) / 1.8) - max(0.0, gvL));' : '  float gvL = max(dot(gvN, uGvDir), 0.0);',
          // (the sun through the cloud over the DOOR near, through the sky's mean far: uGvCloud = here, far, r0, r1)
          '  gvL *= mix(uGvCloud.x, uGvCloud.y, smoothstep(uGvCloud.z, uGvCloud.w, vGvDist));',
          '  outgoingLight = diffuseColor.rgb * (uGvSun * gvL + mix(uGvGnd, uGvSky, gvN.y * 0.5 + 0.5));',
          '#include <opaque_fragment>',
          '  gl_FragColor.rgb = mix(uGvHaze.rgb, gl_FragColor.rgb, exp(-vGvDist * uGvHaze.w));'].join(NL));
    };
    mat.customProgramCacheKey = () => 'gview-lit' + (nrm ? '-n' : '');
    return mat;
  };

  // ---- the pack list: fetched once; a room without a row keeps its own outdoors --------------------------------------------
  let LIST = null;
  const BASE = () => (typeof window !== 'undefined' && window.FLYDIY_ASSET_BASE) || '';
  function find(world, field, shed) {
    if (!LIST) LIST = fetch(BASE() + 'src/core/garage_view_packs.json').then(r => (r.ok ? r.json() : { packs: [] })).catch(() => ({ packs: [] }));
    return LIST.then(P => (P.packs || []).find(p => p.world === world && p.field === field && (p.sheds || []).some(s => s.id === shed)) || null);
  }
  // ---- the pack ------------------------------------------------------------------------------------------------------
  async function load(base, THREE) {
    const J = await (await fetch(base + 'scene.json')).json();
    const buf = await (await fetch(base + 'scene.bin')).arrayBuffer();
    const tex = {};
    const dress = (t, T) => { t.flipY = false; t.colorSpace = T.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.magFilter = THREE.LinearFilter;
      t.anisotropy = (typeof window !== 'undefined' && window.FLYDIY_ANISO) || 8; return t; };
    const st = { ktx2: 0, plain: 0 };
    await Promise.all(Object.keys(J.textures || {}).map(async k => {
      const T = J.textures[k];
      // THE KTX2 TWIN (tools/garage_view/ktx2.js): transcoded in a worker to the GPU's own blocks, its mips inside - a quarter of
      // the plain picture's memory and no decode or mip on the frame. KTX2.off says when the page cannot (?ktx2=0, no format)
      if (T.ktx2 && typeof KTX2 !== 'undefined' && !KTX2.off('gview')) {
        try { const r = await KTX2.load(base + T.ktx2, 'gview'), t = dress(new THREE.CompressedTexture(r.mipmaps, r.width, r.height, r.format, r.type), T);
          t.generateMipmaps = false; t.minFilter = r.mipmaps.length > 1 ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter; t.needsUpdate = true; tex[k] = t; st.ktx2++; return; } catch (e) { /* the plain picture */ }
      }
      const blob = await (await fetch(base + T.file)).blob();
      // decoded off the main thread; the rows as the file has them (flipY is the texture's own, set below)
      const bmp = await createImageBitmap(blob, { imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
      const t = dress(new THREE.Texture(bmp), T); t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; tex[k] = t; st.plain++;
    }));
    return { J, buf, tex, base, pictures: st };
  }

  // ---- the scene, in a shed's room frame ---------------------------------------------------------------------------------
  function build(THREE, pack, o) {
    const J = pack.J, sh = o.shed, group = new THREE.Group(), mats = [], out = o.outdoor || (m => m);
    group.name = 'room:gview'; group.userData.outdoor = true;
    // world -> room: the shed stands at (x, y, z) turned by ry; the scene's own frame is the world about J.origin
    const c = Math.cos(sh.ry), s = Math.sin(sh.ry), dx = J.origin[0] - sh.x, dz = J.origin[2] - sh.z;
    group.rotation.y = -sh.ry; group.position.set(dx * c - dz * s, J.origin[1] - sh.y + S.sill, dx * s + dz * c);
    group.updateMatrix(); group.matrixAutoUpdate = false;
    if (!U.sun.value) { U.sun.value = new THREE.Vector3(0.8, 0.8, 0.8); U.sky.value = new THREE.Vector3(0.15, 0.17, 0.2); U.gnd.value = new THREE.Vector3(0.03, 0.03, 0.02); U.dir.value = new THREE.Vector3(0.3, 0.8, 0.5).normalize(); U.haze.value = new THREE.Vector4(0.2, 0.25, 0.3, S.hazeK); }
    if (!U.cloud.value) U.cloud.value = new THREE.Vector4(1, 1, S.cloudR[0], S.cloudR[1]);
    const arr = a => a.t === 'f32' ? new Float32Array(pack.buf, a.at, a.n) : a.t === 'u32' ? new Uint32Array(pack.buf, a.at, a.n) : new Uint16Array(pack.buf, a.at, a.n);
    const std = (p, nrm) => { const m = lit(THREE, new THREE.MeshBasicMaterial(Object.assign({ fog: false }, p)), nrm || null); mats.push(m); return m; };
    let tris = 0;
    for (const M of J.meshes) {
      if (M.at && Math.hypot(M.at[0] - sh.x, M.at[1] - sh.z) < 12) continue;   // this room's own shed, as the world shows it from outside: not round the room itself
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(arr(M.pos), 3));
      if (M.nrm) g.setAttribute('normal', new THREE.BufferAttribute(arr(M.nrm), 3));
      if (M.uv) g.setAttribute('uv', new THREE.BufferAttribute(arr(M.uv), 2));
      if (M.col) g.setAttribute('color', new THREE.BufferAttribute(arr(M.col), M.kind === 'decal' ? 4 : 3));
      g.setIndex(new THREE.BufferAttribute(arr(M.idx), 1));
      if (!M.nrm) g.computeVertexNormals();
      g.computeBoundingSphere();
      const map = M.tex ? pack.tex[M.tex] : null;
      let mat;
      if (M.kind === 'decal') mat = std({ map, transparent: true, depthWrite: false, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      else if (M.kind === 'cards') { mat = std({ map, alphaTest: M.alphaTest || 0.5, vertexColors: true, color: new THREE.Color(S.treeGain, S.treeGain, S.treeGain) }, map && M.nrmTex ? pack.tex[M.nrmTex] : null); mat.alphaToCoverage = true; if (!map) { mat.alphaTest = 0; mat.color.setRGB(0.05, 0.09, 0.05); } }
      else if (M.kind === 'ring') mat = std({ vertexColors: true });
      else if (M.kind === 'props') mat = std({ map, side: M.doubleSide ? THREE.DoubleSide : THREE.FrontSide });
      else if (M.kind === 'far') { mat = std({ map, alphaTest: M.alphaTest || 0.5, side: THREE.DoubleSide }); mat.alphaToCoverage = true; }   // the far band: the game's own pixels past 700 m, lit as ground is
      else mat = std(map ? { map } : { color: new THREE.Color(0.12, 0.13, 0.11) });
      const m = new THREE.Mesh(g, mat); m.name = 'gview:' + M.name; m.castShadow = false; m.receiveShadow = false; m.renderOrder = M.kind === 'decal' ? 3 : (M.order || 0);
      m.matrixAutoUpdate = false; m.userData.gview = M.kind; group.add(m); tris += M.tris;
    }
    // THE SHED'S OWN SHADOW ON THE APRON (the game's door view shows it; the room's key light only shadows the shed's box): the
    // shed's block (its eave box and its ridge) thrown along the light onto the apron - one dark fan, in the ROOM's frame, moved
    // when the light has moved; under the room's floor inside the walls, so only the apron wears it
    let shadow = null, shDir = null; const D = o.dims;
    if (D) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12 * 3), 3)); g.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 6, 0, 6, 7, 0, 7, 8, 0, 8, 9, 0, 9, 10, 0, 10, 11]);
      shadow = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x05070c, transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      shadow.name = 'gview:shadow'; shadow.renderOrder = 4; shadow.frustumCulled = false; shadow.userData.outdoor = true; shadow.visible = false; mats.push(shadow.material); }
    const throwShadow = (d, k) => { if (!shadow) return; if (!(d[1] > 0.035) || !(k > 0.01)) { shadow.material.opacity = 0; return; }
      shadow.material.opacity = k;
      if (shDir && d[0] * shDir[0] + d[1] * shDir[1] + d[2] * shDir[2] > 0.99999) return; shDir = d.slice();
      // the block's top points thrown to the ground (a point at height h lands h / d.y along the light, capped at 400 m), and the
      // footprint's corners: their hull, wound as a fan about its first point
      const P = [], add = (x, y, z) => { const t = Math.min(400, y / d[1]); P.push([x - d[0] * t, z - d[2] * t]); };
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { add(sx * D.HD, 0, sz * D.HW); add(sx * D.HD, D.EAVE, sz * D.HW); }
      add(-D.HD, D.RIDGE || D.EAVE + 2.6, 0); add(D.HD, D.RIDGE || D.EAVE + 2.6, 0);
      P.sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o2, a, b) => (a[0] - o2[0]) * (b[1] - o2[1]) - (a[1] - o2[1]) * (b[0] - o2[0]), lo = [], up = [];
      for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
      for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
      const H = lo.slice(0, -1).concat(up.slice(0, -1)), A = shadow.geometry.attributes.position;
      for (let i = 0; i < 12; i++) { const p = H[Math.min(i, H.length - 1)]; A.setXYZ(i, p[0], S.sill + 0.016, p[1]); }
      A.needsUpdate = true; };
    const E = [0, 0, 0], lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    return { group, shadow, mats, stats: { meshes: J.meshes.length, tris, textures: Object.keys(pack.tex).length, pictures: pack.pictures || null, bytes: pack.buf.byteLength },
      // THE DAY: L = { dir (the light's direction in the room's frame), keyI + keyC (the room's key as sky_light.js set it: the sun
      // or the moon, the cloud's transmittance in it), cloudT, isMoon }. The scene's four colours, in radiance per unit albedo
      update(day, L) {
        if (!day || !L || !L.dir || typeof ATMO === 'undefined' || !ATMO.skyIrradiance || typeof SKY_LIGHT === 'undefined') return;
        const K = SKY_LIGHT.K(); if (K.K_HEMI == null) return;
        const kc = L.keyC ? [L.keyC.r, L.keyC.g, L.keyC.b] : [1, 1, 1], kI = L.keyI || 0, cT = L.cloudT == null ? 1 : L.cloudT, PI = Math.PI;
        ATMO.skyIrradiance(0, day.sun, E);
        const mE = Math.max(E[0], E[1], E[2], 1e-9), hI = K.K_HEMI * lum(E) * S.hemi * (typeof CLOUDS !== 'undefined' && CLOUDS.hemiUnder ? CLOUDS.hemiUnder(cT) : 1) * (1 + S.hemiUnder * (1 - cT)), sc = [E[0] / mE, E[1] / mE, E[2] / mE], dy = Math.max(0, L.dir[1]);
        U.dir.value.set(L.dir[0], L.dir[1], L.dir[2]);
        // the sun with NO cloud in it (the room's key carries the door's cloud: sky_light keyGain): the shader puts the cloud back, by distance
        let I0 = kI; if (!L.isMoon) { if (cT > 0.05) I0 = kI / cT; else if (ATMO.sunTransmittance) { const T3 = [0, 0, 0]; ATMO.sunTransmittance(0, day.sun[1], T3);
          const el = Math.asin(Math.max(-1, Math.min(1, day.sun[1]))) * 180 / PI; I0 = (K.K_SUN || 0) * Math.max(T3[0], T3[1], T3[2]) * Math.min(1, Math.max(0, (el + 1.5) / 2)); } }
        const un = S.unit / PI, cHere = L.isMoon ? 1 : cT, cFar = L.isMoon ? 1 : Math.max(cHere, 1 - S.cloudFar * Math.max(0, Math.min(1, +day.cloudCover || 0)));
        U.cloud.value.set(cHere, cFar, S.cloudR[0], S.cloudR[1]);
        U.sun.value.set(kc[0] * I0 * un, kc[1] * I0 * un, kc[2] * I0 * un);
        U.sky.value.set(sc[0] * hI * un, sc[1] * hI * un, sc[2] * hI * un);
        // the ground's half (sky_light groundHalf): the land's albedo x what falls on it
        U.gnd.value.set(S.gnd[0] * (kc[0] * kI * dy + sc[0] * hI) * un, S.gnd[1] * (kc[1] * kI * dy + sc[1] * hI) * un, S.gnd[2] * (kc[2] * kI * dy + sc[2] * hI) * un);
        // the haze: the sky's mean radiance (its irradiance over pi, on the dome's scale), the horizon's share over it
        const kh = (K.K_SUN || 0) / PI * S.haze; U.haze.value.set(E[0] * kh, E[1] * kh, E[2] * kh, S.hazeK);
        // the shed's shadow: the sun's share of what falls on level ground goes
        const sunP = lum(kc) * kI * dy, skyP = lum(sc) * hI; throwShadow(L.dir, sunP + skyP > 0 ? S.shadow * sunP / (sunP + skyP) : 0);
      },
      dispose() { group.traverse(m => { if (m.geometry) m.geometry.dispose(); }); for (const m of mats) m.dispose(); for (const k of Object.keys(pack.tex)) pack.tex[k].dispose(); } };
  }
  return { S, find, load, build, light: U };
})();
if (typeof window !== 'undefined') window.GARAGE_VIEW = GARAGE_VIEW;
if (typeof module !== 'undefined' && module.exports) module.exports = GARAGE_VIEW;
