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
const GEN_PROP_PITCH = {
  climb:    { name: 'Fine (climb)',    fm: 0.58 },
  standard: { name: 'Standard',        fm: 0.46 },
  cruise:   { name: 'Coarse (cruise)', fm: 0.36 },
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
};

// Cabin box per seating layout: half-width, height above the lower longeron,
// fore-aft length, and the crew mass it carries.
// `deck` is the firewall top as a fraction of cabin height: the STEP between
// the two is the windscreen (see 63_gen_skin.js). A drone has no windscreen at
// all, so its deck is 1.0 and the nose runs continuously into the body — which
// is the whole visual difference between an aeroplane and an airframe.
const GEN_SEATING = {
  single:  { halfW: 0.32, h: 0.92, len: 0.62, crew: 1, deck: 0.70 },
  tandem2: { halfW: 0.36, h: 1.00, len: 0.78, crew: 2, deck: 0.70 },
  side2:   { halfW: 0.53, h: 1.05, len: 0.90, crew: 2, deck: 0.70 },
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
  propClear:   0.40,   // m, prop tip to ground in the LEVEL attitude (Cub 0.42)
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
  legDrop:     0.35,
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
//
// Nothing READS this number: `genNormaliseSpec` defaults every missing field
// from GEN_DEFAULT, and a field left `null` stays null and keeps being derived,
// so an older spec loads correctly without being told what it is. The version is
// here to be honest about the shape having changed, and to give a future
// migration something to branch on — not because one is needed today. Do not
// add a migration that only re-does what normalisation already does.
const GEN_SPEC_V = 4;

// The one preset this chantier ships: a strut-braced high-wing taildragger in
// the Cub envelope. Nulls are the derived fields — that is most of the
// aeroplane, which is the point.
const GEN_DEFAULT = {
  v: GEN_SPEC_V,
  meta: { name: 'Garage Special', reg: 'F-PGAR' },
  cabin: {
    seating: 'tandem2',
    // LOADING, not capacity: `seating` sizes the cabin, `pilots` says how many
    // seats are filled for the flight the shakedown and the gates measure. A
    // J-3-class aeroplane is flown solo; loading both seats is a different
    // aeroplane and should read as one.
    pilots: 1,
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
  prop: { D: null, blades: 2, material: 'wood', pitch: 'cruise' },
  // An ARRAY because a biplane is a real aeroplane. `position` is where the
  // spar meets the fuselage.
  wings: [{ span: 10.0, chord: 1.60, taper: 1.0, dihedral: 3.0,
            incidence: 1.5, washout: 1.5, naca: 2412, panels: 3,
            position: 'high', sweep: 0, tip: 'rounded',
            crankAt: 0, dihedralOut: null,
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
          hSpan: null, hChord: null, hX: null, hTaper: 1.0, tip: 'rounded',
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
  gear: { type: 'taildragger', suspension: 'bungee',
          track: null, x: null, y: null, wheelR: 0.20,
          twX: null, twY: null, twR: 0.10, stiffness: 1.0,
          legDrop: null, twLeg: null, camber: 0,
          place: { dx: 0, dtrack: 0 } },
  // `regX` places the registration along the body: 0 just aft of the cabin, 1 at
  // the fin. It was pinned at 45-78% of the run, which on a long fuselage put it
  // in the taper where the section halves in width.
  paint: { base: 0xf2c437, trim: 0x1b3a5c, sweep: 0.55, gloss: 0.42, regX: 0.30 },
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

function genNormaliseSpec(raw) {
  const r = genClone(raw && typeof raw === 'object' ? raw : {});
  if (Array.isArray(r.wings)) return genDefaults(r, GEN_DEFAULT);
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
  if (!GEN_TIPS[w.tip]) w.tip = 'rounded';
  if (!GEN_TIPS[S.tail.tip]) S.tail.tip = 'rounded';
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
  cb.noseGap = genClamp(cb.noseGap, 0.40, 1.10);
  S.gear.stiffness = genClamp(S.gear.stiffness == null ? 1 : S.gear.stiffness, 0.35, 3.0);
  S.gear.place.dx = genClamp(S.gear.place.dx, -0.80, 1.20);
  S.gear.place.dtrack = genClamp(S.gear.place.dtrack, -0.80, 1.50);
  S.tail.place.dx = genClamp(S.tail.place.dx, -1.5, 1.5);
  // fields the generator normally derives, but which the editor now exposes.
  // Bounded so an override cannot go degenerate; still nullable, so leaving
  // them alone keeps the derivation.
  cb.halfW = genClampN(cb.halfW, 0.28, 0.75);
  cb.h = genClampN(cb.h, 0.75, 1.45);
  cb.len = genClampN(cb.len, 0.60, 2.60);
  fu.tailArm = genClampN(fu.tailArm, 2.00, 6.50);
  S.tail.hSpan = genClampN(S.tail.hSpan, 1.50, 4.50);
  S.tail.hChord = genClampN(S.tail.hChord, 0.40, 1.60);
  S.tail.vHeight = genClampN(S.tail.vHeight, 0.60, 2.20);
  S.tail.vChord = genClampN(S.tail.vChord, 0.40, 1.80);
  S.gear.track = genClampN(S.gear.track, 0.90, 3.50);
  S.gear.wheelR = genClamp(S.gear.wheelR, 0.10, 0.40);
  S.gear.twR = genClamp(S.gear.twR, 0.05, 0.25);
  // Leg lengths: generous, because a stilt-legged bush aeroplane and a squatting
  // racer are both aeroplanes somebody builds. The floor is rule 5 (a leg this
  // short has no vertical stiffness whatever its k) and the shakedown says so.
  S.gear.legDrop = genClampN(S.gear.legDrop, 0.15, 1.20);
  S.gear.twLeg = genClampN(S.gear.twLeg, 0.06, 1.40);
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
  const cBar = w.chord * (2 / 3) * (1 + w.taper + w.taper * w.taper) / (1 + w.taper);
  const semi = 0.5 * w.span;
  // The aerodynamic centre sits at the quarter chord OF THE MAC, and sweep
  // carries that aft with the spanwise station the MAC lives at:
  //   yMac = (b/6) (1 + 2 lambda) / (1 + lambda)
  // Everything downstream reads xAC — the tail arm above all — so getting this
  // wrong would leave a swept aeroplane with a tail sized for a straight one.
  const yMac = (w.span / 6) * (1 + 2 * w.taper) / (1 + w.taper);
  const xAC = w.xLE + 0.25 * w.chord + yMac * Math.tan(w.sweep * Math.PI / 180);
  // TIP BOW. The radius is a fraction of the chord AT the joint, and the joint
  // is a radius inboard of the tip — implicit, so settle it by iteration (it
  // converges in two on any sane taper).
  const zR0 = S.cab.halfW;
  const lin = z => w.chord * (1 - (1 - w.taper) * (z - zR0) / Math.max(1e-6, semi - zR0));
  const bowF = (GEN_TIPS[w.tip] || GEN_TIPS.rounded).bow || 0;
  let Rb = bowF * lin(semi);
  for (let i = 0; i < 3; i++) Rb = bowF * lin(Math.max(zR0, semi - Rb));
  Rb = Math.max(0, Math.min(Rb, 0.45 * (semi - zR0)));
  w.tipR = Rb;
  w.tipZ = semi - Rb;
  w.tipC = Rb > 1e-6 ? lin(w.tipZ) : 0;
  // the bow removes a quarter of the rectangle it replaces on each tip
  // (half-ellipse of span Rb and chord tipC), so the REFERENCE AREA is the
  // shape's area, not the trapezoid's
  const Sw = w.span * w.chord * 0.5 * (1 + w.taper)
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
  const Sh = GEN_RULES.Vh * S.geom.Sw * cBar / lh;
  const Sv = GEN_RULES.Vv * S.geom.Sw * w.span / lv;
  put(t, 'hSpan', Math.sqrt(Sh * GEN_RULES.hAR), 'tail.hSpan');
  put(t, 'hChord', Sh / t.hSpan, 'tail.hChord');
  put(t, 'vHeight', Math.sqrt(Sv * GEN_RULES.vAR), 'tail.vHeight');
  put(t, 'vChord', Sv / t.vHeight, 'tail.vChord');
  S.tail.Sh = Sh; S.tail.Sv = Sv; S.tail.lh = lh; S.tail.lv = lv;
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
  const PP = (typeof POWERPLANTS !== 'undefined' && POWERPLANTS[S.engine]) || null;
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
  const byProp = S.engY - propR + S.gear.contactR - GEN_RULES.propClear;
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
