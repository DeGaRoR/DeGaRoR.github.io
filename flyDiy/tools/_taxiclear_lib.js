// _taxiclear_lib.js - THE TAXI CENSUS (MILL-TAXI, G1925-G1929): every stand and every taxi route against every
// solid thing on the ground, for GATE TAXICLEAR (tools/_taxiclear_check.js) and tools/taxi_census.js.
//
// The user (2026-10-05): "In the old mill, the taxi circuit is too close from buildings, and an attempt to launch from
// there hits a building on the right." The ways out were checked against the PARKED AEROPLANES only (G710); nothing
// held a route off a house. This file is the other half: what the game registers as solid near a route
// (render_premises.js hitAdd), read off what is SHIPPED, so the census measures what the player rolls past:
//   house / item / outbuilding  the cooked places (premises_cook.js cookPlaces: src/core/premises_packs.json, the
//                               media/world/<id>/premises/p_*.bin cells) carry each one's OBSTACLE GRID - the very
//                               lo / hi columns the page rasterises from the build's bags (GATE PREMCOOK holds the
//                               cook to the page) - at `at` (x, y, z, yaw = the group's rotation.y)
//   its props                   people, yard props, lamps (propsOfBuilt): in the page they ride in the house's group
//                               and so in its raster; here each is its prop's own bounding box (PROP_REG bb) in the
//                               owner's frame
//   cars, boats, lot cars       the dressing plan's (placeDress: hitAdd 'car' / 'boat'), their prop's box
//   objects                     a placed prop (its box), a parked aeroplane (GP_PARKED_FOOT, the planner's own box),
//                               a billboard (its width x 0.6 m)
//   trees                       the premises' own trees as TREE_HITS trunks (29_obstacles.js trunkOf's radius rule);
//                               the forest fill keeps off a strip's clearing and its pavement by construction
//                               (GATE RWYTREES), and lives in the page only
//   settlements                 the analytic world's settlement boxes (20_world.js, tag 'settle') - the procedural
//                               world has no premises
// A FOOTPRINT is plan view. Every solid thing counts whatever its height (a wing rides over a crate, a propeller and a
// wheel do not; the margin is the user's 3 m, not a height rule).
//
// THE RULE (the brief): the centreline of every route the pilot can be given (patternPath, fillets and all, the same
// sampler THE PILOT follows) keeps HALF + MARGIN off every footprint - HALF the widest validated build's half-span
// (the aluminium C172, 11 m), MARGIN 3 m; the stand's parked position the same. The runway's own roll is reported
// beside it (its clearing is the strip's - premises rwyClearances), not held to it.
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const MARGIN = 3.0;

// ---- the props' boxes (bb: x0 y0 z0 x1 y1 z1 in the prop's frame) -----------------------------------------------
let PROPBB = null;
function propBoxes(C) {
  if (PROPBB) return PROPBB;
  PROPBB = new Map();
  const reg = C.PROP_REG;
  if (!reg || !Object.keys(reg.props || {}).length) {
    const sb = { registerPropPack: C.registerPropPack, console };
    vm.createContext(sb);
    for (const dir of ['props', 'pier']) {
      const list = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', dir, dir + '_packs.json'), 'utf8'));
      for (const f of list) vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', dir, f), 'utf8'), sb, { filename: f });
    }
  }
  for (const k of Object.keys(C.PROP_REG.props)) { const p = C.PROP_REG.props[k]; if (p.bb) PROPBB.set(k, p.bb); }
  return PROPBB;
}

// ---- the shapes ----------------------------------------------------------------------------------------------------
// every shape: { id, tag, x, z, yaw, r (bounding radius about x, z), dist(px, pz) -> signed plan distance (< 0 inside) }
// the frame: world = R(yaw) local, wx = lx c + lz s, wz = -lx s + lz c (29_obstacles.js penetration)
const toLocal = (o, px, pz) => { const dx = px - o.x, dz = pz - o.z; return [dx * o.c - dz * o.s, dx * o.s + dz * o.c]; };
function gridShape(id, tag, at, S) {
  // S: the cook's { cell, ox, oz, nx, nz, lo, hi } in mm (null: an empty column)
  const cells = [];
  for (let j = 0; j < S.nz; j++) for (let i = 0; i < S.nx; i++) {
    const k = j * S.nx + i, lo = S.lo[k], hi = S.hi[k];
    if (lo === null || hi === null || hi < lo) continue;
    cells.push(S.ox + i * S.cell, S.oz + j * S.cell);
  }
  if (!cells.length) return null;
  const o = { id, tag, x: at[0], z: at[2], yaw: at[3], c: Math.cos(at[3]), s: Math.sin(at[3]), top: S.top / 1000, cells, cell: S.cell, y0: at[1], raw: S };
  let r = 0;
  for (let n = 0; n < cells.length; n += 2) for (const ax of [0, S.cell]) for (const az of [0, S.cell]) r = Math.max(r, Math.hypot(cells[n] + ax, cells[n + 1] + az));
  o.r = r;
  o.dist = (px, pz) => {
    const L = toLocal(o, px, pz), cs = o.cell;
    let best = Infinity, inside = false;
    for (let n = 0; n < cells.length; n += 2) {
      const x0 = cells[n], z0 = cells[n + 1];
      const ex = Math.max(x0 - L[0], L[0] - x0 - cs, 0), ez = Math.max(z0 - L[1], L[1] - z0 - cs, 0);
      if (!ex && !ez) { inside = true; break; }
      const d = ex * ex + ez * ez; if (d < best) best = d;
    }
    return inside ? -0.01 : Math.sqrt(best);
  };
  return o;
}
function boxShape(id, tag, x, z, yaw, x0, z0, x1, z1, top, y0, ylo) {
  const o = { id, tag, x, z, yaw, c: Math.cos(yaw), s: Math.sin(yaw), top: top || 0, box: [x0, z0, x1, z1], y0: y0, ylo: ylo || 0 };
  o.r = Math.max(Math.hypot(x0, z0), Math.hypot(x1, z0), Math.hypot(x0, z1), Math.hypot(x1, z1));
  o.dist = (px, pz) => {
    const L = toLocal(o, px, pz);
    const ex = Math.max(x0 - L[0], L[0] - x1, 0), ez = Math.max(z0 - L[1], L[1] - z1, 0);
    if (ex || ez) return Math.hypot(ex, ez);
    return -Math.min(L[0] - x0, x1 - L[0], L[1] - z0, z1 - L[1]);
  };
  return o;
}
function discShape(id, tag, x, z, rad, top, y0) {
  return { id, tag, x, z, yaw: 0, r: rad, top: top || 0, y0, disc: rad, dist: (px, pz) => Math.hypot(px - x, pz - z) - rad };
}
// a prop at (x, z, ry) in a frame (fx, fz, fyaw): its bb carried into the world
// y: the prop's foot in the world (the owner's y + its own)
function propShape(BB, id, tag, key, fx, fz, fyaw, x, z, ry, y) {
  const bb = BB.get(key);
  const c = Math.cos(fyaw), s = Math.sin(fyaw);
  const wx = fx + x * c + z * s, wz = fz - x * s + z * c;
  if (!bb) return discShape(id, tag + '?', wx, wz, 0.6, 1.8, y);   // a key with no box: a person's 0.6 m
  return boxShape(id, tag, wx, wz, fyaw + (ry || 0), bb[0], bb[2], bb[3], bb[5], bb[4], y, bb[1]);
}

// ---- the island's solid things, off the shipped cook ---------------------------------------------------------------
// variant: 'town' (Metlakatla on - the page's default since G1408) or 'default'
function islandObstacles(C, id, variant, opt) {
  const BB = propBoxes(C);
  const pk = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'core', 'premises_packs.json'), 'utf8')).islands.find(i => i.id === id);
  if (!pk) throw new Error('taxiclear: no cooked places for island ' + id);
  const V = pk.places.variants[variant || 'town'];
  const things = [];
  for (const c of V.cells) {
    const buf = fs.readFileSync(path.join(ROOT, ...c.src.split('/')));
    for (const t of JSON.parse(zlib.gunzipSync(buf)).things) things.push(t);
  }
  return obstaclesOfThings(C, things, BB, opt);
}
function obstaclesOfThings(C, things, BB, opt) {
  const out = [];
  const push = s => { if (s) out.push(s); };
  const props = (owner, at, list) => { (list || []).forEach((p, n) => push(propShape(BB, owner + '#' + p.k + n, 'prop', p.k, at[0], at[2], at[3], p.x, p.z, p.ry, at[1] + (p.y || 0)))); };
  const dressing = (owner, P) => {
    if (!P) return;
    const cars = [P.car, P.boat].concat(P.lot && P.lot.cars ? P.lot.cars : []);
    cars.forEach((cr, n) => { if (cr && cr.key) push(propShape(BB, owner + '#car' + n, cr === P.boat ? 'boat' : 'car', cr.key, 0, 0, 0, cr.x, cr.z, cr.ry, cr.y || 0)); });
  };
  for (const t of things) {
    if (t.kind === 'house' || t.kind === 'item') {
      if (t.shape && t.at) push(gridShape(t.id, t.kind, t.at, t.shape));
      if (t.at) props(t.id, t.at, t.props);
      const P = t.kind === 'house' ? t.plot : t.plan;
      if (P && P.out && P.out.at && P.out.shape) { push(gridShape(t.id + '/out', 'outbuilding', P.out.at, P.out.shape)); props(t.id + '/out', P.out.at, P.out.props); }
      else if (P && P.out && P.out.shape && t.plan) {   // an item's outbuilding: the plan carries its shape, the page places it as a house
        const o = P.out; if (isFinite(o.x) && isFinite(o.z)) push(gridShape(t.id + '/out', 'outbuilding', [o.x, o.y || 0, o.z, o.yaw || 0], o.shape));
      }
      dressing(t.id, P);
    } else if (t.kind === 'object' && t.ob && t.at) {
      const ob = t.ob, at = t.at;
      if (ob.kind === 'prop') push(propShape(BB, t.id, 'prop', ob.key, at[0], at[2], at[3], 0, 0, 0, at[1]));
      else if (ob.kind === 'aircraft') {
        const f = C.parkedFoot ? C.parkedFoot(ob) : { half: 6, fwd: 1.6, aft: 6.6 };
        push(boxShape(t.id, 'aircraft', at[0], at[2], at[3], -f.aft, -f.half, f.fwd, f.half, 3, at[1]));
      } else if (ob.kind === 'billboard') push(boxShape(t.id, 'billboard', at[0], at[2], at[3], -(ob.w || 4) / 2, -0.3, (ob.w || 4) / 2, 0.3, 4, at[1]));
    }
  }
  return out;
}
// the premises' own trees (records.trees, world frame on Jolene): a trunk each, trunkOf's radius (2 % of the drawn
// height held to 0.3..0.6 m)
function treeTrunks(W) {
  const R = W.premises && W.premises.overlay && W.premises.overlay.records;
  const out = [];
  if (R && R.trees) R.trees.forEach((t, n) => { const h = t.h || 10; out.push(discShape('tree' + n, 'tree', t.x, t.z, Math.max(0.3, Math.min(0.6, 0.02 * h)), h, isFinite(t.y) ? t.y : W.terrainH(t.x, t.z))); });
  return out;
}
// the analytic world's settlement boxes, as its registry holds them (20_world.js)
function registryObstacles(W) {
  const out = [];
  if (!W.obstacles || !W.obstacles.list) return out;
  for (const r of W.obstacles.list()) {
    const S = r.shape, cells = [];
    for (let j = 0; j < S.nz; j++) for (let i = 0; i < S.nx; i++) { const k = j * S.nx + i; if (S.hi[k] >= S.lo[k]) cells.push(S.ox + i * S.cell, S.oz + j * S.cell); }
    // the registry's yaw IS the frame's (penetration's convention)
    const g = gridShape('reg' + r.id, r.tag || 'registry', [r.x, r.y0, r.z, r.yaw], { cell: S.cell, ox: S.ox, oz: S.oz, nx: S.nx, nz: S.nz, top: S.top * 1000,
      lo: Array.from(S.lo, v => (isFinite(v) ? v : null)), hi: Array.from(S.hi, v => (isFinite(v) ? v : null)) });
    if (g) out.push(g);
  }
  return out;
}

// ---- the index and the nearest thing ----------------------------------------------------------------------------------
function index(list) {
  const BIN = 32, bins = new Map(), key = (i, j) => i + ',' + j;
  let rMax = 0;
  for (const s of list) {
    rMax = Math.max(rMax, s.r);
    for (let i = Math.floor((s.x - s.r) / BIN); i <= Math.floor((s.x + s.r) / BIN); i++)
      for (let j = Math.floor((s.z - s.r) / BIN); j <= Math.floor((s.z + s.r) / BIN); j++) {
        const k = key(i, j); let b = bins.get(k); if (!b) bins.set(k, b = []); b.push(s);
      }
  }
  // the nearest footprint to (x, z) within `reach` m: { d, s } or null
  const nearest = (x, z, reach) => {
    let best = null;
    const seen = new Set();
    for (let i = Math.floor((x - reach) / BIN); i <= Math.floor((x + reach) / BIN); i++)
      for (let j = Math.floor((z - reach) / BIN); j <= Math.floor((z + reach) / BIN); j++) {
        const b = bins.get(key(i, j)); if (!b) continue;
        for (const s of b) {
          if (seen.has(s)) continue; seen.add(s);
          if (Math.hypot(s.x - x, s.z - z) - s.r > reach) continue;
          const d = s.dist(x, z);
          if (d <= reach && (!best || d < best.d)) best = { d, s };
        }
      }
    return best;
  };
  return { list, nearest };
}

// ---- the census ------------------------------------------------------------------------------------------------------
// the routes a stand's pattern hands the pilot: out[0], out[1] (the ways out), back[0], back[1] (the U-turns back to a
// hold after a landing), each sampled as the pilot's path; the stand's parked position; the runway's roll (reported)
function routesOf(C, P) {
  const R = [];
  for (const k of ['out', 'back']) for (const T of [0, 1]) {
    const ids = P.routes && P.routes[k] && P.routes[k][T];
    if (ids && ids.length >= 2) R.push({ name: k + '[' + T + ']', ids, pts: C.patternPath(P, ids, 1.0).pts });
  }
  return R;
}
// a site's census: { stand: {x, z, near}, routes: [{ name, worst: {d, x, z, s}, n }], roll } against `need`
function censusSite(C, I, a, P, need, opt) {
  const reach = need + 25, res = { id: a.id, name: a.name, routes: [], stand: null, roll: null };
  const st = P.nodes.find(n => n.kind === 'stand');
  if (st) { const n = I.nearest(st.x, st.z, reach); res.stand = { x: st.x, z: st.z, d: n ? n.d : Infinity, what: n ? n.s : null }; }
  for (const r of routesOf(C, P)) {
    let w = null, bad = 0;
    for (const q of r.pts) {
      const n = I.nearest(q.x, q.z, reach); const d = n ? n.d : Infinity;
      if (d < need) bad++;
      if (!w || d < w.d) w = { d, x: q.x, z: q.z, what: n ? n.s : null };
    }
    res.routes.push({ name: r.name, ids: r.ids, worst: w, bad, n: r.pts.length });
  }
  // the roll: threshold to threshold on the centreline
  if (P.runway && P.runway.c0 && P.runway.c1) {
    const A = P.runway.c0, B = P.runway.c1, L = Math.hypot(B.x - A.x, B.z - A.z);
    let w = null;
    for (let s = 0; s <= L; s += 1) {
      const x = A.x + (B.x - A.x) * s / L, z = A.z + (B.z - A.z) * s / L, n = I.nearest(x, z, reach), d = n ? n.d : Infinity;
      if (!w || d < w.d) w = { d, x, z, what: n ? n.s : null };
    }
    res.roll = w;
  }
  return res;
}
// ---- the same things IN THE WORLD, for a flight (the flown proof): within `R` m of (x, z), each shape into the world's
// registry as the page registers it - a building's grid as cooked (29_obstacles rasterise from the cook's columns, the
// distance field re-made), a prop / car / parked aeroplane as its box at 0.5 m cells - and the trees as trunks on
// world.treeHits (trunkOf's top, the narrow-conifer 0.8 H). -> { obstacles, trunks } added
function intoWorld(C, W, list, x, z, R) {
  const OB = C.OBSTACLES;
  let nO = 0; const trunks = [];
  for (const s of list) {
    if (Math.hypot(s.x - x, s.z - z) - s.r > R) continue;
    if (s.raw) {
      const S = s.raw, mm = a => Float32Array.from(a, (v, k) => (v === null ? NaN : v / 1000));
      const lo = mm(S.lo), hi = mm(S.hi);
      for (let k = 0; k < lo.length; k++) if (!(lo[k] <= hi[k])) { lo[k] = Infinity; hi[k] = -Infinity; }
      const shape = OB.rasterise([], null, S.cell, { base: { cell: S.cell, ox: S.ox, oz: S.oz, nx: S.nx, nz: S.nz, lo, hi } });
      if (shape) { W.obstacles.add({ x: s.x, z: s.z, yaw: s.yaw, y0: s.y0, shape, tag: s.tag }); nO++; }
    } else if (s.box) {
      const [x0, z0, x1, z1] = s.box, ya = s.ylo || 0, yb = Math.max(ya + 0.2, s.top);
      const P = [x0, ya, z0, x1, ya, z0, x1, ya, z1, x0, ya, z1, x0, yb, z0, x1, yb, z0, x1, yb, z1, x0, yb, z1];
      const I = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7];
      const shape = OB.rasterise(P, I, 0.5);
      if (shape) { W.obstacles.add({ x: s.x, z: s.z, yaw: s.yaw, y0: isFinite(s.y0) ? s.y0 : W.terrainH(s.x, s.z), shape, tag: s.tag }); nO++; }
    } else if (s.disc && s.tag === 'tree') {
      const y = isFinite(s.y0) ? s.y0 : W.terrainH(s.x, s.z);
      trunks.push(s.x, s.z, y, s.disc, y + 0.8 * s.top);
    }
  }
  if (trunks.length && W.treeHits) W.treeHits.set('taxiclear', trunks);
  return { obstacles: nO, trunks: trunks.length / 5 };
}
// the nodes of the aeroplane inside a registered obstacle (the solver's own test, 29_obstacles penetration per node)
function nodesInside(C, W, sim) {
  const OB = C.OBSTACLES, p = sim.p, near = [], pen = [0, 0, 0];
  let k = 0, what = null;
  const cg = sim.cgPos();
  W.obstacles.near(cg[0], cg[2], near);
  for (const id of near) {
    const r = W.obstacles.get(id), reach = r.shape.xr + 20;   // (no node is 20 m from the CG)
    if ((r.x - cg[0]) * (r.x - cg[0]) + (r.z - cg[2]) * (r.z - cg[2]) > reach * reach || cg[1] > r.y0 + r.shape.top + 20) continue;
    for (let i = 0; i < sim.n; i++) if (OB.penetration(r, p[i * 3], p[i * 3 + 1], p[i * 3 + 2], pen)) { k++; what = r.tag + '@' + r.x.toFixed(0) + ',' + r.z.toFixed(0); }
  }
  return { k, what };
}

// ---- the validated builds (the brief: the stock build, the aluminium C172 - 11 m, the widest - and the user's Cub) ----
const BUILDS = [
  { key: 'stock', name: 'stock build' },
  { key: path.join(__dirname, 'fixtures', 'build_v10_cessnaMetal_2026-09-26.json'), name: 'aluminium C172' },
  { key: path.join(ROOT, 'builds', 'cub_2026-09-20_corrected.json'), name: "the user's Cub" },
];
// a build's plan box off its own nodes (the parked footprint's rule, GP_PARKED_FOOT): half-span, nose + 0.3 m of
// propeller ahead of the frame's origin, the tail behind it
function buildDims(C, def) {
  let x0 = Infinity, x1 = -Infinity, zm = 0;
  for (const nd of def.nodes) { x0 = Math.min(x0, nd.p[0]); x1 = Math.max(x1, nd.p[0]); zm = Math.max(zm, Math.abs(nd.p[2])); }
  return { half: def.params.gen.span / 2, reach: zm, fwd: -x0 + 0.3, aft: x1 };
}
// the PARKED POSITION: the build's box at the stand, nose along the stand's heading (toward its first taxi point), its
// outline sampled every 0.25 m -> the nearest footprint to it ({ d, s, x, z })
function parkedClear(I, st, dims, reach) {
  const h = isFinite(st.hdg) ? st.hdg : 0, fx = Math.cos(h), fz = Math.sin(h), rx = -fz, rz = fx;
  const half = Math.max(dims.half, dims.reach), corners = [[dims.fwd, -half], [dims.fwd, half], [-dims.aft, half], [-dims.aft, -half]];
  let w = null;
  for (let k = 0; k < 4; k++) {
    const A = corners[k], B = corners[(k + 1) % 4], L = Math.hypot(B[0] - A[0], B[1] - A[1]), n = Math.max(1, Math.ceil(L / 0.25));
    for (let i = 0; i <= n; i++) {
      const u = A[0] + (B[0] - A[0]) * i / n, v = A[1] + (B[1] - A[1]) * i / n;
      const x = st.x + fx * u + rx * v, z = st.z + fz * u + rz * v, q = I.nearest(x, z, reach);
      const d = q ? q.d : Infinity;
      if (!w || d < w.d) w = { d, s: q ? q.s : null, x, z };
    }
  }
  return w;
}
// THE CENSUS of a world: every aerodrome with a pattern, for every build its own pattern (HOME's way bends per span,
// G710) - its stand, its parked box, its routes and its roll -> rows { id, build, what, d, need, ok, at, near }
function census(C, W, I, builds, opt) {
  const rows = [], margin = (opt && opt.margin) || MARGIN;
  for (const a of W.aerodromes) {
    const s = C.siteOf(a.id);
    for (const B of builds) {
      const P = C.sitePattern(a, s || null, { half: B.dims.half });
      if (!P || !P.nodes || !P.nodes.length) continue;
      const need = B.dims.half + margin, r = censusSite(C, I, a, P, need);
      const row = (what, d, at, what2, hold) => rows.push({ id: a.id, name: a.name, build: B.name, what, d, need: hold === false ? null : need, ok: hold === false || d >= need - 1e-9, at, near: what2 ? fmtWhat(what2) : 'nothing' });
      if (r.stand) {
        row('stand', r.stand.d, [r.stand.x, r.stand.z], r.stand.what);
        const st = P.nodes.find(q => q.kind === 'stand'), fst = P.routes.out[0] && P.nodes.find(q => q.id === P.routes.out[0][1]);
        const hdg = st && fst ? Math.atan2(fst.z - st.z, fst.x - st.x) : (st && st.hdg);
        if (st && (!a.spawn || (s && s.stand))) {
          const pc = parkedClear(I, { x: st.x, z: st.z, hdg }, B.dims, margin + 25);
          rows.push({ id: a.id, name: a.name, build: B.name, what: 'parked box', d: pc.d, need: margin, ok: pc.d >= margin - 1e-9, at: [pc.x, pc.z], near: fmtWhat(pc.s) });
        }
      }
      for (const q of r.routes) row('route ' + q.name, q.worst.d, [q.worst.x, q.worst.z], q.worst.what);
      if (r.roll) row('the roll (reported)', r.roll.d, [r.roll.x, r.roll.z], r.roll.what, false);
    }
  }
  return rows;
}
// THE FLOWN PROOF: THE PILOT from a stand to 30 m above the ground (the taxi, the line-up, the roll, the lift-off) with
// the obstacles in the world (intoWorld) - the wing's plan clearance to the nearest footprint every `every` steps (the
// span line, CG +- the half-span along the right axis), the nodes inside a registered obstacle (the solver's test),
// the trunk contacts (sim.trunkHits) and the damage's verdict
function flyOut(C, W, I, def, a, s, opt) {
  const o = opt || {}, every = o.every || 6, half = def.params.gen.span / 2;
  const sim = C.makeSim(def, W); sim.reset(0); if (sim.stance) sim.stance(); C.placeAtStand(sim, a, s.stand);
  let contacts = 0, cWhat = null;
  for (let i = 0; i < 600; i++) { sim.step(1 / 60); if (i % 60 === 0) { const q = nodesInside(C, W, sim); contacts += q.k; if (q.k) cWhat = q.what + ' parked'; } }
  const ap = C.makePilot(sim, def, W, { style: 'normal' }); ap.setRoute(a, a); ap.departFrom(a, a, s);
  let t = 0, minW = Infinity, at = null, air = false, phases = [], track = [];
  const tMax = o.tMax || 360;
  for (let k = 0; k < 60 * tMax && !air; k++) {
    ap.update(1 / 60); sim.step(1 / 60); t += 1 / 60;
    if (phases[phases.length - 1] !== ap.phase) phases.push(ap.phase);
    if (k % every) continue;
    const cg = sim.cgPos(), zR = sim.axes()[2], rl = Math.hypot(zR[0], zR[2]) || 1;
    if (k % 30 === 0) track.push([+cg[0].toFixed(2), +cg[2].toFixed(2), ap.phase]);
    for (let f = -1; f <= 1.0001; f += 0.1) {
      const x = cg[0] + zR[0] / rl * half * f, z = cg[2] + zR[2] / rl * half * f, n = I.nearest(x, z, 20);
      if (n && n.d < minW) { minW = n.d; at = fmtWhat(n.s) + ' at (' + cg[0].toFixed(1) + ', ' + cg[2].toFixed(1) + ') in ' + ap.phase + ', t ' + t.toFixed(0) + ' s'; }
    }
    const q = nodesInside(C, W, sim); if (q.k) { contacts += q.k; cWhat = q.what + ' in ' + ap.phase; }
    air = cg[1] - W.terrainH(cg[0], cg[2]) > 30;
  }
  const D = sim.damage ? sim.damage() : null;
  return { air, t, phases, minWing: minW, at, contacts, cWhat, trunkHits: sim.trunkHits ? sim.trunkHits() : 0, crashed: !!(D && D.crashed), track, span: 2 * half };
}
const fmtWhat = s => (s ? s.tag + ' ' + s.id : 'nothing');

// ---- THE TURN-AROUND FROM WHERE A LANDING STOPPED (G2490, ALTIPORT-TAXI) ------------------------------------------------
// the aeroplane standing on the strip at `pose` { x, z, hdg (the nose, atan2(z, x)) }, the wheels seated on the ground
// under them (the page's placement: no settling steps), THE PILOT given the chained leg the page gives it (app.js nextLeg:
// a fresh pilot, departFrom(a, b), no site) - flown to 30 m up with the obstacles in the world, measured as flyOut does.
// opt.blindPilot: the pilot's world has an EMPTY obstacle registry (the solver's keeps them all) - the planner as it was
// before G2490 saw nothing there either: the calibration
function placeAt(C, W, def, pose) {
  const sim = C.makeSim(def, W); sim.reset(0); if (sim.stance) sim.stance();
  C.placeAtAerodrome(sim, { hdg: pose.hdg, spawn: [pose.x, pose.z], elev: W.terrainH(pose.x, pose.z) });
  if (C.seatOnGround) C.seatOnGround(sim, (x, z) => W.terrainH(x, z), def.refs);
  return sim;
}
function flyTurn(C, W, I, def, a, b, pose, opt) {
  const o = opt || {}, half = def.params.gen.span / 2;
  const sim = placeAt(C, W, def, pose);
  const PW = o.blindPilot ? Object.create(W, { obstacles: { value: C.OBSTACLES.make() } }) : W;
  const ap = C.makePilot(sim, def, PW, { style: 'normal' }); ap.departFrom(a, b);
  let t = 0, minW = Infinity, at = null, air = false, contacts = 0, cWhat = null, crashed = false;
  const phases = [], track = [], tMax = o.tMax || 240;
  for (let k = 0; k < 60 * tMax && !air; k++) {
    ap.update(1 / 60); sim.step(1 / 60); t += 1 / 60;
    if (phases[phases.length - 1] !== ap.phase) phases.push(ap.phase);
    const D = sim.damage ? sim.damage() : null;
    if (D && (D.over || D.crashed)) { crashed = true; break; }
    if (k % 6) continue;
    const cg = sim.cgPos(), zR = sim.axes()[2], rl = Math.hypot(zR[0], zR[2]) || 1;
    if (k % 30 === 0) track.push([+cg[0].toFixed(2), +cg[2].toFixed(2), ap.phase]);
    for (let f = -1; f <= 1.0001; f += 0.1) {
      const x = cg[0] + zR[0] / rl * half * f, z = cg[2] + zR[2] / rl * half * f, n = I.nearest(x, z, 20);
      if (n && n.d < minW) { minW = n.d; at = fmtWhat(n.s) + ' at (' + cg[0].toFixed(1) + ', ' + cg[2].toFixed(1) + ') in ' + ap.phase + ', t ' + t.toFixed(0) + ' s'; }
    }
    const q = nodesInside(C, W, sim); if (q.k) { contacts += q.k; cWhat = q.what + ' in ' + ap.phase; }
    air = cg[1] - W.terrainH(cg[0], cg[2]) > 30;
  }
  const D = sim.damage ? sim.damage() : null;
  return { air, t, phases, minWing: minW, at, contacts, cWhat, trunkHits: sim.trunkHits ? sim.trunkHits() : 0, crashed: crashed || !!(D && D.crashed),
           track, span: 2 * half, verdicts: ap.report.verdicts.map(v => v.code + (v.note ? ': ' + v.note : '')) };
}
// THE PLAN at a pose (DEPART's one step: planDeparture) and its clearances, measured on the census's own footprints (`I`,
// not the pilot's registry): every path the plan hands the follower (the roll on to the turn's spot first, if any) - its
// CG track's least distance to a footprint (the drawn line: the census's rule, half-span + MARGIN); a kept route's bends
// tighter than the wheels steer widened by the shortfall (groundRmin - the bend's radius, a radius before and two after:
// the driven line); the turn on the spot's disc (the airframe's reach about the CG + its walk, 2.6 m / a tricycle's 4.5 m)
// -> { phase, ids, turn, drawn: { d, what }, driven: { d, what, need }, disc: { d, what, need } | null, verdicts }
function planAt(C, W, I, def, a, b, pose, opt) {
  const o = opt || {}, half = def.params.gen.span / 2;
  const sim = placeAt(C, W, def, pose);
  const PW = o.blindPilot ? Object.create(W, { obstacles: { value: C.OBSTACLES.make() } }) : W;
  const ap = C.makePilot(sim, def, PW, { style: 'normal' }); ap.departFrom(a, b); ap.update(1 / 60);
  const Rg = C.groundRmin(def, 0.85), TP = ap.pivAt || null, turn = !!(TP && TP.turn);
  const paths = turn ? [TP.first, TP.then].filter(Boolean) : (ap.path ? [ap.path] : []);
  const res = { phase: ap.phase, ids: paths.map(p => p.ids.join('>')).join(' | '), turn, roll: turn && TP.first ? TP.first.len : 0, drawn: { d: Infinity, what: null }, driven: { d: Infinity, what: null }, disc: null,
                verdicts: ap.report.verdicts.map(v => v.code) };
  for (const P of paths) {
    const pts = P.pts, tight = [];
    for (let k = 0; k < pts.length; k++) if (Math.abs(pts[k].kap) > 1 / Rg) tight.push(k);
    for (let k = 0; k < pts.length; k++) {
      const q = pts[k], n = I.nearest(q.x, q.z, half + 30), d = n ? n.d : Infinity;
      let sw = 0;
      if (!turn) for (const j of tight) if (q.s >= pts[j].s - Rg && q.s <= pts[j].s + 2 * Rg) sw = Math.max(sw, Rg - 1 / Math.abs(pts[j].kap));
      if (d - half < res.drawn.d) res.drawn = { d: d - half, what: n ? fmtWhat(n.s) : null, x: q.x, z: q.z };
      if (d - half - sw < res.driven.d) res.driven = { d: d - half - sw, what: n ? fmtWhat(n.s) : null, x: q.x, z: q.z };
    }
  }
  if (turn) {
    const cg = sim.cgPos();
    const L = TP.first ? TP.first.pts[TP.first.pts.length - 1] : { x: cg[0], z: cg[2] };   // (the turn is about the CG, not the frame's origin)
    let reach = 0; for (let i = 0; i < sim.n; i++) reach = Math.max(reach, Math.hypot(sim.p[i * 3] - cg[0], sim.p[i * 3 + 2] - cg[2]));
    const need = reach + ((def.params.twSteer || 0.5) < 0 ? 4.5 : 2.6);
    const n = I.nearest(L.x, L.z, need + 30), d = n ? n.d : Infinity;
    res.disc = { d: d - need, what: n ? fmtWhat(n.s) : null, need, x: L.x, z: L.z };
  }
  return res;
}

// ---- THE FLEET'S TIE-DOWN SPOTS (G2223, FLEET-PROPS A) held to the census's own rules, independently of the planner -----
// the record's stand polygons in the world frame (what 25_airfield.js fleetSpots reads as opts.pave)
function paveOf(W) {
  const O = W.premises && W.premises.overlay;
  if (!O || !O.pavePolys) return [];
  return O.pavePolys.filter(p => p.stands).map(p => ({ id: p.id, poly: p.poly.map(q => { const w = O.frame.toWorld(q[0], q[1]); return Array.isArray(w) ? [w[0], w[1]] : [w.x, w.z]; }),
    yaw: (p.yaw || 0) + (O.frame.yaw || 0), stands: p.stands }));
}
// the planner's inputs off the census's world: the solid things (the index), the ground, the water
function spotInputs(W, I, pave) {
  const wl = typeof W.waterH === 'function' ? W.waterH : null;
  return { pave, solid: (x, z, reach) => { const n = I.nearest(x, z, reach); return n ? n.d : Infinity; }, ground: (x, z) => W.terrainH(x, z),
           wet: wl ? (x, z) => W.terrainH(x, z) < wl(x, z) - 0.2 : null };
}
// every aerodrome's spots, and for each spot every archetype footprint that fits in it, held to the rules: inside the
// field (fleetField, the four corners), on flat ground (land: the corners and the mount within FLEET_SPOT.flatTol),
// dry on land / afloat on water, MARGIN off every solid thing (the outline every 0.25 m, the inside every 2 m), every
// route of every validated build's pattern its half-span + MARGIN off, and no two spots' boxes within FLEET_SPOT.gap
// -> { per: [{ id, n, kinds, spots }], rows: [{ id, spot, what, ok, d, need, near }] }
function spotCensus(C, W, I, builds, foots, opt) {
  const pave = paveOf(W), inp = spotInputs(W, I, pave), F = C.FLEET_SPOT, rows = [], per = [];
  for (const a of W.aerodromes) {
    const s = C.siteOf(a.id) || null;
    const res = C.fleetSpots(a, s, inp), again = C.fleetSpots(a, s, inp);
    per.push({ id: a.id, n: res.spots.length, kinds: res.spots.map(q => q.kind[0]).join(''), spots: res.spots, why: res.why, same: JSON.stringify(res.spots) === JSON.stringify(again.spots) });
    const field = C.fleetField(a, s, pave), water = !!a.water;
    const pats = builds.map(B => ({ B, P: C.sitePattern(a, s, { half: B.dims.half }) }));
    const routes = pats.map(({ B, P }) => ({ B, pts: routesOf(C, P).reduce((l, r) => l.concat(r.pts), []) }));
    for (const sp of res.spots) {
      for (const [fk, f] of Object.entries(foots)) {
        if (f.half > sp.half + 1e-9 || f.fwd > sp.fwd + 1e-9 || f.aft > sp.aft + 1e-9) continue;
        const box = { x: sp.x, z: sp.z, ry: sp.ry, half: f.half, fwd: f.fwd, aft: f.aft };
        const row = (what, ok, d, need, near) => rows.push({ id: a.id, spot: sp.id, foot: fk, what, ok, d, need, near: near || '' });
        const corners = C.fleetSpotPts(box, 1e9);
        row('inside the field', corners.every(q => field(q[0], q[1])), null, null);
        if (!water) { const h = corners.concat([[sp.x, sp.z]]).map(q => W.terrainH(q[0], q[1])); const d = Math.max(...h) - Math.min(...h); row('flat', d <= F.flatTol + 1e-9, d, F.flatTol); }
        if (inp.wet) { const w = corners.map(q => inp.wet(q[0], q[1])); row(water ? 'afloat' : 'dry', water ? w.every(Boolean) : !w.some(Boolean), null, null); }
        let wS = null; for (const q of C.fleetSpotPts(box, 0.25, true)) { const n = I.nearest(q[0], q[1], MARGIN + 25); const d = n ? n.d : Infinity; if (!wS || d < wS.d) wS = { d, s: n ? n.s : null }; }
        row('clear of solid things', wS.d >= MARGIN - 1e-9, wS.d, MARGIN, fmtWhat(wS.s));
        for (const { B, pts } of routes) {
          const need = B.dims.half + MARGIN;
          let w = Infinity; for (const q of pts) { if (Math.abs(q.x - sp.x) > 60 || Math.abs(q.z - sp.z) > 60) continue; w = Math.min(w, C.fleetSpotDist(box, q.x, q.z)); }
          row('clear of ' + B.name + "'s routes", w >= need - 1e-9, w, need);
        }
      }
    }
    // no two spots' capacity boxes within the gap
    for (let i = 0; i < res.spots.length; i++) for (let j = i + 1; j < res.spots.length; j++) {
      const A = res.spots[i], B = res.spots[j];
      let d = Infinity; for (const q of C.fleetSpotPts(A, 0.25)) d = Math.min(d, C.fleetSpotDist(B, q[0], q[1])); for (const q of C.fleetSpotPts(B, 0.25)) d = Math.min(d, C.fleetSpotDist(A, q[0], q[1]));
      rows.push({ id: a.id, spot: A.id + ' / ' + B.id, foot: 'capacity', what: 'not overlapping', ok: d >= F.gap - 1e-9, d, need: F.gap, near: '' });
    }
  }
  return { per, rows, pave };
}

module.exports = { paveOf, spotInputs, spotCensus, BUILDS, buildDims, parkedClear, census, flyOut, flyTurn, planAt, placeAt, intoWorld, nodesInside, MARGIN, propBoxes, islandObstacles, obstaclesOfThings, treeTrunks, registryObstacles, index, routesOf, censusSite, gridShape, boxShape, discShape, fmtWhat };
