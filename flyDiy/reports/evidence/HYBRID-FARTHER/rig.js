#!/usr/bin/env node
// HYBRID-FARTHER's rig (G1325, 2026-10-03): headless Chromium + SwiftShader, dev.html, one build rolled out, then
// (1) the stand and the chase: draws (main pass), the flown model's live meshes shown, FB.hyMag / hyT;
// (2) the orbit from the chase's side at the distance where mag = each given px-a-texel, the bake (t 0) and the live
//     (t 1) shot in the same held frame -> <out>/<tag>_<mag>_<bake|live>.png, + <tag>.json
// Usage: node rig.js <port> <outDir> <tag> <build json | default> [mags=1.0,1.6] [query]
'use strict';
const fs = require('fs'), path = require('path');
const [PORT, OUT, TAG, BUILD] = process.argv.slice(2);
const MAGS = (process.argv[6] || '1.0,1.6').split(',').map(Number), Q = process.argv[7] || '';
const ROOT = path.resolve(__dirname, '../../../..');
let pw; try { pw = require('playwright'); } catch (e) { pw = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright')); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--max-old-space-size=8192', '--disable-blink-features=AutomationControlled'] });
  // the page's rig clock (PACE.legacy) keys on navigator.webdriver / HeadlessChrome: off, so the game runs its own realtime loop as on the box
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, userAgent: (await browser.newBrowserCDPSession().then(c => c.send('Browser.getVersion'))).userAgent.replace('HeadlessChrome', 'Chrome') });
  const pre = ['try{for(const k of Object.keys(localStorage)) if(/^flydiy\\./.test(k)) localStorage.removeItem(k);}catch(e){}'];
  if (BUILD !== 'default') pre.push('try{localStorage.setItem("flydiy.wip",' + JSON.stringify(fs.readFileSync(path.resolve(ROOT, 'flyDiy', BUILD), 'utf8')) + ')}catch(e){}');
  await page.addInitScript(pre.join('\n'));
  const logs = []; page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  const ev = async x => { try { return await page.evaluate(x); } catch (e) { return 'ERR ' + e.message.split('\n')[0]; } };
  const frames = n => ev(`new Promise(r => { let k = ${n}; const f = () => (--k > 0 ? requestAnimationFrame(f) : r(1)); requestAnimationFrame(f); })`);
  const t0 = Date.now(), el = () => Math.round((Date.now() - t0) / 1000) + ' s';
  await page.goto('http://localhost:' + PORT + '/flyDiy/dev.html' + (Q ? '?' + Q : ''), { waitUntil: 'load', timeout: 300000 });
  for (let i = 0; i < 300; i++) {
    await sleep(2000);
    if (await ev("!!(window.BOOT && BOOT.state === 'gone' && document.getElementById('bGo') && !document.getElementById('bGo').disabled)")) break;
    await ev("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click()); return 1;})()");
  }
  console.log('garage', el());
  await ev("document.getElementById('bGo').click()");
  for (let i = 0; i < 600; i++) {
    await sleep(2000);
    const s = await ev("[window.BOOT && BOOT.state, ((document.getElementById('bGo')||{}).textContent||'').trim(), !!(window.FLIGHT_PROBE && FLIGHT_PROBE.model()), !!(window.FLOWN_BAKE && FLOWN_BAKE.FB.last), window.FLOWN_BAKE ? FLOWN_BAKE.folds().length : -1].join('|')");
    if (/^gone\|[^|]*\|true\|true\|[1-9]/.test(s)) break;
    if (process.env.PROBE && fs.existsSync(process.env.PROBE)) { console.log('  probe', JSON.stringify(await ev(fs.readFileSync(process.env.PROBE, 'utf8')))); fs.unlinkSync(process.env.PROBE); }
    if (i % 15 === 0) console.log('  roll-out', el(), s,JSON.stringify(await ev("({ fp: typeof window.FLIGHT_PROBE, m: window.FLIGHT_PROBE ? String(FLIGHT_PROBE.model && FLIGHT_PROBE.model()) : '-', trips: (window.FLYDIY_TRIPS||[]).slice(-1).map(t => ({ kind: t.kind, done: t.done, ran: t.steps && t.steps.filter(s => s.ran).map(s => s.id) })) })")), logs.slice(-3));
  }
  await frames(30); await sleep(1500);
  const info = { tag: TAG, build: BUILD, hy: await ev('({ A: FLOWN_BAKE.FB.hyA, B: FLOWN_BAKE.FB.hyB, cm: FLOWN_BAKE.FB.last && FLOWN_BAKE.FB.last.cm })'), shots: [] };
  console.log('rolled out', el(), JSON.stringify(info.hy));
  // the counts: draws in the main pass, the flown model's meshes drawn (visible, in the graph), its live ones
  const census = `(() => { const R = FLIGHT_PROBE.renderer(), FB = FLOWN_BAKE.FB, m = FLIGHT_PROBE.model(), v = new THREE.Vector2(); R.getDrawingBufferSize(v);
    let shown = 0, live = 0, fold = 0; m.grp.traverseVisible(o => { if (!o.isMesh) return; shown++; const u = o.material && o.material.userData || {}; if (u.flownLive) live++; if (u.flownBaked) fold++; });
    return { calls: R.info.render.calls, tris: R.info.render.triangles, shown, live, fold, mag: FB.hyMag == null ? null : +FB.hyMag.toFixed(3), t: FB.hyT, H: v.y, fov: FLIGHT_PROBE.camera().fov, cam: FLIGHT_PROBE.cam() }; })()`;
  const R0 = await ev('(() => { const R = FLIGHT_PROBE.renderer(); R.info.autoReset = true; return 1; })()');
  // both rules on the same page: OLD (1.6 -> 2.0 px a texel, train 26) and NEW (G1325: 1.0 -> 1.25)
  const RULES = { old: [1.6, 2.0], new: [1.0, 1.25] };
  const both = async () => { const o = {}; for (const [k, [a, b]] of Object.entries(RULES)) { await ev(`(FLOWN_BAKE.FB.hyA = ${a}, FLOWN_BAKE.FB.hyB = ${b})`); await frames(12); o[k] = await ev(census); } return o; };
  info.stand = await both();
  console.log('stand', JSON.stringify(info.stand));
  await ev("FLIGHT_PROBE.camMode('chase')"); await frames(40); await sleep(500); info.chase = await both();
  await page.screenshot({ path: path.join(OUT, TAG + '_chase.png') });
  console.log('chase', JSON.stringify(info.chase));
  // hold the sim and hide the UI for the stills
  await ev("(() => { if (!window.FLYDIY_HELD) document.getElementById('bPause').click(); const c = document.getElementById('c'); document.querySelectorAll('body *').forEach(e => { if (e !== c && !e.contains(c)) e.style.visibility = 'hidden'; }); return 1; })()");
  await frames(6);
  // the chase's own direction, as an orbit: az/el from the chase cam, the distance solved for each magnification
  const ch = info.chase.new.cam || {};
  const az = ch.az != null ? ch.az : 1.45, elv = 0.15;
  await ev("FLIGHT_PROBE.camMode('orbit')"); await frames(4);
  for (const mag of MAGS) {
    // mag = cm/100 / (2 d tan(fov/2) / H)  ->  d = cm/100 * H / (2 tan(fov/2) mag)
    const cm = info.hy.cm, H = info.chase.new.H, fov = info.chase.new.fov;
    const d = cm / 100 * H / (2 * Math.tan(fov * Math.PI / 360) * mag);
    await ev(`FLIGHT_PROBE.camSet(${az}, ${elv}, ${d})`); await frames(20);
    for (const [k, t] of [['bake', 0], ['live', 1]]) {
      await ev(`FLOWN_BAKE.FB.hyForce = ${t}`); await frames(6); await sleep(200);
      const st = await ev(census);
      const f = path.join(OUT, TAG + '_' + mag.toFixed(2) + '_' + k + '.png');
      await page.screenshot({ path: f });
      info.shots.push({ mag, d: +d.toFixed(2), k, f: path.basename(f), forced: st });
      console.log('  ' + mag + ' px/texel d ' + d.toFixed(2) + ' m ' + k + ' calls ' + st.calls + ' live ' + st.live);
    }
    await ev(`FLOWN_BAKE.FB.hyForce = null`);
    const r = await both(); info.shots.push({ mag, d: +d.toFixed(2), rule: r });
    console.log('  ' + mag + ' rule old t ' + r.old.t + ' live ' + r.old.live + ' calls ' + r.old.calls + ' | new t ' + r.new.t + ' live ' + r.new.live + ' calls ' + r.new.calls + ' (mag ' + r.new.mag + ')');
  }
  info.logs = logs.slice(0, 20);
  fs.writeFileSync(path.join(OUT, TAG + '.json'), JSON.stringify(info, null, 1));
  console.log('done', el());
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
