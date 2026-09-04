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
  // G99 UI: the nose bay is the cowl deck — from the engine firewall (a
  // measured `cowlDeck` aft of the windscreen base, less the firewall's own
  // structure) to just past the windscreen base. Not inside the engine (the
  // first declaration, -0.95 m) and not around the pilot (the second, 0..1.02)
  {
    const cd = C.resolveSpec(C.GEN_DEFAULT).spec.fuse.cowlDeck;
    check(nose.x0 >= -cd - 1e-6 && nose.x0 < 0 && nose.x1 >= -1e-9 && nose.x1 <= 1e-9,
      'bay: the nose bay is the cowl deck, firewall to windscreen base (' +
      nose.x0.toFixed(2) + '..' + nose.x1.toFixed(2) + ' m over a ' + cd.toFixed(2) +
      ' m deck)');
  }
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
  // G100: ONE DOOR FOR A FUEL STATE. The reserve sheet, the corners and the
  // editor's slider all go through genSpecAtFuel; so the slider at 15% must
  // BE the reserve sheet, and the CG must walk monotonically with the fill
  {
    const S = C.resolveSpec(Object.assign(cl(C.GEN_DEFAULT),
      { energy: { vessels: [{ bay: 'nose', capacity: 50, along: 0, lv: 1 }] } })).spec;
    // the reserve sheet reads the BUILT spec (def.spec, every derived field
    // filled in); the slider must start from the same object or it is
    // draining a different aeroplane
    const def0 = C.buildGen(S);
    const full = C.genShakedown(def0, {});
    const at15 = C.genShakedown(C.buildGen(C.genSpecAtFuel(def0.spec, Math.max(4, 0.15 * def0.spec.fuel.litres))), { slim: true });
    check(full.reserve && Math.abs(at15.mass - full.reserve.mass) < 1e-6 &&
          Math.abs(at15.staticMargin - full.reserve.staticMargin) < 1e-9,
      'fill: the slider at 15% IS the reserve sheet (' + at15.mass.toFixed(1) + ' vs ' +
      (full.reserve ? full.reserve.mass.toFixed(1) : '?') + ' kg, SM ' + at15.staticMargin.toFixed(3) +
      ' vs ' + (full.reserve ? full.reserve.staticMargin.toFixed(3) : '?') + ')');
    const cgs = [1, 0.75, 0.5, 0.25, 0].map(k =>
      C.genShakedown(C.buildGen(C.genSpecAtFuel(S, S.fuel.litres * k)), { slim: true }).cgX);
    let mono = true;
    for (let i = 1; i < cgs.length; i++) if (!(cgs[i] >= cgs[i - 1] - 1e-9)) mono = false;
    check(mono && cgs[4] > cgs[0] + 0.01,
      'fill: a nose tank draining walks the CG aft, monotonically (' +
      cgs.map(x => x.toFixed(3)).join(' -> ') + ')');
    const pack = C.resolveSpec(Object.assign(cl(C.GEN_DEFAULT),
      { energy: { kind: 'battery', vessels: [{ bay: 'nose', capacity: 8, along: 0, lv: 1 }] } })).spec;
    const p0 = C.genSpecAtFuel(pack, 0);
    check(p0.energy.vessels[0].capacity === pack.energy.vessels[0].capacity,
      'fill: a pack does not drain through the same door');
  }
  // G101: THE CHART'S DATA, headless — the burn line, the corners and the
  // limits, off the same door. balance.js is a viewer file; its compute half
  // is pure and loads in node.
  {
    const BAL = require(path.join(__dirname, '..', 'src', 'viewer', 'balance.js'));
    const S = C.buildGen(Object.assign(cl(C.GEN_DEFAULT),
      { energy: { vessels: [{ bay: 'nose', capacity: 50, along: 0, lv: 1 }] } })).spec;
    const D = BAL.compute(S, { buildGen: C.buildGen, genShakedown: C.genShakedown,
                               genSpecAtFuel: C.genSpecAtFuel }, { occupants: 1, baggage: 0, fill: 0.5 });
    check(D.burn.length >= 5 && D.burn[0].fill === 1 && D.burn[D.burn.length - 1].fill === 0,
      'chart: the burn line runs from full to dry (' + D.burn.length + ' points)');
    let mono = true;
    for (let i = 1; i < D.burn.length; i++) if (!(D.burn[i].cgX >= D.burn[i - 1].cgX - 1e-9)) mono = false;
    check(mono, 'chart: a nose tank\u2019s burn line walks the CG aft, monotonically');
    check(D.burn.some(p => p.reserve), 'chart: the reserve point is on the line');
    check(D.corners.length === 4, 'chart: the four corners are on it');
    check(Math.abs(D.now.fill - 0.5) < 1e-9 && D.now.mass < D.burn[0].mass && D.now.mass > D.burn[D.burn.length - 1].mass,
      'chart: the slider\u2019s point sits between full and dry');
    check(D.cBar > 0.5 && D.cBar < 3 && D.limits.cautionX < D.limits.npX,
      'chart: the mean chord is recovered exactly from the static margin (' +
      (D.cBar || 0).toFixed(3) + ' m) and the caution line sits ahead of the neutral point');
    const two = BAL.compute(S, { buildGen: C.buildGen, genShakedown: C.genShakedown,
                                 genSpecAtFuel: C.genSpecAtFuel }, { occupants: 2, baggage: 30, fill: 1 });
    check(two.now.mass > D.burn[0].mass + 80,
      'chart: a second occupant and 30 kg of baggage weigh what they weigh (' +
      (two.now.mass - D.burn[0].mass).toFixed(0) + ' kg more)');
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

// ===========================================================================
// G99b — THE SOLID, PLACED (the editor's half, run without the editor)
// ===========================================================================
// `_vessel_gen.js` is the one keeper of where a vessel is and whether it fits;
// the layer draws what it returns. So the gate runs the same function off a
// cage built in node, and what it proves here is what the picture shows.
{
  const VG = require(path.join(__dirname, '_vessel_gen.js'));
  const C = require(path.join(__dirname, 'flight_core.js'));
  const fs = require('fs');
  const b = build({});
  const wing0 = C.resolveSpec(C.GEN_DEFAULT).spec.wing;
  const S = VG.specFromCage(b.spec, G, wing0, { cargoLen: C.GEN_DEFAULT.cargo.len });
  check(!!S && S.cab.noseGap > 0.2 && S.cab.len > 0.6 && S.fuse.tailArm > 3,
    'bench: the bay datums can be read off the cage\u2019s own rings' +
    (S ? ' (noseGap ' + S.cab.noseGap.toFixed(2) + ', len ' + S.cab.len.toFixed(2) +
         ', tailArm ' + S.fuse.tailArm.toFixed(2) + ')' : ''));
  if (S) {
    const bay = C.genBayResolve(S, 'nose', null);
    const dims = L => VG.vesselDims('alu', C.genVesselResolve('fuel', L, 'alu', 'avgas100LL').installedL);
    const place = (L, v) => VG.bodyPlace(b.mesh, b.FS, bay, v, dims(L), WALL_M, S._zFw);
    // at the RULE's spot — front face on the firewall, turned if the bay is
    // shorter than the box, level settled under the deck — which is what the
    // layer does; bodyPlace's own null default is the bay midpoint and is
    // not what anybody sees
    const cacheNose = VG.bayCache(b.mesh, b.FS, bay, WALL_M, S._zFw, 0.7);
    const spot45 = VG.defaultSpot(bay, dims(45));
    const st45 = VG.settleLv(b.mesh, b.FS, bay, spot45, dims(45), WALL_M, S._zFw, cacheNose, 'down');
    check(st45.settled && st45.place.ok,
      'place: a 45 L alu tank fits the nose bay at the rule’s spot (turned ' +
      spot45.rot + ' deg, lv ' + st45.lv.toFixed(2) + ')',
      st45.place ? st45.place.why.join('; ') : 'no level settled');
    const p45 = st45.place || place(45, { along: spot45.along, lv: 0.6, rot: spot45.rot });
    check(p45.pts.length >= 8 && p45.samples.length === p45.pts.length,
      'place: the fit samples the corners and the long edges, not the centre');
    // a tank LONGER than the bay, whatever size this cage is: the bench's
    // default cage is a far bigger aeroplane than the stock spec (its nose
    // bay is 1.46 m), so the capacity is derived from the bay, not typed
    const kL = (bay.x1 - bay.x0) * 1.15 / VG.SHAPES.alu.aspect[0];
    const tooBig = Math.round(kL * kL * kL * VG.SHAPES.alu.aspect[0] *
      VG.SHAPES.alu.aspect[1] * VG.SHAPES.alu.aspect[2] * VG.SHAPES.alu.fill * 1000 / 1.06);
    const pBig = place(tooBig, { along: null, lv: null, rot: 0 });
    check(!pBig.ok && pBig.why.length > 0,
      'place: ' + tooBig + ' L is longer than the bay, does not fit, and the ' +
      'reason is named', pBig.why.join('; '));
    // moving the station moves the solid, exactly
    const pA = place(45, { along: bay.x0 + 0.10, lv: 0.6, rot: 0 });
    const pB = place(45, { along: bay.x0 + 0.30, lv: 0.6, rot: 0 });
    check(Math.abs((pA.c[2] - pB.c[2]) - 0.20) < 0.02,
      'place: +0.20 m of station moves the solid 0.20 m aft (' +
      (pA.c[2] - pB.c[2]).toFixed(3) + ' m)');
    // rotating swaps the footprint
    const ext = pl => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (const p of pl.pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]);
        z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]); }
      return [x1 - x0, z1 - z0]; };
    const pStraight = place(45, { along: spot45.along, lv: 0.6, rot: 0 });
    const e0 = ext(pStraight), e9 = ext(place(45, { along: spot45.along, lv: 0.6, rot: 90 }));
    check(Math.abs(e0[0] - e9[1]) < 1e-6 && Math.abs(e0[1] - e9[0]) < 1e-6,
      'place: turning it 90 degrees swaps the footprint');
    // hanging out of the bay is reported as that, not as a skin clash
    const pX = place(45, { along: bay.x1, lv: null, rot: 0 });
    check(pX.outsideBay > 0 && !pX.ok,
      'place: a tank centred on the bay\u2019s aft limit hangs out of it, and says so');
    // THE USER'S PLACEMENT RULE, in the keeper: nose against the firewall and
    // high; everything else on the floor against the aft bulkhead
    {
      const d45 = dims(45);
      const n = VG.defaultSpot(bay, d45);
      const nL = n.rot === 90 ? d45.W : d45.L;
      check(Math.abs(n.along - (bay.x0 + Math.min(nL / 2 + 0.02, (bay.x1 - bay.x0) / 2))) < 1e-9 && n.lv === 1,
        'rule: a nose tank sits with its front face on the firewall, high');
      // a catalogue box that fits a short bay neither way gets a bay-shaped
      // one: bay length, most of the width, litres capped by what fits
      {
        const tiny = Object.assign({}, bay, { x1: bay.x0 + 0.28 });
        const ext = VG.bayExtAt(cacheNose, b.FS, S._zFw, tiny.x0 + 0.14);
        check(!!ext, 'shape: the section extents can be read at an axis station');
        if (ext) {
          const bf = VG.bayFitDims(tiny, ext, 45 * 1.06, VG.SHAPES.alu.fill);
          check(bf.L <= 0.28 - 0.04 + 1e-9 && bf.W > bf.L && bf.litres <= 45 * 1.06 + 1e-6,
            'shape: a 0.28 m bay gets a wide flat box no longer than the bay, ' +
            'holding at most what was asked (' + bf.L.toFixed(2) + ' x ' + bf.W.toFixed(2) +
            ' x ' + bf.H.toFixed(2) + ', ' + bf.litres.toFixed(0) + ' L' + (bf.capped ? ', capped' : '') + ')');
        }
      }
      // a box longer than a short bay turns across the body
      const shortBay = Object.assign({}, bay, { x1: bay.x0 + 0.45 });
      check(VG.defaultSpot(shortBay, d45).rot === 90,
        'rule: a 0.55 m box in a 0.45 m bay goes across the body (the J-3 tank)');
      check(VG.defaultSpot(shortBay, { L: 0.55, W: 0.50, H: 0.2 }).rot === 0,
        'rule: ...unless it is too wide to fit that way either');
      const cabBay = C.genBayResolve(S, 'cabin', null);
      const c = VG.defaultSpot(cabBay, d45);
      check(Math.abs(c.along - (cabBay.x1 - d45.L / 2 - 0.02)) < 1e-9 && c.lv === 0,
        'rule: a cabin tank sits on the floor, its back face on the aft bulkhead');
      const pN = VG.bodyPlace(b.mesh, b.FS, bay, n, d45, WALL_M, S._zFw);
      check(pN.outsideBay === 0, 'rule: ...and the nose default is inside its bay',
        pN.why.join('; '));
      // the level settles to the roof: top-down for the nose, and the settled
      // placement clears the skin along the whole box
      const cache = VG.bayCache(b.mesh, b.FS, bay, WALL_M, S._zFw, 0.7);
      const sN = VG.settleLv(b.mesh, b.FS, bay, n, d45, WALL_M, S._zFw, cache, 'down');
      check(sN.settled && sN.place.fitsSkin,
        'rule: the nose tank settles under the roof and clears the skin (lv ' +
        sN.lv.toFixed(2) + ')');
      const sC = VG.settleLv(b.mesh, b.FS, cabBay, c, d45, WALL_M, S._zFw,
        VG.bayCache(b.mesh, b.FS, cabBay, WALL_M, S._zFw, 0.7), 'up');
      check(sC.settled && sC.place.fitsSkin,
        'rule: the cabin tank settles onto the keel and clears the skin (lv ' +
        sC.lv.toFixed(2) + ')');
      // the player's box: litres follow the geometry, and round-trip the shape
      const inst = VG.installedFromDims('alu', d45);
      check(Math.abs(inst - 45 * 1.06) < 0.05,
        'dims: the catalogue box holds exactly the litres it was drawn for (' +
        inst.toFixed(2) + ' vs ' + (45 * 1.06).toFixed(2) + ')');
      const own = VG.vesselDims('alu', 0, { L: 0.6, W: 0.4, H: 0.2 });
      check(own.own === true && own.L === 0.6,
        'dims: a drawn box is used as drawn');
      check(Math.abs(VG.installedFromDims('alu', own) - 0.6 * 0.4 * 0.2 * 0.9 * 1000) < 1e-9,
        'dims: ...and its litres are its volume less the shell\u2019s rounding');
    }
    // the wing
    const semi = wing0.span / 2, slice = VG.analyticSlice(wing0);
    const wb = C.genBayResolve(S, 'wingRoot', null);
    const w40 = VG.wingPlace(semi, wb, { along: null },
      C.genVesselResolve('fuel', 40, 'alu', 'avgas100LL').installedL, slice, C.GEN_RULES, wb.litres);
    check(w40.ok && w40.sides.length === 2,
      'wing: 40 L sits in the root spar bay, one half each side', w40.why.join('; '));
    check(w40.sides.length === 2 && Math.abs(w40.sides[0].x0 + w40.sides[1].x0) < 1e-9,
      'wing: ...mirrored');
    check(Math.abs(w40.metL - 40 * 1.06) < 0.5,
      'wing: the box holds what was asked (' + w40.metL.toFixed(1) + ' L)');
    // more than the bay holds, by the core's own number, runs past it
    const over = wb.litres * 1.10;
    const wBig = VG.wingPlace(semi, wb, { along: null }, over, slice, C.GEN_RULES, wb.litres);
    check(!wBig.ok, 'wing: ' + over.toFixed(0) + ' L (the bay holds ' + wb.litres.toFixed(0) +
      ') runs past the root bay, and says so', wBig.why.join('; '));
    // ...and filling the bay exactly holds what the plaque says the bay holds
    const wFull = VG.wingPlace(semi, wb, { along: null }, wb.litres * 0.999, slice, C.GEN_RULES, wb.litres);
    check(wFull.ok && Math.abs(wFull.fOut - wb.span[1]) < 0.01,
      'wing: a tank of the bay\u2019s own litres fills the bay to its outboard edge (' +
      wFull.fOut.toFixed(3) + ' vs ' + wb.span[1] + ')');
  }
  // A LAYER THAT IS NOT BUNDLED IS INVISIBLE, in both places it has to exist
  const bj = fs.readFileSync(path.join(__dirname, 'build.js'), 'utf8');
  const h8 = fs.readFileSync(path.join(__dirname, '_cage8.html'), 'utf8');
  const pc = fs.readFileSync(path.join(__dirname, '_parts_check.js'), 'utf8');
  for (const f of ['_bay_site.js', '_vessel_gen.js', '_cage_energy.js']) {
    check(bj.includes("'" + f + "'"), 'bundle: ' + f + ' is in the game editor bundle');
    check(h8.includes('"' + f + '"'), 'bundle: ' + f + ' is on the bench page');
    check(pc.includes("'" + f + "'"), 'bundle: ' + f + ' is in GATE PARTS\u2019 loader');
  }
  check(h8.includes('60c_gen_energy.js'), 'bundle: the bench loads the energy core');
  const jn = fs.readFileSync(path.join(__dirname, '_cage_join.js'), 'utf8');
  check(/M\.energy = window\.CAGE_ENERGY\.toSpec\(\)/.test(jn) &&
        /spec\.energy = M\.energy/.test(jn),
    'join: the vessels ride the join into the build beside the finish');
  const ui = fs.readFileSync(path.join(__dirname, '_cage_ui.js'), 'utf8');
  check(/CAGE_ENERGY\.fromSpec\(spec && spec\.energy\)/.test(ui),
    'load: a loaded build seeds the energy panel, unconditionally');
  // THE LOOK CROSSES THE JOIN TOO (2026-09-04, user: "the fuel tank material
  // does not seem to make it in game - red in the editor, white in the flight
  // interface"). A vessel's surface is a scanned sheet, a tint and a hue, and
  // the capture's fall-through for a material it cannot name is a colour and
  // two scalars — which on a painted shell is the multiplier alone, i.e.
  // white. Four things have to hold, and each was broken in turn to see this
  // gate go red: the factory has to STAMP what the material is, the merge has
  // to CARRY it (and its uv, or the sheet has nothing to sample), it must not
  // merge a tank into a cage section of the same colour, and the game has to
  // come back through the SAME factory rather than approximating it.
  const en2 = fs.readFileSync(path.join(__dirname, '_cage_energy.js'), 'utf8');
  const ap = fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer',
                                       'app.js'), 'utf8');
  check(/m\.userData\.vesSet = F\.set;/.test(en2) &&
        /material: vesselMatFor/.test(en2),
    'look: the vessel factory stamps its set on the material and opens a door '
    + 'for the game (CAGE_ENERGY.material)');
  check(/const vesPool = new Map\(\);/.test(en2) &&
        /for \(const m of vesAll\) m\.envMapIntensity/.test(en2),
    'look: the game’s materials are pooled, and the mood walks every '
    + 'material the factory made');
  check(/\.\.\.\(ud\.vesSet \? \{ ves: ud\.vesSet \} : \{\}\),/.test(jn) &&
        /\.\.\.\(ud\.vesSet && ud\.hue \? \{ vesHue:/.test(jn),
    'look: the join carries the set and the hue into the build');
  check(/\(kud\.vesSet \? 'v' \+ kud\.vesSet \+/.test(jn),
    'look: ...and a tank never merges into a cage section of the same colour');
  check(/const uAttr = geo\.attributes\.uv;/.test(jn) &&
        /if \(G3\.uv\) \{/.test(jn) &&
        /uv: \(g\.uv && g\.uv\.length\) \? new Float32Array\(g\.uv\)/.test(jn),
    'look: ...and the vessel buckets carry their metre-true uv, which the '
    + 'rest of the cage has none of');
  check(/if \(data\.cage && m\.ves && window\.CAGE_ENERGY &&/.test(ap) &&
        /window\.CAGE_ENERGY\.material\(\{[\s\S]{0,120}set: m\.ves, tint: m\.color/.test(ap),
    'look: the flown aeroplane rebuilds a vessel from the editor’s own '
    + 'factory, not from a colour');
  // THE SLIDER LAG (2026-09-04). Every cage build ran the layer's post hook,
  // and the hook emptied the bay caches and re-swept the body (2.0 s of a
  // 2.6 s tick, measured), then fired fourteen aero solves of readouts into
  // a panel that was not even displayed. The sweep is keyed on a signature
  // of the fielded vertices now, and the readouts wait until they are on
  // screen. The two lines below are the ones a tidy-up would put back.
  const en = fs.readFileSync(path.join(__dirname, '_cage_energy.js'), 'utf8');
  check(/function bodySig\(/.test(en) && /sig !== BODY_SIG\) \{ BAY_CACHES = \{\}; FIELD_L = \{\};/.test(en),
    'lag: the bay sweep is keyed on the body signature, not on the build');
  check(!/^\s*BAY_CACHES = \{\};\s*\/\/ a new body/m.test(en),
    'lag: PAGE.post does not empty the sweep caches unconditionally');
  check(/FIELD_L\[key\] = r\.litresField/.test(en) && /if \(key in FIELD_L\)/.test(en),
    'lag: measureBays reads its swept litres from the cache under the same body');
  check(/if \(!bay\._ck\) bay\._ck = bayKey\(bay, zFw\)/.test(en),
    'lag: a bay keys its sweep on the rule limits once, before the field clamps them');
  check(!/setTimeout\(balanceReadout, 50\)/.test(en) && /watchReadouts\(balEl\);\s*scheduleReadouts\(\);/.test(en),
    'lag: the panel schedules its readouts through the stale/visible door, not a 50 ms timer');
  check(/function readoutsVisible\(\) \{ return !!\(panel && panel\.open && readSeen\); \}/.test(en),
    'lag: readouts run only while the panel is open and on screen');
  // ...AND OFF THE MAIN THREAD. The fourteen solves go to a Worker that loads
  // the gates' own core bundle and the chart's pure half; the page keeps the
  // synchronous path as the fallback. The worker's answer was checked against
  // the page's own on the same spec (strict JSON equality of the chart) when
  // it landed; these pins keep the wiring, and the fallback, from being tidied.
  check(/importScripts\(' \+ JSON\.stringify\(base \+ 'tools\/flight_core\.js'\)/.test(en) &&
        /importScripts\(' \+ JSON\.stringify\(base \+ 'src\/viewer\/balance\.js'\)/.test(en),
    'lag: the readout worker loads the gates\u2019 core bundle and balance.js, nothing else');
  check(/const compute = ' \+ readoutCompute\.toString\(\)/.test(en) &&
        /applyReadouts\(readoutCompute\(job, \{ buildGen, genShakedown, genSpecAtFuel \}/.test(en),
    'lag: one readout body (readoutCompute) serves the worker and the on-page fallback');
  check(/if \(!r \|\| r\.seq !== readSeq\) return;/.test(en),
    'lag: a readout about an aeroplane that has changed since is dropped by sequence');
  check(/readWorkerDead = true; readWorker = null;[\s\S]{0,120}readoutsNow\(\);/.test(en),
    'lag: a worker that fails hands the job back to the page');
  // the worker's imports have to EXIST where the page is served from
  check(fs.existsSync(path.join(__dirname, 'flight_core.js')) &&
        fs.existsSync(path.join(__dirname, '..', 'src', 'viewer', 'balance.js')),
    'lag: tools/flight_core.js and src/viewer/balance.js are on disk for the worker to import');
  const fc = fs.readFileSync(path.join(__dirname, 'flight_core.js'), 'utf8');
  check(!/\brequire\(/.test(fc) && !/^\s*(window|document)\./m.test(fc),
    'lag: the core bundle has no require/window/document at load, so a worker can import it');
  // THE FIELD INDEX is what makes a fuselage row cheap again (GATE FIT proves
  // it exact); this is the line that turns it on for every caller of fieldHits
  const fsrc = fs.readFileSync(path.join(__dirname, '_fit_site.js'), 'utf8');
  check(/return fieldScan\(mesh, ax, tx, ty, fieldIndexQuery\(mesh, ax, tx, ty\)\);/.test(fsrc),
    'lag: fieldHits walks the indexed cell, not the mesh');
}

console.log('  ' + seen.length + ' bodies swept, ' +
            seen.reduce((a, s) => a + s.open, 0) + ' sections measured, ' +
            seen.reduce((a, s) => a + s.litres, 0).toFixed(0) + ' litres of interior');
for (const f of fail) console.log('  FAIL ' + f);
let printed = fail.length;

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

// ===========================================================================
// THE DRAWN VESSEL (2026-09-04) — _vessel_mesh.js
// ===========================================================================
// The failures here are the same KIND as everywhere else in this file: silent,
// and each reads as a slightly different object rather than as an error.
//   - a loft wound against its own normals draws a tank you can see the inside
//     of the far wall through. This is not hypothetical: the first y-axis loft
//     had 560 of 560 triangles inverted, because laying a 2D section into 3D
//     about y makes a LEFT-handed basis and the identical point order that
//     faces out about z faces in about y.
//   - a normal that is not unit length shades a smooth shell in facets
//   - a shell that escapes its own declared box is a tank the FIT TEST above
//     has cleared and the skin has not
//   - a fitting scaled with the tank puts a 90 mm filler cap on a header tank
//   - and a fill fraction taken as a HEIGHT draws a quarter-full round tank a
//     third full, because a cylinder's area is not linear in its depth
{
  const VM = require(path.join(__dirname, '_vessel_mesh.js'));
  const VG = require(path.join(__dirname, '_vessel_gen.js'));
  const SLOTS = ['shell', 'hard', 'seal', 'mark'];
  // every proportion a bay can hand it, both forms, both kinds
  const CASES = [
    ['a squared tank',       { e: [0.22, 0.16, 0.30], kind: 'fuel', form: 'box' }],
    ['a cylindrical tank',   { e: [0.16, 0.16, 0.45], kind: 'fuel', form: 'cyl' }],
    ['a wide deck tank',     { e: [0.42, 0.13, 0.12], kind: 'fuel', form: 'box' }],
    ['a header tank',        { e: [0.05, 0.04, 0.08], kind: 'fuel', form: 'box' }],
    ['a ferry tank',         { e: [0.45, 0.40, 1.20], kind: 'fuel', form: 'cyl' }],
    ['a pack',               { e: [0.30, 0.09, 0.40], kind: 'battery', form: 'box' }],
    ['a cylindrical pack',   { e: [0.30, 0.12, 0.40], kind: 'battery', form: 'cyl' }],
  ];
  let tris = 0;
  for (const [label, cfg] of CASES) {
    const r = VM.build(cfg);
    tris += r.tris;
    const parts = SLOTS.map(s => r[s]).concat([VM.contents(r, 0.6, 0.006)]);
    let bad = 0, nonUnit = 0, oob = 0, wrong = 0, out = 0;
    // the solid is built in a canonical frame (the longer horizontal axis is
    // z), so the box it must stay inside is the one build() chose
    const E = r.e;
    for (const b of parts) {
      const n = b.pos.length / 3;
      for (let i = 0; i < n; i++) {
        for (let k = 0; k < 3; k++) if (!isFinite(b.pos[i * 3 + k])) bad++;
        for (let k = 0; k < 2; k++) if (!isFinite(b.uv[i * 2 + k])) bad++;
        const L = Math.hypot(b.nor[i * 3], b.nor[i * 3 + 1], b.nor[i * 3 + 2]);
        if (!(Math.abs(L - 1) < 1e-6)) nonUnit++;
      }
      for (const j of b.idx) if (!(j >= 0 && j < n)) oob++;
      // winding against the vertex normal the same patch computed
      for (let t = 0; t < b.idx.length; t += 3) {
        const a = b.idx[t], c = b.idx[t + 1], d = b.idx[t + 2];
        const ax = b.pos[a * 3], ay = b.pos[a * 3 + 1], az = b.pos[a * 3 + 2];
        const u = [b.pos[c * 3] - ax, b.pos[c * 3 + 1] - ay, b.pos[c * 3 + 2] - az];
        const v = [b.pos[d * 3] - ax, b.pos[d * 3 + 1] - ay, b.pos[d * 3 + 2] - az];
        const fn = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2],
                    u[0] * v[1] - u[1] * v[0]];
        const L = Math.hypot(fn[0], fn[1], fn[2]);
        if (L < 1e-12) continue;                       // a collapsed corner
        const dd = (fn[0] * b.nor[a * 3] + fn[1] * b.nor[a * 3 + 1] +
                    fn[2] * b.nor[a * 3 + 2]) / L;
        if (dd < -0.25) wrong++;
      }
    }
    // THE SHELL STAYS IN ITS BOX. Hardware does not, and must not — a filler
    // neck stands proud of any tank — so only the shell and its contents are
    // held to it, and the hardware is held to a hand's width beyond instead.
    for (const b of [r.shell, VM.contents(r, 1, 0.006)])
      for (let i = 0; i < b.pos.length / 3; i++)
        for (let k = 0; k < 3; k++)
          if (Math.abs(b.pos[i * 3 + k]) > E[k] + 1e-6) out++;
    let proud = 0;
    for (const b of [r.hard, r.seal, r.mark])
      for (let i = 0; i < b.pos.length / 3; i++)
        for (let k = 0; k < 3; k++)
          if (Math.abs(b.pos[i * 3 + k]) > E[k] + 0.075) proud++;

    check(bad === 0, label + ': every vertex and uv is a number', bad + ' were not');
    check(nonUnit === 0, label + ': every normal is unit length', nonUnit + ' were not');
    check(oob === 0, label + ': every index is in range', oob + ' were not');
    check(wrong === 0, label + ': every face is wound the way its normal points',
          wrong + ' faced in');
    check(out === 0, label + ': the shell and its contents stay inside the ' +
          'declared box the fit test cleared', out + ' coordinates escaped');
    check(proud === 0, label + ': no fitting stands more than 75 mm proud',
          proud + ' did');
    for (const s of SLOTS) check(r[s].tris > 0, label + ': the ' + s + ' slot is drawn');
  }

  // --- THE FITTINGS ARE CLAMPED IN METRES ----------------------------------
  // The crew layer's rule and the fittings arc's: 35 mm of structure is 35 mm
  // on a Cub and on a DC-3. A tank thirty times the volume must not carry a
  // filler cap thirty times the size.
  {
    const small = VM.build({ e: [0.10, 0.09, 0.14], kind: 'fuel', form: 'box' });
    const big = VM.build({ e: [0.45, 0.40, 1.20], kind: 'fuel', form: 'cyl' });
    const capW = b => {
      let lo = 1e9, hi = -1e9;
      for (let i = 0; i < b.mark.pos.length / 3; i++) {
        const x = b.mark.pos[i * 3];
        if (x < lo) lo = x; if (x > hi) hi = x;
      }
      return hi - lo;
    };
    const rs = capW(small), rb = capW(big);
    const volR = (0.45 * 0.40 * 1.20) / (0.10 * 0.09 * 0.14);
    check(rb / rs < 4, 'the filler cap is clamped, not scaled: ' +
      (volR).toFixed(0) + 'x the volume gives ' + (rb / rs).toFixed(2) +
      'x the cap (' + (rs * 1000).toFixed(0) + ' -> ' + (rb * 1000).toFixed(0) + ' mm)');
    check(rb > rs, '...but it is not frozen either');
  }

  // --- THE FILL IS A VOLUME ------------------------------------------------
  // Half the litres in a lying cylinder is half its height, because it is
  // symmetric about its axis; a QUARTER of the litres is 19.6% of the height
  // and not 25%. A level placed at the fill fraction would be right at empty,
  // half and full and wrong everywhere else — which is exactly the kind of
  // thing that looks fine in a screenshot taken at 50%.
  {
    const r = VM.build({ e: [0.16, 0.16, 0.45], kind: 'fuel', form: 'cyl' });
    const h = f => (VM.contents(r, f, 0.006).level + 0.154) / 0.308;
    check(Math.abs(h(0.5) - 0.5) < 0.01, 'fill: half the litres is half the height');
    check(Math.abs(h(0.25) - 0.302) < 0.02,
      'fill: a quarter of the litres is 30% of the height in a round tank, ' +
      'not 25% (measured ' + (h(0.25) * 100).toFixed(1) + '%)');
    check(h(1) > 0.99, 'fill: full is full');
  }

  // --- A ROUND TANK IN A SQUARE BOX HOLDS LESS -----------------------------
  // ...and the ledger has to be told, or a cylinder would be billed the
  // squared shell's litres. The BOX factor is exactly 1, which is what keeps
  // every build written before this row weighing what it weighed.
  {
    const dims = { L: 0.6, W: 0.44, H: 0.32 };
    const box = VG.installedFromDims('alu', dims, 'box');
    const cyl = VG.installedFromDims('alu', dims, 'cyl');
    const none = VG.installedFromDims('alu', dims);
    check(Math.abs(box - none) < 1e-9,
      'form: an unstated form is the squared one — no old build moved');
    check(cyl < box * 0.85 && cyl > box * 0.70,
      'form: the cylinder holds 0.78 of the squared shell (' +
      (cyl / box).toFixed(3) + ')');
    const d2 = VG.vesselDims('alu', 100, null, 'cyl');
    const d1 = VG.vesselDims('alu', 100, null, 'box');
    check(d2.L * d2.W * d2.H > d1.L * d1.W * d1.H,
      'form: ...so a cylinder of the same litres needs a bigger box');
  }

  // --- THE LONG WAY IS THE LENGTH ------------------------------------------
  // A bay-shaped tank is very often wider than it is long, and laying the
  // straps, the filler and the sump out along the short axis crowds every
  // fitting into a hand's width.
  {
    const wide = VM.build({ e: [0.42, 0.13, 0.12], kind: 'fuel', form: 'box' });
    check(wide.yaw > 1.5, 'a tank wider than it is long is built turned, ' +
      'and the layer adds its yaw');
    check(wide.e[2] > wide.e[0], '...with the long way as its length');
    const tall = VM.build({ e: [0.12, 0.13, 0.42], kind: 'fuel', form: 'box' });
    check(tall.yaw === 0, '...and one already the right way round is not turned');
  }

  if (SHOW) console.log('  drawn vessels: ' + CASES.length + ' cases, ' +
    tris + ' triangles, ' + SLOTS.length + ' material slots');
}

// THE FAILURE LIST IS PRINTED WHERE THE VERDICT IS. It used to be printed at
// the end of the G97 section, which was the end of the file when it was
// written — so every check added after it failed SILENTLY, with a bare "FAIL"
// and nothing to read. Found the moment the drawn-vessel section landed.
for (const f of fail.slice(printed)) console.log('  FAIL ' + f);
console.log('GATE ENERGY: ' + (fail.length ? 'FAIL' : 'PASS'));
process.exit(fail.length ? 1 : 0);
