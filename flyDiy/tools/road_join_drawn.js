#!/usr/bin/env node
// ROAD JOIN, ON THE DRAWN LINES (TOW-LAUNCH, 2026-11-12; the user: "join the roads"). tools/road_review.js --join finds its
// crossings between the WAYPOINT CHORDS - right for a straight street, wrong for a traced SPLINE road, whose drawn curve runs
// up to 8 m off its chords on Jolene: the junction it inserts drags the curve through a point that was never on it (r1
// moved 21 m, r35 26 m). This joiner reads the roads AS COMPOSED (27_premises: the spline, the fillets), so:
//   - a CROSSING is where two drawn lines cross (no junction of theirs within 8 m, neither road a bridge): the crossing point
//     goes into BOTH roads as a waypoint, at its place along each (between the waypoints whose drawn stretch holds it);
//   - a T is a road's free end within `--tee` metres (2.5) of another road's drawn line: the end moved onto that line and the
//     point inserted into the through road;
//   - every such point carries one new junction id (`jd<n>`) in both roads' `nodes` (the G2950 contract: roads join only at
//     waypoints sharing an id); a road's `tan` (spline handles) gets a null slot beside the new point.
// A point inserted ON a straight span changes nothing drawn; on a spline it is a point the curve already passed through.
// The report measures what moved anyway: every road's drawn line before / after, the largest distance (`--max` metres:
// refused above it, default 1.0) - and writes nothing unless asked.
//   node tools/road_join_drawn.js [--file tools/fixtures/island_jolene.json] [--tee 2.5] [--max 1.0] [--out PATCH.json]
//   python tools/road_patch.py PATCH.json [the record]     (writes it, every other byte kept; the patch carries tan too)
'use strict';
require('./_core_math_global.js');
const fs = require('fs'), path = require('path');
const PG = require(path.join(__dirname, '..', 'src', 'core', '27_premises.js'));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const FILE = arg('--file', path.join(__dirname, 'fixtures', 'island_jolene.json')), TEE = +arg('--tee', 2.5), GAP = +arg('--gap', 15), MAX = +arg('--max', 1.0);
const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const rec = doc.premises || doc;
const OUT = arg('--out', null);
// pairs not to join ('a|b', either order) - the --level pass's refusals: two roads that meet at different heights
const SKIP = new Set((arg('--skip', '') || '').split(',').filter(Boolean).flatMap(p => { const [a, b] = p.split('|'); return [a + '|' + b, b + '|' + a]; }));
const skipped = (a, b) => SKIP.has(a + '|' + b);
const END_T = +arg('--endT', 15);   // a crossing within this of a road's FREE end: the end trimmed back onto it (an overrun)
const flat = { id: 'flat', terrainH: () => 0, waterH: () => -100 };
const drawnOf = R => { const O = PG.compose(R, flat, { raster: false }); return new Map(O.roads.filter(r => !r.runway).map(r => [r.id, r.pts.map(q => [q[0], q[1]])])); };
const D0 = drawnOf(rec);
const ORIG = new Map(rec.layers.roads.map(r => [r.id, { pts: r.pts.map(q => q.slice()), tan: Array.isArray(r.tan) ? r.tan.slice() : null }]));
const roads = rec.layers.roads.filter(r => r && Array.isArray(r.pts) && r.pts.length >= 2 && D0.has(r.id));
const byId = new Map(roads.map(r => [r.id, r]));
const cross = (a, b, c, d) => { const rx = b[0] - a[0], rz = b[1] - a[1], sx = d[0] - c[0], sz = d[1] - c[1], den = rx * sz - rz * sx; if (Math.abs(den) < 1e-12) return null; const qx = c[0] - a[0], qz = c[1] - a[1], t = (qx * sz - qz * sx) / den, u = (qx * rz - qz * rx) / den; return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [t, u] : null; };
const foot = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1e-12, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)); return { t, d: Math.hypot(a[0] + dx * t - p[0], a[1] + dz * t - p[1]), x: a[0] + dx * t, z: a[1] + dz * t }; };
// the arc length along a drawn line of each of its points
const arcs = P => { const s = [0]; for (let i = 1; i < P.length; i++) s.push(s[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); return s; };
const A = new Map(roads.map(r => [r.id, arcs(D0.get(r.id))]));
// each waypoint's arc length along its drawn line (the nearest drawn point, searched forward: a spline passes through them)
const wpS = r => { const P = D0.get(r.id), S = A.get(r.id); let k0 = 0; return r.pts.map(q => { let best = k0, bt = 0, bd = Infinity; for (let k = k0; k + 1 < P.length; k++) { const F = foot(q, P[k], P[k + 1]); if (F.d < bd - 1e-9) { bd = F.d; best = k; bt = F.t; } if (bd < 0.05 && S[k] - S[best] > 80) break; } k0 = best; return S[best] + bt * (S[best + 1] - S[best]); }); };
const WS = new Map(roads.map(r => [r.id, wpS(r)]));
const jidOf = (r, i) => (Array.isArray(r.nodes) ? r.nodes[i] || null : null);
// the junctions a road already shares, as points (no second join within 8 m of one both roads carry)
const sharedNear = (r, q, x, z) => r.pts.some((p, i) => { const j = jidOf(r, i); return j && q.pts.some((w, k) => jidOf(q, k) === j) && Math.hypot(p[0] - x, p[1] - z) < 8; });
const isBridge = r => r.cls === 'bridge';
// the inserts: road id -> [{ s (arc length), p, id }]
const ins = new Map(), joins = [];
const put = (rid, s, p, jid) => { let L = ins.get(rid); if (!L) ins.set(rid, L = []); L.push({ s, p, jid }); };
let nJ = 0; const used = new Set(); for (const r of rec.layers.roads) for (const j of (r.nodes || [])) if (j) used.add(j); for (const j of rec.layers.junctions || []) used.add(j.id);
const newJ = () => { let id; do { id = 'jd' + (++nJ); } while (used.has(id)); used.add(id); return id; };
// 1. CROSSINGS of the drawn lines (segment grid)
const CELL = 64, grid = new Map();
for (const r of roads) { const P = D0.get(r.id); for (let k = 0; k + 1 < P.length; k++) { const a = P[k], b = P[k + 1];
  for (let i = Math.floor(Math.min(a[0], b[0]) / CELL); i <= Math.floor(Math.max(a[0], b[0]) / CELL); i++) for (let j = Math.floor(Math.min(a[1], b[1]) / CELL); j <= Math.floor(Math.max(a[1], b[1]) / CELL); j++) { const kk = i + ',' + j; let L = grid.get(kk); if (!L) grid.set(kk, L = []); L.push([r.id, k]); } } }
const seen = new Set(), trims = new Map();
for (const L of grid.values()) for (let p = 0; p < L.length; p++) for (let q = p + 1; q < L.length; q++) {
  const [ra, ka] = L[p], [rb, kb] = L[q]; if (ra === rb) continue;
  const key = ra < rb ? ra + ka + '|' + rb + kb : rb + kb + '|' + ra + ka; if (seen.has(key)) continue; seen.add(key);
  const Pa = D0.get(ra), Pb = D0.get(rb), X = cross(Pa[ka], Pa[ka + 1], Pb[kb], Pb[kb + 1]); if (!X) continue;
  const x = Pa[ka][0] + (Pa[ka + 1][0] - Pa[ka][0]) * X[0], z = Pa[ka][1] + (Pa[ka + 1][1] - Pa[ka][1]) * X[0];
  const R1 = byId.get(ra), R2 = byId.get(rb);
  if (sharedNear(R1, R2, x, z) || skipped(ra, rb)) continue;
  if (isBridge(R1) || isBridge(R2)) { joins.push({ kind: 'skipped (bridge)', a: ra, b: rb, x, z }); continue; }
  // a crossing ON a road's end (within 1 m): a T (below), not a crossing
  const sa = A.get(ra)[ka] + X[0] * Math.hypot(Pa[ka + 1][0] - Pa[ka][0], Pa[ka + 1][1] - Pa[ka][1]), sb = A.get(rb)[kb] + X[1] * Math.hypot(Pb[kb + 1][0] - Pb[kb][0], Pb[kb + 1][1] - Pb[kb][1]);
  const La = A.get(ra)[Pa.length - 1], Lb = A.get(rb)[Pb.length - 1];
  const P = [+x.toFixed(2), +z.toFixed(2)];
  // AN OVERRUN: the crossing within END_T of a free end of one road (r3 runs 7 m past mk_sa01) - that end is trimmed back
  // onto the crossing (the stub past it dropped), the point inserted into the other road: one junction, no double
  const endOf = (R, s_, L_) => (s_ < END_T && !jidOf(R, 0) ? 0 : L_ - s_ < END_T && !jidOf(R, R.pts.length - 1) ? 1 : -1);
  const ea = endOf(R1, sa, La), eb = endOf(R2, sb, Lb);
  if (ea >= 0 || eb >= 0) {
    const useA = ea >= 0 && (eb < 0 || Math.min(sa, La - sa) <= Math.min(sb, Lb - sb));
    const T = useA ? { r: R1, end: ea, s: sa } : { r: R2, end: eb, s: sb }, O_ = useA ? { id: rb, s: sb } : { id: ra, s: sa };
    const prev = trims.get(T.r.id + ':' + T.end);
    if (!prev || Math.abs(prev.s - (T.end ? A.get(T.r.id)[A.get(T.r.id).length - 1] : 0)) > Math.abs(T.s - (T.end ? A.get(T.r.id)[A.get(T.r.id).length - 1] : 0)))
      trims.set(T.r.id + ':' + T.end, { r: T.r, end: T.end, s: T.s, P, other: O_ });
    continue;
  }
  const jid = newJ();
  put(ra, sa, P, jid); put(rb, sb, P, jid);
  joins.push({ kind: 'crossing', a: ra, b: rb, x: P[0], z: P[1], jid });
}
// 1b. THE TRIMS: the end's waypoints past the crossing dropped, the end ON the crossing, the other road takes the point
for (const T of trims.values()) {
  const r = T.r, S = WS.get(r.id), jid = newJ();
  if (!Array.isArray(r.nodes)) r.nodes = r.pts.map(() => null);
  const keep = T.end ? S.map((v, i) => v < T.s - 0.5 || i === 0) : S.map((v, i) => v > T.s + 0.5 || i === r.pts.length - 1);
  const idx = r.pts.map((_, i) => i).filter(i => keep[i]);
  const pick = a => idx.map(i => (Array.isArray(a) ? a[i] : null));
  r.pts = idx.map(i => r.pts[i]); r.nodes = pick(r.nodes); if (Array.isArray(r.tan)) r.tan = pick(r.tan);
  const P = T.P;
  if (T.end) { r.pts.push(P); r.nodes.push(jid); if (Array.isArray(r.tan)) r.tan.push(null); }
  else { r.pts.unshift(P); r.nodes.unshift(jid); if (Array.isArray(r.tan)) r.tan.unshift(null); }
  const S2 = idx.map(i => S[i]); if (T.end) S2.push(T.s); else S2.unshift(T.s);
  WS.set(r.id, S2);   // (its waypoints' places along the drawn line: the kept ones', the crossing's)
  put(T.other.id, T.other.s, P, jid);
  joins.push({ kind: 'trim', a: r.id, b: T.other.id, x: P[0], z: P[1], d: +Math.abs((T.end ? A.get(r.id)[A.get(r.id).length - 1] : 0) - T.s).toFixed(1), jid });
}
// 2. T's: a free end (no junction id) within TEE of another road's drawn line
for (const r of roads) for (const which of ['first', 'last']) {
  const end = which === 'first' ? 0 : r.pts.length - 1;   // (resolved now: a gap closed at the first end lengthens the road)
  if (jidOf(r, end)) continue;
  const p = r.pts[end];
  // END TO END: another road's END within TEE (r34 and r35 meet that way) - one junction at that end, neither inserted
  let e2 = null;
  for (const q of roads) { if (q === r || skipped(r.id, q.id)) continue; for (const qe of [0, q.pts.length - 1]) { const d = Math.hypot(q.pts[qe][0] - p[0], q.pts[qe][1] - p[1]); if (d <= TEE && (!e2 || d < e2.d)) e2 = { q, qe, d }; } }
  if (e2) {
    const q = e2.q, qe = e2.qe; if (!Array.isArray(q.nodes)) q.nodes = q.pts.map(() => null);
    const jid = q.nodes[qe] || newJ(); q.nodes[qe] = jid;
    r.pts[end] = q.pts[qe].slice(0, 2); if (!Array.isArray(r.nodes)) r.nodes = r.pts.map(() => null); r.nodes[end] = jid;
    joins.push({ kind: 'tee', a: r.id, b: q.id + ' (its end)', bid: q.id, x: r.pts[end][0], z: r.pts[end][1], d: +e2.d.toFixed(2), jid });
    continue;
  }
  let best = null;
  for (const q of roads) { if (q === r || skipped(r.id, q.id)) continue; const P = D0.get(q.id), S = A.get(q.id);
    for (let k = 0; k + 1 < P.length; k++) { const F = foot(p, P[k], P[k + 1]); if (F.d <= GAP && (!best || F.d < best.F.d)) best = { q, k, F, s: S[k] + F.t * (S[k + 1] - S[k]) }; } }
  if (!best) continue;
  // A GAP (TEE < d <= GAP: the end drawn short of the street): the end stays, the road EXTENDED by one waypoint at the
  // foot on the street - only when the street lies ahead of the end (the road's own direction there, within 60 deg)
  if (best.F.d > TEE) {
    const a = r.pts[end === 0 ? 1 : r.pts.length - 2], dx = p[0] - a[0], dz = p[1] - a[1], l = Math.hypot(dx, dz) || 1;
    const ex = best.F.x - p[0], ez = best.F.z - p[1];
    const touch = best.F.d <= ((+r.w || 4) + (+best.q.w || 4)) / 2;   // (the two bands overlap there: joined whichever way it points)
    if (!touch && (dx * ex + dz * ez) / (l * best.F.d) < 0.5) continue;
    const P = [+best.F.x.toFixed(2), +best.F.z.toFixed(2)], jid = newJ();
    put(best.q.id, best.s, P, jid);
    if (!Array.isArray(r.nodes)) r.nodes = r.pts.map(() => null);
    // a SPLINE keeps its curve EXACTLY: its old end fixed at the handle it is drawn with (roadHandles - the end's own
    // derivative, so the run before it solves to the same curve), the extension one new segment past it
    if (r.curve === 'spline') {
      const O = ORIG.get(r.id), H = PG.roadHandles(O.pts, O.tan);
      if (!Array.isArray(r.tan)) r.tan = r.pts.map(() => null);
      r.tan[end] = [+H[end === 0 ? 0 : H.length - 1][0].toFixed(4), +H[end === 0 ? 0 : H.length - 1][1].toFixed(4)];
    }
    if (end === 0) { r.pts.unshift(P); r.nodes.unshift(jid); if (Array.isArray(r.tan)) r.tan.unshift(null); }
    else { r.pts.push(P); r.nodes.push(jid); if (Array.isArray(r.tan)) r.tan.push(null); }
    joins.push({ kind: 'gap', a: r.id, b: best.q.id, x: P[0], z: P[1], d: +best.F.d.toFixed(2), jid });
    continue;
  }
  // the end ON another road's waypoint already (road_review's join): that waypoint takes the id
  const wi = best.q.pts.findIndex(w => Math.hypot(w[0] - p[0], w[1] - p[1]) < 0.5);
  const P = wi >= 0 ? best.q.pts[wi].slice(0, 2) : [+best.F.x.toFixed(2), +best.F.z.toFixed(2)];
  const jid = (wi >= 0 && jidOf(best.q, wi)) || newJ();
  if (wi >= 0) { if (!Array.isArray(best.q.nodes)) best.q.nodes = best.q.pts.map(() => null); best.q.nodes[wi] = jid; }
  else put(best.q.id, best.s, P, jid);
  r.pts[end] = [P[0], P[1]];
  if (!Array.isArray(r.nodes)) r.nodes = r.pts.map(() => null);
  r.nodes[end] = jid;
  joins.push({ kind: 'tee', a: r.id, b: best.q.id, x: P[0], z: P[1], d: +best.F.d.toFixed(2), jid });
}
// 3. the inserts: each point between the waypoints whose drawn stretch holds it
for (const [rid, L] of ins) {
  const r = byId.get(rid), S = WS.get(rid);
  L.sort((u, v) => u.s - v.s);
  const pts = [], nodes = [], tan = [], hasN = Array.isArray(r.nodes), spl = r.curve === 'spline';
  // (a spline re-solves through the new point, which lies on its curve: GATE-style measure below says what moved)
  let li = 0;
  for (let i = 0; i < r.pts.length; i++) {
    while (li < L.length && i > 0 && L[li].s < S[i]) { pts.push(L[li].p); nodes.push(L[li].jid); tan.push(null); li++; }
    pts.push(r.pts[i]); nodes.push(hasN ? r.nodes[i] || null : null); tan.push(Array.isArray(r.tan) ? r.tan[i] || null : null);
  }
  r.pts = pts; r.nodes = nodes; if (Array.isArray(r.tan)) r.tan = tan;
}
const jsn = rec.layers.junctions || (rec.layers.junctions = []);
// 4. what moved: every road's drawn line before / after
const D1 = drawnOf(rec);
const sd = (p, P) => { let b = Infinity; for (let i = 0; i + 1 < P.length; i++) b = Math.min(b, foot(p, P[i], P[i + 1]).d); return b; };
const moved = [];
// (one way: how far the NEW line strays from the old - a trimmed stub is not a move, a reshaped curve is)
// (and past the old line's ends - a gap's extension, an end moved onto a street - is the join's own, not a move: a point
// whose nearest place on the old line is one of its two ends is not measured)
const sdIn = (p, P) => { let b = Infinity, atEnd = false; for (let i = 0; i + 1 < P.length; i++) { const F = foot(p, P[i], P[i + 1]); if (F.d < b) { b = F.d; atEnd = (i === 0 && F.t < 1e-6) || (i === P.length - 2 && F.t > 1 - 1e-6); } } return atEnd ? 0 : b; };
for (const [id, P] of D0) { const Q = D1.get(id); if (!Q) continue; let m = 0; for (const q of Q) m = Math.max(m, sdIn(q, P)); if (m > 0.005) moved.push([id, +m.toFixed(3), (byId.get(id) || {}).curve || 'line']); }
moved.sort((a, b) => b[1] - a[1]);
const G = PG.compose(rec, flat, { raster: false }).roadGraph(), C = G.components();
console.log('ROAD JOIN (drawn) ' + FILE);
console.log('  crossings joined: ' + joins.filter(j => j.kind === 'crossing').length + ', overruns trimmed: ' + joins.filter(j => j.kind === 'trim').length + ', T\'s joined: ' + joins.filter(j => j.kind === 'tee').length + ', gaps closed: ' + joins.filter(j => j.kind === 'gap').length + ', skipped (bridges): ' + joins.filter(j => /bridge/.test(j.kind)).length);
for (const j of joins) console.log('    ' + j.kind.padEnd(9) + ' ' + j.a + ' x ' + j.b + ' at (' + j.x.toFixed(1) + ', ' + j.z.toFixed(1) + ')' + (j.d != null ? (j.kind === 'trim' ? ' (a ' + j.d + ' m stub trimmed)' : j.kind === 'gap' ? ' (extended ' + j.d + ' m to it)' : ' (the end moved ' + j.d + ' m)') : '') + (j.jid ? ' ' + j.jid : ''));
console.log('  drawn lines moved > 5 mm: ' + moved.length + (moved.length ? ' - ' + moved.slice(0, 12).map(m => m[0] + ' ' + m[1] + ' m (' + m[2] + ')').join(', ') : ''));
console.log('  the graph: ' + C.length + ' components, the largest ' + new Set([].concat(...C[0].map(n => G.node(n).roads))).size + ' roads');
const worst = moved.length ? moved[0][1] : 0;
if (worst > MAX) { console.log('REFUSED: a drawn line moved ' + worst + ' m (> --max ' + MAX + ')'); process.exit(2); }
// the patch (tools/road_patch.py writes it into the Python-written record, every other byte kept): the touched roads' pts,
// nodes and tan
if (OUT) {
  const touched = new Set([...ins.keys(), ...joins.filter(j => j.kind === 'tee' || j.kind === 'trim' || j.kind === 'gap').flatMap(j => [j.a, j.bid || j.b])].filter(id => byId.has(id)));
  const P = { roads: {} };
  for (const id of touched) { const r = byId.get(id); P.roads[id] = Object.assign({ pts: r.pts, nodes: r.nodes }, Array.isArray(r.tan) ? { tan: r.tan } : {}); }
  fs.writeFileSync(OUT, JSON.stringify(P)); console.log('the patch: ' + touched.size + ' road(s) -> ' + OUT);
}
