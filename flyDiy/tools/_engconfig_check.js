#!/usr/bin/env node
// GATE ENGCONFIG (G2790-G2799, ENGINE-CONFIGS, 2026-10-12; the user's slider review, 10 Oct: "We need the
// configuration nose engine + pusher engine (Cessna skymaster). We could activate the 3 and 4 engines configuration").
// The engine LAYOUTS (60_gen_spec GEN_ENG_LAYOUTS: pushPull = nose + pusher, tri = nose + a wing pair, quad = two wing
// pairs) on the generator, the solver and the editor's join:
//   1 IDENTITY   the validated builds and every single mount build, digested (nodes, beams, params, refs, strips and
//                2 s of the sim's first nodes), equal to master's (pinned off origin/master f353a0f8): a saved build
//                loads and flies bit-identically
//   2 CLAMP      an exact list of mounts keeps its engines (one type, each wing pair mirrored, a push-pull's rear hand
//                the nose's mirror, the quad's outer pair outboard); every other list clamps as it always did
//   3 LATTICE    each layout: every node finite, every mass positive, no member refused at zero length, the lattice
//                mirrored; refs.engineOf names every engine 0..n-1 on its own mount nodes; nEngines = n; the extra
//                engines weigh what an engine weighs
//   4 SHAKEDOWN  each layout balances (static margin 0.05-0.45) and flies a circuit on paper; the Skymaster's rear
//                disc clears its booms (propBoomClear > 0.05 m) and turns ahead of its stab
//   5 FLIGHT     the pilot flown to a straight, wings-level downwind; 4 s level with every engine (|beta| < 0.5 deg,
//                roll < 3 deg, yaw rate < 1 deg/s, < 3 m in 10 s); then ONE engine cut and 10 s flown:
//                  the Skymaster, either engine: |beta| < 0.5 deg, heading moved < 1.5 deg (centreline thrust)
//                  the Trimotor's nose: the same; a wing engine: a real yaw (beta > 0.5) but under the twin's
//                  the quad: an outer engine yaws more than an inner one, and both fly (alt lost < 15 m in 10 s)
//                  the twin fixture (the CONTROL): beta > 3 deg - the instrument sees an asymmetric cut
//   6 CERTIFY    the three, the four and the Skymaster: the certificate computed (every member's envelope finite,
//                the flown pull reached), the garage's bench to the ultimate on the certified airframe (damage on)
//                HELD with nothing broken
//   7 EDITOR     the join: engMount 4 / 5 / 6 -> the layouts, the drawn stations per entry; 0-3 the lists they were;
//                the design tiles (Push-pull / Three / Four) write engMount 4 / 5 / 6 and the Skymaster's booms
//                outboard of the rear disc; designBake's intent spec carries the layout
//   8 PHYSICS    (ENGINE-CONFIGS-2, 22 Oct, on master's propeller moments, wash and damage) the push-pull's torques and
//                angular momenta cancel, the three's and the four's add; every strip names the disc whose wake it flies
//                in and the solver gives it that disc's (a dead disc's wake is gone); a break group per engine mount
//   9 FIXTURES   the three example builds (tools/engconfig_fixtures.js): loaded as the game loads them they are the
//                saved aeroplane, no join error, the design check without a FAIL row at the worst corner, a circuit
//                flown with one engine cut, the certificate and the bench HELD
//   (5 FLIGHT also flies the stock single's own power cut: the Trimotor's nose cut is held under it)
// Run: node tools/_engconfig_check.js   (one final `GATE ENGCONFIG: PASS|FAIL`; the flights and the certificates in
// parallel children, `--jobs=N` / GATES_JOBS, default 4)
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process');
const T = __dirname, ROOT = path.join(T, '..');
const argv = process.argv.slice(2);
const C = require('./flight_core.js');
const LB = require('./_load_build.js');
const clone = o => JSON.parse(JSON.stringify(o));
const readSpec = f => { const j = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); return clone(j.spec || j); };
const D2R = Math.PI / 180, R2D = 180 / Math.PI;

// ---- the builds ------------------------------------------------------------------------------------------------------
const layout = (lay, type) => { const s = clone(C.GEN_DEFAULT); s.engines = C.genEngLayoutEngines(lay, type || s.engines[0].type); return s; };
// THE SKYMASTER-ALIKE: the stock airframe on two IO-360s (the 337's own), the pod ending at the aft bulkhead, the tail
// on twin booms set the rear disc's radius + 0.30 m out (the design tile's own rule), a tricycle like the real one
function skymaster() {
  const s = layout('pushPull', 'io360_mccauley');
  const D = C.POWERPLANTS.io360_mccauley.prop.D;
  s.tail.type = 'twinBoom'; s.tail.boomX = +(0.5 * D + 0.30).toFixed(3); s.tail.boomLen = 3.5;
  s.fuselage.boom = 'twin'; s.gear.type = 'tricycle';
  return s;
}
const BUILDS = {
  skymaster,
  tri: () => layout('tri'),
  quad: () => layout('quad'),
  twin: () => readSpec('tools/fixtures/build_v7_twin_2026-09-04.json'),
  // ENGINE-CONFIGS-2: THE SINGLE'S OWN POWER CUT, the reference for a centreline engine stopping - its torque, its
  // P-factor and its slipstream's swirl on the fin all go at once, and the fin's side force with them
  single: () => clone(C.GEN_DEFAULT),
  // ENGINE-CONFIGS-2 (G3493): the three example builds (tools/engconfig_fixtures.js bakes them), as the GAME loads them
  fixPushpull: () => clone(LB.loadBuild(FIXF('pushpull')).spec),
  fixTrimotor: () => clone(LB.loadBuild(FIXF('trimotor')).spec),
  fixFour: () => clone(LB.loadBuild(FIXF('four')).spec),
};
function FIXF(k) { return `tools/fixtures/build_v10_engcfg_${k}_2026-10-22.json`; }
const FIXES = [['fixPushpull', 'pushpull', 'pushPull', 1], ['fixTrimotor', 'trimotor', 'tri', 0], ['fixFour', 'four', 'quad', 2]];

// ---- a child: one flight ---------------------------------------------------------------------------------------------
// to a straight downwind, wings level 3 s; 4 s level with every engine; cut `cut` (none: -1); 10 s flown
function flyCase(key, cut) {
  const d = C.buildGen(BUILDS[key]()), W = C.makeWorld();
  const sim = C.makeSim(d, W); sim.reset(0);
  const ap = C.makePilot(sim, d, W);
  const o = sim.out, step = () => { ap.update(1 / 60); sim.step(1 / 60); return !sim.stats().bad; };
  let tDw = -1, lvl = 0, f = 0;
  for (; f < 60 * 420; f++) {
    if (!step()) return { err: `diverged at ${(f / 60).toFixed(1)} s (${ap.phase})` };
    if (ap.phase === 'DOWNWIND' && tDw < 0) tDw = f;
    if (tDw >= 0) {
      lvl = Math.abs(o.roll) < 2 * D2R ? lvl + 1 : 0;
      if (lvl > 180) break;
      if (f - tDw > 60 * 60) return { err: 'never wings-level on the downwind' };
    }
  }
  if (tDw < 0) return { err: `no downwind in 420 s (${ap.phase})` };
  const a0 = o.alt; let bB = 0, rB = 0, rollB = 0;
  for (let k = 0; k < 240; k++) {
    if (!step()) return { err: 'diverged level' };
    bB = Math.max(bB, Math.abs(o.beta)); rB = Math.max(rB, Math.abs(o.r)); rollB = Math.max(rollB, Math.abs(o.roll));
  }
  const a1 = o.alt, h1 = o.hdg, ph = ap.phase;
  if (cut >= 0) sim.setEngine(cut, { key: 'off' });
  let bM = 0, rM = 0, rollM = 0, drM = 0;
  for (let k = 0; k < 600; k++) {
    if (!step()) return { err: 'diverged after the cut' };
    bM = Math.max(bM, Math.abs(o.beta)); rM = Math.max(rM, Math.abs(o.r)); rollM = Math.max(rollM, Math.abs(o.roll));
    drM = Math.max(drM, Math.abs(sim.ctl.dr));
  }
  return { phase: ph + '>' + ap.phase, V: +o.V.toFixed(1), alt: +a1.toFixed(0),
           lvlDAlt: +(a1 - a0).toFixed(2), lvlBeta: bB * R2D, lvlR: rB * R2D, lvlRoll: rollB * R2D,
           beta: bM * R2D, r: rM * R2D, roll: rollM * R2D, dr: drM,
           dHdg: Math.atan2(Math.sin(o.hdg - h1), Math.cos(o.hdg - h1)) * R2D, dAlt: +(o.alt - a1).toFixed(2),
           thrustPer: (o.thrustPer || []).map(x => Math.round(x)) };
}

// ---- a child: one certificate and its bench --------------------------------------------------------------------------
function certCase(key) {
  const BW = require(path.join(ROOT, 'src', 'viewer', 'bench_worker.js'));
  const d = C.buildGen(BUILDS[key]());
  const cert = C.genCertify(d, {});
  let nonFinite = 0;
  for (let i = 0; i < cert.nb; i++) if (!isFinite(cert.Ft[i]) || !isFinite(cert.Fc[i])) nonFinite++;
  const o = Object.assign({}, d, { params: Object.assign({}, d.params, { damage: true }), cert });
  const sim = C.makeSim(o, null); sim.reset(0);
  const cfg = BW.benchLoadCfg({ genSurfKey: C.genSurfKey }, o.spec, { limit: C.GEN_LOAD_LIMIT, ult: C.GEN_LOAD_ULT, holdS: 1.5 });
  cfg.surface = 'wing';
  const rig = C.makeLoadTest(sim, o, cfg);
  for (let f = 0; f < 60 * 120 && !rig.state.done; f++) rig.step(1 / 60);
  const D = sim.damage();
  return { nb: cert.nb, nonFinite, flownReached: cert.flownReached, verdict: rig.state.verdict, breaks: D.breaks,
           brokeAt: rig.state.brokeAt == null ? null : +rig.state.brokeAt.toFixed(2), ms: cert.ms && Math.round(cert.ms.total) };
}

// ---- a child: the editor (the panel headless, GATE DESIGN's own loader) ----------------------------------------------
function editorCase() {
  for (const k of Object.keys(C)) global[k] = C[k];
  const noop = function () { return this; };
  class Obj { constructor() { this.children = []; this.position = { set: noop }; this.rotation = {}; this.scale = { set: noop, setScalar: noop }; }
    add() { return this; } remove() {} traverse() {} }
  global.THREE = new Proxy({}, { get: (t, k) => k === 'Vector3' ? function () { return { set: noop, x: 0, y: 0, z: 0 }; } : class extends Obj {} });
  global.window = { THREE: global.THREE };
  for (const f of ['_cage_parts.js', '_cage_page5.js', '_cage_gen.js', '_cage_crew.js', '_gear_kit.js', '_gear_gen.js', '_gear_page.js',
    '_cage_gear.js', '_float_gen.js', '_cage_float.js', '_fit_site.js', '_fit_gen.js', '_eng_gen.js', '_eng_mesh.js', '_eng_page.js',
    '_cowl_gen.js', '_cowl_rows.js', '_cage_cowl.js', '_cage_eng.js', '_strut_gen.js', '_boom_gen.js', '_cage_wing.js', '_cage_brace.js',
    '_fin_gen.js', '_cage_fin.js', '_cage_stab.js', '_cage_access.js', '_cage_light.js'])
    require(path.join(T, f));
  const J = require(path.join(T, '_cage_join.js'));
  global.window.CAGE_JOIN_ENGINES = J.CAGE_JOIN_ENGINES;
  const D = require(path.join(T, '_cage_design.js'));
  const out = { checks: [] };
  const chk = (c, m) => out.checks.push([!!c, m]);
  // the join
  const TT = { PRESET_NAMES: ['continental A-65'], TIP_KEYS: Object.keys(C.GEN_TIPS), FLAP_KEYS: Object.keys(C.GEN_FLAPS) };
  const EU = [{ x: -1.1, y: 0.30, z: 0 }, { x: 2.9, y: 0.50, z: 0 }, { x: 0.4, y: 1.0, z: -2.0 }, { x: 0.4, y: 1.0, z: 2.0 }];
  const mounts = m => J.cageJoinSpec({ engMount: m, engPreset: 0 }, { engUnits: EU }, TT).engines.map(e => e.mount).join(',');
  chk(mounts(0) === 'nose' && mounts(1) === 'pusher' && mounts(2) === 'wingTop' && mounts(3) === 'wing,wing',
      'join: engMount 0-3 -> the lists they always were (' + [0, 1, 2, 3].map(mounts).join(' | ') + ')');
  chk(mounts(4) === 'nose,pusher' && mounts(5) === 'nose,wing,wing' && mounts(6) === 'wing,wing,wing,wing',
      'join: engMount 4 / 5 / 6 -> push-pull / three / four (' + [4, 5, 6].map(mounts).join(' | ') + ')');
  const s4 = J.cageJoinSpec({ engMount: 4, engPreset: 0 }, { engUnits: EU }, TT);
  chk(s4.engines[0].x === -1.1 && s4.engines[1].x === 2.9 && s4.engines[1].y === 0.5,
      'join: each push-pull entry carries its own drawn station (nose flange -1.1, pusher 2.9 / 0.50)');
  const R4 = C.resolveSpec(clone(s4)).spec;
  chk(R4.engLayout === 'pushPull' && R4.engAt[1].x === 2.9 && R4.engines[1].sense === -R4.engines[0].sense,
      'join -> resolved: pushPull, the pusher at its drawn station, the rear hand the nose\'s mirror');
  const s6 = J.cageJoinSpec({ engMount: 6, engPreset: 0, engRotate: 1 }, { engUnits: EU }, TT);
  chk(s6.engines.map(e => e.sense).join(',') === '1,-1,1,-1', 'join: the four\'s pairs each tops-inward (' + s6.engines.map(e => e.sense).join(',') + ')');
  // the tiles
  const P0 = { engMount: 0, boomX: 1.2, cw_propD: 1.88, cowlLoops: 0 };
  const a = sel => D.designApply(P0, sel).cage;
  const pp = a({ engCount: 'pushPull' }), t3 = a({ engCount: 3 }), t4 = a({ engCount: 4 });
  chk(pp.engMount === 4 && pp.boomTwin === 1 && pp.cowlOn === 1 && pp.boomX >= 0.5 * 1.88 + 0.30 - 1e-9,
      `tile Push-pull: engMount 4, twin booms at ${pp.boomX} (the disc's radius + 0.30), the nose cowl on`);
  chk(t3.engMount === 5 && t3.cowlOn === 1 && t3.noseFinish === 0 && t3.cw_aftMode === 1, 'tile Three: engMount 5, the nose keeps its cowl, the nacelles a tail');
  chk(t4.engMount === 6 && t4.engNacAt2 > t4.engNacAt, 'tile Four: engMount 6, the outer pair outboard of the inner');
  chk(a({ engCount: 1 }).engMount === 0 && D.designApply(Object.assign({}, P0, { engMount: 6 }), { engCount: 1 }).cage.engMount === 0,
      'tile Single: a layout goes back to the nose');
  const row = D.DESIGN_ROWS.find(r => r.key === 'engCount');
  chk(row.options.filter(o => [3, 4, 'pushPull'].includes(o.value)).every(o => !o.inactive),
      'the Engines row\'s Three / Four / Push-pull tiles are live');
  chk(row.read({ engMount: 4 }) === 'pushPull' && row.read({ engMount: 5 }) === 3 && row.read({ engMount: 6 }) === 4 &&
      row.read({ engMount: 3 }) === 2 && row.read({ engMount: 1 }) === 1, 'the Engines row reads the layout back');
  if (typeof D.designBake === 'function') {
    let b = null; try { b = D.designBake({ engCount: 'pushPull' }); } catch (e) { b = { err: e.message }; }
    chk(b && Array.isArray(b.engines) && b.engines.map(e => e.mount).join(',') === 'nose,pusher',
        'designBake (the birth intent) carries the push-pull (' + (b && (b.err || (b.engines || []).map(e => e.mount).join(','))) + ')');
  }
  return out;
}

if (argv[0] === '--fly') { console.log(JSON.stringify(flyCase(argv[1], +argv[2]))); process.exit(0); }
if (argv[0] === '--cert') { console.log(JSON.stringify(certCase(argv[1]))); process.exit(0); }
if (argv[0] === '--editor') { console.log(JSON.stringify(editorCase())); process.exit(0); }
const PINMODE = argv[0] === '--pin';

// ---- the parent ------------------------------------------------------------------------------------------------------
let ok = true; const why = [];
const say = s => console.log(s);
const chk = (c, m) => { say((c ? '  ok    ' : '  FAIL  ') + m); if (!c) { ok = false; why.push(m); } return c; };
const jobs = Math.max(1, +((argv.find(a => a.startsWith('--jobs=')) || '').split('=')[1] || process.env.GATES_JOBS || 4));
const kids = [];
const spawn = (args, label) => kids.push({ args, label });
for (const k of ['skymaster', 'tri', 'quad']) spawn(['--cert', k], 'cert ' + k);
for (const [k] of FIXES) spawn(['--cert', k], 'cert ' + k);
spawn(['--editor'], 'editor');
const FLIGHTS = [['skymaster', -1], ['skymaster', 0], ['skymaster', 1], ['tri', -1], ['tri', 0], ['tri', 1],
                 ['quad', -1], ['quad', 0], ['quad', 2], ['twin', 0], ['single', 0]];
for (const [k, , , c] of FIXES) FLIGHTS.push([k, c]);
for (const [k, c] of FLIGHTS) spawn(['--fly', k, String(c)], `fly ${k} cut ${c}`);
const results = {};
function runKids() {
  return new Promise(res => {
    let next = 0, live = 0;
    const pump = () => {
      if (next >= kids.length && live === 0) return res();
      while (live < jobs && next < kids.length) {
        const K = kids[next++]; live++;
        const p = cp.spawn(process.execPath, [__filename, ...K.args], { stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '', err = '';
        p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
        p.on('close', code => {
          live--;
          try { results[K.label] = JSON.parse(out.trim().split('\n').pop()); }
          catch (e) { results[K.label] = { err: `exit ${code}: ${(err || out).trim().split('\n').slice(-3).join(' | ')}` }; }
          pump();
        });
      }
    };
    pump();
  });
}
const kidsDone = PINMODE ? null : runKids();

// 1 IDENTITY ------------------------------------------------------------------------------------------------------------
// ENGINE-CONFIGS-2 (G3492, 22 Oct): re-pinned on master 2c2a74459 (train L22c) - every row equal on the branch; the user's
// validated aeroplanes (the Cub, the Jodel, the twin floatplane's file, the metal Cessna, the Cessna on floats, Rufus) are
// digested as the GAME flies them (tools/_load_build.js: the page's load door, the join, the merge - GATE JOINPARITY's
// one load path), every other fixture as written. `--pin` prints this table for the tree it runs in (run it on master).
say('1 IDENTITY - the saved builds and the single mounts, digested against master (2c2a74459)');
const VAL_FILES = new Set(Object.values(LB.VALIDATED).map(v => v.build).concat(['tools/fixtures/repro/rufus_2026-10-18_certified.json']));
const PIN = {
  'builds/cub_2026-09-20_corrected.json': '2edac3d4580bbcb2 869eee72737d7526',
  'builds/jodel_2026-09-20_corrected.json': '38e084604f47abe6 3fb1153b36c2c325',
  'builds/cessna172_2026-09-20_corrected.json': '8ea6b7d05a8f54b5 c3124e0092d05851',
  'builds/chinook_2026-09-21_corrected.json': '4facb98d84baeb0f f4dbe53bc257a050',
  'tools/fixtures/build_v7_ultralight_2026-09-05.json': 'b3f8c01060020c33 e7942c80c42fb7f0',
  'tools/fixtures/build_v8_twin-boom_2026-09-11.json': '954746f8316b9701 77b62ab7c4146aaa',
  'tools/fixtures/build_v7_twin_2026-09-04.json': 'a5586891e6aec073 221d6c2405b15e1e',
  'tools/fixtures/build_v8_pusher_2026-09-11.json': '268edc2070febf93 1e888903ddfb652c',
  'bugReports/cessnaMetal (1).json': 'e4735c255b5f4c71 7e50d230440c0ad2',
  'bugReports/cessnaFloatsWOrks.json': '0c4b5dc1b32baeb4 10f6c3086fad509f',
  'tools/fixtures/repro/rufus_2026-10-18_certified.json': 'e0f2ee3392db1461 bb817d87f0edc3eb',
  'stock nose': 'c61ce520a6cc85e2 31cce33943cc578a',
  'stock pusher': '04f30522a6a9ed04 5613f19c025bd3cf',
  'stock wingTop': '88406c468a775d6e 53a5929a6f5191d4',
  'stock wing': 'b09bdcdd70bc0f36 7f98742af70074a4',
  'stock 2 nose (clamped to one)': 'c61ce520a6cc85e2 31cce33943cc578a',
  'stock pusher+nose (clamped to one)': '04f30522a6a9ed04 5613f19c025bd3cf',
};
const H = o => crypto.createHash('sha1').update(JSON.stringify(o, (k, v) => typeof v === 'number' && !isFinite(v) ? String(v) : v)).digest('hex').slice(0, 16);
const stockMount = (...ms) => () => { const s = clone(C.GEN_DEFAULT); s.engines = ms.map(m => ({ type: s.engines[0].type, mount: m })); return s; };
const IDS = {
  'stock nose': stockMount('nose'), 'stock pusher': stockMount('pusher'), 'stock wingTop': stockMount('wingTop'),
  'stock wing': stockMount('wing'), 'stock 2 nose (clamped to one)': stockMount('nose', 'nose'),
  'stock pusher+nose (clamped to one)': stockMount('pusher', 'nose'),
};
const ID_KEYS = ['builds/cub_2026-09-20_corrected.json', 'builds/jodel_2026-09-20_corrected.json',
  'builds/cessna172_2026-09-20_corrected.json', 'builds/chinook_2026-09-21_corrected.json',
  'tools/fixtures/build_v7_ultralight_2026-09-05.json', 'tools/fixtures/build_v8_twin-boom_2026-09-11.json',
  'tools/fixtures/build_v7_twin_2026-09-04.json', 'tools/fixtures/build_v8_pusher_2026-09-11.json',
  // (A0, 22 Oct: the metal Cessna is the user's own file, and the Cessna on floats is in - both loaded the game's way)
  'bugReports/cessnaMetal (1).json', 'bugReports/cessnaFloatsWOrks.json', 'tools/fixtures/repro/rufus_2026-10-18_certified.json',
  ...Object.keys(IDS)];
for (const k of ID_KEYS) {
  let got;
  try {
    const def = C.buildGen(IDS[k] ? IDS[k]() : VAL_FILES.has(k) ? clone(LB.loadBuild(k).spec) : readSpec(k));
    const sim = C.makeSim(def, C.makeWorld()); sim.reset(0);
    for (let i = 0; i < 120; i++) sim.step(1 / 60);
    got = H({ nodes: def.nodes, beams: def.beams, params: def.params, refs: def.refs, strips: def.strips }) + ' ' +
          H(Array.from(sim.p.slice(0, 60)).map(x => +x.toFixed(9)));
  } catch (e) { got = 'ERR ' + e.message; }
  if (PINMODE) { console.log(`  '${k}': '${got}',`); continue; }
  chk(got === PIN[k], `${k.padEnd(52)} ${got}${got === PIN[k] ? '' : '  (master ' + PIN[k] + ')'}`);
}
if (PINMODE) process.exit(0);

// 2 CLAMP ---------------------------------------------------------------------------------------------------------------
say('2 CLAMP - the exact lists keep their engines; every other list clamps as before');
{
  const cs = (...E) => C.clampSpec(Object.assign(clone(C.GEN_DEFAULT), { engines: E })).engines;
  const pp = cs({ type: 'o200_eprops', mount: 'nose', sense: 1 }, { type: 'a65_sensenich74', mount: 'pusher', sense: 1 });
  chk(pp.length === 2 && pp[1].type === 'o200_eprops' && pp[1].sense === -1,
      `[nose, pusher] keeps both, one engine type, the rear hand mirrored (${pp.map(e => e.type + '/' + e.sense).join(' ')})`);
  const tr = cs({ type: 'a65_sensenich74', mount: 'nose' }, { mount: 'wing', x: 0.4, z: 2.1 }, { mount: 'wing', x: 0.9, z: 3 });
  chk(tr.length === 3 && tr[2].x === 0.4 && tr[2].z === 2.1 && tr[2].type === 'a65_sensenich74',
      '[nose, wing, wing] keeps three, the pair mirrored off its port entry');
  const q = cs(...[3.0, 3.0, 1.5, 1.5].map(z => ({ type: 'a65_sensenich74', mount: 'wing', z })));
  chk(q.length === 4 && q[0].z === 1.5 && q[2].z === 3.0, `[wing x4] keeps four, the outer pair outboard (z ${q.map(e => e.z).join(' ')})`);
  chk(cs({ mount: 'nose' }, { mount: 'nose' }).length === 1 && cs({ mount: 'nose' }, { mount: 'wing' }).length === 1 &&
      cs({ mount: 'wing' }).length === 2 && cs({ mount: 'pusher' }, { mount: 'nose' }).length === 1 &&
      cs({ mount: 'nose' }, { mount: 'pusher' }, { mount: 'wing' }).length === 1,
      'every other list: one engine, or the classic pair (a lone wing entry doubled)');
  chk(C.genEngLayoutOf([{ mount: 'nose' }, { mount: 'pusher' }]) === 'pushPull' && C.genEngLayoutOf([{ mount: 'wing' }, { mount: 'wing' }]) === null,
      'genEngLayoutOf: a layout only for the exact lists (the classic pair is not one)');
}

// 3 LATTICE + 4 SHAKEDOWN -----------------------------------------------------------------------------------------------
say('3 LATTICE / 4 SHAKEDOWN - each layout built, balanced, on paper');
const single = C.buildGen(clone(C.GEN_DEFAULT));
const mOf = d => d.nodes.reduce((a, n) => a + n.m, 0);
for (const k of ['skymaster', 'tri', 'quad']) {
  const s = BUILDS[k](), n = s.engines.length;
  let d; try { d = C.buildGen(s); } catch (e) { chk(false, `${k}: build threw ${e.message}`); continue; }
  const N = d.nodes;
  let bad = 0, zero = 0, asym = 0;
  for (const nd of N) if (!nd.p.every(Number.isFinite) || !(nd.m > 0)) bad++;
  for (const b of d.beams) { const p = N[b.a].p, q = N[b.b].p; if (b.a === b.b || Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < 1e-3) zero++; }
  const key = (x, y, z) => `${x.toFixed(3)}|${y.toFixed(3)}|${z.toFixed(3)}`, map = new Map();
  for (const nd of N) map.set(key(nd.p[0], nd.p[1], nd.p[2]), nd);
  for (const nd of N) { if (Math.abs(nd.p[2]) < 1e-3) continue; const t = map.get(key(nd.p[0], nd.p[1], -nd.p[2])); if (!t || Math.abs(t.m - nd.m) > 1e-6) asym++; }
  const deg = (d.parts && d.parts.degenerate) || [];
  chk(!bad && !zero && !asym && !deg.length, `${k}: ${N.length} nodes, ${d.beams.length} beams - finite ${!bad}, no zero member ${!zero && !deg.length}, mirrored ${!asym}`);
  const EO = d.refs.engineOf, E = d.refs.engine;
  const per = Array.from({ length: n }, (_, i) => E.filter((_, j) => EO[j] === i));
  chk(d.params.nEngines === n && per.every(a => a.length >= 1),
      `${k}: nEngines ${d.params.nEngines}, engineOf [${EO.join(',')}] - every engine on its own mount nodes`);
  const S = d.spec, mE = (S.pplant || C.POWERPLANTS[S.engine]).engine.mass;
  const dm = mOf(d) - mOf(k === 'skymaster' ? C.buildGen((() => { const t = skymaster(); t.engines = [t.engines[0]]; return t; })()) : single);
  chk(dm > (n - 1) * mE, `${k}: the extra engines weigh what they weigh (+${dm.toFixed(0)} kg for ${n - 1} x ${mE} kg dry)`);
  // the centreline engines stay on the centreline, the nacelles mirror each other
  const zs = per.map(a => a.map(i => N[i].p[2]));
  const sideOK = S.engAt.every((e, i) => e.mount === 'wing' ? Math.abs(zs[i].reduce((x, y) => x + y, 0) / zs[i].length) > 0.5 : zs[i].every(z => Math.abs(z) < 0.5));
  chk(sideOK, `${k}: each engine's thrust nodes where its mount is (centreline / a nacelle a side)`);
  const sh = C.genShakedown(d);
  chk(sh.staticMargin > 0.05 && sh.staticMargin < 0.45 && sh.flyableCircuit,
      `${k}: static margin ${sh.staticMargin.toFixed(3)}, flyable circuit ${sh.flyableCircuit} (mass ${sh.mass.toFixed(0)} kg, Vs ${sh.Vs.toFixed(1)} m/s)`);
  if (k === 'skymaster') {
    chk(sh.propBoomClear > 0.05 && sh.propStabClear > S.propR,
        `skymaster: the rear disc clears the booms by ${sh.propBoomClear.toFixed(3)} m and turns ${sh.propStabClear.toFixed(2)} m ahead of the stab`);
    chk(S.engAt[0].sense === -S.engAt[1].sense, 'skymaster: the props counter-rotate (the rear engine turned round) - torque and P-factor cancel in pairs');
  }
}

// 8 PHYSICS (ENGINE-CONFIGS-2, G3490-G3492: the layouts on master's propeller, wash and damage) ---------------------------
//   TORQUE   the propeller's moments per engine (30_solver G2080, out.propFx): the push-pull's reaction torques and
//            angular momenta equal and opposite (they cancel in pairs), the three's and the four's add
//   WAKES    each strip names its disc (62_gen_aero genStripsLayout): the tail the nose's (a three) or the centreline in
//            series (a push-pull), a wing strip the nose's or its own side's nacelle; a twin boom's fins out of a
//            push-pull's wake; and the solver's discs (out.washE): a dead disc's wake is gone, the others' are not
//   DAMAGE   every engine of a layout its own part and break group (eng, engAft, engL / engR, engL2 / engR2), no
//            member left out of a group but the twin boom's own stab-boom joints (master's, the single's count)
function physics() {
  say('8 PHYSICS - the propeller\'s moments, the wakes, the break groups');
  const ground = (key, cut) => {
    const d0 = C.buildGen(BUILDS[key]()), d = Object.assign({}, d0, { params: Object.assign({}, d0.params, { damage: false }) });
    const sim = C.makeSim(d, C.makeWorld()); sim.reset(0);
    if (cut >= 0) sim.setEngine(cut, { key: 'off' });
    sim.ctl.brake = 1; sim.ctl.thr = 1;
    for (let i = 0; i < 60; i++) sim.step(1 / 60);
    const P = sim.out.propFx, n = d.params.nEngines;
    return { tq: Array.from({ length: n }, (_, k) => P.tq[k * 3]), H: Array.from(P.H), sense: d.params.engines.map(e => e.sense),
             washE: sim.out.washE ? Array.from(sim.out.washE) : null, wash: sim.out.wash, thr: Array.from(sim.out.thrustPer) };
  };
  const f1 = x => x.toFixed(1);
  { const g = ground('skymaster', -1), net = g.tq[0] + g.tq[1], Hn = g.sense[0] * g.H[0] + g.sense[1] * g.H[1];
    chk(g.tq[0] > 0 && Math.abs(net) < 1e-9 * g.tq[0] && Math.abs(Hn) < 1e-9 * g.H[0],
        `TORQUE skymaster: reaction ${g.tq.map(f1).join(' / ')} N.m, net ${net.toExponential(1)}; angular momentum ${g.H.map(f1).join(' / ')} (hands ${g.sense.join(',')}), net ${Hn.toExponential(1)} - they cancel in pairs`); }
  for (const k of ['tri', 'quad']) {
    const g = ground(k, -1), q0 = g.tq[0];
    chk(q0 > 0 && g.tq.every(q => Math.abs(q - q0) < 1e-9 * q0) && g.sense.every(s => s === g.sense[0]),
        `TORQUE ${k}: every engine's reaction ${f1(q0)} N.m the same hand - the sum ${f1(g.tq.reduce((a, b) => a + b, 0))} N.m, ${g.tq.length} x a single's`);
  }
  // the strips' discs
  const own = k => C.buildGen(BUILDS[k]()).strips;
  { const st = own('tri'), tail = st.filter(s => s.kind !== 'wing'), wing = st.filter(s => s.kind === 'wing' && s.wash > 0);
    chk(tail.length && tail.every(s => s.washE === 0) && wing.every(s => s.washE >= 0 && s.washE <= 2) &&
        wing.some(s => s.washE === 1) && wing.some(s => s.washE === 2) && wing.some(s => s.washE === 0),
        `WAKES tri: the tail in the nose's wake (${tail.length} strips), the wing in the nose's or its nacelle's`); }
  { const st = own('skymaster'), stab = st.filter(s => s.kind === 'stab'), fins = st.filter(s => s.kind === 'fin');
    chk(stab.length && stab.every(s => s.washE === -2) && fins.length && fins.every(s => s.wash === 0) && st.filter(s => s.kind === 'wing').every(s => s.washE !== 1),
        `WAKES skymaster: the stab in the centreline's series wake (${stab.length} strips), the boom fins out of it (${fins.length}), no wing strip blown by the pusher`); }
  { const st = own('quad'), tail = st.filter(s => s.kind !== 'wing'), wing = st.filter(s => s.kind === 'wing' && s.wash > 0);
    chk(tail.every(s => !(s.wash > 0)) && [0, 1, 2, 3].every(e => wing.some(s => s.washE === e)),
        `WAKES quad: no tail wash (between the nacelles), each of the four discs blows its own wing strips`); }
  { const a = ground('tri', -1), b = ground('tri', 0), c = ground('tri', 1);
    chk(a.washE && a.washE[0] > 1 && b.washE[0] === 0 && b.wash > 1 && b.washE[1] > 1 && c.washE[1] === 0 && c.washE[0] > 1,
        `WAKES tri in the solver: every disc ${a.washE.slice(0, 3).map(f1).join(' / ')} m/s; the nose off ${b.washE.slice(0, 3).map(f1).join(' / ')} (the mean disc would say ${f1(b.wash)} on the tail); a wing off ${c.washE.slice(0, 3).map(f1).join(' / ')}`); }
  { const a = ground('skymaster', -1), b = ground('skymaster', 0);
    chk(a.washE && a.washE[2] > a.washE[0] && b.washE[0] === 0 && b.washE[2] === b.washE[1] && b.washE[2] > 1,
        `WAKES skymaster in the solver: the series wake ${f1(a.washE[2])} m/s over one disc's ${f1(a.washE[0])}; the nose off: the pusher's own ${f1(b.washE[2])}`); }
  // the break groups
  const WANT = { skymaster: ['eng', 'engAft'], tri: ['eng', 'engL', 'engR'], quad: ['engL', 'engR', 'engL2', 'engR2'] };
  const tbIssues = (() => { const s = clone(C.GEN_DEFAULT); s.engines[0].mount = 'pusher'; s.tail.type = 'twinBoom'; s.tail.boomX = 1.24; s.tail.boomLen = 3.5; s.fuselage.boom = 'twin';
    return C.buildGen(s).parts.dmg.issues.length; })();
  for (const k of Object.keys(WANT)) {
    const d = C.buildGen(BUILDS[k]()), dm = d.parts.dmg, mnt = dm.groups.filter(g => g.joint === 'mount').map(g => g.part).sort();
    const engIss = dm.issues.filter(s => /eng/.test(s)), other = dm.issues.length - engIss.length;
    const engParts = new Set(dm.part.filter(p => /^eng/.test(p)));
    chk(JSON.stringify(mnt) === JSON.stringify(WANT[k].slice().sort()) && engParts.size === WANT[k].length && !engIss.length &&
        other === (k === 'skymaster' ? tbIssues : 0),
        `DAMAGE ${k}: a mount break group per engine (${mnt.join(', ')}), ${engIss.length} engine issues, ${other} other (the twin boom's own: ${k === 'skymaster' ? tbIssues : 0})`);
  }
}

// 5 FLIGHT + 6 CERTIFY + 7 EDITOR (the children) ------------------------------------------------------------------------
kidsDone.then(() => {
  say('5 FLIGHT - a straight downwind, wings level; every engine, then one cut (10 s)');
  const F = (k, c) => results[`fly ${k} cut ${c}`] || { err: 'not flown' };
  const line = (k, c, r) => r.err ? `${k} cut ${c}: ${r.err}` :
    `${k.padEnd(9)} cut ${String(c).padStart(2)}: beta ${r.beta.toFixed(2)} deg, r ${r.r.toFixed(2)} deg/s, roll ${r.roll.toFixed(1)}, ` +
    `hdg ${r.dHdg.toFixed(2)} deg, alt ${r.dAlt.toFixed(1)} m, rudder ${r.dr.toFixed(3)}, thrust [${r.thrustPer.join(' ')}] N`;
  for (const k of ['skymaster', 'tri', 'quad']) {
    const r = F(k, -1);
    chk(!r.err && r.lvlBeta < 0.5 && r.lvlRoll < 3 && r.lvlR < 1 && Math.abs(r.lvlDAlt) < 3 && r.beta < 0.5 && r.roll < 3 && Math.abs(r.dAlt) < 3,
        r.err ? `${k} level: ${r.err}` : `${k.padEnd(9)} level, every engine: beta ${r.beta.toFixed(2)} deg, roll ${r.roll.toFixed(2)} deg, r ${r.r.toFixed(2)} deg/s, ${r.dAlt.toFixed(1)} m in 10 s at ${r.V} m/s`);
  }
  const ctl = F('twin', 0);
  chk(!ctl.err && ctl.beta > 3, 'CONTROL ' + line('twin', 0, ctl) + ' - an asymmetric cut is seen');
  for (const c of [0, 1]) {
    const r = F('skymaster', c);
    chk(!r.err && r.beta < 0.5 && Math.abs(r.dHdg) < 1.5 && r.r < 1 && r.dAlt > -15, line('skymaster', c, r) + ' - centreline: small yaw');
  }
  // ENGINE-CONFIGS-2: the Trimotor's nose is a single's engine on the centreline - with the propeller's own moments on
  // master (G2080: torque, P-factor, the swirl on the fin) its cut yaws as a single's power cut does, never more, and
  // there is no thrust couple (12 Oct's 0.5 deg bound was written before those moments existed)
  const sg = F('single', 0);
  chk(!sg.err && sg.beta > 0.5, 'REFERENCE ' + line('single', 0, sg) + ' - a single\'s own power cut (its torque, P-factor and swirl go)');
  { const r = F('tri', 0); chk(!r.err && !sg.err && r.beta <= sg.beta && Math.abs(r.dHdg) < 1.5 && r.dAlt > -15,
      line('tri', 0, r) + ` - the nose engine: no thrust couple, a yaw under the single's power cut (${sg.err ? '?' : sg.beta.toFixed(2)} deg)`); }
  { const r = F('tri', 1); chk(!r.err && r.beta > 0.5 && (ctl.err || r.beta < ctl.beta) && r.dAlt > -15, line('tri', 1, r) + ' - a wing engine: a yaw, under the twin\'s'); }
  { const ri = F('quad', 0), ro = F('quad', 2);
    chk(!ri.err && ri.dAlt > -15 && ri.roll < 15, line('quad', 0, ri) + ' - an inner engine out flies');
    chk(!ro.err && ro.dAlt > -15 && ro.roll < 15 && !ri.err && ro.beta > ri.beta, line('quad', 2, ro) + ' - an outer engine out flies, and yaws more than an inner'); }

  say('6 CERTIFY - the certificate and the bench to the ultimate (damage on)');
  for (const k of ['skymaster', 'tri', 'quad']) {
    const r = results['cert ' + k] || { err: 'not run' };
    chk(!r.err && r.nonFinite === 0 && r.flownReached && r.verdict === 'HELD' && r.breaks === 0,
        r.err ? `${k}: ${r.err}` : `${k.padEnd(9)} certificate: ${r.nb} members, ${r.nonFinite} without an envelope, flown pull reached ${r.flownReached}; bench to ${C.GEN_LOAD_ULT} g: ${r.verdict}, ${r.breaks} broken (${r.ms} ms)`);
  }

  say('7 EDITOR - the join and the design tiles');
  const E = results.editor || { err: 'not run' };
  if (E.err) chk(false, 'editor: ' + E.err);
  else for (const [c, m] of E.checks) chk(c, m);

  physics();

  // 9 FIXTURES ----------------------------------------------------------------------------------------------------------
  say('9 FIXTURES - the example builds (tools/fixtures/build_v10_engcfg_*): loaded as the game loads them, design-checked, flown, certified');
  for (const [k, f, lay] of FIXES) {
    let ok9 = false, msg = '';
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(ROOT, FIXF(f)), 'utf8'));
      const L = LB.loadBuild(FIXF(f));
      const dSaved = C.buildGen(clone(raw.spec)), dGame = C.buildGen(clone(L.spec));
      const same = H({ n: dSaved.nodes, b: dSaved.beams, p: dSaved.params, s: dSaved.strips }) === H({ n: dGame.nodes, b: dGame.beams, p: dGame.params, s: dGame.strips });
      const sh = C.genShakedown(dGame, { corners: true }), dc = sh.design, fails = dc.rows.filter(r => r.level === 'fail');
      const errs = (L.errors || []).length;
      ok9 = dGame.spec.engLayout === lay && same && !fails.length && !errs && sh.flyableCircuit;
      msg = `${f.padEnd(9)} ${dGame.spec.engLayout}, ${dGame.params.nEngines} x ${dGame.spec.engine}, ${sh.mass.toFixed(0)} kg: the game's load is the saved aeroplane ${same}, ` +
            `join errors ${errs}, design ${dc.verdict.toUpperCase()} (static margin ${sh.staticMargin.toFixed(3)} as drawn, ${dc.rows.find(r => r.id === 'pitch.sm').value} at the worst corner)` +
            (fails.length ? ' FAIL ' + fails.map(r => r.id).join(',') : '');
    } catch (e) { msg = `${f}: ${e.message}`; }
    chk(ok9, msg);
  }
  for (const [k, f, , c] of FIXES) {
    const r = F(k, c);
    chk(!r.err && r.dAlt > -15 && r.roll < 15 && Math.abs(r.dHdg) < 5, line(f, c, r) + ' - flies the circuit, one engine cut');
    const q = results['cert ' + k] || { err: 'not run' };
    chk(!q.err && q.nonFinite === 0 && q.flownReached && q.verdict === 'HELD' && q.breaks === 0,
        q.err ? `${f}: ${q.err}` : `${f.padEnd(9)} certificate: ${q.nb} members, flown pull reached ${q.flownReached}; bench to ${C.GEN_LOAD_ULT} g: ${q.verdict}, ${q.breaks} broken`);
  }

  if (!ok) say('FAILED: ' + why.join('; '));
  say(ok ? 'GATE ENGCONFIG: PASS' : 'GATE ENGCONFIG: FAIL');
  process.exitCode = ok ? 0 : 1;
});
