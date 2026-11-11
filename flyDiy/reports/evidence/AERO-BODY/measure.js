// before (the core as built) -> after (the drawn aero body) for one plane: node measure.js <key>
const fs = require('fs');
const { C, makeAB, recOf } = require('./core_ab.js');
const { genProbeAt, genAlphaForLift, genStallAngle } = C.__priv;
const k = process.argv[2], dir = __dirname;
const sp = JSON.parse(fs.readFileSync(dir + '/spec_' + k + '.json')).spec;
const rec = recOf(k, dir);
function run(on) {
  globalThis.__AB = on ? makeAB(rec) : null;
  const def = C.buildGen(JSON.parse(JSON.stringify(sp))), g = def.params.gen, D = g.drag, S = def.spec, ST = def.parts.ST;
  const sim = C.makeSim(def, null); sim.reset(0);
  const W = sim.totalM * 9.81, aMax = 0.85 * genStallAngle(def), sh = C.genShakedown(def);
  const dragAt = v => genProbeAt(sim, v, genAlphaForLift(sim, v, W, aMax)).drag;
  let lo = Math.max(1.05 * g.Vs, sh.VbestLD || 0), hi = 4 * g.Vs;
  for (let i = 0; i < 26; i++) { const m = 0.5 * (lo + hi); if (dragAt(m) < 0.65 * sim.thrustAt(m, 1)) lo = m; else hi = m; }
  const ring = ids => ids.reduce((a, i) => a + def.nodes[i].p[0], 0) / ids.length;
  // THE STRUCTURE aft of the drawn closure: the lattice's nodes, their mass, their spread against the drawn rod
  const xc = rec.closeX, aft = def.nodes.map((n, i) => ({ n, i })).filter(q => q.n.p[0] > xc + 0.05 && /^(S\d+[BT][LR]?|TP[BT])/.test(q.n.tag || ''));
  const st = ST.filter(s => s.x > xc + 0.05);
  const mid = st.length ? st[Math.floor(st.length / 2)] : null;
  const cg = sh.cgX;
  const izz = aft.reduce((a, q) => a + q.n.m * ((q.n.p[0] - cg) ** 2 + q.n.p[2] ** 2), 0);
  const izzAxis = aft.reduce((a, q) => a + q.n.m * ((q.n.p[0] - cg) ** 2), 0);
  const rows = (sh.design && sh.design.rows || []).map(r => ({ id: r.id, level: r.level, value: r.value }));
  return {
    tailArm: S.fuse.tailArm, boxRear: S.fuse.boxRear, ST: ST.map(s => ({ x: s.x, w: s.w, yb: s.yb, yt: s.yt })), cowlLen: S.cowl.len,
    cowlSec: [0, 0.25, 0.5, 0.75, 1].map(t => { const c = S.cowl.secAt(t); return { x: -S.cowl.len * t, w: c.halfW, yb: c.yLo, yt: c.yHi }; }),
    body: D.body, base: D.base || 0, rod: D.rod || 0, swet: D.swet, L: D.L, f: D.f, FF: D.FF, vol: D.vol,
    axial: def.params.fusCdA[0], fwdSide: def.params.fusCdA[1], aftSide: def.params.fusCdAAft[1],
    boomSide: def.params.boomCdAAft ? def.params.boomCdAAft[1] : 0,
    aftBlobX: ring(def.refs.fusDragAft), fwdBlobX: ring(def.refs.fusDrag), boomBlobX: def.refs.boomDrag ? ring(def.refs.boomDrag) : null,
    Vc: 0.5 * (lo + hi) * 3.6, Vs: sh.Vs * 3.6, climb: sh.climbRate, sm: sh.staticMargin, npX: sh.npX, cgX: sh.cgX, cnBeta: sh.cnBeta,
    LDbest: sh.LDbest, TORun: sh.TORun, range: sh.rangeKm, mass: sh.mass, empty: sh.empty, verdict: sh.design && sh.design.verdict, rows,
    struct: { n: aft.length, kg: aft.reduce((a, q) => a + q.n.m, 0), midDepth: mid ? mid.yt - mid.yb : null, midW: mid ? 2 * mid.w : null, midX: mid ? mid.x : null,
              izz, izzAxis, ledger: sh.ledger && sh.ledger.fuselage },
    engX: S.engAt && S.engAt.map(e => ({ m: e.mount, x: e.x, y: e.y })), propD: S.prop && S.prop.D,
  };
}
const t = Date.now();
const before = run(false), after = run(true); after.wet = globalThis.__AB && globalThis.__AB.wetOut; after.aftX = globalThis.__AB && globalThis.__AB.aftX;
fs.writeFileSync(dir + '/ab_' + (process.env.AB_MODEL || 'B') + (process.env.AB_CDB ? '_' + process.env.AB_CDB : '') + (process.env.AB_RODCD ? '_rod' + process.env.AB_RODCD : '') + '_' + k + '.json', JSON.stringify({ k, rec: { rows: rec.rows, closeX: rec.closeX, base: rec.base, rod: rec.rod, nose: rec.nose, drawnAll: rec.drawnAll, cowl: rec.cowl, open: rec.open, aftCowl: rec.aftCowl, tailOnBody: rec.tailOnBody }, before, after }));
const f = (a, b, d) => a.toFixed(d) + '->' + b.toFixed(d);
console.log(k.padEnd(9), 'body', f(before.body, after.body, 3), 'base', after.base.toFixed(3), 'rod', after.rod.toFixed(3), 'axial', f(before.axial, after.axial, 3),
  '| aftSide', f(before.aftSide, after.aftSide, 2), '@', f(before.aftBlobX, after.aftBlobX, 2), '| Vc', f(before.Vc, after.Vc, 1), 'Vs', f(before.Vs, after.Vs, 1),
  'climb', f(before.climb, after.climb, 2), 'SM', f(before.sm, after.sm, 3), 'Cnb', f(before.cnBeta, after.cnBeta, 3), 'mass', f(before.mass, after.mass, 1),
  '| struct aft kg', before.struct.kg.toFixed(1), 'depth', before.struct.midDepth && before.struct.midDepth.toFixed(2), ((Date.now() - t) / 1000).toFixed(0) + 's');
