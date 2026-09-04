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

// ---------------------------------------------------------------------------
// THE OIL DOOR, AND THE STUB THAT MAKES IT REACHABLE (2026-08-31)
// ---------------------------------------------------------------------------
// This checker had no THREE at all, so `buildDetail` — the fasteners, the
// parting line and the door — has never been held by anything. That was
// tolerable while the door was a fixed rectangle; it is not now that its
// outline is a SETTING, because "the slider does nothing" and "the slider
// works" look identical from here.
//
// buildDetail touches exactly four names, so the stub is four names. It
// records what was built rather than drawing it, which is all a shape check
// needs. Nothing else in this file uses THREE, so nothing else is affected.
{
  const V3 = function (x, y, z) { this.x = x; this.y = y; this.z = z; };
  const built = [];
  global.THREE = {
    Vector3: V3,
    BufferGeometry: function () {
      this.attributes = {}; this.index = null;
      this.setAttribute = (k, a) => { this.attributes[k] = a; };
      this.setIndex = i => { this.index = i; };
      this.computeVertexNormals = () => {};
    },
    Float32BufferAttribute: function (arr, itemSize) {
      this.array = arr; this.itemSize = itemSize;
      this.count = arr.length / itemSize;
    },
    Mesh: function (geo, mat) { built.push({ geo, mat }); this.geometry = geo; },
  };
  const group = { add: () => {} };
  const mats = { skin: 'skin', steel: 'steel', dark: 'dark' };

  const doorOf = () => {
    built.length = 0;
    Object.assign(C.P, { fastOn: 0, partOn: 0, oilOn: 1 });
    C.prepareLid();
    C.buildDetail(group, mats);
    // the door is the first skin mesh buildDetail emits
    const m = built.filter(b => b.mat === 'skin')[0];
    if (!m) return null;
    const a = m.geo.attributes.position.array, idx = m.geo.index;
    const pts = [];
    for (let i = 0; i < a.length; i += 3) pts.push([a[i], a[i + 1], a[i + 2]]);
    return { pts, idx, tris: idx.length / 3 };
  };

  Object.assign(C.P, { oilZ: 0.42, oilW: 0.13, oilL: 0.16, oilSq: 1 });
  const rect = doorOf();
  ok('the oil door is built at all', !!rect && rect.tris > 0,
     rect ? rect.tris + ' tris, ' + rect.pts.length + ' pts' : 'nothing emitted');

  if (rect) {
    // NO DEGENERATE FACES. A round outline meshed on a rectangular grid
    // collapses its end rows into slivers; this is the disc topology saying
    // it did not.
    const area = d => {
      let worst = 0, zero = 0;
      for (let t = 0; t < d.idx.length; t += 3) {
        const A = d.pts[d.idx[t]], B = d.pts[d.idx[t + 1]], C2 = d.pts[d.idx[t + 2]];
        const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
        const vx = C2[0] - A[0], vy = C2[1] - A[1], vz = C2[2] - A[2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const s = 0.5 * Math.hypot(nx, ny, nz);
        if (s < 1e-10) zero++;
        worst = Math.max(worst, s);
      }
      return { zero, worst };
    };
    const ar = area(rect);
    ok('no zero-area face on the door', ar.zero === 0,
       ar.zero + ' degenerate of ' + rect.tris);

    // THE ROUNDNESS IS REAL. A circle encloses pi/4 = 78.5% of the square it
    // fits in; a diamond half of it. Measured as the ratio of summed triangle
    // area to the door's own bounding rectangle, which needs no analytic form.
    const fill = d => {
      let A = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (let t = 0; t < d.idx.length; t += 3) {
        const a1 = d.pts[d.idx[t]], b1 = d.pts[d.idx[t + 1]], c1 = d.pts[d.idx[t + 2]];
        const ux = b1[0] - a1[0], uy = b1[1] - a1[1], uz = b1[2] - a1[2];
        const vx = c1[0] - a1[0], vy = c1[1] - a1[1], vz = c1[2] - a1[2];
        A += 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
      }
      for (const q of d.pts) {
        x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]);
        y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]);
        z0 = Math.min(z0, q[2]); z1 = Math.max(z1, q[2]);
      }
      // the door lies on the cowl's top deck: its span is (x, z)
      return A / Math.max(1e-9, (x1 - x0) * (z1 - z0));
    };
    const fRect = fill(rect);
    Object.assign(C.P, { oilSq: 0.5 }); const ell = doorOf();
    Object.assign(C.P, { oilSq: 0 });   const dia = doorOf();
    const fEll = fill(ell), fDia = fill(dia);
    // MEASURED ON THE MESH, so it is deliberately a RANKING and not a
    // constant. The door lies on the cowl's curved top deck, so its 3D area
    // against its projected box is not the flat superellipse ratio and never
    // will be — asserting pi/4 here would be a number that does not mean what
    // it says. What the mesh has to prove is that the row moves the shape in
    // the right direction; the ratio itself is proved below, where it is exact.
    ok('the roundness row is not inert', fRect > fEll + 0.05 && fEll > fDia + 0.1,
       'box fill ' + f(fRect) + ' > ' + f(fEll) + ' > ' + f(fDia));
    for (const d of [rect, ell, dia])
      ok('  ...and every door is finite',
         d.pts.every(q => q.every(Number.isFinite)));
    ok('  ...and none of them is degenerate',
       area(ell).zero === 0 && area(dia).zero === 0);
    Object.assign(C.P, { oilSq: 1 });

    // AND THE OUTLINE IS THE SHAPE IT CLAIMS, exactly, in the parameter domain
    // where the superellipse actually lives. Same `sqExp` and `superPt` the
    // door is built from, so this cannot drift away from it.
    //   n = 1  diamond  area/box = 1/2
    //   n = 2  ellipse  area/box = pi/4
    //   n = 10 (the default) = 0.9858, i.e. 1.4% shy of a true rectangle
    const outlineFill = sq => {
      const n = C.sqExp(sq), N = 2048;
      let A = 0;
      for (let j = 0; j < N; j++) {
        const a = C.superPt(C.TAU * j / N, 1, 1, n);
        const b = C.superPt(C.TAU * (j + 1) / N, 1, 1, n);
        A += 0.5 * (a[0] * b[1] - a[1] * b[0]);        // the shoelace
      }
      return Math.abs(A) / 4;                          // box is 2 x 2
    };
    ok('outline at roundness 0 is a diamond',
       Math.abs(outlineFill(0) - 0.5) < 0.002, f(outlineFill(0)) + ' vs 0.500');
    ok('outline at roundness 0.5 is a true ellipse',
       Math.abs(outlineFill(0.5) - Math.PI / 4) < 0.002,
       f(outlineFill(0.5)) + ' vs 0.785');
    ok('outline at roundness 1 is a rectangle to within 2%',
       outlineFill(1) > 0.98, f(outlineFill(1)) + ' vs 1.000');
  }
  delete global.THREE;
}

// ---- 3. THE COWL FOLLOWS THE ENGINE (G154) --------------------------------
// The user's scope: a round open cowl for radials, properly calibrated; the
// boxer keeps the bench default. So the properties to hold are (a) exactly one
// architecture changes anything, (b) what it produces CLEARS the engine, and
// (c) the size comes from the ENGINE rather than a copied literal — the last
// being the whole difference between "calibrated" and "a preset".
//
// `_cage_cowl.js` is a browser layer, but its module scope touches no THREE
// (the materials are lazy, behind `mats()`), so a `window` carrying the two
// tables it reads is enough to load it and get the pure function out.
{
  const rowsSrc = fs.readFileSync(path.join(__dirname, '_cowl_rows.js'), 'utf8');
  const COWL_ROWS = new Function(rowsSrc + '\nreturn COWL_ROWS;')();
  const win = { COWL_GEN: C, COWL_ROWS, CAGE_PAGE: {} };
  const layer = fs.readFileSync(path.join(__dirname, '_cage_cowl.js'), 'utf8');
  new Function('window', 'document', layer)(win, { getElementById: () => null });
  const FOR = win.CAGE_COWL_FOR_ENGINE;
  ok('the cowl layer publishes its engine rule', typeof FOR === 'function');

  if (typeof FOR === 'function') {
    // A SMALL radial for the fitting case and a BIG one for the comparison,
    // both clear of the taper's 1.15 cap on this firewall — a fixture sitting
    // ON the cap would compare 1.15 against 1.15 and prove nothing about
    // whether the size is derived at all.
    const radial = engResolve({ arch: 'radial', cyl: 7, bore: 0.115,
                                stroke: 0.130, rpm: 2200 });
    const flat = engResolve({ arch: 'flat', cyl: 4, bore: 0.103,
                              stroke: 0.098, rpm: 2300 });
    const bigFace = { halfW: 0.62, halfH: 0.62 };
    const smallFace = { halfW: 0.30, halfH: 0.28 };

    // 2026-09-04: a boxer keeps its STYLE and takes the engine's SIZE (the
    // user: "systematically too short, and not wide enough")
    const fb = FOR('flat', flat.env, bigFace);
    ok('a boxer gets the engine\'s size and nothing of the radial\'s style',
       !!fb && fb.vals.cw_cowlLen > 0 && fb.vals.cw_taperW > 0 &&
       fb.vals.fitNose === undefined && fb.vals.cw_apMode === undefined &&
       fb.vals.cw_lidLen === undefined);
    ok('...its barrel runs the engine\'s own length (+10 %)',
       !!fb && Math.abs(fb.vals.cw_cowlLen - Math.min(2, flat.env.length * 1.10)) < 2e-3);
    ok('...and so do inline and electric',
       !!FOR('inline', flat.env, bigFace) && !!FOR('electric', flat.env, bigFace));

    const r = FOR('radial', radial.env, bigFace);
    ok('a radial gets a cowl', !!r);
    if (r) {
      ok('it is SEALED, not fitted — a fitted cowl takes the fuselage section ' +
         'and would square the round cowl being asked for',
         r.vals.fitNose === 2);
      ok('its section is round at both ends',
         r.vals.cw_sqAftTop === 0.5 && r.vals.cw_sqFrontTop === 0.5 &&
         r.vals.cw_sqAftBot === 0.5 && r.vals.cw_sqFrontBot === 0.5);
      ok("one annular inlet on the axis, not the boxer's pair",
         r.vals.cw_apMode === 1 && r.vals.cw_apSq === 0.5);
      ok('a rolled lip, and no chin scoop',
         r.vals.cw_lipMode === 1 && r.vals.cw_scoopOn === 0);
      ok("it does not touch the firewall size — that is fitNose's",
         r.vals.cw_aftW === undefined && r.vals.cw_aftH === undefined);
      ok('it leaves the CUT-OUT alone: an engine implies a size, not a style',
         r.vals.cw_cutSpan === undefined && r.vals.cw_cutAz === undefined);
      ok('THE BARREL CLEARS THE ENGINE', r.front >= r.need - 1e-9,
         f(r.front * 2) + ' m across vs ' + f(r.need * 2) + ' needed');
      ok('...with a real clearance over the heads, not a hug',
         r.need > radial.env.radius, f(r.need) + ' vs ' + f(radial.env.radius));
      ok('no note when it fits', r.note === null);
    }

    // CALIBRATED, NOT COPIED: a bigger engine must give a bigger cowl off the
    // SAME firewall. A copied literal would produce identical numbers twice.
    const big = engResolve({ arch: 'radial', cyl: 9, bore: 0.20,
                             stroke: 0.22, rpm: 1800 });
    const rb = FOR('radial', big.env, bigFace);
    ok('a bigger radial takes a wider barrel off the same firewall',
       !!rb && r && rb.vals.cw_taperW > r.vals.cw_taperW,
       r ? 'taper ' + r.vals.cw_taperW + ' -> ' + rb.vals.cw_taperW : '');
    ok('...and a longer one', !!rb && r && rb.vals.cw_cowlLen > r.vals.cw_cowlLen,
       r ? f(r.vals.cw_cowlLen) + ' -> ' + f(rb.vals.cw_cowlLen) : '');

    // IT STILL LOOKS LIKE THE PRESET THE USER APPROVED. The shape was taken
    // from "NACA cowl, radial" and the SIZE was replaced by a derivation, so
    // the thing that could quietly drift is the PROPORTIONS — and those are
    // the whole of why that preset was the one that read right ("most were
    // rubbish, but the radial one was OK"). Held against the preset's own
    // numbers rather than against three constants written down here, so
    // editing the constants without re-deriving from the preset goes red.
    const NACA = C.PRESETS && C.PRESETS['NACA cowl, radial'];
    ok('the approved radial preset is still in the table', !!NACA);
    if (NACA && r) {
      const q = NACA.p, pFront = q.aftW * q.taperW;
      const band = (a, b, tol, what) =>
        ok('proportion holds: ' + what, Math.abs(a - b) <= tol,
           f(a, 3) + ' vs the preset\'s ' + f(b, 3));
      band(r.vals.cw_apW / r.front, q.apW / pFront, 0.02, 'inlet / barrel');
      band(r.vals.cw_lidR / r.front, q.lidR / pFront, 0.02, 'lid radius / barrel');
      band(r.vals.cw_lidLen / r.vals.cw_cowlLen, q.lidLen / q.cowlLen, 0.02,
           'lid length / cowl length');
    }

    // AND IT SAYS SO WHEN IT CANNOT. A small nose cannot wear a big radial;
    // drawing the cylinders through the shell in silence is the failure this
    // reports instead.
    const tight = FOR('radial', big.env, smallFace);
    ok('a firewall too small for the engine is REPORTED, not drawn silently',
       !!tight && typeof tight.note === 'string' && tight.note.length > 0,
       tight && tight.note ? tight.note : '(no note)');
    ok("...and the taper still stops at the row's own limit",
       !!tight && tight.vals.cw_taperW <= 1.30 + 1e-9,   // the row's hi (1.30 since 2026-09-04)
       tight ? String(tight.vals.cw_taperW) : '');
  }
}

// THE VERDICT CONTRACT (G67.1): this checker joins the battery, and the
// runner requires BOTH signals — the line and the exit code.
if (fail) console.log('\n  ' + fail + ' check(s) failed');
console.log('GATE COWL: ' + (fail ? 'FAIL' : 'PASS'));
process.exit(fail ? 1 : 0);
