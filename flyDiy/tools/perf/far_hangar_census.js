#!/usr/bin/env node
// far_hangar_census.js - G2319.2 (A0's bug, 12 Oct: "the LODs for the auxiliary hangars in the starting area are black
// instead of the mesh colour"): THE NUMBERS that set HLOD.gainItem - no image kept (the user: no evidence screenshots).
//
// Two pages, the same free camera on each of HOME's HANGAR_GEN items (200 m off, 15 m up, looking at it):
//   NEAR  ?houselod=5000   the near town everywhere (the item as it is drawn up close: the reference)
//   FAR   ?houselod=1      the far town from 0 m (the item's far version), its colour rule's gainItem swept live -
//                          0.2 (the bug: the houses' fifth), then 0.6 / 1 / 1.4 - each far cell rebuilt (cl.sig = '')
// For each: the mean sRGB luminance of the item's projected box (shrunk to its middle 60 %: walls, not sky), off a PNG
// of the canvas decoded here and dropped. The pick: the gainItem whose far luminance is nearest the near one.
// Usage: node tools/perf/far_hangar_census.js --out <json> [--q 'gfx=gamer'] [--dist 200] [--gains 0.2,0.6,1,1.4]
//          [--sport 8595] [--dport 9495] [--udd C:/gfarh]
// A GPU run: inside a slot A0 named, under boxlock.sh take gpu. Rigs have no --help.
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http'), zlib = require('zlib');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.resolve(__dirname, '..', '..', '..');
const OUT = path.resolve(opt('out', 'far_hangar_census.json'));
const Q = opt('q', 'gfx=gamer'), DIST = +opt('dist', 200), GAINS = opt('gains', '0.2,0.6,1,1.4').split(',').map(Number);
const SPORT = +opt('sport', 8595), DPORT = +opt('dport', 9495), UDD = opt('udd', 'C:/gfarh');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', W = 1920, H = 1080;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });

// a minimal PNG reader (8-bit RGB / RGBA, filters 0-4): Page.captureScreenshot's own output
function readPng(buf) {
  let o = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o), type = buf.toString('ascii', o + 4, o + 8), d = buf.slice(o + 8, o + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; }
    else if (type === 'IDAT') idat.push(d);
    else if (type === 'IEND') break;
    o += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[dst + x - bpp] : 0, b = y ? px[dst - stride + x] : 0, c = (x >= bpp && y) ? px[dst - stride + x - bpp] : 0, v = raw[src + x];
      let p;
      if (f === 0) p = v; else if (f === 1) p = v + a; else if (f === 2) p = v + b; else if (f === 3) p = v + ((a + b) >> 1);
      else { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); p = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      px[dst + x] = p & 255;
    }
  }
  return { w, h, bpp, px };
}
const lumaOf = (img, r) => {
  let s = 0, n = 0;
  for (let y = Math.max(0, r.y0); y < Math.min(img.h, r.y1); y++) for (let x = Math.max(0, r.x0); x < Math.min(img.w, r.x1); x++) {
    const i = (y * img.w + x) * img.bpp; s += 0.2126 * img.px[i] + 0.7152 * img.px[i + 1] + 0.0722 * img.px[i + 2]; n++;
  }
  return n ? +(s / n).toFixed(2) : null;
};

async function page(tag, q, body) {
  try { fs.rmSync(UDD, { recursive: true, force: true }); } catch (e) {}
  const server = spawn(process.execPath, [path.join(ROOT, 'flyDiy/tools/_serve.js'), String(SPORT), ROOT, '--fallback', 'D:/Dev/DeGaRoR.github.io'], { stdio: 'ignore' });
  const ch = spawn(CHROME, ['--remote-debugging-port=' + DPORT, '--window-size=' + (W + 16) + ',' + (H + 140), '--window-position=0,0', '--no-first-run', '--no-default-browser-check',
    '--user-data-dir=' + UDD, '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', 'about:blank'], { stdio: 'ignore' });
  const kill = () => { for (const p of [ch, server]) try { execSync('taskkill /PID ' + p.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} };
  try {
    let tgt = null;
    for (let i = 0; i < 60 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + DPORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
    const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
    let id = 0; const waits = new Map();
    ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); } };
    const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const run = async b => { const r = await cmd('Runtime.evaluate', { expression: '(async()=>{ ' + b + '\n })()', awaitPromise: true, returnByValue: true }); const d = r.result;
      if (!d || d.exceptionDetails) return 'ERR ' + (d && d.exceptionDetails ? (d.exceptionDetails.exception && d.exceptionDetails.exception.description || d.exceptionDetails.text) : ''); return d.result.value; };
    const until = async (cond, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await run('return !!(' + cond + ');')) === true) return; await sleep(700); } throw new Error('timed out: ' + what); };
    const pre = 'try{for(const k of Object.keys(localStorage)) if(/^flydiy\\.(fl([A-Z]|$)|route$|world$|gfx$)/.test(k)) localStorage.removeItem(k); localStorage.setItem("flydiy.route", JSON.stringify({from:"HOME",dest:"CIRCUIT"})); localStorage.setItem("flydiy.flManual","0");}catch(e){}';
    await cmd('Page.enable'); await cmd('Runtime.enable');
    await cmd('Page.addScriptToEvaluateOnNewDocument', { source: 'if(!sessionStorage.getItem("__fh")){sessionStorage.setItem("__fh","1");' + pre + '}' });
    await cmd('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
    await cmd('Page.bringToFront');
    await cmd('Page.navigate', { url: 'http://localhost:' + SPORT + '/flyDiy/index.html?' + q });
    await until(`window.BOOT && BOOT.state === 'gone' && window.FLIGHT_PROBE`, 300000, tag + ' garage');
    await run(`const b = document.getElementById('bGo') || [...document.querySelectorAll('button')].find(x => x.offsetParent && /roll out/i.test(x.textContent)); if (b) b.click(); return 1;`);
    await sleep(2500);
    await run(`const b = document.getElementById('bGo'); if (b && b.offsetParent) b.click(); return 1;`);
    await until(`window.BOOT && BOOT.state === 'gone' && !document.body.classList.contains('garage') && window.WORLD && WORLD.premises && WORLD.premises.items`, 180000, tag + ' world');
    await sleep(4000);
    await run(`const p = document.getElementById('bPause'); if (p && /pause/i.test(p.textContent)) p.click(); document.body.style.visibility = 'hidden'; const c = document.getElementById('c') || FLIGHT_PROBE.renderer().domElement; c.style.visibility = 'visible'; return 1;`);
    return await body({ run, cmd });
  } finally { kill(); await sleep(500); }
}

// the HOME hangars, in world metres, with the eye 200 m off each (toward the open ground: the side away from the site's
// centre) and their box projected (in the page)
const HANGARS = `const P = WORLD.premises, it = (P.items() || []).filter(x => x.gen === 'HANGAR_GEN'), out = [];
  for (const x of it) { const h = P.houses.get(x.id); if (!h || !h.grp) continue; const b = new THREE.Box3().setFromObject(h.grp); if (!isFinite(b.min.x)) continue;
    const c = b.getCenter(new THREE.Vector3()); out.push({ id: x.id, c: [c.x, c.y, c.z], size: b.getSize(new THREE.Vector3()).toArray().map(v => +v.toFixed(1)) }); }
  return out;`;
const AIM = (h, k) => `const c = new THREE.Vector3(${h.c.join(',')}), a = ${k}, d = ${DIST};
  const e = new THREE.Vector3(c.x + Math.cos(a) * d, 0, c.z + Math.sin(a) * d); const g = FLIGHT_PROBE.world().terrainH(e.x, e.z); e.y = Math.max(g + 15, c.y + 15);
  if (window.FLYDIY_PREM_EYE) FLYDIY_PREM_EYE([e.x, e.y, e.z], [c.x, c.y, c.z]); else FLIGHT_PROBE.devFree(e.x, e.y, e.z, Math.atan2(c.x - e.x, -(c.z - e.z)), Math.atan2(c.y - e.y, Math.hypot(c.x - e.x, c.z - e.z)));
  await new Promise(r => setTimeout(r, 1500));
  const h = WORLD.premises.houses.get(${JSON.stringify(h.id)}), b = new THREE.Box3().setFromObject(h.grp), cam = FLIGHT_PROBE.camera(); cam.updateMatrixWorld();
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const X of [b.min.x, b.max.x]) for (const Y of [b.min.y, b.max.y]) for (const Z of [b.min.z, b.max.z]) { const v = new THREE.Vector3(X, Y, Z).project(cam);
    const sx = (v.x + 1) / 2 * ${W}, sy = (1 - v.y) / 2 * ${H}; x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); }
  const mx = (x1 - x0) * 0.2, my = (y1 - y0) * 0.2;
  return { x0: Math.round(x0 + mx), x1: Math.round(x1 - mx), y0: Math.round(y0 + my), y1: Math.round(y1 - my), eye: [e.x, e.y, e.z].map(v => +v.toFixed(1)) };`;

(async () => {
  const res = { q: Q, dist: DIST, gains: GAINS, near: {}, far: {}, pick: {} };
  const save = () => fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
  const shot = async cmd => readPng(Buffer.from((await cmd('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));
  // the directions tried per hangar (the first whose box is on screen and a fair size wins, the same on both pages)
  const DIRS = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  let list = null;
  await page('near', Q + '&houselod=5000', async ({ run, cmd }) => {
    list = await run(HANGARS); res.hangars = list; console.log('hangars ' + JSON.stringify(list)); save();
    for (const h of (Array.isArray(list) ? list : [])) {
      for (const k of DIRS) {
        const r = await run(AIM(h, k)); if (!r || typeof r !== 'object' || r.x1 - r.x0 < 8 || r.y1 - r.y0 < 6 || r.x0 < 0 || r.y0 < 0 || r.x1 > W || r.y1 > H) continue;
        await sleep(800); const img = await shot(cmd);
        res.near[h.id] = { dir: k, box: r, luma: lumaOf(img, r) }; h.dir = k; save();
        console.log('near ' + h.id + ' ' + JSON.stringify(res.near[h.id])); break;
      }
    }
  });
  await page('far', Q + '&houselod=1', async ({ run, cmd }) => {
    res.hlod = await run('const L = WORLD.premises.hlod; return { near: L.near, gain: L.gain, gainItem: L.gainItem, proj: L.proj };');
    console.log('far hlod ' + JSON.stringify(res.hlod));
    for (const gI of GAINS) {
      await run(`const L = WORLD.premises.hlod; L.gainItem = ${gI}; for (const cl of L.cellMap.values()) cl.sig = ''; return 1;`);
      await sleep(5000);                                   // the far cells rebuilt (the scan's own pace)
      for (const h of (Array.isArray(list) ? list : [])) {
        if (h.dir === undefined) continue;
        const r = await run(AIM(h, h.dir)); if (!r || typeof r !== 'object') continue;
        await sleep(800); const img = await shot(cmd);
        (res.far[h.id] = res.far[h.id] || {})[gI] = { box: r, luma: lumaOf(img, r) };
        console.log('far ' + h.id + ' gainItem ' + gI + ' ' + JSON.stringify(res.far[h.id][gI])); save();
      }
    }
  });
  for (const id of Object.keys(res.near)) {
    const n = res.near[id].luma, f = res.far[id] || {};
    const best = Object.keys(f).map(Number).sort((a, b) => Math.abs(f[a].luma - n) - Math.abs(f[b].luma - n))[0];
    res.pick[id] = { near: n, far: Object.fromEntries(Object.keys(f).map(g => [g, f[g].luma])), nearest: best };
  }
  console.log('FAR_HANGAR ' + JSON.stringify(res.pick)); save();
  process.exit(0);
})().catch(e => { console.log('FATAL ' + e.stack); process.exit(1); });
