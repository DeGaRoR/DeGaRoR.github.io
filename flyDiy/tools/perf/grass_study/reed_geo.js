// decode grass_reed patches; dump per-subject stats + triangles (uv + pos) for alpha weighting
const fs = require('fs'), zlib = require('zlib'), path = require('path');
const R = require('path').resolve(__dirname, '../../..') + '/';
const { decodeTreePart } = require(R + 'src/core/53_tree_codec.js');
const pack = JSON.parse(fs.readFileSync(R + 'src/core/trees_pack.json'));
const c = pack.collections.find(c => c.name === 'grass_reed');
let raw = fs.readFileSync(R + c.bin); try { raw = zlib.gunzipSync(raw); } catch (e) {}
const bin = new Uint8Array(raw);
const out = [];
for (const s of c.subjects) {
  const p = s.rungs[0].parts[0], d = decodeTreePart(s.bb, p, bin);
  const nv = d.pos.length / 3, nt = d.idx.length / 3;
  let A = 0, Ax = 0, Az = 0, Ay = 0; const tris = [];
  for (let t = 0; t < nt; t++) {
    const i = d.idx[t*3], j = d.idx[t*3+1], k = d.idx[t*3+2];
    const P = q => [d.pos[q*3], d.pos[q*3+1], d.pos[q*3+2]], U = q => [d.uv[q*2], d.uv[q*2+1]];
    const a = P(i), b = P(j), cc = P(k);
    const e1 = [b[0]-a[0], b[1]-a[1], b[2]-a[2]], e2 = [cc[0]-a[0], cc[1]-a[1], cc[2]-a[2]];
    const n = [e1[1]*e2[2]-e1[2]*e2[1], e1[2]*e2[0]-e1[0]*e2[2], e1[0]*e2[1]-e1[1]*e2[0]];
    A += Math.hypot(...n)/2; Ax += Math.abs(n[0])/2; Ay += Math.abs(n[1])/2; Az += Math.abs(n[2])/2;
    tris.push([U(i), U(j), U(k), a, b, cc, Math.abs(n[0])/2, Math.abs(n[1])/2, Math.abs(n[2])/2]);
  }
  out.push({ name: s.name, nv, nt, bb: s.bb, area: A, areaX: Ax, areaY: Ay, areaZ: Az, tris });
  console.log(s.name, 'verts', nv, 'tris', nt, 'h(units)', s.bb[4].toFixed(1), 'area', A.toFixed(0), 'proj side X', Ax.toFixed(0), 'Z', Az.toFixed(0), 'top Y', Ay.toFixed(0));
}
fs.writeFileSync(require('path').join(process.env.OUT || require('os').tmpdir(), 'reed_tris.json'), JSON.stringify(out));
