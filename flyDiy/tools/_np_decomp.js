// _np_decomp.js (G461) — THE NEUTRAL POINT, DECOMPOSED: what each part of the
// probe contributes to dM/dalpha on a build, against a hand calculation.
//   node tools/_np_decomp.js [builds/x.json]
const C = require('./flight_core.js');
// the probe helpers are file-local in 64_gen_build; reproduce them verbatim
const genProbeAt = (sim, V, a) => { const [xA, yU] = sim.axes(); const vel = [0,0,0]; for (let k = 0; k < 3; k++) vel[k] = -V * (Math.cos(a) * xA[k] + Math.sin(a) * yU[k]); const r = sim.probe(vel); r.tailEps = sim.out.tailEps || 0; return r; };
const genAlphaForLift = (sim, V, W, aMax) => { let a0 = 0.01, a1 = 0.09; let f0 = genProbeAt(sim, V, a0).Fy - W, f1 = genProbeAt(sim, V, a1).Fy - W; for (let i = 0; i < 8; i++) { if (Math.abs(f1 - f0) < 1e-9) break; let a2 = a1 - f1 * (a1 - a0) / (f1 - f0); a2 = Math.min(aMax, Math.max(-0.06, a2)); a0 = a1; f0 = f1; a1 = a2; f1 = genProbeAt(sim, V, a1).Fy - W; if (Math.abs(f1) < 0.5) break; } return a1; };
const f = process.argv[2];
const spec = f ? require(require('path').resolve(f)).spec : C.GEN_DEFAULT;
const np = (mut, label) => {
  const def = C.buildGen(JSON.parse(JSON.stringify(spec)));
  if (mut) mut(def);
  const sim = C.makeSim(def, null); sim.reset(0);
  const W = sim.totalM * 9.81, V = def.params.ap.VCruise, aMax = 0.85 * def.params.polarWing.aStall;
  const a = genAlphaForLift(sim, V, W, aMax);
  const r0 = genProbeAt(sim, V, a), r1 = genProbeAt(sim, V, a + 0.02);
  const dM = (r1.pitchUp - r0.pitchUp) / 0.02, dL = (r1.Fy - r0.Fy) / 0.02;
  const sh = { cg: r0.cg[0], np: r0.cg[0] - dM / dL, cBar: def.params.gen.cBar || def.params.gen.cbar, xLE: def.params.gen.xLEmac };
  const g = def.params.gen;
  const pc = x => ((x - g.xLEmac) / g.cBar * 100).toFixed(1);
  console.log(label.padEnd(34), 'NP', pc(sh.np), '% MAC', ' dM/da', dM.toFixed(0), 'N.m/rad', ' dL/da', dL.toFixed(0), 'N/rad', ' deps/da', ((r1.tailEps - r0.tailEps) / 0.02).toFixed(2));
  return def;
};
const d = np(null, 'as built');
const P = d.params;
console.log('  fusCdA', P.fusCdA.map(v => v.toFixed(2)).join(' '), 'fusCdAAft', P.fusCdAAft.map(v => v.toFixed(2)).join(' '), 'Sw', P.gen.Sw.toFixed(2), 'cBar', P.gen.cBar.toFixed(2), 'xLEmac', P.gen.xLEmac.toFixed(2));
np(dd => { dd.params.fusCdA = [dd.params.fusCdA[0], 0, dd.params.fusCdA[2]]; dd.params.fusCdAAft = [0, 0, dd.params.fusCdAAft[2]]; }, 'no fuselage vertical blobs');
np(dd => { dd.params.polarTail = Object.assign({}, dd.params.polarTail, { a3d: 1e-6, Cl0: 0 }); if (dd.params.polarFin) dd.params.polarFin = Object.assign({}, dd.params.polarFin, { a3d: 1e-6 }); }, 'tail off (a3d 0)');
np(dd => { dd.params.polarTail = Object.assign({}, dd.params.polarTail, { a3d: 1e-6, Cl0: 0 }); dd.params.fusCdA = [dd.params.fusCdA[0], 0, dd.params.fusCdA[2]]; dd.params.fusCdAAft = [0, 0, dd.params.fusCdAAft[2]]; }, 'tail off + no vertical blobs');
np(dd => { dd.params.downwash = 0.45; }, 'downwash const 0.45');
console.log('  downwash const', d.params.downwash, 'polarTail', JSON.stringify(d.params.polarTail), 'stabTrim', d.params.stabTrim, 'Sh', d.spec.tail.Sh.toFixed(2), 'hX', d.spec.tail.hX.toFixed(2), 'hChord', d.spec.tail.hChord.toFixed(2), 'VCruise', d.params.ap.VCruise);
