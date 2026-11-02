#!/usr/bin/env node
// STOL-PILOT-3 (A0 + PILOT, 28 Oct): ONE STOL LEG, MEASURED AT THE TOUCH - GATE STOL section 9's runner (three of them run
// side by side). The showcase (or any build file through the game's load door) flies the pilot's circuit off HOME with its
// shakedown handed as the page hands it, on an optional wind / gust, flown by an optional profile; the last line of stdout
// is JSON: { outcome, ga, appr: { technique, gust, Vref, stol }, landing (the report's), touches (the first touch + every
// lift of >= 0.15 s back off the surface after it, pilot_trace's bounce rule), td: { bank, sink, V } at the first touch }.
//
//   node tools/_stol_leg.js tools/fixtures/stol_cub_showcase.json [--profile bush] [--wind x,z] [--gust g] [--max s]
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname;
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const C = require(path.join(T, 'flight_core.js'));
const LB = require(path.join(T, '_load_build.js'));
const file = argv[0];
const spec = LB.gameSpec(JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')));
const world = C.makeWorld();
const wind = opt('wind', null), gust = +opt('gust', 0);
if (wind || gust) world.setWeather({ wind: { base: wind ? [+wind.split(',')[0], 0, +wind.split(',')[1]] : [0, 0, 0], gust, refH: 10 } });
const def = C.buildGen(JSON.parse(JSON.stringify(spec)));
const sh = C.genShakedown(C.buildGen(JSON.parse(JSON.stringify(spec))), { corners: false });
const sim = C.makeSim(def, world);
sim.reset(0);
for (let i = 0; i < 600; i++) sim.step(1 / 60);
const prof = opt('profile', null);
const ap = C.makePilot(sim, def, world, Object.assign({ shakedown: sh }, prof ? { profile: prof } : {}));
const maxS = +opt('max', 600);
let landed = false, offT = 0, off = false, touches = 0, td = null;
for (let s = 0; s < maxS * 60; s++) {
  ap.update(1 / 60); sim.step(1 / 60);
  const ph = ap.phase, onG = sim.wheelsOnGround() > 0;
  if (ph === 'FLARE' || ph === 'ROLLOUT') {
    if (onG) {
      if (!landed) { landed = true; touches = 1; td = { bank: Math.round((ap.dbg.ph || 0) * 573) / 10, sink: Math.round(-sim.cgVel()[1] * 100) / 100, V: Math.round((ap.dbg.V || sim.stats().ias || 0) * 10) / 10 }; }
      offT = 0; off = false;
    } else if (landed) { offT += 1 / 60; if (offT >= 0.15 && !off) { off = true; touches++; } }
  } else if (ph === 'GOAROUND') { landed = false; }
  if (sim.stats().bad) break;
  if (ph === 'STOPPED' && ap.t > 5) break;
}
const A = ap.report.appr || {};
console.log(JSON.stringify({ outcome: ap.report.outcome || ap.phase, ga: ap.gaN || 0,
  appr: { technique: A.technique, gust: A.gust, Vref: A.Vref, stol: !!A.stol }, landing: ap.report.landing || null, touches, td }));
