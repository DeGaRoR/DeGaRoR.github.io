// ROAD REVIEW and ROAD JOIN (G2954 ROAD-GRAPH): a place's road network read as a graph - what joins, what does not -
// and, asked, made one graph of junctions at waypoints.
//   node tools/road_review.js [--prefix mk_] [--file tools/fixtures/island_jolene.json] [--tol 1.5] [--gap 15] [--json]
//   node tools/road_review.js --join [--out patch.json]   the joins made on a copy; the patch for tools/road_patch.py
// THE REVIEW, for the roads whose id starts with the prefix: every road's ends and spans against every other road's -
//   an END within `tol` of another road's WAYPOINT (a join waiting for its id), an end within `tol` of the MIDDLE of a span
//   (a T with no waypoint there), two spans CROSSING between waypoints (a crossing with none), two waypoints on one spot
//   without a shared id, an end SHORT of a street by under `gap` metres (a gap: drawn, not joined), spans along each
//   other, the ends that touch nothing (dead ends - a place's edge or a cul-de-sac), the groups by touch and by id.
// THE JOIN (the user: roads join ONLY at waypoints): a waypoint inserted on both spans at a crossing and on the through
//   span at a T (the point exactly the end's), an end within `tol` of a waypoint moved onto it, an end short of a street
//   by under `--short` metres taken onto it (its waypoint, or one inserted square to the end) - both only with `--move M`
//   (the most an end is moved; default 1 cm: the place's plots are sown along its streets, a moved end re-sows them) - and
//   then every spot two
//   roads' waypoints share is ONE junction id (`<prefix>j<n>`, beside `pts` in `nodes`). Nothing else of a road changes: a
//   waypoint inserted lies on its straight span (a fillet road's corner of nought - the line drawn the same).
'use strict';
require('./_core_math_global.js');   // (T41b: CORE_MATH before a core file required alone - 00_registry's)
const fs = require('fs');
const path = require('path');
const PG = require(path.join(__dirname, '..', 'src', 'core', '27_premises.js'));

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const has = k => process.argv.indexOf(k) > 0;
const PREFIX = arg('--prefix', 'mk_'), FILE = arg('--file', path.join(__dirname, 'fixtures', 'island_jolene.json')), TOL = +arg('--tol', 1.5), GAP = +arg('--gap', 15), MOVE = +arg('--move', 0.01), SHORT = Math.max(MOVE, +arg('--short', 0));
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const segD = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1e-9, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)); return [Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t), t]; };
// two segments crossing: [t on ab, u on cd] or null
const cross = (a, b, c, d) => { const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0]; if (Math.abs(den) < 1e-12) return null; const q = [c[0] - a[0], c[1] - a[1]], t = (q[0] * s[1] - q[1] * s[0]) / den, u = (q[0] * r[1] - q[1] * r[0]) / den; return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [t, u] : null; };
const jid = (r, i) => (Array.isArray(r.nodes) ? r.nodes[i] || null : null);
const xy = p => '(' + p[0].toFixed(1) + ', ' + p[1].toFixed(1) + ')';
const c2 = v => Math.round(v * 100) / 100;

function analyse(rec) {
  const roads = rec.layers.roads.filter(r => r && Array.isArray(r.pts) && r.pts.length >= 2 && (!PREFIX || r.id.startsWith(PREFIX)));
  const others = rec.layers.roads.filter(r => r && Array.isArray(r.pts) && r.pts.length >= 2 && roads.indexOf(r) < 0);
  const out = { roads: roads.length, joins: [], tees: [], crossings: [], stacked: [], gaps: [], overlaps: [], dead: [], groups: null };
  const par = new Map(roads.map(r => [r.id, r.id]));
  const find = x => { while (par.get(x) !== x) { par.set(x, par.get(par.get(x))); x = par.get(x); } return x; };
  const join = (a, b) => { a = find(a); b = find(b); if (a !== b) par.set(a, b); };
  const isEnd = (r, i) => i === 0 || i === r.pts.length - 1;
  for (const r of roads) {
    for (const end of [0, r.pts.length - 1]) {
      const p = r.pts[end];
      let touched = false, gap = null;
      for (const q of roads) {
        if (q === r) continue;
        let wi = -1, wd = Infinity; q.pts.forEach((w, i) => { const d = d2(p, w); if (d < wd) { wd = d; wi = i; } });
        if (wd <= TOL) {
          touched = true; join(r.id, q.id);
          if (!(jid(r, end) && jid(r, end) === jid(q, wi)) && (r.id < q.id || !isEnd(q, wi))) out.joins.push({ road: r.id, end, at: p, onto: q.id, waypoint: wi, d: +wd.toFixed(2) });
          continue;
        }
        let best = null; for (let i = 0; i + 1 < q.pts.length; i++) { const [d, t] = segD(p, q.pts[i], q.pts[i + 1]); if (t > 0.0005 && t < 0.9995 && (!best || d < best.d)) best = { d, span: i, t }; }
        if (best && best.d <= TOL) { touched = true; join(r.id, q.id); out.tees.push({ road: r.id, end, at: p, onto: q.id, span: best.span, t: best.t, d: +best.d.toFixed(2) }); }
        else { const dn = Math.min(wd, best ? best.d : Infinity); if (dn <= GAP && (!gap || dn < gap.d)) gap = { road: r.id, end, at: p, onto: q.id, d: +dn.toFixed(1), waypoint: wd <= (best ? best.d : Infinity) ? wi : -1, span: best ? best.span : -1, t: best ? best.t : 0 }; }
      }
      if (!touched && gap) out.gaps.push(gap);
      if (!touched) {
        let near = null; for (const q of others) for (let i = 0; i + 1 < q.pts.length; i++) { const [d] = segD(p, q.pts[i], q.pts[i + 1]); if (!near || d < near.d) near = { road: q.id, d }; }
        out.dead.push({ road: r.id, end, at: p, gap: !!gap, nearestOutside: near ? { road: near.road, d: +near.d.toFixed(1) } : null });
      }
    }
    for (let i = 1; i + 1 < r.pts.length; i++) for (const q of roads) {
      if (q === r) continue;
      q.pts.forEach((w, k) => { if (!isEnd(q, k) && r.id < q.id && d2(r.pts[i], w) <= TOL) join(r.id, q.id); if (!isEnd(q, k) && r.id < q.id && d2(r.pts[i], w) <= TOL && !(jid(r, i) && jid(r, i) === jid(q, k))) { out.stacked.push({ road: r.id, waypoint: i, at: r.pts[i], onto: q.id, theirs: k, d: +d2(r.pts[i], w).toFixed(2) }); } });
    }
  }
  // crossings between waypoints: both spans' interiors (an end or a waypoint on the other is a T or a join above)
  for (let a = 0; a < roads.length; a++) for (let b = a + 1; b < roads.length; b++) {
    const R = roads[a], Q = roads[b];
    for (let i = 0; i + 1 < R.pts.length; i++) for (let k = 0; k + 1 < Q.pts.length; k++) {
      const X = cross(R.pts[i], R.pts[i + 1], Q.pts[k], Q.pts[k + 1]); if (!X) continue;
      const [t, u] = X, lr = d2(R.pts[i], R.pts[i + 1]), lq = d2(Q.pts[k], Q.pts[k + 1]);
      if (t * lr <= TOL || (1 - t) * lr <= TOL || u * lq <= TOL || (1 - u) * lq <= TOL) continue;
      join(R.id, Q.id);
      out.crossings.push({ a: R.id, span: i, t, b: Q.id, spanB: k, u, at: [R.pts[i][0] + (R.pts[i + 1][0] - R.pts[i][0]) * t, R.pts[i][1] + (R.pts[i + 1][1] - R.pts[i][1]) * t] });
    }
    let run = 0;
    for (let i = 0; i + 1 < R.pts.length; i++) { const A = R.pts[i], B = R.pts[i + 1], L = d2(A, B), n = Math.max(1, Math.ceil(L / 2)); for (let s = 0; s <= n; s++) { const p = [A[0] + (B[0] - A[0]) * s / n, A[1] + (B[1] - A[1]) * s / n]; let dm = Infinity; for (let k = 0; k + 1 < Q.pts.length; k++) dm = Math.min(dm, segD(p, Q.pts[k], Q.pts[k + 1])[0]); if (dm <= TOL) run += L / n; } }
    if (run > 10) out.overlaps.push({ a: R.id, b: Q.id, metres: +run.toFixed(0) });
  }
  const groups = new Map(); for (const r of roads) { const k = find(r.id); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r.id); }
  out.groups = Array.from(groups.values()).sort((p, q) => q.length - p.length);
  const W = { id: 'flat', terrainH: () => 0, waterH: () => -100 };
  const G = PG.compose(rec, W, { raster: false }).roadGraph(), mine = new Set(roads.map(r => r.id));
  out.components = G.components().map(c => c.filter(id => G.node(id).roads.some(r => mine.has(r)))).filter(c => c.length).map(c => ({ nodes: c.length, roads: Array.from(new Set([].concat(...c.map(id => G.node(id).roads)))).filter(r => mine.has(r)) }));
  out.junctions = G.nodes.filter(n => n.roads.length > 1 && n.roads.some(r => mine.has(r))).length;
  out.connections = G.nodes.filter(n => n.conn && n.roads.some(r => mine.has(r))).map(n => ({ id: n.id, name: n.name || null, at: [+n.lx.toFixed(1), +n.lz.toFixed(1)], roads: n.roads }));
  return out;
}

// THE JOIN, on the record given (mutated): returns what it did
function joinPlace(rec) {
  const A = analyse(rec), byId = new Map(rec.layers.roads.map(r => [r.id, r]));
  const did = { inserted: 0, moved: 0, junctions: 0 };
  // the waypoints to insert, by road and span: [t, point]
  const cuts = new Map(); const cut = (id, span, t, p) => { const k = id + '#' + span; if (!cuts.has(k)) cuts.set(k, { id, span, at: [] }); cuts.get(k).at.push([t, p]); };
  for (const c of A.crossings) { const p = [c2(c.at[0]), c2(c.at[1])]; cut(c.a, c.span, c.t, p); cut(c.b, c.spanB, c.u, p); }
  for (const t of A.tees) if (t.d <= MOVE) cut(t.onto, t.span, t.t, [t.at[0], t.at[1]]);   // (a T off the span's line by more would bend the street)
  // an end SHORT of a street by under SHORT metres (drawn to meet it, the data a little off): onto the street - its
  // waypoint, or a waypoint inserted where the end falls square on its span
  for (const g of A.gaps) {
    if (g.d > SHORT) continue;
    const r = byId.get(g.road), q = byId.get(g.onto);
    let p;
    if (g.waypoint >= 0) p = [q.pts[g.waypoint][0], q.pts[g.waypoint][1]];
    else { const a = q.pts[g.span], b = q.pts[g.span + 1]; p = [c2(a[0] + (b[0] - a[0]) * g.t), c2(a[1] + (b[1] - a[1]) * g.t)]; cut(g.onto, g.span, g.t, p); }
    r.pts[g.end] = p.concat(r.pts[g.end].slice(2)); did.moved++;
  }
  // the ends by a waypoint: onto it (moved by under tol)
  for (const j of A.joins) { const r = byId.get(j.road), q = byId.get(j.onto); if (j.d > MOVE) { did.left = (did.left || 0) + 1; continue; } if (j.d > 0) { r.pts[j.end] = [q.pts[j.waypoint][0], q.pts[j.waypoint][1]].concat(r.pts[j.end].slice(2)); did.moved++; } }
  for (const s of A.stacked) { const r = byId.get(s.road), q = byId.get(s.onto); if (s.d > MOVE) continue; if (s.d > 0) { r.pts[s.waypoint] = [q.pts[s.theirs][0], q.pts[s.theirs][1]].concat(r.pts[s.waypoint].slice(2)); did.moved++; } }
  // the inserts, the last span first and the furthest along a span first (the indices before them hold)
  const list = Array.from(cuts.values()).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : b.span - a.span));
  for (const C of list) {
    const r = byId.get(C.id), at = C.at.sort((p, q) => q[0] - p[0]);
    for (const [, p] of at) {
      if (r.pts.some(w => w[0] === p[0] && w[1] === p[1])) continue;
      r.pts.splice(C.span + 1, 0, p.slice());
      for (const k of ['tan', 'nodes']) if (Array.isArray(r[k])) r[k].splice(C.span + 1, 0, null);
      did.inserted++;
    }
  }
  // every spot two of the place's waypoints share: one junction id
  const spots = new Map();
  for (const r of rec.layers.roads) if (r && r.id.startsWith(PREFIX)) r.pts.forEach((w, i) => { const k = c2(w[0]) + ',' + c2(w[1]); if (!spots.has(k)) spots.set(k, []); spots.get(k).push([r, i]); });
  let n = 0; const used = PG.junctionIds(rec);
  for (const [, S] of spots) {
    if (new Set(S.map(q => q[0].id)).size < 2) continue;
    let id = S.map(([r, i]) => jid(r, i)).find(Boolean);
    if (!id) { do { id = PREFIX + 'j' + (++n); } while (used.has(id)); used.add(id); did.junctions++; }
    for (const [r, i] of S) { if (!Array.isArray(r.nodes)) r.nodes = r.pts.map(() => null); while (r.nodes.length < r.pts.length) r.nodes.push(null); r.nodes[i] = id; }
  }
  return did;
}

function report(out, title) {
  console.log(title);
  console.log('  by touch: ' + out.groups.length + ' group(s) ' + out.groups.map(g => g.length).join(' + ') + ' · by junction ids: ' + out.components.length + ' component(s), ' + out.junctions + ' junction(s)');
  const sec = (t, a, f) => { console.log('  ' + t + ': ' + a.length); for (const j of a) console.log('    ' + f(j)); };
  sec('ends on a waypoint, no shared id (a join to make)', out.joins, j => j.road + ':' + (j.end ? 1 : 0) + ' ' + xy(j.at) + ' on ' + j.onto + ' waypoint ' + (j.waypoint + 1) + ' (' + j.d + ' m)');
  sec('ends on the middle of a span (a T: a waypoint to insert)', out.tees, j => j.road + ':' + (j.end ? 1 : 0) + ' ' + xy(j.at) + ' on ' + j.onto + ' span ' + (j.span + 1) + ' (' + j.d + ' m)');
  sec('spans crossing between waypoints (a crossing: a waypoint on each)', out.crossings, j => j.a + ' x ' + j.b + ' ' + xy(j.at));
  sec('waypoints on another road\'s waypoint, no shared id', out.stacked, j => j.road + ' waypoint ' + (j.waypoint + 1) + ' ' + xy(j.at) + ' on ' + j.onto + ' waypoint ' + (j.theirs + 1));
  sec('ends short of a street (a gap under ' + GAP + ' m - drawn, not joined)', out.gaps, j => j.road + ':' + (j.end ? 1 : 0) + ' ' + xy(j.at) + ' ' + j.d + ' m from ' + j.onto);
  sec('spans along each other (> 10 m)', out.overlaps, j => j.a + ' / ' + j.b + ' ' + j.metres + ' m');
  sec('dead ends (touch nothing of the place)', out.dead.filter(d => !d.gap), j => j.road + ':' + (j.end ? 1 : 0) + ' ' + xy(j.at) + (j.nearestOutside ? ' (nearest road outside: ' + j.nearestOutside.road + ' ' + j.nearestOutside.d + ' m)' : ''));
  sec('connection points', out.connections, c => c.id + ' ' + (c.name || '') + ' ' + xy(c.at) + ' ' + c.roads.join(', '));
  if (out.components.length > 1) console.log('  the components: ' + out.components.map(c => c.roads.length + ' road(s) [' + c.roads.slice(0, 6).join(' ') + (c.roads.length > 6 ? ' ...' : '') + ']').join(' | '));
}

if (require.main === module) {
  const txt = fs.readFileSync(FILE, 'utf8'), U = PG.unwrap(txt), rec = U.rec;
  const title = f => 'ROAD ' + f + ' ' + path.relative(process.cwd(), FILE) + ' · roads ' + (PREFIX || '(all)') + ' · tolerance ' + TOL + ' m';
  if (!has('--join')) {
    const out = analyse(rec);
    if (has('--json')) console.log(JSON.stringify(out, null, 1)); else report(out, title('REVIEW') + ': ' + out.roads);
  } else {
    // (passes until nothing is left to join: an end taken onto a street can make a crossing of its own)
    const did = { inserted: 0, moved: 0, junctions: 0 }; let out = null;
    for (let pass = 0; pass < 4; pass++) { const d = joinPlace(rec); for (const k in did) did[k] += d[k]; out = analyse(rec); if (!out.joins.some(j => j.d <= MOVE) && !out.tees.some(t => t.d <= MOVE) && !out.crossings.length && !out.stacked.some(t => t.d <= MOVE) && !out.gaps.some(g => g.d <= SHORT)) break; }
    report(out, title('JOIN') + ': inserted ' + did.inserted + ' waypoint(s), moved ' + did.moved + ' end(s), ' + did.junctions + ' junction id(s)');
    // --out PATCH.json: the place's roads' new points and junction ids, by id (tools/road_patch.py writes them into the
    // fixture keeping its every other byte - a Python-written record: its 2600.0 stays 2600.0)
    const OUT = arg('--out', null);
    if (OUT) { const P = { roads: {}, junctions: rec.layers.junctions || [] }; const raw = (JSON.parse(txt).layers || JSON.parse(txt).premises.layers).roads;
      for (const r of rec.layers.roads) { if (!r.id.startsWith(PREFIX)) continue; const o = raw.find(q => q.id === r.id); if (o && JSON.stringify(o.pts) === JSON.stringify(r.pts) && !r.nodes) continue; P.roads[r.id] = { pts: r.pts, nodes: r.nodes || null }; }
      fs.writeFileSync(OUT, JSON.stringify(P)); console.log('  the patch: ' + Object.keys(P.roads).length + ' road(s) -> ' + OUT); }
  }
}
module.exports = { analyse, joinPlace };
