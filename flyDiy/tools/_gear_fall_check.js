#!/usr/bin/env node
// GATE GEARFALL (G2016, GEAR-FALLS) - a broken landing gear behaves like one. The user, 4 Nov, on a student's flight (the Cub, a
// bounce's second touch tail high and sliding: the card "the landing gear broke", both legs standing, 12 s of rolling on):
// "broken landing trains were really one of the first asks ... the plane has to behave like it loses a connection, a wheel, a
// leg". On the user's Cub, certified, node only, about a minute:
//   1. THE FLIGHT'S CASE, staged (16.8 m/s, swung, 2.5 m/s down, nose-low): the drag brace kinks, its leg lets go, that side's
//      wing comes down to the ground, the aeroplane stops, the crash says the gear
//   2. A FIRM TOUCH at the same speed and attitude (1.5 m/s) breaks nothing: the limits did not move
//   3. EACH MEMBER ALONE, rolling at 15 m/s: a leg's load members and the axle bar let one leg go; a wire only snaps - the
//      leg stands, no crash, the record says so; a tailwheel's load member lets the tailwheel go
//   4. the metal Cessna's nose leg, the same rule (no certificate: the rule, not the limits)
//   5. a snapped wire's ends are drawn (WRECK_DEBRIS.wireEnds, the page's wreckWires): two on a standing leg, the belly's alone once
//      the leg has gone; the page's own look is the stills'
// Run: node tools/_gear_fall_check.js   (one final `GATE GEARFALL: PASS|FAIL`)
'use strict';
process.env.FLYDIY_CERT = '1';
const G = require('./_dmg_gear_lib.js'), L = G.L, RAD = Math.PI / 180, WD = require('../src/viewer/wreck_debris.js');
let pass = 0, fail = 0;
const yes = (ok, msg) => { if (ok) pass++; else fail++; console.log((ok ? '  ok    ' : '  FAIL  ') + msg); };
// rolling on a flat world, then the stage: nose down by pitch, yawed off the track, swinging at rate, going down at sink
function stage(key, o, opts) {
  const C = L.core(), def = L.defOf(key, opts || {}), { W, strip } = L.flatWorld(0), sim = C.makeSim(def, W); sim.reset(0);
  C.placeAtAerodrome(sim, Object.assign({}, strip, { elev: 0, spawnElev: 0 }));
  for (let f = 0; f < 240; f++) sim.step(1 / 60);
  const c = sim.cgPos().slice(), cg0 = c[1], fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg), lx = -fz, lz = fx;
  const cp = Math.cos((o.pitch || 0) * RAD), sp = Math.sin((o.pitch || 0) * RAD), cy = Math.cos((o.yaw || 0) * RAD), sy = Math.sin((o.yaw || 0) * RAD), w = (o.rate || 0) * RAD;
  for (let i = 0; i < sim.n; i++) {
    const dx = sim.p[i*3] - c[0], dy = sim.p[i*3+1] - c[1], dz = sim.p[i*3+2] - c[2], al = dx * fx + dz * fz, la = dx * lx + dz * lz;
    const al2 = al * cp + dy * sp, up = dy * cp - al * sp, al3 = al2 * cy - la * sy, la3 = al2 * sy + la * cy;
    sim.p[i*3] = c[0] + al3 * fx + la3 * lx; sim.p[i*3+2] = c[2] + al3 * fz + la3 * lz; sim.p[i*3+1] = c[1] + up + (o.lift || 0);
    const rx = sim.p[i*3] - c[0], rz = sim.p[i*3+2] - c[2];
    sim.v[i*3] = o.V * fx + w * rz; sim.v[i*3+2] = o.V * fz - w * rx; sim.v[i*3+1] = -(o.sink || 0);
  }
  sim.ctl.thr = 0;
  const tips = [[], []]; def.nodes.forEach((nd, i) => { if ((nd.tag === 'WF' || nd.tag === 'WR') && Math.abs(nd.p[2]) > 0.8 * def.params.gen.span / 2) tips[nd.p[2] > 0 ? 0 : 1].push(i); });
  return { sim, def, cg0, tips };
}
function run(R, secs) {
  const { sim, def, tips } = R; let tipMin = Infinity;
  const avg = a => a.length ? a.reduce((s, i) => s + sim.p[i*3+1], 0) / a.length : 0;
  for (let f = 0; f < secs * 60; f++) { sim.step(1 / 60); for (const a of tips) for (const i of a) if (sim.p[i*3+1] < tipMin) tipMin = sim.p[i*3+1]; }
  const D = sim.damage(), B = sim.beams, v = sim.cgVel(), tag = i => def.nodes[B[i].a].tag + '-' + def.nodes[B[i].b].tag;
  const span = def.params.gen ? def.params.gen.span * 0.9 : 10;
  return { lean: Math.abs(Math.asin(Math.max(-1, Math.min(1, (avg(tips[0]) - avg(tips[1])) / span))) / RAD), drop: R.cg0 - sim.cgPos()[1], tipMin, V: Math.hypot(v[0], v[1], v[2]), finite: !sim.stats().bad,
    crashed: D.crashed, reason: D.reason, why: D.structural.why, breaks: D.breaks, groups: (D.groups || []).map(g => g.key), first: D.firstBreak ? tag(D.firstBreak.beam) + ' ' + D.firstBreak.how : null };
}
const say = r => 'lean ' + r.lean.toFixed(1) + ' deg, CG down ' + r.drop.toFixed(2) + ' m, low tip ' + r.tipMin.toFixed(2) + ' m, ' + r.V.toFixed(1) + ' m/s left, ' + r.breaks + ' broken, first ' + r.first + ', groups [' + r.groups.join(', ') + '], "' + r.why + '"';

console.log('1. the flight\'s case: the brace kinks on a tail-high, sliding touch, the leg goes');
const TOUCH = { V: 16.8, pitch: 12, yaw: 9, rate: -29, lift: 0.1 };
{ const r = run(stage('cub', Object.assign({ sink: 2.5 }, TOUCH)), 8);
  yes(r.finite && /S1B. kink/.test(r.first || '') && r.groups.some(k => /^gear[LR]:gear$/.test(k)), 'the brace kinks and its leg lets go: ' + say(r));
  yes(r.lean > 10 && r.tipMin < 0.15 && r.V < 3, 'that side comes down: the wing tip on the ground, the aeroplane stopped (lean over 10 deg, tip under 15 cm, under 3 m/s)');
  yes(r.crashed && r.why === 'the landing gear broke', 'the crash says what happened: ' + r.reason + ' / ' + r.why); }
console.log('2. a firm touch at the same speed and attitude');
{ const r = run(stage('cub', Object.assign({ sink: 1.5 }, TOUCH)), 4);
  yes(r.finite && r.breaks === 0 && !r.crashed, 'nothing breaks: ' + say(r)); }
console.log('3. each member alone, rolling at 15 m/s');
{ const probe = stage('cub', { V: 15 }), B = probe.sim.beams, def = probe.def, GR = def.parts.dmg.groups;
  const tag = i => def.nodes[B[i].a].tag + '-' + def.nodes[B[i].b].tag, gear = []; B.forEach((b, i) => { if (b.cls === 'gear') gear.push(i); });
  const alone = i => { const R = stage('cub', { V: 15 }); for (let f = 0; f < 30; f++) R.sim.step(1 / 60); R.sim.damageBreak(i, 'tension'); return run(R, 5); };
  const of = re => gear.filter(i => re.test(tag(i)));
  for (const i of of(/^AXLEL-S[01]BL$|^AXLEL-S0TL$/)) { const r = alone(i);
    yes(r.groups.includes('gearL:gear') && r.drop > 0.15 && r.tipMin < 0.15 && r.crashed, tag(i) + ' (a load member): the left leg goes: ' + say(r)); }
  for (const i of of(/^AXLEL-S0BR$|^AXLER-S0BL$/)) { const r = alone(i);
    yes(B[i].vis === 'wire' && !r.groups.length && r.lean < 3 && !r.crashed && r.why === 'a bracing wire snapped', tag(i) + ' (a wire): it snaps, the leg stands, no crash: ' + say(r)); }
  for (const i of of(/^AXLEL-AXLER$/)) { const r = alone(i);
    yes(r.groups.length >= 1 && r.drop > 0.15 && r.crashed, tag(i) + ' (the axle bar): a leg goes: ' + say(r)); }
  for (const i of of(/^TW-TPB$/)) { const r = alone(i);
    yes(r.groups.includes('tw:gear') && r.crashed, tag(i) + ' (the tailwheel): it goes: ' + say(r)); }
  yes(GR.some(g => /:gear$/.test(g.key)), 'the Cub\'s gear joints: ' + GR.filter(g => /:gear$/.test(g.key)).map(g => g.key).join(', ')); }
console.log('4. the metal Cessna\'s nose leg');
{ const probe = stage('metal', { V: 15 }, { cert: false }), B = probe.sim.beams, def = probe.def, GR = def.parts.dmg.groups, ng = GR.find(g => /nose|nw|tw/i.test(g.key) && /:gear$/.test(g.key));
  if (!ng) yes(false, 'no nose gear joint in [' + GR.filter(g => /:gear$/.test(g.key)).map(g => g.key).join(', ') + ']');
  else { const m = ng.t0.find(j => B[j].vis !== 'wire'), R = stage('metal', { V: 15 }, { cert: false }); for (let f = 0; f < 30; f++) R.sim.step(1 / 60); R.sim.damageBreak(m, 'tension'); const r = run(R, 5);
    yes(r.groups.includes(ng.key) && r.drop > 0.03, ng.key + ', one load member: it goes, the nose comes down: ' + say(r)); } }
console.log('5. a snapped wire\'s ends drawn');
{ const R = stage('cub', { V: 15 }), { sim, def } = R, B = sim.beams, axle = new Set(def.refs.mains);
  const w = B.findIndex(b => b.cls === 'gear' && b.vis === 'wire'), lp = new Uint8Array(sim.n);
  const ends = WD.wireEnds(def, [w], lp, sim.p), tube = ends.length ? WD.wireTube(ends[0]) : null;
  yes(ends.length === 2 && ends.some(e => axle.has(e.node) && e.len <= 0.12) && ends.some(e => !axle.has(e.node) && e.len > 0.12) && tube && tube.pos.length === tube.nrm.length && tube.pos.every(Number.isFinite), 'a wire alone: two ends, the belly\'s the longer: ' + ends.map(e => e.len.toFixed(2)).join(', '));
  const gone = lp.slice(); for (const e of ends) if (axle.has(e.node)) gone[e.node] = 1;
  const left = WD.wireEnds(def, [w], gone, sim.p);
  yes(left.length === 1 && !axle.has(left[0].node), 'its leg gone: the belly\'s end alone');
  yes(WD.wireEnds(def, B.map((b, i) => i).filter(i => B[i].cls === 'gear' && B[i].vis !== 'wire'), lp, sim.p).length === 0, 'a load member draws no wire'); }
console.log('  ' + pass + '/' + (pass + fail) + ' checks');
console.log('GATE GEARFALL: ' + (fail ? 'FAIL' : 'PASS'));
