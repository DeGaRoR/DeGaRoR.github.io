// _drawn_dims_probe.js (REAL-FIGURES-2) - the page-side half of real_check's DRAWN measurement (run by _load_build's
// FLYDIY_JOIN_PROBE in the page's own context, after the last build): every visible mesh of the editor's scene and the
// fuselage sheet (as tools/_quick_view_probe.js gathers them), as a point cloud quantised to 1 cm, in the cage frame. The
// crew and the pilot figures are left out (a tape measure does not run over the pilot's head). real_check.js measures
// the type-sheet dimensions off it: span, overall length (spinner to rudder), height standing on the gear.
const THREE = window.THREE, sc = window.__scene;
sc.updateMatrixWorld(true);
const seen = new Set(), P = [];
const add = (x, y, z) => { const k = Math.round(x * 100) + ',' + Math.round(y * 100) + ',' + Math.round(z * 100); if (!seen.has(k)) { seen.add(k); P.push(Math.round(x * 100), Math.round(y * 100), Math.round(z * 100)); } };
const v = new THREE.Vector3(), M = new THREE.Matrix4(), IM = new THREE.Matrix4();
const shown = o => { for (let p = o; p; p = p.parent) if (p.visible === false) return false; return true; };
// the crew layer (the seats, the panel, the figures: inside the skin anyway) and the propeller's BLADES (edProp: a type
// sheet's height and length leave the blades out; the spinner, edSpinner, stays - the length runs spinner to rudder)
const crew = o => { for (let p = o; p; p = p.parent) if (/crew|pilot|person|char:|occupant|^edProp$/i.test(p.name || '') || (p.userData && (p.userData.crew || p.userData.char))) return true; return false; };
let meshes = 0, skipped = 0;
sc.traverse(o => {
  if (!o.isMesh || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.position || !shown(o)) return;
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  if (mats.every(m => !m || m.visible === false || m.colorWrite === false || (m.transparent && m.opacity < 0.05))) return;
  if (crew(o)) { skipped++; return; }
  const pos = o.geometry.attributes.position, inst = o.isInstancedMesh ? o.count : 1;
  for (let k = 0; k < inst; k++) {
    M.copy(o.matrixWorld);
    if (o.isInstancedMesh) { o.getMatrixAt(k, IM); M.multiply(IM); }
    for (let i = 0; i < pos.count; i++) { v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M); add(v.x, v.y, v.z); }
  }
  meshes++;
});
{
  const PP = window.CAGE_UI && window.CAGE_UI.P, G = window.CAGE2;
  const sh = PP && G && G.cageSheet ? G.cageSheet(PP, { level: 2 }).sheet : null;
  // ONLY THE VERTICES A FACE DRAWS (the user 10 Nov, the Petrel "can't miss 60 cm"): the sheet's V also holds construction
  // points no face uses - the Petrel's 91 of them run to 9.7 m ahead of the nose, so its "length" read 12.5 m, was thrown
  // out as suspect and the 5.6 m node figure (the first node to the fin's trailing edge: no bow, no rudder) stood in for it
  if (sh) { const k = (G.CAGE_UNIT || 1) * (+PP.planeScale || 1), used = new Set();
    for (const f of sh.F) for (const i of f.v) used.add(i);
    for (const i of used) { const p = sh.V[i]; add(p[0] * k, p[1] * k, p[2] * k); } }
}
return { P, meshes, skipped };
