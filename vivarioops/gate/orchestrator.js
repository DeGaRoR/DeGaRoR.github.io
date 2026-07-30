// gate/orchestrator.js — the one Node-side gate runner (H4).
//
// The CLI (`npm run gate`) and the build both call runGate(). Neither owns a
// loop of its own, so neither can drift into a different idea of what green
// means. The developer panel cannot import this — it walks the filesystem — so
// it uses gate/manifest.js directly and is required by verdict() to label
// itself PARTIAL.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MANIFEST, ALL_SUITES, verdict } from './manifest.js';

const ROOT = new URL('..', import.meta.url).pathname;

const LOADERS = {
  contracts:      async () => (await import('./contracts.js')).runContractGate(),
  'trunk-static': async () => (await import('./trunk.js')).runStaticGate(),
  runtime:        async () => (await import('./runtime.js')).runRuntimeGate(),
  l1:             async () => (await import('./l1.js')).runL1Gate(),
  motion:         async () => (await import('./motion.js')).runMotionGate(),
  breed:          async () => (await import('./breed.js')).runBreedGate(),
  probe:          async () => (await import('./probe.js')).runProbeGate(),
  duel:           async () => (await import('./duel.js')).runDuelGate(),
};

/** Pinned dependency versions, recorded in the report so a result is reproducible. */
function dependencies() {
  const out = {};
  try {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    for (const [name, pinned] of Object.entries(pkg.dependencies ?? {})) {
      let installed = null;
      try { installed = JSON.parse(readFileSync(join(ROOT, 'node_modules', name, 'package.json'), 'utf8')).version; }
      catch { /* not installed */ }
      out[name] = { pinned, installed };
    }
  } catch { /* no package.json is itself a problem, but not this function's */ }
  return { node: process.version, packages: out };
}

/**
 * @param {object} [opts]
 * @param {string[]} [opts.suites] defaults to every suite in the manifest
 * @param {(line:string)=>void} [opts.log] omit for a silent run
 * @returns a machine-readable report: every suite, every assertion, why anything
 *          was skipped, and the dependency versions it all ran against
 */
export async function runGate({ suites = ALL_SUITES, log = () => {} } = {}) {
  const report = {
    startedAt: new Date().toISOString(),
    suitesRequested: suites,
    suites: [],
    skipped: [],
    obligations: [],
    passed: 0, failed: 0, pending: 0, checks: 0,
    dependencies: dependencies(),
  };

  for (const name of ALL_SUITES) {
    const expected = MANIFEST[name];
    if (!suites.includes(name)) {
      // Recorded rather than omitted: a report that simply lacks a suite is
      // indistinguishable from one where the suite passed.
      report.skipped.push({ suite: name, assertions: expected, reason: 'not requested' });
      continue;
    }

    log(`\n-- gate/${name} ------------------------------------------`);
    let r;
    try {
      r = await LOADERS[name]();
    } catch (e) {
      log(`  [FAIL] --  suite failed to load: ${e.message}`);
      log(`         >>> ${expected.length} assertion(s) did not run: ${expected.join(', ')}`);
      report.failed += expected.length;
      report.suites.push({ name, loadError: String(e.message), results: [], expected });
      continue;
    }

    for (const a of r.results) {
      log(`  [${{ pass: 'PASS', fail: 'FAIL', pending: 'PEND' }[a.status]}] ${a.id}  ${a.title}${a.checks ? `  (${a.checks} checks)` : ''}`);
      if (a.note) log(`         note: ${a.note}`);
      for (const f of a.failures) log(`         >>> ${f}`);
    }

    const ran = new Set(r.results.map(a => a.id));
    const missing = expected.filter(id => !ran.has(id));
    const extra = [...ran].filter(id => !expected.includes(id));
    if (missing.length) { log(`  [FAIL] --  assertions missing from gate/${name}: ${missing.join(', ')}`); report.failed += missing.length; }
    if (extra.length) { log(`  [FAIL] --  assertions not in the manifest: ${extra.join(', ')} -- add them to gate/manifest.js`); report.failed += extra.length; }

    for (const d of r.diagnostics || []) log(`         diag: ${d}`);
    report.passed += r.passed; report.failed += r.failed; report.pending += r.pending; report.checks += r.checks;
    report.obligations.push(...(r.obligations || []));
    report.suites.push({
      name, expected, missing, extra,
      passed: r.passed, failed: r.failed, pending: r.pending, checks: r.checks,
      results: r.results.map(a => ({ id: a.id, title: a.title, status: a.status, checks: a.checks ?? 0, note: a.note ?? null, failures: a.failures })),
    });
  }

  const v = verdict({ failed: report.failed, suitesRun: report.suites.map(s => s.name) });
  report.verdict = v.state;
  report.verdictLine = v.line;
  report.finishedAt = new Date().toISOString();
  return report;
}

/** The summary block, shared so the CLI and the build print the same words. */
export function printSummary(report, log = console.log) {
  if (report.obligations.length) {
    log(`\n-- carried obligations -----------------------------------`);
    for (const o of report.obligations) log(`  - ${o}`);
  }
  log(`\n-- summary -----------------------------------------------`);
  log(`  ${report.passed + report.failed + report.pending} assertions: ${report.passed} passed, ${report.failed} failed, ${report.pending} pending`);
  log(`  ${report.checks} underlying checks`);
  if (report.skipped.length) {
    log(`  ${report.skipped.length} suite(s) NOT RUN: ${report.skipped.map(s => s.suite).join(', ')}`);
  }
  log(`  ${report.verdictLine}\n`);
}
