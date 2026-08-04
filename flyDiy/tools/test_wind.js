// Crosswind + gust gate: the WHOLE FLEET flies full circuits in wind.
// 3 m/s cross + 1 m/s gusts for the fleet; the 1.1 kg foam trainer gets a
// scaled 1.5 m/s + 0.5 (nobody flies a foamie in half its stall speed).
// Asserts circuits complete, decrab keeps touchdown drift and offset
// bounded, gust rejection holds cruise altitude, strains stay in limits.
const { buildCub, buildDrone, buildDC3, buildJodel, buildC172, buildChinook, buildPA18, makeWorld, makeSim } = require('./flight_core.js');
const { runCircuit } = require('./circuit_harness.js');

function windWorld(v, g) { const w = makeWorld(); w.setWind({ base: [0, 0, v], gust: g }); return w; }

const altCollector = c => {
  if (c.ap.phase === 'CRUISE') {
    const d = Math.abs(c.ap.dbg.alt - c.def.params.ap.hCruise);
    if (d > (c.custom.altExc ?? 0)) c.custom.altExc = d;
  }
};
const common = (c, stopZ = 12) => ({
  'touchdown': !!c.td,
  '|tdDrift|<1.8': c.td && Math.abs(c.td.drift ?? 9) < 1.8,
  'stopX<40': c.cg[0] < 40,
  [`|stopZ|<${stopZ}`]: Math.abs(c.cg[2]) < stopZ,
  'gustAltExc<18': (c.custom.altExc ?? 0) < 18,
});

const R = [];
R.push(runCircuit({
  id: 'W-CUB', build: buildCub, world: windWorld(3, 1), uprightCheck: false,
  perturb: { z: 1.2, v: 0.001 }, settleS: 15, maxS: 300,
  tip: { tag: 'WF', midZ: 3.4, tipZ: 5.0, tol: 0.1 }, flapDuring: () => true,
  wingNote: 'crosswind 3 + gust 1', onStep: altCollector,
  // Cub stopZ bound 30, not 12: 23 s of decelerating taildragger rollout
  // weathervanes ~24 m upwind, and the real-world counter (differential
  // braking) is not modeled — documented limitation. The landing itself is
  // clean (tdZ 0.7 m). NOTE: the pre-slip-trim gate "passed" stopZ because
  // the 10.7 m-offset touchdown side-loaded the gear and scrubbed the
  // rollout to 58 m — health made this check honest.
  checks: c => ({ ...common(c, 30),
    '|tdZ|<6': c.td && Math.abs(c.td.z) < 6,
    'sink<2.0': c.td && c.td.sink < 2.0, 'chassis<8%': c.smaxCh < 0.08, 'gear<35%': c.smaxGr < 0.35 }),
}));
R.push(runCircuit({
  id: 'W-DRONE', build: buildDrone, world: windWorld(1.5, 0.5), uprightCheck: false,
  perturb: { z: 0.8, v: 0.0005 }, settleS: 10, maxS: 240,
  tip: { tag: 'WF', midZ: 0.36, tipZ: 0.68, tol: 0.05 }, flapDuring: () => true,
  wingNote: 'crosswind 1.5 + gust 0.5', onStep: altCollector,
  checks: c => ({ ...common(c), '|tdZ|<8': c.td && Math.abs(c.td.z) < 8,
    'sink<1.2': c.td && c.td.sink < 1.2, 'chassis<16%': c.smaxCh < 0.16, 'gear<45%': c.smaxGr < 0.45 }),
}));
R.push(runCircuit({
  id: 'W-DC3', build: buildDC3, world: windWorld(3, 1), uprightCheck: false,
  perturb: { z: 1.5, v: 0.002 }, settleS: 10, maxS: 460,
  tip: { tag: 'WF', midZ: 7.6, tipZ: 14.3, tol: 0.2 }, flapDuring: () => true,
  wingNote: 'crosswind 3 + gust 1', onStep: altCollector,
  checks: c => ({ ...common(c), '|tdZ|<8': c.td && Math.abs(c.td.z) < 8,
    'sink<1.8': c.td && c.td.sink < 1.8, 'chassis<6%': c.smaxCh < 0.06, 'gear<40%': c.smaxGr < 0.40 }),
}));
R.push(runCircuit({
  id: 'W-JODEL', build: buildJodel, world: windWorld(3, 1), uprightCheck: false,
  perturb: { z: 1.0, v: 0.001 }, settleS: 10, maxS: 300,
  tip: { tag: 'WF', midZ: 2.10, tipZ: 4.36, tol: 0.2 },
  wingNote: 'crosswind 3 + gust 1', onStep: altCollector,
  checks: c => ({ ...common(c), '|tdZ|<10': c.td && Math.abs(c.td.z) < 10,
    'sink<1.5': c.td && c.td.sink < 1.5, 'chassis<6%': c.smaxCh < 0.06, 'gear<40%': c.smaxGr < 0.40 }),
}));
R.push(runCircuit({
  id: 'W-C172', build: buildC172, world: windWorld(3, 1), uprightCheck: false,
  perturb: { z: 1.0, v: 0.001 }, settleS: 10, maxS: 300,
  tip: { tag: 'WF', midZ: 2.30, tipZ: 5.50, tol: 0.2 },
  wingNote: 'crosswind 3 + gust 1', onStep: altCollector,
  checks: c => ({ ...common(c), '|tdZ|<6': c.td && Math.abs(c.td.z) < 6,
    'sink<1.5': c.td && c.td.sink < 1.5, 'chassis<6%': c.smaxCh < 0.06, 'gear<40%': c.smaxGr < 0.40 }),
}));
R.push(runCircuit({
  id: 'W-CHNK', build: buildChinook, world: windWorld(3, 1), uprightCheck: false,
  perturb: { z: 1.0, v: 0.001 }, settleS: 10, maxS: 300,
  tip: { tag: 'WF', midZ: 2.00, tipZ: 5.34, tol: 0.2 },
  wingNote: 'crosswind 3 + gust 1', onStep: altCollector,
  checks: c => ({ ...common(c), '|tdZ|<8': c.td && Math.abs(c.td.z) < 8,
    'sink<1.8': c.td && c.td.sink < 1.8, 'chassis<11.5%': c.smaxCh < 0.115, 'gear<40%': c.smaxGr < 0.40 }),
}));

R.push(runCircuit({
  id: 'W-PA18', build: buildPA18, world: windWorld(3, 1), uprightCheck: false,
  perturb: { z: 1.2, v: 0.001 }, settleS: 15, maxS: 300,
  tip: { tag: 'WF', midZ: 3.4, tipZ: 5.0, tol: 0.1 }, flapDuring: () => true,
  wingNote: 'crosswind 3 + gust 1', onStep: altCollector,
  // same taildragger-weathervane stopZ bound as the cub (shared geometry);
  // flaps are DEPLOYED for this crosswind landing — slower touchdown
  checks: c => ({ ...common(c, 30),
    '|tdZ|<6': c.td && Math.abs(c.td.z) < 6,
    'sink<2.0': c.td && c.td.sink < 2.0, 'chassis<8%': c.smaxCh < 0.08, 'gear<35%': c.smaxGr < 0.35 }),
}));

// Parked-latch check (W13): a taildragger DWELLING parked in a tailwind
// after the reset slam folded its tailwheel tripod and LATCHED at 4%
// strain (cub/pa18; cured with TW->TPT + the TW->HT pyramid, rule 10).
// The circuits above roll immediately and never dwell — this probes
// exactly the viewer's sit-with-wind-set regime.
for (const [id, build] of [['W-PARK-PA18', buildPA18], ['W-PARK-CUB', buildCub]]) {
  const W = makeWorld();
  W.setWind({ base: [-1.7, 0, 1.9], gust: 0 });   // viewer 'breeze': tailwind at spawn
  const def = build(), sim = makeSim(def, W);
  sim.reset(0);
  const nid = t => { let r = -1; def.nodes.forEach((n, i) => { if (n.tag === t) r = i; }); return r; };
  const tw = nid('TW'), tpb = nid('TPB'), tpt = nid('TPT');
  const L = (a, b) => Math.hypot(sim.p[a*3] - sim.p[b*3],
    sim.p[a*3+1] - sim.p[b*3+1], sim.p[a*3+2] - sim.p[b*3+2]);
  const r1 = L(tw, tpb), r2 = L(tw, tpt);
  let worst = 0, minTpb = 1e9;
  for (let f = 0; f < 720; f++) {                 // 12 s parked
    sim.step(1 / 60);
    if (f < 90) continue;                         // slam transient
    worst = Math.max(worst, Math.abs(L(tw, tpb) / r1 - 1), Math.abs(L(tw, tpt) / r2 - 1));
    minTpb = Math.min(minTpb, sim.p[tpb*3+1] - W.terrainH(sim.p[tpb*3], sim.p[tpb*3+2]));
  }
  const ok = worst < 0.10 && minTpb > 0.15;
  console.log(`=== ${id} ===`);
  console.log(`tail-rig dev ${(worst * 100).toFixed(1)}% | minTpbAgl ${minTpb.toFixed(2)} m ` +
    `-> ${ok ? 'holds' : 'FOLDED'}`);
  R.push({ id, pass: ok });
}

const pass = R.every(r => r.pass);
console.log(pass ? 'GATE WIND: PASS' : 'GATE WIND: FAIL');
process.exitCode = pass ? 0 : 1;
