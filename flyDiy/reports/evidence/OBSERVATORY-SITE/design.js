const W = require('./world.js')(); const C = require('./world.js').C, PG = C.PREMISES_GEN;
const cx = 9112.2, cz = -5881.9, G = (x, z) => W.terrainH(cx + x, cz + z);
const D = JSON.parse(process.argv[2]);
const L = D.L, a = D.hdg, ux = Math.cos(a), uz = Math.sin(a);
const c = D.c, x0 = c[0] - ux * L / 2, z0 = c[1] - uz * L / 2;
const hc = G(c[0], c[1]);
const r = { id: 'mt', len: L, wid: D.wid, altiport: true, approach: 0, profile: D.prof };
const pr = PG.runwayProfile(r), chk = PG.profileCheck(r);
console.log('centre ground', hc.toFixed(2), 'end0', (hc + pr.at(0)).toFixed(1), 'end1', (hc + pr.at(L)).toFixed(1), 'check', JSON.stringify(chk));
let worst = 0, crest = 0; for (let s = 0; s <= L; s += 1) { worst = Math.max(worst, Math.abs(pr.slopeAt(s))); if (s + 30 <= L) crest = Math.max(crest, Math.abs(pr.slopeAt(s + 30) - pr.slopeAt(s))); }
console.log('worst slope', (worst*100).toFixed(1), '% crest', (crest*100).toFixed(1));
for (let s = 0; s <= L; s += 20) { const y = hc + pr.at(s); const row = [-12, -6, 0, 6, 12].map(cc => (G(x0 + ux * s - uz * cc, z0 + uz * s + ux * cc) - y).toFixed(1).padStart(6)).join(''); console.log(('s ' + s).padEnd(6), 'y', y.toFixed(1), 'slope', (pr.slopeAt(s) * 100).toFixed(1).padStart(5) + '%', ' ground-y across (-12..12):', row); }
if (D.plat) { const lv = hc + pr.at(L); let mx = -1e9, mn = 1e9; for (let x = D.plat[0]; x <= D.plat[2]; x += 2) for (let z = D.plat[1]; z <= D.plat[3]; z += 2) { const d = G(x, z) - lv; mx = Math.max(mx, d); mn = Math.min(mn, d); } console.log('platform level', lv.toFixed(2), 'cut', mx.toFixed(1), 'fill', (-mn).toFixed(1)); }
console.log('world c', (cx + c[0]).toFixed(2), (cz + c[1]).toFixed(2), 'end0', (cx + x0).toFixed(1), (cz + z0).toFixed(1), 'end1', (cx + x0 + ux * L).toFixed(1), (cz + z0 + uz * L).toFixed(1));
