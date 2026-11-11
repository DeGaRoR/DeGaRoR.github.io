// the drawn aeroplane's three orthographic silhouettes, off the headless editor's own scene: every visible mesh's
// triangles projected and filled. Scene frame: x span, y up, z along (nose +z). Views: side (u = -z, v = -y), plan (u = x,
// v = -z), front (u = x, v = -y). Run-length encoded masks at S px/m.
const S = __scene, T = THREE, PXM = 60; S.updateMatrixWorld(true);
const tri = [], box = new T.Box3();
const vis = o => { let p = o; while (p) { if (p.visible === false) return false; p = p.parent; } return true; };
const va = new T.Vector3(), vb = new T.Vector3(), vc = new T.Vector3();
const meshes = []; S.traverse(o => { if (o.isMesh && vis(o) && o.geometry && o.geometry.attributes.position) meshes.push(o); });
for (const o of meshes) box.union(new T.Box3().setFromObject(o));
const views = { side: p => [-p.z, -p.y], plan: p => [p.x, -p.z], front: p => [p.x, -p.y] };
const out = {};
for (const vk in views) {
  const f = views[vk], c = [box.min, box.max].map(q => f(q));
  const u0 = Math.min(c[0][0], c[1][0]), u1 = Math.max(c[0][0], c[1][0]), v0 = Math.min(c[0][1], c[1][1]), v1 = Math.max(c[0][1], c[1][1]);
  const W = Math.ceil((u1 - u0) * PXM) + 4, H = Math.ceil((v1 - v0) * PXM) + 4, m = new Uint8Array(W * H);
  const P = p => { const q = f(p); return [(q[0] - u0) * PXM + 2, (q[1] - v0) * PXM + 2]; };
  for (const o of meshes) {
    const g = o.geometry, pos = g.attributes.position, idx = g.index, n = idx ? idx.count : pos.count, mw = o.matrixWorld;
    for (let i = 0; i < n; i += 3) {
      const ia = idx ? idx.getX(i) : i, ib = idx ? idx.getX(i + 1) : i + 1, ic = idx ? idx.getX(i + 2) : i + 2;
      va.fromBufferAttribute(pos, ia).applyMatrix4(mw); vb.fromBufferAttribute(pos, ib).applyMatrix4(mw); vc.fromBufferAttribute(pos, ic).applyMatrix4(mw);
      const A = P(va), B = P(vb), C = P(vc);
      const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
      const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
      const d = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
      if (Math.abs(d) < 1e-9) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x1 - x0 <= 1 || y1 - y0 <= 1) m[y * W + x] = 1; continue; }
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const l1 = ((B[1] - C[1]) * (px - C[0]) + (C[0] - B[0]) * (py - C[1])) / d, l2 = ((C[1] - A[1]) * (px - C[0]) + (A[0] - C[0]) * (py - C[1])) / d;
        if (l1 >= -0.02 && l2 >= -0.02 && l1 + l2 <= 1.02) m[y * W + x] = 1;
      }
    }
  }
  const rle = []; let cur = 0, run = 0; for (let i = 0; i < m.length; i++) { if (m[i] === cur) run++; else { rle.push(run); cur = m[i]; run = 1; } } rle.push(run);
  out[vk] = { W, H, s: PXM, rle };
}
return { views: out, meshes: meshes.length };
