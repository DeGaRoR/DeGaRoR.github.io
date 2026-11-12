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
  // 1b. THE AIRFIELDS (TOW-LAUNCH phase 2, 12 Nov: "cars on RUNWAYS, including going FROM A ROAD ONTO A RUNWAY (an apron or a
  //     taxiway as the link)"). Vehicle-side, no scenery: each runway (opts.runways: { id, name, x, z, hdg, len, wid, surface,
  //     stand?, taxiOut?, taxiOut1? } - the aerodrome and its site, 25_airfield) is a road down its CENTRELINE, end to end;
  //     each of its taxi routes (the aeroplane's own: the stand to the runway) a road from the stand along it, its end joined
  //     where it meets the centreline (the T's below); the stand LINKED to the nearest road over drivable ground (opts.ground
  //     (x, z) -> true: grass, gravel, paved, sand - no water, rock, forest) within opts.linkMax (300 m). Every runway end a
  //     destination: '<field> · runway <n>' (the number its end gives an aeroplane rolling from it, off the name's pair)
  const AF = [], links = [];
  const mkRoad = (id, pts, w, cls, surface) => { E.push({ id, road: id, a: id + ':a', b: id + ':b', w, cls, surface, pts: pts.map(q => [q[0], q[1]]), ins: [] }); return E[E.length - 1]; };
  for (const R of opts.runways || []) {
    if (!(R.len > 0) || !(R.wid > 0)) continue;
    const d = [Math.cos(R.hdg), Math.sin(R.hdg)], hl = R.len / 2, e0 = [R.x - d[0] * hl, R.z - d[1] * hl], e1 = [R.x + d[0] * hl, R.z + d[1] * hl];
    const n = Math.max(2, Math.ceil(R.len / 25)), pts = [];
    for (let i = 0; i <= n; i++) pts.push([e0[0] + (e1[0] - e0[0]) * i / n, e0[1] + (e1[1] - e0[1]) * i / n]);
    const rw = mkRoad('rwy:' + R.id, pts, R.wid, 'runway', R.surface);
    const taxis = [];
    for (const [k, T] of [['0', R.taxiOut], ['1', R.taxiOut1]]) {
      if (!Array.isArray(T) || !T.length) continue;
      const P = (R.stand ? [[R.stand.x, R.stand.z]] : []).concat(T.map(q => [q[0], q[1]]));
      if (P.length >= 2) taxis.push(mkRoad('taxi:' + R.id + ':' + k, P, opts.taxiW || 12, 'taxiway', 5));
    }
    AF.push({ R, d, e0, e1, rw, taxis });
  }
  // the stands' links: the nearest point of a road that is not an airfield's own, the straight way there all drivable
  const linkMax = opts.linkMax ?? 300, ground = opts.ground || (() => true);
  for (const A of AF) {
    const S = A.R.stand; if (!S || !A.taxis.length) continue;
    let best = null;
    for (const e of E) { if (e.cls === 'runway' || e.cls === 'taxiway' || e.cls === 'link') continue;
      for (let k = 0; k + 1 < e.pts.length; k++) { const F = viSegFoot([S.x, S.z], e.pts[k], e.pts[k + 1]); if (F.d <= linkMax && (!best || F.d < best.F.d)) best = { e, k, F }; } }
    if (!best) { links.push({ id: A.R.id, ok: false, why: 'no road within ' + linkMax + ' m' }); continue; }
    const L = best.F.d, nS = Math.max(1, Math.ceil(L / 2)); let ok = true;
    for (let i = 0; i <= nS && ok; i++) ok = !!ground(S.x + (best.F.x - S.x) * i / nS, S.z + (best.F.z - S.z) * i / nS);
    if (!ok) { links.push({ id: A.R.id, ok: false, why: 'the way to ' + best.e.road + ' (' + L.toFixed(0) + ' m) is not drivable ground' }); continue; }
    const P = [+best.F.x.toFixed(3), +best.F.z.toFixed(3)];
    if (best.F.t > 1e-6 && best.F.t < 1 - 1e-6) best.e.ins.push({ k: best.k, t: best.F.t, p: P });
    else { const q = best.F.t <= 1e-6 ? best.e.pts[best.k] : best.e.pts[best.k + 1]; P[0] = q[0]; P[1] = q[1]; }
    if (L > 0.5) mkRoad('link:' + A.R.id, [[S.x, S.z], P], 8, 'link', 5);
    links.push({ id: A.R.id, ok: true, to: best.e.road, m: +L.toFixed(1) });
  }
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
    const L = []; for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const c = grid.get(key(Math.floor(p[0] / CELL) + di, Math.floor(p[1] / CELL) + dj)); if (c) for (const v of c) L.push(v); }   // (the 3 x 3 cells: a target across a cell's edge)
    for (let q = 0; q < L.length; q += 2) {
      const f = E[L[q]]; if (f === e || f.road === e.road) continue;
      const m = L[q + 1], F = viSegFoot(p, f.pts[m], f.pts[m + 1]);
      // (a runway's end on another runway's pavement - 02/20's north end 13.6 m off 13/31's centreline: the half width)
      const tol = e.cls === 'runway' && f.cls === 'runway' ? Math.max(tTol, f.w / 2) : tTol;
      if (F.d <= tol && (!best || F.d < best.F.d)) best = { f, m, F };
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
  // 5b. THE STEEP STRETCHES (TOW-LAUNCH phase 2): where the ground along a road climbs more than opts.maxGrade (0.45) over
  //     6 m, that stretch is CLOSED to the router (`closed`: [[s0, s1], ...] metres along the road) - r40, the Fishing
  //     Village strip's approach, meets the strip's terrace at a 5 m bank (68 %): driven into, it stopped the car dead. Only
  //     with opts.height (x, z) -> the composed ground; a road's grade elsewhere is the driver's (vehProfile) as ever
  const closedRep = [];
  if (typeof opts.height === 'function') {
    const gmax = opts.maxGrade ?? 0.45;
    for (const r of roads) {
      const S = [];   // samples every 2 m: [s, x, z, h]
      let s0 = 0;
      for (let k = 0; k + 1 < r.pts.length; k++) {
        const a = r.pts[k], b = r.pts[k + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(l / 2));
        for (let i = k ? 1 : 0; i <= n; i++) { const x = a[0] + (b[0] - a[0]) * i / n, z = a[1] + (b[1] - a[1]) * i / n; S.push([s0 + l * i / n, x, z, opts.height(x, z)]); }
        s0 += l;
      }
      const cl = [];
      for (let i = 0, j = 0; i < S.length; i++) {
        while (j < S.length && S[j][0] - S[i][0] < 6) j++;
        if (j >= S.length) break;
        if (Math.abs(S[j][3] - S[i][3]) / (S[j][0] - S[i][0]) > gmax) { const L = cl[cl.length - 1]; if (L && S[i][0] <= L[1] + 2) L[1] = S[j][0]; else cl.push([S[i][0], S[j][0]]); }
      }
      if (cl.length) { r.closed = cl.map(c => [+c[0].toFixed(1), +c[1].toFixed(1)]); closedRep.push({ road: r.road, at: r.closed }); }
    }
  }
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
  // the runway ends: '<field> · runway <n>', 40 m in from each end (the threshold's piano keys), on the runway's road
  const rwyPlaces = [];
  for (const A of AF) {
    const ri = roads.findIndex(r => r.id === A.rw.id); if (ri < 0 || (comp != null && compOf[ri] !== comp)) continue;
    let L = 0; for (let k = 1; k < roads[ri].pts.length; k++) L += Math.hypot(roads[ri].pts[k][0] - roads[ri].pts[k - 1][0], roads[ri].pts[k][1] - roads[ri].pts[k - 1][1]);
    const brg = (Math.atan2(A.d[0], -A.d[1]) * 180 / Math.PI + 360) % 360, num = b => { let v = Math.round(b / 10) % 36; return v === 0 ? 36 : v; };
    const m = /(\d{1,2})[LRC]?\s*\/\s*(\d{1,2})[LRC]?/.exec(A.R.name || ''), n0 = num(brg), n1 = num(brg + 180);
    let w0 = String(n0).padStart(2, '0'), w1 = String(n1).padStart(2, '0');
    if (m) { const a = +m[1], b = +m[2], da = Math.min(Math.abs(a - n0), 36 - Math.abs(a - n0)), db = Math.min(Math.abs(b - n0), 36 - Math.abs(b - n0)); w0 = da <= db ? m[1] : m[2]; w1 = da <= db ? m[2] : m[1]; }
    const inset = Math.min(40, L / 4), base = A.R.name || A.R.id;
    for (const [end, s_, w] of [[0, inset, w0], [1, L - inset, w1]]) {
      const id = 'rwy:' + A.R.id + ':' + end;
      places.push({ id, name: base + ' · runway ' + w, road: ri, s: s_, kind: 'stop', side: 1, what: 'runway', field: A.R.id, end });
      rwyPlaces.push({ id, name: base + ' · runway ' + w });
    }
  }
  const comps = new Map(); roads.forEach((r, i) => { const c = compOf[i]; let o = comps.get(c); if (!o) comps.set(c, o = { roads: new Set(), len: 0 }); o.roads.add(r.road); for (let k = 1; k < r.pts.length; k++) o.len += Math.hypot(r.pts[k][0] - r.pts[k - 1][0], r.pts[k][1] - r.pts[k - 1][1]); });
  return { spec: { roads, places }, report: { joins, skipped, rebuilt, links, closed: closedRep, runways: rwyPlaces, places: placeRep, comp, comps: Array.from(comps.entries()).map(([c, o]) => ({ c, roads: o.roads.size, km: +(o.len / 1000).toFixed(2) })).sort((p, q) => q.km - p.km) } };
}

// THE ONE RECIPE (the gate, the page): a world (makeWorld with premises) -> the island's spec, its runways and taxi routes, the
// fields and the town, the ground the stands' links may cross, the height the steep stretches are read off.
// h: { siteOf, fieldName (the core's), town: { id, site, name } (the town hall's site id), from: [x, z] (where the vehicle
// starts: the places on its network) }
const VI_DRIVABLE = { 0: 1, 5: 1, 6: 1, 7: 1 };   // the world's SURFACE: grass, paved, gravel, sand (not rock, scree, forest, water)
// THE CAR'S OWN PLACES (the user, 13 Nov via A0: "a few CAR-ONLY destinations"): places a car goes and an aeroplane does
// not - each from the premises record (a site's `at`, or a zone's centre), by id, so a record without one simply has no such
// place; a stop on the vehicle's road network like the town's (600 m off a road at most, else reported, not listed)
const VI_CAR_PLACES = [
  { id: 'car:harbour', site: 'mk_harbormaster', name: 'Cedar Harbour harbour front' },
  { id: 'car:village', zone: 'z_village', name: 'the village' },
  { id: 'car:tramway', site: 'tw_s_valley', name: 'Skyline Tramway valley station' },   // (Copperhead Mine: its streets are a network of their own - no road to it from the rest of the island, 9.1 km off one)
  { id: 'car:cannery', site: 's7', name: 'the cannery at Cannery Runway' },
];
function viCarSites(rec) {
  const L = (rec && rec.layers) || {}, out = [];
  for (const C of VI_CAR_PLACES) {
    if (C.site) { const s = (L.sites || []).find(q => q.id === C.site); if (s && s.at) out.push({ id: C.id, name: C.name, x: s.at.x, z: s.at.z, kind: 'car' }); }
    else if (C.zone) { const z = (L.zones || []).find(q => q.id === C.zone), P = z && z.poly; if (P && P.length) { let x = 0, y = 0; for (const q of P) { x += q.x ?? q[0]; y += q.z ?? q.y ?? q[1]; } out.push({ id: C.id, name: C.name, x: x / P.length, z: y / P.length, kind: 'car' }); } }
  }
  return out;
}
function vehIslandFromWorld(world, h) {
  const P = world.premises, O = P && P.overlay;
  if (!O || typeof O.roadGraph !== 'function') return null;
  const site = id => (typeof h.siteOf === 'function' ? h.siteOf(id) : null) || {};
  const nm = (id, n) => (typeof h.fieldName === 'function' ? h.fieldName(id, n) : n);
  const aero = (world.aerodromes || []).filter(a => a.kind !== 'meadow').map(a => ({ id: a.id, name: nm(a.id, a.name), x: a.x, z: a.z, stand: site(a.id).stand }));
  const runways = (world.aerodromes || []).filter(a => a.kind === 'strip' && a.surface !== 4 && a.len > 0)
    .map(a => { const s = site(a.id); return { id: a.id, name: nm(a.id, a.name), x: a.x, z: a.z, hdg: a.hdg, len: a.len, wid: a.wid, surface: a.surface, stand: s.stand, taxiOut: s.taxiOut, taxiOut1: s.taxiOut1 }; });
  const sites = [];
  const T = h.town; if (T) { const hall = ((P.rec && P.rec.layers && P.rec.layers.sites) || []).find(s => s.id === T.site); if (hall && hall.at) sites.push({ id: T.id, name: T.name, x: hall.at.x, z: hall.at.z, kind: 'town' }); }
  if (h.carPlaces !== false) for (const c of viCarSites(P.rec)) sites.push(c);
  const RG = O.roadGraph();
  const I = vehIslandSpec(RG, { rec: P.rec, toWorld: (x, z) => O.frame.toWorld(x, z), aerodromes: aero, sites, from: h.from, runways,
    ground: (x, z) => !!VI_DRIVABLE[world.surface(x, z)], height: (x, z) => world.terrainH(x, z), joinCrossings: h.joinCrossings, tTol: h.tTol });
  I.RG = RG; I.aero = aero;
  return I;
}

if (typeof module !== 'undefined') module.exports = { vehIslandSpec, vehIslandFromWorld, viCross, viSegFoot, VI_CAR_PLACES, viCarSites };
