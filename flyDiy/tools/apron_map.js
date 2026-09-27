#!/usr/bin/env node
// APRON MAP (G772) — Jolene's club apron from above, the taxi routes the pilot flies drawn on it, and
// every route's wingtip clearance to what stands beside it, in numbers.
//
// The user (2026-09-27): "Is the taxiway optimized? I have the feeling the plane is taking the wrong way
// out of the hangar. In the 'V' shape out of the hangar, it should take right and it takes left, is it?"
// A picture answers that only if it is drawn from the SAME data the pilot plans on: the premises record
// (tools/fixtures/island_jolene.json - the pavement, the two painted taxiways, the fence, the club, the
// parked aircraft) and the pattern the core builds from it (sitePattern -> patternPath, the line the
// aeroplane steers to), for both take-off directions.
//
//   node tools/apron_map.js                        -> tools/perf/apron_jolene.svg + the clearance table
//   node tools/apron_map.js --out file.svg --span 11.0 [--wide]    (--wide: out to the runway)
//   node tools/apron_map.js --taxiOut "x,z;x,z;.." --taxiOut1 "x,z;.."   (try a way out before authoring it)
//   node tools/apron_map.js --fixture old_island_jolene.json      (another rev of the record, for a before/after)
//
// CLEARANCE: the taxiing aeroplane as its span swept along the path (a disc of span/2 round each 1 m
// sample - conservative in a turn), against each parked aircraft as its fuselage and wing lines (the
// archetype's span and length) and each fence run as a line; the table prints the least clearance per
// route and what it is to. Negative = a wing over something.
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname;
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = opt('out', path.join(T, 'perf', 'apron_jolene.svg'));
const SPAN = +opt('span', 11.0);          // the user's aluminium C172 is 11.0 m; the Cub 10.7
const WIDE = argv.includes('--wide');
const pts = s => s ? s.split(';').map(q => q.split(',').map(Number)) : null;

const F = JSON.parse(fs.readFileSync(opt('fixture', path.join(T, 'fixtures', 'island_jolene.json')), 'utf8'));   // --fixture: another rev (git show HEAD~n:... > file)
const L = F.layers;
const home = L.runways.find(r => r.id === 'HOME');
if (opt('taxiOut')) home.taxiOut = pts(opt('taxiOut'));
if (opt('taxiOut1')) home.taxiOut1 = pts(opt('taxiOut1'));
const W = IN.islandWorld('jolene', { premises: JSON.stringify(F) });
const aero = W.aerodromes.find(a => a.id === 'HOME');
const site = C.siteOf('HOME');
const P = C.sitePattern(aero, site);
const R = C.siteRunway(aero);

// ---- what stands beside the way out ---------------------------------------------------------
const ARCH = { 'arch:cub': { span: 10.7, len: 6.8 }, 'arch:c172': { span: 11.0, len: 8.3 }, 'arch:jodel': { span: 8.2, len: 6.4 } };
const parked = L.objects.filter(o => o.kind === 'aircraft').map(o => {
  const A = ARCH[o.key] || { span: 10, len: 7 };
  const nx = -Math.sin(o.yaw), nz = Math.cos(o.yaw);          // the premises' yaw: -pi/2 faces +x (east)
  const wx = -nz, wz = nx, w0 = 0.3 * A.len;                   // the wing a third back from the nose
  const nose = [o.x + nx * A.len * 0.45, o.z + nz * A.len * 0.45], tail = [o.x - nx * A.len * 0.55, o.z - nz * A.len * 0.55];
  const wc = [nose[0] - nx * w0, nose[1] - nz * w0];
  return { id: o.id, key: o.key, x: o.x, z: o.z, segs: [[nose, tail], [[wc[0] + wx * A.span / 2, wc[1] + wz * A.span / 2], [wc[0] - wx * A.span / 2, wc[1] - wz * A.span / 2]]] };
});
const club = L.sites.find(s => s.id === 's_club');
const fences = (club.fences || []).map((f, i) => ({ id: 'fence' + i, segs: [[f.a, f.b]] }));
const segDist = (p, a, b) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1e-9;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
};
// the part of the way out that is ON THE APRON (to the first 150 m, where things are parked)
function clearance(path) {
  let best = { c: Infinity, what: '-', s: 0 };
  for (const q of path.pts) {
    if (q.s > 150) break;
    for (const o of parked.concat(fences)) for (const [a, b] of o.segs) {
      const c = segDist([q.x, q.z], a, b) - SPAN / 2;
      if (c < best.c) best = { c, what: o.id + (o.key ? ' (' + o.key.slice(5) + ')' : ''), s: q.s };
    }
  }
  return best;
}

// ---- the routes the pilot flies, both take-off directions -----------------------------------------
const routes = [0, 1].map(T => {
  const ids = P.routes.out[T];
  const pp = C.patternPath(P, ids, 1.0);
  const last = pp.pts[pp.pts.length - 1];
  const byId = {}; for (const n of P.nodes) byId[n.id] = n;
  // where it meets the strip, and the runway it then backtracks along to its hold
  const alOf = (x, z) => (x - R.end0.x) * R.dx + (z - R.end0.z) * R.dz;
  const entry = byId[ids.find(i => i === 'c0' || i === 'c1')];
  const hold = byId[ids[ids.length - 1]];
  return { T, ids, pp, hold, entry, len: pp.len, clr: clearance(pp),
           entryAl: entry ? alOf(entry.x, entry.z) : null, holdAl: alOf(hold.x, hold.z),
           rwy: T === 0 ? '13 (off the NW end, along +hdg)' : '31 (off the SE end, along -hdg)', last };
});
console.log('apron_map: Jolene HOME ' + R.len + ' m x ' + R.wid + ' m, stand (' + site.stand.x + ', ' + site.stand.z + '), span ' + SPAN + ' m');
for (const r of routes) {
  const onRwy = r.entryAl != null ? Math.abs(r.holdAl - r.entryAl) : 0;
  console.log('  runway ' + r.rwy + ': ' + r.ids.join(' > '));
  console.log('    taxi ' + r.len.toFixed(0) + ' m, of which ' + onRwy.toFixed(0) + ' m back along the runway (entry ' +
              (r.entryAl != null ? r.entryAl.toFixed(0) : '-') + ' m from the NW end, hold ' + r.holdAl.toFixed(0) + ' m); ' +
              'the take-off has ' + (r.T === 0 ? R.len - r.holdAl : r.holdAl).toFixed(0) + ' m ahead of the hold' +
              (r.entryAl != null ? ' (' + (r.T === 0 ? R.len - r.entryAl : r.entryAl).toFixed(0) + ' m from the entry)' : ''));
  console.log('    wingtip clearance on the apron: ' + r.clr.c.toFixed(1) + ' m to ' + r.clr.what + ' at ' + r.clr.s.toFixed(0) + ' m');
}

// ---- the picture ----------------------------------------------------------------------------------
const box = WIDE ? { x0: -330, x1: 620, z0: 380, z1: 1010 } : { x0: -240, x1: 240, z0: 420, z1: 790 };
const S = WIDE ? 1.25 : 2.6, Wd = Math.round((box.x1 - box.x0) * S), Ht = Math.round((box.z1 - box.z0) * S);
const X = x => ((x - box.x0) * S).toFixed(1), Z = z => ((z - box.z0) * S).toFixed(1);
const poly = (p, st) => '<polygon points="' + p.map(q => X(q[0]) + ',' + Z(q[1])).join(' ') + '" ' + st + '/>';
const line = (p, st) => '<polyline points="' + p.map(q => X(q[0]) + ',' + Z(q[1])).join(' ') + '" fill="none" ' + st + '/>';
const txt = (x, z, s, st) => '<text x="' + X(x) + '" y="' + Z(z) + '" ' + (st || '') + '>' + s + '</text>';
const g = [];
g.push('<rect width="100%" height="100%" fill="#6f8a55"/>');
// the runways (13/31 and the crossing 02/20), and their painted centrelines
for (const a of W.aerodromes.filter(a => !a.water && Math.hypot(a.x - (box.x0 + box.x1) / 2, a.z - (box.z0 + box.z1) / 2) < a.len / 2 + 1500)) {
  const Q = C.siteRunway(a);
  const rc = [[Q.end0.x + Q.nx * Q.wid / 2, Q.end0.z + Q.nz * Q.wid / 2], [Q.end1.x + Q.nx * Q.wid / 2, Q.end1.z + Q.nz * Q.wid / 2],
              [Q.end1.x - Q.nx * Q.wid / 2, Q.end1.z - Q.nz * Q.wid / 2], [Q.end0.x - Q.nx * Q.wid / 2, Q.end0.z - Q.nz * Q.wid / 2]];
  g.push(poly(rc, 'fill="#8d8d88" stroke="#5c5c58"'));
  g.push(line([[Q.end0.x, Q.end0.z], [Q.end1.x, Q.end1.z]], 'stroke="#fff" stroke-width="' + (0.9 * S).toFixed(1) + '" stroke-dasharray="' + (11 * S) + ',' + (18 * S) + '"'));
}
// the pavement: the pad, the parking apron, the taxiway beds
for (const e of L.surface.concat(L.material)) if (e.poly && e.poly.some(q => q[0] > box.x0 && q[0] < box.x1 && q[1] > box.z0 && q[1] < box.z1) && e.poly.length < 40)
  g.push(poly(e.poly, 'fill="#9a968c" fill-opacity="0.85" stroke="none"'));
// the two painted taxiways: the ribbon, and the yellow centreline the paint carries (the road's own fillet)
const PG = C.PREMISES_GEN;
for (const rd of L.roads.filter(r => /^r_taxi/.test(r.id))) {
  const pr = PG && PG.polyRoad ? PG.polyRoad(rd.pts, rd.w) : null;
  const cl = pr && pr.pts ? pr.pts : rd.pts;
  g.push(line(cl, 'stroke="#a19d93" stroke-width="' + (rd.w * S).toFixed(1) + '" stroke-linejoin="round"'));
  g.push(line(cl, 'stroke="#e8c330" stroke-width="' + (0.5 * S).toFixed(1) + '"'));
  const m = rd.pts[Math.min(1, rd.pts.length - 1)];
  g.push(txt(m[0] + 14, m[1] - 3, rd.id === 'r_taxi_ne' ? 'painted taxiway NE (left arm)' : 'painted taxiway E (right arm)', 'fill="#3a3000" font-size="' + (WIDE ? 11 : 13) + '" font-family="sans-serif"'));
}
// the fence
for (const f of club.fences || []) g.push(line([f.a, f.b], 'stroke="#5a3b1c" stroke-width="' + (0.6 * S).toFixed(1) + '"'));
// the club's buildings (their centres, named) and the hangar the aeroplane leaves
const toW = (lx, lz) => [club.at.x + lz, club.at.z - lx];
for (const it of club.items) { const w = toW(it.x, it.z); g.push('<circle cx="' + X(w[0]) + '" cy="' + Z(w[1]) + '" r="' + (3 * S) + '" fill="#7a5c45"/>'); g.push(txt(w[0] - 10, w[1] + 7, it.id, 'fill="#2b1d10" font-size="11" font-family="sans-serif"')); }
if (site.hangar) { const h = site.hangar; g.push(poly([[h.x - 12.5, h.z - 15], [h.x + 12.5, h.z - 15], [h.x + 12.5, h.z + 15], [h.x - 12.5, h.z + 15]], 'fill="#6b4a3a" stroke="#2b1d10"')); g.push(txt(h.x - 10, h.z + 3, 'club hangar', 'fill="#fff" font-size="12" font-family="sans-serif"')); }
// parked aircraft
for (const o of parked) {
  for (const [a, b] of o.segs) g.push(line([a, b], 'stroke="#d8d8e8" stroke-width="' + (1.1 * S).toFixed(1) + '" stroke-linecap="round"'));
  g.push(txt(o.x + 4, o.z - 5, o.id + ' ' + o.key.slice(5), 'fill="#1d1d40" font-size="11" font-family="sans-serif"'));
}
// the routes: the path, its wingtip envelope, the hold
const COL = ['#d0392b', '#1f6fd1'];
for (const r of routes) {
  const p = r.pp.pts.map(q => [q.x, q.z]);
  g.push(line(p, 'stroke="' + COL[r.T] + '" stroke-opacity="0.18" stroke-width="' + (SPAN * S).toFixed(1) + '" stroke-linejoin="round"'));
  g.push(line(p, 'stroke="' + COL[r.T] + '" stroke-width="' + (1.2 * S).toFixed(1) + '"'));
  g.push('<circle cx="' + X(r.hold.x) + '" cy="' + Z(r.hold.z) + '" r="' + (3 * S) + '" fill="' + COL[r.T] + '"/>');
}
g.push('<circle cx="' + X(site.stand.x) + '" cy="' + Z(site.stand.z) + '" r="' + (2.5 * S) + '" fill="#fff" stroke="#000"/>');
g.push(txt(site.stand.x + 5, site.stand.z + 12, 'stand', 'fill="#000" font-size="13" font-family="sans-serif"'));
// north arrow and legend
g.push(txt(10, 0, '', ''));
const lg = ['N is up (world -z). Red: the way out for runway 13 (NW end). Blue: for runway 31 (SE end, the calm-day choice).',
            'Shaded band: the taxiing wing (' + SPAN + ' m span). Yellow: the painted taxiway centrelines.'];
lg.forEach((s, i) => g.push('<text x="10" y="' + (18 + 16 * i) + '" fill="#111" font-size="13" font-family="sans-serif">' + s + '</text>'));
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + Wd + '" height="' + Ht + '" viewBox="0 0 ' + Wd + ' ' + Ht + '">' + g.join('\n') + '</svg>\n';
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, svg);
console.log('  wrote ' + OUT + ' (' + Wd + ' x ' + Ht + ')');
