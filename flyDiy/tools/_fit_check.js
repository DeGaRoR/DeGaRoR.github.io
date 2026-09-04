#!/usr/bin/env node
// _fit_check.js — THE VERDICT for the FITTING SITE (G81).
//
//   node tools/_fit_check.js              ->  "GATE FIT: PASS" (or the failures)
//   node tools/_fit_check.js --sites      ->  print every resolved site
//   node tools/_fit_check.js --selftest   ->  break it six ways; all must fail
//
// The site resolver has to be right about six things, and not one of them is
// visible by eye — a fitting 3 cm inside the skin and a fitting on the skin
// are the same picture from two metres away.
//
//   1 IT LANDS ON THE SKIN. The interpolated point is within a millimetre of
//     the mesh's own surface. This is the whole claim, and it is checked
//     against the TRIANGLES rather than against the resolver's own arithmetic.
//   2 IT LANDS ON BOTH FLANKS, and on exactly two of them. sC is mirrored by
//     construction, so a metric target names one point per side; three would
//     mean the rail dedup has stopped working, one would mean the mirror has.
//   3 THE SNAP REACHES REAL STRUCTURE. 'ring' lands on an integer station,
//     'bay' in the middle of a bay, 'rail' on an integer rail — to 1e-6, since
//     the second lookup is exact and any drift means it silently fell back.
//   4 THE NORMAL POINTS OUT. Away from the section centre, every time. An
//     inward normal is how a filler cap ends up inside the tank.
//   5 IT REFUSES. Off the body, and on the glazing, it returns NOTHING rather
//     than the nearest thing it could find.
//   6 THE TWO DERIVATIONS AGREE. The field found the point by interpolation;
//     the airframe contract finds it by ray cast. They must land within a
//     millimetre of each other or a frame convention has drifted.
//
// NEGATIVE-VERIFIED (the G48 rule, and the G60 lesson that a test whose
// failure looks like its pass is not a test): --selftest breaks each check at
// its source and requires it to go red. A check that passes on a broken build
// is not evidence.
'use strict';
const path = require('path');
const G = require(path.join(__dirname, '_cage_gen.js'));
const FS_ = require(path.join(__dirname, '_fit_site.js'));

const argv = process.argv.slice(2);
const SELFTEST = argv.includes('--selftest');
const SHOW = argv.includes('--sites');

let PLACED = 0, UNPLACED = 0;
// EVERY ROW MUST BE REACHABLE. A requirement no buildable aeroplane ever needs
// is a row that has quietly stopped meaning anything — the same rule GATE
// PARTS applies to its `when` clauses, for the same reason. Tallied across
// every case and the whole spread of specs below, then asserted once.
const REACHED = {};
const FIT_FORMS = {};
const fail = [];
const check = (ok, label, extra) => {
  if (!ok) fail.push(label + (extra ? ' — ' + extra : ''));
  return ok;
};

// ---------------------------------------------------------------------------
// the builds under test. Each reaches a different emitter, for the reason
// _surf_check.js gives: otherwise this is one test repeated.
// ---------------------------------------------------------------------------
const CASES = [
  ['stock', {}],
  ['round top', { topRound: 1 }],
  ['rod boom', { boomStyle: 1 }],
  ['taper', { taperOn: 1, taperPanels: 1 }],
  ['doors + windows', { doorOn: 1, doorPax: 1, skylight: 1 }],
  ['mirrored pod', { mirror: 1 }],
];

// the display mesh, exactly as _cage_ui.js builds it before PAGE.post — the
// layers see this and nothing else, so the verdict must too
function displayMesh(over) {
  const D = G.cageDefaults();
  const P = JSON.parse(JSON.stringify(D));
  for (const k in over) P[k] = over[k];
  const spec = G.cageSpec(P);
  let s = G.buildCage2(spec, 'crease');
  for (let i = 0; i < 2; i++) s = G.cageSubdivide(s);
  if (G.cageGlassSill) s = G.cageGlassSill(s, spec);
  if (G.cageCut) s = G.cageCut(s, spec);
  if (G.cageCanopy) s = G.cageCanopy(s, spec);
  s = G.cageRims(s, spec);
  if (G.cageInterior) s = G.cageInterior(s, spec);
  return s;
}

// ---------------------------------------------------------------------------
// check 1's instrument: distance from a point to the mesh's own triangles.
// Deliberately NOT the resolver's arithmetic — a bug that put the point in the
// wrong place would otherwise be confirmed by the thing that made it.
// ---------------------------------------------------------------------------
function distToSkin(mesh, p) {
  const V = mesh.V, A = mesh.A;
  let best = Infinity;
  for (const f of mesh.F) {
    const ids = f && f.v;
    if (!ids || ids.length < 3) continue;
    let bare = false;
    for (const i of ids) if (!A[i]) { bare = true; break; }
    if (bare) continue;
    const tris = ids.length >= 4 ? [[0, 1, 2], [0, 2, 3]] : [[0, 1, 2]];
    for (const t of tris) {
      const d = ptTri(p, V[ids[t[0]]], V[ids[t[1]]], V[ids[t[2]]]);
      if (d < best) best = d;
      if (best < 1e-7) return best;
    }
  }
  return best;
}
// point-triangle distance, clamped barycentric (Ericson's region table, the
// short form: project, then clamp into the triangle and re-measure)
function ptTri(p, a, b, c) {
  const ab = [b[0]-a[0], b[1]-a[1], b[2]-a[2]];
  const ac = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
  const ap = [p[0]-a[0], p[1]-a[1], p[2]-a[2]];
  const d1 = ab[0]*ap[0]+ab[1]*ap[1]+ab[2]*ap[2];
  const d2 = ac[0]*ap[0]+ac[1]*ap[1]+ac[2]*ap[2];
  if (d1 <= 0 && d2 <= 0) return Math.hypot(ap[0], ap[1], ap[2]);
  const bp = [p[0]-b[0], p[1]-b[1], p[2]-b[2]];
  const d3 = ab[0]*bp[0]+ab[1]*bp[1]+ab[2]*bp[2];
  const d4 = ac[0]*bp[0]+ac[1]*bp[1]+ac[2]*bp[2];
  if (d3 >= 0 && d4 <= d3) return Math.hypot(bp[0], bp[1], bp[2]);
  const cp = [p[0]-c[0], p[1]-c[1], p[2]-c[2]];
  const d5 = ab[0]*cp[0]+ab[1]*cp[1]+ab[2]*cp[2];
  const d6 = ac[0]*cp[0]+ac[1]*cp[1]+ac[2]*cp[2];
  if (d6 >= 0 && d5 <= d6) return Math.hypot(cp[0], cp[1], cp[2]);
  const vc = d1*d4 - d3*d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    return dist(p, [a[0]+ab[0]*v, a[1]+ab[1]*v, a[2]+ab[2]*v]);
  }
  const vb = d5*d2 - d1*d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    return dist(p, [a[0]+ac[0]*w, a[1]+ac[1]*w, a[2]+ac[2]*w]);
  }
  const va = d3*d6 - d5*d4;
  if (va <= 0 && (d4-d3) >= 0 && (d5-d6) >= 0) {
    const w = (d4-d3) / ((d4-d3) + (d5-d6));
    return dist(p, [b[0]+(c[0]-b[0])*w, b[1]+(c[1]-b[1])*w, b[2]+(c[2]-b[2])*w]);
  }
  const den = 1 / (va + vb + vc);
  const v = vb * den, w = vc * den;
  return dist(p, [a[0]+ab[0]*v+ac[0]*w, a[1]+ab[1]*v+ac[1]*w,
                  a[2]+ab[2]*v+ac[2]*w]);
}
const dist = (p, q) => Math.hypot(p[0]-q[0], p[1]-q[1], p[2]-q[2]);

// ---------------------------------------------------------------------------
// THE PROBE RULES. Chosen to sit on real skin on every case above: the flanks
// at the waist and below it, and the belly. Nothing near the nose cap, where a
// ring collapses, and nothing above the waist on the cabin, which is glazed.
// ---------------------------------------------------------------------------
const PROBES = [
  { key: 'flank low',  sL: 2.5, sC: -0.40, snap: 'free' },
  { key: 'flank bay',  sL: 2.5, sC: -0.40, snap: 'bay' },
  { key: 'flank ring', sL: 2.2, sC: -0.35, snap: 'ring' },
  { key: 'waist rail', sL: 3.0, sC: -0.20, snap: 'rail' },
  { key: 'belly',      sL: 2.0, sC: -0.90, snap: 'free' },
];

function run(mode) {
  for (const [name, over] of CASES) {
    let mesh;
    try { mesh = displayMesh(over); }
    catch (e) { check(false, name + ': build threw', e.message); continue; }

    // --- 5 IT REFUSES ------------------------------------------------------
    // off the end of any fuselage, in both directions
    let off = FS_.accessSites(mesh, { sL: 999, sC: 0 });
    if (mode === 'refuse') off = [{ p: [0, 0, 0], n: [0, 1, 0], mat: 'body' }];
    check(off.length === 0, name + ': a station off the body returned a site',
      off.length + ' of them');
    const under = FS_.accessSites(mesh, { sL: 2.5, sC: -99 });
    check(under.length === 0,
      name + ': a rail off the section returned a site', under.length + '');

    for (const pr of PROBES) {
      let sites = FS_.accessSites(mesh, pr);
      const tag = name + '/' + pr.key;
      if (!check(sites.length > 0, tag + ': no site at all')) continue;

      // --- 2 BOTH FLANKS, EXACTLY TWO -------------------------------------
      if (mode === 'mirror') sites = sites.concat(sites[0]);
      check(sites.length === 2, tag + ': expected one site per flank',
        'got ' + sites.length);
      const sides = sites.map(s => s.side).sort().join(',');
      check(sides === 'port,star' || sites.length !== 2,
        tag + ': the two sites are not one per flank', sides);

      for (const s of sites) {
        const p = mode === 'onskin' ? [s.p[0] + 0.05, s.p[1], s.p[2]] : s.p;

        // --- 1 ON THE SKIN ------------------------------------------------
        const d = distToSkin(mesh, p);
        check(d < 1e-3, tag + ': site is not on the skin',
          (d * 1000).toFixed(2) + ' mm off');

        // --- 4 THE NORMAL POINTS OUT --------------------------------------
        const cy = FS_.sectionCY(mesh, s.p[2]);
        let n = s.n;
        if (mode === 'normal') n = [-n[0], -n[1], -n[2]];
        const outward = n[0] * s.p[0] + n[1] * (s.p[1] - cy);
        check(outward >= -1e-9, tag + '/' + s.side + ': the normal points IN',
          outward.toFixed(4));

        // --- 3 THE SNAP REACHES REAL STRUCTURE ----------------------------
        let st = s.st, lv = s.lv;
        if (mode === 'snap') { st += 0.013; lv += 0.013; }
        if (pr.snap === 'ring')
          check(Math.abs(st - Math.round(st)) < 1e-6,
            tag + ": 'ring' did not land on a structural ring",
            'st = ' + st.toFixed(6));
        if (pr.snap === 'bay')
          check(Math.abs((st - Math.floor(st)) - 0.5) < 1e-6,
            tag + ": 'bay' did not land in the middle of a bay",
            'st = ' + st.toFixed(6));
        if (pr.snap === 'rail')
          check(Math.abs(lv - Math.round(lv)) < 1e-6,
            tag + ": 'rail' did not land on a structural rail",
            'lv = ' + lv.toFixed(6));

        // the resolver must never hand back a surface it declared not-skin
        check(!FS_.NOT_SKIN.has(s.mat),
          tag + ': site landed on ' + s.mat + ', which is not skin');
      }

      if (SHOW && name === 'stock')
        for (const s of sites)
          console.log('   ' + pr.key.padEnd(11) + s.side.padEnd(6) +
            ' p(' + s.p.map(v => v.toFixed(3)).join(', ') + ')' +
            '  st ' + s.st.toFixed(3) + '  lv ' + s.lv.toFixed(3) +
            '  ' + s.mat);
    }
  }

  // --- 6 THE TWO DERIVATIONS AGREE ----------------------------------------
  // The airframe contract is browser-side (its material table needs THREE), so
  // the ray cast is reproduced here from its own published rule
  // (_gear_gen.js:515: the ray runs [sin(ang), -cos(ang)] from the section
  // centre). If siteToAF's convention ever drifts from that, this goes red.
  {
    const mesh = displayMesh({});
    for (const pr of PROBES) {
      const sites = FS_.accessSites(mesh, pr);
      for (const s of sites) {
        const cy = FS_.sectionCY(mesh, s.p[2]);
        const { ang } = FS_.siteToAF({ cyAt: () => cy }, s);
        const r = Math.hypot(s.p[0], s.p[1] - cy);
        let q = [Math.sin(ang) * r, cy - Math.cos(ang) * r, s.p[2]];
        if (mode === 'af') q = [q[0] + 0.02, q[1], q[2]];
        const d = dist(s.p, q);
        check(d < 1e-3, 'stock/' + pr.key + '/' + s.side +
          ': the field and the contract disagree about where this is',
          (d * 1000).toFixed(3) + ' mm apart');
      }
    }
  }
}

// ---------------------------------------------------------------------------
// THE END-TO-END PASS (G83): the real table, on the real mesh, with the real
// geometry. The checks above prove the SITE is right; these prove that what
// gets built there is actually attached to the aeroplane.
//
//   A EVERY REQUIRED FITTING IS PLACED, or is explicitly reported unplaced.
//     Silence is the failure mode this whole arc exists to fix.
//   B IT PRODUCES GEOMETRY. A form that draws nothing is worse than a missing
//     one, because the count says it is there.
//   C IT IS WHERE ITS SITE IS. Every vertex within the fitting's own declared
//     size of its mount point — the G58.2 lesson, where a part rebased about
//     its pivot and never repositioned drew itself 3.5 m aft and looked
//     merely intermittent.
//   D IT STANDS OUT, NOT IN. No vertex more than 12 mm below the skin along
//     the site normal. An inward-drawn cap is invisible rather than wrong,
//     which is exactly why it needs a number rather than a look.
// ---------------------------------------------------------------------------
// The two modules the placement pass needs, loaded once. `_fit_gen.js` is an
// IIFE onto window, so node gets one; `60_gen_spec.js` is a bundle part rather
// than a module, so it is evaluated in a vm and its declarations pulled out.
let _AC = null, _FG = null;
function FITGEN() {
  if (_FG) return _FG;
  const g = (typeof globalThis !== 'undefined') ? globalThis : global;
  if (!g.window) g.window = g;
  _FG = require(path.join(__dirname, '_fit_gen.js'));
  for (const k in _FG.FORMS) FIT_FORMS[k] = 1;
  return _FG;
}
function ACC() {
  if (_AC) return _AC;
  const fs2 = require('fs'), vm = require('vm');
  const src = fs2.readFileSync(
    path.join(__dirname, '..', 'src', 'core', '60_gen_spec.js'), 'utf8');
  const ctx = { console, Math, JSON, Object, Array, Number, String, Boolean,
                isFinite, isNaN, parseFloat, parseInt, Error, RHO: 1.225 };
  vm.createContext(ctx);
  vm.runInContext(src + String.fromCharCode(10) +
    ';__O={genAccessNeedsCage,genAccessList,GEN_ACCESS,GEN_BUILD_GRAMMAR,genNormaliseSpec,genAccessNeeds,GEN_DEFAULT};',
    ctx);
  return (_AC = ctx.__O);
}

// a bag that REMEMBERS, so the geometry can be measured rather than trusted
const recBag = () => {
  const pts = []; let n = 0;
  return { pts, v: p2 => { pts.push(p2); return n++; },
           quad: () => {}, tri: () => {}, get tris() { return 0; } };
};

function runPlacement(mode) {
  FITGEN(); ACC();
  for (const [name, over] of CASES) {
    const mesh = displayMesh(over);
    const D = G.cageDefaults();
    const P = JSON.parse(JSON.stringify(D));
    for (const k in over) P[k] = over[k];
    // EVERY CASE IS PLACED AGAINST A SPREAD OF AEROPLANES, not just the
    // default one. The cases vary the SHAPE; most of GEN_ACCESS keys on the
    // SYSTEMS and the fuel, so a shape-only sweep never builds an IFR
    // aeroplane with wing tanks at all — and that is the exact combination
    // where the fuel drain and the transponder aerial snapped into the same
    // bay and drew on top of each other. A gate that only ever places the
    // default record has not met most of its own table.
    for (const spread of PLACE_SPREAD) placeOne(name, mesh, P, spread, mode);
  }
}

const PLACE_SPREAD = [
  {},
  { tank: 'wing', systems: 'ifr', material: 'alloy', cargo: 0.9 },
  { systems: 'minimal', material: 'wood' },
  { tank: null, fuelL: 0, systems: 'ifr' },
  { sillH: 0.9, cargo: 1.4 },
];

function placeOne(name0, mesh, P, over, mode) {
  const AC = ACC(), FG = FITGEN();
  {
    const name = name0 + (Object.keys(over).length ? '+' +
      Object.keys(over).join('/') : '');
    const FSc = (G.CAGE_UNIT || 1) * (P.planeScale || 1);
    const R = Object.assign(AC.genAccessNeedsCage(P, {}), over);
    const rows = AC.genAccessList(R);
    check(rows.length > 0, name + ': the table asked for nothing at all');
    for (const row of rows) {
      // THE ACCEPTANCE TEST, MADE MECHANICAL: a fitting nobody can explain is
      // decoration, and decoration is what this table exists to refuse.
      check(row.serves && row.serves.length > 3,
        name + '/' + row.key + ': does not say what it serves');
      check(row.form, name + '/' + row.key + ': names no form');
    }
    for (const key in AC.GEN_ACCESS) REACHED[key] = REACHED[key] || 0;
    for (const row of rows) REACHED[row.key] = (REACHED[row.key] || 0) + row.n;

    let placedN = 0, unplacedN = 0;
    // --- E NO TWO FITTINGS IN ONE PLACE -------------------------------
    // Two rows that snap to the same station and the same rail draw into the
    // same millimetre, which reads as z-fighting rather than as a mistake —
    // the comm aerial and the beacon did exactly this until the beacon
    // stopped snapping to a ring it had no reason to be on.
    const seenAt = [];
    for (const row of rows) {
      const tag = name + '/' + row.key;
      // WHICH SURFACE A ROW IS ON DECIDES WHAT CAN BE TESTED HERE, and this
      // gate must not pretend otherwise. The fuselage cage is built from
      // _cage_gen in node, so its rows are placed and measured for real. The
      // COWL is an analytic surface with a module export, so it is evaluated
      // below. The WING is a browser layer — it runs the game's generator into
      // THREE geometry — so its rows are checked for a well-formed
      // DECLARATION here and verified by the pixel pass in the page.
      //
      // Running a wing row against the fuselage mesh would "pass" loudly and
      // mean nothing, which is worse than admitting the limit.
      if (row.on !== 'body') {
        checkDeclared(name, row);
        if (row.on === 'cowl') checkCowl(name, row, mode);
        else UNPLACED++;
        if (SHOW && name === 'stock')
          console.log('   ~  ' + row.key.padEnd(13) + ' on the ' + row.on +
            (row.on === 'cowl' ? ' — evaluated analytically'
                               : ' — declaration checked, drawn in the page'));
        continue;
      }
      const form = FG.FORMS[row.form];
      if (!check(form, tag + ": no form named '" + row.form + "'")) continue;

      // METRES IN, CAGE UNITS FOR THE LOOKUP — the field is in cage units and
      // GEN_ACCESS is in metres. `lv` is a rail index and is NOT scaled.
      const sites = FS_.accessSites(mesh, {
        sL: row.at.sL / FSc,
        lv: row.at.lv,
        sC: row.at.sC != null ? row.at.sC / FSc : undefined,
        snap: row.snap, side: row.side,
      });
      // --- A placed, or honestly unplaced -------------------------------
      if (!sites.length) {
        unplacedN++;
        if (SHOW && name === 'stock')
          console.log('   !  ' + row.key.padEnd(13) + ' NO SITE at sL ' +
            row.at.sL.toFixed(2) + ' lv ' + row.at.lv +
            ' snap ' + row.snap + ' side ' + row.side);
        continue;
      }
      // A 'centre' row asks for one fitting on the spine however many its
      // count says, because the spine is single — the count is what the
      // aeroplane HAS, and both wing caps are one row.
      const got = sites.length + (mode === 'count' ? 1 : 0);
      check(got === row.n || row.side === 'centre',
        tag + ': the table wants ' + row.n + ' but the skin offers ' + got);

      for (const site of sites) {
        const pm = [site.p[0] * FSc, site.p[1] * FSc, site.p[2] * FSc];
        const F = FS_.frameAt(pm, site.n);
        const bags = { paint: recBag(), metal: recBag(), lens: recBag() };
        try { form(bags, F, row.size || {}, { pitch: 0.048 }); }
        catch (e) { check(false, tag + ': the form threw', e.message); continue; }
        const pts = bags.paint.pts.concat(bags.metal.pts, bags.lens.pts);

        // --- B it drew something ----------------------------------------
        if (!check(pts.length > 0, tag + ': the form drew nothing')) continue;
        placedN++; PLACED++;
        const sz = row.size || {};
        // TWO DIFFERENT QUESTIONS, TWO DIFFERENT NUMBERS, and conflating them
        // broke each check in turn. `span` is how far the geometry REACHES —
        // what check C bounds, and a wire aerial really does run 1.2 m aft.
        // `foot` is what it OCCUPIES on the skin — what check E needs, because
        // the wire passes clean over whatever is under it. Only a fitting
        // whose reach and footprint differ declares `foot`.
        const span = Math.max(sz.w || 0, sz.h || 0, sz.d || 0,
          sz.len || 0, sz.reach || 0, sz.run || 0, sz.c || 0, 0.05);
        const foot = sz.foot || span;
        // TWO FITTINGS MUST NOT OVERLAP, and the test has to know their SIZE.
        // A flat 20 mm threshold passed a venturi and an OAT probe 43 mm
        // apart — neither was "on top of" the other by that measure, and both
        // are 60-190 mm long, so on the aeroplane they interpenetrated.
        // Half of each one's own span, plus a finger's width to fit a spanner
        // in, is what "clear of each other" actually means.
        const clear = (a2, b2) => a2 * 0.5 + b2 * 0.5 + 0.02;
        for (const q of seenAt) {
          const d = dist(q.p, pm);
          check(d > clear(foot, q.foot), tag + ': overlaps ' + q.key,
            d.toFixed(3) + ' m apart, needs ' + clear(foot, q.foot).toFixed(3));
        }
        seenAt.push({ key: row.key, p: pm, foot });
        if (SHOW && name === 'stock')
          console.log('   +  ' + row.key.padEnd(13) + site.side.padEnd(7) +
            'p(' + pm.map(v => v.toFixed(2)).join(', ') + ')  ' +
            String(pts.length).padStart(4) + ' v  on ' + site.mat);

        // --- C it is where its site is ----------------------------------
        const lim = span * 1.6 + 0.05;
        let far = 0;
        for (const q of pts) {
          const d = dist(q, mode === 'stray' ? [0, 0, 0] : pm);
          if (d > far) far = d;
        }
        check(far <= lim, tag + '/' + site.side +
          ': geometry is ' + far.toFixed(3) + ' m from its own site (limit ' +
          lim.toFixed(3) + ')');

        // --- D it stands out, not in ------------------------------------
        let deepest = 0;
        for (const q of pts) {
          const w = (q[0] - pm[0]) * site.n[0] + (q[1] - pm[1]) * site.n[1] +
                    (q[2] - pm[2]) * site.n[2];
          if (w < deepest) deepest = w;
        }
        if (mode === 'sunk') deepest = -0.05;
        check(deepest > -0.012, tag + '/' + site.side +
          ': it is drawn ' + (-deepest * 1000).toFixed(1) + ' mm INTO the skin');
      }
    }
    if (SHOW && name === 'stock')
      console.log('  stock: ' + placedN + ' placed on the body, ' +
                  unplacedN + ' elsewhere');
  }
}

// A ROW ON A SURFACE THIS GATE CANNOT BUILD still has to be well formed, or
// it will fail in the page where nothing is watching. Everything that does not
// need the geometry is asserted here.
function checkDeclared(name, row) {
  const tag = name + '/' + row.key;
  check(row.form && FIT_FORMS[row.form], tag + ": names no known form",
    String(row.form));
  check(row.size && Object.keys(row.size).length,
    tag + ': carries no size');
  if (row.on === 'wing') {
    check(isFinite(row.at.sL) && row.at.sL >= 0,
      tag + ': spanwise station is not a distance from the root',
      String(row.at.sL));
    check(isFinite(row.at.lv), tag + ': no spar coordinate', String(row.at.lv));
    // lv runs from -sparF/span at the LE to (1-sparF)/span at the TE; with the
    // stock 15/65% spars that is -0.30 .. 1.70, and anything outside it is off
    // the aerofoil rather than on a part of it
    check(row.at.lv > -0.30 && row.at.lv < 1.70,
      tag + ': spar coordinate is off the aerofoil', String(row.at.lv));
    check(row.side === 'upper' || row.side === 'lower',
      tag + ': a wing fitting must say which SKIN it is on', String(row.side));
  }
  if (row.on === 'cowl') {
    check(isFinite(row.at.frac) && row.at.frac > 0 && row.at.frac < 1,
      tag + ': cowl station is not a fraction of its length',
      String(row.at.frac));
    check(isFinite(row.at.az), tag + ': no section angle', String(row.at.az));
  }
}

// THE COWL, EVALUATED. _cowl_gen.js has a module export and a default
// parameter set, so its surface can be asked the same questions in node that
// the layer asks in the page: is the point on the shell, and does its normal
// point out of it.
let COWL = null;
function checkCowl(name, row, mode) {
  if (COWL === null) {
    try { COWL = require(path.join(__dirname, '_cowl_gen.js')); }
    catch (e) { COWL = false; }
    if (COWL && COWL.prepareLid) { try { COWL.prepareLid(); } catch (e) {} }
  }
  if (!COWL || !COWL.surfPoint || !COWL.zEnd) return;
  const tag = name + '/' + row.key;
  const zEnd = COWL.zEnd();
  if (!check(zEnd > 1e-4, tag + ': the cowl has no length')) return;
  const th = row.at.az * Math.PI / 180;
  const z = zEnd * row.at.frac;
  const c = COWL.surfPoint(th, z);
  if (!check(c && isFinite(c[0]) && isFinite(c[1]),
    tag + ': the cowl surface does not evaluate there')) return;
  PLACED++;
  // ON THE SHELL: the implicit form is < 1 inside the section and > 1 outside,
  // so a point ON it evaluates to 1. This is the cowl's own second opinion
  // about where its surface is, the way the airframe contract is the
  // fuselage's.
  const f = COWL.sectF ? COWL.sectF(c[0], c[1], z) : 1;
  const ff = mode === 'cowl' ? 1.4 : f;
  check(Math.abs(ff - 1) < 0.06, tag +
    ': the point is not on the cowl surface', 'sectF = ' + ff.toFixed(4));
  // and it must be on the side the row asked for
  check(row.side !== 'port' || c[0] < 0,
    tag + ': asked for the port side and landed at x = ' + c[0].toFixed(3));
}

// ---------------------------------------------------------------------------
// IT SURVIVES BEING SAVED (G85)
// ---------------------------------------------------------------------------
// What an aeroplane WEARS is saved because what an aeroplane IS is saved: the
// fittings are derived, so the persistence that matters is the equipment's,
// not the fittings'. `fuel.tank`, `systems.fit`, `fuselage.material` and
// `cargo.len` are ordinary spec fields and always were — this asserts that a
// spec carrying them normalises without losing them, and that the requirements
// record reads the SAME aeroplane back.
//
// The layer's own switches ride through `cageToSpec` into `spec.cage`, which is
// how all eight cage layers persist theirs (the crew's seats, the gear's
// stations, the engine's dress). That path is asserted here too, because it is
// documented behaviour rather than obvious behaviour, and a change to that
// boundary would silently stop saving which fittings a build wears.
//
// THERE IS NO `spec.access` BLOCK AND NO VERSION BUMP, deliberately. The spec's
// own version note says the number exists "to be honest about the shape having
// changed" and that a migration must not "re-do what normalisation already
// does" — nothing about the shape changed, and genDefaults fills a missing
// field from GEN_DEFAULT without being told what version wrote the file.
function runSaved(mode) {
  const AC = ACC();
  const SPECS = [
    ['nose tank, basic, fabric',
     { fuel: { litres: 50, tank: 'nose' }, systems: { fit: 'basic' },
       fuselage: { material: 'tubeFabric' }, cargo: { len: 0 } }],
    ['wing tanks, ifr, alloy, cargo',
     { fuel: { litres: 72, tank: 'wing' }, systems: { fit: 'ifr' },
       fuselage: { material: 'alloy' }, cargo: { len: 0.9 } }],
    ['no tank, minimal, carbon',
     { fuel: { litres: 0 }, systems: { fit: 'minimal' },
       fuselage: { material: 'carbon' }, cargo: { len: 0 } }],
  ];
  for (const [label, spec] of SPECS) {
    // THROUGH THE SAVE AND BACK, as a build file would go: JSON both ways, then
    // the normaliser, which is what a loaded file actually meets.
    let back = JSON.parse(JSON.stringify(spec));
    if (mode === 'saved') back.fuel = { litres: 0 };
    const norm = AC.genNormaliseSpec(back);
    const R0 = AC.genAccessNeeds(norm);
    const want = {
      tank: spec.fuel.litres > 0 ? spec.fuel.tank : null,
      systems: spec.systems.fit,
      material: spec.fuselage.material,
      cargo: spec.cargo.len,
    };
    for (const k in want)
      check(R0[k] === want[k], 'saved/' + label + ': ' + k +
        ' did not survive the round trip',
        'wrote ' + want[k] + ', read ' + R0[k]);
    // and the fittings it asks for are the same on both sides of the save
    const a = AC.genAccessList(AC.genAccessNeeds(
      AC.genNormaliseSpec(JSON.parse(JSON.stringify(spec)))));
    const b = AC.genAccessList(R0);
    check(a.map(r => r.key + 'x' + r.n).join(',') ===
          b.map(r => r.key + 'x' + r.n).join(','),
      'saved/' + label + ': the aeroplane wears different fittings after a save',
      a.length + ' -> ' + b.length);
  }

  // THE LAYER'S SWITCHES, through the cage boundary they actually travel by
  const P = G.cageDefaults();
  Object.assign(P, { accOn: 1, accFluids: 0, accAccess: 1, accInstr: 1,
                     accAerials: 0, accHandling: 1, accDetail: 1.4 });
  const cage = G.cageToSpec(P);
  const P2 = G.cageFromSpec({ cage: mode === 'switch' ? {} : cage });
  for (const k of ['accOn', 'accFluids', 'accAccess', 'accInstr',
                   'accAerials', 'accHandling', 'accDetail'])
    check(P2[k] === P[k], 'saved/switches: ' + k + ' did not survive the save',
      'wrote ' + P[k] + ', read ' + P2[k]);
}

// EVERY ROW REACHED, over a spread of aeroplanes that is deliberately wider
// than the cage cases: the cases vary the SHAPE, and most of GEN_ACCESS keys
// on the SYSTEMS and the fuel, which no amount of shape-changing reaches.
function runReach(mode) {
  const fs2 = require('fs'), vm = require('vm');
  const src = fs2.readFileSync(
    path.join(__dirname, '..', 'src', 'core', '60_gen_spec.js'), 'utf8');
  const ctx = { console, Math, JSON, Object, Array, Number, String, Boolean,
                isFinite, isNaN, parseFloat, parseInt, Error, RHO: 1.225 };
  vm.createContext(ctx);
  vm.runInContext(src + String.fromCharCode(10) +
    ';__O={genAccessNeedsCage,genAccessList,GEN_ACCESS};', ctx);
  const AC = ctx.__O;
  const base = AC.genAccessNeedsCage({}, {});
  const SPREAD = [
    {}, { tank: 'wing' }, { tank: 'panel' }, { tank: null, fuelL: 0 },
    { systems: 'minimal' }, { systems: 'ifr' },
    { material: 'alloy' }, { material: 'wood' }, { material: 'carbon' },
    { cargo: 1.2 }, { sillH: 0.9 }, { wing: false }, { engine: false },
    { tailHalfW: 0.30 },
  ];
  for (const over of SPREAD) {
    const R = Object.assign({}, base, over);
    for (const row of AC.genAccessList(R))
      REACHED[row.key] = (REACHED[row.key] || 0) + row.n;
  }
  for (const key in AC.GEN_ACCESS) {
    const n = REACHED[key] || 0;
    check(n > (mode === 'reach' ? 1e9 : 0),
      'GEN_ACCESS.' + key + ' is never needed by any aeroplane');
  }
}

// ---------------------------------------------------------------------------
if (SELFTEST) {
  const MODES = [
    ['onskin', 'a site 5 cm off the skin'],
    ['mirror', 'a third site on one flank'],
    ['snap',   'a snap that misses structure by 0.013'],
    ['normal', 'a normal pointing inward'],
    ['refuse', 'a site returned for a station off the body'],
    ['af',     'the contract disagreeing by 2 cm'],
    ['stray',  'a fitting drawn away from its own site'],
    ['sunk',   'a fitting drawn 50 mm into the skin'],
    ['count',  'a row whose count disagrees with the skin'],
    ['reach',  'a row no aeroplane ever needs'],
    ['cowl',   'a cowl fitting off its own shell'],
    ['saved',  'equipment lost in the round trip'],
    ['switch', 'the family switches lost in the save'],
  ];
  let bad = 0;
  for (const [m, what] of MODES) {
    fail.length = 0;
    if (m === 'stray' || m === 'sunk') runPlacement(m);
    else if (m === 'count') runPlacement(m);
    else if (m === 'reach') runReach(m);
    else if (m === 'cowl') runPlacement(m);
    else if (m === 'saved' || m === 'switch') runSaved(m);
    else run(m);
    const caught = fail.length > 0;
    console.log((caught ? '  caught  ' : '  MISSED  ') + what +
      (caught ? ' (' + fail.length + ' failures)' : ''));
    if (!caught) bad++;
  }
  // and the clean build must be clean, or the checks are just noisy
  fail.length = 0;
  run(null); runPlacement(null); runReach(null); runSaved(null);
  if (fail.length) {
    console.log('  MISSED  the clean build should pass');
    for (const f of fail) console.log('          ' + f);
    bad++;
  } else console.log('  caught  the clean build passes');
  console.log(bad ? `FIT SELFTEST: FAIL (${bad} not caught)`
                  : 'FIT SELFTEST: OK');
  process.exit(bad ? 1 : 0);
}

if (SHOW) console.log('sites on the stock build:');
run(null);
runPlacement(null);
runReach(null);
runSaved(null);
// THE FIELD INDEX IS THE FULL WALK (2026-09-04). fieldHits bins the faces by
// their box in the searched field plane and walks one cell instead of the
// mesh (the energy layer's sweeps went from 2.0 s to 20 ms per fuselage
// build). The index may only ever REMOVE faces that cannot hold the point,
// so on every build here, on every axis pair, a grid of samples across the
// field and a little past it — and a sample ON every seventh fielded vertex,
// where a point sits on the shared edge of every face round it — the binned
// query and the whole-mesh scan must return the same hits, in the same order.
(function runIndex() {
  if (typeof FS_.fieldScan !== 'function') { check(false, 'index: _fit_site exports fieldScan'); return; }
  let samples = 0, bad = 0, hits = 0;
  const axes = [FS_.AX_RAIL, FS_.AX_METRIC, FS_.AX_STRUCT].filter(Boolean);
  for (const [name, over] of CASES) {
    const m = displayMesh(over);
    for (const ax of axes) {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i < m.V.length; i++) {
        const q = m.A[i]; if (!q) continue;
        const x = q[ax[0]], y = q[ax[1]];
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      const NX = 60, NY = 30;
      const at = (tx, ty, where) => {
        const full = FS_.fieldScan(m, ax, tx, ty, null), fast = FS_.fieldHits(m, ax, tx, ty);
        samples++; hits += full.length;
        if (JSON.stringify(full) !== JSON.stringify(fast)) {
          bad++;
          if (bad <= 3) check(false, 'index: ' + name + ' ax ' + ax.join(',') + ' at ' + where +
            ': the index walk found ' + fast.length + ' hits, the full walk ' + full.length);
        }
      };
      for (let i = 0; i <= NX; i++)
        for (let j = 0; j <= NY; j++)
          at(x0 - 0.05 + (x1 - x0 + 0.1) * i / NX, y0 - 0.05 + (y1 - y0 + 0.1) * j / NY, 'grid ' + i + ',' + j);
      for (let i = 0; i < m.V.length; i += 7) { const q = m.A[i]; if (q) at(q[ax[0]], q[ax[1]], 'vertex ' + i); }
    }
  }
  check(bad === 0, 'index: the binned field walk equals the full walk on every sample (' +
    bad + ' of ' + samples + ' differ)');
  check(hits > 0, 'index: the samples actually hit the field (' + hits + ' hits)');
  console.log('  field index: ' + samples + ' samples, ' + hits + ' hits, walked both ways, ' +
    bad + ' differ');
})();
// THE RUNNER'S CONTRACT (run_gates.js): exactly one final
// `GATE <ID>: PASS|FAIL`, and an exit code that agrees with it.
if (fail.length) {
  for (const f of fail) console.log('  ' + f);
  console.log('GATE FIT: FAIL (' + fail.length + ')');
  process.exit(1);
}
console.log('  ' + PLACED + ' fittings measured on ' + CASES.length +
            ' builds (fuselage against the mesh, cowl against its own' +
            ' surface), ' + UNPLACED + ' on the wing checked as declarations' +
            ' and drawn in the page');
console.log('GATE FIT: PASS');
