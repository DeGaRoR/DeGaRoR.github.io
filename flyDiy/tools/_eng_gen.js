// ENGINE GENERATOR — a simple, physical light-aero engine.
//
// WHY THIS EXISTS. The propeller graduated out of the registry in G4.7: its
// mass comes from material, diameter and blade count, its thrust from momentum
// theory, calibrated exactly on the A-65. The ENGINE never did. It is still
// `POWERPLANTS[t].engine.mass` — one number, dropped on two mount nodes at the
// front of the aeroplane (61_gen_frame.js: `pt(EL, 0.5 * (PP.engine.mass +
// S.prop.mass))`), which is the longest moment arm on the machine and so the
// costliest place to be approximate. It also gives the cowl something real to
// wrap, and it creates the hub node G4.7 said did not exist.
//
// THE MODEL, in three steps, each calibrated against the registry rather than
// asserted (tools/_eng_check.js is the verdict):
//
//   1. DISPLACEMENT is geometry:  Vd = n * pi/4 * bore^2 * stroke
//   2. POWER is BMEP:             P  = BMEP * Vd * rev/s / strokeDiv
//      Normally-aspirated four-strokes in this class run 9.0-10.4 bar and the
//      registry's own engines land inside that band — A-65 9.0, O-200 9.9,
//      IO-360 10.1, Jabiru 10.4. BMEP is therefore a real, narrow parameter,
//      not a fudge factor.
//   3. MASS TRACKS DISPLACEMENT, NOT POWER, AND SUB-LINEARLY. Per kW the
//      registry spreads 0.84-1.65 kg — twofold, correlating with nothing
//      useful. Per LITRE it is far tighter but still slides DOWNWARD with
//      size (A-65 28.6, Jabiru 27.1, O-200 25.8, IO-360 23.3, R-1830 19.5),
//      because the metal around a swept volume does not thicken in proportion
//      to it. A least-squares fit over those five gives
//
//          mass = 30.51 * litres^0.8735          (worst error 6.2%)
//
//      and ONE law covers a 2.2 litre flat four and a 38.5 litre radial
//      alike, which is why architecture does NOT get its own kg/litre. The
//      6.2% outlier is the A-65 reading light — and the registry's own note
//      says its 80 kg stands against a real 77, so the model is arguably
//      nearer the engine than the entry is.
//
//      A first cut used a flat 27 kg/litre and ran +31% on the IO-360 and
//      +45% on the R-1830. A constant looked right on the engine it was read
//      from and was wrong everywhere else; the exponent is the finding.
//
//      A gearbox and a water jacket are declared additions, never folded in
//      (the Rotax 912 reads 48 kg/litre, which is not a different rule — it
//      is a geared, liquid-cooled engine being three things at once).
//
// GEOMETRY. Cylinders are placed by ONE rule for every architecture: each sits
// at an ANGLE about the crank axis and a STATION along it, and the family is
// only a table of those. A flat four is two banks at +/-90 deg, a radial is one
// bank of n spread over 360, an inline is one bank at 0. That is why adding a
// V12 costs a table row and not a builder.
//
// Frame: crank axis along +z (the thrustline, nose at +z), y up, x lateral —
// the cage's frame, so the mesh drops into the same scenes. Metres, kg, W, Pa.
'use strict';

const ENG_UNIT = 1.0;                       // metres per unit; this file is SI

// ---------------------------------------------------------------------------
// MASS LAW, shared by every architecture (see 3 above). Fitted over the five
// air-cooled direct-drive engines in 00_registry.js.
const ENG_MASS_K = 30.51;        // kg at one litre
const ENG_MASS_E = 0.8735;       // exponent on litres

// ---------------------------------------------------------------------------
// ARCHITECTURES. `angles` gives each cylinder's angle about the crank axis, in
// degrees, 0 = straight up; `stations` which station along the axis it sits at.
// A radial puts every cylinder on ONE station, an inline gives each its own —
// that pair of tables IS the family, which is why a V12 costs a row and not a
// builder.
//
// `kM` multiplies the shared mass law. Flat and radial are 1.00 because they
// are what the fit was made from; inline and V are marked UNVALIDATED — there
// is no registry example of either, and a longer crank with more mains really
// should weigh more, so these are the model's only guesses. Treat a number
// they produce as an estimate, not as a measurement.
// ---------------------------------------------------------------------------
const ENG_ARCH = {
  flat: {
    name: 'Flat (boxer)', counts: [2, 4, 6], kM: 1.00, bmep: 9.8,
    // alternating banks, one cylinder per station per side
    angles: n => Array.from({ length: n }, (_, i) => (i % 2 ? 90 : -90)),
    stations: n => Array.from({ length: n }, (_, i) => Math.floor(i / 2)),
    nStations: n => Math.ceil(n / 2),
  },
  inline: {
    name: 'Inline', counts: [4, 6], kM: 1.06, bmep: 9.5,   // UNVALIDATED
    angles: n => Array.from({ length: n }, () => 0),
    stations: n => Array.from({ length: n }, (_, i) => i),
    nStations: n => n,
  },
  vee: {
    name: 'V', counts: [8, 12], kM: 1.10, bmep: 10.2, vee: 60,  // UNVALIDATED
    angles: (n, P) => Array.from({ length: n },
      (_, i) => (i % 2 ? 1 : -1) * (P && P.vee != null ? P.vee : 60) / 2),
    stations: n => Array.from({ length: n }, (_, i) => Math.floor(i / 2)),
    nStations: n => Math.ceil(n / 2),
  },
  radial: {
    name: 'Radial', counts: [5, 7, 9], kM: 1.00, bmep: 9.6,
    // ONE row, spread evenly about the axis; 0 = straight up
    angles: n => Array.from({ length: n }, (_, i) => i * 360 / n),
    stations: n => Array.from({ length: n }, () => 0),
    nStations: () => 1,
  },
  electric: {
    name: 'Electric outrunner', counts: [0], kM: 1.00, bmep: 0,
    angles: () => [], stations: () => [], nStations: () => 1,
  },
};

// ---------------------------------------------------------------------------
// THE FICHE. Defaults are a Continental A-65 — the engine the whole fleet's
// thrust model is anchored on (G4.7), so the identity case is the one aeroplane
// whose numbers are already validated.
// ---------------------------------------------------------------------------
const ENG_DEFAULT = {
  arch: 'flat',
  cyl: 4,
  bore: 0.0983,            // m  (3.875 in)
  stroke: 0.0921,          // m  (3.625 in)
  rpm: 2300,
  twoStroke: 0,
  vee: 60,                 // degrees, `vee` architecture only
  // DECLARED ADDITIONS, never folded into kMass: a reduction gearbox and a
  // water jacket are things an engine HAS, and a single kg/litre that hid them
  // would make one number mean three.
  geared: 0, gearRatio: 2.27,
  liquid: 0,
  // installation
  accessories: 1,          // magnetos, pumps, starter, alternator
  exhaust: 1,
  // geometry knobs (fractions of bore unless stated)
  finR: 1.34,              // fin diameter / bore
  finN: 9,                 // cooling fins per barrel
  headR: 1.46,             // head diameter / bore
  caseK: 1.0,              // scales the derived crankcase radius
  cylK: 1.85,              // cylinder projection beyond the stroke, / bore
  sump: 0.55,              // sump + induction depth below the case, / caseR
  pitch: 1.30,             // station spacing / bore
  flangeR: 0.44, flangeLen: 0.055,   // prop flange, metres for the length
  accLen: 0.16,            // accessory case length, metres
  sect: 12,                // sides on a barrel
};

const ENG_MAT = {
  case: 'engCase', barrel: 'engBarrel', head: 'engHead',
  fin: 'engFin', flange: 'engFlange', exhaust: 'engExhaust', acc: 'engAcc',
};

// ---------------------------------------------------------------------------
// RESOLVE — the numbers. Pure; no geometry, no THREE, node-callable.
// ---------------------------------------------------------------------------
function engResolve(spec) {
  const P = Object.assign({}, ENG_DEFAULT, spec || {});
  const A = ENG_ARCH[P.arch] || ENG_ARCH.flat;
  const n = P.arch === 'electric' ? 0 : Math.max(1, Math.round(P.cyl));

  // 1. displacement
  const swept = Math.PI / 4 * P.bore * P.bore * P.stroke;   // m3 per cylinder
  const Vd = swept * n;                                     // m3
  const litres = Vd * 1000;

  // 2. power. A four-stroke fires once every two revolutions, a two-stroke
  // every one — that is the whole of `strokeDiv`, and it is why a 500 cc
  // two-stroke keeps up with a litre of four-stroke.
  const strokeDiv = P.twoStroke ? 1 : 2;
  const revS = P.rpm / 60;
  const powerW = (A.bmep * 1e5) * Vd * revS / strokeDiv;

  // 3. mass, from swept volume, sub-linearly, with the extras declared.
  // The law was fitted against the registry's DRY ENGINE masses, which are
  // engines as normally equipped — so accessories and an exhaust are IN the
  // baseline and their flags REMOVE them. Adding them on top of a fit that
  // already contained them is how a model double-counts and reads 12% heavy
  // on every row at once.
  let mass = ENG_MASS_K * Math.pow(litres, ENG_MASS_E) * (A.kM || 1);
  if (!P.accessories) mass *= 0.91;
  if (!P.exhaust) mass *= 0.965;
  if (P.geared) mass += 0.14 * mass + 3.0;    // reduction unit
  if (P.liquid) mass += 0.11 * mass + 2.5;    // jacket, pump, radiator, coolant

  // ---- ENVELOPE + CG ------------------------------------------------------
  // The cowl is built around THIS, so it is measured off the same placement
  // rule the geometry uses rather than a second guess at the same shape.
  const ang = A.angles(n, P).map(d => d * Math.PI / 180);
  const stn = A.stations(n);
  const nSt = A.nStations(n);
  const pitch = P.pitch * P.bore;
  // THE CRANKCASE IS SIZED BY WHAT IT HOUSES, not by a fraction of the bore:
  // it has to clear the crank throw (stroke/2) and carry a main bearing round
  // it. As a bore fraction it came out 0.12 m across on an A-65, which is
  // narrower than the crankshaft, and the whole engine read as a toy.
  const caseR = P.caseK * (0.55 * P.stroke + 0.45 * P.bore);
  // A CYLINDER IS MOSTLY NOT ITS STROKE. Measured off the real engines: an
  // A-65 is 0.79 m across a 0.22 m crankcase, so each cylinder projects
  // 0.285 m on a 0.092 m stroke — three times it. The finned barrel and a
  // deep head are the rest, and both scale with BORE.
  const cylLen = P.stroke + P.cylK * P.bore;
  const r0 = caseR + 0.06 * P.bore;                 // base sits on the case
  const rTip = r0 + cylLen;
  const headR = P.headR * P.bore / 2;
  // sump/induction depth below the case — not modelled in detail, but a real
  // engine is not a bare barrel and a cowl has to clear this
  const sump = P.sump * caseR;

  // stations run aft from the flange; z = 0 is the CRANK NOSE (flange face)
  const zOf = s => -(P.flangeLen + 0.5 * pitch + s * pitch);
  let x0 = -caseR, x1 = caseR, y0 = -caseR - sump, y1 = caseR;
  for (let i = 0; i < n; i++) {
    const c = Math.cos(ang[i]), s = Math.sin(ang[i]);
    const tx = s * rTip, ty = c * rTip;
    // THE HEAD'S RADIUS IS PERPENDICULAR TO ITS CYLINDER, not along it. The
    // first cut added headR to x AND y for every cylinder, which on a flat
    // engine widened the aeroplane by a head at each end — the head disc lies
    // across the axis, so it spans (cos a, -sin a) in plane and z out of it.
    const px = Math.abs(Math.cos(ang[i])) * headR;
    const py = Math.abs(Math.sin(ang[i])) * headR;
    x0 = Math.min(x0, tx - px); x1 = Math.max(x1, tx + px);
    y0 = Math.min(y0, ty - py); y1 = Math.max(y1, ty + py);
  }
  // WHAT THE ENVELOPE IS, stated because a cowl is going to be built on it:
  // the BARE ENGINE — crankcase, cylinders and heads, sump. The induction and
  // the accessories that sit ON TOP of a real flat engine are not modelled, so
  // the height is a floor rather than the installed height (the A-65 reads
  // 0.24 m here against roughly twice that installed; the width, 0.75 against
  // ~0.79, is right because that IS cylinders). A cowl must therefore carry
  // its own clearance rather than hug this — which is what a cowl does anyway.
  // THE SILHOUETTE, not just the box. A cowl is a rounded section, and asking
  // it to contain the CORNERS of a bounding box is asking it to contain metal
  // that is not there — a radial's box corners are empty, its real outline is
  // a circle through the head rims. So the envelope publishes the points that
  // are actually occupied, looking down the crank axis, and whatever wraps
  // this engine fits to those.
  const hull = [];
  const NC = 16;
  for (let k = 0; k < NC; k++) {              // the crankcase, and its sump
    const t = k / NC * Math.PI * 2;
    hull.push([Math.sin(t) * caseR,
               Math.cos(t) * caseR - (Math.cos(t) < 0 ? sump : 0)]);
  }
  for (let i = 0; i < n; i++) {               // each head's rim, edge on
    const c = Math.cos(ang[i]), s = Math.sin(ang[i]);
    const px = Math.cos(ang[i]), py = -Math.sin(ang[i]);   // in-plane normal
    for (let k = -1; k <= 1; k += 2)
      hull.push([s * rTip + px * headR * k, c * rTip + py * headR * k]);
    hull.push([s * rTip, c * rTip]);
  }
  const zAft = zOf(nSt - 1) - 0.5 * pitch - (P.accessories ? P.accLen : 0);
  const env = { x0, x1, y0, y1, z0: zAft, z1: 0, hull,
                width: x1 - x0, height: y1 - y0, length: -zAft,
                // what a cowl actually needs: the radius that encloses
                // everything, about the THRUSTLINE (G4.7's datum ruling)
                radius: Math.max(Math.abs(x0), Math.abs(x1),
                                 Math.abs(y0), Math.abs(y1)) };

  // CG along the crank axis, from the parts that carry the mass. The point of
  // the exercise: a lump at the mount nodes cannot tell a long six from a
  // short radial, and they balance an aeroplane very differently.
  const items = [];
  const caseMass = mass * (n ? 0.46 : 0.85);
  const cylMass = n ? mass * 0.34 / n : 0;
  const accMass = P.accessories ? mass * 0.13 : 0;
  const flMass = mass * 0.07;
  const zCase = (zOf(0) + zOf(nSt - 1)) / 2;
  items.push({ what: 'crankcase', m: caseMass, z: zCase });
  for (let i = 0; i < n; i++)
    items.push({ what: 'cylinder' + i, m: cylMass, z: zOf(stn[i]) });
  if (accMass) items.push({ what: 'accessories', m: accMass, z: zAft + 0.5 * P.accLen });
  items.push({ what: 'flange', m: flMass, z: -0.5 * P.flangeLen });
  const mTot = items.reduce((s, it) => s + it.m, 0) || 1;
  const cgZ = items.reduce((s, it) => s + it.m * it.z, 0) / mTot;

  return {
    arch: P.arch, archName: A.name, cyl: n,
    displacement: Vd, litres, bmep: A.bmep,
    powerW, powerHP: powerW / 745.7, rpm: P.rpm,
    mass, kgPerLitre: litres ? mass / litres : 0,
    kgPerKW: powerW ? mass / (powerW / 1000) : 0,
    env, cgZ, items,
    // the placement rule, published so the geometry and the cowl agree
    place: { ang, stn, nSt, pitch, r0, cylLen, rTip, caseR, headR, sump,
             zOf, zAft },
    P,
  };
}

// ---------------------------------------------------------------------------
// GEOMETRY — the cage's mesh shape ({V, F:[{v, m}]}) so it drops into the same
// viewers, the same OBJ export and, later, the same skin pipeline. Quads only,
// which is what the subdivision and the manifold checks expect.
// ---------------------------------------------------------------------------
function engBuild(spec) {
  const R = engResolve(spec);
  const P = R.P, L = R.place;
  const V = [], F = [];
  const v = p => { V.push(p); return V.length - 1; };
  const quad = (a, b, c, d, m) => F.push({ v: [a, b, c, d], m });

  // a ring of `sect` points about an axis, centred at c, in the plane whose
  // in-plane axes are u and w
  const ring = (c, u, w, r, sect) => {
    const out = [];
    for (let k = 0; k < sect; k++) {
      const t = k / sect * Math.PI * 2, ct = Math.cos(t), st = Math.sin(t);
      out.push(v([c[0] + (u[0] * ct + w[0] * st) * r,
                  c[1] + (u[1] * ct + w[1] * st) * r,
                  c[2] + (u[2] * ct + w[2] * st) * r]));
    }
    return out;
  };
  const band = (A, B, m) => {
    for (let k = 0; k < A.length; k++) {
      const k2 = (k + 1) % A.length;
      quad(A[k], A[k2], B[k2], B[k], m);
    }
  };
  // a closed tube through a list of [centre, radius] along one axis
  const tube = (axis, u, w, steps, m, capA, capB) => {
    const rings = steps.map(s => ring(s.c, u, w, s.r, s.sect || P.sect));
    for (let i = 0; i + 1 < rings.length; i++) band(rings[i], rings[i + 1], m);
    // caps as fans of quads through the centre, kept as quads by pairing
    const cap = (rg, c, flip) => {
      const ci = v(c);
      for (let k = 0; k < rg.length; k++) {
        const k2 = (k + 1) % rg.length;
        quad(ci, flip ? rg[k2] : rg[k], flip ? rg[k] : rg[k2], ci, m);
      }
    };
    if (capA) cap(rings[0], steps[0].c, true);
    if (capB) cap(rings[rings.length - 1], steps[steps.length - 1].c, false);
    return rings;
  };

  const Z = [0, 0, 1], X = [1, 0, 0], Y = [0, 1, 0];

  // ---- crankcase: a barrel along the crank axis ---------------------------
  const zFront = -P.flangeLen, zBack = L.zAft + (P.accessories ? P.accLen : 0);
  tube(Z, X, Y, [
    { c: [0, 0, zFront], r: L.caseR * 0.86 },
    { c: [0, 0, zFront - 0.03], r: L.caseR },
    { c: [0, 0, zBack + 0.03], r: L.caseR },
    { c: [0, 0, zBack], r: L.caseR * 0.86 },
  ], ENG_MAT.case, true, true);

  // ---- prop flange + shaft ------------------------------------------------
  tube(Z, X, Y, [
    { c: [0, 0, 0], r: P.flangeR * P.bore },
    { c: [0, 0, -0.012], r: P.flangeR * P.bore },
    { c: [0, 0, -0.012], r: L.caseR * 0.52 },
    { c: [0, 0, zFront], r: L.caseR * 0.52 },
  ], ENG_MAT.flange, true, false);

  // ---- cylinders ----------------------------------------------------------
  // ONE builder for every architecture: the family only changed the angle and
  // the station, which is the whole design of ENG_ARCH.
  for (let i = 0; i < R.cyl; i++) {
    const a = L.ang[i], z = L.zOf(L.stn[i]);
    const dir = [Math.sin(a), Math.cos(a), 0];              // cylinder axis
    const u = [Math.cos(a), -Math.sin(a), 0], w = Z;        // its section plane
    const at = r => [dir[0] * r, dir[1] * r, z];
    const bore2 = P.bore / 2;
    // barrel, from the case wall out
    tube(dir, u, w, [
      { c: at(L.r0 * 0.72), r: bore2 * 1.06 },
      { c: at(L.r0), r: bore2 * 1.02 },
      { c: at(L.r0 + P.stroke * 0.96), r: bore2 * 1.02 },
    ], ENG_MAT.barrel, false, false);
    // COOLING FINS: what makes an air-cooled engine read as one. Discs, not a
    // texture — they are the silhouette inside an open cowl.
    for (let k = 0; k < P.finN; k++) {
      const t = (k + 0.5) / P.finN;
      const rr = L.r0 + P.stroke * 0.96 * t;
      const th = P.stroke * 0.96 / P.finN * 0.34;
      const A0 = ring(at(rr - th), u, w, bore2 * 1.04, P.sect);
      const A1 = ring(at(rr - th), u, w, P.finR * bore2, P.sect);
      const B1 = ring(at(rr + th), u, w, P.finR * bore2, P.sect);
      const B0 = ring(at(rr + th), u, w, bore2 * 1.04, P.sect);
      band(A0, A1, ENG_MAT.fin); band(A1, B1, ENG_MAT.fin);
      band(B1, B0, ENG_MAT.fin);
    }
    // head
    const hz = L.r0 + P.stroke * 0.96;
    tube(dir, u, w, [
      { c: at(hz), r: bore2 * 1.06 },
      { c: at(hz + 0.012), r: L.headR },
      { c: at(hz + P.bore * 0.50), r: L.headR },
      { c: at(hz + P.bore * 0.62), r: L.headR * 0.80 },
    ], ENG_MAT.head, false, true);
    // exhaust stub, angled aft off the head
    if (P.exhaust) {
      const eb = at(hz + P.bore * 0.30);
      const ed = [dir[0] * 0.45, dir[1] * 0.45, -0.89];
      const en = Math.hypot(ed[0], ed[1], ed[2]);
      const e = [ed[0] / en, ed[1] / en, ed[2] / en];
      const eu = [Math.cos(a), -Math.sin(a), 0];
      const ew = [-(e[1] * eu[2] - e[2] * eu[1]), -(e[2] * eu[0] - e[0] * eu[2]),
                  -(e[0] * eu[1] - e[1] * eu[0])];
      const p1 = [eb[0] + e[0] * P.bore * 0.9, eb[1] + e[1] * P.bore * 0.9,
                  eb[2] + e[2] * P.bore * 0.9];
      tube(e, eu, ew, [
        { c: eb, r: P.bore * 0.17, sect: 8 },
        { c: p1, r: P.bore * 0.15, sect: 8 },
      ], ENG_MAT.exhaust, false, true);
    }
  }

  // ---- sump / induction below the case ------------------------------------
  // A radial has neither (its case is round and the induction is behind), so
  // this follows the same rule the envelope uses rather than a second one.
  if (L.sump > 1e-4 && R.arch !== 'radial' && R.cyl) {
    const yTop = -L.caseR * 0.55, yBot = -L.caseR - L.sump;
    const zA = zFront - 0.02, zB = zBack + 0.02;
    const xw = L.caseR * 0.82;
    const P4 = (a, b, c, d, m) => quad(a, b, c, d, m);
    const rowAt = (z, y, w) => [v([-w, y, z]), v([w, y, z])];
    const t0 = rowAt(zA, yTop, xw), t1 = rowAt(zB, yTop, xw);
    const b0 = rowAt(zA, yBot, xw * 0.66), b1 = rowAt(zB, yBot, xw * 0.66);
    P4(t0[0], t0[1], t1[1], t1[0], ENG_MAT.case);      // top (inside the case)
    P4(b0[1], b0[0], b1[0], b1[1], ENG_MAT.case);      // bottom
    P4(t0[1], t0[0], b0[0], b0[1], ENG_MAT.case);      // front
    P4(t1[0], t1[1], b1[1], b1[0], ENG_MAT.case);      // back
    P4(t0[0], b0[0], b1[0], t1[0], ENG_MAT.case);      // left
    P4(t1[1], b1[1], b0[1], t0[1], ENG_MAT.case);      // right
  }

  // ---- accessory case at the back ----------------------------------------
  if (P.accessories) {
    tube(Z, X, Y, [
      { c: [0, 0, zBack], r: L.caseR * 0.94 },
      { c: [0, 0, L.zAft + P.accLen * 0.5], r: L.caseR * 0.82 },
      { c: [0, 0, L.zAft], r: L.caseR * 0.58 },
    ], ENG_MAT.acc, false, true);
  }

  return { V, F, resolved: R };
}

if (typeof module !== 'undefined')
  module.exports = { ENG_ARCH, ENG_DEFAULT, ENG_MAT, ENG_UNIT,
                     engResolve, engBuild };
if (typeof window !== 'undefined')
  window.ENG_GEN = { ENG_ARCH, ENG_DEFAULT, ENG_MAT, ENG_UNIT,
                     engResolve, engBuild };
