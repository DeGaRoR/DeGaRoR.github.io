#!/usr/bin/env node
// _micro_check.js - GATE MICRO (DIRT-STRIP, 2026-11-09): THE BUSH STRIP'S MICRO-HEIGHT (src/core/26b_strip_micro.js and
// the `micro` modifier 27_premises composes from a runway record's `micro`).
//
//   1 OFF IS OFF: Jolene as shipped composes no micro modifier and publishes nothing; a strip given `micro: { chaos: 0 }`
//     composes the same ground, bit for bit (Object.is), at 3000 points on and around it.
//   2 THE FIELD: deterministic; exactly 0 outside the box, at the ends and on the last half metre inside the edges; under
//     its declared ceiling everywhere sampled; the roughness's standard deviation inside ISO 8608's class for its chaos
//     (C 0.4: 0.5-2 cm, E 0.8: 2.5-7 cm); potholes only inside the edge taper, more of them in the wheel lanes.
//   3 THE WORLD CARRIES IT (WYSIWYG's one source): Jolene with strip 12 (w7) at chaos 0.8 - terrainH there minus the
//     shipped terrainH is STRIP_MICRO.at to the raster's lattice (1.5 cm, the bilinear 0.25 m cell on a 1 m octave),
//     the premises' analytic path to 1e-9; nothing moves off the strip's box.
//   4 THE CEILING: the premises' hMaxRect over 400 small rectangles on the bumpy strip is >= every terrainH sampled in
//     them (the solver's ground skip stays exact).
//   5 PUDDLES: none with `puddles` 0 or a dry soil; with puddles 1 and wet 0.9 on a flat strip some, each no deeper than
//     its hole; none on a 5 % strip (water runs off).
//   6 THE GEAR RIDES IT: the user's Cub taxied at ~10 m/s down a straight strip (the flat field + the field), chaos
//     0 (the flat), 0.4, 0.8, 1.0: upright, undamaged, no node under the ground; the CG's vertical acceleration grows with
//     chaos (the bumps are felt) and the flat run feels none.
//
// node tools/_micro_check.js [--verbose]        -> GATE MICRO: PASS|FAIL
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const C = require(path.join(T, 'flight_core.js'));
const SM = C.STRIP_MICRO;
const VERB = process.argv.includes('--verbose');
let fails = 0;
const verdict = (ok, line) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + line); };
const rng = (s => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; })(12345);
if (!SM) { console.log('FAIL STRIP_MICRO is not exported'); console.log('GATE MICRO: FAIL'); process.exit(1); }

// ---- 1. OFF IS OFF -------------------------------------------------------------------------------------------------
const IN = require('./island_node.js');
const FIX = JSON.parse(fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8'));
// THE SHIPPED RECORD IS BUMPY WHERE THE PILOT VETTED IT (DIRT-STRIP chaos-on: w3 0.20, w8 0.40, the user's 9 Nov; every other
// strip flat, the mine strip above all): checked here, then every strip's micro taken out (FIX0) - the sections below judge
// the field on w7 against the bare island, as before
const world = J => IN.islandWorld('jolene', { premises: JSON.stringify(J) });
{
  const VET = { w3: 0.2, w8: 0.4 };
  const recs = FIX.layers.runways.filter(r => r.micro).map(r => r.id + ':' + r.micro.chaos).sort().join(', ');
  world(FIX); const pub = [...SM.live.values()].flat().map(s => s.id).sort().join(', ');
  const want = Object.keys(VET).sort().map(k => k + ':' + VET[k]).join(', ');
  verdict(recs === want && pub === Object.keys(VET).sort().join(', '), `Jolene as shipped is bumpy on the Pilot-vetted strips only: ${recs || 'none'} in the record (want ${want}), ${pub || 'none'} published; the mine strip and the rest flat`);
}
const FIX0 = JSON.parse(JSON.stringify(FIX)); for (const r of FIX0.layers.runways) delete r.micro;
const withMicro = (id, micro) => { const J = JSON.parse(JSON.stringify(FIX0)); const r = J.layers.runways.find(q => q.id === id); r.micro = micro; return J; };
const W0 = world(FIX0);
const A7 = W0.aerodromes.find(a => a.id === 'w7');
const live0 = SM.live.size;
verdict(live0 === 0, `Jolene with every strip's micro taken out publishes none (${live0})`);
const pts = [];
{ const d = [Math.cos(A7.hdg), Math.sin(A7.hdg)], n = [-d[1], d[0]];
  for (let i = 0; i < 3000; i++) { const u = (rng() - 0.5) * (A7.len + 60), v = (rng() - 0.5) * (A7.wid + 40); pts.push([A7.x + d[0] * u + n[0] * v, A7.z + d[1] * u + n[1] * v, u, v]); } }
const H0 = pts.map(p => W0.terrainH(p[0], p[1]));
{
  const Wz = world(withMicro('w7', { chaos: 0, crown: 3, rut: 10 }));
  let diff = 0; pts.forEach((p, i) => { if (!Object.is(Wz.terrainH(p[0], p[1]), H0[i])) diff++; });
  verdict(diff === 0 && SM.live.size === 0, `chaos 0 is off whatever the other knobs say: ${diff} of ${pts.length} points moved, ${SM.live.size} published`);
}

// ---- 2. THE FIELD --------------------------------------------------------------------------------------------------
{
  const S = { c: [100, 50], hdg: 0.7, len: 400, wid: 18 };
  const f8 = SM.field(S, { chaos: 0.8, seed: 3 }, 0), f8b = SM.field(S, { chaos: 0.8, seed: 3 }, 0);
  let det = 0, out = 0, edge = 0, over = 0, nIn = 0;
  for (let i = 0; i < 20000; i++) {
    const u = -20 + rng() * 440, v = (rng() - 0.5) * 30, h = f8.atUV(u, v);
    if (!Object.is(h, f8b.atUV(u, v))) det++;
    const inside = u > 0 && u < S.len && Math.abs(v) < S.wid / 2;
    if (!inside && h !== 0) out++;
    if (inside && S.wid / 2 - Math.abs(v) < 0.5 && Math.abs(h - SM.resolve({ chaos: 0.8 }).crown / 100 * (S.wid * S.wid / 4 - v * v) / S.wid * Math.min(1, 1)) > 0.02) edge++;
    if (h > f8.bound) over++;
    if (inside) nIn++;
  }
  verdict(det === 0, `deterministic: two fields of one record agree bit for bit (${det} differ)`);
  verdict(out === 0, `0 outside the strip's box (${out} of the outside points not 0)`);
  verdict(edge === 0, `on the last half metre inside an edge only the crown (0 at the edge itself): ${edge} points carry bumps`);
  verdict(over === 0, `never over its ceiling ${f8.bound.toFixed(3)} m (${over} over, ${nIn} inside)`);
  const sd = c => { const f = SM.field(S, { chaos: c, crown: 0, rut: 0, holes: 0, hazards: 0, swell: 0, lumps: 0, ruts: 0, seed: 1 }, 0); let a = 0, a2 = 0, k = 0;
    for (let i = 0; i < 20000; i++) { const h = f.atUV(10 + rng() * 380, (rng() - 0.5) * 8); a += h; a2 += h * h; k++; } return Math.sqrt(a2 / k - (a / k) ** 2); };
  const s4 = sd(0.4), s8 = sd(0.8);
  verdict(s4 > 0.005 && s4 < 0.02 && s8 > 0.025 && s8 < 0.07, `ISO 8608 roughness: chaos 0.4 sd ${(s4 * 100).toFixed(2)} cm (class C 0.5-2), 0.8 sd ${(s8 * 100).toFixed(2)} cm (class E 2.5-7)`);
  // the holes: inside the taper, and in the lanes more than not
  const fh = SM.field(S, { chaos: 0.8, seed: 5 }, 0); let nh = 0, lane = 0, badH = 0;
  for (let i = -2; i < S.len / SM.CELL + 2; i++) for (let m = 0; m < 2; m++) { const H = fh.hole(i, m); if (!H) continue; nh++;
    if (Math.abs(Math.abs(H[1]) - 1.098) < 1.0) lane++;
    if (S.wid / 2 - Math.abs(H[1]) - H[7] < SM.EDGE_IN[1] - 1e-9 || H[0] - H[8] < SM.END_IN - 1e-9 || H[0] + H[8] > S.len - SM.END_IN + 1e-9) badH++; }   // (H[7], H[8]: the stretched hole's reach across / along)
  const expect = fh.K.holes * S.len / 100;
  verdict(nh > expect * 0.5 && nh < expect * 1.6 && lane > nh * 0.5 && badH === 0, `potholes: ${nh} on 400 m (expected ~${expect.toFixed(0)}), ${lane} in the wheel lanes, ${badH} reaching the edge taper or the ends`);
}

// ---- 3. THE WORLD CARRIES IT ---------------------------------------------------------------------------------------
const MICRO8 = { chaos: 0.8, seed: 2 };
const W8 = world(withMicro('w7', MICRO8));
{
  const pub = SM.live.size;
  let worst = 0, offBox = 0, nOn = 0, maxDh = 0;
  pts.forEach((p, i) => {
    const h = W8.terrainH(p[0], p[1]), m = SM.at(p[0], p[1]), dh = h - H0[i];
    const inBox = Math.abs(p[2]) < A7.len / 2 && Math.abs(p[3]) < A7.wid / 2;
    if (!inBox && dh !== 0) offBox++;
    if (inBox) { nOn++; worst = Math.max(worst, Math.abs(dh - m - SM.stoneAt(p[0], p[1]))); maxDh = Math.max(maxDh, Math.abs(dh)); }
  });
  verdict(pub === 1, `the bumpy strip is published (${pub})`);
  verdict(worst < 0.015 && maxDh > 0.03, `terrainH on w7 = the shipped ground + STRIP_MICRO.at + the stones' bodies to ${(worst * 1000).toFixed(1)} mm (the raster's lattice; ${nOn} points, bumps to ${(maxDh * 100).toFixed(1)} cm)`);
  verdict(offBox === 0, `off the strip's box nothing moved (${offBox} points)`);
  const P8 = W8.premises && W8.premises.overlay, P0b = W0.premises && W0.premises.overlay;
  if (P8 && P0b && P8.terrainAt) {
    let w2 = 0; pts.forEach(p => { const a = P8.terrainAt(p[0], p[1]); const inBox = Math.abs(p[2]) < A7.len / 2 && Math.abs(p[3]) < A7.wid / 2; if (inBox) { const b = P0b.terrainAt(p[0], p[1]); w2 = Math.max(w2, Math.abs(a - b - SM.at(p[0], p[1]))); } });
    verdict(w2 < 1e-9, `the analytic path: the premises' terrainAt carries the field exactly (${w2.toExponential(1)} m)`);
  } else console.log('NOTE the world exposes no premises object here: the analytic check is skipped');
  // ---- 4. THE CEILING
  const GM = W8.groundMaxRect;
  if (GM) {
    let bad = 0;
    for (let i = 0; i < 400; i++) {
      const p = pts[(i * 7) % pts.length], s = 0.5 + rng() * 3;
      const H = GM(p[0] - s, p[1] - s, p[0] + s, p[1] + s);
      for (let k = 0; k < 12; k++) { const x = p[0] - s + rng() * 2 * s, z = p[1] - s + rng() * 2 * s; if (W8.terrainH(x, z) > H) { bad++; break; } }
    }
    verdict(bad === 0, `the ground's ceiling holds over the bumps: ${bad} of 400 rectangles have a point above groundMaxRect`);
  } else console.log('NOTE the island world declares no groundMaxRect: the ceiling check is skipped');
}

// ---- 3b. THE STONES' BODIES (the user, 9 Nov 21:55: "on the collision model ... any very simple volume that will collide
// nicely ... you shouldn't have like 10 centimeters difference") ------------------------------------------------------
{
  let S7 = null; for (const L of SM.live.values()) for (const s of L) if (s.id === 'w7') S7 = s;
  const R7 = SM.rocksOf('w7'), f7 = S7 && S7.f, hw = A7.wid / 2;
  const bad = R7.filter(r => r[2] < 0.069 || r[2] > 0.271 || Math.abs(r[1]) + r[2] > hw - 0.15 || (f7.ways.length && f7.waysAt(r[0], r[1])[1] > 0.3)).length;
  // the stones grow with chaos (the Pilot's bar, 10 Nov): x 0.35 at 0 .. 1 from 0.8 - on an 18 m strip at 0.2 none wider than 2 x 0.27 x 0.51
  { const sz = c => { const F = SM.field({ c: [0, 0], hdg: 0, len: 400, wid: 18 }, { chaos: c, seed: 3 }, 0); return F.bigRocks().reduce((m, r) => Math.max(m, r[2]), 0); };
    const k2 = 0.35 + 0.65 * 0.2 / 0.8, m2 = sz(0.2), m8 = sz(0.8);
    verdict(m2 > 0 && m2 <= 0.27 * k2 + 1e-9 && m8 > m2, `the stones grow with chaos: the widest ${(2 * m2 * 100).toFixed(0)} cm at 0.2 (cap ${(2 * 0.27 * k2 * 100).toFixed(0)}), ${(2 * m8 * 100).toFixed(0)} cm at 0.8`); }
  // the clear band (the Pilot's bar, 10 Nov): at any chaos, on a narrow and a wide strip, no stone reaching within BAND_V of the
  // centreline stands over BAND_H; outside it the full sizes stay
  { let inMax = 0, inN = 0, outMax = 0;
    for (const c of [0.2, 0.8, 1.0]) for (const wid of [9, 18]) for (const seed of [3, 7, 11]) {
      for (const r of SM.field({ c: [0, 0], hdg: 0, len: 600, wid }, { chaos: c, seed }, 0).bigRocks()) {
        const h = SM.STONE_H * r[2]; if (Math.abs(r[1]) - r[2] < SM.BAND_V) { inN++; inMax = Math.max(inMax, h); } else outMax = Math.max(outMax, h); } }
    verdict(inMax <= SM.BAND_H + 1e-9 && outMax > SM.BAND_H, `the clear band: ${inN} stones reach within ${SM.BAND_V} m of the centreline, the tallest ${(inMax * 100).toFixed(1)} cm proud (cap ${(SM.BAND_H * 100).toFixed(1)} cm); outside, up to ${(outMax * 100).toFixed(1)} cm`); }
  verdict(R7.length > 200 && bad === 0, `the stones on w7 at chaos 0.8: ${R7.length}, 14-54 cm across, whole inside the strip, none in a rut (${bad} not)`);
  // the wheels' ground carries each body EXACTLY (not the raster's 0.25 m lattice); the drawn ground carries none
  const d = [Math.cos(A7.hdg), Math.sin(A7.hdg)], n = [-d[1], d[0]];
  let hits = 0, top = 0, worstW = 0, worstD = 0, own = 0, ceil = 0;
  for (let i = 0; i < 20000; i++) {
    const u = (rng() - 0.5) * (A7.len - 10), v = (rng() - 0.5) * (A7.wid - 0.4), x = A7.x + d[0] * u + n[0] * v, z = A7.z + d[1] * u + n[1] * v;
    const st = SM.stoneAt(x, z); if (!(st > 0.02)) continue;
    hits++; top = Math.max(top, st);
    const h = W8.terrainH(x, z), g = W0.terrainH(x, z) + SM.at(x, z);
    worstW = Math.max(worstW, Math.abs(h - g - st)); worstD = Math.max(worstD, Math.abs(h - W8.stoneH(x, z) - g));
    if (W8.stoneH(x, z) !== st) own++;
    if (W8.groundMaxRect(x - 0.1, z - 0.1, x + 0.1, z + 0.1) < h) ceil++;
  }
  verdict(hits > 30 && worstW < 0.015 && top > 0.1, `the wheels feel them: terrainH = the ground + the stone's body to ${(worstW * 1000).toFixed(1)} mm at ${hits} points on stones (bodies to ${(top * 100).toFixed(1)} cm)`);
  verdict(worstD < 0.015 && own === 0, `the drawn ground (terrainH - stoneH) carries none of them: ${(worstD * 1000).toFixed(1)} mm (${own} where stoneH is not the field's)`);
  verdict(ceil === 0, `the ground's ceiling holds over the stones (${ceil} under)`);
}

// ---- 5. PUDDLES ----------------------------------------------------------------------------------------------------
{
  const S = { c: [0, 0], hdg: 0, len: 300, wid: 14 };
  const scan = (f, wet) => { let n = 0, bad = 0; for (let i = 0; i < 30000; i++) { const x = -150 + rng() * 300, z = (rng() - 0.5) * 14, w = f.puddleAt(x, z, wet); if (w > 0) n++; if (w > f.K.holeDepth / 100 + 1e-9 || w < 0) bad++; } return [n, bad]; };
  const f0 = SM.field(S, { chaos: 0.8, seed: 4 }, 0), f1 = SM.field(S, { chaos: 0.8, puddles: 1, seed: 4 }, 0), fs5 = SM.field(S, { chaos: 0.8, puddles: 1, seed: 4 }, 0.05);
  const a = scan(f0, 0.9), b = scan(f1, 0), c = scan(f1, 0.9), d = scan(fs5, 0.9);
  verdict(a[0] === 0 && b[0] === 0, `no puddle with puddles 0 (${a[0]}) or a dry soil (${b[0]})`);
  verdict(c[0] > 30 && c[1] === 0, `puddles 1, wet 0.9: water in ${c[0]} of 30000 points, never deeper than its hole (${c[1]})`);
  verdict(d[0] === 0, `none on a 5 % strip (${d[0]})`);
}

// ---- 6. THE GEAR RIDES IT ------------------------------------------------------------------------------------------
{
  const LB = require('./_load_build.js');
  const SPEC = LB.loadBuild('builds/cub_2026-09-20_corrected.json').spec;
  const hdgOf = sim => { const a = sim.axes()[0]; return Math.atan2(-a[2], -a[0]); };
  const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  function taxi(chaos, ground) {
    const def = C.buildGen(JSON.parse(JSON.stringify(SPEC)));
    const W = { f: null, terrainH(x, z) { return this.f ? this.f.at(x, z) + this.f.stoneAt(x, z) : 0; }, waterH: () => -1e9, surface: () => 6, trees: [], treesNear: (x, z, q) => { q.length = 0; return q; } };
    W.terrainH = W.terrainH.bind(W);
    const sim = C.makeSim(def, W);
    sim.reset(0); if (sim.stance) sim.stance();
    if (sim.setEngine && sim.eng) for (let i = 0; i < sim.eng.length; i++) sim.setEngine(i, { key: 'both', running: true });
    for (let f = 0; f < 180; f++) sim.step(1 / 60);
    const h0 = hdgOf(sim), cg0 = sim.cgPos(), ux = Math.cos(h0), uz = Math.sin(h0);
    // the strip ahead: from 5 m behind the CG, 400 m long, 14 m wide, along the heading
    if (ground) W.f = ground(cg0, ux, uz); else if (chaos > 0) W.f = C.STRIP_MICRO.field({ c: [cg0[0] + ux * 195, cg0[2] + uz * 195], hdg: h0, len: 400, wid: 14 }, { chaos, seed: 9 }, 0);
    let eP = 0, vy = sim.cgVel()[1], a2 = 0, aMax = 0, n = 0, under = 0, roll = 0, air = 0, dist = 0;
    for (let k = 0; k < 60 * 50; k++) {
      const e = wrap(hdgOf(sim) - h0), de = (e - eP) * 60; eP = e;
      const v = sim.cgVel(), V = Math.hypot(v[0], v[2]);
      Object.assign(sim.ctl, { thr: Math.max(0, Math.min(1, 0.25 + 0.4 * (10 - V))), brake: 0, brakeD: 0, dr: Math.max(-1, Math.min(1, 3 * e + 1.2 * de)), de: 0.3, da: 0 });
      sim.step(1 / 60);
      const cg = sim.cgPos(); dist = (cg[0] - cg0[0]) * ux + (cg[2] - cg0[2]) * uz;
      if (k > 240 && dist > 20 && dist < 360) {
        const vy1 = sim.cgVel()[1], ay = (vy1 - vy) * 60; a2 += ay * ay; aMax = Math.max(aMax, Math.abs(ay)); n++;
        if (sim.wheelsOnGround() === 0) air++;
        const ax = sim.axes(); roll = Math.max(roll, Math.abs(Math.asin(Math.max(-1, Math.min(1, ax[2][1])))));   // axes(): [aft, up, right]
      }
      vy = sim.cgVel()[1];
      for (let i = 0; i < sim.n; i++) { const y = sim.p[i * 3 + 1], g = W.terrainH(sim.p[i * 3], sim.p[i * 3 + 2]); if (y < g - 0.15) { under++; break; } }
      if (dist > 380) break;
    }
    const D = sim.damage ? sim.damage() : null;
    const broke = D ? D.breaks : 0, yields = D ? D.yields : 0;
    return { chaos, rms: Math.sqrt(a2 / Math.max(1, n)), aMax, air: air / 60, roll: roll * 57.3, under, broke, yields, dist };
  }
  const R = [0, 0.4, 0.8, 1.0].map(c => taxi(c));   // (not .map(taxi): its index is no ground)
  for (const r of R) console.log(`  taxi chaos ${r.chaos}: ${r.dist.toFixed(0)} m, vertical accel rms ${r.rms.toFixed(2)} m/s2 (peak ${r.aMax.toFixed(1)}), airborne ${r.air.toFixed(2)} s, roll ${r.roll.toFixed(1)} deg, under-ground frames ${r.under}, breaks ${r.broke}, yields ${r.yields}`);
  verdict(R.every(r => r.dist > 300 && r.under === 0 && !r.broke && r.roll < 25), `the Cub taxies 300 m+ over every chaos upright, undamaged, never under the ground`);
  // 6b THE STONES HIT (the user, 9 Nov 21:55): a row of 40 cm stones (R 0.2, 15 cm of body) across the way 40 m ahead, every
  // 45 cm from 2.5 m left to 2.5 m right - a wheel meets one: upright, undamaged, nothing under the ground, the jolt felt
  const rowOf = (cg0, ux, uz) => { const c = [cg0[0] + ux * 40, cg0[2] + uz * 40], SH = C.STRIP_MICRO.STONE_H, Rs = 0.2;
    return { at: () => 0, stoneAt(x, z) { const a = (x - c[0]) * ux + (z - c[1]) * uz, b = -(x - c[0]) * uz + (z - c[1]) * ux;
      if (Math.abs(a) > Rs) return 0; const k = Math.round(b / 0.45); if (Math.abs(k) > 5) return 0; const q2 = (a * a + (b - k * 0.45) * (b - k * 0.45)) / (Rs * Rs); return q2 < 1 ? SH * Rs * (1 - q2) : 0; } }; };
  const RS = taxi(0, rowOf);
  console.log(`  taxi through a row of stones: ${RS.dist.toFixed(0)} m, vertical accel peak ${RS.aMax.toFixed(1)} m/s2 (the flat's ${R[0].aMax.toFixed(1)}), roll ${RS.roll.toFixed(1)} deg, under ${RS.under}, breaks ${RS.broke}, yields ${RS.yields}`);
  verdict(RS.dist > 300 && RS.under === 0 && !RS.broke && RS.roll < 25 && RS.aMax > R[0].aMax + 1.5, `the Cub through a row of 40 cm stones: upright, undamaged, never under, the jolt felt (${RS.aMax.toFixed(1)} against ${R[0].aMax.toFixed(1)} m/s2 flat)`);
  verdict(R[0].rms < 0.3 && R[1].rms > R[0].rms * 2 && R[2].rms > R[1].rms && R[3].rms > R[2].rms, `the bumps are felt and grow with chaos: rms ${R.map(r => r.rms.toFixed(2)).join(' < ')} m/s2`);
}

// ---- 7. THE DRAWN RIBBON IS THE WHEELS' GROUND ---------------------------------------------------------------------
{
  const THREE = require('../vendor/three.min.js'), PAV = require('../src/viewer/pavement.js');
  const G8 = (x, z) => W8.terrainH(x, z) - W8.stoneH(x, z);   // the drawn ground: the wheels' less the stones' bodies (render_world's heightAt)
  const ribbon = (rmin, rminV) => {
    const g = PAV.stripGeometry(THREE, { len: A7.len, wid: A7.wid, hdg: A7.hdg, cx: A7.x, cz: A7.z, shoulderW: 3, cls: 'dirt', seed: 1, heightAt: G8, lift: 0.07, resU: 6, resV: 3, sinkD0: 0.8, refineMin: rmin, refineMinV: rminV });
    const pos = g.attributes.position.array, pav = g.attributes.aPav.array, nV = g.userData.pav.rows, nU = g.userData.pav.cols;
    const U = [], V = []; for (let i = 0; i < nU; i++) U.push(pav[(i * nV) * 4]); for (let j = 0; j < nV; j++) V.push(pav[j * 4 + 1]);
    const find = (A, x) => { let lo = 0, hi = A.length - 2; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (A[m] <= x) lo = m; else hi = m - 1; } return lo; };
    // its OWN sample (DIRT-STRIP 10 Nov): the shared rng moved with every section added before this one, and the 6000 points' worst
    // with it (17 -> 33 mm, the same ribbon)
    const errs = [], rng7 = (s => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; })(70707);
    for (let k = 0; k < 6000; k++) {
      const u = 6 + rng7() * (A7.len - 12), v = (rng7() - 0.5) * (A7.wid - 5);
      const i = find(U, u), j = find(V, v), fu = (u - U[i]) / (U[i + 1] - U[i]), fv = (v - V[j]) / (V[j + 1] - V[j]);
      const y = (a) => pos[a * 3 + 1], a = i * nV + j, b = a + nV;
      // the builder's split: (a, b, a + 1) and (a + 1, b, b + 1)
      const yi = fu + fv <= 1 ? y(a) + (y(b) - y(a)) * fu + (y(a + 1) - y(a)) * fv : y(b + 1) + (y(a + 1) - y(b + 1)) * (1 - fu) + (y(b) - y(b + 1)) * (1 - fv);
      const xw = (pos[a * 3] + (pos[b * 3] - pos[a * 3]) * fu + (pos[(a + 1) * 3] - pos[a * 3]) * fv), zw = (pos[a * 3 + 2] + (pos[b * 3 + 2] - pos[a * 3 + 2]) * fu + (pos[(a + 1) * 3 + 2] - pos[a * 3 + 2]) * fv);
      errs.push(Math.abs(yi - G8(xw, zw)));
    }
    errs.sort((p, q) => p - q);
    return { verts: nU * nV, p50: errs[errs.length >> 1], p99: errs[Math.floor(errs.length * 0.99)], max: errs[errs.length - 1] };
  };
  const r0 = ribbon(0), r1 = ribbon(C.STRIP_MICRO.REFINE_MIN, C.STRIP_MICRO.REFINE_MIN_V);
  console.log(`  the ribbon over w7 at chaos 0.8 (1020 x 9 m): rows as before ${r0.verts} vertices, drawn - wheels p50 ${(r0.p50 * 1000).toFixed(1)} p99 ${(r0.p99 * 1000).toFixed(1)} max ${(r0.max * 1000).toFixed(1)} mm; refined to ${C.STRIP_MICRO.REFINE_MIN} m ${r1.verts} vertices, p50 ${(r1.p50 * 1000).toFixed(1)} p99 ${(r1.p99 * 1000).toFixed(1)} max ${(r1.max * 1000).toFixed(1)} mm`);
  // the worst (10 Nov, 3 x 60 000 points on the 5 cm rows: 22, 29, 31 mm; the gate's 6000 read 17-33 by the sample) is a ruts' 10 cm
  // wall between two rows - 40 mm bounds it with room; p99 (8 mm, steady) is the ribbon's measure
  verdict(r1.p99 < 0.01 && r1.max < 0.04 && r1.verts < 300000, `the drawn ribbon is the wheels' ground: p99 ${(r1.p99 * 1000).toFixed(1)} mm (< 10), max ${(r1.max * 1000).toFixed(1)} mm (< 40: a rut's wall between two rows), ${r1.verts} vertices (< 300 k: the rut walls' 5 cm rows, DIRT-STRIP 9 Nov)`);
}

// ---- 8. THE HAZARDS: avoidable, never across --------------------------------------------------------------------------
{
  let bad = [], n = 0, counts = [];
  for (const c of [0.1, 0.3, 0.6, 0.9]) for (const [len, wid] of [[150, 12], [216, 8], [1020, 9], [543, 18]]) for (let seed = 0; seed < 6; seed++) {
    const f = SM.field({ c: [0, 0], hdg: 0.4, len, wid }, { chaos: c, seed }, 0), hw = wid / 2;
    counts.push(f.hazards.length);
    for (const H of f.hazards) {
      n++;
      const side = Math.sign(H[1]), inner = Math.abs(H[1]) - H[2], outer = Math.abs(H[1]) + H[2];
      if (inner < 0.3 - 1e-9 || outer > hw - 0.5 + 1e-9) bad.push(`len ${len} wid ${wid} chaos ${c}: |v| ${inner.toFixed(2)}..${outer.toFixed(2)}`);
      if (H[0] - H[2] * H[4] < SM.END_IN - 1e-9 || H[0] + H[2] * H[4] > len - SM.END_IN + 1e-9) bad.push(`len ${len}: u ${H[0].toFixed(1)} R ${H[2].toFixed(2)} past the ends`);
      // the clean line: on the other side, from the centreline to the edge taper, no hazard height at all
      for (let k = 0; k <= 20; k++) { const v = -side * (hw - 0.5) * k / 20; for (let du = -H[2]; du <= H[2]; du += 0.25) { const q = f.atUV(H[0] + du, v); const qn = SM.field({ c: [0, 0], hdg: 0.4, len, wid }, { chaos: c, seed, hazards: 0 }, 0).atUV(H[0] + du, v); if (q !== qn) { bad.push(`clean side moved at u ${(H[0] + du).toFixed(1)} v ${v.toFixed(2)}`); k = 99; break; } } }
    }
  }
  const byC = c => counts.slice({ 0.1: 0, 0.3: 24, 0.6: 48, 0.9: 72 }[c], { 0.1: 24, 0.3: 48, 0.6: 72, 0.9: 96 }[c]);
  verdict(bad.length === 0 && n > 50, `${n} hazards over 4 chaos x 4 strips x 6 seeds: inside 0.3 m of the centreline to 0.5 m of the edge on ONE side, clear of the ends, the other half untouched${bad.length ? ': ' + bad.slice(0, 3).join(' | ') : ''}`);
  verdict(byC(0.1).every(k => k === 0) && byC(0.3).every(k => k <= 1) && byC(0.9).some(k => k === 3), `how many: none at chaos 0.1, at most 1 at 0.3, 3 at 0.9 where they fit (${[0.1, 0.3, 0.6, 0.9].map(c => byC(c).join('')).join(' / ')})`);
  // a hazard hole holds water
  let wet = 0; for (let seed = 0; seed < 12; seed++) { const f = SM.field({ c: [0, 0], hdg: 0, len: 600, wid: 18 }, { chaos: 0.9, puddles: 1, holes: 0, seed }, 0); for (const H of f.hazards) if (H[3] < 0 && f.puddleAt(H[0] - 300, H[1], 0.9) > 0) wet++; }
  verdict(wet > 0, `a hazard's hole holds water when the soil is wet (${wet} of the holes tried, no potholes on)`);
}

// ---- 9. THE SHADER READS THE SAME FIELD --------------------------------------------------------------------------------
{
  const PAV = require('../src/viewer/pavement.js'), G = PAV.GLSL.common + PAV.GLSL.map;
  const need = ['0x27d4eb2du', '0x165667b1u', '0x2f6b4c13u', '0x2c1b3c6du', '0x297a2d39u', 'float(h >> 8u) / 16777216.0',
    'pmH(i, m, sd + 11) >= uMicro.y', 'float R = 0.5 + 0.6 * pmH(i, m, sd + 12), hu = (float(i) + 0.15 + 0.7 * pmH(i, m, sd + 13)) * 6.0;',
    'float lim = halfW - 2.5 - eV;', 'float ea = 1.0 + 1.2 * pmH(i, m, sd + 18), th = (pmH(i, m, sd + 19) - 0.5) * 1.05, cth = cos(th), sth = sin(th);', 'float eV = R * sqrt(ea * ea * sth * sth + cth * cth), eU = R * sqrt(ea * ea * cth * cth + sth * sth);',
    'float r = length(vec2(xy.x / ea, xy.y)) * (1.0 + 0.32 * (0.5 + 0.5 * pmNoise(dd / R * 1.7 + vec2(float(i) * 7.3, float(m) * 3.1), sd + 21)));', 'float aH = 1.0 + 0.6 * pmH(j, 0, sd + 37);', 'max(0.0, max(-wy.x, 0.0) - uMicro3.x * (1.0 - 0.35 * fillM))', 'pmH(i, m, sd + 14) < 0.667 ? (pmH(i, m, sd + 15) < 0.5 ? -1.0 : 1.0) * 1.098 + (pmH(i, m, sd + 16) - 0.5) * 2.0 * sig : (pmH(i, m, sd + 16) - 0.5) * 2.0 * lim;',
    'float D = uMicro.z * (0.5 + 0.5 * pmH(i, m, sd + 17));', 'float R = 1.5 + 1.5 * pmH(j, 0, sd + 32);', 'r += swA * (0.7 * pmNoise(vec2(u, v) / 25.0, sd + 201) + 0.3 * pmNoise(vec2(u, v) / 12.0, sd + 202));', 'float room = halfW - 0.5 - 0.3 - 2.0 * R;',
    'len * (0.05 + 0.9 * (float(j) + 0.2 + 0.6 * pmH(j, 0, sd + 31)) / uMicro2.y)', '(pmH(j, 0, sd + 35) < 0.5 ? -1.0 : 1.0) * (0.3 + R + max(0.0, room) * pmH(j, 0, sd + 36))',
    'uMicro2.z * (0.7 + 0.3 * pmH(j, 0, sd + 34)) * (pmH(j, 0, sd + 33) < 0.6 ? 1.0 : -1.0)', 'r += uMicro2.x * sqrt(lam) * pmNoise(vec2(u, v) / lam, sd + 101 + k);',
    'gMicH = pvHoles(u, -v, halfW, 2.0 * halfL, fillM);',
    // (RUTS FIRST, 9 Nov) the ways, the lumps and the stones
    'float vc = (pmH(0, 0, sd + 401) - 0.5) * 2.0 * room * 0.35;', 'W = vec4(0.78 + 0.10 * pmH(0, 1, sd + 401), 0.15, rutsD, 0.35);', 'W = vec4(0.68, 0.10, 0.35 * rutsD, 0.25);', 'W = vec4(0.0, 0.18, 0.22 * rutsD, 0.0);', 'W = vec4(0.0, 0.17, 0.35 * rutsD, 0.2);',
    'float c = c0 + a1 * pmNoise(vec2(u / 60.0, float(key)), sd + 411) + a2 * pmNoise(vec2(u / 15.0, float(key)), sd + 421);', 'float dep = W.z * (0.75 + 0.25 * pmNoise(vec2(u / 9.0, float(key + 3)), sd + 431));',
    'float x = v - c - float(s) * W.x + 0.03 * pmNoise(vec2(u / 0.7, float(key * 2 + s)), sd + 441), q = x / W.y, t = exp(-q * q * q * q);', 'float bq = (abs(x) - 1.7 * W.y - 0.06) / (0.6 * W.y + 0.05);',
    'r += uMicro3.y * (0.65 * pmNoise(vec2(u, v) / 3.5, sd + 301) + 0.35 * pmNoise(vec2(u, v) / 1.8, sd + 302));',
    'float p = big ? uMicro3.w * edge * edge : min(0.6, 0.1 + 0.9 * uMicro3.w) * (0.6 + 0.4 * edge);', 'float R = big ? 0.07 + 0.2 * e * e : 0.01 + 0.015 * e;', 'vec2 C = vec2((float(i) + 0.25 + 0.5 * a) * M, (float(j) + 0.25 + 0.5 * b) * M);'];
  const miss = need.filter(l => G.indexOf(l) < 0);
  const src = fs.readFileSync(path.join(T, '..', 'src', 'core', '26b_strip_micro.js'), 'utf8');
  const jsNeed = ['ih(i, m, seed + 11) >= pHole', 'const R = 0.5 + 0.6 * ih(i, m, seed + 12), u = (i + 0.15 + 0.7 * ih(i, m, seed + 13)) * CELL;', 'ih(i, m, seed + 14) < 0.667',
    'holeD * (0.5 + 0.5 * ih(i, m, seed + 17))', 'let R = 1.5 + 1.5 * ih(j, 0, seed + 32);', 'r += swA * (0.7 * vnoise(u / 25, v / 25, seed + 201) + 0.3 * vnoise(u / 12, v / 12, seed + 202));', 'const room = halfW - 0.5 - 0.3 - 2 * R;', 'len * (0.05 + 0.9 * (j + 0.2 + 0.6 * ih(j, 0, seed + 31)) / K.hazards)',
    'side * (0.3 + R + Math.max(0, room) * ih(j, 0, seed + 36))', 'const a = 1 + 1.2 * ih(i, m, seed + 18), th = (ih(i, m, seed + 19) - 0.5) * 1.05, cth = Math.cos(th), sth = Math.sin(th);', 'const lim = halfW - EDGE_IN[1] - eV;',
    'return Math.sqrt(x * x / (H[4] * H[4]) + y * y) / H[2] * (1 + 0.32 * (0.5 + 0.5 * vnoise(du / H[2] * 1.7 + i * 7.3, dv / H[2] * 1.7 + m * 3.1, seed + 21)));', 'const aH = 1 + 0.6 * ih(j, 0, seed + 37);', 'Math.max(0, w[3] - WAYS[w[2]][2] * (1 - 0.35 * fill))', 'K.hazardSize / 100 * (0.7 + 0.3 * ih(j, 0, seed + 34)) * (ih(j, 0, seed + 33) < 0.6 ? 1 : -1)', 'amp[k] * vnoise(u / OCT[k], v / OCT[k], seed + 101 + k)',
    'const vc = (ih(0, 0, seed + 401) - 0.5) * 2 * room * 0.35;', 'WAYS.push([0.78 + 0.10 * ih(0, 1, seed + 401), 0.15, rutsD, BERM, vc, 0.30, 0.08, 0]);', 'WAYS.push([0.68, 0.10, 0.35 * rutsD, 0.25, cc, 0.25, 0.06, 1]);', 'WAYS.push([0, 0.18, 0.22 * rutsD, 0, cc, 0.25, 0.06, 1]);', 'WAYS.push([0, 0.17, 0.35 * rutsD, 0.2, side * pv, 0.30, 0.10, 2]);',
    'const wayC = (W, u) => W[4] + W[5] * vnoise(u / 60, W[7], seed + 411) + W[6] * vnoise(u / 15, W[7], seed + 421);', 'const dep = W[2] * (0.75 + 0.25 * vnoise(u / 9, W[7] + 3, seed + 431));',
    'const x = v - c - s * W[0] + 0.03 * vnoise(u / 0.7, W[7] * 2 + s, seed + 441), q = x / W[1], t = Math.exp(-q * q * q * q);', 'const bq = (Math.abs(x) - 1.7 * W[1] - 0.06) / (0.6 * W[1] + 0.05);',
    'lA * (0.65 * vnoise(u / 3.5, v / 3.5, seed + 301) + 0.35 * vnoise(u / 1.8, v / 1.8, seed + 302))',
    'const p = big ? K.rocks * edge * edge : Math.min(0.6, 0.1 + 0.9 * K.rocks) * (0.6 + 0.4 * edge);', 'return [(i + 0.25 + 0.5 * a) * M, (j + 0.25 + 0.5 * b) * M, big ? 0.07 + 0.2 * e * e : 0.01 + 0.015 * e];'];
  const jmiss = jsNeed.filter(l => src.indexOf(l) < 0);
  verdict(!miss.length && !jmiss.length, `the shader's holes, hazards and relief are the field's, line for line (${need.length} GLSL lines, ${jsNeed.length} JS lines${miss.length ? '; GLSL MISSING ' + miss[0] : ''}${jmiss.length ? '; JS MISSING ' + jmiss[0] : ''}), on the field's v (the ribbon's flipped)`);
  // the ribbon's v is the field's flipped: a world point's pavement (u, v) against the field's toUV
  const g = PAV.stripGeometry(require('../vendor/three.min.js'), { len: A7.len, wid: A7.wid, hdg: A7.hdg, cx: A7.x, cz: A7.z, shoulderW: 3, cls: 'dirt', seed: 1, heightAt: () => 0, lift: 0, resU: 30, resV: 2 });
  const L = [...SM.live.values()].flat().find(s => s.id === 'w7');
  let flip = 0, nn = 0; const pos = g.attributes.position.array, pav = g.attributes.aPav.array;
  if (L) for (let i = 0; i < pav.length / 4; i += 7) { const q = L.toLocal(pos[i * 3], pos[i * 3 + 2]), uv = L.f.toUV(q[0], q[1]); nn++; if (Math.abs(uv[0] - pav[i * 4]) > 0.01 || Math.abs(uv[1] + pav[i * 4 + 1]) > 0.01) flip++; }
  verdict(L && nn > 20 && flip === 0, `the ribbon's (u, v) is the field's (u, -v) at ${nn} vertices of w7 (${flip} off by more than 1 cm)`);
}
console.log(fails ? 'GATE MICRO: FAIL' : 'GATE MICRO: PASS');
process.exitCode = fails ? 1 : 0;
