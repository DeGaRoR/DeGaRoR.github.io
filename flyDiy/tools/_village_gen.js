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
const BG = () => window.BIG_GEN;          // the big buildings (G312), loaded after this or not at all
const TG = () => window.TOTEM_GEN;        // the totem park (G352), loaded after this or not at all
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
  size: 320,              // metres, square, centred on 0 (G340: enlarged - the mine ate the village)
  // THE TOTEM PARK (G352): up the mountain behind the village at `parkT` of the road (or the first clear spot), inland until the hill is `parkRise` over the road, a plot `parkW` x `parkD`
  park: 1, parkT: 0.85, parkRise: 8, parkW: 36, parkD: 40,
  waterY: 0,
  shoreFrac: 0.28,        // the shore this fraction of the tile in from the front edge: the water in front, the land behind
  slope: 0.055,           // the land climbs this much per metre away from the water (+z)
  relief: 2.2,            // the big noise, metres
  detail: 0.35,           // the small noise, metres
  seabed: 0.09,           // steeper under the water, so a pier has depth
  // THE MOUNTAIN (G340, the user: "mountain on one side, water on the other,
  // and a varied, yet coherent slope through, not just a big bump"): the
  // land is a bench off the shore, then it rears up behind a foot line
  // that wanders in x, over mtnRun metres to mtnH, spurs and gullies on it
  mtnFoot: 95,            // the foot this far past the shore
  mtnWander: 25,          // the foot line wanders this much either way
  mtnRun: 150,            // the rise takes this many metres
  mtnH: 60,               // and climbs this high (the ridges more, the gullies less)
  mtnRelief: 6,           // the mountain's own noise, metres
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
  site: '',               // a theme by name (THEMES), on a hill behind the road; '' for none
  siteT: 0,               // where along the road, metres; 0 = the middle
};

// `pin` = [x, foot]: the mountain's foot held at `foot` past the shore near
// this x (fading over 70 m) - the site's works stand on the flat and the
// mill climbs the foot, wherever the foot line wanders elsewhere
function makeTerrain(V, pin) {
  const s = V.seed * 0.618 + 1;
  const half = V.size / 2, zSh = -half + V.size * (V.shoreFrac === undefined ? 0.5 : V.shoreFrac);
  const h = (x, z) => {
    const zz = z - zSh;
    const big = (fbm(x * 0.012 + 3.1, z * 0.012 + 7.7, s, 3) - 0.5) * 2 * V.relief;
    const small = (fbm(x * 0.09, z * 0.09, s + 5, 3) - 0.5) * 2 * V.detail;
    let y = V.slope * zz + big + small;
    // THE MOUNTAIN (G340): past the foot line, a smooth ramp on to mtnH
    // (linear on beyond), ridges and gullies across it, its own relief
    if (V.mtnH > 0) {
      let foot = V.mtnFoot + (fbm(x * 0.006 + 9.2, 0.5, s + 11, 2) - 0.5) * 2 * V.mtnWander;
      if (pin) { const k = clamp(1 - Math.abs(x - pin[0]) / 70, 0, 1); foot += (pin[1] - foot) * k * k * (3 - 2 * k); }
      const u = Math.max(0, zz - foot) / V.mtnRun;
      if (u > 0) {
        const ramp = u < 1 ? u * u * (3 - 2 * u) : 1 + (u - 1) * 1.6;
        const ridge = 0.7 + 0.6 * fbm(x * 0.011 + 4.4, zz * 0.011 + 1.3, s + 13, 3);
        y += V.mtnH * ramp * ridge + (fbm(x * 0.03 + 1.0, zz * 0.03 + 2.0, s + 17, 3) - 0.5) * 2 * V.mtnRelief * Math.min(1, u * 2);
      }
    }
    // the seabed falls away faster than the beach climbs
    if (y < V.waterY) y = V.waterY + (y - V.waterY) * (V.seabed / V.slope);
    return y;
  };
  return { h, size: V.size, waterY: V.waterY, zShore: zSh };
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
  return polyRoad(pts, V.roadW);
}

// THE SPUR (G340, the user: "push the factory further back, in the
// mountains with no water access, and leave the water front for the
// village"): the mine's own road off the shore road - inland `in` metres,
// a rounded corner, then along the mountain's foot parallel to the shore
// road, `before` metres back from the corner to the site's anchor and
// `after` on past it (the receiving house astride it). A polyRoad like the
// shore road, so the site's frame reads it the same way.
function makeSpur(road, tJ, sp) {
  const a = road.at(tJ), up = [-a.n[0], -a.n[1]], tg = a.tg, R = 10;
  const pts = [a.p.slice()];
  for (let d = 4; d <= sp.in - R; d += 4) pts.push([a.p[0] + up[0] * d, a.p[1] + up[1] * d]);
  const E = [a.p[0] + up[0] * (sp.in - R), a.p[1] + up[1] * (sp.in - R)];
  const C = [E[0] + tg[0] * R, E[1] + tg[1] * R];
  for (let k = 1; k <= 4; k++) {
    const th = k / 4 * Math.PI / 2;
    pts.push([C[0] - tg[0] * R * Math.cos(th) + up[0] * R * Math.sin(th), C[1] - tg[1] * R * Math.cos(th) + up[1] * R * Math.sin(th)]);
  }
  const F = pts[pts.length - 1];
  const along = sp.before + sp.after - R;
  for (let d = 4; d <= along; d += 4) pts.push([F[0] + tg[0] * d, F[1] + tg[1] * d]);
  const last = [F[0] + tg[0] * along, F[1] + tg[1] * along];
  if (Math.hypot(last[0] - pts[pts.length - 1][0], last[1] - pts[pts.length - 1][1]) > 0.5) pts.push(last);
  const spur = polyRoad(pts, road.w);
  // the site's anchor: `before` metres along from the corner's end
  let tF = 0;
  for (let i = 1; i < pts.length; i++) { tF += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (pts[i] === F) break; }
  spur.tAnchor = tF + sp.before - R;
  return spur;
}

// a road from its points: arclength, tangent and the water-side normal
function polyRoad(pts, w) {
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
  return { pts, s, length: s[s.length - 1], at, w };
}

// ---------------------------------------------------------------------------
// THE PLOTS
// ---------------------------------------------------------------------------
function makePlots(T, V, road, rnd, site, park) {
  const plots = [];
  const total = road.length;
  let t = 6 + rnd() * 8;
  let id = 0;
  while (t < total - 26) {
    const w = V.plotMin + rnd() * (V.plotMax - V.plotMin);
    if (t + w > total - 6) break;
    for (const side of ['water', 'land']) {
      if (rnd() < V.gapOdds) continue;
      // the site's span of the road: no plots on the land side, nor on
      // the water side across from the tram shed (G321)
      // (G340: the mine is up its own spur now - only the junction on the
      // land side is kept free)
      if (site && side === 'land' && t + w > site.jt - 14 && t < site.jt + 14) continue;
      // (G348: nor where the tram's base station stands)
      if (site && site.tram && side === 'land' && t + w > site.tram.t - 22 && t < site.tram.t + 22) continue;
      // (G352: nor on the land strip the totem park's path climbs through)
      if (park && side === 'land' && t + w > park.t - park.plot.w / 2 - 6 && t < park.t + park.plot.w / 2 + 6) continue;
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
      // ON A BEND TOWARD THE LAND the land plots' backs converge and cross
      // (G340, the longer road found it): pull this plot's back in until no
      // corner of it is in a neighbour and none of theirs in it
      {
        let ok = false;
        const dMin = side === 'water' ? 12 + V.riparian : 14;
        for (let cut = 0; depth - cut >= dMin && !ok; cut += 2) {
          if (side === 'water') {
            const d0 = shoreDepth(T, f0, [a.n[0], a.n[1]]) + V.riparian - cut, d1 = shoreDepth(T, f1, [b.n[0], b.n[1]]) + V.riparian - cut;
            b0 = [f0[0] + a.n[0] * d0, f0[1] + a.n[1] * d0];
            b1 = [f1[0] + b.n[0] * d1, f1[1] + b.n[1] * d1];
            depth = Math.min(d0, d1);
          } else {
            depth = V.plotDepth - cut;
            b0 = [f0[0] - a.n[0] * depth, f0[1] - a.n[1] * depth];
            b1 = [f1[0] - b.n[0] * depth, f1[1] - b.n[1] * depth];
          }
          const q = [f0, f1, b1, b0];
          ok = !plots.some(p => p.side === side && (inPoly(p.poly, b0[0], b0[1]) || inPoly(p.poly, b1[0], b1[1]) || p.poly.some(c => inPoly(q, c[0], c[1]))));
        }
        if (!ok) continue;
      }
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
function placeHouse(T, V, plot, seed, rnd, preset) {
  // THE STAPLES (G309): a named preset instead of the sampler's draw - the
  // church and the town hall - with the village's own spread and finish
  const P = preset ? Object.assign({}, HG.DEF, HG.PRESETS[preset]) : HG.randomHouse(seed);
  if (preset) P.preset = preset;
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

// THE BIG BUILDINGS ON THEIR PLOTS (G312, the user: "Go for the larger
// buildings now ... Also think of commercial buildings"): a warehouse, a
// cannery, a workshop or a store from tools/_big_gen.js, stood on a plot
// the way a house is - fronting the road, made to fit the frontage - but
// on the LAND even on a waterfront plot (a cannery on piles is a later
// kit), with a gravel yard instead of a lawn and no fence: an industrial
// lot is open to the road.
function placeBig(T, V, plot, seed, rnd, preset) {
  const B = BG();
  const P = Object.assign({}, B.DEF, B.PRESETS[preset] || {}, { seed });
  P.preset = preset; P.big = 1;
  const n = plot.n;
  const face = plot.side === 'water' ? [n[0], n[1]] : [-n[0], -n[1]];
  // it FACES THE ROAD whichever side the plot is: on a water plot the
  // front (+z) turns back toward the road
  const yaw = Math.atan2(-face[0], -face[1]) + (plot.side === 'water' ? 0 : Math.PI);
  const maxL = plot.w - 4, maxW = Math.min(plot.depth - 10, 16);
  P.L = clamp(P.L, 6, Math.max(6, maxL));
  P.w = clamp(P.w, 4, Math.max(4, maxW));
  P.slopeX = 0; P.slopeZ = 0;
  const cl = d => [plot.front[0] + n[0] * d, plot.front[1] + n[1] * d];
  let d = P.w / 2 + (P.dock ? P.dockD : 0) + 4.5;
  let c = cl(d);
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  let toWorld = (lx, lz) => [c[0] + lx * cy + lz * sy, c[1] - lx * sy + lz * cy];
  const fits = () => [[-1, -1], [1, -1], [1, 1], [-1, 1]].every(q => {
    const w = toWorld(q[0] * P.L / 2, q[1] * P.w / 2); return inPoly(plot.poly, w[0], w[1]); });
  for (let it = 0; it < 30 && !fits(); it++) {
    if (P.L > 7) P.L *= 0.92;
    else if (P.w > 5) P.w *= 0.92;
    else { d += 1; c = cl(d); toWorld = (lx, lz) => [c[0] + lx * cy + lz * sy, c[1] - lx * sy + lz * cy]; }
  }
  const oy = T.h(c[0], c[1]);
  const ground = (lx, lz) => { const w = toWorld(lx, lz); return T.h(w[0], w[1]) - oy; };
  P.ground = ground;
  let hiC = -1e9;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) hiC = Math.max(hiC, ground(sx * P.L / 2, sz * P.w / 2));
  P.floorY = hiC + Math.max(0.35, P.floorY);
  P.water = 0; P.pier = 0;
  return { P, x: c[0], z: c[1], y: oy, yaw, toWorld, ground, seed, gen: 'big' };
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
  if (house.P.big) return out;             // an industrial lot is open to the road (G312)
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
  let T = makeTerrain(V);
  const road = makeRoad(T, V);
  // THE SITE (G321, G340): a theme up its own spur off the shore road, at
  // the mountain's foot. The road is laid on the shore; the spur leaves it
  // toward one end of the tile (the village keeps the middle, its church
  // and town hall there), the mountain's foot is pinned flat where the
  // works stand, and the site's frame reads the spur as the village reads
  // the road: x along it, z inland
  let site = null;
  if (V.site && THEMES[V.site]) {
    const th = THEMES[V.site];
    // (the spur's leg runs on `before + after` past the junction: the junction
    // sits so the works stay inside the tile, the village keeps the middle)
    const tJ = V.siteT > 0 ? V.siteT : road.length * 0.6;
    const spur = makeSpur(road, tJ, th.spur);
    const a = spur.at(spur.tAnchor);
    T = makeTerrain(V, [a.p[0], a.p[1] - T.zShore + th.foot]);
    site = { name: V.site, t: spur.tAnchor, at: a, road: spur, jt: tJ, theme: th };
    // THE SHOULDER (G350): the mill's top house on a flat pad cut into the
    // mountain, at the hill's own height a third of the way in - the same
    // numbers the mill builds to (HG.millPlan), in the mill's frame on the spur
    const mi = th.items.find(it => it.gen === 'house' && HG.PRESETS[it.preset] && HG.PRESETS[it.preset].mill);
    if (mi) {
      const Pm = Object.assign({}, HG.DEF, HG.PRESETS[mi.preset], mi.P || {}, { recvZ: mi.z });
      const Mp = HG.millPlan(Pm);
      const am = spur.at(spur.tAnchor + mi.x), upm = [-am.n[0], -am.n[1]];
      const cm = [am.p[0] + upm[0] * mi.z, am.p[1] + upm[1] * mi.z];
      const yawm = Math.atan2(-upm[0], -upm[1]) + (mi.yaw || 0);
      const lv = T.h(cm[0] + Mp.zLevel * Math.sin(yawm), cm[1] + Mp.zLevel * Math.cos(yawm));
      const rect = { x0: Mp.x0, x1: Mp.x1, z0: Mp.zPB, z1: Mp.zPF };
      T = withShelf(T, cm, yawm, rect, lv, Mp.marginF, Mp.marginB);
      site.shelf = { c: cm, yaw: yawm, rect, level: lv, marginF: Mp.marginF, marginB: Mp.marginB };
    }
    if (th.tram) site.tram = { t: road.length * th.tram.t, back: th.tram.back, topZ: th.tram.topZ };
  }
  // THE TOTEM PARK (G352): placed before the plots (its path wants a clear
  // strip) and before the trees (its lawn is a clearing); it flattens its lawn
  const parked = placePark(T, V, road, rnd, site);
  const park = parked ? parked.park : null;
  if (parked) T = parked.T;
  const plots = makePlots(T, V, road, rnd, site, park);
  const houses = [];
  const nMax = V.nHouses > 0 ? V.nHouses : plots.length;
  // ONE SPREAD FOR THE VILLAGE (G285): every house's boats, people, bins,
  // bags, seats and junk, and the village's cars and poles, take the
  // least-used key, so eleven houses do not all get the same boat
  const spread = HG.makeSpread();
  // THE STAPLES (G309, the user: "sprinkle a couple of staple houses in
  // there; a church, the townhall"): a village of six plots or more has
  // both, on land plots (a church on piles is another village), the town
  // hall on the widest, the church on the widest of the rest at least two
  // plots away, so they are not one civic block
  // (G340, the user: "the water front for the village, with the townhouse
  // and the church in the middle": the hall on the widest of the three land
  // plots nearest the road's middle, the church on the nearest of the rest)
  const civic = {};
  if (plots.length >= 6) {
    const c = civicPlots(plots, road);
    if (c.hall) civic[c.hall] = 'town hall';
    if (c.church) civic[c.church] = 'church';
  }
  // THE COMMERCIAL PLOTS (G312): eight plots or more and the big generator
  // loaded → a store on the land plot nearest the road's middle that is
  // not civic, a workshop on the next free land plot along, the cannery
  // on the widest water plot (on its land half, facing the road)
  const big = {};
  if (plots.length >= 8 && BG()) {
    const mid = road.length / 2;
    const land = plots.filter(p => p.side === 'land' && !civic[p.id]).sort((a, b) => Math.abs((a.s0 + a.s1) / 2 - mid) - Math.abs((b.s0 + b.s1) / 2 - mid));
    if (land[0]) big[land[0].id] = 'store';
    if (land[1]) big[land[1].id] = 'workshop';
    const water = plots.filter(p => p.side === 'water').sort((a, b) => b.w - a.w);
    if (water[0]) big[water[0].id] = 'cannery';
  }
  for (const plot of plots) {
    if (houses.length >= nMax) break;
    const seed = 1000 + V.seed * 97 + plot.id * 13;
    const h = big[plot.id] ? placeBig(T, V, plot, seed, rnd, big[plot.id]) : placeHouse(T, V, plot, seed, rnd, civic[plot.id]);
    h.P.spread = spread;
    h.plot = plot.id;
    plot.house = houses.length;
    houses.push(h);
  }
  const poles = planPoles(T, V, road, rnd, spread, plots).filter(q => !site || (Math.abs(q.t - site.jt) > 8 && (!site.tram || Math.abs(q.t - site.tram.t) > 20)));
  const vil = { V, T, road, plots, houses, rnd, spread, poles, site, park };
  if (site) placeSite(vil);
  return vil;
}

// A STREET LAMP on a utility pole (G370, the user: "lighting of the streets
// too"): an arm out over the road from near the pole's top with a brace, a
// cobra head at its tip, the lens a glowing glass plate underneath; the
// record a viewer stands a point light in is left on the pole (`q.light`).
// Drawn into the caller's bags (metal, glass)
function streetLamp(bags, q) {
  const n = [q.n[0], 0, q.n[1]];
  const top = [q.x, q.y + 5.9, q.z], tip = [q.x + n[0] * 1.7, q.y + 6.25, q.z + n[2] * 1.7];
  K.beam(bags.metal, top, tip, 0.04, 0.04, [0, 1, 0], 0);
  K.beam(bags.metal, [q.x, q.y + 5.2, q.z], [q.x + n[0] * 0.9, q.y + 6.05, q.z + n[2] * 0.9], 0.025, 0.025, [0, 1, 0], 0);
  const c = [tip[0] + n[0] * 0.2, tip[1] - 0.06, tip[2] + n[2] * 0.2], side = [n[2], 0, -n[0]];
  const P8 = (sx, sy, sz) => [c[0] + side[0] * sx * 0.12 + n[0] * sz * 0.24, c[1] + sy * 0.07, c[2] + side[2] * sx * 0.12 + n[2] * sz * 0.24];
  const qv = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(v => P8(v[0], v[1], v[2]));
  K.face(bags.metal, [qv[3], qv[7], qv[6], qv[2]], [0, 1, 0]);
  K.face(bags.metal, [qv[0], qv[4], qv[7], qv[3]], [-side[0], 0, -side[2]]);
  K.face(bags.metal, [qv[1], qv[2], qv[6], qv[5]], side);
  K.face(bags.metal, [qv[0], qv[3], qv[2], qv[1]], [-n[0], 0, -n[2]]);
  K.face(bags.metal, [qv[4], qv[5], qv[6], qv[7]], n);
  bags.glass.setGlow(1);
  K.face(bags.glass, [qv[0], qv[1], qv[5], qv[4]], [0, -1, 0]);
  bags.glass.setGlow(0);
  q.light = { kind: 'street', x: c[0], y: c[1] - 0.07, z: c[2], nx: 0, nz: 0, col: [1.0, 0.92, 0.74], k: 6.0, range: 30 };
  return q.light;
}

// THE TOTEM PARK (G352, the user: "do the totem patch ... set it somewhere a
// little recluse in the mountains, yet have it fenced and linked with a
// path"): up the mountain behind the village, off the road at `parkT` of
// its length (or the first of a few spots clear of the mine's spur, the
// mill's ground and the tram's base), inland until the hill has risen
// `parkRise` over the road; a plot of the sower's shape is written there
// facing the road, the totem session's `totemPlot` stands the park on it
// (G341.1: the lawn's level is the median terrain under the footprint, the
// world owns the height), the terrain is flattened to that level over the
// patch (withShelf, a fill in front and a cut behind), a footpath wanders
// from the road's verge up to the frontage's middle, a rail fence rings
// the plot with a gate where the path comes in, and a log cabin stands in
// the park's clan-house slot with its front to the lawn. The trees keep
// off the lawn and the path (planTrees); the sower keeps the path's strip
// of the land side free (makePlots). Returns { T: the flattened terrain,
// park: { t, d, plot, poly, level, plan (world), path, fences, house } }
function placePark(T, V, road, rnd, site) {
  const G = TG();
  if (!V.park || !G || !G.totemPlot) return null;
  const L = road.length, half = T.size / 2, w = V.parkW, depth = V.parkD;
  // a candidate spot: off the road at t, inland until the hill is `parkRise`
  // over the road or the plot would leave the tile; its plot in the world
  const spot = t => {
    const a = road.at(t), up = [-a.n[0], -a.n[1]], yRoad = T.h(a.p[0], a.p[1]), tg = [a.tg[0], a.tg[1]];
    const inside = dd => [[-w / 2, dd], [w / 2, dd], [w / 2, dd + depth], [-w / 2, dd + depth]].every(q => { const x = a.p[0] + tg[0] * q[0] + up[0] * q[1], z = a.p[1] + tg[1] * q[0] + up[1] * q[1]; return Math.abs(x) < half - 6 && Math.abs(z) < half - 6; });
    let d = 40;
    while (d < 150 && inside(d + 2) && T.h(a.p[0] + up[0] * d, a.p[1] + up[1] * d) < yRoad + V.parkRise) d += 2;
    while (d > 30 && !inside(d)) d -= 2;
    const front = [a.p[0] + up[0] * d, a.p[1] + up[1] * d];
    const f0 = [front[0] - tg[0] * w / 2, front[1] - tg[1] * w / 2], f1 = [front[0] + tg[0] * w / 2, front[1] + tg[1] * w / 2];
    const poly = [f0, f1, [f1[0] + up[0] * depth, f1[1] + up[1] * depth], [f0[0] + up[0] * depth, f0[1] + up[1] * depth]];
    return { t, a, up, tg, d, yRoad, front, f0, f1, poly, rise: T.h(front[0], front[1]) - yRoad };
  };
  // clear of the works: the mine's ground is a strip up the mountain from
  // the spur's anchor (the site's frame: x along the foot, z inland), the
  // tram's line a corridor from its base to its top; every corner of the
  // plot must be off both, and the spot off the spur's junction
  const clear = S => {
    if (!site) return true;
    if (Math.abs(S.t - site.jt) < 60) return false;
    const sa = site.at, sup = [-sa.n[0], -sa.n[1]], stg = sa.tg;
    for (const q of S.poly) {
      const dx = q[0] - sa.p[0], dz = q[1] - sa.p[1], lx = dx * stg[0] + dz * stg[1], lz = dx * sup[0] + dz * sup[1];
      if (Math.abs(lx) < 55 && lz > -25 && lz < 160) return false;
    }
    if (site.tram) {
      const b = road.at(site.tram.t), bup = [-b.n[0], -b.n[1]], p0 = [b.p[0] + bup[0] * site.tram.back, b.p[1] + bup[1] * site.tram.back], p1 = [b.p[0] + bup[0] * site.tram.topZ, b.p[1] + bup[1] * site.tram.topZ];
      const dSeg = (x, z) => { const ex = p1[0] - p0[0], ez = p1[1] - p0[1], u = clamp(((x - p0[0]) * ex + (z - p0[1]) * ez) / Math.max(1e-9, ex * ex + ez * ez), 0, 1); return Math.hypot(x - (p0[0] + ex * u), z - (p0[1] + ez * u)); };
      for (const q of S.poly) if (dSeg(q[0], q[1]) < 30) return false;
      if (Math.abs(S.t - site.tram.t) < 45) return false;
    }
    return true;
  };
  // the spot: the first candidate that is clear and climbs the full rise;
  // failing that (a bay puts the road deep in the tile) the clear one that climbs most
  const cands = [V.parkT, 0.15, 0.5, 0.7, 0.85, 0.35].map(f => spot(L * f)).filter(clear);
  let S = cands.find(c => c.rise >= V.parkRise - 0.5) || cands.slice().sort((p, q) => q.rise - p.rise)[0] || spot(L * V.parkT);
  const { t, a, up, tg, d, front, f0, f1, poly } = S;
  const plot = { id: 'park', side: 'land', s0: t - w / 2, s1: t + w / 2, poly, depth, n: up, front, tg, w };
  const plan0 = G.totemPlot(plot, T, { seed: V.seed, house: true });
  const level = plan0.level, patch = plan0.local.patch;
  const T2 = withShelf(T, plan0.centre, plan0.yaw, { x0: patch.x0 - 1, x1: patch.x1 + 1, z0: patch.z0 - 1, z1: patch.z1 + 1 }, level, 7, 9);
  const plan = G.totemPlot(plot, T2, { seed: V.seed, house: true, level });
  // THE PATH: from the road's verge to the frontage's middle, swaying a little, on the ground as it finds it
  const p0 = [a.p[0] + up[0] * (road.w / 2 + 0.6), a.p[1] + up[1] * (road.w / 2 + 0.6)];
  const sway = (rnd() < 0.5 ? -1 : 1) * (3 + rnd() * 3);
  const pts = [];
  for (let i = 0; i <= 10; i++) { const u = i / 10, sw = Math.sin(u * Math.PI) * sway; pts.push([p0[0] + (front[0] - p0[0]) * u + tg[0] * sw, p0[1] + (front[1] - p0[1]) * u + tg[1] * sw]); }
  // THE FENCE: the plot's four edges, rails, a gate in the frontage where the path comes in
  const fences = [
    { a: f0, b: f1, kind: 'front', style: 'rail', gap: [w / 2 - 1.2, w / 2 + 1.2] },
    { a: f1, b: poly[2], kind: 'side', style: 'rail', gap: null },
    { a: poly[2], b: poly[3], kind: 'back', style: 'rail', gap: null },
    { a: poly[3], b: f0, kind: 'side', style: 'rail', gap: null },
  ];
  // THE CLAN HOUSE in the park's slot: a log cabin, its front (+z) to the lawn
  let house = null;
  if (plan.house) {
    const hs = plan.house, yaw = hs.ry, cy = Math.cos(yaw), sy = Math.sin(yaw);
    const toWorld = (lx, lz) => [hs.x + lx * cy + lz * sy, hs.z - lx * sy + lz * cy];
    const oy = T2.h(hs.x, hs.z);
    const ground = (lx, lz) => { const q = toWorld(lx, lz); return T2.h(q[0], q[1]) - oy; };
    const P = Object.assign({}, HG.DEF, HG.PRESETS['log cabin'] || {}, { L: Math.min(hs.w - 1, 10), w: Math.min(hs.d - 1, 7.5) });
    P.preset = 'log cabin'; P.slopeX = 0; P.slopeZ = 0; P.water = 0; P.pier = 0; P.yard = 0; P.ground = ground; P.waterY = T.waterY - oy;
    let hiC = -1e9;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) hiC = Math.max(hiC, ground(sx * P.L / 2, sz * P.w / 2));
    P.floorY = hiC + (P.stance === 0 ? 0.3 : 0.55);
    house = { P, x: hs.x, z: hs.z, y: oy, yaw, toWorld, ground, seed: 700 + V.seed, gen: 'house', park: true };
  }
  return { T: T2, park: { t, d, rise: level - S.yRoad, plot, poly, level, plan, path: { pts, width: 1.4 }, fences, house, centre: plan.centre, yaw: plan.yaw } };
}

// which plots get the town hall and the church (the gate mirrors this)
function civicPlots(plots, road) {
  const mid = road.length / 2;
  const near = plots.filter(p => p.side === 'land').sort((a, b) => Math.abs((a.s0 + a.s1) / 2 - mid) - Math.abs((b.s0 + b.s1) / 2 - mid));
  if (near.length < 2) return {};
  const hall = near.slice(0, 3).sort((a, b) => b.w - a.w)[0];
  const church = near.find(p => p.id !== hall.id && Math.abs(p.id - hall.id) >= 2);
  return { hall: hall.id, church: church ? church.id : undefined };
}

// ---------------------------------------------------------------------------
// THE THEMES (G321, the user: "do the whole mining village. Also think of a
// way of packaging these things so we can get them easily in game later
// on, maybe by invoking presets, or 'themes'").
// ---------------------------------------------------------------------------
// A THEME is a plan in its own frame: the anchor is a point on the road,
// x runs along the road, z runs inland (up the hill), and every item names
// a generator, a preset, where it stands and which way it faces - so the
// game invokes one by name (`V.site = 'kennecott'`) and gets the hill, the
// buildings and the keep-out for its woodland from one record. `placeSite`
// turns the items into house records (the village's own shape: P, x, z,
// yaw, toWorld, ground) on the real terrain, each with the terrain under
// it as its ground.
//   spur    { in, before, after }  the mine's road: inland this far, then along the foot,
//                            `before` metres back from the anchor and `after` past it
//   foot    the mountain's foot pinned this far behind the anchor at the site (the works flat, the mill climbing)
//   items   { gen: 'big'|'house', preset, x, z, yaw (0 = facing the road), P: overrides }
//   yard    { x0, x1, z0, z1 }  the gravel yard in the site's frame
const THEMES = {
  kennecott: {
    name: 'Kennecott - the mine',
    spur: { in: 68, before: 60, after: 46 },
    foot: 14,                            // the mountain's foot this far behind the anchor (the row and the yard on the flat, the mill on the rise)
    items: [
      // the mill stands so its own receiving house straddles the road
      // (the gap below the lowest tier is set from `z` in placeSite)
      { gen: 'house', preset: 'kennecott mill', x: -4, z: 24, yaw: 0, bottomOnRoad: true },
      { gen: 'big', preset: 'mine shop', x: -34, z: 12, yaw: 0 },
      { gen: 'house', preset: 'mine office', x: 22, z: 9, yaw: -0.08 },
      { gen: 'house', preset: 'mine cottage', x: -22, z: 5, yaw: 0.2 },
      { gen: 'house', preset: 'storage shed', x: 8, z: 7, yaw: 0.4 },
      // THE ROW ACROSS THE ROAD (G334, G340 - the user: "vary the size and
      // style of the 3 large houses at the bottom, the largest one being the
      // one in line with the conveyor"): the dormer hall in line with the
      // mill, the bunkhouse one side, the mess hall the other, a cottage
      // at the end - each facing back to the road (yaw pi)
      { gen: 'house', preset: 'mine bunkhouse', x: -32, z: -10, yaw: Math.PI + 0.06 },
      { gen: 'house', preset: 'mine dormer hall', x: -4, z: -11, yaw: Math.PI },
      { gen: 'house', preset: 'mine mess hall', x: 24, z: -10, yaw: Math.PI - 0.08 },
      { gen: 'house', preset: 'mine cottage', x: 40, z: -9, yaw: Math.PI + 0.1 },
    ],
    // THE GRAVEL YARD (G334): the ground the whole works stands on, in the
    // site's frame - along the spur, from the far side of the row to the
    // terminal up the mountain
    yard: { x0: -48, x1: 48, z0: -18, z1: 150 },
    // THE TRAM (G348): the base station off the shore road at `t` of its
    // length, `back` metres behind it with its open end to the mountain;
    // the top station straight inland `topZ` behind the road, up the
    // mountain, its dock to the valley; the line between their hooks
    tram: { t: 0.3, back: 24, topZ: 150 },
  },
  // THE SPORTS GROUND (G393.3, the user: "the sports series is good, but do
  // the surroundings with more detail. The ground cover, the small
  // buildings. Let's have these be a site rather than just an asset.
  // Including fences ... generated with the same fence method as the
  // village generator"): the ball park in the site's frame with the road
  // side +z, the clubhouse and the concession stand behind the backstop
  // facing the field, the tool shed in the corner, a gravel car park
  // toward the road, and the village's rail fence round the whole ground
  // with its gap at the car park's entrance. `fences` are segments in the
  // site's frame ({ a, b, gap: [u0, u1] along the segment }), drawn by the
  // premises through the same buildFence the lots use.
  // THE THREE AIRPORTS (G405, the user: "a series 'field' - a couple of small
  // hangars; a series club, with larger hangar, but still an unpaved club
  // feeling, with a club house, larger hangars, fuel facilities and fenced
  // area; then a paved airport, still very regional, but with an actual
  // terminal and technical services and hangars"). Each is a SITE in the
  // frame of its apron: +z the strip side (the hangar doors face it), the
  // buildings in a row behind their apron, the yard the apron itself
  // (gravel for the field and the club, paved for the regional), the
  // village's fence round the club and the airport with the gate at the
  // road. The strip is the editor's own (a runway feature); the site stands
  // beside it.
  'airport xs': {
    name: 'the field strip',
    items: [
      { gen: 'hangar', preset: 'field shed', x: -12, z: 0, yaw: Math.PI },
      { gen: 'hangar', preset: 'field shed, small', x: 10, z: 2, yaw: Math.PI + 0.06 },
      { gen: 'house', preset: 'pilot hut', x: 26, z: -4, yaw: Math.PI + 0.2 },
      { gen: 'shed', preset: 'tool shed', x: -28, z: -6, yaw: -0.3 },
    ],
    yard: { x0: -26, x1: 24, z0: 10, z1: 34 },
    yardKind: 'gravel',
  },
  'airport s': {
    name: 'the flying club',
    items: [
      { gen: 'hangar', preset: 'club hangar', x: -22, z: 0, yaw: Math.PI },
      { gen: 'hangar', preset: 'club hangar, long', x: 18, z: -3, yaw: Math.PI },
      { gen: 'house', preset: 'flying club', x: 48, z: 6, yaw: Math.PI },
      { gen: 'big', preset: 'fuel shed', x: -52, z: 8, yaw: Math.PI },
      { gen: 'shed', preset: 'tool shed', x: 40, z: -14, yaw: 0.4 },
    ],
    yard: { x0: -60, x1: 40, z0: 14, z1: 54 },
    yardKind: 'gravel',
    fences: [
      { a: [-72, -32], b: [72, -32], gap: [60, 84] }, { a: [72, -32], b: [72, 62] },
      { a: [72, 62], b: [-72, 62] },
      { a: [-72, 62], b: [-72, -32] },
    ],
  },
  'airport m': {
    name: 'the regional airport',
    items: [
      { gen: 'hangar', preset: 'works hangar', x: -50, z: 0, yaw: Math.PI },
      { gen: 'hangar', preset: 'club hangar', x: -6, z: 4, yaw: Math.PI },
      { gen: 'big', preset: 'terminal', x: 40, z: 10, yaw: Math.PI },
      { gen: 'house', preset: 'control tower', x: 66, z: -2, yaw: Math.PI },
      { gen: 'house', preset: 'flight service', x: 22, z: -10, yaw: 0 },
      { gen: 'big', preset: 'technical services', x: 72, z: -26, yaw: Math.PI * 0.5 },
      { gen: 'big', preset: 'fuel shed', x: -84, z: 10, yaw: Math.PI },
    ],
    yard: { x0: -92, x1: 92, z0: 22, z1: 70 },
    yardKind: 'paved',
    fences: [
      { a: [-104, -44], b: [104, -44], gap: [90, 118] }, { a: [104, -44], b: [104, 78] },
      { a: [104, 78], b: [-104, 78] },
      { a: [-104, 78], b: [-104, -44] },
    ],
  },
  'sports ground': {
    name: 'the sports ground',
    items: [
      { gen: 'sport', preset: 'ball park, lit', x: 0, z: -6, yaw: 0 },
      { gen: 'house', preset: 'clubhouse', x: 28, z: 46, yaw: Math.PI },
      { gen: 'house', preset: 'concession stand', x: -22, z: 44, yaw: Math.PI },
      { gen: 'shed', preset: 'tool shed', x: 52, z: 40, yaw: Math.PI * 0.5 },
    ],
    yard: { x0: -26, x1: 26, z0: 52, z1: 78 },          // the car park (gravel)
    fences: [
      { a: [-64, -52], b: [64, -52] }, { a: [64, -52], b: [64, 82] },
      { a: [64, 82], b: [-64, 82], gap: [56, 72] },      // the entrance, 16 m wide, opposite the car park
      { a: [-64, 82], b: [-64, -52] },
    ],
  },
};

// the base terrain with a hill folded in: a smooth bump, zero at r
function withHill(T, c, h, r) {
  const base = T.h;
  const hh = (x, z) => {
    const d = Math.hypot(x - c[0], z - c[1]) / r;
    if (d >= 1) return base(x, z);
    const k = 1 - d * d;                        // 1 at the centre, 0 at r, flat both ends
    return base(x, z) + h * k * k;
  };
  return { h: hh, size: T.size, waterY: T.waterY };
}

// THE SHOULDER (G350, the user: "the central structure sits atop the
// mountain, not on a slope anymore"): a flat pad at `level` over `rect` in
// the frame (c, yaw) - cut into the mountain where it is higher, filled
// where it is lower - blended back to the terrain over `marginF` metres in
// front and beside (the fill) and `marginB` behind (the cut face, up the hill)
function withShelf(T, c, yaw, rect, level, marginF, marginB) {
  const base = T.h, cy = Math.cos(yaw), sy = Math.sin(yaw);
  const hh = (x, z) => {
    const dx = x - c[0], dz = z - c[1];
    const lx = dx * cy - dz * sy, lz = dx * sy + dz * cy;   // the world into the frame (the inverse of the site's toWorld)
    const k = Math.max(Math.max(0, rect.z0 - lz) / marginB, Math.max(0, rect.x0 - lx, lx - rect.x1, lz - rect.z1) / marginF);
    if (k >= 1) return base(x, z);
    const s = k * k * (3 - 2 * k);
    return level + (base(x, z) - level) * s;
  };
  return { h: hh, size: T.size, waterY: T.waterY, zShore: T.zShore };
}

function placeSite(vil) {
  const S = vil.site, th = S.theme, T = vil.T, road = S.road || vil.road;
  const out = [], keepOut = [];
  for (const it of th.items) {
    // THE ROAD'S OWN FRAME: x is arclength along the road from the anchor,
    // z is inland along the road's normal THERE - so a bend in the road
    // bends the site with it and a shed on the road is on the road
    const a = road.at(S.t + it.x);
    const up = [-a.n[0], -a.n[1]];
    const c = [a.p[0] + up[0] * it.z, a.p[1] + up[1] * it.z];
    // facing the road: local +z toward -up; the item's yaw turns from there
    const yaw = Math.atan2(-up[0], -up[1]) + (it.yaw || 0);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const toWorld = (lx, lz) => [c[0] + lx * cy + lz * sy, c[1] - lx * sy + lz * cy];
    const oy = T.h(c[0], c[1]);
    const ground = (lx, lz) => { const w = toWorld(lx, lz); return T.h(w[0], w[1]) - oy; };
    let P;
    if (it.gen === 'big') {
      const B = BG();
      P = Object.assign({}, B.DEF, B.PRESETS[it.preset] || {}, it.P || {});
      P.preset = it.preset; P.big = 1; P.slopeX = 0; P.slopeZ = 0;
      P.ground = ground;
      if (!P.mill) {
        let hiC = -1e9;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) hiC = Math.max(hiC, ground(sx * P.L / 2, sz * P.w / 2));
        // a shed the road runs through sits on the road: no plinth, its slab a hand over the ground
        P.floorY = hiC + (it.onRoad ? 0.06 : Math.max(0.3, P.floorY));
        if (it.onRoad) P.plinth = 0;
      } else P.floorY = ground(0, 0) + 0.6;
    } else {
      P = Object.assign({}, HG.DEF, HG.PRESETS[it.preset] || {}, it.P || {});
      P.preset = it.preset; P.slopeX = 0; P.slopeZ = 0; P.water = 0; P.pier = 0;
      P.ground = ground; P.waterY = T.waterY - oy;
      if (P.mill) {
        // THE RECEIVING HOUSE ON THE ROAD (G333): the mill's own bottom house
        // sits astride the road - the road is `z` below the mill's origin
        // (G350: `recvZ`); the top house stands on the shoulder the terrain
        // was cut to from the same plan
        if (it.bottomOnRoad) { P.recvZ = it.z; P.bottomL = 16; }
        P.floorY = ground(0, HG.millPlan(P).zLevel) + 0.5;
      }
      else {
        let hiC = -1e9;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) hiC = Math.max(hiC, ground(sx * P.L / 2, sz * P.w / 2));
        P.floorY = hiC + (P.stance === 0 ? 0.3 : 0.55);
      }
      P.spread = vil.spread;
    }
    P.site = S.name;
    const rec = { P, x: c[0], z: c[1], y: oy, yaw, toWorld, ground, seed: 500 + out.length, gen: it.gen, site: true, item: it };
    out.push(rec);
    // the keep-out for the trees: the footprint and a margin, in the world
    const Mp = P.mill ? HG.millPlan(P) : null;
    const kx0 = Mp ? Mp.x0 - 3 : -P.L / 2 - 3, kx1 = Mp ? Mp.x1 + 3 : P.L / 2 + 3;
    const kz0 = Mp ? Mp.termZ - 8 : -P.w / 2 - 3, kz1 = Mp ? Mp.R + 8 : P.w / 2 + 3;
    keepOut.push([[kx0, kz1], [kx1, kz1], [kx1, kz0], [kx0, kz0]].map(q => toWorld(q[0], q[1])));
  }
  // THE TRAMWAY'S FAR END (G329): the mill's conveyor runs to the shed the
  // road goes through - that shed's position in the mill's own frame
  const mill = out.find(h => h.P.mill), shed = out.find(h => h.item.onRoad);
  if (mill && shed) {
    const c = Math.cos(mill.yaw), sn = Math.sin(mill.yaw);
    const dx = shed.x - mill.x, dz = shed.z - mill.z;
    // world = c + R(yaw) local, with local x -> [c, -s], local z -> [s, c]
    mill.P.tramTo = [dx * c - dz * sn, shed.y + shed.P.floorY + (shed.P.eaveH || 5) - mill.y, dx * sn + dz * c];
  }
  // THE TRAM'S STATIONS (G348): two more site houses in the SHORE ROAD's
  // frame (not the spur's) - the base station behind the road with its open
  // end toward the mountain (yaw pi: its +z away from the road), the top
  // station up the mountain with its dock toward the valley (yaw 0)
  if (S.tram) {
    const tr = S.tram;
    const items = [
      { preset: 'tram base station', x: 0, z: tr.back, yaw: Math.PI, keep: [36, 64, 17] },   // the wood kept off the line's first climb
      { preset: 'tram top station', x: 0, z: tr.topZ, yaw: 0, keep: [18, 72, -16] },
    ];
    for (const it of items) {
      const a = vil.road.at(tr.t + it.x);
      const up = [-a.n[0], -a.n[1]];
      const c = [a.p[0] + up[0] * it.z, a.p[1] + up[1] * it.z];
      const yaw = Math.atan2(-up[0], -up[1]) + it.yaw;
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const toWorld = (lx, lz) => [c[0] + lx * cy + lz * sy, c[1] - lx * sy + lz * cy];
      const oy = T.h(c[0], c[1]);
      const ground = (lx, lz) => { const w = toWorld(lx, lz); return T.h(w[0], w[1]) - oy; };
      const P = Object.assign({}, HG.DEF, HG.PRESETS[it.preset] || {});
      P.preset = it.preset; P.slopeX = 0; P.slopeZ = 0; P.water = 0; P.pier = 0;
      P.ground = ground; P.waterY = T.waterY - oy; P.spread = vil.spread; P.site = S.name;
      if (Math.round(P.station) === 2) {
        // the barn's slab on its highest corner
        let hiC = -1e9;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) hiC = Math.max(hiC, ground(sx * P.barnW / 2, sz * P.barnL / 2));
        P.floorY = hiC + 0.3;
      }
      const rec = { P, x: c[0], z: c[1], y: oy, yaw, toWorld, ground, seed: 700 + out.length, gen: 'house', site: true, tram: true, item: Object.assign({ gen: 'house' }, it) };
      out.push(rec);
      const [kw, kd, kz] = it.keep;
      keepOut.push([[-kw / 2, kz + kd / 2], [kw / 2, kz + kd / 2], [kw / 2, kz - kd / 2], [-kw / 2, kz - kd / 2]].map(q => toWorld(q[0], q[1])));
    }
  }
  vil.siteHouses = out;
  vil.siteKeepOut = keepOut;
  if (th.yard) {
    const corner = (x, z) => { const a = road.at(S.t + x); return [a.p[0] - a.n[0] * z, a.p[1] - a.n[1] * z]; };
    S.yardPoly = [corner(th.yard.x0, th.yard.z0), corner(th.yard.x1, th.yard.z0), corner(th.yard.x1, th.yard.z1), corner(th.yard.x0, th.yard.z1)];
  }
  return out;
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
  if (house.P.civic || house.P.big) return null;   // no wreck on the town hall's lawn
  const garage = !isBoat && plot.out && plot.out.kind === 'garage';
  if (!garage && rnd() > (isBoat ? vil.V.boatOdds : vil.V.carOdds)) return null;   // a garage always has its car
  const T = vil.T;
  // THE GARAGE'S CAR IS AN EVERYDAY ONE (G432, the user: "real everyday cars
  // to be integrated in the garages, the front yards"): the wrecks stay in
  // the backyard (the abandoned cars + the pack's rusty saloon, kind `old`)
  const keys = garage ? autoMenu('garage') : HG.CAR_KEYS.concat(HG.AUTO_KEYS ? HG.AUTO_KEYS(['old']) : []);
  let key = isBoat ? 'boat_tirola' : (vil.spread ? vil.spread.pick(keys.filter(k => k !== 'car_buick'), rnd)
                                                : keys[Math.floor(rnd() * keys.length) % keys.length]);
  if (!isBoat && !garage && rnd() < 0.12 && !(vil.spread && vil.spread.used.car_buick)) key = 'car_buick';   // the big one, once
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
  if (P.civic || P.big) return null;        // no shed behind the church, nor the cannery
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
  let t = 10 + rnd() * 10, i = 0;
  while (t < road.length - 8) {
    const a = road.at(t);
    // half a metre off the road's edge, as a roadside pole stands; a
    // frontage on a bend is a chord that can come in further than that, so
    // a spot inside a plot is skipped
    const off = road.w / 2 + 0.5;
    const x = a.p[0] - a.n[0] * off, z = a.p[1] - a.n[1] * off;   // -n: inland
    if (!(plots || []).some(p => inPoly(p.poly, x, z)))
      out.push({ key: spread ? spread.pick(HG.POLE_KEYS, rnd) : 'pole_b', x, z, y: T.h(x, z),
                 ry: Math.atan2(a.tg[0], a.tg[1]) + (rnd() - 0.5) * 0.2, t,
                 n: [a.n[0], a.n[1]], lamp: (i++ % 2) === 0 });      // (G370: every second pole carries a street lamp; `n` is toward the road)
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
  // THE PATCH'S EDGE WAS A RAZOR (2026-09-23, the user over Metlakatla: "You have
  // also large fully square patches, and I wish they would be less square"). The
  // fade was 1.8 m on a 25 x 30 m plot, which at any distance is no fade at all -
  // every garden read as a bright rectangle stamped on the ground. 5 m of margin,
  // and the ramp is BROKEN by the same fbm the splat uses, so the line where a lawn
  // becomes the island wanders a metre or two instead of running dead straight.
  const T = vil.T, cell = 0.45, M = 5.0;
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
  // a big building's yard is dry to the road: the apron a truck backs across (G312)
  rects.push({ x: house.x, z: house.z, yaw: house.yaw, hx: P.L / 2 + (P.big ? 3 : 0), hz0: -P.w / 2 - (P.big ? 2 : 0),
               hz1: P.w / 2 + (P.porch ? P.porchD : 0) + (P.big ? (P.dock ? P.dockD : 0) + 9 : 0) });
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
  // THE DRIVE (G401): a wider band of dirt to the pad, the pad itself, and the gravel of a works' yard
  const drive = (plot.drive && plot.drive.segs) || [];
  const halfDrive = plot.drive ? plot.drive.width / 2 : 0;
  const distTo = (sgs, x, z) => { let d = 1e9; for (const sg of sgs) { const dx = sg[1][0] - sg[0][0], dz = sg[1][1] - sg[0][1]; const t = clamp(((x - sg[0][0]) * dx + (z - sg[0][1]) * dz) / Math.max(1e-9, dx * dx + dz * dz), 0, 1); d = Math.min(d, Math.hypot(x - (sg[0][0] + dx * t), z - (sg[0][1] + dz * t))); } return d; };
  const padAt = (x, z) => { const pd = plot.drive && plot.drive.pad; if (!pd) return 0; const dx = x - pd.c[0], dz = z - pd.c[1]; const u = Math.abs(dx * pd.tg[0] + dz * pd.tg[1]) - pd.w / 2, v = Math.abs(dx * pd.n[0] + dz * pd.n[1]) - pd.d / 2; return 1 - clamp(Math.hypot(Math.max(0, u), Math.max(0, v)) / 0.5, 0, 1); };
  const inLot = (x, z) => plot.lot && plot.lot.poly ? (inPoly(plot.lot.poly, x, z) ? 1 : 0) : 0;
  const dirtAt = (x, z) => {
    const d = distTo(segs, x, z);
    const path = 1 - clamp((d - 0.35) / 0.55, 0, 1);
    const dr = drive.length ? 1 - clamp((distTo(drive, x, z) - halfDrive) / 0.6, 0, 1) : 0;
    return Math.max(path, dr, padAt(x, z));
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
  // THE DARKENING (G302): the same profile the skirt polygons draw - full
  // under the thing, (1 - t)^2 out to `soft` - the occluders COMPOUNDING (a
  // post under a house is darker than either) and capped so the ground
  // never goes black; the fence lines darken a band of their own
  const darkAt = (x, z) => {
    let keep = 1;
    for (const o of occ) {
      const c = Math.cos(o.ry || 0), s = Math.sin(o.ry || 0);
      const dx = x - o.x, dz = z - o.z, lx = dx * c - dz * s, lz = dx * s + dz * c;
      let out;
      if (o.hx !== undefined) out = Math.hypot(Math.max(0, Math.abs(lx) - o.hx), Math.max(0, Math.abs(lz) - o.hz));
      else out = Math.max(0, Math.hypot(lx, lz) - o.r);
      const soft = o.soft === undefined ? 0.5 : o.soft;
      const t = 1 - clamp(out / Math.max(0.05, soft), 0, 1);
      keep *= 1 - (o.k === undefined ? 0.4 : o.k) * t * t;
    }
    let d = 1e9;
    for (const sg of fenced) {
      const dx = sg[1][0] - sg[0][0], dz = sg[1][1] - sg[0][1];
      const t = clamp(((x - sg[0][0]) * dx + (z - sg[0][1]) * dz) / Math.max(1e-9, dx * dx + dz * dz), 0, 1);
      d = Math.min(d, Math.hypot(x - (sg[0][0] + dx * t), z - (sg[0][1] + dz * t)));
    }
    const ft = 1 - clamp((d - 0.12) / 0.7, 0, 1);
    keep *= 1 - 0.4 * ft * ft;
    return Math.min(0.85, 1 - keep);
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
    let peb = 1 - clamp((y - T.waterY - 0.35) / 0.85, 0, 1);
    if (plot.lot && plot.lot.kind === 'gravel') peb = Math.max(peb, inLot(x, z) ? 1 : 0);          // the works' yard (G401)
    const dry = plot.lot && plot.lot.kind === 'concrete' ? Math.max(dryAt(x, z), inLot(x, z)) : dryAt(x, z);   // dead ground under a slab
    splat.push(fbm(x * 0.09 + 11.3, z * 0.09 + 4.1, vil.V.seed + 21, 3), dry, dirtAt(x, z), peb);
    tone.push(darkAt(x, z), lushAt(x, z));
    {
      // the wander: the noise moves the edge, not the alpha, so the fade stays smooth
      const w = (fbm(x * 0.22 + 5.7, z * 0.22 + 2.9, vil.V.seed + 37, 2) - 0.5) * 2.2;
      const t = clamp((d + w) / M, 0, 1);
      alpha.push(inside ? 1 : 1 - t * t * (3 - 2 * t));
    }
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
// ---------------------------------------------------------------------------
// THE LOT LAWS (G401, the user: "who is doing ground cover and drawing the
// lots? ... did we implement the parking garages in front of houses, and the
// ground textures of all lots?"). ONE dressing per CATEGORY, here, so a
// zoned plot and a hand-placed site dress the same way:
//   residential  the fence, the gate, the garden path, the outbuilding, and
//                now THE FRONT LOT: a driveway from the road to a parking
//                pad by the house's front corner (or on to the garage's
//                door), a car on the pad
//   commercial   no picket fence (rails at the sides), a straight walk, a
//                CAR PARK slab of weathered concrete in front with its bays
//                and a car or two in them, bins by the side wall
//   official     the lawn, a low picket fence with its gate, a paved
//                forecourt at the door, nothing parked, no junk
//   industrial   a gravel yard to the road, a rail fence with a wide gate,
//                nothing else (the big building brings its own props)
//   sports       the theme's (nothing here)
// `plot.cat` is read off the house (its preset's category) or the zone.
// THE EVERYDAY VEHICLES BY PLACE (G432): the drive pad and the garage take
// what a household drives (a pickup or an SUV as often as a car - rural), the
// car park what shops draw, the works yard what works there. YARD_KIT's
// `auto` word (HOUSE_GEN.AUTO_KEYS) is the menu; the wrecks (DRIVE_CARS, the
// least wrecked of the abandoned cars) stand in only when the pack is absent.
const DRIVE_CARS = ['car_kcar', 'car_fiat', 'car_hudson', 'car_multicab'];
const AUTO_MENUS = {
  drive:      ['car', 'car', 'pickup', 'pickup', 'suv', 'van'],
  garage:     ['car', 'pickup', 'suv'],
  carpark:    ['car', 'car', 'car', 'pickup', 'suv', 'van'],
  industrial: ['truck', 'truck', 'van', 'pickup'],
};
function autoMenu(place) {
  const AK = HG.AUTO_KEYS;
  if (!AK || !AK().length) return DRIVE_CARS;
  const out = [];
  for (const kind of AUTO_MENUS[place] || AUTO_MENUS.drive) for (const k of AK([kind])) out.push(k);
  return out.length ? out : DRIVE_CARS;
}
const pickAuto = (vil, rnd, place) => { const menu = autoMenu(place); return vil.spread ? vil.spread.pick(menu, rnd) : menu[Math.floor(rnd() * menu.length)]; };
function lotCat(plot, house) {
  const P = house.P || {};
  if (house.cat) return house.cat;
  if (P.cat) return P.cat;
  if (house.gen === 'SPORT_GEN' || P.kind !== undefined && P.baseLen !== undefined) return 'sports';
  // the preset's own word first (HOUSE_GEN.CATS / BIG_GEN.CATS), then what the table implies
  const name = house.preset || P.preset;
  const BG = typeof window !== 'undefined' ? window.BIG_GEN : null;
  const k = name ? ((P.big && BG && BG.catOf ? BG.catOf(name) : null) || (HG.catOf ? HG.catOf(name) : null)) : null;
  if (k) return k;
  if (P.role) return 'official';
  if (P.big) return 'industrial';
  if (P.civic) return 'official';
  return plot.cat || 'residential';
}
// the front line of the house in the plot's frame: how far from the plot's
// frontage edge the house's front (deck included) stands, and the house's
// half-length along the frontage
function frontOf(plot, house) {
  const P = house.P, n = plot.n, tg = plot.tg;
  const f0 = plot.poly[0];
  const d = (house.x - f0[0]) * n[0] + (house.z - f0[1]) * n[1];        // house centre in from the frontage
  const porch = P.porch ? P.porchD : 0;
  const face = d - P.w / 2 - porch;                                       // the front face (or the deck's edge) in from the frontage
  const along = (house.x - f0[0]) * tg[0] + (house.z - f0[1]) * tg[1];   // along the frontage
  return { d, face: Math.max(1.5, face), along, halfL: P.L / 2, porch };
}
// a rectangle in the plot's frame -> world corners (a, b along tg from u0..u1, in from the frontage v0..v1)
function plotRect(plot, u0, u1, v0, v1) {
  const f0 = plot.poly[0], tg = plot.tg, n = plot.n;
  const at = (u, v) => [f0[0] + tg[0] * u + n[0] * v, f0[1] + tg[1] * u + n[1] * v];
  return [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)];
}
// THE FRONT LOT (residential): the drive enters beside the gate, runs in
// along the side of the house and ends on a pad by its front corner - or at
// the garage's door when the plot has one. A car on the pad.
function planDrive(vil, plot, house, built, rnd) {
  if (plot.side !== 'land') return null;
  const F = frontOf(plot, house);
  const w = plot.w;
  if (w < F.halfL * 2 + 7) return null;                                  // no room beside the house
  // the side with the more room, away from the gate
  const roomL = F.along - F.halfL, roomR = w - (F.along + F.halfL);
  const sgn = (house.gateT !== undefined ? (house.gateT < F.along ? 1 : -1) : (roomR > roomL ? 1 : -1));
  const room = sgn > 0 ? roomR : roomL;
  if (room < 4.2) return null;
  // the drive's centre line along the frontage: beside the house, and its ENTRY hugs the gate (one
  // opening in the front fence serves the walk and the drive - planFences widens the gap to it)
  const u = F.along + sgn * (F.halfL + Math.min(2.3, (room - 3.2) / 2 + 1.6));
  const uEntry = house.gateT !== undefined ? house.gateT + sgn * 2.3 : u;
  const entry = [uEntry, 0.2];
  let pts = [], pad = null;
  if (plot.out && plot.out.kind === 'garage') {
    // to the garage door: along the side of the house, then across to the door
    const o = plot.out, door = o.toWorld(0, o.P.w / 2 + 1.6);
    const f0 = plot.poly[0], tg = plot.tg, n = plot.n;
    const du = (door[0] - f0[0]) * tg[0] + (door[1] - f0[1]) * tg[1], dv = (door[0] - f0[0]) * n[0] + (door[1] - f0[1]) * n[1];
    pts = [entry, [u, 3.2], [u, Math.max(F.face - 1, Math.min(dv, F.d + house.P.w / 2 + 2))], [du, dv]];
  } else {
    const vPad = Math.max(2.5, F.face - 0.6);
    pts = [entry, [u, 3.2], [u, vPad + 2.6]];
    pad = { u, v: vPad + 2.6, w: 3.2, d: 5.6 };
  }
  const f0 = plot.poly[0], tg = plot.tg, n = plot.n;
  const W = q => [f0[0] + tg[0] * q[0] + n[0] * q[1], f0[1] + tg[1] * q[0] + n[1] * q[1]];
  const segs = [];
  for (let i = 0; i + 1 < pts.length; i++) segs.push([W(pts[i]), W(pts[i + 1])]);
  let car = null;
  if (pad && rnd() < 0.7) {
    const key = pickAuto(vil, rnd, 'drive');
    const c = W([pad.u, pad.v]);
    car = { key, x: c[0], z: c[1], ry: Math.atan2(n[0], n[1]) + Math.PI + (rnd() - 0.5) * 0.12, y: vil.T.h(c[0], c[1]), pad: true };
  }
  const padW = pad ? { c: W([pad.u, pad.v]), tg: [tg[0], tg[1]], n: [n[0], n[1]], w: pad.w, d: pad.d } : null;
  // the front fence's gap widened over the drive's entry (the gate keeps its leaf)
  const fr = (plot.fences || []).find(f => f.kind === 'front');
  if (fr && fr.gap) fr.gap = [Math.min(fr.gap[0], uEntry - 1.6), Math.max(fr.gap[1], uEntry + 1.6)];
  return { segs, pad: padW, car, width: 2.9 };
}
// THE CAR PARK (commercial) / THE FORECOURT (official) / THE YARD
// (industrial): a rectangle between the house's front and the frontage
function planLot(vil, plot, house, built, rnd, cat) {
  const F = frontOf(plot, house);
  const w = plot.w;
  if (cat === 'industrial') {
    const v1 = Math.min(plot.depth - 1, F.d + house.P.w / 2 + 6);
    // A TRUCK IN THE YARD (G432): one or two of the works' vehicles parked
    // along the yard's side, nose to the road, clear of the building's front
    const cars = [];
    const f0 = plot.poly[0], tg = plot.tg, n = plot.n;
    const W = (u, v) => [f0[0] + tg[0] * u + n[0] * v, f0[1] + tg[1] * u + n[1] * v];
    const nT = v1 - 0.6 > 14 && w > 16 ? 1 + (rnd() < 0.5 ? 1 : 0) : (v1 - 0.6 > 12 && w > 12 ? 1 : 0);
    for (let i = 0; i < nT; i++) {
      const key = pickAuto(vil, rnd, 'industrial'), K = HG.YARD_KIT[key] || { L: 6, W: 2.5 };
      const u = i ? w - 0.8 - K.W / 2 - 0.8 : 0.8 + K.W / 2 + 0.8, v = 0.6 + K.L / 2 + 1.5;
      if (v + K.L / 2 > v1 - 0.5) continue;
      const c = W(u, v);
      cars.push({ key, x: c[0], z: c[1], ry: Math.atan2(n[0], n[1]) + Math.PI + (rnd() - 0.5) * 0.08, y: vil.T.h(c[0], c[1]) });
    }
    return { kind: 'gravel', poly: plotRect(plot, 0.8, w - 0.8, 0.6, v1), bays: [], cars };
  }
  if (cat === 'official') {
    const half = Math.min(w / 2 - 1.5, F.halfL + 1.0);
    const v0 = 0.6, v1 = Math.max(v0 + 3, F.face - 0.2);
    return { kind: 'concrete', poly: plotRect(plot, F.along - half, F.along + half, v0, v1), bays: [], cars: [] };
  }
  // commercial: the slab from the frontage to the front face, the bays along the frontage side, cars in some
  const half = Math.min(w / 2 - 1.0, F.halfL + 4.5);
  const v0 = 0.6, v1 = Math.max(v0 + 5.5, F.face - 0.4);
  const poly = plotRect(plot, F.along - half, F.along + half, v0, v1);
  const bays = [], cars = [];
  const bayW = 2.8, nB = Math.floor((2 * half - 1.0) / bayW);
  const u0 = F.along - half + (2 * half - nB * bayW) / 2;
  const f0 = plot.poly[0], tg = plot.tg, n = plot.n;
  const W = (u, v) => [f0[0] + tg[0] * u + n[0] * v, f0[1] + tg[1] * u + n[1] * v];
  for (let i = 0; i <= nB; i++) bays.push([W(u0 + i * bayW, v0 + 0.3), W(u0 + i * bayW, v0 + 5.3)]);   // the bay lines, 5 m deep from the road side
  for (let i = 0; i < nB; i++) if (rnd() < 0.35) {
    const key = pickAuto(vil, rnd, 'carpark');
    const c = W(u0 + (i + 0.5) * bayW, v0 + 2.9);
    cars.push({ key, x: c[0], z: c[1], ry: Math.atan2(n[0], n[1]) + Math.PI + (rnd() - 0.5) * 0.1, y: vil.T.h(c[0], c[1]) });
  }
  return { kind: 'concrete', poly, bays, cars };
}
// the fences by category: a picket front with a gate for the houses and
// the institutions, rails at the sides of a shop (its front open to the
// car park), rails all round a works with a wide gate, nothing on a field
function planFencesFor(V, plot, house, rnd, fenced, cat) {
  if (cat === 'residential') return planFences(V, plot, house, rnd, fenced);
  if (cat === 'sports') return [];
  const out = [];
  const edges = [{ a: plot.poly[1], b: plot.poly[2], kind: 'side' }, { a: plot.poly[3], b: plot.poly[0], kind: 'side' }];
  if (cat !== 'commercial') edges.push({ a: plot.poly[0], b: plot.poly[1], kind: 'front' });
  if (plot.side === 'land' && cat !== 'commercial') edges.push({ a: plot.poly[2], b: plot.poly[3], kind: 'back' });
  for (const e of edges) {
    const k = edgeKey(e.a, e.b);
    if (fenced && fenced.has(k)) continue;
    if (fenced) fenced.add(k);
    const seg = { a: e.a, b: e.b, kind: e.kind, style: cat === 'official' && e.kind === 'front' ? 'picket' : 'rail', gap: null };
    if (e.kind === 'front') seg.gap = cat === 'industrial' ? [house.gateT - 3.2, house.gateT + 3.2] : [house.gateT - 0.65, house.gateT + 0.65];
    out.push(seg);
  }
  return out;
}
function finishPlot(vil, plot, house, built) {
  const rnd = vil.rnd;
  const cat = plot.cat = lotCat(plot, house);
  plot.path = planPath(plot, house, built, vil.road);
  vil.fenced = vil.fenced || new Set();
  plot.fences = planFencesFor(vil.V, plot, house, rnd, vil.fenced, cat);
  // A BARE CATEGORY (G405): a shed, a landmark, a field or an airport's building stands on the ground as it is -
  // the airport's apron, the sports ground's lawn and the site's fence are the THEME's, not the lot's
  if (cat === 'shed' || cat === 'sports' || cat === 'landmark' || /^airport/.test(cat)) {
    plot.fences = []; plot.path = []; plot.out = null; plot.car = null; plot.boat = null; plot.drive = null; plot.lot = null;
    return plot;
  }
  if (cat !== 'residential') {
    // THE OTHER CATEGORIES (G401): no outbuilding, no wreck, no boat - the lot slab, its bays and its cars instead
    plot.out = null; plot.car = null; plot.boat = null; plot.drive = null;
    plot.lot = planLot(vil, plot, house, built, rnd, cat);
    if (plot.lot) plot.path = [];                   // the slab or the yard is the way in; no garden path across it
    return plot;
  }
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
  // THE FRONT LOT (G401): the drive and the pad; the pad's car replaces a backyard wreck when there is no garage
  plot.drive = planDrive(vil, plot, house, built, rnd);
  if (plot.drive && plot.drive.car && !(plot.car && plot.car.garage)) plot.car = plot.drive.car;
  plot.lot = null;
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

// ---------------------------------------------------------------------------
// THE TREES (G306, the user: "would you be able using the tree system? ...
// Possible to get this from here too, and to use these trees in our
// village? The plan is the village overtakes anything below").
// ---------------------------------------------------------------------------
// The village PLANS its trees and hands the plan to whoever draws: a record
// is exactly what the world's TREE_PLACE takes - { x, z, key, size, yaw } -
// so in the game every one of these gets the whole ladder (three rungs, the
// impostor, both shadow cascades, the canopy map) for free, and the bench
// draws the same records through treeBuild's rungs. `pool` is the species
// on offer, as the bench reads them off the pack (key, the collection's
// size, sink and proportion, the subject's height); the gate hands a stub.
//
// Where they stand:
//   THE WOOD behind the village - inland of every plot's back edge, to the
//     edge of the terrain - on a jittered 6 m grid thinned by a slow noise
//     (clearings), the tall species; the size the world's rule, the
//     collection's `size` times 0.82-1.22.
//   THE EMPTY PLOTS (a frontage left open) grow a grove of their own.
//   THE LOTS keep one to three trees each, the smaller species, clear of the
//     house, the outbuilding, the car, the boat, the paths and the fences,
//     never on the beach.
// And THE CLEARING: the world's own woodland must not grow through the
// village - `vil.clearing` says where it may not: the plots and the road.
function planTrees(vil, pool) {
  const T = vil.T, V = vil.V, rnd = vil.rnd, half = T.size / 2, road = vil.road;
  const trees = [];
  pool = (pool && pool.length) ? pool : [{ key: 'stub|tree', size: 1, sink: 0, proportion: 1, h: 12 }];
  const tall = pool.filter(p => p.h >= 12), small = pool.filter(p => p.h < 12);
  const draw = list => {
    list = list.length ? list : pool;
    const tot = list.reduce((s, p) => s + (p.proportion || 1), 0);
    let r = rnd() * tot;
    for (const p of list) { r -= (p.proportion || 1); if (r <= 0) return p; }
    return list[list.length - 1];
  };
  const roads = [vil.road].concat(vil.site && vil.site.road ? [vil.site.road] : []);
  const roadNear = (x, z) => {
    let d = 1e9;
    for (const rd of roads) for (let i = 1; i < rd.pts.length; i++) d = Math.min(d, distSeg(x, z, rd.pts[i - 1], rd.pts[i]));
    return d;
  };
  // THE VILLAGE STRIP IS SMALL TREES (G329, the user: "only small trees in
  // the area I indicated ... otherwise just scale them down"): within the
  // plots' depth of the road on either side - the lots, the gaps, the
  // mine's ground - a tree is the small species, and scaled down besides;
  // the tall wood begins behind
  const inStrip = (x, z) => roadNear(x, z) < V.plotDepth + 10;
  const put = (x, z, p0, sizeK) => {
    let p = p0;
    if (inStrip(x, z) && p.h >= 12 && small.length) p = small[Math.floor(rnd() * small.length)];
    const shrink = inStrip(x, z) ? 0.65 : 1;
    const size = (p.size || 1) * (sizeK === undefined ? (0.82 + rnd() * 0.4) : sizeK) * shrink;
    trees.push({ x, z, key: p.key, size, yaw: rnd() * Math.PI * 2, y: T.h(x, z), sink: p.sink || 0,
                 h: (p.h || 12) * size / (p.size || 1) });
  };
  const distSeg = (x, z, a, b) => {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / Math.max(1e-9, dx * dx + dz * dz), 0, 1);
    return Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
  };
  const nearPoly = (poly, x, z, m) => {
    let d = 1e9;
    for (let i = 0; i < poly.length; i++) d = Math.min(d, distSeg(x, z, poly[i], poly[(i + 1) % poly.length]));
    return inPoly(poly, x, z) ? -d : d;      // negative inside: the metres to the edge
  };
  const clearOf = (x, z, m) => trees.every(t => Math.hypot(t.x - x, t.z - z) >= m);
  // THE WOOD: behind the plots' back edges (the deepest plot line at this x)
  const backAt = x => {
    let zb = -1e9;
    for (const p of vil.plots) for (const q of p.poly) if (Math.abs(q[0] - x) < 24) zb = Math.max(zb, q[1]);
    if (zb < -1e8) { let t = 0, best = 1e9; for (let i = 0; i < vil.road.pts.length; i++) { const d = Math.abs(vil.road.pts[i][0] - x); if (d < best) { best = d; t = vil.road.pts[i][1]; } } zb = t + V.plotDepth; }
    return zb;
  };
  // THE GAPS ARE FOREST TOO (G313, the user: "The empty lots should be full
  // of trees like the forest"): an empty frontage is no plot at all, so the
  // wood comes down through it to the road's verge - on both sides, down to
  // the beach on the water side - as dense as the wood, no clearing
  const roadT = (x, z) => {
    let best = 0, bd = 1e9;
    for (let i = 0; i < road.pts.length; i++) { const d = Math.hypot(road.pts[i][0] - x, road.pts[i][1] - z); if (d < bd) { bd = d; best = i; } }
    return road.s[best];
  };
  const sideOf = (x, z) => { const a = road.at(roadT(x, z)); return ((x - a.p[0]) * a.n[0] + (z - a.p[1]) * a.n[1]) > 0 ? 'water' : 'land'; };
  const inGap = (x, z) => {
    const t = roadT(x, z), side = sideOf(x, z);
    if (t < 6 || t > road.length - 6) return false;
    return !vil.plots.some(p => p.side === side && t >= p.s0 - 1 && t <= p.s1 + 1);
  };
  const s = V.seed * 0.618 + 9;
  for (let z = -half + 3; z < half - 2; z += 6) for (let x = -half + 3; x < half - 2; x += 6) {
    const px = x + (rnd() - 0.5) * 4.5, pz = z + (rnd() - 0.5) * 4.5;
    const gap = inGap(px, pz) && roadNear(px, pz) < V.plotDepth + 8;
    if (!gap && pz < backAt(px) + 5) continue;
    if (!gap && fbm(px * 0.035 + 2.2, pz * 0.035 + 8.8, s, 3) < 0.38) continue;   // a clearing
    if (T.h(px, pz) < V.waterY + 0.6) continue;
    if (roadNear(px, pz) < 5) continue;
    if (vil.plots.some(p => nearPoly(p.poly, px, pz, 0) < 1.5)) continue;
    if ((vil.siteKeepOut || []).some(poly => inPoly(poly, px, pz))) continue;      // the mine's ground (G321)
    if (vil.park && (nearPoly(vil.park.poly, px, pz, 0) < 3 || vil.park.path.pts.some((q, i, arr) => i > 0 && distSeg(px, pz, arr[i - 1], q) < 2.2))) continue;   // the totem park's lawn and its path (G352)
    if (vil.site && vil.site.yardPoly && inPoly(vil.site.yardPoly, px, pz) && rnd() < 0.85) continue;   // the gravel yard (G334): a few stragglers
    if (!clearOf(px, pz, gap ? 2.8 : 3.2)) continue;
    // ONLY SMALL TREES IN THE VILLAGE (G323, the user): the tall species
    // are the wood behind; a gap between plots grows the small ones
    put(px, pz, draw(gap ? small : tall));
    if (gap) {   // denser: a second tree in the same cell where it fits
      const qx = px + (rnd() - 0.5) * 4, qz = pz + (rnd() - 0.5) * 4;
      if (T.h(qx, qz) > V.waterY + 0.6 && roadNear(qx, qz) >= 5 && !vil.plots.some(p => nearPoly(p.poly, qx, qz, 0) < 1.5) && !(vil.siteKeepOut || []).some(poly => inPoly(poly, qx, qz)) && clearOf(qx, qz, 2.6))
        put(qx, qz, draw(small));
    }
  }
  // THE EMPTY PLOTS ARE FOREST (G313, the user: "The empty lots should be
  // full of trees like the forest"): the wood's own grid, no clearings,
  // to a stride of the plot line, the tall species with the odd small one
  for (const plot of vil.plots) {
    if (plot.house !== undefined) continue;
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (const q of plot.poly) { x0 = Math.min(x0, q[0]); z0 = Math.min(z0, q[1]); x1 = Math.max(x1, q[0]); z1 = Math.max(z1, q[1]); }
    for (let z = z0; z <= z1; z += 4.5) for (let x = x0; x <= x1; x += 4.5) {
      const px = x + (rnd() - 0.5) * 3.2, pz = z + (rnd() - 0.5) * 3.2;
      if (nearPoly(plot.poly, px, pz, 0) > -1.2) continue;
      if (T.h(px, pz) < V.waterY + 0.6 || roadNear(px, pz) < 4) continue;
      if (!clearOf(px, pz, 2.8)) continue;
      put(px, pz, draw(small));
    }
  }
  // THE LOTS: one to three, the smaller species, clear of everything
  for (const plot of vil.plots) {
    if (plot.house === undefined) continue;
    const h = vil.houses[plot.house];
    const rects = [{ o: h, hx: h.P.L / 2 + 3.5, hz0: -h.P.w / 2 - 3.5, hz1: h.P.w / 2 + (h.P.porch ? h.P.porchD : 0) + 3.5 }];
    if (plot.out) rects.push({ o: plot.out, hx: plot.out.P.L / 2 + 2.5, hz0: -plot.out.P.w / 2 - 2.5, hz1: plot.out.P.w / 2 + 2.5 });
    const inRect = (x, z) => rects.some(r => {
      const c = Math.cos(r.o.yaw), sn = Math.sin(r.o.yaw);
      const dx = x - r.o.x, dz = z - r.o.z, lx = dx * c - dz * sn, lz = dx * sn + dz * c;
      return Math.abs(lx) < r.hx && lz > r.hz0 && lz < r.hz1;
    });
    const segs = (plot.path || []).concat(plot.outPath || []).map(sg => [sg[0], sg[1]]);
    for (const sg of (h.built && h.built.stats.path) || []) segs.push([h.toWorld(sg[0][0], sg[0][1]), h.toWorld(sg[1][0], sg[1][1])]);
    const want = Math.floor(rnd() * 3.2);
    let got = 0;
    for (let i = 0; i < 60 && got < want; i++) {
      const x = plot.poly[0][0] + (plot.poly[2][0] - plot.poly[0][0]) * rnd(), z = plot.poly[0][1] + (plot.poly[2][1] - plot.poly[0][1]) * rnd();
      if (nearPoly(plot.poly, x, z, 0) > -1.8) continue;
      if (T.h(x, z) < V.waterY + 0.7) continue;
      if (inRect(x, z)) continue;
      if (segs.some(sg => distSeg(x, z, sg[0], sg[1]) < 1.6)) continue;
      if ([plot.car, plot.boat].some(c => c && Math.hypot(c.x - x, c.z - z) < 4)) continue;
      if (roadNear(x, z) < 4 || !clearOf(x, z, 4)) continue;
      put(x, z, draw(small), 0.7 + rnd() * 0.4);
      got++;
    }
  }
  vil.trees = trees;
  vil.clearing = { polys: vil.plots.map(p => p.poly), road: { pts: vil.road.pts, w: vil.road.w } };
  return trees;
}

// THE LINE (G348): the two stations' rope hooks are in each station's own
// frame and at a height that depends on the line's angle (the saddle point
// on the arch, the carriages on the tower); the angle is what the two
// stations' positions make. So: build both, read the hooks in the world,
// take the angle between them, set `lineDeg` on both and build again -
// twice is enough for the hooks to move under a centimetre. `buildFn(rec)`
// is the caller's build (the bench's with its finish, the gate's plain).
// Returns { angle (deg), ropes: [{ a, b, kind }], docks: [{ p, yaw, dx }] }
// in the world, and leaves each station's `built` on its record.
// (G352.1, for the premises composer's adapter: `vil` needs nothing but the
// two station records - `{ base, top }` given outright, or `siteHouses` to
// search; each record { P, x, z, y, yaw, toWorld }; nothing else of the
// village is read, and the result is left on `vil.tram` and returned)
function tramLine(vil, buildFn) {
  const base = vil.base || (vil.siteHouses || []).find(h => h.tram && Math.round(h.P.station) === 2);
  const top = vil.top || (vil.siteHouses || []).find(h => h.tram && Math.round(h.P.station) === 1);
  if (!base || !top) return null;
  const toW = (h, p) => { const w = h.toWorld(p[0], p[2]); return [w[0], p[1] + h.y, w[1]]; };
  const toWdir = (h, d) => { const c = Math.cos(h.yaw), s = Math.sin(h.yaw); return [d[0] * c + d[2] * s, d[1], -d[0] * s + d[2] * c]; };
  let angle = base.P.lineDeg;
  for (let pass = 0; pass < 3; pass++) {
    base.P.lineDeg = angle; top.P.lineDeg = angle;
    base.built = buildFn(base); top.built = buildFn(top);
    const hb = base.built.stats.station.hooks.track[0], ht = top.built.stats.station.hooks.track[0];
    const a = toW(base, hb.p), b = toW(top, ht.p);
    angle = Math.atan2(b[1] - a[1], Math.hypot(b[0] - a[0], b[2] - a[2])) * 180 / Math.PI;
  }
  const ropes = [];
  const HB = base.built.stats.station.hooks, HT = top.built.stats.station.hooks;
  // THE PAIRING (G351): the stations face opposite ways, so a base hook's
  // mate is the top hook on the SAME SIDE OF THE LINE, not the same index
  // (paired by index the two track ropes crossed mid-span). A line is a
  // track rope and its haul loop's two strands: six ropes, each tagged
  const u = [top.x - base.x, top.z - base.z], lu = Math.hypot(u[0], u[1]); u[0] /= lu; u[1] /= lu;
  const lat = p => (p[0] - base.x) * -u[1] + (p[2] - base.z) * u[0];
  const pair = [0, 1].map(i => { const lb = lat(toW(base, HB.track[i].p)); return Math.abs(lat(toW(top, HT.track[1].p)) - lb) < Math.abs(lat(toW(top, HT.track[0].p)) - lb) ? 1 : 0; });
  for (let i = 0; i < 2; i++) {
    const j = pair[i];
    ropes.push({ a: toW(base, HB.track[i].p), b: toW(top, HT.track[j].p), kind: 'track', line: i });
    ropes.push({ a: toW(base, HB.haul[2 * i].p), b: toW(top, HT.haul[2 * j].p), kind: 'haul', line: i });
    ropes.push({ a: toW(base, HB.haul[2 * i + 1].p), b: toW(top, HT.haul[2 * j + 1].p), kind: 'haul', line: i });
  }
  // both lines' slots at both stations: where a cabin's floor origin stands when docked, by line
  const slotAt = (h, sx) => { const d = h.built.stats.station.hooks.dock; return toW(h, [sx * d.dx, d.p[1], d.p[2]]); };
  const side = i => i ? 1 : -1;
  const slots = { base: [0, 1].map(i => slotAt(base, side(i))), top: [0, 1].map(i => slotAt(top, side(pair[i]))) };
  // the pair at rest: cabin 0 in the base's dock on line 0, cabin 1 in the top's dock on line 1
  const docks = [{ p: slots.base[0], yaw: base.yaw, dx: HB.dock.dx, station: 'base', line: 0 },
                 { p: slots.top[1], yaw: top.yaw, dx: HT.dock.dx, station: 'top', line: 1 }];
  vil.tram = { angle, ropes, docks, slots, base, top, pair };
  return vil.tram;
}

// THE GRAVEL YARD (G334): one ground patch under the whole site, on the
// terrain, the lot patch's own channels - gravel (the dirt set with pebbles
// through it) where the works are, the grass returning at the yard's edge
// and beyond every building's reach, dry under every building, the
// buildings' occluders darkening it, alpha fading into the terrain across
// the margin. The patch is a quad in the road's frame, so it follows the
// bend the site follows. `occ` are the site buildings' occluders in the
// world (the bench hands them in; the gate hands none).
function siteGround(vil, occ) {
  const S = vil.site, th = S.theme, T = vil.T, road = S.road || vil.road, Y = th.yard;
  const cell = 0.9, M = 6;
  // the quad's corners along the road's frame
  const corner = (x, z) => { const a = road.at(S.t + x); return [a.p[0] - a.n[0] * z, a.p[1] - a.n[1] * z]; };
  const poly = [corner(Y.x0, Y.z0), corner(Y.x1, Y.z0), corner(Y.x1, Y.z1), corner(Y.x0, Y.z1)];
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
  for (const p of poly) { x0 = Math.min(x0, p[0]); z0 = Math.min(z0, p[1]); x1 = Math.max(x1, p[0]); z1 = Math.max(z1, p[1]); }
  x0 -= M; z0 -= M; x1 += M; z1 += M;
  const nx = Math.ceil((x1 - x0) / cell), nz = Math.ceil((z1 - z0) / cell);
  const edgeDist = (x, z) => {
    let d = 1e9;
    for (let i = 0; i < 4; i++) {
      const a = poly[i], b = poly[(i + 1) % 4], dx = b[0] - a[0], dz = b[1] - a[1];
      const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / Math.max(1e-9, dx * dx + dz * dz), 0, 1);
      d = Math.min(d, Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t)));
    }
    return d;
  };
  // every building's footprint (the mill's: each tier, its receiving house, its power house)
  const rects = [];
  for (const h of vil.siteHouses || []) {
    const P = h.P;
    if (P.mill && h.built && h.built.stats.mill) {
      // the top house on its pad and the stations down the hill: gravel only
      // a few steps around each volume (the hill keeps its grass between and
      // beside them); the receiving house and the power house at the road
      // spread the works' gravel
      const Mi = h.built.stats.mill;
      for (const v of Mi.vols) { const c = h.toWorld((v.x0 + v.x1) / 2, (v.z0 + v.z1) / 2); rects.push({ x: c[0], z: c[1], yaw: h.yaw, hx: (v.x1 - v.x0) / 2 + 1, hz: (v.z1 - v.z0) / 2 + 1, reach: 2.5, fade: 5 }); }
      const B = Mi.bottom;
      if (B) { const c = h.toWorld(B.x, B.z); rects.push({ x: c[0], z: c[1], yaw: h.yaw, hx: B.L / 2 + 1, hz: B.w / 2 + 1, reach: 9, fade: 12 }); }
      if (Mi.power) { const c = h.toWorld(Mi.power.x, Mi.power.z); rects.push({ x: c[0], z: c[1], yaw: h.yaw, hx: Mi.power.L / 2 + 1, hz: Mi.power.w / 2 + 1, reach: 6, fade: 8 }); }
    } else rects.push({ x: h.x, z: h.z, yaw: h.yaw, hx: P.L / 2 + 1, hz: P.w / 2 + 1, reach: 8, fade: 12 });
  }
  // under a building (1), and the gravel's weight from the buildings
  const nearBuilding = (x, z) => {
    let best = 1e9, g = 0;
    for (const r of rects) {
      const c = Math.cos(r.yaw), s = Math.sin(r.yaw);
      const dx = x - r.x, dz = z - r.z, lx = dx * c - dz * s, lz = dx * s + dz * c;
      const d = Math.hypot(Math.max(0, Math.abs(lx) - r.hx), Math.max(0, Math.abs(lz) - r.hz));
      best = Math.min(best, d);
      g = Math.max(g, clamp(1 - (d - r.reach) / r.fade, 0, 1));
    }
    return { d: best, g };
  };
  // the road's verge is gravel too, on the flat (the works' level, not up the hill)
  const yRoad = T.h(S.at.p[0], S.at.p[1]);
  const roadNear = (x, z) => {
    let d = 1e9;
    for (let i = 1; i < road.pts.length; i++) {
      const a = road.pts[i - 1], b = road.pts[i], dx = b[0] - a[0], dz = b[1] - a[1];
      const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / Math.max(1e-9, dx * dx + dz * dz), 0, 1);
      d = Math.min(d, Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t)));
    }
    return d;
  };
  const darkAt = (x, z) => {
    let keep = 1;
    for (const o of occ || []) {
      const c = Math.cos(o.ry || 0), s = Math.sin(o.ry || 0);
      const dx = x - o.x, dz = z - o.z, lx = dx * c - dz * s, lz = dx * s + dz * c;
      let out;
      if (o.hx !== undefined) out = Math.hypot(Math.max(0, Math.abs(lx) - o.hx), Math.max(0, Math.abs(lz) - o.hz));
      else out = Math.max(0, Math.hypot(lx, lz) - o.r);
      if (out > 4) continue;
      const soft = o.soft === undefined ? 0.5 : o.soft;
      const t = 1 - clamp(out / Math.max(0.05, soft), 0, 1);
      keep *= 1 - (o.k === undefined ? 0.4 : o.k) * t * t;
    }
    return Math.min(0.85, 1 - keep);
  };
  const pos = [], uv = [], splat = [], tone = [], alpha = [], idx = [];
  const id = new Int32Array((nx + 1) * (nz + 1)).fill(-1);
  const s = vil.V.seed * 0.618 + 31;
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = x0 + i * cell, z = z0 + j * cell;
    const inside = inPoly(poly, x, z);
    const d = edgeDist(x, z);
    if (!inside && d > M) continue;
    if (T.h(x, z) < T.waterY + 0.2) continue;
    const y = T.h(x, z);
    id[j * (nx + 1) + i] = pos.length / 3;
    pos.push(x, y + 0.025, z);
    uv.push(x, z);
    // gravel where the works are: within a walk of any building, the road's
    // verge, and the whole space between the mill and the road; grass creeps
    // back beyond, on a noise
    const nb = nearBuilding(x, z), rd = roadNear(x, z);
    const n1 = fbm(x * 0.06 + 3.3, z * 0.06 + 1.1, s, 3);
    const flat = clamp(1 - (y - yRoad - 3) / 6, 0, 1);
    const grav = Math.max(nb.g, flat * clamp(1 - (rd - 3 - 7) / 10, 0, 1)) * (0.55 + 0.45 * n1);
    const under = nb.d < 0.01 ? 1 : 0;
    splat.push(n1, under, grav, grav * (0.35 + 0.35 * fbm(x * 0.2, z * 0.2, s + 7, 2)));
    tone.push(darkAt(x, z), 0);
    alpha.push(inside ? 1 : 1 - d / M);
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = id[j * (nx + 1) + i], b = id[j * (nx + 1) + i + 1], c = id[(j + 1) * (nx + 1) + i + 1], dd = id[(j + 1) * (nx + 1) + i];
    if (a < 0 || b < 0 || c < 0 || dd < 0) continue;
    idx.push(a, dd, c, a, c, b);
  }
  return { pos, uv, splat, tone, alpha, idx, verts: pos.length / 3, poly };
}

// THE ROADSIDE BILLBOARDS (G313): the user's signs that name a business up
// the road - the air taxi, the bear tours, the motel - on timber posts on
// the road's inland verge where no plot is, facing the road, thirty metres
// or more apart, the keys spread so no two say the same. Records are
// { x, z, y, ry, key } - what a placer of a drawn board needs.
function planBillboards(vil, keys) {
  const T = vil.T, V = vil.V, road = vil.road, rnd = vil.rnd;
  const out = [];
  keys = (keys && keys.length) ? keys.slice() : ['air_taxi', 'bear_tours', 'north_motel'];
  let t = 14 + rnd() * 10, k = 0, skipped = 0;
  while (t < road.length - 10 && out.length < 3) {
    const a = road.at(t);
    const off = road.w / 2 + 2.2;
    const x = a.p[0] - a.n[0] * off, z = a.p[1] - a.n[1] * off;      // -n: inland
    const onPlot = (vil.plots || []).some(p => inPoly(p.poly, x, z));
    const nearPole = (vil.poles || []).some(q => Math.hypot(q.x - x, q.z - z) < 3);
    // not across a building's frontage (a sign in front of the store hides
    // the store's own): an empty frontage or a gap between plots first,
    // any verge after eight tries
    const busy = (vil.plots || []).some(p => p.side === 'land' && p.house !== undefined && t > p.s0 - 1 && t < p.s1 + 1)
      || (vil.site && Math.abs(t - vil.site.jt) < 14) || (vil.site && vil.site.tram && Math.abs(t - vil.site.tram.t) < 22);
    if (!onPlot && !nearPole && T.h(x, z) > V.waterY + 0.5 && (!busy || skipped >= 8)) {
      // facing the road: +z toward the road, i.e. along +n
      out.push({ key: keys[k % keys.length], x, z, y: T.h(x, z), ry: Math.atan2(a.n[0], a.n[1]), t });
      k++; skipped = 0;
      t += 30 + rnd() * 25;
    } else { t += 6; skipped++; }
  }
  // a road with no free verge at all: the busy rule lifted, from the start
  if (out.length < 2) {
    t = 14; skipped = 99;
    while (t < road.length - 10 && out.length < 3) {
      const a = road.at(t), off = road.w / 2 + 2.2;
      const x = a.p[0] - a.n[0] * off, z = a.p[1] - a.n[1] * off;
      const ok = !(vil.plots || []).some(p => inPoly(p.poly, x, z)) && !(vil.poles || []).some(q => Math.hypot(q.x - x, q.z - z) < 3)
        && T.h(x, z) > V.waterY + 0.5 && out.every(b => Math.hypot(b.x - x, b.z - z) > 30);
      if (ok) { out.push({ key: keys[k % keys.length], x, z, y: T.h(x, z), ry: Math.atan2(a.n[0], a.n[1]), t }); k++; t += 30; }
      else t += 6;
    }
  }
  vil.billboards = out;
  return out;
}

window.VILLAGE_GEN = { lotCat, planDrive, planLot, planFencesFor, DRIVE_CARS, AUTO_MENUS, autoMenu, VDEF, makeTerrain, makeRoad, makePlots, makeVillage, finishPlot, planTrees, planBillboards, THEMES, placeSite, placeHouse, withHill, withShelf, placePark, streetLamp, siteGround, makeSpur, polyRoad, civicPlots, tramLine,
                       buildFence, gateLeaf, clipToLand, inPoly, shoreZ, fbm, lotGround, edgeKey };
})();
