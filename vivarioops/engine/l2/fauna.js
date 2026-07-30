// engine/l2/fauna.js — the fauna loader (03 §3, 11 §7).
//
// "L2 produces PairMatchup records and measured fields. It does NOT assemble the
// dense Species.vs matrix — the fauna loader does that (03 §3), which is why
// L2's output is per-pair rather than per-species." (11 §7)
//
// So this file is the join: solo records in, pair records in, a dense fauna out.
// It owns exactly the two fields compileSolo leaves null — `id` and `vs` — and
// nothing else. `assembleVs` itself already lives in contracts/matchup.js, where
// K2 asserts it; this is the step that decides WHO is in the fauna and in what
// order, which is what turns a bag of records into a dense array.
//
// PURITY: pure. No Rapier, no clock, no rng — every duel has already been run.

import { ContractError } from '../../contracts/world.js';
import { validateSpecies, VS_STRIDE } from '../../contracts/species.js';
import { assembleVs, matchupKey } from '../../contracts/matchup.js';

/**
 * Assemble a fauna set.
 *
 * ORDER IS THE CALLER'S AND IT IS PART OF THE WORLD. `id` is "a dense index into
 * the fauna array" (03 §3) and `Species.vs` is indexed by it, so re-ordering a
 * fauna silently rewrites every matchup row. The order therefore comes from
 * `world.residents` — a fixture — and never from a Map's iteration order or a
 * hash sort, both of which would look stable right up until they were not.
 *
 * @param {object} args
 * @param {object[]} args.species   solo-compiled records, `id` and `vs` still null
 * @param {Map<string,object>} args.matchups  keyed by matchupKey()
 * @param {object} args.world
 * @returns {{fauna:object[], errors:string[]}}
 */
export function loadFauna({ species, matchups, world }) {
  const errors = [];

  // Dense ids in the caller's order, assigned before anything reads them.
  const fauna = species.map((sp, i) => ({ ...sp, id: i }));

  // Every pair must be present, INCLUDING the residents' mutual matrix. 11 §8:
  // "The residents' mutual matrix is computed once when a world is built and
  // shipped with the world — the player's compile is O(residents), never
  // O(residents^2)." A missing pair is a contract violation, not a gap to fill
  // with a default: a zero would read as "never captures", which is a
  // measurement, and inventing one is exactly what 11 §2 forbids.
  for (let i = 0; i < fauna.length; i++) {
    for (let j = i + 1; j < fauna.length; j++) {
      const key = matchupKey(fauna[i].genomeHash, fauna[j].genomeHash);
      if (!matchups.has(key)) {
        errors.push(`missing matchup: ${fauna[i].genomeHash} vs ${fauna[j].genomeHash}`);
      }
    }
  }
  if (errors.length) return { fauna: [], errors };

  const rows = assembleVs(fauna, matchups, world.duelDuration);
  fauna.forEach((sp, i) => { sp.vs = rows[i]; });

  // K2's shape, checked here rather than trusted: a fauna that leaves this
  // function is dense or it does not leave it.
  fauna.forEach((sp, i) => {
    const v = validateSpecies(sp, fauna.length);
    if (!v.ok) errors.push(`species ${i} (${sp.name ?? sp.genomeHash}): ${v.errors.join('; ')}`);
  });

  return { fauna: errors.length ? [] : fauna, errors };
}

/** Throws rather than returning a half-built fauna (01 §9). */
export function assertFauna(args) {
  const r = loadFauna(args);
  if (r.errors.length) throw new ContractError(`fauna invalid: ${r.errors.join(' | ')}`, 'fauna-invalid');
  return r.fauna;
}

/**
 * 11 §12.5: "Non-transitivity exists. Across a resident set, find at least one
 * A>B>C>A cycle. Its absence suggests the duels are decided by a single dominant
 * capability, which would mean the matchup matrix adds nothing over a scalar."
 *
 * Reported rather than asserted, and deliberately so: with three residents there
 * is exactly one candidate cycle, so absence is weak evidence at this fauna size.
 * It becomes an assertion when a fauna is large enough for the claim to have
 * teeth — which is step F's matchup matrix, not the slice's three.
 *
 * @returns {{cycles:number, beats:number[][], decisive:number}}
 */
export function nonTransitivity(fauna) {
  const n = fauna.length;
  const beats = [];
  for (let i = 0; i < n; i++) {
    beats.push([]);
    for (let j = 0; j < n; j++) {
      if (i === j) { beats[i].push(0); continue; }
      const ij = fauna[i].vs[j * VS_STRIDE];
      const ji = fauna[j].vs[i * VS_STRIDE];
      beats[i].push(ij > ji ? 1 : 0);
    }
  }
  let cycles = 0, decisive = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      if (beats[i][j]) decisive++;
      for (let k = 0; k < n; k++) {
        if (k === i || k === j) continue;
        if (beats[i][j] && beats[j][k] && beats[k][i]) cycles++;
      }
    }
  }
  return { cycles: cycles / 3, beats, decisive };
}
