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
// ---------------------------------------------------------------------------
// `cover` IS AN EFFECTIVE AREAL DENSITY, AND FOR THREE OF THESE FOUR IT HAS TO
// STAND IN FOR STRUCTURE THE LATTICE DOES NOT MODEL (G159, the user: "we
// underestimate the amount of structural elements, in particular for metal
// aircrafts").
//
// On tube and fabric the lattice IS the structure: the members are the tubes,
// the covering is the cloth, and `cover` is literally what a square metre of
// finished fabric weighs. On a semi-monocoque none of that holds. The load is
// in the skin, carried by stringers and frames in a density no 50-node truss
// has, and `cover` is the only place their mass can live.
//
// MEASURED, and it is not a small error: a C172-shaped alloy build billed
// 52 kg of skin over 50 m2 at 1.05 kg/m2 -- LESS THAN HALF the bare 0.7 mm
// 2024-T3 sheet, before a single stringer. Empty weight came out 479 kg
// against a real 767.
//
// THE FOUR NUMBERS, each anchored on what the construction really weighs per
// square metre of covered surface, skin plus the substructure under it:
//   tubeFabric  a finished Ceconite / Poly-Fiber system is 0.30-0.45. The
//               lattice already carries the tubes, so this one is literal --
//               and it is corroborated: the Cub comes out at 331 kg empty
//               against a published 308-345.
//   wood        1.5 mm birch ply is 1.02, plus glue, gussets, capping and the
//               fabric and dope over it.
//   alloy       0.7 mm 2024-T3 is 1.95, and stringers, frames, rivets and lap
//               joints are about 1.3x the skin again. GA semi-monocoques
//               measure 4-5.5 kg/m2 of covered surface.
//   carbon      a cloth/foam/cloth sandwich with its resin is 2-3, and being
//               lighter than alloy for the same job is the whole point of it.
//
// DECLARED RESIDUAL: even at 4.5 the alloy build lands about 15 % light,
// because the members themselves (`lin`) are still a truss standing in for a
// stringer field. That is the next lever and it is deliberately not pulled
// here -- one change, one measurement.
const GEN_MATERIALS = {
  tubeFabric: {
    name: '4130 tube + fabric',
    phys: { E: 205e9, rho: 7850, sigY: 460e6 },
    lin:   { fus: 0.58, wing: 0.62, gear: 1.05 },
    cover: 0.42,      // finished fabric: the lattice carries the tubes
    // THE FUSELAGE ROW x4 (G179.2, the user: "the wing mount to the frame
    // just seems far too bendy ... You allow the wing to move almost
    // independently of the cabin"). Measured on the user's wing-mounted twin
    // at full thrust on the take-off roll, against the firewall: the wing
    // root 29 mm forward, the strut feet 8 aft, the cabin box sheared 30 mm
    // roof to floor — and the elongation was not in the box (a x10 on its
    // own members moved nothing) but 3 mm in EVERY bay's longerons and
    // diagonals from the firewall to the tail post: the whole truss bending
    // under a thrust couple, at 0.3-0.5 % strain. The fus row was the Cub
    // fiche's hand value, ~50x under the E*A/L of the tube it names (see
    // wingK for the same accounting on the wing); x4 puts a steel truss at
    // the alloy monocoque's level. Measured after: shear 7 mm, root 8, and
    // the substep count did not move on ANY material (the wing sets it):
    // twin 54 -> 54, fleet 46/57/87/124/77/139/107/180 -> the same. The
    // engine bearer is held at its own measured value (mountK 10 -> 2.5 on
    // this row). THIS ROW ONLY, and here is why that is not two rules: the
    // wood, alloy and carbon rows were FITTED to their fiches with the
    // fuselage's compliance inside the wing's measured flex (a strut-braced
    // wing's load path runs floor to roof through the box), and x4 on them
    // dropped their strut cases under GATE LOAD's 0.3-1 % band (wood 0.40
    // -> 0.15, alloy 0.31 -> 0.11, carbon 0.07 -> -0.01, the last a rig
    // artefact) — measured. This row was never fitted to anything: it was
    // the Cub fiche's hand value. Its strut case moves 0.77 -> 0.46 %/g,
    // inside the band. Re-fitting the other three is their own measurement.
    k:     { fus: 8.0e5, wing: 5.0e5, gear: 2.8e4 },
    c:     { fus: 120,   wing: 450,   gear: 900 },
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
    cover: 1.35,      // 1.5 mm ply + glue, gussets, capping, dope
    // the same rule as the metal rows below, and applied here even though this
    // row was already linear and already in band: a ply skin carries bending
    // too, so leaving it alone would have been one rule for the materials that
    // failed and another for the one that did not. Per-group factors fus x1.04,
    // wing x1.26, gear x1.01 — small, because ply was the least wrong of the
    // three covering figures. Strut moves 0.91 -> 0.40 %, still in band.
    k:     { fus: 4.15e5, wing: 3.15e6, gear: 1.31e5 },
    c:     { fus: 311,   wing: 1198,  gear: 2416 },
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
    cover: 4.50,      // 0.7 mm 2024-T3 + stringers, frames, rivets, laps
    // AND THE STIFFNESS FOLLOWS THE SKIN, because on a semi-monocoque they are
    // the same thickness: bending stiffness of a skin-stringer box goes as
    // thickness x depth^2 and its mass goes as thickness, so EI is LINEAR in
    // the structural mass. Leaving `k` where it was left the wing carrying four
    // times the skin on the old spring, and GATE LOAD could not have been
    // clearer about it.
    //
    // BUT THE FACTOR IS THE GROUP'S OWN MASS, NOT THE COVERING RATIO, and
    // getting that wrong is what cost this arc its second lap. `cover` moved
    // 4.29x, so I moved all three of `k` by 4.29x. Measured, the mass each
    // group actually gained is fus x1.17, wing x2.10, gear x1.00 — covering is
    // only a part of a wing and none of an undercarriage. So that pass
    // stiffened the fuselage 3.6x too far and the gear 4.3x too far, for a
    // change to the paint-side of the ledger the gear never saw. The strut wing
    // came out at 0.053 % of semispan at 1 g against this file's own stated
    // band of 0.3-1 %, an order of magnitude rigid, and the gate passed it
    // because the gate asserts LINEARITY, not the band in its header.
    //
    // AND `c` SCALES WITH IT, which is the half I missed entirely the first
    // time. zeta = c/(2*sqrt(k*m)): raising k and m while holding c drops the
    // damping ratio, the structure rings, and the rig's 4 s settle stops
    // converging — carbon cantilever read 6.73 % at 1 g and then 3.80 and 3.85
    // at 3.8 and 5.7 g, deflection FALLING as load rose. That is not a wing
    // giving up either; it is a measurement taken while the wing was still
    // moving. Scaling c by the same per-group factor holds zeta and the settle
    // converges again. Every case is linear to 1.5 % afterwards.
    k:     { fus: 9.36e5, wing: 4.62e6, gear: 1.60e5 },
    c:     { fus: 585,   wing: 1888,  gear: 2606 },
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
    cover: 2.40,      // cloth / foam / cloth sandwich, with its resin
    // same reasoning as the alloy row above: the sandwich skin IS the spar cap
    // here, so its stiffness rides with its mass, and `c` rides with both to
    // hold zeta. Measured per-group factors: fus x1.10, wing x1.80, gear x1.04.
    // This row is the one that PROVED the damping half — it was the carbon
    // cantilever that rang, and it rang here rather than on the metal because
    // this row's damping is deliberately the lowest of the four.
    //
    // The carbon STRUT case settles at 0.076 % at 1 g, below the 0.3-1 % band,
    // and that is left standing on purpose: a strut-braced carbon wing is a
    // combination nobody builds, because the point of paying for carbon is the
    // cantilever. It is linear, its cantilever sits at 0.66 % in the middle of
    // the band, and the ratio to the alloy strut is about 4x where the material
    // and the mass together argue for 3x. An outlier configuration, not a bug.
    k:     { fus: 1.21e6, wing: 3.60e6, gear: 1.55e5 },
    c:     { fus: 275,   wing: 900,   gear: 1866 },
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
    // ...AND NONE AT ALL ON A ROD (G189): a bare tube has no fabric to lace
    // a ring into and nothing inside it to inspect — the cables run outside.
    need: R => (R.material === 'carbon' || R.rod) ? 0 : (R.tailHalfW < 0.16 ? 1 : 2),
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
    // ON A ROD (G189) it is clamped to the tube's crown, a third of the way
    // down it — `on` picks the surface per aeroplane, and the rod placer
    // puts a split collar under whatever form the row draws
    on: R => R.rod ? 'rod' : 'body',
    at: R => R.rod ? { sL: R.rod.from + R.rod.len * 0.35, lv: 'crown' }
                   : { sL: R.tailArm * 0.55, lv: 'crown' },
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
    on: R => R.rod ? 'rod' : 'body',          // G189: clamped under the tube
    at: R => R.rod ? { sL: R.rod.from + R.rod.len * 0.18, lv: 'keel' }
                   : { sL: R.cabinAft + (R.tailArm - R.cabinAft) * 0.18,
                       lv: 'keel' },
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
    on: R => R.rod ? 'rod' : 'body',          // G189: clamped on the tube
    at: R => R.rod ? { sL: R.rod.from + R.rod.len * 0.60, lv: 'crown' }
                   : { sL: R.cabinAft + (R.tailArm - R.cabinAft) * 0.60,
                       lv: 'crown' },
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
    // ON A ROD (G189) the ring hangs off a clamp on the tube's underside,
    // forward of the tailwheel's own clamp
    on: R => R.rod ? 'rod' : 'body',
    at: R => R.rod ? { sL: R.rod.from + R.rod.len * 0.80, lv: 'keel' }
                   : { sL: R.tailArm * 0.86, lv: 'keel' },
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
    // the game spec carries no rod flag (a rod boom's fittings are the
    // editor's own bake, through genAccessNeedsCage); this door never has one
    rod:       null,
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
    // G189: on a ROD the taper is carved out of boomLen (the truss wraps the
    // tube's first stretch), so it adds nothing here either
    tailArm:   (P.pilotLen || 1.6) + (P.paxLen || 0) * bays
               + (+P.taperOn && +P.boomStyle !== 1 ? (P.taperLen || 0) : 0)
               + (P.boomLen || 2.2),
    cabinAft:  (P.pilotLen || 1.6) + 0.45,
    // a ROD boom is its own diameter; a lofted tail cone is its half-width
    tailHalfW: (+P.boomStyle === 1) ? (P.rodD || 0.18) * 0.5
                                    : (P.tailHalfW == null ? 0.10 : P.tailHalfW),
    // THE ROD (G189): a bare tube from the aft bulkhead to the tail, and the
    // rows that live on it say so through `on`. `from` is the bulkhead's
    // station in the same tape arithmetic tailArm uses; `len` the tube's run.
    rod: (+P.boomStyle === 1 && !+P.boomTwin)
      ? (() => { const from = (P.pilotLen || 1.6) + (P.paxLen || 0) * bays;
                 return { from, len: Math.max(0.5, (P.boomLen || 2.2)),
                          r: (P.rodD || 0.12) * 0.5 }; })()
      : null,
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
      // G189: a row may pick its SURFACE per aeroplane (the rod boom)
      on:     typeof row.on === 'function' ? (row.on(R) || 'body') : (row.on || 'body'),
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

// ===========================================================================
// THE OUTFIT (G159) — everything a real aeroplane carries that this ledger
// billed at nothing.
// ===========================================================================
// The ledger sums structure from its material and volume, the engine from its
// registry row, the covering per square metre and the payload per occupant.
// Between those, an aeroplane is full of things nobody was charging for:
// seats, the panel board, the cowl, the exhaust, the fuel plumbing, the
// controls, the glazing. Measured on a Cub that is about 35 kg — a tenth of
// the empty weight — and it sat near the published figure only because the
// structure carries more than its name suggests. Two errors cancelling is
// what this project keeps finding; this is one of them, closed.
//
// EVERY ITEM IS TIED TO A CHOICE OR A MEASUREMENT, never to a constant per
// aeroplane. A seat is a seat you picked, times the people who sit in it; the
// panel is the board's own area; the cowl is the cowl's own surface; the
// exhaust follows the power it carries; the plumbing follows the litres. An
// aeroplane that changes shape changes its outfit.
//
// WHAT IS NOT HERE, DECLARED: the instrument fit is GEN_SYSTEMS below and
// stays there (it is the avionics, and it was already billed), and the tank
// or pack itself belongs to the energy module, which prices and weighs the
// vessel — this row is only the plumbing between it and the engine.

// SEATS, per position. A Cub's is a steel tube frame with a sling; a modern
// certified seat is a crushable structure with a 26 g stroke and weighs four
// times as much, which is a real trade and now a visible one.
const GEN_SEATS = {
  sling:    { name: 'Tube and sling',     kg: 3.0,  price: 120 },
  basic:    { name: 'Moulded pan',        kg: 7.0,  price: 400 },
  standard: { name: 'Upholstered',        kg: 11.0, price: 900 },
  energy:   { name: 'Energy-absorbing',   kg: 15.0, price: 2600 },
};

// AREAL DENSITIES for the sheet items, kg/m2 of surface.
//   panel   an alloy instrument board with its mounts and coaming ribs
//   cowl    0.6 mm alloy skin plus its fasteners, baffles and hinges; a
//           fabric-over-frame cowl on a tube aeroplane is lighter
//   glass   3 mm acrylic, which is what a light aeroplane's screen is
const GEN_OUTFIT = {
  panelKgM2: 6.0,
  cowlKgM2:  { tubeFabric: 2.4, wood: 2.4, alloy: 3.2, carbon: 2.0 },
  glassKgM2: 3.6,
  // EXHAUST scales with the power it has to carry away: an A-65's two short
  // stacks are about 3 kg on 48.5 kW, and a collector ring on a big radial is
  // heavier per kW because it is longer as well as fatter.
  exhaustKgKW: 0.062,
  // FUEL PLUMBING: tank fittings, lines, gascolator, selector, primer, and a
  // mechanical pump where the tank is not above the carburettor. Per litre
  // plus a fixed head. An ELECTRIC aeroplane has none of it — the pack's own
  // cabling is the energy module's, not this row's.
  fuelKgL: 0.055, fuelKgFixed: 2.5,
  // CONTROLS: sticks, torque tube, pedals, cables, pulleys, bellcranks and
  // horns. They run the length of the aeroplane and out to the tips, so the
  // driver is the reach — semi-span plus tail arm — and dual controls cost a
  // second stick and a second set of pedals.
  ctlKgM: 0.62, ctlDualKg: 3.4,
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
//
// G158 — THE fm COLUMN IS A STATIC FIGURE OF MERIT AND MUST READ AS ONE. The
// old 0.58 / 0.46 / 0.36 was back-fitted out of the registry's Tstatic values,
// which were themselves fitted through the 42 %-efficiency propV0K above (see
// it for the whole story), so the column had drifted below the physical band:
// a real fixed-pitch propeller sits at roughly 0.40-0.55 statically, and 0.36
// is a propeller that does not exist. The three rows are now inside that band
// and keep their order and their meaning.
//
// STANDARD IS THE ANCHOR at 0.477, because that is what makes the synthesis
// reproduce the A-65 + Sensenich 74 row exactly (1202 N on a 1.88 m disc
// absorbing 48.5 kW) — registry and generator still agree by construction,
// which is the whole reason this table is fitted rather than invented.
//
// THE TRADE IS UNCHANGED IN KIND and is now measurable: at the A-65, fine
// pitch out-pulls coarse below ~42 m/s and coarse wins above ~48 m/s
// (1335 N vs 1058 N standing; 670 N vs 727 N at 50 m/s). It rides entirely in
// V0, which falls as Tstatic rises — so a fine prop's thrust still runs out
// earlier without being told to.
// THE SYNTHESIS, AS A FUNCTION. It was inline in resolveSpec until G159, and
// it has to be callable twice now: once there, and again from buildGen when the
// pitch was left on 'auto' and the wing has since been measured. One
// implementation, so the automatic answer and the manual one cannot drift.
// `pr` carries D, blades, material and powerW; everything else is derived.
function genPropSynth(pr, pitchKey) {
  const PI = GEN_PROP_PITCH[pitchKey] || GEN_PROP_PITCH.standard;
  const MT = GEN_PROP_MATS[pr.material] || GEN_PROP_MATS.wood;
  const P = pr.powerW || 48500;
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
  // the speed this propeller is at its best at: T*V peaks at V0/sqrt(3).
  pr.VPeak = pr.V0 / Math.sqrt(3);
  pr.pitchUsed = GEN_PROP_PITCH[pitchKey] ? pitchKey : 'standard';
  // blade mass, at the very front of the aeroplane
  pr.mass = pr.blades * MT.kg * Math.pow(pr.D / 1.88, 2.5);
  pr.price = Math.round(MT.price * pr.blades / 2 * Math.pow(pr.D / 1.88, 2));
  pr.name = `${pr.blades}-blade ${MT.name.toLowerCase()} ${pr.D.toFixed(2)} m`;
  return pr;
}

// WHICH PITCH THIS AEROPLANE WANTS, given the stall speed its wing actually
// measured.
//
// THE OBVIOUS CRITERION IS A TRAP, and it was measured before it was rejected:
// "pick the pitch that makes the most thrust at cruise" chooses the FINEST one
// for every aeroplane in this game. That is not a bug in the search, it is an
// honest reading of a model with NO PROPELLER RPM in it. On the A-65 a fine
// prop out-pulls a coarse one at every speed below 46 m/s, and almost nothing
// here cruises faster than that. What makes a coarse prop right for a fast
// aeroplane in the real world is the limit we do not model: a fine prop lets
// the engine overspeed, so the pilot throttles back and never sees rated power.
//
// SO THE RULE STANDS IN FOR THAT LIMIT, with the one quantity the model does
// carry: V0, the speed at which this propeller's thrust runs out. A propeller
// whose thrust has collapsed by the time the aeroplane reaches its cruise is
// over-fine, and that is exactly the symptom the missing rpm limit produces.
// Take the FINEST pitch that still has real thrust in hand at cruise --
//
//     T(V)/Tstatic = 1 - (V/V0)^2  >=  GEN_PROP_AUTO_MARGIN
//
// -- and if none qualifies, the coarsest, which is the honest answer for an
// aeroplane too fast for any of them.
//
// THE CRUISE ESTIMATE IS DELIBERATELY CRUDE and is allowed to be: this picks
// between three coarse buckets, not a speed. 1.75 x Vs is the fleet's own
// VCruise/Vs, which 62_gen_aero records as scattering 1.69-2.68 -- far too
// loose to COMMAND a cruise with (which is why that file solves the real one
// off the power curve) and far tighter than the spread between pitch classes.
// The real cruise cannot be used here: solving it needs the propeller this
// function is choosing.
const GEN_PROP_AUTO_VR = 1.75;
const GEN_PROP_AUTO_MARGIN = 0.60;
// finest first, so the first that qualifies is the finest that qualifies
const GEN_PROP_AUTO_ORDER = ['climb', 'standard', 'cruise'];
function genPropAuto(pr, Vs) {
  const V = GEN_PROP_AUTO_VR * Vs;
  let pick = GEN_PROP_AUTO_ORDER[GEN_PROP_AUTO_ORDER.length - 1];
  for (const k of GEN_PROP_AUTO_ORDER) {
    const t = genPropSynth({ D: pr.D, blades: pr.blades, material: pr.material,
                             powerW: pr.powerW }, k);
    if (1 - (V / t.V0) * (V / t.V0) >= GEN_PROP_AUTO_MARGIN) { pick = k; break; }
  }
  genPropSynth(pr, pick);
  pr.pitchAuto = pick;
  pr.pitchAutoV = V;
  return pick;
}

const GEN_PROP_PITCH = {
  climb:    { name: 'Fine (climb)',    fm: 0.530, pd: 0.55 },
  standard: { name: 'Standard',        fm: 0.477, pd: 0.70 },
  cruise:   { name: 'Coarse (cruise)', fm: 0.420, pd: 0.85 },
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
  // `kgM2` is the COLOUR COATS ONLY, and the distinction matters. The covering
  // system itself -- fabric and its dope, or the alloy skin -- is already
  // billed per square metre by GEN_MATERIALS.cover, which is why a doped Cub
  // already carries 21 kg of covering over 51 m2 before anything is painted.
  // What was missing was the finish on top of it: three or four butyrate
  // colour coats are 0.10-0.15 kg/m2, and primer alone is a tenth of that.
  // Six kilos on a Cub -- small, real, and it was zero.
  full: { name: 'Painted',       price: GEN_PRICES.paintJob, sweep: 1,
          kgM2: 0.12 },
  bare: { name: 'Bare / primer', price: 0,                   sweep: 0,
          kgM2: 0.03 },
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
  // THE ENGINE BEARER (G179, 2026-09-04, the user's wing-mounted twin: "the
  // engines will move A LOT on their mounts during flight, the whole plane
  // shakes ... there is still something deforming the wing when not moving").
  // Measured on that build, parked: each engine hung 300 mm below its mount
  // and rang at 2.5 Hz, because a wing nacelle was ONE node braced to the
  // four spar nodes of its bay — all four in one plane, the node a hand's
  // width above it: rule 1's mechanism, and its stiffness was whatever the
  // drawn station happened to give (the derived default sat 0.17 m below the
  // spar line and read 17 mm; the join's measured station 0.07 m above it
  // read 300). Two rules, both for EVERY mount:
  //   mountK    an engine bearer is a short WELDED truss, and its members are
  //             E*A/L stiff where the fuselage row is a calibrated bending
  //             stand-in (see wingK for the same accounting on the wing).
  //             The bearer's measured value is 10x the ORIGINAL steel fus
  //             row (2.0e5): with that row x4 in G179.2, mountK is 2.5 and
  //             the bearer is byte-identical. c takes the root, so the
  //             mount's damping ratio is what it was.
  //   mountFoot a wing nacelle gets a BEARER FOOT: a second node a box depth
  //             through the spar plane (below a wing the engine sits on, above
  //             one it hangs under), tied to the same spar nodes and to the
  //             engine by a post — the depth a real bearer has, so the mount's
  //             stiffness no longer depends on where the engine was drawn.
  // GATE MOUNT holds both, on every mount kind, with a negative control.
  mountK:      2.5,
  mountFoot:   true,
  // ...and WHERE the foot goes, as a fraction of the way from the engine to
  // the front spar: 1 = under the front spar. Measured on the twin (engines
  // 0.65 m ahead of the spar), foot at 0 / 0.5 / 0.75 / 1 / 1.25 / 1.5:
  // 13.3 / 8.2 / 6.7 / 6.7 / 9.3 / 15.0 mm. Under the engine every leg back
  // to the spar is shallow; past the spar the post is. The spar is the
  // stiff point of the wing, and the foot stands on it.
  mountFootAt: 1.0,
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
  // Zero-thrust speed as a multiple of power/static-thrust. See GEN_PROP_PITCH
  // for why this is one constant and not a table.
  //
  // G158 — THIS CONSTANT IS THE PROPELLER'S PEAK EFFICIENCY, and until now it
  // was 42 %. The law is `T = Tstatic - kV2 V^2` with `V0 = propV0K P /
  // Tstatic`, so `Tstatic * V0 = propV0K * P` is a CONSTANT: thrust power
  // `T*V` peaks at `V = V0/sqrt(3)` with
  //
  //     P_prop_max = Tstatic * V0 * 2/(3 sqrt 3) = 0.3849 * propV0K * P
  //
  // At 1.10 that is 42.3 % of shaft power — for every generated aeroplane,
  // whatever its engine, diameter, blade count, material or pitch. A finer
  // prop raises Tstatic and lowers V0 by exactly as much: the pitch trade is
  // real INSIDE the budget, and the budget never moved. A real fixed-pitch
  // wooden propeller peaks near 75 %, so five eighths of every engine in the
  // garage was being thrown away in this one line.
  //
  // 1.10 came from fitting the A-65 + Sensenich 74CK row, which at 42.0 % is
  // the WORST row in POWERPLANTS — the hand-fitted rows the fleet actually
  // flies on sit at 52-86 % (io360 85 %, o200 86 %, r1830 67 %). So the
  // constant reproduced the single outlier and then handed it to the whole
  // garage.
  //
  // WHY IT SURVIVED: the A-65 row's own Tstatic had been fitted so the J-3
  // fiche would reproduce the published 433 fpm — but that fiche billed
  // 265 kg for an airframe whose real empty weight is 345 kg, and 450 fpm is
  // a GROSS-weight figure. A 23 %-light aeroplane on a 40 %-weak propeller
  // reproduces the book, and neither error is visible at that one point. Flown
  // at the real 550 kg the same fiche climbed 0.78 m/s against a published
  // 2.29. See futureDesigns/PROP-THRUST-2026-09-02.md; the airframe mass is
  // fixed in the same chantier, because the two errors cancel and only move
  // together.
  //
  // 1.95 IS TWO INDEPENDENT ANCHORS AGREEING. Peak efficiency 0.3849 x 1.95 =
  // 75.1 %, which is what a real fixed-pitch propeller reaches; and it is what
  // makes the J-3's own geometry climb the published 450 fpm at the published
  // 550 kg on a static thrust (1202 N) that is inside the published 250-280
  // lbf band for an A-65 on a Sensenich 74. Neither number was fitted to the
  // other.
  propV0K:     1.95,
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
// v7 -> v8 (G189): on a ROD boom the taper section stopped ADDING its length
// and now lives inside boomLen, so a saved rod build keeps its tube by
// carrying taperLen over into boomLen — GEN_MIGRATORS[7]. The two cage
// defaults it needs are pinned in GEN_MIGRATE_CAGE_DEFAULTS and asserted
// against cageDefaults() by GATE PARTS, because the core cannot read the
// cage's own table.
const GEN_SPEC_V = 8;
const GEN_MIGRATE_CAGE_DEFAULTS = { boomLen: 3.983966, taperLen: 0.6 };

// { fromVersion: spec => spec } — each entry lifts a spec one version. May
// mutate and return its argument. Runs BEFORE normalisation, on the raw shape
// the old game actually saved.
// THE LIFT FROM A CAPACITY TO A VESSEL, and it is not only a migration.
// `fuel.litres` became a READING of the vessel list at G99 — but it is still
// what people WRITE: every archetype in _cage_design.js says
// `spec: { fuel: { litres: 90 } }`, GATE ENERGYBASE's cases vary it, and a
// spec pasted out of a console says it too. A derived field that silently
// ignores what it is set to is the worst kind, so a capacity written with no
// vessel list SEEDS one. An explicit `energy.vessels` always wins.
//
// GATE ENERGYBASE caught this the moment the list landed: three of its cases
// stopped differing from each other, because "panel tank", "dry" and "brimmed"
// were all writing to a field that had stopped listening.
function genEnergyLift(S) {
  const f = S.fuel || {};
  const E = S.energy || (S.energy = {});
  if (!Array.isArray(E.vessels)) {
    const tank = f.tank || 'nose';
    const bay = tank === 'wing' ? 'wingRoot'
              : tank === 'panel' ? 'wingPanel' : 'nose';
    E.vessels = [{
      bay,
      capacity: (E.kind === 'battery') ? (E.kWh || 0) : (f.litres || 0),
      // THE OLD THREE STATIONS WERE NODES, NOT PLACES: `nose` billed onto the
      // firewall ring's TOP pair and the wing stations onto a spar node. The
      // lift gives the vessel the station those nodes are AT — explicitly, in
      // the spec, where it can be read — rather than a bay midpoint that would
      // look reasonable and quietly move a Cub's twelve gallons half a metre
      // aft. That is what GATE ENERGYBASE exists to prove and it does.
      along: bay === 'nose' ? 0 : null,
      lv: bay === 'nose' ? 1 : null,
      rot: 0,
    }];
  }
  return S;
}

const GEN_MIGRATORS = {
  // 6 -> 7, THE ENERGY MODULE'S OWN BUMP (G99), reserved for it since G97 and
  // finally earned: `spec.fuel = {litres, tank}` becomes a LIST of vessels in
  // declared bays, so capacity belongs to the thing that has a size.
  //
  // KEYED BY THE SOURCE VERSION, which is the walk's own convention and cost
  // one wrong number to learn: `genMigrateSpec` runs `MIGRATORS[i]` for i from
  // the spec's v up to GEN_SPEC_V, so the lift OUT OF 6 lives under 6 — as the
  // wing's v5 -> v6 lift lives under 5. Filed as 7, this ran on nothing at
  // all and every old save quietly kept the defaults instead of its tank.
  //
  // AND IT MUST MOVE NOTHING, which is what GATE ENERGYBASE exists to prove.
  // The old three stations were nodes, not places: `nose` billed onto the
  // firewall ring's TOP pair, `wing` and `panel` onto a wing spar node. So the
  // migrated vessel is given the station those nodes are AT — explicitly, in
  // the spec, where it can be read — rather than a bay midpoint that would
  // look reasonable and quietly move a Cub's twelve gallons half a metre aft.
  6: S => genEnergyLift(S),
  // 7 -> 8 (G189): the rod boom's taper is carved out of boomLen now (the
  // truss wraps the tube's first stretch instead of pushing the tail aft),
  // so a save that had both keeps the tube it was drawn with: taperLen
  // rides into boomLen. Absent keys are the cage defaults (pinned above);
  // a lofted taper still adds its length and is left alone; twin booms
  // never had a rod taper. Only the CAGE moves — the spec's own tailArm is
  // re-measured by the join off the drawn tube, which is now the same tube.
  7: r => {
    const c = r && r.cage;
    if (!c || typeof c !== 'object') return r;
    if (+c.boomStyle === 1 && !+c.boomTwin && +c.taperOn) {
      const D = GEN_MIGRATE_CAGE_DEFAULTS;
      const bl = c.boomLen == null ? D.boomLen : +c.boomLen;
      const tl = c.taperLen == null ? D.taperLen : +c.taperLen;
      if (isFinite(bl) && isFinite(tl)) c.boomLen = +Math.min(6.0, bl + tl).toFixed(4);
    }
    return r;
  },};

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
    // THE GLAZING (2026-09-04, the user: "we need to be able to deactivate
    // the glazing too"): 'glass' bills the windscreen and the side windows
    // as always; 'none' is an open cockpit — no glass mass. The cage's
    // `glazeOn` row is the one writer (tools/_cage_join.js).
    glazing: 'glass',
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
    // WHERE THE OCCUPANTS ARE BILLED, metres aft of the firewall, one station
    // per seat in seat order (pilot first). MEASURED by the join off the crew
    // layer's own seats (2026-09-03); null = derived = the frame's cabin
    // pillar rings, which is what a hand-written fiche and every save from
    // before this field still mean. It is a list rather than a pitch because
    // side-by-side and tandem place their rows differently and the layer
    // already knows.
    seatsX: null,
    // HOW MANY SEATS THERE ARE, and WHO IS IN THEM (G180, 2026-09-04, the
    // user: "every passenger bay should be able to hold as many seats as the
    // cabin ... for each section, we can decide whether passengers are
    // seated"). `seats` is the CAPACITY the cage actually drew — a row as
    // wide as the cockpit's in the cockpit and in every passenger bay — and
    // null means the seating table's own count, which is what a fiche and
    // every older save mean. `occupied` is one 0/1 per seat in seat order
    // (pilot first, then the cockpit's other seat, then the bays front to
    // back), so a full back bench behind an empty co-pilot seat is sayable
    // and bills where it sits; null means "the first pilots + pax seats",
    // the old rule, which is why no existing aeroplane's balance moves.
    seats: null, occupied: null,
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
  // WHAT THE ENERGY IS AND WHAT HOLDS IT (G98). `fuel.litres` above stays the
  // liquid capacity and `fuel.tank` the station, so nothing saved before this
  // moves; this section says what KIND of energy it is, which fuel or which
  // cells, and which vessel holds them. A pack's capacity is in kWh because
  // litres is not how a battery is sold.
  //
  // NO SPEC VERSION BUMP, deliberately. genDefaults fills an absent section
  // with exactly these values, which is what an old file meant, so there is
  // nothing for a migrator to branch on — the same reasoning `finish: null`
  // was added under at G105. G99 restructures this into a vessel LIST when
  // placement needs one, and that is the change that earns the bump.
  energy: { kind: 'fuel', fuel: 'avgas100LL', cell: 'lifepo4',
            kWh: 0, vessel: null,
            // THE LOOK, added 2026-09-04 with the drawn vessels and weighing
            // nothing: `finish` is one of the scanned surfaces (null = as the
            // vessel is made), `hue` turns the painted sheet's own colour and
            // `tint` multiplies whichever sheet is on. No version bump, for
            // the same reason `finish: null` needed none: absent already
            // means exactly what these values say.
            finish: null, hue: 0, tint: null,
            // G99 — THE VESSELS, AND THE CAPACITY IS THEIRS. A vessel is a
            // real solid dropped into a declared bay and nudged until it
            // fits, so it is the thing that has a size: `fuel.litres` and
            // `energy.kWh` are now DERIVED as the sum of the list, and
            // `S.fuelL` with them. That is the shape G97 found by measurement
            // — "spec.fuel.litres is not what the mass model reads, 61_gen_frame
            // reads S.fuelL, derived during resolveSpec" — and it is why the
            // access fittings keep their fuel cap and drain with no edit.
            //   bay       a GEN_BAYS key
            //   capacity  litres, or kWh for a pack
            //   along     metres aft of the firewall (body bays), or a span
            //             fraction (wing bays); null = the bay's own default
            //   lv        height in the section, 0 keel to 1 crown; null = the
            //             middle of the bay's own band
            //   rot       degrees about the vertical. Declared here and drawn
            //             in G99b; the fit test already respects it.
            //   finish    this tank's own surface, hue and tint (2026-09-05);
            //   hue       null = the section's, above. A look, never a weight.
            //   tint
            // NULL, AND THAT IS THE WHOLE MECHANISM. A default LIST here
            // would make `fuel.litres` unwritable: every archetype, every gate
            // case and every hand-written spec merges over this object, so
            // they would all inherit a 50-litre nose tank and their own
            // capacity would be silently ignored. That is exactly what GATE
            // ENERGYBASE reported when the list first landed — "panel tank",
            // "dry" and "brimmed" became the same aeroplane. Absent,
            // `clampSpec` builds the list from whatever capacity the spec DOES
            // name, and an explicit list always wins over it.
            vessels: null },
  systems: { fit: 'basic' },
  // WHAT YOU SIT IN (G159). A choice, like the instrument fit beside it, and
  // it weighs: four kilos a seat between a Cub's sling and a certified
  // energy-absorbing one, times however many people are aboard.
  outfit: { seats: 'sling' },
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
          // THE COVERING IS A CHOICE (2026-09-04, the user: "remove all fuselage
          // and interior skin, naked structure"). 'skin' = every fuselage bay
          // covered in the material above, as always; 'open' = a bare truss
          // with its occupants in the wind — no covering mass on the fuselage
          // bays and an open-frame drag delta (genFusCdA). The cage's `skinOn`
          // row is the one writer (tools/_cage_join.js); the wing and the tail
          // keep their own covering either way.
          covering: 'skin',
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
  // THE MOUNT (2026-09-04): 'nose' (the firewall pair, as always), 'pusher'
  // (the back of the aft bulkhead — a pod-and-boom), 'wingTop' (one engine on
  // a pylon over the centre section, high wing, pushing) or 'wing' (a PAIR of
  // tractor nacelles, one entry per side). x/y/z are the mount station in the
  // frame's own metres (x aft of the firewall, y over the cabin keel, z the
  // nacelle's half-span); null = each mount's own derivation; the join writes
  // them off the drawn engine. `pylon` is the over-the-wing pylon's height.
  // `sense` (G194): which way the propeller turns, seen from behind — +1
  // clockwise (the Lycoming / Continental hand), -1 anticlockwise. Absent
  // means +1, which is what every spec before this field meant, so
  // GEN_SPEC_V does not move for it. The one field a wing pair's two entries
  // may DISAGREE on (counter-rotation); the solver reads nothing from it yet
  // (futureDesigns/PROP-EFFECTS-2026-09-05.md is the assessment), the drawn
  // propellers turn by it.
  engines: [{ type: 'a65_sensenich74', mount: 'nose', place: { dx: 0, dy: 0 },
              x: null, y: null, z: null, pylon: null, sense: 1 }],
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
  // PITCH: 'standard' since G158, and it is the registry's keeper as much as a
  // default. GATE GEN requires the SYNTHESIS to reproduce the powerplant row
  // this build flies on to 2 % in both Tstatic and kV2 — so whatever pitch the
  // default carries IS the pitch the A-65 + Sensenich 74CK row states. It was
  // 'cruise' because the old fm table put that row at a figure of merit of
  // 0.36; the real 74CK-42 is a 0.57 pitch-to-diameter propeller, which is not
  // a coarse one, and a generic homebuilt does not leave the shed on a cruise
  // prop either. See GEN_PROP_PITCH.
  prop: { D: null, blades: 2, material: 'wood', pitch: 'standard',
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
            // EXTRA LOFT STATIONS (G189): spanwise metres from the centreline
            // where the covering must have a row — the lamp bay's two edges,
            // so a narrow bay is cut on its own geometry. Null = none.
            // Display topology only: spars, ribs and node weights ignore it.
            cuts: null,
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
          place: { dx: 0 },
          // twin booms (2026-09-04): the type says two fins on two booms at
          // ±boomX; the FRAME still builds the centreline tail (its post, one
          // FIN node) — cut 1's stated approximation, the two fins' area on
          // the one node, the booms' drag not yet priced
          boomX: null, boomLen: null, boomR: null },
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
  // NO LIFT HERE, and that is deliberate. A current spec with a capacity and no
  // vessel list is left exactly as it was written: `energy.vessels` is a
  // DERIVED null, and this file's own rule is that a derived null has to
  // survive a save and a load — "freeze the derived number into the save and
  // it stops following whatever it was derived from". `clampSpec` builds the
  // list at RESOLVE time, which is derivation and the right place for it.
  // GATE BUILD caught the first cut doing it here: the stock spec came back
  // from a round trip carrying a vessel list it never had.
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
  if (!['skin', 'open'].includes(fu.covering)) fu.covering = 'skin';
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
  // the measured seat stations: a list of finite metres aft of the firewall,
  // or null. Anything else is a malformed file and reads as "derived".
  cb.seatsX = Array.isArray(cb.seatsX) && cb.seatsX.length &&
              cb.seatsX.every(x => typeof x === 'number' && isFinite(x))
    ? cb.seatsX.map(x => genClamp(x, 0.05, 12)) : null;
  // G180: the drawn capacity — a whole number of seats, or null = the table's;
  // and the occupancy — a list of 0/1 per seat, or null = the first N. A
  // malformed list reads as "derived", never as a crash or a jump, the same
  // ruling seatsX has.
  cb.seats = (typeof cb.seats === 'number' && isFinite(cb.seats))
    ? Math.round(genClamp(cb.seats, 0, 24)) : null;
  cb.occupied = Array.isArray(cb.occupied) && cb.occupied.length &&
                cb.occupied.every(o => o === 0 || o === 1 || o === true || o === false)
    ? cb.occupied.map(o => o ? 1 : 0) : null;

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
    e.sense = (+e.sense === -1) ? -1 : 1;             // G194: +1 or -1, never else
    if (typeof POWERPLANTS !== 'undefined' && !POWERPLANTS[e.type])
      e.type = 'a65_sensenich74';
    if (!['nose', 'pusher', 'wingTop', 'wing'].includes(e.mount)) e.mount = 'nose';
    e.place.dx = genClamp(e.place.dx, -0.60, 0.45);
    e.place.dy = genClamp(e.place.dy, -0.30, 0.40);
    // the mount station (2026-09-04): an envelope, null kept for derivation
    e.x = genClampN(e.x, -1.0, 8.0);
    e.y = genClampN(e.y, -1.0, 2.5);
    e.z = genClampN(e.z, 0, 6.0);
    e.pylon = genClampN(e.pylon, 0.05, 1.0);
    // which way a WING engine faces (2026-09-04): null = the mount's own
    // (over the wing pushes, a pair pulls)
    if (!['puller', 'pusher'].includes(e.aim)) e.aim = null;
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
  if (!S.outfit || typeof S.outfit !== 'object') S.outfit = { seats: 'sling' };
  if (!GEN_SEATS[S.outfit.seats]) S.outfit.seats = 'sling';
  {
    const E = S.energy || (S.energy = {});
    if (E.kind !== 'battery') E.kind = 'fuel';
    if (!GEN_FUELS[E.fuel]) E.fuel = 'avgas100LL';
    if (!GEN_CELLS[E.cell]) E.cell = 'lifepo4';
    E.kWh = genClamp(E.kWh || 0, 0, 400);
    // a vessel that cannot hold this kind is not a vessel for this aeroplane
    const want = E.kind === 'battery' ? 'battery' : 'fuel';
    if (E.vessel != null &&
        !(GEN_VESSELS[E.vessel] && GEN_VESSELS[E.vessel].holds === want))
      E.vessel = null;
    // THE LOOK, and it is only a look: `finish` names one of the scanned
    // surfaces the editor draws a shell with, `hue` turns the painted one's
    // own colour, `tint` multiplies whichever it is. Nothing here is read by
    // the ledger — the vessel row above is what weighs and prices a tank —
    // so there is no version bump and an absent value means "as the vessel
    // itself is made", which is what every file written before this meant.
    if (E.finish != null &&
        !['paint', 'alu', 'plastic', 'rubber'].includes(E.finish)) E.finish = null;
    E.hue = genClamp(E.hue || 0, 0, 359);
    if (E.tint != null && !/^#[0-9a-fA-F]{6}$/.test(String(E.tint))) E.tint = null;
    // THE VESSELS ARE THE CAPACITY (G99). Each one is clamped on its own, and
    // the section's total is their sum — so `fuel.litres` and `energy.kWh`
    // stop being settable facts and become readings, which is what stops a
    // build saying 50 litres while carrying two 40-litre tanks.
    // NO LIST? BUILD ONE FROM THE CAPACITY THE SPEC NAMES. genEnergyLift is
    // that rule, shared with the v6 migrator, so a lifted save and a
    // hand-written spec land on the same aeroplane.
    if (!Array.isArray(E.vessels) || !E.vessels.length) genEnergyLift(S);
    let total = 0;
    for (const v of E.vessels) {
      if (!GEN_BAYS[v.bay]) v.bay = 'nose';
      v.capacity = genClamp(v.capacity || 0, 0,
                            E.kind === 'battery' ? 400 : 400);
      v.along = v.along == null ? null : genClamp(v.along, -1, 12);
      v.lv = v.lv == null ? null : genClamp(v.lv, 0, 1);
      v.rot = genClamp(v.rot || 0, -90, 90);
      // ROUND OR SQUARED (2026-09-04). Geometry, and therefore capacity: a
      // cylinder in the same box holds 0.78 of what the squared shell does,
      // which _vessel_gen.js applies as the drawn box's fill. Absent means
      // 'box', so every spec written before this one is unchanged.
      v.form = v.form === 'cyl' ? 'cyl' : 'box';
      // THE LOOK IS THE TANK'S OWN (2026-09-05, the user: "per tank colour
      // please"). The same three fields as the section's above, one level
      // down, and ABSENT MEANS THE SECTION'S ANSWER — which is what every
      // spec written before this one says, so there is no migration and no
      // version bump, exactly as the section-wide rows needed none at G105.
      // Nothing here weighs: GEN_VESSELS is still what prices and weighs a
      // tank, and it knows nothing about colour.
      if (v.finish != null &&
          !['paint', 'alu', 'plastic', 'rubber'].includes(v.finish))
        v.finish = null;
      v.hue = v.hue == null ? null : genClamp(v.hue, 0, 359);
      if (v.tint != null && !/^#[0-9a-fA-F]{6}$/.test(String(v.tint)))
        v.tint = null;
      total += v.capacity;
    }
    if (E.kind === 'battery') { E.kWh = total; S.fuel.litres = 0; }
    else { S.fuel.litres = genClamp(total, 0, 400); E.kWh = 0; }
    // `fuel.tank` is the pre-G99 station and is kept as a READING of the first
    // vessel's bay, because GEN_ACCESS decides where the filler cap goes from
    // it and a cap that moved would be a fitting nobody asked to move.
    const b0 = E.vessels[0] && E.vessels[0].bay;
    S.fuel.tank = b0 === 'wingRoot' ? 'wing'
                : b0 === 'wingPanel' ? 'panel' : 'nose';
  }
  cb.baggage = genClamp(cb.baggage, 0, 60);
  if (!['glass', 'none'].includes(cb.glazing)) cb.glazing = 'glass';
  const w = S.wings[0];
  // 2026-09-04: the envelope opened for the SAILPLANE class (the user: "you
  // should be able to enable the motor glider") — 0.80 m chord and 18 m span,
  // aspect ratio to 20. Every build inside the old 1.15-2.10 / 6.5-14 box is
  // untouched; GATE GEN's wild spec still clamps, and the sail archetype's
  // circuit is the new corner's flight test.
  w.chord = genClamp(w.chord, 0.80, 2.10);
  w.span = genClamp(w.span, Math.max(6.5, 4.0 * w.chord),
                            Math.min(18.0, 20.0 * w.chord));
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
  if (!['conventional', 'v', 'twinBoom'].includes(S.tail.type)) S.tail.type = 'conventional';
  S.tail.boomX = genClampN(S.tail.boomX, 0.3, 4.0);
  S.tail.boomLen = genClampN(S.tail.boomLen, 0.5, 8.0);
  S.tail.boomR = genClampN(S.tail.boomR, 0.03, 0.30);
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
    // G189: loft cuts are finite stations strictly inside the semispan,
    // sorted, at most four; anything else is no cut at all
    if (w.cuts != null) {
      const semi = 0.5 * w.span;
      const cs = (Array.isArray(w.cuts) ? w.cuts : [])
        .map(Number).filter(z => isFinite(z) && z > 0.05 && z < semi - 0.05)
        .sort((a, b) => a - b).slice(0, 4);
      w.cuts = cs.length ? cs : null;
    }
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
  // 2026-09-04: THE MOUNTS ARE REAL for one shape — a wing PAIR. 'wing' is
  // exactly two entries (the second is the first's mirror: same type, same
  // station, the other side), every other mount stays one. A lone 'wing'
  // entry is doubled rather than flown as one nacelle on one side.
  if (Array.isArray(S.engines) && S.engines.length) {
    const pair = S.engines[0].mount === 'wing';
    S.engines = S.engines.slice(0, pair ? 2 : 1);
    if (pair && S.engines.length === 1) S.engines.push(genClone(S.engines[0]));
    for (let i = 1; i < S.engines.length; i++) {
      const e = S.engines[i], e0 = S.engines[0];
      // ...and its own HAND (G194): `sense` is the one field the pair may
      // disagree on — counter-rotation is the whole point of it. `aim` is
      // a pair property and follows the first entry like the rest.
      e.mount = e0.mount; e.type = e0.type;
      e.x = e0.x; e.y = e0.y; e.z = e0.z; e.pylon = e0.pylon;
      if (e0.custom) e.custom = genClone(e0.custom); else delete e.custom;
    }
  }
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
  // 'auto' is a legal pitch and is NOT a class: it means "choose one for me",
  // and buildGen does the choosing once the wing has been measured. See
  // genPropSynth / genPropAuto below.
  if (S.prop.pitch !== 'auto' && !GEN_PROP_PITCH[S.prop.pitch])
    S.prop.pitch = 'standard';
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
  // THE CAPACITY IS WHAT WAS DRAWN (G180): the join writes `cabin.seats` off
  // the crew layer's own chairs — a row as wide as the cockpit's per section —
  // and the seating table's count is the fallback for a fiche and every save
  // from before the field. A drone has none either way.
  S.seats = (S.cab.seats != null && seat.crew > 0) ? Math.max(1, S.cab.seats) : seat.crew;
  // A DRONE HAS NO CREW (2026-09-05). G180's clamp read `never fewer than one
  // pilot` and put a pilot in a drone: `seats` is 0 there, and the seating
  // table's crew 0 is the rule — GATE GEN's drone case asserts it. Every
  // crewed seating keeps the G180 floor of one.
  S.crew = S.seats > 0 ? genClamp(S.pilots | 0, 1, S.seats) : 0;
  // WHO ELSE IS ABOARD. `pilots` has always been LOADING rather than capacity
  // (its own comment in GEN_DEFAULT says so); `pax` is the same idea for the
  // seats the flight crew are not in, so the two together are the occupants
  // and `seats` stays the capacity. Clamped to what is left, so a spec cannot
  // load five people into four seats — and 0 by default, which is why no
  // existing aeroplane's mass moves.
  S.pax = genClamp(S.cab.pax | 0, 0, Math.max(0, S.seats - S.crew));
  S.occupants = S.crew + S.pax;
  // ...AND WHICH SEATS (G180). `cabin.occupied` names the filled chairs one by
  // one; the pilot's is always filled (crew is never 0), the list is cut or
  // padded to the capacity, and the loading numbers are READ OFF IT so the
  // plaque, the price and the frame cannot disagree about who is aboard.
  // Null keeps the old rule — the first `occupants` seats in seat order.
  S.occupied = null;
  if (Array.isArray(S.cab.occupied) && S.seats > 0) {
    const occ = [];
    for (let i = 0; i < S.seats; i++) occ.push(i === 0 ? 1 : (S.cab.occupied[i] ? 1 : 0));
    S.occupied = occ;
    S.occupants = occ.reduce((a, b) => a + b, 0);
    S.crew = genClamp(S.pilots | 0, 1, S.occupants);
    S.pax = S.occupants - S.crew;
  }

  // 2. wing longitudinal placement — the front spar lands on the cabin-front
  //    frame, which is what puts a high-wing carry-through over the cabin
  const w = S.wing, pl = S.place;
  put(w, 'xLE', S.cab.noseGap - GEN_RULES.sparFront * w.chord, 'wing.xLE');
  // the nudge lands BEFORE the tail arm is worked out, so pulling the wing back
  // takes the empennage with it and the aeroplane stays a coherent shape. Move
  // the tail relative to that with place.tailDx.
  w.xLE += pl.wingDx;
  // THE WING FOLLOWS THE ENGINE (2026-09-04, the mounts). The station above
  // sizes the wing to the CABIN, which is where every nose-engined aeroplane
  // balances; an engine moved to the aft bulkhead (a pusher) or over the wing
  // drags the CG aft by its own lever and, measured, took the default build's
  // static margin from +0.19 to -0.11 — a hard landing in GATE GEN. So a
  // DERIVED station moves aft by that lever, estimated off the registry's
  // masses (engine × its shift over the material's reference mass, the extra
  // engine of a pair counted): a pusher's wing sits ~0.45 m further back, an
  // over-the-wing engine's ~0.3. A MEASURED station (the join's, off a drawn
  // wing) is the builder's and does not move — the plaque tells the margin.
  if (auto['wing.xLE'] && S.engines[0].mount && S.engines[0].mount !== 'nose') {
    const e = S.engines[0], m = e.mount;
    const PP0 = POWERPLANTS[S.engine] || POWERPLANTS.a65_sensenich74;
    const mE = (e.custom && e.custom.mass) || PP0.engine.mass;
    const engX0 = -(0.18 + 0.32 * PP0.prop.D / 2);
    const xE = e.x != null ? e.x
             : m === 'pusher' ? S.cab.noseGap + S.cab.len + S.fuse.cargoLen + 0.30
             : m === 'wingTop' ? w.xLE + 0.30 * w.chord : w.xLE + 0.05;
    const n = m === 'wing' ? 2 : 1;
    const mRef = ((GEN_MATERIALS[S.material] || {}).refMass || 390) + (n - 1) * mE;
    w.xLE += n * mE * (xE - engX0) / mRef;
  }
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
  // twin booms: a MEASURED fin is one of two, so the vertical area is twice it
  if (t.type === 'twinBoom' && t.Sv == null && t.vHeight != null && t.vChord != null)
    t.Sv = 2 * t.vHeight * t.vChord;
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
    // A BUILT V-TAIL IS THE TAIL (2026-09-04, the G54.3 rule): when the join
    // measured the panels (hSpan = their horizontal projection, hChord their
    // chord), the panel span is that projection un-canted and the area is
    // what those panels have — the shakedown posts the stability that
    // results. Left null, the volume-coefficient sizing below stands.
    const built = t.hSpan != null && !auto['tail.hSpan']
               && t.hChord != null && !auto['tail.hChord'];
    const bVt = built ? t.hSpan / cG
              : Math.sqrt(Math.max(Sh / (cG * cG), Sv / (sG * sG)) * GEN_RULES.hAR);
    const cVt = built ? t.hChord
              : Math.max(Sh / (cG * cG), Sv / (sG * sG)) / bVt;
    const Svt = bVt * cVt;
    S.tail.Svt = Svt; S.tail.vG = G;
    S.tail.hSpan = bVt * cG;                          // horizontal projection
    S.tail.hChord = cVt;
    S.tail.vHeight = 0.5 * bVt * sG;
    S.tail.vChord = cVt;
    S.tail.Sh = Svt * cG * cG;                        // effective, for reporting
    S.tail.Sv = Svt * sG * sG;
    // a built V keeps its measured span and chord as the builder's own
    if (!built) auto['tail.hSpan'] = auto['tail.hChord'] = true;
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
    const P = PP ? PP.engine.powerW : 48500;
    // AUTO (G159, the user: "I would like some automatic control... could the
    // setup of the prop be assisted?"). The pitch class is the one dial on the
    // propeller with a right answer that a builder cannot read off a slider,
    // and getting it wrong is expensive — a coarse prop on a Cub costs 100 fpm
    // and 30 m of runway. So 'auto' is a legal value and buildGen picks the
    // class once the wing has been measured (genPropAuto). Everything here is
    // synthesised at STANDARD in the meantime, because the choice needs a stall
    // speed and the stall speed needs a built aeroplane; the resolved spec
    // records which class was actually chosen, and the SAVED spec keeps saying
    // 'auto' so the answer follows the aeroplane when it changes.
    pr.autoPitch = (pr.pitch === 'auto');
    pr.powerW = P;
    genPropSynth(pr, pr.autoPitch ? 'standard' : pr.pitch);
  }
  const propR = S.prop.D / 2;
  S.propR = propR;
  S.engY = 0.36 * S.cab.h + pl.engineDy;        // thrustline, above the lower longeron
  S.engX = -(0.18 + 0.32 * propR) + pl.engineDx; // firewall forward: cowl + prop
  // WHERE EACH ENGINE ACTUALLY SITS (2026-09-04): engX/engY stay the NOSE
  // station (the cowl loft, the nose gear and the fleet read them); engAt is
  // the mount the frame builds and the wash blows from. A nose mount IS
  // engX/engY. The others derive from the aeroplane's own anatomy unless the
  // join measured the drawn engine: a pusher 0.30 m behind the aft bulkhead
  // at 0.45 of the cabin height; the over-the-wing engine 30 % of the chord
  // behind the leading edge, a pylon above the upper skin; a wing pair at
  // the front spar, 35 % of the way out from the root.
  S.engAt = S.engines.map(e => {
    const m = e.mount || 'nose';
    const semi = 0.5 * w.span, zR = S.cab.halfW;
    const wingY = S.wing.position === 'low' ? 0.22 * S.cab.h
                : S.wing.position === 'mid' ? 0.55 * S.cab.h : S.cab.h + 0.01;
    const pylon = e.pylon != null ? e.pylon : 0.30;
    const d = m === 'pusher' ? { x: S.fuse.boxRear + 0.30, y: 0.45 * S.cab.h, z: 0 }
            : m === 'wingTop' ? { x: w.xLE + 0.30 * w.chord,
                                  y: wingY + 0.06 * w.chord + pylon, z: 0 }
            : m === 'wing' ? { x: w.xLE + 0.05, y: wingY,
                               z: zR + 0.35 * Math.max(0.5, semi - zR) }
            : { x: S.engX, y: S.engY, z: 0 };
    return { mount: m,
             // G194: the hand, and which SIDE of a wing pair this entry is
             // (the frame builds NL from entry 0 and NR from entry 1)
             sense: (+e.sense === -1) ? -1 : 1,
             side: m === 'wing' ? (i === 0 ? -1 : 1) : 0,
             x: e.x != null ? e.x : d.x,
             y: e.y != null ? e.y : d.y,
             z: m === 'wing' ? Math.abs(e.z != null ? e.z : d.z) : 0,
             pylon,
             pushes: m === 'pusher' ? true : m === 'nose' ? false
                   : e.aim ? e.aim === 'pusher' : m === 'wingTop' };
  });

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
  // the LOWEST engine's disc is the one that strikes (2026-09-04): a nose
  // mount reads engY exactly as before
  const yEngLo = Math.min(...S.engAt.map(e => e.y));
  const byProp = yEngLo - propR + S.gear.contactR - clearReq;
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
