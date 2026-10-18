// ap_lineup_probe.js (G3302, AP-ADAPT) - THE USER'S PATH, 18 Oct: "take the validated Rufus, say roll out and don't do
// anything, maybe just skip to line up, see what it does" (their log 20261018T211408: the stand, 23 s of taxi, SKIP TO
// LINE-UP, the roll, a 100 deg turn at 1-3 m agl into a tree). The game's flight (tools/_tour_lib.js gameHost) three ways:
//   taxi    the stand, the taxi, the roll (what every node harness flew)
//   lineup  the skip from a fresh start: place.lineup (sim_host lineup = app.js placeLinedUp)
//   kept    the skip after --taxi-s of taxi on the SAME sim (sim_link begin's keepSim: the worker keeps the sim the taxi
//           flew), as the page does when the button is pressed mid-taxi
// Each: 0.1 s rows from the roll until --after s past the lift-off; the heading off the roll's, the rudder, the tail.
//   node tools/ap_lineup_probe.js --build <file.json> [--ways taxi,lineup,kept] [--taxi-s 23] [--after 12] [--calm]
//        [--profile p] [--wind kts,dirDeg[,gust[,breeze]]] [--json out.json]
'use strict';
const path = require('path'), fs = require('fs');
const T = __dirname;
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
process.chdir(path.join(T, '..'));
const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
const C = require(process.env.PILOT_CORE || path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const TR = require(path.join(T, '_tour_lib.js'));
const key = path.resolve(opt('build'));
const TW = TR.tourWorld(C, IN, fs);
const W = TW.W, A = id => W.aerodromes.find(q => q.id === id);
const a = A('HOME'), b = A(opt('to', 'w3'));
// --wind kts,dirDeg[,gust[,breeze]]: the game's day with its wind replaced (the day card's own spec fields), the rest the game's
let day = argv.includes('--calm') ? null : undefined;
if (opt('wind')) { const [k, d, g, b] = opt('wind').split(',').map(Number); day = TR.gameDay(C); day.wind = Object.assign({}, day.wind, { kts: k, dirDeg: d }, isFinite(g) ? { gust: g } : {}, isFinite(b) ? { breeze: b } : {}); }
const taxiS = +opt('taxi-s', 23), after = +opt('after', 12);
const wrap = d => { while (d > 180) d -= 360; while (d < -180) d += 360; return d; };
const r2 = v => v == null || !isFinite(v) ? null : Math.round(v * 100) / 100;
function defOf() { const d = TR.defOf(C, PT, key); d.params = Object.assign({}, d.params, { damage: false }); return d; }
function fly(H, label) {
  const sim = H.sim, rows = [];
  let psi0 = null, tLift = null, tRoll = null, tTail = null, maxAfter = 0, maxRoll = 0, aglMin = null, k = 0;
  for (; k < 60 * 300; k++) {
    H.step();
    const ap = H.ap, m = ap._m || {}, D = ap.dbg || {}, ph = ap.phase, t = k / 60;
    if (ph === 'ROLL' && tRoll == null) { tRoll = t; psi0 = m.hdg; }
    if (tRoll == null) continue;
    const onG = sim.wheelsOnGround ? sim.wheelsOnGround() : (m.onGround ? 1 : 0);
    if (D.tailUp && tTail == null) tTail = t;
    if (tLift == null && onG === 0 && t - tRoll > 1) tLift = t;
    const dpsi = wrap(m.hdg - psi0);
    if (tLift == null) maxRoll = Math.max(maxRoll, Math.abs(dpsi));
    else { maxAfter = Math.max(maxAfter, Math.abs(dpsi)); aglMin = aglMin == null ? m.agl : Math.min(aglMin, m.agl); }
    if (k % 6 === 0) rows.push([r2(t - tRoll), ph, onG, D.tailUp ? 1 : 0, r2(dpsi), r2(m.ias), r2(m.gs), r2(m.agl), r2((m.bank || 0) * 57.3), r2((m.pitch || 0) * 57.3),
                                r2(sim.ctl.dr), r2(sim.ctl.da), r2(sim.ctl.de), r2(sim.ctl.thr), r2((m.beta || 0) * 57.3)]);
    if (tLift != null && t - tLift > after) break;
    if (t - tRoll > 60) break;
  }
  const L = { way: label, tRoll: r2(tRoll), tailUpAfter: r2(tTail != null ? tTail - tRoll : null), liftAfter: r2(tLift != null ? tLift - tRoll : null),
              hdgMaxRoll: r2(maxRoll), hdgMaxAfterLift: r2(maxAfter), aglMinAfterLift: r2(aglMin), phase: H.ap.phase,
              trunk: sim.trunkHits ? sim.trunkHits() : null, kept: !!H.keptSim, lineup: H.lineup ? { x: r2(H.lineup.x), z: r2(H.lineup.z) } : null };
  return { L, rows };
}
const out = {};
const prof = opt('profile');
for (const way of opt('ways', 'taxi,lineup,kept').split(',')) {
  let H;
  if (way === 'taxi') { H = TR.gameHost(C, W, defOf(), a, b, { day, profile: prof }); H.queueCmd({ cmd: 'start' }); }
  else if (way === 'lineup') { H = TR.gameHost(C, W, defOf(), a, b, { day, lineup: true, profile: prof }); H.queueCmd({ cmd: 'start' }); }
  else if (way === 'kept') {
    const H1 = TR.gameHost(C, W, defOf(), a, b, { day, profile: prof }); H1.queueCmd({ cmd: 'start' });
    for (let i = 0; i < 60 * taxiS; i++) H1.step();
    const ph1 = H1.ap.phase, cg1 = H1.sim.cgPos();
    H = TR.gameHost(C, W, H1.def, a, b, { day, lineup: true, keepSim: { def: H1.def, sim: H1.sim }, profile: prof });
    H.keptSim = true; H.queueCmd({ cmd: 'start' });
    out.keptFrom = { phase: ph1, x: r2(cg1[0]), z: r2(cg1[2]) };
  } else continue;
  const R = fly(H, way);
  out[way] = R;
  R.L.wind = opt('wind') || (day === null ? 'calm' : 'game'); console.log(JSON.stringify(R.L));
}
out.wind = day ? day.wind : null; out.cols = 'tFromRoll,ph,onG,tailUp,dpsi,ias,gs,agl,bank,pitch,dr,da,de,thr,beta';
if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify(out));
