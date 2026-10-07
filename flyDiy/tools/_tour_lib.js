// _tour_lib.js - THE ISLAND TOUR (ISLAND-TOUR, G1965-G1974): one aeroplane, one pilot, every location of the island in
// one go - off HOME's stand, to each strip in a planned order (land, U-turn / backtrack, take off, the next To), and
// back to HOME - with the damage ON and the island's solid things in the world. tools/island_tour.js runs it and
// writes the evidence; GATE TOUR (tools/_tour_check.js) asserts it.
//
// The user (2026-10-05): "The ultimate test of PILOT-ONE should be to do a full tour of the island's locations in one
// go. Land at each, U-turn, take off again, visit the next one. Success when it gets undamaged back to the mother
// airport."
//
// THE RUN (the game's own multi-hop, W14 / sim_host 'leg': a fresh pilot and departFrom(cur, next) from where the
// aeroplane stopped - no reset, no teleport, the fuel burnt stays burnt):
//   the build       buildGen(genMigrateSpec(spec)), params.damage TRUE (every member can yield and break - G1898)
//   the world       Jolene (tools/fixtures/island_jolene.json), the woodland's trees as the solver tests them in node,
//                   every cooked solid thing within 700 m of a strip registered as the page registers it
//                   (_taxiclear_lib intoWorld: houses, items, outbuildings, props, cars, parked aeroplanes, trunks)
//   each leg        ap.update + sim.step at 1/60 s until the pilot has STOPPED at the To (or a hard end: ABORT, the
//                   budget given up, the crash's over, a NaN, the leg's time limit)
// WHAT A LEG RECORDS: the departure (the U-turn / backtrack before it - the heading turned through on the ground, the
// largest lateral excursion off the centreline -, where the roll began, the lift-off distance), the approach (the
// final's start, the least clearance of the aeroplane's lowest node over the ground and the forest under it -
// _approach_lib obstTop - inside 1.5 km of the threshold), the touchdown (the point past the threshold, the sink, the
// speed, off the centreline), the roll-out, and every fault: a member yielded or broken, a node inside an obstacle, a
// trunk hit, a ground loop (the nose 30 deg off the runway at > 5 m/s on the roll or the roll-out), an off-strip
// excursion (the CG off the strip's box at > 5 m/s on the ground), the fuel, the pilot's own verdicts.
'use strict';
const path = require('path');
const AP = require(path.join(__dirname, '_approach_lib.js'));
const TL = require(path.join(__dirname, '_taxiclear_lib.js'));

const GROUND = new Set(['DEPART', 'TAXI', 'STOP', 'HOLD', 'LINEUP', 'ROLL', 'ROLLOUT', 'STOPPED']);

// the tour's world: Jolene with the solid things near every land strip registered
function tourWorld(C, IN, fs, opt) {
  const o = opt || {};
  const txt = fs.readFileSync(o.fixture || process.env.TOUR_FIXTURE || path.join(__dirname, 'fixtures', 'island_jolene.json'), 'utf8');   // (a variant record: an experiment's)
  const W = IN.islandWorld('jolene', { premises: txt });
  const SH = TL.islandObstacles(C, 'jolene', o.variant || 'town').concat(TL.treeTrunks(W));
  let nO = 0, nT = 0;
  // one pass: everything within 700 m of a land strip (the trunks of all of them in one treeHits set)
  const keep = SH.filter(s => W.aerodromes.some(a => !a.water && a.kind !== 'water' && Math.hypot(s.x - a.x, s.z - a.z) - (s.r || 0) < 700 + a.len / 2));
  const put = TL.intoWorld(C, W, keep, 0, 0, Infinity);
  nO += put.obstacles; nT += put.trunks;
  return { W, obstacles: nO, trunks: nT, shapes: SH };
}

function stripFrame(a) {
  const ux = Math.cos(a.hdg), uz = Math.sin(a.hdg);
  return {
    s: (x, z) => (x - a.x) * ux + (z - a.z) * uz,          // along +hdg from the centre
    c: (x, z) => -(x - a.x) * uz + (z - a.z) * ux,          // across, +n
    ux, uz,
  };
}
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const r1 = v => Math.round(v * 10) / 10;
// the nose against the runway's axis, either way along it
const axisErr = (nose, hdg) => Math.min(Math.abs(wrap(nose - hdg)), Math.abs(wrap(nose - hdg - Math.PI)));

// fly one leg from `a` (where the aeroplane stands) to `b`; returns the leg's record
function flyLeg(C, W, sim, def, a, b, opt) {
  const o = opt || {};
  // THE GAME'S FLIGHT (G1970, o.host): the worker's own host (src/viewer/sim_host.js makeSimHost - the page's placement,
  // its pilot with the garage's shakedown and the nav, the day ticked every step) flies the leg; the first leg is the
  // host's own start (app.js applyRoute, then 'start'), every next one its 'leg' command (app.js nextLeg -> SIMW.leg)
  const H = o.host || null;
  let ap = H ? H.ap : C.makePilot(sim, def, W, { style: o.style || 'normal' });
  const L = { from: a.id, to: b.id, phases: [], verdicts: null, t: 0, ok: false, faults: [] };
  if (o.first) {
    if (H) H.queueCmd({ cmd: 'start' });   // placed on the walked stand and departing (makeSimHost place())
    else {
      // the flight's first departure: off the stand, the site's way out (the page's applyRoute)
      ap.setRoute(a, b);
      ap.departFrom(a, b, C.siteOf(a.id));
    }
  } else {
    // A CHAINED LEG, the page's own (DEST-TO G1945, app.js nextLeg): the To picked at STOPPED, the leg flightLeg derives -
    // the From UNDER THE AEROPLANE, not the last leg's To - and a fresh pilot's departFrom(from, to), no site, no reset
    const cg0 = sim.cgPos();
    const FL = typeof C.flightLeg === 'function' ? C.flightLeg(W, C.stripGear(def), cg0[0], cg0[2], b.id, { legFrom: a }) : { from: a, to: b, depart: true };
    L.where = FL.where ? { kind: FL.where.kind, at: FL.from && FL.from.id } : null;
    if (!FL.depart || !FL.from || FL.from.id !== a.id) L.faults.push({ k: 'where', note: 'flightLeg put the From at ' + (FL.from && FL.from.id) + ' (' + (FL.where && FL.where.kind) + '), not ' + a.id, t: 0 });
    if (H) H.queueCmd({ cmd: 'leg', from: (FL.from || a).id, to: (FL.to || b).id });
    else ap.departFrom(FL.from || a, FL.to || b);
  }
  const fault = (k, note) => { if (!L.faults.some(f => f.k === k)) L.faults.push({ k, note, t: r1(L.t) }); };
  const FA = stripFrame(a), FB = stripFrame(b);
  const D0 = sim.damage ? JSON.parse(JSON.stringify(sim.damage())) : null;
  const trunk0 = sim.trunkHits ? sim.trunkHits() : 0;
  const fuel0 = sim.fuel ? sim.fuel.litres : null;
  // the departure's ground run: heading turned, lateral excursion, the roll
  let hdgPrev = null, turned = 0, maxTurned = 0, latMax = 0, rollAt = null, liftAt = null, rollT = null;
  // the arrival: the final's start, the lowest clearance under it, the touchdown, the stop
  let finalAt = null, finalH = null, apprMin = { c: Infinity }, tdAt = null, stopAt = null;
  let gLoop = 0, offStrip = 0, obstSteps = 0, obstMax = 0, airborne = false, nan = false;
  let landB = null, FL = null;   // the strip really landed on, and its frame (G1970)
  const dt = 1 / 60, tMax = o.tMax || 1800;
  let k = 0, lastPhase = null;
  for (; k < tMax / dt; k++) {
    if (H) { H.step(); ap = H.ap; } else { ap.update(dt); sim.step(dt); }
    L.t += dt;
    const ph = ap.phase;
    if (ph !== lastPhase) { L.phases.push(ph); lastPhase = ph; }
    if (o.debug && L.t < o.debug && (k % 15) === 0 && o.debugLeg === L.from) {
      const cc = sim.ctl || {};
      console.log('    dbg2 t ' + L.t.toFixed(2) + ' pitch ' + (sim.out.pitch * 57.3).toFixed(1) + ' wheels ' + (sim.wheelsOnGround ? sim.wheelsOnGround() : '?') + ' obst ' + sim.out.obst + ' ctl ' + JSON.stringify(Object.fromEntries(Object.entries(cc).filter(e => typeof e[1] === 'number').map(e => [e[0], +e[1].toFixed(3)]))) + ' g ' + (sim.damage ? sim.damage().gPeak.toFixed(2) : ''));
    }
    if (o.debug && L.t < o.debug && (k % 30) === 0 && !o.debugLeg) {
      const v0 = sim.cgVel ? sim.cgVel() : [0, 0, 0], E = sim.eng && sim.eng[0];
      console.log('    dbg t ' + L.t.toFixed(1) + ' ' + ph + ' V ' + Math.hypot(v0[0], v0[2]).toFixed(2) + ' rpm ' + JSON.stringify(sim.out && sim.out.rpm) + ' ctl ' + JSON.stringify(sim.ctl ? { thr: sim.ctl.thr, brake: sim.ctl.brake, eng: sim.ctl.eng } : null).slice(0, 200) + ' eng ' + (E ? JSON.stringify({ running: E.running, seized: E.seized }) : '-') + ' fuel ' + (sim.fuel ? sim.fuel.litres.toFixed(1) + (sim.fuel.starved ? ' STARVED' : '') : ''));
    }
    const cg = sim.cgPos();
    if (!isFinite(cg[0]) || !isFinite(cg[1])) { nan = true; fault('nan', 'the solver went NaN'); break; }
    if (sim.out && sim.out.obst > 0) { obstSteps++; obstMax = Math.max(obstMax, sim.out.obst); }
    const xA = sim.axes()[0], nl = Math.hypot(xA[0], xA[2]) || 1e-9, nose = Math.atan2(-xA[2] / nl, -xA[0] / nl);
    const v = sim.cgVel ? sim.cgVel() : null, Vg = v ? Math.hypot(v[0], v[2]) : 0;
    const onG = sim.wheelsOnGround ? sim.wheelsOnGround() > 0 : (cg[1] - W.terrainH(cg[0], cg[2]) < 3);
    // ---- the departure (before the first lift-off)
    if (!airborne) {
      if (ph === 'TAXI' || ph === 'LINEUP' || ph === 'STOP' || ph === 'HOLD' || ph === 'DEPART') {
        if (hdgPrev !== null) { turned += wrap(nose - hdgPrev); maxTurned = Math.max(maxTurned, Math.abs(turned)); }
        hdgPrev = nose;
        if (Math.abs(FA.s(cg[0], cg[2])) < a.len / 2 + 5) latMax = Math.max(latMax, Math.abs(FA.c(cg[0], cg[2])));
      }
      if (ph === 'ROLL' && !rollAt) { rollAt = [cg[0], cg[2]]; rollT = L.t; }
      if ((ph === 'LIFTOFF' || ph === 'CLIMB') && !liftAt && rollAt) liftAt = [cg[0], cg[2]];
      if (liftAt && cg[1] - W.terrainH(cg[0], cg[2]) > 15) airborne = true;
      if (ph === 'ROLL' && Vg > 5) {
        const e = axisErr(nose, a.hdg);
        if (e > 30 / 57.3) { gLoop++; fault('ground-loop', 'the nose ' + r1(e * 57.3) + ' deg off the take-off run at ' + r1(Vg) + ' m/s'); }
        if (Math.abs(FA.c(cg[0], cg[2])) > a.wid / 2 || Math.abs(FA.s(cg[0], cg[2])) > a.len / 2 + 2) { offStrip++; fault('off-strip', 'the take-off roll left ' + a.id + "'s box"); }
      }
    }
    // ---- the arrival
    if (ph === 'FINAL' && !finalAt) { finalAt = [cg[0], cg[2]]; finalH = cg[1] - W.terrainH(cg[0], cg[2]); }
    if ((ph === 'FINAL' || ph === 'FLARE') && !tdAt) {
      const dThr = Math.hypot(cg[0] - b.x, cg[2] - b.z) - b.len / 2;
      if (dThr > 40 && dThr < 1500 && (k % 6) === 0) {
        // the aeroplane's lowest node over what stands under it
        let low = Infinity, lx = 0, lz = 0;
        for (let i = 0; i < sim.n; i++) { const y = sim.p[i * 3 + 1]; if (y < low) { low = y; lx = sim.p[i * 3]; lz = sim.p[i * 3 + 2]; } }
        const T = AP.obstTop(W, lx, lz), c = low - T.h;
        if (c < apprMin.c) apprMin = { c, d: dThr, what: T.what };
      }
    }
    // THE STRIP LANDED ON (G1970, ISLAND-TOUR-2): the landing is judged on the strip under the wheels at the touchdown,
    // not on the planned To - after a diversion the planned To's box is another field's (TOUR-REAL's phantom ground loops
    // and off-strip excursions: the w3 landing measured on East Point's 150 x 12 m box). The strip under the aeroplane
    // the first time it is on its wheels in the FLARE / ROLLOUT is 38b_dest flightWhere's (the page's own From)
    if ((ph === 'ROLLOUT' || ph === 'FLARE') && onG && airborne && !landB) {
      const wh = typeof C.flightWhere === 'function' ? C.flightWhere(W, cg[0], cg[2]) : null;
      landB = (wh && wh.aero && (wh.kind === 'runway' || wh.kind === 'water')) ? wh.aero : ((ap.route && ap.route.to) || b);
      FL = stripFrame(landB);
    }
    if (ph === 'ROLLOUT' && !tdAt) tdAt = [cg[0], cg[2]];
    if ((ph === 'ROLLOUT' || ph === 'FLARE') && onG && Vg > 5 && landB) {
      const e = axisErr(nose, landB.hdg);
      if (e > 30 / 57.3) { gLoop++; fault('ground-loop', 'the nose ' + r1(e * 57.3) + ' deg off the landing roll on ' + landB.id + ' at ' + r1(Vg) + ' m/s'); }
      if (Math.abs(FL.c(cg[0], cg[2])) > landB.wid / 2 || Math.abs(FL.s(cg[0], cg[2])) > landB.len / 2 + 2) { offStrip++; fault('off-strip', 'the landing roll left ' + landB.id + "'s box"); }
    }
    // ---- the ends
    const Dm = sim.damage ? sim.damage() : null;
    if (Dm && Dm.over) { fault('crash', 'the damage ended the flight: ' + (Dm.reason || '?')); break; }
    // G2450: a take-off the pilot DECLINED (43: the go / no-go at the hold) ends the leg where it stands - not a stop at the To
    if (ph === 'STOPPED' && ap.report && ap.report.outcome === 'declined') { fault('declined', (ap.report.verdicts.find(v => v.code === 'takeoff-declined') || {}).note || 'the take-off was declined'); break; }
    if (ph === 'STOPPED' && ap.route && ap.route.to === b && L.t > 20) { stopAt = [cg[0], cg[2]]; break; }
    if (ph === 'STOPPED' && ap.route && ap.route.to !== b && L.t > 60 && onG) { fault('diverted', 'stopped at ' + (ap.route.to && ap.route.to.id) + ', not ' + b.id); break; }
    if (ph === 'ABORT') { fault('abort', 'the take-off was rejected'); break; }
    // 'gave-up' is the pilot's verdict on its own patience (the budget), not an end: it keeps flying and lands - a warning
  }
  if (k >= tMax / dt) fault('timeout', 'the leg took over ' + tMax + ' s');
  // the ground loop on the roll-out, judged on the pilot's own number: the heading error the roll-out held
  const D = sim.damage ? sim.damage() : null;
  const dy = D && D0 ? D.yields - D0.yields : 0, db = D && D0 ? D.breaks - D0.breaks : 0;
  if (dy > 0) fault('yield', dy + ' member(s) yielded' + (D.firstYield ? ' (first: ' + JSON.stringify(D.firstYield) + ')' : ''));
  if (db > 0) fault('break', db + ' member(s) broke');
  if (D && D.propStrike && !(D0 && D0.propStrike)) fault('prop-strike', 'the propeller struck');
  if (D && D.dented && !(D0 && D0.dented)) fault('dent', 'the airframe dented');
  const dTrunk = (sim.trunkHits ? sim.trunkHits() : 0) - trunk0;
  if (dTrunk > 0) fault('trunk', dTrunk + ' trunk contact(s)');
  if (obstSteps > 0) fault('obstacle', 'a node inside an obstacle on ' + obstSteps + ' steps (max ' + obstMax + ' nodes)');
  const LD = ap.report.landing || null;
  L.verdicts = ap.report.verdicts.map(v => v.code + (v.note ? ': ' + v.note : ''));
  L.warnings = ap.report.verdicts.filter(v => /gave-up|divert|lineup-timeout|go-around|goaround|balk/i.test(v.code)).map(v => v.code + ' at ' + v.t + ' s');
  L.outcome = ap.report.outcome || null;
  L.dep = {
    turned: r1(maxTurned * 57.3), uturn: maxTurned > 150 / 57.3, latMax: r1(latMax),
    rollS: rollAt ? r1(a.len / 2 - Math.abs(FA.s(rollAt[0], rollAt[1]))) : null,      // the roll began this far from an end
    rollFromEnd: rollAt ? r1(Math.min(FA.s(rollAt[0], rollAt[1]) + a.len / 2, a.len / 2 - FA.s(rollAt[0], rollAt[1]))) : null,
    toDist: rollAt && liftAt ? r1(Math.hypot(liftAt[0] - rollAt[0], liftAt[1] - rollAt[1])) : null,
    taxiT: rollT !== null ? r1(rollT) : null,
  };
  L.arr = {
    final: finalAt ? { d: r1(Math.hypot(finalAt[0] - b.x, finalAt[1] - b.z) - b.len / 2), h: r1(finalH) } : null,
    apprClear: isFinite(apprMin.c) ? { c: r1(apprMin.c), d: r1(apprMin.d), what: apprMin.what } : null,
    td: tdAt ? { s: r1((FL || FB).s(tdAt[0], tdAt[1])), c: r1((FL || FB).c(tdAt[0], tdAt[1])) } : null,
    landing: LD, stopS: stopAt ? r1(FB.s(stopAt[0], stopAt[1])) : null,
  };
  L.landedOn = landB ? landB.id : null;   // the strip the landing was judged on (G1970: != L.to after a diversion)
  L.fuel = sim.fuel ? { litres: r1(sim.fuel.litres), burnt: r1(fuel0 - sim.fuel.litres) } : null;
  L.damage = D ? { yields: D.yields, breaks: D.breaks, dented: !!D.dented, crashed: !!D.crashed, gPeak: r1(D.gPeak || 0) } : null;
  L.groundLoop = gLoop; L.offStrip = offStrip; L.nan = nan;
  L.ok = !!stopAt && !L.faults.length;
  L.track = o.track || null;
  return L;
}

// the whole tour: `order` a list of aerodrome ids, the first the start (the aeroplane at its stand), the last the end
// `opt.game` (G1970, GATE TOUR's mode): THE GAME'S FLIGHT - the worker's host (gameHost) flies it from the page's own
// placement, on the game's day (gameDay, ticked every step) and the game's aeroplane (`def` is the game spec's build:
// tools/_load_build.js through pilot_trace specOf, JOIN-PARITY G1985); without it, the ISLAND-TOUR rig as it was (a
// calm, frozen day, the placement 600 steps on the authored stand, a pilot with no shakedown)
function flyTour(C, W, def, order, opt) {
  const o = opt || {};
  const A = id => W.aerodromes.find(q => q.id === id);
  const a0 = A(order[0]);
  let sim, H = null;
  if (o.game) {
    H = gameHost(C, W, def, a0, A(order[1]), o.game);
    sim = H.sim; def = H.def;
  } else {
    sim = C.makeSim(def, W); sim.reset(0); if (sim.stance) sim.stance();
    const st0 = C.siteOf(a0.id) && C.siteOf(a0.id).stand;
    if (st0) C.placeAtStand(sim, a0, st0); else C.placeAtAerodrome(sim, a0);
    for (let i = 0; i < 600; i++) sim.step(1 / 60);
  }
  const legs = [], track = [];
  const tick = () => { const cg = sim.cgPos(); track.push([r1(cg[0]), r1(cg[2]), r1(cg[1])]); };
  for (let i = 1; i < order.length; i++) {
    const a = A(order[i - 1]), b = A(order[i]);
    const t0 = track.length;
    // the track: a point every 2 s (the map); flyLeg steps the sim, so the sampler rides on a stepped proxy
    const step0 = sim.step;
    let n = 0;
    sim.step = (dt) => { step0(dt); if ((n++ % 120) === 0) tick(); };
    let L;
    try { L = flyLeg(C, W, sim, def, a, b, Object.assign({}, o, { first: i === 1, host: H })); } finally { sim.step = step0; }
    L.trackI = [t0, track.length];
    legs.push(L);
    if (o.log) o.log(L);
    if (!L.ok) break;
  }
  const done = legs.length === order.length - 1 && legs.every(L => L.ok);
  return { order, legs, track, done, fuel: sim.fuel ? r1(sim.fuel.litres) : null, game: H ? H.game : null };
}

// ---- THE GAME'S DAY, THE GAME'S PLACEMENT, THE GAME'S PILOT (G1970, ISLAND-TOUR-2) -------------------------------------
// TOUR-REAL (G2065) flew the tour in the game on the GPU and found node's tour was not the game's: a calm day against the
// game's 8 kt breeze, the build file's 45 L against the game's 27-29 L, and a faster, lower INBOUND. Each of the three is
// the page's own code run here, not a copy of it:
//   THE DAY        src/viewer/day_clock.js DAY_CLOCK.bind(world) - a new player's day (no pref, no URL): GAME_DAY, the
//                  'light breeze' 8 kt from 250 deg, 16:00 local on midsummer; ticked every step by the host (H.dayTick:
//                  world.dayTick(1/60, sim.t, the CG) - the worker's real-time clock), so the breeze, the sea breeze and
//                  the gusts are the game's at every sim.t
//   THE AEROPLANE  the game spec (tools/_load_build.js, JOIN-PARITY G1985: the energy layer's tank - the Cub 27 L at
//                  460.4 kg, not the file's 45 L at 476.2), built by the host as the worker builds it
//   THE FLIGHT     src/viewer/sim_host.js makeSimHost - the worker's own host: app.js applyRoute's placement (the stand
//                  walked out of the default player's shed - standFor -, the wheels seated, no settling steps, the
//                  site's departure), app.js mkPilot's pilot (the garage's shakedown genShakedown(def, {corners: false})
//                  behind the machine sheet, the nav), one step = the commands, ap.update, sim.step, the day's tick;
//                  each next leg the 'leg' command app.js nextLeg posts
const SH_PATH = path.join(__dirname, '..', 'src', 'viewer', 'sim_host.js');
function gameDay(C) {
  const vm = require('vm'), fs = require('fs');
  const ctx = vm.createContext({ console, Math, JSON, Date });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'day_clock.js'), 'utf8') + '\n;this.DAY_CLOCK = DAY_CLOCK;', ctx, { filename: 'day_clock.js' });
  // a probe world: the clock binds to it as to the page's (setDay GAME_DAY), the spec read back is the game's first day
  const w = C.makeWorld(0, {});
  ctx.DAY_CLOCK.bind(w);
  return JSON.parse(JSON.stringify(w.day.spec()));
}
function gameHost(C, W, def, from, to, g) {
  const SH = require(SH_PATH);
  const spec = def.spec;
  const day = g.day === undefined ? gameDay(C) : g.day;   // (null: calm, no tick - an experiment's)
  const shake = g.shake === false ? null : C.genShakedown(C.buildGen(spec), { corners: false });
  const st = C.siteOf(from.id);
  // app.js applyRoute: the stand walked out of the player's shed (playerShedDims of the default player, at HOME)
  const shedD = st && C.playerShedDims && C.playerDefault ? C.playerShedDims(C.playerDefault(), 'HOME', st) : null;
  const stand = st ? (shedD && C.standFor ? C.standFor(st, shedD, (x, z) => W.terrainH(x, z)) : st.stand) : null;
  const H = SH.makeSimHost(C, { spec, place: { from: from.id, to: to.id, stand: stand ? JSON.parse(JSON.stringify(stand)) : false, seat: true },
    pilot: { kind: 'auto', shakedown: shake, nav: g.nav !== false }, withV: false, day: day || null,
    damage: g.damage !== undefined ? !!g.damage : !!(def.params && def.params.damage) }, W);
  if (!day) H.dayTick = () => {};
  H.game = { day, shake: !!shake, stand: stand ? { x: r1(stand.x), z: r1(stand.z) } : null, mass: r1(H.sim.totalM), fuel: H.sim.fuel ? r1(H.sim.fuel.litres) : null,
             damage: typeof globalThis.FLYDIY_DAMAGE === 'boolean' ? globalThis.FLYDIY_DAMAGE : null };
  return H;
}

// THE BUILDS (the validated ones - master_bench.js's list): the user's Cub first, then the Cessna (the aluminium C172
// every Jolene gate flies), the float Cessna on the water lanes as a tour of its own
const ROOT = path.join(__dirname, '..');
const BUILDS = {
  cub: { key: path.join(ROOT, 'builds', 'cub_2026-09-20_corrected.json'), name: "the user's Cub", tour: 'land' },
  c172: { key: path.join(__dirname, 'fixtures', 'build_v10_cessnaMetal_2026-09-26.json'), name: 'the aluminium C172', tour: 'c172' },
  floats: { key: path.join(ROOT, 'bugReports', 'cessnaFloatsWOrks.json'), name: 'the float Cessna', tour: 'water' },
};
// THE ORDERS (the plan): clockwise round the island from HOME - Tamgas Hill 2.7 km NW, the altiport 5.4 km on, Jumbo
// Mine 10.7 km NE, then 18 km home to the field's other runway (02/20) and the last leg round to 13/31. EAST POINT
// (150 m) IS IN NO LAND TOUR: the user's Cub - the archetype Cub to the decimal, the only validated build that might -
// stops 136 m after a touchdown 100 m in (85 m past the end, flown before and after the pads: tools/island_tour.js
// --order nv_strip,nv_strip), and PILOT-ONE measured its three-point roll alone at 143-152 m: the strip at its length
// fits no validated land build (HANDOVER G1965-G1974 says what would). The Cessna leaves out Jumbo Mine as well (G531:
// its take-off reserve asks 313 m of the 250). The floats: Annette Dock, Metlakatla, Annette Dock.
const ORDERS = {
  land: 'HOME,w3,tw_ski,mn_strip,w2,HOME',
  c172: 'HOME,w3,tw_ski,w2,HOME',
  water: 'SEA,mk_sea,SEA',
};
// a build as the game makes it, the damage ON
function defOf(C, PT, key) {
  const spec = key === 'stock' ? PT.specOf('stock').spec : PT.specOf(key).spec;
  const d = C.buildGen(C.genMigrateSpec ? C.genMigrateSpec(spec) : spec);
  d.params = Object.assign({}, d.params, { damage: true });
  return d;
}
function fmtLeg(L) {
  const dp = L.dep, ar = L.arr, ld = ar.landing;
  return '  ' + (L.ok ? 'ok  ' : 'FAIL') + ' ' + (L.from + ' > ' + L.to).padEnd(20) + ' ' + L.t.toFixed(0).padStart(5) + ' s' +
    ' | dep: turned ' + dp.turned + ' deg' + (dp.uturn ? ' (U-turn)' : '') + ', roll ' + (dp.rollFromEnd !== null ? dp.rollFromEnd + ' m in' : '-') + ', lift-off ' + (dp.toDist !== null ? dp.toDist + ' m' : '-') +
    ' | final ' + (ar.final ? ar.final.d + ' m / ' + ar.final.h + ' m' : '-') + ', clear ' + (ar.apprClear ? ar.apprClear.c + ' m (' + ar.apprClear.what + ')' : '-') +
    ' | td ' + (ld ? 'sink ' + ld.sink + ' m/s, ' + ld.V + ' m/s, run ' + ld.run + ' m, off ' + ld.offCentre + ' m' : '-') +
    ' | fuel ' + (L.fuel ? L.fuel.litres + ' L' : '-') + (L.warnings && L.warnings.length ? ' | warnings ' + L.warnings.join('; ') : '') + (L.faults.length ? ' | FAULTS ' + L.faults.map(f => f.k + ' (' + f.note + ')').join('; ') : '') +
    (L.ok ? '' : ' | phases ' + L.phases.join('>'));
}
// the per-leg table (the evidence report's): one row a leg
function mdTable(R) {
  const rows = ['| leg | time | on the ground before the roll | roll from the end | lift-off | final (dist / height) | final\'s least clearance | touchdown (sink, speed, run, off centre) | fuel | faults |',
                '|---|---|---|---|---|---|---|---|---|---|'];
  for (const L of R.legs) {
    const dp = L.dep, ar = L.arr, ld = ar.landing;
    rows.push('| ' + L.from + ' > ' + L.to + ' | ' + L.t.toFixed(0) + ' s | ' + dp.turned + ' deg' + (dp.uturn ? ' (U-turn)' : '') + ', ' + dp.latMax + ' m off the centreline | ' +
      (dp.rollFromEnd !== null ? dp.rollFromEnd + ' m' : '-') + ' | ' + (dp.toDist !== null ? dp.toDist + ' m' : '-') + ' | ' +
      (ar.final ? ar.final.d + ' m / ' + ar.final.h + ' m' : '-') + ' | ' + (ar.apprClear ? ar.apprClear.c + ' m (' + ar.apprClear.what + ', ' + ar.apprClear.d + ' m out)' : '-') + ' | ' +
      (ld ? ld.sink + ' m/s, ' + ld.V + ' m/s, ' + ld.run + ' m, ' + ld.offCentre + ' m' : '-') + ' | ' + (L.fuel ? L.fuel.litres + ' L (-' + L.fuel.burnt + ')' : '-') + ' | ' +
      (L.faults.length ? L.faults.map(f => f.k).join(', ') : 'none') + (L.verdicts.length ? '; pilot: ' + L.verdicts.join('; ').replace(/\|/g, '/') : '') + ' |');
  }
  return rows.join('\n');
}
module.exports = { mdTable, BUILDS, ORDERS, defOf, fmtLeg, tourWorld, flyLeg, flyTour, stripFrame, GROUND, gameDay, gameHost };
