// ui/names.js — one creature, one name.
//
// ── THE BUG THIS FILE EXISTS TO KILL ─────────────────────────────────────────
//
// A card in the Atlas said one thing and the same animal in the tank said
// another. Five separate mechanisms produced that, and every one of them is a
// symptom of a single missing property: THE NAME WAS NOT A FUNCTION OF THE
// CREATURE. It was a function of (creature, what else was on screen, in what
// order, at what moment).
//
//   1. `nameCast()` re-minted a name for every creature on every spawn —
//      including one imported from the Atlas thirty seconds earlier.
//   2. `importSpecimens` copied only `s.genome`; the name was left behind.
//   3. Slot scoring is lineage-relative (14 §4), and three different callers
//      built three different lineages: the library, the whole Atlas, the tank.
//   4. `taken`-set suppression walks a candidate ladder, and the rung a
//      creature landed on depended on ITERATION ORDER.
//   5. `displayName` and `labelFor` were two different precedence orders for
//      the same question, on two different screens.
//
// ── THE FIX: MAKE THE MINT PURE ──────────────────────────────────────────────
//
// `vernacular()` and `binomial()` both take `lineage` and `taken` as OPTIONAL.
// Called without them, slots score against the measured global prior and the
// candidate ladder never moves off `cands[0]`. So `nameOf(genome)` is pure —
// the same string in the tank, on a row, on a card, after Reset, after Undo,
// after a reload, on another device. Mechanisms 1, 3 and 4 die together.
//
// THE PRICE, STATED: two unsaved creatures with similar bodies can now share a
// vernacular. 14 §7 ratifies exactly that ("the name repeats… that is correct
// behaviour, not a bug"), and the binomial still separates them on the sheet.
//
// LINEAGE-RELATIVE NAMING IS NOT GONE — it is preserved where it earns its
// keep, which is the moment a creature is permanently DESCRIBED into a record
// (worlds/atlas_seed.js, and the Atlas's backfill). Those names are then frozen
// forever, and tier 1 below makes them win everywhere.
//
// ── WHY A SIDE TABLE AND NOT A FIELD ON THE GENOME ───────────────────────────
//
// `canonical()` (engine/l1/genome.js:476) is a WHITELIST. A `g.name` would
// survive `genomeHash` but be silently dropped by `serialise()`, so any genome
// that round-trips through `deserialise` — the residents, the spines, a promoted
// player record — would lose it. A field that survives some paths and not others
// is worse than no field. The vernacular is also a localised UI string, and the
// genome is engine data (N3).

import { t } from '../trunk/i18n.js';
import * as store from '../trunk/store.js';
import { genomeHash } from '../engine/l1/genome.js';
import { nameFor } from './vernacular.js';

/**
 * TIER 1 — the record index. `hash -> {key, commonName, vernacular, binomial,
 * source}` for every `specimen:` in the store.
 *
 * AUTHORITATIVE. If a record exists for this genome, its stored strings win,
 * always. That single rule is what makes the tank and the Atlas card agree, and
 * it is also why mechanism 2 needs no fix: an imported genome finds its own
 * record by hash, so there is nothing for `importSpecimens` to carry across and
 * no `specKey` to thread through `provenance` (which would be lost the next
 * time an elite was re-slotted anyway — the hash join has no such hole).
 */
const records = new Map();

/**
 * TIER 2 — a memo of pure mints, for genomes with no record. `hash|worldId`.
 *
 * IT HAS NO LIFECYCLE, and that is the point. It memoises a pure function, so
 * it can be dropped at any moment without changing one displayed string. Do not
 * add seeding, clearing or invalidation to it; there is nothing to invalidate.
 */
const minted = new Map();

/** Fields worth keeping; a record also carries a 1024 px portrait we do not want. */
function slim(key, spec) {
  return {
    key,
    commonName: spec.commonName ?? null,
    vernacular: spec.vernacular ?? null,
    binomial: spec.binomial ?? null,
    source: spec.source ?? 'player',
  };
}

/**
 * Read every `specimen:` into the index.
 *
 * A FAILURE HERE IS NOT FATAL: with no index every genome falls through to the
 * pure mint, which is still stable and still identical on every screen. It just
 * stops honouring the names the player typed.
 *
 * This REPLACES `atlasContext()` at the Vivarium's boot, which ran
 * `morphogenesis` over every stored specimen to build lineage samples. This
 * reads four strings. Boot gets faster, not slower.
 */
export async function load() {
  try {
    const keys = await store.list('specimen:');
    for (const key of keys) {
      try {
        const spec = await store.get(key);
        if (spec?.hash) records.set(spec.hash, slim(key, spec));
        else if (spec?.genome) records.set(genomeHash(spec.genome), slim(key, spec));
      } catch { /* a record from a future build names nothing */ }
    }
  } catch { /* no store; the pure mint carries it */ }
}

/** Index one record — call after any write that creates or renames a specimen. */
export function remember(key, spec) {
  try {
    const hash = spec?.hash ?? (spec?.genome ? genomeHash(spec.genome) : null);
    if (hash) records.set(hash, slim(key, spec));
  } catch { /* nothing to index */ }
}

/** Drop one — call after a delete, so the name falls back to the pure mint. */
export function forget(key) {
  for (const [hash, r] of records) if (r.key === key) records.delete(hash);
}

/**
 * ── THE ONE PRECEDENCE ORDER ─────────────────────────────────────────────────
 *
 * This is the `displayName` / `labelFor` unification. Every surface asks this
 * function and no surface implements its own rule.
 *
 *   1. the player's own name, if they typed one that is not just the binomial
 *   2. the stored vernacular
 *   3. the binomial — always available, never wrong, merely unmemorable
 *
 * The `!== binomial` test in step 1 is load-bearing and was the difference
 * between the two old functions: `atlas_seed.js` writes `commonName ||
 * derivedBinomial`, so EVERY library record without an authored label has
 * `commonName === binomial`. Without the test, twenty shipped creatures show
 * Latin on one screen and their vernacular on another — which is the reported
 * bug, in miniature.
 */
export function label(spec) {
  const bino = spec?.binomial || t('Creature');
  const authored = spec?.commonName && spec.commonName !== spec.binomial ? spec.commonName : null;
  const primary = authored || spec?.vernacular || bino;
  return { primary, secondary: primary === bino ? null : bino, authored: Boolean(authored) };
}

/**
 * What this creature is called. The record wins; otherwise mint, purely.
 *
 * @param {object} genome
 * @param {object} [o]
 * @param {string} [o.worldId]
 * @returns {{primary, secondary, vernacular, binomial, commonName, key, source, authored}}
 */
export function nameOf(genome, o = {}) {
  const worldId = o.worldId ?? 'w1';
  let hash = null;
  try { hash = genomeHash(genome); } catch { /* fall through to the bare mint */ }

  const rec = hash ? records.get(hash) : null;
  if (rec) return { ...label(rec), ...rec };

  const memoKey = hash ? `${hash}|${worldId}` : null;
  let m = memoKey ? minted.get(memoKey) : null;
  if (!m) {
    try {
      // NO `lineage`, NO `taken` — see the header. This is the whole fix.
      const v = nameFor(genome, {}, worldId);
      m = { vernacular: v.name, binomial: v.binomial, commonName: null };
    } catch {
      // Naming must never be able to stop a creature appearing.
      m = { vernacular: null, binomial: null, commonName: null };
    }
    if (memoKey) minted.set(memoKey, m);
  }
  return { ...label(m), ...m, key: null, source: null };
}

/** Test seam, and the honest answer to "is the index warm yet". */
export const _internals = { records, minted };
