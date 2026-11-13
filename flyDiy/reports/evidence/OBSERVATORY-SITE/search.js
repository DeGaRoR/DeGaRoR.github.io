const W = require('./world.js')();
const C = require('./world.js').C;
const PG = C.PREMISES_GEN;
const cx = 9112, cz = -5882;
const G = (x, z) => W.terrainH(cx + x, cz + z);
// candidate: top end (x1,z1) local, heading of the upslope direction (end0->end1) ang, len L
const res = [];
for (let L = 180; L <= 250; L += 10)
for (let tx = 70; tx <= 140; tx += 5) for (let tz = -100; tz <= -55; tz += 5)
for (let a = Math.PI - 0.45; a <= Math.PI + 0.45; a += 0.05) {
  const ux = Math.cos(a), uz = Math.sin(a);
  const x0 = tx - ux * L, z0 = tz - uz * L;
  // centreline ground, smoothed (across +-4 m mean)
  const n = 24, cl = [];
  for (let k = 0; k <= n; k++) { const s = L * k / n; let h = 0; for (const c of [-4, 0, 4]) h += G(x0 + ux * s - uz * c, z0 + uz * s + ux * c) / 3; cl.push(h); }
  const e = (cl[0 ] + cl[n]) / 2; // not used
  const hc = G((x0 + tx) / 2, (z0 + tz) / 2);
  // profile: 4 points t=0, tm, tf, 1 from the cl, top flat from tf
  let best = null;
  for (const tf of [0.6, 0.65, 0.7, 0.75, 0.8]) for (const tm of [0.3, 0.35, 0.4, 0.45]) {
    const hTop = cl[n], hTf = hTop - 0.5, hBot = cl[0];
    const hTm = cl[Math.round(tm * n)];
    const prof = [[0, hBot - hc], [tm, hTm - hc], [tf, hTf - hc], [1, hTop - hc]];
    const r = { id: 'x', len: L, wid: 14, altiport: true, approach: 0, profile: prof };
    const chk = PG.profileCheck ? PG.profileCheck(r) : null;
    const pr = PG.runwayProfile(r);
    if (!(hTop > hBot)) continue;
    // cut/fill across the width +-10 m (strip 14 + shoulders)
    let mx = 0, ss = 0, cnt = 0;
    for (let k = 0; k <= n; k++) { const s = L * k / n, y = hc + pr.at(s); for (const c of [-10, -5, 0, 5, 10]) { const d = G(x0 + ux * s - uz * c, z0 + uz * s + ux * c) - y; mx = Math.max(mx, Math.abs(d)); ss += d * d; cnt++; } }
    let worst = 0, crest = 0; for (let s = 0; s <= L; s += 3) { worst = Math.max(worst, Math.abs(pr.slopeAt(s))); if (s + 30 <= L) crest = Math.max(crest, Math.abs(pr.slopeAt(s + 30) - pr.slopeAt(s))); }
    // flat top: slope over the last 50 m
    const topSl = Math.abs(pr.at(L) - pr.at(L - 50)) / 50, botSl = (pr.at(60) - pr.at(0)) / 60;
    const ok = worst <= 0.20 && crest <= 0.05 && topSl < 0.025 && botSl > topSl + 0.04;
    const score = Math.sqrt(ss / cnt) + 0.3 * mx;
    if (ok && (!best || score < best.score)) best = { score, mx, rms: Math.sqrt(ss / cnt), worst, crest, topSl, botSl, prof, hc };
  }
  if (best) res.push(Object.assign({ L, tx, tz, a, x0, z0 }, best));
}
res.sort((p, q) => p.score - q.score);
for (const r of res.slice(0, 15)) console.log(JSON.stringify({ L: r.L, T: [r.tx, r.tz], bot: [+r.x0.toFixed(1), +r.z0.toFixed(1)], hdg: +r.a.toFixed(3), score: +r.score.toFixed(2), mx: +r.mx.toFixed(1), rms: +r.rms.toFixed(2), worst: +r.worst.toFixed(3), crest: +r.crest.toFixed(3), tsl: +r.topSl.toFixed(3), bsl: +r.botSl.toFixed(3), prof: r.prof.map(q => [q[0], +q[1].toFixed(2)]) }));
