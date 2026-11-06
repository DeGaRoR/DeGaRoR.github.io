#!/usr/bin/env node
// GATE PLANEFICHE - AIRCRAFT-BOARD: plane_fiche.js, the fiche's generator. Pure node (~1 s), its source and its pure parts;
// the drawing itself needs a page (a box run). What is held:
//   THE VIEWS     six, the user's "inverse hero" among them: the same lens from above, whole, wings on
//   THE AWARD     refused without the airworthiness certificate; a stored fiche is never removed but by forget, and a new one
//                 is stored only once drawn ("a plane having received one does not lose it")
//   THE MATTE     on a known draw: a solid pixel, a half-covered one, the background out, the row order, the crop
//   THE CLONE     Material.clone() drops the finish's shader step: dup carries it back (the twin's white wing, 4 Nov)
//   THE TARGET    display-space (aa_resolve.js's flag), restored; build.js loads it after plane_thumb.js
//   node tools/_plane_fiche_check.js [--selftest]  -> "GATE PLANEFICHE: PASS|FAIL"
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const rd = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const SELF = process.argv.includes('--selftest');
function load(src, W) {
  const ctx = { window: W, console, performance: { now: () => 0 }, Uint8ClampedArray, Uint8Array, Promise, JSON, Math, Map };
  vm.runInNewContext(src, ctx);
  return W.PLANE_FICHE;
}
async function run(F, B) {
  const fails = []; let checks = 0;
  const ok = (c, m) => { checks++; if (!c) fails.push(m); };
  ok(/const VIEWS = \['hero', 'above', 'side', 'plan', 'front', 'cutaway'\]/.test(F), 'the six views');
  ok(/shoot\('hero', heroCam\(T, F, HERO_W \/ HERO_H, 38, -28\)/.test(F), 'the hero: yaw 38, from below');
  ok(/shoot\('above', heroCam\(T, F, HERO_W \/ HERO_H, 38, 28\)/.test(F), 'the inverse hero: the same yaw, from above');
  ok(/38, 28\), HERO_W, HERO_H, false, CUT_STUDIO, F\)/.test(F), 'the inverse hero: its own lights, not the below view\'s');
  ok(/room\.forEach\(\(l, i\) => \{ l\.intensity = roomI\[i\] \* st\.room; \}\)/.test(F) && /room: 0\.35/.test(F) && /room\.forEach\(\(l, i\) => \{ l\.intensity = roomI\[i\]; \}\);\n\s*if \(cut\) cutOff/.test(F), 'a view from above dims the room, and the room is put back');
  ok(/m\.n === w \* h\) throw/.test(F) && /m\.edge\) throw/.test(F), 'a picture that drew nothing or touches its frame stops the fiche');
  ok(/numbers\(spec, F, opts\.title \|\| opts\.name\)/.test(F) && /name: title \|\| \(spec\.meta/.test(F), 'the name is the save\'s or the list\'s, before the file\'s');
  ok(F.indexOf("only.includes('above')") < F.indexOf("V.xray = 1"), 'the inverse hero is drawn before the cut: whole, wings on');
  ok(/c\.onBeforeCompile = m\.onBeforeCompile; c\.customProgramCacheKey = m\.customProgramCacheKey/.test(F), 'dup carries the shader step');
  ok(/rt\.isXRRenderTarget = true/.test(F), 'the target is display-space');
  ok(/cutOff\(cut\)[\s\S]{0,400}R\.setRenderTarget\(rt0\)[\s\S]{0,600}root\.rotation\.x = pitch0/.test(F), 'the page is put back in a finally');
  ok(/draw\(o\)\.then\(async rec => \{ if \(o\.store !== false && rec\.name\) await tx\('readwrite', s => s\.put\(rec\)\)/.test(F), 'stored only once drawn');
  ok((F.match(/\.delete\(/g) || []).length === 1 && /forget\(name\) \{ return tx\('readwrite', s => s\.delete\(name\)\)/.test(F), 'only forget removes a fiche');
  ok(/'plane_thumb\.js', 'plane_fiche\.js'/.test(B), 'build.js loads it after plane_thumb.js');
  // the pure parts, in a stub page
  const W = { BENCH_STATE: () => ({ passed: false }), BENCH_FP: () => 'fpA', GARAGE_SPEC: { get: () => ({ a: 1 }) } };
  let api = null;
  try { api = load(F, W); } catch (e) { fails.push('the file does not load: ' + e.message); return { fails, checks }; }
  // two pixels wide, two rows, rows bottom-up: the corner background; a solid red; half-covered white; background
  const k = [0, 0, 0, 255, 200, 0, 0, 255, 100, 100, 100, 255, 0, 0, 0, 255], wt = [255, 255, 255, 255, 200, 0, 0, 255, 227, 227, 227, 255, 255, 255, 255, 255];
  const m = api._matte(new Uint8Array(k), new Uint8Array(wt), 2, 2);
  ok(m.n === 2, 'the matte: two pixels of aeroplane');
  ok(m.d[4 * 0 + 3] > 120 && m.d[4 * 0 + 3] < 135 && m.d[0] > 190, 'the matte: top-left is the half-covered row-bottom-up pixel, its colour unmixed');
  ok(m.d[4 * 1 + 3] === 0 && m.d[4 * 3 + 3] === 255 && m.d[4 * 3] === 200, 'the matte: the solid pixel whole, the background out');
  let refused = null; try { refused = await api.award('x'); } catch (e) {}
  ok(refused && refused.refused === 'no certificate', 'no certificate: no fiche');
  const s = api.stale({ fp: 'fpOld', hash: api._hashOf({ a: 1 }) });
  ok(s.cert === true && s.paint === false, 'a lapsed certificate marks the fiche, it does not remove it');
  ok(api.stale({ fp: 'fpA', hash: 'other' }).paint === true, 'a repaint marks the fiche');
  return { fails, checks };
}
(async () => {
  const F = rd('src/viewer/plane_fiche.js'), B = rd('tools/build.js');
  const base = await run(F, B);
  if (!SELF) {
    for (const m of base.fails) console.log('  FAIL ' + m);
    console.log('  ' + base.checks + ' checks');
    console.log('GATE PLANEFICHE: ' + (base.fails.length ? 'FAIL (' + base.fails.length + ' of ' + base.checks + ')' : 'PASS'));
    process.exit(base.fails.length ? 1 : 0);
  }
  const BREAKS = [
    ['the inverse hero from below', F.replace('HERO_W / HERO_H, 38, 28)', 'HERO_W / HERO_H, 38, -28)')],
    ['the shader step dropped', F.replace('c.onBeforeCompile = m.onBeforeCompile; ', '')],
    ['a fiche without a certificate', F.replace("if (!st || !st.passed) return { refused: 'no certificate' };", '')],
    ['stored before it is drawn', F.replace("if (o.store !== false && rec.name) await tx", 'if (0) await tx')],
    ['a stale fiche removed', F.replace('if (!rec) return null;', "if (!rec) return null; tx('readwrite', s => s.delete(rec.name));")],
    ['the matte upside down', F.replace('const row = (h - 1 - y) * w * 4;', 'const row = y * w * 4;')],
    ['the target linear', F.replace('rt.isXRRenderTarget = true;', '')],
    ['the top view on the below lights', F.replace('false, CUT_STUDIO, F);   // its eye', 'false, STUDIO, F);   // its eye')],
    ['the room left dim', F.replace('room.forEach((l, i) => { l.intensity = roomI[i]; });', '')],
    ['the room at full on a top view', F.replace('room: 0.35', 'room: 1')],
    ['the frame check off', F.replace("if (m.edge) throw new Error('the ' + name + ' picture touches its frame');", '')],
    ['the file\'s name first', F.replace('numbers(spec, F, opts.title || opts.name)', 'numbers(spec, F)')],
  ];
  let bad = 0;
  for (const [nm, f2] of BREAKS) { if (f2 === F) { console.log('  selftest ' + nm + ': the break did not apply'); bad++; continue; } const r = await run(f2, B); if (!r.fails.length) { console.log('  selftest ' + nm + ': NOT caught'); bad++; } }
  console.log('  selftest: ' + (BREAKS.length - bad) + ' of ' + BREAKS.length + ' caught');
  console.log('GATE PLANEFICHE: ' + (bad || base.fails.length ? 'FAIL' : 'PASS'));
  for (const m of base.fails) console.log('  FAIL ' + m);
  process.exit(bad || base.fails.length ? 1 : 0);
})();
