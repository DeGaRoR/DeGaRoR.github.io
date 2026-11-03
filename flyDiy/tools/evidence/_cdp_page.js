// _cdp_page.js - the few Playwright calls tools/evidence/AP-HONEST.js makes, over Chrome's raw DevTools protocol, for a box
// with Chrome and no Playwright (A0's, 27 Oct: `npm root -g` has none). The same driver the box's other rigs use
// (headless=new, --remote-debugging-port, a fresh profile under os.tmpdir(), deleted on close); Node's own WebSocket.
//   const { chromium } = require('./_cdp_page.js');
//   const browser = await chromium.launch({ headless, args }), ctx = await browser.newContext({ viewport: { width, height } });
//   const page = await ctx.newPage();   page.goto / evaluate(string) / addInitScript(fn, arg) / on('pageerror') /
//   screenshot({ path }) / $(sel) -> { screenshot({ path }) } | null;   browser.close()
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process'), http = require('http'), os = require('os'), net = require('net');
const CHROME = [process.env.CHROME_PATH, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });

async function launch(o) {
  if (!CHROME) throw new Error('_cdp_page: no Chrome found (set CHROME_PATH)');
  o = o || {};
  const dport = await freePort(), udd = path.join(os.tmpdir(), 'cdpp_' + process.pid + '_' + Date.now());
  const ch = cp.spawn(CHROME, [o.headless === false ? null : '--headless=new', '--remote-debugging-port=' + dport, '--user-data-dir=' + udd,
    '--window-size=1600,900', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--disable-gpu-sandbox'].filter(Boolean)
    .concat(o.args || [], ['about:blank']), { stdio: 'ignore' });
  const pages = [];
  const browser = {
    async newContext(c) { const vp = (c && c.viewport) || { width: 1600, height: 900 }; return { newPage: () => newPage(dport, vp, pages) }; },
    async close() {
      for (const p of pages) try { p._ws.close(); } catch (e) {}
      try { ch.kill(); } catch (e) {}
      for (let i = 0; i < 10; i++) { await sleep(500); try { fs.rmSync(udd, { recursive: true, force: true }); break; } catch (e) {} }
    },
  };
  return browser;
}

async function newPage(dport, vp, pages) {
  let tgt = null;
  for (let i = 0; i < 75 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + dport + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  if (!tgt) throw new Error('_cdp_page: no Chrome page');
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const waits = new Map(), ons = { pageerror: [] }, evs = new Map();
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails, msg = String((d.exception && d.exception.description) || d.text);
      for (const f of ons.pageerror) try { f({ message: msg }); } catch (x) {} }
    const w = evs.get(m.method); if (w) { evs.delete(m.method); w(m.params); }
  };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); })
    .then(m => { if (m.error) throw new Error(method + ': ' + m.error.message); return m.result; });
  const once = (method, ms) => new Promise((r, j) => { evs.set(method, r); setTimeout(() => { if (evs.get(method) === r) { evs.delete(method); j(new Error(method + ' timeout ' + ms + ' ms')); } }, ms); });
  await cmd('Runtime.enable'); await cmd('Page.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: false });
  const png = async (f, clip) => { const r = await cmd('Page.captureScreenshot', Object.assign({ format: 'png' }, clip ? { clip: Object.assign({ scale: 1 }, clip) } : {})); fs.writeFileSync(f, Buffer.from(r.data, 'base64')); };
  const page = {
    _ws: ws,
    on(k, f) { (ons[k] || (ons[k] = [])).push(f); },
    async addInitScript(fn, arg) { await cmd('Page.addScriptToEvaluateOnNewDocument', { source: typeof fn === 'function' ? '(' + fn + ')(' + JSON.stringify(arg) + ')' : String(fn) }); },
    async goto(url, o) { const ms = (o && o.timeout) || 30000, ld = once('Page.loadEventFired', ms); await cmd('Page.navigate', { url }); await ld; },
    async evaluate(expr, arg) {
      const src = typeof expr === 'function' ? '(' + expr + ')(' + JSON.stringify(arg) + ')' : String(expr);
      const r = await cmd('Runtime.evaluate', { expression: src, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(String((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text));
      return r.result.value;
    },
    async screenshot(o) { await png(o.path); },
    async $(sel) {
      const has = await page.evaluate('!!document.querySelector(' + JSON.stringify(sel) + ')');
      if (!has) return null;
      return { async screenshot(o) {
        const b = await page.evaluate('(()=>{ const r = document.querySelector(' + JSON.stringify(sel) + ').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; })()');
        if (!b || !(b.width > 0 && b.height > 0)) throw new Error(sel + ' has no box');
        await png(o.path, b);
      } };
    },
  };
  pages.push(page);
  return page;
}

module.exports = { chromium: { launch } };
