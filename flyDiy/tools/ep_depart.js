#!/usr/bin/env node
// ep_depart.js - EAST-POINT-DEPART (G2450): a short strip's departure, flown again and again from ONE landing. The arrival
// (HOME > the strip, the game's flight: _tour_lib gameHost - the worker's host, the game's day ticked, the load door's
// aeroplane) is flown once and the stopped aeroplane saved (makeSim snap - the whole state a step reads, the clock
// included, so the day's wind is the same at every replay); each replay is a fresh host with that state put back and
// the page's 'leg' command (app.js nextLeg) to the next field - _tour_lib flyLeg's record, as GATE TOUR reads it.
//   node tools/ep_depart.js save [--build cub|c172|<file>] [--at nv_strip] [--from HOME] [--snap out.bin] [--calm] [--nodmg]
//   node tools/ep_depart.js dep  [--build ...] [--at nv_strip] [--to mn_strip] [--snap in.bin] [--calm] [--nodmg] [--trace]
'use strict';
const fs = require('fs'), path = require('path'), v8 = require('v8');
const T = __dirname;
const PT = require(path.join(T, 'pilot_trace.js'));
PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const TR = require(path.join(T, '_tour_lib.js'));
const argv = process.argv.slice(2), mode = argv[0];
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const B = TR.BUILDS[opt('build', 'cub')] || { key: path.resolve(opt('build')), name: path.basename(opt('build')) };
const at = opt('at', 'nv_strip'), from = opt('from', 'HOME'), to = opt('to', 'mn_strip');
const snapF = opt('snap', path.join(T, '.ep_' + path.basename(B.key, '.json') + '_' + at + (argv.includes('--calm') ? '_calm' : '') + (argv.includes('--nodmg') ? '_nodmg' : '') + '.bin'));
const def = TR.defOf(C, PT, B.key);
if (argv.includes('--nodmg')) def.params.damage = false;
const TW = TR.tourWorld(C, IN, fs);
const W = TW.W, A = id => W.aerodromes.find(q => q.id === id);
const game = { day: argv.includes('--calm') ? null : undefined, damage: !argv.includes('--nodmg') };
// --winddir deg / --windkts kt: the game's day with another wind (the departure's no-go side: a tailwind on the only way out)
if (opt('winddir', null) != null || opt('windkts', null) != null) {
  const d = TR.gameDay(C); d.wind = Object.assign({}, d.wind, opt('winddir', null) != null ? { dirDeg: +opt('winddir') } : {}, opt('windkts', null) != null ? { kts: +opt('windkts') } : {});
  game.day = d;
}
const t0 = Date.now();
if (mode === 'save' && opt('chain', null)) {
  // --chain HOME,w3,...,<at>: the tour's own chained legs (flyTour's: the first off the stand, each next the 'leg' command
  // from where the aeroplane stopped), the state saved after the last - a later leg replayed as the tour flies it
  const order = opt('chain').split(',');
  const H = TR.gameHost(C, W, def, A(order[0]), A(order[1]), game);
  for (let i = 1; i < order.length; i++) {
    const L = TR.flyLeg(C, W, H.sim, H.def, A(order[i - 1]), A(order[i]), { first: i === 1, host: H });
    console.log(TR.fmtLeg(L));
    if (!L.ok) { console.log('the chain stopped at ' + L.from + ' > ' + L.to); process.exit(1); }
  }
  const S = H.sim.snap();
  if (!S) { console.log('snap: the aeroplane is not whole - nothing saved'); process.exit(1); }
  fs.writeFileSync(snapF, v8.serialize({ S, steps: H.steps, build: B.key }));
  console.log('saved ' + snapF + ' (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s wall)');
} else if (mode === 'save') {
  const H = TR.gameHost(C, W, def, A(from), A(at), game);
  const arr = [];
  if (argv.includes('--trace')) {
    const st0 = H.sim.step; let n = 0; const b = A(at);
    H.sim.step = dt => { st0(dt); if ((n++ % 60) === 0) { const s = H.sim, cg = s.cgPos(), I = H.ap.intent || {}, Lg = H.ap.legs && H.ap.legs[H.ap.legI];
      arr.push([Math.round(n / 60), H.ap.phase, Math.round(Math.hypot(cg[0] - b.x, cg[2] - b.z) - b.len / 2), Math.round(cg[1]), Math.round(W.terrainH(cg[0], cg[2])), I.h != null ? Math.round(I.h) : null, +(s.out.V || 0).toFixed(1), Lg ? Lg.name : null, Lg && Lg.vpSum ? JSON.stringify(Lg.vpSum) : null]); } };
  }
  const L = TR.flyLeg(C, W, H.sim, H.def, A(from), A(at), { first: true, host: H });
  console.log(TR.fmtLeg(L));
  console.log('    verdicts ' + L.verdicts.join(' | '));
  const S = H.sim.snap();
  if (!S) { console.log('snap: the aeroplane is not whole - nothing saved'); process.exit(1); }
  fs.writeFileSync(snapF, v8.serialize({ S, steps: H.steps, leg: L, build: B.key }));
  if (arr.length) fs.writeFileSync(opt('trace-out', path.join(T, '.ep_arr.json')), JSON.stringify(arr));
  console.log('saved ' + snapF + ' (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s wall)');
} else {
  const R = v8.deserialize(fs.readFileSync(snapF));
  const H = TR.gameHost(C, W, def, A(at), A(to), game);
  // (the saved state's def references are the saving process's: the same build's arrays here - unsnap checks them by identity)
  R.S.nodes = H.def.nodes; R.S.beams = H.def.beams;
  if (!H.sim.unsnap(R.S)) { console.log('unsnap: the saved state does not fit this build'); process.exit(2); }
  H.steps = R.steps;
  H.queueCmd({ cmd: 'start' });
  const trace = argv.includes('--trace') ? [] : null;
  if (trace) {
    const st0 = H.sim.step; let n = 0;
    H.sim.step = dt => { st0(dt); if ((n++ % 15) === 0) { const s = H.sim, cg = s.cgPos(), v = s.cgVel(), a = A(at), ux = Math.cos(a.hdg), uz = Math.sin(a.hdg);
      const o = s.out || {}; trace.push([+(n / 60).toFixed(2), H.ap.phase, +((cg[0] - a.x) * ux + (cg[2] - a.z) * uz).toFixed(1), +(-(cg[0] - a.x) * uz + (cg[2] - a.z) * ux).toFixed(1), +(cg[1] - W.terrainH(cg[0], cg[2])).toFixed(2), +Math.hypot(v[0], v[2]).toFixed(2), +Math.hypot(v[0] - (o.windX || 0), v[2] - (o.windZ || 0)).toFixed(2), +((o.windX || 0) * ux + (o.windZ || 0) * uz).toFixed(2), +(s.ctl.thr || 0).toFixed(2), +(s.ctl.brake || 0).toFixed(2), +(s.ctl.flap || 0).toFixed(2),
      // the arrival: the distance to the To's centre, the height, the ground, the plan's height, the air's vertical
      Math.round(Math.hypot(cg[0] - A(to).x, cg[2] - A(to).z)), Math.round(cg[1]), Math.round(W.terrainH(cg[0], cg[2])), H.ap.intent && H.ap.intent.h != null ? Math.round(H.ap.intent.h) : null, +(o.windY || 0).toFixed(2), +(o.Veas || 0).toFixed(1), +(s.ctl.thr || 0).toFixed(2)]); } };
  }
  const L = TR.flyLeg(C, W, H.sim, H.def, A(at), A(to), { first: false, host: H, tMax: +opt('tmax', 1800) });
  console.log(TR.fmtLeg(L));
  console.log('    phases ' + L.phases.join('>') + '\n    verdicts ' + L.verdicts.join(' | '));
  console.log('    dep ' + JSON.stringify(L.dep) + ' (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s wall)');
  if (trace) fs.writeFileSync(opt('trace-out', path.join(T, '.ep_trace.json')), JSON.stringify(trace));
  process.exit(L.ok ? 0 : 1);
}
