// the drawn aeroplane in the PHYSICS frame, exactly: the join's own datums (window.CAGE_DATUM, published by _cage_join:
// cage z = zFw - x, cage y = y + yD) take every point of the editor's scene into the model frame (x aft, y up, z = cage x).
// Every visible mesh's triangles, PLUS the drawn airframe surface itself (window.CAGE_GEAR.AF, sampled ring by ring: the
// editor scene carries no fuselage skin - the game builds it from this surface at run time). Three views at PXM px/m:
// side (u = x, v = -y), plan (u = z, v = x), front (u = z, v = -y); the origin of each mask in metres is returned.
const S = __scene, T = THREE, PXM = 60; S.updateMatrixWorld(true);
const DT = window.CAGE_DATUM || null; if (!DT) return { error: 'no CAGE_DATUM' };
const AF = window.CAGE_GEAR && window.CAGE_GEAR.AF;
const toM = (x, y, z) => [DT.zFw - z, y - DT.yD, x];
const vis = o => { let p = o; while (p) { if (p.visible === false) return false; p = p.parent; } return true; };
const meshes = []; S.traverse(o => { if (o.isMesh && vis(o) && o.geometry && o.geometry.attributes.position) meshes.push(o); });
// the triangles, in the model frame
const tris = []; const v3 = new T.Vector3();
for (const o of meshes) { const g = o.geometry, pos = g.attributes.position, idx = g.index, n = idx ? idx.count : pos.count, mw = o.matrixWorld;
  const P = i => { v3.fromBufferAttribute(pos, i).applyMatrix4(mw); return toM(v3.x, v3.y, v3.z); };
  for (let i = 0; i + 2 < n; i += 3) tris.push(P(idx ? idx.getX(i) : i), P(idx ? idx.getX(i + 1) : i + 1), P(idx ? idx.getX(i + 2) : i + 2)); }
let bodyEnd = null, bodyNose = null, afTris = 0;
if (AF && typeof AF.surf === 'function') {
  const N = 24, ring = z => { const r = []; for (let k = 0; k < N; k++) { const q = AF.surf(z, 2 * Math.PI * k / N); r.push(toM(q[0], q[1], z)); } return r; };
  let prev = null; const dz = 0.02;
  for (let z = AF.z0; z <= AF.z1 + 1e-9; z += dz) { const r = ring(Math.min(z, AF.z1)); if (prev) for (let k = 0; k < N; k++) { const a = prev[k], b = prev[(k + 1) % N], c = r[(k + 1) % N], d = r[k]; tris.push(a, b, c, a, c, d); afTris += 2; } prev = r; }
  bodyEnd = DT.zFw - AF.z0; bodyNose = DT.zFw - AF.z1;
}
let bb = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity];
for (const p of tris) { bb[0] = Math.min(bb[0], p[0]); bb[1] = Math.max(bb[1], p[0]); bb[2] = Math.min(bb[2], p[1]); bb[3] = Math.max(bb[3], p[1]); bb[4] = Math.min(bb[4], p[2]); bb[5] = Math.max(bb[5], p[2]); }
const views = { side: p => [p[0], -p[1]], plan: p => [p[2], p[0]], front: p => [p[2], -p[1]] };
const out = {};
for (const vk in views) {
  const f = views[vk], c = [f([bb[0], bb[2], bb[4]]), f([bb[1], bb[3], bb[5]])];
  const u0 = Math.min(c[0][0], c[1][0]) - 0.05, u1 = Math.max(c[0][0], c[1][0]) + 0.05, v0 = Math.min(c[0][1], c[1][1]) - 0.05, v1 = Math.max(c[0][1], c[1][1]) + 0.05;
  const W = Math.ceil((u1 - u0) * PXM), H = Math.ceil((v1 - v0) * PXM), m = new Uint8Array(W * H);
  const P = p => { const q = f(p); return [(q[0] - u0) * PXM, (q[1] - v0) * PXM]; };
  for (let t = 0; t < tris.length; t += 3) {
    const A = P(tris[t]), B = P(tris[t + 1]), C = P(tris[t + 2]);
    const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), x1 = Math.min(W - 1, Math.floor(Math.max(A[0], B[0], C[0])));
    const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), y1 = Math.min(H - 1, Math.floor(Math.max(A[1], B[1], C[1])));
    const d = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
    if (Math.abs(d) < 1e-9 || (x1 - x0 <= 1 && y1 - y0 <= 1)) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m[y * W + x] = 1; continue; }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5, l1 = ((B[1] - C[1]) * (px - C[0]) + (C[0] - B[0]) * (py - C[1])) / d, l2 = ((C[1] - A[1]) * (px - C[0]) + (A[0] - C[0]) * (py - C[1])) / d;
      if (l1 >= -0.02 && l2 >= -0.02 && l1 + l2 <= 1.02) m[y * W + x] = 1; }
  }
  const rle = []; let cur = 0, run = 0; for (let i = 0; i < m.length; i++) { if (m[i] === cur) run++; else { rle.push(run); cur = m[i]; run = 1; } } rle.push(run);
  out[vk] = { W, H, s: PXM, u0, v0, rle };
}
// the editor's engine record: each unit's mount point and its drawn prop hub (the join's frame), for genAidPropOff
const CE = window.CAGE_ENG && Array.isArray(window.CAGE_ENG.units) ? { units: window.CAGE_ENG.units.map(u => u && { at: u.at && Array.from(u.at), propAt: u.propAt && Array.from(u.propAt) }) } : null;
return { views: out, meshes: meshes.length, afTris, datum: DT, bodyEnd, bodyNose, frame: 'model', eng: CE };
