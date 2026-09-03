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
  // the 912 dressed as one (G25.1): conical gearbox, twin top carbs with
  // cone filters, liquid heads over finned barrels, coolant bottle
  { name: '912 twin cones', spec: { bore: 0.0795, stroke: 0.0611, rpm: 5800,
      liquid: 1, geared: 1, airStyle: 1 } },
  // the corners the G25.6 audit found defects in — now held by the battery:
  // a SIX's runners need per-station tracks (parity shared one), the
  // electric gearbox kissed the can face, the ECU had no case at all
  { name: 'flat six twin cones', spec: { cyl: 6, liquid: 1, geared: 1,
      airStyle: 1 } },
  { name: 'ECU + injected', spec: { bore: 5.125 * IN, stroke: 4.375 * IN,
      rpm: 2700, injected: 1, rodPos: 1, ecuOn: 1 } },
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
  // THE ELECTRIC (G25), one case per style plus the liquid axis. The plate
  // is aircraft-side and sized per aeroplane (a park flyer's ply square,
  // a trainer's real bulkhead) — the case specs say so like the presets do.
  { name: 'RC 2212 (electric)', spec: { arch: 'electric',
      fwW: 0.16, fwH: 0.14 } },
  { name: 'liquid outrunner', spec: { arch: 'electric', liquid: 1,
      fwW: 0.16, fwH: 0.14 } },
  { name: 'geared pancake', spec: { arch: 'electric', eStyle: 1,
      canD: 0.228, canL: 0.086, rpm: 5000, geared: 1,
      fwW: 0.60, fwH: 0.55 } },
  { name: 'FES outrunner', spec: { arch: 'electric', canD: 0.20, canL: 0.09,
      rpm: 4500, fwW: 0.30, fwH: 0.30 } },
  { name: 'EMRAX pancake', spec: { arch: 'electric', eStyle: 1, canD: 0.228,
      canL: 0.086, rpm: 5000, fwW: 0.60, fwH: 0.55 } },
  { name: 'E-811 housed liquid', spec: { arch: 'electric', eStyle: 2,
      canD: 0.268, canL: 0.19, rpm: 2500, liquid: 1, fwW: 0.70, fwH: 0.65 } },
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
  if (R.arch === 'electric') return R.place.zCanB;
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
  // the electric body's field is the can cylinder over its own z-range —
  // the check's ruler, recomputed from resolve like the combustion one
  if (R.arch === 'electric') {
    const L = R.place;
    if (p[2] > L.zCanF + 1e-9 || p[2] < L.zCanB - 1e-9) return 1e9;
    return Math.hypot(p[0], p[1]) - L.canR;
  }
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
      // the runner's source is what the artery DECLARES: the sump plenum,
      // the radial's rear case, or its bank's twin top carb (G25.1)
      const src = /^twinCarb/.test(a.from) ? a.from
        : M.resolved.arch === 'radial' ? 'acc' : 'sump';
      near(a.a0, findPart(M, src, 0), a.name + ' leaves the ' + src);
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
      // the RC outrunner's standoffs root in the X mount — a park flyer
      // has no dynafocal rubber; everything else roots in its puck
      const rcCross = M.resolved.arch === 'electric' &&
                      !M.resolved.place.eStyle;
      near(a.a0, findPart(M, rcCross ? 'mountCross' : 'puck' + k,
           rcCross ? 0 : 0), a.name +
           (rcCross ? ' is rooted in the X mount' : ' is rooted in its puck'));
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
    } else if (a.name === 'overflow') {
      near(a.a0, findPart(M, 'expTank', 0), 'overflow leaves the tank neck');
      near(a.a1, findPart(M, 'coolBottle', 0), 'overflow reaches the bottle');
    } else if (a.name === 'airHorn') {
      near(a.a0, findPart(M, 'airRear', 0), 'the horn leaves the airbox');
      near(a.a1, findPart(M, 'carb', 0), 'the horn enters the carb throat');
    } else if ((mm = a.name.match(/^phase(\d)$/))) {
      // electric: three phase cables, motor -> controller
      const i = +mm[1];
      exact(a.a1, M.ports.escPhase[i], a.name + ' ends ON its controller port');
      near(a.a0, findPart(M, M.resolved.place.eStyle ? 'termBox' : 'stator', 0),
           a.name + ' leaves the motor');
      near(a.a1, findPart(M, 'esc', 0), a.name + ' reaches the controller');
    } else if ((mm = a.name.match(/^dc(\d)$/))) {
      // electric: the DC pair, controller -> firewall grommet
      const i = +mm[1];
      exact(a.a1, M.ports.dcFw[i], a.name + ' ends ON its grommet');
      near(a.a0, findPart(M, 'esc', 0), a.name + ' leaves the controller');
      near(a.a1, findPart(M, 'firewall', 0), a.name + ' reaches the firewall');
    } else if ((mm = a.name.match(/^coolant(\d)$/))) {
      // electric liquid: jacket boss -> plate edge (the airframe's cooler
      // lives beyond it — rough pass, declared in the builder)
      const i = +mm[1];
      exact(a.a1, M.ports.coolFw[i], a.name + ' ends ON its plate point');
      near(a.a0, findPart(M, i ? 'coolBossB' : 'coolBossA', 0),
           a.name + ' leaves its jacket boss');
      near(a.a1, findPart(M, 'firewall', 0), a.name + ' reaches the firewall');
    }
  }
  // 4b — architecture consequences: the flags must actually change the parts
  const hasPart = re => M.parts.some(p => re.test(p.name));
  if (M.P.liquid && M.resolved.arch !== 'electric') {
    // LIQUID COOLS THE HEADS, NOT THE BARRELS (G25.1 user ruling — the
    // 912's own architecture): barrel fins stay, head fins yield
    hard(C.name + ': liquid keeps its barrel fins',
         !M.P.baseFins || hasPart(/^fins\d/));
    hard(C.name + ': liquid has NO head fins', !hasPart(/^headFins/));
    hard(C.name + ': liquid has a radiator', hasPart(/^radiator$/));
    hard(C.name + ': one hose per bank (the rail scheme)',
         M.arteries.filter(a => /^coolant[LR]$/.test(a.name)).length ===
         (M.resolved.arch === 'inline' ? 1 : 2));
    // fwPlane rule (G32): plane furniture exists whenever the engine is
    // HELD — the bench's plate or a mount onto a genuine firewall
    if (M.P.fwOn || M.P.mount) {
      hard(C.name + ': liquid has its coolant bottle', hasPart(/^coolBottle$/));
      hard(C.name + ': the overflow hose is routed',
           M.arteries.some(a => a.name === 'overflow'));
    }
  }
  // TWIN CONE FILTERS (G25.1): the 912 induction replaces the canister
  {
    const twinOn = M.P.airStyle === 1 && !M.P.injected && !M.P.twoStroke &&
      M.resolved.arch === 'flat' && M.P.carbOn;
    if (twinOn) {
      hard(C.name + ': twin carbs, one per bank',
           hasPart(/^twinCarbL$/) && hasPart(/^twinCarbR$/));
      hard(C.name + ': a cone filter per carb',
           hasPart(/^coneFilterL$/) && hasPart(/^coneFilterR$/));
      hard(C.name + ': no canister airbox with twin cones', !hasPart(/^air$/));
    }
  }
  // BAY FURNITURE (G25.1): the flags must produce their parts
  if (M.resolved.arch !== 'electric') {
    if (M.P.starter) hard(C.name + ': starter present', hasPart(/^starter$/));
    if (M.P.oilFilter && !M.P.twoStroke)
      hard(C.name + ': spin-on oil filter present', hasPart(/^oilFilter$/));
    if (M.P.battOn && (M.P.fwOn || M.P.mount))
      hard(C.name + ': battery on the plane', hasPart(/^battBox$/));
    if (M.P.ecuOn && (M.P.fwOn || M.P.mount))
      hard(C.name + ': ECU on the plane', hasPart(/^ecu$/));
  }
  if (M.resolved.arch === 'electric') {
    // the electric consequences: a liquid can runs smooth and grows its
    // jacket loop; an air can wears its style's dress
    if (M.P.liquid) {
      hard(C.name + ': liquid electric has no ribs/fins',
           !hasPart(/^ribs$|^canFins$/));
      if (M.P.fwOn || M.P.mount)
        hard(C.name + ': liquid electric has two hoses',
             M.arteries.filter(a => /^coolant\d$/.test(a.name)).length === 2);
    }
    if (M.P.leads && (M.P.escOn === undefined || M.P.escOn))
      hard(C.name + ': three phase cables',
           M.arteries.filter(a => /^phase\d$/.test(a.name)).length === 3);
    if (!M.resolved.place.eStyle)
      hard(C.name + ': the outrunner shows its copper (open face)',
           hasPart(/^windings$/) && hasPart(/^windBars$/) &&
           hasPart(/^canFace$/));
    if (M.P.plumb && (M.P.fwOn || M.P.mount) &&
        (M.P.escOn === undefined || M.P.escOn))
      hard(C.name + ': a DC pair',
           M.arteries.filter(a => /^dc\d$/.test(a.name)).length === 2);
    hard(C.name + ': no combustion parts on an electric',
         !hasPart(/^barrel|^head|^rocker|^carb|^mag|^sump$|^collector/));
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
  // centrelines), so the sweep radius is covered too. The electric wiring
  // (phase, DC) is held to the same rule against the can's own field.
  for (const p of M.parts) {
    if (!/^lead[TB]\d+$|^injLine\d+$|^phase\d$|^dc\d$/.test(p.name)) continue;
    let worst = 1e9;
    for (let i = p.v0; i < p.v1; i++)
      worst = Math.min(worst, caseSDF(M, M.V[i]));
    hard(C.name + ': ' + p.name + ' clears the case (no clip)',
         worst > -1e-4 * cR, 'worst ' + f(worst / cR, 3) + 'cR');
  }
  // G25.2 — THE CYLINDERS ARE METAL TOO (user report: twin runners went
  // straight through them). The check recomputes each cylinder's capsule
  // from the RESOLVE numbers — its own ruler, at 0.94x where the builder
  // routes at 1.06x — and every emitted vertex of every routed line must
  // clear every capsule except its OWN target's (parsed from the name:
  // leadT2 lands on cylinder 2's plug, intake1 in head 1's port).
  if (M.resolved.arch !== 'electric' && R.cyl) {
    const b2 = R.P.bore;
    const rows2 = R.arch === 'radial'
      ? Math.min(2, Math.max(1, Math.round(M.P.radialRows || 1))) : 1;
    const perRow2 = R.arch === 'radial' ? Math.ceil(R.cyl / rows2) : 0;
    const caps = [];
    for (let i = 0; i < R.cyl; i++) {
      let a2, z2;
      if (R.arch === 'radial') {
        const row = i % rows2, idx = Math.floor(i / rows2);
        a2 = (idx + row * 0.5) * 2 * Math.PI / perRow2;
        z2 = R.place.zOf(0) - row * 1.45 * b2;
      } else {
        // THE TABLE IS THE ONLY ANSWER (G162). This branch used to open with
        // its own `R.arch === 'inline' ? Math.PI / 2` — a SECOND copy of the
        // very hardcode the mesh carried, so when the bank was stood upright
        // this check went on testing every lead against a capsule lying on
        // its side, and reported clips that were not there while missing the
        // ones that were. Two copies of one fact is how the drawing and the
        // envelope disagreed for a fortnight; the fix is not to correct the
        // copy, it is to stop having one.
        a2 = R.place.ang[i];
        // AND AN INLINE HAS ONE BANK, so there is nothing for the stagger to
        // stagger against — the mesh zeroes it there and so does this.
        z2 = R.place.zOf(R.place.stn[i]) + (R.arch === 'inline' ? 0
          : (Math.sin(a2) >= 0 ? 1 : -1) * 0.5 * (M.P.stagger || 0) * b2);
      }
      caps.push({ i, d: [Math.sin(a2), Math.cos(a2), 0], z: z2 });
    }
    const capR = 0.94 * b2 *
      Math.max(R.P.finR / 2, R.place.headR / b2, 0.62);
    const t0c = 1.00 * cR, t1c = R.place.rTip + 0.05 * b2;
    const cylSDF = (pt, except) => {
      let best = 1e9;
      for (const cf of caps) {
        if (cf.i === except) continue;
        const rel = [pt[0], pt[1], pt[2] - cf.z];
        const t = Math.max(t0c, Math.min(t1c,
          rel[0] * cf.d[0] + rel[1] * cf.d[1] + rel[2] * cf.d[2]));
        const e = [pt[0] - cf.d[0] * t, pt[1] - cf.d[1] * t, pt[2] - cf.z];
        best = Math.min(best, Math.hypot(e[0], e[1], e[2]) - capR);
      }
      return best;
    };
    for (const p of M.parts) {
      const mm2 = p.name.match(
        /^(leadT|leadB|injLine|intake|exhaust)(\d+)$|^(fuel|throttle|overflow|airHorn|coolant[LR]|coolantRet)$/);
      if (!mm2) continue;
      const except = mm2[2] !== undefined ? +mm2[2] : -1;
      let worst = 1e9;
      for (let i = p.v0; i < p.v1; i++)
        worst = Math.min(worst, cylSDF(M.V[i], except));
      hard(C.name + ': ' + p.name + ' clears the cylinders (no clip)',
           worst > -1e-4 * cR, 'worst ' + f(worst / cR, 3) + 'cR');
    }
  }
  // THE DRAWING AND THE ENVELOPE MUST AGREE ABOUT WHICH WAY THE ENGINE
  // STANDS (G162). This is the check the battery did not have, and its
  // absence cost a fortnight: `_eng_check` asserts "an inline is taller than
  // it is wide" and GATE COWL asserts "an inline gives a NARROW deep cowl",
  // and BOTH pass by reading the ENVELOPE. So an engine DRAWN a quarter turn
  // away from its own envelope satisfied every check in this battery while
  // the cowl was sized around a shape the engine did not have.
  //
  // MEASURED ON THE CYLINDERS, which are the parts the orientation is about —
  // the case, the mount and the firewall are square and would dilute it. Only
  // asserted where the envelope has a decided opinion (15% out of square): a
  // radial fans its barrels round the crank and is square by construction, and
  // an assert on a coin toss is worse than no assert.
  {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of M.parts) {
      if (!/^(cyl|fins|head|barrel|rocker|plug)/.test(p.name)) continue;
      for (let i = p.v0; i < p.v1; i++) {
        const v = M.V[i];
        x0 = Math.min(x0, v[0]); x1 = Math.max(x1, v[0]);
        y0 = Math.min(y0, v[1]); y1 = Math.max(y1, v[1]);
      }
    }
    const env = M.resolved.env;
    if (x1 > x0 && y1 > y0 && env && env.width > 0 && env.height > 0) {
      const dR = (x1 - x0) / (y1 - y0), eR = env.width / env.height;
      const decided = eR > 1.15 || eR < 1 / 1.15;
      if (decided)
        hard(C.name + ': the drawn engine stands the way its envelope says',
             (dR > 1) === (eR > 1),
             'drawn ' + f(x1 - x0, 3) + ' x ' + f(y1 - y0, 3) +
             ', envelope ' + f(env.width, 3) + ' x ' + f(env.height, 3));
    }
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
  // G25.3 — NO KISSING FACES: the moiré assert. Two finite faces from
  // different parts lying in ONE plane with real in-plane overlap
  // z-fight on screen (the user saw it twice: the outrunner's capped
  // face under its spokes, then the washers on the flange disc). The
  // rule is "a part standing on another starts INSIDE it", and this
  // measures it: canonical plane bucketing (normal + SIGNED offset — a
  // mirror pair at +x/-x is not one plane), tolerance 0.0015*caseR, real
  // projected overlap in both tangent axes, sliver faces ignored.
  // Fin-stack pairs are exempt: G24.5's neighbour clip planes kiss BY
  // DESIGN. Zero pairs is the assert, on every case.
  {
    const recs = [];
    const kindOf = {};
    for (const p of M.parts) kindOf[p.name] = p.kind;
    for (const p of M.parts)
      for (let fi = p.f0; fi < p.f1; fi++) {
        const q = M.F[fi].v;
        const a = M.V[q[0]], b3 = M.V[q[1]], c3 = M.V[q[2]], d3 = M.V[q[3]];
        const u = [b3[0]-a[0], b3[1]-a[1], b3[2]-a[2]];
        const w = [c3[0]-a[0], c3[1]-a[1], c3[2]-a[2]];
        let n = [u[1]*w[2]-u[2]*w[1], u[2]*w[0]-u[0]*w[2], u[0]*w[1]-u[1]*w[0]];
        const l = Math.hypot(n[0], n[1], n[2]);
        if (l < 1e-14) continue;
        n = [n[0]/l, n[1]/l, n[2]/l];
        const pts = [a, b3, c3, d3];
        recs.push({ part: p.name, n,
          off: n[0]*a[0] + n[1]*a[1] + n[2]*a[2],
          lo: [0,1,2].map(k => Math.min(...pts.map(p2 => p2[k]))),
          hi: [0,1,2].map(k => Math.max(...pts.map(p2 => p2[k]))),
          area: l / 2 });
      }
    const tol = 0.0015 * cR, minA = Math.pow(0.03 * cR, 2), shr = 0.004 * cR;
    const buckets = new Map();
    for (const r2 of recs) {
      let n = r2.n, off = r2.off;
      if (n[2] < -1e-6 || (Math.abs(n[2]) < 1e-6 && (n[1] < -1e-6 ||
          (Math.abs(n[1]) < 1e-6 && n[0] < 0)))) {
        n = [-n[0], -n[1], -n[2]]; off = -off;
      }
      const key = Math.round(n[0]*50) + ',' + Math.round(n[1]*50) + ',' +
                  Math.round(n[2]*50);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(Object.assign({}, r2, { cOff: off }));
    }
    const flagged = new Set();
    for (const arr of buckets.values()) {
      if (arr.length < 2) continue;
      arr.sort((x, y) => x.cOff - y.cOff);
      for (let i = 0; i < arr.length; i++)
        for (let j = i + 1; j < arr.length; j++) {
          const A = arr[i], B = arr[j];
          if (B.cOff - A.cOff > tol) break;
          if (A.part === B.part) continue;
          if (kindOf[A.part] === 'fins' && kindOf[B.part] === 'fins') continue;
          // a lead may lie ON its own cylinder — the routing field exempts
          // it, so a tangent facet of lead i on cylinder i's metal is
          // contact, not a defect (two LEADS coplanar still flags)
          {
            const li = A.part.match(/^lead[TB](\d+)$/) ||
                       B.part.match(/^lead[TB](\d+)$/);
            if (li) {
              const other = /^lead[TB]\d+$/.test(A.part) ? B.part : A.part;
              if (new RegExp('^(barrel|fins|head|headFins)' + li[1] + '$')
                  .test(other)) continue;
            }
          }
          if (Math.min(A.area, B.area) < minA) continue;
          const dp = Math.abs(A.n[0]*B.n[0] + A.n[1]*B.n[1] + A.n[2]*B.n[2]);
          if (dp < 0.9995) continue;
          const n = A.n;
          const ref = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
          let u = [n[1]*ref[2]-n[2]*ref[1], n[2]*ref[0]-n[0]*ref[2],
                   n[0]*ref[1]-n[1]*ref[0]];
          const ul = Math.hypot(u[0], u[1], u[2]);
          u = [u[0]/ul, u[1]/ul, u[2]/ul];
          const w = [n[1]*u[2]-n[2]*u[1], n[2]*u[0]-n[0]*u[2],
                     n[0]*u[1]-n[1]*u[0]];
          const proj = (r3, ax) => {
            let mn = 1e9, mx = -1e9;
            for (const cx of [r3.lo[0], r3.hi[0]])
              for (const cy of [r3.lo[1], r3.hi[1]])
                for (const cz of [r3.lo[2], r3.hi[2]]) {
                  const t2 = ax[0]*cx + ax[1]*cy + ax[2]*cz;
                  if (t2 < mn) mn = t2; if (t2 > mx) mx = t2;
                }
            return [mn, mx];
          };
          let ov = true;
          for (const ax of [u, w]) {
            const [a0, a1] = proj(A, ax), [b0, b1] = proj(B, ax);
            if (Math.min(a1, b1) - Math.max(a0, b0) < shr) ov = false;
          }
          if (ov) flagged.add([A.part, B.part].sort().join(' | '));
        }
    }
    hard(C.name + ': no kissing faces (coplanar overlap = moire)',
         flagged.size === 0, [...flagged].slice(0, 4).join(', '));
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
  // the DECLARED aircraft-side exceptions to the ratio rule are OFF: the
  // plate + strip (fwOn), and — since the fwPlane rule (G32) keys the
  // plane furniture off mount-or-plate — the metric battery/ECU and the
  // metre-anchored service lines too. fwW still scales because the
  // mount-point clamp reads it even with the plate off; the mount, its
  // fittings and mountR stay ON, so the fixation proves the ratio rule.
  const S = 2;
  const bare = { fwOn: 0, battOn: 0, ecuOn: 0, plumb: 0 };
  const M1 = engMeshBuild(Object.assign({}, bare));
  const M2 = engMeshBuild(Object.assign({}, bare, {
    bore: ENG_DEFAULT.bore * S,
    stroke: ENG_DEFAULT.stroke * S, flangeLen: ENG_DEFAULT.flangeLen * S,
    accLen: ENG_DEFAULT.accLen * S,
    fwW: ENGM_DEFAULT.fwW * S, fwH: ENGM_DEFAULT.fwH * S }));
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

// ---- 5b: scale invariance, electric ---------------------------------------
// the electric registry span is 28 mm to 420 mm of can — the same rule,
// its own proof (fwOn: 0, the declared aircraft-side exception, as above)
{
  const S = 2;
  const bareE = { arch: 'electric', fwOn: 0, battOn: 0, ecuOn: 0, plumb: 0 };
  const E1 = engMeshBuild(Object.assign({}, bareE));
  const E2 = engMeshBuild(Object.assign({}, bareE,
    { canD: 0.0278 * S, canL: 0.026 * S, fwW: 0.80 * S, fwH: 0.70 * S }));
  hard('electric scale: same counts',
       E1.V.length === E2.V.length && E1.F.length === E2.F.length,
       E1.V.length + ' vs ' + E2.V.length);
  let worstE = 0;
  if (E1.V.length === E2.V.length)
    for (let i = 0; i < E1.V.length; i++)
      for (let k = 0; k < 3; k++)
        worstE = Math.max(worstE, Math.abs(E2.V[i][k] - S * E1.V[i][k]));
  hard('electric scale: coordinates exactly 2x', worstE < 1e-9,
       'worst ' + worstE.toExponential(2));
}

// dressed families: flat, inline (coerced two-stroke), radial (coerced
// four-stroke, air), electric (G25) — only genuinely undressed layouts refuse
{
  let threw = false;
  try { engMeshBuild({ arch: 'vee' }); } catch (e) { threw = true; }
  hard('a vee refuses loudly', threw);
  hard('an electric builds (G25)',
       engMeshBuild({ arch: 'electric' }).stats.quads > 0);
  hard('an inline is coerced to two-stroke',
       engMeshBuild({ arch: 'inline', cyl: 2 }).P.twoStroke === 1);
  hard('a radial is coerced to air-cooled four-stroke', (() => {
    const M2 = engMeshBuild({ arch: 'radial', cyl: 5, twoStroke: 1, liquid: 1 });
    return M2.P.twoStroke === 0 && M2.P.liquid === 0;
  })());
}

// ---- THE EXHAUST OUTLET IS PLACED (G155) ----------------------------------
// The user: "the outlet could be oriented up/down/right/left, and moves along
// all axis's. Possibility for 1 or 2 outlets ... with 1 or 2 collectors."
//
// The frozen half is already proven above: every engine in the table above is
// built with the new defaults and its counts and medians are unchanged, which
// is what "exAim 0 with zero offsets draws the old pipe" means in practice.
// What is left to show is that the controls DO something, and in the right
// direction — a row that moves nothing is the defect this whole gate exists
// to catch.
{
  const base = { arch: 'flat', cyl: 4, bore: 0.103, stroke: 0.098,
                 rpm: 2300, exStyle: 2 };
  // THE PORT COLLECTOR'S OUTLET, measured as the CENTROID OF ITS END RING —
  // not as its aft-most vertex. The first cut used the extreme vertex and it
  // reported the left/right offset as moving the tip 0.053 left and 0.026 AFT,
  // which looks like the rows being crossed and is not: the tailpipe is a
  // swept tube, so when its end leaves at a different angle the ring tilts and
  // a DIFFERENT vertex becomes aft-most. Averaging the ring measures the pipe
  // rather than the winner of a race between its vertices.
  // (Two cans are mirror images, so one side is the whole story, and picking a
  // side is what keeps the x tests unambiguous.)
  const tip = (over) => {
    const M = engMeshBuild(Object.assign({}, base, over));
    // BY ORDER, not by sign: the builder emits port first. Selecting on x < 0
    // looked equivalent and is not — a big enough left/right offset carries
    // the port outlet across the centreline, and the filter then dropped the
    // very case under test.
    const outs = M.ports.exhaustOut || [];
    const cans = M.parts.filter(p => p.name === 'collector').length;
    return { p: outs[0] || null, cans, M };
  };
  const d = tip({});
  hard('the collector has a tailpipe to measure', !!d.p);
  if (d.p) {
    const up = tip({ exAim: 1 }), lf = tip({ exAim: 2 }), rt = tip({ exAim: 3 });
    hard('outlet aimed UP leaves higher than aimed DOWN',
         up.p[1] > d.p[1], f(d.p[1], 3) + ' -> ' + f(up.p[1], 3));
    hard('outlet aimed LEFT leaves further to port',
         lf.p[0] < d.p[0], f(d.p[0], 3) + ' -> ' + f(lf.p[0], 3));
    hard('outlet aimed RIGHT leaves further to starboard',
         rt.p[0] > lf.p[0], f(lf.p[0], 3) + ' -> ' + f(rt.p[0], 3));
    // ...and it moves on all three axes, each one on its own
    const mx = tip({ exOutX: 1 }), my = tip({ exOutY: 1 }), mz = tip({ exOutZ: -1 });
    hard('the outlet moves left/right', mx.p[0] > d.p[0] + 1e-6,
         f(d.p[0], 3) + ' -> ' + f(mx.p[0], 3));
    hard('the outlet moves up/down', my.p[1] > d.p[1] + 1e-6,
         f(d.p[1], 3) + ' -> ' + f(my.p[1], 3));
    hard('the outlet moves fore/aft', mz.p[2] < d.p[2] - 1e-6,
         f(d.p[2], 3) + ' -> ' + f(mz.p[2], 3));
    // ...and each offset moves its OWN axis, EXACTLY and alone. Measuring the
    // published outlet rather than the mesh is what makes "exactly" available:
    // an earlier cut inferred the point from the aft-most vertices and read
    // the left/right row as moving the outlet 0.052 left and 0.023 AFT, which
    // looks like the rows being crossed and was the flared lip and the tilted
    // end ring. The pipe is drawn to this point; the drawing is checked below.
    const bore = base.bore;
    const only = (m, ax) => {
      const dd = [0, 1, 2].map(k => m.p[k] - d.p[k]);
      const other = Math.max(...dd.map(Math.abs).filter((_, k) => k !== ax));
      return { ok: Math.abs(Math.abs(dd[ax]) - bore) < 1e-9 && other < 1e-9,
               txt: dd.map(x => f(x, 4)).join(' / ') + '  (bore ' + f(bore, 4) + ')' };
    };
    const dx = only(mx, 0), dy = only(my, 1), dz = only(mz, 2);
    hard('the left/right offset moves the outlet left/right, and only that',
         dx.ok, dx.txt);
    hard('the up/down offset moves it up/down, and only that', dy.ok, dy.txt);
    hard('the fore/aft offset moves it fore/aft, and only that', dz.ok, dz.txt);

    // AND THE PIPE IS ACTUALLY DRAWN THERE. The published point would be a
    // claim about nothing if the geometry ignored it, so the collector's own
    // vertices have to reach it — within the tailpipe's radius, because the
    // outlet is the centre of a lipped mouth and not a vertex.
    const near = (m) => {
      let best = Infinity;
      for (const p of m.M.parts) {
        if (p.name !== 'collector') continue;
        for (let i = p.v0; i < p.v1; i++) {
          const q = m.M.V[i];
          best = Math.min(best, Math.hypot(q[0] - m.p[0], q[1] - m.p[1],
                                           q[2] - m.p[2]));
        }
      }
      return best;
    };
    hard('the collector is drawn to its published outlet', near(d) < 0.35 * bore,
         f(near(d), 4) + ' m from the mouth');
    hard('...and still is when the outlet is moved', near(mz) < 0.35 * bore,
         f(near(mz), 4) + ' m');
  }
  // ONE COLLECTOR OR TWO, and every cylinder still has a pipe either way
  const two = tip({}), one = tip({ exOut: 1 });
  hard('two collectors by default', two.cans === 2, String(two.cans));
  hard('one collector when asked', one.cans === 1, String(one.cans));
  const nExh1 = one.M.parts.filter(p => /^exhaust\d+$/.test(p.name)).length;
  hard('a single collector still takes every cylinder\'s stack',
       nExh1 === one.M.resolved.cyl, nExh1 + ' of ' + one.M.resolved.cyl);
}

console.log();
// THE VERDICT CONTRACT (G67.1): this checker joins the battery, and the
// runner requires BOTH signals — the line and the exit code.
if (fail) console.log('  ' + fail + ' check(s) failed');
console.log('GATE ENGMESH: ' + (fail ? 'FAIL' : 'PASS'));
process.exit(fail ? 1 : 0);
