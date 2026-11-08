// _crew_head_probe.js (G3512, NEW-SHAPES-1) - A FUNCTION BODY for tools/_load_build.js (FLYDIY_JOIN_PROBE=<this file>):
// the crew layer's seats, panel and seated characters (edCrew1/2) as drawn after the load chain's last build - each one's highest point
// (a character's: the top of the head), its fore/aft extent and half-width, metres, in the frame the cage is drawn in
// (cage units x planeScale). tools/newshapes_build.js reads it to prove a seated head stands in its opening.
const sc = __scene; sc.updateMatrixWorld(true);
const v = new THREE.Vector3(); const out = {};
sc.traverse(o => {
  if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
  let d = null, crew = null;   // a seated character by its own group (the innermost), else the outermost panel / seat group
  for (let p = o; p && p !== sc; p = p.parent) { const n = p.name || ''; if (!crew && /^edCrew\d/.test(n)) crew = n; if (/^edPanel|^edSeat/.test(n)) d = n; }
  if (crew) d = crew;
  if (!d) return;
  const pa = o.geometry.attributes.position, b = out[d] || (out[d] = { y1: -1e9, at: null, z0: 1e9, z1: -1e9, x1: 0 });
  for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld);
    if (v.y > b.y1) { b.y1 = v.y; b.at = [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)]; }
    b.z0 = Math.min(b.z0, v.z); b.z1 = Math.max(b.z1, v.z); b.x1 = Math.max(b.x1, Math.abs(v.x)); }
});

return { out };
