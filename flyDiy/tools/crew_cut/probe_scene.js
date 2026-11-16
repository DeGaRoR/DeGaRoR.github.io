// probe_scene.js - A FUNCTION BODY for tools/_load_build.js (FLYDIY_JOIN_PROBE=<this file>), run by crew_cut/dump.js.
// probe body: every visible mesh's triangles in world metres (skinned meshes posed), tagged by layer and name
const sc = __scene; sc.updateMatrixWorld(true);
const out = [], v = new THREE.Vector3();
sc.traverse(o => {
  if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
  for (let q = o; q; q = q.parent) if (q.visible === false) return;
  let layer = '', path = [];
  for (let q = o; q && q !== sc; q = q.parent) { if (q.name) path.push(q.name); if (/^cageLayer:/.test(q.name || '')) { layer = q.name.slice(10); break; } }
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  const col = m && m.color ? [m.color.r, m.color.g, m.color.b].map(x => Math.round(x * 255)) : [180, 180, 180];
  const op = m && m.transparent ? m.opacity : 1;
  const pos = o.geometry.attributes.position, idx = o.geometry.index, n = idx ? idx.count : pos.count;
  const P = [];
  const get = i => { const j = idx ? idx.getX(i) : i; v.fromBufferAttribute(pos, j);
    if (o.isSkinnedMesh) { if (o.applyBoneTransform) o.applyBoneTransform(j, v); else if (o.boneTransform) o.boneTransform(j, v); }
    v.applyMatrix4(o.matrixWorld); return [Math.round(v.x * 1000), Math.round(v.y * 1000), Math.round(v.z * 1000)]; };
  for (let i = 0; i + 2 < n; i += 3) P.push(...get(i), ...get(i + 1), ...get(i + 2));
  out.push({ layer, name: path.slice(0, 4).join('<'), col, op, skinned: !!o.isSkinnedMesh, P });
});
const C = window.CAGE_CREW || {}, st = (C.stations || [])[0];
const reach = st ? (st.jobs || []).map(j => [j.label, +Math.hypot(j.wrist[0]-j.grip[0], j.wrist[1]-j.grip[1], j.wrist[2]-j.grip[2]).toFixed(3)]) : [];
return { meshes: out, reach, zBack: C.A && C.A.zBack };
