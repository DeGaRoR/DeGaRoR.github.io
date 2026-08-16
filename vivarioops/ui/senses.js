// ui/senses.js — what a creature can actually perceive, said accurately.
//
// ── THE BUG THIS REPLACES ────────────────────────────────────────────────────
//
// Both surfaces that reported senses read `chemoGain` AND NOTHING ELSE, and
// printed `UNWIRED` when it was zero. `chemoGain` is one of TWO independent
// readings of the receptor array, and it is the one that is zero at birth by
// design. The other, `tropoGain`, has been DRAWN at birth since GENOME_V 9.
//
// So the only creature in the shipped library with a working directional sense —
// `champ-forager`, 4 receptors on both sides, `tropoGain` -0.445 — was labelled
// UNWIRED, while eight champions with no sensory organs whatsoever were happily
// homing on a beacon. The report was wrong about the one animal that worked.
//
// ── THE FIVE STATES, AND WHY THE MIDDLE ONE MATTERS MOST ─────────────────────
//
// `oneSided` is the state nothing could previously express, and it is a real
// structural fact rather than a rounding of "has senses". Tropotaxis takes the
// LEFT/RIGHT CONTRAST across the receptor array; a creature whose receptors are
// all on one side has no differential to take, so `forage.js` leaves its
// `turnBias` at zero however large the gene is. That animal has an organ, has
// the wiring, and still cannot steer — and `design/PLAN.md` Phase 1 flags the
// cause as a live structural limit: `side` is assigned from the BODY a site sits
// on, not from where on that body it sits.
//
// A report that collapsed that into "has senses" would hide the single most
// useful thing a breeder could know about it.
//
// ── WHAT IS NOT MEASURED HERE, DELIBERATELY ──────────────────────────────────
//
// `preyGain` / `threatGain` are NOT senses and are not reported as such. They
// are the steering response to `bearingTo` — the omniscient compass — which
// reads no organ, has unlimited range and is handed the target's world position.
// Reporting it beside the receptors would be the exact confusion this file
// exists to remove. `design/PLAN.md` §1.3 defect 1 and Phase 1 step 1.4.

import { t } from '../trunk/i18n.js';

/** Below this a gain cannot move a trajectory; `_ztaxevo` measured the floor. */
const LIVE = 0.01;

/**
 * @param {object|null} plan    from morphogenesis; null if unavailable
 * @param {object} genome
 * @returns {{receptors, sides, chemo, tropo, state, summary}}
 *   state ∈ blind | unwired | oneSided | kinesis | taxis
 */
export function sensesOf(plan, genome) {
  const rec = plan?.receptors ?? [];
  const c = genome?.controller ?? {};
  const chemo = c.chemoGain ?? 0;
  const tropo = c.tropoGain ?? 0;

  // Two distinct signs means a differential exists. `senseAt` splits on
  // `receptors[i].side`, so this is the same test `forage.js` makes.
  const sides = new Set(rec.map((r) => Math.sign(r.side ?? 0))).size;

  const liveChemo = Math.abs(chemo) > LIVE;
  const liveTropo = Math.abs(tropo) > LIVE;

  let state;
  if (!rec.length) state = 'blind';
  else if (liveTropo && sides > 1) state = 'taxis';
  else if (liveTropo) state = 'oneSided';
  else if (liveChemo) state = 'kinesis';
  else state = 'unwired';

  return { receptors: rec.length, sides, chemo, tropo, state, summary: summarise(state, rec.length, chemo, tropo) };
}

function summarise(state, n, chemo, tropo) {
  const organs = `${n} ${n === 1 ? t('receptor') : t('receptors')}`;
  switch (state) {
    case 'blind':
      return t('blind — no receptors');
    case 'unwired':
      // Honest: the organ is there and reports nothing. This is the state the
      // factory starts every creature in, on purpose.
      return `${organs} · ${t('unwired — neither gain is live')}`;
    case 'oneSided':
      // The one worth spelling out. See the header.
      return `${organs} ${t('all on one side')} · ${t('taxis')} ${tropo.toFixed(2)} `
        + t('— no left/right difference to read');
    case 'kinesis':
      return `${organs} · ${t('kinesis')} ${chemo.toFixed(2)} — ${t('swims harder in richer water')}`;
    case 'taxis':
      return `${organs} ${t('on both sides')} · ${t('taxis')} ${tropo.toFixed(2)}`
        + (Math.abs(chemo) > LIVE ? ` · ${t('kinesis')} ${chemo.toFixed(2)}` : '');
    default:
      return organs;
  }
}
