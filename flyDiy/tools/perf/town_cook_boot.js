// town_cook_boot.js - TOWN-COOK (G1432): A HEADLESS BOOT'S LAZY RASTER BAKES (the cloud's Chromium + SwiftShader: the boot to
// the garage runs, the world does not draw - counts, not times). Loads <repoRoot>/flyDiy/index.html?town=0|1 on a fresh
// profile, waits for the garage (BOOT.whenReady) + settleS, and sums the lazy bakes over EVERY premises overlay the page
// made (a composition is a new overlay with its own counters; a 20 ms poller keeps a reference to each), with the raster
// cells' responses and bytes on the wire (the page, the physics worker and the house worker each fetch).
//   node tools/perf/town_cook_boot.js <repoRoot> <port> <town 0|1> [settleS]     (built pages: node tools/build.js first)
// tools/perf/town_cook_boot1.json: the four runs of G1432 (before = a worktree of claude/metla-load-g1405, built).
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const [root, port, town, settle] = [process.argv[2], +process.argv[3], process.argv[4], +(process.argv[5] || 30)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const srv = spawn(process.execPath, [path.join(root, 'flyDiy', 'tools', '_serve.js'), String(port), root], { stdio: 'ignore' });
  await sleep(1200);
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }).catch(async () => chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }));
  const ctx = await br.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const net = { r: 0, rBytes: 0, all: 0 };
  page.on('response', async res => { try { const u = res.url(); if (!/\/premises\/r_/.test(u)) return; const b = await res.body(); net.r++; net.rBytes += b.length; } catch (e) {} });
  const exc = []; page.on('pageerror', e => exc.push(String(e && e.message)));
  await page.addInitScript(() => {
    try { localStorage.removeItem('flydiy.gfx'); localStorage.removeItem('flydiy.wip'); } catch (e) {}
    window.__ovs = [];
    const poll = () => { try { const W = window.FLIGHT_PROBE && FLIGHT_PROBE.world ? FLIGHT_PROBE.world() : window.WORLD; const O = W && W.premises && W.premises.overlay; if (O && window.__ovs.indexOf(O) < 0) window.__ovs.push(O); } catch (e) {} };
    setInterval(poll, 20);
    // also catch the first world the moment world_boot makes it
    let made; Object.defineProperty(window, 'FLYDIY_WORLD_MADE', { configurable: true, get: () => made, set: v => { made = v; try { const O = v && (v.world || v).premises && (v.world || v).premises.overlay; if (O && window.__ovs.indexOf(O) < 0) window.__ovs.push(O); } catch (e) {} } });
  });
  const t0 = Date.now();
  await page.goto('http://127.0.0.1:' + port + '/flyDiy/index.html?town=' + town, { timeout: 600000 });
  const st = await page.evaluate(() => Promise.race([(window.BOOT && BOOT.whenReady) ? BOOT.whenReady().then(() => 'ready') : new Promise(r => setTimeout(() => r('no BOOT'), 60000)), new Promise(r => setTimeout(() => r('boot timeout'), 900000))]));
  const garageS = (Date.now() - t0) / 1000;
  const snap = () => page.evaluate(() => {
    const L = window.__ovs.map(O => { const x = O.raster || {}; return { baked: x.baked | 0, bakeMs: Math.round(x.bakeMs || 0), decoded: x.decoded | 0, cooked: O.rasterCooked || null }; });
    const pc = window.ISLAND_BOOT && ISLAND_BOOT.premCook;
    return { variant: window.FLYDIY_TOWN_VARIANT || null, townAll: window.FLYDIY_TOWN ? !!FLYDIY_TOWN.all : null, fetchedCells: pc && pc.raster ? pc.raster.length : 0, overlays: L,
      baked: L.reduce((s, o) => s + o.baked, 0), bakeMs: L.reduce((s, o) => s + o.bakeMs, 0) };
  });
  const atGarage = await snap();
  await sleep(settle * 1000);
  const after = await snap();
  console.log(JSON.stringify({ root, town, state: st, garageS, net, atGarage, after, exceptions: exc.length, exc: exc.slice(0, 3) }));
  await br.close(); srv.kill(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
