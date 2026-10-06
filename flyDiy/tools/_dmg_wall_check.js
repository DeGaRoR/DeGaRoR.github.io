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
//   c. every drawn position finite; at most 2 % of the places past the GPU's 8 binding slots (the top 8 kept).
// Reported, not gated: covering torn with no node at the damage, torn where no member among its nodes strained past the
// tear (unbraced bays shear), the binding's cost. Damage OFF / nothing broken: no record is made at all (the page's
// brkCage returns before; GATE DMGSKIN's bitwise checks cover the skin's path).
// Run: node tools/_dmg_wall_check.js [--only cub,jodel] [--par 3]   (one final `GATE DMGWALL: PASS|FAIL`)
'use strict';
const path = require('path'), fs = require('fs'), { spawn } = require('child_process');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const BUILDS = { cub: 'trunk-0,trunk-2.5,taxi,noseover,nosein', jodel: 'trunk-0,trunk-2.5,taxi,noseover,nosein', metal: 'trunk-0,trunk-2.5,taxi,noseover,nosein',
                 floats: 'nosein-water', twinFloats: 'nosein-water' };
const LEAK_SHARE = 0.02, LEAK1_SHARE = 1e-3, LEAK5_SHARE = 1e-4, OVER8_SHARE = 0.02;
const only = opt('only', null), keys = Object.keys(BUILDS).filter(k => !only || only.split(',').includes(k)), PAR = +opt('par', 3);
const t0 = Date.now();
const one = k => new Promise(res => {
  const out = path.join(require('os').tmpdir(), 'dmgwall_' + k + '_' + process.pid + '.json');
  const ch = spawn(process.execPath, ['--max-old-space-size=6144', path.join(__dirname, '_dmg_wall_study.js'), '--build', k, '--cases', BUILDS[k], '--schemes', 'base,inh', '--out', out],
    { env: Object.assign({}, process.env, { FLYDIY_CERT: '1' }), stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; ch.stdout.on('data', d => log += d); ch.stderr.on('data', d => log += d);
  ch.on('close', code => { let r = null; try { r = JSON.parse(fs.readFileSync(out, 'utf8')); fs.unlinkSync(out); } catch (e) {} res({ k, code, r, log }); });
});
(async () => {
  const res = [], q = keys.slice();
  await Promise.all(Array.from({ length: Math.min(PAR, q.length) }, async () => { while (q.length) res.push(await one(q.shift())); }));
  let checks = 0, fails = 0;
  const yes = (ok, msg) => { checks++; if (!ok) fails++; console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + msg); };
  for (const k of keys) {
    const R = res.find(x => x.k === k);
    console.log('\n' + k + (R.r ? '' : '  (no result: exit ' + R.code + ')\n' + R.log.slice(-1500)));
    if (!R.r) { yes(false, k + ': the study ran'); continue; }
    for (const c of R.r.cases) {
      const s = c.schemes.inh, b = c.schemes.base;
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
      yes(s.tubeBad === 0, k + ' ' + c.case + ': no drawn tube triangle past 1.2 x its rest (the members end at 15 %; worst ' + (+s.tubeWorst || 0).toFixed(3) + ', ' + s.tubeTris + ' triangle-frames)');
      yes(s.inh.over8 <= OVER8_SHARE * s.inh.places, k + ' ' + c.case + ': places past 8 slots ' + s.inh.over8 + ' <= 2 %');
    }
  }
  console.log('\n' + checks + ' checks, ' + fails + ' failed, ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
  console.log('GATE DMGWALL: ' + (fails ? 'FAIL' : 'PASS'));
  process.exit(fails ? 1 : 0);
})();
