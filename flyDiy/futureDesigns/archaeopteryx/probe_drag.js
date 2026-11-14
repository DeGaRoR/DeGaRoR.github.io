// probe_drag.js <build.json> - where the drag is at the best-L/D point: re-probes the build with one strip kind removed at
// the same speed and alpha (the wing, the stab, the fin); the rest is the body axial CdA (genFusCdA + gear + pod + brace).
// Used by futureDesigns/archaeopteryx/STUDY.md on probe_ladder.js --save output.
// dragsplit.js <build.json> - drag by strip kind at the best-L/D point (remove one kind, re-probe at the same V and alpha)
const C = require(require('path').resolve(__dirname, '../../tools/flight_core.js'));
const s = require(require('path').resolve(process.argv[2])).spec;
const def0 = C.buildGen(JSON.parse(JSON.stringify(s)));
function probeAt(sim, V, a) {
  const [xA, yU] = sim.axes(); const vel = [0,0,0];
  for (let k = 0; k < 3; k++) vel[k] = -V * (Math.cos(a) * xA[k] + Math.sin(a) * yU[k]);
  const r = sim.probe(vel);
  r.drag = -(r.Fx * -Math.cos(a) * xA[0] + r.Fy * -Math.cos(a) * xA[1] + r.Fz * -Math.cos(a) * xA[2])
           - (r.Fx * -Math.sin(a) * yU[0] + r.Fy * -Math.sin(a) * yU[1] + r.Fz * -Math.sin(a) * yU[2]);
  return r;
}
function alphaFor(sim, V, W) { let lo = -0.1, hi = 0.25; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (probeAt(sim, V, m).Fy < W) lo = m; else hi = m; } return (lo + hi) / 2; }
const sh = C.genShakedown(def0, { slim: true });
const V = sh.VbestLD;
const sim0 = C.makeSim(def0, null); sim0.reset(0);
const W = sim0.totalM * 9.81;
const a = alphaFor(sim0, V, W);
const r0 = probeAt(sim0, V, a);
const q = 0.5 * 1.225 * V * V;
console.log('V', (V*3.6).toFixed(0), 'km/h alpha', (a*57.3).toFixed(1), 'lift', r0.Fy.toFixed(0), 'drag', r0.drag.toFixed(1), 'N  L/D', (r0.Fy/r0.drag).toFixed(1), ' CdA total', (r0.drag/q).toFixed(3), 'm2');
const kinds = [...new Set(def0.strips.map(x => x.kind))];
for (const k of kinds) {
  const d = C.buildGen(JSON.parse(JSON.stringify(s)));
  const n = d.strips.length;
  d.strips = d.strips.filter(x => x.kind !== k);
  const sm = C.makeSim(d, null); sm.reset(0);
  const r = probeAt(sm, V, a);
  console.log(k.padEnd(12), String(n - d.strips.length).padStart(3), 'strips  drag share', (r0.drag - r.drag).toFixed(1).padStart(7), 'N  CdA', ((r0.drag - r.drag)/q).toFixed(3), '  lift share', (r0.Fy - r.Fy).toFixed(0));
}
