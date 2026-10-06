#!/usr/bin/env node
// tour_real_report.js - TOUR-REAL (G2065-G2069): THE PAGE'S TOUR AGAINST THE NODE TOUR, LEG BY LEG.
//
// Reads a page run (tools/tour_real.js --out: legs.json, samples.json, stills/, cast/) and the node tour sampled the
// same way (tools/tour_real_node.js --out), and writes into --out:
//   table.md       per leg, the SAME measures computed from both tracks by one function (legMetrics): done, faults,
//                  the departure (heading turned on the ground, the largest excursion off the centreline, where the roll
//                  began, the lift-off), the U-turn's footprint on the strip, the final's start, the touchdown (past the
//                  threshold, off the centreline), the roll-out, the stop, the leg's sim time - and the deviation of the
//                  page's track from node's (each page point's distance to node's leg polyline, both ways; every
//                  stretch over 20 m named with its phase, place and time) - plus the page pilot's own verdicts
//   compare.json   all of it, machine-readable (the divergence list, the terrain check, the obstacle check)
//   map.png/.svg   the island, the strips, node's track (blue) and the page's (orange), the obstacles (grey: node's
//                  world; red: the page's that node's lacks, near either track), touchdowns and roll starts marked;
//                  map_<strip>.png - each visited strip close up (the U-turn, the roll, the touchdown, the stop)
//   stills_L<n>.jpg  a leg's stills in a strip: the chase row and the top-down row, moment and sim time on each
//   cast_L<n>_uturn.webp / cast_L<n>_landing.webp  the screencast cut to the U-turn (the leg's start to 4 s into the
//                  roll) and the landing (300 m out on the final to 2 s after the stop), the top-down blips dropped
//   node track vs the page's drawn ground: the page row's ground (y - agl, the page's terrainH) against node's
//                  W.terrainH at the same point (the terrain check) - "the drawn ground vs node's terrain"
//   node tools/tour_real_report.js --root D:/Dev/wt-tour --page <run dir> --node <node_tour.json> --out <dir>
//        [--cloud <ISLAND-TOUR's tour_cub.json.gz>] (its 0.5 Hz track drawn too, dotted) [--no-media]
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), { execFileSync } = require('child_process');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const ROOT = path.resolve(opt('root', path.join(__dirname, '..', '..')));
const PAGE = path.resolve(opt('page'));
const OUT = path.resolve(opt('out', PAGE));
fs.mkdirSync(OUT, { recursive: true });
const T = path.join(ROOT, 'flyDiy', 'tools');
const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const W = IN.islandWorld('jolene', { premises: fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8') });
const PL = JSON.parse(fs.readFileSync(path.join(PAGE, 'legs.json'), 'utf8'));
const PS = JSON.parse(fs.readFileSync(path.join(PAGE, 'samples.json'), 'utf8'));
const ND = JSON.parse(fs.readFileSync(path.resolve(opt('node')), 'utf8'));
const CLOUD = opt('cloud', null) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(path.resolve(opt('cloud')))).toString()) : null;
const A = id => W.aerodromes.find(a => a.id === id);
const r1 = v => (v == null || !isFinite(v) ? null : Math.round(v * 10) / 10);
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const frame = a => { const ux = Math.cos(a.hdg), uz = Math.sin(a.hdg); return { s: (x, z) => (x - a.x) * ux + (z - a.z) * uz, c: (x, z) => -(x - a.x) * uz + (z - a.z) * ux }; };
const axisErr = (nose, hdg) => Math.min(Math.abs(wrap(nose - hdg)), Math.abs(wrap(nose - hdg - Math.PI)));
// a row as an object, whichever the source (both write t, x, y, z, agl, phase, Vg, nose, onG, leg first)
const asRows = (cols, rows) => rows.map(r => { const o = {}; cols.forEach((k, i) => { o[k] = r[i]; }); return o; });
const pageRows = asRows(PS.cols, PS.rows), nodeRows = asRows(ND.cols, ND.rows);
const order = ND.order;
const GROUND_PRE = new Set(['DEPART', 'TAXI', 'LINEUP', 'STOP', 'HOLD']);

// ---- ONE MEASURE, BOTH TRACKS ---------------------------------------------------------------------------------------
function legMetrics(R, a, b) {
  if (!R.length) return null;
  const FA = frame(a), FB = frame(b), t0 = R[0].t;
  const m = { t: r1(R[R.length - 1].t - t0), faults: [] };
  let turned = 0, maxTurned = 0, prev = null, latMax = 0, roll = null, lift = null, uturnAt = null, fp = null;
  let fin = null, td = null, minFinalAgl = Infinity, gl = 0, off = 0, airborne = false, tdDir = 1;
  for (const p of R) {
    if (!roll) {
      if (GROUND_PRE.has(p.phase)) {
        if (prev !== null) { turned += wrap(p.nose - prev); maxTurned = Math.max(maxTurned, Math.abs(turned)); }
        prev = p.nose;
        const s = FA.s(p.x, p.z), c = FA.c(p.x, p.z);
        if (Math.abs(s) < a.len / 2 + 5) {
          latMax = Math.max(latMax, Math.abs(c));
          if (Math.abs(c) < a.wid / 2 + 15) { fp = fp || { s0: s, s1: s, c0: c, c1: c }; fp.s0 = Math.min(fp.s0, s); fp.s1 = Math.max(fp.s1, s); fp.c0 = Math.min(fp.c0, c); fp.c1 = Math.max(fp.c1, c); }
        }
        if (!uturnAt && maxTurned > Math.PI / 2) uturnAt = { x: p.x, z: p.z, s: r1(s), c: r1(c), t: r1(p.t - t0) };
      }
      if (p.phase === 'ROLL') roll = p;
    }
    if (roll && !lift && (p.phase === 'LIFTOFF' || p.phase === 'CLIMB')) lift = p;
    if (lift && p.agl > 15) airborne = true;
    if (roll && !airborne && p.phase === 'ROLL' && p.Vg > 5) {
      const e = axisErr(p.nose, a.hdg);
      if (e > 30 / 57.3) { gl++; if (!m.faults.includes('ground-loop (take-off)')) m.faults.push('ground-loop (take-off)'); }
      if (Math.abs(FA.c(p.x, p.z)) > a.wid / 2 || Math.abs(FA.s(p.x, p.z)) > a.len / 2 + 2) { off++; if (!m.faults.includes('off-strip (take-off)')) m.faults.push('off-strip (take-off)'); }
    }
    if (airborne && p.phase === 'FINAL') {
      const d = Math.hypot(p.x - b.x, p.z - b.z) - b.len / 2;
      if (!fin) fin = { d: r1(d), agl: r1(p.agl), t: r1(p.t - t0) };
      if (d > 40 && d < 1500) minFinalAgl = Math.min(minFinalAgl, p.agl);
    }
    if (airborne && !td && p.phase === 'ROLLOUT') { td = p; tdDir = Math.cos(wrap(Math.atan2(p.z - (prevXZ ? prevXZ[1] : p.z), p.x - (prevXZ ? prevXZ[0] : p.x)) - b.hdg)) >= 0 ? 1 : -1; }
    if (airborne && (p.phase === 'ROLLOUT' || p.phase === 'FLARE') && p.onG > 0 && p.Vg > 5) {
      const e = axisErr(p.nose, b.hdg);
      if (e > 30 / 57.3) { gl++; if (!m.faults.includes('ground-loop (landing)')) m.faults.push('ground-loop (landing)'); }
      if (Math.abs(FB.c(p.x, p.z)) > b.wid / 2 || Math.abs(FB.s(p.x, p.z)) > b.len / 2 + 2) { off++; if (!m.faults.includes('off-strip (landing)')) m.faults.push('off-strip (landing)'); }
    }
    var prevXZ = [p.x, p.z];
  }
  const last = R[R.length - 1];
  m.dep = { turned: r1(maxTurned * 57.3), uturn: maxTurned > 150 / 57.3, latMax: r1(latMax), uturnAt, footprint: fp ? { s: [r1(fp.s0), r1(fp.s1)], c: [r1(fp.c0), r1(fp.c1)] } : null,
    roll: roll ? { x: r1(roll.x), z: r1(roll.z), s: r1(FA.s(roll.x, roll.z)), c: r1(FA.c(roll.x, roll.z)), fromEnd: r1(Math.min(FA.s(roll.x, roll.z) + a.len / 2, a.len / 2 - FA.s(roll.x, roll.z))), t: r1(roll.t - t0) } : null,
    lift: lift && roll ? { x: r1(lift.x), z: r1(lift.z), dist: r1(Math.hypot(lift.x - roll.x, lift.z - roll.z)), t: r1(lift.t - t0) } : null };
  m.arr = { final: fin, minFinalAgl: isFinite(minFinalAgl) ? r1(minFinalAgl) : null,
    td: td ? { x: r1(td.x), z: r1(td.z), s: r1(FB.s(td.x, td.z)), c: r1(FB.c(td.x, td.z)), pastThr: r1(tdDir > 0 ? FB.s(td.x, td.z) + b.len / 2 : b.len / 2 - FB.s(td.x, td.z)), Vg: r1(td.Vg), t: r1(td.t - t0) } : null,
    stop: { x: r1(last.x), z: r1(last.z), s: r1(FB.s(last.x, last.z)), c: r1(FB.c(last.x, last.z)), phase: last.phase } };
  if (td) m.arr.run = r1(Math.hypot(last.x - td.x, last.z - td.z));
  m.stopped = last.phase === 'STOPPED';
  return m;
}
// the distance from a point to a polyline (and the nearest vertex's row)
function nearest(P, x, z) {
  let best = Infinity, bi = 0;
  for (let i = 0; i < P.length - 1; i++) {
    const ax = P[i].x, az = P[i].z, dx = P[i + 1].x - ax, dz = P[i + 1].z - az, L2 = dx * dx + dz * dz;
    const u = L2 > 1e-9 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)) : 0;
    const d = Math.hypot(x - ax - u * dx, z - az - u * dz);
    if (d < best) { best = d; bi = u < 0.5 ? i : i + 1; }
  }
  if (P.length === 1) best = Math.hypot(x - P[0].x, z - P[0].z);
  return { d: best, i: bi };
}
const pct = (a, q) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * q))]; };
const where = (x, z) => { const n = W.aerodromes.map(a => [a, Math.hypot(x - a.x, z - a.z) - a.len / 2]).sort((p, q) => p[1] - q[1])[0]; return n[1] < 0 ? 'on ' + n[0].id : r1(n[1]) + ' m from ' + n[0].id; };
function deviation(Pg, Nd) {
  if (!Pg.length || !Nd.length) return null;
  const d = Pg.map(p => nearest(Nd, p.x, p.z));
  const back = Nd.map(p => nearest(Pg, p.x, p.z).d);
  const runs = [];
  let cur = null;
  Pg.forEach((p, i) => {
    const di = d[i].d;
    if (di > 20) {
      if (!cur) cur = { i0: i, i1: i, max: di, at: i, phases: new Set() };
      cur.i1 = i; if (di > cur.max) { cur.max = di; cur.at = i; } cur.phases.add(p.phase);
    } else if (cur) { runs.push(cur); cur = null; }
  });
  if (cur) runs.push(cur);
  const t0 = Pg[0].t;
  return {
    p50: r1(pct(d.map(q => q.d), 0.5)), p95: r1(pct(d.map(q => q.d), 0.95)), max: r1(Math.max(...d.map(q => q.d))), backMax: r1(Math.max(...back)),
    runs: runs.map(r => { const p = Pg[r.at], n = Nd[d[r.at].i]; return { t: [r1(Pg[r.i0].t - t0), r1(Pg[r.i1].t - t0)], max: r1(r.max), phases: [...r.phases], at: { x: r1(p.x), z: r1(p.z), agl: r1(p.agl), where: where(p.x, p.z) },
      nodeHere: { phase: n.phase, t: r1(n.t - Nd[0].t), agl: r1(n.agl) } }; }),
  };
}

// ---- THE LEGS -----------------------------------------------------------------------------------------------------
const legs = [];
for (let i = 1; i < order.length; i++) {
  const b = A(order[i]);
  const Pg = pageRows.filter(p => p.leg === i), Nd = nodeRows.filter(p => p.leg === i);
  const pl = PL.legs.find(L => L.leg === i) || null, nl = ND.legs[i - 1] || null;
  // the From each really left (after a diversion, not the plan's)
  const aP = A((pl && pl.fromActual) || order[i - 1]), aN = A((nl && nl.where && nl.where.at) || order[i - 1]), a = aP;
  const rtTo = pl && pl.report && pl.report.route ? (pl.report.route.to && pl.report.route.to.id) || pl.report.route.to : null;
  const bP = A(rtTo) || b, bN = A(nl && nl.landedAt) || b;
  if (!pl && !Nd.length) continue;
  // the page leg's rows end at its stop (the rows after the stop, before the next To, belong to the stop)
  const P2 = pl && pl.tStop != null ? Pg.filter(p => p.t <= pl.tStop + 0.01) : Pg;
  const M = { leg: i, from: a.id, fromNode: aN.id, to: b.id, landedPage: bP.id, landedNode: bN.id, page: legMetrics(P2, aP, bP), node: legMetrics(Nd, aN, bN), dev: deviation(P2, Nd) };
  M.page && (M.page.done = !!(pl && !pl.faults.length && pl.report && pl.report.phase === 'STOPPED'));
  M.page && (M.page.pilot = pl && pl.report && pl.report.report ? { outcome: pl.report.report.outcome, landing: pl.report.report.landing, verdicts: (pl.report.report.verdicts || []).map(v => v.code + (v.note ? ': ' + v.note : '')) } : null);
  M.page && (M.page.rigFaults = pl ? pl.faults : []);
  M.page && (M.page.effRate = pl ? pl.effRate : null);
  M.node && nl && (M.node.done = !!nl.ok, M.node.pilot = { outcome: nl.outcome, landing: nl.arr && nl.arr.landing, verdicts: nl.verdicts }, M.node.libFaults = nl.faults);
  // the touchdown, the roll start, the stop: page minus node
  const dd = (p, q) => (p && q ? r1(Math.hypot(p.x - q.x, p.z - q.z)) : null);
  if (M.page && M.node) M.delta = { t: r1(M.page.t - M.node.t), roll: dd(M.page.dep.roll, M.node.dep.roll), lift: dd(M.page.dep.lift, M.node.dep.lift), td: dd(M.page.arr.td, M.node.arr.td), stop: dd(M.page.arr.stop, M.node.arr.stop),
    tdPast: M.page.arr.td && M.node.arr.td ? r1(M.page.arr.td.pastThr - M.node.arr.td.pastThr) : null };
  legs.push(M);
}
// ---- THE TERRAIN CHECK: the page's ground under the aeroplane against node's terrainH there --------------------------
const terr = { n: 0, max: 0, at: null, over1: 0 };
for (const p of pageRows) {
  if (p.agl == null || p.y == null) continue;
  const gp = p.y - p.agl, gn = W.terrainH(p.x, p.z), e = Math.abs(gp - gn);
  terr.n++; if (e > 1) terr.over1++;
  if (e > terr.max) { terr.max = e; terr.at = { x: r1(p.x), z: r1(p.z), page: r1(gp), node: r1(gn), phase: p.phase, leg: p.leg, where: where(p.x, p.z) }; }
}
terr.max = r1(terr.max);
// ---- THE OBSTACLES: the page's registry (each stop's) against node's world --------------------------------------------
const key = (x, z) => Math.round(x / 3) + ',' + Math.round(z / 3);
const nodeObs = new Set(); for (const o of ND.obstacles || []) for (const dx of [-1, 0, 1]) for (const dz of [-1, 0, 1]) nodeObs.add((Math.round(o.x / 3) + dx) + ',' + (Math.round(o.z / 3) + dz));
const pageObs = new Map();
for (const L of PL.legs) for (const o of (L.obstacles || [])) pageObs.set(key(o[0], o[1]), { x: o[0], z: o[1], tag: o[2], r: o[3] });
const allTrack = pageRows.concat(nodeRows);
const nearTrack = o => { for (let i = 0; i < allTrack.length; i += 2) if (Math.hypot(allTrack[i].x - o.x, allTrack[i].z - o.z) < 60) return true; return false; };
const pageOnly = [...pageObs.values()].filter(o => !nodeObs.has(key(o.x, o.z)));
const pageOnlyNear = pageOnly.filter(nearTrack);
const obst = { node: (ND.obstacles || []).length, page: pageObs.size, pageOnly: pageOnly.length, pageOnlyNearTrack: pageOnlyNear.length,
  pageOnlyTags: pageOnly.reduce((m, o) => (m[o.tag || '?'] = (m[o.tag || '?'] || 0) + 1, m), {}), pageOnlyNearList: pageOnlyNear.slice(0, 40).map(o => Object.assign({}, o, { where: where(o.x, o.z) })) };

// ---- THE TABLE ----------------------------------------------------------------------------------------------------
const f = v => (v == null ? '-' : String(v));
const T1 = ['| leg | done page / node | faults page / node | sim time page / node | ground turn, max off centreline page / node | roll from the end page / node | lift-off run page / node | touchdown past thr, off centre page / node | roll-out page / node | deviation p50 / p95 / max (both ways) | stretches > 20 m |', '|---|---|---|---|---|---|---|---|---|---|---|'];
for (const M of legs) {
  const p = M.page || {}, n = M.node || {}, pd = p.dep || {}, nd = n.dep || {}, pa = p.arr || {}, na = n.arr || {};
  const fl = q => (q && q.length ? q.join(', ') : 'none');
  T1.push('| ' + M.from + ' > ' + M.to + (M.landedPage !== M.to ? ' (page landed at ' + M.landedPage + ')' : '') + (M.landedNode !== M.to ? ' (node landed at ' + M.landedNode + ')' : '') + (M.fromNode !== M.from ? ' (node left ' + M.fromNode + ')' : '') + ' | ' + (p.done ? 'yes' : 'NO') + ' / ' + (n.done ? 'yes' : 'NO') + ' | ' + fl((p.faults || []).concat((p.rigFaults || []).map(q => q.k))) + ' / ' + fl((n.faults || []).concat((n.libFaults || []).map(q => q.k))) +
    ' | ' + f(p.t) + ' s / ' + f(n.t) + ' s | ' + f(pd.turned) + ' deg, ' + f(pd.latMax) + ' m / ' + f(nd.turned) + ' deg, ' + f(nd.latMax) + ' m | ' + f(pd.roll && pd.roll.fromEnd) + ' / ' + f(nd.roll && nd.roll.fromEnd) +
    ' | ' + f(pd.lift && pd.lift.dist) + ' / ' + f(nd.lift && nd.lift.dist) + ' | ' + (pa.td ? pa.td.pastThr + ' m, ' + pa.td.c + ' m' : '-') + ' / ' + (na.td ? na.td.pastThr + ' m, ' + na.td.c + ' m' : '-') +
    ' | ' + f(pa.run) + ' / ' + f(na.run) + ' | ' + (M.dev ? M.dev.p50 + ' / ' + M.dev.p95 + ' / ' + M.dev.max + ' (' + M.dev.backMax + ')' : '-') + ' | ' + (M.dev ? M.dev.runs.length : '-') + ' |');
}
const T2 = ['| leg | stretch (leg s) | max | page phases | where | node at that point |', '|---|---|---|---|---|---|'];
for (const M of legs) for (const r of (M.dev ? M.dev.runs : [])) T2.push('| ' + M.from + ' > ' + M.to + ' | ' + r.t[0] + '-' + r.t[1] + ' | ' + r.max + ' m | ' + r.phases.join(' ') + ' | ' + r.at.where + ' (agl ' + r.at.agl + ' m) | ' + r.nodeHere.phase + ' at ' + r.nodeHere.t + ' s, agl ' + r.nodeHere.agl + ' m |');
const T3 = legs.map(M => '- **' + M.from + ' > ' + M.to + '** page pilot: ' + (M.page && M.page.pilot ? (M.page.pilot.verdicts.join('; ') || 'no verdict') : '-') + ' · rate ' + JSON.stringify(M.page && M.page.effRate) + '\n  node pilot: ' + (M.node && M.node.pilot ? (M.node.pilot.verdicts || []).join('; ') || 'no verdict' : '-'));
fs.writeFileSync(path.join(OUT, 'table.md'), '### TOUR-REAL: page vs node, leg by leg (the same measures from both tracks)\n\n' + T1.join('\n') + '\n\n### every stretch where the page flew more than 20 m from node\'s track\n\n' + T2.join('\n') +
  '\n\n### the pilots\' own verdicts\n\n' + T3.join('\n') + '\n\n### the ground and the obstacles\n\n- terrain: the page\'s ground under the aeroplane vs node\'s terrainH at the same point over ' + terr.n + ' samples: max ' + terr.max + ' m, ' + terr.over1 + ' samples over 1 m' + (terr.at ? ' (worst ' + JSON.stringify(terr.at) + ')' : '') +
  '\n- obstacles: node\'s world ' + obst.node + ', the page\'s registry at the stops ' + obst.page + ', the page\'s that node lacks ' + obst.pageOnly + ' (' + JSON.stringify(obst.pageOnlyTags) + '), ' + obst.pageOnlyNearTrack + ' of them within 60 m of either track\n' +
  '- world: page ' + JSON.stringify({ weather: PL.start && PL.start.weather, woodSolid: PL.start && PL.start.woodSolid }) + ' · node ' + JSON.stringify(ND.world || null) + '\n');
fs.writeFileSync(path.join(OUT, 'compare.json'), JSON.stringify({ legs, terrain: terr, obstacles: obst, page: { end: PL.end, rateLog: PL.rateLog, start: PL.start, env: PL.env }, node: { done: ND.done, world: ND.world } }, null, 1));
console.log(fs.readFileSync(path.join(OUT, 'table.md'), 'utf8'));

// ---- THE MAPS -----------------------------------------------------------------------------------------------------
const crc = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return b => { let c = -1; for (const v of b) c = t[(c ^ v) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }; })();
const chunk = (ty, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(ty), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
function raster(x0, z0, x1, z1, PX) {
  const nx = Math.ceil((x1 - x0) / PX), nz = Math.ceil((z1 - z0) / PX), img = Buffer.alloc(nz * (1 + nx * 3)), ISL = W.island;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + (i + 0.5) * PX, z = z0 + (j + 0.5) * PX, h = W.terrainH(x, z), w = W.waterH ? W.waterH(x, z) : -Infinity;
    let rgb;
    if (w > h + 0.05) rgb = [168, 196, 214];
    else { const u = Math.max(0, Math.min(1, h / 700)); rgb = [Math.round(196 + 40 * u), Math.round(210 - 20 * u), Math.round(170 + 40 * u)]; if (ISL && ISL.effClass && ISL.effClass(x, z) === ISL.WC.TREE) rgb = rgb.map(v => Math.round(v * 0.82)); }
    const k = j * (1 + nx * 3) + 1 + i * 3; img[k] = rgb[0]; img[k + 1] = rgb[1]; img[k + 2] = rgb[2];
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(nx, 0); ihdr.writeUInt32BE(nz, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(img)), chunk('IEND', Buffer.alloc(0))]);
}
const NODE_COL = '#1f5fd6', PAGE_COL = '#ff7a00', CLOUD_COL = '#6b6b6b';
function mapSvg(x0, z0, x1, z1, PX, widthPx, title, opts) {
  const vw = x1 - x0, vh = z1 - z0, scale = widthPx / vw, S = [], hd = 80 / scale;
  const png = raster(x0, z0, x1, z1, PX).toString('base64');
  S.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + Math.round(vw * scale) + '" height="' + Math.round(vh * scale + 80) + '" viewBox="' + x0 + ' ' + (z0 - hd) + ' ' + vw + ' ' + (vh + hd) + '">');
  S.push('<rect x="' + x0 + '" y="' + (z0 - hd) + '" width="' + vw + '" height="' + (vh + hd) + '" fill="#fff"/>');
  S.push('<image x="' + x0 + '" y="' + z0 + '" width="' + vw + '" height="' + vh + '" preserveAspectRatio="none" xlink:href="data:image/png;base64,' + png + '" href="data:image/png;base64,' + png + '"/>');
  const sw = 1.2 / scale, fs1 = 13 / scale;
  for (const a of W.aerodromes) {
    const R = C.siteRunway(a), water = a.water || a.kind === 'water';
    const c = [[R.end0.x + R.nx * R.half, R.end0.z + R.nz * R.half], [R.end1.x + R.nx * R.half, R.end1.z + R.nz * R.half], [R.end1.x - R.nx * R.half, R.end1.z - R.nz * R.half], [R.end0.x - R.nx * R.half, R.end0.z - R.nz * R.half]];
    S.push('<polygon points="' + c.map(q => q.join(',')).join(' ') + '" fill="' + (water ? 'none' : '#555') + '" fill-opacity="0.75" stroke="' + (water ? '#2a6fb0' : '#111') + '" stroke-width="' + sw + '"/>');
    if (a.x > x0 && a.x < x1 && a.z > z0 && a.z < z1) S.push('<text x="' + (a.x + 8 / scale) + '" y="' + (a.z - 10 / scale) + '" font-size="' + fs1 + '" font-family="sans-serif" fill="#111" stroke="#fff" stroke-width="' + 3 / scale + '" paint-order="stroke">' + (a.name || a.id) + ' (' + a.id + ')</text>');
  }
  const inBox = o => o.x > x0 && o.x < x1 && o.z > z0 && o.z < z1;
  const ob = opts.obstR || 1.6;
  for (const o of (ND.obstacles || [])) if (inBox(o)) S.push('<rect x="' + (o.x - ob / scale) + '" y="' + (o.z - ob / scale) + '" width="' + 2 * ob / scale + '" height="' + 2 * ob / scale + '" fill="#777"/>');
  for (const o of pageOnly) if (inBox(o)) S.push('<rect x="' + (o.x - ob / scale) + '" y="' + (o.z - ob / scale) + '" width="' + 2 * ob / scale + '" height="' + 2 * ob / scale + '" fill="#e00"/>');
  const line = (pts, col, wpx, dash) => { if (pts.length > 1) S.push('<polyline points="' + pts.map(p => r1(p.x) + ',' + r1(p.z)).join(' ') + '" fill="none" stroke="' + col + '" stroke-width="' + wpx / scale + '"' + (dash ? ' stroke-dasharray="' + dash.map(d => d / scale).join(' ') + '"' : '') + ' stroke-linejoin="round" stroke-opacity="0.9"/>'); };
  if (CLOUD) line(CLOUD.track.map(p => ({ x: p[0], z: p[1] })), CLOUD_COL, 1.4, [2, 3]);
  for (let i = 1; i < order.length; i++) { line(nodeRows.filter(p => p.leg === i), NODE_COL, opts.lw || 2.4); }
  for (let i = 1; i < order.length; i++) { line(pageRows.filter(p => p.leg === i), PAGE_COL, opts.lw ? opts.lw * 0.8 : 1.8); }
  const mark = (p, col, shape) => { if (!p) return; const r = (opts.mk || 5) / scale; S.push(shape === 'x' ? '<path d="M' + (p.x - r) + ',' + (p.z - r) + 'L' + (p.x + r) + ',' + (p.z + r) + 'M' + (p.x - r) + ',' + (p.z + r) + 'L' + (p.x + r) + ',' + (p.z - r) + '" stroke="' + col + '" stroke-width="' + 2.2 / scale + '"/>'
    : shape === 'sq' ? '<rect x="' + (p.x - r) + '" y="' + (p.z - r) + '" width="' + 2 * r + '" height="' + 2 * r + '" fill="none" stroke="' + col + '" stroke-width="' + 2 / scale + '"/>' : '<circle cx="' + p.x + '" cy="' + p.z + '" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="' + 2.2 / scale + '"/>'); };
  for (const M of legs) for (const [m, col] of [[M.node, NODE_COL], [M.page, PAGE_COL]]) if (m) { mark(m.arr.td, col, 'o'); mark(m.dep.roll, col, 'x'); mark(m.arr.stop, col, 'sq'); if (m.dep.uturnAt) mark(m.dep.uturnAt, col, 'sq'); }
  const ty = z0 - hd + 22 / scale;
  S.push('<text x="' + (x0 + 10 / scale) + '" y="' + ty + '" font-size="' + 15 / scale + '" font-family="sans-serif" font-weight="bold">' + title + '</text>');
  S.push('<text x="' + (x0 + 10 / scale) + '" y="' + (ty + 20 / scale) + '" font-size="' + 12 / scale + '" font-family="sans-serif"><tspan fill="' + NODE_COL + '">━ node (tour_real_node, same source)</tspan>   <tspan fill="' + PAGE_COL + '">━ page (GPU, 2x)</tspan>' + (CLOUD ? '   <tspan fill="' + CLOUD_COL + '">┅ ISLAND-TOUR cloud json</tspan>' : '') + '</text>');
  S.push('<text x="' + (x0 + 10 / scale) + '" y="' + (ty + 38 / scale) + '" font-size="' + 12 / scale + '" font-family="sans-serif">' +
    '○ touchdown  ✕ roll start  □ stop / 90° into the U-turn   <tspan fill="#777">■ node obstacles</tspan>  <tspan fill="#e00">■ page-only obstacles</tspan></text>');
  S.push('</svg>');
  return S.join('\n');
}
const toPng = (svg, png, w) => { try { execFileSync('magick', ['-density', '96', svg, '-resize', w + 'x', png], { stdio: 'ignore' }); return true; } catch (e) { console.log('  (png: ' + e.message.split('\n')[0] + ')'); return false; } };
{
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of allTrack) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
  x0 -= 1200; x1 += 1200; z0 -= 1200; z1 += 1200;
  fs.writeFileSync(path.join(OUT, 'map.svg'), mapSvg(x0, z0, x1, z1, 20, 1600, 'TOUR-REAL - the user\'s Cub, ' + order.join(' > ') + ' - page ' + (PL.end ? 'ENDED: ' + PL.end : 'DONE') + ', node ' + (ND.done ? 'DONE' : 'NOT DONE'), {}));
  toPng(path.join(OUT, 'map.svg'), path.join(OUT, 'map.png'), 1600);
  const seen = new Set();
  for (const id of order) {
    if (seen.has(id)) continue; seen.add(id);
    const a = A(id), h = a.len / 2 + 450;
    fs.writeFileSync(path.join(OUT, 'map_' + id + '.svg'), mapSvg(a.x - h, a.z - h * 0.75, a.x + h, a.z + h * 0.75, 3, 1400, (a.name || a.id) + ' (' + id + ') close up - the U-turns, the rolls, the touchdowns, the stops', { lw: 2.6, mk: 7, obstR: 2.5 }));
    toPng(path.join(OUT, 'map_' + id + '.svg'), path.join(OUT, 'map_' + id + '.png'), 1400);
  }
}
// ---- THE STILL STRIPS AND THE CASTS -------------------------------------------------------------------------------
if (!flag('no-media')) {
  const MOM = ['depart', 'uturn', 'roll', 'liftoff', 'final1k', 'final300', 'touchdown', 'stop', 'over', 'abort'];
  const tmp = path.join(require('os').tmpdir(), 'tour_real_media_' + process.pid); fs.mkdirSync(tmp, { recursive: true });
  for (const L of PL.legs) {
    const S = (PL.stills || []).filter(s => s.leg === L.leg).sort((p, q) => MOM.indexOf(p.moment) - MOM.indexOf(q.moment));
    if (!S.length) continue;
    const args = ['montage'];
    for (const kind of ['chase', 'top']) for (const s of S) { const fl = path.join(PAGE, 'stills', 'L' + L.leg + '_' + s.moment + '_' + kind + '.jpg'); if (fs.existsSync(fl)) args.push('-label', s.moment + ' t+' + r1(s.t - L.tStart) + ' s ' + (s.ph || '') + ' agl ' + s.agl + ' m (' + kind + ')', fl); }
    args.push('-tile', S.length + 'x2', '-geometry', '480x270+3+3', '-pointsize', '15', '-quality', '82', path.join(OUT, 'stills_L' + L.leg + '_' + L.from + '_' + L.to + '.jpg'));
    try { execFileSync('magick', args, { stdio: 'ignore' }); } catch (e) { console.log('  (montage L' + L.leg + ': ' + e.message.split('\n')[0] + ')'); }
  }
  // the casts: page sim time -> epoch ms through the samples (wallMs on the page's clock + its timeOrigin)
  const TO = PL.start && PL.start.timeOrigin;
  const frames = (PL.cast && PL.cast.frames) || [], blanks = (PL.cast && PL.cast.blanks) || [];
  const epochOfT = t => { let best = null; for (const p of pageRows) { if (p.t >= t) { best = p; break; } } best = best || pageRows[pageRows.length - 1]; return best && TO ? TO + best.wallMs : null; };
  const cut = (name, tA, tB) => {
    const eA = epochOfT(tA), eB = epochOfT(tB); if (!eA || !eB) return;
    let F = frames.filter(fr => { const e = fr[2] ? fr[2] * 1000 : fr[1]; return e >= eA && e <= eB && !fr[3] && !blanks.some(b => e >= b[0] - 100 && e <= b[1] + 150); });
    if (F.length < 3) { console.log('  cast ' + name + ': ' + F.length + ' frames - skipped'); return; }
    const keep = Math.min(F.length, 160); F = F.filter((_, i) => i % Math.ceil(F.length / keep) === 0);
    const list = F.map(fr => path.join(PAGE, 'cast', 'c' + String(fr[0]).padStart(6, '0') + '.jpg')).filter(p => fs.existsSync(p));
    const lf = path.join(tmp, name + '.txt'); fs.writeFileSync(lf, list.map(p => p.replace(/\\/g, '/')).join('\n'));
    const dur = (eB - eA) / 1000, delay = Math.max(4, Math.round(100 * dur / list.length / 2));   // played at 2x the wall clock it was recorded on
    try { execFileSync('magick', ['-delay', String(delay), '-loop', '0', '@' + lf, '-resize', '512x', '-quality', '40', path.join(OUT, name + '.webp')], { stdio: 'ignore' }); console.log('  cast ' + name + ': ' + list.length + ' frames, ' + dur.toFixed(0) + ' s wall'); }
    catch (e) { console.log('  (cast ' + name + ': ' + e.message.split('\n')[0] + ')'); }
  };
  for (const L of PL.legs) {
    const R = pageRows.filter(p => p.leg === L.leg && p.t <= (L.tStop != null ? L.tStop + 3 : Infinity)), b = A(L.to);
    const roll = R.find(p => p.phase === 'ROLL');
    if (roll) cut('cast_L' + L.leg + '_uturn', Math.max(L.tStart, roll.t - 90), roll.t + 4);
    const f300 = R.find(p => p.phase === 'FINAL' && Math.hypot(p.x - b.x, p.z - b.z) - b.len / 2 <= 300) || R.find(p => p.phase === 'FINAL');
    if (f300 && L.tStop != null) cut('cast_L' + L.leg + '_landing', f300.t, L.tStop + 2);
    // a rejected take-off (and its retry): the whole ground part of the leg, the turn-arounds, both rolls, both stops
    if ((L.faults || []).some(f => f.k === 'abort') && L.tStop != null) cut('cast_L' + L.leg + '_ground', L.tStart, L.tStop + 2);
  }
}
console.log('tour_real_report: wrote ' + OUT);
