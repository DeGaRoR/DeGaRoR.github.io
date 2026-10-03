#!/usr/bin/env node
// lake_holes_shot.js - THE LAKES' EDGES IN A REAL BROWSER (LAKE-HOLES G1335-G1339). Headless Chromium (Playwright;
// SwiftShader by default, --gl gpu for a GPU box) boots the page on Jolene, rolls out, then shoots each VIEW from a
// declared eye: the camera held at the view's pose before and after every frame (the world's streamers read
// camera.position before the viewer places its own eye), the aeroplane placed above the eye and hidden, the fine ring /
// far terrain given a big budget and the frames run until both have caught up; then the RIG draws WORLD.scene with the
// page's renderer (two frames) and the page is screenshot - plus the draws and triangles of that draw (renderer.info)
// and the ring / fine / far stats. ON SWIFTSHADER (this cloud box, 2026-10-03) the page's own render stays held for good
// after the roll-out (its first-light step never resolves) and the rig's draw comes out black near the eye (the frame's
// own shadow / probe passes never ran) - its numbers are read, its pictures are not: use --gl gpu on the box. The
// construction's stills are tools/lake_holes_still.js's.
//
//   node tools/_serve.js 8125 &   node tools/lake_holes_shot.js --url http://localhost:8125/flyDiy/dev.html?world=jolene \
//        --out <dir> --tag after [--views far,near,air,farTier] [--w 960 --h 540] [--q 0.82] [--gl gpu] [--log]
//
// The views are named below (a lake's far shore from 1.8 m over its water, a near shore, from the air); --tag goes in
// each file name (before / after: the same rig against two servers, a worktree of the base and this branch).
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL = opt('url', 'http://localhost:8125/flyDiy/dev.html?world=jolene');
const OUT = opt('out', 'reports/evidence/LAKE-HOLES'), TAG = opt('tag', 'shot');
const VW = +opt('w', 960), VH = +opt('h', 540), Q = +opt('q', 0.82);
// [name, eye x, eye y over the water (or the ground with `agl`), eye z, look-at x, y, z (y: metres over the lake's level)]
const VIEWS = {
  // the lake at (-289, -526), level 25.81, its banks 3-7 m over the water (all its field over its level in the DEM): from
  // its west end, 1.8 m over the water, east across 260 m to the far shore
  far:  { eye: [-410, 1.8, -550], at: [-150, 2.0, -480], lake: 25.81 },
  // the same lake's north shore, 40 m off it
  near: { eye: [-300, 1.8, -485], at: [-300, 1.0, -435], lake: 25.81 },
  // from the air: 220 m over the ground west of it, looking down on it
  air:  { eye: [-700, 220, -200], at: [-280, 0, -540], lake: 25.81 },
  // the big lake past the inner ring (4841, -3956: level 24.89, banks to 54 m) - the far terrain's tiers on a far shore
  farTier: { eye: [4400, 2.0, -4150], at: [6100, 10, -4000], lake: 24.89 },
};
const names = opt('views', Object.keys(VIEWS).join(',')).split(',');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright')); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
// a fresh profile's aeroplane chooser comes up over the flight (the scene is not drawn under it): keep the current build
const KEEP = "(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click()); return 1;})()";
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const exe = opt('chrome', ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p)));
  const args = (opt('gl', 'swiftshader') === 'gpu' ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']).concat(['--js-flags=--max-old-space-size=8192']);
  const browser = await pw.chromium.launch({ executablePath: exe, headless: true, args });
  const page = await browser.newPage({ viewport: { width: VW, height: VH } });
  const t0 = Date.now(), el = () => Math.round((Date.now() - t0) / 1000) + ' s';
  // every frame: counted; the camera held at the view's pose before the frame (the world's streamers - the fine ring,
  // the far cut - read camera.position before the viewer places its own eye) and after it; and, when asked, the world
  // scene drawn by this rig with the page's renderer (a software GL's roll-out can leave the page's own render held
  // for good - its first-light step never resolves - while every update still runs), the renderer's counters over it
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.__frames = 0; window.__renderN = 0;
    const hold = () => { const P = window.__pose; if (!P || !window.WORLD || !WORLD.camera) return null; const c = WORLD.camera;
      c.position.copy(P.p); c.quaternion.copy(P.q); c.updateMatrixWorld(true);
      try { const m = FLIGHT_PROBE.model(); const g = m && (m.group || m.root || m); if (g && 'visible' in g) g.visible = false; } catch (e) {}
      return c; };
    window.requestAnimationFrame = cb => raf(t => {
      hold();
      cb(t); window.__frames++;
      const c = hold();
      if (c && window.__renderN > 0) { window.__renderN--;
        try { const R = FLIGHT_PROBE.renderer();
              // (NO SHADOWS on a software GL: the page's shadow rig is aimed in the frame's own render path, which a held
              // roll-out never reaches - a stale map put everything near the eye in black
              // -> boot with ?gfx=potato (no shadows from the start); a rig-side switch relinked into a flat colour
              R.info.autoReset = false; R.info.reset(); R.setRenderTarget(null); R.render(WORLD.scene, c);
              window.__info = { calls: R.info.render.calls, triangles: R.info.render.triangles, frame: window.__frames }; R.info.autoReset = true; }
        catch (e) { window.__rerr = e.message; } }
    });
  });
  const logs = [];
  const LOG = argv.includes('--log');
  page.on('pageerror', e => { logs.push('pageerror: ' + e.message); if (LOG) console.log('  pageerror: ' + e.message.slice(0, 300)); });
  page.on('console', m => { if (m.type() === 'error') logs.push('error: ' + m.text().slice(0, 300)); if (LOG) console.log('  page ' + m.type() + ': ' + m.text().slice(0, 200)); });
  const tryEv = async (expr, arg) => { try { return await page.evaluate(expr, arg); } catch (e) { return 'ERR ' + e.message.split('\n')[0]; } };
  await page.goto(URL, { waitUntil: 'load', timeout: 180000 });
  for (let i = 0; i < 300; i++) {
    await sleep(2000);
    if (await tryEv("!!document.getElementById('bGo') && !document.getElementById('bGo').disabled")) break;
    await tryEv("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click()); return 1;})()");
  }
  console.log('garage up', el());
  await tryEv("(()=>{const b=document.getElementById('bGo'); if(b) b.click(); return !!b;})()");
  let st = '';
  for (let i = 0; i < 600; i++) {
    await sleep(3000);
    st = await tryEv("(()=>{ const W = window.WORLD; const b = window.BOOT; return (W && W.ground && W.ground.farLod && W.ground.farLod() && typeof FLIGHT_PROBE !== 'undefined' && FLIGHT_PROBE.sim() ? 'world' : 'wait') + '/' + (b ? b.state : 'none'); })()");
    if (i % 10 === 0) console.log('  roll-out', el(), st);
    if (/^world\/(gone|none)/.test(st)) break;
    // (never CONTINUE ANYWAY: a skipped roll-out leaves the world half built - the loop dead on a software GL)
    await tryEv("(()=>{const b=document.getElementById('bGo'); if(b && !b.disabled && b.offsetParent) b.click(); return 1;})()");
    await tryEv(KEEP);
  }
  for (let i = 0; i < 5; i++) { await tryEv(KEEP); await sleep(2000); }
  // the ground's texture arrays (the splat's pair, the pavement's shared pair: KTX2, transcoded in workers) - the ground
  // draws black without them (ktx2_chrome.js's test)
  const READY = `(() => { try { const W = window.WORLD; if (!W || !W.ground || !W.ground.splat) return 'no world';
    const sp = W.ground.splat(); const a = sp && sp.arrays ? sp.arrays() : null;
    const PV = window.PAVEMENT || (typeof PAVEMENT !== 'undefined' ? PAVEMENT : null), pv = PV && PV.sharedLib ? PV.sharedLib(THREE, []) : null;
    return (a && a[0] && a[0].image && a[0].image.depth > 1 && pv && pv.ready) ? 'ready' : 'waiting'; } catch (e) { return 'err ' + e.message; } })()`;
  let rd = '';
  for (let i = 0; i < 200; i++) { rd = await tryEv(READY); if (rd === 'ready') break; if (i % 10 === 0) console.log('  arrays', el(), rd); await sleep(3000); }
  console.log('arrays', rd, el());
  console.log('rolled out', st, el(), 'frames', await tryEv('window.__frames'));
  // the stage: paused, the HUD hidden, the camera's pose ours, the streamers' budgets big
  await tryEv(`(() => {
    const b = document.getElementById('bPause'); if (b && /pause/i.test(b.textContent)) b.click();
    const css = document.createElement('style'); css.textContent = '#ui, #devPanel, #hud, .hud, #toast, #boot { display: none !important; }'; document.head.appendChild(css);
    for (const c of document.querySelectorAll('body > *')) if (c !== FLIGHT_PROBE.renderer().domElement && !c.contains(FLIGHT_PROBE.renderer().domElement) && c.tagName !== 'SCRIPT' && c.tagName !== 'STYLE') c.style.visibility = 'hidden';
    const G = WORLD.ground; const F = G.fine && G.fine(); if (F) F.budget = 400; const L = G.farLod && G.farLod(); if (L) { L.budget = 64; L.every = 1; }
    return 'staged';
  })()`).then(r => console.log(r));
  const results = [];
  for (const name of names) {
    const V = VIEWS[name]; if (!V) { console.log('no view ' + name); continue; }
    const pose = await tryEv(([V]) => {
      const W = FLIGHT_PROBE.world(), e = V.eye, a = V.at;
      const ey = V.lake != null && e[1] < 20 ? V.lake + e[1] : W.terrainH(e[0], e[2]) + e[1];   // (a low eye: over the lake's level; a high one: over the ground)
      const ay = V.lake != null ? V.lake + a[1] : W.terrainH(a[0], a[2]) + a[1];
      const p = new THREE.Vector3(e[0], ey, e[2]), t = new THREE.Vector3(a[0], ay, a[2]);
      const m = new THREE.Matrix4().lookAt(p, t, new THREE.Vector3(0, 1, 0)), q = new THREE.Quaternion().setFromRotationMatrix(m);
      window.__pose = { p, q };
      const cam = WORLD.camera; cam.position.copy(p); cam.quaternion.copy(q); cam.updateMatrixWorld(true);
      try { FLIGHT_PROBE.place({ at: [e[0], ey + 400, e[2]], zeroV: true }); } catch (err) {}
      const L = WORLD.ground.farLod && WORLD.ground.farLod(); if (L) L.update(true);
      return { eye: [e[0], +ey.toFixed(2), e[2]], at: [a[0], +ay.toFixed(2), a[2]], ground: +W.terrainH(e[0], e[2]).toFixed(2), water: W.waterH(e[0], e[2]) };
    }, [V]);
    console.log(name, JSON.stringify(pose));
    // run frames until the fine ring and the far cut have caught up (and a few more for the shadows / probes)
    let f0 = await tryEv('window.__frames'), settled = 0;
    for (let i = 0; i < 120; i++) {
      await sleep(1500);
      const s = await tryEv(`(() => { const G = WORLD.ground, F = G.fine && G.fine(), L = G.farLod && G.farLod();
        const stale = L ? [...L.quads.values()].filter(Q => Q.want && Q.sig !== Q.wantSig).length : 0;
        return { fr: window.__frames, fine: F ? F.tiles.size : 0, stale }; })()`);
      if (typeof s === "object" && s.stale === 0 && s.fr - f0 >= 12) { if (++settled >= 3) break; } else settled = 0;
      if (i % 10 === 0) console.log('   ', el(), JSON.stringify(s));
    }
    // the still: the world drawn by the rig (two frames: the second with the first's shadow map and uploads settled),
    // then the page's composited canvas
    await tryEv('window.__info = null; window.__rerr = null; window.__renderN = 2');
    for (let i = 0; i < 400; i++) { await sleep(1500); const n = await tryEv('window.__renderN'); if (n === 0) break; }
    const rerr = await tryEv('window.__rerr'); if (rerr) console.log('  render: ' + rerr);
    const file = path.join(OUT, TAG + '_' + name + '.jpg');
    try { await page.screenshot({ path: file, type: 'jpeg', quality: Math.round(Q * 100), timeout: 600000 }); }
    catch (e) { console.log('  no shot: ' + e.message.split('\n')[0]); continue; }
    const stats = await tryEv(`(() => { const G = WORLD.ground, F = G.fine && G.fine(), L = G.farLod && G.farLod(), R = G.ringLod && G.ringLod();
      return { render: window.__info, far: L ? { tris: L.stats.tris, nodes: L.stats.nodes, quads: L.quads.size, draws: [...L.quads.values()].filter(Q => Q.m.visible && Q.tris).length } : null,
               ring: R ? { draws: R.stats.draws, tris: R.stats.tris } : null,
               fine: F ? { tiles: F.tiles.size, tris: F.tiles.size * 2 * Math.pow(F.T / F.step, 2) } : null }; })()`);
    console.log('  wrote ' + file + ' (' + (fs.statSync(file).size / 1024).toFixed(0) + ' KB) ' + JSON.stringify(stats));
    results.push({ name, pose, stats, file });
  }
  fs.writeFileSync(path.join(OUT, TAG + '_stats.json'), JSON.stringify({ url: URL, w: VW, h: VH, results, logs: logs.slice(0, 20) }, null, 1));
  console.log('page errors: ' + logs.length + (logs.length ? '  ' + logs.slice(0, 3).join(' | ') : ''));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
