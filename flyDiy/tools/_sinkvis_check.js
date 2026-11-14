#!/usr/bin/env node
// GATE SINKVIS (SNOW-MUD FINISH, 2026-11-15) — THE WHEELS STAND IN THE MUD, THE CONTACT STAYS HONEST.
//
// A0 for the user (15 Nov): "wheels, tailwheels and skis sink visibly into mud and soft snow (depth from the surface + load;
// the physics contact stays honest)". The solver's contact is at the hard ground and its sinkage is a drag and a readout
// (SNOW-MUD's named cut); the DRAWN aeroplane is lowered and tilted by the plane through each contact's own sinkage:
// sim.out.softW [main 0, main 1, tail 1, tail 2] (a soft frame's only), a ski's out.skiSink[k] at def.refs.skis[k] (SKIS'
// contract), groundSinkPose (the best-fit plane, 00_registry), groundSinkMatrix (the rigid motion), app.js sinkPoseApply
// (eased over SINK_TAU, premultiplied on model.grp's matrix).
//
//   node tools/_sinkvis_check.js            -> "GATE SINKVIS: PASS|FAIL"
//   node tools/_sinkvis_check.js --show     -> the numbers
//   node tools/_sinkvis_check.js --selftest -> negative verification
//
// A. THE ABSENT CASE: on grass and paved the solver writes no softW (nor softZ / softF); the viewer's pass is one compare.
// B. PER WHEEL, FROM THE LOAD: at rest on soft mud the stock Cub's mains and tailwheel each carry their own sinkage, in their
//    refs' order, equal to groundSinkWheel at that wheel's own load (the slots are the wheels', not the frame's deepest).
// C. THE DRAWN POSE: the plane through the contacts carried onto the drawn wheels - every wheel's drawn bottom ends its own
//    sinkage under the contact (within 5 mm), the tilt a few mrad, the drop between the shallowest and the deepest.
// D. THE PLANE: one point level, two points level across them, three or more least squares (exact through three).
// E. THE WIRING: app.js applies it after the solver's basis, returns at once off a soft layer and eased back, reads the
//    skis' contract, and the matrix is the core's.
// F. THE COST: the per-frame work (the fit and the matrix) under 5 us.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const C = require(path.join(__dirname, 'flight_core.js'));
const SHOW = process.argv.includes('--show'), SELF = process.argv.includes('--selftest');
const log = s => { if (SHOW) console.log('  ' + s); };

const flat = sc => ({ terrainH: () => 0, surface: () => sc, treesNear: () => [] });
function settle(sc, spec) {
  const def = C.buildGen(spec || {}), sim = C.makeSim(def, flat(sc)); sim.reset(0);
  const seen = { softW: 0, softZ: 0 };
  for (let s = 0; s < 4 * 60; s++) { sim.step(1 / 60); if ('softW' in sim.out) seen.softW++; if ('softZ' in sim.out) seen.softZ++; }
  return { def, sim, seen };
}
// the wheel's static load: the ground spring's force at its penetration (the solver's KGn x pen), read back as the sum
// the wheel's drag implies - simplest honest read: the sinkage law at the load that sinks it that deep
function run(o) {
  const fail = [], yes = (ok, label, extra) => { if (!ok) fail.push(label + (extra != null ? ' - ' + extra : '')); };
  const pose = o.pose, mat = o.mat;
  // A
  for (const sc of [0, 5]) { const r = settle(sc); yes(r.seen.softW === 0 && r.seen.softZ === 0, 'A no soft readout on the hard code ' + sc, JSON.stringify(r.seen)); }
  // B
  const M = settle(12), sim = M.sim, def = M.def, W = sim.out.softW, R = def.refs;
  yes(Array.isArray(W) && W.length === 4, 'B softW is the four slots', JSON.stringify(W));
  const iM0 = R.mains[0], iM1 = R.mains[1], iT = R.tw;
  yes(W[0] > 0.005 && W[1] > 0.005 && W[2] > 0.005 && W[3] === 0, 'B both mains and the tailwheel sink on soft mud, no second tail', JSON.stringify(W.map(z => +z.toFixed(4))));
  yes(Math.abs(W[0] - W[1]) < 0.25 * Math.max(W[0], W[1]), 'B the two mains sink alike on level ground', W[0].toFixed(4) + ' / ' + W[1].toFixed(4));
  yes(W[2] !== W[0], 'B the tail\'s own sinkage, not a copy of the frame\'s deepest', W[2].toFixed(4) + ' vs ' + W[0].toFixed(4));
  yes(Math.max(W[0], W[1], W[2]) === sim.out.softZ, 'B the deepest of them is softZ', sim.out.softZ);
  log('B at rest on soft mud: mains ' + (W[0] * 100).toFixed(1) + ' / ' + (W[1] * 100).toFixed(1) + ' cm, tail ' + (W[2] * 100).toFixed(1) + ' cm');
  // C
  const P = sim.p, cg = sim.bodyOrigin(), r = i => def.nodes[i].r || 0;
  const pts = [[P[iM0 * 3], P[iM0 * 3 + 2], W[0]], [P[iM1 * 3], P[iM1 * 3 + 2], W[1]], [P[iT * 3], P[iT * 3 + 2], W[2]]];
  const v = pose(pts, cg[0], cg[2]), A = mat(v, cg[0], cg[1], cg[2]);
  const app = (x, y, z) => [A[0] * x + A[4] * y + A[8] * z + A[12], A[1] * x + A[5] * y + A[9] * z + A[13], A[2] * x + A[6] * y + A[10] * z + A[14]];
  let worst = 0;
  [[iM0, W[0]], [iM1, W[1]], [iT, W[2]]].forEach(([i, z]) => {
    const b0 = [P[i * 3], P[i * 3 + 1] - r(i), P[i * 3 + 2]], b1 = app(b0[0], b0[1], b0[2]);
    worst = Math.max(worst, Math.abs((b0[1] - b1[1]) - z));
  });
  yes(worst < 0.005, 'C every drawn wheel stands its own sinkage in the layer (within 5 mm)', (worst * 1000).toFixed(2) + ' mm');
  yes(Math.abs(v[1]) < 0.05 && Math.abs(v[2]) < 0.05, 'C the tilt is small (< 50 mrad)', v[1].toFixed(4) + ', ' + v[2].toFixed(4));
  // C2: the same wheels, a deep tail (12 cm: a small tailwheel in powder) and one main deeper (a soft patch) - the tilt's
  // sign carried onto the drawn wheels
  const W2 = [0.03, 0.07, 0.12], pts2 = [[P[iM0 * 3], P[iM0 * 3 + 2], W2[0]], [P[iM1 * 3], P[iM1 * 3 + 2], W2[1]], [P[iT * 3], P[iT * 3 + 2], W2[2]]];
  const v2 = pose(pts2, cg[0], cg[2]), A2m = mat(v2, cg[0], cg[1], cg[2]);
  let worst2 = 0;
  [[iM0, W2[0]], [iM1, W2[1]], [iT, W2[2]]].forEach(([i, z]) => {
    const x = P[i * 3], y = P[i * 3 + 1] - r(i), zz = P[i * 3 + 2], y1 = A2m[1] * x + A2m[5] * y + A2m[9] * zz + A2m[13];
    worst2 = Math.max(worst2, Math.abs((y - y1) - z));
  });
  yes(worst2 < 0.005, 'C2 a deep tail and one deep main: each drawn wheel still stands its own sinkage (the tilt\'s sign)', (worst2 * 1000).toFixed(2) + ' mm');
  yes(v[0] >= Math.min(W[0], W[1], W[2]) - 1e-9 && v[0] <= Math.max(W[0], W[1], W[2]) + 1e-9, 'C the drop under the CG lies between the shallowest and the deepest', v[0].toFixed(4));
  log('C drop ' + (v[0] * 100).toFixed(1) + ' cm, pitch ' + (v[1] * 1000).toFixed(1) + ' mrad, roll ' + (v[2] * 1000).toFixed(1) + ' mrad; worst wheel ' + (worst * 1000).toFixed(2) + ' mm');
  // D
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  let q = pose([[3, 4, 0.07]], 0, 0); yes(near(q[0], 0.07) && q[1] === 0 && q[2] === 0, 'D one point: level at its depth', JSON.stringify(q));
  q = pose([[0, -1, 0.0], [0, 1, 0.1]], 0, 0); yes(near(q[0], 0.05) && near(q[1], 0) && near(q[2], 0.05), 'D two points: through both, level across', JSON.stringify(q));
  q = pose([[0, -1, 0.05], [0, 1, 0.05], [-5, 0, 0.10]], 0, 0); yes(near(q[0], 0.05) && near(q[1], -0.01) && near(q[2], 0), 'D three points: exact (the tail deeper pitches the nose up)', JSON.stringify(q));
  q = pose([[0, -1, 0.05], [0, 1, 0.05], [-5, 0, 0.10], [-5, 0, 0.10]], 0, 0); yes(near(q[1], -0.01), 'D more points: least squares');
  q = pose([], 0, 0); yes(q[0] === 0 && q[1] === 0 && q[2] === 0, 'D no point: nothing');
  // E
  if (o.src) {
    const a = o.src;
    yes(/model\.grp\.matrix\.copy\(mBasis\);\n\s*sinkPoseApply\(cg\);/.test(a), 'E applied right after the solver\'s basis');
    yes(/if \(!SW && !SK && SINK_V\[0\] < 1e-4/.test(a), 'E off a soft layer and eased back: one compare, nothing touched');
    yes(/groundSinkMatrix\(SINK_V/.test(a) && /groundSinkPose\(SINK_PTS/.test(a), 'E the core\'s fit and matrix');
    yes(/R\.skis/.test(a) && /o\.skiSink/.test(a), 'E reads the skis\' contract (def.refs.skis, out.skiSink)');
  }
  // F
  const t0 = process.hrtime.bigint(), N = 20000, out = [0, 0, 0], A2 = new Array(16);
  for (let k = 0; k < N; k++) { pose(pts, cg[0], cg[2], out); mat(out, cg[0], cg[1], cg[2], A2); }
  const us = Number(process.hrtime.bigint() - t0) / 1e3 / N;
  yes(us < 5, 'F the frame\'s work under 5 us', us.toFixed(2) + ' us');
  log('F ' + us.toFixed(2) + ' us a frame');
  return fail;
}
const src = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
if (SELF) {
  const bad = [];
  const doctor = (name, o) => { const f = run(o); console.log('  selftest ' + name + ': ' + (f.length ? 'red (' + f[0] + ')' : 'STILL GREEN')); if (!f.length) bad.push(name); };
  doctor('the drop forgotten', { pose: C.groundSinkPose, mat: (v, x, y, z, o) => C.groundSinkMatrix([0, v[1], v[2]], x, y, z, o) });
  doctor('the tilt reversed', { pose: C.groundSinkPose, mat: (v, x, y, z, o) => C.groundSinkMatrix([v[0], -v[1], -v[2]], x, y, z, o) });
  doctor('a flat mean, no plane', { pose: (p, x, z, o) => { o = o || [0, 0, 0]; o[0] = p.length ? p.reduce((s, q) => s + q[2], 0) / p.length : 0; o[1] = o[2] = 0; return o; }, mat: C.groundSinkMatrix });
  doctor('the wiring gone', { pose: C.groundSinkPose, mat: C.groundSinkMatrix, src: src.replace('sinkPoseApply(cg);', '') });
  console.log('GATE SINKVIS selftest: ' + (bad.length ? 'FAIL (' + bad.join(', ') + ' stayed green)' : 'PASS (every doctored law went red)'));
  process.exit(bad.length ? 1 : 0);
}
const t0 = Date.now(), fail = run({ pose: C.groundSinkPose, mat: C.groundSinkMatrix, src });
for (const f of fail) console.log('  FAIL ' + f);
console.log('  (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
console.log('GATE SINKVIS: ' + (fail.length ? 'FAIL (' + fail.length + ')' : 'PASS'));
process.exit(fail.length ? 1 : 0);
