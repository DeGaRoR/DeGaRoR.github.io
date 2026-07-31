// tools/_zrefl.mjs — HOW OFTEN A MIRRORED LIMB IS ITS OWN MIRROR.
//
// morphogen.js placeChild builds the attachment point as
//
//     anchor[k] = faceNormal[k]*pHalf[k]
//               + faceRight[k]*pHalf[k]*position[0]
//               + faceUp[k]   *pHalf[k]*position[1]
//
// and `reflectX` mirrors by NEGATING faceRight. The negation reaches the anchor
// only through the term it multiplies, so at `position[0] === 0` the mirrored
// variant lands on exactly the same point as the original — same anchor, and the
// rotation follows the same axes up to a parity flip. One of the two is then
// rejected by the overlap test, and the connection spent its reflection flag on
// nothing. Same for `reflectY` and `position[1]`.
//
// `reflectZ` negates faceNormal, which is not scaled by any position component,
// so it has no degenerate zone and is not counted here.
//
// The morphogen is CORRECT — this is what a reflection about a plane through the
// face centre means. The fix belongs in the generators: §2.2's clamp requires
// |position[0]| >= reflectMinOffset whenever reflectX is set.
//
//   node tools/_zrefl.mjs [N]
import { fileURLToPath } from 'node:url';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome, SLICE_LIMITS } from '../engine/l1/factory.js';

const N = Number(process.argv[2] ?? 2000);
const ZONE = SLICE_LIMITS.reflectMinOffset ?? 0.6;

export function measureReflection(n = 2000, limits = SLICE_LIMITS, zone = 0.6, ns = 'div') {
  let reflected = 0, degenerate = 0, xSet = 0, xDegen = 0, ySet = 0, yDegen = 0, zOnly = 0, conns = 0;

  for (let i = 0; i < n; i++) {
    for (const c of createRandomGenome(rngFrom(ns, i), limits).connections) {
      conns++;
      const any = c.reflectX || c.reflectY || c.reflectZ;
      if (!any) continue;
      reflected++;
      let degen = false;
      if (c.reflectX) { xSet++; if (Math.abs(c.position[0]) < zone) { xDegen++; degen = true; } }
      if (c.reflectY) { ySet++; if (Math.abs(c.position[1]) < zone) { yDegen++; degen = true; } }
      if (c.reflectZ && !c.reflectX && !c.reflectY) zOnly++;
      if (degen) degenerate++;
    }
  }
  return { conns, reflected, degenerate, xSet, xDegen, ySet, yDegen, zOnly };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const r = measureReflection(N, SLICE_LIMITS, ZONE);
  const pc = (a, b) => b ? `${(100 * a / b).toFixed(1)}%` : 'n/a';
  console.log(`\n  _zrefl · ${N} genomes · ${r.conns} connections · degenerate zone |position| < ${ZONE}\n`);
  console.log(`  connections carrying any reflection   ${String(r.reflected).padStart(6)}  ${pc(r.reflected, r.conns)}`);
  console.log(`  ... at least one axis degenerate      ${String(r.degenerate).padStart(6)}  ${pc(r.degenerate, r.reflected)} of reflected`);
  console.log(`  reflectX set                          ${String(r.xSet).padStart(6)}  of which degenerate ${pc(r.xDegen, r.xSet)}`);
  console.log(`  reflectY set                          ${String(r.ySet).padStart(6)}  of which degenerate ${pc(r.yDegen, r.ySet)}`);
  console.log(`  reflectZ only (no degenerate zone)     ${String(r.zOnly).padStart(6)}  ${pc(r.zOnly, r.reflected)} of reflected\n`);
  console.log(`  gate: 0 degenerate reflected connections once the clamp is in\n`);
}
