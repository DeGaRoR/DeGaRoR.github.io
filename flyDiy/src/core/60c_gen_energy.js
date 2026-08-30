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
