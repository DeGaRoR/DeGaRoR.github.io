#!/usr/bin/env node
// COMMUNITY-AIRPORT (13 Nov 2026): THE PILOT AT EVERY STAGE OF THE COMMUNITY FIELD (w7) - an instrument, it asserts nothing
// (GATE COMMUNITY row 5 asserts its numbers). For each stage of the `community` track the island's record is composed AT
// that stage (27_premises stageView: the strip's length, width, surface and bumps of the stage - the physics the wheels
// stand on) and a leg pair is flown the game's way (tools/_tour_lib.js gameHost / flyTour: the game's day, placement,
// pilot, the damage ON): Old Community Runway (w6) > w7, then a circuit w7 > w7.
//
//   node tools/community_fly.js [--builds=cub,c172] [--stages=0,1,2] [--order=w6,w7,w7]
//   -> one line per leg, then one JSON line per (build, stage): COMMUNITY_FLY {...}
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname;
const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
const C = require(process.env.PILOT_CORE ? path.resolve(process.env.PILOT_CORE) : path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const TR = require(path.join(T, '_tour_lib.js'));
const arg = (k, d) => { const a = process.argv.find(s => s.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const BUILDS = arg('builds', 'cub,c172').split(','), STAGES = arg('stages', '0,1,2').split(',').map(Number), ORDER = arg('order', 'w6,w7,w7').split(',');
const FX = path.join(T, 'fixtures', 'island_jolene.json');
const K = require(path.join(T, 'premises_cook.js'));
const { PG } = K.headless();

// the record AT a stage, as a fixture text (the sandbox's other tracks at their max)
function stagedText(n) {
  const whole = PG.unwrap(fs.readFileSync(FX, 'utf8')).rec;
  const t = Object.assign({}, C.stageMaxes(), { community: n });
  return JSON.stringify(PG.stageView(whole, t).rec);
}
function main() {
  const out = [];
  for (const n of STAGES) {
    const tmp = path.join(require('os').tmpdir(), 'community_stage_' + n + '_' + process.pid + '.json');
    fs.writeFileSync(tmp, stagedText(n));
    try {
      for (const b of BUILDS) {
        const t0 = Date.now();
        const TW = TR.tourWorld(C, IN, fs, { fixture: tmp });
        const W = TW.W, a7 = W.aerodromes.find(a => a.id === 'w7');
        const def = TR.defOf(C, PT, TR.BUILDS[b].key);
        const R = TR.flyTour(C, W, def, ORDER, { game: {}, tMax: 1500 });
        console.log('stage ' + n + ' (w7 ' + a7.len + ' x ' + a7.wid + ' m ' + a7.look + ', surface ' + a7.surface + ', chaos ' + (a7.micro ? a7.micro.chaos : 0) + ') ' + TR.BUILDS[b].name + ' (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
        for (const L of R.legs) console.log(TR.fmtLeg(L));
        const row = { stage: n, build: b, w7: { len: a7.len, wid: a7.wid, surface: a7.surface, look: a7.look, chaos: a7.micro ? a7.micro.chaos : 0 }, done: R.done,
          legs: R.legs.map(L => ({ from: L.from, to: L.to, ok: L.ok, declined: L.declined || null, heldOff: L.heldOff || null, landedOn: L.landedOn || null,
            lift: L.dep && L.dep.toDist, run: L.arr && L.arr.landing ? L.arr.landing.run : null, faults: (L.faults || []).map(f => f.k + (f.note ? ': ' + f.note : '')) })) };
        out.push(row);
        console.log('COMMUNITY_FLY ' + JSON.stringify(row));
      }
    } finally { fs.unlinkSync(tmp); }
  }
  return out;
}
if (require.main === module) main();
module.exports = { stagedText, main };
