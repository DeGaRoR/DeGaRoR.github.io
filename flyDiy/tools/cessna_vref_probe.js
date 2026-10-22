// cessna_vref_probe.js (G2500, CESSNA-VREF) - ONE LEG IN THE GAME'S FLIGHT, SAMPLED: tools/_tour_lib.js gameHost (the worker's
// host and placement, DAY_CLOCK's day ticked, the page's pilot with the shakedown; the load door's aeroplane through
// tools/_load_build.js), damage on; every --every s from --from-phase on: the phase, s along the To's strip (from its
// centre, +hdg), the height over the ground, V / the TECS speed asked, the throttle, the elevator, the flap, the pitch and
// its command, the sink, the slope's height (ap.intent.h) and the height over it, the brake, the wheels down; then the
// approach record (ap.report.appr), the landing, the verdicts and the stop against the strip's ends.
//   node tools/cessna_vref_probe.js [<flyDiy dir>] [--build c172|cub|floats|<file.json>] [--order HOME,w3] [--calm]
//        [--every 0.25] [--from-phase FINAL] [--json out.json]

'use strict';
const path = require('path'), fs = require('fs');
const A0 = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
const ROOT = path.resolve(A0 || path.join(__dirname, '..')); const T = path.join(ROOT, 'tools');
const argv = process.argv.slice(A0 ? 3 : 2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
process.chdir(ROOT);
const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const TR = require(path.join(T, '_tour_lib.js'));
const B = TR.BUILDS[opt('build', 'c172')] || { key: path.resolve(opt('build')) };
const order = opt('order', 'HOME,w3').split(',');
const def = TR.defOf(C, PT, B.key);
const TW = TR.tourWorld(C, IN, fs);
const W = TW.W, A = id => W.aerodromes.find(q => q.id === id);
const a = A(order[0]), b = A(order[1]);
const H = TR.gameHost(C, W, def, a, b, { day: argv.includes('--calm') ? null : undefined });
const sim = H.sim;
const every = +opt('every', 0.25), from = opt('from-phase', 'FINAL');
H.queueCmd({ cmd: 'start' });
const Fx = Math.cos(b.hdg), Fz = Math.sin(b.hdg);
let t = 0, on = false, rows = [], last = -1, ph0 = null, stopped = null;
const r = (v, n) => v == null || !isFinite(v) ? null : +v.toFixed(n == null ? 2 : n);
console.log('mass ' + r(sim.totalM, 1) + ' fuel ' + r(sim.fuel && sim.fuel.litres, 1) + ' day ' + JSON.stringify(H.game.day && H.game.day.wind || H.game.day).slice(0, 120));
for (let k = 0; k < 60 * 1500; k++) {
  H.step(); t += 1 / 60;
  const ap = H.ap, ph = ap.phase;
  if (ph !== ph0) { console.log('  t ' + t.toFixed(1) + ' -> ' + ph); ph0 = ph; }
  if (ph === from) on = true;
  if (on && t - last >= every) {
    last = t;
    const cg = sim.cgPos(), v = sim.cgVel(), D = ap.dbg || {}, tc = D.tecs || {};
    const s = (cg[0] - b.x) * Fx + (cg[2] - b.z) * Fz;           // along the strip from its centre (frame +hdg)
    rows.push({ t: r(t, 1), ph, s: r(s, 0), agl: r(D.aglG, 1), V: r(D.V), Vc: r(tc.Vc), thr: r(sim.ctl.thr), de: r(sim.ctl.de, 3), flap: r(sim.ctl.flap), pitch: r(D.th * 57.3, 1), thC: r(tc.thC * 57.3, 1), vs: r(v[1]), wK: r(tc.wK), y: r(cg[1], 1), hP: r(ap.intent && ap.intent.h, 1), brake: r(sim.ctl.brake), onG: sim.wheelsOnGround ? sim.wheelsOnGround() : null });
  }
  if (ph === 'STOPPED' && on) { const cg = sim.cgPos(); stopped = (cg[0] - b.x) * Fx + (cg[2] - b.z) * Fz; break; }
}
const ap = H.ap;
for (const q of rows) console.log(JSON.stringify(q));
console.log('appr ' + JSON.stringify(ap.report.appr));
console.log('landing ' + JSON.stringify(ap.report.landing));
console.log('verdicts ' + ap.report.verdicts.map(v => v.t + ' ' + v.code + ': ' + (v.note || '')).join('\n  '));
console.log('strip ' + b.id + ' len ' + b.len + ' hdg ' + r(b.hdg * 57.3, 0) + '; stopped s ' + r(stopped, 1) + ' (ends at +/-' + b.len / 2 + ')');
const D = sim.damage ? sim.damage() : null; console.log('damage ' + JSON.stringify(D && { y: D.yields, b: D.breaks, dent: D.dented, crashed: D.crashed, gPeak: D.gPeak }));
if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify({ rows, appr: ap.report.appr, landing: ap.report.landing, verdicts: ap.report.verdicts, stopped }));
