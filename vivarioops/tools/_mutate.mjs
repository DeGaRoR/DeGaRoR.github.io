// tools/_mutate.mjs — the shared mutation harness (H0).
//
// WHY THIS IS SHARED, AND WHY IT IS CRASH-SAFE.
//
// The standing rule is "mutation-test every gate before accepting green", and
// the harnesses that enforced it were themselves the least careful code in the
// tree: four near-identical loops, each of which wrote a defect into a source
// file, ran a suite, and restored the file on the line AFTER. Any interrupt
// between those two lines — ctrl-c on a run that looked stuck, a timeout, a
// throw in the runner — left a deliberate defect sitting in the working tree.
// That happened twice, and both times it cost a full gate run to notice, because
// the next thing anyone did was run the gate and disbelieve it.
//
// Restoration is therefore not a statement in the loop body. It is a `finally`,
// plus signal handlers, plus an `uncaughtException` handler, plus a final
// verification pass that re-runs the suite on the restored tree and says out
// loud whether it came back green. Originals are held IN MEMORY rather than in
// `.bak` files: a crash cannot leave a stale `.bak` beside a mutated source, and
// the repository stops accumulating shadow copies of its own modules.
//
// TWO PRE-FLIGHT CHECKS, both learned the hard way this week:
//
//   1. The suite must be GREEN before any mutant is seeded. A mutant "caught" by
//      a suite that was already red proves nothing, and a harness that cannot
//      tell those apart reports a comforting number.
//   2. Every anchor must appear EXACTLY ONCE. `String.replace` with a string
//      pattern silently rewrites the first occurrence, so a non-unique anchor
//      mutates something other than what its label claims, and an absent one
//      quietly tests nothing at all.

import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not `.pathname`: `.pathname` is `/D:/…` on Windows and join()
// doubles the drive into `D:\D:\…`.
export const ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * Recovery sentinel for a kill that CANNOT be caught.
 *
 * Signal handlers and `finally` cover ctrl-c, a timeout that sends SIGTERM, and
 * a throw in the runner. They do not cover SIGKILL — an out-of-memory kill, a
 * container execution limit, a pulled plug — because nothing does. That is not
 * theoretical: this harness was killed by a container time limit on its first
 * real run and left mutant #25 sitting in engine/l2/fauna.js, where it survived
 * a checksum spot-check and was found only because the next run's green-baseline
 * pre-flight refused to start.
 *
 * So the recovery data is written to DISK BEFORE the source is touched, and it
 * carries the whole original text rather than a reference to it. A later run
 * reads it, puts the file back, and says so. In-memory restoration handles the
 * catchable cases; this handles the rest.
 */
// NOT under tools/ — that directory is in the static gate's APP_ROOTS, and this
// file holds a VERBATIM COPY of the source being mutated. Parked there it was
// scanned as project code, so the original text of store.js tripped N8 (no
// localStorage) and of any seeded file tripped N5, turning five false catches
// into a comfortable-looking 7/7. A harness that contaminates the thing it
// measures is worse than no harness. The project root is walked only for app.js
// and index.html by name, so a dotfile here is invisible to the gate.
const SENTINEL = join(ROOT, '.mutation-in-flight.json');

/* Originals, cached on first touch. Nothing here ever reaches the disk. */
const originals = new Map();
let handlersInstalled = false;

function remember(file) {
  if (!originals.has(file)) originals.set(file, readFileSync(join(ROOT, file), 'utf8'));
  return originals.get(file);
}

/** Put the file back and drop the sentinel, in that order. */
function endMutation(file, original) {
  writeFileSync(join(ROOT, file), original);
  try { if (existsSync(SENTINEL)) unlinkSync(SENTINEL); } catch { /* nothing useful to do */ }
}

/**
 * Repair a tree left dirty by an uncatchable kill. Runs before anything else,
 * and is loud: a silent repair would hide how often this happens.
 */
export function recoverInFlight() {
  if (!existsSync(SENTINEL)) return false;
  try {
    const { file, original, label } = JSON.parse(readFileSync(SENTINEL, 'utf8'));
    writeFileSync(join(ROOT, file), original);
    unlinkSync(SENTINEL);
    console.log(`  RECOVERED: a previous run was killed while ${file} held a seeded defect`);
    console.log(`             (${label}) — the original has been put back.\n`);
    return true;
  } catch (e) {
    console.error(`  A mutation sentinel exists but could not be applied: ${e.message}`);
    console.error(`  ${SENTINEL} — resolve this by hand before trusting the tree.\n`);
    process.exit(1);
  }
}

/** Idempotent, and safe to call from a signal handler. */
export function restoreAll() {
  for (const [file, text] of originals) {
    try { writeFileSync(join(ROOT, file), text); } catch { /* nothing useful to do while dying */ }
  }
  try { if (existsSync(SENTINEL)) unlinkSync(SENTINEL); } catch { /* ditto */ }
}

function installHandlers() {
  if (handlersInstalled) return;
  handlersInstalled = true;
  const bail = (code, why) => () => {
    restoreAll();
    console.error(`\n  ${why} — working tree restored.`);
    process.exit(code);
  };
  process.on('SIGINT', bail(130, 'interrupted'));
  process.on('SIGTERM', bail(143, 'terminated'));
  process.on('uncaughtException', (e) => {
    restoreAll();
    console.error(`\n  harness threw: ${e && e.message} — working tree restored.`);
    process.exit(1);
  });
}

/**
 * Run one gate suite in a child process.
 *
 * A CHILD PROCESS, not an import: the suites cache module state and Rapier
 * worlds, and a mutant seeded after the module graph is warm would be read from
 * the old copy and score a false escape.
 *
 * @returns {{red:boolean, failed:string[], threw:boolean}}
 */
export function runSuite(suiteModule, runner) {
  const script =
    `import('./gate/${suiteModule}').then(async m => {` +
    `const r = await m.${runner}();` +
    `const bad = r.results.filter(a => a.status === 'fail').map(a => a.id);` +
    `console.log('RESULT:' + (bad.join(',') || '-'));` +
    `}).catch(e => console.log('RESULT:THREW'))`;
  let out = '';
  try {
    out = execSync(`node -e ${JSON.stringify(script)}`,
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 1_800_000 });
  } catch {
    return { red: true, failed: [], threw: true };
  }
  const line = (out.match(/RESULT:(.*)$/m) || [, ''])[1].trim();
  if (line === 'THREW') return { red: true, failed: [], threw: true };
  const failed = line === '-' ? [] : line.split(',').filter(Boolean);
  return { red: failed.length > 0, failed, threw: false };
}

/**
 * @param {object} spec
 * @param {string} spec.label       what is being mutation-tested
 * @param {string} spec.suiteModule e.g. 'duel.js'
 * @param {string} spec.runner      e.g. 'runDuelGate'
 * @param {Array}  spec.mutants     `[file, from, to, label, expectedId?]`
 */
export function runMutants({ label, suiteModule, runner, mutants }) {
  installHandlers();
  recoverInFlight();
  const run = () => runSuite(suiteModule, runner);
  let caught = 0;
  const escaped = [], skipped = [], misattributed = [];

  try {
    // Pre-flight 1 — anchors, before anything is written.
    for (const [file, from, , mLabel] of mutants) {
      const src = remember(file);
      const n = src.split(from).length - 1;
      if (n === 0) skipped.push(`${mLabel} — anchor not found in ${file}`);
      else if (n > 1) skipped.push(`${mLabel} — anchor appears ${n}× in ${file}, so it is ambiguous`);
    }

    // Pre-flight 2 — a red baseline makes every result meaningless.
    process.stdout.write(`  ${label}: checking the baseline is green… `);
    const base = run();
    if (base.red) {
      console.log('RED');
      console.log(`\n  ABORTED. The suite fails before any mutant is seeded: ${base.threw ? 'it threw' : base.failed.join(', ')}.`);
      console.log('  A mutant "caught" by an already-red suite proves nothing. Fix the tree first.');
      return { caught: 0, total: 0, aborted: true };
    }
    console.log('green');

    let n = 0;
    for (const [file, from, to, mLabel, expectedId] of mutants) {
      n++;
      const src = remember(file);
      if (src.split(from).length - 1 !== 1) { console.log(`  SKIP     ${mLabel}`); continue; }
      let r;
      try {
        // The sentinel goes down BEFORE the defect goes in, so the window in
        // which the tree is dirty and unrecoverable is empty rather than small.
        writeFileSync(SENTINEL, JSON.stringify({ file, original: src, label: mLabel }));
        writeFileSync(join(ROOT, file), src.replace(from, to));
        r = run();
      } finally {
        // THE POINT OF THE WHOLE FILE. Not after the call — around it.
        endMutation(file, src);
      }
      if (!r.red) { escaped.push(mLabel); console.log(`  ESCAPED  [${n}/${mutants.length}] ${mLabel}`); continue; }
      caught++;
      // Caught, but by the right assertion? A defect that trips some unrelated
      // check still shows the gate has SOME grip, and it is worth distinguishing
      // from a targeted catch when deciding whether an assertion earns its name.
      if (expectedId && !r.threw && !r.failed.includes(expectedId)) {
        misattributed.push(`${mLabel} — expected ${expectedId}, got ${r.failed.join(',') || 'a throw'}`);
        console.log(`  caught*  [${n}/${mutants.length}] ${mLabel}  (via ${r.failed.join(',') || 'throw'}, not ${expectedId})`);
      } else {
        console.log(`  caught   [${n}/${mutants.length}] ${mLabel}`);
      }
    }
  } finally {
    restoreAll();
  }

  // Verification. Saying "restored" is cheap; demonstrating it is the point.
  process.stdout.write(`\n  working tree restored — re-running ${label} to confirm… `);
  const after = run();
  console.log(after.red ? 'STILL RED — INVESTIGATE' : 'green');

  const total = mutants.length - skipped.length;
  console.log(`\n  ${caught}/${total} seeded defects caught`);
  if (skipped.length) console.log(`  skipped:\n    - ${skipped.join('\n    - ')}`);
  if (misattributed.length) console.log(`  caught by a different assertion than expected:\n    - ${misattributed.join('\n    - ')}`);
  if (escaped.length) console.log(`  ESCAPES:\n    - ${escaped.join('\n    - ')}`);
  return { caught, total, escaped, skipped, misattributed, cleanAfter: !after.red };
}
