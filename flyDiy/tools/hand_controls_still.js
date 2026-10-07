#!/usr/bin/env node
// G2480 HAND-CONTROLS: THE MAPPING PANEL'S NEW ROWS, AND THE DOM KEY PATH, ON THE REAL PAGE (cloud: headless Chromium on
// SwiftShader, tools/_serve.js; phone_still.js's way). The page boots to the garage (desktop, or ?profile=phone under
// Playwright's mobile emulation), then:
//   KEYS   real KeyboardEvents dispatched on `window` - the listener input.js installs - and INP.update stepped BY HAND
//          (G200's trap 4: a pane's rAF may not fire; here it does, and the page's own loop updates too - the reads
//          are taken after the ramps saturate): [ and ] (the toe brakes -> brake / brakeD per main), B with the pedal
//          held and the brake-steer option on, numpad enter x5 (the rudder trim), V (the water rudders' handle)
//   STILLS the controls panel opened (INPUT_PANEL.open), a toe brake and the trims held so the live lines read, the
//          BRAKES and TRIM groups scrolled into view
//
//   node tools/hand_controls_still.js --out reports/evidence/HAND-CONTROLS/desktop            (-> _brakes.jpg, _trim.jpg, .json)
//   node tools/hand_controls_still.js --out reports/evidence/HAND-CONTROLS/phone --phone [--size 390x844 --dpr 3]
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http'), net = require('net');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const PHONE = argv.includes('--phone');
const OUT = opt('out', 'reports/evidence/HAND-CONTROLS/' + (PHONE ? 'phone' : 'desktop'));
const SIZE = opt('size', PHONE ? '390x844' : '1600x900').split('x').map(Number), DPR = +opt('dpr', PHONE ? 3 : 1), SECS = +opt('secs', 2400);
const REPO = path.resolve(__dirname, '..', '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const UA = 'Mozilla/5.0 (Linux; Android 13; SM-G780G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
const findPlaywright = () => { for (const p of ['playwright', '/opt/node-tools/node_modules/playwright', 'playwright-core']) { try { return require(p); } catch (e) {} } throw new Error('no playwright'); };
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });
const tree = (() => { try { return require('child_process').execSync('git rev-parse --short=10 HEAD', { cwd: REPO }).toString().trim(); } catch (e) { return '?'; } })();

(async () => {
  const t0 = Date.now(), T = () => +((Date.now() - t0) / 1000).toFixed(1);
  const log = (...a) => console.log('[' + T() + 's]', ...a);
  const R = { mode: (PHONE ? 'phone (?profile=phone, mobile emulation ' : 'desktop (') + SIZE.join('x') + ' @' + DPR + '), headless Chromium on SwiftShader',
              tree, errors: [], keys: null, stills: [] };
  const port = await freePort();
  const server = spawn(process.execPath, [path.join(__dirname, '_serve.js'), String(port), REPO], { stdio: 'ignore' });
  let browser = null;
  try {
    for (let i = 0; ; i++) {
      const ok = await new Promise(res => { const rq = http.get('http://127.0.0.1:' + port + '/flyDiy/version.json', r => { r.resume(); res(true); }); rq.on('error', () => res(false)); });
      if (ok) break; if (i > 60) throw new Error('no static server'); await sleep(250);
    }
    const { chromium } = findPlaywright();
    browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-compositing'] });
    const [W, H] = SIZE;
    const ctx = await browser.newContext(PHONE ? { viewport: { width: W, height: H }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true, userAgent: UA }
                                               : { viewport: { width: W, height: H } });
    const page = await ctx.newPage();
    page.setDefaultTimeout(SECS * 1000);
    await page.addInitScript('try{for(const k of Object.keys(localStorage)) if(/^flydiy\\.(input|fl([A-Z]|$)|welcome|phTab)/.test(k)) localStorage.removeItem(k);}catch(e){}' +
      'document.addEventListener("DOMContentLoaded",()=>{const s=document.createElement("style");s.textContent="*{backdrop-filter:none!important}";document.head.appendChild(s);});');
    page.on('pageerror', e => { R.errors.push(String(e.message || e).slice(0, 300)); log('PAGEERR', String(e.message).slice(0, 200)); });
    const url = 'http://127.0.0.1:' + port + '/flyDiy/index.html?day=afternoon' + (PHONE ? '&profile=phone' : '');
    log('nav', url);
    await page.goto(url, { waitUntil: 'load', timeout: SECS * 1000 });
    for (;;) {
      const v = await page.evaluate(() => window.BOOT && BOOT.state === 'gone' && BOOT.set === 'garage' && !BOOT.current && !!window.FLYDIY_INPUT).catch(() => false);
      if (v) break; if (T() > SECS) throw new Error('timed out waiting for the garage'); await sleep(2000);
    }
    log('garage');
    await page.evaluate(() => { for (const x of document.querySelectorAll('.dfClose')) try { x.click(); } catch (e) {} });
    // ---- KEYS: the DOM path, INP.update by hand -------------------------------------------------------------------
    R.keys = await page.evaluate(() => {
      const I = window.FLYDIY_INPUT, key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, cancelable: true }));
      const step = n => { for (let i = 0; i < n; i++) I.update(1 / 60); };
      const read = () => { const c = { eng: null }; I.write(c); return { brake: +c.brake.toFixed(3), brakeD: +c.brakeD.toFixed(3), dr: +c.dr.toFixed(3), wr: c.wr,
        L: +Math.min(1, Math.max(0, c.brake + c.brakeD)).toFixed(3), R: +Math.min(1, Math.max(0, c.brake - c.brakeD)).toFixed(3) }; };
      I.seed({});
      const out = {};
      const ev = new KeyboardEvent('keydown', { code: 'BracketLeft', bubbles: true, cancelable: true });
      window.dispatchEvent(ev); out.defaultPrevented = ev.defaultPrevented;      // a bound key: the page does not also scroll / type
      step(40); out.leftToe = read(); key('keyup', 'BracketLeft'); step(40);
      key('keydown', 'BracketRight'); step(40); out.rightToe = read(); key('keyup', 'BracketRight'); step(40);
      out.released = read();
      I.setOpt('brakeSteer', true);
      key('keydown', 'KeyB'); key('keydown', 'Period'); step(60); out.brakeSteerRightPedal = read();
      key('keyup', 'KeyB'); key('keyup', 'Period'); step(60); I.setOpt('brakeSteer', false);
      for (let i = 0; i < 5; i++) { key('keydown', 'NumpadEnter'); step(1); key('keyup', 'NumpadEnter'); step(1); }
      step(30); out.rudderTrim5 = Object.assign(read(), { trims: I.trims() });
      key('keydown', 'KeyV'); step(2); key('keyup', 'KeyV'); step(2); out.waterRudderOnce = read().wr;
      key('keydown', 'KeyV'); step(2); key('keyup', 'KeyV'); step(2); out.waterRudderTwice = read().wr;
      key('keydown', 'KeyV'); step(2); key('keyup', 'KeyV'); step(2); out.waterRudderThrice = read().wr;
      // ...and a key typed in a text field is NOT the aeroplane's (the guard)
      const ta = document.createElement('textarea'); document.body.appendChild(ta);
      ta.dispatchEvent(new KeyboardEvent('keydown', { code: 'BracketLeft', bubbles: true, cancelable: true })); step(40);
      out.inTextField = read(); ta.dispatchEvent(new KeyboardEvent('keyup', { code: 'BracketLeft', bubbles: true })); ta.remove(); step(20);
      return out;
    });
    log('keys', JSON.stringify(R.keys));
    // ---- STILLS: the panel, a toe brake and the trims held ---------------------------------------------------------
    await page.evaluate(() => {
      const I = window.FLYDIY_INPUT;
      I.setOpt('brakeSteer', true);
      window.INPUT_PANEL.open(I, { who: () => 'in the shed' });
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'BracketLeft', bubbles: true }));
      I.setTrims({ r: 0.14, a: 0.02 });
    });
    const shot = async (name, group) => {
      await page.evaluate(g => { const h = [...document.querySelectorAll('#ctlBody h3')].find(x => x.nextElementSibling && x.nextElementSibling.dataset && x.nextElementSibling.dataset.g === g);
        if (h) h.scrollIntoView({ block: 'start' }); }, group);
      await sleep(1500);
      const f = OUT + '_' + name + '.jpg'; fs.mkdirSync(path.dirname(path.resolve(f)), { recursive: true });
      await page.screenshot({ path: f, type: 'jpeg', quality: 85, timeout: SECS * 1000 }); log('still', f); R.stills.push(f);
    };
    await shot('brakes', 'ground');
    await shot('trim', 'trim');
    R.panel = await page.evaluate(() => ({ rows: [...document.querySelectorAll('#ctlBody .ctlRow')].map(r => r.dataset.a),
      groups: [...document.querySelectorAll('#ctlBody h3')].map(h => h.textContent), live: [...document.querySelectorAll('#ctlBody .live')].map(l => l.textContent),
      opt: !!document.querySelector('#ctlBody .opt input:checked'), hostVisible: !document.getElementById('ctlPanel').hidden,
      box: (() => { const b = document.getElementById('ctlPanel').getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map(Math.round); })(),
      vw: innerWidth, vh: innerHeight }));
    log('panel', JSON.stringify(R.panel));
  } finally {
    if (browser) await browser.close().catch(() => {});
    try { server.kill(); } catch (e) {}
  }
  fs.writeFileSync(OUT + '.json', JSON.stringify(R, null, 1));
  console.log('HAND_STILL ' + JSON.stringify({ mode: R.mode, tree: R.tree, keys: R.keys, stills: R.stills, errors: R.errors.length }));
})().catch(e => { console.error(e); process.exit(1); });
