#!/usr/bin/env node
// GATE DMGPOLES (G2388-G2392, DMG-POLES) - an aeroplane through two poles narrower than its span: each wing breaks
// CLEANLY at its pole (tools/_dmg_poles_lib.js: the staging, the analysis; HANDOVER G2388-G2392).
//
// The user (2026-10-07): "what happens when a plane tries to fly through 2 poles and quite does not fit? Do the wings break
// cleanly?" Before G2391 they did not: the certificate stamped a member's pull and crush from its envelope (down to its
// kappa floor, a tenth of its physics, on the wing) and left its BEND - what a trunk across it pushes against - at the
// physics' whole section, so the pole had to bend the bay it stood in harder than the root bay reacting it could pull: the
// root bay parted first on all three validated aeroplanes, at 8 m/s, and the Jodel's box shredded over three bays. Now the
// bend is stamped with the pull (30_solver.js certStamp, G2391).
//
// Node only, damage ON with the certificate stamped (as the game runs it), the validated Cub, Jodel and metal Cessna, the
// matrix's KEY ROWS (each build): the wooden pole at 85 % of the semispan taxiing at 8 m/s; the wooden pole at 65 % at
// 35 m/s 2 m up; the steel pole at 45 % at the lift-off speed; the wooden pole at 65 % at the lift-off speed with the
// aeroplane 0.5 m right of the gap's centre. Per wing, judged over the POLE PHASE (the first contact to the last new one
// + 0.25 s; what the wreck does on landing after is reported, not judged):
//   1. cut      the wing parted AT ITS POLE: spars broke, and every spar broken lies in the bay the pole stands in (the
//               lattice's resolution: the pole's station between that bay's two ribs - 0.4-1.7 m on these wings)
//   2. pieces   it came off as at most ONE piece (0.5 kg and more), no crumbs, wholly outboard of that bay's inner rib
//   3. kept     the wing is still on the airframe out to that bay's inner rib
//   4. inboard  nothing broke inboard of the cut without its load path (the lib's analyse: the strut's root group when
//               the strut stands on the severed panel - its legitimate second failure -, or ONE drag brace per bay
//               pulled by the pole's drag shear); a spar or a root fitting inboard, or a bay's second member, is red
//   5. sane     every position finite, no velocity-guard fault ('sim-diverged'), no energy from nowhere (the mechanical
//               energy never above its start's x 1.01: the throttle is shut)
//   6. asym     the off-centre row: the wing that meets its pole further in loses the larger panel
//   7. offBytes damage OFF: the three builds through the 65 % poles at 35 m/s on the base's bytes (reports/evidence/
//               DMG-POLES/off_ref.json: their state hashes on claude/dmg-t41 4b036029, the base core)
//   8. intact   an intact aircraft pays nothing: damage ON, certified, 6 s at full power from 30 m/s, 60 m up, no pole
//               (_treecrash_lib STANDARD.flight, shortened), nothing broken, on the base's bytes too (G2391 is a stamp,
//               never a step)
// Run: node tools/_dmg_poles_check.js [--jobs=N] [--out file.json]   (one final `GATE DMGPOLES: PASS|FAIL`; children)
//      node tools/_dmg_poles_check.js --selftest   (every check proven able to go red on doctored results, and the core
//                                                  with G2391 taken out - the bug as found - red on cut / kept / inboard)
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const argv = process.argv.slice(2);
const PL = require('./_dmg_poles_lib.js');
const REF = path.join(__dirname, '..', 'reports', 'evidence', 'DMG-POLES', 'off_ref.json');
const KEYS = ['cub', 'jodel', 'metal'];
const ROWS = ['wood/taxi/0.85', 'wood/air/0.65', 'steel/lof/0.45', 'wood/lof/0.65/0.5'];
const OFF = 'wood/air/0.65';
const EPS = 1e-6, KE_TOL = 1.01;
const INTACT_S = 6;   // the intact flight: 6 s of STANDARD.flight (60 m up, full power from 30 m/s, nobody flying it - in 20 s the metal
                     // Cessna flies into the ground)

// ---- a child: the intact flight's hash (damage on, certified, no pole) ----
if (argv[0] === '--intact') {
  process.env.FLYDIY_CERT = '1';
  const L = PL.L, k = argv[1], r = L.atTrunk(k, Object.assign({}, L.STANDARD.flight.o, { secs: INTACT_S }));
  process.stdout.write('RESULT ' + JSON.stringify({ key: k, hash: L.stateHash(r.sim), breaks: r.dmg.breaks, yields: r.dmg.yields, finite: r.finite }) + '\n', () => process.exit(0));
  return;
}

// ---- THE JUDGE (pure: the selftest doctors its input) ----
function judge(R, ref) {
  const out = [], yes = (id, row, ok, msg) => out.push({ id, row, ok: !!ok, msg });
  const f = (x, d = 2) => x == null ? '-' : (+x).toFixed(d);
  for (const A of R.rows) {
    const nm = PL.caseName(A.case);
    if (A.err) { yes('cut', nm, false, nm + ': the child died - ' + A.err.slice(-200)); continue; }
    for (const sd of ['R', 'L']) {
      const W = A.wings[sd], tag = nm + ' ' + sd, bay = f(W.bay[0]) + '-' + f(W.bay[1]) + ' m';
      yes('cut', tag, W.parted && W.sparsOut === 0, tag + ': the pole at ' + f(W.sC) + ' m in the bay ' + bay + '; spars broken ' +
        (W.parted ? f(W.parted.z0) + '-' + f(W.parted.z1) + ' m' : 'none') + (W.sparsOut ? ', ' + W.sparsOut + ' OUTSIDE it' : ''));
      const outIn = W.piecesOff.every(p => p.zMin >= W.bay[0] - EPS);
      yes('pieces', tag, W.pieces <= 1 && W.crumbs === 0 && outIn, tag + ': ' + W.pieces + ' piece(s) off' + (W.crumbs ? ' + ' + W.crumbs + ' crumbs' : '') +
        (W.piecesOff.length ? ' (' + W.piecesOff.map(p => f(p.mass, 1) + ' kg, ' + f(p.zMin) + '-' + f(p.zMax) + ' m').join('; ') + ')' : ''));
      yes('kept', tag, W.zKept >= W.bay[0] - EPS, tag + ': the wing kept to ' + f(W.zKept) + ' m (the bay\'s inner rib ' + f(W.bay[0]) + ' m)');
      yes('inboard', tag, W.unexplained === 0, tag + ': inboard of the cut ' + (W.inboard.length ? W.inboard.map(x => x.cls + ' ' + f(x.z0, 1) + '-' + f(x.z1, 1) + ' ' + x.how.split(':')[0] + ' [' + (x.path || 'UNEXPLAINED') + ']').join(', ') : 'nothing'));
    }
    yes('sane', nm, A.finite && !A.fault && A.keMax <= A.ke0 * KE_TOL, nm + ': finite ' + A.finite + ', fault ' + (A.fault ? A.fault.why : 'none') + ', energy x' + f(A.keMax / A.ke0, 4) + ', fastest node ' + f(A.vNodeMax, 1) + ' m/s');
    if (A.case.off) { const mR = A.wings.R.piecesOff.reduce((a, p) => a + p.mass, 0), mL = A.wings.L.piecesOff.reduce((a, p) => a + p.mass, 0);
      yes('asym', nm, mR > mL, nm + ': the right wing (its pole ' + f(A.wings.R.sC) + ' m out) lost ' + f(mR, 1) + ' kg, the left (' + f(A.wings.L.sC) + ' m) ' + f(mL, 1) + ' kg'); }
  }
  for (const k of KEYS) {
    const o = R.off[k], i = R.intact[k];
    yes('offBytes', k, ref && o && !o.err && o.hash === ref.off[k], k + ' damage OFF through the poles: ' + (o ? o.hash : '-') + ' vs the base ' + (ref ? ref.off[k] : '-'));
    yes('intact', k, ref && i && !i.err && i.hash === ref.intact[k] && i.breaks === 0, k + ' intact, damage ON, certified, no pole: ' + (i ? i.hash : '-') + ' vs the base ' + (ref ? ref.intact[k] : '-'));
  }
  return out;
}

const { spawn } = require('child_process');
const child = (args, env) => new Promise(res => {
  const ch = spawn(process.execPath, [__filename].concat(args), { stdio: ['ignore', 'pipe', 'pipe'], env: Object.assign({}, process.env, env || {}) });
  let so = '', se = ''; ch.stdout.on('data', d => { so += d; }); ch.stderr.on('data', d => { se += d; });
  ch.on('close', () => { const l = so.split('\n').reverse().find(x => x.indexOf('RESULT ') === 0); res(l ? JSON.parse(l.slice(7)) : { err: (se || so).slice(-1200) }); });
});
async function runAll(core) {
  const jobs = +((argv.find(a => a.startsWith('--jobs=')) || '').slice(7) || 3);
  const cases = [];
  for (const k of KEYS) for (const r of ROWS) cases.push(PL.caseOf(k + '/' + r));
  for (const k of KEYS) cases.push(Object.assign(PL.caseOf(k + '/' + OFF), { dmg: 'off' }));
  const res = await PL.matrix(cases, { jobs, core });
  const R = { rows: res.slice(0, KEYS.length * ROWS.length), off: {}, intact: {} };
  KEYS.forEach((k, i) => { const r = res[KEYS.length * ROWS.length + i]; R.off[k] = r.err ? r : { hash: r.hash }; });
  const env = core ? { FLYDIY_CORE: core } : {};
  const it = await Promise.all(KEYS.map(k => child(['--intact', k], env)));
  KEYS.forEach((k, i) => { R.intact[k] = it[i]; });
  return R;
}
// the generated core with G2391 taken out (a temp file: FLYDIY_CORE) - the bug as found
function bugCore(dir) {
  const src = fs.readFileSync(path.join(__dirname, 'flight_core.js'), 'utf8'), a = 'if (CERT_WING[bi] && MPP[bi] < Infinity && fuP < Infinity) b.mp =';
  if (src.split(a).length !== 2) throw new Error('the G2391 line not found once in the core');
  const f = path.join(dir, 'flight_core_g2391off.js');
  fs.writeFileSync(f, src.replace(a, 'if (false && CERT_WING[bi] && MPP[bi] < Infinity && fuP < Infinity) b.mp ='));
  return f;
}

(async () => {
  const t0 = Date.now(), ref = fs.existsSync(REF) ? JSON.parse(fs.readFileSync(REF, 'utf8')) : null;
  if (argv.includes('--selftest')) {
    const R = await runAll();
    const base = judge(R, ref), clean = base.every(x => x.ok);
    const J = () => JSON.parse(JSON.stringify(R)), row0 = r => r.rows[0];
    const DOC = {
      cut: r => { row0(r).wings.R.sparsOut = 2; },
      pieces: r => { row0(r).wings.L.pieces = 4; },
      kept: r => { row0(r).wings.R.zKept = 0; },
      inboard: r => { row0(r).wings.L.unexplained = 1; },
      sane: r => { row0(r).finite = false; },
      asym: r => { const A = r.rows.find(x => x.case.off); A.wings.L.piecesOff = [{ mass: 999, zMin: 9, zMax: 9 }]; A.wings.L.pieces = 1; },
      offBytes: r => { r.off.jodel.hash = '0000000000000000'; },
      intact: r => { r.intact.metal.hash = '0000000000000000'; },
    };
    const caught = [], missed = [];
    for (const id of Object.keys(DOC)) { const r = J(); DOC[id](r); const res = judge(r, ref); const bad = res.filter(q => !q.ok);
      (bad.length && bad.every(q => q.id === id) ? caught : missed).push(id); }
    // the bug as found: the same rows on the core without G2391
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'poles-bug-'));
    let bugRed = [], bugRows = 0;
    try {
      const cases = []; for (const k of KEYS) for (const r of ROWS) cases.push(PL.caseOf(k + '/' + r));
      const B = await PL.matrix(cases, { jobs: +((argv.find(a => a.startsWith('--jobs=')) || '').slice(7) || 3), core: bugCore(dir) });
      const res = judge({ rows: B, off: R.off, intact: R.intact }, ref).filter(q => !q.ok);
      bugRed = Array.from(new Set(res.map(q => q.id))); bugRows = new Set(res.map(q => q.row.split(' ')[0])).size;
    } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* stays */ } }
    const bugCaught = bugRed.indexOf('cut') >= 0 || bugRed.indexOf('inboard') >= 0;
    console.log('selftest: the real run ' + (clean ? 'clean' : 'NOT clean: ' + base.filter(x => !x.ok).map(x => x.row + ' ' + x.id).join(', ')) +
      '; doctored red: ' + caught.length + ' / ' + Object.keys(DOC).length + (missed.length ? ' (missed ' + missed.join(', ') + ')' : '') +
      '; the core without G2391 (the bug as found): red on ' + (bugRed.join(', ') || 'NOTHING') + ' in ' + bugRows + ' / ' + KEYS.length * ROWS.length + ' rows - ' + (bugCaught ? 'caught' : 'MISSED'));
    const ok = clean && !missed.length && bugCaught;
    console.log('(selftest, ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
    console.log('GATE DMGPOLES: ' + (ok ? 'PASS' : 'FAIL'));
    process.exit(ok ? 0 : 1);
  }
  // --write-ref <core>: the base's bytes (damage off through the poles; intact, certified) from a base core
  if (argv.includes('--write-ref')) {
    const core = path.resolve(argv[argv.indexOf('--write-ref') + 1]), R = { off: {}, intact: {} };
    const res = await PL.matrix(KEYS.map(k => Object.assign(PL.caseOf(k + '/' + OFF), { dmg: 'off' })), { core });
    KEYS.forEach((k, i) => { R.off[k] = res[i].hash; });
    const it = await Promise.all(KEYS.map(k => child(['--intact', k], { FLYDIY_CORE: core })));
    KEYS.forEach((k, i) => { R.intact[k] = it[i].hash; });
    R.base = argv[argv.indexOf('--write-ref') + 2] || core;
    fs.mkdirSync(path.dirname(REF), { recursive: true });
    fs.writeFileSync(REF, JSON.stringify(R, null, 1) + '\n');
    console.log('wrote ' + REF + ': ' + JSON.stringify(R));
    return;
  }
  const R = await runAll();
  console.log('DMGPOLES - two poles narrower than the span (wood r ' + PL.POLES.wood.r + ' m, steel r ' + PL.POLES.steel.r + ' m, ' + PL.POLES.wood.h + ' m tall), ' + PL.D_AHEAD + ' m ahead, the throttle shut, damage on, the certificate stamped');
  const res = judge(R, ref);
  for (const x of res) console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + '  [' + x.id + '] ' + x.msg);
  for (const A of R.rows) if (!A.err) console.log('  REPORT  ' + PL.caseName(A.case) + ' (' + A.V.toFixed(1) + ' m/s): contact ' + (A.tFirst || 0).toFixed(2) + '-' + (A.tLast || 0).toFixed(2) +
    ' s; after: yaw ' + A.after.yawMax.toFixed(0) + ' deg, roll ' + A.after.rollMax.toFixed(0) + ' deg, ran on to ' + A.after.end.toFixed(0) + ' m at ' + A.after.Vend.toFixed(1) + ' m/s, ' +
    A.after.broken + ' broken in all (' + A.after.gear + ' gear)' + (A.after.flipped ? ', OVER' : '') + '; root load peak R ' + (A.wings.R.rootPk / 1000).toFixed(1) + ' / L ' + (A.wings.L.rootPk / 1000).toFixed(1) + ' kN');
  if (argv.includes('--out')) fs.writeFileSync(argv[argv.indexOf('--out') + 1], JSON.stringify(R));
  const ok = res.every(x => x.ok);
  console.log(res.filter(x => x.ok).length + '/' + res.length + ' checks, ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
  console.log('GATE DMGPOLES: ' + (ok ? 'PASS' : 'FAIL'));   // (run_gates reads the bare line)
  process.exit(ok ? 0 : 1);
})();
