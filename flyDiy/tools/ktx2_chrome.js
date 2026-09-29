#!/usr/bin/env node
// ktx2_chrome.js - THE KTX2 GROUND IN A REAL BROWSER (G918, AS3). Headless Chromium (Playwright; SwiftShader by default,
// --gl gpu for the box's GPU) opens the page, rolls out with the default Cub, waits for the ground's arrays, then runs
// tools/ktx2_ab.js in the page: every layer of the live arrays drawn texel for texel on the GL context and scored
// against the raw layer. With the KTX2 path (the default) the arrays must be COMPRESSED (three's CompressedArrayTexture,
// the transcoder's target on this GL) and every layer within GATE KTX2's floors; with --query ktx2=0 they must be the raw
// RGBA8 arrays, every layer 99 dB (the old path, untouched). Prints the page's KTX2 / GROUND_LIB stats and the verdict.
//
//   node tools/_serve.js 8125 &   node tools/ktx2_chrome.js [--url http://localhost:8125/flyDiy/dev.html?world=jolene] [--query ktx2=0] [--gl gpu]
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const Q = opt('query', '');
const URL = opt('url', 'http://localhost:8125/flyDiy/dev.html?world=jolene') + (Q ? '&' + Q : '');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright')); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const exe = opt('chrome', ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p)));
  const args = (opt('gl', 'swiftshader') === 'gpu' ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']).concat(['--js-flags=--max-old-space-size=8192']);
  const browser = await pw.chromium.launch({ executablePath: exe, headless: true, args });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const logs = [];
  const t0 = Date.now(), el = () => Math.round((Date.now() - t0) / 1000) + ' s';
  // a software GL draws the whole world every frame and starves every call made from here: once the arrays exist, hold
  // the page's frames (the readback draws its own)
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = cb => (window.__HOLD ? 0 : raf(cb));
  });
  page.on('console', m => { const t = m.text(); if (m.type() === 'error' || m.type() === 'warning' || /ktx2|KTX2|ground library/.test(t)) logs.push(m.type() + ': ' + t.slice(0, 300)); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  const tryEv = async expr => { try { return await page.evaluate(expr); } catch (e) { return 'ERR ' + e.message.split('\n')[0]; } };
  await page.goto(URL, { waitUntil: 'load', timeout: 180000 });
  for (let i = 0; i < 300; i++) {
    await sleep(2000);
    if (await tryEv("!!document.getElementById('bGo') && !document.getElementById('bGo').disabled")) break;
    await tryEv("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click()); return 1;})()");
  }
  console.log('garage up', el());
  await tryEv("(()=>{const b=document.getElementById('bGo'); if(b) b.click(); return !!b;})()");
  // the arrays: the splat's pair and the pavement's shared pair, both built (the world step, under the screen)
  const ready = `(() => { try { const W = (typeof WORLD !== 'undefined' && WORLD) || window.WORLD; if (!W || !W.ground || !W.ground.splat) return 'no world';
    const sp = W.ground.splat(); const a = sp && sp.arrays ? sp.arrays() : null;
    const PV = (typeof PAVEMENT !== 'undefined' && PAVEMENT) || window.PAVEMENT, pv = PV && PV.sharedLib ? PV.sharedLib(THREE, []) : null;
    return (a && a[0] && a[0].image && a[0].image.depth > 1 && pv && pv.ready) ? 'ready' : 'waiting'; } catch (e) { return 'err ' + e.message; } })()`;
  let st = '';
  for (let i = 0; i < 900; i++) {
    await sleep(2000);
    st = await tryEv(ready);
    if (i % 15 === 0) console.log('  roll-out', el(), st, JSON.stringify(await tryEv("window.GROUND_LIB ? GROUND_LIB.stats() : null")));
    if (st === 'ready') break;
    await tryEv("(()=>{const b=document.getElementById('bGo'); if(b && !b.disabled && b.offsetParent) b.click(); return 1;})()");
  }
  console.log('arrays', st, el());
  await tryEv('window.__HOLD = true');
  await sleep(3000);
  const src = fs.readFileSync(path.join(__dirname, 'ktx2_ab.js'), 'utf8');
  const r = await tryEv(src);
  console.log('ktx2_ab ->', r);
  console.log('logs (' + logs.length + '):\n  ' + logs.slice(0, 25).join('\n  '));
  await browser.close();
  let v = null; try { v = JSON.parse(r); } catch (e) {}
  const want = /ktx2=0/.test(Q) ? 'raw RGBA8' : 'compressed';
  const kindOk = v && ['splat', 'pavement'].every(L => v[L] && String(v[L].kind).startsWith(want));
  console.log('KTX2 CHROME: ' + (v && v.verdict === 'WITHIN FLOORS' && kindOk ? 'PASS' : 'FAIL') + ' (' + want + ' arrays expected; ' + el() + ')');
  process.exit(v && v.verdict === 'WITHIN FLOORS' && kindOk ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
