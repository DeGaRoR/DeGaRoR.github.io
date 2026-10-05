#!/usr/bin/env node
// world_moves.js (G1560 WORLD-STRIPS) - what moved between two flight cores on one world, as markdown lists: the
// aerodromes, the towns, the bake's lakes (8-connected components of its lake mask), its sea mask, the river reaches.
//   node tools/world_moves.js <coreBefore.js> <coreAfter.js> <seedN|jolene> [--rivers]
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
function world(corePath, which) {
  corePath = path.resolve(corePath);
  if (which === 'jolene') {
    const real = path.join(ROOT, 'tools', 'flight_core.js');
    for (const k of Object.keys(require.cache)) if (k.endsWith('island_node.js') || k === real) delete require.cache[k];
    require.cache[real] = { id: real, filename: real, loaded: true, exports: require(corePath) };
    const IN = require(path.join(ROOT, 'tools', 'island_node.js'));
    return IN.islandWorld('jolene', { premises: fs.readFileSync(path.join(ROOT, 'tools/fixtures/island_jolene.json'), 'utf8') });
  }
  return require(corePath).makeWorld(+which.replace('seed', ''));
}
const [cA, cB, which] = process.argv.slice(2);
const A = world(cA, which), B = world(cB, which);
const out = [];
const P = s => out.push(s);
const r0 = v => Math.round(v);
P(`### ${which}: aerodromes`);
P('| id | before | after |'); P('|---|---|---|');
const ids = [...new Set([...A.aerodromes.map(a => a.id), ...B.aerodromes.map(a => a.id)])];
const fa = a => a ? `${a.name} (${a.kind}${a.len ? ', ' + a.len + ' m' : ''}) at (${r0(a.x)}, ${r0(a.z)}) hdg ${(a.hdg * 180 / Math.PI).toFixed(1)}, elev ${(+a.elev).toFixed(2)}` : '-';
let same = 0;
for (const id of ids) { const a = A.aerodromes.find(q => q.id === id), b = B.aerodromes.find(q => q.id === id); if (fa(a) === fa(b)) { same++; continue; } P(`| ${id} | ${fa(a)} | ${fa(b)} |`); }
P(`(${same} unchanged: ${ids.filter(id => fa(A.aerodromes.find(q => q.id === id)) === fa(B.aerodromes.find(q => q.id === id))).join(', ')})`);
if (A.settlements && A.settlements.length) {
  P(''); P(`### ${which}: towns (stage 3)`);
  const ft = s => `${s.name} (${r0(s.x)}, ${r0(s.z)}) pop ${s.pop}`;
  P('before: ' + A.settlements.map(ft).join('; ')); P(''); P('after: ' + B.settlements.map(ft).join('; '));
}
// lakes: components of the bake's lake mask
function comps(W) {
  const G = W.hydro.grids, N = G.N, id = new Int32Array(N * N).fill(-1), L = [];
  for (let k = 0; k < N * N; k++) { if (!G.lake[k] || id[k] >= 0) continue; const st = [k], cells = []; id[k] = L.length;
    while (st.length) { const c = st.pop(); cells.push(c); const ix = c % N, iz = (c / N) | 0;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const jx = ix + a, jz = iz + b; if (jx < 0 || jz < 0 || jx >= N || jz >= N) continue; const q = jz * N + jx; if (G.lake[q] && id[q] < 0) { id[q] = L.length; st.push(q); } } }
    let sx = 0, sz = 0, lv = 0; for (const c of cells) { sx += c % N; sz += (c / N) | 0; lv += G.filled[c]; }
    L.push({ cells, set: new Set(cells), x: r0(G.x0 + (sx / cells.length + 0.5) * G.dx), z: r0(G.z0 + (sz / cells.length + 0.5) * G.dz), n: cells.length, level: +(lv / cells.length).toFixed(2) }); }
  return L;
}
const LA = comps(A), LB = comps(B);
const key = l => l.n + '@' + l.x + ',' + l.z + ':' + l.level;
const KA = new Set(LA.map(key)), KB = new Set(LB.map(key));
const gone = LA.filter(l => !KB.has(key(l))), neu = LB.filter(l => !KA.has(key(l)));
P(''); P(`### ${which}: lakes (the bake's lake mask, 8-connected components): ${LA.length} -> ${LB.length}; ${LA.length - gone.length} identical`);
P('changed or gone (before): ' + (gone.map(l => `${l.n} cells at (${l.x}, ${l.z}) level ${l.level}`).join('; ') || 'none'));
P(''); P('changed or new (after): ' + (neu.map(l => `${l.n} cells at (${l.x}, ${l.z}) level ${l.level}`).join('; ') || 'none'));
// coastline: the bake's sea mask
{
  const GA = A.hydro.grids, GB = B.hydro.grids, N = GA.N; let toLand = 0, toSea = 0; for (let k = 0; k < N * N; k++) { if (GA.sea[k] && !GB.sea[k]) toLand++; if (!GA.sea[k] && GB.sea[k]) toSea++; }
  P(''); P(`### ${which}: the sea (the bake's sea mask, ${N}x${N} cells of ${GA.dx.toFixed(1)} m): ${toLand} cells left the sea, ${toSea} joined it`);
}
// rivers
const rk = r => r.pts.map(p => p.join(',')).join(';') + '|' + r.w.toFixed(3);
const RA = new Set(A.hydro.rivers.map(rk)), RB = new Set(B.hydro.rivers.map(rk));
const rg = A.hydro.rivers.filter(r => !RB.has(rk(r))), rn = B.hydro.rivers.filter(r => !RA.has(rk(r)));
const fr = r => { let L = 0; for (let i = 1; i < r.pts.length; i++) L += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]); return `(${r0(r.pts[0][0])}, ${r0(r.pts[0][1])})->(${r0(r.pts.at(-1)[0])}, ${r0(r.pts.at(-1)[1])}) ${r0(L)} m w ${r.w.toFixed(1)} ${r.term}`; };
P(''); P(`### ${which}: river reaches ${A.hydro.rivers.length} -> ${B.hydro.rivers.length} (${A.hydro.rivers.length - rg.length} identical, ${rg.length} gone or reshaped, ${rn.length} new or reshaped)`);
if (process.argv.includes('--rivers')) { P('gone/reshaped: ' + rg.map(fr).join('; ')); P(''); P('new/reshaped: ' + rn.map(fr).join('; ')); }
console.log(out.join('\n'));
