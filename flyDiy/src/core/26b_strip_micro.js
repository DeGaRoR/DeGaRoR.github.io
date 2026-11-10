// ===========================================================================
// THE STRIP'S MICRO-HEIGHT (DIRT-STRIP, 2026-11-09): BUMPY BUSH STRIPS. Pure, no THREE, no state but the published list.
// ===========================================================================
// The user: "some runways to be really, really bumpy ... not flat across at all ... a lot of little bumps and puddles ...
// new settings that would allow us to define how chaotic they are ... a global profile across and some random procedural
// variation with puddles and randomized noise across". Off on every strip unless its record carries `micro` with a
// chaos > 0 (absent = off: nothing anywhere moves).
//
// ONE FUNCTION, THREE READERS. 27_premises' compose pushes a `micro` MODIFIER right after a strip's grade - affine in
// the height under it (h + dh), so it rides the premises raster and its cook exactly as every other modifier does - and
// world.terrainH carries it: the solver's wheels stand on it, the pavement ribbon is draped on it (pavement.js refines a
// micro strip's rows to REFINE_MICRO), and puddleAt / at (below) answer DIRT-DUST's spray and anything else. A bump the
// wheels feel is a bump that is drawn (WYSIWYG).
//
// THE FIELD, in the strip's frame (u along from end 0, v across, metres; dE = halfW - |v| from the edge):
//   dh = endTaper(u) * ( crown(v) + edgeTaper(dE) * ( rough(u, v) - ruts(u, v) - holes(u, v) ) )
//   crown   a parabola, `crown` % of slope at the edge, 0 at the edge (drainage; turf / bush strips 1.5-3 %)
//   ruts    the two LANES the tyre marks wear (pavement.js THE LANES: the fleet's mean half-track, the same spread),
//           pressed `rut` cm down, varying slowly along the strip - the wheels sit in the worn lanes you see
//   rough   value noise in octaves of 32 .. 1 m whose spectrum follows ISO 8608 (road roughness: displacement PSD
//           Gd(n) = Gd(n0) (n / n0)^-2, n0 = 0.1 cycle/m); `chaos` picks Gd(n0) = 16e-6 x 4^(5 chaos) m^3 -
//           chaos 0.2 class B, 0.4 C (sd ~1 cm), 0.6 D, 0.8 E (sd ~4.5 cm, a rough bush strip), 1 F (sd ~9 cm)
//   lumps   (DEEPER) value noise at 3.5 and 1.8 m, `lumps` cm at the crest (15 chaos): the bumps you see and feel
//   ways    (RUTS FIRST) the vehicles' double track, a cart's grooves + its horse, a walkers' path - troughs `ruts` deep with
//           their berms (see THE WAYS)
//   holes   sparse smooth bowls (radius 0.5-1.1 m, `holeDepth` cm), `holes` per 100 m of strip, two in three in a lane
//   the tapers: 0 over the last 2 m inside each edge (the side fade, the ground patch's sink are untouched) and the
//   first / last 4 m of the strip (the grade's own ground beyond)
// PUDDLES: water stands in the holes, flat, filled to a fraction of each hole's depth set by the soil's wetness
// (DIRT-DUST's SOIL_WET.at(day).wet, passed in) x `puddles`, and only where the strip's grade is under 3 % (water runs
// off steeper ground). OFF by default (`puddles` 0) until the drawn puddles land: a puddle the wheels splash in must be
// drawn.
// THE HASH is an integer one (Math.imul), exact in JS and in GLSL's uint arithmetic, so the shader's holes are these.
'use strict';
const STRIP_MICRO = (() => {
  const KNOBS = ['chaos', 'crown', 'rut', 'holes', 'holeDepth', 'puddles', 'hazards', 'hazardSize', 'swell', 'lumps', 'ruts', 'cart', 'path', 'rocks', 'seed'];
  // what chaos derives when a knob is left out (crown in %, rut and holeDepth in cm, holes per 100 m)
  // (hazards: the user, 9 Nov via A0 - "a couple of really random things that are better to be avoided, but that are avoidable
  // too, like big bumps": 0 under chaos 0.15, 1 to 0.5, 2 to 0.8, 3 above; hazardSize in cm)
  // (DEEPER, the user 9 Nov 16:55 "yes, deeper bumps", 17:00 "the main relief should come from the ruts themselves" and "these
  // strips are used by the planes, but also by other vehicles, pedestrians, animals, carriages ... too clean": THE WAYS -
  // `ruts` cm, 12 chaos, the vehicles' double track and what follows it - and the LUMPS, 3.5 m and 1.8 m bumps, 8 chaos cm;
  // `rut` is now the aeroplanes' own wide, shallow lanes, 4 chaos cm; cart / path -1 = the seed decides; `rocks` the
  // chance of a stone in a 1.2 m cell, drawn only - the rocks you hit are their own work)
  const derive = c => ({ crown: 1.5 + 1.0 * c, rut: 4 * c, lumps: 8 * c, ruts: 12 * c, cart: -1, path: -1, rocks: Math.min(0.55, 0.1 + 0.6 * c), holes: c < 0.25 ? 0 : 14 * (c - 0.25), holeDepth: 4 + 12 * c, puddles: 0,
    hazards: c < 0.15 ? 0 : c < 0.5 ? 1 : c < 0.8 ? 2 : 3, hazardSize: 20 + 20 * c,
    // THE SWELL (the user, 9 Nov ~05:00, on chaos 0.8's +-10 cm: "completely invisible ... plus or minus 10 centimeters really
    // not gonna make the difference"): long rolls of 25 and 12 m on top of ISO's short roughness, `swell` cm at its crest - 30 c
    swell: 30 * c });
  const FLEET_MEAN = 1.098;                 // pavement.js PV_FLEET_MEAN: the lanes' half-track
  const BERM = 0.35;                         // a way's berm, x its depth
  const EDGE_IN = [0.5, 2.5], END_IN = 4, CELL = 6, OCT = [32, 16, 8, 4, 2, 1], N0 = 0.1, NOISE_SD = 0.428;   // NOISE_SD: vnoise's own, measured (2e5 points)
  const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // the integer hash: three ints -> [0, 1) on 24 bits (exact in float32 too)
  function ih(x, y, s) {
    let h = (Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(s | 0, 0x2f6b4c13)) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
    h = (h ^ (h >>> 15)) >>> 0;
    return (h >>> 8) / 16777216;
  }
  // value noise in [-1, 1], smoothstepped, on a unit lattice
  function vnoise(x, y, s) {
    const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = ih(ix, iy, s), b = ih(ix + 1, iy, s), c = ih(ix, iy + 1, s), d = ih(ix + 1, iy + 1, s);
    return 2 * ((a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy) - 1;
  }
  const on = m => !!m && typeof m === 'object' && +m.chaos > 0;
  // the knobs, resolved: the record's where it says, chaos's elsewhere; clamped to the slider ranges
  function resolve(m) {
    const c = Math.max(0, Math.min(1, +(m && m.chaos) || 0)), D = derive(c), o = { chaos: c };
    const pick = (k, lo, hi) => { const v = m && m[k] !== undefined && m[k] !== null && isFinite(+m[k]) ? +m[k] : D[k]; return Math.max(lo, Math.min(hi, v)); };
    o.crown = pick('crown', 0, 5); o.rut = pick('rut', 0, 20); o.holes = pick('holes', 0, 30); o.holeDepth = pick('holeDepth', 0, 25); o.puddles = pick('puddles', 0, 1);
    o.hazards = Math.round(pick('hazards', 0, 4)); o.hazardSize = pick('hazardSize', 0, 50); o.swell = pick('swell', 0, 60); o.lumps = pick('lumps', 0, 30);
    o.ruts = pick('ruts', 0, 25); o.cart = Math.round(pick('cart', -1, 1)); o.path = Math.round(pick('path', -1, 1)); o.rocks = pick('rocks', 0, 0.9);
    o.seed = m && isFinite(+m.seed) ? (+m.seed | 0) : 0;
    o.gd = 16e-6 * Math.pow(4, 5 * c);   // Gd(n0), m^3
    return o;
  }
  // field(strip, micro, grade): strip = { c: [x, z], hdg, len, wid } in the frame the caller queries in (27_premises: the
  // premises frame); grade = the steepest slope of the strip's profile (puddles stand under 3 %). -> the field object.
  function field(strip, micro, grade, cosF, sinF) {
    const K = resolve(micro), halfW = strip.wid / 2, len = strip.len;
    const cs = (cosF || Math.cos)(strip.hdg), sn = (sinF || Math.sin)(strip.hdg);
    const x0 = strip.c[0] - cs * len / 2, z0 = strip.c[1] - sn * len / 2;   // end 0
    const toUV = (x, z) => { const dx = x - x0, dz = z - z0; return [dx * cs + dz * sn, -dx * sn + dz * cs]; };   // n = (-sin, cos): runwayEnds' own
    const seed = (K.seed * 7919 + 1013) | 0;
    // ISO 8608 per octave: the band [lambda / sqrt2, lambda sqrt2] holds Gd n0^2 lambda (sqrt2 - 1/sqrt2) of variance
    const amp = OCT.map(l => Math.sqrt(K.gd * N0 * N0 * l * 0.7071) / NOISE_SD);
    const crownS = K.crown / 100, rutD = K.rut / 100, holeD = K.holeDepth / 100;
    const sig = 0.35 + 0.05 * halfW, swA = K.swell / 100, lA = K.lumps / 100;
    const pHole = Math.fround(Math.min(0.95, K.holes * CELL / 100 / 2));   // two candidates a cell
    const pudOK = K.puddles > 0 ? 1 - ss(0.015, 0.03, Math.abs(grade || 0)) : 0;
    // a cell's hole m (0, 1): null or [u, v, R, depth]
    function hole(i, m) {
      if (pHole <= 0 || ih(i, m, seed + 11) >= pHole) return null;
      const R = 0.5 + 0.6 * ih(i, m, seed + 12), u = (i + 0.15 + 0.7 * ih(i, m, seed + 13)) * CELL;
      // THE SHAPE (the user, 9 Nov 17:15: "give variation to the round puddles. Stretch them in some directions, then mix them
      // with noise"): stretched 1-2.2 x along an axis within 30 deg of the strip's (the wheels draw them out), its outline
      // pushed inward by a noise (holeRho); eV / eU its reach across / along
      const a = 1 + 1.2 * ih(i, m, seed + 18), th = (ih(i, m, seed + 19) - 0.5) * 1.05, cth = Math.cos(th), sth = Math.sin(th);
      const eV = R * Math.sqrt(a * a * sth * sth + cth * cth), eU = R * Math.sqrt(a * a * cth * cth + sth * sth);
      const lim = halfW - EDGE_IN[1] - eV;
      if (lim <= 0 || u < END_IN + eU || u > len - END_IN - eU) return null;
      let v;
      if (ih(i, m, seed + 14) < 0.667) { const side = ih(i, m, seed + 15) < 0.5 ? -1 : 1; v = side * FLEET_MEAN + (ih(i, m, seed + 16) - 0.5) * 2 * sig; }
      else v = (ih(i, m, seed + 16) - 0.5) * 2 * lim;
      v = Math.max(-lim, Math.min(lim, v));
      return [u, v, R, holeD * (0.5 + 0.5 * ih(i, m, seed + 17)), a, cth, sth, eV, eU];
    }
    // THE RUTS' WATER (the user, 9 Nov 17:20: "yes ... make sure the border is not too harsh. That should be muddy water"):
    // a vehicles' rut holds water where it runs deeper than (1 - 0.35 fill) of its depth - the deep stretches first, the
    // whole rut's floor when soaked; the tapers as the ground's (pavement.js: the same, off pvWays)
    function rutWater(u, v, fill) {
      if (!WAYS.length || fill <= 0) return 0;
      const w = waysAt(u, v); if (w[2] < 0 || WAYS[w[2]][7] !== 0 || w[1] <= 0.3) return 0;
      const t = ss(0, END_IN, u) * ss(0, END_IN, len - u) * ss(EDGE_IN[0], EDGE_IN[1], halfW - Math.abs(v));
      return t * Math.max(0, w[3] - WAYS[w[2]][2] * (1 - 0.35 * fill));
    }
    // a hole's outline: 1 on it, 0 at its middle - the stretched ellipse, pushed in by up to a third by a noise on its own
    // offset (pavement.js pvHoles, line for line)
    function holeRho(du, dv, H, i, m) {
      const x = du * H[5] + dv * H[6], y = -du * H[6] + dv * H[5];
      return Math.sqrt(x * x / (H[4] * H[4]) + y * y) / H[2] * (1 + 0.32 * (0.5 + 0.5 * vnoise(du / H[2] * 1.7 + i * 7.3, dv / H[2] * 1.7 + m * 3.1, seed + 21)));
    }
    // the holes' depth below the surface at (u, v), and the water a fill puts in them
    function holesAt(u, v, fill) {
      if (pHole <= 0) return [0, 0];
      const ic = Math.floor(u / CELL); let d = 0, w = 0;
      for (let i = ic - 1; i <= ic + 1; i++) for (let m = 0; m < 2; m++) {
        const H = hole(i, m); if (!H) continue;
        const du = u - H[0], dv = v - H[1];
        if (Math.abs(du) >= H[8] || Math.abs(dv) >= H[7]) continue;
        const rho = holeRho(du, dv, H, i, m);
        if (rho >= 1) continue;
        const b = H[3] * 0.5 * (1 + Math.cos(Math.PI * rho));
        if (b > d) d = b;
        if (fill > 0) w = Math.max(w, b - (1 - fill) * H[3]);
      }
      return [d, w];
    }
    // THE HAZARDS (A0 for the user, 9 Nov): K.hazards big smooth bumps (3 in 5) or holes, radius 1.2-2.2 m, K.hazardSize cm,
    // in the rolling zone (15-85 % of the length, one a slice), each on ONE side with its inner edge 0.3 m past the
    // centreline - the other half always a clean line - and clear of the last 0.5 m inside the edge. [u, v, R, h signed]
    const HZ = [];
    for (let j = 0; j < K.hazards; j++) {
      let R = 1.5 + 1.5 * ih(j, 0, seed + 32);
      const room = halfW - 0.5 - 0.3 - 2 * R;
      if (room < 0) R = (halfW - 0.8) / 2;
      if (R < 0.6) continue;
      const aH = 1 + 0.6 * ih(j, 0, seed + 37);   // (THE SHAPE: drawn out along the strip 1-1.6 x, never wider across)
      const u = Math.max(END_IN + aH * R, Math.min(len - END_IN - aH * R, len * (0.05 + 0.9 * (j + 0.2 + 0.6 * ih(j, 0, seed + 31)) / K.hazards)));   // (bumpy all over: the whole strip)
      const side = ih(j, 0, seed + 35) < 0.5 ? -1 : 1, v = side * (0.3 + R + Math.max(0, room) * ih(j, 0, seed + 36));
      const h = K.hazardSize / 100 * (0.7 + 0.3 * ih(j, 0, seed + 34)) * (ih(j, 0, seed + 33) < 0.6 ? 1 : -1);
      HZ.push([u, v, R, h, aH]);
    }
    const hzUp = HZ.reduce((m, H) => Math.max(m, H[3]), 0);
    // the hazards at (u, v): their height (signed), and the water a fill puts in the holes
    function hazardsAt(u, v, fill) {
      let h = 0, w = 0;
      for (let j = 0; j < HZ.length; j++) {
        const H = HZ[j], du = u - H[0], dv = v - H[1];
        if (Math.abs(du) >= H[2] * H[4] || Math.abs(dv) >= H[2]) continue;
        const rho = Math.sqrt(du * du / (H[4] * H[4]) + dv * dv) / H[2] * (1 + 0.25 * (0.5 + 0.5 * vnoise(du / H[2] * 1.4 + j * 5.7, dv / H[2] * 1.4 + 11, seed + 38)));
        if (rho >= 1) continue;
        const b = H[3] * 0.5 * (1 + Math.cos(Math.PI * rho));
        h += b;
        if (fill > 0 && H[3] < 0) w = Math.max(w, -b - (1 - fill) * -H[3]);
      }
      return [h, w];
    }
    function lanes(v) { const a = (Math.abs(v) - FLEET_MEAN) / sig, b = v / (sig * 0.8); return Math.max(Math.exp(-a * a), 0.55 * Math.exp(-b * b)); }
    // THE WAYS (RUTS FIRST). A strip is a track everybody uses. The VEHICLES' double track is always there: a half-track
    // 0.78-0.88 m (a pickup, a quad, the fuel bowser), tyres worn into flat-bottomed ruts `ruts` deep and 0.30 m across, the
    // ground they pushed out banked beside them (BERM x the depth); a CART some strips keep (cart -1: two in five) runs in
    // them too, on narrow wheels at 0.68 m - thin, sharp grooves - with its horse's trodden lane between; a PATH (path -1:
    // three in five) is the walkers' and the animals' single file, near a side. Each wanders along the strip (a 60 m and a
    // 15 m noise). Where two troughs cross the deeper wins (a wheel cannot dig twice); the berms lie only off the troughs.
    // [half-track (0 = one file), trough half-width, depth m, berm, c0, wander 60 m, wander 15 m, noise key]
    const rutsD = K.ruts / 100, WAYS = [];
    if (rutsD > 0) {
      const room = Math.max(0, halfW - EDGE_IN[1] - 0.9 - 0.4);
      const vc = (ih(0, 0, seed + 401) - 0.5) * 2 * room * 0.35;
      WAYS.push([0.78 + 0.10 * ih(0, 1, seed + 401), 0.15, rutsD, BERM, vc, 0.30, 0.08, 0]);
      if (K.cart === 1 || (K.cart === -1 && ih(1, 0, seed + 401) < 0.4)) {
        const cc = vc + (ih(1, 1, seed + 401) - 0.5) * 0.4;
        WAYS.push([0.68, 0.10, 0.35 * rutsD, 0.25, cc, 0.25, 0.06, 1]);
        WAYS.push([0, 0.18, 0.22 * rutsD, 0, cc, 0.25, 0.06, 1]);           // the horse: the cart's own line, between its wheels
      }
      if (K.path === 1 || (K.path === -1 && ih(2, 0, seed + 401) < 0.6)) {
        const side = ih(2, 1, seed + 401) < 0.5 ? -1 : 1, pv = Math.max(0, halfW - EDGE_IN[1] - 0.3 - 0.8 * ih(2, 2, seed + 401));
        WAYS.push([0, 0.17, 0.35 * rutsD, 0.2, side * pv, 0.30, 0.10, 2]);
      }
    }
    const wayC = (W, u) => W[4] + W[5] * vnoise(u / 60, W[7], seed + 411) + W[6] * vnoise(u / 15, W[7], seed + 421);
    // the ways at (u, v): [dh (troughs down, berms up), the deepest trough's share 0..1, which way (-1 none), its depth]
    function waysAt(u, v) {
      let dMax = 0, tMax = 0, bm = 0, wi = -1;
      for (let i = 0; i < WAYS.length; i++) {
        const W = WAYS[i], c = wayC(W, u);
        // deeper and shallower along it (a 9 m noise: where it held water, where it was graded), its edge ragged (0.7 m)
        const dep = W[2] * (0.75 + 0.25 * vnoise(u / 9, W[7] + 3, seed + 431));
        for (let s = W[0] > 0 ? -1 : 1; s <= 1; s += 2) {
          const x = v - c - s * W[0] + 0.03 * vnoise(u / 0.7, W[7] * 2 + s, seed + 441), q = x / W[1], t = Math.exp(-q * q * q * q);
          const bq = (Math.abs(x) - 1.7 * W[1] - 0.06) / (0.6 * W[1] + 0.05);
          if (dep * t > dMax) { dMax = dep * t; wi = i; } tMax = Math.max(tMax, t);
          bm += W[3] * dep * Math.exp(-bq * bq);
        }
      }
      return [-dMax + bm * (1 - tMax), tMax, wi, dMax];
    }
    // THE ROCKS (not felt): a stone in one 1.2 m cell in `rocks`, toward the edges (the grader's windrow, what the wheels
    // threw), 7-27 cm - the rock pack's meshes, a third buried (render_world standRocks, from bigRocks); pebbles in 0.3 m cells,
    // 1.6-5 cm across, drawn by the pavement (the user, 9 Nov 21:15: "nothing above ... 5 max ... the bigger rocks need to be
    // the mesh ones"). Each sits in the middle half of its cell, so a point
    // asks its own cell only. -> [u, v, R] or null (pavement.js pvRock, line for line)
    function rockIn(i, j, big) {
      const M = big ? 1.2 : 0.3, sk = seed + (big ? 501 : 511);
      const vC = (j + 0.5) * M, edge = ss(0.3, 0.9, Math.abs(vC) / halfW);
      const p = big ? K.rocks * edge * edge : Math.min(0.35, 0.04 + 0.5 * K.rocks) * (0.6 + 0.4 * edge);
      if (ih(i, j, sk) >= p) return null;
      const a = ih(i, j, sk + 1), b = ih(i, j, sk + 2), e = ih(i, j, sk + 3);
      return [(i + 0.25 + 0.5 * a) * M, (j + 0.25 + 0.5 * b) * M, big ? 0.07 + 0.2 * e * e : 0.008 + 0.017 * e * e];
    }
    // the stones for the meshes: a 1.2 m cell's, whole inside the strip clear of its ends, none in a way's trough or a hole
    // -> [u, v, R] or null. A stone's footprint (R <= 0.27) stays inside the middle of its own cell (0.3 m clear of its sides)
    // THE STONES GROW WITH CHAOS (the Pilot's bar, 10 Nov: the Jodel's prop met an edge stone on w3 at chaos 0.2 - its lane's fault,
    // but a 54 cm stone standing 20 cm proud on the gentlest strip is the ground's): x 0.35 at chaos 0 .. 1 from chaos 0.8; the
    // count was already the chaos's (rocks). rockIn (the shader's twin) keeps the full size; only the meshes' stones scale
    const STONE_K = 0.35 + 0.65 * Math.min(1, K.chaos / 0.8);
    function stoneIn(i, j) {
      const R0 = rockIn(i, j, true), R = R0 ? [R0[0], R0[1], R0[2] * STONE_K] : null;
      if (!R || Math.abs(R[1]) + R[2] > halfW - 0.15 || R[0] < END_IN || R[0] > len - END_IN) return null;
      if (WAYS.length && waysAt(R[0], R[1])[1] > 0.3) return null;
      if (pHole > 0 && holesAt(R[0], R[1], 0)[0] > 0.005) return null;
      return R;
    }
    // -> [[u, v, R], ...] in the field's frame (render_world standRocks draws each 2R across, 1.1R tall, a third buried)
    function bigRocks() {
      const out = [];
      if (!(K.rocks > 0)) return out;
      for (let i = 0; i * 1.2 < len; i++) for (let j = Math.floor(-halfW / 1.2); j * 1.2 < halfW; j++) { const R = stoneIn(i, j); if (R) out.push(R); }
      return out;
    }
    // THE STONES' BODIES (the user, 9 Nov 21:55: "on the collision model ... any very simple volume that will collide nicely
    // ... you shouldn't have like 10 centimeters difference"): what stands of a stone over the ground, a paraboloid cap -
    // STONE_H R high at its middle (1.1 R tall, a third of it buried), 0 at R, the sides 2 STONE_H (56 deg) at the foot: no
    // point or edge a wheel balances on, inside the drawn stone's rounded outline by at most ~0.2 x its height. On the
    // composed ground, not in the raster (27_premises stonesAt; its 0.25 m lattice would flatten a 14 cm stone to a few cm)
    function stoneUV(u, v) {
      if (!(K.rocks > 0) || u <= 0 || u >= len || v <= -halfW || v >= halfW) return 0;
      const R = stoneIn(Math.floor(u / 1.2), Math.floor(v / 1.2));
      if (!R) return 0;
      const q2 = ((u - R[0]) * (u - R[0]) + (v - R[1]) * (v - R[1])) / (R[2] * R[2]);
      return q2 < 1 ? STONE_H * R[2] * (1 - q2) : 0;
    }
    function rockAt(u, v) {
      let best = 0;
      for (const big of [true, false]) { const M = big ? 1.2 : 0.3, R = rockIn(Math.floor(u / M), Math.floor(v / M), big);
        if (R) { const r = Math.hypot(u - R[0], v - R[1]) / R[2]; if (r < 1) best = Math.max(best, R[2] * 0.6 * Math.sqrt(1 - r * r)); } }
      return best;
    }
    // THE LUMPS (DEEPER): two octaves of value noise at 3.5 and 1.8 m, `lumps` at their crest
    const lumpsAt = (u, v) => lA * (0.65 * vnoise(u / 3.5, v / 3.5, seed + 301) + 0.35 * vnoise(u / 1.8, v / 1.8, seed + 302));
    // THE RELIEF (what the eye reads: pavement.js pvRelief, the same terms): the roughness, the holes and the hazards with
    // their tapers - not the crown and not the lanes (the lanes are the tyre marks' own look) - 0 outside the box
    function reliefUV(u, v) {
      if (u <= 0 || u >= len || v <= -halfW || v >= halfW) return 0;
      const eT = ss(0, END_IN, u) * ss(0, END_IN, len - u), dT = ss(EDGE_IN[0], EDGE_IN[1], halfW - Math.abs(v));
      let r = 0;
      if (dT > 0) { if (K.gd > 0) for (let k = 0; k < OCT.length; k++) r += amp[k] * vnoise(u / OCT[k], v / OCT[k], seed + 101 + k); if (swA > 0) r += swA * (0.7 * vnoise(u / 25, v / 25, seed + 201) + 0.3 * vnoise(u / 12, v / 12, seed + 202)); if (lA > 0) r += lumpsAt(u, v); r = dT * (r - holesAt(u, v, 0)[0]); }
      if (HZ.length) r += ss(0, 0.5, halfW - Math.abs(v)) * hazardsAt(u, v, 0)[0];
      return r * eT;
    }
    // dh at (u, v): 0 outside the box
    function atUV(u, v) {
      if (u <= 0 || u >= len || v <= -halfW || v >= halfW) return 0;
      const eT = ss(0, END_IN, u) * ss(0, END_IN, len - u);
      if (eT <= 0) return 0;
      let h = crownS * (halfW * halfW - v * v) / (2 * halfW);
      const dT = ss(EDGE_IN[0], EDGE_IN[1], halfW - Math.abs(v));
      if (dT > 0) {
        let r = 0;
        if (K.gd > 0) for (let k = 0; k < OCT.length; k++) r += amp[k] * vnoise(u / OCT[k], v / OCT[k], seed + 101 + k);
        if (swA > 0) r += swA * (0.7 * vnoise(u / 25, v / 25, seed + 201) + 0.3 * vnoise(u / 12, v / 12, seed + 202));
        if (lA > 0) r += lumpsAt(u, v);
        const rut = rutD > 0 ? rutD * lanes(v) * (0.7 + 0.3 * vnoise(u / 23, 0.5, seed + 7)) : 0;
        h += dT * (r - rut + waysAt(u, v)[0] - holesAt(u, v, 0)[0]);
      }
      if (HZ.length) h += ss(0, 0.5, halfW - Math.abs(v)) * hazardsAt(u, v, 0)[0];
      return h * eT;
    }
    // the ceiling: the crown's top + every octave's amplitude (the ruts and the holes only go down)
    const bound = crownS * halfW / 2 + amp.reduce((s, a) => s + a, 0) + swA + hzUp + lA + WAYS.reduce((m, W) => m + 2 * W[3] * W[2], 0) + (K.rocks > 0 ? STONE_H * 0.27 : 0) + 1e-6;   // (+ the swell's crest, + the highest hazard bump, + the lumps, + every berm, + the tallest stone)
    // the box in the caller's frame (for the modifier's bbox and its tiles)
    const corners = [[0, -halfW], [len, -halfW], [len, halfW], [0, halfW]].map(([u, v]) => [x0 + cs * u - sn * v, z0 + sn * u + cs * v]);
    const bbox = { x0: Math.min(...corners.map(q => q[0])), z0: Math.min(...corners.map(q => q[1])), x1: Math.max(...corners.map(q => q[0])), z1: Math.max(...corners.map(q => q[1])) };
    // does a rectangle of the caller's frame reach the box? (its corners' u, v range against the box: conservative)
    const touches = (ax, az, bx, bz) => {
      let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
      for (const [x, z] of [[ax, az], [bx, az], [ax, bz], [bx, bz]]) { const q = toUV(x, z); u0 = Math.min(u0, q[0]); u1 = Math.max(u1, q[0]); v0 = Math.min(v0, q[1]); v1 = Math.max(v1, q[1]); }
      return !(u1 < 0 || u0 > len || v1 < -halfW || v0 > halfW);
    };
    return {
      K, bbox, bound, touches, halfW, len, seed, pHole, pudOK,
      at: (x, z) => { const q = toUV(x, z); return atUV(q[0], q[1]); },
      atUV,
      // standing water (m) at (x, z) for a soil wetness 0..1
      puddleAt: (x, z, wet) => {
        if (pudOK <= 0 || !(wet > 0)) return 0;
        const q = toUV(x, z), fill = Math.max(0, Math.min(1, (wet - 0.25) / 0.6)) * K.puddles * pudOK;
        if (fill <= 0 || q[0] <= 0 || q[0] >= len || Math.abs(q[1]) >= halfW) return 0;
        return Math.max(holesAt(q[0], q[1], fill)[1], hazardsAt(q[0], q[1], fill)[1], rutWater(q[0], q[1], fill));
      },
      hole, lanes, ways: WAYS, waysAt, rockAt, rockIn, bigRocks, stoneIn, stoneUV, stoneAt: (x, z) => { const q = toUV(x, z); return stoneUV(q[0], q[1]); }, toUV, reliefUV, hazards: HZ, a1: amp[OCT.length - 1],
    };
  }
  // THE LIVE LIST (what a world composed): compose publishes its micro strips (in the WORLD frame: { toLocal, f }) by
  // its record's id; at / puddleAt read every published one. An island without a micro strip publishes nothing.
  const live = new Map();
  function publish(key, list) { if (list && list.length) live.set(key, list); else live.delete(key); }
  function at(x, z) { for (const L of live.values()) for (const s of L) { const q = s.toLocal(x, z); const b = s.f.bbox; if (q[0] >= b.x0 && q[0] <= b.x1 && q[1] >= b.z0 && q[1] <= b.z1) { const h = s.f.at(q[0], q[1]); if (h !== 0) return h; } } return 0; }
  function puddleAt(x, z, wet) { if (!(wet > 0)) return 0; for (const L of live.values()) for (const s of L) { const q = s.toLocal(x, z); const b = s.f.bbox; if (q[0] >= b.x0 && q[0] <= b.x1 && q[1] >= b.z0 && q[1] <= b.z1) { const w = s.f.puddleAt(q[0], q[1], wet); if (w > 0) return w; } } return 0; }
  // has(id): a published strip of that id is bumpy (render_world refines its ribbon to REFINE_MIN: pavement.js refineAxis)
  function has(id) { for (const L of live.values()) for (const s of L) if (s.id === id) return true; return false; }
  // rocksOf(id): a published strip's mesh stones, [u, v, R] in its field's frame (the ribbon's v is the field's flipped)
  function rocksOf(id) { for (const L of live.values()) for (const s of L) if (s.id === id) return s.f.bigRocks ? s.f.bigRocks() : []; return []; }
  // the drawn ribbon's finest rows (pavement.js refineAxis): 0.3 m along (the lumps' 1.8 m), 5 cm across (a rut's wall: 8 cm drew the
  // walls 2 cm off the wheels' ground, p99 20 mm on w7 at chaos 0.8; 5 cm halves the spans to 4.7 cm there, p99 8 mm, 283 k vertices
  // on that 1020 m strip against 196 k, +0.3 s to build it - the cost named, a strip with chaos only)
  const REFINE_MIN = 0.3, REFINE_MIN_V = 0.05;
  // a stone's body over the ground, x its R (1.1 R tall, a third buried: 0.733); stoneAt(x, z): the published strips' (the viewer's)
  const STONE_H = 1.1 * (1 - 1 / 3);
  function stoneAt(x, z) { for (const L of live.values()) for (const s of L) { const q = s.toLocal(x, z); const b = s.f.bbox; if (q[0] >= b.x0 && q[0] <= b.x1 && q[1] >= b.z0 && q[1] <= b.z1) { const h = s.f.stoneAt(q[0], q[1]); if (h > 0) return h; } } return 0; }
  // glslRow(id): the pavement shader's uMicro, uMicro2 for a published strip - [seed, hole probability (float32), hole depth m,
  // puddles x the grade's own, the 1 m octave's amplitude (the others x sqrt of their wavelength), hazards, hazard size m,
  // 1 + the swell m] and uMicro3 [the ways' ruts m, the lumps m, cart + 2 path (the ways the field built), rocks] - pavement.js
  // pvPuddle / pvRelief / pvWays / pvRockIn read exactly these; null when the strip is flat
  function glslRow(id) { for (const L of live.values()) for (const s of L) if (s.id === id) { const f = s.f; return [f.seed, f.pHole, f.K.holeDepth / 100, f.K.puddles * f.pudOK, f.a1, f.K.hazards, f.K.hazardSize / 100, 1 + f.K.swell / 100,
    f.K.ruts / 100, f.K.lumps / 100, (f.ways.some(W => W[7] === 1) ? 1 : 0) + (f.ways.some(W => W[7] === 2) ? 2 : 0), f.K.rocks]; } return null; }
  return { KNOBS, on, resolve, derive, field, ih, vnoise, publish, at, puddleAt, has, rocksOf, stoneAt, STONE_H, glslRow, live, CELL, OCT, EDGE_IN, END_IN, REFINE_MIN, REFINE_MIN_V, BERM };
})();
