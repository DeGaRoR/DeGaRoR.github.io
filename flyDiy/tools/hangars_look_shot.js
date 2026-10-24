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
try { pw = require('playwright'); } catch (e) { pw = require(path.join(cp.execSync('npm root -g').toString().trim(), 'playwright')); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const C = require('./flight_core.js');

// the document: the sandbox's own default, HOME.2 held through the rules, the story's cabin shed at w1 (its own builder)
function docCabin() {
  let d = C.playerNormalise(C.playerMigrate(C.playerDefault()));
  const r = C.playerAcquire(d, 'HOME', 'HOME.2', 'club', 'own'); if (!r.ok) throw new Error('HOME.2: ' + r.why); d = r.doc;
  const cab = C.storyCabinShed('w1', d.clock || 0);
  d.sheds[cab.id] = cab.shed;
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
  if (want('cabin')) {
    await shoot('cabin_room.jpg');
    twin.probeRoom = await ev(PROBE);
    // the roll-out, frame by frame (the shadows the user missed are "visible in the roll-out animation"); the probe mid-way
    await ev("document.getElementById('edRoll').click()", 0);
    for (let k = 0; k < 24; k++) {
      await sleep(500);
      await shoot('cabin_rollout_' + String(k).padStart(2, '0') + '.jpg');
      if (k === 8) twin.probeRoll = await ev(PROBE);
    }
  } else await ev("document.getElementById('edRoll').click()", 0);
  // the world
  for (let i = 0; i < 120; i++) { await sleep(1000); if ((await ev('!!(window.FLYDIY_PREM_EYE && document.body && !document.body.classList.contains("garage"))', false)) === true) break; }
  await sleep(8000);
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
  if (want('world') || want('cabin')) {
    const plots = JSON.parse(await ev(`JSON.stringify((() => { const out = {}; for (const a of window.WORLD.aerodromes || []) { const s = siteOf(a.id); if (s && s.plots) for (const p of s.plots) out[p.id] = p; if (a.id === 'HOME' && s && s.hangar) out.HOME = { x: s.hangar.x, z: s.hangar.z, y: s.hangar.y || 0, hdg: s.hangar.ry, isHangar: 1 }; } return out; })())`, '{}') || '{}');
    twin.plots = plots;
    twin.sheds = await ev('JSON.stringify(window.WORLD.playerSheds ? window.WORLD.playerSheds() : null)', '');
    for (const id of ['w1', 'HOME.2', 'HOME']) {
      const p = plots[id]; if (!p) { console.log('  no plot ' + id); continue; }
      const y = isFinite(p.y) ? p.y : (await ev('window.WORLD.terrainH ? WORLD.terrainH(' + p.x + ',' + p.z + ') : 0', 0));
      // a plot's hdg points out of its door (gameprem_world_shot's eye); HOME's hangar ry is the shed's own yaw (the door at local -x)
      const hdg = p.isHangar ? Math.PI - p.hdg : p.hdg;
      await twoViews(id.replace('.', ''), p.x, +y || 0, p.z, hdg, id === 'w1' ? 11 : 15);
    }
    const sc = JSON.parse(await ev(SCENERY_HANGARS, '[]') || '[]');
    twin.scenery = sc;
    const near = (x, z) => sc.slice().sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
    const picks = [];
    if (plots.HOME) { const s = near(plots.HOME.x, plots.HOME.z); if (s) picks.push(s); }
    if (plots.w3) { const s = near(plots.w3.x, plots.w3.z); if (s && !picks.includes(s)) picks.push(s); }
    for (let i = 0; i < picks.length; i++) {
      const s = picks[i];
      // the house frame: the door to +z, turned by the group's yaw
      await twoViews('scenery_' + i, s.x, s.y, s.z, Math.PI / 2 - s.ry, 15);
    }
  }
  twin.errors = errs.slice(0, 8);
  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify(twin, null, 1));
  console.log('stills + shots.json -> ' + path.relative(ROOT, OUT));
  await browser.close();
  srv.close();
  process.exit(0);
})();
