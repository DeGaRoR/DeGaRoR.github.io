// THE PROBES (perf_study.js's instruments, shared since PERF STUDY chantier 2
// with GATE DRAG): the same sim.probe the shakedown flies, swept over speed
// for the level-flight thrust/drag balance; the parasite fit; the ballast
// through the G121 door.
'use strict';
function probeAt(sim, V, a) {
  const [xA, yU] = sim.axes();
  const vel = [0, 0, 0];
  for (let k = 0; k < 3; k++) vel[k] = -V * (Math.cos(a) * xA[k] + Math.sin(a) * yU[k]);
  const r = sim.probe(vel);
  r.drag = -(r.Fx * -Math.cos(a) * xA[0] + r.Fy * -Math.cos(a) * xA[1] + r.Fz * -Math.cos(a) * xA[2])
           - (r.Fx * -Math.sin(a) * yU[0] + r.Fy * -Math.sin(a) * yU[1] + r.Fz * -Math.sin(a) * yU[2]);
  return r;
}
function alphaForLift(sim, V, W, aMax) {
  let a0 = 0.01, a1 = 0.09;
  let f0 = probeAt(sim, V, a0).Fy - W, f1 = probeAt(sim, V, a1).Fy - W;
  for (let i = 0; i < 10; i++) {
    if (Math.abs(f1 - f0) < 1e-9) break;
    let a2 = a1 - f1 * (a1 - a0) / (f1 - f0);
    a2 = Math.min(aMax, Math.max(-0.15, a2));   // a cambered wing at 3 Vs sits below -0.08
    a0 = a1; f0 = f1; a1 = a2; f1 = probeAt(sim, V, a1).Fy - W;
    if (Math.abs(f1) < 0.5) break;
  }
  return { a: a1, ok: Math.abs(f1) < 0.02 * W };
}
// level flight over the speed sweep: drag(V) and the thrust the prop makes
function sweep(def, sim, W) {
  return sweepAt(def, sim, W, def.params.gen.VsMeas || def.params.gen.Vs || 15);
}
function sweepAt(def, sim, W, Vs) {
  const aMax = 0.85 * def.params.polarWing.aStall;
  const rows = [];
  for (let V = Vs * 1.05; V <= Vs * 4.0; V += Vs * 0.05) {
    const al = alphaForLift(sim, V, W, aMax);
    if (!al.ok) continue;
    const r = probeAt(sim, V, al.a);
    const T1 = sim.thrustAt(V, 1);
    rows.push({ V, drag: r.drag, T1, LD: r.Fy / Math.max(1e-6, r.drag), excess: (T1 - r.drag) * V / W });
  }
  return rows;
}
// THE PARASITE FIT (chantier 0, 2026-09-15): the level-flight drag over the
// sweep is D = a q + b / q with q = rho V^2 / 2 (parasite + induced), so a
// least-squares fit over 1.5-3.0 Vs (above the stall's non-linearity;
// the probe flies past the thrust ceiling, so a Cub's rows exist to 3 Vs) reads the parasite drag AREA a (m2, "CdS")
// and the induced factor b = W^2 / (pi e b^2) straight off the probe. The
// drag chantier is judged on `a`; the study's 4.2 table was this by hand.
function parasiteFit(rows, Vs, rho) {
  let sxx = 0, sxy = 0, syy = 0, sxz = 0, syz = 0, n = 0;
  for (const r of rows) {
    if (r.V < 1.5 * Vs || r.V > 3.0 * Vs) continue;   // above the stall's non-linearity; a Cub has no 3.5 Vs
    const q = 0.5 * rho * r.V * r.V, x = q, y = 1 / q, z = r.drag;
    sxx += x * x; sxy += x * y; syy += y * y; sxz += x * z; syz += y * z; n++;
  }
  if (n < 3) return null;
  const det = sxx * syy - sxy * sxy;
  if (Math.abs(det) < 1e-12) return null;
  return { CdS: (sxz * syy - syz * sxy) / det, kInd: (syz * sxx - sxz * sxy) / det, n };
}
// BALLAST TO MTOW (chantier 0): the study used to load the card through
// spec.cargo.kg, which the clamp caps at 400 kg (the four big cards were
// measured 10-57 % light) and which moves the CG and the gear the frame
// places against it. The G121 door instead: every node scaled by the same
// factor, so the aeroplane is heavier AT ITS OWN CG and nothing else moves.
function ballast(sim, kg) {
  if (!(kg > 0)) return;
  const k = (sim.totalM + kg) / sim.totalM;
  for (let i = 0; i < sim.n; i++) sim.setNodeMass(i, sim.m[i] * k);
}
function levelSpeedAt(rows, frac) {
  // the highest V where drag <= frac * T1 (interpolated)
  let best = null;
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i], b = rows[i + 1];
    const fa = frac * a.T1 - a.drag, fb = frac * b.T1 - b.drag;
    if (fa >= 0 && fb < 0) best = a.V + (b.V - a.V) * fa / (fa - fb);
  }
  if (best == null && rows.length && frac * rows[rows.length - 1].T1 >= rows[rows.length - 1].drag) best = rows[rows.length - 1].V;
  return best;
}


module.exports = { probeAt, alphaForLift, sweep, sweepAt, levelSpeedAt, parasiteFit, ballast };
