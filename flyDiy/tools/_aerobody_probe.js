// GATE AEROBODY's probe (FLYDIY_JOIN_PROBE, run in the page context after the last build, tools/_load_build.js): THE
// DRAWN BODY'S EXTENTS, read off the drawing itself and not off the join's record - the drawn skin's own ends (the gear
// layer's sampler of the cage, CAGE_GEAR.AF: z1 the nose, z0 the tail, the rod included) and the cowl layer's mesh (its
// fore / aft extremes in the mount frame), with the datum the join measured in (CAGE_DATUM: x = zFw - z)
const G2 = window.CAGE_GEAR || {}, AF = G2.AF, D = window.CAGE_DATUM || {};
const out = { zFw: D.zFw, fwOk: !!D.fwOk, af: AF && isFinite(AF.z0) && isFinite(AF.z1) ? { z0: AF.z0, z1: AF.z1 } : null, cowl: null };
let mnt = null; __scene.traverse(o => { if (!mnt && o.name && /mount/i.test(o.name) && o.children && o.children.some(c => /^cageLayer:/.test(c.name))) mnt = o; });
let grp = null; __scene.traverse(o => { if (!grp && o.name === 'cageLayer:cowl') grp = o; });
if (grp) {
  __scene.updateMatrixWorld(true);
  const inv = mnt ? new THREE.Matrix4().copy(mnt.matrixWorld).invert() : new THREE.Matrix4();
  const tmp = new THREE.Matrix4(), v = new THREE.Vector3();
  let z0 = 1e9, z1 = -1e9;
  const vis = o => { let p = o; while (p) { if (p.visible === false) return false; p = p.parent; } return true; };
  grp.traverse(o => {
    if (!o.isMesh || !vis(o) || !o.geometry || !o.geometry.attributes.position) return;
    if (o.userData && (o.userData.edHi || o.userData.edHw)) return;
    tmp.multiplyMatrices(inv, o.matrixWorld);
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { v.set(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(tmp); if (v.z < z0) z0 = v.z; if (v.z > z1) z1 = v.z; }
  });
  if (z1 > z0) out.cowl = { z0, z1, aft: !!(window.CAGE_COWL && window.CAGE_COWL.units && window.CAGE_COWL.units[0] && window.CAGE_COWL.units[0].aft) };
}
// (12 Nov, the rod's height) THE FIN'S ROOT, read off the fin layer's own mesh: the lowest point of a vertical ray through
// the fin every 5 cm along the body (mount frame -> x from the firewall, y over the keel datum) - a fin standing on a rod
// stands on its top, so the drawn rod's height is checked against the drawing and not against the record
{
  let mnt = null; __scene.traverse(o => { if (!mnt && o.name && /^cageLayer:/.test(o.name) && o.parent) mnt = o.parent; });
  let fin = null; __scene.traverse(o => { if (!fin && o.name === 'cageLayer:fin') fin = o; });
  if (mnt && fin && isFinite(D.yD)) {
    __scene.updateMatrixWorld(true);
    const vis = o => { let p = o; while (p) { if (p.visible === false) return false; p = p.parent; } return true; };
    const ms = []; fin.traverse(o => { if (o.isMesh && vis(o) && o.geometry) ms.push(o); });
    const inv = new THREE.Matrix4().copy(mnt.matrixWorld).invert(), RC = new THREE.Raycaster(), fr = [];
    for (let x = -1; x <= 9; x += 0.05) {
      const a = new THREE.Vector3(0, 20, D.zFw - x).applyMatrix4(mnt.matrixWorld), b = new THREE.Vector3(0, -20, D.zFw - x).applyMatrix4(mnt.matrixWorld);
      RC.set(a, b.clone().sub(a).normalize()); RC.far = 40;
      const ys = RC.intersectObjects(ms, false).map(h => h.point.clone().applyMatrix4(inv).y - D.yD);
      if (ys.length) fr.push([+x.toFixed(2), +Math.min(...ys).toFixed(4)]);
    }
    out.finRoot = fr;
  }
}
return JSON.stringify(out);
