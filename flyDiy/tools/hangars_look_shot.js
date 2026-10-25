#!/usr/bin/env node
// hangars_look_shot.js - G3530s HANGARS-LOOK (playtest 24 Oct, items 35-38): THE STILLS AND THE SHADOW PROBE, FOR THE GPU BOX
// (A0's slot; boxlock.sh take gpu HANGARS-LOOK). The built page of THIS tree, served by a small node server (no python).
//
// What it shoots (out: reports/evidence/HANGARS-LOOK/<tag>/, jpg + shots.json):
//   cabin   a document holding the story's cabin shed at w1 (storyCabinShed: the field shell 20 x 22 m, every kit but the
//           office, the omit list, the work lamp) as `here`, plus HOME.2 (a club next door at HOME):
//           - the room as it opens (cabin_room.jpg) and the SHADOW PROBE (shots.json `probe`): every mesh of the covered car
//             and the work-in-progress fuselage (castShadow, visible, instanced, material side / alpha), every light that
//             casts (type, intensity, visible, map, its camera's box) and whether each piece's box is inside each caster's
//             frustum, and SHED_SHADOW's own numbers - the room before the roll-out, then mid roll-out (item 36);
//           - the roll-out every 0.5 s (cabin_rollout_##.jpg), then the world: each held shed (w1, HOME.2) and HOME's own,
//             from 30 m in front / 8 m up (<id>_front.jpg) and from a corner at eye height 18 m out (<id>_low.jpg: the
//             foot of the walls, the bottom gradient and the ground blend - item 37), and the scenery's own hangars
//             nearest HOME and w3 the same way (scenery_<n>_front/low.jpg - what item 35 asks the garages to match).
//   Every FLYDIY_PREM_EYE is ASSERTED (memory: the eye returned false once and eight stills showed the chase view).
//
//   node tools/hangars_look_shot.js --tag before            # all of it
//   node tools/hangars_look_shot.js --tag after --only world
//   node tools/hangars_look_shot.js --tag after_single --leaves 1   # the cabin's door as one leaf
//   node tools/hangars_look_shot.js --headed
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process'), http = require('http');
const ROOT = path.join(__dirname, '..'), REPO = path.join(ROOT, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const TAG = opt('tag', 'now'), PORT = +opt('port', 8139), PAGE = opt('page', 'index.html');
const ONLY = opt('only', null) ? opt('only').split(',') : null;
const want = k => !ONLY || ONLY.includes(k);
const OUT = path.join(ROOT, 'reports', 'evidence', 'HANGARS-LOOK', TAG);
let pw;
try { pw = require('playwright'); } catch (e) { try { pw = require(path.join(cp.execSync('npm root -g').toString().trim(), 'playwright')); } catch (e2) { pw = cdpPlaywright(); } }
// the box has no playwright: the system Chrome over CDP (garage_shot.js's rig), behind the few calls this rig makes
// (launch / newContext / newPage / on('pageerror') / addInitScript / goto / evaluate / screenshot / close); the
// profile in the OS temp dir (C:), deleted when the browser closes
function cdpPlaywright() {
  const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
  if (!CHROME) throw new Error('no playwright and no Chrome');
  const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  return { chromium: { launch: async (o) => {
    const port = 9400 + (process.pid % 500), udd = path.join(require('os').tmpdir(), 'hl_cdp_' + port + '_' + Date.now());
    const ch = cp.spawn(CHROME, [o.headless === false ? '' : '--headless=new', '--remote-debugging-port=' + port, '--window-size=1600,900', '--hide-scrollbars',
      '--no-first-run', '--user-data-dir=' + udd, '--disable-gpu-sandbox'].concat(o.args || []).filter(Boolean).concat(['about:blank']), { stdio: 'ignore' });
    let tgt = null;
    for (let i = 0; i < 60 && !tgt; i++) { await wait(400); try { tgt = (await getJSON('http://127.0.0.1:' + port + '/json')).find(t => t.type === 'page'); } catch (e) {} }
    if (!tgt) throw new Error('Chrome never answered on ' + port);
    const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
    let id = 0; const waits = new Map(), on = { pageerror: [], load: [] };
    ws.onmessage = m => { const d = JSON.parse(m.data);
      if (d.id && waits.has(d.id)) { waits.get(d.id)(d); waits.delete(d.id); }
      if (d.method === 'Runtime.exceptionThrown') { const x = d.params.exceptionDetails; const msg = (x.exception && x.exception.description) || x.text || 'error'; on.pageerror.forEach(f => f({ message: msg })); }
      if (d.method === 'Page.loadEventFired') { const l = on.load.splice(0); l.forEach(f => f()); } };
    const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    await cmd('Page.enable'); await cmd('Runtime.enable');
    const page = {
      on: (k, f) => { if (on[k]) on[k].push(f); },
      addInitScript: (fn, arg) => cmd('Page.addScriptToEvaluateOnNewDocument', { source: '(' + fn.toString() + ')(' + JSON.stringify(arg) + ')' }),
      goto: async (url, q) => { const loaded = new Promise(r => on.load.push(r)); await cmd('Page.navigate', { url });
        await Promise.race([loaded, wait((q && q.timeout) || 300000)]); },
      evaluate: async (expr) => { const r = await cmd('Runtime.evaluate', { expression: String(expr), awaitPromise: true, returnByValue: true });
        if (!r.result || r.result.exceptionDetails) { const x = r.result && r.result.exceptionDetails; throw new Error((x && ((x.exception && x.exception.description) || x.text)) || JSON.stringify(r.error || r)); }
        return r.result.result.value; },
      screenshot: async (q) => { const s = await cmd('Page.captureScreenshot', { format: q.type === 'png' ? 'png' : 'jpeg', quality: q.type === 'png' ? undefined : (q.quality || 88) });
        if (!s.result) throw new Error('screenshot: ' + JSON.stringify(s.error)); fs.writeFileSync(q.path, Buffer.from(s.result.data, 'base64')); },
    };
    return {
      newContext: async (c) => { const v = (c && c.viewport) || { width: 1600, height: 900 };
        await cmd('Emulation.setDeviceMetricsOverride', { width: v.width, height: v.height, deviceScaleFactor: 1, mobile: false }); return { newPage: async () => page, close: async () => {} }; },
      close: async () => { try { ws.close(); } catch (e) {}
        try { if (process.platform === 'win32') cp.execSync('taskkill /PID ' + ch.pid + ' /T /F', { stdio: 'ignore' }); else ch.kill(); } catch (e) {}
        await wait(800); try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {} },
    };
  } } };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const C = require('./flight_core.js');

// the document: the sandbox's own default, HOME.2 held through the rules, the story's cabin shed at w1 (its own builder)
function docCabin() {
  let d = C.playerNormalise(C.playerMigrate(C.playerDefault()));
  const r = C.playerAcquire(d, 'HOME', 'HOME.2', 'club', 'own'); if (!r.ok) throw new Error('HOME.2: ' + r.why); d = r.doc;
  const cab = C.storyCabinShed('w1', d.clock || 0);
  d.sheds[cab.id] = cab.shed;
  // --leaves 1: the cabin's door as one leaf (the comparison with the bi-parting pair, G3537)
  if (opt('leaves', null) === '1' && cab.shed.dims) delete cab.shed.dims.leaves;
  d.here = cab.id;
  return d;
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.bin': 'application/octet-stream', '.ktx2': 'application/octet-stream', '.wasm': 'application/wasm', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.glb': 'model/gltf-binary' };
function serve() {
  const srv = http.createServer((q, s) => {
    const u = decodeURIComponent(q.url.split('?')[0]);
    const f = path.join(REPO, u);
    if (!f.startsWith(REPO)) { s.writeHead(403); s.end(); return; }
    fs.stat(f, (e, st) => {
      if (e || !st.isFile()) { s.writeHead(404); s.end(); return; }
      s.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-store' });
      fs.createReadStream(f).pipe(s);
    });
  });
  return new Promise(ok => srv.listen(PORT, '127.0.0.1', () => ok(srv)));
}

// THE PROBE (item 36), run in the page: the room's scene through GARAGE_ENV._debug()
const PROBE = `(() => {
  const D = window.GARAGE_ENV && GARAGE_ENV._debug && GARAGE_ENV._debug(); if (!D || !D.scene) return { err: 'no room' };
  const T = window.THREE, S = D.scene; S.updateMatrixWorld(true);
  const shown = o => { for (let p = o; p; p = p.parent) if (p.visible === false) return false; return true; };
  const want = /car_covered|airframe_jodel_body|work_trestle|wip/i;
  const pieces = [], casters = [];
  S.traverse(o => { if (o.isLight && o.castShadow) casters.push(o); });
  S.traverse(o => {
    let named = null; for (let p = o; p; p = p.parent) if (p.name && want.test(p.name)) { named = p.name; break; }
    if (!named || !o.isMesh) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    const b = new T.Box3().setFromObject(o);
    pieces.push({ under: named, name: o.name, cast: o.castShadow, recv: o.receiveShadow, shown: shown(o), inst: !!o.isInstancedMesh, count: o.count,
      mat: m ? { type: m.type, side: m.side, shadowSide: m.shadowSide, transparent: m.transparent, alphaTest: m.alphaTest, opacity: m.opacity, depthWrite: m.depthWrite } : null,
      layers: o.layers.mask, box: [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].map(v => +v.toFixed(2)),
      inFrustum: casters.map(L => { const c = L.shadow && L.shadow.camera; if (!c) return null; c.updateMatrixWorld(true); if (L.shadow.updateMatrices) L.shadow.updateMatrices(L);
        const F = new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse)); return F.intersectsBox(b); }) });
  });
  const lights = casters.map(L => ({ type: L.type, name: L.name, intensity: +L.intensity.toFixed(3), shown: shown(L), map: L.shadow && L.shadow.map ? L.shadow.map.width : 0,
    autoUpdate: L.shadow ? L.shadow.autoUpdate : null, needsUpdate: L.shadow ? L.shadow.needsUpdate : null, pos: L.getWorldPosition(new T.Vector3()).toArray().map(v => +v.toFixed(2)) }));
  const R = D.renderer, SS = window.SHED_SHADOW;
  return { pieces, lights, shadowMap: R ? { on: R.shadowMap.enabled, auto: R.shadowMap.autoUpdate, type: R.shadowMap.type } : null,
    shedShadow: SS && SS.stat ? JSON.parse(JSON.stringify(Object.assign({ on: SS.S.on }, SS.stat()))) : null, dims: GARAGE_ENV.dims(), shell: GARAGE_ENV.shell(),
    polish: D.hangar ? D.hangar.polish || null : null, dirt: D.hangar ? D.hangar.dirt || 0 : 0,
    boombox: !!(D.hangar && D.hangar.mobileProp && D.hangar.mobileProp('boombox')) };
})()`;

// the scenery's own hangars (HANGAR_GEN items) in the world: a mesh wearing the shell library (or its G3531 clone), its group
const SCENERY_HANGARS = `JSON.stringify((() => {
  const D = window.GARAGE_ENV && GARAGE_ENV._debug && GARAGE_ENV._debug(), W = D && D.world, HG = window.HANGAR_GEN; if (!W) return [];
  const lib = new Set(); if (HG && HG.LIB) for (const s in HG.LIB) for (const k in HG.LIB[s]) lib.add(HG.LIB[s][k]);
  const seen = new Map(), v = new THREE.Vector3();
  W.traverse(o => {
    if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
    if (!(lib.has(o.material) || (o.material.userData && o.material.userData.hangarShell))) return;
    let g = o.parent; for (let p = o; p; p = p.parent) if (p.name && /^shed:/.test(p.name)) return;   // the player's sheds are not the scenery
    if (!g || seen.has(g.uuid)) return;
    g.getWorldPosition(v); seen.set(g.uuid, { x: +v.x.toFixed(1), y: +v.y.toFixed(1), z: +v.z.toFixed(1), ry: +(g.rotation.y || 0).toFixed(3), name: g.name || '' });
  });
  return Array.from(seen.values());
})())`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const browser = await pw.chromium.launch({ headless: !argv.includes('--headed'),
    args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=default', '--js-flags=--max-old-space-size=8192'] });
  const twin = { tag: TAG, page: PAGE, at: new Date().toISOString() };
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  const doc = JSON.stringify(docCabin());
  await page.addInitScript(d => { try { if (sessionStorage.getItem('__ps')) return; sessionStorage.setItem('__ps', '1'); localStorage.clear(); localStorage.setItem('flydiy.player', d); localStorage.setItem('flydiy.flManual', '0'); } catch (e) {} }, doc);
  const ev = async (expr, d) => { try { return await page.evaluate(expr); } catch (e) { return d === undefined ? 'ERR ' + e.message.split('\n')[0] : d; } };
  const shoot = f => page.screenshot({ path: path.join(OUT, f), type: 'jpeg', quality: 88, timeout: 120000 });
  const t0 = Date.now();
  await page.goto('http://127.0.0.1:' + PORT + '/flyDiy/' + PAGE, { waitUntil: 'load', timeout: 300000 });
  let up = false;
  for (let i = 0; i < 300 && !up; i++) {
    await sleep(2000);
    await ev("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build|sandbox/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click()); return 1;})()", 0);
    up = (await ev("!!(window.FLYDIY_PLAYER && window.WORLD && (!window.BOOT || !BOOT.state || BOOT.state === 'gone'))", false)) === true;
  }
  twin.upS = +((Date.now() - t0) / 1000).toFixed(1);
  console.log('page ' + (up ? 'up' : 'NOT up') + ' in ' + twin.upS + ' s' + (errs.length ? ' (' + errs.length + ' page errors: ' + errs[0] + ')' : ''));
  if (!up) { fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify(Object.assign(twin, { errors: errs }), null, 1)); await browser.close(); srv.close(); process.exit(1); }
  twin.here = await ev('FLYDIY_PLAYER.doc().here');
  await sleep(6000);
  const eyeAt = async (name, p, t) => {
    const ok = await ev('window.FLYDIY_PREM_EYE(' + JSON.stringify(p) + ', ' + JSON.stringify(t) + ')', false);
    if (ok !== true) { console.log('  EYE REFUSED for ' + name + ' (' + ok + ')'); return false; }
    await sleep(4500);
    await shoot(name + '.jpg');
    return true;
  };
  const twoViews = async (id, x, y, z, hdg, half) => {
    const fx = Math.cos(hdg), fz = Math.sin(hdg), sx = -fz, sz = fx, r = (half || 12) + 18;
    const a = await eyeAt(id + '_front', [x + fx * 30, y + 8, z + fz * 30], [x, y + 3, z]);
    const b = await eyeAt(id + '_low', [x + (fx + sx) * r * 0.72, y + 1.7, z + (fz + sz) * r * 0.72], [x, y + 1.0, z]);
    return a && b;
  };
  // THE PAIRS (G3539): the same points in the shed's own frame (the door at local -x, x across the depth, z across the
  // width, the floor at 0) through the ROOM (FLYDIY_ROOM_EYE, before the roll-out) and through the WORLD's shed node
  // (FLYDIY_PREM_EYE, after it) - the outside the user wants matching the inside, at the same scale
  const PAIRS = (D) => ({
    front: [[-D.HD - 18, 4.0, -5], [-D.HD, 2.0, 0]],
    corner: [[-D.HD - 8, 1.6, D.HW + 8], [0, 1.4, 0]],
    back: [[D.HD + 14, 3.0, -D.HW - 10], [0, 2.0, 0]],
    far: [[-D.HD - 40, 10, 12], [0, 2.5, 0]],
    // G3540, the user's plank: over the door pair (outside), and on the back wall the stand looks at (inside, 3.5 m along)
    sign: [[-D.HD - 7, 3.0, 1.5], [-D.HD, 4.6, 0]],
    signin: [[2, 1.8, 0.5], [D.HD, 3.45, 3.5]],
  });
  const NODE = id => `(() => { const D = GARAGE_ENV._debug(), W = D && D.world; if (!W) return null; let n = null;
    W.traverse(o => { if (!n && o.name === 'shed:' + ${JSON.stringify(id)}) n = o; });
    if (!n && ${JSON.stringify(id)} === 'HOME') { const h = siteOf('HOME').hangar; W.traverse(o => { if (!n && o.isLOD && Math.abs(o.position.x - h.x) < 0.01 && Math.abs(o.position.z - h.z) < 0.01) n = o; }); }
    return n; })()`;
  const toWorld = (id, p) => ev(`(() => { const n = ${NODE(id)}; if (!n) return null; n.updateWorldMatrix(true, false); return new THREE.Vector3(${p.join(',')}).applyMatrix4(n.matrixWorld).toArray(); })()`, null);
  const roomDims = async () => JSON.parse(await ev('JSON.stringify(GARAGE_ENV.dims())', 'null') || 'null');
  // the room's stills in the page's own SCREENSHOT MODE (app.js SHOT_MODE, G255: the panels' inset released so the
  // canvas fills the window, the CG/NP posts and the UI layer hidden; its faint back button hidden too); a page without
  // it (an older build) gets its panels hidden instead (garage_shot.js --clean)
  const clean = async on => { const r = await ev(on
    ? "(()=>{if(window.SHOT_MODE){SHOT_MODE.enter();const b=document.getElementById('shotBack');if(b)b.style.visibility='hidden';return 'shot';}const c=document.querySelector('canvas');window.__hlHid=[];document.querySelectorAll('body *').forEach(el=>{if(el.contains(c)||el.closest('canvas')||getComputedStyle(el).visibility==='hidden')return;el.style.visibility='hidden';window.__hlHid.push(el);});return window.__hlHid.length})()"
    : "(()=>{if(window.SHOT_MODE&&SHOT_MODE.on){SHOT_MODE.exit();const b=document.getElementById('shotBack');if(b)b.style.visibility='';}(window.__hlHid||[]).forEach(el=>el.style.visibility='');window.__hlHid=[];return 1})()", 0);
    await sleep(800); return r; };
  const roomPairs = async (id) => {
    const D = await roomDims(); if (!D) return null;
    await clean(true);
    // G3540 v2: the inside sign where the room's fit hung it (hangar.polish.signIn, the room's frame), 6 m off it, eye high
    const pol = JSON.parse(await ev('JSON.stringify((GARAGE_ENV._debug().hangar || {}).polish || null)', 'null') || 'null');
    const si = pol && pol.signIn, PR = PAIRS(D);
    if (si) PR.signin = [[si.x + si.nx * 6, 1.8, si.z + si.nz * 6], [si.x, si.y, si.z]];
    console.log('  the inside sign: ' + (si ? si.at + ' at (' + si.x + ', ' + si.y + ', ' + si.z + ')' + (si.fit ? ' (fit)' : ' (plot)') : 'none') + (pol ? ', pad tris ' + pol.pad + ', dark foot ' + pol.footDark : ''));
    for (const [k, [p, t]] of Object.entries(PR)) {
      const ok = await ev('window.FLYDIY_ROOM_EYE ? FLYDIY_ROOM_EYE(' + JSON.stringify(p) + ',' + JSON.stringify(t) + ') : "no hook"', false);
      if (ok !== true) { console.log('  ROOM EYE REFUSED ' + k + ' (' + ok + ')'); await clean(false); return D; }
      await sleep(2500); await shoot(id + '_room_' + k + '.jpg');
    }
    await ev('window.FLYDIY_ROOM_EYE && FLYDIY_ROOM_EYE(null)', 0);
    await clean(false);
    return D;
  };
  const worldPairs = async (id, D) => {
    await clean(true);   // the HUD out of the shot as the room's panels are (SHOT_MODE on both screens)
    for (const [k, [p, t]] of Object.entries(PAIRS(D))) {
      const P = await toWorld(id, p), T = await toWorld(id, t);
      if (!P || !T) { console.log('  no world node for ' + id); await clean(false); return false; }
      await eyeAt(id.replace('.', '') + '_world_' + k, P, T);
    }
    await clean(false);
    return true;
  };
  if (want('cabin')) twin.roomDims = await roomPairs('w1');
  // ITEM 36, SEEN: the covered car and the work-in-progress fuselage from ~7 m off, 3 m up, in the room's frame (each
  // piece's box centre taken to the room group's local frame), the floor print under them in shot
  if (want('cabin')) {
    await clean(true);
    for (const [tag, re] of [['car', 'car_covered'], ['wip', 'airframe_jodel_body']]) {
      const at = JSON.parse(await ev(`JSON.stringify((() => { const D = GARAGE_ENV._debug(), g = D && D.hangar && D.hangar.group; if (!g) return null;
        let o = null; D.scene.traverse(n => { if (!o && n.name && /${re}/.test(n.name) && n.visible !== false) o = n; }); if (!o) return null;
        g.updateWorldMatrix(true, false); const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3());
        return c.applyMatrix4(g.matrixWorld.clone().invert()).toArray(); })())`, 'null') || 'null');
      if (!at) { console.log('  no ' + re + ' in the room'); continue; }
      const p = [at[0] - 5.5, 3.0, at[2] + (at[2] > 0 ? -4.5 : 4.5)];
      const ok = await ev('window.FLYDIY_ROOM_EYE ? FLYDIY_ROOM_EYE(' + JSON.stringify(p) + ',' + JSON.stringify([at[0], 0.3, at[2]]) + ') : "no hook"', false);
      if (ok !== true) { console.log('  ROOM EYE REFUSED ' + tag); break; }
      await sleep(2500); await shoot('w1_room_' + tag + '.jpg');
    }
    await ev('window.FLYDIY_ROOM_EYE && FLYDIY_ROOM_EYE(null)', 0);
    await clean(false);
  }
  else twin.roomDims = await roomDims();
  if (want('cabin')) {
    await shoot('w1_room_default.jpg');
    twin.probeRoom = await ev(PROBE);
    await ev("document.getElementById('edRoll').click()", 0);
    for (let k = 0; k < 24; k++) {
      await sleep(500);
      await shoot('w1_rollout_' + String(k).padStart(2, '0') + '.jpg');
      if (k === 8) twin.probeRoll = await ev(PROBE);
    }
  } else await ev("document.getElementById('edRoll').click()", 0);
  for (let i = 0; i < 120; i++) { await sleep(1000); if ((await ev('!!(window.FLYDIY_PREM_EYE && document.body && !document.body.classList.contains("garage"))', false)) === true) break; }
  await sleep(8000);
  twin.sheds = await ev('JSON.stringify(window.WORLD.playerSheds ? window.WORLD.playerSheds() : null)', '');
  // the world: the cabin's shed at the room's dims, then the other garages and the scenery's own hangars
  if (twin.roomDims) await worldPairs('w1', twin.roomDims);
  if (want('world')) {
    const dimsOf = id => C.hangarDims(JSON.parse(doc).sheds[id] || { shell: 'club' });
    for (const id of ['HOME.2', 'HOME']) await worldPairs(id, dimsOf(id));
    const plots = JSON.parse(await ev(`JSON.stringify((() => { const out = {}; for (const a of window.WORLD.aerodromes || []) { const s = siteOf(a.id); if (s && s.plots) for (const p of s.plots) out[p.id] = p; } return out; })())`, '{}') || '{}');
    const sc = JSON.parse(await ev(SCENERY_HANGARS, '[]') || '[]');
    twin.scenery = sc;
    const near = (x, z) => sc.slice().sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
    const picks = [];
    for (const id of ['HOME.2', 'w3']) if (plots[id]) { const q = near(plots[id].x, plots[id].z); if (q && !picks.includes(q)) picks.push(q); }
    for (let i = 0; i < picks.length; i++) {
      const q = picks[i], hdg = Math.PI / 2 - q.ry, fx = Math.cos(hdg), fz = Math.sin(hdg);
      await eyeAt('scenery_' + i + '_front', [q.x + fx * 30, q.y + 8, q.z + fz * 30], [q.x, q.y + 3, q.z]);
      await eyeAt('scenery_' + i + '_low', [q.x + (fx - fz) * 20, q.y + 1.7, q.z + (fz + fx) * 20], [q.x, q.y + 1.0, q.z]);
    }
  }
  twin.errors = errs.slice(0, 8);
  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify(twin, null, 1));
  console.log('stills + shots.json -> ' + path.relative(ROOT, OUT));
  await browser.close();
  srv.close();
  process.exit(0);
})();
