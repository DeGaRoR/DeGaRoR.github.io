// tools/_mut_dens.mjs — mutation test for L1-34 (the slice density band).
//
// CRASH-SAFE, which tools/_mutate.mjs was not. The HANDOFF records that the old
// runner writes a mutant, runs the gate, then restores — and killed in between it
// leaves the mutant in the tree, where it masqueraded as a real L2-15 failure for
// two gate runs. Everything here goes through try/finally, and SIGINT/SIGTERM
// restore before exiting.

import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const MUTANTS = [
  { file: 'engine/l1/factory.js',
    from: 'density: uniform(rng, limits.density ?? RANGE.density),',
    to:   'density: uniform(rng, RANGE.density),',
    name: 'factory draw reverts to the schema range' },
  { file: 'engine/l1/mutate.js',
    from: "case 'density': n.density = jitter(rng, n.density, limits.density ?? RANGE.density); break;",
    to:   "case 'density': n.density = jitter(rng, n.density, RANGE.density); break;",
    name: 'mutation jitter reverts to the schema range' },
  { file: 'engine/l1/mutate.js',
    from: 'density: u(limits.density ?? RANGE.density),   // slice-scoped',
    to:   'density: u(RANGE.density),   // slice-scoped',
    name: 'randomNodeLike reverts to the schema range' },
  { file: 'engine/l1/mutate.js',
    from: "return band[1] > band[0] ? NODE_FIELDS : NODE_FIELDS.filter(f => f !== 'density');",
    to:   'return NODE_FIELDS;',
    name: 'nodeFields stops dropping the dead density field' },
  { file: 'engine/l1/naming.js',
    from: "    ? [] : ['density'],",
    to:   '    ? [] : [],',
    name: 'DEAD_AXES stops skipping the zero-variance axis' },
];

// A SENTINEL ON DISK, because try/finally is NOT enough. A runner killed with
// SIGKILL — which is what happens to a background job here — never runs its
// finally, and the mutant stays in the tree masquerading as a real failure. That
// has now cost this project two gate runs once and one more since. The sentinel
// is written BEFORE the mutation and removed after; gate assertion N24 goes RED
// while it exists, so a leftover mutant announces itself instead of hiding.
const SENTINEL = 'tools/.mutant-active.json';

let active = null;
function restore() {
  if (!active) return;
  writeFileSync(active.file, active.original);
  try { rmSync(SENTINEL, { force: true }); } catch { /* best effort */ }
  active = null;
}
process.on('SIGINT', () => { restore(); process.exit(130); });
process.on('SIGTERM', () => { restore(); process.exit(143); });

const FILTER = process.argv[2] ?? '';
let caught = 0, escaped = [];
for (const m of MUTANTS.filter(x => !FILTER || x.name.includes(FILTER))) {
  const original = readFileSync(m.file, 'utf8');
  if (!original.includes(m.from)) {
    console.log(`SKIP  ${m.name} — anchor not found, the tree has moved`);
    continue;
  }
  active = { file: m.file, original };
  let red = false, which = [];
  try {
    writeFileSync(SENTINEL, JSON.stringify(
      { file: m.file, mutant: m.name, startedAt: new Date().toISOString() }, null, 2));
    writeFileSync(m.file, original.replace(m.from, m.to));
    // ONE invocation, and the non-zero exit IS the expected result. The previous
    // shape ran a second, unguarded execSync when the first did not report RED,
    // and that threw uncaught — the runner died on its own bug rather than on
    // the gate, exactly the failure it was written to avoid.
    let out;
    try {
      out = execSync('node gate/run.js', { stdio: 'pipe', encoding: 'utf8' });
    } catch (e) {
      out = String(e.stdout ?? '') + String(e.stderr ?? '');
    }
    // N24 fires BY DESIGN for the whole of a mutation run — the sentinel is
    // deliberately present — so it must not count as catching anything, or
    // every mutant would look caught and the exercise would be worthless.
    // A mutant is caught only by an assertion aimed at the behaviour it broke.
    which = [...out.matchAll(/\[FAIL\]\s+(\S+)/g)].map(x => x[1]).filter(x => x !== 'N24');
    red = which.length > 0;
    which = which.join(', ') || '--';
  } finally {
    restore();
  }
  if (red) { caught++; console.log(`CAUGHT  ${m.name}  <- ${which}`); }
  else { escaped.push(m.name); console.log(`ESCAPED ${m.name}`); }
}

console.log(`\n${caught}/${MUTANTS.length} caught, ${escaped.length} escaped`);
for (const e of escaped) console.log(`  escape: ${e}`);
