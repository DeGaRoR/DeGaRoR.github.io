#!/usr/bin/env node
// _designcheck_check.js — GATE DESIGNCHECK (G2640 DESIGN-TRUST): the bench's
// design check says what the numbers say, with pointers, and is right.
//
// The user, 10 Oct: "the first bench check should be able to detect something
// bad from the numbers alone ... deterministic check with real pointers on
// problems." 64b_gen_design.js measures the built aeroplane's derivatives in
// the solver's own tunnel and solves its modes; this proves the rows:
//
//   VALIDATED   the Cub, the Jodel, the Cessna, the Cessna on floats, the twin
//               on floats: no FAIL row (a WARN is a pointer, printed)
//   DOCTORED    a design broken one way at a time must FAIL on the row that
//               names that defect, and carry a fix: the fin shrunk, a sliver,
//               dragged forward; the stab shrunk; the tail pulled forward
//               (judged at the worst loading corner); no aileron
//   SWEEPS      the physics must point the right way on ANY build: more fin ->
//               more yaw stiffness, more dutch-roll damping and a less stable
//               spiral; more dihedral -> more dihedral effect and a more
//               stable spiral; the tail further aft -> more static margin
//   DATA        every row carries id / group / level / value / limit / why
//               (and a fix when it is not a pass) - CERT-SLIM reads them
//   DETERMINISM the same build twice, the same rows to the bit
//   --sim       (full tier) THE MODEL AGAINST THE SIM: the Cub trimmed hands
//               off, banked 2 deg either way - the antisymmetric bank's growth
//               against the predicted spiral root (same sign, within 2x), and
//               the mosquito (3) stable in both
//
//   node tools/_designcheck_check.js [--sim] [--only=sim]
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const C = require('./flight_core.js');
const BJ = require('./_bake_joined.js');
BJ.loadPanel();
const argv = process.argv.slice(2);
const SIM = argv.includes('--sim') || argv.includes('--only=sim');
const ONLY_SIM = argv.includes('--only=sim');

let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) fails++; console.log((c ? '  ok     ' : '  FAIL   ') + m); };
const rd = f => { const j = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); return j.spec || j; };
const floats = s => { s.gear.type = 'floats'; s.cage = Object.assign({}, s.cage, { gearFloats: 1 }); };
const joined = (f, patch) => { const s = rd(f); if (patch) patch(s); return BJ.bakeJoined(s).spec; };
// corners: the static margin is judged at the WORST loading corner (the
// shakedown's envelope), as a weight-and-balance sheet is; the sweeps run
// without them (the as-drawn margin moves the same way, at a fifth the cost)
const check = (J, mut, corners) => {
  const S = JSON.parse(JSON.stringify(J));
  if (mut) mut(S);
  const def = C.buildGen(S);
  const sh = C.genShakedown(def, { corners: !!corners });
  return { def, sh, dc: sh.design };
};
const line = dc => dc.rows.map(r => r.id + '=' + (r.value == null ? '-' : r.value) + (r.level === 'pass' ? '' : '(' + r.level + ')')).join(' ');
const row = (dc, id) => dc.rows.find(r => r.id === id) || {};

const CUB = 'builds/cub_2026-09-20_corrected.json';
const VALID = [
  ['cub', CUB], ['jodel', 'builds/jodel_2026-09-20_corrected.json'],
  ['cessna', 'bugReports/cessnaMetal (1).json'], ['floats', 'bugReports/cessnaFloatsWOrks.json'],
  ['twinFloats', 'tools/fixtures/build_v7_ultralight_2026-09-05.json', floats],
];

if (!ONLY_SIM) {
  console.log('VALIDATED - no FAIL row');
  const J = {};
  for (const [k, f, p] of VALID) {
    J[k] = joined(f, p);
    const { dc } = check(J[k], null, true);
    const bad = dc.rows.filter(r => r.level === 'fail');
    ok(!bad.length, `${k}: ${dc.verdict.toUpperCase()} ${line(dc)}`);
    for (const r of dc.rows.filter(r => r.level !== 'pass')) console.log('           ' + r.level + ' ' + r.id + ': ' + r.why + (r.fix ? ' -> ' + r.fix : ''));
  }
  console.log('THE USER\'S MOSQUITO (the repro builds, joined) - printed');
  for (const k of ['mosquito_2', 'mosquito_3']) {
    const { dc } = check(joined('tools/fixtures/repro/' + k + '.json'), null, true);
    console.log('           ' + k + ': ' + dc.verdict.toUpperCase() + ' ' + line(dc));
  }

  console.log('DOCTORED - each defect fails on its own row, with a fix');
  const cub = J.cub;
  const DOC = [
    ['the fin shrunk to 30 %', S => { S.tail.Sv *= 0.3; }, 'yaw.Vv'],
    ['the fin a sliver (12 %)', S => { S.tail.Sv *= 0.12; }, 'yaw.Vv'],
    ['the fin dragged forward to 1.2 m behind the wing', S => { S.tail.vX = S.geom ? S.geom.xAC + 1.2 : 1.9; }, 'yaw.Vv'],
    ['the stab shrunk to 40 %', S => { S.tail.Sh *= 0.4; }, 'pitch.Vh'],
    ['the tail pulled 1.2 m forward', S => { S.tail.place = { dx: -1.2 }; }, 'pitch.sm'],
    ['no aileron', S => { S.controls = Object.assign({}, S.controls, { aileron: { span: 0, chord: 0.22 } }); S.wings[0].ailSpan = 0; }, 'ctl.aileron'],
  ];
  // (the dihedral effect has no doctored row: the wing's dihedral is clamped
  // to 0-6 deg, and the flattest low wing that clamp allows - the Jodel at 0
  // in and out - still reads -0.029; the dihedral sweep below carries it)
  for (const [name, mut, id] of DOC) {
    const { dc } = check(cub, mut, true);
    const r = row(dc, id);
    ok(r.level === 'fail' && !!r.fix, `${name}: ${id} ${r.level} (${r.value}) -> ${r.fix || 'no fix'}`);
  }

  console.log('SWEEPS - the physics points the right way');
  const sweep = (label, vals, mut) => vals.map(v => ({ v, d: check(cub, S => mut(S, v)).dc }));
  const mono = (arr, f, sign) => arr.every((x, i) => i === 0 || sign * (f(x.d) - f(arr[i - 1].d)) > 0);
  const spiralL = d => d.modes.spiral.lambda, cnb = d => d.deriv.Cnb, zDR = d => d.modes.dutch.zeta * d.modes.dutch.wn;
  {
    const A = sweep('fin', [0.6, 0.8, 1.0, 1.25, 1.5], (S, k) => { S.tail.Sv *= k; });
    const pr = f => A.map(x => f(x.d).toFixed(4)).join(' ');
    ok(mono(A, cnb, +1), 'fin area x0.6..1.5 -> yaw stiffness rises: ' + pr(cnb));
    ok(mono(A, zDR, +1), 'fin area x0.6..1.5 -> dutch-roll damping (zeta x wn) rises: ' + pr(zDR));
    ok(mono(A, spiralL, +1), 'fin area x0.6..1.5 -> the spiral root rises (less stable): ' + pr(spiralL));
  }
  {
    const A = sweep('dihedral', [0, 1.5, 3, 4.5, 6], (S, d) => { S.wings[0].dihedral = d; });
    const pr = f => A.map(x => f(x.d).toFixed(4)).join(' ');
    ok(mono(A, d => d.deriv.Clb, -1), 'dihedral 0..6 deg -> dihedral effect grows (Clb falls): ' + pr(d => d.deriv.Clb));
    ok(mono(A, spiralL, -1), 'dihedral 0..6 deg -> the spiral root falls (more stable): ' + pr(spiralL));
  }
  {
    const A = sweep('tail arm', [-0.6, -0.3, 0, 0.3, 0.6], (S, d) => { S.tail.place = { dx: d }; });
    ok(mono(A, d => row(d, 'pitch.sm').value, +1), 'tail moved -0.6..+0.6 m -> static margin rises: ' + A.map(x => row(x.d, 'pitch.sm').value).join(' '));
  }

  console.log('DATA AND DETERMINISM');
  {
    const a = check(cub).dc, b = check(cub).dc;
    const keys = ['id', 'group', 'label', 'level', 'limit', 'why'];
    ok(a.rows.length >= 12 && a.rows.every(r => keys.every(k => r[k] != null && r[k] !== '') && (r.level === 'pass' || r.fix)),
       a.rows.length + ' rows, every one with ' + keys.join('/') + ' and a fix when not a pass');
    ok(JSON.stringify(a) === JSON.stringify(b), 'the same build twice: the same check to the bit');
    const BE = (() => { const m = { exports: {} }; require('vm').runInNewContext(fs.readFileSync(path.join(ROOT, 'src/viewer/bench.js'), 'utf8'),
      { module: m, exports: m.exports, console, Math, JSON, parseFloat, isFinite, Number, String, Array, Object, Date, Symbol }); return m.exports; })();
    const html = BE.benchDesignHtml({ verdict: a.verdict, rows: a.rows });
    ok(html.indexOf('design check') >= 0 && a.rows.every(r => html.indexOf(r.label.replace(/&/g, '&amp;')) >= 0),
       'the bench renders every row (benchDesignHtml)');
  }
}

if (SIM) {
  console.log('THE MODEL AGAINST THE SIM (the spiral, hands off, banked 2 deg each way)');
  const world = C.makeWorld();
  const D2 = 180 / Math.PI;
  const bank = sim => { const [, y, z] = sim.axes(); return Math.atan2(z[1], y[1]) * D2; };
  const fly = (def) => {
    const runs = [];
    for (const sgn of [1, -1]) {
      const sim = C.makeSim(def, world); sim.reset(0);
      const ap = C.makePilot(sim, def); let t = 0; const dt = 1 / 60;
      while (ap.phase !== 'DOWNWIND' && t < 240) { ap.update(dt); sim.step(dt); t += dt; }
      const hist = [];
      for (let i = 0; i < 60 * 25; i++) { ap.update(dt); sim.step(dt); hist.push(Object.assign({}, sim.ctl)); if (hist.length > 240) hist.shift(); }
      const m = {}; for (const q of ['de', 'da', 'dr', 'thr']) m[q] = hist.reduce((a, h) => a + h[q], 0) / hist.length;
      Object.assign(sim.ctl, m);
      const b0 = bank(sim);
      sim.ctl.da = m.da + 0.15 * sgn; let i = 0;
      while (Math.abs(bank(sim) - b0) < 2 && i < 300) { sim.step(dt); i++; }
      sim.ctl.da = m.da;
      const ser = [];
      for (let k = 0; k < 60 * 22; k++) { sim.step(dt); if (k % 60 === 0) ser.push(bank(sim) - b0); }
      runs.push(ser);
    }
    const anti = runs[0].map((v, i) => (v - runs[1][i]) / 2);
    return Math.log(Math.abs(anti[20]) / Math.abs(anti[4])) / 16;       // 4 s .. 20 s
  };
  for (const [k, f] of [['cub', CUB], ['mosquito_3', 'tools/fixtures/repro/mosquito_3.json']]) {
    const { def, dc } = check(joined(f));
    const lp = dc.modes.spiral.lambda, ls = fly(def);
    const agree = Math.sign(lp) === Math.sign(ls) && (lp < 0 || (ls > 0.5 * lp && ls < 2 * lp));
    ok(agree, `${k}: predicted spiral root ${lp.toFixed(4)} /s, flown ${ls.toFixed(4)} /s ` +
              `(bank doubling ${lp > 0 ? (Math.log(2) / lp).toFixed(1) + ' s' : 'stable'} vs ${ls > 0 ? (Math.log(2) / ls).toFixed(1) + ' s' : 'stable'})`);
  }
}

console.log(`\nDESIGNCHECK: ${checks - fails}/${checks} ok` + (fails ? `, ${fails} FAIL` : ''));
process.exit(fails ? 1 : 0);
