#!/usr/bin/env node
// GATE FLOATLETTERS - LOOKS-ROUND2 (the user, 4 Nov: "its registration is printed on the floats in a faulty way. Either
// remove or place elegantly on the side of the float"): a float keeps its paint layers and takes no letters. Pure node
// (~1 s), the source read. What is held, from the section table to the three doors a flown material comes through:
//   THE TABLE   aeroDecOk answers 0.5 for 'float' and 'floatBare' (paint, no letters); the deck rows still 0
//   THE SHADER  uDecOk 0.5 stays in the decal loop and its weight drops a marking with the sdf flag (the letters)
//   THE JOIN    a float's material carries noLet across and stays its own bucket
//   THE DOORS   app.js, flown_bake.js and parked.js hand 0.5 back to the material
//   node tools/_float_letters_check.js [--selftest]  -> "GATE FLOATLETTERS: PASS|FAIL"
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const rd = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const SELF = process.argv.includes('--selftest');
const DOORS = ['src/viewer/app.js', 'src/viewer/flown_bake.js', 'src/viewer/parked.js'];
function run(f) {
  const fails = []; let checks = 0;
  const ok = (c, m) => { checks++; if (!c) fails.push(m); };
  const A = f['src/viewer/aeroskin.js'], J = f['tools/_cage_join.js'];
  ok(/\n\s*float:\s*\{[^}]*noLetters: true/.test(A), "the 'float' row declines the letters");
  ok(/\n\s*floatBare:\s*\{[^}]*noLetters: true/.test(A), "the 'floatBare' row declines the letters");
  ok(/\n\s*floatDeck:\s*\{[^}]*noDec: true/.test(A), "the deck still takes no marking at all");
  ok(/row\.noLetters\) return 0\.5;/.test(A), 'aeroDecOk: noLetters answers 0.5');
  ok(/uDecOk < 0\.25\) break;/.test(A), 'the shader: 0.5 stays in the decal loop');
  // (re-pinned 13 Nov for L40c: LIVERY-STICKERS-3 split the sdf flag - uDecE.x 1 = the letters, 2 = a sticker's field -
  // and the weight now drops only the letters at 0.5 (aLet): a float takes a sticker and still declines the registration)
  ok(/float aLet = step\(0\.5, uDecE\[di\]\.x\) \* step\(uDecE\[di\]\.x, 1\.5\);[\s\S]{0,300}?\* \(1\.0 - aLet \* step\(uDecOk, 0\.75\)\)/.test(A), "the shader: the weight drops the letters (uDecE.x 1, not a sticker's 2) at 0.5");
  ok(/\+o\.decals === 0\.5\) m\.userData\.aeroNoLet = 1/.test(A), 'the material remembers it');
  ok(/kud\.aeroNoLet \? 'NL'/.test(J), 'the join: its own bucket');
  ok(/ud\.aeroNoLet \? \{ noLet: 1 \}/.test(J), 'the join: noLet crosses');
  for (const d of DOORS) ok(/decals: m\.noDec \? 0 : m\.noLet \? 0\.5 : 1/.test(f[d]), d + ': hands 0.5 back');
  return { fails, checks };
}
const files = {};
for (const r of ['src/viewer/aeroskin.js', 'tools/_cage_join.js', ...DOORS]) files[r] = rd(r);
const base = run(files);
if (!SELF) {
  for (const m of base.fails) console.log('  FAIL ' + m);
  console.log('  ' + base.checks + ' checks');
  console.log('GATE FLOATLETTERS: ' + (base.fails.length ? 'FAIL (' + base.fails.length + ' of ' + base.checks + ')' : 'PASS'));
  process.exit(base.fails.length ? 1 : 0);
}
const swap = (rel, a, b) => Object.assign({}, files, { [rel]: files[rel].replace(a, b) });
const BREAKS = [
  ['float row wears letters', swap('src/viewer/aeroskin.js', "wears: 'parent', noLetters: true", "wears: 'parent'")],
  ['floatBare wears letters', swap('src/viewer/aeroskin.js', 'metalOwn: true, noLetters: true', 'metalOwn: true')],
  ['the shader keeps the letters', swap('src/viewer/aeroskin.js', '* (1.0 - aLet * step(uDecOk, 0.75))', '')],
  ['a float drops the stickers too', swap('src/viewer/aeroskin.js', 'step(uDecE[di].x, 1.5);', 'step(uDecE[di].x, 2.5);')],
  ['the loop leaves at 0.5', swap('src/viewer/aeroskin.js', 'uDecOk < 0.25) break;', 'uDecOk < 0.5) break;')],
  ['the join drops it', swap('tools/_cage_join.js', '...(ud.aeroNoLet ? { noLet: 1 } : {}),', '')],
  ['the parked door drops it', swap('src/viewer/parked.js', 'm.noLet ? 0.5 : 1', '1')],
];
let bad = 0;
for (const [nm, f2] of BREAKS) if (!run(f2).fails.length) { console.log('  selftest ' + nm + ': NOT caught'); bad++; }
console.log('GATE FLOATLETTERS selftest: ' + (bad || base.fails.length ? 'FAIL' : 'PASS') + ' (' + (BREAKS.length - bad) + ' of ' + BREAKS.length + ' caught)');
process.exit(bad || base.fails.length ? 1 : 0);
