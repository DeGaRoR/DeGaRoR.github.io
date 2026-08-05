// engine/l1/vernacular.js — common names (14 §1-§9).
//
// PURE, on the same terms as naming.js: a function of (plan, genome, ctx, lang).
// No rng, no clock, no DOM, no import above /engine/ (N1, N2, N3).
//
// WHAT THIS IS FOR, AND WHY IT IS NOT A TRANSLATION OF THE BINOMIAL. 14 §1 names
// the failure mode precisely: a vernacular layer that renders `Dolichopodus` as
// "the long-foot" is decoration. The governing rule is that THE VERNACULAR READS
// DIFFERENT AXES — the binomial reads topology, the vernacular reads appearance
// and motion. Colour, pattern and gait are invisible to naming.js and they are
// the two or three things a player actually watches. That is the whole design.
//
// The head noun is the exception and is deliberately shared: it comes from the
// family, so every creature in a clade is a kind of whipfoot. 14 §3.1.
//
// ── THREE PLACES THIS DEVIATES FROM 14, EACH BECAUSE THE DOCUMENT IS WRONG
//    ABOUT THIS CODEBASE OR ABOUT ITSELF ────────────────────────────────────
//
// 1. COLOUR IS NOT AN ABSOLUTE HUE. 14 §3.2 hands out twelve hue sectors as
//    though `material.hue` were a hue. It is not: render/creature.js:84
//    (`colourFrom`) reads it as a POSITION ALONG THE WORLD'S SIX-STOP RAMP, and
//    w1's ramp runs deep blue -> cyan -> mint -> bone -> coral -> magenta. There
//    is no ochre or olive anywhere in that world. Naming a creature `ochre` when
//    it renders teal is the worst outcome available to a layer whose entire job
//    is RECOGNITION, so the colour word is derived from the RAMP COLOUR the
//    animal actually wears: `ctx.palette.stops` in, sRGB->linear lerp (what
//    THREE does), back to sRGB, HSL, sector. A world with a warm ramp reaches
//    the warm words by itself and no table needs editing.
//
//    The ramp is PASSED IN, not imported — a hex literal here would be a second
//    copy of a design token, which is exactly the drift N16 exists to stop.
//    Without `ctx.palette` there is no colour slot at all; the layer emits from
//    the other three. Faking it would be worse than omitting it.
//
//    Consequence for §3.2's `pale`/`dusky`: with a real colour in hand these come
//    from MEASURED SATURATION, which is what §3.2 asks for, rather than from
//    `hueVariance` (which is the accent offset and has nothing to do with it).
//
// 2. M3's FIVE-SYLLABLE LIMIT CONTRADICTS §2's OWN EXAMPLES. "Gauder's greater
//    rowing whipfoot" is six. Three of the four examples fit five and that one
//    does not, so the budget here is SIX — the smallest number consistent with
//    the document's own output. It is a real constraint, not a formality: it is
//    what stops `dusky indigo hundredfoot`, and when two modifiers do not fit
//    the layer emits one rather than truncating a word.
//
// 3. M5 BANS `-y` OUTRIGHT AND §3.3 SHIPS `glossy`. `-y` is banned as a
//    DIMINUTIVE (`-ling`, `-kin`, `-ie` are the unambiguous ones); adjectival
//    `-y` is not what M5 is defending against. `glossy` stays, and the gate
//    asserts it is the ONLY `-y` word in any pool, so `spotty` or `stripey`
//    could never arrive quietly.
//
// ── NOT BUILT, DELIBERATELY ────────────────────────────────────────────────
//
// §3.5's `false` and §3.6's possessive both need a GENOME_V bump: naming.js:214
// records that author citations (13 §8) and recombination scars (13 §10) are
// absent, and there is nothing here to read. They are additive later. VN-9 and
// VN-11 are registered PENDING with that reason rather than faked, because a
// possessive drawn from a hash of the genome would be a lie about provenance.
//
// FR: the branch points are here (post-position, the pre-nominal rank set, head
// gender) and the head table is authored, but there is no modifier pool. §6 is
// explicit that a half-translated name must never be shown, so `lang: 'fr'`
// returns the binomial. Adding FR means filling POOLS.fr — nothing else.

import { binomial, signature, NAMING } from './naming.js';

/* ═══════════════════════════════════════════════════════════════════════════
 * 1 · POOLS
 *
 * Every word carries its own syllable count. A general English syllabifier gets
 * `veined` (1) and `marbled` (2) wrong in opposite directions, and a curated
 * 68-word vocabulary does not need one — the count is data, and the gate checks
 * that every word has one rather than trusting a heuristic.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** 14 §3.1 — one head per family, in FAMILIES order. The anchor of the layer. */
const HEADS_EN = {
  Brachypodidae: ['stubfoot', 2],
  Dolichopodidae: ['whipfoot', 2],
  Stenosomatidae: ['ribbonback', 3],
  Myriarthridae: ['hundredfoot', 3],
  Camphyloscelidae: ['crookleg', 2],
  Plagiocaudidae: ['slanttail', 2],
  Loxonotidae: ['wryback', 2],
  Scoliorhachidae: ['twistspine', 2],
  Nereidae: ['starfoot', 2],
  Proteidae: ['sunwheel', 2],
  Thetidae: ['crownbeast', 2],
  Hydridae: ['spokebeast', 2],
  Boreadidae: ['pinwheel', 2],
  Echoidae: ['fanback', 2],
  Lethaeidae: ['ringwalker', 3],
  Charontidae: ['sunburst', 2],
  Amorphidae: ['knuckle', 2],
  Physaridae: ['bloatfoot', 2],
  Plasmatidae: ['sprawler', 2],
  Chaomatidae: ['tanglebeast', 3],
  Atactidae: ['oddfoot', 2],
  Sphalmatidae: ['stumbler', 2],
  Anomalidae: ['snarlback', 2],
  Teratidae: ['briarbeast', 3],
};

/**
 * 14 §3.1 FR heads with grammatical gender — a BRANCH POINT, not a pool. §11.1
 * already flags several of these as weak drafts wanting a native ear. They are
 * carried so the gender machinery has something to agree with the day the
 * modifier pool is authored; until then `hasPool('fr')` is false and §6's
 * fallback fires.
 */
const HEADS_FR = {
  Brachypodidae: ['pied-court', 'm'], Dolichopodidae: ['pied-fouet', 'm'],
  Stenosomatidae: ['dos-ruban', 'm'], Myriarthridae: ['cent-pattes', 'm'],
  Camphyloscelidae: ['jambe-torse', 'f'], Plagiocaudidae: ['queue-oblique', 'f'],
  Loxonotidae: ['dos-tordu', 'm'], Scoliorhachidae: ['échine-vrille', 'f'],
  Nereidae: ['pied-étoile', 'm'], Proteidae: ['roue-soleil', 'f'],
  Thetidae: ['bête-couronne', 'f'], Hydridae: ['bête-rayon', 'f'],
  Boreadidae: ['tourniquet', 'm'], Echoidae: ['dos-éventail', 'm'],
  Lethaeidae: ['marcheur-anneau', 'm'], Charontidae: ['éclat-soleil', 'm'],
  Amorphidae: ['phalange', 'f'], Physaridae: ['pied-enflé', 'm'],
  Plasmatidae: ['vautré', 'm'], Chaomatidae: ['bête-enchevêtrée', 'f'],
  Atactidae: ['pied-bancal', 'm'], Sphalmatidae: ['trébucheur', 'm'],
  Anomalidae: ['dos-noué', 'm'], Teratidae: ['bête-ronce', 'f'],
};

/**
 * 14 §3.2 — nine hue sectors, two of them split on value, plus `pearl` for
 * anything too light or too grey to have a hue. Twelve words, and unlike a flat
 * twelve-way split of the circle every boundary here is where the English word
 * actually changes.
 */
const COLOUR_EN = {
  scarlet: 2, rust: 1, amber: 2, ochre: 2, olive: 2, jade: 1,
  teal: 1, azure: 2, indigo: 3, violet: 2, rose: 1, pearl: 1,
};
const COLOUR_PREFIX_EN = { pale: 1, dusky: 2 };

/** 14 §3.3. `glossy` is the one adjectival `-y`; see the header note on M5. */
const PATTERN_EN = {
  banded: 2, spotted: 2, marbled: 2, mottled: 2,
  striped: 1, veined: 1, glossy: 2, plain: 1,
};

/** 14 §3.4 — the most valuable pool in the document, and invisible to naming.js. */
const GAIT_EN = {
  creeping: 2, darting: 2, rowing: 2, whirling: 2, drifting: 2,
  pulsing: 2, lurching: 2, gliding: 2, tumbling: 2, sculling: 2,
};

/** 14 §3.5 minus `false`, which needs a recombination scar to read (13 §10). */
const RANK_EN = { lesser: 2, greater: 2, common: 2, dwarf: 1, giant: 2, true: 1 };

const POOLS = {
  en: { head: HEADS_EN, colour: COLOUR_EN, colourPrefix: COLOUR_PREFIX_EN, pattern: PATTERN_EN, gait: GAIT_EN, rank: RANK_EN },
  fr: null,   // §6: branch points exist, pool does not. Falls back to the binomial.
};

/** §6 branch points, carried so adding a language is 68 words and one rule. */
export const GRAMMAR = {
  en: { adjectives: 'pre', agreement: false, article: 'the', possessive: (a, n) => `${a}'s ${n}` },
  fr: {
    adjectives: 'post', agreement: true, article: 'le/la',
    prenominal: new Set(['petit', 'grand', 'nain', 'géant', 'vrai', 'faux']),
    possessive: (a, n) => `le ${n} de ${a}`,
    heads: HEADS_FR,
  },
};

/** §2.1 M2 / M3. Six, not five — see note 2 in the header. */
export const MAX_MODIFIERS = 2;
export const MAX_SYLLABLES = 6;

/** §2.1 M5 — the suffixes by which this layer would become twee. */
export const BANNED_SUFFIXES = ['ling', 'kin', 'ie', 'y'];

/**
 * M5 IS A RULE ABOUT DERIVATION, NOT ABOUT LETTERS, and a literal suffix match
 * rejects five of 14's own authored words. `whirling`, `tumbling` and `sculling`
 * end in `-ling` and are present participles of `whirl`, `tumble` and `scull` —
 * §3.4 authors the entire gait pool that way, so the ending is INFLECTION and
 * carries no diminutive sense at all. `dusky` and `glossy` are adjectival `-y`:
 * quality, not smallness.
 *
 * Every entry carries its reason, on gate/trunk.js's rule that an exception
 * without one is a silent waiver. This is the list that has to be edited before
 * `duckling`, `spotty` or `mannikin` could enter a pool — which is the whole
 * point of M5 and is what VN-6 actually tests.
 */
export const M5_EXCEPTIONS = {
  whirling: 'present participle of `whirl` — §3.4 authors the gait pool as participles',
  tumbling: 'present participle of `tumble`',
  sculling: 'present participle of `scull`',
  dusky: 'adjectival -y: quality, not smallness (§3.2)',
  glossy: 'adjectival -y: quality, not smallness (§3.3)',
};

/** §4 — the emitted order when two modifiers survive. English is not free here. */
export const SLOT_ORDER = ['rank', 'pattern', 'colour', 'gait'];

/* ═══════════════════════════════════════════════════════════════════════════
 * 2 · COLOUR, FROM THE RAMP THE ANIMAL ACTUALLY WEARS
 *
 * A faithful re-implementation of render/creature.js `colourFrom`, in plain
 * arithmetic. THREE parses a hex as sRGB, converts into the linear working
 * space, lerps THERE, and `getHSL` converts back to sRGB — doing the lerp in
 * gamma space shifts mid-ramp colours enough to move a sector boundary, so the
 * conversions are carried rather than skipped.
 * ═══════════════════════════════════════════════════════════════════════════ */

const BONE_STOP = 3;            // creature.js: the near-white stop luminous draws skip

const srgbToLinear = (c) => (c < 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (c) => (c < 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

function parseHex(hex) {
  const s = String(hex).replace('#', '');
  const n = s.length === 3
    ? parseInt(s[0] + s[0] + s[1] + s[1] + s[2] + s[2], 16)
    : parseInt(s.slice(0, 6), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map(srgbToLinear);
}

function rgbToHsl([r, g, b]) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return { h: 0, s: 0, l };
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (mx === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h, s, l };
}

/**
 * @param {number[][]} stops  linear-RGB ramp, 6 entries
 * @param {number} hue        the gene, 0..1, wraps
 * @param {boolean} avoidBone luminous draws skip the near-white stop
 * @returns HSL of the sRGB colour the creature is painted
 */
function rampColour(stops, hue, avoidBone) {
  const use = avoidBone ? stops.filter((_, i) => i !== BONE_STOP) : stops;
  const n = use.length;
  const h = ((hue % 1) + 1) % 1;
  const f = h * n, i0 = Math.floor(f) % n, t = f - Math.floor(f);
  const a = use[i0], b = use[(i0 + 1) % n];
  const lin = [0, 1, 2].map((k) => a[k] + (b[k] - a[k]) * t);
  const hsl = rgbToHsl(lin.map(linearToSrgb));
  // creature.js pushes chroma by 1.18 for the base colour: bright water
  // desaturates hard through ACES. It moves `pale` back off some stops, so it is
  // carried rather than dropped.
  return { ...hsl, s: Math.min(0.9, hsl.s * 1.18) };
}

/**
 * Nine sectors, hue in degrees. Two of them split on value, which is where
 * `rust` and `ochre` live — they are not hues of their own, they are dark
 * scarlet and dark amber, and treating them as sectors puts a boundary in the
 * middle of a word.
 */
function colourWord({ h, s, l }) {
  if (l > 0.80 || s < 0.14) return 'pearl';
  const deg = h * 360;
  const dark = l < 0.42 || s < 0.42;
  if (deg < 20 || deg >= 345) return dark ? 'rust' : 'scarlet';
  if (deg < 45) return dark ? 'ochre' : 'amber';
  if (deg < 75) return 'olive';
  if (deg < 150) return 'jade';
  if (deg < 195) return 'teal';
  if (deg < 238) return 'azure';
  if (deg < 275) return 'indigo';
  if (deg < 320) return 'violet';
  return 'rose';
}

/** §3.2 — measured saturation, not `hueVariance`. Part of the colour modifier. */
function colourPrefix({ s, l }, word) {
  if (word === 'pearl') return null;
  if (s >= 0.38) return null;
  return l >= 0.50 ? 'pale' : 'dusky';
}

/** Ramps arrive as hex from a design token; parsed once per distinct ramp. */
const rampCache = new Map();
function paletteOf(ctx) {
  const p = ctx?.palette;
  if (!p || !Array.isArray(p.stops) || p.stops.length < 2) return null;
  const key = p.stops.join('|');
  let stops = rampCache.get(key);
  if (!stops) { stops = p.stops.map(parseHex); rampCache.set(key, stops); }
  return { stops, lumThreshold: Number.isFinite(p.lumThreshold) ? p.lumThreshold : Infinity };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3 · PATTERN AND GAIT
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 14 §3.3, read against what generateMaps (creature.js:134) actually draws.
 *
 * `stripeAnisotropy` weights a v-sinusoid against a u-sinusoid, so high
 * anisotropy IS bands; `patternScale` sets their count, so coarse is `banded`
 * and fine is `striped`. Low anisotropy leaves the diagonal term and the hash,
 * which is blotch: `mottled` coarse, `spotted` fine. The middle carries both and
 * is `marbled` / `veined`. Every word is a claim about the texture that ships.
 */
function patternWord(m) {
  const contrast = m.patternContrast ?? 0.4;
  const scale = m.patternScale ?? 1;
  const aniso = m.stripeAnisotropy ?? 0.5;
  const irid = m.iridescence ?? 0;
  // §3.3: `plain` only when contrast is genuinely low. Below this the pattern
  // amplitude (contrast * 1.8, clamped) is under a fifth and nothing is visible.
  if (contrast < 0.11) return irid > 0.55 ? 'glossy' : 'plain';
  if (irid > 0.72 && contrast < 0.30) return 'glossy';
  const fine = scale >= 2.6;
  if (aniso >= 0.62) return fine ? 'striped' : 'banded';
  if (aniso >= 0.33) return fine ? 'veined' : 'marbled';
  return fine ? 'spotted' : 'mottled';
}

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

/**
 * 14 §3.4 — coordination x rate, with amplitude choosing intensity inside the
 * cell. The primary axis is `phaseBase`, the A3 gradient: a constant lag along a
 * chain IS a travelling wave (genome.js:41), a lag near zero is every joint
 * moving together, and a lag near pi is antiphase. That distinction is the
 * difference between a jellyfish and an eel and the binomial cannot see it.
 */
const GAIT_TABLE = {
  //            slow                mid                  fast
  sync: [['drifting', 'pulsing'], ['pulsing', 'lurching'], ['darting', 'darting']],
  wave: [['creeping', 'creeping'], ['sculling', 'rowing'], ['gliding', 'rowing']],
  anti: [['drifting', 'lurching'], ['sculling', 'tumbling'], ['whirling', 'whirling']],
};

function gaitWord(genome) {
  const c = genome.controller;
  const jg = Object.values(c.jointGenes ?? {});
  const amp = mean(jg.map((g) => g.amplitude));
  const fm = jg.length ? mean(jg.map((g) => g.freqMult)) : 1;
  const f = c.omega * fm;                       // rad/s, the rate you see
  const lag = Math.abs(c.phaseBase ?? 0);

  const coord = lag < Math.PI / 3 ? 'sync' : lag < (2 * Math.PI) / 3 ? 'wave' : 'anti';
  const rate = f < 2.2 ? 0 : f < 5.0 ? 1 : 2;
  const strong = amp >= 0.5 ? 1 : 0;
  return GAIT_TABLE[coord][rate][strong];
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4 · RANK
 *
 * §11.3 leaves `dwarf`/`giant` open between absolute and lineage-relative.
 * LINEAGE-RELATIVE is taken, per §11.3's own recommendation and for consistency
 * with 13 §9. `ctx.lineage.stats` supplies the lineage's own quantiles; without
 * one these corpus constants stand in.
 *
 * THE REFERENCE IS QUANTILES, NOT MEDIAN-AND-SPREAD, and that is not a stylistic
 * choice. `traits.size` is clamped to [0,1]; naming.js's reference for it
 * (median 0.322, p10-p90 spread 0.664) is stale against the A2 generator, whose
 * measured median is 0.597 — and a +/-1-spread threshold on top of it lands at
 * 1.35 and -0.15, both OUTSIDE the range the trait can take. Measured over 4000
 * draws: `dwarf` was UNREACHABLE and 24% of the corpus came out `giant`. A
 * quantile pair cannot fail that way whatever the distribution does.
 * Re-measure with tools/_vnprior.mjs when the generator moves.
 * ═══════════════════════════════════════════════════════════════════════════ */

const REF = {
  size: { lo: 2.498, hi: 12.212 },         // p10 / p90, metres — tools/_vnprior.mjs, n=4000
  extremity: { lo: 1.000, hi: 4.000 },     // p25 / p75
};

/**
 * NOT `signature.traits.size`. That trait is `clamp01((radius - 0.5) / 8)` and
 * SATURATES: measured, 24% of the corpus sits at exactly 1.0, so no threshold
 * can separate the large from the enormous and `giant` named a quarter of
 * everything. The bounding radius itself is unbounded and orders correctly.
 * Same formula as naming.js's `radius`, in metres.
 */
export function bodyRadius(plan) {
  return Math.max(...plan.bodies.map((b) =>
    Math.hypot(b.position[0], b.position[1], b.position[2]) + Math.max(...b.dims) * 0.5));
}

function rankWord(radius, bino, stats) {
  if (bino.channel === 'tautonym') return 'true';   // §3.5, and VN-10
  const size = stats?.size ?? REF.size;
  const ext = stats?.extremity ?? REF.extremity;
  if (radius <= size.lo) return 'dwarf';
  if (radius >= size.hi) return 'giant';
  if (bino.extremity <= ext.lo) return 'lesser';
  if (bino.extremity >= ext.hi) return 'greater';
  return 'common';
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5 · SLOT SCORING — 14 §4, and the only part that can silently not work
 *
 * "Scored by how much it discriminates WITHIN THE CURRENT LINEAGE." Every slot
 * here is CATEGORICAL, so the honest measure of discrimination is surprisal:
 * -log2 p(word). A slot whose word every creature in the lineage already wears
 * carries no information and scores ~0; a rare word scores high. That is what
 * makes the layer self-tune — in a lineage of uniform teal, colour stops being
 * mentioned and gait takes over, with no rule saying so.
 *
 * The lineage count is smoothed toward a PRIOR with k pseudo-counts, so the
 * formula degenerates gracefully: with no lineage it is pure prior surprisal,
 * which still names the globally unusual thing about the animal.
 *
 * The prior for pattern, gait and rank is MEASURED over the SLICE_LIMITS corpus
 * (tools/vnprior.mjs), on naming.js's principle that a reference constant is
 * measured and re-measurable, never guessed. The COLOUR prior cannot be a
 * constant — it depends on the world's ramp — so it is computed FROM the ramp by
 * sampling the hue gene uniformly, which is exact for any world and needs no
 * table.
 *
 * VN-15 is the assertion that tests this. If scoring is wrong the layer still
 * produces grammatical names; it just names the same uninformative axis every
 * time, and nothing else in the suite would notice.
 * ═══════════════════════════════════════════════════════════════════════════ */

const PRIOR_K = 4;
const PRIOR_FLOOR = 1 / 4096;

/**
 * MEASURED: tools/_vnprior.mjs, 4000 SLICE_LIMITS genomes, the A2/A5 generator.
 * Re-measure when the factory moves — these are constants of the CURRENT
 * generator exactly as naming.js's AXES are, and the gate prints the live
 * distribution every run so drift is visible rather than silent.
 *
 * `true` is UNREACHED in 4000 random draws and that is correct, not a hole: a
 * tautonym needs `veryTypical` and then wins a 0.005-weight channel (naming.js
 * :475). It is a rare event marker, and the floor is what scores it.
 */
const PRIOR = {
  pattern: { striped: 0.236, spotted: 0.196, veined: 0.177, glossy: 0.104, banded: 0.087, mottled: 0.077, marbled: 0.068, plain: 0.056 },
  gait: { sculling: 0.164, pulsing: 0.141, lurching: 0.140, rowing: 0.118, creeping: 0.102, drifting: 0.101, tumbling: 0.086, darting: 0.060, whirling: 0.056, gliding: 0.033 },
  rank: { common: 0.293, greater: 0.276, lesser: 0.171, dwarf: 0.169, giant: 0.090, true: 0.001 },
};

const colourPriorCache = new Map();
function colourPrior(pal) {
  const key = pal.stops.map((s) => s.join(',')).join('|');
  let p = colourPriorCache.get(key);
  if (p) return p;
  // The gene is uniform on [0,1); 192 samples resolve a sector boundary to
  // better than a thousandth of the range, which is far finer than the counts
  // this prior is ever weighed against.
  const N = 192, counts = {};
  for (let i = 0; i < N; i++) {
    const w = colourWord(rampColour(pal.stops, (i + 0.5) / N, false));
    counts[w] = (counts[w] ?? 0) + 1;
  }
  p = {};
  for (const [w, c] of Object.entries(counts)) p[w] = c / N;
  colourPriorCache.set(key, p);
  return p;
}

/**
 * RARE IS NOT THE SAME AS INFORMATIVE, and `plain` is where the two come apart.
 * It is the rarest pattern word in the corpus, so surprisal scores it high — and
 * §3.3 is explicit that it "usually loses the draw to another slot", because a
 * name should not spend a modifier saying nothing. Caught by reading output:
 * `the plain pulsing whipfoot` and `the plain rowing spokebeast` both appeared
 * in the first forty draws. The multiplier keeps it reachable for a creature
 * with nothing else to say and stops it winning on scarcity alone.
 */
const DEMOTE = { plain: 0.35 };

function surprisal(word, counts, total, prior) {
  const p0 = Math.max(prior?.[word] ?? 0, PRIOR_FLOOR);
  const p = ((counts?.[word] ?? 0) + PRIOR_K * p0) / (total + PRIOR_K);
  return -Math.log2(Math.min(1, Math.max(PRIOR_FLOOR, p))) * (DEMOTE[word] ?? 1);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6 · THE NAME
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Every slot's word, scored, whether or not it is emitted. Exported because the
 * lineage statistics are built out of these and because the gate needs to see
 * the slots the assembler chose between, not only the two that survived.
 */
export function slotsOf(plan, genome, ctx = {}) {
  const bino = ctx.binomial ?? binomial(plan, genome, ctx);
  const sig = bino.signature ?? signature(plan, genome);
  const pal = paletteOf(ctx);

  const radius = bodyRadius(plan);
  const out = {
    rank: rankWord(radius, bino, ctx.lineage?.stats),
    pattern: patternWord(genome.material),
    gait: gaitWord(genome),
    colour: null, colourPrefix: null,
  };
  if (pal) {
    const luminous = (genome.material.iridescence ?? 0) > pal.lumThreshold;
    const hsl = rampColour(pal.stops, genome.material.hue, luminous);
    out.colour = colourWord(hsl);
    out.colourPrefix = colourPrefix(hsl, out.colour);
  }
  return { words: out, binomial: bino, signature: sig, palette: pal, radius };
}

const quantile = (a, p) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(p * (a.length - 1))] : 0);

/**
 * Fold a lineage into what §4 scores against: word counts per slot, and the
 * size/extremity quantiles `rankWord` reads. `samples` is whatever `slotsOf`
 * returned for the specimens already in the lineage — the caller decides what
 * "lineage" MEANS (an Atlas, a tank, one family) and this file does not, which
 * is the same division 13 §9 draws.
 *
 * The rank word is RECOMPUTED here against the derived quantiles rather than
 * counted as it arrived. Otherwise the counts describe ranks measured against
 * the global reference while the next name is scored against the lineage's, and
 * the two disagree by exactly the amount that makes §4 interesting.
 *
 * A lineage smaller than MIN_STATS keeps the global reference: p10 of four
 * specimens is one specimen, and calling the smallest of four a `dwarf` is
 * noise, not a lineage fact.
 */
export const MIN_STATS = 8;

export function lineageFrom(samples) {
  const rows = [...samples];
  const sizes = [], exts = [];
  for (const s of rows) {
    if (Number.isFinite(s.radius)) sizes.push(s.radius);
    if (s.binomial) exts.push(s.binomial.extremity);
  }
  const stats = rows.length >= MIN_STATS && sizes.length === rows.length
    ? {
      size: { lo: quantile(sizes, 0.10), hi: quantile(sizes, 0.90) },
      extremity: { lo: quantile(exts, 0.25), hi: quantile(exts, 0.75) },
    }
    : null;

  const counts = { rank: {}, pattern: {}, colour: {}, gait: {} };
  for (const s of rows) {
    const w = { ...(s.words ?? s) };
    if (stats && s.binomial && Number.isFinite(s.radius)) w.rank = rankWord(s.radius, s.binomial, stats);
    for (const slot of SLOT_ORDER) {
      const v = w[slot];
      if (v) counts[slot][v] = (counts[slot][v] ?? 0) + 1;
    }
  }
  return { counts, total: rows.length, stats };
}

const syllablesOf = (pool, word) => pool[word] ?? 99;

/**
 * @param {object} plan
 * @param {object} genome
 * @param {object} [ctx]
 * @param {{stops:string[], lumThreshold?:number}} [ctx.palette] the world ramp;
 *        without it the colour slot does not exist (see header note 1)
 * @param {{counts:object,total:number,stats?:object}} [ctx.lineage] §4's local
 *        normalisation; without it slots are scored against the measured prior
 * @param {Set<string>} [ctx.taken] §7 — vernaculars already in this Atlas
 * @param {object} [ctx.binomial] a precomputed binomial(), to avoid recomputing
 * @param {string} [lang='en']
 * @returns {{name, display, head, modifiers, slots, words, scores, lang, fallback}}
 */
export function vernacular(plan, genome, ctx = {}, lang = 'en') {
  const pool = POOLS[lang];
  const s = slotsOf(plan, genome, ctx);

  // §6 — a language with no pool shows the binomial. NEVER a partial
  // translation: a French head noun with English modifiers is worse than Latin.
  if (!pool) {
    return {
      name: s.binomial.binomial, display: s.binomial.binomial,
      head: null, modifiers: [], slots: [], words: s.words, scores: {},
      lang, fallback: true, binomial: s.binomial.binomial,
    };
  }

  const [head, headSyl] = pool.head[s.binomial.family];
  const lin = ctx.lineage;
  const priors = { ...PRIOR };
  if (s.palette) priors.colour = colourPrior(s.palette);

  // ── score every available slot ────────────────────────────────────────────
  const scores = {};
  const avail = [];
  for (const slot of SLOT_ORDER) {
    const word = s.words[slot];
    if (!word) continue;                      // colour with no ramp
    const sc = surprisal(word, lin?.counts?.[slot], lin?.total ?? 0, priors[slot]);
    scores[slot] = sc;
    const prefix = slot === 'colour' ? s.words.colourPrefix : null;
    avail.push({
      slot, word, prefix,
      text: prefix ? `${prefix} ${word}` : word,
      syllables: syllablesOf(pool[slot], word)
        + (prefix ? syllablesOf(pool.colourPrefix, prefix) : 0),
      score: sc,
      order: SLOT_ORDER.indexOf(slot),
    });
  }

  // §4 priority 1 — `true` is a structural marker, not a draw. It is always
  // emitted and always first, so it is pinned out of the ranking rather than
  // competing in it.
  const pinned = avail.filter((a) => a.slot === 'rank' && a.word === 'true');
  const pool2 = avail.filter((a) => !pinned.includes(a));
  // Ties resolve by SLOT_ORDER so the function is total and deterministic (VN-1).
  pool2.sort((a, b) => b.score - a.score || a.order - b.order);

  // ── candidate emissions, best first ───────────────────────────────────────
  //
  // A LADDER, the same shape as naming.js's epithet ladder. §7 asks that an
  // already-used vernacular have its slots down-weighted so the generator
  // reaches for a different discriminating axis — which is exactly "try the next
  // pair down", and it keeps the name true about the animal instead of
  // manufacturing a suffix. If every rung is taken the name repeats, which §7
  // says is correct behaviour rather than a bug.
  const cands = [];
  const push = (parts) => {
    const chosen = [...pinned, ...parts].slice(0, MAX_MODIFIERS);   // M2
    const syl = headSyl + chosen.reduce((n, c) => n + c.syllables, 0);
    if (syl > MAX_SYLLABLES) return;                                 // M3
    const key = chosen.map((c) => c.slot).join(',');
    if (cands.some((c) => c.key === key)) return;
    cands.push({ key, chosen, syl });
  };
  const room = MAX_MODIFIERS - pinned.length;
  if (room >= 2) for (let i = 0; i < pool2.length; i++) for (let j = i + 1; j < pool2.length; j++) push([pool2[i], pool2[j]]);
  if (room >= 1) for (const a of pool2) push([a]);
  push([]);                                    // the head alone always fits

  const taken = ctx.taken instanceof Set ? ctx.taken : null;
  const assemble = (c) => {
    const ordered = c.chosen.slice().sort((a, b) => a.order - b.order);   // §4 fixed order
    return { ordered, name: [...ordered.map((x) => x.text), head].join(' ') };
  };
  let picked = null;
  for (const c of cands) {
    const a = assemble(c);
    if (!taken || !taken.has(a.name)) { picked = { c, ...a }; break; }
  }
  if (!picked) { const c = cands[0]; picked = { c, ...assemble(c) }; }

  return {
    name: picked.name,
    display: `${GRAMMAR[lang].article} ${picked.name}`,        // §5
    head,
    modifiers: picked.ordered.map((x) => x.text),
    slots: picked.ordered.map((x) => x.slot),
    words: s.words,
    scores,
    syllables: picked.c.syl,
    lang, fallback: false,
    binomial: s.binomial.binomial,
  };
}

/** §3.1 — the head is a pure function of family and nothing else (VN-3). */
export function headNoun(family, lang = 'en') {
  const pool = POOLS[lang];
  return pool ? (pool.head[family]?.[0] ?? null) : null;
}

export function hasPool(lang) { return Boolean(POOLS[lang]); }

/** Everything the gate reads. Exported as data so the suite cannot drift from it. */
export const VERNACULAR = {
  POOLS, HEADS_EN, HEADS_FR, COLOUR_EN, COLOUR_PREFIX_EN, PATTERN_EN, GAIT_EN, RANK_EN,
  PRIOR, REF, GAIT_TABLE, FAMILIES: NAMING.FAMILIES,
  colourWord, colourPrefix, patternWord, gaitWord, rankWord, rampColour, parseHex, colourPrior,
};
