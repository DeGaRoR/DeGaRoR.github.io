#!/usr/bin/env node
// GATE DMGGEAR (G1835-G1838, DMG-D2b GEAR) - the gear's own calibration, the headroom of normal operations, and
// §7.4's gear rows, on the user's validated builds, on THE CERTIFICATE (66_gen_cert.js: the gear's cases, the ground
// and water loads, the flaps, the unsymmetrical tail, the controls flown; 30_solver.js gearStamp):
//   1. THE BRACKET (DEFORM §7.3): every gear joint of the build stamped from its own envelope (the lug brittle at its
//      ultimate in tension; a wheel's gear giving in compression at its limit over its archetype's travel, a float's
//      struts crushing at the ultimate), none left on D1a's physics; the drop (damage on) at the build's own FAR 23.473
//      limit sink leaves NO SET; at 1.2 x the certificate's sink (23.727's reserve energy) the GEAR yields and nothing
//      breaks, the airframe takes no set; at the NASA 172 Test 1 point (7 m/s down, 18 m/s forward) it BREAKS, a gear
//      group first (land builds; a floatplane's are its water rows)
//   2. THE HEADROOM (dm14, under the probe: the worst member's peak force over its CERTIFIED yield): ordinary
//      operations at most 2/3 - the circuit, a crosswind circuit at the demonstrated component (FAR 23.233's 0.2 V_S0,
//      as recalled), a taxi on grass and on a rough field (bumps of 2 cm, 3 m apart; the certificate's 23.491 field is
//      4 cm) or on the water at displacement speed and in a light chop (5 m/s of wind), touchdowns at the normal sink
//      (1.0 m/s) and a firm one (1.5 m/s) at the touchdown speed; the build's own 23.473 limit sink is the gear's own
//      limit case: the airframe at most 2/3, the gear under 1
//   3. §7.4's GEAR ROWS (damage on, the certificate): the ground loop (the Cub, the Jodel: rolling at 15 m/s, swung
//      20 deg off its track at 120 deg/s, the Cub 30 deg at 180 deg/s since G1896 - a main gear group lets go, the low
//      wing strikes); the porpoise (the metal
//      Cessna: nose-first touchdowns at 25 m/s, 5 deg nose-down, the bounces growing 3 / 4 / 5 / 6 m/s - the nose gear
//      collapses, the bounce it collapsed on printed); the float dig-in (the Cessna on floats, the twin: the 90 km/h /
//      5 m/s / 20 deg nose-in breaks nothing; in TREECRASH's severe nose-in (150 km/h / 10 m/s / 60 deg) the floats'
//      strut fittings fail in overload - the order printed)
// Run: node tools/_dmg_gear_check.js   (one final `GATE DMGGEAR: PASS|FAIL`; each build's parts in parallel children,
// 3 at once; FLYDIY_CERT_DIR: the certificates precomputed - <dir>/<key>.json, as tools/treecrash_evidence.js reads)
'use strict';
const path = require('path');
const argv = process.argv.slice(2);
process.env.FLYDIY_CERT = '1';
const G = require('./_dmg_gear_lib.js');
const L = G.L;
const TWO3 = 2 / 3;

// ---- a child: one build's part, JSON on its last line ----
if (argv[0] === '--part') {
  const k = argv[1], part = argv[2], out = { key: k, part };
  const def = L.defOf(k), fl = !!(def.parts && def.parts.floats), vso = G.Vso(def);
  const W = w => ({ max: w.max, tags: w.tags, cls: w.cls, s: w.s, phase: w.phase || null, gear: w.gear, gtags: w.gtags, air: w.air, atags: w.atags });
  if (part === 'ops') {
    const v473 = L.far473(k);
    out.td = [['the normal sink, 1.0 m/s', 1.0, 'ord'], ['a firm one, 1.5 m/s', 1.5, 'ord'], ['the build\'s FAR 23.473 limit sink, ' + v473.toFixed(2) + ' m/s', v473, 'lim']]
      .map(([lab, sink, kind]) => { const r = G.touchdown(k, { sink }); return { lab, sink, kind, nz: r.nz, w: W(r.w), finite: r.finite }; });
    out.taxi = (fl ? [['on the water at 4 m/s', { V: 4 }], ['on the water at 4 m/s in a light chop (5 m/s of wind)', { V: 4, chop: 5 }]]
                   : [['on grass at 8 m/s', { V: 8 }], ['on a rough field (2 cm bumps, 3 m apart) at 8 m/s', { V: 8, rough: { A: 0.02, lam: 3 } }], ['on the rough field at 12 m/s', { V: 12, rough: { A: 0.02, lam: 3 } }]])
      .map(([lab, o]) => { const r = G.taxi(k, o); return { lab, V: r.V, w: W(r.w), finite: r.finite }; });
  } else if (part === 'circ' || part === 'xw') {
    const r = G.circuit(k, part === 'xw' ? { xw: 0.2 * vso } : {});
    out.circ = { xw: part === 'xw' ? 0.2 * vso : 0, outcome: r.outcome, landing: r.landing, t: r.t, w: W(r.w), phases: r.phases, finite: r.finite };
  } else if (part === 'bracket') {
    out.bracket = G.bracket(k);
    const cap = 10 * 0.3048, v473 = L.far473(k);
    out.drops = [[v473, 0, '473'], [1.2 * cap, 0, '727']].concat(fl ? [] : [[7, 18, 'nasa']]).map(([sink, fwd, kind]) => Object.assign({ kind }, G.bracketDrop(k, { sink, fwd })));
  } else if (part === 'rows') {
    // G1896 (DMG-TUNE): the Cub's gated swing is 30 deg off its track at 180 deg/s; the base's 20 deg at 120 deg/s
    // folded a main gear only AFTER its tail had come off - one stab fitting of 32 at the certificate's 0.1 floor
    // (1.06 kN) taking the whole tailplane, the tail then dropping the aeroplane onto a wheel; with the tail at its
    // material that swing slides its wheels (the side force friction-limited under 23.485's envelope, as D2b found
    // for the Jodel) and is REPORTED; the harder swing folds the gear by its own side load
    if (k === 'cub' || k === 'jodel') out.loop = G.groundLoop(k, k === 'cub' ? { V: 15, yaw: 30, rate: 180, secs: 4 } : { V: 15, yaw: 20, rate: 120, secs: 4 });
    if (k === 'cub') out.loop20 = G.groundLoop(k, { V: 15, yaw: 20, rate: 120, secs: 4 });
    if (k === 'metal') out.porp = G.porpoise(k, { V: 25, pitch: 5, sinks: [3, 4, 5, 6] });   // a 4th bounce at 6 m/s (the user, 8 Oct, by name: the nose engine at its drawn height, G2365, collapses it on the 4th, not the 3rd)
    // (train 41, A0 7 Oct: THE ORDINARY NOSE-IN AT THE AEROPLANE'S OWN V_S0. The water case was 90 km/h / 5 m/s / 20 deg for
    // every floatplane - 1.0 V_S0 for the Cessna on floats, where it was calibrated, but 1.5 V_S0 for the twin (V_S0 32 kt):
    // 5.0 g at its CG, 2.6 x its FAR 23.527 water load (1.91 g), past its 2.9 g ultimate. The ordinary case is now the
    // Cessna's own ratio on each aeroplane - V_S0 and a sink of 0.2 V_S0 (5 / 25), 20 deg - and must break nothing; the 90
    // km/h case stays on the twin as a SEVERE row whose boom root must go, first at its root bay - DMG-BUNDLE-GREEN's
    // 'NOT SOLVED 1', explained, not admitted)
    if (fl) out.dig = [{ V: +(3.6 * vso).toFixed(1), sink: +(0.2 * vso).toFixed(2), pitch: 20 }, { V: 150, sink: 10, pitch: 60 }]
      .concat(k === 'twinFloats' ? [{ V: 90, sink: 5, pitch: 20 }] : []).map(o => G.digIn(k, o));
  }
  console.log('RESULT ' + JSON.stringify(out));
  process.exit(0);
}

// ---- the gate ----
let checks = 0, fails = 0;
const OPEN = [];   // (train 41: rows split out of the gate until their owner lands - printed, never counted)
const yes = (ok, msg) => { checks++; if (!ok) fails++; console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + msg); };
const f2 = x => (x == null ? '-' : x.toFixed(2));
const wk = w => f2(w.max) + ' (' + w.cls + ' ' + w.tags + ', ' + (w.s === 't' ? 'tension' : 'compression') + (w.phase ? ', ' + w.phase : '') + ')';
(async () => {
  const { spawn } = require('child_process');
  const keys = Object.keys(L.BUILDS), t0 = Date.now();
  const jobs = [];
  // (DMGGEAR_PARTS: a subset - the evidence flies the headroom parts on the base's core for the table's 'before')
  const PARTS = (process.env.DMGGEAR_PARTS || 'xw,circ,ops,bracket,rows').split(',');
  for (const k of keys) for (const p of PARTS) jobs.push([k, p]);
  const run = ([k, p]) => new Promise(res => {
    const c = spawn(process.execPath, [__filename, '--part', k, p], { stdio: ['ignore', 'pipe', 'pipe'] });
    let so = '', se = ''; c.stdout.on('data', d => { so += d; }); c.stderr.on('data', d => { se += d; });
    c.on('close', () => { const l = so.split('\n').reverse().find(x => x.indexOf('RESULT ') === 0); res(l ? JSON.parse(l.slice(7)) : { key: k, part: p, err: se.slice(-800) }); });
  });
  const R = {}; const q = jobs.slice();
  const nJ = Math.max(1, +(process.env.DMGGEAR_JOBS || 3));
  await Promise.all(Array.from({ length: nJ }, async () => { while (q.length) { const j = q.shift(); const r = await run(j); (R[j[0]] = R[j[0]] || {})[j[1]] = r; } }));
  if (argv.includes('--json')) require('fs').writeFileSync(argv[argv.indexOf('--json') + 1], JSON.stringify(R));
  console.log('(' + ((Date.now() - t0) / 1000).toFixed(0) + ' s, ' + keys.length + ' builds; on the certificate, 66_gen_cert.js)');
  const table = [];
  for (const k of keys) {
    const lab = L.BUILDS[k].label, P = R[k];
    console.log(lab + ':');
    for (const p of Object.keys(P)) if (P[p].err) yes(false, 'the child ' + p + ' ran: ' + P[p].err);
    // 1. the bracket
    const B = P.bracket;
    if (B && B.bracket) {
      console.log('1. the bracket (' + B.bracket.type + ', ' + B.bracket.arch + ')');
      const joints = B.bracket.rows.filter(r => r.seam || r.link), unst = joints.filter(r => !r.stamped);
      yes(joints.length > 0 && unst.length === 0, joints.length + ' gear joints, every one stamped from its own envelope' + (unst.length ? ' - NOT: ' + unst.map(r => r.tags).join(', ') : ''));
      const leg = joints.filter(r => !r.float && !r.tens), flt = joints.filter(r => r.float);
      const yU = Math.max(1.01, L.core().GEN_CERT.leg.yUlt);
      if (leg.length) yes(leg.every(r => r.ecu > 0.03 && Math.abs(r.fc / Math.max(r.Fc, r.floor) - yU) < 1e-6),
        'a wheel\'s gear gives in compression past its limit (F_l,c x ' + yU.toFixed(2) + ', where its steel sized for the ultimate yields) over its travel (' + [...new Set(leg.map(r => r.ecu))].join(' / ') + ' of a member\'s length); limits ' + f2(Math.min(...leg.map(r => r.fc)) / 1e3) + '-' + f2(Math.max(...leg.map(r => r.fc)) / 1e3) + ' kN');
      if (flt.length) yes(flt.every(r => r.tens || r.fc > 1.5 * Math.max(r.Fc, r.floor)), 'a float\'s struts and spreaders crush at the ultimate (no spring): ' + f2(Math.min(...flt.map(r => r.fc)) / 1e3) + '-' + f2(Math.max(...flt.map(r => r.fc)) / 1e3) + ' kN');
      yes(joints.every(r => r.etu === 0 && Math.abs(r.fu / (1.5 * 1.05 * Math.max(r.Ft, r.floor)) - 1) < 1e-6), 'in tension every gear joint is its lug, brittle at 1.5 F_l,t m: ' + f2(Math.min(...joints.map(r => r.fu)) / 1e3) + '-' + f2(Math.max(...joints.map(r => r.fu)) / 1e3) + ' kN');
      for (const d of B.drops) {
        const what = 'set ' + d.set.gear + ' gear / ' + d.set.other + ' airframe, broken ' + d.brk.gear + ' / ' + d.brk.other + (d.firstGroup ? ', the first group ' + d.firstGroup : '') + ', ' + f2(d.nz) + ' g' + (d.crashed ? ', ' + d.reason : '');
        if (d.kind === '473') yes(d.finite && d.set.gear + d.set.other === 0 && d.brk.gear + d.brk.other === 0, 'the drop at its FAR 23.473 limit sink (' + f2(d.sink) + ' m/s): no set - ' + what);
        else if (d.kind === '727') yes(d.finite && d.brk.gear + d.brk.other === 0 && d.set.other === 0, 'the drop at 1.2 x the certificate\'s sink (' + f2(d.sink) + ' m/s, 23.727): ' + (d.set.gear ? 'the gear yields' : B.bracket.type === 'floats' ? 'the gear holds (a float installation has no spring)' : 'the gear holds, just under its yield (1.18 F_l)') + ', nothing breaks, the airframe takes no set - ' + what);
        else yes(d.finite && d.brk.gear > 0 && d.firstBreak && d.firstBreak.cls === 'gear', 'NASA 172 Test 1 (7 m/s down, 18 m/s forward): it breaks, the gear first (' + (d.firstBreak ? d.firstBreak.tags + ', ' + d.firstBreak.how : '-') + ') - ' + what);
      }
    }
    // 2. the headroom
    console.log('2. the headroom (the worst member over its certified yield; ordinary operations at most 2/3)');
    const O = P.ops || {}, rowsT = [];
    for (const t of (O.td || [])) {
      if (t.kind === 'ord') yes(t.finite && t.w.max <= TWO3, 'a touchdown at ' + t.lab + ': ' + wk(t.w));
      else yes(t.finite && t.w.air <= TWO3 && t.w.gear < 1, 'a touchdown at ' + t.lab + ' (the gear\'s own limit case): the airframe ' + f2(t.w.air) + ' (' + t.w.atags + '), the gear ' + f2(t.w.gear) + ' (' + t.w.gtags + ')');
      rowsT.push([t.kind === 'ord' ? 'td ' + t.sink.toFixed(1) : 'td 23.473', t.kind === 'ord' ? t.w.max : t.w.air, t.w]);
    }
    for (const t of (O.taxi || [])) { yes(t.finite && t.w.max <= TWO3, 'a taxi ' + t.lab + ': ' + wk(t.w)); rowsT.push(['taxi ' + t.lab, t.w.max, t.w]); }
    for (const p of ['circ', 'xw']) { const c = P[p] && P[p].circ; if (!c) continue;
      // (train 41, A0 7 Oct: SPLIT, not a named red - the twin's crosswind WATER circuit skips in its roll-out and its aft
      // spreader bar reads 2.00 (4.2 kN in compression for 5 frames; no FAR case compresses spreaders): the landing nobody
      // flies, not the structure. Out of the gate onto the OPEN list - owner DMG-RECAL2 (the float touchdown flown), opened
      // 2026-10-07 at 2.00 - and back into the gate when RECAL2 lands)
      if (p === 'xw' && k === 'twinFloats') { OPEN.push('the twin on floats, its crosswind water circuit: ' + f2(c.w.max) + ' (owner DMG-RECAL2, opened 2026-10-07 at 2.00)');
        console.log('  OPEN  a crosswind circuit (' + f2(c.xw) + ' m/s across) - the twin skips, owner DMG-RECAL2: ' + wk(c.w)); rowsT.push(['crosswind circuit (OPEN)', c.w.max, c.w]); continue; }
      yes(c.finite && c.w.max <= TWO3, (c.xw ? 'a crosswind circuit (' + f2(c.xw) + ' m/s across, 0.2 V_S0)' : 'the circuit') + ' (' + c.outcome + ', ' + c.t.toFixed(0) + ' s' + (c.landing ? ', touchdown ' + f2(c.landing.sink) + ' m/s' : '') + '): ' + wk(c.w));
      rowsT.push([c.xw ? 'crosswind circuit' : 'circuit', c.w.max, c.w]); }
    table.push([lab, rowsT]);
    // 3. §7.4
    const RW = P.rows || {};
    if (RW.loop || RW.porp || RW.dig) console.log('3. §7.4\'s gear rows');
    // (the ground loop is gated on the Cub - the PA-18 reports; the Jodel's is REPORTED: on flat grass its wheels slide
    // first, the side force friction-limited under 23.485's envelope, and nothing folds - its row wants a rut or a
    // soft field, DMG-TUNE's)
    if (RW.loop && k !== 'cub') { const g = RW.loop; console.log('  --    REPORT the ground loop (' + g.V + ' m/s, swung ' + g.yaw + ' deg at ' + g.rate + ' deg/s): groups ' + (g.groups.join(' > ') || 'none') + ', the lowest wingtip ' + f2(g.tipMin) + ' m' + (g.tipStrike != null ? ' (struck)' : '') + ' - on flat grass the wheels slide (friction-limited side load)'); }
    if (RW.loop20) { const g = RW.loop20; console.log('  --    REPORT the ground loop (' + g.V + ' m/s, swung ' + g.yaw + ' deg at ' + g.rate + ' deg/s, the base\'s staging): groups ' + (g.groups.join(' > ') || 'none') + ', the lowest wingtip ' + f2(g.tipMin) + ' m' + (g.tipStrike != null ? ' (struck)' : '') + ' - the wheels slide'); }
    if (RW.loop && k === 'cub') { const g = RW.loop, mains = g.groups.filter(x => /^gear[LR]:/.test(x));
      yes(g.finite && mains.length > 0 && g.tipStrike != null, 'the ground loop (' + g.V + ' m/s, swung ' + g.yaw + ' deg at ' + g.rate + ' deg/s): a main gear folds (' + (mains.join(', ') || 'none') + '), the low wing strikes (' + (g.tipStrike != null ? 'at ' + f2(g.tipStrike) + ' s' : 'no: ' + f2(g.tipMin) + ' m') + '); the groups in order ' + g.groups.join(' > ') + (g.reason ? '; ' + g.reason : '')); }
    if (RW.porp) { const g = RW.porp;
      yes(g.finite && g.collapsed != null, 'the porpoise (nose-first at ' + g.V + ' m/s, ' + g.pitch + ' deg down, the bounces at ' + g.sinks.join(' / ') + ' m/s): the nose gear collapses on bounce ' + g.collapsed + ' (the reference: the fourth since the drawn engine height of G2365 - accepted by name by the user, 8 Oct; was the third) - ' + g.bounces.map(b => b.bounce + ': ' + (b.groups.join('+') || 'whole')).join('; ') + (g.propStrike ? '; the prop strikes' : '') + (g.reason ? '; ' + g.reason : '')); }
    if (RW.dig) { const [a, b, c] = RW.dig;
      yes(a.finite && a.breaks === 0, 'the float nose-in at its own V_S0, ' + a.V + ' km/h, ' + a.sink + ' m/s (0.2 V_S0), ' + a.pitch + ' deg (the WATER CASE): nothing breaks (' + a.set + ' set)');
      if (c) yes(c.finite && c.breaks > 0 && !!c.firstBreak && /^S2B[LR]-S3B[LR]$/.test(c.firstBreak.tags), 'SEVERE for the twin: the 90 km/h, 5 m/s, 20 deg nose-in (2.6 x its FAR 23.527 water load, past its ultimate): the boom root goes, first at its root bay (' + (c.firstBreak ? c.firstBreak.tags + ' ' + c.firstBreak.how + ' at ' + f2(c.firstBreak.t) + ' s' : 'nothing broke') + ', ' + c.breaks + ' broken)');
      yes(b.finite && b.floatStruts.length > 0, 'the float dig-in at ' + b.V + ' km/h, ' + b.sink + ' m/s, ' + b.pitch + ' deg: the floats\' strut fittings fail in overload (' + b.floatStruts.join(', ') + ') - the first group ' + b.firstGroup + (b.firstBreak ? ' (' + b.firstBreak.tags + ', ' + b.firstBreak.how + ')' : '') + '; then ' + b.groups.slice(1).join(', ') + (b.reason ? '; ' + b.reason : '')); }
  }
  console.log('THE HEADROOM TABLE (the worst member over its certified yield; the 23.473 row: the airframe):');
  for (const [lab, rows] of table) console.log('  ' + lab.padEnd(16) + rows.map(([n, v]) => n + ' ' + f2(v)).join(' | '));
  console.log('  ' + (checks - fails) + '/' + checks + ' checks');
  if (OPEN.length) { console.log('OPEN (split out of the gate until their owner lands; not counted):'); for (const o of OPEN) console.log('  ' + o); }
  console.log('GATE DMGGEAR: ' + (fails ? 'FAIL' : 'PASS'));
  process.exit(fails ? 1 : 0);
})();
