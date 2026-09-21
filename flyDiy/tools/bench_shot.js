#!/usr/bin/env node
// bench_shot.js - THE ENGINEERING BENCH, DRIVEN AND PHOTOGRAPHED (A9, 2026-09-21)
//
//   node tools/bench_shot.js --url http://localhost:8346/flyDiy/dev.html --stock "jodel" \
//        --out screenshots/bench-2026-09-21 [--steps load,shake,dalt,xwind,flight,keep,master] [--log]
//
// garage_shot.js's rig (headless Chrome on this machine's GPU, the page's
// own buttons pressed through CDP), pointed at the bench: the named stock
// design loaded, then each card run THROUGH ITS OWN BUTTON and read back
// off BENCH_STATE() — the load test with the aeroplane on its back over the
// trestles (which thread stepped it, the longest task the page saw while it
// ran, the award card with the advisor's lines), the crosswind ladder's
// rungs as they land, the test flight as a real roll-out (the director's
// cuts, the arrival, the award), the master roundel on the nose, and the
// certificate's word: the envelope exported and loaded back keeps every
// certificate; a light switched on keeps them; a span moved withdraws them.
// Written because the Browser pane has no WebGL and a bench is a thing you
// have to watch.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL = opt('url', 'http://localhost:8346/flyDiy/dev.html');
const STOCK = opt('stock', 'jodel');
const OUT = opt('out', 'screenshots/bench-shot');
const STEPS = opt('steps', 'load,shake,dalt,xwind,flight,keep,master').split(',');
const WAIT = +opt('wait', 15000);
const FLIGHT_MAX = +opt('flightmax', 1500000);
const RATE = +opt('rate', 2);
const WIDE = +opt('wide', 1920);         // a wider window: the canvas grows, the panels do not        // the test flight's clock (the 2x row), for a headless frame that costs more than a frame
const PORT = 9400 + (process.pid % 500);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('bench_shot: no Chrome'); process.exit(2); }
const udd = path.join(require('os').tmpdir(), 'cdp_shot_' + PORT + '_' + Date.now());
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--window-size=1920,1080', '--hide-scrollbars',
  '--no-first-run', '--user-data-dir=' + udd, '--disable-gpu-sandbox', '--disable-frame-rate-limit', '--disable-gpu-vsync', 'about:blank'], { stdio: 'ignore' });
const killChrome = () => { try { if (process.platform === 'win32') require('child_process').execSync('taskkill /PID ' + ch.pid + ' /T /F', { stdio: 'ignore' }); else ch.kill(); } catch (e) { try { ch.kill(); } catch (e2) {} } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
const say = s => console.log('bench_shot: ' + s);
(async () => {
  let tgt = null;
  for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  if (!tgt) throw new Error('no page');
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map();
  const LOG = argv.includes('--log');
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') console.error('page exception: ' + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).split(String.fromCharCode(10)).slice(0, 3).join(' | '));
    if (LOG && m.method === 'Runtime.consoleAPICalled') console.log('page ' + m.params.type + ': ' + m.params.args.map(a => a.value !== undefined ? a.value : a.description).join(' ').slice(0, 1200)); };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (!r.result || r.result.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.result && r.result.exceptionDetails && (r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description || r.result.exceptionDetails.text))); return r.result.result.value; };
  const shot = async (name, clip) => { const s = await cmd('Page.captureScreenshot', Object.assign({ format: 'png' }, clip ? { clip: Object.assign({ scale: 1 }, clip) } : {}));
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    const f = OUT + '_' + name + '.png'; fs.writeFileSync(f, Buffer.from(s.result.data, 'base64')); say('wrote ' + f); };
  const state = async () => JSON.parse(await ev("JSON.stringify((()=>{const s=window.BENCH_STATE();const r={};for(const k in s.results){const x=s.results[k];r[k]={ok:x.ok,stale:x.stale,running:x.running,verdict:x.verdict,when:x.when,fp:x.fp,fps:x.fps,why:x.why,warn:x.warn,note:x.note,advice:x.advice,rungs:x.rungs,trim:x.trim}}return {passed:s.passed,certs:s.certs,stale:s.stale,results:r}})())"));
  const press = async tid => ev("(()=>{const b=document.querySelector('#bTests button[data-t=\"" + tid + "\"]');if(!b||b.disabled)return false;b.click();return true})()");
  const until = async (expr, ms, step) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(expr)) return true; await sleep(step || 500); } return false; };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  // the longest task the page sees, from before the boot: PerformanceObserver on longtask
  await cmd('Page.addScriptToEvaluateOnNewDocument', { source: "window.__longest=0;window.__longN=0;window.__gapT=0;setInterval(()=>{const t=performance.now();if(window.__gapT){const g=t-window.__gapT-20;if(g>50)window.__longN++;if(g>window.__longest)window.__longest=g;}window.__gapT=t;},20);" });
  await cmd('Emulation.setDeviceMetricsOverride', { width: WIDE, height: 1080, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: URL });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) { await sleep(1000); up = await ev("!!(document.getElementById('gLoad') && window.CAGE_UI && window.CAGE_ENERGY && window.BENCH_STATE)"); }
  if (!up) throw new Error('the garage never came up');
  await sleep(3000);
  if (STOCK && STOCK !== 'none') {
    const rows = await ev("(async()=>{const u=[...document.querySelectorAll('button')].find(b=>/unsaved/i.test(b.textContent));if(u)u.click();await new Promise(r=>setTimeout(r,500));document.getElementById('gLoad').click();await new Promise(r=>setTimeout(r,800));const f=document.getElementById('gFleet');return f?[...f.querySelectorAll('.gfStock button')].map(b=>b.textContent.trim()):null})()");
    if (!rows) throw new Error('the shelf did not open');
    say('stock rows ' + JSON.stringify(rows));
    const loaded = await ev("(()=>{const f=document.getElementById('gFleet');const b=[...f.querySelectorAll('.gfStock button')].find(x=>x.textContent.trim().toLowerCase().startsWith('" + STOCK.toLowerCase() + "'));if(!b)return false;b.click();return true;})()");
    if (!loaded) throw new Error('no stock row ' + STOCK);
    await sleep(WAIT);
  }
  await ev("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click());return 1})()");
  await sleep(1500);
  // the bench tab up
  await ev("(()=>{const t=document.getElementById('tabBench');if(t)t.click();return 1})()");
  await sleep(800);
  say('loaded ' + await ev("JSON.stringify((()=>{const s=window.GARAGE_SPEC.get();return {name:s.meta&&s.meta.name,reg:s.meta&&s.meta.reg,span:s.wings[0].span,mat:s.wings[0].material,brace:s.bracing&&s.bracing.type,fus:s.fuselage.material}})())"));
  const cam = async (a, e, d) => { await ev("FLIGHT_PROBE.camSet(" + a + "," + e + "," + d + "), 1"); await sleep(800); };

  if (STEPS.includes('load')) {
    await ev("window.__longest=0;window.__longN=0;1");
    if (!await press('load')) throw new Error('no load button');
    // the aeroplane on its back: a shot early in the ramp, one at ultimate
    await until("(()=>{const s=window.BENCH_STATE().results.load;return !!(s&&s.running&&/g/.test(s.running))})()", 20000, 200);
    await sleep(1200);
    const mid = await ev("JSON.stringify((()=>{const st=window.BENCH_STATE().results.load;const ls=(window.FLIGHT_PROBE&&window.FLIGHT_PROBE.sim)?window.FLIGHT_PROBE.sim():null;let lo=1e9;if(ls)for(let i=1;i<ls.p.length;i+=3)lo=Math.min(lo,ls.p[i]);return {running:st&&st.running,lo:lo}})())");
    say('mid-test ' + mid);
    await cam(0.7, 0.05, 13); await shot('load_ramp');
    // the main thread WHILE THE BAGS GO ON (the counter reset once the ramp
    // began; read while the row still runs — the way back to the shed after
    // the verdict is enterGarage's synchronous rebuild, A2's item 31, not
    // the rig's)
    await ev("window.__longest=0;window.__longN=0;1");
    let perfRamp = null;
    const t0 = Date.now();
    while (Date.now() - t0 < 120000) {
      const r = JSON.parse(await ev("JSON.stringify((()=>{const s=window.BENCH_STATE().results.load;return {running:!!(s&&s.running),longest:window.__longest,n:window.__longN}})())"));
      if (!r.running) break;
      perfRamp = { longest: r.longest, n: r.n };
      await sleep(100);
    }
    const done = await until("(()=>{const s=window.BENCH_STATE().results.load;return !!(s&&!s.running)})()", 120000, 300);
    if (!done) throw new Error('the load test never settled');
    await shot('load_award');
    const perf = JSON.stringify({ ramp: perfRamp, whole: JSON.parse(await ev("JSON.stringify({longest:window.__longest,n:window.__longN})")) });
    const st = await state();
    say('load ' + JSON.stringify(st.results.load) + ' longtask ' + perf);
    // the advisor, if it runs, lands on the card; wait for it
    if (st.results.load && st.results.load.advice) {
      const adv = await until("(()=>{const s=window.BENCH_STATE().results.load;return !!(s&&s.advice&&s.advice.done)})()", 180000, 1000);
      say('advice done ' + adv + ' ' + JSON.stringify((await state()).results.load.advice));
      await shot('load_advice');
    }
    await ev("(()=>{const a=document.getElementById('bAward');if(a&&!a.hidden)a.click();return 1})()");
    await sleep(1500);
  }
  for (const tid of ['shake', 'dalt']) {
    if (!STEPS.includes(tid)) continue;
    if (!await press(tid)) throw new Error('no ' + tid + ' button');
    const done = await until("(()=>{const s=window.BENCH_STATE().results." + tid + ";return !!(s&&!s.running)})()", 120000, 300);
    say(tid + ' ' + (done ? JSON.stringify((await state()).results[tid]) : 'never settled'));
    await ev("(()=>{const a=document.getElementById('bAward');if(a&&!a.hidden)a.click();return 1})()");
    await sleep(800);
  }
  if (STEPS.includes('xwind')) {
    await ev("window.__longest=0;window.__longN=0;1");
    if (!await press('xwind')) throw new Error('no xwind button');
    await until("(()=>{const n=document.querySelector('#bRun .bRnotes');return !!(n&&n.children.length>=2)})()", 240000, 500);
    await shot('xwind_rungs');
    const done = await until("(()=>{const s=window.BENCH_STATE().results.xwind;return !!(s&&!s.running)})()", 400000, 500);
    const perf = await ev("JSON.stringify({longest:window.__longest,n:window.__longN})");
    say('xwind ' + (done ? JSON.stringify((await state()).results.xwind) : 'never settled') + ' longtask ' + perf);
    await shot('xwind_award');
    await ev("(()=>{const a=document.getElementById('bAward');if(a&&!a.hidden)a.click();return 1})()");
    await sleep(800);
  }
  if (STEPS.includes('flight')) {
    if (!await press('flight')) throw new Error('no flight button');
    const out = await until("!window.GARAGE_BRIDGE_IN_GARAGE && /TAXI|LINEUP|ROLL|CLIMB/.test(document.body.innerText)", 90000, 1000);
    say('rolled out ' + out + ' armed ' + await ev("JSON.stringify(window.TEST_FLIGHT&&window.TEST_FLIGHT.armed())"));
    await ev("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click());return 1})()");
    say('clock x' + await ev("window.TEST_FLIGHT.rate(" + RATE + ")"));
    // the phases as they come, the director's cuts with them
    const seen = [];
    const t0 = Date.now();
    let arrived = false;
    while (Date.now() - t0 < FLIGHT_MAX) {
      const p = await ev("JSON.stringify({ph:(document.getElementById('phName')||{}).textContent,cam:window.FLIGHT_PROBE?window.FLIGHT_PROBE.cam():null,mode:(window.FLIGHT_PROBE&&window.FLIGHT_PROBE.camModeNow)?window.FLIGHT_PROBE.camModeNow():null,armed:!!(window.TEST_FLIGHT&&window.TEST_FLIGHT.armed()),dir:!!(window.TEST_FLIGHT&&window.TEST_FLIGHT.director.on)})");
      const P = JSON.parse(p);
      const key = P.ph + '|' + P.dir;
      if (!seen.length || seen[seen.length - 1].key !== key) {
        seen.push({ key, t: Math.round((Date.now() - t0) / 1000) });
        say('t=' + seen[seen.length - 1].t + 's ' + P.ph + ' cam ' + P.mode + ' director ' + P.dir + ' armed ' + P.armed);
        if (/CLIMB|DOWNWIND|FINAL|FLARE/.test(P.ph)) await shot('flight_' + P.ph.toLowerCase().replace(/[^a-z]+/g, '_'));
      }
      const s = await state();
      if (s.results.flight && !s.results.flight.running) { arrived = true; break; }
      await sleep(1500);
    }
    const s = await state();
    say('flight ' + (arrived ? JSON.stringify(s.results.flight) : 'no arrival in ' + FLIGHT_MAX + ' ms') + ' passed ' + s.passed);
    await shot('flight_award');
    await ev("(()=>{const a=document.getElementById('bAward');if(a&&!a.hidden)a.click();return 1})()");
    await sleep(1200);
    await shot('flight_award2');
    await ev("(()=>{const a=document.getElementById('bAward');if(a&&!a.hidden)a.click();return 1})()");
    // back to the shed
    await ev("(()=>{const b=document.getElementById('bHangar2');if(b)b.click();return 1})()");
    await until("!!(document.getElementById('gLoad')&&window.CAGE_UI)", 60000, 1000);
    await sleep(6000);
  }
  if (STEPS.includes('restore')) {
    // A SAVED CERTIFICATE COMES BACK WHOLE: the bench check run for its
    // fingerprint, then an envelope's plaque with the three gating results
    // under that fingerprint handed to BENCH_RESTORE - the master must be
    // on the nose without a flight (what a load of a certified file does)
    if (!await press('shake')) throw new Error('no shake button');
    await until("(()=>{const s=window.BENCH_STATE().results.shake;return !!(s&&!s.running)})()", 120000, 300);
    await ev("(()=>{const a=document.getElementById('bAward');if(a&&!a.hidden)a.click();return 1})()");
    const r = await ev("(()=>{const s=window.BENCH_STATE().results.shake;const R=id=>({ok:true,verdict:'RESTORED',when:'2026-09-21',fp:s.fp,fps:s.fps});window.BENCH_RESTORE({when:'2026-09-21',trimUse:true,results:{shake:R('shake'),load:R('load'),flight:R('flight')}});const t=window.BENCH_STATE();return JSON.stringify({passed:t.passed,certs:t.certs.map(c=>c.id)})})()");
    say('restored: ' + r);
    await sleep(2500);
  }
  if (STEPS.includes('master')) {
    const s = await state();
    say('master: passed ' + s.passed + ' certs ' + JSON.stringify(s.certs));
    say('decals: ' + await ev("JSON.stringify((window.AERO_EXTRA_DECALS(window.THREE, Object.assign({}, window.AEROSKIN && window.AEROSKIN.AERO_DEC_DEF || {})) || []).map(p => ({ page: p.page, w: +p.w.toFixed(3), sL: +p.sL.toFixed(2), sC: +p.sC.toFixed(2), mode: p.mode })))"));
    // a ring of eyes round the aeroplane: whichever side the nose faces, one of them has it
    // the panels folded so the canvas is the window (garage_shot's move), then
    // the front quarters where the nose's flank faces the eye
    await ev("(()=>{for(const b of document.querySelectorAll('button')){if(/^‹(Properties|Parts)$/.test(b.textContent.trim()))b.click();}return 1})()");
    await sleep(1500);
    for (const [i, az] of [1.6, 4.7, 2.4, 3.9].entries()) { await cam(az, 0.06, 6); await shot('master_' + i); }
    await cam(0.85, 0.22, 11); await shot('master_quarter');
  }
  if (STEPS.includes('keep')) {
    // THE WORD: export, load back, the certificates stand; a light on keeps
    // them; a span moved withdraws them
    const before = await state();
    const kept = JSON.parse(await ev("(async()=>{const j=window.GARAGE_SPEC.json();window.GARAGE_SPEC.load(j,'benchShot');await new Promise(r=>setTimeout(r,4000));const s=window.BENCH_STATE();return JSON.stringify({certs:s.certs,stale:s.stale,withdrawn:Object.keys(s.results).filter(k=>s.results[k]&&s.results[k].stale).map(k=>k+':'+s.results[k].why)})})()"));
    say('after export → load: ' + JSON.stringify(kept) + ' (before: ' + before.certs.length + ' certs)');
    const lit = JSON.parse(await ev("(async()=>{window.CAGE_UI.setParam('lightOn',1);window.CAGE_UI.setParam('_viewLoops',1);window.CAGE_UI.build();await new Promise(r=>setTimeout(r,1500));const s=window.BENCH_STATE();return JSON.stringify({certs:s.certs.length,stale:s.stale})})()"));
    say('after the lights on + show loops: ' + JSON.stringify(lit));
    const tint = JSON.parse(await ev("(async()=>{const e=window.CAGE_ENERGY;if(e&&e.EN){e.EN.tint='#204060';}window.CAGE_UI.build();await new Promise(r=>setTimeout(r,1500));const s=window.BENCH_STATE();return JSON.stringify({certs:s.certs.length,stale:s.stale})})()"));
    say('after a tank tint: ' + JSON.stringify(tint));
    const moved = JSON.parse(await ev("(async()=>{window.CAGE_UI.setParam('wgSpan',window.CAGE_UI.P.wgSpan+0.3);window.CAGE_UI.build();await new Promise(r=>setTimeout(r,1500));const s=window.BENCH_STATE();return JSON.stringify({certs:s.certs.length,stale:s.stale,why:Object.keys(s.results).map(k=>s.results[k]&&s.results[k].why).filter(Boolean)[0]})})()"));
    say('after the span moved: ' + JSON.stringify(moved));
    await shot('withdrawn');
  }
  ws.close(); killChrome();
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
})().catch(e => { console.error('bench_shot: ' + e.message); killChrome(); process.exit(1); });
