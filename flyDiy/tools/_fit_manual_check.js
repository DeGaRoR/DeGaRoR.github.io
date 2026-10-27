#!/usr/bin/env node
// GATE FITMANUAL - EVERY FITTING PLACEABLE BY HAND (FITTINGS-MANUAL, 2026-10-27).
//
//   node tools/_fit_manual_check.js            -> "GATE FITMANUAL: PASS|FAIL"
//   node tools/_fit_manual_check.js --selftest -> each judged row broken at its source, each must go red
//
// The user: "the auto place messes up; every fitting must be placeable BY HAND ... The auto site stays the DEFAULT.
// Once a fitting is moved by hand it stands exactly there (no snap jumping ring by ring; keep it on the skin
// surface, normal and clip rules as today). A 'reset to auto' per fitting." The access layer's two rows a fitting,
// acc_<k>_z (metres from the firewall, the table's tape) and acc_<k>_h (percent of the local height on a flank),
// absent = auto. On the Cub (builds/cub_2026-09-20_corrected.json), through the layers headless
// (tools/_scene_headless.js, the page's own PAGE.post chain), this asks:
//   1 AUTO IS UNTOUCHED: no row set, and every row set to null (the follow box ticked = reset), place every fitting
//     exactly where the other does - and the save carries no hand row (old files stay byte-identical)
//   2 IT LANDS WHERE ASKED: each hand-placed fitting's site, read back off the SHEET'S OWN TRIANGLES (not the
//     resolver's arithmetic): within 1 mm of the skin, the field's sL there within 2 mm of the asked fore/aft, and
//     its height in the section (the section's own extent at that station, off the triangles) within 1.5 % of the
//     asked percent
//   3 NO SNAP: a hand station 10 mm further aft moves the fitting 10 mm (+-3), not a ring
//   4 A FITTING THE TABLE DOES NOT FIT HERE (the Cub's step: its sill is under 0.62 m) is not drawn until it is
//     placed by hand, and then it is
//   5 THE ROWS: the 'placement' group is in the normal panel (not expert), each fitting has its two rows, and a
//     row's follow value is the auto site's (what unticking writes)
'use strict';
const path = require('path');
const fs = require('fs');
const SH = require('./_scene_headless.js');

const SELFTEST = process.argv.includes('--selftest');
const CUB = path.join(__dirname, '..', 'builds', 'cub_2026-09-20_corrected.json');
// THE TEST (the user: "the Cub's door handle, step and fuel cap placed by hand where the real J-3 has them" - the
// references are in HANDOVER's FITTINGS-MANUAL entry): the fuel filler on the cowl top over the tank, ahead of the
// windscreen (the table's tape runs over the screen on the crown: the glass is sL -0.28..0 here, and a cap asked on
// it is refused - a fitting on the glazing is no fitting), the door handle at the door's aft edge at the split of its
// two halves, the boarding step low on the fuselage aft of the door
const ASK = {
  acc_fuelCap_z: -0.45,
  acc_doorHandle_z: 0.94, acc_doorHandle_h: 52,
  acc_step_z: 1.12, acc_step_h: 6,
};
const BREAK = {};               // --selftest: which row to break

const fail = [];
let n = 0;
const check = (ok, what, info) => { n++; if (!ok) fail.push(what + (info != null ? ' (' + info + ')' : '')); console.log((ok ? '  ok   ' : '  FAIL ') + what + (info != null ? '  [' + info + ']' : '')); return ok; };

function build(over) {
  const raw = JSON.parse(fs.readFileSync(CUB, 'utf8'));
  const spec = raw.spec || raw;
  const S = SH.sceneBuild(spec, { over, garage: spec });
  return S;
}
const placedOf = S => JSON.stringify(((S.W.CAGE_ACCESS || {}).placed || []).map(q => [q.key, q.side, q.p.map(v => +v.toFixed(6))]));

// ---- the sheet's triangles, in metres, with the field ------------------------------------------------------------
function tris(S) {
  const m = S.built.sheet, FS = S.FS, out = [];
  for (const f of m.F) {
    if (f.v.length < 3 || f.v.some(i => !m.A[i])) continue;
    for (let t = 1; t + 1 < f.v.length; t++) {
      const ids = [f.v[0], f.v[t], f.v[t + 1]];
      out.push({ P: ids.map(i => m.V[i].map(x => x * FS)), A: ids.map(i => m.A[i]), mat: f.m });
    }
  }
  return out;
}
// the closest point of a triangle to p, with its barycentric weights
function closest(T, p) {
  const [a, b, c] = T.P;
  const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]], dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return { w: [1, 0, 0], q: a };
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return { w: [0, 1, 0], q: b };
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return { w: [1 - v, v, 0], q: [a[0] + ab[0] * v, a[1] + ab[1] * v, a[2] + ab[2] * v] }; }
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return { w: [0, 0, 1], q: c };
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return { w: [1 - w, 0, w], q: [a[0] + ac[0] * w, a[1] + ac[1] * w, a[2] + ac[2] * w] }; }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return { w: [0, 1 - w, w], q: [b[0] + (c[0] - b[0]) * w, b[1] + (c[1] - b[1]) * w, b[2] + (c[2] - b[2]) * w] }; }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  return { w: [1 - v - w, v, w], q: [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w] };
}
function onSheet(TR, p) {
  let best = null;
  for (const T of TR) {
    const r = closest(T, p);
    const d = Math.hypot(r.q[0] - p[0], r.q[1] - p[1], r.q[2] - p[2]);
    if (!best || d < best.d) best = { d, A: T.A[0].map((x, i) => x * r.w[0] + T.A[1][i] * r.w[1] + T.A[2][i] * r.w[2]) };
  }
  return best;
}
// the section's own extent at a field station: every triangle the iso-line sL crosses, the crossing points' heights
function sectionY(TR, sL, side) {
  let lo = Infinity, hi = -Infinity;
  for (const T of TR) {
    const s = T.A.map(a => a[0]);
    for (let e = 0; e < 3; e++) {
      const i = e, j = (e + 1) % 3;
      if ((s[i] - sL) * (s[j] - sL) > 0 || s[i] === s[j]) continue;
      const t = (sL - s[i]) / (s[j] - s[i]);
      const x = T.P[i][0] + (T.P[j][0] - T.P[i][0]) * t;
      if (side && x * side < -1e-3) continue;
      const y = T.P[i][1] + (T.P[j][1] - T.P[i][1]) * t;
      lo = Math.min(lo, y); hi = Math.max(hi, y);
    }
  }
  return isFinite(lo) && hi > lo ? [lo, hi] : null;
}

function run() {
  const T0 = Date.now();
  const base = build({});
  for (const e of base.errors) console.log('  (layer) ' + e);
  check(!base.errors.length, 'the Cub builds clean through the layers', base.errors.length + ' errors');
  const A = base.W.CAGE_ACCESS;
  check(!!(A && A.auto), 'the access layer publishes its auto sites (CAGE_ACCESS.auto)');

  // 1 AUTO IS UNTOUCHED
  const nulls = {};
  for (const k of Object.keys(A.auto || {})) { nulls['acc_' + k + '_z'] = null; nulls['acc_' + k + '_h'] = null; }
  const reset = build(nulls);
  check(placedOf(reset) === placedOf(base), '1 reset to auto (every hand row null) places every fitting exactly as no row does',
    (A.placed || []).length + ' placed');
  const saved = base.W.CAGE2.cageToSpec(base.P) || {};
  const handKeys = Object.keys(saved).filter(k => /^acc_.*_(z|h)$/.test(k));
  check(handKeys.length === 0, '1 the save of a build nobody placed by hand carries no hand row (old files byte-identical)', handKeys.join(','));
  check(!(A.placed || []).some(q => q.key === 'step') && !(A.rows || []).some(r => r.key === 'step'),
    '4 the Cub\'s step (the table does not fit one: sill under 0.62 m) is not drawn while nobody placed it');

  // 2 IT LANDS WHERE ASKED
  const hand = build(ASK);
  for (const e of hand.errors) console.log('  (layer) ' + e);
  const H = hand.W.CAGE_ACCESS, TR = tris(hand);
  const asked = {};
  for (const k in ASK) { const m = k.match(/^acc_(.*)_(z|h)$/); (asked[m[1]] || (asked[m[1]] = {}))[m[2]] = ASK[k]; }
  for (const key in asked) {
    const list = (H.placed || []).filter(q => q.key === key);
    check(list.length > 0, '2 ' + key + ' is placed by hand', list.length + ' sites');
    for (const q of list) {
      const s = onSheet(TR, q.p);
      const zAsk = asked[key].z + (BREAK.z || 0);
      check(s && s.d < 0.001, '2 ' + key + ' (' + q.side + ') stands on the skin', s ? (s.d * 1000).toFixed(2) + ' mm' : 'no sheet');
      if (!s) continue;
      const zGot = s.A[0] * hand.FS;
      check(Math.abs(zGot - zAsk) < 0.002, '2 ' + key + ' (' + q.side + ') stands at the asked fore/aft',
        'asked ' + zAsk.toFixed(3) + ' m, got ' + zGot.toFixed(4));
      if (asked[key].h != null) {
        const ys = sectionY(TR, s.A[0], q.p[0] >= 0 ? 1 : -1);
        const hGot = ys ? (q.p[1] - ys[0]) / (ys[1] - ys[0]) * 100 : NaN;
        const hAsk = asked[key].h + (BREAK.h || 0);
        check(Math.abs(hGot - hAsk) < 1.5, '2 ' + key + ' (' + q.side + ') stands at the asked height',
          'asked ' + hAsk + ' %, got ' + (+hGot).toFixed(2) + ' %');
      }
    }
  }
  check((H.placed || []).some(q => q.key === 'step') && (H.rows || []).some(r => r.key === 'step'),
    '4 placed by hand, the Cub\'s step is fitted (drawn, and in the layer\'s rows)');
  check(!(H.unplaced || []).length, '2 nothing unplaced with the hand rows set', (H.unplaced || []).map(r => r.key).join(','));

  // 3 NO SNAP - 10 mm aft is 10 mm aft
  const step2 = build(Object.assign({}, ASK, { acc_step_z: ASK.acc_step_z + 0.010 }));
  const p1 = (H.placed || []).find(q => q.key === 'step' && q.p[0] > 0);
  const p2 = (step2.W.CAGE_ACCESS.placed || []).find(q => q.key === 'step' && q.p[0] > 0);
  const moved = p1 && p2 ? Math.hypot(p2.p[0] - p1.p[0], p2.p[1] - p1.p[1], p2.p[2] - p1.p[2]) : NaN;
  check(Math.abs(moved - 0.010 * (BREAK.snap || 1)) < 0.003, '3 no snap: the step asked 10 mm further aft moves 10 mm',
    (moved * 1000).toFixed(2) + ' mm');

  // 5 THE ROWS
  const PG = base.W.CAGE_PAGE || {};
  const groups = PG.groupsOverride || PG.groups || [];
  const fit = groups.find(g => g[0] === '9 · fittings');
  const sub = fit && fit[1].find(r => Array.isArray(r) && r[0] === 'placement');
  check(!!sub && !(sub[2] && sub[2].level === 'expert') && !(fit[2] && fit[2].level === 'expert'),
    '5 the placement group is in the normal panel (not expert)');
  const rows = [];
  if (sub) for (const g of sub[1]) for (const r of g[1]) rows.push(r);
  const keys = Object.keys(base.W.GEN_ACCESS || {}).filter(k => (base.W.GEN_ACCESS[k].on !== 'cowl'));
  const missing = keys.filter(k => !rows.some(r => r[0] === 'acc_' + k + '_z') || !rows.some(r => r[0] === 'acc_' + k + '_h'));
  check(!missing.length, '5 every fitting (but the cowl\'s oil door) has its fore/aft and height rows', missing.join(','));
  check(rows.every(r => !(r[5] && r[5].level === 'expert') && !(r[6] && r[6].level === 'expert')), '5 no placement row is expert-only');
  const zRow = rows.find(r => r[0] === 'acc_doorHandle_z'), zOpt = zRow && (zRow[5] || zRow[6]);
  const fv = zOpt && typeof zOpt.follow === 'function' ? zOpt.follow() : null;
  const auto = (A.auto || {}).doorHandle || {};
  check(fv != null && Math.abs(fv - auto.z) < 1e-9, '5 a row follows its auto site (what unticking writes)',
    'follow ' + fv + ' auto ' + auto.z);
  console.log('  (' + ((Date.now() - T0) / 1000).toFixed(1) + ' s; the Cub\'s auto sites: ' +
    ['fuelCap', 'doorHandle', 'step'].map(k => k + ' ' + JSON.stringify((A.auto || {})[k])).join(', ') + ')');
}

if (SELFTEST) {
  // each judged row broken at its source; each must go red
  const cases = [['lands fore/aft', { z: 0.05 }], ['lands height', { h: 8 }], ['no snap', { snap: 3 }]];
  let ok = true;
  for (const [name, br] of cases) {
    Object.keys(BREAK).forEach(k => delete BREAK[k]); Object.assign(BREAK, br);
    fail.length = 0; n = 0;
    run();
    const red = fail.length > 0;
    console.log('SELFTEST ' + name + ': ' + (red ? 'red (good)' : 'STILL GREEN'));
    ok = ok && red;
  }
  console.log('GATE FITMANUAL SELFTEST: ' + (ok ? 'PASS' : 'FAIL'));
  process.exit(ok ? 0 : 1);
}
run();
console.log(n + ' checks');
console.log('GATE FITMANUAL: ' + (fail.length ? 'FAIL (' + fail.length + ')' : 'PASS'));
process.exit(fail.length ? 1 : 0);
