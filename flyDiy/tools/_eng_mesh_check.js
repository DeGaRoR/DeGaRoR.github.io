// ENGINE MESH — THE VERDICT.  node tools/_eng_mesh_check.js
//
// What is asserted, and why it is these things:
//
//   1. HEALTH — finite verts, valid quads, a material on every face, and the
//      part ledger closed: every face of a part uses only that part's verts.
//   2. CONNECTIVITY — each part is the number of pieces it CLAIMS to be
//      (a tube is one, a fin stack is finN, the case ridge is two). A lathe
//      that silently splits, or a cap that stopped sharing its ring, shows
//      up here and nowhere else.
//   3. DENSITY, MEASURED — the module's whole pitch is one edge target for
//      every part. So: per-part median edge <= 2.2x the target, global p95
//      <= 2.6x. Deliberately coarse boxes (kind 'box') are exempt and say so.
//   4. CONNECTIONS — "cables go where they should" as an assertion. Every
//      artery declares its ends; the check holds a1 against the PORT TABLE
//      (exact, the routing contract) and BOTH ends against the target parts'
//      own emitted AABBs (near, the two-independent-parts-actually-meet
//      test — this half is not circular, because the plug boss and the lead
//      are emitted by different builders).
//   5. SCALE INVARIANCE — build at 2x every length input and the mesh must
//      be exactly 2x: same counts, coordinates doubled. This is the proof
//      that no absolute-metre constant survives anywhere in the builder,
//      which the 28 mm .. 1.4 m registry span requires.
//   6. BUDGET + MONOTONY — quality dials quads up and down, and the default
//      dressed flat-4 stays under a stated cap.
'use strict';
const { engMeshBuild, ENGM_DEFAULT, ENGM_LODS } = require('./_eng_mesh.js');
const { ENG_DEFAULT } = require('./_eng_gen.js');

const IN = 0.0254;
const f = (x, n) => x.toFixed(n === undefined ? 1 : n);
const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);

let fail = 0;
const hard = (label, cond, extra) => {
  if (!cond) { fail++; console.log('  FAIL ' + label + (extra ? '  ' + extra : '')); }
};

// the flat rows of _eng_check.js's REF, plus the visual identity of each
const CASES = [
  { name: 'A-65 (anchor)', spec: {} },
  { name: 'O-200-A', spec: { bore: 4.0625 * IN, stroke: 3.875 * IN, rpm: 2750 } },
  { name: 'IO-360 (injected)', spec: { bore: 5.125 * IN, stroke: 4.375 * IN,
      rpm: 2700, injected: 1, rodPos: 1 } },
  { name: 'Jabiru 2200A', spec: { bore: 0.0975, stroke: 0.074, rpm: 3300 } },
  { name: 'VW 2180', spec: { bore: 0.0922, stroke: 0.0818, rpm: 3200,
      genOn: 0, rockerSpan: 1 } },
  { name: 'flat twin', spec: { cyl: 2 } },
  { name: 'flat six', spec: { cyl: 6 } },
  { name: 'collector exhaust', spec: { exStyle: 2 } },
  { name: 'bare (all dress off)', spec: { mount: 0, fwOn: 0, carbOn: 0, leads: 0,
      intake: 0, exStyle: 0, mags: 0, genOn: 0, oilFill: 0, airbox: 0,
      plumb: 0, injected: 0 } },
  { name: 'coarse q0.6', spec: { quality: 0.6 } },
  { name: 'fine q1.8', spec: { quality: 1.8 } },
  // the architecture axes (G24.5): engResolve's own flags driving geometry
  { name: 'liquid + geared', spec: { liquid: 1, geared: 1 } },
  { name: 'liquid, rad below', spec: { liquid: 1, radY: -0.9 } },
  { name: 'two-stroke', spec: { twoStroke: 1, cyl: 2, exStyle: 3, geared: 1 } },
  // the inline family (G24.12): the registry's actual 277 and 582
  { name: 'rotax 277-ish', spec: { arch: 'inline', cyl: 1, twoStroke: 1,
      geared: 1, exStyle: 3, bore: 0.072, stroke: 0.068, rpm: 6250 } },
  { name: 'rotax 582-ish', spec: { arch: 'inline', cyl: 2, twoStroke: 1,
      geared: 1, liquid: 1, exStyle: 3, bore: 0.076, stroke: 0.064,
      rpm: 6500 } },
  // the last registry row: the two-row radial with the collector ring
  { name: 'R-1830-ish', spec: { arch: 'radial', cyl: 14, radialRows: 2,
      geared: 1, exStyle: 2, bore: 5.5 * IN, stroke: 5.5 * IN, rpm: 2700 } },
  { name: 'radial 7 single-row', spec: { arch: 'radial', cyl: 7,
      radialRows: 1, exStyle: 1 } },
  // the LOD ladder: full battery EXCEPT density — a LOD trades density by
  // definition, but its cables must still connect and still not clip
  { name: 'LOD close', spec: ENGM_LODS[1].set, lod: true },
  { name: 'LOD mid', spec: ENGM_LODS[2].set, lod: true },
  { name: 'LOD far', spec: ENGM_LODS[3].set, lod: true },
];

// ---- helpers --------------------------------------------------------------
const partAABB = (M, p) => {
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (let i = p.v0; i < p.v1; i++)
    for (let k = 0; k < 3; k++) {
      if (M.V[i][k] < lo[k]) lo[k] = M.V[i][k];
      if (M.V[i][k] > hi[k]) hi[k] = M.V[i][k];
    }
  return { lo, hi };
};
const distAABB = (p, bb) => {
  let d2 = 0;
  for (let k = 0; k < 3; k++) {
    const c = Math.max(bb.lo[k] - p[k], 0, p[k] - bb.hi[k]);
    d2 += c * c;
  }
  return Math.sqrt(d2);
};
const findPart = (M, name, occ) => {
  let n = 0;
  for (const p of M.parts) if (p.name === name && n++ === (occ || 0)) return p;
  return null;
};
// the case's own rounded-rect field, recomputed HERE from the resolve
// numbers (the check's ruler, not the builder's) — a cable or tube vertex
// inside it is a clip. Two-tier acc body per G24.4: backplate 0.88 of the
// case for 0.24*cR, then the 0.60 hump.
// the case tail follows the stagger (G24.10) — same formula as the builder
const zTailOf = M => {
  const R = M.resolved;
  const zBack = R.place.zAft + (R.P.accessories ? R.P.accLen : 0);
  // bank stagger exists only on the flat; a radial's rear ROW sits one
  // mesh row-pitch aft (same formulas as the builder)
  let minZ = R.place.zOf(R.place.nSt - 1);
  if (R.arch === 'radial') {
    const rows = Math.min(2, Math.max(1, Math.round(M.P.radialRows || 1)));
    minZ = R.place.zOf(0) - (rows - 1) * 1.45 * R.P.bore;
  }
  const st = R.arch === 'flat' ? 0.5 * (M.P.stagger || 0) * R.P.bore : 0;
  return Math.min(zBack, minZ - st - 0.80 * R.P.bore);
};
const caseSDF = (M, p) => {
  const R = M.resolved, cR = R.place.caseR;
  const zFront = -R.P.flangeLen;
  const zTail = zTailOf(M);
  const zAft = R.place.zAft;
  let h = 0;
  if (p[2] <= zFront + 1e-9 && p[2] >= zAft - 1e-9) {
    if (p[2] >= zTail - 1e-9) h = cR;
    else if (p[2] >= zTail - 0.24 * cR) h = 0.88 * cR;
    else h = 0.60 * cR;
  }
  if (!h) return 1e9;
  if (R.arch === 'radial') return Math.hypot(p[0], p[1]) - h;
  const r = 0.55 * h, hr2 = h - r;
  const qx = Math.abs(p[0]) - hr2, qy = Math.abs(p[1]) - hr2;
  if (qx > 0 || qy > 0)
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
  return Math.max(qx, qy) - r;
};
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const median = a => { const s = [...a].sort((x, y) => x - y);
  return s.length ? s[(s.length - 1) >> 1] : 0; };
const pctl = (a, q) => { const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0; };

// ---- the battery ----------------------------------------------------------
console.log('ENGINE MESH — health, density, connections');
console.log(pad('case', 22) + padL('verts', 8) + padL('quads', 8) +
  padL('tris', 8) + padL('parts', 7) + padL('lines', 7) +
  padL('med/E', 7) + padL('p95/E', 7));
console.log('-'.repeat(72));

const quadsAt = {}, trisAt = {};
for (const C of CASES) {
  const M = engMeshBuild(C.spec);
  const R = M.resolved, cR = R.place.caseR, E = M.edgeTarget;
  quadsAt[C.name] = M.stats.quads;
  trisAt[C.name] = M.stats.tris;

  // 1 — health
  hard(C.name + ': verts finite', M.V.every(p => p.every(c => isFinite(c))));
  hard(C.name + ': quads valid', M.F.every(q => q.v.length === 4 &&
    q.v.every(i => i >= 0 && i < M.V.length)));
  hard(C.name + ': materials', M.F.every(q => !!q.m));
  let ledger = true;
  for (const p of M.parts)
    for (let fi = p.f0; fi < p.f1; fi++)
      for (const vi of M.F[fi].v)
        if (vi < p.v0 || vi >= p.v1) ledger = false;
  hard(C.name + ': part ledger closed (faces use own verts)', ledger);

  // 2 — connectivity: each part is the number of pieces it claims
  for (const p of M.parts) {
    const root = new Map();
    const find = x => { while (root.get(x) !== x) { root.set(x, root.get(root.get(x))); x = root.get(x); } return x; };
    const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) root.set(a, b); };
    for (let i = p.v0; i < p.v1; i++) root.set(i, i);
    for (let fi = p.f0; fi < p.f1; fi++) {
      const q = M.F[fi].v;
      uni(q[0], q[1]); uni(q[0], q[2]); uni(q[0], q[3]);
    }
    const used = new Set();
    for (let fi = p.f0; fi < p.f1; fi++) for (const vi of M.F[fi].v) used.add(find(vi));
    hard(C.name + ': ' + p.name + ' is ' + p.comps + ' piece(s)',
         used.size === p.comps, 'got ' + used.size);
  }

  // 3 — density, measured (boxes exempt by declaration)
  const meds = [], all = [];
  for (const p of M.parts) {
    if (p.kind === 'box') continue;
    const seen = new Set(), el = [];
    for (let fi = p.f0; fi < p.f1; fi++) {
      const q = M.F[fi].v;
      for (let k = 0; k < 4; k++) {
        const a = q[k], b = q[(k + 1) % 4];
        if (a === b) continue;
        const key = a < b ? a + '_' + b : b + '_' + a;
        if (seen.has(key)) continue;
        seen.add(key);
        el.push(dist(M.V[a], M.V[b]));
      }
    }
    if (!el.length) continue;
    const md = median(el);
    meds.push({ name: p.name, md });
    all.push(...el);
    if (!C.lod)
      hard(C.name + ': density of ' + p.name + ' (median <= 2.2E)',
           md <= 2.2 * E, f(md / E, 2) + 'E');
  }
  const p95 = pctl(all, 0.95);
  // 2.6 -> 2.8 with the radial (G24.15): at R-1830 physical size the
  // 64-step sampling ceiling starts to bind on the longest runs
  if (!C.lod)
    hard(C.name + ': global p95 edge <= 2.8E', p95 <= 2.8 * E, f(p95 / E, 2) + 'E');

  // 4 — connections. FITMENT SCRUTINY (G24.4): an artery end must sit on
  // the target part's SURFACE, not merely inside its bounding box — the
  // box test passed a fuel line that visibly floated beside the carb.
  // Measured as nearest-vertex distance, toleranced by the part's own
  // mesh spacing so it holds at every LOD.
  const medCache = new Map();
  const medEdgeOf = p => {
    if (medCache.has(p)) return medCache.get(p);
    const seen = new Set(), el = [];
    for (let fi = p.f0; fi < p.f1; fi++) {
      const q = M.F[fi].v;
      for (let k = 0; k < 4; k++) {
        const a = q[k], b2 = q[(k + 1) % 4];
        if (a === b2) continue;
        const key = a < b2 ? a + '_' + b2 : b2 + '_' + a;
        if (seen.has(key)) continue;
        seen.add(key);
        el.push(dist(M.V[a], M.V[b2]));
      }
    }
    const md = median(el);
    medCache.set(p, md);
    return md;
  };
  const near = (pt, part, label) => {
    if (!part) { hard(C.name + ': ' + label + ' (part exists)', false); return; }
    let best = 1e9;
    for (let i = part.v0; i < part.v1; i++)
      best = Math.min(best, dist(pt, M.V[i]));
    const tol = 1.7 * medEdgeOf(part) + 0.03 * cR;
    hard(C.name + ': ' + label, best <= tol,
         'd=' + f(best / cR, 3) + 'cR tol=' + f(tol / cR, 3) + 'cR');
  };
  const exact = (a, b, label) =>
    hard(C.name + ': ' + label, dist(a, b) <= 1e-6 * cR, 'd=' + f(dist(a, b), 6));
  const P = M.P;
  let nLeadT = 0, nLeadB = 0, nIntake = 0, nExh = 0;
  for (const a of M.arteries) {
    let mm;
    if ((mm = a.name.match(/^leadT(\d+)$/))) {
      const i = +mm[1]; nLeadT++;
      exact(a.a1, M.ports.plugT[i], a.name + ' ends ON its port');
      near(a.a0, findPart(M, 'magCap', 0), a.name + ' leaves a left-mag tower');
      near(a.a1, findPart(M, 'plug' + i, 0), a.name + ' reaches the top plug');
    } else if ((mm = a.name.match(/^leadB(\d+)$/))) {
      const i = +mm[1]; nLeadB++;
      exact(a.a1, M.ports.plugB[i], a.name + ' ends ON its port');
      near(a.a0, findPart(M, 'magCap', 1), a.name + ' leaves a right-mag tower');
      near(a.a1, findPart(M, 'plug' + i, 1), a.name + ' reaches the bottom plug');
    } else if ((mm = a.name.match(/^intake(\d+)$/))) {
      const i = +mm[1]; nIntake++;
      exact(a.a1, M.ports.intake[i], a.name + ' ends ON its port');
      near(a.a0, findPart(M, M.resolved.arch === 'radial' ? 'acc' : 'sump', 0),
           a.name + ' leaves the ' +
           (M.resolved.arch === 'radial' ? 'rear case' : 'sump'));
      near(a.a1, findPart(M, 'head' + i, 0), a.name + ' reaches the head');
    } else if ((mm = a.name.match(/^exhaust(\d+)$/))) {
      const i = +mm[1]; nExh++;
      exact(a.a0, M.ports.exhaust[i], a.name + ' starts ON its port');
      near(a.a0, findPart(M, 'head' + i, 0), a.name + ' leaves the head');
      if (a.to === 'collector') {
        const c0 = findPart(M, 'collector', 0), c1 = findPart(M, 'collector', 1);
        const d = Math.min(c0 ? distAABB(a.a1, partAABB(M, c0)) : 1e9,
                           c1 ? distAABB(a.a1, partAABB(M, c1)) : 1e9);
        hard(C.name + ': ' + a.name + ' plunges into a collector',
             d <= 0.05 * cR, 'd=' + f(d / cR, 3) + 'cR');
      }
    } else if ((mm = a.name.match(/^injLine(\d+)$/))) {
      near(a.a0, findPart(M, 'spider', 0), a.name + ' leaves the spider');
      near(a.a1, findPart(M, 'head' + mm[1], 0), a.name + ' reaches the head');
    } else if ((mm = a.name.match(/^mountTube(\d)$/))) {
      const k = +mm[1];
      exact(a.a0, M.ports.lugs[k], a.name + ' starts on its shock stack');
      exact(a.a1, M.ports.fwPts[k], a.name + ' ends on its firewall point');
      near(a.a0, findPart(M, 'puck' + k, 0), a.name + ' is rooted in its puck');
      near(a.a1, findPart(M, 'firewall', 0), a.name + ' holds the firewall');
    } else if (a.name === 'fuel') {
      exact(a.a1, M.ports.carbIn, 'fuel line ends ON the bowl inlet');
      near(a.a0, findPart(M, 'firewall', 0), 'fuel line leaves the firewall');
      near(a.a1, findPart(M, 'carbInlet', 0), 'fuel line lands on the inlet boss');
      hard(C.name + ': fuel stays on the bowl\'s side (no centreline cross)',
           Math.sign(a.a0[0]) === Math.sign(M.ports.carbIn[0]));
    } else if (a.name === 'throttle') {
      exact(a.a1, M.ports.carbArm, 'throttle ends ON the carb arm');
      near(a.a0, findPart(M, 'firewall', 0), 'throttle leaves the firewall');
      near(a.a1, findPart(M, 'carbArm', 0), 'throttle reaches the arm');
      hard(C.name + ': throttle stays on the arm\'s side',
           Math.sign(a.a0[0]) === Math.sign(M.ports.carbArm[0]));
    } else if ((mm = a.name.match(/^coolant([LR])$/))) {
      const occ = mm[1] === 'L' ? 0 : 1;
      // an inline has ONE rail (occurrence 0) whichever letter it wears
      near(a.a0, findPart(M, 'coolRail',
           M.resolved.arch === 'inline' ? 0 : occ), a.name + ' leaves its rail');
      near(a.a1, findPart(M, 'radTank', occ),
           a.name + ' reaches its radiator tank');
    } else if (a.name === 'coolantRet') {
      near(a.a0, findPart(M, 'radTank', 0), 'return hose leaves the radiator');
      near(a.a1, findPart(M, 'pumpBoss', 0), 'return hose lands on the pump');
    } else if (a.name === 'airHorn') {
      near(a.a0, findPart(M, 'airRear', 0), 'the horn leaves the airbox');
      near(a.a1, findPart(M, 'carb', 0), 'the horn enters the carb throat');
    }
  }
  // 4b — architecture consequences: the flags must actually change the parts
  const hasPart = re => M.parts.some(p => re.test(p.name));
  if (M.P.liquid) {
    hard(C.name + ': liquid has NO fins', !hasPart(/^fins|^headFins/));
    hard(C.name + ': liquid has a radiator', hasPart(/^radiator$/));
    hard(C.name + ': one hose per bank (the rail scheme)',
         M.arteries.filter(a => /^coolant[LR]$/.test(a.name)).length ===
         (M.resolved.arch === 'inline' ? 1 : 2));
  }
  if (M.P.twoStroke) {
    hard(C.name + ': two-stroke has no pushrods', !hasPart(/^rod\d/));
    hard(C.name + ': two-stroke has no rocker covers', !hasPart(/^rocker\d/));
  }
  if (M.P.geared)
    hard(C.name + ': geared grows the gearbox bell', hasPart(/^gearbox$/));
  // 4b2 — THE BLOCK COVERS ITS CYLINDERS (G24.10): the stagger moved the
  // banks but the first case never followed — every cylinder pad's
  // z-range must lie within the case's.
  {
    const cs = findPart(M, 'case', 0);
    if (cs) {
      const cb = partAABB(M, cs);
      for (let i = 0; i < R.cyl; i++) {
        const pd = findPart(M, 'cylPad' + i, 0);
        if (!pd) continue;
        const pb = partAABB(M, pd);
        hard(C.name + ': cylPad' + i + ' sits on the case',
             pb.lo[2] >= cb.lo[2] - 1e-6 && pb.hi[2] <= cb.hi[2] + 1e-6,
             f((pb.hi[2] - cb.hi[2]) / cR, 3) + 'cR over');
      }
    }
  }
  // 4c — CYLINDER INTERSECTION (G24.5): same-bank neighbours' fins and
  // heads may KISS at the clip plane but never interpenetrate. Emitted
  // z-ranges of consecutive same-bank parts must not overlap.
  if (R.arch !== 'radial') {   // a radial separates its neighbours ANGULARLY
    const b2 = R.P.bore;
    // flat banks alternate (neighbour = i+2); an inline is one row (i+1)
    const step = R.arch === 'inline' ? 1 : 2;
    for (const base of ['fins', 'headFins', 'head']) {
      for (let i = 0; i + step < R.cyl + step; i++) {
        const pa = findPart(M, base + i, 0), pb = findPart(M, base + (i + step), 0);
        if (!pa || !pb) continue;
        const A = partAABB(M, pa), B = partAABB(M, pb);
        const overlap = Math.min(A.hi[2], B.hi[2]) - Math.max(A.lo[2], B.lo[2]);
        hard(C.name + ': ' + base + i + '/' + (i + 2) + ' do not interpenetrate',
             overlap <= 0.02 * b2, 'overlap ' + f(overlap / b2, 3) + 'b');
      }
    }
  }
  // G24.2 — NO CLIPS: every vertex of every routed cable is outside the
  // case field. Tested on the EMITTED verts (ring surfaces, not
  // centrelines), so the sweep radius is covered too.
  for (const p of M.parts) {
    if (!/^lead[TB]\d+$|^injLine\d+$/.test(p.name)) continue;
    let worst = 1e9;
    for (let i = p.v0; i < p.v1; i++)
      worst = Math.min(worst, caseSDF(M, M.V[i]));
    hard(C.name + ': ' + p.name + ' clears the case (no clip)',
         worst > -1e-4 * cR, 'worst ' + f(worst / cR, 3) + 'cR');
  }
  // G24.4 — the STRAIGHT mount tubes clear the two-tier acc body too. The
  // first 0.40*cR aft of the case tail is the shock-stack joint and exempt.
  {
    const zB = zTailOf(M);
    for (const p of M.parts) {
      if (!/^mountTube|^mountDiag/.test(p.name)) continue;
      let worst = 1e9;
      for (let i = p.v0; i < p.v1; i++) {
        if (M.V[i][2] > zB - 0.40 * cR) continue;
        worst = Math.min(worst, caseSDF(M, M.V[i]));
      }
      hard(C.name + ': ' + p.name + ' clears the acc body (straight)',
           worst > -1e-4 * cR, 'worst ' + f(worst / cR, 3) + 'cR');
    }
  }
  if (P.leads && P.mags) {
    hard(C.name + ': one top lead per cylinder', nLeadT === R.cyl, nLeadT);
    hard(C.name + ': one bottom lead per cylinder', nLeadB === R.cyl, nLeadB);
  }
  if (P.intake && !P.twoStroke)
    hard(C.name + ': one intake riser per cylinder', nIntake === R.cyl);
  if (P.exStyle) hard(C.name + ': one exhaust per cylinder', nExh === R.cyl);

  console.log(pad(C.name, 22) + padL(M.stats.verts, 8) + padL(M.stats.quads, 8) +
    padL(M.stats.tris, 8) + padL(M.parts.length, 7) + padL(M.arteries.length, 7) +
    padL(f(median(meds.map(m => m.md)) / E, 2), 7) + padL(f(p95 / E, 2), 7));
}

// the LOD ladder descends — each rung strictly cheaper than the one above
hard('LOD ladder descends (hero > close > mid > far)',
     trisAt['A-65 (anchor)'] > trisAt['LOD close'] &&
     trisAt['LOD close'] > trisAt['LOD mid'] &&
     trisAt['LOD mid'] > trisAt['LOD far'],
     [trisAt['A-65 (anchor)'], trisAt['LOD close'], trisAt['LOD mid'],
      trisAt['LOD far']].join(' > '));

// ---- 5: scale invariance --------------------------------------------------
{
  // fwOn: 0 — the plate and its metre strip are the DECLARED aircraft-side
  // exception to the ratio rule; fwW still scales because the mount-point
  // clamp reads it even with the plate off
  const S = 2;
  const M1 = engMeshBuild({ fwOn: 0 });
  const M2 = engMeshBuild({ fwOn: 0, bore: ENG_DEFAULT.bore * S,
    stroke: ENG_DEFAULT.stroke * S, flangeLen: ENG_DEFAULT.flangeLen * S,
    accLen: ENG_DEFAULT.accLen * S,
    fwW: ENGM_DEFAULT.fwW * S, fwH: ENGM_DEFAULT.fwH * S });
  hard('scale: same vert count', M1.V.length === M2.V.length,
       M1.V.length + ' vs ' + M2.V.length);
  hard('scale: same quad count', M1.F.length === M2.F.length);
  let worst = 0;
  if (M1.V.length === M2.V.length)
    for (let i = 0; i < M1.V.length; i++)
      for (let k = 0; k < 3; k++)
        worst = Math.max(worst, Math.abs(M2.V[i][k] - S * M1.V[i][k]));
  hard('scale: coordinates are exactly 2x (no metre constants)',
       worst < 1e-9, 'worst ' + worst.toExponential(2));
}

// ---- 6: quality is monotone, budget holds ---------------------------------
// defaults are the hero bench at q2 (user ruling G24.12), so the anchor no
// longer sits between the q0.6 and q1.8 cases — compare those directly,
// and pin the BUDGET assert to an explicit q1 build
hard('quality dials quads up',
     quadsAt['coarse q0.6'] < quadsAt['fine q1.8'],
     quadsAt['coarse q0.6'] + ' / ' + quadsAt['fine q1.8']);
// raised 15000 -> 20000 (G24.4) -> 24000 (G24.6/7) -> 30000 (G24.12: 14
// barrel fins + 8 head fins + the exposed filter, all user rulings). The
// LOD rungs are the game's budget; this ceiling only guards runaway.
hard('dressed flat-4 budget at q1 (< 30000 quads)',
     engMeshBuild({ quality: 1 }).stats.quads < 30000,
     engMeshBuild({ quality: 1 }).stats.quads);

// determinism: two builds of the same spec are the same mesh
{
  const A = engMeshBuild({}), B = engMeshBuild({});
  let same = A.V.length === B.V.length && A.F.length === B.F.length;
  if (same) for (let i = 0; i < A.V.length; i++)
    for (let k = 0; k < 3; k++) if (A.V[i][k] !== B.V[i][k]) same = false;
  hard('deterministic', same);
}

// dressed families: flat, inline (coerced two-stroke), radial (coerced
// four-stroke, air) — only genuinely undressed layouts refuse
{
  let threw = false;
  try { engMeshBuild({ arch: 'vee' }); } catch (e) { threw = true; }
  hard('a vee refuses loudly', threw);
  hard('an inline is coerced to two-stroke',
       engMeshBuild({ arch: 'inline', cyl: 2 }).P.twoStroke === 1);
  hard('a radial is coerced to air-cooled four-stroke', (() => {
    const M2 = engMeshBuild({ arch: 'radial', cyl: 5, twoStroke: 1, liquid: 1 });
    return M2.P.twoStroke === 0 && M2.P.liquid === 0;
  })());
}

console.log();
console.log(fail ? 'ENGMESH: FAIL (' + fail + ')' : 'ENGMESH: OK');
process.exit(fail ? 1 : 0);
