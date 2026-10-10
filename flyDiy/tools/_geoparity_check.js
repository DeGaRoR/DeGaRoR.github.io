#!/usr/bin/env node
// _geoparity_check.js — GATE GEOPARITY (G2640 DESIGN-TRUST): what flies is
// what is drawn, surface by surface.
//
// The user, 10 Oct: "The fin model looks really far from the mesh ... at
// least 10 cm difference between the phy model of wing height, and the mesh."
// And A0, relaying the user: "we don't care about the mosquito design as such.
// It is a symptom for our engine, so all fixes should be generic."
//
// Every build below goes through the page's own chain (_bake_joined: the
// drawing layers headless, the join, the merge) and buildGen, and every aero
// strip the solver flies is set against the drawn sheet cut at the same
// station (_geoparity_lib.js says how). Per surface (wing, stab, fin):
//
//   MEAN station  |dx| <= 0.05 m   the surface's lift acts where it is drawn
//                 (fin 0.10 m)     (the fin: see KEEL below)
//   MEAN height   |dh| <= 0.03 m   (the chord line, not the camber line)
//   WORST strip   |dx| <= 0.15 m   a rounded planform's trapezoid fit leaves
//                 |dh| <= 0.05 m   its root and tip strips off by a tenth
//
// KEEL (the debt this row leaves standing): the join's Sv is the fin proper +
// its rudder + the KEEL TAB under the deck (TAIL CHANTIER 2), and the frame
// flies all of it on the fin's two strips between the tail post's top and the
// fin's top. Where the drawn fin roots below the post's top (a turtledeck's
// fin on its narrow boom: 0.31 of 0.96 m2 under it) those strips' chords come
// out ~30 % wide and their quarter chords 7-9 cm forward; the whole fin's
// force sits 13-18 cm above the drawn area's centre on every build. A keel
// strip (the area under the post flown at its own height) is owed.
//
// THE AERO CENTRES of each whole surface (the drawn sheet integrated in 2 cm
// cuts against the strips' area-weighted force points) are PRINTED: the drawn
// integral cannot tell a dorsal or a strut from the surface, so it is a
// readout, not a verdict.
//
// Chords are printed, not gated (the trapezoid fit's ±0.35 m at a rounded
// stab's root and tip; the area is the drawn one, the join measures it).
//
// THE BUILDS: the five validated aeroplanes, the user's mosquito repros (a
// turtledeck pod), and SYNTHETIC VARIANTS of them on the cage dials - the boom
// stretched and shortened, the fin swept, a cabin turned turtledeck, a rod
// level and inclined - so the rule holds for any boom, tail or wing, not for
// the shapes that happened to be checked. And a SELF-TEST: a joined spec with
// its fin moved 0.5 m must go red.
//
//   node tools/_geoparity_check.js [--only=key,key] [--verbose]
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const GP = require('./_geoparity_lib.js');
const argv = process.argv.slice(2);
const VERB = argv.includes('--verbose');
const ONLY = (argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);

const TOL = { meanX: 0.05, meanXfin: 0.10, meanH: 0.03, worstX: 0.15, worstH: 0.05 };
const rd = f => { const j = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); return j.spec || j; };
const cage = (o) => s => { s.cage = Object.assign({}, s.cage, o); };
const floats = s => { s.gear.type = 'floats'; s.cage = Object.assign({}, s.cage, { gearFloats: 1 }); };

const BUILDS = [
  // the validated five (GATE SPECFIX's list)
  { key: 'cub', file: 'builds/cub_2026-09-20_corrected.json' },
  { key: 'jodel', file: 'builds/jodel_2026-09-20_corrected.json' },
  { key: 'cessna', file: 'bugReports/cessnaMetal (1).json' },
  { key: 'floats', file: 'bugReports/cessnaFloatsWOrks.json' },
  { key: 'twinFloats', file: 'tools/fixtures/build_v7_ultralight_2026-09-05.json', patch: floats },
  // the user's mosquito (a turtledeck pod, two boom lengths, two fins)
  { key: 'mosquito2', file: 'tools/fixtures/repro/mosquito_2.json' },
  { key: 'mosquito3', file: 'tools/fixtures/repro/mosquito_3.json' },
  // SYNTHETIC: the boom, the fin, the body, the rod - on the cage's own dials
  { key: 'cub boom +0.8', file: 'builds/cub_2026-09-20_corrected.json',
    patch: s => cage({ boomLen: +s.cage.boomLen + 0.8 })(s) },
  { key: 'cub boom -0.6', file: 'builds/cub_2026-09-20_corrected.json',
    patch: s => cage({ boomLen: +s.cage.boomLen - 0.6 })(s) },
  { key: 'cub fin swept 25', file: 'builds/cub_2026-09-20_corrected.json', patch: cage({ finSweep: 25 }) },
  { key: 'cub turtledeck', file: 'builds/cub_2026-09-20_corrected.json', patch: cage({ mirror: 1 }) },
  { key: 'mosquito boom 3.6', file: 'tools/fixtures/repro/mosquito_3.json', patch: cage({ boomLen: 3.6 }) },
  { key: 'mosquito boom 6.0', file: 'tools/fixtures/repro/mosquito_3.json', patch: cage({ boomLen: 6.0 }) },
  { key: 'jodel fin upright', file: 'builds/jodel_2026-09-20_corrected.json', patch: cage({ finSweep: 0 }) },
  { key: 'twin rod inclined', file: 'tools/fixtures/build_v7_ultralight_2026-09-05.json',
    patch: s => { floats(s); cage({ rodIncl: 4 })(s); } },
];

let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) fails++; console.log((c ? '  ok     ' : '  FAIL   ') + m); };
const f3 = v => (v >= 0 ? '+' : '') + v.toFixed(3);

function judge(key, r, expectRed) {
  const bad = [];
  for (const k of ['wing', 'stab', 'fin']) {
    const w = r.worst[k];
    if (!w) { bad.push(k + ': not measured'); continue; }
    if (Math.abs(w.mx) > (k === 'fin' ? TOL.meanXfin : TOL.meanX)) bad.push(`${k} mean dx ${f3(w.mx)}`);
    if (Math.abs(w.mh) > TOL.meanH) bad.push(`${k} mean dh ${f3(w.mh)}`);
    if (Math.abs(w.dx) > TOL.worstX) bad.push(`${k} worst dx ${f3(w.dx)}`);
    if (Math.abs(w.dh) > TOL.worstH) bad.push(`${k} worst dh ${f3(w.dh)}`);
  }
  // a missing strip is allowed only where the drawing has no sheet at the
  // flown station: the stab's centre strip (inside the boom) and a fin strip
  // at the boom's deck
  // (and the wing's centre strip, the carry-through inside the fuselage)
  const miss = r.rows.filter(w => w.missing && !(w.kind !== 'fin' && w.span < 0.05) && w.kind !== 'fin');
  if (miss.length) bad.push(miss.length + ' strips with no drawn sheet (' + miss.map(w => w.kind + '@' + w.span.toFixed(2)).join(', ') + ')');
  const line = ['wing', 'stab', 'fin'].map(k => {
    const w = r.worst[k];
    return w ? `${k} mean ${f3(w.mx)}/${f3(w.mh)} worst ${f3(w.dx)}/${f3(w.dh)} chord ${f3(w.dc)}` : k + ' -';
  }).join(' | ');
  const cen = Object.entries(r.centre || {}).map(([k, c]) => `${k} ${f3(c.dx)}/${f3(c.dh)}`).join(' ');
  if (!expectRed && cen) console.log('           aero centres (readout) flown - drawn: ' + cen);
  if (expectRed) ok(bad.length > 0, `${key}: the doctored build goes RED (${bad.join('; ') || 'nothing caught'})`);
  else ok(bad.length === 0, `${key}: ${line}${bad.length ? '  <- ' + bad.join('; ') : ''}`);
  if (VERB || (!expectRed && bad.length)) for (const w of r.rows) {
    if (w.side === -1) continue;
    console.log('           ' + w.kind.padEnd(4) + ' @' + w.span.toFixed(2) + (w.missing ? '  MISSING' :
      `  dx ${f3(w.dx)} dh ${f3(w.dh)} dc ${f3(w.dc)} | flown x ${w.flown.x.toFixed(2)} h ${w.flown.h.toFixed(2)} c ${w.flown.chord.toFixed(2)} | drawn le ${w.drawn.le.toFixed(2)} te ${w.drawn.te.toFixed(2)} h ${w.drawn.h.toFixed(2)}`));
  }
}

console.log('GEOPARITY - every flown strip against the drawn sheet at its station');
console.log(`  tolerance: mean |dx| ${TOL.meanX} m (fin ${TOL.meanXfin}), mean |dh| ${TOL.meanH} m, worst |dx| ${TOL.worstX} m, worst |dh| ${TOL.worstH} m`);
for (const b of BUILDS) {
  if (ONLY.length && !ONLY.includes(b.key)) continue;
  const s = rd(b.file);
  if (b.patch) b.patch(s);
  let r;
  try { r = GP.measure(s); } catch (e) { ok(false, b.key + ': threw ' + e.message); continue; }
  if (r.errors && r.errors.length) console.log('           join errors: ' + r.errors.join(' / '));
  judge(b.key, r, false);
}
if (!ONLY.length || ONLY.includes('selftest')) {
  console.log('SELF-TEST');
  const s = rd('builds/cub_2026-09-20_corrected.json');
  judge('cub, fin moved 0.5 m aft after the join', GP.measure(s, { mutate: J => { J.tail.vX += 0.5; } }), true);
  judge('cub, stab raised 0.15 m after the join', GP.measure(rd('builds/cub_2026-09-20_corrected.json'),
    { mutate: J => { J.tail.stabH = (J.tail.stabH || 0) + 0.15; } }), true);
}
console.log(`\nGEOPARITY: ${checks - fails}/${checks} ok` + (fails ? `, ${fails} FAIL` : ''));
process.exit(fails ? 1 : 0);
