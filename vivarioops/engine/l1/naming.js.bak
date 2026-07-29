// engine/l1/naming.js — derived binomial naming (10 §A10, table per A17.5).
//
// PURE: a function of body plan and genome. No rng, no clock, no lookup service.
// The carried obligation from B1 said naming belongs at B4, "a pure function of
// structure", and that is the whole point of it:
//
//   NAMES ARE DERIVED FROM STRUCTURE, so structurally similar creatures receive
//   the same genus automatically. That gives real taxonomy as a free consequence
//   of real genetics — two players who breed convergent bodies find they have
//   independently discovered the same genus, which no naming table could fake.
//
// Grammar-generated names are defensible here precisely because Latin morphology
// is compositional and MEANINGFUL: `Myriapodus elongatus` tells you the animal
// is many-segmented, many-limbed and long. The name is a readable factsheet.
//
// SLICE SCOPE: function only, no UI (10 §8). Nothing displays this yet.

/** 10 §A5 correction 5: nodes are referenced by id, never by index. */
export const GENUS_SUFFIX = { plano: 'us', actino: 'a', ataxo: 'ops' };

/** Axis 1 — segment count. A10's buckets, verbatim. */
const SEGMENT_ROOTS = { oligo: 'Oligo', meso: 'Meso', poly: 'Poly', myria: 'Myria' };

/**
 * Axis 2 — limb count crossed with tree depth, six roots. A10 writes
 * `genus = concat(two roots from signature) + 'us'/'a'/'ops'` and lists four
 * signature axes, so two axes are carried by the second root and the third by
 * the suffix. All four are used; none is decorative.
 */
const FORM_ROOTS = {
  'apod:brevi': 'derm',       // limbless and compact — a body, nothing else
  'apod:longi': 'anguill',    // limbless and long — an eel
  'brachy:brevi': 'pter',     // few limbs, shallow — fins
  'brachy:longi': 'cheir',    // few limbs, deep — arms
  'poly:brevi': 'aster',      // many limbs, shallow — a star
  'poly:longi': 'pod',        // many limbs, deep — legs
};

/**
 * Species epithets — twelve trait axes, two poles each, 24 names per A17.5.
 *
 * A10 says the epithet comes from "the single most extreme normalised trait",
 * and EXTREME IS RELATIVE TO A POPULATION, not to the [0,1] interval. Taking the
 * raw argmax instead was measured and is worthless: any trait that saturates at
 * exactly 1.0 wins unconditionally, so 150 of 300 creatures came out `apodus`
 * simply because most have no mirrored limbs and `1 - limbs` is therefore 1.0.
 * The name then describes the population, not the animal.
 *
 * So each axis carries a REFERENCE — the corpus median and the p10-p90 spread —
 * and the score is the signed deviation in spreads. The winner is the largest
 * |deviation|; its sign chooses the pole. A creature is named for whatever it
 * does most unusually, which is what a taxonomist would do.
 *
 * REFERENCES ARE MEASURED, NOT GUESSED: 500 random genomes under SLICE_LIMITS,
 * B4, recorded in the changelog. They are constants of the CURRENT generator, so
 * step F's looser factory will shift them and they must be re-measured — a
 * gate diagnostic prints the resulting name distribution every run so that drift
 * is visible rather than silent.
 *
 * The floor on `spread` keeps one-sided axes finite: `segmentRun` is zero for
 * 90% of the corpus, so its p10-p90 spread is zero and a chain of two segments
 * would otherwise score infinitely.
 */
const SPREAD_FLOOR = 0.2;

const AXES = [
  //  trait          median  spread   high pole      low pole
  ['amplitude',      0.500,  0.638,  'undulans',    'placidus'],
  ['omega',          0.495,  0.801,  'celer',       'lentus'],
  ['density',        0.479,  0.492,  'gravis',      'levis'],
  ['size',           0.322,  0.664,  'giganteus',   'minutus'],
  ['rootShare',      0.153,  0.544,  'crassus',     'gracilis'],
  ['slenderness',    0.650,  0.330,  'tenuis',      'robustus'],
  ['phaseLag',       0.496,  0.642,  'sinuosus',    'concors'],
  ['angleRange',     0.497,  0.672,  'torquens',    'strictus'],
  ['dofShare',       0.333,  0.667,  'flexilis',    'firmus'],
  ['segmentRun',     0.000,  0.000,  'elongatus',   'compactus'],
  ['limbs',          0.000,  0.250,  'multipes',    'apodus'],
  ['reflections',    0.000,  0.500,  'radiatus',    'inornatus'],
];

/** Disambiguators, in order, when a binomial is already taken in the Atlas. */
const DISAMBIGUATORS = ['minor', 'major', 'borealis', 'australis', 'orientalis',
  'occidentalis', 'pallidus', 'niger', 'ruber', 'viridis'];

const clamp01 = (x) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

/** Degrees of freedom per joint type — mirrors morphogen.DOF without importing it. */
const DOF_OF = { rigid: 0, revolute: 1, twist: 1, bendTwist: 2, twistBend: 2, universal: 2, spherical: 3 };

/**
 * The four signature axes of 10 §A10, plus the normalised traits the epithet
 * reads. Exported because the gate asserts on the signature directly: a name is
 * only meaningful if the signature it comes from is.
 */
export function signature(plan, genome) {
  const n = plan.bodyCount;

  // Tree depth is NOT plan.bodies[].depth — that is RECURSION depth, which
  // resets on node change (L1-16). The distance from the root is walked here.
  const treeDepth = new Int32Array(n);
  let maxDepth = 0;
  const children = new Int32Array(n);
  for (let i = 1; i < n; i++) {
    const p = plan.bodies[i].parent;
    treeDepth[i] = p >= 0 ? treeDepth[p] + 1 : 0;
    if (p >= 0) children[p]++;
    if (treeDepth[i] > maxDepth) maxDepth = treeDepth[i];
  }

  // The longest run of consecutive bodies expressing the SAME node type along
  // one path — a repeated segment chain, which is what makes an eel an eel. This
  // is a different quantity from tree depth: a deep tree can be six different
  // node types, and that is a branching animal, not a segmented one.
  const run = new Int32Array(n).fill(1);
  let longestRun = 1;
  for (let i = 1; i < n; i++) {
    const p = plan.bodies[i].parent;
    run[i] = (p >= 0 && plan.bodies[p].nodeId === plan.bodies[i].nodeId) ? run[p] + 1 : 1;
    if (run[i] > longestRun) longestRun = run[i];
  }

  const mirrored = plan.bodies.filter(b => b.mirror.right || b.mirror.up || b.mirror.forward).length;
  const multiAxis = plan.bodies.filter(b =>
    (b.mirror.right ? 1 : 0) + (b.mirror.up ? 1 : 0) + (b.mirror.forward ? 1 : 0) >= 2).length;

  const segmentBucket = n <= 3 ? 'oligo' : n <= 7 ? 'meso' : n <= 14 ? 'poly' : 'myria';
  const symmetry = multiAxis > 0 ? 'actino' : mirrored > 0 ? 'plano' : 'ataxo';
  const limbBucket = mirrored === 0 ? 'apod' : mirrored <= 2 ? 'brachy' : 'poly';
  const depthBucket = maxDepth <= 2 ? 'brevi' : 'longi';

  // ── normalised traits ──────────────────────────────────────────────────
  const vol = (b) => b.dims[0] * b.dims[1] * b.dims[2];
  const totalVol = plan.bodies.reduce((s, b) => s + vol(b), 0) || 1;
  const dims = plan.bodies.map(b => b.dims);
  const jointGenes = plan.joints.map(j => genome.controller.jointGenes[j.nodeId]).filter(Boolean);
  const radius = Math.max(...plan.bodies.map(b =>
    Math.hypot(b.position[0], b.position[1], b.position[2]) + Math.max(...b.dims) * 0.5));

  const traits = {
    amplitude:    clamp01(mean(jointGenes.map(g => g.amplitude))),
    segmentRun:   clamp01((longestRun - 1) / 5),
    branching:    clamp01((Math.max(0, ...children) - 1) / 4),
    limbs:        clamp01(mirrored / 8),
    rootShare:    clamp01(vol(plan.bodies[0]) / totalVol),
    slenderness:  clamp01(mean(dims.map(d => 1 - Math.min(...d) / Math.max(...d)))),
    omega:        clamp01((genome.controller.omega - 0.5) / 5.5),
    density:      clamp01((mean(plan.bodies.map(b => b.density)) - 0.15) / 1.65),
    flatness:     clamp01(mean(dims.map(d => 1 - [...d].sort((a, b) => a - b)[0] / [...d].sort((a, b) => a - b)[1]))),
    breadth:      clamp01(mean(dims.map(d => d[0] / (d[2] || 1))) / 3),
    reflections:  clamp01(mirrored / Math.max(1, n - 1)),
    phaseLag:     clamp01(mean(plan.joints.map(j => Math.abs(j.phaseLag))) / Math.PI),
    size:         clamp01((radius - 0.5) / 8),
    jointDensity: clamp01(plan.jointCount / Math.max(1, n)),
    dofShare:     clamp01(plan.joints.length ? mean(plan.joints.map(j => (DOF_OF[j.type] ?? 1) / 3)) : 0),
    bias:         clamp01(mean(jointGenes.map(g => Math.abs(g.bias))) / 0.5),
    freqMult:     clamp01((mean(jointGenes.map(g => g.freqMult)) - 0.5) / 1.5),
    angleRange:   clamp01(mean(plan.joints.map(j => j.angleLimits[0])) / (Math.PI / 2)),
  };

  return { segmentBucket, symmetry, limbBucket, depthBucket, maxDepth, longestRun, mirrored, traits };
}

/**
 * @param {object} plan
 * @param {object} genome
 * @param {Set<string>} [taken]  binomials already registered in this Atlas
 * @returns {{genus:string, species:string, binomial:string, signature:object}}
 */
export function binomial(plan, genome, taken) {
  const s = signature(plan, genome);

  const genus = SEGMENT_ROOTS[s.segmentBucket]
    + FORM_ROOTS[`${s.limbBucket}:${s.depthBucket}`]
    + GENUS_SUFFIX[s.symmetry];

  // The most extreme trait, in spreads from the corpus median. Ties resolve by
  // table order, so the function is total and deterministic.
  let best = AXES[0][3], bestScore = -Infinity;
  for (const [trait, median, spread, high, low] of AXES) {
    const z = (s.traits[trait] - median) / Math.max(spread, SPREAD_FLOOR);
    if (Math.abs(z) > bestScore) { bestScore = Math.abs(z); best = z >= 0 ? high : low; }
  }

  let species = best;
  if (taken && taken.has(`${genus} ${species}`)) {
    for (const d of DISAMBIGUATORS) {
      if (!taken.has(`${genus} ${species} ${d}`)) { species = `${species} ${d}`; break; }
    }
  }

  return { genus, species, binomial: `${genus} ${species}`, signature: s, extremity: bestScore };
}

/** Every genus this table can produce — 4 x 6 x 3 = 72. Used by the gate. */
export function genusSpace() {
  const out = [];
  for (const seg of Object.values(SEGMENT_ROOTS)) {
    for (const form of Object.values(FORM_ROOTS)) {
      for (const suf of Object.values(GENUS_SUFFIX)) out.push(seg + form + suf);
    }
  }
  return out;
}

export const EPITHET_COUNT = AXES.length * 2;
export const NAME_AXES = AXES;
