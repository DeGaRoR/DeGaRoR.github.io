#!/usr/bin/env node
//   node tools/_livery_reach_check.js   -> "GATE LIVERYREACH: PASS|FAIL"
//
// GATE LIVERYREACH (G1320, the user: "changing the aircraft's global colour
// leaves the Cub's rudder in its old colour").
//
// The bench's `base colour` pick runs AEROSKIN's aeroBaseReach over the
// build's tint map. For every stock build (the Cub, the Jodel, the Cessna)
// and every section the spec can paint — the cage's exterior sections, every
// AERO_SEC layer section, every section the spec's finish names — this
// resolves the colour each section WEARS before and after a pick, the way
// the layers resolve it (aeroSecResolve for a layer, the override for a cage
// section), and requires:
//   rule 1  a section that wore the old base wears the new one — an
//           override equal to it, or no override anywhere up a chain that
//           ends at the body (a strut wearing the fuselage's paint);
//   rule 2  a section whose override chain gave it a colour of its own
//           keeps it.
// NEGATIVE-VERIFIED: the pre-G1320 reach (the layer step dropped) must FAIL
// rule 1 on the Cub's rudder, or the check proves nothing.
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
global.window = {};
require(path.join(__dirname, '_cage_page5.js'));
const A = require(path.join(ROOT, 'src', 'viewer', 'aeroskin.js'));

let fails = 0, passes = 0;
const ok = (c, msg) => { if (c) passes++; else { fails++; console.log('FAIL ' + msg); } };
const hex = v => v == null ? 'none' : '#' + (v >>> 0).toString(16).padStart(6, '0');
const EQ = (a, b) => (a >>> 0) === (b >>> 0);

// the pre-G1320 reach, kept here only to prove the check bites
function oldReach(map, prev, next, neutral, eq, names) {
  const same = (a, b) => a == null ? b == null : (b != null && eq(a, b));
  const following = k => map[k] == null || same(map[k], prev);
  const put = k => { if (!following(k)) return;
    if (next == null || (neutral != null && eq(next, neutral))) delete map[k]; else map[k] = next; };
  for (const nm of names) if (['skin', 'rail', 'pillar'].includes(A.AERO_ROLE[nm])) put(nm);
  put('body');
  for (const k in A.AERO_SEC)
    if ((A.AERO_SEC[k].wears === 'parent' || A.AERO_SEC[k].finFollows) && map[k] != null && same(map[k], prev))
      delete map[k];
  return map;
}

const CAGE = Object.keys(A.AERO_ROLE).filter(k => ['skin', 'rail', 'pillar'].includes(A.AERO_ROLE[k]));
function chainOf(sec) {
  // a row that keeps its own colour (G451's tintOwn: the float's deck)
  // walks its own name only, as the resolver does
  if (A.AERO_SEC[sec] && A.AERO_SEC[sec].tintOwn) return [sec];
  const ch = [];
  for (let s = sec; s != null && ch.length < 9; s = A.AERO_SEC[s] ? A.AERO_SEC[s].parent : null) ch.push(s);
  return ch;
}
const overridden = (map, sec) => chainOf(sec).some(s => map[s] != null);
function wears(map, sec, cons) {
  if (A.AERO_SEC[sec]) return A.aeroSecResolve(sec, { tint: map }, { cons }).tint;
  return map[sec] != null ? map[sec] : null;
}
// one pick on one build; returns the list of rule breaks
function pick(spec, reach, NEW, cons) {
  const secs = (spec.finish && spec.finish.sections) || {};
  const map = {};
  for (const k in secs) if (secs[k] && secs[k].tint != null) map[k] = secs[k].tint;
  const prev = map.body != null ? map.body : A.AERO_FINISH[A.aeroFinishFor('body', cons)].base;
  const all = Array.from(new Set([].concat(CAGE, Object.keys(A.AERO_SEC), Object.keys(secs))));
  const before = {}, own = {}, follows = {};
  for (const s of all) {
    before[s] = wears(map, s, cons);
    own[s] = overridden(map, s);
    follows[s] = own[s] ? (before[s] != null && EQ(before[s], prev))
                        : chainOf(s).includes('body') || CAGE.includes(s);
  }
  reach(map, prev, NEW, null, EQ, CAGE);
  map.body = NEW;
  const bad = [];
  for (const s of all) {
    const b = before[s], a = wears(map, s, cons);
    if (follows[s] && !(a != null && EQ(a, NEW)))
      bad.push(s + ' wore the base ' + hex(prev) + ', still ' + hex(a) + ' (rule 1)');
    else if (own[s] && !follows[s] && !(a != null && EQ(a, b)))
      bad.push(s + ' wore its own ' + hex(b) + ', now ' + hex(a) + ' (rule 2)');
  }
  return { bad, n: all.length, prev };
}

const B = window.CAGE_PAGE.builds;
// the construction each stock build is drawn in (its finish bottom-out)
const STOCK = { cub: ['piper cub', 'tubeFabric'], jodel: ['jodel D112', 'wood'],
                cessna: ['cessna 172', 'alloy'] };
const NEW = 0x2255cc;
for (const [tag, [key0, cons]] of Object.entries(STOCK)) {
  const key = Object.keys(B).find(k => k.toLowerCase() === key0.toLowerCase());
  ok(!!key, tag + ': stock build "' + key0 + '" found');
  if (!key) continue;
  const r = pick(B[key], A.aeroBaseReach, NEW, cons);
  for (const m of r.bad) ok(false, tag + ': ' + m);
  if (!r.bad.length) passes++;
  console.log(tag + ': base ' + hex(r.prev) + ' -> ' + hex(NEW) + ' over ' + r.n +
              ' sections: ' + (r.bad.length ? r.bad.length + ' wrong' : 'every section right'));
}
// the negative: the old reach leaves the Cub's rudder behind
{
  const key = Object.keys(B).find(k => k.toLowerCase() === 'piper cub');
  const r = key ? pick(B[key], oldReach, NEW, 'tubeFabric') : { bad: [] };
  ok(r.bad.some(m => m.startsWith('finRud ')),
     'NEGATIVE: the pre-G1320 reach must leave the Cub\'s rudder in the old colour (got: ' +
     (r.bad.join('; ') || 'nothing') + ')');
}

console.log('LIVERYREACH: ' + passes + ' pass, ' + fails + ' fail');
console.log('GATE LIVERYREACH: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
