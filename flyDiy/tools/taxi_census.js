#!/usr/bin/env node
// taxi_census.js - THE TAXI CENSUS, AS A REPORT (MILL-TAXI, G1925-G1929). GATE TAXICLEAR (6-7) asserts it; this prints
// it whole - every stand, parked box, route and roll of Jolene for every validated build, and the procedural world's -
// with each one's clearance to the nearest solid thing (tools/_taxiclear_lib.js) against its need (half-span + 3 m).
//
//   node tools/taxi_census.js                          the table (violations first), Jolene + seeds 0 1 6 12 42
//   node tools/taxi_census.js --json out.json          ...and every row as JSON
//   node tools/taxi_census.js --seeds 0,7,12345        other procedural seeds (none: --seeds none)
//   node tools/taxi_census.js --svg mn_strip out.svg [--r 180] [--scale 3]
//        [--at x,z]                                    (the plan's centre; default the runway's)
//                                                      a plan of one stand: the footprints (houses and items red,
//                                                      outbuildings pink, props orange, cars blue, parked aeroplanes
//                                                      purple, trunks green), the strip, every route of the widest
//                                                      build with its half-span + 3 m band, the nodes
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname;
const PT = require(path.join(T, 'pilot_trace.js'));
PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const L = require(path.join(T, '_taxiclear_lib.js'));
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };

const VB = L.BUILDS.map(B => { const def = C.buildGen(PT.specOf(B.key).spec); return Object.assign({}, B, { def, dims: L.buildDims(C, def) }); });
const widest = VB.reduce((a, b) => (b.dims.half > a.dims.half ? b : a));
const txt = fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8');
const WI = IN.islandWorld('jolene', { premises: txt });
const SH = L.islandObstacles(C, 'jolene', 'town').concat(L.treeTrunks(WI)).concat(L.registryObstacles(WI));
const IX = L.index(SH);

if (opt('svg', null)) {
  const id = opt('svg'), out = argv[argv.indexOf('--svg') + 2];
  const a = WI.aerodromes.find(q => q.id === id), s = C.siteOf(id);
  if (!a || !out) { console.error('taxi_census: --svg <aerodrome id> <out.svg>'); process.exit(2); }
  const P = C.sitePattern(a, s, { half: widest.dims.half }), need = widest.dims.half + L.MARGIN;
  const at = opt('at', null) ? opt('at').split(',').map(Number) : [a.x, a.z];
  const Rr = +opt('r', 180), S = +opt('scale', 3), cx = at[0], cz = at[1], size = 2 * Rr * S;
  const X = x => ((x - cx + Rr) * S).toFixed(1), Z = z => ((z - cz + Rr) * S).toFixed(1);
  const col = { item: '#a33', house: '#a33', outbuilding: '#c66', prop: '#e90', 'prop?': '#e90', car: '#39c', boat: '#39c', tree: '#3a3', aircraft: '#909', settle: '#a33' };
  const g = [];
  const R = P.runway;
  g.push(`<line x1="${X(R.c0.x)}" y1="${Z(R.c0.z)}" x2="${X(R.c1.x)}" y2="${Z(R.c1.z)}" stroke="#bbb" stroke-width="${R.wid * S}" opacity="0.6"/>`);
  const cols = ['#00f', '#0aa', '#f0f', '#080'];
  L.routesOf(C, P).forEach((r, k) => {
    const pts = r.pts.map(q => X(q.x) + ',' + Z(q.z)).join(' ');
    g.push(`<polyline fill="none" stroke="${cols[k % 4]}" stroke-width="${(2 * need * S).toFixed(0)}" stroke-linejoin="round" stroke-linecap="round" opacity="0.08" points="${pts}"/>`);
    g.push(`<polyline fill="none" stroke="${cols[k % 4]}" stroke-width="1.5" points="${pts}"/>`);
  });
  for (const o of SH) {
    if (Math.hypot(o.x - cx, o.z - cz) - o.r > Rr * 1.5) continue;
    const c = col[o.tag] || '#555', wpt = (lx, lz) => [o.x + lx * o.c + lz * o.s, o.z - lx * o.s + lz * o.c];
    if (o.cells) {
      for (let n = 0; n < o.cells.length; n += 2) {
        const q = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => wpt(o.cells[n] + u * o.cell, o.cells[n + 1] + v * o.cell));
        g.push(`<polygon points="${q.map(p => X(p[0]) + ',' + Z(p[1])).join(' ')}" fill="${c}"/>`);
      }
      g.push(`<text x="${X(o.x)}" y="${Z(o.z)}" font-size="10" font-family="sans-serif" fill="#000">${o.id.split('/').pop()}</text>`);
    } else if (o.box) {
      const [x0, z0, x1, z1] = o.box, q = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([u, v]) => wpt(u, v));
      g.push(`<polygon points="${q.map(p => X(p[0]) + ',' + Z(p[1])).join(' ')}" fill="${c}"/>`);
    } else g.push(`<circle cx="${X(o.x)}" cy="${Z(o.z)}" r="${Math.max(1, o.r * S).toFixed(1)}" fill="${c}"/>`);
  }
  for (const nd of P.nodes) g.push(`<circle cx="${X(nd.x)}" cy="${Z(nd.z)}" r="3" fill="#000"/><text x="${(+X(nd.x) + 4).toFixed(1)}" y="${(+Z(nd.z) - 4).toFixed(1)}" font-size="11" font-family="sans-serif">${nd.id}</text>`);
  g.push(`<text x="8" y="18" font-size="14" font-family="sans-serif">${a.name} (${id}) - routes for the ${widest.name}, band = half-span + ${L.MARGIN} m = ${need.toFixed(1)} m; north up (-z)</text>`);
  fs.writeFileSync(out, `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" fill="#fff"/>${g.join('')}</svg>\n`);
  console.log('taxi_census: wrote ' + out);
  process.exit(0);
}

const rows = L.census(C, WI, IX, VB).map(r => Object.assign({ world: 'jolene' }, r));
const seeds = opt('seeds', '0,1,6,12,42');
if (seeds !== 'none') for (const seed of seeds.split(',').map(Number)) {
  const W = C.makeWorld(seed), I = L.index(L.registryObstacles(W));
  for (const r of L.census(C, W, I, [widest])) rows.push(Object.assign({ world: 'seed ' + seed }, r));
}
const held = rows.filter(r => r.need !== null), bad = held.filter(r => !r.ok);
const f = v => (isFinite(v) ? v.toFixed(2) : '  -  ');
console.log('THE TAXI CENSUS - ' + held.length + ' held rows (' + bad.length + ' violations), need = the build\'s half-span + ' + L.MARGIN + ' m (a parked box: ' + L.MARGIN + ' m)');
for (const r of bad.concat(held.filter(r => r.ok)).concat(rows.filter(r => r.need === null)))
  console.log((r.need === null ? '  info ' : r.ok ? '  ok   ' : '  VIOL ') + (r.world + ' ' + r.id).padEnd(20) + r.build.padEnd(16) + r.what.padEnd(22) + f(r.d).padStart(7) + ' m' + (r.need !== null ? ' / ' + r.need.toFixed(2) : '        ') + '  ' + r.near + '  (' + r.at.map(v => v.toFixed(1)).join(', ') + ')');
if (opt('json', null)) fs.writeFileSync(opt('json'), JSON.stringify({ margin: L.MARGIN, builds: VB.map(B => ({ name: B.name, span: 2 * B.dims.half })), rows }, null, 1) + '\n');
