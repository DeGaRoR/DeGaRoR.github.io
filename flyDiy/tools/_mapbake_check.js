#!/usr/bin/env node
// _mapbake_check.js - GATE MAPBAKE (G2251, MAP-MENU): the 2-D island map (tools/map_bake.js) as committed.
//   1. DETERMINISTIC BYTES: the bake re-run in memory gives the committed picture and projection byte for byte (their
//      content hashes are their names), and src/viewer/map_pack.js is that projection with those names.
//   2. EVERY RUNWAY INSIDE ITS FOOTPRINT: decoded from the committed PNG, every pixel of a runway colour (hard, grass,
//      the water lane) has its centre inside some aerodrome's rectangle in the projection (len along hdg, wid across,
//      grown the half pixel the bake declares), and every pixel whose centre is inside a rectangle carries a runway
//      colour - so each strip is drawn at true scale and heading, and nothing else is drawn as one.
//   3. THE SIZE BUDGET: the picture <= 2 MB (the study's 1-2 MB), the projection <= 64 KB, each side <= 4096 px and the
//      decoded RGBA <= 32 MB (a phone's canvas and texture limits), media/map/ holding exactly the two files.
//   4. THE PROJECTION PLACES THE ISLAND: every aerodrome and plot inside the picture; the frame's rule stated.
//   5. (G2324, MAP-SIMPLE) THE PAINTING THE SCREEN SHOWS (the user's AI map, media/map/jolene_art.<h8>.jpg): the
//      committed source's bytes as they are, named by their hash; ITS FRAME IS THE PROJECTION'S EXACTLY (the JPEG's
//      own size = w x h, so px = (x - x0) / mpp holds on it as on the bake); its own size budget (<= 2 MB, phone-safe
//      decoded). The runway-pixel rows (2) are the BAKE's: the painting's runways are its own (they drift), and the
//      screen draws every site over it from the projection. The hotspots and places it names are the island record's.
//   6. (G2435, MAP-INFRA) THE INFRASTRUCTURE (proj.infra, drawn by the screen over the painting): every road, zone and link
//      of the island record present, every house (compose's plots) and site footprint (compose's items); each position
//      within 1 px of the projection's formula on the record's own coordinates (a road's every point - smoothed as compose
//      smooths it - within 1 px of its finest polyline, each coarser band within its tolerance); integers in px; its
//      budget (raw and gzipped); deterministic (the committed projection, infra included, is the re-bake's byte for byte).
//   --selftest: each check mutated red (a moved runway, a shifted projection, a byte flipped, an over-budget size).
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
let fails = 0;
const ok = (c, what) => { console.log('  ' + (c ? 'ok  ' : 'FAIL') + ' ' + what); if (!c) fails++; return c; };

const MB = require('./map_bake.js');
const readPack = () => {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'map_pack.js'), 'utf8');
  const m = /window\.MAP_PACK = (\{[\s\S]*\});\s*$/.exec(src);
  if (!m) throw new Error('src/viewer/map_pack.js does not hold window.MAP_PACK');
  return JSON.parse(m[1]);
};

// the runway check, on a decoded picture and a projection (returns the counts; the selftest feeds it mutations)
function runwayCheck(img, proj) {
  const { w, h, pix } = img, P = proj, mpp = P.mpp, grow = (P.look.rwyGrowPx || 0) * mpp + 1e-6;
  const cols = new Set([P.look.colours.hard, P.look.colours.grass, P.look.colours.lane]);
  const inside = (a, x, z, g) => { const ux = Math.cos(a.hdg), uz = Math.sin(a.hdg), rx = x - a.x, rz = z - a.z;
    return Math.abs(rx * ux + rz * uz) <= a.len / 2 + g && Math.abs(-rx * uz + rz * ux) <= a.wid / 2 + g; };
  let stray = 0, holes = 0, painted = 0; const per = {};
  for (const a of P.aerodromes) per[a.id] = 0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = P.x0 + (i + 0.5) * mpp, z = P.z0 + (j + 0.5) * mpp, v = pix[j * w + i];
    const hit = P.aerodromes.filter(a => inside(a, x, z, grow));
    if (cols.has(v)) { painted++; if (!hit.length) stray++; else for (const a of hit) per[a.id]++; }
    else if (hit.length) holes++;
  }
  return { stray, holes, painted, per };
}

// (G2435) THE INFRASTRUCTURE against the record (and compose's plots / items / links: the rebake's town); returns the
// worst deviations (px) so a mutation can be shown red
function infraCheck(proj, rec, O, C) {
  const I = proj.infra || {}, mpp = proj.mpp, fx = (x, z) => [(x - proj.x0) / mpp, (z - proj.z0) / mpp];
  const pts = s => String(s || '').split(' ').filter(Boolean).map(q => q.split(',').map(Number));
  const ints = s => pts(s).every(q => q.length >= 2 && q.every(Number.isInteger));
  const dSeg = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy; let t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
  const dLine = (p, P) => { if (P.length === 1) return Math.hypot(p[0] - P[0][0], p[1] - P[0][1]); let d = Infinity; for (let i = 1; i < P.length; i++) d = Math.min(d, dSeg(p, P[i - 1], P[i])); return d; };
  const W = { road: 0, band: [0, 0, 0], zone: 0, house: 0, site: 0, link: 0, label: 0 };
  // the roads: the record's, in its order; each point (smoothed as compose smooths it) within 1 px of the finest line
  const RR = rec.layers.roads, roads = I.roads || [];
  ok(roads.length === RR.length && roads.every((r, i) => r.id === RR[i].id), 'every road of the record is drawn (' + roads.length + ' of ' + RR.length + ', in the record\'s order)');
  let clsOk = true, intOk = true;
  for (let i = 0; i < Math.min(roads.length, RR.length); i++) {
    const r = roads[i], q = RR[i], want = q.cls === 'track' || q.cls === 'path' ? 'track' : q.cls === 'gravel' ? 'gravel' : 'paved';
    if (r.cls !== want || r.w !== +q.w || r.main !== ((+q.w || 0) >= proj.infra.mainW || !!q.name)) clsOk = false;
    if (!Array.isArray(r.p) || r.p.length !== I.dp.length || !r.p.every(ints)) { intOk = false; continue; }
    const S = (q.smooth ? C.PREMISES_GEN.smoothPath(q.pts, q.smooth) : q.pts).map(p => fx(p[0], p[1]));
    r.p.forEach((b, k) => { const P = pts(b); for (const p of S) { const d = dLine(p, P); if (k === r.p.length - 1) W.road = Math.max(W.road, d); W.band[k] = Math.max(W.band[k], d); } });
  }
  ok(clsOk, 'each road\'s class (paved / gravel / track), width and main flag are the record\'s');
  ok(intOk, 'every road\'s ' + (I.dp || []).length + ' zoom bands are integer px polylines');
  ok(W.road <= 1, 'every road point (the record\'s, smoothed as compose smooths it) within 1 px of the formula on its finest band: worst ' + W.road.toFixed(2) + ' px');
  ok(W.band.every((d, k) => d <= I.dp[k] + Math.SQRT1_2 + 1e-9), 'each coarser band within its tolerance (+ the rounding): ' + W.band.map((d, k) => d.toFixed(2) + ' <= ' + (I.dp[k] + Math.SQRT1_2).toFixed(2)).join(', ') + ' px');
  // the zones: the record's settlement kinds (forest / clear skipped), vertex for vertex
  const ZR = rec.layers.zones.filter(z => MB.INFRA_ZONES.includes(z.kind)), zones = I.zones || [];
  ok(zones.length === ZR.length && zones.every((z, i) => z.id === ZR[i].id && z.kind === ZR[i].kind) && !zones.some(z => /forest|clear/.test(z.kind)),
    'every settlement zone of the record is drawn (' + zones.length + ': ' + MB.INFRA_ZONES.map(k => ZR.filter(z => z.kind === k).length + ' ' + k).join(', ') + '; forest / clear skipped)');
  for (let i = 0; i < Math.min(zones.length, ZR.length); i++) { const P = pts(zones[i].p); if (!ints(zones[i].p)) W.zone = Infinity; for (const v of ZR[i].poly) W.zone = Math.max(W.zone, dLine(fx(v[0], v[1]), P)); for (const v of P) W.zone = Math.max(W.zone, Math.min(...ZR[i].poly.map(q => Math.hypot(v[0] - fx(q[0], q[1])[0], v[1] - fx(q[0], q[1])[1])))); }
  ok(W.zone <= 1, 'every zone vertex within 1 px of the formula: worst ' + W.zone.toFixed(2) + ' px');
  // the houses: compose's plots, one each, at the plot's centre
  const H = String(I.houses || '').split(' ').filter(Boolean).map(q => q.split(',').map(Number)), PL = O.records.plots;
  ok(H.length === PL.length && H.every(h => h.length === 4 && h.every(Number.isInteger)), 'a house per plot compose sows (' + H.length + ' of ' + PL.length + ': the town kit\'s and the village\'s), integers');
  for (let i = 0; i < Math.min(H.length, PL.length); i++) { const p = PL[i].poly, c = fx(p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length); W.house = Math.max(W.house, Math.hypot(H[i][0] - c[0], H[i][1] - c[1])); }
  ok(W.house <= 1, 'every house within 1 px of its plot\'s centre: worst ' + W.house.toFixed(2) + ' px');
  // the site items: every footprint compose stands (the mill, the cannery, the hall, the stations, the piers ...)
  const IT = O.records.items.filter(it => it.foot && it.foot.length >= 3), sites = I.sites || [];
  ok(sites.length === IT.length && sites.every((q, i) => q.id === IT[i].id && q.key === IT[i].key), 'every site item\'s footprint is drawn (' + sites.length + ' of ' + IT.length + ', ' + ['mill', 'cannery', 'town hall', 'tram base station', 'trestle pier'].map(k => sites.filter(q => q.key.indexOf(k) >= 0).length + ' ' + k).join(', ') + ')');
  for (let i = 0; i < Math.min(sites.length, IT.length); i++) { const f = IT[i].foot, c = fx(f.reduce((s, q) => s + q[0], 0) / f.length, f.reduce((s, q) => s + q[1], 0) / f.length), r = sites[i].r.split(',').map(Number); if (!r.every(Number.isInteger)) W.site = Infinity; W.site = Math.max(W.site, Math.hypot(r[0] - c[0], r[1] - c[1])); }
  ok(W.site <= 1, 'every footprint\'s centre within 1 px of the formula: worst ' + W.site.toFixed(2) + ' px');
  // the links: the record's, the cable on its track ropes, the stations on compose's items
  const LR = rec.layers.links, links = I.links || [];
  ok(links.length === LR.length && links.every((l, i) => l.id === LR[i].id && l.kind === LR[i].kind && l.from === LR[i].from.site && l.to === LR[i].to.site), 'every link of the record is drawn (' + links.map(l => l.id + ': ' + l.kind + ' ' + l.from + ' -> ' + l.to + ', ' + l.len + ' m, ' + l.lines + ' lines').join('; ') + ')');
  for (const l of links) {
    const L = O.records.links.find(x => x.link && x.link.id === l.id); if (!L) { W.link = Infinity; continue; }
    const tr = L.geom.ropes.filter(r => r.kind === 'track'), m = k => fx(tr.reduce((s, r) => s + r[k][0], 0) / tr.length, tr.reduce((s, r) => s + r[k][2], 0) / tr.length);
    const P = pts(l.p), S = pts(l.st), want = [m('a'), m('b')], st = [fx(L.A.x, L.A.z), fx(L.B.x, L.B.z)];
    if (!ints(l.p) || !ints(l.st)) W.link = Infinity;
    for (let k = 0; k < 2; k++) W.link = Math.max(W.link, Math.hypot(P[k][0] - want[k][0], P[k][1] - want[k][1]), Math.hypot(S[k][0] - st[k][0], S[k][1] - st[k][1]));
  }
  ok(W.link <= 1, 'the cable\'s ends and its two stations within 1 px of the formula: worst ' + W.link.toFixed(2) + ' px');
  // the labels: each where the record puts it; a place of interest it stands for is one the projection names
  const LB = I.labels || [];
  ok(LB.length === 5 && LB.every(l => Number.isInteger(l.x) && Number.isInteger(l.y) && (!l.poi || proj.pois.some(p => p.id === l.poi))), 'the labels: ' + LB.map(l => l.label + (l.poi ? ' (for ' + l.poi + ')' : '')).join(', '));
  const raw = Buffer.byteLength(JSON.stringify(I)), gz = require('zlib').gzipSync(JSON.stringify(I), { level: 9 }).length;
  ok(raw <= 48 * 1024 && gz <= 16 * 1024, 'its budget: ' + (raw / 1024).toFixed(1) + ' KB raw <= 48 KB, ' + (gz / 1024).toFixed(1) + ' KB gzipped <= 16 KB (sha8 ' + require('./_media_lib.js').sha8(Buffer.from(JSON.stringify(I))) + ')');
  return W;
}

function check(o) {
  const { png, projBuf, pack, files } = o;
  console.log('THE BYTES');
  const r = o.rebake;
  ok(r.png.equals(png), 'the picture re-bakes byte for byte (' + png.length + ' B, ' + pack.img + ')');
  const proj = JSON.parse(projBuf.toString('utf8'));
  const re = MB.projOf(r, proj.img, proj.art && proj.art.img);
  ok(Buffer.from(JSON.stringify(re, null, 1) + '\n').equals(projBuf), 'the projection re-bakes byte for byte (' + pack.proj + ')');
  ok(pack.img === proj.img && pack.imgHash === require('./_media_lib.js').sha8(png) && pack.img.indexOf('.' + pack.imgHash + '.png') > 0,
    'map_pack.js names the picture by its content hash (' + pack.imgHash + ')');
  const strip = p => { const c = Object.assign({}, p); delete c.proj; return JSON.stringify(c); };
  ok(strip(pack) === JSON.stringify(proj), 'map_pack.js is the projection, field for field');

  console.log('THE RUNWAYS');
  const img = MB.decodePNG(png);
  const rc = runwayCheck(img, proj);
  ok(rc.stray === 0, 'no runway-coloured pixel outside every footprint (' + rc.stray + ' stray of ' + rc.painted + ')');
  ok(rc.holes === 0, 'every pixel inside a footprint is drawn as a runway (' + rc.holes + ' holes)');
  for (const a of proj.aerodromes) {
    const expect = (a.len * a.wid) / (proj.mpp * proj.mpp);
    ok(rc.per[a.id] >= Math.max(2, Math.floor(a.len / proj.mpp)) && rc.per[a.id] >= expect * 0.9,
      a.id + ' (' + a.name + ', ' + a.len + ' x ' + a.wid + ' m ' + a.surface.word + ', hdg ' + (a.hdg * 180 / Math.PI).toFixed(1) + ' deg): ' +
      rc.per[a.id] + ' px for ' + expect.toFixed(1) + ' px of true area');
  }
  ok(proj.aerodromes.length === 8, 'the 8 runways are in the projection (' + proj.aerodromes.map(a => a.id).join(', ') + ')');

  console.log('THE BUDGET');
  ok(png.length <= 2 * 1024 * 1024, 'the picture ' + (png.length / 1024).toFixed(0) + ' KB <= 2048 KB');
  ok(projBuf.length <= 64 * 1024, 'the projection ' + (projBuf.length / 1024).toFixed(1) + ' KB <= 64 KB');
  ok(img.w <= 4096 && img.h <= 4096 && img.w * img.h * 4 <= 32 * 1024 * 1024, 'phone-safe: ' + img.w + ' x ' + img.h + ' px, ' + (img.w * img.h * 4 / 1048576).toFixed(1) + ' MB decoded');
  ok(files.length === 3 && files.includes(path.basename(pack.img)) && files.includes(path.basename(pack.proj)) && pack.art && files.includes(path.basename(pack.art.img)),
    'media/map/ holds the three files the pack names (' + files.join(', ') + ')');

  console.log('THE PROJECTION');
  const inPic = (x, z) => { const px = (x - proj.x0) / proj.mpp, py = (z - proj.z0) / proj.mpp; return px >= 0 && py >= 0 && px < img.w && py < img.h; };
  ok(proj.aerodromes.every(a => inPic(a.x, a.z)) && proj.plots.every(p => inPic(p.x, p.z)), 'every aerodrome and plot is on the picture');
  ok(img.w === proj.w && img.h === proj.h && Math.abs(proj.x1 - proj.x0 - img.w * proj.mpp) < 1e-6, 'the frame is the picture (' + proj.mpp + ' m/px)');
  ok(/north up/.test(proj.rule), 'the frame states its rule: ' + proj.rule);

  console.log('THE PAINTING (the screen\'s picture: the user\'s AI map)');
  const A = proj.art || {}, art = o.art;
  ok(art && art.equals(fs.readFileSync(path.join(ROOT, MB.ART_SRC))), 'the shipped painting is the committed source\'s bytes (' + MB.ART_SRC + ' -> ' + A.img + ')');
  ok(art && A.hash === require('./_media_lib.js').sha8(art) && A.img === 'media/map/jolene_art.' + A.hash + '.jpg' && A.bytes === art.length, 'named by its content hash (' + A.hash + ', ' + A.bytes + ' B)');
  const js = art ? MB.jpegSize(art) : { w: 0, h: 0 };
  ok(js.w === proj.w && js.h === proj.h && A.w === proj.w && A.h === proj.h, 'its frame is the projection\'s exactly: ' + js.w + ' x ' + js.h + ' px = ' + proj.w + ' x ' + proj.h + ' at ' + proj.mpp + ' m/px from (' + proj.x0 + ', ' + proj.z0 + ')');
  ok(art && art.length <= 2 * 1024 * 1024 && js.w * js.h * 4 <= 32 * 1024 * 1024, 'its budget: ' + (art ? (art.length / 1024).toFixed(0) : '?') + ' KB <= 2048 KB, ' + (js.w * js.h * 4 / 1048576).toFixed(1) + ' MB decoded');
  ok(/^#[0-9a-f]{6}$/i.test(A.edge || ''), 'the sea at its edge for the seamless backdrop: ' + A.edge);
  const hs = proj.hotspots || [], po = proj.pois || [];
  const rec = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'fixtures', 'island_jolene.json'), 'utf8')), an = rec.layers.objects.filter(x => x.kind === 'animal');
  ok(hs.length === an.length && hs.every(h => an.some(a => a.id === h.id && a.x === h.x && a.z === h.z && (a.n || 1) === h.n)) && hs.every(h => inPic(h.x, h.z) && h.label && /^(land|sea|air)$/.test(h.kind)),
    'the wildlife hotspots are the record\'s ' + an.length + ' animal objects (positions, counts), labelled by the animal registry, all on the picture');
  ok(po.length >= 5 && po.every(p => inPic(p.x, p.z)) && po.filter(p => p.id !== 'summit').every(p => rec.layers.sites.some(st => st.id === p.id && st.at.x === p.x && st.at.z === p.z)),
    'the places of interest are the record\'s sites (+ the summit): ' + po.map(p => p.label).join(', '));

  console.log('THE INFRASTRUCTURE (G2435: the roads, zones, houses, site footprints, the tramway the screen draws)');
  infraCheck(proj, rec, r.town.O, require('./flight_core.js'));
  ok(JSON.stringify(proj.infra) === JSON.stringify(r.proj.infra), 'deterministic: the committed infra is the re-bake\'s, field for field');
  return rc;
}

const t0 = Date.now();
const pack = readPack();
const png = fs.readFileSync(path.join(ROOT, pack.img)), projBuf = fs.readFileSync(path.join(ROOT, pack.proj));
const files = fs.readdirSync(path.join(ROOT, 'media', 'map')).sort();
const art = pack.art && fs.existsSync(path.join(ROOT, pack.art.img)) ? fs.readFileSync(path.join(ROOT, pack.art.img)) : null;
const rebake = MB.bake();
check({ png, projBuf, pack, files, rebake, art });

if (process.argv.includes('--selftest')) {
  console.log('SELFTEST (each must go red)');
  const before = fails;
  const red = (what, fn) => { const f0 = fails; const q = console.log; console.log = () => {}; try { fn(); } catch (e) { fails++; } console.log = q; const went = fails > f0; fails = f0; ok(went, 'red: ' + what); };
  const proj = JSON.parse(projBuf.toString('utf8'));
  red('a runway moved 60 m in the projection', () => { const p = JSON.parse(JSON.stringify(proj)); p.aerodromes[2].x += 60; const rc = runwayCheck(MB.decodePNG(png), p); ok(rc.stray === 0 && rc.holes === 0, 'x'); });
  red('a runway turned 5 deg', () => { const p = JSON.parse(JSON.stringify(proj)); p.aerodromes[0].hdg += 5 * Math.PI / 180; const rc = runwayCheck(MB.decodePNG(png), p); ok(rc.stray === 0 && rc.holes === 0, 'x'); });
  red('a byte flipped in the picture', () => { const b = Buffer.from(png); b[b.length - 20] ^= 1; ok(rebake.png.equals(b), 'x'); });
  red('a picture over the budget', () => { ok(Buffer.alloc(2 * 1024 * 1024 + 1).length <= 2 * 1024 * 1024, 'x'); });
  red('a painting off the frame (a 2166 px wide JPEG)', () => { const b = Buffer.from(art); for (let o = 2; o < b.length - 9;) { if (b[o] === 0xff && b[o + 1] >= 0xc0 && b[o + 1] <= 0xc2) { b.writeUInt16BE(proj.w - 1, o + 7); break; } o += b[o] === 0xff ? 2 + b.readUInt16BE(o + 2) : 1; } const s2 = MB.jpegSize(b); ok(s2.w === proj.w && s2.h === proj.h, 'x'); });
  const rec = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'fixtures', 'island_jolene.json'), 'utf8')), C = require('./flight_core.js');
  const mut = f => { const p = JSON.parse(JSON.stringify(proj)); f(p.infra); infraCheck(p, rec, rebake.town.O, C); };
  red('a road nudged 2 px', () => mut(I => { I.roads[60].p = I.roads[60].p.map(b => b.split(' ').map(q => q.split(',').map(Number)).map(q => (q[0] + 2) + ',' + q[1]).join(' ')); }));
  red('a road dropped', () => mut(I => { I.roads.splice(10, 1); }));
  red('a zone vertex moved 3 px', () => mut(I => { const P = I.zones[1].p.split(' '); const q = P[0].split(',').map(Number); P[0] = q[0] + ',' + (q[1] + 3); I.zones[1].p = P.join(' '); }));
  red('a house dropped', () => mut(I => { I.houses = I.houses.split(' ').slice(1).join(' '); }));
  red('the tram\'s top station 2 px off', () => mut(I => { const S = I.links[0].st.split(' '); const q = S[1].split(',').map(Number); S[1] = (q[0] - 2) + ',' + q[1]; I.links[0].st = S.join(' '); }));
  if (fails > before) fails = before + (fails - before);
}
console.log('(' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
console.log(fails ? 'GATE MAPBAKE: FAIL' : 'GATE MAPBAKE: PASS');
process.exit(fails ? 1 : 0);
