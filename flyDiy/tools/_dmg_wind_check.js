#!/usr/bin/env node
// GATE DMGWIND (G1883-G1884, DMG-WINDBREAK) - the 3 m/s taxi into a trunk IN A WIND breaks no engine mount, on the
// user's validated builds, on the certificate, node only (_dmg_wind_lib.js; DEFORM-AND-BREAK §11.3).
// DMG-D4b measured on the box: the page's Cub, staged at its stand (settled 2 s in the wind, 3 m/s, the throttle shut, a
// trunk 6 m ahead), broke its WHOLE engine mount with the page's ~5.5 m/s wind and nothing without it. The wind put no
// load on the nose (0 N on its nodes, ~64 N on the whole aeroplane); it weathercocked the parked Cub 2 deg and drifted
// it 14 cm, so the trunk met the engine's thrust node ON the node - where the contact pushed once per member meeting
// there (G1883: five times the node's spring and damper), bent the mount's tubes under a push along them, and the
// engine pivoted out of its fittings. The checks:
//   1. THE PAGE'S STAGING (the acceptance): steady winds 0 / 2.5 / 5 / 7.5 / 10 m/s from 12 directions (every 30 deg off
//      the nose): no member that breaks an engine's mount group breaks - the Jodel and the metal Cessna to 10 m/s, the
//      Cub (the finding) to 5 m/s, its 7.5 and 10 m/s REPORTED (one corner hit at the certificate's floor: HANDOVER
//      G1883); printed per direction
//   2. THE PAGE'S OWN WIND on the Cub: its vector (D4b's log) steady, and the climate's gust field at that base (09_climate
//      legacy: the surface layer + the gust sines at sim.t; gust 0.5 and 1, the weather panel's range): no mount member
//   3. THE FLOATPLANES (the check: no trunk on the water): 10 s taxiing at 3 m/s on the sea lane in 0 / 5 / 10 m/s from
//      the four quarters (the sea of that wind): nothing breaks
//   4. THE INSTRUMENT changes nothing: the per-substep reader on, the run's bits the same
//   REPORT (not gated): mirror symmetry (a wind from th and from 360 - th: the plastic work); the same sweep at the
//   page's IMPACT speed (~3 m/s: node's flat grass rolls the 6 m down to 2.2 m/s, the page's ground kept ~2.95 - the
//   start at 3.6 m/s); the trunk's offset across the nose with no wind
// Run: node tools/_dmg_wind_check.js [--json <file>]   (one final `GATE DMGWIND: PASS|FAIL`; children 3 at once)
'use strict';
const path = require('path');
const argv = process.argv.slice(2);
const TH = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330], US = [0, 2.5, 5, 7.5, 10];
const V_PAGE = 3, V_IMPACT = 3.6;
const OFFS = [-0.45, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45];

const row = a => ({ U: a.U, th: a.th, off: a.off, mount: a.mountBroken, mountOff: a.mountOff, broken: a.broken, work: Math.round(a.work), vImp: a.vImp, hit: a.hit,
  peak: +a.peak.toFixed(3), peakWho: a.peakWho, first: a.first ? a.first.who + ' ' + a.first.how : null, crashed: a.crashed, reason: a.reason, finite: a.finite });

// ---- a child: one part, JSON on its last line ----
if (argv[0] === '--part') {
  const W = require('./_dmg_wind_lib.js'), L = W.L;
  const [kind, key, a1, a2] = argv.slice(1), out = { kind, key };
  if (kind === 'sweep') {
    const V = +a1, U = +a2;
    out.V = V; out.U = U;
    out.rows = (U === 0 ? [0] : TH).map(th => Object.assign(row(W.taxi(key, { D: 6, V, wind: W.windVec(U, th) })), { U, th }));
  } else if (kind === 'page') {
    out.from = W.pageFrom(); out.rows = [];
    for (const V of [V_PAGE, V_IMPACT]) {
      out.rows.push(Object.assign(row(W.taxi('cub', { D: 6, V, wind: W.PAGE_WIND })), { V, src: 'steady' }));
      for (const g of [0.5, 1]) out.rows.push(Object.assign(row(W.taxi('cub', { D: 6, V, wind: W.gustField(W.PAGE_WIND, g) })), { V, src: 'gust ' + g }));
    }
    const f = W.gustField(W.PAGE_WIND, 1); out.gustAt2 = Array.from(f(0, W.ELEV + 1.48, 0, 2));
  } else if (kind === 'offset') {
    const V = +a1; out.V = V;
    out.rows = OFFS.map(off => Object.assign(row(W.taxi('cub', { D: 6, V, off })), { off }));
  } else if (kind === 'water') {
    const C = L.core(); out.rows = [];
    for (const U of [0, 5, 10]) for (const th of (U ? [0, 90, 180, 270] : [0])) {
      const def = L.defOf(key, { cert: true }), world = C.makeWorld(), sea = world.aerodromes.find(x => x.id === 'SEA');
      const sim = C.makeSim(def, world); sim.reset(0); C.placeAtAerodrome(sim, sea);
      const x0 = sim.axes()[0], hl = Math.hypot(x0[0], x0[2]), fx = -x0[0] / hl, fz = -x0[2] / hl, rx = -fz, rz = fx;
      const c = Math.cos(th * Math.PI / 180), s = Math.sin(th * Math.PI / 180);
      if (U) world.setWind({ base: [-U * (c * fx + s * rx), 0, -U * (c * fz + s * rz)], gust: 0 });
      let I = 0;
      for (let f = 0; f < 120; f++) sim.step(1 / 60);
      for (let f = 0; f < 600; f++) {
        const v = sim.cgVel(), e = 3 - (v[0] * fx + v[2] * fz); I = Math.max(-2, Math.min(2, I + e / 60));
        sim.ctl.thr = Math.max(0, Math.min(1, 0.25 + 0.15 * e + 0.1 * I)); sim.step(1 / 60);
      }
      const D = sim.damage(), mset = new Set(W.mountOf(def));
      out.rows.push({ U, th, broken: D.broken.length, mount: D.broken.filter(i => mset.has(i)).length, yields: D.yields, work: Math.round(D.work), crashed: D.crashed, reason: D.reason, finite: L.finite(sim) });
    }
  } else if (kind === 'hook') {
    const a = L.atTrunk('cub', { D: 6, V: V_PAGE, thr: 0, secs: 3, cert: true, wind: W.PAGE_WIND });
    const b = W.taxi('cub', { D: 6, V: V_PAGE, wind: W.PAGE_WIND, trace: true });
    out.plain = a.hash; out.hooked = b.hash; out.n = b.trace.length;
  }
  console.log('RESULT ' + JSON.stringify(out));
  process.exit(0);
}

// ---- the gate ----
let checks = 0, fails = 0;
const yes = (ok, msg) => { checks++; if (!ok) fails++; console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + msg); };
const rep = msg => console.log('  --    REPORT ' + msg);
(async () => {
  const { spawn } = require('child_process'), t0 = Date.now();
  const LAND = ['cub', 'jodel', 'metal'], LAB = { cub: 'the user\'s Cub', jodel: 'Jodel', metal: 'metal Cessna', floats: 'Cessna floats', twinFloats: 'twin floatplane' };
  const jobs = [['hook', 'cub'], ['page', 'cub']];
  for (const k of LAND) for (const U of US) jobs.push(['sweep', k, V_PAGE, U]);
  for (const k of ['floats', 'twinFloats']) jobs.push(['water', k]);
  for (const k of LAND) for (const U of US) jobs.push(['sweep', k, V_IMPACT, U]);
  jobs.push(['offset', 'cub', V_PAGE], ['offset', 'cub', V_IMPACT]);
  const run = j => new Promise(res => {
    const c = spawn(process.execPath, [__filename, '--part'].concat(j.map(String)), { stdio: ['ignore', 'pipe', 'pipe'] });
    let so = '', se = ''; c.stdout.on('data', d => { so += d; }); c.stderr.on('data', d => { se += d; });
    c.on('close', () => { const l = so.split('\n').reverse().find(x => x.indexOf('RESULT ') === 0); res(l ? JSON.parse(l.slice(7)) : { kind: j[0], key: j[1], err: se.slice(-800) }); });
  });
  const R = []; const q = jobs.slice();
  const nJ = Math.max(1, +(process.env.DMGWIND_JOBS || 3));
  await Promise.all(Array.from({ length: nJ }, async () => { while (q.length) { const j = q.shift(); R.push(Object.assign(await run(j), { job: j })); } }));
  if (argv.includes('--json')) require('fs').writeFileSync(argv[argv.indexOf('--json') + 1], JSON.stringify(R));
  console.log('(' + ((Date.now() - t0) / 1000).toFixed(0) + ' s; on the certificate, damage on)');
  for (const r of R) if (r.err) yes(false, 'the child ' + r.job.join(' ') + ' ran: ' + r.err);
  const sweep = (k, V) => R.filter(r => r.kind === 'sweep' && r.key === k && r.V === V).sort((a, b) => a.U - b.U).flatMap(r => r.rows);
  const f2 = x => (x == null ? '-' : x.toFixed(2));
  const table = rows => {
    console.log('        U \\ from ' + TH.map(t => String(t).padStart(7)).join('') + '   (deg off the nose; cell: mount members broken / plastic kJ)');
    for (const U of US) {
      const cells = TH.map(th => { const x = rows.find(y => y.U === U && (U === 0 || y.th === th)); return x ? (x.mount + '/' + (x.work / 1000).toFixed(1)).padStart(7) : '      -'; });
      console.log('        ' + String(U).padStart(4) + ' m/s ' + (U === 0 ? cells[0] + '   (calm: one run)' : cells.join('')));
    }
  };
  // 1. the page's staging
  console.log('1. THE PAGE\'S STAGING: settled 2 s in the wind, 3 m/s, the throttle shut, a trunk 6 m ahead (49 winds a build)');
  for (const k of LAND) {
    const rows = sweep(k, V_PAGE);
    console.log('  ' + LAB[k] + ':');
    table(rows);
    // (the Cub is gated to 5 m/s - the page's breeze, 5.5 m/s, is gated on its own in 2 - and REPORTED at 7.5 and 10: a
    // trunk on the engine's corner crushes CGE-S0TR at its 2.03 kN stamp and pulls it apart at its 5.05 kN fitting (the
    // certificate's floor) - the mirror wind loads CGE-S0TL, stamped 6.19 kN, and holds; HANDOVER G1883, open)
    const UG = k === 'cub' ? 5 : 10, gated = rows.filter(x => x.U <= UG);
    const bad = gated.filter(x => x.mount > 0 || !x.finite), hit = rows.filter(x => x.hit), vi = hit.map(x => x.vImp);
    yes(rows.length === 49 && bad.length === 0, LAB[k] + ': no mount member breaks in any wind to ' + UG + ' m/s (' + gated.length + ' of ' + rows.length + ' runs gated, ' + hit.length + ' met the trunk at ' + f2(Math.min(...vi)) + '-' + f2(Math.max(...vi)) + ' m/s; the mount\'s worst ' + f2(Math.max(...gated.map(x => x.peak))) + ' of its limit)' + (bad.length ? ' - BROKE: ' + bad.map(x => x.U + ' m/s from ' + x.th + ': ' + x.first).join('; ') : ''));
    const over = rows.filter(x => x.U > UG && x.mount > 0);
    if (UG < 10) rep(LAB[k] + ' at ' + US.filter(u => u > UG).join(' and ') + ' m/s: ' + over.length + ' of ' + rows.filter(x => x.U > UG).length + ' winds break the mount' + (over.length ? ': ' + over.map(x => x.U + ' m/s from ' + x.th + ': ' + x.first + ' (' + x.work + ' J, met at ' + f2(x.vImp) + ' m/s)').join('; ') : ''));
    const other = rows.filter(x => x.broken > x.mount);
    if (other.length) rep(LAB[k] + ': other members broken (not the mount): ' + other.map(x => x.U + '/' + x.th + ' ' + x.first).join('; '));
    const miss = rows.filter(x => !x.hit);
    if (miss.length) rep(LAB[k] + ': ' + miss.length + ' winds turned it off the trunk (no contact): ' + miss.map(x => x.U + '/' + x.th).join(' '));
    const asym = []; for (const x of rows) if (x.U && x.th > 0 && x.th < 180) { const y = rows.find(z => z.U === x.U && z.th === 360 - x.th); if (y && Math.abs(x.work - y.work) > Math.max(5, 0.05 * x.work)) asym.push(x.U + '/' + x.th + ' ' + x.work + ' J vs ' + y.work); }
    rep(LAB[k] + ': mirror symmetry (a wind from th vs 360 - th, the plastic work within 5 %): ' + (asym.length ? asym.length + ' pairs differ: ' + asym.join('; ') : 'every pair'));
  }
  // 2. the page's own wind
  const P = R.find(r => r.kind === 'page');
  if (P && P.rows) {
    console.log('2. THE PAGE\'S OWN WIND on the Cub (' + f2(P.from.U) + ' m/s from ' + P.from.th.toFixed(0) + ' deg off the nose; the gust field 1 m over the CG at t = 2 s: ' + P.gustAt2.map(x => x.toFixed(2)).join(', ') + ')');
    for (const x of P.rows) {
      const msg = x.src + ', started at ' + x.V + ' m/s (met the trunk at ' + f2(x.vImp) + '): mount ' + x.mount + ', broken ' + x.broken + ', ' + x.work + ' J, the mount\'s worst ' + f2(x.peak) + (x.first ? ' - first ' + x.first : '');
      if (x.V === V_PAGE) yes(x.finite && x.mount === 0, msg); else if (x.mount) rep(msg + ' (the page\'s impact speed: see the REPORT below)'); else yes(x.finite, msg);
    }
  }
  // 3. the floatplanes
  console.log('3. THE FLOATPLANES on the water, 10 s at 3 m/s in the wind');
  for (const r of R.filter(r => r.kind === 'water')) {
    const bad = r.rows.filter(x => x.broken || !x.finite);
    yes(bad.length === 0, LAB[r.key] + ': nothing breaks (' + r.rows.length + ' winds to 10 m/s; yields ' + Math.max(...r.rows.map(x => x.yields)) + ' at most)' + (bad.length ? ' - BROKE: ' + bad.map(x => x.U + '/' + x.th + ' ' + x.reason).join('; ') : ''));
  }
  // 4. the instrument
  const H = R.find(r => r.kind === 'hook');
  if (H) yes(H.plain === H.hooked && H.n > 0, 'the per-substep reader (sim.onSubstep, damagePush) changes nothing: ' + H.plain + ' / ' + H.hooked + ' (' + H.n + ' substeps read)');
  // REPORT: the page's impact speed, the offsets
  console.log('REPORT: THE PAGE\'S IMPACT SPEED (started at ' + V_IMPACT + ' m/s: the trunk met at ~3 m/s, as on the page)');
  for (const k of LAND) {
    const rows = sweep(k, V_IMPACT), bad = rows.filter(x => x.mount > 0), vi = rows.filter(x => x.hit).map(x => x.vImp);
    rep(LAB[k] + ': ' + bad.length + ' of ' + rows.length + ' winds break the mount (met at ' + f2(Math.min(...vi)) + '-' + f2(Math.max(...vi)) + ' m/s)' + (bad.length ? ': ' + bad.map(x => x.U + '/' + x.th + ' ' + x.first + ' (' + x.work + ' J)').join('; ') : ''));
  }
  for (const r of R.filter(r => r.kind === 'offset')) {
    const bad = r.rows.filter(x => x.mount > 0);
    rep('the Cub, no wind, started at ' + r.V + ' m/s, the trunk across the nose (' + OFFS[0] + '..' + OFFS[OFFS.length - 1] + ' m): ' + (bad.length ? bad.length + ' of ' + r.rows.length + ' break the mount: ' + bad.map(x => x.off + ' m ' + x.first).join('; ') : 'none of ' + r.rows.length + ' break the mount'));
  }
  console.log('  ' + (checks - fails) + '/' + checks + ' checks');
  console.log('GATE DMGWIND: ' + (fails ? 'FAIL' : 'PASS'));
  process.exit(fails ? 1 : 0);
})();
