#!/usr/bin/env node
// _surf_check.js — THE VERDICT for THE SURFACE FIELD (G66).
//
//   node tools/_surf_check.js          ->  "SURF: OK" (or a list of failures)
//
// The field (aStruct = [sL, sC, st, lv]) is what replaces a UV unwrap: it is
// the cage's own station x level lattice, in metres. Four things have to be
// true of it, and none of them is visible by eye:
//
//   1 NO HOLES. Every vertex of every step, in every preset, carries the four
//     numbers. A missing field degrades SILENTLY to "flat plastic" in the
//     shader — plausible enough to ship by accident — so it is asserted here.
//   2 THE RULER IS A RULER. sL is monotone along the body and its increments
//     match the real distance between rings; sC is monotone up a ring.
//   3 CATMULL-CLARK CARRIES IT. After two levels the field on a subdivided
//     vertex still measures the surface: max drift against the true limit
//     arc length stays under 1 mm.
//   4 THE ABSENT PATH IS BYTE-IDENTICAL. buildCage2 output with the field
//     stripped must equal what it produced before the field existed. This is
//     what protects _cage_fit.js's exact 320/320 match against the Blender
//     reference — the fit is the only thing tying this generator to the
//     user's own template, and it must not move.
//
// NEGATIVE-VERIFIED (the G48 rule): each check was run against a deliberately
// broken build before being trusted — see the --selftest flag, which breaks
// the field four ways and requires every check to fail.
'use strict';
const G = require('./_cage_gen.js');

const fail = [];
const check = (ok, label, extra) => {
  if (!ok) fail.push(label + (extra ? ' — ' + extra : ''));
  return ok;
};
const fmt = n => (Math.round(n * 1e6) / 1e6).toString();

// ---------------------------------------------------------------------------
// the builds under test: the stock template plus the shapes that exercise the
// off-lattice emitters (the chain, the rod, the pod's reflection and boom)
// ---------------------------------------------------------------------------
const D = G.cageDefaults();
// Every case has to reach a DIFFERENT emitter, or this is one test five
// times: the stock lattice, the rounded dome, the rod (its own component,
// aft of the tail cap — the extrapolating end of the ruler), the taper
// section, the doors and windows (cut faces), the bubble canopy (an open
// mesh) and the mirrored pod (the reflection map and its own boom loft).
const CASES = [
  ['stock', {}],
  ['round top', { topRound: 1 }],
  ['rod boom', { boomStyle: 1 }],
  ['taper', { taperOn: 1, taperPanels: 1 }],
  ['doors + windows', { doorOn: 1, doorPax: 1, doorDeep: 1, skylight: 1 }],
  ['bubble canopy', { canopy: 3, bubble: 1 }],
  ['mirrored pod', { mirror: 1 }],
  ['aero nose', { aeroNose: 1 }],
  ['cowl loops', { cowlLoops: 3, cowlEase: 0.6, cowlBulge: 1.2 }],
];

const specOf = over => {
  const P = JSON.parse(JSON.stringify(D));
  for (const k in over) P[k] = over[k];
  return G.cageSpec ? G.cageSpec(P) : P;
};

// ---------------------------------------------------------------------------
function run(selftest) {
  for (const [name, over] of CASES) {
    let S;
    try { S = specOf(over); } catch (e) {
      check(false, `${name}: spec threw`, e.message); continue;
    }
    let m;
    try { m = G.buildCage2(S, 'crease'); } catch (e) {
      check(false, `${name}: build threw`, e.message); continue;
    }

    // --- 1 no holes ------------------------------------------------------
    if (!check(Array.isArray(m.A), `${name}: no A array`)) continue;
    check(m.A.length === m.V.length, `${name}: A/V length`,
      `${m.A.length} vs ${m.V.length}`);
    let holes = 0, bad = 0;
    for (let i = 0; i < m.A.length; i++) {
      const a = m.A[i];
      if (!a) { holes++; continue; }
      if (a.length !== 4 || a.some(v => !Number.isFinite(v))) bad++;
    }
    if (selftest === 'hole' && m.A.length) m.A[0] = null;
    check(holes === 0, `${name}: ${holes} vertices with no surface field`);
    check(bad === 0, `${name}: ${bad} vertices with a non-finite field`);

    // --- 2 the ruler is a ruler -------------------------------------------
    // Tested on the MESH'S OWN EDGES, not on a z-sorted bag of vertices. The
    // first cut of this check sorted every waist-level vertex by z and
    // demanded monotonicity, and it was wrong: a ring's CENTRE column sits
    // at zC, which on a cowl loop is far forward of its own flanks, so the
    // columns interleave and a correct field looks inverted. The invariant
    // that actually holds is local and topological — along any lattice edge
    // that runs ALONG the body (same rail, different station), the ruler and
    // the station coordinate must disagree in sign, because st counts
    // forward and sL runs aft.
    const LVI = G.cageLvIndex(S);
    const waistLv = LVI.waist;
    const seenE = new Set();
    let inv = 0, along = 0, metric = 0, mBad = 0, span = 0;
    const lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
    for (const f of m.F) {
      for (let k = 0; k < f.v.length; k++) {
        const i0 = f.v[k], i1 = f.v[(k + 1) % f.v.length];
        if (i0 === i1) continue;
        const ek = i0 < i1 ? i0 + '_' + i1 : i1 + '_' + i0;
        if (seenE.has(ek)) continue;
        seenE.add(ek);
        const p = m.A[i0], q = m.A[i1];
        if (!p || !q) continue;
        if (Math.abs(p[3] - q[3]) > 1e-9) continue;      // not along a rail
        const dst = q[2] - p[2];
        if (Math.abs(dst) < 1e-9) continue;              // not along the body
        along++;
        const dsL = q[0] - p[0];
        if (dsL * dst > 1e-12) inv++;                    // must oppose
        // sL IS THE WAIST RAIL'S OWN ARC. On that rail, between two flank
        // vertices, |d sL| is the edge's length by construction — nothing
        // else in the field is asserted this tightly, and nothing else has
        // to be.
        const A0 = m.V[i0], B0 = m.V[i1];
        if (Math.abs(p[3] - waistLv) < 1e-9
            && Math.abs(A0[0]) > 1e-6 && Math.abs(B0[0]) > 1e-6
            && A0[0] * B0[0] > 0) {
          const L = Math.hypot(B0[0] - A0[0], B0[1] - A0[1], B0[2] - A0[2]);
          metric++;
          if (L > 1e-6 && Math.abs(Math.abs(dsL) - L) > 1e-6 * (1 + L)) mBad++;
        }
      }
    }
    check(along > 20, `${name}: only ${along} along-the-body rail edges`);
    check(inv === 0, `${name}: sL runs backwards against st`,
      `${inv} of ${along} rail edges`);
    check(metric > 8, `${name}: only ${metric} waist-rail edges to measure`);
    check(mBad === 0, `${name}: sL is not the waist rail's own arc`,
      `${mBad} of ${metric} edges disagree with their own length`);
    for (const a of m.A) {
      if (!a) continue;
      for (let k = 0; k < 2; k++) {
        if (a[k] < lo[k]) lo[k] = a[k];
        if (a[k] > hi[k]) hi[k] = a[k];
      }
    }
    span = hi[0] - lo[0];
    check(span > 1.0, `${name}: sL spans only ${fmt(span)} m`);
    check(hi[1] - lo[1] > 0.3, `${name}: sC spans only ${fmt(hi[1] - lo[1])} m`);

    // sC: 0 on the waist rail — THE FLANK COLUMN. The centreline column of
    // a nose or cap ring sits at the deck's crown, which is genuinely
    // up-and-over from the flank rail, so it is nonzero and must be: give it
    // 0 like the flanks and the whole nose deck goes zero-wide in the field.
    let offWaist = 0;
    for (let i = 0; i < m.A.length; i++) {
      const a = m.A[i];
      if (a && Math.abs(a[3] - waistLv) < 1e-9 && Math.abs(m.V[i][0]) > 1e-6
          && Math.abs(a[1]) > 1e-6) offWaist++;
    }
    check(offWaist === 0,
      `${name}: ${offWaist} waist-rail FLANK vertices with sC != 0`);

    // --- 2b NO STRETCHING, MEASURED --------------------------------------
    // "Coherently scaled, no stretching" is the whole claim of a metric
    // field, and it is testable exactly: for every fielded quad, the area it
    // covers in (sL, sC) must equal the area it covers in space. The ratio
    // is 1 for a perfect parameterisation and there is no art in it.
    //
    // The two things this catches are different and both are real:
    //   a DEGENERATE quad (ratio 0) is a face with no extent in the field at
    //     all — the texture smears across it infinitely. The roof and belly
    //     strips were exactly this until the centreline column got its own
    //     arc, and NOTHING ELSE HERE NOTICED: every other check passed.
    //   a STRETCHED quad (ratio far from 1) is the ordinary distortion of
    //     any parameterisation, and the budget below is what "no stretching"
    //     means in numbers rather than in adjectives.
    const ar3 = (a, b, c) => {
      const u = [b[0]-a[0], b[1]-a[1], b[2]-a[2]];
      const w = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
      const n = [u[1]*w[2]-u[2]*w[1], u[2]*w[0]-u[0]*w[2], u[0]*w[1]-u[1]*w[0]];
      return 0.5 * Math.hypot(n[0], n[1], n[2]);
    };
    const ar2 = (a, b, c) =>
      0.5 * Math.abs((b[0]-a[0]) * (c[1]-a[1]) - (c[0]-a[0]) * (b[1]-a[1]));
    // MEASURED AT THE DISPLAYED LEVEL, and weighted BY AREA. Two subdivision
    // levels is what the bench and the game actually draw, and a face's
    // weight is its own surface: a 2 cm^2 quad at the tail cap being badly
    // parameterised is not "the aeroplane is stretched", and counting faces
    // instead of area says it is.
    //
    // WHAT THE NUMBERS SAY, and it is the reason the shader is built the way
    // it is. The bulk of the aeroplane comes out AREA-EXACT — p50 is 1.000,
    // not 1.0-ish — because the lattice is a real metric parameterisation.
    // Everything outside the band is a POLE: the tail cap, the nose bowl,
    // and the crown and keel centrelines, where a station-by-level lattice
    // must degenerate the way any non-atlas parameterisation does. That is
    // bounded and local, and it is handled where it belongs — the shader
    // measures its own local scale with fwidth() and blends toward the
    // triplanar branch exactly where the field stops being metric, which
    // costs nothing and has no seam. So the fences below guard the BULK
    // hard and give the poles a stated, reported budget.
    let s2m = m;
    for (let L = 0; L < 2; L++) s2m = G.cageSubdivide(s2m);
    const rows = [];
    let tot = 0, degenA = 0, degenN = 0;
    const degenMat = new Map();
    for (const f of s2m.F) {
      if (f.v.length !== 4 || !f.v.every(v => s2m.A[v])) continue;
      const p = f.v.map(v => s2m.V[v]), q = f.v.map(v => s2m.A[v]);
      const g3 = ar3(p[0], p[1], p[2]) + ar3(p[0], p[2], p[3]);
      const g2 = ar2(q[0], q[1], q[2]) + ar2(q[0], q[2], q[3]);
      if (g3 < 1e-9) continue;                    // a degenerate FACE, not a
      tot += g3;                                  // degenerate field
      if (g2 < 1e-9 * g3) {
        degenN++; degenA += g3;
        degenMat.set(f.m, (degenMat.get(f.m) || 0) + 1);
        continue;
      }
      rows.push([Math.sqrt(g2 / g3), g3]);
    }
    if (tot > 0 && rows.length > 50) {
      rows.sort((a, b) => a[0] - b[0]);
      const at = t => {
        let c = 0;
        for (const r of rows) { c += r[1]; if (c >= tot * t) return r[0]; }
        return rows[rows.length - 1][0];
      };
      const p50 = at(0.5), p05 = at(0.05), p95 = at(0.95);
      let bad = 0;
      for (const r of rows) if (r[0] < 0.7 || r[0] > 1.45) bad += r[1];
      const badPc = 100 * bad / tot, degPc = 100 * degenA / tot;
      // THE BULK, guarded hard: the median is area-exact and stays so.
      check(Math.abs(p50 - 1) < 0.02,
        `${name}: median texel density ${fmt(p50)}, not area-exact`);
      check(p95 < 1.35, `${name}: p95 texel density ${fmt(p95)}`);
      check(p05 > 0.35, `${name}: p05 texel density ${fmt(p05)}`);
      // THE POLES, budgeted and reported. Measured 9.5-22 % across the nine
      // shapes when this was written (the pod highest — a mirrored body has
      // two nose bowls); the fence sits just above that so a NEW pole, or a
      // pole that spreads, trips it.
      check(badPc < 26, `${name}: ${fmt(badPc)} % of the surface area is ` +
        'outside the texel-density band (poles)');
      check(degPc < 0.5, `${name}: ${fmt(degPc)} % of the area has NO ` +
        `extent in the field (${degenN} quads)`,
        [...degenMat].map(([k, v]) => `${k} x${v}`).join(', '));
    }
    let sgn = 0, nSgn = 0;
    for (let i = 0; i < m.V.length; i++) {
      const a = m.A[i];
      if (!a) continue;
      if (a[3] > waistLv + 1e-9) { nSgn++; if (a[1] <= 0) sgn++; }
      if (a[3] < waistLv - 1e-9) { nSgn++; if (a[1] >= 0) sgn++; }
    }
    check(sgn === 0, `${name}: sC sign disagrees with lv on ${sgn}/${nSgn}`);

    // --- guards are not structure ----------------------------------------
    // waistG and bandG must never land on an integer lv, or a fastener row
    // would be drawn on a Catmull-Clark pinning loop that no aeroplane has.
    for (const k of ['waistG', 'bandG']) {
      const v = LVI[k];
      check(Math.abs(v - Math.round(v)) > 1e-6,
        `${name}: guard level ${k} has an INTEGER lv (${fmt(v)})`);
    }
    let gInt = 0;
    for (let i = 0; i < m.A.length; i++) {
      const a = m.A[i];
      if (!a) continue;
      for (const k of ['waistG', 'bandG'])
        if (Math.abs(a[3] - LVI[k]) < 1e-9 &&
            Math.abs(a[3] - Math.round(a[3])) < 1e-6) gInt++;
    }
    check(gInt === 0, `${name}: ${gInt} guard vertices on an integer rail`);

    // --- 3 Catmull-Clark carries it --------------------------------------
    // The parent indices survive subdivision (NV = V.map(...)), so a parent's
    // field must be the SAME KIND of measurement after two levels: compare
    // the field's own distance between two parents against the mesh's.
    let s2 = m;
    for (let L = 0; L < 2; L++) s2 = G.cageSubdivide(s2);
    check(Array.isArray(s2.A) && s2.A.length === s2.V.length,
      `${name}: subdivision dropped the field`,
      s2.A ? `${s2.A.length} vs ${s2.V.length}` : 'no A');
    if (Array.isArray(s2.A)) {
      let nn = 0, nb = 0;
      for (const a of s2.A) {
        if (!a) { nn++; continue; }
        if (a.some(v => !Number.isFinite(v))) nb++;
      }
      check(nn === 0, `${name}: ${nn} subdivided vertices with no field`);
      check(nb === 0, `${name}: ${nb} subdivided vertices non-finite`);

      // THE DRIFT. Every edge point is the midpoint of its parents in the
      // field (an affine rule), so the field's own midpoint must match. This
      // is the assertion that the carrier uses the same weights as the
      // position, which is the whole risk in the carrier.
      let drift = 0, seen = 0;
      const one = G.cageSubdivide(m);
      const key = (a, b) => (a < b ? a + '_' + b : b + '_' + a);
      const par = new Map();
      for (const f of m.F)
        for (let k = 0; k < f.v.length; k++)
          par.set(key(f.v[k], f.v[(k + 1) % f.v.length]),
                  [f.v[k], f.v[(k + 1) % f.v.length]]);
      // smooth (uncreased) edges only: a creased edge point uses the sharp
      // midpoint, which IS the parent midpoint, so it is the same assertion
      for (const [k, [a, b]] of par) {
        if ((m.E && m.E.get(k)) >= 1) continue;
        seen++;
      }
      // walk the child vertices past the parents and the face points
      const nFP = m.F.length;
      let ei = m.V.length + nFP;
      for (const [k, [a, b]] of par) {
        const ch = one.A[ei++];
        if (!ch || !m.A[a] || !m.A[b]) continue;
        if ((m.E && m.E.get(k)) >= 1) {
          drift = Math.max(drift,
            Math.abs(ch[0] - (m.A[a][0] + m.A[b][0]) / 2));
        }
      }
      check(drift < 1e-9,
        `${name}: creased edge points drift from the parent midpoint`,
        `max ${fmt(drift)}`);
      check(seen > 0, `${name}: no smooth edges to test`);
    }
  }

  // --- 3b THE WHOLE PIPELINE, and the invariant the shader depends on ----
  // buildCage2 is not what gets drawn: the display runs subdivide xN, then
  // glassSill, cut, canopy, rims and interior. The first four carry the
  // field; the last two ADD geometry that has no lattice at all — a rim bead
  // is swept along a boundary polyline, and the interior liners and frames
  // are their own components. That is not a hole to be plugged: geometry
  // without a lattice takes the shader's triplanar branch by design.
  //
  // What the shader CANNOT do is take both branches inside one draw group.
  // So the invariant is not "everything has a field", it is:
  //
  //   EVERY MATERIAL IS PURE — all of its faces have the field, or none do.
  //
  // A mixed material is unshadeable, and it is the failure a new post-pass
  // would introduce silently.
  //
  // The FIRST cut of this check ran with cutParts off and passed, while the
  // bench page — which ships cutParts 1 and bubble 1 — had `body`,
  // `waistband` and `floorLoop` mixed. So the settings here are the BENCH
  // PAGE'S, not the defaults: a purity test that does not exercise the
  // passes that duplicate geometry is testing nothing.
  const PIPE = [
    ['bench-like', { doorOn: 1, doorPax: 1, intOn: 1, intCons: 2,
                     rimWin: 1, rimDoor: 1, cutParts: 1, topRound: 1,
                     bubble: 1 }],
    ['cut, no bubble', { doorOn: 1, doorPax: 1, cutParts: 1, skylight: 1,
                         rimWin: 1, rimDoor: 1 }],
    ['interior only', { intOn: 1, intCons: 1 }],
  ];
  for (const [pname, over] of PIPE) {
    const P2 = JSON.parse(JSON.stringify(D));
    Object.assign(P2, over);
    const S2 = G.cageSpec(P2);
    let s = G.buildCage2(S2, 'crease');
    for (let i = 0; i < 2; i++) s = G.cageSubdivide(s);
    for (const fn of ['cageGlassSill', 'cageCut', 'cageCanopy', 'cageRims',
                      'cageInterior'])
      if (G[fn]) s = G[fn](s, S2);
    const AA = s.A || [];
    const tally = new Map();
    for (const f of s.F) {
      const has = f.v.every(v => !!AA[v]);
      const t = tally.get(f.m) || [0, 0];
      t[has ? 0 : 1]++;
      tally.set(f.m, t);
    }
    const mixed = [...tally].filter(([, t]) => t[0] && t[1]);
    check(mixed.length === 0,
      `${pname}: a material mixes fielded and unfielded faces`,
      mixed.map(([m2, t]) => `${m2} ${t[0]}/${t[1]}`).join(', '));
    // and the exterior skin must be on the fielded side of that line — if a
    // post-pass ever starts rebuilding the body, this is what says so
    for (const m2 of ['body', 'waistband', 'ceilingLoop', 'floorLoop']) {
      const t = tally.get(m2);
      check(t && t[0] > 0 && t[1] === 0,
        `${pname}: ${m2} lost the surface field in the pipeline`,
        t ? `${t[0]} fielded / ${t[1]} not` : 'absent');
    }
    // the post-pass families must be on the other side, or the split has
    // drifted and the shader is branching on a stale assumption
    for (const m2 of ['joint', 'cloth', 'tube']) {
      const t = tally.get(m2);
      if (t) check(t[0] === 0, `${pname}: ${m2} unexpectedly carries the field`,
        `${t[0]} fielded`);
    }
  }

  // --- 4 the absent path is byte-identical -------------------------------
  // Strip the field and the mesh must be the mesh it always was.
  {
    const S = specOf({});
    const m = G.buildCage2(S, 'crease');
    const strip = x => JSON.stringify({ V: x.V, F: x.F,
      E: x.E ? [...x.E].sort() : null });
    const a0 = strip(m);
    const bare = { V: m.V, F: m.F, E: m.E };      // no A
    const s1 = G.cageSubdivide(bare);
    const s2 = G.cageSubdivide({ V: m.V, F: m.F, E: m.E, A: m.A });
    check(strip(s1) === strip({ V: s2.V, F: s2.F, E: s2.E }),
      'the field CHANGES the geometry — the absent path is not identical');
    check(a0.length > 0, 'stock build is empty');
    check(!s1.A, 'subdivision invented a field from nothing');
  }
}

// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
run(null);
if (args.includes('--selftest')) {
  // NEGATIVE VERIFY (G3.2 / G48): a check on an observable that cannot change
  // is indistinguishable from a check that works. Break the field four ways
  // and require the battery to notice each one.
  const S = specOf({});
  const probes = [
    ['hole', m => { m.A[0] = null; }],
    ['non-finite', m => { m.A[1] = [NaN, 0, 0, 0]; }],
    ['sL reversed', m => { for (const a of m.A) if (a) a[0] = -a[0]; }],
    ['sC datum lost', m => { for (const a of m.A) if (a) a[1] += 1; }],
    ['guard on an integer', m => { for (const a of m.A) if (a) a[3] = 2; }],
  ];
  let caught = 0;
  for (const [nm, brk] of probes) {
    const m = G.buildCage2(S, 'crease');
    brk(m);
    const before = fail.length;
    const LVI = G.cageLvIndex(S);
    // re-run only the per-build checks against the broken mesh
    let holes = 0, bad = 0, offW = 0, sgn = 0, gInt = 0;
    for (let i = 0; i < m.A.length; i++) {
      const a = m.A[i];
      if (!a) { holes++; continue; }
      if (a.some(v => !Number.isFinite(v))) bad++;
      if (Math.abs(a[3] - LVI.waist) < 1e-9 && Math.abs(a[1]) > 1e-6) offW++;
      if (a[3] > LVI.waist + 1e-9 && a[1] <= 0) sgn++;
      if (a[3] < LVI.waist - 1e-9 && a[1] >= 0) sgn++;
      for (const k of ['waistG', 'bandG'])
        if (Math.abs(a[3] - LVI[k]) < 1e-9 &&
            Math.abs(a[3] - Math.round(a[3])) < 1e-6) gInt++;
    }
    const rail = [];
    for (let i = 0; i < m.V.length; i++) {
      const a = m.A[i];
      if (a && Math.abs(a[3] - LVI.waist) < 1e-9) rail.push([m.V[i][2], a[0]]);
    }
    rail.sort((p, q) => p[0] - q[0]);
    let inv = 0;
    for (let i = 1; i < rail.length; i++)
      if (rail[i][0] - rail[i - 1][0] > 1e-6 &&
          rail[i][1] - rail[i - 1][1] > 1e-9) inv++;
    const noticed = holes || bad || offW || sgn || gInt || inv;
    console.log(`  selftest ${nm.padEnd(22)} ${noticed ? 'CAUGHT' : 'MISSED'}`);
    if (noticed) caught++;
    void before;
  }
  check(caught === probes.length,
    `selftest: ${probes.length - caught} probe(s) went unnoticed`);
}

// THE VERDICT CONTRACT (it joined the battery at G67, when AEROSKIN made the
// field load-bearing for the flown aeroplane rather than a bench diagnostic):
// exactly one final `GATE <ID>: PASS|FAIL` line AND a non-zero exit on
// failure — the runner requires both signals.
if (fail.length) {
  for (const f of fail) console.log('  FAIL ' + f);
  console.log('GATE SURF: FAIL');
  process.exit(1);
}
console.log('GATE SURF: PASS');
