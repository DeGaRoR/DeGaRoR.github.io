// write a quick_view probe that first poses the trailing-link legs at a preview position (the gear layer's own rule:
// GEAR_LEVER.gearLeverAt + gearNodeFrame), then runs the stock probe
const fs = require('fs'), [pos, out] = process.argv.slice(2);
const pose = `
{ const __pos = ${+pos}; const CG = window.CAGE_GEAR, GL = window.GEAR_LEVER || (typeof GEAR_LEVER !== 'undefined' ? GEAR_LEVER : null);
  if (__pos > 0 && CG && CG.lever && GL) for (const u of CG.lever) {
    const L = GL.gearLeverInit({ piv: u.piv, ax: u.ax, w: u.w, axle: u.axle, horn: u.horn, top: u.top });
    const q = GL.gearLeverAt(L, __pos * (u.rows.ang - u.rows.comp) * Math.PI / 180), add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
    const T = { edLvArm: GL.gearNodeFrame([u.piv, u.axle, add(u.piv, u.ax)], [u.piv, q.axle, add(u.piv, u.ax)]),
                edLvCyl: GL.gearNodeFrame([u.top, u.horn, add(u.top, u.ax)], [u.top, q.horn, add(u.top, u.ax)]),
                edLvRod: GL.gearNodeFrame([u.horn, u.top, add(u.horn, u.ax)], [q.horn, u.top, add(q.horn, u.ax)]) };
    T.edWheel = T.edLvArm;
    window.__scene.traverse(o => { if (!o.name || o.name.slice(-1) !== u.kind) return; const t = T[o.name.slice(0, -1)]; if (!t) return;
      o.matrix.set(t[0], t[1], t[2], t[3], t[4], t[5], t[6], t[7], t[8], t[9], t[10], t[11], 0, 0, 0, 1); o.matrix.decompose(o.position, o.quaternion, o.scale); });
  } }
`;
fs.writeFileSync(out, pose + fs.readFileSync('/workspace/DeGaRoR.github.io/flyDiy/tools/_quick_view_probe.js', 'utf8'));
