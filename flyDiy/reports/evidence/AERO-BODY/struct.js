// THE ROD'S STRUCTURE: the lattice as built (the family cone) against the lattice on the drawn rod (the profile given as
// the drawing: the pod's section to the closure, then the tube) - the mass on the aft nodes, the yaw inertia, the panels billed
const fs = require('fs'); const { C, recOf } = require('./core_ab.js'); globalThis.__AB = null;
const out = {};
for (const k of process.argv.slice(2)) {
  const sp = JSON.parse(fs.readFileSync(__dirname + '/spec_' + k + '.json')).spec, rec = recOf(k, __dirname);
  const mk = s => { const def = C.buildGen(s), S = def.spec, ST = def.parts.ST, x0 = S.fuse.boxRear, x1 = S.fuse.tailArm;
    const aft = def.nodes.filter(n => n.p[0] > rec.closeX + 0.05 && /^(S\d+|TP)/.test(n.tag || ''));
    const tot = def.nodes.reduce((a, n) => a + n.m, 0), cg = def.nodes.reduce((a, n) => a + n.m * n.p[0], 0) / tot;
    const Izz = def.nodes.reduce((a, n) => a + n.m * ((n.p[0] - cg) ** 2 + n.p[2] ** 2), 0);
    let panels = 0; for (let i = 0; i < ST.length - 1; i++) { const a = ST[i], b = ST[i + 1]; if (b.x <= rec.closeX + 0.05) continue;
      const dx = b.x - a.x; panels += dx * ((a.yt - a.yb + b.yt - b.yb) + 2 * (a.w + b.w)); }
    return { ST, aftKg: aft.reduce((a, n) => a + n.m, 0), mass: tot, cg, Izz, panels, x0, x1, ledger: def.ledger && def.ledger.fuselage }; };
  const a = mk(JSON.parse(JSON.stringify(sp)));
  // the drawn profile over boxRear..tailArm (t), off the measured rows and the rod
  const sp2 = JSON.parse(JSON.stringify(sp)); const prof = [];
  const at = x => { if (x >= rec.closeX) { const r = rec.rows[rec.rows.length - 1], yc = 0.5 * (r.yb + r.yt); return { w: 0.5 * rec.rod.d, yb: yc - 0.5 * rec.rod.d, yt: yc + 0.5 * rec.rod.d }; }
    let i = 1; while (i < rec.rows.length - 1 && rec.rows[i].x < x) i++; const p = rec.rows[i - 1], q = rec.rows[i], u = Math.max(0, Math.min(1, (x - p.x) / Math.max(1e-6, q.x - p.x)));
    return { w: p.w + (q.w - p.w) * u, yb: p.yb + (q.yb - p.yb) * u, yt: p.yt + (q.yt - p.yt) * u }; };
  for (let i = 0; i <= 16; i++) { const t = i / 16, x = a.x0 + (a.x1 - a.x0) * t; prof.push(Object.assign({ t }, at(x))); }
  sp2.fuselage.profile = prof;
  const b = mk(sp2);
  out[k] = { cone: a, rod: b, rec: { closeX: rec.closeX, d: rec.rod && rec.rod.d } };
  console.log(k.padEnd(9), 'mass', a.mass.toFixed(1), '->', b.mass.toFixed(1), '| aft nodes kg', a.aftKg.toFixed(1), '->', b.aftKg.toFixed(1), '| Izz', a.Izz.toFixed(0), '->', b.Izz.toFixed(0),
    '| cg', a.cg.toFixed(3), '->', b.cg.toFixed(3), '| panels billed aft of the pod m2', a.panels.toFixed(2), '->', b.panels.toFixed(2), '| depth@mid', (a.ST[Math.floor(a.ST.length * 0.7)].yt - a.ST[Math.floor(a.ST.length * 0.7)].yb).toFixed(2), '->', (b.ST[Math.floor(b.ST.length * 0.7)].yt - b.ST[Math.floor(b.ST.length * 0.7)].yb).toFixed(2));
}
fs.writeFileSync(__dirname + '/struct.json', JSON.stringify(out));
