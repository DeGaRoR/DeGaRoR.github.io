#!/usr/bin/env node
// GATE WEIGHT (PERF STUDY chantier 1, 2026-09-15) — the recreation cards'
// EMPTY WEIGHT against their types, held in bands. The perf study (G396.5,
// futureDesigns/PERF-STUDY-2026-09-15.md §4.1) found the mass model did not
// scale: the fuselage weighed 43-47 kg on every card from the Cub to the
// Caravan because every structural row was a constant of the material. The
// gauge (GEN_GAUGE, genDesignGross) is the fix, and this is its ratchet:
// every card in the table below is built from its JOINED spec (the birth
// spec with the join's measurements over it, tools/_bake_joined.js — the
// aeroplane the game flies; GATE ARCHETYPES flies the birth spec) and its ledger's empty
// weight — structure, engines, systems, outfit, paint — must sit inside the
// declared band around the POH's figure. The bands are DECLARED, and they
// only ever tighten; a card that leaves its band is a model change, not a
// number to move.
//   node tools/_weight_check.js             -> the battery
//   node tools/_weight_check.js --selftest  -> negative verification (a
//                                              doctored number must go red)
//   node tools/_weight_check.js --table     -> the table, no verdict
// The per-class bands hold the SHAPE of the ledger: the gear at 2-9 % of the
// design gross (Raymer: 4-6 % of W0 on a fixed gear; ours run light on the
// big cards), the structure (fuselage + wings + bracing + tail + gear) at
// 40-72 % of the empty weight (a light aeroplane's 50-65: the engine is the
// other lump).
'use strict';
const path = require('path');
const T = __dirname;

// the JOINED bake (tools/_bake_joined.js): the card as the game flies it,
// the join's measured cabin, seats, profile, gear and tail over the birth
// spec — the birth spec alone flies every card on GEN_DEFAULT's Cub cabin
const BJ = require(path.join(T, '_bake_joined.js'));
const { D, C } = BJ.loadPanel();

// THE TABLE: the type's published empty weight (kg) and the band (+-) the
// card is held in. The seven engine-matched cards the study ranked, at the
// study's +-15 %; the big certified cards at a wider DECLARED band — their
// real empties carry cargo floors, de-ice, big-engine accessories and an
// interior this outfit has no row for — to be ratcheted as they close.
const TABLE = {
  cub:       { real: 345,  band: 0.15, src: 'J-3C-65: 308-345 published; 345 with the 65 hp' },
  pietenpol: { real: 280,  band: 0.25, src: 'Air Camper (A-65): 250-300 by builder' },
  jodel:     { real: 360,  band: 0.15, src: 'D.119: 360' },
  c172:      { real: 736,  band: 0.15, src: '172R: 736 (1620 lb) standard empty' },
  rv:        { real: 500,  band: 0.15, src: 'RV-7 (IO-360, fixed pitch): 490-510' },
  // the Savannah-alike: an alloy ULM built to an ultralight standard — 0.4
  // mm skins, pop rivets, no fatigue life — that weighs ~35 % less than a
  // certified alloy aeroplane of its size, and the model has no BUILD
  // STANDARD row (it would be seeded by the class at birth as systems.fit
  // is, and the load test would read it too); measured +29 % with the
  // certified rows at their gauge. The row is owed; the band says so.
  savannah:  { real: 300,  band: 0.35, src: 'Savannah S (912): 295-305' },
  tigermoth: { real: 506,  band: 0.15, src: 'DH.82A: 506' },
  stearman:  { real: 878,  band: 0.15, src: 'PT-17 (W-670): 878' },
  beaver:    { real: 1361, band: 0.30, src: 'DHC-2 (R-985): 1361; wheels, no floats' },
  // the Caravan-alike: a utility-category aeroplane whose real empty carries
  // a cargo floor and tie-downs, a belly pod, de-ice boots, oxygen, dual
  // avionics and an interior for ten — ~500 kg of items the outfit has no
  // row for. Measured -45 % (from -74 before the gauge); Raymer's own
  // fuselage equation under-predicts this type by a third. Ratchet as the
  // rows land.
  caravan:   { real: 2145, band: 0.50, src: '208 (PT6A-114A): 2145 typical equipped' },
  // the MW5-alike: a 160 kg microlight built to the same ultralight
  // standard as the Savannah (the BUILD STANDARD row above is its lever
  // too); measured +33 % with the certified rows at their gauge
  mw5:       { real: 160,  band: 0.45, src: 'MW5 Sorcerer (503): 160' },
};
// MEASURED on the eleven cards (2026-09-15): the structure is 53-66 % of
// the empty weight on every one (the engine is the other big lump: a J-3's
// 195 kg of structure over 345 is 56 %); the gear 2-7 % of the design gross
// (the big cards' gear is light — a Caravan's real gear is 4 %, ours 2.3;
// the bush tyres and the oleos are owed)
const SHAPE = { gearFrac: [0.02, 0.09], structFrac: [0.40, 0.72] };

const args = process.argv.slice(2);
const fails = [];
const ok = (cond, label, extra) => {
  console.log((cond ? '  ok     ' : '  FAIL   ') + label + (cond || !extra ? '' : ' — ' + extra));
  if (!cond) fails.push(label);
  return cond;
};
const f0 = v => (+v).toFixed(0);

function measure(key) {
  const bj = BJ.bakeCard(key);
  if (!bj) return null;
  const spec = bj.spec;
  const def = C.buildGen(spec);
  const L = def.parts.ledger || {};
  let empty = 0, payload = 0;
  for (const k in L) { if (L[k].payload) payload += L[k].mass; else empty += L[k].mass; }
  const struct = ['fuselage', 'wings', 'bracing', 'tail', 'gear'].reduce((t, k) => t + ((L[k] && L[k].mass) || 0), 0);
  return { key, empty, payload, struct, gear: (L.gear && L.gear.mass) || 0,
           W0: def.parts.designGross, gauge: def.parts.gauge || {}, ledger: L,
           seats: spec.cabin && spec.cabin.seats, fuelL: spec.fuel && spec.fuel.litres, joinErrs: bj.errors };
}

// the checks as named functions over plain numbers, so --selftest can doctor
const CHECKS = {
  inBand: (m, R) => Math.abs(m.empty / R.real - 1) <= R.band,
  gearFrac: m => m.W0 > 0 && m.gear / m.W0 >= SHAPE.gearFrac[0] && m.gear / m.W0 <= SHAPE.gearFrac[1],
  structFrac: m => m.struct / m.empty >= SHAPE.structFrac[0] && m.struct / m.empty <= SHAPE.structFrac[1],
  gaugeSane: m => Object.keys(m.gauge).filter(c => c !== 'W0').every(c => m.gauge[c] >= C.GEN_GAUGE.lo && m.gauge[c] <= C.GEN_GAUGE.hi),
  grossOverEmpty: m => m.W0 > m.empty + 60,          // at least one person and some fuel
};

if (args.includes('--selftest')) {
  // a doctored number must go red on every check
  const m = measure('cub'), R = TABLE.cub;
  const cases = [
    ['inBand (light by 40 %)', () => !CHECKS.inBand(Object.assign({}, m, { empty: R.real * 0.6 }), R)],
    ['inBand (heavy by 40 %)', () => !CHECKS.inBand(Object.assign({}, m, { empty: R.real * 1.4 }), R)],
    ['gearFrac (a 20 % gear)', () => !CHECKS.gearFrac(Object.assign({}, m, { gear: 0.2 * m.W0 }))],
    ['structFrac (an 85 % structure)', () => !CHECKS.structFrac(Object.assign({}, m, { struct: 0.85 * m.empty }))],
    ['gaugeSane (a gauge of 5)', () => !CHECKS.gaugeSane(Object.assign({}, m, { gauge: { fus: 5 } }))],
    ['grossOverEmpty (gross = empty)', () => !CHECKS.grossOverEmpty(Object.assign({}, m, { W0: m.empty }))],
  ];
  let pass = true;
  for (const [nm, fn] of cases) {
    const c = fn(); pass = pass && c;
    console.log('  selftest ' + nm.padEnd(38) + ' ' + (c ? 'CAUGHT' : 'MISSED'));
  }
  console.log('GATE WEIGHT: ' + (pass ? 'PASS' : 'FAIL (selftest)'));
  process.exit(pass ? 0 : 1);
}

console.log('| card | empty ours / real | band | seats / fuel L | design gross | gauge fus/wing/tail/gear | gear % W0 | structure % empty |');
for (const key of Object.keys(TABLE)) {
  const R = TABLE[key];
  let m;
  try { m = measure(key); } catch (e) { ok(false, key + ' builds', e.message); continue; }
  if (!m) { ok(false, key + ' is an archetype'); continue; }
  const g = m.gauge;
  console.log('| ' + key.padEnd(10) + ' | ' + f0(m.empty) + ' / ' + R.real + ' (' + ((m.empty / R.real - 1) * 100).toFixed(0) +
              ' %) | +-' + (R.band * 100).toFixed(0) + ' % | ' + (m.seats || '-') + ' / ' + f0(m.fuelL || 0) + ' | ' + f0(m.W0) + ' | ' +
              ['fus', 'wing', 'tail', 'gear'].map(c => (g[c] || 1).toFixed(2)).join('/') +
              ' | ' + (100 * m.gear / m.W0).toFixed(1) + ' | ' + (100 * m.struct / m.empty).toFixed(0) + ' |');
  if (args.includes('--table')) continue;
  ok(CHECKS.inBand(m, R), key + ': empty ' + f0(m.empty) + ' kg within ' + (R.band * 100).toFixed(0) + ' % of ' + R.real +
     ' (' + R.src + ')', ((m.empty / R.real - 1) * 100).toFixed(0) + ' %');
  ok(CHECKS.gearFrac(m), key + ': the gear is 2-9 % of the design gross', (100 * m.gear / m.W0).toFixed(1) + ' %');
  ok(CHECKS.structFrac(m), key + ': the structure is 40-72 % of the empty weight', (100 * m.struct / m.empty).toFixed(0) + ' %');
  for (const e of m.joinErrs || []) console.log('         JOIN ' + key + ': ' + e);
  ok(CHECKS.gaugeSane(m), key + ': every gauge inside GEN_GAUGE\'s clamp');
  ok(CHECKS.grossOverEmpty(m), key + ': the design gross carries a load over the empty weight');
}
if (!args.includes('--table')) {
  console.log('GATE WEIGHT: ' + (fails.length ? 'FAIL (' + fails.length + ')' : 'PASS'));
  process.exit(fails.length ? 1 : 0);
}
