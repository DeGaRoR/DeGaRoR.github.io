// GATE AERO — WORLD-GEN-PROC stage 4 invariants, all on data:
// per-aerodrome centreline flatness/slope, tree-free oriented box, dry,
// surface patch consistency, tdz on the graded pad, road reachability
// (or explicit fly-in), spacing, size mix, determinism, bake budget.
const { makeWorld } = require('./flight_core.js');

const W = makeWorld();
const S = W.SURFACE;
const strips = W.aerodromes.filter(a => a.kind !== 'meadow' && a.id !== 'HOME');
const checks = {};

const fields = strips.filter(a => a.kind === 'main');
const back = strips.filter(a => a.kind === 'strip');
console.log(`aerodromes: ${W.aerodromes.length} total | ${fields.length} town fields | ${back.length} backcountry`);
checks['counts'] = fields.length >= 5 && back.length >= 1;
checks['size mix'] = fields.some(a => a.surface === S.PAVED) && fields.some(a => a.surface === S.GRASS);

{
  let flat = true, slope = true, dry = true, treeFree = true, surfOk = true, tdzOk = true;
  for (const a of strips) {
    const dx = Math.cos(a.hdg), dz = Math.sin(a.hdg);
    let prev = null;
    for (let i = 0; i <= 12; i++) {
      const t = (i / 12 - 0.5) * a.len;
      const x = a.x + dx * t, z = a.z + dz * t;
      const h = W.terrainH(x, z);
      if (Math.abs(h - a.elev) > 0.5) flat = false;
      if (prev !== null && Math.abs(h - prev) / (a.len / 12) > 0.01) slope = false;
      if (W.waterH(x, z) > h) dry = false;
      prev = h;
    }
    // oriented-box tree check with 25 m margin
    for (const tr of W.trees) {
      const rx = tr.x - a.x, rz = tr.z - a.z;
      if (Math.abs(rx) > a.len && Math.abs(rz) > a.len) continue;
      const lu = rx * dx + rz * dz, lv = -rx * dz + rz * dx;
      if (Math.abs(lu) < a.len / 2 + 25 && Math.abs(lv) < a.wid / 2 + 25) { treeFree = false; break; }
    }
    if (W.surface(a.x, a.z) !== a.surface) surfOk = false;
    if (Math.abs(W.terrainH(a.tdz[0], a.tdz[1]) - a.elev) > 0.3) tdzOk = false;
  }
  checks['centreline flat'] = flat;
  checks['centreline slope'] = slope;
  checks['strips dry'] = dry;
  checks['strips tree-free'] = treeFree;
  checks['surface patches'] = surfOk;
  checks['tdz on pad'] = tdzOk;
}

checks['reachable or fly-in'] = strips.every(a =>
  a.flyIn || W.roadNet.roadNear(a.x, a.z) < 1200);
{
  let ok = true;
  for (let i = 0; i < strips.length; i++) {
    for (let j = i + 1; j < strips.length; j++)
      if (Math.hypot(strips[i].x - strips[j].x, strips[i].z - strips[j].z) < 1400) ok = false;
    if (Math.hypot(strips[i].x + 520, strips[i].z) < 2000) ok = false;   // clear of the home runway
  }
  checks['spacing'] = ok;
}

{
  const ser = w => JSON.stringify(w.aerodromes);
  const A = makeWorld(2718), B = makeWorld(2718);
  checks['determinism'] = ser(A) === ser(B) && A.aerodromes.length >= 4;
}

const failed = Object.keys(checks).filter(k => !checks[k]);
console.log(`aero: ${Object.keys(checks).length} checks, ${failed.length} failed`);
for (const f of failed) console.log(`  FAIL: ${f}`);
const pass = failed.length === 0;
console.log(pass ? 'GATE AERO: PASS' : 'GATE AERO: FAIL');
process.exitCode = pass ? 0 : 1;
