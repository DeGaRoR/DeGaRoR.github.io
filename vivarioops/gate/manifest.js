// gate/manifest.js — the single declaration of what the gate IS (H4).
//
// WHY THIS IS ITS OWN FILE. There were three definitions of "green": the CLI ran
// eight suites, the developer panel ran three, and the build ran one — and all
// three could print a success line. A badge that excludes motion and breeding is
// worse than no badge, because it manufactures confidence rather than reporting
// it. There is now one manifest, and every consumer either runs ALL of it or
// says out loud, in its own verdict line, which part it skipped.
//
// THE MANIFEST IS LOAD-BEARING. Without it, a suite that throws at import time,
// or an assertion someone deletes, produces a SMALLER run that still reports
// green. A gate whose scope is defined by whatever happened to load is not a
// gate. (Found at A1: planting a violation in trunk/store.js crashed the runner
// at import and printed no failures at all.)

export const MANIFEST = {
  contracts:      ['C0', 'K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8'],
  'trunk-static': ['N1', 'N2', 'N3', 'N5', 'N8', 'N14', 'N16', 'N24', 'V2', 'V1'],
  runtime:        ['R1', 'N9', 'N10', 'R4', 'R5'],
  l1:             ['L1-1', 'L1-2', 'L1-3', 'L1-4', 'L1-36', 'L1-5', 'L1-6', 'L1-7', 'L1-8', 'L1-9', 'L1-10', 'N6', 'N20', 'L1-11', 'L1-12', 'L1-13', 'L1-14', 'L1-15', 'L1-16'],
  motion:         ['L1-17', 'L1-18', 'L1-19', 'L1-20', 'L1-37', 'L1-23m', 'L1-21', 'L1-22'],
  breed:          ['L1-23', 'L1-24', 'L1-25', 'L1-26', 'L1-27', 'L1-28', 'L1-29', 'L1-30', 'L1-38', 'L1-39', 'L1-40', 'L1-41', 'L1-42', 'L1-31', 'L1-32', 'L1-33', 'L1-34', 'L1-35'],
  probe:          ['L2-1', 'L2-2', 'L2-3', 'L2-4', 'L2-5', 'L2-6', 'L2-7', 'L2-8', 'L2-9', 'L2-19', 'L2-20', 'L2-21', 'L2-22'],
  duel:           ['L2-10', 'L2-11', 'L2-12', 'L2-13', 'L2-14', 'L2-15', 'L2-16', 'L2-17', 'L2-18'],
};

/**
 * Which suites a BROWSER can run.
 *
 * `trunk-static` walks the filesystem, so it exists only in Node; the panel
 * displays what the build recorded instead. The physics suites are excluded
 * because they take minutes with a warm Rapier world and the panel is a glance,
 * not a gate — which is exactly why the panel must never claim to BE the gate.
 */
export const BROWSER_SUITES = ['contracts', 'runtime', 'l1'];

export const ALL_SUITES = Object.keys(MANIFEST);

/** Assertions in the manifest but not in the given suite list. */
export function notCovered(suites) {
  const covered = new Set(suites);
  return ALL_SUITES.filter(s => !covered.has(s))
    .flatMap(s => MANIFEST[s].map(id => ({ suite: s, id })));
}

/**
 * The verdict line, computed in ONE place so no consumer can invent a friendlier
 * one. A partial run is never GREEN — it is PARTIAL, and it names what it left
 * out. This is the whole point of H4.
 */
export function verdict({ failed, suitesRun }) {
  const skipped = ALL_SUITES.filter(s => !suitesRun.includes(s));
  if (failed > 0) return { state: 'RED', line: 'GATE RED' };
  if (skipped.length) {
    return {
      state: 'PARTIAL',
      line: `PARTIAL — ${suitesRun.length}/${ALL_SUITES.length} suites. NOT the gate. `
          + `Not run: ${skipped.join(', ')}. Run \`npm run gate\`.`,
    };
  }
  return { state: 'GREEN', line: 'GATE GREEN' };
}
