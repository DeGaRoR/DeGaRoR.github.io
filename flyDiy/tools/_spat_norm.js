// Do the wheel fairing's faces point OUTWARD? Measured, not guessed — the
// G20b method: build it, take each face's normal, dot it with the outward
// radial at that face, and count.
const fs = require('fs'), path = require('path');
const ROOT = 'D:/Dev/DeGaRoR.github.io/flydiy';
const THREE = new Proxy({}, { get: () => function () { return {}; } });
const win = {};
new Function('window', 'THREE', fs.readFileSync(ROOT + '/tools/_gear_kit.js', 'utf8'))(win, THREE);
new Function('window', 'THREE', fs.readFileSync(ROOT + '/tools/_gear_gen.js', 'utf8'))(win, THREE);
const G = win.GEAR_GEN, K = win.GEAR_KIT;

const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const crs = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const dot = (a, b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const nrm = a => { const L = Math.hypot(...a) || 1; return [a[0]/L, a[1]/L, a[2]/L]; };

function testSide(sgn, full) {
  // a recording bag with the Bag interface: the real one keeps pos/idx private
  const pos = [], idx = [];
  const rec = {
    v: p => { pos.push(p[0], p[1], p[2]); return pos.length / 3 - 1; },
    quad: (a, b, c, d) => { idx.push(a, b, c, a, c, d); },
    tri: (a, b, c) => { idx.push(a, b, c); },
    get tris() { return idx.length / 3; },
    mesh: () => null,
  };
  const bags = { fair: rec };
  const R = 0.20;
  const hub = [sgn * 0.8, -1.1, 1.35];
  const axis = [sgn, 0, 0];                 // axle points outboard
  G.spat(bags, hub, axis, R, full);
  const P = pos, I = idx;
  // the fairing's long axis, for the outward radial
  const ax = nrm(axis);
  let up = nrm(sub([0,1,0], ax.map(v => v * dot([0,1,0], ax))));
  let fwd = crs(up, ax); if (fwd[2] < 0) fwd = fwd.map(v => -v);
  let out = 0, inn = 0, flat = 0;
  const V = i => [P[i*3], P[i*3+1], P[i*3+2]];
  for (let t = 0; t + 2 < I.length; t += 3) {
    const a = V(I[t]), c = V(I[t+1]), d = V(I[t+2]);
    const n = nrm(crs(sub(c, a), sub(d, a)));
    const cen = [(a[0]+c[0]+d[0])/3, (a[1]+c[1]+d[1])/3, (a[2]+c[2]+d[2])/3];
    // radial from the fairing's own centreline (through hub along fwd)
    const rel = sub(cen, hub);
    const along = dot(rel, fwd);
    const rad = sub(rel, fwd.map(v => v * along));
    const rl = Math.hypot(...rad);
    if (rl < 1e-4) { flat++; continue; }
    const d2 = dot(n, nrm(rad));
    if (d2 > 0.15) out++; else if (d2 < -0.15) inn++; else flat++;
  }
  return { out, inn, flat, tris: I.length / 3 };
}

console.log('WHEEL FAIRING NORMALS');
for (const full of [false, true])
  for (const sgn of [1, -1]) {
    const r = testSide(sgn, full);
    console.log(`  ${full ? 'trousers' : 'spat    '} side ${sgn > 0 ? '+' : '-'}: ` +
      (r.err ? r.err
             : `outward ${r.out}  inward ${r.inn}  edge-on ${r.flat}  (of ${r.tris})`));
  }
