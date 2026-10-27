#!/usr/bin/env node
// gps_shots.js - THE GPS SCREEN AS THE GAME PAINTS IT, ON ANY BOX (the user, 27 Oct: "show me a render of the GPS")
//
// The cloud's Chromium cannot draw the game's WebGL (SwiftShader: the sky only), but its 2D canvas is a real one. The
// GPS screen IS a 2D canvas (src/viewer/gps_face.js: a cheap canvas repainted at 4 Hz and uploaded as a texture), so this
// runs that painter, unchanged, in headless Chromium: the island's map (media/map/jolene_map.png, padded square with sea
// - the game bakes its own minimap underlay at boot; this is the island's printed map standing in for it), the island's
// strips, a plan out of Jolene HOME, the aeroplane flown along it at 45 m/s so the track, GS / DTK / DIS / ETE are live.
// Writes <out>/gps_<state>.png for: boot (the splash after power), map (40 s into the first leg), map_leg2 (70 s down
// the second), map_2nm / map_trkup / nav (G2812's softkeys: the range a step in, track-up, the nav page), off (the
// avionics master off: dark), standby (the shed), and gps_sheet.png (boot, map, 2 nm, track-up, nav, standby), plus the screen's raw size. The kind
// (portable / panel / glass) picks the face's aspect and its standby, as GEN_AVIONICS.gps[kind].face says.
//   node tools/gps_shots.js <outDir> [glass|panel|portable]
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.resolve(process.argv[2] || 'gps_shots'), KIND = process.argv[3] || 'glass';
fs.mkdirSync(OUT, { recursive: true });

const C = require(path.join(__dirname, 'flight_core.js'));
const proj = JSON.parse(fs.readFileSync(path.join(ROOT, 'media', 'map', fs.readdirSync(path.join(ROOT, 'media', 'map')).find(f => /^jolene_proj/.test(f))), 'utf8'));
const mapFile = path.join(ROOT, 'media', 'map', fs.readdirSync(path.join(ROOT, 'media', 'map')).find(f => /^jolene_map.*\.png$/.test(f)));
const face = C.GEN_AVIONICS.gps[KIND] && C.GEN_AVIONICS.gps[KIND].face;
const aspect = face && face.w && face.h ? face.w / face.h : 1.6;

(async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('page error: ' + e.message));
  await page.setContent('<!doctype html><html><body style="margin:0;background:#222"></body></html>');
  await page.addScriptTag({ path: path.join(ROOT, 'vendor', 'three.min.js') });
  await page.evaluate(AV => { window.GEN_AVIONICS = AV; }, C.GEN_AVIONICS);
  await page.addScriptTag({ path: path.join(ROOT, 'src', 'viewer', 'gps_face.js') });
  const mapURL = 'data:image/png;base64,' + fs.readFileSync(mapFile).toString('base64');
  const shots = await page.evaluate(async ({ mapURL, proj, KIND, aspect }) => {
    const GPS = window.FLYDIY_GPS;
    // the map: the printed island padded to a square with sea, its world box
    const img = new Image(); img.src = mapURL; await img.decode();
    const wX = proj.x1 - proj.x0, wZ = proj.z1 - proj.z0, size = Math.max(wX, wZ);
    const x0 = proj.x0 - (size - wX) / 2, z0 = proj.z0 - (size - wZ) / 2, N = 2048;
    const map = document.createElement('canvas'); map.width = map.height = N;
    const g = map.getContext('2d'); g.fillStyle = '#20465a'; g.fillRect(0, 0, N, N);
    g.drawImage(img, (proj.x0 - x0) / size * N, (proj.z0 - z0) / size * N, wX / size * N, wZ / size * N);
    const box = { x0, z0, size };
    const fields = proj.aerodromes.map(a => ({ x: a.x, z: a.z, name: a.name, kind: a.kind === 'water' ? 'water' : 'strip', id: a.id }));
    const at = id => proj.aerodromes.find(a => a.id === id);
    const H = at('HOME'), w3 = at('w3'), tw = at('tw_ski');
    const plan = { legs: [{ A: [H.x, H.z], B: [w3.x, w3.z], name: 'Ridgeback' }, { A: [w3.x, w3.z], B: [tw.x, tw.z], name: 'Skyline' }], legI: 0 };
    GPS.bind({ kind: KIND, units: 'aviation', src: { map: () => map, box: () => box, fields: () => fields, plan: () => plan, dest: () => tw } });
    const mat = GPS.material(aspect, KIND), cv = mat.map ? mat.map.image : GPS.state().cv;
    const cg = [H.x, 300, H.z];
    const CK = { gpsOn: true, cg, nightK: () => 1 };
    const snap = () => cv.toDataURL('image/png');
    const out = {};
    // power on: the splash
    GPS.tick(1 / 60, CK); for (let i = 0; i < 30; i++) GPS.tick(1 / 60, CK);
    out.boot = snap();
    // flown along the plan at 45 m/s (the track builds behind it, the numbers live): 40 s into the first leg...
    const fly = (A, B, sec) => { const dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz);
      for (let i = 0; i < sec * 60; i++) { const s = Math.min(L, 45 * i / 60); cg[0] = A.x + dx / L * s; cg[2] = A.z + dz / L * s; GPS.tick(1 / 60, CK); } };
    fly(H, w3, 40);
    out.map = snap();
    // ...over Ridgeback and 70 s down the second leg
    fly({ x: cg[0], z: cg[2] }, w3, 25); plan.legI = 1; fly(w3, tw, 70);
    out.map_leg2 = snap();
    // G2812: the softkeys - the range a step in (2 nm), track-up, the nav page; then back to the map, north up, 4 nm
    GPS.key('rngDn'); out.map_2nm = snap();
    GPS.key('orient'); fly(w3, tw, 4); out.map_trkup = snap();
    GPS.key('page'); out.nav = snap();
    GPS.key('page'); GPS.key('orient'); GPS.key('rngUp');
    // the avionics master off: the screen dark (cockpit.js CK.gpsOn from the bus)
    CK.gpsOn = false; for (let i = 0; i < 30; i++) GPS.tick(1 / 60, CK);
    out.off = snap();
    // the shed: the unit off, its standby page
    GPS.standby();
    out.standby = snap();
    out.size = [cv.width, cv.height];
    return out;
  }, { mapURL, proj, KIND, aspect });
  const save = (k, url) => { const f = path.join(OUT, 'gps_' + k + '.png'); fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); return f; };
  for (const k of ['boot', 'map', 'map_leg2', 'map_2nm', 'map_trkup', 'nav', 'off', 'standby']) save(k, shots[k]);
  // the four, 2 x 2, labelled
  const sheet = await page.evaluate(async ({ shots }) => {
    const im = await Promise.all(['boot', 'map', 'map_2nm', 'map_trkup', 'nav', 'standby'].map(async k => { const i = new Image(); i.src = shots[k]; await i.decode(); return [k, i]; }));
    const w = im[0][1].width, h = im[0][1].height, pad = 28;
    const c = document.createElement('canvas'); c.width = 2 * w + 3 * 12; c.height = 3 * (h + pad) + 12;
    const g = c.getContext('2d'); g.fillStyle = '#2b2b2b'; g.fillRect(0, 0, c.width, c.height);
    im.forEach(([k, i], q) => { const x = 12 + (q % 2) * (w + 12), y = (q >> 1) * (h + pad) + pad;
      g.fillStyle = '#ddd'; g.font = '16px sans-serif'; g.fillText(k.replace('_', ' '), x, y - 8); g.drawImage(i, x, y); });
    return c.toDataURL('image/png');
  }, { shots });
  save('sheet', sheet);
  console.log('the ' + KIND + ' GPS screen, ' + shots.size.join(' x ') + ' px: ' + ['boot', 'map', 'map_leg2', 'map_2nm', 'map_trkup', 'nav', 'off', 'standby', 'sheet'].map(k => 'gps_' + k + '.png').join(', ') + ' -> ' + OUT);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
