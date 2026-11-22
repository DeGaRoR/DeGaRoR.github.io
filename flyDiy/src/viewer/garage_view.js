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
//   GARAGE_VIEW.S                       the dials (the env's share, the haze, the apron's step under the sill)
// ============================================================================
'use strict';
var GARAGE_VIEW = (() => {
  const S = {
    env: 0.45,          // the sky probe's share on the outdoor materials (hangar.js ENV_OUT: the mood scales it)
    sill: -0.02,        // the scene under the room's floor by this much (hangar.js Y_APRON: the sill is a step, nothing coplanar)
    haze: 1.0,          // the haze's colour: the sky's irradiance x K_HEMI x this
    hazeK: 5.5e-5,      // its density (1 / m): the far ridges fade into the sky as the game's aerial perspective fades them
    treeGain: 1.0,      // the cards' albedo gain
    shadow: 0.42,       // the shed's own shadow on the apron: how much of the light it takes at a clear noon (x the cloud's transmittance)
  };
  const NL = String.fromCharCode(10);
  const HZ = { value: null };   // (vec4: rgb the haze's colour in the scene's light, w its density) - one uniform, every material
  // the haze: one injection, shared (the outdoors carry fog: false - the room's air is the room's)
  const hazed = (THREE, mat) => {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uGvHaze = HZ;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>' + NL + 'varying float vGvDist;')
        .replace('#include <project_vertex>', '#include <project_vertex>' + NL + '  vGvDist = length(mvPosition.xyz);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>' + NL + 'varying float vGvDist;' + NL + 'uniform vec4 uGvHaze;')
        .replace('#include <tonemapping_fragment>', '  gl_FragColor.rgb = mix(uGvHaze.rgb, gl_FragColor.rgb, exp(-vGvDist * uGvHaze.w));' + NL + '#include <tonemapping_fragment>');
    };
    mat.customProgramCacheKey = () => 'gview-haze';
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
    if (!HZ.value) HZ.value = new THREE.Vector4(0.5, 0.6, 0.7, S.hazeK);
    const arr = a => a.t === 'f32' ? new Float32Array(pack.buf, a.at, a.n) : a.t === 'u32' ? new Uint32Array(pack.buf, a.at, a.n) : new Uint16Array(pack.buf, a.at, a.n);
    const std = p => { const m = hazed(THREE, new THREE.MeshStandardMaterial(Object.assign({ roughness: 1, metalness: 0, fog: false, envMapIntensity: S.env }, p))); mats.push(m); return out(m); };
    let tris = 0;
    for (const M of J.meshes) {
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
      else if (M.kind === 'cards') { mat = std({ map, normalMap: M.nrmTex ? pack.tex[M.nrmTex] : null, alphaTest: M.alphaTest || 0.5, vertexColors: true, color: new THREE.Color(S.treeGain, S.treeGain, S.treeGain) }); mat.alphaToCoverage = true; if (!map) { mat.alphaTest = 0; mat.color.setRGB(0.05, 0.09, 0.05); } }
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
    const E = [0, 0, 0];
    return { group, shadow, mats, stats: { meshes: J.meshes.length, tris, textures: Object.keys(pack.tex).length, pictures: pack.pictures || null, bytes: pack.buf.byteLength },
      // the haze takes the day's sky: its irradiance on the scale the room's light stands on
      update(day, L) {
        if (L && L.dir) throwShadow(L.dir, S.shadow * (L.cloudT == null ? 1 : L.cloudT) * (L.isMoon ? 0.5 : 1));
        if (!day || typeof ATMO === 'undefined' || !ATMO.skyIrradiance || typeof SKY_LIGHT === 'undefined') return;
        const K = SKY_LIGHT.K().K_HEMI; if (K == null) return;
        ATMO.skyIrradiance(0, day.sun, E); HZ.value.set(E[0] * K * S.haze, E[1] * K * S.haze, E[2] * K * S.haze, S.hazeK);
      },
      dispose() { group.traverse(m => { if (m.geometry) m.geometry.dispose(); }); for (const m of mats) m.dispose(); for (const k of Object.keys(pack.tex)) pack.tex[k].dispose(); } };
  }
  return { S, find, load, build, haze: HZ };
})();
if (typeof window !== 'undefined') window.GARAGE_VIEW = GARAGE_VIEW;
if (typeof module !== 'undefined' && module.exports) module.exports = GARAGE_VIEW;
