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
  const KNOBS = ['chaos', 'crown', 'rut', 'holes', 'holeDepth', 'puddles', 'hazards', 'hazardSize', 'seed'];
  // what chaos derives when a knob is left out (crown in %, rut and holeDepth in cm, holes per 100 m)
  // (hazards: the user, 9 Nov via A0 - "a couple of really random things that are better to be avoided, but that are avoidable
  // too, like big bumps": 0 under chaos 0.15, 1 to 0.5, 2 to 0.8, 3 above; hazardSize in cm)
  const derive = c => ({ crown: 1.5 + 1.0 * c, rut: 6 * c, holes: c < 0.25 ? 0 : 14 * (c - 0.25), holeDepth: 4 + 12 * c, puddles: 0,
    hazards: c < 0.15 ? 0 : c < 0.5 ? 1 : c < 0.8 ? 2 : 3, hazardSize: 12 + 14 * c });
  const FLEET_MEAN = 1.098;                 // pavement.js PV_FLEET_MEAN: the lanes' half-track
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
    o.hazards = Math.round(pick('hazards', 0, 4)); o.hazardSize = pick('hazardSize', 0, 40);
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
    const sig = 0.35 + 0.05 * halfW;
    const pHole = Math.fround(Math.min(0.95, K.holes * CELL / 100 / 2));   // two candidates a cell
    const pudOK = K.puddles > 0 ? 1 - ss(0.015, 0.03, Math.abs(grade || 0)) : 0;
    // a cell's hole m (0, 1): null or [u, v, R, depth]
    function hole(i, m) {
      if (pHole <= 0 || ih(i, m, seed + 11) >= pHole) return null;
      const R = 0.5 + 0.6 * ih(i, m, seed + 12), u = (i + 0.15 + 0.7 * ih(i, m, seed + 13)) * CELL;
      const lim = halfW - EDGE_IN[1] - R;
      if (lim <= 0 || u < END_IN + R || u > len - END_IN - R) return null;
      let v;
      if (ih(i, m, seed + 14) < 0.667) { const side = ih(i, m, seed + 15) < 0.5 ? -1 : 1; v = side * FLEET_MEAN + (ih(i, m, seed + 16) - 0.5) * 2 * sig; }
      else v = (ih(i, m, seed + 16) - 0.5) * 2 * lim;
      v = Math.max(-lim, Math.min(lim, v));
      return [u, v, R, holeD * (0.5 + 0.5 * ih(i, m, seed + 17))];
    }
    // the holes' depth below the surface at (u, v), and the water a fill puts in them
    function holesAt(u, v, fill) {
      if (pHole <= 0) return [0, 0];
      const ic = Math.floor(u / CELL); let d = 0, w = 0;
      for (let i = ic - 1; i <= ic + 1; i++) for (let m = 0; m < 2; m++) {
        const H = hole(i, m); if (!H) continue;
        const du = u - H[0], dv = v - H[1], r2 = du * du + dv * dv;
        if (r2 >= H[2] * H[2]) continue;
        const b = H[3] * 0.5 * (1 + Math.cos(Math.PI * Math.sqrt(r2) / H[2]));
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
      let R = 1.2 + 1.0 * ih(j, 0, seed + 32);
      const room = halfW - 0.5 - 0.3 - 2 * R;
      if (room < 0) R = (halfW - 0.8) / 2;
      if (R < 0.6) continue;
      const u = Math.max(END_IN + R, Math.min(len - END_IN - R, len * (0.15 + 0.7 * (j + 0.2 + 0.6 * ih(j, 0, seed + 31)) / K.hazards)));
      const side = ih(j, 0, seed + 35) < 0.5 ? -1 : 1, v = side * (0.3 + R + Math.max(0, room) * ih(j, 0, seed + 36));
      const h = K.hazardSize / 100 * (0.7 + 0.3 * ih(j, 0, seed + 34)) * (ih(j, 0, seed + 33) < 0.6 ? 1 : -1);
      HZ.push([u, v, R, h]);
    }
    const hzUp = HZ.reduce((m, H) => Math.max(m, H[3]), 0);
    // the hazards at (u, v): their height (signed), and the water a fill puts in the holes
    function hazardsAt(u, v, fill) {
      let h = 0, w = 0;
      for (const H of HZ) {
        const du = u - H[0], dv = v - H[1], r2 = du * du + dv * dv;
        if (r2 >= H[2] * H[2]) continue;
        const b = H[3] * 0.5 * (1 + Math.cos(Math.PI * Math.sqrt(r2) / H[2]));
        h += b;
        if (fill > 0 && H[3] < 0) w = Math.max(w, -b - (1 - fill) * -H[3]);
      }
      return [h, w];
    }
    function lanes(v) { const a = (Math.abs(v) - FLEET_MEAN) / sig, b = v / (sig * 0.8); return Math.max(Math.exp(-a * a), 0.55 * Math.exp(-b * b)); }
    // THE RELIEF (what the eye reads: pavement.js pvRelief, the same terms): the roughness, the holes and the hazards with
    // their tapers - not the crown and not the lanes (the lanes are the tyre marks' own look) - 0 outside the box
    function reliefUV(u, v) {
      if (u <= 0 || u >= len || v <= -halfW || v >= halfW) return 0;
      const eT = ss(0, END_IN, u) * ss(0, END_IN, len - u), dT = ss(EDGE_IN[0], EDGE_IN[1], halfW - Math.abs(v));
      let r = 0;
      if (dT > 0) { if (K.gd > 0) for (let k = 0; k < OCT.length; k++) r += amp[k] * vnoise(u / OCT[k], v / OCT[k], seed + 101 + k); r = dT * (r - holesAt(u, v, 0)[0]); }
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
        const rut = rutD > 0 ? rutD * lanes(v) * (0.7 + 0.3 * vnoise(u / 23, 0.5, seed + 7)) : 0;
        h += dT * (r - rut - holesAt(u, v, 0)[0]);
      }
      if (HZ.length) h += ss(0, 0.5, halfW - Math.abs(v)) * hazardsAt(u, v, 0)[0];
      return h * eT;
    }
    // the ceiling: the crown's top + every octave's amplitude (the ruts and the holes only go down)
    const bound = crownS * halfW / 2 + amp.reduce((s, a) => s + a, 0) + hzUp + 1e-6;   // (+ the highest hazard bump)
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
        return Math.max(holesAt(q[0], q[1], fill)[1], hazardsAt(q[0], q[1], fill)[1]);
      },
      hole, lanes, toUV, reliefUV, hazards: HZ, a1: amp[OCT.length - 1],
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
  const REFINE_MIN = 0.25;
  // glslRow(id): the pavement shader's uMicro, uMicro2 for a published strip - [seed, hole probability (float32), hole depth m,
  // puddles x the grade's own, the 1 m octave's amplitude (the others x sqrt of their wavelength), hazards, hazard size m,
  // 1] - pavement.js pvPuddle / pvRelief read exactly these; null when the strip is flat
  function glslRow(id) { for (const L of live.values()) for (const s of L) if (s.id === id) { const f = s.f; return [f.seed, f.pHole, f.K.holeDepth / 100, f.K.puddles * f.pudOK, f.a1, f.K.hazards, f.K.hazardSize / 100, 1]; } return null; }
  return { KNOBS, on, resolve, derive, field, ih, vnoise, publish, at, puddleAt, has, glslRow, live, CELL, OCT, EDGE_IN, END_IN, REFINE_MIN };
})();
