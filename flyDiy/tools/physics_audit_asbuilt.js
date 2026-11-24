#!/usr/bin/env node
// PHYSICS AUDIT - AS BUILT (22 Nov 2026): the real-figures reading of every live plane at each stage the branch
// committed, side by side, from real_check's own JSONs (reports/evidence/PHYSICS-AUDIT-2026-11-21/<stage>/<key>.json).
// real_check reads a figure at the reference's stated weights: one weight gives one number, a range of weights (a book
// that does not say at which weight) gives the model's range over them. The error here is against the MIDDLE of the
// reference's range, from the nearest point of the model's range (a single number when the weight is stated; 0 when the
// reference's middle lies inside the model's range). The verdict marks are real_check's own (~ near, ! outside).
//   node tools/physics_audit_asbuilt.js [--dir=reports/evidence/PHYSICS-AUDIT-2026-11-21] [--stages=rc,step0,step4,step6] [--md]
'use strict';
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const DIR = path.resolve(opt('dir', path.join(__dirname, '..', 'reports', 'evidence', 'PHYSICS-AUDIT-2026-11-21')));
const STAGES = opt('stages', 'rc,step0,step4,step6').split(',');
const TIER1 = ['c172v2', 'etrainer', 'pc6', 'dc3r', 'tigermothm', 'cub', 'carboncubss'];
const FIG = ['Vs1', 'V75', 'Vmax', 'roc', 'LD', 'TO'];
const mid = a => (a[0] + a[1]) / 2;
function at(v) {                                   // the model's figure nearest the reference's middle, within its range
  if (!v || !v.ours || v.ours[0] == null) return null;
  const lo = Math.min(v.ours[0], v.ours[1]), hi = Math.max(v.ours[0], v.ours[1]);
  return Math.max(lo, Math.min(hi, mid(v.ref)));
}
const load = (st, k) => { try { return JSON.parse(fs.readFileSync(path.join(DIR, st, k + '.json'), 'utf8')); } catch (e) { return null; } };
const keys = fs.readdirSync(path.join(DIR, STAGES[STAGES.length - 1])).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
const rows = [], cnt = {}, mae = {};
for (const st of STAGES) { cnt[st] = { inside: 0, near: 0, outside: 0 }; mae[st] = { all: {}, tier1: {} }; }
for (const k of keys) {
  const J = {}; for (const st of STAGES) J[st] = load(st, k);
  const last = J[STAGES[STAGES.length - 1]];
  for (const st of STAGES) if (J[st]) for (const v of J[st].verdicts) if (v.verdict in cnt[st]) cnt[st][v.verdict]++;
  for (const q of FIG) {
    const vl = last.verdicts.find(v => v.k === q && /^airframe/.test(v.src)); if (!vl) continue;
    const r = { key: k, short: last.label, fig: q, ref: vl.ref, kg: vl.kg && vl.kg[1], st: {} };
    for (const st of STAGES) {
      const v = J[st] && J[st].verdicts.find(x => x.k === q && /^airframe/.test(x.src)); const x = at(v);
      if (x == null) continue;
      const e = (x / mid(v.ref) - 1) * 100;
      r.st[st] = { v: x, err: e, verdict: v.verdict };
      for (const [g, on] of [['all', true], ['tier1', TIER1.includes(k)]]) if (on) (mae[st][g][q] = mae[st][g][q] || []).push(Math.abs(e));
    }
    rows.push(r);
  }
}
const f = (x, q) => x == null ? '-' : (q === 'roc' || q === 'LD' ? x.toFixed(2) : x.toFixed(0));
const mark = v => v === 'near' ? '~' : v === 'outside' ? '!' : '';
const cell = (c, q) => c ? f(c.v, q) + ' (' + (c.err >= 0 ? '+' : '') + c.err.toFixed(0) + mark(c.verdict) + ')' : '-';
console.log('| plane | figure | reference | ' + STAGES.join(' | ') + ' |'); console.log('|---|---|---|' + STAGES.map(() => '---|').join(''));
let prev = '';
for (const r of rows) {
  console.log('| ' + (r.key === prev ? '' : r.key) + ' | ' + r.fig + ' | ' + (r.ref[0] === r.ref[1] ? f(r.ref[0], r.fig) : f(r.ref[0], r.fig) + '-' + f(r.ref[1], r.fig)) + ' | ' + STAGES.map(st => cell(r.st[st], r.fig)).join(' | ') + ' |');
  prev = r.key;
}
const avg = a => a && a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(0) + ' % (' + a.length + ')' : '-';
for (const g of ['tier1', 'all']) {
  console.log('\nmean absolute error, ' + (g === 'tier1' ? 'the seven best-documented planes' : 'all ' + keys.length + ' live planes') + ' (rows)');
  console.log('| figure | ' + STAGES.join(' | ') + ' |'); console.log('|---|' + STAGES.map(() => '---|').join(''));
  for (const q of FIG) console.log('| ' + q + ' | ' + STAGES.map(st => avg(mae[st][g][q])).join(' | ') + ' |');
}
console.log('\n| verdicts (inside / near / outside), every scored row | ' + STAGES.map(st => cnt[st].inside + ' / ' + cnt[st].near + ' / ' + cnt[st].outside).join(' | ') + ' |');
