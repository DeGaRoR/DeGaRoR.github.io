// RETRACT-ROBUST: the aeroplane at rest, fixed vs the rows over it - the gear spec, the contacts' heights, the prop's
// clearance, and the damage after 2 s settled on flat ground (no pilot)
//   node reports/evidence/RETRACT-ROBUST/tools/rr_stance.js <build.json | key:<arch>> ['{"row":v}']
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..', '..'), T = path.join(ROOT, 'tools');
const argv = process.argv.slice(2), SRC = argv[0], OVER = JSON.parse(argv[1] && argv[1][0] === '{' ? argv[1] : '{}');
const LB = require(path.join(T, '_load_build.js')), C = require(path.join(T, 'flight_core.js'));
let raw0;
if (SRC.startsWith('key:')) { const BJ = require(path.join(T, '_bake_joined.js')); const { D } = BJ.loadPanel();
  const a = D.ARCHETYPES.find(x => x.key === SRC.slice(4)); const s0 = D.designBake(a.sel, a.over); raw0 = { v: s0.v, spec: LB.gameSpecFull({ v: s0.v, birth: 1, spec: s0 }).spec }; }
else { raw0 = JSON.parse(fs.readFileSync(path.resolve(ROOT, SRC), 'utf8')); if (!raw0.spec) raw0 = { spec: raw0 }; }
const one = over => { const raw = JSON.parse(JSON.stringify(raw0)); raw.spec.cage = Object.assign({}, raw.spec.cage || {}, over);
  const spec = LB.gameSpec(raw); const def = C.buildGen(C.genMigrateSpec ? C.genMigrateSpec(spec) : spec); def.params = Object.assign({}, def.params, { damage: true });
  const W = C.makeWorld(), sim = C.makeSim(def, W); sim.reset(0); if (sim.stance) sim.stance();
  let firstBad = null;
  for (let s = 0; s < 120; s++) { sim.step(1 / 60); const D = sim.damage && sim.damage(); if (!firstBad && D && (D.breaks || D.propStrike || D.crashed)) firstBad = { t: +(s / 60).toFixed(2), breaks: D.breaks, yields: D.yields, prop: !!D.propStrike, crashed: !!D.crashed }; }
  const D = sim.damage && sim.damage();
  const g = spec.gear; const pick = o => { const r = {}; for (const k of Object.keys(o || {})) if (typeof o[k] !== 'object') r[k] = o[k]; return r; };
  return { gear: pick(g), retract: g.retract || null, mass: +sim.totalM.toFixed(1), firstBad, end: D ? { breaks: D.breaks, yields: D.yields, prop: !!D.propStrike, crashed: !!D.crashed } : null }; };
const A = one({}), B = one(OVER);
const diff = {}; for (const k of new Set([...Object.keys(A.gear), ...Object.keys(B.gear)])) if (JSON.stringify(A.gear[k]) !== JSON.stringify(B.gear[k])) diff[k] = [A.gear[k], B.gear[k]];
console.log(JSON.stringify({ src: SRC, over: OVER, fixed: { mass: A.mass, firstBad: A.firstBad, end: A.end }, withRows: { mass: B.mass, retract: B.retract, firstBad: B.firstBad, end: B.end }, gearSpecDiff: diff }, null, 1));
