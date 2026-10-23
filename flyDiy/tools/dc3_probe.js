#!/usr/bin/env node
// dc3_probe.js - DC3-STUDY (G3500-G3509, cloud, 2026-10-23): CAN THE GARAGE BUILD AND FLY A DC-3 TODAY? A TOOL, not a
// gate: run_gates does not run it, it asserts nothing, it prints tables. futureDesigns/DC3-STUDY-2026-10.md reads them.
//
// THREE AEROPLANES, all born as the game births one: a raw spec (the user's metal Cessna's file as the base, so every
// row the editor owns is present) with the DC-3's rows set, then THE PAGE'S OWN LOAD DOOR (tools/_load_build.js: the
// editor's layers draw it headless, the join measures it, the energy layer fits the tanks) -> buildGen -> the sheets.
//   full    the DC-3 drawn at full size (29 m class: planeScale 1.6, the editor's rows at their ends). Today's clamps
//           cut it: the join's ERRS rows and the flown lattice's extent say where. Evidence only, not flown.
//   fit     THE FIXTURE (tools/fixtures/dc3_study_2026-10-23.json): the DC-3's wing and section at 0.62 scale (span 18 m =
//           the envelope's end), its fuselage SHORTENED to the 6.5 m tail-arm clamp, so the drawn and the flown
//           aeroplane agree. Two R-1830s, alloy, low cantilever wing, plain flaps (the split flap's nearest row),
//           taildragger, 2 crew + 4.
//   widened A LOCAL, UNCOMMITTED PATCH, in memory only: tools/flight_core.js's text with the clamps this study names
//           widened (WIDEN below), compiled into this process. The full-size DC-3's numbers (29 m, 91.7 m2, real
//           chords, real tail, real gear) through the generator and the solver - what widening alone would give.
//           NOTHING ON DISK CHANGES. It skips the editor (the editor's rows stop at 18 m): its spec is the fit
//           build's joined spec with the full-size fields written in. The GAUGE patch (below) rides with it.
//   fitGauge the fixture through the GAUGE patch alone (in memory): members sized in proportion to the weight.
//
//   node tools/dc3_probe.js --build            the fit fixture (re)written through the load chain (~10 s), and the
//                                              full-size drawing beside it (raw, dc3_study_fullsize_2026-10-23.json)
//   node tools/dc3_probe.js                     all three: sheets + the fit and widened aeroplanes flown
//   node tools/dc3_probe.js --only=fit|full|fitGauge|widened   [--no-fly] [--bearer] [--json=<file>]
//     --bearer   the BEARER patch (bearerPatch below) on every flown def, in memory
'use strict';
const fs = require('fs'), path = require('path'), Module = require('module');
const T = __dirname, ROOT = path.join(T, '..');
const LB = require('./_load_build.js');
const FIX = path.join(T, 'fixtures', 'dc3_study_2026-10-23.json');
const FIX_FULL = path.join(T, 'fixtures', 'dc3_study_fullsize_2026-10-23.json');
const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const flag = k => argv.includes('--' + k);

// ---- THE REAL AEROPLANE (the study's reference column; sources in the study's §1) --------------------------------
const REAL = {
  span: 29.0, length: 19.7, height: 5.16, Sw: 91.7, AR: 9.17, mtow: 11431, empty: 7650, fuelL: 3111,
  hp: 2 * 1200, propD: 3.51, blades: 3, VsoKt: 58, VsKt: 67, climbMs: 5.7, cruiseKt: 160, maxCruiseKt: 180,
  toRollM: 520, toOver15M: 1000, ldgRollM: 245, ldgOver15M: 640, track: 5.64, seats: '2-3 crew + 21-32',
};

// ---- the R-1830 preset's dials, as _cage_eng.js applyEngPreset writes them (captured through the page context,
// CAGE_ENG_APPLY_PRESET(P, 'P&W R-1830'); without them the catalogue audit flips the row to the custom engine) -------
const R1830_DIALS = { engOn: 1, engPreset: 28, engPower: 0, eng_screws: 1, eng_rpm: 2700, eng_plumb: 0, eng_liquid: 0,
  eng_geared: 1, eng_arch: 2, eng_cyl: 7, eng_radialRows: 1, eng_inlineAim: 1, eng_vee: 60, eng_bore: 0.1397,
  eng_stroke: 0.1397, eng_stagger: 0.5, eng_twoStroke: 0, eng_blower: 2, eng_boost: 1.6, eng_critAlt: 1500, eng_finN: 14,
  eng_finR: 1.4, eng_headFins: 8, eng_rockerW: 0.95, eng_rockerH: 0.66, eng_rockerR: 0.24, eng_rockerBoss: 0.05,
  eng_rockerBossW: 0.52, eng_rodPos: 0, eng_finShape: 0, eng_rockerSpan: 0, eng_baseFins: 1, eng_injected: 0,
  eng_airStyle: 0, eng_airbox: 0, eng_intake: 1, eng_exStyle: 2, eng_exDrop: 1.5, eng_mountGap: 1.2 };

// ---- the raw spec: the metal Cessna's file, the DC-3's rows -------------------------------------------------------
// `k` is the drawing's scale against the full-size DC-3 at planeScale 1.6 (1 = full size, 0.62 = the fit build)
function dc3Raw(k) {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'bugReports', 'cessnaMetal (1).json'), 'utf8'));
  const cub = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds', 'cub_2026-09-20_corrected.json'), 'utf8')).spec.cage;
  const s = j.spec, c = s.cage;
  const ps = 1.6 * k;                                   // the cage is drawn in units x planeScale
  Object.assign(c, {
    planeScale: ps,
    // the fuselage in cage units (x 1.6 = metres at full size): nose 1.6, cockpit 2.4, three cabin bays 9.1,
    // the tail cone 6.2 + 0.5 = 19.8 m; a 2.6 m wide, 2.96 m deep section
    noseLen: 1.0, pilotLen: 1.5, paxCount: 3, paxLen: 1.9, boomLen: 3.9, tailLen: 0.3,
    halfW: 0.81, roofHalfW: 0.7, roofY: 1.0, keelY: -0.85, floorY: -0.5,
    aftRoofY: 0.6, aftKeelY: -0.7, tailHalfW: 0.1, tailRoofY: 0.3, tailKeelY: -0.1,
    // the wing: low, cantilever, alloy (wgCons 4), NACA 2415 (the join's 4-digit family: camber 2, thickness 15 -
    // the DC-3's root is a 2215), rounded tips, plain flaps (the nearest row to a split flap)
    wgPos: 2, wgBrace: 1, wgSpan: Math.min(18, 29 * k), wgChord: Math.min(2.1, 4.4 * k), wgChordTip: Math.min(2.1, 2.1 * k),
    wgTipX: 0, wgCrankAt: 0, wgDihedral: 5, wgIncidence: 2, wgWashout: 2, wgCamber: 2, wgThick: 15, wgTip: 2,
    wgCentre: 0, wgCons: 4, wgFlapType: 1, wgFlapSpan: 0.5, wgFlapChord: 0.2, wgAilSpan: 0.4,
    // the pair: two R-1830s on the wing, same hand (the DC-3's both turn clockwise from behind); the nacelle at 0.37
    // of the semispan clears a 3.4 m disc off a 2.6 m fuselage
    engMount: 3, engNacAt: 0.37, engRotate: 0,
    // the propeller as drawn: the Hamilton Standard's 3.4 m, three blades (the registry's D; the real 23E50 is 3.51)
    cw_propD: 3.4, cw_bladeN: 3, propR: 1.7 / ps, cw_rpm: 1517, cw_power: 1200, cw_tas: 300,
  }, R1830_DIALS);
  // the undercarriage: the Cub's tailwheel station, oleo mains (s1Leg 2) at the widest half track and wheel
  for (const key of Object.keys(cub)) if (/^s2/.test(key)) c[key] = cub[key];
  Object.assign(c, { s1Leg: 2, s1X: 1.6, s1R: 0.4, s1Drop: 0.6, s1Fair: 0 });
  // THE FIT BUILD'S PROPORTIONS (k < 1): the fuselage SHORTENED until the drawn tail post is inside the 6.5 m
  // fuselage.tailArm clamp (60_gen_spec.js:4130) - two cabin bays, a short cone - so the drawn and the flown aeroplane
  // agree; the mains moved to the wing's leading edge (an oleo leg fits under the wing; 0.6 m ahead of the CG, or it noses over
  // when the tail lifts), the wing 0.5 aft for balance.
  // Found by a scan on the joined spec (tailArm 6.50, on its wheels, SM 0.14, worst corner 0.06).
  if (k < 1) Object.assign(c, { paxCount: 2, paxLen: 1.2, pilotLen: 1.1, boomLen: 0.95, s1Z: 2.6, s1Drop: 0.9, wgDx: -0.5 });
  s.gear.type = 'taildragger';
  s.gear.stiffness = 3.0;                               // the clamp's top (60:4800): gen_ap_probe's R-1830 rule
  s.cabin.seating = 'side2'; s.cabin.pilots = 2;
  // the tanks: in the wing roots (the DC-3's are in the centre section), the fuel scaled with the wing's area
  const L = Math.min(1000, Math.round(REAL.fuelL / 2 * k * k / 10) * 10);
  s.energy.vessels = [{ bay: 'wingRoot', capacity: L }, { bay: 'wingRoot', capacity: L }];
  s.fuel.litres = 2 * L;
  j.name = k >= 1 ? 'DC-3 study (full size, today\'s clamps)' : 'DC-3 study (' + k + ' scale)';
  j.what = 'DC3-STUDY G3500 - a DC-3 through the garage\'s own path (tools/dc3_probe.js)';
  delete j.plaque; delete j.log;
  return j;
}

// ---- the widened core (A LOCAL PATCH, IN MEMORY: the file on disk is never written) ------------------------------
// Each row: the literal clamp in src/core/60_gen_spec.js (as built into tools/flight_core.js) and its widened text.
const WIDEN = [
  ['chord: [0.80, 2.10], span: [6.5, 18.0], spanPerChord: [4.0, 20.0],', 'chord: [0.80, 5.00], span: [6.5, 30.0], spanPerChord: [4.0, 20.0],', 'GEN_WING_ENVELOPE chord / span (60:3965)'],
  ["taper: [0.45, 1.0], xLE: [-0.20, 3.00],", "taper: [0.35, 1.0], xLE: [-0.20, 9.00],", 'GEN_WING_ENVELOPE taper / xLE (60:3966)'],
  ["'cabin.halfW':   { def: null, clamp: [0.28, 0.75]", "'cabin.halfW':   { def: null, clamp: [0.28, 1.30]", 'cabin.halfW (60:4121)'],
  ["'cabin.h':       { def: null, clamp: [0.75, 1.45]", "'cabin.h':       { def: null, clamp: [0.75, 2.10]", 'cabin.h (60:4122)'],
  ["'cabin.len':     { def: null, clamp: [0.60, 2.60]", "'cabin.len':     { def: null, clamp: [0.60, 10.0]", 'cabin.len (60:4123)'],
  ["'fuselage.tailArm':     { def: null, clamp: [2.00, 6.50]", "'fuselage.tailArm':     { def: null, clamp: [2.00, 20.0]", 'fuselage.tailArm (60:4130)'],
  ["'tail.hX':       { def: null, clamp: [2.00, 9.00]", "'tail.hX':       { def: null, clamp: [2.00, 20.0]", 'tail.hX (60:4131)'],
  ["'tail.vX':       { def: null, clamp: [2.00, 9.00]", "'tail.vX':       { def: null, clamp: [2.00, 20.0]", 'tail.vX (60:4132)'],
  ["'tail.Sh':       { def: null, clamp: [0.20, 12.0]", "'tail.Sh':       { def: null, clamp: [0.20, 25.0]", 'tail.Sh (60:4138)'],
  ["'tail.Sv':       { def: null, clamp: [0.10, 10.0]", "'tail.Sv':       { def: null, clamp: [0.10, 15.0]", 'tail.Sv (60:4139)'],
  ["hSpan: [1.50, 4.50], hChord: [0.40, 1.60],", "hSpan: [1.50, 9.00], hChord: [0.40, 3.00],", 'GEN_TAIL_ENVELOPE h (60:4072)'],
  ["vHeight: [0.60, 2.20], vChord: [0.40, 1.80],", "vHeight: [0.60, 4.00], vChord: [0.40, 3.50],", 'GEN_TAIL_ENVELOPE v (60:4073)'],
  ["S.gear.track = genClampN(S.gear.track, 0.90, 3.50);", "S.gear.track = genClampN(S.gear.track, 0.90, 6.00);", 'gear.track (60:4821)'],
  ["S.gear.wheelR = genClamp(S.gear.wheelR, 0.10, 0.40);", "S.gear.wheelR = genClamp(S.gear.wheelR, 0.10, 0.65);", 'gear.wheelR (60:4822)'],
  ["S.gear.twX = genClampN(S.gear.twX, -1.50, 8.00);", "S.gear.twX = genClampN(S.gear.twX, -1.50, 20.0);", 'gear.twX (60:4835)'],
  ["S.gear.x = genClampN(S.gear.x, -0.50, 3.00);", "S.gear.x = genClampN(S.gear.x, -0.50, 8.00);", 'gear.x (60:4850)'],
  ["S.fuel.litres = genClamp(S.fuel.litres, 0, 2000);", "S.fuel.litres = genClamp(S.fuel.litres, 0, 4000);", 'fuel.litres (60:4492)'],
  ["else { S.fuel.litres = genClamp(total, 0, 2000); E.kWh = 0; }", "else { S.fuel.litres = genClamp(total, 0, 4000); E.kWh = 0; }", 'fuel total (60:4574)'],
  ["v.capacity = genClamp(v.capacity || 0, 0,\n                            E.kind === 'battery' ? 400 : 1000);", "v.capacity = genClamp(v.capacity || 0, 0,\n                            E.kind === 'battery' ? 400 : 2000);", 'vessel capacity (60:4541)'],
];
// THE STRUCTURE'S SIZING (the second patch): members gauged in proportion to the design gross (GEN_GAUGE's exponents
// 0.30 / 0.49 / 0.41 / 0.75 -> 1, its 3.0 ceiling -> 12) and the lattice's stiffness scale uncapped to 12 (61:3196).
// Without it the fit build breaks its engine fittings and its aft fuselage bay settling on its wheels (1.98 g).
const GAUGE = [
  ['e: { fus: 0.30, wing: 0.49, tail: 0.41, gear: 0.75 },', 'e: { fus: 1.00, wing: 1.00, tail: 1.00, gear: 1.00 },', 'GEN_GAUGE.e (60:1834)'],
  ['  lo: 0.6, hi: 3.0,', '  lo: 0.6, hi: 12.0,', 'GEN_GAUGE.hi (60:1835)'],
  ['const kScale = Math.min(4, Math.max(0.45,', 'const kScale = Math.min(12, Math.max(0.45,', 'kScale cap (61:3196)'],
];
function widenedCore(rows) {
  let src = fs.readFileSync(path.join(T, 'flight_core.js'), 'utf8');
  const applied = [];
  for (const [a, b, what] of rows || WIDEN.concat(GAUGE)) {
    const n = src.split(a).length - 1;
    if (n !== 1) throw new Error('dc3_probe: the widen row "' + what + '" matches ' + n + ' times in flight_core.js');
    src = src.replace(a, b); applied.push(what);
  }
  // a .cjs name: flight_core's freshness check returns on a non-.js filename (it would test the patched text)
  const fake = path.join(T, '.dc3_patched_core_' + applied.length + '.cjs');
  const m = new Module(fake, module); m.filename = fake; m.paths = Module._nodeModulePaths(T);
  m._compile(src, fake);
  return { C: m.exports, applied };
}

// the full-size fields written over the fit build's joined spec (the widened variant has no editor to draw them)
function fullSize(spec) {
  const S = JSON.parse(JSON.stringify(spec));
  const w = S.wings[0];
  // the wing's station: balanced by a scan (SM 0.13 at 5.5 m from the cabin datum; the DC-3's own root LE is ~4.1 m -
  // this lattice's aft fuselage weighs more than the real one's), the nacelles 2.1 m ahead of the leading edge
  Object.assign(w, { span: 29.0, chord: 4.4, taper: 0.40, xLE: 5.5, yRoot: null });
  w.place = { dx: 0, dy: 0 };
  // the fuselage: the fit build's measured profile kept (fractions of the length); its absolute stations grown
  // by 1/0.62, the cabin box the DC-3's (2.34 x 1.98 x 9.1 m)
  const g = 1 / 0.62;
  // the DC-3's own stations from the cabin datum (the windscreen base, ~2.4 m aft of the nose): the tail post ~16.6 m,
  // the stab and fin derived from it (60:5145-5146); the cabin box 2.34 x 1.98 x 9.1 m; the DC-3's tail (stab 8.2 m x
  // 2.25 m, 18.4 m2; fin and rudder 8.7 m2) - the fit build's drawn profile kept as fractions of the length
  S.fuselage.tailArm = 16.6;
  Object.assign(S.cabin, { halfW: 1.17, h: 1.98, len: 9.1 });
  Object.assign(S.tail, { hX: null, vX: null, hSpan: 8.2, hChord: 2.25, vHeight: 3.0, vChord: 2.9, Sh: 18.4, Sv: 8.7 });
  // the gear: the DC-3's track and wheel, the stations grown with the aeroplane; the frame places the mains
  Object.assign(S.gear, { track: REAL.track, wheelR: 0.57, x: null, y: null, twX: null, twY: null, twR: 0.20 });
  for (const e of S.engines) { e.x = w.xLE - 2.1; if (e.y != null) e.y *= g; e.z = 2.82; }
  // the fuel: the DC-3's 822 US gal in two tanks
  S.energy.vessels = [{ bay: 'wingRoot', capacity: 1555 }, { bay: 'wingRoot', capacity: 1555 }];
  S.fuel.litres = 3110;
  return S;
}

// THE BEARER (the third patch, on the built def, in memory): every member with an end on an engine's nodes (ENG / CGE /
// MNT - the wing pair's bearer, 61_gen_frame.js:1586-1640) takes a section in proportion to the engine group's mass
// against the 118 kg the bearer was calibrated on (the user's twin, two Rotax 582: GEN_RULES.mountFoot, G179). Without
// it the R-1830's bearer kinks settling on its wheels (1.68 g, 0.25 s). Strength only: k and c are left as built
// (the substep count stays the build's own).
function bearerPatch(def, refKg) {
  const isE = i => /^(ENG|CGE|MNT)/.test(def.nodes[i].tag || '');
  let mE = 0; for (const n of def.nodes) if (/^(ENG|CGE)/.test(n.tag || '')) mE += n.m;
  const f = Math.max(1, mE / (refKg || 118));
  let n = 0;
  def.beams = def.beams.map(b => (isE(b.a) || isE(b.b)) ? (n++, Object.assign({}, b, { A: b.A * f })) : b);
  return { f, n, mE };
}

// ---- the sheets -------------------------------------------------------------------------------------------------
const kt = v => v / 0.514444;
function sheet(C, def, label) {
  const sh = C.genShakedown(def);
  const S = def.spec;
  let m = 0; for (const n of def.nodes) m += n.m;
  const ext = [0, 1, 2].map(i => [Math.min(...def.nodes.map(n => n.p[i])), Math.max(...def.nodes.map(n => n.p[i]))]);
  let dc = null;
  try { const D = C.genDesignCheck(def, sh); dc = { fail: D.rows.filter(r => r.level === 'fail').map(r => r.id + '=' + r.value),
    warn: D.rows.filter(r => r.level === 'warn').map(r => r.id + '=' + r.value), n: D.rows.length }; }
  catch (e) { dc = { error: String(e.message || e) }; }
  return {
    label, nodes: def.nodes.length, beams: def.beams.length, strips: def.strips.length, mass: m,
    lattice: { x: ext[0], y: ext[1], z: ext[2] },
    span: S.wings[0].span, chord: S.wings[0].chord, taper: S.wings[0].taper, Sw: sh.Sw, AR: sh.AR, wingLoad: sh.wingLoad,
    tailArm: S.fuselage.tailArm, hX: S.tail.hX, Sh: S.tail.Sh, Sv: S.tail.Sv, cabin: [S.cabin.halfW, S.cabin.h, S.cabin.len],
    seats: S.seats, crew: S.crew, gear: { type: S.gear.type, track: S.gear.track, x: S.gear.x, twX: S.gear.twX, wheelR: S.gear.wheelR },
    engines: S.engines.map(e => e.type), hp: sh.hp, nEngines: sh.nEngines, prop: sh.propName, fuelL: S.fuel.litres,
    onWheels: sh.onWheels, restsOn: sh.restsOn, deckAngle: sh.deckAngle, noseOver: sh.noseOver, propClear: sh.propClear,
    Vs: sh.Vs, VsFlap: sh.VsFlap, VAppr: sh.VAppr, VCruise: sh.VCruise, climbRate: sh.climbRate, TORun: sh.TORun,
    staticMargin: sh.staticMargin, LDbest: sh.LDbest, flyableCircuit: sh.flyableCircuit, thrCruise: sh.thrCruise,
    price: sh.ledger && sh.ledger.total ? sh.ledger.total.cost : null, design: dc,
  };
}

// ---- the take-off run and the circuit (the pilot, 43_pilot.js, as GATE TAKEOFF / the circuit harness fly it) -----
function fly(C, def, maxS) {
  // THE BENCH FIRST: the game flies a certified build (the certificate stamps each member's limit, 30_solver.js:904)
  if (def._bearer == null && flag('bearer')) def._bearer = bearerPatch(def);
  if (!def.cert) { const t0 = Date.now(); def.cert = C.genCertify(def); def._certS = (Date.now() - t0) / 1000; }
  const world = C.makeWorld();
  const a = world.aerodromes[0];
  const sim = C.makeSim(def, world);
  // THE GAME'S SPAWN: reset, then the stance (app.js:6032 / 6095 - a taildragger set down on its tailwheel; without it
  // this one's tail falls 1.5 m onto the runway and breaks the aft fuselage), then the strip
  sim.reset(0); if (typeof sim.stance === 'function') sim.stance();
  for (let i = 0; i < 600; i++) sim.step(1 / 60);
  C.placeAtAerodrome(sim, a);
  const ap = C.makePilot(sim, def, world);
  const R = { home: a.name || a.id, phases: [], roll0: null, lift: null, at15: null, maxAlt: 0, maxVs: 0, td: null,
              stop: null, app15: null, nan: false, maxStrainCh: 0, maxStrainGr: 0, verdicts: null, outcome: null };
  let last = null, prevAgl = 0;
  const t0 = Date.now();
  for (let s = 0; s < (maxS || 420) * 60; s++) {
    ap.update(1 / 60); sim.step(1 / 60);
    const t = s / 60, d = ap.dbg || {}, cg = sim.cgPos(), v = sim.cgVel();
    if (sim.stats().bad) { R.nan = true; break; }
    for (const b of sim.beams) { if (b.gear) R.maxStrainGr = Math.max(R.maxStrainGr, Math.abs(b.strain)); else R.maxStrainCh = Math.max(R.maxStrainCh, Math.abs(b.strain)); }
    if (ap.phase !== last) { R.phases.push(t.toFixed(1) + ' ' + ap.phase + ' V' + (d.V || 0).toFixed(1) + ' agl' + (d.agl || 0).toFixed(0)); last = ap.phase; }
    const agl = d.agl || 0;
    if (ap.phase === 'ROLL' && !R.roll0) R.roll0 = { t, x: cg[0], z: cg[2] };
    if (R.roll0 && !R.lift && agl > 0.5 && /LIFTOFF|CLIMB/.test(ap.phase)) R.lift = { t, d: Math.hypot(cg[0] - R.roll0.x, cg[2] - R.roll0.z), V: d.V };
    if (R.roll0 && !R.at15 && agl > 15) R.at15 = { t, d: Math.hypot(cg[0] - R.roll0.x, cg[2] - R.roll0.z), V: d.V };
    R.maxAlt = Math.max(R.maxAlt, agl);
    if (R.at15 && /CLIMB/.test(ap.phase)) R.maxVs = Math.max(R.maxVs, v[1]);
    if (R.at15 && !R.app15 && prevAgl >= 15 && agl < 15 && /FINAL|APPROACH|FLARE|BASE/.test(ap.phase)) R.app15 = { t, x: cg[0], z: cg[2], V: d.V };
    prevAgl = agl;
    if (ap.phase === 'STOPPED' && t > 5) { R.stop = { t, x: cg[0], z: cg[2] }; break; }
  }
  R.wallS = (Date.now() - t0) / 1000;
  R.certS = def._certS; R.bearer = def._bearer || null;
  const dm = sim.damage ? sim.damage() : null;
  R.damage = dm && { breaks: dm.breaks, crashed: dm.crashed, reason: dm.reason, at: dm.at, gPeak: dm.gPeak, propStrike: dm.propStrike,
    first: dm.firstBreak && (dm.firstBreak.cls + ' ' + (def.nodes[def.beams[dm.firstBreak.beam].a] || {}).tag + '-' + (def.nodes[def.beams[dm.firstBreak.beam].b] || {}).tag + ' ' + dm.firstBreak.how + ' t' + dm.firstBreak.t.toFixed(2)) };
  R.td = ap.tdInfo || null;
  if (R.app15 && R.stop) R.ldgOver15 = Math.hypot(R.stop.x - R.app15.x, R.stop.z - R.app15.z);
  if (R.td && R.stop) R.ldgRoll = Math.hypot(R.stop.x - R.td.x, R.stop.z - (R.td.z || 0));
  R.outcome = ap.report && ap.report.outcome; R.verdicts = ap.report && ap.report.verdicts && ap.report.verdicts.map(v => v.code);
  return R;
}

// ---- the per-step cost (the solver alone, airborne trimmed; the same clock the gates read) -----------------------
function stepCost(C, def, n) {
  const sim = C.makeSim(def, null);
  sim.reset(0);
  for (let i = 0; i < 60; i++) sim.step(1 / 60);
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < n; i++) sim.step(1 / 60);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / n;
  const st = sim.stats ? sim.stats() : {};
  return { msPerFrame: ms, substeps: st.sub != null ? st.sub : (st.substeps != null ? st.substeps : null) };
}

function printSheet(s) {
  const f = (v, d) => v == null || !isFinite(v) ? '-' : (+v).toFixed(d == null ? 2 : d);
  console.log(`\n== ${s.label}`);
  console.log(`  lattice ${s.nodes} nodes / ${s.beams} beams / ${s.strips} strips; x ${f(s.lattice.x[0])}..${f(s.lattice.x[1])} m, half-span ${f(s.lattice.z[1])} m; mass ${f(s.mass, 0)} kg`);
  console.log(`  wing ${f(s.span, 1)} m x ${f(s.chord)} m (taper ${f(s.taper)}), Sw ${f(s.Sw, 1)} m2, AR ${f(s.AR, 1)}, loading ${f(s.wingLoad, 0)} kg/m2`);
  console.log(`  tail arm ${f(s.tailArm)} m, hX ${f(s.hX)} m, Sh ${f(s.Sh)} m2, Sv ${f(s.Sv)} m2; cabin ${s.cabin.map(v => f(v)).join(' x ')} m, seats ${s.seats} (crew ${s.crew})`);
  console.log(`  gear ${s.gear.type} track ${f(s.gear.track)} m, mains x ${f(s.gear.x)}, tailwheel x ${f(s.gear.twX)}, wheel R ${f(s.gear.wheelR)}; on wheels ${s.onWheels} (rests on ${s.restsOn}), deck ${f(s.deckAngle, 1)} deg, prop clear ${f(s.propClear)} m`);
  console.log(`  ${s.nEngines} x ${s.engines[0]} = ${f(s.hp, 0)} hp, ${s.prop}; fuel ${s.fuelL} L; airframe ledger ${s.price == null ? '-' : f(s.price, 0)}`);
  console.log(`  Vs ${f(kt(s.Vs), 0)} kt clean / ${f(kt(s.VsFlap), 0)} kt flaps, Vappr ${f(kt(s.VAppr), 0)} kt, cruise ${f(kt(s.VCruise), 0)} kt (thr ${f(s.thrCruise)}), climb ${f(s.climbRate, 1)} m/s, TO run ${f(s.TORun, 0)} m, SM ${f(s.staticMargin, 3)}, L/D ${f(s.LDbest, 1)}, flyable circuit ${s.flyableCircuit}`);
  if (s.design) console.log(`  design check: ${s.design.error ? 'ERROR ' + s.design.error : s.design.n + ' rows; fail [' + s.design.fail.join(', ') + ']; warn [' + s.design.warn.join(', ') + ']'}`);
}
function printFlight(R) {
  const f = (v, d) => v == null || !isFinite(v) ? '-' : (+v).toFixed(d == null ? 0 : d);
  console.log(`  FLOWN at ${R.home} (${f(R.wallS, 1)} s wall): outcome ${R.outcome || '-'}${R.nan ? ' NaN' : ''}; verdicts ${(R.verdicts || []).join(',') || '-'}`);
  console.log(`    roll -> lift-off ${R.lift ? f(R.lift.d) + ' m at ' + f(kt(R.lift.V)) + ' kt' : '-'}; to 15 m ${R.at15 ? f(R.at15.d) + ' m' : '-'}; max climb ${f(R.maxVs, 1)} m/s; max AGL ${f(R.maxAlt)} m`);
  console.log(`    touchdown ${R.td ? 'sink ' + f(R.td.sink, 2) + ' m/s at ' + f(kt(R.td.V)) + ' kt' : '-'}; landing from 15 m ${f(R.ldgOver15)} m, roll ${f(R.ldgRoll)} m; strain chassis ${f(100 * R.maxStrainCh, 1)} % gear ${f(100 * R.maxStrainGr, 1)} %`);
  if (R.damage) console.log(`    damage: breaks ${R.damage.breaks}, crashed ${R.damage.crashed} (${R.damage.reason || '-'} at ${f(R.damage.at, 2)} s), first ${R.damage.first || '-'}, gPeak ${f(R.damage.gPeak, 2)}, prop strike ${!!R.damage.propStrike}; cert ${f(R.certS, 1)} s`);
  if (R.bearer) console.log(`    (bearer patch: ${R.bearer.n} members x ${R.bearer.f.toFixed(1)} section, engine group ${R.bearer.mE.toFixed(0)} kg)`);
  console.log('    phases: ' + R.phases.join(' | '));
}

// ---- main -------------------------------------------------------------------------------------------------------
if (require.main === module) {
  const only = opt('only', null), noFly = flag('no-fly'), out = {};
  const C = require('./flight_core.js');
  if (flag('build') || !fs.existsSync(FIX)) {
    const j = dc3Raw(0.62);
    const r = LB.gameSpecFull(j);
    const env = { what: j.what, v: j.v, name: j.name, spec: r.spec };
    fs.writeFileSync(FIX, JSON.stringify(env, null, 1) + '\n');
    console.log('wrote ' + path.relative(ROOT, FIX) + ' (join errors: ' + (r.errors || []).length + ')');
    for (const e of r.errors || []) console.log('  ERRS ' + e);
    // ...and the FULL-SIZE drawing, raw (for stills in the garage: the drawing the clamps cut; not a flyable build)
    const jf = dc3Raw(1.0);
    fs.writeFileSync(FIX_FULL, JSON.stringify({ what: jf.what + ' - FULL SIZE, the drawing today\'s clamps cut (stills only)', v: jf.v, name: jf.name, spec: jf.spec }, null, 1) + '\n');
    console.log('wrote ' + path.relative(ROOT, FIX_FULL) + ' (raw: the garage joins it on load)');
    if (flag('build')) process.exit(0);
  }
  if (!only || only === 'full') {
    const r = LB.gameSpecFull(dc3Raw(1.0));
    const def = C.buildGen(r.spec);
    const s = sheet(C, def, 'FULL - the DC-3 drawn at full size, today\'s clamps (evidence: not the drawn aeroplane)');
    s.joinErrors = r.errors; s.drawn = { tailArm: r.spec.fuselage.tailArm, twX: r.spec.gear.twX, gearX: r.spec.gear.x,
      cabin: [r.spec.cabin.halfW, r.spec.cabin.h, r.spec.cabin.len], hX: r.spec.tail.hX };
    printSheet(s);
    console.log('  DRAWN (the join) vs FLOWN: tail arm ' + (+s.drawn.tailArm).toFixed(2) + ' -> ' + (+s.tailArm).toFixed(2) + ' m; hX ' + s.drawn.hX + ' -> ' + s.hX +
                '; mains x ' + (+s.drawn.gearX).toFixed(2) + ' -> ' + s.gear.x + '; tailwheel x ' + (+s.drawn.twX).toFixed(2) + ' -> ' + s.gear.twX +
                '; cabin ' + s.drawn.cabin.map(v => (+v).toFixed(2)).join('x') + ' -> ' + s.cabin.map(v => (+v).toFixed(2)).join('x'));
    for (const e of r.errors || []) console.log('  ERRS ' + e);
    out.full = s;
  }
  let fitSpec = null;
  if (!only || only === 'fit' || only === 'widened' || only === 'fitGauge') fitSpec = LB.loadBuild(path.relative(ROOT, FIX)).spec;
  if (!only || only === 'fit') {
    const def = C.buildGen(JSON.parse(JSON.stringify(fitSpec)));
    const s = sheet(C, def, 'FIT - tools/fixtures/dc3_study_2026-10-23.json (0.62 scale, today\'s clamps, the page\'s load chain)');
    printSheet(s);
    s.cost = stepCost(C, def, 600);
    console.log(`  solver ${s.cost.msPerFrame.toFixed(2)} ms / 60 Hz frame (node, airborne)`);
    if (!noFly) { s.flight = fly(C, def, +opt('maxS', 420)); printFlight(s.flight); }
    out.fit = s;
  }
  if (!only || only === 'fitGauge') {
    const G = widenedCore(GAUGE);
    console.log('\n(fitGauge: a LOCAL, IN-MEMORY patch of tools/flight_core.js, nothing written: ' + G.applied.join('; ') + ')');
    const def = G.C.buildGen(JSON.parse(JSON.stringify(fitSpec || LB.loadBuild(path.relative(ROOT, FIX)).spec)));
    const s = sheet(G.C, def, 'FIT + GAUGE - the fixture, members gauged in proportion to its weight (in memory)');
    printSheet(s);
    s.cost = stepCost(G.C, def, 600);
    console.log(`  solver ${s.cost.msPerFrame.toFixed(2)} ms / 60 Hz frame (node, airborne)`);
    if (!noFly) { s.flight = fly(G.C, def, +opt('maxS', 420)); printFlight(s.flight); }
    out.fitGauge = s;
  }
  if (!only || only === 'widened') {
    const W = widenedCore();
    console.log('\n(widened: a LOCAL, IN-MEMORY patch of tools/flight_core.js, nothing written: ' + W.applied.join('; ') + ')');
    const def = W.C.buildGen(fullSize(fitSpec));
    const s = sheet(W.C, def, 'WIDENED - the full-size DC-3 numbers, clamps widened in memory (no editor drawing)');
    printSheet(s);
    s.cost = stepCost(W.C, def, 600);
    console.log(`  solver ${s.cost.msPerFrame.toFixed(2)} ms / 60 Hz frame (node, airborne)`);
    if (!noFly) { s.flight = fly(W.C, def, +opt('maxS', 420)); printFlight(s.flight); }
    out.widened = s;
  }
  if (opt('json', null)) fs.writeFileSync(opt('json'), JSON.stringify({ REAL, out }, null, 1));
}
module.exports = { REAL, dc3Raw, fullSize, widenedCore, bearerPatch, sheet, fly, stepCost, printSheet, printFlight, WIDEN, GAUGE };
