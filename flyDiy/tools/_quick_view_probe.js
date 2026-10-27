// _quick_view_probe.js - the page-side half of tools/quick_view.js (run by _load_build's FLYDIY_JOIN_PROBE in the page's
// own context, after the last build): every visible mesh of the editor's scene, in world space, as ONE indexed triangle
// soup - a vertex list (x y z), its colours (r g b a, 0-255, the material's colour) and the triangles, the opaque first.
// A dense part (over DENSE triangles: the radial engines, the people) is thinned by snapping its vertices to a grid of
// its own size / CELLS and dropping the triangles that collapse - a look, not a measurement.
const THREE = window.THREE, sc = window.__scene, DENSE = 6000, CELLS = 64;
sc.updateMatrixWorld(true);
const V = [], C = [], opaque = [], clear = [];
const v = new THREE.Vector3(), M = new THREE.Matrix4(), IM = new THREE.Matrix4();
let parts = 0, trisIn = 0;
const shown = o => { for (let p = o; p; p = p.parent) if (p.visible === false) return false; return true; };
sc.traverse(o => {
  if (!o.isMesh || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.position || !shown(o)) return;
  const g = o.geometry, pos = g.attributes.position, idx = g.index, vc = g.attributes.color;
  const n = idx ? idx.count : pos.count;
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  const groups = Array.isArray(o.material) && g.groups.length ? g.groups : [{ start: 0, count: n, materialIndex: 0 }];
  const inst = o.isInstancedMesh ? o.count : 1;
  if (!g.boundingBox) g.computeBoundingBox();
  const bb = g.boundingBox, size = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z, 1e-6);
  const cell = n / 3 > DENSE ? size / CELLS : 0;
  for (let k = 0; k < inst; k++) {
    M.copy(o.matrixWorld);
    if (o.isInstancedMesh) { o.getMatrixAt(k, IM); M.multiply(IM); }
    for (const gr of groups) {
      const m = mats[gr.materialIndex] || mats[0];
      if (!m || m.visible === false || (m.transparent && m.opacity < 0.05) || m.colorWrite === false) continue;
      const col = m.color || { r: 0.7, g: 0.7, b: 0.7 }, a = m.transparent ? Math.max(0.15, Math.min(1, m.opacity)) : 1;
      const useVC = vc && m.vertexColors;
      const local = new Map(), list = a < 1 ? clear : opaque;
      const vert = i => {
        let key = i;
        if (cell) key = Math.round(pos.getX(i) / cell) + ',' + Math.round(pos.getY(i) / cell) + ',' + Math.round(pos.getZ(i) / cell);
        let id = local.get(key);
        if (id === undefined) {
          id = V.length / 3; local.set(key, id);
          v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
          if (cell) v.set(Math.round(v.x / cell) * cell, Math.round(v.y / cell) * cell, Math.round(v.z / cell) * cell);
          v.applyMatrix4(M); V.push(v.x, v.y, v.z);
          const r = useVC ? vc.getX(i) : 1, gg = useVC ? vc.getY(i) : 1, b = useVC ? vc.getZ(i) : 1;
          C.push(Math.round(255 * Math.min(1, col.r * r)), Math.round(255 * Math.min(1, col.g * gg)),
                 Math.round(255 * Math.min(1, col.b * b)), Math.round(255 * a));
        }
        return id;
      };
      const end = Math.min(n, gr.start + gr.count);
      for (let t = gr.start; t + 2 < end; t += 3) {
        const i0 = idx ? idx.getX(t) : t, i1 = idx ? idx.getX(t + 1) : t + 1, i2 = idx ? idx.getX(t + 2) : t + 2;
        const a0 = vert(i0), a1 = vert(i1), a2 = vert(i2); trisIn++;
        if (a0 !== a1 && a1 !== a2 && a0 !== a2) list.push(a0, a1, a2);
      }
      parts++;
    }
  }
});
// THE FUSELAGE: the page draws its skin straight off the sheet (no layer does, so the headless scene has none) - the
// sheet's own faces here, cage units x planeScale, coloured by their material tag: glass, the dash, the structure, skin
{
  const P = window.CAGE_UI && window.CAGE_UI.P, G = window.CAGE2;
  const sh = P && G && G.cageSheet ? G.cageSheet(P, { level: 2 }).sheet : null;
  if (sh) {
    const k = (G.CAGE_UNIT || 1) * (+P.planeScale || 1), base = V.length / 3;
    const GLASS = /window|windshield|pane$|drawnPane/i, DASH = /^dash/, FRAME = /^pillar|joint|Loop$|bulkhead/;
    const rgba = m => GLASS.test(m) ? [150, 190, 220, 90] : DASH.test(m) ? [45, 48, 54, 255]
                    : FRAME.test(m) ? [120, 126, 134, 255] : [196, 201, 207, 255];
    // one vertex per (sheet vertex, colour): a face's colour is its tag's
    const ids = new Map();
    const vert = (i, c) => { const key = i * 4 + (c[3] < 255 ? 1 : c[0] === 45 ? 2 : c[0] === 120 ? 3 : 0);
      let id = ids.get(key); if (id === undefined) { id = V.length / 3; ids.set(key, id); const p = sh.V[i];
        V.push(p[0] * k, p[1] * k, p[2] * k); C.push(...c); } return id; };
    for (const f of sh.F) {
      const c = rgba(f.m), list = c[3] < 255 ? clear : opaque, w = f.v.map(i => vert(i, c));
      for (let t = 1; t + 1 < w.length; t++) { list.push(w[0], w[t], w[t + 1]); trisIn++; }
    }
    parts += V.length / 3 > base ? 1 : 0;
  }
}
// (plain arrays: the chain's child hands its result back as JSON - the positions in tenths of a millimetre, as integers)
return { V: V.map(x => Math.round(x * 1e4)), C, I: opaque.concat(clear), nOpaque: opaque.length, parts, trisIn };
