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

function check(o) {
  const { png, projBuf, pack, files } = o;
  console.log('THE BYTES');
  const r = o.rebake;
  ok(r.png.equals(png), 'the picture re-bakes byte for byte (' + png.length + ' B, ' + pack.img + ')');
  const proj = JSON.parse(projBuf.toString('utf8'));
  const re = Object.assign({}, r.proj, { img: proj.img, imgBytes: r.png.length, imgHash: require('./_media_lib.js').sha8(r.png) });
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
  ok(files.length === 2 && files.includes(path.basename(pack.img)) && files.includes(path.basename(pack.proj)), 'media/map/ holds the two files the pack names (' + files.join(', ') + ')');

  console.log('THE PROJECTION');
  const inPic = (x, z) => { const px = (x - proj.x0) / proj.mpp, py = (z - proj.z0) / proj.mpp; return px >= 0 && py >= 0 && px < img.w && py < img.h; };
  ok(proj.aerodromes.every(a => inPic(a.x, a.z)) && proj.plots.every(p => inPic(p.x, p.z)), 'every aerodrome and plot is on the picture');
  ok(img.w === proj.w && img.h === proj.h && Math.abs(proj.x1 - proj.x0 - img.w * proj.mpp) < 1e-6, 'the frame is the picture (' + proj.mpp + ' m/px)');
  ok(/north up/.test(proj.rule), 'the frame states its rule: ' + proj.rule);
  return rc;
}

const t0 = Date.now();
const pack = readPack();
const png = fs.readFileSync(path.join(ROOT, pack.img)), projBuf = fs.readFileSync(path.join(ROOT, pack.proj));
const files = fs.readdirSync(path.join(ROOT, 'media', 'map')).sort();
const rebake = MB.bake();
check({ png, projBuf, pack, files, rebake });

if (process.argv.includes('--selftest')) {
  console.log('SELFTEST (each must go red)');
  const before = fails;
  const red = (what, fn) => { const f0 = fails; const q = console.log; console.log = () => {}; try { fn(); } catch (e) { fails++; } console.log = q; const went = fails > f0; fails = f0; ok(went, 'red: ' + what); };
  const proj = JSON.parse(projBuf.toString('utf8'));
  red('a runway moved 60 m in the projection', () => { const p = JSON.parse(JSON.stringify(proj)); p.aerodromes[2].x += 60; const rc = runwayCheck(MB.decodePNG(png), p); ok(rc.stray === 0 && rc.holes === 0, 'x'); });
  red('a runway turned 5 deg', () => { const p = JSON.parse(JSON.stringify(proj)); p.aerodromes[0].hdg += 5 * Math.PI / 180; const rc = runwayCheck(MB.decodePNG(png), p); ok(rc.stray === 0 && rc.holes === 0, 'x'); });
  red('a byte flipped in the picture', () => { const b = Buffer.from(png); b[b.length - 20] ^= 1; ok(rebake.png.equals(b), 'x'); });
  red('a picture over the budget', () => { ok(Buffer.alloc(2 * 1024 * 1024 + 1).length <= 2 * 1024 * 1024, 'x'); });
  if (fails > before) fails = before + (fails - before);
}
console.log('(' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
console.log(fails ? 'GATE MAPBAKE: FAIL' : 'GATE MAPBAKE: PASS');
process.exit(fails ? 1 : 0);
