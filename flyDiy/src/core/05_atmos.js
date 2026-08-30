// ============================================================
// THE ATMOSPHERE — pressure, temperature and density with height.
// Units: m, K, Pa, kg/m3, m/s. Altitude `h` is metres above MEAN SEA LEVEL,
// which is what the solver's node y already is (placeAtAerodrome offsets every
// node by the strip's own elev, so a build sitting on a 420 m bench has y=420).
//
// ONE MODEL, FOUR LINES. A constant-lapse-rate atmosphere, integrated exactly
// rather than approximated:
//
//     T(h) = Tsl - L h                          Tsl = 288.15 + dISA
//     p(h) = psl (T(h)/Tsl)^(g0/(L R))          psl = QNH
//     rho  = p / (R T)
//     a    = sqrt(gamma R T)
//
// At dISA = 0 and QNH = 101325 those ARE the ISA troposphere — the tables come
// out to better than 0.02% without a single fitted constant. The point of
// writing it this way rather than as the usual "add 120 ft of density altitude
// per degree above standard" is that the offset day is then exact too: a
// 35-degree afternoon is the same four lines, not a correction bolted onto
// them.
//
// WHAT IS COMPUTED AND WHAT IS CHOSEN. Everything above is computed. The only
// things ever chosen are the two numbers that describe the DAY — the sea-level
// temperature offset and the QNH — and those are weather, which is a decision
// by definition. There is no third knob, and a preset that wants a different
// density has to say which of those two it is moving.
//
// RHO0 = 1.225 is the SAME number as RHO in 00_registry.js and that is not a
// duplicate: it is the reference density, the datum that defines equivalent
// airspeed and the air in which every design-time number in this project (Vs,
// the plant gains, the synthesised prop) is computed. The solver's air varies;
// the datum does not.
//
// HONEST CUTS, all small and all named:
//   - `h` is GEOMETRIC altitude, not geopotential. The difference is 0.03% of
//     the pressure at 1 km and 0.3% at 11 km — below the noise of everything
//     that reads this.
//   - Dry air only. Saturated air at 30 C is under 1% lighter than dry, which
//     is smaller than the gust field's own amplitude.
//   - Above the tropopause it goes isothermal, which is correct, and irrelevant
//     to a fleet whose best climber runs out under 6 km.
// ============================================================

const ATM = {
  T0: 288.15,        // K   ISA sea-level temperature
  P0: 101325,        // Pa  ISA sea-level pressure
  RHO0: 1.225,       // kg/m3  the EAS datum (== RHO)
  L: 0.0065,         // K/m tropospheric lapse rate
  R: 287.0528,       // J/(kg K) specific gas constant, dry air
  G0: 9.80665,       // m/s2 standard gravity
  GAMMA: 1.4,
  HTROP: 11000,      // m   tropopause
};
// g0/(L R) = 5.25588. The density exponent is one less, and it is the one the
// density-altitude inverse needs, so both are named rather than re-typed.
ATM.EXP_P = ATM.G0 / (ATM.L * ATM.R);
ATM.EXP_R = ATM.EXP_P - 1;

// makeAtmos({ oatC, qnhPa }) — the day. Both optional; the empty call is ISA.
//   oatC   sea-level outside air temperature in Celsius (or pass dISA directly)
//   qnhPa  sea-level pressure in Pa (1013.25 hPa = 101325)
function makeAtmos(cfg) {
  const c = cfg || {};
  const dISA = c.oatC != null ? (c.oatC + 273.15) - ATM.T0 : (c.dISA || 0);
  const Tsl = ATM.T0 + dISA;
  const psl = c.qnhPa != null ? c.qnhPa : ATM.P0;
  const Tt = Tsl - ATM.L * ATM.HTROP;                       // tropopause temp
  const pt = psl * Math.pow(Tt / Tsl, ATM.EXP_P);           // and pressure
  const T = h => (h <= ATM.HTROP ? Tsl - ATM.L * h : Tt);
  const p = h => (h <= ATM.HTROP
    ? psl * Math.pow((Tsl - ATM.L * h) / Tsl, ATM.EXP_P)
    : pt * Math.exp(-ATM.G0 * (h - ATM.HTROP) / (ATM.R * Tt)));
  // DENSITY AS A RATIO TO THE DATUM, not as p/(R T) — and the reason is the
  // whole invariant this file exists to protect. p0/(R T0) is 1.2250003, not
  // 1.225: ISA's sea-level density is a ROUNDED number, so computing it from
  // the gas law lands 2.6e-7 away from the constant every design-time number in
  // this project was derived at, and sigma(0) comes out 1.0000003 instead of 1.
  // That is enough to move a printed digit somewhere in a 33-gate battery for
  // no physical reason at all. Expressed as a ratio the gas law is identical
  // (both terms are exactly 1 at ISA sea level, by construction) and the datum
  // stays the declared 1.225 rather than a coincidence.
  const sigma = h => (p(h) / ATM.P0) * (ATM.T0 / T(h));
  const rho = h => ATM.RHO0 * sigma(h);
  const a = h => Math.sqrt(ATM.GAMMA * ATM.R * T(h));
  // The altitude at which the STANDARD atmosphere has this density — the
  // number that actually predicts performance, and the one a pilot quotes.
  const densityAlt = h =>
    (ATM.T0 / ATM.L) * (1 - Math.pow(sigma(h), 1 / ATM.EXP_R));
  // Pressure altitude: what the altimeter reads with 1013 set.
  const pressureAlt = h => (ATM.T0 / ATM.L) * (1 - Math.pow(p(h) / ATM.P0, 1 / ATM.EXP_P));
  return { dISA, Tsl, psl, T, p, rho, sigma, a, densityAlt, pressureAlt,
           oatC: Tsl - 273.15 };
}

// The standard day. Used wherever there is no world to ask — genShakedown builds
// its sim with world = null, and a wind-tunnel probe must never be in weather.
const ATMOS_ISA = makeAtmos({});

// ---- what the powerplant does about it -------------------------------------
// A NATURALLY ASPIRATED PISTON breathes the air, so its shaft power falls with
// density: Gagg & Ferrar's 1934 correlation, still the one every performance
// manual uses, P/P0 = 1.132 sigma - 0.132. It is slightly worse than linear in
// sigma, which is why it is worth carrying rather than writing P ~ rho.
//
// AN ELECTRIC MOTOR DOES NOT. Its shaft power is set by the pack and the
// controller, and thin air neither helps nor hinders it — the only thing that
// changes is what the propeller can do with it. That difference is real, it is
// large (a piston loses a quarter of its thrust where a motor loses a
// twentieth), and it costs one declared field on the registry row.
function atmosPowerRatio(sig, aspiration) {
  if (aspiration === 'electric') return 1;
  // Written as 1 - 1.132(1 - sigma) rather than 1.132 sigma - 0.132. Same line,
  // but this one returns EXACTLY 1 at sigma = 1 instead of 1 + 2e-16.
  return Math.max(0, 1 - 1.132 * (1 - sig));
}

// ---- and what the PROPELLER does about THAT ---------------------------------
// Not asserted. Re-derived from the same three lines 60_gen_spec.js already uses
// to synthesise a prop from its disc:
//
//     Tstatic = fm (2 rho A)^(1/3) P^(2/3)
//     V0      = propV0K P / Tstatic
//     kV2     = Tstatic / V0^2
//
// Hold fm, A and propV0K fixed, move rho and P, and the ratios fall out:
//
//     kT = sigma^(1/3) (P/P0)^(2/3)          Tstatic ratio
//     kV = kT / (V0ratio)^2 = sigma          kV2 ratio  — for BOTH families
//
// kV2 is sigma either way, which is not a coincidence: kV2 = Tstatic^3/(k P)^2,
// so the P dependence cancels exactly and only the rho^(1/3) cubed survives.
// The two families differ in kT alone — sigma for the piston (its power lapses
// too), sigma^(1/3) for the motor (only the disc is thinner). At sigma = 1 both
// are exactly 1, which is the identity the whole gate battery stands on.
function atmosPropScale(sig, aspiration) {
  const pr = atmosPowerRatio(sig, aspiration);
  const kT = Math.cbrt(sig) * Math.pow(pr, 2 / 3);
  return { kT, kV: sig, power: pr };
}
