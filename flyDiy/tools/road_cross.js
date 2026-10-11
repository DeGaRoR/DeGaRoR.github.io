// ROAD CROSS (G2956): where a road's DRAWN line meets what it must not cross unannounced - a runway's box, a stand, a
// taxi route, a paved area (an apron, a pad), another road - and whether it meets it at a shared waypoint (a junction).
//   node tools/road_cross.js ROAD_ID [--file tools/fixtures/island_jolene.json] [--json]
// Read only. A road's drawn line is its spline (roadLine); a runway's box its paved width; a stand a disc of 12 m.
'use strict';
const fs = require('fs');
const path = require('path');
const PG = require(path.join(__dirname, '..', 'src', 'core', '27_premises.js'));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const RID = process.argv[2], FILE = arg('--file', path.join(__dirname, 'fixtures', 'island_jolene.json'));
const rec = PG.unwrap(fs.readFileSync(FILE, 'utf8')).rec, R = PG.expandAreas ? PG.expandAreas(rec) : rec;
const road = rec.layers.roads.find(r => r.id === RID);
if (!road) { console.log('road_cross: no road ' + RID); process.exit(1); }
const line = PG.roadLine(road), hw = (+road.w || 3.6) / 2;
const cross = (a, b, c, d) => { const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0]; if (Math.abs(den) < 1e-12) return null; const q = [c[0] - a[0], c[1] - a[1]], t = (q[0] * s[1] - q[1] * s[0]) / den, u = (q[0] * r[1] - q[1] * r[0]) / den; return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + r[0] * t, a[1] + r[1] * t] : null; };
const hits = (P, closed) => { const out = []; const n = closed ? P.length : P.length - 1; for (let i = 0; i + 1 < line.length; i++) for (let k = 0; k < n; k++) { const x = cross(line[i], line[i + 1], P[k], P[(k + 1) % P.length]); if (x) out.push(x); } return out; };
const xy = p => '(' + p[0].toFixed(1) + ', ' + p[1].toFixed(1) + ')';
const nearWp = (p, other) => { let best = Infinity; for (const w of road.pts) for (const q of (other || [])) best = Math.min(best, Math.hypot(w[0] - q[0], w[1] - q[1])); return best; };
const out = { road: RID, pts: road.pts.length, drawn: line.length, runways: [], stands: [], taxi: [], areas: [], roads: [] };
for (const r0 of rec.layers.runways) {
  const r = Object.assign({}, PG.RUNWAY_DEF, r0); if (!r.c || !(r.len > 0)) continue;
  const box = PG.runwayBox(r, hw), h = hits(box, true), inside = line.some(p => PG.inPoly(box, p[0], p[1]));
  if (h.length || inside) out.runways.push({ id: r.id, name: r.name, water: PG.runwayIsWater(r), at: h.map(xy), inside });
  for (const st of [r.stand, r.hangar].filter(Boolean)) { let d = Infinity; for (let i = 0; i + 1 < line.length; i++) d = Math.min(d, PG.distPtSeg(st.x, st.z, line[i], line[i + 1])); if (d < hw + 12) out.stands.push({ runway: r.id, at: xy([st.x, st.z]), d: +d.toFixed(1) }); }
  for (const k of ['taxiOut', 'taxiOut1']) if (Array.isArray(r[k]) && r[k].length > 1) { const h2 = hits(r[k], false); if (h2.length) out.taxi.push({ runway: r.id, route: k, at: h2.map(xy) }); }
}
for (const k of ['material', 'surface']) for (const e of R.layers[k] || []) {
  if (!e.poly || e.poly.length < 3) continue;
  const paved = k === 'material' ? !!(e.look && PG.RUNWAY_LOOKS[e.look] && PG.RUNWAY_LOOKS[e.look].cls) : +e.surface === PG.SURFACE.PAVED;
  if (!paved) continue;
  const h = hits(e.poly, true); if (h.length) out.areas.push({ id: e.id, layer: k, at: h.map(xy) });
}
for (const q of rec.layers.roads) {
  if (q === road || !q.pts || q.pts.length < 2) continue;
  const h = hits(PG.roadLine(q), false); if (!h.length) continue;
  const shared = Array.isArray(road.nodes) && Array.isArray(q.nodes) && road.nodes.some(id => id && q.nodes.indexOf(id) >= 0);
  out.roads.push({ id: q.id, at: h.slice(0, 6).map(xy), n: h.length, junction: shared, nearestWaypoints: +nearWp(null, q.pts).toFixed(1) });
}
if (process.argv.indexOf('--json') > 0) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }
console.log('ROAD CROSS ' + RID + ' (' + out.pts + ' points, ' + out.drawn + ' drawn) in ' + path.relative(process.cwd(), FILE));
const sec = (t, a, f) => { console.log('  ' + t + ': ' + a.length); for (const j of a) console.log('    ' + f(j)); };
sec('runway boxes crossed or entered', out.runways, j => j.id + ' ' + (j.name || '') + (j.water ? ' (a sea lane)' : '') + ' at ' + (j.at.join(' ') || '-') + (j.inside ? ' (drawn inside it)' : ''));
sec('stands / hangars within the width + 12 m', out.stands, j => j.runway + ' ' + j.at + ' ' + j.d + ' m');
sec('taxi routes crossed', out.taxi, j => j.runway + ' ' + j.route + ' at ' + j.at.join(' '));
sec('paved areas crossed (aprons, pads)', out.areas, j => j.id + ' (' + j.layer + ') at ' + j.at.join(' '));
sec('roads crossed', out.roads, j => j.id + ' x' + j.n + ' at ' + j.at.join(' ') + (j.junction ? ' - a shared junction' : ' - NO junction (its nearest waypoints ' + j.nearestWaypoints + ' m apart)'));
