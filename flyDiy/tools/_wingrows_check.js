#!/usr/bin/env node
// _wingrows_check.js - GATE WINGROWS (G3050 GEOM-FIXES, CONFIGURATIONS §9):
// THE WING ROW IS THE WING THAT IS DRAWN AND FLOWN.
//
// §9 named three wing rows that did not reach what they said (RULING 3): the
// tip chord (0.55 on a 2.10 root flew 0.945 m: clampWing's taper floor), the
// fore / aft row (the drawn wing kept going past the flown xLE envelope) and
// the span (coupled to the chord, 4-20 x). G1283 made them SAY so; G3050 makes
// them one number: the editor writes every wing row back to the resolved wing
// before each build (PAGE.coerce, tools/_cage_wing.js), and the wing layer
// draws its station inside the window the join's measurement flies.
//
//   S9      the three §9 cases + their siblings (the ceiling tip, tip offset
//           past tan 30 deg, a crank under 15 %, a centre under 0.20 m, a flap
//           past the aileron), on both planes: after the coerce the row equals
//           the flown value, and the row's note says it was held and why
//   SWEEP   seeded random rows over every wing row's own range, both planes:
//           every live row = what resolveSpec(cageJoinSpec(P)) flies - the
//           JOIN's mapping, not the wing layer's (the two homes of P -> spec
//           cross-checked); a second coerce writes nothing (a fixed point)
//   KEPT    the validated builds (Cub, Jodel, Cessna, Cessna floats, the twin
//           on floats) + the user's mosquito: the rows the coerce moves are
//           listed, and the flown wing + controls are BIT-IDENTICAL before and
//           after (the coerce moves a row only onto what it already flew)
//   STATION the fore / aft row at both ends of its range, through the page's
//           own chain headless (the GAME's path - no coerce runs there):
//           GEOPARITY's wing rows (drawn sheet vs flown strips) inside its
//           tolerance, the flown xLE inside the envelope, no ERRS station cut;
//           the layer writes the row to the window's end it drew
//   SELF    the coerce removed -> S9 + SWEEP red; the drawn window removed (the
//           layer draws past the envelope) -> STATION red
//
//   node tools/_wingrows_check.js [--only=s9,sweep,kept,station,self]
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const argv = process.argv.slice(2);
const ONLY = (argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const on = k => !ONLY.length || ONLY.includes(k);

const SH = require('./_scene_headless.js');
const C = require('./flight_core.js');
const { cageJoinSpec } = require('./_cage_join.js');
const W = SH.context().ctx;                 // the layers as the headless page loads them
const PAGE = W.CAGE_PAGE, CG2 = W.CAGE2;
const JT = { TIP_KEYS: Object.keys(C.GEN_TIPS), FLAP_KEYS: Object.keys(C.GEN_FLAPS), PRESET_NAMES: [] };
const BASE = Object.assign({}, CG2.CAGE_PARAMS, PAGE.defaults || {});
const COERCE = (PAGE.coerce || []).slice();

let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) fails++; console.log((c ? '  ok     ' : '  FAIL   ') + m); return c; };
const runCoerce = P => { let ch = false; for (const f of PAGE.coerce || []) if (f(P)) ch = true; return ch; };
const rows = it => { const o = new Map(); const walk = a => { for (const r of a) { if (Array.isArray(r[1])) walk(r[1]); else if (!o.has(r[0])) o.set(r[0], r); } }; for (const g of PAGE.groupsOverride || PAGE.groups || []) walk(g[1]); return o; };
const ROWS = rows();
const noteOf = (P, k) => { const r = ROWS.get(k); const o = r && r.slice(5).find(x => x && typeof x === 'object' && !Array.isArray(x)); return o && typeof o.note === 'function' ? (o.note(P) || '') : null; };

// the FLOWN value of each row, read the JOIN's way (cageJoinSpec, resolveSpec)
// - an independent copy of the inverse map, not the wing layer's ROWBACK
const FLAP = P => JT.FLAP_KEYS[Math.round(P.wgFlapType)] !== 'none';
function flownRows(P) {
  const S = C.resolveSpec(cageJoinSpec(P, {}, JT)).spec;
  const out = {};
  const plane = (w, c, pre, live) => {
    const k = s => pre + s;
    out[k('Span')] = w.span; out[k('Chord')] = w.chord; out[k('ChordTip')] = w.chord * w.taper;
    out[k('TipX')] = w.tipX; out[k('Dihedral')] = w.dihedral; out[k('Incidence')] = w.incidence;
    out[k('Washout')] = w.washout; out[k('Panels')] = w.panels;
    out[k('Camber')] = Math.floor(w.naca / 1000); out[k('Thick')] = w.naca % 100;
    if (live.crank) { out[k('CrankAt')] = w.crankAt; if (w.crankAt > 0) { out[k('CrankChord')] = w.crankChord; out[k('CrankX')] = w.crankX; out[k('DihedralOut')] = w.dihedralOut; } }
    if (live.centreW) out[k('CentreW')] = w.centreW;
    if (live.ail && c) { out[k('AilSpan')] = c.aileron.span; out[k('AilChord')] = c.aileron.chord; }
    if (live.flap && c) { out[k('FlapSpan')] = c.flap.span; out[k('FlapChord')] = c.flap.chord; }
    if (live.para) out[k('ParaH')] = w.cabaneH;
  };
  plane(S.wings[0], S.controls, 'wg', { crank: +P.wgCrankAt > 0, centreW: +P.wgCentreW > 0,
    ail: +P.wgAilOn && +P.wgAilSpan > 0, flap: FLAP(P), para: Math.round(P.wgPos) === 3 });
  if (+P.w2On && S.wings[1]) {
    plane(S.wings[1], S.wings[1].controls, 'w2', { crank: +P.w2CrankAt > 0, centreW: +P.w2CentreW > 0,
      ail: +P.w2AilOn && +P.w2AilSpan > 0, flap: JT.FLAP_KEYS[Math.round(P.w2FlapType)] !== 'none', para: Math.round(P.w2Pos) === 0 });
    out.w2Stagger = S.wings[1].stagger;
  }
  return out;
}
const rowMismatch = P => {
  const F = flownRows(P), bad = [];
  for (const k in F) if (typeof F[k] === 'number' && Math.abs(+P[k] - F[k]) > 1e-6) bad.push(`${k} row ${(+P[k]).toFixed(4)} flies ${F[k].toFixed(4)}`);
  return bad;
};
const P0 = over => Object.assign({}, BASE, { wingOn: 1, lightOn: 0 }, over);

// ---- S9 -------------------------------------------------------------------
const S9 = [
  ['§9.1 tip 0.55 on a 2.10 root (flew 0.945)', { wgChord: 2.10, wgChordTip: 0.55 }, 'wgChordTip', 0.945, /^held at 0\.945 \(asked 0\.55\) — the tip is held to 0\.45–1 × the root chord/],
  ['the ceiling: tip 1.75 on a 1.70 root (the user\'s Cub)', { wgChord: 1.70, wgChordTip: 1.75 }, 'wgChordTip', 1.70, /^held at 1\.7 \(asked 1\.75\)/],
  ['§9.3 span 6.5 on a 2.10 chord (4 x chord)', { wgChord: 2.10, wgChordTip: 2.10, wgSpan: 6.5 }, 'wgSpan', 8.40, /^held at 8\.4 \(asked 6\.5\) — the span is held/],
  ['span 18 on a 0.80 chord (20 x chord)', { wgChord: 0.80, wgChordTip: 0.80, wgSpan: 18 }, 'wgSpan', 16.0, /^held at 16 \(asked 18\)/],
  ['the sail seed 15 x 1.00 untouched', { wgChord: 1.00, wgChordTip: 0.55, wgSpan: 15 }, 'wgSpan', 15.0, /^$/],
  ['tip offset 2.5 on a 6.5 m span (tan 30 deg)', { wgChord: 1.2, wgChordTip: 1.2, wgSpan: 6.5, wgTipX: 2.5 }, 'wgTipX', Math.tan(Math.PI / 6) * (3.25 - 0.3), /^held at 1\.703 \(asked 2\.5\) — the tip offset/],
  ['a crank at 10 % is no crank', { wgCrankAt: 0.10 }, 'wgCrankAt', 0, /^held at 0 \(asked 0\.1\) — a crank inboard/],
  ['a 0.10 m centre section flies 0.20', { wgCentreW: 0.10 }, 'wgCentreW', 0.20, /^held at 0\.2 \(asked 0\.1\)/],
  ['a 0.60 flap beside a 0.55 aileron', { wgFlapType: Math.max(1, JT.FLAP_KEYS.indexOf('plain')), wgAilOn: 1, wgAilSpan: 0.55, wgFlapSpan: 0.60 }, 'wgFlapSpan', 0.41, /^held at 0\.41 \(asked 0\.6\) — the flap ends/],
  ['the second plane: tip 0.55 on a 2.10 root', { w2On: 1, wgPos: 0, w2Pos: 2, w2Chord: 2.10, w2ChordTip: 0.55 }, 'w2ChordTip', 0.945, /^held at 0\.945 \(asked 0\.55\) — the tip is held/],
  ['the second plane: span 6.5 on a 2.10 chord', { w2On: 1, wgPos: 0, w2Pos: 2, w2Chord: 2.10, w2ChordTip: 2.10, w2Span: 6.5 }, 'w2Span', 8.40, /^held at 8\.4/],
];
function s9(label) {
  console.log('S9 - the three §9 rows and their siblings, both planes' + (label || ''));
  let red = 0;
  for (const [name, over, key, want, noteRe] of S9) {
    const P = P0(over);
    runCoerce(P);
    const bad = rowMismatch(P);
    const n = noteOf(P, key);
    const good = Math.abs(+P[key] - want) < 1e-6 && !bad.length && n !== null && noteRe.test(n);
    if (label) { if (!good) red++; continue; }
    ok(good, `${name}: row ${(+P[key]).toFixed(4)} (want ${want.toFixed(4)})` +
       (bad.length ? ' <- ' + bad.join('; ') : '') + `; note ${JSON.stringify(n)}`);
  }
  return red;
}

// ---- SWEEP -----------------------------------------------------------------
let seed = 3050;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const ranges = [...ROWS.values()].filter(r => /^(wg|w2)[A-Z]/.test(r[0]) && typeof r[2] === 'number' && typeof r[3] === 'number');
function sweep(label, n) {
  if (!label) console.log(`SWEEP - ${n} seeded random wings over every wing row's range, both planes`);
  let red = 0, moved = 0, nonFixed = 0;
  const reds = [];
  for (let i = 0; i < n; i++) {
    const over = { w2On: rnd() < 0.4 ? 1 : 0 };
    for (const r of ranges) {
      if (/Dx$|Dy$|Stagger$/.test(r[0])) continue;
      const v = r[2] + rnd() * (r[3] - r[2]);
      over[r[0]] = r[4] >= 1 ? Math.round(v) : +v.toFixed(3);
    }
    const P = P0(over);
    if (runCoerce(P)) moved++;
    const bad = rowMismatch(P);
    const Q = Object.assign({}, P);
    if (runCoerce(Q) && JSON.stringify(Q) !== JSON.stringify(P)) nonFixed++;
    if (bad.length) { red++; if (reds.length < 4) reds.push(`#${i}: ${bad.slice(0, 3).join('; ')}`); }
  }
  if (label) return red;
  ok(red === 0, `every live wing row = the flown wing on ${n - red}/${n} random builds (${moved} had a row the resolver overruled)` +
     (reds.length ? '\n           ' + reds.join('\n           ') : ''));
  ok(nonFixed === 0, `the write-back is a fixed point: a second coerce moves nothing (${nonFixed} moved)`);
  return red;
}

// ---- KEPT ------------------------------------------------------------------
const rd = f => { const j = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); return j.spec || j; };
const BUILDS = [
  ['cub', 'builds/cub_2026-09-20_corrected.json'],
  ['jodel', 'builds/jodel_2026-09-20_corrected.json'],
  ['cessna', 'bugReports/cessnaMetal (1).json'],
  ['cessna floats', 'bugReports/cessnaFloatsWOrks.json'],
  ['twin on floats', 'tools/fixtures/build_v7_ultralight_2026-09-05.json'],
  ['mosquito', 'tools/fixtures/repro/mosquito_3.json'],
];
const flownWing = P => { const S = C.resolveSpec(cageJoinSpec(P, {}, JT)).spec; return JSON.stringify([S.wings, S.controls]); };
function kept() {
  console.log('KEPT - the validated builds: the rows the write-back moves, the flown wing bit-identical');
  for (const [key, f] of BUILDS) {
    const P = Object.assign({}, BASE, CG2.cageFromSpec(rd(f)));
    if (CG2.cageHasLegacy && CG2.cageHasLegacy(P)) Object.assign(P, CG2.cageLiftLegacy(P));
    const before = Object.assign({}, P), fw0 = flownWing(P);
    runCoerce(P);
    const moved = Object.keys(P).filter(k => P[k] !== before[k] && !(Number.isNaN(P[k]) && Number.isNaN(before[k])))
      .map(k => `${k} ${before[k]} -> ${+(+P[k]).toFixed(4)}`);
    ok(flownWing(P) === fw0 && !rowMismatch(P).length,
       `${key}: flown wing + controls bit-identical; rows moved: ${moved.length ? moved.join(', ') : 'none'}`);
  }
}

// ---- STATION ---------------------------------------------------------------
// the station and the root heights at the rows' ends, through the page's own
// chain headless (the GAME's path: no editor coerce runs there). Drawn = flown
// is stated twice: the join's MEASUREMENT off the drawing (xLE, each plane's
// yRoot) equals what the resolver flies (nothing cut), and GEOPARITY's wing
// rows (the drawn sheet against the flown strips) sit inside its tolerance.
// And the layer wrote the rows onto what it drew.
let GP = null;
const TOLW = { mx: 0.05, dx: 0.15, mh: 0.03, dh: 0.05 };
function stationRow(key, f, over, opts) {
  GP = GP || require('./_geoparity_lib.js');
  const s = rd(f);
  s.cage = Object.assign({}, s.cage, over);
  const r = GP.measure(s);
  const w = r.worst.wing;
  const flown = C.resolveSpec(r.spec).spec.wings;
  const meas = r.spec.wings || [];           // the joined spec: the join's measurements, unclamped
  const bad = [];
  meas.forEach((m, k) => {
    for (const f2 of ['xLE', 'yRoot'])
      if (typeof m[f2] === 'number' && Math.abs(m[f2] - flown[k][f2]) > 1e-9)
        bad.push(`plane ${k} ${f2} drawn ${m[f2].toFixed(3)} flies ${flown[k][f2].toFixed(3)}`);
  });
  if (!+s.cage.w2On) {
    if (!w) bad.push('wing not measured');
    else for (const [t, lim] of Object.entries(TOLW)) if (Math.abs(w[t]) > lim) bad.push(`geoparity ${t} ${w[t].toFixed(3)}`);
  }
  const cut = (r.errors || []).filter(e => /flown envelope/.test(e));
  if (cut.length) bad.push('ERRS: ' + cut[0]);
  if (opts && opts.quiet) return !bad.length;
  const A = r.W.CAGE_WING && r.W.CAGE_WING.anchor || {};
  const P = r.W.CAGE_UI && r.W.CAGE_UI.P || {};
  if (!(Math.abs(+P.wgDx - A.dx) < 1e-9 && Math.abs(+P.wgDy - A.dy) < 1e-9)) bad.push(`rows ${P.wgDx}/${P.wgDy} vs drawn ${A.dx}/${A.dy}`);
  const f3 = v => typeof v === 'number' ? v.toFixed(3) : '-';
  ok(!bad.length, `${key}: drawn dx ${f3(A.dx)} dy ${f3(A.dy)}` + (+s.cage.w2On ? ` w2Dy ${f3(+P.w2Dy)}` : '') +
     `; xLE ${meas.map(m => f3(m.xLE)).join('/')} yRoot ${meas.map(m => f3(m.yRoot)).join('/')}` +
     (w && !+s.cage.w2On ? `; geoparity mean ${f3(w.mx)}/${f3(w.mh)} worst ${f3(w.dx)}/${f3(w.dh)}` : '') +
     (bad.length ? '  <- ' + bad.join('; ') : ''));
  return !bad.length;
}
const JODEL = 'builds/jodel_2026-09-20_corrected.json', CUB = 'builds/cub_2026-09-20_corrected.json',
      CESSNA = 'bugReports/cessnaMetal (1).json';
const STATIONS = [
  ['jodel, fore / aft at the aft end -1.5 (inside)', JODEL, { wgDx: -1.5 }],
  ['jodel, fore / aft at the forward end 1.8 (§9.2: drawn 1.16 m ahead of the flown)', JODEL, { wgDx: 1.8 }],
  ['cub, fore / aft 1.8', CUB, { wgDx: 1.8 }],
  ['cessna, fore / aft 1.8', CESSNA, { wgDx: 1.8 }],
  ['cessna, parasol 1.20 m + up 1.0 (drawn 3.72 m over the keel, flew 3.00)', CESSNA, { wgPos: 3, wgParaH: 1.2, wgDy: 1.0 }],
  ['cub, low wing down 1.0 (inside)', CUB, { wgPos: 2, wgDy: -1.0 }],
  ['cub biplane, upper parasol 1.20 m + up 0.6 (drawn 3.39, flew 3.00)', CUB, { wgPos: 2, w2On: 1, w2Pos: 0, w2ParaH: 1.2, w2Dy: 0.6 }],
];
function station() {
  console.log('STATION - the fore / aft and up / down rows at their ends, through the page chain headless (the game path)');
  for (const [k, f, o] of STATIONS) stationRow(k, f, o);
}

// ---- SELF ------------------------------------------------------------------
function self() {
  console.log('SELF-TEST - each rule broken must go red');
  PAGE.coerce.length = 0;
  try {
    ok(s9(' (coerce removed)') > 0, 'the write-back removed: S9 goes red');
    ok(sweep(' (coerce removed)', 60) > 0, 'the write-back removed: SWEEP goes red');
  } finally { PAGE.coerce.push(...COERCE); }
  // the layer draws past the envelope: its window read off a widened copy
  // (the core's clampWing keeps its own - the flown wing still clamps)
  const E0 = W.GEN_WING_ENVELOPE;
  W.GEN_WING_ENVELOPE = Object.assign({}, E0, { xLE: [-9, 9] });
  try {
    ok(!stationRow('jodel', JODEL, { wgDx: 1.8 }, { quiet: true }),
       'the drawn window removed: the Jodel at fore / aft 1.8 goes red (drawn past the flown wing)');
  } finally { W.GEN_WING_ENVELOPE = E0; }
}

console.log('WINGROWS - the wing row is the wing that is drawn and flown (G3050, CONFIGURATIONS §9)');
if (on('s9')) s9();
if (on('sweep')) sweep(null, 400);
if (on('kept')) kept();
if (on('station')) station();
if (on('self')) self();
console.log(`\nWINGROWS: ${checks - fails}/${checks} ok` + (fails ? `, ${fails} FAIL` : ''));
console.log(`GATE WINGROWS: ${fails ? 'FAIL' : 'PASS'}`);
process.exit(fails ? 1 : 0);
