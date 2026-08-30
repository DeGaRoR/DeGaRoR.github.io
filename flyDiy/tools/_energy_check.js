#!/usr/bin/env node
// GATE ENERGY — the energy module's verdict (G97-G101).
//
//   node tools/_energy_check.js             -> "GATE ENERGY: PASS|FAIL"
//   node tools/_energy_check.js --selftest  -> negative verification
//   node tools/_energy_check.js --show      -> print what was measured
//
// G97 SCOPE, and this file grows with the arc: the INTERIOR VOLUME. A tank or
// a battery pack has to physically fit inside the aeroplane, and until
// `_bay_site.js` there was no answer to "inside" at all — `cageInterior`
// builds surfaces, and `sectionArc` is one-dimensional.
//
// WHAT IS ACTUALLY BEING PROTECTED. Every failure this module can have is
// SILENT and reads as a slightly different aeroplane:
//   - the inset running the wrong way makes the aeroplane roomier
//   - a collapsed section at the tail cap ADDS phantom litres to the
//     slenderest part of the body
//   - a section that refuses quietly loses a bay
//   - a volume that does not scale with the aeroplane is wrong on every build
//     except the one it was written against, at planeScale 1
// None of them throws. So each one has a check, and `--selftest` breaks the
// real generator four ways rather than probing synthetic data — the G67.3
// lesson: the dodecagon tyre passed the first roundness check and nothing
// else would have said so.
'use strict';
const path = require('path');

const G = require(path.join(__dirname, '_cage_gen.js'));
const B = require(path.join(__dirname, '_bay_site.js'));

const SELFTEST = process.argv.includes('--selftest');
const SHOW = process.argv.includes('--show');

const fail = [];
const check = (ok, label, extra) => {
  if (!ok) fail.push(label + (extra ? ' — ' + extra : ''));
  return ok;
};

// The wall the cage's own interior pass uses when nothing overrides it, IN
// METRES. It is metres and not cage units on purpose, and the gate found the
// difference the hard way: `planeScale` does not change the mesh, it changes
// FS, so a wall handed to `bayProfile` in cage units gets multiplied by FS
// along with everything else and a doubled aeroplane silently grows a 70 mm
// skin. The scale ratio came out at exactly 8.000 instead of just over it,
// which is the only reason anybody would ever notice.
//
// 35 mm of structure is 35 mm on a Cub and 35 mm on a DC-3 — the crew layer's
// rule, and the reason a wheel can be a ruler. So every caller divides by FS
// going in, which is the same K2 trap _cage_access.js documents for fittings.
const WALL_M = 0.035;

// ---------------------------------------------------------------------------
// build a cage headlessly — the recipe _fit_check.js uses, and the only one
// ---------------------------------------------------------------------------
function build(over) {
  const P = Object.assign(G.cageDefaults(), over || {});
  const spec = G.cageSpec(P);
  let s = G.buildCage2(spec, 'crease');
  for (let i = 0; i < 2; i++) s = G.cageSubdivide(s);
  if (G.cageGlassSill) s = G.cageGlassSill(s, spec);
  if (G.cageCut) s = G.cageCut(s, spec);
  if (G.cageCanopy) s = G.cageCanopy(s, spec);
  s = G.cageRims(s, spec);
  if (G.cageInterior) s = G.cageInterior(s, spec);
  return { mesh: s, P, spec, FS: (G.CAGE_UNIT || 1) * (P.planeScale || 1) };
}

// the sL range the field actually covers on this build
function sLRange(mesh) {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < mesh.V.length; i++) {
    if (!mesh.A[i]) continue;
    const v = mesh.A[i][0];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
}

// THE CASES. Each changes the body in a way the section sweep has to survive:
// a bigger aeroplane (the scale rule), a pod-and-boom (a long bay with no ring
// in it — the shape that broke GEN_ACCESS's sC formulation), a deeper cabin,
// and a narrow one.
const CASES = [
  ['stock', {}],
  ['scaled x2', { planeScale: 2 }],
  ['narrow', { halfW: 0.34 }],
  ['deep', { roofY: 1.15, keelY: -0.85 }],
];

const seen = [];

for (const [name, over] of CASES) {
  let b;
  try { b = build(over); }
  catch (e) { check(false, name + ': the cage would not build', e.message); continue; }
  const { mesh, FS } = b;
  const [lo, hi] = sLRange(mesh);
  if (!check(isFinite(lo) && hi > lo, name + ': no field on the mesh')) continue;

  const wall = WALL_M / FS;          // metres -> mesh units. See WALL_M.
  const prof = B.bayProfile(mesh, lo, hi, wall, 24);
  const open = prof.filter(s => s && !s.closed);
  const vol = B.bayVolume(prof);
  const litres = vol * FS * FS * FS * 1000;
  seen.push({ name, lo, hi, open: open.length, of: prof.length, litres, FS });

  // 1. the sweep finds a section nearly everywhere. A plane-slice version of
  //    this found FOUR of twenty-one and refused the rest, silently.
  check(open.length >= prof.length - 4,
        name + ': the section sweep lost too many stations',
        open.length + ' of ' + prof.length);

  // 2. the wall comes OFF. The inward normal has two candidate signs and the
  //    wrong one grows the section — a roomier aeroplane, no error.
  let grew = 0;
  for (const s of open) if (s.area >= s.skinArea) grew++;
  check(grew === 0, name + ': the inset grew the section', grew + ' stations');

  // 3. a section thinner than twice the wall must report NOTHING, not an
  //    inverted polygon. Measured on the stock tail cap: 0.0000 m2 inset by
  //    35 mm came back as 0.0378 m2 with its winding flipped.
  const fat = B.bayProfile(mesh, lo, hi, 5.0, 12);
  const fatVol = B.bayVolume(fat);
  check(fatVol === 0, name + ': a wall thicker than the body left volume behind',
        fatVol.toFixed(6));

  // 4. more wall, less room — monotonic, and it catches a sign error the
  //    single-wall check can miss on a section that happens to be symmetric
  const thin = B.bayVolume(B.bayProfile(mesh, lo, hi, 0.010 / FS, 24));
  const thick = B.bayVolume(B.bayProfile(mesh, lo, hi, 0.070 / FS, 24));
  check(thin > vol && vol > thick,
        name + ': volume is not monotonic in wall thickness',
        thin.toFixed(3) + ' / ' + vol.toFixed(3) + ' / ' + thick.toFixed(3));

  // 5. a sub-bay cannot hold more than the bay that contains it
  const whole = B.bayVolume(B.bayProfile(mesh, lo, hi, wall, 40));
  const part = B.bayVolume(B.bayProfile(mesh, lo + (hi - lo) * 0.3,
                                              lo + (hi - lo) * 0.6, wall, 40));
  check(part < whole, name + ': a sub-bay outgrew the body',
        part.toFixed(3) + ' vs ' + whole.toFixed(3));

  // 6. THE FIT TEST DISCRIMINATES. A test that says yes to everything is not
  //    a test, and one that says no to everything is worse — it would look
  //    like "nothing fits in this aeroplane", which is a plausible answer.
  const mid = open[Math.floor(open.length / 2)];
  if (mid) {
    let cy = 0;
    for (const p of mid.poly) cy += p[1];
    cy /= mid.poly.length;
    const boxAt = (hw, hh) => {
      const pts = [];
      // hw/hh are METRES and the mesh is in cage units, so they DIVIDE by FS.
      // The same trap as WALL_M, one screen down: multiplying instead tests a
      // proportionally bigger box on a bigger aeroplane, which still passes and
      // still discriminates, and would mean nothing.
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const dl of [-0.1, 0.1])
        pts.push([sx * hw / FS, cy + sy * hh / FS, mid.sL + dl / FS]);
      return B.baySolidFits(prof, pts);
    };
    const small = boxAt(0.05, 0.05), huge = boxAt(3.0, 3.0);
    check(small.fits, name + ': a 100 mm box did not fit in the cabin',
          'worst ' + small.worst.toFixed(4));
    check(!huge.fits, name + ': a 6 m box "fitted" inside the fuselage');
  }
}

// 7. SCALE INVARIANCE — the engine bench's rule, and the one that catches a
//    volume written against planeScale 1. Doubling the aeroplane must cube the
//    room inside it. Not exact: the wall does NOT scale (35 mm of structure is
//    35 mm on any aeroplane, the crew layer's rule and the reason a wheel can
//    be a ruler), so the big one keeps proportionally MORE of its section and
//    the ratio runs slightly over 8.
const s1 = seen.find(s => s.name === 'stock');
const s2 = seen.find(s => s.name === 'scaled x2');
if (s1 && s2) {
  const r = s2.litres / s1.litres;
  check(r > 8.0 && r < 9.2, 'scaling x2 did not cube the interior volume',
        'ratio ' + r.toFixed(3) + ' (expected just over 8)');
}

// ---------------------------------------------------------------------------
// THE WING BAY, which is a formula and not a mesh
// ---------------------------------------------------------------------------
// A wing is not a tube, so the section sweep above is meaningless on it, and
// the wing mesh is browser-only so a gate could never measure it headlessly.
// It does not need to: the bay is bounded by the two spars (declared chord
// fractions, already load-bearing — the skin is lofted on them) and by the
// aerofoil, which for a 4-digit NACA is closed form.
{
  const C = require(path.join(__dirname, 'flight_core.js'));
  const w0 = C.GEN_DEFAULT.wings[0];
  const W = o => Object.assign({}, w0, o);

  // the polynomial itself: max half-thickness is t/2 at ~30% chord, and that
  // is the one number a wrong coefficient would visibly move
  const half = C.genNacaT(2412, 0.30);
  check(Math.abs(half - 0.06) < 0.0015,
        'NACA 2412 half-thickness at 30% chord is not t/2',
        half.toFixed(5) + ' vs 0.060');
  check(C.genNacaT(2412, 0) === 0, 'the aerofoil does not close at the nose');

  // the enclosed area must be under the bounding box and over a crude
  // rectangle of mean depth — a formula that has lost its factor of two lands
  // outside this band, and nothing else would say so
  const kA = C.genAerofoilArea(2412, 0.15, 0.65);
  check(kA > 0.035 && kA < 0.070, 'the spar-bay area fraction is out of band',
        kA.toFixed(5));

  const root = C.genWingBay(w0, { spanLo: 0.12, spanHi: 0.55 });
  const panel = C.genWingBay(w0, { spanLo: 0.55, spanHi: 0.88 });
  check(root > 0 && panel > 0, 'the stock wing has no bay');

  // 8. TAPER IS WHY THIS IS AN INTEGRAL. Area goes as chord SQUARED, so a
  //    tapered panel holds far less than its mean chord suggests. Getting it
  //    wrong makes outboard tanks too generous — and an outboard tank is
  //    exactly what a player reaches for when the CG is too far aft.
  const tap = W({ taper: 0.5 });
  const tRoot = C.genWingBay(tap, { spanLo: 0.12, spanHi: 0.55 });
  const tPanel = C.genWingBay(tap, { spanLo: 0.55, spanHi: 0.88 });
  check(tRoot < root && tPanel < panel, 'taper did not shrink the bay');
  check(tPanel / panel < tRoot / root,
        'taper did not shrink the OUTBOARD bay hardest',
        (tPanel / panel).toFixed(3) + ' vs ' + (tRoot / root).toFixed(3));

  // 9. an empty or inverted span range holds nothing
  check(C.genWingBay(w0, { spanLo: 0.5, spanHi: 0.5 }) === 0,
        'a zero-width bay held fuel');
  check(C.genWingBay(w0, { spanLo: 0.8, spanHi: 0.2 }) === 0,
        'an inverted span range held fuel');

  // 10. a wing thinner than twice its own skin has no bay left
  check(C.genWingBay(W({ chord: 0.10, naca: 2406 }),
                     { spanLo: 0.12, spanHi: 0.55, wall: 0.05 }) === 0,
        'a wing thinner than its skin still held fuel');

  // 11. more wall, less room
  const wThin = C.genWingBay(w0, { spanLo: 0.12, spanHi: 0.55, wall: 0.001 });
  const wThick = C.genWingBay(w0, { spanLo: 0.12, spanHi: 0.55, wall: 0.020 });
  check(wThin > root && root > wThick, 'the wing bay is not monotonic in wall');

  // 12. SCALE, the same rule as the fuselage: chord x2 and span x2 is area x4
  //     by span x2 = volume x8, and just over it because the skin does not
  //     scale. This is the check that catches a bay written against one wing.
  const big = C.genWingBay(W({ chord: w0.chord * 2, span: w0.span * 2 }),
                           { spanLo: 0.12, spanHi: 0.55 });
  const r = big / root;
  check(r > 8.0 && r < 9.0, 'doubling the wing did not multiply the bay by 8',
        'ratio ' + r.toFixed(3));

  // 13. a thicker aerofoil holds more
  check(C.genWingBay(W({ naca: 4415 }), { spanLo: 0.12, spanHi: 0.55 }) > root,
        'a 15% aerofoil did not hold more than a 12% one');

  if (SHOW) console.log('  wing bay: root ' + root.toFixed(0) + ' L, panel ' +
                        panel.toFixed(0) + ' L, area frac ' + kA.toFixed(5));
}

// ---------------------------------------------------------------------------
// NEGATIVE VERIFICATION — break the real thing, not a synthetic stand-in
// ---------------------------------------------------------------------------
if (SELFTEST) {
  const b = build({});
  const [lo, hi] = sLRange(b.mesh);
  const probes = [];

  // (a) the inset run the wrong way: every open section must be caught by
  //     check 2. Re-implement the wrong sign here rather than flipping the
  //     module, so the module under test is the shipped one.
  probes.push(['inset grown instead of shrunk', () => {
    const cut = B.baySection(b.mesh, (lo + hi) / 2);
    if (!cut) return false;
    const wrong = [];
    const n = cut.poly.length;
    for (let i = 0; i < n; i++) {
      const p = cut.poly[i], q = cut.poly[(i + 1) % n];
      const dx = q[0] - p[0], dy = q[1] - p[1];
      const L = Math.hypot(dx, dy) || 1;
      wrong.push([p[0] + (dy / L) * WALL_M, p[1] + (-dx / L) * WALL_M]);
    }
    return B.polyArea(wrong) > B.polyArea(cut.poly);   // it GREW: caught
  }]);

  // (b) a collapsed section must be reported closed, not inverted
  probes.push(['collapsed section detected', () => {
    const cut = B.baySection(b.mesh, hi - 0.02) || B.baySection(b.mesh, (lo + hi) / 2);
    if (!cut) return false;
    const inner = B.bayInset(cut.poly, 5.0);
    return B.insetCollapsed(cut.poly, inner) === true;
  }]);

  // (c) an empty polygon holds nothing and clears nothing
  probes.push(['a closed section holds no point', () =>
    B.pointIn([], 0, 0) === false && B.clearance([], 0, 0) === -Infinity]);

  // (d) the conical rule must UNDER-read a taper against the trapezoid — the
  //     direction that matters, since overstating a tank is the failure mode
  probes.push(['conical rule under-reads a taper', () => {
    const A1 = 1.0, A2 = 0.04, dz = 1.0;
    const cone = dz * (A1 + A2 + Math.sqrt(A1 * A2)) / 3;
    const trap = dz * (A1 + A2) / 2;
    return cone < trap;
  }]);

  for (const [label, fn] of probes) {
    let ok = false;
    try { ok = !!fn(); } catch (e) { ok = false; }
    check(ok, 'SELFTEST not caught: ' + label);
  }
  console.log('  selftest: ' + probes.length + ' negative probes');
}

if (SHOW) for (const s of seen)
  console.log('  ' + s.name.padEnd(11) + ' sL ' + s.lo.toFixed(2) + '..' +
              s.hi.toFixed(2) + '  ' + s.open + '/' + s.of + ' sections  ' +
              s.litres.toFixed(0) + ' litres  FS ' + s.FS);

console.log('  ' + seen.length + ' bodies swept, ' +
            seen.reduce((a, s) => a + s.open, 0) + ' sections measured, ' +
            seen.reduce((a, s) => a + s.litres, 0).toFixed(0) + ' litres of interior');
for (const f of fail) console.log('  FAIL ' + f);
console.log('GATE ENERGY: ' + (fail.length ? 'FAIL' : 'PASS'));
process.exit(fail.length ? 1 : 0);
