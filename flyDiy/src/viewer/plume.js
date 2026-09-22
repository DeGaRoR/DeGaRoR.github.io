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
//   PLUME.PRESETS.blow / .chimney / .puff
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
    float r = uR0 + vAge * uSpread;
    float d = length(vSm) / max(r, 1e-4);
    vec2 q = vSm / max(r, 1e-4) * 2.2 + vec2(0.0, -uTime * 0.35) + vAge * 3.1;
    float n = sNoise(q) * 0.6 + sNoise(q * 2.3 + 7.0) * 0.4;
    float a = smoothstep(1.0, 0.25, d) * (0.35 + 0.65 * n) * vFade * uK;
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
  const u = { uT: { value: -1 }, uTime: { value: 0 }, uLife: { value: o.life },
              uDelay: { value: o.delay }, uRise: { value: o.rise }, uSpread: { value: o.spread },
              uR0: { value: o.r0 }, uK: { value: o.k }, uSmokeLit: { value: 1 },
              uLean: { value: new THREE.Vector2(o.lean, 0) } };
  const mat = new THREE.MeshBasicMaterial({ color: o.colour === undefined ? P.RECIPE.colour : o.colour,
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

if (typeof window !== 'undefined') window.PLUME = P;
if (typeof module !== 'undefined' && module.exports) module.exports = P;
})();
