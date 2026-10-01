#!/usr/bin/env node
// tank_refit_physics.js - WHAT THE REFIT MOVES, PER DESIGN (G1109, CUB-COCKPIT 2026-10-01)
//
// Reads tools/tank_refit.js's table and, for every stock design whose default
// body tank was refitted, compares the card AS THE FLIGHT GATES FLY IT (its
// birth spec: `fuel.litres` lifted to a nose vessel at along 0, lv 1 - what
// GATE ARCHETYPES and the pilot matrix build) with the same card carrying the
// fitted vessel (capacity, station, level, form, dims - what the layer will
// draw and bill). Per design:
//   fuel     litres and kilos (the shakedown's mass, full minus dry)
//   CG       full and empty (dry tanks), m and % MAC, and the shift
//   margin   the aft-most corner's static margin (the envelope)
//   reach    cruise endurance (h) and still-air range (km) where reported
// A design whose CG leaves its own envelope's sense (the static margin at the
// aft corner going negative) is FLAGGED: the user's rule, a worse flight does
// not ship silently.
//
//   node tools/tank_refit_physics.js --in refit.json [--json out.json]
'use strict';
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const T = __dirname;
const BJ = require(path.join(T, '_bake_joined.js'));
const { D, C } = BJ.loadPanel();
const table = JSON.parse(fs.readFileSync(opt('in'), 'utf8'));
const rows = [];
const read = S => {
  const def = C.buildGen(S);
  const sh = C.genShakedown(def);
  const dry = C.genShakedown(C.buildGen(C.genSpecAtFuel(def.spec, 0)), { slim: true });
  const env = sh.envelope || {};
  const full = (env.corners || [])[0] || {};
  const xLE = full.cgPct != null && sh.cBar > 0 ? full.cgX - full.cgPct * sh.cBar : null;
  const pct = x => xLE == null ? null : (x - xLE) / sh.cBar;
  return { mass: sh.mass, dryMass: dry.mass, cgX: sh.cgX, cgPct: pct(sh.cgX), dryCgX: dry.cgX, dryCgPct: pct(dry.cgX),
           smAft: env.staticMarginAft, endH: sh.enduranceCruiseH, rangeKm: sh.rangeKm, litres: def.spec.fuel && def.spec.fuel.litres };
};
for (const t of table) {
  if (!t || !t.vessels) continue;
  const moved = t.vessels.filter(v => v.new && v.how !== 'kept');
  const none = t.vessels.filter(v => v.how === 'none');
  if (!moved.length && !none.length) { rows.push({ key: t.key, how: 'kept' }); continue; }
  const card = D.ARCHETYPES.find(a => a.key === t.key);
  // BEFORE: the card without the refit (its over.tanks taken out - what the
  // flight gates flew until now); AFTER: the card as it stands (STOCK_TANKS)
  const over0 = Object.assign({}, card.over || {}); delete over0.tanks;
  const S0 = C.genNormaliseSpec(D.designBake(card.sel, Object.keys(over0).length ? over0 : undefined));
  const S1 = C.genNormaliseSpec(D.designBake(card.sel, card.over));
  if (!(card.over && card.over.tanks)) { rows.push({ key: t.key, how: 'not applied' }); continue; }
  let a = null, b = null, err = null;
  try { a = read(S0); b = read(S1); } catch (e) { err = String(e && e.message || e).split('\n')[0]; }
  const row = { key: t.key, how: moved.map(v => v.how).join(',') || 'none', vessels: t.vessels.map(v => ({ design: v.design, old: v.old.capacity, new: v.new && v.new.capacity, shift: v.shift })), err };
  if (a && b) {
    const mm = x => x == null ? null : +(x * 1000).toFixed(0), pc = x => x == null ? null : +(x * 100).toFixed(1);
    Object.assign(row, {
      litres: [a.litres, b.litres], fuelKg: [+(a.mass - a.dryMass).toFixed(1), +(b.mass - b.dryMass).toFixed(1)],
      cgFull_mm: mm(b.cgX - a.cgX), cgFullPct: [pc(a.cgPct), pc(b.cgPct)],
      cgDry_mm: mm(b.dryCgX - a.dryCgX), cgDryPct: [pc(a.dryCgPct), pc(b.dryCgPct)],
      smAft: [a.smAft == null ? null : +a.smAft.toFixed(3), b.smAft == null ? null : +b.smAft.toFixed(3)],
      endH: [a.endH == null ? null : +a.endH.toFixed(2), b.endH == null ? null : +b.endH.toFixed(2)],
      rangeKm: [a.rangeKm == null ? null : Math.round(a.rangeKm), b.rangeKm == null ? null : Math.round(b.rangeKm)],
    });
    row.flag = (b.smAft != null && b.smAft < 0 && !(a.smAft != null && a.smAft < 0)) ? 'aft corner unstable' : null;
  }
  rows.push(row);
  console.log('  ' + t.key.padEnd(14) + (row.err ? 'ERR ' + row.err : (row.litres ? row.litres.join(' -> ') + ' L, ' + row.fuelKg.join(' -> ') + ' kg; CG full ' + row.cgFull_mm + ' mm (' + row.cgFullPct.join(' -> ') + ' %MAC), dry ' + row.cgDry_mm + ' mm; SM aft ' + row.smAft.join(' -> ') + '; endurance ' + row.endH.join(' -> ') + ' h, range ' + row.rangeKm.join(' -> ') + ' km' + (row.flag ? '  FLAG: ' + row.flag : '') : row.how)));
}
if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify(rows, null, 1));
