// gate/run-all.js — the whole gate as ONE suite result, for the mutation harness.
// It exists so a mutant can be scored against the entire manifest rather than
// against whichever suite happens to own the assertion, which is what lets a
// single harness cover changes that cross layers (H0).
import { runGate } from './orchestrator.js';

export async function runAll() {
  const r = await runGate();
  const results = r.suites.flatMap(s => s.results ?? []);
  for (const s of r.suites) {
    if (s.loadError) results.push({ id: s.name, title: `suite failed to load`, status: 'fail', failures: [s.loadError], checks: 0 });
    for (const id of s.missing ?? []) results.push({ id, title: 'assertion did not run', status: 'fail', failures: ['missing'], checks: 0 });
  }
  return { name: 'run-all', results, passed: r.passed, failed: r.failed, pending: r.pending, checks: r.checks, obligations: [], diagnostics: [] };
}
