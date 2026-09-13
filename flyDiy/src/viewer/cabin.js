// cabin.js — THE TRAM CABIN, DRESSED (G343, the user: "It needs new materials
// from our library, choose wisely amongst all available. Use the same
// technique for the windows as for the houses. Build a smooth joint on the
// window contour, with higher resolution than the base mesh ... 2 images we
// can project on each side as liveries. Keep the normal of the base
// material, replace the metallic, roughness and diffuse").
//
// The baked prop (tools/cabin_table.py -> src/cabin/) keeps the author's
// parts PER MATERIAL, and that name is the handle everything here hangs on:
//
//   Yellow       the BODY     painted steel (steelgrey, harbour red) with
//                             the livery on both flanks
//   Black_Yellow the TRIM     charcoal steel: bumpers, frames, the carriage
//   Yellow_dirt  the FLOOR    decking boards
//   material     the HANGER   bare steel: the neck, the mainstay, the head
//   Red_dark     the DETAIL   galvanised: handles, small fittings
//   Metallic     the RAIL     galvanised: the door rails and the roof rail
//   Windows      the GLASS    the house's glass, through a house Bag so it
//                             carries the attributes the glass shader reads
//
// THE UVS ARE IN METRES, the house library's rule: every part is re-mapped
// here by a planar projection along its dominant normal, so a 2 m steel tile
// is 2 m on the cabin as it is on the station's girder.
//
// THE GASKET (the smooth joint): the window mesh's boundary - every edge one
// triangle owns - is walked into closed loops, each loop is rounded by
// corner-cutting (Chaikin, three passes: four times the resolution the
// author drew the corners at) and resampled at five centimetres, and a
// six-sided rubber bead of 3.5 cm radius is swept round it. The polygonal
// corner the low mesh shows at every window is under the bead.
//
// THE LIVERY: the body's flank triangles (the outer skin, facing +-x) are
// clipped to the banner's rectangle in (z, y) and copied a few millimetres
// proud of the skin with two uv sets - the banner's (0..1 across the
// rectangle, mirrored on the far flank so the words read from either side)
// and the metric one the steel's NORMAL map keeps reading through a small
// shader patch. Diffuse is the banner, metalness and roughness are the
// decal's own.
//
// `plan(parts)` is pure geometry (the node gate runs it on the baked bin);
// `build(THREE, opts)` turns a plan into meshes with the house's materials.
(() => {
const ROLE = { Yellow: 'body', Black_Yellow: 'trim', Yellow_dirt: 'floor', material: 'hanger',
               Red_dark: 'detail', Metallic: 'rail', Windows: 'glass' };
// the banner's rectangle on the flank, metres in the cabin's baked frame
// (the body runs 5.1 m along z, its window band is y 1.61..2.84, the flank
// is the outermost tenth of a metre of the body on each side)
const BANNER = { z0: -1.5, z1: 1.5, y0: 0.42, y1: 1.42, flank: 0.1 };
const HANG = 7.415;    // the rope over the floor's origin with the carriage level: PIVOT.y + ROPE_UP (G351; was the baked axle, 8.2)

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const nrm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// ---- THE CARRIAGE, THE WINDING, THE BEVEL (G351) -----------------------------
// THE CARRIAGE IS ITS OWN PART (the user: "IRL the cabin will remain hanging
// vertically ... and the 'wheeled' part follows the tangent of the cable").
// The author baked the carriage at its own line's angle - eight axles from
// (z -2.18, y 6.89) to (z 1.85, y 8.35), 19.85 degrees - rigid with the
// hanger. Every welded component of every part is read against that RAIL
// LINE: a component that lies along it (thin across it, over the hanger's
// arms) is carriage, the rest - the arms, the head with its cheeks and side
// box - is hanger. The carriage's triangles are moved into their own
// sub-parts, translated to the PIVOT (the pin through the head's cheeks,
// on the carriage's lower chord) and turned level, so a runtime pitches
// them about the pivot to the rope's tangent and the cabin hangs plumb.
// The rope runs ROPE_UP over the pivot, perpendicular to the rail: the axle
// line is 0.62 up, the wheels are 0.255 in radius, and they ride ON the rope.
const TILT = Math.atan2(8.349 - 6.893, 1.852 + 2.182);          // the baked rail's rise, 19.85 degrees
const RAIL = { y: 7.725, z: 0.123, k: Math.tan(Math.atan2(8.349 - 6.893, 1.852 + 2.182)) };
const railY = z => RAIL.y + RAIL.k * (z - RAIL.z);
const PIVOT = [0, 7.05, 0.07];
const WHEEL_R = 0.255, AXLE_UP = 0.62, ROPE_UP = AXLE_UP - WHEEL_R;   // the rope contact line over the pivot, perpendicular to the rail

// a part's welded connectivity: vertex -> component id, by position (the bake splits vertices per normal) and by triangle
function components(pos, idx) {
  const n = pos.length / 3, par = new Int32Array(n).fill(-1);
  const find = i => { while (par[i] >= 0) i = par[i]; return i; };
  const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) par[a] = b; };
  const key = new Map();
  for (let i = 0; i < n; i++) { const k = pos[i * 3].toFixed(4) + ',' + pos[i * 3 + 1].toFixed(4) + ',' + pos[i * 3 + 2].toFixed(4); if (key.has(k)) uni(i, key.get(k)); else key.set(k, i); }
  for (let t = 0; t < idx.length; t += 3) { uni(idx[t], idx[t + 1]); uni(idx[t + 1], idx[t + 2]); }
  const comp = new Int32Array(n);
  for (let i = 0; i < n; i++) comp[i] = find(i);
  return comp;
}
// the triangles of a part chosen by `keep(tri)`, as a compact part
function subPart(part, keepTri) {
  const map = new Int32Array(part.pos.length / 3).fill(-1), pos = [], nrm = [], idx = [];
  for (let t = 0; t < part.idx.length; t += 3) {
    if (!keepTri(t)) continue;
    for (let k = 0; k < 3; k++) {
      const v = part.idx[t + k];
      if (map[v] < 0) { map[v] = pos.length / 3; pos.push(part.pos[v * 3], part.pos[v * 3 + 1], part.pos[v * 3 + 2]); nrm.push(part.nrm[v * 3], part.nrm[v * 3 + 1], part.nrm[v * 3 + 2]); }
      idx.push(map[v]);
    }
  }
  return { mat: part.mat, pos, nrm, idx };
}
// which components of a part are carriage: by the component's extent against the rail line
function splitCarriage(part) {
  const comp = components(part.pos, part.idx), box = new Map();
  for (let i = 0; i < part.pos.length / 3; i++) {
    const c = comp[i], x = part.pos[i * 3], y = part.pos[i * 3 + 1], z = part.pos[i * 3 + 2], d = y - railY(z);
    let b = box.get(c);
    if (!b) { b = { y0: 1e9, y1: -1e9, z0: 1e9, z1: -1e9, d0: 1e9, d1: -1e9, sd: 0, n: 0 }; box.set(c, b); }
    b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y); b.z0 = Math.min(b.z0, z); b.z1 = Math.max(b.z1, z); b.d0 = Math.min(b.d0, d); b.d1 = Math.max(b.d1, d); b.sd += d; b.n++;
  }
  const isCar = new Map();
  for (const [c, b] of box) {
    const dc = b.sd / b.n, zs = b.z1 - b.z0, ys = b.y1 - b.y0;
    const thin = b.d1 - b.d0 < 0.45 && dc > -0.95 && b.y1 > 6.6;      // lies along the rail
    const tilted = zs > 1.0 && b.y0 > 6.6 && ys > 0.5 * zs * RAIL.k;  // a long member climbing with the rail, over the arms
    isCar.set(c, b.y1 > 6.3 && (b.y0 > 7.2 || thin || tilted));
  }
  const car = t => isCar.get(comp[part.idx[t]]);
  return { fixed: subPart(part, t => !car(t)), carriage: subPart(part, t => car(t)) };
}
// the carriage sub-part into the pivot's frame: translated to the pivot and turned level (the rail along +z)
function levelCarriage(part) {
  const c = Math.cos(TILT), s = Math.sin(TILT), pos = part.pos.slice(), nrm = part.nrm.slice();
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i] - PIVOT[0], y = pos[i + 1] - PIVOT[1], z = pos[i + 2] - PIVOT[2];
    pos[i] = x; pos[i + 1] = y * c - z * s; pos[i + 2] = y * s + z * c;          // R_x(+tilt): the rising rail laid flat
    const ny = nrm[i + 1], nz = nrm[i + 2];
    nrm[i + 1] = ny * c - nz * s; nrm[i + 2] = ny * s + nz * c;
  }
  return { mat: part.mat, pos, nrm, idx: part.idx };
}

// THE BEVEL AND THE SMOOTHING (the user: "The cabins need edge beveling, and
// smooth shading. There is also inverted normals on the A shaped support").
// Every part is welded by position and read as faces. Each welded component
// is first turned right side out: its triangles' winding is voted against
// the author's normals and flipped where the vote says inside out (the
// hanger's arms came that way). Then edges are classed by their dihedral:
// SOFT under `hardDeg` (a facetted curve - shaded smooth across), HARD and
// CONVEX (a box arris - chamfered), HARD and CONCAVE (a crease - kept
// sharp). Faces joined by soft edges form flat-or-curved GROUPS; each group
// gets its own copy of its vertices, inset `w` from every chamfered edge
// (one inset per distinct edge direction), with normals averaged over the
// group's faces so a flat stays flat and a facetted curve reads round. Over
// every chamfered edge a TWO-SEGMENT strip is laid on the arc tangent to
// both faces - flat normal at either edge, the mean normal on the crown -
// so the highlight rolls over the edge and the flats show no gradient.
// Where three or more chamfers meet, the loose ends around the vertex are
// fanned from their centre. `w` is clamped per vertex to a third of its
// shortest incident edge, so a bolt keeps its shape.
function bevelSmooth(part, w, hardDeg) {
  const P = part.pos, I = part.idx, nV = P.length / 3;
  // weld
  const key = new Map(), wid = new Int32Array(nV), wpos = [];
  for (let i = 0; i < nV; i++) {
    const k = P[i * 3].toFixed(4) + ',' + P[i * 3 + 1].toFixed(4) + ',' + P[i * 3 + 2].toFixed(4);
    if (key.has(k)) wid[i] = key.get(k); else { key.set(k, wpos.length); wid[i] = wpos.length; wpos.push([P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]); }
  }
  const nW = wpos.length;
  // faces on welded ids, dropping degenerates
  const F = [];
  for (let t = 0; t < I.length; t += 3) {
    const a = wid[I[t]], b = wid[I[t + 1]], c = wid[I[t + 2]];
    if (a === b || b === c || a === c) continue;
    const n = crs(sub(wpos[b], wpos[a]), sub(wpos[c], wpos[a])), l = len(n);
    if (l < 1e-10) continue;
    const an = [0, 1, 2].map(k => [part.nrm[I[t + k] * 3], part.nrm[I[t + k] * 3 + 1], part.nrm[I[t + k] * 3 + 2]]);
    F.push({ v: [a, b, c], n: mul(n, 1 / l), area: l / 2, vote: dot(mul(n, 1 / l), add(add(an[0], an[1]), an[2])) });
  }
  // edges
  const E = new Map();
  const ek = (a, b) => a < b ? a + '_' + b : b + '_' + a;
  F.forEach((f, fi) => { for (let k = 0; k < 3; k++) { const a = f.v[k], b = f.v[(k + 1) % 3], kk = ek(a, b); let e = E.get(kk); if (!e) { e = { a: Math.min(a, b), b: Math.max(a, b), f: [] }; E.set(kk, e); } e.f.push(fi); } });
  // RIGHT SIDE OUT, per component of faces: a closed component by its signed
  // volume (the author's normals cannot tell - they were flipped with the
  // winding), an open one by the vote of its author's normals
  {
    const par = new Int32Array(nW).fill(-1);
    const find = i => { while (par[i] >= 0) i = par[i]; return i; };
    const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) par[a] = b; };
    for (const f of F) { uni(f.v[0], f.v[1]); uni(f.v[1], f.v[2]); }
    const cenOf = f => mul(add(add(wpos[f.v[0]], wpos[f.v[1]]), wpos[f.v[2]]), 1 / 3);
    const votes = new Map(), vol = new Map(), open = new Map(), cen0 = new Map(), area = new Map();
    for (const f of F) {
      const c = find(f.v[0]);
      votes.set(c, (votes.get(c) || 0) + f.vote * f.area);
      vol.set(c, (vol.get(c) || 0) + dot(wpos[f.v[0]], crs(wpos[f.v[1]], wpos[f.v[2]])) / 6);
      cen0.set(c, add(cen0.get(c) || [0, 0, 0], mul(cenOf(f), f.area))); area.set(c, (area.get(c) || 0) + f.area);
    }
    for (const e of E.values()) if (e.f.length !== 2) open.set(find(e.a), true);
    // an open component (the arms are open tubes): its faces should look away
    // from its own centroid; where that says nothing (a plate) the author's vote
    const away = new Map();
    for (const f of F) { const c = find(f.v[0]); const g = mul(cen0.get(c), 1 / area.get(c)); away.set(c, (away.get(c) || 0) + f.area * dot(f.n, nrm(sub(cenOf(f), g)))); }
    let closedVol = 0, flipped = 0;
    for (const f of F) {
      const c = find(f.v[0]);
      let flip;
      if (!open.get(c)) flip = (vol.get(c) || 0) < 0;
      else if (Math.abs(away.get(c)) > 0.2 * area.get(c)) flip = away.get(c) < 0;
      else flip = (votes.get(c) || 0) < 0;
      if (flip) { f.v = [f.v[0], f.v[2], f.v[1]]; f.n = mul(f.n, -1); flipped++; }
    }
    for (const [c, v] of vol) if (!open.get(c)) closedVol += Math.abs(v);
    part.closedVol = closedVol; part.flipped = flipped;
    // the edge map's face lists are unchanged by a flip
  }
  const cosHard = Math.cos(hardDeg * Math.PI / 180);
  const cen = f => mul(add(add(wpos[f.v[0]], wpos[f.v[1]]), wpos[f.v[2]]), 1 / 3);
  // the shortest edge at every vertex: the inset is clamped to a third of it, and hardware too small for a chamfer keeps its arrises
  const shortest = new Float64Array(nW).fill(1e9);
  for (const e of E.values()) { const l = len(sub(wpos[e.b], wpos[e.a])); shortest[e.a] = Math.min(shortest[e.a], l); shortest[e.b] = Math.min(shortest[e.b], l); }
  for (const e of E.values()) {
    e.kind = 'hard';
    if (e.f.length !== 2) continue;
    const f1 = F[e.f[0]], f2 = F[e.f[1]], c = dot(f1.n, f2.n);
    if (c > cosHard) e.kind = 'soft';
    else if (dot(sub(cen(f2), cen(f1)), f1.n) < -1e-6 && Math.min(shortest[e.a], shortest[e.b]) / 3 >= 0.005) e.kind = 'bevel';   // convex, and big enough: the far face falls behind this one's plane
  }
  // groups of faces across soft edges
  const gpar = new Int32Array(F.length).fill(-1);
  const gfind = i => { while (gpar[i] >= 0) i = gpar[i]; return i; };
  for (const e of E.values()) if (e.kind === 'soft') { const a = gfind(e.f[0]), b = gfind(e.f[1]); if (a !== b) gpar[a] = b; }
  const group = new Int32Array(F.length);
  for (let i = 0; i < F.length; i++) group[i] = gfind(i);
  // per (group, vertex): the inset directions, the normal sum
  const gv = new Map();                                    // key g_v -> { off: [], nsum, out }
  const gvKey = (g, v) => g + '_' + v;
  const gvGet = (g, v) => { const k = gvKey(g, v); let r = gv.get(k); if (!r) { r = { g, v, dirs: [], nsum: [0, 0, 0], idx: -1 }; gv.set(k, r); } return r; };
  F.forEach((f, fi) => { const g = group[fi]; for (const v of f.v) { const r = gvGet(g, v); r.nsum = add(r.nsum, mul(f.n, f.area)); } });
  for (const e of E.values()) {
    if (e.kind !== 'bevel') continue;
    for (const fi of e.f) {
      const f = F[fi], g = group[fi];
      const third = f.v.find(v => v !== e.a && v !== e.b);
      const ed = nrm(sub(wpos[e.b], wpos[e.a]));
      let tOut = nrm(crs(ed, f.n));                          // in the face's plane, across the edge
      if (dot(tOut, sub(wpos[third], wpos[e.a])) > 0) tOut = mul(tOut, -1);   // pointing OUT of the face
      for (const v of [e.a, e.b]) {
        const r = gvGet(g, v);
        if (!r.dirs.some(d => dot(d, tOut) > 0.985)) r.dirs.push(tOut);   // one inset per distinct direction
      }
    }
  }
  const pos = [], nrm2 = [], idx = [];
  const emit = (p, n) => { pos.push(p[0], p[1], p[2]); nrm2.push(n[0], n[1], n[2]); return pos.length / 3 - 1; };
  for (const r of gv.values()) {
    const wv = Math.min(w, shortest[r.v] / 3);
    let p = wpos[r.v];
    for (const d of r.dirs) p = sub(p, mul(d, wv));
    r.p = p; r.n = nrm(r.nsum); r.idx = emit(p, r.n);
  }
  F.forEach((f, fi) => { const g = group[fi]; idx.push(gv.get(gvKey(g, f.v[0])).idx, gv.get(gvKey(g, f.v[1])).idx, gv.get(gvKey(g, f.v[2])).idx); });
  // the strips over the chamfered edges, and the loose ends per vertex
  const ends = new Map();                                   // vertex -> [{ p, n }]
  const endAdd = (v, p, n) => { let l = ends.get(v); if (!l) { l = []; ends.set(v, l); } l.push({ p, n }); };
  const quad = (a, b, c, d, want) => {
    const n = crs(sub(pos.slice(b * 3, b * 3 + 3), pos.slice(a * 3, a * 3 + 3)), sub(pos.slice(c * 3, c * 3 + 3), pos.slice(a * 3, a * 3 + 3)));
    if (dot(n, want) >= 0) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c);
  };
  let strips = 0;
  for (const e of E.values()) {
    if (e.kind !== 'bevel') continue;
    const f1 = F[e.f[0]], f2 = F[e.f[1]], g1 = group[e.f[0]], g2 = group[e.f[1]];
    if (g1 === g2) continue;
    const n1 = f1.n, n2 = f2.n, nM = nrm(add(n1, n2)), dn = len(sub(n2, n1));
    if (dn < 1e-4) continue;
    const mid = v => {
      const u1 = gv.get(gvKey(g1, v)).p, u2 = gv.get(gvKey(g2, v)).p;
      const r = len(sub(u2, u1)) / dn, c = sub(u1, mul(n1, r));
      return add(c, mul(nM, r));
    };
    const A1 = gv.get(gvKey(g1, e.a)), B1 = gv.get(gvKey(g1, e.b)), A2 = gv.get(gvKey(g2, e.a)), B2 = gv.get(gvKey(g2, e.b));
    const aM = mid(e.a), bM = mid(e.b);
    const iaM = emit(aM, nM), ibM = emit(bM, nM);
    quad(A1.idx, B1.idx, ibM, iaM, nM);
    quad(iaM, ibM, B2.idx, A2.idx, nM);
    strips++;
    endAdd(e.a, aM, nM); endAdd(e.b, bM, nM);
  }
  // the loose ends: every vertex with chamfers around it - its group copies and its arc middles, fanned from their centre
  let patches = 0;
  const vGroups = new Map();
  for (const r of gv.values()) { let l = vGroups.get(r.v); if (!l) { l = []; vGroups.set(r.v, l); } l.push(r); }
  for (const [v, mids] of ends) {
    if (mids.length < 2) continue;
    const pts = mids.map(m => ({ p: m.p, n: m.n })).concat((vGroups.get(v) || []).filter(r => r.dirs.length).map(r => ({ p: r.p, n: r.n })));
    if (mids.length === 2 && len(sub(mids[0].p, mids[1].p)) < 1e-3) continue;      // a straight run of chamfers: the strips meet
    let c = [0, 0, 0], n = [0, 0, 0];
    for (const q of pts) { c = add(c, q.p); n = add(n, q.n); }
    c = mul(c, 1 / pts.length); n = nrm(n);
    // order round the normal
    let e1 = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    e1 = nrm(sub(e1, mul(n, dot(e1, n)))); const e2 = crs(n, e1);
    pts.forEach(q => { const d = sub(q.p, c); q.ang = Math.atan2(dot(d, e2), dot(d, e1)); });
    pts.sort((a, b) => a.ang - b.ang);
    const ic = emit(add(c, mul(n, w * 0.15)), n), ids = pts.map(q => emit(q.p, q.n));
    for (let i = 0; i < ids.length; i++) {
      const a = ids[i], b = ids[(i + 1) % ids.length];
      const fn = crs(sub(pos.slice(a * 3, a * 3 + 3), pos.slice(ic * 3, ic * 3 + 3)), sub(pos.slice(b * 3, b * 3 + 3), pos.slice(ic * 3, ic * 3 + 3)));
      if (dot(fn, n) >= 0) idx.push(ic, a, b); else idx.push(ic, b, a);
    }
    patches++;
  }
  return { mat: part.mat, pos, nrm: nrm2, idx, strips, patches, faces: F.length, closedVol: part.closedVol || 0, flipped: part.flipped || 0 };
}

const BEVEL_W = 0.02, HARD_DEG = 40;
// the baked parts prepared once: the carriage split off, every component
// right side out, every convex arris chamfered and the shading smoothed;
// the glass and the floor boards go through untouched
const PREP = { key: null, out: null };
function prepare(parts) {
  if (PREP.out && PREP.key === parts[0].pos) return PREP.out;
  const out = [];
  for (const part of parts) {
    const role = ROLE[part.mat] || 'trim';
    if (role === 'glass' || role === 'floor') { out.push({ mat: part.mat, role, carriage: false, pos: part.pos, nrm: part.nrm, idx: part.idx }); continue; }
    const sp = splitCarriage(part);
    if (sp.fixed.idx.length) out.push(Object.assign({ role, carriage: false }, bevelSmooth(sp.fixed, BEVEL_W, HARD_DEG)));
    if (sp.carriage.idx.length) out.push(Object.assign({ role, carriage: true }, bevelSmooth(levelCarriage(sp.carriage), BEVEL_W, HARD_DEG)));
  }
  PREP.key = parts[0].pos; PREP.out = out;
  return out;
}

// planar metric uv by the dominant axis of the vertex normal
function metricUV(pos, nrmA) {
  const uv = new Float32Array(pos.length / 3 * 2);
  for (let i = 0; i < pos.length; i += 3) {
    const nx = Math.abs(nrmA[i]), ny = Math.abs(nrmA[i + 1]), nz = Math.abs(nrmA[i + 2]);
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    let u, v;
    if (ny >= nx && ny >= nz) { u = x; v = z; } else if (nx >= nz) { u = z; v = y; } else { u = x; v = y; }
    uv[i / 3 * 2] = u; uv[i / 3 * 2 + 1] = v;
  }
  return uv;
}

// the boundary loops of a triangle soup (positions welded at a tenth of a millimetre)
function boundaryLoops(pos, idx) {
  const key = i => (Math.round(pos[i * 3] * 1e4) + '/' + Math.round(pos[i * 3 + 1] * 1e4) + '/' + Math.round(pos[i * 3 + 2] * 1e4));
  const wid = new Map(), rep = [];
  const w = new Int32Array(pos.length / 3);
  for (let i = 0; i < w.length; i++) { const k = key(i); let j = wid.get(k); if (j === undefined) { j = rep.length; wid.set(k, j); rep.push(i); } w[i] = j; }
  const count = new Map(), dir = new Map();
  for (let t = 0; t < idx.length; t += 3) {
    const a = w[idx[t]], b = w[idx[t + 1]], c = w[idx[t + 2]];
    for (const [p, q] of [[a, b], [b, c], [c, a]]) {
      const k = p < q ? p + '-' + q : q + '-' + p;
      count.set(k, (count.get(k) || 0) + 1);
      dir.set(k, [p, q]);
    }
  }
  const next = new Map();
  for (const [k, n] of count) if (n === 1) { const [p, q] = dir.get(k); next.set(p, q); }
  const loops = [], seen = new Set();
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const loop = []; let cur = start, guard = 0;
    while (cur !== undefined && !seen.has(cur) && guard++ < 100000) { seen.add(cur); loop.push(cur); cur = next.get(cur); }
    if (loop.length >= 3 && cur === start) loops.push(loop.map(j => { const i = rep[j]; return [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]; }));
  }
  return loops;
}

function chaikin(pts, passes) {
  let p = pts;
  for (let k = 0; k < passes; k++) {
    const q = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      q.push(add(mul(a, 0.75), mul(b, 0.25)), add(mul(a, 0.25), mul(b, 0.75)));
    }
    p = q;
  }
  return p;
}
function resample(pts, step) {
  const out = []; let total = 0;
  const segs = pts.map((p, i) => { const l = len(sub(pts[(i + 1) % pts.length], p)); total += l; return l; });
  const n = Math.max(8, Math.round(total / step)), ds = total / n;
  let i = 0, acc = 0;
  for (let k = 0; k < n; k++) {
    const s = k * ds;
    while (acc + segs[i] < s && i < pts.length - 1) { acc += segs[i]; i++; }
    const t = segs[i] > 1e-9 ? (s - acc) / segs[i] : 0;
    out.push(add(pts[i], mul(sub(pts[(i + 1) % pts.length], pts[i]), t)));
  }
  return out;
}

// a closed tube round a loop: rings of `sides` about the tangent, the loop
// pushed `lift` along `outN` first (a pane sits behind the skin's edge; the
// bead has to stand proud of the skin to be seen)
function tube(loop0, r, sides, out, outN, lift) {
  const loop = outN ? loop0.map(p => add(p, mul(outN, lift || 0))) : loop0;
  const n = loop.length, base = out.pos.length / 3;
  let c = [0, 0, 0];
  for (const p of loop) c = add(c, p);
  c = mul(c, 1 / n);
  for (let i = 0; i < n; i++) {
    const p = loop[i], t = nrm(sub(loop[(i + 1) % n], loop[(i - 1 + n) % n]));
    let u = nrm(sub(p, c)); u = nrm(sub(u, mul(t, dot(u, t))));
    if (len(u) < 1e-6) u = nrm(crs(t, [1, 0, 0]));
    const v = nrm(crs(t, u));
    for (let s = 0; s < sides; s++) {
      const a = 2 * Math.PI * s / sides, d = add(mul(u, Math.cos(a)), mul(v, Math.sin(a)));
      out.pos.push(p[0] + d[0] * r, p[1] + d[1] * r, p[2] + d[2] * r);
      out.nrm.push(d[0], d[1], d[2]);
      out.uv.push(i * 0.05, s / sides * 0.2);
    }
  }
  for (let i = 0; i < n; i++) for (let s = 0; s < sides; s++) {
    const a = base + i * sides + s, b = base + i * sides + (s + 1) % sides;
    const c2 = base + ((i + 1) % n) * sides + (s + 1) % sides, d = base + ((i + 1) % n) * sides + s;
    out.idx.push(a, d, c2, a, c2, b);
  }
}

// Sutherland-Hodgman against the banner rectangle in (z, y)
function clipRect(poly, R) {
  const edges = [p => p[2] - R.z0, p => R.z1 - p[2], p => p[1] - R.y0, p => R.y1 - p[1]];
  let out = poly;
  for (const f of edges) {
    const inp = out; out = [];
    for (let i = 0; i < inp.length; i++) {
      const a = inp[i], b = inp[(i + 1) % inp.length], fa = f(a), fb = f(b);
      if (fa >= 0) out.push(a);
      if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push(add(a, mul(sub(b, a), t))); }
    }
    if (!out.length) return out;
  }
  return out;
}

function plan(parts, opts) {
  const o = opts || {}, R = Object.assign({}, BANNER, o.banner || {});
  const roles = [], decals = { pos: [], nrm: [], uv: [], uvN: [], idx: [] };
  let glass = null, gaskets = { pos: [], nrm: [], uv: [], idx: [], loops: 0 };
  for (const part of prepare(parts)) {
    const role = part.role;
    if (role === 'glass') {
      glass = { pos: part.pos, idx: part.idx, uv: metricUV(part.pos, part.nrm), nrm: part.nrm };
      const loops = boundaryLoops(part.pos, part.idx);
      // each pane's outward normal: the author's, averaged over the pane's vertices nearest the loop
      const nearN = q => { let best = 1e9, nn = [0, 0, 1]; for (let i = 0; i < part.pos.length; i += 3) { const d = Math.hypot(part.pos[i] - q[0], part.pos[i + 1] - q[1], part.pos[i + 2] - q[2]); if (d < best) { best = d; nn = [part.nrm[i], part.nrm[i + 1], part.nrm[i + 2]]; } } return nn; };
      for (const lp of loops) {
        let outN = [0, 0, 0];
        for (const q of lp) outN = add(outN, nearN(q));
        outN = nrm(outN);
        const smooth = resample(chaikin(lp, 3), 0.05);
        tube(smooth, 0.045, 6, gaskets, outN, 0.04);
        gaskets.loops++;
      }
      continue;
    }
    roles.push({ mat: part.mat, role, carriage: !!part.carriage, geo: { pos: part.pos, nrm: part.nrm, idx: part.idx }, uv: metricUV(part.pos, part.nrm),
                 strips: part.strips || 0, patches: part.patches || 0, closedVol: part.closedVol || 0, flipped: part.flipped || 0 });
    if (role !== 'body' || part.carriage) continue;
    // the livery on the flanks: the body's outermost skin either side
    const p = part.pos, ix = part.idx;
    let xL = 1e9, xR = -1e9;
    for (let i = 0; i < p.length; i += 3) { xL = Math.min(xL, p[i]); xR = Math.max(xR, p[i]); }
    R.xL = xL; R.xR = xR;
    for (let t = 0; t < ix.length; t += 3) {
      const A = [p[ix[t] * 3], p[ix[t] * 3 + 1], p[ix[t] * 3 + 2]], B = [p[ix[t + 1] * 3], p[ix[t + 1] * 3 + 1], p[ix[t + 1] * 3 + 2]], C = [p[ix[t + 2] * 3], p[ix[t + 2] * 3 + 1], p[ix[t + 2] * 3 + 2]];
      const fn = nrm(crs(sub(B, A), sub(C, A)));
      if (Math.abs(fn[0]) < 0.6) continue;
      const sx = fn[0] > 0 ? 1 : -1;
      if (sx > 0 ? Math.min(A[0], B[0], C[0]) < xR - R.flank : Math.max(A[0], B[0], C[0]) > xL + R.flank) continue;
      const poly = clipRect([A, B, C], R);
      if (poly.length < 3) continue;
      const base = decals.pos.length / 3;
      for (const q of poly) {
        decals.pos.push(q[0] + sx * 0.006, q[1], q[2]);
        decals.nrm.push(sx, 0, 0);
        // a viewer at +x looks along -x and their right hand is -z (right =
        // forward x up), so on the +x flank u grows toward -z; the far flank the other way
        const u = sx > 0 ? (R.z1 - q[2]) / (R.z1 - R.z0) : (q[2] - R.z0) / (R.z1 - R.z0);
        decals.uv.push(u, (q[1] - R.y0) / (R.y1 - R.y0));
        decals.uvN.push(q[2], q[1]);
      }
      for (let k = 1; k < poly.length - 1; k++) decals.idx.push(base, base + k, base + k + 1);
    }
  }
  return { roles, glass, gaskets, decals, banner: R };
}

// ---- the meshes ------------------------------------------------------------
let MATS = null;
function mats(THREE, HG) {
  if (MATS) return MATS;
  const mk = (key, col, o) => { const m = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.3 }); HG.dressMat(m, key, col, o || {}); return m; };
  const body = mk('steelgrey', 1, { nrm: 1.1, rough: 0.75 }); body.metalness = 0.35;
  const trim = mk('steelgrey', 8, { nrm: 1.1, rough: 0.85 }); trim.metalness = 0.5;
  const floor = mk('deckwood', 0, { nrm: 1.4, rough: 1.0 });
  const hanger = mk('steelgrey', 0, { nrm: 1.2, rough: 0.7 }); hanger.metalness = 0.85;
  const detail = mk('galv', 8, { nrm: 1.0, rough: 0.6 }); detail.metalness = 0.7;
  const rail = mk('galv', 0, { nrm: 1.0, rough: 0.55 }); rail.metalness = 0.85;
  const gasket = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.92, metalness: 0.05 });
  MATS = { body, trim, floor, hanger, detail, rail, gasket, decal: {} };
  return MATS;
}
// the decal: the banner as diffuse, the steel's normal through the metric uv
function decalMat(THREE, HG, livery) {
  const M = mats(THREE, HG);
  if (M.decal[livery]) return M.decal[livery];
  const L = (typeof CABIN_LIVERY !== 'undefined' && CABIN_LIVERY) ? CABIN_LIVERY[livery] : null;
  const m = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.12, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  HG.dressMat(m, 'steelgrey', 0, { nrm: 0.9 });
  m.color.setHex(0xffffff); m.roughnessMap = null; m.metalness = 0.12; m.roughness = 0.55;
  if (L) {
    const t = new THREE.Texture(L.img);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace;
    const ok = () => { t.needsUpdate = true; };
    if (L.img.complete && L.img.naturalWidth) ok(); else L.img.addEventListener('load', ok);
    m.map = t;
  }
  m.onBeforeCompile = sh => {
    sh.vertexShader = 'attribute vec2 aUvN; varying vec2 vUvN;\n' + sh.vertexShader
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n  vUvN = aUvN;');
    sh.fragmentShader = 'varying vec2 vUvN;\n' + sh.fragmentShader
      .replace('#include <normal_fragment_maps>',
        '#ifdef USE_NORMALMAP\n  { vec3 mapN = texture2D(normalMap, vUvN * 0.5).xyz * 2.0 - 1.0; mapN.xy *= normalScale; normal = normalize(tbn * mapN); /* r186: the tangent frame is tbn, from normal_fragment_begin (W0.5a) */ }\n#endif');
  };
  m.needsUpdate = true;
  M.decal[livery] = m;
  return m;
}

const geo = (THREE, pos, nrmA, uv, idx, extra) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos instanceof Float32Array ? pos : new Float32Array(pos), 3));
  if (nrmA) g.setAttribute('normal', new THREE.BufferAttribute(nrmA instanceof Float32Array ? nrmA : new Float32Array(nrmA), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv instanceof Float32Array ? uv : new Float32Array(uv), 2));
  if (extra) for (const k in extra) g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(extra[k].a), extra[k].n));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
  if (!nrmA) g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
};

// opts: { livery: 'admiralty' | 'chatham' }
function build(THREE, opts) {
  const o = opts || {}, HG = window.HOUSE_GEN, K = window.HOUSE_KIT;
  const grp = new THREE.Group();
  grp.name = 'cabin:' + (o.livery || 'admiralty');
  // THE CARRIAGE in its own group at the pivot (G351), there from the first
  // frame so a runtime can pitch it (rotation.x) before the bake has landed
  const carriage = new THREE.Group();
  carriage.name = 'carriage'; carriage.position.set(PIVOT[0], PIVOT[1], PIVOT[2]);
  grp.add(carriage);
  grp.userData.carriage = carriage;
  const place = () => {
    const b = propBuild(THREE, 'tram_cabin');
    const parts = b.geos.map((g, i) => ({ mat: b.prop.parts[i].mat, pos: g.attributes.position.array, nrm: g.attributes.normal.array, idx: g.index.array }));
    const P = plan(parts, o);
    const M = mats(THREE, HG);
    for (let i = 0; i < P.roles.length; i++) {
      const r = P.roles[i];
      const m = new THREE.Mesh(geo(THREE, r.geo.pos, r.geo.nrm, r.uv, r.geo.idx), M[r.role] || M.trim);
      m.castShadow = true; m.receiveShadow = true; (r.carriage ? carriage : grp).add(m);
    }
    if (P.glass) {
      const bag = K.Bag('glass');
      bag.setWin(1.2, 1.0, 0);
      const p = P.glass.pos, u = P.glass.uv, ix = P.glass.idx, vs = [];
      for (let i = 0; i < p.length / 3; i++) vs.push(bag.v([p[i * 3], p[i * 3 + 1], p[i * 3 + 2]], [u[i * 2], u[i * 2 + 1]]));
      for (let t = 0; t < ix.length; t += 3) bag.tri(vs[ix[t]], vs[ix[t + 1]], vs[ix[t + 2]]);
      bag.setWin(0);
      const gm = bag.mesh(grp, HG.MAT.glass);
      if (gm) gm.castShadow = false;
    }
    if (P.gaskets.idx.length) {
      const m = new THREE.Mesh(geo(THREE, P.gaskets.pos, P.gaskets.nrm, P.gaskets.uv, P.gaskets.idx), M.gasket);
      m.castShadow = false; grp.add(m);
    }
    if (P.decals.idx.length) {
      const m = new THREE.Mesh(geo(THREE, P.decals.pos, P.decals.nrm, P.decals.uv, P.decals.idx, { aUvN: { a: P.decals.uvN, n: 2 } }), decalMat(THREE, HG, o.livery || 'admiralty'));
      m.castShadow = false; grp.add(m);
    }
    grp.userData.plan = { gasketLoops: P.gaskets.loops, decalTris: P.decals.idx.length / 3 };
  };
  if (propReady('tram_cabin')) place();
  else propWarm('tram_cabin').then(place).catch(e => console.warn('cabin failed to load:', e && e.message));
  grp.userData.hang = HANG; grp.userData.pivot = PIVOT.slice(); grp.userData.ropeUp = ROPE_UP; grp.userData.tilt = TILT;
  return grp;
}

// THE SIGN (G349): a station's published sign slot { p, n, w, h, livery }
// gets the banner as a lit plane facing `n`
function signMesh(THREE, sign) {
  const L = (typeof CABIN_LIVERY !== 'undefined' && CABIN_LIVERY) ? CABIN_LIVERY[sign.livery || 'admiralty'] : null;
  const m = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05, color: 0xffffff });
  if (L) {
    const t = new THREE.Texture(L.img);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace;
    const ok = () => { t.needsUpdate = true; };
    if (L.img.complete && L.img.naturalWidth) ok(); else L.img.addEventListener('load', ok);
    m.map = t;
  }
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(sign.w, sign.h), m);
  mesh.position.set(sign.p[0], sign.p[1], sign.p[2]);
  mesh.lookAt(sign.p[0] + sign.n[0], sign.p[1] + sign.n[1], sign.p[2] + sign.n[2]);
  mesh.castShadow = false;
  return mesh;
}

const API = { plan, build, signMesh, prepare, bevelSmooth, splitCarriage, ROLE, BANNER, HANG, PIVOT, ROPE_UP, WHEEL_R, TILT, LIVERIES: ['admiralty', 'chatham'], boundaryLoops, chaikin, resample, clipRect };
if (typeof window !== 'undefined') window.CABIN = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
