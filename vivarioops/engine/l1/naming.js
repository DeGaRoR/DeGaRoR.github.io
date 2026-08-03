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
//
// STILL PURE. The two imports below are constant tables, not state: `RANGE` is
// the schema and `SLICE_LIMITS` is the generator's configuration. They are read
// once, at module load, to decide which epithet axes can discriminate at all.
// Neither introduces a cycle — factory.js imports only genome.js and versions.js.

import { RANGE, JOINT_TYPES } from './genome.js';
import { SLICE_LIMITS } from './factory.js';

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

/**
 * Axes the CURRENT limits cannot vary, and which therefore cannot discriminate.
 * Derived from SLICE_LIMITS rather than listed, so step F needs no edit here.
 * See the skip in binomial() for why an invariant axis must not be selected on.
 */
export const DEAD_AXES = new Set(
  (SLICE_LIMITS.density ?? RANGE.density)[1] > (SLICE_LIMITS.density ?? RANGE.density)[0]
    ? [] : ['density'],
);

// DISAMBIGUATORS IS GONE. 13 section 9.1: manufacturing "elongatus II" is the
// worst available outcome. Replaced by a suppression weight — an epithet already
// in the Atlas has its draw probability multiplied by SUPPRESSION, so the
// generator prefers unseen names, and genuine homonyms are simply allowed. That
// is what author citations exist to resolve.

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

  // ── 13 §3 — the axes the new nomenclature needs ────────────────────────
  //
  // ADDED ALONGSIDE the four originals rather than replacing them. The old
  // buckets are what gate/breed.js asserts on and what 10 §A10 specifies; these
  // are finer readings of the same plan, and keeping both means the extension
  // cannot silently change what the old assertions were testing.
  //
  // 13 §1's diagnosis is a BITS SHORTAGE, not a vocabulary shortage: four
  // correlated axes carry ~7 bits, so the same names recur however large the
  // token pools get. These six axes are where the extra bits come from.
  const mirroredFlag = mirrored > 0;
  const limbClass = mirrored === 0 ? 0 : mirrored <= 1 ? 1 : mirrored <= 2 ? 2
    : mirrored <= 4 ? 3 : mirrored <= 8 ? 4 : 5;                     // 6 buckets
  const depthClass = maxDepth <= 1 ? 0 : maxDepth <= 3 ? 1 : maxDepth <= 5 ? 2 : 3;
  const runClass = longestRun <= 1 ? 0 : longestRun <= 2 ? 1 : longestRun <= 4 ? 2
    : longestRun <= 7 ? 3 : 4;                                        // 5 buckets
  const dofMean = plan.joints.length
    ? mean(plan.joints.map(j => DOF_OF[j.type] ?? 1)) : 0;
  const dofClass = dofMean < 1.15 ? 0 : dofMean < 2.0 ? 1 : 2;        // low/mixed/high
  const angleMean = plan.joints.length
    ? mean(plan.joints.map(j => j.angleLimits[0])) : 0;
  const angleClass = angleMean < 0.6 ? 0 : angleMean < 1.1 ? 1 : 2;   // narrow/mid/wide

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

  return {
    segmentBucket, symmetry, limbBucket, depthBucket, maxDepth, longestRun, mirrored, traits,
    mirroredFlag, limbClass, depthClass, runClass, dofClass, angleClass,
  };
}


// ═══════════════════════════════════════════════════════════════════════════
// 13 · NOMENCLATURE
// ═══════════════════════════════════════════════════════════════════════════
//
// WHAT THIS IMPLEMENTS, AND WHAT IT DOES NOT. Design 13 specifies four ranks, a
// lineage tag, author citations, recombination scars and local normalisation.
// The ranks, the phonotactics and the species channels are HERE, pure over
// (plan, genome, ctx). Everything that needs a genome field or persistent lineage
// state — `tag` (§7), authors (§8), subspecies (§4.4), scars (§10), streaming
// local normalisation (§9) — needs a GENOME_V bump and a migration, and is
// deliberately not smuggled in alongside a rewrite of the generator.
//
// `ctx` IS OPTIONAL, against 13 §14.1's "every caller must supply ctx". Making it
// required would mean touching every call site in the same commit as this
// rewrite, and then a naming defect and a plumbing defect would be
// indistinguishable. A caller that passes nothing gets the derived name with no
// suppression — exactly what it got before.

/** 13 §4.1 — 24 curated archetypes. Family is the name a player remembers. */
const FAMILIES = {
  'plano|oligo|1':  ['Brachypodidae',    'pod'],
  'plano|meso|1':   ['Dolichopodidae',   'pod'],
  'plano|poly|1':   ['Stenosomatidae',   'somat'],
  'plano|myria|1':  ['Myriarthridae',    'arthr'],
  'plano|oligo|0':  ['Camphyloscelidae', 'scel'],
  'plano|meso|0':   ['Plagiocaudidae',   'caud'],
  'plano|poly|0':   ['Loxonotidae',      'not'],
  'plano|myria|0':  ['Scoliorhachidae',  'rhach'],
  'actino|oligo|1': ['Nereidae',         'Nere'],
  'actino|meso|1':  ['Proteidae',        'Prote'],
  'actino|poly|1':  ['Thetidae',         'Theti'],
  'actino|myria|1': ['Hydridae',         'Hydr'],
  'actino|oligo|0': ['Boreadidae',       'Bore'],
  'actino|meso|0':  ['Echoidae',         'Ech'],
  'actino|poly|0':  ['Lethaeidae',       'Leth'],
  'actino|myria|0': ['Charontidae',      'Charont'],
  'ataxo|oligo|1':  ['Amorphidae',       'morph'],
  'ataxo|meso|1':   ['Physaridae',       'physar'],
  'ataxo|poly|1':   ['Plasmatidae',      'plasmat'],
  'ataxo|myria|1':  ['Chaomatidae',      'chaomat'],
  'ataxo|oligo|0':  ['Atactidae',        'tact'],
  'ataxo|meso|0':   ['Sphalmatidae',     'sphalmat'],
  'ataxo|poly|0':   ['Anomalidae',       'anomal'],
  'ataxo|myria|0':  ['Teratidae',        'terat'],
};

/** 13 §5.1 — 18 genus prefixes, indexed `limbClass * 3 + secondClass`. */
const P1 = ['oligo', 'poly', 'myria', 'macro', 'micro', 'brachy', 'dolicho', 'platy',
  'steno', 'eury', 'lepto', 'pachy', 'ortho', 'campylo', 'hetero', 'iso', 'holo', 'hemi'];

/** 13 §5.2 — 12 second prefixes, present only at arity 3. */
const P2 = ['allo', 'aniso', 'cyclo', 'dendro', 'gymno', 'litho',
  'nemato', 'phyllo', 'schizo', 'sclero', 'strepto', 'thylo'];

const TERMINAL = { plano: 'us', actino: 'a', ataxo: 'ops' };
/** 13 §4.3 — gender agreement. Getting this wrong is the loudest possible tell. */
const EPITHET_END = { us: 'us', a: 'a', ops: 'is' };

/**
 * 13 §4.3 — a quality prefix per axis POLE, and a trait stem per (axis, sign).
 *
 * The document gives 20 qualities and 18 stems but not the mapping, because the
 * signature it assumes has more axes than this one has. The composition used
 * here: QUALITY comes from the MOST extreme axis (its pole picks which of the
 * pair), STEM from the SECOND most extreme. That is what makes the 20x18 cross
 * actually reachable from 12 axes — one axis alone could only ever yield 12 pairs.
 */
const QUALITY = {
  amplitude:   ['torti', 'recti'],     omega:       ['celeri', 'tardi'],
  density:     ['crassi', 'tenui'],    size:        ['alti', 'humili'],
  rootShare:   ['crassi', 'gracili'],  slenderness: ['tenui', 'robusti'],
  phaseLag:    ['torti', 'recti'],     angleRange:  ['lati', 'angusti'],
  dofShare:    ['flexi', 'rigidi'],    segmentRun:  ['longi', 'brevi'],
  limbs:       ['denti', 'laevi'],     reflections: ['acuti', 'obtusi'],
};
const STEMS = ['caud', 'ped', 'corp', 'ala', 'artic', 'spin', 'front', 'later',
  'vent', 'dors', 'rostr', 'palm', 'fibr', 'nod', 'flex', 'puls', 'grad', 'vibr'];

const HABITAT = ['crassaquae', 'tenuiaquae', 'profundus', 'superficialis', 'turbidus',
  'limpidus', 'frigidus', 'gravis', 'levis'];
const TYPICAL = ['vulgaris', 'communis', 'mediocris'];
const MISFIT = ['mirabilis', 'monstrosus', 'paradoxus', 'inexpectatus', 'absurdus',
  'elegantissimus', 'horridus', 'ridiculus', 'obscurus', 'dubius', 'incognitus',
  'fallax', 'insolitus', 'portentosus'];

/** 13 §9.1 — an epithet already in the Atlas is 20x less likely to be drawn again. */
const SUPPRESSION = 0.05;

// ── phonotactics, 13 §6 ────────────────────────────────────────────────────
const VOWEL = /[aeiouy]/i;
const STOP = /[bcdgkpqt]/i;
const BAD_CLUSTER = ['sr', 'tl', 'dl', 'vn', 'zg', 'kt'];

/** E1–E4, applied at one seam. */
function elide(a, b) {
  if (!a) return b;
  if (!b) return a;
  const l = a[a.length - 1], r = b[0];
  // E4 first: a terminal `y` before a vowel becomes `i`; before a consonant it stays.
  if (l.toLowerCase() === 'y' && VOWEL.test(r)) return a.slice(0, -1) + 'i' + b.slice(1);
  if (VOWEL.test(l) && VOWEL.test(r)) return a.slice(0, -1) + b;           // E1
  if (l.toLowerCase() === r.toLowerCase()) return a + b.slice(1);           // E2
  if (STOP.test(l) && STOP.test(r)) return a + 'o' + b;                     // E3
  return a + b;
}

/** Vowel groups. Rough, and enough for E6, which is only a length guard. */
const syllables = (w) => (w.toLowerCase().match(/[aeiouy]+/g) || []).length;

/** E5–E7. A composition that fails is rejected and the next candidate is tried. */
function legal(w) {
  if (/(.)\1\1/i.test(w)) return false;                                     // E5
  if (syllables(w) > 7) return false;                                       // E6
  const lower = w.toLowerCase();
  for (const c of BAD_CLUSTER) if (lower.startsWith(c)) return false;        // E7
  return true;
}

/** Deterministic [0,1) from a string. No rng anywhere in /engine/ (N1). */
function hash01(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0;
  return (h >>> 0) / 4294967296;
}

/** Weighted deterministic pick — where 13 §9.1's suppression actually lands. */
function pick(cands, roll) {
  const total = cands.reduce((t, c) => t + c.w, 0);
  if (!(total > 0)) return cands[0];
  let x = roll * total;
  for (const c of cands) { x -= c.w; if (x <= 0) return c; }
  return cands[cands.length - 1];
}

/**
 * DERIVED, NOT LISTED — the same rule `DEAD_AXES` follows. Every joint type the
 * genome may express is checked against the DOF table; if they all carry the same
 * DOF then `dofClass` cannot discriminate, and 13 §5.1's P1 index loses a factor.
 */
const DOF_IS_DEAD = (() => {
  const dofs = new Set(JOINT_TYPES.filter((t) => t !== 'rigid').map((t) => DOF_OF[t] ?? 1));
  return dofs.size <= 1;
})();

/**
 * THE DERIVED NAME.
 *
 * @param {object} plan
 * @param {object} genome
 * @param {Set<string>|object} [ctx]  a Set of binomials already in the Atlas (the
 *   old `taken` argument, still honoured) or `{ taken }`. Optional throughout.
 * @returns {{family, genus, species, binomial, signature, extremity, arity, channel}}
 */
export function binomial(plan, genome, ctx) {
  const s = signature(plan, genome);
  const taken = ctx instanceof Set ? ctx : ctx?.taken;

  // ── family ───────────────────────────────────────────────────────────────
  const [family, stem] = FAMILIES[`${s.symmetry}|${s.segmentBucket}|${s.mirroredFlag ? 1 : 0}`];

  // ── the trait ranking both the epithet and one genus slot read ───────────
  const ranked = [];
  for (let i = 0; i < AXES.length; i++) {
    const [trait, median, spread] = AXES[i];
    if (DEAD_AXES.has(trait)) continue;
    const z = (s.traits[trait] - median) / Math.max(spread, SPREAD_FLOOR);
    ranked.push({ trait, i, z, mag: Math.abs(z) });
  }
  // Ties resolve by table order, so the function stays total and deterministic.
  ranked.sort((a, b) => b.mag - a.mag || a.i - b.i);
  const top = ranked[0], second = ranked[1] ?? ranked[0];

  // ── genus, 13 §4.2 — ARITY CARRIES INFORMATION ───────────────────────────
  //
  // Slot count is driven by depthClass, so a blunt animal gets a blunt name.
  // Uniform four-syllable names are what a generator sounds like; that was 13
  // §1's second defect and variable arity is the whole fix for it.
  //
  // P1's second factor SHOULD be `dofClass` (13 §5.1). Measured over a 300-genome
  // corpus, every joint in this world is `revolute` or `twist` — both 1 DOF — so
  // dofClass is CONSTANT, and using it would collapse P1 from 18 prefixes to 6.
  // Same situation as `density`, handled the same way: fall back to a live axis,
  // derived rather than listed, so dofClass returns by itself the day a
  // multi-DOF joint type becomes reachable.
  const shapeClass = s.traits.slenderness < 0.5 ? 0 : s.traits.slenderness < 0.75 ? 1 : 2;
  const secondClass = DOF_IS_DEAD ? shapeClass : s.dofClass;
  const arity = s.depthClass <= 0 ? 1 : s.depthClass <= 1 ? 2 : 3;

  const p1 = P1[(s.limbClass * 3 + secondClass) % P1.length];
  const p2 = P2[(s.runClass * 3 + s.angleClass) % P2.length];
  const terminal = TERMINAL[s.symmetry];

  // Candidates in a deterministic fallback order, most specific first. A
  // composition rejected by E5–E7 drops to the next; the bare stem is always
  // legal, so this cannot fail to produce a name.
  // THE STEM IS LOWERCASED BEFORE COMPOSITION. The mythological stems are stored
  // capitalised (Nere, Prote, Hydr) because they are proper nouns, and prepending
  // a prefix to one gave `EuryProtea`, `OrthoThetia`, `IsoHydra` — an interior
  // capital, which is the single most obvious way a name announces it was
  // assembled by machine. Only the FIRST letter of the finished genus is raised.
  const body = stem.toLowerCase();
  const forms = arity >= 3 ? [[p2, p1, body], [p1, body], [body]]
    : arity === 2 ? [[p1, body], [body]] : [[body]];
  let raw = stem, usedArity = 1;
  for (const parts of forms) {
    const composed = parts.reduce((acc, part) => elide(acc, part), '');
    if (legal(composed + terminal)) { raw = composed; usedArity = parts.length; break; }
  }
  const genus = raw.charAt(0).toUpperCase() + raw.slice(1) + terminal;

  // ── species, 13 §4.3 — five weighted channels ────────────────────────────
  const end = EPITHET_END[terminal];
  /**
   * GENDER AGREEMENT, 13 §4.3 — but only for adjectives that HAVE genders.
   *
   * A blanket `-us|-is|-a` rewrite produced `levus`, `gravus`, `mediocra` — none
   * of which is a word. `levis`, `gravis`, `vulgaris`, `mirabilis` and `fallax`
   * are third declension: their masculine and feminine forms are identical, and
   * rewriting the ending is exactly the error 13 §4.3 warns is "the single most
   * visible way a generated Latin name announces itself as generated".
   *
   * So: first/second declension (`-us`) agrees; third declension (`-is`, `-ax`)
   * and already-inflected forms (`-ae`) are left alone.
   */
  const gend = (w) => {
    if (/(is|ax|ae)$/.test(w)) return w;
    if (/us$/.test(w)) return w.slice(0, -2) + end;
    return w + end;
  };

  const allTypical = ranked.every((r) => r.mag < 0.8);
  const veryTypical = ranked.every((r) => r.mag < 0.3);

  // Descriptive: QUALITY(top pole) ⊕ STEM(second axis, signed), then intensity.
  // Intensity is the cheapest expressive win in the document — the name carries
  // magnitude and not only direction, and a player reads it at a glance.
  const q = QUALITY[top.trait][top.z >= 0 ? 0 : 1];
  const describe = (axis) => {
    const st = STEMS[(axis.i * 2 + (axis.z >= 0 ? 0 : 1)) % STEMS.length];
    const b = elide(q, st);
    return top.mag > 2.5 ? gend(b + 'issimus')
      : top.mag < 0.5 ? gend('sub' + b + 'atus')
        : gend(b + 'atus');
  };

  // A LADDER, NOT A JUMP. When a descriptive epithet is already taken the first
  // version fell through to another CHANNEL entirely, so a collision turned a
  // described animal into `habitat` or `misfit` — which loses the description and
  // still only reached 73% distinct against 13 §NM-16's 90%. Trying the next
  // trait down instead keeps the name descriptive and keeps it about this animal:
  // the quality still names its most extreme axis, only the stem moves to the
  // next thing worth mentioning. Each rung is suppressed independently.
  const rungs = ranked.slice(1, 5).map((a) => a);
  if (!rungs.length) rungs.push(top);
  const cands = rungs.map((axis, k) => ({
    w: k === 0 ? 0.720 : 0.720 / (k + 1), v: describe(axis), ch: 'descriptive',
  }));
  cands.push(
    { w: 0.120, v: gend(HABITAT[Math.floor(hash01(genus + 'h') * HABITAT.length)]), ch: 'habitat' },
    { w: allTypical ? 0.090 : 0, v: gend(TYPICAL[Math.floor(hash01(genus + 't') * TYPICAL.length)]), ch: 'typicality' },
    { w: 0.005, v: gend(MISFIT[Math.floor(hash01(genus + 'm') * MISFIT.length)]), ch: 'misfit' },
    // Tautonym: 13 §4.3 also requires the archetype centroid, which needs corpus
    // state this file does not hold. `veryTypical` is the part it can honestly test.
    { w: veryTypical ? 0.005 : 0, v: genus.toLowerCase(), ch: 'tautonym' },
  );
  // SUPPRESSION HAS TO MOVE THE ROLL, not only the weights. The draw is a
  // deterministic hash of the signature, so two creatures with the same signature
  // roll the same number — and re-weighting a fixed roll can leave it landing on
  // the suppressed candidate anyway. Feeding the number of collisions into the
  // hash makes the second identical creature roll somewhere else, which is what
  // "prefer an unseen name" actually requires.
  let clashes = 0;
  if (taken) {
    for (const c of cands) if (taken.has(genus + ' ' + c.v)) { c.w *= SUPPRESSION; clashes++; }
  }

  const live = cands.filter((c) => c.w > 0);
  const chosen = pick(live,
    hash01(genus + '|' + top.trait + '|' + second.trait + '|' + top.mag.toFixed(3) + '|' + clashes));

  return {
    family, genus, species: chosen.v, binomial: genus + ' ' + chosen.v,
    signature: s, extremity: top.mag, arity: usedArity, channel: chosen.ch,
  };
}

/** 13 §14.2 — replaces `genusSpace()`. Exactly 24, every one curated. */
export function familySpace() { return Object.values(FAMILIES).map((f) => f[0]); }

/**
 * RETAINED, BUT IT NO LONGER MEANS WHAT IT MEANT. The genus space is not
 * enumerable any more — arity, elision rejection and axis correlation decide what
 * is reachable, and 13 §13 is explicit that the figure must be MEASURED over a
 * corpus rather than asserted from a table. This returns the family space so the
 * old callers get a true statement rather than a stale one.
 */
export function genusSpace() { return familySpace(); }

export const EPITHET_COUNT = AXES.length * 2;
export const NAME_AXES = AXES;
export const NAMING = { FAMILIES, P1, P2, STEMS, MISFIT, HABITAT, TYPICAL, SUPPRESSION, DOF_IS_DEAD, elide, legal, syllables };
