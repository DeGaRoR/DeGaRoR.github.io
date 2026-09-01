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
// 2. a physics dial deviates -> modified, named after the registry engine
{
  const P = fresh('rotax 912 (flat)');
  P.eng_bore += 5;
  const f = FACTS(P);
  ok(!!f, 'bored-out 912 ships facts');
  ok(f && f.name === 'modified Rotax 912 UL',
     `and is named for what it is (${f && f.name})`);
  ok(f && f.family === 'four' && f.cooling === 'liquid',
     '912 family/cooling ride (four/liquid)');
}
// 3. a DRESS dial does not rename the engine
{
  const P = fresh('rotax 912 (flat)');
  P.eng_finN = (P.eng_finN || 9) + 4;
  ok(FACTS(P) === null, 'more barrel fins is still a 912 -> null');
}
// 4. architecture change -> custom, not "modified"
{
  const P = fresh('continental A-65');
  const i = window.ENG_PAGE.GROUPS.flatMap(g => g[1])
    .find(r => r[0] === 'arch');
  P.eng_arch = 2;                       // -> radial (VALS order flat/inline/radial)
  P.eng_cyl = 6;                        // a plausible radial row
  const f = FACTS(P);
  ok(!!f && /^custom /.test(f.name),
     `arch swap -> custom (${f && f.name})`);
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
  const P2 = fresh('EMRAX 228'); P2.eng_rpm += 500;
  const f2 = FACTS(P2);
  ok(!!f2 && f2.name === 'modified EMRAX 228 / 55 kW',
     `rpm change -> ${f2 && f2.name}`);
  ok(f2 && f2.aspiration === 'electric', 'aspiration rides electric');
  const P3 = fresh('EMRAX 228'); P3.eng_volts = (P3.eng_volts || 100) + 50;
  ok(FACTS(P3) === null, 'pack volts alone is not a different motor -> null');
}
// 7. layer off -> null
{
  const P = fresh('continental A-65'); P.engOn = 0;
  ok(FACTS(P) === null, 'engine layer off -> null');
}

// THE VERDICT CONTRACT (G67.1): the runner requires BOTH signals.
if (fails) console.log('\n  ' + fails + ' check(s) failed');
console.log('GATE ENGID: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
