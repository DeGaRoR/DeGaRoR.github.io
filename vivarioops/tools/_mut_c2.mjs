// tools/_mut_c2.mjs — mutation test for gate/duel.js (C2).
// Standing lesson: "Mutation-test every gate before accepting green."
//
// The two failure modes this project keeps producing are targeted deliberately:
// an assertion that derives its own bound from the code under test, and an
// assertion whose corpus cannot reach the boundary it names.
//
// The loop, the restore and the signal handling live in tools/_mutate.mjs (H0),
// so an interrupt here cannot leave a seeded defect in the working tree.
import { runMutants } from './_mutate.mjs';

const MUTANTS = [
  // ── canonical seeding — the property K4 exists for ────────────────────────
  ['contracts/matchup.js', "return [String(aHash), String(bHash)].sort();", "return [String(aHash), String(bHash)];", 'canonicalPair stops sorting: order leaks in'],
  ['engine/l2/duel.js', 'const firstIsA = setup.first === a.hash;', 'const firstIsA = true;', 'creation order follows argument order, not the seed'],
  ['engine/l2/duel.js', 'const sign = hash === lo ? -1 : 1;', 'const sign = hash === aHash ? -1 : 1;', 'placement side derived from argument order'],
  ['engine/l2/duel.js', 'const s = pairSeed(BRIDGE_V, worldHashStr, aHash, bHash, repeat);', 'const s = pairSeed(BRIDGE_V, worldHashStr, aHash, bHash, 0);', 'setup seed drops the repeat'],

  // ── the shared arena — apply-then-solve ordering ──────────────────────────
  ['engine/l1/physics.js', 'for (const s of sims) s.applyForces();\n      w.step();', 'for (const s of sims) { s.applyForces(); w.step(); }', 'arena solves per creature instead of once'],

  // ── capture rule and exploit guards (10 §7) ───────────────────────────────
  ['engine/l2/duel.js', 'const root = victim.rootCollider;', 'const root = victim.colliders[victim.colliders.length - 1];', 'capture on any body, not the root'],
  ['engine/l2/duel.js', 'if (best > budget) { ignored++; return; }', 'if (false) { ignored++; return; }', 'guard 2 removed: implausible impulses count'],
  ['engine/l2/duel.js', 'const budget = rootMass * MAX_CONTACT_DV;', 'const budget = Infinity;', 'guard 2 budget made infinite'],
  ['engine/l2/duel.js', 'if (manifold.contactDist(i) > 0) continue;', '', 'a manifold across a gap counts as contact'],
  ['engine/l2/duel.js', 'flagged: outcome !== OUTCOME.NONE && timeToOutcome < REVIEW_SECONDS,', 'flagged: false,', 'guard 3 removed: sub-0.5s decisions recorded'],
  ['engine/l2/duel.js', 'const counted = duels.filter(d => d.valid && !d.flagged);', 'const counted = duels.filter(d => d.valid);', 'flagged repeats counted after all'],
  ['engine/l2/duel.js', 'if (aHitsB.hit && bHitsA.hit) outcome = OUTCOME.NONE;', 'if (false) outcome = OUTCOME.NONE;', 'simultaneous strike resolved asymmetrically'],

  // ── the reduction and K3 ──────────────────────────────────────────────────
  ['engine/l2/duel.js', 'm.pStalemate = n ? 1 - m.aToB.pCapture - m.bToA.pCapture : 1;', 'm.pStalemate = n ? 1 - m.aToB.pCapture : 1;', 'K3 sum broken: stalemate ignores one direction'],
  ['engine/l2/duel.js', 'pCapture: n ? wonByLo.length / n : 0,', 'pCapture: n ? wonByLo.length / duels.length : 0,', 'pCapture divides by attempted, not counted'],
  ['engine/l2/duel.js', 'timeToCapture: median(wonByLo.map(d => d.timeToOutcome), duelDuration),', 'timeToCapture: median(wonByLo.map(d => d.timeToOutcome), 0),', 'timeToCapture defaults to 0, not duelDuration'],
  ['engine/l2/duel.js', 'const loIsA = lo === String(aHash);', 'const loIsA = true;', 'canonical direction mapping ignored'],

  // ── setup variation — 11 §4 "varied but not random" ───────────────────────
  ['engine/l2/duel.js', 'const room = Math.max(0, 2 * (toWall - Math.max(reachA, reachB) - WALL));', 'const room = 0;', 'no room: every separation collapses to touching'],
  ['engine/l2/duel.js', 'const theta = BEARINGS[Math.floor(rand01(s, 1) * BEARINGS.length)];', 'const theta = BEARINGS[0];', 'bearing never varies'],
  ['engine/l2/duel.js', 'Math.abs(dir[0]) > 1e-9 ? hx / Math.abs(dir[0]) : Infinity,', 'hx,', 'room ignores the placement direction again'],

  // ── sensing (11 §6, C1 amendment) ─────────────────────────────────────────
  ['engine/l2/duel.js', 'return d / Math.PI;', 'return d;', 'bearing not normalised to [-1,1]'],
  ['engine/l2/duel.js', 'const bearing = bearingTo(sim, opponentCom);\n  return sensorTurnBias(sim.genome, bearing, bearing);', 'return 0;', 'creatures never sense the opponent'],
  ['engine/l2/duel.js', 'return sensorTurnBias(sim.genome, bearing, bearing);', 'return sensorTurnBias(sim.genome, bearing, 0);', 'threat channel never carries the opponent'],

  // ── residents and fauna ───────────────────────────────────────────────────
  ['worlds/w1_slice.js', 'faunaVersion: 2,', 'faunaVersion: 1,', 'faunaVersion not bumped at the resident swap'],
  ['engine/l2/fauna.js', 'const fauna = species.map((sp, i) => ({ ...sp, id: i }));', 'const fauna = species.map((sp) => ({ ...sp, id: 0 }));', 'fauna ids not dense'],
  ['engine/l2/fauna.js', "errors.push(`missing matchup: ${fauna[i].genomeHash} vs ${fauna[j].genomeHash}`);", '', 'a missing pair is tolerated'],
  ['engine/l2/fauna.js', 'if (!v.ok) errors.push(`species ${i} (${sp.name ?? sp.genomeHash}): ${v.errors.join(\'; \')}`);', '', 'species validation result discarded'],
];

runMutants({
  label: 'C2 duel gate',
  suiteModule: 'duel.js',
  runner: 'runDuelGate',
  mutants: MUTANTS,
});
