#!/usr/bin/env node
// tank_refit_apply.js - WRITE THE FITTED STOCK TANKS (G1109, CUB-COCKPIT 2026-10-01)
//
// Reads tools/tank_refit.js's table (--in) and the bay probe's deck-form
// estimates (--deck: { key: { bay: { fuel } } }, from tank_bay_probe --json),
// and rewrites the STOCK_TANKS table in tools/_cage_design.js:
//   a refitted body vessel SHIPS when its capacity meets the design's, or
//   reaches within 15 % of what a deck-following tank could hold in that bay
//   (new >= min(design, deck) / 1.15) - A0's split of the user's ruling
//   ("the capacity is whatever truly fits"; the deck form IS what fits);
//   otherwise it is HELD for the deck form (G1150-G1154) and the card keeps
//   G1108's state (its tank not drawn while it does not fit).
// The card's whole vessel list is written (wing tanks and the rest untouched,
// in order), so `over.tanks` replaces the list the birth spec would seed.
//
//   node tools/tank_refit_apply.js --in refit.json --deck deck.json [--dry]
'use strict';
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const T = __dirname;
const FILE = path.join(T, '_cage_design.js');
const table = JSON.parse(fs.readFileSync(opt('in'), 'utf8'));
const deck = opt('deck') ? JSON.parse(fs.readFileSync(opt('deck'), 'utf8')) : {};
const BJ = require(path.join(T, '_bake_joined.js'));
const { D, C } = BJ.loadPanel();
const out = {}, report = [];
for (const t of table) {
  if (!t || !t.vessels) continue;
  const a = D.ARCHETYPES.find(x => x.key === t.key);
  if (!a) continue;
  // the card's own list, WITHOUT any tanks this table wrote before (idempotent)
  const over0 = Object.assign({}, a.over || {}); delete over0.tanks;
  const birth = C.genNormaliseSpec(D.designBake(a.sel, Object.keys(over0).length ? over0 : undefined));
  const list = JSON.parse(JSON.stringify((birth.energy && birth.energy.vessels) || []));
  let changed = false;
  for (const v of t.vessels) {
    const row = { key: t.key, i: v.i, bay: v.bay, design: v.design, how: v.how, new: v.new ? v.new.capacity : null };
    if (!(v.design > 0.5)) { row.verdict = 'no tank (0 capacity): skipped'; report.push(row); continue; }
    if (v.how === 'kept' || !v.new) { row.verdict = v.how === 'kept' ? 'fits as it is' : 'nothing fits: HELD'; report.push(row); continue; }
    const dk = deck[t.key] && deck[t.key][v.bay] && deck[t.key][v.bay].fuel;
    row.deck = dk != null ? dk : null;
    const target = Math.min(v.design, dk != null ? dk : v.design);
    const ships = v.new.capacity >= v.design - 0.05 || v.new.capacity >= target / 1.15;
    row.verdict = ships ? 'SHIPS' : 'HELD for the deck form';
    report.push(row);
    if (!ships || !list[v.i]) continue;
    Object.assign(list[v.i], { bay: v.bay, capacity: v.new.capacity, along: v.new.along, lv: v.new.lv,
                               rot: v.new.rot, form: v.new.form, dims: v.new.dims });
    changed = true;
  }
  if (changed) out[t.key] = list.map(v => {
    const o = { bay: v.bay, capacity: v.capacity };
    for (const k of ['along', 'lv', 'rot', 'form', 'dims']) if (v[k] != null) o[k] = v[k];
    return o;
  });
}
for (const r of report) console.log('  ' + r.key.padEnd(14) + ' #' + r.i + ' ' + String(r.bay).padEnd(9) + ' design ' + r.design + ' L, fitted ' + r.new + ', deck form ' + r.deck + '  -> ' + r.verdict);
const body = Object.keys(out).map(k => '  ' + k + ': ' + JSON.stringify(out[k]) + ',').join('\n');
let s = fs.readFileSync(FILE, 'utf8');
const a0 = s.indexOf('const STOCK_TANKS = {\n'), a1 = s.indexOf('\n};\n', a0);
if (a0 < 0 || a1 < 0) throw new Error('STOCK_TANKS table not found');
s = s.slice(0, a0) + 'const STOCK_TANKS = {\n' + body + s.slice(a1);
if (!argv.includes('--dry')) fs.writeFileSync(FILE, s);
console.log((argv.includes('--dry') ? '(dry) ' : '') + Object.keys(out).length + ' cards written to STOCK_TANKS');
if (opt('report')) fs.writeFileSync(opt('report'), JSON.stringify(report, null, 1));
