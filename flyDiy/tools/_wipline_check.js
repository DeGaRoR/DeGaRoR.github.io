#!/usr/bin/env node
// GATE WIPLINE (G451) — the Wipaire catalogue, drawn and flown.
//
//   node tools/_wipline_check.js            -> "GATE WIPLINE: PASS|FAIL"
//   node tools/_wipline_check.js --show     -> every preset's numbers
//
// WHAT IT ASSERTS:
//   CATALOGUE  every FLOAT_PRESETS row builds a hull whose volume to the deck
//              is the row's maximum flotation within 1.5 % (measured rows) /
//              4 % (rows marked est), whose length, width and OVERALL height
//              (the bow's: hull H + the sheer) ARE the row's, with a fineness
//              inside [-0.7, 1] and a finite mass;
//   DRAWN      FLOAT_GEN draws each preset's hull CLOSED (no open edge,
//              outward winding), with a volume that matches the physics loft
//              within 1 %, its protrusions closed, a water rudder blade of the
//              hull's own area (within 2 %) whose foot hangs wrDepth under
//              the stern keel, and a paddle that lies on the INBOARD flank
//              of the forebody under the gunwale;
//   FIXTURE    the user's Cessna 172 on Wipline 2350s (tools/fixtures/
//              build_v10_c172_wipline2350_2026-09-20.json, the joined spec):
//              the frame builds two floats from the spec's own Wipline
//              record (preset, L, mass), settles on the sea carrying its
//              weight (+-3 %) with the step keels 0.15-0.45 m under and
//              0.5-10 deg nose-up, level in roll, finite.
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname;
const C = require(path.join(T, 'flight_core.js'));
const H = C.HYDRO;
const FG = require(path.join(T, '_float_gen.js'));
const SHOW = process.argv.includes('--show');
let fails = 0;
const verdict = (ok, line) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + line); };
const f = (v, n = 3) => (typeof v === 'number' && Number.isFinite(v)) ? v.toFixed(n) : String(v);

// ---- CATALOGUE ----------------------------------------------------------------
console.log('CATALOGUE');
{
  let ok = true, n = 0;
  for (const name of H.FLOAT_PRESET_NAMES) {
    const R = H.FLOAT_PRESETS[name], P = H.presetParams(name);
    const F = H.makeFloat(P);
    const vol = F.volDeck * P.rho, tol = R.est ? 0.04 : 0.015;
    const good = Math.abs(vol / R.flot - 1) < tol && Math.abs(P.L - R.L) < 1e-9 && Math.abs(P.B - R.B) < 1e-9 && Math.abs(P.H * (1 + (P.sheerK || 0)) - R.H) < 1e-9
              && P.fineK >= -0.7 && P.fineK <= 1 && Number.isFinite(P.mFloat) && P.mFloat > 5;
    if (SHOW || !good) console.log(`   ${name.padEnd(14)} L ${f(P.L, 2)} W ${f(P.B, 2)} H ${f(P.H * (1 + (P.sheerK || 0)), 2)} (${f(P.H, 2)} at the step + the sheer)  deadrise ${f(P.beta, 1)}/${f(P.betaA, 1)}  fineness ${f(P.fineK, 2)}  ` +
      `volume ${f(vol, 0)} vs flotation ${R.flot} (${f(100 * (vol / R.flot - 1), 1)} %)  mass ${f(P.mFloat, 0)} kg${R.est ? '  [est]' : ''}`);
    ok = ok && good; n++;
  }
  verdict(n >= 14, `${n} catalogue rows (bound 14: the Wipline line 1450 to 13000)`);
  verdict(ok, `every row lands on its four catalogue numbers (length, width, height, flotation) with a fineness inside [-0.7, 1]`);
}

// ---- DRAWN ----------------------------------------------------------------------
console.log('\nDRAWN');
{
  let closed = true, volOk = true, protOk = true, rudOk = true, padOk = true;
  for (const name of ['Wipline 1450', 'Wipline 2350', 'Wipline 3450', 'Wipline 8750', 'Wipline 13000']) {
    const P = H.presetParams(name);
    const F = H.makeFloat(P);
    const o = FG.build(P, { HY: H, paddle: -1 });
    const s = o.stats;
    const pr = FG.meshStats(o.protrusions);
    const rud = o.rudder;
    const bladeArea = rud.span * rud.depth * 0.92;
    const sT = H.sectionOf(P, P.L - P.xs - 0.02);
    // the blade's foot: its lowest vertex against the stern keel
    let yLo = Infinity; for (let i = 1; i < rud.blade.pos.length; i += 3) yLo = Math.min(yLo, rud.blade.pos[i]);
    const foot = sT.yk - yLo;
    // the paddle: every vertex of its shaft on the -z (inboard) side, under the deck, over the forebody
    let padIn = true, xMin = Infinity, xMax = -Infinity;
    for (let i = 0; i < o.paddle.shaft.pos.length; i += 3) { if (o.paddle.shaft.pos[i + 2] > -0.01) padIn = false; xMin = Math.min(xMin, o.paddle.shaft.pos[i]); xMax = Math.max(xMax, o.paddle.shaft.pos[i]); }
    const line = `   ${name.padEnd(14)} hull ${s.tris} tris ${s.open === 0 ? 'closed' : 'OPEN ' + s.open}, drawn ${f(s.vol * 1000, 0)} vs physics ${f(F.volDeck * 1000, 0)} kg; ` +
      `protrusions ${pr.open === 0 && pr.vol > 0 ? 'closed' : 'OPEN'}; blade ${f(rud.span, 2)} x ${f(rud.depth, 2)} = ${f(bladeArea, 3)} m2 (hull ${f(P.wrArea, 3)}), foot ${f(foot, 2)} under the stern keel (wrDepth ${f(P.wrDepth, 2)}); ` +
      `paddle x ${f(xMin, 2)}..${f(xMax, 2)} (bow ${f(-P.xs, 2)}) ${padIn ? 'inboard' : 'NOT inboard'}`;
    if (SHOW) console.log(line);
    closed = closed && s.open === 0 && s.vol > 0;
    volOk = volOk && Math.abs(s.vol / F.volDeck - 1) < 0.01;
    protOk = protOk && pr.open === 0 && pr.vol > 0;
    rudOk = rudOk && Math.abs(bladeArea / P.wrArea - 1) < 0.02 && Math.abs(foot - P.wrDepth) < 0.03 * P.scale + 0.005;
    padOk = padOk && padIn && xMin > -P.xs && xMax < 0;
    if (!(closed && volOk && protOk && rudOk && padOk)) console.log(line);
  }
  verdict(closed, `the drawn hull is closed and wound outward on every preset`);
  verdict(volOk, `the drawn hull's volume matches the physics loft within 1 %`);
  verdict(protOk, `the keel bar, the sister keelsons and the chine straps are closed strips`);
  verdict(rudOk, `the water rudder blade is the hull's own area, its foot wrDepth under the stern keel`);
  verdict(padOk, `the paddle lies along the inboard flank of the forebody`);
}

// ---- FIXTURE ----------------------------------------------------------------------
console.log('\nFIXTURE (the Cessna 172 on Wipline 2350s, joined)');
{
  const FIX = path.join(T, 'fixtures', 'build_v10_c172_wipline2350_2026-09-20.json');
  const spec = JSON.parse(fs.readFileSync(FIX, 'utf8')).spec;
  const def = C.buildGen(C.genMigrateSpec(JSON.parse(JSON.stringify(spec))));
  const fl = def.parts.floats;
  let M = 0; for (const n of def.nodes) M += n.m;
  const W = M * 9.81;
  verdict(fl && fl.length === 2 && fl[0].P.preset === 'Wipline 2350' && Math.abs(fl[0].P.L - 5.97) < 0.01 && Math.abs(fl[0].P.mFloat - 55.2) < 0.5,
    `the frame flies the spec's own Wipline record: ${fl && fl[0].P.preset}, L ${f(fl && fl[0].P.L, 2)} m, ${f(fl && fl[0].P.mFloat, 1)} kg a hull (gross ${f(M, 0)} kg)`);
  const world = C.makeWorld();
  const X0 = 0, Z0 = 1600, h = world.waterH(X0, Z0);
  const sim = C.makeSim(def, world); sim.reset(0);
  { const p = sim.p, v = sim.v, iK = def.refs.mains[0];
    const dx = X0 - p[iK * 3], dz = Z0 - p[iK * 3 + 2], dy = (h + 0.3) - p[iK * 3 + 1];
    for (let i = 0; i < sim.n; i++) { p[i * 3] += dx; p[i * 3 + 1] += dy; p[i * 3 + 2] += dz; v[i * 3] = v[i * 3 + 1] = v[i * 3 + 2] = 0; } }
  sim.ctl.thr = 0;
  let ok = true, Fy = 0, dr = 0, tr = 0, rl = 0, n = 0;
  for (let s = 0; s < 600; s++) {
    sim.step(1 / 60);
    const [xA, yU] = sim.axes();
    const trim = Math.asin(Math.max(-1, Math.min(1, -xA[1]))) * 180 / Math.PI;
    const roll = Math.asin(Math.max(-1, Math.min(1, yU[2]))) * 180 / Math.PI;
    const flo = sim.hydro.floats;
    const fy = flo.reduce((a, x) => a + x.out.F[1], 0) / W;
    const draft = flo.map(x => x.h - x.out.W[x.F.edge.K][1]);
    if (!Number.isFinite(fy) || !Number.isFinite(trim)) { ok = false; break; }
    if (s >= 480) { Fy += fy; dr += 0.5 * (draft[0] + draft[1]); tr += trim; rl += Math.abs(roll); n++; }
  }
  Fy /= n; dr /= n; tr /= n; rl /= n;
  console.log(`   at rest: L/W ${f(Fy)}, draft at the step ${f(dr)} m, trim ${f(tr, 2)} deg, roll ${f(rl, 2)} deg`);
  verdict(ok, `the settle stays finite`);
  verdict(Math.abs(Fy - 1) < 0.03, `the water carries the 172: L/W ${f(Fy)} (bound +-3 %)`);
  verdict(dr > 0.15 && dr < 0.45, `draft at the step ${f(dr)} m (bound 0.15-0.45)`);
  verdict(tr > 0.5 && tr < 10, `trim ${f(tr, 2)} deg nose-up at rest (bound 0.5-10)`);
  verdict(rl < 1, `level in roll (${f(rl, 2)} deg)`);
}

console.log(`\nGATE WIPLINE: ${fails ? 'FAIL (' + fails + ')' : 'PASS'}`);
process.exit(fails ? 1 : 0);
