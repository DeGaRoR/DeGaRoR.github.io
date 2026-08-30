// COWL PORT — THE VERDICT. Two questions, both answered without a browser:
//
//   1. is the port FAITHFUL? The generator was lifted out of a working tool,
//      so the test is that its own maths still produces the same surface it
//      produced there — sampled against the original file, not against an
//      opinion of what a cowl should be.
//   2. does the ENGINE actually drive it? A cowl that merely has an engine
//      nearby is not the point; the cylinders have to be inside it.
//
//   node tools/_cowl_check.js
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('./_cowl_gen.js');
const { engResolve } = require('./_eng_gen.js');

let fail = 0;
const ok = (label, cond, extra) => {
  console.log((cond ? '  ok   ' : '  FAIL ') + label + (extra ? '  ' + extra : ''));
  if (!cond) fail++;
};
const f = (x, n) => x.toFixed(n === undefined ? 3 : n);

// ---- 1. the port is faithful --------------------------------------------
// Load the ORIGINAL tool's generator half in a sandbox and compare surfaces
// point for point. If the port drifted, this is where it shows.
const SRC = 'C:/Users/denis/Downloads/cowl-generator-v19 (1).html';
let orig = null;
if (fs.existsSync(SRC)) {
  const L = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);
  const find = p => { for (let i = 0; i < L.length; i++) if (p(L[i])) return i;
                      throw new Error('marker'); };
  const a = find(l => l.startsWith('const TAU=')),
        b = find(l => /=+ PARAMETERS =+/.test(l)),
        c = find(l => /=+ SCENE =+/.test(l));
  const src = [L[a]].concat(L.slice(b, c)).join('\n') +
    '\nreturn {P, prepareLid, prepareMesh, surfPoint, sectionAtZ, spineY,' +
    ' zEnd, apertureList, propGeometry, PRESETS};';
  orig = new Function(src)();
}
ok('the original tool is available to compare against', !!orig,
   orig ? '' : '(skipped — Downloads copy not found)');

if (orig) {
  orig.prepareLid(); C.prepareLid();
  // surfPoint returns [x, y] — the station IS z, so it is not repeated in the
  // point. Walking three components compares undefined against undefined and
  // reports the whole sweep as NaN, which is a broken test rather than a
  // broken port; iterate the point's own length.
  let worst = 0, n = 0, nan = 0;
  for (let iz = 0; iz <= 20; iz++) {
    const z = C.zEnd() * iz / 20;
    for (let it = 0; it < 24; it++) {
      const th = it / 24 * Math.PI * 2;
      const A = orig.surfPoint(th, z), B = C.surfPoint(th, z);
      if (A.length !== B.length) { nan++; continue; }
      for (let k = 0; k < A.length; k++) {
        const d = Math.abs(A[k] - B[k]);
        if (!isFinite(d)) nan++; else worst = Math.max(worst, d);
      }
      n++;
    }
  }
  ok('no sample came back undefined on either side', nan === 0);
  ok('the ported surface is the original surface', worst < 1e-12,
     n + ' points, max deviation ' + worst.toExponential(2));
  ok('the preset table came across whole',
     Object.keys(orig.PRESETS).join() === Object.keys(C.PRESETS).join(),
     Object.keys(C.PRESETS).length + ' presets');
  // EVERY ORIGINAL PARAMETER SURVIVED — which is the port question. It used to
  // require the two sets to be IDENTICAL, and that was right while the port was
  // the whole story: nothing had been added, so equality and no-loss were the
  // same assertion. G94 added the fasteners, the parting line and the oil door,
  // which the original tool never had, and an ADDITION is not a port defect
  // while a DELETION still is. The teeth are unchanged in the direction that
  // matters, and the surface check above is untouched: the ported surface is
  // still the original surface to 1e-12.
  {
    const lost = Object.keys(orig.P).filter(k => C.P[k] === undefined);
    ok('every parameter of the original survived the port',
       lost.length === 0,
       lost.length ? 'lost: ' + lost.join(', ')
                   : Object.keys(orig.P).length + ' original, ' +
                     Object.keys(C.P).length + ' now');
  }
}

// ---- 2. the surface is still a surface ----------------------------------
C.prepareLid();
const zE = C.zEnd();
ok('the cowl has length', zE > 0, 'zEnd ' + f(zE));
let finite = true, gap = 0;
for (let iz = 0; iz <= 12; iz++) {
  const z = zE * iz / 12;
  const p0 = C.surfPoint(0, z), pT = C.surfPoint(Math.PI * 2, z);
  for (const q of [p0, pT]) if (!q.every(v => isFinite(v))) finite = false;
  for (let k = 0; k < p0.length; k++) gap = Math.max(gap, Math.abs(p0[k] - pT[k]));
}
ok('every sampled point is finite', finite);
// A section is built from a superellipse, so theta = 0 and theta = 2*pi run
// cos through Math.pow with a fractional exponent and come back a few parts in
// 1e7 apart. That is float noise in a power, not an open section — demanding
// bit-closure through it tests the arithmetic, not the cowl.
ok('every section closes on itself', gap < 1e-6, 'worst gap ' + gap.toExponential(2));
const aps = C.apertureList();
ok('the apertures resolve', Array.isArray(aps), aps.length + ' apertures');

// ---- 3. THE ENGINE DRIVES THE COWL --------------------------------------
console.log();
console.log('THE COWL, FITTED TO REAL ENGINES (metres)');
const IN = 0.0254;
const CASES = [
  { name: 'Continental A-65', arch: 'flat', cyl: 4,
    bore: 3.875 * IN, stroke: 3.625 * IN, rpm: 2300 },
  { name: 'Lycoming IO-360', arch: 'flat', cyl: 4,
    bore: 5.125 * IN, stroke: 4.375 * IN, rpm: 2700 },
  { name: 'Inline six', arch: 'inline', cyl: 6,
    bore: 0.100, stroke: 0.095, rpm: 2600 },
  { name: 'Radial nine', arch: 'radial', cyl: 9,
    bore: 5.5 * IN, stroke: 5.5 * IN, rpm: 2200 },
];
const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);
console.log(pad('engine', 20) + padL('eng w', 8) + padL('eng h', 8) +
            padL('eng len', 9) + padL('cowl w', 9) + padL('cowl h', 9) +
            padL('cowl len', 10));
console.log('-'.repeat(73));
// THE TEST IS THE EMITTED SURFACE, not the parameter. Comparing P.aftW (a
// SEMI-axis) against env.width (a full width) is satisfied by a cowl twice the
// size it should be, which is exactly the bug that slipped through first time.
// So: build the section at the firewall and ask whether the engine's own
// corners are inside it.
const sectionAt = z => {
  const pts = [];
  for (let i = 0; i < 720; i++) pts.push(C.surfPoint(i / 720 * Math.PI * 2, z));
  return pts;
};
// even-odd point-in-polygon over the sampled ring
const inside = (pts, x, y) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) &&
        x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const shapes = [];
for (const e of CASES) {
  const R = engResolve(e);
  // start every case from the tool's own default cowl, so the growth shown is
  // what THIS engine costs and not what the previous one left behind
  Object.assign(C.P, { aftW: 0.425, aftH: 0.3, cowlLen: 0.365 });
  // SIZE to the engine here, not merely clear it: the claim under test is
  // that the engine drives the cowl's SHAPE, and grow-only cannot make an
  // inline's cowl narrow because the default barrel is already wider than it.
  C.cowlSizeToEngine(R.env);
  C.prepareLid();
  const ring = sectionAt(0.001);
  let mx = 0, my0 = 0, my1 = 0;
  for (const p of ring) { mx = Math.max(mx, p[0]);
    my0 = Math.min(my0, p[1]); my1 = Math.max(my1, p[1]); }
  console.log(pad(e.name, 20) + padL(f(R.env.width), 8) +
    padL(f(R.env.height), 8) + padL(f(R.env.length), 9) +
    padL(f(2 * mx), 9) + padL(f(my1 - my0), 9) + padL(f(C.P.cowlLen), 10));
  // every corner of the engine's envelope must be inside the drawn section
  // the SILHOUETTE, not the bounding box: a radial's box corners are empty
  // air between its cylinders, and requiring a rounded cowl to contain them
  // would demand a square cowl for a round engine.
  const corners = R.env.hull;
  ok('  ' + e.name + ': the engine fits INSIDE the drawn section',
     corners.every(([x, y]) => inside(ring, x, y)),
     'cowl ' + f(2 * mx) + ' x ' + f(my1 - my0) +
     ' vs engine ' + f(R.env.width) + ' x ' + f(R.env.height));
  ok('  ' + e.name + ': and the cowl is not absurdly oversized',
     2 * mx < R.env.width + 0.35 && (my1 - my0) < R.env.height + 0.45,
     f(2 * mx) + ' vs ' + f(R.env.width));
  ok('  ' + e.name + ': the cowl clears the engine in length',
     C.P.cowlLen >= R.env.length, f(C.P.cowlLen) + ' >= ' + f(R.env.length));
  ok('  ' + e.name + ': fitting twice changes nothing',
     (() => { const before = C.P.aftW; C.cowlSizeToEngine(R.env);
              return Math.abs(C.P.aftW - before) < 1e-12; })());
  shapes.push({ name: e.name, w: 2 * mx, h: my1 - my0, len: C.P.cowlLen });
}
function env0(R) { return R.env; }

// the families must produce DIFFERENT cowls, which is the whole claim
const flat = shapes.find(s => s.name === 'Continental A-65');
const inl = shapes.find(s => s.name === 'Inline six');
const rad = shapes.find(s => s.name === 'Radial nine');
console.log();
ok('a flat four gives a WIDE shallow cowl', flat.w > flat.h,
   f(flat.w) + ' x ' + f(flat.h));
ok('an inline gives a NARROW deep cowl', inl.h > inl.w,
   f(inl.w) + ' x ' + f(inl.h));
ok('a radial gives a ROUND cowl', Math.abs(rad.w - rad.h) / rad.w < 0.25,
   f(rad.w) + ' x ' + f(rad.h));
ok('a radial cowl is shorter than an inline six\'s', rad.len < inl.len,
   f(rad.len) + ' vs ' + f(inl.len));

// the cowl only ever grows
Object.assign(C.P, { aftW: 3.0, aftH: 3.0, cowlLen: 3.0 });
const big = C.cowlApplyEngine(engResolve(CASES[0]).env);
ok('a loose cowl on a small engine is left alone',
   C.P.aftW === 3.0 && C.P.aftH === 3.0 && C.P.cowlLen === 3.0);
ok('  ...and reports that it already fits', big.fits);

// THE VERDICT CONTRACT (G67.1): this checker joins the battery, and the
// runner requires BOTH signals — the line and the exit code.
if (fail) console.log('\n  ' + fail + ' check(s) failed');
console.log('GATE COWL: ' + (fail ? 'FAIL' : 'PASS'));
process.exit(fail ? 1 : 0);
