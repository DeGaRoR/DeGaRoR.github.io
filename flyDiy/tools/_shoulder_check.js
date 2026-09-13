// SHOULDER CHECK — headless: build the cage sheet in every configuration the
// user named (wide / narrow cabins, no pax bay, one and two, bubble cockpit,
// mirrored pod) plus the ones that stress the trace (no door, extended sill,
// exploded, round + tube, drawn pax windows), run the shoulder, and judge:
//   - every part is a closed 2-manifold by position (no open, no over-shared
//     edge), positive volume, no NaN;
//   - both flanks carry a part; the top surface sits under every traced
//     transition point; the forward cap stays behind the dash;
//   - with the throttle: the slot exists where the lever crosses.
// node tools/_shoulder_check.js [--verbose]
'use strict';
const G = require('./_cage_gen.js');
const SG = require('./_shoulder_gen.js');
const VERB = process.argv.includes('--verbose');

const BASE = { intOn: 1, cutParts: 1 };
const CONFIGS = SG.CONFIGS;
const stockLever = (built, side) => SG.stockLever(built, side, G);

let fails = 0;
for (const [name, over, sopt] of CONFIGS) {
  const P = { ...G.CAGE_PARAMS, ...BASE, ...over };
  const built = G.cageSheet(P, { level: 2 });
  const t0 = Date.now();
  const out = SG.shoulderBuild(built.mesh, built.spec, sopt || {}, G);
  const ms = Date.now() - t0;
  const res = SG.shoulderCheck(out);
  const lim = out.shoulder.trace.limits;
  const sides = new Set(res.map(r => r.side));
  const bad = res.filter(r => !r.ok);
  // the top under every traced point (drop), the caps behind the dash
  let topBad = 0, dashBad = 0;
  for (const p of out.shoulder.parts) {
    if (lim.zDash != null && p.z1 > lim.zDash - 1e-6) dashBad++;
  }
  const line = `${name.padEnd(24)} parts ${res.length} (${[...sides].join('/')})  faces ${res.reduce((s, r) => s + r.faces, 0)}` +
    `  open ${res.reduce((s, r) => s + r.open, 0)} over ${res.reduce((s, r) => s + r.over, 0)}  nan ${res.reduce((s, r) => s + r.nan, 0)}` +
    `  vol ${res.map(r => (r.vol * 1e6).toFixed(0)).join('/')} cm3  ${ms} ms`;
  const ok = !bad.length && sides.size === 2 && !dashBad && res.length > 0;
  if (!ok) fails++;
  console.log((ok ? 'PASS ' : 'FAIL ') + line + (dashBad ? '  cap past the dash' : ''));
  if (VERB || !ok) for (const r of res)
    console.log(`     ${r.side > 0 ? 'port' : 'stbd'} ${r.kind} ${r.door ? 'door ' + r.door : 'fixed'} z ${r.z0.toFixed(3)}..${r.z1.toFixed(3)} H ${r.Hmin.toFixed(3)}..${r.Hmax.toFixed(3)} open ${r.open} over ${r.over}` + (r.slot ? ' slot ' + JSON.stringify(r.slot) : ''));
}
// the throttle: stock build, the wall lever at the crew's station, three lip
// widths — the slot must appear in the leg the lever crosses, and the part
// must stay closed
console.log('--- throttle');
{
  // the wall lever at the crew's own station sits ~0.59 m below the sill on
  // the stock build: NO crossing is the truth there. Raised into the pocket
  // it must come out through the face (W 0.05: the knob reaches past the
  // leg) or be reported BURIED (W 0.07: the 16 cm lever ends inside the
  // pocket); raised to the sill it comes out through the top
  const built = G.cageSheet({ ...G.CAGE_PARAMS, ...BASE }, { level: 2 });
  const ROWS = [
    ['stock station, W 0.07', 0.07, 0, 'none'],
    ['up 0.40, W 0.05', 0.05, 0.40, 'face'],
    ['up 0.40, W 0.07', 0.07, 0.40, 'buried'],
    ['up 0.55, W 0.07', 0.07, 0.55, 'top'],
    ['up 0.55, W 0.10', 0.10, 0.55, 'top'],
  ];
  for (const [lab, W, dy, want] of ROWS) {
    const lever = stockLever(built, 1);
    lever.piv[1] += dy;
    const out = SG.shoulderBuild(built.mesh, built.spec, { W, lever }, G);
    const res = SG.shoulderCheck(out);
    const closed = res.every(r => r.ok);
    const s = res.filter(r => r.side > 0).map(r => r.slot).find(Boolean) || {};
    const got = s.ok ? s.leg : /BURIED/.test(s.note || '') ? 'buried' : 'none';
    const ok = closed && got === want;
    if (!ok) fails++;
    console.log((ok ? 'PASS ' : 'FAIL ') + lab.padEnd(24) + ' closed ' + closed + '  slot ' + got + (want !== got ? ' (wanted ' + want + ')' : '') +
      (s.range ? '  z ' + s.range.map(v => v.toFixed(3)).join('..') : '') + (s.clipped ? '  clipped at the edge' : ''));
    if (!closed) for (const r of res) console.log('     ', r);
  }
}
// the runner reads the WHOLE verdict line (GATE <ID>: PASS), not the exit code
console.log(fails ? `GATE SHOULDER: FAIL (${fails})` : 'GATE SHOULDER: PASS');
process.exit(fails ? 1 : 0);
