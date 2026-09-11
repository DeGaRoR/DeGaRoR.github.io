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

  function texture(THREE, url, srgb, cut255) {
    let t = TEX.get(url);
    if (t) return t;
    t = new THREE.Texture();
    if (srgb) t.encoding = THREE.sRGBEncoding;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.flipY = false;                       // glTF uv origin is top-left
    const img = new Image();
    img.onload = () => {
      t.image = img;
      if (cut255 === null || !coverageMips(THREE, t, img, cut255)) t.needsUpdate = true;
    };
    img.src = url;
    TEX.set(url, t);
    return t;
  }

  // AO rides a custom attribute; nothing in three.js knows about it, so the
  // shader is told. Applied to the albedo rather than the ambient term because
  // the world's canopy is Lambert and has no separate indirect to modulate —
  // cruder than the bench's split, and the right cost here.
  function hookAO(mat) {
    mat.userData.uAo = { value: 1 };
    mat.onBeforeCompile = sh => {
      sh.uniforms.uAo = mat.userData.uAo;
      sh.vertexShader = 'attribute float aoV;\nvarying float vAoV;\n' +
        sh.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\nvAoV = aoV;');
      sh.fragmentShader = 'uniform float uAo;\nvarying float vAoV;\n' +
        sh.fragmentShader.replace('#include <map_fragment>',
          '#include <map_fragment>\ndiffuseColor.rgb *= mix(1.0, clamp(vAoV, 0.0, 1.0), uAo);');
    };
    return mat;
  }

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
      const mat = hookAO(new THREE.MeshLambertMaterial({
        map: M.base ? texture(THREE, M.base, true,
          cutout && M.coverageMips ? Math.round(255 * (M.cutoff || 0.5)) : null) : null,
        side: cutout ? THREE.DoubleSide : THREE.FrontSide,
        alphaTest: cutout ? (M.cutoff || 0.5) : 0,
        transparent: false,
      }));
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
  }
})();
