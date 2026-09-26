#!/usr/bin/env node
// GATE SUBSTEP (G580, PHYSICS PERF 2026-09-25) - the integrator's step, sized on the springs, with the
// dampers it can carry (62_gen_aero.js genSubsteps). Over every active archetype and the fixture builds:
//   - never MORE substeps than the old rule (max of the per-beam spring and damper needs) asked;
//   - a build whose springs set the step is untouched: the old number, and no damper cut;
//   - where dampers were cut, every one stays OVERDAMPED (zeta >= 1 on its own spring), and the whole
//     network holds the integrator's stability with the margin: (omega dt)^2 + 2 gamma dt <= 3.0 (the
//     symplectic-Euler bound on a damped mode is 4), re-measured here with a long power iteration
//     (4 000 passes, no margin factor) - a check of the builder's 600-pass estimate, not a copy of it.
// THE FLIGHT BOX (G610): a build whose wing springs ask more than GEN_BOX_N (120) flies a softened wing box
// (62_gen_aero genFlightBox); the TRUE step is kept (params.substepsTrue) and everything above is asserted
// on it - the old rule, the dampers, the network - on the TRUE k and c. The flight box itself:
//   - fewer substeps than the true box, never under GEN_BOX_N; nothing softened on a build at or under it;
//   - only WING springs softened (cls 'wing'), none under GEN_BOX_KMIN (0.25) of its true k, each softened
//     damper keeping its spring's damping ratio (c / cTrue = sqrt(k / kTrue), or lower where c dt caps it);
//   - the whole flight network inside the integrator's margin at its step: <= 3.0, re-measured (4 000 passes);
//   - the actual wing is one call away: sim.trueBox() puts every true k and c back and returns the true
//     step - what the load test flies ("let the test test the actual wing").
//   node tools/_substep_check.js          -> "GATE SUBSTEP: PASS|FAIL"
'use strict';
const path = require('path'), fs = require('fs');
const T = __dirname;
const C = require(path.join(T, 'flight_core.js'));
for (const k of Object.keys(C)) global[k] = C[k];
const noop = function () { return this; };
class Obj { constructor() { this.children = []; this.position = { set: noop }; this.rotation = {}; this.scale = { set: noop, setScalar: noop }; } add() { return this; } remove() {} traverse() {} }
global.THREE = new Proxy({}, { get: (t, k) => { if (k === 'Vector3') return function () { return { set: noop, x: 0, y: 0, z: 0 }; }; return class extends Obj {}; } });
global.window = { THREE: global.THREE };
for (const f of ['_cage_parts.js', '_cage_page5.js', '_cage_gen.js', '_cage_crew.js', '_gear_kit.js', '_gear_gen.js', '_gear_page.js', '_cage_gear.js', '_fit_site.js', '_fit_gen.js', '_eng_gen.js', '_eng_mesh.js', '_eng_page.js', '_cowl_gen.js', '_cowl_rows.js', '_cage_cowl.js', '_cage_eng.js', '_strut_gen.js', '_boom_gen.js', '_cage_wing.js', '_cage_brace.js', '_fin_gen.js', '_cage_fin.js', '_cage_stab.js', '_cage_access.js', '_cage_light.js'])
  require(path.join(T, f));
const D = require(path.join(T, '_cage_design.js'));

let fails = 0;
const verdict = (ok, line) => { if (!ok) fails++; if (!ok || process.argv.includes('--show')) console.log((ok ? 'PASS ' : 'FAIL ') + line); };

function netEig(def, val) {
  const N = def.nodes, n = N.length, dry = i => (N[i].mFuel ? Math.max(0.5, N[i].m - N[i].mFuel) : N[i].m);
  const sm = N.map((_, i) => 1 / Math.sqrt(dry(i)));
  const bs = def.beams.map(b => { const pa = N[b.a].p, pb = N[b.b].p; const d = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]]; const L = Math.hypot(...d) || 1; return { a: b.a, b: b.b, d: d.map(x => x / L), v: val(b) }; });
  let x = new Float64Array(n * 3).map((_, i) => Math.cos(i * 0.61 + 1.1)), lam = 0;
  for (let it = 0; it < 4000; it++) {
    const y = new Float64Array(n * 3);
    for (const b of bs) {
      const a3 = b.a * 3, b3 = b.b * 3; let r = 0;
      for (let k = 0; k < 3; k++) r += b.d[k] * (x[b3 + k] * sm[b.b] - x[a3 + k] * sm[b.a]);
      r *= b.v;
      for (let k = 0; k < 3; k++) { y[b3 + k] += b.d[k] * r * sm[b.b]; y[a3 + k] -= b.d[k] * r * sm[b.a]; }
    }
    let nr = 0; for (let i = 0; i < y.length; i++) nr += y[i] * y[i];
    nr = Math.sqrt(nr); lam = nr; for (let i = 0; i < y.length; i++) x[i] = y[i] / (nr || 1);
  }
  return lam;
}

const builds = [];
for (const a of D.ARCHETYPES) if (!D.archInactive(a)) builds.push([a.key, D.designBake(a.sel, a.over)]);
for (const f of fs.readdirSync(path.join(T, 'fixtures')).filter(f => /^build_.*\.json$/.test(f)))
  try { const j = JSON.parse(fs.readFileSync(path.join(T, 'fixtures', f), 'utf8')); builds.push([f, C.genMigrateSpec(j.spec || j)]); } catch (e) {}

let cut = 0, saved = 0, total = 0, boxes = 0, boxSaved = 0;
const BOX_N = C.GEN_BOX_N, KMIN = C.GEN_BOX_KMIN;
verdict(BOX_N === 120 && KMIN === 0.25, `the flight box's constants: GEN_BOX_N ${BOX_N}, GEN_BOX_KMIN ${KMIN}`);
for (const [key, spec] of builds) {
  let def;
  try { def = C.buildGen(JSON.parse(JSON.stringify(spec))); } catch (e) { continue; }
  const Nn = def.nodes, dry = i => (Nn[i].mFuel ? Math.max(0.5, Nn[i].m - Nn[i].mFuel) : Nn[i].m);
  const kT = b => (b.kTrue != null ? b.kTrue : b.k), cT = b => (b.cTrue != null ? b.cTrue : b.c);
  // the old rule, on the TRUE springs and the dampers as sized (cSized where G580 cut one, else the true box's)
  let wMax = 0, cMax = 0;
  for (const b of def.beams) { const inv = 1 / dry(b.a) + 1 / dry(b.b); wMax = Math.max(wMax, Math.sqrt(kT(b) * inv)); cMax = Math.max(cMax, (b.cSized != null ? b.cSized : cT(b)) * inv); }
  const legacy = Math.min(200, Math.max(24, Math.ceil(Math.max(wMax / 27, cMax / 39))));
  const N = def.params.substeps, N0 = def.params.substepsTrue || N, nCut = def.beams.filter(b => b.cSized != null).length;
  const soft = def.beams.filter(b => b.kTrue != null);
  total++;
  verdict(N0 <= legacy && N <= N0, `${key}: ${N} substeps flown, ${N0} the true box's, never above the old rule's ${legacy}`);
  // ---- the true step (G580), on the true box
  if (!nCut) verdict(N0 === legacy, `${key}: no damper cut, the true box at the old number (${N0} vs ${legacy})`);
  else {
    cut++; saved += legacy - N0;
    let zMin = Infinity;
    for (const b of def.beams) if (b.cSized != null) { const inv = 1 / dry(b.a) + 1 / dry(b.b); zMin = Math.min(zMin, cT(b) * inv / (2 * Math.sqrt(kT(b) * inv))); }
    const dt = 1 / (60 * N0), w2 = netEig(def, kT), g = netEig(def, cT), m = w2 * dt * dt + 2 * g * dt;
    verdict(zMin >= 1, `${key}: ${nCut} dampers cut, every one overdamped (zeta >= ${zMin.toFixed(2)})`);
    verdict(m <= 3.0, `${key}: the true network at ${N0} substeps: (omega dt)^2 + 2 gamma dt = ${m.toFixed(2)} <= 3.0 (omega dt ${(Math.sqrt(w2) * dt).toFixed(2)}, gamma dt ${(g * dt).toFixed(2)})`);
    console.log(`  ${key.padEnd(34)} ${legacy} -> ${N0} substeps, ${nCut} dampers cut (zeta >= ${zMin.toFixed(2)}), network ${m.toFixed(2)}`);
  }
  // ---- the flight box (G610)
  if (N === N0) { verdict(!soft.length && def.params.substepsTrue == null, `${key}: no flight box - nothing softened, no second step`); continue; }
  boxes++; boxSaved += N0 - N;
  verdict(N0 > BOX_N && N >= BOX_N && N < N0, `${key}: the flight box at ${N} substeps (the true box ${N0}; never under ${BOX_N})`);
  let kMin = Infinity, onlyWing = true, zetaKept = true, nK = 0;
  for (const b of soft) {
    const r = b.k / b.kTrue;
    if (r < 1) { nK++; kMin = Math.min(kMin, r); if (b.cls !== 'wing') onlyWing = false; }
    if (b.k > b.kTrue || b.c > b.cTrue * Math.sqrt(r) * (1 + 1e-12)) zetaKept = false;   // never stiffer; a damper never above its ratio
  }
  verdict(onlyWing && kMin >= KMIN, `${key}: ${nK} springs softened, every one a wing member, none under x${KMIN} (softest x${kMin.toFixed(2)})`);
  verdict(zetaKept, `${key}: every softened damper at or under its spring's damping ratio (c / cTrue <= sqrt(k / kTrue))`);
  const dt = 1 / (60 * N), w2 = netEig(def, b => b.k), g = netEig(def, b => b.c), m = w2 * dt * dt + 2 * g * dt;
  verdict(m <= 3.0, `${key}: the flight network at ${N} substeps: ${m.toFixed(2)} <= 3.0 (omega dt ${(Math.sqrt(w2) * dt).toFixed(2)}, gamma dt ${(g * dt).toFixed(2)})`);
  const sim = C.makeSim(def, null), Nt = sim.trueBox();
  const back = sim.beams.every((b, i) => b.k === kT(def.beams[i]) && b.c === cT(def.beams[i]) && b.sK === 1);
  verdict(Nt === N0 && back, `${key}: sim.trueBox() flies the actual wing - every true k and c back, the step ${Nt} (the true ${N0})`);
  console.log(`  ${key.padEnd(34)} the flight box: ${N0} -> ${N} substeps, ${nK} wing springs softened (x${kMin.toFixed(2)} at most), network ${m.toFixed(2)}`);
}
console.log(`${total} builds, ${cut} on the dampers' step: ${saved} substeps saved between them; ${boxes} fly the flight box: ${boxSaved} substeps saved between them`);
console.log('GATE SUBSTEP: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
