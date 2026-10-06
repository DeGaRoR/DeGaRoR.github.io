#!/usr/bin/env node
// phone_still.js - THE PHONE GARAGE FROM A CLOUD SESSION: STILLS AND TOUCH CHECKS UNDER MOBILE EMULATION
// (MOBILE-GARAGE 1, G2103, 2026-10-06)
//
// soft_still.js's way (the real page, headless Chromium on SwiftShader, tools/_serve.js on a free port) with a PHONE's
// browser: Playwright's mobile emulation (isMobile, hasTouch, a device pixel ratio, an Android Chrome user agent) at a
// phone's viewport, the page on ?profile=phone (profile.js). It boots the garage, takes a still in PORTRAIT, runs the
// touch checks with real CDP touch events (Input.dispatchTouchEvent - the pointer events a finger makes, coarse
// pointer), turns the viewport to LANDSCAPE and takes a second still. --desktop takes the desktop's still instead (no
// profile, no emulation: the 'desktop unchanged' half of the evidence).
//
//   node tools/phone_still.js --out reports/evidence/MOBILE-GARAGE-1/phone            (-> phone_portrait.jpg, phone_landscape.jpg, phone.json)
//        [--size 390x844] [--dpr 3] [--page index.html|dev.html] [--q 'k=v'] [--checks] [--secs 1800]
//        [--build default|<file.json>] [--desktop --size 1600x900]
//        [--trunk]   the same mobile emulation WITHOUT the phone profile: today's whole game at a phone's size (the
//                    baseline the phone's heap and bytes are read against; one still, no checks)
//   -> one line `PHONE_STILL {json}`: the boot (the steps that ran, the seconds), the world's bytes on the wire (0 on
//      the phone), the JS heap (at the garage, and the peak sampled every 2 s), the preset, the checks, every page error.
//
// THE CHECKS (--checks; each one `{ ok, ... }`, all of them in `checks`):
//   tabs       the tab bar switches the sheet (Parts shows the tree, a node picked opens Edit)
//   knob       a finger on the knob moves its slider (relative, ticks then one release), and the value chip follows
//   scale      a finger on the scale away from the knob does NOT move the value, horizontally or vertically - and the
//              vertical swipe scrolls the sheet (R4-R5, the user's ruling)
//   fine       the knob held still 0.4 s then dragged moves ~a tenth as far (R9)
//   stepper    + moves one step
//   orbit      one finger on the view turns it (az changes)
//   pinch      two fingers apart zoom in (dist falls); together pan the orbit centre
//   save       the name's menu saves the build to a slot; load opens the fleet with it
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const REPO = path.resolve(__dirname, '..', '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const UA = 'Mozilla/5.0 (Linux; Android 13; SM-G780G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';

function findPlaywright() {
  for (const p of ['playwright', '/opt/node-tools/node_modules/playwright', 'playwright-core']) { try { return require(p); } catch (e) {} }
  throw new Error('phone_still: no playwright here');
}
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });

function preScript(o) {
  const L = ['window.__softFrames=0;(function t(){window.__softFrames++;requestAnimationFrame(t)})();',
    'document.addEventListener("DOMContentLoaded",()=>{const s=document.createElement("style");s.textContent="*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}";document.head.appendChild(s);});',
    'try{for(const k of Object.keys(localStorage)) if(/^flydiy\\.(fl([A-Z]|$)|route$|world$|gfx$|rollanim$|rollreal$|welcome|build\\.|phTab)/.test(k)) localStorage.removeItem(k);}catch(e){}'];
  if (o.build === 'default') L.push('try{localStorage.removeItem("flydiy.wip")}catch(e){}');
  else L.push('try{localStorage.setItem("flydiy.wip",' + JSON.stringify(fs.readFileSync(path.resolve(o.build), 'utf8')) + ')}catch(e){}');
  return L.join('\n');
}

async function run(o) {
  const t0 = Date.now(), T = () => +((Date.now() - t0) / 1000).toFixed(1);
  const log = (...a) => console.log('[' + T() + 's]', ...a);
  const R = { mode: o.desktop ? 'desktop' : o.trunk ? 'trunk under mobile emulation' : 'phone', size: o.size, dpr: o.desktop ? 1 : o.dpr, errors: [], t: {}, wire: { world: 0, all: 0, n: 0 }, heap: {}, checks: {} };
  const port = await freePort();
  const server = spawn(process.execPath, [path.join(__dirname, '_serve.js'), String(port), REPO], { stdio: 'ignore' });
  let browser = null;
  try {
    for (let i = 0; ; i++) {
      const ok = await new Promise(res => { const rq = http.get('http://127.0.0.1:' + port + '/flyDiy/version.json', r => { r.resume(); res(true); }); rq.on('error', () => res(false)); });
      if (ok) break; if (i > 60) throw new Error('no static server'); await sleep(250);
    }
    const { chromium } = findPlaywright();
    browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
      '--disable-gpu-compositing', '--disable-accelerated-2d-canvas', '--enable-precise-memory-info'] });
    const [Wd, Ht] = o.size;
    const ctx = await browser.newContext(o.desktop ? { viewport: { width: Wd, height: Ht } }
      : { viewport: { width: Wd, height: Ht }, deviceScaleFactor: o.dpr, isMobile: true, hasTouch: true, userAgent: UA });
    const page = await ctx.newPage();
    page.setDefaultTimeout(o.secs * 1000);
    await page.addInitScript(preScript(o));
    page.on('pageerror', e => { R.errors.push(String(e.message || e).slice(0, 300)); log('PAGEERR', String(e.message).slice(0, 200)); });
    page.on('console', m => { if (m.type() === 'error') { R.errors.push(m.text().slice(0, 300)); log('CONSOLE.ERROR', m.text().slice(0, 200)); } });
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Performance.enable');
    const urls = new Map();
    cdp.on('Network.responseReceived', e => urls.set(e.requestId, e.response.url));
    cdp.on('Network.loadingFinished', e => { const u = urls.get(e.requestId) || ''; R.wire.all += e.encodedDataLength; R.wire.n++;
      if (/\/media\/world\/|island_|world_packs/.test(u) && !/world_packs/.test(u)) R.wire.world += e.encodedDataLength; });
    const heapNow = async () => { const m = await cdp.send('Performance.getMetrics'); const g = k => (m.metrics.find(x => x.name === k) || {}).value || 0;
      return +(g('JSHeapUsedSize') / 1048576).toFixed(1); };
    let peak = 0; const sampler = setInterval(() => { heapNow().then(h => { if (h > peak) peak = h; }, () => {}); }, 2000);
    const q = ['day=afternoon'].concat(o.desktop || o.trunk ? [] : ['profile=phone']).concat(o.q ? [o.q] : []).join('&');
    const url = 'http://127.0.0.1:' + port + '/flyDiy/' + o.page + '?' + q;
    log('nav', url, o.desktop ? 'desktop' : 'mobile emulation ' + Wd + 'x' + Ht + ' @' + o.dpr);
    await page.goto(url, { waitUntil: 'load', timeout: o.secs * 1000 });
    const until = async (what, fn, every = 2000) => {
      for (;;) {
        let v = null; try { v = await page.evaluate(fn); } catch (e) { v = null; }
        if (v) return v;
        if (T() > o.secs) throw new Error('phone_still: timed out waiting for ' + what);
        await sleep(every);
      }
    };
    // the loading screen as the phone shows it (taken once the boot is running)
    if (!o.desktop) { await until('the loading screen', () => window.BOOT && BOOT.state !== 'gone' && BOOT.stepI >= 2, 500).catch(() => null);
      try { const f = o.out + '_loading.jpg'; fs.mkdirSync(path.dirname(path.resolve(f)), { recursive: true }); await page.screenshot({ path: f, type: 'jpeg', quality: 80, timeout: 120000 }); log('still', f); } catch (e) { log('no loading still: ' + e.message); } }
    await until('the garage', () => window.BOOT && BOOT.state === 'gone' && BOOT.set === 'garage' && BOOT.stepI >= (BOOT.steps || []).length && !BOOT.current);
    R.t.garage = T();
    Object.assign(R, await page.evaluate(() => ({
      profile: window.PROFILE ? PROFILE.name : null, htmlPhone: document.documentElement.classList.contains('phone'),
      steps: (BOOT.steps || []).map(s => s.id), world: window.FLYDIY_WORLD, simWorker: !!window.FLYDIY_SIMW,
      preset: window.GFX && GFX.get ? GFX.get().preset : null, soft: window.GFX && GFX.soft ? !!GFX.soft() : null,
      phoneRows: window.PHONE_UI ? PHONE_UI.rows() : null })));
    log('garage', JSON.stringify({ profile: R.profile, steps: R.steps.length, world: R.world, preset: R.preset }));
    await page.evaluate(() => { for (const x of document.querySelectorAll('.dfClose')) try { x.click(); } catch (e) {} });
    const frames = async n => { const f0 = await page.evaluate(() => window.__softFrames || 0); await until(n + ' frames', new Function('return (window.__softFrames || 0) >= ' + (f0 + n)), 500); };
    await frames(3);
    R.heap.garage = await heapNow();
    const shot = async name => { const f = o.out + '_' + name + '.jpg'; fs.mkdirSync(path.dirname(path.resolve(f)), { recursive: true });
      await page.screenshot({ path: f, type: 'jpeg', quality: 82, timeout: o.secs * 1000 }); log('still', f); return f; };
    if (o.desktop) { R.stills = [await shot('desktop')]; }
    else if (o.trunk) { R.stills = [await shot('trunk')]; }
    else {
      // both stills on the page as it booted (the checks move the camera and the values), then the checks
      R.stills = [await shot('portrait')];
      await page.setViewportSize({ width: Ht, height: Wd });
      await frames(3);
      await page.evaluate(() => window.PHONE_UI && PHONE_UI.placeAll());
      R.stills.push(await shot('landscape'));
      if (o.checks) {
        await page.setViewportSize({ width: Wd, height: Ht });
        await frames(2);
        R.checks = await checks(page, cdp, log, frames);
        await page.evaluate(() => window.PHONE_UI && PHONE_UI.setTab('props'));
        await page.setViewportSize({ width: Ht, height: Wd });
        await frames(2);
        await page.evaluate(() => window.PHONE_UI && PHONE_UI.placeAll());
        // the landscape sheet: a knob still moves its slider
        R.checks.knobLandscape = await knobCheck(page, cdp, 60, false);
        log('check knobLandscape', JSON.stringify(R.checks.knobLandscape));
      }
    }
    clearInterval(sampler);
    R.heap.peak = Math.max(peak, R.heap.garage);
    R.t.total = T();
    return R;
  } finally {
    if (browser) await browser.close().catch(() => {});
    try { server.kill(); } catch (e) {}
  }
}

// ---- THE TOUCH CHECKS: real touch events through CDP (the pointer events a finger makes) --------------------------
// THE GESTURE'S OWN CLOCK: each event carries the time a finger would have made it (`timestamp`, seconds) - on SwiftShader a
// dispatch waits seconds for the renderer, and a drag whose moves were stamped on arrival would read as a press HELD still
// (the knob's fine mode, R9, is judged on the events' own timestamps)
const touch = (cdp, type, pts, ts) => cdp.send('Input.dispatchTouchEvent', Object.assign({ type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: i, radiusX: 6, radiusY: 6, force: 1 })) }, ts ? { timestamp: ts } : {}));
async function swipe(cdp, from, to, steps = 8, holdMs = 0) {
  const t0 = Date.now() / 1000;
  await touch(cdp, 'touchStart', [from], t0);
  if (holdMs) await sleep(holdMs);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await touch(cdp, 'touchMove', [[from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]], t0 + (holdMs + 40 * i) / 1000);
    await sleep(40);
  }
  await touch(cdp, 'touchEnd', [], t0 + (holdMs + 40 * steps + 20) / 1000);
  await sleep(150);
}
// the first slider row on screen in the sheet with room to move: its knob's centre, its scale, its value
// (the Edit tab's scroller is the whole column, #edProps: the row is brought on screen first)
const rowProbe = async (page, skip) => { await page.evaluate(() => {
    const r = [...document.querySelectorAll('#edRows .r.phSlider')].find(r => { const g = r.querySelector('input[type=range]'); const f = (g.value - g.min) / (g.max - g.min); return r.offsetParent && !g.disabled && f > 0.15 && f < 0.85; });
    if (r) { r.scrollIntoView({ block: 'center' }); if (window.PHONE_UI) PHONE_UI.placeAll(); } });
  await sleep(400);
  return page.evaluate(skip => {
  const rows = [...document.querySelectorAll('#edRows .r.phSlider')].filter(r => {
    const k = r.querySelector('.phKnob'), rng = r.querySelector('input[type=range]');
    if (!k || k.hidden || rng.disabled) return false;
    const b = k.getBoundingClientRect(), s = document.getElementById('edProps').getBoundingClientRect();
    return b.top > s.top + 4 && b.bottom < s.bottom - 4 && b.width > 0;
  });
  // a row whose value sits mid-range (so +/- both have room)
  const pick = rows.filter(r => { const g = r.querySelector('input[type=range]'); const f = (g.value - g.min) / (g.max - g.min); return f > 0.15 && f < 0.85; })[skip || 0] || rows[skip || 0];
  if (!pick) return null;
  const k = pick.querySelector('.phKnob').getBoundingClientRect(), g = pick.querySelector('input[type=range]'), gb = g.getBoundingClientRect();
  return { key: pick.dataset.k, x: k.left + k.width / 2, y: k.top + k.height / 2, v: +g.value, lo: +g.min, hi: +g.max, st: +g.step,
           sx0: gb.left, sx1: gb.right, sy: gb.top + gb.height / 2, chip: (pick.querySelector('input.v') || {}).value, w: gb.width };
}, skip); };
const valueOf = (page, key) => page.evaluate(k => { const g = document.getElementById('p_' + k); const c = document.getElementById('v_' + k);
  return g ? { v: +g.value, chip: c ? c.value : null, P: window.CAGE_UI && CAGE_UI.P ? CAGE_UI.P[k] : null } : null; }, key);
// the editor's events around a drag, counted on the range: pointerdown (DRAG_ON), input ticks, change
const countEvents = (page, key) => page.evaluate(k => { const g = document.getElementById('p_' + k); window.__phEv = { down: 0, input: 0, change: 0 };
  if (g.__phCount) return; g.__phCount = 1;   // (once per range: the counters are reset, the listeners are not added twice)
  g.addEventListener('pointerdown', () => window.__phEv.down++); g.addEventListener('input', () => window.__phEv.input++); g.addEventListener('change', () => window.__phEv.change++); }, key);
async function knobCheck(page, cdp, dx, hold) {
  const r = await rowProbe(page, 0);
  if (!r) return { ok: false, why: 'no slider row on screen' };
  if (r.x + dx > r.sx1 || r.x + dx < r.sx0) dx = -dx;   // toward the side of the scale with room
  await countEvents(page, r.key);
  await swipe(cdp, [r.x, r.y], [r.x + dx, r.y], 10, hold ? 450 : 0);
  await sleep(600);
  const a = await valueOf(page, r.key), ev = await page.evaluate(() => window.__phEv);
  const expect = (dx / Math.max(40, r.w - 26)) * (r.hi - r.lo) * (hold ? 0.1 : 1);
  const moved = a.v - r.v;
  const okDir = Math.sign(moved) === Math.sign(dx) || (moved === 0 && (dx > 0 ? r.v >= r.hi : r.v <= r.lo));
  return { ok: okDir && moved !== 0 && ev.down === 1 && ev.change === 1 && ev.input >= 1 && Math.abs(moved) <= Math.abs(expect) * 1.5 + r.st,
           key: r.key, from: r.v, to: a.v, expect: +expect.toFixed(4), chip: a.chip, P: a.P, events: ev };
}
async function checks(page, cdp, log, frames) {
  const C = {};
  const say = (k, v) => { C[k] = v; log('check ' + k, JSON.stringify(v)); };
  // TABS
  const vis = id => page.evaluate(i => { const e = document.getElementById(i); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0; }, id);
  const tapAt = async (x, y) => { await touch(cdp, 'touchStart', [[x, y]]); await sleep(60); await touch(cdp, 'touchEnd', []); await sleep(250); };
  const tapEl = async sel => { const b = await page.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
    if (!b) return false; await tapAt(b[0], b[1]); return true; };
  await tapEl('#phTabs button[data-t=parts]');
  const parts = await vis('edParts'), propsHidden = !(await vis('edProps'));
  // (the node's LABEL: its chevron folds the branch, the label selects)
  const node = await page.evaluate(() => { const n = [...document.querySelectorAll('#edTree .edN')].find(e => /^\W*Wings$/.test(e.textContent.trim()) && e.getBoundingClientRect().height > 0) || document.querySelectorAll('#edTree .edN')[1]; if (!n) return null; n.scrollIntoView({ block: 'center' }); const s = n.querySelector('span') || n; const r = s.getBoundingClientRect(); return { x: r.left + Math.min(20, r.width / 2), y: r.top + r.height / 2, t: n.textContent.trim() }; });
  if (node) await tapAt(node.x, node.y);
  await sleep(400);
  const afterPick = await page.evaluate(() => ({ tab: window.PHONE_UI && PHONE_UI.tab(), name: (document.getElementById('edPartName') || {}).textContent }));
  await tapEl('#phTabs button[data-t=info]');
  const info = await vis('edInfo');
  await tapEl('#phTabs button[data-t=props]');
  say('tabs', { ok: parts && propsHidden && afterPick.tab === 'props' && info && (await vis('edProps')), parts, propsHidden, picked: node && node.t, afterPick, info });
  // THE KNOB (and the editor's events around it), then the scale, then fine, then the stepper
  say('knob', await knobCheck(page, cdp, 70, false));
  {
    const r = await rowProbe(page, 0);
    const sx = r.x > (r.sx0 + r.sx1) / 2 ? r.sx0 + 30 : r.sx1 - 30;   // the far side of the scale from the knob
    const top0 = await page.evaluate(() => document.getElementById('edProps').scrollTop);
    await swipe(cdp, [sx, r.sy], [sx + (sx < r.x ? 60 : -60), r.sy], 8);
    const h = await valueOf(page, r.key);
    await swipe(cdp, [sx, r.sy], [sx, r.sy - 120], 10);   // (a vertical swipe on the scale: the column scrolls)
    await sleep(500);
    const v = await valueOf(page, r.key);
    const top1 = await page.evaluate(() => document.getElementById('edProps').scrollTop);
    say('scale', { ok: h.v === r.v && v.v === r.v && top1 > top0, key: r.key, value: r.v, afterHorizontal: h.v, afterVertical: v.v, scrolled: [top0, top1] });
  }
  say('fine', await knobCheck(page, cdp, 150, true));
  {
    const r = await rowProbe(page, 0);
    const plus = await page.evaluate(k => { const b = document.querySelector('#edRows .r[data-k="' + k + '"] .phPlus'); if (!b) return null; const q = b.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; }, r.key);
    await countEvents(page, r.key);
    await tapAt(plus[0], plus[1]);
    await sleep(500);
    const a = await valueOf(page, r.key), ev = await page.evaluate(() => window.__phEv);
    say('stepper', { ok: Math.abs(a.v - Math.min(r.hi, r.v + r.st)) < r.st * 0.01 + 1e-9 && ev.change === 1, key: r.key, from: r.v, to: a.v, step: r.st, events: ev });
  }
  // THE VIEW: one finger orbits, two pinch (and pan)
  const cam = () => page.evaluate(() => { const c = FLIGHT_PROBE.cam(); return { az: c.azT, el: c.elT, dist: c.distT }; });
  const vb = await page.evaluate(() => { const r = document.getElementById('c').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; });
  const c0 = await cam();
  await swipe(cdp, [vb.x - 60, vb.y + 20], [vb.x + 60, vb.y + 20], 10);
  const c1 = await cam();
  say('orbit', { ok: Math.abs(c1.az - c0.az) > 0.3, az: [c0.az, c1.az] });
  {
    const a0 = [vb.x - 30, vb.y], b0 = [vb.x + 30, vb.y];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a0[0], y: a0[1], id: 0 }, { x: b0[0], y: b0[1], id: 1 }] });
    for (let i = 1; i <= 8; i++) {
      const d = 30 + i * 12, up = i * 4;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: vb.x - d, y: vb.y - up, id: 0 }, { x: vb.x + d, y: vb.y - up, id: 1 }] });
      await sleep(40);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(300);
    const c2 = await cam();
    const pan = await page.evaluate(() => FLIGHT_PROBE.camGet().target);
    say('pinch', { ok: c2.dist < c1.dist * 0.75, dist: [c1.dist, c2.dist], target: pan });
  }
  await page.evaluate(c => { FLIGHT_PROBE.pan(0, 0, 0); if (FLIGHT_PROBE.camSet) FLIGHT_PROBE.camSet(c.az, c.el, c.dist); }, c0);   // the view as it was
  // SAVE AND LOAD: the name's menu
  {
    await tapEl('#fbName');
    const shelf = await vis('edShelf');
    page.once('dialog', d => d.accept('Phone Cub'));
    await tapEl('#gSaveAs');
    await sleep(1500);
    const slots = await page.evaluate(() => Object.keys(localStorage).filter(k => /^flydiy\.build\./.test(k)));
    const name = await page.evaluate(() => (document.getElementById('fbName') || {}).textContent);
    await tapEl('#fbName');
    await tapEl('#gLoad');
    await sleep(800);
    const fleet = await page.evaluate(() => { const f = document.getElementById('gFleet'); if (f && (getComputedStyle(f).display === 'none' || f.hidden || f.getBoundingClientRect().height < 40)) return null; return f ? { id: f.id, w: Math.round(f.getBoundingClientRect().width), lists: /Phone Cub/.test(f.textContent) } : null; });
    if (fleet) await page.screenshot({ path: path.join(path.dirname(path.resolve(argvOut())), path.basename(argvOut()) + '_load.jpg'), type: 'jpeg', quality: 80 });
    say('save', { ok: shelf && slots.length > 0 && !!fleet && fleet.lists, shelf, slots, name, fleet });
    // the fleet closes by its own CLOSE (a tap, as a finger would)
    const close = await page.evaluate(() => { const f = document.getElementById('gFleet'); const b = f && [...f.querySelectorAll('button, a, [role=button], span, b')].find(e => /^\s*close\s*$/i.test(e.textContent) && e.getBoundingClientRect().width > 0);
      if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    if (close) await tapAt(close[0], close[1]);
    await sleep(500);
    C.save.closed = await page.evaluate(() => { const f = document.getElementById('gFleet'); return !f || f.hidden || getComputedStyle(f).display === 'none' || f.getBoundingClientRect().height < 40; });
    C.save.ok = C.save.ok && C.save.closed;
  }
  return C;
}
let OUT = null; const argvOut = () => OUT;

function parse() {
  return { size: opt('size', '390x844').split('x').map(Number), dpr: +opt('dpr', 3), page: opt('page', 'index.html'), q: opt('q', ''),
    checks: flag('checks'), trunk: flag('trunk'), secs: +opt('secs', 1800), build: opt('build', 'default'), desktop: flag('desktop'),
    out: opt('out', path.join(REPO, 'flyDiy', 'reports', 'evidence', 'MOBILE-GARAGE-1', 'phone')), json: opt('json', null) };
}
if (require.main === module) {
  const o = parse(); OUT = o.out;
  run(o).then(R => {
    console.log('PHONE_STILL ' + JSON.stringify(R));
    fs.writeFileSync(o.json || (o.out + '.json'), JSON.stringify(R, null, 1));
    const bad = Object.entries(R.checks || {}).filter(([, v]) => !v.ok).map(([k]) => k);
    process.exit(R.errors.length || bad.length ? 1 : 0);
  }, e => { console.log('PHONE_STILL_FAIL ' + (e && e.stack || e)); process.exit(2); });
}
module.exports = { run, parse };
