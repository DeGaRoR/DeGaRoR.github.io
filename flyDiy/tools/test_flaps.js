// High-lift gate: free-air tunnel, clean vs flapped, on the two aircraft that
// anchor the model — C172 (POH Vs0/Vs1 ratio) and Chinook (flaperons must not
// destroy CLmax) — plus the AP flap-servo rate limit.
const { buildC172, buildChinook, buildPA18, makeSim, makeAutopilot, makeWorld } = require('./flight_core.js');

function tunnel(build) {
  const def = build();
  const sim = makeSim(def);              // free air
  const W = sim.totalM * 9.81;
  sim.reset(0);
  let S = 0;
  for (const st of def.strips) if (st.kind === 'wing') S += st.area;
  const V = 30;
  const probe = al => sim.probe([-V * Math.cos(al), -V * Math.sin(al), 0]);
  const scan = () => {
    let CLmax = 0;
    for (let a = 2; a <= 22; a += 0.25) {
      const al = a * Math.PI / 180, r = probe(al);
      const L = -r.Fx * Math.sin(al) + r.Fy * Math.cos(al);
      CLmax = Math.max(CLmax, L / (0.5 * 1.225 * V * V * S));
    }
    return { CLmax, Vs: Math.sqrt(2 * W / (1.225 * S * CLmax)) };
  };
  const drag = al => { const r = probe(al); return r.Fx * Math.cos(al) + r.Fy * Math.sin(al); };
  sim.ctl.flap = 0;
  const c = { ...scan(), D: drag(0.05) };
  sim.ctl.flap = 1;
  const f = { ...scan(), D: drag(0.05) };
  return { c, f, sim, def };
}

const C = tunnel(buildC172);
console.log(`C172: clean CLmax=${C.c.CLmax.toFixed(2)} Vs=${C.c.Vs.toFixed(1)} | flapped CLmax=${C.f.CLmax.toFixed(2)} Vs=${C.f.Vs.toFixed(1)} | ratio=${(C.f.Vs / C.c.Vs).toFixed(3)} | drag x${(C.f.D / C.c.D).toFixed(2)}`);
const K = tunnel(buildChinook);
console.log(`CHNK: clean CLmax=${K.c.CLmax.toFixed(2)} | full-droop CLmax=${K.f.CLmax.toFixed(2)} (${(100 * K.f.CLmax / K.c.CLmax - 100).toFixed(1)}%)`);
const P = tunnel(buildPA18);
console.log(`PA18: clean CLmax=${P.c.CLmax.toFixed(2)} Vs=${P.c.Vs.toFixed(1)} | flapped CLmax=${P.f.CLmax.toFixed(2)} Vs=${P.f.Vs.toFixed(1)} | ratio=${(P.f.Vs / P.c.Vs).toFixed(3)} | drag x${(P.f.D / P.c.D).toFixed(2)}`);

// AP flap servo: rate-limited deployment on approach
const world = makeWorld();
const def = buildC172();
const sim = makeSim(def, world);
sim.reset(0);
for (let s = 0; s < 120; s++) sim.step(1/60);
const ap = makeAutopilot(sim, def);
const rate = def.params.flaps.rate;
let flapAt1s = 0, tFull = null;
for (let s = 0; s < 20 * 60; s++) {
  ap.phase = 'APPROACH';                // pin the phase; servo targets ldg
  ap.update(1/60);
  if (s === 59) flapAt1s = sim.ctl.flap;
  if (tFull === null && sim.ctl.flap >= (def.params.flaps.ldg ?? 1) - 1e-6) tFull = (s + 1) / 60;
}
console.log(`AP servo: flap after 1 s = ${flapAt1s.toFixed(3)} (rate ${rate}/s) | full at t=${tFull} s`);

const checks = {
  'C172 Vs ratio in 0.85..0.91': C.f.Vs / C.c.Vs > 0.85 && C.f.Vs / C.c.Vs < 0.91,
  'C172 dCLmax>0.35': C.f.CLmax - C.c.CLmax > 0.35,
  'C172 flapped drag x1.15+': C.f.D / C.c.D > 1.15,
  'CHNK full-droop CLmax within 8% of clean': Math.abs(K.f.CLmax / K.c.CLmax - 1) < 0.08,
  // PA-18: slotted flaps calibrated to the POH Vs ratio 43/48 mph (~0.90)
  'PA18 Vs ratio in 0.87..0.93': P.f.Vs / P.c.Vs > 0.87 && P.f.Vs / P.c.Vs < 0.93,
  'PA18 dCLmax>0.3': P.f.CLmax - P.c.CLmax > 0.3,
  'PA18 flapped drag x1.5+': P.f.D / P.c.D > 1.5,
  'servo rate-limited (~rate after 1 s)': flapAt1s > rate * 0.8 && flapAt1s < rate * 1.2,
  'servo reaches full': tFull !== null && tFull < 1 / rate + 2,
};
const failed = Object.keys(checks).filter(k => !checks[k]);
if (failed.length) console.log(`FAILED CHECKS: ${failed.join(', ')}`);
const pass = failed.length === 0;
console.log(pass ? 'GATE FLAPS: PASS' : 'GATE FLAPS: FAIL');
process.exitCode = pass ? 0 : 1;
