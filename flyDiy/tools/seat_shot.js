#!/usr/bin/env node
// seat_shot.js - THE SEAT STUDIO'S CAMERA (SEATS, 2026-11-02). Opens tools/_seats.html in a headless Chromium
// (SwiftShader is enough: one seat on a cyclorama is a small scene) and writes the contact sheet and close-ups.
//
//   node flyDiy/tools/seat_shot.js --out <dir> [--only sheet|close] [--types 0,3,4] [--tw 520]
//   -> <dir>/seats_sheet.png (every seat, 3/4 over side), <dir>/seat_<key>_q.png close-ups, and a line
//      SEAT_SHOT {json} with each seat's triangles, draws and kg (the STATUS table is made from it)
'use strict';
const path = require('path');
const fs = require('fs');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(opt('out', 'seat_shots'));
const ONLY = opt('only', 'all');
fs.mkdirSync(OUT, { recursive: true });

// the sheet: today's two kept seats (tube, the old shell for the before/after), then the library
const SHEET = [
  { type: 0, rake: 13, tilt: 3, label: 'Tube frame (today\'s default)' },
  { type: 10, label: 'Cub (the default, reworked)' },
  { type: 1, rake: 22, tilt: 6, label: 'Composite shell (today)' },
  { type: 3, label: 'Carbon bucket (reworked)' },
  { type: 4, label: 'Cessna 172' },
  { type: 5, label: 'ICON A5' },
  { type: 6, label: 'Bonanza' },
  { type: 7, label: 'Ultralight (A22)' },
  { type: 8, label: 'Extra 330' },
  { type: 9, label: 'DC-3 pilots' },
  { type: 9, pax: true, label: 'DC-3 passengers' },
  { type: 11, label: 'Agricultural (AT-802)' },
  { type: 12, label: 'WWI wicker (Camel)' },
  { type: 13, label: 'Glider tub' },
  { type: 14, label: 'Bush jump seat' },
  { type: 15, label: 'Warbird bucket' },
  { type: 16, label: 'Beaver pilots' },
  { type: 16, pax: true, label: 'Beaver passengers (bench)' },
];

(async () => {
  let pw;
  for (const p of ['playwright', '/opt/node-tools/node_modules/playwright']) { try { pw = require(p); break; } catch (e) {} }
  if (!pw) { console.log('FAIL no playwright'); process.exit(2); }
  const browser = await pw.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '_seats.html') + '?seat=4');
  await page.waitForFunction(() => window.SEAT_BENCH && window.SEAT_BENCH.ready, null, { timeout: 120000 });
  const save = (name, url) => { fs.writeFileSync(path.join(OUT, name), Buffer.from(url.split(',')[1], 'base64')); console.log('wrote', name); };
  const types = opt('types', null);
  const list = types ? SHEET.filter(s => types.split(',').map(Number).includes(s.type)) : SHEET;
  const result = {};
  if (ONLY === 'all' || ONLY === 'sheet') {
    const tw = +opt('tw', 420);
    const r = await page.evaluate(([L, tw]) => window.SEAT_BENCH.sheet(L, { tw, th: tw, cols: 6 }), [list, tw]);
    save('seats_sheet.png', r.url);
    result.stats = r.stats;
  }
  if (ONLY === 'all' || ONLY === 'close') {
    for (const it of list) {
      const r = await page.evaluate(([it]) => window.SEAT_BENCH.single(it.type, 35, 16, 1200, 1200, it), [it]);
      save('seat_' + r.stats.key.replace(/[^a-z0-9]+/gi, '') + (it.pax ? '_pax' : '') + '_q.png', r.url);
      const r2 = await page.evaluate(([it]) => window.SEAT_BENCH.single(it.type, 150, 22, 1200, 1200, it), [it]);
      save('seat_' + r2.stats.key.replace(/[^a-z0-9]+/gi, '') + (it.pax ? '_pax' : '') + '_back.png', r2.url);
    }
  }
  console.log('SEAT_SHOT ' + JSON.stringify({ stats: result.stats, errors: errs.slice(0, 20) }));
  await browser.close();
  if (errs.length) { console.log('FAIL page errors: ' + errs.length); process.exit(7); }
})().catch(e => { console.log('FAIL ' + (e && e.stack || e)); process.exit(1); });
