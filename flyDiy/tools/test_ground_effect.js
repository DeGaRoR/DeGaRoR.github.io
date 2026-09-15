// Ground-effect gate: height sweep on the GARAGE BUILD via probe with a live
// world. (It swept the Cub fiche until the hand-written fleet retired,
// 2026-09-05; the bounds are shape bounds on the McCormick model and moved
// for no aeroplane.)
// Asserts the McCormick-shaped behaviour: total drag at fixed alpha falls
// monotonically as the wing approaches the ground, lift rises, and both
// converge to free-air values far from it.
const { buildGen, makeSim, makeWorld, makeAutopilot } = require('./flight_core.js');
const world = makeWorld();
const def = buildGen();

// same span datum the solver derives
let b = 0;
for (const st of def.strips) if (st.kind === 'wing')
  for (const i of [st.fIn, st.fOut, st.rIn, st.rOut])
    b = Math.max(b, Math.abs(def.nodes[i].p[2]));
b *= 2;

const sim = makeSim(def, world);
const AL = 3 * Math.PI / 180, V = 25;
const vel = [-V * Math.cos(AL), -V * Math.sin(AL), 0];

function wingY() {
  let sy = 0, sN = 0;
  for (const st of def.strips) if (st.kind === 'wing') {
    sy += sim.p[st.fIn*3+1] + sim.p[st.fOut*3+1]; sN += 2;
  }
  return sy / sN;
}
function probeAt(hb) {
  sim.reset(0);
  const dy = hb * b - wingY();          // runway pad is flat at 0
  for (let i = 0; i < sim.n; i++) sim.p[i*3+1] += dy;
  const r = sim.probe(vel);
  // lift/drag in the wind frame at incoming alpha
  return { L: -r.Fx * Math.sin(AL) + r.Fy * Math.cos(AL),
           D: r.Fx * Math.cos(AL) + r.Fy * Math.sin(AL) };
}

const HB = [0.05, 0.10, 0.25, 0.50, 1.0, 5.0, 20.0];
const R = HB.map(hb => ({ hb, ...probeAt(hb) }));
const free = R[R.length - 1];
for (const x of R)
  console.log(`h/b=${x.hb.toFixed(2).padStart(5)}  L=${x.L.toFixed(0).padStart(5)} N (${(100*x.L/free.L-100).toFixed(1).padStart(5)}%)  D=${x.D.toFixed(1).padStart(6)} N (${(100*x.D/free.D-100).toFixed(1).padStart(5)}%)`);

let monoD = true, monoL = true;
for (let i = 1; i < R.length; i++) {
  if (R[i].D < R[i-1].D - 1e-6) monoD = false;   // drag must rise with height
  if (R[i].L > R[i-1].L + 1e-6) monoL = false;   // lift must fall with height
}
const dragCut = 1 - R[0].D / free.D;              // at h/b = 0.05
const liftGain = R[0].L / free.L - 1;
const converged = Math.abs(R[5].D / free.D - 1) < 0.005 && Math.abs(R[5].L / free.L - 1) < 0.005;
console.log(`drag cut @h/b=0.05: ${(dragCut*100).toFixed(1)}%  lift gain: ${(liftGain*100).toFixed(1)}%  far-field converged: ${converged}`);

const checks = {
  'drag monotonic with height': monoD,
  'lift monotonic with height': monoL,
  'drag cut @0.05 in 8..45%': dragCut > 0.08 && dragCut < 0.45,
  // TAIL CHANTIER 2 P5 (2026-09-08): the window was cut on the constant-
  // downwash model, where the TAIL saw the same downwash on the ground as in
  // the air and the gain was the wing's alone (12.7 % here). Every build
  // flies the vortex model now, and near the ground the image vortices
  // cancel the downwash at the tail: the stab lifts 179 N at h/b 0.05 where
  // it lifted nothing far away, and the whole aeroplane — which is what the
  // probe measures — gains 19.9 %. That is the flare's nose-down, real;
  // the window is re-read to hold it, not the tail's lift removed
  'lift gain @0.05 in 1..25%': liftGain > 0.01 && liftGain < 0.25,
  'free-air converged by h/b=5': converged,
};
// ---------------------------------------------------------------------------
// THE GROUND IS SAMPLED LESS AND THE FLIGHT IS THE SAME (2026-09-14, the gate
// rationalization). Two exact shortcuts landed together: the runway pad
// reads 0 without the noise stack (20_world.js h0a) and an airborne node
// skips the per-substep terrain sample while a slope bound proves it clear
// (30_solver.js, the clearance cone). Both claim bit-identity, and a claim is
// not a proof: (1) the pad on a grid, both worlds, Object.is; (2) the slope
// bound re-measured against what the world declares; (3) the default build
// flown 40 s through take-off twice, cone on and off, every p and v compared
// every frame; (4) the comparator itself proven able to see a divergence.
{
  const Wx = makeWorld(0, { exactGround: true });
  let nGrid = 0, mismatch = 0, negZero = 0;
  for (let x = -1180; x <= 130; x += 2) for (let z = -90; z <= 90; z += 2) {
    nGrid++;
    const a = world.terrainH(x, z), bx = Wx.terrainH(x, z);
    if (!Object.is(a, bx)) mismatch++;
    if (Object.is(bx, -0)) negZero++;
  }
  for (const [x, z] of [[-1180, -90], [-1180, 90], [130, -90], [130, 90], [-1180.05, 0], [130.05, 0], [0, 90.05], [0, -90.05]]) {
    nGrid++;
    if (!Object.is(world.terrainH(x, z), Wx.terrainH(x, z))) mismatch++;
  }
  checks['the pad fast path reads what the noise stack reads'] = mismatch === 0;
  console.log(`pad identity: ${nGrid} points, ${mismatch} mismatches, ${negZero} negative zeros`);

  // the slope bound: coarse scan of the whole domain, refined round the steepest cells
  const S = world.slopeMax;
  const slopeAt = (x, z, h) => {
    const c = world.terrainH(x, z);
    return Math.max(Math.abs(world.terrainH(x + h, z) - c), Math.abs(world.terrainH(x, z + h) - c),
                    Math.abs(world.terrainH(x - h, z) - c), Math.abs(world.terrainH(x, z - h) - c)) / h;
  };
  const cells = [];
  for (let x = -12000; x <= 12000; x += 48) for (let z = -12000; z <= 12000; z += 48) cells.push([slopeAt(x, z, 24), x, z]);
  cells.sort((a, b2) => b2[0] - a[0]);
  let worst = 0;
  for (const [, x, z] of cells.slice(0, 300))
    for (let dx = -24; dx <= 24; dx += 4) for (let dz = -24; dz <= 24; dz += 4) worst = Math.max(worst, slopeAt(x + dx, z + dz, 0.25));
  checks['the declared slope bound holds with 2x margin'] = typeof S === 'number' && worst <= S / 2;
  console.log(`slope: measured ${worst.toFixed(2)} at the steepest 0.25 m probe, declared bound ${S}`);

  // the A/B flight
  const flyAB = (W, cone) => {
    const s = makeSim(def, W); s.setGroundCone(cone); s.reset(0);
    for (let i = 0; i < 600; i++) s.step(1 / 60);
    return { s, ap: makeAutopilot(s, def, W) };
  };
  const compare = (A, B, frames) => {
    let first = null, skipped = 0, sampled = 0, airborne = 0, airSkipped = 0, airSampled = 0;
    for (let f = 0; f < frames && !first; f++) {
      A.ap.update(1 / 60); A.s.step(1 / 60); B.ap.update(1 / 60); B.s.step(1 / 60);
      skipped += A.s.out.gndSkipped; sampled += A.s.out.gndSampled;
      if (A.s.wheelsOnGround() === 0) { airborne++; airSkipped += A.s.out.gndSkipped; airSampled += A.s.out.gndSampled; }
      for (let i = 0; i < A.s.p.length; i++)
        if (!Object.is(A.s.p[i], B.s.p[i]) || !Object.is(A.s.v[i], B.s.v[i])) { first = { f, i, a: A.s.p[i], b: B.s.p[i] }; break; }
    }
    return { first, skipped, sampled, airborne, airSkipped, airSampled, phase: A.ap.phase };
  };
  const r = compare(flyAB(world, true), flyAB(world, false), 60 * 40);
  const airFrac = r.airSkipped / Math.max(1, r.airSkipped + r.airSampled);
  checks['the clearance cone flies the identical trajectory'] = r.first === null;
  checks['the cone engages once airborne'] = r.airborne > 60 && airFrac > 0.9;
  console.log(`cone A/B 40 s: ${r.first ? 'DIVERGED at frame ' + r.first.f + ' index ' + r.first.i + ' (' + r.first.a + ' vs ' + r.first.b + ')' : 'identical'}` +
              ` | ${r.phase}, ${r.airborne} airborne frames, ${(airFrac * 100).toFixed(1)} % of airborne samples skipped`);

  // negative control: a world that lies about its slope must be caught — a
  // washboard of 3 cm bumps every 40 cm (slope 0.5) declared flat, so a
  // rolling wheel meets a bump between two frame-start samples
  const lie = Object.create(world, {
    terrainH: { value: (x, z) => world.terrainH(x, z) + 0.03 * Math.sin(x * 15) },
    slopeMax: { value: 0 },
  });
  const rn = compare(flyAB(lie, true), flyAB(lie, false), 60 * 15);
  checks['the comparator sees a divergence (negative control)'] = rn.first !== null;
  console.log(`negative control: a lying slope bound ${rn.first ? 'DIVERGED at frame ' + rn.first.f : 'went unseen'}`);
}

const failed = Object.keys(checks).filter(k => !checks[k]);
if (failed.length) console.log(`FAILED CHECKS: ${failed.join(', ')}`);
const pass = failed.length === 0;
console.log(pass ? 'GATE GE: PASS' : 'GATE GE: FAIL');
process.exitCode = pass ? 0 : 1;
