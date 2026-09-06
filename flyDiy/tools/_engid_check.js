#!/usr/bin/env node
// _engid_check.js — the ENGINE IDENTITY verdict (G134, user ruling
// 2026-09-01: "no drift, and never call an engine wrongly"). Proves
// CAGE_ENG_FACTS' rule in node with a faked window:
//   - dials that still resolve to the applied preset's own facts ARE that
//     engine -> null, so the registry row flies under its certified name;
//   - a physics dial away -> the model's facts fly as "modified <name>";
//   - an architecture/family away -> "custom <arch> ...";
//   - dress dials (fins, covers) never rename an engine, because they
//     cannot move the resolved facts — the facts ARE the identity;
//   - the two fantasy presets fly their own resolve (retiring the declared
//     A-65 fallback lie), and pack volts alone is not a different motor.
// Run: node tools/_engid_check.js
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const at = p => path.join(ROOT, p);
global.window = globalThis;                     // classic-script world
// THREE stub: the layer builds a module-level material; the facts path never
// renders, so any constructible thing will do.
const AnyCls = function () {};
globalThis.THREE = new Proxy({}, { get: () => AnyCls });

require(at('tools/_eng_gen.js'));               // -> window.ENG_GEN
require(at('tools/_eng_mesh.js'));              // -> window.ENG_MESH
eval(fs.readFileSync(at('tools/_eng_page.js'), 'utf8')); // -> window.ENG_PAGE
window.COWL_GEN = { P: {} };                    // stub: facts never touch CW
window.COWL_ROWS = [];
window.CAGE_PAGE = {};
// the registry + the join's preset map, as bundle globals
globalThis.POWERPLANTS = new Function(
  fs.readFileSync(at('src/core/00_registry.js'), 'utf8') +
  '; return POWERPLANTS;')();
globalThis.CAGE_JOIN_ENGINES =
  require(at('tools/_cage_join.js')).CAGE_JOIN_ENGINES;
eval(fs.readFileSync(at('tools/_cage_eng.js'), 'utf8')); // the layer IIFE

let fails = 0;
const ok = (c, l) => { console.log((c ? '  ok     ' : '  FAIL   ') + l);
                       if (!c) fails++; };
const FACTS = window.CAGE_ENG_FACTS, APPLY = window.CAGE_ENG_APPLY_PRESET;
ok(typeof FACTS === 'function', 'CAGE_ENG_FACTS exported');
const PRESET_NAMES = Object.keys(window.ENG_PAGE.PRESETS)
  .filter(n => n !== 'bare engine');
const fresh = (name) => {
  const P = Object.assign({}, window.CAGE_PAGE.defaults);
  P.engOn = 1;
  P.engPreset = PRESET_NAMES.indexOf(name);
  APPLY(P, name);
  return P;
};

// 0. EVERY PANEL ROW HAS A DEFAULT (2026-09-06): applyEngPreset writes
//    `engDefaults() + preset` and SKIPS an undefined key, so a row key with
//    no default is never reset by the next preset — the 915's turbo dials
//    rode into a 582 and the load audit flipped that build to custom.
{
  const D = window.ENG_PAGE.engDefaults();
  const SKIP = new Set(['quality', 'sideCyl', 'sideShaft', 'sideAcc',
                        'sidePipe', 'sideDetail', 'screws',
                        'fwOn', 'fwW', 'fwH', 'ruler']);
  const missing = [];
  for (const [, rows] of window.ENG_PAGE.GROUPS)
    for (const r of rows) if (!SKIP.has(r[0]) && D[r[0]] === undefined) missing.push(r[0]);
  ok(missing.length === 0, 'every panel row key has a default in engDefaults()' +
     (missing.length ? ' — MISSING: ' + missing.join(', ') : ''));
  // and the behaviour: a 915 iS then a 582 leaves an untouched 582
  const P = fresh('rotax 915 iS');
  P.engPreset = PRESET_NAMES.indexOf('rotax 582'); APPLY(P, 'rotax 582');
  ok(window.CAGE_ENG_AUDIT(P) === false && +P.eng_blower === 0,
     'a preset applied after a turbo preset carries no turbo (the audit leaves it alone)');
}
// 1. untouched preset IS the engine -> null (registry row flies)
{
  const P = fresh('rotax 912 (flat)');
  ok(FACTS(P) === null, 'untouched 912 preset -> null (certified row flies)');
}
// 2. THE PICKER (2026-09-05, the user's ruling): a catalogue engine flies
//    its row WHATEVER the hidden dials say; the CUSTOM engine flies the
//    dials, named for what it is. (Until this date a bored-out catalogue
//    912 flew as "modified Rotax 912 UL" — see 2b for how such a file is
//    kept honest.)
const CUSTOM = window.CAGE_ENG_CUSTOM;
ok(Number.isInteger(CUSTOM) && CUSTOM === PRESET_NAMES.length,
   'the custom engine is the option after the whole catalogue');
{
  const P = fresh('rotax 912 (flat)');
  P.eng_bore += 5;
  ok(FACTS(P) === null,
     'a bored-out dial under a CATALOGUE 912 does not fly: the row does');
  P.engPreset = CUSTOM;
  const f = FACTS(P);
  ok(!!f, 'the same dials under the custom engine ship facts');
  ok(f && /^custom Flat/.test(f.name),
     `and are named for what they are (${f && f.name})`);
  ok(f && f.family === 'four' && f.cooling === 'liquid',
     '912-derived family/cooling ride (four/liquid)');
}
// 2b. THE LOAD AUDIT: a file that named a catalogue engine over deviating
//     dials flew those dials; it is flipped to custom so it still does
{
  const P = fresh('rotax 912 (flat)'); P.eng_bore += 5;
  ok(window.CAGE_ENG_AUDIT(P) === true && Math.round(P.engPreset) === CUSTOM,
     'a deviating catalogue build is flipped to the custom engine on load');
  const P2 = fresh('rotax 912 (flat)');
  ok(window.CAGE_ENG_AUDIT(P2) === false && PRESET_NAMES[P2.engPreset] === 'rotax 912 (flat)',
     'an untouched catalogue build is left alone');
  const P3 = fresh('rotax 912 (flat)'); P3.eng_finN = (P3.eng_finN || 9) + 4;
  ok(window.CAGE_ENG_AUDIT(P3) === false, 'a dress dial does not flip it');
}
// 3. a DRESS dial does not rename the engine
{
  const P = fresh('rotax 912 (flat)');
  P.eng_finN = (P.eng_finN || 9) + 4;
  ok(FACTS(P) === null, 'more barrel fins is still a 912 -> null');
}
// 4. THE TYPE LEADS (2026-09-05): the layout row is a type row; changing it
//    under a catalogue engine hands the list to that type's first entry
{
  const P = fresh('continental A-65');
  P.eng_arch = 2;                       // -> radial (VALS order flat/inline/radial/vee)
  const first = window.CAGE_ENG_FOLLOW(P);
  ok(first === 'Verner Scarlett 7U' && PRESET_NAMES[P.engPreset] === first,
     `layout -> radial leads the list to the first radial (${first})`);
  APPLY(P, first);
  ok(FACTS(P) === null, 'and that catalogue radial flies its own row');
  const P2 = fresh('continental A-65'); P2.eng_arch = 3;   // -> V
  ok(window.CAGE_ENG_FOLLOW(P2) === 'Hirth HM 508D', 'layout -> V leads to the first V');
  const P3 = fresh('continental A-65'); P3.engPreset = CUSTOM; P3.eng_arch = 2;
  P3.eng_cyl = 6;
  ok(window.CAGE_ENG_FOLLOW(P3) === null, 'the custom engine follows no list');
  const f = FACTS(P3);
  ok(!!f && /^custom Radial/.test(f.name),
     `and a custom radial is named for what it is (${f && f.name})`);
}
// 5. the fantasy presets fly their own resolve, named custom
{
  const P = fresh('flat twin');
  const f = FACTS(P);
  ok(!!f && /^custom /.test(f.name),
     `untouched flat twin -> its own facts (${f && f.name}), not the A-65's`);
}
// 6. electric: rpm moves the facts -> modified; volts alone does not
{
  const P = fresh('EMRAX 228');
  ok(FACTS(P) === null, 'untouched EMRAX -> null');
  const P2 = fresh('EMRAX 228'); P2.engPreset = CUSTOM; P2.eng_rpm += 500;
  const f2 = FACTS(P2);
  ok(!!f2 && /^custom .*electric/.test(f2.name),
     `custom, rpm change -> ${f2 && f2.name}`);
  ok(f2 && f2.aspiration === 'electric', 'aspiration rides electric');
  const P3 = fresh('EMRAX 228'); P3.engPreset = CUSTOM;
  const f3a = FACTS(P3);
  P3.eng_volts = (P3.eng_volts || 100) + 50;
  const f3 = FACTS(P3);
  ok(!!f3 && !!f3a && Math.abs(f3.powerW - f3a.powerW) < 1e-6,
     'pack volts alone leaves the custom motor\'s power where it was');
}
// 7. layer off -> null
{
  const P = fresh('continental A-65'); P.engOn = 0;
  ok(FACTS(P) === null, 'engine layer off -> null');
}
// 7a. THE LIST READS BY POWER (2026-09-06, the user's ruling): the engine
//     row's display order is non-decreasing in the power that flies, the
//     custom engine last, and every index appears exactly once
{
  const order = window.CAGE_ENG_PRESET_ORDER ? window.CAGE_ENG_PRESET_ORDER() : null;
  const pw = window.CAGE_ENG_PRESET_POWER;
  ok(Array.isArray(order) && order.length === PRESET_NAMES.length + 1
     && new Set(order).size === order.length,
     'the display order is a permutation of every option, the custom engine included');
  const full = PRESET_NAMES.concat(['custom engine']);
  let sorted = !!order, seenCustomLast = !!order && order[order.length - 1] === PRESET_NAMES.length;
  if (order) for (let k = 1; k < order.length; k++)
    if (pw(full[order[k - 1]]) > pw(full[order[k]])) sorted = false;
  ok(sorted, 'the options read by non-decreasing power');
  ok(seenCustomLast, 'and the custom engine is the last option');
  const i277 = order ? order.indexOf(PRESET_NAMES.indexOf('rotax 277')) : -1;
  const i1830 = order ? order.indexOf(PRESET_NAMES.indexOf('P&W R-1830')) : -1;
  ok(i277 >= 0 && i1830 > i277, 'a Rotax 277 reads before a Twin Wasp');
}
// 7b. NO ORPHAN PRESET (2026-09-05): every preset that is not a fantasy maps
//     to a registry row, or the join flies it as an A-65 under its own name.
//     The two G165 in-lines were exactly that until this line existed.
{
  const orphans = PRESET_NAMES.filter(n => n !== 'flat twin' && n !== 'flat six'
    && !(POWERPLANTS[CAGE_JOIN_ENGINES[n]]));
  ok(orphans.length === 0,
     'every non-fantasy preset maps to a registry row' +
     (orphans.length ? ' — ORPHANS: ' + orphans.join(', ') : ''));
}
// 8. THE OPTION SAYS WHAT FLIES (G187): the registry row's mass and power for
//    a mapped preset, the resolve's own (marked ≈) for a fantasy one
{
  const L = window.CAGE_ENG_PRESET_LABELS;
  ok(typeof L === 'function', 'CAGE_ENG_PRESET_LABELS exported');
  const labels = L ? L() : [];
  const i582 = PRESET_NAMES.findIndex(n => /582/.test(n));
  const l582 = labels[i582] || '';
  const row = POWERPLANTS[CAGE_JOIN_ENGINES[PRESET_NAMES[i582]]];
  const kg = row.engine.mass.toFixed(0), kW = (row.engine.powerW / 1000).toFixed(0);
  ok(l582.includes(kg + ' kg') && l582.includes(kW + ' kW') && !/≈/.test(l582),
     `rotax 582 option quotes its registry row: "${l582}"`);
  const iFT = PRESET_NAMES.indexOf('flat twin');
  ok(/≈\d+ kg · ≈[\d.]+ kW$/.test(labels[iFT] || ''),
     `flat twin option quotes its own resolve, marked ≈: "${labels[iFT]}"`);
  // the custom engine is the label after the catalogue (2026-09-05)
  ok(labels.length === PRESET_NAMES.length + 1 && /^custom engine/.test(labels[labels.length - 1]),
     'one label per preset, same order, then the custom engine');
}

// 9. THE TURBOPROP (2026-09-05, TURBOPROP §9): an untouched PT6A preset IS
//    its registry row; the flat-rating margin and the core diameter are
//    physics dials (modified, named); a powertrain flip is custom. This is
//    the block that would have passed BY ACCIDENT before familyOf existed —
//    a turbine classed 'four' on both sides compares equal.
{
  const P = fresh('P&W PT6A-34');
  ok(FACTS(P) === null, 'untouched PT6A-34 -> null (certified row flies)');
  ok(Math.round(P.engPower) === 2, 'the preset set the powertrain row to turbine');
  const P2 = fresh('P&W PT6A-34'); P2.engPreset = CUSTOM;
  P2.eng_flatK = +(P2.eng_flatK + 0.1).toFixed(2);
  const f2 = FACTS(P2);
  ok(!!f2 && /^custom .*turboprop/.test(f2.name),
     `custom, margin change -> ${f2 && f2.name}`);
  ok(f2 && f2.aspiration === 'turbine' && f2.family === 'turbine' &&
     f2.cooling === 'air', 'aspiration/family ride turbine, cooling air');
  ok(f2 && f2.flatK > 1.4 && f2.length > 1,
     `and the margin (${f2 && f2.flatK}) and length (${f2 && f2.length.toFixed(2)} m) ride with it`);
  const P3 = fresh('P&W PT6A-34'); P3.engPreset = CUSTOM; P3.eng_tCanD += 0.05;
  const f3 = FACTS(P3);
  ok(!!f3 && f3.powerW > 600000 && /^custom /.test(f3.name),
     `a fatter custom core makes more power (${f3 && (f3.powerW / 1e3).toFixed(0)} kW)`);
  const P4 = fresh('P&W PT6A-34'); P4.engPower = 0;
  const lead = window.CAGE_ENG_FOLLOW(P4);
  ok(lead === 'continental A-65' && FACTS(P4) === null,
     `powertrain flipped to piston leads the list to the first piston (${lead}), a catalogue row`);
  const P5 = fresh('P&W PT6A-114A'); P5.eng_stackStyle = 1 - Math.round(P5.eng_stackStyle);
  ok(FACTS(P5) === null, 'the stacks are dress: a bare PT6A-114A is still a PT6A-114A -> null');
}

// 10. WHERE THE MASS SITS IS MEASURED (2026-09-05, the cgFwd half-session):
//     GEN_ENG_CG's number for every registry row with a preset behind it is
//     the bench's own cgZ for that preset, within 2 cm — the table cannot
//     drift from the engine it describes, and the facts carry the same number
//     so an untouched preset and its row agree.
{
  const CG = new Function(fs.readFileSync(at('src/core/00_registry.js'), 'utf8') +
    '; return GEN_ENG_CG;')();
  const EP = window.ENG_PAGE, EG = window.ENG_GEN;
  let n = 0, bad = [];
  for (const name of PRESET_NAMES) {
    const key = CAGE_JOIN_ENGINES[name];
    if (!key || name === 'flat twin' || name === 'flat six') continue;
    const R = EG.engResolve(Object.assign(EP.engDefaults(), EP.PRESETS[name]));
    const bench = -R.cgZ, table = CG[key];
    if (table == null) { bad.push(key + ': no entry (bench ' + bench.toFixed(2) + ')'); continue; }
    n++;
    if (Math.abs(bench - table) > 0.02)
      bad.push(key + ': table ' + table + ' vs bench ' + bench.toFixed(3));
  }
  ok(n >= 30 && bad.length === 0,
     `GEN_ENG_CG matches the bench for ${n} rows` + (bad.length ? ' — ' + bad.join('; ') : ''));
  // the picker ruling (2026-09-05): a catalogue engine's dials are inert —
  // the custom MODE (the last option) is what reads them
  const P = fresh('P&W PT6A-114A'); P.engPreset = window.CAGE_ENG_CUSTOM; P.eng_tCanL += 0.2;
  const f = FACTS(P);
  ok(!!f && f.cgAft > CG.pt6a114a_hartzell3 + 0.05,
     `a longer core moves the facts' CG aft (${f && f.cgAft} m behind the flange)`);
}

// 11. THE INSTALLATION IS THE BUILDER'S (2026-09-06, the user: "bring back
//     the cylinder orientation for all engines … the exhaust management,
//     which is not part of the engine geometry … the radiator positioning,
//     and everything apart from the block design"). Four claims, and the
//     third is the one that keeps the panel honest:
//       a. every key declared an installation row IS a panel row;
//       b. a row you can SEE is a row the spec READS, and one you cannot see
//          is one it ignores — the shown set is exactly CAGE_ENG_INSTALL;
//       c. no installation row can move the resolve, so a builder can pipe,
//          filter, clock and furnish a catalogue engine all day and it stays
//          that engine under its certified name (the identity ruling);
//       d. the block stays the manufacturer's: bore, stroke, cylinders,
//          fins, the blower and the gearbox appear under `custom engine`
//          and nowhere else.
{
  const EP = window.ENG_PAGE, EG = window.ENG_GEN;
  const INSTALL = window.CAGE_ENG_INSTALL, SPEC = window.CAGE_ENG_SPEC;
  const ITEMS = ((window.CAGE_PAGE.groups || [])[0] || [])[1] || [];
  ok(INSTALL instanceof Set && ITEMS.length > 0,
     'the layer publishes its installation set and its panel items');
  // (a) every declared key is a real row
  const ROWKEYS = new Set();
  for (const [, rows] of EP.GROUPS) for (const r of rows) ROWKEYS.add(r[0]);
  const phantom = [...INSTALL].filter(k => !ROWKEYS.has(k));
  ok(phantom.length === 0,
     'every installation key is a panel row' + (phantom.length ? ' — ' + phantom.join(', ') : ''));
  // the visible `eng_` rows of a build, groups' own `when`s included
  const shownOf = (P) => {
    const out = new Set();
    const walk = (items, live) => {
      for (const it of items) {
        if (Array.isArray(it[1])) {
          let g = {};
          for (const x of it.slice(2)) if (x && typeof x === 'object' && !Array.isArray(x)) g = x;
          let v = live;
          if (v && g.when) { try { v = !!g.when(P); } catch (e) { v = false; } }
          walk(it[1], v);
          continue;
        }
        let o = null;
        for (const x of it.slice(5)) if (x && typeof x === 'object' && !Array.isArray(x)) o = x;
        let v = live;
        if (v && o && o.when) { try { v = !!o.when(P); } catch (e) { v = false; } }
        if (v && /^eng_/.test(it[0])) out.add(it[0].slice(4));
      }
    };
    walk(ITEMS, true);
    return out;
  };
  // (b) shown == read, on a liquid boxer (every group alive at once)
  {
    const P = fresh('rotax 912 (flat)');
    const shown = shownOf(P);
    // `arch` is the TYPE row in the trunk (G195 §6): picking a layout
    // re-leads the catalogue rather than editing the engine, so it is
    // neither an installation row nor one of the geometry rows below.
    const extra = [...shown].filter(k => !INSTALL.has(k) && k !== 'arch');
    ok(extra.length === 0,
       'a catalogue engine shows installation rows and nothing else' +
       (extra.length ? ' — ' + extra.join(', ') : ''));
    for (const k of ['exStyle', 'exDrop', 'exOut', 'exAim', 'exOutX', 'exOutY',
                     'exOutZ', 'radX', 'radY', 'radZ', 'radW', 'radH', 'radD',
                     'airbox', 'airStyle', 'genOn', 'mags', 'leads', 'leadR',
                     'starter', 'oilFilter', 'battOn', 'ecuOn',
                     'mount', 'mountGap', 'fuelX', 'thrY'])
      ok(shown.has(k), `a catalogue 912 keeps '${k}'`);
    // (d) and the block is not on offer
    for (const k of ['bore', 'stroke', 'cyl', 'rpm', 'finN', 'finR', 'rodPos',
                     'twoStroke', 'liquid', 'geared', 'blower', 'boost',
                     'critAlt', 'injected', 'stagger'])
      ok(!shown.has(k), `and hides '${k}' — that would be another engine`);
    const P2 = fresh('rotax 912 (flat)'); P2.engPreset = CUSTOM;
    const all = shownOf(P2);
    for (const k of ['bore', 'stroke', 'cyl', 'finN', 'blower', 'exStyle', 'radY'])
      ok(all.has(k), `the custom engine shows '${k}'`);
  }
  // the aim comes back on an inline and a V, and only there: a boxer's
  // cylinders lie across its case and a radial's are a circle
  {
    ok(shownOf(fresh('DH Gipsy Major')).has('inlineAim'),
       'a catalogue inline can be clocked (cylinders point)');
    ok(shownOf(fresh('Hirth HM 508D')).has('inlineAim'),
       'and so can a catalogue V');
    ok(!shownOf(fresh('continental A-65')).has('inlineAim'),
       'a boxer cannot: the row is not offered');
    ok(!shownOf(fresh('P&W R-985')).has('inlineAim'),
       'nor a radial');
    ok(shownOf(fresh('P&W PT6A-34')).has('stackStyle'),
       'a turboprop keeps its stacks (the exhaust is the airframe\'s)');
    const e = shownOf(fresh('pipistrel E-811'));
    ok(e.has('leads') && e.has('plumb') && !e.has('canD') && !e.has('escOn'),
       'an electric keeps its cables, not its can');
  }
  // (c) no installation row moves the resolve — swept, one row at a time,
  //     over a piston, a turboprop and an electric
  {
    const ROW = k => EP.GROUPS.flatMap(g => g[1]).find(r => r[0] === k);
    const bump = (P, k) => {
      const row = ROW(k), v = P['eng_' + k];
      if (row[2] === 'drop') P['eng_' + k] = (Math.round(v) + 1) % row[3].length;
      else if (row[2] === 'check') P['eng_' + k] = v ? 0 : 1;
      else P['eng_' + k] = Math.min(row[3], Math.max(row[2], v + (row[3] - row[2]) * 0.3));
    };
    const facts = R => [R.mass, R.powerW, R.rpm, R.cgZ, R.aspiration,
                        R.critAlt || 0].join('|');
    for (const name of ['rotax 912 (flat)', 'P&W R-985', 'DH Gipsy Major',
                        'P&W PT6A-34', 'pipistrel E-811']) {
      const base = facts(EG.engResolve(SPEC(fresh(name))));
      const moved = [];
      for (const k of INSTALL) {
        const P = fresh(name);
        if (P['eng_' + k] === undefined) continue;
        bump(P, k);
        let f;
        try { f = facts(EG.engResolve(SPEC(P))); } catch (e) { f = 'THREW'; }
        if (f !== base) moved.push(k);
        if (FACTS(P) !== null) moved.push(k + ' (renamed)');
      }
      ok(moved.length === 0,
         `${name}: no installation row moves the facts or the name` +
         (moved.length ? ' — ' + moved.join(', ') : ''));
    }
  }
}

// THE VERDICT CONTRACT (G67.1): the runner requires BOTH signals.
if (fails) console.log('\n  ' + fails + ' check(s) failed');
console.log('GATE ENGID: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
