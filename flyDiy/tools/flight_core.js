// GENERATED FILE - DO NOT EDIT. Built from src/core/ by tools/build.js.
// body-sha256: 7714f08d0b111256
// ============================================================
// CUB FLIGHT CORE — M1
// node-beam chassis + strip-theory aero + prop + ground
// Units: m, kg, N, s, rad. Axes: x aft (nose -x), y up, z right.
// ============================================================

// THE REFERENCE DENSITY, and it is a datum rather than "the density". Every
// design-time number in this project is computed in this air — Vs, the plant
// gains and their derivatives, the synthesised propeller, every anchored gate
// metric — and it is what defines EQUIVALENT airspeed. The air the solver
// actually flies in varies with height and with the day (05_atmos.js); this
// does not. ATM.RHO0 is the same number, and 05_atmos.js keeps them exactly
// equal on purpose.
const RHO = 1.225;


// ============================================================
// REGISTRIES — powerplants (engine + propeller) and airfoil polars.
// Thrust model per prop: T = thr * max(0, Tstatic - kV2 * V^2),
// propwash from momentum theory over the actual disk.
// ============================================================
// `price` is what the powerplant COSTS, in credits, second-hand and installed —
// added for the GARAGE's build ledger (G3). Inert for the hand-written fiches.
//
// `aspiration` is PHYSICS-BEARING (G72) and is the only thing in this table the
// atmosphere reads. It says how this engine's shaft power responds to thin air:
//   'na'       breathes it, so power lapses with density (Gagg-Ferrar)
//   'electric' does not — the power comes out of the pack, and only the
//              PROPELLER notices the altitude
// The difference is large enough to change which aeroplane gets out of a
// mountain strip in August, which is exactly why it is declared per row rather
// than sniffed from the name. See 05_atmos.js for both scalings.
//
// `family` + `cooling` are PHYSICS-BEARING too (G134): the thermo laws below
// read them — specific consumption for the coming burn model, and the heat a
// cowl must reject for the coming ventilation model. Declared per row for the
// same reason aspiration is: a 582 is liquid-cooled and a 912 carries
// radiators, and sniffing that from a name is how a table starts lying.
//   family   'four' | 'two' | 'electric'   (fires-per-rev + the SFC class)
//   cooling  'air'  | 'liquid'             (fins vs a radiator carry the heat)
//
// AN HONEST CUT, named here because it is a real aeroplane getting a wrong
// number: the R-1830 Twin Wasp was SUPERCHARGED, and a supercharged engine
// holds its power to its critical altitude instead of lapsing from sea level.
// We have no blower model, so it is declared 'na' and the DC-3 therefore loses
// more at altitude than the real one did. 'turbo' is reserved for when there
// is something behind it; a field that lies quietly is worse than one that is
// missing.
const POWERPLANTS = {
  a65_sensenich74: {
    price: 9000,
    engine: { name: 'Continental A-65', mass: 80, powerW: 48500, aspiration: 'na', family: 'four', cooling: 'air' },
    prop:   { name: 'Sensenich 74CK', D: 1.88, Tstatic: 900, kV2: 0.26 },
  },
  r1830_hs23e50: {
    price: 65000,
    engine: { name: 'P&W R-1830 Twin Wasp', mass: 750, powerW: 895000, aspiration: 'na', family: 'four', cooling: 'air' },
    prop:   { name: 'Hamilton Standard 23E50', D: 3.4, Tstatic: 11000, kV2: 0.543 },
  },
  io360_mccauley: {
    price: 38000,
    engine: { name: 'Lycoming IO-360-L2A', mass: 138, powerW: 134000, aspiration: 'na', family: 'four', cooling: 'air' },
    prop:   { name: 'McCauley 1C235 fixed-pitch', D: 1.93, Tstatic: 2290, kV2: 0.136 },
  },
  rotax277_pusher: {
    price: 3500,
    engine: { name: 'Rotax 277 (pusher)', mass: 30, powerW: 21000, aspiration: 'na', family: 'two', cooling: 'air' },
    prop:   { name: '2-pale bois 1.42 m', D: 1.42, Tstatic: 800, kV2: 0.545 },
  },
  // THE MIDDLE OF THE MARKET. The six entries above skip from a 3 500 cr
  // two-stroke straight to a 9 000 cr A-65 and then to 24 000, which left the
  // garage with no way to build the aeroplane most people actually build: the
  // cheapest engine that will fly two seats cost 9 000, and the next one up
  // cost 24 000. That gap — not the airframe — is why a build could not come
  // in under 30-40k. These four fill it, in both price AND power (21 -> 44 ->
  // 48 -> 48.5 -> 59.6 -> 63 -> 74.6 kW).
  //
  // Tstatic is on the A-65's OWN curve: static thrust of a fixed-pitch prop
  // goes as P^(2/3) D^(2/3), and the A-65 entry is the one the Cub's flight
  // numbers were validated against (433 fpm, 151 m take-off run), so scaling
  // from it keeps the whole fleet on one anchor rather than adding four new
  // hand-tuned opinions. kV2 then comes from GEN_RULES.propV0K exactly as the
  // generator's own prop synthesis derives it (60_gen_spec.js) — which
  // reproduces the A-65's 0.26 as 0.2561, so registry and generator agree.
  //
  // `mass` is DRY ENGINE, the convention the entries above already use (A-65
  // 80 kg against a real 77). The 582 is the exception and says so: a two-
  // stroke without its reduction gearbox is not a powerplant, so its 43 kg is
  // engine + gearbox + radiator + coolant.
  vw2180_wood: {
    price: 6000,
    engine: { name: 'VW 2180 conversion', mass: 66, powerW: 44000, aspiration: 'na', family: 'four', cooling: 'air' },
    prop:   { name: '2-pale bois 1.60 m', D: 1.60, Tstatic: 757, kV2: 0.1855 },
  },
  rotax582_ivo: {
    price: 5500,
    engine: { name: 'Rotax 582 + 2.62 red.', mass: 43, powerW: 48000, aspiration: 'na', family: 'two', cooling: 'liquid' },
    prop:   { name: 'IVO 3-pale 1.68 m', D: 1.68, Tstatic: 829, kV2: 0.2045 },
  },
  jabiru2200_std: {
    price: 15000,
    engine: { name: 'Jabiru 2200A', mass: 60, powerW: 63000, aspiration: 'na', family: 'four', cooling: 'air' },
    prop:   { name: '2-pale bois 1.52 m', D: 1.52, Tstatic: 930, kV2: 0.1674 },
  },
  rotax912_warp: {
    price: 18000,
    engine: { name: 'Rotax 912 UL', mass: 58, powerW: 59600, aspiration: 'na', family: 'four', cooling: 'liquid' },
    prop:   { name: 'Warp Drive 3-pale 1.73 m', D: 1.73, Tstatic: 977, kV2: 0.2169 },
  },
  o200_eprops: {
    price: 24000,
    engine: { name: 'Continental O-200-A', mass: 85, powerW: 74600, aspiration: 'na', family: 'four', cooling: 'air' },
    prop:   { name: 'E-Props Durandal carbone', D: 1.73, Tstatic: 1700, kV2: 0.177 },
  },
  outrunner2212_9x47: {
    price: 25,
    engine: { name: '2212 outrunner 1000KV / 3S', mass: 0.10, powerW: 180, aspiration: 'electric', family: 'electric', cooling: 'air' },
    prop:   { name: 'GWS 9x4.7 SlowFly', D: 0.229, Tstatic: 8.0, kV2: 0.0155 },
  },
  // THE ELECTRIC LADDER (G25). One 180 W park-flyer can was the whole
  // electric market; these seven run it from a 2 m RC model to an aerobatic
  // monster, matching the real market in both power AND price: 0.8 -> 2.2 ->
  // 12 -> 22 -> 55 -> 57.6 -> 260 kW against 55 -> 130 -> 3800 -> 9500 ->
  // 11000 -> 28000 -> 90000 cr.
  //
  // CONVENTIONS, because an electric row means slightly different things:
  //   - `mass` is MOTOR + CONTROLLER (the powerplant as normally equipped —
  //     the dry-engine convention's electric reading). THE BATTERY IS NOT
  //     IN IT: it is the fuel tank's analog, priced and weighed by the
  //     energy module (see HANDOVER riders), exactly as combustion rows
  //     exclude fuel. That is also why an EMRAX undercuts a Rotax 912 in
  //     credits and the sticker shock arrives with the packs.
  //   - `powerW` is the rating the market sells the unit by (continuous for
  //     the aircraft motors, takeoff/max for FES and the e-PPG, burst for
  //     RC cans) — tools/_eng_check.js prints the model's continuous
  //     reading against each so the gap stays visible.
  //   - EMRAX 228 vs E-811: nearly the same numbers, 2.5x the price — the
  //     difference IS the type certificate, and that is the honest market.
  // Tstatic on the A-65's own curve (P^2/3 D^2/3) and kV2 through
  // GEN_RULES.propV0K, like the middle-market rows above.
  outrunner3548_12x6: {
    price: 55,
    engine: { name: '3548 outrunner 900KV / 4S', mass: 0.35, powerW: 800, aspiration: 'electric', family: 'electric', cooling: 'air' },
    prop:   { name: 'APC 12x6E', D: 0.305, Tstatic: 17.3, kV2: 0.0067 },
  },
  outrunner6374_18x10: {
    price: 130,
    engine: { name: '6374 outrunner 170KV / 12S', mass: 0.75, powerW: 2200, aspiration: 'electric', family: 'electric', cooling: 'air' },
    prop:   { name: 'carbone 18x10', D: 0.457, Tstatic: 44.6, kV2: 0.0151 },
  },
  eppg_direct_130: {
    price: 3800,
    engine: { name: 'e-PPG 12 kW direct drive', mass: 7.0, powerW: 12000, aspiration: 'electric', family: 'electric', cooling: 'air' },
    prop:   { name: '2-pale carbone 1.30 m', D: 1.30, Tstatic: 277, kV2: 0.122 },
  },
  fes_folding_100: {
    price: 9500,
    engine: { name: 'FES sustainer 22 kW', mass: 9.0, powerW: 22000, aspiration: 'electric', family: 'electric', cooling: 'air' },
    prop:   { name: 'lames repliables 1.00 m', D: 1.00, Tstatic: 349, kV2: 0.072 },
  },
  emrax228_3blade: {
    price: 11000,
    engine: { name: 'EMRAX 228 / 55 kW', mass: 19.5, powerW: 55000, aspiration: 'electric', family: 'electric', cooling: 'air' },
    prop:   { name: '3-pale composite 1.65 m', D: 1.65, Tstatic: 897, kV2: 0.197 },
  },
  e811_velis: {
    price: 28000,
    engine: { name: 'Pipistrel E-811 (certified)', mass: 30.0, powerW: 57600, aspiration: 'electric', family: 'electric', cooling: 'air' },
    prop:   { name: 'composite fixe 1.64 m', D: 1.64, Tstatic: 921, kV2: 0.195 },
  },
  sp260d_class: {
    price: 90000,
    engine: { name: 'SP260D-class 260 kW', mass: 68.0, powerW: 260000, aspiration: 'electric', family: 'electric', cooling: 'air' },
    prop:   { name: 'MT 3-pale 2.20 m', D: 2.20, Tstatic: 3060, kV2: 0.351 },
  },
};
// ============================================================
// ENGINE THERMO LAWS (G134). Two numbers per family, both quoted at RATED
// power because that is the sizing case (a climb at Vy, full throttle, on a
// hot day is what a cowl and a fuel plan are designed for):
//
//   sfcKgKWh  brake specific fuel consumption, kg per kWh of SHAFT work.
//             Four-strokes on avgas run 0.27-0.32 (the classic 0.45-0.52
//             lb/hp-h); simple two-strokes are half as thermally honest at
//             0.45-0.55. Electric burns nothing — its draw is powerW/eta
//             out of the pack, and eta carries that instead.
//   cool      fraction of SHAFT power rejected through the COOLING PATH the
//             `cooling` field names (fins or radiator — oil cooling rides in
//             it). SI aero engines shed roughly 0.4-0.5 x shaft power that
//             way (the exhaust's larger share leaves by the pipe and is not
//             a cowl's problem); two-strokes run hotter per kW, liquid
//             jackets recover a little as radiator-duct pressure. Electric
//             is (1/eta - 1): a 90%-efficient motor+controller rejects ~11%.
//
// One keeper: genEngineThermo() below is the ONLY reader — the burn model
// (arc 3) and the ventilation model (arc 4) both consume its output, so the
// constants live here once, next to the rows they annotate.
const GEN_ENG_THERMO = {
  four:     { sfcKgKWh: 0.30, eta: null, cool: { air: 0.45, liquid: 0.42 } },
  two:      { sfcKgKWh: 0.50, eta: null, cool: { air: 0.55, liquid: 0.50 } },
  electric: { sfcKgKWh: 0,    eta: 0.90, cool: { air: 0.11, liquid: 0.11 } },
};

// The thermo sheet for one engine dict ({powerW, family, cooling, ...}).
// Legacy dicts predate the fields: an electric aspiration says 'electric',
// and every pre-G134 piston row without a declaration was a four-stroke on
// fins — the registry rows that are not (277, 582, 912) now say so.
function genEngineThermo(engine) {
  const e = engine || {};
  const family = GEN_ENG_THERMO[e.family] ? e.family
    : (e.aspiration === 'electric' ? 'electric' : 'four');
  const T = GEN_ENG_THERMO[family];
  const cooling = (e.cooling === 'liquid') ? 'liquid' : 'air';
  const kW = (e.powerW || 0) / 1000;
  return {
    family, cooling,
    sfcKgKWh: T.sfcKgKWh,
    eta: T.eta,
    // heat to reject through fins or radiator at rated power, kW
    coolKW: T.cool[cooling] * kW,
    // what full throttle actually consumes: kg/h of fuel, or kW of pack draw
    burnKgH: T.sfcKgKWh * kW,
    drawKW: T.eta ? kW / T.eta : 0,
  };
}

// A CUSTOM ENGINE'S PRICE (G134) — the market curve the registry's own rows
// sit on, fitted per family. Nobody certifies a garage engine, so the law
// tracks the UNCERTIFIED side of each ladder (an E-811 costs 2.5x an EMRAX
// for the paperwork; a custom build gets EMRAX pricing, which is the honest
// direction). Fit checked in tools/_engcustom_check.js against every row.
function genEnginePrice(family, powerW) {
  const kW = Math.max(0.05, (powerW || 0) / 1000);
  if (family === 'electric')
    return Math.round(kW < 3 ? 60 * Math.pow(kW, 0.9)
                             : 300 * kW);
  if (family === 'two') return Math.round(90 * Math.pow(kW, 1.15));
  return Math.round(60 * Math.pow(kW, 1.3));
}

const POLARS = {
  usa35b_AR7: { a3d: 4.34, Cl0: 0.35, aStall: 0.297, Cd0: 0.010, eAR: Math.PI * 0.75 * 6.95, Cm0: -0.080 },
  flat_tail_cub: { a3d: 3.4, Cl0: 0, aStall: 0.24, Cd0: 0.008, eAR: Math.PI * 0.7 * 3.7, Cm0: 0 },
  naca2215_AR9: { a3d: 4.66, Cl0: 0.22, aStall: 0.28, Cd0: 0.010, eAR: Math.PI * 0.8 * 9.14, Cm0: -0.045 },
  metal_tail_dc3: { a3d: 3.6, Cl0: 0, aStall: 0.25, Cd0: 0.009, eAR: Math.PI * 0.7 * 4.2, Cm0: 0 },
  naca2412_AR75: { a3d: 4.30, Cl0: 0.25, aStall: 0.314, Cd0: 0.008, eAR: Math.PI * 0.75 * 7.47, Cm0: -0.050 },
  metal_tail_c172: { a3d: 3.5, Cl0: 0, aStall: 0.24, Cd0: 0.009, eAR: Math.PI * 0.7 * 3.5, Cm0: 0 },
  chinook_wing_AR87: { a3d: 4.44, Cl0: 0.35, aStall: 0.293, Cd0: 0.010, eAR: Math.PI * 0.78 * 8.75, Cm0: -0.060 },
  fabric_tail: { a3d: 3.3, Cl0: 0, aStall: 0.26, Cd0: 0.010, eAR: Math.PI * 0.7 * 3.0, Cm0: 0 },
  jodel_wing_AR55: { a3d: 4.11, Cl0: 0.25, aStall: 0.28, Cd0: 0.0075, eAR: Math.PI * 0.85 * 5.55, Cm0: -0.050 },
  wood_tail: { a3d: 3.3, Cl0: 0, aStall: 0.24, Cd0: 0.009, eAR: Math.PI * 0.7 * 3.4, Cm0: 0 },
  foam_wing_AR56: { a3d: 4.0, Cl0: 0.25, aStall: 0.24, Cd0: 0.022, eAR: Math.PI * 0.8 * 5.6, Cm0: -0.055 },
  foam_tail: { a3d: 3.2, Cl0: 0, aStall: 0.22, Cd0: 0.015, eAR: Math.PI * 0.7 * 3.0, Cm0: 0 },
};

const PAR = {
  stabTrim: -0.0983,   // tuned: tunnel trim 24 m/s; in-flight bias acceptable
  rudderSign: 1,        // dr>0 = nose-left (probe reading corrected: +My = nose-LEFT)
  twSteer: 0.5,         // tailwheel deg per rudder deg
  fusCdA: [0.55, 1.30, 1.30], // body-axis CdA: axial, vertical, lateral
};

const CRR = 0.05, MU_LAT = 0.8, MU_BRAKE = 0.45;
// THE GROUND HAS A SURFACE (G115, the review's S2: "a takeoff run off a paved
// airfield and off a gravel bench are identical" — surfaceAt existed and was
// never asked). Rows are [rolling resistance, brake mu, lateral mu], keyed by
// the SURFACE enum. THE GRASS ROW IS THE THREE CLASSIC CONSTANTS ABOVE,
// verbatim: grass is HOME, and HOME is the datum every fleet gate was
// calibrated on — so the whole calm battery is bit-identical through this
// change, and only the paved field and the gravel benches read differently.
// Off-strip (surfaceAt returns -1) also reads the grass row for the same
// reason; a rougher off-field row is a decision to take with the fleet
// watching, not a default.
const GROUND_SURF = {
  0: [CRR, MU_BRAKE, MU_LAT],       // GRASS — the calibration datum
  // G121.3 — THE OFF-STRIP ROWS, the decision G115 deliberately deferred
  // "with the fleet watching" (a full --all battery judged this landing).
  // The biome classifier has answered these classes off-strip all along;
  // until now every one of them read as lawn.
  1: [0.06, 0.50, 0.75],            // ROCK — firm but uneven; rolls hard, grips
  2: [0.14, 0.25, 0.50],            // SCREE — loose stone rolling under the tyre
  3: [0.10, 0.30, 0.60],            // FOREST FLOOR — duff and roots, soft
  // WATER: hydrodynamic drag standing in for the hull this sim does not
  // have. The wheels reach the LAKEBED through the column (terrainH is the
  // bed), brakes do nothing in water, and there is almost no side grip —
  // a ditching decelerates hard and slews, which is the honest half of the
  // story; buoyancy and floats are a named cut, not a pretence.
  4: [0.35, 0.0, 0.20],
  5: [0.02, 0.55, 0.9],  // BISECT
  6: [0.045, 0.38, 0.75],           // GRAVEL — rolls almost as easy, brakes worse
  7: [0.10, 0.30, 0.6],             // SAND — reserved with the enum
};
const GROUND_DEF = GROUND_SURF[0];

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
// ============================================================
function buildCub() {
  const nodes = [], beams = [];
  const N = (x, y, z, m, tag, r = 0) => (nodes.push({ p: [x, y, z], m, r, tag }), nodes.length - 1);
  const NM = (x, y, z, m, tag, r = 0) =>
    [N(x, y, -Math.abs(z), m, tag + 'L', r), N(x, y, Math.abs(z), m, tag + 'R', r)];
  const K_CH = 2.0e5, C_CH = 60, K_GR = 2.8e4, C_GR = 900, K_WG = 5.0e5, C_WG = 450;
  const B = (a, b, k = K_CH, c = C_CH) => beams.push({ a, b, k, c, gear: k === K_GR });
  const BG = (a, b) => B(a, b, K_GR, C_GR);

  const ST = [                       // [x, halfW, yBot, yTop, nodeMass]
    [0.00, 0.33,  0.00, 0.78, 3.0],
    [0.62, 0.36, -0.02, 1.00, 3.0],
    [1.40, 0.36, -0.02, 1.00, 3.0],
    [2.05, 0.30,  0.02, 0.74, 1.5],
    [2.85, 0.24,  0.08, 0.60, 1.5],
    [3.65, 0.17,  0.14, 0.48, 1.5],
    [4.45, 0.10,  0.20, 0.38, 1.5],
  ];
  const F = [];
  ST.forEach(([x, w, yb, yt, mm], i) => {
    const [BL, BR] = NM(x, yb, w, mm, `S${i}B`);
    const [TL, TR] = NM(x, yt, w, mm, `S${i}T`);
    F.push({ BL, BR, TL, TR });
    B(BL, BR); B(TL, TR); B(BL, TL); B(BR, TR);
    B(BL, TR); B(BR, TL);            // X-brace: mirror-symmetric shear
  });
  for (let i = 0; i < F.length - 1; i++) {
    const a = F[i], b = F[i + 1], alt = i % 2;
    B(a.BL, b.BL); B(a.BR, b.BR); B(a.TL, b.TL); B(a.TR, b.TR);
    B(alt ? a.BL : a.TL, alt ? b.TL : b.BL);
    B(alt ? a.BR : a.TR, alt ? b.TR : b.BR);
    B(a.TL, b.TR); B(a.TR, b.TL);    // top panel X
    B(a.BL, b.BR); B(a.BR, b.BL);    // bottom panel X
  }
  const TPB = N(5.12, 0.25, 0, 1.2, 'TPB'), TPT = N(5.12, 0.36, 0, 1.2, 'TPT');
  const S6 = F[6];
  B(TPB, TPT);
  B(S6.BL, TPB); B(S6.BR, TPB); B(S6.TL, TPT); B(S6.TR, TPT);
  B(S6.TL, TPB); B(S6.TR, TPB);

  const [EL, ER] = NM(-0.48, 0.36, 0.20, 40, 'ENG');   // engine+prop ~80 kg
  const S0 = F[0];
  B(EL, ER);
  B(EL, S0.TL); B(EL, S0.BL); B(EL, S0.BR);
  B(ER, S0.TR); B(ER, S0.BR); B(ER, S0.BL);
  nodes[S0.TL].m += 18; nodes[S0.TR].m += 18;          // fuel 36 kg at firewall

  const [GAL, GAR] = NM(0.55, -0.80, 0.89, 6, 'AXLE', 0.20);
  BG(GAL, GAR);
  BG(GAL, S0.BL); BG(GAL, F[1].BL); BG(GAL, S0.BR);
  BG(GAR, S0.BR); BG(GAR, F[1].BR); BG(GAR, S0.BL);
  const TW = N(5.02, 0.02, 0, 3, 'TW', 0.10);
  BG(TW, TPB); BG(TW, S6.BL); BG(TW, S6.BR);
  // snap-blocking near-vertical member (structural rule 10, the drone cure):
  // without it the tailwheel folds UP about TPB and LATCHES (bare post on
  // the terrain) when parked in a tailwind — reset slam + breeze, W13.
  BG(TW, TPT);

  const MW = 8, wf = { L: null, R: null };
  const mkWing = (s) => {
    const B = (a, b) => beams.push({ a, b, k: K_WG, c: C_WG, gear: false });
    const rootF = s > 0 ? F[1].TR : F[1].TL, rootR = s > 0 ? F[2].TR : F[2].TL;
    const strut = s > 0 ? F[1].BR : F[1].BL;
    const zs = [1.9, 3.4, 5.0], DIH = 0.0524;   // 3 deg dihedral (tan)
    const WF = zs.map(z => N(0.62, 1.00 + (z - 0.36) * DIH, s * z, MW, 'WF'));
    const WR = zs.map(z => N(1.40, 1.00 + (z - 0.36) * DIH, s * z, MW, 'WR'));
    B(rootF, WF[0]); B(WF[0], WF[1]); B(WF[1], WF[2]);
    B(rootR, WR[0]); B(WR[0], WR[1]); B(WR[1], WR[2]);
    B(WF[0], WR[0]); B(WF[1], WR[1]); B(WF[2], WR[2]);
    B(rootF, WR[0]); B(WF[0], WR[1]); B(WF[1], WR[2]);
    B(WR[0], WF[1]); B(WR[1], WF[2]);
    B(strut, WF[1]); B(strut, WR[1]); B(strut, WF[0]);
    B(strut, WR[0]); B(strut, WF[2]); B(strut, WR[2]);
    wf[s > 0 ? 'R' : 'L'] = { F: [rootF, ...WF], R: [rootR, ...WR] };
  };
  mkWing(+1); mkWing(-1);

  const [HTL, HTR] = NM(4.92, 0.30, 1.05, 4, 'HT');
  B(HTL, TPB); B(HTL, TPT); B(HTL, S6.BL); B(HTL, S6.TL);
  B(HTR, TPB); B(HTR, TPT); B(HTR, S6.BR); B(HTR, S6.TR);
  // stab<->tailwheel pyramid (rule 10, the chinook cure): the fold that
  // survives the TW->TPT block is LATERAL (dTW body [+0.28 up, 0.25
  // sideways], measured) — wide anchors kill it
  BG(TW, HTL); BG(TW, HTR);
  const FIN = N(5.05, 0.95, 0, 4, 'FIN');
  B(FIN, TPT); B(FIN, S6.TL); B(FIN, S6.TR);

  nodes[F[1].BL].m += 38; nodes[F[1].BR].m += 38;      // pilot, front seat

  // ---------- aero strips ----------
  const strips = [];
  const wingStrip = (fIn, fOut, rIn, rOut, t, area, side, o = {}) => {
    const cf = 0.795, cr = 0.205;   // c/4 sits between the spars at 79.5/20.5
    strips.push({ kind: 'wing', side, t, area, chord: 1.6,
      fIn, fOut, rIn, rOut,
      w: [[fIn, cf * (1 - t)], [fOut, cf * t], [rIn, cr * (1 - t)], [rOut, cr * t]],
      wash: o.wash || 0, ail: o.ail || 0 });
  };
  const bays = (fr, side) => {
    const bw = [1.54, 1.5, 1.6];
    for (let b = 0; b < 3; b++)
      for (const t of [0.28, 0.78])
        wingStrip(fr.F[b], fr.F[b + 1], fr.R[b], fr.R[b + 1], t, bw[b] * 1.6 / 2,
          side, { wash: b === 0 && t < 0.5 ? 0.5 : 0, ail: b === 2 ? 1 : 0 });
  };
  bays(wf.R, 1); bays(wf.L, -1);
  wingStrip(F[1].TL, F[1].TR, F[2].TL, F[2].TR, 0.5, 0.72 * 1.6, 1, { wash: 1 });

  for (const [nHT, side] of [[HTL, -1], [HTR, 1]]) {
    strips.push({ kind: 'stab', side, area: 0.65, chord: 0.9, wash: 0.6,
      w: [[nHT, .5], [TPB, .3], [TPT, .2]] });
    strips.push({ kind: 'stab', side, area: 0.50, chord: 0.9, wash: 0.6,
      w: [[nHT, .25], [TPB, .45], [TPT, .3]] });
  }
  strips.push({ kind: 'fin', area: 1.00, chord: 0.9, wash: 1,
    w: [[FIN, .4], [TPT, .35], [TPB, .25]] });

  const refs = {
    noseFrame: [S0.BL, S0.BR, S0.TL, S0.TR], tailMid: [TPB, TPT],
    upLo: [S0.BL, S0.BR], upHi: [S0.TL, S0.TR],
    fusDrag: [F[2].BL, F[2].BR, F[2].TL, F[2].TR],
    fusDragAft: [F[5].BL, F[5].BR, F[5].TL, F[5].TR],
    engine: [EL, ER], mains: [GAL, GAR], tw: TW, fin: FIN,
  };
  const params = {
    name: 'Piper J-3 Cub', viewDist: 14,
    powerplant: 'a65_sensenich74',
    // ONE engine on TWO mount nodes (`refs.engine` above is the mounts). Stated
    // because the solver used to read the mount count as the engine count, and
    // this aeroplane flew on 1800 N. See HONEST CUTS / G4.9.
    nEngines: 1,
    polarWing: POLARS.usa35b_AR7, polarTail: POLARS.flat_tail_cub,
    elevTau: 0.50, rudTau: 0.55, ailTau: 0.35, downwash: 0.40,
    stabTrim: -0.0983, sparSpacing: 0.78,
    fusCdA: [0.55, 0.8, 0.8], fusCdAAft: [0, 0.5, 0.5],
    twSteer: 0.5,
    ap: {
      VRot: 15, VClimbMin: 20, VClimb: 21, VCruise: 26, VAppr: 21.5,
      VApprShort: 18.8,             // fly-in strips < 450 m (1.25*Vs, doctrine floor)
      // NO VTurn ON PURPOSE. TURNBACK and INBOUND both read A.VTurn but with
      // DIFFERENT fallbacks — VCruise and a literal 24 — so this aeroplane
      // flies its turnback at 26 and its inbound at 24, and a single VTurn
      // key cannot express that. Writing `VTurn: 24` here to "make the
      // default explicit" silently moved TURNBACK 26 -> 24 and was measured
      // to shift the M3 stop 1 m and the drone's elevator chatter from
      // 0.3 to 5.5 deg/s. Generated fiches always set VTurn, so the literal
      // below is reached only by this family, which is what it was tuned on.
      // RE-ANCHORED G4.9 (was 60): the engine-count fix halved this aeroplane's
      // thrust, and the run to 2.5 m agl went 67 m -> 151 m. Re-read off
      // tools/make_perf.js, not adjusted by hand.
      TORun: 151,                   // measured run to 2.5 m agl
      // W16 lateral quiet: same 4 Hz aileron limit cycle as the pa18
      // (shared geometry) — default rollD 2.0 on the lagged rate estimate;
      // 0.8 kills it (see pa18 fiche note).
      rollD: 0.8,
      hCruise: 100, hSafe: 14, xTurn: -2300, xAim: -520, gs: 0.0786,
      rollDe: 0.12, liftoffTh: 0.16, climbThBase: 0.12, climbThGain: 0.030,
      thMax: 0.20, flareAgl: 4.8, flareRate: 0.062, aglGuard: 3,
      VTailUp: 12, VStop: 0.4, slew: 1.5, thrCruise: 0.70, thrAppr: 0.35,
      brakeMax: 0.30, brakeRampRate: 0.12, VBrakeOn: 9, VBrakeRelease: 1.5,
    },
  };
  return { nodes, beams, strips, refs, params };
}



// ============================================================
// DOUGLAS DC-3 — 10.5 t twin, low tapered wing with spar box,
// oleo mains in the nacelles, tailwheel. x aft from nose.
// ============================================================
function buildDC3() {
  const nodes = [], beams = [];
  const N = (x, y, z, m, tag, r = 0) => (nodes.push({ p: [x, y, z], m, r, tag }), nodes.length - 1);
  const NM = (x, y, z, m, tag, r = 0) =>
    [N(x, y, -Math.abs(z), m, tag + 'L', r), N(x, y, Math.abs(z), m, tag + 'R', r)];
  const K_S = 2.5e6, C_S = 3000, K_W3 = 2.0e7, C_W3 = 12000, K_O = 4.0e5, C_O = 3.0e4;
  const B = (a, b, k = K_S, c = C_S) => beams.push({ a, b, k, c, gear: k === K_O });
  const BG = (a, b) => B(a, b, K_O, C_O);

  // fuselage: [x, halfW, yBot, yTop, nodeMass]
  const ST = [
    [1.0, 0.55, 0.45, 1.55, 55],
    [3.5, 1.20, 0.05, 2.30, 70],
    [6.2, 1.45, 0.00, 2.55, 110],   // wing front spar frame
    [8.9, 1.45, 0.00, 2.55, 110],   // wing rear spar frame
    [11.4, 1.35, 0.05, 2.45, 95],
    [13.8, 1.10, 0.20, 2.20, 70],
    [16.0, 0.80, 0.45, 1.85, 55],
    [18.2, 0.45, 0.80, 1.50, 45],
  ];
  const F = [];
  ST.forEach(([x, w, yb, yt, m]) => {
    const [BL, BR] = NM(x, yb, w, m, 'B');
    const [TL, TR] = NM(x, yt, w, m, 'T');
    F.push({ BL, BR, TL, TR });
    B(BL, BR); B(TL, TR); B(BL, TL); B(BR, TR); B(BL, TR); B(BR, TL);
  });
  for (let i = 0; i < F.length - 1; i++) {
    const a = F[i], b = F[i + 1];
    B(a.BL, b.BL); B(a.BR, b.BR); B(a.TL, b.TL); B(a.TR, b.TR);
    B(a.BL, b.TL); B(a.BR, b.TR); B(a.TL, b.BL); B(a.TR, b.BR);
    B(a.TL, b.TR); B(a.TR, b.TL); B(a.BL, b.BR); B(a.BR, b.BL);
  }
  const TPB = N(19.3, 1.00, 0, 40, 'TPB'), TPT = N(19.3, 1.60, 0, 40, 'TPT');
  const S7 = F[7];
  B(TPB, TPT);
  B(S7.BL, TPB); B(S7.BR, TPB); B(S7.TL, TPT); B(S7.TR, TPT);
  B(S7.TL, TPB); B(S7.TR, TPB); B(S7.BL, TPT); B(S7.BR, TPT);

  // cabin payload + crew
  nodes[F[3].BL].m += 500; nodes[F[3].BR].m += 500;
  nodes[F[4].BL].m += 450; nodes[F[4].BR].m += 450;
  nodes[F[1].BL].m += 150; nodes[F[1].BR].m += 150;

  // ---- wing: low, tapered, LE sweep outboard of nacelles, 5 deg outer dihedral
  const zSt = [1.45, 3.2, 5.4, 7.6, 9.5, 11.4, 12.9, 14.3];
  const chord = z => z <= 3.2 ? 4.33 : 4.33 + (z - 3.2) * (1.55 - 4.33) / (14.3 - 3.2);
  const LEx = z => 6.05 + Math.max(0, z - 3.2) * 0.19;
  const yW = z => 0.15 + Math.max(0, z - 3.2) * 0.0875;
  const boxD = z => 0.68 + Math.max(0, z - 3.2) * (0.26 - 0.68) / 11.1;
  const wf = { L: null, R: null }, keel = { L: null, R: null };
  const mkWing = (sgn) => {
    const B = (a, b) => beams.push({ a, b, k: K_W3, c: C_W3, gear: false });
    const rootF = sgn > 0 ? F[2].BR : F[2].BL;
    const rootR = sgn > 0 ? F[3].BR : F[3].BL;
    // mass per station ~ chord x bay width (structure + fuel share)
    const MWs = zSt.slice(1).map((z, i) => {
      const dz = (zSt[i + 2] ?? z + 1.4) - zSt[i];
      return 11.8 * chord(z) * dz;
    });
    const WF = [], WR = [], BF = [], BR = [];
    zSt.slice(1).forEach((z, i) => {
      const c = chord(z);
      WF.push(N(LEx(z) + 0.15 * c, yW(z), sgn * z, MWs[i], 'WF'));
      WR.push(N(LEx(z) + 0.65 * c, yW(z) - 0.5 * c * 0.035, sgn * z, MWs[i] * 0.55, 'WR'));
      BF.push(N(LEx(z) + 0.15 * c, yW(z) - boxD(z), sgn * z, Math.max(16, MWs[i] * 0.30), 'WB'));
      BR.push(N(LEx(z) + 0.65 * c, yW(z) - 0.5 * c * 0.035 - boxD(z) * 0.8, sgn * z, Math.max(16, MWs[i] * 0.25), 'WB'));
    });
    // center-section keel: the box keeps full depth through the belly
    const cR = chord(1.45);
    const KF = N(LEx(1.45) + 0.15 * cR, yW(1.45) - boxD(1.45), sgn * 1.45, 55, 'WB');
    const KR = N(LEx(1.45) + 0.65 * cR, yW(1.45) - 0.5 * cR * 0.035 - boxD(1.45) * 0.8, sgn * 1.45, 45, 'WB');
    const F2b = sgn > 0 ? F[2].BR : F[2].BL, F3b = sgn > 0 ? F[3].BR : F[3].BL;
    const F2o = sgn > 0 ? F[2].BL : F[2].BR, F3o = sgn > 0 ? F[3].BL : F[3].BR;
    B(KF, rootF); B(KF, F2o); B(KF, F3b); B(KF, rootR);
    B(KR, rootR); B(KR, F3o); B(KR, F2b); B(KR, rootF);
    B(KF, KR);
    keel[sgn > 0 ? 'R' : 'L'] = { KF, KR };
    const chainF = [rootF, ...WF], chainR = [rootR, ...WR],
          chainB = [KF, ...BF], chainBR = [KR, ...BR];
    for (let i = 0; i < zSt.length - 1; i++) {
      B(chainF[i], chainF[i + 1]); B(chainR[i], chainR[i + 1]);
      B(chainB[i], chainB[i + 1]); B(chainBR[i], chainBR[i + 1]);
      B(chainF[i + 1], chainR[i + 1]);                        // top rib
      B(chainB[i + 1], chainBR[i + 1]);                       // bottom rib
      B(chainF[i], chainR[i + 1]); B(chainR[i], chainF[i + 1]); // top drag truss
      B(chainF[i + 1], chainB[i + 1]);                        // front web vertical
      B(chainF[i], chainB[i + 1]); B(chainB[i], chainF[i + 1]); // front web shear
      B(chainR[i + 1], chainBR[i + 1]);                       // rear web vertical
      B(chainR[i], chainBR[i + 1]); B(chainBR[i], chainR[i + 1]); // rear web shear
      B(chainB[i], chainBR[i + 1]); B(chainBR[i], chainB[i + 1]); // bottom drag truss
      B(chainB[i + 1], chainR[i + 1]); B(chainBR[i + 1], chainF[i + 1]); // box diagonals
    }
    wf[sgn > 0 ? 'R' : 'L'] = { F: chainF, R: chainR };
    return { WF, WR, BF };
  };
  const wR = mkWing(+1), wL = mkWing(-1);
  // keel continuity across the belly: the bending moment crosses the fuselage here
  const KB = (a, b) => beams.push({ a, b, k: K_W3, c: C_W3, gear: false });
  KB(keel.L.KF, keel.R.KF); KB(keel.L.KR, keel.R.KR);
  KB(keel.L.KF, keel.R.KR); KB(keel.R.KF, keel.L.KR);

  // ---- engines on nacelle mounts ahead of the front spar at z ±3.2
  const [EL, ER] = NM(4.4, 0.55, 3.2, 900, 'ENG');       // R-1830 + prop + nacelle
  for (const [E, w] of [[EL, wL], [ER, wR]]) {
    B(E, w.WF[0]); B(E, w.BF[0]); B(E, w.WR[0]);
    B(E, w.WF[1]); B(E, w.BF[1]);
  }

  // ---- gear: oleo mains under nacelles, tailwheel
  const [GAL, GAR] = NM(6.6, -1.45, 3.2, 120, 'AXLE', 0.50);
  for (const [G, E, w] of [[GAL, EL, wL], [GAR, ER, wR]]) {
    BG(G, E); BG(G, w.WF[0]); BG(G, w.BF[0]); BG(G, w.WR[0]); BG(G, w.BF[1]);
  }
  BG(GAL, wR.BF[0]); BG(GAR, wL.BF[0]);                  // cross bracing
  const TW = N(17.8, -0.30, 0, 60, 'TW', 0.22);
  BG(TW, F[6].BL); BG(TW, F[6].BR); BG(TW, F[7].BL); BG(TW, F[7].BR);

  // ---- tail
  const [HTL, HTR] = NM(18.5, 1.35, 4.3, 60, 'HT');
  B(HTL, TPB); B(HTL, TPT); B(HTL, S7.BL); B(HTL, S7.TL); B(HTL, F[6].BL);
  B(HTR, TPB); B(HTR, TPT); B(HTR, S7.BR); B(HTR, S7.TR); B(HTR, F[6].BR);
  const FIN = N(18.9, 4.6, 0, 60, 'FIN');
  B(FIN, TPT); B(FIN, S7.TL); B(FIN, S7.TR); B(FIN, F[6].TL); B(FIN, F[6].TR);

  // ---- strips
  const strips = [];
  const cf = 0.80, cr = 0.20;
  const wingStrip = (fIn, fOut, rIn, rOut, t, area, ch, side, o = {}) => {
    strips.push({ kind: 'wing', side, t, area, chord: ch,
      fIn, fOut, rIn, rOut,
      w: [[fIn, cf * (1 - t)], [fOut, cf * t], [rIn, cr * (1 - t)], [rOut, cr * t]],
      wash: o.wash || 0, ail: o.ail || 0, flap: o.flap || 0 });
  };
  for (const [fr, side] of [[wf.R, 1], [wf.L, -1]]) {
    for (let b = 0; b < zSt.length - 1; b++) {
      const zm = (zSt[b] + zSt[b + 1]) / 2, dz = zSt[b + 1] - zSt[b];
      const ch = chord(zm), area = ch * dz;
      const wsh = zm < 4.6 ? 0.8 : zm < 6.5 ? 0.3 : 0;
      const ail = b >= zSt.length - 3 ? 1 : 0;
      wingStrip(fr.F[b], fr.F[b + 1], fr.R[b], fr.R[b + 1], 0.5, area, ch, side,
        { wash: wsh, ail, flap: ail ? 0 : 1 });   // split flaps inboard of ailerons
    }
  }
  wingStrip(F[2].BL, F[2].BR, F[3].BL, F[3].BR, 0.5, 12.5, 4.33, 1, { wash: 0.3, flap: 1 });
  for (const [nHT, side] of [[HTL, -1], [HTR, 1]]) {
    strips.push({ kind: 'stab', side, area: 6.0, chord: 2.3, wash: 0.4,
      w: [[nHT, .5], [TPB, .3], [TPT, .2]] });
    strips.push({ kind: 'stab', side, area: 4.6, chord: 2.3, wash: 0.4,
      w: [[nHT, .25], [TPB, .45], [TPT, .3]] });
  }
  strips.push({ kind: 'fin', area: 5.5, chord: 2.4, wash: 0.4,
    w: [[FIN, .45], [TPT, .3], [TPB, .25]] });
  strips.push({ kind: 'fin', area: 4.5, chord: 2.2, wash: 0.4,
    w: [[FIN, .2], [TPT, .45], [TPB, .35]] });

  const refs = {
    noseFrame: [F[0].BL, F[0].BR, F[0].TL, F[0].TR],
    tailMid: [F[6].BL, F[6].BR, F[6].TL, F[6].TR],       // rigid box reference
    upLo: [F[1].BL, F[1].BR], upHi: [F[1].TL, F[1].TR],
    fusDrag: [F[3].BL, F[3].BR, F[3].TL, F[3].TR],
    fusDragAft: [F[6].BL, F[6].BR, F[6].TL, F[6].TR],
    engine: [EL, ER], mains: [GAL, GAR], tw: TW, fin: FIN,
  };
  const params = {
    name: 'Douglas DC-3', viewDist: 45, substeps: 72,
    powerplant: 'r1830_hs23e50',
    nEngines: 2,                    // genuinely a twin: one engine per mount node
    polarWing: POLARS.naca2215_AR9, polarTail: POLARS.metal_tail_dc3,
    elevTau: 0.45, rudTau: 0.50, ailTau: 0.30, downwash: 0.42,
    stabTrim: -0.0120, sparSpacing: 2.16,
    fusCdA: [1.40, 3.0, 3.0], fusCdAAft: [0, 2.0, 2.0],
    twSteer: 0.30,
    // split flaps: strong drag, quarter flaps for takeoff (shortens unstick)
    flaps: { to: 0.25, ldg: 0.7, rate: 0.10, dCl0: 0.80, dCd0: 0.090, dAStall: 0.025, dCm0: -0.20 },
    ap: {
      rotate: true,
      VRot: 45, VClimbMin: 42, VClimb: 46, VCruise: 58, VAppr: 43, VTurn: 55,
      TORun: 960,                   // measured run to 2.5 m agl (W14 multi-hop)
      thTailUp: 0.030, thRotate: 0.100,
      lookRoll: 45, lookAppr: 650, lookCruise: 900,
      // gs 0.044 -> 0.060 (flapped approaches are steeper): with split-flap
      // drag the shallow clean slope needed 0.70 throttle and the jet of
      // integrators railed into a powered 1 m/s mush 60 m above the slope
      hCruise: 250, hSafe: 30, xTurn: -5800, xAim: -810, gs: 0.060,
      thrFloor: 0.05,
      rollDe: 0.06, liftoffTh: 0.15, liftoffRamp: 0.06,
      climbThBase: 0.11, climbThGain: 0.015, thMax: 0.17,
      // flare from 10 m, faster ramp: the steeper flapped slope arrives at
      // -2.5 m/s and the old 0.030 ramp from 7 m was a 2.6 m/s carrier landing.
      // flareThMax 0.11 -> 0.085: flaps raise CL at a given attitude, so the
      // clean-era cap sat ABOVE the L=W attitude and the float came back
      // (117 km/h touchdown, 300 m past the window).
      flareAgl: 10, flareRate: 0.045, aglGuard: 6, flareThMax: 0.085,
      VTailUp: 20, VStop: 0.5, slew: 0.8, thrCruise: 0.55, thrAppr: 0.30,
      // GE retune (session 1): wing keeps lifting through the rollout in
      // ground effect -> less weight on wheels -> longer roll. Brake earlier
      // and harder, approach one knot slower; was 0.45/36/VAppr 44 (overran
      // to x=+124).
      // brake later/gentler than the GE retune: flap retraction on rollout
      // returns weight to the wheels, and braking at 39 with the tail still
      // flying dipped the nose to -3
      brakeMax: 0.50, brakeRampRate: 0.14, VBrakeOn: 34, VBrakeRelease: 2.5,
      rateFilt: 0.15, pitchP: 1.6, pitchD: 1.6, pitchI: 0.25,
      vsP: 0.006, vsI: 0.010, vsFloor: -0.12, altVSGain: 0.06,
      vsFilt: 0.5, pitchCmdSlew: 0.3,
      hdgP: 0.7, hdgD: 1.2, bankSlew: 0.14, rollP: 1.6, rollD: 2.2,
      betaK: 0.3, yawDampK: 0.7, ariK: 0.3, bankLim: 0.45,
    },
  };
  return { nodes, beams, strips, refs, params };
}




// ============================================================
// BIRDMAN CHINOOK 1S (WT-11) — 208 kg avec pilote, pod
// pentagonal, poutre monotube (tube triangulaire), PUSHER
// Rotax 277, gouvernes surdimensionnees. STOL-né. x arriere.
// ============================================================
function buildChinook() {
  const nodes = [], beams = [];
  const N = (x, y, z, m, tag, r = 0) => (nodes.push({ p: [x, y, z], m, r, tag }), nodes.length - 1);
  const K_F = 2.2e5, C_F = 180, K_W = 6.0e5, C_W = 380, K_B = 8.5e5, C_B = 400, K_G = 3.5e4, C_G = 800;
  const B = (a, b, k = K_F, c = C_F) => beams.push({ a, b, k, c, gear: k === K_G });
  const BW = (a, b) => B(a, b, K_W, C_W);
  const BB = (a, b) => B(a, b, K_B, C_B);
  const BG = (a, b) => B(a, b, K_G, C_G);

  // ---- pod pentagonal : 3 cadres a 5 noeuds (BL BR ML MR T)
  const PST = [
    [0.35, 0.30, 0.25, 0.38, 0.85, 1.22, 2.2],
    [1.05, 0.34, 0.20, 0.42, 0.95, 1.42, 2.2],
    [1.75, 0.30, 0.28, 0.36, 0.92, 1.38, 1.8],
  ];
  const P = [];
  PST.forEach(([x, w, yb, w2, ym, yt, m]) => {
    const BL = N(x, yb, -w, m, 'B'), BR = N(x, yb, w, m, 'B');
    const ML = N(x, ym, -w2, m, 'M'), MR = N(x, ym, w2, m, 'M');
    const T  = N(x, yt, 0, m, 'T');
    P.push({ BL, BR, ML, MR, T });
    B(BL, BR); B(BL, ML); B(BR, MR); B(ML, T); B(MR, T);   // pentagone
    B(BL, MR); B(BR, ML); B(ML, MR); B(BL, T); B(BR, T);   // diagonales
  });
  for (let i = 0; i < 2; i++) {
    const a = P[i], b = P[i + 1];
    for (const k of ['BL', 'BR', 'ML', 'MR', 'T']) B(a[k], b[k]);
    B(a.BL, b.ML); B(a.BR, b.MR); B(a.ML, b.T); B(a.MR, b.T);
    B(a.ML, b.BL); B(a.MR, b.BR); B(a.T, b.ML); B(a.T, b.MR);
    B(a.BL, b.BR); B(a.BR, b.BL);
  }
  nodes[P[0].BL].m += 18; nodes[P[0].BR].m += 18;          // jambes pilote
  nodes[P[1].BL].m += 25; nodes[P[1].BR].m += 24;          // pilote
  nodes[P[2].BL].m += 5; nodes[P[2].BR].m += 5;            // essence

  // moteur pusher au sommet arriere du pod, helice derriere l aile
  const EM = N(2.05, 1.42, 0, 30, 'ENG');
  B(EM, P[2].T); B(EM, P[2].ML); B(EM, P[2].MR); B(EM, P[1].T);

  // ---- poutre monotube : tube triangulaire jusqu a l empennage.
  // Section 20 cm (le vrai tube est gros) — la section 8 cm etait un mecanisme
  // en flexion laterale (depth/bay 7%, regle structurelle 5) : la queue,
  // pendule inverse sur la roulette, tombait sur le cote a l arret.
  const boomY = 1.08;
  const bTri = (x, m) => {
    const T = N(x, boomY + 0.10, 0, m, 'BOOM');
    const L = N(x, boomY - 0.07, -0.10, m, 'BOOM');
    const R = N(x, boomY - 0.07, 0.10, m, 'BOOM');
    BB(T, L); BB(T, R); BB(L, R);
    return { T, L, R };
  };
  const B1 = bTri(2.85, 1.6), B2 = bTri(3.95, 1.4), B3 = bTri(5.05, 1.4);
  const link = (a, b) => {
    BB(a.T, b.T); BB(a.L, b.L); BB(a.R, b.R);
    BB(a.T, b.L); BB(a.T, b.R); BB(a.L, b.T); BB(a.R, b.T); BB(a.L, b.R); BB(a.R, b.L);
  };
  // emplanture de poutre dans le pod
  BB(P[2].T, B1.T); BB(P[2].ML, B1.L); BB(P[2].MR, B1.R);
  BB(P[2].T, B1.L); BB(P[2].T, B1.R); BB(P[2].ML, B1.T); BB(P[2].MR, B1.T);
  BB(P[1].T, B1.T); BB(EM, B1.T); BB(EM, B1.L); BB(EM, B1.R);
  // jurys d emplanture vers les coins bas du pod : raideur de roulis du 1er
  // ordre a la racine (les liaisons quasi axiales seules laissaient la poutre
  // se vriller de 16 deg a la racine quand la queue retombe au reset)
  BB(B1.L, P[2].BL); BB(B1.R, P[2].BR);
  link(B1, B2); link(B2, B3);

  // ---- aile haute haubanee, corde constante 1.22, fleche nulle
  const zSt = [0.55, 2.00, 3.70, 5.34];
  const CH = 1.22, LEX = 0.88;
  const yW = z => 1.55 + Math.max(0, z - 0.55) * 0.026;
  const wf = { L: null, R: null };
  const mkWing = (sgn) => {
    const MF = [3.2, 2.4, 1.8];
    const WF = [], WR = [], BF = [];
    zSt.forEach((z, i) => {
      const mi = i === 0 ? 2.8 : MF[i - 1];
      WF.push(N(LEX + 0.15 * CH, yW(z), sgn * z, mi, 'WF'));
      WR.push(N(LEX + 0.65 * CH, yW(z) - 0.5 * CH * 0.030, sgn * z, mi * 0.6, 'WR'));
      BF.push(N(LEX + 0.15 * CH, yW(z) - 0.13 * CH, sgn * z, Math.max(1.5, mi * 0.3), 'WB'));
    });
    // emplanture sur le sommet du pod
    const a1 = P[1].T, a2 = P[2].T, m1 = sgn > 0 ? P[1].MR : P[1].ML;
    BW(WF[0], a1); BW(WR[0], a2); BW(WF[0], a2); BW(WR[0], a1); BW(BF[0], m1); BW(BF[0], a1);
    for (let i = 0; i < 3; i++) {
      BW(WF[i], WF[i + 1]); BW(WR[i], WR[i + 1]); BW(BF[i], BF[i + 1]);
      BW(WF[i + 1], WR[i + 1]);
      BW(WF[i], WR[i + 1]); BW(WR[i], WF[i + 1]);
      BW(WF[i + 1], BF[i + 1]);
      BW(WF[i], BF[i + 1]); BW(BF[i], WF[i + 1]);
      BW(BF[i + 1], WR[i + 1]); BW(BF[i], WR[i + 1]);
      BW(BF[i], WR[i]);
    }
    // haubans vers le bas du pod — grand bras vertical
    const sb = sgn > 0 ? P[1].BR : P[1].BL, sb2 = sgn > 0 ? P[2].BR : P[2].BL;
    BW(sb, WF[1]); BW(sb2, WR[1]); BW(sb, WR[1]); BW(sb2, WF[1]); BW(sb, BF[1]);
    // ...ET JUSQU'AUX STATIONS EXTERIEURES (2026-08-10, GATE FLEX).
    // Le haubanage ne tenait que la station 1 (z=2.00) : les 3.34 m suivants,
    // soit 63% de la demi-envergure, pendaient sur le seul caisson triangulaire,
    // dont les baies font 1.70 m pour 0.16 m de hauteur — rapport hauteur/baie
    // 9.3%, exactement la regle 5 que la POUTRE de cet avion a deja payee
    // ("la section 8 cm etait un mecanisme, depth/bay 7%") sans qu'on l'applique
    // jamais a l'AILE. Mesure (couple antisymetrique en bout, statique, sans
    // aero) : 16.4 deg sous 200 N.m et 24.6 sous 400 — NON LINEAIRE, la
    // signature d'un quasi-mecanisme, contre cub 3.07 / gen 2.43 / c172 1.36 /
    // jodel 0.48. Trois remedes essayes et mesures :
    //   +X sous le caisson          14.95 deg  (les faces n'etaient pas le mal)
    //   +caisson a 4 semelles       8.37 deg, et 46 poutres + 8 noeuds + 72
    //                               sous-pas au lieu de 48 (omega*dt 0.579)
    //   +haubans station 2 seule    8.81 -> 13.83, TOUJOURS non lineaire
    //   +haubans jusqu'au saumon    2.22 -> 4.68, LINEAIRE, 8 poutres, 0 masse
    // C'est la cure du Cub, et pour la meme raison : le HANDOWER dit de son
    // eventail six branches qu'il est "the lumped stand-in for a spar box this
    // planar wing does not have". A 0.16 m d'epaisseur aucune structure interne
    // ne rivalise avec un ancrage 1.25 m SOUS l'aile (regle 1). La linearite
    // est le critere, pas la valeur : 2.22 rend l'aile plus raide que celle du
    // Cub, ce qui est discutable pour un ULM de 230 kg, mais l'alternative a
    // 8.8 deg reste un mecanisme. Si on veut l'assouplir un jour, c'est K_W
    // qu'on baisse — jamais en revenant a une reponse non lineaire.
    BW(sb, WF[2]); BW(sb2, WR[2]); BW(sb, WF[3]); BW(sb2, WR[3]);
    wf[sgn > 0 ? 'R' : 'L'] = { F: WF, R: WR, B: BF };
  };
  mkWing(+1); mkWing(-1);

  // ---- train classique : roues sous le pod, roulette au bout de la poutre
  const [GAL, GAR] = NM_(0.98, -0.30, 0.78, 3.5, 'AXLE', 0.20);
  function NM_(x, y, z, m, tag, r) {
    return [N(x, y, -Math.abs(z), m, tag + 'L', r), N(x, y, Math.abs(z), m, tag + 'R', r)];
  }
  BG(GAL, GAR);
  for (const [G, sgn] of [[GAL, -1], [GAR, 1]]) {
    const b1 = sgn > 0 ? P[1].BR : P[1].BL, b0 = sgn > 0 ? P[0].BR : P[0].BL;
    const b2 = sgn > 0 ? P[2].BR : P[2].BL, bo = sgn > 0 ? P[1].BL : P[1].BR;
    BG(G, b1); BG(G, b0); BG(G, b2); BG(G, bo);
  }
  const TW = N(4.95, -0.02, 0, 2, 'TW', 0.07);
  BG(TW, B3.L); BG(TW, B3.R); BG(TW, B2.T); BG(TW, B3.T);

  // ---- empennage surdimensionne sur la poutre
  const HTL = N(5.00, boomY + 0.02, -1.30, 2.5, 'HTL'), HTR = N(5.00, boomY + 0.02, 1.30, 2.5, 'HTR');
  BB(HTL, B3.T); BB(HTL, B3.L); BB(HTL, B2.T); BB(HTL, B2.L);
  BB(HTR, B3.T); BB(HTR, B3.R); BB(HTR, B2.T); BB(HTR, B2.R);
  const FIN = N(5.15, boomY + 0.95, 0, 2.5, 'FIN');
  BB(FIN, B3.T); BB(FIN, B2.T); BB(FIN, B3.L); BB(FIN, B3.R);
  // haubans d empennage (comme le vrai) : derive <-> saumons de stab.
  // Sans eux l empennage est un mecanisme en roulis (ressorts axiaux quasi
  // paralleles a x = raideur du 2e ordre) et la queue tombe sur le cote.
  BB(FIN, HTL); BB(FIN, HTR);
  // ...et les deux autres cotes de la pyramide + ancrage large vers l aile.
  // Mesure (probe 2026-08): CHAQUE jeu seul laisse la queue se coucher en
  // se verrouillant; les deux ensemble la font revenir droite elastiquement.
  // Ancrage sur les noeuds BAS du caisson (WB, pas de charge de bande) et
  // SOUPLE (1.2e5): assez pour retenir ~20 N.m de chute statique, trop mou
  // pour brider l aeroelasticite en vol (en 6e5 sur le longeron AR: battement
  // ampute de moitie, roulages TO/ldg derives de 10-30%).
  BB(HTL, TW); BB(HTR, TW);
  B(B3.T, wf.L.B[1], 1.2e5, 60); B(B3.T, wf.R.B[1], 1.2e5, 60);

  // ---- bandes : pusher -> AUCUN souffle sur l aile, souffle sur l empennage
  const strips = [];
  const cf = 0.80, cr = 0.20;
  const wingStrip = (fIn, fOut, rIn, rOut, area, side, o = {}) => {
    strips.push({ kind: 'wing', side, t: 0.5, area, chord: CH,
      fIn, fOut, rIn, rOut,
      w: [[fIn, cf * 0.5], [fOut, cf * 0.5], [rIn, cr * 0.5], [rOut, cr * 0.5]],
      wash: 0, ail: o.ail || 0, flap: o.flap || 0 });
  };
  // flaperons: the aileron surfaces droop symmetrically -> flap = ail gearing
  for (const [fr, side] of [[wf.R, 1], [wf.L, -1]]) {
    wingStrip(fr.F[0], fr.F[1], fr.R[0], fr.R[1], 1.77, side, { ail: 0.5, flap: 0.5 });
    wingStrip(fr.F[1], fr.F[2], fr.R[1], fr.R[2], 2.07, side, { ail: 0.8, flap: 0.8 });
    wingStrip(fr.F[2], fr.F[3], fr.R[2], fr.R[3], 2.00, side, { ail: 1, flap: 1 });
  }
  wingStrip(wf.L.F[0], wf.R.F[0], wf.L.R[0], wf.R.R[0], 1.34, 1, {});
  for (const [nHT, side] of [[HTL, -1], [HTR, 1]]) {
    strips.push({ kind: 'stab', side, area: 1.00, chord: 0.78, wash: 0.6,
      w: [[nHT, .55], [B3.L, .2], [B3.R, .2], [B3.T, .05]] });
  }
  strips.push({ kind: 'fin', area: 0.60, chord: 0.75, wash: 0.6,
    w: [[FIN, .5], [B3.T, .3], [B2.T, .2]] });
  strips.push({ kind: 'fin', area: 0.45, chord: 0.65, wash: 0.6,
    w: [[FIN, .2], [B3.T, .5], [B2.T, .3]] });

  const refs = {
    noseFrame: [P[0].BL, P[0].BR, P[0].ML, P[0].MR],
    tailMid: [B2.T, B2.L, B2.R],
    upLo: [P[1].BL, P[1].BR], upHi: [P[1].ML, P[1].MR],
    fusDrag: [P[1].BL, P[1].BR, P[1].ML, P[1].MR],
    fusDragAft: [B2.T, B2.L, B2.R],
    engine: [EM], mains: [GAL, GAR], tw: TW, fin: FIN,
  };
  const params = {
    name: 'Birdman Chinook 1S', viewDist: 12, substeps: 48,
    powerplant: 'rotax277_pusher',
    nEngines: 1,
    polarWing: POLARS.chinook_wing_AR87, polarTail: POLARS.fabric_tail,
    elevTau: 0.62, rudTau: 0.62, ailTau: 0.50, downwash: 0.32,
    stabTrim: -0.0359, sparSpacing: 0.61,
    fusCdA: [0.59, 0.9, 0.9], fusCdAAft: [0, 0.50, 0.50],
    twSteer: 0.5,
    // flaperons: droop is an actual surface rotation (tau alpha-shift on the
    // ail-geared strips) + a little drag; partial droop for landing so the
    // ailerons keep authority in the flare (1.13*Vs stall history: margins!)
    flaps: { to: 0, ldg: 0.6, rate: 0.25, tau: 0.08, dCl0: 0.25, dCd0: 0.030, dAStall: 0.02, dCm0: -0.12 },
    ap: {
      VRot: 10, VClimbMin: 12, VClimb: 17, VCruise: 24, VAppr: 16, VTurn: 19,
      TORun: 105,                   // measured run to 2.5 m agl (W14 multi-hop)
      lookRoll: 25, lookAppr: 140, lookCruise: 220,
      hCruise: 120, hSafe: 12, xTurn: -2600, xAim: -520, gs: 0.068,
      thrFloor: 0.06,
      rollDe: 0.10, liftoffTh: 0.15, liftoffRamp: 0.12,
      climbThBase: 0.11, climbThGain: 0.025, thMax: 0.19,
      flareAgl: 3.5, flareRate: 0.08, aglGuard: 2,
      flareMode: 'vs', flareThr: 0.10, flareThMax: 0.14,
      VTailUp: 12, VStop: 0.3, slew: 2.2, thrCruise: 0.55, thrAppr: 0.35,
      brakeMax: 0.30, brakeRampRate: 0.20, VBrakeOn: 11, VBrakeRelease: 1.0,
      rateFilt: 0.14, attFilt: 0.65, pitchP: 1.2, pitchD: 0.55, pitchI: 0.10,
      // vsFloor RE-ANCHORED -0.11 -> -0.15 with the wing stiffening above.
      // holdVS clamps the PITCH command to [vsFloor, thMax], and -0.11 rad is
      // -6.30 deg: measured, the aeroplane sat at theta -6.30 EXACTLY, pinned
      // on the floor, climbing 0.48 m/s for ever (208 m against hCruise 120 on
      // a long leg — it never levels). The floppy wing used to wash out under
      // load and bleed the lift away; the braced one keeps it, so level flight
      // now wants theta -7.51 (= -0.131 rad) and the old floor could not reach
      // it. Swept: -0.13 still ends 23 m high, -0.14 holds 120.0 exactly (and
      // is the drone's value, the fleet's widest) but leaves 0.5 deg of margin;
      // -0.15 leaves 1.1 deg for gusts and turns and measures identically.
      // NOT a tuning knob turned until the gate went green: the floor was
      // marginal before and the stiffer wing made it inadequate.
      pitchCmdSlew: 0.7, vsP: 0.020, vsI: 0.040, vsFloor: -0.15, altVSGain: 0.10,
      vsFilt: 0.40, hdgP: 0.65, hdgD: 0.85, bankSlew: 0.25, rollP: 1.6, rollD: 0.6,
      betaK: 0.3, yawDampK: 0.45, ariK: 0.15, bankLim: 0.42,
    },
  };
  return { nodes, beams, strips, refs, params };
}

// ============================================================
// CESSNA 172S SKYHAWK — 1000 kg (2 crew + fuel), high strut-
// braced wing, TRICYCLE gear with steerable nosewheel. x aft.
// ============================================================
function buildC172() {
  const nodes = [], beams = [];
  const N = (x, y, z, m, tag, r = 0) => (nodes.push({ p: [x, y, z], m, r, tag }), nodes.length - 1);
  const NM = (x, y, z, m, tag, r = 0) =>
    [N(x, y, -Math.abs(z), m, tag + 'L', r), N(x, y, Math.abs(z), m, tag + 'R', r)];
  const K_F = 8.0e5, C_F = 500, K_W = 2.2e6, C_W = 900, K_G = 1.6e5, C_G = 2600;
  const B = (a, b, k = K_F, c = C_F) => beams.push({ a, b, k, c, gear: k === K_G });
  const BW = (a, b) => B(a, b, K_W, C_W);
  const BG = (a, b) => B(a, b, K_G, C_G);

  const ST = [
    [0.60, 0.50, 0.15, 1.10, 25],
    [1.72, 0.60, 0.05, 1.42, 14],
    [2.56, 0.60, 0.05, 1.42, 14],
    [3.60, 0.50, 0.12, 1.30, 14],
    [5.00, 0.35, 0.30, 1.05, 11],
    [6.50, 0.22, 0.45, 0.85, 9],
  ];
  const F = [];
  ST.forEach(([x, w, yb, yt, m]) => {
    const [BL, BR] = NM(x, yb, w, m, 'B');
    const [TL, TR] = NM(x, yt, w, m, 'T');
    F.push({ BL, BR, TL, TR });
    B(BL, BR); B(TL, TR); B(BL, TL); B(BR, TR); B(BL, TR); B(BR, TL);
  });
  for (let i = 0; i < F.length - 1; i++) {
    const a = F[i], b = F[i + 1];
    B(a.BL, b.BL); B(a.BR, b.BR); B(a.TL, b.TL); B(a.TR, b.TR);
    B(a.BL, b.TL); B(a.BR, b.TR); B(a.TL, b.BL); B(a.TR, b.BR);
    B(a.TL, b.TR); B(a.TR, b.TL); B(a.BL, b.BR); B(a.BR, b.BL);
  }
  const TPB = N(7.95, 0.55, 0, 8, 'TPB'), TPT = N(7.95, 0.95, 0, 8, 'TPT');
  const S5 = F[5];
  B(TPB, TPT);
  B(S5.BL, TPB); B(S5.BR, TPB); B(S5.TL, TPT); B(S5.TR, TPT);
  B(S5.TL, TPB); B(S5.TR, TPB); B(S5.BL, TPT); B(S5.BR, TPT);

  const S0 = F[0];
  const MO = N(0.25, 0.58, 0, 155, 'ENG');            // IO-360 + prop + cowl
  B(MO, S0.TL); B(MO, S0.TR); B(MO, S0.BL); B(MO, S0.BR);
  nodes[F[1].BL].m += 50; nodes[F[1].BR].m += 50;      // crew
  nodes[F[2].BL].m += 40; nodes[F[2].BR].m += 40;      // pax
  nodes[F[3].BL].m += 12; nodes[F[3].BR].m += 12;      // bags

  // ---- high wing: constant chord inboard, taper outboard, 1.7 deg dihedral
  const zSt = [0.60, 2.30, 3.80, 5.50];
  const chord = z => z <= 2.5 ? 1.63 : 1.63 - (z - 2.5) * (1.63 - 1.13) / 3.0;
  const LEX = 1.50;
  const yW = z => 1.42 + Math.max(0, z - 0.6) * 0.030;
  const boxD = z => 0.12 * chord(z);
  const wf = { L: null, R: null };
  const mkWing = (sgn) => {
    const rootF = sgn > 0 ? F[1].TR : F[1].TL;
    const rootR = sgn > 0 ? F[2].TR : F[2].TL;
    const MF = [12, 8, 5];
    const WF = [], WR = [], BF = [], BR = [];
    zSt.slice(1).forEach((z, i) => {
      const c = chord(z);
      WF.push(N(LEX + 0.15 * c, yW(z), sgn * z, MF[i] + (i === 0 ? 45 : 0), 'WF'));  // fuel inboard
      WR.push(N(LEX + 0.65 * c, yW(z) - 0.5 * c * 0.026, sgn * z, MF[i] * 0.6, 'WR'));
      BF.push(N(LEX + 0.15 * c, yW(z) - boxD(z), sgn * z, Math.max(4, MF[i] * 0.35), 'WB'));
      BR.push(N(LEX + 0.65 * c, yW(z) - 0.5 * c * 0.026 - boxD(z) * 0.8, sgn * z, Math.max(3, MF[i] * 0.25), 'WB'));
    });
    const chF = [rootF, ...WF], chR = [rootR, ...WR], chB = [rootF, ...BF], chBR = [rootR, ...BR];
    for (let i = 0; i < zSt.length - 1; i++) {
      BW(chF[i], chF[i + 1]); BW(chR[i], chR[i + 1]);
      BW(chB[i], chB[i + 1]); BW(chBR[i], chBR[i + 1]);
      BW(chF[i + 1], chR[i + 1]); BW(chB[i + 1], chBR[i + 1]);
      BW(chF[i], chR[i + 1]); BW(chR[i], chF[i + 1]);
      BW(chB[i], chBR[i + 1]); BW(chBR[i], chB[i + 1]);
      BW(chF[i + 1], chB[i + 1]); BW(chF[i], chB[i + 1]); BW(chB[i], chF[i + 1]);
      BW(chR[i + 1], chBR[i + 1]); BW(chR[i], chBR[i + 1]); BW(chBR[i], chR[i + 1]);
      BW(chB[i + 1], chR[i + 1]); BW(chBR[i + 1], chF[i + 1]);
    }
    // lift struts to the lower fuselage — the Cessna signature
    const aF = sgn > 0 ? F[1].BR : F[1].BL, aR = sgn > 0 ? F[2].BR : F[2].BL;
    BW(aF, WF[0]); BW(aR, WR[0]); BW(aF, WR[0]); BW(aR, WF[0]);
    BW(aF, BF[0]); BW(aR, BR[0]);
    wf[sgn > 0 ? 'R' : 'L'] = { F: chF, R: chR };
  };
  mkWing(+1); mkWing(-1);

  // ---- TRICYCLE gear: sprung mains aft of CG, steerable nosewheel ahead.
  // Geometry calibrated against the 3D model (MODEL-IMPORT-PROC step 2):
  //   track 2.62 m (was 2.52), wheelbase 1.74 m (was 1.97 — the model and the
  //   real 172 are both ~1.7), tyre radii 0.173/0.174 measured off the meshes
  //   (were 0.28/0.24), and a LEVEL static stance: the model sits level on its
  //   gear, the old fiche sat 2.7 deg nose down.
  // The smaller tyres also drop the airframe 10 cm: the wing now rides 2.25 m
  // over the ground (was 2.35, real 172 ~2.2), which is what ground effect
  // reads. Do NOT shorten the legs further to chase the model's 1.95 m — the
  // axle attaches to the fuselage bottom rail at y 0.05 and |z| 0.60, so at
  // this track the legs already splay ~47 deg; take the drop below ~0.55 and
  // the gear goes over-centre and folds up under static load.
  const [GAL, GAR] = NM(2.72, -0.60, 1.31, 14, 'AXLE', 0.173);
  BG(GAL, GAR);
  for (const [G, sgn] of [[GAL, -1], [GAR, 1]]) {
    const b2 = sgn > 0 ? F[2].BR : F[2].BL, b3 = sgn > 0 ? F[3].BR : F[3].BL;
    const b1 = sgn > 0 ? F[1].BR : F[1].BL, bo = sgn > 0 ? F[2].BL : F[2].BR;
    BG(G, b2); BG(G, b3); BG(G, b1); BG(G, bo);
  }
  const NW = N(0.983, -0.566, 0, 10, 'TW', 0.174);     // nosewheel (steerable ref)
  BG(NW, S0.BL); BG(NW, S0.BR); BG(NW, F[1].BL); BG(NW, F[1].BR);

  // ---- tail
  const [HTL, HTR] = NM(7.55, 0.90, 1.72, 8, 'HT');
  B(HTL, TPB); B(HTL, TPT); B(HTL, S5.BL); B(HTL, S5.TL);
  B(HTR, TPB); B(HTR, TPT); B(HTR, S5.BR); B(HTR, S5.TR);
  const FIN = N(7.75, 2.10, 0, 9, 'FIN');
  B(FIN, TPT); B(FIN, S5.TL); B(FIN, S5.TR); B(FIN, TPB);

  // ---- strips
  const strips = [];
  const cf = 0.80, cr = 0.20;
  const wingStrip = (fIn, fOut, rIn, rOut, area, ch, side, o = {}) => {
    strips.push({ kind: 'wing', side, t: 0.5, area, chord: ch,
      fIn, fOut, rIn, rOut,
      w: [[fIn, cf * 0.5], [fOut, cf * 0.5], [rIn, cr * 0.5], [rOut, cr * 0.5]],
      wash: o.wash || 0, ail: o.ail || 0, flap: o.flap || 0 });
  };
  for (const [fr, side] of [[wf.R, 1], [wf.L, -1]]) {
    wingStrip(fr.F[0], fr.F[1], fr.R[0], fr.R[1], 2.77, 1.63, side, { wash: 0.45, flap: 1 });
    wingStrip(fr.F[1], fr.F[2], fr.R[1], fr.R[2], 2.31, 1.54, side, { ail: 0.4 });
    wingStrip(fr.F[2], fr.F[3], fr.R[2], fr.R[3], 2.12, 1.27, side, { ail: 1 });
  }
  wingStrip(F[1].TL, F[1].TR, F[2].TL, F[2].TR, 1.96, 1.63, 1, { wash: 0.9, flap: 1 });
  for (const [nHT, side] of [[HTL, -1], [HTR, 1]]) {
    strips.push({ kind: 'stab', side, area: 1.85, chord: 1.20, wash: 0.55,
      w: [[nHT, .55], [TPB, .25], [TPT, .2]] });
  }
  strips.push({ kind: 'fin', area: 0.95, chord: 1.10, wash: 0.55,
    w: [[FIN, .5], [TPT, .3], [TPB, .2]] });
  strips.push({ kind: 'fin', area: 0.70, chord: 0.95, wash: 0.55,
    w: [[FIN, .2], [TPT, .45], [TPB, .35]] });

  const refs = {
    noseFrame: [F[0].BL, F[0].BR, F[0].TL, F[0].TR],
    tailMid: [F[4].BL, F[4].BR, F[4].TL, F[4].TR],
    upLo: [F[1].BL, F[1].BR], upHi: [F[1].TL, F[1].TR],
    fusDrag: [F[1].BL, F[1].BR, F[1].TL, F[1].TR],
    fusDragAft: [F[4].BL, F[4].BR, F[4].TL, F[4].TR],
    engine: [MO], mains: [GAL, GAR], tw: NW, fin: FIN,
  };
  const params = {
    name: 'Cessna 172S Skyhawk', viewDist: 13, substeps: 48,
    powerplant: 'io360_mccauley',
    nEngines: 1,
    polarWing: POLARS.naca2412_AR75, polarTail: POLARS.metal_tail_c172,
    elevTau: 0.48, rudTau: 0.50, ailTau: 0.35, downwash: 0.40,
    stabTrim: 0.0006, sparSpacing: 0.82,
    fusCdA: [0.46, 1.0, 1.0], fusCdAAft: [0, 0.70, 0.70],
    // nosewheel. Sign verified: the solver turns the rolling direction by
    // -twSteer*dr about +y, so negative points the NOSE wheel left for
    // nose-left (a tailwheel wants the positive sign the taildraggers use).
    twSteer: -0.35,
    // barn-door Fowler-ish flaps 30: calibrated in the free-air tunnel against
    // POH Vs0 ~40-42 kt vs Vs1 46 (see test_flaps.js)
    // dCm0 ~ -0.25*dCl0 (thin-airfoil TE device): weaker values let the flap
    // lift increment pitch the nose UP and the AP ballooned above the slope
    flaps: { to: 0, ldg: 1, rate: 0.14, dCl0: 1.15, dCd0: 0.065, dAStall: 0.02, dCm0: -0.29 },
    ap: {
      rotate: true,
      VRot: 28, VClimbMin: 32, VClimb: 38, VCruise: 58, VAppr: 33.5, VTurn: 44,
      TORun: 400,                   // measured run to 2.5 m agl (W14 multi-hop)
      thTailUp: 0.02, thRotate: 0.10,
      lookRoll: 35, lookAppr: 320, lookCruise: 450,
      hCruise: 180, hSafe: 20, xTurn: -3800, xAim: -640, gs: 0.052,
      thrFloor: 0.05,
      rollDe: 0.02, liftoffTh: 0.13, liftoffRamp: 0.10,
      climbThBase: 0.10, climbThGain: 0.020, thMax: 0.17,
      flareAgl: 5.5, flareRate: 0.055, aglGuard: 3,
      flareMode: 'vs', flareThr: 0.10, flareThMax: 0.10,
      rolloutMode: 'trike', VDerotate: 16, rolloutTh: 0.035,
      VTailUp: 99, VStop: 0.4, slew: 1.8, thrCruise: 0.62, thrAppr: 0.32,
      brakeMax: 0.28, brakeRampRate: 0.12, VBrakeOn: 24, VBrakeRelease: 1.5,
      rateFilt: 0.15, attFilt: 0.70, pitchP: 1.2, pitchD: 0.90, pitchI: 0.12,
      pitchCmdSlew: 0.8, vsP: 0.019, vsI: 0.042, vsFloor: -0.10, altVSGain: 0.09,
      vsFilt: 0.40, hdgP: 0.6, hdgD: 0.9, bankSlew: 0.22, rollP: 1.5, rollD: 0.45,
      betaK: 0.3, yawDampK: 0.4, ariK: 0.15, bankLim: 0.45,
    },
  };
  return { nodes, beams, strips, refs, params };
}

// ============================================================
// JODEL DR-1050 SICILE "SPEEDJOJO" — 650 kg en config 2 pers.,
// aile cassee Jodel (diedre 14 deg externe), train classique.
// Cellule nettoyee : capot carbone, roulette carenee. x arriere.
// ============================================================
function buildJodel() {
  const nodes = [], beams = [];
  const N = (x, y, z, m, tag, r = 0) => (nodes.push({ p: [x, y, z], m, r, tag }), nodes.length - 1);
  const NM = (x, y, z, m, tag, r = 0) =>
    [N(x, y, -Math.abs(z), m, tag + 'L', r), N(x, y, Math.abs(z), m, tag + 'R', r)];
  const K_F = 4.0e5, C_F = 300, K_W = 2.5e6, C_W = 950, K_G = 1.3e5, C_G = 2400;
  const B = (a, b, k = K_F, c = C_F) => beams.push({ a, b, k, c, gear: k === K_G });
  const BW = (a, b) => B(a, b, K_W, C_W);
  const BG = (a, b) => B(a, b, K_G, C_G);

  const ST = [
    [0.55, 0.42, 0.10, 0.95, 12],
    [1.45, 0.52, 0.02, 1.10, 10],
    [2.15, 0.55, 0.00, 1.15, 9],
    [3.00, 0.55, 0.00, 1.12, 9],
    [4.30, 0.35, 0.15, 0.80, 6],
    [5.60, 0.18, 0.32, 0.62, 5],
  ];
  const F = [];
  ST.forEach(([x, w, yb, yt, m]) => {
    const [BL, BR] = NM(x, yb, w, m, 'B');
    const [TL, TR] = NM(x, yt, w, m, 'T');
    F.push({ BL, BR, TL, TR });
    B(BL, BR); B(TL, TR); B(BL, TL); B(BR, TR); B(BL, TR); B(BR, TL);
  });
  for (let i = 0; i < F.length - 1; i++) {
    const a = F[i], b = F[i + 1];
    B(a.BL, b.BL); B(a.BR, b.BR); B(a.TL, b.TL); B(a.TR, b.TR);
    B(a.BL, b.TL); B(a.BR, b.TR); B(a.TL, b.BL); B(a.TR, b.BR);
    B(a.TL, b.TR); B(a.TR, b.TL); B(a.BL, b.BR); B(a.BR, b.BL);
  }
  const TPB = N(6.25, 0.40, 0, 4, 'TPB'), TPT = N(6.25, 0.72, 0, 4, 'TPT');
  const S5 = F[5];
  B(TPB, TPT);
  B(S5.BL, TPB); B(S5.BR, TPB); B(S5.TL, TPT); B(S5.TR, TPT);
  B(S5.TL, TPB); B(S5.TR, TPB); B(S5.BL, TPT); B(S5.BR, TPT);

  // O-200 + capot + helice sur cloison pare-feu
  const S0 = F[0];
  const MO = N(0.10, 0.48, 0, 85, 'ENG');
  B(MO, S0.TL); B(MO, S0.TR); B(MO, S0.BL); B(MO, S0.BR);
  // equipage avant (2 x 45 kg), essence (55 kg), amenagement cabine
  nodes[F[2].BL].m += 22; nodes[F[2].BR].m += 22;
  nodes[F[3].BL].m += 45; nodes[F[3].BR].m += 45;
  nodes[F[4].BL].m += 5; nodes[F[4].BR].m += 5;   // batterie LiFePO4 en soute
  nodes[F[2].TL].m += 12; nodes[F[2].TR].m += 12;
  nodes[F[3].TL].m += 10; nodes[F[3].TR].m += 10;

  // ---- aile Jodel : panneau central plat, cassure a z=2.10, diedre 14 deg
  const zSt = [0.55, 2.10, 3.30, 4.36];
  const chord = z => z <= 2.10 ? 1.71 : 1.71 - 0.3363 * (z - 2.10);
  const LEX = 1.80;
  const yW = z => 0.10 + Math.max(0, z - 2.10) * 0.249;
  const boxD = z => 0.13 * chord(z);
  const wf = { L: null, R: null }, keel = { L: null, R: null };
  const mkWing = (sgn) => {
    const rootF = sgn > 0 ? F[2].BR : F[2].BL;
    const rootR = sgn > 0 ? F[3].BR : F[3].BL;
    // quille : le longeron traverse le plancher a pleine hauteur
    const cR = chord(0.55);
    const KF = N(LEX + 0.15 * cR, yW(0.55) - boxD(0.55), sgn * 0.55, 6, 'WB');
    const KR = N(LEX + 0.65 * cR, yW(0.55) - 0.5 * cR * 0.035 - boxD(0.55) * 0.8, sgn * 0.55, 4, 'WB');
    const F2o = sgn > 0 ? F[2].BL : F[2].BR, F3o = sgn > 0 ? F[3].BL : F[3].BR;
    BW(KF, rootF); BW(KF, F2o); BW(KF, rootR);
    BW(KR, rootR); BW(KR, F3o); BW(KR, rootF);
    BW(KF, KR);
    keel[sgn > 0 ? 'R' : 'L'] = { KF, KR };
    const MF = [10, 6, 4];
    const WF = [], WR = [], BF = [], BR = [];
    zSt.slice(1).forEach((z, i) => {
      const c = chord(z);
      WF.push(N(LEX + 0.15 * c, yW(z), sgn * z, MF[i], 'WF'));
      WR.push(N(LEX + 0.65 * c, yW(z) - 0.5 * c * 0.035, sgn * z, MF[i] * 0.6, 'WR'));
      BF.push(N(LEX + 0.15 * c, yW(z) - boxD(z), sgn * z, Math.max(3.0, MF[i] * 0.35), 'WB'));
      BR.push(N(LEX + 0.65 * c, yW(z) - 0.5 * c * 0.035 - boxD(z) * 0.8, sgn * z, Math.max(2.5, MF[i] * 0.25), 'WB'));
    });
    const chF = [rootF, ...WF], chR = [rootR, ...WR], chB = [KF, ...BF], chBR = [KR, ...BR];
    for (let i = 0; i < zSt.length - 1; i++) {
      BW(chF[i], chF[i + 1]); BW(chR[i], chR[i + 1]);
      BW(chB[i], chB[i + 1]); BW(chBR[i], chBR[i + 1]);
      BW(chF[i + 1], chR[i + 1]);                            // nervure haute
      BW(chB[i + 1], chBR[i + 1]);                           // nervure basse
      BW(chF[i], chR[i + 1]); BW(chR[i], chF[i + 1]);        // treillis superieur
      BW(chB[i], chBR[i + 1]); BW(chBR[i], chB[i + 1]);      // treillis inferieur
      BW(chF[i + 1], chB[i + 1]);                            // montant ame avant
      BW(chF[i], chB[i + 1]); BW(chB[i], chF[i + 1]);        // cisaillement avant
      BW(chR[i + 1], chBR[i + 1]);                           // montant ame arriere
      BW(chR[i], chBR[i + 1]); BW(chBR[i], chR[i + 1]);      // cisaillement arriere
      BW(chB[i + 1], chR[i + 1]); BW(chBR[i + 1], chF[i + 1]); // diagonales caisson
    }
    wf[sgn > 0 ? 'R' : 'L'] = { F: chF, R: chR };
  };
  mkWing(+1); mkWing(-1);
  const KB = (a, b) => beams.push({ a, b, k: K_W, c: C_W, gear: false });
  KB(keel.L.KF, keel.R.KF); KB(keel.L.KR, keel.R.KR);
  KB(keel.L.KF, keel.R.KR); KB(keel.R.KF, keel.L.KR);

  // ---- train classique : jambes sous la cassure, roulette carenee
  const [GAL, GAR] = NM(1.82, -0.62, 1.05, 8, 'AXLE', 0.21);
  BG(GAL, GAR);
  for (const [G, side] of [[GAL, 'L'], [GAR, 'R']]) {
    const w = wf[side];
    const f1 = side === 'L' ? F[1].BL : F[1].BR;   // reprise de trainee vers l'avant
    BG(G, w.F[0]); BG(G, w.F[1]); BG(G, w.R[1]); BG(G, f1);
  }
  const TW = N(5.95, -0.08, 0, 3, 'TW', 0.09);
  BG(TW, S5.BL); BG(TW, S5.BR); BG(TW, TPB);

  // ---- empennage
  const [HTL, HTR] = NM(5.95, 0.55, 1.05, 3, 'HT');
  B(HTL, TPB); B(HTL, TPT); B(HTL, S5.BL); B(HTL, S5.TL);
  B(HTR, TPB); B(HTR, TPT); B(HTR, S5.BR); B(HTR, S5.TR);
  const FIN = N(6.05, 1.35, 0, 3, 'FIN');
  B(FIN, TPT); B(FIN, S5.TL); B(FIN, S5.TR);

  // ---- bandes aero
  const strips = [];
  const cf = 0.80, cr = 0.20;
  const wingStrip = (fIn, fOut, rIn, rOut, area, ch, side, o = {}) => {
    strips.push({ kind: 'wing', side, t: 0.5, area, chord: ch,
      fIn, fOut, rIn, rOut,
      w: [[fIn, cf * 0.5], [fOut, cf * 0.5], [rIn, cr * 0.5], [rOut, cr * 0.5]],
      wash: o.wash || 0, ail: o.ail || 0, flap: o.flap || 0 });
  };
  for (const [fr, side] of [[wf.R, 1], [wf.L, -1]]) {
    wingStrip(fr.F[0], fr.F[1], fr.R[0], fr.R[1], 2.65, 1.71, side, { wash: 0.35, flap: 1 });
    wingStrip(fr.F[1], fr.F[2], fr.R[1], fr.R[2], 1.81, 1.51, side, { ail: 0.5 });
    wingStrip(fr.F[2], fr.F[3], fr.R[2], fr.R[3], 1.20, 1.13, side, { ail: 1 });
  }
  wingStrip(F[2].BL, F[2].BR, F[3].BL, F[3].BR, 1.90, 1.71, 1, { wash: 0.9, flap: 1 });
  for (const [nHT, side] of [[HTL, -1], [HTR, 1]]) {
    strips.push({ kind: 'stab', side, area: 1.15, chord: 0.95, wash: 0.85,
      w: [[nHT, .55], [TPB, .25], [TPT, .2]] });
  }
  strips.push({ kind: 'fin', area: 0.65, chord: 0.85, wash: 0.85,
    w: [[FIN, .5], [TPT, .3], [TPB, .2]] });
  strips.push({ kind: 'fin', area: 0.50, chord: 0.75, wash: 0.85,
    w: [[FIN, .2], [TPT, .45], [TPB, .35]] });

  const refs = {
    noseFrame: [F[0].BL, F[0].BR, F[0].TL, F[0].TR],
    tailMid: [F[4].BL, F[4].BR, F[4].TL, F[4].TR],
    upLo: [F[1].BL, F[1].BR], upHi: [F[1].TL, F[1].TR],
    fusDrag: [F[2].BL, F[2].BR, F[2].TL, F[2].TR],
    fusDragAft: [F[4].BL, F[4].BR, F[4].TL, F[4].TR],
    engine: [MO], mains: [GAL, GAR], tw: TW, fin: FIN,
  };
  const params = {
    name: 'Jodel DR-1050 "Speedjojo"', viewDist: 11, substeps: 48,
    powerplant: 'o200_eprops',
    nEngines: 1,
    polarWing: POLARS.jodel_wing_AR55, polarTail: POLARS.wood_tail,
    elevTau: 0.48, rudTau: 0.50, ailTau: 0.35, downwash: 0.38,
    stabTrim: -0.0411, sparSpacing: 0.75,
    fusCdA: [0.095, 0.50, 0.50], fusCdAAft: [0, 0.32, 0.32],
    twSteer: 0.45,
    // small plain flaps inboard
    // ldg 0.65: full deflection of these small plain flaps made the flare
    // harsh (sink 1.45, rollout nose-dip -8.4, gear strain 3x) for little gain
    flaps: { to: 0, ldg: 0.65, rate: 0.18, dCl0: 0.55, dCd0: 0.040, dAStall: 0.015, dCm0: -0.14 },
    ap: {
      rotate: true,
      VRot: 27, VClimbMin: 30, VClimb: 41.7, VCruise: 62, VAppr: 33, VTurn: 45,
      TORun: 410,                   // measured run to 2.5 m agl (W14 multi-hop)
      thTailUp: 0.030, thRotate: 0.11,
      lookRoll: 30, lookAppr: 300, lookCruise: 420,
      hCruise: 160, hSafe: 20, xTurn: -3600, xAim: -560, gs: 0.045,
      thrFloor: 0.05,
      rollDe: 0.08, liftoffTh: 0.13, liftoffRamp: 0.10,
      climbThBase: 0.10, climbThGain: 0.022, thMax: 0.18,
      flareAgl: 4.0, flareRate: 0.055, aglGuard: 3,
      flareMode: 'vs', flareThr: 0.06, flareThMax: 0.11,
      VTailUp: 14, VStop: 0.4, slew: 2.0, thrCruise: 0.62, thrAppr: 0.32,
      // GE retune (session 1): coasting from touchdown 32 m/s down to 12
      // before braking overran the runway once ground effect trimmed the
      // rolling friction; was VBrakeOn 12 (overran to x=+51).
      brakeMax: 0.30, brakeRampRate: 0.14, VBrakeOn: 20, VBrakeRelease: 1.5,
      rateFilt: 0.18, attFilt: 0.60, pitchP: 1.3, pitchD: 0.70, pitchI: 0.12,
      pitchCmdSlew: 1.0, vsP: 0.014, vsI: 0.030, vsFloor: -0.10, altVSGain: 0.10,
      // W16 lateral quiet: 1.1/0.30 limit-cycled 11 deg of REAL bank at
      // 1.8 Hz (28 deg aileron p2p) — an aileron-loop instability, proven
      // by the freeze test (rollP=rollD=0 -> dead calm; rudder freeze
      // changed nothing, so NOT dutch roll; raising servo slew made it
      // WORSE). rollP 0.5/rollD 0.15 kills it; hdgP 0.5 -> 0.65
      // compensates the softer roll loop for capture + decrab (measured:
      // calm tdZ 2.4, crosswind tdDrift -0.24 / tdZ 2.9 — better than
      // the OLD gains' -1.64 / -6.9). Pure-roll candidates failed the
      // crosswind drift bound: quiet needs the course loop to carry more.
      vsFilt: 0.40, hdgP: 0.65, hdgD: 0.8, bankSlew: 0.20, rollP: 0.5, rollD: 0.15,
      betaK: 0.3, yawDampK: 0.35, ariK: 0.0, bankLim: 0.48,
    },
  };
  return { nodes, beams, strips, refs, params };
}

// ============================================================
// FOAM TRAINER — 1.4 m span shoulder-wing electric trainer,
// ~1.15 kg AUW. Same solver, different fiche.
// ============================================================
function buildDrone() {
  const nodes = [], beams = [];
  const N = (x, y, z, m, tag, r = 0) => (nodes.push({ p: [x, y, z], m, r, tag }), nodes.length - 1);
  const NM = (x, y, z, m, tag, r = 0) =>
    [N(x, y, -Math.abs(z), m, tag + 'L', r), N(x, y, Math.abs(z), m, tag + 'R', r)];
  // K_G 420 -> 1100 (2026-08): the wire legs collapsed in the reset ground-eject
  // and the bare TPB tail node ended up resting ON the terrain with the
  // tailwheel floating 17 mm above it. C_G stays 9: the 10 g TW node is at the
  // c*dt/m damping limit already.
  const K_F = 3000, C_F = 3.5, K_W = 25000, C_W = 11, K_G = 1100, C_G = 9;
  const B = (a, b, k = K_F, c = C_F) => beams.push({ a, b, k, c, gear: k === K_G });
  const BW = (a, b) => B(a, b, K_W, C_W);
  const BG = (a, b) => B(a, b, K_G, C_G);

  const MN = 0.016;                    // typical foam node
  const ST = [                         // [x, halfW, yBot, yTop]
    [0.03, 0.045, 0.00, 0.105],
    [0.31, 0.050, -0.005, 0.115],
    [0.42, 0.050, -0.005, 0.115],
    [0.64, 0.035, 0.015, 0.085],
  ];
  const F = [];
  ST.forEach(([x, w, yb, yt]) => {
    const [BL, BR] = NM(x, yb, w, MN, 'B');
    const [TL, TR] = NM(x, yt, w, MN, 'T');
    F.push({ BL, BR, TL, TR });
    B(BL, BR); B(TL, TR); B(BL, TL); B(BR, TR); B(BL, TR); B(BR, TL);
  });
  for (let i = 0; i < F.length - 1; i++) {
    const a = F[i], b = F[i + 1];
    B(a.BL, b.BL); B(a.BR, b.BR); B(a.TL, b.TL); B(a.TR, b.TR);
    B(a.BL, b.TL); B(a.BR, b.TR); B(a.TL, b.BL); B(a.TR, b.BR);
    B(a.TL, b.TR); B(a.TR, b.TL); B(a.BL, b.BR); B(a.BR, b.BL);
  }
  const TPB = N(0.92, 0.025, 0, MN, 'TPB'), TPT = N(0.92, 0.085, 0, MN, 'TPT');
  const S3 = F[3];
  const BT = (a, b) => B(a, b, 12000, 8);      // carbon boom
  BT(TPB, TPT);
  BT(S3.BL, TPB); BT(S3.BR, TPB); BT(S3.TL, TPT); BT(S3.TR, TPT);
  BT(S3.TL, TPB); BT(S3.TR, TPB); BT(S3.BL, TPT); BT(S3.BR, TPT);

  // motor on a short mount (mass from powerplant registry)
  const S0 = F[0];
  const MO = N(-0.045, 0.055, 0, 0.10, 'ENG');
  B(MO, S0.TL); B(MO, S0.TR); B(MO, S0.BL); B(MO, S0.BR);
  // battery pack under the wing LE (CG at ~29% MAC), 0.19 kg
  nodes[F[1].BL].m += 0.095; nodes[F[1].BR].m += 0.095;

  // shoulder wing: two spars at 15% / 60% of 0.25 m chord, 4 deg dihedral
  const wf = { L: null, R: null }, keel = { L: null, R: null };
  const mkWing = (sgn) => {
    const rootF = sgn > 0 ? F[1].TR : F[1].TL, rootR = sgn > 0 ? F[2].TR : F[2].TL;
    const anchB = sgn > 0 ? F[1].BR : F[1].BL;   // bottom chord root
    const zs = [0.36, 0.68], DIH = 0.070, MW = 0.045, MB = 0.020;
    const WF = zs.map(z => N(0.31, 0.115 + (z - 0.05) * DIH, sgn * z, MW, 'WF'));
    const WR = zs.map(z => N(0.42, 0.115 + (z - 0.05) * DIH, sgn * z, MW, 'WR'));
    // spar-box bottom chord under the front spar (real bending depth)
    const BF = zs.map(z => N(0.31, 0.060 + (z - 0.05) * DIH, sgn * z, MB, 'WB'));
    // top surface
    BW(rootF, WF[0]); BW(WF[0], WF[1]);
    BW(rootR, WR[0]); BW(WR[0], WR[1]);
    BW(WF[0], WR[0]); BW(WF[1], WR[1]);
    BW(rootF, WR[0]); BW(WF[0], WR[1]); BW(WR[0], WF[1]);
    // spar web: bottom chord, verticals, shear diagonals
    BW(anchB, BF[0]); BW(BF[0], BF[1]);
    BW(WF[0], BF[0]); BW(WF[1], BF[1]);
    BW(rootF, BF[0]); BW(anchB, WF[0]);
    BW(WF[0], BF[1]); BW(BF[0], WF[1]);
    // torsion box: bottom chord to rear spar
    BW(BF[0], WR[0]); BW(BF[1], WR[1]); BW(BF[0], WR[1]); BW(BF[0], rootR);
    // legacy fan retained as redundant bracing
    BW(anchB, WF[1]); BW(anchB, WR[0]); BW(anchB, WR[1]);
    wf[sgn > 0 ? 'R' : 'L'] = { F: [rootF, ...WF], R: [rootR, ...WR] };
  };
  mkWing(+1); mkWing(-1);

  // tail surfaces
  const [HTL, HTR] = NM(0.88, 0.055, 0.28, 0.012, 'HT');
  BT(HTL, TPB); BT(HTL, TPT); BT(HTL, S3.TL); BT(HTL, S3.BL);
  BT(HTR, TPB); BT(HTR, TPT); BT(HTR, S3.TR); BT(HTR, S3.BR);
  const FIN = N(0.90, 0.24, 0, 0.012, 'FIN');
  BT(FIN, TPT); BT(FIN, S3.TL); BT(FIN, S3.TR);

  // taildragger gear: wire mains + tailskid
  const [GAL, GAR] = NM(0.12, -0.115, 0.13, 0.022, 'AXLE', 0.030);
  BG(GAL, GAR);
  BG(GAL, S0.BL); BG(GAL, F[1].BL); BG(GAL, S0.BR);
  BG(GAR, S0.BR); BG(GAR, F[1].BR); BG(GAR, S0.BL);
  const TW = N(0.88, -0.005, 0, 0.010, 'TW', 0.015);
  BG(TW, TPB); BG(TW, S3.BL); BG(TW, S3.BR);
  // near-vertical member: without it the shallow leg tripod snap-throughs
  // during the reset ground-eject and latches FOLDED UP (TW above the tail
  // post, bare TPB resting on the terrain) — the Jodel rule-7 pathology.
  BG(TW, TPT);

  // ---- aero strips: chord 0.25, spar weights c/4 between 15%/60% spars ----
  const strips = [];
  const cf = 0.78, cr = 0.22;
  const wingStrip = (fIn, fOut, rIn, rOut, t, area, side, o = {}) => {
    strips.push({ kind: 'wing', side, t, area, chord: 0.25,
      fIn, fOut, rIn, rOut,
      w: [[fIn, cf * (1 - t)], [fOut, cf * t], [rIn, cr * (1 - t)], [rOut, cr * t]],
      wash: o.wash || 0, ail: o.ail || 0 });
  };
  for (const [fr, side] of [[wf.R, 1], [wf.L, -1]]) {
    wingStrip(fr.F[0], fr.F[1], fr.R[0], fr.R[1], 0.30, 0.31 * 0.25, side, { wash: 0.4 });
    wingStrip(fr.F[1], fr.F[2], fr.R[1], fr.R[2], 0.60, 0.32 * 0.25, side, { ail: 1 });
  }
  wingStrip(F[1].TL, F[1].TR, F[2].TL, F[2].TR, 0.5, 0.10 * 0.25, 1, { wash: 1 });
  for (const [nHT, side] of [[HTL, -1], [HTR, 1]]) {
    strips.push({ kind: 'stab', side, area: 0.028, chord: 0.14, wash: 1,
      w: [[nHT, .55], [TPB, .25], [TPT, .2]] });
  }
  strips.push({ kind: 'fin', area: 0.022, chord: 0.13, wash: 1,
    w: [[FIN, .45], [TPT, .3], [TPB, .25]] });

  const refs = {
    noseFrame: [S0.BL, S0.BR, S0.TL, S0.TR],
    tailMid: [S3.BL, S3.BR, S3.TL, S3.TR],   // rigid box, not the whippy boom
    upLo: [S0.BL, S0.BR], upHi: [S0.TL, S0.TR],
    fusDrag: [F[1].BL, F[1].BR, F[1].TL, F[1].TR],
    fusDragAft: [F[3].BL, F[3].BR, F[3].TL, F[3].TR],
    engine: [MO], mains: [GAL, GAR], tw: TW, fin: FIN,
  };
  const params = {
    name: 'Foam Trainer 1.4m', viewDist: 3.2, substeps: 48,
    powerplant: 'outrunner2212_9x47',
    nEngines: 1,
    polarWing: POLARS.foam_wing_AR56, polarTail: POLARS.foam_tail,
    elevTau: 0.55, rudTau: 0.60, ailTau: 0.45, downwash: 0.35,
    stabTrim: -0.0781, sparSpacing: 0.11,
    fusCdA: [0.012, 0.03, 0.03], fusCdAAft: [0, 0.02, 0.02],
    twSteer: 0.75,
    ap: {
      VRot: 4.5, VClimbMin: 8.5, VClimb: 10, VCruise: 13, VAppr: 9,
      // no VTurn: see the cub fiche. This aeroplane is the reason the point
      // matters most — its TURNBACK falls back to VCruise 13 while its
      // INBOUND rides the literal 24, and stating a single VTurn: 24 doubled
      // the turnback speed and took its elevator chatter from 0.3 to
      // 5.5 deg/s. Measured, not reasoned.
      TORun: 15,                    // measured run to 2.5 m agl (W14 multi-hop)
      hCruise: 60, hSafe: 8, xTurn: -900, xAim: -430, gs: 0.075,
      rollDe: 0.05, liftoffTh: 0.17, climbThBase: 0.13, climbThGain: 0.030,
      thMax: 0.22, flareAgl: 2.2, flareRate: 0.10, aglGuard: 1.5,
      flareThMax: 0.16, flareThr: 0.15, flareMode: 'vs',
      VTailUp: 7.5, VStop: 0.3, slew: 2.5, thrCruise: 0.55, thrAppr: 0.30,
      liftoffRamp: 0.12,
      brakeMax: 0.25, brakeRampRate: 0.25, VBrakeOn: 5, VBrakeRelease: 0.8,
      rateFilt: 0.20, attFilt: 0.45, pitchP: 1.0, pitchD: 0.12, pitchI: 0.10,
      vsP: 0.018, vsI: 0.055, vsFloor: -0.14, altVSGain: 0.15,
      vsFilt: 0.25, pitchCmdSlew: 0.6,
      hdgP: 0.9, hdgD: 0.5, bankSlew: 0.7, rollP: 2.0, rollD: 0.25,
      betaK: 0.3, yawDampK: 0.3, ariK: 0.3, bankLim: 0.35,
    },
  };
  return { nodes, beams, strips, refs, params };
}

// ============================================================
// PIPER PA-18 SUPER CUB — the J-3 fiche (byte-copy geometry: same
// nodes/beams/masses, so the PA-18 skin calibration carries) plus the
// PA-18's slotted flaps. Carries the 3D flexbody skin (src/models/
// pa18_model.js); the J-3 stays wireframe and may retire later.
// ============================================================
function buildPA18() {
  const nodes = [], beams = [];
  const N = (x, y, z, m, tag, r = 0) => (nodes.push({ p: [x, y, z], m, r, tag }), nodes.length - 1);
  const NM = (x, y, z, m, tag, r = 0) =>
    [N(x, y, -Math.abs(z), m, tag + 'L', r), N(x, y, Math.abs(z), m, tag + 'R', r)];
  const K_CH = 2.0e5, C_CH = 60, K_GR = 2.8e4, C_GR = 900, K_WG = 5.0e5, C_WG = 450;
  const B = (a, b, k = K_CH, c = C_CH) => beams.push({ a, b, k, c, gear: k === K_GR });
  const BG = (a, b) => B(a, b, K_GR, C_GR);

  const ST = [                       // [x, halfW, yBot, yTop, nodeMass]
    [0.00, 0.33,  0.00, 0.78, 3.0],
    [0.62, 0.36, -0.02, 1.00, 3.0],
    [1.40, 0.36, -0.02, 1.00, 3.0],
    [2.05, 0.30,  0.02, 0.74, 1.5],
    [2.85, 0.24,  0.08, 0.60, 1.5],
    [3.65, 0.17,  0.14, 0.48, 1.5],
    [4.45, 0.10,  0.20, 0.38, 1.5],
  ];
  const F = [];
  ST.forEach(([x, w, yb, yt, mm], i) => {
    const [BL, BR] = NM(x, yb, w, mm, `S${i}B`);
    const [TL, TR] = NM(x, yt, w, mm, `S${i}T`);
    F.push({ BL, BR, TL, TR });
    B(BL, BR); B(TL, TR); B(BL, TL); B(BR, TR);
    B(BL, TR); B(BR, TL);            // X-brace: mirror-symmetric shear
  });
  for (let i = 0; i < F.length - 1; i++) {
    const a = F[i], b = F[i + 1], alt = i % 2;
    B(a.BL, b.BL); B(a.BR, b.BR); B(a.TL, b.TL); B(a.TR, b.TR);
    B(alt ? a.BL : a.TL, alt ? b.TL : b.BL);
    B(alt ? a.BR : a.TR, alt ? b.TR : b.BR);
    B(a.TL, b.TR); B(a.TR, b.TL);    // top panel X
    B(a.BL, b.BR); B(a.BR, b.BL);    // bottom panel X
  }
  const TPB = N(5.12, 0.25, 0, 1.2, 'TPB'), TPT = N(5.12, 0.36, 0, 1.2, 'TPT');
  const S6 = F[6];
  B(TPB, TPT);
  B(S6.BL, TPB); B(S6.BR, TPB); B(S6.TL, TPT); B(S6.TR, TPT);
  B(S6.TL, TPB); B(S6.TR, TPB);

  const [EL, ER] = NM(-0.48, 0.36, 0.20, 40, 'ENG');   // engine+prop ~80 kg
  const S0 = F[0];
  B(EL, ER);
  B(EL, S0.TL); B(EL, S0.BL); B(EL, S0.BR);
  B(ER, S0.TR); B(ER, S0.BR); B(ER, S0.BL);
  nodes[S0.TL].m += 18; nodes[S0.TR].m += 18;          // fuel 36 kg at firewall

  const [GAL, GAR] = NM(0.55, -0.80, 0.89, 6, 'AXLE', 0.20);
  BG(GAL, GAR);
  BG(GAL, S0.BL); BG(GAL, F[1].BL); BG(GAL, S0.BR);
  BG(GAR, S0.BR); BG(GAR, F[1].BR); BG(GAR, S0.BL);
  const TW = N(5.02, 0.02, 0, 3, 'TW', 0.10);
  BG(TW, TPB); BG(TW, S6.BL); BG(TW, S6.BR);
  // snap-blocking near-vertical member (structural rule 10, the drone cure):
  // without it the tailwheel folds UP about TPB and LATCHES (bare post on
  // the terrain) when parked in a tailwind — reset slam + breeze, W13.
  BG(TW, TPT);

  const MW = 8, wf = { L: null, R: null };
  const mkWing = (s) => {
    const B = (a, b) => beams.push({ a, b, k: K_WG, c: C_WG, gear: false });
    const rootF = s > 0 ? F[1].TR : F[1].TL, rootR = s > 0 ? F[2].TR : F[2].TL;
    const strut = s > 0 ? F[1].BR : F[1].BL;
    const zs = [1.9, 3.4, 5.0], DIH = 0.0524;   // 3 deg dihedral (tan)
    const WF = zs.map(z => N(0.62, 1.00 + (z - 0.36) * DIH, s * z, MW, 'WF'));
    const WR = zs.map(z => N(1.40, 1.00 + (z - 0.36) * DIH, s * z, MW, 'WR'));
    B(rootF, WF[0]); B(WF[0], WF[1]); B(WF[1], WF[2]);
    B(rootR, WR[0]); B(WR[0], WR[1]); B(WR[1], WR[2]);
    B(WF[0], WR[0]); B(WF[1], WR[1]); B(WF[2], WR[2]);
    B(rootF, WR[0]); B(WF[0], WR[1]); B(WF[1], WR[2]);
    B(WR[0], WF[1]); B(WR[1], WF[2]);
    B(strut, WF[1]); B(strut, WR[1]); B(strut, WF[0]);
    B(strut, WR[0]); B(strut, WF[2]); B(strut, WR[2]);
    wf[s > 0 ? 'R' : 'L'] = { F: [rootF, ...WF], R: [rootR, ...WR] };
  };
  mkWing(+1); mkWing(-1);

  const [HTL, HTR] = NM(4.92, 0.30, 1.05, 4, 'HT');
  B(HTL, TPB); B(HTL, TPT); B(HTL, S6.BL); B(HTL, S6.TL);
  B(HTR, TPB); B(HTR, TPT); B(HTR, S6.BR); B(HTR, S6.TR);
  // stab<->tailwheel pyramid (rule 10, the chinook cure): the fold that
  // survives the TW->TPT block is LATERAL (dTW body [+0.28 up, 0.25
  // sideways], measured) — wide anchors kill it
  BG(TW, HTL); BG(TW, HTR);
  const FIN = N(5.05, 0.95, 0, 4, 'FIN');
  B(FIN, TPT); B(FIN, S6.TL); B(FIN, S6.TR);

  nodes[F[1].BL].m += 38; nodes[F[1].BR].m += 38;      // pilot, front seat

  // ---------- aero strips ----------
  const strips = [];
  const wingStrip = (fIn, fOut, rIn, rOut, t, area, side, o = {}) => {
    const cf = 0.795, cr = 0.205;   // c/4 sits between the spars at 79.5/20.5
    strips.push({ kind: 'wing', side, t, area, chord: 1.6,
      fIn, fOut, rIn, rOut,
      w: [[fIn, cf * (1 - t)], [fOut, cf * t], [rIn, cr * (1 - t)], [rOut, cr * t]],
      wash: o.wash || 0, ail: o.ail || 0, flap: o.flap || 0 });
  };
  const bays = (fr, side) => {
    const bw = [1.54, 1.5, 1.6];
    // flaps span |z| 0.43..2.06 (model voletG/D) = the inboard bay
    for (let b = 0; b < 3; b++)
      for (const t of [0.28, 0.78])
        wingStrip(fr.F[b], fr.F[b + 1], fr.R[b], fr.R[b + 1], t, bw[b] * 1.6 / 2,
          side, { wash: b === 0 && t < 0.5 ? 0.5 : 0, ail: b === 2 ? 1 : 0,
                  flap: b === 0 ? 1 : 0 });
  };
  bays(wf.R, 1); bays(wf.L, -1);
  wingStrip(F[1].TL, F[1].TR, F[2].TL, F[2].TR, 0.5, 0.72 * 1.6, 1, { wash: 1 });

  for (const [nHT, side] of [[HTL, -1], [HTR, 1]]) {
    strips.push({ kind: 'stab', side, area: 0.65, chord: 0.9, wash: 0.6,
      w: [[nHT, .5], [TPB, .3], [TPT, .2]] });
    strips.push({ kind: 'stab', side, area: 0.50, chord: 0.9, wash: 0.6,
      w: [[nHT, .25], [TPB, .45], [TPT, .3]] });
  }
  strips.push({ kind: 'fin', area: 1.00, chord: 0.9, wash: 1,
    w: [[FIN, .4], [TPT, .35], [TPB, .25]] });

  const refs = {
    noseFrame: [S0.BL, S0.BR, S0.TL, S0.TR], tailMid: [TPB, TPT],
    upLo: [S0.BL, S0.BR], upHi: [S0.TL, S0.TR],
    fusDrag: [F[2].BL, F[2].BR, F[2].TL, F[2].TR],
    fusDragAft: [F[5].BL, F[5].BR, F[5].TL, F[5].TR],
    engine: [EL, ER], mains: [GAL, GAR], tw: TW, fin: FIN,
  };
  const params = {
    name: 'Piper PA-18 Super Cub', viewDist: 14,
    powerplant: 'a65_sensenich74',
    nEngines: 1,                    // one engine, two mount nodes (see cub)
    polarWing: POLARS.usa35b_AR7, polarTail: POLARS.flat_tail_cub,
    elevTau: 0.50, rudTau: 0.55, ailTau: 0.35, downwash: 0.40,
    stabTrim: -0.0983, sparSpacing: 0.78,
    fusCdA: [0.55, 0.8, 0.8], fusCdAAft: [0, 0.5, 0.5],
    twSteer: 0.5,
    // slotted flaps, inboard bay only: tunnel-calibrated to the POH Vs ratio
    // (43/48 mph flaps/clean = 0.90; measured 0.900 at dCl0 1.6).
    // dCm0 ~ -0.25*dCl0 (HANDOVER "watch Cm0")
    flaps: { to: 0, ldg: 1, rate: 0.2, dCl0: 1.6, dCd0: 0.07, dAStall: 0.02, dCm0: -0.40 },
    // vs the J-3: slower flapped approach, power carried through the flare
    // (flap drag is ~2x — throttle-cut flares arrived at sink 2.0), earlier
    // flare, gentler brakes (full flap + hard brakes nosed it over).
    // Measured: td sink 0.78, three-point 15.3 deg, no noseover.
    ap: {
      VRot: 15, VClimbMin: 20, VClimb: 21, VCruise: 26, VAppr: 20.5,
      VApprShort: 18.5,             // fly-in strips < 450 m (1.37*Vs flapped)
      // no VTurn: see the cub fiche — TURNBACK and INBOUND read it with
      // different fallbacks, so stating it changes the turnback speed
      // RE-ANCHORED G4.9 (was 60): the engine-count fix halved this aeroplane's
      // thrust, and the run to 2.5 m agl went 67 m -> 151 m. Re-read off
      // tools/make_perf.js, not adjusted by hand.
      TORun: 151,                   // measured run to 2.5 m agl
      // W16 lateral quiet: the default rollD 2.0 on the RF-lagged rate
      // estimate limit-cycled the aileron 8-12 deg p2p at ~4 Hz (bank
      // barely moved — surface flail + wing rock, user-visible on the
      // skin). 0.8 kills it dead (0.2 deg residual); doctrine says lower
      // D, and measured: a FASTER rate filter makes it worse.
      rollD: 0.8,
      VPinFull: 16,                 // moderate aft above this in rollout (hop guard)
      hCruise: 100, hSafe: 14, xTurn: -2300, xAim: -520, gs: 0.0786,
      rollDe: 0.12, liftoffTh: 0.16, climbThBase: 0.12, climbThGain: 0.030,
      // flareThr 0.12 -> 0.24 (G4.9): `flareThr` is a THROTTLE fraction, and the
      // engine-count fix halved what a fraction buys. The flare keeps the
      // THRUST it was tuned with — 0.12*1800 N == 0.24*900 N — rather than the
      // lever position, which is the only reading of "unchanged" that means
      // anything here. Sink 1.71 (over the 1.5 bound) -> 0.95, against 0.78
      // before the fix.
      thMax: 0.20, flareAgl: 5.5, flareRate: 0.062, flareThr: 0.24, aglGuard: 3,
      VTailUp: 12, VTailDown: 99, VStop: 0.4, slew: 1.5, thrCruise: 0.70, thrAppr: 0.35,
      brakeMax: 0.18, brakeRampRate: 0.12, VBrakeOn: 7, VBrakeRelease: 1.5,
    },
  };
  return { nodes, beams, strips, refs, params };
}



// ============================================================
// WORLD — deterministic procedural terrain + trees, shared by
// physics and renderer. Integer-hash noise: identical across JS engines.
// v1 contract (futureDesigns/WORLD-CONTRACT.md) + v0 shim on one object.
// Seed 0 (or no argument) is the VALIDATED world, bit-identical to the
// pre-contract makeWorld(); nonzero seeds are coherent but unvalidated.
// GATE WORLD freezes seed-0 data with golden hashes — intentional terrain
// changes must re-capture goldens in the same commit.
// ============================================================
function makeWorld(seed) {
  const SEED = seed | 0;                     // undefined -> 0: no-arg callers get the validated world
  const SALT = Math.imul(SEED, 0x9E3779B9);  // 0 for seed 0 — exact identity in hash2/LCG below
  const smf = t => t * t * (3 - 2 * t);
  const sstep = (a, b, t) => smf(Math.min(1, Math.max(0, (t - a) / (b - a))));
  const hash2 = (ix, iz) => {
    let h = (ix * 374761393 + iz * 668265263 + 1013904223 + SALT) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  function vnoise(x, z, cell) {
    const fx = x / cell, fz = z / cell;
    const ix = Math.floor(fx), iz = Math.floor(fz);
    const tx = smf(fx - ix), tz = smf(fz - iz);
    const a = hash2(ix, iz), b = hash2(ix + 1, iz),
          c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }
  // W7: 5th octave (65 m) sharpens detail; the warp channels below are
  // deliberately 2-octave — h0 is the physics hot path (per node per
  // substep), full-fbm warp would double it
  const fbm = (x, z) =>
    vnoise(x, z, 1400) * 0.43 + vnoise(x + 91, z + 37, 650) * 0.29 +
    vnoise(x + 7, z + 211, 300) * 0.16 + vnoise(x + 313, z + 97, 140) * 0.08 +
    vnoise(x + 173, z + 419, 65) * 0.04;
  const ridge = (x, z, cell) => 1 - Math.abs(2 * vnoise(x + 555, z + 777, cell) - 1);
  const wnoise = (x, z) =>
    vnoise(x, z, 1400) * 0.65 + vnoise(x + 47, z + 61, 650) * 0.35;

  function h0(x, z) {
    // IQ-style domain warp (W7): displace the sampling point by two noise
    // channels before the main field — ridges curve, valleys wind, the
    // value-noise blobbiness dies. ⚙ WARP 320 m; the continental masks
    // get their own gentler warp (bays/headlands on the coast, a winding
    // mountain-belt edge) at ⚙ 700 m.
    const wq1 = wnoise(x + 1309, z + 3557), wq2 = wnoise(x - 911, z + 2129);
    const wx = x + 320 * (wq1 - 0.5), wz = z + 320 * (wq2 - 0.5);
    const n = fbm(wx, wz);
    // 24 km domain (W6): the mountain belt FALLS OFF beyond z~-6500 into
    // northern highlands/plains instead of extending as an endless plateau
    const mzw = z + 700 * (wq2 - 0.5);
    const mount = sstep(700, 3200, -mzw) * (1 - sstep(6500, 10500, -mzw));
    const sea = sstep(500, 2400, z + 700 * (wq1 - 0.5));
    const rid = ridge(wx, wz, 1100) * 0.6 + ridge(wx, wz, 520) * 0.4;
    let hm = (0.55 * (n - 0.3) + 0.65 * (rid - 0.35)) * 620 * mount;
    // W12 stage-5 cliffs: terrace the mountain component into strata
    // where it is high — flat treads + smoothstepped risers (C1 both
    // ends), band planes tilted by a coarse noise so strata dip like
    // real beds. Cheap amplitude gate instead of a slope probe: slope
    // cannot be computed inside the physics hot path. Risers steepen
    // locally and classify ROCK/SCREE through the existing slope rules.
    if (hm > 120) {
      const ST = 22, RW = 0.34;
      const t = (hm + (vnoise(wx + 888, wz + 1444, 700) - 0.5) * 16) / ST;
      const f = Math.floor(t), r = t - f;
      const terr = (f + smf(Math.min(1, Math.max(0, (r - (1 - RW) * 0.5) / RW)))) * ST;
      hm += (terr - hm) * 0.55 * sstep(120, 220, hm);
    }
    let h = (n - 0.35) * 45 + hm - 95 * sea;
    // far-field additions, EXACTLY zero inside the home box + 1.5 km
    // (box covers every validated circuit incl. the DC-3 turnback at
    // x=-5800 and its clearance mountains): long-wave continental relief
    // on land + an archipelago in the far sea. Validated trajectories fly
    // bit-identical base terrain.
    const bdx = Math.max(0, Math.max(-6300 - x, x - 600));
    const bdz = Math.max(0, Math.max(-3300 - z, z - 2600));
    const far = sstep(1500, 4000, Math.hypot(bdx, bdz));
    if (far > 0) {
      const big = vnoise(x + 4013, z + 1717, 5200);
      h += far * (big - 0.5) * 130 * (1 - sea);
      const isl = ridge(wx + 2222, wz + 4444, 2600);
      const islMask = sstep(3800, 5200, z);
      h += far * islMask * Math.max(0, isl - 0.62) * 520;
    }
    const dxC = Math.max(0, Math.max(-3400 - x, x - 400));
    const dzC = Math.max(0, Math.abs(z) - 750);
    h *= 0.06 + 0.94 * sstep(0, 700, Math.hypot(dxC, dzC));
    const dxR = Math.max(0, Math.max(-1180 - x, x - 130));
    const dzR = Math.max(0, Math.abs(z) - 90);
    h *= sstep(0, 260, Math.hypot(dxR, dzR));
    return h;
  }

  // surface enum — reserved classes included (PAVED/GRAVEL/... arrive with
  // WORLD-GEN-PROC stages); the classifier below is the honest v1 minimum.
  const SURFACE = { GRASS: 0, ROCK: 1, SCREE: 2, FOREST_FLOOR: 3, WATER: 4, PAVED: 5, GRAVEL: 6, SAND: 7 };

  // aerodrome registry — DESCRIPTIVE for now: the AP still flies the
  // def.params.ap constants (contract rule 6 deferred), and the h0 runway
  // carve box / renderer decals are not yet driven from these records.
  // hdg in radians from +x toward +z; the main strip's takeoff run is
  // along -x (hdg PI). tdz = touchdown-zone target point. elev for
  // meadows is filled from h0 below.
  const aerodromes = [
    { id: 'HOME', name: 'Home Strip', kind: 'main', x: -520, z: 0, hdg: Math.PI,
      len: 1100, wid: 30, surface: SURFACE.GRASS, elev: 0, tdz: [-450, 0],
      spawn: [0, 0] },   // the def-geometry rest position — W10 spawn identity
    { id: 'M1', name: 'Meadow 1', kind: 'meadow', x: -2200, z: -1500, r: 230,
      hdg: 0, len: 460, wid: 460, surface: SURFACE.GRASS, elev: 0, tdz: [-2200, -1500] },
    { id: 'M2', name: 'Meadow 2', kind: 'meadow', x: 1800, z: 1500, r: 260,
      hdg: 0, len: 520, wid: 520, surface: SURFACE.GRASS, elev: 0, tdz: [1800, 1500] },
    { id: 'M3', name: 'Meadow 3', kind: 'meadow', x: -3400, z: 650, r: 240,
      hdg: 0, len: 480, wid: 480, surface: SURFACE.GRASS, elev: 0, tdz: [-3400, 650] },
  ];
  // landing meadows: blend terrain toward the height at each meadow centre.
  // v0 shim member, derived from the registry — same literals, same order,
  // same {x,z,r,h} shape as the pre-contract array.
  const meadows = aerodromes.filter(a => a.kind === 'meadow').map(a => ({ x: a.x, z: a.z, r: a.r }));
  for (const m of meadows) m.h = h0(m.x, m.z);
  aerodromes.filter(a => a.kind === 'meadow').forEach((a, i) => { a.elev = meadows[i].h; });
  // meadow blend, factored: used by the pre-hydro base and final terrainH.
  // Applied AFTER the river carve so meadow interiors stay exactly flat.
  function blendM(x, z, h) {
    for (const m of meadows) {
      const d = Math.hypot(x - m.x, z - m.z);
      if (d < m.r) { const w = sstep(m.r * 0.45, m.r, d); h = m.h * (1 - w) + h * w; }
    }
    return h;
  }
  // runway-pad ramp: 0 inside the pad box, 1 past 260 m out — the same box
  // the h0 flatten uses; masks the river carve so the pad stays exactly 0.
  function padRamp(x, z) {
    const dxR = Math.max(0, Math.max(-1180 - x, x - 130));
    const dzR = Math.max(0, Math.abs(z) - 90);
    return sstep(0, 260, Math.hypot(dxR, dzR));
  }
  // ---- stage 1 hydrology (WORLD-GEN-PROC): baked on the pre-hydro base
  // plus bake-only "drainage domes" over the runway pad and meadows so
  // rivers route AROUND aerodromes (stage 4 grades them properly later).
  // Domes never touch the real terrain; river water surfaces are
  // dome-corrected back via wsAdjust.
  const DOME = 3;
  function domes(x, z) {
    let s = DOME * (1 - padRamp(x, z));
    for (const m of meadows) {
      const d = Math.hypot(x - m.x, z - m.z);
      if (d < m.r * 1.6) s += DOME * (1 - sstep(0, m.r * 1.6, d));
    }
    return s;
  }
  const HYD = bakeHydrology(
    (x, z) => blendM(x, z, h0(x, z)) + domes(x, z),
    // 24 km domain at 46.9 m cells; A0m2 = physical drainage threshold
    // (river widths/depths are normalized to drainage AREA inside the
    // bake, so the same physical rivers emerge at any grid resolution)
    { x0: -12000, z0: -12000, x1: 12000, z1: 12000, N: 512,
      lakeMin: 1.5, A0m2: 274650, kW: 0.35, kD: 0.4, maxW: 45, dLake: 2,
      dpEps: 25, bankFrac: 1.4, qCell: 96, wsAdjust: domes });
  // stage 0+1 terrain: carved + meadow-blended, PRE-road (the settle bake
  // scores sites and derives grading targets on this)
  function tV1(x, z) {
    let h = h0(x, z);
    const r = padRamp(x, z);
    if (r > 0) h += (HYD.carve(x, z, h) - h) * r;
    return blendM(x, z, h);
  }

  // ---- stage 3 settlements & roads (WORLD-GEN-PROC): sites scored on
  // the stage-1 grids, organic road network grown from the home airfield,
  // bridges across water runs, building footprints. Roads add a shallow
  // grading term to terrainH below.
  const SET = bakeSettlements({ grids: HYD.grids, terrain: tV1, water: HYD.water, distW: HYD.distW, meadows, salt: SALT });

  // stage 0-3 terrain: tV1 + road grading, masked off the runway pad
  // (padRamp) and faded inside meadows (same blend weight — meadow
  // centres stay EXACTLY at m.h, the WORLD gate pins that). Stage-4
  // aerodrome grading composes on top in terrainH below.
  let _cd = 0;   // carve depth at the last tV2 call — read by terrainH below
  function tV2(x, z) {
    let h = h0(x, z);
    const r = padRamp(x, z);
    _cd = 0;
    if (r > 0) {
      const hRaw = h;
      h += (HYD.carve(x, z, h) - h) * r;
      const carveDepth = hRaw - h;             // >0 inside river beds / lakes
      _cd = carveDepth;
      h = blendM(x, z, h);
      const g = SET.roadDelta(x, z, h) - h;
      if (g !== 0) {
        let mw = 1;
        for (const m of meadows) {
          const dd = Math.hypot(x - m.x, z - m.z);
          if (dd < m.r) { mw = sstep(m.r * 0.45, m.r, dd); break; }
        }
        // roads must never grade a carved bed back up — beds stay wet,
        // crossings are bridges (the deck spans, terrain keeps the carve)
        h += g * r * mw * (1 - Math.min(1, carveDepth / 1.5));
      }
      return h;
    }
    return blendM(x, z, h);
  }

  // ---- stage 4 aerodromes (WORLD-GEN-PROC): a main field per sizeable
  // town + fly-in backcountry strips, sited on the stage 0-3 terrain;
  // their grading composes into the final terrainH, records join the
  // W.aerodromes registry (still DESCRIPTIVE — AP integration pending).
  const AERO = bakeAerodromes({
    terrain: tV2, water: HYD.water, settlements: SET.settlements,
    meadows, roadNear: SET.roadNear, SURFACE, salt: SALT });
  for (const st of AERO.strips) aerodromes.push(st);

  function terrainH(x, z) {
    // strip grading must never fill a carved river bed (same rule as
    // roads) — fade it out by carve depth, sampled in the tV2 call
    const h = tV2(x, z);
    const g = AERO.grade(x, z, h) - h;
    return g !== 0 ? h + g * (1 - Math.min(1, _cd / 1.5)) : h;
  }

  // ---- stage 2 biomes: analytic classifier + tree placement plan ----
  // (waterAt/terrainH are function declarations — hoisted, safe to bind)
  //
  // THE REGISTRY'S DECLARED SURFACE IS READ HERE (G130). Every hand-written
  // aerodrome record carries `surface:` — and until now nothing consumed it:
  // only stage-4 generated strips answered through AERO.surfaceAt, so the
  // forestness field was free to claim the first 158 m of HOME's own takeoff
  // run as FOREST_FLOOR. The moment G121.3 priced that class (CRR 0.10 vs
  // the grass datum's 0.05), every roll off HOME paid double rolling
  // resistance over most of its length — the +4 s unstick the user felt as
  // "struggles to climb inside 90 s". The declaration wins inside the
  // strip's own footprint (strips: the hdg-rotated box with the same kind of
  // margin the pad carve uses; meadows: their radius), and everything
  // outside it still belongs to the classifier.
  const regSurf = (x, z) => {
    for (const a of aerodromes) {
      if (a.surface == null) continue;
      if (a.kind === 'meadow') {
        const dx = x - a.x, dz = z - a.z;
        if (dx * dx + dz * dz <= a.r * a.r) return a.surface;
      } else {
        const c = Math.cos(a.hdg), s = Math.sin(a.hdg);
        const u = (x - a.x) * c + (z - a.z) * s,
              v = -(x - a.x) * s + (z - a.z) * c;
        if (Math.abs(u) <= a.len / 2 + 20 && Math.abs(v) <= a.wid / 2 + 6)
          return a.surface;
      }
    }
    return -1;
  };
  const aeroSurfAll = (x, z) => {
    const r = regSurf(x, z);
    return r >= 0 ? r : AERO.surfaceAt(x, z);
  };
  const B = makeBiomes({ terrainH, waterOf: waterAt, distW: HYD.distW, SURFACE, salt: SALT, roadNear: SET.roadNear, aeroSurf: aeroSurfAll });

  // trees: stage-2 biome placement — deterministic jittered 64 m grid,
  // order-independent per point (replaces the v0 sequential LCG loop);
  // density + species from the biome module, clustered by stand noise.
  // v0 exclusions kept verbatim (battery safety): corridor box, meadows
  // 0.8r; the runway pad self-rejects via h<2 (carve-masked flat at 0).
  // Records {x,z,h,s,sp}: h = GROUND height at base, s scale in the v0
  // envelope (solver radius/canopy formulas unchanged), sp = species.
  const trees = [], CELL = 64, grid = new Map();
  {
    const G0 = -12000, GN = 375, GS = 64;  // ±12000 m (24 km domain, W6)
    for (let gz = 0; gz < GN; gz++) for (let gx = 0; gx < GN; gx++) {
      const j1 = hash2(gx + 9173, gz - 2417), j2 = hash2(gx - 5807, gz + 7919),
            j3 = hash2(gx + 1229, gz + 4051);
      const x = G0 + (gx + 0.15 + 0.70 * j1) * GS;
      const z = G0 + (gz + 0.15 + 0.70 * j2) * GS;
      const h = terrainH(x, z);
      if (h < 2 || h > B.TREELINE) continue;
      if (Math.abs(z) < 60 && x < 150 && x > -3300) continue;
      let nearMeadow = false;
      for (const m of meadows)
        if (Math.hypot(x - m.x, z - m.z) < m.r * 0.8) { nearMeadow = true; break; }
      if (nearMeadow) continue;
      if (HYD.water(x, z) > h) continue;
      if (SET.roadNear(x, z) < 12) continue;   // clear of roads
      if (SET.inCore(x, z)) continue;          // clear of settlement cores
      if (AERO.inBox(x, z, 30)) continue;      // clear of strips + margin
      const tp = B.treeAt(x, z, h);
      if (!tp || j3 > tp.p) continue;
      const idx = trees.length;
      trees.push({ x, z, h, s: tp.s, sp: tp.sp });
      const key = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(idx);
    }
  }
  function treesNear(x, z, out) {
    out.length = 0;
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const cell = grid.get(`${cx + a},${cz + b}`);
      if (cell) for (const i of cell) out.push(i);
    }
    return out;
  }

  // ---- v1 continuous fields. waterH: stage-1 rivers at their monotone
  // reach surfaces + lakes at spill height + sea (level 0) where the
  // PRE-CARVE base is below 0 — a riverbed carved under sea level inland
  // is a dry trench, not sea. surface is still the pre-biome minimum
  // (stages 2/5 refine ROCK/SCREE/etc.).
  function waterAt(t, x, z) {
    const ws = HYD.water(x, z);
    if (ws > t) return ws;
    if (t < 0 && blendM(x, z, h0(x, z)) < 0) return 0;
    return -Infinity;
  }
  function waterH(x, z) { return waterAt(terrainH(x, z), x, z); }
  // surface: stage-2 biome classifier (WATER/SAND/ROCK/SCREE/FOREST_FLOOR/
  // GRASS from altitude+slope+moisture+distance-to-water; PAVED/GRAVEL
  // still reserved for stage 4)
  const surface = B.surface;

  // ---- v1 tiled features: lazy bucketing of the eager tree array plus
  // stage-1 river reaches (a reach spanning several tiles appears in each
  // of them — reach records {pts, ws, w, d, acc, term} are shared refs).
  // trees stays ONE flat index-stable array — treesNear returns indices
  // into it and the solver depends on that; tiles hold the same objects.
  // roads/buildings are empty until WORLD-GEN-PROC stage 3.
  // tile() is never called during makeWorld: zero load-time cost.
  const TILE = 512;
  let tileIndex = null;
  function tile(ix, iz) {
    if (!tileIndex) {
      tileIndex = new Map();
      const rec0 = key => {
        let rec = tileIndex.get(key);
        if (!rec) tileIndex.set(key, rec = { trees: [], rivers: [], roads: [], buildings: [] });
        return rec;
      };
      for (const t of trees) rec0(Math.floor(t.x / TILE) + ',' + Math.floor(t.z / TILE)).trees.push(t);
      const bucketPoly = (obj, list) => {
        const keys = new Set();
        for (let i = 0; i + 1 < obj.pts.length; i++) {
          const tx0 = Math.floor(Math.min(obj.pts[i][0], obj.pts[i + 1][0]) / TILE);
          const tx1 = Math.floor(Math.max(obj.pts[i][0], obj.pts[i + 1][0]) / TILE);
          const tz0 = Math.floor(Math.min(obj.pts[i][1], obj.pts[i + 1][1]) / TILE);
          const tz1 = Math.floor(Math.max(obj.pts[i][1], obj.pts[i + 1][1]) / TILE);
          for (let a = tx0; a <= tx1; a++) for (let b = tz0; b <= tz1; b++) keys.add(a + ',' + b);
        }
        for (const key of keys) rec0(key)[list].push(obj);
      };
      for (const r of HYD.rivers) bucketPoly(r, 'rivers');
      for (const r of SET.roads) bucketPoly(r, 'roads');
      for (const b of SET.buildings) rec0(Math.floor(b.x / TILE) + ',' + Math.floor(b.z / TILE)).buildings.push(b);
    }
    const key = ix + ',' + iz;
    let rec = tileIndex.get(key);
    if (!rec) tileIndex.set(key, rec = { trees: [], rivers: [], roads: [], buildings: [] });
    return rec;
  }

  // ---- wind field: steady vector + deterministic Dryden-ish gusts ----
  // setWind({ base:[wx,wy,wz], gust:g }) — gusts are sums of incommensurate
  // sines with spatial phase (advecting waves), amplitude g horizontal and
  // 0.6*g vertical. Deterministic by construction: gates can rely on it.
  // Default null: wind() returns the shared zero vector (fast path).
  let windSpec = null;
  const W0 = [0, 0, 0], WV = [0, 0, 0];
  const GC = [ // [freq rad/s, kx, kz, phase, axis weight x,y,z]
    [0.63, 0.011, 0.005, 0.7, 1.0, 0.35, 0.55],
    [1.37, 0.004, 0.013, 2.9, 0.55, 0.6, 1.0],
    [2.71, 0.009, 0.008, 5.1, 0.7, 1.0, 0.6],
    [0.29, 0.002, 0.003, 1.9, 1.0, 0.25, 0.8],
  ];
  // ---- THE SURFACE LAYER (G72) -------------------------------------------
  // `y` has been an argument of wind() since the field was written and has
  // never been read. It is read now: the ground drags on the air, so the wind
  // near it is slower than the wind above it, and an aeroplane on final is in
  // measurably different air from the one at circuit height.
  //
  // WHERE THE REPORTED WIND IS. A wind speed is meaningless without a height,
  // and the height every anemometer, every windsock and every METAR means is
  // 10 m. So `refH` says which height `base` was measured at, and the profile
  // is the engineering power law u/uref = (z/zref)^alpha — the same one every
  // wind-resource and building-code calculation uses, with alpha set by how
  // rough the ground is (0.10 open water, 0.14 open grass, 0.20 scrub and
  // trees). It is a fit, not a derivation, and it is a good one to about 200 m.
  //
  // A SPEC WITH NO refH IS A UNIFORM COLUMN, which is exactly the pre-G72 model
  // and is what the fleet's whole wind calibration was measured in. That is a
  // deliberate, declared boundary rather than a compatibility fudge: "no
  // reference height" honestly means "we are not claiming to know where this
  // wind was measured", and the only answer that does not invent information is
  // to blow it everywhere equally. GATE WIND and the XCTY gates anchor to that
  // column; the CONDITIONS presets and GATE HOTHIGH declare a refH and fly the
  // profile. Re-anchoring the fleet battery onto sheared wind is named work,
  // not a side effect of this one.
  const WIND_TOP_H = 300;              // m agl: above this the profile has run out
  const WIND_ALPHA = 0.14;             // open grassland, the default surface here
  function shearK(x, y, z, refH, alpha) {
    const agl = y - terrainH(x, z);
    // a power law has no zero: floor the height rather than pretend it does.
    const h = Math.min(WIND_TOP_H, Math.max(0.2, agl));
    return Math.pow(h / refH, alpha);
  }
  function wind(x, y, z, t) {
    if (!windSpec) return W0;
    const b = windSpec.base, g = windSpec.gust || 0;
    const k = windSpec.refH ? shearK(x, y, z, windSpec.refH, windSpec.alpha) : 1;
    WV[0] = b[0] * k; WV[1] = b[1] * k; WV[2] = b[2] * k;
    // the gusts ride the local wind, so they die out in the surface layer and
    // grow in the shear instead of being the same everywhere from grass to
    // circuit height
    const gk = g * k;
    if (gk > 0) for (const [om, kx, kz, ph, ax, ay, az] of GC) {
      const s = Math.sin(om * t + kx * x + kz * z + ph);
      WV[0] += gk * 0.30 * ax * s;
      WV[1] += gk * 0.18 * ay * s;
      WV[2] += gk * 0.30 * az * s;
    }
    return WV;
  }
  function setWind(spec) {
    windSpec = spec ? { base: spec.base || [0, 0, 0], gust: spec.gust || 0,
                        refH: spec.refH || 0,
                        alpha: spec.alpha != null ? spec.alpha : WIND_ALPHA } : null;
  }

  // ---- the day: ONE weather state, air and wind together (G72) ------------
  // setWeather({ oatC, qnhPa, wind: { base, gust } }) — everything a day is.
  // They are one object rather than two setters because a hot gusty afternoon
  // is ONE thing a player picks, and because the solver has to be able to ask
  // "what is the air here" without knowing which preset put it there.
  //
  // `atmos` is read through a GETTER on the returned world so the sim sees a
  // change live, exactly as it already does for wind — no reset, mid-flight.
  // Absent weather is the standard day and the zero wind vector, so every
  // existing gate is untouched by the mere existence of this.
  let weather = null;
  let atmos = ATMOS_ISA;
  function setWeather(spec) {
    weather = spec || null;
    const hasAir = spec && (spec.oatC != null || spec.qnhPa != null || spec.dISA != null);
    atmos = hasAir ? makeAtmos(spec) : ATMOS_ISA;
    setWind(spec ? (spec.wind || null) : null);
  }

  return {
    // ---- v1 contract (futureDesigns/WORLD-CONTRACT.md) ----
    v: 1, seed: SEED,
    bounds: { x0: -12000, z0: -12000, x1: 12000, z1: 12000 },
    terrainH, waterH, surface, SURFACE,
    TILE, tile, aerodromes, settlements: SET.settlements,
    treesNear,
    // informative stage-3 block (not contract surface): road/building
    // records and queries for gates, renderer and debug.
    roadNet: { roads: SET.roads, buildings: SET.buildings, roadNear: SET.roadNear, bakeMs: SET.stats.bakeMs },
    // informative stage-1 block (not contract surface): gates/debug read
    // reach records and bake stats here without walking every tile.
    hydro: { rivers: HYD.rivers, lakeCount: HYD.lakeCount, lakeCells: HYD.lakeCells, bakeMs: HYD.stats.bakeMs, water: HYD.water, lakeSurf: HYD.lakeSurf, cellW: HYD.stats.cellW, distW: HYD.distW },
    // ---- the day (G72): the air is a getter so it is read LIVE ----
    get atmos() { return atmos; },
    get weather() { return weather; },
    setWeather,
    // ---- v0 shim: same live objects, byte-identical values ----
    trees, meadows, CELL, wind, setWind,
  };
}
// ============================================================
// WORLD HYDROLOGY — WORLD-GEN-PROC stage 1: priority-flood depression
// filling (Barnes 2014), D8 flow routing with deterministic tie-breaks,
// accumulation, river extraction to polylines, lakes at spill height,
// and O(1) carve/water queries for terrainH/waterH composition.
// Pure function of (sample, cfg): no globals, deterministic by
// construction — same inputs give identical output on any JS engine
// (integer hashes, fixed iteration orders, total-order sorts).
// ============================================================
function bakeHydrology(sample, cfg) {
  const t0 = Date.now();
  const N = cfg.N, x0 = cfg.x0, z0 = cfg.z0;
  const dx = (cfg.x1 - x0) / N, dz = (cfg.z1 - z0) / N;
  const M = N * N;
  // physical normalization: thresholds and width/depth laws are stated in
  // drainage AREA (m²), converted to cells of THIS grid — the same rivers
  // emerge at any resolution. cfg.A0m2 preferred; legacy cfg.A0 = cells.
  const cellA = dx * dz;
  const A0 = cfg.A0m2 ? cfg.A0m2 / cellA : cfg.A0;
  const EQ = cellA / 549.3164;                // legacy 23.4 m cell equivalents
  const smf01 = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
  const px = ix => x0 + (ix + 0.5) * dx, pz = iz => z0 + (iz + 0.5) * dz;

  // ---- heights + sea mask (sea level = 0) ----
  const H = new Float64Array(M);
  for (let iz = 0, k = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++, k++) H[k] = sample(px(ix), pz(iz));
  const sea = new Uint8Array(M);
  for (let k = 0; k < M; k++) if (H[k] < 0) sea[k] = 1;

  const NBX = [1, -1, 0, 0, 1, 1, -1, -1];
  const NBZ = [0, 0, 1, -1, 1, -1, 1, -1];
  const DIST = NBX.map((v, i) => Math.hypot(v * dx, NBZ[i] * dz));

  // ---- priority flood: fill depressions to spill from the boundary ----
  // binary min-heap on (key, cell index) — index tie-break keeps pop order
  // deterministic when filled levels are equal (flat regions).
  const filled = new Float64Array(M);
  const queued = new Uint8Array(M);
  const popOrder = new Int32Array(M);
  const hKey = new Float64Array(M), hIdx = new Int32Array(M);
  let hn = 0;
  const hLess = (a, b) => hKey[a] < hKey[b] || (hKey[a] === hKey[b] && hIdx[a] < hIdx[b]);
  function hSwap(a, b) {
    const k = hKey[a], i = hIdx[a];
    hKey[a] = hKey[b]; hIdx[a] = hIdx[b]; hKey[b] = k; hIdx[b] = i;
  }
  function hPush(key, idx) {
    let i = hn++; hKey[i] = key; hIdx[i] = idx;
    while (i > 0) { const p = (i - 1) >> 1; if (hLess(p, i)) break; hSwap(i, p); i = p; }
  }
  function hPop() {
    const top = hIdx[0];
    hn--; hKey[0] = hKey[hn]; hIdx[0] = hIdx[hn];
    let i = 0;
    for (;;) {
      const l = 2 * i + 1, r = l + 1;
      let s = i;
      if (l < hn && hLess(l, s)) s = l;
      if (r < hn && hLess(r, s)) s = r;
      if (s === i) break;
      hSwap(i, s); i = s;
    }
    return top;
  }
  for (let k = 0; k < M; k++) {
    const ix = k % N, iz = (k / N) | 0;
    if (ix === 0 || iz === 0 || ix === N - 1 || iz === N - 1) { filled[k] = H[k]; queued[k] = 1; hPush(H[k], k); }
  }
  let order = 0;
  while (hn > 0) {
    const c = hPop(); popOrder[c] = order++;
    const cix = c % N, ciz = (c / N) | 0;
    for (let d = 0; d < 8; d++) {
      const nix = cix + NBX[d], niz = ciz + NBZ[d];
      if (nix < 0 || niz < 0 || nix >= N || niz >= N) continue;
      const n = niz * N + nix;
      if (queued[n]) continue;
      queued[n] = 1;
      filled[n] = Math.max(H[n], filled[c]);
      hPush(filled[n], n);
    }
  }

  // ---- D8 flow on the filled surface; steepest descent, hash-rotated
  // neighbour scan (kills axis bias without nondeterminism); flats drain
  // toward the earliest-flooded equal neighbour (guaranteed outlet path).
  const h32 = k => { let h = (Math.imul(k, 2654435761)) | 0; h = Math.imul(h ^ (h >>> 13), 0x5bd1e995); return (h ^ (h >>> 15)) >>> 0; };
  const flow = new Int32Array(M).fill(-1); // -1 = domain outlet
  for (let k = 0; k < M; k++) {
    const cix = k % N, ciz = (k / N) | 0;
    if (cix === 0 || ciz === 0 || cix === N - 1 || ciz === N - 1) continue;
    let best = -1, bestSlope = 0;
    const start = h32(k) & 7;
    for (let s = 0; s < 8; s++) {
      const d = (start + s) & 7;
      const n = (ciz + NBZ[d]) * N + cix + NBX[d];
      const drop = filled[k] - filled[n];
      if (drop > 0) { const sl = drop / DIST[d]; if (sl > bestSlope) { bestSlope = sl; best = n; } }
    }
    if (best < 0) {
      let bo = popOrder[k];
      for (let d = 0; d < 8; d++) {
        const n = (ciz + NBZ[d]) * N + cix + NBX[d];
        if (filled[n] === filled[k] && popOrder[n] < bo) { bo = popOrder[n]; best = n; }
      }
    }
    flow[k] = best;
  }

  // ---- accumulation: upstream-first order = (filled desc, popOrder desc)
  // (in flats downstream cells were flooded earlier, so later pop = upstream)
  const idxs = new Int32Array(M);
  for (let k = 0; k < M; k++) idxs[k] = k;
  idxs.sort((a, b) => (filled[b] - filled[a]) || (popOrder[b] - popOrder[a]));
  const acc = new Float64Array(M).fill(1);
  let maxAcc = 0;
  for (let i = 0; i < M; i++) {
    const k = idxs[i], f = flow[k];
    if (f >= 0 && !sea[k]) acc[f] += acc[k];
    if (!sea[k] && acc[k] > maxAcc) maxAcc = acc[k];
  }

  // ---- lakes: fill difference above threshold; per-cell water = filled ----
  const lake = new Uint8Array(M);
  let lakeCells = 0;
  for (let k = 0; k < M; k++) if (!sea[k] && filled[k] - H[k] > cfg.lakeMin) { lake[k] = 1; lakeCells++; }
  // renderer lake surface: the data lakes (depth > lakeMin) PLUS their
  // shallow connected rim (depth > 0.25 at approximately the same level) —
  // in flat terrain the rim is wide and without it the rendered water
  // edge floats 1.5 m above ground as a visible cell-stepped outline.
  // Render-only: the lake mask, clamp carve and gates are untouched.
  const wet = new Uint8Array(M);
  {
    const stack = [];
    for (let k = 0; k < M; k++) if (lake[k]) { wet[k] = 1; stack.push(k); }
    while (stack.length) {
      const c = stack.pop();
      const cix = c % N, ciz = (c / N) | 0;
      for (let d = 0; d < 8; d++) {
        const nix = cix + NBX[d], niz = ciz + NBZ[d];
        if (nix < 0 || niz < 0 || nix >= N || niz >= N) continue;
        const n = niz * N + nix;
        if (wet[n] || sea[n]) continue;
        if (filled[n] - H[n] > 0.25 && Math.abs(filled[n] - filled[c]) < 0.3) { wet[n] = 1; stack.push(n); }
      }
    }
  }
  // per-cell entries for the renderer: [x, z, waterLevel, edgeMask]
  // edgeMask bits: 1 = +x neighbour is wet, 2 = -x, 4 = +z, 8 = -z
  const lakeSurf = [];
  for (let k = 0; k < M; k++) {
    if (!wet[k]) continue;
    const ix = k % N, iz = (k / N) | 0;
    let mask = 0;
    if (ix + 1 < N && wet[k + 1]) mask |= 1;
    if (ix > 0 && wet[k - 1]) mask |= 2;
    if (iz + 1 < N && wet[k + N]) mask |= 4;
    if (iz > 0 && wet[k - N]) mask |= 8;
    lakeSurf.push([px(ix), pz(iz), filled[k], mask]);
  }
  const lakeId = new Int32Array(M).fill(-1);
  let lakeCount = 0;
  {
    const stack = [];
    for (let k = 0; k < M; k++) {
      if (!lake[k] || lakeId[k] >= 0) continue;
      stack.length = 0; stack.push(k); lakeId[k] = lakeCount;
      while (stack.length) {
        const c = stack.pop();
        const cix = c % N, ciz = (c / N) | 0;
        for (let d = 0; d < 8; d++) {
          const nix = cix + NBX[d], niz = ciz + NBZ[d];
          if (nix < 0 || niz < 0 || nix >= N || niz >= N) continue;
          const n = niz * N + nix;
          if (lake[n] && lakeId[n] < 0) { lakeId[n] = lakeCount; stack.push(n); }
        }
      }
      lakeCount++;
    }
  }

  // ---- river extraction: trace acc > A0 downstream from heads; reaches
  // split at lake entry/exit; Douglas-Peucker simplify; per-vertex water
  // surface from filled (optionally cfg.wsAdjust-corrected), monotone.
  const wsAdj = cfg.wsAdjust || null;
  function mkReach(rp, rw, accEnd, term) {
    // Douglas-Peucker on indices
    const keep = new Uint8Array(rp.length);
    keep[0] = keep[rp.length - 1] = 1;
    const st = [[0, rp.length - 1]];
    while (st.length) {
      const [a, b] = st.pop();
      if (b - a < 2) continue;
      const ax = rp[a][0], az = rp[a][1], bx = rp[b][0], bz = rp[b][1];
      const vx = bx - ax, vz = bz - az, L = Math.hypot(vx, vz) || 1;
      let mi = -1, md = 0;
      for (let i = a + 1; i < b; i++) {
        const dd = Math.abs((rp[i][0] - ax) * vz - (rp[i][1] - az) * vx) / L;
        if (dd > md) { md = dd; mi = i; }
      }
      if (md > cfg.dpEps && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
    }
    const pts = [], ws = [];
    for (let i = 0; i < rp.length; i++) if (keep[i]) {
      pts.push(rp[i]);
      let v = rw[i];
      if (wsAdj) v -= wsAdj(rp[i][0], rp[i][1]);
      ws.push(v);
    }
    for (let i = 1; i < ws.length; i++) if (ws[i] > ws[i - 1]) ws[i] = ws[i - 1];
    const accEq = accEnd * EQ;                // resolution-invariant drainage
    const w = Math.min(cfg.maxW, cfg.kW * Math.sqrt(accEq));
    const d = cfg.kD * Math.log(1 + accEq);
    return { pts, ws, w, d, acc: accEq, term };
  }
  const rivers = [];
  const claimed = new Uint8Array(M);
  let riverCells = 0;
  for (let k = 0; k < M; k++) if (acc[k] > A0 && !sea[k]) riverCells++;
  for (let k = 0; k < M; k++) {
    if (!(acc[k] > A0) || sea[k] || lake[k] || claimed[k]) continue;
    let head = true;
    const cix = k % N, ciz = (k / N) | 0;
    for (let d = 0; d < 8; d++) {
      const nix = cix + NBX[d], niz = ciz + NBZ[d];
      if (nix < 0 || niz < 0 || nix >= N || niz >= N) continue;
      const n = niz * N + nix;
      if (flow[n] === k && acc[n] > A0 && !sea[n]) { head = false; break; }
    }
    if (!head) continue;
    let cur = k, rp = [], rw = [], accEnd = acc[k];
    const flush = term => { if (rp.length >= 2) rivers.push(mkReach(rp, rw, accEnd, term)); rp = []; rw = []; };
    while (cur >= 0) {
      const pt = [px(cur % N), pz((cur / N) | 0)];
      if (sea[cur]) { rp.push(pt); rw.push(Math.max(0, filled[cur])); flush('sea'); break; }
      if (claimed[cur]) { rp.push(pt); rw.push(filled[cur]); flush('junction'); break; }
      if (lake[cur]) {
        rp.push(pt); rw.push(filled[cur]); flush('lake');
        while (cur >= 0 && lake[cur]) { claimed[cur] = 1; cur = flow[cur]; }
        continue;
      }
      claimed[cur] = 1;
      rp.push(pt); rw.push(filled[cur]); accEnd = acc[cur];
      cur = flow[cur];
      if (cur < 0) { flush('boundary'); break; }
    }
  }

  // ---- distance-to-water: 3-4 chamfer transform over sea + lake/rim +
  // traced river cells, queried bilinearly in metres (stage-2 biome input)
  const dGrid = new Float64Array(M).fill(1e9);
  for (let k = 0; k < M; k++) if (sea[k] || wet[k] || claimed[k]) dGrid[k] = 0;
  for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
    const k = iz * N + ix; let d = dGrid[k];
    if (ix > 0 && dGrid[k - 1] + 3 < d) d = dGrid[k - 1] + 3;
    if (iz > 0) {
      if (dGrid[k - N] + 3 < d) d = dGrid[k - N] + 3;
      if (ix > 0 && dGrid[k - N - 1] + 4 < d) d = dGrid[k - N - 1] + 4;
      if (ix + 1 < N && dGrid[k - N + 1] + 4 < d) d = dGrid[k - N + 1] + 4;
    }
    dGrid[k] = d;
  }
  for (let iz = N - 1; iz >= 0; iz--) for (let ix = N - 1; ix >= 0; ix--) {
    const k = iz * N + ix; let d = dGrid[k];
    if (ix + 1 < N && dGrid[k + 1] + 3 < d) d = dGrid[k + 1] + 3;
    if (iz + 1 < N) {
      if (dGrid[k + N] + 3 < d) d = dGrid[k + N] + 3;
      if (ix + 1 < N && dGrid[k + N + 1] + 4 < d) d = dGrid[k + N + 1] + 4;
      if (ix > 0 && dGrid[k + N - 1] + 4 < d) d = dGrid[k + N - 1] + 4;
    }
    dGrid[k] = d;
  }
  const DSCALE = dx / 3;
  function distW(x, z) {
    let gx = (x - x0) / dx - 0.5, gz = (z - z0) / dz - 0.5;
    gx = Math.min(N - 1.001, Math.max(0, gx)); gz = Math.min(N - 1.001, Math.max(0, gz));
    const ix = Math.floor(gx), iz = Math.floor(gz);
    const tx = gx - ix, tz = gz - iz, k = iz * N + ix;
    const a = dGrid[k] * (1 - tx) + dGrid[k + 1] * tx;
    const b = dGrid[k + N] * (1 - tx) + dGrid[k + N + 1] * tx;
    return (a * (1 - tz) + b * tz) * DSCALE;
  }

  // ---- segment spatial index for O(1) hot-path queries ----
  // numeric keys (no per-query string allocation); segments are inserted
  // into every cell their bank-inflated bbox overlaps, so a query only
  // ever reads its own cell.
  const QC = cfg.qCell;
  const qmap = new Map();
  const qKey = (qx, qz) => (qx + 512) * 4096 + (qz + 512);
  let segCount = 0;
  for (const r of rivers) {
    const bank = r.w * cfg.bankFrac;
    for (let i = 0; i + 1 < r.pts.length; i++) {
      const s = {
        ax: r.pts[i][0], az: r.pts[i][1], bx: r.pts[i + 1][0], bz: r.pts[i + 1][1],
        w: r.w, d: r.d, wsA: r.ws[i], wsB: r.ws[i + 1], bank,
      };
      segCount++;
      const qx0 = Math.floor((Math.min(s.ax, s.bx) - bank) / QC), qx1 = Math.floor((Math.max(s.ax, s.bx) + bank) / QC);
      const qz0 = Math.floor((Math.min(s.az, s.bz) - bank) / QC), qz1 = Math.floor((Math.max(s.az, s.bz) + bank) / QC);
      for (let qx = qx0; qx <= qx1; qx++) for (let qz = qz0; qz <= qz1; qz++) {
        const key = qKey(qx, qz);
        let arr = qmap.get(key);
        if (!arr) qmap.set(key, arr = []);
        arr.push(s);
      }
    }
  }

  let _depth = 0, _ws = -Infinity; // scan() scratch — consume immediately
  function scan(x, z) {
    _depth = 0; _ws = -Infinity;
    const arr = qmap.get(qKey(Math.floor(x / QC), Math.floor(z / QC)));
    if (!arr) return;
    for (let i = 0; i < arr.length; i++) {
      const s = arr[i];
      const vx = s.bx - s.ax, vz = s.bz - s.az;
      const wx = x - s.ax, wz = z - s.az;
      const L2 = vx * vx + vz * vz || 1;
      let t = (wx * vx + wz * vz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = wx - t * vx, ez = wz - t * vz;
      const dist = Math.sqrt(ex * ex + ez * ez);
      if (dist < s.bank) {
        const dep = s.d * (1 - smf01(dist / s.bank));
        if (dep > _depth) _depth = dep;
        if (dist < s.w * 0.5) { const v = s.wsA + (s.wsB - s.wsA) * t; if (v > _ws) _ws = v; }
      }
    }
  }
  // bilinear lake sampling in cell-center space: weight + water level
  let _lw = 0, _lws = 0;
  function lakeAt(x, z) {
    _lw = 0; _lws = 0;
    const gx = (x - x0) / dx - 0.5, gz = (z - z0) / dz - 0.5;
    const ix = Math.floor(gx), iz = Math.floor(gz);
    const tx = gx - ix, tz = gz - iz;
    let wsum = 0, lsum = 0;
    for (let a = 0; a <= 1; a++) for (let b = 0; b <= 1; b++) {
      const jx = ix + a, jz = iz + b;
      if (jx < 0 || jz < 0 || jx >= N || jz >= N) continue;
      const k = jz * N + jx;
      if (!lake[k]) continue;
      const w = (a ? tx : 1 - tx) * (b ? tz : 1 - tz);
      wsum += w; lsum += w * filled[k];
    }
    if (wsum > 0) { _lw = wsum; _lws = lsum / wsum; }
  }
  function carve(x, z, h) {
    scan(x, z);
    let out = h - _depth;
    lakeAt(x, z);
    if (_lw > 0) out += smf01(_lw) * Math.min(0, (_lws - cfg.dLake) - out);
    return out;
  }
  function water(x, z) {
    scan(x, z);
    let ws = _ws;
    lakeAt(x, z);
    if (_lw > 0.5 && _lws > ws) ws = _lws;
    return ws;
  }

  return {
    rivers, lakeCount, lakeCells, riverCells, segCount, lakeSurf,
    carve, water, distW,
    // stage-1 grids for downstream stages (settlement scoring, roads):
    // row-major N×N over [x0,x1]×[z0,z1], cell centres at (i+0.5)·dx
    grids: { N, x0, z0, dx, dz, H, filled, sea, wet, lake, acc, claimed },
    stats: { bakeMs: Date.now() - t0, N, maxAcc, cellW: dx },
  };
}
// ============================================================
// WORLD BIOMES — WORLD-GEN-PROC stage 2: climate -> biomes -> forests.
// Analytic recombination, no stored map: biome = f(altitude, slope,
// moisture fBm, distance-to-water). Drives the W.surface classifier and
// per-point tree placement (density + species, clustered into stands by
// a coarse stand noise so forests read as stands, not confetti).
// Pure function of its deps; deterministic (integer-hash noise + salt).
// Species (tree.sp): 0 spruce, 1 pine, 2 oak, 3 birch, 4 willow.
// ============================================================
function makeBiomes(D) {
  // D: { terrainH, waterOf(h,x,z), distW, SURFACE, salt, roadNear?, aeroSurf? }
  const { terrainH, waterOf, distW, SURFACE, salt, roadNear, aeroSurf } = D;
  const smf = t => t * t * (3 - 2 * t);
  const clamp01 = v => Math.min(1, Math.max(0, v));
  // decorrelated from the terrain hash: swapped multipliers + own constant
  const hash2 = (ix, iz) => {
    let h = (ix * 668265263 + iz * 374761393 + 69069 + salt) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  function vnoise(x, z, cell) {
    const fx = x / cell, fz = z / cell;
    const ix = Math.floor(fx), iz = Math.floor(fz);
    const tx = smf(fx - ix), tz = smf(fz - iz);
    const a = hash2(ix, iz), b = hash2(ix + 1, iz),
          c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }
  // per-point hash for placement/species decisions, keyed on quantized coords
  const ph = (x, z, k) => hash2(Math.round(x * 4) + Math.imul(k, 7349), Math.round(z * 4) - Math.imul(k, 4903));

  const TREELINE = 165;                       // no trees above; scrub belt below
  const moistN = (x, z) =>
    vnoise(x + 37, z + 911, 900) * 0.50 + vnoise(x + 211, z + 13, 380) * 0.33 +
    vnoise(x + 555, z + 333, 150) * 0.17;
  const moist = (x, z) =>
    clamp01(moistN(x, z) * 0.75 + Math.max(0, 1 - distW(x, z) / 240) * 0.45);
  const slope = (x, z) => {
    const e = 8;
    return Math.hypot(terrainH(x + e, z) - terrainH(x - e, z),
                      terrainH(x, z + e) - terrainH(x, z - e)) / (2 * e);
  };
  const stand = (x, z) => vnoise(x + 77, z + 479, 210);   // stand/species field
  const forestness = (x, z, h) =>
    clamp01(0.55 * stand(x, z) + 0.30 * moist(x, z) + 0.15 * clamp01(1 - Math.abs(h - 70) / 140));

  function surface(x, z) {
    const h = terrainH(x, z);
    if (waterOf(h, x, z) > h) return SURFACE.WATER;
    if (aeroSurf) { const as = aeroSurf(x, z); if (as >= 0) return as; }  // stage-4 strips
    const sl = slope(x, z);
    if (h < 2.5 && distW(x, z) < 70) return SURFACE.SAND;     // coast + estuary bars
    if (h > 220 || sl > 0.75 || (h > TREELINE && sl > 0.38)) return SURFACE.ROCK;
    if (h > 100 && sl > 0.45) return SURFACE.SCREE;
    if (roadNear && roadNear(x, z) < 3.5) return SURFACE.GRAVEL;  // stage-3 roads
    if (h < TREELINE && sl < 0.5 && forestness(x, z, h) > 0.48) return SURFACE.FOREST_FLOOR;
    return SURFACE.GRASS;
  }

  // tree placement decision for one candidate point (caller already
  // rejected water / corridor / aerodromes / h out of [2, TREELINE]).
  // Returns null or { p, sp, s }: keep-probability, species, scale.
  function treeAt(x, z, h) {
    const sl = slope(x, z);
    if (sl > 0.5 || (h > 100 && sl > 0.45)) return null;  // mirrors the SCREE band
    const dW = distW(x, z);
    if (h < 2.5 && dW < 70) return null;                      // sand
    const st = stand(x, z), mo = moist(x, z);
    const fn = clamp01(0.55 * st + 0.30 * mo + 0.15 * clamp01(1 - Math.abs(h - 70) / 140));
    const rip = dW < 45 && h < 120 && sl < 0.4;
    let p;
    if (rip) p = 0.85;                                        // riparian strip
    else if (fn > 0.48) p = 0.85;                             // stand interior
    else if (fn > 0.40) p = 0.25;                             // open woodland
    else p = 0.05;                                            // lone field trees
    let scrub = false;
    if (h > TREELINE - 25) { p = Math.min(p, 0.12); scrub = true; }
    const r1 = ph(x, z, 1), r2 = ph(x, z, 2);
    let sp;
    if (rip) sp = r1 < 0.7 ? 4 : 2;
    else if (h > 115) sp = st < 0.5 ? 0 : 1;                  // high forest: conifer
    else if (st < 0.44) sp = mo > 0.55 ? 0 : 1;
    else if (st > 0.58) sp = r1 < 0.55 ? 2 : 3;
    else sp = r1 < 0.3 ? 1 : r1 < 0.6 ? 2 : 3;
    const S0 = [1.15, 1.0, 1.1, 0.9, 0.85][sp];
    let s = S0 * (0.78 + r2 * 0.5);
    if (scrub) s *= 0.62;
    s = Math.min(1.75, Math.max(0.65, s));
    return { p, sp, s };
  }

  return { surface, treeAt, moist, slope, stand, TREELINE };
}
// ============================================================
// WORLD SETTLEMENTS & ROADS — WORLD-GEN-PROC stage 3.
// Site scoring on the stage-1 grid (flat + near water + low altitude +
// confluence/coast bonuses, greedy pick with min spacing), organic road
// growth (multi-source Dijkstra from the existing network on a 2x
// decimated grid — new settlements attach to the nearest network point,
// so trunks are shared), explicit bridge pieces across water-cell runs,
// a shallow road-grading SDF (flatten ACROSS the road toward a smoothed
// along-profile, never on bridges), and building footprints laid out
// along the local road tangent. Deterministic: hash streams + index
// tie-breaks everywhere. The road network grows from the home airfield.
// ============================================================
function bakeSettlements(D) {
  // D: { grids, terrain(x,z) pre-road, water(x,z), distW(x,z), meadows, salt }
  const t0 = Date.now();
  const G = D.grids, meadows = D.meadows;
  const smf01 = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
  const hash2 = (ix, iz) => {
    let h = (ix * 912931 + iz * 597269 + 41777 + D.salt) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  // ---- 2x decimated road grid ----
  const NR = G.N >> 1, MR = NR * NR, dr = G.dx * 2;
  const px = ix => G.x0 + (2 * ix + 0.5) * G.dx, pz = iz => G.z0 + (2 * iz + 0.5) * G.dz;
  const fIdx = k => (2 * ((k / NR) | 0)) * G.N + 2 * (k % NR);
  const H2 = new Float64Array(MR), wat2 = new Uint8Array(MR);
  const isWetF = f => (G.sea[f] || G.wet[f] || G.lake[f] || G.claimed[f]) ? 1 : 0;
  for (let k = 0; k < MR; k++) {
    const f = fIdx(k);
    H2[k] = G.H[f];
    // OR the whole 2x2 fine block: 1-cell river lines must not leave gaps
    // a path could sneak through without a bridge
    const fx = f % G.N, fz = (f / G.N) | 0;
    let w = isWetF(f);
    if (fx + 1 < G.N) w = w || isWetF(f + 1);
    if (fz + 1 < G.N) w = w || isWetF(f + G.N);
    if (fx + 1 < G.N && fz + 1 < G.N) w = w || isWetF(f + G.N + 1);
    wat2[k] = w ? 1 : 0;
  }
  const inPadZone = (x, z) => x > -1230 && x < 180 && Math.abs(z) < 140;
  const meadowMult = (x, z) => {
    for (const m of meadows) if (Math.hypot(x - m.x, z - m.z) < m.r * 1.2) return 8;
    return 1;
  };

  // ---- river junctions (confluences) on the fine grid, for site bonus ----
  const junctions = [];
  {
    const inflow = new Uint8Array(G.N * G.N);
    for (let k = 0; k < G.N * G.N; k++) {
      if (!G.claimed[k] || G.sea[k]) continue;
      // count claimed upstream neighbours flowing here is expensive via flow
      // scan; approximate: a claimed cell with >=3 claimed 8-neighbours is a
      // junction-ish knot (straight reaches have 2)
      const ix = k % G.N, iz = (k / G.N) | 0;
      let n = 0;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        if (!a && !b) continue;
        const jx = ix + a, jz = iz + b;
        if (jx < 0 || jz < 0 || jx >= G.N || jz >= G.N) continue;
        if (G.claimed[jz * G.N + jx]) n++;
      }
      if (n >= 3 && !inflow[k]) {
        junctions.push([G.x0 + (ix + 0.5) * G.dx, G.z0 + (iz + 0.5) * G.dz]);
        // suppress neighbours so one knot emits one junction
        for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
          const jx = ix + a, jz = iz + b;
          if (jx >= 0 && jz >= 0 && jx < G.N && jz < G.N) inflow[jz * G.N + jx] = 1;
        }
      }
    }
  }

  // ---- settlement site scoring + greedy pick ----
  const sites = [];
  for (let k = 0; k < MR; k++) {
    const ix = k % NR, iz = (k / NR) | 0;
    if (ix < 2 || iz < 2 || ix >= NR - 2 || iz >= NR - 2) continue;
    if (wat2[k]) continue;
    const h = H2[k];
    if (h < 1.5 || h > 130) continue;
    const x = px(ix), z = pz(iz);
    if (Math.abs(z) < 400 && x < 400 && x > -3400) continue;      // circuit band
    let nearMeadow = false;
    for (const m of meadows) if (Math.hypot(x - m.x, z - m.z) < m.r * 1.8) nearMeadow = true;
    if (nearMeadow) continue;
    let sl = 0;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
      sl = Math.max(sl, Math.abs(H2[(iz + b) * NR + ix + a] - h) / dr);
    if (sl > 0.11) continue;
    // neighbourhood dryness: the near-water bonus must not drop a town on
    // a shallow-lake islet — require the ±3-cell block nearly all dry
    let wet = 0;
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
      const jx = ix + a, jz = iz + b;
      if (jx < 0 || jz < 0 || jx >= NR || jz >= NR || wat2[jz * NR + jx]) wet++;
    }
    if (wet > 10) continue;   // islets block ~half the 49-cell block; tarn shores just a few
    // grid masks miss water under DP-simplified river polylines (corner
    // cuts) — verify against the actual water query, centre + 60 m ring
    let qWet = false;
    for (let q = 0; q < 5; q++) {
      const qx = x + (q ? 60 * Math.cos(q * Math.PI / 2) : 0);
      const qz = z + (q ? 60 * Math.sin(q * Math.PI / 2) : 0);
      if (D.water(qx, qz) > D.terrain(qx, qz)) { qWet = true; break; }
    }
    if (qWet) continue;
    const dW = D.distW(x, z);
    let score = 2.2 * (1 - sl / 0.11) + 1.2 * Math.max(0, 1 - h / 140);
    if (dW > 25 && dW < 320) score += 1.6 * (1 - (dW - 25) / 295);
    for (const [jx, jz] of junctions)
      if (Math.hypot(x - jx, z - jz) < 260) { score += 1.4; break; }
    if (h < 8 && dW < 220) score += 1.0;                          // coast
    sites.push([score, k]);
  }
  sites.sort((a, b) => (b[0] - a[0]) || (a[1] - b[1]));
  const settlements = [
    { x: 60, z: 112, r: 95, pop: 45, name: 'Home Field', kind: 'home' },
  ];
  for (const [score, k] of sites) {
    if (settlements.length >= 9 || score < 2.2) break;  // 24 km world holds more towns
    const x = px(k % NR), z = pz((k / NR) | 0);
    if (settlements.some(s => Math.hypot(s.x - x, s.z - z) < 2500)) continue;
    // rank-declining pop + hash spread: the score formula saturated and
    // made every town 900 — stage 4 wants a size mix (paved vs grass)
    const h0v = hash2(k, 71);
    const pop = Math.max(140, Math.min(900,
      Math.round((900 - (settlements.length - 1) * 95) * (0.78 + h0v * 0.35))));
    const h1 = hash2(k, 11), h2 = hash2(k, 23), h3 = hash2(k, 37), h4 = hash2(k, 53);
    const SYL1 = ['Al', 'Ber', 'Dal', 'Fen', 'Gil', 'Hol', 'Kes', 'Lun', 'Mor', 'Nor', 'Pel', 'Ros', 'Tor', 'Vim', 'Wes'];
    const SYL2 = ['by', 'stad', 'ford', 'ton', 'ham', 'wick', 'dorf', 'vik', 'field'];
    let name = '';
    for (let v = 0; v < 9; v++) {   // rotate the suffix on collision
      name = SYL1[(h1 * 15) | 0] + (h2 < 0.4 ? SYL1[(h3 * 15) | 0].toLowerCase() : '') + SYL2[(((h4 * 9) | 0) + v) % 9];
      if (!settlements.some(s => s.name === name)) break;
    }
    if (settlements.some(s => s.name === name)) name = 'New ' + name;
    settlements.push({ x, z, r: Math.min(320, 70 + pop * 0.28), pop, name, kind: 'town' });
  }

  // ---- roads: organic growth, multi-source Dijkstra on the road grid ----
  const nodeCell = settlements.map(s => {
    let ix = Math.min(NR - 2, Math.max(1, Math.round((s.x - G.x0) / dr - 0.5)));
    let iz = Math.min(NR - 2, Math.max(1, Math.round((s.z - G.z0) / dr - 0.5)));
    // nudge off water if needed (deterministic spiral)
    for (let rad = 0; rad < 6; rad++) {
      let done = false;
      for (let a = -rad; a <= rad && !done; a++) for (let b = -rad; b <= rad && !done; b++) {
        const jx = ix + a, jz = iz + b;
        if (jx < 1 || jz < 1 || jx >= NR - 1 || jz >= NR - 1) continue;
        if (!wat2[jz * NR + jx]) { ix = jx; iz = jz; done = true; }
      }
      if (done) break;
    }
    return iz * NR + ix;
  });
  const NBX = [1, -1, 0, 0, 1, 1, -1, -1], NBZ = [0, 0, 1, -1, 1, -1, 1, -1];
  const DD = NBX.map((v, i) => Math.hypot(v * dr, NBZ[i] * dr));
  const cost = new Float64Array(MR), prev = new Int32Array(MR);
  const hK = new Float64Array(MR * 2), hI = new Int32Array(MR * 2);
  let hn = 0;
  const hLess = (a, b) => hK[a] < hK[b] || (hK[a] === hK[b] && hI[a] < hI[b]);
  const hSwap = (a, b) => { const k = hK[a], i = hI[a]; hK[a] = hK[b]; hI[a] = hI[b]; hK[b] = k; hI[b] = i; };
  const hPush = (key, idx) => {
    let i = hn++; hK[i] = key; hI[i] = idx;
    while (i > 0) { const p = (i - 1) >> 1; if (hLess(p, i)) break; hSwap(i, p); i = p; }
  };
  const hPop = () => {
    const top = hI[0];
    hn--; hK[0] = hK[hn]; hI[0] = hI[hn];
    let i = 0;
    for (;;) {
      const l = 2 * i + 1, r = l + 1; let s = i;
      if (l < hn && hLess(l, s)) s = l;
      if (r < hn && hLess(r, s)) s = r;
      if (s === i) break;
      hSwap(i, s); i = s;
    }
    return top;
  };
  const network = new Uint8Array(MR);
  network[nodeCell[0]] = 1;
  const cellPaths = [];                        // arrays of road-grid cell indices
  const connected = new Uint8Array(settlements.length);
  connected[0] = 1;
  for (let step = 1; step < settlements.length; step++) {
    cost.fill(Infinity); prev.fill(-1); hn = 0;
    for (let k = 0; k < MR; k++) if (network[k]) { cost[k] = 0; hPush(0, k); }
    const want = new Int32Array(MR).fill(-1);
    for (let s = 0; s < settlements.length; s++) if (!connected[s]) want[nodeCell[s]] = s;
    let hit = -1, hitCell = -1;
    const done = new Uint8Array(MR);
    while (hn > 0) {
      const c = hPop();
      if (done[c]) continue;
      done[c] = 1;
      if (want[c] >= 0) { hit = want[c]; hitCell = c; break; }
      const cix = c % NR, ciz = (c / NR) | 0;
      if (cix < 1 || ciz < 1 || cix >= NR - 1 || ciz >= NR - 1) continue;
      for (let d = 0; d < 8; d++) {
        const n = (ciz + NBZ[d]) * NR + cix + NBX[d];
        if (done[n]) continue;
        const sl = (H2[n] - H2[c]) / DD[d];
        let e = DD[d] * (1 + 8 * sl * sl);
        if (wat2[n]) e *= 6;                   // crossings allowed; bridges are cheaper than long detours
        const nx = px(n % NR), nz = pz((n / NR) | 0);
        if (inPadZone(nx, nz)) e *= 60;
        e *= meadowMult(nx, nz);
        if (cost[c] + e < cost[n]) { cost[n] = cost[c] + e; prev[n] = c; hPush(cost[n], n); }
      }
    }
    if (hit < 0) break;                        // isolated site: leave unroaded
    const path = [];
    for (let c = hitCell; c >= 0; c = prev[c]) { path.push(c); if (network[c]) break; }
    path.reverse();                            // network -> settlement
    for (const c of path) network[c] = 1;
    cellPaths.push({ path, pop: settlements[hit].pop });
    connected[hit] = 1;
  }

  // ---- cell paths -> road pieces (dry runs simplified, wet runs = bridges)
  const roads = [];                            // {pts, cls, tgt?} tgt = grading targets
  const dpSimp = (pts, eps) => {
    const keep = new Uint8Array(pts.length);
    keep[0] = keep[pts.length - 1] = 1;
    const st = [[0, pts.length - 1]];
    while (st.length) {
      const [a, b] = st.pop();
      if (b - a < 2) continue;
      const vx = pts[b][0] - pts[a][0], vz = pts[b][1] - pts[a][1];
      const L = Math.hypot(vx, vz) || 1;
      let mi = -1, md = 0;
      for (let i = a + 1; i < b; i++) {
        const dd = Math.abs((pts[i][0] - pts[a][0]) * vz - (pts[i][1] - pts[a][1]) * vx) / L;
        if (dd > md) { md = dd; mi = i; }
      }
      if (md > eps && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
    }
    return pts.filter((_, i) => keep[i]);
  };
  for (const { path, pop } of cellPaths) {
    const cls = pop < 150 ? 'track' : 'road';
    let run = [], runWet = wat2[path[0]] ? 1 : 0;
    const flushRun = (wet, nextPt) => {
      if (nextPt) run.push(nextPt);
      if (run.length >= 2) {
        if (wet) roads.push({ pts: [run[0], run[run.length - 1]], cls: 'bridge' });
        else {
          let pts = dpSimp(run, 30);
          // re-subdivide to <=50 m so grading targets track the terrain —
          // on warped (rough) ground a target lerped across a 100+ m
          // segment drifts metres off the surface and the clamp gouges
          const fine = [pts[0]];
          for (let i = 0; i + 1 < pts.length; i++) {
            const L = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
            const nSub = Math.max(1, Math.ceil(L / 50));
            for (let q = 1; q <= nSub; q++)
              fine.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * q / nSub,
                         pts[i][1] + (pts[i + 1][1] - pts[i][1]) * q / nSub]);
          }
          pts = fine;
          const tgt = pts.map(p => D.terrain(p[0], p[1]));
          for (let i = 1; i + 1 < tgt.length; i++) tgt[i] = (tgt[i - 1] + tgt[i] + tgt[i + 1]) / 3;
          roads.push({ pts, cls, tgt });
        }
      }
      run = nextPt ? [nextPt] : [];
    };
    for (const c of path) {
      const pt = [px(c % NR), pz((c / NR) | 0)];
      const wet = wat2[c] ? 1 : 0;
      if (wet !== runWet) { flushRun(runWet, pt); runWet = wet; }
      else run.push(pt);
    }
    flushRun(runWet, null);
  }

  // ---- segment index + queries (same pattern as the river carve) ----
  const QC = 64, qmap = new Map();
  const qKey = (qx, qz) => (qx + 512) * 4096 + (qz + 512);
  const RINF = 12;                             // grading feather halfwidth
  for (const r of roads) {
    if (r.cls === 'bridge') continue;
    for (let i = 0; i + 1 < r.pts.length; i++) {
      const s = { ax: r.pts[i][0], az: r.pts[i][1], bx: r.pts[i + 1][0], bz: r.pts[i + 1][1],
                  tA: r.tgt[i], tB: r.tgt[i + 1] };
      const qx0 = Math.floor((Math.min(s.ax, s.bx) - RINF) / QC), qx1 = Math.floor((Math.max(s.ax, s.bx) + RINF) / QC);
      const qz0 = Math.floor((Math.min(s.az, s.bz) - RINF) / QC), qz1 = Math.floor((Math.max(s.az, s.bz) + RINF) / QC);
      for (let qx = qx0; qx <= qx1; qx++) for (let qz = qz0; qz <= qz1; qz++) {
        const key = qKey(qx, qz);
        let arr = qmap.get(key);
        if (!arr) qmap.set(key, arr = []);
        arr.push(s);
      }
    }
  }
  let _d = Infinity, _t = 0;
  function roadScan(x, z) {
    _d = Infinity; _t = 0;
    const arr = qmap.get(qKey(Math.floor(x / QC), Math.floor(z / QC)));
    if (!arr) return;
    for (let i = 0; i < arr.length; i++) {
      const s = arr[i];
      const vx = s.bx - s.ax, vz = s.bz - s.az;
      const wx = x - s.ax, wz = z - s.az;
      const L2 = vx * vx + vz * vz || 1;
      let t = (wx * vx + wz * vz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = wx - t * vx, ez = wz - t * vz;
      const dist = Math.sqrt(ex * ex + ez * ez);
      if (dist < _d) { _d = dist; _t = s.tA + (s.tB - s.tA) * t; }
    }
  }
  function roadNear(x, z) { roadScan(x, z); return _d; }
  function roadDelta(x, z, h) {
    roadScan(x, z);
    if (_d >= RINF) return h;
    // flat roadbed core (4.5 m half-width), feathered shoulders to RINF —
    // "flatten across, not along"
    const prof = _d < 4.5 ? 1 : 1 - smf01((_d - 4.5) / (RINF - 4.5));
    let delta = (_t - h) * prof;
    // ±8: W12 terraced risers (22 m strata) need deeper road cuttings
    if (delta > 8) delta = 8; else if (delta < -8) delta = -8;
    return h + delta;
  }

  // ---- buildings: rows along the local road tangent at each settlement
  const buildings = [];
  for (let si = 0; si < settlements.length; si++) {
    const s = settlements[si];
    // street direction: tangent of the nearest road vertex pair
    let dirX = 1, dirZ = 0, best = Infinity;
    for (const r of roads) {
      if (r.cls === 'bridge') continue;
      for (let i = 0; i + 1 < r.pts.length; i++) {
        const d = Math.hypot(r.pts[i][0] - s.x, r.pts[i][1] - s.z);
        if (d < best) {
          best = d;
          const L = Math.hypot(r.pts[i + 1][0] - r.pts[i][0], r.pts[i + 1][1] - r.pts[i][1]) || 1;
          dirX = (r.pts[i + 1][0] - r.pts[i][0]) / L; dirZ = (r.pts[i + 1][1] - r.pts[i][1]) / L;
        }
      }
    }
    const ang = Math.atan2(dirZ, dirX);
    const n = Math.min(22, 4 + Math.round(s.pop / 45));
    let placed = 0;
    for (let i = 0; i < n * 2 && placed < n; i++) {
      const h1 = hash2(si * 131 + i, 3), h2 = hash2(si * 131 + i, 7),
            h3 = hash2(si * 131 + i, 13), h4 = hash2(si * 131 + i, 17);
      const side = i % 2 ? 1 : -1;
      const along = (Math.floor(i / 2) - Math.floor(n / 4)) * 26 + (h1 - 0.5) * 12;
      const lat = side * (13 + h2 * 9);
      const bx = s.x + dirX * along - dirZ * lat;
      const bz = s.z + dirZ * along + dirX * lat;
      if (Math.hypot(bx - s.x, bz - s.z) > s.r) continue;
      const bh = D.terrain(bx, bz);
      if (bh < 0.5 || D.water(bx, bz) > bh) continue;
      roadScan(bx, bz);
      if (_d < 8) continue;
      buildings.push({
        x: bx, z: bz, w: 6 + h3 * 6, l: 8 + h4 * 7,
        hgt: 3 + h2 * 2.2, rot: ang + (h1 - 0.5) * 0.25,
        kind: h3 < 0.82 ? 'house' : 'barn',
      });
      placed++;
    }
  }

  const inCore = (x, z) => settlements.some(s => Math.hypot(x - s.x, z - s.z) < s.r * 0.75);

  return {
    settlements, roads, buildings, roadNear, roadDelta, inCore,
    stats: { bakeMs: Date.now() - t0, junctions: junctions.length },
  };
}
// ============================================================
// WORLD AERODROMES — WORLD-GEN-PROC stage 4 (the point of the exercise).
// A main field per sizeable settlement (candidate ring x 8 headings,
// scored on centreline flatness + cross-clearance + road proximity;
// length/width/surface by town size, >=900 m is paved) and backcountry
// strips on high benches (flat probe, fly-in flagged). Each strip emits
// an oriented grading SDF (the home runway carve, parameterized), a
// surface patch, a tree-exclusion box and a registry record with
// heading + touchdown zone for the future AP integration.
// Deterministic: fixed iteration orders, hash jitter only.
// ============================================================
function bakeAerodromes(D) {
  // D: { terrain(x,z), water(x,z), settlements, meadows, roadNear, SURFACE, salt }
  const t0 = Date.now();
  const { terrain, water, settlements, meadows, roadNear, SURFACE, salt } = D;
  const smf01 = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
  const hash2 = (ix, iz) => {
    let h = (ix * 786433 + iz * 393241 + 65213 + salt) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const strips = [];

  // centreline + shoulder probe: flatness, slope, wetness around a candidate
  function probe(cx, cz, hdg, len, wid) {
    const dx = Math.cos(hdg), dz = Math.sin(hdg);
    const K = 11, hs = [];
    let sum = 0;
    for (let i = 0; i < K; i++) {
      const t = (i / (K - 1) - 0.5) * len;
      const h = terrain(cx + dx * t, cz + dz * t);
      hs.push(h); sum += h;
    }
    const elev = sum / K;
    let flat = 0, slopeMax = 0, wet = false;
    for (let i = 0; i < K; i++) {
      flat = Math.max(flat, Math.abs(hs[i] - elev));
      if (i) slopeMax = Math.max(slopeMax, Math.abs(hs[i] - hs[i - 1]) / (len / (K - 1)));
      const t = (i / (K - 1) - 0.5) * len;
      const px = cx + dx * t, pz = cz + dz * t;
      if (hs[i] < 1.2 || water(px, pz) > hs[i]) wet = true;
      for (const s of [-1, 1]) {
        const qx = px - dz * s * wid, qz = pz + dx * s * wid;
        const qh = terrain(qx, qz);
        if (qh < 1.2 || water(qx, qz) > qh) wet = true;
      }
    }
    return { flat, slopeMax, elev, wet };
  }
  const nearMeadow = (x, z, f) => meadows.some(m => Math.hypot(x - m.x, z - m.z) < m.r * f);
  const inHomeZone = (x, z) =>
    (x > -3400 && x < 400 && Math.abs(z) < 500) ||     // circuit band
    (x > -1900 && x < 900 && Math.abs(z) < 900);       // pad + generous margin
  const farFromStrips = (x, z, d) => strips.every(st => Math.hypot(x - st.x, z - st.z) >= d);

  function push(cx, cz, hdg, len, wid, surf, elev, name, kind, flyIn) {
    const dx = Math.cos(hdg), dz = Math.sin(hdg);
    const feather = 90 + len * 0.1;
    const ex = Math.abs(dx) * len / 2 + Math.abs(dz) * wid / 2 + feather;
    const ez = Math.abs(dz) * len / 2 + Math.abs(dx) * wid / 2 + feather;
    // tdz on the APPROACH side: threshold + 25% (landing dir = -takeoffDir,
    // so the threshold is the +takeoffDir end). The W9 formula had it on
    // the rollout end — frame math was self-consistent so landings "worked",
    // but rollouts ran ~len/2 past the DRAWN strip (XCTY2 measured it).
    // spawn: the takeoff-run start, 35 m in from the rollout end.
    const tdzx = cx + dx * len * 0.25, tdzz = cz + dz * len * 0.25;
    strips.push({
      id: 'A' + strips.length, name, kind, x: cx, z: cz, hdg, len, wid,
      surface: surf, elev, tdz: [tdzx, tdzz],
      spawn: [cx - dx * (len / 2 - 35), cz - dz * (len / 2 - 35)],
      flyIn: !!flyIn,
      dx, dz, feather, bx0: cx - ex, bx1: cx + ex, bz0: cz - ez, bz1: cz + ez,
    });
  }

  // ---- main field per settlement above the pop threshold ----
  for (let si = 0; si < settlements.length; si++) {
    const s = settlements[si];
    if (s.kind === 'home' || s.pop < 250) continue;
    const len = s.pop >= 800 ? 900 : s.pop >= 450 ? 650 : 480;
    const wid = len >= 900 ? 30 : 22;
    const surf = len >= 900 ? SURFACE.PAVED : SURFACE.GRASS;
    let best = null;
    const r0 = Math.max(320, s.r + 160);
    for (let ri = 0; ri < 3; ri++) for (let ai = 0; ai < 12; ai++) {
      const ang = (ai / 12) * 2 * Math.PI + hash2(si * 37 + ri, ai) * 0.2;
      const cx = s.x + Math.cos(ang) * (r0 + ri * 280);
      const cz = s.z + Math.sin(ang) * (r0 + ri * 280);
      if (inHomeZone(cx, cz) || nearMeadow(cx, cz, 1.8) || !farFromStrips(cx, cz, 1500)) continue;
      if (roadNear(cx, cz) > 1100) continue;   // town fields must be road-reachable
      for (let hi = 0; hi < 8; hi++) {
        const hdg = hi * Math.PI / 8;
        const p = probe(cx, cz, hdg, len, wid);
        if (p.wet || p.flat > 6 || p.slopeMax > 0.06) continue;
        const cost = p.flat + p.slopeMax * 60 + Math.min(2, roadNear(cx, cz) / 600);
        if (!best || cost < best.cost) best = { cx, cz, hdg, cost, elev: p.elev };
      }
    }
    if (best)
      push(best.cx, best.cz, best.hdg, len, wid, surf, best.elev,
           s.name + (len >= 900 ? ' Airfield' : ' Field'), 'main', false);
  }

  // ---- backcountry strips: high benches, fly-in only ----
  {
    const cand = [];
    for (let gx = -11; gx <= 11; gx++) for (let gz = -11; gz <= 11; gz++) {
      for (let j = 0; j < 3; j++) {
        const cx = gx * 1000 + (hash2(gx + 900 + j * 131, gz) - 0.5) * 800;
        const cz = gz * 1000 + (hash2(gx, gz + 900 + j * 131) - 0.5) * 800;
        const h = terrain(cx, cz);
        if (h < 90 || h > 420) continue;
        if (inHomeZone(cx, cz) || nearMeadow(cx, cz, 1.8)) continue;
        if (settlements.some(s => Math.hypot(cx - s.x, cz - s.z) < 1800)) continue;
        let bestH = null;
        for (let hi = 0; hi < 8; hi++) {
          const hdg = hi * Math.PI / 8;
          const p = probe(cx, cz, hdg, 340, 18);
          if (p.wet || p.flat > 5 || p.slopeMax > 0.05) continue;
          if (!bestH || p.flat < bestH.flat) bestH = { hdg, flat: p.flat, elev: p.elev };
        }
        if (bestH) cand.push({ cx, cz, ...bestH });
      }
    }
    cand.sort((a, b) => (a.flat - b.flat) || (a.cx - b.cx) || (a.cz - b.cz));
    const SYL = ['Kar', 'Tyl', 'Ulv', 'Brekk', 'Stein', 'Vass'];
    for (const c of cand) {
      if (strips.filter(st => st.kind === 'strip').length >= 3) break;
      if (!farFromStrips(c.cx, c.cz, 3000)) continue;
      let nm = '';
      for (let v = 0; v < SYL.length; v++) {   // rotate on collision
        nm = SYL[(((hash2(Math.round(c.cx), Math.round(c.cz)) * SYL.length) | 0) + v) % SYL.length] + ' Strip';
        if (!strips.some(st => st.name === nm)) break;
      }
      push(c.cx, c.cz, c.hdg, 340, 18, SURFACE.GRAVEL, c.elev, nm, 'strip', true);
    }
  }

  // ---- queries: oriented grading SDF, surface patch, exclusion box ----
  function grade(x, z, h) {
    for (const st of strips) {
      if (x < st.bx0 || x > st.bx1 || z < st.bz0 || z > st.bz1) continue;
      const rx = x - st.x, rz = z - st.z;
      const lu = rx * st.dx + rz * st.dz;
      const lv = -rx * st.dz + rz * st.dx;
      const du = Math.max(0, Math.abs(lu) - st.len / 2);
      const dv = Math.max(0, Math.abs(lv) - st.wid / 2 - 6);
      const d = Math.hypot(du, dv);
      if (d < st.feather) h += (st.elev - h) * (1 - smf01(d / st.feather));
    }
    return h;
  }
  function surfaceAt(x, z) {
    for (const st of strips) {
      if (x < st.bx0 || x > st.bx1 || z < st.bz0 || z > st.bz1) continue;
      const rx = x - st.x, rz = z - st.z;
      const lu = rx * st.dx + rz * st.dz;
      const lv = -rx * st.dz + rz * st.dx;
      if (Math.abs(lu) < st.len / 2 && Math.abs(lv) < st.wid / 2) return st.surface;
    }
    return -1;
  }
  function inBox(x, z, m) {
    for (const st of strips) {
      if (x < st.bx0 - m || x > st.bx1 + m || z < st.bz0 - m || z > st.bz1 + m) continue;
      const rx = x - st.x, rz = z - st.z;
      const lu = rx * st.dx + rz * st.dz;
      const lv = -rx * st.dz + rz * st.dx;
      if (Math.abs(lu) < st.len / 2 + m && Math.abs(lv) < st.wid / 2 + m) return true;
    }
    return false;
  }

  return { strips, grade, surfaceAt, inBox, stats: { bakeMs: Date.now() - t0 } };
}
// ===========================================================================
// THE SITE — the base aerodrome as a place, declared once.
// ===========================================================================
// THE RUNWAY IS NOT HERE. It is world.aerodromes[0] — the 'HOME' record in
// 20_world.js — and this file READS it. That record's own comment has said
// since it was written that "the h0 runway carve box / renderer decals are not
// yet driven from these records", and until now they were not: render_world.js
// restated -520 / 1100 / 30 by hand and hangar.js invented a third, unrelated
// strip off the garage door. Three copies of one runway, and the garage's copy
// pointed the wrong way.
//
// What IS here is the half the registry has no field for — where the buildings,
// the paving and the furniture stand — plus the ONE frame conversion between
// the world and the shed's own local frame. Both scenes read this file, so
// there is one place to change the aerodrome and no way for them to disagree.
//
// FRAMES. The world is x/z with the runway along x at z = 0. The shed is drawn
// in its own frame: long axis x, doors at -x, HD deep and HW wide (hangar.js).
// Standing it beside the strip near the +x threshold with its doors facing the
// runway is position (42, 62) and rotation.y = -PI/2, which gives
//
//     local -> world :  W = ( Hx - pz ,  py ,  Hz + px )
//     world -> local :  px = Wz - Hz ,   pz = Hx - Wx
//
// so local -x (out of the door) is world -z, straight at the strip, and the
// shed's 30 m frontage lies ALONG the runway. That is the whole reason the
// garage's outdoors now shows the strip crossing the view instead of pointing
// down it: the hangar was always meant to be beside the runway, not on it.
//
// EVERYTHING HERE MUST LIE INSIDE THE FLAT PAD — x in [-1180, 130], |z| < 90 —
// where 20_world.js's h0 multiplies terrain by exactly zero. Every y = 0 in
// both scenes depends on it, and GATE SITE asserts it, because an item nudged
// past |z| = 90 does not fail: it floats, slightly, forever.
// THE REGISTRY (HANGARS S5). One site per AUTHORED aerodrome, keyed by the
// registry id. HOME is the record this file always held, verbatim and
// unmoved; a meadow has no site — that is what a meadow is — and granting
// one later (P6) is a value landing in a slot, not a schema change. The
// generated A-strips never key a site: their ids are seed-dependent, and a
// site keyed on one would silently detach under a different seed (gated).
const AIRFIELD_SITES = {
  HOME: {

    // THE SHED. dims mirror hangar.js's own defaults (HW 15, HD 12.5, EAVE 7.0);
    // the exterior build is handed these so the world's building and the room you
    // stand in are the same size by construction, not by coincidence.
    hangar: { x: 42, z: 62, ry: -Math.PI / 2, HW: 15, HD: 12.5, EAVE: 7.0 },

    // THE APRON, re-declared. The old decal was 66 x 24 centred at (44, 48),
    // which was fine under a 15 x 10 box and wrong under the real shed: the shed
    // occupies z 49.5..74.5, so ten metres of that apron ran UNDER the building.
    // It now stops at the door line and reaches west far enough to feed the
    // taxiway. z1 laps 0.5 m into the doorway so there is no seam at the sill.
    apron: { x0: 8, x1: 66, z0: 30, z1: 50 },

    // THE TAXIWAY, which in the old layout did not touch the runway: it sat at
    // x 32.5..47.5, fifteen metres BEYOND the threshold at x = 30, joined to
    // nothing. It now runs from the apron's west end down to the strip and meets
    // it inside its own length, which is what a backtrack entry looks like.
    taxiway: { x0: 8, x1: 24, z0: 15, z1: 30 },

    // THE BOUNDARY, with the gate the taxiway needs — the old fence ran straight
    // across it. Two runs, posts every `step`, either side of the opening.
    fence: { z: 26, h: 1.1, step: 6, runs: [[-80, 4], [28, 60]] },

    windsock: { x: -30, z: 20, h: 6 },

    // the neighbours, still boxes: a clubhouse and a second shed. Both clear the
    // real hangar's footprint (x 27..57, z 49.5..74.5) and the apron.
    buildings: [
      { x: 16, z: 54, w: 6.5, d: 5.5, h: 2.8, ry: -0.09, trim: true },
      { x: 66, z: 70, w: 12,  d: 8.5, h: 3.9, ry: 0.16 },
    ],

    // the windbreak behind the sheds. Pulled in from z 88..91 to 84: the old line
    // sat ON the pad's 90 m edge, where the terrain is not quite zero any more.
    trees: { z: 84, x0: 4, x1: 96, step: 8.5, r: 1.5, h: 6.2 },

    clutter: {
      drums: [[28, 44.5], [28.8, 45.4], [29.6, 44.2]],
      drumDown: [30.6, 45.6],
      crates: [[60, 52, 0], [61.2, 52.4, 0.4]],
      crateTop: [60.2, 52.1, 0.2],
      // straw, off the west end. Also pulled inside |z| < 90.
      bales: [[-40, 82, 0.3], [-35, 85, 1.1], [-46, 86, 2.0], [-30, 80, 0.7]],
      // tie-downs, all three ON the apron. One of the old three was at (43, 52),
      // which is inside the real shed — a ring in the floor of the building.
      rings: [[34, 42], [50, 42], [42, 36]],
    },

    // WHERE AN AEROPLANE STANDS when it is wheeled out of the shed: on the apron,
    // nose out, quartered to the strip. **WIRED AT G151** — the roll-out places
    // here now. HOME.spawn is untouched and still means what it always meant:
    // it is the W10 spawn identity every flying gate departs from, and moving it
    // would move every take-off measurement in the battery. The taxi below ENDS
    // on the centreline, so the datum keeps its meaning.
    // hdg is the direction the aeroplane FACES, in the aerodrome convention
    // (nose = (cos hdg, sin hdg) — HOME's own pi gives the -x runway heading).
    // IT NOW FACES THE WAY OUT, and that is a fix, not a preference. The old
    // `Math.PI - 0.62` pointed the nose at (-0.81, +0.58) — up the apron
    // TOWARDS THE SHED at z 62 — so the first thing the aeroplane had to do
    // was turn 67 degrees from a standstill. Measured, it could not: the
    // rudder sat pinned at its -0.45 clamp for the whole taxi while the
    // aeroplane scrubbed round at 0.15 m/s, taking 228 s to cover 108 m and
    // arriving through the fence. A tyre being dragged sideways eats the whole
    // thrust margin, and turn rate needs the speed the scrub is preventing.
    // Aeroplanes are parked pointing the way they will leave; this one now is.
    // GATE SITE asserts this heading still points at taxiOut[0], so the two
    // cannot drift apart.
    stand: { x: 42, z: 40, hdg: -2.5361 },

    // THE WAY OUT, DECLARED — because it is a property of THIS PLACE and the
    // autopilot cannot see any of it. A straight line from the stand to the
    // centreline crosses the boundary fence: the fence stands at z 26 with runs
    // x -80..4 and x 28..60, so the ONLY way through is the gate between them,
    // which is what the taxiway (x 8..24) exists to use. Measured on the first
    // attempt, an invented straight line crossed z 26 at x = -7 — through the
    // wire, at every lead value that also gave LINEUP a shallow enough
    // intercept to work with.
    // So the points are stated, in order, from the stand to the centreline:
    // west along the apron and south through the gate, then a long shallow
    // entry that puts the aeroplane inside LINEUP's own 8 m gate when it
    // arrives (measured 4.9 m) with 990 m of strip left in front of it.
    // A site with no `taxiOut` falls back to the pilot's computed entry, which
    // is correct wherever there is nothing to drive around.
    taxiOut: [[16, 22], [-80, 0]],
  },
  M1: null,
  M2: null,
  M3: null,
};

// a registry with a default is a rename, not a migration (HANGARS §6)
function siteOf(id) { return AIRFIELD_SITES[id || 'HOME'] || null; }

// THE DEFAULT SITE, kept forever: this one line keeps every `|| ...hangar`
// fallback below byte-identical and any console muscle-memory working. New
// code says siteOf(id); GATE SITE asserts this identity cannot drift.
const AIRFIELD_SITE = AIRFIELD_SITES.HOME;

// THE FLAT PAD, quoted from 20_world.js's h0 so the gate can assert against the
// same numbers the terrain actually uses. Inside this box terrain is exactly 0.
const AIRFIELD_PAD = { x0: -1180, x1: 130, zAbs: 90 };

// ---- the frame conversion, both ways --------------------------------------
// One rotation, written out rather than composed, because a THREE.js matrix is
// not available to the core and a sign error here puts the runway behind the
// shed. Verified by round-trip in GATE SITE.
function siteToLocal(x, z, H) {
  const h = H || AIRFIELD_SITE.hangar;
  return { x: z - h.z, z: h.x - x };
}
function siteToWorld(px, pz, H) {
  const h = H || AIRFIELD_SITE.hangar;
  return { x: h.x - pz, z: h.z + px };
}

// ---- the runway, DERIVED from the registry record -------------------------
// Everything a scene needs to draw the strip and its markings, computed from
// {x, z, hdg, len, wid} so that no consumer restates them. `end0` is the end
// the take-off run STARTS from (hdg points down the run), which for HOME is the
// +x end — the one the hangar stands beside.
function siteRunway(home) {
  const dx = Math.cos(home.hdg), dz = Math.sin(home.hdg);
  const hl = home.len / 2, hw = home.wid / 2;
  // the threshold bars, and a quarter of the distance between them
  const R0x = home.x - dx * (hl - 5), R0z = home.z - dz * (hl - 5);
  const R1x = home.x + dx * (hl - 5), R1z = home.z + dz * (hl - 5);
  const aimIn = (home.len - 10) / 4;
  return {
    cx: home.x, cz: home.z, hdg: home.hdg, len: home.len, wid: home.wid,
    dx: dx, dz: dz,
    nx: -dz, nz: dx,                                  // across the strip
    end0: { x: home.x - dx * hl, z: home.z - dz * hl },
    end1: { x: home.x + dx * hl, z: home.z + dz * hl },
    // the painted threshold bars sit 5 m inside each end, as they were drawn
    thr0: { x: R0x, z: R0z },
    thr1: { x: R1x, z: R1z },
    // THE PAINTED AIMING POINTS AND THE REGISTRY'S tdz ARE TWO DIFFERENT
    // THINGS, and the old comment at render_world.js:1184-1188 said they were
    // one ("the registry's tdz is exactly this point"). They are not: the
    // paint sits a quarter of the THRESHOLD-TO-THRESHOLD distance in from each
    // bar — 1090 / 4 = 272.5, so 25 - 272.5 = -247.5 — while HOME.tdz is
    // [-450, 0], the autopilot's landing-frame origin (40_autopilot.js:58-65,
    // "origin places tdz at s = -450"), hand-tuned and not on the len/4 rule
    // at all. Deriving them from one number would move the aiming point 200 m
    // or move every fiche's tuned approach. So both are carried, named apart.
    aim0: { x: R0x + dx * aimIn, z: R0z + dz * aimIn },
    aim1: { x: R1x - dx * aimIn, z: R1z - dz * aimIn },
    tdz: { x: home.tdz ? home.tdz[0] : home.x, z: home.tdz ? home.tdz[1] : home.z },
    half: hw,
    markerOff: hw + 0.5,          // edge boards, just outside the mown edge
    markerStep: 70,
  };
}

// the edge marker boards, as world positions — one pair every markerStep from
// end0 toward end1, sized off the record rather than counted out by hand.
function siteMarkers(home) {
  const R = siteRunway(home), out = [];
  for (let t = 5; t <= R.len - 5; t += R.markerStep)
    for (const s of [1, -1])
      out.push({ x: R.end0.x + R.dx * t + R.nx * s * R.markerOff,
                 z: R.end0.z + R.dz * t + R.nz * s * R.markerOff });
  return out;
}


// ---- the strip's markings, painted once for both scenes --------------------
// A 2D context and the runway record; no THREE, no DOM beyond the context's own
// methods, so this stays in core beside the numbers it is drawing.
//
// It lives here rather than in either renderer because the two scenes now show
// the SAME strip: the world lays this canvas over 1100 m of it, and the garage
// sees the first 300 m of it through a hangar door forty metres away. A second
// copy of the recipe would drift the moment either one was touched, which is
// the whole failure this file exists to end.
//
// The layout is in the RUNWAY's own frame — `t` along it from end1, `a` across
// it — so a strip of another length or heading paints itself correctly.
// `marks` paints ONLY the paint - transparent everywhere else - so the strip
// can be a scanned grass surface with its markings laid over it instead of a
// picture of grass with markings drawn into it. The mowing stripes go translucent
// in that mode: they are a difference in cut, not a difference in colour.
function sitePaintStrip(q, R, RW, RH, marks) {
  const U = t => t / R.len * RW, V = a => (a + R.wid / 2) / R.wid * RH;
  const UW = w => w / R.len * RW, VW = w => w / R.wid * RH;
  const sOf = P => (P.x - R.end1.x) * -R.dx + (P.z - R.end1.z) * -R.dz;
  if (marks) q.clearRect(0, 0, RW, RH);
  else { q.fillStyle = '#6b7a36'; q.fillRect(0, 0, RW, RH); }
  q.globalAlpha = marks ? 0.20 : 1;
  for (let i = 0; i < 7; i++) {                      // mowing stripes
    q.fillStyle = i % 2 ? '#77873b' : '#5f6f2c';
    q.fillRect(0, V(-10.5 + i * 3.5 - 1.7), RW, VW(3.4));
  }
  q.globalAlpha = 1;
  q.fillStyle = '#8e9a55';                           // edge lines
  for (const sg of [1, -1]) q.fillRect(0, V(sg * (R.half - 2.5) - 0.45), RW, VW(0.9));
  q.fillStyle = '#e9e4d6';                           // threshold bars
  for (const T of [R.thr0, R.thr1]) for (let k = 0; k < 5; k++)
    q.fillRect(U(sOf(T) - 4.5), V(-8 + k * 4 - 0.75), UW(9), VW(1.5));
  q.fillStyle = '#d9d3c0';                           // centre dashes
  for (let t = 25.5; t < R.len - 25; t += 29)
    q.fillRect(U(t - 5.5), V(-0.3), UW(11), VW(0.6));
  // TOUCHDOWN MARKERS (G107): the aiming point, a quarter of the way in from
  // each threshold — one per landing direction, the way a real runway wears
  // them. NOT the registry's tdz; see the note on aim0/aim1 above.
  q.fillStyle = '#efe9da';
  for (const A of [R.aim0, R.aim1]) for (const zz of [-6.5, 4])
    q.fillRect(U(sOf(A) - 9), V(zz), UW(18), VW(2.5));
}

// is (x, z) on the flat pad, where y = 0 is exact?
function siteOnPad(x, z) {
  return x >= AIRFIELD_PAD.x0 && x <= AIRFIELD_PAD.x1 &&
         Math.abs(z) <= AIRFIELD_PAD.zAbs;
}

// ---- the flat ground, PER AERODROME (HANGARS S5) --------------------------
// HOME sits on the h0 pad (the box above). A meadow is exactly its own
// height inside 0.45 of its radius — quoted from 20_world.js's blendM,
// `sstep(m.r * 0.45, m.r, d)`, the same way AIRFIELD_PAD quotes h0 — so a
// granted meadow site's buildings must stand inside that circle or they
// float, slightly, forever. The A-strips are graded by AERO with their own
// feather; a site never keys one (seed-dependent ids), so no branch for
// them is pretended here.
function siteOnFlat(aero, x, z) {
  if (!aero) return false;
  if (aero.kind === 'meadow')
    return Math.hypot(x - aero.x, z - aero.z) <= aero.r * 0.45;
  return siteOnPad(x, z);
}

// the shed's footprint in the world, from its own dims — used by the gate to
// prove nothing is paved under the building, and by the world scene to keep
// the neighbours clear of it.
function siteHangarBox(H) {
  const h = H || AIRFIELD_SITE.hangar;
  return { x0: h.x - h.HW, x1: h.x + h.HW, z0: h.z - h.HD, z1: h.z + h.HD };
}
// ===========================================================================
// THE FIT-OUT — what a hangar IS, what is IN it, and what you can DO there.
// ===========================================================================
// HANGARS.md's rule in one line: a hangar is three separable things — a SHELL,
// a FIT-OUT and a set of CAPABILITIES — and the whole design is in refusing to
// collapse them into one "level". This file is all three declarations plus the
// placement engine, and it is a CORE file on purpose: nothing in placement
// needs THREE. Prop footprints come from PROP_REG (51_prop_codec.js), the
// aeroplane's box is measured by the CALLER (app.js already did for the mobile
// kit), and positions are arithmetic on HW/HD/EAVE — so GATE HANGAR proves
// "every kit places into every shell, or reports" in plain node, and hangar.js
// is left with the one job only it can do: standing meshes at the answers.
//
// THE CONVERSION IS AN IDENTITY, NOT A REDESIGN. hangar.js's layout was
// composed against the authored shed — HD 13, HW 18 — and scaled through
// FX = v*HD/13, FZ = v*HW/18. A site row here says the same thing as a
// fraction: x = -HD + along*2HD with along = (a+13)/26 IS FX(a), at every
// dims, forever. The HF_A()/HF_B()/HF_PF() helpers below keep the authored coordinate
// visible in the table so the two forms can be compared by eye. The one
// deliberate change: the back-wall run was authored UNSCALED (raw z for
// HW 18), which at today's default HW 15 put the welding cart AT the wall
// (z = 15.0) and a drum OUTSIDE it (z = -15.4). Converting by the AUTHORED
// width moves that run to its authored intent — inside the room.
// ===========================================================================

// ---- THE SHELLS -----------------------------------------------------------
// What the building IS: a structure family plus dimension DEFAULTS. Not a
// score, and not a limit — the size sliders keep working and simply start
// from the class (same ruling as the aeroplane's: derivation is the
// engineer's handbook, never a guardrail). `lims` is the envelope the sliders
// offer PER SHELL, because a timber field shed's 3.6 m eave is below the
// steel shed's old floor of 4.2. Dims are HALF width / HALF depth, like
// hangar.js's own (a 30 x 25 m club shed is HW 15, HD 12.5).
//
// `price` is credits, declared so the record has its shape — nothing charges
// it yet (the ledger records, it does not gate; joining the wallet is P5).
// `skin` is a DEFAULT dress per PART into hangar.js's LIB, applied before the
// player's own overrides so their choices always win.
// `sky` is the HDRI FAMILY this shed's moods are graded from — the user's
// association point (2026-08-31: "associate a shed with an hdri, but for
// now, we use alps for all sheds"). Today every mood row in HANGAR_SKIES is
// a grading of the one alps panorama, so 'alps' everywhere IS the current
// truth; keying the mood set off this field is the later chantier.
const SHELLS = {
  club: {
    name: 'Club hangar', frame: 'portal', doors: 'sixLeaf',
    dims: { HW: 15, HD: 12.5, EAVE: 7.0 },
    lims: { HW: [7, 24], HD: [6, 20], EAVE: [4.2, 11] },
    skin: null, sky: 'alps', price: 0, status: 'live',
  },
  works: {
    name: 'Works', frame: 'portal', doors: 'sixLeaf',
    dims: { HW: 20, HD: 20, EAVE: 9.5 },
    lims: { HW: [10, 24], HD: [10, 26], EAVE: [6.0, 12] },
    // BRICK, AND BIG (user, 2026-09-01: "the works one should rather have the
    // brick texture, double size from the original, full roughness and +50%
    // normal"). `tile` is METRES PER TILE, so double the size is 4 m off the
    // wall sets' own 2; `rough` and `nrm` are the same multipliers the shed
    // sheet's sliders write, so full roughness is that slider's ceiling of 2
    // (a roughness map is a MULTIPLICAND — 1 leaves it as baked) and +50%
    // normal is 1.5. app.js defaults both to 1 for any row that omits them.
    skin: {
      wallSides: { set: 'sandstone', tile: 4, rough: 2, nrm: 1.5 },
      wallBack:  { set: 'sandstone', tile: 4, rough: 2, nrm: 1.5 },
      roof:      { set: 'factory', tile: 2 },
      stem:      { set: 'concrete008', tile: 2 },
    },
    sky: 'alps', price: 15000, status: 'live',
  },
  field: {
    // Half-dims like every other row (club's row IS today's shed verbatim,
    // and one column cannot switch units per row): a 14 x 18 m timber shed
    // at a 3.6 m eave. CONFIRMED by the user 2026-08-31 ("yes half-dims
    // is right") — the spec's "7 x 9" prose read as full metres, but a
    // genuinely 7 m wide shed passes no wing this generator builds.
    name: 'Field shed', frame: 'timber', doors: 'slidingLeaf',
    dims: { HW: 7, HD: 9, EAVE: 3.6 },
    lims: { HW: [4, 10], HD: [5, 12], EAVE: [3.0, 4.8] },
    skin: {
      wallSides: { set: 'rawplank', tile: 2 },
      wallBack:  { set: 'rawplank', tile: 2 },
      roof:      { set: 'rustysheet', tile: 2 },
    },
    sky: 'alps', price: 6000, status: 'live',
  },
};
function shellLims(key) {
  return (SHELLS[key] || SHELLS.club).lims;
}

// ---- THE CAPABILITIES -----------------------------------------------------
// A capability is a VERB, derived from the fit-out — you can weld because
// there is a welding kit, not because the hangar says level 3. Declared and
// ADVISORY ONLY: gating what a player may build on where they are standing is
// a P5 decision with the economy beside it.
const HANGAR_CAPS = ['park', 'handwork', 'wood', 'tube', 'metal', 'composite',
                     'engine', 'avionics', 'paperwork', 'store', 'handling',
                     'warm', 'heavy'];

// ---- THE KITS -------------------------------------------------------------
// The kit is the record (HANGARS.md §4.1): a workbench belongs to the bench
// kit, so "what does the wood kit contain" is answered by reading ONE row,
// not by scanning 44. props_table.py's `group` is untouched — that is the
// EDITOR's display axis and it is doing that job correctly; kits are a
// second, orthogonal axis.
//
// Each kit:
//   props    the CLAIM list. Every key in props_table.py is claimed by
//            exactly one kit (GATE HANGAR rule 4) — plus `wip` claiming the
//            two baked Jodel airframes from jodel_prep.py's table.
//   sites    where the kit stands its props. A site may REFERENCE another
//            kit's prop (the cosy corner borrows a stool; a crate rides a
//            storage cart) — rule 3 checks references, rule 4 counts claims.
//   recipes  drawn compounds (hangar.js's DRAW map): a loaded rack, a tyre
//            stack, the stove corner. Declared here with explicit metre
//            footprints so the gate can pack them and see their props.
//   ring     rows for the aircraft clearance ring (the old mobile kit).
//   grants   the verbs this kit earns.
//
// SITE ROW: { prop|recipe, at, along|fx/fz, out, dry, y?, on?, light?, n? }
//   at     'shop' (z=+HW wall), 'build' (z=-HW wall), 'back' (x=+HD wall),
//          'floor' (fractional), 'ring' is its own list.
//   along  0..1 fraction along the wall (door corner -> back corner for the
//          side walls, port corner -> starboard corner for the back wall).
//   out    REAL metres off the wall plane — clearances never scale: the
//          bench stands a metre off the wall in any shed (hangar.js's own
//          rule, kept).
//   fx/fz  floor position as fractions of HD/HW.
//   dry    absolute heading, exactly as authored.
//   y      rest height for things standing on other things — measured off
//          decoded geometry (hangar.js's TOP table), inlined per site.
//   on     the prop key this one stands on; unplaced with a reason when the
//          carrier did not place. Sites with y/on skip the wall packing —
//          they occupy someone else's footprint by design.
//   light  a lamp switch key: hangar.js claim()s the placed prop into that
//          switch (the desk lamp's emitter must stay switchable).
//
// HF_A() and HF_B() turn an AUTHORED coordinate into its fraction — HF_A for
// the side walls (authored HD 13 frame), HF_B for the back wall (authored
// HW 18 frame). Namespaced: these ride the page's shared global scope.
const HF_A = v => (v + 13) / 26;          // side walls: authored x -> along
const HF_B = v => (v + 18) / 36;          // back wall:  authored z -> along
const HF_PF = (v, s) => v / s;            // floor: authored coord -> fraction

const HANGAR_KITS = {
  park: {
    name: 'Bare shed', grants: ['park'],
    props: [], sites: [], recipes: [], ring: [],
  },

  bench: {
    name: 'Workbench', grants: ['handwork'],
    props: ['workbench_wood', 'vice_bench', 'stool_wood', 'toolrack_wall',
            'toolbox_open', 'toolchest_metal'],
    sites: [
      { prop: 'workbench_wood', at: 'shop', along: HF_A(-5.0), out: 1.00, dry: Math.PI },
      { prop: 'vice_bench', at: 'shop', along: HF_A(-5.95), out: 1.10,
        dry: Math.PI * 0.5, y: 0.96, on: 'workbench_wood' },
      { prop: 'toolbox_open', at: 'shop', along: HF_A(-4.25), out: 1.00,
        dry: Math.PI - 0.35, y: 0.96, on: 'workbench_wood' },
      { prop: 'toolrack_wall', at: 'shop', along: HF_A(-5.0), out: 0.12,
        dry: Math.PI, y: 1.62 },
      { prop: 'toolrack_wall', at: 'build', along: HF_A(2.6), out: 0.12,
        dry: 0, y: 1.62 },
      { prop: 'stool_wood', at: 'shop', along: HF_A(-3.2), out: 2.10, dry: 0.6 },
      { prop: 'stool_wood', at: 'build', along: HF_A(2.4), out: 1.95, dry: -0.4 },
      { prop: 'toolchest_metal', at: 'shop', along: HF_A(7.3), out: 0.95,
        dry: Math.PI + 0.12 },
      { prop: 'toolchest_metal', at: 'build', along: HF_A(0.5), out: 0.85, dry: 0.15 },
    ],
    recipes: [],
    ring: [
      // the toolbox stood ON the handling kit's tool cart (same station, same
      // dx); the cart was dropped 2026-09-01 and its rider goes with it
      { prop: 'toolchest_metal', station: 'abeamS', dx: 0.8, dz: 0.15,
        dry: Math.PI / 2 + 0.22 },
    ],
  },

  wood: {
    name: 'Woodshop', grants: ['wood'],
    props: ['bandsaw', 'panelsaw', 'thicknesser', 'jointer',
            'crate_wood_a', 'crate_wood_b', 'crate_wood_c'],
    sites: [
      // the machine run, in the order the timber goes through them (G66):
      // spaced by measurement against the authored wall, and the spacing
      // survives as fractions of it
      { prop: 'bandsaw', at: 'build', along: HF_A(-6.19), out: 1.16, dry: 0 },
      { prop: 'jointer', at: 'build', along: HF_A(-3.53), out: 1.38, dry: 0 },
      { prop: 'thicknesser', at: 'build', along: HF_A(-1.00), out: 0.93, dry: 0 },
      // the panel saw stands OFF the wall — the one machine you cannot use
      // against one; its `out` IS the sheet clearance plus the walkway
      { prop: 'panelsaw', at: 'build', along: HF_A(-4.30), out: 5.20, dry: 0 },
      // the timber stock: crate stacks at the door end of the build wall
      { prop: 'crate_wood_c', at: 'build', along: HF_A(-11.6), out: 3.6, dry: 0.15 },
      { prop: 'crate_wood_a', at: 'build', along: HF_A(-11.6), out: 3.6,
        dry: -0.20, y: 0.41, on: 'crate_wood_c' },
      { prop: 'crate_wood_b', at: 'build', along: HF_A(-11.8), out: 4.7, dry: 0.35 },
      { prop: 'crate_wood_a', at: 'build', along: HF_A(-10.8), out: 6.6, dry: -0.3 },
      { prop: 'crate_wood_c', at: 'build', along: HF_A(-11.5), out: 7.6, dry: 0.5 },
      // ...and the pair against the back wall
      { prop: 'crate_wood_c', at: 'back', along: HF_B(-10.6), out: 1.10,
        dry: Math.PI / 2 + 0.1 },
      { prop: 'crate_wood_b', at: 'back', along: HF_B(-11.7), out: 1.05,
        dry: Math.PI / 2 - 0.2 },
    ],
    recipes: [],
    ring: [],
  },

  metal: {
    name: 'Metalshop', grants: ['metal', 'tube'],
    props: ['weldingcart', 'compressor', 'drillpress', 'rack_steel',
            'drum_steel'],
    sites: [
      { prop: 'weldingcart', at: 'back', along: HF_B(15.0), out: 1.15,
        dry: -Math.PI / 2 - 0.20 },
      { prop: 'compressor', at: 'back', along: HF_B(6.2), out: 1.25,
        dry: -Math.PI / 2 },
      { prop: 'drillpress', at: 'build', along: HF_A(7.4), out: 0.95, dry: 0.10 },
      { prop: 'drum_steel', at: 'back', along: HF_B(-14.6), out: 0.95, dry: 0.5 },
      { prop: 'drum_steel', at: 'back', along: HF_B(-15.4), out: 0.95, dry: -0.3 },
    ],
    recipes: [
      // the loaded racks: rack_steel plus a seeded scatter of shelf stock —
      // drawn in hangar.js, declared here so the gate sees every prop a
      // shelf can carry and every footprint a wall must fit
      { recipe: 'loadedRack', at: 'shop', along: HF_A(1.5), out: 0.55,
        dry: Math.PI, foot: [0.5, 0.33],
        props: ['rack_steel', 'box_cardboard', 'crate_wood_a', 'jerrycan',
                'instrument_panel'] },
      { recipe: 'loadedRack', at: 'shop', along: HF_A(2.6), out: 0.55,
        dry: Math.PI, foot: [0.5, 0.33],
        props: ['rack_steel', 'box_cardboard', 'crate_wood_a', 'jerrycan',
                'instrument_panel'] },
      { recipe: 'loadedRack', at: 'shop', along: HF_A(3.7), out: 0.55,
        dry: Math.PI, foot: [0.5, 0.33],
        props: ['rack_steel', 'box_cardboard', 'crate_wood_a', 'jerrycan',
                'instrument_panel'] },
      { recipe: 'loadedRack', at: 'build', along: HF_A(-1.2), out: 0.55,
        dry: 0, foot: [0.5, 0.33], loose: true,
        props: ['rack_steel', 'box_cardboard', 'crate_wood_a', 'jerrycan',
                'instrument_panel'] },
      { recipe: 'loadedRack', at: 'build', along: HF_A(-2.3), out: 0.55,
        dry: 0, foot: [0.5, 0.33], loose: true,
        props: ['rack_steel', 'box_cardboard', 'crate_wood_a', 'jerrycan',
                'instrument_panel'] },
    ],
    ring: [],
  },

  store: {
    name: 'Stores', grants: ['store'],
    props: ['box_cardboard', 'barrel_plastic', 'bin_metal', 'bin_metal_rust',
            'jerrycan', 'bottle_lpg', 'bottle_propane'],
    sites: [
      { prop: 'box_cardboard', at: 'shop', along: HF_A(-2.1), out: 1.00,
        dry: 0.4, y: 0.68, on: 'table_wood' },
      { prop: 'jerrycan', at: 'shop', along: HF_A(-0.9), out: 1.85, dry: 0.8 },
      { prop: 'box_cardboard', at: 'shop', along: HF_A(5.4), out: 1.10,
        dry: 0.3, y: 1.28, on: 'cart_storage' },
      { prop: 'bottle_lpg', at: 'shop', along: HF_A(9.9), out: 0.85, dry: 0.5 },
      { prop: 'barrel_plastic', at: 'build', along: HF_A(9.0), out: 0.85, dry: 0 },
      { prop: 'bin_metal', at: 'build', along: HF_A(10.2), out: 0.90, dry: 0.3 },
      // the door-end cardboard, stacked (a box on a box is a `y` + `on`)
      { prop: 'box_cardboard', at: 'build', along: HF_A(-10.7), out: 3.9, dry: 0.8 },
      { prop: 'box_cardboard', at: 'build', along: HF_A(-10.8), out: 3.95,
        dry: -0.4, y: 0.34, on: 'box_cardboard' },
      { prop: 'box_cardboard', at: 'build', along: HF_A(-11.4), out: 6.0, dry: 0.1 },
      { prop: 'box_cardboard', at: 'build', along: HF_A(-11.5), out: 6.05,
        dry: 1.2, y: 0.34, on: 'box_cardboard' },
      // gas and fuel on the back wall
      { prop: 'bottle_propane', at: 'back', along: HF_B(13.9), out: 0.85, dry: 0.4 },
      { prop: 'bottle_propane', at: 'back', along: HF_B(13.2), out: 0.90, dry: -0.9 },
      { prop: 'bottle_lpg', at: 'back', along: HF_B(13.6), out: 1.65, dry: 0.2 },
      { prop: 'barrel_plastic', at: 'back', along: HF_B(-15.0), out: 1.75, dry: 0 },
      { prop: 'jerrycan', at: 'back', along: HF_B(-13.9), out: 1.9, dry: 0.9 },
      { prop: 'jerrycan', at: 'back', along: HF_B(-14.2), out: 2.3, dry: -0.4 },
      { prop: 'bin_metal', at: 'back', along: HF_B(-3.2), out: 1.05, dry: 0.3 },
      { prop: 'bin_metal_rust', at: 'back', along: HF_B(-4.2), out: 1.05, dry: -0.5 },
    ],
    recipes: [
      // ry = PI, not -PI/2: the long stock lies along local z (the authored
      // lesson, kept with the row). And HF_B(-10.2), not HF_B(-8.5): the /36
      // conversion walks the whole back run inboard, and the rack's ten
      // metres of tube and spruce is the one thing on it that must not walk
      // into the aircraft bay — at the club's own width this lands it at
      // z = -8.5, byte-identical to the authored room.
      { recipe: 'stockRack', at: 'back', along: HF_B(-10.2), out: 1.6,
        dry: Math.PI, foot: [0.46, 5.3], loose: true, props: [] },
    ],
    ring: [
      { prop: 'jerrycan', station: 'nose', dx: 0.5, dz: 0.7, dry: 0.8 },
    ],
  },

  handling: {
    name: 'Handling', grants: ['handling'],
    props: ['handtruck', 'stepladder', 'work_trestle', 'cart_tool',
            'cart_tool_cab', 'cart_storage'],
    sites: [
      { prop: 'cart_storage', at: 'shop', along: HF_A(5.7), out: 1.10,
        dry: Math.PI + 0.08 },
      { prop: 'cart_tool_cab', at: 'shop', along: HF_A(8.7), out: 0.95,
        dry: Math.PI - 0.08 },
      { prop: 'handtruck', at: 'shop', along: HF_A(10.8), out: 0.55,
        dry: Math.PI + 0.15 },
      { prop: 'stepladder', at: 'build', along: HF_A(-8.6), out: 3.9, dry: 0.5 },
      { prop: 'stepladder', at: 'floor', fx: HF_PF(-11.9, 13),
        fz: HF_PF(11.6, 18) - 1, dry: 1.4 },
    ],
    // THE ROLLING PLATFORM AND THE TOOL CART ARE CLAIMED AND UNPLACED
    // (user, 2026-09-01: "too many props ... drop the echaffaudage mobile,
    // the desserte avec boite a outils"). The claim stays so the kit still
    // partitions the furniture table; what went is the two workPlatform
    // recipes and the cart's ring row — with the cart gone the toolbox that
    // rode on it at y 0.90 went with it, over in the bench kit, because a
    // rider without its carrier is a box hanging in the air.
    recipes: [],
    ring: [
      { prop: 'stepladder', station: 'abeamP', dx: 0.4, dz: 0,
        dry: -Math.PI / 2 + 0.3 },
      { prop: 'handtruck', station: 'nose', dx: 0, dz: 0, dry: 1.9 },
    ],
  },

  office: {
    name: 'Office corner', grants: ['avionics', 'paperwork'],
    props: ['desk_metal', 'radio_bench', 'instrument_panel', 'lamp_desk',
            'plan_wall'],
    sites: [
      { prop: 'desk_metal', at: 'build', along: HF_A(2.6), out: 0.90, dry: 0 },
      { prop: 'lamp_desk', at: 'build', along: HF_A(3.35), out: 1.15,
        dry: -0.55, y: 0.78, on: 'desk_metal', light: 'desk' },
      { prop: 'instrument_panel', at: 'build', along: HF_A(1.95), out: 1.05,
        dry: 0.35, y: 0.78, on: 'desk_metal' },
      // the radio lives on the WORKBENCH, which is the bench kit's — an
      // office without a bench keeps its radio boxed
      { prop: 'radio_bench', at: 'shop', along: HF_A(-3.95), out: 1.05,
        dry: Math.PI + 0.25, y: 0.96, on: 'workbench_wood' },
      // THE PLAN GOES WHERE THE LIGHT IS. `y` is the PIN height — the sheet
      // hangs BELOW the origin (1.30..2.35 m), which is why a wall prop keeps
      // its delivered origin at all. `along` is the MIDDLE BAY, and it was
      // measured, not chosen: only one of the five pendants is anywhere near
      // this wall (LAMP_XZ's [0, 9.5], which lands at x 0, z 7.9), so lamp
      // luminance on the sheet reads 0 out at the door end, 53 at x -3.97,
      // 187 in this bay and 238 dead centre. Dead centre is a portal post —
      // they stand at x = ±3.97k, 0.34 m wide, and proud of the skin the
      // sheet lies on — so the bay beside it takes 79% of the best light
      // with nothing in front of it. The posts and this fraction both scale
      // with HD, so it stays bay-centred in any shed.
      { prop: 'plan_wall', at: 'shop', along: HF_A(-2.06), out: 0.12,
        dry: Math.PI, y: 2.35 },
    ],
    recipes: [
      { recipe: 'planTable', at: 'floor', fx: HF_PF(-9.2, 13), fz: HF_PF(8.4, 18),
        dry: 0.4, foot: [0.8, 0.55], props: [] },
    ],
    ring: [],
  },

  comfort: {
    name: 'Comfort', grants: ['warm'],
    props: ['stove_masonry', 'stove_barrel', 'chair_lounge', 'rug_persian',
            'lamp_pendant', 'hosereel_wall'],
    // lamp_pendant is CLAIMED here and placed by the SHELL: the pendants are
    // the room's light rig, and a room with no light is not a fit-out choice
    // yet — gating the lamps on a kit is P5 content. stove_barrel is claimed
    // and unplaced (it never stood in this room; a site is a later choice).
    sites: [
      { prop: 'rug_persian', at: 'floor', fx: HF_PF(8.6, 13), fz: HF_PF(13.8, 18),
        dry: 0.30, y: 0.004 },
      { prop: 'chair_lounge', at: 'floor', fx: HF_PF(8.9, 13), fz: HF_PF(13.6, 18),
        dry: 2.35 },
      // the corner borrows a stool, a drum and a barrel from the kits that
      // own them — a tableau, not a claim
      { prop: 'stool_wood', at: 'floor', fx: HF_PF(7.6, 13), fz: HF_PF(12.5, 18),
        dry: 1.1 },
      { prop: 'drum_steel', at: 'floor', fx: HF_PF(9.6, 13), fz: HF_PF(15.9, 18),
        dry: 0 },
      { prop: 'barrel_plastic', at: 'floor', fx: HF_PF(10.6, 13), fz: HF_PF(16.2, 18),
        dry: 0.4 },
      // moved clear of the back doors once already (G66): a wall-mounted
      // prop must never hang on a leaf, and the engine now enforces what
      // that lesson taught by hand
      { prop: 'hosereel_wall', at: 'back', along: HF_B(7.6), out: 0.14,
        dry: -Math.PI / 2, y: 2.20 },
    ],
    recipes: [
      { recipe: 'stoveCorner', at: 'floor', fx: HF_PF(11.1, 13), fz: HF_PF(12.4, 18),
        dry: -0.5, foot: [0.85, 0.85], props: ['stove_masonry'] },
    ],
    ring: [],
  },

  curio: {
    name: 'Curios', grants: [],
    props: ['car_covered', 'tyre', 'table_wood'],
    sites: [
      { prop: 'table_wood', at: 'shop', along: HF_A(-1.7), out: 1.05,
        dry: Math.PI },
      { prop: 'crate_wood_a', at: 'shop', along: HF_A(-1.2), out: 1.05,
        dry: -0.25, y: 0.68, on: 'table_wood' },
      { prop: 'car_covered', at: 'floor', fx: HF_PF(-9.9, 13),
        fz: 1 - HF_PF(5.6, 18), dry: Math.PI / 2 + 0.05 },
    ],
    recipes: [
      { recipe: 'tyreStack', at: 'shop', along: HF_A(-11.3), out: 1.7,
        dry: 0, foot: [0.4, 0.4], n: 4, props: ['tyre'] },
      { recipe: 'tyreStack', at: 'shop', along: HF_A(-12.0), out: 2.6,
        dry: 0, foot: [0.4, 0.4], n: 3, props: ['tyre'] },
      { recipe: 'tyreStack', at: 'shop', along: HF_A(-11.6), out: 3.4,
        dry: 0, foot: [0.4, 0.4], n: 2, props: ['tyre'] },
      { recipe: 'tyreStack', at: 'floor', fx: HF_PF(-11.4, 13),
        fz: HF_PF(8.4, 18) - 1, dry: 0, foot: [0.4, 0.4], n: 3, props: ['tyre'] },
    ],
    ring: [],
  },

  // THE WORK IN PROGRESS, as a kit. HANGARS.md kept the two airframes outside
  // the kit system "because they are not baked props" — which has been stale
  // since G62.10: they ARE baked (tools/jodel_prep.py), placed by the same
  // prop() as the furniture. A display kit fixes what the carve-out broke:
  // rule 4 has no exception list, and a bare park-only shed shows no Jodel.
  // The REAL work-in-progress mechanism — your wing on your trestles — stays
  // a separate chantier (it wants the fleet container first); when it lands
  // it replaces this kit's content, not the kit system.
  wip: {
    name: 'Work in progress', grants: [],
    props: ['airframe_jodel_body', 'airframe_jodel_wing'],
    sites: [],
    recipes: [
      { recipe: 'wipBody', at: 'floor', fx: HF_PF(3.6, 13), fz: HF_PF(-12.2, 18),
        dry: Math.PI + 0.21, foot: [3.1, 0.8],
        props: ['airframe_jodel_body', 'work_trestle'] },
      // hung chord-up on the back doors, deliberately IN the doorway — it is
      // the one thing in the room allowed there (G64: its shadow lands on
      // one flat leaf plane), so it is flagged free of the keepouts
      { recipe: 'wipWingHang', at: 'back', along: HF_B(0), out: 1.7,
        dry: 0, foot: [0.2, 4.6], free: true,
        props: ['airframe_jodel_wing'] },
      { recipe: 'wsWing', at: 'floor', fx: HF_PF(-2.4, 13), fz: HF_PF(12.4, 18),
        dry: 0.05, foot: [4.75, 1.0], props: ['work_trestle'] },
      { recipe: 'wsEngine', at: 'floor', fx: HF_PF(9.2, 13), fz: HF_PF(-6.4, 18),
        dry: -Math.PI / 2 + 0.2, foot: [0.65, 0.65], props: [] },
    ],
    ring: [],
  },
};

// the default fit-out IS today's room: every kit on
const HANGAR_KITS_DEFAULT = ['park', 'bench', 'wood', 'metal', 'store',
                             'handling', 'office', 'comfort', 'curio', 'wip'];

// ---- THE ENGINE -----------------------------------------------------------
// hangarFit(dims, kitKeys) -> { placed, recipes, unplaced } with the one
// invariant this whole mechanism exists for:
//
//     placed.length + recipes.length + unplaced.length
//         === every site row the chosen kits declared.
//
// A kit that does not fit its shell places what it can and REPORTS the rest —
// never silently. A field shed cannot take the full woodshop, and being told
// so is the mechanism working.
//
// v1 fit rules, simplest honest set:
//   1. bounds     the footprint stays inside the walls;
//   2. doorway    a wall-MOUNTED prop (y >= 1) never hangs on a door leaf —
//                 floor props may stand against a closed door, the room
//                 always did that (the bins lean on the back doors today);
//   3. the bay    nothing static intrudes on the aeroplane's slot: the
//                 centre strip |z| <= 2.2 between the door and the back
//                 clearance — that is what strips a panel saw from a shed
//                 too narrow to hold it AND an aeroplane;
//   4. packing    floor-standing wall sites pack per wall in declaration
//                 order — an interval ALONG the wall and a band OUT from it,
//                 because the jerrycan legitimately stands in front of the
//                 table (same wall coordinate, different depth); an overlap
//                 in both is reported, not shuffled.
// Sites with `y`/`on` skip packing (they ride someone else's footprint), and
// `on` itself is checked in a SECOND pass over everything else — nothing
// stands on a prop that did not place, wherever in kit order the carrier
// was declared (the stores' box rides the handling kit's cart).
function hangarFootprint(key, reg) {
  const R = reg || (typeof PROP_REG !== 'undefined' ? PROP_REG : null);
  const p = R && R.props && R.props[key];
  // half-extents; an unknown key gets a modest default so the report stays
  // about the missing prop, not a crash
  return p ? [p.dim[0] / 2, p.dim[2] / 2] : [0.4, 0.4];
}

function hangarFit(dims, kitKeys, opts) {
  const HW = (dims && dims.HW) || 15, HD = (dims && dims.HD) || 12.5;
  const EAVE = (dims && dims.EAVE) || 7.0;
  const BD_W = Math.min(11.0, 2 * HW - 8);        // hangar.js's own derivation
  const reg = opts && opts.reg;
  // whether this shell HAS back-door leaves to keep wall-mounts off: the
  // timber field shed's back wall is boards, and a hose reel may bolt to a
  // board wall — the keepout is about door LEAVES, not about walls
  const shellRec = SHELLS[(opts && opts.shell) || 'club'] || SHELLS.club;
  const hasBackDoors = shellRec.doors === 'sixLeaf';
  const keys = (kitKeys && kitKeys.length ? kitKeys : HANGAR_KITS_DEFAULT)
    .filter(k => HANGAR_KITS[k]);

  const placed = [], recipes = [], unplaced = [];
  const placedKeys = new Set();
  const lanes = { shop: [], build: [], back: [] };  // packed intervals per wall

  const resolve = s => {
    if (s.at === 'shop') return { x: -HD + s.along * 2 * HD, z: HW - s.out };
    if (s.at === 'build') return { x: -HD + s.along * 2 * HD, z: -HW + s.out };
    if (s.at === 'back') return { x: HD - s.out, z: -HW + s.along * 2 * HW };
    return { x: s.fx * HD, z: s.fz * HW };          // floor
  };
  // oriented half-extents: a quarter turn swaps them; anything between is
  // taken at the nearer quarter, which over-covers slightly and that is the
  // right direction for a clearance test
  const orient = (foot, dry) => {
    const q = Math.round((dry || 0) / (Math.PI / 2)) & 1;
    return q ? [foot[1], foot[0]] : [foot[0], foot[1]];
  };

  const fit = (row, kit, isRecipe) => {
    const foot = orient(isRecipe ? row.foot : hangarFootprint(row.prop, reg),
                        row.dry);
    const p = resolve(row);
    const out = { kit, at: row.at, x: p.x, z: p.z, ry: row.dry || 0,
                  y: row.y || 0 };
    if (isRecipe) { out.recipe = row.recipe; out.n = row.n; out.free = !!row.free; }
    else out.prop = row.prop;
    const label = isRecipe ? row.recipe : row.prop;

    // 1. bounds — even a `free` row: free waives the keepouts and the
    // packing (the hung wing is ALLOWED across the doorway), never the
    // walls. A nine-metre wing does not hang on an eight-metre wall.
    if (Math.abs(p.x) + foot[0] > HD || Math.abs(p.z) + foot[1] > HW) {
      unplaced.push({ kit, key: label, at: row.at,
                      reason: 'outside the shell' });
      return;
    }
    if (!row.free) {
      // 2. a wall-mounted prop on the back wall must clear the door leaves
      // (when the shell HAS them — a board wall takes a bolt anywhere)
      if (hasBackDoors && row.at === 'back' && (row.y || 0) >= 1.0 &&
          Math.abs(p.z) - foot[1] < BD_W / 2 + 0.4) {
        unplaced.push({ kit, key: label, at: row.at,
                        reason: 'on the door leaf' });
        return;
      }
      // 3. the aeroplane's slot
      if (Math.abs(p.z) - foot[1] < 2.2 &&
          p.x - foot[0] < HD - 2.0 && p.x + foot[0] > -HD + 2.0) {
        unplaced.push({ kit, key: label, at: row.at,
                        reason: 'blocks the aircraft bay' });
        return;
      }
      // 4. wall packing, floor-standing wall sites only: along x depth.
      // `loose` rows are composed TUCKS — a rack nested behind a
      // thicknesser's outfeed, a platform under a panel saw's outrigger —
      // where the bounding boxes interpenetrate but the author's eye already
      // resolved the geometry. They are declared, not guessed, and they keep
      // every other rule (bounds, doorway, the bay).
      if (lanes[row.at] && !(row.y > 0) && !row.on && !row.loose) {
        const back = row.at === 'back';
        const u = back ? p.z : p.x;
        const iv = [u - foot[back ? 1 : 0], u + foot[back ? 1 : 0]];
        const ov = [row.out - foot[back ? 0 : 1], row.out + foot[back ? 0 : 1]];
        const hit = lanes[row.at].find(o =>
          iv[0] < o.iv[1] && iv[1] > o.iv[0] &&
          ov[0] < o.ov[1] && ov[1] > o.ov[0]);
        if (hit) {
          unplaced.push({ kit, key: label, at: row.at,
                          reason: 'overlaps ' + hit.key });
          return;
        }
        lanes[row.at].push({ iv, ov, key: label });
      }
    }
    if (row.on && !placedKeys.has(row.on)) {
      unplaced.push({ kit, key: label, at: row.at,
                      reason: 'needs ' + row.on });
      return;
    }
    if (row.light) out.light = row.light;
    if (isRecipe) { recipes.push(out); (row.props || []).forEach(k => placedKeys.add(k)); }
    else { placed.push(out); placedKeys.add(row.prop); }
  };

  // two passes: everything standing on the floor or a wall first, then the
  // riders — so a box can ride a cart whichever kit declared the cart
  for (const pass of [0, 1])
    for (const k of keys) {
      for (const s of HANGAR_KITS[k].sites)
        if ((s.on ? 1 : 0) === pass) fit(s, k, false);
      for (const r of HANGAR_KITS[k].recipes)
        if ((r.on ? 1 : 0) === pass) fit(r, k, true);
    }
  return { placed, recipes, unplaced, dims: { HW, HD, EAVE } };
}

// ---- THE RING -------------------------------------------------------------
// placeMobile's arithmetic, verbatim (hangar.js G65): the caller measures the
// aeroplane's footprint in the room's own frame, and the chosen kits' ring
// rows are placed on a clearance ring outside it. lim takes a MAGNITUDE — the
// port side passes HW - 2.2, not its negative: handing it -(HW - 2.2) once
// put the ladder, the sack truck and the jerrycan against the far wall on the
// wrong side, and that lesson keeps its shape here.
function hangarFitRing(dims, kitKeys, bb) {
  if (!bb || !isFinite(bb.x0)) return [];
  const HW = (dims && dims.HW) || 15, HD = (dims && dims.HD) || 12.5;
  const CLR = 1.15;
  const lim = (v, m) => Math.max(-m, Math.min(m, v));
  const zR = lim(Math.max(bb.z1, 0.6) + CLR, HW - 2.2);
  const zL = lim(Math.min(bb.z0, -0.6) - CLR, HW - 2.2);
  const xN = lim(bb.x0 - CLR * 0.7, HD - 2.0);
  const xM = lim((bb.x0 + bb.x1) / 2, HD - 2.0);
  const AT = { abeamS: [xM, zR], abeamP: [xM, zL], nose: [xN, zL * 0.45] };
  const keys = (kitKeys && kitKeys.length ? kitKeys : HANGAR_KITS_DEFAULT)
    .filter(k => HANGAR_KITS[k]);
  const out = [];
  for (const k of keys)
    for (const r of HANGAR_KITS[k].ring) {
      const a = AT[r.station];
      if (!a) continue;
      out.push({ kit: k, prop: r.prop, x: a[0] + r.dx, z: a[1] + r.dz,
                 ry: r.dry, y: r.y || 0 });
    }
  return out;
}

// ---- THE VERBS ------------------------------------------------------------
// Derived, never set. `heavy` comes from the SHELL — the door is the
// generator's own wing clamp seen from outside: max(6, 2HW - 5) >= 14 m of
// opening takes any wing this game can build. Everything else comes from the
// fit-out, which is the split doing its job: a big empty shed lets you park a
// big aeroplane and build nothing.
function hangarCaps(shed) {
  const s = shed || {};
  const shell = SHELLS[s.shell] || SHELLS.club;
  const dims = Object.assign({}, shell.dims, s.dims || {});
  const keys = (s.kits && s.kits.length ? s.kits : []).filter(k => HANGAR_KITS[k]);
  const got = new Set(['park']);
  for (const k of keys) for (const g of HANGAR_KITS[k].grants) got.add(g);
  if (Math.max(6, 2 * dims.HW - 5) >= 14) got.add('heavy');
  // layup wants a warm, clean, enclosed bay — and not a draughty field shed
  if (got.has('warm') && got.has('handwork') &&
      (s.shell || 'club') !== 'field') got.add('composite');
  if (got.has('metal') && got.has('handling')) got.add('engine');
  return HANGAR_CAPS.filter(v => got.has(v));
}

// What an aeroplane WANTS of a hangar, read off its resolved spec's declared
// constructions. Advisory only, forever the engineer's handbook: the editor
// may show the line, nothing may enforce it (P5 owns that ruling).
function hangarWants(S) {
  const want = new Set();
  const add = m => {
    if (m === 'wood') want.add('wood');
    else if (m === 'tubeFabric') want.add('tube');
    else if (m === 'alloy') want.add('metal');
    else if (m === 'carbon') want.add('composite');
  };
  if (S && S.fuselage) add(S.fuselage.material);
  if (S && S.wings) for (const w of [].concat(S.wings)) add(w && w.material);
  if (S && S.tail) { add(S.tail.finMaterial); add(S.tail.stabMaterial); }
  return HANGAR_CAPS.filter(v => want.has(v));
}
// ============================================================
function makeSim(def, world) {
  const P_ = def.params;
  const PP = POWERPLANTS[P_.powerplant];
  // The PROP may be the aeroplane's own rather than the powerplant's: a GARAGE
  // build chooses its disc, and every prop number below is then synthesised from
  // it (60_gen_spec.js). A fiche sets no `prop`, so it reads the registry exactly
  // as before and no fleet number moves.
  const PR = P_.prop || PP.prop;
  const PROPA = Math.PI * (PR.D / 2) ** 2;
  // THE AIR THIS SIM IS IN. A sim built with no world flies the STANDARD day:
  // genShakedown makes one that way on purpose, and a wind-tunnel probe must
  // never be in weather — which now includes the weather's air, not just its
  // wind. Read per pass rather than captured, because the viewer sets a new day
  // live exactly the way it already sets a new wind.
  // setAtmos(air, h) — the air AND the altitude a wind-tunnel probe is run at.
  // A TUNNEL IS AT A DECLARED AIR STATE, never at the incidental height the
  // aeroplane's nodes happen to be sitting at: every design-time number in
  // 64_gen_build is measured through probes, and if those read the model's own
  // ride height then a taller undercarriage would quietly change the stall
  // speed on the sheet. Default: ISA sea level, which is the datum.
  let atmOver = null, hProbe = 0;
  const setAtmos = (a, h) => { atmOver = a || null; hProbe = h || 0; };
  const airOf = () => atmOver || (world && world.atmos) || ATMOS_ISA;
  // THE ENGINE'S OWN RELATION TO IT, declared on the registry row: 'na'
  // breathes the air and lapses with it, an electric motor's power comes out of
  // the pack and does not. Absent = 'na', because everything that flew before
  // this line existed was a piston.
  // G134: a GARAGE build may fly its OWN engine facts (def.params.engine, the
  // editor's dials resolved) — the registry row is then only the preset the
  // dials started from, exactly as params.prop already outranks PP.prop above.
  const EN = P_.engine || PP.engine;
  const ASP = (EN && EN.aspiration) || 'na';
  const n = def.nodes.length;
  const p = new Float64Array(n * 3), v = new Float64Array(n * 3),
        f = new Float64Array(n * 3), m = new Float64Array(n),
        r = new Float64Array(n);
  const beams = def.beams.map(b => ({ ...b, L0: 0, strain: 0 }));
  const _treeScratch = [];
  const ctl = { thr: 0, de: 0, da: 0, dr: 0, brake: 0, flap: 0 };
  const FP = P_.flaps;   // per-aircraft high-lift deltas; undefined = no flaps
  let simT = 0;          // sim time for the deterministic wind field
  const out = { V: 0, alpha: 0, thrust: 0, wash: 0, alt: 0, vs: 0 };
  let totalM = 0;
  for (const nd of def.nodes) totalM += nd.m;

  // wingspan datum for ground effect: outermost wing-strip node |z| in def
  // coordinates. Derived, not a fiche param — works for every aircraft.
  let bSpan = 0;
  for (const st of def.strips) if (st.kind === 'wing')
    for (const i of [st.fIn, st.fOut, st.rIn, st.rOut])
      bSpan = Math.max(bSpan, Math.abs(def.nodes[i].p[2]));
  bSpan = Math.max(0.1, bSpan * 2);

  function reset(drop = 0) {
    totalM = 0;                    // G121: masses may have changed (setNodeMass)
    for (let i = 0; i < n; i++) {
      const nd = def.nodes[i];
      p[i*3] = nd.p[0]; p[i*3+1] = nd.p[1]; p[i*3+2] = nd.p[2];
      v[i*3] = v[i*3+1] = v[i*3+2] = 0;
      m[i] = nd.m; r[i] = nd.r;
      totalM += nd.m;
      rigGround(i, nd.m);          // hoisted; reset only ever runs post-build
    }
    for (const b of beams) {
      b.L0 = Math.hypot(p[b.b*3]-p[b.a*3], p[b.b*3+1]-p[b.a*3+1], p[b.b*3+2]-p[b.a*3+2]);
      b.strain = 0;
    }
    let minC = Infinity;
    for (let i = 0; i < n; i++) minC = Math.min(minC, p[i*3+1] - r[i]);
    for (let i = 0; i < n; i++) p[i*3+1] += -minC + 0.01 + drop;
    ctl.thr = ctl.de = ctl.da = ctl.dr = ctl.brake = ctl.flap = 0;
    simT = 0;
  }

  // ---- small vec helpers on flat arrays ----
  const norm3 = a => { const L = Math.hypot(a[0], a[1], a[2]) || 1e-9;
    a[0] /= L; a[1] /= L; a[2] /= L; return a; };
  const xAft = [0,0,0], yUp = [0,0,0], zRt = [0,0,0], t1 = [0,0,0], t2 = [0,0,0];
  const avgP = (ids, o) => { o[0]=o[1]=o[2]=0;
    for (const i of ids) { o[0]+=p[i*3]; o[1]+=p[i*3+1]; o[2]+=p[i*3+2]; }
    const k = 1 / ids.length; o[0]*=k; o[1]*=k; o[2]*=k; };
  function bodyAxes() {
    avgP(def.refs.noseFrame, t1); avgP(def.refs.tailMid, t2);
    xAft[0]=t2[0]-t1[0]; xAft[1]=t2[1]-t1[1]; xAft[2]=t2[2]-t1[2]; norm3(xAft);
    avgP(def.refs.upLo, t1); avgP(def.refs.upHi, t2);
    yUp[0]=t2[0]-t1[0]; yUp[1]=t2[1]-t1[1]; yUp[2]=t2[2]-t1[2]; norm3(yUp);
    zRt[0]=yUp[1]*xAft[2]-yUp[2]*xAft[1];   // right = up x aft (nose -x)
    zRt[1]=yUp[2]*xAft[0]-yUp[0]*xAft[2];
    zRt[2]=yUp[0]*xAft[1]-yUp[1]*xAft[0]; norm3(zRt);
  }

  // sig = ground-effect downwash factor (1 = free air). It scales the induced
  // drag term AND raises the lift slope via the lifting-line identity
  // 1/a3d = 1/a0 + 1/eAR (a0 reconstructed from the registry constants).
  // dCl0/dCd0/dAStall = high-lift deltas (already scaled by flap fraction):
  // flaps are camber + drag + reduced stall margin, never a bare alpha shift.
  function polar(al, P, sig = 1, dCl0 = 0, dCd0 = 0, dAStall = 0) {
    const s = Math.min(1, Math.max(0, (Math.abs(al) - (P.aStall - dAStall)) / 0.10));
    let a3 = P.a3d;
    if (sig < 1) a3 = 1 / (1 / P.a3d - (1 - sig) / P.eAR);
    const Cl = (P.Cl0 + dCl0 + a3 * al) * (1 - s) + 1.1 * Math.sin(2 * al) * s;
    const CdAtt = P.Cd0 + dCd0 + sig * Cl * Cl / P.eAR;
    const Cd = CdAtt * (1 - s) + (P.Cd0 + dCd0 + 1.9 * Math.sin(al) * Math.sin(al)) * s;
    return [Cl, Cd];
  }

  // strip force pass. probe=true: no prop/wash, aero only.
  const sc=[0,0,0], sw_=[0,0,0], sn=[0,0,0];
  function aeroPass(probe) {
    bodyAxes();
    // mean velocity (mass-weighted), and the mean altitude in the same sweep
    let vmx=0, vmy=0, vmz=0, pmy=0;
    for (let i = 0; i < n; i++) { vmx+=v[i*3]*m[i]; vmy+=v[i*3+1]*m[i]; vmz+=v[i*3+2]*m[i];
                                 pmy+=p[i*3+1]*m[i]; }
    vmx/=totalM; vmy/=totalM; vmz/=totalM; pmy/=totalM;

    // THE AIR, SAMPLED ONCE FOR THE WHOLE PASS at the aeroplane's own altitude.
    // Node y is metres above MEAN SEA LEVEL already (placeAtAerodrome offsets
    // every node by the strip's own elev), so there is no new datum here.
    // Once, not per strip, and that is a declared cut rather than laziness: the
    // density gradient across a 13 m span is 1e-4 of the density, and this pass
    // runs up to 200 times a frame.
    const AIR = airOf();
    // A TUNNEL PROBE reads the DECLARED air (hProbe, ISA sea level unless the
    // bench says otherwise); a FLYING aeroplane reads the air at its own mean
    // altitude. The two must not be the same line: if a probe read the model's
    // own ride height, a taller undercarriage would change the stall speed on
    // the sheet, and the sheet is what two builds are compared by.
    //
    // AND A SIM WITH NO WORLD HAS NO PLACE, so it has no altitude either — it
    // flies in the declared air too. That is genShakedown's own existing ruling
    // about the ground ("settled on a flat plane, so the answer does not depend
    // on which patch of grass it is parked on") extended to the air, and it is
    // needed for the same reason: the STANCE is measured by settling rather
    // than probing, so without this clause a 1.2e-4 density difference from the
    // aeroplane's own ride height reached the design sheet — enough to flip
    // which main wheel a deliberately-broken variant came to rest on.
    // genDensityAlt is unaffected by construction: it sets its height itself.
    const hAir = (probe || !world) ? hProbe : pmy;
    const rho = AIR.rho(hAir), sig = AIR.sigma(hAir);
    // EQUIVALENT AIRSPEED is the speed this aeroplane's WING thinks it is
    // doing: the speed at sea level that would make the same dynamic pressure.
    // Every V-number in this project (Vs, VCruise, VAppr, the plant gains) was
    // derived at rho0 and is therefore already an EAS, so this factor is what
    // lets the autopilot keep flying the numbers it was tuned with when the air
    // thins. At sea level it is EXACTLY 1 and nothing moves.
    const easK = Math.sqrt(sig);
    // and what the powerplant makes of it — see 05_atmos.js, where both
    // scalings are re-derived from 60_gen_spec's own prop synthesis rather than
    // asserted.
    const PS = atmosPropScale(sig, ASP);
    out.rho = rho; out.sigma = sig; out.easK = easK;
    out.densityAlt = AIR.densityAlt(hAir); out.oatC = AIR.T(hAir) - 273.15;
    out.powerK = PS.power; out.thrustK = PS.kT;

    // world samples: ONE terrain height (ground effect) and ONE wind vector
    // under the wing per pass; strips re-sample wind at their own position
    // so spatial gust structure produces roll/twist forcing. All wind terms
    // are exact zeros when no wind is set — the zero-wind battery is
    // byte-identical to the pre-wind one.
    let gH = null, wcx = 0, wcy = 0, wcz = 0;
    if (world) {
      let sx = 0, sy = 0, sz = 0, sN = 0;
      for (const st of def.strips) if (st.kind === 'wing') {
        sx += p[st.fIn*3] + p[st.fOut*3];
        sy += p[st.fIn*3+1] + p[st.fOut*3+1];
        sz += p[st.fIn*3+2] + p[st.fOut*3+2];
        sN += 2;
      }
      const mx = sx / sN, my = sy / sN, mz = sz / sN;
      gH = world.terrainH(mx, mz);
      // the CG sample used to pass a literal 0 for y. It was silent while the
      // wind field ignored y and wrong the moment it stopped (G72): the wing
      // would have been told the wind at sea level while its own strips, which
      // sample at their real positions two lines down, felt the wind at
      // altitude — the two disagreeing about the same air.
      if (world.wind) { const wv = world.wind(mx, my, mz, simT); wcx = wv[0]; wcy = wv[1]; wcz = wv[2]; }
    }
    // prop advance ratio uses AIRSPEED (thrust decays with air, not ground)
    const Vfwd = Math.max(0, -((vmx-wcx)*xAft[0]+(vmy-wcy)*xAft[1]+(vmz-wcz)*xAft[2]));

    // prop thrust + far-wake propwash
    let T = 0, wash = 0;
    if (!probe) {
      // TWO DIFFERENT COUNTS, and conflating them was a real defect (fixed
      // 2026-08-11). `refs.engine` is the list of NODES the thrust is applied
      // AT — the two mount points of ONE engine on the Cub, one node per
      // nacelle on the DC-3 — so it can say where the force goes but not how
      // many engines make it. `params.nEngines` says that, and every def
      // states it. The registry's Tstatic/kV2 are PER PROPELLER.
      const nE = def.params.nEngines || 1;
      const Tper = ctl.thr * Math.max(0, PR.Tstatic * PS.kT - PR.kV2 * PS.kV * Vfwd * Vfwd);
      T = Tper * nE;                                   // registry values are per engine
      // propwash is ONE disc's — the tail flies in the wake of the prop ahead
      // of it, not in the sum of the aeroplane's engines
      wash = Math.sqrt(Vfwd * Vfwd + 2 * Tper / (rho * PROPA)) - Vfwd;
      const per = T / def.refs.engine.length;          // spread over the MOUNTS
      for (const e of def.refs.engine) {
        f[e*3]   -= per * xAft[0];
        f[e*3+1] -= per * xAft[1];
        f[e*3+2] -= per * xAft[2];
      }
    }
    out.aeroFy = 0; out.wingFy = 0; out.stabFy = 0; out.dbgAl = 0; out.dbgN = 0;
    out.thrust = T; out.wash = wash;
    // THREE SPEEDS, and the distinction is load-bearing now that the air can be
    // thin: out.V is TRUE airspeed (air-relative — what alpha is built on and
    // what a propeller advances into), out.Veas is what the wing and the
    // instrument feel, out.Vg is over the ground (wheels, brakes, stop
    // detection). At sea level the first two are the same number exactly.
    const avx = vmx - wcx, avy = vmy - wcy, avz = vmz - wcz;
    out.V = Math.hypot(avx, avy, avz);
    out.Veas = out.V * easK;
    out.Vg = Math.hypot(vmx, vmy, vmz);
    out.windX = wcx; out.windY = wcy; out.windZ = wcz;
    out.alpha = Math.atan2(-(avx*yUp[0]+avy*yUp[1]+avz*yUp[2]),
                           -(avx*xAft[0]+avy*xAft[1]+avz*xAft[2]));
    out.vs = vmy;

    for (const st of def.strips) {
      // --- strip frame ---
      if (st.kind === 'wing') {
        const fi=st.fIn*3, fo=st.fOut*3, ri=st.rIn*3, ro=st.rOut*3, t=st.t;
        sc[0]=(p[ri]+(p[ro]-p[ri])*t)-(p[fi]+(p[fo]-p[fi])*t);
        sc[1]=(p[ri+1]+(p[ro+1]-p[ri+1])*t)-(p[fi+1]+(p[fo+1]-p[fi+1])*t);
        sc[2]=(p[ri+2]+(p[ro+2]-p[ri+2])*t)-(p[fi+2]+(p[fo+2]-p[fi+2])*t);
        norm3(sc);
        sw_[0]=(p[fo]-p[fi])*st.side; sw_[1]=(p[fo+1]-p[fi+1])*st.side; sw_[2]=(p[fo+2]-p[fi+2])*st.side;
        norm3(sw_);
        sn[0]=sw_[1]*sc[2]-sw_[2]*sc[1];
        sn[1]=sw_[2]*sc[0]-sw_[0]*sc[2];
        sn[2]=sw_[0]*sc[1]-sw_[1]*sc[0]; norm3(sn);
      } else if (st.kind === 'stab') {
        sc[0]=xAft[0]; sc[1]=xAft[1]; sc[2]=xAft[2];
        sn[0]=yUp[0]; sn[1]=yUp[1]; sn[2]=yUp[2];
      } else if (st.kind === 'vtail') {
        // V-TAIL panel: chord still aft, but the normal is canted out of the
        // vertical by the panel's own dihedral, INWARD on each side:
        //   n = cos G * up  -  side * sin G * right
        // Both panels then lift upward together (their lateral parts cancel in
        // symmetric flight) and oppositely in yaw, which is the whole trick —
        // the mixing falls out of the geometry instead of being asserted.
        const cV = st.cosV, sV = st.sinV * st.side;
        sc[0]=xAft[0]; sc[1]=xAft[1]; sc[2]=xAft[2];
        sn[0]=cV*yUp[0]-sV*zRt[0]; sn[1]=cV*yUp[1]-sV*zRt[1]; sn[2]=cV*yUp[2]-sV*zRt[2];
        norm3(sn);
      } else { // fin
        sc[0]=xAft[0]; sc[1]=xAft[1]; sc[2]=xAft[2];
        sn[0]=zRt[0]; sn[1]=zRt[1]; sn[2]=zRt[2];
      }
      // --- local velocity + position via attach weights ---
      let vx=0, vy=0, vz=0, spx=0, spy=0, spz=0;
      for (const [i, w] of st.w) {
        vx+=v[i*3]*w; vy+=v[i*3+1]*w; vz+=v[i*3+2]*w;
        spx+=p[i*3]*w; spy+=p[i*3+1]*w; spz+=p[i*3+2]*w;
      }
      // wind at the strip's own position (spatial gust structure -> roll/twist)
      let wx_ = wcx, wy_ = wcy, wz_ = wcz;
      if (world && world.wind) { const wv = world.wind(spx, spy, spz, simT); wx_ = wv[0]; wy_ = wv[1]; wz_ = wv[2]; }
      // relative air velocity = air motion (wash + wind) - node motion
      const wsh = wash * st.wash;
      let rx = wsh*xAft[0]+wx_-vx, ry = wsh*xAft[1]+wy_-vy, rz = wsh*xAft[2]+wz_-vz;
      const u = rx*sc[0]+ry*sc[1]+rz*sc[2];
      const w_ = rx*sn[0]+ry*sn[1]+rz*sn[2];
      const V2 = u*u + w_*w_;
      if (V2 < 0.01) continue;
      let al = Math.atan2(w_, u);
      let P = P_.polarWing;
      let fl = 0;                                  // flap fraction on this strip
      if (st.kind === 'wing') {
        al += P_.ailTau * ctl.da * st.side * st.ail;
        if (FP && st.flap && ctl.flap > 0) {
          fl = ctl.flap * st.flap;
          al += (FP.tau || 0) * fl;                // flaperon droop (surface rotates)
        }
      } else if (st.kind === 'stab') {
        al = (1 - P_.downwash) * al + P_.stabTrim - P_.elevTau * ctl.de;
        P = P_.polarTail;
      } else if (st.kind === 'vtail') {
        // ruddervator: elevator SYMMETRIC (both panels the same way, vertical
        // forces add and lateral cancel), rudder ANTISYMMETRIC (the reverse)
        // MINUS side, not plus. A V panel's normal leans INWARD (that is what
        // dihedral does — it is the same geometry that gives a dihedralled wing
        // its roll stability), so the panel that goes nose-up pushes the tail
        // toward the centreline, not away from it. With +side the aeroplane
        // yawed the wrong way on every rudder input: measured d(yawLeft)/d(dr)
        // = -6991 against a conventional tail's +3814.
        al = (1 - P_.downwash) * al + P_.stabTrim - P_.elevTau * ctl.de
             - P_.rudTau * ctl.dr * PAR.rudderSign * st.side;
        P = P_.polarTail;
      } else {
        al += P_.rudTau * ctl.dr * PAR.rudderSign;
        // G115: the fin flies its OWN polar when the def declares one (the
        // generator does, from the real fin aspect ratio); the fleet's
        // fiches never set polarFin, so the fallback keeps them bit-exact.
        P = P_.polarFin || P_.polarTail;
      }
      // ground effect (wing strips only; tail excluded — honest cut):
      // McCormick sigma = (16h/b)^2 / (1 + (16h/b)^2)
      let sig = 1;
      if (gH !== null && st.kind === 'wing') {
        const hb = Math.max(0.02,
          ((p[st.fIn*3+1] + p[st.fOut*3+1]) * 0.5 - gH) / bSpan);
        const g16 = 16 * hb;
        sig = g16 * g16 / (1 + g16 * g16);
      }
      const [Cl, Cd] = fl > 0
        ? polar(al, P, sig, (FP.dCl0 || 0) * fl, (FP.dCd0 || 0) * fl, (FP.dAStall || 0) * fl)
        : polar(al, P, sig);
      const q = 0.5 * rho * V2 * st.area, iv = 1 / Math.sqrt(V2);
      // drag along relative wind (in strip plane), lift perpendicular
      const dx=(u*sc[0]+w_*sn[0])*iv, dy=(u*sc[1]+w_*sn[1])*iv, dz=(u*sc[2]+w_*sn[2])*iv;
      const lx=(u*sn[0]-w_*sc[0])*iv, ly=(u*sn[1]-w_*sc[1])*iv, lz=(u*sn[2]-w_*sc[2])*iv;
      const Fx = q*(Cl*lx + Cd*dx), Fy = q*(Cl*ly + Cd*dy), Fz = q*(Cl*lz + Cd*dz);
      out.aeroFy += Fy;
      if (st.kind === 'wing') { out.wingFy += Fy; out.dbgAl += al; out.dbgN++;
        if (out.dump) out.dump.push({ side: st.side, t: st.t, wash: st.wash,
          al: al*57.3, Fy, ch: st.chord }); }
      else if (st.kind === 'stab' || st.kind === 'vtail') out.stabFy += Fy;
      for (const [i, w] of st.w) {
        f[i*3] += Fx*w; f[i*3+1] += Fy*w; f[i*3+2] += Fz*w;
      }
      // wing pitching moment as front/rear spar couple (d = spar spacing 0.78 m)
      // flap dCm0 feeds in here — the couple reading polarWing.Cm0 alone would
      // silently ignore the flap pitching moment (HANDOVER "watch Cm0")
      if (st.kind === 'wing') {
        const Fc = q * (P_.polarWing.Cm0 + (fl > 0 ? (FP.dCm0 || 0) * fl : 0))
                     * st.chord / P_.sparSpacing, t = st.t;
        const cW = [[st.fIn, (1-t)], [st.fOut, t], [st.rIn, -(1-t)], [st.rOut, -t]];
        for (const [i, w] of cW) {
          f[i*3] += Fc*w*sn[0]; f[i*3+1] += Fc*w*sn[1]; f[i*3+2] += Fc*w*sn[2];
        }
      }
    }
    // fuselage blobs: anisotropic CdA in body axes; side/vertical area split
    // between cabin and aft fuselage so yaw and pitch damping are physical
    const blob = (ids, CdA) => {
      let vx=0, vy=0, vz=0, bx=0, by=0, bz=0;
      for (const i of ids) {
        vx+=v[i*3]; vy+=v[i*3+1]; vz+=v[i*3+2];
        bx+=p[i*3]; by+=p[i*3+1]; bz+=p[i*3+2];
      }
      vx/=4; vy/=4; vz/=4; bx/=4; by/=4; bz/=4;
      // wind on the fuselage: without this there is no weathercocking
      let wx_ = 0, wy_ = 0, wz_ = 0;
      if (world && world.wind) { const wv = world.wind(bx, by, bz, simT); wx_ = wv[0]; wy_ = wv[1]; wz_ = wv[2]; }
      const rx=wx_-vx, ry=wy_-vy, rz=wz_-vz, Vr = Math.hypot(rx, ry, rz);
      if (Vr < 0.1) return;
      const cb = [rx*xAft[0]+ry*xAft[1]+rz*xAft[2],
                  rx*yUp[0]+ry*yUp[1]+rz*yUp[2],
                  rx*zRt[0]+ry*zRt[1]+rz*zRt[2]];
      const k = 0.5 * rho * Vr * 0.25;
      for (const i of ids) {
        f[i*3]   += k*(CdA[0]*cb[0]*xAft[0] + CdA[1]*cb[1]*yUp[0] + CdA[2]*cb[2]*zRt[0]);
        f[i*3+1] += k*(CdA[0]*cb[0]*xAft[1] + CdA[1]*cb[1]*yUp[1] + CdA[2]*cb[2]*zRt[1]);
        f[i*3+2] += k*(CdA[0]*cb[0]*xAft[2] + CdA[1]*cb[1]*yUp[2] + CdA[2]*cb[2]*zRt[2]);
      }
    };
    blob(def.refs.fusDrag,    P_.fusCdA);
    blob(def.refs.fusDragAft, P_.fusCdAAft);
  }

  // G115: DEFDAMP is overridable per def — for the MEASUREMENT instrument
  // (tools/_yaw_probe.js runs free-yaw decay at two settings), not for play.
  // No fiche and no generated build sets it, so everything flies 0.5 as ever.
  const G = -9.81, DEFDAMP = def.params.defDamp ?? 0.5;
  // ground stiffness scales with node mass so light aircraft stay stable at the same dt
  const KGn = new Float64Array(n), CGn = new Float64Array(n),
        KTn = new Float64Array(n), CTn = new Float64Array(n);
  // G121: the per-node rig is a FUNCTION now, because a node's mass can
  // change (fuel burns; the sanctioned door is setNodeMass below) and the
  // ground spring plus its critical-damping companion must follow the mass
  // they carry, or the landing rollout at reserves rides constants rigged
  // for full tanks. Identical arithmetic to the old loop.
  function rigGround(i, mi) {
    // light nodes: Cub/drone-calibrated regime (unchanged); heavy nodes keep scaling
    KGn[i] = mi <= 6 ? Math.min(9e4, 2.5e5 * mi) : 1.5e4 * mi;
    CGn[i] = 1.6 * Math.sqrt(KGn[i] * mi);
    KTn[i] = Math.min(2.2e4, 2e5 * mi);
    CTn[i] = Math.min(40, 300 * mi);
  }
  for (let i = 0; i < n; i++) rigGround(i, def.nodes[i].m);

  // G121 — THE SANCTIONED MASS DOOR (the review's B1/B3, built BEFORE the
  // energy arc's burn so it cannot be built wrong). `m[]` was always exposed
  // and mutating it directly was always possible — and always wrong: totalM
  // was summed once at construction, and it is the divisor under the
  // mass-weighted mean velocity that alpha, vs, DEFDAMP's rigid mean, the
  // probe CG and cgPos/cgVel are all built on. Drain fuel behind its back
  // and ALPHA ITSELF corrupts — an invisible drag and rate damper that grow
  // as the tanks empty, and nothing NaNs. This door keeps every consumer
  // honest: the sum, the ground rig, nothing else touched. Burn calls this;
  // nothing else writes m[].
  function setNodeMass(i, kg) {
    if (!(i >= 0 && i < n) || !(kg > 0.01)) return;
    totalM += kg - m[i];
    m[i] = kg;
    rigGround(i, kg);
  }

  function trqOf() {
    let cgx=0, cgy=0;
    if (out.trqDebugOnce) { out.trqDebugOnce = false;
      let sp=0, sf=0, sm=0;
      for (let i = 0; i < n; i++) { sp+=p[i*3]; sf+=f[i*3+1]; sm+=m[i]; }
      console.log("trqOf dbg: n=", n, "sum p.x=", sp, "sum f.y=", sf, "sum m=", sm, "totalM=", totalM, "G=", typeof G !== "undefined" ? G : "UNDEF"); }
    for (let i = 0; i < n; i++) { cgx+=p[i*3]*m[i]; cgy+=p[i*3+1]*m[i]; }
    cgx/=totalM; cgy/=totalM;
    let Mz = 0;
    for (let i = 0; i < n; i++)
      Mz += (p[i*3]-cgx)*(f[i*3+1]-G*m[i]) - (p[i*3+1]-cgy)*f[i*3];
    return -Mz;   // nose-up positive, gravity excluded
  }
  function substep(dt) {
    for (let i = 0; i < n; i++) { f[i*3]=0; f[i*3+1]=G*m[i]; f[i*3+2]=0; }
    aeroPass(false);
    if (out.trq) out.trqAero = trqOf();
    for (const b of beams) {
      const a3=b.a*3, b3=b.b*3;
      let dx=p[b3]-p[a3], dy=p[b3+1]-p[a3+1], dz=p[b3+2]-p[a3+2];
      const L = Math.hypot(dx, dy, dz) || 1e-9;
      dx/=L; dy/=L; dz/=L;
      const vrel = (v[b3]-v[a3])*dx + (v[b3+1]-v[a3+1])*dy + (v[b3+2]-v[a3+2])*dz;
      const Fb = b.k * (L - b.L0) + b.c * vrel;
      b.strain = (L - b.L0) / b.L0;
      f[a3]+=Fb*dx; f[a3+1]+=Fb*dy; f[a3+2]+=Fb*dz;
      f[b3]-=Fb*dx; f[b3+1]-=Fb*dy; f[b3+2]-=Fb*dz;
    }
    // ground: wheels roll, everything else scrapes. Terrain-aware.
    const gH = world ? world.terrainH : null;
    for (let i = 0; i < n; i++) {
      const i3 = i*3;
      const gy = gH ? gH(p[i3], p[i3+2]) : 0;
      const pen = gy + r[i] - p[i3+1];
      if (pen <= 0) continue;
      let Fn = KGn[i] * pen - CGn[i] * v[i3+1];
      if (out.gndDump) out.gndPitch -= (p[i3] - out.gndCgx) * Fn;

      if (Fn < 0) Fn = 0;
      f[i3+1] += Fn;
      const isMain = def.refs.mains.includes(i), isTW = i === def.refs.tw;
      if (isMain || isTW) {
        // rolling dir = horizontal forward, tailwheel steered by rudder
        let hx = -xAft[0], hz = -xAft[2];
        if (isTW) {
          const s = P_.twSteer * ctl.dr;   // measured: matches nose-left convention
          const cs = Math.cos(s), sn_ = Math.sin(s);
          const nx = hx*cs - hz*sn_, nz = hx*sn_ + hz*cs;
          hx = nx; hz = nz;
        }
        const hL = Math.hypot(hx, hz) || 1e-9; hx/=hL; hz/=hL;
        const lx = -hz, lz = hx;
        const vr_ = v[i3]*hx + v[i3+2]*hz, vl = v[i3]*lx + v[i3+2]*lz;
        // G115: the wheel asks WHAT IT IS ROLLING ON. `world.surface` is the
        // biome classifier with the aerodrome strips folded in (measured: 5
        // at Morford's pavement, 0 at HOME); classes without a row read the
        // grass row, which equals the classic constants — so HOME, the
        // calibration datum, is unchanged to the last bit.
        const su = world && world.surface
          ? (GROUND_SURF[world.surface(p[i3], p[i3+2])] || GROUND_DEF)
          : GROUND_DEF;
        const muR = su[0] + (isMain ? ctl.brake * su[1] : 0);
        // G121.3: BELOW WALKING PACE THE COEFFICIENT IS A DAMPER, NOT A
        // RESISTANCE. The 0.2 m/s regularization means the sub-0.2 regime
        // was never physical rolling — and it turned out to be load-bearing
        // as the PLACEMENT-BOUNCE damper: at Morford the fleet's Cub, given
        // pavement's 0.02 in that regime, kept 2.5x less rock damping than
        // the grass the settle was calibrated on and flipped onto its back
        // in 1.7 s, parked, on flat ground (measured; XCTY3 caught it). So
        // the creep regime damps at least at the grass datum on EVERY
        // surface — bit-identical at HOME, where muR == CRR — and the true
        // surface coefficient applies from 0.2 m/s up, which is where the
        // takeoff run, the brakes and the surface honesty actually live.
        // 0.5 m/s, not the 0.2 regularization floor: the placement-bounce
        // ROCKING measured 0.1-0.3 m/s fore-aft at the wheels, just above
        // 0.2 — the band must cover the whole settle/rock regime. Costs a
        // paved takeoff under a metre (it passes 0.5 m/s in the first
        // second); HOME remains bit-identical (muR == CRR there).
        const muRe = Math.abs(vr_) < 0.5 ? Math.max(muR, CRR) : muR;
        const kR = Math.min(muRe * Fn / Math.max(Math.abs(vr_), 0.2), m[i]/dt);
        const kL = Math.min(su[2] * Fn / Math.max(Math.abs(vl), 0.02), m[i]/dt);
        f[i3]   -= kR*vr_*hx + kL*vl*lx;
        f[i3+2] -= kR*vr_*hz + kL*vl*lz;
      } else {
        const vx=v[i3], vz=v[i3+2], sp = Math.hypot(vx, vz);
        if (sp > 1e-6) {
          const kf = Math.min(0.8 * Fn / sp, m[i]/dt);
          f[i3] -= kf*vx; f[i3+2] -= kf*vz;
        }
      }
    }
    // tree collisions: cheap cylinder push-out, only when low and near trees
    if (world) {
      const cgx = p[0], cgz = p[2];   // any chassis node as coarse anchor
      if (p[1] < 24) {
        const near = world.treesNear(cgx, cgz, _treeScratch);
        if (near.length) for (let i = 0; i < n; i++) {
          const i3 = i*3;
          for (const ti of near) {
            const T = world.trees[ti];
            const dx = p[i3] - T.x, dz = p[i3+2] - T.z;
            const R = 0.7 * T.s + 0.12;
            const d2 = dx*dx + dz*dz;
            if (d2 > R*R) continue;
            if (p[i3+1] > T.h + 4.6 * T.s) continue;
            const d = Math.sqrt(d2) || 1e-6;
            const push = KTn[i] * (R - d) / d;
            f[i3] += push * dx - CTn[i] * v[i3];
            f[i3+2] += push * dz - CTn[i] * v[i3+2];
          }
        }
      }
    }
    if (out.trq) out.trqTotal = trqOf();
    // integrate; damp only deformation (velocity relative to rigid mean)
    let vmx=0, vmy=0, vmz=0;
    for (let i = 0; i < n; i++) { vmx+=v[i*3]*m[i]; vmy+=v[i*3+1]*m[i]; vmz+=v[i*3+2]*m[i]; }
    vmx/=totalM; vmy/=totalM; vmz/=totalM;
    const dp = Math.max(0, 1 - DEFDAMP * dt);
    for (let i = 0; i < n; i++) {
      const i3 = i*3, im = dt/m[i];
      v[i3]   = vmx + (v[i3]   + f[i3]*im   - vmx) * dp;
      v[i3+1] = vmy + (v[i3+1] + f[i3+1]*im - vmy) * dp;
      v[i3+2] = vmz + (v[i3+2] + f[i3+2]*im - vmz) * dp;
      p[i3] += v[i3]*dt; p[i3+1] += v[i3+1]*dt; p[i3+2] += v[i3+2]*dt;
    }
    // altitude of CG (wheel-corrected later by caller if needed)
    let cy = 0;
    for (let i = 0; i < n; i++) cy += p[i*3+1]*m[i];
    out.alt = cy/totalM;
  }

  function step(dtFrame, sub = P_.substeps ?? 24) {
    const dt = dtFrame / sub;
    for (let s = 0; s < sub; s++) { substep(dt); simT += dt; }
  }

  // ONE THRUST MODEL, TWO READERS. 64_gen_build's design-time numbers — the
  // cruise speed off the power curve, thrCruise, the climb gradient, the
  // take-off roll integration — used to re-type `Tstatic - kV2 V^2` straight
  // off the registry. That was harmless while the air was a constant and became
  // a SECOND, quieter engine the moment it stopped being one: the sheet would
  // have gone on quoting sea-level thrust while the aeroplane flew on less.
  // `floor` is the caller's own — genTrim floors the bracket at 1 N so a ratio
  // cannot divide by zero, the take-off roll floors it at 0 — and it is passed
  // rather than chosen here so the two readers keep their own numbers exactly.
  // What air a PROBE is in, for the readers that have to convert between the
  // equivalent airspeeds the sheet is written in and the true ones the tunnel
  // prescribes. Cheap, and it keeps the conversion in one place.
  function probeAir() {
    const A = airOf(), sg = A.sigma(hProbe);
    return { air: A, h: hProbe, rho: A.rho(hProbe), sigma: sg,
             easK: Math.sqrt(sg), densityAlt: A.densityAlt(hProbe),
             oatC: A.T(hProbe) - 273.15, power: atmosPowerRatio(sg, ASP),
             aspiration: ASP };
  }

  function thrustAt(V, floor = 0, hAlt) {
    const A = airOf();
    const PS = atmosPropScale(A.sigma(hAlt == null ? hProbe : hAlt), ASP);
    return Math.max(floor, PR.Tstatic * PS.kT - PR.kV2 * PS.kV * V * V)
           * (def.params.nEngines || 1);
  }

  // ---- wind tunnel: prescribe uniform velocity, measure aero force+moment ----
  function probe(vel) {
    for (let i = 0; i < n; i++) {
      f[i*3]=f[i*3+1]=f[i*3+2]=0;
      v[i*3]=vel[0]; v[i*3+1]=vel[1]; v[i*3+2]=vel[2];
    }
    aeroPass(true);
    let cgx=0, cgy=0, cgz=0;
    for (let i = 0; i < n; i++) { cgx+=p[i*3]*m[i]; cgy+=p[i*3+1]*m[i]; cgz+=p[i*3+2]*m[i]; }
    cgx/=totalM; cgy/=totalM; cgz/=totalM;
    let Fx=0, Fy=0, Fz=0, Mz=0, My=0;
    for (let i = 0; i < n; i++) {
      Fx+=f[i*3]; Fy+=f[i*3+1]; Fz+=f[i*3+2];
      Mz += (p[i*3]-cgx)*f[i*3+1] - (p[i*3+1]-cgy)*f[i*3];
      My += (p[i*3+2]-cgz)*f[i*3] - (p[i*3]-cgx)*f[i*3+2];
    }
    // nose-up pitch = -Mz ; nose-LEFT yaw = +My  (nose -x, +z is the LEFT side)
    return { Fx, Fy, Fz, pitchUp: -Mz, yawLeft: My, cg: [cgx, cgy, cgz] };
  }

  function stats() {
    let smax = 0, bad = false;
    for (const b of beams) smax = Math.max(smax, Math.abs(b.strain));
    for (let i = 0; i < n; i++) if (!isFinite(p[i*3+1])) bad = true;
    return { smax, bad };
  }
  function impulse(i, ix, iy, iz) { v[i*3]+=ix/m[i]; v[i*3+1]+=iy/m[i]; v[i*3+2]+=iz/m[i]; }
  function wheelsOnGround() {
    let c = 0;
    for (const i of [...def.refs.mains, def.refs.tw]) {
      const gh = world ? world.terrainH(p[i*3], p[i*3+2]) : 0;
      if (p[i*3+1] - r[i] - gh < 0.03) c++;
    }
    return c;
  }
  function cgPos() {
    let x=0, y=0, z=0;
    for (let i = 0; i < n; i++) { x+=p[i*3]*m[i]; y+=p[i*3+1]*m[i]; z+=p[i*3+2]*m[i]; }
    return [x/totalM, y/totalM, z/totalM];
  }
  function cgVel() {
    let x=0, y=0, z=0;
    for (let i = 0; i < n; i++) { x+=v[i*3]*m[i]; y+=v[i*3+1]*m[i]; z+=v[i*3+2]*m[i]; }
    return [x/totalM, y/totalM, z/totalM];
  }
  function axes() { bodyAxes(); return [xAft.slice(), yUp.slice(), zRt.slice()]; }

  // G121: totalM is a GETTER — it was a copied value, so a mass change via
  // setNodeMass would have been invisible to every external reader (the
  // autopilot's taxi feedforward, the shakedown's weights). Same number as
  // ever for anything that never changes mass; nothing writes it.
  return { p, v, m, r, beams, n, ctl, out, get totalM() { return totalM; },
           setNodeMass,
           reset, step, probe, stats, impulse, wheelsOnGround, cgPos, cgVel, axes,
           setAtmos, atmos: airOf, thrustAt, probeAir };
}


// ============================================================
// M3 — autopilot: full circuit. takeoff, climb, outbound cruise,
// 180 turnback, inbound track, glideslope, flare, rollout, stop.
// W10 cross-country: all along/cross geometry runs in a RUNWAY FRAME
// {origin o, unit axis u} built from a W.aerodromes record (contract
// rule 6). The frame puts the touchdown zone at s = -450 (the home
// strip's tdz coordinate), so every fiche's tuned xTurn/xAim/gs
// transfers to any strip unchanged. Axis components are SNAPPED so the
// HOME frame is exactly s = x, cross = z: the whole calm + wind battery
// is byte-identical through this refactor. A->B flights replace
// TURNBACK with ENROUTE (destination landing frame, terrain-aware
// cruise altitude), then reuse INBOUND..STOPPED untouched.
// Conventions: de>0 nose-up, da>0 roll-right, dr>0 nose-left,
// e>0 = nose left of target.
// ============================================================
// W10 spawn-at-aerodrome: after sim.reset(0), rotate the def geometry
// from its built-in -x nose heading onto the strip's takeoff heading
// (theta = pi - hdg) and translate to the record's spawn point at strip
// elevation. HOME (hdg pi, spawn [0,0], elev 0) is a BIT-EXACT no-op,
// so calling this unconditionally changes nothing for the home battery.
function placeAtAerodrome(sim, a) {
  const snap = v => Math.abs(v) < 1e-9 ? 0 : v;
  const th = Math.PI - a.hdg;
  const c = snap(Math.cos(th)), s = snap(Math.sin(th));
  const sp = a.spawn || [0, 0];
  for (let i = 0; i < sim.n; i++) {
    const x = sim.p[i * 3], z = sim.p[i * 3 + 2];
    sim.p[i * 3] = x * c + z * s + sp[0];
    sim.p[i * 3 + 2] = -x * s + z * c + sp[1];
    sim.p[i * 3 + 1] += a.elev;
  }
}

// G151: THE STAND. placeAtAerodrome puts the aeroplane on the strip's SPAWN
// IDENTITY — the W10 datum every flying gate departs from, which is exactly
// why it must never move: shifting it would move every take-off measurement
// in the battery at once. But a PLAYER rolling out of the shed has not been
// teleported onto the runway; the aeroplane was wheeled onto the apron, and
// landing it 75 m away facing the wrong way is the first thing every flight
// used to show (G123 named it and wired `site.stand` to nothing).
// This places it on that declared stand instead. The spawn identity is NOT
// touched — the taxi that follows ENDS on the centreline, so the datum keeps
// its meaning and the gates keep their numbers.
// It is deliberately a THIN wrapper rather than a second copy of the
// transform: placeAtAerodrome reads exactly hdg / spawn / elev, so a stand is
// just another pose to hand it. One transform, one place, as ever.
function placeAtStand(sim, a, st) {
  return placeAtAerodrome(sim, st
    ? { hdg: st.hdg, spawn: [st.x, st.z], elev: a.elev } : a);
}

function makeAutopilot(sim, def, world) {
  const A = def.params.ap;
  // TAXI BREAKAWAY (G4.9). The taxi governor below is a proportional speed
  // hold, and a fraction of throttle is not a fixed amount of push: what it
  // has to beat is CRR*W, which is a property of the AEROPLANE. The old
  // constant 0.08 bias happened to clear that on every fiche only because the
  // solver was handing the single-engine ones twice their thrust — on honest
  // thrust the Cub's governor asked for 0.20, got 180 N against 185 N of
  // rolling resistance, and the backtrack in GATE XCTY5 crept 16 m in 120 s
  // and timed out onto the wrong end of the strip.
  // So the bias is the throttle that exactly cancels rolling resistance,
  // derived per aeroplane. Nothing is tuned here: CRR and the prop curve are
  // both already in the registry.
  // G121: a FUNCTION of the live mass, not a number captured at engagement —
  // this exact feedforward being wrong is the documented 16 m creep below,
  // and burning fuel would have made it wrong again. Identical value on every
  // call for anything whose mass never changes, which is the whole fleet.
  const taxiFF = (() => {
    const PP = POWERPLANTS[def.params.powerplant];
    const PR = def.params.prop || PP.prop;
    const T0 = Math.max(1, PR.Tstatic * (def.params.nEngines || 1));
    return () => Math.min(0.5, CRR * sim.totalM * 9.81 / T0);
  })();
  const snap = v => Math.abs(v) < 1e-9 ? 0 : v;
  // u = frame axis (landing direction); origin places tdz at s = -450
  const mkFrame = (a, sx, sz) => {
    let ux = snap(Math.cos(a.hdg)), uz = snap(Math.sin(a.hdg));
    if (sx !== undefined) {                 // pick the landing end facing travel
      const d = ux * sx + uz * sz;
      if (d < 0) { ux = -ux; uz = -uz; }
    } else { ux = -ux; uz = -uz; }          // departure: land opposite takeoff
    return { ux, uz, ox: a.tdz[0] + 450 * ux, oz: a.tdz[1] + 450 * uz };
  };
  const HOMEISH = { hdg: Math.PI, tdz: [-450, 0], elev: 0 };  // world-less fallback
  const ap = {
    phase: 'ROLL', t: 0, hCruise: A.hCruise, VClimb: A.VClimb,
    VCruise: A.VCruise, VAppr: A.VAppr,
    xTurn: A.xTurn, xAim: A.xAim, gs: A.gs,
    targetDir: [-1, 0, 0], trackHold: true, dirX: -1,
    restAlt: null, refAlt: null, altRef: 0, tdInfo: null, dbg: {},
    route: null, xc: false, frame: null, gaN: 0, gaWhy: null,
  };
  ap.setRoute = (from, to) => {
    ap.route = { from, to };
    ap.xc = from !== to;
    ap.frame = mkFrame(from);               // departure frame
    ap.altRef = from.elev;
    ap.shortFld = false;                    // set per-arrival in enterArrival
  };
  ap.setRoute(world ? world.aerodromes[0] : HOMEISH,
              world ? world.aerodromes[0] : HOMEISH);
  // W14 multi-hop: depart from wherever the aircraft is standing on
  // `from` — no reset, no teleport. The plan runs on the first update
  // (it needs the live pose): takeoff INTO the wind when there is any,
  // else along the current nose; straight ahead when the runway left
  // covers TORun + margin, else taxi back along the strip and turn
  // around (TAXI/LINEUP), then the normal ROLL takes over. Use on a
  // fresh makeAutopilot instance so restAlt/integrators latch clean.
  // G151: `taxiOut` is the SITE's declared way from its stand to the
  // centreline (see 25_airfield.js). Optional, and absent for every caller
  // that departs from the strip itself — GATE XCTY5's backtrack passes two
  // arguments and is unchanged.
  ap.departFrom = (from, to, taxiOut) => {
    ap.route = { from, to };
    ap.xc = from !== to;
    ap.altRef = from.elev;
    ap.shortFld = false;
    ap.trackHold = false;
    ap.taxiTgt = null;
    ap.taxiPath = null;
    ap.taxiOut = (taxiOut && taxiOut.length) ? taxiOut : null;
    ap.phase = 'DEPART'; phaseT = 0;
  };
  // arrival switch: destination landing frame + arrival altitude refs
  const enterArrival = () => {
    const { from, to } = ap.route;
    if (ap.xc) {
      // W13.2: land INTO the wind when there is any (a quartering
      // tailwind at Stein bounced + veered + nosed-over every PA-18
      // arrival), else keep facing travel as before. Sampled once at
      // arrival setup — the viewer presets are constant fields.
      let hx = to.tdz[0] - from.tdz[0], hz = to.tdz[1] - from.tdz[1];
      if (world && world.wind) {
        const wv = world.wind(to.x, to.elev + 30, to.z, ap.t);
        if (Math.hypot(wv[0], wv[2]) > 0.7) { hx = -wv[0]; hz = -wv[2]; }
      }
      ap.frame = mkFrame(to, hx, hz);
      // aim from the ACTUAL approach threshold of the chosen frame. The
      // old "-450 - 0.25*len" assumed the tdz sits 25% from the approach
      // end, which is only true in the record's canonical direction — a
      // FLIPPED arrival aimed 0.5*len (195 m at Stein) too deep. In the
      // canonical direction sThr is identical to the old formula, so
      // calm bearing-picked gates are untouched.
      const sCen = (to.x - ap.frame.ox) * ap.frame.ux + (to.z - ap.frame.oz) * ap.frame.uz;
      const sThr = sCen - to.len / 2;
      ap.xAim = Math.max(A.xAim, sThr + 40);
      // short strips (fly-in benches, len < 450): aim just past the
      // threshold and fly the fiche's short-field speed if it has one —
      // the 1100 m-runway VAppr floats a third of a 340 m strip away.
      ap.shortFld = to.len < 450;
      if (ap.shortFld) {
        ap.xAim = sThr + 75;       // measured touch scatter -50..+20 about aim
        if (A.VApprShort) ap.VAppr = A.VApprShort;
      } else ap.VAppr = A.VAppr;   // re-arm after a short-strip leg
    }
    ap.dirX = 1;
    ap.altRef = to.elev;
    ap.refAlt = ap.restAlt + (to.elev - from.elev);
  };
  let thP = 0, phP = 0, eP = 0, q = 0, p = 0, eR = 0, eRslow = 0, thF = 0, phF = 0, thCA = 0, vsF = 0;
  // W19: a 2 s climb-rate filter kept OUTSIDE holdVS's vsF, which only updates
  // on frames that call holdVS and would change the fleet's VS loop if shared.
  // Read by the CLIMB acceptance below; written every frame, used nowhere else.
  let vsSlow = 0, gaT = 0;
  let aDe = 0, aDa = 0, aDr = 0, phCA = 0;
  let Ith = 0, thcI = 0.06, It = 0, thrC = 0.6;
  let phaseT = 0, headingCapT = 0, thFlare0 = 0, thLift0 = 0, brakeRamp = 0, holdActive = false, holdWas = false;
  let eAP = 0, eAR = 0, eARslow = 0;   // course-over-ground error chain (air guidance)
  let eTrim = 0;                        // wind-only course trim (standing bank for slip)
  let pendReEng = false;                // W14: full state re-latch on next update
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  // W14 manual-controls prep: call when the AP resumes after a stretch of
  // external/manual flight — every integrator, filter and servo memory
  // re-latches from the live state on the next update, so re-engage flies
  // from the CURRENT attitude instead of stale pre-handoff state (the
  // DC-3-at-Vr nose-over documented in HANDOVER). restAlt is left alone:
  // it anchors the current route's altitude refs. Never called by the
  // AP's own flow — zero effect on existing batteries.
  ap.reEngage = () => { pendReEng = true; };

  ap.update = (dt) => {
    ap.t += dt; phaseT += dt;
    const [xA, yU, zR] = sim.axes();
    const cg = sim.cgPos(), vcg = sim.cgVel();
    if (ap.restAlt === null) { ap.restAlt = cg[1]; ap.refAlt = cg[1]; }
    const agl = cg[1] - ap.refAlt;
    // runway-frame coordinates: sAl along the frame axis (was cg[0]),
    // sCr cross-track (was cg[2]); HOME frame is exactly s=x, cross=z
    const F = ap.frame;
    const rxF = cg[0] - F.ox, rzF = cg[2] - F.oz;
    const sAl = rxF * F.ux + rzF * F.uz;
    const sCr = -rxF * F.uz + rzF * F.ux;
    // V = AIRSPEED (aero speeds: rotation, approach, stall margins);
    // Vg = groundspeed (wheels: brakes, stop detection). The wind sample is
    // the solver's last CG wind — exact zeros when no wind is set, so the
    // zero-wind battery is byte-identical to the pre-wind one.
    //
    // AND V IS AN EQUIVALENT AIRSPEED (G72). Every speed this autopilot flies —
    // VClimb, VCruise, VAppr, VTurn, VClimbMin, VDerotate — was derived or
    // tuned at rho0, which makes every one of them an EAS whether anyone said
    // so or not. Feeding it a TRUE airspeed instead works perfectly at sea
    // level and stalls the aeroplane at altitude, because it would hold a
    // number that no longer corresponds to the dynamic pressure it was chosen
    // for. easK is exactly 1 at sea level, so this line moves nothing there.
    // Vt (TRUE) is kept for beta, which is a geometric angle and wants the real
    // speed, not the felt one.
    const o_ = sim.out;
    const Vg = Math.hypot(vcg[0], vcg[1], vcg[2]);
    const Vt = Math.hypot(vcg[0] - (o_.windX || 0), vcg[1] - (o_.windY || 0), vcg[2] - (o_.windZ || 0));
    const V = Vt * (o_.easK || 1);
    const nose = [-xA[0], -xA[2]];
    const nL = Math.hypot(nose[0], nose[1]) || 1e-9;
    nose[0] /= nL; nose[1] /= nL;

    let tx = ap.targetDir[0], tz = ap.targetDir[2];
    if (ap.trackHold) {
      const L = ap.phase === 'ROLL' || ap.phase === 'ROLLOUT' ? (A.lookRoll ?? 25)
              : ap.phase === 'APPROACH' || ap.phase === 'FLARE' ? (A.lookAppr ?? 100)
              : (A.lookCruise ?? 150);
      const fx = ap.dirX * L, fz = -sCr;      // pursuit target in frame coords
      tx = fx * F.ux - fz * F.uz; tz = fx * F.uz + fz * F.ux;
      const l = Math.hypot(tx, tz); tx /= l; tz /= l;
    }
    const e = Math.atan2(tz * nose[0] - tx * nose[1], tx * nose[0] + tz * nose[1]);
    // air guidance steers COURSE OVER GROUND, not the nose: a crabbing /
    // slipping aircraft with nose-referenced pursuit parks at a standing
    // cross-track offset ~ L*(crab - slip) with e exactly zero (measured:
    // C172 frozen at z=+21..26 in a 3 m/s crosswind). Velocity-referenced
    // pursuit makes the crab implicit. Ground steering keeps the nose error.
    let eA = e;
    const tl2 = Math.hypot(vcg[0], vcg[2]);
    if (tl2 > 5) {
      const tkx = vcg[0] / tl2, tkz = vcg[2] / tl2;
      eA = Math.atan2(tz * tkx - tx * tkz, tx * tkx + tz * tkz);
    }

    const AF = A.attFilt ?? 1.0;
    const thRaw = Math.asin(clamp(-xA[1], -1, 1));
    const phRaw = Math.atan2(-zR[1], yU[1]);
    if (pendReEng) {                    // W14: re-latch everything live
      pendReEng = false;
      thF = thRaw; phF = phRaw; thP = thRaw; phP = phRaw; q = p = 0;
      eP = e; eR = eRslow = 0; eAP = eA; eAR = eARslow = 0;
      vsF = vcg[1]; thCA = thRaw; phCA = 0;
      aDe = sim.ctl.de; aDa = sim.ctl.da; aDr = sim.ctl.dr;
      Ith = 0; It = 0; thcI = 0.06; thrC = A.thrCruise ?? 0.6;
      eTrim = 0; brakeRamp = 0; holdWas = holdActive = false;
    }
    thF += AF * (thRaw - thF); phF += AF * (phRaw - phF);
    const th = thF, ph = phF;
    const RF = A.rateFilt ?? 0.12;
    q += RF * ((th - thP) / dt - q); thP = th;
    p += RF * ((ph - phP) / dt - p); phP = ph;
    eR += RF * 0.85 * ((e - eP) / dt - eR); eP = e;
    eRslow += dt / 2.0 * (eR - eRslow);
    eAR += RF * 0.85 * ((eA - eAP) / dt - eAR); eAP = eA;
    eARslow += dt / 2.0 * (eAR - eARslow);
    vsSlow += dt / 2.0 * (vcg[1] - vsSlow);
    const beta = (vcg[0]*zR[0] + vcg[1]*zR[1] + vcg[2]*zR[2]) / Math.max(Vt, 5);

    const c = sim.ctl, onG = sim.wheelsOnGround();
    if (onG > 0 && agl < A.aglGuard && V < A.VRot * 0.9
        && ['LIFTOFF','CLIMB'].includes(ap.phase)) {
      ap.phase = 'ROLL'; phaseT = 0;      // genuinely settled back (slow): retry
    }

    const holdPitch = (thC) => {
      // W14 fix of the documented holdWas bug: resync whenever the
      // PREVIOUS update did not call holdPitch (bookkeeping at the end of
      // ap.update). Continuous phase chains behave identically — the
      // resync now also fires after ROLL retries and manual-flight gaps
      // instead of only on the very first call of the AP's life.
      if (!holdWas) thCA = th;                // (re-)engage from current attitude
      holdActive = true;
      const sl = (A.pitchCmdSlew ?? 99) * dt;
      thCA += clamp(thC - thCA, -sl, sl);
      Ith = clamp(Ith + (A.pitchI ?? 0.05) * (thCA - th) * dt, -0.15, 0.15);
      c.de = clamp((A.pitchP ?? 1.2) * (thCA - th) - (A.pitchD ?? 1.8) * q + Ith, -0.30, 0.35);
    };
    const airLateral = (bankLim = A.bankLim ?? 0.30) => {
      // standing-disturbance trim: a slipping aircraft (dihedral, ariK=0)
      // needs a standing bank to hold a crosswind course; P-only leaves a
      // residual course error and a ~L*residual cross-track hang (Jodel 20 m,
      // DC-3 11 m measured). Integrate ONLY in the trim regime (|eA| small):
      // integrating during the capture is the windup failure documented in
      // HANDOVER. Exact zero in calm air.
      if (Math.abs(o_.windX || 0) + Math.abs(o_.windZ || 0) > 0.5) {
        if (Math.abs(eA) < 0.2) eTrim = clamp(eTrim + 0.15 * eA * dt, -0.10, 0.10);
        else eTrim -= 0.8 * eTrim * dt;
      }
      const phC = clamp((A.hdgP ?? 0.7) * eA + (A.hdgD ?? 0.9) * eAR + eTrim, -bankLim, bankLim);
      phCA += clamp(phC - phCA, -(A.bankSlew ?? 0.18) * dt, (A.bankSlew ?? 0.18) * dt);
      c.da = clamp((A.rollP ?? 2.0) * (phCA - ph) - (A.rollD ?? 2.0) * p, -0.30, 0.30);
      c.dr = clamp(-(A.betaK ?? 0.3) * beta - (A.yawDampK ?? 0.6) * (eAR - eARslow)
                   - (A.ariK ?? 0.35) * c.da, -0.25, 0.25);
    };
    const speedThrottle = (Vt) => {
      It = clamp(It + 0.010 * (Vt - V) * dt, -0.30, 0.30);
      c.thr = clamp(thrC + 0.05 * (Vt - V) + It, A.thrFloor ?? 0.12, 1);
    };
    const holdVS = (VSc, thMax = 0.16) => {
      vsF += (A.vsFilt ?? 1.0) * (vcg[1] - vsF);
      const fl = A.vsFloor ?? -0.08;
      thcI = clamp(thcI + (A.vsI ?? 0.015) * (VSc - vsF) * dt, fl, thMax);
      holdPitch(clamp(thcI + (A.vsP ?? 0.010) * (VSc - vsF), fl, thMax));
    };
    const groundSteer = () => {
      c.dr = clamp(-3.2 * e - 1.2 * eR, -0.45, 0.45);
      c.da = clamp(-2.0 * ph - 1.0 * p, -0.25, 0.25);
    };

    // W14 taxi governor: slow ground speed hold, slower through tight turns
    const taxi = (Vt) => {
      c.de = A.taxiDe ?? 0.30;             // stick aft: tailwheel planted, steering bites
      // taxiFF cancels rolling resistance, the speed error does the rest, and
      // the cap rises with the feedforward so a heavy-footed aeroplane still
      // has the same 0.27 of authority ABOVE break-even that 0.35 used to mean.
      const ff = taxiFF();
      c.thr = clamp(ff + 0.06 * (Vt - Vg), 0, ff + 0.27);
      c.brake = Vg > Vt + 1.2 ? 0.45 : 0;
      c.da = clamp(-2.0 * ph - 1.0 * p, -0.25, 0.25);
    };

    // W19 MISSED APPROACH. Everything from APPROACH onwards used to be one-way:
    // once committed the autopilot arrived whatever happened, because the only
    // re-entry in the whole machine was the balked-takeoff guard. Each trigger
    // below is set well outside every fiche's measured margin, and gaN caps the
    // attempts — a go-around loop is worse than a firm arrival, and a gate run
    // has to terminate.
    const goAround = why => {
      ap.gaN = (ap.gaN || 0) + 1; ap.gaWhy = why;
      ap.phase = 'GOAROUND'; phaseT = 0; gaT = 0;
      thrC = A.thrCruise;
    };
    // W19 GROUND FLOOR on the cruise legs. Measured: a build flew the last
    // 1.5 km of INBOUND at 1 m agl and nothing in the autopilot objected.
    // hSafe is the AP's own "safely airborne" height; the fleet's minimum on
    // these legs is 87-90 m against an hSafe of 8-30, so this never fires
    // for them.
    // hSafe ALONE, not max(hSafe, something): the drone's whole circuit is
    // 60 m and its hSafe is 8, so a flat 25 m floor forced a climb in the
    // middle of its INBOUND descent and moved its gate numbers. hSafe is
    // already scaled per aeroplane, which is the whole point of it.
    const vsAgl = v => agl < A.hSafe ? Math.max(v, 1.0) : v;

    switch (ap.phase) {
      case 'DEPART': {
        // one-shot planning with the live pose (see ap.departFrom)
        const from = ap.route.from;
        const axx = snap(Math.cos(from.hdg)), axz = snap(Math.sin(from.hdg));
        let dx = nose[0], dz = nose[1];
        if (world && world.wind) {
          const wv = world.wind(from.x, from.elev + 30, from.z, ap.t);
          if (Math.hypot(wv[0], wv[2]) > 0.7) { dx = -wv[0]; dz = -wv[2]; }
        }
        const sg = (dx * axx + dz * axz) >= 0 ? 1 : -1;
        const ux = axx * sg, uz = axz * sg;          // takeoff direction
        ap.frame = mkFrame(from, -ux, -uz);          // frame u = landing dir
        ap.dirX = -1;
        const need = (A.TORun ?? 500) + 60;
        const sPos = (cg[0] - from.x) * ux + (cg[2] - from.z) * uz;
        // G151: HOW FAR OFF THE CENTRELINE — the question this planner never
        // asked, because until the stand was wired every departure already
        // stood on the strip. LINEUP is a FINAL ALIGNMENT: it pursues the
        // centreline at taxi speed on whatever intercept it happens to have,
        // which is right after a backtrack turn (a metre or two off) and
        // hopeless from an APRON. MEASURED from the home stand, 40 m out:
        // 324 s to reach ROLL, wandering 375 m down the runway to do it, and
        // the test pilot's 600 s budget then expired during the ROLLOUT of a
        // perfectly sound aeroplane. So when we are genuinely off the strip,
        // TAXI onto the centreline first — which is what TAXI already does.
        const sCr0 = -(cg[0] - from.x) * uz + (cg[2] - from.z) * ux;
        const offCl = Math.abs(sCr0) > 15;
        if (!offCl && from.len / 2 - sPos >= need) { ap.phase = 'LINEUP'; phaseT = 0; break; }
        // THE DECLARED WAY OUT wins whenever the site states one, because the
        // obstacles are the PLACE's and this planner cannot see a fence.
        if (offCl && ap.taxiOut) {
          const path = ap.taxiOut.map(p => [p[0], p[1]]);
          ap.taxiTgt = path.shift();
          ap.taxiPath = path;
          ap.phase = 'TAXI'; phaseT = 0;
          break;
        }
        // THE ENTRY POINT, computed. On the centreline and short of runway —
        // the BACKTRACK case — this is the run start, and the expression is
        // unchanged because GATE XCTY5 flies exactly it.
        // Off the centreline with nothing declared, aim AHEAD by a lead
        // proportional to the offset so the intercept is shallow: TAXI's own
        // 22 m exit then hands over near LINEUP's 8 m gate rather than far
        // outside it. Clamped onto the strip, and far enough back that the run
        // still fits.
        const sStart = offCl
          ? Math.min(Math.max(sPos + Math.max(60, 3.5 * Math.abs(sCr0)),
                              -from.len / 2 + 25), from.len / 2 - need - 25)
          : Math.max(-from.len / 2 + 25, from.len / 2 - need - 25);
        ap.taxiTgt = [from.x + ux * sStart, from.z + uz * sStart];
        ap.taxiPath = null;
        ap.phase = 'TAXI'; phaseT = 0;
        break;
      }

      case 'TAXI': {
        const ddx = ap.taxiTgt[0] - cg[0], ddz = ap.taxiTgt[1] - cg[2];
        const dist = Math.hypot(ddx, ddz) || 1e-9;
        ap.targetDir = [ddx / dist, 0, ddz / dist];
        c.dr = clamp(-3.2 * e - 1.2 * eR, -0.45, 0.45);
        taxi(Math.abs(e) > 0.6 ? 2.2 : 4.5);
        // G151: a declared route is a LIST of points, and only the LAST one
        // hands over to LINEUP. Intermediate points are held to a tighter
        // radius than the final one, because a 22 m corner-cut through a 24 m
        // fence gate is a fence. A single-target taxi — W14's backtrack — has
        // no list, takes the 22 m branch, and is unchanged.
        const lastLeg = !(ap.taxiPath && ap.taxiPath.length);
        if (dist < (lastLeg ? 22 : 10) || phaseT > 120) {
          if (lastLeg) { ap.phase = 'LINEUP'; phaseT = 0; }
          else { ap.taxiTgt = ap.taxiPath.shift(); phaseT = 0; }
        }
        break;
      }

      case 'LINEUP': {
        ap.trackHold = true;                 // centreline pursuit, dirX = -1
        c.dr = clamp(-3.2 * e - 1.2 * eR, -0.45, 0.45);
        const alig = -(nose[0] * F.ux + nose[1] * F.uz);  // dot(nose, takeoff dir)
        taxi(alig > 0.5 ? 4.5 : 2.4);
        if (alig > 0.988 && Math.abs(sCr) < 8 && Math.abs(eR) < 0.15) {
          ap.phase = 'ROLL'; phaseT = 0;
          ap.t = Math.max(ap.t, 1);          // ROLL's 0.5 s throttle delay is long past
        }
        break;
      }

      case 'ROLL':
        c.thr = ap.t > 0.5 ? 1 : 0; c.brake = 0;
        if (A.rotate) {
          // taildragger sequence: tail up first, run on the mains, rotate at Vr
          if (V > A.VRot) holdPitch(A.thRotate ?? A.liftoffTh);
          else if (V > A.VTailUp) holdPitch(A.thTailUp ?? 0.02);
          else c.de = A.rollDe;
        } else c.de = A.rollDe;
        groundSteer();
        if (onG === 0 && V > A.VRot) { ap.phase = 'LIFTOFF'; phaseT = 0; thLift0 = th; }
        break;

      case 'LIFTOFF':
        c.thr = 1;
        holdPitch(Math.min(thLift0 + (A.liftoffRamp ?? 9) * phaseT, A.liftoffTh));
        airLateral(0.15);
        if (agl > A.hSafe && V > A.VClimbMin) { ap.phase = 'CLIMB'; phaseT = 0; }
        break;

      case 'CLIMB': {
        c.thr = 1;
        holdPitch(clamp(A.climbThBase + A.climbThGain * (V - ap.VClimb), 0.02, A.thMax));
        airLateral();
        // ACCEPT WHAT IT CAN ACTUALLY CLIMB (W19). CLIMB used to have exactly
        // one exit — reaching hCruise — so an aeroplane that could not reach
        // the circuit height stayed in it until the clock ran out. That IS the
        // reported "it keeps climbing forever": measured, a 28 hp build sat
        // here for 350 s at 0.09 m/s, and a short-span one for 286 s.
        // The cure is to stop pretending: take the height it has, fly the
        // circuit at that, and let the glideslope intercept sooner. gs and
        // refAlt carry the arrival, so a lower circuit is self-consistent.
        //
        // NO-OP FOR THE FLEET, by two independent margins: it needs 60 s in
        // CLIMB *and* a 2 s-filtered climb rate under 0.15 m/s, where the
        // fiches climb at 3-5 m/s and top out in 14-47 s.
        const stalled = phaseT > 60 && vsSlow < 0.15;
        if (stalled) ap.hCruise = Math.max(A.hSafe + 10, cg[1] - ap.altRef);
        if (cg[1] > ap.altRef + ap.hCruise - 8 || stalled) {
          if (ap.xc) {
            // remember the (safe, flat) climb-out heading: ENROUTE climbs
            // on it before turning toward terrain it cannot out-climb
            ap.holdDir = [ap.frame.ux * ap.dirX, 0, ap.frame.uz * ap.dirX];
            ap.phase = 'ENROUTE'; enterArrival(); ap.trackHold = false;
          } else ap.phase = 'CRUISE';
          phaseT = 0; thrC = A.thrCruise; thcI = 0.04;
        }
        break;
      }

      case 'CRUISE':
        speedThrottle(ap.VCruise);
        holdVS(vsAgl(clamp((A.altVSGain ?? 0.08) * (ap.altRef + ap.hCruise - cg[1]), -2.2, 2.2)));
        airLateral();
        if (sAl < ap.xTurn) {
          ap.phase = 'TURNBACK'; phaseT = 0;
          ap.trackHold = false; enterArrival();
          ap.targetDir = [ap.frame.ux, 0, ap.frame.uz];
        }
        break;

      case 'ENROUTE': {
        // cross-country leg: steer at the APPROACH FIX — the frame point
        // (xTurn, 0) on the destination's extended centreline — so arrival
        // works from any bearing (an "s > xTurn" handoff alone is a trap:
        // approaching from abeam, along-track is instantly inside xTurn
        // while cross-track is kilometres out — measured, Holtorham probe).
        // Altitude is terrain-aware: clear the highest terrain within
        // ~4 km of track, then sink back to circuit height (asymmetric VS
        // budget — the mountain belt needs more descent than a circuit).
        speedThrottle(ap.VCruise);
        // approach fix 1.2 km before xTurn on the extended centreline —
        // buys INBOUND room to settle onto the slope after a high arrival.
        // W14: arrivals HIGHER than the fix cone push the fix OUTBOUND so
        // the whole descent fits the final (excess height converts to
        // track at a -0.10 slope; it walks back in as the aircraft
        // descends). A Stein -> HOME PA-18 arrived 160 m over the old
        // fixed fix — INBOUND couldn't shed it by the aim and flew a
        // controlled descent into the dirt 200 m past the strip.
        const hCone0 = ap.refAlt + (ap.xAim - (ap.xTurn - 1200)) * ap.gs + 15;
        const fixOut = 1200 + Math.max(0, (cg[1] - hCone0) / 0.10);
        const fdx = (ap.xTurn - fixOut) - sAl, fdz = -sCr;
        const fDist = Math.hypot(fdx, fdz) || 1;
        const fixDir = [(fdx * F.ux - fdz * F.uz) / fDist, 0,
                        (fdx * F.uz + fdz * F.ux) / fDist];
        // terrain guard samples along the LEG track (not velocity — at the
        // turn the velocity still points down the old leg while the belt
        // rises on the new one; measured 1 m clearance). 7.5 km horizon.
        let hTgt = ap.altRef + ap.hCruise;
        if (world) {
          // dense near samples: 1.5 km gaps let narrow warped ridges slip
          // between guard points (measured 16 m clearance over one)
          for (const dA of [0, 400, 800, 1500, 2500, 4000, 5500, 7500]) {
            const hT = world.terrainH(cg[0] + fixDir[0] * dA, cg[2] + fixDir[2] * dA)
                     + (A.hClear ?? 130);
            if (hT > hTgt) hTgt = hT;
          }
        }
        // climb FIRST on the (flat, known) climb-out heading when the leg
        // needs more altitude than we have — the belt south of the corridor
        // rises faster than any of the fleet can climb head-on
        ap.targetDir = (hTgt - cg[1] > 60 && ap.holdDir) ? ap.holdDir : fixDir;
        holdVS(vsAgl(clamp((A.altVSGain ?? 0.08) * (hTgt - cg[1]), -4.5, 2.2)));
        airLateral();
        if (fDist < 600) { ap.phase = 'INBOUND'; phaseT = 0; ap.trackHold = true; }
        break;
      }

      case 'TURNBACK':
        speedThrottle(A.VTurn ?? ap.VCruise);
        holdVS(vsAgl(clamp((A.altVSGain ?? 0.08) * (ap.altRef + ap.hCruise - cg[1]), -2.2, 2.2)));
        airLateral();
        headingCapT = Math.abs(e) < 0.12 ? headingCapT + dt : 0;
        if (headingCapT > 1.5) { ap.phase = 'INBOUND'; phaseT = 0; ap.trackHold = true; }
        break;

      case 'INBOUND': {
        // THE LITERAL 24 IS THE CUB FAMILY'S, and it stays. It is that
        // aeroplane's own (VCruise+VAppr)/2 = 23.75 frozen into the
        // autopilot, and cub/pa18/drone genuinely fly it — note TURNBACK
        // above falls back to VCruise instead, so those three fly 26/26/13
        // on the turnback and 24 on the inbound, and no single VTurn key can
        // say that. Stating one in the fiches to "make the default explicit"
        // was tried and MOVED THE FLEET (drone elevator chatter 0.3 ->
        // 5.5 deg/s, M3 stop 1 m, PA18 stop 5 m).
        //
        // What was actually wrong is that GENERATED fiches never set VTurn
        // either, so every garage build was commanded the Cub's 24 whatever
        // it was: 0.6x trim on a 39 m/s build (throttle to the floor, 100 m
        // lost over the leg, the last 1.5 km at 1 m agl) and 1.04x on a
        // 23 m/s one (full throttle, float, touch 240 m past the aim). Both
        // reported symptoms, one constant. genTuneAP now emits VTurn, so
        // this fallback is reached only by the family it was tuned on.
        speedThrottle(A.VTurn ?? 24);
        const d = ap.xAim - sAl;
        // Math.max(0, d): past the aim the raw slope target dives below
        // the field and INBOUND flew into the dirt (W14, Stein return
        // leg). No-op before the aim, i.e. for every nominal arrival.
        const hGS = ap.refAlt + Math.max(0, d) * ap.gs;
        // descend toward just-above-slope when arriving HIGH (cross-country
        // over the belt): min() is a no-op for standard circuits, which fly
        // level at hCruise below the slope until it comes down to them
        const hTgt = Math.min(ap.altRef + ap.hCruise, hGS + 15);
        holdVS(vsAgl(clamp((A.altVSGain ?? 0.08) * (hTgt - cg[1]), -3.5, 2.2)));
        airLateral();
        // in wind: align laterally BEFORE descending (localizer before
        // glideslope) — the turnback exits ~1.2-1.6 km off centreline and a
        // capture flown inside the descent runs out of approach (Jodel landed
        // 16 m off, DC-3 10 m). Calm-air condition untouched.
        // NOTE: no align-before-descend gate. It was tried and is geometrically
        // a trap here: the level alignment leg makes the descent start above
        // the slope by gs*(leg length), which the catch-up authority cannot
        // recover (Jodel/DC-3 landed 0.6-1.1 km long). In-descent capture
        // works once the course loop carries a slip trim (see airLateral).
        // the <40 bound keeps a high cross-country arrival in INBOUND (still
        // descending) instead of engaging APPROACH far above the slope;
        // standard circuits switch from BELOW (cg-hGS ~ -2), unaffected
        if (d > 0 && hGS <= cg[1] + 2 && cg[1] - hGS < 40) { ap.phase = 'APPROACH'; phaseT = 0; thrC = A.thrAppr; }
        // PAST THE AIM AND STILL AIRBORNE (W19). hGS collapses to refAlt here
        // (the Math.max above), hTgt becomes refAlt+15, and the handoff is
        // gated on d > 0 — so this state could never leave INBOUND. The
        // aeroplane levelled at 15 m agl and flew straight ahead for ever.
        // FLEET-UNREACHABLE: every fiche hands off at d = hCruise/gs, i.e.
        // 800-4200 m before the aim.
        else if (d <= 0) {
          if (agl < A.flareAgl * 3 || (ap.gaN || 0) >= 2) {
            ap.phase = 'APPROACH'; phaseT = 0; thrC = A.thrAppr;   // low: just land it
          } else goAround('past-aim');
        }
        break;
      }

      case 'APPROACH': {
        speedThrottle(ap.VAppr);
        const d = ap.xAim - sAl;
        const hGS = ap.refAlt + Math.max(0, d) * ap.gs;
        // catch-up clamp scales with the aircraft's own slope rate: a flat
        // -3.0 gave the DC-3 (nominal -2.6 m/s on its slope) only 0.4 m/s of
        // authority to descend back onto the slope from above
        // feedforward uses GROUNDSPEED (W13.2): the slope is fixed in the
        // ground frame — -V*gs in a headwind commands W*gs too much sink
        // and the +0.5 recovery clamp cannot close the standing low (the
        // PA-18 crossed the Stein threshold 5.6 m under the slope and
        // touched 83 m short of the aim). Identical in calm (Vg = V).
        holdVS(clamp(-(o_.Vg ?? V) * ap.gs + 0.12 * (hGS - cg[1]), Math.min(-3.0, -1.6 * V * ap.gs), 0.5));
        airLateral(0.18);
        // W19 missed approach: HIGH ON THE SLOPE, sustained. Measured fleet
        // margin — cub 3.2 m, pa18 5.5 m, drone 26.2 m above the slope at
        // worst, against 60. INBOUND only hands over inside 40 m of the
        // slope, so reaching 60 means it climbed away from it.
        //
        // AN OVERSPEED TRIGGER WAS TRIED AND REMOVED. `V > 1.35*VAppr` looks
        // obviously safe and is not: the drone's INBOUND rides the literal 24
        // against a VAppr of 9, so it enters APPROACH at 1.48 and fired TWO
        // go-arounds on a gate that had passed for years. A genuine float is
        // caught by the FLARE timeout below, which needs no speed threshold.
        gaT = cg[1] - hGS > 60 ? gaT + dt : 0;
        if (gaT > 5 && (ap.gaN || 0) < 2) { goAround('high'); break; }
        if (agl < A.flareAgl) { ap.phase = 'FLARE'; phaseT = 0; thFlare0 = th; }
        break;
      }

      case 'GOAROUND':
        // Deliberately dull: it reuses the CLIMB laws, then rejoins the circuit
        // OUTBOUND (dirX -1, trackHold on) so CRUISE -> TURNBACK -> INBOUND
        // re-flies the whole arrival, including a fresh enterArrival(). Flaps
        // come up by themselves — the schedule at the foot of update() targets
        // 0 outside APPROACH/FLARE.
        c.thr = 1; c.brake = 0;
        holdPitch(clamp(A.climbThBase + A.climbThGain * (V - ap.VClimb), 0.02, A.thMax));
        airLateral(0.20);
        if (cg[1] > ap.altRef + ap.hCruise - 8 || (phaseT > 60 && vsSlow < 0.15)) {
          ap.phase = 'CRUISE'; phaseT = 0;
          ap.dirX = -1; ap.trackHold = true;
          thrC = A.thrCruise; thcI = 0.04;
        }
        break;

      case 'FLARE':
        c.thr = A.flareThr ?? 0;
        // W19: a flare that will not end is a float. The fleet flares for ~3 s
        // (flareAgl is 3.2 s of sink by construction), so 20 s cannot happen
        // to them.
        if (phaseT > 20 && (ap.gaN || 0) < 2) { goAround('float'); break; }
        if (A.flareMode === 'vs') {
          // sink-rate-targeted flare (needs a fast VS loop)
          holdVS(-(0.15 + 0.28 * Math.max(0, agl)), A.flareThMax ?? A.thMax);
        } else {
          // progressive attitude ramp toward the arrival attitude
          holdPitch(Math.min(thFlare0 + A.flareRate * phaseT, A.flareThMax ?? A.thMax));
        }
        // crosswind decrab: below decrabAgl, the rudder aligns the nose with
        // the runway while airLateral keeps killing drift with bank (slip).
        // Inactive in calm air (windZ gate) — zero-wind identity preserved.
        if (agl < (A.decrabAgl ?? 3.5) && Math.abs(o_.windZ || 0) > 0.5) {
          airLateral(0.12);
          const nS = nose[0] * F.ux + nose[1] * F.uz;      // frame-relative nose
          const nC = -nose[0] * F.uz + nose[1] * F.ux;
          const hdg = Math.atan2(nC, nS * ap.dirX) * ap.dirX;
          c.dr = clamp(-(A.decrabK ?? 2.2) * hdg - 0.6 * eR, -0.35, 0.35);
        } else airLateral(0.10);
        if (onG > 0) {
          ap.phase = 'ROLLOUT'; phaseT = 0;
          ap.tdInfo = { sink: -vcg[1], z: sCr, x: sAl, V,
                        drift: -vcg[0] * F.uz + vcg[2] * F.ux };
        }
        break;

      case 'ROLLOUT': {
        c.thr = 0;
        if (A.rolloutMode === 'trike') {
          if (V > (A.VDerotate ?? 20)) holdPitch(A.rolloutTh ?? 0.035);
          else c.de = 0.15;
        // VTailDown (default VTailUp): below it, stick hard back pins the tail.
        // Flapped taildraggers set it above touchdown speed — flap lift +
        // nose-down dCm0 make the tail-up wheel-landing hold noseover-prone.
        // thPinMax guard (W13.2): full-aft AT TOUCH SPEED with flaps out
        // re-flies the aircraft — the PA-18 ballooned to 3 m agl / 18 deg
        // nose-up for 4 s after every touchdown (traced at Stein; HOME's
        // 1100 m simply absorbed it). Relax the pin while the nose is
        // above ~3-point attitude; identical otherwise (rest deck ~0.21).
        // VPinFull (default 0 = old behavior): above it, only moderate aft
        // — the full pin AT touch speed is itself the re-launch impulse;
        // brakes engage far below it, so the noseover guard window holds.
        } else c.de = V > (A.VTailDown ?? A.VTailUp) ? -0.05
                    : (th > (A.thPinMax ?? 0.26) ? 0.05
                    : V > (A.VPinFull ?? 0) ? 0.14 : 0.35);
        // brakes act on WHEELS: thresholds are groundspeed, not airspeed
        if (Vg < A.VBrakeOn) brakeRamp = Math.min(brakeRamp + A.brakeRampRate * dt, A.brakeMax);
        c.brake = brakeRamp * Math.min(1, Math.max(0, (Vg - A.VBrakeRelease) / 2.0));
        groundSteer();
        if (Vg < A.VStop) { ap.phase = 'STOPPED'; phaseT = 0; }
        break;
      }

      case 'STOPPED':
        c.thr = 0; c.de = 0.35; c.brake = 0.25; c.da = 0; c.dr = 0;
        break;
    }
    // flaps: phase-scheduled, rate-limited (flaps travel over seconds, and the
    // slow deployment is what lets holdPitch absorb the nose-down dCm0 step).
    // Retracted for the rollout: weight back on the wheels for brake grip.
    const FS = def.params.flaps;
    if (FS) {
      const tgt = ap.phase === 'APPROACH' || ap.phase === 'FLARE' ? (FS.ldg ?? 1)
                : ap.phase === 'ROLL' || ap.phase === 'LIFTOFF' ? (FS.to ?? 0)
                : 0;
      const rr = (FS.rate ?? 0.15) * dt;
      c.flap = clamp(c.flap + clamp(tgt - c.flap, -rr, rr), 0, 1);
    }
    // servo slew limits
    aDe += clamp(c.de - aDe, -A.slew * dt, A.slew * dt); c.de = aDe;
    aDa += clamp(c.da - aDa, -A.slew * dt, A.slew * dt); c.da = aDa;
    aDr += clamp(c.dr - aDr, -A.slew * dt, A.slew * dt); c.dr = aDr;
    holdWas = holdActive; holdActive = false;   // W14: per-frame resync bookkeeping
    ap.dbg = { e, th, ph, q, beta, V, alt: cg[1], z: sCr, s: sAl, agl };
  };
  return ap;
}

// ============================================================
// THE TEST PILOT (G107, ROADMAP P-2 / QUALITY-REVIEW P-2). A SECOND autopilot,
// forked VERBATIM from 40_autopilot.js's makeAutopilot and then given the one
// thing that file cannot grow without moving eleven calibrated fleet gates:
// BOUNDED ATTEMPTS WITH STRUCTURED VERDICTS. The user's brief, in their words:
// "It should really behave more like a test pilot... The autopilot would take
// appropriate actions when unable to reach the setpoints, or if the
// performance of the plane is too bad. It wouldn't take off, or wouldn't
// land. It really needs to rely on himself rather than the aircraft fully."
//
// WHO FLIES WHAT: generated builds (the garage) fly THIS pilot; the hand-built
// fleet keeps makeAutopilot, so WIND/M3/XCTY/... stay the benchmarks they are.
// GATE PILOT (tools/test_pilot.js) is this file's own battery, negative-first:
// an aeroplane that cannot fly MUST come back saying so, in bounded time.
//
// THE FORK RULE: every deliberate divergence from 40_autopilot.js is marked
// `TP:`. Anything unmarked is the fork being faithful, and a fix to the donor
// should be considered for a matching `TP:`-audited pass here. The donor's own
// W19 work (climb acceptance, missed approach, ground floor) is kept whole —
// this file extends it to the failures W19 left unbounded: ROLL had no exit at
// all (an aeroplane that never reaches Vr rolls to the fence, for ever), the
// balked-takeoff guard was an unbounded retry loop, a 0.2 m/s climber slips
// under the 0.15 m/s acceptance trigger and "climbs for ever", and nothing
// anywhere RECORDED what happened.
//
// THE REPORT is the contract: ap.report = { verdicts: [{t, code, note}],
// outcome, landing }. outcome is null in flight, then exactly one of
// 'completed' | 'rejected-takeoff' | 'gave-up' (a runner may add 'broke-up'
// when the sim itself diverges). 'completed' with verdicts in
// the list is an EVENTFUL flight (go-arounds, an accepted ceiling) — the
// distinction between clean and eventful is the report's whole point.
// landing = { run, sink, V, offCentre, pastAim } once stopped off a real
// touchdown — `run` is the landing run the plaque has never had.
// ============================================================
function makeTestPilot(sim, def, world) {
  const A = def.params.ap;
  // TP + G121: live mass (see the donor's note); exposed as ap.taxiFF so
  // the mass-proofing gate can watch it follow a drained tank.
  const taxiFF = (() => {
    const PP = POWERPLANTS[def.params.powerplant];
    const PR = def.params.prop || PP.prop;
    const T0 = Math.max(1, PR.Tstatic * (def.params.nEngines || 1));
    return () => Math.min(0.5, CRR * sim.totalM * 9.81 / T0);
  })();
  const snap = v => Math.abs(v) < 1e-9 ? 0 : v;
  const mkFrame = (a, sx, sz) => {
    let ux = snap(Math.cos(a.hdg)), uz = snap(Math.sin(a.hdg));
    if (sx !== undefined) {
      const d = ux * sx + uz * sz;
      if (d < 0) { ux = -ux; uz = -uz; }
    } else { ux = -ux; uz = -uz; }
    return { ux, uz, ox: a.tdz[0] + 450 * ux, oz: a.tdz[1] + 450 * uz };
  };
  const HOMEISH = { hdg: Math.PI, tdz: [-450, 0], elev: 0, len: 1100 };
  const ap = {
    phase: 'ROLL', t: 0, hCruise: A.hCruise, VClimb: A.VClimb,
    VCruise: A.VCruise, VAppr: A.VAppr,
    xTurn: A.xTurn, xAim: A.xAim, gs: A.gs,
    targetDir: [-1, 0, 0], trackHold: true, dirX: -1,
    restAlt: null, refAlt: null, altRef: 0, tdInfo: null, dbg: {},
    route: null, xc: false, frame: null, gaN: 0, gaWhy: null,
    // TP: the report, and the flight-time budget the watchdog holds it to
    report: { verdicts: [], outcome: null, landing: null },
    budget: 600,
  };
  // TP: a verdict is one line, timestamped, never overwritten. The pilot's
  // log of what it decided and why — the raw material of the WHY report.
  const say = (code, note) => {
    ap.report.verdicts.push({ t: Math.round(ap.t * 10) / 10, code, note });
  };
  ap.setRoute = (from, to) => {
    ap.route = { from, to };
    ap.xc = from !== to;
    ap.frame = mkFrame(from);
    ap.altRef = from.elev;
    ap.shortFld = false;
  };
  ap.setRoute(world ? world.aerodromes[0] : HOMEISH,
              world ? world.aerodromes[0] : HOMEISH);
  // G151: `taxiOut` — the site's declared way out. Donor's signature, carried.
  ap.departFrom = (from, to, taxiOut) => {
    ap.taxiPath = null;
    ap.taxiOut = (taxiOut && taxiOut.length) ? taxiOut : null;
    ap.route = { from, to };
    ap.xc = from !== to;
    ap.altRef = from.elev;
    ap.shortFld = false;
    ap.trackHold = false;
    ap.taxiTgt = null;
    ap.phase = 'DEPART'; phaseT = 0;
  };
  const enterArrival = () => {
    const { from, to } = ap.route;
    if (ap.xc) {
      let hx = to.tdz[0] - from.tdz[0], hz = to.tdz[1] - from.tdz[1];
      if (world && world.wind) {
        const wv = world.wind(to.x, to.elev + 30, to.z, ap.t);
        if (Math.hypot(wv[0], wv[2]) > 0.7) { hx = -wv[0]; hz = -wv[2]; }
      }
      ap.frame = mkFrame(to, hx, hz);
      const sCen = (to.x - ap.frame.ox) * ap.frame.ux + (to.z - ap.frame.oz) * ap.frame.uz;
      const sThr = sCen - to.len / 2;
      ap.xAim = Math.max(A.xAim, sThr + 40);
      ap.shortFld = to.len < 450;
      if (ap.shortFld) {
        ap.xAim = sThr + 75;
        if (A.VApprShort) ap.VAppr = A.VApprShort;
      } else ap.VAppr = A.VAppr;
    }
    ap.dirX = 1;
    ap.altRef = to.elev;
    ap.refAlt = ap.restAlt + (to.elev - from.elev);
  };
  let thP = 0, phP = 0, eP = 0, q = 0, p = 0, eR = 0, eRslow = 0, thF = 0, phF = 0, thCA = 0, vsF = 0;
  let vsSlow = 0, gaT = 0;
  let aDe = 0, aDa = 0, aDr = 0, phCA = 0;
  let Ith = 0, thcI = 0.06, It = 0, thrC = 0.6;
  let phaseT = 0, headingCapT = 0, thFlare0 = 0, thLift0 = 0, brakeRamp = 0, holdActive = false, holdWas = false;
  let eAP = 0, eAR = 0, eARslow = 0;
  let eTrim = 0;
  let pendReEng = false;
  // TP: the takeoff instrument — where the roll started, how many times it has
  // been attempted, and a 2 s acceleration filter for the stagnation call.
  let rollS0 = null, rollN = 0, accF = 0, vPrev = null;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  ap.reEngage = () => { pendReEng = true; };
  ap.taxiFF = taxiFF;              // TP/G121: instrument surface

  // TP: THE TEST CARD (G107.1). The game imposes a card on the flight —
  // target altitude and target speed — and the pilot flies it: the card
  // overrides the circuit height and the cruise speed, the flown MEANS are
  // measured on the settled cruise leg, and the plaque judges flown against
  // asked. The pilot CLAMPS an unsafe ask and says so — it will not cruise
  // slower than just above approach speed and it will not fly a circuit
  // under its own safe height — and the budget grows with the climb, so a
  // capable aeroplane asked for real altitude is given the time to earn it
  // instead of a 'gave-up'. Call before the first update.
  let cardAcc = null;                    // { n, alt, V, saidV } while flying
  ap.setCard = (card) => {
    if (!card || (!isFinite(card.alt) && !isFinite(card.V))) return;
    const c = { alt: null, V: null, altFlown: null, VFlown: null };
    if (isFinite(card.alt) && card.alt > 0) {
      c.alt = clamp(card.alt, A.hSafe + 20, 2500);
      if (c.alt !== card.alt)
        say('card-clamped', 'altitude ' + Math.round(card.alt) + ' m asked, ' +
            Math.round(c.alt) + ' m flown — the pilot sets the floor and the ceiling');
      ap.hCruise = c.alt;
      ap.budget = Math.max(ap.budget, 300 + c.alt * 1.5);
    }
    if (isFinite(card.V) && card.V > 0) {
      // the floor is the APPROACH SPEED ITSELF — a speed the aeroplane
      // sustains for minutes on every arrival, so it is a safe cruise ask.
      // It was VAppr*1.05 for one gate run, and the stock build's own
      // numbers refuted the margin: its VAppr (23.9) sits within 5% of its
      // cruise (25.2), so the arbitrary 5% clamped a legitimate near-cruise
      // ask UP. Narrow-envelope builds are the ones a test card exists for.
      c.V = clamp(card.V, A.VAppr || 15, 120);
      if (c.V !== card.V)
        say('card-clamped', 'speed ' + Math.round(card.V * 3.6) + ' km/h asked, ' +
            Math.round(c.V * 3.6) + ' km/h flown — not slower than the approach, not absurd');
      ap.VCruise = c.V;
    }
    ap.report.card = c;
    cardAcc = { n: 0, alt: 0, V: 0, saidV: false };
  };

  ap.update = (dt) => {
    ap.t += dt; phaseT += dt;
    const [xA, yU, zR] = sim.axes();
    const cg = sim.cgPos(), vcg = sim.cgVel();
    if (ap.restAlt === null) { ap.restAlt = cg[1]; ap.refAlt = cg[1]; }
    const agl = cg[1] - ap.refAlt;
    const F = ap.frame;
    const rxF = cg[0] - F.ox, rzF = cg[2] - F.oz;
    const sAl = rxF * F.ux + rzF * F.uz;
    const sCr = -rxF * F.uz + rzF * F.ux;
    const o_ = sim.out;
    const Vg = Math.hypot(vcg[0], vcg[1], vcg[2]);
    const Vt = Math.hypot(vcg[0] - (o_.windX || 0), vcg[1] - (o_.windY || 0), vcg[2] - (o_.windZ || 0));
    const V = Vt * (o_.easK || 1);
    const nose = [-xA[0], -xA[2]];
    const nL = Math.hypot(nose[0], nose[1]) || 1e-9;
    nose[0] /= nL; nose[1] /= nL;

    let tx = ap.targetDir[0], tz = ap.targetDir[2];
    if (ap.trackHold) {
      const L = ap.phase === 'ROLL' || ap.phase === 'ROLLOUT' ? (A.lookRoll ?? 25)
              : ap.phase === 'APPROACH' || ap.phase === 'FLARE' ? (A.lookAppr ?? 100)
              : (A.lookCruise ?? 150);
      const fx = ap.dirX * L, fz = -sCr;
      tx = fx * F.ux - fz * F.uz; tz = fx * F.uz + fz * F.ux;
      const l = Math.hypot(tx, tz); tx /= l; tz /= l;
    }
    const e = Math.atan2(tz * nose[0] - tx * nose[1], tx * nose[0] + tz * nose[1]);
    let eA = e;
    const tl2 = Math.hypot(vcg[0], vcg[2]);
    if (tl2 > 5) {
      const tkx = vcg[0] / tl2, tkz = vcg[2] / tl2;
      eA = Math.atan2(tz * tkx - tx * tkz, tx * tkx + tz * tkz);
    }

    const AF = A.attFilt ?? 1.0;
    const thRaw = Math.asin(clamp(-xA[1], -1, 1));
    const phRaw = Math.atan2(-zR[1], yU[1]);
    if (pendReEng) {
      pendReEng = false;
      thF = thRaw; phF = phRaw; thP = thRaw; phP = phRaw; q = p = 0;
      eP = e; eR = eRslow = 0; eAP = eA; eAR = eARslow = 0;
      vsF = vcg[1]; thCA = thRaw; phCA = 0;
      aDe = sim.ctl.de; aDa = sim.ctl.da; aDr = sim.ctl.dr;
      Ith = 0; It = 0; thcI = 0.06; thrC = A.thrCruise ?? 0.6;
      eTrim = 0; brakeRamp = 0; holdWas = holdActive = false;
    }
    thF += AF * (thRaw - thF); phF += AF * (phRaw - phF);
    const th = thF, ph = phF;
    const RF = A.rateFilt ?? 0.12;
    q += RF * ((th - thP) / dt - q); thP = th;
    p += RF * ((ph - phP) / dt - p); phP = ph;
    eR += RF * 0.85 * ((e - eP) / dt - eR); eP = e;
    eRslow += dt / 2.0 * (eR - eRslow);
    eAR += RF * 0.85 * ((eA - eAP) / dt - eAR); eAP = eA;
    eARslow += dt / 2.0 * (eAR - eARslow);
    vsSlow += dt / 2.0 * (vcg[1] - vsSlow);
    const beta = (vcg[0]*zR[0] + vcg[1]*zR[1] + vcg[2]*zR[2]) / Math.max(Vt, 5);
    // TP: acceleration filter for the stagnation call — same 2 s form as vsSlow
    if (vPrev !== null) accF += dt / 2.0 * ((V - vPrev) / dt - accF);
    vPrev = V;

    const c = sim.ctl, onG = sim.wheelsOnGround();
    if (onG > 0 && agl < A.aglGuard && V < A.VRot * 0.9
        && ['LIFTOFF','CLIMB'].includes(ap.phase)) {
      // TP: the balked-takeoff retry is BOUNDED. The donor loops here for
      // ever; a test pilot tries twice more and then keeps the aeroplane.
      rollN++;
      if (rollN >= 3) {
        say('balked', 'settled back onto the wheels ' + rollN +
            ' times — keeping it on the ground');
        ap.phase = 'ABORT'; phaseT = 0;
      } else {
        say('balked', 'settled back at V=' + V.toFixed(1) + ' — attempt ' +
            (rollN + 1));
        ap.phase = 'ROLL'; phaseT = 0;
        rollS0 = null;                     // TP: re-latch the run instrument
      }
    }

    // TP: the watchdog. A flight that outlives its budget without an outcome
    // is a verdict in itself, said once; external runners bound the sim.
    if (ap.budget && ap.t > ap.budget && !ap.report.outcome
        && ap.phase !== 'STOPPED') {
      ap.report.outcome = 'gave-up';
      say('gave-up', 'still in ' + ap.phase + ' at t=' + Math.round(ap.t) +
          ' s — out of patience, not out of sky');
    }

    const holdPitch = (thC) => {
      if (!holdWas) thCA = th;
      holdActive = true;
      const sl = (A.pitchCmdSlew ?? 99) * dt;
      thCA += clamp(thC - thCA, -sl, sl);
      Ith = clamp(Ith + (A.pitchI ?? 0.05) * (thCA - th) * dt, -0.15, 0.15);
      c.de = clamp((A.pitchP ?? 1.2) * (thCA - th) - (A.pitchD ?? 1.8) * q + Ith, -0.30, 0.35);
    };
    const airLateral = (bankLim = A.bankLim ?? 0.30) => {
      if (Math.abs(o_.windX || 0) + Math.abs(o_.windZ || 0) > 0.5) {
        if (Math.abs(eA) < 0.2) eTrim = clamp(eTrim + 0.15 * eA * dt, -0.10, 0.10);
        else eTrim -= 0.8 * eTrim * dt;
      }
      const phC = clamp((A.hdgP ?? 0.7) * eA + (A.hdgD ?? 0.9) * eAR + eTrim, -bankLim, bankLim);
      phCA += clamp(phC - phCA, -(A.bankSlew ?? 0.18) * dt, (A.bankSlew ?? 0.18) * dt);
      c.da = clamp((A.rollP ?? 2.0) * (phCA - ph) - (A.rollD ?? 2.0) * p, -0.30, 0.30);
      c.dr = clamp(-(A.betaK ?? 0.3) * beta - (A.yawDampK ?? 0.6) * (eAR - eARslow)
                   - (A.ariK ?? 0.35) * c.da, -0.25, 0.25);
    };
    const speedThrottle = (Vtgt) => {
      It = clamp(It + 0.010 * (Vtgt - V) * dt, -0.30, 0.30);
      c.thr = clamp(thrC + 0.05 * (Vtgt - V) + It, A.thrFloor ?? 0.12, 1);
    };
    const holdVS = (VSc, thMax = 0.16) => {
      vsF += (A.vsFilt ?? 1.0) * (vcg[1] - vsF);
      const fl = A.vsFloor ?? -0.08;
      thcI = clamp(thcI + (A.vsI ?? 0.015) * (VSc - vsF) * dt, fl, thMax);
      holdPitch(clamp(thcI + (A.vsP ?? 0.010) * (VSc - vsF), fl, thMax));
    };
    const groundSteer = () => {
      c.dr = clamp(-3.2 * e - 1.2 * eR, -0.45, 0.45);
      c.da = clamp(-2.0 * ph - 1.0 * p, -0.25, 0.25);
    };

    const taxi = (Vtgt) => {
      c.de = A.taxiDe ?? 0.30;
      const ff = taxiFF();
      c.thr = clamp(ff + 0.06 * (Vtgt - Vg), 0, ff + 0.27);
      c.brake = Vg > Vtgt + 1.2 ? 0.45 : 0;
      c.da = clamp(-2.0 * ph - 1.0 * p, -0.25, 0.25);
    };

    const goAround = why => {
      ap.gaN = (ap.gaN || 0) + 1; ap.gaWhy = why;
      say('go-around', why + ' (attempt ' + ap.gaN + ')');   // TP: recorded
      ap.phase = 'GOAROUND'; phaseT = 0; gaT = 0;
      thrC = A.thrCruise;
    };
    const vsAgl = v => agl < A.hSafe ? Math.max(v, 1.0) : v;

    switch (ap.phase) {
      case 'DEPART': {
        const from = ap.route.from;
        const axx = snap(Math.cos(from.hdg)), axz = snap(Math.sin(from.hdg));
        let dx = nose[0], dz = nose[1];
        if (world && world.wind) {
          const wv = world.wind(from.x, from.elev + 30, from.z, ap.t);
          if (Math.hypot(wv[0], wv[2]) > 0.7) { dx = -wv[0]; dz = -wv[2]; }
        }
        const sg = (dx * axx + dz * axz) >= 0 ? 1 : -1;
        const ux = axx * sg, uz = axz * sg;
        ap.frame = mkFrame(from, -ux, -uz);
        ap.dirX = -1;
        const need = (A.TORun ?? 500) + 60;
        const sPos = (cg[0] - from.x) * ux + (cg[2] - from.z) * uz;
        // G151, the donor's change carried across verbatim (this planner is
        // 40_autopilot's, forked): LINEUP is a final alignment and cannot be
        // asked to cross an apron. See the donor for the measurement — 324 s
        // and a 375 m wander, which on THIS pilot also burned the 600 s
        // budget and produced a 'gave-up' on a sound aeroplane.
        const sCr0 = -(cg[0] - from.x) * uz + (cg[2] - from.z) * ux;
        const offCl = Math.abs(sCr0) > 15;
        if (!offCl && from.len / 2 - sPos >= need) { ap.phase = 'LINEUP'; phaseT = 0; break; }
        // the site's declared route wins — the fence is the place's, not the
        // pilot's (see the donor for the measurement that proved it).
        if (offCl && ap.taxiOut) {
          const path = ap.taxiOut.map(p => [p[0], p[1]]);
          ap.taxiTgt = path.shift();
          ap.taxiPath = path;
          ap.phase = 'TAXI'; phaseT = 0;
          break;
        }
        const sStart = offCl
          ? Math.min(Math.max(sPos + Math.max(60, 3.5 * Math.abs(sCr0)),
                              -from.len / 2 + 25), from.len / 2 - need - 25)
          : Math.max(-from.len / 2 + 25, from.len / 2 - need - 25);
        ap.taxiTgt = [from.x + ux * sStart, from.z + uz * sStart];
        ap.taxiPath = null;
        ap.phase = 'TAXI'; phaseT = 0;
        break;
      }

      case 'TAXI': {
        const ddx = ap.taxiTgt[0] - cg[0], ddz = ap.taxiTgt[1] - cg[2];
        const dist = Math.hypot(ddx, ddz) || 1e-9;
        ap.targetDir = [ddx / dist, 0, ddz / dist];
        c.dr = clamp(-3.2 * e - 1.2 * eR, -0.45, 0.45);
        taxi(Math.abs(e) > 0.6 ? 2.2 : 4.5);
        // G151, carried: only the LAST point hands over to LINEUP, and the
        // intermediate ones hold a tighter radius so a corner-cut cannot clip
        // the gate the route exists to use.
        const lastLeg = !(ap.taxiPath && ap.taxiPath.length);
        if (dist < (lastLeg ? 22 : 10) || phaseT > 120) {
          if (lastLeg) { ap.phase = 'LINEUP'; phaseT = 0; }
          else { ap.taxiTgt = ap.taxiPath.shift(); phaseT = 0; }
        }
        break;
      }

      case 'LINEUP': {
        ap.trackHold = true;
        c.dr = clamp(-3.2 * e - 1.2 * eR, -0.45, 0.45);
        const alig = -(nose[0] * F.ux + nose[1] * F.uz);
        taxi(alig > 0.5 ? 4.5 : 2.4);
        if (alig > 0.988 && Math.abs(sCr) < 8 && Math.abs(eR) < 0.15) {
          ap.phase = 'ROLL'; phaseT = 0;
          ap.t = Math.max(ap.t, 1);
          rollS0 = null;                   // TP: fresh run instrument
        }
        break;
      }

      case 'ROLL': {
        c.thr = ap.t > 0.5 ? 1 : 0; c.brake = 0;
        // TP: THE ROLL HAS AN EXIT NOW. The donor's ROLL has exactly one —
        // reaching Vr — so an aeroplane that never will rolls to the fence.
        // Three rejection calls, each with margin the whole fleet clears by
        // construction (fleet TORun 150-500 m on 1100 m, accel > 1 m/s^2):
        //   out of runway   — 80 m from the end, still below Vr
        //   won't make it   — 60% of the strip used, still under 80% of Vr
        //   going nowhere   — 8 s at full power, accel under 0.08 m/s^2
        if (rollS0 === null) rollS0 = sAl;
        const avail = (ap.route.from.len || 1100);
        const runUsed = Math.abs(sAl - rollS0);
        const vr = A.VRot || 18;
        let reject = null;
        if (runUsed > avail - 80 && V < vr)
          reject = 'out of runway: ' + Math.round(runUsed) + ' m used, V=' +
                   V.toFixed(1) + ' of ' + vr.toFixed(1) + ' needed';
        else if (runUsed > 0.6 * avail && V < 0.8 * vr)
          reject = Math.round(runUsed) + ' m used for V=' + V.toFixed(1) +
                   ' — will not reach Vr=' + vr.toFixed(1) + ' in what is left';
        else if (phaseT > 8 && accF < 0.08 && V < 0.8 * vr)
          reject = 'not accelerating (' + accF.toFixed(2) + ' m/s^2 at V=' +
                   V.toFixed(1) + ') — thrust is going nowhere';
        if (reject) {
          say('rejected-takeoff', reject);
          ap.phase = 'ABORT'; phaseT = 0;
          break;
        }
        if (A.rotate) {
          if (V > A.VRot) holdPitch(A.thRotate ?? A.liftoffTh);
          else if (V > A.VTailUp) holdPitch(A.thTailUp ?? 0.02);
          else c.de = A.rollDe;
        } else c.de = A.rollDe;
        groundSteer();
        if (onG === 0 && V > A.VRot) { ap.phase = 'LIFTOFF'; phaseT = 0; thLift0 = th; }
        break;
      }

      // TP: a rejected takeoff ends ON THE STRIP, brakes on, straight ahead —
      // the donor has no ground phase that stops without having landed first.
      case 'ABORT': {
        c.thr = 0;
        if (A.rolloutMode === 'trike') c.de = 0.15;
        else c.de = V > (A.VTailDown ?? A.VTailUp) ? -0.05 : 0.35;
        brakeRamp = Math.min(brakeRamp + A.brakeRampRate * dt, A.brakeMax);
        c.brake = brakeRamp * Math.min(1, Math.max(0, (Vg - A.VBrakeRelease) / 2.0));
        groundSteer();
        if (Vg < A.VStop) {
          ap.report.outcome = ap.report.outcome || 'rejected-takeoff';
          ap.phase = 'STOPPED'; phaseT = 0;
        }
        break;
      }

      case 'LIFTOFF':
        c.thr = 1;
        holdPitch(Math.min(thLift0 + (A.liftoffRamp ?? 9) * phaseT, A.liftoffTh));
        airLateral(0.15);
        // TP: LIFTOFF is bounded too. Measured (rotax582 + 260 kg): airborne
        // at t=65, then HOVERING at half a metre in ground effect for the
        // rest of time — above the balked guard's V, below CLIMB's entry, and
        // no rule in the donor ever objects. 25 s without clearing 60% of
        // hSafe means it is not climbing out: close the throttle, put it
        // back down, keep it. The fleet clears hSafe in seconds.
        if (phaseT > 25 && agl < A.hSafe * 0.6) {
          say('wont-climb', 'airborne ' + Math.round(phaseT) + ' s and still at ' +
              agl.toFixed(1) + ' m — cannot climb out of ground effect, putting it back down');
          ap.phase = 'PUTDOWN'; phaseT = 0;
          break;
        }
        if (agl > A.hSafe && V > A.VClimbMin) { ap.phase = 'CLIMB'; phaseT = 0; }
        break;

      // TP: the low-hover reject — throttle closed, a gentle nose-up mush
      // until the wheels touch, then the ABORT brakes take it. Outcome is a
      // rejected takeoff: the flight never happened.
      case 'PUTDOWN':
        c.thr = 0;
        holdPitch(Math.min(th + 0.02, A.flareThMax ?? A.thMax));
        airLateral(0.10);
        if (onG > 0) {
          ap.report.outcome = ap.report.outcome || 'rejected-takeoff';
          ap.phase = 'ABORT'; phaseT = 0;
        }
        break;

      case 'CLIMB': {
        c.thr = 1;
        holdPitch(clamp(A.climbThBase + A.climbThGain * (V - ap.VClimb), 0.02, A.thMax));
        airLateral();
        // TP: the donor's W19 acceptance (60 s under 0.15 m/s) kept, and a
        // second, gentler call added over it: a 0.2-0.4 m/s climber slips
        // under W19's trigger and "climbs for ever" toward a circuit height
        // it will reach next week. 75 s under 0.4 m/s is nowhere near the
        // fleet (they top out in 14-47 s at 3-5 m/s) and is an ACCEPTED
        // ceiling, said so, not a failure.
        const stalled = phaseT > 60 && vsSlow < 0.15;
        const marginal = phaseT > 75 && vsSlow < 0.4;
        if (stalled)
          say('wont-climb', 'no climb left (' + vsSlow.toFixed(2) +
              ' m/s) — accepting ' + Math.round(cg[1] - ap.altRef) + ' m');
        else if (marginal)
          say('ceiling-accepted', 'still climbing ' + vsSlow.toFixed(2) +
              ' m/s after ' + Math.round(phaseT) + ' s — flying the circuit at ' +
              Math.round(cg[1] - ap.altRef) + ' m instead of waiting');
        if (stalled || marginal)
          ap.hCruise = Math.max(A.hSafe + 10, cg[1] - ap.altRef);
        if (cg[1] > ap.altRef + ap.hCruise - 8 || stalled || marginal) {
          if (ap.xc) {
            ap.holdDir = [ap.frame.ux * ap.dirX, 0, ap.frame.uz * ap.dirX];
            ap.phase = 'ENROUTE'; enterArrival(); ap.trackHold = false;
          } else ap.phase = 'CRUISE';
          phaseT = 0; thrC = A.thrCruise; thcI = 0.04;
        }
        break;
      }

      case 'CRUISE':
        speedThrottle(ap.VCruise);
        holdVS(vsAgl(clamp((A.altVSGain ?? 0.08) * (ap.altRef + ap.hCruise - cg[1]), -2.2, 2.2)));
        airLateral();
        // TP: the card is JUDGED here, on the settled leg — time-weighted
        // means of height and speed, and a said-once verdict when full
        // throttle cannot hold the asked speed. The accumulators live in the
        // closure; only the flown numbers reach the report.
        if (cardAcc && phaseT > 8) {
          cardAcc.n += dt;
          cardAcc.alt += (cg[1] - ap.altRef) * dt;
          cardAcc.V += V * dt;
          const cd = ap.report.card;
          cd.altFlown = Math.round(cardAcc.alt / cardAcc.n);
          cd.VFlown = Math.round(cardAcc.V / cardAcc.n * 10) / 10;
          if (!cardAcc.saidV && cd.V && phaseT > 25
              && V < cd.V * 0.93 && c.thr > 0.97) {
            cardAcc.saidV = true;
            say('cant-hold-speed', 'full throttle holds ' +
                Math.round(V * 3.6) + ' of the ' + Math.round(cd.V * 3.6) +
                ' km/h asked');
          }
        }
        if (sAl < ap.xTurn) {
          ap.phase = 'TURNBACK'; phaseT = 0;
          ap.trackHold = false; enterArrival();
          ap.targetDir = [ap.frame.ux, 0, ap.frame.uz];
        }
        break;

      case 'ENROUTE': {
        speedThrottle(ap.VCruise);
        const hCone0 = ap.refAlt + (ap.xAim - (ap.xTurn - 1200)) * ap.gs + 15;
        const fixOut = 1200 + Math.max(0, (cg[1] - hCone0) / 0.10);
        const fdx = (ap.xTurn - fixOut) - sAl, fdz = -sCr;
        const fDist = Math.hypot(fdx, fdz) || 1;
        const fixDir = [(fdx * F.ux - fdz * F.uz) / fDist, 0,
                        (fdx * F.uz + fdz * F.ux) / fDist];
        let hTgt = ap.altRef + ap.hCruise;
        if (world) {
          for (const dA of [0, 400, 800, 1500, 2500, 4000, 5500, 7500]) {
            const hT = world.terrainH(cg[0] + fixDir[0] * dA, cg[2] + fixDir[2] * dA)
                     + (A.hClear ?? 130);
            if (hT > hTgt) hTgt = hT;
          }
        }
        ap.targetDir = (hTgt - cg[1] > 60 && ap.holdDir) ? ap.holdDir : fixDir;
        holdVS(vsAgl(clamp((A.altVSGain ?? 0.08) * (hTgt - cg[1]), -4.5, 2.2)));
        airLateral();
        if (fDist < 600) { ap.phase = 'INBOUND'; phaseT = 0; ap.trackHold = true; }
        break;
      }

      case 'TURNBACK':
        speedThrottle(A.VTurn ?? ap.VCruise);
        holdVS(vsAgl(clamp((A.altVSGain ?? 0.08) * (ap.altRef + ap.hCruise - cg[1]), -2.2, 2.2)));
        airLateral();
        headingCapT = Math.abs(e) < 0.12 ? headingCapT + dt : 0;
        if (headingCapT > 1.5) { ap.phase = 'INBOUND'; phaseT = 0; ap.trackHold = true; }
        break;

      case 'INBOUND': {
        speedThrottle(A.VTurn ?? 24);
        const d = ap.xAim - sAl;
        const hGS = ap.refAlt + Math.max(0, d) * ap.gs;
        const hTgt = Math.min(ap.altRef + ap.hCruise, hGS + 15);
        holdVS(vsAgl(clamp((A.altVSGain ?? 0.08) * (hTgt - cg[1]), -3.5, 2.2)));
        airLateral();
        if (d > 0 && hGS <= cg[1] + 2 && cg[1] - hGS < 40) { ap.phase = 'APPROACH'; phaseT = 0; thrC = A.thrAppr; }
        else if (d <= 0) {
          if (agl < A.flareAgl * 3 || (ap.gaN || 0) >= 2) {
            // TP: the donor lands here silently; the pilot says it is out of
            // tidy options and committing.
            say('committed-landing', 'past the aim at ' + Math.round(agl) +
                ' m agl — landing it');
            ap.phase = 'APPROACH'; phaseT = 0; thrC = A.thrAppr;
          } else goAround('past-aim');
        }
        break;
      }

      case 'APPROACH': {
        speedThrottle(ap.VAppr);
        const d = ap.xAim - sAl;
        const hGS = ap.refAlt + Math.max(0, d) * ap.gs;
        holdVS(clamp(-(o_.Vg ?? V) * ap.gs + 0.12 * (hGS - cg[1]), Math.min(-3.0, -1.6 * V * ap.gs), 0.5));
        airLateral(0.18);
        gaT = cg[1] - hGS > 60 ? gaT + dt : 0;
        if (gaT > 5 && (ap.gaN || 0) < 2) { goAround('high'); break; }
        // TP: the pilot knows what is UNDER it, not just where the field
        // datum is. The donor's agl is height above field elevation, so an
        // approach over rising ground descends into it with no objection.
        // Far from the aim (d > 400 m), less than 15 m over the real terrain
        // is a go-around, not a landing.
        if (world && d > 400 && (ap.gaN || 0) < 2
            && cg[1] - world.terrainH(cg[0], cg[2]) < 15) {
          goAround('terrain');
          break;
        }
        if (agl < A.flareAgl) { ap.phase = 'FLARE'; phaseT = 0; thFlare0 = th; }
        break;
      }

      case 'GOAROUND':
        c.thr = 1; c.brake = 0;
        holdPitch(clamp(A.climbThBase + A.climbThGain * (V - ap.VClimb), 0.02, A.thMax));
        airLateral(0.20);
        if (cg[1] > ap.altRef + ap.hCruise - 8 || (phaseT > 60 && vsSlow < 0.15)) {
          ap.phase = 'CRUISE'; phaseT = 0;
          ap.dirX = -1; ap.trackHold = true;
          thrC = A.thrCruise; thcI = 0.04;
        }
        break;

      case 'FLARE':
        c.thr = A.flareThr ?? 0;
        if (phaseT > 20 && (ap.gaN || 0) < 2) { goAround('float'); break; }
        if (A.flareMode === 'vs') {
          holdVS(-(0.15 + 0.28 * Math.max(0, agl)), A.flareThMax ?? A.thMax);
        } else {
          holdPitch(Math.min(thFlare0 + A.flareRate * phaseT, A.flareThMax ?? A.thMax));
        }
        if (agl < (A.decrabAgl ?? 3.5) && Math.abs(o_.windZ || 0) > 0.5) {
          airLateral(0.12);
          const nS = nose[0] * F.ux + nose[1] * F.uz;
          const nC = -nose[0] * F.uz + nose[1] * F.ux;
          const hdg = Math.atan2(nC, nS * ap.dirX) * ap.dirX;
          c.dr = clamp(-(A.decrabK ?? 2.2) * hdg - 0.6 * eR, -0.35, 0.35);
        } else airLateral(0.10);
        if (onG > 0) {
          ap.phase = 'ROLLOUT'; phaseT = 0;
          ap.tdInfo = { sink: -vcg[1], z: sCr, x: sAl, V,
                        drift: -vcg[0] * F.uz + vcg[2] * F.ux };
        }
        break;

      case 'ROLLOUT': {
        c.thr = 0;
        if (A.rolloutMode === 'trike') {
          if (V > (A.VDerotate ?? 20)) holdPitch(A.rolloutTh ?? 0.035);
          else c.de = 0.15;
        } else c.de = V > (A.VTailDown ?? A.VTailUp) ? -0.05
                    : (th > (A.thPinMax ?? 0.26) ? 0.05
                    : V > (A.VPinFull ?? 0) ? 0.14 : 0.35);
        if (Vg < A.VBrakeOn) brakeRamp = Math.min(brakeRamp + A.brakeRampRate * dt, A.brakeMax);
        c.brake = brakeRamp * Math.min(1, Math.max(0, (Vg - A.VBrakeRelease) / 2.0));
        groundSteer();
        if (Vg < A.VStop) {
          // TP: the landing goes in the report — the run is the plaque's new
          // number, and pastAim is the arrival judged against its own aim.
          if (ap.tdInfo) ap.report.landing = {
            run: Math.round(Math.abs(sAl - ap.tdInfo.x)),
            sink: Math.round(ap.tdInfo.sink * 100) / 100,
            V: Math.round(ap.tdInfo.V * 10) / 10,
            offCentre: Math.round(ap.tdInfo.z * 10) / 10,
            pastAim: Math.round(ap.tdInfo.x - ap.xAim),
          };
          ap.report.outcome = ap.report.outcome || 'completed';
          ap.phase = 'STOPPED'; phaseT = 0;
        }
        break;
      }

      case 'STOPPED':
        c.thr = 0; c.de = 0.35; c.brake = 0.25; c.da = 0; c.dr = 0;
        break;
    }
    const FS = def.params.flaps;
    if (FS) {
      const tgt = ap.phase === 'APPROACH' || ap.phase === 'FLARE' ? (FS.ldg ?? 1)
                : ap.phase === 'ROLL' || ap.phase === 'LIFTOFF' ? (FS.to ?? 0)
                : 0;
      const rr = (FS.rate ?? 0.15) * dt;
      c.flap = clamp(c.flap + clamp(tgt - c.flap, -rr, rr), 0, 1);
    }
    aDe += clamp(c.de - aDe, -A.slew * dt, A.slew * dt); c.de = aDe;
    aDa += clamp(c.da - aDa, -A.slew * dt, A.slew * dt); c.da = aDa;
    aDr += clamp(c.dr - aDr, -A.slew * dt, A.slew * dt); c.dr = aDr;
    holdWas = holdActive; holdActive = false;
    ap.dbg = { e, th, ph, q, beta, V, alt: cg[1], z: sCr, s: sAl, agl };
  };
  return ap;
}
// model_codec.js — decode baked model payloads (see tools/model_prep.py).
// Pure JS, no three.js: same code runs in the artifact and in the node gates.
// Layout per group (little-endian): u32 nVerts, u32 nTris,
//   int16 pos[3*nVerts] (quantized over bb), uint16 uv[2*nVerts], uint16 idx[3*nTris].
//
// THE BYTES LIVE OUTSIDE THE PAYLOAD since 2026-09-01: the payload .js is a
// slim manifest whose groups carry `off`/`len` into ONE binary file per model
// (payload.bin names it, under media/geo/models/), and decodeModel takes that
// file's bytes as its second argument. Who fetches is the caller's business —
// the browser goes through ASSET_FETCH/MODEL_LOAD (src/viewer/assets.js,
// app.js), the gates read the file with fs and hand it in. A group that still
// carries `b64` decodes exactly as before (the selftests' synthetic payloads,
// and any not-yet-rebaked tree), so the container change cannot strand a
// fixture.

function decodeB64(b64) {
  if (typeof atob === 'function') {
    const s = atob(b64), a = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
    return a;
  }
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

// group -> DataView over its bytes, wherever they live (b64 field or a slice
// of the model's own bin). Throws on a bin group with no bin bytes handed in:
// a silent empty decode would be a payload that "loaded" as no aeroplane.
function groupView(g, bin, name) {
  if (g.b64) { const raw = decodeB64(g.b64);
               return new DataView(raw.buffer, raw.byteOffset, raw.byteLength); }
  if (!bin) throw new Error('decodeModel: group "' + name + '" needs the ' +
    'model\'s bin bytes and none were passed — fetch payload.bin first');
  return new DataView(bin.buffer, bin.byteOffset + g.off, g.len);
}

function decodeModel(model, bin) {
  const [x0, y0, z0, x1, y1, z1] = model.bb;
  const sx = (x1 - x0) / 65535, sy = (y1 - y0) / 65535, sz = (z1 - z0) / 65535;
  const out = {};
  for (const name in model.groups) {
    const g = model.groups[name];
    const dv = groupView(g, bin, name);
    const nv = dv.getUint32(0, true), nt = dv.getUint32(4, true);
    let o = 8;
    const pos = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
    for (let i = 0; i < nv; i++, o += 6) {
      pos[i*3]   = x0 + (dv.getInt16(o,     true) + 32768) * sx;
      pos[i*3+1] = y0 + (dv.getInt16(o + 2, true) + 32768) * sy;
      pos[i*3+2] = z0 + (dv.getInt16(o + 4, true) + 32768) * sz;
    }
    for (let i = 0; i < nv * 2; i++, o += 2) uv[i] = dv.getUint16(o, true) / 65535;
    const idx = new Uint16Array(nt * 3);
    for (let i = 0; i < nt * 3; i++, o += 2) idx[i] = dv.getUint16(o, true);
    let sid = null;
    if (g.sid) { sid = new Uint8Array(nv); for (let i = 0; i < nv; i++, o++) sid[i] = dv.getUint8(o); }
    out[name] = { nv, nt, pos, uv, idx, sid };
  }
  return out;
}


// ---------------------------------------------------------------------------
// Skin deformation (see SKIN-PROC.md). Spanwise station binding:
// model wing-band vertices follow the sim's spar stations (tags WF/WR),
// interpolated along |z|. Everything else stays rigid in the body frame.
// Model frame orientation == body frame with z LEFT (zL = xAft x yUp).
// ---------------------------------------------------------------------------

function defCG(def) {
  let x = 0, y = 0, z = 0, M = 0;
  for (const n of def.nodes) { x += n.p[0]*n.m; y += n.p[1]*n.m; z += n.p[2]*n.m; M += n.m; }
  return [x/M, y/M, z/M];
}

// The EXACT projection sparDeltas measures with, taken at the design pose:
// bodyAxes' raw xAft/yUp from the refs (normalized, NOT re-orthogonalized —
// the pair is oblique whenever the design pose is pitched) and zL = xA x yU
// exactly as sparDeltas derives it, origin at defCG. The rest reference MUST
// go through this and nothing cleaner: an orthogonalized or design-axes rest
// leaves a constant millimetre-scale field at zero load — the at-rest
// aft-sheared wing, the crease at the first bound row, the kinked struts.
function defBodyProject(def) {
  const N = def.nodes, R = def.refs;
  const avg = ids => { const o = [0, 0, 0];
    for (const i of ids) { o[0] += N[i].p[0]; o[1] += N[i].p[1]; o[2] += N[i].p[2]; }
    return [o[0] / ids.length, o[1] / ids.length, o[2] / ids.length]; };
  const nrm = a => { const L = Math.hypot(a[0], a[1], a[2]) || 1e-9;
    return [a[0] / L, a[1] / L, a[2] / L]; };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const xA = nrm(sub(avg(R.tailMid), avg(R.noseFrame)));
  const yU = nrm(sub(avg(R.upHi), avg(R.upLo)));
  const zL = [xA[1]*yU[2] - xA[2]*yU[1], xA[2]*yU[0] - xA[0]*yU[2],
              xA[0]*yU[1] - xA[1]*yU[0]];
  const cg = defCG(def);
  return p => { const d = sub(p, cg);
    return [d[0]*xA[0] + d[1]*xA[1] + d[2]*xA[2],
            d[0]*yU[0] + d[1]*yU[1] + d[2]*yU[2],
            d[0]*zL[0] + d[1]*zL[1] + d[2]*zL[2]]; };
}

// cfg: { tags:['WF','WR'], zRoot, xMax, off:[ox,oy,oz] }  (model-frame thresholds)
// Optional gates (G58.1): xMin and yMin close the wing box from the other two
// sides. The original selector was "outboard of zRoot and forward of xMax" —
// which on the cage visual also caught the cabin SIDEWALL (it sits exactly at
// |z| = zRoot = cab.halfW), the strut roots and the GEAR LEG, and pulled them
// aft with the lifting wing (user's circles, at ×4 flex). Absent fields keep
// the imported fleet's bindings exactly as they were.
function makeSkinBinding(pos, nv, def, cfg) {
  // rest goes through defBodyProject — see its header for why nothing else
  // (design axes, an orthogonalized frame) is allowed to build it.
  const toB = defBodyProject(def);
  const sides = { P: {}, N: {} };            // keyed by |z| station
  def.nodes.forEach((n, i) => {
    if (!cfg.tags.includes(n.tag)) return;
    const s = n.p[2] > 0 ? 'P' : 'N', key = Math.abs(n.p[2]).toFixed(2);
    (sides[s][key] = sides[s][key] || []).push(i);
  });
  const zs = Object.keys(sides.P).map(Number).sort((a, b) => a - b);
  const mkSide = (S) => {
    const st = zs.map(z => sides[S][z.toFixed(2)]);
    const rest = new Float32Array(zs.length * 3);
    st.forEach((ids, k) => {
      for (const i of ids) {
        const q = toB(def.nodes[i].p);
        rest[k*3]   += q[0] / ids.length;
        rest[k*3+1] += q[1] / ids.length;
        rest[k*3+2] += q[2] / ids.length;
      }
    });
    return { st, rest };
  };
  // vertices: model z>0 maps to world +z at rest, i.e. sim nodes with p[2]>0
  const bound = [], seg = [], w = [], side = [];
  for (let i = 0; i < nv; i++) {
    const x = pos[i*3], z = pos[i*3+2], az = Math.abs(z);
    if (az < cfg.zRoot || x > cfg.xMax) continue;
    if (cfg.xMin !== undefined && x < cfg.xMin) continue;
    if (cfg.yMin !== undefined && pos[i*3+1] < cfg.yMin) continue;
    let k = 0;
    while (k < zs.length - 1 && az > zs[k]) k++;
    const zA = k === 0 ? cfg.zRoot : zs[k-1];
    bound.push(i); seg.push(k); side.push(z > 0 ? 1 : 0);
    w.push((az - zA) / (zs[k] - zA));        // may exceed 1 past the tip: extrapolates
  }
  return { zs, P: mkSide('P'), N: mkSide('N'),
           bound: Int32Array.from(bound), seg: Int8Array.from(seg),
           w: Float32Array.from(w), side: Int8Array.from(side) };
}

// Body-frame (z-left) station deltas vs rest. axes = [xAft, yUp]; zL derived.
function sparDeltas(bind, sim, out) {
  const cg = sim.cgPos(), [xA, yU] = sim.axes();
  const zL = [xA[1]*yU[2]-xA[2]*yU[1], xA[2]*yU[0]-xA[0]*yU[2], xA[0]*yU[1]-xA[1]*yU[0]];
  for (const S of ['P', 'N']) {
    const { st, rest } = bind[S], d = out[S];
    st.forEach((ids, k) => {
      let bx = 0, by = 0, bz = 0;
      for (const i of ids) {
        const dx = sim.p[i*3]-cg[0], dy = sim.p[i*3+1]-cg[1], dz = sim.p[i*3+2]-cg[2];
        bx += (dx*xA[0]+dy*xA[1]+dz*xA[2]) / ids.length;
        by += (dx*yU[0]+dy*yU[1]+dz*yU[2]) / ids.length;
        bz += (dx*zL[0]+dy*zL[1]+dz*zL[2]) / ids.length;
      }
      d[k*3] = bx - rest[k*3]; d[k*3+1] = by - rest[k*3+1]; d[k*3+2] = bz - rest[k*3+2];
    });
  }
  return out;
}

// pos <- base + gain * lerp(station deltas) for bound vertices only.
// seg k, weight w: between station k-1 (root: zero delta) and station k;
// w > 1 past the last station extrapolates linearly (model tip 5.36 vs spar 5.0).
// hinged: optional Uint8Array — for those verts the hinge pass already wrote
// pos, so flex is ADDED in place instead of overwriting from base.
function applySkinDeform(bind, base, pos, dP, dN, gain, hinged) {
  const { bound, seg, w, side } = bind;
  for (let j = 0; j < bound.length; j++) {
    const i = bound[j], k = seg[j], d = side[j] ? dP : dN, wj = w[j];
    const w0 = k === 0 ? 0 : gain * (1 - wj), w1 = gain * wj;
    const o0 = (k - 1) * 3, o1 = k * 3;
    const fx = (k === 0 ? 0 : w0 * d[o0])   + w1 * d[o1];
    const fy = (k === 0 ? 0 : w0 * d[o0+1]) + w1 * d[o1+1];
    const fz = (k === 0 ? 0 : w0 * d[o0+2]) + w1 * d[o1+2];
    if (hinged && hinged[i]) { pos[i*3] += fx; pos[i*3+1] += fy; pos[i*3+2] += fz; }
    else { pos[i*3] = base[i*3] + fx; pos[i*3+1] = base[i*3+1] + fy; pos[i*3+2] = base[i*3+2] + fz; }
  }
}

// ---------------------------------------------------------------------------
// Control surface hinges. Per-vertex rigid rotation about baked hinge lines,
// with an optional smoothstep weight ramp along x (fin+rudder fused meshes).
// Runs BEFORE the flex pass; applySkinDeform adds flex on top of hinged verts.
// ---------------------------------------------------------------------------

function makeHingeBinding(skin, surfaces) {
  const per = surfaces.map(() => ({ idx: [], w: [] }));
  for (let i = 0; i < skin.nv; i++) {
    const k = skin.sid[i];
    if (!k) continue;
    const s = surfaces[k - 1];
    let w = 1;
    if (s.ramp) {
      const u = (skin.pos[i*3] - s.ramp[0]) / (s.ramp[1] - s.ramp[0]);
      const c = Math.max(0, Math.min(1, u));
      w = c * c * (3 - 2 * c);
    }
    if (w <= 0) continue;
    per[k - 1].idx.push(i); per[k - 1].w.push(w);
  }
  const hinged = new Uint8Array(skin.nv);
  return { per: per.map(g => ({ idx: Int32Array.from(g.idx), w: Float32Array.from(g.w) })),
           hinged: (() => { for (const g of per) for (const i of g.idx) hinged[i] = 1;
                            return hinged; })() };
}

// Rodrigues rotation of (base - p) about unit axis by (angle * w), + p.
function applyHinges(hb, surfaces, base, pos, ctl) {
  surfaces.forEach((s, si) => {
    // A surface may answer to TWO inputs. A V-tail ruddervator is the reason:
    // it is the elevator and the rudder at once, symmetric in one and
    // antisymmetric in the other, and a vertex can only carry one surface id.
    const ang = s.sgn * (s.k || 1) * (ctl[s.drive] || 0)
      + (s.drive2 ? (s.sgn2 || 1) * (s.k2 || 1) * (ctl[s.drive2] || 0) : 0);
    const g = hb.per[si], [px, py, pz] = s.p, [ax, ay, az] = s.ax;
    for (let j = 0; j < g.idx.length; j++) {
      const i = g.idx[j], a = ang * g.w[j];
      const c = Math.cos(a), s_ = Math.sin(a), C = 1 - c;
      const vx = base[i*3] - px, vy = base[i*3+1] - py, vz = base[i*3+2] - pz;
      const d = ax*vx + ay*vy + az*vz;
      pos[i*3]   = px + vx*c + (ay*vz - az*vy)*s_ + ax*d*C;
      pos[i*3+1] = py + vy*c + (az*vx - ax*vz)*s_ + ay*d*C;
      pos[i*3+2] = pz + vz*c + (ax*vy - ay*vx)*s_ + az*d*C;
    }
  });
}

// ---------------------------------------------------------------------------
// Control linkage model (visual only). Two-pole low-pass between sim.ctl and
// the drawn surfaces: real cable runs and actuators filter exactly like this.
// Motivation: the AP roll/yaw loops limit-cycle at ~3.7 Hz (PD derivative on
// finite-differenced soft-body attitude); tau=0.12 s per pole attenuates that
// ~9x while tracking slewed maneuver commands with invisible lag.
// The HUD keeps showing raw sim.ctl; physics is untouched.
// ---------------------------------------------------------------------------
function makeLinkage(tau) {
  const s1 = { de: 0, da: 0, dr: 0, flap: 0 }, s2 = { de: 0, da: 0, dr: 0, flap: 0 };
  return {
    step(ctl, dt) {
      const a = Math.min(1, dt / tau);
      for (const k of ['de', 'da', 'dr', 'flap']) {
        s1[k] += a * ((ctl[k] || 0) - s1[k]);
        s2[k] += a * (s1[k] - s2[k]);
      }
      return s2;
    },
  };
}

if (typeof module !== 'undefined')
  module.exports = { decodeModel, decodeB64, defCG, makeSkinBinding, sparDeltas,
                     applySkinDeform, makeHingeBinding, applyHinges, makeLinkage };
// prop_codec.js — decode baked HANGAR PROP payloads (see tools/prop_prep.py).
// Pure JS, no three.js: the same code runs in the artifact and in the node gate.
//
// WHY A SECOND CODEC. 50_model_codec.js bakes an AEROPLANE: one bounding box
// for the whole model, no normals (the aircraft skin is smooth-shaded from a
// recomputed normal), and a skin-deformation binding. A prop is the opposite
// case — dozens of small rigid objects, each wanting its own quantisation
// range, and each needing the AUTHOR'S normals, because a barrel whose normals
// were recomputed is a faceted barrel and a chamfer that was baked into the
// normal map has nothing to sit on. So: per-prop bb, per-part uv range, and
// normals in the payload.
//
// Layout per part (little-endian):
//   u32 nVerts, u32 nTris,
//   int16 pos[3n]  quantised over the PROP's bb (0.03 mm on a 2 m prop),
//   int8  nrm[3n]  snorm unit normal (~0.9 deg),
//   uint16 uv[2n]  quantised over the PART's own uv range (props whose uv
//                  wraps past 1.0 are normal — industrial_storage_cart does),
//   uint16 idx[3t] (nVerts is asserted <= 65536 at bake time).
//
// THE BYTES LIVE OUTSIDE THE PACK since 2026-09-01: a part carries `off`/`len`
// into ONE binary file per prop (prop.bin names it, under media/geo/props/),
// and the decoders take that file's bytes as their last argument — the viewer
// fetches through propWarm/ASSET_FETCH (props.js), the gate reads with fs. A
// part still carrying `b64` decodes as before (selftest fixtures, unbaked
// trees).

function decodePropPart(bb, part, bin) {
  let dv;
  if (part.b64) {
    const raw = (typeof atob === 'function')
      ? (() => { const s = atob(part.b64), a = new Uint8Array(s.length);
                 for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; })()
      : new Uint8Array(Buffer.from(part.b64, 'base64'));
    dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  } else {
    if (!bin) throw new Error('decodePropPart: part "' + part.mat + '" needs ' +
      'the prop\'s bin bytes and none were passed — propWarm first');
    dv = new DataView(bin.buffer, bin.byteOffset + part.off, part.len);
  }
  const nv = dv.getUint32(0, true), nt = dv.getUint32(4, true);
  const [x0, y0, z0, x1, y1, z1] = bb;
  const sx = (x1 - x0) / 65535, sy = (y1 - y0) / 65535, sz = (z1 - z0) / 65535;
  let o = 8;
  const pos = new Float32Array(nv * 3);
  for (let i = 0; i < nv; i++, o += 6) {
    pos[i * 3]     = x0 + (dv.getInt16(o,     true) + 32768) * sx;
    pos[i * 3 + 1] = y0 + (dv.getInt16(o + 2, true) + 32768) * sy;
    pos[i * 3 + 2] = z0 + (dv.getInt16(o + 4, true) + 32768) * sz;
  }
  const nrm = new Float32Array(nv * 3);
  for (let i = 0; i < nv * 3; i++, o++) nrm[i] = dv.getInt8(o) / 127;
  const [u0, v0] = part.uvMin, [us, vs] = part.uvScl;
  const uv = new Float32Array(nv * 2);
  for (let i = 0; i < nv; i++, o += 4) {
    uv[i * 2]     = u0 + dv.getUint16(o,     true) / 65535 * us;
    uv[i * 2 + 1] = v0 + dv.getUint16(o + 2, true) / 65535 * vs;
  }
  const idx = new Uint16Array(nt * 3);
  for (let i = 0; i < nt * 3; i++, o += 2) idx[i] = dv.getUint16(o, true);
  return { mat: part.mat, nv, nt, pos, nrm, uv, idx };
}

// prop -> { key, bb, parts:[{mat,nv,nt,pos,nrm,uv,idx}] }. Decoding is per
// prop, not per pack: the editor shows one at a time and the hangar places a
// handful, so nothing pays for the props it never puts on the floor.
// `bin` is the prop's own binary file's bytes (see the header) — unused when
// the parts still carry b64.
function decodeProp(prop, bin) {
  return { key: prop.key, bb: prop.bb,
           parts: prop.parts.map(p => decodePropPart(prop.bb, p, bin)) };
}

// ---------------------------------------------------------------------------
// THE PROP REGISTRY. Every baked pack calls this at script eval, so by the time
// anything asks, PROP_REG holds every prop in the build, in table order. The
// registry is the ONE place the editor, the hangar and the gate agree on what
// exists — nothing downstream scans a directory or a filename.
// ---------------------------------------------------------------------------
const PROP_REG = { groups: [], props: {}, order: [], texs: {} };

function registerPropPack(pack) {
  for (const g of pack.groups || [])
    if (!PROP_REG.groups.some(x => x[0] === g[0])) PROP_REG.groups.push(g);
  for (const id in pack.texs) PROP_REG.texs[id] = pack.texs[id];
  for (const key of pack.order) {
    PROP_REG.props[key] = pack.props[key];
    PROP_REG.order.push(key);
  }
  return PROP_REG;
}

function propList(group) {
  return PROP_REG.order
    .map(k => PROP_REG.props[k])
    .filter(p => !group || p.group === group);
}

if (typeof module !== 'undefined' && module.exports)
  module.exports = { decodeProp, decodePropPart, registerPropPack, propList, PROP_REG };
// ============================================================
// GARAGE 1/5 — the SPEC. Source of truth for a generated airframe.
//
// Everything downstream (structure, aero, skin) is a pure function of a
// resolved spec, so the spec is the single root: there is no second place
// where a number about this aeroplane lives.
//
// PROCEDURAL BY DEFAULT: any field may be `null`, which means "derive it".
// resolveSpec() fills every null from the fields before it and records which
// ones it touched in `.auto`, so the editor can show auto-vs-manual and a
// player who changes nothing still gets a coherent aeroplane.
//
// Frame is the sim's: x AFT (nose at -x), y up, z lateral, datum x=0 at the
// firewall. Units SI throughout.
// ============================================================

// Build materials. `lin` = kg per metre of member, `cover` = kg/m^2 of covered
// surface (fabric + dope + stringers, or ply + finish). k/c are the beam
// spring/damping constants by member class — the tubeFabric row IS the Cub's
// (2.0e5/60 chassis, 5.0e5/450 wing, 2.8e4/900 gear), which is the only row
// this chantier validates. cd0 is the wing profile-drag finish penalty.
// PHYSICAL constants (`phys`) are REPORTING ONLY. Nothing in the solver, the
// generator or the viewer reads them — GATE FLEX does, and only GATE FLEX. They
// exist so the model's own spring rates can be compared against the structure
// they claim to represent, because `k` here is an absolute N/m per member and
// physics says EA/L. The area is not a new number: `lin` is kg/m, so A = lin/rho
// is already implied by the mass model, and it comes out right — tubeFabric's
// fuselage A is 0.58/7850 = 7.4e-5 m2, which IS 1" x 0.035" 4130 tube.
//   E     Pa    Young's modulus
//   rho   kg/m3 density (closes lin -> area)
//   sigY  Pa    the governing allowable in compression, which is what a truss
//               member usually fails in: 4130 yield, 2024-T3 yield, spruce
//               crushing parallel to grain, carbon UD tensile (it has no yield).
// Handbook class values (MIL-HDBK-5 / Wood Handbook), not measurements taken
// here. See GATE FLEX and the STRUCTURAL REALISM section of HANDOVER.md.
const GEN_MATERIALS = {
  tubeFabric: {
    name: '4130 tube + fabric',
    phys: { E: 205e9, rho: 7850, sigY: 460e6 },
    lin:   { fus: 0.58, wing: 0.62, gear: 1.05 },
    cover: 0.42,
    k:     { fus: 2.0e5, wing: 5.0e5, gear: 2.8e4 },
    c:     { fus: 60,    wing: 450,   gear: 900 },
    // The k/c above are the Cub's, and the Cub is a ~390 kg aeroplane. They are
    // NOT constants of the material — you build heavier tube for a heavier
    // machine — so they scale with all-up mass off this reference. Without it a
    // big engine simply folds the gear (measured: a 750 kg radial put the
    // aeroplane on its firewall with the gear hanging unloaded).
    refMass: 390,
    // `price` is credits per kg of finished structure — the stock, the covering
    // and the labour rolled into one number. Steel tube and fabric is the cheap
    // way to build an aeroplane; that is most of why the Cub exists.
    price: 42,
    cd0: 0.0022, clmaxK: 1.00,
  },
  wood: {
    name: 'spruce + ply',
    // sigY is spruce CRUSHING parallel to grain (~39 MPa), not its tension
    // figure (~70): a wooden airframe fails in compression and at its glue
    // joints long before the timber pulls apart.
    phys: { E: 10.9e9, rho: 450, sigY: 39e6 },
    lin:   { fus: 0.50, wing: 0.58, gear: 1.20 },
    cover: 0.62,
    k:     { fus: 4.0e5, wing: 2.5e6, gear: 1.3e5 },
    c:     { fus: 300,   wing: 950,   gear: 2400 },
    refMass: 630,                       // the Jodel's row, and the Jodel's mass
    // Dearer than steel tube despite cheaper stock: `price` is the FINISHED
    // cost with the labour in it, and a wooden airframe is thousands of hours
    // of gluing and clamping where a tube fuselage is a fortnight of welding.
    // At 30 it was strictly cheaper AND lighter AND stiffer AND slipperier
    // than tube+fabric, which is not a choice.
    price: 55,
    cd0: 0.0009, clmaxK: 1.02,
  },
  // Aluminium semi-monocoque. The k/c are MEASURED off the C172 fiche rather
  // than chosen — 8.0e5/500 through the fuselage, 2.2e6/900 through the wing,
  // 1.6e5/2600 in the gear — so the one material the fleet actually flies in
  // metal sets the numbers. refMass is that aeroplane's mass, which is what
  // makes a SMALL alloy aeroplane come out in thinner sheet.
  alloy: {
    name: '2024 alloy sheet',
    phys: { E: 73.1e9, rho: 2780, sigY: 345e6 },
    lin:   { fus: 0.50, wing: 0.55, gear: 1.10 },
    cover: 1.05,                        // the skin is structure here, and heavy
    k:     { fus: 8.0e5, wing: 2.2e6, gear: 1.6e5 },
    c:     { fus: 500,   wing: 900,   gear: 2600 },
    refMass: 998,
    price: 78,                          // jigs, rivets, and a skilled hand
    cd0: 0.0012, clmaxK: 1.02,          // flush rivets, but laps and oil-canning
  },
  // Carbon over foam. The lightest airframe here and the dearest by a long way.
  // Its DAMPING is deliberately the lowest of the four: a composite structure
  // rings where a bolted metal or glued wooden one does not, and that is not a
  // detail — c is what binds the timestep, so getting it wrong the flattering
  // way would have cost 64 substeps instead of 50 for no physical reason.
  carbon: {
    name: 'carbon + epoxy',
    // no yield at all — sigY is the UD tensile strength and the material goes
    // straight from elastic to in pieces. That is the second axis this row
    // gains once a failure model exists; today it is reporting only.
    phys: { E: 135e9, rho: 1550, sigY: 1500e6 },
    lin:   { fus: 0.38, wing: 0.44, gear: 0.85 },
    cover: 0.55,
    k:     { fus: 1.1e6, wing: 2.0e6, gear: 1.5e5 },
    c:     { fus: 250,   wing: 500,   gear: 1800 },
    refMass: 420,                       // tuned at the size this generator builds
    price: 165,                         // moulds, cloth, vacuum, and the hours
    cd0: 0.0004, clmaxK: 1.05,          // moulded: the best surface on the list
  },
};

// ===========================================================================
// GEN_BUILD_GRAMMAR (G68) — HOW EACH CONSTRUCTION SHOWS ITSELF
// ===========================================================================
// The four rows above already move physics and have always moved NOTHING you
// can see: the longest-standing open playtest item in HANDOVER is "Structure
// has no visual feedback ... Four materials look identical". This is the
// other half of each row — what an aeroplane built that way actually looks
// like, in metres, so the fasteners and seams land on the real structure
// instead of being a decorative tiled texture (the user's own objection).
//
// It lives HERE, beside GEN_MATERIALS, because it is the same fact seen from
// the other side. `alloy.cd0`'s own comment already reads "flush rivets, but
// laps and oil-canning" — the grammar was documented in a comment and not
// implemented.
//
// EVERY LENGTH IS METRES, and every one is a real number rather than a chosen
// one. The renderer consumes them through the G66 surface field, whose sL and
// sC are also metres, so a 25 mm rivet pitch is 25 mm on the aeroplane at any
// size of aeroplane.
//
// THE PITCHES ARE NOT THE CAGE'S RING SPACING, and must not be. The cage's
// rings sit at ANATOMY stations (pillars, bulkheads, the tailpost) 0.6-1.5 m
// apart, and the boom is a single ~4 m bay with no ring in it at all (seen
// directly in G66's lattice view). A real airframe carries frames every
// 0.38-0.50 m regardless. So the frames run at their own metric pitch along
// sL and the cage's own rings get a HEAVIER line on top — which is also what
// a real frame diagram looks like, bulkheads being frames like any other.
const GEN_BUILD_GRAMMAR = {
  // 4130 tube + Ceconite. THERE ARE NO FASTENERS IN THE COVERING AT ALL: the
  // fabric is cemented and sewn to the frame and there is nothing to rivet.
  // Everything you see is the STRUCTURE PUSHING THROUGH A MEMBRANE, which is
  // why this row is all tape and sag and no heads.
  tubeFabric: {
    name: 'tube + fabric',
    framePitch: 0.42,        // truss bays; the tape crosses at each
    stringerPitch: 0.16,     // 12-20 stringers around a light fuselage
    panelAlong: 0, panelAround: 0,   // one envelope: no panels, no lines
    // 50 mm (2 in) pinked-edge surface tape, doped, rising 0.3-0.8 mm with a
    // soft shoulder. This ridge is most of what makes a covered airframe read
    // as covered — garage.js's own comment, and it was right.
    tape: { w: 0.050, rise: 0.00065 },
    // fabric slack between members: 0.5-1.5 % of the pitch, FLAT-BOTTOMED.
    // The exponent is what makes it read as a membrane under tension rather
    // than as a wave, and 1.4 is the value the old bump sheet used.
    sag: { frac: 0.006, exp: 1.4 },
    dish: 0,
    fastener: null,
    seam: null,
    rough: { member: -0.04, seam: 0 },   // dope pools slightly on a tape
  },
  // spruce + birch ply. Pinned and glued: the pins are a STIPPLE under dope,
  // not bright dots, and they follow every glue line.
  wood: {
    name: 'spruce + ply',
    framePitch: 0.38,
    stringerPitch: 0.22,
    panelAlong: 2.0,         // a ply sheet is 1220 x 2440 and scarfs at a frame
    panelAround: 0.85,       // and will not wrap much past this
    tape: { w: 0.020, rise: 0.00012 },   // the frame under the skin, barely
    sag: { frac: 0.0015, exp: 2.0 },     // ply dishes; it does not sag
    dish: -0.0003,
    // gimp pins at 25 mm (Jodel plans), 1.6 mm heads standing 0.10-0.15 mm
    fastener: { kind: 'nail', pitch: 0.025, rowW: 0.020,
                dia: 0.0016, rise: 0.00012 },
    seam: { width: 0.015, step: 0.0004 },   // a 10:1 scarf, sanded flush-ish
    rough: { member: 0.0, seam: 0.05 },
  },
  // 2024-T3 semi-monocoque. The loudest grammar, and where believability is
  // won: A RIVET IS A LOAD PATH. It exists only where the skin meets a frame,
  // a stringer, a spar cap or another sheet — never in the middle of a panel.
  alloy: {
    name: '2024 alloy sheet',
    framePitch: 0.45,        // 380-500 mm; the C172 is ~20 in
    stringerPitch: 0.14,     // 100-180 mm on a light aeroplane
    panelAlong: 1.0, panelAround: 0.55,
    tape: { w: 0.012, rise: 0.00008 },   // the frame telegraphing through
    sag: { frac: 0, exp: 1 },
    // OIL-CANNING, and it is what makes metal read as metal in raking light.
    // 0.5-2 mm, and it DISHES IN more than it bulges out — hence the sign.
    dish: -0.0012,
    // AN470 universal: 4.8 mm across, 1.4 mm proud, 20-25 mm pitch (the 4D-6D
    // design rule). EDGE DISTANCE is 2D, so the row sits 5-8 mm INSIDE the
    // sheet edge rather than on it — a cheap, strong, specific cue, and it
    // falls out for free here because the row is on the member and the panel
    // line is beside it.
    fastener: { kind: 'rivet', pitch: 0.024, rowW: 0.016,
                dia: 0.0048, rise: 0.0014 },
    // lap: 20-25 mm overlap, one sheet thickness of step
    seam: { width: 0.022, step: 0.0008 },
    rough: { member: 0.02, seam: 0.06 },
  },
  // carbon over foam. ALMOST NOTHING, AND THAT IS THE LOOK — the point of a
  // moulded structure is that it has no fasteners and no seams in the flying
  // surfaces. Getting this row right means resisting the urge to add detail.
  carbon: {
    name: 'carbon + epoxy',
    framePitch: 0, stringerPitch: 0,     // nothing telegraphs through a moulding
    panelAlong: 0, panelAround: 0,
    // ONE line, at the waterline, because that is where the mould splits —
    // and the waist rail is exactly sC = 0, so it costs a single comparison
    partingAtWaist: 0.003,
    tape: { w: 0, rise: 0 },
    sag: { frac: 0, exp: 1 },
    dish: 0,
    // 5-10 mm weave print-through at ~0.05 mm is the whole difference between
    // "moulded" and "plastic"; it rides the finish's own twill sheet
    fastener: null,
    seam: null,
    rough: { member: 0, seam: 0.03 },
  },
};


// ===========================================================================
// GEN_ACCESS (G82) — WHAT AN AEROPLANE HAS TO HAVE ON THE OUTSIDE OF IT
// ===========================================================================
// The third table in this file, and it is one more fact seen from one more
// side. GEN_MATERIALS says what a construction WEIGHS and DRAGS;
// GEN_BUILD_GRAMMAR says what it LOOKS LIKE; this says what has to be BOLTED
// TO IT so the thing can be fuelled, inspected, flown and tied down.
//
// It is this file's own long-standing gap, written out at last. HANDOVER's
// G68 list has carried it for two chantiers:
//
//   "No access panels, no inspection rings, no fuel caps. GEN_ACCESS is
//    designed (a declared table of REQUIREMENTS, each naming what it serves
//    and a placement rule, resolved against built geometry and SNAPPED to
//    structure) and not written. The acceptance test for it is stated: you
//    can point at any hatch and say what is behind it, and no tank means no
//    fuel cap."
//
// ---------------------------------------------------------------------------
// EVERY ROW NAMES WHAT IT SERVES, AND THAT IS THE POINT OF THE TABLE.
//
// `serves` is not a comment. It is the answer to the acceptance test, it is
// what the verdict prints, and GATE ACCESS fails a row that leaves it empty.
// An aeroplane with a hatch nobody can explain has decoration on it, and
// decoration is what this arc exists to avoid — the ruling is already on the
// record for wear: "a hand-placed smudge is decoration, and decoration does
// not survive the aeroplane changing shape under it".
//
// So there is no row for "a panel, about here, because it looks bare". Every
// one is a thing a real aeroplane cannot do without, and the ones this
// particular aeroplane does not need do not appear on it.
//
// ---------------------------------------------------------------------------
// `need(R)` IS THE HALF THAT MAKES IT HONEST.
//
// R is a REQUIREMENTS RECORD, not a spec: a small flat reading of what the
// aeroplane is, which both front doors below produce. That indirection is the
// airframe contract's own, for its stated reason — objAirframe and
// cageAirframe reach one meshAirframe "instead of two that can drift". The
// game spec and the cage editor's parameters are two descriptions of one
// aeroplane, and this table must not learn either of them.
//
// `need` returns HOW MANY, so 0 is the honest answer and not a special case:
//   no tank                  -> no filler cap
//   minimal panel, no radio  -> no aerials at all, which is a visible and
//                               correct difference between two aeroplanes
//   no cargo bay             -> no baggage door
//   carbon                   -> no laced ring and no screwed panel: you do
//                               not cut an inspection hole in a moulding,
//                               and not having any is the point of one
//
// ---------------------------------------------------------------------------
// THE PLACEMENT RULE IS METRIC, AND THEN IT IS SNAPPED.
//
// `at(R)` returns { sL, lv }. sL is METRES aft of the firewall, because a
// station is a real distance: a fitting 300 mm behind the cabin is 300 mm
// behind the cabin on any aeroplane. `lv` is the RAIL it sits on — 0 keel,
// 1 floor, 2 waist, 3 band, 4 ceiling, 5 roof, fractions in between — plus
// the two names the rails do not cover, 'crown' and 'keel', which mean the
// CENTRELINE at the top and at the bottom.
//
// ROUND THE SECTION IS A PLACE, NOT A DISTANCE, and getting that wrong cost
// two rewrites. Metres round the section fail because a fuselage SHRINKS:
// "0.67 m below the waist" is on the belly at the cabin and 300 mm off the
// aeroplane at the tailpost, so the tail tie-down silently never appeared at
// all. A fraction of the measured arc fails for a subtler reason — the arc
// has to be sampled over a fore-aft window, and the window's maximum
// overshoots the section at its aft end. `lv` needs no measurement: it is
// exact at every station, and "on the keel" means the same thing everywhere.
//
// `snap` then rounds the STATION onto real structure, which _fit_site.js does
// as an integer rounding rather than a search, because the field's st IS an
// integer at every ring.
//
// MOST FITTINGS WANT 'bay', NOT 'ring'. An access panel goes BETWEEN two
// frames, because a frame is precisely what it is there to reach past; a
// panel centred on a former is the tell that a hatch was placed by eye. The
// exceptions are the ones that bolt THROUGH structure — a step, a tie-down,
// an aerial doubler — and they take 'ring' for the same reason.
//
// ---------------------------------------------------------------------------
// SIDES. sC and lv are mirrored across the spine and the keel by construction
// (_cage_gen.js:180), so a metric site names a point on EACH flank and 'both'
// is the cheap case. A one-sided fitting is declared here and drawn into its
// own group, because GATE GEN asserts the aeroplane mirrors and `pitot` has
// had to do exactly that since G5 (63_gen_skin.js:436).
//
// `on` NAMES WHOSE SKIN IT IS. The fuselage cage, the wing loft and the cowl
// are three different surfaces with three different coordinates, and a row
// says which one it belongs to rather than pretending there is one. G83
// places the body's; the wing's and the cowl's are G84. A row is DECLARED
// here the moment the aeroplane needs it, even if its placer is not written
// yet — because the alternative is a wing-tank aeroplane that silently has no
// filler cap anywhere, which is the acceptance test failing quietly, and
// quietly is how this gap survived two chantiers already.
//
// EVERY DIMENSION IS METRES, and every one is a real number rather than a
// chosen one — the rule GEN_BUILD_GRAMMAR set, and the reason its rivet pitch
// is 24 mm and not "small".
const GEN_ACCESS = {
  // -------------------------------------------------------------------------
  // FLUIDS — the openings named first, and the ones with the strictest
  // justification: each is where a fluid enters or leaves, so where it goes
  // is decided by where the fluid is.
  // -------------------------------------------------------------------------
  fuelCap: {
    name: 'Fuel filler cap',
    serves: 'the fuel tank',
    // THE ACCEPTANCE TEST, IN ONE LINE: no tank, no cap. And a wing tank's
    // cap is not on the fuselage at all — GEN_TANKS already says where the
    // fuel is, so this row does not get an opinion about it.
    need: R => (R.tank === 'nose' && R.fuelL > 0) ? 1 : 0,
    // ahead of the windscreen on the cowl deck: where a nose tank is filled
    // from, and why a Cub's cap sits in front of the pilot's face
    // ON THE CROWN, AND WELL FORWARD. Two things about the nose had to be
    // measured rather than assumed: it has NO ROOF RAIL at all (its ring is
    // deck/floor/keel, so lv 5 does not exist forward of the firewall), and
    // its "deck" sits at WAIST height — the nose is a slender cone whose top
    // is the waist line. So the crown query is the right one and it lands on
    // the top of the nose, which is where a Cub's cap is. At sL -0.10 it hits
    // the windscreen and is correctly refused; -0.35 is clear of it on every
    // build in the battery.
    at: () => ({ sL: -0.35, lv: 'crown' }),
    snap: 'bay', side: 'centre',
    form: 'capProud', size: { d: 0.075, h: 0.014 },
  },
  fuelCapWing: {
    name: 'Wing filler cap',
    serves: 'the wing tank',
    need: R => (R.fuelL > 0 && (R.tank === 'wing' || R.tank === 'panel'))
      ? 2 : 0,
    on: 'wing',
    // THE WING'S OWN FIELD, which is the same four numbers meaning something
    // else (G68.1): sL is spanwise METRES FROM THE ROOT, lv is 0 at the front
    // spar and 1 at the rear. A tank sits in the bay BETWEEN the spars, so its
    // cap is between them too — 0.30 is just aft of the front spar, where the
    // filler neck clears it.
    //
    // ON THE UPPER SURFACE, and that is not a detail: chordwise distance from
    // the leading edge is identical on both skins, so `side` is the only thing
    // that stops the cap being fitted to the underside of the wing.
    at: R => ({ sL: R.semispan * (R.tank === 'panel' ? 0.62 : 0.24),
                lv: 0.30 }),
    snap: 'bay', side: 'upper',
    form: 'capFlush', size: { d: 0.075, h: 0.004 },
  },
  fuelDrain: {
    name: 'Fuel drain',
    serves: 'the tank sump — the pre-flight fuel sample',
    need: R => R.fuelL > 0 ? 1 : 0,
    // THE LOWEST POINT UNDER THE TANK. A sump drain anywhere else drains
    // nothing, which is why sC is pinned to the keel and not offered a range.
    at: R => ({ sL: R.tank === 'nose' ? 0.10 : 0.55, lv: 'keel' }),
    snap: 'bay', side: 'centre',
    form: 'drainValve', size: { d: 0.022, h: 0.030 },
  },
  oilDoor: {
    name: 'Oil filler door',
    serves: 'the engine oil filler and the dipstick',
    need: R => (R.engine && R.cowl) ? 1 : 0,
    on: 'cowl',
    // THE COWL IS AN ANALYTIC SURFACE, not a mesh with a field: `surfPoint(th,
    // z)` evaluates it directly (_cowl_gen.js:311). So this row speaks the
    // cowl's own parameters — `frac` along its length from the firewall, and
    // `az` the section angle, where 0 is the starboard flank, 90 the crown and
    // 180 the port flank. 122 degrees is the port upper shoulder, which is
    // where you reach an oil filler from standing beside the aeroplane.
    at: () => ({ frac: 0.45, az: 122 }),
    snap: 'free', side: 'port',
    form: 'doorHinged', size: { w: 0.170, h: 0.130, t: 0.006 },
  },
  staticDrain: {
    name: 'Static system drain',
    serves: 'the static line — water out of the instrument plumbing',
    need: R => R.systems === 'ifr' ? 1 : 0,
    // CLEAR OF THE FUEL DRAIN, which is the other thing on the keel and which
    // MOVES: a nose tank drains at 0.10 and a wing tank at 0.55. At a fixed
    // 0.72 with a 'bay' snap the two collapsed into the same bay on every IFR
    // wing-tank aeroplane and drew through each other. Measured from the back
    // of the cabin it clears both, and 'free' keeps it there — a drain is a
    // small fitting through its own doubler and has no reason to sit on a
    // frame, unlike the things that bolt through one.
    at: R => ({ sL: R.cabinAft * 0.85, lv: 'keel' }),
    snap: 'free', side: 'centre',
    form: 'drainValve', size: { d: 0.018, h: 0.024 },
  },

  // -------------------------------------------------------------------------
  // ACCESS — the inspection traps. WHAT THEY REACH DECIDES WHERE THEY ARE,
  // and the four constructions reach it four different ways: you unlace a
  // fabric ring, unscrew an alloy plate or a ply doubler, and on a moulding
  // you do not go in at all.
  // -------------------------------------------------------------------------
  inspTail: {
    name: 'Tail inspection ring',
    serves: 'the elevator and rudder cable runs at the tailpost',
    // ONE ON A SLIM BOOM, ONE EACH SIDE ON A FULL SECTION, and that is what a
    // real aeroplane does rather than a concession: a pod-and-boom tail is a
    // tube a few hundred millimetres across, and two 130 mm rings on it would
    // meet round the back. Measured: on the rod build the port and starboard
    // rings landed 112 mm apart and needed 150. The narrow case puts its one
    // ring underneath, which is where you would actually cut it.
    need: R => R.material === 'carbon' ? 0 : (R.tailHalfW < 0.16 ? 1 : 2),
    at: R => ({ sL: R.tailArm * 0.86,
                lv: R.tailHalfW < 0.16 ? 'keel' : 1.7 }),
    snap: 'bay', side: R => R.tailHalfW < 0.16 ? 'centre' : 'both',
    form: R => R.material === 'tubeFabric' ? 'ringLace' : 'plateOval',
    size: { w: 0.130, h: 0.130 },
  },
  inspBelly: {
    name: 'Belly inspection panel',
    serves: 'the control runs and the seat-belt anchorages under the floor',
    need: R => R.material === 'carbon' ? 0 : 1,
    at: R => ({ sL: R.cabinAft * 0.72, lv: 0.55 }),
    snap: 'bay', side: 'centre',
    form: R => R.material === 'tubeFabric' ? 'ringLace' : 'plateOval',
    size: { w: 0.200, h: 0.150 },
  },
  inspAileron: {
    name: 'Aileron bellcrank cover',
    serves: 'the aileron bellcrank and its cable ends',
    need: R => (R.wing && R.material !== 'carbon') ? 2 : 0,
    on: 'wing',
    // AFT OF THE REAR SPAR (lv > 1) and UNDERNEATH, because that is where a
    // bellcrank is and where you reach it from. lv runs past 1 to the trailing
    // edge — with the stock 15/65% spars the TE is lv 1.7 — so 1.25 is in the
    // bay between the rear spar and the aileron hinge.
    at: R => ({ sL: R.semispan * 0.66, lv: 1.25 }),
    snap: 'bay', side: 'lower',
    form: 'plateOval', size: { w: 0.150, h: 0.110 },
  },
  baggageDoor: {
    name: 'Baggage door',
    serves: 'the cargo bay',
    // no bay, no door — the same shape of test as the fuel cap
    need: R => R.cargo > 0.25 ? 1 : 0,
    at: R => ({ sL: R.cabinAft + R.cargo * 0.5, lv: 2.6 }),
    snap: 'bayrail', side: 'port',
    form: 'doorHinged', size: { w: 0.480, h: 0.420, t: 0.008 },
  },

  // -------------------------------------------------------------------------
  // INSTRUMENTS — the things that have to sit in clean air, which is what
  // decides where each one goes. A static port in the wake of a door frame
  // reads the wrong altitude, and that is not a cosmetic fact.
  // -------------------------------------------------------------------------
  staticPort: {
    name: 'Static port',
    serves: 'the altimeter, the ASI and the VSI',
    need: R => R.systems === 'minimal' ? 0 : 2,
    // aft of the cabin, on the flank at waist height: the flattest and least
    // disturbed piece of skin an aeroplane has
    at: R => ({ sL: R.cabinAft + 0.30, lv: 1.85 }),
    snap: 'bay', side: 'both',
    form: 'portStatic', size: { d: 0.030, h: 0.003 },
  },
  venturi: {
    name: 'Venturi',
    serves: 'the vacuum for the turn indicator, on an aeroplane with no'
          + ' engine-driven pump',
    need: R => (R.systems === 'basic' && R.material === 'tubeFabric') ? 1 : 0,
    at: () => ({ sL: 0.34, lv: 1.45 }),
    snap: 'ring', side: 'port',
    form: 'venturi', size: { d: 0.058, len: 0.190, stand: 0.070 },
  },
  oatProbe: {
    name: 'OAT probe',
    serves: 'the outside air temperature gauge',
    need: R => R.systems === 'minimal' ? 0 : 1,
    // ABOVE THE WAIST AND WELL AFT OF THE VENTURI. Both want clean air low on
    // the port side of the nose, and the first cut put them 53 mm apart —
    // which is not "near", it is interpenetrating, since the venturi alone is
    // 190 mm long. An OAT probe lives by the windscreen post where the pilot
    // can read it, so up it goes.
    at: () => ({ sL: 0.30, lv: 2.45 }),
    snap: 'free', side: 'port',
    form: 'probeOAT', size: { d: 0.012, len: 0.075 },
  },

  // -------------------------------------------------------------------------
  // AERIALS AND LIGHTS — GEN_SYSTEMS already prices the radios, so it also
  // decides what is on the outside carrying them.
  // -------------------------------------------------------------------------
  commAerial: {
    name: 'Comm aerial',
    serves: 'the VHF radio',
    need: R => R.systems === 'minimal' ? 0 : 1,
    at: R => ({ sL: R.cabinAft + 0.45, lv: 'crown' }),
    snap: 'ring', side: 'centre',
    form: 'bladeAerial', size: { h: 0.230, c: 0.090, t: 0.010 },
  },
  navAerial: {
    name: 'Nav aerial',
    serves: 'the VOR receiver',
    need: R => R.systems === 'ifr' ? 1 : 0,
    at: R => ({ sL: R.tailArm * 0.55, lv: 'crown' }),
    snap: 'ring', side: 'centre',
    // `foot` is what it OCCUPIES, which is not what it spans. The wire runs
    // 1.2 m aft to the fin and passes clean over anything under it, so
    // clearance is a question about the MAST — 140 mm of insulator and base.
    // Without it the aerial demanded 650 mm of empty deck and pushed the
    // beacon off a short-coupled aeroplane for no physical reason.
    form: 'wireAerial', size: { h: 0.120, run: 1.20, foot: 0.140 },
  },
  xpdrAerial: {
    name: 'Transponder aerial',
    serves: 'the transponder',
    // UNDERNEATH, ALWAYS: a transponder aerial talks to a radar below it.
    //
    // AND AFT OF THE FUEL DRAIN, which is the other thing on the keel. At
    // 0.65 of the cabin length the two were 0.72 m and 0.55 m apart before the
    // snap and IN THE SAME BAY after it — the same point, to the millimetre,
    // on any IFR aeroplane with wing tanks. Measured aft from the back of the
    // cabin instead, it is clear of the drain on every fuselage, and it is
    // also where a real one is: under the baggage bay, behind the spar.
    need: R => R.systems === 'ifr' ? 1 : 0,
    at: R => ({ sL: R.cabinAft + (R.tailArm - R.cabinAft) * 0.18,
                lv: 'keel' }),
    snap: 'bay', side: 'centre',
    form: 'bladeAerial', size: { h: 0.075, c: 0.050, t: 0.008 },
  },
  beacon: {
    name: 'Anti-collision beacon',
    serves: 'being seen',
    need: R => R.systems === 'minimal' ? 0 : 1,
    // 'free', not 'ring'. A beacon is a small light on its own doubler and
    // does not bolt through a frame, and snapping it to one put it on the
    // same station as the comm aerial — two fittings in one place, which
    // draws as z-fighting rather than as a mistake.
    //
    // AND ITS STATION IS A FRACTION OF THE WAY AFT, not a fraction of the tail
    // arm. Those are different: 0.40 of the tail arm is still over the CABIN
    // on a short-coupled aeroplane, where the roof is glazed and the fitting
    // is refused. Measured from the back of the cabin to the tailpost it is
    // always on the turtledeck, which is where a beacon goes.
    at: R => ({ sL: R.cabinAft + (R.tailArm - R.cabinAft) * 0.60,
                lv: 'crown' }),
    snap: 'free', side: 'centre',
    form: 'lightBeacon', size: { d: 0.062, h: 0.055 },
  },

  // -------------------------------------------------------------------------
  // HANDLING — how a person gets in, and how the aeroplane spends the night.
  // These bolt THROUGH structure, so they snap to a ring and not to a bay: a
  // step screwed to unsupported fabric is a step that leaves with the first
  // person who stands on it.
  // -------------------------------------------------------------------------
  // A STEP IS NEEDED WHEN THE SILL IS HIGH, and that is a measurement, not a
  // proxy for one. The first cut keyed on the cabin's own HEIGHT, which is
  // the wrong quantity twice over: it says nothing about how far off the
  // ground the floor is, and on the resolved default it landed 0.01 m under
  // its own threshold — a fitting appearing or vanishing on a knife edge that
  // means nothing. `sillH` is the cabin keel above the ground line, which is
  // exactly what a person climbing in has to deal with. 0.62 m is a long
  // step up and about where real aeroplanes start fitting one.
  step: {
    name: 'Boarding step',
    serves: 'getting in over a high sill',
    need: R => R.sillH > 0.62 ? (R.doorBoth ? 2 : 1) : 0,
    at: R => ({ sL: R.cabinAft - 0.12, lv: 0.85 }),
    snap: 'ring', side: R => R.doorBoth ? 'both' : 'port',
    form: 'stepBoard', size: { reach: 0.150, w: 0.110, r: 0.011 },
  },
  grabHandle: {
    name: 'Grab handle',
    serves: 'the same hand, one move earlier',
    // it goes with the step, because it is half of the same movement
    need: R => R.sillH > 0.62 ? (R.doorBoth ? 2 : 1) : 0,
    at: R => ({ sL: R.cabinAft - 0.30, lv: 3.3 }),
    snap: 'ring', side: R => R.doorBoth ? 'both' : 'port',
    form: 'handleGrab', size: { reach: 0.070, w: 0.130, r: 0.009 },
  },
  tieDownTail: {
    name: 'Tail tie-down',
    serves: 'the night, and the wind',
    need: () => 1,
    // FORWARD OF THE TAILWHEEL, and that is why it is 0.86 and not 0.94. At
    // 0.94 it lands ON the tailpost, which is exactly where the tailwheel leg
    // and its castor are: measured on the bench build, the assembly spans
    // z -2.69..-2.17 and the ring sat at -2.31, entirely inside it. The
    // geometry was correct and completely invisible.
    //
    // IT WAS FOUND BY COUNTING PIXELS, not by the gate, and that is the
    // declared limit of GATE FIT: it checks fittings against the SKIN and
    // against each other, and knows nothing about the gear, engine or tail
    // layers. Cross-layer clearance is not solved here.
    at: R => ({ sL: R.tailArm * 0.86, lv: 'keel' }),
    snap: 'ring', side: 'centre',
    form: 'ringTiedown', size: { d: 0.044, t: 0.008 },
  },
};

// ---------------------------------------------------------------------------
// THE TWO FRONT DOORS. One table, two ways in — the objAirframe/cageAirframe
// idiom, for its stated reason: a frozen description and a live one must reach
// the same code "instead of two that can drift".
//
// Both produce a REQUIREMENTS RECORD. Everything in it is either read off a
// declaration this file already owns (GEN_TANKS, GEN_SYSTEMS, GEN_MATERIALS)
// or measured off the aeroplane. Nothing is invented, and a field nobody can
// supply is left null so a `need` can refuse on it.
// IT TAKES A RESOLVED SPEC, and that is not a preference. In GEN_DEFAULT
// `cabin.h`, `cabin.len` and `fuselage.tailArm` are all NULL — null means
// "derive it", and resolveSpec is what does. Handed a raw spec this would
// fall back to plausible constants and place every fitting on an aeroplane
// that does not exist, silently. It is the G48 lesson in a new place: any
// assertion or measurement against the spec has to run POST-resolveSpec,
// because the interesting values are derived and the raw ones are holes.
//
// So the fallbacks below are a LAST RESORT for a partial spec, and `derived`
// records whether any of them fired. GATE ACCESS asserts it is false for a
// resolved spec — a fallback that becomes the normal path is a measurement
// that has quietly stopped measuring.
function genAccessNeeds(S) {
  const f = S.fuselage || {};
  const c = S.cabin || {};
  const g = S.gear || {};
  let derived = 0;
  const need = (v, d) => { if (v == null) { derived++; return d; } return v; };
  const cabH = need(c.h, 1.15);
  return {
    tank:      (S.fuel && S.fuel.litres > 0) ? (S.fuel.tank || 'nose') : null,
    fuelL:     (S.fuel && S.fuel.litres) || 0,
    systems:   (S.systems && S.systems.fit) || 'basic',
    material:  f.material || 'tubeFabric',
    cargo:     (S.cargo && S.cargo.len) || 0,
    engine:    !!((S.engines && S.engines.length) || S.engine),
    cowl:      !!(S.cowl && S.cowl.on !== false),
    // `wings` IS AN ARRAY (one entry per plane; a biplane has two), and
    // reading it as a single object is how this row silently answered "no
    // wing" for every aeroplane ever built.
    wing:      !!(S.wings && S.wings.length),
    // the geometry the placement rules need, in metres on the skin
    tailArm:   need(f.tailArm, 4.0),
    // the section at the tailpost, which decides whether two inspection rings
    // fit side by side or one goes underneath
    tailHalfW: need(f.tailW, 0.10),
    // half the span, because a wing fitting's station is measured from the
    // ROOT outward. `wings` is an array; the first plane is the one fittings
    // go on (a biplane's lower wing is P7's problem).
    semispan:  ((S.wings && S.wings[0] && S.wings[0].span) || 10) * 0.5,
    cabinAft:  need(c.len, 1.6) + 0.45,
    deckArc:   cabH * 0.50,
    keelArc:   cabH * 0.42,
    // THE SILL ABOVE THE GROUND LINE, and it is two real dimensions and
    // nothing else: the leg hangs the axle `legDrop` below the bottom of the
    // fuselage, and the wheel carries the axle `wheelR` off the ground. Their
    // sum IS how far the floor is up. The first cut subtracted a fraction of
    // the cabin height as well, which mixed the cabin's frame into the gear's,
    // and it read `gear.drop` — a key that does not exist, so the fallback
    // fired on every aeroplane and the whole term was a constant.
    sillH:     need(g.legDrop, 0.42) + need(g.wheelR, 0.20),
    doorBoth:  true,
    derived,
  };
}

// The LIVE CAGE's own parameters. The editor never has a game spec in hand
// during a build — the join is what makes one, and running the join on every
// pixel of a slider drag is not a thing to do — so the cage reads its own
// knobs. The keys are ones the panel already carries, which is the discipline
// _cage_parts.js applies to its own `when(P)` discriminators.
//
// `extra` carries the handful of facts the CAGE HAS NO KNOB FOR — the tank,
// the instrument fit, the covering — which live in the game spec and reach
// the editor through GARAGE_SPEC. Defaulted rather than assumed absent,
// because an aeroplane with no declared tank is a bench artefact, not a
// design decision.
function genAccessNeedsCage(P, extra) {
  const E = extra || {};
  const keel = Math.abs((P.waistY || 0) - (P.keelY == null ? -0.7 : P.keelY));
  const deck = Math.abs((P.roofY == null ? 1.0 : P.roofY) - (P.waistY || 0));
  const bays = Math.max(0, Math.round(+P.paxCount || 0));
  let derived = 0;
  return {
    tank:      E.tank !== undefined ? E.tank : 'nose',
    fuelL:     E.fuelL !== undefined ? E.fuelL : 50,
    systems:   E.systems || 'basic',
    material:  E.material || 'tubeFabric',
    cargo:     E.cargo || 0,
    engine:    !!(P.engOn == null ? 1 : +P.engOn),
    cowl:      !!(P.cowlOn == null ? 1 : +P.cowlOn),
    wing:      !!(P.wingOn == null ? 1 : +P.wingOn),
    // MEASURED OFF THE CAGE, not guessed. The cabin's length, the bays and
    // the boom's run are parameters the panel already has, so a short
    // aeroplane gets its fittings closer together — which is the whole reason
    // the rules are metric rather than fractions of anything.
    tailArm:   (P.pilotLen || 1.6) + (P.paxLen || 0) * bays
               + (+P.taperOn ? (P.taperLen || 0) : 0) + (P.boomLen || 2.2),
    cabinAft:  (P.pilotLen || 1.6) + 0.45,
    // a ROD boom is its own diameter; a lofted tail cone is its half-width
    tailHalfW: (+P.boomStyle === 1) ? (P.rodD || 0.18) * 0.5
                                    : (P.tailHalfW == null ? 0.10 : P.tailHalfW),
    semispan:  (P.wgSpan || 10) * 0.5,
    deckArc:   deck * 0.94,
    keelArc:   keel * 0.94,
    // MEASURED BY THE LAYER, which has both ends of it: the gear layer
    // publishes the ground line it settled the aeroplane onto (CAGE_GEAR.gy)
    // and the cage's own keel is on the mesh. Passed in rather than guessed
    // here, and counted when it is not — a step that appears because nobody
    // measured is the decoration this table exists to refuse.
    sillH:     E.sillH != null ? E.sillH : (derived++, 0.62),
    doorBoth:  !!(+P.doorOn) && !(+P.doorGone),
    derived,
  };
}

// every row THIS aeroplane needs, with its count and its site rule already
// resolved — the list the layer draws and the verdict prints
function genAccessList(R) {
  const out = [];
  for (const key in GEN_ACCESS) {
    const row = GEN_ACCESS[key];
    let n = 0;
    try { n = Math.max(0, Math.round(row.need(R) || 0)); } catch (e) { n = 0; }
    if (!n) continue;
    let at = null;
    try { at = row.at(R); } catch (e) { at = null; }
    if (!at) continue;
    out.push({
      key, n, at,
      name:   row.name,
      serves: row.serves,
      on:     row.on || 'body',
      snap:   row.snap || 'free',
      side:   typeof row.side === 'function' ? row.side(R) : (row.side || 'both'),
      form:   typeof row.form === 'function' ? row.form(R) : row.form,
      size:   row.size,
    });
  }
  return out;
}

// Fuselage shape families. The aft body tapers from the cabin box to the
// tailpost, and the FAMILY is the profile of that taper — an exponent on the
// station fraction, applied to width, floor and deck alike. Straight is a
// welded truss narrowing evenly (Cub, Jodel). Waisted holds the section aft of
// the cabin and necks down late, which is what a roomy machine looks like.
// Pod-and-boom drops to a slender tail quickly and runs it out.
//
// Deliberately NOT a preset over crownTop/crownSide: roundness is already a
// continuous knob and a family that reset it would fight the sliders. This
// changes geometry the sliders cannot reach.
const GEN_SHAPES = {
  straight: { name: 'Straight taper', taper: 1.00 },
  waisted:  { name: 'Waisted',        taper: 1.80 },
  boom:     { name: 'Pod and boom',   taper: 0.45 },
};

// High-lift devices. `dCl` is the SECTIONAL lift increment of a fully deployed
// flap at the reference chord fraction below — the strips decide how much span
// carries one, so this number is per section, not per aeroplane. The slotted
// row IS the PA-18's, tunnel-calibrated against its POH Vs ratio.
//
// The pitching moment is NOT a fourth free number. Both flapped fiches give the
// same ratio to their lift increment — PA-18 -0.40/1.60 = -0.250, C172
// -0.29/1.15 = -0.252 — so dCm0 is derived as GEN_FLAP_CM * dCl0 and cannot
// drift away from the lift it belongs to.
const GEN_FLAP_CREF = 0.20;   // chord fraction the dCl values are quoted at
const GEN_FLAP_CM = -0.25;
const GEN_FLAPS = {
  none:    { name: 'None',         dCl: 0,    cd: 0,     rate: 0.20 },
  plain:   { name: 'Plain flap',   dCl: 0.95, cd: 0.055, rate: 0.25 },
  slotted: { name: 'Slotted flap', dCl: 1.60, cd: 0.070, rate: 0.20 },
  fowler:  { name: 'Fowler flap',  dCl: 2.05, cd: 0.095, rate: 0.14 },
};

// Fuel tank station. Where the fuel sits moves the CG and the roll inertia, and
// those are the two things a builder gets wrong. Mass only — burn is not
// modelled, so this is the FULL-tanks case.
const GEN_TANKS = {
  nose: { name: 'Nose tank' },        // ahead of the panel: the Cub's, and the default
  wing: { name: 'Wing root' },
  panel: { name: 'Outboard wing' },   // out in the panel: relieves the spar, slows the roll
};

// Instrument fit. Mass is the TOTAL for the aeroplane.
const GEN_SYSTEMS = {
  minimal: { name: 'Minimal (day VFR)', mass: 6,  price: 700 },
  basic:   { name: 'Basic VFR',         mass: 12, price: 2400 },
  ifr:     { name: 'IFR panel + radios', mass: 26, price: 9500 },
};

// Undercarriage springing. The multipliers are relative to the Cub's bungee
// cord, read off the fleet's own gear constants normalised by mass:
// cub 74 k/kg (bungee) · c172 160 · chinook 152 · jodel 206 (spring steel).
// Damping is given PER ARCHETYPE rather than derived from k — an oleo really
// does damp far harder than a rubber cord — and genSubsteps() then picks a
// timestep that can integrate whatever this produces.
const GEN_SUSPENSION = {
  bungee: { name: 'Bungee cord',  k: 1.00, c: 1.00, price: 250 },
  spring: { name: 'Spring steel', k: 2.20, c: 1.20, price: 900 },
  oleo:   { name: 'Oleo strut',   k: 3.50, c: 2.60, price: 2600 },
};

// FAIRING LAYUP (G133). Mass and price factors on the fairing set — the
// glassfibre column is the datum (a GA wheel pant is ~2 kg at R 0.20, which
// the 55·R² anchor in genLattice reproduces); carbon buys weight with money,
// alloy the reverse. One material for the whole set: spats are laid up as
// one job, the way a real shop does them.
const GEN_FAIR_MATS = {
  glass:  { name: 'Glassfibre', m: 1.00, price: 1.00 },
  carbon: { name: 'Carbon',     m: 0.62, price: 2.40 },
  alloy:  { name: 'Alloy',      m: 1.30, price: 0.85 },
};

// THE PROPELLER, which is not part of the engine. The registry welds one to each
// powerplant (`POWERPLANTS[k].prop`) because the fleet's fiches are real
// aeroplanes with the props they were built with; a GARAGE aeroplane chooses.
//
// Per BLADE at D = 1.88 m, scaling as (D/1.88)^2.5 — props are not
// geometrically similar, so this is a fitted exponent, not a derivation.
// Anchors: a 1.88 m two-blade wooden prop is about 4.8 kg, and a 1.73 m
// three-blade carbon one about 3.9 kg (E-Props Durandal, ~4 kg real).
const GEN_PROP_MATS = {
  wood:   { name: 'Wood',      kg: 2.40, price: 900 },
  alu:    { name: 'Aluminium', kg: 4.20, price: 2200 },
  carbon: { name: 'Carbon',    kg: 1.60, price: 5200 },
  // G125: the scanned woods, priced as the boutique blanks they are. Mass
  // scales the wood anchor by Wood Handbook density (birch ~680: hard maple
  // ~705 -> 2.50, black walnut ~640 -> 2.25) — a walnut prop really is the
  // lighter one, and the vintage look is what the premium buys.
  maple:  { name: 'Maple',     kg: 2.50, price: 1300 },
  walnut: { name: 'Walnut',    kg: 2.25, price: 1500 },
};

// PITCH is a real trade and ONE number carries it: the figure of merit in
// momentum theory (ideal = 1). A fine prop bites hard standing still and runs
// out of pitch early; a coarse one gives away static thrust and keeps pulling.
// `fm` runs low to high the other way round from what the names suggest for
// exactly that reason.
//
// MEASURED, which is how the second half of this stopped being a fudge. The six
// registry props imply fm from 0.36 (the Sensenich cruise prop on the A-65) to
// 0.67 (the Rotax's slow-fly wooden one) — real spread, real props.
// The zero-thrust speed is the part momentum theory does NOT give you, and the
// registry's own kV2 values are per-AEROPLANE fits carrying its drag as well as
// its prop, so they cannot all be reproduced. What CAN be: `P / Tstatic` is the
// only velocity scale available without a shaft rpm, and ONE constant on it
// (GEN_RULES.propV0K) reproduces the A-65 entry to under a per cent — AND the
// pitch trade then falls out for free, because a fine prop's higher Tstatic
// lowers P/Tstatic and therefore its own zero-thrust speed. A first cut tabled
// `v0k` per pitch as well and got the trade BACKWARDS: it put a fine prop's
// thrust running out at 86 km/h on an aeroplane that cruises at 103.
//
// `pd` IS THE GEOMETRY AND `fm` IS THE PHYSICS, and they are two fields on
// purpose. The blade twist is built from a real pitch law — atan(P / 2 pi r) —
// which needs pitch as a fraction of the DIAMETER, the number written on the
// side of a real prop (a 74x45 is a P/D of 0.61). `fm` cannot stand in for it:
// it is a momentum-theory efficiency, it runs the other way round, and its
// spread is nothing like a pitch ratio's. Using one for the other would give a
// fine prop a coarser twist than a cruise prop, which is backwards and visible.
const GEN_PROP_PITCH = {
  climb:    { name: 'Fine (climb)',    fm: 0.58, pd: 0.55 },
  standard: { name: 'Standard',        fm: 0.46, pd: 0.70 },
  cruise:   { name: 'Coarse (cruise)', fm: 0.36, pd: 0.85 },
};

// COWL INTAKES. Texture only, deliberately: a grill drawn on the cover reads at
// every distance the aeroplane is ever seen from, and a modelled duct would cost
// a hole in the one panel whose whole job since G1.7 has been to have no holes
// in it ("a big opening… either the prop attachment or an air intake").
// `u` and `w` are the centre and half-width in the cowl's own angle coordinate
// (0 = top, 0.25 = +z side, 0.5 = belly); `n` is how many louvres.
const GEN_INTAKES = {
  none:  { name: 'None',            slots: [] },
  chin:  { name: 'Chin scoop',      slots: [{ u: 0.50, w: 0.085, n: 5 }] },
  twin:  { name: 'Twin cheek',      slots: [{ u: 0.34, w: 0.055, n: 4 },
                                            { u: 0.66, w: 0.055, n: 4 }] },
  ring:  { name: 'Ring (radial)',   slots: [{ u: 0.25, w: 0.075, n: 6 },
                                            { u: 0.75, w: 0.075, n: 6 },
                                            { u: 0.50, w: 0.075, n: 6 }] },
};

// Bought, not built: things with a price that does not follow from their mass.
// Credits. Nothing is unaffordable yet — the ledger records, it does not gate.
const GEN_PRICES = {
  wheel: 320,          // each: wheel, tyre, brake
  thirdWheel: 260,     // tailwheel or nosewheel assembly
  instruments: 2400,   // basic VFR panel
  paintJob: 1800,
  seat: 380,
  // G133 fairings — glassfibre datum, per piece; GEN_FAIR_MATS scales
  spat: 380,           // one wheel pant (a main or the third wheel)
  trouser: 560,        // one wheel in full trousers (shell + leg shroud)
  legFair: 240,        // one leg's streamline shroud on its own
};

// FINISH. `paintJob` above used to be spent unconditionally, which made 1800
// credits the one line on the bill nobody could argue with — and a homebuilt
// leaves the shop in primer more often than it leaves it painted. So it is a
// choice. `sweep` scales the trim stripe the paint sheet bakes (garage.js), so
// bare loses the scheme as well as the price; the base colour stays the
// player's, because a primer is still a colour and they already have a swatch
// for it. NOTE `paint.gloss` is NOT touched here: it is a spec field nothing
// currently reads, and wiring a dead field would be a second change wearing
// this one's clothes.
const GEN_FINISH = {
  full: { name: 'Painted',       price: GEN_PRICES.paintJob, sweep: 1 },
  bare: { name: 'Bare / primer', price: 0,                   sweep: 0 },
};

// Cabin box per seating layout: half-width, height above the lower longeron,
// fore-aft length, and the crew mass it carries.
// `deck` is the firewall top as a fraction of cabin height: the STEP between
// the two is the windscreen (see 63_gen_skin.js). A drone has no windscreen at
// all, so its deck is 1.0 and the nose runs continuously into the body — which
// is the whole visual difference between an aeroplane and an airframe.
//
// `crew` IS THE NUMBER OF SEATS, not the number of people in them — the
// loading is `cabin.pilots` plus `cabin.pax`, below. The name is older than
// the distinction and is left alone because four files read it.
const GEN_SEATING = {
  single:  { halfW: 0.32, h: 0.92, len: 0.62, crew: 1, deck: 0.70 },
  tandem2: { halfW: 0.36, h: 1.00, len: 0.78, crew: 2, deck: 0.70 },
  side2:   { halfW: 0.53, h: 1.05, len: 0.90, crew: 2, deck: 0.70 },
  // FOUR SEATS (2026-08-31, the user: "we need passenger seats and passengers,
  // impacting the mass and CG"). Two rows of two and a 2+2 — a wider, taller,
  // longer box, because four people need one. The numbers are the side-by-side
  // grown by what the second row costs: 0.86 m of pitch on `side4` (the spec's
  // own `cabin.seatPitch` default), and `tandem4`'s narrower pair-behind-pair.
  // NEITHER IS THE DEFAULT and neither changes an existing aeroplane: a spec
  // that does not name them resolves exactly as it did.
  side4:   { halfW: 0.56, h: 1.12, len: 1.76, crew: 4, deck: 0.70 },
  tandem4: { halfW: 0.42, h: 1.06, len: 1.94, crew: 4, deck: 0.70 },
  drone:   { halfW: 0.20, h: 0.30, len: 0.55, crew: 0, deck: 1.00 },
};

// Tip treatment. `e` multiplies the Oswald efficiency: a square-cut tip sheds a
// stronger vortex than a rounded one, and a winglet is worth a few per cent of
// span for its height. Everything else about it is shape.
// `round` is how far the last station shrinks about the tip chord's mid point.
// `arc` is how many extra stations walk that shrink round a QUARTER CIRCLE of
// radius (reach x tip chord) — one station gives the old blunt corner, four
// give the half-round Spitfire/DC-3 tip. `fin` lifts the last station into a
// winglet.
// `bow` is the rounding radius as a fraction of the chord where the rounding
// STARTS, and the bow lives INSIDE the semispan: the planform runs straight to
// (semi - bow), then the chord closes to nothing on a half-ellipse whose tip is
// at exactly `semi`. So the wing you see is the wing you set — bow 0.5 is a
// true half-round of the tip chord. `arc` is how many skin rows draw it.
//
// This lives in the PLANFORM, not in the skin: chordAt() carries it, so the rib
// masses, the covered area, the strip areas and the outline are all one shape.
// A tip that only existed in the mesh would be a wing that lifts where there is
// no wing.
const GEN_TIPS = {
  square:  { name: 'Square cut', e: 0.97, bow: 0,    arc: 0, fin: 0 },
  clipped: { name: 'Clipped',    e: 0.99, bow: 0.15, arc: 2, fin: 0 },
  rounded: { name: 'Rounded',    e: 1.00, bow: 0.50, arc: 7, fin: 0 },
  elliptic:{ name: 'Elliptical', e: 1.03, bow: 0.80, arc: 9, fin: 0 },
  hoerner: { name: 'Hoerner',    e: 1.02, bow: 0.30, arc: 5, fin: 0 },
  winglet: { name: 'Winglet',    e: 1.07, bow: 0.20, arc: 4, fin: 0.42 },
};

// Design constants that are rules rather than choices. Each one reproduces a
// measured value on the Cub (noted), which is why they are constants and not
// parameters — see the derivations in resolveSpec.
const GEN_RULES = {
  tailArmC:    2.60,   // wing c/4 -> stab c/4, in root chords (Cub 4.14/1.6)
  hAR:         3.70,   // stab aspect ratio
  vAR:         1.90,   // fin aspect ratio
  Vh:          0.370,  // horizontal tail volume (Cub effective strip areas)
  Vv:          0.0267, // vertical tail volume
  // The carry-through spar sits ON the top longerons, not inside them. Without
  // this the wing root node lands exactly on a frame node, the tie between
  // them is a zero-length beam, and strain reads Infinity. Special-casing
  // degenerate beams would hide that; giving the spar the depth it physically
  // has removes the coincidence altogether.
  wingStandoff: 0.10,
  sparFront:   0.15,   // front spar, fraction of chord
  // Rule 1 again, as a NUMBER. "The Cub survives only because its strut root is
  // a full metre below the wing" — the anchor offset IS the barrier against
  // snap-through and against the wing twisting under aileron load. A MID wing
  // cannot give a strut more than about half a cabin height, and measured, that
  // is not enough: the mid-wing strut aeroplane saturated its ailerons and
  // spiralled into the ground while standing, settling and straining perfectly
  // (0.7%). The identical wing with a cantilever box flew and landed. So below
  // this offset the generator builds the box instead of a strut that cannot
  // work, and says so in the shakedown.
  strutMinOffset: 0.60,
  sparBoxDepth: 0.13,  // cantilever box depth, fraction of chord (Jodel's)
  // WING STIFFNESS CORRECTION (2026-08-11, GATE FLEX). The wing class is x19
  // softer than the structure the MASS MODEL already pays for: lin.wing
  // 0.62 kg/m over rho 7850 is 0.79 cm2 of cap, and E*A/L at a 1.7 m bay is
  // 9.5e6 N/m against the 5.0e5 in the material row. This takes 4 of those 19
  // back. It is a CORRECTION, not a buff — no extra mass, because the aeroplane
  // was already carrying a cap it was not getting the stiffness of.
  //
  // The strut fan hid this everywhere except on a cantilever, which has no
  // lever arm to hide behind: measured, the cantilever preset flew at 14.90 %/g
  // with its tip 12.64% of semispan up in LEVEL FLIGHT — twice a glass
  // sailplane, one click in the panel.
  //
  // WHY 4, and why not more. Measured (static bend % under 2 kN distributed,
  // and the substeps genSubsteps then demands, strut/cantilever):
  //     x1  1.00 / 6.48   24/28      x4  0.30 / 1.61   45/55
  //     x2  0.52 / 3.25   32/39      x8  0.19 / 0.76   63/78
  //   full E*A/L per member: 0.12 / 0.18 but 200/200 — AT THE CAP, dead.
  // Substeps are gate time (GATE GEN flies eleven circuits), so this is a
  // straight trade of realism against the battery, and x4 is where it lands:
  // the STRUT wing — the default, and what most builds are — comes out at
  // ~0.54 %/g, inside the real 0.3-1 band, for 1.9x the solver cost. The
  // cantilever lands ~2.9 %/g, still ~3x real but a 5x improvement on 14.90.
  // x8 would put the cantilever near-real at 2.7x the solver cost; take it if
  // the battery budget ever allows.
  // ALSO MEASURED AND REJECTED: stiffening only the spanwise cap chords, on the
  // theory that the short ribs were driving omega. They are not — chord-only x8
  // buys bend 1.50 for 56/69 substeps where uniform x4 buys 1.61 for 45/55, and
  // it leaves torsion untouched (2.21 vs 0.59). Uniform is strictly better.
  wingK: 4.0,
  sparRear:    0.65,   // rear spar. A two-spar wing is 15/65 because that is
                       // where the spars go — NOT, as it was, wherever the
                       // cabin frames happen to be. That coupling is exactly
                       // what made the wing unmovable.
  // PROP TIP TO GROUND, in the LEVEL attitude — which is the right attitude to
  // measure a taildragger in, because the critical moment is the take-off roll
  // with the tail already up, not the three-point stand where the nose is high
  // and the disc is well clear.
  //
  // It was 0.40 m, which is a Cub's actual 0.42 rounded down: what a real
  // aeroplane HAS, not what it is allowed. FAR 23.925 asks for nine inches on a
  // taildragger and seven on a nosewheel, with the tyres flat and the strut
  // deflated, and 0.40 is nearly double that — so it was buying a long leg
  // nobody asked for and standing the aeroplane on stilts. These are the
  // certificated minima instead, and the builder gets the rest of the range.
  //
  // The reason it errs high at all is still true and still worth reading: a leg
  // the player shortened into a prop strike is not a bad aeroplane, it is a
  // broken one on the first landing. So it is a MINIMUM, it still beats legDrop,
  // and gear.yBoundBy still says which bound applied.
  propClear:      0.229,  // taildragger, FAR 23.925 (nine inches)
  propClearNose:  0.178,  // nosewheel, FAR 23.925 (seven inches)
  // Zero-thrust speed as a multiple of power/static-thrust. CALIBRATED on the
  // A-65 + Sensenich 74CK registry entry, which it then reproduces to under 1%
  // in both Tstatic and kV2. See GEN_PROP_PITCH for why this is one constant and
  // not a table.
  propV0K:     1.10,
  // Minimum drop from the fuselage underside to the axle. This is rule 5, not
  // tidiness: a near-horizontal gear leg has almost no vertical stiffness no
  // matter what k it is given, so a short undercarriage squats onto its belly
  // and no amount of suspension tuning saves it. It also subsumes belly
  // clearance, being the stronger of the two constraints in every case.
  // DEFAULT only since G4.6 — spec.gear.legDrop overrides it, which is the
  // "mains" half of the split suspension height.
  // 0.35 UNTIL G8, AND IT HAD NEVER ONCE BOUND. propClear was 0.40 m and always
  // won, so this number — the one that is actually SUPPOSED to own leg length —
  // was never the constraint and was never validated. Dropping propClear to the
  // certificated minimum exposed it, and 0.35 turned out to be nowhere near
  // enough: GATE GEN failed on four undercarriage checks at once and GATE FLEX
  // called the gear a mechanism.
  //
  // MEASURED, sweeping legDrop with propClear at 0.229: the softest suspension
  // the panel offers stops standing below 0.64 m and rests on its tailwheel,
  // and some powerplants stop standing below 0.58. 0.66 is 0.64 with enough
  // headroom not to sit on the cliff. The aeroplane still ends up 0.12 m lower
  // than it was, because the leg now sets ride height and prop clearance is
  // only the floor beneath it — which is the right way round, and lets a
  // builder who WANTS the blades closer lower this and be allowed to, until
  // the prop stops them.
  legDrop:     0.66,
  // Tailwheel leg length below the tailpost foot. The three-point deck angle
  // is DERIVED from this, not the other way round: a real tailwheel spring has
  // a length, and the attitude is what falls out of it. (Fixing the deck angle
  // instead pushes the tailwheel up into the tailpost as the tail arm grows,
  // and the tailpost then drags — measured, parked clearance halved.)
  // Also a DEFAULT since G4.6: spec.gear.twLeg overrides it, and does the same
  // job for a nosewheel, where it replaces the trikeDeck derivation below.
  twLeg:       0.23,   // m (Cub: TPB 0.25, TW axle 0.02)
  // TRICYCLE: the fraction of the weight the nosewheel carries on the ground.
  // The textbook figure for a rigid aeroplane is 8-15%; this is 0.25, because
  // the fleet's only tricycle — the C172 fiche — sits at 26%, and because a
  // soft-body airframe on a long nose leg needs the margin. Measured: at 0.12
  // and 0.18 the aeroplane rocked back until the TAILPOST touched and sat there
  // on mains-plus-tail with the nosewheel in the air; from 0.24 it stands on
  // all three. The rest attitude is a touch nose-up — a trike that sits
  // nose-down wheelbarrows on the landing roll.
  noseLoad:    0.25,
  trikeDeck:   1.2,    // deg nose-up at rest
  deckMin:     8.0, deckMax: 15.0,   // deg, reported and gated
  gearRake:    16.0,   // deg, CG to main axle from vertical (nose-over guard)
  trackRatio:  1.23,   // main track / CG height above ground
  washSpread:  1.12,   // propwash effective radius / prop radius (Cub-fitted)
  stabWash:    0.60,   // fraction of propwash seen by the stab / fin
  finWash:     1.00,
};

// SECTIONS (G3). The spec is organised the way the aeroplane is, and the way
// the editor presents it: one block per component, each with its discrete
// options, its values, and its own `place` offsets. Multiplicity is an ARRAY
// only where it is real — `wings` (monoplane or biplane) and `engines` — so the
// rest stays a named block and the diff stays legible.
//
// `genNormaliseSpec` accepts the old flat shape as well, and `resolveSpec`
// republishes the flat aliases the generator reads, so 61-64 are untouched by
// the reshape. Those aliases retire as each consumer moves to sections.
// 4: the cabin gained its glazing surface — `cabin.glazing`, `cabin.canopy`,
// `cabin.panel`, `cabin.pilot`, the seat offsets — plus `fuselage.tailY`,
// `paint.regX` and `wings[].centre`.
// 5: `cage` — the template-cage fuselage design (see the field).
//
// ONE THING READS THIS NUMBER: `genMigrateSpec` below walks a spec from its
// own `v` to here through GEN_MIGRATORS, one step per version. Everything else
// still holds: `genNormaliseSpec` defaults every missing field from
// GEN_DEFAULT, a field left `null` stays null and keeps being derived, so an
// older spec loads correctly without being told what it is — which is why the
// migrator table is EMPTY today. Do not add a migration that only re-does what
// normalisation already does; a migrator earns its entry only when a field
// changes UNITS, SIGN, or HOME (`fuel.litres` becoming a vessel list is the
// reserved case — the 5 -> 6 bump belongs to the energy arc). The mechanism
// exists BEFORE its first real entry so that entry lands in an exercised,
// gated machine: GATE BUILD injects a throwaway migrator, runs the walk, and
// removes it (G106). Every real entry ships with a frozen save of the
// OUTGOING vintage in tools/fixtures/, which GATE BUILD loads forever.
// v6 (G140): the wing became three stations — wings[0] grew crankChord /
// crankX / tipX (null = derived from sweep/taper exactly as v5 did), the
// cage retired wgSweep, and GEN_MIGRATORS[5] lifts a save's stored angle
// into the offsets. The v5 fixture that proves it: build_v5_swept_*.json.
const GEN_SPEC_V = 6;

// { fromVersion: spec => spec } — each entry lifts a spec one version. May
// mutate and return its argument. Runs BEFORE normalisation, on the raw shape
// the old game actually saved.
const GEN_MIGRATORS = {};

function genMigrateSpec(r) {
  if (!r || typeof r !== 'object') return r;
  const v = r.v;
  // no `v` at all: the pre-versioned flat shape — genNormaliseSpec's flat
  // branch IS its migration, and stamps GEN_SPEC_V itself.
  if (typeof v !== 'number' || !isFinite(v)) return r;
  if (v >= GEN_SPEC_V) return r;            // current, or from the future
  for (let i = Math.floor(v); i < GEN_SPEC_V; i++)
    if (GEN_MIGRATORS[i]) r = GEN_MIGRATORS[i](r) || r;
  r.v = GEN_SPEC_V;
  return r;
}

// G140: v5 -> v6 — THE WING BECAME THREE STATIONS (root, crank, tip; the
// user's model: "specify the section at root, crank point and tip, and move
// them aft/forward"). The SPEC keeps `sweep` as a legal legacy input that
// derives the stations when they are null, so a hand-written spec means what
// it always meant — but a SAVE carries the cage's own keys, and the cage
// retired wgSweep for wgTipX/wgCrankX. This lift converts the stored angle
// into the offsets it always denoted, at the save's own geometry, and drops
// the retired key so it cannot become a second home again. The spec-level
// sweep of a lifted SAVE is zeroed in the same motion (the offsets are its
// value now); a spec WITHOUT a cage never lifts — its sweep stays the input.
GEN_MIGRATORS[5] = r => {
  const c = r && r.cage;
  if (!c || typeof c !== 'object') return r;
  const sw = +c.wgSweep;
  if (isFinite(sw) && c.wgTipX == null) {
    const semi = 0.5 * (+c.wgSpan > 0 ? +c.wgSpan : 10);
    const zR = (r.cabin && +r.cabin.halfW > 0) ? +r.cabin.halfW
             : (+c.halfW > 0 ? +c.halfW : 0.5);
    const span = Math.max(1e-6, semi - zR);
    if (Math.abs(sw) > 1e-9) {
      const t = Math.tan(sw * Math.PI / 180);
      c.wgTipX = +(t * span).toFixed(4);
      if (+c.wgCrankAt > 0)
        c.wgCrankX = +(t * span * +c.wgCrankAt).toFixed(4);
      if (r.wings && r.wings[0]) {
        if (r.wings[0].tipX == null) r.wings[0].tipX = c.wgTipX;
        if (+c.wgCrankAt > 0 && r.wings[0].crankX == null)
          r.wings[0].crankX = c.wgCrankX;
        r.wings[0].sweep = 0;
      }
    }
  }
  delete c.wgSweep;
  return r;
};

// ---------------------------------------------------------------------------
// G140: THE PLANFORM LAW — one builder, so the area/MAC/xAC derivation, the
// tip bow, the frame's spars and covering, and the skin's sections cannot
// disagree about where the wing is (the same contract 61's own comment
// declared for chordAt, now honoured across files).
//
//   legacy    tipX/crankX/crankChord all null: the chord is ONE line from
//             root to tip and the offsets are the tan(sweep) walk — the
//             EXPRESSIONS ARE THE PRE-G140 ONES VERBATIM, so every existing
//             spec resolves to the identical wing.
//   explicit  any station field set: chord runs root->crank->tip piecewise,
//             the section offsets run 0 -> crankX -> tipX piecewise, and
//             per-panel sweep is whatever falls out. `explicit` is the flag
//             the derived block branches on.
//
// The crank still means what G61-era code said: ONE break, two sections.
// ---------------------------------------------------------------------------
function genPlanLaw(w, zR, semi) {
  const span = Math.max(1e-6, semi - zR);
  const zC = w.crankAt > 0 ? zR + span * w.crankAt : 0;
  const swT = Math.tan((w.sweep || 0) * Math.PI / 180);
  const explicit = w.tipX != null || w.crankX != null ||
                   (zC > 0 && w.crankChord != null);
  const xTip = w.tipX == null ? swT * span : +w.tipX;
  const xCrk = zC > 0
    ? (w.crankX == null ? xTip * (zC - zR) / span : +w.crankX) : 0;
  const cCrk = zC > 0 && w.crankChord != null ? +w.crankChord : null;
  const tipC = w.chord * w.taper;
  const cAt = z => {
    z = Math.min(z, semi);
    if (cCrk == null)                    // the pre-G140 line, verbatim
      return w.chord * (1 - (1 - w.taper) *
        (Math.max(z, zR) - zR) / Math.max(1e-6, semi - zR));
    if (z <= zC)
      return w.chord + (cCrk - w.chord) *
        (Math.max(z, zR) - zR) / Math.max(1e-6, zC - zR);
    return cCrk + (tipC - cCrk) * (z - zC) / Math.max(1e-6, semi - zC);
  };
  const xoff = z => {
    z = Math.max(zR, Math.min(z, semi));
    if (!explicit) return (z - zR) * swT;   // the pre-G140 walk, verbatim
    if (!(zC > 0)) return xTip * (z - zR) / span;
    if (z <= zC) return xCrk * (z - zR) / Math.max(1e-6, zC - zR);
    return xCrk + (xTip - xCrk) * (z - zC) / Math.max(1e-6, semi - zC);
  };
  return { zC, xTip, xCrk, cCrk, tipC, cAt, xoff, explicit };
}

// The one preset this chantier ships: a strut-braced high-wing taildragger in
// the Cub envelope. Nulls are the derived fields — that is most of the
// aeroplane, which is the point.
const GEN_DEFAULT = {
  v: GEN_SPEC_V,
  // `role` and `class` are the birth flow's LABELS (NEW-AIRCRAFT §5.1/§5.2):
  // an intention and a size class, stored because missions, the fleet and
  // the plaque will read them — and NEVER constraints. Null = unstated, and
  // null is why GEN_SPEC_V does not move for them: genDefaults fills the
  // missing field and an older spec means exactly what it meant. The legal
  // values live with the declaration (tools/_cage_design.js), not here —
  // clampSpec type-guards only, the `finish` argument.
  meta: { name: 'Garage Special', reg: 'F-PGAR', role: null, class: null },
  cabin: {
    seating: 'tandem2',
    // LOADING, not capacity: `seating` sizes the cabin, `pilots` says how many
    // seats are filled for the flight the shakedown and the gates measure. A
    // J-3-class aeroplane is flown solo; loading both seats is a different
    // aeroplane and should read as one.
    pilots: 1,
    // AND THE PASSENGERS. Same idea as `pilots` and the same units: how many
    // of the remaining seats are FILLED for the flight the gates measure.
    // 0 by default — a two-seat aeroplane flown solo is the aeroplane this
    // battery has always measured, and it stays that.
    pax: 0,
    baggage: 10,             // kg
    halfW: null, h: null, len: null, noseGap: 0.62,
    // WHERE THE SEATS SIT, as an OFFSET from what the cabin derives. The base is
    // per-layout (SEAT_BASE in 63_gen_skin.js) because a side-by-side and a
    // tandem measure their "right" seat station from different places; a single
    // common base means one layout always carries a constant the other undoes.
    seatX: 0, seatY: 0.10, seatPitch: 0.86,
    // GLAZING. `glazing` is the ROUTE the cabin transparency is built by, and it
    // is a route rather than a style because each has different failure modes
    // (topology, sorting, distortion):
    //   none        no cabin transparency at all (drones)
    //   windshield  the fuselage's OWN windscreen step, in glass: zero stand-off,
    //               so the covered surface is reproduced exactly and the seam is
    //               invisible. The control case for the edge-loop machinery.
    //   bubble      a rounded shell standing off that same cut
    //   greenhouse  kept only so old specs still load — it is now `facet: true`
    //               on a `bubble`, and clampSpec rewrites it as one.
    glazing: 'bubble',
    // THE COAMING + INSTRUMENT PANEL, off the windscreen fit line (which never
    // moves — see 63_gen_skin.js). `depth` is how far aft the coaming shelf runs;
    // `wrap` is how far down the sill arc it wraps, and 0.5 is exactly the sill.
    panel: { on: true, depth: 0.27, inset: 0.06, wrap: 0.50 },
    // THE OCCUPANT. A crash-test dummy on the first `pilots` seats. `stature` is
    // standing height in metres and everything else is a pose angle in degrees.
    // The rig is anthropometric (Drillis & Contini fractions), so the one length
    // scales the figure and every chain hangs off the one before it.
    pilot: { show: true, stature: 1.75, lean: 17, thigh: -9, shank: 10,
             armDown: 40, fore: 6, head: -11, armIn: 26,
             ankle: 40, toeOut: 7, hipOut: 0, kneeOut: 3 },
    // THE CANOPY'S OWN CONTROLS. `sill` and the window are what the CUT is made
    // from, so they move the fixed edge loop; `height` and `skew` move only the
    // middle of the shell.
    canopy: {
      // `height` is the rise above the body's own deck line: 0 means the
      // fuselage face turns to glass and nothing protrudes.
      height: 0, sill: 0.30, skew: 0.42,
      // `bubble` is the SECTION's fullness (1 = half-round blown canopy, 0 =
      // flat-sided with a crown). `lid` is a virtual clipping plane as a
      // fraction of the rise — 1 leaves the dome whole, lower slices the top off
      // flat. A wing inside the envelope lowers it further, which is the only
      // thing a high wing does differently.
      bubble: 0.70, lid: 1.0,
      // MAX WIDTH: how far the section swells sideways past the sill line. 1 is
      // flush with the body, 1.4 is a blown bubble standing proud of it.
      // Independent of height on purpose — the rise used to be capped at the
      // half-width, which silently tied the two knobs together.
      width: 1.0,
      // WHERE THE WINDOW BEGINS AND ENDS. `reach` is a FRACTION of the cabin and
      // is what the panel drives; `x1` is the absolute station it resolves to.
      // An absolute station cannot survive a cabin-length change — the window
      // stays put while the cabin moves out from under it — so the knob is the
      // fraction and the station is derived. x1 remains settable for a build
      // that wants the window pinned whatever the cabin does; setting it wins.
      x0: null, x1: null, reach: null,
      // THE JOINT. Chamfers the corner where the front bow meets the sill rail,
      // instead of letting it come to a downward point. `jointRun` is its length
      // in ring indices. Frame detail only — the glass and its seam are untouched.
      joint: 'square', jointRun: 3,
      // FACETED STRUCTURE (the old 'greenhouse' style, now a flag on any
      // canopy): frame bars down every section edge instead of two rails.
      facet: false,
      // SUNSCREEN: the fraction of the arc, from the crown down, that goes
      // opaque and is painted with the fuselage. `sunStart` is where along the
      // window the roof begins, so that it stops short of the screen.
      sun: 0, sunStart: 0.38,
      // SIDE LIGHTS: a band of the same cut at the waistline. Meant for a
      // WINDSCREEN build — with a full canopy the two openings meet, which is a
      // mistake the player is allowed to make. `sideGap` is the door post
      // between screen and light.
      sides: false, sideTop: 0.34, sideDepth: 0.5, sideReach: 1.0, sideGap: 0.10,
      // the windscreen's RAKE in degrees; null keeps the fuselage's own windRun
      // angle. The body's step and the canopy's front bow use it alike, so they
      // move together by construction rather than by agreement.
      wsAngle: null,
      // how much the screen bows in plan
      wsCurve: 1,
    },
  },
  // CARGO BAY: metres of full-section fuselage aft of the cabin, and what is in
  // it. It is the fuselage that grows, so the tail arm and the frames the wing
  // and gear attach to all move with it.
  cargo: { len: 0, kg: 0 },
  fuel: { litres: 50, tank: 'nose' },
  systems: { fit: 'basic' },
  // Control surfaces. Span fractions are of the SEMISPAN — the aileron measured
  // inboard from the tip, the flap outboard from the centreline — and clampSpec
  // keeps a gap between them. Chord fractions are of the local chord and are
  // what set each surface's effectiveness (genTauAt).
  controls: {
    flap:     { type: 'none', span: 0.50, chord: 0.20 },
    aileron:  { span: 0.38, chord: 0.22 },
    elevator: { chord: 0.40 },
    rudder:   { chord: 0.42 },
  },      // usable litres (avgas 0.72 kg/l)
  fuselage: {
          material: 'tubeFabric', shape: 'straight',
          tailArm: null, postGap: 0.67, tailBays: 4,
          tailW: 0.10, tailBot: 0.20, tailTop: 0.38,
          // THE MEASURED BOOM PROFILE (G54.1): rows of {t, w, yb, yt} with t
          // normalised over boxRear..tailArm. When present, the aft stations
          // take their section from HERE (interpolated by t) instead of the
          // shape family's exponent — the built boom's own heights, section by
          // section. null = derive from `shape` exactly as before. The join
          // writes it; clampSpec bounds every row and drops a degenerate list.
          profile: null,
          // TAIL-END SECTION HEIGHT. Not a new dimension: clampSpec moves
          // tailBot and tailTop together by it, on the clone, so 61_gen_frame.js
          // still reads only those two and the offset cannot accumulate across
          // repeated clamps the way gear.track once did.
          tailY: 0,
          // The top line ahead of the cabin is the COWL DECK, and the windscreen
          // is the step up from it — a fuselage whose top runs smoothly from
          // spinner to tail is a carrot, not an aeroplane. cowlDeck is a
          // fraction of cabin height; windRun is the fore-aft run of the
          // windscreen (0.30 m rise over 0.26 m run ~ 49 deg).
          cowlDeck: null, windRun: 0.26,
          // skin-only former bulge, 0 = bare truss. A tube-and-fabric fuselage
          // has FLAT sides and belly and a rounded turtledeck, so these are
          // very different numbers on purpose.
          crownTop: 0.72, crownSide: 0.07 },
  // THE TEMPLATE CAGE — the fuselage as a Catmull-Clark control cage (G12), and
  // the slot a bench-built body arrives in. The block above describes a fuselage
  // as a LOFT (a taper family plus crown knobs); this one describes it as the
  // user's Blender cage — stations, levels, rails — which is what can carry
  // doors, windows, a canopy and an interior. They are two descriptions of one
  // part and only one of them can be in force, so this field is the switch:
  //
  //   null   the loft above builds the body, exactly as it always has
  //   object the cage builds it, and the loft's shape knobs are inert
  //
  // NULL IS NOT "no cage", IT IS "THE TEMPLATE". The parameter set and its
  // defaults live with the generator that reads them (tools/_cage_gen.js,
  // CAGE_PARAMS — measured off templatePlaneProcedural_2 and fit-locked by
  // _cage_fit.js), and they are NOT copied here: a number about the cage has one
  // home, and a second copy under a different name is the ambiguity the units
  // ruling (G19d) already outlawed. So this carries a BUILD's cage, never the
  // template's — which is also why normalisation must leave an object here
  // verbatim instead of filling it field by field from a default that is null.
  //
  // Units are metres (G19d: 1 cage unit = 1 metre; `planeScale` is a design
  // scale on top, not a unit conversion).
  cage: null,
  // The engine bay is its own component with its own cover, not the front of
  // the fuselage. It is a loft from the firewall section to a NOSE SECTION OF
  // ITS OWN, finished flat with a rounded-over front edge, and the propeller
  // mounts on that flat face. `fillet` is the radius of the rounded edge;
  // `taper` scales the derived nose section.
  //
  // `halfW`, `top` and `bot` are the nose section, and they are measured ABOUT
  // THE THRUSTLINE, which is the datum a cowl actually has — it is a cover over
  // an engine, and the engine sits on the thrustline. Referencing the firewall's
  // centre instead is what made the cowl "collapse below its engine": on a body
  // whose deck line is not near its mid-height (a drone, cowlDeck 1.0) the two
  // datums are 4 cm apart on a 30 cm cowl and the engine hangs out of the
  // bottom. `top` and `bot` are separate so the top line and the bottom line can
  // be set independently — a flat-top/bulged-chin Cub cowl and a round-top
  // Cessna cowl with a chin scoop are the same three numbers.
  // Left null they are derived from the firewall section (tapered, about the
  // thrustline), which is the shape that was there before.
  // `intake` is texture only, for now — see genCowlDataURI in garage.js.
  cowl: { fillet: 0.10, taper: 0.94,
          halfW: null, top: null, bot: null, intake: 'chin' },
  // An ARRAY because a twin is a real aeroplane, not a variant. Its LENGTH is
  // what the solver multiplies thrust by (via `params.nEngines`); `refs.engine`
  // is a separate thing entirely — the mount NODES the force is spread over.
  engines: [{ type: 'a65_sensenich74', mount: 'nose', place: { dx: 0, dy: 0 } }],
  // THE PROPELLER IS ITS OWN COMPONENT. `D` null keeps the one the chosen
  // powerplant shipped with, so a build nobody has touched flies exactly as it
  // did. Everything about it is honest physics rather than decoration: the disc
  // area sets static thrust AND the propwash the tail flies in, the pitch trades
  // static thrust against high-speed thrust, and the blades weigh something at
  // the very front of the aeroplane, where mass costs the most CG.
  // pitch 'cruise' is not a neutral default, it is the TRUTH about this preset:
  // the A-65 it ships with swings a Sensenich 74CK, which is a cruise prop. That
  // is also why the default build's thrust is unchanged by all of this.
  // The four fields above the line are the PROPELLER AS PHYSICS — disc area,
  // blade count, the mass of the material at the very front, and the pitch
  // trade. The three below it are the propeller as a SHAPE, and they buy
  // nothing but the look: blade planform, where the blade leaves the spinner,
  // and the spinner itself. Kept in the same block because a builder does not
  // think of them as two things, and marked here because a change to the top
  // four moves the aeroplane and a change to the bottom three does not.
  prop: { D: null, blades: 2, material: 'wood', pitch: 'cruise',
          // chord and root as fractions of the RADIUS, so they survive a
          // diameter change instead of being metres that no longer fit
          chord: 0.10, root: 0.16,
          spinner: { shape: 'ogive', len: 2.2, dia: 0.17 } },
  // An ARRAY because a biplane is a real aeroplane. `position` is where the
  // spar meets the fuselage.
  wings: [{ span: 10.0, chord: 1.60, taper: 1.0, dihedral: 3.0,
            incidence: 1.5, washout: 1.5, naca: 2412, panels: 3,
            position: 'high', sweep: 0, tip: 'rounded',
            crankAt: 0, dihedralOut: null,
            // G140: the three-station planform. Chord at the crank, and the
            // fore/aft offsets of the crank and tip SECTIONS (metres, + aft).
            // Null = derived from sweep/taper exactly as v5 did — `sweep`
            // stays the legacy input; these are the honest model.
            crankChord: null, crankX: null, tipX: null,
            // THE CENTRE SECTION: what happens where a high wing's carry-through
            // crosses the cabin roof. 'solid' covers it, 'glass' makes the wing
            // itself the roof and you look up into it (a Cub's centre section),
            // 'open' leaves the bay out altogether. Ignored on a low wing, which
            // has no bay over the cabin to treat.
            centre: 'solid',
            xLE: null, place: { dx: 0, dy: 0 } }],
  // Wing fixation, its own section because it is its own structure. Cantilever
  // gets a real four-chord spar box — rule 1 says a planar two-spar wing only
  // survives because the strut anchor is a long way below it, so taking the
  // strut away without adding the box builds an aeroplane that folds.
  bracing: { type: 'strut' },
  tail: { type: 'conventional', vAngle: 33,
          hSpan: null, hChord: null, hX: null, hTaper: 1.0,
          // `tip` is the tail's shared tip shape and stays the one the V-tail
          // uses, since a V-tail is ONE surface. `tipV` and `tipH` override it
          // per surface on a conventional tail — a Cub has a big round fin and a
          // near-elliptical tailplane, and they are not obliged to match. Null
          // means "whatever `tip` says", so an older save keeps its shape.
          tip: 'rounded', tipV: null, tipH: null,
          // FIN RAKE, degrees of leading-edge sweep. Null derives the angle the
          // fin already had (its LE carried a hardcoded 0.30 chord of sweep over
          // its height), so an untouched build is unchanged and the control
          // starts where the aeroplane already was.
          vSweep: null,
          // WHERE THE TAILPLANE SITS UP THE FIN. 0 is on the tail cone, as it
          // has always been; 1 puts it at the fin tip, which IS a T-tail — so
          // the old backlog's "T-tail" is this control at its limit rather than
          // a separate kind of aeroplane. It moves the stab in Y only: `hX` is
          // the tail ARM and stays the builder's to set, because moving it here
          // would re-tune the pitch authority behind their back.
          stabH: 0,
          // THE DORSAL FIN, ahead of the fin's leading edge. `angle` is the
          // slope of its own leading edge and is nullable: set it and `len` is
          // driven from `height`, leave it and it is derived from the two
          // lengths and reads AUTO. Four controls for a three-cornered shape is
          // one too many, and this is which one gives way.
          dorsal: { len: 0.34, height: 0.16, width: 0.55, angle: null },
          vHeight: null, vChord: null, vX: null,
          place: { dx: 0 } },
  // `stiffness` is the suspension: 1.0 is the mass-scaled default, below that
  // is soft (long travel, bottoms out), above is hard (jars, but holds).
  // type 'taildragger' puts the third wheel at the tail and the mains AHEAD of
  // the CG; 'tricycle' puts a steerable nosewheel forward and the mains BEHIND
  // it. They are different aeroplanes on the ground, not a cosmetic swap: the
  // placement rule inverts, the rest attitude goes from nose-high to level, the
  // steering sign flips, and the autopilot needs its trike rollout.
  // Every section carries its own `place` OFFSETS — from whatever the rules
  // derived, never absolute positions — so a nudge rides along when something
  // upstream moves instead of pinning the component and quietly breaking the
  // aeroplane around it. Move the cabin and a wing you pulled back 0.2 m is
  // still 0.2 m back.
  //
  // They are deliberately NOT constrained to sensible values. Building a
  // machine that will not fly is a mistake the player is allowed to make; the
  // shakedown says so (static margin, nose-over, stands-on) rather than the
  // generator refusing. The clamps below only keep the geometry from becoming
  // degenerate enough to break generation itself.
  // `legDrop` and `twLeg` are the SPLIT SUSPENSION HEIGHT: how far the main
  // axle hangs below the fuselage underside, and how long the third wheel's leg
  // is, set independently. The rest attitude is then whatever those two
  // produce — the same doctrine the tailwheel has always followed (a real
  // spring has a length; the deck angle falls out of it), now applied to the
  // nosewheel as well, which used to work backwards from a fixed 1.2 deg.
  // `camber` leans the MAIN wheels: positive tips their tops outboard. It is
  // not cosmetic — a leaning wheel touches down R*cos(camber) below its axle,
  // so it is one of the two things that set prop clearance, the other being
  // legDrop. See GEN_RULES.legDrop / twLeg for the defaults these override.
  // G133 fairing fields: `legFair`/`twLegFair` are the LEG's own streamline
  // shroud (independent of the wheel's spat at last), `fairTail`/`twFairTail`
  // the tail-droplet length the shell is drawn AND priced with (1 = the
  // G20-era proportions), `fairMat` the layup for the whole set (mass and
  // price; GEN_FAIR_MATS). All defaults reproduce a pre-G133 build exactly —
  // genNormaliseSpec is the migration path, no version bump (the G85 rule).
  gear: { type: 'taildragger', fairing: 'none', twFairing: 'none',
          legFair: 'none', twLegFair: 'none',
          fairTail: 1.0, twFairTail: 1.0, fairMat: 'glass',
          suspension: 'bungee',
          track: null, x: null, y: null, wheelR: 0.20,
          twX: null, twY: null, twR: 0.10, stiffness: 1.0,
          legDrop: null, twLeg: null, camber: 0,
          place: { dx: 0, dtrack: 0 } },
  // `regX` places the registration along the body: 0 just aft of the cabin, 1 at
  // the fin. It was pinned at 45-78% of the run, which on a long fuselage put it
  // in the taper where the section halves in width.
  paint: { job: 'full', base: 0xf2c437, trim: 0x1b3a5c, sweep: 0.55, gloss: 0.42, regX: 0.30 },
  // THE AEROPLANE'S FINISH (G105). `paint` above is the GENERATED skin's
  // three-colour scheme, which every aeroplane in the fleet has had since G4.
  // This is the AEROSKIN one: what each section of the cage is made of and
  // what it looks like — the finish, the tint, the tile / roughness / normal
  // multipliers, how flown it looks, and where the markings sit.
  //
  //   finish: { sections: { <sec>: {fin, tint, tile, rough, nrm} },
  //             wear: 0..1,
  //             decals: { regH, regL, regC, regTarget, img* } }
  //
  // NULL IS THE FACTORY FINISH, and it is the default for the same reason
  // `cage` is null by default: every field of it is derivable, so a spec that
  // says nothing gets the aeroplane its construction implies. That is also the
  // whole of the migration — a spec written before this field existed is a
  // spec with no overrides, which is exactly what it meant.
  //
  // AND THAT IS WHY GEN_SPEC_V DOES NOT MOVE FOR THIS. The version exists to
  // give a MIGRATION something to branch on, and there is nothing to branch:
  // genDefaults fills the null and the aeroplane is unchanged. The 5 -> 6 bump
  // is reserved by the ENERGY MODULE arc (see tools/_energy_base.js), whose
  // change to `spec.fuel` really does need one — taking it here for a field
  // that needs no migrator would spend their number on bookkeeping.
  //
  // DELIBERATE GAP: a loaded livery IMAGE is not carried. `decals` holds where
  // the image sits and how big it is, never the pixels — a base64 texture in a
  // build file is a different decision, and one nobody has asked for.
  // Sections are a MAP and not an array on purpose: a section that a build
  // does not have is one this file simply does not mention.
  finish: null,
};

const GEN_PRESETS = { garage: GEN_DEFAULT };

// ---------------------------------------------------------------------------
// NORMALISE. Accepts the old flat shape or the sectioned one and returns the
// sectioned one, with every missing field defaulted from GEN_DEFAULT. This is
// also the migration path: a spec written before a field existed simply gets
// the default, and a field that is `null` stays null so it keeps being derived.
// ---------------------------------------------------------------------------
function genDefaults(target, defaults) {
  for (const k in defaults) {
    const d = defaults[k];
    if (Array.isArray(d)) {
      if (!Array.isArray(target[k]) || !target[k].length) target[k] = genClone(d);
      else target[k] = target[k].map(e =>
        genDefaults(e && typeof e === 'object' ? e : {}, d[0]));
    } else if (d && typeof d === 'object') {
      target[k] = genDefaults(target[k] && typeof target[k] === 'object' ? target[k] : {}, d);
    } else if (target[k] === undefined) {
      target[k] = d;                        // note: an explicit null is KEPT
    }
  }
  return target;
}

// THE SECTIONED KEYS. The sniff below used to be `Array.isArray(r.wings)`
// alone, which is true of every spec the game itself writes and false of every
// PARTIAL one — a file carrying only a cage, or only a paint, took the pre-G3
// flat branch and came out the other side with `controls`, `prop`, `systems`,
// `bracing` and a sectioned `meta` quietly missing, because that branch
// rebuilds `out` field by field from the FLAT names. A spec that names any
// section is a sectioned spec: normalising it is genDefaults' job and nothing
// else's. (G63; the `cage` line below was the one-field patch this replaces.)
// ONLY keys the flat shape CANNOT have. `tail`, `gear`, `cowl` and `paint` are
// deliberately absent from this list: the flat shape carries all four under
// those very names, so sniffing on them would route a genuine old file into
// the sectioned branch and lose it. `wings` keeps its array test because the
// flat name is `wing`, singular.
const GEN_SECTIONED = ['cabin', 'fuselage', 'cage', 'engines', 'controls',
                       'bracing', 'prop', 'systems', 'fuel', 'cargo', 'meta'];
const genIsSectioned = r => Array.isArray(r.wings) ||
  GEN_SECTIONED.some(k => r[k] !== undefined && r[k] !== null);

function genNormaliseSpec(raw) {
  // migrate FIRST, on the clone: a migrator sees the raw shape its vintage
  // actually wrote, before defaulting fills the modern fields in around it.
  const r = genMigrateSpec(genClone(raw && typeof raw === 'object' ? raw : {}));
  if (genIsSectioned(r)) return genDefaults(r, GEN_DEFAULT);
  // --- pre-G3 flat shape ---
  const p = r.place || {}, w = r.wing || {}, f = r.fuse || {};
  const out = {
    v: GEN_SPEC_V,
    meta: { name: r.name, reg: r.reg },
    cabin: Object.assign({}, r.cab, { seating: r.seating, pilots: r.pilots,
                                      baggage: r.baggage }),
    cargo: { len: f.cargoLen, kg: r.cargoKg },
    fuel: { litres: r.fuelL },
    fuselage: Object.assign({}, f, { material: r.material }),
    // The cage post-dates the flat shape entirely, so a genuinely old spec
    // never has one, and since G63 a spec that carries one is sniffed as
    // SECTIONED and never reaches here. Kept because a hand-written hybrid
    // costs one field to honour and nothing to leave out.
    cage: r.cage,
    cowl: r.cowl,
    engines: [{ type: r.engine, mount: 'nose',
                place: { dx: p.engineDx, dy: p.engineDy } }],
    wings: [Object.assign({}, w, { place: { dx: p.wingDx, dy: p.wingDy } })],
    bracing: { type: w.strut === false ? 'cantilever' : 'strut' },
    tail: Object.assign({}, r.tail, { place: { dx: p.tailDx } }),
    gear: Object.assign({}, r.gear, { place: { dx: p.gearDx, dtrack: p.gearDtrack } }),
    paint: r.paint,
  };
  delete out.fuselage.cargoLen; delete out.wings[0].strut;
  return genDefaults(out, GEN_DEFAULT);
}

// The flat aliases the generator (61-64) still reads. They are REFERENCES to
// the section objects wherever the value is an object, so a derivation that
// writes through an alias updates the section too.
function genAlias(S) {
  S.wing = S.wings[0];
  S.cab = S.cabin;
  S.fuse = S.fuselage;
  S.name = S.meta.name; S.reg = S.meta.reg;
  S.material = S.fuselage.material;
  S.engine = S.engines[0].type;
  S.seating = S.cabin.seating; S.pilots = S.cabin.pilots;
  S.baggage = S.cabin.baggage;
  S.fuelL = S.fuel.litres;
  S.cargoKg = S.cargo.kg;
  S.fuse.cargoLen = S.cargo.len;
  S.wing.strut = S.bracing.type === 'strut';
  S.place = {
    wingDx: S.wings[0].place.dx, wingDy: S.wings[0].place.dy,
    engineDx: S.engines[0].place.dx, engineDy: S.engines[0].place.dy,
    tailDx: S.tail.place.dx,
    gearDx: S.gear.place.dx, gearDtrack: S.gear.place.dtrack,
  };
  return S;
}

// ---- helpers ------------------------------------------------------------
function genClone(o) {
  if (Array.isArray(o)) return o.map(genClone);
  if (o && typeof o === 'object') {
    const r = {};
    for (const k in o) r[k] = genClone(o[k]);
    return r;
  }
  return o;
}
const genClamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// null means "derive it" and must survive clamping — genClamp would coerce it
// to 0 and hand back the lower bound, silently turning every AUTO field into a
// pinned one. Nullable fields go through this.
const genClampN = (v, lo, hi) => (v == null ? null : genClamp(v, lo, hi));

// Thin-airfoil flap effectiveness: the fraction of a full-chord alpha change
// that a hinged rear portion of chord fraction `c` actually delivers.
//   tau = 1 - (theta - sin theta) / pi,   cos theta = 2c - 1
// Raw theory OVERSTATES what a real surface does — gaps, limited throw, adverse
// yaw, a fuselage in the way — so it is never used bare. genTauAt scales it so
// the fleet's own calibrated value is reproduced at that surface's reference
// chord, and theory only supplies the TREND away from it.
const genFlapTau = c => {
  const th = Math.acos(2 * genClamp(c, 0.05, 0.60) - 1);
  return 1 - (th - Math.sin(th)) / Math.PI;
};
const genTauAt = (c, refC, refTau) => refTau * genFlapTau(c) / genFlapTau(refC);

// NACA 4-digit digits -> {m, p, t} as fractions of chord.
function nacaParts(code) {
  const d = String(code | 0).padStart(4, '0');
  return { m: +d[0] / 100, p: Math.max(0.05, +d[1] / 10), t: +d.slice(2) / 100 };
}

// Keep the parameter space inside an envelope this chantier has flown. The
// editor calls this on every change, so a slider can never build something the
// structure rules were not written for.
function clampSpec(spec) {
  const S = genNormaliseSpec(spec);
  const fu = S.fuselage, cb = S.cabin;
  if (!GEN_MATERIALS[fu.material]) fu.material = 'tubeFabric';
  if (!GEN_SHAPES[fu.shape]) fu.shape = 'straight';
  // THE PART'S OWN CONSTRUCTION (G116) — additive, no default written: absent
  // means the aeroplane's own material, which is what every spec written
  // before these fields existed already meant, and why GEN_SPEC_V does not
  // move (nothing to branch on; genDefaults fills nothing). The one thing to
  // clamp is that a value names a real material — an unknown falls back to
  // absent rather than reaching GEN_MATERIALS as undefined.
  if (S.wings && S.wings[0] && S.wings[0].material != null &&
      !GEN_MATERIALS[S.wings[0].material]) delete S.wings[0].material;
  if (S.tail && S.tail.finMaterial != null &&
      !GEN_MATERIALS[S.tail.finMaterial]) delete S.tail.finMaterial;
  if (S.tail && S.tail.stabMaterial != null &&
      !GEN_MATERIALS[S.tail.stabMaterial]) delete S.tail.stabMaterial;
  // The cage rides through verbatim — its generator owns its own ranges, and
  // clamping a copy of them here would be the second home the field's own note
  // forbids. The one thing this level can enforce is the SWITCH'S TYPE, so a
  // truthy non-object can never reach a consumer that reads fields off it.
  if (S.cage !== null && (typeof S.cage !== 'object' || Array.isArray(S.cage)))
    S.cage = null;
  // ...and the finish rides through for the same reason and takes the same one
  // guard: aeroskin.js owns which finish names and which multiplier ranges are
  // real, and a second copy of those tables here is the second home that note
  // forbids. The type is this level's business, because a truthy non-object
  // would reach a consumer that reads `.sections` off it.
  if (S.finish !== null && (typeof S.finish !== 'object' || Array.isArray(S.finish)))
    S.finish = null;
  if (!GEN_TANKS[S.fuel.tank]) S.fuel.tank = 'nose';
  if (!GEN_SYSTEMS[S.systems.fit]) S.systems.fit = 'basic';
  const ct = S.controls;
  if (!GEN_FLAPS[ct.flap.type]) ct.flap.type = 'none';
  ct.aileron.span = genClamp(ct.aileron.span, 0.15, 0.55);
  ct.aileron.chord = genClamp(ct.aileron.chord, 0.10, 0.35);
  // the flap gets whatever semispan the aileron leaves, less a 4% gap for the
  // break between them — they cannot share a section
  ct.flap.span = genClamp(ct.flap.span, 0.10, Math.max(0.10, 1 - ct.aileron.span - 0.04));
  ct.flap.chord = genClamp(ct.flap.chord, 0.10, 0.40);
  ct.elevator.chord = genClamp(ct.elevator.chord, 0.20, 0.55);
  ct.rudder.chord = genClamp(ct.rudder.chord, 0.20, 0.60);
  if (!GEN_SEATING[cb.seating]) cb.seating = 'tandem2';

  // ---- cabin glazing --------------------------------------------------------
  // Every fallback here matches GEN_DEFAULT exactly. genNormaliseSpec has
  // already filled anything missing, so these `== null` arms are only reached by
  // a spec built by hand — and a fallback that disagrees with the default is a
  // trap that only fires on that path.
  if (!['none', 'windshield', 'bubble', 'greenhouse'].includes(cb.glazing))
    cb.glazing = 'bubble';
  // 'greenhouse' survives only so old specs still load: it IS a faceted bubble,
  // and carrying it as a third shape would mean two code paths for one shell.
  if (cb.glazing === 'greenhouse') { cb.glazing = 'bubble'; cb.canopy.facet = true; }
  const cn = cb.canopy || (cb.canopy = {});
  cn.height   = genClamp(cn.height   == null ? 0    : cn.height,   0,    0.90);
  cn.width    = genClamp(cn.width    == null ? 1.0  : cn.width,    0.85, 1.60);
  cn.bubble   = genClamp(cn.bubble   == null ? 0.70 : cn.bubble,   0,    1);
  cn.lid      = genClamp(cn.lid      == null ? 1.0  : cn.lid,      0.25, 1);
  cn.sill     = genClamp(cn.sill     == null ? 0.30 : cn.sill,     0.10, 0.85);
  cn.skew     = genClamp(cn.skew     == null ? 0.42 : cn.skew,     0.20, 1.60);
  cn.sun      = genClamp(cn.sun      == null ? 0    : cn.sun,      0,    0.92);
  cn.sunStart = genClamp(cn.sunStart == null ? 0.38 : cn.sunStart, 0,    0.85);
  cn.sideTop  = genClamp(cn.sideTop  == null ? 0.34 : cn.sideTop,  0.05, 0.75);
  cn.sideDepth= genClamp(cn.sideDepth== null ? 0.5  : cn.sideDepth,0,    1);
  cn.sideReach= genClamp(cn.sideReach== null ? 1.0  : cn.sideReach,0.2,  1);
  cn.sideGap  = genClamp(cn.sideGap  == null ? 0.10 : cn.sideGap,  0,    0.6);
  // -1 concave, 0 the plain smoothstep, +1 convex. The panel only offers 0..1;
  // the clamp is wider so a hand-written spec can ask for a concave screen.
  cn.wsCurve  = genClamp(cn.wsCurve  == null ? 1    : cn.wsCurve,  -1,   1);
  cn.jointRun = genClamp(cn.jointRun == null ? 3    : cn.jointRun | 0, 1, 8);
  if (!['square', 'chamfer'].includes(cn.joint)) cn.joint = 'square';
  cn.facet = !!cn.facet;
  cn.sides = !!cn.sides;
  // nullable = "derive it", and they ride the panel's AUTO path
  cn.wsAngle = genClampN(cn.wsAngle, 22, 80);
  cn.x0      = genClampN(cn.x0, 0, 8);
  cn.x1      = genClampN(cn.x1, 0, 9);
  cn.reach   = genClampN(cn.reach, 0, 1);
  // a windscreen-only cut is covered flush — zero stand-off is the definition of
  // the case, and it is what makes it the control for the edge-loop machinery
  if (cb.glazing === 'windshield') cn.height = 0;

  const pn = cb.panel || (cb.panel = {});
  pn.on    = pn.on !== false;
  pn.depth = genClamp(pn.depth == null ? 0.27 : pn.depth, 0.05, 1.20);
  pn.inset = genClamp(pn.inset == null ? 0.06 : pn.inset, 0,    0.25);
  // how far down the sill arc the coaming wraps; 0.5 is exactly the sill
  pn.wrap  = genClamp(pn.wrap  == null ? 0.50 : pn.wrap,  0,    1);

  // seat station is an OFFSET about a per-layout base (SEAT_BASE, 63_gen_skin.js),
  // so 0 means "right" in either layout
  cb.seatX     = genClamp(cb.seatX     == null ? 0    : cb.seatX,     -0.45, 0.45);
  cb.seatY     = genClamp(cb.seatY     == null ? 0.10 : cb.seatY,      0.06, 0.50);
  // a real distance between tandem seats, not a fraction of the cabin
  cb.seatPitch = genClamp(cb.seatPitch == null ? 0.86 : cb.seatPitch,  0.55, 1.35);

  const pl = cb.pilot || (cb.pilot = {});
  pl.show    = pl.show !== false;
  // standing height in metres; the rig is anthropometric, so this one length
  // scales the whole figure
  pl.stature = genClamp(pl.stature == null ? 1.75 : pl.stature, 1.45, 2.05);
  pl.lean    = genClamp(pl.lean    == null ? 17   : pl.lean,    -5,  45);
  pl.thigh   = genClamp(pl.thigh   == null ? -9   : pl.thigh,  -20,  40);
  pl.shank   = genClamp(pl.shank   == null ? 10   : pl.shank,   10,  95);
  pl.armDown = genClamp(pl.armDown == null ? 40   : pl.armDown, -10, 90);
  pl.fore    = genClamp(pl.fore    == null ? 6    : pl.fore,   -45,  60);
  pl.head    = genClamp(pl.head    == null ? -11  : pl.head,   -25,  25);
  // arms IN toward the body centre — a tight canopy is narrower than a pair of
  // elbows, so this is a control and not a constant
  pl.armIn   = genClamp(pl.armIn   == null ? 26   : pl.armIn,  -10,  40);
  // the legs' OTHER axis: thigh and shank are flexion, these are abduction.
  // Both splays share a range because they are the same kind of control, and
  // because a clamp narrower than its slider leaves dead travel at the ends.
  pl.hipOut  = genClamp(pl.hipOut  == null ? 0    : pl.hipOut,  -5,  35);
  pl.kneeOut = genClamp(pl.kneeOut == null ? 3    : pl.kneeOut, -5,  35);
  // the feet: pitch about the ankle (toes up positive), and splay
  pl.ankle   = genClamp(pl.ankle   == null ? 40   : pl.ankle,  -25,  40);
  pl.toeOut  = genClamp(pl.toeOut  == null ? 7    : pl.toeOut,   0,  30);

  S.paint.regX = genClamp(S.paint.regX == null ? 0.30 : S.paint.regX, 0, 1);
  if (!GEN_FINISH[S.paint.job]) S.paint.job = 'full';

  // the birth flow's labels: TYPE guards only — the legal value tables live
  // with the declaration (tools/_cage_design.js), and a second copy of them
  // here is the second home the `finish` note above already forbids. A
  // non-string is unstated, never an error.
  if (S.meta.role != null && typeof S.meta.role !== 'string') S.meta.role = null;
  if (S.meta.class != null && typeof S.meta.class !== 'string') S.meta.class = null;

  // TAIL-END SECTION HEIGHT. Applied here, on the clone, by moving the two
  // dimensions 61_gen_frame.js actually reads. clampSpec runs on a fresh
  // normalised clone every time, so this cannot accumulate across calls the way
  // gear.track once did.
  fu.tailY = genClamp(fu.tailY == null ? 0 : fu.tailY, -0.60, 0.80);
  fu.tailBot += fu.tailY;
  fu.tailTop += fu.tailY;

  for (const e of S.engines) {
    if (typeof POWERPLANTS !== 'undefined' && !POWERPLANTS[e.type])
      e.type = 'a65_sensenich74';
    if (!['nose', 'wing'].includes(e.mount)) e.mount = 'nose';
    e.place.dx = genClamp(e.place.dx, -0.60, 0.45);
    e.place.dy = genClamp(e.place.dy, -0.30, 0.40);
    // G134: THE CUSTOM ROW — the editor's dials resolved to facts by the
    // join (tools/_cage_eng.js CAGE_ENG_FACTS; identity ruled 2026-09-01:
    // an untouched preset ships NO row and the registry flies). Clamped
    // here so a save can never smuggle a free engine — mass and power move
    // the whole aeroplane. The envelope is the registry's own span (a
    // 0.1 kg park-flyer can to a warbird radial) with headroom, and every
    // enum falls back the way genEngineThermo's legacy inference does.
    const cu = e.custom;
    if (cu && typeof cu === 'object' && isFinite(cu.powerW) && isFinite(cu.mass)) {
      cu.name = typeof cu.name === 'string' && cu.name
        ? cu.name.slice(0, 48) : 'custom engine';
      cu.mass = genClamp(cu.mass, 0.05, 900);
      cu.powerW = genClamp(cu.powerW, 100, 1000000);
      cu.rpm = genClamp(cu.rpm == null ? 2300 : cu.rpm, 400, 14000);
      cu.torque = genClampN(cu.torque, 0, 5000);
      cu.aspiration = cu.aspiration === 'electric' ? 'electric' : 'na';
      cu.family = (typeof GEN_ENG_THERMO !== 'undefined' && GEN_ENG_THERMO[cu.family])
        ? cu.family : (cu.aspiration === 'electric' ? 'electric' : 'four');
      cu.cooling = cu.cooling === 'liquid' ? 'liquid' : 'air';
      // an unpriced custom row takes the market curve — one keeper (00_registry)
      cu.price = genClamp(cu.price == null
        ? genEnginePrice(cu.family, cu.powerW) : cu.price, 10, 200000);
    } else if ('custom' in e) delete e.custom;
  }
  if (!['strut', 'cantilever'].includes(S.bracing.type)) S.bracing.type = 'strut';
  S.fuel.litres = genClamp(S.fuel.litres, 0, 140);
  cb.baggage = genClamp(cb.baggage, 0, 60);
  const w = S.wings[0];
  w.chord = genClamp(w.chord, 1.15, 2.10);
  w.span = genClamp(w.span, Math.max(6.5, 4.0 * w.chord),
                            Math.min(14.0, 10.0 * w.chord));
  w.taper = genClamp(w.taper, 0.45, 1.0);
  w.dihedral = genClamp(w.dihedral, 0, 6);
  // Quarter-chord sweep, degrees, positive aft. At the speeds this game flies
  // sweep buys nothing aerodynamically — it is a compressibility device — so it
  // is here as a BALANCE tool: it walks the aerodynamic centre aft without
  // moving the spar root off its frame. It costs lift-curve slope either way,
  // which is why forward sweep is allowed and is not free.
  w.sweep = genClamp(w.sweep || 0, -15, 30);
  // The wing's fore-aft STATION, now that the join measures it off the built
  // wing's anchor (G52). Nullable — left alone it keeps the noseGap-derived
  // default. The envelope spans a wing rooted on the firewall to one rooted
  // well down the cabin; static margin is the honest consequence either way,
  // and the shakedown posts it.
  w.xLE = genClampN(w.xLE, -0.20, 3.00);
  if (!GEN_TIPS[w.tip]) w.tip = 'rounded';
  if (!GEN_TIPS[S.tail.tip]) S.tail.tip = 'rounded';
  // null is legal on the two overrides and means 'use tail.tip'
  S.tail.stabH = genClamp(S.tail.stabH == null ? 0 : S.tail.stabH, 0, 1);
  S.tail.vSweep = genClampN(S.tail.vSweep, -20, 60);
  const dr = S.tail.dorsal || (S.tail.dorsal = {});
  dr.height = genClamp(dr.height == null ? 0.16 : dr.height, 0, 0.90);
  dr.width  = genClamp(dr.width  == null ? 0.55 : dr.width,  0.15, 1.60);
  dr.angle  = genClampN(dr.angle, 8, 80);
  dr.len    = genClamp(dr.len    == null ? 0.34 : dr.len,    0, 2.00);
  if (S.tail.tipV != null && !GEN_TIPS[S.tail.tipV]) S.tail.tipV = null;
  if (S.tail.tipH != null && !GEN_TIPS[S.tail.tipH]) S.tail.tipH = null;
  S.tail.hTaper = genClamp(S.tail.hTaper == null ? 1 : S.tail.hTaper, 0.35, 1.0);
  if (!['conventional', 'v'].includes(S.tail.type)) S.tail.type = 'conventional';
  // the V's dihedral. Too shallow and it cannot make yaw at any sane area; too
  // steep and it cannot make pitch. The Bonanza's is about 33.
  S.tail.vAngle = genClamp(S.tail.vAngle == null ? 33 : S.tail.vAngle, 20, 55);
  // CRANK: a second wing section, and only a second. `crankAt` is the break
  // station as a fraction of the semispan; 0 means a single straight panel.
  // This is the Jodel's wing — a flat centre section and sharply dihedralled
  // outer panels — which is a real structure, not a styling choice: the crank
  // is where the outer panel bolts to the centre section.
  w.crankAt = genClamp(w.crankAt || 0, 0, 0.85);
  if (w.crankAt > 0 && w.crankAt < 0.15) w.crankAt = 0;
  w.dihedralOut = genClampN(w.dihedralOut, 0, 20);
  // G140: the three stations. Chord at the crank inside the chord clamp;
  // the offsets inside the sweep clamp's own reach (tan 30 deg of the
  // exposed semispan — the same envelope the angle always had). Null stays
  // null: it is the derive-from-sweep contract, not a value.
  {
    const reach = Math.tan(30 * Math.PI / 180) *
                  Math.max(0.5, 0.5 * w.span - 0.3);
    if (w.crankChord != null)
      w.crankChord = genClamp(w.crankChord, 0.55, 2.10);
    if (w.tipX != null) w.tipX = genClamp(w.tipX, -reach, reach);
    if (w.crankX != null) w.crankX = genClamp(w.crankX, -reach, reach);
    // a crank field without a crank is a claim about a station that does
    // not exist — nulled, same rule as dihedralOut's "left alone" line
    if (!(w.crankAt > 0)) { w.crankChord = null; w.crankX = null; }
  }
  w.incidence = genClamp(w.incidence, -1, 4);
  w.washout = genClamp(w.washout, 0, 4);
  w.panels = genClamp(w.panels | 0, 2, 5);
  const n = nacaParts(w.naca);
  w.naca = (genClamp(Math.round(n.m * 100), 0, 6) * 1000)
         + (genClamp(Math.round(n.p * 10), 2, 6) * 100)
         + genClamp(Math.round(n.t * 100), 9, 18);
  if (!['high', 'mid', 'low'].includes(w.position)) w.position = 'high';
  // the centre section over the cabin. NOTE the path: this is `wings[].centre`,
  // not `cabin.wingBay` — the transfer spec named it the latter, and the latter
  // exists nowhere. The enum is `glass`, not `skylight`, for the same reason.
  if (!['solid', 'glass', 'open'].includes(w.centre)) w.centre = 'solid';
  // placement: generous bounds, because the point is to allow bad aeroplanes.
  // These stop the geometry going degenerate, nothing more.
  w.place.dx = genClamp(w.place.dx, -1.2, 1.8);
  w.place.dy = genClamp(w.place.dy, -0.25, 0.60);
  if (!['taildragger', 'tricycle'].includes(S.gear.type)) S.gear.type = 'taildragger';
  if (!GEN_SUSPENSION[S.gear.suspension]) S.gear.suspension = 'bungee';
  // WHEEL FAIRINGS, off by default. `spat` is the shell over the wheel alone;
  // `full` carries it up the leg as well. The drag model this comment once
  // said "may arrive" arrived at G115 (genGearCdA prices these fields), the
  // mass model at G133 (genLattice bills them, GEN_FAIR_MATS × GEN_PRICES).
  if (!['none', 'spat', 'full'].includes(S.gear.fairing)) S.gear.fairing = 'none';
  // G121.2: the THIRD WHEEL's own fairing. Since G133 the tailwheel castor
  // draws its own shell, so this prices on every leg family — the old
  // tricycle-only condition in genGearCdA is retired.
  if (!['none', 'spat', 'full'].includes(S.gear.twFairing)) S.gear.twFairing = 'none';
  // G133: the LEG fairings, the droplet lengths and the layup — every one
  // drawn by the gear layer before it is priced anywhere (the G121.2 rule).
  if (!['none', 'fair'].includes(S.gear.legFair)) S.gear.legFair = 'none';
  if (!['none', 'fair'].includes(S.gear.twLegFair)) S.gear.twLegFair = 'none';
  S.gear.fairTail = genClamp(S.gear.fairTail == null ? 1 : S.gear.fairTail,
                             0.70, 1.60);
  S.gear.twFairTail = genClamp(S.gear.twFairTail == null ? 1 : S.gear.twFairTail,
                               0.70, 1.60);
  if (!GEN_FAIR_MATS[S.gear.fairMat]) S.gear.fairMat = 'glass';
  // G121 (the review's B8): ONE ENGINE UNTIL THE MOUNTS ARE REAL. `engines`
  // is an array by design and `nEngines` multiplies thrust honestly — but
  // every mount today is the one nose pair, so a second entry would fly as
  // doubled thrust with ZERO asymmetry: no offset nacelles, no engine-out,
  // no Vmc. That is not a twin, it is a lie wearing one's spec. Clamped
  // here, loudly, until P7 gives each engine its own mount nodes; the clamp
  // is the declared guard the review asked for in place of a later surprise.
  if (Array.isArray(S.engines) && S.engines.length > 1)
    S.engines = S.engines.slice(0, 1);
  S.cargo.len = genClamp(S.cargo.len || 0, 0, 2.5);
  S.cargo.kg = genClamp(S.cargo.kg || 0, 0, 400);
  fu.tailBays = genClamp(fu.tailBays | 0, 3, 6);
  fu.postGap = genClamp(fu.postGap, 0.35, 1.10);
  fu.crownTop = genClamp(fu.crownTop, 0, 1);
  fu.crownSide = genClamp(fu.crownSide, 0, 0.6);
  // The TAIL-END SECTION. These were in the spec from the start but had no
  // control, so every aeroplane got a 0.10 m half-width tailpost whatever its
  // size. A bigger section is also a deeper truss, which is a GEOMETRY change,
  // not a stiffness one — the beam constants are untouched here.
  fu.tailW = genClamp(fu.tailW, 0.06, 0.45);
  fu.tailBot = genClamp(fu.tailBot, 0, 0.80);
  fu.tailTop = genClamp(fu.tailTop, 0.10, 1.20);
  fu.cowlDeck = genClampN(fu.cowlDeck, 0.50, 1.00);
  fu.windRun = genClamp(fu.windRun, 0.10, 0.60);
  S.cowl.fillet = genClamp(S.cowl.fillet, 0.02, 0.22);
  S.cowl.taper = genClamp(S.cowl.taper, 0.70, 1.0);
  // The cowl's own nose section. Generous, because a slim cowl on a fat engine
  // and a fat cowl on a slim one are both aeroplanes somebody builds — the
  // shakedown says which you have, it does not refuse to build it.
  S.cowl.halfW = genClampN(S.cowl.halfW, 0.05, 1.10);
  S.cowl.top = genClampN(S.cowl.top, 0.03, 1.10);
  S.cowl.bot = genClampN(S.cowl.bot, 0.03, 1.10);
  if (!GEN_INTAKES[S.cowl.intake]) S.cowl.intake = 'chin';
  // THE PROPELLER. Diameter is bounded by what a nose can carry rather than by
  // what flies: prop clearance is a GEN_RULES constraint and it will lengthen the
  // undercarriage to hold it, so a 4 m disc on a Cub is a legal, stilted mistake.
  S.prop.D = genClampN(S.prop.D, 0.20, 4.00);
  S.prop.blades = genClamp(Math.round(S.prop.blades) || 2, 2, 6);
  if (!GEN_PROP_MATS[S.prop.material]) S.prop.material = 'wood';
  if (!GEN_PROP_PITCH[S.prop.pitch]) S.prop.pitch = 'standard';
  // the shape half — visual only, so the bounds are what reads as a propeller
  // rather than what flies
  S.prop.chord = genClamp(S.prop.chord == null ? 0.10 : S.prop.chord, 0.05, 0.20);
  S.prop.root  = genClamp(S.prop.root  == null ? 0.16 : S.prop.root,  0.08, 0.35);
  const sn = S.prop.spinner || (S.prop.spinner = {});
  if (!['ogive', 'cone', 'dome', 'none'].includes(sn.shape)) sn.shape = 'ogive';
  // len and dia are multiples of the spinner RADIUS and of the prop radius
  // respectively — again fractions, so a bigger propeller gets a bigger nose
  sn.len = genClamp(sn.len == null ? 2.2  : sn.len, 0.6,  4.0);
  sn.dia = genClamp(sn.dia == null ? 0.17 : sn.dia, 0.08, 0.32);
  cb.noseGap = genClamp(cb.noseGap, 0.40, 1.10);
  S.gear.stiffness = genClamp(S.gear.stiffness == null ? 1 : S.gear.stiffness, 0.35, 3.0);
  S.gear.place.dx = genClamp(S.gear.place.dx, -0.80, 1.20);
  S.gear.place.dtrack = genClamp(S.gear.place.dtrack, -0.80, 1.50);
  S.tail.place.dx = genClamp(S.tail.place.dx, -1.5, 1.5);
  // fields the generator normally derives, but which the editor now exposes.
  // Bounded so an override cannot go degenerate; still nullable, so leaving
  // them alone keeps the derivation.
  // G54.1: the measured boom profile — every row bounded, t strictly rising,
  // deck kept above floor; anything degenerate falls back to the shape family.
  if (Array.isArray(fu.profile)) {
    const P2 = [];
    let tPrev = -1;
    for (const r of fu.profile) {
      if (!r || !isFinite(r.t) || !isFinite(r.w) ||
          !isFinite(r.yb) || !isFinite(r.yt)) continue;
      const t = genClamp(r.t, 0, 1);
      if (t <= tPrev + 1e-6) continue;
      const yb = genClamp(r.yb, -0.40, 1.20);
      P2.push({ t, w: genClamp(r.w, 0.05, 0.90),
                yb, yt: genClamp(r.yt, yb + 0.06, 1.60) });
      tPrev = t;
      if (P2.length >= 16) break;
    }
    fu.profile = P2.length >= 2 ? P2 : null;
  } else fu.profile = null;
  cb.halfW = genClampN(cb.halfW, 0.28, 0.75);
  cb.h = genClampN(cb.h, 0.75, 1.45);
  cb.len = genClampN(cb.len, 0.60, 2.60);
  fu.tailArm = genClampN(fu.tailArm, 2.00, 6.50);
  S.tail.hSpan = genClampN(S.tail.hSpan, 1.50, 4.50);
  S.tail.hChord = genClampN(S.tail.hChord, 0.40, 1.60);
  S.tail.vHeight = genClampN(S.tail.vHeight, 0.60, 2.20);
  S.tail.vChord = genClampN(S.tail.vChord, 0.40, 1.80);
  // the tail surfaces' STATIONS, measured by the join since G54.3 — bounded
  // like the other measured stations; nullable keeps the volume-coefficient
  // derivation for everything that does not measure them.
  S.tail.hX = genClampN(S.tail.hX, 2.00, 9.00);
  S.tail.vX = genClampN(S.tail.vX, 2.00, 9.00);
  S.gear.track = genClampN(S.gear.track, 0.90, 3.50);
  S.gear.wheelR = genClamp(S.gear.wheelR, 0.10, 0.40);
  S.gear.twR = genClamp(S.gear.twR, 0.05, 0.25);
  // Leg lengths: generous, because a stilt-legged bush aeroplane and a squatting
  // racer are both aeroplanes somebody builds. The floor is rule 5 (a leg this
  // short has no vertical stiffness whatever its k) and the shakedown says so.
  S.gear.legDrop = genClampN(S.gear.legDrop, 0.15, 1.20);
  S.gear.twLeg = genClampN(S.gear.twLeg, 0.06, 1.40);
  // The THIRD WHEEL the join measures off the built cage (G51). They were
  // nullable expose-the-derivation fields with no bounds because nothing ever
  // wrote them; now that a measurement does, they get the same generous-but-
  // non-degenerate envelope as the leg lengths. twY is an axle height in the
  // lattice's own datum (the cabin keel line since G49); twX is a station,
  // NEGATIVE for a nose wheel ahead of the firewall.
  S.gear.twX = genClampN(S.gear.twX, -1.50, 8.00);
  S.gear.twY = genClampN(S.gear.twY, -1.00, 1.50);
  // The RIDE HEIGHT, measured since G53. G51 blamed its collapse on soft long
  // levers and left it derived — WRONG twice over: the collapse was a rule-10
  // snap-through (the mains' anchors all lay in the belly plane; the axle
  // reflected through it at 0.28% strain), and it was the DERIVED depth that
  // had been hiding the mechanism. With the mains' snap-blocker in the frame,
  // a measured shallow stance stands. Prop clearance is no longer guaranteed
  // by derivation — the shakedown's propClear row posts what the built stance
  // actually leaves under the registry prop.
  S.gear.y = genClampN(S.gear.y, -0.90, 0.90);
  // The mains STATION, measured by the join since G52. Setting it bypasses
  // the CG/rake placement rule — deliberately: the wheels go where the built
  // aeroplane's wheels are, and the shakedown's noseOver row posts the
  // consequence. The height (gear.y) stays the prop-clearance rule's.
  S.gear.x = genClampN(S.gear.x, -0.50, 3.00);
  // Camber, degrees, tops-outboard positive. Real aeroplanes run a few degrees
  // either way; the range is wide enough to be a look and not wide enough for
  // the wheel to lie on its side.
  S.gear.camber = genClamp(S.gear.camber || 0, -12, 20);
  return genAlias(S);
}

// Fill every null from the fields before it. `auto` records what was derived
// so the editor can mark a field "auto" and show the proposal it overrode.
// Order matters: this IS the design flow (cabin -> fuselage -> engine ->
// wing -> tail -> gear), each step reading only what precedes it.
function resolveSpec(spec) {
  const S = clampSpec(spec);
  const auto = {};
  const put = (o, k, v, path) => { if (o[k] === null || o[k] === undefined) { o[k] = v; auto[path] = true; } };

  // 1. cabin — the payload box everything else is built around
  const seat = GEN_SEATING[S.seating];
  put(S.cab, 'halfW', seat.halfW, 'cab.halfW');
  put(S.cab, 'h', seat.h, 'cab.h');
  put(S.cab, 'len', seat.len, 'cab.len');
  // THE WINDOW'S AFT END, and why it is a fraction. `reach` is what the panel
  // drives; `x1` is the absolute station it resolves to, and it resolves HERE
  // because it needs the cabin length that was derived on the line above.
  //
  // An absolute station cannot survive a cabin-length change: stretch the cabin
  // and the window stays where it was while the cabin moves out from under it,
  // which is the failure the prototype harness hit and fixed. A fraction of the
  // cabin follows it by construction. The extra 0.5 m is the bay behind the
  // cabin, so reach = 1 runs the window to the end of it.
  //
  // Setting `x1` explicitly still wins — `put` only fills nulls — so a build
  // that wants the window pinned whatever the cabin does can still say so. The
  // aft-of-tailpost safety clamp stays in 63_gen_skin.js, where postX lives.
  put(S.cab.canopy, 'reach', (S.cab.len + 0.35) / (S.cab.len + 0.5),
      'cabin.canopy.reach');
  put(S.cab.canopy, 'x1', S.cab.noseGap + (S.cab.len + 0.5) * S.cab.canopy.reach,
      'cabin.canopy.x1');
  // no windscreen on a drone: the firewall top IS the cabin top, so the nose
  // runs straight into the body with no step to break
  put(S.fuse, 'cowlDeck', seat.deck, 'fuse.cowlDeck');
  // THE WINDSCREEN RAKE, as ONE number driving both things that must agree.
  // The fuselage owns its windscreen — the step up from the cowl deck over
  // `windRun` — and the canopy's front bow sits on that same step. Expressed as
  // two independent fields they drift, the shell stands off the body, and you
  // get the slab the transfer spec's crown-line note describes. So the angle is
  // the control and the run is derived from it: same rise, same angle, one
  // source. Left null, the angle is read back OUT of the fuselage's own run, so
  // an untouched build is bit-for-bit what it was.
  {
    const rise = Math.max(0.02, S.cab.h * (1 - S.fuse.cowlDeck));
    const cn = S.cab.canopy;
    if (cn.wsAngle == null)
      put(cn, 'wsAngle', Math.atan2(rise, S.fuse.windRun) * 180 / Math.PI,
          'cabin.canopy.wsAngle');
    else
      S.fuse.windRun = rise / Math.tan(cn.wsAngle * Math.PI / 180);
  }
  S.seats = seat.crew;
  S.crew = genClamp(S.pilots | 0, 1, seat.crew);
  // WHO ELSE IS ABOARD. `pilots` has always been LOADING rather than capacity
  // (its own comment in GEN_DEFAULT says so); `pax` is the same idea for the
  // seats the flight crew are not in, so the two together are the occupants
  // and `seats` stays the capacity. Clamped to what is left, so a spec cannot
  // load five people into four seats — and 0 by default, which is why no
  // existing aeroplane's mass moves.
  S.pax = genClamp(S.cab.pax | 0, 0, Math.max(0, seat.crew - S.crew));
  S.occupants = S.crew + S.pax;

  // 2. wing longitudinal placement — the front spar lands on the cabin-front
  //    frame, which is what puts a high-wing carry-through over the cabin
  const w = S.wing, pl = S.place;
  put(w, 'xLE', S.cab.noseGap - GEN_RULES.sparFront * w.chord, 'wing.xLE');
  // the nudge lands BEFORE the tail arm is worked out, so pulling the wing back
  // takes the empennage with it and the aeroplane stays a coherent shape. Move
  // the tail relative to that with place.tailDx.
  w.xLE += pl.wingDx;
  // an uncranked wing's outer dihedral IS its dihedral, so the field can be
  // left alone and the aeroplane stays a single straight panel
  put(w, 'dihedralOut', w.crankAt > 0 ? Math.min(20, w.dihedral + 11) : w.dihedral,
      'wing.dihedralOut');
  const semi = 0.5 * w.span;
  const zR0 = S.cab.halfW;
  // G140: the one planform law — legacy fields reproduce the pre-G140
  // expressions verbatim inside it, stations make it piecewise.
  const LAW = genPlanLaw(w, zR0, semi);
  let cBar, yMac, xAC;
  if (!LAW.explicit) {
    // LEGACY (sweep/taper only): the pre-G140 lines, byte for byte. The
    // aerodynamic centre sits at the quarter chord OF THE MAC, and sweep
    // carries that aft with the spanwise station the MAC lives at:
    //   yMac = (b/6) (1 + 2 lambda) / (1 + lambda)
    // Everything downstream reads xAC — the tail arm above all.
    cBar = w.chord * (2 / 3) * (1 + w.taper + w.taper * w.taper) / (1 + w.taper);
    yMac = (w.span / 6) * (1 + 2 * w.taper) / (1 + w.taper);
    xAC = w.xLE + 0.25 * w.chord + yMac * Math.tan(w.sweep * Math.PI / 180);
    w.sweepEff = w.sweep;
  } else {
    // EXPLICIT stations: per-panel trapezoid composition — each panel its
    // own area, MAC, MAC station and LE sweep; the wing's numbers are the
    // area-weighted sums. Two honesty notes against the legacy line above:
    // the quarter chord is of each panel's MAC (not the root chord), and
    // the offset walk is measured from zR0 where the walk actually starts
    // (the legacy formula walked yMac from the centreline — it over-walked
    // by tan(sweep)*zR0, which is why a MIGRATED swept save's xAC may sit
    // a couple of centimetres forward of its frozen v5 number).
    const zsP = LAW.zC > 0 ? [zR0, LAW.zC, semi] : [zR0, semi];
    let A = 0, cS = 0, xS = 0, swS = 0;
    for (let i = 0; i + 1 < zsP.length; i++) {
      const z0 = zsP[i], z1 = zsP[i + 1], b = z1 - z0;
      const cA = LAW.cAt(z0), cB = LAW.cAt(z1);
      const Si = 0.5 * (cA + cB) * b;
      const lam = cB / Math.max(1e-6, cA);
      const mac = cA * (2 / 3) * (1 + lam + lam * lam) / (1 + lam);
      const yM = z0 + (b / 3) * (1 + 2 * lam) / (1 + lam);
      const xACi = w.xLE + LAW.xoff(yM) + 0.25 * mac;
      const swp = Math.atan2(LAW.xoff(z1) - LAW.xoff(z0), b) * 180 / Math.PI;
      A += Si; cS += Si * mac; xS += Si * xACi; swS += Si * Math.abs(swp);
    }
    cBar = cS / Math.max(1e-9, A);
    xAC = xS / Math.max(1e-9, A);
    yMac = null;                       // no single station carries the MAC now
    w.sweepEff = swS / Math.max(1e-9, A);   // area-weighted |LE sweep|, deg
  }
  // TIP BOW. The radius is a fraction of the chord AT the joint, and the joint
  // is a radius inboard of the tip — implicit, so settle it by iteration (it
  // converges in two on any sane taper). LAW.cAt IS the old `lin` when the
  // stations are null, so the legacy bow is unchanged to the bit.
  const bowF = (GEN_TIPS[w.tip] || GEN_TIPS.rounded).bow || 0;
  let Rb = bowF * LAW.cAt(semi);
  for (let i = 0; i < 3; i++) Rb = bowF * LAW.cAt(Math.max(zR0, semi - Rb));
  Rb = Math.max(0, Math.min(Rb, 0.45 * (semi - zR0)));
  w.tipR = Rb;
  w.tipZ = semi - Rb;
  w.tipC = Rb > 1e-6 ? LAW.cAt(w.tipZ) : 0;
  // THE REFERENCE AREA IS THE SHAPE THAT WAS BUILT. This used to be the area of
  // a trapezoid tapering from the CENTRELINE — but the wing does not taper from
  // there. `linC` (61_gen_frame.js) runs the root chord out to zR0 and only
  // tapers outboard of it, because the centre section spans the cabin, so the
  // real planform is a rectangle plus two trapezoids and the old sum under-read
  // it by zR0 * chord * (1 - taper): nothing at taper 1, 0.24 m2 on a 11.6 m2
  // wing at the taper clamp.
  //
  // Two things went wrong with that, and the second is the worse one. The panel
  // reported `Sw` and `loading` off the STRIPS (64_gen_build.js) while `Vs` came
  // from here, so the sheet disagreed with itself about the same wing. And AR
  // below feeds genOswald, the 3D lift-curve slope, ClMax and the tail volume
  // coefficients — so every one of those inherited the error.
  //
  // The bow still comes off: it removes a quarter of the rectangle it replaces
  // on each tip (half-ellipse of span Rb and chord tipC).
  const Sw = !LAW.explicit
    ? 2 * zR0 * w.chord
      + (semi - zR0) * w.chord * (1 + w.taper)
      - 2 * w.tipC * Rb * (1 - Math.PI / 4)
    // explicit stations: the same rectangle + trapezoids + bow, panel by
    // panel — reduces to the line above when the crank chord is unset
    : 2 * zR0 * w.chord
      + (LAW.zC > 0
          ? (LAW.zC - zR0) * (LAW.cAt(zR0) + LAW.cAt(LAW.zC))
            + (semi - LAW.zC) * (LAW.cAt(LAW.zC) + LAW.cAt(semi))
          : (semi - zR0) * (LAW.cAt(zR0) + LAW.cAt(semi)))
      - 2 * w.tipC * Rb * (1 - Math.PI / 4);
  S.geom = { xAC, cBar, semi, Sw, AR: w.span * w.span / Sw };

  // 3. fuselage length from the tail arm rule. The cargo bay is full-section
  //    fuselage aft of the cabin, so the tail has to start behind it.
  S.fuse.boxRear = S.cab.noseGap + S.cab.len + S.fuse.cargoLen;
  put(S.fuse, 'tailArm', xAC + GEN_RULES.tailArmC * w.chord, 'fuse.tailArm');
  S.fuse.tailArm = Math.max(S.fuse.tailArm, S.fuse.boxRear + 0.9 * w.chord);
  const post = S.fuse.tailArm + S.fuse.postGap;
  S.fuse.postX = post;

  // 4. empennage from tail volume coefficients against the wing just sized
  const t = S.tail;
  put(t, 'hX', S.fuse.tailArm + 0.70 * S.fuse.postGap, 'tail.hX');
  put(t, 'vX', S.fuse.tailArm + 0.90 * S.fuse.postGap, 'tail.vX');
  t.hX += pl.tailDx; t.vX += pl.tailDx;
  const lh = Math.max(1.0, t.hX - xAC), lv = Math.max(1.0, t.vX - xAC);
  // G115: the tail AREAS are derivable, not imposed — `put`, not assignment.
  // The volume rule fills them when the builder says nothing (identical to
  // the old unconditional write for every existing build), but a set Sh or
  // Sv now STICKS: the auto-tail was silently rescuing every design from the
  // classic mistake, and a fin you cannot shrink is a fin you cannot learn
  // from. Areas resolve FIRST so the spans and chords below derive from the
  // EFFECTIVE area, whichever of the rule or the builder supplied it. The
  // arms stay computed — they are geometry readouts, not choices.
  put(t, 'Sh', GEN_RULES.Vh * S.geom.Sw * cBar / lh, 'tail.Sh');
  put(t, 'Sv', GEN_RULES.Vv * S.geom.Sw * w.span / lv, 'tail.Sv');
  const Sh = t.Sh, Sv = t.Sv;
  put(t, 'hSpan', Math.sqrt(Sh * GEN_RULES.hAR), 'tail.hSpan');
  put(t, 'hChord', Sh / t.hSpan, 'tail.hChord');
  put(t, 'vHeight', Math.sqrt(Sv * GEN_RULES.vAR), 'tail.vHeight');
  put(t, 'vChord', Sv / t.vHeight, 'tail.vChord');
  S.tail.lh = lh; S.tail.lv = lv;
  // THE FIN'S RAKE, derived from what it already was. The skin swept the fin's
  // leading edge by a hardcoded 0.30 of the chord over the fin's height; left
  // null that is exactly what comes back, so making it a control moves no
  // existing aeroplane. It is an ANGLE and not a chord fraction because that is
  // what a builder reads off a drawing and what stays meaningful when the fin's
  // height and chord both change.
  put(t, 'vSweep', Math.atan2(0.30 * t.vChord, t.vHeight) * 180 / Math.PI,
      'tail.vSweep');
  // the dorsal's over-determined corner: an angle SET drives the length, an
  // angle left null is read back out of it
  {
    const d = t.dorsal;
    if (d.angle != null && d.height > 0)
      d.len = Math.max(0, d.height / Math.tan(d.angle * Math.PI / 180));
    else
      put(d, 'angle', Math.atan2(d.height, Math.max(1e-6, d.len)) * 180 / Math.PI,
          'tail.dorsal.angle');
  }
  // ---- V-TAIL: one pair of panels doing both jobs ----
  // A panel canted at G contributes cos^2 G of its area to pitch and sin^2 G to
  // yaw (one cosine because a pitch rate only reaches the panel through its
  // tilted normal, a second because only the vertical part of the resulting
  // force makes a pitching moment). So the area that satisfies BOTH volume
  // coefficients is whichever requirement binds — and on a shallow V it is
  // always pitch, which is why real V-tails are big.
  if (S.tail.type === 'v') {
    const G = S.tail.vAngle * Math.PI / 180;
    const cG = Math.cos(G), sG = Math.sin(G);
    const Svt = Math.max(Sh / (cG * cG), Sv / (sG * sG));
    // panel geometry from the same aspect-ratio rule the stabiliser uses,
    // measured ALONG the panels rather than across their projection
    const bVt = Math.sqrt(Svt * GEN_RULES.hAR);       // tip to tip, along the V
    const cVt = Svt / bVt;
    S.tail.Svt = Svt; S.tail.vG = G;
    S.tail.hSpan = bVt * cG;                          // horizontal projection
    S.tail.hChord = cVt;
    S.tail.vHeight = 0.5 * bVt * sG;
    S.tail.vChord = cVt;
    S.tail.Sh = Svt * cG * cG;                        // effective, for reporting
    S.tail.Sv = Svt * sG * sG;
    auto['tail.hSpan'] = auto['tail.hChord'] = true;
    auto['tail.vHeight'] = auto['tail.vChord'] = true;
  }

  // 5. gear — the two hard geometric constraints of a taildragger.
  //    y: the prop must clear the ground in the LEVEL attitude (this is the
  //    binding case; three-point has the nose up and is generous).
  //    twY: falls out of the third leg's length (both gear types since G4.6).
  //    x and track need the CG, so genFrame() places them on a second pass.
  //
  //    CAMBER first, because the contact radius it produces is what every
  //    clearance below is measured from. A wheel leaning by gamma touches
  //    R*cos(gamma) under its axle, so a cambered aeroplane sits LOWER on the
  //    same legs. `contactR` is published on the spec because five places need
  //    to agree about it — the node radius the solver contacts on, the prop
  //    clearance rule, the frame's track derivation, the shakedown's ground
  //    line, and the wheel mesh.
  //    NOT modelled: the contact patch also moves inboard by R*sin(gamma). The
  //    solver contacts directly under the node, so the effective track is the
  //    axle track. At the clamp (20 deg, 0.40 m wheels) that is 14 cm on a
  //    track of about 1.5 m — an honest cut, and the only one camber makes.
  S.gear.camberRad = S.gear.camber * Math.PI / 180;
  S.gear.contactR = S.gear.wheelR * Math.cos(S.gear.camberRad);
  const REG = (typeof POWERPLANTS !== 'undefined' && POWERPLANTS[S.engine]) || null;
  // G134: a CUSTOM row (the editor's dials, resolved + clamped) outranks the
  // registry row it started from. Shape-compatible with a registry entry so
  // every PP reader below — and 61/62 through S.pplant — is one code path;
  // the preset survives as the prop-diameter default and the legacy lookup
  // key (params.powerplant), so nothing built before this line moves.
  const CU = S.engines[0] && S.engines[0].custom;
  const PP = CU
    ? { price: CU.price, engine: CU, prop: REG ? REG.prop : { D: 1.80 } }
    : REG;
  S.pplant = PP;
  // 4a. THE PROPELLER, synthesised from the disc it actually is. The registry's
  // prop is the DEFAULT diameter and nothing more; every number below is derived,
  // so a bigger disc really does pull harder and blow harder over the tail.
  {
    const pr = S.prop;
    put(pr, 'D', PP ? PP.prop.D : 1.80, 'prop.D');
    const PI = GEN_PROP_PITCH[pr.pitch] || GEN_PROP_PITCH.standard;
    const MT = GEN_PROP_MATS[pr.material] || GEN_PROP_MATS.wood;
    const P = PP ? PP.engine.powerW : 48500;
    pr.area = Math.PI * (pr.D / 2) * (pr.D / 2);
    // More blades is more disc solidity: better static thrust for the same
    // diameter, at a little peak efficiency. 5.5% a blade past two.
    pr.fm = PI.fm * (1 + 0.055 * (pr.blades - 2));
    // MOMENTUM THEORY. The ideal static thrust of a disc absorbing P is
    // (2 rho A)^(1/3) P^(2/3); a real propeller reaches a fraction of it.
    pr.Tstatic = pr.fm * Math.cbrt(2 * RHO * pr.area) * Math.pow(P, 2 / 3);
    // and the quadratic decay, through the speed at which thrust runs out. One
    // constant on the only velocity scale there is; the pitch trade rides in
    // Tstatic, so a fine prop's thrust runs out earlier without being told to.
    pr.V0 = GEN_RULES.propV0K * P / Math.max(1, pr.Tstatic);
    pr.kV2 = pr.Tstatic / (pr.V0 * pr.V0);
    // blade mass, at the very front of the aeroplane
    pr.mass = pr.blades * MT.kg * Math.pow(pr.D / 1.88, 2.5);
    pr.price = Math.round(MT.price * pr.blades / 2 * Math.pow(pr.D / 1.88, 2));
    pr.name = `${pr.blades}-blade ${MT.name.toLowerCase()} ${pr.D.toFixed(2)} m`;
  }
  const propR = S.prop.D / 2;
  S.propR = propR;
  S.engY = 0.36 * S.cab.h + pl.engineDy;        // thrustline, above the lower longeron
  S.engX = -(0.18 + 0.32 * propR) + pl.engineDx; // firewall forward: cowl + prop

  // 4b. THE ENGINE BLOCK's own size, derived here rather than in the skin that
  // draws it, because the cowl has to be able to ask whether it covers the
  // thing. Scaled off the registry mass so a bigger engine looks like one; the
  // floor stops a model-aircraft outrunner from vanishing. Cylinders reach out
  // to `cylZ` either side, which is what pokes out of a Cub's cowl on purpose.
  {
    const k = Math.cbrt(Math.max(8, PP ? PP.engine.mass : 80) / 80);
    const halfW = 0.105 * k, cylZ = 0.30 * k, cylR = 0.072 * k;
    // A cylinder is a TILTED tube, so its outer cap ring reaches further out
    // than its axis does — 15 mm on an O-200, which is exactly the margin the
    // enclosure verdict was getting wrong. `cylZ` is what the skin draws to;
    // `cylReach` is what actually sticks out, and is what the test uses.
    const tilt = (0.04 * k) / Math.hypot(0.04 * k, cylZ - halfW);
    S.engBox = { k, halfW, halfH: 0.105 * k, cylZ, cylR,
                 cylReach: cylZ + cylR * tilt,
                 xF: S.engX - 0.09 * k, xA: S.engX + 0.19 * k };
  }

  // 4c. THE COWL's nose section, about the THRUSTLINE. Derived from the firewall
  // section tapered about that datum, which is the same shape as before wherever
  // the two datums nearly coincide (every seating but the drone) and is centred
  // on the engine where they do not.
  {
    const cw = S.cowl, ck = genClamp(cw.taper, 0.70, 1.0);
    const fwW = S.cab.halfW * 0.92;               // firewall ring, as station 0
    const fwT = S.cab.h * S.fuse.cowlDeck, fwB = 0;
    // THE DERIVED TOP AND BOTTOM CLEAR THE CRANKCASE. That line is the fix for
    // "the drone cowl collapses below its engine", and it is drawn at the CASE
    // rather than at the cylinders on purpose: a cowl covers the case and lets
    // the cylinder heads out — that is what a J-3 does, and enclosing everything
    // by default would make every aeroplane a cowled Cessna. Measured, the floor
    // bites ONLY on the drone (its deck line is its cabin roof, so the firewall
    // section sits 4 cm above the thrustline on a 30 cm body): +2.4 cm of cowl
    // bottom there, and not a millimetre on any other seating.
    // The earlier attempt at this floored the FIREWALL RING on engine size and
    // had to be reverted because it widened every aeroplane's nose. The cowl
    // having a section of its own is what makes the same idea safe.
    const E = S.engBox;
    const clr = Math.max(0.02, 0.20 * E.halfH);
    const xNose = S.engX - 0.10, len = Math.max(0.12, 0 - xNose);
    // The cover is a loft with a FILLET rolled onto its nose, and the fillet is
    // an inset from every side. The case's forward face sits within a couple of
    // centimetres of the nose plane, i.e. INSIDE the fillet, so flooring the
    // nose section alone leaves the case poking out of the belly anyway
    // (measured: 1.7 cm on the drone, down from 4.3, but still there).
    // So solve for the nose section that covers the case AT THE CASE'S OWN
    // STATIONS. Four fixed passes rather than a while-loop: generation has to
    // stay deterministic (GATE GEN byte-compares a double-generate), and the
    // update is monotone, so four is past convergence everywhere measured.
    const shrinkAt = (t, nHW, hDN) => {
      const fil = Math.min(cw.fillet, 0.40 * Math.min(nHW, hDN), 0.45 * len);
      const d = (1 - t) * len;                     // distance back from the nose
      if (d >= fil) return 0;
      // the quarter-round: shrink = fil (1 - cos a), sin a = 1 - d/fil
      const s = Math.max(0, Math.min(1, 1 - d / Math.max(1e-6, fil)));
      return fil * (1 - Math.sqrt(Math.max(0, 1 - s * s)));
    };
    // ONE section function, shared by the floor solver and the verdict below, so
    // what the panel claims and what the loft builds cannot drift apart. `t` is
    // the fraction along the cowl (0 = firewall), and the fillet's inset is in it.
    const secAt = (t, nHW, nTop, nBot) => {
      const hDN = 0.5 * (nTop + nBot), yN = S.engY + 0.5 * (nTop - nBot);
      const sh = shrinkAt(t, nHW, hDN);
      const yc = 0.5 * (fwT + fwB) + (yN - 0.5 * (fwT + fwB)) * t;
      const hd = 0.5 * (fwT - fwB) + (hDN - 0.5 * (fwT - fwB)) * t;
      return { halfW: Math.max(0.02, fwW + (nHW - fwW) * t - sh),
               yLo: yc - hd + sh, yHi: yc + hd - sh, t };
    };
    let nT = Math.max(0.03, E.halfH + clr, (fwT - S.engY) * ck);
    let nB = Math.max(0.03, E.halfH + clr, (S.engY - fwB) * ck);
    const nHW0 = fwW * ck;
    for (let pass = 0; pass < 4; pass++) {
      let needT = 0, needB = 0;
      // the case occupies xF..xA; its most exposed station is the forward one,
      // but walk it so a long case cannot slip between samples
      for (let i = 0; i <= 4; i++) {
        const s2 = secAt(Math.max(0, Math.min(1,
          (0 - (E.xF + (E.xA - E.xF) * i / 4)) / len)), nHW0, nT, nB);
        needT = Math.max(needT, (S.engY + E.halfH + clr) - s2.yHi);
        needB = Math.max(needB, s2.yLo - (S.engY - E.halfH - clr));
      }
      if (needT <= 1e-6 && needB <= 1e-6) break;
      nT += Math.max(0, needT); nB += Math.max(0, needB);
    }
    put(cw, 'halfW', nHW0, 'cowl.halfW');
    put(cw, 'top', nT, 'cowl.top');
    put(cw, 'bot', nB, 'cowl.bot');
    S.cowl.secAt = t => secAt(t, cw.halfW, cw.top, cw.bot);
    S.cowl.tAt = x => Math.max(0, Math.min(1, (0 - x) / len));
    // What the cowl covers, reported rather than enforced: a cowl is not obliged
    // to enclose its engine (a Cub's cylinders stick out), but the player should
    // be told which it is instead of finding out by looking at a collapsed nose.
    //
    // Measured at EACH PART'S NARROWEST STATION, not at the nose and not at the
    // block's midpoint. The cover is a loft: widest at the firewall, narrowest at
    // the nose. Comparing against the nose section says "engine out" for cowls
    // that visibly swallow the engine; comparing at the block's midpoint says
    // "enclosed" for a cylinder that pokes through 6 mm further forward, which is
    // exactly the disagreement with the mesh this started as.
    // So: the crankcase is checked where its FORWARD face is, and the cylinders
    // where the FORWARD one of them is — through the same shrink-aware section
    // function the floor above solved with.
    const sCase = cw.secAt(cw.tAt(E.xF)), sCyl = cw.secAt(cw.tAt(S.engX + 0.01 * E.k));
    cw.atEngine = sCase;
    cw.covers = {
      above: sCase.yHi >= S.engY + E.halfH - 1e-6,
      below: sCase.yLo <= S.engY - E.halfH + 1e-6,
      sides: sCyl.halfW >= E.cylReach - 1e-6,
    };
    cw.enclosed = cw.covers.above && cw.covers.below && cw.covers.sides;
  }
  // Two constraints, and the gear has to satisfy BOTH: the propeller must clear
  // the ground, and the legs must be long enough to be stiff. Prop clearance
  // alone gave a tiny prop a tiny undercarriage, and the aeroplane squatted
  // onto its own floor (measured with the model-aircraft outrunner).
  put(S.gear, 'legDrop', GEN_RULES.legDrop, 'gear.legDrop');
  // twLeg is NOT resolved here. A tailwheel's default is a constant, but a
  // nosewheel's is only knowable once the wheelbase is — same reason gear.x and
  // gear.track are placed by genFrame on its second pass. Left null it keeps
  // each type's own derivation; set, it is the leg length for both.
  // the two gear types are certificated to different clearances, so they get
  // different ones here rather than sharing the stricter
  const clearReq = S.gear.type === 'tricycle' ? GEN_RULES.propClearNose
                                              : GEN_RULES.propClear;
  const byProp = S.engY - propR + S.gear.contactR - clearReq;
  const byLeg = -0.02 - S.gear.legDrop;
  // WHICH ONE BOUND IT, published because otherwise the legDrop slider looks
  // broken. min() picks the LOWER axle, i.e. the LONGER leg, so a legDrop
  // shorter than prop clearance demands changes nothing at all — measured, on
  // the default aeroplane the prop wants 0.76 m and anything under that is
  // silently ignored. The prop keeps winning on purpose: a leg the player
  // shortened into a prop strike is not a bad aeroplane, it is a broken one on
  // the first landing.
  S.gear.yBoundBy = byProp <= byLeg ? 'prop clearance' : 'legDrop';
  put(S.gear, 'y', Math.min(byProp, byLeg), 'gear.y');
  return { spec: S, auto };
}

if (typeof module !== 'undefined' && typeof exports !== 'undefined') { /* concat build: no-op */ }
// THE BODY LOFT — one curve, sampled.
//
// This module owns the fuselage's SHAPE. It exists because the shape used to be
// owned by two different interpolants that met at station 1 with no continuity
// condition between them, and the meeting point is the crank the whole rework is
// about (63_gen_skin.js:544-565, now deleted):
//
//   - bay 0 held the cowl deck flat, then climbed the entire windscreen rise
//     over `windRun`, arriving at station 1 on a ~49 degree slope;
//   - bays >= 1 used a Catmull-Rom whose every sample was CLAMPED into its own
//     bay's endpoint interval, so wherever two consecutive stations shared a
//     value — always true for `yt` and `w` across the cabin — the "smoothed"
//     curve collapsed to a dead flat.
//
// Measured with tools/loft_fit.js on the stock preset, the deck-line slope went
// 0.009 -> 1.633 -> 0.418 across two adjacent vertex rows. The reference meshes
// do nothing of the kind. The C172's envelope through the windshield is
// 1.598 -> 1.660 -> 1.857 -> 1.949 -> 1.998 -> 2.002, monotone and smooth: its
// skin has a HOLE there and the glass fills it. The PA-18 does have a visible
// hard edge at its windscreen bow, but its envelope is monotone too — that edge
// is a CREASE IN THE SURFACE NORMAL at a real frame tube, not a discontinuity in
// the station curve.
//
// So the two things were conflated, and they are separated here: the curve is
// always smooth, and a station may additionally be TAGGED to crease, which
// splits normals without moving a single vertex.
//
// THE RULE THAT MAKES THE CRANK UNREPRESENTABLE: there is exactly one curve, and
// both the truss and the covering are samples of it. No code path can produce a
// slope jump at a station that is not tagged.

// ---------------------------------------------------------------------------
// 1. the section
// ---------------------------------------------------------------------------
// Asymmetric superellipse |z/w|^n + |y/h|^n = 1, with n independent above and
// below the waterline.
//
// It replaces genRing's per-angle LINEAR BLEND between an axis-aligned rectangle
// and an ellipse. That blend had a defect nobody had named: the rectangle's
// radius min(halfD/|cy|, halfW/|cz|) has a derivative discontinuity at each of
// its four corners, so for ANY crown < 1 the blend inherited four C1 breaks
// around EVERY ring — at the default crownSide 0.07 the belly and sides were
// essentially a creased rectangle running the whole length of the aeroplane.
// The superellipse has no corners at any finite n, so those go for free.
//
// It also subsumes both ends of the old blend exactly:
//   n = 2        -> the ellipse
//   n -> large   -> the rectangle (t -> 1/max(|cy|,|cz|), which IS genRing's s)
//
// theta 0 = top, +pi/2 = +z side, pi = bottom — genRing's convention, unchanged.
const GEN_N_ELL = 2;      // n of a true ellipse
const GEN_N_BOX = 14;     // beyond this a 40-gon ring cannot tell it from a box

// THE SECTION, waist-relative. This is the one to use.
//
// A station is NOT a symmetric shape about the mid-height between belly and
// deck. It is a WAISTLINE — the widest line of the body, which on a real tube
// fuselage is the top longeron and on a moulded one is the sill — with an upper
// surface rising off it and a lower surface hanging below it. The two are
// independent.
//
// The version this replaces centred the section on yc = (yb+yt)/2 and gave it
// one half-depth both ways, so the widest line of the aeroplane was a BY-PRODUCT
// of the deck and belly rather than a designed curve. Through the windscreen,
// where yt climbs 0.30 m, yc climbed 0.15 m with it — so the body's waist rode
// up over the cabin and back down again. That is a large part of what read as
// the model being bastardized around the windshield, and no amount of smoothing
// yt could fix it, because the waist was never a degree of freedom.
//
// WHY THE SPLIT IS FREE. A superellipse has a VERTICAL TANGENT at its equator
// for any n > 1: differentiating |y/h|^n + |z/W|^n = 1 gives dz/dy = 0 at y = 0.
// So the upper and lower quadrants meet the waist vertically whatever their
// exponents are, and the section is C1 across the waist BY CONSTRUCTION. No
// blend, no smoothstep, no shared half-depth. A chine, if one is ever wanted, is
// then something you must add deliberately rather than something you must avoid.
//
// yUp / yDn are measured FROM THE WAIST (both positive). Returns [dy, dz]
// relative to the waist plane. theta 0 = top, +pi/2 = +z side, pi = bottom.
function genSect(theta, halfW, yUp, yDn, nTop, nBot) {
  const cy = Math.cos(theta), cz = Math.sin(theta);
  const up = cy >= 0;
  const h = Math.max(1e-5, up ? yUp : yDn);
  const n = Math.max(1.2, Math.min(GEN_N_BOX, up ? nTop : nBot));
  const a = Math.abs(cy), b = Math.abs(cz);
  const t = Math.pow(Math.pow(a, n) + Math.pow(b, n), -1 / n);
  return [h * t * cy, halfW * t * cz];
}

// Symmetric superellipse about the section centre. Retained because the cowl,
// the tail cone cap and the legacy genRing wrapper all want a shape that is the
// same above and below; new work should prefer genSect.
function genSuper(theta, halfW, halfD, nTop, nBot) {
  const cy = Math.cos(theta), cz = Math.sin(theta);
  // THE EXPONENT IS BLENDED, NOT THE RADIUS, and it is blended with a smoothstep
  // rather than genRing's max(0, cy).
  //
  // At the waterline cy = 0, so |cy|^n = 0 for any n and the RADIUS is already
  // continuous under a hard switch — but its derivative is not, which is exactly
  // the "crown steps at the waterline" trap HANDOVER records. max(0, cy) is C0
  // there and leaves a shallow version of the same step. A smoothstep has zero
  // derivative at cy = 0, so the upper and lower halves meet C1 by construction.
  const s = Math.max(0, cy);
  const f = s * s * (3 - 2 * s);
  const n = Math.max(1.2, nBot + (nTop - nBot) * f);
  const a = Math.abs(cy), b = Math.abs(cz);
  // t scales the unit direction onto the superellipse. Guarded because a is 0 at
  // the waterline and b is 0 at the crown, and 0^n underflows for large n.
  const t = Math.pow(Math.pow(a, n) + Math.pow(b, n), -1 / n);
  return [halfD * t * cy, halfW * t * cz];
}

// ---------------------------------------------------------------------------
// 2. legacy compatibility
// ---------------------------------------------------------------------------
// `crownTop` / `crownSide` stay in the spec and keep their paths, so every saved
// build still loads; they are reinterpreted as exponents.
//
// Both constants are LEAST-SQUARES FITS of genSuper against the genRing it
// replaces, over theta at Cub-like proportions (halfW 0.42, halfD 0.34). Fitted
// pairs, and what this rational form gives:
//
//   crown  0.00  0.07  0.25  0.35  0.50  0.72  0.85  1.00
//   fit    6.70  5.72  4.38  3.84  3.14  2.48  2.22  2.00
//   here   6.70  5.81  4.30  3.75  3.14  2.52  2.25  2.00
//
// The residual at crown = 0 is large (11% of halfD) and that is the POINT: a
// true rectangle has sharp corners and no finite n reproduces them. Not
// reproducing them is the fix.
//
// Note what the defaults mean once read this way, because it is the argument for
// the whole asymmetric-exponent design: the Cub is crownTop 0.72 / crownSide
// 0.07, i.e. a ROUND TURTLEDECK (n 2.5) on a FLAT-SIDED BOX (n 5.8). The C172,
// measured off assets/c172/c172.obj, is the inverse — a flat roof (n ~5) on a
// rounded belly (n ~2.5). One symmetric roundness knob cannot express both.
const genCrownToN = crown => {
  const c = Math.min(1, Math.max(0, crown));
  return GEN_N_ELL + (GEN_N_BOX - GEN_N_ELL) * 0.392 * (1 - c) / (1 + 2.12 * c);
};

// genRing scaled the rounded former up by 1 + 0.15*crown so formers stand a
// little proud of the truss. Fitted against the same sweep, the equivalent under
// a superellipse is quadratic rather than linear (fit: 1.000 1.000 1.000 1.005
// 1.025 1.070 1.105 1.150 for the crowns above).
const genCrownScale = crown => {
  const c = Math.min(1, Math.max(0, crown));
  return 1 + 0.15 * c * c;
};

// ---------------------------------------------------------------------------
// 3. one monotone C1 curve
// ---------------------------------------------------------------------------
// Fritsch-Carlson monotone cubic Hermite, per key, with NO clamp.
//
// WHY NOT THE CLAMP IT REPLACES. The old code limited the VALUE — every sample
// forced into [min(p1,p2), max(p1,p2)] — which annihilates the tangent whenever
// two consecutive stations are equal. Fritsch-Carlson limits the TANGENT into
// the monotonicity region instead. It still cannot overshoot (that is the
// theorem, and overshoot — "a bulge behind the cabin" — is what the clamp was
// written to prevent), but it only zeroes a tangent at a genuine local extremum
// in the data. Everywhere else it carries the three-point slope.
//
// One honest consequence to know about: at a genuine extremum, such as the deck
// peak over the cabin, the tangent IS zero. That is correct and C1, but it reads
// flat — which is why the station set carries a `seatBack` control point, to
// give the roof somewhere to start falling from.
function genMonoSpline(xs, ys, tanK) {
  const n = xs.length;
  if (n < 2) return () => (ys[0] || 0);
  const d = new Array(n - 1), m = new Array(n);
  for (let i = 0; i < n - 1; i++)
    d[i] = (ys[i + 1] - ys[i]) / Math.max(1e-9, xs[i + 1] - xs[i]);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = 0.5 * (d[i - 1] + d[i]);
  // Fritsch-Carlson: flatten across a plateau, then bound the rest into the
  // circle of radius 3 that guarantees monotonicity
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(d[i]) < 1e-12) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i];
    // a sign flip means this station is a local extremum: pin it
    if (a < 0) m[i] = 0;
    if (b < 0) m[i + 1] = 0;
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      m[i] = tau * a * d[i];
      m[i + 1] = tau * b * d[i];
    }
  }
  // a station may ask for a softer or harder tangent (this is what wsCurve
  // becomes: a multiplier at the windscreen's two ends, not an ad-hoc power)
  if (tanK) for (let i = 0; i < n; i++) if (tanK[i] != null) m[i] *= tanK[i];
  return x => {
    if (x <= xs[0]) return ys[0] + m[0] * (x - xs[0]);
    if (x >= xs[n - 1]) return ys[n - 1] + m[n - 1] * (x - xs[n - 1]);
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const md = (lo + hi) >> 1; if (xs[md] <= x) lo = md; else hi = md; }
    const h = xs[hi] - xs[lo], t = (x - xs[lo]) / Math.max(1e-9, h);
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[lo] + (t3 - 2 * t2 + t) * h * m[lo]
         + (-2 * t3 + 3 * t2) * ys[hi] + (t3 - t2) * h * m[hi];
  };
}

// stations: [{x, w, yb, yt, nTop, nBot, role, crease, truss, tan}]
// -> a curve that can be sampled at ANY x, by both the truss and the covering.
function genBodyCurve(stations) {
  const st = stations.slice().sort((a, b) => a.x - b.x)
    // yw is the WAISTLINE — the widest line of the body, and the master curve of
    // the section. A station that does not declare one falls back to the old
    // mid-height, which is a by-product rather than a design; declare it.
    .map(s => (s.yw == null ? { ...s, yw: 0.5 * (s.yb + s.yt) } : s))
    // yd is the COWL DECK line — the upper surface forward of the windscreen,
    // carried the whole length as if the cowl ran all of it. A body with no
    // windscreen (a drone, a boom) simply has yd = yt and no transition.
    .map(s => (s.yd == null ? { ...s, yd: s.yt } : s));
  const xs = st.map(s => s.x);
  const tanK = st.map(s => (s.tan == null ? null : s.tan));
  const K = ['w', 'yb', 'yw', 'yd', 'yt', 'nTop', 'nBot'];
  const f = {};
  for (const k of K) f[k] = genMonoSpline(xs, st.map(s => s[k]), tanK);
  const at = x => {
    const o = { x };
    for (const k of K) o[k] = f[k](x);
    // exponents are shape, not geometry: keep them in the range the section
    // function can actually evaluate however the spline wanders
    o.nTop = Math.min(GEN_N_BOX, Math.max(1.2, o.nTop));
    o.nBot = Math.min(GEN_N_BOX, Math.max(1.2, o.nBot));
    o.w = Math.max(1e-4, o.w);
    // the waist may not cross the surfaces it separates
    o.yw = Math.min(Math.min(o.yt, o.yd) - 1e-4, Math.max(o.yb + 1e-4, o.yw));
    return o;
  };
  return {
    at, stations: st,
    x0: xs[0], x1: xs[xs.length - 1],
    roleAt: r => st.find(s => s.role === r) || null,
    roleX: r => { const s = st.find(s2 => s2.role === r); return s ? s.x : null; },
    creaseX: st.filter(s => s.crease).map(s => s.x),
  };
}

// ---------------------------------------------------------------------------
// 4. rows
// ---------------------------------------------------------------------------
// Every control station gets a row, so a crease and a truss ring always land
// exactly on one; between them, subdivide to about GEN_LSTEP metres.
//
// This is what replaces GEN_LSEG's fixed slices-per-bay. A fixed count spends
// the same number of rows on a 0.15 m windscreen and a 0.9 m tail bay, which is
// backwards: the rows are wanted where the curvature is.
const GEN_LSTEP = 0.16;
const GEN_LSEG_MIN = 1;
const GEN_LSEG_MAX = 6;

function genBodyRows(curve) {
  const st = curve.stations, rows = [];
  for (let i = 0; i < st.length - 1; i++) {
    const a = st[i], b = st[i + 1];
    const n = Math.max(GEN_LSEG_MIN,
              Math.min(GEN_LSEG_MAX, Math.round((b.x - a.x) / GEN_LSTEP)));
    for (let k = 0; k < n; k++)
      rows.push({ x: a.x + (b.x - a.x) * k / n, crease: k === 0 ? !!a.crease : false });
  }
  const last = st[st.length - 1];
  rows.push({ x: last.x, crease: !!last.crease });
  return rows;
}
// ===========================================================================
// GEN ENERGY (G97-G101) — WHERE THE ENERGY LIVES, AND HOW MUCH ROOM IT HAS.
// ===========================================================================
// `spec.fuel` has been `{ litres, tank }` over three bare names since the
// garage arc: no volume, no geometry, no station. The mass is billed once as
// `S.fuelL * 0.72` onto two nodes and never moves again, and 61_gen_frame's own
// comment admits it — "burn is not modelled, so this is the FULL-tanks case".
// Electric is worse: 00_registry excludes the battery from every motor row on
// purpose ("it is the fuel tank's analog, priced and weighed by the energy
// module"), so an EMRAX undercuts a Rotax because its energy is free.
//
// This file is that module. G97 lays the GEOMETRY it stands on: how much room
// there actually is, which is the question nothing in this project could
// answer.
//
// ---------------------------------------------------------------------------
// TWO INTERIORS, TWO MECHANISMS, AND THEY ARE NOT THE SAME KIND OF THING.
//
// THE FUSELAGE is a closed tube around a centreline, so its interior is a
// swept section of the real mesh: `tools/_bay_site.js` sweeps the `lv` rail
// from keel to roof through `fieldHits` and takes the wall off along the edge
// normals. Mesh-derived, because the cage's shape is the player's and there is
// no formula for it.
//
// THE WING IS NOT A TUBE. `_fit_site.js` already says so of its own machinery
// ("faceOut is meaningless at x=3.7"), and the wing mesh is browser-only, so a
// gate could never measure it headlessly. But it does not need to: a wing's
// interior IS a formula. The structural bay is bounded by the two spars, whose
// chord fractions are declared in GEN_RULES and load-bearing already — the
// skin is lofted on them (`kOf = (xc - sparF)/(sparR - sparF)`) — and by the
// aerofoil, which for a 4-digit NACA is closed form. So the wing tank is
// computed, exactly, from numbers the spec already carries.
//
// That split is the honest one. Running a wing bay through the fuselage's
// section sweep would pass loudly and mean nothing.

// ---------------------------------------------------------------------------
// NACA 4-DIGIT HALF-THICKNESS, the standard polynomial. `xc` is the chord
// fraction, the return is a fraction of chord ABOVE the camber line.
//
// The 0.1015 tail coefficient is the OPEN-TRAILING-EDGE form. The closed form
// uses 0.1036, and the difference is under a tenth of a per cent of the bay
// area — but the open one is what the aerofoil tables are quoted from, and
// 63_gen_wing lofts an open trailing edge, so this agrees with the wing that
// is actually built rather than with a tidier number.
function genNacaT(naca, xc) {
  const t = ((naca | 0) % 100) / 100;      // last two digits: thickness ratio
  const x = xc < 0 ? 0 : xc > 1 ? 1 : xc;
  return 5 * t * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * x * x
                  + 0.2843 * x * x * x - 0.1015 * x * x * x * x);
}

// The area between two chord fractions, as a fraction of chord SQUARED.
// Simpson over the pair of surfaces; camber cancels, because a 4-digit camber
// line displaces both surfaces equally and the enclosed area does not care.
// n is even so Simpson is exact for the cubic part and near-exact for the sqrt.
function genAerofoilArea(naca, cLo, cHi, n) {
  const N = Math.max(4, (n || 40) & ~1);
  const lo = Math.max(0, Math.min(cLo, cHi)), hi = Math.min(1, Math.max(cLo, cHi));
  if (!(hi > lo)) return 0;
  const h = (hi - lo) / N;
  let s = 0;
  for (let i = 0; i <= N; i++) {
    const w = (i === 0 || i === N) ? 1 : (i % 2 ? 4 : 2);
    s += w * 2 * genNacaT(naca, lo + h * i);      // x2: upper AND lower
  }
  return s * h / 3;
}

// ---------------------------------------------------------------------------
// THE WING BAY. Volume between the spars, over a span fraction, both wings.
//
// TAPER IS WHY THIS IS AN INTEGRAL AND NOT A MULTIPLICATION. Area goes as
// chord SQUARED, so a tapered panel's bay volume is nothing like its mean
// chord times its length — a 0.5-taper wing's outer half holds barely a third
// of what a rectangular one would. Getting that wrong would make outboard
// tanks far too generous, which is exactly the placement a player reaches for
// when the CG is too far aft.
//
// `wall` is the structural skin depth in METRES, taken off all round. It does
// NOT scale with the aeroplane: 3 mm of ply is 3 mm on any wing, the same rule
// the crew layer states and the same one GATE ENERGY caught being broken in
// the fuselage sweep.
//
// Returns LITRES for the pair. `fill` is the usable fraction of the geometric
// bay — ribs, spar webs, the bladder's own folds and the fact that a tank is
// not the whole bay. 0.72 is the wet-wing figure the light-aircraft literature
// supports; a bladder cell is lower and its catalogue row says so.
function genWingBay(wing, opt) {
  const o = opt || {};
  const naca = wing.naca || 2412;
  const cLo = o.cLo === undefined ? GEN_RULES.sparFront : o.cLo;
  const cHi = o.cHi === undefined ? GEN_RULES.sparRear : o.cHi;
  const fLo = Math.max(0, o.spanLo === undefined ? 0.12 : o.spanLo);
  const fHi = Math.min(1, o.spanHi === undefined ? 0.55 : o.spanHi);
  const wall = o.wall === undefined ? 0.003 : o.wall;
  const fill = o.fill === undefined ? 0.72 : o.fill;
  if (!(fHi > fLo)) return 0;

  const semi = (wing.span || 0) / 2;
  const root = wing.chord || 0;
  const taper = wing.taper === undefined ? 1 : wing.taper;
  const kArea = genAerofoilArea(naca, cLo, cHi);
  if (!(semi > 0) || !(root > 0) || !(kArea > 0)) return 0;

  // chord at span fraction f, and the bay's own perimeter shrunk by the wall.
  // The wall is removed as a fraction of the local section rather than by
  // offsetting the aerofoil: at 3 mm on a 1.6 m chord that is a 1.5% effect,
  // and offsetting a NACA section properly is a curve-offset problem this does
  // not need. The approximation is documented rather than hidden, and it errs
  // SMALL (it removes a band all round a shape that is thinner than its
  // bounding box), which is the safe direction for a tank.
  const N = 40;
  let v = 0;
  for (let i = 0; i < N; i++) {
    const f0 = fLo + (fHi - fLo) * (i / N);
    const f1 = fLo + (fHi - fLo) * ((i + 1) / N);
    const a = f => {
      const c = root * (1 + (taper - 1) * f);
      const th = genNacaT(naca, 0.30) * 2 * c;           // bay depth, near max
      const w = (cHi - cLo) * c;
      const gross = kArea * c * c;
      if (th <= 2 * wall || w <= 2 * wall) return 0;
      return gross * (1 - 2 * wall / th) * (1 - 2 * wall / w);
    };
    const A0 = a(f0), A1 = a(f1);
    // the conical rule again: a tapered bay is similar sections at different
    // scales, which is what this rule is exact for
    v += (f1 - f0) * semi * (A0 + A1 + Math.sqrt(A0 * A1)) / 3;
  }
  return v * 2 * 1000 * fill;      // both wings, m^3 -> litres, usable
}

// ---------------------------------------------------------------------------
// THE BAYS. Where a vessel is allowed to live.
//
// A BAY IS NOT A STATION, IT IS A REGION, and it is declared in the coordinate
// the airframe already speaks: `sL` metres aft of the firewall for the body
// (0 at the windscreen base, positive aft, which is the datum G49 settled and
// GEN_ACCESS already places against), span fraction for the wing.
//
// `on` picks the mechanism: 'body' bays are measured off the cage mesh by
// `_bay_site.js`, 'wing' bays are computed by `genWingBay`. Nothing else is a
// bay — a vessel hung in the breeze is not a design, it is a mistake, and the
// fittings arc's rule applies here too: no bay, no tank.
const GEN_BAYS = {
  nose: {
    name: 'Nose bay', on: 'body',
    serves: 'ahead of the panel, behind the firewall',
    sL: [-0.95, -0.05],
    // the Cub's twelve gallons, and the Velis Electro's forward pack. It is
    // the only bay that is ABOVE the carburettor on most layouts, which is
    // what makes gravity feed possible at all.
    feed: 'gravity',
  },
  cabin: {
    name: 'Cabin', on: 'body',
    serves: 'around the occupants — the motorglider case',
    sL: [0.05, 1.30],
    // FREE WITHIN THE BAY on purpose: this is the one the user named, where
    // "you would put them really wherever they fit". The clearance test
    // against the crew does the work a fixed station cannot.
    free: true, feed: 'pumped',
  },
  underFloor: {
    name: 'Under the floor', on: 'body',
    serves: 'below the floorboards, between the spar carry-throughs',
    sL: [0.10, 1.10], lv: [0, 1],
    // a structural floor pack, the Alice layout. Low and near the CG: the
    // best place to put mass and the worst to get fuel out of by gravity.
    feed: 'pumped',
  },
  aftCabin: {
    name: 'Behind the cabin', on: 'body',
    serves: 'aft of the rear bulkhead',
    sL: [1.30, 2.20],
    // the Velis Electro's aft pack. Bracketing the CG with two packs is
    // deliberate on the real aeroplane and should be discoverable here.
    feed: 'pumped',
  },
  wingRoot: {
    name: 'Wing root', on: 'wing',
    serves: 'the inboard spar bay',
    span: [0.12, 0.55], feed: 'pumped',
  },
  wingPanel: {
    name: 'Outboard panel', on: 'wing',
    serves: 'the outboard spar bay — relieves the spar, slows the roll',
    span: [0.55, 0.88], feed: 'pumped',
  },
};
// ============================================================
// GARAGE 2/5 — the FRAME. Resolved spec -> named node/beam lattice.
//
// This file is where the HANDOVER "STRUCTURAL RULES (each one paid for in
// blood)" live. They are enforced by construction here so that no generated
// airframe can omit one; the numbered comments below cite the rule they serve.
// Nothing downstream may relax them.
//
// The lattice is also the surface: 63_gen_skin.js reads the same stations and
// bays this file emits, so structure and skin cannot disagree. `parts` is that
// shared contract.
//
// Node tags match the hand-written fiches exactly (WF/WR/ENG/AXLE/TW/HT/FIN/
// TPB/TPT), because the solver, the skin binding, the shadow proxy and the
// gate harness all key off them.
// ============================================================

function genQuadArea(P, a, b, c, d) {
  const tri = (i, j, k) => {
    const ux = P[j][0]-P[i][0], uy = P[j][1]-P[i][1], uz = P[j][2]-P[i][2];
    const vx = P[k][0]-P[i][0], vy = P[k][1]-P[i][1], vz = P[k][2]-P[i][2];
    return 0.5 * Math.hypot(uy*vz-uz*vy, uz*vx-ux*vz, ux*vy-uy*vx);
  };
  return tri(a, b, c) + tri(a, c, d);
}

// One pass of the lattice. gearX/track are supplied by genFrame on the second
// pass once the CG is known (see the gear section).
function genLattice(S, gearX, track, kScale) {
  const M = GEN_MATERIALS[S.material];
  // THE PART'S OWN CONSTRUCTION REACHES THE STRUCTURE (G116 mass + price,
  // G117 stiffness + damping — the user: "carbon should cost", then
  // "WYSIWYG is the rule"). `wing.material` / `tail.finMaterial` /
  // `tail.stabMaterial` are additive spec fields (absent = the aeroplane's
  // own), and the section material below follows the ledger's own marker:
  // the wing's members weigh, cost, FLEX and damp as what the wing is built
  // from. See B()'s note for why G116's mass move made the k/c coupling
  // safe to take. A V-TAIL IS ONE SURFACE and takes the stab's material:
  // it IS the horizontal tail, raked; there is no fin to build.
  const MSEC = {
    wings: GEN_MATERIALS[S.wing && S.wing.material] || M,
    tail:  GEN_MATERIALS[S.tail && S.tail.stabMaterial] || M,
  };
  let MB = M;                                   // what the open section BILLS
  const KS = kScale || 1;                       // structure sized for the mass
  const ARCH = GEN_SUSPENSION[S.gear.suspension] || GEN_SUSPENSION.bungee;
  const SUS = (S.gear.stiffness == null ? 1 : S.gear.stiffness) * ARCH.k;
  // Damping does NOT scale with stiffness the way stiffness does. Critical
  // damping is 2*sqrt(k*m), so at constant mass c goes as sqrt(k) — scaling it
  // linearly with the suspension knob piles damping onto the axle node until
  // sum(c)*dt/m passes 1 and the explicit integrator blows up. Measured: at
  // stiffness 3 the gear pinned at 100% strain and stayed there, which reads
  // exactly like a structural collapse and is nothing of the kind.
  // The archetype's damping is DESIGNED, not derived — an oleo really does damp
  // far harder than a bungee — so it multiplies directly. Only the player's
  // stiffness knob follows sqrt(k), since that is a change to one spring.
  // THE KNOB SOFTENS THE SPRING, NOT THE BRACING. It used to scale every gear
  // member, so turning the suspension down softened the drag braces and the
  // belly cross-bracing with it and the undercarriage FOLDED: measured, at 0.6x
  // the aeroplane settled on its belly with the axle 0.75 m in the air, fully at
  // rest, 1.4% strain — rule 1's snap-through, and no strain gate can see it.
  // The barrier was already that close: 1 kg more at the nose (G4.7's honest
  // prop mass) moved it from 0.6x standing at 8% strain to 0.6x folded.
  // Real gear behaves the way the split does: a soft spring gives long travel
  // and the drag brace is a tube either way. `vis === 'leg'` (see B, below) is
  // exactly the suspension member, which is why G4.6's visual work is what made
  // this expressible. IDENTICAL AT stiffness 1.0 for every archetype, which is
  // the whole default fleet — the split only opens up as the knob moves.
  const KG = KS * SUS;                       // the spring
  const KGB = KS * ARCH.k;                   // its bracing: archetype, no knob
  const CS = KS;
  const CG = KS * ARCH.c * Math.sqrt(S.gear.stiffness == null ? 1 : S.gear.stiffness);
  const CGB = KS * ARCH.c;
  const R = GEN_RULES;
  const D = Math.PI / 180;
  const nodes = [], beams = [];
  const P = [];                                     // positions, for area math
  const N = (x, y, z, tag, r = 0) => {
    nodes.push({ p: [x, y, z], m: 0, r, tag }); P.push([x, y, z]);
    return nodes.length - 1;
  };
  const NM = (x, y, z, tag, r = 0) =>
    [N(x, y, -Math.abs(z), tag + 'L', r), N(x, y, Math.abs(z), tag + 'R', r)];
  // ext = the member is OUTSIDE the covering (struts, gear legs). It stays
  // visible when the aeroplane is covered; everything else disappears under
  // the fabric, which is what the Frame/Covered view modes key off.
  //
  // vis = HOW it is drawn, and it never touches the physics. The undercarriage
  // needs this: the truss the solver wants is not the hardware a real
  // aeroplane wears, and the report was "the tailwheel has too many struts"
  // with "keep the physical model" attached to it. So a member can be a wire
  // instead of a 48 mm tube, or be declared INTERNAL and drop out of the
  // covered view while still standing in Frame mode — which is honest, because
  // Frame mode's whole job is to show the structure that was welded.
  //   null    hexagonal tube, as before
  //   'wire'  thin bracing wire or tie rod
  //   'leg'   the suspension leg — drawn as bungee / spring / oleo (63)
  //   'inner' structural, but inside the covering: goes in the frame mesh
  const B = (a, b, cls, ext, vis) => {
    const L = Math.hypot(P[b][0]-P[a][0], P[b][1]-P[a][1], P[b][2]-P[a][2]);
    const isG = cls === 'gear';
    // GEN_RULES.wingK: the wing class is x19 softer than the cap its own mass
    // already buys. See the constant for the measurements and the substep
    // trade. Damping is NOT scaled with it — a stiffer structure at the same c
    // is a more lightly damped one, which is what a real one does, and c is not
    // what binds the timestep here.
    const kGain = cls === 'wing' ? (R.wingK ?? 1) : 1;
    // a gear member is either the SPRING (vis 'leg') or its bracing
    const kG = vis === 'leg' ? KG : KGB, cG = vis === 'leg' ? CG : CGB;
    // MB THROUGHOUT (G117, the user: "WYSIWYG is the rule"): a member is
    // stiff, damped, heavy and priced as WHAT THE SECTION IS BUILT FROM —
    // G116 coupled the mass and the money and deliberately left k/c on the
    // aeroplane's own calibration; G117 finished it, and G116's own mass
    // move is what made that safe: with lin AND k from the same material,
    // a carbon wing's stiffness-to-mass ratio in a MIXED build equals the
    // all-carbon aeroplane's wing — a corner the FLEX matrix already flies.
    // The aeroplane-level scalings (KS from the global refMass, wingK, the
    // gear archetype) stay exactly where they were.
    beams.push({ a, b, k: MB.k[cls] * (isG ? kG : KS) * kGain,
                 c: MB.c[cls] * (isG ? cG : CS),
                 gear: isG, cls, ext: vis === 'inner' ? false : (!!ext || isG),
                 vis: vis || null, L });
    // structural mass: linear density x length, half to each end (this is the
    // whole structural mass model — there is no separate mass budget to keep
    // in sync with the geometry)
    const h = 0.5 * L * MB.lin[cls];
    nodes[a].m += h; nodes[b].m += h;
    bill(2 * h, 2 * h * MB.price);
  };
  // ---- the LEDGER (G3). Mass and money, attributed to the section being built
  // rather than reconstructed afterwards. `SEC` is a moving marker because this
  // file is already written component by component; tagging every call site
  // would be noise. Structure is priced by its own mass; things that are BOUGHT
  // rather than built (engine, wheels, instruments, paint) call spend().
  const ledger = {};
  let SEC = 'fuselage';
  // WHAT IS THE AEROPLANE AND WHAT IS THE LOAD. `pt()` bills crew, fuel and
  // freight into the same node masses the structure uses — it has to, the
  // solver flies the sum — so the ONLY place the two can be told apart is here,
  // by which section was open when the mass was billed. Naming the PAYLOAD
  // sections rather than the empty ones is deliberate: a component added later
  // and never classified then lands in the empty weight, where it is visible,
  // instead of vanishing into a payload figure nobody reads.
  // The flag rides on the ENTRY rather than in a list the rollup keeps, for the
  // same reason `cover` lives in the skin payload (63_gen_skin.js): the thing
  // that billed the mass knows what it was, and a list maintained anywhere else
  // goes stale the first time a section is added.
  const PAYLOAD_SECS = { cabin: 1, fuel: 1, cargo: 1 };
  const bill = (mass, cost) => {
    const e = ledger[SEC] ||
      (ledger[SEC] = { mass: 0, cost: 0, payload: !!PAYLOAD_SECS[SEC] });
    e.mass += mass || 0; e.cost += cost || 0;
  };
  // ...and the section marker is ALSO the billing-material switch (G116):
  // one coupling point, so bracing, gear and everything after the wing reset
  // to the aeroplane's own material without a call site to forget.
  const sec = s => { SEC = s; MB = MSEC[s] || M; };
  const spend = c => bill(0, c);
  const cover = (area, ids) => {
    const m = area * MB.cover;
    const per = m / ids.length;
    for (const i of ids) nodes[i].m += per;
    bill(m, m * MB.price);
  };
  const pt = (i, m) => { nodes[i].m += m; bill(m, 0); };

  // ---- 1. fuselage stations ------------------------------------------
  // rings 0..2 are firewall / cabin front / cabin rear; the rest are evenly
  // spaced to the tail. The cabin rings are pinned because the wing spars and
  // the seats attach to them.
  const cab = S.cab, fu = S.fuse;
  const SHP = GEN_SHAPES[fu.shape] || GEN_SHAPES.straight;
  const cabRear = cab.noseGap + cab.len;
  const boxRear = fu.boxRear;                 // cabin + cargo bay: full section
  const xs = [0, cab.noseGap, cabRear];
  if (boxRear > cabRear + 1e-6) xs.push(boxRear);
  for (let i = 1; i <= fu.tailBays; i++)
    xs.push(boxRear + (fu.tailArm - boxRear) * i / fu.tailBays);
  // G54.1: when the join measured the boom PROFILE, the aft stations take
  // their section from it, row-interpolated by the same normalised t — the
  // built boom's own heights, section by section, instead of the family
  // exponent. The user's prescription verbatim: mains fixed, tailwheel
  // measured, "adjust the height of every section of the boom".
  const PROF = Array.isArray(fu.profile) && fu.profile.length >= 2
             ? fu.profile : null;
  const profAt = t0 => {
    let a = PROF[0], b = PROF[PROF.length - 1];
    if (t0 <= a.t) b = PROF[1];
    else if (t0 >= b.t) a = PROF[PROF.length - 2];
    else for (let i = 1; i < PROF.length; i++)
      if (PROF[i].t >= t0) { b = PROF[i]; a = PROF[i - 1]; break; }
    const u = Math.max(0, Math.min(1,
      (t0 - a.t) / Math.max(1e-6, b.t - a.t)));
    return { w: a.w + (b.w - a.w) * u, yb: a.yb + (b.yb - a.yb) * u,
             yt: a.yt + (b.yt - a.yt) * u };
  };
  const ST = xs.map(x => {
    if (x <= boxRear) {
      // G54.3: the ring AT the box end takes the measured profile's first
      // row when there is one — the built belly can already be sweeping up
      // at the passenger pillar, and the full-box default dipped below it
      // (user: "still one fitting issue around the passenger pillar").
      if (PROF && x >= boxRear - 1e-6) {
        const p = profAt(0);
        return { x, w: p.w, yb: p.yb, yt: p.yt };
      }
      // firewall is slightly narrower and lower than the cabin (cowl line)
      const u = x / Math.max(1e-6, cab.noseGap);
      const f = x < cab.noseGap ? u : 1;
      // ring 0 is the firewall: its top is the COWL DECK, well below the cabin
      // roof, and the step between them is the windscreen (see 63_gen_skin.js)
      const deck = fu.cowlDeck;
      return { x, w: cab.halfW * (0.92 + 0.08 * f), yb: -0.02 * f,
               yt: cab.h * (deck + (1 - deck) * f) };
    }
    const t0 = (x - boxRear) / Math.max(1e-6, fu.tailArm - boxRear);
    if (PROF) { const p = profAt(t0); return { x, w: p.w, yb: p.yb, yt: p.yt }; }
    // the SHAPE FAMILY is the profile of the aft taper: an exponent on the
    // station fraction, so width, floor and deck all narrow together but on a
    // straight, late (waisted) or early (pod-and-boom) curve. See GEN_SHAPES.
    const t = SHP.taper === 1 ? t0 : Math.pow(t0, SHP.taper);
    return { x, w: cab.halfW + (fu.tailW - cab.halfW) * t,
             yb: -0.02 + (fu.tailBot + 0.02) * t,
             yt: cab.h + (fu.tailTop - cab.h) * t };
  });

  const F = ST.map((s, i) => {
    const [BL, BR] = NM(s.x, s.yb, s.w, `S${i}B`);
    const [TL, TR] = NM(s.x, s.yt, s.w, `S${i}T`);
    // rule 4: every quad panel needs its diagonal — the ring frame gets a
    // mirror-symmetric X so shear cannot fold it into a parallelogram
    B(BL, BR, 'fus'); B(TL, TR, 'fus'); B(BL, TL, 'fus'); B(BR, TR, 'fus');
    B(BL, TR, 'fus'); B(BR, TL, 'fus');
    return { BL, BR, TL, TR };
  });
  for (let i = 0; i < F.length - 1; i++) {
    const a = F[i], b = F[i + 1], alt = i % 2;
    B(a.BL, b.BL, 'fus'); B(a.BR, b.BR, 'fus');
    B(a.TL, b.TL, 'fus'); B(a.TR, b.TR, 'fus');
    // side-panel diagonals alternate direction bay to bay (a real welded
    // truss does this so the shear path zig-zags instead of running one way)
    B(alt ? a.BL : a.TL, alt ? b.TL : b.BL, 'fus');
    B(alt ? a.BR : a.TR, alt ? b.TR : b.BR, 'fus');
    B(a.TL, b.TR, 'fus'); B(a.TR, b.TL, 'fus');     // rule 4, top panel
    B(a.BL, b.BR, 'fus'); B(a.BR, b.BL, 'fus');     // rule 4, bottom panel
    // covering, four panels per bay, onto the bay's own corners
    const s0 = ST[i], s1 = ST[i + 1];
    cover(genQuadArea(P, a.TL, a.TR, b.TR, b.TL), [a.TL, a.TR, b.TR, b.TL]);
    cover(genQuadArea(P, a.BL, a.BR, b.BR, b.BL), [a.BL, a.BR, b.BR, b.BL]);
    cover(genQuadArea(P, a.TL, a.BL, b.BL, b.TL), [a.TL, a.BL, b.BL, b.TL]);
    cover(genQuadArea(P, a.TR, a.BR, b.BR, b.TR), [a.TR, a.BR, b.BR, b.TR]);
    void s0; void s1;
  }
  const last = F[F.length - 1], lastST = ST[ST.length - 1];
  // tail post: two centreline nodes. refs.tailMid points here, so rule 8
  // (attitude reference on RIGID structure) is satisfied by construction.
  const TPB = N(fu.postX, lastST.yb + 0.05, 0, 'TPB');
  const TPT = N(fu.postX, lastST.yt - 0.02, 0, 'TPT');
  B(TPB, TPT, 'fus');
  B(last.BL, TPB, 'fus'); B(last.BR, TPB, 'fus');
  B(last.TL, TPT, 'fus'); B(last.TR, TPT, 'fus');
  B(last.TL, TPB, 'fus'); B(last.TR, TPB, 'fus');
  cover(genQuadArea(P, last.TL, last.BL, TPB, TPT)
      + genQuadArea(P, last.TR, last.BR, TPB, TPT), [last.TL, last.TR, TPB, TPT]);

  // ---- 2. engine ------------------------------------------------------
  sec('engines');
  // G134: the resolved spec's own powerplant row — custom dials outrank the
  // registry preset; same shape either way (see resolveSpec's S.pplant).
  const PP = S.pplant || POWERPLANTS[S.engine];
  const [EL, ER] = NM(S.engX, S.engY, 0.55 * cab.halfW, 'ENG');
  B(EL, ER, 'fus');
  B(EL, F[0].TL, 'fus'); B(EL, F[0].BL, 'fus'); B(EL, F[0].BR, 'fus');
  B(ER, F[0].TR, 'fus'); B(ER, F[0].BR, 'fus'); B(ER, F[0].BL, 'fus');
  // The BLADES weigh what the spec says they weigh (S.prop.mass, derived from
  // diameter, blade count and material) rather than the old 2 kg per metre of
  // registry diameter. It lands on the mount nodes rather than at the hub, which
  // is 0.10 m further forward — worth 3 cm of CG on a 500 kg aeroplane with the
  // heaviest prop the clamps allow, and there is no node out there to hang it on.
  pt(EL, 0.5 * (PP.engine.mass + S.prop.mass));
  pt(ER, 0.5 * (PP.engine.mass + S.prop.mass));
  spend((PP.price || 0) * S.engines.length);
  spend(S.prop.price || 0);

  // ---- 3. wing --------------------------------------------------------
  sec('wings');
  const w = S.wing, G = S.geom;
  const zRoot = cab.halfW;
  // CRANK: a second wing section. The break gets its own spar station, because
  // it is a real joint — the outer panel bolts to the centre section there —
  // and because the dihedral changes across it, so a node has to exist at the
  // kink or the two panels would be joined by a straight member cutting the
  // corner. Only ONE crank: two sections, no more.
  const zCrank = w.crankAt > 0 ? zRoot + (G.semi - zRoot) * w.crankAt : 0;
  const zs = [];
  const ribZ = [];              // rib stations, metres from the centreline
  for (let i = 1; i <= w.panels; i++)
    zs.push(zRoot + (G.semi - zRoot) * i / w.panels);
  if (zCrank > 0) {
    zs.push(zCrank);
    zs.sort((a2, b2) => a2 - b2);
    // a station landing on top of the crank would give a zero-length bay
    for (let i = zs.length - 1; i > 0; i--)
      if (zs[i] - zs[i - 1] < 0.12) zs.splice(zs[i] === zCrank ? i - 1 : i, 1);
  }
  // the planform, tip bow included. One function, so the ribs, the covering,
  // the strips and the outline cannot disagree about where the wing is —
  // G140: and that one function is genPlanLaw's, shared with resolveSpec's
  // area/MAC/bow derivation, so the sheet and the structure agree too.
  const LAW = genPlanLaw(w, zRoot, G.semi);
  const linC = LAW.cAt;             // structural chord (box depth reads this)
  const chordAt = z => {
    if (!(w.tipR > 1e-6) || z <= w.tipZ) return LAW.cAt(Math.min(z, G.semi));
    const u = Math.min(1, (z - w.tipZ) / w.tipR);
    return w.tipC * Math.sqrt(Math.max(0, 1 - u * u));
  };
  const sparFront = R.sparFront, sparRear = R.sparRear;
  const sparSpacing = (sparRear - sparFront) * w.chord;
  const xF = w.xLE + sparFront * w.chord, xR = w.xLE + sparRear * w.chord;
  // THE SECTION WALK: both spars move together with the station's own
  // fore/aft offset — the legacy tan(sweep) line verbatim when the station
  // fields are null, the piecewise root->crank->tip walk when set. Measured
  // from the root either way, so the root rib, the strut anchor and the
  // carry-through stay exactly where they were.
  const xFat = z => xF + LAW.xoff(z);
  const xRat = z => xR + LAW.xoff(z);
  const dih = Math.tan(w.dihedral * D);
  const incAt = z => (w.incidence - w.washout * (z - zRoot) / Math.max(1e-6, G.semi - zRoot)) * D;
  // WHERE THE WING MEETS THE FUSELAGE. High sits on the top longerons, low
  // under the floor, mid through the cabin. `attach` is which longeron pair
  // carries it and `oppose` is the one the strut or the depth tie reaches to —
  // the strut on a low wing goes UP, not down.
  const POS = { high: 1, mid: 0.5, low: 0 }[w.position] ?? 1;
  const wingY0 = cab.h * POS
    + R.wingStandoff * (POS >= 0.75 ? 1 : POS <= 0.25 ? -1 : 0);
  const attachHi = POS >= 0.5, attachTag = attachHi ? 'T' : 'B';
  const opposeTag = attachHi ? 'B' : 'T';
  // a strut is only a brace if its anchor is far enough from the wing — see
  // GEN_RULES.strutMinOffset. Otherwise build the box instead.
  const strutOffset = Math.abs(wingY0 - (attachHi ? 0 : cab.h));
  // G140: A CRANKED WING CAN BE STRUT-BRACED — WHEN THE STRUT LANDS ON THE
  // CRANK. The 2026-08-11 exclusion stays true for what it measured: a fan
  // reaching PAST the crank read 22.95 deg @200 N.m at 1.34x (the worst
  // corner in the configuration space), and extending it re-rigged the
  // aeroelastics of strip-force nodes (rule 10) until the aeroplane stopped
  // completing a circuit. Nothing reaches past the crank now: the crank
  // station IS the strut station (the user's ruling — "constrain the crank
  // point to the strut if there's one, free if not"), the fan braces the
  // inner panel only, and the OUTER panel gets the cantilever box from the
  // crank outward — which is the C172's own construction, crank at the
  // strut. An uncranked strutted wing is byte-identical to before; a
  // cranked cantilever keeps its full box; the hybrid is measured by GATE
  // FLEX's new row, and the panel reports `strut + boxed outer` so the
  // construction is never silent.
  const useStrut = w.strut && strutOffset >= R.strutMinOffset;
  // dihedral is piecewise across the crank: flat (or shallow) inboard, steeper
  // outboard. Without a crank both halves use the same angle and this is the
  // straight line it always was.
  const dihOut = Math.tan((w.dihedralOut == null ? w.dihedral : w.dihedralOut) * D);
  const yF = z => {
    const base = wingY0 + S.place.wingDy;
    if (zCrank <= 0 || z <= zCrank) return base + (z - zRoot) * dih;
    return base + (zCrank - zRoot) * dih + (z - zCrank) * dihOut;
  };
  // which frames straddle a given station, so a component that moves finds new
  // ones to attach to instead of dragging its old ones along
  const straddle = x => {
    let f = 0;
    for (let i = 0; i < ST.length; i++) if (ST[i].x < x - 0.05) f = i;
    let a = Math.min(F.length - 1, f + 1);
    for (let i = 0; i < ST.length; i++) if (ST[i].x > x + 0.05) { a = i; break; }
    return [f, Math.max(a, Math.min(f + 1, F.length - 1))];
  };
  const nearestRing = x => {
    let best = 0, bd = 1e9;
    ST.forEach((s, i) => { const d = Math.abs(s.x - x); if (d < bd) { bd = d; best = i; } });
    return best;
  };
  const wf = { L: null, R: null };
  const mkWing = (s) => {
    // The wing owns its spar roots. They USED to be two fuselage frame nodes,
    // which is why the wing could not move: shifting it aft left the root on
    // the old frame while the outboard stations walked away from it. Now the
    // roots are the wing's own, and the loads go into the fuselage through a
    // carry-through that re-attaches to whichever frames straddle them.
    const rootF = N(xF, yF(zRoot), s * zRoot, 'WF');
    const rootR = N(xR, yF(zRoot) - sparSpacing * Math.tan(incAt(zRoot)), s * zRoot, 'WR');
    B(rootF, rootR, 'wing');                             // root rib
    // the strut braces from the longeron OPPOSITE the wing: down from a high
    // wing, up from a low one. Rule 1's barrier is the offset, not the direction
    const sd = s > 0 ? 'R' : 'L';
    // G59.2: THE LIFT STRUT LANDS ON THE CABIN LONGERON (user: "the truss
    // should get onto the main longerons of the cabin, at the bottom for
    // high wing, and at the top for low wings"). `nearestRing` alone could
    // pick a station AFT of the cabin — on a measured boom those rings are
    // already tapering, so the strut foot came out 0.23 m inboard and
    // 0.19 m above the cabin's own corner: hanging in air, attached to a
    // former instead of the structure. A lift strut is a primary member and
    // lands on the cabin box; clamp it to the last full-section ring.
    // STRICTLY forward of boxRear: since G54.3 the ring AT the box end
    // takes the measured profile's first row — the PAX PILLAR section,
    // which is already narrower and higher than the cabin. That is right
    // for the skin and wrong for a strut foot, and it is what put the
    // foot 0.23 m inboard of the cabin side. The cabin rings keep the
    // full cab.halfW section; land on the aft-most of those.
    const iBox = (() => {
      let r = 0;
      ST.forEach((s, i) => { if (s.x < boxRear - 0.01) r = i; });
      return r;
    })();
    const strutRoot = F[Math.min(nearestRing(xF), iBox)][opposeTag + sd];
    const side = attachTag + sd, other = attachTag + (s > 0 ? 'L' : 'R');
    // rule 3, box depth through the root: front and rear spars land on
    // DIFFERENT frames wherever the geometry allows, so the biggest moment in
    // the aeroplane has a couple arm instead of passing through a point.
    // The NEAREST frame matters as much as the straddling pair. straddle()
    // has a dead band, so a root sitting almost exactly over a frame gets the
    // two frames either SIDE of it and no direct tie to the one underneath —
    // the wing then hangs on long diagonals, is soft in torsion, and folds
    // through under full-deflection abuse at ~1% strain. That is rule 1's
    // snap-through, and it cost a red STRESS gate to find.
    const lo = opposeTag + sd;
    for (const [nd, x] of [[rootF, xF], [rootR, xR]]) {
      const [iA, iB] = straddle(x), iN = nearestRing(x);
      for (const i of [...new Set([iN, iA, iB])]) B(nd, F[i][side], 'wing');
      B(nd, F[iN][lo], 'wing');                          // full depth: rule 3
      B(nd, F[iN][other], 'wing');                       // lateral shear path
    }
    const WF = zs.map(z => N(xFat(z), yF(z), s * z, 'WF'));
    const WR = zs.map(z => N(xRat(z), yF(z) - sparSpacing * Math.tan(incAt(z)), s * z, 'WR'));
    const cF = [rootF, ...WF], cR = [rootR, ...WR];
    for (let i = 0; i < zs.length; i++) {
      B(cF[i], cF[i + 1], 'wing'); B(cR[i], cR[i + 1], 'wing');
      B(cF[i + 1], cR[i + 1], 'wing');                       // rib
      // rule 4 again: the wing plan bay is a quad and gets its diagonals
      B(cF[i], cR[i + 1], 'wing'); B(cR[i], cF[i + 1], 'wing');
      const zi = i === 0 ? zRoot : zs[i - 1], zo = zs[i];
      cover(1.9 * (zo - zi) * 0.5 * (chordAt(zi) + chordAt(zo)),
            [cF[i], cF[i + 1], cR[i], cR[i + 1]]);
      // ribs: one every 0.4 m of span, spruce/ply, hung on the two spars
      const nRib = Math.max(1, Math.round((zo - zi) / 0.4));
      const ribM = nRib * 0.5 * (chordAt(zi) + chordAt(zo)) * 0.30;
      pt(cF[i + 1], 0.5 * ribM); pt(cR[i + 1], 0.5 * ribM);
      // ...AND WHERE THEY ARE (G66). This loop has always known the rib
      // COUNT — it bills their mass — and thrown the stations away, so
      // anything that wanted to draw a rib tape had to guess: garage.js
      // carried GEN_RIBS = 13, which is right for the default Cub's
      // semispan and drifts on every other one. The pitch is the same 0.4 m
      // rule, read once, so the structure that pays for the ribs and the
      // surface that shows them cannot disagree.
      for (let k = 1; k <= nRib; k++) ribZ.push(zi + (zo - zi) * k / nRib);
    }
    let cFB = null, cRB = null;
    sec('bracing');
    // G140: where the visible strut lands. Uncranked: the first interior
    // station, exactly as always. Cranked: THE CRANK — the crank station is
    // the strut station now (zCrank was inserted into zs, so it is findable
    // by value), which is what keeps every brace member inboard of the break.
    // G153: a crank station that cannot be found is a BUG, not a root strut.
    // `Math.max(0, findIndex(...))` turned the -1 into station 0 — the
    // CENTRELINE — so a float mismatch in the 1e-9 compare would silently root
    // both lift struts at the fuselage and draw a plausible aeroplane with its
    // bracing attached to nothing. Latent today (zCrank is inserted into zs by
    // value, so it is always found), and latent is exactly when to fix it.
    // The honest fallback is the UNCRANKED rule: the first interior station,
    // which is where the strut goes on a wing with no break.
    const iCrank = zCrank > 0
      ? zs.findIndex(z2 => Math.abs(z2 - zCrank) < 1e-9) : -1;
    const iStrut = iCrank >= 0 ? iCrank : (WF.length > 1 ? 1 : 0);
    if (useStrut) {
      // rule 1: SPAR BOX ALWAYS. This wing has no full-depth box, so the
      // barrier against snap-through fold is the strut anchor a full cabin
      // height below the wing — the Cub geometry, and the only reason a
      // planar two-spar wing survives at all.
      // The two members to the strut station are the REAL lift struts and are
      // the only ones drawn; the rest of the fan is the lumped stand-in for a
      // spar box this planar wing does not have, so it lives under the fabric.
      B(strutRoot, WF[iStrut], 'wing', true);
      B(strutRoot, WR[iStrut], 'wing', true);
      // fan ends: station 0 always; the TIP pair only where the fan may
      // reach it — an uncranked wing (byte-identical emissions). On a
      // cranked wing nothing reaches past the crank; the outer panel's
      // stiffness is the box below.
      const ends = zCrank > 0
        // ...and when the crank IS station 0, the real struts already hold
        // it — a second pair would be the double-stiffness shape again
        ? (iStrut === 0 ? [] : [WF[0], WR[0]])
        : [WF[0], WR[0], WF[WF.length - 1], WR[WR.length - 1]];
      for (const t of ends)
        B(strutRoot, t, 'wing');
      // ...AND EVERY STATION IN BETWEEN (2026-08-11, GATE FLEX matrix).
      // The four lines above reach exactly three stations: 0, mid=1 and the
      // last. `wing.panels` is a PLAYER SLIDER clamped 2..5, so at 4 panels the
      // fan skips station 2 and at 5 panels it skips 2 AND 3 — those stations
      // hang between fan members on a planar two-spar wing with no box, which
      // is rule 1 with the barrier removed. Measured (static antisymmetric tip
      // couple, deg @200 N.m / doubling ratio, span 13 chord 1.6):
      //     panels 2   2.38   1.98x      panels 4   21.41   *** 1.56x
      //     panels 3   3.84   1.97x      panels 5   28.73   *** 1.46x
      // A doubling ratio under 2 means it stiffened geometrically on the way,
      // i.e. it started near a MECHANISM — and the rank test cannot see it,
      // because the framework is infinitesimally rigid the whole time. This is
      // the chinook wing's defect exactly (16.4 deg at 1.50x, cured the same
      // way), and it was reachable from the panel by moving one slider.
      // Appended rather than folded into the loop above so the emission ORDER
      // of the existing members is untouched: at panels <= 3 this adds nothing
      // and the whole battery stays bit-identical.
      // Known, left alone: at panels 2, `mid` and `WF.length-1` are the SAME
      // station, so those four lines emit that pair twice — a duplicated beam
      // is double stiffness. It measures linear and stiff, and unpicking it
      // would move panels-2 geometry in a commit about panels 4 and 5.
      // INBOARD OF THE CRANK ONLY. A lift strut reaches the straight inner
      // panel; it does not climb the outer panel of a cranked wing, and
      // pretending otherwise is not a modelling shortcut but a different
      // aeroplane. Measured: the jodel-crank preset (crankAt 0.45, dihedralOut
      // 14) flew a circuit before this block and did NOT after, because a stiff
      // member from the pod bottom to a station 14 deg up the outer panel
      // re-rigs the aeroelastics of nodes that carry strip force — rule 10's
      // "wires that anchor to strip-force-carrying nodes re-rig the
      // aeroelastics". zCrank is 0 when there is no crank, so a straight wing
      // gets every interior station, which is the case this block exists for.
      for (let i = 2; i < WF.length - 1; i++) {
        if (zCrank && zs[i] > zCrank + 1e-9) continue;
        // G140: the crank station already carries the REAL struts — a fan
        // pair on top would be the panels-2 double-stiffness case, chosen
        if (zCrank && i === iStrut) continue;
        B(strutRoot, WF[i], 'wing'); B(strutRoot, WR[i], 'wing');
      }
      // G140: THE OUTER PANEL OF A CRANKED STRUTTED WING IS A BOX — the
      // C172's construction: strut to the crank joint, cantilever box from
      // the crank out. Same members as the full cantilever box below, built
      // over the outer stations only; its root moment lands on the crank
      // station, where the strut and the inner spars react it. No fuselage
      // carry-through — that is the root box's own line, and this box's
      // root is the crank.
      if (zCrank > 0 && iStrut + 1 < cF.length - 0) {
        const depth = z => R.sparBoxDepth * linC(z);
        const zAll = [zRoot, ...zs];
        const bs = iStrut + 1;              // cF/zAll index of the crank
        const mkLower = (up, z, dx) =>
          N(dx, nodes[up].p[1] - depth(z), s * z, 'WB');
        cFB = []; cRB = [];
        for (let i = bs; i < zAll.length; i++) {
          const z = zAll[i];
          cFB[i] = mkLower(cF[i], z, xFat(z));
          cRB[i] = mkLower(cR[i], z, xRat(z));
          B(cF[i], cFB[i], 'wing'); B(cR[i], cRB[i], 'wing');
          B(cFB[i], cRB[i], 'wing');
          B(cF[i], cRB[i], 'wing'); B(cR[i], cFB[i], 'wing');
        }
        for (let i = bs; i < zAll.length - 1; i++) {
          B(cFB[i], cFB[i+1], 'wing'); B(cRB[i], cRB[i+1], 'wing');
          B(cFB[i], cRB[i+1], 'wing'); B(cRB[i], cFB[i+1], 'wing');
          B(cF[i], cFB[i+1], 'wing'); B(cFB[i], cF[i+1], 'wing');
          B(cR[i], cRB[i+1], 'wing'); B(cRB[i], cR[i+1], 'wing');
        }
        // THE STRUT IS THE LOWER CHORD (G140, measured before this pair
        // existed): the box's lower caps END at the crank, so the outer
        // panel's bending moment had no couple arm inboard — the joint was
        // a HINGE, the tip folded 2.4 m up in flight, and the aeroplane
        // hovered at 1 m at full throttle while the static TORSION probe
        // read a healthy 1.81x (bending, not twist — the instrument that
        // catches this is the tip-lift, and GATE FLEX grew it). The real
        // C172 closes the path exactly here: outer lower-cap tension runs
        // into the STRUT at the crank and down to the fuselage. Two lumped
        // members under the fabric, like the fan they extend.
        B(strutRoot, cFB[bs], 'wing');
        B(strutRoot, cRB[bs], 'wing');
      }
    } else {
      // CANTILEVER: no strut, so rule 1 has to be paid for properly — a real
      // full-depth two-spar torsion box. Lower caps under both spars at every
      // station, webs, ribs and shear diagonals on all four faces. This is the
      // Jodel's construction; without it a planar fan folds (the drone did).
      // STRUCTURAL chord, not the aerodynamic outline. The tip bow is a light
      // fairing outboard of the spar box; the box itself does not taper to
      // nothing just because the planform is rounded. Using chordAt here drove
      // the box depth to zero at the tip and put a ZERO-LENGTH beam between the
      // upper and lower caps — the strain = Infinity trap from G2.3d, which
      // rule 1 says to remove geometrically rather than guard against.
      const depth = z => R.sparBoxDepth * linC(z);
      const zAll = [zRoot, ...zs];
      const mkLower = (up, z, dx) => N(dx, nodes[up].p[1] - depth(z), s * z, 'WB');
      cFB = []; cRB = [];
      for (let i = 0; i < zAll.length; i++) {
        const z = zAll[i];
        cFB.push(mkLower(cF[i], z, xFat(z)));
        cRB.push(mkLower(cR[i], z, xRat(z)));
        // station cell: webs down from each cap, lower rib, and its diagonals
        B(cF[i], cFB[i], 'wing'); B(cR[i], cRB[i], 'wing');
        B(cFB[i], cRB[i], 'wing');
        B(cF[i], cRB[i], 'wing'); B(cR[i], cFB[i], 'wing');
      }
      for (let i = 0; i < zs.length; i++) {
        B(cFB[i], cFB[i+1], 'wing'); B(cRB[i], cRB[i+1], 'wing');   // lower caps
        B(cFB[i], cRB[i+1], 'wing'); B(cRB[i], cFB[i+1], 'wing');   // lower plan
        B(cF[i], cFB[i+1], 'wing'); B(cFB[i], cF[i+1], 'wing');     // front web
        B(cR[i], cRB[i+1], 'wing'); B(cRB[i], cR[i+1], 'wing');     // rear web
      }
      // and the box has to carry through the fuselage too, or the whole
      // bending moment still arrives at a point (rule 3)
      const [iA] = straddle(xF), iN = nearestRing(xF);
      for (const i of [...new Set([iN, iA])]) {
        B(cFB[0], F[i][lo], 'wing'); B(cRB[0], F[i][lo], 'wing');
      }
    }
    sec('wings');
    // G140: the strut's LANDING rides out with the frame — the viewer's
    // two-end strut binding needs the exact nodes the beam runs between,
    // and guessing "station 1" over there is how the kink bug was born
    wf[s > 0 ? 'R' : 'L'] = { F: cF, R: cR, FB: cFB, RB: cRB, strutRoot,
                              strutF: useStrut ? WF[iStrut] : null,
                              strutR: useStrut ? WR[iStrut] : null };
  };
  mkWing(+1); mkWing(-1);
  // carry-through: the two spars run across the top of the cabin as one piece,
  // diagonals per rule 4. This is what makes the wing a wing rather than two
  // half-wings bolted to a fuselage.
  B(wf.L.F[0], wf.R.F[0], 'wing'); B(wf.L.R[0], wf.R.R[0], 'wing');
  B(wf.L.F[0], wf.R.R[0], 'wing'); B(wf.R.F[0], wf.L.R[0], 'wing');
  // G140 guard: only a box that REACHES THE ROOT carries through — the
  // hybrid's outer box (strut + boxed outer) starts at the crank, so its
  // FB array is sparse below the crank index and has nothing at [0]
  if (wf.L.FB && wf.L.FB[0] != null) {
    // a cantilever box that stops at the fuselage side is two half-boxes: the
    // lower caps have to run across as well, with their own shear diagonals
    B(wf.L.FB[0], wf.R.FB[0], 'wing'); B(wf.L.RB[0], wf.R.RB[0], 'wing');
    B(wf.L.FB[0], wf.R.RB[0], 'wing'); B(wf.R.FB[0], wf.L.RB[0], 'wing');
    B(wf.L.FB[0], wf.R.F[0], 'wing'); B(wf.R.FB[0], wf.L.F[0], 'wing');
  }
  cover(1.9 * 2 * zRoot * w.chord, [wf.L.F[0], wf.R.F[0], wf.L.R[0], wf.R.R[0]]);

  // ---- 4. empennage ---------------------------------------------------
  sec('tail');
  const t = S.tail;
  // A V-tail's panel tips ride UP as well as out. They keep the HTL/HTR tags —
  // they really are the tail tips, and the shadow proxy, the skin binding and
  // the gate harness all key off those names — so only their position changes
  // and there is simply no FIN node to build.
  const isV = t.type === 'v';
  const tailY = lastST.yb + 0.55 * (lastST.yt - lastST.yb);
  // STAB HEIGHT. 0 leaves it on the tail cone where it has always been; 1 puts
  // it level with the fin tip, which is a T-tail. Y only — `hX` is the tail arm
  // and is the builder's, so riding up the fin does not silently re-tune pitch.
  const finTopY = lastST.yt + t.vHeight * 0.82;
  const stabY = isV ? tailY + t.vHeight
                    : tailY + (t.stabH || 0) * (finTopY - tailY);
  const [HTL, HTR] = NM(t.hX, stabY, 0.5 * t.hSpan, 'HT');
  for (const [H, side] of [[HTL, 'L'], [HTR, 'R']]) {
    B(H, TPB, 'fus'); B(H, TPT, 'fus');
    B(H, side === 'L' ? last.BL : last.BR, 'fus');
    B(H, side === 'L' ? last.TL : last.TR, 'fus');
  }
  let FIN = null;
  if (isV) {
    cover(1.9 * t.Svt, [HTL, HTR, TPB, TPT]);
  } else {
    cover(1.9 * t.Sh, [HTL, HTR, TPB, TPT]);
    // THE FIN'S OWN MATERIAL (G116): the stab was billed above under the
    // tail section's default; the fin bills its own from here — sec('gear')
    // below resets the marker, so nothing after can inherit it by accident
    MB = GEN_MATERIALS[t.finMaterial] || M;
    // the fin's apex node follows the RAKE, so the truss leans with the fin the
    // skin draws instead of standing upright inside a swept one
    FIN = N(t.vX + Math.tan((t.vSweep || 0) * Math.PI / 180) * t.vHeight * 0.82,
            finTopY, 0, 'FIN');
    B(FIN, TPT, 'fus'); B(FIN, last.TL, 'fus'); B(FIN, last.TR, 'fus');
    cover(1.9 * t.Sv, [FIN, TPT, last.TL, last.TR]);
  }

  // ---- 5. gear --------------------------------------------------------
  sec('gear');
  spend(2 * GEN_PRICES.wheel + GEN_PRICES.thirdWheel + (ARCH.price || 0));
  // G133: THE FAIRINGS WEIGH AND COST. Glassfibre datum: a shell's mass
  // scales with the wheel's area (55·R² ≈ 2.2 kg at R 0.20; a trouser's
  // deeper shell 88·R², its leg shroud included), stretched a little by the
  // droplet; a shroud bought on its own goes by the leg's length.
  // GEN_FAIR_MATS scales mass and price both ways. Every term is zero at
  // the defaults, so no pre-G133 build gains a gram or a credit.
  const FMAT = GEN_FAIR_MATS[S.gear.fairMat] || GEN_FAIR_MATS.glass;
  const fairShellM = (f, r2, t2) => f === 'none' ? 0
    : (f === 'full' ? 88 : 55) * r2 * r2 * (0.8 + 0.2 * (t2 || 1)) * FMAT.m;
  const fairShroudM = l2 => 3.2 * l2 * FMAT.m;
  const mFairMain = fairShellM(S.gear.fairing, S.gear.wheelR || 0.20,
                               S.gear.fairTail)
    + (S.gear.legFair === 'fair' && S.gear.fairing !== 'full'
       ? fairShroudM(S.gear.legDrop || 0.42) : 0);
  const mFairTw = fairShellM(S.gear.twFairing, S.gear.twR || 0.10,
                             S.gear.twFairTail)
    + (S.gear.twLegFair === 'fair' && S.gear.twFairing !== 'full'
       ? fairShroudM(S.gear.twLeg || 0.20) : 0);
  spend(FMAT.price * (
    (S.gear.fairing === 'full' ? 2 * GEN_PRICES.trouser
      : S.gear.fairing === 'spat' ? 2 * GEN_PRICES.spat : 0)
    + (S.gear.legFair === 'fair' && S.gear.fairing !== 'full'
       ? 2 * GEN_PRICES.legFair : 0)
    + (S.gear.twFairing === 'full' ? GEN_PRICES.trouser
      : S.gear.twFairing === 'spat' ? GEN_PRICES.spat : 0)
    + (S.gear.twLegFair === 'fair' && S.gear.twFairing !== 'full'
       ? GEN_PRICES.legFair : 0)));
  const gy = S.gear.y;
  const gx = gearX !== null && gearX !== undefined ? gearX : cab.noseGap * 0.9;
  const tr = track !== null && track !== undefined ? track : 5 * cab.halfW;
  // CAMBER: the node's radius is what the solver contacts the ground on, and a
  // leaning wheel touches R*cos(camber) below its axle. Resolved once, on the
  // spec, so the mesh and the clearance rules cannot disagree with the physics.
  const [GAL, GAR] = NM(gx, gy, 0.5 * tr, 'AXLE', S.gear.contactR);
  B(GAL, GAR, 'gear');
  // Rule 7: the gear needs a LONGITUDINAL (drag) load path anchored well fore
  // AND aft of the axle, into HEAVY nodes. The anchors used to be hard-coded to
  // rings 0 and 1 — but the axle position is DERIVED, and when it landed aft of
  // ring 1 both anchors ended up forward of it, so nothing resisted the axle
  // swinging back and the gear folded (measured on a light engine, which pushes
  // the CG and therefore the axle aft). Pick the frames that straddle it.
  const iFwd = (() => { let r = 0; for (let i = 0; i < ST.length; i++) if (ST[i].x < gx - 0.10) r = i; return r; })();
  const iAft = (() => {
    for (let i = 0; i < ST.length; i++) if (ST[i].x > gx + 0.10) return i;
    return Math.min(F.length - 1, iFwd + 1);
  })();
  // If the axle sits ahead of EVERY frame (a heavy engine drags the CG, and the
  // rake rule then drags the axle, out past the firewall) there is nothing
  // forward to brace against. Hang the forward leg off the ENGINE MOUNT, which
  // is what a real aeroplane does when the gear lives that far forward — and
  // which keeps rule 7's "into HEAVY nodes" satisfied.
  const aheadOfAll = ST[0].x > gx + 0.10;
  const fwdL = aheadOfAll ? EL : F[iFwd].BL, fwdR = aheadOfAll ? ER : F[iFwd].BR;
  const AA = F[Math.max(iAft, aheadOfAll ? 0 : Math.min(iFwd + 1, F.length - 1))];
  // What each of those six members IS, now that `vis` can say so. The forward
  // pair is the SUSPENSION LEG — bungee cord, spring steel or oleo, drawn as
  // whichever the spec bought. The same-side aft pair is the drag brace, a
  // tube, which is what it is on any aeroplane. The two CROSS members run from
  // one axle end to the other side's frame, under the belly: as 48 mm tubes
  // they made the undercarriage read as a cage, and an X of bracing wires under
  // the belly is both what a tube-and-fabric aeroplane actually has and the
  // same load path. Nothing here changes k, c or mass.
  B(GAL, fwdL, 'gear', false, 'leg'); B(GAL, AA.BL, 'gear');
  B(GAL, fwdR, 'gear', false, 'wire');
  B(GAR, fwdR, 'gear', false, 'leg'); B(GAR, AA.BR, 'gear');
  B(GAR, fwdL, 'gear', false, 'wire');
  // RULE 10 FOR THE MAINS (G53). Every one of the six members above lands on a
  // BELLY node, and the belly is a near-horizontal plane — so the axle is held
  // by three anchors it can REFLECT THROUGH. That is a snap-through, and it is
  // invisible to every strain gate: measured, the axle flipped 0.62 m UP at
  // 0.28% strain and the aeroplane settled on its belly with the wheels in the
  // air. It stayed hidden while the ride height was DERIVED, because a deep leg
  // puts the mirror position far enough away that the members must compress 37%
  // to reach it; measuring the ride height off a real build (0.32 m of leg)
  // drops that barrier to 13% and the gear flips on the first bounce.
  // The tailwheel has carried exactly this cure since G4.6 (TW->TPT, below).
  // A near-vertical member up to the ring's TOP corner is also what a
  // bungee-sprung light aeroplane actually has, and like the tailwheel's it is
  // INTERNAL: under the covering it should not be visible.
  B(GAL, F[iFwd].TL, 'gear', false, 'inner');
  B(GAR, F[iFwd].TR, 'gear', false, 'inner');
  pt(GAL, 3.5 + mFairMain); pt(GAR, 3.5 + mFairMain);  // wheels + fairings

  // The third wheel. `refs.tw` is whichever it is — the solver steers that node
  // and the sign of twSteer says which end it lives at.
  const trike = S.gear.type === 'tricycle';
  let TW, twX, twY;
  if (trike) {
    // NOSEWHEEL, forward under the engine bay, at a height that leaves the
    // aeroplane essentially level (a touch nose-up, the way a real trike sits).
    twX = S.gear.twX !== null && S.gear.twX !== undefined
      ? S.gear.twX : Math.min(-0.05, S.engX * 0.45);
    // Sign: rotating the body so BOTH contacts reach the ground gives
    // tan(deck) = (y_third - y_main) / (x_third - x_main). The nosewheel is
    // AHEAD, so the denominator is negative and a nose-UP rest attitude needs
    // its contact BELOW the mains — the opposite of a tailwheel. Getting this
    // backwards stood the aeroplane on its nose at "deck 178.8 deg".
    // SPLIT HEIGHT: given a nose LEG LENGTH the attitude falls out of it, the
    // way the tailwheel's always has. Left null, trikeDeck still works
    // backwards from the attitude and every existing number is unchanged.
    twY = S.gear.twY !== null && S.gear.twY !== undefined
      ? S.gear.twY
      : (S.gear.twLeg !== null && S.gear.twLeg !== undefined
         ? -0.02 - S.gear.twLeg
         : (gy - S.gear.contactR) + S.gear.twR
           - Math.tan(R.trikeDeck * D) * (gx - twX));
    TW = N(twX, twY, 0, 'TW', S.gear.twR);
    // it hangs off the firewall frame and the engine mount — the heavy nodes
    // at that end of the aeroplane (rule 7), with a fore-and-aft path.
    // A real nose gear is one strut and a drag link, so the firewall pair is
    // the leg and the other four are links.
    B(TW, F[0].BL, 'gear', false, 'leg'); B(TW, F[0].BR, 'gear', false, 'leg');
    B(TW, EL, 'gear', false, 'wire'); B(TW, ER, 'gear', false, 'wire');
    B(TW, F[Math.min(1, F.length-1)].BL, 'gear', false, 'wire');
    B(TW, F[Math.min(1, F.length-1)].BR, 'gear', false, 'wire');
    pt(TW, 3.0 + mFairTw);
  } else {
    twX = S.gear.twX !== null && S.gear.twX !== undefined
      ? S.gear.twX : fu.postX - 0.10;
    // the tailwheel hangs off the tailpost foot by its leg length; the
    // three-point attitude is whatever that geometry produces (spec twLeg,
    // defaulting to GEN_RULES.twLeg)
    twY = S.gear.twY !== null && S.gear.twY !== undefined
      ? S.gear.twY : nodes[TPB].p[1]
        - (S.gear.twLeg !== null && S.gear.twLeg !== undefined ? S.gear.twLeg : R.twLeg);
    TW = N(twX, twY, 0, 'TW', S.gear.twR);
    // Six members, and on a real tailwheel exactly one of them is hardware you
    // can see: the spring the wheel hangs on. Report: "too many struts, no
    // spring". So the tailpost member IS the spring/oleo, the pair to the last
    // frame and the pair up to the stabiliser are bracing WIRES (which is what
    // the rule-10 pyramid has always been called in this file), and the
    // near-vertical snap-blocker is declared INTERNAL — it runs from below the
    // tailwheel to the TOP of the tailpost, i.e. straight up through the
    // fuselage, so under the covering it should not be there at all. It still
    // stands in Frame mode and still carries exactly the same load.
    B(TW, TPB, 'gear', false, 'leg');
    B(TW, last.BL, 'gear', false, 'wire'); B(TW, last.BR, 'gear', false, 'wire');
    // rule 10: a near-axial chain LATCHES with every strain under 1%, and no
    // strain gate can see it. Both cures the Cub needed are mandatory here:
    // a snap-blocking near-vertical member, AND a wide lateral pyramid.
    B(TW, TPT, 'gear', false, 'inner');
    B(TW, HTL, 'gear', false, 'wire'); B(TW, HTR, 'gear', false, 'wire');
    pt(TW, 2.0 + mFairTw);
  }

  // ---- 6. payload, fuel, systems --------------------------------------
  // tandem: pilot in the FRONT seat first (a J-3 is soloed from the rear, but
  // that is a CG choice the player can make by moving the seat, not a default)
  sec('cabin');
  spend(S.seats * GEN_PRICES.seat);
  // WHICH FRAME EACH OCCUPANT SITS ON. This was a two-element literal, which
  // is the whole of why the aeroplane could not carry more than two people:
  // a third occupant fell through `|| F[1]` and was billed onto the front row
  // with the pilot, so a full cabin loaded like a solo one and the CG did not
  // move. It is per-LAYOUT now, and every existing layout resolves to exactly
  // what it resolved to before.
  //
  // A ROW OF TWO IS ONE FRAME. `side2` and the front row of `side4` sit
  // abreast, so both occupants bill onto the same ring — the mass is already
  // split BL/BR, which is where the lateral half comes from.
  const SEAT_ROWS = {
    single:  [1],
    tandem2: [1, 2],
    side2:   [1, 1],
    side4:   [1, 1, 2, 2],
    tandem4: [1, 1, 2, 2],
    drone:   [],
  };
  const seatRows = SEAT_ROWS[S.seating] || [1, 1];
  // OCCUPANTS, not crew: `S.crew` is the flight crew and `S.pax` the rest.
  // `S.occupants` is absent on a spec resolved by an older core, and there
  // the old meaning is the right fallback rather than a guess.
  const aboard = S.occupants != null ? S.occupants : S.crew;
  for (let i = 0; i < aboard; i++) {
    const ri = seatRows[i] != null ? Math.min(seatRows[i], F.length - 1) : 1;
    const rg = F[ri] || F[1];
    pt(rg.BL, 40); pt(rg.BR, 40);
  }
  sec('fuel');
  const fuelM = S.fuelL * 0.72;
  // WHERE the fuel sits. Nose is the Cub's — ahead of the panel, and it moves
  // the CG forward. Wing-root hangs it on the spar carry-through. Outboard puts
  // it in the panel, which relieves the wing in flight and slows the roll,
  // because the tanks are the heaviest thing you can put out there.
  const tankL = S.fuel.tank === 'wing' ? wf.L.F[0]
              : S.fuel.tank === 'panel' ? wf.L.F[Math.min(1, wf.L.F.length - 1)]
              : F[0].TL;
  const tankR = S.fuel.tank === 'wing' ? wf.R.F[0]
              : S.fuel.tank === 'panel' ? wf.R.F[Math.min(1, wf.R.F.length - 1)]
              : F[0].TR;
  pt(tankL, 0.5 * fuelM); pt(tankR, 0.5 * fuelM);
  // G121: WHICH KILOS ARE FUEL, recorded on the node itself — the burn
  // chantier drains these through the solver's setNodeMass door, and
  // genSubsteps sizes the integrator at DRY mass off the same records (a
  // beam is stiffest, per unit mass, when its tank is empty: sized at full
  // it is stable on departure and divergent at reserves).
  nodes[tankL].mFuel = (nodes[tankL].mFuel || 0) + 0.5 * fuelM;
  nodes[tankR].mFuel = (nodes[tankR].mFuel || 0) + 0.5 * fuelM;
  sec('systems');
  const SYS = GEN_SYSTEMS[S.systems.fit] || GEN_SYSTEMS.basic;
  spend(SYS.price);
  pt(F[0].TL, 0.5 * SYS.mass); pt(F[0].TR, 0.5 * SYS.mass);   // panel + systems
  sec('paint');
  spend((GEN_FINISH[S.paint.job] || GEN_FINISH.full).price);
  sec('cargo');
  // Freight goes in the cargo bay if there is one, otherwise on the baggage
  // frame with everything else — which is the point of building the bay: it
  // puts the load where you chose rather than wherever it fits.
  const load = S.baggage + S.cargoKg;
  if (fu.cargoLen > 1e-6) {
    // the bay spans frames 2 (cabin rear) and 3 (its own aft bulkhead); spread
    // the freight across both so it sits IN the bay rather than on one end
    for (const rg of [F[2], F[3]]) { pt(rg.BL, 0.25 * load); pt(rg.BR, 0.25 * load); }
  } else {
    const bag = F[Math.min(3, F.length - 1)];
    pt(bag.BL, 0.5 * load); pt(bag.BR, 0.5 * load);
  }

  const refs = {
    noseFrame: [F[0].BL, F[0].BR, F[0].TL, F[0].TR],
    tailMid: [TPB, TPT],
    upLo: [F[0].BL, F[0].BR], upHi: [F[0].TL, F[0].TR],
    fusDrag: [F[2].BL, F[2].BR, F[2].TL, F[2].TR],
    fusDragAft: [F[F.length-2].BL, F[F.length-2].BR, F[F.length-2].TL, F[F.length-2].TR],
    engine: [EL, ER], mains: [GAL, GAR], tw: TW, fin: FIN,
  };
  const parts = {
    ST, F, TPB, TPT, EL, ER, HTL, HTR, FIN, GAL, GAR, TW,
    wf, zs, zRoot, zCrank, xF, xR, xFat, xRat, sparFront, sparRear, sparSpacing,
    chordAt, yF, incAt, cabRear, gx, tr, twX, twY,
    ribZ,                       // G66: where the ribs the mass model billed are

    bracing: useStrut ? (w.crankAt > 0 ? 'strut + boxed outer' : 'strut')
                      : 'cantilever box', strutOffset, trike,
    ledger,
    gearAnchors: [iFwd, iAft], kScale: KS, kGear: KG,
  };
  return { nodes, beams, refs, parts };
}

function genLatticeCG(nodes) {
  let x = 0, y = 0, z = 0, m = 0;
  for (const n of nodes) { x += n.p[0]*n.m; y += n.p[1]*n.m; z += n.p[2]*n.m; m += n.m; }
  return [x/m, y/m, z/m, m];
}

// Two fixed passes: the first sizes the aeroplane, the second places the main
// gear against the CG it produced. Fixed count, so generation stays
// deterministic (GATE GEN byte-compares a double-generate).
function genFrame(S) {
  const R = GEN_RULES, D = Math.PI / 180;
  const M = GEN_MATERIALS[S.material];
  const a = genLattice(S, S.gear.x, S.gear.track);
  const cg = genLatticeCG(a.nodes);
  // structure sized for the mass the first pass produced. Sub-linear: a bigger
  // aeroplane is not stiffer in proportion, and clamped so a foam trainer does
  // not end up with rubber tube nor a radial with an unbreakable one.
  const kScale = Math.min(4, Math.max(0.45,
    Math.pow(cg[3] / (M.refMass || 390), 0.85)));
  const gy = S.gear.y;
  // main axle rake: forward of the CG by gearRake degrees off vertical. Too
  // little and it noses over on the brakes; too much and it will not fly the
  // tail up. Track from the CG height, against ground-loop divergence.
  // The placement rule INVERTS with the gear type. A taildragger puts the mains
  // ahead of the CG so it rests on its tail; a tricycle puts them BEHIND, and
  // the design quantity is what fraction of the weight the nosewheel then
  // carries (real practice ~8-15%). Solving for that directly is clearer than
  // an angle: x_main = (x_cg - f*x_nose) / (1 - f).
  const trikeGear = S.gear.type === 'tricycle';
  const autoGx = trikeGear
    ? (() => {
        const xNose = Math.min(-0.05, S.engX * 0.45);
        return (cg[0] - R.noseLoad * xNose) / (1 - R.noseLoad);
      })()
    : cg[0] - Math.tan(R.gearRake * D) * (cg[1] - gy);
  const gx = (S.gear.x !== null && S.gear.x !== undefined ? S.gear.x : autoGx)
             + S.place.gearDx;
  const tr = Math.max(0.5, (S.gear.track !== null && S.gear.track !== undefined
    ? S.gear.track : R.trackRatio * (cg[1] - (gy - S.gear.contactR))) + S.place.gearDtrack);
  const out = genLattice(S, gx, tr, kScale);
  out.cg0 = genLatticeCG(out.nodes);
  return out;
}
// ============================================================
// GARAGE 3/5 — the AERO. Frame -> strips, polars and params.
//
// The polars are SYNTHESISED, not looked up: the same NACA digits that shape
// the visible wing section produce the six numbers the solver's polar()
// wants. That is the single root extended to aerodynamics — there is no
// airfoil table to keep in step with the geometry.
//
// The synthesis is anchored on the hand-written fleet: the tail model
// reproduces POLARS.flat_tail_cub to two decimals (a3d 3.34 vs 3.4,
// aStall 0.239 vs 0.24) and the Cd0 model reproduces the Cub's 0.010 and the
// C172's 0.008. Those agreements are the reason the constants are what they
// are; they are not free parameters.
// ============================================================

// Thin-airfoil theory on the NACA 4-digit mean line, integrated numerically
// (closed forms exist per branch, but the integral is 3 lines and exact for
// any m/p). Returns the zero-lift angle in radians and Cm about c/4.
function genThinAirfoil(m, p) {
  if (m <= 0) return { aL0: 0, Cm0: 0 };
  const NS = 400;
  let i0 = 0, i1 = 0, i2 = 0;
  for (let i = 0; i < NS; i++) {
    const th = (i + 0.5) * Math.PI / NS, x = 0.5 * (1 - Math.cos(th));
    const dz = x <= p ? (2 * m / (p * p)) * (p - x)
                      : (2 * m / ((1 - p) * (1 - p))) * (p - x);
    const dth = Math.PI / NS;
    i0 += dz * (1 - Math.cos(th)) * dth;
    i1 += dz * Math.cos(th) * dth;
    i2 += dz * Math.cos(2 * th) * dth;
  }
  const aL0 = i0 / Math.PI;                       // negative for positive camber
  const A1 = (2 / Math.PI) * i1, A2 = (2 / Math.PI) * i2;
  return { aL0, Cm0: (Math.PI / 4) * (A2 - A1) };
}

// 2D lift slope. kVisc 0.845 is the fleet-fitted viscous deficit: reconstructing
// a0 from the registry's (a3d, eAR) pairs gives 5.7-5.9 /rad across cub, jodel
// and c172, not the 2*pi of inviscid theory.
const GEN_KVISC = 0.845;

// Oswald efficiency, Raymer's straight-wing estimate, times a bracing penalty
// (a strut and its fairing spoil the span loading near the attach).
function genOswald(AR, strut, tipE) {
  const e = 1.78 * (1 - 0.045 * Math.pow(AR, 0.68)) - 0.64;
  // the tip treatment multiplies span efficiency BEFORE the cap: a winglet on
  // an already-efficient wing cannot conjure e past the Raymer ceiling
  return Math.min(0.95, Math.max(0.55, e * (strut ? 0.90 : 1.0) * (tipE || 1)));
}

// naca: 4-digit code; AR/taper/strut: planform; finish: material cd0 penalty.
function genPolar(naca, AR, strut, matCd0, clmaxK, sweepDeg, tipE) {
  const { m, p, t } = nacaParts(naca);
  const { aL0, Cm0 } = genThinAirfoil(m, p);
  // Simple-sweep theory: only the velocity component NORMAL to the quarter
  // chord line does the lifting, so the section lift slope and the maximum lift
  // both go with cos(sweep). It depends on |sweep| — forward sweep costs
  // exactly as much as aft, which is the honest reason forward sweep is not a
  // free way to move the CG.
  const cosL = Math.cos((sweepDeg || 0) * Math.PI / 180);
  const a0 = 2 * Math.PI * GEN_KVISC * (1 + 0.77 * t) * cosL;
  const eAR = Math.PI * genOswald(AR, strut, tipE) * AR;
  const a3d = 1 / (1 / a0 + 1 / eAR);
  const Cl0 = a3d * (-aL0);
  const ClMax = (1.38 + 5.0 * m + 1.2 * (t - 0.12)) * clmaxK * cosL;
  return {
    a3d, Cl0, aStall: Math.max(0.16, (ClMax - Cl0) / a3d),
    Cd0: 0.0055 + 0.018 * t + matCd0, eAR, Cm0,
    _ClMax: ClMax,
  };
}

// Tail sections are symmetric and thin; e is 0.70 across the whole fleet.
function genTailPolar(AR, matCd0) {
  const t = 0.09;
  const a0 = 2 * Math.PI * GEN_KVISC * (1 + 0.77 * t);
  const eAR = Math.PI * 0.70 * AR;
  const a3d = 1 / (1 / a0 + 1 / eAR);
  return { a3d, Cl0: 0, aStall: 0.80 / a3d, Cd0: 0.0055 + 0.018 * t + matCd0,
           eAR, Cm0: 0 };
}

// ---------------------------------------------------------------------------
// Strips. Two per wing bay per side, plus one over the cabin; two per stab
// panel; one fin. Attach weights put the quarter chord where it belongs
// between the two spars, exactly as the hand fiches do.
// ---------------------------------------------------------------------------
function genStrips(S, fr) {
  const P = fr.parts, R = GEN_RULES, strips = [];
  // G134: the resolved row (custom dials outrank the preset), and the wash
  // radius follows the RESOLVED disc — G131 made the drawn prop the thrust
  // model's author, but the wash still blew at the registry diameter. For
  // every fiche S.prop.D IS the registry D, so nothing pre-G131 moves.
  const PP = S.pplant || POWERPLANTS[S.engine];
  const Reff = ((S.prop && S.prop.D ? S.prop.D : PP.prop.D) / 2) * R.washSpread;
  // fraction of propwash a strip at |z| sees; fitted to the Cub's hand values
  // (centre strip 1.0, first outboard strip 0.5, everything beyond 0)
  const washAt = z => Math.max(0, 1 - (z / Reff) * (z / Reff));
  // c/4 between the spars: weight the front spar by how far the quarter chord
  // sits from the rear one
  const cf = (P.sparRear - 0.25) / (P.sparRear - P.sparFront), cr = 1 - cf;
  const semi = S.geom.semi;
  // where the surfaces live along the semispan. The aileron is measured inboard
  // from the tip, the flap outboard from the centreline, and clampSpec has
  // already guaranteed a gap between the two.
  const CT = S.controls;
  const aStart = (1 - CT.aileron.span) * semi;
  const fEnd = GEN_FLAPS[CT.flap.type].dCl > 0 ? CT.flap.span * semi : -1;

  const zAll = [P.zRoot, ...P.zs];
  for (const [side, fw] of [[1, P.wf.R], [-1, P.wf.L]]) {
    for (let b = 0; b < P.zs.length; b++) {
      const zi = zAll[b], zo = zAll[b + 1];
      for (const t of [0.28, 0.78]) {
        const zc = zi + (zo - zi) * t;
        const ch = P.chordAt(zc);
        // Each strip is HALF a bay, so it has a real sub-span, and `flap` is a
        // FRACTION rather than a flag: how much of this strip carries a flap.
        // With a bare flag the span slider quantised — 0.50 and 0.62 produced
        // the identical aeroplane because they caught the same strip centres.
        const zLo = t < 0.5 ? zi : 0.5 * (zi + zo);
        const zHi = t < 0.5 ? 0.5 * (zi + zo) : zo;
        const fFrac = fEnd <= zLo ? 0
                    : fEnd >= zHi ? 1
                    : (fEnd - zLo) / (zHi - zLo);
        strips.push({
          kind: 'wing', side, t, chord: ch,
          area: 0.5 * (zo - zi) * ch,
          fIn: fw.F[b], fOut: fw.F[b + 1], rIn: fw.R[b], rOut: fw.R[b + 1],
          w: [[fw.F[b], cf * (1 - t)], [fw.F[b + 1], cf * t],
              [fw.R[b], cr * (1 - t)], [fw.R[b + 1], cr * t]],
          wash: washAt(zc), ail: zc > aStart ? 1 : 0, flap: fFrac,
        });
      }
    }
  }
  // Centre section over the cabin: one strip, fully in the slipstream. It hangs
  // off the WING's own spar roots, not the fuselage frames — otherwise the
  // centre section's lift stays behind when the wing is moved.
  const cL = P.wf.L, cR2 = P.wf.R;
  strips.push({
    kind: 'wing', side: 1, t: 0.5, chord: S.wing.chord,
    area: 2 * P.zRoot * S.wing.chord,
    fIn: cL.F[0], fOut: cR2.F[0], rIn: cL.R[0], rOut: cR2.R[0],
    w: [[cL.F[0], cf * 0.5], [cR2.F[0], cf * 0.5],
        [cL.R[0], cr * 0.5], [cR2.R[0], cr * 0.5]],
    wash: 1, ail: 0, flap: 0,
  });

  const hc = S.tail.hChord;
  if (S.tail.type === 'v') {
    // Two canted panels, and no fin. Each carries the TRUE panel area (not the
    // horizontal projection) — the cant is in the strip's normal, so the
    // solver resolves pitch and yaw from the geometry rather than from a pair
    // of book-keeping areas that could disagree with it.
    const cV = Math.cos(S.tail.vG), sV = Math.sin(S.tail.vG);
    for (const [H, side] of [[P.HTL, -1], [P.HTR, 1]]) {
      strips.push({ kind: 'vtail', side, cosV: cV, sinV: sV,
        area: 0.565 * S.tail.Svt / 2, chord: hc,
        wash: R.stabWash, w: [[H, .50], [P.TPB, .30], [P.TPT, .20]] });
      strips.push({ kind: 'vtail', side, cosV: cV, sinV: sV,
        area: 0.435 * S.tail.Svt / 2, chord: hc,
        wash: R.stabWash, w: [[H, .25], [P.TPB, .45], [P.TPT, .30]] });
    }
    return strips;
  }
  for (const [H, side] of [[P.HTL, -1], [P.HTR, 1]]) {
    strips.push({ kind: 'stab', side, area: 0.565 * S.tail.Sh / 2, chord: hc,
      wash: R.stabWash, w: [[H, .50], [P.TPB, .30], [P.TPT, .20]] });
    strips.push({ kind: 'stab', side, area: 0.435 * S.tail.Sh / 2, chord: hc,
      wash: R.stabWash, w: [[H, .25], [P.TPB, .45], [P.TPT, .30]] });
  }
  strips.push({ kind: 'fin', area: S.tail.Sv, chord: S.tail.vChord,
    wash: R.finWash, w: [[P.FIN, .40], [P.TPT, .35], [P.TPB, .25]] });
  return strips;
}

// Body-axis CdA for the two fuselage blobs. Coefficients calibrated so the
// Cub's own geometry reproduces its hand-tuned [0.55, 0.8, 0.8] / [0, 0.5, 0.5]:
// 0.75 on max frontal area, 0.57 on forward side area, 0.31 aft (the aft body
// is tapered and cleaner, which is why the two are not the same number).
function genFusCdA(S, fr) {
  const ST = fr.parts.ST;
  let frontal = 0, sFwd = 0, sAft = 0;
  for (const s of ST) frontal = Math.max(frontal, 2 * s.w * (s.yt - s.yb));
  for (let i = 0; i < ST.length - 1; i++) {
    const a = ST[i], b = ST[i + 1];
    const A = 0.5 * ((a.yt - a.yb) + (b.yt - b.yb)) * (b.x - a.x);
    if (i < 2) sFwd += A; else sAft += A;
  }
  return {
    fusCdA: [0.75 * frontal, 0.57 * sFwd, 0.57 * sFwd],
    fusCdAAft: [0, 0.31 * sAft, 0.31 * sAft],
  };
}

// ---------------------------------------------------------------------------
// UNDERCARRIAGE AND BRACING DRAG (G115, the quality review's S1 — "no gear or
// strut drag anywhere; a bush gear moves ZERO numbers"). Flat-plate area from
// the gear's own DECLARED numbers: wheel radius, the fairing field that has
// been in the spec since the start with a comment admitting it "quietly did
// nothing to the numbers", the resolved leg drop, and the bracing choice.
// Coefficients are the classic flat-plate values (Hoerner): an exposed wheel
// 0.55 on its frontal, a spatted one 0.22, a full trouser 0.15; a bare leg is
// a cylinder at 1.0, faired 0.30; a lift strut is a streamline section at
// 0.10. Tyre width is 0.76R (the light-aircraft aspect), and the strut
// length runs from the lower longeron to ~55% semispan.
//
// G133 refinements, each with drawn geometry behind it (the G121.2 rule):
//   - the third wheel's fairing prices on EVERY leg family now — the
//     tailwheel castor draws its own shell since G133, so the tricycle-only
//     gate (a shell-less fairing must move nothing) is retired;
//   - the tail-droplet slider shapes the shell's run-out, so it shades the
//     fairing Cd (a longer, finer tail is the cleaner body — Hoerner's
//     fineness-ratio trend, scaled well inside his scatter). Exactly 1.0 at
//     the default length, so no stock number moved;
//   - the LEG fairing is its own field at last: `legFair` (mains) and
//     `twLegFair` (third leg) draw a streamline shroud and take the leg
//     from 1.0 to 0.30, and `fairing: 'full'` now actually draws the shroud
//     it has been pricing since G115. The third LEG term is new — bare in
//     both build and reference, so it cancels on every pre-G133 build.
//   Skirt depth, rake and width stay geometry-only: clearance and attitude
//   choices, priced no more than legDrop is (stance is not a drag knob).
const genFairDroplet = t => 1 - 0.18 * (Math.max(0.70, Math.min(1.60, t || 1)) - 1);
function genGearCdA(S, semi) {
  const G = S.gear;
  const wCd = (G.fairing === 'full' ? 0.15 : G.fairing === 'spat' ? 0.22 : 0.55)
            * (G.fairing && G.fairing !== 'none' ? genFairDroplet(G.fairTail) : 1);
  const R = G.wheelR || 0.20, Rt = G.twR || 0.10;
  const tCd = (G.twFairing === 'full' ? 0.15 : G.twFairing === 'spat' ? 0.22 : 0.55)
            * (G.twFairing && G.twFairing !== 'none'
               ? genFairDroplet(G.twFairTail) : 1);
  let cda = 2 * wCd * (2 * R * 0.76 * R)          // two mains
          + tCd * (2 * Rt * 0.76 * Rt);           // the third wheel
  const drop = G.legDrop || 0.42;
  const legCd = (G.fairing === 'full' || G.legFair === 'fair') ? 0.30 : 1.0;
  cda += 2 * legCd * drop * 0.05;                 // the main legs
  const twDrop = G.twLeg || 0.20;
  cda += (G.twFairing === 'full' || G.twLegFair === 'fair' ? 0.30 : 1.0)
       * twDrop * 0.05;                           // the third leg
  if (S.bracing.type === 'strut')
    cda += 2 * 0.10 * (0.55 * semi * 1.12) * 0.06;  // two lift struts
  return cda;
}
// THE CALIBRATION IS PRESERVED BY A DELTA. genFusCdA's 0.75 was fitted so the
// Cub's GEOMETRY reproduces its hand-tuned totals — totals that implicitly
// INCLUDE a bare-wheeled, strut-braced undercarriage. Adding gear drag on top
// would double-count it; what is added is the DIFFERENCE from that reference
// gear, so the default build's numbers barely move and the choices finally
// do: spats buy L/D, doubling the tyres costs cruise, dropping the struts
// shows up on the plaque. Clamped so an extreme clean-up cannot eat the body.
function genGearCdADelta(S, semi) {
  // the reference shares THIS build's resolved leg drop: leg length is a
  // stance choice the calibration already priced, not a drag knob — but the
  // leg FAIRING still counts, through the Cd factor the fairing field picks.
  // G133: the third LEG's length rides the same rule (shared, bare), and
  // every fairing field the model reads must be RESTATED here — a field the
  // ref literal forgets is a field whose default silently recalibrates the
  // fleet (GATE HONEST's stockDelta check is the tripwire).
  const ref = { gear: { fairing: 'none', twFairing: 'none',
                        legFair: 'none', twLegFair: 'none',
                        fairTail: 1, twFairTail: 1,
                        wheelR: 0.20, twR: 0.10,
                        legDrop: S.gear.legDrop || 0.42,
                        twLeg: S.gear.twLeg },
                bracing: { type: 'strut' } };
  return Math.max(-0.08, genGearCdA(S, semi) - genGearCdA(ref, semi));
}

// Autopilot block. Speeds come from the aeroplane's OWN stall speed; the
// remaining ratios and gains are the Cub's, which is the airframe timescale
// (span/V ~ 0.4 s) this family sits at. HANDOVER "AUTOPILOT RULES": D-gains
// scale with that timescale, so they are rescaled rather than copied.
const GEN_VRATIO = {
  VRot: 0.99, VClimbMin: 1.32, VClimb: 1.38, VCruise: 1.71,
  VAppr: 1.42, VApprShort: 1.24, VTailUp: 0.79, VBrakeOn: 0.59,
};
const GEN_TAU_REF = 10.0 / 26.0;      // Cub span / VCruise

function genAP(S, Vs, mass) {
  const V = k => Math.round(GEN_VRATIO[k] * Vs * 10) / 10;
  const tau = S.wing.span / (GEN_VRATIO.VCruise * Vs);
  const kD = tau / GEN_TAU_REF;
  // A tricycle lands and rolls out differently: there is no tail to fly down,
  // so the AP de-rotates onto the nosewheel instead of pinning a tailwheel.
  // VTailUp 99 disables the taildragger's tail-up logic outright (C172 fiche).
  const trike = S.gear.type === 'tricycle';
  const trikeAP = trike ? {
    rolloutMode: 'trike', VDerotate: Math.round(0.58 * GEN_VRATIO.VCruise * Vs),
    rolloutTh: 0.035, VTailUp: 99,
  } : {};
  return Object.assign({
    VRot: V('VRot'), VClimbMin: V('VClimbMin'), VClimb: V('VClimb'),
    VCruise: V('VCruise'), VAppr: V('VAppr'), VApprShort: V('VApprShort'),
    VTailUp: V('VTailUp'), VBrakeOn: V('VBrakeOn'),
    // PROVISIONAL. Everything below the speeds is overwritten by genTuneAP once
    // the tunnel has run (64_gen_build.js) — these values only have to be sane
    // enough for the probe pass itself, which reads VCruise, VClimb and VRot.
    TORun: 60,                    // replaced by the analytic estimate in 64
    rollD: 0.8 * kD,
    hCruise: 100, hSafe: 14, xTurn: -2300, xAim: -520, gs: 0.0786,
    rollDe: 0.12, liftoffTh: 0.16, climbThBase: 0.12, climbThGain: 0.030,
    thMax: 0.20, flareAgl: 4.8, flareRate: 0.062, aglGuard: 3,
    VStop: 0.4, slew: 1.5, thrCruise: 0.70, thrAppr: 0.35,
    brakeMax: 0.30, brakeRampRate: 0.12, VBrakeRelease: 1.5,
    _mass: mass,
  }, trikeAP);
}

// ---------------------------------------------------------------------------
// OUTER-LOOP SYNTHESIS — pass B, after the tunnel.
//
// genAP above only knows the geometry. Everything here needs the aeroplane's
// own drag polar, its approach trim, its stall attitude and what it can climb,
// so it runs from genTrim once those are measured (64_gen_build.js).
//
// WHY IT EXISTS. genAP emitted 34 keys; the autopilot dereferences 69. The
// other 35 fell through to `??` defaults in 40_autopilot.js, and those defaults
// are the CUB's — as were the dozen circuit constants genAP hardcoded. So a
// 1200 kg, 43 m/s, L/D 6.3 aeroplane flew the Cub's 100 m circuit, the Cub's
// 4.5 degree slope, the Cub's 150 m pursuit lookahead and the Cub's 0.30 bank
// limit. Measured consequences, before this: a short-span build spent 286 s
// stuck in CLIMB never reaching 100 m; a big slow one touched 240 m past the
// aim with the throttle on its floor for 62% of the descent; a flapped one
// crossed the fence at 0.92 Vs.
//
// METHOD is the one GEN_LOOP used a few lines up: propose a DIMENSIONLESS
// ratio, tabulate the seven hand fiches, and adopt it only if it CLUSTERS.
// Where it does not cluster that is said out loud and a stated fallback is
// taken, rather than a fleet mean dressed up as physics. Scatter quoted per
// line is measured across the fiches' own blocks.
// The four fiches that set bankLim cluster 0.42-0.48; 0.40 is deliberately
// inside them, because a generated wing may have poor roll authority. It is a
// module constant because the circuit geometry has to size the turnback against
// it before the lateral block runs.
const GEN_BANKLIM = 0.40;

function genTuneAP(def) {
  const A = def.params.ap, g = def.params.gen, S = def.spec;
  const cl = (x, a, b) => Math.max(a, Math.min(b, x));
  const r3 = x => Math.round(x * 1000) / 1000;
  const trike = S.gear.type === 'tricycle';

  // The gain placement has to be REDONE here. genPlant scales every derivative
  // with q = rho V^2 / 2, so the gains genParams placed at the provisional
  // cruise speed are simply wrong once the power curve moves it.
  const pl = genPlant(def.nodes, def.strips, def.params, A.VCruise);
  Object.assign(A, genGains(pl, def.params));
  g.plant = pl;
  // the two loops' natural frequencies, which set every servo rate below
  const wRoll = Math.sqrt(Math.max(1e-9, pl.Lda * A.rollP / pl.Ixx));
  const wPitch = Math.sqrt(Math.max(1e-9, pl.Mde * A.pitchP / pl.Iyy));

  // ---- speeds ------------------------------------------------------------
  // VTurn: fiche/midpoint 1.089 .950 .962 .947 -> 0.987 +/- 0.067, the TIGHTEST
  // ratio in the whole set, and it retrodicts the literal 24 that used to sit
  // in INBOUND (the Cub's own midpoint is 23.75). VTurn/VCruise scatters
  // 0.73-0.95 and VTurn/VAppr 1.19-1.36; the midpoint beats both.
  A.VTurn = Math.round(0.5 * (A.VCruise + A.VAppr) * 10) / 10;
  // VBrakeOn/Vs scatters 0.47-1.01 — WEAK (2.1x). 0.59 was at the late-braking
  // edge of it; 0.75 is the fleet median. Flagged as low-confidence.
  A.VBrakeOn = Math.round(0.75 * g.Vs * 10) / 10;

  // ---- energy: the decel-margin chain ------------------------------------
  // Steady descent on slope gs needs thrust D - W*gs. If that is below the
  // throttle floor the aeroplane accelerates for ever, which is the documented
  // DC-3/Jodel/C172 float. So the floor comes first, then the slope under it.
  //
  // thrFloor: idle thrust as a fraction of weight reads 0.0125 +/- 0.0035
  // across the four fiches that bother to set thrFloor. Back-substituted this
  // gives cub .057 dc3 .064 c172 .055 jodel .049 — i.e. it lands on their tuned
  // ~0.05 — and it fixes the drone, whose inherited 0.12 is 8% of its weight
  // and by itself makes any commanded slope steeper than its idle equilibrium.
  A.thrFloor = r3(cl(0.012 * g.W / Math.max(1, g.TavailAppr), 0.03, 0.12));
  const gsIdle = g.dragAppr / g.W - A.thrFloor * g.TavailAppr / g.W;
  // gs/gsIdle across the fleet: 0.574 +/- 0.13, or 0.532 +/- 0.10 excluding the
  // flapless Cub — whose 0.822 is exactly why it floats 90 m off a 340 m strip.
  A.gs = r3(cl(0.55 * gsIdle, 0.035, 0.10));
  // thrAppr is EXACT, not a fit: it is the throttle that trims the approach.
  // Every fiche's hand value sits within speedThrottle's +-0.30 integrator band
  // of its true one — "close enough by hand". A generated build whose true
  // approach throttle is 0.75 cannot get there from a 0.35 bias.
  A.thrAppr = r3(cl((g.dragAppr - g.W * A.gs) / Math.max(1, g.TavailAppr),
                    A.thrFloor, 0.85));

  // ---- attitude family, all anchored on the measured stall attitude -------
  // thMax/aStall = 0.672 +/- 0.043 (6%) over six fiches; the drone's 0.917 is
  // the outlier and is excluded.
  A.thMax = r3(cl(0.67 * g.aStall, 0.13, 0.26));
  // climbThBase/thMax = 0.594 +/- 0.028 (4.7%) — the tightest ratio here.
  // The physically obvious alpha(VClimb) + gammaClimb form fits WORSE (0.25 to
  // 0.75) because the probe has no propwash; the stall attitude is the right
  // normaliser, not the climb performance.
  A.climbThBase = r3(0.60 * A.thMax);
  // climbThGain*VClimb scatters 0.30-0.92 (3x): NO CLUSTER. The 1/V form at
  // least gets the trend right, and the old flat 0.030 sits inside the clamp.
  A.climbThGain = r3(cl(0.7 / A.VClimb, 0.012, 0.032));
  // liftoffTh/thMax = 0.790 +/- 0.048 (6%), additionally capped below the
  // three-point deck: doctrine, "a taildragger cannot rotate past 3-point".
  let liftoff = 0.79 * A.thMax;
  if (!trike) {
    const P = def.parts, G = S.gear;
    const twN = def.nodes[P.TW];
    const deck = Math.atan((((twN && twN.p[1]) || 0) - G.twR - (G.y - G.contactR))
                           / Math.max(0.1, P.twX - P.gx));
    if (isFinite(deck) && deck > 0.05) liftoff = Math.min(liftoff, 0.85 * deck);
  }
  A.liftoffTh = r3(liftoff);
  // flareThMax - alpha(1.10 VsFlap) = -0.056 +/- 0.031 on six of seven. The
  // SIGN is the doctrine ("flareThMax BELOW the L=W attitude kills float");
  // the chinook is the outlier because its body datum puts that alpha near 0.
  A.flareThMax = r3(Math.min(A.thMax, g.alphaTD - 0.055));
  // vsFloor is a REACHABILITY condition, not a fit. holdVS clamps the pitch
  // COMMAND to [vsFloor, thMax], so a floor above the attitude level flight
  // needs means the aeroplane climbs for ever — written out verbatim in the
  // chinook fiche, whose -0.017 margin is exactly why it was marginal.
  // Erring low is free; erring high is the reported bug.
  A.vsFloor = r3(cl(Math.min(g.alphaAppr - A.gs, g.alphaCruise - 2.2 / A.VCruise)
                    - 0.05, -0.30, -0.03));
  // flareAgl/(VAppr*gs) = 3.21 +/- 0.38 (12%): every fiche begins its flare
  // about 3.2 SECONDS before impact. Raw flareAgl scatters 4.5x.
  A.flareAgl = r3(cl(3.2 * A.VAppr * A.gs, 1.5, 12));
  // THE RAMP HAS TO GET THERE. flareAgl buys about 3.2 s, but a ramp that only
  // just reaches flareThMax at the end of it spends the whole flare short of
  // the attitude it is aiming for, and the aeroplane arrives still descending —
  // measured 2.5-3.5 m/s across the faster half of the envelope. Sizing the
  // rate to reach the flare attitude in 1.5 s and hold it there is worth
  // 1.3-1.9 m/s of sink on the same builds.
  //
  // MEASURED AND REJECTED: switching generated fiches to flareMode 'vs', which
  // is what drone/Jodel/C172/Chinook all carry. It made every sink WORSE
  // (stock 1.13 -> 1.63, heavyLoad 2.53 -> 3.39, flapped 2.58 -> 3.10) even
  // with the VS loop moved onto the fast family to fly it. The attitude ramp
  // stays.
  A.flareRate = r3(cl((A.flareThMax - (g.alphaAppr - A.gs)) / 1.5, 0.02, 0.30));

  // ---- circuit geometry --------------------------------------------------
  // hCruise/Vs = 7.70 +/- 1.1 (14%); hCruise/VCruise is worse (26%). 7.0 is
  // the light-aeroplane end of that band (cub 6.67, jodel 6.93, c172 7.56).
  // CAPPED BY WHAT IT CAN CLIMB: CLIMB only ever exits on reaching hCruise-8,
  // so a circuit height the aeroplane cannot reach is an infinite climb. 90 s
  // of climb at its own measured gradient is the budget.
  A.hCruise = Math.round(cl(Math.min(7.0 * g.Vs, 90 * A.VClimb * g.gammaClimb),
                            40, 220) / 5) * 5;
  A.hSafe = Math.round(cl(0.125 * A.hCruise, 6, 40));      // 0.124 +/- 0.014
  A.aglGuard = r3(cl(0.185 * A.hSafe, 1.5, 8));            // 0.183 +/- 0.027
  // xAim does NOT cluster against speed, mass or Vs — the only fiche that moved
  // it (DC-3) moved it to buy stopping room. So keep the constant and let the
  // cross-country clamp in the autopilot handle short strips.
  // xTurn: (|xTurn|-|xAim|)/(hCruise/gs) = 1.16 +/- 0.22 ex-drone. What that
  // ratio really encodes is the height above the slope at INBOUND entry, which
  // is -50..+25 m across the whole fleet: everyone turns in essentially ON the
  // slope. 1.2 keeps a generated build on the slightly-LOW side, which
  // INBOUND's level-until-intercept handles and the high side does not.
  // SECOND TERM: the descent is not the only thing that has to fit. TURNBACK is
  // a 180 at VTurn against bankLim, so the leg also has to be long enough to
  // fly that turn AND then capture the centreline from ~2R off it. Without it a
  // fast build simply runs out of circuit — measured 1037 m of cross-track at
  // touchdown on the radial build. bankLim is set below but is a constant, so
  // it is named here rather than read.
  const Rturn = A.VTurn * A.VTurn / (9.81 * Math.tan(GEN_BANKLIM));
  A.xTurn = Math.round(Math.min(A.xAim - 1.2 * A.hCruise / A.gs,
                                A.xAim - 4.0 * Rturn, -900));

  // ---- guidance and lateral ----------------------------------------------
  // NO CLEAN INVARIANT EXISTS for the cruise lookahead. Time scatters 5.8-15.5 s
  // (2.7x) and the doctrine's own turn-radius form is WORSE (5.7x) — the DC-3
  // and the C172 have the same speed (58) and the same turn radius (710) and
  // lookaheads of 900 against 450. The discriminator is roll-loop speed, but
  // L*wRoll/V scatters 23-176. So: fleet median, stated as such, and gated.
  A.lookCruise = Math.round(cl(8 * A.VCruise, 120, 1000));
  A.lookAppr = Math.round(A.lookCruise / 1.45);   // lookC/lookA 1.466 +/- 0.065
  A.lookRoll = Math.round(cl(1.2 * A.VRot, 20, 60));         // 1.12 +/- 0.13
  A.hdgP = 0.65;                                   // constant, fleet 0.6-0.9
  A.hdgD = r3(1.35 * A.hdgP);                      // hdgD/hdgP 1.39 +/- 0.18
  A.bankLim = GEN_BANKLIM;
  A.bankSlew = r3(cl(0.05 * wRoll, 0.05, 0.8));    // 0.048 +/- 0.021
  A.betaK = 0.30;                                  // 0.30 on all seven, exact
  A.yawDampK = 0.40;                               // no cluster; setters .30-.45
  // ARI is DESTABILIZING on high effective dihedral (Jodel's 14 degree crank
  // runs ariK 0, proven by ablation). A garage wing reaches 6 degrees plus a
  // crank plus dihedralOut, so fade it out rather than inherit the Cub's 0.35.
  const dih = (S.wings && S.wings[0] ? S.wings[0].dihedral : 0) || 0;
  A.ariK = dih > 4 ? 0 : 0.15;

  // ---- servo and filters -------------------------------------------------
  // Doctrine: "wrong-scale D-gains create slew-rate limit cycles; the cure is
  // always LOWER D + command slew, not more filtering." Both rates therefore
  // scale with the pitch loop the plant actually has.
  A.slew = r3(cl(0.40 * wPitch, 0.5, 3.0));        // slew/wPitch 0.39 +/- 0.10
  A.pitchCmdSlew = r3(cl(0.16 * wPitch, 0.2, 2.0));// 0.16 +/- 0.03 over 4 setters
  A.rateFilt = 0.15;    // fleet 0.12-0.20; NOT faster — a faster filter was
  A.attFilt = 0.70;     // measured to make the limit cycle worse (W16)
  A.altVSGain = 0.08;   // no cluster; six of seven sit in 0.06-0.10
  // vsI/vsP = 2.01 +/- 0.51 (adopt), but the ABSOLUTE value has no cluster at
  // all (V*vsI spreads 6x). The fleet splits by flare type: attitude-ramp
  // flares run slow VS loops (0.39-0.58), VS-targeted ones fast (0.72-2.44).
  // A generated fiche flies the attitude-ramp flare (see flareRate above), so
  // it belongs to the SLOW half of that split: target w_vs ~ 0.5 rad/s, capped
  // at wPitch/7 for loop separation. A bounded choice, not a fit.
  A.vsI = r3(Math.min(0.5, wPitch / 7) / A.VCruise);
  A.vsP = r3(A.vsI / 2);
  A.vsFilt = 0.5;

  // ---- ground ------------------------------------------------------------
  // rollDe has no cluster against anything measured; the only structure in the
  // fleet is trike-vs-taildragger, so take that and stop.
  A.rollDe = trike ? 0.02 : 0.10;
  if (def.params.flaps && !trike) {
    // the PA-18's documented cure: flap lift plus the nose-down dCm0 make a
    // tail-up wheel-landing hold noseover-prone, so pin the tail from touchdown
    A.VTailDown = 99;
    A.VPinFull = Math.round(1.05 * g.VsFlap * 10) / 10;
  }
  return A;
}

// ---------------------------------------------------------------------------
// SUBSTEPS. The solver is explicit, so the timestep has to suit the stiffest
// oscillator in the structure — which is why the hand fiches carry 24 (Cub),
// 48 (Jodel) and 72 (DC-3) rather than one number. A generated airframe picks
// its own material and its own stiffness scale, so it has to work this out.
//
// Two limits, and the DAMPING one binds first in practice. Measured on the
// fleet at their own substep counts: worst omega*dt is 0.50 (Jodel) and worst
// c*dt is 0.73 (Cub) — both stable. Spruce+ply on the Cub's 24 substeps ran at
// omega*dt 0.615 and c*dt 0.947 and diverged, which is the whole bug.
// The bounds below sit just inside the fleet's proven envelope.
const GEN_WDT_MAX = 0.45;      // omega * dt
const GEN_CDT_MAX = 0.65;      // damping rate * dt
function genSubsteps(nodes, beams) {
  let wMax = 0, cMax = 0;
  for (const b of beams) {
    // G121 (the review's B2): omega at DRY mass, not full-tanks mass. Fuel
    // is billed onto nodes and a beam's frequency RISES as its node lightens
    // — sized at full, a long-range build was stable on departure and headed
    // for the recorded divergence neighbourhood at reserves. The dry floor
    // guards a node that is mostly fuel. No fuel on the node = the old line.
    const dry = i => Math.max(0.5, nodes[i].m - (nodes[i].mFuel || 0));
    const inv = 1 / dry(b.a) + 1 / dry(b.b);           // 1/reduced mass, dry
    wMax = Math.max(wMax, Math.sqrt(b.k * inv));
    cMax = Math.max(cMax, b.c * inv);
  }
  const need = Math.max(wMax / (60 * GEN_WDT_MAX), cMax / (60 * GEN_CDT_MAX));
  // floor at 24: the whole fleet's minimum, and what the gated preset runs at
  return Math.min(200, Math.max(24, Math.ceil(need)));
}

// ---------------------------------------------------------------------------
// AUTOPILOT GAIN SYNTHESIS.
//
// HANDOVER doctrine: "gains scale with airframe timescale ~ span/V", and
// wrong-scale D-gains cause slew-rate limit cycles. Taken literally that says
// omega ~ 1/tau — but reconstructing the fleet's own hand-tuned gains through a
// plant model says otherwise. omega*tau(span/V) scatters 0.6-3.6 across the
// fleet, so it is NOT the invariant. Normalise instead by the plant's OWN
// damping time constant (Ixx/-Lp for roll, Iyy/-Mq for pitch) and the
// independently-tuned fiches collapse onto two numbers per axis:
//
//   axis   omega*tau_plant                        zeta
//   roll   cub .66 jodel .49 c172 .82 dc3 .56     1.63 1.68 1.57 1.91
//          chnk .58 drone 1.30                    2.38 1.34
//   pitch  cub 1.11 jodel 1.88 c172 1.30 dc3 1.37 2.92 1.72 2.15 1.78
//          chnk 1.25 drone 1.33                   1.31 0.95
//
// A 10.9 t DC-3 and a 230 kg Chinook agreeing within a factor of 1.7 is the
// physics showing through. The targets below are those clusters' centres.
// Measured need: placement offsets barely move the loop (roll omega*tau holds
// 0.61-0.62 across every offset) — it is WING SPAN that breaks it. At 13 m the
// untuned loop fell to 0.43 with zeta 2.50, both outside everything the fleet
// has ever flown.
const GEN_LOOP = { rollWT: 0.62, rollZeta: 1.70, pitchWT: 1.30, pitchZeta: 1.90 };

// Rigid-body plant at cruise: control authority, natural damping, inertias.
// Analytic from the strips — the same model the solver integrates, so these are
// the real numbers rather than an estimate of them.
function genPlant(nodes, strips, P, V) {
  // AT THE DATUM, deliberately: these gains size the autopilot's loops once,
  // at the design condition, and a real aeroplane's control throws do not
  // grow to compensate for thin air either. DECLARED CONSEQUENCE (G72): the
  // AP is honestly sloppier at altitude.
  const q = 0.5 * RHO * V * V;
  let M = 0, cx = 0, cy = 0, cz = 0;
  for (const n of nodes) { M += n.m; cx += n.p[0]*n.m; cy += n.p[1]*n.m; cz += n.p[2]*n.m; }
  cx /= M; cy /= M; cz /= M;
  let Ixx = 0, Iyy = 0;
  for (const n of nodes) {
    const dx = n.p[0]-cx, dy = n.p[1]-cy, dz = n.p[2]-cz;
    Ixx += n.m * (dy*dy + dz*dz); Iyy += n.m * (dx*dx + dy*dy);
  }
  const aW = P.polarWing.a3d, aT = P.polarTail.a3d;
  // ShC and ShD are the SAME area on a conventional tail and different on a V.
  // A ruddervator DEFLECTION makes alpha in the panel's own frame, so only the
  // force needs projecting: one cos. A pitch RATE reaches the panel through its
  // tilted normal and the force is projected again: two. Using one number for
  // both would over-damp a V-tail by cos G and mis-tune its pitch loop.
  let Lda = 0, Lp = 0, ShC = 0, ShD = 0, arm = 0;
  const px = ws => { let x = 0; for (const [i, w] of ws) x += nodes[i].p[0] * w; return x; };
  for (const st of strips) {
    if (st.kind === 'wing') {
      const zc = nodes[st.fIn].p[2] + (nodes[st.fOut].p[2] - nodes[st.fIn].p[2]) * st.t;
      Lp += st.area * zc * zc;                       // roll damping, all strips
      if (st.ail) Lda += st.area * st.ail * Math.abs(zc);
    } else if (st.kind === 'stab') {
      ShC += st.area; ShD += st.area; arm += st.area * (px(st.w) - cx);
    } else if (st.kind === 'vtail') {
      const c = st.cosV;
      ShC += st.area * c; ShD += st.area * c * c;
      arm += st.area * c * c * (px(st.w) - cx);
    }
  }
  Lda *= q * aW * P.ailTau;                          // roll moment per unit da
  Lp = -(q * aW / V) * Lp;                           // negative: it damps
  const lh = arm / Math.max(1e-6, ShD);
  return { M, Ixx, Iyy, Lda, Lp, lh,
           Mde: q * ShC * aT * P.elevTau * lh,       // pitch moment per unit de
           Mq: -(q * aT * ShD * lh * lh) / V };
}

// Second-order placement: omega^2 = C*P/I and 2*zeta*omega*I = C*D - damping.
function genGains(pl, params) {
  const g = (C, D, I, wt, zeta) => {
    const tau = I / Math.max(1e-9, -D);              // plant's own time constant
    const w = wt / tau;
    const kp = w * w * I / Math.max(1e-9, C);
    // D can come out negative on a plant that already damps itself past the
    // target — that is a real answer, and asking for negative rate feedback is
    // not. Floor it.
    const kd = Math.max(0.01, (2 * zeta * w * I + D) / Math.max(1e-9, C));
    return [kp, kd, w, tau];
  };
  const [rollP, rollD] = g(pl.Lda, pl.Lp, pl.Ixx, GEN_LOOP.rollWT, GEN_LOOP.rollZeta);
  const [pitchP, pitchD] = g(pl.Mde, pl.Mq, pl.Iyy, GEN_LOOP.pitchWT, GEN_LOOP.pitchZeta);
  const r = (v, lo, hi) => Math.round(Math.min(hi, Math.max(lo, v)) * 1000) / 1000;
  return {
    // The bounds are limit-cycle guards, not design limits: a big-span wing
    // legitimately asks for rollP ~4, and the servo slew plus the lagged rate
    // estimate are what eventually bite. Nothing in the fleet exceeds these.
    rollP: r(rollP, 0.15, 5), rollD: r(rollD, 0.02, 3),
    pitchP: r(pitchP, 0.3, 3), pitchD: r(pitchD, 0.05, 3),
    // "Trim-heavy stable aircraft need pitchI authority" (DC-3 0.05 -> 0.25).
    // A coarse fit on three points; the Cub's 0.05 is the floor by construction.
    pitchI: r(0.05 * Math.sqrt(pl.M / 377), 0.05, 0.25),
    _plant: pl,
  };
}

// Everything the fiche's params block needs, except the two numbers that can
// only come from a wind-tunnel run (stabTrim, thrCruise) — 64_gen_build.js
// measures those with sim.probe().
function genParams(S, fr, strips) {
  const M = GEN_MATERIALS[S.material];
  const G = S.geom;
  // G140: sweepEff — the legacy field verbatim, or the area-weighted |LE
  // sweep| the three-station law derives (resolveSpec sets it either way)
  const polarWing = genPolar(S.wing.naca, G.AR, S.wing.strut, M.cd0, M.clmaxK,
                             S.wing.sweepEff != null ? S.wing.sweepEff : S.wing.sweep,
                             (GEN_TIPS[S.wing.tip] || GEN_TIPS.rounded).e);
  const hAR = S.tail.hSpan * S.tail.hSpan / S.tail.Sh;
  const polarTail = genTailPolar(hAR, M.cd0);
  // G115 (the review's S4): the FIN flies on its OWN aspect ratio. It flew
  // the stabiliser's for its whole life — hAR 3.7 against a real vAR of 1.9 —
  // which overstated directional stiffness and rudder power by ~25% and made
  // fin PROPORTIONS a slider that moved nothing. vHeight²/Sv is the honest
  // number, and it moves when the builder reshapes the fin. The fleet's
  // fiches never set polarFin, so the solver's fallback keeps them exact.
  const vAR = S.tail.vHeight * S.tail.vHeight / Math.max(1e-6, S.tail.Sv);
  const polarFin = genTailPolar(vAR, M.cd0);
  const mass = fr.cg0[3];
  const ClMax3D = polarWing.Cl0 + polarWing.a3d * polarWing.aStall;
  // Vs is an EQUIVALENT airspeed, and always was: it is computed in the datum
  // air (RHO), not in the air the aeroplane happens to be in. G72 only made
  // that explicit — the literal used to say 1.225 as if it were a fact about
  // the sky rather than the definition of the yardstick.
  const Vs = Math.sqrt(2 * mass * 9.81 / (RHO * G.Sw * ClMax3D));
  const cda = genFusCdA(S, fr);
  // G115: the undercarriage and bracing join the drag build-up, as a DELTA
  // from the calibration's implicit reference gear (see genGearCdADelta).
  // Axial only — the cross-flow blobs keep the body's own calibrated numbers.
  const gearDCdA = genGearCdADelta(S, S.geom.semi);
  cda.fusCdA[0] += gearDCdA;
  // Control effectiveness from surface chord. The reference pairs are the
  // fleet's own calibrated numbers at the default chord fractions, so a stock
  // aeroplane reproduces them exactly and theory only supplies the trend.
  const CT = S.controls;
  const elevTau = genTauAt(CT.elevator.chord, 0.40, 0.50);
  const rudTau  = genTauAt(CT.rudder.chord,   0.42, 0.55);
  const ailTau  = genTauAt(CT.aileron.chord,  0.22, 0.35);
  // High lift. dCl scales off the reference chord the table is quoted at; the
  // pitching moment is DERIVED from the lift increment, not chosen separately
  // (see GEN_FLAP_CM — both flapped fiches agree on the ratio).
  const FL = GEN_FLAPS[CT.flap.type];
  let flaps;
  if (FL.dCl > 0) {
    const kc = genFlapTau(CT.flap.chord) / genFlapTau(GEN_FLAP_CREF);
    const dCl0 = FL.dCl * kc;
    flaps = { to: 0, ldg: 1, rate: FL.rate, dCl0,
              dCd0: FL.cd * kc, dAStall: 0.02, dCm0: GEN_FLAP_CM * dCl0 };
  }
  const P0 = { polarWing, polarTail, elevTau, ailTau };
  const ap = genAP(S, Vs, mass);
  // synthesise the attitude-loop gains from the plant this airframe actually
  // is, rather than inheriting the Cub's
  const pl = genPlant(fr.nodes, strips, P0, ap.VCruise);
  Object.assign(ap, genGains(pl, P0));
  return {
    name: S.name, viewDist: Math.max(9, 1.4 * S.wing.span),
    powerplant: S.engine,
    // G134: the def carries its OWN engine facts — the solver's aspiration
    // read, the plaque's engine line and the coming burn/ventilation models
    // consume these instead of re-looking-up the registry at runtime. For a
    // fiche this IS the registry row's engine dict, so nothing moves.
    engine: (S.pplant || POWERPLANTS[S.engine]).engine,
    // HOW MANY ENGINES, which is NOT how many mount nodes. `refs.engine` is the
    // two mount points of one engine here, and the solver used to multiply
    // thrust by its length — so a generated single fell on 2x its own prop.
    // Stated explicitly rather than left to the solver's `|| 1` fallback: a twin
    // is a real aeroplane in this spec and the day `engines` has two entries
    // this must already be right.
    nEngines: S.engines.length,
    // THE PROP IS THE AEROPLANE'S, not the powerplant's. The solver prefers this
    // over POWERPLANTS[powerplant].prop when it is present, and a fiche never
    // sets it — so the fleet reads the registry exactly as before.
    prop: { D: S.prop.D, Tstatic: S.prop.Tstatic, kV2: S.prop.kV2 },
    substeps: genSubsteps(fr.nodes, fr.beams),
    polarWing, polarTail, polarFin,
    elevTau, rudTau, ailTau, downwash: 0.40,
    flaps,
    stabTrim: 0, sparSpacing: fr.parts.sparSpacing,
    fusCdA: cda.fusCdA, fusCdAAft: cda.fusCdAAft,
    // the solver turns the rolling direction by -twSteer*dr, so a NOSEwheel
    // wants the opposite sign from a tailwheel (C172 fiche, sign verified there)
    twSteer: S.gear.type === 'tricycle' ? -0.35 : 0.5,
    ap,
    gen: { Vs, ClMax3D, Sw: G.Sw, AR: G.AR, cBar: G.cBar, mass,
           Sh: S.tail.Sh, Sv: S.tail.Sv, hAR, vAR, gearDCdA, plant: pl },
  };
}
// ============================================================
// THE WING, AND THE MESH TOOLS THE GENERATOR IS BUILT FROM.
//
// This file was GARAGE 4/5's SKIN until G67.1 — genSkin, which built the
// whole aeroplane from the truss. The cage replaced every part of that
// except the WING, which `_cage_wing.js` builds out of here on every cage
// build, so the wing was lifted out into genWingInto/genWing and the rest
// was deleted. See the note where genSkin stood.
//
// THE FRAME IS THE SURFACE, and that is still the point of it. Every wing
// vertex is an affine blend of the truss nodes it sits on (weights summing
// to 1), so the covering follows the structure exactly and there is nothing
// to calibrate: the mount offset every imported model needs is [0,0,0] here
// BY CONSTRUCTION. It gets wing flex for free for the same reason —
// SKIN-PROC.md §6 lists that as deferred for imported skins, because binding
// a foreign mesh to a truss is the hard part, and generating the mesh from
// the truss makes it trivial.
//
// What is left here, in order: the mesh accumulator and the small solid
// builders, the rest frame, the aerofoil evaluators, the loft pair, one
// beam, the paint row, THE WING, and the pose/rest helpers the viewer uses
// to fly whatever it was handed.
// ============================================================
// ============================================================

// how far inside the covering the liner sits. Big enough that no pair of faces
// z-fights at any camera distance, small enough that the wall never reads as a
// thickness: 18 mm on an aeroplane whose fuselage is a metre across.
const INTR_T = 0.018;
const GEN_TUBE_R = { fus: 0.016, wing: 0.020, gear: 0.024 };
// FUSELAGE SECTION RESOLUTION. 40, not 20, because the cabin opening's sill is
// a RING INDEX — `round(sill * GEN_RADIAL / 2)` — so this constant is also the
// number of sill positions the slider can reach and how finely the cut can
// follow the deck. At 20 the canopy's lower edge steps visibly. It is the main
// driver of the triangle count; see the perf note in HANDOVER.
const GEN_RADIAL = 40;
// Wheel resolution, around. 18 read as a dodecagon from a metre away — a wheel
// is the one part of this aeroplane whose silhouette is a circle and the eye
// knows it. 24 costs 684 more triangles across three wheels.
const GEN_WHEEL_SEG = 24;
// Where the cowl's lofted cover stops in its own sheet. Above it is the flat
// nose face, mapped as a rim strip (see the cowl block).
const GEN_COWL_V = 0.88;

// STREAMLINE SECTION for the external lift struts. A real lift strut is a
// streamline tube — ~3.5:1 fineness, chord fore-and-aft — and a round bar in
// its place is the most model-kit thing on a strut-braced aeroplane: it has no
// direction, so it reads as scaffolding rather than as structure.
// Closed loop, TE -> upper -> LE -> lower; chord fraction and half-thickness.
const GEN_STRUT_SECT = [
  [1.00,  0.000], [0.86,  0.036], [0.72,  0.068], [0.57,  0.094],
  [0.42,  0.111], [0.29,  0.118], [0.18,  0.111], [0.10,  0.092],
  [0.04,  0.059], [0.00,  0.000],
  [0.04, -0.059], [0.10, -0.092], [0.18, -0.111], [0.29, -0.118],
  [0.42, -0.111], [0.57, -0.094], [0.72, -0.068], [0.86, -0.036],
];
// NOTE: the design session also carried a GEN_SPIN_SECT and a rebuilt propeller.
// That work was dismissed, and the propeller here is the trunk's — which is not
// decoration: `prop` is a top-level spec group whose disc area drives static
// thrust and propwash and whose blades weigh something at the very front. Do NOT
// restore the propeller from the session bundle's `gen/orig/`; orig predates the
// trunk's rebuild, and taking it would silently delete it.

// A WHEEL IS A REVOLVED PROFILE, not a cylinder with two flat lids. Fractions
// of the wheel radius and of the half-width, walked from one bead round to the
// other. The widest point is at 84% of the radius because an aviation tyre is
// fat and round-shouldered; the flat-sided cylinder these replace was most of
// the "wheel meshes are ugly" report.
// The bead sits at 42% of the radius because that is where an aviation tyre's
// rim is: an 8.00-6 is a 6 inch rim inside a 16 inch tyre. Drawn first at 55%
// and the wheel came out as a pale disc with a band of rubber round it.
const GEN_TYRE_SECT = [
  [0.42, -0.44], [0.62, -0.86], [0.80, -1.00], [0.92, -0.90],
  [0.99, -0.58], [1.00, -0.20], [1.00,  0.20], [0.99,  0.58],
  [0.92,  0.90], [0.80,  1.00], [0.62,  0.86], [0.42,  0.44],
];
// The wheel under it: hub cap, dished disc, and the rim barrel the beads sit
// on. Its flange point IS the tyre's bead point, so the two meet exactly and
// there is no gap to close. Deliberately axisymmetric — no bolt heads, no
// spokes — because nothing spins the wheel and a bolt circle that never moves
// is worse than none.
const GEN_HUB_SECT = [
  [0.00, -0.26], [0.10, -0.26], [0.17, -0.23], [0.30, -0.26], [0.42, -0.44],
  [0.42,  0.44], [0.30,  0.26], [0.17,  0.23], [0.10,  0.26], [0.00,  0.26],
];
const GEN_LSEG = 4;             // lengthwise slices per fuselage bay
const GEN_WSEG = 2;             // spanwise slices per wing bay
const GEN_AF = 22;              // airfoil points per surface

// ---- mesh accumulator ------------------------------------------------------
// infl: [[nodeIndex, weight], ...], at most GEN_INFL entries, weights sum to 1.
// 8, because a section between two frames blends both frames' four corners.
const GEN_INFL = 8;
function genMesh() {
  return {
    pos: [], uv: [], sid: [], idx: [], wi: [], ww: [],
    v(p, u, vv, infl, sidv) {
      this.pos.push(p[0], p[1], p[2]);
      this.uv.push(u, vv);
      this.sid.push(sidv || 0);
      for (let k = 0; k < GEN_INFL; k++) {
        const e = infl[k];
        this.wi.push(e ? e[0] : (infl[0] ? infl[0][0] : 0));
        this.ww.push(e ? e[1] : 0);
      }
      return this.pos.length / 3 - 1;
    },
    tri(a, b, c) { this.idx.push(a, b, c); },
    quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); },
    done() {
      const nv = this.pos.length / 3;
      return {
        nv, nt: this.idx.length / 3,
        pos: Float32Array.from(this.pos), uv: Float32Array.from(this.uv),
        idx: nv > 65535 ? Uint32Array.from(this.idx) : Uint16Array.from(this.idx),
        sid: Uint8Array.from(this.sid),
        wi: Int32Array.from(this.wi), ww: Float32Array.from(this.ww),
      };
    },
  };
}

// One paint texture serves the whole aeroplane, so the UV space is split into
// two zones: BODY takes v 0.03..0.47 (u = angle around the section, v = station
// along the body) and PANEL takes v 0.53..0.97 (u = chord fraction, v = span).
// A stripe drawn across u therefore runs fore-and-aft on the fuselage and
// spanwise on the wing, which is what both want.
const genUVBody = t => 0.03 + 0.44 * Math.max(0, Math.min(1, t));
const genUVPanel = t => 0.53 + 0.44 * Math.max(0, Math.min(1, t));

const genV3 = {
  sub: (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]],
  add: (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]],
  mul: (a, s) => [a[0]*s, a[1]*s, a[2]*s],
  cross: (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]],
  norm: a => { const L = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0]/L, a[1]/L, a[2]/L]; },
};

// Rest body frame, computed with the same formula the solver's bodyAxes() uses
// so the generated skin lands in exactly the frame poseModel() will pose it in.
function genRestFrame(def) {
  const N = def.nodes, R = def.refs;
  const avg = ids => {
    const o = [0, 0, 0];
    for (const i of ids) { o[0] += N[i].p[0]; o[1] += N[i].p[1]; o[2] += N[i].p[2]; }
    return genV3.mul(o, 1 / ids.length);
  };
  const xA = genV3.norm(genV3.sub(avg(R.tailMid), avg(R.noseFrame)));
  let yU = genV3.norm(genV3.sub(avg(R.upHi), avg(R.upLo)));
  const zL = genV3.norm(genV3.cross(xA, yU));
  yU = genV3.norm(genV3.cross(zL, xA));
  let x = 0, y = 0, z = 0, m = 0;
  for (const n of N) { x += n.p[0]*n.m; y += n.p[1]*n.m; z += n.p[2]*n.m; m += n.m; }
  const cg = [x/m, y/m, z/m];
  return { cg, xA, yU, zL,
    // world point -> body coordinates
    to(p) {
      const d = genV3.sub(p, cg);
      return [d[0]*xA[0]+d[1]*xA[1]+d[2]*xA[2],
              d[0]*yU[0]+d[1]*yU[1]+d[2]*yU[2],
              d[0]*zL[0]+d[1]*zL[1]+d[2]*zL[2]];
    } };
}

// NACA 4-digit section. Returns closed contour, TE -> upper -> LE -> lower -> TE,
// in (chordFrac, thicknessFrac) with cosine spacing so the nose is resolved.
function genAirfoil(naca) {
  const { m, p, t } = nacaParts(naca);
  const yc = x => x <= p ? (m/(p*p))*(2*p*x - x*x) : (m/((1-p)*(1-p)))*((1-2*p) + 2*p*x - x*x);
  const dyc = x => x <= p ? (2*m/(p*p))*(p - x) : (2*m/((1-p)*(1-p)))*(p - x);
  const yt = x => 5*t*(0.2969*Math.sqrt(x) - 0.1260*x - 0.3516*x*x + 0.2843*x*x*x - 0.1015*x*x*x*x);
  const up = [], lo = [];
  for (let i = 0; i <= GEN_AF; i++) {
    const x = 0.5 * (1 - Math.cos(Math.PI * i / GEN_AF));
    const th = Math.atan(dyc(x)), s = Math.sin(th), c = Math.cos(th), T = yt(x);
    up.push([x - T*s, yc(x) + T*c]);
    lo.push([x + T*s, yc(x) - T*c]);
  }
  // TE closes on the mean line; walk upper aft->fwd then lower fwd->aft
  const pts = [];
  for (let i = up.length - 1; i >= 1; i--) pts.push(up[i]);
  pts.push([0, yc(0)]);
  for (let i = 1; i < lo.length; i++) pts.push(lo[i]);
  return pts;                                   // open contour, TE..LE..TE
}

// Aerofoil as EVALUATORS rather than a fixed point list, so a section can be
// resampled between any two chord fractions with a chosen point count. That is
// the whole trick behind separated control surfaces: the fixed wing is lofted
// over [0..hinge] and the surface over [hinge..1], both with constant row
// lengths, so each is its own closed mesh and neither has to know about the
// other. Sampling BOTH at the same parameter `hinge` makes the cove and the
// surface's leading edge the same points by construction — no gap to close.
function genAfEval(naca) {
  const { m, p, t } = nacaParts(naca);
  const yc = x => x <= p ? (m/(p*p))*(2*p*x - x*x) : (m/((1-p)*(1-p)))*((1-2*p) + 2*p*x - x*x);
  const dyc = x => x <= p ? (2*m/(p*p))*(p - x) : (2*m/((1-p)*(1-p)))*(p - x);
  const yt = x => 5*t*(0.2969*Math.sqrt(Math.max(0,x)) - 0.1260*x - 0.3516*x*x
                       + 0.2843*x*x*x - 0.1015*x*x*x*x);
  const at = (x, sgn) => {
    const th = Math.atan(dyc(x)), T = yt(x);
    return [x - sgn * T * Math.sin(th), yc(x) + sgn * T * Math.cos(th)];
  };
  return { up: x => at(x, 1), lo: x => at(x, -1) };
}

// Closed section between chord fractions a..b: upper walked b->a, then lower
// a->b. Treated as a LOOP, so the cove (upper-a to lower-a) and the trailing
// edge (lower-b back to upper-b) both close for free.
function genAfSeg(naca, a, b, n) {
  const E = genAfEval(naca);
  const xs = i => a + (b - a) * 0.5 * (1 - Math.cos(Math.PI * i / n));
  const pts = [];
  for (let i = n; i >= 0; i--) pts.push(E.up(xs(i)));
  for (let i = 0; i <= n; i++) pts.push(E.lo(xs(i)));
  return pts;
}

// Station cross-section: an asymmetric SUPERELLIPSE, thin wrapper over
// genSuper (60b_gen_loft.js). theta 0 = top, +pi/2 = +z side, pi = bottom.
// crownT applies at the top and fades to crownS by the sides.
//
// This used to be a per-angle LINEAR BLEND between an axis-aligned rectangle and
// an ellipse, and it carried a defect nobody had named. The rectangle's radius
// min(halfD/|cy|, halfW/|cz|) has a derivative discontinuity at each of its four
// corners, so for ANY crown < 1 the blend inherited four C1 breaks around EVERY
// ring — at the stock crownSide 0.07 the belly and sides were a creased
// rectangle running the whole length of the aeroplane. Measured at the real
// GEN_RADIAL = 40 tessellation, where a uniform ring turns 9.00 deg per vertex:
//
//   crownT/crownS   old       new
//   0.72 / 0.07     63.92 ->  37.12 deg     (the stock aeroplane)
//   0.50 / 0.50     43.28 ->  18.36
//   0.00 / 0.00     66.46 ->  42.15
//   1.00 / 1.00     11.11 ->  11.11         (already an ellipse: unchanged)
//
// crownTop and crownSide keep their spec paths and their meaning; they are
// reinterpreted as exponents by genCrownToN, which is a least-squares fit of
// genSuper against the genRing this replaces. See 60b_gen_loft.js for the fit
// table and for why the residual at crown = 0 is large on purpose.
function genRing(theta, halfW, halfD, crownT, crownS) {
  // the proud-former scale is blended by the SAME smoothstep genSuper uses on
  // the exponent — with max(0, cy) the two disagreed at the waterline, which is
  // precisely where a step in the section reads worst
  const s = Math.max(0, Math.cos(theta));
  const k = genCrownScale(crownS + (crownT - crownS) * s * s * (3 - 2 * s));
  return genSuper(theta, halfW * k, halfD * k,
                  genCrownToN(crownT), genCrownToN(crownS));
}

// A member drawn between two nodes has to STRETCH with them. Otherwise the
// suspension travel it exists to show slides the whole leg down instead of
// compressing it, and the leg parts company with both the axle and the
// airframe. So the sweep helpers take their influence as a FUNCTION of position
// along the sweep as well as a fixed array.
const genInfl = infl => (typeof infl === 'function' ? infl : () => infl);
const genSpanInfl = (a, b) => t => [[a, 1 - t], [b, t]];

// generic swept tube, used for the engine block's cylinders and shaft
function genTubeInto(M, A, C, r, seg, infl, B) {
  const ax = genV3.norm(genV3.sub(C, A));
  const up = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1 = genV3.norm(genV3.cross(ax, up)), e2 = genV3.cross(ax, e1);
  const IN = genInfl(infl);
  const rings = [A, C].map((base, s) => {
    const row = [];
    for (let h = 0; h <= seg; h++) {
      const a = 2 * Math.PI * (h % seg) / seg;
      const off = genV3.add(genV3.mul(e1, r * Math.cos(a)), genV3.mul(e2, r * Math.sin(a)));
      row.push(M.v(B(genV3.add(base, off)), h / seg, s, IN(s)));
    }
    return row;
  });
  for (let h = 0; h < seg; h++)
    M.quad(rings[0][h], rings[0][h+1], rings[1][h+1], rings[1][h]);
  // The two caps face OPPOSITE ways, so they cannot share a winding. Both used
  // to be wound the C end's way, which left every A-end cap in the aeroplane
  // lit from inside — invisible on the engine cylinders it was written for
  // (they are buried in the block) and not invisible at all on a gear leg.
  for (const [row, base, s] of [[rings[0], A, 0], [rings[1], C, 1]]) {
    const c = M.v(B(base), 0.5, 0.5, IN(s));
    for (let h = 0; h < seg; h++)
      if (s) M.tri(c, row[h], row[h+1]); else M.tri(c, row[h+1], row[h]);
  }
}

// Revolved solid about an axle. `sect` is [[r/R, w/halfW], ...] walked from one
// side to the other; a row at r = 0 collapses to a single apex vertex, which is
// how the hub caps itself.
//
// UV is the point of this helper. u = angle around the wheel, v = ARC LENGTH
// along the section, normalised — so a texture drawn for it appears exactly as
// drawn: a band at v = 0.5 is the crown, a band near v = 0 or 1 is a sidewall,
// and neither stretches. The wheel this replaced put v = 0 on one flat face and
// v = 1 on the other, so both sidewalls were a single texel row smeared over a
// triangle fan and nothing could be painted on them at all.
//
// Winding: (b-a) runs +angle and (c-a) runs +section, which puts the computed
// normal outward. Getting it backwards leaves the wheel lit from inside.
function genRevolveInto(M, c, axis, R, halfW, sect, seg, infl, B) {
  const ax = genV3.norm(axis);
  const up = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1 = genV3.norm(genV3.cross(ax, up)), e2 = genV3.cross(ax, e1);
  const L = [0];
  for (let i = 1; i < sect.length; i++)
    L.push(L[i-1] + Math.hypot((sect[i][0] - sect[i-1][0]) * R,
                               (sect[i][1] - sect[i-1][1]) * halfW));
  const tot = L[L.length - 1] || 1;
  const rows = sect.map((s, i) => {
    const rr = s[0] * R, base = genV3.add(c, genV3.mul(ax, s[1] * halfW)), v = L[i] / tot;
    if (rr < 1e-6) return { apex: M.v(B(base), 0.5, v, infl) };
    const row = [];
    for (let h = 0; h <= seg; h++) {
      const a = 2 * Math.PI * (h % seg) / seg;
      row.push(M.v(B(genV3.add(base,
        genV3.add(genV3.mul(e1, rr * Math.cos(a)), genV3.mul(e2, rr * Math.sin(a))))),
        h / seg, v, infl));
    }
    return { row };
  });
  for (let i = 0; i < rows.length - 1; i++) {
    const A = rows[i], C = rows[i+1];
    for (let h = 0; h < seg; h++) {
      // `!= null`, not truthiness: an apex is a vertex INDEX and the hub's first
      // one is index 0
      if (A.apex != null) M.tri(A.apex, C.row[h+1], C.row[h]);
      else if (C.apex != null) M.tri(C.apex, A.row[h], A.row[h+1]);
      else M.quad(A.row[h], A.row[h+1], C.row[h+1], C.row[h]);
    }
  }
}

// Swept RECTANGULAR section, for the spring-steel gear leg. A leaf spring is a
// flat tapered bar and nothing else reads as one: half-dimensions are given at
// both ends so it tapers. The broad face comes out perpendicular to the leg and
// horizontal, which puts it fore-and-aft on a main leg (a Cessna leg, bending
// vertically) and across the aeroplane on a tailwheel leg (which is also right
// — one rule, both correct).
function genBladeInto(M, A, C, w0, t0, w1, t1, infl, B) {
  const ax = genV3.norm(genV3.sub(C, A));
  const up = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1 = genV3.norm(genV3.cross(ax, up));           // broad
  const e2 = genV3.cross(ax, e1);                       // thin
  const CN = [[-1, -1], [1, -1], [1, 1], [-1, 1]];      // +angle order, as the revolve
  const IN = genInfl(infl);
  const rows = [[A, w0, t0], [C, w1, t1]].map(([base, w, t], s) =>
    CN.map(([su, sv], i) => M.v(B(genV3.add(base,
      genV3.add(genV3.mul(e1, su * w), genV3.mul(e2, sv * t)))), i / 4, s, IN(s))));
  for (let i = 0; i < 4; i++)
    M.quad(rows[0][i], rows[0][(i+1)%4], rows[1][(i+1)%4], rows[1][i]);
  M.quad(rows[0][3], rows[0][2], rows[0][1], rows[0][0]);
  M.quad(rows[1][0], rows[1][1], rows[1][2], rows[1][3]);
}

// The bungee wrap: a revolve about the LEG axis whose radius ripples, so one
// ripple is one turn of cord. Built rather than tabled because the turn count
// is the only thing that makes it read as cord.
// The valleys must stay OUTSIDE the leg they wrap — measured on screen, at
// 0.72 +- 0.28 of a 1.15 r0 wrap they dipped just inside the 0.55 r0 tube, so
// the steel showed through between the turns and the whole wrap read as a chain
// of pale beads instead of dark cord. 0.80 +- 0.20 of 1.30 r0 keeps the tightest
// turn at 0.78 r0, comfortably clear.
function genBungeeSect(turns) {
  const pts = [], n = turns * 4;
  for (let i = 0; i <= n; i++)
    pts.push([0.80 + 0.20 * Math.cos(2 * Math.PI * turns * (i / n) - Math.PI),
              -1 + 2 * (i / n)]);
  return pts;
}

// THE SUSPENSION IS VISIBLE. Bungee, spring steel and oleo were three numbers
// with identical geometry — "springing has no visual feedback" — and they are
// three completely different pieces of hardware. A = the axle end, C = the
// airframe end; `rb` is the gear tube radius everything is sized against.
// Returns the mesh the cord (if any) went into, so the caller can group it.
function genGearLegInto(steel, rubber, A, C, kind, rb, nA, nC, B) {
  const d = genV3.sub(C, A), L = Math.hypot(d[0], d[1], d[2]);
  const at = t => genV3.add(A, genV3.mul(d, t));
  // the sweep helpers take t along their own span, which has to be remapped
  // onto the leg's when a piece covers only part of it
  const span = genSpanInfl(nA, nC);
  const part = (t0, t1) => t => span(t0 + (t1 - t0) * t);
  if (kind === 'spring') {
    // 76 mm x 20 mm at the top, tapering to 58 x 13 at the axle — a Cessna leg
    genBladeInto(steel, A, C, 1.15*rb, 0.28*rb, 1.60*rb, 0.42*rb, span, B);
  } else if (kind === 'oleo') {
    // two stages with a visible step: the piston below, the cylinder above it
    genTubeInto(steel, A, at(0.52), 0.62*rb, 8, part(0, 0.52), B);
    genTubeInto(steel, at(0.45), C, 1.05*rb, 8, part(0.45, 1), B);
  } else {
    // a thin steel leg with the cord wrapped round it, low down where it shows
    genTubeInto(steel, A, C, 0.55*rb, 8, span, B);
    // the wrap rides at one point on the leg rather than stretching along it:
    // it spans a third of the leg and its own stretch is under a millimetre
    const c0 = 0.10, c1 = 0.46;
    genRevolveInto(rubber, at(0.5*(c0+c1)), d, 1.30*rb, 0.5*(c1-c0)*L,
                   genBungeeSect(4), 10, span(0.5*(c0+c1)), B);
  }
}

// axis-aligned box, for the crankcase
function genBoxInto(M, lo, hi, infl, B) {
  const V = [];
  for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]])
    V.push(M.v(B([x, y, z]), (x === lo[0] ? 0 : 1), (y === lo[1] ? 0 : 1), infl));
  // index bits: x*4 + y*2 + z
  const q = (a, b, c, d) => M.quad(V[a], V[b], V[c], V[d]);
  q(0,1,3,2); q(4,6,7,5); q(0,4,5,1); q(2,3,7,6); q(0,2,6,4); q(1,5,7,3);
}

// ONE BEAM, DRAWN (G67.1). Lifted out of genSkin's beam loop unchanged, so
// the WING'S LIFT STRUTS can be drawn by genWing without a second copy of the
// streamline section living anywhere. The loop above it still decides WHICH
// mesh a beam belongs in — that decision is about the aeroplane, not about
// the tube — and hands it in.
function genBeamInto(M, b, N, B) {
  const w1 = i => [[i, 1]];
    const A = N[b.a].p, C = N[b.b].p;
    const ax = genV3.norm(genV3.sub(C, A));
    const up = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    let e1 = genV3.norm(genV3.cross(ax, up)), e2 = genV3.cross(ax, e1);
    // 9 mm across for a wire: still about twice a real tie rod, so it reads at
    // distance, but 12 mm left the tailwheel looking braced by scaffolding poles
    const r = b.vis === 'wire' ? 0.0045 : GEN_TUBE_R[b.cls] * (b.ext ? 1.15 : 1);
    // Only a wing's external member is a lift strut. Every `vis === 'wire'` beam
    // 61_gen_frame.js emits is `cls: 'gear'`, so no wire reaches this branch.
    const lift = b.ext && b.cls === 'wing';
    if (lift) {
      // chord fore-and-aft: body x, projected perpendicular to the strut axis
      const d = ax[0];
      e1 = genV3.norm([1 - ax[0] * d, -ax[1] * d, -ax[2] * d]);
      e2 = genV3.norm(genV3.cross(ax, e1));
    }
    const SEG = lift ? GEN_STRUT_SECT.length : 8;
    const cw = 3.6 * r;
    const off = h => lift
      ? genV3.add(genV3.mul(e1, (GEN_STRUT_SECT[h][0] - 0.40) * cw),
                  genV3.mul(e2, GEN_STRUT_SECT[h][1] * cw))
      : genV3.add(genV3.mul(e1, r * Math.cos(2 * Math.PI * h / SEG)),
                  genV3.mul(e2, r * Math.sin(2 * Math.PI * h / SEG)));
    const ring = [];
    for (let s = 0; s < 2; s++) {
      const nd = s ? b.b : b.a, base = s ? C : A, row = [];
      for (let h = 0; h < SEG; h++)
        row.push(M.v(B(genV3.add(base, off(h))), h / SEG, s, w1(nd)));
      ring.push(row);
    }
    for (let h = 0; h < SEG; h++)
      M.quad(ring[0][h], ring[0][(h+1)%SEG], ring[1][(h+1)%SEG], ring[1][h]);
    for (const s of [0, 1]) {
      const row = ring[s], nd = s ? b.b : b.a;
      const c0 = M.v(B(s ? C : A), 0.5, 0.5, w1(nd));
      for (let h = 0; h < SEG; h++)
        if (s) M.tri(c0, row[h], row[(h+1)%SEG]);
        else   M.tri(c0, row[(h+1)%SEG], row[h]);
    }
}

// THE PAINTED ROW, once. Nine groups wear the aeroplane's livery — the
// covering, four wing surfaces and four tail surfaces — and until G67.1 came
// to split this file they were nine identical object literals, which is nine
// places to change the day the paint gains a coat. It is a function of the
// spec because that is all it ever was.
const genPaintRow = S => ({ tex: 'paint', color: S.paint.base, nrm: 'bump',
                            nrmScale: 0.9, mr: 'mr',
                            rough: 1 - S.paint.gloss });

// ---------------------------------------------------------------------------
// THE WING (G67.1) — the one half of this file the cage never replaced
// ---------------------------------------------------------------------------
// `_cage_wing.js` builds the wing of every cage build — the aeroplane that
// FLIES — out of this code: the covering, the tips, the ailerons, the flaps,
// the carry-through and the pitot mast. So when G67.1 came to retire the old
// generated skin it found the wing living inside it, and the answer is this:
// the wing becomes a thing of its own that both callers use, rather than a
// stretch of a 2600-line function that only one of them can reach.
//
// IT IS A MOVE, NOT A REWRITE, and that distinction is the whole risk of the
// chantier: a wing that came out three millimetres thinner, or with its rib
// stations off by one, or with its UV zone shifted (which is where G68.1's
// surface field comes from) would look completely normal and be wrong. Every
// line below is the line that was in genSkin. `tools/_wing_split.js` froze
// thirteen wings as digests over every position, every uv and every binding
// weight BEFORE the move and compares after — and it is negative-verified: a
// one-millimetre nudge on a single vertex fails it on every case.
//
// The caller hands over the meshes to write into, because the wing shares two
// of them with the fuselage — its covering goes in `skin` beside the body's,
// and a GLASS carry-through goes in `canopy` beside the windscreen's — and
// that sharing is the reason the split is a seam rather than a cut. What
// comes back is the handful of numbers the rest of genSkin still needs: the
// hinge fractions and band ends, which the control-surface hinge table reads.
function genWingInto(def, out) {
  const S = def.spec, P = def.parts, N = def.nodes;
  const B = out.B, skin = out.skin, pitot = out.pitot, canopy = out.canopy;
  const CTRL_MESH = out.ctrl;
  // ---- 3. wing --------------------------------------------------------
  // A section at every spar station, lofted along the span. Chordwise position
  // is affine on the two spar nodes (the spars ARE the chord frame, so the
  // weights are exact and extrapolate past LE and TE); the thickness offset is
  // a rest-frame constant, which is what `base` carries.
  const af = genAirfoil(S.wing.naca);
  const sparF = P.sparFront, sparR = P.sparRear;
  const kOf = xc => (xc - sparF) / (sparR - sparF);
  // Hinge lines follow the chords the player actually set, so a 30% aileron
  // LOOKS like a 30% aileron. The flap band is inboard, the aileron outboard,
  // and clampSpec has already guaranteed the gap between them.
  const CTL = S.controls;
  const aStart = (1 - CTL.aileron.span) * S.geom.semi;
  const AIL_HINGE = 1 - CTL.aileron.chord;
  const FLAP_ON = GEN_FLAPS[CTL.flap.type].dCl > 0;
  const fEnd = FLAP_ON ? CTL.flap.span * S.geom.semi : -1;
  const FLAP_HINGE = 1 - CTL.flap.chord;
  // sidAt: which control surface this station belongs to, or 0. Outboard of
  // aStart is aileron, inboard of fEnd is flap; the hinge fraction differs
  // between them, so the caller passes both and the section picks per vertex.
  // A section from arbitrary spar POINTS with arbitrary influence lists, so a
  // row can sit between spar stations. The node weights are the chordwise blend
  // times the spanwise one, which is exactly what the loft was already doing at
  // the stations themselves — subdividing adds resolution on the same ruled
  // surface and moves no geometry.
  // `pts` is the chord-fraction contour to map — genAfSeg over whatever range
  // this piece needs. It USED to ignore its last argument and always map the
  // full aerofoil `af`, which is how the cut silently did nothing: the fixed
  // skin and the control surface were both built full-chord, so the aeroplane
  // grew a second wing that rotated. Measured: both spanned x -0.492..1.108.
  const wingSectionAt = (pF, pR, wF, wR, chord, pts) => {
    const ch = genV3.norm(genV3.sub(pR, pF));                 // LE -> TE
    // The section's thickness axis must point UP on BOTH wings. Deriving it
    // from the wing's own z sign flipped it on the left, so the aerofoil was
    // built upside down on one side — visible as a mirrored camber, and the
    // centre section came out twisted between the two.
    let nrm = genV3.norm(genV3.cross(ch, [0, 0, 1]));
    if (nrm[1] < 0) nrm = genV3.mul(nrm, -1);
    return (pts || af).map(([xc, yc]) => {
      const base = genV3.add(pF, genV3.mul(ch, (xc - sparF) * chord));
      const p = genV3.add(base, genV3.mul(nrm, yc * chord));
      const k = kOf(xc);
      const infl = [];
      for (const [i2, w2] of wF) if (w2 > 1e-6) infl.push([i2, (1 - k) * w2]);
      for (const [i2, w2] of wR) if (w2 > 1e-6) infl.push([i2, k * w2]);
      return { p, infl, u: xc };
    });
  };
  // `flip` reverses the winding. The left wing is the mirror of the right, so
  // the same index pattern traverses it the other way round and every triangle
  // ends up facing inward — the surface renders (materials are DoubleSide) but
  // computeVertexNormals then lights that whole wing from the wrong side.
  const wingSection = (nF, nR, chord) =>
    wingSectionAt(N[nF].p, N[nR].p, [[nF, 1]], [[nR, 1]], chord, af);

  // ---- 3a. PITOT MAST, on the wing's lower skin ------------------------
  // It hangs UNDER the wing, so its root has to be a point on the lower
  // SURFACE. It used to be a hardcoded 0.10 m below a front-spar NODE, and a
  // spar node is inside the wing: how far inside depends on the aerofoil's
  // thickness at that chord station, which moves with `naca`, `chord` and
  // taper. So the constant was right for exactly one aeroplane — thin the
  // section or lengthen the chord and the mast floated clear of the skin or
  // disappeared up into it.
  //
  // The fix is the same rule the glazing follows: put the part ON the emitted
  // surface rather than near it. `wingSectionAt` with a single lower-surface
  // point from the very evaluator the loft uses returns both the position and
  // the node weights, so the mast is attached by construction and flexes with
  // the wing instead of being fitted to it.
  {
    const i = Math.min(1, P.wf.L.F.length - 1);
    const nF = P.wf.L.F[i], nR = P.wf.L.R[i];
    // chordwise station of the mast: well aft of the leading edge, so it is
    // clear of the LE radius and sits on a part of the section that is
    // genuinely flat-ish whatever the aerofoil
    const XC = 0.35;
    const chord = P.chordAt(Math.abs(N[nF].p[2]));
    const root = wingSectionAt(N[nF].p, N[nR].p, [[nF, 1]], [[nR, 1]], chord,
                               [genAfEval(S.wing.naca).lo(XC)])[0];
    // the mast drops a fixed distance below the skin, and the probe runs
    // forward from its foot into clean air ahead of the leading edge
    const DROP = 0.22, REACH = 0.24;
    const foot = [root.p[0], root.p[1] - DROP, root.p[2]];
    genTubeInto(pitot, root.p, foot, 0.010, 8, root.infl, B);
    genTubeInto(pitot, foot, [foot[0] - REACH, foot[1], foot[2]], 0.011, 8,
                root.infl, B);
  }
  // the loft pair is module-level now (G67.1) so the wing can take them with
  // it and the empennage can go on using them; `B` is the only thing they
  // closed over, so it becomes the last argument and nothing else changes.
  const emitLoft = (rows, mesh, vOf, flip, close) =>
    genEmitLoft(rows, mesh, vOf, flip, close, B);
  const capLoft = genCapLoft;
  const W = S.wing, TIP = GEN_TIPS[W.tip] || GEN_TIPS.rounded;
  // ---- 3b. the wing, and its control surfaces as SEPARATE MESHES ----------
  // The fixed skin is lofted over [0..hinge] and each surface over [hinge..1].
  // They are different groups, so a surface is a rigid body with a pivot and an
  // axis — the viewer turns the MESH. Nothing is deformed, so nothing outside
  // the surface can be dragged along by it (the rounded tip used to swing with
  // the aileron because it happened to carry the aileron's vertex tag).
  // chordwise points: fixed part / control surface. The fixed panels used
  // to loft at 9 while the centre carry-through lofts the full genAirfoil
  // contour at GEN_AF = 22 — a visible resolution cliff at the root rib
  // (user, G43: "make the wing as detailed as the center"). The panels
  // now match the centre's own sampling; the surfaces take the same
  // density over their ~0.3 chord. Display resolution only: the loft is
  // ruled on the same spar frames and the node weights are built the
  // same way, so nothing physical moves.
  const NAF = GEN_AF, NSURF = 7;
  for (const [side, fw] of [[1, P.wf.R], [-1, P.wf.L]]) {
    const sd = side > 0 ? 'R' : 'L';
    const zAll = [P.zRoot, ...P.zs];
    const zAilEnd = W.tipR > 1e-6 ? W.tipZ : zAll[zAll.length - 1];
    // which surface owns a station, and where its hinge is
    const bandAt = z => {
      if (z > aStart - 1e-6 && z < zAilEnd + 1e-6) return { n: 'ail', h: AIL_HINGE };
      if (FLAP_ON && z < fEnd + 1e-6 && z > P.zRoot - 1e-6) return { n: 'flap', h: FLAP_HINGE };
      return null;
    };
    // spar frame at an arbitrary z, and a section over any chord range
    const frameAt = z => {
      let b2 = 0;
      while (b2 < zAll.length - 2 && z > zAll[b2 + 1]) b2++;
      const z0 = zAll[b2], z1 = zAll[b2 + 1];
      const t = Math.max(0, Math.min(1, (z - z0) / Math.max(1e-9, z1 - z0)));
      const F0 = fw.F[b2], F1 = fw.F[b2 + 1], R0 = fw.R[b2], R1 = fw.R[b2 + 1];
      const lerp = (a3, b3) => [a3[0] + (b3[0]-a3[0])*t, a3[1] + (b3[1]-a3[1])*t,
                                a3[2] + (b3[2]-a3[2])*t];
      return { pF: lerp(N[F0].p, N[F1].p), pR: lerp(N[R0].p, N[R1].p),
               wF: [[F0, 1-t], [F1, t]], wR: [[R0, 1-t], [R1, t]],
               chord: P.chordAt(z) };
    };
    const secAt = (z, a, b, n) => {
      const f = frameAt(z);
      const row = wingSectionAt(f.pF, f.pR, f.wF, f.wR, f.chord, genAfSeg(W.naca, a, b, n));
      row.z0 = z;          // rows get duplicated at band ends, so carry the station
      return row;
    };
    // ---- station list: spar stations + surface edges, then subdivided ----
    const brk = zAll.slice();
    for (const zb of [fEnd, aStart, zAilEnd])
      if (zb > zAll[0] + 1e-3 && zb < zAll[zAll.length-1] - 1e-3) brk.push(zb);
    brk.sort((a2, b2) => a2 - b2);
    const zBrk = brk.filter((v, i) => i === 0 || v - brk[i-1] > 1e-3);
    const zStraight = W.tipR > 1e-6 ? W.tipZ : zAll[zAll.length - 1];
    const zEnd = zBrk.filter(v => v < zStraight - 1e-3).concat([zStraight]);
    const zs2 = [];
    for (let i = 0; i < zEnd.length - 1; i++)
      for (let sg = (i === 0 ? 0 : 1); sg <= GEN_WSEG; sg++)
        zs2.push(zEnd[i] + (zEnd[i+1] - zEnd[i]) * sg / GEN_WSEG);
    // THE BOW, stepped in angle (see G4.3): all curvature, no control surface
    if (W.tipR > 1e-6) {
      const nA = Math.max(2, TIP.arc | 0), thMax = (Math.PI/2) * 0.965;
      for (let i = 1; i <= nA; i++) zs2.push(W.tipZ + W.tipR * Math.sin(thMax * i / nA));
    }
    // ---- fixed skin: cut at the hinge wherever a surface lives ----
    const flip = side < 0;
    // EDGE LOOPS AT THE BAND ENDS. A cut row next to a full-chord row lofts as
    // a RAMP from the hinge line out to the trailing edge, so every band end
    // came out as a triangular wedge instead of a straight cut. (The root end
    // looked right only because the flap band starts at the first station and
    // has no neighbour to ramp from.) Emitting the boundary station TWICE —
    // once with each neighbour's chord range — turns that ramp into a
    // zero-width step, which is the vertical end wall of the cutout: the rib
    // face at the end of a real aileron.
    // The wall belongs to the station INSIDE the band (h !== 1), or the cutout
    // runs a subdivision past the surface that fills it — measured, a flap
    // ending at 2.50 left the wing open to 2.80.
    const hOf = z => { const b = bandAt(z); return b ? b.h : 1; };
    const fixRows = [];
    for (let i = 0; i < zs2.length; i++) {
      const z = zs2[i], h = hOf(z), inBand = Math.abs(h - 1) > 1e-9;
      const starts = inBand && i > 0 && Math.abs(hOf(zs2[i-1]) - h) > 1e-9;
      const ends = inBand && i < zs2.length - 1 && Math.abs(hOf(zs2[i+1]) - h) > 1e-9;
      // Each wall row is emitted TWICE. Rows do not share vertices, but a
      // single boundary row would be shared between the wall strip and the
      // skin strip beside it, and computeVertexNormals then averages a
      // near-vertical face into a near-horizontal one — the dark smear that
      // showed up on every cutout corner. Doubling the row gives the wall its
      // own vertices; the strip between the pair has zero area and so
      // contributes no normal at all.
      if (starts) {
        fixRows.push(secAt(z, 0, hOf(zs2[i-1]), NAF));
        fixRows.push(secAt(z, 0, hOf(zs2[i-1]), NAF));
      }
      fixRows.push(secAt(z, 0, h, NAF));
      if (starts || ends) fixRows.push(secAt(z, 0, h, NAF));
      if (ends) {
        fixRows.push(secAt(z, 0, hOf(zs2[i+1]), NAF));
        fixRows.push(secAt(z, 0, hOf(zs2[i+1]), NAF));
      }
    }
    if (TIP.fin > 0) {
      const h = TIP.fin * W.chord, last = fixRows[fixRows.length-1];
      fixRows.push(last.map(pt => ({ p: [pt.p[0], pt.p[1]+h, pt.p[2] - 0.22*h*side],
        infl: pt.infl, u: pt.u })));
    }
    // UV v is the TRUE span fraction, not the row index. Row-index v put the
    // paint's tip stripe wherever a loft happened to start, and once the
    // control surfaces became their own lofts each of them grew a stripe of its
    // own at its inboard end. Span fraction makes the paint continuous across
    // the cut, which is the point of cutting it there.
    const spanV = z => (z - P.zRoot) / Math.max(1e-6, S.geom.semi - P.zRoot);
    const ids = emitLoft(fixRows, skin, r => spanV(fixRows[r].z0), flip, true);
    capLoft([ids[0], ids[ids.length-1]], skin, flip);
    // ---- each surface: its own group, its own loft ----
    for (const [nm, gname, drive, sgnA, kA, drive2, sgn2] of [
      // da > 0 rolls right, which is right aileron DOWN (the solver raises that
      // wing's alpha). Signs re-measured after the cut became real: while the
      // "surface" was still a full-chord copy its centroid sat FORWARD of the
      // hinge, so every sign came out inverted and calibrated to the wrong body.
      ['ail',  'ail' + sd,  'da', -1, 1.0, null, 0],
      ['flap', 'flap' + sd, 'flap', -side, 0.70, null, 0],
    ]) {
      const zz = zs2.filter(z => { const b = bandAt(z); return b && b.n === nm; });
      if (zz.length < 2) continue;
      const hf = nm === 'ail' ? AIL_HINGE : FLAP_HINGE;
      const M = genMesh();
      const rows = zz.map(z => secAt(z, hf, 1, NSURF));
      const sIds = emitLoft(rows, M, r => spanV(zz[r]), flip, true);
      capLoft([sIds[0], sIds[sIds.length-1]], M, flip);
      // pivot on the hinge line at mid band, axis along it
      const zm = 0.5 * (zz[0] + zz[zz.length-1]);
      const hp = z => {
        const f = frameAt(z), E = genAfEval(W.naca);
        const u = E.up(hf), l = E.lo(hf), xc = 0.5*(u[0]+l[0]), yq = 0.5*(u[1]+l[1]);
        const ch = genV3.norm(genV3.sub(f.pR, f.pF));
        let nr = genV3.norm(genV3.cross(ch, [0,0,1])); if (nr[1] < 0) nr = genV3.mul(nr, -1);
        return genV3.add(genV3.add(f.pF, genV3.mul(ch, (xc - sparF) * f.chord)),
                         genV3.mul(nr, yq * f.chord));
      };
      const pA = hp(zz[0]), pB = hp(zz[zz.length-1]);
      CTRL_MESH.push({ group: gname, mesh: M, pivot: B(hp(zm)),
        axis: genV3.norm(genV3.sub(B(pB), B(pA))),
        drive, sgn: sgnA, k: kA, drive2, sgn2,
        infl: frameAt(zm).wF });
    }
  }
  // ---- centre section: the wing carries through above the cabin ----------
  // Three ways to build it, because on a high wing it IS the cabin roof.
  //   solid  the covering, as before
  //   glass  the same loft in the canopy's material - a skylight over the seats
  //   open   only the UPPER surface, so the wing's own top skin is the roof and
  //          you look up into it, which is what a Cub's centre section does
  {
    const CTR = (S.wing.centre === 'glass' || S.wing.centre === 'open')
      ? S.wing.centre : 'solid';
    let rows = [
      wingSection(P.wf.L.F[0], P.wf.L.R[0], S.wing.chord, 0),
      wingSection(P.wf.R.F[0], P.wf.R.R[0], S.wing.chord, 0),
    ];
    // the carry-through IS the root: both rows sit at span fraction 0. Row
    // index put the tip band on one side of it and the wing walk on the other.
    // the aerofoil contour runs TE -> upper -> LE -> lower -> TE, so its first
    // half IS the upper surface and the cut needs no new sampling
    if (CTR === 'open') rows = rows.map(r => r.slice(0, Math.ceil(r.length / 2)));
    emitLoft(rows, CTR === 'glass' ? canopy : skin, () => 0.02);
  }

  return { aStart, fEnd, FLAP_ON, FLAP_HINGE, AIL_HINGE, sparF };
}


// ---------------------------------------------------------------------------
// genWing(def) -> the WING ALONE, in the payload shape
// ---------------------------------------------------------------------------
// The standalone entry point G67.1 exists to create. `_cage_wing.js` used to
// call genSkin and throw away the whole aeroplane to keep the wing; the
// workshop's wing-on-trestles did the same. Both now ask for the wing.
//
// IT IS THE SAME CODE, so it is the same wing: this builds the meshes, hands
// them to genWingInto, and adds the LIFT STRUTS — which are not part of the
// wing block at all, because a strut is a beam and beams are drawn from the
// beam list. That is the one thing a caller would otherwise have had to know,
// and it is here so that nobody has to.
//
// The payload has genSkin's shape (v/generated/groups/moving/mats/rest), so
// anything that could read a wing out of a skin payload can read this one.
function genWing(def) {
  const S = def.spec, N = def.nodes;
  const FR = genRestFrame(def);
  const B = FR.to;
  const skin = genMesh(), canopy = genMesh(), pitot = genMesh(),
        liftstrut = genMesh();
  const CTRL_MESH = [];
  genWingInto(def, { B, skin, pitot, canopy, ctrl: CTRL_MESH });
  // AN EXTERNAL WING BEAM IS A LIFT STRUT, and that is genSkin's own test
  // (`b.cls === 'wing' ? liftstrut : strut`, and only when `b.ext`). A leg is
  // never a wing beam and every wire 61_gen_frame emits is gear-class, so the
  // two branches this skips cannot reach here.
  for (const b of def.beams)
    if (b.ext && b.cls === 'wing') genBeamInto(liftstrut, b, N, B);

  const groups = {};
  const put = (nm, M) => { const g = M.done(); if (g.nv) groups[nm] = g; };
  put('skin', skin); put('canopy', canopy);
  put('pitot', pitot); put('liftstrut', liftstrut);
  const moving = [];
  for (const c of CTRL_MESH) {
    put(c.group, c.mesh);
    if (!groups[c.group]) continue;
    moving.push({ group: c.group, p: c.pivot, ax: c.axis, infl: c.infl,
                  drive: c.drive, sgn: c.sgn, k: c.k,
                  drive2: c.drive2 || null, sgn2: c.sgn2 || 0 });
  }
  return {
    v: 5, generated: true, wingOnly: true,
    linTex: ['bump', 'mr'],
    cover: ['skin', 'canopy'].concat(moving.map(m => m.group)),
    groups, moving,
    mats: {
      skin: genPaintRow(S),
      ailR: genPaintRow(S), ailL: genPaintRow(S),
      flapR: genPaintRow(S), flapL: genPaintRow(S),
      canopy:    { color: 0xa9c6d6, opacity: 0.32, rough: 0.04, metal: 0.0 },
      liftstrut: { color: 0xe6e2d8, rough: 0.30, metal: 0.10 },
      pitot:     { color: 0x7d8792, rough: 0.42, metal: 0.45 },
    },
    rest: (() => {
      const a = new Float32Array(N.length * 3);
      N.forEach((n, i) => { const b = B(n.p); a[i*3] = b[0]; a[i*3+1] = b[1]; a[i*3+2] = b[2]; });
      return a;
    })(),
  };
}

// ---------------------------------------------------------------------------
// THE LOFT PAIR. Lifted to module scope by G67.1 so the WING could leave this
// file with them: they were closures inside genSkin, and the only thing they
// closed over was the rest-frame transform, which is now the last argument.
// Not one line of the bodies changed — GATE WINGSPLIT is what says so.
//
// `close` wraps the last column back onto the first, which is what turns an
// open aerofoil contour into a closed tube — needed once a section is cut at
// a hinge, because then its ends no longer meet at a sharp trailing edge.
function genEmitLoft(rows, mesh, vOf, flip, close, B) {
  const ids = rows.map((row, r) => row.map(pt =>
    mesh.v(B(pt.p), pt.u, genUVPanel(vOf(r)), pt.infl, pt.sid)));
  for (let r = 0; r < ids.length - 1; r++) {
    const n = ids[r].length, last = close ? n : n - 1;
    for (let h = 0; h < last; h++) {
      const h2 = (h + 1) % n;
      if (flip) mesh.quad(ids[r][h], ids[r+1][h], ids[r+1][h2], ids[r][h2]);
      else      mesh.quad(ids[r][h], ids[r][h2], ids[r+1][h2], ids[r+1][h]);
    }
  }
  return ids;
}
function genCapLoft(ids, mesh, flip) {
  // close a section with a fan to its mid-chord point
  for (const row of ids) {
    const n = row.length;
    for (let h = 1; h < n - 1; h++)
      if (flip) mesh.tri(row[0], row[h+1], row[h]);
      else      mesh.tri(row[0], row[h], row[h+1]);
  }
}

// ---------------------------------------------------------------------------
// genSkin IS GONE (G67.1). It stood here for the whole garage arc and built
// the entire aeroplane: the fuselage covering, the glazing, the cowl, the
// engine, the wheels, the propeller, the seats, the dummies and the wing.
//
// The CAGE replaced every one of those except the wing, over G12-G61, and
// the wing is why this could not simply be deleted: `_cage_wing.js` built
// the wing of every cage build out of it. So the wing was lifted out first
// (genWingInto / genWing, above), measured against thirteen frozen wings by
// GATE WINGSPLIT, and only then was the rest removed.
//
// WHAT WENT WITH IT, so that nobody has to wonder later: the fuselage loft
// and its cockpit cut, the side lights and windows, the coaming and dash,
// the registration DECAL group (G69 made a marking a metric read in the
// shader instead), the engine bay and cowl, the empennage, the wheels,
// tyres, hubs and fairings, the propeller, spinner and painted tips, the
// interior liner, the seats and belts, and the occupant. Every one of those
// is now built by a cage layer with its own bench and, since G67.1, its own
// gate: CAGEFIT, FIN, COWL, ENGMESH, JOIN.
//
// The pre-split file is kept whole at earlierVersions/63_gen_skin-preG67.1.js
// and in git history. Nothing reads it.
// ---------------------------------------------------------------------------

// Pose a generated skin: rigid mount is the group matrix (as for any model);
// this adds the structural delta, exactly parallel to applySkinDeform.
//   pos = base + SUM w_i * (node_i_body - node_i_rest_body)
// `hinged` verts already have their hinge-rotated position in `pos`, so the
// delta is ADDED rather than written, same contract as the imported path.
function poseSkinGen(g, rest, live, base, pos, gain, hinged) {
  const { wi, ww, nv } = g;
  for (let v = 0; v < nv; v++) {
    let dx = 0, dy = 0, dz = 0;
    for (let k = 0; k < GEN_INFL; k++) {
      const o = v * GEN_INFL + k, w = ww[o];
      if (w === 0) continue;
      const i3 = wi[o] * 3;
      dx += w * (live[i3] - rest[i3]);
      dy += w * (live[i3+1] - rest[i3+1]);
      dz += w * (live[i3+2] - rest[i3+2]);
    }
    dx *= gain; dy *= gain; dz *= gain;
    const o3 = v * 3;
    if (hinged && hinged[v]) { pos[o3] += dx; pos[o3+1] += dy; pos[o3+2] += dz; }
    else { pos[o3] = base[o3] + dx; pos[o3+1] = base[o3+1] + dy; pos[o3+2] = base[o3+2] + dz; }
  }
}

// Live node positions in the body frame, for poseSkinGen. Mirrors the codec's
// sparDeltas: same axes, same CG reference.
function genNodeBody(sim, out) {
  const cg = sim.cgPos(), [xA, yU] = sim.axes();
  const zL = [xA[1]*yU[2]-xA[2]*yU[1], xA[2]*yU[0]-xA[0]*yU[2], xA[0]*yU[1]-xA[1]*yU[0]];
  for (let i = 0; i < sim.n; i++) {
    const dx = sim.p[i*3]-cg[0], dy = sim.p[i*3+1]-cg[1], dz = sim.p[i*3+2]-cg[2];
    out[i*3]   = dx*xA[0]+dy*xA[1]+dz*xA[2];
    out[i*3+1] = dx*yU[0]+dy*yU[1]+dz*yU[2];
    out[i*3+2] = dx*zL[0]+dy*zL[1]+dz*zL[2];
  }
  return out;
}
// ============================================================
// GARAGE 5/5 — the BUILD. Spec in, fiche out.
//
// buildGen(spec) is the entry point the sim, the gates and the viewer all
// use. Two of the fiche's numbers cannot be reasoned out of the geometry —
// the stabiliser trim setting and the cruise throttle — so the garage does
// what a builder does: it puts the aeroplane in the tunnel. sim.probe()
// already exists for exactly this (30_solver.js), is deterministic, and costs
// one strip pass per call.
//
// shakedown() is the same instrument turned into the garage's readout: stall
// speed, cruise L/D, static margin, three-point attitude, prop clearance.
// ============================================================

// Prescribed-flow probe at a given body angle of attack. The aeroplane is in
// its rest pose (reset translates, never rotates), so the body frame is level
// and Fy reads as lift.
function genProbeAt(sim, V, a) {
  const [xA, yU] = sim.axes();
  const vel = [0, 0, 0];
  for (let k = 0; k < 3; k++) vel[k] = -V * (Math.cos(a) * xA[k] + Math.sin(a) * yU[k]);
  const r = sim.probe(vel);
  // forward unit vector: drag is the aero force opposing it
  r.drag = -(r.Fx * -Math.cos(a) * xA[0] + r.Fy * -Math.cos(a) * xA[1] + r.Fz * -Math.cos(a) * xA[2])
           - (r.Fx * -Math.sin(a) * yU[0] + r.Fy * -Math.sin(a) * yU[1] + r.Fz * -Math.sin(a) * yU[2]);
  return r;
}

// G115 — THE FIN EXISTS NOW (the review's sharpest finding: "probe() returns
// yawLeft and nothing in the repo ever reads it; the fin is the one major
// surface the player can size with no consequence and no readout"). A
// sideslip probe at cruise speed, a small beta either side, and the
// WEATHERVANE STIFFNESS is the slope — normalised to Cn_beta on wing area
// and span: the directional analogue of the static margin. Positive is
// stable (nose swings back into the wind); the sign convention is verified
// against the whole fleet in tools/_yaw_probe.js.
function genYawStiff(sim, def, V) {
  const bet = 0.06;
  const yaw = b => sim.probe(
    [-V * Math.cos(b), 0, -V * Math.sin(b)]).yawLeft;
  const dN = (yaw(bet) - yaw(-bet)) / (2 * bet);
  const g = def.params.gen || {};
  const Sw = g.Sw || 10, b = Math.sqrt(Sw * (g.AR || 6));
  // minus: with this velocity construction the whole fleet measures a
  // NEGATIVE slope when stable (verified in tools/_yaw_probe.js — every
  // fiche and the stock build), so the sign is flipped once, here, and
  // stable reads positive the way the static margin does.
  return -dN / (0.5 * RHO * V * V * Sw * b);
}

// Free-air CLmax by alpha sweep — the same scan GATE FLAPS runs on the fleet.
// `flap` is the deflection to hold during the sweep, so one function measures
// both the clean and the flapped maximum.
function genClMax(def, flap) {
  const sim = makeSim(def, null);
  sim.reset(0);
  sim.ctl.flap = flap;
  let Sw = 0;
  for (const st of def.strips) if (st.kind === 'wing') Sw += st.area;
  const V = 30;
  let CLmax = 0, aStall = 0;
  // Sweep starts at -2, not 2: a low-incidence generated wing can trim
  // negative, and the ATTITUDE the peak occurs at is now a return value.
  // Numerically inert for CLmax — -2 + 16*0.25 lands exactly on the old 2, so
  // the grid is identical and nothing below the stall can out-lift the peak.
  for (let a = -2; a <= 22; a += 0.25) {
    const al = a * Math.PI / 180;
    const r = sim.probe([-V * Math.cos(al), -V * Math.sin(al), 0]);
    const L = -r.Fx * Math.sin(al) + r.Fy * Math.cos(al);
    // RHO, not the live density: every number on this sheet is quoted at the
    // datum, which is what makes them comparable between two builds and what
    // makes the speeds equivalent airspeeds (G72).
    const CL = L / (0.5 * RHO * V * V * Sw);
    if (CL > CLmax) { CLmax = CL; aStall = al; }
  }
  // aStall is a BODY angle (the probe pitches the flow about the rest pose),
  // which is what the autopilot's pitch commands are also in. The whole
  // attitude family — thMax, climbThBase, liftoffTh, flareThMax — hangs off it.
  return { CLmax, Sw, W: sim.totalM * 9.81, aStall };
}

// alpha at which lift balances weight, secant, clamped short of the stall.
function genAlphaForLift(sim, V, W, aMax) {
  let a0 = 0.01, a1 = 0.09;
  let f0 = genProbeAt(sim, V, a0).Fy - W, f1 = genProbeAt(sim, V, a1).Fy - W;
  for (let i = 0; i < 8; i++) {
    if (Math.abs(f1 - f0) < 1e-9) break;
    let a2 = a1 - f1 * (a1 - a0) / (f1 - f0);
    a2 = Math.min(aMax, Math.max(-0.06, a2));
    a0 = a1; f0 = f1; a1 = a2; f1 = genProbeAt(sim, V, a1).Fy - W;
    if (Math.abs(f1) < 0.5) break;
  }
  return a1;
}

// Solve stabTrim so the aeroplane is in pitch balance at its own cruise speed
// and its own trimmed alpha. Two-point secant on an almost perfectly linear
// relation, then one refinement — the fleet's hand-tuned values were found the
// same way, by tunnel trim at cruise.
function genTrim(def) {
  const sim = makeSim(def, null);
  sim.reset(0);
  const W = sim.totalM * 9.81;
  const aMax = 0.85 * def.params.polarWing.aStall;
  // through the SIM, so the sheet and the aeroplane cannot disagree about how
  // much thrust there is in this air (G72). Identical at the datum.
  const Tav = v => sim.thrustAt(v, 1);
  const dragAt = v => genProbeAt(sim, v, genAlphaForLift(sim, v, W, aMax)).drag;

  // ---- CRUISE SPEED FROM THE POWER CURVE ---------------------------------
  // It used to be 1.71 * Vs flat (GEN_VRATIO), which is the Cub's ratio, and
  // that ratio is not a property of aeroplanes: across the fleet VCruise/Vs
  // scatters 1.69-2.68 (55%). Worse, it says nothing about whether the
  // aeroplane can actually GO that fast — measured, a short-span build came out
  // with thrCruise pinned at its 0.95 clamp, i.e. asked to cruise on 95% power
  // with nothing left to climb on, and it never reached circuit height at all
  // (286 s stuck in CLIMB, which IS the reported "it climbs forever").
  //
  // So solve for the speed where drag is 65% of the thrust available there.
  // Against the fleet the solution reproduces the hand-set values to
  // 0.96 +/- 0.12, and it GUARANTEES thrCruise ~ 0.65: authority in both
  // directions, which is the property the autopilot actually needs.
  {
    // The upper clamp is 2.2, not the fleet's own 2.68 (jodel) or 2.44 (c172):
    // this is the speed a CIRCUIT is flown at, and those two fiches carry
    // hand-matched circuit geometry to go with it. Left at 2.8 the 1200 hp
    // radial build solved to 69.7 m/s — a genuine 250 km/h racer, and measured,
    // it flew a 1037 m wide circuit because its turn radius no longer fitted
    // inside anything the strip could offer.
    const Vs = def.params.gen.Vs;
    let lo = 1.55 * Vs, hi = 2.2 * Vs;
    if (dragAt(lo) >= 0.65 * Tav(lo)) {
      // cannot even make the floor: it is a brick, and saying so honestly is
      // better than commanding a speed it will never see
      def.params.ap.VCruise = Math.round(lo * 10) / 10;
    } else {
      for (let k = 0; k < 18; k++) {
        const mV = 0.5 * (lo + hi);
        if (dragAt(mV) < 0.65 * Tav(mV)) lo = mV; else hi = mV;
      }
      def.params.ap.VCruise = Math.round(0.5 * (lo + hi) * 10) / 10;
    }
  }
  const V = def.params.ap.VCruise;
  const at = s => {
    def.params.stabTrim = s;
    const a = genAlphaForLift(sim, V, W, aMax);
    return { a, r: genProbeAt(sim, V, a) };
  };
  let s0 = 0, s1 = -0.08;
  let m0 = at(s0).r.pitchUp, m1 = at(s1).r.pitchUp;
  for (let i = 0; i < 4; i++) {
    if (Math.abs(m1 - m0) < 1e-9) break;
    const s2 = Math.min(0.15, Math.max(-0.25, s1 - m1 * (s1 - s0) / (m1 - m0)));
    s0 = s1; m0 = m1; s1 = s2; m1 = at(s1).r.pitchUp;
    if (Math.abs(m1) < 1.0) break;
  }
  def.params.stabTrim = s1;
  const fin = at(s1);
  // cruise throttle from the drag the tunnel just measured against the thrust
  // the prop can make at that speed. sim.thrustAt carries the aeroplane's OWN
  // prop (a GARAGE build always has one) AND its engine count — the two things
  // this block used to re-derive, and the second of which it once got wrong
  // (it read the per-disc figure while the solver flew on twice it, G4.9).
  const Tavail = sim.thrustAt(V, 1);
  def.params.ap.thrCruise = Math.min(0.95, Math.max(0.15, fin.r.drag / Tavail));
  def.params.gen.alphaCruise = fin.a;
  def.params.gen.LD = fin.r.Fy / Math.max(1e-6, fin.r.drag);

  // ---- THE APPROACH, MEASURED --------------------------------------------
  // The glideslope, the approach throttle and the pitch floor used to be the
  // Cub's three constants (gs 0.0786, thrAppr 0.35, vsFloor -0.08) on every
  // aeroplane the garage could build. HANDOVER "APPROACH" says the slope has to
  // sit below the IDLE-EQUILIBRIUM slope or the overspeed never washes off —
  // that is a measurable inequality, so measure it instead of asserting it.
  //
  // NOTE the probe runs with the prop and propwash OFF (30_solver.js), so every
  // alpha and drag here is FREE-AIR. That is exactly right for an idle
  // approach, and it is why the attitude family below hangs off the stall
  // attitude rather than off a probed climb alpha.
  {
    const A = def.params.ap, g = def.params.gen;
    const ldg = def.params.flaps ? (def.params.flaps.ldg ?? 1) : 0;
    const Va = A.VAppr;
    sim.ctl.flap = ldg;
    const aA = genAlphaForLift(sim, Va, W, aMax);
    const rA = genProbeAt(sim, Va, aA);
    // ELEVATOR REQUIRED FOR PITCH BALANCE ON FINAL. holdPitch clamps de to
    // [-0.30, +0.35] and needs headroom inside that for the loop itself, so an
    // aeroplane whose trim alone eats the stop cannot be flown down an
    // approach by any set of gains. Differenced, not solved: the relation is
    // linear in de over this range.
    sim.ctl.de = 0.20;
    const m1 = genProbeAt(sim, Va, aA).pitchUp;
    sim.ctl.de = 0;
    const dM = (m1 - rA.pitchUp) / 0.20;
    g.deAppr = Math.abs(dM) < 1e-9 ? 0 : -rA.pitchUp / dM;
    // THE TRIM BUDGET. Fleet worst is the Jodel at +0.118; the bound is 0.18 —
    // half the servo stop — so the loop keeps headroom for its own P/D/I terms.
    // Past that, NO set of gains can fly the approach: measured, a small-wing
    // build spent 64% of final with the elevator hard against its stop and
    // touched 894 m short. The cure has to be airframe-side, so make the one
    // change a builder would make — LAND IT FLAPLESS, at the clean-stall
    // approach speed — and if that does not fit either, say so in the shakedown
    // rather than ship an aeroplane that cannot be landed.
    if (Math.abs(g.deAppr) > 0.18 && ldg > 0) {
      sim.ctl.flap = 0;
      const rat = g.Vs / Math.max(1e-6, g.VsFlap);        // back onto the clean stall
      const Va0 = A.VAppr * rat;
      const a0 = genAlphaForLift(sim, Va0, W, aMax);
      const r0 = genProbeAt(sim, Va0, a0);
      sim.ctl.de = 0.20;
      const n1 = genProbeAt(sim, Va0, a0).pitchUp;
      sim.ctl.de = 0;
      const dM0 = (n1 - r0.pitchUp) / 0.20;
      const de0 = Math.abs(dM0) < 1e-9 ? 0 : -r0.pitchUp / dM0;
      if (Math.abs(de0) < Math.abs(g.deAppr)) {
        def.params.flaps.ldg = 0;        // the AP's flap schedule reads this
        A.VAppr *= rat; A.VApprShort *= rat;
        g.VsFlap = g.Vs; g.landsFlapless = true;
        return genTrim(def);             // re-measure the lot at the new config
      }
    }
    if (Math.abs(g.deAppr) > 0.18) g.apprTrimFail = g.deAppr;
    g.W = W;
    g.alphaAppr = aA;
    g.LDappr = rA.Fy / Math.max(1e-6, rA.drag);
    g.dragAppr = rA.drag;
    g.TavailAppr = Tav(Va);
    // arrival attitude, for the flare ceiling
    g.alphaTD = genAlphaForLift(sim, 1.10 * g.VsFlap, W, aMax);
    sim.ctl.flap = 0;
    // WHAT IT CAN CLIMB, which is what decides how big a circuit it can fly.
    g.gammaClimb = Math.max(0.004, genClimbAt(sim, def, W, aMax));
    genTuneAP(def);
  }
  // the take-off roll, measured in whatever air this sim is in (genTORunAt)
  def.params.ap.TORun = genTORunAt(sim, def, W).TORun;
  return def;
}

// ---------------------------------------------------------------------------
// THE TWO PERFORMANCE MEASUREMENTS, LIFTED OUT OF genTrim (G72) so that the
// bench can run the identical integration in air that is not the datum's. Not
// rewritten — moved, line for line — because a density-altitude sheet computed
// by a second, similar method would be a sheet about the method.
//
// THE ONE THING THAT IS NEW in both is the EAS/TAS conversion. Every speed on
// the fiche (VRot, VClimb) is an equivalent airspeed, and genProbeAt prescribes
// a TRUE one, so at altitude the tunnel has to be run faster to put the wing at
// the same dynamic pressure. easK is exactly 1 at the datum, so dividing by it
// leaves every existing number bit-for-bit where it was.
// ---------------------------------------------------------------------------

// WHAT IT CAN CLIMB, which is what decides how big a circuit it can fly.
function genClimbAt(sim, def, W, aMax) {
  const A = def.params.ap;
  const Vc = A.VClimb / sim.probeAir().easK;      // the EAS, flown as a TAS
  const rc = genProbeAt(sim, Vc, genAlphaForLift(sim, Vc, W, aMax));
  // RAW, and deliberately allowed to go negative. genTrim floors it at 0.004
  // because the autopilot's circuit geometry divides by it; a CEILING search
  // has to be able to see the gradient reach zero and pass through it, and a
  // floor applied here would have put the ceiling at infinity in both.
  return (sim.thrustAt(Vc, 1) - rc.drag) / W;
}

// TAKEOFF RUN to 2.5 m agl. The AP only uses it to decide whether to
// backtrack, so it has to err LONG.
//
// Rebuilt in G4.9, because the engine-count fix took away the error that was
// cancelling this one. The old form was `1.35 * Vlof^2 / (2*acc)` with ONE
// constant acceleration off 0.92*Tstatic and `Vlof = 1.05*VRot`. Two things
// were wrong with it and the doubled thrust hid both — it read 119 m against
// the 103 m the over-powered aeroplane actually flew, which looked like the
// deliberate safety bias the comment claimed. On honest thrust the same
// formula reads 119 m against 292 m flown: optimistic by 2.4x, and on a
// backtrack decision optimistic is the dangerous direction.
//
// 1. IT DOES NOT UNSTICK AT 1.05*VRot. VRot is where the autopilot starts
//    asking; the wheels leave when the wing can carry the aeroplane AT THE
//    LIFTOFF ATTITUDE, which is a tunnel question. Measured against flown
//    takeoffs this is right to a few per cent and high rather than low
//    (gen 21.4 predicted / 20.8 flown, cub 19.0 / 17.6).
// 2. THE ACCELERATION IS NOT CONSTANT. Thrust falls as kV2*V^2 the whole way
//    down the roll while drag climbs, so the mean is nothing like the
//    standing value. Integrate s = INT V dV / a(V) instead.
//
// The roll integrates at ZERO body alpha — the aeroplane accelerates roughly
// level — which under-reads lift and so over-reads both the weight on the
// wheels and the rolling drag: conservative, deliberately.
function genTORunAt(sim, def, W) {
  const A_ = def.params.ap;
  // the unstick speed is SOLVED in the real air, so thin air lengthens the roll
  // twice over: less thrust to accelerate on, and further to accelerate to.
  let Vun = 1.05 * A_.VRot / sim.probeAir().easK;
  {
    let lo = 1, hi = 4 * Vun + 40;
    for (let k = 0; k < 40; k++) {
      const mV = 0.5 * (lo + hi);
      if (genProbeAt(sim, mV, A_.liftoffTh).Fy < W) lo = mV; else hi = mV;
    }
    Vun = Math.max(Vun, 0.5 * (lo + hi));
  }
  const NS = 32;
  let sRoll = 0;
  for (let i = 0; i < NS; i++) {
    const Vi = Vun * (i + 0.5) / NS;
    const Ti = sim.thrustAt(Vi, 0);
    const ri = genProbeAt(sim, Vi, 0);
    const Ni = Math.max(0, W - ri.Fy);                  // weight still on wheels
    const ai = Math.max(0.15, (Ti - ri.drag - CRR * Ni) / sim.totalM);
    sRoll += Vi * (Vun / NS) / ai;
  }
  // AIR SEGMENT, unstick to 2.5 m — DERIVED now (G115; the review's S7: the
  // flat 0.8·roll padding told a 6 m/s climber and a 0.5 m/s climber the
  // same story). The aeroplane is accelerating AND climbing at once, so the
  // segment is an energy height — the 2.5 m of clearance PLUS the kinetic
  // climb from unstick to the screen speed — divided by the specific excess
  // thrust measured at the mid-speed, in this sim's own air. The gradient
  // floor is the flyable bar's own scale: below it the aeroplane is not
  // leaving, and the ROLL rejection is the number that matters.
  const W2 = W, Vscr = 1.15 * Vun;
  const rm = genProbeAt(sim, 1.10 * Vun, 0.06);
  const grad = Math.max(0.015,
    (sim.thrustAt(1.10 * Vun, 0) - rm.drag) / W2);
  const air = (2.5 + (Vscr * Vscr - Vun * Vun) / (2 * 9.81)) / grad;
  return { TORun: Math.round(sRoll + air), Vun, sRoll: Math.round(sRoll),
           air: Math.round(air) };
}

// The garage readout. Everything a builder would want to know before rolling
// it out of the shed, measured rather than asserted.
// Works on ANY fiche, generated or hand-written — the geometry-only fields are
// skipped when there is no spec. That is deliberate: the garage's numbers have
// to be comparable with the fleet's, or they mean nothing.
function genShakedown(def, opts) {
  const S = def.spec, P = def.parts;
  const g = def.params.gen || {};
  const sim = makeSim(def, null);
  sim.reset(0);
  const W = sim.totalM * 9.81;
  const V = def.params.ap.VCruise;
  const aMax = 0.85 * def.params.polarWing.aStall;
  const a = genAlphaForLift(sim, V, W, aMax);
  const r0 = genProbeAt(sim, V, a), r1 = genProbeAt(sim, V, a + 0.02);
  const dM = (r1.pitchUp - r0.pitchUp) / 0.02;
  const dL = (r1.Fy - r0.Fy) / 0.02;
  // neutral point: how far aft the CG could move before dM/dalpha reaches zero
  const npShift = -dM / Math.max(1e-6, dL);
  const cg = r0.cg;
  // ONE REFERENCE AREA ON THE SHEET. This summed the strips, which is all a
  // hand-written fiche has — but a generated aeroplane also carries `gen.Sw`,
  // the planform area the whole aero synthesis stands on (Vs, AR, the tail
  // volume coefficients), and the two are not the same number. The strip sum is
  // a QUADRATURE: it samples each half-bay at 0.28/0.78 instead of at its
  // centre, so it under-integrates a tapered wing by a few tenths of a per
  // cent. Tiny — but it put the panel's `wing` and `loading` cells on one area
  // while the `stall` cell next to them was on another, which is the kind of
  // disagreement a builder is right not to trust. Prefer the planform where
  // there is one; fall back to the strips for the fiches, unchanged.
  let Sw = g.Sw || 0;
  if (!Sw) for (const st of def.strips) if (st.kind === 'wing') Sw += st.area;
  const cBar = g.cBar || (def.strips.find(s => s.kind === 'wing') || {}).chord || 1;
  // ---- does it stand up? -------------------------------------------------
  // Settled on a flat plane (world = null), so the answer does not depend on
  // which patch of grass it is parked on. This is the instrument that catches
  // the failure a big engine used to cause: the gear folds, the aeroplane goes
  // down on its firewall, and every aerodynamic number above stays perfectly
  // healthy while it does. The nose-over angle is MEASURED off the settled
  // geometry rather than derived — the derivation has to guess the attitude.
  const st = makeSim(def, null);
  st.reset(0);
  for (let i = 0; i < 150; i++) st.step(1/60);
  const idOf = t => def.nodes.findIndex(n => n.tag === t);
  const iAx = idOf('AXLER'), iTw = def.refs.tw;
  const aglOf = i => st.p[i*3+1] - st.r[i];
  let gearStrain = 0, chassisStrain = 0, lowY = 1e9, lowTag = '';
  for (const b of st.beams) {
    if (b.gear) gearStrain = Math.max(gearStrain, Math.abs(b.strain));
    else chassisStrain = Math.max(chassisStrain, Math.abs(b.strain));
  }
  for (let i = 0; i < st.n; i++) {
    const y = st.p[i*3+1] - st.r[i];
    if (y < lowY) { lowY = y; lowTag = def.nodes[i].tag; }
  }
  // THE SUSPENSION, measured as suspension rather than as a strain maximum.
  // `gearStrain` above is the worst-loaded gear MEMBER, which is a structural
  // number and since G4.7 is usually the drag brace — it goes UP with stiffness,
  // because a stiffer spring hands more load to the brace. What the knob claims
  // is travel, so travel is what gets measured — plus `susShift`, which is the
  // only thing that can see a FOLD (see below).
  let springStrain = 0, legL = 0, iLegTop = -1, iLegAx = -1;
  def.beams.forEach((b, i) => {
    if (!b.gear || b.vis !== 'leg') return;
    springStrain = Math.max(springStrain, Math.abs(st.beams[i].strain));
    const ta = def.nodes[b.a].tag || '', tb = def.nodes[b.b].tag || '';
    if (iLegTop < 0 && (ta.indexOf('AXLE') === 0 || tb.indexOf('AXLE') === 0)) {
      legL = b.L;
      iLegAx = ta.indexOf('AXLE') === 0 ? b.a : b.b;
      iLegTop = ta.indexOf('AXLE') === 0 ? b.b : b.a;
    }
  });
  // travel IS the spring's own compression. A vertical node-difference cannot
  // measure it: the main leg is long and steeply raked into the FIREWALL, so the
  // axle moves along the leg rather than under it — measured, 5 mm of vertical
  // change for 52 mm of actual compression, and the rest of any node-difference
  // is the body pitching.
  const susTravel = springStrain * legL;
  // THE FOLD, and it has to be geometric. A snap-through rotates the gear rather
  // than stretching it — the folded case sat at 1.3% leg strain, which is rule 10
  // exactly ("no strain gate can see a mechanism"). So: how far has the axle moved
  // RELATIVE to the airframe node it hangs on, as a fraction of the leg? A working
  // suspension is under 0.1 of its leg; the fold measured 1.4.
  let susShift = 0;
  if (iLegTop >= 0) {
    const d0 = [0, 1, 2].map(k => def.nodes[iLegAx].p[k] - def.nodes[iLegTop].p[k]);
    const d1 = [0, 1, 2].map(k => st.p[iLegAx*3+k] - st.p[iLegTop*3+k]);
    susShift = Math.hypot(d1[0]-d0[0], d1[1]-d0[1], d1[2]-d0[2]) / Math.max(1e-6, legL);
  }
  const cgS = st.cgPos(), axX = st.p[iAx*3], axY = aglOf(iAx);
  const noseOver = Math.atan2(cgS[0] - axX, Math.max(0.05, cgS[1] - axY)) * 180 / Math.PI;
  const onWheels = iAx >= 0 && Math.abs(aglOf(iAx)) < 0.06 && Math.abs(aglOf(iTw)) < 0.06;

  // G134: the def's own engine facts outrank the registry row — a garage
  // build flies (and is judged by) the engine its dials resolved to. The
  // thermo sheet rides along: what full throttle burns or draws, and the
  // heat the cowl will one day have to reject (the ventilation-sizing arc
  // consumes coolKW; until then it is an honest number on the plaque).
  const ENr = def.params.engine || POWERPLANTS[def.params.powerplant].engine;
  const THr = genEngineThermo(ENr);
  const hp = ENr.powerW / 745.7;
  const out = {
    mass: sim.totalM, W,
    engineName: ENr.name, hp, engineMass: ENr.mass,
    engineFamily: THr.family, engineCooling: THr.cooling,
    coolKW: THr.coolKW, burnKgH: THr.burnKgH, drawKW: THr.drawKW,
    powerLoad: sim.totalM / Math.max(1e-6, hp),
    onWheels, restsOn: lowTag, gearStrain, restChassisStrain: chassisStrain,
    springStrain, susTravel, susShift, gearFolded: susShift > 0.5,
    noseOver,
    // G115: the DISPLAYED stall is the measured one — same instrument as
    // VsFlap and VsRatio below, so the three cells finally agree. The
    // analytic g.Vs keeps deriving the AP's speed ladder, unchanged.
    Vs: g.VsMeas ?? g.Vs, VCruise: V, LD: r0.Fy / Math.max(1e-6, r0.drag),
    alphaCruise: a * 180 / Math.PI,
    Sw, wingLoad: sim.totalM / Sw,
    cgX: cg[0], npX: cg[0] + npShift, staticMargin: npShift / cBar,
    // G115: the directional half of the balance story, measured the same way
    cnBeta: genYawStiff(sim, def, V),
    TORun: def.params.ap.TORun, thrCruise: def.params.ap.thrCruise,
    stabTrim: def.params.stabTrim,
    // CAN IT FLY A CIRCUIT AT ALL — reported, never enforced, exactly like
    // noseOver and gearFolded above. The garage does not refuse to build the
    // aeroplane; it measures it and says so, and "whether a given engine is a
    // sensible choice is the player's call" (GATE GEN's own words).
    // Both numbers are already measured: the climb gradient at VClimb on full
    // thrust, and the takeoff run. The bar is a climb RATE, because that is
    // what compares across aeroplanes — the fleet climbs at 3-5 m/s, so 0.3 m/s
    // is a tenth of the slowest thing that ships, and TORun is checked against
    // the actual runway rather than a round number.
    // Measured, either side of it: a 28 hp two-seater reads 0.09 m/s and
    // TORun 1508 m, runs off the end of the strip and then mushes along at
    // 1 m agl on full throttle — no autopilot can fly that. A short-span
    // 65 hp build reads 0.61 m/s and TORun 781 m, and flies a complete if
    // leisurely circuit, so it must NOT be excluded.
    climbGrad: g.gammaClimb,
    climbRate: (g.gammaClimb || 0) * (def.params.ap.VClimb || 0),
    flyableCircuit: (g.gammaClimb || 0) * (def.params.ap.VClimb || 0) >= 0.3
                    && def.params.ap.TORun <= 1100,
  };
  if (S && P) {
    // contactR, not wheelR: a cambered wheel touches down above its own radius
    const ground = S.gear.y - S.gear.contactR;
    const tw = def.nodes[P.TW];
    out.AR = g.AR;
    // atan, not atan2: this is the slope of the line through the two contacts,
    // and a nosewheel sits AHEAD of the mains so atan2 wraps it to ~180 deg
    out.deckAngle = Math.atan(((tw.p[1] - S.gear.twR) - ground) /
                              (P.twX - P.gx)) * 180 / Math.PI;
    out.gearType = S.gear.type;
    // G133: the fairing state joins the footer's gear label — one word, so
    // the plaque names what the L/D and cruise rows are already pricing
    out.gearFairing = S.gear.fairing === 'full' ? 'trousers'
      : S.gear.fairing === 'spat' ? 'spats'
      : S.gear.legFair === 'fair' ? 'faired legs' : null;
    out.bracing = P.bracing;
    out.propClear = (S.engY - S.propR) - ground;
    // The two halves of the split suspension height, as BUILT rather than as
    // asked for: legDrop is the knob, but gear.y can be bound by prop clearance
    // instead, and the third leg's length is derived for a nosewheel. Reporting
    // both is what makes "nose vs mains, set separately" legible.
    out.mainDrop = -0.02 - S.gear.y;
    out.mainBoundBy = S.gear.yBoundBy;
    // THE COWL, reported rather than enforced. A cowl is not obliged to enclose
    // its engine — a Cub's cylinders stick out on purpose — but "the cowl
    // collapses below its engine" was a real bug hiding behind that, so the
    // panel says which one you have built.
    out.cowlHalfW = S.cowl.halfW;
    out.cowlTop = S.cowl.top; out.cowlBot = S.cowl.bot;
    out.cowlEnclosed = S.cowl.enclosed;
    out.cowlOut = ['above', 'below', 'sides'].filter(k => !S.cowl.covers[k]);
    // THE PROPELLER as a component of its own: the disc it sweeps, what it pulls
    // standing still, where its thrust runs out, and what the blades weigh.
    out.propName = S.prop.name;
    out.propD = S.prop.D; out.propBlades = S.prop.blades;
    out.propDisc = S.prop.area;
    out.propTstatic = S.prop.Tstatic; out.propV0 = S.prop.V0;
    out.propMass = S.prop.mass;
    // WHAT THE AEROPLANE ACTUALLY PULLS: the disc's static thrust once per
    // ENGINE. It used to be once per MOUNT NODE, which is two on this airframe
    // family, and the whole fleet was anchored on the resulting doubling
    // (fixed G4.9). Same expression the solver uses, so the panel and the
    // aeroplane cannot disagree again.
    out.propThrust = S.prop.Tstatic * (def.params.nEngines || 1);
    out.propTW = out.propThrust / W;
    out.thirdLeg = S.gear.type === 'tricycle' ? -0.02 - tw.p[1]
                                             : def.nodes[P.TPB].p[1] - tw.p[1];
    out.camber = S.gear.camber;
  }
  // High lift, measured rather than assumed. `gen.Vs` is the CLEAN stall the
  // whole aero synthesis is built on; this runs the same free-air CLmax scan
  // GATE FLAPS uses on the fleet, with the flaps down, so the panel can show
  // what the high-lift device actually buys. Without it a flap is a line in the
  // spec that changes no number anyone can see.
  if (def.params.flaps) {
    const cl = genClMax(def, 0), fl = genClMax(def, 1);
    out.ClMaxClean = cl.CLmax;
    out.ClMaxFlap = fl.CLmax;
    out.VsFlap = Math.sqrt(2 * fl.W / (RHO * fl.Sw * Math.max(1e-6, fl.CLmax)));
    out.VsRatio = out.VsFlap / Math.sqrt(2 * cl.W / (RHO * cl.Sw * Math.max(1e-6, cl.CLmax)));
    out.VAppr = def.params.ap.VAppr;
  }
  // (G115 tried a flapless fallback here — VsFlap = Vs, ratio 1 — and GATE
  // GEN's own contract threw it out: ABSENCE is the declared signal for "no
  // high-lift device", and a fabricated ratio-one row is exactly the kind of
  // number-that-means-nothing this chantier exists to remove. One instrument
  // applies WHERE THE DEVICE EXISTS; where it does not, the honest cell is
  // no cell.)
  if (P && P.ledger) {
    out.ledger = P.ledger;
    out.cost = 0;
    // EMPTY AND ALL-UP, because `mass` alone was misleading about the one
    // decision it was most often used to judge. The lattice mass is everything
    // the aeroplane weighs with its crew, fuel and freight aboard — the right
    // number to fly and to load-test, and the wrong one to compare materials
    // with: 126 kg of the preset's 402 is payload, so swapping tube-and-fabric
    // for carbon moved the only figure the panel showed by 9% (402 -> 364) when
    // what it had actually bought was 14% of the empty weight (276 -> 238), and
    // more than that of the structure alone, since the 85 kg of engine and prop
    // inside `empty` do not move with the material either. The materials were
    // working; the readout was hiding it. `empty + payload === mass` — the split is
    // the ledger's own flag (61_gen_frame.js), not a second sum over the nodes.
    out.empty = 0; out.payload = 0;
    for (const k in P.ledger) {
      const e = P.ledger[k];
      out.cost += e.cost;
      if (e.payload) out.payload += e.mass; else out.empty += e.mass;
    }
  }
  // G121 (the review's B5): THE SHEET AT RESERVES. Every number above is
  // quoted at one mass — full tanks — and with a nose or outboard tank the
  // static margin genuinely MOVES as fuel burns; when burn arrives, a
  // single-number plaque would be the new lie. The reserve sheet is the
  // SAME airframe re-fed with 15% fuel: the RESOLVED spec goes back through
  // buildGen, and because every derived field is non-null now, the geometry
  // and the gear stay exactly where the full-tanks design put them — only
  // the fuel kilos differ, which is precisely what "at reserves" means.
  // Slim recursion: the reserve sheet does not itself carry one.
  if (!(opts && opts.slim) && S && S.fuel && S.fuel.litres > 10) {
    try {
      const rs = JSON.parse(JSON.stringify(S));
      rs.fuel.litres = Math.max(4, 0.15 * rs.fuel.litres);
      const rsh = genShakedown(buildGen(rs), { slim: true });
      out.reserve = { litres: rs.fuel.litres, mass: rsh.mass, Vs: rsh.Vs,
                      staticMargin: rsh.staticMargin,
                      climbRate: rsh.climbRate, wingLoad: rsh.wingLoad };
    } catch (e) {}
  }
  return out;
}

// ---------------------------------------------------------------------------
// buildGen(spec) — the fiche. Same shape the hand-written builders return, so
// makeSim / makeAutopilot / the gate harness take it unchanged. `spec` and
// `parts` ride along for the skin generator and the editor; the solver spreads
// only what it knows about and ignores them.
// ---------------------------------------------------------------------------
function buildGen(specIn) {
  const R = resolveSpec(specIn || GEN_DEFAULT);
  const S = R.spec;
  // which fields the player left to the generator, so the editor can say so
  S._auto = R.auto;
  const fr = genFrame(S);
  // gear placement needs the CG, so genFrame owns it — hand the numbers it
  // chose back on the resolved spec, or the editor has nothing to report
  for (const [k, v] of [['track', fr.parts.tr], ['x', fr.parts.gx],
                        ['twX', fr.parts.twX], ['twY', fr.parts.twY]]) {
    if (S.gear[k] === null || S.gear[k] === undefined) S._auto['gear.' + k] = true;
    S.gear[k] = v;
  }
  const strips = genStrips(S, fr);
  const params = genParams(S, fr, strips);
  const def = { nodes: fr.nodes, beams: fr.beams, strips, refs: fr.refs, params };
  def.spec = S; def.parts = fr.parts;
  // The approach is flown WITH the flaps out, so the speeds that matter scale
  // off the FLAPS-DOWN stall — Vref = 1.3 Vso is the real-world rule and the
  // fleet's hand-set VAppr values already have their own flaps in them. Derived
  // from the clean stall instead, a big high-lift device produced an aeroplane
  // that approached far too fast: measured on a Fowler-flapped build, it flew
  // the glideslope at MINUS 4.2 degrees alpha on 65% power and sailed over the
  // touchdown zone still 16 m up, never landing at all. The lift was right; the
  // speed it was told to fly was not.
  //
  // MOVED AHEAD OF genTrim: the tunnel now probes the APPROACH as well as the
  // cruise, and it cannot do that until it knows what speed the approach is
  // flown at. Inert for the two numbers genTrim already measured — stabTrim and
  // thrCruise read VCruise, TORun reads VRot and liftoffTh, and none of those
  // move with VAppr.
  const gClean = genClMax(def, 0);
  params.gen.aStall = gClean.aStall;
  if (params.flaps) {
    const g = genClMax(def, params.flaps.ldg ?? 1);
    const VsFlap = Math.sqrt(2 * g.W / (RHO * g.Sw * Math.max(1e-6, g.CLmax)));
    // BOTH SPEEDS OFF THE SAME INSTRUMENT. `r` is a ratio, so everything common
    // to the two ends cancels — but only if the two are measured the same way.
    // This divided the flapped PROBE by `gen.Vs`, which is analytic and on the
    // geometric reference area, so what reached VAppr was the flap increment
    // PLUS the clean model's own disagreement with the probe. genShakedown's
    // `VsRatio` was already doing it this way; this is the same sum, and
    // `gClean` is the scan that was run three lines up.
    const VsClean = Math.sqrt(2 * gClean.W /
                    (RHO * gClean.Sw * Math.max(1e-6, gClean.CLmax)));
    const r = VsFlap / VsClean;
    params.ap.VAppr *= r;
    params.ap.VApprShort *= r;
    params.gen.VsFlap = VsFlap;
    params.gen.VsMeas = VsClean;          // G115: the MEASURED clean stall
    params.gen.aStallLdg = g.aStall;
  } else {
    // G115 (the review's S8): the plaque used to show an ANALYTIC Vs beside a
    // MEASURED VsFlap — two instruments in adjacent cells, and their ratio
    // disagreed with the displayed VsRatio. The measured clean stall is kept
    // for DISPLAY; `gen.Vs` stays the analytic number the whole AP speed
    // ladder is derived from, so nothing flies differently.
    params.gen.VsMeas = Math.sqrt(2 * gClean.W /
                        (RHO * gClean.Sw * Math.max(1e-6, gClean.CLmax)));
    params.gen.VsFlap = params.gen.VsMeas;
    params.gen.aStallLdg = gClean.aStall;
  }
  genTrim(def);
  return def;
}

// ---------------------------------------------------------------------------
// THE DENSITY-ALTITUDE SHEET (G72) — the bench's second instant test.
//
// The question it answers is the one the plaque could not: this aeroplane
// takes 320 m of grass and climbs 3 m/s ON THE STANDARD DAY AT SEA LEVEL, and
// every number a builder has ever been shown has silently carried that
// qualifier. What does it do out of a mountain strip in August, and where does
// it stop climbing at all?
//
// It is the SAME two measurements genTrim takes — genClimbAt and genTORunAt,
// the same functions, not a second method — run against a different air
// through sim.setAtmos. Nothing here models anything; the modelling is all in
// 05_atmos.js and in the solver, and this file only asks.
//
// THE CEILING is bisected on the climb gradient, which is why genClimbAt
// returns a raw one. Absolute = where the rate of climb reaches zero; service =
// where it reaches 0.5 m/s, which is roughly the 100 ft/min every light-
// aircraft manual quotes and is the honest one to publish, since an aeroplane
// at its absolute ceiling cannot turn.
// ---------------------------------------------------------------------------
const GEN_DA_CASES = [
  { id: 'isa', name: 'ISA, sea level',        h: 0,    dISA: 0  },
  // A REAL SUMMER MOUNTAIN STRIP, and the numbers behind the choice: 1000 m of
  // pressure altitude at ISA+20 is a bit over 1600 m of density altitude, which
  // is an ordinary afternoon in the Alps and an ordinary afternoon in Colorado.
  { id: 'hot', name: '1000 m strip, ISA+20',  h: 1000, dISA: 20 },
];
const GEN_DA_SERVICE = 0.5;      // m/s, the service-ceiling bar
const GEN_DA_CAP = 12000;        // m, the edge of what this model will claim

function genDensityAlt(def) {
  const A = def.params.ap || {};
  // fiche-only aircraft have no VRot/liftoffTh, so there is no roll to
  // integrate; say so rather than returning a sheet of NaN.
  if (!(A.VClimb > 0) || !(A.VRot > 0) || A.liftoffTh == null) return null;
  const sim = makeSim(def, null);
  sim.reset(0);
  const W = sim.totalM * 9.81;
  const aMax = 0.85 * def.params.polarWing.aStall;

  const at = (h, dISA) => {
    sim.setAtmos(dISA ? makeAtmos({ dISA }) : ATMOS_ISA, h);
    sim.ctl.flap = 0;
    const air = sim.probeAir();
    const gam = genClimbAt(sim, def, W, aMax);
    return {
      pressAlt: h, dISA, densAlt: air.densityAlt, sigma: air.sigma,
      oatC: air.oatC, power: air.power, aspiration: air.aspiration,
      climbGrad: gam,
      // RATE of climb is the gradient times the TRUE speed, and VClimb is an
      // equivalent one — the aeroplane really is going faster up there.
      climbRate: gam * A.VClimb / air.easK,
      VClimbTAS: A.VClimb / air.easK,
      TORun: genTORunAt(sim, def, W).TORun,
    };
  };
  const cases = GEN_DA_CASES.map(c => Object.assign({ id: c.id, name: c.name },
                                                    at(c.h, c.dISA)));
  // CLIMB ONLY for the ceiling search — `at` also integrates a take-off roll,
  // which is 70-odd tunnel probes an iteration and means nothing at 3000 m.
  // AND WHERE THE MODEL STOPS BEING HONEST. 12 km is not a physical bound, it
  // is the edge of what is defensible here: above it the missing pieces start
  // to matter more than the ones that are present. It bites on ELECTRIC builds,
  // which in this model keep climbing almost indefinitely — a motor's power
  // does not lapse, so the only thing taking the thrust away is rho^(1/3). That
  // is correct as far as it goes and it goes too far: a real one is stopped by
  // its battery and by the tips of its own propeller going transonic, and this
  // model has neither. A null ceiling means "above 12 000 m and do not believe
  // us", not "infinite".
  const rocAt = h => {
    sim.setAtmos(ATMOS_ISA, h);
    sim.ctl.flap = 0;
    const air = sim.probeAir();
    return genClimbAt(sim, def, W, aMax) * A.VClimb / air.easK;
  };
  const ceiling = target => {
    if (!(rocAt(0) > target)) return 0;            // it does not climb down here
    let lo = 0, hi = GEN_DA_CAP;
    if (rocAt(hi) > target) return null;           // beyond the model's honesty
    for (let k = 0; k < 24; k++) {
      const m = 0.5 * (lo + hi);
      if (rocAt(m) > target) lo = m; else hi = m;
    }
    return 0.5 * (lo + hi);
  };
  const out = {
    cases,
    serviceCeiling: ceiling(GEN_DA_SERVICE),
    absCeiling: ceiling(0),
    serviceBar: GEN_DA_SERVICE,
    ceilingCap: GEN_DA_CAP,
  };
  // the ceilings are PRESSURE altitudes on the standard day, so their density
  // altitude is the same number — but say it, rather than leave it inferred
  out.serviceCeilingDA = out.serviceCeiling;
  sim.setAtmos(null, 0);
  return out;
}
// ============================================================
// GARAGE 5/5 — the LOAD TEST RIG. Static proof-of-structure, in the sim.
//
// The sandbag test an amateur-built aeroplane has to pass before it flies:
// bags over the wing to LIMIT load (no permanent set), then to ULTIMATE, which
// is 1.5x limit (no failure). FAR 23 normal category is +3.8 g and +5.7 g.
//
// ONE IMPLEMENTATION. This drives a sim step by step and holds all its state,
// so GATE LOAD runs it headless and the garage ticks the same object per frame
// and draws the result. There is no second place a load-test number lives.
//
// THE RIG, and why it is built this way — three versions of it were wrong
// first, and each looked right:
//   1. Load the wing and let the aeroplane's own INERTIA react it. A legitimate
//      pull-up on paper. But only the wing is loaded and nothing balances the
//      pitching moment, so it rotates under the measurement: the C172 read
//      1.25 % at 1 g and -0.95 % at 3.8 g.
//   2. React at the wing root stations, making it self-equilibrated in FORCE.
//      The net MOMENT still is not zero, so it rotates slowly instead of fast,
//      and at 5.7 g the body frame flipped mid-run: the trace jumped 5.10 -> 0.22.
//   3. BOLT THE FUSELAGE DOWN. Every non-wing node is pinned each step, which
//      is what trestles are. Nothing to balance, nothing to tumble.
//
// AND THE AEROPLANE GOES ON ITS BACK (G64). Version 3 loaded the wing UPWARD
// on an upright aeroplane, which is the right BENDING — FAR 23's +3.8 g and
// +5.7 g are flight loads and a flying wing bends up — and the wrong PICTURE:
// the viewer drew the sandbags resting on top of the wing and the wing then
// rose to meet them. The user's report was exactly that, "it was bending the
// wing the wrong way around". Flipping the load would have been worse than the
// drawing, because it would prove the wing against NEGATIVE g while printing
// positive-g numbers. So the aeroplane is turned over instead, which is how a
// homebuilt sandbag test is actually done and what this gate's own header has
// always said it was ("the real rig inverts the aeroplane and stands the
// fuselage on supports"): bags on the upward-facing lower surface, pressing
// DOWN with gravity, bending the wing the way flight does.
//
// Nothing measured changes by construction: `rise` resolves onto the BODY up
// axis, which `bodyAxes` builds geometrically out of upLo->upHi, so it turns
// over with the aeroplane. The jig datum is taken after the settle either way,
// so the wing's own 1 g — which now adds to the bags instead of opposing them —
// cancels out of every reported deflection.
//
// And the load is RAMPED, not stepped: DEFDAMP is a rate with tau = 2 s, so a
// step leaves the wing ringing past fifteen seconds and reading it at one
// instant samples the ring. `relax` bleeds the deformation velocity — only the
// part relative to the mass-weighted mean, so rigid motion is untouched — which
// converges to the same static answer quickly. Legitimate because only the
// settled state is wanted; nothing here claims to be a transient.
//
// The acceptance number is LINEARITY: 3.8 g of bags must give 3.8x the
// deflection. All three broken rigs failed it. See HANDOVER, GATE LOAD.
// ============================================================
const GEN_LOAD_LIMIT = 3.8;         // FAR 23 normal category
const GEN_LOAD_ULT = 5.7;           // 1.5 x limit
// How far the rig lifts the aeroplane before it bolts it down. NAMED and
// exported because the viewer has to know it: the camera tracks the CG, so it
// went up with the aeroplane, but the hangar stayed on the floor 200 m below
// and the test ran in an empty sky. The room now carries the same offset.
const GEN_LOAD_LIFT = 200;
const GEN_LOAD_WINGTAGS = ['WF', 'WR', 'WB', 'WB2'];

// spar stations on the +z wing, front node paired with its nearest rear node
function genLoadStations(def) {
  const wf = [], wr = [];
  def.nodes.forEach((n, i) => {
    if (n.p[2] <= 0) return;
    if (n.tag === 'WF') wf.push(i);
    if (n.tag === 'WR') wr.push(i);
  });
  wf.sort((a, b) => def.nodes[a].p[2] - def.nodes[b].p[2]);
  return wf.map(f => {
    const z = def.nodes[f].p[2];
    let r = -1, bd = Infinity;
    for (const q of wr) { const d = Math.abs(def.nodes[q].p[2] - z); if (d < bd) { bd = d; r = q; } }
    return { f: f, r: r, z: z };
  });
}

// makeLoadTest(sim, def, cfg) -> rig
//   rig.step(dt)  advance one frame; returns rig.state
//   rig.state     { phase, n, nTarget, tipPct, tipM, defl[], worstPct, worstCls,
//                   limitPct, ultPct, verdict, done }
// cfg: { limit, ult, rampS, holdS, material } — material is the GEN_MATERIALS
// key, and only supplies the yield allowable; omit it and the yield column is
// simply absent (the hand fiches have no material behind their k).
function makeLoadTest(sim, def, cfg) {
  cfg = cfg || {};
  const LIM = cfg.limit == null ? GEN_LOAD_LIMIT : cfg.limit;
  const ULT = cfg.ult == null ? GEN_LOAD_ULT : cfg.ult;
  const RAMP = (cfg.rampS == null ? 4.0 : cfg.rampS);
  const HOLD = (cfg.holdS == null ? 1.5 : cfg.holdS);
  const SETTLE = (cfg.settleS == null ? 2.0 : cfg.settleS);
  const MAT = (typeof GEN_MATERIALS !== 'undefined' && cfg.material)
    ? GEN_MATERIALS[cfg.material] : null;

  const st = genLoadStations(def);
  const ok = st.length >= 2;
  const root = ok ? st[0] : null, tip = ok ? st[st.length - 1] : null;
  const semi = ok ? def.nodes[tip.f].p[2] : 1;

  // total weight, and the bags: n*W split over the wing strips by area, then on
  // to nodes through each strip's own attachment weights — the same path the
  // solver uses for lift, so the bags sit where the lift does by construction.
  let W = 0;
  for (const nd of def.nodes) W += nd.m;
  W *= 9.81;
  const perG = new Map();
  {
    const wing = def.strips.filter(s => s.kind === 'wing');
    let area = 0;
    for (const s of wing) area += s.area;
    if (area > 0) for (const s of wing) {
      const share = W * (s.area / area);
      for (const wq of s.w) perG.set(wq[0], (perG.get(wq[0]) || 0) + share * wq[1]);
    }
  }
  const bags = [];
  perG.forEach((f, i) => bags.push([i, f]));

  // the trestles: everything that is not wing is pinned where it starts
  const wingTag = {};
  for (const t of GEN_LOAD_WINGTAGS) wingTag[t] = 1;
  const pin = [];

  const state = { phase: 'settle', n: 0, nTarget: ULT, tipPct: 0, tipM: 0,
                  defl: st.map(function () { return 0; }), z: st.map(s => s.z),
                  semi: semi, worstPct: null, worstCls: null, worstBeam: -1,
                  limitPct: null, ultPct: null, limitYield: null, ultYield: null,
                  verdict: null, done: false, W: W, ok: ok };

  let t = 0, base = null, peak = {};

  function clamp() {
    for (let k = 0; k < pin.length; k++) {
      const p = pin[k], i = p[0] * 3;
      sim.p[i] = p[1]; sim.p[i+1] = p[2]; sim.p[i+2] = p[3];
      sim.v[i] = sim.v[i+1] = sim.v[i+2] = 0;
    }
  }
  function relax() {
    const vm = sim.cgVel();
    for (let i = 0; i < sim.n; i++) {
      const o = i * 3;
      sim.v[o]   = vm[0] + (sim.v[o]   - vm[0]) * 0.85;
      sim.v[o+1] = vm[1] + (sim.v[o+1] - vm[1]) * 0.85;
      sim.v[o+2] = vm[2] + (sim.v[o+2] - vm[2]) * 0.85;
    }
  }
  function rise(s, yB) {
    const dx = sim.p[s.f*3] - sim.p[root.f*3],
          dy = sim.p[s.f*3+1] - sim.p[root.f*3+1],
          dz = sim.p[s.f*3+2] - sim.p[root.f*3+2];
    return dx*yB[0] + dy*yB[1] + dz*yB[2];
  }
  function yieldPct() {
    if (!MAT || !MAT.phys) return null;
    let worst = null;
    for (const cls in peak) {
      if (!MAT.lin[cls]) continue;
      const A = MAT.lin[cls] / MAT.phys.rho;
      const pct = 100 * peak[cls].F / (MAT.phys.sigY * A);
      if (!worst || pct > worst.pct) worst = { cls: cls, pct: pct, bi: peak[cls].bi };
    }
    return worst;
  }

  // 180 degrees about the aeroplane's OWN x axis, through its centre of mass:
  // about a WORLD axis it would come to rest pitched by twice the body axis's
  // inclination (the boom sits ~3.7 deg nose-down to the frame axis, G54), and
  // a rig that pitches the aeroplane while claiming to invert it is one more
  // picture that disagrees with its numbers.
  function invert() {
    const a = sim.axes()[0];                       // body x, nose -> tail
    let cx = 0, cy = 0, cz = 0, M = 0;
    for (let i = 0; i < sim.n; i++) {
      const m = def.nodes[i].m; M += m;
      cx += m * sim.p[i*3]; cy += m * sim.p[i*3+1]; cz += m * sim.p[i*3+2];
    }
    if (!(M > 0)) return;
    cx /= M; cy /= M; cz /= M;
    for (let i = 0; i < sim.n; i++) {
      const o = i * 3;
      const dx = sim.p[o] - cx, dy = sim.p[o+1] - cy, dz = sim.p[o+2] - cz;
      const k = 2 * (a[0]*dx + a[1]*dy + a[2]*dz);   // Rodrigues at 180 deg:
      sim.p[o]   = cx + k*a[0] - dx;                 //   v' = 2(a.v)a - v
      sim.p[o+1] = cy + k*a[1] - dy;
      sim.p[o+2] = cz + k*a[2] - dz;
      sim.v[o] = sim.v[o+1] = sim.v[o+2] = 0;        // it is set down, not thrown
    }
  }

  function begin() {
    invert();                       // on its back, on the trestles
    // clear of the ground so contact never joins in, then bolt the rig down
    for (let i = 0; i < sim.n; i++) sim.p[i*3+1] += GEN_LOAD_LIFT;
    pin.length = 0;
    def.nodes.forEach(function (nd, i) {
      if (!wingTag[nd.tag]) pin.push([i, sim.p[i*3], sim.p[i*3+1], sim.p[i*3+2]]);
    });
  }
  begin();

  function step(dt) {
    if (state.done || !ok) return state;
    t += dt;
    if (state.phase === 'settle') {
      sim.step(dt); clamp(); relax();
      if (t >= SETTLE) {
        // the settled shape under the wing's OWN weight is the jig datum, which
        // is what the real test measures deflection from
        const ax = sim.axes();
        base = st.map(s => rise(s, ax[1]));
        state.phase = 'ramp'; t = 0;
      }
      return state;
    }
    // ramp to ultimate, recording the limit case on the way past
    const n = state.phase === 'hold' ? ULT : Math.min(ULT, ULT * (t / RAMP));
    state.n = n;
    // the bags press DOWN, because they are bags. The aeroplane being inverted
    // is what makes that the flight-load direction through the spar.
    for (let k = 0; k < bags.length; k++)
      sim.impulse(bags[k][0], 0, -n * bags[k][1] * dt, 0);
    sim.step(dt); clamp(); relax();

    // WHICH member, not just which class. The allowable is per class, so the
    // percentage could always be worked out — but "78% of yield" does not tell
    // you where to put more tube. Recording the index costs one field and lets
    // the viewer put a marker on the member that is actually complaining.
    for (let bi = 0; bi < sim.beams.length; bi++) {
      const bm = sim.beams[bi];
      const cls = bm.cls || (bm.gear ? 'gear' : 'chassis');
      const F = Math.abs(bm.k * bm.strain * bm.L0);
      const g = peak[cls] || (peak[cls] = { F: 0, bi: -1 });
      if (F > g.F) { g.F = F; g.bi = bi; }
    }
    const ax = sim.axes();
    state.defl = st.map((s, i) => 100 * (rise(s, ax[1]) - base[i]) / semi);
    state.tipPct = state.defl[state.defl.length - 1];
    state.tipM = state.tipPct / 100 * semi;
    const w = yieldPct();
    if (w) { state.worstPct = w.pct; state.worstCls = w.cls; state.worstBeam = w.bi; }

    if (state.limitPct === null && n >= LIM) {
      state.limitPct = state.tipPct;
      state.limitYield = state.worstPct;
    }
    if (state.phase === 'ramp' && n >= ULT) { state.phase = 'hold'; t = 0; }
    else if (state.phase === 'hold' && t >= HOLD) {
      state.ultPct = state.tipPct;
      state.ultYield = state.worstPct;
      state.phase = 'done'; state.done = true;
      // The structure held if it stayed finite. Permanent set is PROXIED by
      // peak force against sigY*A — the load at which a member takes a set, and
      // correct even on soft springs because failure is a force threshold. It
      // is reported rather than failed on: `A = lin/rho` is one area for the
      // whole wing class and the worst member is usually the LIFT STRUT, which
      // a real aeroplane sizes on its own. See HANDOVER, GATE LOAD.
      state.verdict = sim.stats().bad ? 'BROKE UP'
        : (state.ultYield !== null && state.ultYield >= 100 ? 'HELD — over yield'
                                                           : 'HELD');
    }
    if (sim.stats().bad) { state.verdict = 'BROKE UP'; state.done = true; }
    return state;
  }

  // `bags` and `lift` are out here for the VIEWER. The bags were never geometry
  // — they are impulses on nodes — so there was nothing on screen to see going
  // on, which is why a load test read as an aeroplane sitting still and then
  // occasionally exploding. Handing out the same list the physics uses means
  // the sandbags drawn are the sandbags applied, and cannot drift from them.
  return { step: step, state: state, stations: st, semi: semi, W: W,
           limit: LIM, ult: ULT, bags: bags, lift: GEN_LOAD_LIFT };
}
// ===========================================================================
// THE PLAYER — the player's property as ONE document, one key, one version.
// ===========================================================================
// HANGARS.md §7: the shed's state lived in browser prefs, which is exactly
// the defect G105 fixed for the aeroplane — a pref cannot be saved, shared or
// reasoned about, and the moment there is more than one hangar a pref cannot
// hold them at all. This document holds what the player OWNS: today the sheds
// and the wallet, and nothing else needs to yet.
//
// ITS VERSION IS ITS OWN. G105's ruling, applied in reverse: state that is
// not the aeroplane costs no spec version, so GEN_SPEC_V does not know this
// file exists. PLAYER_V has its own migrator table, its own walk (the byte
// shape of genMigrateSpec's), and its own vintage shelf — GATE PLAYER loads
// tools/fixtures/player_*.json forever, because ruling 4 holds for property
// the way it holds for builds.
//
// RESERVED FOR P6: `fleet` and `logs`. The fleet is rows of named aeroplanes
// with plaques, logbooks, hours and wear — the same sentence as the sheds —
// and when it moves in, the lift from the flydiy.build.* slots is
// PLAYER_MIGRATORS' first real entry beside a frozen v1 fixture, NOT a second
// container. (The slot store itself may well stay underneath as the file
// cabinet — per-item envelopes, individually shareable; this document is the
// ledger of ownership, not the filing.)
//
// The name is `player`, not `estate` — ROADMAP G77.1 already spends "free
// estate" on screen real-estate, and this is property, not pixels.
const PLAYER_V = 1;

// { fromVersion: doc => doc } — each entry lifts a document one version. May
// mutate and return its argument. Runs BEFORE normalisation, on the raw
// shape the old game actually saved. EMPTY until a field changes UNITS, SIGN
// or HOME; the mechanism exists before its first real entry so that entry
// lands in an exercised, gated machine (GATE PLAYER injects a throwaway
// migrator, runs the walk, and removes it — G106's idiom).
const PLAYER_MIGRATORS = {};

function playerMigrate(r) {
  if (!r || typeof r !== 'object') return r;
  const v = r.v;
  if (typeof v !== 'number' || !isFinite(v)) return r;
  if (v >= PLAYER_V) return r;              // current, or from the future
  for (let i = Math.floor(v); i < PLAYER_V; i++)
    if (PLAYER_MIGRATORS[i]) r = PLAYER_MIGRATORS[i](r) || r;
  r.v = PLAYER_V;
  return r;
}

// A FACTORY, not a shared const: the viewer mutates the live document, and a
// shared default object would be mutated with it. The default shed is the
// club at its own dims with the full fit-out — which is exactly the room the
// game has always shown. `dims`, `parts` and `name` are OPTIONAL and absent:
// absent means DERIVED (the shell's defaults), the same null-means-derived
// ruling the spec lives by.
function playerDefault() {
  return {
    what: 'flydiy-player', v: PLAYER_V,
    wallet: 0,
    sheds: {
      HOME: {
        shell: 'club',
        kits: (typeof HANGAR_KITS_DEFAULT !== 'undefined'
               ? HANGAR_KITS_DEFAULT.slice()
               : ['park', 'bench', 'wood', 'metal', 'store', 'handling',
                  'office', 'comfort', 'curio', 'wip']),
      },
    },
  };
}

// Fills what is missing, carries what is present VERBATIM. Unknown shed ids
// are preserved (a newer game's meadow shed must survive a round trip through
// this one), unknown fields ride along untouched for the same reason.
function playerNormalise(r) {
  const def = playerDefault();
  if (!r || typeof r !== 'object') return def;
  r.what = 'flydiy-player';
  if (typeof r.v !== 'number' || !isFinite(r.v)) r.v = PLAYER_V;
  if (typeof r.wallet !== 'number' || !isFinite(r.wallet)) r.wallet = 0;
  if (!r.sheds || typeof r.sheds !== 'object') r.sheds = def.sheds;
  if (!r.sheds.HOME || typeof r.sheds.HOME !== 'object')
    r.sheds.HOME = def.sheds.HOME;
  const h = r.sheds.HOME;
  if (typeof h.shell !== 'string') h.shell = 'club';
  if (!Array.isArray(h.kits)) h.kits = def.sheds.HOME.kits;
  return r;
}

// THE ONE-TIME LIFT: the two old pref values (already parsed, or null) into
// a fresh v1 document. Pure, so the gate proves it without a browser. Dims
// carry only their three finite keys; parts carry verbatim — clamping stays
// a write-time concern (setDims), the same division of labour as the prefs
// had. flydiy.hangarMobile and flydiy.hangarEnvSrc are NOT lifted: view
// state never flies, and view state is not property (G106).
function playerLift(dims, parts) {
  const doc = playerDefault();
  if (dims && typeof dims === 'object') {
    const d = {};
    for (const k of ['HW', 'HD', 'EAVE'])
      if (typeof dims[k] === 'number' && isFinite(dims[k])) d[k] = dims[k];
    if (Object.keys(d).length) doc.sheds.HOME.dims = d;
  }
  if (parts && typeof parts === 'object' && Object.keys(parts).length)
    doc.sheds.HOME.parts = JSON.parse(JSON.stringify(parts));
  return doc;
}

// THE COMPOSITION RULE. The SITE keeps position and class-default dims (the
// declaration both scenes are gated against); the PLAYER's shed record owns
// the player's own dims; the renderer composes, per key, so the building you
// taxi past and the room you stand in are the same size by construction —
// which 25_airfield.js's header always claimed and the pref split silently
// broke: dragging the sliders resized the room and left the world's shed at
// the declaration.
function playerShedDims(doc, id, site) {
  const s = doc && doc.sheds && doc.sheds[id];
  const d = (s && s.dims) || {};
  const h = (site && site.hangar) || {};
  return { HW: d.HW || h.HW, HD: d.HD || h.HD, EAVE: d.EAVE || h.EAVE };
}
if (typeof module !== 'undefined')
  module.exports = { AIRFIELD_SITE, AIRFIELD_SITES, siteOf, siteOnFlat, AIRFIELD_PAD, siteToLocal, siteToWorld, siteRunway, siteMarkers, sitePaintStrip, siteOnPad, siteHangarBox, ATM, makeAtmos, ATMOS_ISA, atmosPowerRatio, atmosPropScale, decodeProp, decodePropPart, registerPropPack, propList, PROP_REG, buildCub, buildDrone, buildDC3, buildJodel, buildC172, buildChinook, buildPA18, makeSim, makeAutopilot, makeTestPilot, placeAtAerodrome, placeAtStand, makeWorld, bakeHydrology, POWERPLANTS, GEN_ENG_THERMO, genEngineThermo, genEnginePrice, POLARS, PAR, RHO, GROUND_SURF, decodeModel, decodeB64, defCG, defBodyProject, makeSkinBinding, sparDeltas, applySkinDeform, makeHingeBinding, applyHinges, makeLinkage, buildGen, resolveSpec, clampSpec, genNormaliseSpec, genIsSectioned, GEN_SPEC_V, GEN_MIGRATORS, genMigrateSpec, genFrame, genShakedown, genDensityAlt, genClimbAt, genTORunAt, GEN_DA_CASES, genPolar, genThinAirfoil, GEN_DEFAULT, GEN_PRESETS, GEN_MATERIALS, GEN_BUILD_GRAMMAR, GEN_ACCESS, genAccessNeeds, genAccessNeedsCage, genAccessList, GEN_SHAPES, GEN_FLAPS, GEN_TANKS, GEN_BAYS, genNacaT, genAerofoilArea, genWingBay, GEN_SYSTEMS, GEN_SEATING, GEN_TIPS, GEN_INTAKES, GEN_FINISH, GEN_PRICES, GEN_PROP_MATS, GEN_PROP_PITCH, GEN_SUSPENSION, GEN_RULES, genWing, poseSkinGen, genNodeBody, genRestFrame, genAirfoil, makeLoadTest, genLoadStations, GEN_LOAD_LIMIT, GEN_LOAD_ULT, GEN_LOAD_LIFT, genSect, genSuper, genCrownToN, genCrownScale, genMonoSpline, genBodyCurve, genBodyRows, GEN_N_ELL, GEN_N_BOX, GEN_LSTEP, SHELLS, shellLims, HANGAR_CAPS, HANGAR_KITS, HANGAR_KITS_DEFAULT, hangarFootprint, hangarFit, hangarFitRing, hangarCaps, hangarWants, PLAYER_V, PLAYER_MIGRATORS, playerMigrate, playerDefault, playerNormalise, playerLift, playerShedDims };
