// mem.js <tree> <section> <files...>: approximate member mass (A*rho*L) by class in one ledger section
const root = process.argv[2]; process.chdir(root);
const LB = require(root + '/tools/_load_build.js'), C = require(root + '/tools/flight_core.js');
const sec = process.argv[3];
const RHO = { steel: 7850, alu: 2700, wood: 450 };
for (const f of process.argv.slice(4)) {
  const S = LB.loadBuild(f).spec; const d = C.buildGen(S); const g = {};
  for (const b of d.beams) { if (b.sec !== sec) continue; const k = b.cls + (b.tens ? '(wire)' : ''); const rho = (C.GEN_MATERIALS && null) || null;
    g[k] = g[k] || { n: 0, L: 0, AL: 0, mat: b.mat }; g[k].n++; g[k].L += b.L; g[k].AL += (b.A || 0) * b.L; }
  console.log(f.split('/').pop(), 'ledger', d.parts.ledger[sec].mass.toFixed(1));
  for (const [k, v] of Object.entries(g).sort((a, b) => b[1].AL - a[1].AL)) console.log('   ', k.padEnd(22), 'n', v.n, 'L', v.L.toFixed(1), 'A·L dm3', (v.AL * 1000).toFixed(2), v.mat);
}
