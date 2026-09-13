// _totem_gen.js — THE TOTEM PARK: a patch of ground with the carved poles on
// it (2026-09-13, the user: "The goal is to generate a patch of terrain with
// these poles, inspired by the attached picture" — a Saxman-style totem
// park: poles along the edge of a lawn, a painted clan house behind them,
// boulders on the grass, a gravel path along the front, spruce behind).
//
// TWO HALVES, the house generator's own split:
//   totemPlan(o)             headless (node and browser): WHERE everything
//                            stands, in metres, from a seed - held by GATE
//                            TOTEM; the world join reads this
//   totemBuild(THREE, plan)  the meshes: the ground, the poles through
//                            propPlace (a THREE.LOD each, the levels ride in),
//                            the boulders, the path as a tint
//
// THE FRAME. The patch is w (x) by d (z), centred on the origin. +z is the
// FRONT: the lawn, the path and the viewer; -z the BACK: the poles' arc, the
// clan-house slot behind its middle, the treeline beyond. A pole's `face` is
// the azimuth (degrees, atan2(x, z) in its own frame) its carving looks out
// along; the plan turns every pole so its face looks to +z, with a little
// scatter, the way a park's poles all look out over the lawn without
// standing to attention.
//
// TOTEM_KIT mirrors src/totems/totems_poles.js headless - L along z, W along
// x, H up, in the packs' metres, `srcNt` the scan it was cut from - the way
// PIER_KIT mirrors the pier; GATE TOTEM holds it to the packs. `face` is a
// judgement read off the renders (tools/_totems.html, FACING view), not a
// baked number.
'use strict';
(() => {
// `face` READ OFF THE FACING VIEW (2026-09-13, screenshots/totems/facing):
// the six Trepanier scans all look along their own +x (the wings pole a
// shade short of it); the jfactory pole looks along -x. THAT ONE IS A
// ONE-SIDED SCAN: its back is a flat, untextured sheet (the scanner never
// walked round it), so it stands with its back to the treeline and is not
// for a spot the player can walk behind (`oneSided`).
const TOTEM_KIT = {
  totem_claws:    { L: 1.908, W: 2.048, H: 6.996,  srcNt: 378651, face: 90 },
  totem_eyes:     { L: 3.406, W: 1.729, H: 5.997,  srcNt: 378200, face: 90 },
  totem_flight:   { L: 4.396, W: 2.758, H: 7.494,  srcNt: 339316, face: 90 },
  totem_sentinel: { L: 5.218, W: 1.789, H: 7.995,  srcNt: 296859, face: 90 },
  totem_voice:    { L: 1.878, W: 2.035, H: 8.995,  srcNt: 437625, face: 90 },
  totem_wings:    { L: 3.812, W: 2.796, H: 6.496,  srcNt: 337945, face: 80 },
  totem_tall:     { L: 3.048, W: 3.397, H: 19.289, srcNt: 143894, face: -90, oneSided: true },
};
const KEYS = Object.keys(TOTEM_KIT);
const D2R = Math.PI / 180;

// the footprint radius a pole needs kept clear of boulders and walls: half
// its wider side (a beak or a wing counts)
const footR = k => Math.max(TOTEM_KIT[k].L, TOTEM_KIT[k].W) * 0.5;
// its width ACROSS the arc: every pole faces the lawn, so along the line of
// poles what one takes up is its own x extent, not its beak
const acrossR = k => TOTEM_KIT[k].W * 0.5;

// mulberry32: the same seed is the same park, in node and in the page
function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// value noise, smooth, tileless: the lawn's gentle swell
function hash2(i, j, s) {
  let h = (i * 374761393 + j * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, z, s) {
  const i = Math.floor(x), j = Math.floor(z);
  const fx = x - i, fz = z - j;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash2(i, j, s), b = hash2(i + 1, j, s), c = hash2(i, j + 1, s), d = hash2(i + 1, j + 1, s);
  return (a + (b - a) * ux) * (1 - uz) + (c + (d - c) * ux) * uz;
}

const DEF = { seed: 1, w: 46, d: 30, poles: 'all', house: true, rocks: 5, scatter: 18 };

// ---------------------------------------------------------------------------
// THE PLAN
// ---------------------------------------------------------------------------
function totemPlan(o) {
  o = Object.assign({}, DEF, o || {});
  const R = rng(o.seed);
  const w = o.w, d = o.d;
  const keys = (o.poles === 'all' ? KEYS.slice() : o.poles.slice()).filter(k => TOTEM_KIT[k]);

  // THE GROUND: a swell of 0.35 m over ~14 m plus a finer 0.08 m ripple,
  // rising a little to the back (the park is on a shore terrace); the
  // house's slot is flattened to its own level by the house generator, not
  // here (a lot never owns height - the village's rule)
  const s1 = o.seed * 7 + 1, s2 = o.seed * 13 + 5;
  const ground = (x, z) =>
    (vnoise(x / 14 + 100, z / 14 + 100, s1) - 0.5) * 0.7 +
    (vnoise(x / 3.5 + 50, z / 3.5 + 50, s2) - 0.5) * 0.16 +
    (-z / d) * 0.45;

  // THE HOUSE SLOT: behind the arc's middle, its front (+z face) at zHouse
  const house = o.house ? { x: 0, z: -d / 2 + 5.0, w: 12.0, d: 9.0, ry: 0 } : null;
  const zHouseFront = house ? house.z + house.d / 2 : -d / 2 + 2;

  // THE ARC: the poles stand along a shallow curve bowed toward the lawn,
  // its middle 6 m in front of the house, its ends swept back to the patch's
  // rear corners. Order along the arc: the tall pole at one end (the picture
  // has its tallest at the edge), the others by height so the line climbs
  // toward it, with the seed deciding which end.
  const zMid = zHouseFront + 6.0;
  const bow = 5.5;                              // how far the ends fall back
  const half = w / 2 - 3.5;
  const arcZ = x => zMid - bow * Math.pow(x / half, 2);
  const flip = R() < 0.5;
  let line = keys.filter(k => k !== 'totem_tall').sort((a, b) => TOTEM_KIT[a].H - TOTEM_KIT[b].H);
  // a little disorder in the climb: swap neighbours now and then
  for (let i = 0; i + 1 < line.length; i++) if (R() < 0.35) { const t = line[i]; line[i] = line[i + 1]; line[i + 1] = t; }
  if (keys.includes('totem_tall')) line.push('totem_tall');
  if (flip) line.reverse();

  // arc length as a function of x, by walking it
  const N = 400, sx = [], sl = [];
  let acc = 0, px = -half, pz = arcZ(-half);
  for (let i = 0; i <= N; i++) {
    const x = -half + (i / N) * 2 * half, z = arcZ(x);
    acc += Math.hypot(x - px, z - pz); px = x; pz = z;
    sx.push(x); sl.push(acc);
  }
  const xAt = s => {
    if (s <= 0) return -half;
    for (let i = 1; i < sl.length; i++) if (sl[i] >= s) {
      const t = (s - sl[i - 1]) / (sl[i] - sl[i - 1] || 1);
      return sx[i - 1] + (sx[i] - sx[i - 1]) * t;
    }
    return half;
  };
  // spacing: width to width across the arc plus a gap, the gaps sharing what
  // the arc has left once every pole's width is booked (jittered shares,
  // none over 6.5 m - a park of three poles does not spread them to the
  // corners), the row then centred on the arc
  const margin = 1.0;
  const need = line.reduce((s, k, i) => s + (i > 0 ? acrossR(line[i - 1]) + acrossR(k) : 0), 0);
  const free = Math.max(0, acc - 2 * margin - need);
  const share = line.map((k, i) => (i > 0 ? 0.8 + R() * 0.4 : 0));
  const shareSum = share.reduce((a, b) => a + b, 0) || 1;
  const gaps = share.map(s => Math.min(6.5, free * s / shareSum));
  let len = 0;
  const along = line.map((k, i) => {
    if (i > 0) len += acrossR(line[i - 1]) + gaps[i] + acrossR(k);
    return len;
  });
  const start = Math.max(margin, (acc - len) / 2);
  const poles = line.map((k, i) => {
    const x = xAt(start + along[i]);
    const z = arcZ(x) - (k === 'totem_tall' ? 2.0 : 0);   // the great pole a step back
    // face the lawn (+z): the pole's own face azimuth turned onto 0, a
    // scatter either way, and the ends of the arc turned a little inward
    const inward = -Math.atan2(x, 40) / D2R;
    const ry = (-TOTEM_KIT[k].face + inward + (R() * 2 - 1) * o.scatter) * D2R;
    return { key: k, x: +x.toFixed(3), z: +z.toFixed(3), ry: +ry.toFixed(4), y: +ground(x, z).toFixed(3),
             r: +footR(k).toFixed(3), rx: +acrossR(k).toFixed(3) };
  });

  // THE PATH: gravel along the front of the lawn, bowed like the arc, from
  // edge to edge; 2.6 m wide
  const zPath = d / 2 - 4.5;
  const path = { z: zPath, bow: 1.8, width: 2.6,
                 at: x => zPath + 1.8 * Math.pow(x / (w / 2), 2) };

  // THE BOULDERS: on the lawn between the arc and the path, clear of both
  // and of every pole, none in front of the house's door line
  const rocks = [];
  let tries = 0;
  while (rocks.length < o.rocks && tries++ < 400) {
    const x = (R() * 2 - 1) * (w / 2 - 3), z = arcZ(x) + 3 + R() * (path.at(x) - arcZ(x) - 6);
    const r = 0.55 + R() * 0.75;
    if (z < arcZ(x) + 2.5 || z > path.at(x) - path.width / 2 - 1.5 - r) continue;
    if (poles.some(p => Math.hypot(p.x - x, p.z - z) < p.r + r + 1.5)) continue;
    if (rocks.some(q => Math.hypot(q.x - x, q.z - z) < q.r + r + 1.2)) continue;
    rocks.push({ x: +x.toFixed(3), z: +z.toFixed(3), r: +r.toFixed(3), ry: +(R() * Math.PI * 2).toFixed(3),
                 y: +ground(x, z).toFixed(3), s: +(0.55 + R() * 0.35).toFixed(3) });
  }

  // THE TREELINE: the band behind the arc and round the sides, for the world
  // to fill with spruce (this generator plants none)
  const treeline = [{ x0: -w / 2, z0: -d / 2, x1: w / 2, z1: zHouseFront - 1 },
                    { x0: -w / 2, z0: zHouseFront - 1, x1: -w / 2 + 3, z1: zPath - 3 },
                    { x0: w / 2 - 3, z0: zHouseFront - 1, x1: w / 2, z1: zPath - 3 }];

  return { seed: o.seed, w, d, ground, poles, house, path, rocks, treeline,
           arc: { zMid, bow, half }, keys: line };
}

// ---------------------------------------------------------------------------
// THE BUILD
// ---------------------------------------------------------------------------
// a boulder: an icosphere pushed about by hashed noise, its underside
// flattened where it sits in the turf; grey stone with a lichen tint
function rockGeo(THREE, r, seed) {
  const g = new THREE.IcosahedronGeometry(r, 3);
  const P = g.attributes.position, v = new THREE.Vector3();
  const s = seed | 0;
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i);
    const n = v.clone().normalize();
    const k = 1 + (vnoise(n.x * 2.2 + 30, n.z * 2.2 + n.y * 1.7 + 30, s) - 0.5) * 0.55 +
                  (vnoise(n.x * 6 + 60, n.z * 6 + n.y * 5 + 60, s + 1) - 0.5) * 0.14;
    v.copy(n).multiplyScalar(r * k);
    v.y *= 0.72;
    if (v.y < -r * 0.25) v.y = -r * 0.25;     // sits in the ground
    P.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function groundMesh(THREE, plan, o) {
  const { w, d, ground } = plan;
  const nx = Math.round(w), nz = Math.round(d);
  const g = new THREE.PlaneGeometry(w, d, nx, nz);
  g.rotateX(-Math.PI / 2);
  const P = g.attributes.position;
  const col = new Float32Array(P.count * 3);
  const pathHalf = plan.path.width / 2;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), z = P.getZ(i);
    P.setY(i, ground(x, z));
    // the lawn's colour varies slowly; the path is a dirt tint with a soft
    // edge; a worn ring round every pole's foot
    const t = vnoise(x / 9 + 200, z / 9 + 200, plan.seed) ;
    let r = 0.86 + t * 0.2, gg = 0.9 + t * 0.14, b = 0.82 + t * 0.12;
    const dp = Math.abs(z - plan.path.at(x));
    const onPath = 1 - Math.min(1, Math.max(0, (dp - pathHalf + 0.6) / 1.2));
    let worn = onPath;
    for (const p of plan.poles) {
      const dd = Math.hypot(x - p.x, z - p.z) - p.r;
      worn = Math.max(worn, 1 - Math.min(1, Math.max(0, (dd - 0.2) / 1.1)));
    }
    r = r * (1 - worn) + 0.46 * worn; gg = gg * (1 - worn) + 0.38 * worn; b = b * (1 - worn) + 0.26 * worn;
    col[i * 3] = r; col[i * 3 + 1] = gg; col[i * 3 + 2] = b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ color: 0x9fb06a, roughness: 1.0, metalness: 0, vertexColors: true });
  const LOT = (typeof LOT_TEX_SETS !== 'undefined' && LOT_TEX_SETS) || null;
  if (LOT && LOT.grass) {
    const tex = (img, srgb) => {
      const t = new THREE.Texture(img);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(w / LOT.grass.tile, d / LOT.grass.tile);
      if (srgb) t.encoding = THREE.sRGBEncoding;
      t.anisotropy = 8;
      const ok = () => { t.needsUpdate = true; if (o && o.onTex) o.onTex(); };
      if (img.complete && img.naturalWidth) ok(); else img.addEventListener('load', ok, { once: true });
      return t;
    };
    m.map = tex(LOT.grass.diff, true);
    m.normalMap = tex(LOT.grass.nor, false);
    m.normalScale = new THREE.Vector2(0.6, 0.6);
    m.color.set(0xffffff);
  }
  const mesh = new THREE.Mesh(g, m);
  mesh.receiveShadow = true;
  mesh.name = 'totem:ground';
  return mesh;
}

function totemBuild(THREE, plan, o) {
  o = o || {};
  const root = new THREE.Group();
  root.name = 'totemPark';
  root.add(groundMesh(THREE, plan, o));
  const stats = { poles: 0, rocks: 0, missing: [] };
  const place = (typeof propPlace === 'function') ? propPlace : null;
  const reg = (typeof PROP_REG !== 'undefined') ? PROP_REG : null;
  for (const p of plan.poles) {
    if (!place || !reg || !reg.props[p.key]) { stats.missing.push(p.key); continue; }
    const g = place(THREE, p.key, p.x, p.z, p.ry, p.y - 0.06);   // 6 cm into the turf
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    root.add(g);
    stats.poles++;
  }
  // READ BACK, NOT GUESSED (the G302 lesson, met again): under the alps sky
  // at the benches' exposure a 0x7d7f78 rock rendered sRGB 230, 0x5e6059
  // 188, 0x303030 145 (gl.readPixels on the bench canvas, 2026-09-13). A
  // sunlit granite boulder photographs at ~150-170, so the albedo is set
  // where the pixel lands there, not where a swatch looks right
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x3a3b37, roughness: 1.0, metalness: 0 });
  for (const r of plan.rocks) {
    const m = new THREE.Mesh(rockGeo(THREE, r.r, plan.seed * 31 + stats.rocks), rockMat);
    m.position.set(r.x, r.y + r.r * 0.1, r.z);
    m.rotation.y = r.ry;
    m.scale.set(1, r.s, 1 + (r.s - 0.7) * 0.4);
    m.castShadow = m.receiveShadow = true;
    m.name = 'totem:rock';
    root.add(m);
    stats.rocks++;
  }
  if (plan.house && o.ghost !== false) {
    // THE SLOT for the house generator: shown as a wire box until the
    // other generator stands a clan house in it
    const h = plan.house;
    const box = new THREE.Mesh(new THREE.BoxGeometry(h.w, 4.5, h.d),
      new THREE.MeshBasicMaterial({ color: 0xd8b26a, wireframe: true, transparent: true, opacity: 0.35 }));
    box.position.set(h.x, plan.ground(h.x, h.z) + 2.25, h.z);
    box.rotation.y = h.ry;
    box.name = 'totem:houseSlot';
    root.add(box);
  }
  root.userData.stats = stats;
  return root;
}

const API = { TOTEM_KIT, KEYS, DEF, totemPlan, totemBuild, rockGeo, groundMesh, footR, acrossR, vnoise, rng };
if (typeof window !== 'undefined') window.TOTEM_GEN = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
