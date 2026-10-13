#!/usr/bin/env node
// _wetfx_check.js - GATE WETFX (G2090, WATER-LOOK): the wet body's contacts the page draws its spray, wake, splash and
// bubbles from (32_hydro.js wetFx) are the physics' own numbers, and reading them changes nothing.
//
//   1. WRITE-ONLY: the stock Cub ditched at 80 km/h (and a 5 m/s pancake), stepped with wetFx read every frame, flies
//      the SAME bits as without the read - and as the base's core (`--base=<flight_core.js>`, e.g. `git show
//      origin/master:flyDiy/tools/flight_core.js > base_fc.js`), node positions FNV-hashed frame by frame.
//   2. DRY IS NOTHING: a flight that never reaches the water has no wet body and wetFx hands null.
//   3. THE RECORDS: the ditch's first wet frames carry a slam on a hull slice's bottom (the splash), tyres in contact
//      with drag (the plough), the wet groups' centroids at the waterline (within a metre), each slam peak handed once.
//   4. THE BUBBLES: a fabric Cub left 60 s in the water - its flooding slices' fill rises (the air the page lets go)
//      and the record's fill matches the slice's own.
//   5. THE WORKER'S PATH: sim_host's snapshot trims the records (simHostWet), sim_view carries an unread peak onto the
//      next snapshot's same group, sim_link hands it once (the source, run in a vm with the real files).
//
//   node tools/_wetfx_check.js [--base=<file>] [--csv=<file>]   -> "GATE WETFX: PASS|FAIL"
'use strict';
const path = require('path'), fs = require('fs');
const arg = k => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : null; };
let fails = 0;
const ok = (c, msg) => { console.log((c ? '  ok   ' : '  FAIL ') + msg); if (!c) fails++; };
const f = (x, d) => Number.isFinite(x) ? x.toFixed(d == null ? 2 : d) : String(x);
const fnv = a => { const b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); let h = 0x811c9dc5; for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 0x01000193) >>> 0; } return h; };

const C = require('./flight_core.js');
const R = C.HYDRO ? C.HYDRO.WFX_R : 18, HD = C.HYDRO ? C.HYDRO.WFX_HEAD : 5;

function ditch(core, V, sink, secs, read, rec) {
  const world = core.makeWorld(), sea = world.aerodromes.find(a => a.id === 'SEA');
  const def = core.buildGen(JSON.parse(JSON.stringify(core.GEN_DEFAULT))), sim = core.makeSim(def, world); sim.reset(0); core.placeAtAerodrome(sim, sea);
  const n = def.nodes.length, p = sim.p, v = sim.v, [xA] = sim.axes(), c0 = sim.cgPos(), wh = world.waterH(c0[0], c0[2]);
  let yMin = Infinity; for (let i = 0; i < n; i++) yMin = Math.min(yMin, p[i * 3 + 1] - def.nodes[i].r);
  const hl = Math.hypot(xA[0], xA[2]);
  for (let i = 0; i < n; i++) { p[i * 3 + 1] += wh + 0.3 - yMin; v[i * 3] = -V * xA[0] / hl; v[i * 3 + 1] = -sink; v[i * 3 + 2] = -V * xA[2] / hl; }
  sim.ctl.thr = 0;
  const hashes = []; let buf = null;
  for (let s = 0; s < secs * 60; s++) {
    sim.step(1 / 60);
    hashes.push(fnv(sim.p));
    if (read && sim.wetFx) { buf = sim.wetFx(buf) || buf; if (rec) rec(sim, buf, s, world); }
  }
  return { hashes, sim, world, def };
}
const recsOf = b => { const out = []; if (!b) return out; for (let i = 0; i < b[0]; i++) { const o = HD + i * R;
  out.push({ g: b[o], kind: b[o + 1], A: b[o + 2], c: [b[o + 3], b[o + 4], b[o + 5]], n: [b[o + 6], b[o + 7], b[o + 8]], u: [b[o + 9], b[o + 10], b[o + 11]],
    pd: b[o + 12], pk: b[o + 13], drag: b[o + 14], wetS: b[o + 15], f: b[o + 16], air: b[o + 17] }); } return out; };

// ---- 1. write-only --------------------------------------------------------------------------------------------
console.log('== 1. reading the contacts changes nothing ==');
for (const [name, V, sink, secs] of [['80 km/h ditch', 22, 1, 6], ['5 m/s pancake', 0.3, 5, 3]]) {
  const a = ditch(C, V, sink, secs, false), b = ditch(C, V, sink, secs, true);
  const same = a.hashes.length === b.hashes.length && a.hashes.every((h, i) => h === b.hashes[i]);
  ok(same, `${name}: ${secs} s stepped with wetFx read every frame - node positions FNV-identical to the run without (${a.hashes.length} frames)`);
  const baseF = arg('base');
  if (baseF) {
    const B = require(path.resolve(baseF)), c = ditch(B, V, sink, secs, false);
    const sameB = c.hashes.every((h, i) => h === a.hashes[i]);
    let first = -1; if (!sameB) first = c.hashes.findIndex((h, i) => h !== a.hashes[i]);
    ok(sameB, `${name}: the base's core (${path.basename(baseF)}) flies the same bits${sameB ? '' : ' - first differs at frame ' + first}`);
  }
}

// ---- 2. dry ---------------------------------------------------------------------------------------------------
console.log('\n== 2. dry is nothing ==');
{
  const world = C.makeWorld(), def = C.buildGen(JSON.parse(JSON.stringify(C.GEN_DEFAULT))), sim = C.makeSim(def, world); sim.reset(0);
  for (let s = 0; s < 120; s++) sim.step(1 / 60);
  ok(!sim.wetBody && sim.wetFx(null) === null, `the stock Cub 2 s on HOME's stand: no wet body built, wetFx hands null`);
}

// ---- 3. the ditch's records -------------------------------------------------------------------------------------
console.log('\n== 3. the 80 km/h ditch: the records ==');
const csv = arg('csv'), rows = csv ? ['t,g,kind,A,cx,cy,cz,ux,uy,uz,pd,pk,drag,wetS,f,water'] : null;
{
  let firstWet = -1, slamFirst = null, tyreDrag = 0, maxOff = 0, pkSeen = 0, pkTwice = 0, nMax = 0, pkMaxKPa = 0;
  const lastPk = new Map();
  ditch(C, 22, 1, 6, true, (sim, b, s, world) => {
    const rs = recsOf(b); nMax = Math.max(nMax, rs.length);
    if (!rs.length) return;
    if (firstWet < 0) firstWet = s;
    for (const r of rs) {
      const h = world.waterH(r.c[0], r.c[2]);
      if (rows) rows.push([((s + 1) / 60).toFixed(4), r.g, r.kind, r.A.toFixed(4), ...r.c.map(x => x.toFixed(3)), ...r.u.map(x => x.toFixed(2)), r.pd.toFixed(0), r.pk.toFixed(0), r.drag.toFixed(0), r.wetS.toFixed(3), r.f.toFixed(4), h.toFixed(3)].join(','));
      if (r.A > 0 && r.kind === 2) maxOff = Math.max(maxOff, Math.abs(r.c[1] - h));
      if (r.pk > 0) { pkSeen++; pkMaxKPa = Math.max(pkMaxKPa, r.pk / 1000); if (!slamFirst) slamFirst = { s, g: r.g, kind: r.kind, pk: r.pk, n: r.n }; }
      if (r.kind === 2 && r.drag > tyreDrag) tyreDrag = r.drag;
    }
    // a peak is handed once: an immediate second read hands none
    const again = recsOf(sim.wetFx(null)); for (const r of again) if (r.pk > 0) pkTwice++;
  });
  ok(firstWet >= 0, `the ditch reaches the water at frame ${firstWet} (${f((firstWet + 1) / 60, 2)} s); up to ${nMax} groups in contact`);
  ok(!!slamFirst && slamFirst.kind === 0 && slamFirst.n[1] < 0, `the first slam is a hull slice's (group ${slamFirst ? slamFirst.g : '-'}, ${slamFirst ? f(slamFirst.pk / 1000, 0) : '-'} kPa, its wet faces looking down n.y ${slamFirst ? f(slamFirst.n[1], 2) : '-'}); ${pkSeen} slam reads in all, peak ${f(pkMaxKPa, 0)} kPa`);
  ok(pkTwice === 0, `every slam peak handed once (a second read at once hands ${pkTwice})`);
  ok(tyreDrag > 100, `the tyres plough: the largest tyre drag ${f(tyreDrag, 0)} N`);
  ok(maxOff < 0.05, `the tyres' contact records sit at the water level (largest offset ${f(maxOff, 3)} m)`);
}
if (rows) { fs.writeFileSync(csv, rows.join('\n')); console.log('  (records: ' + csv + ', ' + (rows.length - 1) + ' rows)'); }

// ---- 4. the bubbles -------------------------------------------------------------------------------------------
console.log('\n== 4. a fabric Cub left in the water: the fill rises ==');
{
  let f10 = 0, f60 = 0, match = 0, checked = 0, slices = 0;
  const run = ditch(C, 22, 1, 60, true, (sim, b, s) => {
    const rs = recsOf(b), WB = sim.wetBody;
    if (s === 599 || s === 3599) {
      const sl = rs.filter(r => r.kind === 0 && r.air > 0);
      const m = sl.length ? sl.reduce((a, r) => a + r.f, 0) / sl.length : 0;
      if (s === 599) f10 = m; else { f60 = m; slices = sl.length; }
      for (const r of sl) { checked++; if (Math.abs(r.f - WB.slices[r.g].f) < 1e-6) match++; }
    }
  });
  ok(f60 > f10 && f10 > 0, `the hull slices' mean fill ${f(100 * f10, 1)} % at 10 s -> ${f(100 * f60, 1)} % at 60 s (${slices} slices in contact): the air goes`);
  ok(checked > 0 && match === checked, `the record's fill is the slice's own (${match} of ${checked})`);
}

// ---- 5. the worker's path ---------------------------------------------------------------------------------------
console.log('\n== 5. the worker\'s path: trimmed, carried, handed once ==');
{
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'sim_host.js'), 'utf8');
  const m = /let simHostWetBuf = null;\nfunction simHostWet\(sim\) \{[\s\S]*?\n\}\n/.exec(src);
  ok(!!m, 'sim_host.js carries simHostWet');
  if (m) {
    const vm = require('vm'), ctx = { HYDRO: C.HYDRO, Float32Array };
    vm.runInNewContext(m[0] + '\nthis.simHostWet = simHostWet;', ctx);
    const r1 = ditch(C, 22, 1, 1.2, false);
    const out = ctx.simHostWet(r1.sim);
    ok(out && out.length === HD + out[0] * R && out[0] > 0, `a wet sim's snapshot: ${out ? out[0] : 0} records, ${out ? out.length : 0} numbers (trimmed)`);
    const world = C.makeWorld(), dry = C.makeSim(C.buildGen(JSON.parse(JSON.stringify(C.GEN_DEFAULT))), world); dry.reset(0); dry.step(1 / 60);
    ok(ctx.simHostWet(dry) === null, 'a dry sim\'s snapshot carries nothing');
  }
  const SV = require('../src/viewer/sim_view.js');
  const mk = (gs, pks) => { const b = new Float32Array(HD + gs.length * R); b[0] = gs.length; gs.forEach((g, i) => { b[HD + i * R] = g; b[HD + i * R + 13] = pks[i]; }); return b; };
  const W1 = SV.simViewWetCarry(mk([3, 7], [9000, 0]), mk([7, 3, 4], [0, 2000, 0]));
  ok(W1[HD + 1 * R + 13] === 9000 && W1[HD + 13] === 0 && W1[HD + 2 * R + 13] === 0, 'sim_view.js: an unread peak (group 3, 9 kPa) carried onto the newer snapshot\'s same group over its 2 kPa; the others untouched');
  ok(/view\.wet = simViewWetCarry\(view\.wet, M\.wet \|\| null\)/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'sim_view.js'), 'utf8')), 'sim_view.js take() uses it (source)');
  const lsrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'sim_link.js'), 'utf8');
  ok(/def\('wetFx'/.test(lsrc) && /for \(const k of \[[^\]]*'wetFx'[^\]]*\]\) saved\[k\] = own\(k\)/.test(lsrc), 'sim_link.js hands the worker\'s records as sim.wetFx and restores the inline one at detach (source)');
}

console.log(fails ? `\nGATE WETFX: FAIL (${fails})` : '\nGATE WETFX: PASS');
process.exit(fails ? 1 : 0);
