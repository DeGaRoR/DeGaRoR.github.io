#!/usr/bin/env node
// G1807 DMG-PLOUGH bench: one float of a validated floatplane on the rigid bench, held at a trim, heaved to carry its
// share of the weight at a speed, and the hydro pitching moment about the aeroplane's CG (float frame: x aft of the
// step keel, y up) read with the plough wave on and off.
// node tools/dmgplough_bench.js <twin|cessna> [--V=1,2,3,4] [--trims=-10,-5,0,5,10] [--load=frac of W/2]
'use strict';
const path = require('path'), fs = require('fs');
const ARGS = process.argv.slice(2);
const arg = (k, d) => { const a = ARGS.find(s => s.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const C = require(arg('core', path.join(__dirname, 'flight_core.js')));
const L = require(path.join(__dirname, '_treecrash_lib.js'));
const H = C.HYDRO, D2R = Math.PI / 180;
const key = ARGS[0] || 'twin';
let def;
// G2031 (DMG-RECAL): the twin AS THE GAME FLIES IT (tools/_load_build.js `twinFloats`); FLYDIY_RAW_BUILDS=1: the fixture
def = L.defOf(key === 'twin' ? 'twinFloats' : 'floats', { elastic: true });
const P0 = def.parts.floats[0].P;
// the aeroplane's CG in the float frame (at rest: measured off the sim)
const cgX = +arg('cgx', key === 'twin' ? -0.22 : -0.67), cgY = +arg('cgy', key === 'twin' ? 1.54 : 1.57);
const mass = def.params.gen.mass || 475, Wh = mass * 9.81 / 2 * +arg('load', 1);
function at(kWave, U, trim) {
  const F = H.makeFloat(Object.assign({}, P0, { kWave }));
  const out = H.makeScratch(F);
  const run = keelY => { const S = H.makeBody(F, { trim, keelY }); S.v[0] = -U; H.hydroForces(F, S, H.stillWater, out); return S; };
  let lo = -1.2, hi = 0.6;
  for (let it = 0; it < 50; it++) { const m = 0.5 * (lo + hi); run(m); if (out.F[1] > Wh) lo = m; else hi = m; }
  const S = run(0.5 * (lo + hi));
  // the moment about the CG point (world), nose-up positive: the bench's x is aft, so a nose-up moment is about +z... read it
  const cgW = [0, 0, 0]; { const q = [cgX - F.cg[0], cgY - F.cg[1], 0 - F.cg[2]]; const R = S.R; cgW[0] = R[0]*q[0]+R[1]*q[1]+R[2]*q[2] + S.p[0]; cgW[1] = R[3]*q[0]+R[4]*q[1]+R[5]*q[2] + S.p[1]; cgW[2] = R[6]*q[0]+R[7]*q[1]+R[8]*q[2] + S.p[2]; }
  // tau is about S.p; shift to the CG point: tau_cg = tau - (cg - p) x F
  const r = [cgW[0] - S.p[0], cgW[1] - S.p[1], cgW[2] - S.p[2]], Fv = out.F;
  const tz = out.tau[2] - (r[0] * Fv[1] - r[1] * Fv[0]);
  return { keelY: 0.5 * (lo + hi), Fy: Fv[1], Fx: Fv[0], Mz: tz, wave: Object.assign({}, out.wave, { d0: undefined }) };
}
// sign: with x aft and y up, +z = x cross y: a +Mz turns +x (aft) toward +y (up) = the tail UP = NOSE-DOWN
const Vs = arg('V', '1,2,2.5,3,3.5,4,5,6').split(',').map(Number), trims = arg('trims', '-10,-5,0,3,6,10').split(',').map(Number);
console.log(`${key}: float L ${P0.L.toFixed(2)} B ${P0.B.toFixed(2)}; W/2 ${Wh.toFixed(0)} N; CG at x ${cgX} y ${cgY} (float frame); nose-up moment N m (kWave 0 -> 1), [draft at the step, wave a / tanE / Fn]`);
for (const U of Vs) {
  const row = trims.map(tr => { const a = at(0, U, tr), b = at(1, U, tr); return `${String(tr).padStart(4)}: ${(-a.Mz).toFixed(0).padStart(6)} -> ${(-b.Mz).toFixed(0).padStart(6)} [${(-b.keelY).toFixed(2)} ${b.wave.a.toFixed(2)}/${b.wave.tanE.toFixed(2)}/${b.wave.Fn.toFixed(2)}]`; });
  console.log(`V ${U}: ` + row.join(' | '));
}
