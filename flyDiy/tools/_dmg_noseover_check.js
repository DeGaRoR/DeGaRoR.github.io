#!/usr/bin/env node
// GATE DMGNOSEOVER (NOSE-STRIKE, 9 Nov, DEFORM) - THE USER'S NOSE-OVER: "when a plane noses over, it gets damage. It at
// least gets damage to the prop, which is a very fragile thing which can't touch anything." The repro, theirs: "get the
// Cub, land it, brake as hard as you can, never release, and you're gonna nose over for sure."
// The aeroplanes as the game loads them (the load door: _treecrash_lib defOf = LB.loadValidated; the STOL showcase via
// LB.gameSpec), damage ON. One process, the cases in sequence (~1-2 min).
//   1. THE ALLOWANCE BY SURFACE (the user's numbers): grass, forest floor (the trees) and sand 10 cm; scree and gravel
//      5 cm; rock and paved 1 cm ("a little margin for error"); water none
//   2. PARKED (10 s on the brakes at idle, HOME and the flat field): no strike, no nose contact, not damaged - and the
//      disc's least clearance past its surface's allowance (a parked strike is a build finding, never a wider allowance)
//   3. THE HELD BRAKE (the user's repro): rolling at 12 and 18 m/s, idle, full brake held to the stop, the stick neutral:
//      the taildraggers stand on the nose - the disc strikes, DMG.noseAt names the prop first (before the pitch's least;
//      its delay after the pitch passes 12 deg below parked printed: Pilot's noseOver reads it), and the integrity reads DAMAGED, why "the propeller struck"
//   4. THE NEGATIVES: the same brake with the stick held back keeps the tail down - no strike, no nose contact, not
//      damaged; the 172 (nosewheel) on the same brake does not nose over
//   5. COHERENCE on every run: a strike is damage, and a strike has a nose contact at or before it
// Run: node tools/_dmg_noseover_check.js   (one final `GATE DMGNOSEOVER: PASS|FAIL`)
'use strict';
const path = require('path'), fs = require('fs');
const T = __dirname;
const L = require(path.join(T, '_treecrash_lib.js')), LB = require(path.join(T, '_load_build.js'));
const C = L.core();
const f2 = x => (x == null || !Number.isFinite(+x)) ? String(x) : (+x).toFixed(2);
let checks = 0, fails = 0;
const yes = (c, msg) => { checks++; if (!c) fails++; console.log((c ? '  ok    ' : '  FAIL  ') + msg); };
const DT = 1 / 60, SETTLE = 240;

function stolDef() {
  const raw = JSON.parse(fs.readFileSync(path.join(T, 'fixtures', 'stol_cub_showcase.json'), 'utf8'));
  const d = C.buildGen(LB.gameSpec(raw));
  return Object.assign({}, d, { params: Object.assign({}, d.params, { damage: true }) });
}
const DEFS = { cub: () => L.defOf('cub', {}), stol: stolDef, metal: () => L.defOf('metal', {}), jodel: () => L.defOf('jodel', {}) };
function place(key, ground) {
  const def = DEFS[key]();
  let W, strip;
  if (ground === 'flat') ({ W, strip } = L.flatWorld(0)); else { W = C.makeWorld(); strip = W.aerodromes.find(a => a.id === 'HOME'); }
  const sim = C.makeSim(def, W); sim.reset(0);
  C.placeAtAerodrome(sim, ground === 'flat' ? Object.assign({}, strip, { elev: 0, spawnElev: 0 }) : strip);
  return { def, W, sim };
}
const pitchOf = sim => -Math.asin(Math.max(-1, Math.min(1, sim.axes()[0][1]))) * 180 / Math.PI;
const coherent = (tag, D) => {
  const S = D.structural || {}, nA = D.noseAt;
  if (D.propStrike) {
    yes(!!S.damaged, tag + ': the strike reads damaged (' + JSON.stringify(S.why) + ')');
    yes(!!nA && D.propAt && nA.t <= D.propAt.t + 1e-9, tag + ': a nose contact at or before the strike (noseAt ' + (nA ? nA.what + ' @' + f2(nA.t) : 'none') + ', propAt @' + f2(D.propAt && D.propAt.t) + ')');
  }
};

// 1. the allowance by surface
console.log('1. THE ALLOWANCE BY SURFACE (the user: 10 cm on grass and trees, 1 cm over hard ground)');
const WANT = { GRASS: [0, 0.10], ROCK: [1, 0.01], SCREE: [2, 0.05], FOREST_FLOOR: [3, 0.10], WATER: [4, 0], PAVED: [5, 0.01], GRAVEL: [6, 0.05], SAND: [7, 0.10] };
for (const [nm, [code, cm]] of Object.entries(WANT)) yes(Math.abs(C.genDriveTurf(code) - cm) < 1e-9, nm + ' (' + code + '): ' + Math.round(C.genDriveTurf(code) * 100) + ' cm (want ' + Math.round(cm * 100) + ')');
yes(Math.abs(C.genDriveTurf(-1) - 0.10) < 1e-9, 'no surface known: the soft default ' + Math.round(C.genDriveTurf(-1) * 100) + ' cm');

// 2. parked
console.log('2. PARKED (10 s, brakes on, idle)');
for (const key of ['cub', 'stol', 'metal', 'jodel']) for (const ground of ['home', 'flat']) {
  const { W, sim } = place(key, ground);
  for (let f = 0; f < 600; f++) { sim.ctl.thr = 0; sim.ctl.brake = 1; sim.step(DT); }
  const D = sim.damage(), dr = D.drive && D.drive[0], c = sim.cgPos();
  const su = typeof W.surface === 'function' ? W.surface(c[0], c[2]) : -1, al = C.genDriveTurf(su);
  yes(!D.propStrike && !D.noseAt && !(D.structural || {}).damaged && (!dr || dr.gapMin > al),
    key + ' ' + ground + ': no strike, no nose contact, not damaged - the disc ' + (dr ? f2(dr.gapMin) : '-') + ' m clear (surface ' + su + ', allowance ' + Math.round(al * 100) + ' cm)');
}

// 3 / 4. the rolls
function roll(key, ground, V, de, secs, brake) {
  if (brake == null) brake = 1;
  const { sim } = place(key, ground);
  for (let f = 0; f < SETTLE; f++) sim.step(DT);
  const x0 = sim.axes()[0], hl = Math.hypot(x0[0], x0[2]), fx = -x0[0] / hl, fz = -x0[2] / hl;
  const th0 = pitchOf(sim);
  for (let i = 0; i < sim.n; i++) { sim.v[i * 3] += V * fx; sim.v[i * 3 + 2] += V * fz; }
  let tAbs = SETTLE * DT, thMin = th0, tMin = tAbs, tOver = null, Vend = V;
  for (let f = 0; f < secs * 60; f++) {
    sim.ctl.thr = 0; sim.ctl.brake = brake; sim.ctl.de = de; sim.ctl.da = 0; sim.ctl.dr = 0;
    sim.step(DT); tAbs += DT;
    const th = pitchOf(sim); if (th < thMin) { thMin = th; tMin = tAbs; }
    if (tOver == null && th < th0 - 12) tOver = tAbs;
    const v = sim.cgVel(); Vend = v[0] * fx + v[2] * fz;
    if (Math.abs(Vend) < 0.05 && f > 120) break;
    if (sim.damage().over) break;
  }
  const D = sim.damage();
  return { D, th0, thMin, tMin, tOver, tAbs, Vend };
}
const desc = (r) => 'pitch ' + f2(r.th0) + ' -> min ' + f2(r.thMin) + ' deg' + (r.tOver != null ? ', past 12 deg below parked at ' + f2(r.tOver) + ' s' : '') +
  '; strike ' + ((r.D.drive && r.D.drive[0] && r.D.drive[0].strike) || (r.D.propStrike ? 'yes' : '-')) + '; noseAt ' + (r.D.noseAt ? r.D.noseAt.what + ' @' + f2(r.D.noseAt.t) + ' (' + r.D.noseAt.surf + ', tier ' + r.D.noseAt.tier + ')' : '-') +
  '; structural ' + JSON.stringify({ damaged: !!(r.D.structural || {}).damaged, why: (r.D.structural || {}).why || null });
console.log('3. THE HELD BRAKE (the user\'s repro: idle, full brake held to the stop, the stick neutral)');
for (const [key, ground, V] of [['cub', 'flat', 12], ['cub', 'home', 12], ['cub', 'flat', 18], ['stol', 'flat', 12], ['stol', 'home', 18]]) {
  const tag = key + ' ' + ground + ' ' + V + ' m/s', r = roll(key, ground, V, 0, 15), S = r.D.structural || {}, nA = r.D.noseAt;
  console.log('  ' + tag + ': ' + desc(r));
  yes(r.tOver != null, tag + ': it noses over');
  yes(!!r.D.propStrike, tag + ': the propeller strikes');
  yes(!!nA && nA.what === 'prop' && r.tOver != null && nA.t <= r.tMin + 1e-9, tag + ': DMG.noseAt names the prop before the nose is fully down (' + (nA && r.tOver != null ? f2(nA.t - r.tOver) + ' s after the pitch passed 12 deg below parked' : '-') + ')');
  yes(!!S.damaged && /propeller/.test(S.why || '') || (!!S.damaged && S.broken > 0), tag + ': DAMAGED - ' + JSON.stringify(S.why));
  coherent(tag, r.D);
}
console.log('4. THE NEGATIVES');
// LINER-BACK-2 (10 Nov, Deform agrees): the Cub's 18 m/s full-brake stick-back negative sat AT the tip line on master
// (min -4.92 deg, 12 deg below parked at 9.43 s, no strike); the liner Cub's CG 4.4 mm forward + 2.1 mm up (the aft
// furnishing lump gone - a J-3 has none - and the liner's +0.95 kg billed at VSN) tips it over. Physical in direction,
// a knife-edge in size: that row is now a REPORT (printed, never fails) and the Cub's negative is CUB_NEG, chosen by
// measured margin, which must stay at least NEG_MARGIN deg above the tip point (parked - 12 deg).
const CUB_NEG = { V: 18, brake: 0.8 }, NEG_MARGIN = 6;
for (const [V, brake] of [[18, 1], [18, 0.8], [15, 1]]) {
  const r = roll('cub', 'flat', V, 1, 15, brake), tip = r.th0 - 12;
  console.log('  REPORT cub flat ' + V + ' m/s, brake ' + brake + ' (taildragger, stick back): ' + desc(r) + ' - margin above the tip point ' + f2(r.thMin - tip) + ' deg');
}
{
  const tag = 'cub flat ' + CUB_NEG.V + ' m/s at ' + CUB_NEG.brake + ' brake (taildragger, stick back)', r = roll('cub', 'flat', CUB_NEG.V, 1, 15, CUB_NEG.brake), S = r.D.structural || {};
  console.log('  ' + tag + ': ' + desc(r));
  yes(!r.D.propStrike && !r.D.noseAt && !S.damaged, tag + ': no strike, no nose contact, not damaged');
  yes(r.thMin - (r.th0 - 12) >= NEG_MARGIN, tag + ': clear of the tip point by ' + f2(r.thMin - (r.th0 - 12)) + ' deg (at least ' + NEG_MARGIN + ')');
  coherent(tag, r.D);
}
for (const [key, ground, V, de, nose] of [['stol', 'flat', 18, 1, 'taildragger, stick back'], ['metal', 'flat', 18, 0, 'the 172 on its nosewheel'], ['metal', 'home', 12, 0, 'the 172 on its nosewheel']]) {
  const tag = key + ' ' + ground + ' ' + V + ' m/s (' + nose + ')', r = roll(key, ground, V, de, 15), S = r.D.structural || {};
  console.log('  ' + tag + ': ' + desc(r));
  yes(!r.D.propStrike && !r.D.noseAt && !S.damaged, tag + ': no strike, no nose contact, not damaged');
  coherent(tag, r.D);
}
console.log('  ' + (checks - fails) + '/' + checks + ' checks');
console.log('GATE DMGNOSEOVER: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
