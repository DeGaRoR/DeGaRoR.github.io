// ============================================================
// THE VERTICAL PROFILE (G2125 PILOT-PROFILE, 2026-10-07). The user, flying the game's autopilot: "when the autopilot
// goes over mountains, it keeps diving and climbing, like its perspective on relief is very short. A real flight
// would probably be scheduled as climbing, target altitude, then descent and approach. Since the trip is
// deterministic, I don't think it should be too hard. It's good that it can react though, but shouldn't prevent it
// from flying a clean route." ... "the autopilot initial angle at take off feels quite off. In the Jodel, it will try
// and climb so hard that it will almost stall." ... "Is the autopilot aware of trees ...? That would be nice to have
// it have a rough perception of obstacles, without making it a monster."
//
// THE ONE ALTITUDE PLANNER (A0's ruling: PILOT-PROFILE owns it, ROUTE-DRAW uses it, there is no second planner).
// Pure, no THREE, no state of its own: the pilot (43_pilot.js) calls it when it starts a list of legs and keeps the
// answer for the flight of those legs - nothing here runs per frame.
//
//   VPROFILE.climbSpeeds(sheet, A, o)   the take-off climb's speeds and attitude limit, off the machine sheet:
//        Vs     the stall in the configuration flown (o.flap: the flap as set, 0..1 of the landing setting's lift -
//               the measured clean and landing stalls, interpolated)
//        Vfloor 1.3 Vs - the climb never flies slower (the textbook margin; Vx = 0.87 Vy = 1.2 Vs is under it)
//        Vy, Vx the sheet's (genAP's 1.38 Vs and 0.87 of it), raised to 1.05 Vfloor
//        cap    the steepest attitude a climb is allowed: the trim attitude at Vfloor (o.alphaAt) + the climb's
//               flight-path angle there (1.15 x the measured gradient) + 2 deg - a full-power climb at the floor
//               speed and no more; a person's over-rotation (o.extra) rides on top
//   VPROFILE.obstAbove(world, x, z, r)  the tallest thing standing within r of (x, z), metres above the ground: the
//        woodland's trees (world.canopyH), the island's canopy map (outside the runways' cleared fans), the solid
//        objects (world.obstacles: houses, props, parked aeroplanes) and the trunks the viewer registered
//        (world.treeHits). Rough on purpose: a corridor query sampled every 100 m, never per frame
//   VPROFILE.topAt(world, x, z, r)      the surface (the terrain or the water over it) + obstAbove
//   VPROFILE.plan(world, legs, perf, o) THE PROFILE over a list of legs ({ A: [x, z], B: [x, z], name, hB? }):
//        the corridor's tops sampled along the route (o.step, 100 m; o.halfW either side, 300 m), each leg's
//        MINIMUM EN-ROUTE ALTITUDE (the highest top over the whole leg and o.look past its end, + perf.margin),
//        and the height to fly at every sample:
//          'trip'  (no leg asks a height) CLIMB, CRUISE, DESCENT: the cruise clears the highest top of the whole
//                  route by the margin (perf.hMin at least); the climb from perf.h0 at perf.gClimb (the top of
//                  climb, toc); the descent onto perf.hEnd at perf.gDesc, reaching it o.endLevel before the end
//                  (the top of descent, tod), held up by any top still ahead (never under a ridge to come) and
//                  steepened to perf.gDescMax at most. The profile rises, then falls: NO REVERSAL by construction
//          'drawn' (a leg carries hB, the height the drawing asks at its B, MSL): the drawing's ramp from point to
//                  point, raised to each leg's MEA, then the climbs moved EARLIER (a backward pass at gClimb: the
//                  height a ridge asks is reached before it, not on it) and the descents held to gDescMax
//        Returns { mode, n, ds, L, s[], top[], h[], legs: [{ name, s0, s1, mea, top }], cruise, toc, tod, minClear,
//        climbLimited: null | { s, h, need } (where the climb cannot make the floor - the pilot's reactive guard
//        and the escape fan take that part), hEnd } - or null without a world.
//   VPROFILE.at(P, s)                   the planned height at s metres along the route (linear between samples)
//   VPROFILE.legS(P, i, sLeg)           the route's s for sLeg metres along leg i
//   VPROFILE.reversals(hs, band)        the altitude reversals in a sampled height series (a swing past `band`
//        metres from the last extreme the other way counts one) - the gates' porpoise meter
// ============================================================
const VPROFILE = (() => {
  'use strict';
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // ---- the take-off climb's speeds ----------------------------------------------------------------------------
  function climbSpeeds(S, A, o) {
    o = o || {};
    A = A || {};
    const Vs1 = (S && S.Vs) || (A.VRot ? A.VRot / 0.99 : 18);
    const Vs0 = (S && S.Vs0) || Vs1;
    // the flap as set, as a fraction of the landing setting the measured Vs0 was taken at (a build without a landing
    // flap - the Cub, the Jodel: Vs0 is Vs1 - flies the clean stall whatever the lever says)
    const ldg = o.flapLdg > 0 ? o.flapLdg : 1;
    const fk = Vs0 < Vs1 ? clamp((o.flap || 0) / ldg, 0, 1) : 0;
    const Vs = Vs1 - (Vs1 - Vs0) * fk;
    const Vfloor = (o.stallK || 1.3) * Vs;
    const Vy0 = (S && S.Vy) || A.VClimb || 1.38 * Vs1;
    const Vx0 = (S && S.Vx) || 0.87 * Vy0;
    // (5 % over the floor at least: a target ON the floor is under it half the time)
    const Vy = Math.max(Vy0, 1.05 * Vfloor), Vx = Math.max(Vx0, 1.05 * Vfloor);
    const gam = clamp(((S && S.gammaClimb) || 0.08) * 1.15, 0.02, 0.30);
    const aF = typeof o.alphaAt === 'function' ? o.alphaAt(Vfloor) : (A.thMax ?? 0.2) * 0.6;
    const cap = clamp(aF + Math.atan(gam) + 0.035, 0.10, 0.32) + (o.extra || 0);
    return { Vs, Vfloor, Vy, Vx, cap };
  }

  // ---- the rough perception -------------------------------------------------------------------------------------
  const _near = [];
  function surfaceAt(world, x, z) {
    const t = world.terrainH(x, z);
    const w = typeof world.waterH === 'function' ? world.waterH(x, z) : -Infinity;
    return w > t ? w : t;
  }
  function obstAbove(world, x, z, r) {
    if (!world || typeof world.terrainH !== 'function') return 0;
    r = r || 20;
    const g = world.terrainH(x, z);
    let top = 0;
    // the woodland's trees (the solver's cylinders where the world stands them: 16 m per unit of placed scale)
    if (typeof world.canopyH === 'function') top = Math.max(top, world.canopyH(x, z, r));
    // the island's canopy map (WorldCover's heights) - a cleared runway fan has no tree, whatever the map says
    const I = world.island;
    if (I && typeof I.canopyAt === 'function') {
      const blk = typeof world.treeAeroBlocked === 'function' ? world.treeAeroBlocked : null;
      for (let k = 0; k < 5; k++) {
        const px = x + (k === 1 ? r : k === 2 ? -r : 0), pz = z + (k === 3 ? r : k === 4 ? -r : 0);
        if (blk && blk(px, pz)) continue;
        const h = I.canopyAt(px, pz);
        if (h > top) top = h;
      }
    }
    // the solid objects (houses, props, the parked aeroplanes): their column grid's top
    const O = world.obstacles;
    if (O && typeof O.near === 'function' && O.count) {
      O.near(x, z, _near);
      for (const id of _near) {
        const R = O.get(id);
        if (!R) continue;
        const d = Math.hypot(R.x - x, R.z - z) - (R.shape.xr || 0);
        if (d > r) continue;
        const h = R.y0 + R.shape.top - g;
        if (h > top) top = h;
      }
    }
    // the trunks the viewer registered (the forest fill it draws): the crown over the trunk's top (0.5..0.8 of the
    // tree's height, TREE_HITS.trunkOf) - 0.65 taken
    const T = world.treeHits;
    if (T && T.list && T.count) {
      for (const S of T.list) {
        if (x + r < S.x0 || x - r > S.x1 || z + r < S.z0 || z - r > S.z1) continue;
        const A = S.arr, a0 = Math.max(0, Math.floor((x - r) / S.cell) - S.cx0), a1 = Math.min(S.nx - 1, Math.floor((x + r) / S.cell) - S.cx0);
        const b0 = Math.max(0, Math.floor((z - r) / S.cell) - S.cz0), b1 = Math.min(S.nz - 1, Math.floor((z + r) / S.cell) - S.cz0);
        for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) {
          const c = b * S.nx + a;
          for (let j = S.start[c], j1 = S.start[c + 1]; j < j1; j++) {
            const q = S.idx[j] * 5, dx = A[q] - x, dz = A[q + 1] - z;
            if (dx * dx + dz * dz > r * r) continue;
            const h = A[q + 2] + (A[q + 4] - A[q + 2]) / 0.65 - g;
            if (h > top) top = h;
          }
        }
      }
    }
    return top;
  }
  function topAt(world, x, z, r) { return surfaceAt(world, x, z) + obstAbove(world, x, z, r); }

  // ---- the profile ------------------------------------------------------------------------------------------------
  function plan(world, legs, perf, o) {
    if (!world || typeof world.terrainH !== 'function' || !legs || !legs.length) return null;
    o = o || {};
    perf = perf || {};
    const ds = o.step || 100, halfW = o.halfW ?? 300, look = o.look ?? 1500, rObs = o.rObs ?? 40;
    const margin = perf.margin ?? 130;
    const gClimb = Math.max(0.01, perf.gClimb ?? 0.06), gDesc = Math.max(0.01, perf.gDesc ?? 0.05);
    const gDescMax = Math.max(gDesc, perf.gDescMax ?? 0.10);
    // the route as a polyline: each leg's start s0 and end s1
    const L = [];
    let sTot = 0;
    for (const Lg of legs) {
      if (!Lg || !Lg.A || !Lg.B) continue;
      const dx = Lg.B[0] - Lg.A[0], dz = Lg.B[1] - Lg.A[1], len = Math.hypot(dx, dz);
      L.push({ name: Lg.name || '', A: Lg.A, B: Lg.B, ux: len > 1e-6 ? dx / len : 1, uz: len > 1e-6 ? dz / len : 0, len, s0: sTot, s1: sTot + len,
               hB: Number.isFinite(Lg.hB) ? Lg.hB : null, hA: Number.isFinite(Lg.hA) ? Lg.hA : null });
      sTot += len;
    }
    if (!L.length) return null;
    const n = Math.max(2, Math.ceil(sTot / ds) + 1), dS = sTot / (n - 1);
    const s = new Float64Array(n), top = new Float64Array(n);
    const across = [-halfW, -halfW / 2, 0, halfW / 2, halfW];
    const topLine = (x, z, ux, uz) => {
      let h = -Infinity;
      for (const c of across) { const px = x - uz * c, pz = z + ux * c; const t = topAt(world, px, pz, rObs); if (t > h) h = t; }
      return h;
    };
    let k = 0;
    for (let i = 0; i < n; i++) {
      const si = Math.min(sTot, i * dS);
      while (k < L.length - 1 && si > L[k].s1) k++;
      const Lg = L[k], d = si - Lg.s0;
      s[i] = si;
      top[i] = topLine(Lg.A[0] + Lg.ux * d, Lg.A[1] + Lg.uz * d, Lg.ux, Lg.uz);
    }
    // the floor: the tops + the margin - easing to perf.marginEnd over the route's last o.taper metres (an arrival
    // comes down to its circuit, whose own height planArrival set over the pattern's ground)
    const marginEnd = perf.marginEnd ?? margin, taper = o.taper ?? 0;
    const mAt = si => (taper > 0 && sTot - si < taper) ? marginEnd + (margin - marginEnd) * Math.max(0, sTot - si) / taper : margin;
    const F = new Float64Array(n);
    for (let i = 0; i < n; i++) F[i] = top[i] + mAt(s[i]);
    // each leg's MEA: the highest floor over the leg and `look` past its end (along the leg: the turn onto the next
    // and the overshoot of it; o.lookLast for the route's last leg, whose end is the arrival's business)
    for (let j = 0; j < L.length; j++) {
      const Lg = L[j];
      let t = -Infinity, m = -Infinity;
      for (let i = 0; i < n; i++) if (s[i] >= Lg.s0 - 1 && s[i] <= Lg.s1 + 1) { t = Math.max(t, top[i]); m = Math.max(m, F[i]); }
      const lk = j === L.length - 1 ? (o.lookLast ?? look) : look;
      for (let d = ds; d <= lk; d += ds) { const tl = topLine(Lg.B[0] + Lg.ux * d, Lg.B[1] + Lg.uz * d, Lg.ux, Lg.uz); t = Math.max(t, tl); m = Math.max(m, tl + margin); }
      Lg.top = t; Lg.mea = m;
    }
    const legOf = i => { let j = 0; while (j < L.length - 1 && s[i] > L[j].s1) j++; return j; };
    const h = new Float64Array(n);
    const drawn = L.some(Lg => Lg.hB != null);
    const h0 = Number.isFinite(perf.h0) ? perf.h0 : F[0];
    const hEnd = Number.isFinite(perf.hEnd) ? perf.hEnd : (drawn ? (L[L.length - 1].hB ?? F[n - 1]) : F[n - 1]);
    let cruise = null, toc = null, tod = null;
    if (!drawn) {
      // THE TRIP: climb, cruise, descent
      let Fmax = -Infinity;
      for (const Lg of L) Fmax = Math.max(Fmax, Lg.mea);
      cruise = Math.max(Fmax, perf.hMin ?? -Infinity, hEnd);
      const endLevel = o.endLevel ?? 800;
      const R = new Float64Array(n);               // the highest floor still ahead
      R[n - 1] = F[n - 1];
      for (let i = n - 2; i >= 0; i--) R[i] = Math.max(F[i], R[i + 1]);
      for (let i = 0; i < n; i++) {
        const C = Math.min(cruise, h0 + gClimb * s[i]);
        const D = hEnd + gDesc * Math.max(0, sTot - endLevel - s[i]);
        h[i] = Math.min(C, Math.max(D, Math.min(R[i], cruise)));
        if (h[i] < hEnd && h[i] < C) h[i] = Math.min(C, hEnd);
      }
      for (let i = 1; i < n; i++) if (h[i] < h[i - 1] - gDescMax * dS) h[i] = h[i - 1] - gDescMax * dS;
      for (let i = 0; i < n; i++) if (toc == null && h[i] >= cruise - 1) toc = s[i];
      for (let i = n - 1; i >= 0; i--) if (h[i] >= cruise - 1) { tod = s[i]; break; }
    } else {
      // A DRAWN PROFILE: the drawing's ramp, raised to each leg's MEA, the climbs moved earlier, the descents held
      for (let i = 0; i < n; i++) {
        const j = legOf(i), Lg = L[j];
        const hA = Lg.hA != null ? Lg.hA : j ? (L[j - 1].hB ?? h0) : h0, hB = Lg.hB != null ? Lg.hB : hA;
        const f = Lg.len > 1e-6 ? clamp((s[i] - Lg.s0) / Lg.len, 0, 1) : 1;
        h[i] = Math.max(hA + (hB - hA) * f, Lg.mea);
      }
      for (let i = n - 2; i >= 0; i--) if (h[i] < h[i + 1] - gClimb * dS) h[i] = h[i + 1] - gClimb * dS;
      for (let i = 1; i < n; i++) if (h[i] < h[i - 1] - gDescMax * dS) h[i] = h[i - 1] - gDescMax * dS;
    }
    // what the plan clears, and where the climb cannot make the floor (the start, from perf.h0)
    let minClear = Infinity, lim = null;
    for (let i = 0; i < n; i++) {
      minClear = Math.min(minClear, h[i] - top[i]);
      const reach = h0 + gClimb * s[i];
      if (h[i] < F[i] - 1 && (!lim || F[i] - h[i] > lim.need - lim.h)) lim = { s: Math.round(s[i]), h: Math.round(h[i]), need: Math.round(F[i]), reach: Math.round(reach) };
    }
    return { mode: drawn ? 'drawn' : 'trip', n, ds: dS, L: sTot, s, top, h, margin,
             legs: L.map(Lg => ({ name: Lg.name, s0: Lg.s0, s1: Lg.s1, len: Lg.len, mea: Math.round(Lg.mea), top: Math.round(Lg.top) })),
             cruise: cruise != null ? Math.round(cruise) : null, toc: toc != null ? Math.round(toc) : null, tod: tod != null ? Math.round(tod) : null,
             minClear: Math.round(minClear), climbLimited: lim, h0: Math.round(h0), hEnd: Math.round(hEnd) };
  }
  function at(P, sq) {
    if (!P) return null;
    if (sq <= 0) return P.h[0];
    if (sq >= P.L) return P.h[P.n - 1];
    const f = sq / P.ds, i = Math.min(P.n - 2, Math.floor(f)), a = f - i;
    return P.h[i] + (P.h[i + 1] - P.h[i]) * a;
  }
  function legS(P, i, sLeg) {
    if (!P || !P.legs.length) return 0;
    const Lg = P.legs[clamp(i, 0, P.legs.length - 1)];
    return Lg.s0 + clamp(sLeg, -Lg.len, 2 * Lg.len);
  }
  // the porpoise meter: an extreme confirmed when the height has come back `band` metres from it
  function reversals(hs, band) {
    band = band || 10;
    let n = 0, dir = 0, ext = null;
    for (const v of hs) {
      if (ext == null) { ext = v; continue; }
      if (dir === 0) { if (Math.abs(v - ext) > band) { dir = Math.sign(v - ext); ext = v; } }
      else if ((v - ext) * dir > 0) ext = v;
      else if ((ext - v) * dir > band) { n++; dir = -dir; ext = v; }
    }
    return n;
  }
  return { climbSpeeds, obstAbove, topAt, surfaceAt, plan, at, legS, reversals };
})();
