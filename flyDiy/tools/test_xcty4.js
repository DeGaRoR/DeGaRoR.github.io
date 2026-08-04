// Gate: SHORT-FIELD cross-country — PA-18 HOME -> Stein Strip (A7, 340 m
// gravel fly-in bench) in the viewer's BREEZE preset. This is the exact
// user-reported failure of 2026-08-04: quartering-tailwind arrival (frame
// picked by leg bearing) + the canonical-direction threshold formula
// aimed 195 m deep, the airspeed-referenced slope feedforward crossed the
// threshold 5.6 m low, and the full-aft rollout pin at touch speed
// re-flew the aircraft: bounce, veer, nose-over. Asserts the W13.2 fixes:
// into-wind landing, threshold-correct aim, groundspeed feedforward,
// VPinFull hop guard — touchdown in the first 40%, minimal skip, stop on
// the strip, UPRIGHT (the old test only asserted STOPPED and missed the
// nose-over).
const { buildPA18, makeWorld, makeSim, makeAutopilot, placeAtAerodrome } = require('./flight_core.js');

const W = makeWorld();
W.setWind({ base: [-1.7, 0, 1.9], gust: 0 });     // viewer 'Breeze 2.5 m/s'
const def = buildPA18();
const sim = makeSim(def, W);
sim.reset(0);
const ap = makeAutopilot(sim, def, W);
const home = W.aerodromes.find(a => a.id === 'HOME');
const A = W.aerodromes.find(a => a.id === 'A7');
placeAtAerodrome(sim, home);
ap.setRoute(home, A);

const nid = t => { let r = -1; def.nodes.forEach((n, i) => { if (n.tag === t) r = i; }); return r; };
const axl = nid('AXLEL'), axr = nid('AXLER'), tw = nid('TW'), tpt = nid('TPT');
const wAgl = i => sim.p[i*3+1] - W.terrainH(sim.p[i*3], sim.p[i*3+2]);
const L = (a, b) => Math.hypot(sim.p[a*3] - sim.p[b*3],
  sim.p[a*3+1] - sim.p[b*3+1], sim.p[a*3+2] - sim.p[b*3+2]);
const rigRest = L(tw, tpt);

let onG = false, touches = [], F = null, sThr = null, t = 0, rigDev = 0;
for (; t < 900; t += 1 / 60) {
  ap.update(1 / 60); sim.step(1 / 60);
  if (F === null && ap.xc && ['ENROUTE', 'INBOUND', 'APPROACH'].includes(ap.phase)) {
    F = ap.frame;
    sThr = (A.x - F.ox) * F.ux + (A.z - F.oz) * F.uz - A.len / 2;
  }
  if (F && ['FLARE', 'ROLLOUT', 'STOPPED'].includes(ap.phase)) {
    rigDev = Math.max(rigDev, Math.abs(L(tw, tpt) / rigRest - 1));
    const g = Math.min(wAgl(axl), wAgl(axr)) < 0.22;
    if (g && !onG) {
      const cg = sim.cgPos();
      touches.push({ s: (cg[0] - F.ox) * F.ux + (cg[2] - F.oz) * F.uz - sThr, vs: sim.out.vs });
    }
    onG = g;
  }
  if (ap.phase === 'STOPPED') break;
  if (!Number.isFinite(sim.p[1])) break;
}
const cg = sim.cgPos(), xA = sim.axes()[0];
const s = F ? (cg[0] - F.ox) * F.ux + (cg[2] - F.oz) * F.uz - sThr : 9e9;
const cr = F ? -(cg[0] - F.ox) * F.uz + (cg[2] - F.oz) * F.ux : 9e9;
const pitch = Math.atan2(xA[1], Math.hypot(xA[0], xA[2])) * 57.3;
const agl = cg[1] - W.terrainH(cg[0], cg[2]);
const t0 = touches[0] || { s: 9e9, vs: 9 };

const checks = {
  'stopped': ap.phase === 'STOPPED',
  'touch in first 40%': t0.s > 5 && t0.s < 140,
  'skip bounded': touches.length <= 2 && touches.every(c => c.vs > -2.0),
  'stops on strip': s > 30 && s < A.len - 15,
  '|cross|<10': Math.abs(cr) < 10,
  'upright tail-down': pitch < -6 && agl > 0.85,
  'tail rig intact': rigDev < 0.10,
};
console.log(`leg: ${ap.phase} t=${t.toFixed(0)}s | ` +
  `touches [${touches.map(c => c.s.toFixed(0) + '@' + c.vs.toFixed(1)).join(' ')}] | ` +
  `stop s=${s.toFixed(0)}/${A.len} cross=${cr.toFixed(1)} pitch=${pitch.toFixed(1)} ` +
  `agl=${agl.toFixed(2)} rigDev=${(rigDev * 100).toFixed(1)}%`);
const fails = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
if (fails.length) console.log('failed: ' + fails.join(', '));
console.log(fails.length ? 'GATE XCTY4: FAIL' : 'GATE XCTY4: PASS');
process.exitCode = fails.length ? 1 : 0;
