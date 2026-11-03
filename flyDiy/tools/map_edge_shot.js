#!/usr/bin/env node
// map_edge_shot.js - THE PAINTING'S SEAM, MEASURED (G2733, MAP-EDGE; the user, 12 Oct: "the borders of the map not being
// exactly the blue of the background"). Numbers, not stills (the user's rule): the map screen rendered in headless
// Chromium (SwiftShader), the painting at the fit with the sea around it, the screen's own pixels read back (a PNG
// screenshot, decoded here) - once as shipped (the edge canvas on) and once as before (the canvas hidden: the painting
// on the plain art.edge):
//   seam        the mean / max RGB distance between the pixel 2 px OUTSIDE the painting's border and the pixel 2 px
//               INSIDE it, along every border the view shows (the left and right on the wide desk, the top and bottom on
//               the tall one)
//   match       the extension's colour 2 px outside against the OLD render's painting 2 px inside (how well the sampled
//               edge alone - without the rim's blend - meets the painting)
//   outer       the max channel difference from the page's colour from 2 px inside the fade's outer border outward
//               (must be 0), and across that border (2 px either side)
//   bake        MAP_MENU.edge(): the canvas's size and the bake's ms (the copy decoded off the main thread, the bake one
//               task after the open); main: the open's own ms and the longest main-thread task from the open to the
//               edge ready (the harness only: a 0 ms timer loop's longest gap)
// The page: --real boots index.html?map=1 (the whole game; minutes on SwiftShader); the default is a harness - the same
// map_pack.js + map_menu.js + editor.css, nothing else - served from the repo (the screen, its CSS and the painting are
// the shipped files; only the game behind is absent, the map opened with no contracts).
//
//   node tools/_serve.js 8125 <repo root> &   node tools/map_edge_shot.js [--port 8125] [--real] [--out <dir>]
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.join(__dirname, '..');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  try { ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); }
  catch (e2) { console.log('map_edge_shot: no playwright here - nothing measured'); process.exit(0); }
}
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const PORT = +opt('port', 8125), REAL = argv.includes('--real'), OUT = opt('out', null);
const BASE = 'http://127.0.0.1:' + PORT + '/flyDiy/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function png(buf) {   // RGB(A) 8-bit, non-interlaced (Chromium's screenshots)
  let p = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8);
    if (type === 'IHDR') { w = buf.readUInt32BE(p + 8); h = buf.readUInt32BE(p + 12); ct = buf[p + 17]; }
    else if (type === 'IDAT') idat.push(buf.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(w * h * bpp);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[dst + x - bpp] : 0, b = y > 0 ? out[dst - stride + x] : 0, c = (x >= bpp && y > 0) ? out[dst - stride + x - bpp] : 0;
      let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      out[dst + x] = v & 255;
    }
  }
  return { w, h, bpp, at: (x, y) => { const i = (Math.round(y) * w + Math.round(x)) * bpp; return [out[i], out[i + 1], out[i + 2]]; } };
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const dmax = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));

const HARNESS = '<!doctype html><html class="ws"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<link rel="stylesheet" href="src/viewer/editor.css"><style>html,body{margin:0;background:#000}</style></head><body>' +
  '<script src="src/viewer/map_pack.js"></script><script src="src/viewer/map_menu.js"></script></body></html>';

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const report = { page: REAL ? 'index.html?map=1' : 'harness (map_pack.js + map_menu.js + editor.css)', runs: [] };
  // the wide desk shows the painting's left and right borders at the fit, the tall desk its top and bottom; the phone
  // (the bottom sheet) its own fit
  for (const R of [{ name: 'desk-wide', vp: { width: 1600, height: 900 } }, { name: 'desk-tall', vp: { width: 900, height: 1600 } },
                   { name: 'phone', vp: { width: 390, height: 844 }, mobile: true }]) {
    const ctx = await browser.newContext({ viewport: R.vp, deviceScaleFactor: 1, isMobile: !!R.mobile, hasTouch: !!R.mobile }), pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    let t0 = Date.now();
    if (REAL) {
      await pg.goto(BASE + 'index.html?audio=0&map=1' + (R.mobile ? '&profile=phone' : ''), { waitUntil: 'domcontentloaded' });
      for (let k = 0; k < 600 && !(await pg.evaluate(() => !!document.getElementById('mapEntry')).catch(() => false)); k++) await sleep(500);
      await pg.click('#mapEntry');
      for (let k = 0; k < 200 && !(await pg.evaluate(() => !!(window.MAP_MENU && MAP_MENU.isOpen && MAP_MENU.isOpen())).catch(() => false)); k++) await sleep(300);
    } else {
      await pg.route(BASE + '__edge.html', r => r.fulfill({ contentType: 'text/html', body: HARNESS }));
      await pg.goto(BASE + '__edge.html', { waitUntil: 'load' });
      t0 = Date.now();
      await pg.evaluate(() => { window.__gap = 0; let last = performance.now(); const tick = () => { const n = performance.now(); window.__gap = Math.max(window.__gap, n - last); last = n; if (!window.__gapStop) setTimeout(tick, 0); }; window.__t0 = performance.now(); tick(); });
      await pg.evaluate(() => MAP_MENU.open({ source: 'empty' }).then(() => { window.__openMs = performance.now() - window.__t0; }));
    }
    for (let k = 0; k < 100 && !(await pg.evaluate(() => MAP_MENU.edge().ready || !!MAP_MENU.edge().err)); k++) await sleep(100);
    const openMs = Date.now() - t0;
    await sleep(200);
    const main = await pg.evaluate(() => { window.__gapStop = true; return { openMs: window.__openMs == null ? null : +window.__openMs.toFixed(1), longestTaskMs: window.__gap == null ? null : +window.__gap.toFixed(1) }; });
    await pg.evaluate(() => MAP_MENU.fit()); await sleep(600);
    const G = await pg.evaluate(() => {
      const m = document.querySelector('#mapScreen .mmMap').getBoundingClientRect(), V = MAP_MENU.view(), P = window.MAP_PACK, E = MAP_MENU.edge();
      const cv = document.querySelector('#mapScreen .mmEdge');
      return { m: { l: m.left, t: m.top, w: m.width, h: m.height }, V, w: P.w, h: P.h, edge: E, bg: getComputedStyle(document.querySelector('#mapScreen .mmMap')).backgroundColor,
               canvases: document.querySelectorAll('#mapScreen canvas.mmEdge').length, inStage: !!(cv && cv.parentNode.classList.contains('mmStage')), pe: cv && getComputedStyle(cv).pointerEvents };
    });
    // the map's own pixels only: the UI over it (the zoom, the scale, the compass, the badges, the infrastructure, the
    // phone's close button) hidden while measuring
    await pg.evaluate(() => { for (const e of document.querySelectorAll('#mapScreen .mmCtl, #mapScreen .mmScale, #mapScreen .mmRose, #mapScreen .mmOv, #mapScreen .mmInfra, #mapScreen .mmTitle')) e.style.visibility = 'hidden'; });
    const shot = async on => { await pg.evaluate(v => { document.querySelector('#mapScreen .mmEdge').style.display = v ? 'block' : 'none'; }, on); await sleep(400); return pg.screenshot({ type: 'png' }); };
    const bufNew = await shot(true), bufOld = await shot(false);
    await shot(true);
    if (OUT) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'map_edge_' + R.name + '_new.png'), bufNew); fs.writeFileSync(path.join(OUT, 'map_edge_' + R.name + '_old.png'), bufOld); }
    const N = png(bufNew), O = png(bufOld), s = G.V.s;
    const L = G.m.l + G.V.tx, T = G.m.t + G.V.ty, Rr = L + G.w * s, Bb = T + G.h * s, F = (G.edge.F || 0) * s;
    const vis = (x, y) => x >= G.m.l + 1 && x <= G.m.l + G.m.w - 2 && y >= G.m.t + 1 && y <= G.m.t + G.m.h - 2;
    // the map area the phone's folded sheet leaves (view(): 38 % of the map's height under it)
    const viewH = R.mobile ? G.m.h - Math.round(G.m.h * 0.38) : G.m.h, visV = (x, y) => vis(x, y) && y <= G.m.t + viewH - 2;
    // the borders the view shows: a list of [outside point, inside point] pairs 2 px either side, every 2 px along
    const pairs = [], outer = [];
    const pushSide = (n, along0, along1, fn) => { for (let u = along0 + 6; u <= along1 - 6; u += 2) { const [o, i, f1, f2] = fn(u); if (visV(...o) && visV(...i)) pairs.push({ side: n, o, i }); if (F && visV(...f1) && visV(...f2)) outer.push({ side: n, f1, f2 }); } };
    pushSide('left', T, Bb, y => [[L - 2, y], [L + 2, y], [L - F + 2, y], [L - F - 2, y]]);
    pushSide('right', T, Bb, y => [[Rr + 2, y], [Rr - 2, y], [Rr + F - 2, y], [Rr + F + 2, y]]);
    pushSide('top', L, Rr, x => [[x, T - 2], [x, T + 2], [x, T - F + 2], [x, T - F - 2]]);
    pushSide('bottom', L, Rr, x => [[x, Bb + 2], [x, Bb - 2], [x, Bb + F - 2], [x, Bb + F + 2]]);
    const stat = f => { if (!pairs.length) return null; const v = pairs.map(f); return { mean: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2), max: +Math.max(...v).toFixed(1) }; };
    const page = /rgb\((\d+), (\d+), (\d+)\)/.exec(G.bg).slice(1, 4).map(Number);
    // the outer border: from 2 px inside it outward to the view's edge, every pixel the page's colour; and across it
    let outerMax = 0, outerN = 0, across = 0;
    for (const q of outer) {
      across = Math.max(across, dmax(N.at(...q.f1), N.at(...q.f2)));
      const [x, y] = q.f1, dx = q.side === 'left' ? -1 : q.side === 'right' ? 1 : 0, dy = q.side === 'top' ? -1 : q.side === 'bottom' ? 1 : 0;
      for (let k = 0; visV(x + dx * k, y + dy * k); k += 3) { outerMax = Math.max(outerMax, dmax(N.at(x + dx * k, y + dy * k), page)); outerN++; }
    }
    const run = { name: R.name, viewport: R.vp, scale: +s.toFixed(4), canvases: G.canvases, inStage: G.inStage, pointerEvents: G.pe, page: G.bg, edge: G.edge, openMs, main,
      sides: [...new Set(pairs.map(p => p.side))], samples: pairs.length,
      seamNew: stat(p => dist(N.at(...p.o), N.at(...p.i))), seamOld: stat(p => dist(O.at(...p.o), O.at(...p.i))),
      match: stat(p => dist(N.at(...p.o), O.at(...p.i))),
      outer: { samples: outerN, maxFromPage: outerMax, across: outer.length ? across : null, fadePx: +F.toFixed(1) }, errors: errs };
    report.runs.push(run);
    console.log(R.name + ': ' + JSON.stringify(run));
    await ctx.close();
  }
  await browser.close();
  if (OUT) fs.writeFileSync(path.join(OUT, 'map_edge.json'), JSON.stringify(report, null, 1));
  const bad = report.runs.filter(r => !r.edge.ready || r.canvases !== 1 || !r.inStage || r.pointerEvents !== 'none' || (r.outer.samples && (r.outer.maxFromPage !== 0 || r.outer.across !== 0)) || (r.seamNew && r.seamOld && r.seamNew.mean >= r.seamOld.mean) || r.errors.length);
  console.log(bad.length ? 'map_edge_shot: FAIL ' + bad.map(r => r.name).join() : 'map_edge_shot: ok');
  process.exit(bad.length ? 1 : 0);
})();
