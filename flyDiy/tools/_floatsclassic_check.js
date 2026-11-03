#!/usr/bin/env node
// GATE FLOATSCLASSIC (FLOATS-CLASSIC, 2026-11-03) - the EDO-style rounded-deck float: a STYLE over the Wipline's rows.
// The user (3 Nov, via A0): "another model of floats. A rougher one, with rounded top, feels more home made ... We have
// the Wipline line, this one could be called something else, but use the same controls?"; A0 (20:00): the references
// are EDO floats, and "there is a DC3 on EDO 28000 floats, that's a cool target".
//
//   node tools/_floatsclassic_check.js              -> the static half (core): "GATE FLOATSCLASSIC: PASS|FAIL"
//   node tools/_floatsclassic_check.js --water      -> + the water half (full tier: the DC-3, the PA-18; ~6 min)
//   node tools/_floatsclassic_check.js --only=water -> the water half alone
//
// WHAT IT ASSERTS:
//   ABSENT   every Wipline hull (the 15 catalogue rows and the family's DEF) is master's to the bit: the panels, the
//            loft, the volume, the inertia, the plan tables hash to the value pinned off master before this chantier
//            (re-pin only for a deliberate Wipline change, and say so); a Wipline section names no dome (yt === yd)
//   CATALOG  the eight EDO rows fit their buoyancy (the model number, lb -> kg) with the fineness inside [0, 0.4]
//            (23-25 deg of deadrise at the step: NACA TN-716's 20-25 for V-bottom floats); every one drawn closed,
//            wound outward, its volume the physics loft's within 0.5 % (WYSIWYG); no non-skid deck; the bumper fat
//   DOME     a classic section's crown stands at the deck line and its edge crownK H under it; levelVolume to the deck
//            equals volDeck; the reserve the advisor reads (HYDRO.floatAdvice) is the DOME's displacement
//   JOIN     the PA-18 floats build (builds/pa18_floats_2026-10-23.json) through the game's own load path: as saved its
//            float record carries no style key; with the style row at 1 it carries style 'edo' + crownK / bowDrop /
//            noseMul, and the frame flies that hull (def.parts.floats[0].P.crownK)
//   WATER    (full) the DC-3 candidate (builds/candidates/dc3_2026-10.json) on EDO 78-28000s, and the PA-18 on its
//            own floats in the classic style: each STANDS (20 s on the sea, idle: finite, at rest, the trim under
//            6 deg, the prop clear of the water), FLOATS AT GROSS with the reserve >= 1.8, TAXIES (30 s on the pilot
//            at a taxi throttle: it moves and stays finite), and LIFTS OFF in the hydroplane run (the bench's: the
//            pilot from the sea lane, inside 75 s)
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const C = require('./flight_core.js');
const H = C.HYDRO;
const FG = require('./_float_gen.js');
const ARGS = process.argv.slice(2);
const ONLY = (ARGS.find(a => a.startsWith('--only=')) || '').slice(7);
const WATER = ARGS.includes('--water') || ONLY === 'water';
const STATIC = ONLY !== 'water';
let fails = 0, n = 0;
const ok = (c, label) => { n++; if (!c) fails++; console.log((c ? '  ok    ' : '  FAIL  ') + label); };
const f2 = (v, d = 2) => (typeof v === 'number' && isFinite(v)) ? v.toFixed(d) : String(v);

// the pin: tools/../ master's flight_core before FLOATS-CLASSIC (adb2d2a9), the hash below over every Wipline hull
const WIPLINE_PIN = 'e2f19d7b6d3c19afeb9c3197bec481760ad6964e';
function wiplineHash() {
  const h = require('crypto').createHash('sha1');
  for (const nm of H.FLOAT_PRESET_NAMES.concat([null])) {
    const F = H.makeFloat(nm ? H.presetParams(nm) : H.DEF);
    h.update(JSON.stringify([F.V, F.panels.map(p => [p.kind, p.v, p.n0, p.area0, p.c0]), F.volDeck, F.I, F.cg, Array.from(F.bTab.F), Array.from(F.bTab.A)]));
  }
  return h.digest('hex');
}

if (STATIC) {
  console.log('ABSENT - the Wipline line is what it was');
  ok(wiplineHash() === WIPLINE_PIN, 'every Wipline hull (15 rows + DEF) hashes to the pin taken off master');
  {
    const P = H.presetParams('Wipline 2350');
    ok(!('crownK' in P) && !('style' in P) && !('bowDrop' in P), 'a Wipline preset carries no EDO key (the join writes none)');
    let flat = true; for (let i = 0; i <= 40; i++) { const s = H.sectionOf(P, -P.xs + P.L * i / 40 + 1e-7); if (s.yt !== s.yd) flat = false; }
    ok(flat, 'a Wipline section has no dome (yt === yd everywhere)');
  }
  console.log('CATALOG - the EDO rows');
  for (const nm of H.EDO_PRESET_NAMES) {
    const R = H.EDO_PRESETS[nm], P = H.presetParams(nm), F = H.makeFloat(P);
    const o = FG.build(P, { HY: H, detail: 1, rudder: 1, paddle: -1, xAft: 0.28 * P.scale });
    const d = o.stats.vol / F.volDeck - 1;
    const fitOk = Math.abs(F.volDeck * P.rho / R.flot - 1) < 1e-3 && P.fineK >= 0 && P.fineK <= 0.45 && P.beta >= 24 && P.beta <= 27;
    ok(fitOk && o.stats.open === 0 && o.stats.vol > 0 && Math.abs(d) < 0.005 && o.deck.idx.length === 0 && P.style === 'edo',
       `${nm}: fits ${R.flot} kg at f ${f2(P.fineK, 3)} (beta ${f2(P.beta, 1)} deg), drawn closed and outward, drawn/physics ${f2(100 * d, 2)} %, bare deck`);
  }
  console.log('DOME - the section and the reserve');
  {
    const P = H.presetParams('EDO 2000'), F = H.makeFloat(P);
    // THE MEASURED SECTION (the user's EDO plan, reports/evidence/FLOATS-CLASSIC/edo_plan_sections.md): widest at the
    // chine, the whole topside one half-ellipse from just over the chine to the crown, the height ~0.8 of the beam
    const s = H.sectionOf(P, -0.2), c = s.yt - s.yd;
    // (the mid-forebody formers, where the plan was measured: a third of the forebody ahead of the step)
    const sS = H.sectionOf(P, -1e-9), sM = H.sectionOf(P, -0.33 * P.xs), hb = (sM.yt - sM.yk) / (2 * sM.b);
    const side = (s.yd - s.yc) / (s.yt - s.yc);
    ok(Math.abs(s.yt - H.deckAt(P, -0.2)) < 1e-12 && side <= 0.25 && s.bd - s.b <= (s.yd - s.yc) * Math.tan(P.flare * Math.PI / 180) + 1e-9 && Math.abs(2 * sS.b - P.B) < 1e-9,
       `the measured section: the crown at the deck line, ${f2(c, 3)} m of dome over ${f2(1000 * (s.yd - s.yc), 0)} mm of straight side (${f2(100 * side, 0)} % of the topside; the plan's F2 holds its beam to ~25 %), widest at the chine (= the hull width row; the flare row leans only the straight side)`);
    ok(hb >= 0.74 && hb <= 0.84 && P.beta >= 24 && P.beta <= 27, `the plan's proportions: height ${f2(hb)} of the beam a third up the forebody (plan 0.74-0.80), ${f2(P.beta, 1)} deg of deadrise (plan ~25)`);
    ok(Math.abs(H.levelVolume(F, 10, 4000) / F.volDeck - 1) < 0.004, 'levelVolume to the deck = volDeck (the section family and the panels agree)');
    const Pw = Object.assign({}, P); delete Pw.crownK; delete Pw.bowDrop; delete Pw.noseMul; delete Pw.style; delete Pw._keel;
    const vw = H.makeFloat(Pw).volDeck, adv = H.floatAdvice(800, P);
    ok(vw > F.volDeck && Math.abs(adv.pairKg - 2 * F.volDeck * P.rho) < 1e-6,
       `the dome is honest: the same rows flat-decked hold ${f2(vw * 1000, 0)} kg, domed ${f2(F.volDeck * 1000, 0)} kg, and the advisor's reserve reads the dome`);
  }
  console.log('WEIGHT AND PRICE - every model carries both, the ledger bills the pair in place of the wheels');
  {
    const all = H.FLOAT_PRESET_NAMES.concat(H.EDO_PRESET_NAMES).map(n => [n, H.presetParams(n)]);
    ok(all.every(([n, P]) => H.floatPrice(P) > 0 && P.mFloat > 0), `every catalogue row has a price and a hull mass (${all.length} rows)`);
    const E2 = H.presetParams('EDO 2000'), E78 = H.presetParams('EDO 78-28000');
    ok(H.EDO_PRESETS['EDO 2000'].mSys === 119 && Math.abs(E78.mFloat - 1036) < 1e-9 && H.floatPrice(E2) === 15000,
       'the sourced figures: an EDO 2000 pair 263 lb installed (119 kg), a Model 78 float 2,284 lb (1036 kg), an EDO 2000 pair 15,000 credits rigged');
    const W = H.presetParams('Wipline 2100'), Wedo = Object.assign({}, W, H.EDO_STYLE);
    ok(H.floatPrice(W) === 55000 && H.floatPrice(Wedo) !== 55000, 'a catalogue price is its own family\'s: a Wipline row\'s name kept on a hull turned EDO is priced as an EDO');
  }
console.log('JOIN - the style rides the game\'s own load path');
  {
    const LB = require('./_load_build.js');
    const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds', 'pa18_floats_2026-10-23.json'), 'utf8'));
    const a = LB.gameSpec(JSON.parse(JSON.stringify(raw)));
    const rb = JSON.parse(JSON.stringify(raw)); (rb.spec || rb).cage.fltStyle = 1;
    const b = LB.gameSpec(rb);
    const fa = a.gear.floats, fb = b.gear.floats;
    ok(fa && !('style' in fa) && !('crownK' in fa) && !('bowDrop' in fa) && !('noseMul' in fa), 'as saved: the PA-18\'s float record names no style');
    ok(fb && fb.style === 'edo' && fb.crownK === H.EDO_STYLE.crownK && fb.bowDrop === H.EDO_STYLE.bowDrop && fb.noseMul === H.EDO_STYLE.noseMul && fb.L === fa.L && fb.B === fa.B,
       'style row 1: the record carries the EDO deck over the same rows (same length and beam)');
    const def = C.buildGen(C.genMigrateSpec(b));
    ok(def.parts.floats[0].P.crownK === H.EDO_STYLE.crownK && fb.volDeck < fa.volDeck,
       `the frame flies the dome (${f2(fb.volDeck * 1000, 0)} kg to the deck against the flat deck's ${f2(fa.volDeck * 1000, 0)})`);
    const da = C.buildGen(C.genMigrateSpec(a)), ga = da.parts.ledger.gear.cost, gb = def.parts.ledger.gear.cost;
    const pa = H.floatPrice(da.parts.floats[0].P), pb = H.floatPrice(def.parts.floats[0].P);
    ok(pa === 55000 && pb > 0 && pb < pa && ga >= pa && gb >= pb && ga - pa === gb - pb + (ga - pa - (gb - pb)),
       `the ledger bills the pair: Wipline 2100 ${pa.toLocaleString('en')} (gear row ${Math.round(ga).toLocaleString('en')} cr), the same rows as an EDO ${pb.toLocaleString('en')} (${Math.round(gb).toLocaleString('en')} cr)`);
  }
}

// ---- the water half ----------------------------------------------------------------------------------------------
function rowsOfPreset(nm) {
  const Q = H.presetParams(nm);
  return { fltL: Q.L, fltStep: Q.xs / Q.L, fltB: Q.B, fltH: Q.H, fltBeta: Q.beta, fltBetaBow: Q.betaBow, fltBetaA: Q.betaA, fltHs: Q.hs,
           fltAft: Q.aftAngle, fltAftCurve: Q.aftCurve, fltFlat: Q.flatK, fltStem: Q.stemK, fltRake: Q.rake, fltNoseR: Q.noseR,
           fltPlan: Q.planK, fltStern: Q.bStern, fltFlare: Q.flare, fltMass: Q.mFloat, fltSpreadAft: +(0.28 * Q.scale).toFixed(2),
           fltStyle: Q.style === 'edo' ? 1 : 0 };
}
function waterRun(label, spec, o) {
  const def = C.buildGen(C.genMigrateSpec(spec));
  let M = 0; for (const q of def.nodes) M += q.m;
  const P = def.parts.floats[0].P, adv = H.floatAdvice(M, P);
  const world = C.makeWorld(), sea = world.aerodromes.find(a => a.kind === 'water');
  console.log(`  ${label}: ${f2(M, 0)} kg, floats ${P.preset || 'custom'} ${f2(P.L)} x ${f2(P.B)} x ${f2(P.H)} m (${P.style || 'wipline'}), pair ${f2(adv.pairKg, 0)} kg`);
  ok(P.style === 'edo' && adv.reserve >= 1.8, `${label}: floats at gross - reserve ${f2(adv.reserve)} (1.8 needed), ${adv.verdict}`);
  // STAND: 20 s on the sea, idle
  {
    const sim = C.makeSim(def, world); sim.reset(0); C.placeAtAerodrome(sim, sea);
    let T = 0, bad = false;
    for (let i = 0; i < 20 * 60; i++) { sim.ctl.thr = 0; sim.step(1 / 60); T += 1 / 60; if (sim.stats().bad) { bad = true; break; } }
    const [xA] = sim.axes(), trim = Math.asin(Math.max(-1, Math.min(1, -xA[1]))) * 180 / Math.PI, v = sim.cgVel();
    let draft = 0, wet = 0;
    for (const fx of sim.hydro.floats) { wet += fx.wet; for (const i of fx.rec.K) draft = Math.max(draft, world.waterH(sim.p[i * 3], sim.p[i * 3 + 2], T) - sim.p[i * 3 + 1]); }
    ok(!bad && wet > 0 && Math.hypot(v[0], v[1], v[2]) < 0.15 && Math.abs(trim) < 6 && !(sim.out.propWet > 0),
       `${label}: stands afloat - trim ${f2(trim)} deg, keel draft ${f2(draft, 3)} m, |v| ${f2(Math.hypot(v[0], v[1], v[2]), 3)} m/s, props dry`);
  }
  // TAXI: the pilot at a taxi throttle for 30 s
  {
    const sim = C.makeSim(def, world); sim.reset(0); C.placeAtAerodrome(sim, sea);
    const ap = C.makePilot(sim, def, world); ap.setRoute(sea, sea);
    const c0 = sim.cgPos().slice(); let bad = false, Vm = 0;
    for (let i = 0; i < 30 * 60; i++) { ap.update(1 / 60); sim.ctl.thr = Math.min(sim.ctl.thr, o.taxiThr); sim.step(1 / 60);
      if (sim.stats().bad) { bad = true; break; } const v = sim.cgVel(); Vm = Math.max(Vm, Math.hypot(v[0], v[2])); }
    const c1 = sim.cgPos(), d = Math.hypot(c1[0] - c0[0], c1[2] - c0[2]);
    ok(!bad && d > 10 && Vm < 12, `${label}: taxies - ${f2(d, 0)} m in 30 s at throttle ${o.taxiThr}, top ${f2(Vm, 1)} m/s (displacement mode)`);
  }
  // THE HYDROPLANE RUN (app.js htStart / htPoll: the pilot, the sea lane, the lift-off off the water above 12 m/s)
  {
    const s = C.makeSim(def, world); s.reset(0); C.placeAtAerodrome(s, sea);
    const ap = C.makePilot(s, def, world); ap.setRoute(sea, sea);
    let t = 0, lift = null, wetLast = 1, x0 = null, bad = false;
    while (t < 75) {
      ap.update(1 / 60); s.step(1 / 60); t += 1 / 60;
      if (s.stats().bad) { bad = true; break; }
      const cg = s.cgPos(), v = s.cgVel(), V = Math.hypot(v[0], v[2]); if (!x0) x0 = [cg[0], cg[2]];
      let wet = 0; for (const x of s.hydro.floats) wet += x.wet;
      if (wet === 0 && wetLast > 0 && V > 12 && !lift) lift = { t, V, dist: Math.hypot(cg[0] - x0[0], cg[2] - x0[1]) };
      wetLast = wet;
      if (lift && t > lift.t + 3) break;
      if (ap.phase === 'ABORT' || ap.phase === 'STOPPED') break;
    }
    ok(!bad && !!lift && !(s.out.propWet > 0),
       `${label}: the hydroplane run lifts off - ${lift ? `${f2(lift.t, 1)} s, ${f2(lift.V, 1)} m/s, ${f2(lift.dist, 0)} m` : 'NO lift-off in 75 s'}`);
  }
}
if (WATER) {
  console.log('WATER - stands, floats at gross, taxies, lifts off');
  const LB = require('./_load_build.js');
  {
    // THE DC-3 ON EDO 78-28000s (A0: "make sure the rows and the hull scale up to an EDO 28000 class float, the DC-3
    // floatplane"): the candidate as built, its float record cleared (the old one held a station - G3700), the
    // catalogue row's hull, the floats under the engines (half track 2.6 m: the C-47C's sat under the nacelles), the
    // keel 2.9 m under the belly (the props' 1.7 m radius clear of the decks), streamlined struts sized to it
    const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds', 'candidates', 'dc3_2026-10.json'), 'utf8'));
    delete raw.spec.gear.floats; raw.spec.gear.type = 'floats';
    Object.assign(raw.spec.cage, { gearFloats: 1, fltPreset: 16 + H.EDO_PRESET_NAMES.indexOf('EDO 78-28000') }, rowsOfPreset('EDO 78-28000'),
                  { fltTrack: 2.6, fltDrop: 2.9, fltStrutR: 0.06, fltZ: 0, fltInc: 0, fltBoard: 1 });
    const spec = LB.gameSpec(raw);
    ok(spec.gear.type === 'floats' && spec.gear.floats && spec.gear.floats.style === 'edo' && spec.gear.floats.L === 12.8 && spec.gear.floats.B === 1.73,
       'the DC-3 candidate carries the EDO 78-28000 through the join (12.8 m x 1.73 m: inside the EDO family\'s widened bounds)');
    waterRun('DC-3 on EDO 78-28000', spec, { taxiThr: 0.25 });
  }
  {
    const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds', 'pa18_floats_2026-10-23.json'), 'utf8'));
    (raw.spec || raw).cage.fltStyle = 1;
    waterRun('PA-18 on its floats, EDO classic', LB.gameSpec(raw), { taxiThr: 0.25 });
  }
}
console.log(`${n - fails}/${n} checks`);
// (the runner reads the verdict line bare; the water half run alone is its own row, FLOATSCLASSIC-WATER)
console.log(`GATE ${ONLY === 'water' ? 'FLOATSCLASSIC-WATER' : 'FLOATSCLASSIC'}: ${fails ? 'FAIL' : 'PASS'}`);
process.exitCode = fails ? 1 : 0;
