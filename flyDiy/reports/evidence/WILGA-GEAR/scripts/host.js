const C = require(process.env.CORE || '/tmp/claude-0/-workspace-DeGaRoR-github-io/87d1e332-cdaa-5b4d-9fd2-f5d4f14e6cc0/scratchpad/out/tools/flight_core.js');
const fs = require('fs');
function host(kgTarget) {
  const raw = JSON.parse(fs.readFileSync('/workspace/DeGaRoR.github.io/flyDiy/builds/cessna172_2026-09-20_corrected.json', 'utf8'));
  const s = JSON.parse(JSON.stringify(raw.spec || raw));
  Object.assign(s.gear, { type: 'taildragger', suspension: 'lever', track: 2.83, wheelR: 0.25, twR: 0.128, x: null, y: null, twX: null, twY: null,
    fairing: 'none', twFairing: 'none', legFair: 'none', twLegFair: 'none', floats: null });
  delete s.gear.lever;
  let d = C.buildGen(JSON.parse(JSON.stringify(s)));
  const m0 = d.params.gen.W / 9.81;
  if (kgTarget) { s.cargo = { len: 0.6, kg: Math.max(0, kgTarget - m0) }; d = C.buildGen(JSON.parse(JSON.stringify(s))); }
  return { spec: s, def: d };
}
module.exports = { host, C };
if (require.main === module) {
  const { def } = host(1300); const g = def.params.gen;
  console.log('W', (g.W/9.81).toFixed(0), 'Sw', g.Sw.toFixed(1), 'substeps', def.params.substeps, 'type', def.spec.gear.type, 'gear x', def.spec.gear.x.toFixed(3), 'y', def.spec.gear.y.toFixed(3), 'tw', def.spec.gear.twX.toFixed(2), def.spec.gear.twY.toFixed(2));
  const L = def.parts.lever; console.log('W/side', L.W.toFixed(0), 'share', L.share.toFixed(3), 'sink', L.sink.toFixed(2), 'deck', (L.deck*57.3).toFixed(1));
  const O = L.sides[0].O; console.log('S', O.S.toFixed(3), 'sSt', O.sSt.toFixed(4), 'P1', ((O.P1-101325)/1e5).toFixed(1), 'bar static', (O.Fst/O.A/1e5).toFixed(1), 'P2', ((O.P2-101325)/1e5).toFixed(1), 'V1 cc', (O.V1*1e6).toFixed(0), 'V2', (O.V2*1e6).toFixed(0), 'kc', O.kc.toFixed(0), 'kr', O.kr.toFixed(0), 'cl', O.cl.toFixed(0), 'ff', O.ff.toFixed(0));
  const sim = C.makeSim(def, null); sim.reset(0);
  for (let f = 0; f < 600; f++) sim.step(1/60);
  const o = sim.oleo(); console.log('settled: s', o.map(q => q.s.toFixed(4)).join(','), 'bad', sim.stats().bad, 'cgY', sim.cgPos()[1].toFixed(3));
}
