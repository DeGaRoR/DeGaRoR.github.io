// tools/_mut_h9.mjs — mutation test for the H9 joint-angle frame fix.
import { runMutants } from './_mutate.mjs';

runMutants({
  label: 'H9 joint-angle frame',
  suiteModule: 'motion.js',
  runner: 'runMotionGate',
  mutants: [
    // The original defect, now only expressible INSIDE relativeAngle — which is
    // the point of removing the parameter. With the parameter still there this
    // mutant escaped: the assertion pressed the arithmetic while the bug lived
    // at the call site.
    ['engine/l1/physics.js', 'swingTwistAngle(bodies[j.parentBody].rotation(), bodies[j.childBody].rotation(), jointAxes[jointIndex])',
     'swingTwistAngle(bodies[j.parentBody].rotation(), bodies[j.childBody].rotation(), qrot([bodies[j.parentBody].rotation().x, bodies[j.parentBody].rotation().y, bodies[j.parentBody].rotation().z, bodies[j.parentBody].rotation().w], jointAxes[jointIndex]))',
     'the world-space axis is back (the original defect)', 'L1-22'],
    ['engine/l1/physics.js', '  const proj = rx * axisLocal[0] + ry * axisLocal[1] + rz * axisLocal[2];',
     '  const proj = rx * axisLocal[0] + ry * axisLocal[1];', 'the projection drops an axis', 'L1-23m'],
    ['engine/l1/physics.js', '  const cx = -qp.x, cy = -qp.y, cz = -qp.z, cw = qp.w;',
     '  const cx = qp.x, cy = qp.y, cz = qp.z, cw = qp.w;', 'the parent is not conjugated', 'L1-23m'],
    ['engine/l1/physics.js', '  return 2 * Math.atan2(proj, rw);',
     '  return 2 * Math.asin(Math.max(-1, Math.min(1, proj)));', 'atan2 replaced by asin — wrong past 90 deg', 'L1-23m'],
  ],
});
