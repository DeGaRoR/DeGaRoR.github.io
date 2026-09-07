// High-lift gate: free-air tunnel, clean vs flapped, on the GARAGE BUILD —
// the flapped CLmax and the Vs ratio the generator's own flap synthesis
// (GEN_FLAPS, genClMax) hands the solver — plus the AP flap-servo rate limit.
//
// Until 2026-09-05 this measured the C172 (POH Vs0/Vs1 ratio), the Chinook
// (flaperons must not destroy CLmax) and the PA-18 (POH 43/48 mph); those
// fiches retired with the hand-written fleet and the garage build is the
// only aeroplane now. Its bands are the build's OWN measured numbers with
// margin (regression bands, not a POH). The stock build has NO flap
// (controls.flap.type 'none'), so the subject is the stock build with the
// SLOTTED flap declared — the same family the PA-18 fiche was calibrated on
// (POH ratio ~0.90), and what genClMax hands the AP's approach speeds.
const { buildGen, makeSim, makeAutopilot, makeWorld } = require('./flight_core.js');
const FLAPPED = { controls: { flap: { type: 'slotted' } } };
const buildFlapped = () => buildGen(JSON.parse(JSON.stringify(FLAPPED)));

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

const G = tunnel(buildFlapped);
console.log(`GEN : clean CLmax=${G.c.CLmax.toFixed(2)} Vs=${G.c.Vs.toFixed(1)} | flapped CLmax=${G.f.CLmax.toFixed(2)} Vs=${G.f.Vs.toFixed(1)} | ratio=${(G.f.Vs / G.c.Vs).toFixed(3)} | drag x${(G.f.D / G.c.D).toFixed(2)}`);

// AP flap servo: rate-limited deployment on approach
const world = makeWorld();
const def = buildFlapped();
// TAIL CHANTIER 2 P5 (2026-09-08, RULING OWED — HANDOVER G219, DEBT-REGISTER
// §1): under the vortex downwash every build flies now, the trim solver
// measures the stock's flapped approach at −0.28 rad of elevator and LANDS
// IT FLAPLESS (flaps.ldg 0) — the constant model read +0.035 and kept the
// flaps. This block tests the SERVO's rate, not the trim solver's verdict,
// so the flaps are held by fiat here and said so; the ruling decides the rest
if (!(def.params.flaps.ldg > 0)) {
  console.log('  (the trim solver landed this build flapless — flaps held at 1 for the servo row; RULING OWED)');
  def.params.flaps.ldg = 1;
}
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
  // measured 2026-09-05 on the stock build + slotted flap: ratio 0.846,
  // dCLmax 0.60, drag x3.36 — the bands sit around those with margin
  'GEN Vs ratio in 0.80..0.95': G.f.Vs / G.c.Vs > 0.80 && G.f.Vs / G.c.Vs < 0.95,
  'GEN dCLmax>0.4': G.f.CLmax - G.c.CLmax > 0.4,
  'GEN flapped drag x2+': G.f.D / G.c.D > 2.0,
  'servo rate-limited (~rate after 1 s)': flapAt1s > rate * 0.8 && flapAt1s < rate * 1.2,
  'servo reaches full': tFull !== null && tFull < 1 / rate + 2,
};
const failed = Object.keys(checks).filter(k => !checks[k]);
if (failed.length) console.log(`FAILED CHECKS: ${failed.join(', ')}`);
const pass = failed.length === 0;
console.log(pass ? 'GATE FLAPS: PASS' : 'GATE FLAPS: FAIL');
process.exitCode = pass ? 0 : 1;
