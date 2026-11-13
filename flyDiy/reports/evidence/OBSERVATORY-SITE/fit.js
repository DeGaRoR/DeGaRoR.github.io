// small local search around a design; profile auto-fit; score cut/fill across +-10, top platform
const W = require('./world.js')(); const C = require('./world.js').C, PG = C.PREMISES_GEN;
const cx = 9112.2, cz = -5881.9, G = (x, z) => W.terrainH(cx + x, cz + z);
const out = [];
for (const L of [190, 200, 210, 220]) for (let cxx = 200; cxx <= 250; cxx += 5) for (let czz = -90; czz <= -65; czz += 2.5) for (let a = 3.0; a <= 3.30; a += 0.02) {
  const ux = Math.cos(a), uz = Math.sin(a), x0 = cxx - ux * L / 2, z0 = czz - uz * L / 2, hc = G(cxx, czz);
  const cl = s => { let h = 0; for (const c of [-5, 0, 5]) h += G(x0 + ux * s - uz * c, z0 + uz * s + ux * c) / 3; return h; };
  for (const tf of [0.75, 0.8]) for (const tm of [0.3, 0.35, 0.4]) {
    const top = cl(L - 10), prof = [[0, cl(0) - hc], [tm, cl(tm * L) - hc], [tf, top - 0.4 - hc], [1, top - hc]];
    if (!(prof[3][1] > prof[0][1] + 8)) continue;
    const r = { id: 'x', len: L, wid: 12, altiport: true, approach: 0, profile: prof }, pr = PG.runwayProfile(r);
    let worst = 0, crest = 0; for (let s = 0; s <= L; s += 2) { worst = Math.max(worst, Math.abs(pr.slopeAt(s))); if (s + 30 <= L) crest = Math.max(crest, Math.abs(pr.slopeAt(s + 30) - pr.slopeAt(s))); }
    if (worst > 0.19 || crest > 0.046) continue;
    const topSl = (pr.at(L) - pr.at(L - 40)) / 40, botSl = (pr.at(60) - pr.at(0)) / 60;
    if (topSl > 0.02 || botSl < 0.12) continue;
    let mx = 0, ss = 0, n = 0; for (let s = 0; s <= L; s += 10) { const y = hc + pr.at(s); for (const c of [-10, -6, 0, 6, 10]) { const d = G(x0 + ux * s - uz * c, z0 + uz * s + ux * c) - y; mx = Math.max(mx, Math.abs(d)); ss += d * d; n++; } }
    out.push({ L, c: [cxx, czz], hdg: +a.toFixed(3), mx: +mx.toFixed(1), rms: +Math.sqrt(ss / n).toFixed(2), worst: +(worst * 100).toFixed(1), crest: +(crest * 100).toFixed(1), botSl: +(botSl * 100).toFixed(1), prof: prof.map(q => [q[0], +q[1].toFixed(2)]), score: Math.sqrt(ss / n) + 0.3 * mx });
  }
}
out.sort((p, q) => p.score - q.score);
for (const o of out.slice(0, 10)) console.log(JSON.stringify(o));
