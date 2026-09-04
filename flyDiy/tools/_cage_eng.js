// CAGE ENGINE LAYER (G29, full surface G31) — the dressed engine
// (G24/G25's _eng_mesh.js) on the nose of the aeroplane.
//
// THE WHOLE BENCH PANEL IS HERE (G31, user: "too shabby" — the first cut
// exposed presets only). The parameter table is the bench's own
// (_eng_page.js GROUPS, one home, same labels and ranges); every row
// renders here with an `eng_` prefix, drops carry their VALUE tables (the
// cage stores indices, the spec gets values), and the group `show`
// predicates translate to `when`s over the effective architecture. A
// PRESET IS A STARTER, not a mode: selecting one writes its values into
// the rows ONCE (the seating-starter pattern) and everything stays
// editable after — "custom" is simply the state after you touch anything.
//
// THE GENUINE FIREWALL: the bench's plate family (fwOn, fwW/fwH, ruler,
// battery/ECU placement ON the plate) never draws here — the cage's own
// firewall is the plate. The engine is positioned so the bench's firewall
// STATION (zFw = zAft − mountGap·caseR) lands exactly on the cage's
// engine face, and — G31 — the plate DIMENSIONS handed to the builder ARE
// THE FACE'S, so the mount truss's spread, its backing pads and bolts,
// and the fuel/throttle service entries all land on the real firewall at
// its real size instead of a phantom 0.80 m plate's.
//
// THE PROP AND THE NOSE CONE ARE CHILDREN OF THE ENGINE (user ruling),
// rebased from the cowl frame onto the crank; the engine group rides the
// cowl's aperture axis so the same two offsets steer everything. NO AUTO
// COWL FITTING (user ruling): the cowl is shaped by hand around it.
//
// POLYCOUNT: the global density governor rides the polycount folder as
// `engine detail` (+ the screws LOD toggle); the five per-element side
// counts stay bench-only (user ruling, G29).
//
// Load after _eng_gen/_eng_mesh/_eng_page and after _cage_cowl; before
// _cage_ui. Chains PAGE.post.
'use strict';
(() => {

const PAGE = window.CAGE_PAGE || (window.CAGE_PAGE = {});
const EM = window.ENG_MESH, EP = window.ENG_PAGE,
      CW = window.COWL_GEN, CG2 = window.CAGE2;
if (!EM || !EP || !CW || !EP.GROUPS) {
  console.error('cage engine layer: _eng_mesh/_eng_page/_cowl_gen not loaded');
  return;
}

// ---- the parameter surface ------------------------------------------------
// bench keys that do NOT become rows here: the per-element polycounts
// (ruling), and the plate family (the genuine firewall owns it)
const SKIP = new Set(['quality', 'sideCyl', 'sideShaft', 'sideAcc',
                      'sidePipe', 'sideDetail', 'screws',
                      'fwOn', 'fwW', 'fwH', 'ruler']);
const ED = EP.engDefaults();
const VALS = {};                 // drop key -> value table (P stores index)
const defaults = { engOn: 1, engPreset: 0, engPower: 0,
                   engDetail: 0.8, eng_screws: ED.screws ? 1 : 0,
                   engY: 0, propOn: 1,
                   // THE MOUNT (2026-09-04): 0 nose, 1 pusher on the aft
                   // bulkhead, 2 over the wing (one engine, high wing, a pylon
                   // engPylonH tall), 3 a wing pair at engNacAt of the semispan
                   engMount: 0, engNacAt: 0.35, engPylonH: 0.30,
                   // THE BLOCK (2026-09-04, the user: "when mounted on the
                   // wing, we should be able to move the whole block holding
                   // the engine, not just the engine"): fore/aft and up/down
                   // of the mount FACE itself (pylon, nacelle, engine, prop
                   // move together); and which way a wing engine faces —
                   // 0 the mount's own (over the wing pushes, a pair pulls),
                   // 1 puller, 2 pusher
                   engBlockZ: 0, engBlockY: 0, engAim: 0 };
for (const [, rows] of EP.GROUPS)
  for (const r of rows) {
    const [k, , m3, opts] = r;
    if (SKIP.has(k)) continue;
    if (m3 === 'drop') {
      VALS[k] = opts.map(o => o[0]);
      const i = VALS[k].indexOf(ED[k]);
      defaults['eng_' + k] = i >= 0 ? i : 0;
    } else if (m3 === 'check') defaults['eng_' + k] = ED[k] ? 1 : 0;
    else defaults['eng_' + k] = ED[k];
  }
PAGE.defaults = Object.assign(defaults, PAGE.defaults || {});

// the effective architecture, for the group `show` predicates and the spec
const archOf = P => Math.round(P.engPower)
  ? 'electric'
  : (VALS.arch[Math.round(P.eng_arch)] || 'flat');

// ---- the dial dict, ONE KEEPER (G134) -------------------------------------
// Every panel row, values through the drop tables — the same dict the mesh
// build has always fed engMeshBuild, factored out so the JOIN can resolve
// the SAME engine the screen shows. Two callers, one mapping: a drift here
// was a drawn engine flying different numbers, which is the whole bug this
// arc exists to close.
const engSpecOfP = (P) => {
  const spec = EP.engDefaults();
  for (const [, rows] of EP.GROUPS)
    for (const r of rows) {
      const k = r[0];
      if (SKIP.has(k)) continue;
      const v = P['eng_' + k];
      if (v === undefined) continue;
      spec[k] = r[2] === 'drop'
        ? VALS[k][Math.max(0, Math.min(VALS[k].length - 1, Math.round(v)))]
        : (r[2] === 'check' ? (v ? 1 : 0) : v);
    }
  spec.arch = archOf(P);
  return spec;
};
// G154: published so the COWL can ask what engine it is wrapping. The cowl
// layer's post runs BEFORE this one, so it cannot wait to be told — it reads
// the spec itself and resolves the envelope. One description of what the
// engine is, not two.
window.CAGE_ENG_SPEC = engSpecOfP;

// THE PRESET'S OWN DIAL DICT — applyEngPreset's write, replayed onto a fresh
// default without touching P. Row-backed keys only, drops through the same
// VALS gate: a preset key with no panel row never reaches P, so it must not
// count as a deviation either, or an untouched preset would read "modified".
const presetSpecOf = (name) => {
  const pre = EP.PRESETS[name];
  if (!pre) return null;
  const base = Object.assign(EP.engDefaults(), pre);
  const spec = EP.engDefaults();
  for (const [, rows] of EP.GROUPS)
    for (const r of rows) {
      const k = r[0];
      if (SKIP.has(k) || base[k] === undefined) continue;
      if (r[2] === 'drop') {
        if (VALS[k].indexOf(base[k]) >= 0) spec[k] = base[k];
      } else if (r[2] === 'check') spec[k] = base[k] ? 1 : 0;
      else spec[k] = base[k];
    }
  spec.arch = base.arch === 'electric' ? 'electric'
    : (VALS.arch.indexOf(base.arch) >= 0 ? base.arch : spec.arch);
  return spec;
};
// the two presets with no registry row behind them — the join's own list
// (they used to fly the A-65's numbers as a DECLARED fallback; with facts
// they fly their own resolve instead, which retires that lie)
const ENG_FANTASY = new Set(['flat twin', 'flat six']);

// THE FLOWN FACTS (G134): engResolve over the current dials, mapped to the
// spec's custom-engine row — the bench readout and the flight model finally
// read the same dict. IDENTITY FOLLOWS THE FACTS (user ruling 2026-09-01,
// "no drift, and never call an engine wrongly"):
//   - dials whose RESOLVED facts equal the applied preset's own resolve ARE
//     that engine -> return null, the join keeps the registry row, and the
//     certified name flies its certified numbers. Dress dials (fins, rocker
//     covers, exhaust style) cannot move the facts, so redecorating a 912
//     does not rename it.
//   - any physics dial deviates -> the model's numbers fly, and the name
//     says so: "modified <registry name>" while the architecture and family
//     still match the preset, "custom <arch> ..." once they do not.
//   - the two fantasy presets always fly their own resolve, named custom.
// Returns null too when there is nothing honest to ship (layer off, bench
// absent, degenerate resolve) — the registry preset then flies as before.
// PRICE is deliberately absent: resolveSpec prices an unpriced custom row
// through genEnginePrice, so the market curve has one keeper (00_registry).
window.CAGE_ENG_FACTS = (P) => {
  if (!+P.engOn) return null;
  const EG = window.ENG_GEN;
  if (!EG || !EG.engResolve) return null;
  const spec = engSpecOfP(P);
  let R;
  try { R = EG.engResolve(spec); } catch (e) { return null; }
  if (!R || !(R.powerW > 0) || !(R.mass > 0)) return null;
  const elec = R.arch === 'electric';
  const facts = {
    mass: R.mass, powerW: R.powerW, rpm: R.rpm,
    torque: R.torque != null ? R.torque
      : R.powerW / (2 * Math.PI * Math.max(1, R.rpm) / 60),
    aspiration: elec ? 'electric' : 'na',
    family: elec ? 'electric' : (spec.twoStroke ? 'two' : 'four'),
    cooling: (!elec && spec.arch === 'radial') ? 'air'   // a radial coerces
      : (spec.liquid ? 'liquid' : 'air'),                // air-cooled (G28)
  };
  const psName = PRESET_NAMES[Math.max(0, Math.min(PRESET_NAMES.length - 1,
    Math.round(P.engPreset)))];
  const ps = presetSpecOf(psName);
  let R0 = null;
  if (ps) { try { R0 = EG.engResolve(ps); } catch (e) { R0 = null; } }
  const eq = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
  const isPreset = R0 && eq(R.mass, R0.mass) && eq(R.powerW, R0.powerW)
    && eq(R.rpm, R0.rpm) && R.arch === R0.arch
    && facts.family === (R0.arch === 'electric' ? 'electric'
                          : (ps.twoStroke ? 'two' : 'four'))
    && facts.cooling === ((R0.arch !== 'electric' && ps.arch === 'radial')
                          ? 'air' : (ps.liquid ? 'liquid' : 'air'));
  if (isPreset && !ENG_FANTASY.has(psName)) return null;
  // deviated (or fantasy): name the thing by what it now is
  const kW = R.powerW / 1000;
  const sameKind = R0 && R.arch === R0.arch && !ENG_FANTASY.has(psName)
    && facts.family === (R0.arch === 'electric' ? 'electric'
                          : (ps.twoStroke ? 'two' : 'four'));
  let regName = null;
  if (sameKind && typeof CAGE_JOIN_ENGINES !== 'undefined'
      && typeof POWERPLANTS !== 'undefined') {
    const row = POWERPLANTS[CAGE_JOIN_ENGINES[psName]];
    if (row) regName = row.engine.name;
  }
  facts.name = regName ? `modified ${regName}`
    : elec ? `custom ${R.archName} ${kW.toFixed(kW < 10 ? 1 : 0)} kW`
    : `custom ${R.archName} ${R.cyl}-cyl ${R.litres.toFixed(1)} L`;
  return facts;
};

// ---- panel ----------------------------------------------------------------
const PRESET_NAMES = Object.keys(EP.PRESETS).filter(n => n !== 'bare engine');
const rowNames = r => r.k === 'material' && CW.MATERIALS
  ? CW.MATERIALS.map(mm => mm.name) : r.names;
const LBL = { noseOff: 'fore / aft (base off the flange)' };
const grpItems = id => ((window.COWL_ROWS || []).find(g => g.id === id) ||
  { rows: [] }).rows
  .filter(r => CW.P[r.k] !== undefined && !DEAD_SPIN.has(r.k))
  .map(r => ['cw_' + r.k, LBL[r.k] || r.label, r.lo,
             r.k === 'material' && CW.MATERIALS ? CW.MATERIALS.length - 1
                                                : r.hi,
             r.step, rowNames(r)]);
const SPINPROP_KEYS = ['g_spin', 'g_prop'].flatMap(id =>
  ((window.COWL_ROWS || []).find(g => g.id === id) || { rows: [] })
    .rows.map(r => r.k));
// the tool's own shaft is RETIRED here (G32, user): the engine provides
// the crank and the flange — its rows go with it
const DEAD_SPIN = new Set(['shaftR', 'shaftLen']);

// bench groups -> cage subgroups, every row, same labels + ranges
const engRow = r => {
  const [k, label, m3, a, b, ] = r;
  if (m3 === 'drop')
    return ['eng_' + k, label, 0, Math.max(1, a.length - 1), 1,
            a.map(o => o[1])];
  if (m3 === 'check') return ['eng_' + k, label, 0, 1, 1];
  return ['eng_' + k, label, m3, a, b];
};
const BENCH_SUBS = [];
for (const g of EP.GROUPS) {
  const [name, rows, show] = g;
  if (name === 'polycount') continue;      // engDetail + screws live in
                                           // the page's own polycount folder
  const items = rows.filter(r => !SKIP.has(r[0])).map(engRow);
  if (!items.length) continue;
  let when = P => +P.engOn;
  if (show === EP.isElec) when = P => +P.engOn && archOf(P) === 'electric';
  else if (show === EP.isPiston)
    when = P => +P.engOn && archOf(P) !== 'electric';
  // the radiator only exists on a liquid engine, and a radial coerces
  // air-cooled (G28 audit discipline, applied to the import)
  if (name === 'radiator (liquid)')
    when = P => +P.engOn && archOf(P) !== 'electric' &&
                +P.eng_liquid && archOf(P) !== 'radial';
  BENCH_SUBS.push([name === 'engine' ? 'engine geometry' : name,
                   items, { when }]);
}

const ENG_ITEMS = [
  ['engOn',     'engine',        0, 1, 1],
  ['engPower',  'powertrain',    0, 1, 1, ['piston', 'electric'],
   { when: P => +P.engOn }],
  // A STARTER: writes the preset's values into the rows once — every
  // row below stays yours to edit after (the seating-starter pattern)
  ['engPreset', 'preset (applies once)', 0,
   Math.max(1, PRESET_NAMES.length - 1), 1, PRESET_NAMES,
   { when: P => +P.engOn }],
  ['engMount',  'mount', 0, 3, 1,
   ['nose', 'pusher (aft bulkhead)', 'over the wing (high wing)',
    'wing nacelles (twin)'], { when: P => +P.engOn }],
  ['engAim',    'faces', 0, 2, 1, ['as the mount', 'puller', 'pusher'],
   { when: P => +P.engOn && Math.round(P.engMount) >= 2 }],
  ['engNacAt',  'nacelle station (semispan)', 0.15, 0.70, 0.01,
   { when: P => +P.engOn && Math.round(P.engMount) === 3 }],
  ['engBlockZ', 'block fore / aft', -1.0, 1.0, 0.01,
   { when: P => +P.engOn && Math.round(P.engMount) >= 2, dim: 'm' }],
  ['engBlockY', 'block up / down', -0.6, 0.8, 0.01,
   { when: P => +P.engOn && Math.round(P.engMount) >= 2, dim: 'm' }],
  ['engPylonH', 'pylon height', 0.05, 1.0, 0.01,
   { when: P => +P.engOn && Math.round(P.engMount) === 2, dim: 'm' }],
  ['engY',      'up / down', -0.5, 0.5, 0.005,
   { when: P => +P.engOn, dim: 'm' }],
  ...BENCH_SUBS,
  ['propOn',    'propeller',     0, 1, 1, { when: P => +P.engOn }],
  ['nose cone', grpItems('g_spin'), { when: P => +P.engOn }],
  ['propeller', grpItems('g_prop'),
   { when: P => +P.engOn && +P.propOn }],
];
const host = (PAGE.groupsOverride || []).find(g => g[0] === '2 · engine');
if (host) host[1].push(...ENG_ITEMS);
else (PAGE.groupsOverride || (PAGE.groups = PAGE.groups || []))
  .push(['2c · engine', ENG_ITEMS]);
const poly = (PAGE.groupsOverride || []).find(g => g[0] === 'polycount');
if (poly) poly[1].push(
  ['engDetail', 'engine detail', 0.3, 2, 0.02, { when: P => +P.engOn }],
  ['eng_screws', 'engine screws', 0, 1, 1, { when: P => +P.engOn }]);

// ---- materials ------------------------------------------------------------
// AEROSKIN (G70). The engine bench's palette is its PARTS LIST — one colour
// per module material, so the legend and the model agree — and G25 dressed
// thirty of them. `AERO_HARD.eng` says what each one is made of; the colour
// on the row is still the colour. An engine is also the closest the camera
// ever gets to any surface here, which is why the cast finish is the one row
// in the table with the smallest tile.
const AKM = () => (typeof window !== 'undefined' && window.AEROSKIN) || null;
const matCache = {};
// WHICH ENGINE PARTS THE BUILDER PAINTS (G113.4). Everything else in
// AERO_HARD.eng stays hardware — a spark plug is chrome and a lead is rubber,
// and those are not choices. What IS a choice is the way an engine is
// finished: the crankcase and its castings in one colour, the cylinders in
// another, the rocker covers as the accent. Three groups, and every part in
// AERO_HARD.eng that is not named here keeps the material the table gives it.
const ENG_SEC = {
  emCase: 'engBlock', emRidge: 'engBlock', emSump: 'engBlock',
  emAcc: 'engBlock', emPad: 'engBlock',
  emBarrel: 'engJug', emFin: 'engJug', emHead: 'engJug',
  emRocker: 'engCover',
  // G156: the braces. `emPuck` stays out — a rubber mount puck is rubber for
  // what it does, and `emFirewall` is the airframe's, not the engine's.
  emMount: 'engMount',
};
const matOf = name => {
  const A = AKM();
  // the livery section first, exactly as the propeller does it: AERO_HARD
  // still decides what the part IS (its bottom-out finish), and the section
  // adds the builder's own finish, tint and dials on top.
  const sec = ENG_SEC[name];
  if (sec && typeof window !== 'undefined' && window.CAGE_SECMAT) {
    const m = window.CAGE_SECMAT(sec, {
      fin: A && A.aeroHardFinish && A.aeroHardFinish('eng', name),
      tint0: EP.COL[name] || EP.NEUTRAL,
      surf: 0, fieldM: 1, side: THREE.DoubleSide });
    if (m) return m;
  }
  if (A && A.aeroHardMat) {
    const m = A.aeroHardMat(THREE, 'eng', name,
      new THREE.Color(EP.COL[name] || EP.NEUTRAL).getHex(),
      { side: THREE.DoubleSide });
    if (m) return m;
  }
  if (!matCache[name]) {
    const [met, rgh] = EP.PROPS[name] || [0.55, 0.5];
    matCache[name] = new THREE.MeshStandardMaterial({
      color: new THREE.Color(EP.COL[name] || EP.NEUTRAL),
      metalness: met, roughness: rgh, side: THREE.DoubleSide });
  }
  return matCache[name];
};
const propM = new THREE.MeshStandardMaterial({
  color: 0xc79a63, metalness: 0.0, roughness: 0.62,
  side: THREE.DoubleSide });
// THE PROPELLER'S MATERIAL IS A CHOICE, not a name — the cowl bench's own
// MATERIALS table, whose index also drives the blade's DENSITY — so it maps
// by index (AERO_PROP_FIN). A laminated wooden blade and a carbon one differ
// in more than colour, and this is where that finally shows.
const propMat = (sec) => {
  const i = Math.max(0, Math.min(CW.MATERIALS.length - 1,
    Math.round(CW.P.material)));
  const M = CW.MATERIALS[i];
  const A = AKM();
  // the livery section (phase C): cw_material keeps deciding what the blade
  // IS (its finish AND its density); the section adds the builder's tint and
  // dials on top. The spinner is its own section FOLLOWING the propeller, so
  // by default it wears the blade's material exactly as it always did.
  // G125.1: the row's own tile scale and grain turn ride along — a laminated
  // blade shows its glue lines at BLADE pitch, running SPANWISE. tileK0
  // composes under the builder's dial in secMat; the fallback multiplies the
  // same number in directly.
  if (typeof window !== 'undefined' && window.CAGE_SECMAT) {
    const m = window.CAGE_SECMAT(sec || 'prop',
      { fin: A && A.AERO_PROP_FIN[i], tint0: M.col,
        surf: 0, fieldM: 1, side: THREE.DoubleSide,
        tileK0: M.tileK, detRot: M.detRot });
    if (m) return m;
  }
  if (A && A.aeroHardOn && A.aeroHardOn() && A.AERO_PROP_FIN[i])
    return A.aeroMaterial(THREE, { finish: A.AERO_PROP_FIN[i], tint: M.col,
      surf: 0, fieldM: 1, side: THREE.DoubleSide,
      tileK: M.tileK, detRot: M.detRot });
  propM.color.setHex(M.col); propM.metalness = M.met; propM.roughness = M.rgh;
  return propM;
};
function meshFrom(m) {
  const pos = new Float32Array(m.V.length * 3);
  m.V.forEach((p, i) => { pos[i*3] = p[0]; pos[i*3+1] = p[1]; pos[i*3+2] = p[2]; });
  const byMat = new Map();
  m.F.forEach(f => {
    if (!byMat.has(f.m)) byMat.set(f.m, []);
    const t = byMat.get(f.m);
    t.push(f.v[0], f.v[1], f.v[2], f.v[0], f.v[2], f.v[3]);
  });
  const idx = [], mats = [], groups = [];
  for (const [name, tris] of byMat) {
    groups.push([idx.length, tris.length, mats.length]);
    for (const i of tris) idx.push(i);
    mats.push(name);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  for (const [start, count, mi] of groups) g.addGroup(start, count, mi);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, mats.map(matOf));
  // THE EXHAUST EXIT, MEASURED (G70). The wear needs a source for the soot
  // streak, and the only honest one is where the pipe actually ends — which
  // moves with the cylinder count, the architecture and every slider on the
  // engine panel. So it is read off the pipes' own triangles rather than
  // declared: aft-most first (the cage builds z-forward, so aft is -z), and
  // the lowest vertex among those within 30 mm of it, because a tailpipe
  // exits down as well as back.
  const et = byMat.get('emExhaust');
  if (et && et.length) {
    let zm = Infinity;
    for (const vi of et) zm = Math.min(zm, m.V[vi][2]);
    let best = null;
    for (const vi of et) {
      const p = m.V[vi];
      if (p[2] > zm + 0.03) continue;
      if (!best || p[1] < best[1]) best = p;
    }
    if (best) mesh.userData.exhaustExit = best.slice();
  }
  return mesh;
}

// ---- the build ------------------------------------------------------------
let group = null;
// THE ONE-SHOT STARTER, as a pure step: "has the preset ROW changed since I
// last looked?" — the first look records, a change fires, and nothing else
// does. Published for GATE STARTER (tools/_starter_check.js), which drives it
// without a scene.
//
// A LOAD IS NOT A ROW CHANGE (2026-09-03). This used to compare against the
// previous BUILD's value, and a loaded build replaces P wholesale — so a file
// naming a different preset than the aeroplane you had open re-fired the
// starter, and the preset's ~40 engine rows overwrote the seven the file had
// actually saved (the user's jodel: mount gap 1.52 -> 0.85, firewall spread
// 2.07 -> 1.50, the exhaust style and its outlet, all gone on load — and
// order-dependent, since loading the same file twice was fine). `PAGE.load`
// is the editor saying "P was replaced, not edited": forget the memory, so
// the next build records the loaded value instead of reacting to it.
let lastPreset = null;           // the one-shot starter's memory
function engPresetStarter(P) {
  const psel = Math.round(P.engPreset);
  if (lastPreset === null) { lastPreset = psel; return null; }
  if (psel === lastPreset) return null;
  lastPreset = psel;
  return PRESET_NAMES[psel] || null;
}
const prevLoad = PAGE.load;
PAGE.load = () => { if (prevLoad) prevLoad(); lastPreset = null; };
if (typeof window !== 'undefined') window.CAGE_ENG_STARTER = engPresetStarter;
const dispose = o => {
  if (!o) return;
  o.traverse(c => { if (c.geometry) c.geometry.dispose(); });
  if (o.parent) o.parent.remove(o);
};

// write a preset's values into the eng_ rows (drops become indices)
function applyEngPreset(P, name) {
  const pre = EP.PRESETS[name];
  if (!pre) return;
  const base = Object.assign(EP.engDefaults(), pre);
  P.engPower = base.arch === 'electric' ? 1 : 0;
  for (const [, rows] of EP.GROUPS)
    for (const r of rows) {
      const k = r[0];
      if (SKIP.has(k) || base[k] === undefined) continue;
      if (r[2] === 'drop') {
        const i = VALS[k].indexOf(base[k]);
        if (i >= 0) P['eng_' + k] = i;
      } else if (r[2] === 'check') P['eng_' + k] = base[k] ? 1 : 0;
      else P['eng_' + k] = base[k];
    }
  P.eng_screws = base.screws ? 1 : 0;
}
// THE ONE EXPORT of that mapping (2026-08-31): the birth flow bakes a
// preset's values into a FRESH cage before cageToSpec (design_flow.js), and
// GATE ARCHETYPES does the same headless — both through this exact function,
// so the tile, the row and the gate cannot apply three different engines.
if (typeof window !== 'undefined') window.CAGE_ENG_APPLY_PRESET = applyEngPreset;

const prevPost = PAGE.post;
PAGE.post = ctx => {
  if (prevPost) prevPost(ctx);
  const { scene, mesh, P, stat } = ctx;
  dispose(group); group = null;
  if (!P.engOn) return;

  // the preset starter fires exactly when the ROW changes — never on a load
  const fire = engPresetStarter(P);
  if (fire) {
    applyEngPreset(P, fire);
    const UI = window.CAGE_UI;
    if (UI && UI.syncSliders) UI.syncSliders();
  }

  const FS = (CG2 && CG2.CAGE_UNIT || 1) * (P.planeScale || 1);
  // THE FACES (2026-09-04): one per engine, from the cowl layer's own
  // description (nose / aft bulkhead / a pylon over the wing / a nacelle a
  // side). None = say why, draw nothing.
  const NF = window.CAGE_NOSE;
  const mountK = Math.round(P.engMount || 0);
  const units = NF && NF.engineFaces ? NF.engineFaces(mesh, FS, P) : [];
  if (!units.length) {
    if (stat) stat.textContent += '  ·  engine: ' +
      (mountK === 1 ? (P.boomStyle ? 'no aft bulkhead face' : 'a pusher needs a rod boom (the pod ends at the aft bulkhead)')
     : mountK === 2 ? (Math.round(P.wgPos || 0) === 0 ? 'no wing to sit on' : 'the over-the-wing mount needs a HIGH wing')
     : mountK === 3 ? 'no wing to hang the nacelles on'
     : 'no engine face on this body');
    return;
  }
  const face = units[0].face;

  // spec: the shared dial dict (engSpecOfP — the join resolves the same
  // one, G134); the plate the builder computes against IS the cage's face
  // (G31 — the mount spread, backing pads and service entries land on the
  // real firewall)
  const spec = engSpecOfP(P);
  spec.quality = Math.max(0.3, P.engDetail || 0.8);
  spec.screws = P.eng_screws ? 1 : 0;
  // the genuine firewall is the cage's — off the body (a pylon, a nacelle)
  // the engine draws its own mount plate
  spec.fwOn = face.synthetic ? 1 : 0;
  spec.fwW = Math.max(0.2, Math.min(2.2, 2 * face.halfW));
  spec.fwH = Math.max(0.2, Math.min(2.2, 2 * face.halfH));
  let M;
  try { M = EM.engMeshBuild(spec); }
  catch (e) {
    if (stat) stat.textContent += '  ·  engine: ' + e.message;
    return;
  }
  const R = M.resolved;
  const Pm = Object.assign({}, EM.ENGM_DEFAULT, R.P);
  const cR = R.place.caseR != null ? R.place.caseR : R.place.canR;
  const zFw = R.place.zAft - Pm.mountGap * cR;

  group = new THREE.Group();
  // NAMED for the editor (G76/G77): the part table says which layer a
  // part lives in, and G79's raycast resolves a hit to a part through
  // that. One string, no behaviour.
  group.name = 'cageLayer:eng';

  // spinner + blades — the cowl tool's geometry, on the crank. NO SHAFT
  // (G32, user): the engine provides the crank and the flange, so the
  // tool's own aft shaft is not drawn — the cone is built here from the
  // tool's own profile (spinProfile / spinR / spinLen), base on the
  // flange plus the noseOff dial.
  for (const k of SPINPROP_KEYS)
    if (P['cw_' + k] !== undefined && CW.P[k] !== undefined)
      CW.P[k] = P['cw_' + k];
  const ax = CW.axisXY();
  const nOff = CW.P.noseOff || 0;
  // ONE ENGINE PER FACE (2026-09-04). The same engine mesh, spinner and
  // blades per unit; an AFT unit is turned round (its +z, the crank, points
  // backwards) so the firewall plate stays on the face and the propeller
  // runs behind it. Group k > 0 names its spinner/prop with a '#k' suffix so
  // the join can spin each one about its own hub.
  const unitOut = [];
  const spinGeo = (() => {
    const d2 = Math.max(0.35, Math.min(2, CW.P.detail || 1));
    const NS = Math.max(10, Math.round(16 * d2));
    const SA = Math.max(20, Math.round(40 * d2));
    const pos = [], idx = [];
    for (let i = 0; i < NS; i++) {
      const u = i / (NS - 1);
      const r2 = CW.P.spinR * CW.spinProfile(u), z2 = u * CW.P.spinLen;
      for (let j = 0; j < SA; j++) {
        const th = j / SA * Math.PI * 2;
        pos.push(Math.cos(th) * r2, Math.sin(th) * r2, z2);
      }
    }
    for (let i = 0; i < NS - 1; i++)
      for (let j = 0; j < SA; j++) {
        const j2 = (j + 1) % SA;
        idx.push(i * SA + j, i * SA + j2, (i + 1) * SA + j2,
                 i * SA + j, (i + 1) * SA + j2, (i + 1) * SA + j);
      }
    const base = pos.length / 3;
    pos.push(0, 0, 0);                       // base cap fan
    for (let j = 0; j < SA; j++) {
      const j2 = (j + 1) % SA;
      idx.push(base, j2, j);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',
      new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  })();
  const propInfo = P.propOn ? CW.propGeometry() : null;
  const ex = Math.max(0, P.explodeD || 0) * FS;
  units.forEach((u, k) => {
    const f = u.face, sfx = k ? '#' + k : '';
    const ug = new THREE.Group();
    // G179.2: NAMED at the source, so the join makes the whole unit ONE
    // part that rides its own engine node — it used to be skin, and the
    // wing-box selector cut it in two on a wing mount (the user: "the
    // engine block and prop seem to be attached to the body, while the
    // support is attached to the wing nacelle structure")
    ug.name = 'edEng' + sfx;
    const engMesh = meshFrom(M);
    ug.add(engMesh);
    const ng = new THREE.Group();
    ng.add(new THREE.Mesh(spinGeo, propMat('spinner')));
    ng.position.set(0, 0, nOff);             // cone base -> flange + dial
    // G55: NAMED for the join's snapshot (G47.2's prescription) — the parts
    // that turn with the propeller carry their identity at the source
    ng.name = 'edSpinner' + sfx;
    ug.add(ng);
    let pg = null;
    if (P.propOn) {
      pg = new THREE.Group();
      pg.name = 'edProp' + sfx;
      // the blade plane rides the cone exactly as the tool placed it
      pg.position.set(0, 0, nOff + CW.P.spinLen *
        Math.max(0.02, Math.min(0.95, CW.P.bladeStation)));
      const pm = propMat();
      for (let b0 = 0; b0 < Math.round(CW.P.bladeN); b0++) {
        const b = new THREE.Group();
        b.add(new THREE.Mesh(propInfo.geom, pm));
        b.add(new THREE.Mesh(propInfo.root, pm));
        b.add(new THREE.Mesh(propInfo.tip, pm));
        b.rotation.z = b0 / Math.round(CW.P.bladeN) * Math.PI * 2;
        pg.add(b);
      }
      ug.add(pg);
    }
    // ON THE THRUSTLINE, BOLTED TO THE FACE — plus the mount's own up/down
    // (G32). An aft unit's firewall plane lands on the face from behind.
    if (u.aft) ug.rotation.y = Math.PI;
    ug.position.set((f.x || 0) + (u.aft ? -ax.x : ax.x),
                    f.yc + ax.y + (P.engY || 0),
                    u.aft ? f.z + zFw : f.z - zFw);
    if (ex > 0) {
      ng.position.z += ex * 1.5;
      if (pg) pg.position.z += ex * 2.0;
    }
    group.add(ug);
    // THE PYLON (the over-the-wing mount): one tapered post from the upper
    // skin to the mount plate, in the mount's own material
    if (u.kind === 'wingTop' && f.yBase != null) {
      const h = Math.max(0.02, f.yc - f.halfH - f.yBase + 0.02);
      const pl = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, h, Math.max(0.25, 0.42 * (f.chord || 1))),
        matOf('emMount'));
      pl.position.set(f.x || 0, f.yBase + h / 2, f.z + 0.05);
      group.add(pl);
    }
    // THE EXHAUST EXIT IN THE SCENE'S OWN FRAME (G70). The mesh measured it in
    // the engine's local frame; the group has just been placed on the thrust
    // line, so one localToWorld puts it in the same metric frame the gear
    // publishes its contacts in — which is what lets the wear ask the CAGE
    // where that point is on its skin.
    let exhaustAt = null;
    if (engMesh.userData.exhaustExit) {
      ug.updateMatrixWorld(true);
      const v = new THREE.Vector3().fromArray(engMesh.userData.exhaustExit);
      engMesh.localToWorld(v);
      exhaustAt = [v.x, v.y, v.z];
    }
    unitOut.push({ kind: u.kind, aft: !!u.aft, exhaustAt,
                   at: [ug.position.x, ug.position.y, ug.position.z] });
  });
  scene.add(group);
  const exhaustAt = unitOut[0].exhaustAt;

  window.CAGE_ENG = { name: PRESET_NAMES[Math.round(P.engPreset)],
                      resolved: R, zFw, exhaustAt,
                      mount: ['nose', 'pusher', 'wingTop', 'wing'][mountK] || 'nose',
                      units: unitOut,
                      spec, quads: M.stats && M.stats.quads };
  if (stat) {
    const head = R.arch === 'electric'
      ? (R.powerW / 1000).toFixed(1) + ' kW cont'
      : R.litres.toFixed(2) + ' L · ' + (R.powerW / 1000).toFixed(0) + ' kW';
    stat.textContent += '  ·  engine: ' + R.archName +
      (R.cyl ? ' ' + R.cyl : '') + ' · ' + head + ' · ' +
      R.mass.toFixed(0) + ' kg';
  }
};
})();
