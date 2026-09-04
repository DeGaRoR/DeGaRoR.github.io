// FIN CHECK — the verdict on _fin_gen.js against the user's sketch.
//
//   node tools/_fin_check.js [--verbose]
//
// 1. buildFin2(finSpec(FIN_PARAMS)) must reproduce tools/_fin_ref.obj's
//    `finGeometry` object exactly: vertex-for-vertex IN FILE ORDER (the
//    generator emits in the sketch's own order), face cycles up to
//    rotation/reflection, and materials.
// 2. The fiche's offKeel is re-measured against the step-2 template
//    subdivided x2 (the surface the sketch was drawn on).
// 3. Health: keel on/off x creases x moved corners x deck modes — every
//    build finite, planar (x = 0), deterministic, quad counts exact through
//    two subdivisions, root chain propagated and projectable.
'use strict';
const fs = require('fs');
const path = require('path');
const FIN = require('./_fin_gen.js');
const G = require('./_cage_gen.js');

const VERBOSE = process.argv.includes('--verbose');
const TOL = 2e-4;                       // the OBJ carries 6 decimals
let anyFail = false;
const fail = msg => { anyFail = true; console.log('  FAIL ' + msg); };

// ---- parse the reference (the fin object only; the file also carries the
// step-2 template fuselage the sketch was drawn against) ---------------------
function parseFinObj(file) {
  const V = [], F = [];
  let obj = '', mtl = '', before = 0;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (line.startsWith('o ')) {
      obj = line.slice(2).trim();
      if (obj !== 'finGeometry') before += 0;    // counted below via total
      continue;
    }
    if (line.startsWith('v ')) {
      const p = line.trim().split(/\s+/);
      if (obj === 'finGeometry') V.push([+p[1], +p[2], +p[3]]);
      else before++;
      continue;
    }
    if (line.startsWith('usemtl')) { mtl = line.slice(7).trim(); continue; }
    if (line.startsWith('f ') && obj === 'finGeometry') {
      const idx = line.trim().split(/\s+/).slice(1)
        .map(t => parseInt(t.split('/')[0], 10) - 1 - before);
      F.push({ v: idx, m: mtl });
    }
  }
  return { V, F };
}

const cycKey = ids => {
  let best = null;
  for (const dir of [ids, ids.slice().reverse()])
    for (let r = 0; r < dir.length; r++) {
      const k = dir.slice(r).concat(dir.slice(0, r)).join('_');
      if (best === null || k < best) best = k;
    }
  return best;
};

// ---- 1: exact reproduction -------------------------------------------------
{
  const ref = parseFinObj(path.join(__dirname, '_fin_ref.obj'));
  const gen = FIN.buildFin2(FIN.finSpec(FIN.FIN_PARAMS));
  console.log(`ref ${ref.V.length} v / ${ref.F.length} q · ` +
              `gen ${gen.V.length} v / ${gen.F.length} q`);
  if (ref.V.length !== gen.V.length) fail('vertex count');
  let maxDev = 0;
  for (let i = 0; i < Math.min(ref.V.length, gen.V.length); i++) {
    const d = Math.hypot(ref.V[i][0] - gen.V[i][0], ref.V[i][1] - gen.V[i][1],
                         ref.V[i][2] - gen.V[i][2]);
    if (d > maxDev) maxDev = d;
    if (d > TOL) fail(`v${i} dev ${d.toFixed(6)} ` +
      `ref(${ref.V[i]}) gen(${gen.V[i]})`);
  }
  console.log(`vertex maxDev ${maxDev.toExponential(2)} (in file order)`);
  const refFaces = new Map();
  ref.F.forEach(f => refFaces.set(cycKey(f.v), f));
  let mBad = 0;
  for (const f of gen.F) {
    const rf = refFaces.get(cycKey(f.v));
    if (!rf) { fail(`gen face not in ref: [${f.v}] ${f.m}`); continue; }
    if (rf.m !== f.m) { mBad++; fail(`mat ${f.m} vs ref ${rf.m} at [${f.v}]`); }
    refFaces.delete(cycKey(f.v));
  }
  for (const [, rf] of refFaces) fail(`ref face leftover [${rf.v}] ${rf.m}`);
  console.log(`faces matched, materials ${mBad ? mBad + ' diffs' : '100%'}`);
}

// ---- 1b: THE CUB TAIL — the user's second reference (dorsal deleted).
// FIN_CUB must rebuild tools/_fin_cub_ref.obj exactly: same topology family,
// settings only. Vertex order differs (Blender re-exported after deletions),
// so matching is nearest-neighbour + face cycles, _cage_fit style. ----------
{
  const ref = parseFinObj(path.join(__dirname, '_fin_cub_ref.obj'));
  const gen = FIN.buildFin2(FIN.finSpec(FIN.FIN_CUB));
  console.log(`\ncub ref ${ref.V.length} v / ${ref.F.length} q · ` +
              `gen ${gen.V.length} v / ${gen.F.length} q`);
  if (ref.V.length !== gen.V.length || ref.F.length !== gen.F.length)
    fail('cub counts');
  const map = new Array(gen.V.length);
  let maxDev = 0;
  gen.V.forEach((p, i) => {
    let best = 1e9, bi = -1;
    ref.V.forEach((q, j) => {
      const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
      if (d < best) { best = d; bi = j; }
    });
    map[i] = bi;
    if (best > maxDev) maxDev = best;
    if (best > TOL) fail(`cub gen v${i} (${p.map(v => v.toFixed(4))}) ` +
      `nearest ref ${best.toFixed(5)}`);
  });
  if (new Set(map).size !== gen.V.length) fail('cub vertex mapping not 1:1');
  const refFaces = new Map();
  ref.F.forEach(f => refFaces.set(cycKey(f.v), f));
  for (const f of gen.F) {
    const k = cycKey(f.v.map(i => map[i]));
    const rf = refFaces.get(k);
    if (!rf) { fail(`cub gen face not in ref: [${f.v}] ${f.m}`); continue; }
    if (rf.m !== f.m) fail(`cub mat ${f.m} vs ref ${rf.m}`);
    refFaces.delete(k);
  }
  for (const [, rf] of refFaces) fail(`cub ref face leftover [${rf.v}] ${rf.m}`);
  console.log(`cub vertex maxDev ${maxDev.toExponential(2)} (NN), faces + ` +
              `materials matched`);
}

// ---- 2: the template deck under the sketch (offKeel provenance, and the
// measured size of the artifact the projection cures) ------------------------
let TDECK = null;
{
  let s = G.buildCage2(G.CAGE_DEFAULT, 2);
  for (let i = 0; i < 2; i++) s = G.cageSubdivide(s);
  TDECK = FIN.finCentreline(s, null);
  const D = FIN.FIN_DEFAULT;
  const offK = D.yKeel - TDECK.bot(D.zH1);
  console.log(`template keel(zH1) ${TDECK.bot(D.zH1).toFixed(6)} -> ` +
              `offKeel measured ${offK.toFixed(6)} / fiche ${D.offKeel}`);
  if (Math.abs(offK - D.offKeel) > 1e-3) fail('offKeel drifted from the fiche');
  for (const [c, z] of [['A', D.zA], ['B', D.zB], ['C', D.zC]]) {
    const off = D.lo[c] - TDECK.top(z);
    console.log(`  sketch root ${c} sits ${(off * 1000).toFixed(1)} mm ` +
                `off the template deck (absorbed by deck mode)`);
  }
}

// ---- 3: health sweeps ------------------------------------------------------
const finite = m => m.V.every(p => p.every(Number.isFinite));
const planar = m => m.V.every(p => Math.abs(p[0]) < 1e-9);
let cases = 0;
for (const dorsal of [0, 1])
for (const rootG of [0, 1])
for (const keel of [0, 1])
for (const cr of [0, 2])
for (const dc of [0, 0.3, -0.3])
for (const deck of [null, TDECK]) {
  const S = Object.assign(FIN.finSpec(FIN.FIN_PARAMS), {
    dorsal, rootGuard: rootG, keelExt: keel, crA: cr, crB: cr,
    hornPrep: dc !== 0 ? 1 : 0,
    tipZ: dc, tipY: dc, aftZ: -Math.abs(dc), aftY: dc,
    baseZ: -Math.abs(dc), baseY: Math.max(0, dc),
    midY: -dc * 0.5, uY: -dc * 0.3, rootFwd: dc * 1.5,
    leZ: -Math.abs(dc) * 0.5,
    teRoot: -Math.abs(dc) * 0.3, teU: -Math.abs(dc) * 0.3,
    teMid: -Math.abs(dc) * 0.3, topY: dc * 0.2,
    sharpTip: Math.abs(dc) * 10, sharpAft: cr, sharpBase: cr,
    sharpShoulder: cr, sharpLE: Math.abs(dc) * 10, deck });
  const m0 = FIN.buildFin2(S);
  const F0 = 12 + (dorsal ? 4 : 0) + (keel ? 2 : 0)
    - (rootG ? 0 : (dorsal ? 5 : 3));
  const V0 = 20 + (dorsal ? 6 : 0) + (keel ? 3 : 0)
    - (rootG ? 0 : (dorsal ? 6 : 4));
  if (m0.V.length !== V0 || m0.F.length !== F0)
    fail(`counts ${m0.V.length}/${m0.F.length} for dorsal ${dorsal} ` +
         `rootG ${rootG} keel ${keel}`);
  if (!finite(m0) || !planar(m0)) fail(`cage not finite/planar (dorsal ${dorsal} keel ${keel} cr ${cr} d ${dc})`);
  let s = m0;
  for (let l = 0; l < 2; l++) s = G.cageSubdivide(s);
  if (s.F.length !== F0 * 16) fail(`L2 quad count ${s.F.length} != ${F0 * 16}`);
  if (!finite(s) || !planar(s)) fail(`L2 not finite/planar (dorsal ${dorsal} keel ${keel} cr ${cr} d ${dc})`);
  if (!s.finRootLo || s.finRootLo.length !== (dorsal ? 5 : 3) * 4)
    fail(`root chain ${s.finRootLo && s.finRootLo.length} edges at L2`);
  if (!s.finMidRow || s.finMidRow.length !== 3 * 4)
    fail(`mid-row chain ${s.finMidRow && s.finMidRow.length} edges at L2`);
  if (deck) {
    // the artifact, measured: how far the subdivided boundary strays from the
    // skin WHERE THE FUSELAGE EXISTS, and that projection zeroes it there
    // (aft of the tail cap the strand is free and stays untouched)
    const ids = new Set();
    for (const [a, b] of s.finRootLo) { ids.add(a); ids.add(b); }
    const inBody = [...ids].filter(i => s.V[i][2] >= TDECK.z0);
    let dip = 0;
    for (const i of inBody)
      dip = Math.max(dip, Math.abs(s.V[i][1] - m0.deckTop(s.V[i][2])));
    const r = FIN.finProjectRoot(s, m0.deckTop, TDECK.z0);
    let after = 0;
    for (const i of inBody)
      after = Math.max(after, Math.abs(s.V[i][1] - m0.deckTop(s.V[i][2])));
    if (after > 1e-12) fail(`projection residue ${after}`);
    if (r.n !== inBody.length) fail(`projected ${r.n} != in-body ${inBody.length}`);
    if (VERBOSE || (cr === 0 && dc === 0 && rootG === 1))
      console.log(`  deck mode dorsal ${dorsal} keel ${keel}: boundary ` +
        `strayed ${(dip * 1000).toFixed(2)} mm from the skin in-body, ` +
        `projected to 0 (${r.n}/${ids.size} verts)`);
  }
  // determinism
  const m1 = FIN.buildFin2(S);
  if (JSON.stringify(m0.V) !== JSON.stringify(m1.V)) fail('not deterministic');
  cases++;
}
console.log(`health: ${cases} cases (dorsal x root x keel x crease x ` +
            `corners+rows x horn x deck), L2 each`);

// ---- 3b: the root economy, measured — how far the single-creased root's
// surface sits from the guard pair's (the hi strand and its strip cost 6
// verts and 5 quads on the sketch; the question is what they buy) ----------
{
  const a = FIN.buildFin2(FIN.finSpec(FIN.FIN_PARAMS));
  const b = FIN.buildFin2(Object.assign(FIN.finSpec({}), { rootGuard: 0 }));
  let sa = a, sb = b;
  for (let l = 0; l < 2; l++) { sa = G.cageSubdivide(sa); sb = G.cageSubdivide(sb); }
  // point-to-SURFACE (b verts against a's edge segments — vert-NN read 67 mm
  // where the true divergence is a fifth of that, pure sampling mismatch)
  const segs = [], seen = new Set();
  for (const f of sa.F) for (let i = 0; i < f.v.length; i++) {
    const p = f.v[i], q = f.v[(i + 1) % f.v.length];
    const k = p < q ? p + '_' + q : q + '_' + p;
    if (seen.has(k)) continue;
    seen.add(k);
    segs.push([sa.V[p], sa.V[q]]);
  }
  let worst = 0;
  for (const p of sb.V) {
    let best = 1e9;
    for (const [A, B] of segs) {
      const vy = B[1] - A[1], vz = B[2] - A[2];
      const L2 = vy * vy + vz * vz || 1;
      let t = ((p[1] - A[1]) * vy + (p[2] - A[2]) * vz) / L2;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(p[1] - (A[1] + vy * t), p[2] - (A[2] + vz * t));
      if (d < best) best = d;
    }
    worst = Math.max(worst, best);
  }
  console.log(`root economy: cage ${a.V.length}v/${a.F.length}q -> ` +
    `${b.V.length}v/${b.F.length}q · single-creased root within ` +
    `${(worst * 1000).toFixed(1)} mm (surface, L2) of the guard pair`);
}

// ---- 3c: CORNER SHARPNESS — semi-sharp vertex weights pin an outline
// corner that edge creases never could (two boundary edges only). Weight 3
// holds the cage position through L2 exactly; weight 0 is the identity
// B-spline round. ----------------------------------------------------------
{
  const probe = sharp => {
    const S = Object.assign(FIN.finSpec(FIN.FIN_CUB), { sharpTip: sharp });
    const m0 = FIN.buildFin2(S);
    const tip = m0.V.reduce((a, p) => p[1] > a[1] ? p : a, m0.V[0]);
    let s = m0;
    for (let l = 0; l < 2; l++) s = G.cageSubdivide(s);
    let best = 1e9;
    for (const p of s.V)
      best = Math.min(best, Math.hypot(p[1] - tip[1], p[2] - tip[2]));
    return best;
  };
  const pinned = probe(3), round = probe(0);
  if (pinned > 1e-9) fail(`sharp corner not pinned (${pinned})`);
  if (round < 0.01) fail(`round corner did not ease (${round})`);
  console.log(`corner sharpness: weight 3 pins the tip to ` +
    `${pinned.toExponential(1)}, weight 0 eases it ${(round * 1000).toFixed(0)} mm`);
}

// ---- 3d: the root's own degrees of freedom (user ask): the forward point
// is a station, and keel-off baseY pulls the strand's TE end off the root
// line — the stab's centre-apart elevator clearance -----------------------
{
  const S1 = Object.assign(FIN.finSpec({}), { dorsal: 0, rootFwd: 1.0 });
  const m1 = FIN.buildFin2(S1);
  const D = FIN.FIN_DEFAULT;
  let atC = false;
  for (const p of m1.V)
    if (Math.abs(p[2] - (D.zC + 1.0)) < 1e-9) atC = true;
  if (!atC) fail('rootFwd did not move the front column');
  const S2 = Object.assign(FIN.finSpec({}),
    { dorsal: 0, keelExt: 0, baseY: 0.3 });
  const m2 = FIN.buildFin2(S2);
  const ids = new Set();
  for (const [a, b] of m2.finRootLo) { ids.add(a); ids.add(b); }
  let lifted = 0;
  for (const i of ids) lifted = Math.max(lifted, m2.V[i][1] - D.lo.H);
  if (Math.abs(lifted - 0.3) > 1e-9)
    fail(`keel-off baseY lift ${lifted} != 0.3`);
  console.log('root freedoms: front column moves, keel-off baseY lifts ' +
    'the strand TE end 0.300');
}

// ---- 4: the rebase — the fin lands on the tailpost of the aeroplane it is
// given, not the template's (measured on the jodel: its fuselage is a unit
// shorter, and without this the fin floated in air behind it) ---------------
{
  const D = FIN.FIN_DEFAULT;
  // template deck: its cap IS the sketch's anchor, so nothing moves
  const a = FIN.buildFin2(Object.assign(FIN.finSpec({}), { deck: TDECK }));
  let zMinA = Infinity;
  for (const p of a.V) zMinA = Math.min(zMinA, p[2]);
  if (Math.abs(zMinA - D.zTE - (TDECK.z0 - D.zCap)) > 1e-9)
    fail('template-deck rebase moved the fin');
  if (Math.abs(TDECK.z0 - D.zCap) > 1e-4)
    fail(`template cap ${TDECK.z0} is not the fiche's zCap ${D.zCap}`);
  // a shorter aeroplane: the whole fin translates onto its tail cap
  const fake = { top: z => 0.5, bot: z => -0.06, z0: -3.0, z1: 4.0 };
  const b = FIN.buildFin2(Object.assign(FIN.finSpec({}), { deck: fake }));
  let zMinB = Infinity;
  for (const p of b.V) zMinB = Math.min(zMinB, p[2]);
  const want = D.zTE + (-3.0 - D.zCap);
  if (Math.abs(zMinB - want) > 1e-9)
    fail(`short-body rebase: TE at ${zMinB}, want ${want}`);
  console.log(`rebase: template cap dz ${(TDECK.z0 - D.zCap).toExponential(1)}` +
              `, short-body TE lands at ${zMinB.toFixed(6)}`);
}

// ---- 5: THE CUT — straight lines post-subsurf, on the rails the cage
// carries. Asserted: gap 0 partitions the sheet EXACTLY (area conserved);
// with a gap, every face lies wholly in its region, the loss is the slots
// and nothing more, and each part is ONE connected piece. ------------------
{
  const areaOf = pts => {
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const P = pts[i], Q = pts[(i + 1) % pts.length];
      a += P[2] * Q[1] - Q[2] * P[1];
    }
    return Math.abs(a) / 2;
  };
  const meshArea = m => m.F.reduce((a, f) =>
    a + areaOf(f.v.map(i => m.V[i])), 0);
  const components = (m, part) => {
    const key = p => p.map(v => Math.round(v * 1e6)).join('_');
    const faces = m.F.filter(f => f.part === part);
    const parent = faces.map((_, i) => i);
    const find = x => {
      while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
      return x;
    };
    const byV = new Map();
    faces.forEach((f, i) => {
      for (const vi of f.v) {
        const k = key(m.V[vi]);
        if (byV.has(k)) {
          const a = find(byV.get(k)), b = find(i);
          if (a !== b) parent[a] = b;
        } else byV.set(k, i);
      }
    });
    return new Set(faces.map((_, i) => find(i))).size;
  };
  const GAP = 0.012, EPS = 1e-9;
  const doCut = (m0, s, mode, gap) =>
    FIN.finCutMesh(s, { mode, zCut: m0.cutZ, gap });
  for (const [label, params] of [['sketch', FIN.FIN_PARAMS],
                                 ['cub', FIN.FIN_CUB]])
  for (const mode of [1, 2]) {
    const S = FIN.finSpec(params);
    S.cutPrep = mode;
    const m0 = FIN.buildFin2(S);
    let s = m0;
    for (let l = 0; l < 2; l++) s = G.cageSubdivide(s);
    if (mode === 2) {
      // the horizontal artery is creased FULL LENGTH: dead horizontal at
      // every vertex, end to end ("full horizontal", user ruling — the
      // pinned midTE corner is the accepted consequence)
      const ids = new Set();
      for (const [a, b] of s.finMidRow) { ids.add(a); ids.add(b); }
      for (const i of ids)
        if (Math.abs(s.V[i][1] - m0.rowY) > 1e-9)
          { fail(`${label}: mid row not exact under horn prep`); break; }
    }
    const A0 = meshArea(s);
    // THE CUT FOLLOWS THE MESH: every output face is a sheet QUAD — no
    // clipped polygons at all, in either mode (the user's wireframe report)
    const cut = doCut(m0, s, mode, GAP);
    const g2 = GAP / 2;
    let nonQuad = 0;
    for (const f of cut.F) if (f.v.length !== 4) nonQuad++;
    if (nonQuad) fail(`${label} mode ${mode}: ${nonQuad} non-quad faces`);
    // containment: the fin forward of the band centre; the rudder behind it
    // or (horn mode) wrapped over the row
    for (const f of cut.F) {
      for (const vi of f.v) {
        const p = cut.V[vi];
        // the rudder tolerance reaches across the deleted band: the slot's
        // ceiling (the row over the band) may sag a few mm there, hidden
        // inside the slot
        // the fin's row drops by the FULL gap; the rudder's underside stays
        // exactly ON the row line (the single-horizontal-line ruling)
        const ok = f.part === 'fin'
          ? p[2] >= m0.cutZ - 1e-6 &&
            (mode === 1 || p[1] <= m0.rowY - GAP + EPS)
          : p[2] <= m0.cutZ + 0.02 ||
            (mode === 2 && p[1] >= m0.rowY - 1e-6);
        if (!ok) { fail(`${label} mode ${mode}: ${f.part} vert outside its ` +
                        `region (${p[1].toFixed(4)},${p[2].toFixed(4)})`); break; }
      }
    }
    // the loss is the DELETED GUARD BAND (the drawn hinge slot) plus the
    // small squeeze of the horn shifts — bounded both ways
    const loss = A0 - meshArea(cut);
    if (loss < 0.015 || loss > 0.12)
      fail(`${label} mode ${mode}: band loss ${loss.toExponential(2)}`);
    // gap 0 differs from gap only by the shift squeeze
    const c0 = doCut(m0, s, mode, 0);
    if (meshArea(c0) < meshArea(cut) - 1e-9)
      fail(`${label} mode ${mode}: gap grew the sheet`);
    for (const part of ['fin', 'rudder']) {
      if (!cut.F.some(f => f.part === part))
        fail(`${label} mode ${mode}: ${part} empty`);
      const nc = components(cut, part);
      if (nc !== 1) fail(`${label} mode ${mode}: ${part} in ${nc} pieces`);
    }
    // determinism
    const again = doCut(m0, s, mode, GAP);
    if (JSON.stringify(again.V) !== JSON.stringify(cut.V))
      fail(`${label} mode ${mode}: cut not deterministic`);
    if (label === 'cub' || VERBOSE)
      console.log(`cut ${label} mode ${mode}: hinge z ${m0.cutZ.toFixed(4)}` +
        ` row y ${m0.rowY.toFixed(4)} · fin ` +
        `${cut.F.filter(f => f.part === 'fin').length} q / rudder ` +
        `${cut.F.filter(f => f.part === 'rudder').length} q · slot loss ` +
        `${loss.toFixed(4)}`);
  }
}

// ---- 6: THICKNESS — post-subsurf, post-cut, per part. Because the cut was
// 2D, each part is a flat polygon and its solid is closed by construction —
// asserted here as a real manifold check: every edge used EXACTLY twice, in
// opposite directions (coherent winding), positive volume per part, sides
// at +-t/2 with the trailing end thinned to thickTE. ------------------------
{
  const TH = 0.06, TE = 0.015, GAP = 0.012;
  for (const [label, params] of [['sketch', FIN.FIN_PARAMS],
                                 ['cub', FIN.FIN_CUB]])
  for (const mode of [0, 2]) {
    const S = FIN.finSpec(params);
    S.cutPrep = mode;
    const m0 = FIN.buildFin2(S);
    let s = m0;
    for (let l = 0; l < 2; l++) s = G.cageSubdivide(s);
    const disp = mode
      ? FIN.finCutMesh(s, { mode, zCut: m0.cutZ, gap: GAP })
      : s;
    let zA = Infinity;
    for (const p of s.V) zA = Math.min(zA, p[2]);
    const solid = FIN.finThicken(disp, { thick: TH, thickTE: TE,
      zHinge: m0.cutZ, zAftEnd: zA });
    if (!solid.V.every(p => p.every(Number.isFinite)))
      fail(`${label} mode ${mode}: solid not finite`);
    // manifold + coherence
    const dirs = new Map();
    for (const f of solid.F) for (let i = 0; i < f.v.length; i++) {
      const a = f.v[i], b = f.v[(i + 1) % f.v.length];
      const k = a < b ? a + '_' + b : b + '_' + a;
      if (!dirs.has(k)) dirs.set(k, []);
      dirs.get(k).push(a < b ? 1 : -1);
    }
    let open = 0, over = 0, incoh = 0;
    for (const [, d] of dirs) {
      if (d.length === 1) open++;
      else if (d.length > 2) over++;
      else if (d[0] + d[1] !== 0) incoh++;
    }
    if (open || over || incoh)
      fail(`${label} mode ${mode}: solid edges open ${open} / ` +
           `overused ${over} / incoherent ${incoh}`);
    // positive volume per part
    const byPart = new Map();
    for (const f of solid.F) {
      if (!byPart.has(f.part)) byPart.set(f.part, []);
      byPart.get(f.part).push(f);
    }
    for (const [part, faces] of byPart) {
      let vol = 0;
      for (const f of faces) {
        const p = f.v.map(i => solid.V[i]);
        for (let k = 1; k + 1 < p.length; k++) {
          const [a, b, c] = [p[0], p[k], p[k + 1]];
          vol += a[0] * (b[1] * c[2] - b[2] * c[1])
               - a[1] * (b[0] * c[2] - b[2] * c[0])
               + a[2] * (b[0] * c[1] - b[1] * c[0]);
        }
      }
      if (vol <= 0) fail(`${label} mode ${mode}: ${part} volume ${vol}`);
    }
    // the thickness field: never fatter than base, thinned at the aft end
    let xMax = 0, xAft = 0;
    for (const p of solid.V) {
      xMax = Math.max(xMax, Math.abs(p[0]));
      if (p[2] < zA + 0.03) xAft = Math.max(xAft, Math.abs(p[0]));
    }
    if (xMax > TH / 2 + 1e-9)
      fail(`${label} mode ${mode}: thickness ${xMax * 2} > ${TH}`);
    if (xAft > 0.011)
      fail(`${label} mode ${mode}: TE not thinned (${(xAft * 2).toFixed(4)})`);
    // ---- THE RIM'S AUTHORED NORMALS (2026-08-31) ---------------------------
    // The tail is drawn NON-INDEXED and computeVertexNormals therefore made
    // every face flat, tranche included. finThicken authors the arc's own
    // normal on the rim and on nothing else; these hold that contract, and
    // each one is a way it can silently rot.
    {
      const withN = solid.F.filter(f => f.n);
      const noN = solid.F.filter(f => !f.n);
      if (!withN.length)
        fail(`${label} mode ${mode}: no face carries a rim normal — the ` +
             'tranche is back to flat shading');
      if (!noN.length)
        fail(`${label} mode ${mode}: EVERY face carries a rim normal — the ` +
             'flat sheets must keep their face normals (user ruling: smooth ' +
             'the rim only, or the flats grow shading artefacts)');
      for (const f of withN) {
        if (f.n.length !== f.v.length) {
          fail(`${label} mode ${mode}: a rim face carries ${f.n.length} ` +
               `normals for ${f.v.length} corners`);
          break;
        }
      }
      let bad = 0, inward = 0;
      // OUTWARD IS DECIDED LOCALLY, against the face's own geometric normal —
      // NOT against a part centroid. A horn-balanced rudder is concave at the
      // slot, and there the true outward normal points TOWARDS the centroid;
      // a centroid test calls that a flip and is simply wrong about it.
      // The face normal comes from the winding, which is what the volume flip
      // changes, so this is the exact test for the trap it is guarding.
      const fnOf = (a, b, c) => {
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
        const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
        const L = Math.hypot(x, y, z);
        return L > 1e-12 ? [x / L, y / L, z / L] : null;
      };
      for (const f of withN) {
        for (let i = 0; i < f.n.length; i++) {
          const q = f.n[i];
          if (!q.every(Number.isFinite) ||
              Math.abs(Math.hypot(q[0], q[1], q[2]) - 1) > 1e-6) { bad++; continue; }
        }
        const p = f.v.map(i => solid.V[i]);
        for (let t = 1; t + 1 < p.length; t++) {
          const fn = fnOf(p[0], p[t], p[t + 1]);
          if (!fn) continue;                       // a degenerate sliver
          for (const j of [0, t, t + 1]) {
            const q = f.n[j];
            if (fn[0] * q[0] + fn[1] * q[1] + fn[2] * q[2] < 0) inward++;
          }
        }
      }
      if (bad) fail(`${label} mode ${mode}: ${bad} rim normals are not unit`);
      // AND EACH NORMAL IS ON ITS OWN CORNER. The sign test above cannot see a
      // REORDER — two arc points one step apart have normals within 180/N deg
      // of each other, so a shuffled `n` still dots positive with the face and
      // still looks fine. This is the exact relation instead: on the rim the
      // profile is x = r*sin(phi) and the normal's x is sin(phi), so within a
      // quad the corner whose vertex is FURTHER along the thickness axis must
      // carry the normal that is further along it too. It fires the moment the
      // volume flip reorders `v` without reordering `n`.
      let shuf = 0;
      for (const f of withN) {
        if (f.v.length !== 4) continue;
        for (const [i, j] of [[0, 3], [1, 2]]) {
          const dv = solid.V[f.v[i]][0] - solid.V[f.v[j]][0];
          const dn = f.n[i][0] - f.n[j][0];
          if (Math.abs(dv) > 1e-9 && Math.abs(dn) > 1e-9 &&
              (dv > 0) !== (dn > 0)) shuf++;
        }
      }
      if (shuf)
        fail(`${label} mode ${mode}: ${shuf} rim corners carry a normal from ` +
             'a DIFFERENT point on the arc — `n` was not reordered with `v`');
      // THE FLIP TRAP: finThicken reverses the winding of a part whose signed
      // volume came out negative, and an authored normal that did not go with
      // it lights the tranche from inside.
      if (inward)
        fail(`${label} mode ${mode}: ${inward} rim normals face the opposite ` +
             'way from their own triangle — the volume flip reversed the ' +
             'winding and left `n` behind');
    }

    if (label === 'cub' || VERBOSE)
      console.log(`solid ${label} mode ${mode}: ${solid.V.length} v / ` +
        `${solid.F.length} q · |x|max ${(xMax * 2).toFixed(3)} · aft ` +
        `${(xAft * 2).toFixed(3)} · rim faces ` +
        `${solid.F.filter(f => f.n).length}`);
  }
}

// ---------------------------------------------------------------------------
// THE EDGE SECTION COUNT is a setting now (`opts.rimN`), and it was a module
// constant. If it is ignored the row is a slider that does nothing, which is
// indistinguishable from the defect it was added to fix.
// ---------------------------------------------------------------------------
{
  const s = FIN.buildFin2(FIN.finSpec(FIN.FIN_CUB));
  let zA = Infinity;
  for (const p of s.V) zA = Math.min(zA, p[2]);
  const at = n => FIN.finThicken(s, { thick: 0.06, thickTE: 0.015,
    zAftEnd: zA, rimN: n });
  const n4 = at(4), n8 = at(8);
  const rim = m => m.F.filter(f => f.n).length;
  if (!(rim(n8) > rim(n4)))
    fail(`rimN is ignored: 4 sections give ${rim(n4)} rim faces and 8 give ` +
         `${rim(n8)} — the edge-sections row does nothing`);
  if (Math.abs(rim(n8) / Math.max(1, rim(n4)) - 2) > 0.06)
    fail(`rimN does not scale the rim linearly: ${rim(n4)} -> ${rim(n8)}`);
  // the DEFAULT is unchanged, so no build moves on load
  const dflt = FIN.finThicken(s, { thick: 0.06, thickTE: 0.015, zAftEnd: zA });
  if (rim(dflt) !== rim(n4))
    fail(`the rimN default is not ${FIN.FIN_NOSE_N || 4} — every existing ` +
         'build changes shape on load');
  // and it is CLAMPED: a 0 or a 200 from a stale save must not fold the rim
  for (const n of [0, -3, 200, NaN]) {
    const m = at(n);
    if (!m.V.every(p => p.every(Number.isFinite)))
      fail(`rimN ${n} produced a non-finite rim`);
    if (!rim(m)) fail(`rimN ${n} produced no rim at all`);
  }
  if (VERBOSE || true)
    console.log(`edge sections: 4 -> ${rim(n4)} rim faces, 8 -> ${rim(n8)}`);

  // ---- THE VOLUME FLIP, FORCED ------------------------------------------
  // finThicken reverses a part's winding when its signed volume comes out
  // negative, and the authored normals have to go with it. No fin or stab the
  // bench builds today lands on that branch, so the guard would sit there
  // untested and the check above would be INERT — it passed with the flip's
  // normal handling deleted. So the branch is provoked: hand finThicken a
  // sheet wound the other way and require the invariant to hold anyway.
  const flipped = { V: s.V, F: s.F.map(f => ({ v: f.v.slice().reverse(),
                                               m: f.m, part: f.part })),
                    cutKeys: s.cutKeys };
  const fs = FIN.finThicken(flipped, { thick: 0.06, thickTE: 0.015,
    zAftEnd: zA, rimN: 6 });
  let flipBad = 0, flipRim = 0, flipShuf = 0;
  for (const f of fs.F) {
    if (!f.n) continue;
    flipRim++;
    if (f.v.length === 4) for (const [i, j] of [[0, 3], [1, 2]]) {
      const dv = fs.V[f.v[i]][0] - fs.V[f.v[j]][0];
      const dn = f.n[i][0] - f.n[j][0];
      if (Math.abs(dv) > 1e-9 && Math.abs(dn) > 1e-9 &&
          (dv > 0) !== (dn > 0)) flipShuf++;
    }
    const q = f.v.map(i => fs.V[i]);
    for (let t = 1; t + 1 < q.length; t++) {
      const ux = q[t][0] - q[0][0], uy = q[t][1] - q[0][1], uz = q[t][2] - q[0][2];
      const vx = q[t+1][0] - q[0][0], vy = q[t+1][1] - q[0][1], vz = q[t+1][2] - q[0][2];
      const nx = uy*vz - uz*vy, ny2 = uz*vx - ux*vz, nz = ux*vy - uy*vx;
      const L = Math.hypot(nx, ny2, nz);
      if (L < 1e-12) continue;
      for (const j of [0, t, t + 1]) {
        const w = f.n[j];
        if ((nx/L)*w[0] + (ny2/L)*w[1] + (nz/L)*w[2] < 0) flipBad++;
      }
    }
  }
  if (!flipRim) fail('the forced-flip case produced no rim to check');
  if (flipBad)
    fail(`the volume flip left ${flipBad} authored normals behind — a part ` +
         'whose winding is reversed lights its tranche from the inside');
  if (flipShuf)
    fail(`the volume flip reordered ${flipShuf} corners without reordering ` +
         'their normals — the tranche shades one arc step out of register');
  console.log(`forced volume flip: ${flipRim} rim faces, ` +
              `${flipBad} inverted, ${flipShuf} out of register`);
}

// ---- 6b: THE STAB — the horizontal tail is the same model, dorsal-less,
// laid flat by finToStab and mirrored. Built exactly as the layer builds
// it: Cub defaults, flat root line, tailpost rebase, hinge-only elevator
// cut, thickened; both halves must be closed coherent solids and exact
// mirrors of each other, with nothing inboard of the root line. -----------
{
  const finP = {};
  for (const k of Object.keys(FIN.FIN_CUB)) finP[k] = FIN.FIN_CUB[k];
  const S = FIN.finSpec(finP);
  S.dorsal = 0; S.keelExt = 0; S.cutPrep = 1;
  const rootLine = FIN.FIN_DEFAULT.lo.H;
  S.deck = { top: () => rootLine,
    bot: () => FIN.FIN_DEFAULT.yKeel - FIN.FIN_DEFAULT.offKeel,
    z0: FIN.FIN_DEFAULT.zCap, z1: 1e9 };
  const m0 = FIN.buildFin2(S);
  let s = m0;
  for (let l = 0; l < 2; l++) s = G.cageSubdivide(s);
  // straight only where the fuselage is (as the layer does): aft of the
  // cap the strand is the elevator's inboard edge and keeps its freedoms
  FIN.finProjectRoot(s, m0.deckTop, S.deck.z0);
  const cut = FIN.finCutMesh(s, { mode: 1, zCut: m0.cutZ, gap: 0.012 });
  let zA = Infinity;
  for (const p of s.V) zA = Math.min(zA, p[2]);
  const solid = FIN.finThicken(cut, { thick: 0.05, thickTE: 0.012,
    zHinge: m0.cutZ, zAftEnd: zA });
  const R = FIN.finToStab(solid, { side: 1, rootX: 0.05, stabY: 0.25,
                                   sRef: rootLine });
  const Lh = FIN.finToStab(solid, { side: -1, rootX: 0.05, stabY: 0.25,
                                    sRef: rootLine });
  // THE CANT (2026-09-04): a rotation of the laid-flat panel about its root
  // line — every vertex of the canted lay is the flat lay's, rotated; and
  // cant 0 (or absent) is the flat lay to the bit
  {
    const G = 0.6, cG = Math.cos(G), sG = Math.sin(G);
    const Rc = FIN.finToStab(solid, { side: 1, rootX: 0.05, stabY: 0.25,
                                      sRef: rootLine, cant: G });
    const R0 = FIN.finToStab(solid, { side: 1, rootX: 0.05, stabY: 0.25,
                                      sRef: rootLine, cant: 0 });
    let worst = 0, ident = 0;
    for (let i = 0; i < R.V.length; i++) {
      const s = R.V[i][0] - 0.05, t = R.V[i][1] - 0.25;
      const ex = 0.05 + s * cG - t * sG, ey = 0.25 + s * sG + t * cG;
      worst = Math.max(worst, Math.abs(Rc.V[i][0] - ex),
                       Math.abs(Rc.V[i][1] - ey), Math.abs(Rc.V[i][2] - R.V[i][2]));
      for (let k = 0; k < 3; k++) if (R0.V[i][k] !== R.V[i][k]) ident++;
    }
    if (worst > 1e-9) fail(`stab cant: not a rotation about the root (${worst.toExponential(2)})`);
    if (ident) fail(`stab cant 0: ${ident} coordinates differ from the flat lay`);
    console.log(`stab cant 0.6 rad: rotation residue ${worst.toExponential(2)}, cant 0 identical`);
  }
  for (const [name, h, sideSign] of [['right', R, 1], ['left', Lh, -1]]) {
    if (!h.V.every(p => p.every(Number.isFinite)))
      fail(`stab ${name}: not finite`);
    const dirs = new Map();
    for (const f of h.F) for (let i = 0; i < f.v.length; i++) {
      const a = f.v[i], b = f.v[(i + 1) % f.v.length];
      const k = a < b ? a + '_' + b : b + '_' + a;
      if (!dirs.has(k)) dirs.set(k, []);
      dirs.get(k).push(a < b ? 1 : -1);
    }
    let bad = 0;
    for (const [, d] of dirs)
      if (d.length !== 2 || d[0] + d[1] !== 0) bad++;
    if (bad) fail(`stab ${name}: ${bad} bad edges (open/incoherent)`);
    let xIn = 1e9, yDev = 0;
    for (const p of h.V) {
      xIn = Math.min(xIn, Math.abs(p[0]) * sideSign * Math.sign(p[0] || 1));
      yDev = Math.max(yDev, Math.abs(p[1] - 0.25));
    }
    // the SHEET stops at the root line; only the root's rounded rim may
    // bulge inboard, by its own radius — that is the part buried in the
    // fuselage side, the same way the fin's root rim buries in the deck
    for (const p of h.V)
      if (sideSign * p[0] < 0.05 - 0.05 / 2 - 1e-9)
        { fail(`stab ${name}: material inboard of the root rim`); break; }
    if (yDev > 0.05 / 2 + 1e-9)
      fail(`stab ${name}: thickness ${yDev * 2} over base`);
  }
  // exact mirror: the left's vertex set is the right's, x negated
  const key = p => [Math.round(-p[0] * 1e7), Math.round(p[1] * 1e7),
                    Math.round(p[2] * 1e7)].join('_');
  const rSet = new Set(R.V.map(p => [Math.round(p[0] * 1e7),
    Math.round(p[1] * 1e7), Math.round(p[2] * 1e7)].join('_')));
  let unmirrored = 0;
  for (const p of Lh.V) if (!rSet.has(key(p))) unmirrored++;
  if (unmirrored) fail(`stab: ${unmirrored} left verts without right mirror`);
  console.log(`stab (cub defaults, hinge cut): ${solid.V.length} v / ` +
    `${solid.F.length} q per side · mirrored, closed, root at x 0.05`);
}

// ---- 7: slider identity ----------------------------------------------------
{
  const a = FIN.buildFin2(FIN.finSpec(FIN.FIN_PARAMS));
  const b = FIN.buildFin2(FIN.finSpec({}));
  if (JSON.stringify(a.V) !== JSON.stringify(b.V) ||
      JSON.stringify(a.F) !== JSON.stringify(b.F))
    fail('finSpec({}) is not the identity');
}

// THE VERDICT CONTRACT (G67.1): this checker joins the battery, and the
// runner requires BOTH signals — the line and the exit code.
console.log('GATE FIN: ' + (anyFail ? 'FAIL' : 'PASS'));
process.exit(anyFail ? 1 : 0);
