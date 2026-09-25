#!/usr/bin/env node
// tarr_game.js - THE TOWN ON TEXTURE ARRAYS, IN THE GAME (G571). The game rolled out on Jolene (met_perf.js's boot
// poll, through Playwright), the premises' build queue drained by hand, the camera stood over the houses and the
// premises' tick driven by hand (a SwiftShader roll-out never reaches the flight loop - G570), then the same frame
// drawn three ways: the houses whole (hlod.bake off), G566's per-material bake (tarr off), and the arrays (tarr on):
// draw calls, the renderer's programs, the bake's stats, a PNG each.
//
//   node tools/tarr_game.js [--url http://localhost:8125/flyDiy/dev.html?world=jolene] [--out <dir>] [--gl gpu]
'use strict';
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL = opt('url', 'http://localhost:8125/flyDiy/dev.html?world=jolene');
const OUT = opt('out', path.join(__dirname, '..', 'screenshots', 'tarr_game'));
let pw;
try { pw = require('playwright'); } catch (e) { pw = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright')); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const exe = opt('chrome', ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p)));
  const args = opt('gl', 'swiftshader') === 'gpu' ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  const browser = await pw.chromium.launch({ executablePath: exe, headless: true, args });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const logs = [];
  // the page's own loop draws the whole world in software every frame and starves every call made from here: from
  // the moment the premises exist, a frame is held (the shots draw one frame each, by hand). An init script, because
  // after the world is up the main thread no longer answers in time to be told.
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = cb => (window.WORLD && window.WORLD.premises) ? 0 : raf(cb);
  });
  page.on('console', m => { const t = m.text(); if (m.type() === 'error' || m.type() === 'warning' || /house_tarr|premises/.test(t)) logs.push(m.type() + ': ' + t.slice(0, 300)); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  const tryEv = async expr => { try { return await page.evaluate(expr); } catch (e) { return 'ERR ' + e.message.split('\n')[0]; } };
  await page.goto(URL, { waitUntil: 'load', timeout: 180000 });
  const t0 = Date.now(), el = () => Math.round((Date.now() - t0) / 1000) + ' s';
  for (let i = 0; i < 200; i++) {
    await sleep(2000);
    if (await tryEv("!!document.getElementById('bGo') && !document.getElementById('bGo').disabled")) break;
    await tryEv("(()=>{const b=[...document.querySelectorAll('*')].filter(e=>e.children.length===0&&/^Cub-alike$/i.test((e.textContent||'').trim()))[0]; if(b)b.click(); return !!b;})()");
    await tryEv("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click()); return 1;})()");
  }
  console.log('chooser done', el());
  await tryEv("(()=>{const b=document.getElementById('bGo'); if(b) b.click(); return !!b;})()");
  let up = false;
  for (let i = 0; i < 600 && !up; i++) {
    await sleep(2000);
    if (i % 30 === 0) { console.log('  rollout', el(), await tryEv("JSON.stringify({ w: typeof WORLD !== 'undefined', p: typeof WORLD !== 'undefined' && !!WORLD.premises, q: typeof WORLD !== 'undefined' && WORLD.premises && WORLD.premises.stats ? WORLD.premises.stats.queued : null })")); await tryEv("(()=>{const b=document.getElementById('bGo'); if(b && !b.disabled) b.click(); return 1;})()"); }
    up = (await tryEv("typeof WORLD !== 'undefined' && !!WORLD.premises && !!WORLD.renderer")) === true;
  }
  if (!up) throw new Error('no WORLD.premises after ' + el());
  console.log('world up', el());
  // drain the queue by hand (the per-frame stream would, given frames)
  for (let i = 0; i < 400; i++) {
    const q = await tryEv("(()=>{ const R = WORLD.premises; R.step(8); return R.stats.queued; })()");
    if (q === 0 || typeof q !== 'number') { console.log('queue', q, el()); break; }
    if (i % 20 === 0) console.log('  queue', q, el());
  }
  const setup = await tryEv(`(()=>{
    const R = WORLD.premises, cam = WORLD.camera;
    let best = null; R.stats && 0;
    // stand over the densest cluster of houses: the centre of the built house groups
    const hs = []; WORLD.scene.traverse(o => { if (o.name === 'premises:houses') for (const g of o.children) if (!g.userData.batch) { const p = new THREE.Vector3(); g.getWorldPosition(p); hs.push(p); } });
    if (!hs.length) return 'no houses';
    let bi = 0, bn = -1; hs.forEach((p, i) => { const n = hs.filter(q => q.distanceTo(p) < 120).length; if (n > bn) { bn = n; bi = i; } });
    const c = hs[bi]; window.__TC = c;
    cam.position.set(c.x + 70, c.y + 45, c.z + 70); cam.lookAt(c.x, c.y, c.z); cam.updateMatrixWorld();
    return JSON.stringify({ houses: hs.length, near: bn, at: [c.x, c.y, c.z].map(v => Math.round(v)) });
  })()`);
  console.log('setup', setup, el());
  const shot = async (name, dial) => {
    const r = await tryEv(`(async () => {
      const R = WORLD.premises, H = R.hlod; Object.assign(H, ${JSON.stringify(dial)});
      for (let i = 0; i < 3; i++) { R.tick(0.016); await new Promise(r => setTimeout(r, 50)); }
      // the stack builds async; its ready signal clears the sig and the next tick rebakes
      for (let i = 0; i < 100 && H.tarr && H.bake && !(R.stats.tarrMerged > 0); i++) { await new Promise(r => setTimeout(r, 200)); R.tick(0.016); }
      const rr = WORLD.renderer; rr.info.autoReset = false; rr.info.reset();
      rr.render(WORLD.scene, WORLD.camera);
      const calls = rr.info.render.calls, tris = rr.info.render.triangles; rr.info.autoReset = true;
      const png = rr.domElement.toDataURL('image/png');   // the same task as the draw: the buffer is still this frame
      let hd = 0; WORLD.scene.traverse(o => { if (o.isMesh && o.visible) { let p = o, v = true; while (p) { if (!p.visible) { v = false; break; } p = p.parent; } if (v) { let q = o; while (q && q.name !== 'premises:houses') q = q.parent; if (q) hd++; } } });
      const S = R.stats;
      window.__png = png;
      return JSON.stringify({ calls, tris, houseMeshesVisible: hd, programs: rr.info.programs.length, bakeDraws: S.bakeDraws, bakeMats: S.bakeMats, tarrDraws: S.tarrDraws, tarrMerged: S.tarrMerged, tarrSlots: S.tarrSlots, tarrLayers: S.tarrLayers, tarrMB: S.tarrMB });
    })()`);
    const png = await tryEv('window.__png');
    if (typeof png === 'string' && png.startsWith('data:')) fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(png.split(',')[1], 'base64'));
    console.log(name.padEnd(8), r, el());
  };
  fs.mkdirSync(OUT, { recursive: true });
  await shot('whole', { bake: false, tarr: false });
  await shot('g566', { bake: true, tarr: false });
  await shot('tarr', { bake: true, tarr: true });
  await shot('tarr2', { bake: true, tarr: true });
  if (logs.length) console.log('console:\n' + [...new Set(logs)].slice(0, 40).join('\n'));
  await browser.close();
})().catch(e => { console.error('tarr_game:', e.message); process.exit(1); });
