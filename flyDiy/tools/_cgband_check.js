#!/usr/bin/env node
// _cgband_check.js - GATE CGBAND (G3450 P1 CG-COLOURS, the user 24 Oct: "the garage's CG / neutral point indicators get clear
// colour coding: RED = bad, ORANGE = acceptable, GREEN = good and safe - ONLY that coding, an added "!" in the wording for
// red and orange, and a tooltip explaining the reasons").
//   BANDS   genMarginBand (64b_gen_design.js) at its edges: under 0 red, 0 .. 5 % orange, 5 .. 40 % green, over 40 %
//           orange; "!" on red and orange only; every band has its reasons (and a fix where one is owed); no margin, no band
//   BUILDS  the band of real aeroplanes, joined as the game loads them: the user's corrected Cub green, the user's
//           'birdman (1)' (CG 18 % behind the neutral point) red, when it is on this machine
//   PAGE    app.js colours both posts, both labels and the ground bar from the band (no old amber / cyan / red test left),
//           the CG readout opens on a warning sign on red and orange (G3452)
//           and opens the tooltip on a hover AND a tap
//   node tools/_cgband_check.js     -> "GATE CGBAND: PASS|FAIL"
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, FLY = path.join(T, '..');
const C = require(path.join(T, 'flight_core.js'));
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) fails++; console.log((c ? '  ok     ' : '  FAIL   ') + m); return c; };

console.log('BANDS');
const B = C.genMarginBand;
ok(typeof B === 'function' && C.GEN_MARGIN_BANDS && C.GEN_MARGIN_BANDS.comfy === 0.05 && C.GEN_MARGIN_BANDS.noseHeavy === 0.40, 'genMarginBand and its edges are exported (0 / 5 % / 40 %)');
const cases = [[-0.176, 'red'], [-0.0001, 'red'], [0, 'orange'], [0.049, 'orange'], [0.05, 'green'], [0.076, 'green'], [0.40, 'green'], [0.4001, 'orange'], [0.6, 'orange']];
for (const [sm, want] of cases) { const r = B(sm); ok(r && r.band === want, 'margin ' + sm + ' -> ' + (r && r.band) + ' (want ' + want + ')'); }
for (const sm of [-0.1, 0.02, 0.5]) { const r = B(sm); ok(r.mark === '!' && r.why && r.fix && r.title, 'margin ' + sm + ': "!" and its reasons and fix (' + r.title + ')'); }
{ const r = B(0.12); ok(r.mark === '' && r.why && !r.fix, 'a green margin carries no "!" and no fix (' + r.title + ')'); }
ok(B(null) === null && B(NaN) === null && B(undefined) === null, 'no margin, no band');
ok(/BEHIND/.test(B(-0.176).why) && /18 %/.test(B(-0.176).why), 'the red reason says how far the CG is behind (' + B(-0.176).why.slice(0, 70) + '...)');

console.log('BUILDS');
let LB = null; try { LB = require(path.join(T, '_load_build.js')); } catch (e) {}
const smOf = file => { const raw = JSON.parse(fs.readFileSync(file, 'utf8')); const S = LB.gameSpec(raw);
  const def = C.buildGen(C.genMigrateSpec(JSON.parse(JSON.stringify(S)))); return C.genShakedown(def, { corners: false }).staticMargin; };
if (LB) {
  const cub = path.join(FLY, 'builds', 'cub_2026-09-20_corrected.json');
  if (fs.existsSync(cub)) { const sm = smOf(cub); ok(B(sm).band === 'green', 'the corrected Cub: margin ' + (sm * 100).toFixed(1) + ' % -> ' + B(sm).band); }
  const bird = path.join(FLY, 'bugReports', 'birdman (1).json');
  if (fs.existsSync(bird)) { const sm = smOf(bird); ok(B(sm).band === 'red', "the user's birdman (1): margin " + (sm * 100).toFixed(1) + ' % -> ' + B(sm).band); }
  else console.log('  (birdman (1).json not in this tree: its row skipped)');
}

console.log('PAGE');
const app = fs.readFileSync(path.join(FLY, 'src', 'viewer', 'app.js'), 'utf8');
ok(/genMarginBand\(smV\)/.test(app), 'the indicator reads its band from genMarginBand');
ok(/post\(cg\[0\], cg\[2\], COL, 3\.2\)/.test(app) && /post\(npx, npz, COL, 2\.8\)/.test(app), 'both posts wear the band colour');
ok(/'neutral point', COL, smTxt/.test(app) && /'centre of gravity', COL, cgTxt/.test(app), 'both labels wear the band colour');
ok(!/smBad/.test(app), 'the old red-below-5 % test is gone');
ok(/if \(MB && MB\.mark\) cgTxt = '(?:\\u26a0|⚠) ' \+ \(cgTxt \|\| MB\.title\)/.test(app), 'G3452: the CG readout opens on a warning sign on red and orange (the band\'s mark)');
ok(/cgTipHover\(e\.clientX, e\.clientY\)/.test(app) && /cgTipTap\(e\.clientX, e\.clientY, e\.pointerType === 'mouse'\)/.test(app), 'the tooltip opens on a hover and on a tap');
const css = fs.readFileSync(path.join(FLY, 'src', 'viewer', 'editor.css'), 'utf8');
ok(/#cgTip\b/.test(css) && /#cgTip\.b-red/.test(css) && /#cgTip\.b-orange/.test(css) && /#cgTip\.b-green/.test(css), 'the tooltip is styled per band (editor.css)');

console.log(checks + ' checks, ' + fails + ' failed');
console.log('GATE CGBAND: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
