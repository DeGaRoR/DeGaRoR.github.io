// trunk/rng.js — the ONLY place a stateful PRNG is constructed (N5).
//
// Seed DERIVATION lives in contracts/hash.js, because /engine/ must be able to
// derive seeds and N3 forbids /engine/ importing /trunk/. This file owns the
// generator; that file owns the arithmetic that produces its input.
//
// Algorithm: PCG-XSH-RR 64/32. Chosen over xorshift/mulberry because it passes
// TestU01 BigCrush, has a tiny state, and is trivially reproducible across
// engines using BigInt for the 64-bit step. Determinism is a P6 constraint from
// the first line, so the generator is exact-integer, never float-accumulated.

import { seed as deriveSeed } from '../contracts/hash.js';

const MUL = 6364136223846793005n;
const INC = 1442695040888963407n;
const MASK64 = 0xffffffffffffffffn;

/**
 * @param {number|string} seedInput  a uint32 from seed(), or any string to derive from
 * @returns a generator. Never share one across components — fork() instead.
 */
export function makeRng(seedInput) {
  const s0 = typeof seedInput === 'number' ? seedInput >>> 0 : deriveSeed(seedInput);
  let state = 0n;

  function step() {
    const old = state;
    state = (old * MUL + INC) & MASK64;
    const xorshifted = Number(((old >> 18n) ^ old) >> 27n & 0xffffffffn) >>> 0;
    const rot = Number(old >> 59n);
    return ((xorshifted >>> rot) | (xorshifted << ((-rot) & 31))) >>> 0;
  }

  // PCG's canonical seeding: advance, add the seed, advance again, THEN emit.
  //
  // The obvious shortcut — state = seed + INC, emit immediately — makes the first
  // output one addition away from the seed, and it is measurably biased: across
  // 20 000 sequentially derived seeds, a first int(4) came out [4517, 5088, 5492,
  // 4903] instead of 5000 each, and the B1 corpus averaged 2.90 nodes where
  // randInt(2,5) should give 3.50. Uniform again by the tenth draw, which is why
  // it survives every test that does not look at the FIRST draw specifically.
  //
  // This is the dominant usage pattern: rngFrom(...) then draw once. Every probe,
  // every duel placement, every genome starts with a first draw off a fresh seed.
  step();
  state = (state + BigInt(s0)) & MASK64;
  step();

  return {
    seed: s0,
    /** uniform uint32 */
    u32: step,
    /** uniform float in [0, 1) */
    f32: () => step() / 4294967296,
    /** uniform integer in [0, n) — rejection-sampled, so no modulo bias */
    int(n) {
      if (n <= 0) throw new Error(`rng.int(${n}): n must be > 0`);
      const limit = 4294967296 - (4294967296 % n);
      let v; do { v = step(); } while (v >= limit);
      return v % n;
    },
    /** uniform float in [a, b) */
    range: (a, b) => a + (b - a) * (step() / 4294967296),
    /** normal(0,1) via Box-Muller, one value per call */
    normal() {
      let u = 0; while (u === 0) u = step() / 4294967296;
      const v = step() / 4294967296;
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    /**
     * A child generator with an independent stream, derived from this seed plus a
     * label. NOT a split of shared state — N5 forbids nested shared PRNG state,
     * so the child is a fresh generator over a derived seed and the parent is
     * unaffected by how much the child consumes.
     */
    fork: (label) => makeRng(deriveSeed(s0, label)),
  };
}

/** Convenience: derive and construct in one step from stable strings. */
export function rngFrom(...parts) {
  return makeRng(deriveSeed(...parts));
}

/**
 * A fresh, NON-deterministic vivarium seed (H7).
 *
 * WHY THIS EXISTS. Determinism should let ONE lineage be reproduced and shared.
 * It should not make every lineage identical. The tank derived its streams from
 * fixed strings — `rngFrom('tank', 'seed')`, `rngFrom('tank', 'breed', gen)` —
 * so every player on earth opened the game to the SAME six creatures and got the
 * same draws from the same selections. The success criterion that different
 * players produce genuinely different creatures was defeated at the source, by
 * the one line nobody looks at.
 *
 * The single non-deterministic act is confined here, in /trunk/, and happens
 * ONCE per lineage. Everything downstream forks from the value it returns and
 * stays exactly as reproducible as before — given the seed, the whole lineage
 * replays. That is the property worth having; universal sameness never was.
 *
 * N5 forbids constructing a PRNG outside this file, which is precisely why this
 * belongs here rather than at the call site. crypto is used, not the obvious
 * alternative, because a clock-derived seed collides across players who install
 * on the same day.
 *
 * @returns {number} uint32
 */
export function freshVivariumSeed() {
  const c = globalThis.crypto;
  if (c?.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0] >>> 0;
  // No crypto: Node before 19 without webcrypto, or a hostile embed. Falling
  // back to a fixed value would silently restore the very bug this removes, so
  // this is loud instead.
  throw new Error('freshVivariumSeed: crypto.getRandomValues is unavailable');
}
