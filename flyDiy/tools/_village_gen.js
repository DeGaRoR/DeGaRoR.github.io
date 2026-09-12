// _village_gen.js — THE VILLAGE (G275, the user: "I think it's time to do the
// plots too. And start thinking about how we will divide an area into plots.
// You may generate a simple noise terrain, with some water, and we will
// generate procedurally a little village on the border of the water. For
// that, we will need fences.")
//
// A terrain, a shore, a road along the shore, plots off both sides of the
// road, a house on every plot standing on the terrain under it, fences on the
// plot lines, and a path from every stair to the road. Nothing here draws a
// house: the house generator (tools/_house_gen.js) builds each one with the
// terrain handed to it as its ground (`P.ground`, in the house's own frame),
// and dresses it with a finish of its own (`makeFinish`). What this file
// owns is WHERE things go and the fences.
//
// THE TERRAIN is analytic — a slope up from the water plus two octaves of
// value noise — so any point can be asked, at any resolution, and the bench,
// the houses and the gate all sample the same function. Water is y = 0.
//
// THE PLOTS come off the road by arclength: a run of frontages, each 20-34 m,
// with the odd gap; a plot is a quad - two corners on the road's edge, two at
// depth along the road's normal, and on the water side the depth is wherever
// the shore is. A plot is skipped when the road bends so hard the quad
// folds. Every plot has a side (`water` / `land`) and the house faces
// accordingly: a waterfront house faces the water (its deck, its stair and
// its pier go that way) and is reached from the road at its back; an inland
// house faces the road.
//
// THE FENCES are drawn here from the house kit's own beams - posts, two
// rails, and on the road frontage pickets - with the plot's own hand on
// them: a post that leans, a picket short or missing, a rail that sags.
// `fence_old`, the scanned CC-BY fence, is used as a stretch of its own on
// some plots for variety. Every fence stops for the path.
(function () {
'use strict';
const K = window.HOUSE_KIT;
const HG = window.HOUSE_GEN;
const { sub, add, mul, nrm, len, clamp } = K;

// ---------------------------------------------------------------------------
// THE TERRAIN
// ---------------------------------------------------------------------------
function hash2(x, y, s) {
  const h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
function vnoise(x, y, s) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, s), b = hash2(ix + 1, iy, s);
  const c = hash2(ix, iy + 1, s), d = hash2(ix + 1, iy + 1, s);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}
function fbm(x, y, s, oct) {
  let v = 0, amp = 0.5, f = 1, tot = 0;
  for (let i = 0; i < (oct || 4); i++) {
    v += vnoise(x * f, y * f, s + i * 13) * amp;
    tot += amp; amp *= 0.5; f *= 2.1;
  }
  return v / tot;
}

const VDEF = {
  seed: 3,
  size: 240,              // metres, square, centred on 0
  waterY: 0,
  slope: 0.055,           // the land climbs this much per metre away from the water (+z)
  relief: 2.2,            // the big noise, metres
  detail: 0.35,           // the small noise, metres
  seabed: 0.09,           // steeper under the water, so a pier has depth
  roadOff: 26,            // the road this far inland of the shore
  roadW: 3.6,
  plotMin: 20, plotMax: 34,
  plotDepth: 30,          // inland plots, metres off the road
  riparian: 16,           // a waterfront plot runs this far past the shore
  gapOdds: 0.18,          // a frontage left empty
  fenceOdds: 0.72,        // an edge fenced
  oldFenceOdds: 0.25,     // a plot fenced with the scanned fence instead
  carOdds: 0.45,          // a plot with an abandoned car in the backyard
  nHouses: 0,             // 0 = every plot
};

function makeTerrain(V) {
  const s = V.seed * 0.618 + 1;
  const h = (x, z) => {
    const big = (fbm(x * 0.012 + 3.1, z * 0.012 + 7.7, s, 3) - 0.5) * 2 * V.relief;
    const small = (fbm(x * 0.09, z * 0.09, s + 5, 3) - 0.5) * 2 * V.detail;
    let y = V.slope * z + big + small;
    // the seabed falls away faster than the beach climbs
    if (y < V.waterY) y = V.waterY + (y - V.waterY) * (V.seabed / V.slope);
    return y;
  };
  return { h, size: V.size, waterY: V.waterY };
}

// where the land starts, for a column x: the lowest z whose ground is above
// the water by a footstep, walking up from the sea side
function shoreZ(T, x) {
  const half = T.size / 2;
  let z = -half;
  while (z < half && T.h(x, z) < T.waterY + 0.15) z += 1;
  let lo = z - 1, hi = z;
  for (let i = 0; i < 8; i++) {                 // refine
    const m = (lo + hi) / 2;
    if (T.h(x, m) < T.waterY + 0.15) lo = m; else hi = m;
  }
  return hi;
}

// THE ROAD: the shore, smoothed over forty metres so a road bends like a
// road, pushed inland by roadOff; a polyline every 4 m in x
function makeRoad(T, V) {
  const half = T.size / 2, step = 4;
  const xs = [], zs = [];
  for (let x = -half + 8; x <= half - 8; x += step) { xs.push(x); zs.push(shoreZ(T, x)); }
  const sm = zs.map((_, i) => {
    let a = 0, n = 0;
    for (let k = -5; k <= 5; k++) {
      const j = clamp(i + k, 0, zs.length - 1);
      const w = 6 - Math.abs(k);
      a += zs[j] * w; n += w;
    }
    return a / n;
  });
  const pts = xs.map((x, i) => [x, sm[i] + V.roadOff]);
  // arclength, tangent and the water-side normal at every point
  const s = [0];
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const at = t => {                              // point/tangent/normal at arclength t
    t = clamp(t, 0, s[s.length - 1]);
    let i = 1;
    while (i < s.length - 1 && s[i] < t) i++;
    const u = (t - s[i - 1]) / Math.max(1e-6, s[i] - s[i - 1]);
    const p = [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u];
    const d = [pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]];
    const L = Math.hypot(d[0], d[1]) || 1;
    const tg = [d[0] / L, d[1] / L];
    // the water is on -z: the normal that points to the water
    const n = [tg[1], -tg[0]];
    if (n[1] > 0) { n[0] = -n[0]; n[1] = -n[1]; }
    return { p, tg, n };
  };
  return { pts, s, length: s[s.length - 1], at, w: V.roadW };
}

// ---------------------------------------------------------------------------
// THE PLOTS
// ---------------------------------------------------------------------------
function makePlots(T, V, road, rnd) {
  const plots = [];
  const total = road.length;
  let t = 6 + rnd() * 8;
  let id = 0;
  while (t < total - 26) {
    const w = V.plotMin + rnd() * (V.plotMax - V.plotMin);
    if (t + w > total - 6) break;
    for (const side of ['water', 'land']) {
      if (rnd() < V.gapOdds) continue;
      const a = road.at(t), b = road.at(t + w);
      const sgn = side === 'water' ? 1 : -1;      // along the water normal, or against it
      const off = road.w / 2 + 1.0;
      const f0 = [a.p[0] + a.n[0] * sgn * off, a.p[1] + a.n[1] * sgn * off];
      const f1 = [b.p[0] + b.n[0] * sgn * off, b.p[1] + b.n[1] * sgn * off];
      let b0, b1, depth;
      if (side === 'water') {
        // down to the shore, along each corner's own normal
        // A WATERFRONT PLOT RUNS INTO THE WATER: the shore plus the riparian
        // strip a stilt house and its pier stand in, so the house can sit
        // over the shallows and still be on its own plot
        const d0 = shoreDepth(T, f0, [a.n[0], a.n[1]]) + V.riparian;
        const d1 = shoreDepth(T, f1, [b.n[0], b.n[1]]) + V.riparian;
        depth = Math.min(d0, d1);
        if (depth < 12 + V.riparian) continue;    // the road is nearly on the beach here
        b0 = [f0[0] + a.n[0] * d0, f0[1] + a.n[1] * d0];
        b1 = [f1[0] + b.n[0] * d1, f1[1] + b.n[1] * d1];
      } else {
        depth = V.plotDepth;
        b0 = [f0[0] - a.n[0] * depth, f0[1] - a.n[1] * depth];
        b1 = [f1[0] - b.n[0] * depth, f1[1] - b.n[1] * depth];
      }
      // a quad that folds (the road bends inward faster than the depth) is
      // no plot: its back edge must still run the frontage's way
      const fe = [f1[0] - f0[0], f1[1] - f0[1]], be = [b1[0] - b0[0], b1[1] - b0[1]];
      if (fe[0] * be[0] + fe[1] * be[1] < 0.35 * Math.hypot(fe[0], fe[1]) * Math.hypot(be[0], be[1])) continue;
      if (Math.hypot(be[0], be[1]) < 9) continue;
      const poly = [f0, f1, b1, b0];              // frontage first, then round
      const nrm2 = [(a.n[0] + b.n[0]) * sgn, (a.n[1] + b.n[1]) * sgn];
      const nl = Math.hypot(nrm2[0], nrm2[1]) || 1;
      plots.push({ id: id++, side, s0: t, s1: t + w, poly, depth,
                   n: [nrm2[0] / nl, nrm2[1] / nl],      // away from the road
                   front: [(f0[0] + f1[0]) / 2, (f0[1] + f1[1]) / 2],
                   tg: [fe[0] / Math.hypot(fe[0], fe[1]), fe[1] / Math.hypot(fe[0], fe[1])],
                   w });
    }
    t += w + (rnd() < 0.5 ? 0 : 2 + rnd() * 4);
  }
  return plots;
}
// how far from p along n until the ground is under water
function shoreDepth(T, p, n) {
  let d = 0;
  while (d < 80 && T.h(p[0] + n[0] * d, p[1] + n[1] * d) > T.waterY + 0.05) d += 0.5;
  return d;
}
// point-in-convex-quad, and the plot's own frame
function inPoly(poly, x, z) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const c = (b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]);
    if (i === 0) s = Math.sign(c); else if (Math.sign(c) !== s && c !== 0) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// THE HOUSES: one per plot, from the sampler, made to fit and made to stand
// ---------------------------------------------------------------------------
function placeHouse(T, V, plot, seed, rnd) {
  const P = HG.randomHouse(seed);
  const n = plot.n, tg = plot.tg;
  // the house faces the water on a water plot (its +z is the plot's normal,
  // away from the road) and the road on a land plot (+z is back toward it)
  const face = plot.side === 'water' ? [n[0], n[1]] : [-n[0], -n[1]];
  const yaw = Math.atan2(face[0], face[1]);
  // made to fit: along the frontage, and in depth
  const maxL = plot.w - 7, maxW = Math.min(plot.depth - 12, 9);
  P.L = clamp(P.L, 5, Math.max(5.5, maxL));
  P.w = clamp(P.w, 4, Math.max(4.2, maxW));
  if (P.porchD > plot.depth * 0.12) P.porchD = plot.depth * 0.12;
  P.slopeX = 0; P.slopeZ = 0;
  // WHERE: along the plot's centre line off the frontage
  const cl = d => [plot.front[0] + n[0] * d, plot.front[1] + n[1] * d];
  let d, c;
  if (plot.side === 'water') {
    // OUT OVER THE SHALLOWS: on a beach this gentle a house whose centre is
    // a step above the tide has its stair foot on dry sand, so the centre
    // goes to the waterline itself - the back wall on the beach, the front
    // half on piles in the water, the stair landing in it, the pier growing
    // off that (the Creek Street way)
    d = 6;
    while (d < plot.depth - V.riparian + 2 && T.h(cl(d)[0], cl(d)[1]) > T.waterY + 0.12) d += 0.5;
    c = cl(d);
    P.water = 1; P.stance = 3;
    P.porch = 1; P.stairs = 1; P.pier = 1;
  } else {
    d = 8 + rnd() * 4;
    c = cl(d);
    P.water = 0; P.pier = 0;
  }
  // the ground in the house's own frame: local x along the house, local z
  // out its front; world = c + R(yaw) * local
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  let toWorld = (lx, lz) => [c[0] + lx * cy + lz * sy, c[1] - lx * sy + lz * cy];
  // MADE TO FIT ITS PLOT: a plot on a bend is a quad whose sides are not
  // parallel, and a house sized to the frontage can put a back corner over
  // the line. Shrink along the frontage, then in depth, then step back
  // toward the road, until all four corners are on the plot.
  const fits = () => [[-1, -1], [1, -1], [1, 1], [-1, 1]].every(q => {
    const w = toWorld(q[0] * P.L / 2, q[1] * P.w / 2); return inPoly(plot.poly, w[0], w[1]); });
  for (let it = 0; it < 30 && !fits(); it++) {
    if (P.L > 5.6) P.L *= 0.92;
    else if (P.w > 4.3) P.w *= 0.92;
    else { d -= 1; c = cl(d); toWorld = (lx, lz) => [c[0] + lx * cy + lz * sy, c[1] - lx * sy + lz * cy]; }
  }
  const oy = T.h(c[0], c[1]);
  const ground = (lx, lz) => { const w = toWorld(lx, lz); return T.h(w[0], w[1]) - oy; };
  P.ground = ground;
  P.waterY = T.waterY - oy;
  // the floor clears the high corner of the footprint (the sampler did this
  // for a plane; the terrain is not a plane)
  let hiC = -1e9, loC = 1e9;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const g = ground(sx * P.L / 2, sz * P.w / 2);
    hiC = Math.max(hiC, g); loC = Math.min(loC, g);
  }
  const rise = hiC;
  if (plot.side === 'water') P.floorY = Math.max(rise + 0.6, 1.8 + rnd() * 0.8);
  else {
    if (hiC - loC > 0.55 && P.stance < 2) P.stance = 2;
    P.floorY = rise + (P.stance === 0 ? 0.25 + rnd() * 0.15 : 0.45 + rnd() * 0.6);
  }
  P.skirt = HG.SKIRT_OK(P) && P.stance >= 1 && P.stance <= 3 && rnd() < 0.7 ? 1 : 0;
  return { P, x: c[0], z: c[1], y: oy, yaw, toWorld, ground, seed };
}

// ---------------------------------------------------------------------------
// THE FENCES, AND THE PATHS
// ---------------------------------------------------------------------------
// a plot's fences: its two sides and, on a land plot, the road frontage with
// a gate-width gap where the path crosses; the back of a land plot too, some
// of the time. A water plot's frontage is on the road as well (its back is
// the shore, never fenced).
function planFences(V, plot, house, rnd) {
  const out = [];
  const old = rnd() < V.oldFenceOdds;
  const edges = [
    { a: plot.poly[1], b: plot.poly[2], kind: 'side' },
    { a: plot.poly[3], b: plot.poly[0], kind: 'side' },
    { a: plot.poly[0], b: plot.poly[1], kind: 'front' },
  ];
  if (plot.side === 'land') edges.push({ a: plot.poly[2], b: plot.poly[3], kind: 'back' });
  for (const e of edges) {
    if (rnd() > V.fenceOdds) continue;
    const seg = { a: e.a, b: e.b, kind: e.kind, style: old ? 'old' : (e.kind === 'front' ? 'picket' : 'rail'),
                  gap: null };
    if (e.kind === 'front') seg.gap = [house.gateT - 0.75, house.gateT + 0.75];
    out.push(seg);
  }
  return out;
}

// the path: from the road's edge, through the gate, to the house - to its
// stair foot when the stair faces the road, to the wall nearest the road
// when it does not; and, on a water plot, the house's own stair path goes
// to the water (the house draws that one itself)
function planPath(plot, house, built) {
  const st = built.stats.stair;
  const front = built.stats.front;
  // the gate sits on the frontage where the house's centre projects onto it
  const dx = house.x - plot.front[0], dz = house.z - plot.front[1];
  const along = dx * plot.tg[0] + dz * plot.tg[1];
  house.gateT = clamp(along, 2, plot.w - 2);
  const gate = [plot.poly[0][0] + plot.tg[0] * house.gateT, plot.poly[0][1] + plot.tg[1] * house.gateT];
  let target;
  if (plot.side === 'land' && st) {
    const w = house.toWorld(st.x, st.z1);
    target = [w[0], w[1]];
  } else if (plot.side === 'land' && front) {
    const w = house.toWorld(front.x, front.z - front.side * front.depth);
    target = [w[0], w[1]];
  } else {
    // the back of a waterfront house, toward the road: its back stoop if
    // any, else the middle of its back wall a step out
    const bk = built.stats.stoop;
    const w = bk ? house.toWorld(bk.x, bk.z - bk.side * bk.depth) : house.toWorld(0, -house.P.w / 2 - 1.0);
    target = [w[0], w[1]];
  }
  // a bend two thirds of the way, so it is not a survey line
  const mid = [gate[0] + (target[0] - gate[0]) * 0.55 + plot.tg[0] * 1.2,
               gate[1] + (target[1] - gate[1]) * 0.55 + plot.tg[1] * 1.2];
  const roadEdge = [gate[0] - plot.n[0] * 2.0, gate[1] - plot.n[1] * 2.0];
  return [[roadEdge, gate], [gate, mid], [mid, target]];
}

// ---------------------------------------------------------------------------
// THE VILLAGE
// ---------------------------------------------------------------------------
function makeVillage(V0) {
  const V = Object.assign({}, VDEF, V0 || {});
  // mulberry32, not the LCG the house uses for its own small choices: a
  // linear generator's consecutive draws are correlated enough that one
  // seed threw nine empty frontages in twelve at odds of one in five
  let st = ((V.seed | 0) * 2654435761 + 7) >>> 0;
  const rnd = () => {
    st = (st + 0x6D2B79F5) >>> 0;
    let t = st;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const T = makeTerrain(V);
  const road = makeRoad(T, V);
  const plots = makePlots(T, V, road, rnd);
  const houses = [];
  const nMax = V.nHouses > 0 ? V.nHouses : plots.length;
  for (const plot of plots) {
    if (houses.length >= nMax) break;
    const seed = 1000 + V.seed * 97 + plot.id * 13;
    const h = placeHouse(T, V, plot, seed, rnd);
    h.plot = plot.id;
    plot.house = houses.length;
    houses.push(h);
  }
  return { V, T, road, plots, houses, rnd };
}

// THE CAR IN THE BACKYARD (G276, the user: "I would like these to be placed
// on the property lots, in the backyard preferably"). The backyard is the
// side of the house away from what it faces: behind an inland house (toward
// the plot's back edge), on the road side of a waterfront house. A car is
// parked roughly along the plot, its own length and width clear of the
// house, the fences (a metre and a half inside the plot line), the path and
// the water; the spots are tried from the house outward and the first clear
// one takes it. One per plot at `carOdds`, the Buick rarely.
function planCar(vil, plot, house, built, rnd) {
  if (rnd() > vil.V.carOdds) return null;
  const T = vil.T, keys = HG.CAR_KEYS;
  let key = keys[Math.floor(rnd() * keys.length) % keys.length];
  if (key === 'car_buick' && rnd() < 0.7) key = 'car_fiat';
  const K = HG.YARD_KIT[key];
  const n = plot.n, tg = plot.tg;
  // the backyard direction, away from the house's front
  const back = plot.side === 'water' ? [-n[0], -n[1]] : [n[0], n[1]];
  const P = house.P;
  const ry0 = Math.atan2(tg[0], tg[1]);                   // along the plot
  const cands = [];
  for (let d = P.w / 2 + 1.2 + K.W / 2; d < plot.depth; d += 1.5)
    for (const s of [0, 1, -1, 2, -2])
      cands.push({ x: house.x + back[0] * d + tg[0] * s * 2.6, z: house.z + back[1] * d + tg[1] * s * 2.6,
                   ry: ry0 + (rnd() - 0.5) * 0.7 + (rnd() < 0.3 ? Math.PI / 2 : 0) });
  const half = Math.max(K.L, K.W) / 2;
  const clear = c => {
    // on the plot, its own half-size inside the line
    for (let i = 0; i < 4; i++) {
      const a = plot.poly[i], b = plot.poly[(i + 1) % 4];
      const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
      const cross = ((c.x - a[0]) * dz - (c.z - a[1]) * dx) / L;
      if (Math.abs(cross) < half + 1.0) return false;
    }
    if (!inPoly(plot.poly, c.x, c.z)) return false;
    if (T.h(c.x, c.z) < T.waterY + 0.3) return false;
    // clear of the house: the car's disc against the house's rectangle
    const cy = Math.cos(house.yaw), sy = Math.sin(house.yaw);
    const x = c.x - house.x, z = c.z - house.z, lx = x * cy - z * sy, lz = x * sy + z * cy;
    if (Math.abs(lx) < P.L / 2 + half + 0.6 && Math.abs(lz) < P.w / 2 + (P.porch ? P.porchD : 0) + half + 0.6) return false;
    // clear of the stoops' stairs, roughly: the back stoop's foot
    const bk = built.stats.stoop;
    if (bk) { const w = house.toWorld(bk.x, bk.z - bk.side * (bk.depth + 2)); if (Math.hypot(w[0] - c.x, w[1] - c.z) < half + 1.2) return false; }
    // clear of the path
    for (const sg of plot.path || []) {
      const ax = sg[0][0], az = sg[0][1], bx = sg[1][0], bz = sg[1][1];
      const dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((c.x - ax) * dx + (c.z - az) * dz) / Math.max(1e-9, dx * dx + dz * dz)));
      if (Math.hypot(c.x - (ax + dx * t), c.z - (az + dz * t)) < half + 0.8) return false;
    }
    return true;
  };
  for (const c of cands) if (clear(c)) return { key, x: c.x, z: c.z, ry: c.ry, y: T.h(c.x, c.z) };
  return null;
}

// the parts that need a BUILT house (the stair, the stoops): the bench and
// the gate build each house, then call this to lay the paths, the fences
// and the car
function finishPlot(vil, plot, house, built) {
  const rnd = vil.rnd;
  plot.path = planPath(plot, house, built);
  plot.fences = planFences(vil.V, plot, house, rnd);
  plot.car = planCar(vil, plot, house, built, rnd);
  return plot;
}

// ---------------------------------------------------------------------------
// THE FENCE, DRAWN
// ---------------------------------------------------------------------------
// posts every 2.4 m (the last bay takes the remainder), two rails between,
// and pickets on a picket fence; every post leans a little its own way, a
// picket here and there is short or gone, a rail dips at mid-bay. Into two
// bags: `post` (the posts, the frame's timber) and `deck` (rails and pickets,
// the cladding's). A gap is a bay with nothing in it but its two posts.
// a fence stops at the water: the segment is cut where the ground goes under
function clipToLand(T, seg) {
  const a = seg.a, b = seg.b;
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dry = t => T.h(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t) > T.waterY + 0.12;
  let t0 = 0, t1 = 1;
  const n = Math.max(2, Math.ceil(L / 0.5));
  const ok = [];
  for (let i = 0; i <= n; i++) ok.push(dry(i / n));
  if (!ok.some(v => v)) return null;
  while (t0 < n && !ok[t0]) t0++;
  while (t1 * n > t0 && !ok[Math.round(t1 * n)]) t1 -= 1 / n;
  // the longest dry run from the first dry sample
  let e = t0; while (e < n && ok[e + 1]) e++;
  const A = [a[0] + (b[0] - a[0]) * t0 / n, a[1] + (b[1] - a[1]) * t0 / n];
  const B = [a[0] + (b[0] - a[0]) * e / n, a[1] + (b[1] - a[1]) * e / n];
  const out = Object.assign({}, seg, { a: A, b: B });
  if (seg.gap) { const s0 = t0 / n * L; out.gap = [seg.gap[0] - s0, seg.gap[1] - s0]; }
  return out;
}

function buildFence(bags, T, seg0, hand, k0) {
  const seg = clipToLand(T, seg0);
  if (!seg) return 0;
  const a = seg.a, b = seg.b;
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (L < 1.0) return 0;
  const tg = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  const H = seg.style === 'picket' ? 1.05 : 1.15;
  const nb = Math.max(1, Math.round(L / 2.4));
  const pitch = L / nb;
  const j = (i, k) => { const h = Math.sin((a[0] + i * 3.7) * 12.9898 + (a[1] + k) * 78.233 + k0) * 43758.5453; return (h - Math.floor(h)) * 2 - 1; };
  const gy = (x, z) => T.h(x, z);
  const postAt = t => {
    const x = a[0] + tg[0] * t, z = a[1] + tg[1] * t, y = gy(x, z);
    const lean = 0.03 * hand;
    const top = [x + j(t, 1) * lean, y + H, z + j(t, 2) * lean];
    K.beam(bags.post, [x, y - 0.25, z], top, 0.055, 0.055,
           [tg[0] * Math.cos(j(t, 3) * 0.08 * hand) + tg[1] * Math.sin(j(t, 3) * 0.08 * hand), 0,
            tg[1] * Math.cos(j(t, 3) * 0.08 * hand) - tg[0] * Math.sin(j(t, 3) * 0.08 * hand)],
           0, { bevel: 0.005, uv: [t * 0.7, x + z] });
    return { x, z, y };
  };
  let n = 0;
  const posts = [];
  for (let i = 0; i <= nb; i++) posts.push(postAt(i * pitch));
  for (let i = 0; i < nb; i++) {
    const t0 = i * pitch, t1 = (i + 1) * pitch;
    if (seg.gap && t1 > seg.gap[0] && t0 < seg.gap[1]) continue;   // the gate's bay
    const p0 = posts[i], p1 = posts[i + 1];
    for (const rh of seg.style === 'picket' ? [0.28, 0.82] : [0.42, 0.98]) {
      const sag = 0.012 * hand * (1 + j(t0, 4));
      const A = [p0.x + tg[1] * 0.045, p0.y + rh, p0.z - tg[0] * 0.045];
      const B = [p1.x + tg[1] * 0.045, p1.y + rh - sag, p1.z - tg[0] * 0.045];
      K.beam(bags.deck, A, B, 0.018, 0.045, [0, 1, 0], 0, { bevel: 0.003, uv: [t0 * 0.9, rh] });
      n++;
    }
    if (seg.style === 'picket') {
      const np = Math.max(2, Math.round(pitch / 0.16));
      for (let q = 0; q < np; q++) {
        const u = (q + 0.5) / np;
        if (j(t0 + u, 5) > 0.92 - 0.10 * hand) continue;              // one gone
        const x = p0.x + (p1.x - p0.x) * u, z = p0.z + (p1.z - p0.z) * u;
        const y = gy(x, z);
        const top = H - 0.02 + j(t0 + u, 6) * 0.04 * hand;
        K.beam(bags.deck, [x + tg[1] * 0.075, y + 0.10, z - tg[0] * 0.075],
               [x + tg[1] * 0.075 + j(t0 + u, 7) * 0.012 * hand, y + top, z - tg[0] * 0.075],
               0.045, 0.010, [tg[1], 0, -tg[0]], 0, { bevel: 0.002, uv: [x + z, 0.3 * q] });
        n++;
      }
    }
  }
  return n + posts.length;
}

window.VILLAGE_GEN = { VDEF, makeTerrain, makeRoad, makePlots, makeVillage, finishPlot,
                       buildFence, clipToLand, inPoly, shoreZ, fbm };
})();
