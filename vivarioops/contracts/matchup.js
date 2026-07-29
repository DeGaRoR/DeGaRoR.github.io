// contracts/matchup.js — 03 §2 PairMatchup, §2 canonical seeding, §4 L3 engagement.
//
// PURITY: pure. Safe for /engine/.

import { seed } from './hash.js';
import { ContractError } from './world.js';
import { VS_STRIDE, VS_PCAPTURE, VS_TIME, VS_ENERGY } from './species.js';

/** 03 §2 — one duel run produces BOTH directions. */
export function makeMatchup() {
  return {
    aHash: null, bHash: null,          // canonical: aHash < bHash, always
    repeats: null,
    aToB: { pCapture: null, timeToCapture: null, energyRate: null },
    bToA: { pCapture: null, timeToCapture: null, energyRate: null },
    pStalemate: null,
    engagementRadius: null,            // separation the duel began at, in metres
  };
}

/** Canonical ordering. Lexicographic on the hash strings, default comparator. */
export function canonicalPair(aHash, bHash) {
  return [String(aHash), String(bHash)].sort();
}

/** Stable map key for a pair, order-independent. */
export function matchupKey(aHash, bHash) {
  const [lo, hi] = canonicalPair(aHash, bHash);
  return `${lo}|${hi}`;
}

/**
 * 03 §2. Corrects 11 §4's order-dependent seed.
 * A-vs-B and B-vs-A therefore run the identical fights and merely read them from
 * opposite ends. Which body is placed first is derived SEPARATELY from this seed.
 */
export function pairSeed(bridgeV, worldHashStr, aHash, bHash, repeat) {
  const [lo, hi] = canonicalPair(aHash, bHash);
  return seed(bridgeV, worldHashStr, lo, hi, repeat);
}

/** Placement derived from the seed, not from argument order — keeps K4 true. */
export function placementFirst(bridgeV, worldHashStr, aHash, bHash, repeat) {
  const [lo, hi] = canonicalPair(aHash, bHash);
  return (pairSeed(bridgeV, worldHashStr, aHash, bHash, repeat) & 1) === 0 ? lo : hi;
}

/** @returns {{ok:boolean, errors:string[]}} — K3. */
export function validateMatchup(m, eps = 1e-4) {
  const errors = [];
  if (!m || typeof m !== 'object') return { ok: false, errors: ['matchup is not an object'] };

  for (const k of ['aHash', 'bHash', 'repeats', 'pStalemate', 'engagementRadius']) {
    if (m[k] === null || m[k] === undefined) errors.push(`unassigned: ${k}`);
  }
  for (const dir of ['aToB', 'bToA']) {
    if (!m[dir]) { errors.push(`missing: ${dir}`); continue; }
    for (const k of ['pCapture', 'timeToCapture', 'energyRate']) {
      const v = m[dir][k];
      if (v === null || v === undefined || !Number.isFinite(v)) errors.push(`unassigned: ${dir}.${k}`);
    }
  }
  if (errors.length) return { ok: false, errors };

  const [lo] = canonicalPair(m.aHash, m.bHash);
  if (m.aHash !== lo) errors.push(`not canonical: aHash ${m.aHash} should be <= bHash ${m.bHash}`);

  // K3 — the probability invariant.
  const sum = m.aToB.pCapture + m.bToA.pCapture + m.pStalemate;
  if (Math.abs(sum - 1) > eps) errors.push(`K3: pCapture sum = ${sum}, expected 1 +/- ${eps}`);

  for (const dir of ['aToB', 'bToA']) {
    if (m[dir].pCapture < 0 || m[dir].pCapture > 1) errors.push(`${dir}.pCapture out of [0,1]: ${m[dir].pCapture}`);
    if (m[dir].energyRate < 0) errors.push(`${dir}.energyRate negative: ${m[dir].energyRate}`);
    if (m[dir].timeToCapture <= 0) errors.push(`${dir}.timeToCapture <= 0: ${m[dir].timeToCapture}`);
  }
  if (m.pStalemate < 0 || m.pStalemate > 1) errors.push(`pStalemate out of [0,1]: ${m.pStalemate}`);

  return { ok: errors.length === 0, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// 03 §4 — L3 capture is an ENGAGEMENT, not a contact roll.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Engagement opens at this separation. Recomputed from the world's k, per 03 §4
 * (A0 decision, defect 11). PairMatchup.engagementRadius is retained as a
 * diagnostic so drift between the duel harness and k is visible, not silent.
 */
export function engagementRadius(reachA, reachB, k) {
  return k * (reachA + reachB);
}

export const CAPTURE_CERTAIN = 0.999;

/**
 * Constant hazard calibrated so P(capture within timeToCapture) = pCapture.
 * Returns Infinity for the certain-capture guard, 0 for the no-hazard guard.
 */
export function hazardLambda(pCapture, timeToCapture) {
  if (pCapture <= 0) return 0;
  if (pCapture >= CAPTURE_CERTAIN) return Infinity;
  if (!(timeToCapture > 0)) throw new ContractError(`timeToCapture must be > 0, got ${timeToCapture}`, 'bad-ttc');
  return -Math.log(1 - pCapture) / timeToCapture;
}

/** Per-tick capture probability for the hazard case. */
export function hazardPerTick(lambda, dt) {
  if (lambda === 0) return 0;
  if (!Number.isFinite(lambda)) {
    throw new ContractError('hazardPerTick called on a certain-capture model; use captureModel()', 'bad-hazard');
  }
  return 1 - Math.exp(-lambda * dt);
}

/**
 * THE entry point L3 must use. 03 §4's guards are not expressible as per-tick
 * probabilities: "pCapture >= 0.999 -> certain capture AT timeToCapture" is a
 * deadline, and a pTick of 1 would instead capture on the first tick of the
 * engagement. So the model is returned as a tagged union and L3 branches on kind.
 *
 *   'none'    — pure energy drain, no capture possible
 *   'certain' — capture fires when engagement elapsed >= at
 *   'hazard'  — roll pTick each tick
 */
export function captureModel(pCapture, timeToCapture, dt) {
  if (!(pCapture > 0)) return { kind: 'none', pTick: 0, at: Infinity };
  if (pCapture >= CAPTURE_CERTAIN) return { kind: 'certain', pTick: 0, at: timeToCapture };
  const lambda = hazardLambda(pCapture, timeToCapture);
  return { kind: 'hazard', pTick: hazardPerTick(lambda, dt), at: Infinity, lambda };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fauna loader step — assembles the dense Species.vs from pair records (03 §3).
// L2 produces pair records; assembly is a separate, cheap step.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Array<{id:number, genomeHash:string}>} fauna  dense, id === index
 * @param {Map<string, object>} matchups                 keyed by matchupKey()
 * @param {number} duelDuration  default timeToCapture when a direction never won
 * @returns {Float32Array[]} one vs row per species, in fauna order
 */
export function assembleVs(fauna, matchups, duelDuration) {
  const n = fauna.length;
  fauna.forEach((sp, i) => {
    if (sp.id !== i) throw new ContractError(`fauna not dense: index ${i} has id ${sp.id}`, 'fauna-not-dense');
  });

  return fauna.map((self) => {
    const row = new Float32Array(VS_STRIDE * n);
    for (let j = 0; j < n; j++) {
      const other = fauna[j];
      const o = j * VS_STRIDE;
      if (j === self.id) continue;                       // self entries are zero

      const m = matchups.get(matchupKey(self.genomeHash, other.genomeHash));
      if (!m) throw new ContractError(`vs not dense: no matchup for ${self.genomeHash} vs ${other.genomeHash}`, 'vs-not-dense');

      const dir = (m.aHash === self.genomeHash) ? m.aToB : m.bToA;
      row[o + VS_PCAPTURE] = dir.pCapture;
      row[o + VS_TIME]     = dir.timeToCapture > 0 ? dir.timeToCapture : duelDuration;
      row[o + VS_ENERGY]   = dir.energyRate;
    }
    return row;
  });
}
