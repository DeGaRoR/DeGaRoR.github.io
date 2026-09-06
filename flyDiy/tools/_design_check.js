#!/usr/bin/env node
// GATE DESIGN — the macro-row declaration (tools/_cage_design.js, the birth
// certificate of futureDesigns/NEW-AIRCRAFT.md) against the panel it writes
// into and the spec it patches.
//
//   node tools/_design_check.js            -> "GATE DESIGN: PASS|FAIL"
//   node tools/_design_check.js --selftest -> negative verification
//
// The failure this gate exists to catch is the same one GATE PARTS names,
// wearing tiles instead of sliders: an option is added to the table with a
// typo'd key, and clicking its tile writes nothing — the tile lights, the
// aeroplane does not change, and there is no screen on which that is visible.
// GATE PARTS cannot see any of this: its RENDERED set comes from the panel's
// own groupsOverride, and the tiles are a second rendering of the SAME state,
// which is exactly why they need their own coverage rule.
//
// WHAT IT GUARDS:
//
//   SHAPE      row keys unique, groups real, kinds and statuses legal, every
//              row's options reachable (a lazy options() that returns [] is a
//              row with no tiles and no error anywhere else).
//   OPTIONS    every option WRITES something, or CARRIES A REASON, or is the
//              declared sole-live state (`def`). An option that exists in the
//              design but not the code renders greyed with its reason — it is
//              never simply absent (§4: absence hides the backlog).
//   KEYS       every cage key an option writes is a key the panel renders or
//              the parameter set carries — both homes checked, because a
//              starter may write an expert row the tree hides. Function
//              values must survive being called against the page's own base.
//   PATHS      every spec path an option patches exists in GEN_DEFAULT.
//              The TWO fields the flow introduces (meta.role, meta.class) are
//              carried here explicitly until their one-line core declaration
//              lands — 60_gen_spec.js was another session's hot file on the
//              day this gate was written, and a list that shrinks to nothing
//              is better than an edit race.
//   TARGETS    a role's targets use genShakedown's OWN key names (§5.1: the
//              units the plaque will some day judge in), measured off a real
//              shakedown run, never a copied list.
//   ENVELOPE   a live class's wing writes sit INSIDE clampSpec's own bounds —
//              "a class that promises a 16 m span and gets 14 is a FAILURE,
//              not a clamp doing its job" (§7, gated here because it is
//              static; GATE ARCHETYPES proves it dynamically).
//   ARCHETYPES every archetype selects real rows and real options, a LIVE
//              archetype touches no inactive option, and designApply resolves
//              its whole selection with nothing missing.
//
// NEGATIVE-VERIFIED: --selftest breaks each rule in turn and requires the
// matching check to go red. A check on an observable that cannot change is
// indistinguishable from a check that works.
'use strict';
const path = require('path');

const T = __dirname;

// ---------------------------------------------------------------------------
// the panel, headless — the _parts_check.js loader plus _cage_design.js
// itself (lazy by design, so it can load last)
// ---------------------------------------------------------------------------
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
  return global.window;
}

const W = loadPanel();
const D = require(path.join(T, '_cage_design.js'));
const G = require(path.join(T, '_cage_gen.js'));
const CORE = require(path.join(T, 'flight_core.js'));

// the spec fields the birth flow introduces ahead of their core declaration;
// see PATHS above. EMPTY since 2026-08-31 17:11 — meta.role and meta.class
// landed in GEN_DEFAULT + clampSpec the same day; the mechanism stays for
// the next field born while 60_gen_spec.js is another session's hot file.
const NEW_SPEC_FIELDS = [];

const fail = [];
const check = (ok, label, extra) => {
  if (!ok) fail.push(label + (extra ? ' — ' + extra : ''));
  return ok;
};

// the panel's rendered keys (the _parts_check.js walk) plus the parameter
// set's own — a starter is allowed to write an expert key the tree hides,
// but never one that exists nowhere
function panelKeys(groups) {
  const keys = [];
  const walk = items => {
    for (const it of items) {
      if (Array.isArray(it[1])) { walk(it[1]); continue; }
      keys.push(it[0]);
    }
  };
  for (const g of groups) walk(g[1]);
  return keys;
}
const RENDERED = new Set(panelKeys(W.CAGE_PAGE.groupsOverride));
const PAGE_BASE = Object.assign({}, G.CAGE_PARAMS,
                                (W.CAGE_PAGE && W.CAGE_PAGE.defaults) || {});
const KNOWN_KEY = k => RENDERED.has(k) || (k in PAGE_BASE);

// one real shakedown, for the target key names (ledger on, so the split's
// two keys are present the way §5.1 declares targets against them)
let SHAKE_KEYS = new Set();
try {
  const sh = CORE.genShakedown(CORE.buildGen(), { ledger: true });
  SHAKE_KEYS = new Set(Object.keys(sh));
} catch (e) {
  check(false, 'genShakedown did not run', e.message);
}

// does a dotted path exist in GEN_DEFAULT (arrays step into their template
// element, the genDefaults convention)?
function specPathOk(pathStr) {
  if (NEW_SPEC_FIELDS.includes(pathStr)) return true;
  // THE MARKING KIT (2026-09-04): finish is null in GEN_DEFAULT by design (the
  // factory finish), and its decals are AERO_DEC_DEF's fields — the kit's
  // three layers are m1..m3 + a field name. An archetype may carry a recipe.
  if (/^finish.decals.m[123][A-Z][A-Za-z]*$/.test(pathStr)) return true;
  let node = CORE.GEN_DEFAULT;
  for (const part of pathStr.split('.')) {
    if (Array.isArray(node)) node = node[0];
    if (!node || typeof node !== 'object' || !(part in node)) return false;
    node = node[part];
  }
  return true;
}
// flatten a spec patch into dotted paths
function patchPaths(patch, prefix) {
  const out = [];
  for (const k in patch) {
    const p = prefix ? prefix + '.' + k : k;
    if (patch[k] && typeof patch[k] === 'object' && !Array.isArray(patch[k]))
      out.push(...patchPaths(patch[k], p));
    else out.push(p);
  }
  return out;
}

const KINDS = ['discriminator', 'starter', 'field'];
const STATUSES = ['live', 'declared'];

// ---------------------------------------------------------------------------
// 1 SHAPE
// ---------------------------------------------------------------------------
function checkShape(A) {
  let ok = true;
  const seen = new Set();
  const groups = new Set(A.DESIGN_GROUPS);
  for (const r of A.DESIGN_ROWS) {
    if (seen.has(r.key)) ok = check(false, 'duplicate row key', r.key);
    seen.add(r.key);
    ok = check(groups.has(r.group), 'row in a group the grid does not draw',
      `${r.key}: ${r.group}`) && ok;
    ok = check(KINDS.includes(r.kind), 'row with an unknown kind',
      `${r.key}: ${r.kind}`) && ok;
    ok = check(STATUSES.includes(r.status), 'row with an unknown status',
      `${r.key}: ${r.status}`) && ok;
    if (r.kind === 'field') {
      ok = check(Array.isArray(r.specPath) && r.specPath.length > 0,
        'field row with no spec path', r.key) && ok;
      continue;
    }
    const opts = A.rowOptions(r);
    ok = check(Array.isArray(opts) && opts.length >= 2,
      'row with fewer than two options (a lazy options() returning [] ' +
      'renders no tiles and no error)', `${r.key}: ${opts.length}`) && ok;
    if (typeof r.read === 'function') {
      try { r.read(PAGE_BASE, CORE.GEN_DEFAULT); }
      catch (e) { ok = check(false, 'row `read` threw', `${r.key}: ${e.message}`); }
    }
  }
  return ok;
}

// ---------------------------------------------------------------------------
// 2 OPTIONS — write, or carry a reason, or be the declared sole-live state
// ---------------------------------------------------------------------------
function checkOptions(A) {
  let ok = true;
  for (const r of A.DESIGN_ROWS) {
    if (r.kind === 'field') continue;
    const opts = A.rowOptions(r);
    const vals = new Set();
    for (const o of opts) {
      if (vals.has(o.value))
        ok = check(false, 'two options with one value', `${r.key}: ${o.value}`);
      vals.add(o.value);
      const wr = o.writes || {};
      const nCage = Object.keys(wr.cage || {}).length;
      const nSpec = wr.spec ? patchPaths(wr.spec).length : 0;
      const hasReason = typeof o.inactive === 'string' && o.inactive.length > 0;
      ok = check(nCage + nSpec > 0 || hasReason || o.def === true,
        'option that writes nothing, carries no reason, and is not the ' +
        'declared sole-live state', `${r.key}: ${o.label}`) && ok;
      // an inactive option must never ALSO write — a greyed tile that writes
      // is a live tile wearing grey
      ok = check(!(hasReason && nCage + nSpec > 0),
        'inactive option carrying writes', `${r.key}: ${o.label}`) && ok;
      // icons: {vb, paths:[{d}]} with at least one non-empty path. A `plain`
      // row renders as a list and carries none — the engine models, where
      // eighteen near-identical silhouettes would be noise.
      if (!r.plain) {
        const ic = o.icon;
        ok = check(!!ic && typeof ic.vb === 'string' &&
          Array.isArray(ic.paths) && ic.paths.length > 0 &&
          ic.paths.every(p => typeof p.d === 'string' && p.d.length > 3),
          'option with no drawable icon', `${r.key}: ${o.label}`) && ok;
      }
    }
  }
  return ok;
}

// ---------------------------------------------------------------------------
// 3 KEYS + PATHS — every write lands somewhere real
// ---------------------------------------------------------------------------
function checkWrites(A) {
  let ok = true;
  for (const r of A.DESIGN_ROWS) {
    if (r.kind === 'field') {
      ok = check(specPathOk(r.specPath.join('.')),
        'field row on a spec path GEN_DEFAULT does not carry',
        `${r.key}: ${r.specPath.join('.')}`) && ok;
      continue;
    }
    for (const o of A.rowOptions(r)) {
      // G132: the seed channel is walked with the same yardsticks as the
      // live writes — a one-shot key that exists nowhere is exactly as
      // dead as a live one
      for (const wr of [o.writes || {}, o.seed || {}]) {
      for (const k in (wr.cage || {})) {
        let v = wr.cage[k];
        if (typeof v === 'function') {
          try { v = v(PAGE_BASE); }
          catch (e) {
            ok = check(false, 'function write threw against the page base',
              `${r.key}/${o.label}.${k}: ${e.message}`);
            continue;
          }
          ok = check(Number.isFinite(+v), 'function write returned a non-number',
            `${r.key}/${o.label}.${k}: ${v}`) && ok;
        }
        if (k === 'engPreset' && typeof v === 'string') {
          ok = check(A.designPresetIndex(v) !== null,
            'engine preset name the panel does not carry',
            `${r.key}/${o.label}: ${v}`) && ok;
          continue;
        }
        ok = check(KNOWN_KEY(k),
          'cage write on a key neither the panel renders nor the parameter ' +
          'set carries', `${r.key}/${o.label}.${k}`) && ok;
      }
      if (wr.spec)
        for (const p of patchPaths(wr.spec))
          ok = check(specPathOk(p), 'spec write on a path GEN_DEFAULT does ' +
            'not carry', `${r.key}/${o.label}: ${p}`) && ok;
      }
      // targets: genShakedown's own key names, nothing else (§5.1)
      if (o.targets)
        for (const k of Object.keys(o.targets))
          ok = check(SHAKE_KEYS.has(k),
            'role target keyed off genShakedown\'s sheet',
            `${r.key}/${o.label}: ${k}`) && ok;
    }
  }
  return ok;
}

// ---------------------------------------------------------------------------
// 4 ENVELOPE — a live class's wing must fit the clamp it will meet
// ---------------------------------------------------------------------------
function checkEnvelope(A) {
  let ok = true;
  const row = A.rowByKey['class'];
  if (!check(!!row, 'no class row')) return false;
  for (const o of A.rowOptions(row)) {
    if (o.inactive) continue;
    // G132: a class's wing lives in its SEED now (the live write is the
    // label alone)
    const c = (o.seed && o.seed.cage) || (o.writes && o.writes.cage) || {};
    const chord = +c.wgChord, span = +c.wgSpan;
    if (!Number.isFinite(chord) || !Number.isFinite(span)) continue;
    const okChord = chord >= 0.80 && chord <= 2.10;
    const okSpan = span >= Math.max(6.5, 4.0 * chord) &&
                   span <= Math.min(18.0, 20.0 * chord);
    ok = check(okChord && okSpan,
      'live class declares a wing outside clampSpec\'s envelope (the clamp ' +
      'would bite a declared value)', `${o.value}: ${span} x ${chord}`) && ok;
  }
  return ok;
}

// ---------------------------------------------------------------------------
// 5 ARCHETYPES
// ---------------------------------------------------------------------------
function checkArchetypes(A) {
  let ok = true;
  const seen = new Set();
  for (const a of A.ARCHETYPES) {
    if (seen.has(a.key)) ok = check(false, 'duplicate archetype key', a.key);
    seen.add(a.key);
    for (const rowKey in a.sel) {
      const r = A.rowByKey[rowKey];
      if (!check(!!r, 'archetype selects a row that does not exist',
        `${a.key}: ${rowKey}`)) { ok = false; continue; }
      ok = check(!!A.optionOf(rowKey, a.sel[rowKey]),
        'archetype selects an option that does not exist',
        `${a.key}: ${rowKey}=${a.sel[rowKey]}`) && ok;
    }
    const { missing } = A.designApply(PAGE_BASE, a.sel);
    ok = check(missing.length === 0, 'archetype selection does not resolve',
      `${a.key}: ${missing.join(', ')}`) && ok;
    // G140: the over channel gets the same yardsticks as everything else —
    // its cage keys real, its function values resolving, its spec paths in
    // GEN_DEFAULT (the planform patches live here now)
    if (a.over && a.over.cage)
      for (const k in a.over.cage) {
        let v = a.over.cage[k];
        if (typeof v === 'function') {
          try { v = v(PAGE_BASE); }
          catch (e) { ok = check(false, 'archetype over.cage function threw',
            `${a.key}.${k}: ${e.message}`); continue; }
          ok = check(Number.isFinite(+v),
            'archetype over.cage function returned a non-number',
            `${a.key}.${k}: ${v}`) && ok;
        }
        ok = check(KNOWN_KEY(k), 'archetype over.cage key exists nowhere',
          `${a.key}.${k}`) && ok;
      }
    if (a.over && a.over.spec)
      for (const p of patchPaths(a.over.spec))
        ok = check(specPathOk(p), 'archetype over.spec path GEN_DEFAULT ' +
          'does not carry', `${a.key}: ${p}`) && ok;
    // 2026-09-06: THE ENGINE IT NAMES IS THE ENGINE IT BAKES. G195.1 sorted
    // the model tiles by power and designBake read the sorted list with the
    // saved index — every card flew some other card's engine (the Cub-alike
    // an RC outrunner, the ultralight the A-65) and only the full-tier
    // flight gate could have said so. This is the static half: the baked
    // spec's engine type must be the join map's row for the model the card
    // selects, for every live card that names one.
    if (a.sel.engModel && !A.archInactive(a) && typeof A.designBake === 'function') {
      const JE = W.CAGE_JOIN_ENGINES ||
        (W.CAGE_JOIN_ENGINES = require(path.join(T, '_cage_join.js')).CAGE_JOIN_ENGINES);
      let baked = null;
      try { baked = A.designBake(a.sel, a.over); }
      catch (e) { ok = check(false, 'archetype designBake threw', `${a.key}: ${e.message}`); }
      if (baked) {
        const got = baked.engines && baked.engines[0] && baked.engines[0].type;
        ok = check(!!JE[a.sel.engModel] && got === JE[a.sel.engModel],
          'archetype bakes the engine it names',
          `${a.key}: ${a.sel.engModel} -> ${got} (the join map says ${JE[a.sel.engModel]})`) && ok;
      }
    }
  }
  // at least one archetype flies today — a list that is all backlog would
  // make GATE ARCHETYPES a no-op wearing green
  const live = A.ARCHETYPES.filter(a => !A.archInactive(a));
  check(live.length >= 5, 'fewer than five live archetypes',
    `${live.length}`);
  return ok;
}

// ---------------------------------------------------------------------------
// 6 READ FIDELITY (G132) — a lit tile must be recoverable from its own
// write. For every row that is not `once` (whose declaration admits its
// read is lossy) and not a field: apply each live option onto the page
// base, hand the row's read the resulting P and the option's own spec
// patch, and require the option back. This is the check that would have
// caught a role tile lit over a geometry the sliders had walked away from
// — after the label/seed split, every remaining lit tile passes it.
// ---------------------------------------------------------------------------
function checkFidelity(A) {
  let ok = true;
  // resolve THE ITERATED OPTION's live writes, locally — the panel's own
  // seeds:false pick, and on the table under test (routing through
  // designApply would resolve against the real table and blind the
  // selftest to a doctored clone)
  const deep = (a, b) => {
    for (const k in b) {
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]))
        deep(a[k] || (a[k] = {}), b[k]);
      else a[k] = b[k];
    }
    return a;
  };
  for (const r of A.DESIGN_ROWS) {
    if (r.kind === 'field' || r.once || typeof r.read !== 'function') continue;
    for (const o of A.rowOptions(r)) {
      if (o.inactive) continue;
      let got;
      try {
        const wr = o.writes || {};
        const P2 = Object.assign({}, PAGE_BASE);
        for (const k in (wr.cage || {})) {
          let v = wr.cage[k];
          if (typeof v === 'function') v = v(P2);
          if (k === 'engPreset' && typeof v === 'string')
            v = A.designPresetIndex(v);
          P2[k] = v;
        }
        got = r.read(P2, deep({}, wr.spec || {}));
      } catch (e) {
        ok = check(false, 'fidelity: apply-then-read threw',
          `${r.key}/${o.label}: ${e.message}`);
        continue;
      }
      ok = check(got === o.value,
        'read does not recover the option its own write applied (a tile ' +
        'that lights the wrong state, or none)',
        `${r.key}: applied ${o.value}, read ${got}`) && ok;
    }
  }
  return ok;
}

// ---------------------------------------------------------------------------
// 7 CHANNEL COHERENCE (G132) — one fact, two parameter homes, one keeper.
// Any row with a live option writing BOTH a cage key and a spec path must
// declare `pair` rows naming what keeps the two homes one ('join': the
// join measures the cage side back — _join_check proves it behaviorally;
// 'tile': the tile is the only writer of both). Seeds are exempt: a seed
// is one-shot intent, both channels land in the same click and neither is
// claimed as state afterward.
// ---------------------------------------------------------------------------
function checkCoherence(A) {
  let ok = true;
  const VIAS = ['join', 'tile'];
  for (const r of A.DESIGN_ROWS) {
    if (r.kind === 'field') continue;
    const dual = A.rowOptions(r).some(o => !o.inactive && o.writes &&
      Object.keys(o.writes.cage || {}).length > 0 &&
      o.writes.spec && patchPaths(o.writes.spec).length > 0);
    if (dual)
      ok = check(Array.isArray(r.pair) && r.pair.length > 0,
        'dual-channel row with no declared pair (two homes for one fact, ' +
        'no keeper named)', r.key) && ok;
    for (const p of (r.pair || [])) {
      ok = check(!!p && typeof p.cage === 'string' && KNOWN_KEY(p.cage),
        'pair on a cage key that exists nowhere',
        `${r.key}: ${p && p.cage}`) && ok;
      ok = check(!!p && typeof p.spec === 'string' && specPathOk(p.spec),
        'pair on a spec path GEN_DEFAULT does not carry',
        `${r.key}: ${p && p.spec}`) && ok;
      ok = check(!!p && VIAS.includes(p.via),
        'pair kept by nothing anyone defends (via must be join or tile)',
        `${r.key}: ${p && p.via}`) && ok;
    }
  }
  return ok;
}

checkShape(D);
checkOptions(D);
checkWrites(D);
checkEnvelope(D);
checkArchetypes(D);
checkFidelity(D);
checkCoherence(D);

// ---------------------------------------------------------------------------
// NEGATIVE VERIFICATION
// ---------------------------------------------------------------------------
if (process.argv.includes('--selftest')) {
  // a working shallow clone: rows copied, options materialised so a case can
  // break one without touching the real table
  const clone = () => {
    const rows = D.DESIGN_ROWS.map(r => {
      const c = Object.assign({}, r);
      if (r.kind !== 'field')
        c.options = D.rowOptions(r).map(o => {
          const oc = Object.assign({}, o);
          if (o.writes) oc.writes = {
            cage: Object.assign({}, o.writes.cage || {}),
            spec: JSON.parse(JSON.stringify(o.writes.spec || {})),
          };
          // G132: seeds and pairs deep-copied for the same reason writes
          // are — a case that mutates one must never touch the real table
          if (o.seed) oc.seed = {
            cage: Object.assign({}, o.seed.cage || {}),
            spec: JSON.parse(JSON.stringify(o.seed.spec || {})),
          };
          return oc;
        });
      if (Array.isArray(r.pair))
        c.pair = r.pair.map(p => Object.assign({}, p));
      return c;
    });
    const byKey = {};
    for (const r of rows) byKey[r.key] = r;
    return {
      DESIGN_ROWS: rows, DESIGN_GROUPS: D.DESIGN_GROUPS,
      ARCHETYPES: JSON.parse(JSON.stringify(
        D.ARCHETYPES.map(a => ({ key: a.key, sel: a.sel })))),
      rowByKey: byKey,
      rowOptions: r => (typeof r.options === 'function' ? r.options()
                                                        : r.options || []),
      optionOf: (k, v) => {
        const r = byKey[k];
        if (!r || r.kind === 'field') return null;
        return (r.options || []).find(o => o.value === v) || null;
      },
      designApply: D.designApply, archInactive: D.archInactive,
      designBake: D.designBake,
      designPresetIndex: D.designPresetIndex,
    };
  };
  const cases = [
    ['duplicate row key', A => { A.DESIGN_ROWS[1].key = A.DESIGN_ROWS[2].key;
      return checkShape(A); }],
    ['a row whose options come back empty', A => {
      A.rowByKey.canopy.options = []; return checkShape(A); }],
    ['an option that writes nothing and says nothing', A => {
      delete A.rowByKey.mirror.options[0].writes; return checkOptions(A); }],
    ['an inactive option that writes anyway', A => {
      // any row's inactive option (the engine families are all live since
      // G195 — this case crashed on `undefined` from then to 2026-09-06)
      const o = A.DESIGN_ROWS.flatMap(r => Array.isArray(r.options) ? r.options : [])
        .find(x => x.inactive);
      o.writes = { cage: { engPower: 0 } }; return checkOptions(A); }],
    ['an option with no drawable icon', A => {
      A.rowByKey.wgPos.options[0].icon = { vb: '0 0 1 1', paths: [] };
      return checkOptions(A); }],
    ['a cage write on a key that exists nowhere', A => {
      A.rowByKey.wgPos.options[0].writes.cage.noSuchParam = 1;
      return checkWrites(A); }],
    ['a spec write on a path GEN_DEFAULT does not carry', A => {
      A.rowByKey.scheme.options[0].writes.spec = { paint: { noSuchField: 1 } };
      return checkWrites(A); }],
    ['a role target off the shakedown sheet', A => {
      A.rowByKey.role.options[0].targets =
        Object.assign({}, A.rowByKey.role.options[0].targets,
                      { warpFactor: 9 });
      return checkWrites(A); }],
    ['an engine preset name the panel does not carry', A => {
      A.rowByKey.engModel.options =
        [{ value: 'x', label: 'x', icon: { vb: '0 0 1 1', paths: [{ d: 'M0 0 L1 1' }] },
           writes: { cage: { engPreset: 'merlin XX' } } },
         { value: 'y', label: 'y', icon: { vb: '0 0 1 1', paths: [{ d: 'M0 0 L1 1' }] },
           def: true }];
      return checkWrites(A); }],
    ['a live class promising a wing the clamp would bite', A => {
      // G132: the class's wing lives in its SEED now
      const o = A.rowByKey['class'].options.find(x => !x.inactive && x.seed);
      o.seed.cage.wgSpan = 30.0; return checkEnvelope(A); }],  // 16 m stopped biting when the sail class opened the envelope to 18 (G175)
    ['an archetype selecting a row that does not exist', A => {
      A.ARCHETYPES[0].sel = Object.assign({}, A.ARCHETYPES[0].sel,
                                          { warpDrive: 1 });
      return checkArchetypes(A); }],
    ['an archetype selecting an option that does not exist', A => {
      A.ARCHETYPES[0].sel = Object.assign({}, A.ARCHETYPES[0].sel,
                                          { canopy: 'dome' });
      return checkArchetypes(A); }],
    ["an archetype baked with another card's engine", A => {
      const real = A.designBake;
      A.designBake = (sel, over) => {
        const s = real(sel, over);
        s.engines[0].type = 'outrunner2212_9x47'; return s; };
      return checkArchetypes(A); }],
    // G132: the two new families must themselves be breakable
    ['a tile lighting the wrong state', A => {
      A.rowByKey.wgFlapType.options[1].writes.cage.wgFlapType = 2;
      return checkFidelity(A); }],
    ['a dual-channel row with no declared pair', A => {
      delete A.rowByKey.suspension.pair; return checkCoherence(A); }],
    ['a pair kept by nothing anyone defends', A => {
      A.rowByKey.prop.pair[0].via = 'hope'; return checkCoherence(A); }],
    ['a seed on a key that exists nowhere', A => {
      const o = A.rowByKey.role.options.find(x => x.seed);
      o.seed.cage.noSuchParam = 1; return checkWrites(A); }],
  ];
  let bad = 0;
  for (const [name, run] of cases) {
    const before = fail.length;
    const ok = run(clone());
    const caught = fail.length > before || ok === false;
    fail.length = before;
    console.log(`  selftest ${caught ? 'caught  ' : 'MISSED  '}${name}`);
    if (!caught) bad++;
  }
  check(bad === 0, `${bad} rule(s) cannot be broken — those checks are inert`);
}

// ---------------------------------------------------------------------------
const nRows = D.DESIGN_ROWS.length;
const nOpts = D.DESIGN_ROWS.reduce((n, r) =>
  n + (r.kind === 'field' ? 0 : D.rowOptions(r).length), 0);
const nInactive = D.DESIGN_ROWS.reduce((n, r) =>
  n + (r.kind === 'field' ? 0
       : D.rowOptions(r).filter(o => o.inactive).length), 0);
const nArch = D.ARCHETYPES.length;
const nLive = D.ARCHETYPES.filter(a => !D.archInactive(a)).length;
console.log(`  ${nRows} rows, ${nOpts} options (${nInactive} declared with ` +
            `reasons), ${nArch} archetypes (${nLive} live)`);
if (fail.length) {
  for (const f of fail) console.log('  FAIL ' + f);
  console.log('GATE DESIGN: FAIL');
  process.exit(1);
}
console.log('GATE DESIGN: PASS');
