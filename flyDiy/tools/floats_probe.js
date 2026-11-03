#!/usr/bin/env node
// floats_probe.js - AP-WATER-LAND / the water take-off (G3081, the PILOT COORDINATOR, 18 Oct): the user's float Cessna
// (bugReports/cessnaFloatsWOrks.json) flies one circuit off the SEA lane IN THE GAME'S FLIGHT (tools/_tour_lib gameHost:
// the worker's host, its pilot, the 8 kt / 250 deg day ticked, the load door's aeroplane), damage ON, and the water is
// read at 20 Hz: every touch, every skip (off the water >= 0.15 s after the first touch), the bank at each touch, the
// lowest wingtip over the water, a flip (bank past 90 deg), and the take-off run's pitch / heave (the 'uneven' report).
//   node tools/floats_probe.js [--build <file>] [--calm] [--damage 0|1] [--tmax 900] [--out <file.json>]
// A node job (~2-4 min): run it in an A0 slot (boxlock.sh take cpu <who> "UNTIMED ...").
'use strict';
const path = require('path'), fs = require('fs');
const T = __dirname;
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const BUILD = opt('build', 'bugReports/cessnaFloatsWOrks.json');
const DAMAGE = opt('damage', '1') !== '0';
const TMAX = +opt('tmax', 900);
const OUT = opt('out', null);
const C = require(path.join(T, 'flight_core.js'));
const TR = require(path.join(T, '_tour_lib.js'));
const PT = require(path.join(T, 'pilot_trace.js'));
const IN = require(path.join(T, 'island_node.js'));
const W = TR.tourWorld(C, IN, fs).W;
const def = TR.defOf(C, PT, path.join(T, '..', BUILD));
const sea = W.aerodromes.find(a => a.id === 'SEA');
const H = TR.gameHost(C, W, def, sea, sea, { day: argv.includes('--calm') ? null : undefined, damage: DAMAGE });
const sim = H.sim, sheet = H.ap.sheet || {};
const Vs0 = sheet.Vs0 || null, Vs = sheet.Vs || null;
const rows = [];
let t = 0;
const step0 = sim.step;
sim.step = dt => {
  step0(dt); t += dt;
  if (Math.round(t * 60) % 3) return;   // 20 Hz
  const o = sim.out || {}, ax = sim.axes(), xA = ax[0], zA = ax[2];
  const pitch = Math.asin(Math.max(-1, Math.min(1, -xA[1]))) * 57.3, bank = Math.asin(Math.max(-1, Math.min(1, zA[1]))) * 57.3;
  const cg = sim.cgPos(), v = sim.cgVel();
  let tipLow = null;
  if (typeof sim.nodePos === 'function' && def.params && def.params.gen && def.params.gen.tips) {
    for (const k of def.params.gen.tips) { const p = sim.nodePos(k); const h = p[1] - (W.waterH ? W.waterH(p[0], p[2]) : 0); tipLow = tipLow == null ? h : Math.min(tipLow, h); }
  }
  rows.push({ t: +t.toFixed(2), ph: H.ap.phase, V: +(o.V || 0).toFixed(2), vs: +(v[1]).toFixed(2), pitch: +pitch.toFixed(1), bank: +bank.toFixed(1),
    onG: sim.wheelsOnGround ? sim.wheelsOnGround() : -1, h: +(cg[1] - (W.waterH ? W.waterH(cg[0], cg[2]) : 0)).toFixed(2), thr: +(sim.ctl.thr || 0).toFixed(2),
    de: +(sim.ctl.de || 0).toFixed(3), flap: +(sim.ctl.flap || 0).toFixed(2), tipLow: tipLow == null ? null : +tipLow.toFixed(2) });
};
H.queueCmd({ cmd: 'start' });
const t0 = Date.now();
while (t < TMAX) {
  H.step();
  const D = sim.damage ? sim.damage() : null;
  if (D && D.over) break;
  if (H.ap.phase === 'STOPPED' && t > 60) break;
}
// ---- the reading ----
const D = sim.damage ? sim.damage() : null;
const air = rows.filter(r => r.onG === 0);
const firstAir = rows.findIndex(r => r.onG === 0 && r.h > 3);
// the take-off run: from the roll's start to the lift-off - pitch and its rate's spread, the heave
const roll = rows.slice(0, firstAir > 0 ? firstAir : 0).filter(r => r.ph === 'ROLL' || r.ph === 'LIFTOFF');
const sd = a => { if (a.length < 2) return 0; const m = a.reduce((s, x) => s + x, 0) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / a.length); };
const dp = []; for (let i = 1; i < roll.length; i++) dp.push((roll[i].pitch - roll[i - 1].pitch) / 0.05);
const lifts = []; { let off = null; for (const r of roll) { if (r.onG === 0) { if (off == null) off = r.t; } else { if (off != null && r.t - off >= 0.15) lifts.push(+(r.t - off).toFixed(2)); off = null; } } }
// the arrival: the first touch after the flight, every skip after it, the bank at each touch, a flip
const landI = rows.findIndex((r, i) => i > firstAir && firstAir > 0 && r.onG > 0 && rows[i - 1] && rows[i - 1].onG === 0 && rows.slice(firstAir, i).some(q => q.h > 20));
const arr = landI > 0 ? rows.slice(landI) : [];
const touches = []; { let prevOn = true, offT = null; for (const r of arr) { const on = r.onG > 0; if (on && !prevOn) { touches.push({ t: r.t, V: r.V, vs: r.vs, pitch: r.pitch, bank: r.bank, off: offT == null ? 0 : +(r.t - offT).toFixed(2) }); } if (!on && prevOn) offT = r.t; prevOn = on; } }
const skips = touches.filter(k => k.off >= 0.15);
const touch0 = landI > 0 ? rows[landI] : null;
const fin = rows.filter(r => r.ph === 'FINAL'), flare = rows.filter(r => r.ph === 'FLARE');
const res = {
  build: BUILD, damage: DAMAGE, game: H.game, Vs0, Vs, wallS: +((Date.now() - t0) / 1000).toFixed(0), simS: +t.toFixed(0), endPhase: H.ap.phase,
  verdicts: (H.ap.report && H.ap.report.verdicts || []).map(v => v.code + ': ' + v.note),
  takeoff: { samples: roll.length, pitchMin: roll.length ? Math.min(...roll.map(r => r.pitch)) : null, pitchMax: roll.length ? Math.max(...roll.map(r => r.pitch)) : null,
    pitchRateSd: +sd(dp).toFixed(2), hops: lifts, vsSd: +sd(roll.map(r => r.vs)).toFixed(2) },
  final: fin.length ? { Vmean: +(fin.reduce((s, r) => s + r.V, 0) / fin.length).toFixed(1), flapMax: Math.max(...fin.map(r => r.flap)), deMax: Math.max(...fin.map(r => r.de)), thrMean: +(fin.reduce((s, r) => s + r.thr, 0) / fin.length).toFixed(2) } : null,
  flare: flare.length ? { from: flare[0], to: flare[flare.length - 1] } : null,
  touch: touch0, touches: touches.length + 1, skips: skips.length, skipList: skips,
  bankMaxOnWater: arr.length ? Math.max(...arr.filter(r => r.onG > 0).map(r => Math.abs(r.bank))) : null,
  tipLowMin: arr.length ? Math.min(...arr.map(r => r.tipLow == null ? 99 : r.tipLow)) : null,
  flipped: arr.some(r => Math.abs(r.bank) > 90), damage: D ? { over: !!D.over, reason: D.reason || null, breaks: D.breaks || 0, yields: D.yields || 0 } : null,
};
console.log(JSON.stringify(res, null, 1));
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ res, rows }, null, 0));
