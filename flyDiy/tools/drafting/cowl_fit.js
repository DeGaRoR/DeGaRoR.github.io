#!/usr/bin/env node
// cowl_fit.js - THE COWL AGAINST THE DRAWING, AT LEVEL 2 (FLAGSHIP, the Cessna 172 refit, 15-16 Nov 2026). Two readers the
// refit used every round, made a tool (A0 16 Nov: "your fitting scripts + the lessons"; the lessons are
// futureDesigns/lessons/FLAGSHIP-cessna-refit.md). Both build the plane the drafting table's way (dt_node.js, the page's own
// files) at subdivision level 2 - the user's rule: fit and measure on level 2, never the level-0 draft.
//
//   node tools/drafting/cowl_fit.js line <doc.json> [--over '<json>'] [--every 5]
//       The cowl's top line in the side view, nose to firewall, every 5 mm: the worst DIP going aft (a hump near the nose
//       shows as a dip after it; 0 mm = one monotonous line). --every N prints every Nth station (mm, height).
//   node tools/drafting/cowl_fit.js fit <doc.json> --ref <ref.json> --keys 'row,lo,hi;row,lo,hi' [--over '<json>']
//       [--hub <m>] [--weights '<json>'] [--level-belly] [--passes 2] [--out <over.json>]
//       Coordinate descent of the named cage rows (the garage's rows only: every fitted value is a row) against the drawing's
//       cowl read at stations: ref.json = { "<station m>": [top, bottom, half-width] }, null where the drawing says nothing.
//       The thrust line is HELD: a penalty on the hub height (--hub, default the start's own) - a cowl fit that moves the
//       axis (cw_lidRise) silently moves the propeller and everything placed after it (the refit lost a round to that).
//       --weights { "<station>": w } pins a station harder (the firewall end against the body's step: w 30).
//       --level-belly: the last two stations' bottoms equal (the bottom line meets the belly level).
//       Starts FROM the plane's own values (the doc's cage row, then the --over), never 0. Writes the best over to --out.
//
// STATIONS: the build frame's first coordinate as table.js check prints it (metres along the axis, the face first); heights
// in the same frame (y up). Read them off the level-2 overlay (table.js check --level 2 --png), not off the level-0 draft.
// The doc is a drafting doc (spec + reference marks: tools/drafting/refs/*.json, or a build's spec merged into one).
'use strict';
const path = require('path'), fs = require('fs');
const DT = require(path.join(__dirname, 'dt_node.js')), C = DT.CORE;
const argv = process.argv.slice(2), mode = argv[0], docFile = argv[1];
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
if (!['line', 'fit'].includes(mode) || !docFile) { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 26).join('\n')); process.exit(2); }
const doc = JSON.parse(fs.readFileSync(docFile, 'utf8'));
const over0 = JSON.parse(opt('over', '{}'));

// the cowl's triangles cut by a station plane: top, bottom, half-width at each station
function sections(o, AT) {
  const B = DT.build(doc.spec, o, { level: 2 }), R = AT.map(() => [-9, 9, 0]);
  for (let t = 0; t < B.parts.length; t++) {
    if (B.parts[t] !== C.PID.cowl) continue;
    const V = [0, 1, 2].map(e => B.tris.slice(t * 9 + e * 3, t * 9 + e * 3 + 3));
    AT.forEach((x, i) => {
      for (let e = 0; e < 3; e++) {
        const a = V[e], b = V[(e + 1) % 3];
        if ((a[0] - x) * (b[0] - x) > 0 || a[0] === b[0]) continue;
        const u = (x - a[0]) / (b[0] - a[0]), h = a[1] + u * (b[1] - a[1]), s = Math.abs(a[2] + u * (b[2] - a[2]));
        R[i][0] = Math.max(R[i][0], h); R[i][1] = Math.min(R[i][1], h); R[i][2] = Math.max(R[i][2], s);
      }
    });
  }
  return { R, hub: B.frame.hubY, B };
}

if (mode === 'line') {
  const B = DT.build(doc.spec, over0, { level: 2 });
  let a0 = 9, a1 = -9;
  for (let t = 0; t < B.parts.length; t++) { if (B.parts[t] !== C.PID.cowl) continue;
    for (let e = 0; e < 3; e++) { const x = B.tris[t * 9 + e * 3]; a0 = Math.min(a0, x); a1 = Math.max(a1, x); } }
  if (a0 > a1) { console.log('cowl_fit: no cowl in this build'); process.exit(1); }
  const AT = []; for (let x = Math.ceil(a0 * 200) / 200; x <= a1; x += 0.005) AT.push(+x.toFixed(3));
  const { R } = sections(over0, AT), top = R.map(r => r[0]);
  // one monotonous line = the top never falls going aft (it rises from the nose to the firewall)
  let worst = 0, at = null, run = -9;
  AT.forEach((x, i) => { if (top[i] > run) run = top[i]; else if (run - top[i] > worst) { worst = run - top[i]; at = x; } });
  console.log('cowl ' + a0.toFixed(3) + '..' + a1.toFixed(3) + ' m  hub ' + B.frame.hubY.toFixed(3) + '  worst dip going aft ' + (worst * 1000).toFixed(1) + ' mm' + (at == null ? '' : ' at ' + at));
  const ev = +opt('every', 0);
  if (ev > 0) console.log(AT.map((x, i) => x.toFixed(3) + ' ' + top[i].toFixed(4)).filter((_, i) => i % ev === 0).join('\n'));
  process.exit(0);
}

// fit
const ref = JSON.parse(fs.readFileSync(opt('ref', ''), 'utf8'));
const KS = opt('keys', '').split(';').filter(Boolean).map(s => { const [k, lo, hi] = s.split(','); return { k, lo: +lo, hi: +hi }; });
if (!KS.length) { console.log('cowl_fit fit: --keys "row,lo,hi;..." is required'); process.exit(2); }
const AK = Object.keys(ref).sort((a, b) => +a - +b), AT = AK.map(Number), RF = AK.map(k => ref[k]);
const W = JSON.parse(opt('weights', '{}')), belly = argv.includes('--level-belly');
let o = Object.assign({}, over0);
// the plane's own value: the --over, else the resolved cage (the generator's defaults included), else a follow row's frame value
const P0 = DT.context().CAGE2.cageFromSpec(doc.spec);
for (const K of KS) if (o[K.k] == null) {
  const v = P0[K.k] != null && isFinite(+P0[K.k]) ? +P0[K.k] : DT.followValue(doc.spec, K.k, o);
  if (v == null) { console.log('cowl_fit fit: ' + K.k + ' has no value on this plane (not a cage row?)'); process.exit(2); }
  o[K.k] = v;
}
const HUB = opt('hub', null) != null ? +opt('hub') : sections(o, AT).hub;
const cost = t => {
  const { R, hub } = sections(t, AT); let c = 0, n = 0;
  AT.forEach((x, i) => { const r = RF[i], w = W[AK[i]] || 1;
    if (R[i][0] === -9) return;                       // no cowl at this station (the cowl ends before it): named below, not scored
    for (let j = 0; j < 3; j++) if (r[j] != null) { const d = R[i][j] - r[j]; c += d * d * w * (j === 1 ? 1.5 : 1); n++; } });
  if (belly && AT.length > 1) { const L = AT.length, d = R[L - 1][1] - R[L - 2][1]; c += d * d * 20; n++; }
  const dh = hub - HUB; c += dh * dh * 400; n++;
  return Math.sqrt(c / n);
};
let best = cost(o);
console.log('start rms ' + (best * 100).toFixed(2) + ' cm  hub held at ' + HUB.toFixed(3));
for (let pass = 0; pass < +opt('passes', 2); pass++) for (const K of KS) {
  let step = (K.hi - K.lo) / 6;
  for (let it = 0; it < 6; it++) {
    let moved = false;
    for (const s of [step, -step]) {
      const v = Math.max(K.lo, Math.min(K.hi, (+o[K.k] || 0) + s)), t = Object.assign({}, o, { [K.k]: +v.toFixed(4) }), c = cost(t);
      if (c < best - 1e-5) { best = c; o = t; moved = true; break; }
    }
    if (!moved) step /= 2;
  }
}
const { R, hub } = sections(o, AT);
console.log('end rms ' + (best * 100).toFixed(2) + ' cm  hub ' + hub.toFixed(3) + '  ' + KS.map(K => K.k + '=' + o[K.k]).join(' '));
console.log('station: ours top/bottom/half-width vs the drawing');
console.log(AT.map((x, i) => '  ' + AK[i] + ': ' + (R[i][0] === -9 ? 'NO COWL HERE (not scored: the cowl ends before this station)' : R[i].map(v => v.toFixed(3)).join('/')) + ' vs ' + RF[i].map(v => v == null ? '-' : v).join('/')).join('\n'));
if (opt('out', null)) { fs.writeFileSync(opt('out'), JSON.stringify(o)); console.log('wrote ' + opt('out')); }
