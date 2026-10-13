#!/usr/bin/env node
// GATE DMGWALL (G1855-G1859, DMG-WALL) - ONE WALL, NO STRETCH, node only. The user (2026-10-05): the crashed Cub must stay
// yellow ("grey/black = the inside leaking out": the covering and its lining are one physical wall), no part drawn
// stretched ("we need to retain something like area"), no sheet metal cut to confetti. On every validated build's FLOWN
// CAGE SNAPSHOT (built headless: tools/_dmg_wall_lib.js, with G1859's layer ranges), damage ON, the certificate stamped
// (the page's state), the brief's crashes (the 30 m/s trunk on the centreline and 2.5 m out, the 3 m/s taxi into a trunk,
// the nose-over, the severe ground nose-in; the severe float nose-in on the floatplanes), the wreck bound by INHERITANCE
// (skin_break.js bindInherit / wallSync / wallFollow) as app.js brkCage binds it, every frame from the first break
// (tools/_dmg_wall_study.js measures; the old binding, 'base', run beside it for the report):
//   a. THE WALL HOLDS: every wall place (the lining, the fireproof sheet, the sills, the door pads, the beads, the glazing)
//      UNDER the covering (its rest offset mostly along the normal: a pane in a hole is beside its rim, not behind it)
//      against the covering triangle closest to it at rest, both live: out through that triangle's live plane past 1 mm
//      in at most 2 % of the place-frames, past 1 cm in at most 0.1 %, past 5 cm in at most 1e-4 (the base: 15-27 % past
//      1 mm and up to 9 m on the Cub; a millimetre's bead under sheet metal is not what the user sees - the centimetres are);
//   b. NO STRETCH: no triangle of a compact part (one layer object under 1.2 m: a cowl panel, a fitting, a light, a hinge)
//      changes an edge by more than 1 % (the base: up to 250 %);
//   c. every drawn position finite; no weightless place (G1818 merge: every kept weight 0 - the CPU drew it at its rest
//      coordinates in the world); at most 2 % of the places past the GPU's 8 binding slots (the top 8 kept).
// Reported, not gated: covering torn with no node at the damage, torn where no member among its nodes strained past the
// tear (unbraced bays shear), the binding's cost. Damage OFF / nothing broken: no record is made at all (the page's
// brkCage returns before; GATE DMGSKIN's bitwise checks cover the skin's path).
// G2354 (DMG-DETERMINISM): THE 30 M/S ROWS ARE AN ENSEMBLE. A 30 m/s trunk depends on its start (a millimetre on every
// node moves the Jodel's centreline over 135-196 members broken: _treecrash_lib's ENSEMBLE note), so one run's leak share
// is one draw - DMG-TUNE's Jodel centreline went red on one. The trunk-0 / trunk-2.5 rows fly ENS members (member 0 the
// run as it was, members 1.. every node's start nudged by up to 1 mm, seeded:
// _treecrash_lib perturb): the shares (past 1 mm / 1 cm / 5 cm, past 8 slots) are judged on the ensemble's MEDIAN, the
// p90 and the worst member printed; what must never happen (a compact part stretched, a position not finite, a tube
// past 1.2 x) is checked on EVERY member. The other cases stay single runs (slow enough not to be chaotic).
// Run: node tools/_dmg_wall_check.js [--only cub,jodel] [--par 3] [--ens 8]   (one final `GATE DMGWALL: PASS|FAIL`) [--selftest]
// --selftest: the weightless row against skin_break.js as it stood before its fix (git c7f5dea1: wallSync read the covering's
// weights at welded copies) on the Cub's taxi and nose-in - it must count weightless places there (`GATE DMGWALL-SELFTEST`)
'use strict';
const path = require('path'), fs = require('fs'), { spawn } = require('child_process');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const BUILDS = { cub: 'trunk-0,trunk-2.5,taxi,noseover,nosein', jodel: 'trunk-0,trunk-2.5,taxi,noseover,nosein', metal: 'trunk-0,trunk-2.5,taxi,noseover,nosein',
                 floats: 'nosein-water', twinFloats: 'nosein-water' };
const SHEET_MAX = 1.5;   // (train 41, A0: the sheet's bound - see its row)
const LEAK_SHARE = 0.02, LEAK1_SHARE = 1e-3, LEAK5_SHARE = 1e-4, OVER8_SHARE = 0.02;
const SELFTEST = argv.includes('--selftest');
const only = SELFTEST ? 'cub' : opt('only', null), keys = Object.keys(BUILDS).filter(k => !only || only.split(',').includes(k)), PAR = +opt('par', 3);
const ENS = +opt('ens', 8), FAST = new Set(['trunk-0', 'trunk-2.5']);
const t0 = Date.now();
let SB_OLD = null;
if (SELFTEST) {
  SB_OLD = path.join(require('os').tmpdir(), 'dmgwall_sb_c7f5dea1_' + process.pid + '.js');
  fs.writeFileSync(SB_OLD, require('child_process').execSync('git show c7f5dea1:flyDiy/src/viewer/skin_break.js', { cwd: path.join(__dirname, '..'), maxBuffer: 1 << 26 }));
}
// the jobs: each build's cases (both schemes); a land build's ensemble members (the inheritance only: the base is a report);
// the selftest: the Cub's taxi and nose-in on the inheritance against the old skin_break (no ensemble)
const JOBS = [];
for (const k of keys) {
  if (SELFTEST) { JOBS.push({ k, cases: 'taxi,nosein', schemes: 'inh' }); continue; }
  JOBS.push({ k, cases: BUILDS[k], schemes: 'base,inh' });
  const mem = BUILDS[k].split(',').filter(c => FAST.has(c)), ids = [];
  for (const c of mem) for (let s = 1; s < ENS; s++) ids.push(c + '#' + s);
  if (ids.length) JOBS.push({ k, cases: ids.join(','), schemes: 'inh', ens: true });
}
const one = J => new Promise(res => {
  const k = J.k, out = path.join(require('os').tmpdir(), 'dmgwall_' + k + (J.ens ? '_ens' : '') + '_' + process.pid + '.json');
  const ch = spawn(process.execPath, ['--max-old-space-size=6144', path.join(__dirname, '_dmg_wall_study.js'), '--build', k, '--cases', J.cases, '--schemes', J.schemes, '--out', out],
    { env: Object.assign({}, process.env, { FLYDIY_CERT: '1' }, SB_OLD ? { DMGWALL_SB: SB_OLD } : {}), stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; ch.stdout.on('data', d => log += d); ch.stderr.on('data', d => log += d);
  ch.on('close', code => { let r = null; try { r = JSON.parse(fs.readFileSync(out, 'utf8')); fs.unlinkSync(out); } catch (e) {} res({ k, ens: !!J.ens, code, r, log }); });
});
(async () => {
  // (the ensembles first: the longest jobs)
  const res = [], q = JOBS.slice().sort((a, b) => (b.ens ? 1 : 0) - (a.ens ? 1 : 0));
  await Promise.all(Array.from({ length: Math.min(PAR, q.length) }, async () => { while (q.length) res.push(await one(q.shift())); }));
  if (SELFTEST) {
    try { fs.unlinkSync(SB_OLD); } catch (e) {}
    const R = res[0], cs = R && R.r ? R.r.cases : [], wl = cs.map(c => (c.schemes.inh && c.schemes.inh.weightless) || 0), red = wl.some(n => n > 0);
    console.log('  the pre-fix skin_break.js (c7f5dea1): weightless place-frames ' + JSON.stringify(cs.map((c, i) => c.case + ' ' + wl[i])) + (R && R.r ? '' : ' (no result: exit ' + (R && R.code) + ') ' + (R ?R.log.slice(-800) : '')));
    console.log('  ' + (red ? 'ok  ' : 'FAIL') + '  the weightless row goes red on the bug');
    console.log('GATE DMGWALL-SELFTEST: ' + (red ? 'PASS' : 'FAIL'));
    process.exit(red ? 0 : 1);
  }
  let checks = 0, fails = 0;
  const yes = (ok, msg) => { checks++; if (!ok) fails++; console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + msg); };
  for (const k of keys) {
    const R = res.find(x => x.k === k && !x.ens), E = res.find(x => x.k === k && x.ens);
    console.log('\n' + k + (R.r ? '' : '  (no result: exit ' + R.code + ')\n' + R.log.slice(-1500)));
    if (!R.r) { yes(false, k + ': the study ran'); continue; }
    if (E && !E.r) { console.log('  (the ensemble: no result, exit ' + E.code + ')\n' + E.log.slice(-1500)); yes(false, k + ': the ensemble ran'); }
    for (const c of R.r.cases) {
      const s = c.schemes.inh, b = c.schemes.base;
      if (FAST.has(c.case) && E && E.r) { ensRows(k, c, E.r.cases.filter(x => x.case.split('#')[0] === c.case)); continue; }
      if (!s) { console.log('  ' + c.case + ': nothing broke (' + c.broken + ' broken) - nothing to draw'); continue; }
      const sh = x => x.tested ? x.leak / x.tested : 0;
      console.log('  ' + c.case + ': ' + c.broken + ' broken, ' + c.pieces + ' pieces; leak base ' + (100 * sh(b)).toFixed(2) + ' % (worst ' + b.worstLeak + ' m) -> ' +
        (100 * sh(s)).toFixed(3) + ' % (worst ' + s.worstLeak + ' m, past 5 cm ' + s.leak5cm + '); rigid past 1 % base ' + b.rigidBad + ' -> ' + s.rigidBad +
        '; torn w/o damage base ' + b.bayTorn + ' -> ' + s.bayTorn + ', w/o strain ' + b.tornNoStrain + ' -> ' + s.tornNoStrain + '; bind ' + s.inh.ms + ' ms, over 8 ' + s.inh.over8 + '/' + s.inh.places);
      yes(sh(s) <= LEAK_SHARE, k + ' ' + c.case + ': the wall out past 1 mm ' + (100 * sh(s)).toFixed(3) + ' % <= ' + 100 * LEAK_SHARE + ' % (the base ' + (100 * sh(b)).toFixed(2) + ' %)');
      yes(s.tested ? s.leak1cm / s.tested <= LEAK1_SHARE : true, k + ' ' + c.case + ': past 1 cm ' + s.leak1cm + ' of ' + s.tested + ' (<= 0.1 %)');
      yes(s.tested ? s.leak5cm / s.tested <= LEAK5_SHARE : true, k + ' ' + c.case + ': past 5 cm ' + s.leak5cm + ' of ' + s.tested);
      yes(s.rigidBad === 0, k + ' ' + c.case + ': no compact part triangle past 1 % (' + s.rigidTris + ' triangle-frames)');
      yes(s.nonFinite === 0, k + ' ' + c.case + ': every drawn position finite');
      // (train 41, A0: THE SHEET - a giant strip drawn metres across the runway on both paths. At rest every drawn live edge
      // within 1.5 x its rest (1 cm or more): above any bound a tear holds - fabric 1 + TEAR, FABRIC's HELD ~1.36, sheet 1.4 +
      // 2 cm, a tube 1.2 + 3 mm - and a never-torn record (rigid, the wall on its covering) does not stretch at all)
      { const sh = s.sheet || {}, worst = Object.entries(sh).reduce((a, [cl, v]) => (!a || v.ratio > a.ratio ? Object.assign({ cls: cl }, v) : a), null);
        console.log('  ' + (worst && worst.ratio > SHEET_MAX ? 'NOTE' : 'ok  ') + '  ' + k + ' ' + c.case + ': (reported - the sheet is held by GATE DMGPAGEW on the page\'s flow) the longest drawn live edge at rest over its rest, past ' + SHEET_MAX + ' x: ' + (worst && worst.ratio > SHEET_MAX ? worst.cls : 'none') + ' (worst per class ' + JSON.stringify(Object.fromEntries(Object.entries(sh).map(([cl, v]) => [cl, v.ratio + ' (' + v.len + ' m / ' + v.rest + ' m, group ' + v.group + (v.role ? ' ' + v.role : '') + (v.noTear ? ', never torn' : '') + ')']))) + ')'); }
      yes(!s.weightless, k + ' ' + c.case + ': no weightless place (every kept weight 0: nothing to ride; ' + (s.weightless || 0) + ' place-frames)');
      yes(s.tubeBad === 0, k + ' ' + c.case + ': no drawn tube triangle past 1.2 x its rest (the members end at 15 %; worst ' + (+s.tubeWorst || 0).toFixed(3) + ', ' + s.tubeTris + ' triangle-frames)');
      yes(s.inh.over8 <= OVER8_SHARE * s.inh.places, k + ' ' + c.case + ': places past 8 slots ' + s.inh.over8 + ' <= 2 %');
    }
  }
  // the ensemble's rows: member 0 (the run as it was, both schemes) and the nudged members (the inheritance)
  function ensRows(k, c0, rest) {
    const M = [c0].concat(rest), sch = M.map(c => c.schemes.inh).filter(Boolean), L = require('./_treecrash_lib.js');
    const sh = x => (x.tested ? x.leak / x.tested : 0), q = (a, f) => L.ensStats(a.map(f));
    const S1 = q(sch, sh), S1c = q(sch, x => (x.tested ? x.leak1cm / x.tested : 0)), S5 = q(sch, x => (x.tested ? x.leak5cm / x.tested : 0)), S8 = q(sch, x => x.inh.over8 / x.inh.places);
    const B = L.ensStats(M.map(c => c.broken)), P = L.ensStats(M.map(c => c.pieces)), pc = x => (100 * x).toFixed(3) + ' %';
    console.log('  ' + c0.case + ' (an ensemble of ' + M.length + ', ' + sch.length + ' with something broken): broken ' + B.median + ' [' + B.p10 + '-' + B.p90 + '], pieces ' + P.median + ' [' + P.p10 + '-' + P.p90 + ']; past 1 mm median ' + pc(S1.median) + ', p90 ' + pc(S1.p90) + ', worst ' + pc(S1.max) +
      (c0.schemes.inh ? '; member 0: base ' + (100 * sh(c0.schemes.base)).toFixed(2) + ' %, worst leak ' + c0.schemes.inh.worstLeak + ' m' : ''));
    yes(sch.length === M.length, k + ' ' + c0.case + ': every member broke something (' + sch.length + '/' + M.length + ')');
    yes(S1.median <= LEAK_SHARE, k + ' ' + c0.case + ': the wall out past 1 mm, the ensemble\'s median ' + pc(S1.median) + ' <= ' + 100 * LEAK_SHARE + ' % (p90 ' + pc(S1.p90) + ')');
    yes(S1c.median <= LEAK1_SHARE, k + ' ' + c0.case + ': past 1 cm, the median ' + pc(S1c.median) + ' <= 0.1 % (p90 ' + pc(S1c.p90) + ')');
    yes(S5.median <= LEAK5_SHARE, k + ' ' + c0.case + ': past 5 cm, the median ' + pc(S5.median) + ' (p90 ' + pc(S5.p90) + ')');
    yes(sch.every(s => s.rigidBad === 0), k + ' ' + c0.case + ': no compact part triangle past 1 % in any member');
    yes(sch.every(s => s.nonFinite === 0), k + ' ' + c0.case + ': every drawn position finite in every member');
    yes(sch.every(s => s.tubeBad === 0), k + ' ' + c0.case + ': no drawn tube triangle past 1.2 x its rest in any member (worst ' + Math.max(...sch.map(s => +s.tubeWorst || 0)).toFixed(3) + ')');
    yes(S8.median <= OVER8_SHARE, k + ' ' + c0.case + ': places past 8 slots, the median ' + pc(S8.median) + ' <= 2 %');
  }
  console.log('\n' + checks + ' checks, ' + fails + ' failed, ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
  console.log('GATE DMGWALL: ' + (fails ? 'FAIL' : 'PASS'));
  process.exit(fails ? 1 : 0);
})();
