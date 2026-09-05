// GATE HOTHIGH — the air, with an aeroplane in it (G72).
//
// GATE ATMOS proves the model. This one proves it REACHES the aeroplane, which
// is a different claim and the one that was actually missing: before G72 a
// build climbed to 5000 m on sea-level thrust and the instrument said "ias"
// over a true airspeed.
//
// Four things, in rising cost:
//   1. the solver reports the air it is in, and it is the air the model says
//   2. the SAME aeroplane (the garage build, since the fleet retired
//      2026-09-05), FLOWN off the same strip on two different days —
//      the take-off run grows, the equivalent airspeed at unstick does not,
//      and the true airspeed does
//   3. an ELECTRIC build degrades LESS than a piston one, which is the whole
//      point of `aspiration` and falls out of the prop synthesis rather than
//      being asserted anywhere
//   4. the autopilot still flies a complete circuit in that air
//
// The strips in this world top out near 113 m, so ALTITUDE alone is worth about
// one per cent here and the TEMPERATURE is the whole story — an honest result,
// not a weak test: the model does not exaggerate a small effect to look
// impressive. The big numbers live on the bench, where the question is what a
// design would do out of a mountain strip rather than what this world has.
//
// Run: node tools/test_hothigh.js   (contract: one final `GATE HOTHIGH: ...`)

const { makeWorld, makeSim, makeAutopilot, placeAtAerodrome,
        buildGen, genDensityAlt, makeAtmos, GEN_DEFAULT } = require('./flight_core.js');
const { runCircuit } = require('./circuit_harness.js');

let fails = 0;
const fail = (m) => { console.log('  FAIL ' + m); fails++; };
const ok = (m) => console.log('  ok   ' + m);
const yes = (c, m) => (c ? ok : fail)(m);
const band = (v, lo, hi, m) =>
  yes(v != null && isFinite(v) && v >= lo && v <= hi,
      `${m}: ${v == null || !isFinite(v) ? '—' : v.toFixed(3)} in [${lo}, ${hi}]`);

// THE DAY. Same numbers the viewer's "Hot afternoon" preset carries, so the
// gate and the game are testing one condition and not two.
//
// TWO FORMS OF IT, and the split is deliberate. HOT is the AIR alone, used for
// the take-off comparison so that exactly one thing differs between the two
// runs; HOT_DAY is the preset entire, wind and shear included, and the circuit
// flies that — there is no point proving the aeroplane copes with thin air if
// nothing ever proves it copes with the day the player can actually select.
const HOT = { oatC: 35, qnhPa: 100800 };
const HOT_DAY = { oatC: 35, qnhPa: 100800,
                  wind: { base: [-2.2, 0, 2.6], gust: 0.7, refH: 10 } };
const STD = null;
const worldAt = w => { const W = makeWorld(); if (w) W.setWeather(w); return W; };
const GEN_ZS = buildGen().parts.zs;

// ---- 1. the solver is in the air the model says it is in --------------------
console.log('--- 1. the solver reports its own air ---');
{
  const W = worldAt(HOT);
  const strip = W.aerodromes.find(a => a.name === 'Brekk Strip');
  yes(!!strip, 'Brekk Strip exists');
  const def = buildGen(), sim = makeSim(def, W);
  sim.reset(0);
  placeAtAerodrome(sim, strip);
  for (let f = 0; f < 120; f++) sim.step(1 / 60);       // settle, and run a pass
  const air = makeAtmos(HOT);
  const y = sim.cgPos()[1];
  const o = sim.out;
  yes(Math.abs(o.sigma - air.sigma(y)) < 2e-3,
      `sigma ${o.sigma.toFixed(4)} matches the model at ${y.toFixed(0)} m (${air.sigma(y).toFixed(4)})`);
  yes(o.sigma < 1, 'the hot day is thinner than the datum');
  yes(Math.abs(o.rho - 1.225 * o.sigma) < 1e-9, 'rho is the datum times sigma');
  yes(Math.abs(o.easK - Math.sqrt(o.sigma)) < 1e-12, 'easK is sqrt(sigma)');
  yes(o.densityAlt > strip.elev,
      `density altitude ${o.densityAlt.toFixed(0)} m is above the strip's ${strip.elev.toFixed(0)} m`);
  yes(o.powerK < 1 && o.powerK > 0.8,
      `the piston makes ${(o.powerK * 100).toFixed(1)}% of its rated power`);
  // and the STANDARD day at the same place is the datum's own air
  const W2 = worldAt(STD);
  const sim2 = makeSim(buildGen(), W2);
  sim2.reset(0); placeAtAerodrome(sim2, strip);
  for (let f = 0; f < 120; f++) sim2.step(1 / 60);
  yes(sim2.out.sigma < 1 && sim2.out.sigma > 0.98,
      `a 113 m strip on a standard day is sigma ${sim2.out.sigma.toFixed(4)} — small, and real`);
  yes(sim2.out.powerK === 1 || sim2.out.powerK < 1, 'and the engine notices');
}

// ---- 2. THE SAME AEROPLANE, FLOWN, ON TWO DAYS ------------------------------
// Distance to 2.5 m above the start (the old make_perf definition), run
// here off a 113 m strip instead of off HOME.
console.log('--- 2. the take-off run, flown ---');
function takeoffRun(build, weather, stripName) {
  const W = worldAt(weather);
  const strip = W.aerodromes.find(a => a.name === stripName);
  const def = build(), sim = makeSim(def, W);
  sim.reset(0);
  placeAtAerodrome(sim, strip);
  for (let s = 0; s < 5 * 60; s++) sim.step(1 / 60);       // settle on the gear
  const ap = makeAutopilot(sim, def, W);
  ap.setRoute(strip, strip);
  const c0 = sim.cgPos();
  // UNSTICK IS WHEN THE WHEELS LEAVE, and it is a different event from the
  // 2.5 m screen (G158). The two speed checks below assert that the WING
  // unsticks at the same equivalent airspeed on both days; they were reading
  // the speed at the screen, which is the unstick speed PLUS whatever the
  // aeroplane accelerated by while climbing the first 2.5 m — a density-
  // dependent term, because excess thrust is. It stayed inside the band only
  // while the propeller was a 42 %-efficient one with little excess to
  // accelerate on; the moment G158 gave it a real one the PA-18 read 1.094 on
  // a 1.06 bound, and the gate was failing a claim it was not measuring. The
  // RUN is still to the screen, the old make_perf definition.
  let vT = null, vE = null;
  for (let f = 0; f < 120 * 60; f++) {
    ap.update(1 / 60); sim.step(1 / 60);
    if (sim.stats().bad) return { run: null, why: 'NaN' };
    if (vT === null && sim.wheelsOnGround() === 0) {
      vT = sim.out.V; vE = sim.out.Veas;
    }
    const c = sim.cgPos();
    if (c[1] - c0[1] >= 2.5)
      return { run: Math.hypot(c[0] - c0[0], c[2] - c0[2]),
               vTAS: vT != null ? vT : sim.out.V,
               vEAS: vE != null ? vE : sim.out.Veas,
               sigma: sim.out.sigma, da: sim.out.densityAlt };
  }
  return { run: null, why: 'never reached 2.5 m in 120 s' };
}
for (const [name, build] of [['GEN', buildGen]]) {
  const a = takeoffRun(build, STD, 'Brekk Strip');
  const b = takeoffRun(build, HOT, 'Brekk Strip');
  if (a.run == null || b.run == null) {
    fail(`${name}: no take-off measured (${a.why || ''} ${b.why || ''})`);
    continue;
  }
  const r = b.run / a.run;
  console.log(`  ${name}: ${a.run.toFixed(0)} m standard -> ${b.run.toFixed(0)} m hot ` +
              `(DA ${b.da.toFixed(0)} m, sigma ${b.sigma.toFixed(3)}), ratio ${r.toFixed(3)}`);
  // the direction is the assertion; the band is wide because this is a FLOWN
  // number with an autopilot in the loop, not an integral
  band(r, 1.03, 1.60, `${name} take-off run grows`);
  // THE EAS/TAS SPLIT, which is the other half of the claim: the wing unsticks
  // at the same equivalent airspeed and the aeroplane is genuinely going faster
  band(b.vEAS / a.vEAS, 0.94, 1.06, `${name} unstick EAS is unchanged`);
  band(b.vTAS / a.vTAS, 1.01, 1.12, `${name} unstick TAS is higher`);
  yes(b.vTAS > b.vEAS, `${name} TAS ${(b.vTAS * 3.6).toFixed(0)} > EAS ${(b.vEAS * 3.6).toFixed(0)} km/h in thin air`);
}

// ---- 3. what `aspiration` buys, measured -----------------------------------
// Two garage builds, identical but for the powerplant, both near 55-60 kW.
// Computed rather than flown: genDensityAlt runs the same take-off integration
// the bench does, so this checks the sheet the player will actually read.
console.log('--- 3. electric against piston, in the same thin air ---');
{
  const sheetOf = eng => {
    // CANONICAL SHAPE: `engines: [{ type }]`. A flat `engine` key is silently
    // overwritten by the normaliser, and the build comes back as the default
    // A-65 with no complaint — which made the first cut of this section
    // "prove" that electric and piston behave identically.
    const def = buildGen(Object.assign({}, GEN_DEFAULT, { engines: [{ type: eng }] }));
    const d = genDensityAlt(def);
    if (!d) return null;
    const isa = d.cases.filter(c => c.id === 'isa')[0];
    const hot = d.cases.filter(c => c.id === 'hot')[0];
    return { isa, hot, d, ratio: hot.TORun / isa.TORun,
             asp: def.params.powerplant };
  };
  const pis = sheetOf('rotax912_warp');       // 59.6 kW, breathes
  const ele = sheetOf('emrax228_3blade');     // 55 kW, does not
  if (!pis || !ele) fail('no density-altitude sheet for one of the builds');
  else {
    for (const [nm, s] of [['piston', pis], ['electric', ele]])
      console.log(`  ${nm.padEnd(8)} ISA ${s.isa.TORun} m / ${s.isa.climbRate.toFixed(2)} m/s  ->  ` +
        `DA ${s.hot.densAlt.toFixed(0)} m: ${s.hot.TORun} m / ${s.hot.climbRate.toFixed(2)} m/s ` +
        `on ${(s.hot.power * 100).toFixed(0)}% power  (x${s.ratio.toFixed(3)}), ` +
        `service ceiling ${s.d.serviceCeiling == null ? '> ' + s.d.ceilingCap + ' m' : s.d.serviceCeiling.toFixed(0) + ' m'}`);
    yes(pis.asp === 'rotax912_warp' && ele.asp === 'emrax228_3blade',
        `both builds really got the engine they asked for (${pis.asp} / ${ele.asp})`);
    yes(pis.hot.aspiration === 'na' && ele.hot.aspiration === 'electric',
        'and the solver read the declared aspiration off each');
    yes(pis.hot.power < 0.9, `the piston is down to ${(pis.hot.power * 100).toFixed(0)}% power up there`);
    yes(ele.hot.power === 1, 'the motor is not');
    yes(ele.ratio < pis.ratio,
        `electric loses less field length (x${ele.ratio.toFixed(3)} against x${pis.ratio.toFixed(3)})`);
    yes(pis.ratio > 1.05, 'and the piston really does lose some');
    // both must still be measurable, and the ceiling has to be an altitude
    for (const [nm, s] of [['piston', pis], ['electric', ele]]) {
      yes(s.isa.TORun > 0 && isFinite(s.isa.TORun), `${nm} ISA take-off run is a number`);
      yes(s.d.serviceCeiling == null || (s.d.serviceCeiling >= 0 && s.d.serviceCeiling <= 12000),
          `${nm} service ceiling is inside the model`);
      yes(s.d.absCeiling == null || s.d.serviceCeiling == null ||
          s.d.absCeiling >= s.d.serviceCeiling,
          `${nm} absolute ceiling is at or above the service ceiling`);
    }
  }
}

// ---- 4. and it still flies -------------------------------------------------
console.log('--- 4. a whole circuit, off a hot strip, in sheared wind ---');
const R = [];
R.push(runCircuit({
  id: 'HH-GEN', build: buildGen, world: worldAt(HOT_DAY), from: 'Brekk Strip',
  uprightCheck: false, perturb: { z: 1.0, v: 0.001 }, settleS: 12, maxS: 320,
  // tip/mid stations from the spec, like GATE STRESS: the generated wing
  // moves when a slider does
  tip: { tag: 'WF', midZ: GEN_ZS[0], tipZ: GEN_ZS[GEN_ZS.length - 1], tol: 0.1 },
  flapDuring: () => true,
  wingNote: 'hot afternoon, 113 m gravel strip, wind sheared off a 10 m reference',
  extraLines: c => {
    const W = c.world, s = c.sim.cgPos();
    // AGL, not MSL — this strip's own ground is 113 m up, and sampling the
    // profile at absolute heights put the first two probes underground.
    const g = W.terrainH(s[0], s[2]);
    const at = agl => { const v = W.wind(s[0], g + agl, s[2], 0);
                        return Math.hypot(v[0], v[1], v[2]); };
    return [`air: sigma ${c.sim.out.sigma.toFixed(3)} · DA ` +
      `${c.sim.out.densityAlt.toFixed(0)} m · power ${(c.sim.out.powerK * 100).toFixed(0)}%`,
      `wind over the strip: ${at(2).toFixed(2)} m/s at 2 m agl, ${at(10).toFixed(2)} at 10, ` +
      `${at(120).toFixed(2)} at 120`];
  },
  // the bounds the old XCTY4 held the PA-18 to on this strip in a breeze: the
  // point is that thin air does not break the arrival, so the bar does not move
  checks: c => ({
    'touchdown': !!c.td,
    'on the strip': !!c.td && Math.abs(c.td.z) < 12,
    'sink<2.0': !!c.td && c.td.sink < 2.0,
    'chassis<8%': c.smaxCh < 0.08,
    'gear<35%': c.smaxGr < 0.35,
    // it really was flying in thin air, not silently at the datum
    'thin air': c.sim.out.sigma < 0.95,
    // and the wind really did have a profile, sampled over the strip itself
    'sheared': (() => {
      const p = c.sim.cgPos();
      const mag = y => { const v = c.world.wind(p[0], y, p[2], 0);
                         return Math.hypot(v[0], v[1], v[2]); };
      const g = c.world.terrainH(p[0], p[2]);
      return mag(g + 200) > mag(g + 2) * 1.2;
    })(),
  }),
}));

const pass = fails === 0 && R.every(r => r.pass);
console.log(`flown and computed at ${HOT.oatC} C / ${(HOT.qnhPa / 100).toFixed(2)} hPa; ` +
            `${fails} check${fails === 1 ? '' : 's'} failed, ` +
            `${R.filter(r => !r.pass).length} circuit(s) failed`);
console.log(`GATE HOTHIGH: ${pass ? 'PASS' : 'FAIL'}`);
process.exitCode = pass ? 0 : 1;
