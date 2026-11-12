// before (no record: master's aeroplane, to the bit) -> after (the drawn body) with the real core: node measure2.js <k>
const fs = require('fs'); const C = require('/workspace/DeGaRoR.github.io/flyDiy/tools/flight_core.js');
const k = process.argv[2];
const mm = { exports: {} }; new Function('module', 'require', '__filename', '__dirname', fs.readFileSync(__dirname + '/flight_core_master.js', 'utf8'))(mm, require, __dirname + '/flight_core_master.js', '/workspace/DeGaRoR.github.io/flyDiy/tools'); const OLD = mm.exports; const sp = JSON.parse(fs.readFileSync(__dirname + '/spec_' + k + '.json')).spec;
function run(withRec, CC) {
  const C = CC;
  const s = JSON.parse(JSON.stringify(sp)); if (!withRec) delete s.fuselage.aeroBody;
  const def = C.buildGen(s), g = def.params.gen, D = g.drag, S = def.spec;
  const sim = C.makeSim(def, null); sim.reset(0);
  const sh = C.genShakedown(def);
  const ring = ids => ids.reduce((a, i) => a + def.nodes[i].p[0], 0) / ids.length;
  return { body: D.body, base: D.base || 0, baseA: D.baseA || 0, rod: D.rod || 0, xSep: D.xSep, kind: D.aeroBody || 'frame', L: D.L, swet: D.swet,
    axial: def.params.fusCdA[0], aftSide: def.params.fusCdAAft[1], aftX: ring(def.refs.fusDragAft), boomSide: def.params.boomCdAAft ? def.params.boomCdAAft[1] : 0,
    boomX: def.refs.boomDrag ? ring(def.refs.boomDrag) : null, tailArm: S.fuse.tailArm, STend: def.parts.ST[def.parts.ST.length - 1].x,
    Vs: sh.Vs * 3.6, VCruise: sh.VCruise * 3.6, climb: sh.climbRate, sm: sh.staticMargin, npX: sh.npX, cgX: sh.cgX, cnBeta: sh.cnBeta, LD: sh.LDbest,
    TORun: sh.TORun, range: sh.rangeKm, mass: sh.mass, empty: sh.empty, substeps: def.params.substeps, verdict: sh.design && sh.design.verdict,
    rows: (sh.design && sh.design.rows || []).map(r => ({ id: r.id, level: r.level, value: r.value })) };
}
const a = run(false, OLD), b = run(true, C);
// COWL-BILL alone: the new core, the record on, the cowl switched on for the bill only
const cw = (() => { const c = sp.cage || {}; if (c.cowlOn == null || +c.cowlOn) return 0; const s2 = JSON.parse(JSON.stringify(sp)); s2.cage.cowlOn = 1;
  const m = d => d.nodes.reduce((x, n) => x + n.m, 0); return m(C.buildGen(s2)) - m(C.buildGen(JSON.parse(JSON.stringify(sp)))); })();
b.cowlKg = cw;
// the 65 % cruise rule (the evidence's): drag against 0.65 of full thrust, the probe's own
const P = C.__priv;
fs.writeFileSync(__dirname + '/m_' + k + '.json', JSON.stringify({ k, before: a, after: b }));
const f = (x, y, d) => x.toFixed(d) + '->' + y.toFixed(d);
console.log(k.padEnd(9), b.kind.padEnd(6), 'body', f(a.body, b.body, 3), 'base', b.base.toFixed(3), 'rod', b.rod.toFixed(3), '| Vc', f(a.VCruise, b.VCruise, 1), 'climb', f(a.climb, b.climb, 2),
  'SM', f(a.sm, b.sm, 3), 'Cnb', f(a.cnBeta, b.cnBeta, 3), 'empty', f(a.empty, b.empty, 1), 'sub', a.substeps + '->' + b.substeps, '| tailArm', f(a.tailArm, b.tailArm, 2), '|', a.verdict + '->' + b.verdict);
