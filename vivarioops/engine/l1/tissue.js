// engine/l1/tissue.js — WHAT A BODY IS MADE OF, derived from its geometry.
//
// PURITY: no clock, no rng, no Rapier, no upward imports. Pure functions of a
// BodyPlan. Everything here is arithmetic on dimensions, which is why it can be
// asserted rather than sampled.
//
// UNITS ARE CGS (01 §7): centimetres, grams, seconds, ergs.
//
// ── WHY THIS MODULE EXISTS ───────────────────────────────────────────────────
//
// A cuboid in this project currently means five things at once: structural
// material, displaced fluid, inertial mass, the cross-section a joint's torque is
// derived from, and the thing the renderer draws. Nothing distinguishes them, so
// ACTUATOR CAPACITY ARRIVES FREE WITH GEOMETRY and evolution never has to decide
// how much of a body should be muscle. An independent review reached that
// conclusion from one direction and the plan's volume-allocation law reached it
// from the other; this module is where the two meet.
//
// IT IS DELIBERATELY DERIVED-ONLY FOR NOW. No gene, no schema bump, nothing in
// the ledger yet. The plan's rule is "measure first, then build", and the risk it
// names for this rung is specific: "joules per cm^3 of dead tissue has no
// principled value, and if those numbers get fitted until the shapes look nice,
// this is authored morphology with extra steps." So the first job is to find out
// whether the geometry says anything at all, using ONLY coefficients that cite a
// measurable biological quantity.
//
// ── WHAT IS NOT HERE, AND WHY ────────────────────────────────────────────────
//
// DERIVED DENSITY IS DEFERRED, on purpose. The plan has density becoming the
// mass-weighted mean of whatever the body had to allocate, rather than drawn.
// That is right, and it CANNOT LAND HERE: `SLICE_LIMITS.density` is pinned to
// [1, 1] against `mediumDensity` 1.0, which is the only reason the buoyancy term
// `(mediumDensity - density) * V * g` is identically zero and gravity is inert.
// Deriving density unpins it, makes weight and buoyancy live for every body, and
// turns a tissue-accounting change into a world change. That belongs with W3 and
// the density unpin, as one change rather than two.

/**
 * OXYGEN DIFFUSION DEPTH INTO UNPERFUSED TISSUE, cm.
 *
 * SOURCE, and it is the whole reason this constant is allowed to exist: tissue
 * with no circulation is supplied by diffusion from its surface, and the depth at
 * which metabolic demand exhausts the supply is of order 0.5-1 mm. It is why
 * flatworms are flat, why cnidarian bodies are two cell layers around jelly, and
 * why anything thicker than about a millimetre needed to invent a circulatory
 * system before it could be thicker.
 *
 * 0.1 cm = 1 mm, the generous end of that range — chosen generous so the law
 * bites LESS rather than more, because a constant that flatters its own
 * hypothesis is worthless.
 *
 * MEASURED RELEVANCE BEFORE ADOPTION (design/_zmorph.mjs, n=120): the corpus's
 * min half-thickness is p50 0.232 cm, i.e. the deepest interior point of the
 * median body sits 2.3 mm from air. Against 1 mm, this law bites the median
 * creature — which is the point of it, and is why it was worth writing.
 */
export const DIFFUSION_DEPTH = 0.1;

/**
 * KLEIBER'S EXPONENT. Metabolic demand scales as M^0.75 across ~20 orders of
 * magnitude of body mass; compact surface area scales as M^(2/3). They diverge,
 * so past some size a compact body cannot supply itself and must flatten,
 * elongate, or grow dedicated surface. Already the exponent `forage.js` `ledger`
 * uses for basal cost; restated here so the two cannot drift apart.
 */
export const KLEIBER = 0.75;

/**
 * Volume of the anoxic interior of a box, cm^3.
 *
 * The live shell is everything within `DIFFUSION_DEPTH` of a surface. What is
 * left is an inner box with every dimension reduced by twice that depth — dead
 * tissue: it has mass, it must be dragged and accelerated, and it cannot
 * contract. A body thinner than `2 * DIFFUSION_DEPTH` on any axis has no dead
 * core at all, which is exactly the flatworm result and is a good check that the
 * arithmetic is the right way round.
 */
export function deadCoreVolume(dims) {
  const d = 2 * DIFFUSION_DEPTH;
  const x = Math.max(0, dims[0] - d);
  const y = Math.max(0, dims[1] - d);
  const z = Math.max(0, dims[2] - d);
  return x * y * z;
}

/** Surface area of a box, cm^2 — the O2 uptake area for a creature with no gills. */
export function surfaceArea(dims) {
  const [x, y, z] = dims;
  return 2 * (x * y + y * z + z * x);
}

/**
 * The tissue budget of one body.
 *
 * `live` is the perfused shell — the only tissue that can contract or respire.
 * `dead` is the anoxic core: mass without capability. `deadFraction` is the one
 * number that matters, because it is what a thick body pays and a flat one does
 * not.
 */
export function bodyTissue(body) {
  const volume = body.dims[0] * body.dims[1] * body.dims[2];
  const dead = deadCoreVolume(body.dims);
  const live = Math.max(0, volume - dead);
  return {
    volume,
    dead,
    live,
    deadFraction: volume > 0 ? dead / volume : 0,
    surface: surfaceArea(body.dims),
    minHalfThickness: Math.min(...body.dims) / 2,
  };
}

/**
 * The tissue budget of a whole creature, plus the respiratory verdict.
 *
 * `oxygenRatio` is supply over demand, both in arbitrary but CONSISTENT units —
 * it is a RATIO and only its scaling with size is claimed, which is the honest
 * reading of Kleiber against surface. Supply is total surface area; demand is
 * mass^0.75. Below 1 the creature is oxygen-limited at rest.
 *
 * THE ABSOLUTE VALUE OF `oxygenRatio` MEANS NOTHING and must not be thresholded
 * without a calibration that does not exist yet. What it can already say is how
 * the corpus is ORDERED, and how that order changes with body plan — a flat
 * animal and a blocky animal of the same mass differ here by construction, which
 * is the trade-off the project currently does not have.
 */
export function creatureTissue(plan) {
  let volume = 0, dead = 0, live = 0, surface = 0;
  let thinnest = Infinity;
  const perBody = [];
  for (const b of plan.bodies) {
    const t = bodyTissue(b);
    perBody.push(t);
    volume += t.volume; dead += t.dead; live += t.live; surface += t.surface;
    if (t.minHalfThickness < thinnest) thinnest = t.minHalfThickness;
  }
  // Mass with density pinned at 1.0 is numerically the volume; written as a
  // multiplication anyway so that unpinning density later changes one line here
  // rather than being silently wrong.
  const mass = plan.bodies.reduce((m, b) =>
    m + b.dims[0] * b.dims[1] * b.dims[2] * (b.density ?? 1), 0);
  const demand = Math.pow(Math.max(mass, 1e-9), KLEIBER);
  return {
    volume, dead, live, surface, mass,
    deadFraction: volume > 0 ? dead / volume : 0,
    surfaceToVolume: volume > 0 ? surface / volume : 0,
    oxygenRatio: demand > 0 ? surface / demand : Infinity,
    thinnestHalfThickness: thinnest,
    perBody,
  };
}
