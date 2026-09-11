// ===========================================================================
// THE AERODROME'S GROUND — one factory, both scenes (G123)
// ===========================================================================
// src/core/25_airfield.js says WHERE the base aerodrome is; this says what its
// ground is made of. It exists because the alternative was two copies: the
// garage grew a texture helper, a blade atlas, a crossed-quad tuft and a
// scatter, and the world scene needed the same four to stop the field you taxi
// on from disagreeing with the field you were just looking at through the door.
//
// The same reasoning as props.js, which is THE ONE material factory for the
// shed's furniture: a scene decides WHERE something goes and how it is lit;
// what it is made of is decided once.
//
// Nothing here registers, lights or places anything. The garage puts these
// materials through its own `outdoor()` list and its own envMapIntensity; the
// world hands them its own anisotropy and render order. That split is
// deliberate — the two scenes genuinely are lit differently, and pretending
// otherwise is what would make this file wrong.

// ---- textures --------------------------------------------------------------
// Metric uv is the contract: the planes these dress carry uv in METRES, so a
// repeat of 1/tile makes one texture tile `tile` metres of real ground. r128
// has ONE uv transform per material, taken from .map, so every map on a
// material follows the albedo's repeat — which is why tile is per material and
// not per map.
function siteGroundTex(THREE, img, srgb, tile, aniso) {
  const t = new THREE.Texture(img);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso || 8;
  if (srgb) t.encoding = THREE.sRGBEncoding;
  t.repeat.set(1 / tile, 1 / tile);
  // A LISTENER, NOT `img.onload = ok`. These Images are SHARED — the world's
  // runway base and pad, the garage's field, the hangar's own floor all
  // build textures off the one SITE_TEX_SETS / HANGAR_FLOOR_IMG object —
  // and an onload PROPERTY holds one function: every consumer after the
  // first silently unhooked the one before it, so whichever texture was
  // built first (the world's, at boot) never got its needsUpdate. A texture
  // that never uploads samples an unbound unit, which is BLACK: black
  // albedo, and a black roughness map is roughness 0 — a mirror of the sky.
  // That was the runway (and the floor) "sometimes not textured, and blue
  // under some angles": the race between the image landing and the second
  // consumer being built decided it, per map, per boot.
  const ok = () => { t.needsUpdate = true; };
  if (img.complete && img.naturalWidth) ok();
  else img.addEventListener('load', ok, { once: true });
  return t;
}

// the three maps of one library set, or null when the payload is absent — the
// caller falls back to whatever it drew by hand, exactly as the floor does
function siteGroundMaps(THREE, key, tile, aniso) {
  const SETS = (typeof SITE_TEX_SETS !== 'undefined') ? SITE_TEX_SETS : null;
  const set = SETS && SETS[key];
  if (!set) return null;
  return {
    map: siteGroundTex(THREE, set.diff, true, tile, aniso),
    normalMap: siteGroundTex(THREE, set.nor, false, tile, aniso),
    roughnessMap: siteGroundTex(THREE, set.rough, false, tile, aniso),
    normalScale: new THREE.Vector2(1, 1),
  };
}

// ---- the blades ------------------------------------------------------------
// Drawn rather than scanned: none of the delivered ground sets carries an alpha
// channel, and a tuft is mostly alpha. Forty-four short wide blades, because
// twenty-six tall thin ones read as reeds standing in water and a card that is
// mostly empty wastes its own fill rate.
function siteBladeTexture(THREE, rnd, aniso) {
  const rr = (a, b) => a + (b - a) * rnd();
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 44; i++) {
    const x0 = rr(18, 238), w = rr(6, 14), h = rr(62, 186), lean = rr(-30, 30);
    const dark = rnd() < 0.5;
    const grad = g.createLinearGradient(0, 256, 0, 256 - h);
    grad.addColorStop(0, dark ? '#3c4a22' : '#4a5a2a');
    grad.addColorStop(0.6, dark ? '#5c7033' : '#6d823c');
    grad.addColorStop(1, dark ? '#7d9448' : '#93a659');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(x0 - w / 2, 256);
    g.quadraticCurveTo(x0 - w / 4 + lean * 0.5, 256 - h * 0.55, x0 + lean, 256 - h);
    g.quadraticCurveTo(x0 + w / 4 + lean * 0.5, 256 - h * 0.55, x0 + w / 2, 256);
    g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = aniso || 8;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// TWO QUADS CROSSED, AND EVERY FACE WOUND BOTH WAYS. The obvious build — two
// quads with `side: DoubleSide` — renders half of every tuft BLACK, and the
// reason is three's own normal handling: `normal_fragment_begin` does
// `normal *= float(gl_FrontFacing) * 2.0 - 1.0`, so on a back face the up-normal
// these cards carry becomes a DOWN normal pointing into the ground, and the
// blade gets no light at all. Winding both ways and keeping the material
// FrontSide is what fixes it; the normal stays up, so a blade is lit like the
// ground it stands in rather than like a wall.
function siteTuftGeometry(THREE) {
  const one = new THREE.PlaneGeometry(1, 1);
  one.translate(0, 0.5, 0);
  const two = one.clone(); two.rotateY(Math.PI / 2);
  const g = new THREE.BufferGeometry();
  const pa = [], na = [], ua = [], ia = [];
  let base = 0;
  for (const src of [one, two]) {
    const P = src.attributes.position, U = src.attributes.uv, I = src.index;
    for (let i = 0; i < P.count; i++) {
      pa.push(P.getX(i), P.getY(i), P.getZ(i));
      na.push(0, 1, 0);
      ua.push(U.getX(i), U.getY(i));
    }
    for (let i = 0; i < I.count; i += 3) {
      const a = I.getX(i) + base, b = I.getX(i + 1) + base, c = I.getX(i + 2) + base;
      ia.push(a, b, c, c, b, a);
    }
    base += P.count;
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pa, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(na, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(ua, 2));
  g.setIndex(ia);
  return g;
}

// THE SCATTER HAS A HORIZON, and it is there because of aliasing rather than
// cost. A 40 cm blade at a hundred metres is thinner than a pixel; alpha-tested,
// it cannot fade, so it flickers as a dark speck and the far field reads as dirt
// rather than grass. Inside `radius` the tufts are what give the ground its
// parallax; beyond it the scanned texture is better than anything sub-pixel
// geometry can do — and over the last fifteen metres they shrink into it rather
// than stopping at a line, because a hard edge reads as a mown boundary that
// nothing explains.
//
// `blocks` are world-frame rects a tuft may not stand in. A tuft growing through
// the apron is worse than no tuft at all.
function siteScatter(rnd, o) {
  const rr = (a, b) => a + (b - a) * rnd();
  const blocks = o.blocks || [];
  const blocked = (x, z) => {
    for (const b of blocks)
      if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return true;
    return false;
  };
  const rows = [], N = o.count, R = o.radius;
  for (let i = 0; i < N * 3 && rows.length < N; i++) {
    const x = rr(o.x0, o.x1), z = rr(o.z0, o.z1);
    if (blocked(x, z)) continue;
    const d = Math.hypot(x - o.cx, z - o.cz);
    if (d > R) continue;
    if (rnd() > Math.min(1, o.near / (d + 10))) continue;
    const fade = Math.min(1, (R - d) / 15);
    rows.push([x, z, rr(0, 6.3), rr(0.24, 0.50) * (0.35 + 0.65 * fade), rr(0.85, 1.2)]);
  }
  return rows;
}

// one InstancedMesh, one draw call, whatever the count
function siteTufts(THREE, rows, mat, y) {
  const m = new THREE.InstancedMesh(siteTuftGeometry(THREE), mat, rows.length);
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(),
        p = new THREE.Vector3(), sv = new THREE.Vector3(),
        up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    q.setFromAxisAngle(up, r[2]);
    p.set(r[0], y, r[1]);
    sv.set(r[3] * r[4], r[3], r[3]);
    m.setMatrixAt(i, mtx.compose(p, q, sv));
  }
  m.instanceMatrix.needsUpdate = true;
  m.castShadow = false;        // thousands of casters for 40 cm of grass
  m.receiveShadow = true;
  m.frustumCulled = false;
  return m;
}

// ---- edge fade -------------------------------------------------------------
// A bounded patch of scanned grass laid over terrain that is painted a different
// colour needs to stop being there without an edge. The falloff is computed from
// the RAW `uv` attribute on its own varying, because vUv arrives already
// multiplied by the albedo's metric repeat — the same reason the garage's macro
// break-up carries its own coordinate.
// `w`/`d` are the patch's size IN METRES, and they are not optional: the planes
// this dresses carry METRIC uv so the albedo can tile, so `uv` runs 0..w, not
// 0..1. Writing the falloff against a 0..1 uv — which is what it looks like it
// should be — makes `abs(uv - 0.5) * 2` enormous everywhere and the whole patch
// vanishes at alpha 0. It did.
function siteEdgeFade(THREE, mat, soft, w, d) {
  const NL = String.fromCharCode(10);
  mat.transparent = true;
  mat.onBeforeCompile = sh => {
    sh.uniforms.uFadeSize = { value: new THREE.Vector2(w, d) };
    sh.uniforms.uFadeK = { value: soft == null ? 0.34 : soft };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>' + NL + 'varying vec2 vFadeUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>' + NL + '  vFadeUv = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>',
               '#include <common>' + NL + 'varying vec2 vFadeUv;' + NL +
               'uniform float uFadeK;' + NL + 'uniform vec2 uFadeSize;')
      .replace('#include <alphamap_fragment>',
               '#include <alphamap_fragment>' + NL +
               '  { vec2 e = abs(vFadeUv / uFadeSize - 0.5) * 2.0;' + NL +
               '    float d = max(e.x, e.y);' + NL +
               '    diffuseColor.a *= 1.0 - smoothstep(1.0 - uFadeK, 1.0, d); }');
  };
  // r128 caches programs on the hook's SOURCE, so the key has to say what this
  // injection is or two differently-faded patches share one program
  mat.customProgramCacheKey = () => 'site-fade-' + (soft == null ? 0.34 : soft);
  return mat;
}
