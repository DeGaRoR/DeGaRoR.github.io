// plume.js — A PLUME, one recipe (2026-09-22, the user: "Maybe we can also
// generalize the smoke emission used for houses to generate the exhale
// plume?").
//
// WHAT THE VILLAGE'S CHIMNEYS DO (G254 + G449, tools/_house_gen.js
// `buildSmoke` / `shadeSmoke`): a column of camera-agnostic CROSSED quads at
// rising heights, each a puff of radius R0 + age * R1; the puff is a soft
// disc torn by two octaves of a value noise that scrolls UPWARD with uTime,
// so the column seems to rise without a vertex ever moving; it is a BasicMaterial
// — a haze, not a lit thing — multiplied by `uSmokeLit`, which the day's own
// exposure drives so a dusk column is not a white pillar. Thirty-six
// triangles. That look is the one this module makes portable.
//
// WHAT IS DIFFERENT HERE. A chimney is a STANDING column: its puffs are a
// static ladder and only the noise moves. A whale's blow is an EVENT — six
// metres in a second and a half, then gone. So the puffs carry a DELAY
// instead of a height, `uT` is the seconds since the blow, and the rise, the
// spread and the fade are computed in the VERTEX shader from that one clock:
// one uniform a frame drives the whole column and nothing is rebuilt.
//
// WHY THE CHIMNEY'S OWN COPY IS NOT MOVED HERE. `tools/_house_gen.js` is the
// village's generator and GATE CLOUD asserts the smoke's shader against that
// file's own SOURCE (`(0.85 + 0.25 * n) * uSmokeLit`, rule G449). Lifting the
// body out of it would move the village's smoke to fix a whale, which is a
// regression wearing a refactor's clothes. So the RECIPE is shared as
// numbers — `PLUME.RECIPE` below is the chimney's, to the digit — and GATE
// ANIMALS asserts the two agree. One look, two emitters, neither able to
// drift without a gate going red.
//
//   PLUME.make(THREE, preset|opts) -> { mesh, u, fire(x, y, z, dx, dz), step(dt),
//                                       stop(), alive, dispose() }
//   PLUME.PRESETS.blow / .chimney / .puff / .mist
//
// THE MIST (16 Nov 2026, ANIMALS; the user on the slot-2 stills: "the water effects are quite rough" - the blows were
// grey eggs: the chimney's smoke, its grey and its haze, on a whale). A whale's blow is not smoke: it is WATER - a spout
// of fine droplets thrown up at 10 m/s, braking in the air within a third of a second, hanging as a white cloud the wind
// shears (the top drifts the most) and evaporating in four or five seconds. Bright: a droplet cloud scatters the sun
// FORWARD, so against the light it glows. kind 'mist' is its own draw on the same handle (fire / step / lit / stop):
//   n camera-facing droplet-cloud puffs, each with its own share of the spout's height, lateral jitter and size; the
//   height h(t) = rise x share x (1 - exp(-t / tau)) less a little settling; the spread grows as sqrt(age); the drift
//   is the lean (the wind, the way on) x t x (0.3 + 0.7 share); white x uSmokeLit (the day's hand, as the chimneys)
//   x (0.8 + a forward-scatter lobe on the world's key light, found once by walking the scene). The grain: two
//   octaves of the noise at the droplets' scale, not the smoke's. The chimney's recipe above is untouched (GATE
//   ANIMALS 8); 'blow' stays the smoke's for a caller that wants it.
'use strict';
(function () {
const P = {};

// the chimney's own numbers (tools/_house_gen.js SMOKE_R0 / SMOKE_R1 / the
// smoke material's colour / the noise and lit laws). GATE ANIMALS reads both.
P.RECIPE = { R0: 0.18, R1: 1.15, colour: 0xb9b5ae, scroll: 0.35, oct: [0.6, 0.4],
             edge: [1.0, 0.25], base: 0.35, lit: [0.85, 0.25] };

P.PRESETS = {
  // A WHALE'S BLOW: a spout six to nine metres up in a second, spreading to a
  // three-metre mist, gone in four. `n` puffs is the column's grain.
  blow:    { n: 9, rise: 7.5, spread: 2.6, life: 4.0, delay: 0.9, k: 0.7, lean: 0.35, r0: 0.25 },
  // the chimney, for a caller that wants a standing column from here
  chimney: { n: 9, rise: 3.2, spread: 1.15, life: 1e9, delay: 0, k: 0.55, lean: 0.35, r0: 0.18 },
  // a small one-shot: a splash's hanging mist, a snort
  puff:    { n: 5, rise: 1.6, spread: 0.9, life: 2.2, delay: 0.5, k: 0.5, lean: 0.2, r0: 0.12 },
  // A WHALE'S BLOW AS WATER (the mist above): 28 droplet clouds, up in ~0.3 s (tau), hanging, gone in five
  mist:    { kind: 'mist', n: 28, rise: 7.5, spread: 2.2, life: 5.0, delay: 0.12, tau: 0.3, k: 0.45, lean: 0.35, r0: 0.16,
             colour: 0xf1f4f6, fwd: 1.4 },
};

const VERT_HEAD = `
  attribute float aDelay;      // this puff's share of uDelay
  attribute vec2 aQuad;        // the corner, unit, in the quad's own plane
  attribute float aAxis;       // 0: the x-up quad, 1: the z-up one
  uniform float uT, uLife, uDelay, uRise, uSpread, uR0;
  uniform vec2 uLean;
  varying vec2 vSm; varying float vAge, vFade;`;
const VERT_BODY = `
  float u = clamp((uT - aDelay * uDelay) / uLife, 0.0, 1.0);
  float born = step(0.0, uT - aDelay * uDelay);
  float r = uR0 + u * uSpread;
  vec3 c = vec3(uLean.x * u * u, u * uRise, uLean.y * u * u);
  vec3 ax = aAxis < 0.5 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 0.0, 1.0);
  transformed = c + (ax * aQuad.x + vec3(0.0, 1.0, 0.0) * aQuad.y) * r;
  vSm = aQuad * r;
  vAge = u;
  // in over the first eighth, out over the last two fifths (a puff thins as
  // it spreads), and nothing at all before its delay
  vFade = born * smoothstep(0.0, 0.12, u) * (1.0 - smoothstep(0.58, 1.0, u));`;

const FRAG_HEAD = `
  varying vec2 vSm; varying float vAge, vFade;
  uniform float uTime, uK, uSmokeLit, uR0, uSpread;
  float sHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float sNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(sHash(i), sHash(i + vec2(1, 0)), f.x),
               mix(sHash(i + vec2(0, 1)), sHash(i + vec2(1, 1)), f.x), f.y);
  }`;
// the chimney's own body, with `vAge`'s two jobs split: there it is BOTH the
// puff's height up the column and its thinning; here the height is the clock
// and the thinning is vFade
const FRAG_BODY = `
  {
    // G960: the varyings clamped - an MSAA edge sample extrapolates them
    float sAge = clamp(vAge, 0.0, 1.0), sFade = clamp(vFade, 0.0, 1.0);
    float r = uR0 + sAge * uSpread;
    float d = length(vSm) / max(r, 1e-4);
    vec2 q = vSm / max(r, 1e-4) * 2.2 + vec2(0.0, -uTime * 0.35) + sAge * 3.1;
    float n = sNoise(q) * 0.6 + sNoise(q * 2.3 + 7.0) * 0.4;
    float a = smoothstep(1.0, 0.25, d) * (0.35 + 0.65 * n) * sFade * uK;
    diffuseColor.a *= a;
    diffuseColor.rgb *= (0.85 + 0.25 * n) * uSmokeLit;
  }`;

function geometry(THREE, n) {
  const pos = [], quad = [], axis = [], delay = [], idx = [];
  let v = 0;
  for (let i = 0; i < n; i++) {
    const d = n > 1 ? i / (n - 1) : 0;
    for (let k = 0; k < 2; k++) {
      for (const [qx, qy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        pos.push(0, 0, 0); quad.push(qx, qy); axis.push(k); delay.push(d);
      }
      idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
      v += 4;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('aQuad', new THREE.BufferAttribute(new Float32Array(quad), 2));
  g.setAttribute('aAxis', new THREE.BufferAttribute(new Float32Array(axis), 1));
  g.setAttribute('aDelay', new THREE.BufferAttribute(new Float32Array(delay), 1));
  g.setIndex(idx);
  // the column never moves in its own frame, and its size is known: one
  // sphere, inflated once, so nothing recomputes it and nothing culls early
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1);
  return g;
}

P.make = function (THREE, opts) {
  const o = Object.assign({}, P.PRESETS[typeof opts === 'string' ? opts : 'blow'],
                          typeof opts === 'string' ? {} : (opts || {}));
  if (o.kind === 'mist') return makeMist(THREE, o);
  const u = { uT: { value: -1 }, uTime: { value: 0 }, uLife: { value: o.life },
              uDelay: { value: o.delay }, uRise: { value: o.rise }, uSpread: { value: o.spread },
              uR0: { value: o.r0 }, uK: { value: o.k }, uSmokeLit: { value: 1 },
              uLean: { value: new THREE.Vector2(o.lean, 0) } };
  const mat = new THREE.MeshBasicMaterial({ color: o.colour === undefined ? P.RECIPE.colour : o.colour,  // pre-ok: x uSmokeLit, which carries P (LAMPS.smokeK)
                                            transparent: true, opacity: 1, depthWrite: false,
                                            side: THREE.DoubleSide, fog: true });
  mat.name = 'plume';
  mat.onBeforeCompile = sh => {
    for (const k in u) sh.uniforms[k] = u[k];
    sh.vertexShader = VERT_HEAD + '\n' + sh.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_BODY);
    sh.fragmentShader = FRAG_HEAD + '\n' + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_BODY);
  };
  const g = geometry(THREE, o.n);
  g.boundingSphere.radius = o.rise + o.spread + o.r0;
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'plume';
  mesh.frustumCulled = true;
  mesh.castShadow = false; mesh.receiveShadow = false;
  mesh.renderOrder = 11;
  mesh.visible = false;
  const H = {
    mesh, u, mat, opts: o,
    get alive() { return u.uT.value >= 0 && u.uT.value < o.life + o.delay; },
    // fire it at a point, leaning along (dx, dz) — the wind, or the animal's
    // own way on. The column lives in world space from there.
    fire(x, y, z, dx, dz) {
      mesh.position.set(x, y, z);
      u.uLean.value.set(dx || 0, dz || 0);
      u.uT.value = 0;
      mesh.visible = true;
      return H;
    },
    step(dt) {
      u.uTime.value += dt;
      if (u.uT.value >= 0) {
        u.uT.value += dt;
        if (u.uT.value > o.life + o.delay) { u.uT.value = -1; mesh.visible = false; }
      }
      return H;
    },
    stop() { u.uT.value = -1; mesh.visible = false; return H; },
    // the day's hand, exactly as render_premises drives the chimneys (G449)
    lit(k) { u.uSmokeLit.value = k; return H; },
    dispose() { g.dispose(); mat.dispose(); if (mesh.parent) mesh.parent.remove(mesh); },
  };
  return H;
};

// ---- THE MIST (see the header) ------------------------------------------------------------------------------------------
const MIST_VERT_HEAD = `
  attribute float aDelay; attribute vec2 aQuad; attribute vec4 aSeed;   // seed: x the height share, y z the lateral way, w the size
  uniform float uT, uLife, uDelay, uRise, uSpread, uR0, uTau, uFwd;
  uniform vec2 uLean; uniform vec3 uSun;
  varying vec2 vQ; varying float vFade, vScat; varying vec4 vSeed;`;
const MIST_VERT_BODY = `
  float tm = max(uT - aDelay * uDelay, 0.0);
  float u = clamp(tm / uLife, 0.0, 1.0);
  float born = step(0.0, uT - aDelay * uDelay);
  float h = uRise * aSeed.x * (1.0 - exp(-tm / uTau)) - 0.08 * tm * tm * (1.0 - aSeed.x);
  float spr = uR0 + uSpread * aSeed.w * sqrt(u) * (0.35 + 0.65 * aSeed.x);
  float lf = 0.3 + 0.7 * aSeed.x;
  transformed = vec3(aSeed.y * spr * 0.8 + uLean.x * tm * lf, max(h, 0.0), aSeed.z * spr * 0.8 + uLean.y * tm * lf);
  float rad = uR0 * 1.6 + 0.6 * uSpread * aSeed.w * sqrt(u);
  vQ = aQuad; vSeed = aSeed;
  vFade = born * smoothstep(0.0, 0.03, u) * (1.0 - smoothstep(0.3, 1.0, u)) * (1.0 - 0.35 * (1.0 - aSeed.x) * u);
  vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
  float cs = dot(normalize(wp - cameraPosition), normalize(uSun));
  vScat = uFwd * pow(max(cs, 0.0), 5.0);`;
const MIST_PROJECT = `
  vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
  mvPosition.xy += aQuad * rad;
  gl_Position = projectionMatrix * mvPosition;`;
const MIST_FRAG_HEAD = `
  varying vec2 vQ; varying float vFade, vScat; varying vec4 vSeed;
  uniform float uTime, uK, uSmokeLit;
  float mHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float mNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mHash(i), mHash(i + vec2(1, 0)), f.x), mix(mHash(i + vec2(0, 1)), mHash(i + vec2(1, 1)), f.x), f.y);
  }`;
const MIST_FRAG_BODY = `
  {
    float sF = clamp(vFade, 0.0, 1.0);
    float d = length(vQ);
    vec2 q = vQ * 2.6 + vSeed.yz * 9.0 + vec2(0.0, uTime * 0.6);
    float n = mNoise(q) * 0.55 + mNoise(q * 3.1 + 5.0) * 0.45;   // the droplets' grain, not the smoke's lumps
    // (GROUND-FX review: ~10 quads overlap in the core - at full k the column read opaque; the top thins, the low skirt stays dense)
    float a = exp(-3.2 * d * d) * (1.0 - smoothstep(0.75, 1.0, d)) * (0.3 + 0.7 * n) * sF * uK * (1.0 - 0.5 * vSeed.x);
    diffuseColor.a *= a;
    diffuseColor.rgb *= min(0.8 + 0.2 * n + 0.8 * vScat, 1.6) * uSmokeLit;   // (capped: into the sun, a glow, not a bloom ball)
  }`;
// the key light: the scene's brightest directional light, found once per scene (none: the default sun below)
const KEY = new WeakMap();
function keyLight(obj) {
  let r = obj; while (r && r.parent) r = r.parent;
  if (!r || r === obj) return null;
  let L = KEY.get(r);
  if (L && L.parent) return L;
  L = null;
  r.traverse(o => { if (o.isDirectionalLight && (!L || o.intensity > L.intensity)) L = o; });
  if (L) KEY.set(r, L);
  return L;
}
function makeMist(THREE, o) {
  const n = o.n || 28, pos = [], quad = [], seed = [], delay = [], idx = [];
  let s = 0x9e3779b9, v = 0;
  const rnd = () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5) >>> 0; return s / 4294967296; };
  for (let i = 0; i < n; i++) {
    // the column's share: most of the water near the top, a skirt low; the way out, round; the size, +-35 %
    const sh = 0.3 + 0.7 * Math.sqrt(rnd()), a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()), sz = 0.65 + 0.7 * rnd(), d = rnd();
    for (const [qx, qy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { pos.push(0, 0, 0); quad.push(qx, qy); seed.push(sh, Math.cos(a) * rr, Math.sin(a) * rr, sz); delay.push(d); }
    idx.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('aQuad', new THREE.BufferAttribute(new Float32Array(quad), 2));
  g.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(seed), 4));
  g.setAttribute('aDelay', new THREE.BufferAttribute(new Float32Array(delay), 1));
  g.setIndex(idx);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, o.rise * 0.5, 0), o.rise + o.spread + 4 * (o.lean || 0) * o.life);
  const u = { uT: { value: -1 }, uTime: { value: 0 }, uLife: { value: o.life }, uDelay: { value: o.delay }, uRise: { value: o.rise },
              uSpread: { value: o.spread }, uR0: { value: o.r0 }, uTau: { value: o.tau || 0.3 }, uK: { value: o.k }, uFwd: { value: o.fwd == null ? 1.4 : o.fwd },
              uSmokeLit: { value: 1 }, uLean: { value: new THREE.Vector2(0, 0) }, uSun: { value: new THREE.Vector3(-0.4, 0.75, 0.5) } };
  // (MATLIB's basic shape, its own record: the uniforms below are this plume's alone, never a shared material's)
  const mat = MATLIB.make(THREE, 'basic', { color: o.colour === undefined ? 0xf1f4f6 : o.colour,  // pre-ok: x uSmokeLit, which carries P (LAMPS.smokeK), as the chimneys
                                            transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide, fog: true });
  mat.name = 'plume-mist';
  mat.onBeforeCompile = sh => {
    for (const k in u) sh.uniforms[k] = u[k];
    sh.vertexShader = MIST_VERT_HEAD + '\n' + sh.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + MIST_VERT_BODY)
      .replace('#include <project_vertex>', MIST_PROJECT);
    sh.fragmentShader = MIST_FRAG_HEAD + '\n' + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + MIST_FRAG_BODY);
  };
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'plume';
  mesh.frustumCulled = true; mesh.castShadow = false; mesh.receiveShadow = false;
  mesh.renderOrder = 11;
  mesh.visible = false;
  const _a = new THREE.Vector3(), _b = new THREE.Vector3();
  const H = {
    mesh, u, mat, opts: o,
    get alive() { return u.uT.value >= 0 && u.uT.value < o.life + o.delay; },
    // (dx, dz): the drift in m/s - the wind and the animal's own way on
    fire(x, y, z, dx, dz) {
      mesh.position.set(x, y, z);
      u.uLean.value.set(dx || 0, dz || 0);
      // the cull sphere round where the mist WILL be: half way along its drift, wide enough for all of it (GROUND-FX review:
      // the blowhole's sphere left the frustum while the drifted cloud was still on screen)
      g.boundingSphere.center.set((dx || 0) * o.life * 0.5, o.rise * 0.5, (dz || 0) * o.life * 0.5);
      g.boundingSphere.radius = o.rise * 0.6 + o.spread * 1.5 + o.r0 * 2 + Math.hypot(dx || 0, dz || 0) * o.life * 0.5;
      u.uT.value = 0;
      mesh.visible = true;
      const L = keyLight(mesh);
      if (L) { L.getWorldPosition(_a); if (L.target) L.target.getWorldPosition(_b); else _b.set(0, 0, 0); _a.sub(_b); if (_a.lengthSq() > 1e-8) u.uSun.value.copy(_a.normalize()); }
      return H;
    },
    step(dt) {
      u.uTime.value += dt;
      if (u.uT.value >= 0) {
        u.uT.value += dt;
        if (u.uT.value > o.life + o.delay) { u.uT.value = -1; mesh.visible = false; }
      }
      return H;
    },
    stop() { u.uT.value = -1; mesh.visible = false; return H; },
    lit(k) { u.uSmokeLit.value = k; return H; },
    dispose() { g.dispose(); if (MATLIB.release) MATLIB.release(mat); else mat.dispose(); if (mesh.parent) mesh.parent.remove(mesh); },
  };
  return H;
}

if (typeof window !== 'undefined') window.PLUME = P;
if (typeof module !== 'undefined' && module.exports) module.exports = P;
})();
