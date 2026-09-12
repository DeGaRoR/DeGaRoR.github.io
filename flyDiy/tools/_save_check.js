#!/usr/bin/env node
// GATE SAVE — WHAT YOU SAVE IS WHAT IS ON THE STAND.
//
//   node tools/_save_check.js            -> "GATE SAVE: PASS|FAIL"
//   node tools/_save_check.js --selftest -> negative verification
//
// The shelf's `spec` is a CACHE OF THE EDITOR, and until 2026-09-03 nothing
// refreshed it when you edited. It was written by four things — a LOAD, a
// ROLL-OUT, the boot seed and a bench test, each a call to app.js's syncBuild
// — and moving a slider was not one of them. So SAVE, EXPORT and the WIP
// autosave all wrote down the aeroplane as it was at the last roll-out.
//
// Measured on a stock jodel before the fix: twelve rows moved across the cowl,
// wing, tail and cabin, NONE of them in the spec at save time, fifteen rows
// silently reverted by save -> load. The cowl was the worst hit, because
// polishing one is twenty slider-minutes during which nobody presses roll out.
// (The user: "despite having pressed save then load and export, it has changed
// a lot... the cowl takes a lot of polishing, so it's very frustrating.")
//
// GATE BUILD already gates the FORMAT — envelope/unwrap, the derived nulls,
// cageToSpec/cageFromSpec as an identity. None of that was broken, and none of
// it could see this: every one of its round trips starts from a spec, and the
// bug lived in the step BEFORE a spec exists. So this gate drives the shelf's
// own doors with a live editor behind them, which is the only place the
// question "did my edit reach the file" can be asked.
//
// WHAT IT GUARDS:
//   ROUND TRIP  edit -> save -> load returns every edited row, across every
//               layer. Fifteen keys, one or more per layer, each set to a
//               value that differs from the template AND from the page
//               defaults — so "it round-tripped" cannot be impersonated by
//               "nothing was set".
//   THE FILE    the bytes the slot holds, and the bytes EXPORT writes, carry
//               those rows. A save that round-trips through a live closure
//               but writes a stale file is the same bug one layer down.
//   THE WIP     the autosave carries them too — a reload must not lose the
//               polish, which is this bug wearing the WIP's clothes.
//   THE DOORS   every door that PERSISTS the build calls `commit()` first.
//
// NEGATIVE-VERIFIED (G3.2): --selftest boots a SABOTAGED copy of garage.js
// with the `commit()` calls stripped — the bug exactly as it was — and
// requires every round-trip check to go red. A check that cannot fail is not
// a check.
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const C = require('./flight_core.js');
const CAGE2 = require('./_cage_gen.js');
const { GEN_DEFAULT, GEN_SPEC_V, genNormaliseSpec } = C;

const GARAGE_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'viewer', 'garage.js'), 'utf8');

let fails = 0;
const ok = (cond, label) => {
  console.log((cond ? '  ok     ' : '  FAIL   ') + label);
  if (!cond) fails++;
  return !!cond;
};
const clone = o => JSON.parse(JSON.stringify(o));

// ---------------------------------------------------------------------------
// THE PANEL, HEADLESS — the same shim GATE PARTS and GATE STARTER use. Not
// just _cage_page5.js: the engine, wing, gear, fin, stab, crew, light and
// cowl rows are declared by their own LAYER files and merged into
// `CAGE_PAGE.defaults` at load, and since G106 that merged object is THE
// DEFAULT AEROPLANE — the baseline `cageToSpec` measures every layer key
// against. Loading page5 alone would leave the engine and wing keys out of
// that baseline, so they would ride through unconditionally and the gate
// would pass them without ever asking the question.
// ---------------------------------------------------------------------------
function loadPanel() {
  const CORE = require(path.join(__dirname, 'flight_core.js'));
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
    '_strut_gen.js', '_boom_gen.js', '_cage_wing.js', '_cage_brace.js', '_fin_gen.js', '_cage_fin.js',
    '_cage_stab.js', '_cage_access.js', '_cage_light.js'])
    require(path.join(__dirname, f));
  return global.window.CAGE_PAGE;
}
const CAGE_PAGE = loadPanel();

// ---------------------------------------------------------------------------
// THE EDITS. One or more per layer, so a loss anywhere shows — the layers are
// where the bug bit hardest, because `cageToSpec` compares a layer key against
// the page's default aeroplane and the cowl's rows are all layer keys.
//
// Every value differs from the template AND from the page defaults. The gate
// asserts that below rather than trusting the list: a "changed" value that
// happens to equal the default is a test that passes on a broken build.
// ---------------------------------------------------------------------------
const EDITS = {
  planeScale: 0.803,                          // build
  halfW: 0.6135, waistY: -0.137,              // the cage itself
  cw_cowlLen: 0.613, cw_apW: 0.331, cw_apMode: 0,   // cowl  <- the reported one
  eng_mountGap: 1.37, eng_exDrop: 1.81,       // engine
  wgSpan: 9.43, wgChord: 1.553,               // wing
  w2On: 1, w2Span: 8.7, w2Stagger: 0.21,      // the second plane (G185)
  bpInterAt: 0.55, li_plane: 1,               // its truss, its lamp bay
  s1Z: 1.913, s1Drop: 0.517,                  // gear
  finTipY: -0.301,                            // fin
  stTipZ: -0.183,                             // stab
  seatRake: 28.5,                             // crew
};
const BASE = Object.assign(CAGE2.cageDefaults(), CAGE_PAGE.defaults || {});
{
  const same = Object.keys(EDITS).filter(k => BASE[k] === EDITS[k]);
  ok(same.length === 0,
     'every edited row really differs from the default aeroplane' +
     (same.length ? ' (' + same.join(', ') + ' do not)' : ''));
  const unknown = Object.keys(EDITS).filter(k => !(k in BASE));
  ok(unknown.length === 0,
     'every edited row is a real parameter' +
     (unknown.length ? ' (' + unknown.join(', ') + ' are not)' : ''));
  ok(Object.keys(EDITS).length >= 12,
     `enough rows to be a real integrity test (${Object.keys(EDITS).length})`);
}

// ---------------------------------------------------------------------------
// THE SHELF, RUNNING FOR REAL, with a LIVE EDITOR behind it. Minimal DOM, a
// localStorage that behaves like one, and a CAGE_UI whose applySpec/toSpec are
// the real conversions over a real parameter set — which is what makes "the
// editor moved on and the spec did not" expressible at all.
// ---------------------------------------------------------------------------
function mkEl() {
  const e = { style: {}, value: '', disabled: false, textContent: '',
              innerHTML: '', children: [], files: null, hidden: false,
              addEventListener(k, f) { (this.on || (this.on = {}))[k] = f; },
              appendChild(c) { this.children.push(c); return c; },
              querySelector: () => mkEl(), querySelectorAll: () => [],
              remove() {}, click() {} };
  return e;
}
function mkStore() {
  const m = new Map();
  return { get length() { return m.size; },
           key: i => Array.from(m.keys())[i],
           getItem: k => (m.has(k) ? m.get(k) : null),
           setItem: (k, v) => { m.set(k, String(v)); },
           removeItem: k => { m.delete(k); }, _map: m };
}

function mkShelf(src) {
  const els = {}, store = mkStore();
  // THE EDITOR. `P` is the live parameter set a slider moves; applySpec and
  // toSpec are the real conversions, so the only thing stubbed is the panel.
  const P = Object.assign(CAGE2.cageDefaults(), CAGE_PAGE.defaults || {});
  const CAGE_UI = {
    P,
    applySpec(spec) {
      const got = CAGE2.cageFromSpec(spec);
      for (const k of Object.keys(P)) delete P[k];
      Object.assign(P, got);
    },
    toSpec: () => CAGE2.cageToSpec(P),
  };
  // THE JOIN, as far as this gate is concerned: the editor's parameters as a
  // spec fragment. The real one measures a wing and a tail out of the mesh
  // (GATE JOIN owns that); what matters here is the SHAPE of what it hands
  // over — a DEVIATIONS set (`cage`) and PLAIN DERIVED VALUES beside it, both
  // from one read of one P.
  //
  // `cabin.seating` is the real join's own rule, copied because it is the
  // field that exposed the bug: a plain value is always current, a
  // deviations set deep-merged is not, so the two drift apart and the file
  // ends up describing two different aeroplanes at once. The user's build
  // carried exactly that — `cage.seatLayout` 2 beside `cabin.seating`
  // 'side2' — and family E below is the invariant that says it cannot.
  const CAGE_JOIN = { export: () => ({
    cage: CAGE2.cageToSpec(P),
    cabin: { seating: Math.round(P.seatLayout) === 1 ? 'side2' : 'tandem2' },
  }) };
  let lastBlob = null, applied = null;
  const gbox = {
    console,
    document: { getElementById: id => (els[id] || (els[id] = mkEl())),
                createElement: () => mkEl(), body: mkEl() },
    alert: msg => { throw new Error('unexpected alert: ' + msg); },
    prompt: () => 'named build',
    Blob: function (parts) { lastBlob = String((parts && parts[0]) || ''); },
    URL: { createObjectURL: () => '', revokeObjectURL() {} },
    setTimeout: fn => { if (typeof fn === 'function') fn(); return 0; },
    clearTimeout: () => {},
    GEN_SPEC_V, genNormaliseSpec,
  };
  gbox.window = { localStorage: store, CAGE2, CAGE_PAGE, CAGE_UI, CAGE_JOIN };
  vm.createContext(gbox);
  vm.runInContext(src, gbox, { filename: 'garage.js' });
  gbox.garageInit({
    defaults: () => clone(GEN_DEFAULT),
    apply(s) { applied = s; },
    resolved: () => null, isGen: () => true, inGarage: () => true,
  });
  return { S: gbox.window.GARAGE_SPEC, P, store,
           blob: () => lastBlob, applied: () => applied };
}

// ---------------------------------------------------------------------------
// EVERY SINGLE SLIDER (the user, 2026-09-03, having lost a build: "let's write
// the gate, and have a special one with every single slider moved").
//
// The targeted list above is fifteen rows chosen by hand, and a hand-chosen
// list is only ever as good as the hand. This is the whole panel: every key
// `_cage_ui.js` renders a row for, walked out of the row tables themselves so
// a slider added to a layer joins the test by existing. Each is moved to a
// legal value on its OWN declared grid — inside [lo, hi], on the step, and
// never equal to where it already was.
//
// ...AND EVERY SINGLE SLIDER PUT BACK. The moving half would have passed all
// through the bug that actually cost the build: `spec.cage` is a DEVIATIONS
// set, so a row returning to its default is said by the key's ABSENCE, and a
// deep merge cannot hear silence. Moving rows away was always saved; putting
// one back was unsayable, and the old value stood for ever. So the second
// family is the first one in reverse, and it is the one with teeth.
// ---------------------------------------------------------------------------
function panelRows(groups) {
  const out = [];
  const walk = items => {
    for (const it of items) {
      if (Array.isArray(it[1])) { walk(it[1]); continue; }
      out.push(it);
    }
  };
  for (const g of groups) walk(g[1]);
  return out;
}
// key -> the row that declares its range. A key can carry two rows (the engine
// page renders `eng_rpm` twice, deliberately); either declares the same range.
const ROWS = new Map();
for (const r of panelRows(CAGE_PAGE.groupsOverride || []))
  if (!ROWS.has(r[0])) ROWS.set(r[0], r);

// a legal value for this row that is NOT `cur`: inside the declared range, on
// the declared step. Returns null for a row this gate cannot move honestly —
// a zero-width range, or one whose bounds are not numbers.
function altValue(row, cur) {
  const lo = row[2], hi = row[3];
  if (typeof lo !== 'number' || typeof hi !== 'number' || !(hi > lo)) return null;
  const st = (typeof row[4] === 'number' && row[4] > 0) ? row[4] : (hi - lo) / 100;
  const n = Math.floor((hi - lo) / st + 1e-9);
  if (n < 1) return null;
  const at = i => +(lo + Math.max(0, Math.min(n, i)) * st).toFixed(6);
  let v = at(Math.round(n * 0.37));
  if (typeof cur === 'number' && Math.abs(v - cur) < st / 2) v = at(Math.round(n * 0.37) + 1);
  if (typeof cur === 'number' && Math.abs(v - cur) < st / 2) v = at(Math.round(n * 0.37) - 1);
  return (typeof cur === 'number' && Math.abs(v - cur) < st / 2) ? null : v;
}

const MOVABLE = [];                       // [key, movedValue]
for (const [k, row] of ROWS) {
  if (!(k in BASE)) continue;             // a row with no parameter behind it
  if (k in CAGE2.CAGE_VIEW_KEYS) continue; // how you LOOK at it is not the build
  const v = altValue(row, BASE[k]);
  if (v !== null) MOVABLE.push([k, v]);
}
ok(MOVABLE.length > 300,
   `the whole panel is under test (${MOVABLE.length} rows of ${ROWS.size})`);

// the file that DESCRIBES the default aeroplane — what "every row home" must
// come back to, computed by the same converter rather than asserted as {}
const HOME = CAGE2.cageToSpec(Object.assign(CAGE2.cageDefaults(),
                                            CAGE_PAGE.defaults || {})) || {};

// ---------------------------------------------------------------------------
// THE RUN. Load a design, EDIT (as a slider does — straight into the editor's
// P, which is exactly what the stale-spec bug could not see), then save,
// export and load. Every check reports through `report` so the selftest can
// count reds on a sabotaged shelf.
// ---------------------------------------------------------------------------
function run(src, tag, report) {
  const H = mkShelf(src);
  // returns the CONDITION, never the reporter's answer: the selftest's
  // reporter is a counter and returns nothing, and a `say` that handed that
  // back made the first guarded check read as a failure and stop the run —
  // the sabotaged shelf then reported one red instead of five.
  const say = (cond, label) => {
    report(cond, tag ? tag + label : label);
    return !!cond;
  };
  if (!H.S) return say(false, 'the shelf published window.GARAGE_SPEC');
  const cageOf = txt => (txt ? ((JSON.parse(txt).spec || {}).cage || {}) : {});
  const slot = n => H.store.getItem('flydiy.build.' + n);

  // =======================================================================
  // A. THE TARGETED SET — fifteen rows, one or more per layer
  // =======================================================================
  H.S.set(clone(GEN_DEFAULT));
  Object.assign(H.P, EDITS);

  H.S.save('integrity');
  if (!say(!!slot('integrity'), 'the save wrote a slot')) return;
  const missSlot = Object.keys(EDITS).filter(k => cageOf(slot('integrity'))[k] !== EDITS[k]);
  say(missSlot.length === 0,
      'the SAVED FILE carries every edited row' +
      (missSlot.length ? ` (lost ${missSlot.length}: ${missSlot.slice(0, 5).join(', ')})` : ''));

  const wipCage = cageOf(H.store.getItem('flydiy.wip'));
  const missWip = Object.keys(EDITS).filter(k => wipCage[k] !== EDITS[k]);
  say(missWip.length === 0,
      'the WIP AUTOSAVE carries every edited row' +
      (missWip.length ? ` (lost ${missWip.length}: ${missWip.slice(0, 5).join(', ')})` : ''));

  H.S.exportFile();
  const expCage = H.blob() ? ((JSON.parse(H.blob()).spec || {}).cage || {}) : {};
  const missExp = Object.keys(EDITS).filter(k => expCage[k] !== EDITS[k]);
  say(!!H.blob() && missExp.length === 0,
      'the EXPORTED FILE carries every edited row' +
      (missExp.length ? ` (lost ${missExp.length}: ${missExp.slice(0, 5).join(', ')})` : ''));

  H.S.load('integrity');
  const missBack = Object.keys(EDITS).filter(k => H.P[k] !== EDITS[k]);
  say(missBack.length === 0,
      'edit -> save -> load returns every edited row to the editor' +
      (missBack.length ? ` (lost ${missBack.length}: ${missBack.slice(0, 5).join(', ')})` : ''));

  Object.assign(H.P, { cw_apW: 0.417 });
  say((((JSON.parse(H.S.json()).spec) || {}).cage || {}).cw_apW === 0.417,
      'GARAGE_SPEC.json() reports the aeroplane on the stand, not the last one');

  // =======================================================================
  // B. EVERY SINGLE SLIDER MOVED
  // =======================================================================
  H.S.set(clone(GEN_DEFAULT));
  for (const [k, v] of MOVABLE) H.P[k] = v;
  H.S.save('everything');
  // READ THE FILE THE WAY THE GAME READS IT. `spec.cage` is a DEVIATIONS set,
  // so a key's absence is not a loss — it is the sentence "this row is at its
  // default", and five rows land exactly there because the value this gate
  // moved them to IS the template's. Asserting on raw keys called those five a
  // loss; the only honest question a deviations file can be asked is what it
  // MEANS, which is what `cageFromSpec` answers.
  const allMeans = CAGE2.cageFromSpec({ cage: cageOf(slot('everything')) });
  const missAll = MOVABLE.filter(([k, v]) => allMeans[k] !== v).map(([k]) => k);
  say(missAll.length === 0,
      `the SAVED FILE describes all ${MOVABLE.length} moved rows` +
      (missAll.length ? ` (lost ${missAll.length}: ${missAll.slice(0, 6).join(', ')})` : ''));

  H.S.load('everything');
  const backAll = MOVABLE.filter(([k, v]) => H.P[k] !== v).map(([k]) => k);
  say(backAll.length === 0,
      `save -> load returns all ${MOVABLE.length} rows to the editor` +
      (backAll.length ? ` (lost ${backAll.length}: ${backAll.slice(0, 6).join(', ')})` : ''));

  // =======================================================================
  // C. EVERY SINGLE SLIDER PUT BACK — the half that had teeth
  // =======================================================================
  // The editor is holding the moved aeroplane and the spec agrees. Now walk
  // every row home. `cageToSpec` says so by NOT MENTIONING the key, and the
  // file has to hear that.
  for (const [k] of MOVABLE) H.P[k] = BASE[k];
  H.S.save('home');
  const homeCage = cageOf(slot('home'));
  const homeMeans = CAGE2.cageFromSpec({ cage: homeCage });
  const stuck = MOVABLE.filter(([k]) => homeMeans[k] !== BASE[k]).map(([k]) => k);
  say(stuck.length === 0,
      'a row put BACK to its default is back in the SAVED FILE too' +
      (stuck.length ? ` (${stuck.length} stuck: ${stuck.slice(0, 6).join(', ')})` : ''));

  H.S.load('home');
  const stuckBack = MOVABLE.filter(([k]) => H.P[k] !== BASE[k]).map(([k]) => k);
  say(stuckBack.length === 0,
      'save -> load of the aeroplane put home returns the DEFAULT for every row' +
      (stuckBack.length ? ` (${stuckBack.length} stuck: ${stuckBack.slice(0, 6).join(', ')})` : ''));

  // ...and the file says what the default aeroplane says, key for key. The
  // check above is per-row; this one catches a file that also grew keys.
  const extra = Object.keys(homeCage).filter(k => homeCage[k] !== HOME[k]);
  say(extra.length === 0,
      'the file of an aeroplane put home IS the default aeroplane' +
      (extra.length ? ` (${extra.length} stale: ${extra.slice(0, 6).join(', ')})` : ''));

  // =======================================================================
  // D. THE USER'S OWN CASE, exactly: seating and the cowl opening
  // =======================================================================
  // Both rows off their default once (an archetype's seating, the cub's cowl),
  // then home. Their build read tandem-with-a-pair while the aeroplane on the
  // stand was side-by-side with a central opening; `cabin.seating` came out
  // 'side2' beside it, which is the tell — one field merged and stale, the
  // other a plain value and current.
  // THE LOAD IN THE MIDDLE IS NOT DECORATION. A freshly `set` shelf has no
  // cage in its spec yet, so the first save has nothing to be stale against
  // and a deep merge looks innocent — the sequence has to be the one a builder
  // actually performs: save it, come back to it, change it, save it again.
  H.S.set(clone(GEN_DEFAULT));
  H.P.seatLayout = 2; H.P.cw_apMode = 2;
  H.S.save('cub-ish');
  H.S.load('cub-ish');
  H.P.seatLayout = BASE.seatLayout; H.P.cw_apMode = BASE.cw_apMode;
  H.S.save('jodel-ish');
  const jm = CAGE2.cageFromSpec({ cage: cageOf(slot('jodel-ish')) });
  say(jm.seatLayout === BASE.seatLayout && jm.cw_apMode === BASE.cw_apMode,
      'a side-by-side aeroplane with a central cowl opening saves as one' +
      ` (file says seatLayout ${jm.seatLayout}, cw_apMode ${jm.cw_apMode})`);

  // =======================================================================
  // E. THE FILE DESCRIBES ONE AEROPLANE, not two
  // =======================================================================
  // The invariant the whole arc turns on. A build file carries the cage as
  // DEVIATIONS and everything the join measured as PLAIN VALUES, written from
  // one read of one P — so the derived half and the cage half must agree
  // about the aeroplane, always. They stopped agreeing the moment the cage
  // was deep-merged, and that disagreement is what a saved aeroplane came
  // back wrong from. It is also what let the build be RECONSTRUCTED
  // afterwards: the plain half was still true, so it could say what the cage
  // should have said. A gate that only checked round trips would have missed
  // it twice over.
  const agrees = txt => {
    const sp = JSON.parse(txt).spec || {};
    const meant = CAGE2.cageFromSpec({ cage: sp.cage || {} });
    const want = Math.round(meant.seatLayout) === 1 ? 'side2' : 'tandem2';
    return { ok: !sp.cabin || sp.cabin.seating === want,
             says: sp.cabin && sp.cabin.seating, want, from: meant.seatLayout };
  };
  // ASKED OF THE FILE THAT HAS SOMETHING TO HIDE. Family C's `home` build is
  // the one where every row has been moved and brought back, so it is where a
  // stale cage actually exists to disagree with the derived half; asking the
  // short D sequence instead let both halves be innocent and the check never
  // fired on the bug it was written for.
  for (const [f, what] of [[slot('home'), 'the file'],
                           [slot('jodel-ish'), 'the file just saved'],
                           [H.store.getItem('flydiy.wip'), 'the autosave']]) {
    const a = agrees(f);
    say(a.ok, `${what} describes ONE aeroplane — its derived half agrees ` +
        'with its own cage' +
        (a.ok ? '' : ` (cabin.seating '${a.says}' beside a cage that means ` +
                     `'${a.want}', seatLayout ${a.from})`));
  }

  // =======================================================================
  // F. THE WHOLE ENVELOPE — save, load, save is a FIXED POINT
  // =======================================================================
  // Everything the cage checks above is one field of a build. The rest of it
  // — the name and registration, the paint, the fuel and systems, the cargo,
  // the plaque a bench test wrote and the logbook the flights accrued — never
  // passes through `cageToSpec` at all, and nothing was watching it.
  //
  // Stated as a fixed point rather than as a list, so a section added to the
  // spec joins the test by existing: write a rich build, save it, load it
  // back untouched, save again — and the two files must be the same file.
  // Anything dropped, defaulted, re-derived or doubled shows as a difference.
  H.S.set(clone(GEN_DEFAULT));
  const rich = H.S.get();
  rich.meta = { name: 'My dear jodel', reg: 'F-PGAR', role: 'touring', class: 'n23' };
  rich.paint = { job: 'full', base: 15909943, trim: 1784412, sweep: 0.55,
                 gloss: 0.42, regX: 0.3 };
  rich.fuel = { litres: 63, tank: 'wing' };
  // G99: the vessels ARE the capacity now; the 63 litres above are a reading
  // of this list, and `tank: 'wing'` a reading of its first bay
  // ...and 2026-09-04, the drawn vessels: `finish`, `hue` and `tint` are what
  // the shell is MADE of and `form` which way its shell is closed. None is
  // read by the ledger, which is exactly why losing one is silent — the file
  // would come back weighing the same and looking like a different aeroplane.
  rich.energy = { kind: 'fuel', fuel: 'avgas100LL', cell: 'lifepo4', kWh: 0,
                  vessel: null, finish: 'paint', hue: 212, tint: '#3c6ea8',
                  vessels: [{ bay: 'wingRoot', capacity: 63, along: 0.30,
                              lv: null, rot: 0, form: 'cyl' }] };
  rich.cargo = { len: 0.4, kg: 17 };
  rich.systems = { fit: 'ifr' };
  rich.finish = { sections: { body: { tint: 16764160 },
                              finRud: { fin: 'castAlu', tint: 16777215 } },
                  wear: 1, decals: { regH: 0.6, regL: 3.15 } };
  H.S.set(rich);
  Object.assign(H.P, EDITS);
  H.S.plaque({ verdict: 'FLIES A CIRCUIT', ok: true });
  H.S.note({ id: 'shake', verdict: 'FLIES A CIRCUIT', ok: true });
  H.S.save('envelope');
  const first = JSON.parse(slot('envelope'));
  H.S.load('envelope');
  H.S.save('envelope');
  const second = JSON.parse(slot('envelope'));

  say(JSON.stringify(first.spec) === JSON.stringify(second.spec),
      'save -> load -> save is a FIXED POINT over the whole spec' +
      (JSON.stringify(first.spec) === JSON.stringify(second.spec) ? '' :
       ' (' + (Object.keys(first.spec).filter(k =>
         JSON.stringify(first.spec[k]) !== JSON.stringify(second.spec[k]))
         .join(', ') || 'nested') + ' moved)'));

  // and the three things that are NOT the design, named because losing any of
  // them loses work nobody can redo by dragging a slider
  say(JSON.stringify(first.plaque) === JSON.stringify(second.plaque) &&
      !!second.plaque,
      'the PLAQUE survives the round trip');
  say(JSON.stringify(first.log) === JSON.stringify(second.log) &&
      (second.log.tests || []).length > 0,
      'the LOGBOOK survives the round trip');
  const m = second.spec.meta || {};
  say(m.reg === 'F-PGAR' && m.role === 'touring' && m.class === 'n23',
      'the registration, role and class survive the round trip');
  say(JSON.stringify(second.spec.paint) === JSON.stringify(rich.paint),
      'the PAINT survives the round trip');
  say(!!(second.spec.finish && second.spec.finish.sections &&
         second.spec.finish.sections.finRud &&
         second.spec.finish.sections.finRud.fin === 'castAlu'),
      'the per-section FINISH survives the round trip');
  say(second.spec.fuel && second.spec.fuel.litres === 63 &&
      second.spec.cargo && second.spec.cargo.kg === 17 &&
      second.spec.systems && second.spec.systems.fit === 'ifr',
      'the fuel, cargo and systems survive the round trip');
  // G99: losing the vessel list would silently refill the aeroplane from the
  // default tank, with the litres reading still saying 63
  {
    const E = second.spec.energy || {}, v0 = (E.vessels || [])[0] || {};
    say(v0.bay === 'wingRoot' && v0.capacity === 63 &&
        Math.abs((v0.along || 0) - 0.30) < 1e-9,
        'the VESSELS survive the round trip (bay, capacity, station)');
    say(v0.form === 'cyl' && E.finish === 'paint' && E.hue === 212 &&
        E.tint === '#3c6ea8',
        'the vessel SHAPE and the tank’s finish, hue and tint survive it too');
  }
}
run(GARAGE_SRC, '', ok);

// ---------------------------------------------------------------------------
// THE DOORS. Every place the shelf turns the build into bytes asks the editor
// first. A source check, like GATE BUILD's applySpec -> finishFromSpec line:
// the file needs a document to run, and this is the single line each door must
// carry.
// ---------------------------------------------------------------------------
const DOORS = ['const saveAs = name =>', 'function exportFile()', 'json: ()'];
function doorsIn(src, report) {
  let good = true;
  for (const d of DOORS) {
    const at = src.indexOf(d);
    if (at < 0) { report(false, 'the persist door is still in garage.js: ' + d);
                  good = false; continue; }
    const has = src.slice(at, at + 700).indexOf('commit()') >= 0;
    report(has, 'it asks the editor before writing the build down: ' + d);
    good = good && has;
  }
  return good;
}
doorsIn(GARAGE_SRC, ok);

// ---------------------------------------------------------------------------
// NEGATIVE VERIFICATION — both bugs, put back.
// ---------------------------------------------------------------------------
if (process.argv.includes('--selftest')) {
  // 1. the STALE SPEC: `commit();` is the call, `function commit()` the
  //    definition, so stripping calls gives exactly the shelf that shipped.
  const NO_COMMIT = GARAGE_SRC.replace(/(^|[^.\w])commit\(\);/g, '$1;');
  // 2. the DEEP-MERGED CAGE: the cage back in the key-by-key branch, which is
  //    where it sat while a row could never come home.
  const DEEP_CAGE = GARAGE_SRC.replace("k === 'finish' || k === 'cage'",
                                       "k === 'finish'");
  const cases = [
    ['a shelf that saves without asking the editor',
     rep => run(NO_COMMIT, '', rep)],
    ['a cage deep-merged, so a row can never come home',
     rep => run(DEEP_CAGE, '', rep)],
    ['a door that writes the build down with no commit',
     rep => doorsIn(NO_COMMIT, rep)],
  ];
  let bad = 0;
  for (const [name, fn] of cases) {
    let red = 0;
    fn(c => { if (!c) red++; });
    console.log(`  selftest ${red ? 'caught  ' : 'MISSED  '}${name}` +
                (red ? ` (${red} check(s) went red)` : ''));
    if (!red) bad++;
  }
  ok(bad === 0, `${bad} rule(s) cannot be broken — those checks are inert`);
}

// ---------------------------------------------------------------------------
console.log(`  ${Object.keys(EDITS).length} targeted rows, ${MOVABLE.length} ` +
            `panel rows moved and put back, the whole envelope as a fixed ` +
            `point, ${DOORS.length} persist doors`);
if (fails) {
  console.log('GATE SAVE: FAIL');
  process.exit(1);
}
console.log('GATE SAVE: PASS');
