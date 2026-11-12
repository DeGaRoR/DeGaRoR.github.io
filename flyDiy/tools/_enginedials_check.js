#!/usr/bin/env node
// GATE ENGINEDIALS (ENGINE-DIALS, 2026-11-09; A0's brief from the hard-coded content audit, the user: "I am
// uncomfortable with the current situation" - the rule is WYSIWYG and one build path: what the player can build is
// what official content flies).
//   1 EVERY REGISTRY ENGINE IS A POINT ON THE DIALS. For each POWERPLANTS row, POINTS below names a catalogue preset
//     to start from and the dials a builder sets on the CUSTOM engine (the same panel rows, tools/_eng_page.js: rpm,
//     the gearbox and its ratio, the cooling, the tune `bmepK` and the build `massK` (REAL-FIGURES-3's pair, ENGINE-
//     DIALS' ranges, on all three kinds of engine), the maximum rpm, the governed propeller, a turbine's can length).
//     Every dial is inside its own row's range, and the custom engine those dials resolve to (CAGE_ENG_FACTS, the
//     join's one keeper) carries the row's flown numbers TO THE BIT (Object.is): mass, power, rpm, gear, aspiration,
//     critical altitude, family, cooling, layout, constant speed, a turbine's flat rating and length - and through
//     the core's own clamp (clampSpec) and drive (33_drive genDriveSpec: cylinders, maximum rpm, gear, torque) the
//     same numbers again. Not compared, and printed: where the mass sits (the row reads GEN_ENG_CG, measured on the
//     same preset and rounded to 1 cm - GATE ENGID §10's 2 cm), the price (a custom engine prices on the uncertified
//     market curve, G134) and the name.
//   2 EVERY PROPELLER OFFICIAL CONTENT FLIES IS ON THE EDITOR'S ROWS: each official / candidate / validated build's
//     propeller - its diameter, blade count and material - inside the cowl page's rows (cw_propD, cw_bladeN,
//     cw_material through _cage_join.js CAGE_JOIN_PROP_MATS), and (ENGINE-DIALS B) its pitch on the pitch row
//     (_cage_eng.js CAGE_PROP_PITCH: every GEN_PROP_PITCH class and 'auto'), which the float kit sets by the same writer.
//   3 A CUSTOM ENGINE INHERITS NOTHING FROM ITS FALLBACK KEY (a custom engine's engines[].type is the join's fallback,
//     the A-65's): the same custom row on every registry key resolves to the same engine, the same propeller, the same
//     drive, the same wing station, the same tech keys and the same price - so no A-65 field can ride into it.
// Run: node tools/_enginedials_check.js            (one final `GATE ENGINEDIALS: PASS|FAIL`)
//      node tools/_enginedials_check.js --emit     (re-solves every point exactly and prints the POINTS table)
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const at = p => path.join(ROOT, p);
const C = require('./flight_core.js');
global.window = globalThis;                         // the editor's classic-script world, as GATE ENGID builds it
const AnyCls = function () {};
globalThis.THREE = new Proxy({}, { get: () => AnyCls });
require(at('tools/_eng_gen.js'));
require(at('tools/_eng_mesh.js'));
eval(fs.readFileSync(at('tools/_eng_page.js'), 'utf8'));
window.COWL_GEN = { P: {} };
window.COWL_ROWS = require(at('tools/_cowl_rows.js')).COWL_ROWS;
window.CAGE_PAGE = {};
globalThis.POWERPLANTS = C.POWERPLANTS;
globalThis.GEN_DRIVE = C.GEN_DRIVE;
const JOIN = require(at('tools/_cage_join.js'));
globalThis.CAGE_JOIN_ENGINES = JOIN.CAGE_JOIN_ENGINES;
eval(fs.readFileSync(at('tools/_cage_eng.js'), 'utf8'));
const EP = window.ENG_PAGE, EG = window.ENG_GEN, FACTS = window.CAGE_ENG_FACTS, APPLY = window.CAGE_ENG_APPLY_PRESET;
const NAMES = EP.presetNames(), CUSTOM = NAMES.indexOf(EP.CUSTOM_ENGINE);

let fails = 0;
const ok = (c, l) => { console.log((c ? '  ok     ' : '  FAIL   ') + l); if (!c) fails++; };

// ---- the dials: every numeric / check row, per kind, with its range (the panel's own table) ------------------------
const KIND = a => (a === 'electric' || a === 'turbine') ? a : 'piston';
const ROWS = { piston: {}, electric: {}, turbine: {} };
for (const [, rows, show] of EP.GROUPS) {
  const kinds = show === EP.isElec ? ['electric'] : show === EP.isTurbine ? ['turbine'] : show === EP.isPiston ? ['piston']
    : ['piston', 'electric', 'turbine'];
  for (const r of rows) for (const k of kinds) ROWS[k][r[0]] = r;
}
const inRow = (kind, k, v) => {
  const r = ROWS[kind][k];
  if (!r) return false;
  if (r[2] === 'check') return v === 0 || v === 1;
  if (r[2] === 'drop') return r[3].some(o => o[0] === v);
  return v >= r[2] && v <= r[3];
};

// THE POINTS - `--emit` writes this table (the dials solved exactly against each row; see solve() below). `base` is
// the catalogue preset the builder starts from, `dials` what they then set on the custom engine.
const POINTS = (() => { try { return require('./engine_dial_points.json'); } catch (e) { return {}; } })();

// THE SEEDS: the preset a row starts from, and any geometry it changes before the tune and build are solved (only the
// rows with no catalogue preset of their own, or whose preset's cooling is not the row's)
const SEED = {
  outrunner3548_12x6: { base: 'RC 2212 outrunner', dials: { canD: 0.035, canL: 0.048, volts: 14.8 } },   // a 35 x 48 mm can on 4S
  // the EMRAX rows are rated at 2 400 rpm, their presets drawn at 4 500 / 5 000: the torque the row's power needs at
  // its own rpm wants a bigger pancake than the tune alone reaches (2.7 x the 268's)
  emrax268_carbon: { base: 'EMRAX 268', dials: { canD: 0.30 } },
  emrax228_3blade: { base: 'EMRAX 228', dials: { canD: 0.26 } },
};
// the preset behind each row: the join's own map, read backwards (the two fantasy presets name the A-65 too)
const BASE_OF = {};
for (const [name, key] of Object.entries(JOIN.CAGE_JOIN_ENGINES)) if (!BASE_OF[key] && !['flat twin', 'flat six'].includes(name)) BASE_OF[key] = name;

// ---- a custom engine on the panel, at a dial point -----------------------------------------------------------------
function panelAt(base, dials) {
  const P = Object.assign({}, window.CAGE_PAGE.defaults);
  P.engOn = 1;
  P.engPreset = NAMES.indexOf(base);
  APPLY(P, base);
  P.engPreset = CUSTOM;                       // the custom engine: every geometry row is the builder's
  for (const [k, v] of Object.entries(dials || {})) P['eng_' + k] = v;
  return P;
}
const kindOf = base => KIND((Object.assign(EP.engDefaults(), EP.PRESETS[base])).arch);

// the row's flown numbers, in the custom row's terms (absent = the default the readers take)
const FIELDS = ['mass', 'powerW', 'rpm', 'gear', 'aspiration', 'critAlt', 'family', 'cooling', 'layout', 'cs', 'flatK', 'length'];
const norm = (e, f) => {
  const v = e[f];
  if (f === 'gear') return v > 0 ? v : 1;
  if (f === 'cs') return !!v;
  if (f === 'aspiration') return v || 'na';
  return v === undefined ? null : v;
};

// ---- --emit: solve every row's tune and build (and a turbine's can length) EXACTLY --------------------------------
// The tune and the build sit inside a product (bmep x boost x volume x speed; the mass law x the extras), so one ulp of
// the dial can step the result past the row's figure. The builder's main geometry dial (a piston's bore, a motor's
// can, a turbine's gas generator) is walked by single ulps too, until both land ON the row - a dial point all the same.
const f64 = new Float64Array(1), i64 = new BigInt64Array(f64.buffer);
const nudge = (x, n) => { f64[0] = x; i64[0] += BigInt(n); return f64[0]; };
// the k in [lo, hi] at which the monotone fn(k) lands ON target, or null: bisect, then try the neighbouring ulps
function solveExact(fn, target, lo, hi) {
  let a = lo, b = hi;
  if (!(fn(a) <= target && fn(b) >= target)) return null;
  for (let i = 0; i < 1100 && a < b; i++) { const m = 0.5 * (a + b); if (m === a || m === b) break; if (fn(m) < target) a = m; else b = m; }
  for (let d = 0; d <= 8; d++) for (const s of d ? [d, -d] : [0]) { const k = nudge(b, s); if (fn(k) === target) return k; }
  return null;
}
const GEOM = { piston: 'bore', electric: 'canD', turbine: 'tCanD' };
function emit() {
  const out = {};
  for (const key of Object.keys(C.POWERPLANTS)) {
    const row = C.POWERPLANTS[key].engine;
    const seed = SEED[key] || { base: BASE_OF[key], dials: {} };
    if (!seed.base) { console.log('NO BASE for ' + key); fails++; continue; }
    const kind = kindOf(seed.base);
    const d = Object.assign({}, seed.dials);
    if (kind === 'turbine') d.tRpm = row.rpm; else d.rpm = row.rpm;
    if (kind !== 'turbine') {
      d.geared = row.gear > 1 ? 1 : 0;
      if (row.gear > 1) d.gearRatio = row.gear;
      const pre = Object.assign(EP.engDefaults(), EP.PRESETS[seed.base]);
      if (pre.arch !== 'radial') d.liquid = row.cooling === 'liquid' ? 1 : 0;
    }
    if (kind === 'piston') {
      if (row.cs) d.cs = 1;
      const dr = C.GEN_DRIVE.eng[key];
      if (dr && dr.rpmMax > 0) d.rpmMax = dr.rpmMax;
    }
    // the resolve's own dict for these dials (what CAGE_ENG_FACTS resolves), then the walk
    const spec0 = window.CAGE_ENG_SPEC(panelAt(seed.base, d));
    const g = GEOM[kind], g0 = spec0[g];
    const res = (gv, bk, mk) => EG.engResolve(Object.assign({}, spec0, { [g]: gv, bmepK: bk, massK: mk }));
    let found = null;
    for (let n = 0; n <= 4000 && !found; n++) for (const sg of n ? [n, -n] : [0]) {
      const gv = nudge(g0, sg);
      const bk = solveExact(v => res(gv, v, 1).powerW, row.powerW, ...EG.ENG_DIAL_RANGE.bmepK);
      if (bk == null) continue;
      const mk = solveExact(v => res(gv, bk, v).mass, row.mass, ...EG.ENG_DIAL_RANGE.massK);
      if (mk == null) continue;
      found = { gv, bk, mk }; break;
    }
    if (!found) { console.log('  NO POINT for ' + key); fails++; continue; }
    if (found.gv !== spec0[g]) d[g] = found.gv;
    d.bmepK = found.bk; d.massK = found.mk;
    if (kind === 'turbine' && row.length > 0) {
      const s1 = Object.assign({}, spec0, { [g]: found.gv, bmepK: found.bk, massK: found.mk });
      d.tCanL = solveExact(v => EG.engResolve(Object.assign({}, s1, { tCanL: v })).env.length, row.length, ROWS.turbine.tCanL[2], ROWS.turbine.tCanL[3]);
      if (d.tCanL == null) { console.log('  NO LENGTH for ' + key); fails++; delete d.tCanL; }
    }
    out[key] = { base: seed.base, dials: d };
    console.log('  ' + key.padEnd(20) + JSON.stringify(d));
  }
  fs.writeFileSync(path.join(__dirname, 'engine_dial_points.json'), JSON.stringify(out, null, 1) + '\n');
  console.log('wrote tools/engine_dial_points.json: ' + Object.keys(out).length + ' points');
}
if (process.argv.includes('--emit')) { emit(); process.exit(fails ? 1 : 0); }

// ---- 1. every registry engine is a point on the dials -------------------------------------------------------------
console.log('1. EVERY REGISTRY ENGINE IS A POINT ON THE DIALS');
const keys = Object.keys(C.POWERPLANTS);
ok(keys.every(k => POINTS[k]), 'a point for each of the ' + keys.length + ' registry engines' +
   (keys.some(k => !POINTS[k]) ? ' - MISSING: ' + keys.filter(k => !POINTS[k]).join(', ') : ''));
const clampOne = cu => { const s = JSON.parse(JSON.stringify(C.GEN_DEFAULT)); s.engines = [{ type: 'a65_sensenich74', mount: 'nose', place: { dx: 0, dy: 0 }, custom: cu }];
                         return C.clampSpec(s); };
const driveOf = (spec, eng, key) => C.genDriveSpec({ params: { powerplant: key, engine: eng, prop: { D: 1.8 } }, spec });
for (const key of keys) {
  const pt = POINTS[key]; if (!pt) continue;
  const row = C.POWERPLANTS[key].engine, kind = kindOf(pt.base);
  const outOf = Object.entries(pt.dials).filter(([k, v]) => !inRow(kind, k, v)).map(([k, v]) => k + ' ' + v);
  const P = panelAt(pt.base, pt.dials);
  const F = FACTS(P);
  if (!F) { ok(false, key + ': the dials resolve to no custom engine'); continue; }
  const S = clampOne(JSON.parse(JSON.stringify(F))), cu = S.engines[0].custom;
  const bad = [];
  for (const f of FIELDS) {
    if (!Object.is(norm(F, f), norm(row, f))) bad.push(f + ' ' + norm(F, f) + ' vs ' + norm(row, f));
    if (!Object.is(norm(cu, f), norm(row, f))) bad.push('clamped ' + f + ' ' + norm(cu, f) + ' vs ' + norm(row, f));
  }
  // the drive through the core: the registry build against the custom one (the cylinders, the maximum, the torque)
  const dReg = driveOf({ engines: [{ type: key }], prop: {} }, row, key);
  const dCu = driveOf({ engines: [{ type: 'a65_sensenich74', custom: cu }], prop: {} }, cu, 'a65_sensenich74');
  for (const f of ['rated', 'rpmMax', 'gear', 'cyl', 'family', 'cs', 'powerW', 'Q', 'tqK', 'omegaR'])
    if (!Object.is(dReg[f], dCu[f])) bad.push('drive ' + f + ' ' + dCu[f] + ' vs ' + dReg[f]);
  ok(!outOf.length && !bad.length, key.padEnd(20) + ' <- ' + pt.base + ': ' +
     Object.entries(pt.dials).map(([k, v]) => k + ' ' + (typeof v === 'number' && !Number.isInteger(v) ? +v.toPrecision(6) : v)).join(', ') +
     (outOf.length ? '  OUT OF RANGE: ' + outOf.join(', ') : '') + (bad.length ? '  DIFFERS: ' + bad.join('; ') : '') +
     '  [cg aft ' + F.cgAft + ' m, price ' + Math.round(cu.price) + ' vs ' + C.POWERPLANTS[key].price + ']');
}

// ---- 2. every propeller official content flies is on the editor's rows --------------------------------------------
console.log('2. EVERY PROPELLER OFFICIAL CONTENT FLIES IS ON THE EDITOR\'S ROWS');
const cowl = id => (window.COWL_ROWS.find(g => g.rows.some(r => r.k === id)) || { rows: [] }).rows.find(r => r.k === id);
const rD = cowl('propD'), rN = cowl('bladeN'), PITCH = window.CAGE_PROP_PITCH;
const files = new Set();
for (const p of JSON.parse(fs.readFileSync(at('builds/lists/plane_lists.json'), 'utf8')).planes)
  if (p.list === 'official' || p.list === 'candidates') files.add(p.file);
for (const p of JSON.parse(fs.readFileSync(at('builds/candidates/index.json'), 'utf8')).planes) files.add('builds/candidates/' + p.file);
for (const k of Object.keys(C.CONTRACT_DESIGNS || {})) if (C.CONTRACT_DESIGNS[k].build) files.add(C.CONTRACT_DESIGNS[k].build);
for (const f of [...files].sort()) {
  let j; try { j = JSON.parse(fs.readFileSync(at(f), 'utf8')); } catch (e) { ok(false, f + ': unreadable'); continue; }
  const s = j.spec || j, pr = s.prop || {};
  const D = pr.D == null ? null : +pr.D, N = pr.blades == null ? 2 : +pr.blades, M = pr.material || 'wood';
  const why = [];
  if (D != null && !(D >= rD.lo && D <= rD.hi)) why.push('D ' + D + ' outside ' + rD.lo + '-' + rD.hi);
  if (!(N >= rN.lo && N <= rN.hi)) why.push('blades ' + N + ' outside ' + rN.lo + '-' + rN.hi);
  if (!JOIN.CAGE_JOIN_PROP_MATS.includes(M)) why.push('material ' + M + ' on no row');
  const pitch = pr.pitch || 'standard';
  if (!PITCH.KEYS.includes(pitch)) why.push('pitch ' + pitch + ' on no row');
  ok(!why.length, f + ': ' + (D == null ? 'D (the powerplant\'s)' : D + ' m') + ', ' + N + '-blade ' + M + ', ' + pitch + ' pitch' + (why.length ? '  ' + why.join('; ') : ''));
}
// THE PITCH ROW (ENGINE-DIALS B): every class the physics flies, the float kit's own order, and a move writes the spec
{
  const want = Object.keys(C.GEN_PROP_PITCH).concat(['auto']);
  ok(want.every(k => PITCH.KEYS.includes(k)) && PITCH.KEYS.every(k => want.includes(k)),
     'the pitch row offers exactly what the physics flies: ' + PITCH.KEYS.join(', ') + ' (GEN_PROP_PITCH + auto)');
  const kit = /const KIT_PITCHES = (\[[^\]]*\])/.exec(fs.readFileSync(at('tools/_cage_float.js'), 'utf8'));
  ok(kit && JSON.stringify(eval(kit[1])) === JSON.stringify(PITCH.KEYS), 'the float kit\'s pitch list is the row\'s, in its order');
  ok(/setPitch\(row\.pitch, P\)/.test(fs.readFileSync(at('tools/_cage_float.js'), 'utf8')), 'the float kit sets the pitch through the row\'s writer');
  const ups = []; const saveGS = window.GARAGE_SPEC;
  window.GARAGE_SPEC = { get: () => ({ prop: { pitch: 'standard' } }), update: u => ups.push(u) };
  const P = { propPitch: 2 }; PITCH.set(P, 'auto');
  setTimeout(() => {
    ok(P.propPitch === PITCH.KEYS.indexOf('auto') && ups.length === 1 && ups[0].prop.pitch === 'auto',
       'the row\'s writer moves the row and writes spec.prop.pitch (GARAGE_SPEC.update, the design tiles\' and the kit\'s call)');
    window.GARAGE_SPEC = saveGS;
    finish();
  }, 5);
}

// ---- 3. a custom engine inherits nothing from its fallback key ----------------------------------------------------
console.log('3. A CUSTOM ENGINE INHERITS NOTHING FROM ITS FALLBACK KEY');
const PROBE = ['rotax582_ivo', 'verner7u_wood', 'r1830_hs23e50', 'emrax268_carbon', 'pt6a114a_hartzell3'];
const SWAP = ['a65_sensenich74', 'rotax582_ivo', 'o540_hartzell', 'pt6a34_hartzell4', 'e811_velis'];
for (const key of PROBE) {
  const cu = FACTS(panelAt(POINTS[key].base, POINTS[key].dials));
  const look = type => {
    const s = JSON.parse(JSON.stringify(C.GEN_DEFAULT));
    s.engines = [{ type, mount: 'pusher', place: { dx: 0, dy: 0 }, custom: JSON.parse(JSON.stringify(cu)) }];
    s.prop = Object.assign({}, s.prop, { D: null });
    const R = C.resolveSpec(s).spec;
    const drv = C.genDriveSpec({ params: { powerplant: type, engine: R.pplant.engine, prop: R.prop }, spec: R });
    const { name, ...eng } = R.pplant.engine;
    return JSON.stringify({ eng, propD: R.prop.D, Tstatic: R.prop.Tstatic, xLE: R.wing ? R.wing.xLE : R.wings[0].xLE,
      drv: Object.assign({}, drv, { I: undefined }), tech: C.techKeysOfSpec(R),
      price: C.econPowerPrices(R) });
  };
  const ref = look(SWAP[0]);
  const differ = SWAP.slice(1).filter(t => look(t) !== ref);
  ok(!differ.length, key + ' as a custom engine on ' + SWAP.length + ' fallback keys: one engine, one propeller (D ' +
     JSON.parse(ref).propD + ' m), one drive (' + JSON.parse(ref).drv.cyl + ' cyl), one wing station, one tech stage, one price' +
     (differ.length ? '  DIFFERS on ' + differ.join(', ') : ''));
}

// ---- 4. the latent physics fields (ENGINE-DIALS C) -----------------------------------------------------------------
// gear.stiffness is a row (the mains' s1Stiff); gear.camber and the loft's crownTop / crownSide are FIXED CONSTANTS on a
// cage build (_cage_join.js CAGE_JOIN_FIXED: nothing the cage draws stands for them). Cowl fields are PROPER-COWLS'
// one cowl path's, not this gate's.
console.log('4. THE LATENT PHYSICS FIELDS: A ROW, OR A CONSTANT THE JOIN WRITES');
{
  const F = JOIN.CAGE_JOIN_FIXED, D = C.GEN_DEFAULT;
  ok(F.camber === D.gear.camber && F.crownTop === D.fuselage.crownTop && F.crownSide === D.fuselage.crownSide,
     'the join\'s constants are GEN_DEFAULT\'s: camber ' + F.camber + ', crownTop ' + F.crownTop + ', crownSide ' + F.crownSide);
  const js = (P) => JOIN.cageJoinSpec(Object.assign({ s1Leg: 1, s1_shockKind: 1 }, P), { gearType: 'taildragger', track: 1.8 }, { PRESET_NAMES: [] });
  const a = js({ s1Stiff: 1.7 }), b = js({});
  // (C2, 12 Nov: at the default the fields stay ABSENT - the physics reads GEN_DEFAULT's, held equal above - so the update
  // moves no certificate fingerprint: GATE BENCH's shipped Rufus; G3780 R3, "a game update is not a change to the aeroplane")
  ok(a.gear.stiffness === 1.7 && b.gear.stiffness === undefined && D.gear.stiffness === 1,
     'the mains\' stiffness row writes gear.stiffness off its default (1.7 -> 1.7); at 1 it stays absent, the physics\' 1');
  const fu = a.fuselage || {};
  ok(!('camber' in a.gear) && !('crownTop' in fu) && !('crownSide' in fu),
     'the join leaves the camber and the crown absent: the physics flies GEN_DEFAULT\'s, the constants');
  const rng = [0.35, 3.0];
  const bad = [];
  for (const f of [...files].sort()) {
    let j; try { j = JSON.parse(fs.readFileSync(at(f), 'utf8')); } catch (e) { continue; }
    const s = j.spec || j, g = s.gear || {}, fu = s.fuselage || {};
    const st = g.stiffness == null ? 1 : +g.stiffness;
    if (!(st >= rng[0] && st <= rng[1])) bad.push(f + ' stiffness ' + st);
    if ((+g.camber || 0) !== F.camber) bad.push(f + ' camber ' + g.camber);
    if (fu.crownTop != null && fu.crownTop !== F.crownTop) bad.push(f + ' crownTop ' + fu.crownTop);
    if (fu.crownSide != null && fu.crownSide !== F.crownSide) bad.push(f + ' crownSide ' + fu.crownSide);
  }
  // a file that flew a stiffness before the row (the DC-3-alike's 3) loads with the row at it (cageFromSpec)
  const CG = require(at('tools/_cage_gen.js'));
  const seeded = [...files].filter(f => { try { const j = JSON.parse(fs.readFileSync(at(f), 'utf8')), s = j.spec || j;
    return s.gear && s.gear.stiffness != null && +s.gear.stiffness !== 1; } catch (e) { return false; } });
  for (const f of seeded) {
    const s = JSON.parse(fs.readFileSync(at(f), 'utf8')); const sp = s.spec || s;
    const P = CG.cageFromSpec(sp);
    ok(+P.s1Stiff === +sp.gear.stiffness, f + ': its stiffness ' + sp.gear.stiffness + ' loads onto the row (s1Stiff ' + P.s1Stiff + ')');
  }
  ok(!bad.length, 'every official / candidate / validated build (' + files.size + ') carries a stiffness on the row and the constants' +
     (bad.length ? ' - ' + bad.join('; ') : ''));
}

function finish() {
  console.log('GATE ENGINEDIALS: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
  process.exit(fails ? 1 : 0);
}
