#!/usr/bin/env node
// PRICE-STUDY, revision 3 (the user, 4 Nov: "a base calculation, and factors on prices depending on plane age ... just
// degrade the multiplier as a function of age ... an easy first step"). A STUDY TOOL: nothing in the game changes.
//
//   node futureDesigns/price-study/age_curve.js     (reads price_study_data.json; writes age_curve.json)
//
// ONE BASE, ONE CURVE:
//   V0        the NEW value = the catalogue = ledger x PROCURE_MARGIN 1.15 (what a maker would charge new)
//   f(age)    1 at age 0 (new); used: s x (floor + (1 - floor) x exp(-age / tau))
//               s      the first-resale step (a plane that has left the maker is a used plane: the dealer spread)
//               floor  the vintage plateau (a flyable old aeroplane keeps a value; a collector type may hold more)
//               tau    how fast the rest goes, in years
//   used      V0 x f(age) x (1 - the condition deductions the listing already draws: a repair 0.08, an older panel 0.03,
//             the extra kilos 0.04 x kg/15)
//   sell      min(0.75 x the used value at the airframe's age and condition, what the player paid)
//   build     ledger x labour (0.8 / 1.0): the maker way, unchanged
// The curve is fitted (least squares in log) on the new-vs-used pairs of the SAME type the research found
// (USD, 2025-26 asking prices); `s` is held at 0.8, the middle of the real 15-25 % dealer spread.
'use strict';
const fs = require('fs'), path = require('path');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, 'price_study_data.json'), 'utf8'));
const gm = (a, b) => Math.sqrt(a * b);
// [what, age in years, used [lo, hi], new [lo, hi]]
const PAIRS = [
  ['C172S NXi (2016+) vs a new 172S',   7.5, [250e3, 380e3], [499e3, 580e3]],
  ['C172S (2000s) vs a new 172S',       20,  [230e3, 350e3], [499e3, 580e3]],
  ['C172M/N (1970s) vs a new 172S',     50,  [95e3, 150e3],  [499e3, 580e3]],
  ['208B (2000s) vs a new 208B EX',     22,  [0.7e6, 1.5e6], [2.6e6, 2.9e6]],
];
// excluded, and said so: the 208B EX of 2019-22 listed at 3.0-3.25M, ABOVE the new list (a post-2020 supply squeeze,
// the market's level moving, not an age effect); the J-3 against a new Cub-class (a 65 hp 1946 type against a 180 hp
// carbon one is not the same aeroplane)
const EXCLUDED = ['208B EX (2019-22) at 3.0-3.25M used vs 2.69M new: above 1, a supply squeeze, not age',
                  'J-3 ($45-65k) vs a new Cub-class ($250-295k): not the same aeroplane'];
const S = 0.8;
const f = (age, p) => age <= 0 ? 1 : S * (p.floor + (1 - p.floor) * Math.exp(-age / p.tau));
let best = null;
for (let fl = 0.05; fl <= 0.5; fl += 0.01) for (let tau = 3; tau <= 60; tau += 0.5) {
  const p = { floor: +fl.toFixed(2), tau };
  const e = PAIRS.reduce((a, [, age, u, n]) => a + Math.pow(Math.log((gm(...u) / gm(...n)) / f(age, p)), 2), 0);
  if (!best || e < best.e) best = { e, p };
}
const P = best.p, rms = Math.exp(Math.sqrt(best.e / PAIRS.length));
const fit = PAIRS.map(([w, age, u, n]) => ({ what: w, age, real: +(gm(...u) / gm(...n)).toFixed(2), curve: +f(age, P).toFixed(2) }));
// the game's used band today (catalogue x 0.4-0.8) in ages: f(age) = 0.8 ... 0.4
const ageAt = v => { for (let a = 0.5; a <= 200; a += 0.5) if (f(a, P) <= v) return a; return null; };
const band = { ageAt08: 0, ageAt06: ageAt(0.6), ageAt04: ageAt(0.4), floorValue: +(S * P.floor).toFixed(2) };
// the official planes at a few ages (credits, today's ledgers and the corrected ones)
const AGES = [0, 2, 5, 10, 20, 30, 40, 60];
const R100 = v => Math.round(v / 100) * 100;
const planes = ['cub', 'jodel', 'birdman', 'chinook', 'c172m', 'c172f', 'tiger'].map(id => {
  const p = D.planes.find(x => x.id === id), q = D.proposal.planes.find(x => x.id === id);
  if (!p) return null;
  const row = L => ({ build: R100(0.8 * L), byAge: Object.fromEntries(AGES.map(a => [a, R100(1.15 * L * f(a, P))])) });
  return { id, label: p.label, now: row(p.prices.ledger), corrected: q ? row(q.ledger) : null };
}).filter(Boolean);
const out = { what: 'PRICE-STUDY rev 3: one base (V0 = ledger x 1.15), one age curve', s: S, floor: P.floor, tau: P.tau, rmsFactor: +rms.toFixed(2),
              fit, excluded: EXCLUDED, band, ages: AGES, planes };
console.log('f(age) = ' + S + ' x (' + P.floor + ' + ' + (1 - P.floor).toFixed(2) + ' x exp(-age / ' + P.tau + ')), f(0) = 1;  rms factor ' + rms.toFixed(2));
for (const r of fit) console.log('  ' + r.what.padEnd(38), 'age', String(r.age).padStart(4), ' real', r.real, ' curve', r.curve);
console.log('  the game\'s used band 0.8-0.4 of the catalogue = ages 0-' + band.ageAt04 + ' (0.6 at ' + band.ageAt06 + '); the floor is ' + band.floorValue);
console.log('\nV0 x f(age), corrected ledgers (credits): ' + AGES.join(' / ') + ' years');
for (const p of planes) console.log('  ' + p.label.padEnd(32), 'build ' + p.corrected.build, '|', AGES.map(a => p.corrected.byAge[a]).join(' / '));
fs.writeFileSync(path.join(__dirname, 'age_curve.json'), JSON.stringify(out, null, 1));
