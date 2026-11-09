#!/usr/bin/env node
// large_hangar_shot.js - DERELICT-HANGAR: the LARGE HANGAR's room (hangar.js shell 'works': the restored WWII hangar,
// DERELICT_GEN stage 3) in the game's own page, with an aeroplane on the stand - headless (Chromium + SwiftShader), the
// page of THIS tree (dev.html), served by a small node server. The sandbox's room is set to the large hangar
// (GARAGE_ENV.setShell('works')), a build loaded (GARAGE_SPEC.set: the Cub, the DC-3), and the room drawn from a few
// eyes with the page's own renderer and scene (GARAGE_ENV._debug) and a camera of this rig's.
//
//   node tools/large_hangar_shot.js [--out reports/evidence/DERELICT-HANGAR/room] [--w 1600 --h 900] [--planes cub,dc3]
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.join(__dirname, '..'), REPO = path.join(ROOT, '..');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(opt('out', path.join(ROOT, 'reports', 'evidence', 'DERELICT-HANGAR', 'room')));
const W = +opt('w', 1600), H = +opt('h', 900), PAGE = opt('page', 'dev.html?soft=0'), EXPO = +opt('expo', 1.7);
const PLANES = { cub: 'flyDiy/builds/cub_2026-09-20_corrected.json', dc3: 'flyDiy/builds/candidates/dc3_2026-10.json' };
const want = opt('planes', 'cub,dc3').split(',');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.css': 'text/css', '.woff2': 'font/woff2', '.ktx2': 'image/ktx2', '.wasm': 'application/wasm' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// THE ROOM'S PROBE, BAKED BY THE RIG (a software renderer only): under SwiftShader three's compileAsync never resolves, so
// the page's boot never releases its probe bake (envDeferred) - no environment, every polished metal black. The rig shoots
// the page's own probe through its debug door, as bakeHangarEnv does on a graphics card: a cube camera at 3.2 m over the
// room's centre, the aeroplanes (everything outside the room's group) out of it, the floor at the large hangar's bounce
// (0.5), PMREM'd into the room scene's environment.
const bakeProbe = page => page.evaluate(() => {
  const D = window.GARAGE_ENV._debug(), R = D.renderer, S = D.scene, h = D.hangar;
  if (!h || !THREE.WebGLCubeRenderTarget || !THREE.PMREMGenerator) return 'no probe';
  const inRoom = new Set(); h.group.traverse(o => inRoom.add(o));
  const hid = []; S.traverse(o => { if ((o.isMesh || o.isSkinnedMesh || o.isInstancedMesh) && o.visible && !inRoom.has(o)) { o.visible = false; hid.push(o); } });
  const gm = (h.groundMats || []).filter(m => m && m.color), g0 = gm.map(m => m.color.clone()); gm.forEach(m => m.color.multiplyScalar(0.5));
  const rt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const cam = new THREE.CubeCamera(0.5, 300, rt); const gp = h.group.position; cam.position.set(gp.x, gp.y + 3.2, gp.z); S.add(cam);
  const env0 = S.environment; S.environment = null;
  try { cam.update(R, S); } finally { S.remove(cam); hid.forEach(o => { o.visible = true; }); gm.forEach((m, i) => m.color.copy(g0[i])); }
  const pm = new THREE.PMREMGenerator(R); const out = pm.fromCubemap(rt.texture); S.environment = out.texture; pm.dispose(); rt.dispose();
  return env0 ? 'replaced' : 'baked';
});
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = http.createServer((q, r) => { const p = path.join(REPO, decodeURIComponent(q.url.split('?')[0]));
    if (!p.startsWith(REPO) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => { window.FLYDIY_CLOCKSLICE = false; });   // the room's probe baked at once (not sliced over frames: headless frames are slow)
  page.on('console', m => { const t = m.text(); if (/large hangar|hangar:|DERELICT/i.test(t)) console.log('  page:', t.slice(0, 200)); });
  const t0 = Date.now(), log = s => console.log(((Date.now() - t0) / 1000).toFixed(0).padStart(4) + ' s  ' + s);
  await page.goto(`http://127.0.0.1:${srv.address().port}/flyDiy/${PAGE}`, { timeout: 600000 });
  await page.waitForFunction(() => window.GARAGE_ENV && window.GARAGE_SPEC && window.GARAGE_ENV._debug, null, { timeout: 900000, polling: 2000 });
  log('booted');
  await sleep(4000);
  const r0 = await page.evaluate(() => window.GARAGE_ENV.setShell('works'));
  log('shell ' + r0);
  await sleep(6000);
  const shots = [];
  for (const k of want) {
    const ok = await page.evaluate(async url => { const r = await fetch('/' + url); const j = await r.json(); window.GARAGE_SPEC.set(j.spec || j); return true; }, PLANES[k]);
    log(k + ' loaded ' + ok);
    await sleep(12000);
    // THE SAME LIGHT FOR EVERY STILL (the user 9 Nov: "you compare widely different outside lighting conditions"): the
    // garage's mood pinned to its daylight row (the day clock's hour follows it), then the door's view and the probe re-shot
    { const m = await page.evaluate(() => { const E = window.GARAGE_ENV, ms = (E._debug().hangar && E._debug().hangar.moods) || [];
        const i = Math.max(0, ms.findIndex(n => /^(day|sun|noon|midday)/i.test(String(n)))); E.setMood(i); return ms[i] || i; });
      log('  mood: ' + m); await sleep(20000); }
    log('  probe: ' + await bakeProbe(page));
    // the room's probe forced (on a software renderer the boot's deferred bake waits for compileAsync, which never lands:
    // no environment, and every polished metal reads black - the page's own door, setEnvSource, bakes it at once)
    await page.evaluate(() => window.GARAGE_ENV.setEnvSource && window.GARAGE_ENV.setEnvSource('room'));
    // the room's own light: its probe (the environment) baked before a picture is taken
    await page.waitForFunction(() => { const D = window.GARAGE_ENV._debug(); return !!(D.scene && D.scene.environment); }, null, { timeout: 120000, polling: 1000 }).catch(() => log('  (no environment after 120 s)'));
    await sleep(2000);
    // the eyes, in the ROOM's frame (the door at -x, x the depth, z across: the gallery at +z), offset by the room group
    const views = [
      ['door', [-27, 2.0, -6], [4, 3.2, 1]],        // from the apron, in through the door
      ['hall', [18.6, 7.4, -3.5], [-10, 1.4, -1.5]],  // from the back wall, high: the hall, the plane, the door
      ['gallery', [3, 1.8, -17.6], [3, 4.4, 14]],     // across the hall to the gallery: the white wall, the lit offices above
      ['roof', [6, 1.6, -4], [0, 9.5, 6]],           // the trusses over it
    ];
    for (const [name, eye, at] of views) {
      const url = await page.evaluate(({ eye, at, W, H, nm, EXPO }) => { const name = nm;
        const D = window.GARAGE_ENV._debug(), R = D.renderer, S = D.scene, h = D.hangar;
        const g = h.group.position, P = p => new THREE.Vector3(p[0] + g.x, p[1] + g.y, p[2] + g.z);
        const cam = new THREE.PerspectiveCamera(name === 'roof' ? 72 : 58, W / H, 0.1, 2000);
        cam.position.copy(P(eye)); cam.lookAt(P(at)); cam.updateMatrixWorld();
        const ex0 = R.toneMappingExposure; R.toneMappingExposure = ex0 * EXPO;   // (the headless path skips the page's own exposure and grade: lifted for legibility)
        R.setSize(W, H, false); R.render(S, cam); R.toneMappingExposure = ex0;
        return R.domElement.toDataURL('image/jpeg', 0.9);
      }, { eye, at, W, H, nm: name, EXPO });
      const f = path.join(OUT, `room_${k}_${name}.jpg`);
      fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
      shots.push(f); log('  ' + path.basename(f));
    }
    const info = await page.evaluate(() => { const h = window.GARAGE_ENV._debug().hangar; return { shell: h.shell, door: h.door, derelict: h.derelict, dims: h.dims, group: h.group.position.toArray(), fit: h.fitReport ? { placed: h.fitReport.placed && h.fitReport.placed.length, unplaced: (h.fitReport.unplaced || []).map(u => u.key + ':' + u.reason) } : null }; });
    console.log('  room:', JSON.stringify(info));
  }
  fs.writeFileSync(path.join(OUT, 'room.json'), JSON.stringify({ shots: shots.map(s => path.basename(s)), errors: errs }, null, 1));
  if (errs.length) console.log('page errors:\n  ' + errs.slice(0, 10).join('\n  '));
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
