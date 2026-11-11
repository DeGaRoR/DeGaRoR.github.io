// ============================================================
// THE ISLAND'S ROADS FOR A VEHICLE (TOW-LAUNCH phase 1, 2026-11-11) — the premises' road graph (27_premises.js
// O.roadGraph(), G2950: junctions + spans on their DRAWN lines) turned into the driver's graph (vehicle_drive.js
// vehRoadGraph's spec: { roads: [{ pts, w }], places }), and the destinations a vehicle can be sent to.
// Pure: no THREE, no DOM. Reads the composition, writes nothing back: THE SCENERY IS NEVER EDITED HERE.
//
// WHAT IT ADDS, VEHICLE-SIDE ONLY (reported, never silent - `report.joins`):
//  - DRAWN CROSSINGS. Two roads whose drawn lines cross between their waypoints have no junction id (the user joins
//    roads at waypoints, tools/road_review.js lists them) - but the asphalt is there, both roads drawn over the same
//    ground. The vehicle's graph joins them at the crossing point (a shared vertex on both), unless either is a bridge.
//    Jolene's HOME road (r3) crosses Cedar Harbour's street mk_sa01 7 m before its end: without this join HOME and the
//    town are two separate graphs.
//  - DRAWN T's: a road's free end within `tTol` of another road's span (not on a waypoint): joined at the foot.
//  Nothing is joined across a GAP (an end short of a street): that is the user's to trace (the report lists the
//  nearest gaps between the components so the page / a report can show them).
//
// THE PLACES (a destination is a 'stop' place on the road nearest to it):
//  - every aerodrome the world knows (its stand when the site has one, else its centre), id = the field's id;
//  - the named sites the caller passes (`opts.sites`: [{ id, name, x, z }] - a town hall, a dock);
//  - only within `maxOff` of a road of the vehicle's component (`opts.from`: a point the vehicle starts at).
// ============================================================

// segments a, b (2D) crossing strictly inside both: [t, u] or null
function viCross(a, b, c, d) {
  const rx = b[0] - a[0], rz = b[1] - a[1], sx = d[0] - c[0], sz = d[1] - c[1], den = rx * sz - rz * sx;
  if (Math.abs(den) < 1e-12) return null;
  const qx = c[0] - a[0], qz = c[1] - a[1], t = (qx * sz - qz * sx) / den, u = (qx * rz - qz * rx) / den;
  return t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6 ? [t, u] : null;
}
function viSegFoot(p, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1e-12;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2));
  return { t, d: Math.hypot(a[0] + dx * t - p[0], a[1] + dz * t - p[1]), x: a[0] + dx * t, z: a[1] + dz * t };
}

// RG: a graphMake road graph (O.roadGraph()); opts: { tTol (2.5 m), cell (64 m), joinCrossings (true), sites, from,
// aerodromes: [{ id, name, x, z, stand? }], maxOff (600 m) }
// -> { spec: { roads, places }, report: { joins, comps, places, skipped } }
function vehIslandSpec(RG, opts) {
  opts = opts || {};
  const tTol = opts.tTol ?? 2.5, CELL = opts.cell || 64, joinX = opts.joinCrossings !== false;
  // 1. each span of the premises graph a polyline, its ends ON its nodes (the junction's waypoint, shared by every
  //    road through it - so the driver's graph merges them by coordinate)
  const E = [], rebuilt = [];
  const recRoads = new Map((((opts.rec && opts.rec.layers && opts.rec.layers.roads) || [])).map(r => [r.id, r]));
  const toW = opts.toWorld || ((x, z) => [x, z]);
  for (const e of RG.edges) {
    const A = RG.node(e.a), B = RG.node(e.b);
    let P = (e.pts || []).map(q => [q[0], q[1]]);
    // A SPAN WHOSE LINE MISSES ITS NODES (27_premises roadGraph, found here 11 Nov): a straight street's junction waypoints
    // on a straight span are dropped from its drawn line (straightOf: "no corner"), so the graph's nearest-drawn-point
    // search maps the junction to the next real vertex - Cedar Harbour's spans ended up to 60 m from their junctions,
    // some a single point. Rebuilt from the record's own waypoints between the two nodes (a non-spline road: its line IS
    // its waypoints; a fillet road's arcs are the driver's fillets again)
    const off = P.length < 2 ? Infinity : Math.max(Math.hypot(P[0][0] - A.x, P[0][1] - A.z), Math.hypot(P[P.length - 1][0] - B.x, P[P.length - 1][1] - B.z));
    if (off > 1) {
      const r = recRoads.get(e.road);
      if (r && r.curve !== 'spline' && Array.isArray(r.pts)) {
        const W = r.pts.map(q => toW(q[0], q[1]));
        const near = N => { let bi = -1, bd = Infinity; W.forEach((q, i) => { const d = Math.hypot(q[0] - N.x, q[1] - N.z); if (d < bd) { bd = d; bi = i; } }); return bd < 0.5 ? bi : -1; };
        const i0 = near(A), i1 = near(B);
        if (i0 >= 0 && i1 >= 0 && i0 !== i1) { P = (i0 < i1 ? W.slice(i0, i1 + 1) : W.slice(i1, i0 + 1).reverse()).map(q => [q[0], q[1]]); rebuilt.push({ id: e.id, off: +off.toFixed(1) }); }
      }
    }
    if (P.length < 2) { if (Math.hypot(B.x - A.x, B.z - A.z) < 0.5) continue; P = [[A.x, A.z], [B.x, B.z]]; rebuilt.push({ id: e.id, off: +off.toFixed(1), chord: true }); }
    P[0] = [A.x, A.z]; P[P.length - 1] = [B.x, B.z];
    E.push({ id: e.id, road: e.road, a: e.a, b: e.b, w: e.w || 4, cls: e.cls, surface: e.surface, pts: P, ins: [] });
  }
  // the degree of each premises node (a free end has 1)
  const deg = new Map(); for (const e of E) { deg.set(e.a, (deg.get(e.a) || 0) + 1); deg.set(e.b, (deg.get(e.b) || 0) + 1); }
  // 2. the segment grid
  const grid = new Map(), key = (i, j) => i + ',' + j;
  E.forEach((e, ei) => { for (let k = 0; k + 1 < e.pts.length; k++) {
    const a = e.pts[k], b = e.pts[k + 1];
    for (let i = Math.floor(Math.min(a[0], b[0]) / CELL); i <= Math.floor(Math.max(a[0], b[0]) / CELL); i++)
      for (let j = Math.floor(Math.min(a[1], b[1]) / CELL); j <= Math.floor(Math.max(a[1], b[1]) / CELL); j++) {
        const kk = key(i, j); let L = grid.get(kk); if (!L) grid.set(kk, L = []); L.push(ei, k);
      }
  } });
  const joins = [], skipped = [], seen = new Set();
  const shares = (e, f) => e.a === f.a || e.a === f.b || e.b === f.a || e.b === f.b;
  // 3. the drawn crossings
  if (joinX) for (const L of grid.values()) for (let p = 0; p < L.length; p += 2) for (let q = p + 2; q < L.length; q += 2) {
    const ei = L[p], fi = L[q]; if (ei === fi) continue;
    const e = E[ei], f = E[fi], k = L[p + 1], m = L[q + 1];
    const id = ei < fi ? ei + ':' + k + ':' + fi + ':' + m : fi + ':' + m + ':' + ei + ':' + k;
    if (seen.has(id)) continue; seen.add(id);
    const X = viCross(e.pts[k], e.pts[k + 1], f.pts[m], f.pts[m + 1]); if (!X) continue;
    const x = e.pts[k][0] + (e.pts[k + 1][0] - e.pts[k][0]) * X[0], z = e.pts[k][1] + (e.pts[k + 1][1] - e.pts[k][1]) * X[0];
    // at a junction both already share: no second join (the spline's samples cross near their own node)
    if (shares(e, f)) { const n = [e.a, e.b].find(n => n === f.a || n === f.b), N = RG.node(n); if (Math.hypot(N.x - x, N.z - z) < 8) continue; }
    if (e.cls === 'bridge' || f.cls === 'bridge') { skipped.push({ kind: 'bridge', a: e.road, b: f.road, x, z }); continue; }
    const P = [+x.toFixed(3), +z.toFixed(3)];
    e.ins.push({ k, t: X[0], p: P }); f.ins.push({ k: m, t: X[1], p: P });
    joins.push({ kind: 'crossing', a: e.road, b: f.road, x: P[0], z: P[1] });
  }
  // 4. the drawn T's: a free end on another road's span
  for (const e of E) for (const end of [0, 1]) {
    const nid = end ? e.b : e.a; if (deg.get(nid) !== 1) continue;
    const p = end ? e.pts[e.pts.length - 1] : e.pts[0];
    let best = null;
    const L = grid.get(key(Math.floor(p[0] / CELL), Math.floor(p[1] / CELL))) || [];
    for (let q = 0; q < L.length; q += 2) {
      const f = E[L[q]]; if (f === e || f.road === e.road) continue;
      const m = L[q + 1], F = viSegFoot(p, f.pts[m], f.pts[m + 1]);
      if (F.d <= tTol && (!best || F.d < best.F.d)) best = { f, m, F };
    }
    if (!best) continue;
    const P = [+best.F.x.toFixed(3), +best.F.z.toFixed(3)];
    if (end) e.pts[e.pts.length - 1] = P; else e.pts[0] = P;
    if (best.F.t > 1e-6 && best.F.t < 1 - 1e-6) best.f.ins.push({ k: best.m, t: best.F.t, p: P });
    joins.push({ kind: 'tee', a: e.road, b: best.f.road, x: P[0], z: P[1], d: +best.F.d.toFixed(2) });
  }
  // 5. the polylines with their joins inserted
  const roads = E.map(e => {
    if (!e.ins.length) return { id: e.id, road: e.road, pts: e.pts, w: e.w, surface: e.surface, cls: e.cls };
    const byK = new Map(); for (const I of e.ins) { let l = byK.get(I.k); if (!l) byK.set(I.k, l = []); l.push(I); }
    const out = [];
    e.pts.forEach((q, k) => { out.push(q); const l = byK.get(k); if (l) l.sort((u, v) => u.t - v.t).forEach(I => out.push(I.p)); });
    return { id: e.id, road: e.road, pts: out, w: e.w, surface: e.surface, cls: e.cls };
  });
  // 6. the components (by shared coordinates, as vehRoadGraph merges: 0.5 m)
  const ck = q => Math.round(q[0] * 2) + ',' + Math.round(q[1] * 2);
  const par = roads.map((r, i) => i), find = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
  const at = new Map();
  roads.forEach((r, i) => r.pts.forEach(q => { const k = ck(q); if (at.has(k)) { const a = find(at.get(k)), b = find(i); if (a !== b) par[a] = b; } else at.set(k, i); }));
  const compOf = roads.map((r, i) => find(i));
  // 7. the places
  const places = [], placeRep = [];
  const nearest = (x, z, comp) => {
    let best = null;
    roads.forEach((r, ri) => { if (comp != null && compOf[ri] !== comp) return; let s = 0;
      for (let k = 0; k + 1 < r.pts.length; k++) { const a = r.pts[k], b = r.pts[k + 1], F = viSegFoot([x, z], a, b), l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (!best || F.d < best.d) best = { ri, s: s + F.t * l, d: F.d, x: F.x, z: F.z, len: 0 }; s += l; }
      if (best && best.ri === ri) best.len = s; });
    return best;
  };
  let comp = null;
  if (opts.from) { const n = nearest(opts.from[0], opts.from[1]); if (n) comp = compOf[n.ri]; }
  const maxOff = opts.maxOff ?? 600;
  const targets = [];
  for (const a of opts.aerodromes || []) targets.push({ id: a.id, name: a.name || a.id, x: a.stand ? a.stand.x : a.x, z: a.stand ? a.stand.z : a.z, kind: 'field' });
  for (const s of opts.sites || []) targets.push({ id: s.id, name: s.name || s.id, x: s.x, z: s.z, kind: s.kind || 'site' });
  for (const T of targets) {
    const n = nearest(T.x, T.z, comp);
    if (!n || n.d > maxOff) { placeRep.push({ id: T.id, name: T.name, ok: false, off: n ? +n.d.toFixed(0) : null }); continue; }
    // a stop at least 6 m in from a road's end (the stop is ON the road, its end may be a dead end)
    const s = Math.max(Math.min(6, n.len / 2), Math.min(n.s, n.len - Math.min(6, n.len / 2)));
    places.push({ id: T.id, name: T.name, road: n.ri, s, kind: 'stop', side: 1, target: [T.x, T.z], off: +n.d.toFixed(1), what: T.kind });
    placeRep.push({ id: T.id, name: T.name, ok: true, off: +n.d.toFixed(0), road: roads[n.ri].road });
  }
  const comps = new Map(); roads.forEach((r, i) => { const c = compOf[i]; let o = comps.get(c); if (!o) comps.set(c, o = { roads: new Set(), len: 0 }); o.roads.add(r.road); for (let k = 1; k < r.pts.length; k++) o.len += Math.hypot(r.pts[k][0] - r.pts[k - 1][0], r.pts[k][1] - r.pts[k - 1][1]); });
  return { spec: { roads, places }, report: { joins, skipped, rebuilt, places: placeRep, comp, comps: Array.from(comps.entries()).map(([c, o]) => ({ c, roads: o.roads.size, km: +(o.len / 1000).toFixed(2) })).sort((p, q) => q.km - p.km) } };
}

if (typeof module !== 'undefined') module.exports = { vehIslandSpec, viCross, viSegFoot };
