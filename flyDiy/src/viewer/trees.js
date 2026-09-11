// trees.js — the ONE place the page turns the baked tree payload into geometry
// and materials. Mirrors props.js: warm the bytes, build once, hand out shared
// buffers. `render_world.js` is the only caller.
//
// WHY THIS EXISTS. The world drew a 14-triangle cone because there was nothing
// else to draw: the bench proved what a real tree costs but a bench cannot hand
// the game geometry. tools/tree_prep.py bakes the curated set; this reads it.
//
// TWO THINGS IT MUST DO THAT NO OTHER LOADER HERE DOES:
//
//   COVERAGE-PRESERVING MIPS. A leaf map is mostly transparent. Averaging it
//   down for the next level averages the ALPHA too, so a texel that was 1.0
//   beside three empty ones becomes 0.25 — and at the material's own cutoff it
//   now fails. Every level loses more of the leaf than the last, so a stand
//   does not soften with distance, it DISSOLVES. The fix (Castano 2010) is to
//   make each level carry the same COVERAGE as level 0 did, found by bisection
//   on an alpha scale. Measured in the bench on the same maps: a larch held
//   32% of its canopy at a 16-texel tile where the preserved chain held 111%.
//   The manifest flags which maps need it, because only the material knows the
//   CUTOFF the coverage has to be preserved against — and those cutoffs run
//   from 0.078 to 0.608 across four collections, so no constant will do.
//
//   THE AO CHANNEL. One byte a vertex, baked with the tree (see 53_tree_codec).
//   It rides an attribute into the shader through onBeforeCompile — this
//   project's own idiom (aeroskin.js does the same to the aeroplane's skin).
(() => {
  'use strict';
  const PACK = (typeof TREE_PACK !== 'undefined') ? TREE_PACK : null;

  const BINS = new Map();          // collection name -> Uint8Array
  const TEX = new Map();           // url -> THREE.Texture
  const BUILT = new Map();         // subject key -> { parts, bb, h }
  let WARM = null;

  const key = (c, s) => c.name + '|' + s.name;

  function treeList() {
    if (!PACK) return [];
    const out = [];
    for (const c of PACK.collections)
      for (const s of c.subjects) out.push({ key: key(c, s), col: c, sub: s });
    return out;
  }

  function treeReady() {
    return !!PACK && PACK.collections.every(c => BINS.has(c.name));
  }

  // One fetch per collection, shared. A failure REJECTS and the world takes
  // its asset-absent path — the cone — exactly as props.js degrades.
  function treeWarm() {
    if (!PACK) return Promise.reject(new Error('trees: no TREE_PACK'));
    if (treeReady()) return Promise.resolve();
    if (WARM) return WARM;
    if (typeof window === 'undefined' || typeof window.ASSET_FETCH !== 'function')
      return Promise.reject(new Error('trees: no ASSET_FETCH here'));
    WARM = Promise.all(PACK.collections.map(c =>
      window.ASSET_FETCH(c.bin).then(buf => { BINS.set(c.name, buf); })));
    return WARM;
  }

  // ---- the alpha rescale, level by level --------------------------------
  function coverage(data, cut, scale) {
    let n = 0;
    for (let i = 3; i < data.length; i += 4)
      if (Math.min(255, data[i] * scale) >= cut) n++;
    return n / (data.length / 4);
  }

  function rescale(data, target, cut) {
    if (target <= 0) return;
    let lo = 0, hi = 64, best = 1;
    for (let it = 0; it < 12; it++) {
      const mid = (lo + hi) * 0.5;
      if (coverage(data, cut, mid) < target) lo = mid; else { hi = mid; best = mid; }
    }
    if (Math.abs(best - 1) < 0.02) return;
    for (let i = 3; i < data.length; i += 4) data[i] = Math.min(255, data[i] * best);
  }

  const pow2 = v => (v & (v - 1)) === 0 && v > 0;

  function coverageMips(THREE, tex, img, cut255) {
    const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
    if (!pow2(w0) || !pow2(h0)) return false;      // the chain only halves cleanly on POT
    const cv = document.createElement('canvas');
    cv.width = w0; cv.height = h0;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    let cur = g.getImageData(0, 0, w0, h0);
    const target = coverage(cur.data, cut255, 1);
    const mips = [cur];
    let w = w0, h = h0;
    while (w > 1 || h > 1) {
      const nw = Math.max(1, w >> 1), nh = Math.max(1, h >> 1);
      const nd = new Uint8ClampedArray(nw * nh * 4);
      const sd = cur.data;
      for (let y = 0; y < nh; y++) {
        const y0 = Math.min(h - 1, y * 2), y1 = Math.min(h - 1, y * 2 + 1);
        for (let x = 0; x < nw; x++) {
          const x0 = Math.min(w - 1, x * 2), x1 = Math.min(w - 1, x * 2 + 1);
          const a = (y0 * w + x0) * 4, b = (y0 * w + x1) * 4,
                c = (y1 * w + x0) * 4, d = (y1 * w + x1) * 4, o = (y * nw + x) * 4;
          // a STRAIGHT box filter off one getImageData: a canvas stores
          // premultiplied colour, so repeated canvas draws bleed the
          // background into every leaf edge — the classic dark fringe
          for (let k = 0; k < 4; k++)
            nd[o + k] = (sd[a + k] + sd[b + k] + sd[c + k] + sd[d + k]) * 0.25;
        }
      }
      rescale(nd, target, cut255);
      cur = new ImageData(nd, nw, nh);
      mips.push(cur);
      w = nw; h = nh;
    }
    tex.mipmaps = mips;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return true;
  }

  // THE MAPS LAND AFTER THE BYTES, and anything that BAKES from a tree has to
  // wait for both. treeWarm resolves on the geometry fetch; the textures load
  // here, one Image each, on their own wall-clock timers. An impostor atlas
  // baked between the two renders leaf cards with no map: no alpha cutout,
  // every card solid, and the far tier is a black silhouette of the whole card
  // cloud - the round black blobs the game showed on every hillside. This is
  // TREE-IMPORT.md §6 trap 2, met in the bench and fixed there with
  // texturesReady(); this is the same promise for the game.
  const PENDING = [];
  function texture(THREE, url, srgb, cut255) {
    let t = TEX.get(url);
    if (t) return t;
    t = new THREE.Texture();
    if (srgb) t.encoding = THREE.sRGBEncoding;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.flipY = false;                       // glTF uv origin is top-left
    const img = new Image();
    PENDING.push(new Promise(res => {
      img.onload = () => {
        t.image = img;
        if (cut255 === null || !coverageMips(THREE, t, img, cut255)) t.needsUpdate = true;
        res(true);
      };
      img.onerror = () => res(false);      // a missing map is not a hung boot
    }));
    img.src = url;
    TEX.set(url, t);
    return t;
  }
  // resolves when every map requested SO FAR has decoded (or failed). Build
  // the subjects first - that is what requests the maps - then wait on this.
  function treeMapsReady() { return Promise.all(PENDING.slice()); }

  // ================= THE LEAF SHADING, ported from the bench ==============
  //
  // WHY. The game's tree materials were MeshLambertMaterial with the AO folded
  // into the albedo: cheap, and wrong in exactly the place a forest is looked
  // at. A leaf card facing away from a 10-degree sun got nothing but a weak
  // hemisphere, and a closed canopy is MOSTLY cards facing away - the dense
  // stand at 4.6 m read as a wall of black silhouettes against the sky. The
  // bench never had that problem, because its foliage carries two terms a
  // plank does not (tools/_trees.html, LEAF_GLSL):
  //
  //   WRAP - a leaf is thin and its normal is a fiction, so the diffuse is
  //   wrapped past the terminator: the cheap stand-in for light bouncing
  //   around inside a canopy.
  //   TRANSLUCENCY - the sun coming THROUGH the leaf toward the eye. Real
  //   foliage glows when you look into the light through it, and no amount of
  //   ambient can do it, because it depends on where the SUN is relative to
  //   the VIEW and not on where the surface faces.
  //
  // Both need the lights per FRAGMENT, which Lambert does not have (it lights
  // per vertex), so the material is MeshStandardMaterial at roughness 1 - and
  // that buys the third thing the dark side was missing, irradiance from the
  // world's own environment map, which Standard reads and Lambert does not.
  //
  // THE AO is split the way the bench splits it: the full exponent on the
  // ambient, 0.35 of it on the sun, because a leaf is not shaded from the sun
  // by having a neighbour. The dials are the bench's committed view, and live
  // on window.TREE_LEAF so a stand can be judged in the game as it was judged
  // in the bench.
  const LEAF = { wrap: 0.76, sss: 0.72, sssp: 3.0, ao: 2.0 };
  const U_WRAP = { value: LEAF.wrap }, U_SSS = { value: LEAF.sss },
        U_SSSP = { value: LEAF.sssp }, U_AO = { value: LEAF.ao };
  // THE ALBEDO PASS. An impostor must bake a G-BUFFER, not a photograph (the
  // bench's W0a.1, TREE-IMPORT.md §6 trap 0): with this at 1 the material
  // writes its surface colour and its baked AO and nothing the lights put in,
  // so the sheet can be lit at draw under any sun. The AO goes in at half the
  // exponent: the geometry splits its occlusion between ambient (full) and
  // sun (0.35) and one albedo cannot, so it takes the middle.
  const U_BAKEALB = { value: 0 };
  // the two leaf terms alone, shared with the impostor material, which lights
  // its sheet through the same words
  const LEAF_TERMS = [
    '#if NUM_DIR_LIGHTS > 0',
    'if (uLeaf > 0.5) {',
    '  vec3 _L = normalize(directionalLights[0].direction);',
    '  vec3 _C = directionalLights[0].color;',
    '  float _ndl = dot(geometry.normal, _L);',
    '  float _w = max(0.0, (_ndl + uWrap) / (1.0 + uWrap)) - max(0.0, _ndl);',
    '  reflectedLight.directDiffuse += diffuseColor.rgb * _C * _w;',
    '  float _b = pow(max(0.0, dot(geometry.viewDir, -_L)), uSSSP);',
    '  reflectedLight.directDiffuse += diffuseColor.rgb * _C * _b * uSSS;',
    '}',
    '#endif',
  ].join('\n');
  const LEAF_GLSL = [
    LEAF_TERMS,
    // the AO, on the lighting and not on the albedo
    'float _ao = pow(clamp(vAoV, 0.0, 1.0), uAoBake);',
    'if (uBakeAlb > 0.5) {',
    // the mask is BINARY: the fragment passed its cutoff, so the sheet says it
    // is there in full. Written at the map's own alpha the sheet capped at
    // 0.53 and the draw's own cutoff threw half the tree away.
    '  diffuseColor.a = 1.0;',
    '  reflectedLight.directDiffuse = diffuseColor.rgb * pow(clamp(vAoV, 0.0, 1.0), uAoBake * 0.5);',
    '  reflectedLight.indirectDiffuse = vec3(0.0);',
    '  reflectedLight.directSpecular = vec3(0.0);',
    '  reflectedLight.indirectSpecular = vec3(0.0);',
    '} else {',
    '  reflectedLight.indirectDiffuse *= _ao;',
    '  reflectedLight.directDiffuse *= pow(clamp(vAoV, 0.0, 1.0), uAoBake * 0.35);',
    '}',
  ].join('\n');
  function hookLeaf(mat, isLeaf) {
    mat.userData.uLeaf = { value: isLeaf ? 1 : 0 };
    mat.onBeforeCompile = sh => {
      sh.uniforms.uLeaf = mat.userData.uLeaf;
      sh.uniforms.uWrap = U_WRAP; sh.uniforms.uSSS = U_SSS;
      sh.uniforms.uSSSP = U_SSSP; sh.uniforms.uAoBake = U_AO;
      sh.uniforms.uBakeAlb = U_BAKEALB;
      sh.vertexShader = 'attribute float aoV;\nvarying float vAoV;\n' +
        sh.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\nvAoV = aoV;');
      sh.fragmentShader = 'uniform float uLeaf, uWrap, uSSS, uSSSP, uAoBake, uBakeAlb;\nvarying float vAoV;\n' +
        sh.fragmentShader.replace('#include <lights_fragment_end>',
          '#include <lights_fragment_end>\n' + LEAF_GLSL);
    };
    return mat;
  }
  const treeLeaf = {
    // the impostor material lights its sheet with the same terms and dials
    uniforms: { uWrap: U_WRAP, uSSS: U_SSS, uSSSP: U_SSSP, uAoBake: U_AO },
    terms: LEAF_TERMS,
    bake: U_BAKEALB,
    get: () => Object.assign({}, LEAF),
    set: o => { for (const k of ['wrap', 'sss', 'sssp', 'ao']) if (o[k] !== undefined) LEAF[k] = +o[k];
      U_WRAP.value = LEAF.wrap; U_SSS.value = LEAF.sss; U_SSSP.value = LEAF.sssp; U_AO.value = LEAF.ao;
      return Object.assign({}, LEAF); },
  };

  // Build one subject's rung, ONCE. Later calls hand out the same buffers:
  // a forest of six hundred firs uploads one fir.
  //
  // `series` picks the ladder: 'rungs' (the specimen, furnished to the ground -
  // the default), 'stand' (the tree inside a wood: top third only, on a stick)
  // or 'snag' (the standing dead one). A series the payload does not carry
  // falls back to the specimen, so an older payload still builds.
  function treeBuild(THREE, k, lod, series) {
    const ser = series || 'rungs';
    const cacheKey = k + '#' + ser + '#' + (lod || 0);
    let built = BUILT.get(cacheKey);
    if (built) return built;
    const found = treeList().find(e => e.key === k);
    if (!found) throw new Error('trees: unknown subject ' + k);
    const bin = BINS.get(found.col.name);
    if (!bin) throw new Error('trees: ' + found.col.name + ' not warmed');
    const ladder = (found.sub[ser] && found.sub[ser].length) ? found.sub[ser] : found.sub.rungs;
    const rung = ladder[Math.min(lod || 0, ladder.length - 1)];
    const parts = [];
    for (const p of rung.parts) {
      const d = decodeTreePart(found.sub.bb, p, bin);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(d.pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(d.nrm, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(d.uv, 2));
      g.setAttribute('aoV', new THREE.BufferAttribute(d.ao, 1));
      g.setIndex(new THREE.BufferAttribute(d.idx, 1));
      const M = (found.col.materials || {})[d.mat] || {};
      const cutout = M.mode && M.mode !== 'OPAQUE';
      const mat = hookLeaf(new THREE.MeshStandardMaterial({
        map: M.base ? texture(THREE, M.base, true,
          cutout && M.coverageMips ? Math.round(255 * (M.cutoff || 0.5)) : null) : null,
        side: cutout ? THREE.DoubleSide : THREE.FrontSide,
        alphaTest: cutout ? (M.cutoff || 0.5) : 0,
        transparent: false, roughness: 1, metalness: 0,
      }), !!cutout);
      mat.name = d.mat;
      parts.push({ geo: g, mat: mat, cutout: !!cutout });
    }
    built = { parts: parts, bb: found.sub.bb, h: found.sub.h,
              tris: rung.tris, col: found.col, sub: found.sub, series: ser, lod: rung.lod,
              // the stand series is drawn STRETCHED - a dial, not geometry; see
              // tree_prep.py's gen_rung on why it cannot be baked
              scaleY: (ser === 'stand' && found.col.place && found.col.place.crownH) || 1 };
    BUILT.set(cacheKey, built);
    return built;
  }

  if (typeof window !== 'undefined') {
    window.TREE_PACK_REG = PACK;
    window.treeWarm = treeWarm;
    window.treeReady = treeReady;
    window.treeList = treeList;
    window.treeBuild = treeBuild;
    window.treeMapsReady = treeMapsReady;
    window.TREE_LEAF = treeLeaf;
  }
})();
