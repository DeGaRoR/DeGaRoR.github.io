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
    '_strut_gen.js', '_cage_wing.js', '_fin_gen.js', '_cage_fin.js',
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
const CORE = require(path.join(T, 'flight_core.js'));
const { makeSim, makeTestPilot, makeWorld, buildGen,
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
  if (spec.fuel && spec.fuel.litres != null)
    ok = check(near(c.fuel.litres, spec.fuel.litres),
      name + ': clamp did not bite the declared fuel',
      spec.fuel.litres + ' -> ' + c.fuel.litres) && ok;
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
function checkFlight(name, r) {
  let ok = true;
  ok = check(!r.nan, name + ': no NaN in flight') && ok;
  ok = check(r.report.outcome === 'completed',
    name + ': the circuit completes', String(r.report.outcome)) && ok;
  ok = check(r.phase === 'STOPPED' && r.t < 420,
    name + ': full stop inside 420 s',
    r.phase + ' at ' + r.t.toFixed(0) + ' s') && ok;
  return ok;
}

function fly(spec, maxS) {
  const world = makeWorld();
  const def = buildGen(spec);
  const sim = makeSim(def, world);
  sim.reset(0);
  for (let i = 0; i < 600; i++) sim.step(1 / 60);
  const ap = makeTestPilot(sim, def, world);
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
    checkClamp(a.name, spec);
    let sh = null;
    try { sh = genShakedown(buildGen(spec)); }
    catch (e) { check(false, a.name + ': shakedown ran', e.message); continue; }
    const role = D.optionOf('role', a.sel.role);
    checkShakedown(a.name, sh, role && role.targets);
    // a GLIDER cruises at 30 m/s and flies the same circuit the tourers fly at
    // 45 (measured 2026-09-04: the motorglider was still in CRUISE at 420 s,
    // the Archaeopteryx-alike on APPROACH) — the bound scales with the role
    const r = fly(spec, role && role.value === 'glider' ? 640 : 420);
    checkFlight(a.name, r);
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
  probe('a declared span the clamp bites', () => {
    const s = JSON.parse(JSON.stringify(goodSpec));
    s.wings[0].span = 16.0;
    return checkClamp('doctored', s);
  });
  probe('a declared fuel load the clamp bites', () => {
    const s = JSON.parse(JSON.stringify(goodSpec));
    s.fuel = { litres: 400 };
    return checkClamp('doctored', s);
  });
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
