#!/usr/bin/env node
// GATE JOINPARITY (G1985-G1989, JOIN-PARITY) - NODE FLIES THE GAME'S AEROPLANE.
//
// DMG-D4b (the Deform Coordinator, 5 Oct) found the page and node building DIFFERENT structures from the same saved
// file: the game runs a load chain over every build it opens (garage.js loadSpec -> the editor's layers -> the join ->
// the energy layer's write-back) and node's loaders ran buildGen on the file as written. The metal Cessna's engine sat
// 65 cm apart (spec.engines[0].x, the drawn flange G445.1 measures), the Cub's nose tank was 45 L in node and shaped to
// its bay and the pilot's feet in the game. tools/_load_build.js is now node's one load path - the page's own code, in
// the page's order. This gate holds it, on the user's VALIDATED aeroplanes only:
//
//   1. THE GAME'S OWN ANSWER. tools/fixtures/join_parity_page.json is the real page's spec for each build (booted
//      headless from the autosave, tools/join_parity_page.js). The def node's path builds and the def the page's spec
//      builds are compared field by field: n, nb, every node (position, mass, radius, tag), every member (ends, rest
//      length, stiffness, class...), the refs, the total mass - exact to 1e-9 (relative past 1). A floatplane's float
//      station is DECLARED page-timed (the CG handshake's worker answer, see check 1): held to 5 mm, then carried.
//   2. THE OLD PATH WAS WRONG, AND THIS GATE WOULD SAY SO: the file as written (buildGen on it, the pre-G1985 loaders)
//      must differ from the page on the metal Cessna's engine station and the Cub's tank, the two findings.
//   3. THE CHAIN IS A PURE FUNCTION: computed afresh (no cache) it equals the cached answer, twice.
//   4. A SAVE IS A FIXED POINT (the finding's question 4): the game's spec, saved and opened again, flies the same
//      def, and carries the engine station the join measured (engines[0].x) - the old saves lack it only because they
//      predate G445.1 (2026-09-20); the load's join writes it on every open, and a save after an open keeps it.
//   5. THE CENSUS: every tool that names a validated build file loads it through tools/_load_build.js, or is declared
//      below with the door it uses (the real page, a spec-level reader, a join under test). A new loader that reads a
//      validated file and flies it raw fails here.
//
//   node tools/_joinparity_check.js [--selftest] [--show]
// NEGATIVE-VERIFIED: --selftest feeds check 1 the file as written (must FAIL), plants a raw loader in the census (must
// FAIL), and perturbs one member's rest length by 1e-6 (must FAIL).
'use strict';
const fs = require('fs');
const path = require('path');
const T = __dirname, FLY = path.join(T, '..');
const C = require(path.join(T, 'flight_core.js'));
const LB = require(path.join(T, '_load_build.js'));
const SELF = process.argv.includes('--selftest');
const SHOW = process.argv.includes('--show');
const FIXTURE = path.join(T, 'fixtures', 'join_parity_page.json');
const TOL = 1e-9;
const FLOAT_TOL = 0.005;          // m - the declared float station (see check 1)

let fails = 0;
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; return c; };
const clone = o => JSON.parse(JSON.stringify(o));

// ---- the def comparison: every field of every node and member, the refs, the mass -----------------------------------
function defDiff(da, db) {
  const out = { n: [da.nodes.length, db.nodes.length], nb: [da.beams.length, db.beams.length], worst: 0, where: null, first: null };
  const num = (x, y, at) => {
    if (typeof x === 'number' && typeof y === 'number') {
      // relative past 1 (a member's stiffness is ~1e6 N/m): 1e-9 of the quantity, never looser than 1e-9 absolute
      const e = Math.abs(x - y) / Math.max(1, Math.abs(x), Math.abs(y)); if (e > out.worst) { out.worst = e; out.where = at; }
      if (e > TOL && !out.first) out.first = at + ' ' + x + ' vs ' + y;
      return;
    }
    if (Array.isArray(x) && Array.isArray(y)) {
      if (x.length !== y.length) { if (!out.first) out.first = at + ' length ' + x.length + ' vs ' + y.length; return; }
      for (let i = 0; i < x.length; i++) num(x[i], y[i], at + '[' + i + ']');
      return;
    }
    if (x && y && typeof x === 'object' && typeof y === 'object') {
      for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) num(x[k], y[k], at + '.' + k);
      return;
    }
    if (x !== y && !out.first) out.first = at + ' ' + JSON.stringify(x) + ' vs ' + JSON.stringify(y);
  };
  if (da.nodes.length !== db.nodes.length || da.beams.length !== db.beams.length) { out.first = out.first || 'n/nb differ'; return out; }
  for (let i = 0; i < da.nodes.length; i++) num(da.nodes[i], db.nodes[i], 'node ' + i + ' (' + (da.nodes[i].tag || '') + ')');
  const len = (d, b) => { const A = d.nodes[b.a].p, B = d.nodes[b.b].p; return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };
  for (let i = 0; i < da.beams.length; i++) {
    num(da.beams[i], db.beams[i], 'member ' + i);
    num(len(da, da.beams[i]), len(db, db.beams[i]), 'member ' + i + ' rest length');
  }
  num(da.refs, db.refs, 'refs');
  const M = d => d.nodes.reduce((s, n) => s + n.m, 0);
  out.mass = [M(da), M(db)];
  num(out.mass[0], out.mass[1], 'total mass');
  return out;
}
const same = d => !d.first && d.worst <= TOL;
const fmtD = d => 'n ' + d.n.join('/') + ' nb ' + d.nb.join('/') + ' mass ' + (d.mass ? d.mass.map(x => x.toFixed(3)).join('/') : '?') +
  ' kg, worst ' + d.worst.toExponential(2) + (d.first ? ' - FIRST: ' + d.first : '');

const PAGE = (() => { try { return JSON.parse(fs.readFileSync(FIXTURE, 'utf8')); } catch (e) { return null; } })();
const KEYS = Object.keys(LB.VALIDATED);
const rawSpec = k => { const B = LB.VALIDATED[k]; let j = JSON.parse(fs.readFileSync(path.join(FLY, B.build), 'utf8'));
  if (B.patch) j = B.patch(j); return C.genMigrateSpec(j.spec || j); };

// ---- 1. the game's own answer ---------------------------------------------------------------------------------------
console.log('== 1. node\'s load path against the page\'s own spec (tools/fixtures/join_parity_page.json) ==');
ok(!!PAGE && PAGE.builds && KEYS.every(k => PAGE.builds[k] && PAGE.builds[k].spec), 'the page capture holds every validated build (' + KEYS.join(', ') + ')');
const NODE = {};
if (PAGE) {
  const stale = PAGE.chainSig !== LB.chainSig();
  if (stale) console.log('     (the load chain\'s files changed since the capture of ' + PAGE.at + ': a FAIL below means the game\'s ' +
    'aeroplane moved - re-capture with node tools/join_parity_page.js if that move is meant, and say so in the HANDOVER)');
  for (const k of KEYS) {
    const P = PAGE.builds[k]; if (!P) continue;
    const r = LB.loadValidated(k);
    NODE[k] = r;
    // THE DECLARED PAGE-TIMED ROWS: a floatplane's step stands on the flown CG the balance WORKER answers (G396), and
    // the page rebuilds when that answer moved > 2 cm - the answer it acts on is whichever arrives, so the page's own
    // float station varies inside that deadband from run to run. Node runs the handshake deterministically
    // (tools/_load_build.js 3c); the two rows are held to FLOAT_TOL and then carried from the page, so every other
    // number of the def is still compared exactly.
    const ns = clone(r.spec);
    if (P.spec.gear && P.spec.gear.type === 'floats' && P.spec.gear.floats && ns.gear && ns.gear.floats) {
      const dx = Math.abs(ns.gear.floats.x - P.spec.gear.floats.x), dy = Math.abs(ns.gear.floats.y - P.spec.gear.floats.y);
      ok(dx <= FLOAT_TOL && dy <= FLOAT_TOL, LB.VALIDATED[k].label.padEnd(16) + ' the float station (the page\'s CG handshake, declared): x ' +
        ns.gear.floats.x.toFixed(5) + ' / page ' + P.spec.gear.floats.x.toFixed(5) + ', y ' + ns.gear.floats.y.toFixed(5) + ' / page ' +
        P.spec.gear.floats.y.toFixed(5) + ' (within ' + (FLOAT_TOL * 1000) + ' mm)');
      ns.gear.floats.x = P.spec.gear.floats.x; ns.gear.floats.y = P.spec.gear.floats.y;
    }
    let dn = C.buildGen(ns);
    if (SELF && k === 'metal') { dn = C.buildGen(rawSpec(k)); console.log('     (selftest: the metal Cessna flown as written)'); }
    if (SELF && k === 'cub') { dn.beams[0] = Object.assign({}, dn.beams[0], { k: dn.beams[0].k * (1 + 1e-6) }); console.log('     (selftest: one member of the Cub 1e-6 stiffer)'); }
    const d = defDiff(dn, C.buildGen(clone(P.spec)));
    ok(same(d), LB.VALIDATED[k].label.padEnd(16) + ' node = page: ' + fmtD(d) + (r.cached ? '' : '  [chain computed]'));
  }
}

// ---- 2. the old path differs where the finding said ---------------------------------------------------------------
console.log('== 2. the file as written is NOT the game\'s aeroplane (the pre-G1985 loaders) ==');
if (PAGE) {
  const engX = d => { const e = d.refs.engine || []; return e.length ? d.nodes[e[0]].p[0] : null; };
  const dRaw = C.buildGen(rawSpec('metal')), dPage = C.buildGen(clone(PAGE.builds.metal.spec));
  ok(Math.abs(engX(dRaw) - engX(dPage)) > 0.3,
    'metal Cessna: the engine nodes as written at x ' + engX(dRaw).toFixed(3) + ' m, in the game at ' + engX(dPage).toFixed(3) +
    ' (the join\'s engines[0].x = ' + (PAGE.builds.metal.spec.engines[0].x != null ? PAGE.builds.metal.spec.engines[0].x.toFixed(4) : 'none') + ')');
  const tag = (d, t) => d.nodes.find(n => n.tag === t);
  const vy = d => { const v = tag(d, 'VSNL'), b = tag(d, 'S0BL'); return v && b ? v.p[1] - b.p[1] : null; };
  const cRaw = C.buildGen(rawSpec('cub')), cPage = C.buildGen(clone(PAGE.builds.cub.spec));
  const M = d => d.nodes.reduce((s, n) => s + n.m, 0);
  ok(vy(cPage) != null && vy(cPage) < 0.2 && vy(cRaw) > 0.5 && Math.abs(M(cRaw) - M(cPage)) > 5,
    'Cub: the nose tank\'s nodes as written ' + vy(cRaw).toFixed(3) + ' m over the firewall\'s foot, in the game ' + vy(cPage).toFixed(3) +
    '; ' + M(cRaw).toFixed(2) + ' kg as written, ' + M(cPage).toFixed(2) + ' in the game (the tank ' +
    PAGE.builds.cub.spec.energy.vessels.map(v => v.capacity + ' L').join(', ') + ')');
}

// ---- 3. a pure function -------------------------------------------------------------------------------------------
console.log('== 3. the chain is a pure function of its inputs ==');
{
  const keep = process.env.FLYDIY_JOIN_NOCACHE;
  process.env.FLYDIY_JOIN_NOCACHE = '1';
  for (const k of ['metal', 'cub']) {
    const a = LB.loadValidated(k), b = LB.loadValidated(k);
    const cached = NODE[k] || a;
    ok(JSON.stringify(a.spec) === JSON.stringify(b.spec) && JSON.stringify(a.spec) === JSON.stringify(cached.spec),
      LB.VALIDATED[k].label + ': two fresh computations and the cache agree to the byte');
  }
  if (keep === undefined) delete process.env.FLYDIY_JOIN_NOCACHE; else process.env.FLYDIY_JOIN_NOCACHE = keep;
}

// ---- 4. a save is a fixed point ------------------------------------------------------------------------------------
console.log('== 4. the game\'s spec saved and opened again (question 4) ==');
for (const k of KEYS) {
  const s1 = (NODE[k] || LB.loadValidated(k)).spec;
  // the save: garage.js's envelope carries the spec as it stands (JSON); the open: the same chain
  const env = JSON.parse(JSON.stringify({ what: 'flydiy-build', v: C.GEN_SPEC_V, name: k, spec: s1 }));
  const s2 = LB.gameSpec(env);
  const d = defDiff(C.buildGen(clone(s1)), C.buildGen(clone(s2)));
  const e1 = s1.engines[0], e2 = s2.engines[0];
  const xOk = e1.mount !== 'nose' || (typeof e2.x === 'number' && Math.abs(e2.x - e1.x) <= TOL);
  ok(same(d) && xOk, LB.VALIDATED[k].label.padEnd(16) + ' save -> open: ' + fmtD(d) + (e1.mount === 'nose' ? ', engines[0].x ' + (e2.x != null ? e2.x.toFixed(4) : 'MISSING') + ' carried' : ''));
}

// ---- 5. the census ------------------------------------------------------------------------------------------------
console.log('== 5. every loader of a validated build goes through tools/_load_build.js ==');
// the validated files and the metal Cessna's fixture copy (the same spec, byte for byte - checked below)
const FILES = KEYS.map(k => LB.VALIDATED[k].build).concat(['tools/fixtures/build_v10_cessnaMetal_2026-09-26.json']);
{
  const a = JSON.parse(fs.readFileSync(path.join(FLY, 'bugReports', 'cessnaMetal (1).json'), 'utf8')).spec;
  const b = JSON.parse(fs.readFileSync(path.join(FLY, 'tools', 'fixtures', 'build_v10_cessnaMetal_2026-09-26.json'), 'utf8')).spec;
  ok(JSON.stringify(a) === JSON.stringify(b), 'tools/fixtures/build_v10_cessnaMetal_2026-09-26.json is the metal Cessna\'s spec to the byte (so it is held like it)');
}
// THE DECLARED DOORS. Anything else naming a validated file must require tools/_load_build.js.
const DOORS = {
  // the real page loads the build itself (flydiy.wip / the shelf): its own chain, nothing to align
  page: ['_framecost_check', '_instant_check', '_roundtrip_check', '_sheyes_probe', '_simworker_edges_check',
    '_simworker_page_check', '_simworker_place_check', 'craft_order_probe', 'master_bench', 'rollout_perf',
    'rollout_ratchet', 'dmg_skin_stills', 'surface_shot', 'join_parity_page',
    // G2034 (DMG-RECAL): the bundle's (DMG-WALL's census drives the real page through tools/live_driver.js)
    'dmg_wall_census',
    // G2365 (DMG-BUNDLE-GREEN): DMG-WALL's GATE DMGWALLPATH (merged with claude/dmg-wall-cowl) boots the page under node
    // (_page_node.js) with the file as its autosave (flydiy.wip): the page's own load chain
    '_dmg_wallpath_check'],
  // through a loader that is itself on the chain: pilot_trace.js specOf (a .json key; pilot_matrix.js flies its cells
  // through it), _treecrash_lib.js defOf
  viaPilotTrace: ['_pilotact_check', '_plan_check', '_rwytrees_check', '_taxiclear_check', 'pilot_matrix',
    // G2034 (DMG-RECAL): the bundle's - GATE DMGTYRE and its evidence spawn pilot_trace.js on the Cub's file, MILL-TAXI's
    // build list is flown through PT.specOf by _taxiclear_check / taxi_census
    '_dmgtyre_check', 'dmgtyre_evidence', '_taxiclear_lib'],
  viaTreecrash: ['_dmg_instruments_check', '_destto_check'],
  // never flies it: the stock designs' source (_cage_page5 rows were imported from these files), a comment, a paint
  // round trip at the spec level
  spec: ['_cage_page5', '_cage_stab', '_livery_check'],
  // a JOIN UNDER TEST (the fixpoint of the join's own merge; the drawn ground against the flown): tools/_bake_joined.js
  join: ['_specfix_check', 'ground_drawn', 'ground_gap'],
};
const declared = new Map();
for (const [door, list] of Object.entries(DOORS)) for (const f of list) declared.set(f, door);
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RX = new RegExp(FILES.map(f => esc(path.basename(f))).join('|'));
let rogue = [];
const files = fs.readdirSync(T).filter(f => /\.js$/.test(f) && f !== 'flight_core.js' && f !== '_joinparity_check.js' && f !== '_load_build.js');
if (SELF) files.push('__selftest_raw_loader.js');
for (const f of files) {
  const src = f === '__selftest_raw_loader.js'
    ? "const j = JSON.parse(fs.readFileSync('builds/cub_2026-09-20_corrected.json')); C.buildGen(j.spec);"
    : fs.readFileSync(path.join(T, f), 'utf8');
  if (!RX.test(src)) continue;
  const base = f.replace(/\.js$/, '');
  if (/_load_build/.test(src)) continue;
  const door = declared.get(base);
  if (door === 'viaPilotTrace' && !/pilot_trace|pilot_matrix|PT\.specOf|specOf/.test(src)) { rogue.push(f + ' (declared via pilot_trace, does not call it)'); continue; }
  if (door === 'viaTreecrash' && !/_treecrash_lib/.test(src)) { rogue.push(f + ' (declared via _treecrash_lib, does not load it)'); continue; }
  if (!door) rogue.push(f);
}
ok(!rogue.length, 'no tool flies a validated build raw' + (rogue.length ? ': ' + rogue.join(', ') : ' (' + Object.values(DOORS).flat().length + ' declared doors)'));
for (const via of ['pilot_trace.js', '_treecrash_lib.js'])
  ok(/_load_build/.test(fs.readFileSync(path.join(T, via), 'utf8')), via + ' loads saved builds through tools/_load_build.js');

if (SHOW && PAGE) for (const k of KEYS) {
  const s = PAGE.builds[k] && PAGE.builds[k].spec;
  if (s) console.log('   ' + k + ': engines ' + JSON.stringify(s.engines.map(e => ({ mount: e.mount, x: e.x }))) + ' vessels ' +
    JSON.stringify(s.energy.vessels.map(v => ({ bay: v.bay, cap: v.capacity, along: v.along, lv: v.lv, dims: v.dims }))) + ' glazedM2 ' + s.cabin.glazedM2);
}

if (SELF) {
  // the three planted faults must each have failed: check 1 on the metal Cessna and on the Cub, and the census
  const want = 3;
  console.log(fails >= want ? 'PASS selftest: the planted faults were caught (' + fails + ' FAIL lines)' : 'FAIL selftest: only ' + fails + ' of ' + want + ' planted faults caught');
  process.exit(fails >= want ? 0 : 1);
}
console.log(fails ? 'GATE JOINPARITY: ' + fails + ' FAIL' : 'GATE JOINPARITY: PASS');
process.exit(fails ? 1 : 0);
