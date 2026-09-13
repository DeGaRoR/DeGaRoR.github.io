// _totem_gen.js — THE TOTEM PARK: a flat lawn with the carved poles round it
// in a wide half circle (2026-09-13, the user: "The goal is to generate a
// patch of terrain with these poles, inspired by the attached picture"; then
// G341.1: "do the wiring so it can occupy a plot and be placed like on the
// reference picture? In a large flat semi circle?").
//
// TWO HALVES, the house generator's own split:
//   totemPlan(o)             headless (node and browser): WHERE everything
//                            stands, in the park's OWN frame, from a seed -
//                            held by GATE TOTEM
//   totemPlot(plot, T, o)    the same plan stood on a VILLAGE PLOT: sized
//                            to the plot, turned to open on the road, every
//                            coordinate in world metres, the lawn's level
//                            read off the terrain - the one call the village
//                            generator makes
//   totemBuild(THREE, plan)  the meshes: the lawn, the poles through
//                            propPlace (a THREE.LOD each, the levels ride
//                            in), the boulders, the path as a tint
//
// THE FRAME (park's own). The lawn's centre is the origin. The poles stand
// on a half circle of radius R, its apex at the BACK (-z) and its two horns
// reaching forward, every pole looking IN at the lawn's centre (the
// reference photograph: poles round a clearing, all faces toward the
// visitor on the grass). The clan-house slot is behind the apex, its front
// (+z) toward the lawn; the gravel path crosses the open FRONT (+z) of the
// half circle; the treeline is everything behind the poles. A pole's `face`
// is the azimuth (degrees, atan2(x, z) in its own frame) its carving looks
// along; ry turns that onto the line to the centre, with a little scatter.
//
// THE PARK IS FLAT. A totem park is a levelled lawn (the photograph's is),
// and the user asked for one: `plan.level` is the lawn's height and
// `plan.footprint` the polygon (the half disc plus the lawn's apron) the
// terrain owner flattens to it - the park publishes the shape, the world
// owns the height (the village's rule). The bench draws the patch flat with
// a soft skirt down to a gentle swell outside the footprint.
//
// TOTEM_KIT mirrors src/totems/totems_poles.js headless - L along z, W along
// x, H up, in the packs' metres, `srcNt` the scan it was cut from - the way
// PIER_KIT mirrors the pier; GATE TOTEM holds it to the packs. `face` is a
// judgement read off the renders (tools/_totems.html, FACING view): the six
// Trepanier scans all look along their own +x, the wings pole a shade short.
// (The jfactory pole was dropped in G341.1: a one-sided scan.)
'use strict';
(() => {
const TOTEM_KIT = {
  totem_claws:    { L: 1.908, W: 2.048, H: 6.996, srcNt: 378651, face: 90 },
  totem_eyes:     { L: 3.406, W: 1.729, H: 5.997, srcNt: 378200, face: 90 },
  totem_flight:   { L: 4.396, W: 2.758, H: 7.494, srcNt: 339316, face: 90 },
  totem_sentinel: { L: 5.218, W: 1.789, H: 7.995, srcNt: 296859, face: 90 },
  totem_voice:    { L: 1.878, W: 2.035, H: 8.995, srcNt: 437625, face: 90 },
  totem_wings:    { L: 3.812, W: 2.796, H: 6.496, srcNt: 337945, face: 80 },
};
const KEYS = Object.keys(TOTEM_KIT);
const D2R = Math.PI / 180;

// the footprint radius a pole needs kept clear of boulders and walls: half
// its wider side (a beak or a wing counts)
const footR = k => Math.max(TOTEM_KIT[k].L, TOTEM_KIT[k].W) * 0.5;
// its width ACROSS the arc: every pole faces the centre, so along the line
// of poles what one takes up is its own x extent, not its beak
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

// value noise, smooth, tileless: the swell outside the lawn
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

// R: the half circle's radius; span: how much of it the poles use (degrees,
// centred on the apex); apron: lawn kept in front of the horns, where the
// path crosses; back: ground kept behind the apex for the house
const DEF = { seed: 1, R: 16, span: 170, apron: 9, back: 15, poles: 'all', house: true,
              rocks: 5, scatter: 12, flat: true };

// ---------------------------------------------------------------------------
// THE PLAN (the park's own frame)
// ---------------------------------------------------------------------------
function totemPlan(o) {
  o = Object.assign({}, DEF, o || {});
  const Rn = rng(o.seed);
  const R = o.R, A = o.span / 2 * D2R;
  const keys = (o.poles === 'all' ? KEYS.slice() : o.poles.slice()).filter(k => TOTEM_KIT[k]);

  // THE PATCH: the half disc plus its apron in front and the house's ground
  // behind; the footprint polygon is what the terrain owner flattens
  const x0 = -(R + 5), x1 = R + 5, z0 = -(R + o.back), z1 = o.apron;
  const patch = { x0, x1, z0, z1, w: x1 - x0, d: z1 - z0 };
  const footprint = [];
  for (let i = 0; i <= 24; i++) {                  // the half disc, west horn round the apex to the east horn
    const a = Math.PI + (i / 24) * Math.PI;         // angle in the (x, z) plane, z = sin: -pi .. 0 keeps z <= 0
    footprint.push([+(Math.cos(a) * (R + 4)).toFixed(3), +(Math.sin(a) * (R + 4)).toFixed(3)]);
  }
  footprint.push([R + 4, z1], [-(R + 4), z1]);
  const level = 0;
  const swell = (x, z) => (vnoise(x / 14 + 100, z / 14 + 100, o.seed * 7 + 1) - 0.5) * 0.7 +
                          (vnoise(x / 3.5 + 50, z / 3.5 + 50, o.seed * 13 + 5) - 0.5) * 0.16;
  // signed depth inside the footprint (positive = inside)
  const inside = (x, z) => {
    if (z <= 0) return (R + 4) - Math.hypot(x, z);                 // the half disc
    return Math.min((R + 4) - Math.abs(x), z1 - z);                 // the apron
  };
  // inside, the lawn is level; outside, a 6 m skirt eases down to the swell
  // (the bench's own outside - the world has its own)
  const ground = o.flat
    ? (x, z) => { const t = Math.min(1, Math.max(0, -inside(x, z) / 6)); return level + swell(x, z) * t * t; }
    : swell;

  // THE HOUSE SLOT: behind the apex, its front (+z) toward the lawn
  const house = o.house ? { x: 0, z: -(R + 3.5 + 4.5), w: 12.0, d: 9.0, ry: 0 } : null;

  // THE POLES, round the arc: angle a from the apex (a = 0 at the back,
  // negative to the west horn); position (R sin a, -R cos a). The order
  // climbs to the tallest at one horn, with a little disorder, the seed
  // choosing the horn.
  let line = keys.slice().sort((a, b) => TOTEM_KIT[a].H - TOTEM_KIT[b].H);
  for (let i = 0; i + 1 < line.length; i++) if (Rn() < 0.35) { const t = line[i]; line[i] = line[i + 1]; line[i + 1] = t; }
  if (Rn() < 0.5) line.reverse();
  // spacing along the arc: width to width plus gaps sharing what the arc
  // has left (jittered shares, none over 6.5 m), the row centred on the apex
  const arcLen = 2 * A * R;
  const need = line.reduce((s, k, i) => s + (i > 0 ? acrossR(line[i - 1]) + acrossR(k) : 0), 0);
  const free = Math.max(0, arcLen - need);
  const share = line.map((k, i) => (i > 0 ? 0.8 + Rn() * 0.4 : 0));
  const shareSum = share.reduce((a, b) => a + b, 0) || 1;
  const gaps = share.map(s => Math.min(6.5, free * s / shareSum));
  let len = 0;
  const along = line.map((k, i) => { if (i > 0) len += acrossR(line[i - 1]) + gaps[i] + acrossR(k); return len; });
  const start = (arcLen - len) / 2;
  const poles = line.map((k, i) => {
    const a = -A + (start + along[i]) / R;
    const x = R * Math.sin(a), z = -R * Math.cos(a);
    // look at the centre: world az of (-x, -z), the carving's own az turned onto it
    const look = Math.atan2(-x, -z) / D2R;
    const ry = (look - TOTEM_KIT[k].face + (Rn() * 2 - 1) * o.scatter) * D2R;
    return { key: k, x: +x.toFixed(3), z: +z.toFixed(3), ry: +ry.toFixed(4), y: +ground(x, z).toFixed(3),
             r: +footR(k).toFixed(3), rx: +acrossR(k).toFixed(3), a: +(a / D2R).toFixed(1) };
  });

  // THE PATH: gravel across the open front, edge to edge, bowed toward the
  // lawn a little; 2.6 m wide
  const zPath = z1 - 4.0;
  const path = { z: zPath, bow: 1.5, width: 2.6, at: x => zPath - 1.5 * (1 - Math.pow(x / (R + 5), 2)) };

  // THE BOULDERS: on the lawn inside the arc, clear of every pole and of
  // the path, none in the middle of the clearing (that is where you stand)
  const rocks = [];
  let tries = 0;
  while (rocks.length < o.rocks && tries++ < 600) {
    const a = (Rn() * 2 - 1) * Math.PI * 0.6, rr = R * (0.4 + Rn() * 0.45);
    const x = rr * Math.sin(a), z = -rr * Math.cos(a);
    const r = 0.55 + Rn() * 0.75;
    if (Math.hypot(x, z) < 5) continue;
    if (inside(x, z) < r + 1.0) continue;
    if (z > path.at(x) - path.width / 2 - 1.0 - r) continue;
    if (poles.some(p => Math.hypot(p.x - x, p.z - z) < p.r + r + 1.5)) continue;
    if (rocks.some(q => Math.hypot(q.x - x, q.z - z) < q.r + r + 1.2)) continue;
    rocks.push({ x: +x.toFixed(3), z: +z.toFixed(3), r: +r.toFixed(3), ry: +(Rn() * Math.PI * 2).toFixed(3),
                 y: +ground(x, z).toFixed(3), s: +(0.55 + Rn() * 0.35).toFixed(3) });
  }

  // THE TREELINE: the band behind the arc, for the world to fill with spruce
  const treeline = { r0: R + 5, r1: R + o.back + 10, zMax: 0, note: 'annulus behind the poles, z <= 0' };

  return { seed: o.seed, R, span: o.span, level, flat: o.flat, patch, footprint, ground, inside,
           poles, house, path, rocks, treeline, keys: line, frame: 'park' };
}

// ---------------------------------------------------------------------------
// THE PLAN ON A PLOT
// ---------------------------------------------------------------------------
// A village plot (tools/_village_gen.js planPlots): { poly: [f0, f1, b1, b0]
// (the frontage first), w (along the road), depth, n: unit normal AWAY from
// the road, front: the frontage's midpoint, tg: unit tangent along the
// frontage, side }. T is the terrain, T.h(x, z) its height. The park opens
// on the road: its +z (the front, the path) is the plot's -n, the half
// circle's apex toward the back of the plot, and R is the largest the plot
// takes (8 to 20 m). Every coordinate returned is WORLD; `yaw` is what was
// added to every ry; `level` is the median of the terrain under the
// footprint, the height the world flattens the footprint to.
function totemPlot(plot, T, o) {
  o = Object.assign({}, o || {});
  const n = plot.n, toRoad = [-n[0], -n[1]];
  const yaw = Math.atan2(toRoad[0], toRoad[1]);          // local +z -> world toRoad
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const back = o.back !== undefined ? o.back : DEF.back, apron = o.apron !== undefined ? o.apron : DEF.apron;
  // the patch is 2R + 10 across and (R + back) + apron deep
  const R = o.R !== undefined ? o.R
    : Math.max(8, Math.min(20, (plot.w - 10) / 2, plot.depth - back - apron - 2));
  const local = totemPlan(Object.assign({}, o, { R, back, apron }));
  // the centre: the patch's front edge 1 m inside the frontage
  const dFront = local.patch.z1 + 1.0;
  const c = [plot.front[0] + n[0] * dFront, plot.front[1] + n[1] * dFront];
  const toWorld = (lx, lz) => [c[0] + lx * cy + lz * sy, c[1] - lx * sy + lz * cy];
  // the lawn's level: the median terrain height under the footprint
  const hs = [];
  for (const [lx, lz] of local.footprint) { const w = toWorld(lx, lz); hs.push(T.h(w[0], w[1])); }
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, w = toWorld(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5); hs.push(T.h(w[0], w[1])); }
  hs.sort((a, b) => a - b);
  const level = o.level !== undefined ? o.level : hs[hs.length >> 1];
  const W = (p) => { const w = toWorld(p.x, p.z); return Object.assign({}, p, { x: +w[0].toFixed(3), z: +w[1].toFixed(3), y: level }); };
  const poles = local.poles.map(p => Object.assign(W(p), { ry: +(p.ry + yaw).toFixed(4) }));
  const rocks = local.rocks.map(W);
  const house = local.house ? Object.assign(W(local.house), { ry: +(local.house.ry + yaw).toFixed(4) }) : null;
  const footprint = local.footprint.map(([lx, lz]) => toWorld(lx, lz).map(v => +v.toFixed(3)));
  const pathPts = [];
  for (let i = 0; i <= 12; i++) { const lx = local.patch.x0 + (i / 12) * local.patch.w; pathPts.push(toWorld(lx, local.path.at(lx)).map(v => +v.toFixed(3))); }
  return { seed: local.seed, R, level, yaw: +yaw.toFixed(4), centre: c.map(v => +v.toFixed(3)), toWorld,
           poles, rocks, house, footprint, path: { pts: pathPts, width: local.path.width },
           treeline: local.treeline, keys: local.keys, local, frame: 'world', plot: plot.id };
}

// ---------------------------------------------------------------------------
// THE BUILD
// ---------------------------------------------------------------------------
// a boulder: an icosphere pushed about by hashed noise, its underside
// flattened where it sits in the turf
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
    if (v.y < -r * 0.25) v.y = -r * 0.25;
    P.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function groundMesh(THREE, plan, o) {
  const { patch, ground } = plan;
  const w = patch.w + 12, d = patch.d + 12;             // a skirt round the patch
  const cx = (patch.x0 + patch.x1) / 2, cz = (patch.z0 + patch.z1) / 2;
  const nx = Math.round(w), nz = Math.round(d);
  const g = new THREE.PlaneGeometry(w, d, nx, nz);
  g.rotateX(-Math.PI / 2);
  g.translate(cx, 0, cz);
  const P = g.attributes.position;
  const col = new Float32Array(P.count * 3);
  const pathHalf = plan.path.width / 2;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), z = P.getZ(i);
    P.setY(i, ground(x, z));
    const t = vnoise(x / 9 + 200, z / 9 + 200, plan.seed);
    let r = 0.86 + t * 0.2, gg = 0.9 + t * 0.14, b = 0.82 + t * 0.12;
    const dp = Math.abs(z - plan.path.at(x));
    const onPath = (x >= patch.x0 && x <= patch.x1) ? 1 - Math.min(1, Math.max(0, (dp - pathHalf + 0.6) / 1.2)) : 0;
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
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
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

// plan: a park-frame plan (totemPlan) draws its own ground; a world-frame
// one (totemPlot) draws no ground - the world owns it - and places the rest
// at its world coordinates and `level`
function totemBuild(THREE, plan, o) {
  o = o || {};
  const root = new THREE.Group();
  root.name = 'totemPark';
  if (plan.frame !== 'world' && o.ground !== false) root.add(groundMesh(THREE, plan, o));
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
    // THE SLOT for the house generator: a wire box until the other
    // generator stands a clan house in it
    const h = plan.house;
    const box = new THREE.Mesh(new THREE.BoxGeometry(h.w, 4.5, h.d),
      new THREE.MeshBasicMaterial({ color: 0xd8b26a, wireframe: true, transparent: true, opacity: 0.35 }));
    box.position.set(h.x, (h.y !== undefined ? h.y : plan.ground(h.x, h.z)) + 2.25, h.z);
    box.rotation.y = h.ry;
    box.name = 'totem:houseSlot';
    root.add(box);
  }
  root.userData.stats = stats;
  return root;
}

const API = { TOTEM_KIT, KEYS, DEF, totemPlan, totemPlot, totemBuild, rockGeo, groundMesh, footR, acrossR, vnoise, rng };
// THE CATALOGUE (G352, PREMISES-CONTRACT-2026-09-13 section 2): the park
// stands itself on a plot (totemPlot); its lawn is a flatten the world owns
// at the median terrain; the path leaves the patch's open front
API.CATALOGUE_V = 1;
API.CATALOGUE_ALIASES = {};
API.CATALOGUE = [{
  key: 'totem/park', kind: 'park', gen: 'TOTEM_GEN', preset: 'park', P: {}, frame: 'park', stand: 'totemPlot',
  foot: P => { const q = totemPlan(Object.assign({}, DEF, P || {})).patch; return [[q.x0, q.z0], [q.x1, q.z0], [q.x1, q.z1], [q.x0, q.z1]]; },
  keepOut: 3, ground: { need: 'flatten', level: 'median', falloff: 6, standing: 'lawn' },
  size: P => { const q = totemPlan(Object.assign({}, DEF, P || {})).patch; return { L: q.w, w: q.d }; },
  hooks: P => { const q = totemPlan(Object.assign({}, DEF, P || {})); return [{ name: 'path', kind: 'path', p: [0, 0, q.patch.z1], dir: [0, 0, 1] }, { name: 'house', kind: 'slot', p: [q.house ? q.house.x : 0, 0, q.house ? q.house.z : 0], dir: [0, 0, 1] }]; },
  hooksOf: () => [],
  lod: { dist: [0, 20, 120, 1500] },      // the sheet: 12k under 20 m, 3k past it, 700 past 120 (G341.1)
  slots: { house: 'plan.house', footprint: 'plan.footprint', path: 'plan.path' }, tags: ['park', 'totem'], headless: true, gate: 'TOTEM',
}];
if (typeof window !== 'undefined') window.TOTEM_GEN = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
