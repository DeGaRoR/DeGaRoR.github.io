// GATE ATMOS — the air itself (G72).
// Pure model, no aeroplane: the ISA tables, the sea-level identity the whole
// gate battery stands on, and the two scalings the powerplant gets out of it.
//
//   src/core/05_atmos.js  ->  tools/flight_core.js  ->  here
//
// THE ASSERTION THAT MATTERS MOST is section 2. Every design-time number in
// this project — Vs, the plant gains, the synthesised prop, every anchored
// gate metric — was computed at rho = 1.225, and this file's whole reason for
// being safe is that at ISA sea level it reproduces that EXACTLY rather than
// approximately. 1.2250003 would be just as correct physically and would move
// digits in thirty-three gates for nothing.
//
// Run: node tools/test_atmos.js   (contract: one final `GATE ATMOS: ...`)

const { ATM, makeAtmos, ATMOS_ISA, atmosPowerRatio, atmosPropScale,
        GEN_RULES, POWERPLANTS, RHO, makeWorld } = require('./flight_core.js');

let fails = 0;
const fail = (m) => { console.log('  FAIL ' + m); fails++; };
const ok = (m) => console.log('  ok   ' + m);
const near = (a, b, tolPct, m) => {
  const e = Math.abs((a - b) / (b || 1)) * 100;
  (e <= tolPct ? ok : fail)(`${m}: ${a.toPrecision(7)} vs ${b} (${e.toFixed(4)}%)`);
};
const exact = (a, b, m) => (a === b ? ok : fail)(`${m}: ${a} === ${b}`);
const yes = (c, m) => (c ? ok : fail)(m);

// ---- 1. the standard atmosphere IS the standard atmosphere -----------------
// Published ISA (geopotential). We integrate on GEOMETRIC altitude, a declared
// cut worth 0.12% of the density at 8 km and nothing at all where this fleet
// flies, so the tolerance is 0.2% and the errors are printed to prove it is
// the cut and not a mistake.
console.log('--- 1. ISA table (published vs computed, tol 0.2%) ---');
const ISA_TABLE = [
  // h,     T (K),   p (Pa),   rho (kg/m3), a (m/s)
  [0,     288.15, 101325,   1.225,     340.294],
  [1000,  281.65,  89876.3, 1.11164,   336.435],
  [2000,  275.15,  79501.4, 1.00655,   332.529],
  [5000,  255.65,  54048.3, 0.736429,  320.545],
  [8000,  236.15,  35651.6, 0.525786,  308.063],
  [11000, 216.65,  22632.1, 0.363918,  295.070],
];
for (const [h, T, p, r, a] of ISA_TABLE) {
  near(ATMOS_ISA.T(h), T, 0.2, `T   @${h} m`);
  near(ATMOS_ISA.p(h), p, 0.2, `p   @${h} m`);
  near(ATMOS_ISA.rho(h), r, 0.2, `rho @${h} m`);
  near(ATMOS_ISA.a(h), a, 0.2, `a   @${h} m`);
}

// ---- 2. THE SEA-LEVEL IDENTITY ---------------------------------------------
console.log('--- 2. the sea-level identity (exact, not approximate) ---');
exact(ATMOS_ISA.rho(0), ATM.RHO0, 'rho(0)');
exact(ATM.RHO0, 1.225, 'RHO0 is the declared datum');
exact(ATMOS_ISA.sigma(0), 1, 'sigma(0)');
exact(ATMOS_ISA.densityAlt(0), 0, 'densityAlt(0)');
exact(ATMOS_ISA.pressureAlt(0), 0, 'pressureAlt(0)');
exact(ATMOS_ISA.dISA, 0, 'ISA offset');
exact(Math.sqrt(ATMOS_ISA.sigma(0)), 1, 'sqrt(sigma(0)) — the EAS factor');
for (const asp of ['na', 'electric']) {
  const s = atmosPropScale(ATMOS_ISA.sigma(0), asp);
  exact(s.kT, 1, `propScale.kT at sigma=1 (${asp})`);
  exact(s.kV, 1, `propScale.kV at sigma=1 (${asp})`);
  exact(s.power, 1, `powerRatio at sigma=1 (${asp})`);
}
// and the empty call really is the standard day
const blank = makeAtmos();
exact(blank.rho(0), 1.225, 'makeAtmos() with no argument is ISA');

// ---- 3. shape: monotone down to the tropopause, isothermal above -----------
console.log('--- 3. shape ---');
let monoT = true, monoP = true, monoR = true;
for (let h = 0; h < 11000; h += 250) {
  if (!(ATMOS_ISA.T(h + 250) < ATMOS_ISA.T(h))) monoT = false;
  if (!(ATMOS_ISA.p(h + 250) < ATMOS_ISA.p(h))) monoP = false;
  if (!(ATMOS_ISA.rho(h + 250) < ATMOS_ISA.rho(h))) monoR = false;
}
yes(monoT, 'T strictly falls to the tropopause');
yes(monoP, 'p strictly falls to the tropopause');
yes(monoR, 'rho strictly falls to the tropopause');
near(ATMOS_ISA.T(14000), ATMOS_ISA.T(11000), 1e-9, 'isothermal above 11 km');
yes(ATMOS_ISA.p(14000) < ATMOS_ISA.p(11000), 'p keeps falling above the tropopause');
// the lapse is the declared one, measured off the model rather than restated
near((ATMOS_ISA.T(0) - ATMOS_ISA.T(1000)) / 1000, ATM.L, 1e-9, 'measured lapse rate');

// ---- 4. density altitude is an altitude ------------------------------------
// On the standard day the density altitude of h IS h. That is the definition,
// and it is a real check: it closes the exponent (EXP_R, not EXP_P) that the
// inverse uses against the forward model.
console.log('--- 4. density altitude round-trip ---');
for (const h of [0, 500, 1000, 2500, 5000]) near(ATMOS_ISA.densityAlt(h), h, 1e-6, `DA(ISA ${h} m)`);
for (const h of [0, 500, 1000, 2500, 5000]) near(ATMOS_ISA.pressureAlt(h), h, 1e-6, `PA(ISA ${h} m)`);

// ---- 5. the day moves it the way a day moves it ----------------------------
console.log('--- 5. the offset day ---');
const HOT = makeAtmos({ oatC: 35 }), COLD = makeAtmos({ oatC: 0 });
near(HOT.dISA, 20, 1e-9, 'oatC 35 is ISA+20');
yes(HOT.sigma(0) < 1, `hot day is thinner (sigma ${HOT.sigma(0).toFixed(4)})`);
yes(COLD.sigma(0) > 1, `cold day is denser (sigma ${COLD.sigma(0).toFixed(4)})`);
yes(HOT.densityAlt(0) > 0, `hot sea level has a positive DA (${HOT.densityAlt(0).toFixed(0)} m)`);
yes(COLD.densityAlt(0) < 0, `cold sea level has a negative DA (${COLD.densityAlt(0).toFixed(0)} m)`);
// a hot day does NOT change the pressure altitude — only the temperature did
near(HOT.pressureAlt(0), 0, 1e-6, 'temperature alone leaves PA at 0');
// low QNH raises the pressure altitude, at the ~8.4 m/hPa every pilot knows
const LOWQ = makeAtmos({ qnhPa: 100325 });               // 1003.25 hPa, 10 low
yes(LOWQ.pressureAlt(0) > 80 && LOWQ.pressureAlt(0) < 88,
    `10 hPa low reads ${LOWQ.pressureAlt(0).toFixed(1)} m of pressure altitude (~8.4 m/hPa)`);
yes(LOWQ.sigma(0) < 1, 'low QNH is thinner air');
// THE CASE THE WHOLE CHANTIER IS ABOUT: a hot afternoon at a backcountry strip
const AFT = makeAtmos({ oatC: 35, qnhPa: 100800 });
const daStrip = AFT.densityAlt(420);
yes(daStrip > 1000 && daStrip < 1300,
    `420 m strip at 35 C flies like ${daStrip.toFixed(0)} m`);

// ---- 6. what the engine does about it --------------------------------------
console.log('--- 6. the power lapse ---');
let monoPow = true;
for (let s = 0.5; s < 1.0; s += 0.05)
  if (!(atmosPowerRatio(s, 'na') < atmosPowerRatio(s + 0.05, 'na'))) monoPow = false;
yes(monoPow, 'piston power rises monotonically with density ratio');
yes(atmosPowerRatio(1, 'electric') === 1 && atmosPowerRatio(0.6, 'electric') === 1,
    'an electric motor does not care about the air');
yes(atmosPowerRatio(0.8, 'na') < 1, `piston at sigma 0.8 makes ${(atmosPowerRatio(0.8, 'na') * 100).toFixed(1)}% power`);
yes(atmosPowerRatio(0.8, 'na') < 0.8,
    'Gagg-Ferrar is WORSE than linear in sigma (that is why it is carried)');
yes(atmosPowerRatio(0.05, 'na') === 0, 'the lapse clamps at zero, never negative');

// ---- 7. and what the propeller does about that -----------------------------
// The claim in 05_atmos.js is that the two scalings are not asserted but fall
// out of 60_gen_spec's own three-line prop synthesis. This section checks that
// claim the only way it can be checked: RE-SYNTHESISE the prop at the moved
// (rho, P) from first principles and compare against the closed form.
console.log('--- 7. the prop scaling is the synthesis, re-derived ---');
const FM = 0.46, AREA = Math.PI * 0.865 * 0.865, P0 = 59600;
const V0K = GEN_RULES.propV0K;
const synth = (rho, P) => {
  const Tst = FM * Math.cbrt(2 * rho * AREA) * Math.pow(P, 2 / 3);
  const V0 = V0K * P / Math.max(1, Tst);
  return { Tst, kV2: Tst / (V0 * V0) };
};
const base = synth(ATM.RHO0, P0);
for (const sig of [1, 0.93, 0.80, 0.65]) for (const asp of ['na', 'electric']) {
  const sc = atmosPropScale(sig, asp);
  const got = synth(ATM.RHO0 * sig, P0 * atmosPowerRatio(sig, asp));
  near(base.Tst * sc.kT, got.Tst, 1e-6, `Tstatic  sigma ${sig} ${asp}`);
  near(base.kV2 * sc.kV, got.kV2, 1e-6, `kV2      sigma ${sig} ${asp}`);
}
// the two derivation claims worth stating as checks, not as comments
for (const sig of [0.93, 0.80, 0.65]) {
  const a = atmosPropScale(sig, 'na'), b = atmosPropScale(sig, 'electric');
  yes(a.kV === b.kV, `kV2 scales as sigma for BOTH families (sigma ${sig})`);
  yes(b.kT > a.kT, `electric keeps more static thrust (${b.kT.toFixed(3)} vs ${a.kT.toFixed(3)}) at sigma ${sig}`);
}

// ---- 8. the declared field, on every row ------------------------------------
// A powerplant row that forgets `aspiration` gets 'na' by default and lapses
// like a piston, which for an electric motor is silently and badly wrong. It is
// a DECLARED physics-bearing field, so it is checked like one — this is the
// assertion that a new registry row cannot skip it.
console.log('--- 8. every powerplant declares what it breathes ---');
const keys = Object.keys(POWERPLANTS);
let missing = [], bad = [], nEl = 0;
for (const k of keys) {
  const a = POWERPLANTS[k].engine && POWERPLANTS[k].engine.aspiration;
  if (a == null) missing.push(k);
  else if (a !== 'na' && a !== 'electric') bad.push(k + '=' + a);
  if (a === 'electric') nEl++;
}
yes(missing.length === 0, `all ${keys.length} rows declare an aspiration` +
    (missing.length ? ' — MISSING: ' + missing.join(', ') : ''));
yes(bad.length === 0, "every value is 'na' or 'electric'" + (bad.length ? ' — BAD: ' + bad.join(', ') : ''));
yes(nEl > 0 && nEl < keys.length, `the table has both kinds (${nEl} electric, ${keys.length - nEl} breathing)`);
// and the datum the whole project is anchored at is one number, not two
exact(RHO, ATM.RHO0, 'RHO and ATM.RHO0 are the same datum');

// ---- 9. the wind grows a vertical dimension ---------------------------------
// `wind(x, y, z, t)` has taken a y since it was written and never read one.
// These are the checks that it now does, and — just as important — that it
// still does not when nobody said where the wind was measured.
console.log('--- 9. the surface layer ---');
{
  const W = makeWorld();
  const at = (y) => { const v = W.wind(0, y, 0, 0); return Math.hypot(v[0], v[1], v[2]); };
  // no weather: exact zeros, the fast path every calm gate depends on
  yes(at(0) === 0 && at(500) === 0, 'no wind set is exactly zero at every height');
  // NO refH: a uniform column, which is the pre-G72 model the fleet is
  // calibrated in — this is the check that the old behaviour is still reachable
  W.setWind({ base: [0, 0, 3], gust: 0 });
  const flat = [0.5, 10, 100, 500].map(at);
  yes(flat.every(v => Math.abs(v - 3) < 1e-12),
      'a wind with no reference height is the same at every height');
  // WITH refH: the reported speed is at that height, and the column shears
  W.setWind({ base: [0, 0, 3], gust: 0, refH: 10 });
  near(at(10), 3, 1e-9, 'the reported wind IS the wind at 10 m');
  yes(at(1) < at(10) && at(10) < at(50) && at(50) < at(200),
      `it shears: ${at(1).toFixed(2)} / ${at(10).toFixed(2)} / ${at(50).toFixed(2)} / ${at(200).toFixed(2)} m/s at 1 / 10 / 50 / 200 m`);
  yes(Math.abs(at(600) - at(400)) < 1e-9, 'and it stops shearing above the surface layer');
  yes(at(0.05) > 0.4 * at(10),
      'the power law is floored rather than allowed to reach zero');
  // ROUGHNESS: a smoother surface shears less
  W.setWind({ base: [0, 0, 3], gust: 0, refH: 10, alpha: 0.10 });
  const smooth = at(200);
  W.setWind({ base: [0, 0, 3], gust: 0, refH: 10, alpha: 0.20 });
  yes(at(200) > smooth, `rougher ground shears more (${at(200).toFixed(2)} vs ${smooth.toFixed(2)} m/s at 200 m)`);
  // GUSTS RIDE THE LOCAL WIND: at a given instant the gust content near the
  // ground is smaller than it is aloft. Measured as spread over one cycle so
  // the check does not depend on which phase of the sines it lands on.
  const spread = (y) => {
    W.setWind({ base: [0, 0, 3], gust: 1.5, refH: 10 });
    let lo = 1e9, hi = -1e9;
    for (let t = 0; t < 30; t += 0.25) { const v = W.wind(0, y, 0, t); const m = Math.hypot(v[0], v[1], v[2]); lo = Math.min(lo, m); hi = Math.max(hi, m); }
    return hi - lo;
  };
  yes(spread(2) < spread(200), `gusts are milder near the ground (${spread(2).toFixed(2)} vs ${spread(200).toFixed(2)} m/s of spread)`);
  W.setWind(null);
  yes(at(0) === 0 && at(300) === 0, 'and clearing the weather restores the exact zero');
}

// ---- verdict ----------------------------------------------------------------
const s420 = AFT.sigma(420);
console.log(`ISA to 0.2% over 11 km; sea level exact; hot-and-high 420 m / 35 C ` +
            `= DA ${daStrip.toFixed(0)} m, sigma ${s420.toFixed(3)}, ` +
            `piston thrust ${(atmosPropScale(s420, 'na').kT * 100).toFixed(0)}%, ` +
            `electric ${(atmosPropScale(s420, 'electric').kT * 100).toFixed(0)}%`);
console.log(`GATE ATMOS: ${fails ? 'FAIL (' + fails + ' check' + (fails > 1 ? 's' : '') + ')' : 'PASS'}`);
process.exit(fails ? 1 : 0);
