#!/usr/bin/env node
// large_hangar_store_shot.js - DERELICT-HANGAR: THE LARGE HANGAR'S STORED AEROPLANES on the real page (dev.html?career=1,
// the dev career), headless (Chromium + SwiftShader). A career whose main hangar is the large hangar (shell 'works'),
// a shelf of saved builds (three Cubs, a Jodel, a Cessna) stored INSIDE it (HANGAR-STORAGE's slots, the packer deciding
// what stands), and an aeroplane on the stand: the Cub, then the DC-3. Per stand:
//   store_<plane>_page.jpg   the WHOLE page (page.screenshot: the garage's rail, sliders and panels round the room)
//   store_<plane>_hall.jpg   the room from the back wall, high (the page's renderer and scene, a camera of this rig's)
// and store.json: the page's own answers (GARAGE_ENV.residents(): the plan, what did not stand and why; the shed).
//
//   node tools/large_hangar_store_shot.js [--scene store|full] [--out reports/evidence/DERELICT-HANGAR/store] [--w 1600 --h 900]
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.join(__dirname, '..'), REPO = path.join(ROOT, '..');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(opt('out', path.join(ROOT, 'reports', 'evidence', 'DERELICT-HANGAR', 'store')));
const W = +opt('w', 1600), H = +opt('h', 900), EXPO = +opt('expo', 1.7);
const env = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'builds', f), 'utf8'));
// --scene full: as many small aeroplanes as the floor takes round the Jodel on the stand - three Cubs and three Jodels
// stored, the shed's own `slots` (HANGAR-STORAGE's per-shed hook) raised to 8 inside so the PACKER, not the shell's 4,
// says how many stand (the rest are reported 'no floor left')
const SCENE = opt('scene', 'store'), FULL = SCENE === 'full' || SCENE === 'roster', ROSTER = SCENE === 'roster';
const CUB = 'cub_2026-09-20_corrected.json', JOD = 'jodel_2026-09-20_corrected.json';
// --scene roster (the user 9 Nov: "I don't want all cubs and Jodels. Get in the roster"): the Jodel on the stand, the validated
// aeroplanes the user named stored round it, each at its own measured footprint (playerFootOfDef off its build)
const ROSTER_FILES = { 'Metal Cessna': 'cessna172_2026-09-20.json', 'Piper Cub': CUB, 'STOL Cub': 'candidates/stol_cub_showcase.json',
  'Twin busher floats': 'candidates/Twin_busher_floats_4b.json', 'Rufus': 'rufus_2026-10-18_certified.json', 'pusherLight': 'candidates/build_v8_pusher_2026-09-11.json',
  'B-ITES': 'candidates/B-ITES.json', 'PA-18 on floats': 'pa18_floats_2026-10-23.json', 'Chinook': 'chinook_2026-09-21_corrected.json' };
const envOf = (n, f) => { const j = env(f); return j.spec ? j : { what: 'flydiy-build', v: j.v || 10, name: n, spec: j }; };
const SHELF = ROSTER ? Object.fromEntries(Object.entries(ROSTER_FILES).map(([n, f]) => [n, envOf(n, f)]))
  : FULL
  ? { 'Jolene Cub': env(CUB), 'Spare Cub': env(CUB), 'Club Cub': env(CUB), 'Old Jodel': env(JOD), 'Red Jodel': env(JOD), 'Blue Jodel': env(JOD) }
  : { 'Jolene Cub': env(CUB), 'Spare Cub': env(CUB), 'Club Cub': env(CUB), 'Jodel D9': env(JOD), 'Metal Cessna': env('cessna172_2026-09-20_corrected.json') };
const SLOTS = ROSTER ? 10 : FULL ? 8 : null;
// the footprints the packer parks them by (as a save measures them: GATE HANGAR's envelopes)
const FOOT = { cub: { half: 5.4, fwd: 1.8, aft: 6.9, h: 2.1 }, jodel: { half: 4.4, fwd: 1.8, aft: 5.9 }, cessna: { half: 5.5, fwd: 1.6, aft: 6.6, h: 2.7 } };
// the roster's: measured off each build in node (buildGen -> playerFootOfDef), as the garage's save measures them
const footMeasured = n => { try { const sp = JSON.parse(JSON.stringify(SHELF[n].spec)); return CORE.playerFootOfDef(CORE.buildGen(CORE.genMigrateSpec(sp))); } catch (e) { return null; } };
const footOf = n => (ROSTER && footMeasured(n)) || (/Cub/.test(n) ? FOOT.cub : /Jodel/.test(n) ? FOOT.jodel : FOOT.cessna);
// THE CAREER DOCUMENT, made here (careerNew, as the page makes the dev career) and seeded before the page's first load: the
// main hangar the large hangar, the shelf the career's own airframes stored inside it in slot order (one boot, not two)
const CORE = require('./flight_core.js');
const DOC = (() => {
  const d = CORE.careerNew({ id: 'dev', seed: 'dev', name: 'the dev career', started: '2026-11-09' });
  d.sheds.HOME = Object.assign({}, d.sheds.HOME, { shell: 'works', dims: Object.assign({}, CORE.SHELLS.works.dims) });
  if (SLOTS) d.sheds.HOME.slots = { inside: SLOTS };
  d.career.airframes = d.career.airframes || {};
  Object.keys(SHELF).forEach((n, i) => {
    d.career.airframes[n] = { paid: 0, how: 'scratch', at: 0 };
    d.fleet[n] = { hangar: 'HOME', aero: 'HOME', kind: 'inside', slot: i, foot: footOf(n) };
  });
  return CORE.careerNormalise(d);
})();
for (const n of Object.keys(SHELF)) { SHELF[n].name = n; if (SHELF[n].spec && SHELF[n].spec.meta) SHELF[n].spec.meta.name = n; }
const STAND = { cub: 'flyDiy/builds/' + CUB, dc3: 'flyDiy/builds/candidates/dc3_2026-10.json', jodel: 'flyDiy/builds/' + JOD };
const want = opt('planes', FULL ? 'jodel' : 'cub,dc3').split(',');
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
// --gallery (the user 9 Nov: "render it on my widescreen ... 5000 something times 1440 ... compose it so that it really
// works, mainly for the 16:9 format ... a few light conditions ... move the camera around, move the FOV, change the time of
// the day, change the focus, do some top downs, do some bottom up, maybe do one from across the window"): one loaded
// scene, many stills - the hero (16:9, 2560 x 1440) in every mood, the ultrawide (5120 x 1440) framed from inside the hall
// 2 m off every wall, a top-down under the trusses, a bottom-up under a wing, one in through a flank window, a telephoto
// from the apron, and a focus pull (depth of field by accumulation: the eye jittered over a lens disc, every sample aimed at
// the focal point, averaged in python after) - written to <OUT>/gallery/
const GALLERY = argv.includes('--gallery');
async function gallery(page, R, log) {
  const GD = path.join(OUT, 'gallery'); fs.mkdirSync(GD, { recursive: true });
  const shot = (o) => page.evaluate(o => {
    const D = window.GARAGE_ENV._debug(), Rr = D.renderer, S = D.scene, h = D.hangar;
    const g = h.group.position, P = p => new THREE.Vector3(p[0] + g.x, p[1] + g.y, p[2] + g.z);
    const asp = o.W / o.H, vfov = o.hfov ? 2 * Math.atan(Math.tan(o.hfov * Math.PI / 360) / asp) * 180 / Math.PI : o.fov;
    const cam = new THREE.PerspectiveCamera(vfov, asp, 0.05, 3000);
    cam.position.copy(P(o.eye)); cam.lookAt(P(o.at)); cam.updateMatrixWorld();
    const ex0 = Rr.toneMappingExposure, sz = Rr.getSize(new THREE.Vector2()), pr = Rr.getPixelRatio();
    Rr.setPixelRatio(1); Rr.toneMappingExposure = ex0 * o.expo; Rr.setSize(o.W, o.H, false); Rr.render(S, cam);
    const u = Rr.domElement.toDataURL(o.png ? 'image/png' : 'image/jpeg', 0.92);
    Rr.toneMappingExposure = ex0; Rr.setSize(sz.x, sz.y, false); Rr.setPixelRatio(pr);
    return u;
  }, o);
  const save = (u, f) => { fs.writeFileSync(path.join(GD, f), Buffer.from(u.split(',')[1], 'base64')); return f; };
  const info = await page.evaluate(() => { const h = window.GARAGE_ENV._debug().hangar; return { dims: h.dims, moods: h.moods || [], door: h.door }; });
  const HW = info.dims.HW, HD = info.dims.HD, EAVE = info.dims.EAVE;
  const plan = (R && R.plan) || [];
  const res = plan[0] || { x: 8, z: -8 };
  // the views, in the room's frame (the door at -x, x the depth, z across: the gallery side +z)
  const V = {
    hero:   { W: 2560, H: 1440, eye: [HD - 5, 7.6, -HW + 5], at: [-5, 0.6, 3], fov: 52 },
    wide:   { W: 5120, H: 1440, eye: [HD - 3, 6.2, 0], at: [-HD, 2.4, 0], hfov: 96 },
    top:    { W: 2560, H: 1440, eye: [2, EAVE - 1.7, 0], at: [2.01, 0, 0], fov: 92 },
    under:  { W: 2560, H: 1440, eye: [res.x + 1.2, 0.35, res.z + 2.4], at: [res.x - 0.5, 3.2, res.z - 1.5], fov: 70 },
    window: { W: 2560, H: 1440, eye: [3, 2.2, -HW - 4], at: [1, 1.4, 6], fov: 46 },
    tele:   { W: 2560, H: 1440, eye: [-HD - 26, 1.7, 1.5], at: [0, 2.2, 0], fov: 22 },
  };
  const out = [];
  const setMood = i => page.evaluate(i => { window.GARAGE_ENV.setMood(i); return (window.GARAGE_ENV._debug().hangar.moods || [])[i]; }, i);
  const moods = info.moods.length ? info.moods.map((n, i) => [i, n]) : [[0, 'day']];
  for (const [i, name] of moods) {
    await setMood(i); await sleep(15000); log('  gallery mood ' + name + ': probe ' + await bakeProbe(page));
    const f = save(await shot(Object.assign({ expo: EXPO }, V.hero)), 'hero_' + name + '.jpg'); out.push(f); log('    ' + f);
    if (i === 0 || /golden|dusk|even/i.test(name)) { const w = save(await shot(Object.assign({ expo: EXPO }, V.wide)), 'wide_' + name + '.jpg'); out.push(w); log('    ' + w); }
  }
  await setMood(0); await sleep(15000); await bakeProbe(page);
  for (const k of ['top', 'under', 'window', 'tele']) { const f = save(await shot(Object.assign({ expo: EXPO }, V[k])), k + '.jpg'); out.push(f); log('    ' + f); }
  // THE FOCUS PULL: the eye over a lens disc (aperture 0.16 m, 16 samples on a golden-angle spiral), every sample aimed at
  // the Jodel on the stand (the focal plane through it): the planes behind and the trusses fall soft
  const eye = [-7.5, 1.5, -6.5], at = [0, 1.3, 0], ap = 0.16, N = 16;
  const fwd = [at[0] - eye[0], at[1] - eye[1], at[2] - eye[2]], L = Math.hypot(...fwd), f0 = fwd.map(v => v / L);
  const rt = [f0[2], 0, -f0[0]], rl = Math.hypot(...rt), r0 = rt.map(v => v / rl), u0 = [f0[1] * r0[2] - f0[2] * r0[1], f0[2] * r0[0] - f0[0] * r0[2], f0[0] * r0[1] - f0[1] * r0[0]];
  const dofs = [];
  for (let n = 0; n < N; n++) {
    const rr = ap * Math.sqrt((n + 0.5) / N), th = n * 2.39996;
    const e = [0, 1, 2].map(k => eye[k] + r0[k] * rr * Math.cos(th) + u0[k] * rr * Math.sin(th));
    dofs.push(save(await shot({ W: 2560, H: 1440, eye: e, at, fov: 34, expo: EXPO, png: true }), 'dof_' + String(n).padStart(2, '0') + '.png'));
  }
  log('    dof: ' + N + ' samples');
  return { views: V, shots: out, dof: { eye, at, aperture: ap, samples: dofs } };
}
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = http.createServer((q, r) => { const p = path.join(REPO, decodeURIComponent(q.url.split('?')[0]));
    if (!p.startsWith(REPO) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await ctx.addInitScript(({ shelf, doc }) => {
    window.FLYDIY_CLOCKSLICE = false;
    try { if (!sessionStorage.getItem('lhSeeded')) { for (const n of Object.keys(shelf)) localStorage.setItem('flydiy.build.' + n, JSON.stringify(shelf[n]));
      localStorage.setItem('flydiy.career.dev', JSON.stringify(doc)); sessionStorage.setItem('lhSeeded', '1'); } } catch (e) {}
  }, { shelf: SHELF, doc: DOC });
  const t0 = Date.now(), log = s => console.log(((Date.now() - t0) / 1000).toFixed(0).padStart(4) + ' s  ' + s);
  const URL0 = `http://127.0.0.1:${srv.address().port}/flyDiy/dev.html?career=1&audio=0&soft=0`;
  const boot = async () => {
    await page.waitForFunction(() => window.GARAGE_ENV && window.GARAGE_SPEC && window.FLYDIY_PLAYER && window.GARAGE_ENV._debug &&
      window.BOOT && window.BOOT.state === 'gone', null, { timeout: 2400000, polling: 5000 });
    await sleep(3000);
    await page.evaluate(() => { const b = [...document.querySelectorAll('#dfBirth button')].find(e => /keep the current/i.test(e.textContent)); if (b) b.click(); });
  };
  await page.goto(URL0, { timeout: 600000 }); await boot();
  const set = await page.evaluate(() => { const d = window.FLYDIY_PLAYER.doc();
    return { shell: window.GARAGE_ENV.shell(), slots: d.sheds.HOME.slots || null, fleet: Object.keys(d.fleet).map(n => n + ':' + d.fleet[n].kind + (d.fleet[n].hangar ? '@' + d.fleet[n].hangar : '')) }; });
  log('booted ' + JSON.stringify(set));
  const report = { set, stands: [], errors: errs };
  for (const k of want) {
    await page.evaluate(async url => { const r = await fetch('/' + url); const j = await r.json(); window.GARAGE_SPEC.set(j.spec || j); }, STAND[k]);
    log(k + ' on the stand');
    await sleep(10000);
    await page.evaluate(() => window.GARAGE_ENV.residentsSync && window.GARAGE_ENV.residentsSync());
    // every resident that stands decoded from its bake (the fleet's idle path bakes a build never baked)
    const t1 = Date.now();
    let R = null;
    while (Date.now() - t1 < 1800000) {
      R = await page.evaluate(() => window.GARAGE_ENV.residents());
      if (R && R.plan.length && R.plan.every(p => p.filled)) break;
      await sleep(3000);
    }
    log('  residents ' + JSON.stringify(R && { how: R.how, plan: R.plan.map(p => p.name + (p.filled ? '' : '(unbaked)')), unplaced: R.unplaced }));
    // THE SAME LIGHT FOR EVERY STILL (the user 9 Nov: "you compare widely different outside lighting conditions"): the
    // garage's mood pinned to its daylight row (the day clock's hour follows it), then the door's view and the probe re-shot
    { const m = await page.evaluate(() => { const E = window.GARAGE_ENV, ms = (E._debug().hangar && E._debug().hangar.moods) || [];
        const i = Math.max(0, ms.findIndex(n => /^(afternoon|day|noon|midday)$/i.test(String(n)))); E.setMood(i); return ms[i] || i; });
      log('  mood: ' + m); await sleep(20000); }
    log('  probe: ' + await bakeProbe(page));
    // the room's probe forced (on a software renderer the boot's deferred bake waits for compileAsync, which never lands:
    // no environment, and every polished metal reads black - the page's own door, setEnvSource, bakes it at once)
    await page.evaluate(() => window.GARAGE_ENV.setEnvSource && window.GARAGE_ENV.setEnvSource('room'));
    await page.waitForFunction(() => { const D = window.GARAGE_ENV._debug(); return !!(D.scene && D.scene.environment); }, null, { timeout: 600000, polling: 2000 }).catch(() => log('  (no environment after 600 s)'));
    await sleep(4000);
    const fp = path.join(OUT, `${SCENE}_${k}_page.jpg`);
    await page.screenshot({ path: fp, type: 'jpeg', quality: 86, timeout: 900000 });
    log('  ' + path.basename(fp));
    // the hand's own zoom: the wheel over the room (the orbit's distance), then the whole page again - the room wide,
    // the stored aeroplanes round the stand, the garage's panels and sliders where they always are
    const cv = await page.evaluate(() => { const c = window.GARAGE_ENV._debug().renderer.domElement.getBoundingClientRect(); return { x: c.left + c.width / 2, y: c.top + c.height * 0.55 }; });
    await page.mouse.move(cv.x, cv.y);
    for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 400); await sleep(400); }
    await sleep(5000);
    const fw = path.join(OUT, `${SCENE}_${k}_page_wide.jpg`);
    await page.screenshot({ path: fw, type: 'jpeg', quality: 86, timeout: 900000 });
    log('  ' + path.basename(fw));
    const url = await page.evaluate(({ W, H, EXPO, k }) => {
      const D = window.GARAGE_ENV._debug(), Rr = D.renderer, S = D.scene, h = D.hangar;
      const g = h.group.position, P = p => new THREE.Vector3(p[0] + g.x, p[1] + g.y, p[2] + g.z);
      const cam = new THREE.PerspectiveCamera(60, W / H, 0.1, 2000);
      cam.position.copy(P([19, k === 'dc3' ? 10.5 : 8.2, -4])); cam.lookAt(P([-8, 0.6, -2])); cam.updateMatrixWorld();
      const ex0 = Rr.toneMappingExposure, sz = Rr.getSize(new THREE.Vector2()); Rr.toneMappingExposure = ex0 * EXPO;
      Rr.setSize(W, H, false); Rr.render(S, cam); const u = Rr.domElement.toDataURL('image/jpeg', 0.9);
      Rr.toneMappingExposure = ex0; Rr.setSize(sz.x, sz.y, false);
      return u;
    }, { W, H, EXPO, k });
    const fh = path.join(OUT, `${SCENE}_${k}_hall.jpg`);
    fs.writeFileSync(fh, Buffer.from(url.split(',')[1], 'base64'));
    log('  ' + path.basename(fh));
    const info = await page.evaluate(() => { const h = window.GARAGE_ENV._debug().hangar; const mats = {};
      h.group.traverse(o => { if (/^room:derelict:/.test(o.name || '') && o.material) { const m = o.material, im = m.map && m.map.image;
        mats[o.name.slice(14)] = { mat: m.name || '', color: m.color ? m.color.getHexString() : null, map: im ? (im.currentSrc || im.src || (im.width + 'x' + im.height)) : null }; } });
      return { shell: window.GARAGE_ENV.shell(), door: h.door, derelict: h.derelict, group: h.group.position.toArray().map(v => +v.toFixed(2)), mats }; });
    log('  room ' + JSON.stringify({ derelict: info.derelict, steel: info.mats.steel, steelNew: info.mats.steelNew, sheetNew: info.mats.sheetNew }));
    report.stands.push({ stand: k, residents: R, room: info, page: path.basename(fp), hall: path.basename(fh) });
    if (GALLERY) report.gallery = await gallery(page, R, log);
  }
  fs.writeFileSync(path.join(OUT, SCENE + '.json'), JSON.stringify(report, null, 1));
  if (errs.length) console.log('page errors:\n  ' + errs.slice(0, 10).join('\n  '));
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
