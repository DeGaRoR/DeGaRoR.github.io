#!/usr/bin/env node
// pfd_shots.js - THE GLASS UNIT'S PFD AS THE GAME PAINTS IT, ON ANY BOX (G2813; the user, 27 Oct: "an easy version of a
// PFD, the typical Garmin glass cockpit with the attitude, possibly even a virtual ground")
//
// gps_shots.js's way: src/viewer/gps_face.js runs unchanged in headless Chromium's 2D canvas (only WebGL is missing
// there). The ground the synthetic vision bakes its grid from is Jolene's own (tools/island_node.js islandWorld, the
// node world the gates fly), sampled here on the unit's grid points and handed over as a table, so the page's
// src.ground answers exactly what the game's would on those points. The island's strips come with their headings,
// lengths and elevations. The aeroplane (sim.out: the attitude, the speeds; cg: the position) is set per state and
// moved along its heading for a few seconds so the ground speed, the track and the trends are live.
// Writes <out>/pfd_<state>.png for: cruise (over the island toward the hills), turn (a 25 deg bank, climbing), low
// (low over high ground: the terrain colours), lineup (on Jolene 13 before take-off), classic (the synthetic vision off),
// nocert (the cruise with no certificate: no speed colours - G2814),
// map (the map page with its zoom buttons), and pfd_sheet.png.
//   node tools/pfd_shots.js <outDir> [aviation|metric] [glass|flat|flatPair]
// (G2815: flat / flatPair - the 10 in display at its 768 px canvas; a pair also writes pfd_mfd.png, the MFD with its
// engine strip, during the last cruise)
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.resolve(process.argv[2] || 'pfd_shots'), UNITS = process.argv[3] === 'metric' ? 'metric' : 'aviation';
const KIND = ['glass', 'flat', 'flatPair'].includes(process.argv[4]) ? process.argv[4] : 'glass';
fs.mkdirSync(OUT, { recursive: true });

const C = require(path.join(__dirname, 'flight_core.js'));
const IN = require(path.join(__dirname, 'island_node.js'));
const proj = JSON.parse(fs.readFileSync(path.join(ROOT, 'media', 'map', fs.readdirSync(path.join(ROOT, 'media', 'map')).find(f => /^jolene_proj/.test(f))), 'utf8'));
const mapFile = path.join(ROOT, 'media', 'map', fs.readdirSync(path.join(ROOT, 'media', 'map')).find(f => /^jolene_map.*\.png$/.test(f)));
const face = C.GEN_AVIONICS.gps[KIND].face;

// the map's box (the printed island padded square, as gps_shots.js) and the unit's grid on it, from the node world
const wX = proj.x1 - proj.x0, wZ = proj.z1 - proj.z0, size = Math.max(wX, wZ);
const box = { x0: proj.x0 - (size - wX) / 2, z0: proj.z0 - (size - wZ) / 2, size };
const t0 = Date.now();
const W = IN.islandWorld('jolene', { premises: fs.readFileSync(path.join(__dirname, 'fixtures', 'island_jolene.json'), 'utf8') });
global.GEN_AVIONICS = C.GEN_AVIONICS;
const N = Math.round(Math.sqrt(require(path.join(ROOT, 'src', 'viewer', 'gps_face.js')).sv().hf.length));   // (the unit's own grid)
const cell = box.size / (N - 1), HT = new Array(N * N);
for (let i = 0; i < N * N; i++) HT[i] = +W.terrainH(box.x0 + (i % N) * cell, box.z0 + Math.floor(i / N) * cell).toFixed(2);
console.log('the ground: ' + N + ' x ' + N + ' points in ' + (Date.now() - t0) + ' ms');
const fields = W.aerodromes.map(a => ({ id: a.id, name: a.name, x: a.x, z: a.z, kind: a.water || a.kind === 'water' ? 'water' : 'strip', hdg: a.hdg, len: a.len, wid: a.wid, elev: a.elev }));
const at = id => fields.find(a => a.id === id);
// the states: where, which way (deg from north), how high, how fast, the attitude
const H = at('HOME');
const hdgRw = ((Math.atan2(Math.cos(H.hdg), -Math.sin(H.hdg)) * 180 / Math.PI) + 360) % 360;   // the strip's way
const states = [
  { k: 'cruise', x: H.x + 1500, z: H.z - 2500, hdg: 20, agl: 320, ias: 46, vs: 0.3, pitch: 2.5, roll: -4, beta: 0 },
  { k: 'turn', x: H.x + 3000, z: H.z - 6000, hdg: 70, agl: 380, ias: 42, vs: 2.2, pitch: 7, roll: 25, beta: 0.01 },
  { k: 'low', x: 4500, z: -9000, hdg: 40, alt: 420, ias: 38, vs: -0.5, pitch: 0, roll: 0, beta: 0, hunt: true },
  { k: 'lineup', x: H.x, z: H.z, hdg: hdgRw, alt: H.elev + 1.6, ias: 0, vs: 0, pitch: 0, roll: 0, beta: 0, ground: true },
  { k: 'classic', x: H.x + 1500, z: H.z - 2500, hdg: 20, agl: 320, ias: 46, vs: 0.3, pitch: 2.5, roll: -4, beta: 0, svt: false },
  { k: 'nocert', x: H.x + 1500, z: H.z - 2500, hdg: 20, agl: 320, ias: 46, vs: 0.3, pitch: 2.5, roll: -4, beta: 0, nocert: true },
];
// G2814: the speeds the game hands the PFD (app.js gpsSpeeds) for the C172 as the game flies it: the bands off its
// certificate's design speeds (genCertSpeeds), the stalls and the reference speeds off its machine sheet
const SPEEDS = (() => {
  const TR = require(path.join(__dirname, '_tour_lib.js')), PT = require(path.join(__dirname, 'pilot_trace.js'));
  const def = TR.defOf(C, PT, TR.BUILDS.c172.key), ms = C.machineSheet(def), V = C.genCertSpeeds(def);
  return { cert: true, Vs0: ms.Vs0, Vs1: ms.Vs, Vr: ms.Vrot, Vx: ms.Vx, Vy: ms.Vy, Vg: ms.Vbg, Vfe: V.VF, Vno: V.VC, Vne: 0.9 * V.VD, rpm: 2700 };
})();
console.log('the C172\'s speeds (kt): ' + Object.entries(SPEEDS).filter(([k, v]) => typeof v === 'number' && k !== 'rpm').map(([k, v]) => k + ' ' + (v * 1.943844).toFixed(0)).join(', '));
// (a state by its height over the ground under it: the highest ground of its last 3 s and where it is)
for (const s of states) if (s.agl != null) {
  const a = s.hdg * Math.PI / 180; let g = 0;
  for (let t = -3; t <= 0; t += 0.5) g = Math.max(g, W.terrainH(s.x + Math.sin(a) * s.ias * t, s.z - Math.cos(a) * s.ias * t));
  s.alt = g + s.agl;
}
// 'low': the highest ground on the grid's middle, approached at 60 m over it from 2 km out
{ let best = -1, bx = 0, bz = 0; for (let i = 0; i < N * N; i++) { const x = box.x0 + (i % N) * cell, z = box.z0 + Math.floor(i / N) * cell;
    if (HT[i] > best && Math.hypot(x - H.x, z - H.z) < 9000) { best = HT[i]; bx = x; bz = z; } }
  const L = states.find(s => s.k === 'low'), a = L.hdg * Math.PI / 180;
  L.x = bx - Math.sin(a) * 2000; L.z = bz + Math.cos(a) * 2000; L.alt = best + 60; L.peak = best; }

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
  const shots = await page.evaluate(async ({ mapURL, proj, box, HT, N, fields, states, aspect, UNITS, SPEEDS, KIND }) => {
    const GPS = window.FLYDIY_GPS;
    const img = new Image(); img.src = mapURL; await img.decode();
    const M = 2048, map = document.createElement('canvas'); map.width = map.height = M;
    const g = map.getContext('2d'); g.fillStyle = '#20465a'; g.fillRect(0, 0, M, M);
    g.drawImage(img, (proj.x0 - box.x0) / box.size * M, (proj.z0 - box.z0) / box.size * M, (proj.x1 - proj.x0) / box.size * M, (proj.z1 - proj.z0) / box.size * M);
    const cell = box.size / (N - 1);
    const ground = (x, z) => { const i = Math.round((x - box.x0) / cell), j = Math.round((z - box.z0) / cell); return HT[Math.max(0, Math.min(N - 1, j)) * N + Math.max(0, Math.min(N - 1, i))]; };
    const H = fields.find(a => a.id === 'HOME'), w3 = fields.find(a => a.id === 'w3');
    const plan = { legs: [{ A: [H.x, H.z], B: [w3.x, w3.z], name: 'Ridgeback' }], legI: 0 };
    const SP = SPEEDS, NOC = Object.assign({}, SPEEDS, { cert: false });
    let noCert = false;
    const speeds = () => (noCert ? NOC : SP);
    GPS.bind({ kind: KIND, units: UNITS, speeds, src: { map: () => map, box: () => box, fields: () => fields, plan: () => plan, dest: () => w3, ground } });
    const cv = GPS.state(0).cv, cv2 = GPS.units() === 2 ? GPS.state(1).cv : null;
    const out = {}, times = {};
    const o = { Veas: 0, vs: 0, roll: 0, pitch: 0, hdg: 0, beta: 0 };
    // (the cockpit's readings for the MFD's engine strip: the C172's O-320 at cruise)
    const CK = { gpsOn: true, cg: [0, 0, 0], nightK: () => 1, sim: { out: o },
      readings: { rpmEng: 2350, oilP: 62 * 6894.757, oilT: 82, fuelFrac: 0.68, volts: 13.9, ampsOut: -2.4 }, energy: { kind: 'fuel', capacity: 212 } };
    // power on, the grid baked (a slice a frame), then each state flown for 3 s along its heading
    for (let i = 0; i < 200 && !GPS.sv().ready; i++) GPS.tick(1 / 60, CK);
    for (const s of states) {
      const S = GPS.state();
      GPS.state(0); S.svt = s.svt !== false; if (S.page !== 'pfd') S.page = 'pfd'; noCert = !!s.nocert;
      const a = s.hdg * Math.PI / 180, ux = Math.sin(a), uz = -Math.cos(a), gs = s.ground ? 0 : s.ias;
      o.hdg = Math.atan2(uz, ux);
      // (a new state: no jump read as speed)
      S.px = s.x - ux * gs * 3; S.pz = s.z - uz * gs * 3; S.gs = gs; S.trk = a;
      o.roll = s.roll * Math.PI / 180; o.pitch = s.pitch * Math.PI / 180; o.beta = s.beta; o.vs = s.vs;
      for (let f = 0; f <= 180; f++) {
        const t = (f - 180) / 60;
        CK.cg[0] = s.x + ux * gs * t; CK.cg[2] = s.z + uz * gs * t; CK.cg[1] = s.alt + s.vs * t;
        o.Veas = s.ias * (0.97 + 0.03 * f / 180);
        GPS.tick(1 / 60, CK);
      }
      const t1 = performance.now(); for (let r = 0; r < 20; r++) GPS.paintPfd(CK.cg[0], CK.cg[2], 0); times[s.k] = (performance.now() - t1) / 20;
      out[s.k] = cv.toDataURL('image/png');
      if (cv2 && s.k === 'nocert') out.mfd = cv2.toDataURL('image/png');
    }
    GPS.state().svt = true;
    GPS.key('page'); out.map = cv.toDataURL('image/png');
    return { out, times, size: [cv.width, cv.height] };
  }, { mapURL, proj, box, HT, N, fields, states, aspect: face.sw / face.sh, UNITS, SPEEDS, KIND });
  const save = (k, url) => fs.writeFileSync(path.join(OUT, 'pfd_' + k + '.png'), Buffer.from(url.split(',')[1], 'base64'));
  for (const k of Object.keys(shots.out)) save(k, shots.out[k]);
  const sheet = await page.evaluate(async ({ out }) => {
    const ks = ['cruise', 'turn', 'low', 'lineup', 'nocert', 'map'];
    const im = await Promise.all(ks.map(async k => { const i = new Image(); i.src = out[k]; await i.decode(); return [k, i]; }));
    const w = im[0][1].width, h = im[0][1].height, pad = 28;
    const c = document.createElement('canvas'); c.width = 2 * w + 36; c.height = 3 * (h + pad) + 12;
    const g = c.getContext('2d'); g.fillStyle = '#2b2b2b'; g.fillRect(0, 0, c.width, c.height);
    im.forEach(([k, i], q) => { const x = 12 + (q % 2) * (w + 12), y = (q >> 1) * (h + pad) + pad;
      g.fillStyle = '#ddd'; g.font = '16px sans-serif'; g.fillText(k, x, y - 8); g.drawImage(i, x, y); });
    return c.toDataURL('image/png');
  }, { out: shots.out });
  save('sheet', sheet);
  const low = states.find(s => s.k === 'low');
  console.log('the glass PFD, ' + shots.size.join(' x ') + ' px -> ' + OUT + '\n  paint ms: ' + Object.entries(shots.times).map(([k, v]) => k + ' ' + v.toFixed(2)).join(', ') +
    '\n  low: the peak ' + low.peak.toFixed(0) + ' m, flown at ' + low.alt.toFixed(0) + ' m; lineup on HOME heading ' + hdgRw.toFixed(0));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
