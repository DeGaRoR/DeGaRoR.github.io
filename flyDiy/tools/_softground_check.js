#!/usr/bin/env node
// GATE SOFTGROUND (SNOW-MUD, 2026-11-13) — SNOW AND MUD UNDER THE WHEELS, AND NOTHING ELSE MOVED.
//
// The user (13 Nov): "if we develop snow, maybe we just develop mud; it's pretty much the same thing in the end" - the
// observatory's altiport on Mount Ardent (snow, skis) and the community field's first, muddy stages. 00_registry.js
// carries five soft rows (GROUND_SURF 8-12: packed / powder / wet snow, firm / soft mud) and their LAYER (GROUND_SOFT:
// Bekker's p = k z^n, its depth), a tyre's footprint (TYRE_SOFT / tyreFootprint) and the two readers (groundSinkWheel,
// groundSinkPlate - the skis' interface, with GROUND_SKI_MU); the solver adds the compaction drag F / N to a wheel's
// rolling coefficient on a soft code only. The premises looks 'snow' 'powder' 'slush' 'mud' 'softmud' place them.
//
//   node tools/_softground_check.js            -> "GATE SOFTGROUND: PASS|FAIL"
//   node tools/_softground_check.js --show     -> the tables (sinkage per wheel, the runs per build and surface)
//   node tools/_softground_check.js --selftest -> negative verification (doctored tables and laws go red)
//   node tools/_softground_check.js --bless    -> re-record the legacy fixture (ONLY when a change elsewhere moved the
//                                                 stock build's ground roll on purpose; say so in the HANDOVER)
//
// A. THE ABSENT CASE. The eight hard rows are the numbers they were (frozen here, literally); a world whose surface is
//    0 rolls bit for bit as a world with no surface at all; and the stock build and its tricycle, rolled and braked on
//    every legacy code, end bit for bit where origin/master 23ce68c1 left them (tools/fixtures/softground_legacy_rolls
//    .json: read off master BEFORE this change). The solver writes out.softZ / softF only on a frame that met a layer.
// B. THE TABLES. 13 rows, each soft row with a layer (k, n, zMax, a ski pair kinetic < breakout); GROUND_SKI_MU names
//    every code (water none); the side tables keyed by the code have 13 entries (TW_SKID_MU, GEN_DRIVE.turfS,
//    SCAR_SURF, STRIP_ENUM_SURF, the enum's names, the vehicle's, the dust's and the audio's in the viewer).
// C. SINKING WITH PRESSURE. On every soft layer: more load sinks deeper and drags more per newton; a narrower, a
//    smaller wheel the same; a tundra carcass less than a standard, a slim more; never deeper than the layer. A plate
//    (the ski): more pressure sinks deeper, a bigger area less, the plough grows with the width.
// D. THE RUNS (a heading hold, full power from rest to 0.9 Vs; then idle and full brakes to 1 m/s) for the stock
//    taildragger, the same on tundra tyres and the stock tricycle on grass, paved and the five soft rows: packed snow
//    within 15 % of grass; powder and wet snow at least 1.3 x grass on the stock tyres; soft mud at least 1.3 x, firm
//    mud longer than grass; the tundra tyre shorter than the standard on every soft row; packed snow's braked roll
//    longer than grass's (its brakes 0.30 vs 0.45); the small nose wheel of the tricycle bogs in powder (the
//    "4 in of dry snow" rule) - printed, and checked as stuck.
// E. THE VOCABULARY. The looks feel their rows, stripSurface reads them (powder -> snow, softmud -> mud), the gear rule
//    lets wheels use mud and skis snow, not mud.
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const C = require(path.join(T, 'flight_core.js'));

const SHOW = process.argv.includes('--show'), SELF = process.argv.includes('--selftest'), BLESS = process.argv.includes('--bless');
const FX = path.join(T, 'fixtures', 'softground_legacy_rolls.json');
const log = s => { if (SHOW) console.log('  ' + s); };

// the hard rows as they stood before SNOW-MUD (00_registry.js G115 / G121.3), and the skid's
const LEGACY = { 0: [0.05, 0.45, 0.8], 1: [0.06, 0.50, 0.75], 2: [0.14, 0.25, 0.50], 3: [0.10, 0.30, 0.60], 4: [0.35, 0.0, 0.20],
                 5: [0.02, 0.55, 0.9], 6: [0.045, 0.38, 0.75], 7: [0.10, 0.30, 0.6] };
const LEGACY_SKID = { 0: 0.36, 1: 0.45, 2: 0.50, 3: 0.40, 4: 0.10, 5: 0.45, 6: 0.42, 7: 0.45 };
const SOFT = [8, 9, 10, 11, 12];

// ---- the instruments ----------------------------------------------------------------------------------------------
const flat = sc => ({ terrainH: () => 0, surface: () => sc, treesNear: () => [] });
function legacyRolls() {
  const out = {};
  const builds = { stock: () => C.buildGen(), tri: () => C.buildGen({ gear: { type: 'tricycle' } }) };
  for (const bk in builds) for (let cls = 0; cls < 8; cls++) {
    const sim = C.makeSim(builds[bk](), flat(cls)); sim.reset(0);
    sim.ctl.thr = 1;
    for (let s = 0; s < 4 * 60; s++) sim.step(1 / 60);
    sim.ctl.thr = 0; sim.ctl.brake = 1; sim.ctl.dr = 0.3;
    for (let s = 0; s < 2 * 60; s++) sim.step(1 / 60);
    out[bk + ':' + cls] = sim.cgPos().map(v => +v.toPrecision(17));
  }
  return out;
}
// the axis mains -> third wheel, its heading (the hold's)
function hdg(sim, d) {
  const P = sim.p, a = d.refs.mains[0], b = d.refs.mains[1], t = d.refs.tw;
  return Math.atan2((P[a * 3 + 2] + P[b * 3 + 2]) / 2 - P[t * 3 + 2], (P[a * 3] + P[b * 3]) / 2 - P[t * 3]);
}
// full power from rest to 0.9 Vs on flat ground of code sc, the heading held by the rudder; then idle + full brakes to
// 1 m/s -> { run (m) | null, t (s), roll (m) | null, z (the deepest sinkage, m), softSeen }
function runOn(spec, sc, tMax) {
  const d = C.buildGen(spec), Vs = d.params.gen.Vs, sim = C.makeSim(d, flat(sc)); sim.reset(0);
  const p0 = sim.cgPos(), h0 = hdg(sim, d), hold = () => { let e = hdg(sim, d) - h0; e = Math.atan2(Math.sin(e), Math.cos(e)); sim.ctl.dr = Math.max(-1, Math.min(1, 4 * e)); };
  let t = 0, run = null, z = 0, softSeen = false;
  sim.ctl.thr = 1;
  for (; t < tMax; t += 1 / 60) {
    hold(); sim.step(1 / 60);
    if (sim.out.softZ !== undefined) { softSeen = true; z = Math.max(z, sim.out.softZ); }
    if (sim.out.V > 0.9 * Vs) { const p = sim.cgPos(); run = Math.hypot(p[0] - p0[0], p[2] - p0[2]); break; }
  }
  let roll = null;
  if (run !== null) {
    sim.ctl.thr = 0; sim.ctl.brake = 1; const p1 = sim.cgPos();
    for (let u = 0; u < 60; u += 1 / 60) { hold(); sim.step(1 / 60); if (sim.out.V < 1) { const p = sim.cgPos(); roll = Math.hypot(p[0] - p1[0], p[2] - p1[2]); break; } }
  }
  return { run, t, roll, z, softSeen, V: sim.out.V };
}

// ---- the checks (o: the tables and laws under test, so --selftest can doctor them) ----------------------------------
function run(o) {
  const fail = [];
  const check = (ok, label, extra) => { if (!ok) fail.push(label + (extra ? ' - ' + extra : '')); return ok; };
  const GS = o.GROUND_SURF, GSO = o.GROUND_SOFT, wheel = o.groundSinkWheel, plate = o.groundSinkPlate, SINK = C.GROUND_SINK;

  // A. the absent case
  for (let c = 0; c < 8; c++) check(GS[c] && GS[c].length === 3 && GS[c].every((v, k) => v === LEGACY[c][k]), 'A the hard row ' + c + ' is the number it was', JSON.stringify(GS[c]));
  for (let c = 0; c < 8; c++) check(o.TW_SKID_MU[c] === LEGACY_SKID[c], 'A the skid on ' + c + ' is the number it was', o.TW_SKID_MU[c]);
  for (let c = 0; c < 8; c++) check(GSO[c] === undefined, 'A no layer under the hard code ' + c);
  if (o.rolls) {
    const fx = JSON.parse(fs.readFileSync(FX, 'utf8'));
    let same = 0, n = 0;
    for (const k in fx.rolls) { n++; const a = fx.rolls[k], b = o.rolls[k]; if (b && a.every((v, i) => v === b[i])) same++; else check(false, 'A the legacy roll ' + k + ' ends where master left it', JSON.stringify(a) + ' vs ' + JSON.stringify(b)); }
    check(n === 16 && same === 16, 'A all 16 legacy rolls bit-identical to ' + fx.master, same + ' / ' + n);
    log('A legacy rolls: ' + same + ' / ' + n + ' bit-identical to master ' + fx.master);
  }
  if (o.absent) {
    check(o.absent.same, 'A a world whose surface is 0 rolls bit for bit as one with no surface', o.absent.why);
    check(o.absent.noField, 'A out.softZ / softF never written off a soft layer', o.absent.keys);
  }

  // B. the tables
  check(Object.keys(GS).length === 13, 'B 13 surface rows', Object.keys(GS).length);
  for (const c of SOFT) {
    const S = GSO[c], R = GS[c];
    check(R && R.length === 3 && R[0] > 0 && R[1] > 0 && R[1] < 0.5 && R[2] > 0 && R[2] <= LEGACY[0][2], 'B the soft row ' + c + ' has a base: rolling, brakes under paved\'s, a side grip', JSON.stringify(R));
    check(S && S.k > 0 && S.n > 0 && S.zMax > 0 && S.zMax <= 0.5 && Array.isArray(S.ski) && S.ski[0] > 0 && S.ski[1] > S.ski[0], 'B the layer ' + c + ' (k, n, zMax, a ski pair kinetic < breakout)', JSON.stringify(S));
  }
  for (let c = 0; c < 13; c++) check(c === 4 ? o.GROUND_SKI_MU[c] === null : (Array.isArray(o.GROUND_SKI_MU[c]) && o.GROUND_SKI_MU[c][0] < o.GROUND_SKI_MU[c][1]), 'B the ski\'s friction on ' + c, JSON.stringify(o.GROUND_SKI_MU[c]));
  check(o.GROUND_SKI_MU[8][0] <= 0.05 && o.GROUND_SKI_MU[8][0] < o.GROUND_SKI_MU[0][0], 'B a ski slides on packed snow (<= 0.05, SKI-REFERENCES 4.6) and better than on grass');
  for (const [nm, len] of o.sideTables) check(len === 13, 'B ' + nm + ' has 13 entries', len);

  // C. sinking with pressure (every soft layer)
  const W = (S, cls, D, N) => { const fp = C.tyreFootprint(cls, D); const F = wheel(S, N, fp[0], D, fp[1]); return { F, r: F / N, z: SINK.z, cap: SINK.cap }; };
  for (const c of SOFT) {
    const S = GSO[c];
    const a = W(S, 'standard', 0.4, 2000), b = W(S, 'standard', 0.4, 3000), bb = W(S, 'standard', 0.4, 4500);
    check(b.z > a.z && bb.z >= b.z && b.r > a.r, 'C ' + c + ': more load sinks deeper and drags more per newton', [a, b, bb].map(q => q.r.toFixed(3) + '/' + (q.z * 1000).toFixed(0) + 'mm').join(' '));
    const sm = W(S, 'standard', 0.3, 3000);
    check(sm.z > b.z && sm.r > b.r, 'C ' + c + ': a smaller wheel sinks deeper and drags more', sm.r.toFixed(3) + ' vs ' + b.r.toFixed(3));
    const tu = W(S, 'tundra', 0.4, 3000), sl = W(S, 'slim', 0.4, 3000);
    check(tu.z < b.z && tu.r < b.r && sl.z > b.z && sl.r > b.r, 'C ' + c + ': tundra floats, standard between, slim (narrow, hard) sinks', [tu, b, sl].map(q => q.r.toFixed(3)).join(' < '));
    // the pneumatic limit: a tyre presses the ground no harder than its load over its footprint (it flattens instead)
    let over = 0; for (const [cl, D, N] of [['standard', 0.4, 3000], ['tundra', 0.7, 3000], ['slim', 0.6, 5000], ['standard', 0.45, 6000]]) {
      const fp = C.tyreFootprint(cl, D); wheel(S, N, fp[0], D, fp[1]); if (SINK.p > N / fp[1] * (1 + 1e-9)) over++; }
    check(over === 0, 'C ' + c + ': a tyre presses no harder than its load over its footprint', over + ' over');
    const hv = W(S, 'slim', 0.3, 20000);
    check(hv.z <= S.zMax + 1e-12 && hv.cap === 1, 'C ' + c + ': never deeper than the layer (a heavy slim wheel bottoms at ' + S.zMax + ' m)', hv.z);
    // the rigid regime: a narrower tread at the same pressure law (b alone, the footprint off) drags more
    const nb = wheel(S, 3000, 0.08, 0.4, 0) / 3000, wb = wheel(S, 3000, 0.16, 0.4, 0) / 3000;
    check(nb > wb || SINK.cap === 1, 'C ' + c + ': a narrower rigid wheel drags more', nb.toFixed(3) + ' vs ' + wb.toFixed(3));
    // the plate (the ski)
    const p1 = plate(S, 6000, 0.8, 0.4), z1 = SINK.z, p2 = plate(S, 6000, 0.4, 0.4), z2 = SINK.z, p3 = plate(S, 6000, 0.4, 0.2), z3 = SINK.z;
    check(z2 > z1 && p2 > p1, 'C ' + c + ': a ski on half the area sinks deeper and ploughs more', (z1 * 1000).toFixed(1) + ' -> ' + (z2 * 1000).toFixed(1) + ' mm');
    check(z3 === z2 && p3 < p2, 'C ' + c + ': at one pressure the plough is the width\'s', p3.toFixed(1) + ' < ' + p2.toFixed(1));
    log('C ' + c + ' F/N, sinkage: standard 3 kN ' + b.r.toFixed(3) + ' ' + (b.z * 1000).toFixed(0) + ' mm | tundra ' + tu.r.toFixed(3) + ' ' + (tu.z * 1000).toFixed(0) + ' mm | slim ' + sl.r.toFixed(3) + ' ' + (sl.z * 1000).toFixed(0) + ' mm | ski 0.8 m2 ' + (z1 * 1000).toFixed(1) + ' mm');
  }
  check(wheel(GSO[9], 0, 0.1, 0.4, 0.01) === 0 && SINK.z === 0 && plate(GSO[9], 100, 0, 0.2) === 0, 'C no load, no area: no sink, no drag');

  // D. the runs
  if (o.runs) {
    const R = o.runs, g = R.stock[0].run, rr = (b, c) => R[b][c].run, ok = q => q && q.run !== null;
    for (const b of ['stock', 'tundra', 'tri']) for (const c of [0, 5, 8, 11]) check(ok(R[b][c]), 'D ' + b + ' reaches 0.9 Vs on ' + c);
    for (const b in R) for (const c in R[b]) check((+c >= 8) === R[b][c].softSeen && (+c < 8 || R[b][c].z > 0), 'D ' + b + ' on ' + c + ': the soft readouts exactly on the soft rows');
    check(Math.abs(rr('stock', 8) / g - 1) <= 0.15, 'D packed snow within 15 % of grass (stock)', (rr('stock', 8) / g).toFixed(2));
    check(ok(R.stock[9]) && rr('stock', 9) >= 1.3 * g, 'D powder at least 1.3 x grass on the stock tyres', R.stock[9].run && (R.stock[9].run / g).toFixed(2));
    check(ok(R.stock[10]) && rr('stock', 10) >= 1.3 * g, 'D wet snow at least 1.3 x grass on the stock tyres', R.stock[10].run && (R.stock[10].run / g).toFixed(2));
    check(rr('stock', 11) > g, 'D firm mud longer than grass', (rr('stock', 11) / g).toFixed(2));
    check(ok(R.stock[12]) && rr('stock', 12) >= 1.3 * g, 'D soft mud at least 1.3 x grass', R.stock[12].run && (R.stock[12].run / g).toFixed(2));
    for (const c of SOFT) check(ok(R.tundra[c]) && (!ok(R.stock[c]) || R.tundra[c].t < R.stock[c].t), 'D tundra tyres get off sooner than standard on ' + c, (R.tundra[c].t).toFixed(1) + ' vs ' + R.stock[c].t.toFixed(1) + ' s');
    for (const c of [0, 5]) check(Math.abs(R.tundra[c].run / R.stock[c].run - 1) < 0.02, 'D on the hard code ' + c + ' the carcass is its cornering only (within 2 %)', (R.tundra[c].run / R.stock[c].run).toFixed(4));
    check(R.stock[8].roll > R.stock[0].roll, 'D packed snow\'s braked roll longer than grass\'s', R.stock[8].roll.toFixed(1) + ' vs ' + R.stock[0].roll.toFixed(1) + ' m');
    check(!ok(R.tri[9]) && R.tri[9].V < 3, 'D the tricycle\'s small nose wheel bogs in powder (stuck: ' + R.tri[9].V.toFixed(1) + ' m/s after ' + R.tri[9].t.toFixed(0) + ' s)');
    const nm = { 0: 'grass', 5: 'paved', 8: 'snow packed', 9: 'powder', 10: 'wet snow', 11: 'mud firm', 12: 'mud soft' };
    for (const b in R) for (const c in R[b]) { const q = R[b][c];
      log('D ' + b.padEnd(6) + ' ' + nm[c].padEnd(11) + ' run ' + (q.run === null ? ('STUCK (' + q.V.toFixed(1) + ' m/s at ' + q.t.toFixed(0) + ' s)').padEnd(22) : (q.run.toFixed(0) + ' m ' + q.t.toFixed(1) + ' s (x' + (q.run / R[b][0].run).toFixed(2) + ')').padEnd(22)) +
        ' braked roll ' + (q.roll === null ? '-' : q.roll.toFixed(0) + ' m') + '  deepest sink ' + (q.z * 100).toFixed(1) + ' cm'); }
  }

  // E. the vocabulary
  const PG = C.PREMISES_GEN, LK = PG.RUNWAY_LOOKS;
  const want = { snow: 8, powder: 9, slush: 10, mud: 11, softmud: 12 };
  for (const k in want) check(LK[k] && +LK[k].surface === want[k] && (LK[k].cls === 'snow' || LK[k].cls === 'mud'), 'E the look ' + k + ' feels ' + want[k] + ' and draws a soft class', JSON.stringify(LK[k]));
  check(PG.SURFACE_NAMES.length === 13 && Object.keys(PG.SURFACE).length === 13 && PG.SURFACE_NAMES.every((n, i) => PG.SURFACE[n] === i), 'E the premises enum and its names: 13, in order');
  check(PG.PAVE_BAND.snow > 0 && PG.PAVE_BAND.mud > 0, 'E the soft classes have their band');
  const sS = o.stripSurface;
  for (const k of ['snow', 'powder', 'slush']) check(sS({ premises: true, look: k }).key === 'snow', 'E a ' + k + ' strip reads snow');
  for (const k of ['mud', 'softmud']) check(sS({ premises: true, look: k }).key === 'mud', 'E a ' + k + ' strip reads mud');
  for (let c = 8; c < 13; c++) check(sS({ surface: c }).key === (c < 11 ? 'snow' : 'mud'), 'E the enum ' + c + ' reads ' + (c < 11 ? 'snow' : 'mud'));
  check(o.stripAllows('wheels', { look: 'softmud' }).ok && o.stripAllows('skis', { look: 'powder' }).ok && !o.stripAllows('skis', { look: 'mud' }).ok && !o.stripAllows('floats', { look: 'snow' }).ok,
    'E wheels may use mud, skis snow and not mud, floats neither');
  return fail;
}

// ---- the inputs ---------------------------------------------------------------------------------------------------
function sideTables() {
  const src = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const arrLen = (s, re) => { const m = re.exec(s); return m ? m[1].split(',').length : -1; };
  const app = src('src/viewer/app.js'), wk = src('src/viewer/audio/airframe_worklet.js'), am = src('src/viewer/audio/airframe_model.js'), sv = src('src/core/30_solver.js');
  const DUST = require(path.join(ROOT, 'src', 'viewer', 'dust.js')), VEH = require(path.join(ROOT, 'src', 'vehicle', 'vehicle.js'));
  const afRows = (() => { const i = wk.indexOf('const AF_SURF = ['), j = wk.indexOf('\n];', i); return wk.slice(i, j).split('\n').filter(l => /^\s*\[/.test(l)).length; })();
  const dustSurf = /const DUST_SURF = \[([^\]]*)\]/.exec(app);
  return [
    ['TW_SKID_MU', Object.keys(C.TW_SKID_MU).length], ['GEN_DRIVE.turfS', C.GEN_DRIVE.turfS.length], ['SCAR_SURF', C.SCAR_SURF.length],
    ['STRIP_ENUM_SURF (via stripSurface)', [...Array(13).keys()].filter(c => C.stripSurface({ surface: c }).key).length],
    ['30_solver SCUFF_SOFT', arrLen(sv, /const SCUFF_SOFT = \[([^\]]*)\]/)],
    ['app.js DUST_SURF', dustSurf ? dustSurf[1].split(',').length : -1],
    ['app.js DUST_SURF -> dust classes', dustSurf ? dustSurf[1].split(',').map(s => s.trim().replace(/'/g, '')).filter(k => k === '-1' || DUST.CLASSES.indexOf(k) >= 0 || k === 'paved').length : -1],
    ['airframe_worklet AF_SURF', afRows], ['airframe_model AF_ROUGH', arrLen(am, /const AF_ROUGH = \[([^\]]*)\]/)],
    ['vehicle VEH_SURF', Object.keys(VEH.VEH_SURF).length],
  ];
}
function absentCase() {
  // a world whose surface says 0, against a world with no surface: the same roll, bit for bit; and no soft readout
  const roll = w => { const sim = C.makeSim(C.buildGen(), w); sim.reset(0); sim.ctl.thr = 1; const keys = new Set();
    for (let s = 0; s < 180; s++) { sim.step(1 / 60); if ('softZ' in sim.out || 'softF' in sim.out) keys.add('softZ'); }
    return { p: sim.cgPos(), keys }; };
  const a = roll(flat(0)), b = roll({ terrainH: () => 0, treesNear: () => [] });
  return { same: a.p.every((v, i) => v === b.p[i]), why: JSON.stringify(a.p) + ' vs ' + JSON.stringify(b.p), noField: a.keys.size === 0 && b.keys.size === 0, keys: [...a.keys, ...b.keys].join(',') };
}
function allRuns() {
  const builds = { stock: {}, tundra: { cage: { whProfile: 1 } }, tri: { gear: { type: 'tricycle' } } };
  const out = {};
  for (const b in builds) { out[b] = {}; for (const c of [0, 5, ...SOFT]) out[b][c] = runOn(builds[b], c, 60); }
  return out;
}
const live = () => ({ GROUND_SURF: C.GROUND_SURF, GROUND_SOFT: C.GROUND_SOFT, GROUND_SKI_MU: C.GROUND_SKI_MU, TW_SKID_MU: C.TW_SKID_MU,
  groundSinkWheel: C.groundSinkWheel, groundSinkPlate: C.groundSinkPlate, stripSurface: C.stripSurface, stripAllows: C.stripAllows });

if (BLESS) {
  const fx = JSON.parse(fs.readFileSync(FX, 'utf8'));
  fx.rolls = legacyRolls(); fx.what += ' (re-blessed ' + new Date().toISOString().slice(0, 10) + ')';
  fs.writeFileSync(FX, JSON.stringify(fx, null, 1) + '\n');
  console.log('GATE SOFTGROUND: fixture re-recorded - say why in the HANDOVER'); process.exit(0);
}
if (SELF) {
  const o0 = live(), bad = [];
  const doctor = (name, mut) => { const o = Object.assign({}, o0, { sideTables: sideTables() }); mut(o); const f = run(o); if (!f.length) bad.push(name); console.log('  selftest ' + name + ': ' + (f.length ? 'red (' + f[0] + ')' : 'STILL GREEN')); };
  doctor('a hard row moved', o => { o.GROUND_SURF = Object.assign({}, o.GROUND_SURF, { 6: [0.05, 0.38, 0.75] }); });
  doctor('a layer under grass', o => { o.GROUND_SOFT = Object.assign({}, o.GROUND_SOFT, { 0: o.GROUND_SOFT[8] }); });
  doctor('a row lost', o => { const g = Object.assign({}, o.GROUND_SURF); delete g[12]; o.GROUND_SURF = g; });
  doctor('the sink ignores the load', o => { o.groundSinkWheel = (S, N, b, D, A) => { C.GROUND_SINK.z = Math.min(S.zMax, 0.02); C.GROUND_SINK.cap = 0; return 0.05 * N; }; });
  doctor('the footprint ignored (a tyre sinks as rigid)', o => { o.groundSinkWheel = (S, N, b, D) => C.groundSinkWheel(S, N, b, D, 0); });
  doctor('the plate ignores its area', o => { o.groundSinkPlate = (S, N, A, w) => C.groundSinkPlate(S, N, 1, w); });
  doctor('skis allowed on mud', o => { o.stripAllows = (g, a) => (g === 'skis' ? { ok: true, why: '' } : C.stripAllows(g, a)); });
  doctor('a ski grips on packed snow', o => { o.GROUND_SKI_MU = Object.assign({}, o.GROUND_SKI_MU, { 8: [0.3, 0.4] }); });
  doctor('a legacy roll moved', o => { o.rolls = legacyRolls(); o.rolls['stock:0'] = o.rolls['stock:0'].map(v => v + 1e-12); });
  console.log('GATE SOFTGROUND selftest: ' + (bad.length ? 'FAIL (' + bad.join(', ') + ' stayed green)' : 'PASS (every doctored table and law went red)'));
  process.exit(bad.length ? 1 : 0);
}
const t0 = Date.now();
const o = Object.assign(live(), { sideTables: sideTables(), rolls: legacyRolls(), absent: absentCase(), runs: allRuns() });
const fail = run(o);
for (const f of fail) console.log('  FAIL ' + f);
console.log('  (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
console.log('GATE SOFTGROUND: ' + (fail.length ? 'FAIL (' + fail.length + ')' : 'PASS'));
process.exit(fail.length ? 1 : 0);
