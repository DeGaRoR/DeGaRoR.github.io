#!/usr/bin/env node
// GATE ARCHETYPES — the declared canonical builds (tools/_cage_design.js §7)
// actually fly. The birth flow's whole promise is that every live tile
// combination it OFFERS is an aeroplane; this gate is where that promise is
// paid, on the declared list rather than the 450-build cartesian product.
//
//   node tools/_arch_check.js            -> "GATE ARCHETYPES: PASS|FAIL"
//   node tools/_arch_check.js --selftest -> negative verification
//
// For every archetype whose every option is LIVE (derived by archInactive —
// never declared, so the gate and the greying cannot disagree):
//
//   1 COMPOSE   designBake(sel, over) — the IDENTICAL code path the birth
//               overlay applies, so the aeroplane flown here is the
//               aeroplane the card builds.
//   2 CLAMP     clampSpec must not bite a declared value: "a class that
//               promises a 16 m span and gets 14 is a FAILURE, not a clamp
//               doing its job" (§5.2, gated).
//   3 SHAKEDOWN genShakedown's own circuit verdict must hold — no archetype
//               ships with a red plaque. The role's declared targets are
//               PRINTED beside the measured numbers (distance, not
//               judgement: judging is P5/P6's, §5.1).
//   4 FLY       the test pilot flies the circuit to a full stop, completed,
//               inside the bound — the GATE GEN discipline on the birth spec.
//
// Archetypes with an inactive option are SKIPPED WITH THEIR REASON PRINTED,
// so the gate log is also the backlog (§7).
//
// THE SPEC FLOWN IS PRE-JOIN, deliberately: the join measures the BUILT cage
// and needs the page; designBake's intent channel states the chosen wing,
// engine and gear type through the join's own verbatim maps, and GATE JOIN
// holds those maps true. What the join would refine (tail arm, stations,
// cabin box) flies here as derived — the same spec the game builds in the
// instant after birth.
'use strict';
const path = require('path');

const T = __dirname;

function loadPanel() {
  const CORE = require(path.join(T, 'flight_core.js'));
  for (const k of Object.keys(CORE)) global[k] = CORE[k];
  const noop = function () { return this; };
  class Obj {
    constructor() {
      this.children = []; this.position = { set: noop };
      this.rotation = {}; this.scale = { set: noop, setScalar: noop };
    }
    add() { return this; } remove() {} traverse() {}
  }
  global.THREE = new Proxy({}, { get: (t, k) => {
    if (k === 'Vector3')
      return function () { return { set: noop, x: 0, y: 0, z: 0 }; };
    return class extends Obj {};
  } });
  global.window = { THREE: global.THREE };
  for (const f of ['_cage_parts.js', '_cage_page5.js', '_cage_gen.js',
    '_cage_crew.js', '_gear_kit.js', '_gear_gen.js', '_gear_page.js',
    '_cage_gear.js', '_fit_site.js', '_fit_gen.js',
    '_eng_gen.js', '_eng_mesh.js', '_eng_page.js',
    '_cowl_gen.js', '_cowl_rows.js', '_cage_cowl.js', '_cage_eng.js',
    '_strut_gen.js', '_cage_wing.js', '_cage_brace.js', '_fin_gen.js', '_cage_fin.js',
    '_cage_stab.js', '_cage_access.js', '_cage_light.js'])
    require(path.join(T, f));
  // the join's engine map, onto the shim so designBake's fallback finds it
  // exactly where the page's lexical global would be
  global.window.CAGE_JOIN_ENGINES =
    require(path.join(T, '_cage_join.js')).CAGE_JOIN_ENGINES;
  return global.window;
}

loadPanel();
const D = require(path.join(T, '_cage_design.js'));
const TH = require(path.join(T, '_tail_headless.js'));   // P5: the drawn tail, headless
const CORE = require(path.join(T, 'flight_core.js'));
const { makeSim, makePilot, makeWorld, buildGen,
        clampSpec, genShakedown } = CORE;

const fails = [];
const check = (ok, label, extra) => {
  console.log((ok ? '  ok     ' : '  FAIL   ') + label +
              (ok || !extra ? '' : ' — ' + extra));
  if (!ok) fails.push(label);
  return ok;
};

// ---------------------------------------------------------------------------
// the checks, as named functions over data — so --selftest can feed each one
// a doctored input and prove it can go red
// ---------------------------------------------------------------------------

// 2 CLAMP — every value the archetype's own class DECLARED must survive
// clampSpec exactly (compared on the clamped clone, the G48 lesson: assert
// post-resolution, never on the export)
function checkClamp(name, spec) {
  const c = clampSpec(spec);
  let ok = true;
  const near = (a, b) => Math.abs(a - b) <= 1e-6;
  ok = check(near(c.wings[0].span, spec.wings[0].span),
    name + ': clamp did not bite the declared span',
    spec.wings[0].span + ' -> ' + c.wings[0].span) && ok;
  ok = check(near(c.wings[0].chord, spec.wings[0].chord),
    name + ': clamp did not bite the declared chord',
    spec.wings[0].chord + ' -> ' + c.wings[0].chord) && ok;
  // (the fuel branch is gone with its probe, 2026-09-08: it was guarded on
  // `spec.fuel.litres`, a field nothing has DECLARED since the energy arc,
  // so it could neither bite nor be shown to bite — see the note by the
  // probes below, and the debt register)
  return ok;
}

// 3 SHAKEDOWN — the plaque's own circuit verdict, plus the role targets
// printed as distances (information, never judgement)
function checkShakedown(name, sh, targets) {
  const ok = check(!!sh.flyableCircuit, name + ': the shakedown clears it ' +
    'for a circuit', 'climbRate ' + (sh.climbRate && sh.climbRate.toFixed
      ? sh.climbRate.toFixed(2) : sh.climbRate) +
    ' m/s, TORun ' + Math.round(sh.TORun || 0) + ' m');
  if (targets) {
    const line = Object.keys(targets).map(k => {
      const v = sh[k];
      return k + ' ' + (Number.isFinite(+v) ? (+v).toFixed(1) : '—') +
             '/' + targets[k];
    }).join(' · ');
    console.log('           role targets (measured/declared): ' + line);
  }
  return ok;
}

// 4 FLY — the test pilot's circuit, the GATE GEN discipline
// THE CLOCK IS THE PILOT'S, NOT ONE CIRCUIT'S (2026-09-08). This asked for a
// full stop inside 420 s, which is one clean circuit — but the pilot is
// allowed TWO go-arounds before it commits, and a card that uses them for a
// declared reason is flying the pattern exactly as designed: the Beaver- and
// Caravan-alikes both go around twice for terrain under their home approach
// and then land, at 493 and 537 s. Judging that a failure to fly was the
// clock's fault, not the aeroplane's. `maxS` (below) is the same rule at the
// harness's end, and what still fails is what should: never stopping.
function checkFlight(name, r, maxS) {
  let ok = true;
  const bound = maxS || 700;
  ok = check(!r.nan, name + ': no NaN in flight') && ok;
  ok = check(r.report.outcome === 'completed',
    name + ': the circuit completes', String(r.report.outcome)) && ok;
  ok = check(r.phase === 'STOPPED' && r.t < bound,
    name + ': full stop inside ' + bound + ' s',
    r.phase + ' at ' + r.t.toFixed(0) + ' s') && ok;
  return ok;
}

function fly(spec, maxS) {
  const world = makeWorld();
  const def = buildGen(spec);
  const sim = makeSim(def, world);
  sim.reset(0);
  for (let i = 0; i < 600; i++) sim.step(1 / 60);
  const ap = makePilot(sim, def, world);
  let tEnd = maxS, nan = false;
  for (let s = 0; s < maxS * 60; s++) {
    ap.update(1 / 60); sim.step(1 / 60);
    if (sim.stats().bad) { nan = true; tEnd = s / 60; break; }
    if (ap.phase === 'STOPPED' && ap.t > 5) { tEnd = s / 60; break; }
  }
  return { report: ap.report, phase: ap.phase, t: tEnd, nan };
}

// ---------------------------------------------------------------------------
// the run
// ---------------------------------------------------------------------------
if (!process.argv.includes('--selftest')) {
  let flown = 0, skipped = 0;
  for (const a of D.ARCHETYPES) {
    const reason = D.archInactive(a);
    if (reason) {
      skipped++;
      console.log('  SKIP   ' + a.name + ' — ' + reason);
      continue;
    }
    let spec;
    try { spec = D.designBake(a.sel, a.over); }
    catch (e) { check(false, a.name + ': designBake', e.message); continue; }
    // TAIL CHANTIER 2 P5 (ruling (s)): THE DRAWN TAIL FLIES HERE. The fin
    // and stab layers' build with no page (_tail_headless.js — GATE FIN pins
    // it to the page to the bit) writes the join's own rows into the
    // pre-join spec, so this gate certifies the tail the player flies, not
    // the rule's. A twin-boom card keeps the rule tail and says so (the
    // headless build cannot root its fin on the booms).
    let tailNote = 'rule tail';
    try {
      const full = D.designFull(a.sel, a.over).full;
      const tb = TH.tailBuild(full, { level: 2 });
      if (!tb.approx.length) { TH.tailApply(spec, TH.tailRows(tb)); tailNote = 'DRAWN tail'; }
      else tailNote = 'rule tail — ' + tb.approx.join('; ');
    } catch (e) { tailNote = 'rule tail — the headless build threw: ' + e.message; }
    console.log('  ' + a.name + ': flies the ' + tailNote);
    checkClamp(a.name, spec);
    let sh = null;
    try { sh = genShakedown(buildGen(spec)); }
    catch (e) { check(false, a.name + ': shakedown ran', e.message); continue; }
    const role = D.optionOf('role', a.sel.role);
    checkShakedown(a.name, sh, role && role.targets);
    // a GLIDER cruises at 30 m/s and flies the same circuit the tourers fly at
    // 45 (measured 2026-09-04: the motorglider was still in CRUISE at 420 s,
    // the Archaeopteryx-alike on APPROACH) — the bound scales with the role
    // THE CLOCK ALLOWS THE PILOT ITS GO-AROUNDS (2026-09-08). 420 s times
    // ONE clean circuit, and the pilot is allowed two go-arounds before it
    // commits — a legitimate one (the Beaver-alike's home approach has
    // terrain under it, and it goes around twice for that reason before
    // landing) costs about 140 s each, so a card that flies the pattern
    // exactly as designed ran out of clock and read as a failure to fly.
    // The bound is still a bound: a card that cannot get down says so.
    const maxS = role && role.value === 'glider' ? 900 : 700;
    const r = fly(spec, maxS);
    checkFlight(a.name, r, maxS);
    flown++;
  }
  check(flown >= 5, 'at least five archetypes flew', String(flown));
  console.log('  ' + flown + ' archetypes flown, ' + skipped +
              ' skipped with reasons (the backlog above)');
}

// ---------------------------------------------------------------------------
// --selftest: doctored inputs, no sims flown — this verifies the CHECKS
// ---------------------------------------------------------------------------
if (process.argv.includes('--selftest')) {
  const cases = [];
  const probe = (name, fn) => {
    const before = fails.length;
    const silent = { log: console.log };
    console.log = () => {};              // the doctored complaints are noise
    let ok;
    try { ok = fn(); } finally { console.log = silent.log; }
    const caught = fails.length > before || ok === false;
    fails.length = before;
    console.log('  selftest ' + (caught ? 'caught  ' : 'MISSED  ') + name);
    cases.push(caught);
  };
  const goodSpec = D.designBake(D.ARCHETYPES[0].sel, D.ARCHETYPES[0].over);
  // BOTH OF THESE HAD GONE INERT, found 2026-09-08 by running --selftest
  // during TAIL CHANTIER 2 (the battery runs this gate without it, so
  // nothing was red — the checks had simply stopped being able to fail).
  // The span ceiling is `min(18, 20 x chord)` and a 1.6 m chord makes it 18,
  // so a 16 m span has been INSIDE the clamp since the span band was
  // widened for the long-winged cards: 20 m bites. And `spec.fuel.litres`
  // is a field nothing has read since the energy arc gave fuel its own
  // vessels (G98) — checkClamp's fuel branch is guarded on it, so the probe
  // doctored a spec the checker then skipped. A vessel's own capacity is
  // what a builder can over-declare now, so that is what it doctors.
  probe('a declared span the clamp bites', () => {
    const s = JSON.parse(JSON.stringify(goodSpec));
    s.wings[0].span = 20.0;
    return checkClamp('doctored', s);
  });
  // (the fuel probe is RETIRED, not moved: there is no clamp left for it to
  // verify. `spec.fuel.litres` stopped being a declaration when the energy
  // arc gave fuel its vessels, and a VESSEL's capacity is bounded by
  // nothing — 900 litres declared in a 60-litre box resolves to
  // `fuel.litres 900` and flies. That is a real hole and it is the energy
  // arc's, so it is in the debt register rather than papered over with a
  // probe that would pass by testing something else.)
  probe('a shakedown that refuses the circuit', () =>
    checkShakedown('doctored', { flyableCircuit: false, climbRate: 0.1,
                                 TORun: 1400 }, null));
  probe('a flight that never completes', () =>
    checkFlight('doctored', { nan: false, phase: 'CLIMB', t: 420,
                              report: { outcome: 'gave-up' } }));
  probe('a flight that went NaN', () =>
    checkFlight('doctored', { nan: true, phase: 'STOPPED', t: 90,
                              report: { outcome: 'completed' } }));
  if (cases.some(c => !c))
    check(false, 'a rule cannot be broken — that check is inert');
}

// ---------------------------------------------------------------------------
if (fails.length) {
  console.log('GATE ARCHETYPES: FAIL (' + fails.length + ')');
  process.exit(1);
}
console.log('GATE ARCHETYPES: PASS');
