// ui/vernacular.js — the app's side of the common-name layer.
//
// engine/l1/vernacular.js is pure over (plan, genome, ctx, lang). Two things it
// cannot get for itself live here:
//
//   the PALETTE — the colour word is derived from the ramp the animal is
//   actually painted with (see that file's header), and a ramp is a design
//   token, which /engine/ may neither import (N3) nor copy (N16);
//
//   the LINEAGE — 14 §4 scores each slot by how much it discriminates within
//   the current lineage, and the lineage here is the player's Atlas. What
//   "lineage" means is deliberately the caller's decision, not the engine's.
//
// ── NAMES ARE MINTED ONCE, NOT RECOMPUTED ─────────────────────────────────
//
// This is the whole reason `vernacular` is a stored field rather than a getter.
// Slot scoring is lineage-relative by design: in a tank of teal creatures colour
// says nothing and gait takes over. So the same animal legitimately produces a
// different name as its neighbours change — which is right when you DESCRIBE it
// and intolerable afterwards. You would tap "the banded whipfoot", breed twice,
// and come back to find it called something else.
//
// So the name is written onto the specimen when it is saved, exactly as the
// binomial is, and every reader takes it from the record. 14 §7 already says the
// vernacular is not an identifier; this is what stops it being unstable either.

import { t } from '../trunk/i18n.js';
import * as store from '../trunk/store.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { binomial } from '../engine/l1/naming.js';
import { vernacular, slotsOf, lineageFrom } from '../engine/l1/vernacular.js';
import { paletteFor } from '../render/creature.js';

/** Cached per world: reading six tokens is a getComputedStyle each. */
const palettes = new Map();
export function palette(worldId = 'w1') {
  let p = palettes.get(worldId);
  if (!p) { p = paletteFor(worldId); palettes.set(worldId, p); }
  return p;
}

/**
 * Build the lineage context from a set of specimens.
 *
 * @param {Array<{genome, worldId?}>} specs
 * @returns {{lineage, taken:Set<string>}} ready to pass as ctx
 */
export function lineageOf(specs) {
  const samples = [];
  const taken = new Set();
  for (const s of specs) {
    if (!s?.genome) continue;
    try {
      const plan = morphogenesis(s.genome);
      samples.push(slotsOf(plan, s.genome, { palette: palette(s.worldId ?? 'w1') }));
    } catch { /* a body that will not build contributes nothing to the statistics */ }
    if (s.vernacular) taken.add(s.vernacular);
  }
  return { lineage: lineageFrom(samples), taken };
}

/**
 * The lineage context for the player's whole Atlas.
 *
 * A FAILURE HERE IS NOT FATAL. With no store, no lineage: the engine falls back
 * to its measured global prior and still names the globally unusual thing about
 * the animal. A name is always better than no name.
 */
export async function atlasContext() {
  try {
    const keys = await store.list('specimen:');
    const specs = [];
    for (const key of keys) {
      try { const s = await store.get(key); if (s?.genome) specs.push(s); }
      catch { /* skip a record from a future build */ }
    }
    return lineageOf(specs);
  } catch { return { lineage: undefined, taken: new Set() }; }
}

/**
 * Mint a name for one creature.
 *
 * @param {object} genome
 * @param {object} [ctx]  from atlasContext(); omit for the global prior
 * @param {string} [worldId]
 * @returns {{name, display, binomial}}  `name` is the label form (14 §5: no
 *          article), `display` takes `the`
 */
export function nameFor(genome, ctx = {}, worldId = 'w1') {
  const plan = morphogenesis(genome);
  const bino = binomial(plan, genome);
  const v = vernacular(plan, genome, {
    palette: palette(worldId), lineage: ctx.lineage, taken: ctx.taken, binomial: bino,
  });
  return { name: v.name, display: v.display, binomial: bino.binomial, fallback: v.fallback };
}

/** Best label for a creature we may or may not have a stored name for. */
export function labelFor(spec) {
  return spec?.commonName || spec?.vernacular || spec?.binomial || t('Creature');
}
