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
  fenceOdds: 1.0,         // an edge fenced (the front always is, with its gate)
  oldFenceOdds: 0.25,     // a plot fenced with the scanned fence instead
  carOdds: 0.45,          // a plot with an abandoned car in the backyard
  boatOdds: 0.3,          // a plot with the trailered boat on the ground
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
    // TWO FACADES (G283, the user: "All houses touching the water should
    // have a decent entrance at the back, because that's where people get
    // in from the street"): a back door with its stoop and steps, and no
    // lean-to across it
    P.backDoor = 1; P.backPorch = 1; P.lean = 0;
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
// EVERY EDGE (G283, the user: "Please fully delimit the lots with fences, no
// holes. And have an entrance door to the lot, appropriately placed"): the
// two sides, the front and, on a land plot, the back - the shore is a water
// plot's back and needs none. A side shared with the neighbour is fenced
// ONCE (the village remembers, by its endpoints). The front has the GATE:
// a bay of its own, 1.3 m, where the path crosses, with a leaf hung on its
// first post. `fenceOdds` below 1 leaves the odd side open again.
const edgeKey = (a, b) => [a, b].map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).sort().join('|');
function planFences(V, plot, house, rnd, fenced) {
  const out = [];
  const old = rnd() < V.oldFenceOdds;
  const edges = [
    { a: plot.poly[1], b: plot.poly[2], kind: 'side' },
    { a: plot.poly[3], b: plot.poly[0], kind: 'side' },
    { a: plot.poly[0], b: plot.poly[1], kind: 'front' },
  ];
  if (plot.side === 'land') edges.push({ a: plot.poly[2], b: plot.poly[3], kind: 'back' });
  for (const e of edges) {
    const k = edgeKey(e.a, e.b);
    if (fenced && fenced.has(k)) continue;         // the neighbour's fence is this fence
    if (e.kind !== 'front' && rnd() > V.fenceOdds) continue;
    if (fenced) fenced.add(k);
    const seg = { a: e.a, b: e.b, kind: e.kind, style: old ? 'old' : (e.kind === 'front' ? 'picket' : 'rail'),
                  gap: null };
    if (e.kind === 'front') seg.gap = [house.gateT - 0.65, house.gateT + 0.65];
    out.push(seg);
  }
  return out;
}

// the path: from the road's edge, through the gate, to the house - to its
// stair foot when the stair faces the road, to the wall nearest the road
// when it does not; and, on a water plot, the house's own stair path goes
// to the water (the house draws that one itself)
function planPath(plot, house, built, road) {
  const st = built.stats.stair;
  const front = built.stats.front;
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
  // THE GATE SITS WHERE THE PATH ARRIVES (G283): the entrance projected
  // onto the frontage, inside the frontage by a post and a half
  const dx = target[0] - plot.poly[0][0], dz = target[1] - plot.poly[0][1];
  house.gateT = clamp(dx * plot.tg[0] + dz * plot.tg[1], 1.6, plot.w - 1.6);
  const gate = [plot.poly[0][0] + plot.tg[0] * house.gateT, plot.poly[0][1] + plot.tg[1] * house.gateT];
  // a bend two thirds of the way, so it is not a survey line
  const mid = [gate[0] + (target[0] - gate[0]) * 0.55 + plot.tg[0] * 1.2,
               gate[1] + (target[1] - gate[1]) * 0.55 + plot.tg[1] * 1.2];
  // the road's edge nearest the gate - found on the road's own line, since
  // the frontage is a chord of its curve and can sit a metre or two off it
  let best = null, bd = 1e9;
  for (let i = 1; i < road.pts.length; i++) {
    const A = road.pts[i - 1], B = road.pts[i];
    const dx2 = B[0] - A[0], dz2 = B[1] - A[1];
    const t = clamp(((gate[0] - A[0]) * dx2 + (gate[1] - A[1]) * dz2) / Math.max(1e-9, dx2 * dx2 + dz2 * dz2), 0, 1);
    const q = [A[0] + dx2 * t, A[1] + dz2 * t];
    const d = Math.hypot(gate[0] - q[0], gate[1] - q[1]);
    if (d < bd) { bd = d; best = q; }
  }
  const toGate = [gate[0] - best[0], gate[1] - best[1]];
  const tl = Math.hypot(toGate[0], toGate[1]) || 1;
  const roadEdge = [best[0] + toGate[0] / tl * (road.w / 2 + 0.2), best[1] + toGate[1] / tl * (road.w / 2 + 0.2)];
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
  // ONE SPREAD FOR THE VILLAGE (G285): every house's boats, people, bins,
  // bags, seats and junk, and the village's cars and poles, take the
  // least-used key, so eleven houses do not all get the same boat
  const spread = HG.makeSpread();
  for (const plot of plots) {
    if (houses.length >= nMax) break;
    const seed = 1000 + V.seed * 97 + plot.id * 13;
    const h = placeHouse(T, V, plot, seed, rnd);
    h.P.spread = spread;
    h.plot = plot.id;
    plot.house = houses.length;
    houses.push(h);
  }
  const poles = planPoles(T, V, road, rnd, spread, plots);
  return { V, T, road, plots, houses, rnd, spread, poles };
}

// THE CAR IN THE BACKYARD (G276, the user: "I would like these to be placed
// on the property lots, in the backyard preferably"). The backyard is the
// side of the house away from what it faces: behind an inland house (toward
// the plot's back edge), on the road side of a waterfront house. A car is
// parked roughly along the plot, its own length and width clear of the
// house, the fences (a metre and a half inside the plot line), the path and
// the water; the spots are tried from the house outward and the first clear
// one takes it. One per plot at `carOdds`, the Buick rarely.
// THE BOAT ON ITS TRAILER (G280, the user: "The highlighted boat is to be
// placed on the ground, either in the back lot or next to the water, on the
// side of the houses"): the same placer as the car with a second set of
// spots - beside the house, toward the water - on a waterfront plot
function planCar(vil, plot, house, built, rnd, thing) {
  const isBoat = thing === 'boat';
  const garage = !isBoat && plot.out && plot.out.kind === 'garage';
  if (!garage && rnd() > (isBoat ? vil.V.boatOdds : vil.V.carOdds)) return null;   // a garage always has its car
  const T = vil.T, keys = HG.CAR_KEYS;
  let key = isBoat ? 'boat_tirola' : (vil.spread ? vil.spread.pick(keys.filter(k => k !== 'car_buick'), rnd)
                                                : keys[Math.floor(rnd() * keys.length) % keys.length]);
  if (!isBoat && rnd() < 0.12 && !(vil.spread && vil.spread.used.car_buick)) key = 'car_buick';   // the big one, once
  const K = isBoat ? HG.PIER_KIT.boat_tirola : HG.YARD_KIT[key];
  const n = plot.n, tg = plot.tg;
  // the backyard direction, away from the house's front
  const back = plot.side === 'water' ? [-n[0], -n[1]] : [n[0], n[1]];
  const P = house.P;
  const ry0 = Math.atan2(tg[0], tg[1]);                   // along the plot
  const cands = [];
  // beside the house toward the water, first, for the boat on a water plot
  if (isBoat && plot.side === 'water')
    for (const sx of [1, -1]) for (let d = 0; d < 8; d += 1.5)
      cands.push({ x: house.x + tg[0] * sx * (P.L / 2 + K.W / 2 + 1.5) + n[0] * d,
                   z: house.z + tg[1] * sx * (P.L / 2 + K.W / 2 + 1.5) + n[1] * d,
                   ry: Math.atan2(n[0], n[1]) + (rnd() - 0.5) * 0.5 });
  for (let d = P.w / 2 + 1.2 + K.W / 2; d < plot.depth; d += 1.5)
    for (const s of [0, 1, -1, 2, -2])
      cands.push({ x: house.x + back[0] * d + tg[0] * s * 2.6, z: house.z + back[1] * d + tg[1] * s * 2.6,
                   ry: ry0 + (rnd() - 0.5) * 0.7 + (rnd() < 0.3 ? Math.PI / 2 : 0) });
  const half = Math.max(K.L, K.W) / 2;
  // THE CAR IN THE GARAGE DOOR (G287, the user: "We could put the old car in
  // the barns/garage, or sticking halfway through"): when the plot has a
  // garage, the car stands in its doorway, nose in, half of it inside
  // IN FRONT OF THE GARAGE, NOSE TO THE DOOR (G290 - the user: half inside
  // would want the door open and a dark interior, "maybe not worth it")
  if (!isBoat && plot.out && plot.out.kind === 'garage') {
    const o = plot.out;
    const cy = Math.cos(o.yaw), sy = Math.sin(o.yaw);
    const lz = o.P.w / 2 + K.L / 2 + 1.2;
    const x = o.x + lz * sy, z = o.z + lz * cy;
    if (inPoly(plot.poly, x, z) && T.h(x, z) > T.waterY + 0.3)
      return { key, x, z, ry: o.yaw + Math.PI + (rnd() - 0.5) * 0.2, y: T.h(x, z), garage: true };
  }
  const clear = c => spotClear(vil, plot, house, built, c, half);
  for (const c of cands) if (clear(c)) return { key, x: c.x, z: c.z, ry: c.ry, y: T.h(c.x, c.z) };
  return null;
}

// is a spot clear for a thing of `half` size: on the plot inside the line,
// dry, off the house, its stair, its stoop, the path, and the outbuilding
function spotClear(vil, plot, house, built, c, half) {
  const T = vil.T, P = house.P;
  {
    // on the plot, its own half-size inside the line
    for (let i = 0; i < 4; i++) {
      const a = plot.poly[i], b = plot.poly[(i + 1) % 4];
      const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
      const cross = ((c.x - a[0]) * dz - (c.z - a[1]) * dx) / L;
      if (Math.abs(cross) < half + 1.0) return false;
    }
    if (!inPoly(plot.poly, c.x, c.z)) return false;
    if (T.h(c.x, c.z) < T.waterY + 0.3) return false;
    // and never over the deck's stair or its jetty on a water plot
    if (plot.side === 'water' && built.stats.stair) {
      const st = built.stats.stair;
      const w = house.toWorld(st.x, (st.z0 + st.z1) / 2);
      if (Math.hypot(w[0] - c.x, w[1] - c.z) < half + Math.abs(st.z1 - st.z0) / 2 + 1.0) return false;
    }
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
    // clear of the outbuilding
    const o = plot.out;
    if (o) {
      const cy2 = Math.cos(o.yaw), sy2 = Math.sin(o.yaw);
      const x2 = c.x - o.x, z2 = c.z - o.z, lx2 = x2 * cy2 - z2 * sy2, lz2 = x2 * sy2 + z2 * cy2;
      if (Math.abs(lx2) < o.P.L / 2 + half + 0.6 && Math.abs(lz2) < o.P.w / 2 + half + 0.6) return false;
    }
    return true;
  }
}

// THE OUTBUILDING (G287): an outhouse on a small plot, a garden shed on a
// medium one, a garage on a large one - one of the house generator's own
// presets, stood in the backyard like a car is, its door toward the house
// (the garage's toward the road, so the car can drive in), on the terrain
// through the same P.ground the house has, with its own finish.
function planOutbuilding(vil, plot, house, built, rnd) {
  const T = vil.T, P = house.P;
  const area = Math.abs(plot.poly.reduce((a, p, i) => { const q = plot.poly[(i + 1) % 4]; return a + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
  let kind = null;
  if (area >= 800 && P.L >= 8.5) kind = rnd() < 0.75 ? 'garage' : 'storage shed';
  else if (area >= 450 || P.L >= 6.5) kind = rnd() < 0.7 ? 'storage shed' : 'outhouse';
  else kind = rnd() < 0.7 ? 'outhouse' : null;
  if (!kind) return null;
  const Q = Object.assign({}, HG.DEF, HG.PRESETS[kind], { outbuilding: 1, lights: 0, yard: 0, woodpile: 0,
    people: 0, pier: 0, smoke: 0, chim: 0, barrel: 0, water: 0, slopeX: 0, slopeZ: 0, stairs: 1 });
  const n = plot.n, tg = plot.tg;
  const back = plot.side === 'water' ? [-n[0], -n[1]] : [n[0], n[1]];
  // it faces the house (the garage too: at the back corner its door opens
  // onto the lot, and the car parks in front of it, on the lot)
  const fd = [-back[0], -back[1]];
  const yaw0 = Math.atan2(fd[0], fd[1]);
  const half = Math.max(Q.L, Q.w) / 2;
  // AT THE CORNERS AND THE BOTTOM (G290, the user: "I'd rather stick them
  // close to the corners and the bottom of the properties, not so close to
  // the house"): the two back corners first, inset by the building's own
  // half-size and a fence's breathing room, then along the back edge, then
  // up the sides - and never within three metres of the house
  const cands = [];
  // the back edge's two corners: bkL on the -along side, bkR on +along
  // (the polygon runs frontage 0 -> 1 along +tg, then 2 and 3 back)
  const bkL = plot.side === 'water' ? plot.poly[0] : plot.poly[3];
  const bkR = plot.side === 'water' ? plot.poly[1] : plot.poly[2];
  const ins = half + 1.4;
  const along = [tg[0], tg[1]];
  const inward = [-back[0], -back[1]];                    // from the back edge toward the house
  const corner = (c, sgn, d) => ({ x: c[0] + along[0] * sgn * ins + inward[0] * (ins + d),
                                   z: c[1] + along[1] * sgn * ins + inward[1] * (ins + d), ry: yaw0 + (rnd() - 0.5) * 0.25 });
  const first = rnd() < 0.5 ? 1 : -1;
  for (const d of [0, 1.5, 3]) {
    cands.push(first > 0 ? corner(bkL, 1, d) : corner(bkR, -1, d));
    cands.push(first > 0 ? corner(bkR, -1, d) : corner(bkL, 1, d));
  }
  // along the back edge, in from the left corner
  const bl = Math.hypot(bkR[0] - bkL[0], bkR[1] - bkL[1]);
  for (let u = ins + 2.5; u < bl - ins; u += 2.5)
    cands.push({ x: bkL[0] + along[0] * u + inward[0] * ins, z: bkL[1] + along[1] * u + inward[1] * ins, ry: yaw0 + (rnd() - 0.5) * 0.25 });
  // up the sides, from the back
  for (let d = ins + 2.5; d < plot.depth * 0.6; d += 2.5) for (const sgn of [1, -1]) {
    const c = sgn > 0 ? bkR : bkL;
    cands.push({ x: c[0] - along[0] * sgn * ins + inward[0] * d, z: c[1] - along[1] * sgn * ins + inward[1] * d, ry: yaw0 + (rnd() - 0.5) * 0.25 });
  }
  const farFromHouse = c => {
    const cy0 = Math.cos(house.yaw), sy0 = Math.sin(house.yaw);
    const x = c.x - house.x, z = c.z - house.z, lx = x * cy0 - z * sy0, lz = x * sy0 + z * cy0;
    return Math.abs(lx) > P.L / 2 + half + 3.0 || Math.abs(lz) > P.w / 2 + (P.porch ? P.porchD : 0) + half + 3.0;
  };
  let spot = null;
  for (const c of cands) if (farFromHouse(c) && spotClear(vil, plot, house, built, c, half + 0.5)) { spot = c; break; }
  if (!spot) return null;
  const c = [spot.x, spot.z], yaw = spot.ry;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const toWorld = (lx, lz) => [c[0] + lx * cy + lz * sy, c[1] - lx * sy + lz * cy];
  const oy = T.h(c[0], c[1]);
  const ground = (lx, lz) => { const w = toWorld(lx, lz); return T.h(w[0], w[1]) - oy; };
  Q.ground = ground;
  let hiC = -1e9;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) hiC = Math.max(hiC, ground(sx * Q.L / 2, sz * Q.w / 2));
  Q.floorY = Math.max(Q.floorY, hiC + 0.12);
  return { kind, P: Q, x: c[0], z: c[1], y: oy, yaw, toWorld, ground };
}

// THE POLES ALONG THE ROAD (G285): one every 32-40 m on the inland verge,
// between the road and the frontages, the three presets spread; never in
// front of a gate (the path crosses there)
function planPoles(T, V, road, rnd, spread, plots) {
  const out = [];
  let t = 10 + rnd() * 10;
  while (t < road.length - 8) {
    const a = road.at(t);
    // half a metre off the road's edge, as a roadside pole stands; a
    // frontage on a bend is a chord that can come in further than that, so
    // a spot inside a plot is skipped
    const off = road.w / 2 + 0.5;
    const x = a.p[0] - a.n[0] * off, z = a.p[1] - a.n[1] * off;   // -n: inland
    if (!(plots || []).some(p => inPoly(p.poly, x, z)))
      out.push({ key: spread ? spread.pick(HG.POLE_KEYS, rnd) : 'pole_b', x, z, y: T.h(x, z),
                 ry: Math.atan2(a.tg[0], a.tg[1]) + (rnd() - 0.5) * 0.2, t });
    t += 32 + rnd() * 8;
  }
  return out;
}

// ---------------------------------------------------------------------------
// THE LOT'S GROUND (G290, the user: "the whole lot should be projected, and
// possibly not relying on the terrain generation. It could hold its own
// vegetation, and its own projected ground texture, this one using its own
// small alpha splatting for grass and dirt")
// ---------------------------------------------------------------------------
// One patch per lot: a grid over the plot's own polygon and a margin, every
// vertex put ON the terrain by the height sampler - the lot owns its surface,
// never its height - and carrying the SPLAT the plan gives it:
//   aSplat.x  the yellower grass, on a slow noise, so a lawn is not one scan
//   aSplat.y  dry ground: under the house, the deck, the outbuilding
//   aSplat.z  dirt: along every path
//   aSplat.w  pebbles: the seafront, by height above the tide
//   aTone.x   dark: the same occluders the skirt reads (posts, props, cars,
//             fence posts, the buildings' footprints)
//   aTone.y   lush: within a stride of a fence, where nobody walks
//   aAlpha    1 inside the plot line, fading to 0 across the margin, so the
//             patch meets the terrain with no seam
// The shader (the bench's, tools/_village.html) splats the five sets on these
// with a finer noise at every edge and a slow colour tint over the grass. The
// game hands the same function its own height sampler.
function lotGround(vil, plot, house, built, occ) {
  const T = vil.T, cell = 0.45, M = 1.8;
  const poly = plot.poly;
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
  for (const p of poly) { x0 = Math.min(x0, p[0]); z0 = Math.min(z0, p[1]); x1 = Math.max(x1, p[0]); z1 = Math.max(z1, p[1]); }
  x0 -= M; z0 -= M; x1 += M; z1 += M;
  const nx = Math.ceil((x1 - x0) / cell), nz = Math.ceil((z1 - z0) / cell);
  const edgeDist = (x, z) => {
    let d = 1e9;
    for (let i = 0; i < 4; i++) {
      const a = poly[i], b = poly[(i + 1) % 4];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / Math.max(1e-9, dx * dx + dz * dz), 0, 1);
      d = Math.min(d, Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t)));
    }
    return d;
  };
  // the rectangles that make the ground dry: the house (with its deck), the outbuilding
  const rects = [];
  const P = house.P;
  rects.push({ x: house.x, z: house.z, yaw: house.yaw, hx: P.L / 2, hz0: -P.w / 2, hz1: P.w / 2 + (P.porch ? P.porchD : 0) });
  if (plot.out) rects.push({ x: plot.out.x, z: plot.out.z, yaw: plot.out.yaw, hx: plot.out.P.L / 2, hz0: -plot.out.P.w / 2, hz1: plot.out.P.w / 2 });
  const dryAt = (x, z) => {
    let w = 0;
    for (const r of rects) {
      const c = Math.cos(r.yaw), s = Math.sin(r.yaw);
      const dx = x - r.x, dz = z - r.z, lx = dx * c - dz * s, lz = dx * s + dz * c;
      const ox = Math.max(0, Math.abs(lx) - r.hx);
      const oz = lz < r.hz0 ? r.hz0 - lz : (lz > r.hz1 ? lz - r.hz1 : 0);
      const o = Math.hypot(ox, oz);
      w = Math.max(w, 1 - clamp(o / 1.2, 0, 1));
    }
    return w;
  };
  // the paths: the plot's own (road, gate, outbuilding) and the house's (its stair to the water)
  const segs = (plot.path || []).concat(plot.outPath || []).map(sg => [sg[0], sg[1]]);
  for (const sg of built.stats.path || []) segs.push([house.toWorld(sg[0][0], sg[0][1]), house.toWorld(sg[1][0], sg[1][1])]);
  const dirtAt = (x, z) => {
    let d = 1e9;
    for (const sg of segs) {
      const dx = sg[1][0] - sg[0][0], dz = sg[1][1] - sg[0][1];
      const t = clamp(((x - sg[0][0]) * dx + (z - sg[0][1]) * dz) / Math.max(1e-9, dx * dx + dz * dz), 0, 1);
      d = Math.min(d, Math.hypot(x - (sg[0][0] + dx * t), z - (sg[0][1] + dz * t)));
    }
    return 1 - clamp((d - 0.35) / 0.55, 0, 1);
  };
  // the fences: every edge of the plot that is fenced, its own or the neighbour's
  const fenced = [];
  for (let i = 0; i < 4; i++) {
    const a = poly[i], b = poly[(i + 1) % 4];
    if (vil.fenced && vil.fenced.has(edgeKey(a, b))) fenced.push([a, b]);
  }
  const lushAt = (x, z) => {
    let d = 1e9;
    for (const sg of fenced) {
      const dx = sg[1][0] - sg[0][0], dz = sg[1][1] - sg[0][1];
      const t = clamp(((x - sg[0][0]) * dx + (z - sg[0][1]) * dz) / Math.max(1e-9, dx * dx + dz * dz), 0, 1);
      d = Math.min(d, Math.hypot(x - (sg[0][0] + dx * t), z - (sg[0][1] + dz * t)));
    }
    return 1 - clamp((d - 0.3) / 1.4, 0, 1);
  };
  const darkAt = (x, z) => {
    let w = 0;
    for (const o of occ) {
      const c = Math.cos(o.ry || 0), s = Math.sin(o.ry || 0);
      const dx = x - o.x, dz = z - o.z, lx = dx * c - dz * s, lz = dx * s + dz * c;
      let out;
      if (o.hx !== undefined) out = Math.hypot(Math.max(0, Math.abs(lx) - o.hx), Math.max(0, Math.abs(lz) - o.hz));
      else out = Math.max(0, Math.hypot(lx, lz) - o.r);
      const soft = o.soft === undefined ? 0.5 : o.soft;
      w = Math.max(w, (o.k === undefined ? 0.4 : o.k) * (1 - clamp(out / Math.max(0.05, soft), 0, 1)));
    }
    return w;
  };
  const pos = [], uv = [], splat = [], tone = [], alpha = [], idx = [];
  const id = new Int32Array((nx + 1) * (nz + 1)).fill(-1);
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = x0 + i * cell, z = z0 + j * cell;
    const inside = inPoly(poly, x, z);
    const d = edgeDist(x, z);
    if (!inside && d > M) continue;
    const y = T.h(x, z);
    id[j * (nx + 1) + i] = pos.length / 3;
    pos.push(x, y + 0.02, z);
    uv.push(x, z);
    const peb = 1 - clamp((y - T.waterY - 0.35) / 0.85, 0, 1);
    splat.push(fbm(x * 0.09 + 11.3, z * 0.09 + 4.1, vil.V.seed + 21, 3), dryAt(x, z), dirtAt(x, z), peb);
    tone.push(darkAt(x, z), lushAt(x, z));
    alpha.push(inside ? 1 : 1 - d / M);
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = id[j * (nx + 1) + i], b = id[j * (nx + 1) + i + 1], c = id[(j + 1) * (nx + 1) + i + 1], d = id[(j + 1) * (nx + 1) + i];
    if (a < 0 || b < 0 || c < 0 || d < 0) continue;
    idx.push(a, d, c, a, c, b);
  }
  return { pos, uv, splat, tone, alpha, idx, verts: pos.length / 3 };
}

// the parts that need a BUILT house (the stair, the stoops): the bench and
// the gate build each house, then call this to lay the paths, the fences
// and the car
function finishPlot(vil, plot, house, built) {
  const rnd = vil.rnd;
  plot.path = planPath(plot, house, built, vil.road);
  vil.fenced = vil.fenced || new Set();
  plot.fences = planFences(vil.V, plot, house, rnd, vil.fenced);
  plot.out = planOutbuilding(vil, plot, house, built, rnd);
  // THE PATH TO IT (G290): from the house's back door (or the middle of the
  // wall that faces it) to the outbuilding's door, with a bend
  if (plot.out) {
    const o = plot.out;
    const door = o.toWorld(0, o.P.w / 2 + 0.7);
    const bk = built.stats.stoop;
    const from = bk ? house.toWorld(bk.x, bk.z - bk.side * (bk.depth + 0.5))
                    : house.toWorld(0, (plot.side === 'water' ? -1 : 1) * (house.P.w / 2 + (plot.side === 'water' ? 1.0 : (house.P.porch ? house.P.porchD : 0) + 1.0)));
    const mid = [from[0] + (door[0] - from[0]) * 0.5 + plot.tg[0] * 0.9, from[1] + (door[1] - from[1]) * 0.5 + plot.tg[1] * 0.9];
    plot.outPath = [[from, mid], [mid, door]];
  }
  plot.car = planCar(vil, plot, house, built, rnd, 'car');
  plot.boat = planCar(vil, plot, house, built, rnd, 'boat');
  if (plot.car && plot.boat && Math.hypot(plot.car.x - plot.boat.x, plot.car.z - plot.boat.z) < 5.5) plot.boat = null;
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
// THE GATE LEAF (G283): a frame - two stiles, two rails, a brace - and
// pickets, hung on the gate's first post and standing a third open into the
// plot, which is how a garden gate is found. Drawn into the same bags.
function gateLeaf(bags, T, a, tg, t0, t1, H, hand, j, style) {
  const W = t1 - t0 - 0.10, open = 0.45 + 0.3 * j(t0, 9);      // radians, into the plot
  const hx = a[0] + tg[0] * (t0 + 0.05), hz = a[1] + tg[1] * (t0 + 0.05);
  const gy = T.h(hx, hz);
  // the leaf's own direction: the fence's, swung by `open` toward -n (into the plot: the
  // plot lies on the fence's left when walking a -> b, which is [-tg[1], tg[0]])
  const c = Math.cos(open), s = Math.sin(open);
  const d = [tg[0] * c + (-tg[1]) * s, tg[1] * c + tg[0] * s];
  const at = (u, y) => [hx + d[0] * u, gy + y, hz + d[1] * u];
  const gh = Math.min(H, 1.05);
  const up = [0, 1, 0];
  let n = 0;
  // the stiles
  for (const u of [0.05, W - 0.05]) {
    K.beam(bags.deck, at(u, 0.12), at(u, gh), 0.035, 0.035, [d[1], 0, -d[0]], 0, { bevel: 0.003 });
    n++;
  }
  // the rails and the brace
  for (const y of [0.30, gh - 0.18]) {
    K.beam(bags.deck, at(0.05, y), at(W - 0.05, y), 0.02, 0.045, up, 0, { bevel: 0.003 });
    n++;
  }
  K.beam(bags.deck, at(0.06, 0.32), at(W - 0.06, gh - 0.2), 0.02, 0.04, up, 0, { bevel: 0.003 });
  n++;
  // the pickets, on the road side of the frame
  const np = Math.max(3, Math.round(W / 0.14));
  for (let q = 0; q < np; q++) {
    const u = 0.07 + (W - 0.14) * (q + 0.5) / np;
    const top = gh + 0.02 + j(t0 + q, 6) * 0.03 * hand;
    K.beam(bags.deck, [at(u, 0.16)[0] - d[1] * 0.035, gy + 0.16, at(u, 0.16)[2] + d[0] * 0.035],
           [at(u, top)[0] - d[1] * 0.035, gy + top, at(u, top)[2] + d[0] * 0.035],
           0.04, 0.01, [d[1], 0, -d[0]], 0, { bevel: 0.002, uv: [u, q * 0.3] });
    n++;
  }
  // the hinge post and the latch post stand taller than the run
  for (const t of [t0, t1]) {
    const x = a[0] + tg[0] * t, z = a[1] + tg[1] * t, y = T.h(x, z);
    K.beam(bags.post, [x, y - 0.25, z], [x, y + H + 0.18, z], 0.065, 0.065, [tg[0], 0, tg[1]], 0, { bevel: 0.006, uv: [t, x + z] });
    n++;
  }
  return n;
}

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
  // THE POSTS: every 2.4 m along each stretch, and where there is a gate the
  // stretch breaks at the gate's two posts, so the gate is its own bay -
  // 1.3 m, not a whole fence bay - and its leaf hangs on the first of them
  const gap = seg.gap && seg.gap[1] > 0.3 && seg.gap[0] < L - 0.3
    ? [Math.max(0.3, seg.gap[0]), Math.min(L - 0.3, seg.gap[1])] : null;
  const ts = [];
  const stretch = (u0, u1) => {
    const nb = Math.max(1, Math.round((u1 - u0) / 2.4));
    for (let i = 0; i <= nb; i++) ts.push(u0 + (u1 - u0) * i / nb);
  };
  if (gap) { stretch(0, gap[0]); stretch(gap[1], L); } else stretch(0, L);
  const posts = ts.map(postAt);
  if (seg0.feet) for (const p of posts) seg0.feet.push([p.x, p.z]);
  const bays = [];
  for (let i = 0; i + 1 < ts.length; i++) {
    const t0 = ts[i], t1 = ts[i + 1];
    if (gap && Math.abs(t0 - gap[0]) < 1e-6 && Math.abs(t1 - gap[1]) < 1e-6) continue;
    bays.push([i, t0, t1]);
  }
  if (gap) n += gateLeaf(bags, T, a, tg, gap[0], gap[1], H, hand, j, seg.style);
  for (const [i, t0, t1] of bays) {
    const pitch = t1 - t0;
    const p0 = posts[i], p1 = posts[i + 1];
    for (const rh of seg.style === 'picket' ? [0.28, 0.82] : [0.42, 0.98]) {
      const sag = 0.012 * hand * (1 + j(t0, 4));
      const A = [p0.x + tg[1] * 0.045, p0.y + rh, p0.z - tg[0] * 0.045];
      const B = [p1.x + tg[1] * 0.045, p1.y + rh - sag, p1.z - tg[0] * 0.045];
      K.beam(bags.deck, A, B, 0.018, 0.045, [0, 1, 0], 0, { bevel: 0.003, uv: [t0 * 0.9, rh] });
      n++;
    }
    if (seg.style === 'picket' || seg.style === 'old') {
      if (seg.style === 'old') continue;            // the scanned stretch is the pickets
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
                       buildFence, gateLeaf, clipToLand, inPoly, shoreZ, fbm, lotGround, edgeKey };
})();
