// _approach_lib.js - THE APPROACH CENSUS (ISLAND-TOUR, G1965): every landing direction of every land strip of a world
// against everything that stands under its final - the ground, the trees the aeroplane can hit and every solid thing
// the game registers - for tools/approach_census.js and GATE TOUR.
//
// The user (2026-10-05): "The ultimate test of PILOT-ONE should be to do a full tour of the island's locations in one
// go ... You have the authority to modify the strips, their approach paths, their U-turn zones". The runway model
// (25_airfield.js siteRunwayModel) already scores a direction by the slope its cone needs, but its cone is a crude
// three-sample corridor (the strip's width + 25 m each side, the tallest tree within 20 m of each sample) that reads a
// sidehill beside Jumbo Mine Street as a 27 % approach. This census is the honest version of the same question, for
// the author: per direction,
//   THE SURFACE  an obstacle clearance surface from an inner edge 60 m out at the threshold's height, rising at `slope` (1:20
//                on a strip of 600 m and more, 1:15 under - G527.3's East Point rule, the backcountry's), its inner
//                edge the strip's width + 15 m a side, diverging 10 % a side, out to `reach` (3 km; 1.5 km under 600 m)
//   THE THINGS   the terrain (sampled every 25 m along and every 8 m across), the FOREST the page's fill plants there
//                (the tree map's TREE class where treeAeroBlocked and the premises' tree excludes allow, at the map's canopy, >= 10 m), the woodland's
//                trees (world.trees - the
//                ones the solver tests in node, placed where the fill may plant: one rule, GATE RWYTREES 5) at their
//                tops (16 m x the placed scale, canopyH's), and every cooked structure (_taxiclear_lib's islandObstacles:
//                houses, items, outbuildings, props, cars, parked aeroplanes) at its top
//   THE VERDICT  the worst penetration of the surface (> 0: the thing stands through it) and the thing; the pilot's own
//                final (the nominal 1:17.5 slope, 5.7 %, crossing the threshold at the 15 m screen) and its least
//                clearance over everything in the corridor; and the departure the other way off the far end (the same
//                surface, the climb's), reported
// Trees are the author's to cut (an approach fan: an exclude of trees off the strip's end); the ground is not.
'use strict';
const path = require('path');

function corridorOf(a, k, R) {
  // k = 0 lands along -hdg over thr1, k = 1 along +hdg over thr0 (siteRunwayModel's)
  const sg = k === 0 ? -1 : 1, u = [R.dx * sg, R.dz * sg], n = [-u[1], u[0]];
  const thr = k === 0 ? R.thr1 : R.thr0, far = k === 0 ? R.end0 : R.end1;
  return { u, n, thr: [thr.x, thr.z], far: [far.x, far.z] };
}

// opts: { obstacles (shapes from _taxiclear_lib), slope, reach, gsPilot, screen }
function censusDir(C, W, a, k, opts) {
  const o = opts || {};
  const R = C.siteRunway(a);
  const short = R.len < 600;
  const slope = o.slope || (short ? 1 / 15 : 1 / 20), reach = o.reach || (short ? 1500 : 3000);
  const gsP = o.gsPilot || 0.057, screen = o.screen ?? 15;
  const K = corridorOf(a, k, R);
  const floor = (x, z) => { const t = W.terrainH(x, z), w = W.waterH ? W.waterH(x, z) : -Infinity; return w > t ? w : t; };
  const thrH = floor(K.thr[0], K.thr[1]);
  const ISL = W.island && W.island.effClass && W.island.WC ? W.island : null;
  const PO = W.premises && W.premises.overlay;
  const inner = R.wid / 2 + 15;
  const halfAt = d => inner + 0.10 * d;
  // the inner edge 60 m out (ICAO's: the ground between it and the threshold is the runway strip's - a crossfall, a
  // shoulder - and is held to the threshold's height + 4 m instead: nothing a wheel 15 m up over the bar meets)
  const surf = d => (d < 60 ? thrH + 4 : thrH + slope * (d - 60));
  const path = d => thrH + screen + gsP * d;
  let worst = { p: -Infinity }, pilot = { c: Infinity };
  const consider = (d, h, what, x, z) => {
    if (d < 0 || d > reach) return;
    const p = h - surf(d);
    if (p > worst.p) worst = { p, d, h, what, x, z };
    const c = path(d) - h;
    if (c < pilot.c) pilot = { c, d, h, what, x, z };
  };
  // the ground
  for (let d = 0; d <= reach; d += 25) {
    const hw = halfAt(d);
    for (let c = -hw; c <= hw + 1e-6; c += Math.max(4, hw / 6)) {
      const x = K.thr[0] - K.u[0] * d + K.n[0] * c, z = K.thr[1] - K.u[1] * d + K.n[1] * c;
      const g = floor(x, z);
      consider(d, g, 'ground', x, z);
      // THE FILL'S FOREST: the page plants a tree wherever the tree map says TREE and the runways' clearances and the
      // premises' excludes allow (treeAeroBlocked - GATE RWYTREES 5's one rule), at the map's canopy height (>= 10 m)
      if (ISL && ISL.effClass(x, z) === ISL.WC.TREE && !(W.treeAeroBlocked && W.treeAeroBlocked(x, z)) && !(PO && PO.excludeAt && PO.excludeAt(x, z, 'trees')))
        consider(d, g + Math.max(10, ISL.canopyAt(x, z) || 0), 'forest', x, z);
    }
  }
  // the trees and the structures, within the corridor
  const local = (x, z) => { const dx = x - K.thr[0], dz = z - K.thr[1]; return [-(dx * K.u[0] + dz * K.u[1]), dx * K.n[0] + dz * K.n[1]]; };
  const near = [];
  const box = (d, c) => d >= 0 && d <= reach && Math.abs(c) <= halfAt(d);
  for (let d = 0; d <= reach; d += 50) {
    const x = K.thr[0] - K.u[0] * d, z = K.thr[1] - K.u[1] * d;
    W.treesNear(x, z, near);
    for (const i of near) {
      const t = W.trees[i]; if (!t || t._seen === a.id + k) continue; t._seen = a.id + k;
      const L = local(t.x, t.z); if (!box(L[0], L[1])) continue;
      consider(L[0], W.terrainH(t.x, t.z) + 16 * t.s, 'tree', t.x, t.z);
    }
  }
  for (const s of o.obstacles || []) {
    const L = local(s.x, s.z);
    if (L[0] < -s.r || L[0] > reach + s.r || Math.abs(L[1]) > halfAt(Math.max(0, L[0])) + s.r) continue;
    const y0 = isFinite(s.y0) ? s.y0 : W.terrainH(s.x, s.z);
    consider(Math.max(0, L[0] - (s.r || 0)), y0 + (s.top || 0), s.tag + ' ' + s.id, s.x, s.z);
  }
  const f = v => Math.round(v * 10) / 10;
  return { id: a.id, k, slope, reach, thrH: f(thrH), worst: worst.p === -Infinity ? null : { p: f(worst.p), d: f(worst.d), h: f(worst.h), what: worst.what, at: [f(worst.x), f(worst.z)] },
           pilot: { gs: gsP, c: f(pilot.c), d: f(pilot.d), what: pilot.what, at: [f(pilot.x), f(pilot.z)] }, ok: !(worst.p > 0) };
}

// the directions a strip is landed in: a one-way strip its named one (landHdg), else both
function landDirs(C, a) {
  if (typeof a.landHdg !== 'number') return [0, 1];
  const R = C.siteRunway(a);
  const ux = Math.cos(a.landHdg), uz = Math.sin(a.landHdg);
  return [(ux * R.dx + uz * R.dz) >= 0 ? 1 : 0];
}
function takeoffDirs(C, a) {
  // the take-off direction: takeoffHdg, else an altiport downhill (the reverse of the landing), else both
  const R = C.siteRunway(a);
  const h = typeof a.takeoffHdg === 'number' ? a.takeoffHdg : (a.altiport && typeof a.landHdg === 'number' ? a.landHdg + Math.PI : null);
  if (h === null) return [0, 1];
  return [(Math.cos(h) * R.dx + Math.sin(h) * R.dz) >= 0 ? 1 : 0];
}
// the climb-out of a take-off in direction T (1 along +hdg, over end1): the corridor of the landing that comes the other
// way over that end (k = 1 - T... k 0 lands along -hdg over thr1, so its corridor runs out past end1 - the climb's)
function censusClimb(C, W, a, T, opts) {
  return Object.assign(censusDir(C, W, a, T === 1 ? 0 : 1, opts), { climb: true, T });
}
function census(C, W, opts) {
  const rows = [];
  for (const a of W.aerodromes) {
    if (a.water || a.kind === 'water') continue;
    for (const k of landDirs(C, a)) rows.push(Object.assign({ name: a.name, what: 'approach' }, censusDir(C, W, a, k, opts)));
  }
  return rows;
}
// the top of what stands at (x, z) in the census's model: the ground (or the water), the fill's forest where it may
// plant (the map's canopy, >= 10 m) - the tour reads it under the aeroplane on every final and climb-out
function obstTop(W, x, z) {
  const t = W.terrainH(x, z), w = W.waterH ? W.waterH(x, z) : -Infinity, g = w > t ? w : t;
  const ISL = W.island && W.island.effClass && W.island.WC ? W.island : null, PO = W.premises && W.premises.overlay;
  if (ISL && ISL.effClass(x, z) === ISL.WC.TREE && !(W.treeAeroBlocked && W.treeAeroBlocked(x, z)) && !(PO && PO.excludeAt && PO.excludeAt(x, z, 'trees')))
    return { h: g + Math.max(10, ISL.canopyAt(x, z) || 0), what: 'forest', g };
  return { h: g, what: 'ground', g };
}
module.exports = { obstTop, census, censusDir, censusClimb, landDirs, takeoffDirs, corridorOf };
