#!/usr/bin/env node
// CITY-B-host.js - THE TOWN HOST IN A REAL BROWSER (G3422, CITY-B evidence). Headless Chromium (Playwright; SwiftShader on a
// cloud box, the GPU on A0's), the vendored three r186, MATLIB, house_tarr.js, town_ring.js, townkit.js and the house
// generator, the committed town kit and CITY-A's city pack (src/core/city_packs.json + media/city/). It builds
// TOWNKIT.town exactly as render_premises does (the far town's plain vertex-colour material at lod.farGain, the ground's polygon
// offset), and:
//   1 RENDERS three views - FAR (6 km out, 400 m up), MID (1.3 km), NEAR (over the fullest cell, 300 m off, 80 m up), shadows on -
//     with three's shader checks on: every program the town needs links (a console error names any that does not), and the
//     PNGs go to reports/evidence/CITY-B/;
//   2 TIMES THE TICK in Chrome's own V8 (the page's clock): the town host idle far, idle near, flying the circuit 5 km out;
//     against them TODAY's kit host (TOWNKIT.host on the kit table: its near ring, and the full walk of before ?kitring=0);
//   3 COUNTS what the town puts in the scene (Object3Ds, draws, triangles a view).
//
//   node tools/evidence/CITY-B-host.js [--fallback <dir>] [--out reports/evidence/CITY-B] [--size 1280x720]
//     --fallback: a root holding flyDiy/src/core/city_packs.json and flyDiy/media/city/ when the tree has not got them
//                 (tools/_serve.js --fallback)
// Prints one JSON summary line (CITYB {...}) and the PNG paths. On A0's box it renders on the GPU: the stills are the look.
'use strict';
const path = require('path');
const fs = require('fs');
const net = require('net');
const http = require('http');
const { spawn } = require('child_process');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const REPO = path.resolve(__dirname, '..', '..', '..');
const OUT = path.resolve(opt('out', path.join(__dirname, '..', '..', 'reports', 'evidence', 'CITY-B')));
const [SW, SH] = (opt('size', '1280x720')).split('x').map(Number);
const FB = opt('fallback', null);
const sleep = ms => new Promise(r => setTimeout(r, ms));
function findPlaywright() { for (const p of ['playwright', '/opt/node-tools/node_modules/playwright', 'playwright-core']) { try { return require(p); } catch (e) {} } throw new Error('no playwright'); }
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });

// ---- the page's side --------------------------------------------------------------------------------------------------------
async function inPage({ W, H }) {
  const T = window.THREE, TK = window.TOWNKIT, HG = window.HOUSE_GEN;
  const gunz = r => { if (!r.ok) throw new Error(r.url + ' ' + r.status); return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(); };
  const man = await (await fetch('src/core/townkit_pack.json')).json();
  const inst = man.instances.find(i => i.id === 'jolene') || man.instances[0];
  const P = TK.decodePack(new Uint8Array(await gunz(await fetch(man.pack.src))));
  const I = TK.decodeInstances(new Uint8Array(await gunz(await fetch(inst.src))));
  const CM = await (await fetch('src/core/city_packs.json')).json();
  const town = CM.towns.find(t => t.island === 'jolene' && t.variant === 'town');
  const cells = [];
  for (const c of town.cells) cells.push(TK.decodeCityCell(new Uint8Array(await gunz(await fetch(c.src)))));
  const city = TK.cityOf(town, cells);
  const errs = [];
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H; document.body.appendChild(canvas);
  const R = new T.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  R.setSize(W, H, false); R.shadowMap.enabled = true; R.debug.checkShaderErrors = true;
  const scene = new T.Scene(); scene.background = new T.Color(0x9cc4e4);
  scene.add(new T.HemisphereLight(0xdfefff, 0x6a6048, 1.1));
  const sun = new T.DirectionalLight(0xffffff, 2.2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -500, right: 500, top: 500, bottom: -500, near: 1, far: 4000 }); scene.add(sun); scene.add(sun.target);
  const TA = window.HOUSE_TARR.make(T, { HG });
  const shell = new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }); shell.color.setScalar(city.lod.farGain);
  const ground = new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const propMat = new T.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.8 }), propGeo = new T.BoxGeometry(1.8, 1.4, 4.2); propGeo.translate(0, 0.7, 0);
  const t0 = performance.now();
  const TW = TK.town(T, { pack: P, city, tarr: TA, HG, farMats: { shell, ground }, propGeo: () => [{ geometry: propGeo, material: propMat }] });
  const buildMs = performance.now() - t0;
  scene.add(TW.group); TW.freeze();
  // the ground under the town: a plane at its lowest floor
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity, y0 = Infinity;
  for (const c of city.cells) { x0 = Math.min(x0, c.box[0]); z0 = Math.min(z0, c.box[1]); x1 = Math.max(x1, c.box[2]); z1 = Math.max(z1, c.box[3]); y0 = Math.min(y0, c.o[1]); }
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const gp = new T.Mesh(new T.PlaneGeometry(40000, 40000), new T.MeshStandardMaterial({ color: 0x55663f, roughness: 1 })); gp.rotation.x = -Math.PI / 2; gp.position.set(cx, y0 - 0.5, cz); gp.receiveShadow = true; scene.add(gp);
  const big = city.cells.reduce((a, c) => (c.rows[1] > a.rows[1] ? c : a)), bx = (big.box[0] + big.box[2]) / 2, bz = (big.box[1] + big.box[3]) / 2;
  const cam = new T.PerspectiveCamera(50, W / H, 1, 30000);
  const views = { far: [[x1 + 6000, y0 + 400, cz], [cx, y0, cz]], mid: [[x1 + 1300, y0 + 250, cz], [cx, y0, cz]], near: [[bx + 300, y0 + 80, bz + 120], [bx, y0 + 5, bz]] };
  const shots = {}, stat = {};
  for (const [k, [e, at]] of Object.entries(views)) {
    cam.position.set(e[0], e[1], e[2]); cam.lookAt(at[0], at[1], at[2]); cam.updateMatrixWorld();
    sun.position.set(cam.position.x + 600, cam.position.y + 900, cam.position.z + 300); sun.target.position.set(at[0], at[1], at[2]);
    for (let i = 0; i < 40; i++) { TW.tick(cam.position); if (TW.kit.waiting) TW.kit.relook(); }
    R.info.reset(); R.info.autoReset = false; R.render(scene, cam);
    stat[k] = { calls: R.info.render.calls, tris: R.info.render.triangles, near: TW.stats.near, nearRows: TW.stats.nearHouses, propsNear: TW.stats.propsNear, castOn: TW.stats.castOn, rungs: TW.kit.rungs() };
    shots[k] = canvas.toDataURL('image/png');
  }
  // the tick in this V8: idle far, idle near, the circuit 5 km out
  const time = (n, f) => { const a = performance.now(); for (let i = 0; i < n; i++) f(i); return (performance.now() - a) / n * 1000; };   // us a call
  const farE = new T.Vector3(x1 + 6400, y0 + 300, cz), nearE = new T.Vector3(bx, y0 + 60, bz), circ = new T.Vector3();
  TW.tick(farE); const usFar = time(200000, () => TW.tick(farE));
  TW.tick(nearE); TW.tick(nearE); const usNear = time(20000, () => TW.tick(nearE));
  const usCirc = time(20000, i => { const a = i * 0.0003; circ.set(cx + 5000 * Math.cos(a), y0 + 300, cz + 5000 * Math.sin(a)); TW.tick(circ); });
  // today's kit host on the kit table (Metlakatla ON as master): its ring, and the full walk of before
  const KR = TK.host(T, { pack: P, rows: I.rows, tarr: TA, HG, mode: 'batch' }), KF = TK.host(T, { pack: P, rows: I.rows, tarr: TA, HG, mode: 'batch', ring: false });
  KR.tick(farE); KF.tick(farE);
  const kitRingFar = time(200000, () => KR.tick(farE)), kitFullFar = time(20000, () => KF.tick(farE));
  let census = 0; TW.group.traverse(() => { census++; });
  return { shots, stat, buildMs, usFar, usNear, usCirc, kitRingFar, kitFullFar, census, cells: city.cells.length, rows: city.rows.length, props: city.props.n, kitRows: I.rows.length,
           programs: R.info.programs ? R.info.programs.length : null, gpu: (() => { const gl = R.getContext(), d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : '?'; })(), errs };
}

(async () => {
  const port = await freePort();
  const sargs = [path.join(__dirname, '..', '_serve.js'), String(port), REPO].concat(FB ? ['--fallback', path.resolve(FB)] : []);
  const server = spawn(process.execPath, sargs, { stdio: 'ignore' });
  let browser = null, code = 0;
  try {
    for (let i = 0; ; i++) { const ok = await new Promise(res => { const rq = http.get('http://127.0.0.1:' + port + '/flyDiy/version.json', r => { r.resume(); res(true); }); rq.on('error', () => res(false)); }); if (ok) break; if (i > 60) throw new Error('the static server never answered'); await sleep(250); }
    const { chromium } = findPlaywright();
    browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    const page = await browser.newPage({ viewport: { width: SW, height: SH } });
    page.setDefaultTimeout(600000);
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e).slice(0, 300)));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 400)); });
    await page.goto('http://127.0.0.1:' + port + '/flyDiy/version.json');
    await page.evaluate(() => { document.open(); document.write('<!doctype html><html><body style="margin:0"></body></html>'); document.close(); });
    for (const f of ['vendor/three.min.js', 'src/viewer/matlib.js', 'src/viewer/house_tarr.js', 'src/viewer/town_ring.js', 'src/viewer/townkit.js', 'tools/_house_kit.js', 'tools/_house_gen.js'])
      await page.addScriptTag({ url: 'http://127.0.0.1:' + port + '/flyDiy/' + f });
    const r = await page.evaluate(inPage, { W: SW, H: SH });
    fs.mkdirSync(OUT, { recursive: true });
    const files = [];
    for (const [k, d] of Object.entries(r.shots)) { const f = path.join(OUT, 'town_' + k + '.png'); fs.writeFileSync(f, Buffer.from(d.split(',')[1], 'base64')); files.push(f); }
    delete r.shots; r.errors = errors.concat(r.errs); delete r.errs;
    const sum = Object.assign({}, r, { usFar: +r.usFar.toFixed(3), usNear: +r.usNear.toFixed(2), usCirc: +r.usCirc.toFixed(3), kitRingFar: +r.kitRingFar.toFixed(3), kitFullFar: +r.kitFullFar.toFixed(2), buildMs: Math.round(r.buildMs) });
    console.log('CITYB ' + JSON.stringify(sum));
    console.log('  the tick, us a call (this V8): the town host idle far ' + sum.usFar + ', idle near ' + sum.usNear + ', the circuit ' + sum.usCirc + '; today\'s kit host far: its ring ' + sum.kitRingFar + ', the full walk ' + sum.kitFullFar);
    for (const k of Object.keys(sum.stat)) console.log('  ' + k + ': ' + JSON.stringify(sum.stat[k]));
    console.log('  ' + (sum.errors.length ? sum.errors.length + ' ERRORS: ' + sum.errors.slice(0, 6).join(' | ') : 'no shader or page error'));
    for (const f of files) console.log('  -> ' + path.relative(process.cwd(), f));
    if (sum.errors.length) code = 1;
  } catch (e) { console.error('CITY-B-host: ' + (e && e.stack || e)); code = 1; }
  finally { if (browser) await browser.close().catch(() => {}); server.kill(); }
  process.exit(code);
})();
