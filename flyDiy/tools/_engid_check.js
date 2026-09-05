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

// THE VERDICT CONTRACT (G67.1): the runner requires BOTH signals.
if (fails) console.log('\n  ' + fails + ' check(s) failed');
console.log('GATE ENGID: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
