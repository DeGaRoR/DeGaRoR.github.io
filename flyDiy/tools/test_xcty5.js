// Gate: W14 MULTI-HOP — PA-18 flies HOME -> Stein (340 m fly-in), stops,
// then a fresh autopilot departs from WHERE IT STANDS (departFrom: no
// reset, no teleport — the viewer's seamless next-leg flow) and flies
// back to HOME. Calm on purpose: the Stein stop point leaves less runway
// than TORun + margin, so the departure MUST backtrack (TAXI + LINEUP
// turnaround) before rolling. Asserts both landings, the taxi staying on
// the strip, and the tail rig surviving the whole double flight.
const { buildPA18, makeWorld, makeSim, makeAutopilot, placeAtAerodrome } = require('./flight_core.js');

const W = makeWorld();
const def = buildPA18();
const sim = makeSim(def, W);
sim.reset(0);
let ap = makeAutopilot(sim, def, W);
const home = W.aerodromes.find(a => a.id === 'HOME');
const stein = W.aerodromes.find(a => a.id === 'A7');
placeAtAerodrome(sim, home);
ap.setRoute(home, stein);

const nid = t => { let r = -1; def.nodes.forEach((n, i) => { if (n.tag === t) r = i; }); return r; };
const tw = nid('TW'), tpt = nid('TPT');
const L = (a, b) => Math.hypot(sim.p[a*3] - sim.p[b*3],
  sim.p[a*3+1] - sim.p[b*3+1], sim.p[a*3+2] - sim.p[b*3+2]);
const rigRest = L(tw, tpt);
let rigDev = 0;

const fly = (maxS) => {          // run until STOPPED; returns [phase, simT]
  let t = 0;
  for (; t < maxS; t += 1 / 60) {
    ap.update(1 / 60); sim.step(1 / 60);
    rigDev = Math.max(rigDev, Math.abs(L(tw, tpt) / rigRest - 1));
    if (ap.phase === 'STOPPED' && ap.t > 5) return [ap.phase, t];
    if (!Number.isFinite(sim.p[1])) return ['DIVERGED', t];
  }
  return [ap.phase, t];
};

// ---- leg 1: HOME -> Stein ----
const [ph1, t1] = fly(800);
const cg1 = [...sim.cgPos()];
const axx = Math.cos(stein.hdg), axz = Math.sin(stein.hdg);
const s1 = (cg1[0] - stein.x) * axx + (cg1[2] - stein.z) * axz;   // centre-frame
const cr1 = -(cg1[0] - stein.x) * axz + (cg1[2] - stein.z) * axx;
console.log(`leg1: ${ph1} t=${t1.toFixed(0)}s | stop centre-s=${s1.toFixed(0)} cross=${cr1.toFixed(1)}`);

// ---- leg 2: depart from where it stands, back to HOME ----
ap = makeAutopilot(sim, def, W);
ap.departFrom(stein, home);
let sawTaxi = false, taxiOffStrip = 0, maxAgl = 0, t2 = 0;
for (; t2 < 1500; t2 += 1 / 60) {
  ap.update(1 / 60); sim.step(1 / 60);
  rigDev = Math.max(rigDev, Math.abs(L(tw, tpt) / rigRest - 1));
  const cg = sim.cgPos();
  if (['TAXI', 'LINEUP'].includes(ap.phase)) {
    sawTaxi = sawTaxi || ap.phase === 'TAXI';
    const s = (cg[0] - stein.x) * axx + (cg[2] - stein.z) * axz;
    const cr = -(cg[0] - stein.x) * axz + (cg[2] - stein.z) * axx;
    taxiOffStrip = Math.max(taxiOffStrip,
      Math.max(0, Math.abs(s) - (stein.len / 2 + 45)), Math.max(0, Math.abs(cr) - 45));
  }
  maxAgl = Math.max(maxAgl, cg[1] - W.terrainH(cg[0], cg[2]));
  if (ap.phase === 'STOPPED' && ap.t > 60) break;
  if (!Number.isFinite(sim.p[1])) break;
}
const cg2 = sim.cgPos(), xA = sim.axes()[0];
const pitch = Math.atan2(xA[1], Math.hypot(xA[0], xA[2])) * 57.3;
const agl2 = cg2[1] - W.terrainH(cg2[0], cg2[2]);
console.log(`leg2: ${ap.phase} t=${t2.toFixed(0)}s | sawTaxi=${sawTaxi} ` +
  `taxiOffStrip=${taxiOffStrip.toFixed(1)} maxAgl=${maxAgl.toFixed(0)} | ` +
  `stop x=${cg2[0].toFixed(0)} z=${cg2[2].toFixed(1)} pitch=${pitch.toFixed(1)} agl=${agl2.toFixed(2)}`);

const checks = {
  'leg1 stopped': ph1 === 'STOPPED',
  'leg1 on strip': Math.abs(s1) < stein.len / 2 - 10 && Math.abs(cr1) < 10,
  'leg2 backtracked': sawTaxi,
  'taxi on strip': taxiOffStrip < 1,
  'leg2 flew': maxAgl > 60,
  'leg2 stopped at HOME': ap.phase === 'STOPPED' &&
    cg2[0] > -1180 && cg2[0] < 130 && Math.abs(cg2[2]) < 20,
  'upright tail-down': pitch < -6 && agl2 > 0.85,
  'tail rig intact': rigDev < 0.10,
};
const fails = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
if (fails.length) console.log('failed: ' + fails.join(', '));
console.log(fails.length ? 'GATE XCTY5: FAIL' : 'GATE XCTY5: PASS');
process.exitCode = fails.length ? 1 : 0;
