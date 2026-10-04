#!/usr/bin/env node
// tanks_float_cost.js - G1385 TANKS-FLOAT: the wet pass's own cost, per compute, on one frozen state (the user's Cub 10 s
// afloat), with its tanks and without - the step's wall time in the water moves with the floating state, this does not.
// Usage: node tools/tanks_float_cost.js <path to a tools/flight_core.js>
'use strict';
const fs = require('fs'), path = require('path');
const C = require(path.resolve(process.argv[2] || path.join(__dirname, 'flight_core.js')));
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'builds', 'cub_2026-09-20_corrected.json'), 'utf8')).spec;
const world = C.makeWorld(), sea = world.aerodromes.find(a => a.id === 'SEA');
const def = C.buildGen(spec), sim = C.makeSim(def, world); sim.reset(0); C.placeAtAerodrome(sim, sea);
const n = def.nodes.length, p = sim.p, c0 = sim.cgPos(), wh = world.waterH(c0[0], c0[2]);
let yMin = Infinity; for (let i = 0; i < n; i++) yMin = Math.min(yMin, p[i * 3 + 1] - def.nodes[i].r);
for (let i = 0; i < n; i++) { p[i * 3 + 1] += wh + 0.05 - yMin; sim.v[i*3]=sim.v[i*3+1]=sim.v[i*3+2]=0; }
for (let s = 0; s < 600; s++) sim.step(1 / 60);       // 10 s afloat
const WB = sim.wetBody; WB.every = 1;
const f = new Float64Array(p.length);
const time = () => { const w = []; for (let k = 0; k < 7; k++) { const t0 = process.hrtime.bigint(); for (let s = 0; s < 20000; s++) C.HYDRO.wetSolverPass(WB, world, f, sim.t, 1 / 360); w.push(Number(process.hrtime.bigint() - t0) / 20000); } return Math.min(...w); };
const a = time(); const keep = WB.tanks; const b = keep ? (WB.tanks = [], time()) : NaN;
console.log(`wet pass ${a.toFixed(0)} ns a compute${keep ? `; without its ${keep.length} tanks ${b.toFixed(0)} ns (the tanks ${(a - b).toFixed(0)} ns)` : ''}; ${WB.tris.length} faces, ${WB.slices.length} slices, ${WB.slabs.length} slabs, wet ${(+sim.out.hydroWet).toFixed(3)}`);
