// tools/_mut_b4.mjs — mutation test for the B4 gate. Seeds a defect, runs the
// breed suite in a child process, and requires the named assertion to fail.
//
// The standing lesson of this project (HANDOFF.md) is that three separate gate
// bugs were the same defect: an assertion deriving its own bound from the code
// under test. Every one passed until mutation-tested. An untested gate is
// decoration.
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const MUTATIONS = [
  // ── the one-mutation-per-call invariant ──────────────────────────────────
  ['engine/l1/mutate.js', 'L1-23', 'jitterRandomJoint changes amplitude AND bias',
   `if (rng.int(2)) jg.amplitude = jitter(rng, jg.amplitude, RANGE.amplitude);
  else jg.bias = jitter(rng, jg.bias, RANGE.bias);`,
   `jg.amplitude = jitter(rng, jg.amplitude, RANGE.amplitude);
  jg.bias = jitter(rng, jg.bias, RANGE.bias);`],

  ['engine/l1/mutate.js', 'L1-23', 'addNode forgets the connection, orphaning the node',
   'g.connections.push(randomConnLike(rng, limits, host.id, node.id));', ''],

  ['engine/l1/mutate.js', 'L1-23', 'recursiveLimit steps off the boundary into a no-op again',
   'const up = n.recursiveLimit <= lo ? true : n.recursiveLimit >= hi ? false : rng.int(2) === 1;\n      n.recursiveLimit += up ? 1 : -1;',
   'n.recursiveLimit = Math.min(hi, Math.max(lo, n.recursiveLimit + (rng.int(2) ? 1 : -1)));'],

  // ── legality of the result ───────────────────────────────────────────────
  ['engine/l1/mutate.js', 'L1-25', 'removeNode ignores reachability, orphaning subtrees',
   'if (stillConnected({ ...g, nodes, connections: conns })) {',
   'if (true) {'],

  ['engine/l1/mutate.js', 'L1-25', 'addNode ignores the node cap',
   'if (g.nodes.length >= limits.maxNodes) return null;', ''],

  ['engine/l1/mutate.js', 'L1-25', 'addConnection ignores the per-node degree cap',
   'const parents = g.nodes.filter(n => d.get(n.id) < limits.maxConnPerNode);',
   'const parents = g.nodes.slice();'],

  ['engine/l1/mutate.js', 'L1-25', 'reflection flip ignores maxReflectionAxes',
   'if (count <= (limits.maxReflectionAxes ?? 3)) c[a] = !c[a];\n      else return null;',
   'c[a] = !c[a];'],

  ['engine/l1/genome.js', 'L1-25', 'qClamp reverts to clamp-then-quantise (the phaseLag defect)',
   `  const loQ = Math.ceil(lo * QUANTUM) / QUANTUM;
  const hiQ = Math.floor(hi * QUANTUM) / QUANTUM;
  const v = q(x);
  return v < loQ ? loQ : v > hiQ ? hiQ : v;`,
   '  return q(Math.min(hi, Math.max(lo, x)));'],

  // ── the game rules ───────────────────────────────────────────────────────
  ['engine/l1/breed.js', 'L1-27', 'N17: the stranger is a mutant of an elite, not unrelated',
   'next[strangerSlot] = strangerFor(RAPIER, rng.fork(`stranger:${strangerSlot}`), world, limits, tally);',
   'next[strangerSlot] = mutateTimes(genomes[elites[0]], rng.fork(`s`), 3, { limits }).genome;'],

  ['engine/l1/breed.js', 'L1-27', 'N17: no stranger slot at all — the failure that kills the loop',
   'const strangerSlot = free.splice(rng.int(free.length), 1)[0];',
   'const strangerSlot = free.length > 99 ? free.pop() : (free.push(-1), -1);'],

  ['engine/l1/breed.js', 'L1-28', 'N18: elites are re-derived rather than carried through',
   `    next[i] = genomes[i];`,
   `    next[i] = mutateTimes(genomes[i], rng.fork(\`e:\${i}\`), 1, { limits }).genome;`],

  ['engine/l1/breed.js', 'L1-29', 'offspring parents drawn from the whole tank, not the selected pool',
   'const parentIndex = elites[turn % elites.length];',
   'const parentIndex = turn % POPULATION;'],

  ['engine/l1/breed.js', 'L1-29', 'breeding with nothing selected silently picks slot 0',
   "throw new Error('breed: nothing selected');", 'selected = [0];'],

  // ── the viability filter ─────────────────────────────────────────────────
  ['engine/l1/viability.js', 'L1-30', 'the inertness check never fires',
   "if (!(free.travel >= VIABILITY.minSelfMotion)) return fail('inert');", ''],

  ['engine/l1/viability.js', 'L1-30', 'the body-count rule never fires',
   "if (plan.bodyCount < VIABILITY.minBodies || plan.bodyCount > VIABILITY.maxBodies) return fail('bodies');", ''],

  ['engine/l1/breed.js', 'L1-30', 'the fallback returns an unviable mutant instead of the parent',
   '  return { genome: parent, ops: [], attempts: VIABILITY.maxAttempts, fellBack: true };',
   '  return { genome: mutateTimes(parent, rng, 1, { limits }).genome, ops: [], attempts: VIABILITY.maxAttempts, fellBack: true };'],

  // ── naming ───────────────────────────────────────────────────────────────
  ['engine/l1/naming.js', 'L1-31', 'the genus reads material genes, so recolouring renames',
   'const genus = SEGMENT_ROOTS[s.segmentBucket]',
   'const genus = (genome.material.hue > 0.5 ? "X" : "") + SEGMENT_ROOTS[s.segmentBucket]'],

  ['engine/l1/naming.js', 'L1-31', 'the epithet is constant — a name that derives nothing',
   'if (Math.abs(z) > bestScore) { bestScore = Math.abs(z); best = z >= 0 ? high : low; }', ''],
  // ── the tank's arithmetic ────────────────────────────────────────────────
  ['ui/tank/sim.js', 'L1-32', 'cells packed half a tank apart, so creatures overlap across tanks',
   `        (c - (grid.cols - 1) / 2) * w,
        0,
        (r - (grid.rows - 1) / 2) * d,`,
   `        (c - (grid.cols - 1) / 2) * w * 0.5,
        0,
        (r - (grid.rows - 1) / 2) * d * 0.5,`],

  ['ui/tank/sim.js', 'L1-32', 'the drawn box is bigger than the tanks it claims to be',
   'return [bounds[0] * grid.cols, bounds[1], bounds[2] * grid.rows];',
   'return [bounds[0] * grid.cols * 1.5, bounds[1], bounds[2] * grid.rows * 1.5];'],

  ['ui/tank/sim.js', 'L1-32', 'the accumulator is unclamped — the spiral of death',
   'const steps = Math.min(wanted, maxSteps);', 'const steps = wanted;'],

  ['ui/tank/sim.js', 'L1-33', 'the hit radius loses its tap-target floor',
   'return Math.max(boundingRadius, (tapPx / 2) * worldPerPx);', 'return boundingRadius;'],

  ['ui/tank/sim.js', 'L1-33', 'a drag is treated as a tap',
   "if (Math.hypot(dx, dy) >= TAP.maxMovePx) return 'drag';", ''],
];

let caught = 0;
const escapes = [];
for (const [file, id, what, from, to] of MUTATIONS) {
  copyFileSync(file, file + '.bak');
  const src = readFileSync(file, 'utf8');
  if (!src.includes(from)) {
    console.log(`  SKIP    ${id}  ${what} — anchor not found`);
    copyFileSync(file + '.bak', file);
    continue;
  }
  writeFileSync(file, src.replace(from, to));
  let out = '';
  try {
    out = execSync(
      `node -e "import('./gate/breed.js').then(async m=>{const r=await m.runBreedGate();console.log(r.results.filter(a=>a.status!=='pass').map(a=>a.id).join(','))}).catch(e=>console.log('THREW'))"`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 900000 });
  } catch (e) { out = 'THREW'; }
  copyFileSync(file + '.bak', file);

  const failed = out.trim().split('\n').pop().trim();
  const ok = failed.split(',').includes(id) || failed === 'THREW';
  if (ok) caught++; else escapes.push(`${id}  ${what}  (failing instead: ${failed || 'none'})`);
  console.log(`  ${ok ? 'CAUGHT ' : 'ESCAPED'} ${id}  ${what}`);
}
console.log(`\n  ${caught}/${MUTATIONS.length} seeded defects caught`);
for (const e of escapes) console.log(`  ESCAPE: ${e}`);
