// _draw_hash_probe.js (G3510, NEW-SHAPES-1) - A FUNCTION BODY, not a module: tools/_load_build.js runs it in the page
// context after the load chain's last build (FLYDIY_JOIN_PROBE=<this file>), with the editor's drawn scene on __scene.
// It returns the DRAWING's fingerprint: every mesh the editor's layers drew, in scene order - its name, its material
// names, its world matrix and every position / normal / index it carries - as one FNV-1a over the bytes, plus the
// counts. Two trees that draw the same aeroplane give the same hash; one moved vertex anywhere does not. The one
// thing left out is the beacon rotor's matrix (_cage_light.js `liRotor_*`): it turns with the wall clock.
let h = 0x811c9dc5 >>> 0, meshes = 0, verts = 0;
const mixS = s => { s = String(s); for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; };
const mixA = a => { if (!a) { mixS('-'); return; }
  const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  for (let i = 0; i < u.length; i++) h = Math.imul(h ^ u[i], 16777619) >>> 0; };
const sc = __scene;
sc.updateMatrixWorld(true);
sc.traverse(o => {
  if (!o.isMesh && !o.isLine && !o.isPoints) return;
  const g = o.geometry; if (!g || !g.attributes || !g.attributes.position) return;
  meshes++; verts += g.attributes.position.count;
  mixS(o.name || ''); mixS(o.visible ? 'v' : 'h');
  const ms = Array.isArray(o.material) ? o.material : [o.material];
  for (const m of ms) mixS(m ? (m.name || '') + ':' + (m.userData && m.userData.section || '') : '-');
  let spun = false; for (let p = o; p; p = p.parent) if (/^liRotor/.test(p.name || '')) spun = true;
  if (!spun) mixA(new Float64Array(o.matrixWorld.elements));
  mixA(g.attributes.position.array);
  mixA(g.attributes.normal ? g.attributes.normal.array : null);
  mixA(g.index ? g.index.array : null);
  for (const gr of (g.groups || [])) mixS(gr.start + ',' + gr.count + ',' + gr.materialIndex);
});
return { draw: ('0000000' + h.toString(16)).slice(-8), meshes, verts };
