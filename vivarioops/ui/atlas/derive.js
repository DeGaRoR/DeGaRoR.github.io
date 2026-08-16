// ui/atlas/derive.js — what a specimen IS, computed once.
//
// ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────
//
// The Atlas had no way to answer "show me the segmented ones", "sort by mass",
// "which of these are Nereidae" — not because the data was missing but because
// nothing had ever put it in a shape you could ask a question of. It was forty
// records, each carrying a 1024 px portrait inline, read in full on every mount
// and rendered straight to cards.
//
// EVERYTHING BELOW IS FREE. `signature()`, `binomial()` and `slotsOf()` are pure
// functions of the plan and the genome — no simulation, no physics, no Rapier.
// They already compute a 24-value family taxon, four buckets, six finer classes,
// eighteen normalised traits and four vernacular slot words, and until now the
// app threw all of it away and kept the assembled strings.
//
// So: derive once into a flat ROW of primitives, and let every filter, sort,
// group and search read that. A row is ~400 bytes and carries NO thumb and NO
// genome, which is the entire reason the Atlas can hold hundreds of specimens.
//
// ── THE ONE RULE ─────────────────────────────────────────────────────────────
//
// This is the ONLY place engine derivation is called for the Atlas. If a facet
// or a column wants a number, it comes from a Row field, and the Row field is
// computed here. A screen that reaches past this into `engine/` is how the
// filter bar and the sort menu start disagreeing about what they are showing.
//
// It lives in `ui/` and not `engine/` because facet labels are `t()` strings and
// /engine/ may not import /trunk/ (N3).

import { t } from '../../trunk/i18n.js';
import { morphogenesis, totalMass } from '../../engine/l1/morphogen.js';
import { binomial, familySpace } from '../../engine/l1/naming.js';
import { slotsOf, bodyRadius } from '../../engine/l1/vernacular.js';
import { palette } from '../vernacular.js';
import { label } from '../names.js';
import { sensesOf } from '../senses.js';
import { PROFILE_TAG } from './profile.js';

/**
 * Stamped on the stored index and compared before it is trusted.
 *
 * BUMP THIS whenever the Row shape changes OR any upstream derivation moves —
 * `signature`, `binomial`, `slotsOf`, the family table. A row is a claim about
 * what those functions returned; if they have changed, the claim is false and
 * quietly sorting on it would be worse than rebuilding.
 */
export const INDEX_TAG = 'ix4';   // ix4: the perception state

/** The 18 normalised trait axes, in the order `signature()` produces them. */
export const TRAIT_KEYS = [
  'amplitude', 'segmentRun', 'branching', 'limbs', 'rootShare', 'slenderness',
  'omega', 'density', 'flatness', 'breadth', 'reflections', 'phaseLag',
  'size', 'jointDensity', 'dofShare', 'bias', 'freqMult', 'angleRange',
];

/**
 * One specimen, flattened.
 *
 * A row NEVER carries `thumb` or `genome`. The portrait is fetched lazily by key
 * (see index.js `thumbFor`) and the genome is read only when something actually
 * needs to simulate or release it. Putting either on the row would defeat the
 * only thing the row is for.
 *
 * @param {string} key   the `specimen:` store key
 * @param {object} spec  the stored record
 * @returns {object|null} a Row, or null when the body will not build
 */
export function deriveRow(key, spec) {
  if (!spec?.genome) return null;
  let plan, bino, slots;
  try {
    plan = morphogenesis(spec.genome);
    bino = binomial(plan, spec.genome);
    // No lineage and no `taken`: a row is a FACT about the animal, and a fact
    // that changed as its neighbours changed would make sorting non-deterministic.
    // Lineage-relative naming happens once, at plant/backfill time, and is read
    // off the record below rather than recomputed.
    slots = slotsOf(plan, spec.genome, {
      palette: palette(spec.worldId ?? 'w1'), binomial: bino,
    });
  } catch { return null; }

  const w = slots.words;
  const origin = spec.genome.origin ?? {};
  const name = label(spec).primary;

  // THREE STATES, NOT TWO, and collapsing them would lose the honest one.
  // `none` — never measured, or measured by a build this one does not trust
  //          (PROFILE_TAG mismatch); the card says "measuring…".
  // `bad`  — measured, and the creature CAME APART. ROADMAP §5b lesson 3: a
  //          disintegrating body reports fictional intake (7864 g against
  //          rivals' 31-49), so its numbers must never be shown as numbers.
  // `ok`   — a measurement this build stands behind.
  const fresh = spec.profile?.tag === PROFILE_TAG;
  const p = fresh && spec.profile.valid ? spec.profile : null;
  const profileState = !fresh ? 'none' : (spec.profile.valid ? 'ok' : 'bad');

  const row = {
    // ── identity ──────────────────────────────────────────────────────────
    key,
    hash: spec.hash ?? key.slice('specimen:'.length),
    createdAt: spec.createdAt ?? 0,
    worldId: spec.worldId ?? 'w1',
    source: spec.source ?? 'player',
    // The shelf a library creature came off, once atlas_seed carries it. Absent
    // on every record written before that, hence the null rather than a guess.
    shelf: spec.meta?.shelf ?? null,
    sourceId: spec.meta?.sourceId ?? null,
    niche: spec.meta?.niche ?? null,
    canonCm: spec.meta?.canonCm ?? null,

    // ── names, as the card will actually print them ───────────────────────
    name,
    binomial: bino.binomial,
    family: bino.family,
    genus: bino.genus,
    species: bino.species,
    extremity: bino.extremity,
    // `rankWord` reads BOTH of these off a sample, not just extremity — see
    // engine/l1/vernacular.js:387. Storing one and not the other would make
    // `sampleFromRow` silently wrong for every tautonym.
    channel: bino.channel,
    headline: spec.headline ?? null,
    note: spec.note ?? null,

    // ── taxonomy, the ready-made facets ───────────────────────────────────
    seg: bino.signature.segmentBucket,
    sym: bino.signature.symmetry,
    limb: bino.signature.limbBucket,
    depthB: bino.signature.depthBucket,
    maxDepth: bino.signature.maxDepth,
    longestRun: bino.signature.longestRun,
    mirrored: bino.signature.mirrored,

    // ── the vernacular slot words, four more facets for free ──────────────
    rank: w.rank ?? null,
    pattern: w.pattern ?? null,
    gait: w.gait ?? null,
    colour: w.colour ?? null,
    colourPrefix: w.colourPrefix ?? null,

    // ── morphometrics ─────────────────────────────────────────────────────
    bodies: plan.bodyCount,
    joints: plan.jointCount,
    dof: plan.dofCount,
    receptors: plan.receptors?.length ?? 0,
    // The whole perception state, not just the organ count — a creature with
    // receptors may be unwired, may be wired but one-sided and therefore unable
    // to take a differential, or may genuinely steer. See ui/senses.js.
    senses: sensesOf(plan, spec.genome),
    mass: spec.stats?.mass ?? totalMass(plan),
    radius: slots.radius ?? bodyRadius(plan),

    // ── ancestry ──────────────────────────────────────────────────────────
    founder: origin.founder ?? null,
    generations: origin.generations ?? 0,
    // ── THE BREEDING RUN THIS CAME OUT OF ─────────────────────────────────
    //
    // Stamped at save time (ui/screens/vivarium.js), so it is a fact about when
    // the creature appeared rather than a live lookup into a lineage that may
    // since have been renamed or thrown away. `sessionLabel` is what the facet
    // groups on: the title when the run was named, and the seed otherwise —
    // because an unnamed run is still a run, and creatures from one afternoon
    // belong together whether or not anybody typed a heading.
    sessionId: spec.session?.id ?? null,
    sessionTitle: spec.session?.title ?? null,
    sessionGen: spec.session?.generation ?? null,
    sessionLabel: spec.session?.id == null ? null
      : (spec.session.title || `${t('run')} ${String(spec.session.id).slice(0, 6)}`),
    // `[]` means RECORDED AND NONE; `null` means never recorded. The Atlas has
    // to be able to tell those apart or it will draw an empty tree for every
    // creature saved before edges existed and call it a fact.
    parents: spec.parents ?? null,

    // ── player annotation ─────────────────────────────────────────────────
    labels: spec.labels ?? [],

    // ── freshness and measurement ─────────────────────────────────────────
    render: spec.render ?? null,
    hasVernacular: Boolean(spec.vernacular),
    profileState,
    profile: p ? {
      fps: p.foodPerSecond, mult: p.multiplier, straight: p.straightness,
      turn: p.turnCapability ?? null,
    } : null,

    traits: { ...bino.signature.traits },
  };

  // Precomputed so a keystroke costs one `includes` per row rather than eight
  // string concatenations per row.
  row.hay = [
    row.name, row.binomial, row.family, row.genus, row.species,
    row.colour, row.pattern, row.gait, row.rank, row.founder, row.niche,
    row.headline, row.shelf, row.sessionLabel, ...row.labels,
  ].filter(Boolean).join(' ').toLowerCase();

  return row;
}

/**
 * A row, in the shape `lineageFrom()` folds.
 *
 * THIS IS WHAT LETS `atlasContext`-style naming STOP READING RECORDS. The engine
 * needs exactly three things per sample — the slot words, the binomial's
 * `channel` and `extremity`, and the body radius — and the row carries all
 * three. Building a lineage used to mean `morphogenesis` over every stored
 * specimen; it is now a map over primitives.
 */
export function sampleFromRow(row) {
  return {
    words: {
      rank: row.rank, pattern: row.pattern, gait: row.gait,
      colour: row.colour, colourPrefix: row.colourPrefix,
    },
    binomial: { channel: row.channel, extremity: row.extremity },
    radius: row.radius,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// THE FACET TABLE
// ═══════════════════════════════════════════════════════════════════════════
//
// ONE declaration, read by the filter sheet, the chip row, the group menu and
// the query evaluator. Four surfaces asking the same table is what stops them
// offering different answers to "what can I filter on".
//
// `values` returns the values PRESENT in the corpus, not the theoretical space —
// a filter sheet offering 24 families when the store holds 9 is a sheet you have
// to read to discover it is mostly empty. `familySpace()` is used only to order
// them, so the list is stable rather than sorted by whatever arrived first.

const FAMILY_ORDER = new Map(familySpace().map((f, i) => [f, i]));

const present = (field, order) => (rows) => {
  const seen = new Set();
  for (const r of rows) if (r[field] != null) seen.add(r[field]);
  const out = [...seen];
  if (order) out.sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99));
  else out.sort();
  return out;
};

const ordered = (field, seq) => (rows) => {
  const seen = new Set();
  for (const r of rows) if (r[field] != null) seen.add(r[field]);
  return seq.filter((v) => seen.has(v));
};

export const FACETS = [
  {
    id: 'family', label: t('Family'), field: 'family',
    values: present('family', FAMILY_ORDER), labelOf: (v) => v,
  },
  {
    id: 'sym', label: t('Symmetry'), field: 'sym',
    values: ordered('sym', ['plano', 'actino', 'ataxo']),
    labelOf: (v) => ({ plano: t('bilateral'), actino: t('radial'), ataxo: t('asymmetric') }[v] ?? v),
  },
  {
    id: 'seg', label: t('Segments'), field: 'seg',
    values: ordered('seg', ['oligo', 'meso', 'poly', 'myria']),
    labelOf: (v) => ({ oligo: t('1–3'), meso: t('4–7'), poly: t('8–14'), myria: t('15+') }[v] ?? v),
  },
  {
    id: 'limb', label: t('Limbs'), field: 'limb',
    values: ordered('limb', ['apod', 'brachy', 'poly']),
    labelOf: (v) => ({ apod: t('none'), brachy: t('few'), poly: t('many') }[v] ?? v),
  },
  {
    id: 'gait', label: t('Gait'), field: 'gait',
    values: present('gait'), labelOf: (v) => v,
  },
  {
    id: 'colour', label: t('Colour'), field: 'colour',
    values: present('colour'), labelOf: (v) => v,
  },
  {
    id: 'pattern', label: t('Pattern'), field: 'pattern',
    values: present('pattern'), labelOf: (v) => v,
  },
  {
    id: 'source', label: t('Provenance'), field: 'source',
    values: ordered('source', ['player', 'authored']),
    labelOf: (v) => (v === 'authored' ? t('From the library') : t('Bred by you')),
  },
  {
    // The six shelves, in the order `authoredList()` walks them, which is the
    // order they are meant to be read in: hand-written seeds, then found, then
    // the owner's own stock, then the offline programme's output, then promoted
    // player creatures, then the frozen residents.
    id: 'shelf', label: t('Shelf'), field: 'shelf',
    values: ordered('shelf', ['seeds', 'curated', 'reef', 'bred', 'spines', 'player', 'residents']),
    labelOf: (v) => ({
      seeds: t('hand-written'), curated: t('found and selected'), reef: t('bred by the owner'),
      bred: t('offline programme'), spines: t('drawn segmented'), player: t('promoted from play'),
      residents: t('world residents'),
    }[v] ?? v),
  },
  {
    // WHAT A CHAMPION IS A CHAMPION AT. The single most useful facet on the
    // shelf, and until now it was computed by tools/_zchampions.mjs, written
    // into worlds/w1_bred.js, and thrown away at plant time.
    id: 'niche', label: t('Selected for'), field: 'niche',
    values: present('niche'), labelOf: (v) => v,
  },
  {
    // "Show me everything that came out of that run." The collection could not
    // be asked this before, because nothing recorded that a run had happened.
    id: 'session', label: t('Breeding run'), field: 'sessionLabel',
    values: present('sessionLabel'), labelOf: (v) => v,
  },
  {
    // NOT `t('Descended from')`. V2's import scan matches the word `from`
    // followed by a quote ANYWHERE in a file — comments and string literals
    // included — and would read `'), field: '` as a module specifier the import
    // map does not declare. ui/screens/vivarium.js:756 hit the same trap.
    id: 'founder', label: t('Ancestor'), field: 'founder',
    values: present('founder'),
    labelOf: (v) => v ?? t('no authored ancestor'),
  },
  {
    // MULTI-VALUED: a creature may carry several labels, so membership is an
    // `includes` rather than an equality. `applyQuery` special-cases exactly
    // this one field; everything else is scalar.
    id: 'labels', label: t('Labels'), field: 'labels', multi: true,
    values: (rows) => {
      const seen = new Set();
      for (const r of rows) for (const l of r.labels) seen.add(l);
      return [...seen].sort();
    },
    labelOf: (v) => v,
  },
];

export const FACET_BY_ID = new Map(FACETS.map((f) => [f.id, f]));

// ═══════════════════════════════════════════════════════════════════════════
// THE SORTABLE COLUMNS
// ═══════════════════════════════════════════════════════════════════════════
//
// `dir` is the direction that reads as "best first" for that column, so the sort
// menu can offer one tap rather than making the player also decide which way
// round `mass` should go.
//
// A column whose `get` returns null sorts LAST regardless of direction — an
// unmeasured creature is not the worst forager, it is an unknown, and burying it
// at the bottom of an ascending sort would claim otherwise.

export const COLUMNS = [
  { id: 'createdAt', label: t('Recent'), dir: -1, get: (r) => r.createdAt, fmt: null },
  { id: 'name', label: t('Name'), dir: 1, get: (r) => r.name, text: true },
  { id: 'binomial', label: t('Binomial'), dir: 1, get: (r) => r.binomial, text: true },
  { id: 'family', label: t('Family'), dir: 1, get: (r) => r.family, text: true },
  { id: 'mass', label: t('Size'), dir: -1, get: (r) => r.mass, fmt: (v) => `${v.toFixed(2)} g` },
  { id: 'bodies', label: t('Bodies'), dir: -1, get: (r) => r.bodies, fmt: (v) => `${v}` },
  { id: 'joints', label: t('Joints'), dir: -1, get: (r) => r.joints, fmt: (v) => `${v}` },
  // `measured: true` marks a column that COSTS A SIMULATION. Sorting on one of
  // these means some rows have no value at all, so the bar says how many — see
  // ui/atlas/bar.js. Without the flag the only way to ask was to probe `get`
  // with a fake row, which is a test of the implementation rather than a
  // statement about the column.
  {
    id: 'fps', label: t('Food'), dir: -1, measured: true, get: (r) => r.profile?.fps ?? null,
    fmt: (v) => `${(1000 * v).toFixed(0)} mg/s`,
  },
  {
    id: 'mult', label: t('Ledger'), dir: -1, measured: true, get: (r) => r.profile?.mult ?? null,
    fmt: (v) => (v < 10 ? `${v.toFixed(1)}×` : v < 1000 ? `${v.toFixed(0)}×` : `${(v / 1000).toFixed(1)}k×`),
  },
  {
    id: 'straight', label: t('Straightness'), dir: -1, measured: true,
    get: (r) => r.profile?.straight ?? null, fmt: (v) => v.toFixed(2),
  },
  {
    id: 'turn', label: t('Turn'), dir: -1, measured: true, get: (r) => r.profile?.turn ?? null,
    fmt: (v) => `${v.toFixed(1)}°/s`,
  },
  { id: 'generations', label: t('Generations'), dir: -1, get: (r) => r.generations, fmt: (v) => `${v}` },
  // THE ONLY BEHAVIOURAL NUMBER ON THE SHELF, and the one design/15-BREEDING.md
  // §1.4 actually validated. `turnCapability` — which the card shows as TURN —
  // measured at Spearman -0.152 against arriving at a beacon; `canonCm` is how
  // close the animal genuinely got. Only the offline champions carry it, so most
  // rows sort last here, which is honest: nobody measured the rest.
  {
    id: 'canonCm', label: t('Beacon'), dir: 1, measured: true,
    get: (r) => r.canonCm, fmt: (v) => `${v.toFixed(2)} cm`,
  },
  { id: 'extremity', label: t('Unusualness'), dir: -1, get: (r) => r.extremity, fmt: (v) => v.toFixed(2) },
];

export const COLUMN_BY_ID = new Map(COLUMNS.map((c) => [c.id, c]));
