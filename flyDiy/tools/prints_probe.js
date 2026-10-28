#!/usr/bin/env node
// PRINTS PROBE (G3543, the user 26 Oct: "undo your lifts now, to the minimum where it remains visible") - how high a car's
// print must ride over heightAt so its core stays over EVERY drawn layer under it, in node, all over Jolene.
//
// A car stands on heightAt, tilted to it (render_premises tiltToGround: the gradient over +-0.12 m); its print is a flat
// board in that tilt, (W + 1.0) x (L + 1.2), its alpha ramp 20 % of each side (ss(min(u, 1 - u) / 0.2)). The drawn ground is
// tools/ground_drawn.js's drawnAt (the roads' ribbons, the paved polys, the strips, the premises' patch, the fine tiles - the
// one on top). For each car spot: NEED = the most the drawn ground stands over the print's plane inside its core (where its
// alpha is >= 0.5: u, v in [0.1, 0.9]). Two classes, as the page draws them (two meshes):
//   tr  the traffic: every ribbon road's two lanes (moveTraffic's offset, clamp(w / 4, 0.9, 1.6) right of travel), a spot
//       every 4 m, both ways;
//   st  the parked cars: every paved poly and lot zone of the record, a 3 m grid, the poly's yaw and across it.
//   node tools/prints_probe.js [--pick] [--json f]
// --pick prints `PICK st=<m> tr=<m>`: each class's p99.5 NEED + 0.03 (the log depth's hair), within [0.03, 0.25].
'use strict';
const fs = require('fs');
const path = require('path');
const T = __dirname;
const argv = process.argv.slice(2);
const GD = (() => { const a = process.argv; a.push('--none'); try { return require(path.join(T, 'ground_drawn.js')); } finally { a.pop(); } })();
const C = require(path.join(T, 'flight_core.js'));
const PG = C.PREMISES_GEN, W = GD.W, O = W.premises.overlay, hAt = W.terrainH, F = O.frame;
const CAR = { W: 1.8, L: 4.5 };
const PW = CAR.W + 1.0, PL = CAR.L + 1.2;
const CORE = [0.1, 0.3, 0.5, 0.7, 0.9];

function need(x, z, ry) {
  const e = 0.12, gy = hAt(x, z);
  const gx = (hAt(x + e, z) - hAt(x - e, z)) / (2 * e), gz = (hAt(x, z + e) - hAt(x, z - e)) / (2 * e);
  const c = Math.cos(ry), s = Math.sin(ry);
  let worst = -Infinity, seen = 0;
  for (const u of CORE) for (const v of CORE) {
    const lx = (u - 0.5) * PW, lz = (v - 0.5) * PL;
    const dx = lx * c + lz * s, dz = -lx * s + lz * c;
    const d = GD.drawnAt(x + dx, z + dz);
    if (!isFinite(d.y)) continue;
    seen++;
    worst = Math.max(worst, d.y - (gy + gx * dx + gz * dz));
  }
  return seen ? worst : null;
}

const R = { tr: [], st: [] };
for (const rd of O.roads || []) {
  if (rd.ribbon === false || !rd.pts || rd.pts.length < 2) continue;
  const pr = PG.polyRoad(rd.pts, rd.w), off = Math.max(0.9, Math.min(1.6, rd.w / 4));
  for (let sAt = 2; sAt < pr.length - 2; sAt += 4) for (const dir of [1, -1]) {
    const a = pr.at(sAt), tx = a.tg[0] * dir, tz = a.tg[1] * dir, rx = -tz, rz = tx;
    const w = F.toWorld(a.p[0] + rx * off, a.p[1] + rz * off), ry = Math.atan2(tx, tz) + (F.yaw || 0);
    const n = need(w[0], w[1], ry); if (n != null) R.tr.push(n);
  }
}
const polys = [];
for (const pp of O.pavePolys || []) if (pp.poly && pp.poly.length > 2) polys.push({ poly: pp.poly, yaw: pp.yaw || 0, what: 'pave:' + pp.id });
for (const z of O.zones || []) if (z && z.poly && z.poly.length > 2 && /lot|yard|park/.test(String(z.kind || z.type || z.use || ''))) polys.push({ poly: z.poly, yaw: z.yaw || 0, what: 'zone:' + z.id });
const inside = (P, x, z) => { let k = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) k = !k; } return k; };
for (const q of polys) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const p of q.poly) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
  for (let x = x0 + 1.5; x < x1; x += 3) for (let z = z0 + 1.5; z < z1; z += 3) {
    if (!inside(q.poly, x, z)) continue;
    const w = F.toWorld(x, z);
    for (const ry of [q.yaw + (F.yaw || 0), q.yaw + (F.yaw || 0) + Math.PI / 2]) { const n = need(w[0], w[1], ry); if (n != null) R.st.push(n); }
  }
}

const pct = (a, p) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const pick = a => !a.length ? 0.2 : Math.min(0.25, Math.max(0.03, Math.ceil((pct(a, 0.995) + 0.03) * 100) / 100));
const out = { polys: polys.length, roads: (O.roads || []).length };
console.log('PRINTS PROBE: the drawn ground over a car print\'s plane in its core (m), Jolene - ' + out.roads + ' roads, ' + out.polys + ' paved polys / lot zones');
for (const k of ['tr', 'st']) {
  const a = R[k];
  out[k] = { n: a.length, p50: pct(a, 0.5), p95: pct(a, 0.95), p99: pct(a, 0.99), p995: pct(a, 0.995), max: a.length ? Math.max(...a) : NaN, pick: pick(a) };
  for (const L of [0.05, 0.08, 0.1, 0.12, 0.15, 0.2]) out[k]['hidAt' + Math.round(L * 100)] = a.filter(n => n > L).length;
  const o = out[k];
  console.log(`  ${k}  n ${String(o.n).padStart(6)}  p50 ${o.p50.toFixed(3)}  p95 ${o.p95.toFixed(3)}  p99 ${o.p99.toFixed(3)}  p99.5 ${o.p995.toFixed(3)}  max ${o.max.toFixed(3)}  ` +
    `(part hidden at 0.08: ${o.hidAt8}, 0.12: ${o.hidAt12}, 0.2: ${o.hidAt20})  -> lift ${o.pick.toFixed(2)}`);
}
if (argv.includes('--pick')) console.log(`PICK st=${out.st.pick.toFixed(2)} tr=${out.tr.pick.toFixed(2)}`);
const jf = (() => { const i = argv.indexOf('--json'); return i >= 0 ? argv[i + 1] : null; })();
if (jf) fs.writeFileSync(jf, JSON.stringify(out, null, 1));
