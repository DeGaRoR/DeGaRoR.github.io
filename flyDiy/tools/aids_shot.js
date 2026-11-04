#!/usr/bin/env node
// aids_shot.js - THE DESIGN AIDS' STILLS (DESIGN-AIDS, 2026-11-03): a build imported through the fleet's own door
// (#gFile), the indicators set from the menu's own handle (GARAGE_AIDS), a view, and a PNG - with the room's marks ON
// (plane_shot.js's stills enter SHOT_MODE, which hides them by design) and, with --ui, the page's interface over it
// (the indicators' menu open: --open-menu).
//
//   node flyDiy/tools/aids_shot.js --build <file.json> --out <png> [--aids all|cg,lift,...] [--view q|s|t|f|orbit:az/el/dist]
//        [--size 1600x900] [--profile phone|desktop] [--ui] [--open-menu] [--secs 900] [--root <repo>]
//
// Cloud-side (Playwright's Chromium on SwiftShader, as the cloud image carries it); slow by nature - a frame is a second.
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const FLY = path.resolve(__dirname, '..'), REPO = path.resolve(opt('root', path.resolve(FLY, '..')));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const T0 = Date.now(), log = (...a) => console.log('[' + ((Date.now() - T0) / 1000).toFixed(1).padStart(6) + ' s]', ...a);
const PRESET = { q: [-2.5, 0.25, 12], s: [-Math.PI / 2, 0.06, 13], t: [-Math.PI / 2, 1.35, 15], f: [Math.PI, 0.10, 10] };
const freePort = () => new Promise(res => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });

(async () => {
  const build = opt('build', null), out = opt('out', null);
  if (!build || !out) { console.log('usage: --build <file.json> --out <png> [...]'); process.exit(1); }
  const [W, H] = opt('size', '1600x900').split('x').map(Number);
  const secs = +opt('secs', 900);
  const port = await freePort();
  const serve = spawn(process.execPath, [path.join(FLY, 'tools', '_serve.js'), String(port), REPO], { stdio: 'ignore' });
  let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
  const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const done = code => { try { browser.close(); } catch (e) {} try { serve.kill(); } catch (e) {} process.exit(code); };
  setTimeout(() => { console.log('FAIL the budget (' + secs + ' s)'); done(4); }, secs * 1000).unref();
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    const errs = []; page.on('pageerror', e => errs.push(String(e && e.message || e)));
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await sleep(400);
    const prof = opt('profile', 'phone');
    const aids = opt('aids', 'all');
    // the aids chosen BEFORE the page boots, in the menu's own preference key (the user's choice, as the menu writes it)
    await page.addInitScript(a => {
      try {
        const keys = ['cg', 'lift', 'thrust', 'floats', 'range', 'tails', 'prop', 'stance', 'doors'];
        const on = a === 'all' ? keys : a === 'default' ? null : a.split(',');
        if (on) { const o = {}; for (const k of keys) o[k] = on.indexOf(k) >= 0; localStorage.setItem('flydiy.aids', JSON.stringify(o)); }
        else localStorage.removeItem('flydiy.aids');
      } catch (e) {}
    }, aids);
    const url = 'http://localhost:' + port + '/flyDiy/index.html?profile=' + prof + '&gfx=laptop&intro=0';
    log('page', url);
    await page.goto(url, { timeout: secs * 1000 });
    await page.waitForFunction('!!(window.BOOT && BOOT.state === "gone" && BOOT.set === "garage" && !BOOT.current && window.FLIGHT_PROBE && window.CAGE_UI && window.GARAGE_SPEC)', null, { timeout: secs * 1000, polling: 2000 });
    log('garage up');
    await page.evaluate(() => { for (const x of document.querySelectorAll('.dfClose')) try { x.click(); } catch (e) {} });
    await page.setInputFiles('#gFile', path.resolve(build));
    const want = JSON.parse(fs.readFileSync(build, 'utf8')).spec.cage;
    const keys = Object.keys(want).filter(k => typeof want[k] === 'number');
    for (let i = 0; i < 240; i++) {
      await sleep(1000);
      const same = await page.evaluate(([w, ks]) => { const s = GARAGE_SPEC.get(), c = s && s.cage || {}; return ks.filter(k => typeof c[k] === 'number' && Math.abs(c[k] - w[k]) <= 1e-6 * Math.max(1, Math.abs(w[k]))).length; }, [want, keys]);
      if (same / keys.length >= 0.9) break;
    }
    // the balance and the sheet land: the posts' labels lit (not 'updating') and the aids drawn
    for (let i = 0; i < 180; i++) {
      await sleep(1000);
      const st = await page.evaluate(() => ({ cg: !!window.CG_READ && window.CG_READ.sm != null, aids: !!(window.GARAGE_AIDS && GARAGE_AIDS.data()) }));
      if (st.cg && (aids === 'cg' || st.aids || aids === 'default')) break;
    }
    log('build loaded');
    const v = opt('view', 'q');
    const cam = PRESET[v] || (/^orbit:/.test(v) ? v.slice(6).split('/').map(Number).map((x, i) => i < 2 ? x * Math.PI / 180 : x) : PRESET.q);
    await page.evaluate(c => { FLIGHT_PROBE.pan(0, 0, 0); FLIGHT_PROBE.camSet(c[0], c[1], c[2]); FLIGHT_PROBE.camSettle(); }, cam);
    if (flag('open-menu')) await page.evaluate(() => { const b = document.querySelector('.edQuickBtn[data-q=aids]'); if (b) b.click(); });
    await sleep(6000);
    if (!flag('ui')) {
      await page.evaluate(() => { const c = document.getElementById('c'); for (const e of document.body.querySelectorAll('*')) { if (e === c || e.contains(c) || (e.closest('svg') && e.tagName !== 'svg')) continue; e.style.setProperty('visibility', 'hidden', 'important'); } });
      await sleep(3000);
    }
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    // the 3D canvas alone (the phone profile's sheet takes a side) unless the interface is wanted (--ui: the whole page)
    const clip = flag('ui') && !flag('canvas') ? null : await page.evaluate(() => { const r = document.getElementById('c').getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) }; });
    await page.screenshot(clip ? { path: out, clip } : { path: out });
    const D = await page.evaluate(() => { const A = window.GARAGE_AIDS && GARAGE_AIDS.data(); return { cg: window.CG_READ, rows: A ? A.rows.map(r => r.id + ':' + r.level) : null }; });
    console.log('AIDS_SHOT ' + JSON.stringify({ ok: true, out, view: v, size: [W, H], profile: prof, errors: errs.slice(0, 5), read: D, secs: +((Date.now() - T0) / 1000).toFixed(1) }));
    done(0);
  } catch (e) { console.log('FAIL ' + (e && e.stack || e)); done(1); }
})();
