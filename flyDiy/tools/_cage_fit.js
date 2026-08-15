// CAGE2 FIT — measures buildCage2 against the three reference OBJs.
//
//   node tools/_cage_fit.js [--dir C:/Users/denis/Downloads] [--verbose]
//
// For each step 0/1/2: vertex-count match, max vertex deviation (nearest
// neighbour, both directions), face-set match (cycles up to rotation and
// reflection), and per-face material agreement. Exit 1 if any step has
// unmatched geometry beyond tolerance; material diffs are reported but only
// step 2's fail the run (step 1 of the reference carries known transitional
// material bleed on the boom that step 2 corrected).
'use strict';
const fs = require('fs');
const path = require('path');
const { CAGE_DEFAULT, CAGE_PARAMS, buildCage2, cageSpec } =
  require('./_cage_gen.js');

const argv = process.argv.slice(2);
const di = argv.indexOf('--dir');
const DIR = di >= 0 ? argv[di + 1] : 'C:/Users/denis/Downloads';
const VERBOSE = argv.includes('--verbose');
const TOL = 2e-4;          // vertex match tolerance (file has 6 decimals)

function parseObj(file) {
  const V = [], F = [];
  let mtl = '';
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (line.startsWith('v ')) {
      const p = line.trim().split(/\s+/);
      V.push([+p[1], +p[2], +p[3]]);
    } else if (line.startsWith('usemtl')) mtl = line.slice(7).trim();
    else if (line.startsWith('f ')) {
      const idx = line.trim().split(/\s+/).slice(1)
        .map(t => parseInt(t.split('/')[0], 10) - 1);
      F.push({ v: idx, m: mtl });
    }
  }
  return { V, F };
}

// canonical key for a quad cycle: min lexicographic rotation over both
// directions, on REFERENCE vertex ids
const cycKey = ids => {
  let best = null;
  for (const dir of [ids, ids.slice().reverse()])
    for (let r = 0; r < dir.length; r++) {
      const k = dir.slice(r).concat(dir.slice(0, r)).join('_');
      if (best === null || k < best) best = k;
    }
  return best;
};

let anyFail = false;

for (let step = 0; step < 3; step++) {
  const ref = parseObj(path.join(DIR, `templatePlaneProcedural_${step}_nocc.obj`));
  const gen = buildCage2(CAGE_DEFAULT, step);

  // ---- vertex matching ----------------------------------------------------
  // grid hash on reference verts
  const H = new Map();
  const gk = p => Math.round(p[0] * 500) + '_' + Math.round(p[1] * 500) + '_' +
                  Math.round(p[2] * 500);
  ref.V.forEach((p, i) => {
    const k = gk(p);
    (H.get(k) || H.set(k, []).get(k)).push(i);
  });
  const near = p => {
    let bi = -1, bd = 1e9;
    const c = [Math.round(p[0] * 500), Math.round(p[1] * 500), Math.round(p[2] * 500)];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++)
      for (let dz = -1; dz <= 1; dz++) {
        const l = H.get((c[0] + dx) + '_' + (c[1] + dy) + '_' + (c[2] + dz));
        if (!l) continue;
        for (const i of l) {
          const q = ref.V[i];
          const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
          if (d < bd) { bd = d; bi = i; }
        }
      }
    return { i: bi, d: bd };
  };

  const map = new Array(gen.V.length);
  let maxDev = 0, maxAt = null, unmatched = 0;
  const hit = new Set();
  gen.V.forEach((p, i) => {
    const { i: ri, d } = near(p);
    if (ri < 0 || d > TOL) {
      unmatched++;
      if (VERBOSE || unmatched <= 8)
        console.log(`  gen v${i} (${p.map(v => v.toFixed(4))}) no ref match` +
                    (ri >= 0 ? ` (nearest ${d.toFixed(5)})` : ''));
      map[i] = -1;
      return;
    }
    map[i] = ri; hit.add(ri);
    if (d > maxDev) { maxDev = d; maxAt = p; }
  });
  const missed = ref.V.map((p, i) => i).filter(i => !hit.has(i));

  // ---- face matching ------------------------------------------------------
  const refFaces = new Map();
  ref.F.forEach(f => refFaces.set(cycKey(f.v), f));
  let fOK = 0, fBad = 0, mBad = 0;
  const matDiff = new Map();
  for (const f of gen.F) {
    if (f.v.some(i => map[i] < 0)) { fBad++; continue; }
    const k = cycKey(f.v.map(i => map[i]));
    const rf = refFaces.get(k);
    if (!rf) {
      fBad++;
      if (VERBOSE || fBad <= 8)
        console.log(`  gen face not in ref: [${f.v.map(i =>
          '(' + gen.V[i].map(v => v.toFixed(3)) + ')').join(' ')}] ${f.m}`);
      continue;
    }
    refFaces.delete(k);
    if (rf.m !== f.m) {
      mBad++;
      const dk = f.m + ' -> ' + rf.m;
      matDiff.set(dk, (matDiff.get(dk) || 0) + 1);
      if (VERBOSE)
        console.log(`  mat diff: gen ${f.m} vs ref ${rf.m} at z~` +
          (f.v.reduce((s, i) => s + gen.V[i][2], 0) / 4).toFixed(3));
    } else fOK++;
  }

  console.log(`\n=== STEP ${step} vs templatePlaneProcedural_${step} ===`);
  console.log(`  verts: gen ${gen.V.length} / ref ${ref.V.length}` +
              `  unmatched gen ${unmatched}, unhit ref ${missed.length}` +
              `  maxDev ${maxDev.toFixed(6)}` +
              (maxAt ? ` at (${maxAt.map(v => v.toFixed(3))})` : ''));
  console.log(`  faces: gen ${gen.F.length} / ref ${ref.F.length}` +
              `  matched ${fOK}, geomBad ${fBad}, matDiff ${mBad}` +
              `  refLeftover ${refFaces.size}`);
  if (missed.length && (VERBOSE || missed.length <= 12))
    for (const i of missed.slice(0, VERBOSE ? 1e9 : 12))
      console.log(`  ref v${i + 1} unhit: (${ref.V[i].map(v => v.toFixed(4))})`);
  if (refFaces.size && (VERBOSE || refFaces.size <= 12)) {
    let n = 0;
    for (const [, rf] of refFaces) {
      if (++n > (VERBOSE ? 1e9 : 12)) break;
      console.log(`  ref face leftover (${rf.m}): [${rf.v.map(i =>
        '(' + ref.V[i].map(v => v.toFixed(3)) + ')').join(' ')}]`);
    }
  }
  for (const [k, n] of matDiff) console.log(`  mat: ${n} x ${k}`);

  const geomFail = unmatched > 0 || missed.length > 0 || fBad > 0 ||
                   refFaces.size > 0;
  if (geomFail || (step === 2 && mBad > 0)) anyFail = true;
}

// ---- slider-layer identity: cageSpec(defaults) must rebuild the fiche ------
{
  const S2 = cageSpec(CAGE_PARAMS);
  let worst = 0, worstAt = '';
  for (let step = 0; step < 3; step++) {
    const a = buildCage2(CAGE_DEFAULT, step), b = buildCage2(S2, step);
    if (a.V.length !== b.V.length) {
      console.log(`\ncageSpec identity: step ${step} vert count ` +
                  `${b.V.length} != ${a.V.length}`);
      anyFail = true; continue;
    }
    for (let i = 0; i < a.V.length; i++) {
      const d = Math.hypot(a.V[i][0] - b.V[i][0], a.V[i][1] - b.V[i][1],
                           a.V[i][2] - b.V[i][2]);
      if (d > worst) { worst = d; worstAt = `step ${step} v${i}`; }
    }
  }
  console.log(`\ncageSpec(CAGE_PARAMS) identity: maxDev ${worst.toFixed(6)}` +
              ` (${worstAt})`);
  if (worst > 1e-4) anyFail = true;
}

console.log(anyFail ? '\nFIT: FAIL' : '\nFIT: OK');
process.exit(anyFail ? 1 : 0);
