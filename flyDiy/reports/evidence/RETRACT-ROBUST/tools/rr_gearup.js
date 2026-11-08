// RETRACT-ROBUST: the gear-up landing (GATE RETRACT §6's way: the person with gearForget 0.05 from seed 17 forgets the
// approach, the emergency extension disarmed) on a build + rows through the LOAD DOOR: what touches, the scar, the prop
//   node reports/evidence/RETRACT-ROBUST/tools/rr_gearup.js <build.json | key:<arch>> ['{"row":v}']
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..', '..'), T = path.join(ROOT, 'tools');
const argv = process.argv.slice(2), SRC = argv[0], OVER = JSON.parse(argv[1] && argv[1][0] === '{' ? argv[1] : '{}');
const LB = require(path.join(T, '_load_build.js')), C = require(path.join(T, 'flight_core.js'));
let raw;
if (SRC.startsWith('key:')) { const BJ = require(path.join(T, '_bake_joined.js')); const { D } = BJ.loadPanel();
  const a = D.ARCHETYPES.find(x => x.key === SRC.slice(4)); const s0 = D.designBake(a.sel, a.over); raw = { v: s0.v, spec: LB.gameSpecFull({ v: s0.v, birth: 1, spec: s0 }).spec }; }
else { raw = JSON.parse(fs.readFileSync(path.resolve(ROOT, SRC), 'utf8')); if (!raw.spec) raw = { spec: raw }; }
raw = JSON.parse(JSON.stringify(raw)); raw.spec.cage = Object.assign({}, raw.spec.cage || {}, OVER);
const spec = LB.gameSpec(raw);
const def = C.buildGen(C.genMigrateSpec ? C.genMigrateSpec(spec) : spec); def.params = Object.assign({}, def.params, { damage: true });
const W = C.makeWorld(), sim = C.makeSim(def, W); sim.reset(0);
for (let s = 0; s < 600; s++) sim.step(1 / 60);
sim.gearEmergency = () => {};
const ap = C.makePilot(sim, def, W, { profile: { quirks: { gearForget: 0.05 } }, seed: 17 });
let phases = [], last = '', firstTouch = null;
for (let s = 0; s < 600 * 60; s++) { const t = s / 60; ap.update(1 / 60); sim.step(1 / 60);
  if (ap.phase !== last) { phases.push(ap.phase); last = ap.phase; }
  if (sim.stats().bad) { phases.push('NaN'); break; }
  if (ap.phase === 'STOPPED' && t > 5) break; }
const D = sim.damage ? sim.damage() : null, SC = sim.damageScar ? sim.damageScar() : null, g = sim.gear();
console.log(JSON.stringify({ src: SRC, over: OVER, lift: spec.gear.retract && spec.gear.retract.lift, verdicts: ap.report.verdicts.map(v => v.code), phases: phases.join('>'),
  gearPos: g && g.pos, td: ap.tdInfo || null, prop: !!(D && D.propStrike), crashed: !!(D && D.crashed), breaks: D && D.breaks, yields: D && D.yields, scar: SC ? SC.hits : null }, null, 1));
