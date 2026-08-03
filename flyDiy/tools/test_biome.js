// GATE BIOME — WORLD-GEN-PROC stage 2 invariants, all on data:
// surface-class distribution + classifier semantics, tree/surface
// consistency, species diversity + stand clustering, riparian strips
// hugging rivers, exclusion zones, determinism, classifier perf.
const { makeWorld } = require('./flight_core.js');

const W = makeWorld();
const S = W.SURFACE;
const checks = {};

// --- surface distribution over a 201x201 sweep ---
const cnt = {};
{
  for (let j = 0; j <= 200; j++) for (let i = 0; i <= 200; i++) {
    const s = W.surface(-4500 + 45 * i, -4500 + 45 * j);
    cnt[s] = (cnt[s] || 0) + 1;
  }
  const pct = k => (cnt[k] || 0) / 404.01;
  console.log(`surface %: GRASS=${pct(S.GRASS).toFixed(1)} FF=${pct(S.FOREST_FLOOR).toFixed(1)} WATER=${pct(S.WATER).toFixed(1)} ROCK=${pct(S.ROCK).toFixed(1)} SCREE=${pct(S.SCREE).toFixed(1)} SAND=${pct(S.SAND).toFixed(1)}`);
  checks['surface distribution'] =
    pct(S.GRASS) > 5 && pct(S.FOREST_FLOOR) > 5 && pct(S.FOREST_FLOOR) < 35 &&
    pct(S.WATER) > 30 && pct(S.WATER) < 60 && pct(S.ROCK) > 5 && pct(S.ROCK) < 25 &&
    pct(S.SAND) > 0.3 && pct(S.SAND) < 8 && pct(S.SCREE) > 0.1 && pct(S.SCREE) < 5 &&
    !cnt[S.PAVED] && !cnt[S.GRAVEL];
}

// --- classifier semantics (same slope estimator as the classifier) ---
{
  const slope = (x, z) => {
    const e = 8;
    return Math.hypot(W.terrainH(x + e, z) - W.terrainH(x - e, z),
                      W.terrainH(x, z + e) - W.terrainH(x, z - e)) / (2 * e);
  };
  let ok = true;
  for (let j = 0; j <= 100; j++) for (let i = 0; i <= 100; i++) {
    const x = -4500 + 90 * i, z = -4500 + 90 * j;
    const s = W.surface(x, z), h = W.terrainH(x, z);
    if (s === S.SCREE && !(slope(x, z) > 0.4)) ok = false;
    if (s === S.ROCK && !(h > 220 || slope(x, z) > 0.35)) ok = false;
    if (s === S.FOREST_FLOOR && !(h < 165)) ok = false;
    if (s === S.SAND && !(h < 2.5)) ok = false;
  }
  checks['classifier semantics'] = ok;
}

// --- trees: fields, surfaces, exclusions ---
{
  let fields = true, surf = true, wet = 0, corr = 0;
  const mix = [0, 0, 0, 0, 0];
  for (const t of W.trees) {
    if (!(Number.isInteger(t.sp) && t.sp >= 0 && t.sp <= 4 &&
          t.s >= 0.6 && t.s <= 1.8 && t.h >= 2 && t.h <= 165)) fields = false;
    else mix[t.sp]++;
    const sc = W.surface(t.x, t.z);
    if (sc !== S.GRASS && sc !== S.FOREST_FLOOR) surf = false;
    if (W.waterH(t.x, t.z) > t.h) wet++;
    if (Math.abs(t.z) < 60 && t.x < 150 && t.x > -3300) corr++;
  }
  checks['tree fields sane'] = fields;
  checks['trees on grass/forest only'] = surf;
  checks['no trees in water'] = wet === 0;
  checks['corridor tree-free'] = corr === 0;
  const share = mix.map(m => m / W.trees.length);
  console.log(`species mix: ${mix.join(',')} (${share.map(v => (v * 100).toFixed(0) + '%').join(',')})`);
  checks['species diversity'] = share.filter(v => v >= 0.03).length >= 4;
}

// --- stand clustering: close pairs share species well above random ---
{
  let same = 0, pairs = 0;
  for (let i = 0; i < W.trees.length; i += 3) {
    const a = W.trees[i];
    for (let k = i + 1; k < Math.min(W.trees.length, i + 80); k++) {
      const b = W.trees[k];
      if (Math.hypot(a.x - b.x, a.z - b.z) < 70) { pairs++; if (a.sp === b.sp) same++; }
    }
  }
  const frac = same / Math.max(1, pairs);
  console.log(`clustering: ${pairs} close pairs, ${(frac * 100).toFixed(0)}% same-species`);
  checks['stands cluster'] = pairs > 100 && frac > 0.38;
}

// --- riparian strips hug rivers: density near water vs GRASS background ---
{
  let near = 0, nearA = 0, gFar = 0, gFarA = 0;
  for (let j = 0; j <= 200; j++) for (let i = 0; i <= 200; i++) {
    const x = -4200 + 42 * i, z = -4200 + 42 * j;
    const h = W.terrainH(x, z);
    if (h < 2 || h > 120) continue;
    if (W.waterH(x, z) > h) continue;
    if (Math.abs(z) < 60 && x < 150 && x > -3300) continue;
    const d = W.hydro.distW(x, z);
    if (d < 45) nearA++;
    else if (d > 150 && d < 400 && W.surface(x, z) === S.GRASS) gFarA++;
  }
  for (const t of W.trees) {
    if (t.h > 120) continue;
    const d = W.hydro.distW(t.x, t.z);
    if (d < 45) near++;
    else if (d > 150 && d < 400 && W.surface(t.x, t.z) === S.GRASS) gFar++;
  }
  const ratio = (near / Math.max(1, nearA)) / Math.max(1e-9, gFar / Math.max(1, gFarA));
  console.log(`riparian: ${near}/${nearA} near vs ${gFar}/${gFarA} grass band — ratio ${ratio.toFixed(2)}`);
  checks['riparian hugs rivers'] = nearA > 200 && ratio > 2.5;
}

// --- determinism: surface field + trees identical across instances ---
{
  const A = makeWorld(999), Bw = makeWorld(999);
  let ok = A.trees.length === Bw.trees.length && A.trees.length > 0;
  for (let i = 0; i < A.trees.length && ok; i++) {
    const a = A.trees[i], b = Bw.trees[i];
    if (a.x !== b.x || a.z !== b.z || a.h !== b.h || a.s !== b.s || a.sp !== b.sp) ok = false;
  }
  for (let j = 0; j <= 40 && ok; j++) for (let i = 0; i <= 40; i++) {
    const x = -4500 + 225 * i, z = -4500 + 225 * j;
    if (A.surface(x, z) !== Bw.surface(x, z)) { ok = false; break; }
  }
  checks['determinism'] = ok;
}

// --- perf: classifier stays cheap (renderer bakes ~100k calls at load) ---
{
  let s = 1, acc = 0;
  const t0 = Date.now();
  for (let i = 0; i < 1e5; i++) {
    s = (s * 1664525 + 1013904223) >>> 0; const x = (s / 4294967296 - 0.5) * 9000;
    s = (s * 1664525 + 1013904223) >>> 0; const z = (s / 4294967296 - 0.5) * 9000;
    acc += W.surface(x, z);
  }
  const us = (Date.now() - t0) * 10 / 1000;
  console.log(`surface perf: ${us.toFixed(1)} us/call, checksum ${acc}`);
  checks['surface perf<5us'] = us < 5;
}

const failed = Object.keys(checks).filter(k => !checks[k]);
console.log(`biome: ${W.trees.length} trees | ${Object.keys(checks).length} checks, ${failed.length} failed`);
for (const f of failed) console.log(`  FAIL: ${f}`);
const pass = failed.length === 0;
console.log(pass ? 'GATE BIOME: PASS' : 'GATE BIOME: FAIL');
process.exitCode = pass ? 0 : 1;
