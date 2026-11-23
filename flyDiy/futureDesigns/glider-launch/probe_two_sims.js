// Probe: can two garage sims coexist in one process? determinism + cost.
'use strict';
const path = require('path');
const T = path.join(__dirname, '..', '..', 'tools');   // run from anywhere: node futureDesigns/glider-launch/probe_two_sims.js
// reuse arch_fly's panel loader verbatim
const src = require('fs').readFileSync(path.join(T, 'arch_fly.js'), 'utf8');
const lp = src.slice(src.indexOf('function loadPanel()'), src.indexOf('loadPanel();'));
eval(lp.replace(/__dirname/g, JSON.stringify(T)).replace('function loadPanel()', 'global.loadPanel = function ()'));
global.loadPanel();
const D = require(path.join(T, '_cage_design.js'));
const C = require(path.join(T, 'flight_core.js'));
const bake = k => { const a = D.ARCHETYPES.find(x => x.key === k); return D.designBake(a.sel, a.over); };
let t0 = Date.now();
const sTug = bake('c172'), sGl = bake('motorglider');
console.log('bake ms', Date.now() - t0);
t0 = Date.now(); const dTug = C.buildGen(sTug); const dGl = C.buildGen(sGl); console.log('buildGen x2 ms', Date.now() - t0);
const world = C.makeWorld();
function mk(def) { const s = C.makeSim(def, world); s.reset(0); return s; }
const N = 600;
function state(s) { let h = 0; for (let i = 0; i < s.p.length; i++) h = (h * 31 + Math.round(s.p[i] * 1e9) + Math.round(s.v[i] * 1e9)) % 1e15; return h; }
// solo runs
let a = mk(dTug); t0 = Date.now(); for (let i = 0; i < N; i++) a.step(1/60); const tA = Date.now() - t0;
let b = mk(dGl);  t0 = Date.now(); for (let i = 0; i < N; i++) b.step(1/60); const tB = Date.now() - t0;
const soloA = state(a), soloB = state(b);
// interleaved
const a2 = mk(dTug), b2 = mk(dGl);
for (let i = 0; i < N; i++) { a2.step(1/60); b2.step(1/60); }
console.log('step ms/frame  tug', (tA/N).toFixed(2), ' glider', (tB/N).toFixed(2));
console.log('interleaved == solo  tug', state(a2) === soloA, ' glider', state(b2) === soloB);
console.log('nodes tug', dTug.nodes && dTug.nodes.length, 'glider', dGl.nodes && dGl.nodes.length, ' mass', a.totalM.toFixed(0), b.totalM.toFixed(0));
