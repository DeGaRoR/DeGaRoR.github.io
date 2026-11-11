// the cowl layer's side and plan silhouettes (its triangles filled), read per column: top / bottom (side), half width (plan)
const D = window.CAGE_DATUM || {}, S = __scene; S.updateMatrixWorld(true);
let grp = null; S.traverse(o => { if (!grp && o.name === 'cageLayer:cowl') grp = o; });
const out = { datum: D, cowl: window.CAGE_COWL ? { len: window.CAGE_COWL.len, units: window.CAGE_COWL.units } : null, cols: [] };
if (!grp) return JSON.stringify(out);
const vis = o => { let p = o; while (p) { if (p.visible === false) return false; p = p.parent; } return true; };
const PX = 200, tris = [];
const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
let z0 = 1e9, z1 = -1e9;
grp.traverse(o => { if (!o.isMesh || !vis(o) || !o.geometry || !o.geometry.attributes.position) return;
  if (o.userData && (o.userData.edHi || o.userData.edHw)) return;
  const g = o.geometry, pos = g.attributes.position, idx = g.index, n = idx ? idx.count : pos.count;
  for (let i = 0; i < n; i += 3) {
    const ia = idx ? idx.getX(i) : i, ib = idx ? idx.getX(i + 1) : i + 1, ic = idx ? idx.getX(i + 2) : i + 2;
    va.fromBufferAttribute(pos, ia).applyMatrix4(o.matrixWorld); vb.fromBufferAttribute(pos, ib).applyMatrix4(o.matrixWorld); vc.fromBufferAttribute(pos, ic).applyMatrix4(o.matrixWorld);
    tris.push([va.x, va.y, va.z, vb.x, vb.y, vb.z, vc.x, vc.y, vc.z]);
    z0 = Math.min(z0, va.z, vb.z, vc.z); z1 = Math.max(z1, va.z, vb.z, vc.z); } });
const nC = Math.ceil((z1 - z0) * PX) + 1, top = new Array(nC).fill(-1e9), bot = new Array(nC).fill(1e9), hw = new Array(nC).fill(0);
// a triangle covers column c over the z range it spans there; its y (and |x|) extent at that column, by clipping
for (const t of tris) {
  const P = [[t[0], t[1], t[2]], [t[3], t[4], t[5]], [t[6], t[7], t[8]]];
  const zmin = Math.min(P[0][2], P[1][2], P[2][2]), zmax = Math.max(P[0][2], P[1][2], P[2][2]);
  const c0 = Math.max(0, Math.floor((zmin - z0) * PX)), c1 = Math.min(nC - 1, Math.ceil((zmax - z0) * PX));
  for (let c = c0; c <= c1; c++) {
    const z = z0 + c / PX; const pts = [];
    for (let e = 0; e < 3; e++) { const A = P[e], B = P[(e + 1) % 3];
      if ((A[2] - z) * (B[2] - z) <= 0 && A[2] !== B[2]) { const u = (z - A[2]) / (B[2] - A[2]); pts.push([A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u]); }
      else if (A[2] === z) pts.push([A[0], A[1]]); }
    if (!pts.length && zmax - zmin < 1 / PX) for (const A of P) pts.push([A[0], A[1]]);
    for (const q of pts) { if (q[1] > top[c]) top[c] = q[1]; if (q[1] < bot[c]) bot[c] = q[1]; if (Math.abs(q[0]) > hw[c]) hw[c] = Math.abs(q[0]); }
  }
}
for (let c = 0; c < nC; c += 2) if (top[c] > -1e8) out.cols.push([z0 + c / PX, hw[c], bot[c], top[c]]);
return JSON.stringify(out);
