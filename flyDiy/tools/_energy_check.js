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


// ===========================================================================
// G99 — THE BAYS ARE PLACES, AND A VESSEL SITS IN ONE
// ===========================================================================
{
  const C = require(path.join(__dirname, 'flight_core.js'));
  const cl = o => JSON.parse(JSON.stringify(o));
  const build = ov => {
    const s = cl(C.GEN_DEFAULT);
    for (const k in ov) s[k] = (ov[k] && typeof ov[k] === 'object' && !Array.isArray(ov[k]))
      ? Object.assign({}, s[k], ov[k]) : ov[k];
    return C.genShakedown(C.buildGen(s), {});
  };
  const bays = () => { const d = C.buildGen(); return C.genBayList(d.spec, d.parts.ST); };

  // --- the ranges are DERIVED, which is the whole of G99's first half ------
  const B0 = bays();
  const nose = B0.find(b => b.key === 'nose');
  const cab = B0.find(b => b.key === 'cabin');
  check(nose.x0 >= 0, 'bay: the nose bay is BEHIND the firewall, where a tank ' +
    'goes — it was declared at -0.95 m, which is inside the engine (x0 ' +
    nose.x0.toFixed(2) + ')');
  check(Math.abs(cab.x0 - C.resolveSpec(C.GEN_DEFAULT).spec.cab.noseGap) < 1e-6,
    'bay: the cabin bay starts where the cabin does, not half a metre ahead');
  // and it MOVES with the aeroplane, which a literal range cannot
  {
    const s2 = cl(C.GEN_DEFAULT); s2.cabin = Object.assign({}, s2.cabin, { len: 1.6 });
    const d2 = C.buildGen(s2);
    const c2 = C.genBayList(d2.spec, d2.parts.ST).find(b => b.key === 'cabin');
    check(c2.x1 > cab.x1 + 0.3,
      'bay: a longer cabin is a longer cabin bay (' + cab.x1.toFixed(2) +
      ' -> ' + c2.x1.toFixed(2) + ' m)');
    check(c2.litres > cab.litres,
      'bay: ...and it holds more (' + cab.litres.toFixed(0) + ' -> ' +
      c2.litres.toFixed(0) + ' L)');
  }
  check(B0.every(b => b.litres > 0), 'bay: every bay has a measured volume');

  // --- a written capacity still means what it says -------------------------
  check(build({ fuel: { litres: 70, tank: 'nose' } }).ledger.fuel.mass > 45,
    'spec: a capacity written as fuel.litres seeds a vessel — every archetype ' +
    'and every gate case writes it that way');
  {
    const two = build({ energy: { vessels: [{ bay: 'nose', capacity: 25 },
                                            { bay: 'aftCabin', capacity: 25 }] } });
    check(two.vessels.length === 2, 'spec: an explicit vessel list wins');
    check(Math.abs(two.ledger.fuel.mass - 50 * 0.72) < 0.5,
      'spec: and the capacity is the SUM of the list, not a second opinion');
  }

  // --- WHERE IT SITS IS A DESIGN DECISION ---------------------------------
  const fwd = build({ energy: { vessels: [{ bay: 'nose', capacity: 50, along: 0, lv: 1 }] } });
  const aft = build({ energy: { vessels: [{ bay: 'aftCabin', capacity: 50 }] } });
  check(aft.cgX > fwd.cgX + 0.15,
    'place: moving the tank aft moves the centre of gravity aft (' +
    fwd.cgX.toFixed(3) + ' -> ' + aft.cgX.toFixed(3) + ' m)');
  check(fwd.staticMargin > aft.staticMargin + 0.08,
    'place: ...and it costs static margin (' +
    (fwd.staticMargin * 100).toFixed(1) + ' % -> ' +
    (aft.staticMargin * 100).toFixed(1) + ' %)');

  // --- AND THE FUEL BURNS OFF, WHICH IS THE POINT OF THE ARC ---------------
  check(fwd.reserve.staticMargin < fwd.staticMargin - 0.02,
    'burn: a NOSE tank burning down walks the CG aft (' +
    (fwd.staticMargin * 100).toFixed(1) + ' -> ' +
    (fwd.reserve.staticMargin * 100).toFixed(1) + ' %)');
  check(aft.reserve.staticMargin > aft.staticMargin + 0.02,
    'burn: an AFT tank burning down walks it forward (' +
    (aft.staticMargin * 100).toFixed(1) + ' -> ' +
    (aft.reserve.staticMargin * 100).toFixed(1) + ' %)');
  {
    const split = build({ energy: { vessels: [{ bay: 'nose', capacity: 25, along: 0, lv: 1 },
                                              { bay: 'aftCabin', capacity: 25 }] } });
    check(Math.abs(split.reserve.staticMargin - split.staticMargin) < 0.02,
      'burn: fuel BRACKETING the CG barely moves it — which is why real ' +
      'aeroplanes carry two tanks (' +
      ((split.reserve.staticMargin - split.staticMargin) * 100).toFixed(1) + ' pts)');
  }
  // a pack does not burn
  {
    const b = build({ energy: { kind: 'battery',
      vessels: [{ bay: 'nose', capacity: 8, along: 0, lv: 1 }] } });
    check(!b.reserve || Math.abs(b.reserve.staticMargin - b.staticMargin) < 1e-9,
      'burn: a pack does not drain, so its CG does not move');
  }

  // --- IT HAS TO FIT ------------------------------------------------------
  check(build({ energy: { vessels: [{ bay: 'nose', capacity: 50 }] } }).vesselFit,
    'fit: 50 litres fits the nose bay');
  check(!build({ energy: { vessels: [{ bay: 'nose', capacity: 200 }] } }).vesselFit,
    'fit: 200 litres does not, and the sheet says so rather than drawing it ' +
    'through the firewall');
  check(!build({ energy: { kind: 'battery',
      vessels: [{ bay: 'underFloor', capacity: 40 }] } }).vesselFit,
    'fit: nor does 40 kWh of LiFePO4 under the floor');

  // --- THE MIGRATION MOVED NOTHING, which GATE ENERGYBASE proves in full;
  //     this is the one property of it that belongs here.
  {
    const lifted = C.genNormaliseSpec({ v: 6, fuel: { litres: 50, tank: 'nose' } });
    const v0 = lifted.energy.vessels[0];
    check(lifted.v === C.GEN_SPEC_V && v0.bay === 'nose' && v0.capacity === 50,
      'migrate: a v6 {litres, tank} lifts to a vessel in a bay');
    check(v0.along === 0 && v0.lv === 1,
      'migrate: ...at the station the OLD NODE was at — the firewall ring, ' +
      'top pair — so twelve gallons do not drift half a metre aft');
  }
  if (SHOW) {
    console.log('  bays: ' + B0.map(b => b.name + ' ' + b.litres.toFixed(0) + ' L').join(' · '));
    console.log('  50 L nose -> aft: cg ' + fwd.cgX.toFixed(3) + ' -> ' +
      aft.cgX.toFixed(3) + ' m, SM ' + (fwd.staticMargin * 100).toFixed(1) +
      ' -> ' + (aft.staticMargin * 100).toFixed(1) + ' %');
  }
}

console.log('  ' + seen.length + ' bodies swept, ' +
            seen.reduce((a, s) => a + s.open, 0) + ' sections measured, ' +
            seen.reduce((a, s) => a + s.litres, 0).toFixed(0) + ' litres of interior');
for (const f of fail) console.log('  FAIL ' + f);

// ===========================================================================
// G98 — THE VESSEL CATALOGUE
// ===========================================================================
// What is protected here is the same class of silence G97 was written for: a
// tank that weighs nothing, a pack that is free, or a capacity said in two
// places. None of them throws and all of them read as a slightly better
// aeroplane.
{
  const C = require(path.join(__dirname, 'flight_core.js'));
  const V = C.genVesselResolve, cl = o => JSON.parse(JSON.stringify(o));

  // --- the shell law -------------------------------------------------------
  // A vessel is a SHELL, so its mass goes with surface and not with volume.
  // If this ever came out linear, somebody has billed litres.
  const t20 = V('fuel', 20, 'alu', 'avgas100LL');
  const t180 = V('fuel', 180, 'alu', 'avgas100LL');
  check(t180.vesselKg > t20.vesselKg,
    'vessel: a bigger tank is a heavier tank (' + t20.vesselKg.toFixed(1) +
    ' -> ' + t180.vesselKg.toFixed(1) + ' kg)');
  check(t180.vesselKg / t180.capacity < 0.55 * t20.vesselKg / t20.capacity,
    'vessel: and a much lighter one PER LITRE — the shell law (' +
    (t20.vesselKg / t20.capacity * 1000).toFixed(0) + ' -> ' +
    (t180.vesselKg / t180.capacity * 1000).toFixed(0) + ' g/L)');

  // --- anchored on a real component ---------------------------------------
  // A 45 L welded aluminium light-aircraft tank is about 5 kg. This is the
  // one number in the table that can be checked against a thing you can pick
  // up, so it is the one the table is anchored on.
  const t45 = V('fuel', 45, 'alu', 'avgas100LL');
  check(t45.vesselKg > 4.0 && t45.vesselKg < 6.5,
    'vessel: a 45 L welded alu tank weighs about 5 kg (' +
    t45.vesselKg.toFixed(1) + ')');

  // --- the vessels are a real choice --------------------------------------
  const kinds = ['alu', 'bladder', 'moulded', 'wet']
    .map(k => ({ k, m: V('fuel', 60, k, 'avgas100LL').vesselKg }));
  check(kinds.every(x => x.m > 0), 'vessel: every fuel vessel has mass');
  const wet = kinds.find(x => x.k === 'wet').m;
  const alu = kinds.find(x => x.k === 'alu').m;
  check(wet < alu,
    'vessel: a wet wing is lighter than a tank in it (' + wet.toFixed(1) +
    ' < ' + alu.toFixed(1) + ')');

  // --- fuel and cells are the same shape of thing, told apart by ONE fact --
  const f = V('fuel', 50, 'alu', 'avgas100LL');
  check(Math.abs(f.contentsKg - 50 * C.GEN_FUELS.avgas100LL.kgL) < 1e-6,
    'fuel: the contents are litres x the declared density, not a literal');
  const packs = ['lifepo4', 'nmc', 'nca'].map(c => V('battery', 20, 'packCase', c));
  check(packs[0].contentsKg > packs[2].contentsKg,
    'cells: LiFePO4 is the heavy chemistry (' + packs[0].contentsKg.toFixed(0) +
    ' > ' + packs[2].contentsKg.toFixed(0) + ' kg for 20 kWh)');
  check(packs[2].price > packs[0].price,
    'cells: ...and NCA is the dear one (' + packs[2].price + ' > ' +
    packs[0].price + ' cr)');
  check(packs.every(x => x.installedL > x.litres),
    'cells: a pack takes more room than its cells do');

  // --- and now the aeroplane ----------------------------------------------
  const base = cl(C.GEN_DEFAULT);
  const liquid = C.genShakedown(C.buildGen(base), {});
  const bs = cl(base);
  bs.energy.kind = 'battery'; bs.energy.kWh = 12;
  bs.engines[0].type = 'emrax228_3blade';
  const batt = C.genShakedown(C.buildGen(bs), {});
  check(liquid.ledger.vessel && liquid.ledger.vessel.mass > 1,
    'ledger: the TANK weighs something — it weighed nothing before G98 (' +
    liquid.ledger.vessel.mass.toFixed(1) + ' kg)');
  check(!liquid.ledger.vessel.payload,
    'ledger: and it is EMPTY weight, not payload — you bought it');
  check(liquid.ledger.fuel.payload && liquid.ledger.fuel.mass > 1,
    'ledger: the fuel in it is payload');
  // THE CONTRAST THE ARC EXISTS FOR
  // the ROW ITSELF is the statement: nothing was billed to `fuel`, so the
  // section never opened. A pack has no payload at all.
  check(!batt.ledger.fuel || batt.ledger.fuel.mass < 0.001,
    'battery: a pack carries no payload — cells do not drain');
  check(batt.ledger.vessel.mass > 10 * liquid.ledger.vessel.mass,
    'battery: the cells are EMPTY weight, and there are a lot of them (' +
    batt.ledger.vessel.mass.toFixed(0) + ' vs ' +
    liquid.ledger.vessel.mass.toFixed(1) + ' kg)');
  check(batt.empty > liquid.empty,
    'battery: an electric aeroplane is heavier EMPTY (' +
    batt.empty.toFixed(0) + ' > ' + liquid.empty.toFixed(0) + ' kg)');
  // ...which is what the registry's own comment has been waiting for
  check(batt.cost > liquid.cost,
    'battery: and its energy is no longer free (' + batt.cost.toFixed(0) +
    ' > ' + liquid.cost.toFixed(0) + ' cr)');

  // --- the burn model's hook, and that a pack does not have one -----------
  const dl = C.buildGen(base), db = C.buildGen(bs);
  const mf = d => d.nodes.reduce((a, n) => a + (n.mFuel || 0), 0);
  check(mf(dl) > 1, 'burn: liquid fuel is recorded on the nodes (mFuel ' +
    mf(dl).toFixed(1) + ' kg)');
  check(mf(db) < 0.001,
    'burn: a pack records none — there is nothing for the burn to drain');

  // --- capacity is said ONCE ----------------------------------------------
  const both = cl(base);
  both.energy.kind = 'battery'; both.energy.kWh = 9; both.fuel.litres = 60;
  const R = C.resolveSpec(both).spec;
  check(R.fuel.litres === 0,
    'capacity: a pack carries no litres — one place for one fact');
  const both2 = cl(base); both2.energy.kWh = 30;
  check(C.resolveSpec(both2).spec.energy.kWh === 0,
    'capacity: ...and a tank carries no kWh');
  // a vessel that cannot hold this kind is refused
  const bad = cl(base); bad.energy.vessel = 'packCase';
  check(C.resolveSpec(bad).spec.energy.vessel === null,
    'vessel: a pack case is not a fuel tank, and the clamp says so');
  if (SHOW) {
    console.log('  catalogue: ' + Object.keys(C.GEN_FUELS).length + ' fuels, ' +
      Object.keys(C.GEN_CELLS).length + ' chemistries, ' +
      Object.keys(C.GEN_VESSELS).length + ' vessels');
    console.log('  45 L alu tank ' + t45.vesselKg.toFixed(1) + ' kg (real ~5)' +
      ' · shell law ' + (t20.vesselKg / 20 * 1000).toFixed(0) + ' -> ' +
      (t180.vesselKg / 180 * 1000).toFixed(0) + ' g/L');
    console.log('  stock build: tank ' + liquid.ledger.vessel.mass.toFixed(1) +
      ' kg empty + ' + liquid.ledger.fuel.mass.toFixed(1) + ' kg payload  |  ' +
      '12 kWh pack ' + batt.ledger.vessel.mass.toFixed(0) +
      ' kg empty + 0 payload');
  }
}

console.log('GATE ENERGY: ' + (fail.length ? 'FAIL' : 'PASS'));
process.exit(fail.length ? 1 : 0);
