// GATE SETTLE — WORLD-GEN-PROC stage 3 invariants, all on data:
// settlement sanity + spacing + dry sites, road graph connectivity,
// bridges on water crossings, bounded cross-slope (grading works),
// pad clearance, buildings sane + tiled, tree clearance, determinism.
const { makeWorld } = require('./flight_core.js');

const W = makeWorld();
const RN = W.roadNet, SS = W.settlements;
const checks = {};

checks['settlements sane'] = SS.length >= 3 && SS.length <= 8 && SS.every(s =>
  s.pop > 0 && s.r >= 50 && typeof s.name === 'string' && s.name.length > 1 &&
  W.terrainH(s.x, s.z) > -0.5 && W.waterH(s.x, s.z) === -Infinity) &&
  new Set(SS.map(s => s.name)).size === SS.length;
{
  let ok = true;
  for (let i = 0; i < SS.length; i++) for (let j = i + 1; j < SS.length; j++)
    if (Math.hypot(SS[i].x - SS[j].x, SS[i].z - SS[j].z) < 2000) ok = false;
  checks['settlement spacing'] = ok;
}
checks['towns clear of circuit'] = SS.every(s =>
  s.kind === 'home' || !(Math.abs(s.z) < 400 && s.x < 400 && s.x > -3400));

let totalLen = 0;
for (const r of RN.roads) for (let i = 0; i + 1 < r.pts.length; i++)
  totalLen += Math.hypot(r.pts[i + 1][0] - r.pts[i][0], r.pts[i + 1][1] - r.pts[i][1]);
checks['roads exist'] = RN.roads.length >= 3 && totalLen > 5000;

// graph connectivity: pieces chain where an endpoint touches another piece's
// polyline; settlements attach to any piece within 300 m of their centre
{
  const n = RN.roads.length + SS.length;
  const par = Array.from({ length: n }, (_, i) => i);
  const find = a => { while (par[a] !== a) a = par[a] = par[par[a]]; return a; };
  const union = (a, b) => { par[find(a)] = find(b); };
  const segDist = (p, a, b) => {
    const vx = b[0] - a[0], vz = b[1] - a[1];
    const L2 = vx * vx + vz * vz || 1;
    let t = ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / L2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(p[0] - a[0] - t * vx, p[1] - a[1] - t * vz);
  };
  const polyDist = (p, r) => {
    let d = Infinity;
    for (let i = 0; i + 1 < r.pts.length; i++) d = Math.min(d, segDist(p, r.pts[i], r.pts[i + 1]));
    return d;
  };
  for (let i = 0; i < RN.roads.length; i++) for (let j = 0; j < RN.roads.length; j++) {
    if (i === j) continue;
    const ri = RN.roads[i];
    for (const ep of [ri.pts[0], ri.pts[ri.pts.length - 1]])
      if (polyDist(ep, RN.roads[j]) < 80) union(i, j);
  }
  for (let s = 0; s < SS.length; s++)
    for (let i = 0; i < RN.roads.length; i++)
      if (polyDist([SS[s].x, SS[s].z], RN.roads[i]) < 320) union(RN.roads.length + s, i);
  const root = find(RN.roads.length);
  checks['road graph connected'] = SS.every((_, s) => find(RN.roads.length + s) === root);
}

// bridges cross water
{
  let ok = true, count = 0;
  for (const r of RN.roads) {
    if (r.cls !== 'bridge') continue;
    count++;
    const [a, b] = r.pts;
    let wet = false;
    for (let t = 0; t <= 1.001; t += 0.1) {
      const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      if (W.waterH(x, z) > W.terrainH(x, z) || W.hydro.distW(x, z) < 60) wet = true;
    }
    if (!wet) ok = false;
  }
  console.log(`bridges: ${count}`);
  checks['bridges on water'] = ok;
}

// grading: bounded cross-height at dry road vertices
{
  let maxCross = 0;
  for (const r of RN.roads) {
    if (r.cls === 'bridge') continue;
    for (let i = 1; i + 1 < r.pts.length; i++) {
      const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1];
      let tx = -(bz - az), tz = bx - ax;
      const L = Math.hypot(tx, tz) || 1; tx /= L; tz /= L;
      const d = Math.abs(W.terrainH(ax + tx * 4, az + tz * 4) - W.terrainH(ax, az));
      if (d > maxCross) maxCross = d;
    }
  }
  console.log(`max road cross-height @4m: ${maxCross.toFixed(2)} m`);
  checks['cross-slope bounded'] = maxCross < 2.5;
}
checks['no road on pad'] = RN.roads.every(r =>
  r.pts.every(p => !(p[0] > -1180 && p[0] < 130 && Math.abs(p[1]) < 90)));

// buildings
{
  const BL = RN.buildings;
  checks['buildings sane'] = BL.length >= 20 && BL.every(b =>
    [b.x, b.z, b.w, b.l, b.hgt, b.rot].every(Number.isFinite) &&
    (b.kind === 'house' || b.kind === 'barn') &&
    SS.some(s => Math.hypot(b.x - s.x, b.z - s.z) < s.r * 1.1) &&
    !(W.waterH(b.x, b.z) > W.terrainH(b.x, b.z)) && RN.roadNear(b.x, b.z) >= 3);
  checks['buildings tiled'] = BL.every(b =>
    W.tile(Math.floor(b.x / W.TILE), Math.floor(b.z / W.TILE)).buildings.includes(b));
  checks['roads tiled'] = RN.roads.every(r =>
    W.tile(Math.floor(r.pts[0][0] / W.TILE), Math.floor(r.pts[0][1] / W.TILE)).roads.includes(r));
}

checks['trees clear of roads'] = W.trees.every(t => RN.roadNear(t.x, t.z) >= 10);

// determinism
{
  const ser = w => JSON.stringify([w.settlements, w.roadNet.roads.map(r => [r.pts, r.cls]), w.roadNet.buildings]);
  const A = makeWorld(31415), B = makeWorld(31415);
  checks['determinism'] = ser(A) === ser(B) && A.settlements.length > 0;
}
checks['bake budget'] = RN.bakeMs < 700;

const failed = Object.keys(checks).filter(k => !checks[k]);
console.log(`settle: ${SS.length} settlements | ${RN.roads.length} road pieces (${(totalLen / 1000).toFixed(1)} km) | ${RN.buildings.length} buildings | bake ${RN.bakeMs} ms | ${Object.keys(checks).length} checks, ${failed.length} failed`);
for (const f of failed) console.log(`  FAIL: ${f}`);
const pass = failed.length === 0;
console.log(pass ? 'GATE SETTLE: PASS' : 'GATE SETTLE: FAIL');
process.exitCode = pass ? 0 : 1;
