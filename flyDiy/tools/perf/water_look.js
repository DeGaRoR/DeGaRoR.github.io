#!/usr/bin/env node
// water_look.js - THE REDESIGN'S P0 LOOK (WATER-STEADY G2833): the same coastal and lake views under each reflection
// variant, as stills for the user to judge (their explicit ask, 13 Oct - D:/Dev/flydiy-notes/WATER-REDESIGN-PLAN-2026-10.md).
//
//   node tools/perf/water_look.js [--url http://localhost:8583/flyDiy/dev.html?world=jolene&gfx=gamer]
//        [--variants ref,b,c,bc] [--views dock,off300,lowpass,approach,lake,opensea] [--build bugReports/cessnaFloats.json]
//        [--out screenshots/water_look] [--wait 3500] [--boot-cap 150000]
// One headless boot a variant (?wrefl=b|c|bc; 'ref' = no switch: today's AUTO mirror), the floatplane rolled out and PAUSED,
// then each view: the aircraft placed (afloat at its rest height, or at a height), the free eye placed and aimed at it, the
// HUD hidden (SHOT_MODE), a still after --wait ms. The views are found from the terrain at run time (no coordinates to go
// stale): the water aerodrome nearest a shore ('dock'), 300 m off that shore, a low pass at 15 m there, an approach at 150 m
// 1.5 km out, Jolene's lake, the open sea 3 km out at 30 m. Writes <out>/<view>_<variant>.png, look.json and index.html
// (the views side by side). A LOOK, not a timing: GPU untimed, the box's lock taken by the caller.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL0 = opt('url', 'http://localhost:8583/flyDiy/dev.html?world=jolene&gfx=gamer');
const VARIANTS = opt('variants', 'ref,b,c,bc').split(',').filter(Boolean);
const VIEWS = opt('views', 'dock,off300,lowpass,approach,lake,opensea').split(',').filter(Boolean);
const BUILD = opt('build', 'bugReports/cessnaFloats.json');
const OUT = path.resolve(opt('out', 'screenshots/water_look'));
const WAIT = +opt('wait', 3500), BOOT_CAP = +opt('boot-cap', 150000);
const LABEL = { ref: 'today (AUTO mirror)', b: 'b - the hull reflection', c: 'c - transparency + shadow', bc: 'b + c', ring: 'ring - the full mirror near land + the hull + the shadow (one sky)' };
// --dials '<js>' (G2836): run after the boot of every variant (the ring's fades, its guards), e.g. "WATER.mirror.ringD0=700"
const DIALS = opt('dials', null);
const WP = require('./water_places.js');
const NOTE = {
  dock: 'the floatplane afloat at the water aerodrome nearest a shore, eye 4 m up, the shore behind it',
  off300: 'afloat 300 m off the coast, eye 6 m up, the shore ahead',
  lowpass: 'a low pass 15 m over the sea near the shore, from the side',
  approach: 'the approach at 150 m, 1.5 km out, the shore ahead',
  lake: "afloat on Jolene's lake, eye 8 m up",
  opensea: 'the open sea 3 km out, the aeroplane at 30 m',
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('water_look: no Chrome'); process.exit(2); }

// the page side: the views from the terrain, the placing, the aim
const VIEWS_JS = `(() => {
  const w = FLIGHT_PROBE.world(), WF = window.WORLD;
  const land = (x, z) => w.terrainH(x, z) > 0.5;
  const lvl = (x, z) => { const y = WF && WF.waterDrawY ? WF.waterDrawY(x, z) : null; return Number.isFinite(y) ? y : 0; };
  // the nearest land from a water point: 32 headings, out to R m
  const nearLand = (x, z, R) => { let best = null;
    for (let k = 0; k < 32; k++) { const a = k / 32 * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a);
      for (let r = 20; r <= R; r += 20) if (land(x + dx * r, z + dz * r)) { if (!best || r < best.r) best = { r, dx, dz }; break; } }
    return best; };
  const A = (w.aerodromes || []).filter(a => a.kind === 'water' && !land(a.x, a.z));
  let dock = null;
  for (const a of A) { const n = nearLand(a.x, a.z, 1500); if (n && (!dock || n.r < dock.n.r)) dock = { x: a.x, z: a.z, n, id: a.id }; }
  if (!dock) { for (let x = 2600; x < 4000 && !dock; x += 20) if (!land(x, 0)) { const n = nearLand(x + 60, 0, 1500); if (n) dock = { x: x + 60, z: 0, n, id: 'east coast' }; } }
  // walk away from the shore until the nearest land is at least D
  const seaward = (P, D) => { let x = P.x, z = P.z; for (let i = 0; i < 400; i++) { const n = nearLand(x, z, D + 40); if (!n || n.r >= D) return { x, z, n: n || P.n }; x -= n.dx * 20; z -= n.dz * 20; } return { x, z, n: P.n }; };
  const off = seaward(dock, 300), far = seaward(dock, 3000);
  const lk = { x: -604, z: -1150 }; lk.n = nearLand(lk.x, lk.z, 2000) || { r: 100, dx: 1, dz: 0 };
  return JSON.stringify({ dock, off, far, lake: lk, levels: { dock: lvl(dock.x, dock.z), off: lvl(off.x, off.z), far: lvl(far.x, far.z), lake: lvl(lk.x, lk.z) } });
})()`;

async function runVariant(variant, views, idx) {
  const PORT = 9400 + ((process.pid + idx * 7) % 500);
  const udd = path.join(require('os').tmpdir(), 'cdp_look_' + PORT + '_' + Date.now());
  const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--window-size=1920,1080', '--hide-scrollbars', '--no-first-run',
    '--user-data-dir=' + udd, '--disable-gpu-sandbox', '--disable-frame-rate-limit', '--disable-gpu-vsync', 'about:blank'], { stdio: 'ignore' });
  const kill = () => { try { if (process.platform === 'win32') require('child_process').execSync('taskkill /PID ' + ch.pid + ' /T /F', { stdio: 'ignore' }); else ch.kill(); } catch (e) {} try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {} };
  const rec = { variant, shots: {} };
  try {
    let tgt = null;
    for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
    if (!tgt) throw new Error('no page target');
    const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
    let id = 0; const waits = new Map();
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); } };
    const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); const d = r.result;
      if (!d || d.exceptionDetails) throw new Error('page: ' + (d && d.exceptionDetails ? (d.exceptionDetails.exception && d.exceptionDetails.exception.description || d.exceptionDetails.text) : JSON.stringify(r))); return d.result.value; };
    await cmd('Page.enable'); await cmd('Runtime.enable');
    const wip = fs.readFileSync(path.resolve(__dirname, '..', '..', BUILD), 'utf8');
    await cmd('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.setItem("flydiy.wip",' + JSON.stringify(wip) + ');localStorage.removeItem("flydiy.gfx")}catch(e){}' });
    await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    const url = URL0 + (variant === 'ref' ? '' : (URL0.includes('?') ? '&' : '?') + 'wrefl=' + variant);
    await cmd('Page.navigate', { url });
    await sleep(1500);
    try { await ev("(() => Promise.race([(window.BOOT && BOOT.whenReady) ? BOOT.whenReady().then(() => 'ready') : new Promise(r => setTimeout(() => r('no BOOT'), 18500)), new Promise(r => setTimeout(() => r('boot timeout'), " + BOOT_CAP + "))]))()"); } catch (e) { await sleep(18500); }
    const KEEP = "(()=>{const l=[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0&&b.offsetParent);l.forEach(x=>x.click());return l.length;})()";
    let flying = false;
    for (let a = 0; a < 8 && !flying; a++) {
      await ev("(()=>{const g=document.getElementById('bGo'); if (g) { g.click(); return; } [...document.querySelectorAll('button')].filter(b=>/roll out/i.test(b.textContent)).forEach(x=>x.click());})()");
      await sleep(6000);
      flying = await ev("!!window.FLIGHT_PROBE && (/TAXI|DOWNWIND|FINAL|DEPART|TAKEOFF/.test(document.body.innerText) || (window.BOOT && BOOT.state === 'loading'))");
    }
    if (!flying) throw new Error('the roll-out never happened');
    for (let i = 0; i < 20; i++) { const n = await ev(KEEP); await sleep(500); if (!n && i > 4) break; }
    for (let i = 0; i < 300; i++) { const bs = await ev("window.BOOT ? BOOT.state : 'none'"); if (bs === 'gone' || bs === 'none') break; await sleep(1000); }
    await ev("(()=>{[...document.querySelectorAll('button')].filter(b=>/continue anyway/i.test(b.textContent)).forEach(b=>b.click());return 1;})()");
    await sleep(2000);   // the overlay gone + 2 s before anything is shot (the user caught loading screens)
    await ev("(()=>{const b=document.getElementById('bPause');if(b&&/pause/i.test(b.textContent))b.click();return 1;})()");
    // the rest height: the CG over whatever it stands or floats on at the roll-out
    rec.h0 = JSON.parse(await ev(`(() => { const s = FLIGHT_PROBE.sim(), w = FLIGHT_PROBE.world(), c = s.cgPos(); const wy = WORLD.waterDrawY ? WORLD.waterDrawY(c[0], c[2]) : null;
      const base = Math.max(w.terrainH(c[0], c[2]), Number.isFinite(wy) ? wy : -1e9); return JSON.stringify(+(c[1] - base).toFixed(2)); })()`));
    rec.gfx = JSON.parse(await ev('JSON.stringify(window.GFX ? GFX.get() : null)'));
    rec.proto = JSON.parse(await ev('JSON.stringify(WATER.proto || null)'));
    rec.where = JSON.parse(await ev(VIEWS_JS));
    // (G2836) the shared finder: the lake ON a drawn lake (the P0 look's lake was taken under the terrain from water_shot's eye point)
    rec.places = await ev(WP.FIND);
    rec.lake = JSON.parse(await ev('JSON.stringify(window.__WP && __WP.lake ? { x: __WP.lake.x, z: __WP.lake.z, y: __WP.lake.y, n: __WP.lake.n } : null)'));
    if (rec.lake) { rec.where.lake = rec.lake; rec.where.levels.lake = rec.lake.y; } else rec.where.lake = null;
    if (DIALS) await ev('(()=>{' + DIALS + ';return 1;})()');
    await ev("(()=>{FLIGHT_PROBE.world().setSea({A:0.09,L:10,dir:0.4});WATER.setWind(5,0.4);return 1;})()");   // 5 m/s: the plan's pinned sea
    await ev("(()=>{const R=window.FLYDIY_RAIL,f=document.getElementById('flFly');if(R)R.open(f&&!f.hidden?null:'camera');return 1;})()");
    await sleep(300);
    if (!await ev("(()=>{const p=[...document.querySelectorAll('#flFlyBody .pill')].find(b=>b.textContent.trim()==='free');if(!p)return 0;p.click();return 1;})()")) throw new Error('no free pill');
    await ev("(()=>{const R=window.FLYDIY_RAIL,f=document.getElementById('flFly');if(R)R.open(f&&!f.hidden?null:'camera');return 1;})()");
    await ev('(()=>{if(window.SHOT_MODE)SHOT_MODE.enter();return 1;})()');
    const W0 = rec.where, H0 = Math.max(0.5, rec.h0);
    // a view: the aircraft's CG at (x, y, z), the eye at the aircraft + (back along the shore's normal, up, side)
    const spec = {
      dock:     () => ({ P: W0.dock, y: W0.levels.dock + H0 - 0.25, back: 22, up: 4, side: 6, toShore: true }),
      off300:   () => ({ P: W0.off, y: W0.levels.off + H0 - 0.25, back: 25, up: 6, side: 5, toShore: true }),
      lowpass:  () => ({ P: W0.off, y: W0.levels.off + 15, back: 6, up: 10, side: 40, toShore: true }),
      approach: () => { const n = W0.dock.n; return { P: { x: W0.dock.x - n.dx * 1500, z: W0.dock.z - n.dz * 1500, n }, y: W0.levels.dock + 150, back: 30, up: 5, side: 0, toShore: true }; },
      lake:     () => W0.lake ? ({ P: W0.lake, y: W0.levels.lake + H0 - 0.25, back: 25, up: 8, side: 6, toShore: true }) : null,
      opensea:  () => ({ P: W0.far, y: W0.levels.far + 30, back: 30, up: 0, side: 8, toShore: true }),
    };
    // (G2836) THE RING'S GRID: h<agl>_d<dist> - the aircraft agl m over the water (0: afloat), dist m from land seaward of the dock,
    // the eye 30 m further out and 5 m up, looking at it and the shore
    for (const v of views) { const g = /^([ho])(\d+)_d(\d+)$/.exec(v); if (!g || spec[v]) continue; const openSea = g[1] === 'o'; g.splice(1, 1);   // (round 2: o<agl>_d<dist> on the open sea)
      const P = JSON.parse(await ev(openSea ? 'JSON.stringify(__WP.towards(__WP.open, ' + (+g[2]) + '))' : 'JSON.stringify(__WP.seaward(__WP.dock, ' + (+g[2]) + '))')), lvl = await ev('__WP.level(' + P.x + ',' + P.z + ')'), agl = +g[1];
      spec[v] = () => ({ P, y: agl > 0.5 ? lvl + agl : lvl + H0 - 0.25, back: 30, up: 5, side: 6, toShore: true, yEye: (agl > 0.5 ? lvl + agl : lvl) + 5 });
      NOTE[v] = NOTE[v] || `the aircraft ${agl > 0.5 ? agl + ' m over the water' : 'afloat'}, ${g[2]} m from land (measured ${Math.round(P.r)} m)`; }
    for (const v of views) {
      if (!spec[v]) continue;
      const S = spec[v](); if (!S) { console.log('  ' + variant + ' ' + v + ': no place (skipped)'); continue; }
      const n = S.P.n || { dx: 1, dz: 0 };
      // the aircraft
      await ev(`(async()=>{const s=FLIGHT_PROBE.sim(),c=s.cgPos();await FLIGHT_PROBE.place({by:[${S.P.x}-c[0],${S.y}-c[1],${S.P.z}-c[2]],zeroV:true});return 1;})()`);
      // the eye: behind the aircraft (away from the shore when the shore is the backdrop), up, to the side; aimed at the CG
      const sgn = S.toShore ? -1 : 1, ex = S.P.x + sgn * n.dx * S.back + n.dz * S.side, ez = S.P.z + sgn * n.dz * S.back - n.dx * S.side;
      const level = v === 'lake' ? W0.levels.lake : (v === 'dock' ? W0.levels.dock : W0.levels.off);
      const ey = S.yEye !== undefined ? S.yEye : (v === 'lowpass' || v === 'approach' || v === 'opensea') ? S.y + S.up : level + S.up;
      const dx = S.P.x - ex, dz = S.P.z - ez, dy = S.y - ey, yaw = Math.atan2(dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
      await ev(`(()=>{const c=DEV_CAM;c.pos.set(${ex},${ey},${ez});c.yaw=${yaw};c.pitch=${pitch};return 1;})()`);
      await sleep(WAIT);
      const shot = await cmd('Page.captureScreenshot', { format: 'png' });
      const file = path.join(OUT, v + '_' + variant + '.png');
      fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
      rec.shots[v] = { file: path.basename(file), eye: [ex, ey, ez].map(t => +t.toFixed(1)), at: [S.P.x, S.y, S.P.z].map(t => +t.toFixed(1)),
        state: JSON.parse(await ev('JSON.stringify({ mirror: WATER.mirror.on, mirrorW: +(WATER.mirror.w || 0).toFixed(3), ringW: WATER.mirror.ringW, landD: WATER.mirror.landD, hull: WATER.hull ? { on: WATER.hull.on, w: +WATER.hull.w.toFixed(2), calls: WATER.hull.calls, ms: +WATER.hull.ms.toFixed(2) } : null })')) };
      console.log(`  ${variant.padEnd(3)} ${v.padEnd(8)} -> ${file}  ${JSON.stringify(rec.shots[v].state)}`);
    }
    ws.close();
  } catch (e) { rec.error = String(e.message || e); console.error('  ' + variant + ': ' + rec.error); }
  kill();
  return rec;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const recs = [];
  for (const v of VARIANTS) { console.log('water_look: ' + v + ' (' + (LABEL[v] || v) + ')'); recs.push(await runVariant(v, VIEWS, recs.length)); }
  fs.writeFileSync(path.join(OUT, 'look.json'), JSON.stringify({ date: new Date().toISOString(), url: URL0, build: BUILD, variants: recs }, null, 1));
  // the page: one row a view, the variants side by side (the stills next to it, relative paths)
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const rows = VIEWS.map(v => `<section><h2>${esc(v)}</h2><p>${esc(NOTE[v] || '')}</p><div class="g">` +
    VARIANTS.map(x => { const r = recs.find(q => q.variant === x), s = r && r.shots[v]; return `<figure>${s ? `<img src="${esc(s.file)}" alt="${esc(v + ' ' + x)}">` : '<div class="miss">not shot</div>'}<figcaption>${esc(LABEL[x] || x)}</figcaption></figure>`; }).join('') + '</div></section>').join('\n');
  fs.writeFileSync(path.join(OUT, 'index.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Water look</title>
<style>:root{--bg:#f6f6f4;--fg:#1b1b1b;--mut:#666}@media (prefers-color-scheme:dark){:root{--bg:#141414;--fg:#e8e8e8;--mut:#9a9a9a}}
body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,sans-serif}h1{font-size:20px}h2{font-size:16px;margin:24px 0 2px}p{color:var(--mut);margin:0 0 8px}
.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:10px}figure{margin:0}img{width:100%;height:auto;display:block;border-radius:4px}figcaption{font-size:13px;color:var(--mut);padding:4px 0}.miss{aspect-ratio:16/9;display:grid;place-items:center;border:1px dashed var(--mut)}</style>
<h1>The water's reflections - the same views, four ways</h1><p>Today's AUTO mirror against the redesign's aircraft at sea: b (its own reflection), c (transparency + its shadow), b + c. No coastal band in b / c (the user's ruling): the shore is not reflected at sea there, by design.</p>
${rows}`);
  console.log('water_look -> ' + path.join(OUT, 'index.html'));
})().catch(e => { console.error('water_look: ' + e.message); process.exit(1); });
