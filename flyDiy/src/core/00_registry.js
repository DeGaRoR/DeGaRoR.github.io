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
//   'turbine'  is FLAT-RATED (2026-09-05): the core makes more than the
//              rating and the fuel control holds rated power until the
//              thinning air brings the core down to it — `flatK` on the row
//              is that margin (core over rated), and the row may also carry
//              `length` (flange to accessory case, m) for the engine box,
//              because a turbine is light for its length
// The difference is large enough to change which aeroplane gets out of a
// mountain strip in August, which is exactly why it is declared per row rather
// than sniffed from the name. See 05_atmos.js for both scalings.
//
// `family` + `cooling` are PHYSICS-BEARING too (G134): the thermo laws below
// read them — specific consumption for the coming burn model, and the heat a
// cowl must reject for the coming ventilation model. Declared per row for the
// same reason aspiration is: a 582 is liquid-cooled and a 912 carries
// radiators, and sniffing that from a name is how a table starts lying.
//   family   'four' | 'two' | 'electric' | 'turbine'   (the SFC class)
//   cooling  'air'  | 'liquid'             (fins vs a radiator carry the heat)
//
// THE BLOWER (2026-09-05). Until this date the R-1830 was declared 'na' as an
// honest cut — "'turbo' is reserved for when there is something behind it".
// There is now: 05_atmos holds a blown engine's rated power to its critical
// altitude and lapses it as a piston from that air. Two values, one law:
//   aspiration 'super'   a mechanical supercharger (its drive is inside the
//                        rated figure — every big radial, the M-14P)
//   aspiration 'turbo'   an exhaust turbocharger (a Rotax 914/915, a TIO-540)
//   critAlt              metres of ISA pressure altitude the blower holds the
//                        rating to; 0 = ground-boosted, which is the NA law
// A blown row MUST carry critAlt and no other row may (GATE ATMOS §8).
const POWERPLANTS = {
  a65_sensenich74: {
    price: 9000,
    engine: { name: 'Continental A-65', mass: 80, powerW: 48500, aspiration: 'na', family: 'four', cooling: 'air', rpm: 2300 },
    // G158: 1202 N / 0.1941, the generator's own synthesis at standard pitch
    // (figure of merit 0.477 on a 1.88 m disc absorbing 48.5 kW) and inside
    // the published 250-280 lbf band for this combination. The old 900 / 0.26
    // was fitted to make a 23 %-light J-3 fiche reproduce a GROSS-weight climb
    // figure, and it is what set GEN_RULES.propV0K to a 42 %-efficient
    // propeller for the whole garage. See that constant, and
    // futureDesigns/PROP-THRUST-2026-09-02.md.
    prop:   { name: 'Sensenich 74CK', D: 1.88, Tstatic: 1202, kV2: 0.1941 },
  },
  r1830_hs23e50: {
    price: 65000,
    // 'super' since the blower model (2026-09-05): rated to 1 500 m, the
    // -92's 4 900 ft low-blower critical altitude
    engine: { name: 'P&W R-1830 Twin Wasp', mass: 750, powerW: 895000, aspiration: 'super', critAlt: 1500, family: 'four', cooling: 'air', rpm: 2700, gear: 1.78 },
    prop:   { name: 'Hamilton Standard 23E50', D: 3.4, Tstatic: 11000, kV2: 0.543 },
  },
  io360_mccauley: {
    price: 38000,
    engine: { name: 'Lycoming IO-360-L2A', mass: 138, powerW: 134000, aspiration: 'na', family: 'four', cooling: 'air', rpm: 2700 },
    prop:   { name: 'McCauley 1C235 fixed-pitch', D: 1.93, Tstatic: 2290, kV2: 0.136 },
  },
  rotax277_pusher: {
    price: 3500,
    engine: { name: 'Rotax 277 (pusher)', mass: 30, powerW: 21000, aspiration: 'na', family: 'two', cooling: 'air', rpm: 6250, gear: 2.58 },
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
  // goes as P^(2/3) D^(2/3), so scaling from it keeps the whole fleet on one
  // anchor rather than adding four new hand-tuned opinions. kV2 then comes
  // from GEN_RULES.propV0K exactly as the generator's own prop synthesis
  // derives it (60_gen_spec.js), so registry and generator agree.
  //
  // G158: RE-DERIVED, every one of them, when the anchor moved. These rows are
  // not opinions to re-fit — they are `genResolveProp`'s output at each row's
  // own diameter, blade count and standard pitch, and the four here plus the
  // seven in the electric ladder below were all recomputed by running that
  // synthesis with propV0K 1.95 and fm 0.477. The two 3-blade rows also gained
  // the +5.5 %/blade solidity bonus, which the first pass had left out.
  //
  // `mass` is DRY ENGINE, the convention the entries above already use (A-65
  // 80 kg against a real 77). The 582 is the exception and says so: a two-
  // stroke without its reduction gearbox is not a powerplant, so its 43 kg is
  // engine + gearbox + radiator + coolant.
  vw2180_wood: {
    price: 6000,
    engine: { name: 'VW 2180 conversion', mass: 66, powerW: 44000, aspiration: 'na', family: 'four', cooling: 'air', rpm: 3200 },
    prop:   { name: '2-pale bois 1.60 m', D: 1.60, Tstatic: 1012, kV2: 0.1406 },
  },
  rotax582_ivo: {
    price: 5500,
    engine: { name: 'Rotax 582 + 2.62 red.', mass: 43, powerW: 48000, aspiration: 'na', family: 'two', cooling: 'liquid', rpm: 6500, gear: 2.62 },
    prop:   { name: 'IVO 3-pale 1.68 m', D: 1.68, Tstatic: 1168, kV2: 0.182 },
  },
  jabiru2200_std: {
    price: 15000,
    engine: { name: 'Jabiru 2200A', mass: 60, powerW: 63000, aspiration: 'na', family: 'four', cooling: 'air', rpm: 3300 },
    prop:   { name: '2-pale bois 1.52 m', D: 1.52, Tstatic: 1242, kV2: 0.1269 },
  },
  rotax912_warp: {
    price: 18000,
    engine: { name: 'Rotax 912 UL', mass: 58, powerW: 59600, aspiration: 'na', family: 'four', cooling: 'liquid', rpm: 5800, gear: 2.27 },
    prop:   { name: 'Warp Drive 3-pale 1.73 m', D: 1.73, Tstatic: 1376, kV2: 0.193 },
  },
  o200_eprops: {
    price: 24000,
    engine: { name: 'Continental O-200-A', mass: 85, powerW: 74600, aspiration: 'na', family: 'four', cooling: 'air', rpm: 2750 },
    prop:   { name: 'E-Props Durandal carbone', D: 1.73, Tstatic: 1700, kV2: 0.177 },
  },
  // THE AMATEUR RADIALS (G157, the user: "More radial engines and inline for
  // small planes. Let's shoot for the amateur range to be fully filled"). The
  // registry jumped from a 100 hp flat four straight to a 1200 hp Twin Wasp,
  // so the only round engine in the game was a DC-3's. These two are what a
  // homebuilder actually bolts on, and they are the engines G154's radial cowl
  // was built for.
  // MASS AND POWER ARE THE PUBLISHED ONES. The PROP row is not published —
  // a radial like these swings whatever its owner chose — so Tstatic and kV2
  // are scaled from the neighbours above at ~18 N per kW, and are estimates
  // wearing a real prop's diameter rather than measurements.
  // THE BUSH RADIAL (2026-09-04, the user: "we could do something like the
  // DC3 / Beaver now that we have large radial engines"): the R-985 Wasp
  // Junior, the Beaver's own — 450 hp, 290 kg. Mass and power are the
  // published ones; like the R-1830 it is SUPERCHARGED — 'super', held to
  // 1 500 m (its 5 000 ft rating) since the blower model. The PROP is DERIVED,
  // not chosen: genPropSynth's own output at 2.59 m, two blades, alloy,
  // standard pitch — the Hamilton Standard 2B20 the Beaver swings.
  r985_hs2b20: {
    price: 48000,
    engine: { name: 'P&W R-985 Wasp Junior', mass: 290, powerW: 336000, aspiration: 'super', critAlt: 1500, family: 'four', cooling: 'air', rpm: 2300 },
    prop:   { name: 'Hamilton Standard 2B20', D: 2.59, Tstatic: 5408, kV2: 0.368 },
  },
  verner7u_wood: {
    price: 22000,
    engine: { name: 'Verner Scarlett 7U', mass: 78, powerW: 78000, aspiration: 'na', family: 'four', cooling: 'air', rpm: 2400 },
    prop:   { name: '2-pale bois 1.80 m', D: 1.80, Tstatic: 1400, kV2: 0.250 },
  },
  rotec3600_std: {
    price: 30000,
    engine: { name: 'Rotec R3600', mass: 102, powerW: 112000, aspiration: 'na', family: 'four', cooling: 'air', rpm: 3600, gear: 2 },
    prop:   { name: '2-pale 1.95 m', D: 1.95, Tstatic: 1950, kV2: 0.240 },
  },
  // THE AMATEUR IN-LINES (G165, the other half of the user's "more radial
  // engines and inline for small planes"). G157 added the radials and held
  // these back for a stated reason — an in-line was DRAWN on its side then,
  // and could only be a two-stroke besides, so the classic small in-lines
  // could not exist. Both are true no longer: G163 stood the bank up, G164
  // gave it an aim, and the two-stroke is a default rather than a law.
  //
  // BOTH ARE INVERTED, which is what an aero in-line almost always is — the
  // crankcase on top puts the crankshaft high and the propeller with it, and
  // it is the whole reason G164's `down` aim exists. The 3 kg of prop-shaft
  // extension a Gipsy carries is not modelled and not claimed.
  //
  // MASS AND POWER ARE PUBLISHED. The PROPS ARE DERIVED, not chosen: Tstatic
  // and kV2 are `genPropSynth`'s own output at each row's diameter, blade
  // count and standard pitch (propV0K 1.95, fm 0.477), which is the rule the
  // G158 rows above state and the reason registry and generator agree about
  // thrust. Reproducing the Jabiru row exactly from the same three numbers is
  // how I know I ran the right formula.
  mikron3_wood: {
    price: 16000,
    engine: { name: 'Walter Mikron III', mass: 74, powerW: 48000, aspiration: 'na', family: 'four', cooling: 'air', rpm: 2600 },
    prop:   { name: '2-pale bois 1.65 m', D: 1.65, Tstatic: 1094, kV2: 0.1495 },
  },
  gipsymajor1_wood: {
    price: 26000,
    engine: { name: 'DH Gipsy Major 1', mass: 139, powerW: 97000, aspiration: 'na', family: 'four', cooling: 'air', rpm: 2350 },
    prop:   { name: '2-pale bois 1.98 m', D: 1.98, Tstatic: 1975, kV2: 0.2153 },
  },
  // THE AERO Vs (2026-09-05, the V test — the user: "test the V configs,
  // since they've never been done"). The registry had no V at all, the
  // bench's V row was marked UNVALIDATED and the panel could not even
  // select it (no 8 or 12 in the cylinder drop). These two are the published
  // normally-aspirated air-cooled inverted V8s the family's kM was fitted
  // on: the Hirth HM 508 (Arado Ar 79, Klemm Kl 35) and the Argus As 10
  // (Fieseler Storch, Bf 108 Taifun). Mass and power are published; the
  // PROPS are genPropSynth's own output at two wooden blades of 2.30 and
  // 2.40 m at standard pitch; the prices are the bent four-stroke law's.
  hirth508_wood: {
    price: 40000,
    engine: { name: 'Hirth HM 508D', mass: 186, powerW: 209000, aspiration: 'na', family: 'four', cooling: 'air', rpm: 3000, gear: 1.5 },
    prop:   { name: '2-pale bois 2.30 m', D: 2.30, Tstatic: 3641, kV2: 0.2905 },
  },
  argus10c_wood: {
    price: 38000,
    engine: { name: 'Argus As 10C', mass: 213, powerW: 176000, aspiration: 'na', family: 'four', cooling: 'air', rpm: 2000 },
    prop:   { name: '2-pale bois 2.40 m', D: 2.40, Tstatic: 3340, kV2: 0.3163 },
  },
  // THE COVERAGE FILL (2026-09-05, the engine-coverage study — the user:
  // "make sure we cover the whole scale from 50 HP to 1000 HP, on almost
  // all types"). The registry had NOTHING between 100 and 180 hp in a flat,
  // nothing at all between 200 and 300 hp in any layout, nothing between
  // 450 and 600, and no V. Every row here is a published engine: mass and
  // power are the manufacturer's, the PROP is genPropSynth's own output at
  // a stated diameter, blade count and standard pitch (never fitted), and
  // the price is the bent four-stroke law's (or the family's) rounded.
  // The blown ones say so and carry their critical altitude.
  //
  // THE FLATS: 100 -> 150 -> 180 -> 235 -> 310 -> 400 hp
  o320_mccauley: {
    price: 28000,
    engine: { name: 'Lycoming O-320-E2D', mass: 122, powerW: 112000, aspiration: 'na', family: 'four', cooling: 'air', rpm: 2700 },
    prop:   { name: '2-blade alloy 1.93 m', D: 1.93, Tstatic: 2137, kV2: 0.2046 },
  },
  o540_hartzell: {
    price: 38000,
    engine: { name: 'Lycoming O-540-B2C5', mass: 176, powerW: 175000, aspiration: 'na', family: 'four', cooling: 'air', rpm: 2575 },
    prop:   { name: '2-blade alloy 2.13 m', D: 2.13, Tstatic: 3073, kV2: 0.2492 },
  },
  io550_hartzell3: {
    price: 42000,
    engine: { name: 'Continental IO-550-N', mass: 195, powerW: 231000, aspiration: 'na', family: 'four', cooling: 'air', rpm: 2700 },
    prop:   { name: '3-blade alloy 1.98 m', D: 1.98, Tstatic: 3716, kV2: 0.2528 },
  },
  io720_hartzell3: {
    price: 45000,
    engine: { name: 'Lycoming IO-720-A1A', mass: 257, powerW: 298000, aspiration: 'na', family: 'four', cooling: 'air', rpm: 2650 },
    prop:   { name: '3-blade alloy 2.03 m', D: 2.03, Tstatic: 4477, kV2: 0.2658 },
  },
  // the amateur turbo (the 912's blown sibling): 'turbo', held to 4 600 m
  rotax915_carbon: {
    price: 34000,
    engine: { name: 'Rotax 915 iS', mass: 84, powerW: 105000, aspiration: 'turbo', critAlt: 4600, family: 'four', cooling: 'liquid', rpm: 5800, gear: 2.54 },
    prop:   { name: '3-blade carbon 1.80 m', D: 1.80, Tstatic: 2061, kV2: 0.2090 },
  },
  // THE IN-LINE'S CEILING: the inverted six of the PT-19 trainer
  ranger440_wood: {
    price: 35000,
    engine: { name: 'Ranger L-440-5', mass: 170, powerW: 149000, aspiration: 'na', family: 'four', cooling: 'air', rpm: 2450 },
    prop:   { name: '2-blade wood 2.20 m', D: 2.20, Tstatic: 2821, kV2: 0.2658 },
  },
  // THE CLASSIC RADIALS: 150 -> 220 -> 300 -> 360 -> 450 -> 600 hp
  w670_hs2b: {
    price: 36000,
    engine: { name: 'Continental W-670-6A', mass: 211, powerW: 164000, aspiration: 'na', family: 'four', cooling: 'air', rpm: 2075 },
    prop:   { name: '2-blade alloy 2.59 m', D: 2.59, Tstatic: 3352, kV2: 0.3684 },
  },
  r755_hs2b: {
    price: 41000,
    engine: { name: 'Jacobs R-755-A2', mass: 230, powerW: 224000, aspiration: 'na', family: 'four', cooling: 'air', rpm: 2200 },
    prop:   { name: '2-blade alloy 2.59 m', D: 2.59, Tstatic: 4127, kV2: 0.3684 },
  },
  // the aerobatic radial of today (Yak-52, Sukhoi): supercharged, and
  // nearly ground-boosted — rated to 500 m
  m14p_v530: {
    price: 43000,
    engine: { name: 'Vedeneyev M-14P', mass: 214, powerW: 268000, aspiration: 'super', critAlt: 500, family: 'four', cooling: 'air', rpm: 2900, gear: 1.52 },
    prop:   { name: '2-blade alloy 2.40 m', D: 2.40, Tstatic: 4421, kV2: 0.3163 },
  },
  // the Wasp (Harvard, Otter, Ag Cat): ground-boosted — 600 hp at the
  // strip, 550 at 5 000 ft, so its ceiling is nearly the NA law
  r1340_hs12d40: {
    price: 52000,
    engine: { name: 'P&W R-1340-AN-1 Wasp', mass: 400, powerW: 447000, aspiration: 'super', critAlt: 300, family: 'four', cooling: 'air', rpm: 2250 },
    prop:   { name: '2-blade alloy 2.74 m', D: 2.74, Tstatic: 6792, kV2: 0.4123 },
  },
  // the two-stroke's 50 hp rung (mass with its gearbox, the 582's convention)
  rotax503_wood: {
    price: 4000,
    engine: { name: 'Rotax 503 UL + B red.', mass: 38, powerW: 37000, aspiration: 'na', family: 'two', cooling: 'air', rpm: 6800, gear: 2.58 },
    prop:   { name: '2-blade wood 1.60 m', D: 1.60, Tstatic: 901, kV2: 0.1406 },
  },
  // the electric ladder's missing rung: the 268 was one of the five motors
  // the electric mass law was fitted on and had no row of its own
  emrax268_carbon: {
    price: 32000,
    engine: { name: 'EMRAX 268 / 107 kW', mass: 20.3, powerW: 107000, aspiration: 'electric', family: 'electric', cooling: 'air', rpm: 2400 },
    prop:   { name: '3-blade carbon 1.90 m', D: 1.90, Tstatic: 2164, kV2: 0.2328 },
  },
  outrunner2212_9x47: {
    price: 25,
    engine: { name: '2212 outrunner 1000KV / 3S', mass: 0.10, powerW: 180, aspiration: 'electric', family: 'electric', cooling: 'air', rpm: 9000 },
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
  // GEN_RULES.propV0K, like the middle-market rows above — and re-derived with
  // them at G158 when that constant moved.
  outrunner3548_12x6: {
    price: 55,
    engine: { name: '3548 outrunner 900KV / 4S', mass: 0.35, powerW: 800, aspiration: 'electric', family: 'electric', cooling: 'air', rpm: 11000 },
    prop:   { name: 'APC 12x6E', D: 0.305, Tstatic: 23.2, kV2: 0.0051 },
  },
  outrunner6374_18x10: {
    price: 130,
    engine: { name: '6374 outrunner 170KV / 12S', mass: 0.75, powerW: 2200, aspiration: 'electric', family: 'electric', cooling: 'air', rpm: 6300 },
    prop:   { name: 'carbone 18x10', D: 0.457, Tstatic: 59.5, kV2: 0.0115 },
  },
  eppg_direct_130: {
    price: 3800,
    engine: { name: 'e-PPG 12 kW direct drive', mass: 7.0, powerW: 12000, aspiration: 'electric', family: 'electric', cooling: 'air', rpm: 2500 },
    prop:   { name: '2-pale carbone 1.30 m', D: 1.30, Tstatic: 370, kV2: 0.0928 },
  },
  fes_folding_100: {
    price: 9500,
    engine: { name: 'FES sustainer 22 kW', mass: 9.0, powerW: 22000, aspiration: 'electric', family: 'electric', cooling: 'air', rpm: 4500 },
    prop:   { name: 'lames repliables 1.00 m', D: 1.00, Tstatic: 466, kV2: 0.0549 },
  },
  emrax228_3blade: {
    price: 11000,
    engine: { name: 'EMRAX 228 / 55 kW', mass: 19.5, powerW: 55000, aspiration: 'electric', family: 'electric', cooling: 'air', rpm: 2400 },
    prop:   { name: '3-pale composite 1.65 m', D: 1.65, Tstatic: 1264, kV2: 0.1756 },
  },
  e811_velis: {
    price: 28000,
    engine: { name: 'Pipistrel E-811 (certified)', mass: 30.0, powerW: 57600, aspiration: 'electric', family: 'electric', cooling: 'air', rpm: 2500 },
    prop:   { name: 'composite fixe 1.64 m', D: 1.64, Tstatic: 1231, kV2: 0.1477 },
  },
  sp260d_class: {
    price: 90000,
    engine: { name: 'SP260D-class 260 kW', mass: 68.0, powerW: 260000, aspiration: 'electric', family: 'electric', cooling: 'air', rpm: 2500 },
    prop:   { name: 'MT 3-pale 2.20 m', D: 2.20, Tstatic: 4313, kV2: 0.3121 },
  },
  // THE TURBOPROPS (2026-09-05, futureDesigns/TURBOPROP-2026-09-05.md §4) —
  // the PT6A reverse-flow pair the user named, a Caravan's and a Kodiak's.
  // Dry masses are P&W's (with the reduction gearbox, without the prop);
  // `flatK` is the flat-rating margin 05_atmos reads (core ~850 shp behind a
  // 675 rating; ~1 000 behind a 750); `length` is flange to accessory case,
  // for the engine box. The props are genPropSynth's own output at each
  // row's diameter, blades and rated power (standard pitch, aluminium) —
  // 7.7 kN static on the Caravan's 2.69 m three-blade is inside the
  // published band. Prices are the second-hand market's: 5-7x an R-985.
  pt6a114a_hartzell3: {
    price: 240000,
    engine: { name: 'P&W PT6A-114A', mass: 160, powerW: 503000, aspiration: 'turbine', family: 'turbine', cooling: 'air', flatK: 1.26, length: 1.60, rpm: 1900, cs: true },
    prop:   { name: 'Hartzell 3-blade 2.69 m', D: 2.69, Tstatic: 7657, kV2: 0.4667 },
  },
  pt6a34_hartzell4: {
    price: 265000,
    engine: { name: 'P&W PT6A-34', mass: 150, powerW: 560000, aspiration: 'turbine', family: 'turbine', cooling: 'air', flatK: 1.33, length: 1.57, rpm: 2200, cs: true },
    prop:   { name: 'Hartzell 4-blade 2.44 m', D: 2.44, Tstatic: 8109, kV2: 0.4472 },
  },
  // THE MEDIUM PT6s (2026-09-05, the coverage fill — inside the study's
  // ruling 3, PT6 only): a King Air B200's -42 and a King Air 350's -60A,
  // the 850 and 1 050 shp rungs. Dry masses are P&W's; the props are
  // genPropSynth's output at each installation's four-blade diameter.
  pt6a42_hartzell4: {
    price: 300000,
    engine: { name: 'P&W PT6A-42', mass: 183, powerW: 634000, aspiration: 'turbine', family: 'turbine', cooling: 'air', flatK: 1.24, length: 1.70, rpm: 2000, cs: true },
    prop:   { name: 'Hartzell 4-blade 2.36 m', D: 2.36, Tstatic: 8615, kV2: 0.4183 },
  },
  pt6a60a_hartzell4: {
    price: 380000,
    engine: { name: 'P&W PT6A-60A', mass: 218, powerW: 783000, aspiration: 'turbine', family: 'turbine', cooling: 'air', flatK: 1.20, length: 1.85, rpm: 1700, cs: true },
    prop:   { name: 'Hartzell 4-blade 2.67 m', D: 2.67, Tstatic: 10767, kV2: 0.5355 },
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
  // A TURBINE (2026-09-05, futureDesigns/TURBOPROP-2026-09-05.md §1): a PT6
  // burns 0.33-0.37 kg/kWh at rated power (the classic 0.55-0.60 lb/shp-h);
  // the heat leaves BY THE PIPE and the cowl only cools the oil — ~5 % of
  // shaft power, which is why a turboprop nacelle is closed where a radial's
  // is a ring. Quoted at RATED like the rest; a turbine's part-load SFC is the
  // worst of the four (~1.3x at half power) and is the burn model's to carry.
  turbine:  { sfcKgKWh: 0.35, eta: null, cool: { air: 0.05, liquid: 0.05 } },
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

// THE SHAFT SPEED (the panel arc, session 1, 2026-09-11). Until this date the
// model had NO PROPELLER RPM in it (60_gen_spec.js says so, and names the
// missing rpm limit as a defect) and the tachometer on the dash was a
// decoration. The user's ruling: a DERIVED rpm law in core, one function,
// so the F0 chantier (torque, swirl) inherits it and the gates can test it.
//
// Every row now carries `rpm` — the RATED ENGINE speed, the number on the
// tacho — and, where a reduction unit sits between the crank and the prop,
// `gear` (prop = rpm / gear; the 912's 2.27, the 582's 2.62, the Twin Wasp's
// 16:9). A turbine row carries `cs: true`: its propeller is governed to a
// constant speed and the gauge that moves is torque, so `rpm` is Np at 100 %.
//
// THE LAW, for a fixed-pitch propeller. Engine torque is flat with speed at
// a throttle setting (true within a few per cent over the 60-100 % band of
// every aero piston); propeller torque falls with advance ratio with the
// SAME quadratic shape the model's own thrust law already has:
//     Qe = thrEff · powerK · Qr                    Qr = Pr / omegaR
//     Qp = Cq0 · rho · D^5 · (n^2 - (V / (D J1))^2)   Cq(J) = Cq0 (1 - (J/J1)^2)
// and equating the two gives the closed form
//     n = sqrt( thrEff · (powerK / sigma) · nS^2 + (V / (D J1))^2 )
// with nS = staticK · nR, the full-throttle STATIC speed as a fraction of
// rated (0.92: the A-65/74CK turns 2150 tied down against 2300 rated, the
// O-200 2400 against 2750 — the 0.87-0.94 band of every cruise prop), and
// J1 = V0 / (nR D): the torque runs out where the model's thrust runs out
// (V0 = sqrt(Tstatic / kV2), the synthesis's own zero-thrust speed). ONE new
// constant, and the anchors it reproduces on the A-65 (V0 = 78.7 m/s):
//     static 2116 · climb 24 m/s 2225 · cruise 33 m/s 2325
// against the J-3's real 2150 / 2200-2250 / 2300. A dead engine windmills
// at n = V / (D J1), which is what the second term is. Electric rows use the
// same law (a motor's torque is flat with speed at a command). A `cs` row
// returns nR whenever the engine is running.
//
// `thrEff` carries the IDLE: a running piston never turns slower than
// ~0.28 nR (the A-65 idles at 650), so the throttle maps to torque as
// idle + (1 - idle) thr with idle = (0.28 nR / nS)^2.
const GEN_SHAFT = {
  staticK: 0.92,     // static full-throttle rpm / rated, fixed-pitch cruise prop
  idleK: 0.28,       // idle rpm / rated
};
// PROPELLER shaft speed in rpm. `eng` is the engine dict (rpm, gear, cs),
// `pr` the prop record (D, Tstatic, kV2), `thr` 0..1, V the TRUE airspeed
// into the disc (m/s), `sigma` the density ratio and `powerK` the
// powerplant's own altitude ratio (05_atmos). `running` false = windmilling.
function genShaftRpm(eng, pr, thr, V, sigma, powerK, running) {
  const e = eng || {}, p = pr || {};
  const gear = e.gear > 0 ? e.gear : 1;
  const nR = (e.rpm > 0 ? e.rpm : 2300) / gear;
  const D = p.D > 0 ? p.D : 1.8;
  if (e.cs) return running === false ? 0 : nR;
  const V0 = (p.Tstatic > 0 && p.kV2 > 0) ? Math.sqrt(p.Tstatic / p.kV2) : 60;
  const J1 = V0 / (nR * D);
  const wind = Math.max(0, V) / (D * J1);
  const nS = GEN_SHAFT.staticK * nR;
  const idle = Math.pow(GEN_SHAFT.idleK * nR / nS, 2);
  const t = running === false ? 0
          : idle + (1 - idle) * Math.max(0, Math.min(1, thr || 0));
  const sig = sigma > 0 ? sigma : 1, pk = powerK >= 0 ? powerK : 1;
  return Math.sqrt(t * (pk / sig) * nS * nS + wind * wind);
}
// the number on the tacho: engine speed, through the reduction unit
function genEngineRpm(eng, propRpm) {
  return propRpm * ((eng && eng.gear > 0) ? eng.gear : 1);
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
  // a turbine is the dear end of the market — 5-7x a radial of the same
  // power second-hand (a used PT6A-34 against a used R-985); fitted on the
  // two PT6A rows and banded by _engcustom_check like every other family
  if (family === 'turbine') return Math.round(250 * Math.pow(kW, 1.1));
  // THE FOUR-STROKE LAW BENDS (2026-09-05): kW^1.3 is the AMATEUR market and
  // holds to the IO-360; above it the second-hand warbird market prices by
  // provenance more than by kilowatts. Fitted on the R-985 (336 kW, 48k) and
  // the R-1830 (895 kW, 65k): a knee at 130 kW, then kW^0.35 — within 2 % of
  // both, where the straight law read 2.4x and 6.4x. The R-1830's waiver in
  // _engcustom_check is retired by this line.
  const knee = 130;
  if (kW <= knee) return Math.round(60 * Math.pow(kW, 1.3));
  return Math.round(60 * Math.pow(knee, 1.3) * Math.pow(kW / knee, 0.35));
}

// ============================================================
// WHERE AN ENGINE'S MASS SITS (2026-09-05, the cgFwd half-session of
// futureDesigns/TURBOPROP-2026-09-05.md §8). `cgAft` is the engine's centre
// of mass AFT OF ITS PROP FLANGE, in metres — engine-intrinsic, so it means
// the same thing on a nose, a nacelle and a pusher. The frame used to hang
// the whole engine on its mount nodes at the flange station: a PT6's mass sat
// 0.63 m ahead of where it is, a boxer's 0.20 — the longest arm on the
// aeroplane, wrong by the engine's own half-length.
//
// MEASURED, NOT DECLARED: every number is the bench's own `cgZ` for the
// preset that maps to the row (tools/_eng_gen.js resolve of the
// _eng_page.js preset, through CAGE_JOIN_ENGINES), which is the sum of the
// resolve's mass items along the crank. GATE ENGID §10 re-measures each one
// against the bench and goes red at 2 cm, so this table cannot drift from the
// engine it describes. A row without an entry (no preset behind it) hangs its
// mass where it always did — absent means today, byte for byte.
const GEN_ENG_CG = {
  a65_sensenich74: 0.20, o200_eprops: 0.21, io360_mccauley: 0.24,
  jabiru2200_std: 0.20, vw2180_wood: 0.19, rotax912_warp: 0.23,
  rotax277_pusher: 0.11, rotax582_ivo: 0.17, rotax503_wood: 0.16,
  verner7u_wood: 0.12, rotec3600_std: 0.12,
  mikron3_wood: 0.31, gipsymajor1_wood: 0.39,
  hirth508_wood: 0.35, argus10c_wood: 0.39,
  o320_mccauley: 0.24, o540_hartzell: 0.33, io550_hartzell3: 0.34,
  io720_hartzell3: 0.42, rotax915_carbon: 0.24, ranger440_wood: 0.50,
  w670_hs2b: 0.15, r755_hs2b: 0.16, m14p_v530: 0.14, r1340_hs12d40: 0.16,
  r985_hs2b20: 0.15, r1830_hs23e50: 0.16,
  outrunner2212_9x47: 0.02, outrunner6374_18x10: 0.06, eppg_direct_130: 0.13,
  fes_folding_100: 0.12, emrax228_3blade: 0.12, e811_velis: 0.19,
  sp260d_class: 0.31, emrax268_carbon: 0.14,
  pt6a114a_hartzell3: 0.63, pt6a34_hartzell4: 0.65, pt6a42_hartzell4: 0.71,
  pt6a60a_hartzell4: 0.78,
};
// the one reader: a custom row's own number outranks the table's
function genEngineCgAft(key, engine) {
  if (engine && engine.cgAft != null && isFinite(engine.cgAft)) return engine.cgAft;
  const v = GEN_ENG_CG[key];
  return v == null ? null : v;
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

