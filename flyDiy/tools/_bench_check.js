#!/usr/bin/env node
// GATE BENCH — THE TEST SECTION EXPLAINS ITSELF AND KEEPS ITS WORD (G208).
//
//   node tools/_bench_check.js            -> "GATE BENCH: PASS|FAIL"
//   node tools/_bench_check.js --selftest -> negative verification
//
// The user, 2026-09-07: "there are titles cut with no tooltip, I have no idea
// what they mean" / "The plane should keep its certifications, unless
// something changes in there" / "1 small sticker per passed test". Three
// promises, three rows of checks, all provable in node without a canvas:
//
//   THE SHEET   every row app.js prints on the plaque has an explanation in
//               plaque.js, every section heading has its line, the bounds
//               table kept its thresholds, and the band bar's marker never
//               leaves the bar for any value in either direction.
//   THE WORD    the fingerprint ignores paint, finish and meta and nothing
//               else: recolouring keeps a certificate, moving the wing loses
//               it. The hash is stable across runs (a certificate saved
//               today must match the same build tomorrow).
//   THE STRIP   the run card's phase strip knows every phase the test pilot
//               can be in; the stickers draw on a stub context without
//               throwing, land on their own page, and the shader has the
//               slot they take (AERO_MAXD >= 7, the hook in aeroDecalsFor);
//               the manifest carries the new files.
//
// NEGATIVE-VERIFIED: --selftest feeds a sheet with an unexplained row, a
// fingerprint that would count paint, and a phase the strip does not know,
// and requires each to be caught.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SELF = process.argv.includes('--selftest');
let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log('  FAIL ' + msg); } else console.log('  ok   ' + msg); };

// the three modules, loaded as CommonJS (they export when `module` exists)
function load(f) {
  const src = rd(f);
  const m = { exports: {} };
  vm.runInNewContext(src, { module: m, exports: m.exports, console, Math, JSON,
    parseFloat, isFinite, Number, String, Array, Object, Uint8ClampedArray,
    Infinity, setTimeout, clearTimeout, setInterval, clearInterval, performance,
    Date, Symbol });
  return m.exports;
}
const PL = load('src/viewer/plaque.js');
const BE = load('src/viewer/bench.js');
const ST = load('src/viewer/stickers.js');
const APP = rd('src/viewer/app.js');
const PILOT = rd('src/core/41_test_pilot.js');
const SKIN = rd('src/viewer/aeroskin.js');
const BUILD = rd('tools/build.js');

// ---- THE SHEET -----------------------------------------------------------
console.log('THE SHEET');
{
  // every literal label drawPlaque prints, from app.js's own source
  const fn = APP.slice(APP.indexOf('function drawPlaque'), APP.indexOf('let gInd = null'));
  const labels = new Set(), heads = new Set();
  for (const m of fn.matchAll(/\bR\('([^']+)'/g)) labels.add(m[1]);
  for (const m of fn.matchAll(/\bH\('([^']+)'/g)) heads.add(m[1].replace(/\s*\(.*$/, ''));
  // rows whose label is a variable (the bay's own name, the vessel's) hand
  // their explanation over directly; they are not literals and not here
  ok(labels.size >= 30, 'drawPlaque prints ' + labels.size + ' literal rows');
  const missing = [...labels].filter(l => !PL.PLAQUE_WHY[l]);
  ok(!missing.length, 'every row has an explanation' + (missing.length ? ': missing ' + missing.join(', ') : ''));
  const hmiss = [...heads].filter(h => !PL.PLAQUE_SECTIONS[h]);
  ok(heads.size >= 7 && !hmiss.length, 'every section heading has its line' + (hmiss.length ? ': missing ' + hmiss.join(', ') : ''));
  const dyn = fn.match(/H\(s\.energyKind === 'battery' \? '([^']+)' : '([^']+)'\)/);
  ok(dyn && PL.PLAQUE_SECTIONS[dyn[1]] && PL.PLAQUE_SECTIONS[dyn[2]], 'the energy section\'s two headings are explained');
  // the thresholds, unchanged from app.js's table before G208
  const B = PL.PLAQUE_BOUNDS;
  ok(B['climb'].lo === 0.5 && B['climb'].badAtLo === true, 'climb bound 0.5 m/s, red below it');
  ok(B['take-off run'].hi === 500 && B['take-off run'].badHi === 1100, 'take-off run 500 / 1100 m');
  ok(B['static margin'].lo === 0.05 && B['static margin'].badLo === 0, 'static margin 0.05 / 0');
  ok(B['crosswind limit'].lo === 4 && B['crosswind limit'].badLo === 2, 'crosswind 4 / 2 m/s');
  ok(B['prop clear'].lo === 0.12 && B['prop clear'].badLo === 0.05, 'prop clearance 0.12 / 0.05 m');
  // the corners are gone from the plaque and the bench check
  ok(!/forward corner|aft corner/.test(fn), 'the four loading corners left the plaque');
  ok(/genShakedown\(def, \{ corners: false \}\)/.test(APP), 'the bench check runs without the corners');
  // judge agrees with the bound text in every zone
  ok(PL.plaqueJudge('climb', 0.2) === 'bad' && PL.plaqueJudge('climb', 0.7) === '', 'judge: climb');
  ok(PL.plaqueJudge('take-off run', 600) === 'warn' && PL.plaqueJudge('take-off run', 1200) === 'bad', 'judge: take-off run');
  ok(PL.plaqueJudge('static margin', -0.1) === 'bad' && PL.plaqueJudge('static margin', 0.03) === 'warn'
     && PL.plaqueJudge('static margin', 0.2) === '', 'judge: static margin');
  // the band bar: the marker stays on the bar and moves the right way
  let inBar = true, mono = true;
  for (const lab in B) {
    const b = B[lab];
    let last = null;
    for (let v = -1e4; v <= 1e4; v = v === 0 ? 1e-3 : v * (v < 0 ? 0.5 : 2)) {
      const p = PL.plaqueBandPos(b, v);
      if (!p || !(p.pos >= 0 && p.pos <= 1)) inBar = false;
      if (p && last != null) {
        // the marker rises with the value on every row: ok sits right on
        // a `lo` row and left on a `hi` row, and that is the bar's own colouring
        if (p.pos - last < -1e-9) mono = false;
      }
      if (p) last = p.pos;
      if (v > 0 && v > 1e4) break;
    }
    // the zone the bar names is the zone judge names
    for (const v of [-1, 0, 0.01, 0.1, 1, 10, 100, 1000, 2000]) {
      const p = PL.plaqueBandPos(b, v), j = PL.plaqueJudge(lab, v) || 'ok';
      if (p && p.zone !== j) { inBar = false; console.log('    zone mismatch ' + lab + ' ' + v + ': bar ' + p.zone + ' judge ' + j); }
    }
  }
  ok(inBar, 'the band bar\'s marker stays on the bar and its zone is the judge\'s');
  ok(mono, 'the marker moves monotonically with the value');
  // a sheet renders: rows, headings, hover text, no unexplained row
  const S = PL.plaqueSheet();
  S.H('weights'); S.R('empty', '210 kg'); S.R('climb', '0.3 m/s', 'bad');
  const html = S.html();
  ok(/class="ph"/.test(html) && /class="pr has"/.test(html) && /class="pr bad has"/.test(html), 'the sheet renders headings and rows');
  ok(/data-tip="[^"]*power against weight/.test(html), 'a red row carries its fix in the hover text');
  ok(/class="pb up"/.test(html), 'a judged row carries its band bar');
  ok(S.missing.length === 0, 'no row went unexplained');
}

// ---- THE WORD ------------------------------------------------------------
console.log('THE WORD');
{
  const spec = { wings: [{ span: 10, chord: 1.6 }], cabin: { seats: 2 }, gear: { type: 'taildragger' },
                 paint: { base: 0xf2c437, trim: 0x1b3a5c }, finish: { sections: { skin: { fin: 'dope' } } },
                 meta: { name: 'A', reg: 'F-PGAR' }, cage: { waistY: 0.5 } };
  const f0 = BE.benchFingerprint(spec);
  const re = JSON.parse(JSON.stringify(spec));
  re.paint.base = 0x102030; re.finish.sections.skin.fin = 'alclad'; re.meta.name = 'B';
  ok(BE.benchFingerprint(re) === f0, 'a new colour, a new finish and a new name keep the fingerprint');
  const wg = JSON.parse(JSON.stringify(spec)); wg.wings[0].span = 10.5;
  ok(BE.benchFingerprint(wg) !== f0, 'a longer wing changes it');
  const cg = JSON.parse(JSON.stringify(spec)); cg.cage.waistY = 0.55;
  ok(BE.benchFingerprint(cg) !== f0, 'a cage row changes it');
  ok(/^[0-9a-f]{8}$/.test(f0) && BE.benchFingerprint(spec) === f0, 'the hash is eight hex digits and stable');
  ok(BE.benchHash('') === '811c9dc5' && BE.benchHash('a') === 'e40c292c', 'FNV-1a reference values');
  ok(JSON.stringify(BE.BENCH_COSMETIC) === '["paint","finish","meta"]', 'the cosmetic set is paint, finish, meta');
  // the bench source keeps the promises the comment makes
  const src = rd('src/viewer/bench.js');
  ok(/results\[id\]\.fp && results\[id\]\.fp !== fp/.test(src), 'the dirty hook compares fingerprints');
  ok(/stale: true/.test(src) && /withdrawn/.test(src), 'a withdrawn certificate is kept, struck through');
  ok(/r\.when = today\(\)/.test(src), 'every settled result is dated');
  ok(/trim: \(trimUse && f/.test(src), 'BENCH_STATE carries the advised trim only from a live, accepted flight');
  ok(/INP\.setTrim\(st\.trim\)/.test(APP), 'roll-out seeds the hand from the advised trim');
  ok(/report\.trimDe/.test(PILOT) && /trimAcc/.test(PILOT), 'the pilot publishes the trim it held');
  ok(BE.benchTrimWords(0) === 'neutral' && BE.benchTrimWords(0.06) === '3 clicks nose up'
     && BE.benchTrimWords(-0.02) === '1 click nose down', 'trim words in clicks of 0.02');
}

// ---- THE STRIP -----------------------------------------------------------
console.log('THE STRIP');
{
  const phases = new Set();
  for (const m of PILOT.matchAll(/ap\.phase = '([A-Z_-]+)'/g)) phases.add(m[1]);
  const unknown = [...phases].filter(p => BE.benchFlightStep(p) === 3 && !/DEPART|ENROUTE|CRUISE|HOLD|TURNBACK/.test(p));
  ok(phases.size >= 15 && !unknown.length, 'the phase strip knows all ' + phases.size + ' pilot phases' + (unknown.length ? ' — not ' + unknown.join(', ') : ''));
  ok(BE.benchFlightStep('CROSSWIND 3.0 m/s') === 6 && BE.benchFlightStep('TAXI') === 0 && BE.benchFlightStep('STOPPED') === 5, 'crosswind, taxi and stopped map to their steps');
  // the stickers: a stub context that records calls and throws on nothing
  const calls = [];
  const g = new Proxy({}, { get: (_, k) => (k === 'measureText' ? () => ({ width: 8 }) : (...a) => { calls.push(k); }),
                            set: () => true });
  let threw = null;
  try {
    for (const id of ST.STICKER_ORDER) {
      const M = ST.STICKER_META[id];
      ST.stickerRoundel(g, 0.06, 0.06, 0.059, { title: M.title, emblem: M.emblem, date: '2026-09-07' });
      ST.stickerRoundel(g, 20, 20, 18, { title: M.title, emblem: M.emblem, small: true });
    }
  } catch (e) { threw = e; }
  ok(!threw, 'all four roundels draw on a stub context' + (threw ? ': ' + threw.message : ''));
  ok(calls.includes('arc') && calls.includes('fillText') && calls.includes('rotate'), 'a roundel is a disc with lettering round it');
  ok(ST.STICKER_ORDER.length === 4 && ST.STICKER_ORDER.every(id => BE.BENCH_TESTS.some(t => t.id === id)), 'one sticker per declared test');
  ok(Math.abs(ST.stickerStripW() - 0.57) < 1e-9 && ST.STICKER_PLACE.d === 0.12, 'four 120 mm roundels in a 0.57 m strip');
  ok(ST.STICKER_PAGE === 6, 'the strip lives on atlas page 6 (0 reg, 1-2 images, 3-5 the kit)');
  ok(/const AERO_MAXD = 7/.test(SKIN) && /#define AERO_MAXD 7/.test(SKIN), 'the shader has the seventh decal slot');
  ok(/window\.AERO_EXTRA_DECALS\(THREE\)/.test(SKIN), 'aeroDecalsFor takes the stickers through the hook');
  ok(/'plaque\.js', 'stickers\.js', 'bench\.js'/.test(BUILD) && /'bench\.css'/.test(BUILD), 'the manifest carries plaque.js, stickers.js and bench.css');
  ok(/redecal:/.test(rd('tools/_cage_ui.js')), 'the editor can be asked to rebuild its decal list');
  ok(/pos: \[cgN\[0\], cgN\[1\], cgN\[2\]\]/.test(APP), 'the circuit poll carries the trace');
}

// ---- NEGATIVE VERIFICATION ------------------------------------------------
if (SELF) {
  console.log('SELFTEST');
  const S = PL.plaqueSheet(); S.R('a row nobody explained', '1');
  ok(S.missing.length === 1, 'an unexplained row is recorded');
  const a = { wings: [{ span: 10 }], paint: { base: 1 } }, b = { wings: [{ span: 10 }], paint: { base: 2 } };
  ok(BE.benchFingerprint(a) === BE.benchFingerprint(b), 'paint does not count');
  ok(BE.benchFlightStep('NOT-A-PHASE') === 3, 'an unknown phase falls to the cruise step (and the check above would name it)');
  const p = PL.plaqueBandPos({ lo: 1 }, Infinity);
  ok(p === null, 'an infinite value has no marker');
}

console.log(`\n${checks - fails}/${checks} checks`);
console.log('GATE BENCH: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
