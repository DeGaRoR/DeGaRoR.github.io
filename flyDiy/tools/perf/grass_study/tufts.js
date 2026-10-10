// cut the shipped reed patches into TUFTS (clusters of ~K cards, by card centre) - same cards, same UVs, same material
const fs = require('fs'), zlib = require('zlib');
const R = require('path').resolve(__dirname, '../../..') + '/';
const { decodeTreePart } = require(R + 'src/core/53_tree_codec.js');
const pack = JSON.parse(fs.readFileSync(R + 'src/core/trees_pack.json'));
const c = pack.collections.find(c => c.name === 'grass_reed');
let raw = fs.readFileSync(R + c.bin); try { raw = zlib.gunzipSync(raw); } catch (e) {}
const bin = new Uint8Array(raw), K = +process.argv[2] || 4;
const all = [];
for (const s of c.subjects) {
  const d = decodeTreePart(s.bb, s.rungs[0].parts[0], bin), nv = d.pos.length / 3, nt = d.idx.length / 3;
  const par = Int32Array.from({ length: nv }, (_, i) => i), f = i => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; }, u = (a, b) => { a = f(a); b = f(b); if (a !== b) par[a] = b; };
  for (let t = 0; t < nt; t++) { u(d.idx[t*3], d.idx[t*3+1]); u(d.idx[t*3], d.idx[t*3+2]); }
  const comp = new Map();
  for (let t = 0; t < nt; t++) { const r = f(d.idx[t*3]); let C = comp.get(r); if (!C) comp.set(r, C = { tris: [], vs: new Set() }); C.tris.push(t); for (let k = 0; k < 3; k++) C.vs.add(d.idx[t*3+k]); }
  for (const C of comp.values()) {
    let sx = 0, sz = 0, top = 0, area = 0, side = 0;
    for (const i of C.vs) { sx += d.pos[i*3]; sz += d.pos[i*3+2]; top = Math.max(top, d.pos[i*3+1]); }
    for (const t of C.tris) { const P = q => [d.pos[q*3], d.pos[q*3+1], d.pos[q*3+2]]; const a = P(d.idx[t*3]), b = P(d.idx[t*3+1]), cc = P(d.idx[t*3+2]);
      const e1 = [b[0]-a[0], b[1]-a[1], b[2]-a[2]], e2 = [cc[0]-a[0], cc[1]-a[1], cc[2]-a[2]], n = [e1[1]*e2[2]-e1[2]*e2[1], e1[2]*e2[0]-e1[0]*e2[2], e1[0]*e2[1]-e1[1]*e2[0]];
      area += Math.hypot(...n) / 2; side += (Math.abs(n[0]) + Math.abs(n[2])) / 4; }
    all.push({ subj: s.name, x: sx / C.vs.size, z: sz / C.vs.size, top, tris: C.tris.length, verts: C.vs.size, area, side });
  }
}
// greedy spatial clustering per subject into groups of ~K nearest cards
const tufts = [];
for (const name of [...new Set(all.map(a => a.subj))]) {
  const cs = all.filter(a => a.subj === name), used = new Set();
  cs.sort((a, b) => (a.x * a.x + a.z * a.z) - (b.x * b.x + b.z * b.z)).reverse();   // outermost first
  for (const a of cs) { if (used.has(a)) continue; used.add(a);
    const near = cs.filter(b => !used.has(b)).sort((p, q) => Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(q.x - a.x, q.z - a.z)).slice(0, K - 1);
    near.forEach(b => used.add(b)); const g = [a, ...near];
    const cx = g.reduce((s, v) => s + v.x, 0) / g.length, cz = g.reduce((s, v) => s + v.z, 0) / g.length;
    tufts.push({ subj: name, n: g.length, tris: g.reduce((s, v) => s + v.tris, 0), verts: g.reduce((s, v) => s + v.verts, 0),
      top: Math.max(...g.map(v => v.top)), medTop: g.map(v => v.top).sort((p, q) => p - q)[g.length >> 1],
      spread: Math.max(...g.map(v => Math.hypot(v.x - cx, v.z - cz))), area: g.reduce((s, v) => s + v.area, 0), side: g.reduce((s, v) => s + v.side, 0) });
  }
}
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const m = k => tufts.reduce((s, t) => s + t[k], 0) / tufts.length;
console.log(`K=${K}: ${all.length} cards -> ${tufts.length} tufts | tris mean ${m('tris').toFixed(1)} (p50 ${q(tufts.map(t=>t.tris),.5)}) verts ${m('verts').toFixed(1)} | top (units) mean ${m('top').toFixed(1)} | spread radius (units) p50 ${q(tufts.map(t=>t.spread),.5).toFixed(1)} p90 ${q(tufts.map(t=>t.spread),.9).toFixed(1)} | card area/tuft ${m('area').toFixed(0)} u2, side ${m('side').toFixed(0)} u2`);
console.log(`per card: tris ${(all.reduce((s,a)=>s+a.tris,0)/all.length).toFixed(1)} side ${(all.reduce((s,a)=>s+a.side,0)/all.length).toFixed(0)} u2, top mean ${(all.reduce((s,a)=>s+a.top,0)/all.length).toFixed(1)} u`);
if (process.env.OUT) fs.writeFileSync(require('path').join(process.env.OUT, 'tufts_K' + K + '.json'), JSON.stringify({ K, cards: all.length, tufts: tufts.length, trisMean: m('tris'), vertsMean: m('verts'), topMean: m('top'), sideMean: m('side'), areaMean: m('area'), cardSide: all.reduce((s,a)=>s+a.side,0)/all.length, cardTop: all.reduce((s,a)=>s+a.top,0)/all.length }));
