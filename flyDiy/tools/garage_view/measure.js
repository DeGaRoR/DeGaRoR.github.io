#!/usr/bin/env node
// GARAGE-VIEW, step 1: MEASURE THE WORLD ROUND THE CLUB HANGAR AND THE LARGE HANGAR (the user, 22 Nov 2026: "It will
// measure in the world what are the distances. It will recreate a scene that is exactly like this").
//
// Everything is read from what the game itself composes - the premises record (tools/fixtures/island_jolene.json), the
// island world built from it in node (tools/island_node.js: terrainH, surface, the canopy map), the runway's site
// (siteOf('HOME'): the club hangar and its plots) - never from a picture. One shared frame for both hangars: the world's
// own metres (x east, z south, y up), plus each hangar's ROOM frame (the door at local -x, hangar.js) by its true yaw.
//
//   node tools/garage_view/measure.js [--site jolene_home] [--out dir] [--near 420]
//     --site   the site file (tools/garage_view/sites/<pack>.json, site.js): the world, the airfield, its sheds. Any airfield
//              with hangar plots: `node tools/garage_view/site.js list`, `... new <field>`
//     -> <out>/measure.json   the hangars, their doors and frames, the terrain patch (4 m to --near, 20 m to 2 km),
//                             the horizon seen from each door (1 deg steps: elevation, distance, sea / land),
//                             every paved surface, runway, road, building, parked aircraft, vehicle, prop and placed
//                             tree within reach, with its true place, height and distance from each door
//   The drawn FOREST is not in the record: it is the fill's walk (render_world.js TREE_FILL.census), read by
//   tools/garage_view/census.js in the node page; measure.json and census.json are what map.js and sketch.js draw.
//
// ROOM FRAME. A shed stands at (H.x, H.y, H.z) turned by rotation.y = H.ry = pi - hdg, its door at local -x:
//   world -> room   dx = x - H.x, dz = z - H.z;  lx = dx cos(ry) - dz sin(ry);  lz = dx sin(ry) + dz cos(ry)
//   room -> world   x = H.x + lx cos(ry) + lz sin(ry);  z = H.z - lx sin(ry) + lz cos(ry)
// (25_airfield.js siteToLocal is the analytic field's fixed quarter turn, ry = -pi/2: on Jolene the sheds stand at
// ry 3.9968, 41 degrees from it - printed below as `quarterTurnError`.)
'use strict';
const fs = require('fs'), path = require('path');
const T = path.join(__dirname, '..');
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = opt('out', path.join(T, 'perf', 'garage_view'));
const NEAR = +opt('near', 420);
const SITE = require('./site.js').read(opt('site', 'jolene_home'));
const FIX = path.join(T, 'fixtures', SITE.fixture);
fs.mkdirSync(OUT, { recursive: true });

const txt = fs.readFileSync(FIX, 'utf8');
const F = JSON.parse(txt), L = F.layers;
const t0 = Date.now();
const W = IN.islandWorld(SITE.world, { premises: txt });
if (!W) throw new Error('measure: no island world "' + SITE.world + '" (media/world/ missing?)');
const site = C.siteOf(SITE.field);
if (!site) throw new Error('measure: the field ' + SITE.field + ' has no site (no hangar, no plots)');
const r3 = v => +(+v).toFixed(3), r2 = v => +(+v).toFixed(2), r1 = v => +(+v).toFixed(1);

// ---- the two sheds ------------------------------------------------------------------------------------------
// the shells' default dims (26_hangar_fit.js SHELLS) and hangar.js's door rules (DOOR_W / DOOR_H, :147-165)
const SH = (C.SHELLS && C.SHELLS.club && C.SHELLS.works) ? C.SHELLS : null;
const dimsOf = k => (SH && SH[k] && SH[k].dims) ? SH[k].dims : (k === 'works' ? { HW: 22, HD: 30, EAVE: 9.5 } : k === 'field' ? { HW: 7, HD: 9, EAVE: 3.6 } : { HW: 15, HD: 12.5, EAVE: 7.0 });
const doorOf = (k, d) => k === 'works'
  ? { w: r2(0.8 * (2 * d.HW - 2) - 0.34), h: r2(Math.min(7.6, d.EAVE - 1.9)) }
  : k === 'field' ? { w: r2(d.door > 0 ? Math.min(d.door, 2 * d.HW - 1) : Math.max(6, 2 * d.HW - 5)), h: r2(d.EAVE - 0.5) }   // (the timber shed: its door nearly to the eave)
  : { w: r2(Math.max(6, 2 * d.HW - 5)), h: r2(Math.min(6.4, d.EAVE - 1.4)) };
const frameOf = H => {
  const c = Math.cos(H.ry), s = Math.sin(H.ry);
  return {
    toRoom: (x, z) => { const dx = x - H.x, dz = z - H.z; return [dx * c - dz * s, dx * s + dz * c]; },
    toWorld: (lx, lz) => [H.x + lx * c + lz * s, H.z - lx * s + lz * c],
  };
};
const mkShed = (id, name, shell, H) => {
  const d = dimsOf(shell), door = doorOf(shell, d), ry = H.ry !== undefined ? +H.ry : Math.PI - H.hdg;
  const o = { id, name, shell, x: r3(H.x), z: r3(H.z), y: r2(W.terrainH(H.x, H.z)), ySite: H.y !== undefined ? +H.y : null, hdg: +H.hdg, ry: +ry.toFixed(4), HW: d.HW, HD: d.HD, EAVE: d.EAVE, door };
  const Fm = frameOf(o);
  const dc = Fm.toWorld(-d.HD, 0);
  o.doorCentre = { x: r2(dc[0]), z: r2(dc[1]), y: r2(W.terrainH(dc[0], dc[1])) };
  o.doorDir = { x: r3(Math.cos(H.hdg)), z: r3(Math.sin(H.hdg)) };            // out of the door, world
  o.doorBearing = r1(((Math.atan2(Math.cos(H.hdg), -Math.sin(H.hdg)) * 180 / Math.PI) + 360) % 360);   // compass, north = -z
  o.corners = [[-d.HD, -d.HW], [-d.HD, d.HW], [d.HD, d.HW], [d.HD, -d.HW]].map(q => Fm.toWorld(q[0], q[1]).map(r2));
  o.quarterTurnError = r1(((ry - (-Math.PI / 2)) * 180 / Math.PI + 540) % 360 - 180);   // siteToLocal's assumption against the truth, degrees
  return o;
};
// the site file's sheds: the field's own hangar (its main plot) or one of its plots, each at the shell the views are measured for
const SHEDS = SITE.sheds.map(c => { const H = (c.id === SITE.field && site.hangar) ? site.hangar : (site.plots || []).find(p => p.id === c.id);
  if (!H) throw new Error('measure: the field ' + SITE.field + ' has no plot "' + c.id + '"'); return mkShed(c.id, c.name || (c.shell + ' ' + c.id), c.shell, H); });
const MID = { x: SHEDS.reduce((a, s) => a + s.x, 0) / SHEDS.length, z: SHEDS.reduce((a, s) => a + s.z, 0) / SHEDS.length };
const FR = SHEDS.map(frameOf);
// where a thing stands for each shed: metres from the door's centre, and in the room frame (lx < -HD: out of the door)
const seen = (x, z) => SHEDS.map((S, i) => { const q = FR[i].toRoom(x, z); return { d: r1(Math.hypot(x - S.doorCentre.x, z - S.doorCentre.z)), lx: r1(q[0]), lz: r1(q[1]), front: q[0] < -S.HD }; });

// ---- the terrain ---------------------------------------------------------------------------------------------
const SEA = 0;
const grid = (cx, cz, half, step) => {
  const n = Math.round(2 * half / step) + 1, h = new Array(n * n), s = new Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = cx - half + i * step, z = cz - half + j * step;
    h[j * n + i] = r2(W.terrainH(x, z)); s[j * n + i] = W.surface ? W.surface(x, z) : 0;
  }
  return { x0: r2(cx - half), z0: r2(cz - half), step, n, h, surf: s };
};
const gx = Math.round(MID.x / 4) * 4, gz = Math.round(MID.z / 4) * 4;
const TERR = { near: grid(gx, gz, NEAR, 4), mid: grid(Math.round(MID.x / 20) * 20, Math.round(MID.z / 20) * 20, 2000, 20) };
const canopy = (x, z) => (W.island && W.island.canopyAt) ? W.island.canopyAt(x, z) : 0;
{ const g = TERR.mid, c = new Array(g.n * g.n); for (let j = 0; j < g.n; j++) for (let i = 0; i < g.n; i++) c[j * g.n + i] = r1(canopy(g.x0 + i * g.step, g.z0 + j * g.step)); g.canopy = c; }

// ---- the horizon from each door: per degree, the highest elevation the ground reaches and where --------------------
const B = W.bounds || (W.island && W.island.grid) || null;
const horizon = S => {
  const ex = S.doorCentre.x, ez = S.doorCentre.z, ey = S.doorCentre.y + 1.7, rows = [];
  for (let a = 0; a < 360; a++) {
    const br = a * Math.PI / 180, dx = Math.sin(br), dz = -Math.cos(br);   // compass bearing a: north = -z, east = +x
    let best = -9, bd = 0, bh = 0, seaFrom = 0, r = 30, peaks = [], last = -9, rising = false;
    while (r < 40000) {
      const x = ex + dx * r, z = ez + dz * r, h = W.terrainH(x, z), hh = Math.max(h, SEA);
      const el = Math.atan2(hh - ey - r * r / (2 * 6371000 * 7 / 6), r) * 180 / Math.PI;   // the earth's drop, standard refraction
      if (el > best) { best = el; bd = r; bh = hh; rising = true; }
      else if (rising && best - el > 0.15) { peaks.push({ d: Math.round(bd), el: r2(best), h: r1(bh) }); rising = false; }   // a ridge line the next one rises over
      if (h <= SEA + 0.05 && !seaFrom) seaFrom = r; else if (h > SEA + 0.05 && seaFrom && r - seaFrom < 400) seaFrom = 0;
      last = el; r += Math.max(4, r * 0.012);
    }
    rows.push({ a, el: r2(best), d: Math.round(bd), h: r1(bh), sea: seaFrom ? Math.round(seaFrom) : 0, ridges: peaks.slice(-4) });
  }
  return rows;
};

// ---- what stands there ---------------------------------------------------------------------------------------
const REACH = 1500;
const nearMid = (x, z, r) => Math.hypot(x - MID.x, z - MID.z) < (r || REACH);
const polyNear = (P, r) => P.some(q => nearMid(q[0], q[1], r));
const yAt = (x, z) => r2(W.terrainH(x, z));
const rwyPoly = r => { const c = Math.cos(r.hdg), s = Math.sin(r.hdg), hl = r.len / 2, hw = r.wid / 2;
  return [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]].map(q => [r2(r.c[0] + q[0] * c - q[1] * s), r2(r.c[1] + q[0] * s + q[1] * c)]); };
const runways = L.runways.filter(r => r.c && +r.surface !== 4 && polyNear(rwyPoly(r), 2600)).map(r => ({ id: r.id, name: r.name, c: r.c, hdg: r.hdg, len: r.len, wid: r.wid, surface: r.surface, look: r.look, poly: rwyPoly(r),
  nearest: SHEDS.map(S => { const c = Math.cos(r.hdg), s = Math.sin(r.hdg), dx = S.doorCentre.x - r.c[0], dz = S.doorCentre.z - r.c[1];
    return { along: r1(dx * c + dz * s), across: r1(-dx * s + dz * c), toEdge: r1(Math.abs(-dx * s + dz * c) - r.wid / 2) }; }) }));
const surfaces = L.surface.filter(e => e.poly && polyNear(e.poly)).map(e => ({ id: e.id, surface: e.surface, apron: !!e.apron, poly: e.poly.map(q => q.map(r2)) }));
const materials = L.material.filter(e => e.poly && polyNear(e.poly)).map(e => ({ id: e.id, look: e.look, band: e.band, yaw: e.yaw, z: e.z, poly: e.poly.map(q => q.map(r2)) }));
const roads = L.roads.filter(e => e.pts && polyNear(e.pts)).map(e => ({ id: e.id, w: e.w, cls: e.cls, look: e.look || null, pts: e.pts.map(q => q.map(r2)) }));
const terrainMods = L.terrain.filter(e => e.poly && polyNear(e.poly)).map(e => ({ id: e.id, kind: e.kind, level: e.level, falloff: e.falloff, poly: e.poly.map(q => q.map(r2)) }));
const areas = (L.areas || []).filter(e => e.poly && polyNear(e.poly, 700)).map(e => ({ id: e.id, props: e.props, poly: e.poly.map(q => q.map(r2)) }));
const objects = L.objects.filter(o => nearMid(o.x, o.z)).map(o => Object.assign({ id: o.id, kind: o.kind, key: o.key || o.kit || '', x: r2(o.x), z: r2(o.z), y: yAt(o.x, o.z), yaw: r3(o.yaw || 0) },
  o.size !== undefined ? { size: o.size } : {}, { person: /^person_/.test(o.key || ''), seen: seen(o.x, o.z) }));
// a site's items in the world (27_premises.js siteFrame / placeSite: the item's yaw = at.yaw + pi + its own)
const buildings = [];
for (const s of L.sites) {
  const a = s.at || { x: 0, z: 0, yaw: 0 }; if (!nearMid(a.x, a.z)) continue;
  const c = Math.cos(a.yaw || 0), sn = Math.sin(a.yaw || 0);
  for (const it of s.items || []) {
    const x = a.x + (it.x || 0) * c + (it.z || 0) * sn, z = a.z - (it.x || 0) * sn + (it.z || 0) * c;
    buildings.push({ site: s.id, name: s.name, id: it.id || '', key: it.key, x: r2(x), z: r2(z), y: yAt(x, z), yaw: r3((a.yaw || 0) + Math.PI + (it.yaw || 0)), stage: it.stage || null, seen: seen(x, z) });
  }
}
const stands = (site.stand ? [{ id: SITE.field, x: site.stand.x, z: site.stand.z }] : []).concat((site.plots || []).filter(p => p.stand).map(p => ({ id: p.id, x: p.stand.x, z: p.stand.z })))
  .map(s => Object.assign(s, { y: yAt(s.x, s.z), seen: seen(s.x, s.z) }));

const out = {
  what: 'GARAGE-VIEW measure: the world round the club hangar and the large hangar, from the game\'s own data',
  fixture: path.basename(FIX), rev: F.rev || null, made: new Date().toISOString(),
  frame: 'world metres: x east, z south (north = -z), y up; bearings are compass degrees',
  site: SITE,
  sheds: SHEDS, mid: { x: r2(MID.x), z: r2(MID.z) }, between: SHEDS.length > 1 ? r1(Math.hypot(SHEDS[0].x - SHEDS[1].x, SHEDS[0].z - SHEDS[1].z)) : 0,
  sea: SEA, bounds: B && B.x0 !== undefined ? B : null,
  runways, surfaces, materials, roads, terrainMods, areas, buildings, objects, stands,
  horizon: SHEDS.map(S => ({ shed: S.id, eye: [S.doorCentre.x, r2(S.doorCentre.y + 1.7), S.doorCentre.z], rows: horizon(S) })),
  terrain: TERR,
};
fs.writeFileSync(path.join(OUT, 'measure.json'), JSON.stringify(out));

// ---- the table ------------------------------------------------------------------------------------------------
const P = (...a) => console.log(...a);
P('GARAGE-VIEW measure  ' + SITE.pack + ' (' + SITE.world + ' / ' + SITE.field + ', ' + path.basename(FIX) + ', world built in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
for (const S of SHEDS) P('  ' + S.name.padEnd(13) + ' at (' + S.x + ', ' + S.z + ') y ' + S.y + (S.ySite !== null ? ' (site y ' + S.ySite + ')' : '') + '  ry ' + S.ry + '  door bearing ' + S.doorBearing + ' deg  door ' + S.door.w + ' x ' + S.door.h + ' m at (' + S.doorCentre.x + ', ' + S.doorCentre.z + ')  room ' + (2 * S.HD) + ' x ' + (2 * S.HW) + ' m  quarter-turn error ' + S.quarterTurnError + ' deg');
P('  between the two sheds: ' + out.between + ' m');
for (const r of runways) P('  runway ' + r.name.padEnd(22) + ' ' + r.len + ' x ' + r.wid + ' m  from the doors: ' + r.nearest.map((n, i) => SHEDS[i].name.split(' ')[0] + ' ' + n.toEdge + ' m to its edge (abeam ' + n.along + ' m from its centre)').join('; '));
const row = (label, o) => P('  ' + label.padEnd(34) + o.seen.map((s, i) => (SHEDS[i].name.split(' ')[0] + ' ' + String(s.d).padStart(6) + ' m ' + (s.front ? 'in front' : 'behind  ')).padEnd(26)).join(''));
P('  --- buildings'); for (const b of buildings) row(b.key + (b.stage ? ' (staged)' : ''), b);
P('  --- aircraft, vehicles'); for (const o of objects) if (o.kind === 'aircraft' || /^(auto_|truck_|machine_)/.test(o.key)) row(o.key, o);
P('  --- people (kept out of the bake): ' + objects.filter(o => o.person).length + ';  props: ' + objects.filter(o => o.kind === 'prop' && !o.person && !/^(auto_|truck_|machine_)/.test(o.key)).length + ';  placed trees / rocks: ' + objects.filter(o => o.kind === 'tree').length);
for (const Hz of out.horizon) {
  const rows = Hz.rows, S = SHEDS.find(s => s.id === Hz.shed), b0 = S.doorBearing;
  const cone = rows.filter(r => Math.abs(((r.a - b0 + 540) % 360) - 180) <= 80);
  const top = cone.slice().sort((a, b) => b.el - a.el)[0], far = cone.slice().sort((a, b) => b.d - a.d)[0];
  P('  horizon from the ' + S.name + ' door (+-80 deg): highest ' + top.el + ' deg at bearing ' + top.a + ' (' + top.h + ' m high, ' + (top.d / 1000).toFixed(1) + ' km);  farthest skyline ' + (far.d / 1000).toFixed(1) + ' km at bearing ' + far.a + ';  sea in ' + cone.filter(r => r.sea).length + ' of ' + cone.length + ' bearings');
}
P('  terrain near patch: ' + TERR.near.n + ' x ' + TERR.near.n + ' at 4 m, heights ' + Math.min(...TERR.near.h) + ' .. ' + Math.max(...TERR.near.h) + ' m');
P('  -> ' + path.join(OUT, 'measure.json') + '  (' + (fs.statSync(path.join(OUT, 'measure.json')).size / 1024).toFixed(0) + ' kB)');
