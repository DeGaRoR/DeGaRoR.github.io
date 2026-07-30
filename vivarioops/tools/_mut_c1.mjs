// tools/_mut_c1.mjs — mutation test for gate/probe.js (C1).
// Standing lesson: "Mutation-test every gate before accepting green." Four gate
// bugs in this project were the same defect — an assertion deriving its own
// bound from the code under test — and every one passed until mutation-tested.
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const MUTANTS = [
  ['engine/l2/probe.js', 'return n ? s / n : 0;', 'return n ? s / n * 1.5 : 0;', 'meanSpeed inflated 50%'],
  ['engine/l2/probe.js', 's += horizontal ? Math.hypot(x, z) : Math.hypot(x, y, z);', 's += Math.hypot(x, y, z);', 'meanSpeed ignores the horizontal flag'],
  ['engine/l2/probe.js', 'if (i >= trace.capacity) return false;', 'if (i >= trace.capacity + 1) return false;', 'trace overflow guard off by one'],
  ['engine/l2/probe.js', 'const every = Math.round((1 / SAMPLE_HZ) / FIXED_DT);', 'const every = 1;', 'samples at the physics rate, not 20 Hz'],
  ['engine/l2/probe.js', 'while (d > Math.PI) d -= 2 * Math.PI;', 'while (d > Math.PI * 3) d -= 2 * Math.PI;', 'heading unwrap disabled'],
  ['engine/l2/probe.js', 'return seed(BRIDGE_V, worldHashStr, subjectHash, probeId, repeat);', 'return seed(BRIDGE_V, worldHashStr, subjectHash, probeId);', 'seed drops the repeat'],
  ['engine/l2/probes.js', 'const turnRate = Math.abs(out[0].rate - out[1].rate) / 2;', 'const turnRate = Math.abs(out[0].rate);', 'S3 back to a single run: measures curl'],
  ['engine/l2/probes.js', 'spread(vs) < MIN_EFFORT_SPREAD || spread(ps) < MIN_EFFORT_SPREAD;', 'spread(vs) < MIN_EFFORT_SPREAD;', 'degeneracy ignores flat power'],
  ['engine/l2/probes.js', 'if (indistinguishable || singular) {', 'if (singular) {', 'degeneracy check removed entirely'],
  ['engine/l2/probes.js', 'reach = Math.max(reach, Math.hypot(', 'reach = Math.min(reach, Math.hypot(', 'reach takes the minimum'],
  ['engine/l2/probes.js', 'return clear / dirs.length;', 'return 1;', 'torsoExposure always fully exposed'],
  ['engine/l2/probes.js', 'if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }', '', 'rayObb slab swap removed'],
  ['engine/l1/controller.js', 'if (turn !== 0) dst[i] += sides[i] * turn * TURN_AUTHORITY * range;', '', 'turn bias never applied'],
  ['engine/l1/controller.js', 'sides[j.index] = isMirrored(plan.bodies[j.childBody]) ? 1 : -1;', 'sides[j.index] = 1;', 'sides are not a differential'],
  ['engine/l1/controller.js', 'const clamp1 = (x) => (x < -1 ? -1 : x > 1 ? 1 : x);', 'const clamp1 = (x) => x;', 'sensor bias unclamped'],
  ['engine/l2/compile.js', "sp.pursuitGain = world.pursuitGain;", "sp.pursuitGain = 0.6;", 'fixture default hard-coded (30 D1)'],
  ['engine/l2/compile.js', 'sp.massMin = thresholds.massMin;', 'sp.massMin = thresholds.massReproduce;', 'threshold ordering broken'],
  ['engine/l2/compile.js', 'if (!loco.valid) return { species: null, valid: false, reason: loco.reason, detail: { stage: \'S2\' } };', '', 'invalid S2 result used anyway'],
];

let caught = 0, escaped = [];
for (const [file, from, to, label] of MUTANTS) {
  const orig = readFileSync(file, 'utf8');
  if (!orig.includes(from)) { console.log(`  SKIP  ${label} — anchor not found`); continue; }
  writeFileSync(file, orig.replace(from, to));
  let red = false;
  try {
    execSync('node -e "import(\'./gate/probe.js\').then(async m=>{const r=await m.runProbeGate();process.exit(r.failed>0?1:0)}).catch(()=>process.exit(1))"',
      { stdio: 'pipe', timeout: 900000 });
  } catch { red = true; }
  writeFileSync(file, orig);
  if (red) { caught++; console.log(`  caught  ${label}`); }
  else { escaped.push(label); console.log(`  ESCAPED ${label}`); }
}
console.log(`\n  ${caught}/${caught + escaped.length} seeded defects caught`);
if (escaped.length) console.log(`  escapes: ${escaped.join(' · ')}`);
