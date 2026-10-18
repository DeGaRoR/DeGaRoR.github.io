#!/usr/bin/env node
// terrain_still.js - THE WHEELS AND THE GROUND, PICTURED (G2115, TERRAIN-MATCH): before / after stills for A0's box.
//
// The cloud renders no world (SwiftShader fails on its draws), so this rig is for the GPU box. For each PAGE (the base's
// index.html built beside today's as index_before.html, and today's) and each BUILD (the user's Cub -
// builds/cub_2026-09-20_corrected.json -, the Jodel, the metal Cessna, the Cessna on floats) it boots the game with the
// build in flydiy.wip, rolls out, and for each VIEW holds the aeroplane at the place (paused, its wheels on the ground: the
// build's resting CG height over terrainH), sets the orbit, the hour, lets the streamers and the 1 m contact tier land
// (ground_tier.js: it builds in slices once the aeroplane is still) and writes a PNG - name_build_page.png - with the tier's
// state and the drawn-vs-solver under the wheels in stills.json. The views (wheel height, low and close: what the eye
// reads a tyre against):
//   w3_stand      w3's stand, on the patch's grass (the tier's 0.5 m over the 2 m patch; the dead end of r_strip_taxi)
//   mn_stand      mn_strip's stand, the start of mn_stand_lane (G1542's dead end; the cut's bank 12 m off)
//   nv_end60      nv_strip's end + 60 m (the patch's border tucked 0.2-0.7 m there before; the patch now)
//   tw_end30      tw_ski's end + 30 m, down the slope (the far terrain +1 m off the graded ground before)
//   home_apron    HOME's stand on the apron (the pavement at terrainH: no change expected)
//   home_junction the apron's edge on the runway (an apron's rim lifted 5-7 cm over the runway before: liftOver)
//   sea           floats only: SEA's water (no ground: the control)
//
//   git show origin/master:flyDiy/index.html > flyDiy/index_before.html      (the base, train 37b - or train 38 when live)
//   node tools/build.js && node tools/terrain_still.js [--pages index_before.html,index.html] [--builds cub,jodel,cessna,floats]
//        [--views w3_stand,...] [--size 1600x900] [--out reports/evidence/TERRAIN-MATCH] [--fallback <repo>] [--q 'raster=1']
// A MEASUREMENT, not a gate (a GPU and a browser). Announce it: the GPU is shared (tools/perf/GPU_BENCH.lock).
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..');
const PAGES = opt('pages', 'index_before.html,index.html').split(',');
const BUILDS = { cub: 'builds/cub_2026-09-20_corrected.json', jodel: 'builds/jodel_2026-09-20_corrected.json', cessna: 'bugReports/cessnaMetal (1).json', floats: 'bugReports/cessnaFloatsWOrks.json' };
const BUILD_KEYS = opt('builds', 'cub,jodel,cessna,floats').split(',');
// the resting CG over terrainH (G1540's: the Cub 1.095, the Jodel 1.016, the metal Cessna 1.100; the floats on the water 1.0)
const REST = { cub: 1.095, jodel: 1.016, cessna: 1.100, floats: 1.0 };
const C = (() => { try { return require(path.join(__dirname, 'flight_core.js')); } catch (e) { return null; } })();
const site = id => (C && C.siteOf(id)) || null;
const strip = id => { try { const W = require(path.join(__dirname, 'island_node.js')).islandWorld('jolene', { premises: fs.readFileSync(path.join(__dirname, 'fixtures', 'island_jolene.json'), 'utf8') }); return W.aerodromes.find(a => a.id === id); } catch (e) { return null; } };
const past = (id, d) => { const a = strip(id); if (!a) return null; const u = a.len / 2 + d; return [a.x + Math.cos(a.hdg) * u, a.z + Math.sin(a.hdg) * u]; };
// [x, z] (the CG's place) | 'stand' (the build's own stand at HOME); cam [az, el, dist] (FLIGHT_PROBE.camSet: the orbit)
const VIEWS = {
  w3_stand:      { at: () => { const s = site('w3'); return s ? [s.stand.x, s.stand.z] : null; }, cams: [[1.57, 0.03, 4.5], [-1.57, 0.03, 4.5], [3.14, 0.035, 3.2]], land: true },
  mn_stand:      { at: () => { const s = site('mn_strip'); return s ? [s.stand.x + 4.37, s.stand.z - 1.11] : null; }, cams: [[1.57, 0.03, 4.5], [-1.57, 0.03, 4.5], [-2.4, 0.12, 9]], land: true },
  nv_end60:      { at: () => past('nv_strip', 60), cams: [[1.57, 0.03, 4.5], [-2.4, 0.08, 9]], land: true },
  tw_end30:      { at: () => past('tw_ski', 30), cams: [[1.57, 0.03, 4.5], [0.6, 0.06, 8]], land: true },
  home_apron:    { at: 'stand', cams: [[3.14, 0.035, 3.2], [1.57, 0.03, 4.5]], land: true },
  home_junction: { at: () => [-138, 664], cams: [[1.57, 0.03, 4.5], [-1.57, 0.03, 4.5]], land: true },
  sea:           { at: () => [361, -3500], cams: [[1.57, 0.04, 6]], water: true },
};
const VIEW_KEYS = opt('views', Object.keys(VIEWS).join(',')).split(',');
const SIZE = opt('size', '1600x900').split('x').map(Number);
const SPORT = +opt('port', 8543);
const OUT = path.resolve(ROOT, opt('out', 'reports/evidence/TERRAIN-MATCH'));
const Q = opt('q', '');
const FALLBACK = opt('fallback', null);
const REPO = path.resolve(ROOT, '..');
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
const srvArgs = [path.join(__dirname, '_serve.js'), String(SPORT), REPO]; if (FALLBACK) srvArgs.push('--fallback', FALLBACK);
const server = spawn(process.execPath, srvArgs, { stdio: 'ignore' });

// the hold: paused, the CG `agl` over the ground at (x, z) (or where the roll-out left it), the velocities nil
const HOLD = (at, agl) => `(async () => {
  const b = document.getElementById('bPause'); if (b && /pause/i.test(b.textContent)) b.click();
  const s = FLIGHT_PROBE.sim(), w = FLIGHT_PROBE.world(), at = ${JSON.stringify(at)};
  if (Array.isArray(at)) { const cg = s.cgPos(), gy = Math.max(w.terrainH(at[0], at[1]), w.waterH ? (w.waterH(at[0], at[1]) || -1e9) : -1e9) + ${agl};
    await FLIGHT_PROBE.place({ by: [at[0] - cg[0], gy - cg[1], at[1] - cg[2]], zeroV: true }); }
  return JSON.stringify(s.cgPos().map(v => Math.round(v * 10) / 10)); })()`;
// what the page draws there: the tier's state, and under each wheel the drawn ground the rig can read (the tier's own
// heights where it stands) against terrainH
const REPORT = `(() => { const G = FLIGHT_PROBE.world(), WF = window.WORLD_FX || null; let t = null;
  try { const T = (window.FLYDIY_WF && FLYDIY_WF.ground && FLYDIY_WF.ground.tier) ? FLYDIY_WF.ground.tier() : null;
    if (T) t = { mode: T.mode, centre: T.centre, visible: !!(T.mesh && T.mesh.visible), builds: T.stats.builds, ms: Math.round(T.stats.ms) }; } catch (e) { t = { err: String(e) }; }
  const s = FLIGHT_PROBE.sim(), cg = s.cgPos(); return JSON.stringify({ tier: t, cg: cg.map(v => Math.round(v * 100) / 100), ground: Math.round(G.terrainH(cg[0], cg[2]) * 1000) / 1000 }); })()`;
const FRAMES = n => `new Promise(r => { let k = 0; const f = () => { if (++k >= ${n}) r(k); else requestAnimationFrame(f); }; requestAnimationFrame(f); })`;

async function runPage(page, bk) {
  const port = 9640 + (process.pid % 200) + PAGES.indexOf(page);
  const udd = path.join(os.tmpdir(), 'cdp_tm_' + port + '_' + Date.now());
  const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + port, '--window-size=' + SIZE[0] + ',' + SIZE[1], '--hide-scrollbars', '--no-first-run',
    '--user-data-dir=' + udd, '--disable-gpu-sandbox', '--disable-frame-rate-limit', '--disable-gpu-vsync', 'about:blank'], { stdio: 'ignore' });
  const kill = () => { try { if (process.platform === 'win32') execSync('taskkill /PID ' + ch.pid + ' /T /F', { stdio: 'ignore' }); else ch.kill(); } catch (e) {} };
  const out = [];
  try {
    let tgt = null;
    for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + port + '/json')).find(t => t.type === 'page'); } catch (e) {} }
    if (!tgt) throw new Error('no page target');
    const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
    let id = 0; const waits = new Map();
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); } };
    const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); const d = r.result;
      if (!d || d.exceptionDetails) throw new Error('page: ' + (d && d.exceptionDetails ? (d.exceptionDetails.exception && d.exceptionDetails.exception.description || d.exceptionDetails.text) : JSON.stringify(r))); return d.result.value; };
    await cmd('Page.enable'); await cmd('Runtime.enable');
    const wip = fs.readFileSync(path.join(ROOT, BUILDS[bk]), 'utf8');
    await cmd('Page.addScriptToEvaluateOnNewDocument', { source: 'try{if(!sessionStorage.getItem("__tm")){sessionStorage.setItem("__tm","1");localStorage.removeItem("flydiy.gfx");localStorage.removeItem("flydiy.premises.game.jolene");localStorage.setItem("flydiy.wip",' + JSON.stringify(wip) + ');}}catch(e){}' });
    await cmd('Emulation.setDeviceMetricsOverride', { width: SIZE[0], height: SIZE[1], deviceScaleFactor: 1, mobile: false });
    await cmd('Page.navigate', { url: 'http://localhost:' + SPORT + '/flyDiy/' + page + (Q ? '?' + Q : '') });
    await sleep(1500);
    try { await ev("Promise.race([(window.BOOT && BOOT.whenReady) ? BOOT.whenReady().then(() => 'ready') : new Promise(r => setTimeout(() => r('no BOOT'), 18500)), new Promise(r => setTimeout(() => r('timeout'), 150000))])"); } catch (e) {}
    let flying = false;
    for (let a = 0; a < 8 && !flying; a++) { await ev("(()=>{const b=document.getElementById('bGo'); if (b) b.click();})()"); await sleep(6000); flying = await ev("/TAXI|DOWNWIND|FINAL|DEPART|HOLD|PARK/.test(document.body.innerText)"); }
    for (let i = 0; i < 150; i++) { const bs = await ev("window.BOOT ? BOOT.state : 'none'"); if (bs === 'gone' || bs === 'none') break; await sleep(1000); }
    const KEEP = "(()=>{const l=[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0&&b.offsetParent);l.forEach(x=>x.click());return l.length;})()";
    for (let i = 0; i < 20; i++) { const n = await ev(KEEP); await sleep(500); if (!n && i > 4) break; }
    await sleep(3000);
    const tag = path.basename(page, '.html');
    for (const vk of VIEW_KEYS) {
      const V = VIEWS[vk]; if (!V) continue;
      if (V.water !== (bk === 'floats') && !(V.land && bk !== 'floats')) continue;   // the floats on the water, the wheels on the land
      const at = typeof V.at === 'function' ? V.at() : V.at; if (!at) { console.log('  ' + vk + ': no place (flight_core / the island not found)'); continue; }
      const where = await ev(HOLD(at, REST[bk] || 1.1));
      await ev(`(() => { if (window.DAY_CLOCK && DAY_CLOCK.preset) DAY_CLOCK.preset('noon'); return 1; })()`);
      for (let k = 0; k < V.cams.length; k++) {
        const cam = V.cams[k];
        await ev(`FLIGHT_PROBE.camSet(${cam.join(',')})`);
        await ev(FRAMES(k ? 90 : 360));   // the streamers, the fine tiles, the tier's slices
        await ev(`FLIGHT_PROBE.camSet(${cam.join(',')})`); await ev(FRAMES(8));
        const png = await cmd('Page.captureScreenshot', { format: 'png' });
        fs.mkdirSync(OUT, { recursive: true });
        const file = path.join(OUT, vk + '_' + k + '_' + bk + '_' + tag + '.png');
        fs.writeFileSync(file, Buffer.from(png.result.data, 'base64'));
        let info = ''; try { info = await ev(REPORT); } catch (e) { info = String(e.message); }
        console.log('  ' + vk + ' cam ' + k + ' ' + bk + ' @' + where + ' -> ' + path.relative(process.cwd(), file) + '  ' + info);
        out.push({ page, build: bk, view: vk, cam, where, file: path.relative(ROOT, file), info });
      }
    }
    try { await cmd('Browser.close'); } catch (e) {}
  } finally { await sleep(500); kill(); }
  return out;
}

(async () => {
  await sleep(800);
  const all = [];
  for (const p of PAGES) for (const b of BUILD_KEYS) { console.log('terrain_still: ' + p + ' ' + b); try { all.push(...await runPage(p, b)); } catch (e) { console.log('  FAILED: ' + e.message); } }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'stills.json'), JSON.stringify(all, null, 1));
  server.kill();
  process.exit(0);
})().catch(e => { console.error(e); server.kill(); process.exit(1); });
