// Mutation test for the B3 gate. Seeds a defect, runs the motion suite in a
// child process, and requires the named assertion to fail. The standing lesson
// of this project is that an untested gate is decoration.
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
const MUTATIONS = [
  ['engine/l1/physics.js', 'L1-18', 'maxTorque tracks mass instead of area',
   'const maxTorque = motorScale * j.minCrossSectionalArea;',
   'const maxTorque = motorScale * massOf[j.childBody];'],
  ['engine/l1/physics.js', 'L1-21', 'drag integrated explicitly again',
   'const g = 1 / (1 + (k / m) * FIXED_DT);', 'const g = 1;'],
  ['engine/l1/physics.js', 'L1-21', 'angular drag integrated explicitly again',
   'const ga = 1 / (1 + (ka / I) * FIXED_DT);', 'const ga = 1;'],
  ['engine/l1/controller.js', 'L1-20', 'phase uses own lag, not the parent chain',
   'phases[j.index] = parentJoint < 0 ? 0 : phases[parentJoint] + plan.joints[parentJoint].phaseLag;',
   'phases[j.index] = j.phaseLag;'],
  ['engine/l1/physics.js', 'L1-19', 'environment colliders marked damaging',
   "environment.push({ collider: col, kind, damaging: false });",
   "environment.push({ collider: col, kind, damaging: true });"],
  ['engine/l1/physics.js', 'L1-22', 'motor damping observes only the driven axis',
   `tx = axisWorld[0] * s - d * dwx;
        ty = axisWorld[1] * s - d * dwy;
        tz = axisWorld[2] * s - d * dwz;`,
   `tx = axisWorld[0] * (s - d * relOmega);
        ty = axisWorld[1] * (s - d * relOmega);
        tz = axisWorld[2] * (s - d * relOmega);`],
  ['engine/l1/physics.js', 'L1-18', 'joint contacts re-enabled',
   'if (handle.setContactsEnabled) handle.setContactsEnabled(false);', ''],
];
let caught = 0;
for (const [file, id, what, from, to] of MUTATIONS) {
  copyFileSync(file, file + '.bak');
  const src = readFileSync(file, 'utf8');
  if (!src.includes(from)) { console.log(`  SKIP  ${id}  ${what} — anchor not found`); copyFileSync(file + '.bak', file); continue; }
  writeFileSync(file, src.replace(from, to));
  let out = '';
  try {
    out = execSync(`node -e "import('./gate/motion.js').then(async m=>{const r=await m.runMotionGate();console.log(r.results.filter(a=>a.status!=='pass').map(a=>a.id).join(','))}).catch(e=>console.log('THREW'))"`,
      { encoding: 'utf8', stdio: ['ignore','pipe','ignore'], timeout: 600000 });
  } catch (e) { out = 'THREW'; }
  copyFileSync(file + '.bak', file);
  const failed = out.trim().split('\n').pop().trim();
  const ok = failed.split(',').includes(id) || failed === 'THREW';
  if (ok) caught++;
  console.log(`  ${ok ? 'CAUGHT' : 'ESCAPED'}  ${id}  ${what}${ok ? '' : `  (failing: ${failed || 'none'})`}`);
}
console.log(`\n  ${caught}/${MUTATIONS.length} seeded defects caught`);
