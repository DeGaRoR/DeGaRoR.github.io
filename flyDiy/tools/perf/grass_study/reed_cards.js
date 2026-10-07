// the reed patch's structure: connected components (cards), their tris, size, height, footprint centre spread
const fs = require('fs'), zlib = require('zlib');
const R = require('path').resolve(__dirname, '../../..') + '/';
const { decodeTreePart } = require(R + 'src/core/53_tree_codec.js');
const pack = JSON.parse(fs.readFileSync(R + 'src/core/trees_pack.json'));
const c = pack.collections.find(c => c.name === 'grass_reed');
let raw = fs.readFileSync(R + c.bin); try { raw = zlib.gunzipSync(raw); } catch (e) {}
const bin = new Uint8Array(raw), SC = 0.012 * 0.75;
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
for (const s of c.subjects) {
  const d = decodeTreePart(s.bb, s.rungs[0].parts[0], bin), nv = d.pos.length / 3, nt = d.idx.length / 3;
  // union-find on vertices sharing a triangle, then also weld equal positions
  const par = Int32Array.from({ length: nv }, (_, i) => i), f = i => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; }, u = (a, b) => { a = f(a); b = f(b); if (a !== b) par[a] = b; };
  for (let t = 0; t < nt; t++) { u(d.idx[t*3], d.idx[t*3+1]); u(d.idx[t*3], d.idx[t*3+2]); }
  const key = new Map(); for (let i = 0; i < nv; i++) { const k = d.pos.slice(i*3, i*3+3).map(v => v.toFixed(2)).join(','); if (key.has(k)) u(i, key.get(k)); else key.set(k, i); }
  const comp = new Map();
  for (let t = 0; t < nt; t++) { const r = f(d.idx[t*3]); let C = comp.get(r); if (!C) comp.set(r, C = { tris: 0, vs: new Set() }); C.tris++; for (let k = 0; k < 3; k++) C.vs.add(d.idx[t*3+k]); }
  const cards = [...comp.values()].map(C => { let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9,z0=1e9,z1=-1e9; for (const i of C.vs) { const x=d.pos[i*3],y=d.pos[i*3+1],z=d.pos[i*3+2]; x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);z0=Math.min(z0,z);z1=Math.max(z1,z);} return { tris: C.tris, h: (y1-y0)*SC, top: y1*SC, base: y0*SC, w: Math.hypot(x1-x0, z1-z0)*SC, cx: (x0+x1)/2*SC, cz: (z0+z1)/2*SC }; });
  const tr = cards.map(k => k.tris), H = cards.map(k => k.top), Wd = cards.map(k => k.w), B = cards.map(k => k.base);
  const rr = cards.map(k => Math.hypot(k.cx, k.cz));
  console.log(`${s.name}: ${cards.length} cards | tris/card p50 ${q(tr,.5)} max ${Math.max(...tr)} | card top p10 ${q(H,.1).toFixed(2)} p50 ${q(H,.5).toFixed(2)} p90 ${q(H,.9).toFixed(2)} m | base p50 ${q(B,.5).toFixed(2)} | width p50 ${q(Wd,.5).toFixed(2)} m | centre radius p50 ${q(rr,.5).toFixed(2)} p90 ${q(rr,.9).toFixed(2)} m`);
}
