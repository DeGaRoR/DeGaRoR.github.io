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
//
// AND FOR A CREATURE WITH NO RECORD — one swimming in the tank right now —
// ui/names.js mints from the global prior instead, which is pure and therefore
// equally stable. Between the two, every creature on every screen has exactly
// one name. That file is where to read why.

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

// `atlasContext()` USED TO LIVE HERE and it was a trap. It read EVERY specimen
// record — each carrying a 1024 px portrait inline — and ran `morphogenesis` on
// each one, to build a lineage the Vivarium then used to re-mint names that had
// already been minted. It ran on every Vivarium boot, which is every tab switch.
//
// Nothing needs it any more. The tank mints against the GLOBAL PRIOR (see
// ui/names.js for why), and the two callers that legitimately want a lineage —
// worlds/atlas_seed.js when it plants the library, and the Atlas's backfill —
// already hold the specimens they want to score against and call `lineageOf`
// directly.

/**
 * Mint a name for one creature.
 *
 * PASS NO `ctx` AND THE RESULT IS PURE — slots score against the measured global
 * prior and the candidate ladder never moves off its first choice. That is how
 * ui/names.js gets a name that is the same on every screen. Pass a lineage only
 * where the name is about to be written into a record and frozen (14 §4).
 *
 * @param {object} genome
 * @param {object} [ctx]  from lineageOf(); omit for the global prior
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

// `labelFor` is gone. It was `commonName || vernacular || binomial` with no
// `!== binomial` test, which made the stranger picker show Latin for every
// library creature while the Atlas card beside it showed the vernacular. One
// precedence order now, in ui/names.js `label()`.
