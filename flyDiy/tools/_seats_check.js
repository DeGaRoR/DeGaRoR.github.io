#!/usr/bin/env node
// GATE SEATS (SEATS, 2026-11-02) - the seat library and its wiring, headless:
//   1 ONE ORDER: tools/_seat_gen.js SEAT_PRESETS, the core's GEN_SEAT_TYPES (the mass rows), the design rows'
//     SEAT_STYLES and the panel's SEAT_TYPE_LABELS name the same seats in the same order (the index rides in saves)
//   2 HONEST MASS: every preset's kg is its GEN_SEATS row's; type 0 bills the `sling` row every saved build bills
//   3 EVERY PRESET BUILDS, at every level: finite geometry, a seat in a sane box over its floor, the phone level inside
//     its triangle budget, each level lighter than the one before, the game's levels (mid, phone) at most four draws
//     a seat (one material per role: base, accent, seams, frame - SEATS-COST)
//   4 THE SEATING REFERENCE: the interface the occupant laces to is the stance's own (panY, szc), whatever the preset
//   5 THE CABIN'S SEAT: paxSeatType absent = the pilots' type, or the pilots' preset's own cabin seat (paxType)
//   6 THE MASS REACHES THE BUILD: cabin.seatsKg moves the built mass by the difference, and absent changes nothing
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const T = __dirname;
let fails = 0;
const check = (ok, what, detail) => { if (!ok) { fails++; console.log('  FAIL ' + what + (detail ? '  [' + detail + ']' : '')); } return ok; };

global.THREE = require(path.join(T, '..', 'vendor', 'three.min.js'));
global.window = global;
for (const f of ['_gear_kit.js', '_seat_gen.js']) vm.runInThisContext(fs.readFileSync(path.join(T, f), 'utf8'), { filename: f });
const SG = global.SEAT_GEN;
const C = require(path.join(T, 'flight_core.js'));

// the two editor tables, read out of their files (both are top-level consts in classic scripts)
const grab = (file, name) => {
  const src = fs.readFileSync(path.join(T, file), 'utf8');
  const i = src.indexOf('const ' + name + ' = [');
  if (i < 0) return null;
  let d = 0, j = src.indexOf('[', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '[') d++; else if (src[k] === ']' && --d === 0) return vm.runInNewContext(src.slice(j, k + 1)); }
  return null;
};
const STYLES = grab('_cage_design.js', 'SEAT_STYLES'), LABELS = grab('_cage_page5.js', 'SEAT_TYPE_LABELS');

console.log('1 one order');
const N = Object.keys(SG.SEAT_PRESETS).length;
check(N === C.GEN_SEAT_TYPES.length, 'SEAT_PRESETS and GEN_SEAT_TYPES are the same length', N + ' vs ' + C.GEN_SEAT_TYPES.length);
check(STYLES && STYLES.length === N, 'the design rows carry a style per preset', STYLES && STYLES.length);
check(LABELS && LABELS.length === N, 'the panel carries a label per preset', LABELS && LABELS.length);
for (let t = 0; t < N; t++) {
  const p = SG.PRESET_OF(t);
  check(!!p, 'preset ' + t + ' exists');
  if (!p) continue;
  check(p.key === C.GEN_SEAT_TYPES[t], 'preset ' + t + ' bills its own GEN_SEATS row', p.key + ' vs ' + C.GEN_SEAT_TYPES[t]);
  if (STYLES) check(STYLES[t][0] === p.name, 'preset ' + t + ' has one name in the design rows', STYLES[t][0] + ' vs ' + p.name);
  if (STYLES) check(STYLES[t][3] === p.rake && STYLES[t][4] === p.tilt, 'preset ' + t + "'s seed is its own stance");
  if (LABELS) check(LABELS[t] === p.name.toLowerCase(), 'preset ' + t + ' has one name on the panel', LABELS[t] + ' vs ' + p.name);
}

console.log('2 honest mass');
for (let t = 0; t < N; t++) {
  const p = SG.PRESET_OF(t), row = C.GEN_SEATS[p.key];
  check(!!row && row.kg === p.kg, 'preset ' + t + ' (' + p.key + ') weighs its row', row ? row.kg + ' vs ' + p.kg : 'no row');
}
check(SG.PRESET_OF(0).key === 'sling' && C.GEN_SEATS.sling.kg === 3.0, 'the default seat bills the sling row every save bills');

console.log('3 every preset builds, at every level');
const A = { floorAt: () => 0, halfW: 0.6, roofY: 1.45 };
const BUDGET = { tris: 1500 };
const table = [];
for (let t = 0; t < N; t++) {
  const p = SG.PRESET_OF(t), row = [p.key];
  let prev = Infinity;
  for (const L of [0, 1, 2]) {
    SG.force = L;
    const grp = new THREE.Group();
    const g = { szc: 0.20, floor: 0, panY: 0.10, rake: p.rake * Math.PI / 180, tilt: p.tilt * Math.PI / 180, hw: 0.24, backH: 0.5, sx: 0 };
    let r = null;
    try { r = SG.build(grp, A, { seatType: t }, g, { h: 0.10, rake: p.rake, tilt: p.tilt }, false); } catch (e) { check(false, p.key + ' L' + L + ' builds', e.message); continue; }
    if (!check(!!r, p.key + ' L' + L + ' returns its interface')) continue;
    let bad = 0;
    grp.traverse(o => { if (o.isMesh) for (const v of o.geometry.attributes.position.array) if (!isFinite(v)) bad++; });
    check(bad === 0, p.key + ' L' + L + ' has finite geometry', bad + ' bad');
    const box = new THREE.Box3().setFromObject(grp), sz = box.getSize(new THREE.Vector3());
    check(box.min.y > -0.02 && box.max.y < 1.45 && sz.x > 0.30 && sz.x < 0.80 && sz.z > 0.30 && sz.z < 1.40,
      p.key + ' L' + L + ' stands in a seat-sized box over its floor', JSON.stringify(box.min.toArray().concat(box.max.toArray()).map(v => +v.toFixed(2))));
    // 4 the interface is the stance's own
    check(r.panY === g.panY && r.szc === g.szc && r.floor === g.floor, p.key + ' L' + L + ' laces the occupant to the stance');
    check(r.tris < prev, p.key + ' L' + L + ' is lighter than the level before', r.tris + ' vs ' + prev);
    prev = r.tris;
    if (L === 2) check(r.tris <= BUDGET.tris, p.key + ' phone level inside ' + BUDGET.tris + ' triangles', r.tris);
    // SEATS-COST: the levels the game builds wear ONE MATERIAL PER ROLE - at most four draws a seat
    if (L >= 1) check(r.draws <= 4, p.key + ' L' + L + ' wears at most its four role materials', r.draws + ' draws');
    row.push(r.tris + '/' + r.draws);
  }
  table.push(row.join(' '));
}
SG.force = null;
console.log('  ' + table.join('\n  '));

console.log('5 the cabin seat');
// buildSeat's own rule, re-stated: absent / -1 -> the pilots' preset's paxType, else the pilots' type
const cabinType = P => { const own = P.paxSeatType != null ? Math.round(+P.paxSeatType) : -1; const pre = SG.PRESET_OF(P.seatType || 0);
  return own >= 0 ? own : (pre && pre.paxType != null ? pre.paxType : Math.round(P.seatType || 0)); };
const crew = fs.readFileSync(path.join(T, '_cage_crew.js'), 'utf8');
check(/pre\.paxType != null \? pre\.paxType : -1/.test(crew) && /P\.paxSeatType != null \? Math\.round\(\+P\.paxSeatType\) : -1/.test(crew),
  "the crew's buildSeat reads paxSeatType, then the preset's paxType");
check(cabinType({ seatType: 3 }) === 3, 'a cabin with no row of its own takes the pilots\' type');
check(cabinType({ seatType: 8 }) === 2, 'the vintage crew seat\'s cabin is the vintage airliner');
check(cabinType({ seatType: 8, paxSeatType: 5 }) === 5, 'the cabin\'s own row wins');
check(SG.PRESET_OF(2).pax === true, 'the vintage airliner is a cabin seat');

console.log('6 the mass reaches the build');
{
  const s0 = JSON.parse(JSON.stringify(C.GEN_DEFAULT));
  const R0 = C.resolveSpec(JSON.parse(JSON.stringify(s0))).spec;
  check(!('seatsKg' in R0.cabin), 'a spec with no seat masses resolves with none (no key is added)');
  const m = b => b.nodes.reduce((a, n) => a + n.m, 0);
  const b0 = C.buildGen(s0);
  const s1 = JSON.parse(JSON.stringify(s0)); s1.cabin = Object.assign({}, s1.cabin, { seatsKg: [3.0, 3.0] });
  const b1 = C.buildGen(s1);
  check(Math.abs(m(b1) - m(b0)) < 1e-9, 'seat masses equal to the row change nothing', (m(b1) - m(b0)).toFixed(6));
  const s2 = JSON.parse(JSON.stringify(s0)); s2.cabin = Object.assign({}, s2.cabin, { seatsKg: [14, 14] });
  const d = m(C.buildGen(s2)) - m(b0);
  check(d > 22 - 1e-6 && d < 30, 'two 14 kg seats weigh at least their 22 kg more (and the structure sized to them)', d.toFixed(2));
}

console.log(fails ? 'GATE SEATS: FAIL' : 'GATE SEATS: PASS');
process.exit(fails ? 1 : 0);
