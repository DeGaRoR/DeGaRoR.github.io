const G2 = window.CAGE_GEAR || {}, AF = G2.AF, D = window.CAGE_DATUM || {};
const out = { datum: D, afKeys: AF ? Object.keys(AF) : null };
if (AF) {
  out.z0 = AF.z0; out.z1 = AF.z1;
  const rows = [];
  for (let i = 0; i <= 80; i++) { const z = AF.z1 + (AF.z0 - AF.z1) * i / 80;
    let w = null, yb = null, yt = null; try { w = AF.halfWAt(z); yb = AF.surf(z, 0)[1]; yt = AF.surf(z, Math.PI)[1]; } catch (e) { w = 'ERR ' + e.message; }
    rows.push([z, w, yb, yt]); }
  out.rows = rows;
}
// the visible meshes: name chain and z/x/y bounds in the mount frame
const S = __scene; S.updateMatrixWorld(true);
const vis = o => { let p = o; while (p) { if (p.visible === false) return false; p = p.parent; } return true; };
const L = [];
S.traverse(o => { if (!o.isMesh || !vis(o) || !o.geometry || !o.geometry.attributes.position) return;
  const b = new THREE.Box3().setFromObject(o); let nm = [], p = o; while (p) { if (p.name) nm.push(p.name); p = p.parent; }
  L.push({ n: nm.slice(0, 3).join('<'), z0: +b.min.z.toFixed(3), z1: +b.max.z.toFixed(3), x0: +b.min.x.toFixed(3), x1: +b.max.x.toFixed(3), y0: +b.min.y.toFixed(3), y1: +b.max.y.toFixed(3), mat: o.material && o.material.name }); });
out.meshes = L;
return JSON.stringify(out);
