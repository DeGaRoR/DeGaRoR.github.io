// ui/atlas/measure.js — putting one creature through the forage trial.
//
// EXTRACTED FROM ui/screens/atlas.js the moment a second caller appeared. The
// specimen page needs a `Measure now` button, and a 180-second simulation
// protocol reimplemented in two places would drift — quietly, and in the
// direction that matters, because the two copies would then be writing
// DIFFERENT numbers under the SAME `PROFILE_TAG`. A cached measurement is a
// claim about how it was taken; two takers means the claim is not checkable.
//
// ── WHAT IT COSTS, AND WHY NOTHING CALLS IT IN BULK ──────────────────────────
//
// `forageProfile` is 180 s of simulated time — 30 s of discarded warm-up and a
// 150 s measurement window — plus an S3 turn probe, which is two more 8 s runs.
// At three hundred specimens that is roughly fifteen hours. Callers take a
// BUDGET, never a sweep, and the deliberate "measure everything" path is behind
// an explicit action with a progress readout.

import { PROFILE_TAG } from './profile.js';
import W1_SLICE from '../../worlds/w1_slice.js';

let _engine = null;

/** Load Rapier and the three probes once, and hold them. */
async function engine() {
  if (_engine) return _engine;
  const { default: RAPIER } = await import('@dimforge/rapier3d-compat');
  await RAPIER.init();
  const [{ assessViability }, { forageProfile }, { S3 }] = await Promise.all([
    import('../../engine/l1/viability.js'),
    import('../../engine/l2/forage.js'),
    import('../../engine/l2/probes.js'),
  ]);
  _engine = { RAPIER, assessViability, forageProfile, S3 };
  return _engine;
}

/**
 * Measure one genome.
 *
 * ALWAYS RETURNS A PROFILE, never throws and never returns null. A creature that
 * will not build, comes apart, or crashes a probe gets `{ valid: false }`, which
 * is a real answer the card knows how to say ("came apart") — as distinct from
 * "not measured yet", which is the absence of a profile with this tag.
 *
 * `intact` IS CHECKED BEFORE THE NUMBERS ARE KEPT. ROADMAP §5b lesson 3: a
 * creature that disintegrates reports fictional intake — 7864 g against rivals'
 * 31-49 — so a body that came apart must never contribute a number, only a state.
 *
 * @param {object} genome
 * @returns {Promise<object>} a `profile` block, stamped with `PROFILE_TAG`
 */
export async function measureGenome(genome) {
  const { RAPIER, assessViability, forageProfile, S3 } = await engine();
  try {
    const v = assessViability(RAPIER, genome, W1_SLICE);
    if (!v.ok) return { tag: PROFILE_TAG, valid: false };

    const p = forageProfile(RAPIER, {
      plan: v.plan, genome, world: W1_SLICE, foodOpts: { seed: 11 },
    });
    if (!p.valid || !p.intact) return { tag: PROFILE_TAG, valid: false };

    let turn = null;
    try {
      const s3 = S3(RAPIER, {
        plan: v.plan, genome, world: W1_SLICE,
        cruiseSpeed: p.netDisplacement / p.window,
      });
      if (s3.valid) turn = s3.turnRate3d * s3.steeringAuthority * (180 / Math.PI);
    } catch { /* a record without a turn figure, not a failed measurement */ }

    return {
      tag: PROFILE_TAG, valid: true,
      foodPerSecond: p.foodPerSecond,
      multiplier: p.multiplier,
      straightness: p.straightness,
      size: p.size,
      turnCapability: turn,
    };
  } catch {
    // Leave it invalid rather than unmeasured: an unmeasured record would be
    // picked up and retried on every open, forever, at 180 s a go.
    return { tag: PROFILE_TAG, valid: false };
  }
}
