// ============================================================
// CUB FLIGHT CORE — M1
// node-beam chassis + strip-theory aero + prop + ground
// Units: m, kg, N, s, rad. Axes: x aft (nose -x), y up, z right.
// ============================================================

const RHO = 1.225;


// ============================================================
// REGISTRIES — powerplants (engine + propeller) and airfoil polars.
// Thrust model per prop: T = thr * max(0, Tstatic - kV2 * V^2),
// propwash from momentum theory over the actual disk.
// ============================================================
// `price` is what the powerplant COSTS, in credits, second-hand and installed —
// added for the GARAGE's build ledger (G3). Inert for the hand-written fiches.
const POWERPLANTS = {
  a65_sensenich74: {
    price: 9000,
    engine: { name: 'Continental A-65', mass: 80, powerW: 48500 },
    prop:   { name: 'Sensenich 74CK', D: 1.88, Tstatic: 900, kV2: 0.26 },
  },
  r1830_hs23e50: {
    price: 65000,
    engine: { name: 'P&W R-1830 Twin Wasp', mass: 750, powerW: 895000 },
    prop:   { name: 'Hamilton Standard 23E50', D: 3.4, Tstatic: 11000, kV2: 0.543 },
  },
  io360_mccauley: {
    price: 38000,
    engine: { name: 'Lycoming IO-360-L2A', mass: 138, powerW: 134000 },
    prop:   { name: 'McCauley 1C235 fixed-pitch', D: 1.93, Tstatic: 2290, kV2: 0.136 },
  },
  rotax277_pusher: {
    price: 3500,
    engine: { name: 'Rotax 277 (pusher)', mass: 30, powerW: 21000 },
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
    engine: { name: 'VW 2180 conversion', mass: 66, powerW: 44000 },
    prop:   { name: '2-pale bois 1.60 m', D: 1.60, Tstatic: 757, kV2: 0.1855 },
  },
  rotax582_ivo: {
    price: 5500,
    engine: { name: 'Rotax 582 + 2.62 red.', mass: 43, powerW: 48000 },
    prop:   { name: 'IVO 3-pale 1.68 m', D: 1.68, Tstatic: 829, kV2: 0.2045 },
  },
  jabiru2200_std: {
    price: 15000,
    engine: { name: 'Jabiru 2200A', mass: 60, powerW: 63000 },
    prop:   { name: '2-pale bois 1.52 m', D: 1.52, Tstatic: 930, kV2: 0.1674 },
  },
  rotax912_warp: {
    price: 18000,
    engine: { name: 'Rotax 912 UL', mass: 58, powerW: 59600 },
    prop:   { name: 'Warp Drive 3-pale 1.73 m', D: 1.73, Tstatic: 977, kV2: 0.2169 },
  },
  o200_eprops: {
    price: 24000,
    engine: { name: 'Continental O-200-A', mass: 85, powerW: 74600 },
    prop:   { name: 'E-Props Durandal carbone', D: 1.73, Tstatic: 1700, kV2: 0.177 },
  },
  outrunner2212_9x47: {
    price: 25,
    engine: { name: '2212 outrunner 1000KV / 3S', mass: 0.10, powerW: 180 },
    prop:   { name: 'GWS 9x4.7 SlowFly', D: 0.229, Tstatic: 8.0, kV2: 0.0155 },
  },
};
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

