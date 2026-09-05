// _rigidity.js — the rigidity-matrix rank test, lifted out of test_gen.js
// (G185) so the BIPLANE gate can ask the same question of a truss: assemble
// the 3n-column rigidity matrix of a pin-jointed framework and require full
// rank, 3n - 6. That catches any MECHANISM — the DC-3's missing drag truss,
// the Chinook's latch, a biplane bay with its wires cut — including ones no
// face audit would see, and it is the only instrument in the battery that can.
// Gaussian elimination with partial pivoting; the tolerance is scaled by the
// largest pivot so it is unit-independent. The body is test_gen's verbatim.
'use strict';
function rigidityRank(nodes, beams) {
  const n3 = nodes.length * 3;
  const rows = beams.map(b => {
    const r = new Float64Array(n3);
    const A = nodes[b.a].p, B = nodes[b.b].p;
    let dx = B[0]-A[0], dy = B[1]-A[1], dz = B[2]-A[2];
    const L = Math.hypot(dx, dy, dz) || 1;
    dx /= L; dy /= L; dz /= L;
    r[b.a*3] = dx; r[b.a*3+1] = dy; r[b.a*3+2] = dz;
    r[b.b*3] = -dx; r[b.b*3+1] = -dy; r[b.b*3+2] = -dz;
    return r;
  });
  let rank = 0, big = 0;
  for (let col = 0; col < n3 && rank < rows.length; col++) {
    let piv = -1, best = 0;
    for (let r = rank; r < rows.length; r++) {
      const v = Math.abs(rows[r][col]);
      if (v > best) { best = v; piv = r; }
    }
    big = Math.max(big, best);
    if (piv < 0 || best < 1e-9 * Math.max(1, big)) continue;
    const t = rows[rank]; rows[rank] = rows[piv]; rows[piv] = t;
    const pr = rows[rank], pv = pr[col];
    for (let r = rank + 1; r < rows.length; r++) {
      const f = rows[r][col] / pv;
      if (f === 0) continue;
      for (let c = col; c < n3; c++) rows[r][c] -= f * pr[c];
    }
    rank++;
  }
  return rank;
}
// the framework is rigid iff the rank is 3n - 6 (the six rigid-body motions)
function isRigid(nodes, beams) {
  return rigidityRank(nodes, beams) === 3 * nodes.length - 6;
}
module.exports = { rigidityRank, isRigid };
