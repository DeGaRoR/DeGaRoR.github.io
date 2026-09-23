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
  // a species' materials are its FILE's, held once in PACK.materials (G454.12): joined here
  if (PACK && PACK.materials) for (const c of PACK.collections) if (!c.materials) c.materials = PACK.materials[c.file] || {};

  const BINS = new Map();          // collection name -> Uint8Array
  const TEX = new Map();           // url -> THREE.Texture
  const BUILT = new Map();         // subject key -> { parts, bb, h }
  let WARM = null;

  const key = (c, s) => c.name + '|' + s.name;

  // THE KINDS (G454.12): the payload is per SPECIES since the biomes - tree, dead (a standing
  // dead tree, L0 alone), shrub, cover, rock, and a flower (`maps`, no geometry). treeList()
  // is THE TREES (tree + dead) as every caller before the biomes expects; treeList(kind) one
  // kind; treeList('all') everything with geometry.
  const isTree = c => !c.kind || c.kind === 'tree' || c.kind === 'dead';
  function treeList(kind) {
    if (!PACK) return [];
    const out = [];
    for (const c of PACK.collections) {
      if (!c.subjects || !c.subjects.length) continue;
      if (kind === 'all' ? false : kind ? c.kind !== kind : !isTree(c)) continue;
      for (const s of c.subjects) out.push({ key: key(c, s), col: c, sub: s });
    }
    return out;
  }
  const withBin = () => PACK ? PACK.collections.filter(c => c.bin) : [];

  function treeReady() {
    return !!PACK && withBin().every(c => BINS.has(c.name));
  }

  // One fetch per collection, shared. A failure REJECTS and the world takes
  // its asset-absent path — the cone — exactly as props.js degrades.
  function treeWarm() {
    if (!PACK) return Promise.reject(new Error('trees: no TREE_PACK'));
    if (treeReady()) return Promise.resolve();
    if (WARM) return WARM;
    if (typeof window === 'undefined' || typeof window.ASSET_FETCH !== 'function')
      return Promise.reject(new Error('trees: no ASSET_FETCH here'));
    WARM = Promise.all(withBin().map(c =>
      (window.BOOT && window.BOOT.expect('treeBin'),
       window.ASSET_FETCH(c.bin).then(buf => { BINS.set(c.name, buf); if (window.BOOT) window.BOOT.landed('treeBin'); },
                                      e => { if (window.BOOT) window.BOOT.landed('treeBin', false, c.name); throw e; }))));
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
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
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
  // W0c.31: the user's dials, read off the F8 panel after the alps tuning
  // (were 0.76 / 0.72 / 3.0 / 2.0, the bench's committed view)
  const LEAF = { wrap: 0.80, sss: 1.12, sssp: 5.75, ao: 4.0 };
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
    // W0.5a: the uniform carries the PHYSICAL intensity now (the row's number
    // times PI, render_world LIGHT_UNIT); the wrap and SSS terms were tuned
    // against the legacy one, so they take it back out
    '  vec3 _C = directionalLights[0].color * RECIPROCAL_PI;',
    // CLOUDS C2: the sun through the cloud layer (clouds.js's splice declares cloudShadow() for every fogged program)
    '#ifdef CLOUD_SHADOW',
    '  _C *= cloudShadow();',
    '#endif',
    '  float _ndl = dot(geometryNormal, _L);',
    '  float _w = max(0.0, (_ndl + uWrap) / (1.0 + uWrap)) - max(0.0, _ndl);',
    '  reflectedLight.directDiffuse += diffuseColor.rgb * _C * _w;',
    '  float _b = pow(max(0.0, dot(geometryViewDir, -_L)), uSSSP);',
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
  // ================= THE TINT AND THE EDGE, ported from the bench ==========
  //
  // The packs were photographed under different suns and sit on different
  // alpha scales, and the bench's whole W0a was bringing them to ONE place:
  // a hue / saturation / lightness per collection on the foliage (the bark
  // takes only its own lightness - tinting a trunk with its crown is how a
  // tree stops looking like a tree), measured against a reference pack and
  // committed in the payload as `tint`. The game drew the raw maps: the fir
  // pack at 1.3 of its lightness in the bench was at 1.0 here, the spruce
  // at 0.54 was at 1.0, and the stand was a different colour from the one
  // that had been judged. MASTER rides over all of them at once.
  // THE TREES NORMALISED TO THE FOREST CELLS (2026-09-22, with the ground's per-set normalisation): the
  // conifer sheets' mean albedo as baked (AO in, tint out) is 0.043 linear; the imagery's forest cells
  // read 0.026 (0.017/0.030/0.009 - a spruce canopy's real albedo). light 1.12 -> 0.6 puts the rendered
  // canopy on the imagery's level; sat 1.58 -> 1.2 (the imagery's green is moderate, g/r 1.75 against
  // the fir map's 1.85 - the boost was against the OLD bright ground). W0c.31 had 1.58 / 1.12 by eye.
  // light 0.6 -> 0.5 (G552, the user: "it needs to be a little darker still ... didn't we have a
  // control to get both the mesh and the impostor darker at once?"). This is that control: the master
  // tint over every collection, read straight by the near geometry's material and carried per layer
  // into the impostor table (IMPA.tbl row 1), so it moves BOTH tiers by the same amount - and it
  // scales the tree's own colour, so unlike G538's clamp the detail survives the darkening.
  // Measured off one frozen boot, forest only: 0.60 -> luma 0.0767 cv 0.425, 0.50 -> 0.0722 cv 0.450,
  // 0.42 -> 0.0687 cv 0.480. Smooth and monotonic, and the cv RISES as it darkens.
  //
  // 0.5 lasted one landing (G553): shown the three panels the user went straight to the darkest,
  // "go C", so this is 0.42 - about 10 % off where G548 left it. It lands on G538's brightness,
  // which they had called a little too dark WHEN IT WAS A SILHOUETTE; at the same luma with the
  // albedo intact it is the look that was wanted all along, which is the whole lesson of G548.
  // TREE_LEAF.tint({ light }) moves it live; TREE_LEAF.master() only READS it.
  const MASTER = { hue: 0.045, sat: 1.2, light: 0.42 };
  const TINT_GLSL = [
    // THE DIAL'S SIGN IS THE MEASUREMENT'S (2026-09-20): the YIQ rotation below turns the
    // OPPOSITE way to the HSL hue the colour pass measures, so every fitted hue (ref - mine)
    // pushed a species further from the reference - the holly went teal, not yellow-green.
    // Measured on one holly: uHue -0.097 rendered at hue 0.474, +0.097 at 0.253 (0.371 at 0).
    // Negated here; the eye-tuned master hue and the shipped payload's hues negated with it.
    'float _a = -uHue * 6.2831853;',
    'float _c = cos(_a), _s = sin(_a);',
    'mat3 _m = mat3(',
    '  0.299 + 0.701*_c + 0.168*_s, 0.587 - 0.587*_c + 0.330*_s, 0.114 - 0.114*_c - 0.497*_s,',
    '  0.299 - 0.299*_c - 0.328*_s, 0.587 + 0.413*_c + 0.035*_s, 0.114 - 0.114*_c + 0.292*_s,',
    '  0.299 - 0.300*_c + 1.250*_s, 0.587 - 0.588*_c - 1.050*_s, 0.114 + 0.886*_c - 0.203*_s);',
    'vec3 _rot = diffuseColor.rgb * _m;',
    // saturation toward luma, so pulling a stand back does not darken it
    'float _y = dot(_rot, vec3(0.2126, 0.7152, 0.0722));',
    // THE CONTRAST (G454.13, the bench's G454.9 calm field): the texel pulled toward the
    // map's own mean lightness by uFlat - a grass card is a soft silhouette of the ground's
    // colour, not a picture of straw. 1 on a tree (the texel as before); a cover's `contrast` dial (0.35).
    'vec3 _f = mix(vec3(uFlatMean), mix(vec3(_y), _rot, uSat), uFlat);',
    'diffuseColor.rgb = clamp(_f * uLight, 0.0, 1.0);',
  ].join('\n');
  // THE FADE (G454.13): a cover instance keeps by its distance to the eye - full to uFadeNear,
  // (1 - t)^(1 + 2 taper) to nothing at uFadeReach - and by the eye's height (uFadeAgl); the
  // instance's own aRand is its threshold, so the ring is planted once at full density and
  // thins in the vertex shader as the eye moves (the trees' uThin, the bench's taper)
  const U_FADE_NEAR = { value: 1e9 }, U_FADE_REACH = { value: 2e9 }, U_FADE_TAPER = { value: 0.5 }, U_FADE_AGL = { value: 1 };
  const FADE_VS = [
    '#ifdef USE_INSTANCING',
    '  vec3 _fp = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;',
    '#else',
    '  vec3 _fp = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;',
    '#endif',
    'float _fd = distance(_fp, cameraPosition);',
    'float _ft = clamp((_fd - uFadeNear) / max(1.0, uFadeReach - uFadeNear), 0.0, 1.0);',
    'float _fk = pow(1.0 - _ft, 1.0 + 2.0 * uFadeTaper) * uFadeAgl;',
    'if (aRand > _fk) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);',
  ].join('\n');
  // THE GRASS SHADES AS THE GROUND (2026-09-22, the user: "its shading looks real harsh"): a tuft is
  // two or three crossed cards, and lit by their own normals half of every tuft faces away from
  // the sun - a field of light and dark halves, the harshness. The fix every grass renderer uses:
  // the card's shading normal is UP (the ground's), so a tuft takes the ground's light, and only
  // its texture and its tint vary. userData.uUp = 1 on a cover material (the ring sets it).
  // ---- THE WIND IN THE TREES (CLIMATE K4, 2026-09-22) -----------------------
  // ONE uniform, shared by every leaf, tuft and card: (wx, wz, phase, gain).
  // The climate's link fills it once a frame from the wind AT THE CAMERA, and
  // `phase` is INTEGRATED there (|w| x dt x k) rather than computed as t x rate,
  // because the rate itself changes with the wind and a product would jog the
  // whole forest the moment it did.
  //
  // FOUR RULES, the vegetation session's, and each one is a thing that breaks:
  //   1. UNIFORM ONLY, so the program cache key (G484's 'fade' / 'fade-leaf' /
  //      'fade-up' / 'fade-up-leaf') needs nothing: gain 0 is a zero bend in the
  //      same program, never a second variant of it.
  //   2. THE COVER SHADES WITH THE GROUND'S NORMAL (G484's uUp). Bend the
  //      POSITION only - touch objectNormal on those and the harsh light/dark
  //      tuft halves come back - and scale by HEIGHT, so a 0.12 m lawn tuft
  //      moves by nothing and a 2 m fern moves.
  //   3. THE IMPOSTOR IS SHEARED, NEVER ROTATED (the baked view direction has to
  //      stay valid), the shear goes in BEFORE the fade's shrink, and the
  //      collapse test stays last - a sheared card could otherwise un-collapse
  //      at the near edge. It is scaled by uDiam because stand cards share this
  //      material: a 47 m card for a 32 m stand would otherwise wave like wheat.
  //   4. Nothing here calls replant(): the fill and the ring keep their own
  //      schedules.
  //
  // TWO LIMITATIONS, named rather than hidden: three's depth material does not
  // run a Standard material's onBeforeCompile, so the SHADOWS do not sway (at
  // these amplitudes, invisible); and an impostor's baked normal is fixed, so a
  // sheared card's shading does not follow its lean (acceptable at the 30 m+
  // where impostors start).
  const U_WIND = { value: (typeof THREE !== 'undefined' && THREE.Vector4) ? new THREE.Vector4(0, 0, 0, 0) : { x: 0, y: 0, z: 0, w: 0 } };
  // a leaf leans with its height above the trunk's base and flutters on its own
  // phase; `hi` is that height, `ph` the per-instance offset
  // BOTH HOOKS RUN ON ONE MATERIAL (2026-09-23, the water session: "uniform vec4 uWind is declared twice
  // ... CommonBark does not compile"): a leaf material that also carries userData.fade goes through
  // hookLeaf AND fadeInject, and each prepended its own `uniform vec4 uWind;` and spliced its own sway
  // block - two declarations of the uniform and of swayPh/swayAmp/swayF in one scope, so every trunk on
  // such a material failed to compile and drew nothing (and vanished from the water's mirror with it).
  // The sway is ONE injection now, BRACED so its locals cannot collide with whatever splices after it,
  // and every prologue line is added only if it is not already there. `ph` is the caller's phase: the
  // leaf's instance id, the ring's aRand.
  const SWAY_MARK = '// tree sway';
  const swayVS = ph => [
    SWAY_MARK,
    '{',
    '  float swayPh = ' + ph + ';',
    '  float swayAmp = uWind.w * (0.012 * max(0.0, transformed.y));',
    '  float swayF = 0.6 + 0.4 * sin(uWind.z + swayPh);',
    '  transformed.xz += uWind.xy * swayAmp * swayF;',
    '}',
  ].join('\n');
  // a prologue line prepended once, and the sway spliced once, whichever hook gets there first
  const declOnce = (src, line) => src.indexOf(line) >= 0 ? src : line + '\n' + src;
  const swayOnce = (src, ph) => src.indexOf(SWAY_MARK) >= 0 ? src
    : src.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + swayVS(ph));
  const UP_VS = 'if (uUp > 0.5) { objectNormal = vec3(0.0, 1.0, 0.0); }';
  const fadeInject = sh => {
    sh.uniforms.uFadeNear = U_FADE_NEAR; sh.uniforms.uFadeReach = U_FADE_REACH; sh.uniforms.uFadeTaper = U_FADE_TAPER; sh.uniforms.uFadeAgl = U_FADE_AGL;
    sh.uniforms.uUp = sh.uniforms.uUp || { value: 0 };
    sh.uniforms.uWind = U_WIND;
    let vs = sh.vertexShader
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + FADE_VS)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n' + UP_VS);
    // the tuft bends BY HEIGHT (a 0.12 m lawn tuft by ~nothing), on the phase `aRand` already
    // carries, and its NORMAL is not touched (see UP_VS)
    vs = swayOnce(vs, 'aRand * 6.2831');
    vs = declOnce(vs, 'uniform vec4 uWind;');
    vs = declOnce(vs, 'uniform float uFadeNear, uFadeReach, uFadeTaper, uFadeAgl, uUp;');
    sh.vertexShader = declOnce(vs, 'attribute float aRand;');
  };
  // upHook(mat): the cover's material shades as the ground (see UP_VS); the uniform is the material's own
  function upHook(mat) {
    mat.userData.uUp = { value: 1 };
    const prev = mat.onBeforeCompile; mat.onBeforeCompile = sh => { if (prev) prev(sh); sh.uniforms.uUp = mat.userData.uUp; };
    mat.customProgramCacheKey = () => 'fade-up' + (mat.userData.uLeaf ? '-leaf' : '');   // a hooked leaf program and a plain one are not the same program
    return mat;
  }
  // fadeHook(mat): a material of the ring's - a hooked leaf material takes it at its own
  // compile (userData.fade), any other gets a hook of its own here
  function fadeHook(mat) {
    mat.userData.fade = true;
    mat.customProgramCacheKey = () => 'fade' + (mat.userData.uLeaf ? '-leaf' : '');
    if (!mat.userData.uLeaf) { const prev = mat.onBeforeCompile; mat.onBeforeCompile = sh => { if (prev) prev(sh); fadeInject(sh); }; }
    return mat;
  }
  // THE TINT IS A DRAW-TIME TERM ON BOTH TIERS (W0c.20). The impostor sheet
  // used to be baked with the tint in it, so a dial that moved a
  // collection's lightness reached the near tier at once and the far tier
  // never - "some impostor trees far too bright" with no way to reach them.
  // The bake skips the tint; the impostor material applies these same words
  // with the collection's own uniforms, shared by reference with its leaf
  // material, so one dial moves the tree at every distance.
  const TINT_LIVE = 'if (uBakeAlb < 0.5) {\n' + TINT_GLSL + '\n}';
  // THE EDGE. Alpha-to-coverage makes coverage equal alpha, and a soft leaf
  // texture then renders every needle half see-through whatever the cutoff;
  // the bench's answer is to rescale alpha by its own screen-space rate of
  // change so coverage tracks the SILHOUETTE, and to drop the hard test to a
  // floor that kills only the empty texels. The game has the eight-sample
  // buffer this needs (the G144 resolve pass). The bake cannot sharpen -
  // fwidth at a 128 px tile puts every texel on 0.5 - so it takes the same
  // step as a HARD mask at the collection's own cutoff.
  const U_SHARP = { value: 0.9 };   // W0c.31: 0.9 by the user's eye
  const EDGE_GLSL = [
    'if (uBakeAlb > 0.5) {',
    '  diffuseColor.a = diffuseColor.a >= uCut ? 1.0 : 0.0;',
    '} else if (uSharp > 0.0) {',
    '  float _aw = max(fwidth(diffuseColor.a), 1e-5);',
    '  diffuseColor.a = clamp((diffuseColor.a - uCut) / _aw * uSharp + 0.5, 0.0, 1.0);',
    '}',
  ].join('\n');
  const HOOKED = [];
  // `tint` is the collection's row; `cut` the part's own cutoff (foliage only)
  function hookLeaf(mat, isLeaf, tint, cut) {
    mat.userData.uLeaf = { value: isLeaf ? 1 : 0 };
    mat.userData.tint = tint || {};
    mat.userData.uHue = { value: 0 }; mat.userData.uSat = { value: 1 }; mat.userData.uLight = { value: 1 };
    mat.userData.uCut = { value: isLeaf ? (cut || 0.5) : 0 };
    mat.userData.uFlat = { value: 1 }; mat.userData.uFlatMean = { value: 0.4 };   // uFlat 1 = the texel as it is (the bench's dial: contrast 1 = no flattening)
    retint(mat);
    HOOKED.push(mat);
    mat.onBeforeCompile = sh => {
      sh.uniforms.uLeaf = mat.userData.uLeaf;
      if (typeof ATMO !== 'undefined') ATMO.inject(sh);   // S4: the aerial-perspective sampler (a hook of its own loses the prototype's)
      sh.uniforms.uWrap = U_WRAP; sh.uniforms.uSSS = U_SSS;
      sh.uniforms.uSSSP = U_SSSP; sh.uniforms.uAoBake = U_AO;
      sh.uniforms.uBakeAlb = U_BAKEALB;
      sh.uniforms.uHue = mat.userData.uHue; sh.uniforms.uSat = mat.userData.uSat;
      sh.uniforms.uLight = mat.userData.uLight;
      sh.uniforms.uCut = mat.userData.uCut; sh.uniforms.uSharp = U_SHARP;
      sh.uniforms.uFlat = mat.userData.uFlat; sh.uniforms.uFlatMean = mat.userData.uFlatMean;
      sh.uniforms.uWind = U_WIND;
      { let vs = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvAoV = aoV;');
        vs = swayOnce(vs, 'float(gl_InstanceID) * 1.7');   // a leaf flutters on its own instance id
        vs = declOnce(vs, 'uniform vec4 uWind;');
        vs = declOnce(vs, 'varying float vAoV;');
        sh.vertexShader = declOnce(vs, 'attribute float aoV;'); }
      if (mat.userData.fade) fadeInject(sh);
      // A LEAF READS THE SHADOW MAP WITH FOUR TAPS, NOT SOFT. The renderer's
      // PCFSoft (the aeroplane's, kept) costs ~16 taps a fragment, and a
      // dense stand on the supersampled tier is the most fragments the frame
      // has: measured 117 ms with it, 54 with plain PCF, on a frame that was
      // 49 before the fill received at all (tools/tree_perf.js). The define
      // comes from the renderer's prefix; undefining it here, before the
      // chunk that reads it, is the material's own choice.
      sh.fragmentShader = '#ifdef SHADOWMAP_TYPE_PCF_SOFT\n#undef SHADOWMAP_TYPE_PCF_SOFT\n#define SHADOWMAP_TYPE_PCF\n#endif\n' +
        'uniform float uLeaf, uWrap, uSSS, uSSSP, uAoBake, uBakeAlb;\n' +
        'uniform float uHue, uSat, uLight, uCut, uSharp, uFlat, uFlatMean;\nvarying float vAoV;\n' +
        sh.fragmentShader
          .replace('#include <map_fragment>',
            '#include <map_fragment>\n' + TINT_LIVE + (isLeaf ? '\n' + EDGE_GLSL : ''))
          .replace('#include <lights_fragment_end>',
            '#include <lights_fragment_end>\n' + LEAF_GLSL);
    };
    return mat;
  }
  function retint(mat) {
    const t = mat.userData.tint, leaf = mat.userData.uLeaf.value > 0.5;
    mat.userData.uHue.value = leaf ? (t.hue || 0) + MASTER.hue : 0;
    mat.userData.uSat.value = leaf ? (t.sat === undefined ? 1 : t.sat) * MASTER.sat : 1;
    mat.userData.uLight.value = (leaf ? (t.light === undefined ? 1 : t.light)
                                      : (t.bark === undefined ? 1 : t.bark)) * MASTER.light;
  }
  // the sway's uniform, for the climate's link to fill (K4)
  if (typeof window !== 'undefined') window.TREE_WIND = U_WIND;
  const treeLeaf = {
    // the impostor material lights its sheet with the same terms and dials
    uniforms: { uWrap: U_WRAP, uSSS: U_SSS, uSSSP: U_SSSP, uAoBake: U_AO },
    terms: LEAF_TERMS,
    tintGlsl: TINT_GLSL,
    // the ring's fade (G454.13): the hook and the four dials, shared by every faded material
    fadeHook: fadeHook, upHook: upHook,
    // what the loader holds (bytes): the decoded rungs and the coverage mip chains
    memory: () => { let geo = 0, mip = 0, n = 0; for (const b of BUILT.values()) for (const q of b.parts) { n++; for (const k in q.geo.attributes) geo += q.geo.attributes[k].array.byteLength; if (q.geo.index) geo += q.geo.index.array.byteLength; }
      for (const t of TEX.values()) if (t.mipmaps) for (const m of t.mipmaps) mip += m.data ? m.data.byteLength : 0; return { parts: n, geoMB: +(geo / 1048576).toFixed(1), mipMB: +(mip / 1048576).toFixed(1), textures: TEX.size }; },
    fade: (near, reach, taper, agl) => { if (near !== undefined) U_FADE_NEAR.value = near; if (reach !== undefined) U_FADE_REACH.value = reach;
      if (taper !== undefined) U_FADE_TAPER.value = taper; if (agl !== undefined) U_FADE_AGL.value = agl; return [U_FADE_NEAR.value, U_FADE_REACH.value, U_FADE_TAPER.value, U_FADE_AGL.value]; },
    // a collection's own row, live on every material that wears it (the
    // rows are shared by reference with the payload's `tint`) and on its
    // impostors through tintGlsl; TREE_LEAF.collections() lists them
    collections: () => (PACK ? PACK.collections : []).map(c => ({ name: c.name, kind: c.kind || 'tree', tint: c.tint || (c.tint = {}) })),
    tintOf: (name, o) => {
      const c = (PACK ? PACK.collections : []).find(x => x.name === name);
      if (!c) return null;
      c.tint = c.tint || {};
      for (const k of ['hue', 'sat', 'light', 'bark']) if (o && o[k] !== undefined) c.tint[k] = +o[k];
      for (const m of HOOKED) if (m.userData.tint === c.tint) retint(m);
      return Object.assign({}, c.tint);
    },
    bake: U_BAKEALB,
    get: () => Object.assign({}, LEAF),
    set: o => { for (const k of ['wrap', 'sss', 'sssp', 'ao']) if (o[k] !== undefined) LEAF[k] = +o[k];
      U_WRAP.value = LEAF.wrap; U_SSS.value = LEAF.sss; U_SSSP.value = LEAF.sssp; U_AO.value = LEAF.ao;
      return Object.assign({}, LEAF); },
    // the master tint over every collection, and the edge sharpen:
    // TREE_LEAF.tint({ light: 1.2 }), TREE_LEAF.sharp(0) for the plain cutoff
    master: () => Object.assign({}, MASTER),
    tint: o => { for (const k of ['hue', 'sat', 'light']) if (o[k] !== undefined) MASTER[k] = +o[k];
      for (const m of HOOKED) retint(m); return Object.assign({}, MASTER); },
    sharp: v => { if (v !== undefined) U_SHARP.value = +v; return U_SHARP.value; },
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
    const found = treeList('all').find(e => e.key === k);
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
      // the bench's rule: the pack's own MASK cutoff is the floor, the
      // collection's `alpha` dial can only raise it
      const T = found.col.tint || {};
      const cut = cutout ? (Math.max(M.cutoff || 0, T.alpha || 0) || 0.5) : 0;
      const mat = hookLeaf(new THREE.MeshStandardMaterial({
        map: M.base ? texture(THREE, M.base, true,
          cutout && M.coverageMips ? Math.round(255 * cut) : null) : null,
        side: cutout ? THREE.DoubleSide : THREE.FrontSide,
        // the sharpen owns the cutout (uCut); the hard test only kills the
        // empty texels, and the eight-sample buffer resolves the edge
        alphaTest: cutout ? 0.01 : 0, alphaToCoverage: !!cutout,
        transparent: false, roughness: 1, metalness: 0,
      }), !!cutout, T, cut);
      mat.name = d.mat;
      parts.push({ geo: g, mat: mat, cutout: !!cutout });
    }
    built = { parts: parts, bb: found.sub.bb, h: found.sub.h,
              tris: rung.tris, col: found.col, sub: found.sub, series: ser, lod: rung.lod,
              // the stand series is drawn STRETCHED - a dial, not geometry; see
              // tree_prep.py's gen_rung on why it cannot be baked
              scaleY: (ser === 'stand' && isTree(found.col) && found.col.kind !== 'dead' && found.col.place && found.col.place.crownH) || 1 };
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
