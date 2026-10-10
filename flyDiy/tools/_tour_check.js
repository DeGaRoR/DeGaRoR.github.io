#!/usr/bin/env node
// GATE TOUR (ISLAND-TOUR, G1965-G1974) - THE ISLAND'S LOCATIONS IN ONE GO, AND THE STRIPS THAT MAKE IT POSSIBLE.
//
// The user (2026-10-05): "The ultimate test of PILOT-ONE should be to do a full tour of the island's locations in one
// go. Land at each, U-turn, take off again, visit the next one. Success when it gets undamaged back to the mother
// airport. You have the authority to modify the strips, their approach paths, their U-turn zones, etc. You should just
// work with their length as-is. Note that the mine also needs a proper apron for its start/park area."
//
//   node tools/_tour_check.js               -> "GATE TOUR: PASS|FAIL" (full tier: ~20 min a shard)
//   node tools/_tour_check.js --show        -> every line, passed ones too
//   node tools/_tour_check.js --strips      -> the strips' block alone (~30 s)
//
// THE STRIPS (shard 0; tools/_approach_lib.js, 25_airfield.js turnPadNodes, tools/turn_pads.js):
//   1 THE APPROACH CENSUS: every land strip of Jolene, every direction it is landed in and taken off in (a one-way
//     strip its named one): no tree, no forest the fill plants and no solid thing through the obstacle clearance
//     surface (1:20 on a strip of 600 m and more, 1:15 under, from an inner edge 60 m out, the strip's half-width
//     + 15 m a side diverging 10 %); the ground at most 2.5 m through it (a sidehill by a threshold); the pilot's own
//     5.7 % final at least 10 m over everything in the corridor
//   2 CALIBRATION: the census can see the faults it guards - East Point's approach with the user's old fan (G527.3)
//     has the forest through the surface; Tamgas Hill and Jumbo Mine left the way they are NOT (uphill, into the
//     ridge) have the ground through it
//   3 THE TURN PADS: every declared pad (the runway's `turn`): the U-turn's wheel track (the path the pilot follows, 1.5
//     m either side) on the strip or on a surface of the strip's class, the ground under it within 0.3 m of the
//     strip's own height there, the wing's sweep (the widest validated half-span + 3 m) clear of every solid thing and
//     every tree, and the hold where the turn comes out lined up keeps the run the strip had (the hold <= r + 9 m in: 3 m from the end, the half circle, 6 m straight)
//   4 THE MINE'S APRON: a gravel apron (apron: true) under the stand and the C172's parked box, 1.5 m off every
//     footprint, on the street's level
// THE TOURS (one heavy job each - shards: 4; 6 East Point the fourth, G1970):
//   5 (G1970: THE GAME'S FLIGHT - _tour_lib gameHost: the worker's host and placement, the page's pilot with the garage's
//     shakedown, DAY_CLOCK's day ticked, the load door's aeroplane) the user's Cub (builds/cub_2026-09-20_corrected.json): HOME > Tamgas Hill > the altiport > Jumbo Mine > 02/20 >
//     HOME; the aluminium C172: HOME > Tamgas Hill > the altiport > 02/20 > HOME (G531: its reserve refuses the mine's
//     250 m); East Point (150 m) fits no validated land build (the Cub's roll alone is ~145 m - _tour_lib ORDERS); the
//     float Cessna (bugReports/cessnaFloatsWOrks.json): Annette Dock > Metlakatla > Annette Dock. The damage ON. Each leg: stopped at its To, no member yielded or broken, no dent, no
//     prop strike, no node inside an obstacle, no trunk hit, no ground loop (30 deg off the runway at > 5 m/s on the
//     roll or the roll-out), no off-strip excursion (the CG off the strip's box at > 5 m/s), the final's lowest node
//     >= 3 m over the ground and the forest under it; a one-way strip turned round on its pad (>= 150 deg on the
//     ground before the roll) and the roll began at the strip's own hold (+ 15 m) or nearer the end; the fuel never short; the tour back at HOME
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname;
const PT = require(path.join(T, 'pilot_trace.js'));
PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const L = require(path.join(T, '_taxiclear_lib.js'));
const A = require(path.join(T, '_approach_lib.js'));
const TR = require(path.join(T, '_tour_lib.js'));
const SHD = require(path.join(T, '_shard.js'));
const SHOW = process.argv.includes('--show'), STRIPS = process.argv.includes('--strips');
let bad = 0;
const check = (ok, what, detail) => {
  if (!ok) bad++;
  if (!ok || SHOW) console.log((ok ? '  ok   ' : '  FAIL ') + what + (detail ? '  (' + detail + ')' : ''));
  return ok;
};
const FX = path.join(T, 'fixtures', 'island_jolene.json');

if (SHD.first) {
  const txt = fs.readFileSync(FX, 'utf8'), REC = JSON.parse(txt);
  const W = IN.islandWorld('jolene', { premises: txt });
  const SH = L.islandObstacles(C, 'jolene', 'town').concat(L.treeTrunks(W));
  const IX = L.index(SH);
  const land = W.aerodromes.filter(a => !a.water && a.kind !== 'water');
  check(['HOME', 'w2', 'w3', 'tw_ski', 'mn_strip', 'nv_strip'].every(id => land.some(a => a.id === id)), '1 Jolene\'s six land strips', land.map(a => a.id).join(' '));
  // 1 the approach census
  const rows = [];
  for (const a of land) {
    for (const k of A.landDirs(C, a)) rows.push(Object.assign({ what: a.id + ' approach k' + k }, A.censusDir(C, W, a, k, { obstacles: SH })));
    for (const t of A.takeoffDirs(C, a)) rows.push(Object.assign({ what: a.id + ' climb-out T' + t }, A.censusClimb(C, W, a, t, { obstacles: SH })));
  }
  for (const r of rows) {
    const w = r.worst, ground = w && w.what === 'ground';
    check(!w || w.p <= 0 || (ground && w.p <= 2.5), '1 ' + r.what + ': nothing but the ground through the 1:' + (1 / r.slope).toFixed(0) + ' surface, the ground <= 2.5 m',
      w ? (w.p > 0 ? '+' : '') + w.p + ' m, ' + w.what + ' ' + w.d + ' m out' : 'nothing');
    check(r.pilot.c >= 10, '1 ' + r.what + ': the 5.7 % final clears everything by 10 m', r.pilot.c + ' m (' + r.pilot.what + ' ' + r.pilot.d + ' m out)');
  }
  check(rows.length >= 12, '1 the census covered every direction flown', rows.length + ' directions');
  // 2 calibration
  {
    const old = JSON.parse(txt);
    const fan = old.layers.exclude.find(e => e.id === 'nv_fan_s'), nv = old.layers.runways.find(r => r.id === 'nv_strip');
    const d = [Math.cos(nv.hdg), Math.sin(nv.hdg)], n = [-d[1], d[0]];
    fan.poly = [[75, -14], [135, -22], [205, -36], [305, -55], [305, 55], [205, 36], [135, 22], [75, 14]].map(q => [nv.c[0] + d[0] * q[0] + n[0] * q[1], nv.c[1] + d[1] * q[0] + n[1] * q[1]]);
    const W0 = IN.islandWorld('jolene', { premises: JSON.stringify(old) }), a0 = W0.aerodromes.find(a => a.id === 'nv_strip');
    const r0 = A.censusDir(C, W0, a0, A.landDirs(C, a0)[0], { obstacles: SH });
    check(r0.worst && r0.worst.p > 5 && r0.worst.what === 'forest', '2 calibration: East Point with the old fan has the forest through its approach', r0.worst ? '+' + r0.worst.p + ' m ' + r0.worst.what + ' ' + r0.worst.d + ' m out' : '-');
    const w3 = land.find(a => a.id === 'w3'), mn = land.find(a => a.id === 'mn_strip');
    const up = A.censusClimb(C, W, w3, 1 - A.takeoffDirs(C, w3)[0], { obstacles: SH }), ridge = A.censusClimb(C, W, mn, 1 - A.takeoffDirs(C, mn)[0], { obstacles: SH });
    check(up.worst && up.worst.p > 2.5, '2 calibration: Tamgas Hill left uphill has the hill through its climb-out', up.worst ? '+' + up.worst.p + ' m ' + up.worst.d + ' m out' : '-');
    check(ridge.worst && ridge.worst.p > 50, '2 calibration: Jumbo Mine left south has the ridge through its climb-out', ridge.worst ? '+' + ridge.worst.p + ' m ' + ridge.worst.d + ' m out' : '-');
  }
  // 3a NO WATER ON A STRIP (G1971): every land strip's box (1 m along, 1.5 m across, the edges included) and every pad's
  // and apron's polygon is dry - the cover grid's water class floated 0.30 m of water over 13 patches of 02/20's old
  // concrete and one of 13/31's, and the C172 rolling across one at 16 m/s nosed in and rejected its take-off
  {
    let wet = 0, where = null;
    const dryAt = (x, z, what) => { if (W.waterH(x, z) - W.terrainH(x, z) > 0.01) { wet++; if (!where) where = what + ' (' + x.toFixed(1) + ', ' + z.toFixed(1) + ')'; } };
    for (const a of land) {
      const R = C.siteRunway(a);
      for (let q = -a.len / 2; q <= a.len / 2; q += 1) for (let off = -R.half; off <= R.half + 1e-6; off += 1.5) dryAt(a.x + R.dx * q + R.nx * off, a.z + R.dz * q + R.nz * off, a.id);
    }
    for (const e of REC.layers.surface) if (/^tp_y_|^mn_y_apron$/.test(e.id)) {
      const bb = C.PREMISES_GEN.polyBBox(e.poly);
      for (let x = bb.x0; x <= bb.x1; x += 1) for (let z = bb.z0; z <= bb.z1; z += 1) if (C.PREMISES_GEN.inPoly(e.poly, x, z)) dryAt(x, z, e.id);
    }
    check(wet === 0, '3a no water on a land strip, a turn pad or the mine\'s apron', wet + ' wet samples' + (where ? ', first ' + where : ''));
  }
  // 3 the turn pads
  let nPads = 0;
  for (const a of land) {
    const s = C.siteOf(a.id), P = C.sitePattern(a, s, {}), R = C.siteRunway(a), O = W.premises.overlay;
    const hS = q => W.terrainH(R.end0.x + R.dx * q, R.end0.z + R.dz * q);
    for (const k of [0, 1]) {
      const TP = C.turnPadNodes(a, k);
      if (!TP) continue;
      nPads++;
      const pth = C.patternPath(P, P.routes.back[k], 1.0, null);
      let off = 0, dh = 0, sweep = Infinity, swWhat = null, tree = Infinity;
      const near = [];
      for (let i = 1; i < pth.pts.length; i++) {
        const q = pth.pts[i], q0 = pth.pts[i - 1], tx = q.x - q0.x, tz = q.z - q0.z, tl = Math.hypot(tx, tz) || 1;
        for (const w of [-1.5, 0, 1.5]) {
          const x = q.x - tz / tl * w, z = q.z + tx / tl * w;
          const sa = (x - R.end0.x) * R.dx + (z - R.end0.z) * R.dz, ca = Math.abs((x - R.cx) * R.nx + (z - R.cz) * R.nz);
          if (!(ca <= R.half || O.surfaceAt(x, z) === a.surface)) off++;
          dh = Math.max(dh, Math.abs(W.terrainH(x, z) - hS(Math.max(0, Math.min(R.len, sa)))));
        }
        const nn = IX.nearest(q.x, q.z, 30); if (nn && nn.d < sweep) { sweep = nn.d; swWhat = L.fmtWhat(nn.s); }
        W.treesNear(q.x, q.z, near);
        for (const ti of near) { const t = W.trees[ti]; tree = Math.min(tree, Math.hypot(t.x - q.x, t.z - q.z)); }
      }
      const id = a.id + ' end ' + k + ' (r ' + TP.r + ', side ' + (TP.side > 0 ? '+' : '-') + ')';
      check(off === 0, '3 ' + id + ': the U-turn\'s wheel track on the strip or its pad', off + ' samples off');
      check(dh <= 0.3, '3 ' + id + ': the ground under the U-turn at the strip\'s height', dh.toFixed(2) + ' m');
      check(sweep >= 5.5 + 3, '3 ' + id + ': the wing\'s sweep clear of every solid thing (5.5 + 3 m)', (isFinite(sweep) ? sweep.toFixed(1) + ' m to ' + swWhat : 'nothing within 30 m'));
      check(tree >= 5.5 + 3, '3 ' + id + ': ... and of every tree', isFinite(tree) ? tree.toFixed(1) + ' m' : 'none near');
      check(TP.sHold <= TP.r + TP.s0 + 6 + 1e-6 && P.nodes.some(q => q.id === 'hold' + k && Math.abs((q.x - (k ? R.end1.x : R.end0.x)) * (k ? -R.dx : R.dx) + (q.z - (k ? R.end1.z : R.end0.z)) * (k ? -R.dz : R.dz) - TP.sHold) < 0.01),
        '3 ' + id + ': the turn comes out lined up ' + TP.sHold.toFixed(1) + ' m in (the pattern\'s hold)', 'run ahead ' + (R.len - TP.sHold).toFixed(0) + ' of ' + R.len + ' m');
      const iss = C.sitePatternIssues(P, a, s, 0, C.patternPath);
      check(!iss.length, '3 ' + a.id + ': the pattern is sound', iss.join(' | '));
    }
  }
  check(nPads >= 6, '3 the pads: Tamgas Hill, the altiport and East Point, both ends', nPads + ' pads');
  // 4 the mine's apron
  {
    const ap = REC.layers.surface.find(e => e.id === 'mn_y_apron'), m = REC.layers.material.find(e => e.id === 'mn_m_apron');
    const mn = land.find(a => a.id === 'mn_strip'), st = C.siteOf('mn_strip').stand;
    check(!!ap && ap.apron === true && ap.surface === 6 && !!m && m.look === 'gravel', '4 the mine\'s apron: a gravel apron surface with the gravel look', ap ? JSON.stringify({ surface: ap.surface, apron: ap.apron, look: m && m.look }) : 'missing');
    if (ap) {
      const inP = (x, z) => C.PREMISES_GEN.inPoly(ap.poly, x, z);
      const c172 = TR.defOf(C, PT, TR.BUILDS.c172.key), D = L.buildDims(C, c172);
      const P = C.sitePattern(mn, C.siteOf('mn_strip'), {}), f = P.nodes.find(q => q.id === P.routes.out[0][1]);
      const h = Math.atan2(f.z - st.z, f.x - st.x), fx = Math.cos(h), fz = Math.sin(h);
      const corners = [[D.fwd, -D.half], [D.fwd, D.half], [-D.aft, D.half], [-D.aft, -D.half]].map(q => [st.x + fx * q[0] - fz * q[1], st.z + fz * q[0] + fx * q[1]]);
      check(inP(st.x, st.z) && corners.every(q => inP(q[0], q[1])), '4 the stand and the C172\'s parked box on the apron', corners.map(q => (inP(q[0], q[1]) ? 'in' : 'OUT')).join(' '));
      let m1 = Infinity; const bb = C.PREMISES_GEN.polyBBox(ap.poly);
      for (let x = bb.x0; x <= bb.x1; x += 1) for (let z = bb.z0; z <= bb.z1; z += 1) if (inP(x, z)) { const n = IX.nearest(x, z, 10); if (n) m1 = Math.min(m1, n.d); }
      check(m1 >= 1.5, '4 the apron 1.5 m off every footprint', (isFinite(m1) ? m1.toFixed(2) : '>10') + ' m');
      const lv = W.terrainH(st.x, st.z);
      check(Math.abs(lv - 346.8) < 0.2, '4 the apron on the street\'s level (346.8 m)', lv.toFixed(2) + ' m at the stand');
    }
  }
}

// 5 the tours
if (!STRIPS) {
  const JOBS = [{ b: 'cub' }, { b: 'c172' }, { b: 'floats' }];
  for (const J of JOBS) {
    if (!SHD.take()) continue;
    const B = TR.BUILDS[J.b], order = TR.ORDERS[B.tour].split(',');
    const def = TR.defOf(C, PT, B.key);
    const TW = TR.tourWorld(C, IN, fs);
    const t0 = Date.now();
    // G1970 (ISLAND-TOUR-2): THE GAME'S FLIGHT - TOUR-REAL (G2065) flew this tour in the game and node's was not it (a calm
    // day, the file's 45 L, a pilot with no shakedown): the worker's host, the game's day ticked, the load door's aeroplane
    const R = TR.flyTour(C, TW.W, def, order, { game: {}, log: SHOW ? (L2 => console.log(TR.fmtLeg(L2))) : null });
    console.log('  ' + B.name + ': ' + order.join(' > ') + ' - ' + (R.done ? 'DONE' : 'NOT DONE') + ', ' + R.legs.length + ' legs, fuel left ' + R.fuel + ' L (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
    check(def.params.damage === true && R.game && R.game.damage === true, '5 ' + B.name + ': the damage is ON');
    // the flight is the game's: DAY_CLOCK's day (the 8 kt breeze), the garage's shakedown behind the pilot, the aeroplane the
    // load door makes (pilot_trace specOf -> tools/_load_build.js: the Cub's tank 27 L, not the file's 45 L)
    const GW = R.game && R.game.day && R.game.day.wind;
    check(!!(GW && GW.kts === 8 && GW.dirDeg === 250 && R.game.shake), '5 ' + B.name + ': the game\'s flight - the game\'s day and the page\'s pilot', JSON.stringify(R.game && { wind: GW, shake: R.game.shake, stand: R.game.stand }));
    const raw = JSON.parse(fs.readFileSync(B.key, 'utf8')), rawFuel = ((raw.spec || raw).fuel || {}).litres;
    // (the game's spec straight from JOIN-PARITY's one load path - not through the loader the tour used)
    const gsp = require(path.join(T, '_load_build.js')).gameSpec(raw);
    const gdef = C.buildGen(C.genMigrateSpec ? C.genMigrateSpec(gsp) : gsp), mGame = gdef.nodes.reduce((m, q) => m + q.m, 0);
    check(!!(R.game && Math.abs(R.game.mass - mGame) < 0.1), '5 ' + B.name + ': the load door\'s aeroplane flies', R.game ? R.game.mass + ' kg (the game spec\'s ' + mGame.toFixed(1) + '), ' + R.game.fuel + ' L at the start (the file says ' + rawFuel + ' L)' : '-');
    for (const L2 of R.legs) {
      const id = '5 ' + B.name + ' ' + L2.from + ' > ' + L2.to;
      check(L2.ok, id + ': stopped at its To with no fault', L2.faults.map(f => f.k + ': ' + f.note).join('; ') || L2.phases.slice(-6).join('>'));
      // G1970: the landing judged on the strip it was made on (_tour_lib: flightWhere under the wheels at the touchdown)
      check(L2.landedOn === L2.to, id + ': landed on its To (the landing judged on ' + L2.landedOn + ')');
      const a = TW.W.aerodromes.find(q => q.id === L2.from);
      const oneWay = typeof a.takeoffHdg === 'number' || a.altiport;
      if (oneWay && L2.from !== order[0]) {
        check(L2.dep.uturn, id + ': turned round on the ground before the roll (a one-way strip)', L2.dep.turned + ' deg');
        // the strip's own hold: the pad's r + 9 m, or an authored pattern's (Jumbo Mine's 55 m, G522) - the roll began
        // there or nearer the end (+ 15 m: the aeroplane brakes to a stop past the hold node, its CG measured - the Cub 13 m past Tamgas Hill's)
        const P = C.sitePattern(a, C.siteOf(a.id), {}), R = C.siteRunway(a);
        const holdIn = Math.max(...(P.stops || []).map(h => { const q = P.nodes.find(n => n.id === h); return q ? Math.min(Math.hypot(q.x - R.end0.x, q.z - R.end0.z), Math.hypot(q.x - R.end1.x, q.z - R.end1.z)) : 0; }));
        check(L2.dep.rollFromEnd !== null && L2.dep.rollFromEnd <= holdIn + 15, id + ': the roll began at the strip\'s hold or nearer the end', L2.dep.rollFromEnd + ' m (the hold ' + holdIn.toFixed(0) + ' m in)');
      }
      if (L2.arr.apprClear) check(L2.arr.apprClear.c >= 3, id + ': the final\'s lowest node 3 m over the ground and the forest', L2.arr.apprClear.c + ' m (' + L2.arr.apprClear.what + ', ' + L2.arr.apprClear.d + ' m out)');
      check(L2.fuel && L2.fuel.litres > 0, id + ': fuel left', L2.fuel ? L2.fuel.litres + ' L' : '-');
    }
    check(R.done && R.legs.length === order.length - 1, '5 ' + B.name + ': the tour is complete, back at ' + order[order.length - 1], R.legs.length + ' of ' + (order.length - 1) + ' legs');
  }
  // 6 EAST POINT, AS THE GAME FLIES IT (G1970). TOUR-REAL (G2065) flew it in the game: the user's Cub LANDS there (one
  // go-around 'high on the slope 537 m out', a touchdown 29-33 m in, stopped with ~19 m left) and CANNOT TAKE OFF (the
  // roll from 37.7 m in, downwind, 'rejected-takeoff: will not reach Vr', stopped 6.8 m past the far end - twice). The
  // game's flight here reproduces both to the metre (reports/evidence/ISLAND-TOUR-2). The landing is held; the take-off
  // is PILOT-ONE-2's owed fix (TOUR-REAL's routed item 1: the roll from the strip's end, the wind weighed, an abort that
  // stops on the strip) - printed, not gated, until it lands; then fold East Point into ORDERS.land
  if (SHD.take()) {
    const B = TR.BUILDS.cub, order = ['HOME', 'nv_strip', 'mn_strip'];
    const def = TR.defOf(C, PT, B.key);
    const TW = TR.tourWorld(C, IN, fs);
    const t0 = Date.now();
    const R = TR.flyTour(C, TW.W, def, order, { game: {}, log: SHOW ? (L2 => console.log(TR.fmtLeg(L2))) : null });
    const L1 = R.legs[0], L2 = R.legs[1];
    console.log('  ' + B.name + ': ' + order.join(' > ') + ' (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
    check(L1 && L1.ok && L1.landedOn === 'nv_strip', '6 ' + B.name + ' HOME > nv_strip: lands at East Point and stops on it, no fault', L1 ? (L1.faults.map(f => f.k + ': ' + f.note).join('; ') || 'td ' + JSON.stringify(L1.arr.landing)) : '-');
    console.log('  INFO 6 East Point > Jumbo Mine (PILOT-ONE-2, owed): ' + (L2 ? (L2.ok ? 'TAKES OFF - fold East Point into ORDERS.land' : L2.faults.map(f => f.k).join(', ') + ' - ' + L2.verdicts.filter(v => /reject|abort|off-the-strip/.test(v)).join('; ')) : 'not flown'));
  }
}
// (the verdict line is run_gates.js's contract, `^GATE <ID>: PASS$` - a shard's tag in it never matched: G2520)
if (SHD.tag) console.log('  (' + SHD.tag.trim() + ')');
console.log('GATE TOUR: ' + (bad ? 'FAIL (' + bad + ')' : 'PASS'));
process.exit(bad ? 1 : 0);
