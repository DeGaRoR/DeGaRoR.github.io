#!/usr/bin/env node
// GATE STRIPSURF (G1375 STRIP-SURFACE) — EVERY STRIP SAYS WHAT IT IS, AND NO AEROPLANE IS SENT WHERE IT CANNOT LAND.
//
// The user (2026-10-03): "We need to indicate the strip surface: water, dirt, concrete, grass, etc. And disallow the
// water runways for the wheel planes, and the ground runways for the seaplanes." 25_airfield.js derives the surface
// off the records (stripSurface: the water kind, the premises look, the SURFACE enum) and states the rule
// (stripAllows: wheels anywhere but water, floats water only, amphibians both, skis snow and grass); the three
// pilots never plan a landing on the wrong surface (stripLandable in setRoute / departFrom, 43_pilot's forced landing).
//
//   node tools/_surface_check.js            -> "GATE STRIPSURF: PASS|FAIL"
//   node tools/_surface_check.js --show     -> the per-aerodrome lines
//   node tools/_surface_check.js --selftest -> negative verification (a doctored rule and a doctored surface go red)
//
// A. EVERY PLACE (the analytic world, then Jolene's premises): a surface from the vocabulary with a word; a water
//    lane (kind 'water') reads water and nothing else does; a premises strip's look names it (worn -> concrete,
//    gravel -> gravel, grass -> grass).
// B. THE MATRIX on three builds: the stock Cub (the 'cub' card, joined as the game flies it) -> wheels,
//    bugReports/cessnaFloatsWOrks.json -> floats, the same with `gear.floats.amphibian` -> amphibian; every non-meadow
//    aerodrome of both worlds allowed exactly as the rule says, and every refusal says why.
// C. THE PILOTS: makePilot / makeAutopilot / makeTestPilot asked to land the Cub on a water lane and the floats on a
//    land strip plan the circuit at a place they may use instead (and makePilot / the test pilot say 'wrong-surface');
//    a departure from the wrong surface falls back to HOME / the sea lane; the amphibian keeps both; departFrom the same.
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname;
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const BJ = require(path.join(T, '_bake_joined.js'));

const SHOW = process.argv.includes('--show');
const SELF = process.argv.includes('--selftest');
const log = s => { if (SHOW) console.log('  ' + s); };

function run(o) {
  const fail = [];
  const check = (ok, label, extra) => { if (!ok) fail.push(label + (extra ? ' - ' + extra : '')); return ok; };
  const surf = o.surface || C.stripSurface, allows = o.allows || C.stripAllows;
  const wet = a => a.kind === 'water' || !!a.water;
  // A
  const LOOK = { worn: 'concrete', concrete: 'concrete', asphalt: 'asphalt', gravel: 'gravel', dirt: 'dirt', sand: 'sand', grass: 'grass' };
  for (const [wn, W] of o.worlds) {
    check(W.aerodromes.length > 0, wn + ': has aerodromes');
    for (const a of W.aerodromes) {
      const S = surf(a);
      log(wn + ' ' + a.id + ' (' + a.name + '): ' + (S && S.key) + ' / ' + (S && S.word) + ' / ' + (S && S.cls));
      if (!check(S && C.STRIP_SURFACES[S.key] && typeof S.word === 'string' && S.word.length > 0, wn + ' ' + a.id + ': a surface with a word', JSON.stringify(S))) continue;
      check((S.cls === 'water') === wet(a), wn + ' ' + a.id + ': water exactly when the record is a water lane', S.key + ' / kind ' + a.kind);
      if (a.premises && !wet(a) && LOOK[a.look]) check(S.key === LOOK[a.look], wn + ' ' + a.id + ': the look names the surface', a.look + ' -> ' + S.key);
    }
  }
  // B
  const want = (gear, a) => {
    const S = surf(a) || {}, w = wet(a);
    return gear === 'amphibian' ? true : gear === 'floats' ? w : gear === 'skis' ? (S.cls === 'snow' || S.cls === 'grass') : !w;
  };
  check(C.stripGear(o.cub) === 'wheels', 'the stock Cub reads wheels', C.stripGear(o.cub));
  check(C.stripGear(o.floats) === 'floats', 'cessnaFloatsWOrks reads floats', C.stripGear(o.floats));
  check(C.stripGear(o.amph) === 'amphibian', 'the amphibian reads amphibian', C.stripGear(o.amph));
  for (const [wn, W] of o.worlds) {
    const n = { wheels: 0, floats: 0, amphibian: 0 };
    for (const a of W.aerodromes) {
      if (a.kind === 'meadow') continue;
      for (const [gn, spec] of [['wheels', o.cub], ['floats', o.floats], ['amphibian', o.amph], ['skis', 'skis']]) {
        const r = allows(spec, a), w = want(gn, a);
        check(!!r && r.ok === w, wn + ' ' + a.id + ' ' + gn + ': ' + (w ? 'allowed' : 'refused'), JSON.stringify(r));
        if (r && !r.ok) check(typeof r.why === 'string' && r.why.length > 5, wn + ' ' + a.id + ' ' + gn + ': the refusal says why');
        if (r && r.ok && n[gn] !== undefined) n[gn]++;
      }
    }
    log(wn + ': wheels may use ' + n.wheels + ', floats ' + n.floats + ', the amphibian ' + n.amphibian);
    check(n.wheels > 0 && n.floats > 0 && n.amphibian === n.wheels + n.floats, wn + ': both kinds exist and the amphibian has both', JSON.stringify(n));
  }
  return fail;
}

// C: the pilots' guard, on the real builds
function pilots(o) {
  const fail = [];
  const check = (ok, label, extra) => { if (!ok) fail.push(label + (extra ? ' - ' + extra : '')); return ok; };
  for (const [wn, W] of o.worlds) {
    const home = W.aerodromes.find(a => a.id === 'HOME'), sea = W.aerodromes.find(a => a.id === 'SEA');
    const wetAll = W.aerodromes.filter(a => a.kind === 'water');
    for (const [gn, def] of [['cub', o.defCub], ['floats', o.defFloats], ['amphibian', o.defAmph]]) {
      // G1940 (PILOT-ONE): ONE pilot - the classic and the test pilot retired (their two rows went with them)
      for (const [pn, mk] of [['pilot', (s, d, w) => C.makePilot(s, d, w, {})]]) {
        const sim = C.makeSim(def, W), ap = mk(sim, def, W);
        const tag = wn + ' ' + gn + ' ' + pn + ': ';
        const says = () => ((ap.report && ap.report.verdicts) || []).some(v => v.code === 'wrong-surface');
        if (gn === 'cub') {
          ap.setRoute(home, sea);
          check(ap.route.to === home, tag + 'HOME -> the sea lane becomes the circuit at HOME', ap.route.to && ap.route.to.id);
          if (pn !== 'classic') check(says(), tag + 'says wrong-surface');
          ap.departFrom(home, wetAll[wetAll.length - 1]);
          check(ap.route.to === home, tag + 'departFrom onto water lands at HOME', ap.route.to && ap.route.to.id);
          ap.setRoute(home, home);
          check(ap.route.to === home, tag + 'the circuit at HOME is kept');
        } else if (gn === 'floats') {
          ap.setRoute(sea, home);
          check(ap.route.to === sea, tag + 'the sea lane -> HOME becomes the circuit on the sea lane', ap.route.to && ap.route.to.id);
          if (pn !== 'classic') check(says(), tag + 'says wrong-surface');
          ap.setRoute(home, home);
          check(ap.route.to && ap.route.to.kind === 'water', tag + 'a circuit at HOME lands on water instead', ap.route.to && ap.route.to.id);
          if (wetAll.length > 1) {
            ap.departFrom(wetAll[0], wetAll[1]);
            check(ap.route.to === wetAll[1], tag + 'lane to lane is kept', ap.route.to && ap.route.to.id);
          }
        } else {
          ap.setRoute(sea, home);
          check(ap.route.to === home, tag + 'the sea lane -> HOME is kept', ap.route.to && ap.route.to.id);
          ap.setRoute(home, sea);
          check(ap.route.to === sea, tag + 'HOME -> the sea lane is kept', ap.route.to && ap.route.to.id);
          check(!says(), tag + 'never says wrong-surface');
        }
      }
    }
    // the fallback a saved route meets
    check(C.stripFallback('floats', W.aerodromes, home) === sea, wn + ': floats from HOME fall back to the sea lane');
    check(C.stripFallback('wheels', W.aerodromes, sea) === home, wn + ': wheels from the sea lane fall back to HOME');
    check(C.stripFallback('wheels', W.aerodromes, home) === home, wn + ': a route the gear may fly is kept');
  }
  return fail;
}

const t0 = Date.now();
const A = C.makeWorld();
const J = IN.islandWorld('jolene', { premises: fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8') });
const worlds = [['analytic', A], ['jolene', J]];
BJ.loadPanel();
const cub = BJ.bakeCard('cub');
if (cub.errors && cub.errors.length) console.log('  (the cub\'s join: ' + cub.errors.join('; ') + ')');
// G1985 (JOIN-PARITY): the Cessna on floats as the game flies it (tools/_load_build.js)
const fl = process.env.FLYDIY_RAW_BUILDS === '1' ? JSON.parse(fs.readFileSync(path.join(T, '..', 'bugReports', 'cessnaFloatsWOrks.json'), 'utf8')).spec : require('./_load_build.js').loadValidated('floats').spec;
const amph = JSON.parse(JSON.stringify(fl)); amph.gear.floats.amphibian = true;
const O = { worlds, cub: cub.spec, floats: C.genMigrateSpec(JSON.parse(JSON.stringify(fl))), amph: C.genMigrateSpec(amph) };

if (SELF) {
  // every check above must be able to go red
  let bad = 0;
  const neg = (label, fails) => { const ok = fails.length > 0; if (!ok) bad++; console.log((ok ? 'ok   ' : 'MISS ') + label + ' -> ' + fails.length + ' fails' + (fails[0] ? ' (' + fails[0] + ')' : '')); };
  neg('floats allowed on land', run(Object.assign({}, O, { allows: (g, a) => C.stripGear(g) === 'floats' ? { ok: true, why: '' } : C.stripAllows(g, a) })));
  neg('wheels allowed on water', run(Object.assign({}, O, { allows: (g, a) => C.stripGear(g) === 'wheels' ? { ok: true, why: '' } : C.stripAllows(g, a) })));
  neg('a refusal with no why', run(Object.assign({}, O, { allows: (g, a) => { const r = C.stripAllows(g, a); return r.ok ? r : { ok: false, why: '' }; } })));
  neg('a water lane read as grass', run(Object.assign({}, O, { surface: a => a.kind === 'water' ? Object.assign({ key: 'grass' }, C.STRIP_SURFACES.grass) : C.stripSurface(a) })));
  neg('the look ignored', run(Object.assign({}, O, { surface: a => a.kind === 'water' ? C.stripSurface(a) : Object.assign({ key: 'paved' }, C.STRIP_SURFACES.paved) })));
  neg('no surface at all', run(Object.assign({}, O, { surface: () => null })));
  console.log(bad ? 'GATE STRIPSURF --selftest: FAIL (' + bad + ' checks cannot go red)' : 'GATE STRIPSURF --selftest: PASS');
  process.exit(bad ? 1 : 0);
}

const fail = run(O);
const defCub = C.buildGen(cub.spec), defFloats = C.buildGen(O.floats), defAmph = C.buildGen(O.amph);
for (const f of pilots({ worlds, defCub, defFloats, defAmph })) fail.push(f);
for (const f of fail) console.log('  FAIL ' + f);
console.log('(' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
console.log(fail.length ? 'GATE STRIPSURF: FAIL (' + fail.length + ')' : 'GATE STRIPSURF: PASS');
process.exit(fail.length ? 1 : 0);
