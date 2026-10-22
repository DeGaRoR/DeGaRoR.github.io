#!/usr/bin/env node
// GATE ACCEPT (G2274, ACCEPT for the GAME COORDINATOR) — A BUILD'S ACCEPTANCE: THE CHECKS THAT NEED NO FLIGHT, THE LEG
// THAT IS FLOWN, AND THE VERDICT OVER A CONTRACT'S CRITERIA (src/core/72_accept.js; futureDesigns/GAME-2026-10-06.md
// §6.2, §R G-ACCEPT, §R GQ19).
//
//   node tools/_accept_check.js              -> "GATE ACCEPT: PASS|FAIL" (flies the legs: ~10 min wall on 4 cores)
//   node tools/_accept_check.js --reuse      -> the legs read back from reports/evidence/ACCEPT/flights.json
//   node tools/_accept_check.js --show       -> every check's line
//   node tools/_accept_check.js --selftest   -> negative verification: the core's own rules broken in its own source
//                                               (and the page's doors removed from theirs), each must go red; the
//                                               legs are the evidence file's (flown once)
//   --jobs=N                                 -> the flights' parallel processes (default 4)
//
// A. THE STATIC CHECKS on the validated builds (the user's Cub, the Jodel, the Cessna 172, the metal Cessna) plus the
//    user's 2 kWh electric trainer and the Cessna on floats: seats, empty mass, powertrain, tank / pack, span (and the
//    door rule), cost, the certificate's ultimate, the bench's crosswind and hydroplane - each against its known value
//    (the plaque's own genShakedown, the spec, the measured plan, a real certificate of the Cub, the bench's own
//    xwind row built by bench.js) - and NO SIMULATION in them (the phone runs them: GQ19): their sources hold no
//    solver call, and the lot runs in milliseconds.
// B. THE LEGS (tools/_accept_fly.js, one process each, run once): the Cub, Jodel, C172 and metal Cessna each hold a
//    5-minute stabilised cruise at 75 % throttle, 300 m over HOME, on the AP box; each leg valid, in its bands, signed,
//    published on the pilot; its numbers consistent (endurance = usable / flow - reserve, range = TAS x endurance);
//    the measured TAS and flow REPORTED against the shakedown's VCruise (solved, clamped to 1.55-2.2 Vs) and its
//    full-throttle / 0.67 endurance. The same Cub flight twice: the same record to the signature (deterministic).
//    A downburst mid-leg: the leg refused. A 7 m/s wind: the same TAS (calm-air), another groundspeed. The Cub flies
//    on home and stops: the logbook row (from HOME, stopped AT HOME, the landing run). The page's wrapper
//    (accept_rec.js) on a stub window, and the physics thread's door (sim_host.js 'accept'), each fly a short leg.
//    The stored legs are RE-MEASURED by the core under test (so the selftest's doctored rules meet the real flights).
// C. THE VERDICT (acceptVerdict) over a sample contract per kind - ok, fail, needs-flight, needs-test, the margin and
//    the bonus - and over §6.3's own examples; withdrawn under another fingerprint, a load not flown, a record
//    tampered with, a refused leg, an unknown kind.
// D. THE PAGE (source): the manifest, the frame hook, the logbook row's proof fields, the plaque's section and its
//    explanations, the bench's fingerprint doors and the xwind row's number, the worker's door.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const T = __dirname, ROOT = path.join(T, '..');
const argv = process.argv.slice(2);
const SHOW = argv.includes('--show'), SELF = argv.includes('--selftest'), REUSE = argv.includes('--reuse') || SELF;
const JOBS = (() => { const a = argv.find(x => x.startsWith('--jobs=')); return a ? Math.max(1, +a.slice(7)) : 4; })();
const EV_DIR = path.join(ROOT, 'reports', 'evidence', 'ACCEPT');
const FLIGHTS_FILE = path.join(EV_DIR, 'flights.json');
const CASES = ['cub', 'cub2', 'cubDist', 'cubWind', 'jodel', 'c172', 'metal', 'page', 'host'];
const LEGS = ['cub', 'jodel', 'c172', 'metal'];
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const L = require(path.join(T, '_treecrash_lib.js'));
const LB = require(path.join(T, '_load_build.js'));   // T41b (JOIN-PARITY): every validated build as the game loads it - the joined spec
const C0 = L.core();
const B = require(path.join(ROOT, 'src', 'viewer', 'bench.js'));

// ---- the flights, once -------------------------------------------------------------------------------------------
function flyAll() {
  if (REUSE && fs.existsSync(FLIGHTS_FILE)) return JSON.parse(fs.readFileSync(FLIGHTS_FILE, 'utf8'));
  const out = {}, queue = CASES.slice();
  const t0 = Date.now();
  // a pool of JOBS processes (spawnSync per case would serialise them)
  const run = name => new Promise(res => {
    const p = cp.spawn(process.execPath, [path.join(T, '_accept_fly.js'), name], { stdio: ['ignore', 'pipe', 'pipe'] });
    let o = '', e = '';
    p.stdout.on('data', d => { o += d; }); p.stderr.on('data', d => { e += d; });
    p.on('close', () => { try { out[name] = JSON.parse(o.trim().split('\n').pop()); } catch (x) { out[name] = { case: name, error: 'no JSON: ' + (e || o).slice(0, 400) }; } res(); });
  });
  const worker = async () => { while (queue.length) await run(queue.shift()); };
  return Promise.all(Array.from({ length: JOBS }, worker)).then(() => {
    out._wallS = Math.round((Date.now() - t0) / 1000);
    fs.mkdirSync(EV_DIR, { recursive: true });
    fs.writeFileSync(FLIGHTS_FILE, JSON.stringify(out));
    return out;
  });
}

// ---- the builds (static) -----------------------------------------------------------------------------------------
const BUILDS = { cub: 'builds/cub_2026-09-20_corrected.json', jodel: 'builds/jodel_2026-09-20_corrected.json',
                 c172: 'builds/cessna172_2026-09-20_corrected.json', metal: 'bugReports/cessnaMetal (1).json',
                 eTrainer: 'bugReports/flydiy-build (4).json', floats: 'bugReports/cessnaFloatsWOrks.json' };
function staticFixtures() {
  const D = {};
  for (const k of Object.keys(BUILDS)) {
    const spec = LB.loadBuild(BUILDS[k]).spec;   // (was the file as written: JOIN-PARITY)
    const def = C0.buildGen(C0.genMigrateSpec(spec));
    const sh = C0.genShakedown(def, { corners: false, slim: true });
    D[k] = { def, sh, fp: B.benchFingerprint(spec, null) };
  }
  // A REAL CERTIFICATE of the Cub (66_gen_cert, 8-24 s): what a contract's structural criterion reads
  const t0 = Date.now();
  const cert = C0.genCertify(D.cub.def);
  D.cub.cert = { limit: cert.limit, ult: cert.ult };
  D.certS = (Date.now() - t0) / 1000;
  // the bench's own crosswind row (bench.js BENCH_TESTS xwind), built from a ladder's result: the number it now carries
  const XT = B.BENCH_TESTS.find(t => t.id === 'xwind');
  try { D.xwRow = XT.poll({ xwindPoll: () => ({ done: true, result: { limit: 6.2, cap: 10, roll: 310, e: 0.05 }, runs: [] }) }); }
  catch (e) { D.xwRow = { error: String(e) }; }
  try { D.xwRowCap = XT.poll({ xwindPoll: () => ({ done: true, result: { limit: null, cap: 10, roll: 300 }, runs: [] }) }); }
  catch (e) { D.xwRowCap = { error: String(e) }; }
  return D;
}

// ---- the checks (C: the core under test; src: the page's sources) ---------------------------------------------
function runChecks(C, F, D, src, quiet) {
  let checks = 0, fails = 0;
  const lines = [];
  const ok = (cond, msg) => { checks++; if (!cond) { fails++; lines.push('  FAIL ' + msg); } else if (SHOW && !quiet) lines.push('  ok   ' + msg); return !!cond; };
  const rep = s => { if (!quiet) lines.push('  ' + s); };
  const near = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= tol;
  const st = (k, crit, ev) => C.acceptStatic(Object.assign({ k }, crit), ev);

  // ===== A. THE STATIC CHECKS =====
  const EV = {};
  for (const k of Object.keys(BUILDS)) EV[k] = C.acceptEvidence(D[k].def, { cert: D[k].cert || null });
  for (const k of ['cub', 'jodel', 'c172', 'metal', 'eTrainer', 'floats']) {
    const e = EV[k], sh = D[k].sh, S = D[k].def.spec;
    ok(near(e.emptyKg, sh.empty, 0.05), k + ': emptyKg = the plaque\'s empty (genShakedown) ' + (e.emptyKg || 0).toFixed(1) + ' / ' + sh.empty.toFixed(1));
    ok(near(e.cost, sh.cost, 0.5), k + ': cost = the plaque\'s cost ' + Math.round(e.cost || 0) + ' / ' + Math.round(sh.cost));
    ok(near(e.emptyKg + e.payloadKg, sh.mass, 0.6), k + ': empty + payload = the all-up mass the sim flies (' + sh.mass.toFixed(1) + ')');
    ok(e.seats === S.seats && e.occupants === S.occupants, k + ': seats ' + e.seats + ' (capacity), ' + e.occupants + ' aboard as drawn');
    const foot = C0.playerFootOfDef(D[k].def);
    ok(near(e.spanM, 2 * foot.half, 1e-9) && near(e.spanM, sh.span, 0.35), k + ': span ' + e.spanM + ' m = the measured plan (the aero span ' + sh.span.toFixed(2) + ')');
    const fam = D[k].def.params.engine.family;
    ok(e.powertrain === (fam === 'electric' ? 'electric' : fam === 'turbine' ? 'turbine' : 'piston'), k + ': powertrain ' + e.powertrain + ' (' + fam + ')');
    if (e.powertrain === 'electric') ok(e.tankL === 0 && e.batteryKWh === (S.energy.kWh), k + ': no tank, the pack ' + e.batteryKWh + ' kWh');
    else ok(e.tankL === S.fuel.litres && e.batteryKWh === 0, k + ': the tank ' + e.tankL + ' L, no pack');
  }
  // the known values the user's builds carry (the PREM-S2 / plaque figures)
  // T41b (JOIN-PARITY's correction, agreed with GAME 10 Oct): the Cub the game FLIES carries 27 L - its drawn nose tank, the
  // joined spec (tools/_load_build.js); the 45 L was the build file's number, which the game never flies
  ok(EV.cub.seats === 2 && EV.cub.occupants === 1 && EV.cub.tankL === 27 && EV.cub.powertrain === 'piston' && EV.cub.spanM === 10.8,
     'the user\'s Cub: 2 seats (1 aboard), ' + EV.cub.tankL + ' L (the drawn tank, as flown), piston, 10.8 m across');
  ok(EV.cub.emptyKg > 330 && EV.cub.emptyKg < 380, 'the Cub empty ' + EV.cub.emptyKg.toFixed(1) + ' kg (a J-3 is 310-340: the model\'s, in its band)');
  ok(EV.eTrainer.powertrain === 'electric' && EV.eTrainer.batteryKWh === 2, 'the user\'s electric trainer: electric, 2 kWh');
  ok(EV.c172.seats >= 4, 'the C172: ' + EV.c172.seats + ' seats');
  // each static kind through acceptStatic: pass and fail at the known value
  const cub = EV.cub;
  ok(st('seats', { v: 2 }, cub).ok && !st('seats', { v: 3 }, cub).ok, 'seats >= 2 ok, >= 3 refused on the Cub');
  ok(st('emptyKg', { v: 360 }, cub).ok && !st('emptyKg', { v: 300 }, cub).ok, 'emptyKg <= 360 ok, <= 300 refused');
  ok(st('powertrain', { v: 'piston' }, cub).ok && !st('powertrain', { v: 'electric' }, cub).ok && st('powertrain', { v: 'electric' }, EV.eTrainer).ok, 'powertrain piston / electric');
  ok(st('tankL', { v: 45 }, cub).ok && !st('tankL', { v: 20 }, cub).ok, 'tankL <= 45 ok, <= 20 refused');
  ok(st('batteryKWh', { v: 2 }, EV.eTrainer).ok && !st('batteryKWh', { v: 1.5 }, EV.eTrainer).ok, 'batteryKWh <= 2 ok, <= 1.5 refused (the trainer)');
  ok(st('spanM', { v: 11 }, cub).ok && !st('spanM', { v: 9 }, cub).ok, 'spanM <= 11 ok, <= 9 refused');
  ok(!st('spanM', { at: { door: 11.3 } }, cub).ok && st('spanM', { at: { door: 11.4 } }, cub).ok, 'through a door: 10.8 m needs 11.4 (0.3 m a side): 11.3 refused, 11.4 passes');
  const field = { shell: 'field', dims: { HW: 6, HD: 6, EAVE: 4 } };
  const fieldDoor = C0.hangarDoor(field).w, fieldWhy = C0.hangarDoorWhy(field, C0.playerFootOfDef(D.cub.def));
  const sd = st('spanM', { at: { shed: field } }, cub);
  ok(sd.ok === !fieldWhy && sd.ok === (10.8 + 0.6 <= fieldDoor), 'through a shed: hangarDoor\'s own rule (' + fieldDoor.toFixed(1) + ' m door: ' + (sd.ok ? 'passes' : sd.why) + ')');
  const narrow = { shell: 'field', dims: { HW: 5.5, HD: 6, EAVE: 4 } };
  ok(!st('spanM', { at: { shed: narrow } }, cub).ok, 'a 6 m door (HW 5.5) refuses the Cub (' + C0.hangarDoorWhy(narrow, C0.playerFootOfDef(D.cub.def)) + ')');
  ok(st('costMax', { v: Math.ceil(cub.cost) }, cub).ok && !st('costMax', { v: 25000 }, cub).ok, 'costMax at the ledger ok, <= 25000 refused (' + Math.round(cub.cost) + ')');
  ok(D.cub.cert.ult === C0.GEN_CERT.ult && D.cub.cert.limit === C0.GEN_CERT.limit, 'the Cub\'s certificate (computed, ' + D.certS.toFixed(0) + ' s): limit ' + D.cub.cert.limit + ' g, ultimate ' + D.cub.cert.ult + ' g');
  ok(st('ultimateG', { v: 5.7 }, cub).ok && !st('ultimateG', { v: 6 }, cub).ok, 'ultimateG >= 5.7 ok, >= 6 refused (the normal category\'s certificate)');
  ok(st('ultimateG', { v: 3 }, EV.jodel).value === null, 'no certificate: no value (a test to run), not a pass');
  ok(D.xwRow && D.xwRow.limit === 6.2 && D.xwRow.capped === false && D.xwRowCap.capped === true && D.xwRowCap.limit === 10, 'the bench\'s crosswind row carries its limit (6.2 m/s; capped > 10)');
  const xw = st('xwindKt', { v: 12 }, Object.assign({}, cub, { bench: { xwind: D.xwRow } }));
  ok(xw.ok && near(xw.value, 12.1, 0.05), 'xwindKt from the bench\'s row: 6.2 m/s = ' + xw.value + ' kt >= 12');
  ok(!st('xwindKt', { v: 13 }, Object.assign({}, cub, { bench: { xwind: D.xwRow } })).ok, 'xwindKt >= 13 refused');
  ok(near(st('xwindKt', { v: 1 }, { bench: { xwind: { verdict: 'CROSSWIND LIMIT 4.1 m/s', ok: true } } }).value, 8.0, 0.05), 'an older row (no `limit`) read off its verdict: 4.1 m/s = 8.0 kt');
  ok(st('xwindKt', { v: 1 }, { bench: { xwind: Object.assign({}, D.xwRow, { stale: true }) } }).value === null, 'a WITHDRAWN crosswind row counts for nothing');
  ok(st('hydro', {}, { bench: { hydro: { ok: true, verdict: 'LIFTS OFF THE WATER' } } }).ok && !st('hydro', {}, { bench: { hydro: { ok: false, verdict: 'STUCK AT THE HUMP' } } }).ok
     && st('hydro', {}, EV.floats).value === null, 'hydro: lifts off ok, stuck refused, not run = no value');
  // NO SIMULATION (GQ19): the sources of the static door hold no solver call, and they run in milliseconds
  const SOLVER = /\bmakeSim\b|genShakedown|genCertify|makePilot|buildGen|\.step\(|genTrim|genDensityAlt|makeLoadTest/;
  for (const fn of ['acceptStatic', 'acceptEvidence', 'acceptBenchXwind'])
    ok(typeof C[fn] === 'function' && !SOLVER.test(C[fn].toString()), 'no simulation in ' + fn + ' (the phone runs it)');
  const t0 = process.hrtime.bigint();
  for (let r = 0; r < 20; r++) for (const k of Object.keys(BUILDS)) { const e = C.acceptEvidence(D[k].def); for (const kk of Object.keys(C.ACCEPT_KINDS)) if (C.ACCEPT_KINDS[kk].src === 'static') C.acceptStatic({ k: kk, v: 1 }, e); }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 20;
  ok(ms < 50, 'every static kind on six builds: ' + ms.toFixed(2) + ' ms a pass');

  // ===== B. THE LEGS =====
  const bad = CASES.filter(c => !F[c] || F[c].error);
  ok(!bad.length, 'every flight flew' + (bad.length ? ' (' + bad.map(c => c + ': ' + (F[c] ? String(F[c].error).slice(0, 160) : 'missing')).join(' | ') + ')' : ''));
  rep('THE LEGS (5 min, 75 % throttle, HOME + 300 m; TAS calm-air)        TAS km/h  VCruise (clamp)    flow           endurance flown / shakedown   range');
  for (const k of LEGS) {
    const f = F[k]; if (!f || f.error) continue;
    const r = f.record, s = f.shake;
    ok(!f.bad && f.stage === 'done' && f.settledQuiet, k + ': the leg flown to the end (settled quiet, no NaN)');
    ok(r && r.valid && !r.why.length, k + ': the leg VALID' + (r && r.why.length ? ' — ' + r.why.join('; ') : ''));
    ok(C.acceptSigned(r) && r.fp === f.fp, k + ': signed (' + (r && r.sig) + ') under the build\'s fingerprint ' + f.fp);
    ok(f.published && f.published.stage === 'done' && f.published.sig === r.sig, k + ': published on the pilot (ap.accept) with the same record');
    ok(Math.abs(f.nSamples - 301) <= 1 && r.durS >= 299, k + ': ' + f.nSamples + ' samples over ' + r.durS.toFixed(0) + ' s');
    ok(Math.abs(r.bands.alt[0]) <= 10 && Math.abs(r.bands.alt[1]) <= 10 && Math.abs(r.bands.tas[0]) <= 0.03 && r.bands.tas[1] <= 0.03 && r.bands.bankMax <= 5,
       k + ': in its bands: alt ' + r.bands.alt.join('..') + ' m, TAS ' + r.bands.tas.map(x => (x * 100).toFixed(1)).join('..') + ' %, bank ' + r.bands.bankMax + '°');
    ok(near(r.grossMin, r.usable / r.flow * 60, 0.1) && near(r.enduranceMin, r.grossMin - 15, 0.1), k + ': endurance = usable ' + r.usable + ' ' + r.usableUnit + ' / ' + r.flow + ' ' + r.flowUnit + ' - 15 min = ' + r.enduranceMin + ' min');
    ok(near(r.rangeKm, r.tasKmh * r.enduranceMin / 60, 0.6), k + ': range = TAS x endurance = ' + r.rangeKm + ' km');
    const flowK = r.flow / s.burnKgH;
    ok(flowK > 0.5 && flowK < 0.95, k + ': the flow is ' + (flowK * 100).toFixed(0) + ' % of the full-throttle burn at 75 % throttle');
    const clamped = s.VCruiseKmh >= s.clampHi - 0.5;
    ok(r.tasKmh > s.VCruiseKmh, k + ': the flown TAS ' + r.tasKmh + ' > the solved VCruise ' + s.VCruiseKmh + (clamped ? ' (CLAMPED at 2.2 Vs)' : ''));
    rep(('  ' + k).padEnd(70) + String(r.tasKmh).padStart(7) + '   ' + (s.VCruiseKmh + ' (' + s.clampHi + (clamped ? ' CLAMPED' : '') + ')').padEnd(19)
      + (r.flow + ' kg/h' + (r.flowLh != null ? ' ' + r.flowLh + ' L/h' : '')).padEnd(22) + (r.grossMin + ' min / ' + Math.round(s.enduranceCruiseH * 60) + ' min').padEnd(22) + r.rangeKm + ' km (shakedown ' + Math.round(s.rangeKm) + ')');
  }
  const cubF = F.cub, cub2 = F.cub2, dist = F.cubDist, wind = F.cubWind;
  if (cubF && cub2 && !cubF.error && !cub2.error) {
    ok(cubF.record.sig === cub2.record.sig && cubF.sampleHash === cub2.sampleHash && JSON.stringify(cubF.row) === JSON.stringify(cub2.row),
       'DETERMINISTIC: the Cub flown twice - the same record (' + cubF.record.sig + ' / ' + cub2.record.sig + '), the same samples, the same landing row');
  }
  if (dist && !dist.error) {
    ok(dist.record && !dist.record.valid && dist.record.why.some(w => /band/.test(w)) && C.acceptSigned(dist.record),
       'a DOWNBURST mid-leg: the leg REFUSED, signed as refused (' + (dist.record ? dist.record.why.join('; ') : '—') + ')');
  }
  if (wind && cubF && !wind.error && !cubF.error) {
    const dT = Math.abs(wind.record.tasKmh / cubF.record.tasKmh - 1), dG = Math.abs(wind.record.gsKmh - wind.record.tasKmh);
    ok(wind.record.valid && dT < 0.01 && dG > 5 && Math.abs(wind.record.flow / cubF.record.flow - 1) < 0.01,
       'CALM-AIR: in a 7.2 m/s wind the TAS ' + wind.record.tasKmh + ' km/h (calm ' + cubF.record.tasKmh + ', ' + (dT * 100).toFixed(2) + ' %), the groundspeed ' + wind.record.gsKmh + ', the flow the same');
  }
  if (cubF && !cubF.error) {
    const rw = cubF.row || {};
    ok(rw.from === 'HOME' && rw.at === 'HOME' && rw.sink != null && rw.run > 0 && !rw.outcome && rw.fp === cubF.fp && rw.occ === 1,
       'the Cub flew home and STOPPED: the logbook row from HOME, at HOME (flightWhere), sink ' + rw.sink + ' m/s, run ' + rw.run + ' m, 1 aboard, its fingerprint');
  }
  // THE STORED LEGS RE-MEASURED by the core under test: the same numbers off the same samples
  for (const k of ['cub', 'cubDist', 'cubWind']) {
    const f = F[k]; if (!f || f.error || !f.all) continue;
    const m = C.acceptLegMeasure(f.all, { E0: f.load.E0, kind: f.load.kind, kgL: f.load.kgL, thr: 0.75, alt: f.record.decl.alt, legMin: 5 });
    const same = ['valid', 'tasKmh', 'gsKmh', 'flow', 'grossMin', 'enduranceMin', 'rangeKm'].every(q => m[q] === f.record[q]);
    ok(same, k + ': re-measured off its samples, the same record (' + ['valid', 'tasKmh', 'enduranceMin', 'rangeKm'].map(q => q + ' ' + m[q]).join(', ') + ')');
    if (k === 'cubDist') ok(!m.valid && m.why.some(w => /height left its band/.test(w)) && m.why.some(w => /speed left its band/.test(w)),
                            'cubDist re-measured: still refused, on BOTH bands it broke (the height and the speed)');
    if (k === 'cubWind' && F.cub && F.cub.all) ok(Math.abs(m.tasKmh / C.acceptLegMeasure(F.cub.all, { E0: F.cub.load.E0, kind: 'fuel', thr: 0.75, alt: F.cub.record.decl.alt }).tasKmh - 1) < 0.01, 'cubWind re-measured: the calm TAS');
  }
  // THE PAGE'S WRAPPER (accept_rec.js, stub window, the page's own sim)
  const P = F.page;
  if (P && !P.error) {
    ok(P.refuseGround && !P.refuseGround.ok && /air/.test(P.refuseGround.why), 'page: refused on the ground (' + (P.refuseGround && P.refuseGround.why) + ')');
    ok(P.refuseHand && !P.refuseHand.ok && /hand/.test(P.refuseHand.why), 'page: refused under the hand (' + (P.refuseHand && P.refuseHand.why) + ')');
    ok(P.start && P.start.ok && P.start.where === 'page' && P.refuseTwice && !P.refuseTwice.ok, 'page: started on the page\'s own sim; a second start refused');
    const rec = (P.log.accept || [])[0];
    ok(P.signedOnce === 1 && rec && rec.valid && C.acceptSigned(rec) && rec.fp === P.fp && rec.decl.legMin === 0.5, 'page: the leg SIGNED INTO THE LOGBOOK once (log.accept), valid, the roll-out fingerprint');
    ok(P.log.tests.some(t => t.id === 'accept' && t.ok && /proved in flight/.test(t.verdict)), 'page: the logbook note (' + ((P.log.tests.find(t => t.id === 'accept') || {}).verdict) + ')');
    ok(P.plaque && P.plaque.leg && P.plaque.leg.sig === (rec && rec.sig) && !P.plaque.withdrawn && P.plaqueOther && P.plaqueOther.withdrawn, 'page: the plaque\'s row = that leg; under another fingerprint WITHDRAWN');
    const vr = P.verdict && P.verdict.rows;
    ok(vr && vr[0].status === 'ok' && vr[1].status === 'ok' && vr[2].status === 'needs-flight', 'page: the contract door - tasKmh ok, seats ok, landAt HOME needs a flight');
  }
  const Hh = F.host;
  if (Hh && !Hh.error) {
    ok(['climb', 'settle', 'record', 'done'].every(s => Hh.stages.indexOf(s) >= 0) && Hh.record && Hh.record.valid && C.acceptSigned(Hh.record) && Hh.record.fp === Hh.fp && Hh.hostLegCleared,
       'the physics thread: the \'accept\' command flies the leg on the host\'s step; its state reaches the page through the snapshot (' + Hh.stages.join(' > ') + '), signed, valid');
  }

  // ===== C. THE VERDICT =====
  const legCub = cubF && cubF.record, rowCub = cubF && cubF.row, fpCub = cubF && cubF.fp;
  const evC = C.acceptEvidence(D.cub.def, { cert: D.cub.cert, bench: { xwind: D.xwRow }, legs: legCub ? [legCub] : [], flights: rowCub ? [rowCub] : [], fp: fpCub });
  const V = (crit, ev) => C.acceptVerdict(crit, ev || evC);
  const one = (c, ev) => V([c], ev).rows[0];
  const per = [
    [{ k: 'seats', v: 2 }, 'ok'], [{ k: 'seats', v: 4 }, 'fail'],
    [{ k: 'emptyKg', v: 400 }, 'ok'], [{ k: 'emptyKg', v: 300 }, 'fail'],
    [{ k: 'powertrain', v: 'piston' }, 'ok'], [{ k: 'powertrain', v: 'electric' }, 'fail'],
    [{ k: 'tankL', v: 50 }, 'ok'], [{ k: 'tankL', v: 20 }, 'fail'],
    [{ k: 'batteryKWh', v: 10 }, 'ok'],
    [{ k: 'spanM', v: 11 }, 'ok'], [{ k: 'spanM', v: 9 }, 'fail'],
    [{ k: 'costMax', v: 40000 }, 'ok'], [{ k: 'costMax', v: 25000 }, 'fail'],
    [{ k: 'ultimateG', v: 5.7 }, 'ok'], [{ k: 'ultimateG', v: 6 }, 'fail'],
    [{ k: 'xwindKt', v: 8 }, 'ok'], [{ k: 'xwindKt', v: 15 }, 'fail'],
    [{ k: 'hydro', v: true }, 'needs-test'],
    [{ k: 'tasKmh', v: 110 }, 'ok'], [{ k: 'tasKmh', v: 200 }, 'fail'],
    [{ k: 'enduranceMin', v: 60 }, 'ok'], [{ k: 'enduranceMin', v: 600 }, 'fail'],
    [{ k: 'rangeKm', v: 100 }, 'ok'], [{ k: 'rangeKm', v: 5000 }, 'fail'],
    [{ k: 'takeoffAt', at: 'HOME' }, 'ok'], [{ k: 'takeoffAt', at: 'A4' }, 'needs-flight'],
    [{ k: 'landAt', at: 'HOME' }, 'ok'], [{ k: 'landAt', at: 'A4' }, 'needs-flight'],
    [{ k: 'warpDrive', v: 1 }, 'fail'],
  ];
  for (const [c, want] of per) { const r = one(c); ok(r.status === want, 'verdict ' + c.k + ' ' + (c.op || '') + JSON.stringify(c.v != null ? c.v : c.at) + ' -> ' + r.status + (r.value != null ? ' (' + r.value + ')' : '') + (r.status !== want ? ' WANTED ' + want : '')); }
  ok(Object.keys(C.ACCEPT_KINDS).every(k => per.some(p => p[0].k === k)), 'every kind (' + Object.keys(C.ACCEPT_KINDS).length + ') has a sample criterion');
  if (legCub) {
    const r = one({ k: 'tasKmh', v: 110 });
    ok(r.margin === Math.round((legCub.tasKmh - 110) * 100) / 100 && r.beat === (r.marginPct >= 0.1), 'the margin: TAS ' + legCub.tasKmh + ' vs 110 = +' + r.margin + ' km/h (' + (r.marginPct * 100).toFixed(1) + ' %), bonus ' + (r.beat ? 'earned' : 'not earned'));
    ok(one({ k: 'tasKmh', v: 110, by: 0.5 }).beat === false, 'a stated margin of 50 % is not beaten');
    const v3 = V([{ k: 'tasKmh', v: 100 }, { k: 'emptyKg', v: 500 }, { k: 'seats', v: 2 }]);
    ok(v3.ok && v3.beaten === 2 && v3.bonusPct === 20, 'three criteria held, two beaten by >= 10 %: +' + v3.bonusPct + ' % (seats equal: no margin)');
    const rr = one({ k: 'enduranceMin', v: 60, reserveMin: 45 });
    ok(rr.value === Math.round((legCub.grossMin - 45) * 10) / 10, 'a criterion\'s own reserve: 45 min off the gross ' + legCub.grossMin + ' = ' + rr.value);
    ok(one({ k: 'tasKmh', v: 100, at: { occupants: 2 } }).status === 'needs-flight', 'a load not flown (2 aboard; the leg had 1): needs a flight');
    ok(one({ k: 'tasKmh', v: 100, at: { occupants: 1 } }).status === 'ok', 'the load flown (1 aboard): counts');
    const wd = one({ k: 'tasKmh', v: 100 }, Object.assign({}, evC, { fp: 'ffffffff' }));
    ok(wd.status === 'needs-flight' && /withdrawn/.test(wd.source), 'another fingerprint (the build changed): the leg WITHDRAWN (' + wd.source + ')');
    const tamper = Object.assign({}, legCub, { tasKmh: legCub.tasKmh + 50 });
    ok(one({ k: 'tasKmh', v: 100 }, Object.assign({}, evC, { legs: [tamper] })).status === 'needs-flight', 'a record edited after the flight (TAS +50) does not verify: not counted');
    if (dist && dist.record) {
      const rf = one({ k: 'tasKmh', v: 100 }, Object.assign({}, evC, { legs: [dist.record] }));
      ok(rf.status === 'needs-flight' && /VALID/.test(rf.source), 'only a refused leg: needs a flight (' + rf.source + ')');
    }
    const pq = C.acceptPlaqueLeg([legCub], fpCub), pqo = C.acceptPlaqueLeg([legCub], 'ffffffff'), pqd = dist && dist.record ? C.acceptPlaqueLeg([dist.record], fpCub) : null;
    ok(pq && pq.leg.sig === legCub.sig && !pq.withdrawn && pqo && pqo.withdrawn && pqd === null, 'the plaque\'s row: the leg under its fingerprint, WITHDRAWN under another, nothing for a refused leg');
    ok(one({ k: 'landAt', at: 'HOME' }, Object.assign({}, evC, { flights: [Object.assign({}, rowCub, { at: null })] })).status === 'needs-flight', 'a row that did not stop on the strip proves no landing there');
    ok(one({ k: 'landAt', at: 'HOME' }, Object.assign({}, evC, { fp: 'ffffffff' })).status === 'needs-flight', 'a row of another build proves nothing');
    ok(one({ k: 'takeoffAt', at: 'HOME' }, Object.assign({}, evC, { flights: [Object.assign({}, rowCub, { sink: null, outcome: 'rejected-takeoff' })] })).status === 'needs-flight', 'a rejected take-off proves no take-off');
  }
  // §6.3's examples, as contracts
  const evC172 = C.acceptEvidence(D.c172.def, { legs: F.c172 && F.c172.record ? [F.c172.record] : [], flights: [], fp: F.c172 && F.c172.fp });
  const team = C.acceptVerdict([{ k: 'seats', v: 4 }, { k: 'tasKmh', v: 200, at: { occupants: 4 } }, { k: 'landAt', at: 'A4' }], evC172);
  ok(team.rows[0].status === 'ok' && team.rows[1].status === 'needs-flight' && team.rows[2].status === 'needs-flight' && !team.ok,
     '§6.3 "my team of four to the mine, fast" on the C172: 4 seats ok; 200 km/h WITH 4 ABOARD and the landing at the strip still to fly');
  const shed = V([{ k: 'emptyKg', v: 300 }, { k: 'spanM', v: 9 }, { k: 'seats', v: 1 }]);
  ok(!shed.ok && shed.rows[0].status === 'fail' && shed.rows[1].status === 'fail' && shed.rows[2].status === 'ok', '§6.3 "under 300 kg, out of the shed alone" on the Cub: refused on mass and span');
  const tank = V([{ k: 'tankL', v: 20 }, { k: 'enduranceMin', v: 60, reserveMin: 15 }, { k: 'tasKmh', v: 110 }]);
  ok(!tank.ok && tank.rows[0].status === 'fail' && tank.rows[1].status === 'ok' && tank.rows[2].status === 'ok', '§6.3 "an hour on 20 litres" on the Cub: the hour and the speed flown, the 45 L tank refused');
  const evE = C.acceptEvidence(D.eTrainer.def, { legs: [], flights: [] });
  const resort = C.acceptVerdict([{ k: 'powertrain', v: 'electric' }, { k: 'seats', v: 1 }, { k: 'enduranceMin', v: 30 }], evE);
  ok(resort.rows[0].status === 'ok' && resort.rows[2].status === 'needs-flight' && resort.needsFlight.includes('enduranceMin'), '§6.3 "electric" on the trainer: electric ok, the endurance to fly');
  const aero = V([{ k: 'ultimateG', v: 6 }]);
  ok(aero.rows[0].status === 'fail' && aero.rows[0].value === 5.7, '§6.3 "the aerobatic box" (+6 g ultimate): the certificate says 5.7 - refused (OPEN: a category on the certificate)');
  const club = V([{ k: 'costMax', v: 25000 }, { k: 'xwindKt', v: 12 }]);
  ok(club.rows[0].status === 'fail' && club.rows[1].status === 'ok', '§6.3 "cheap and forgiving": the crosswind ok, the cost refused');
  if (typeof C.CONTRACT_CRIT_KINDS !== 'undefined' && C.CONTRACT_CRIT_KINDS) {
    const ks = Array.isArray(C.CONTRACT_CRIT_KINDS) ? C.CONTRACT_CRIT_KINDS : Object.keys(C.CONTRACT_CRIT_KINDS);
    ok(ks.every(k => C.ACCEPT_KINDS[k]), 'CONTRACT-MODEL\'s CONTRACT_CRIT_KINDS all answered (' + ks.filter(k => !C.ACCEPT_KINDS[k]).join(', ') + ')');
  } else rep('(CONTRACT_CRIT_KINDS not in this tree: CONTRACT-MODEL lands it; ACCEPT answers ' + Object.keys(C.ACCEPT_KINDS).join(', ') + ')');

  // ===== D. THE PAGE (source) =====
  const S = src;
  ok(/'71_player_bases\.js',[\s\S]*'72_accept\.js',[\s\S]*'90_node_exports\.js'/.test(S.build) && /'bench\.js', 'accept_rec\.js'/.test(S.build), 'the manifest: 72_accept.js before the exports, accept_rec.js after bench.js');
  ok(/hudEnergy\(\);\s*\n\s*if \(window\.ACCEPT_REC\) window\.ACCEPT_REC\.frame\(\);/.test(S.app), 'app.js: the leg ticked and signed beside the HUD (ACCEPT_REC.frame)');
  ok(/flightLogged = true;\s*\n\s*if \(window\.ACCEPT_REC\) window\.ACCEPT_REC\.flightEnd\(\);/.test(S.app), 'app.js logFlight: a leg still flying ends with the flight');
  ok(/r\.at = at;/.test(S.app) && /acceptStopAt\(world, cg\[0\], cg\[2\]\)/.test(S.app) && /r\.occ = S\.occupants/.test(S.app) && /r\.fp = fpo/.test(S.app), 'app.js logFlight: the row says where it stopped, who was aboard, which build');
  const blk = (S.app.split("H('proved in flight')")[1] || '').split('// G134')[0];
  const labels = (blk.match(/R\('([^']+)'/g) || []).map(x => x.slice(3, -1));
  ok(/window\.ACCEPT_REC\.plaqueLeg\(\)/.test(S.app) && labels.length >= 6, 'app.js drawPlaque: the "proved in flight" section (' + labels.join(', ') + ')');
  ok(labels.every(l => new RegExp("'" + l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "': \\{ what:").test(S.plaque)) && /'proved in flight': 'the acceptance leg/.test(S.plaque), 'plaque.js: every row explained, the section its line');
  ok(/window\.BENCH_FP_OUT = \(\) => outFp;/.test(S.bench) && /window\.BENCH_FP = \(\) => fpNow\(\);/.test(S.bench), 'bench.js: the roll-out and live fingerprints, for the leg and the plaque');
  ok(/case 'accept': \{/.test(S.host) && /if \(H\.accept\) \{ const st = H\.accept\.tick\(sim, ap\)/.test(S.host) && /'site', 'accept'\]/.test(S.host), 'sim_host.js: the command, the tick before the pilot\'s update, the state as a rare pilot field');
  ok(/function accept\(m\)/.test(S.link) && /card, place, accept,/.test(S.link), 'sim_link.js: the accept door in its api');
  // THE ENVELOPE (garage.js): the logbook rides beside the spec untouched, so the signed legs survive a save and a load
  ok(/log: lg \|\| newLog\(\)/.test(S.garage) && /log: o\.log \|\| newLog\(\)/.test(S.garage), 'garage.js: the envelope writes and reads the logbook as it is (log.accept rides along)');
  if (legCub) {
    const env = JSON.parse(JSON.stringify({ what: 'flydiy-build', log: { built: null, tests: [], flights: [rowCub], accept: [legCub] } }));
    ok(C.acceptSigned(env.log.accept[0]) && C.acceptVerdict([{ k: 'tasKmh', v: 100 }, { k: 'landAt', at: 'HOME' }], C.acceptEvidence(D.cub.def, { legs: env.log.accept, flights: env.log.flights, fp: fpCub })).ok,
       'a saved and loaded logbook: the leg still verifies, the verdict the same');
  }
  ok(/lg\.accept\.push\(/.test(S.rec) && /acceptLegStart\(sim, ap, def, o\)/.test(S.rec) && /S\.accept\(\{ op: 'start', o \}\)/.test(S.rec), 'accept_rec.js: the leg started where the pilot flies, signed into log.accept');
  return { checks, fails, lines };
}

function sources(over) {
  const s = { build: rd('tools/build.js'), app: rd('src/viewer/app.js'), plaque: rd('src/viewer/plaque.js'), bench: rd('src/viewer/bench.js'),
              host: rd('src/viewer/sim_host.js'), link: rd('src/viewer/sim_link.js'), rec: rd('src/viewer/accept_rec.js'), garage: rd('src/viewer/garage.js') };
  return Object.assign(s, over || {});
}

// ---- the selftest: the rules broken in their own sources ---------------------------------------------------------
const CORE_TXT = () => fs.readFileSync(path.join(T, 'flight_core.js'), 'utf8');
const DOCTORS = [
  ['the bands not checked', 'core', 'if (altMax - altRef > R.altBand || altRef - altMin > R.altBand)', 'if (false)'],
  ['the speed band not checked', 'core', 'if (tasMax > tas * (1 + R.tasBand) || tasMin < tas * (1 - R.tasBand))', 'if (false)'],
  ['the groundspeed taken for the TAS (no wind)', 'core', 'tas += s.tas; gs += s.gs;', 'tas += s.gs; gs += s.gs;'],
  ['the reserve not taken off', 'core', 'out.enduranceMin = Math.round((out.usable / flow * 60 - reserve) * 10) / 10;', 'out.enduranceMin = Math.round((out.usable / flow * 60) * 10) / 10;'],
  ['the range on the gross endurance', 'core', 'out.rangeKm = Math.round(tas * 3.6 * Math.max(0, out.enduranceMin) / 60 * 10) / 10;', 'out.rangeKm = Math.round(tas * 3.6 * Math.max(0, out.grossMin) / 60 * 10) / 10;'],
  ['the fingerprint ignored (no withdrawal)', 'core', 'acceptSigned(r) && r.valid && (ev.fp == null || r.fp === ev.fp)', 'acceptSigned(r) && r.valid && (true)'],
  ['the load ignored', 'core', 'function acceptLoadOk(need, got) {', 'function acceptLoadOk(need, got) { return true;'],
  ['the signature not checked', 'core', 'return acceptHash(acceptCanon(c)) === rec.sig;', 'return true;'],
  ['the empty mass with the payload in it', 'core', 'if (e.payload) payload += e.mass || 0; else empty += e.mass || 0;', 'if (e.payload) payload += e.mass || 0; empty += e.mass || 0;'],
  ['a static check that simulates', 'core', 'function acceptStatic(c, ev) {', 'function acceptStatic(c, ev) { if (ev && ev.__never) makeSim(null, null);'],
  ['the bonus for any pass', 'core', 'row.beat = row.marginPct >=', 'row.beat = true || row.marginPct >='],
  ['a refused leg counted', 'core', 'legs.filter(r => acceptSigned(r) && r.valid &&', 'legs.filter(r => acceptSigned(r) &&'],
  ['the crosswind in m/s', 'core', 'X.ms * ACCEPT_MS_KT * 10', 'X.ms * 10'],
  ['the door without its clearance', 'core', 'span + 2 * ACCEPT_RULES.doorClr <= at.door', 'span <= at.door'],
  ['a landing without a stop', 'core', 'f.at === id && f.sink != null && !f.outcome', '(f.at === id || f.to === id || f.from === id)'],
  ['a take-off from anywhere', 'core', '? f.from === id && f.sink != null', '? f.sink != null || f.from === id'],
  ['the plaque ignores the fingerprint', 'core', 'const mine = signed.filter(r => fp == null || r.fp === fp);', 'const mine = signed;'],
  ['the page never ticks the leg', 'app', 'if (window.ACCEPT_REC) window.ACCEPT_REC.frame();', ''],
  ['the logbook row without its stop', 'app', 'if (at) r.at = at;', ''],
  ['the plaque without its section', 'app', "H('proved in flight');", "H('in flight');"],
  ['a plaque row unexplained', 'plaque', "  'range flown': { what:", "  'range (flown)': { what:"],
  ['the bench keeps its roll-out fingerprint', 'bench', 'window.BENCH_FP_OUT = () => outFp;', ''],
  ['the worker has no accept door', 'host', "case 'accept': {", "case 'acceptX': {"],
  ['the logbook never gets the leg', 'rec', 'lg.accept.push(', 'lg.accept.concat('],
];
function loadCore(txt) {
  const f = path.join(os.tmpdir(), 'accept_core_' + process.pid + '_' + Math.random().toString(36).slice(2) + '.js');
  fs.writeFileSync(f, txt);
  try { return require(f); } finally { try { fs.unlinkSync(f); } catch (e) {} }
}

async function main() {
  const F = await flyAll();
  const D = staticFixtures();
  const r = runChecks(C0, F, D, sources(), false);
  console.log(r.lines.join('\n'));
  if (F._wallS) console.log('  (the flights: ' + F._wallS + ' s wall on ' + JOBS + ' processes; reports/evidence/ACCEPT/flights.json)');
  let selfBad = 0;
  if (SELF) {
    const base = CORE_TXT();
    for (const [name, where, from, to] of DOCTORS) {
      let C = C0, src = sources(), applied = false;
      if (where === 'core') { if (base.includes(from)) { C = loadCore(base.split(from).join(to)); applied = true; } }
      else { const key = where; if (src[key].includes(from)) { src[key] = src[key].split(from).join(to); applied = true; } }
      const q = applied ? runChecks(C, F, D, src, true) : null;
      const red = !!q && q.fails > 0;
      if (!red) selfBad++;
      console.log('  selftest ' + (red ? 'caught  ' : 'MISSED  ') + name + (applied ? '' : ' (the anchor is gone)') + (red ? ' (' + q.fails + ' checks red)' : ''));
    }
    console.log('  selftest: ' + (DOCTORS.length - selfBad) + ' of ' + DOCTORS.length + ' caught');
  }
  console.log('  ' + r.checks + ' checks, ' + r.fails + ' failed');
  const pass = r.fails === 0 && selfBad === 0;
  console.log('GATE ACCEPT: ' + (pass ? 'PASS' : 'FAIL'));
  process.exitCode = pass ? 0 : 1;
}
main().catch(e => { console.log(String(e && e.stack || e)); console.log('GATE ACCEPT: FAIL'); process.exitCode = 1; });
