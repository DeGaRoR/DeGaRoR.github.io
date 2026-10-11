#!/usr/bin/env node
// _lazy_check.js — GATE LAZY (G2685-G2689 CAREER-LAZY): the career's core is not the sandbox's page.
//
// tools/build.js writes MANIFEST.career (the nine career-only core modules and their tables) as career_core.<h8>.js
// beside the page; index.html inlines the core without them and fetches the file at boot only with ?career=1 / ?map=1 /
// ?freight=1 or the welcome's career mode (CAREER_LOADER), running it right after the core (the promote).
// tools/flight_core.js keeps every module (the gates, the workers). This holds it:
//   STATIC (node, ~2 s)
//     1 the file: ONE career_core.<h8>.js beside the page, h8 its own sha256, = the nine modules in MANIFEST.core's order
//     2 THE PAGE: index.html inlines none of the nine (each one's first declaration) and every other core module; the
//       loader names this build's file; dev.html tags exactly the nine data-career (its promote's same rule)
//     3 flight_core.js keeps EVERYTHING (its body = every MANIFEST.core module, in order)
//     4 THE SPLIT RUNS: the page's core then career_core in one vm context (two scripts, as the page runs them): before
//       the career none of its globals exists; after it every career global the page names (app.js, world_boot.js,
//       map_menu.js, freight_load.js, the core's own readers) resolves; a new career's map record, the price book
//       (KIT_PRICES, the shells), the stage maxes and a contract board are identical to flight_core.js's
//     5 THE WORKERS: sim_host's core list (SIM_HOST_CORE) names none of the nine (the worker imports the whole
//       flight_core.js, the gates' core, and calls nothing of the career)
//     6 sw.js in a vm: CAREER_KEEP is this build's name; an install with a career page open caches it, with a sandbox
//       page fetches nothing; the loader's message caches it; a fetch of it is cache-first (no network the second
//       time); another build's career_core is not served from the cache, and activate sweeps it
//   REQUEST LISTS (headless Chromium + SwiftShader, the served page - SKIP without Playwright; ~2-4 min)
//     7 a default boot to app.js's evaluation (and 8 s after, the worker registered): no career_core request at all
//     8 ?career=1 / ?map=1 / ?freight=1: career_core requested and answered BEFORE app.js runs (window.FLYDIY_PLAYER's
//       setter sees typeof careerNew === 'function'), and app.js's door for the flag is up (FLYDIY_CAREER / _PROCURE /
//       _FREIGHT)
//     9 OFFLINE: a second ?career=1 boot in the same profile with career_core's network blocked boots the career from
//       sw.js's cache
//   --no-browser: the static half alone. Verdict contract: one final `GATE LAZY: PASS|FAIL`, exit code to match.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto'), os = require('os'), net = require('net'), http = require('http');
const { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..'), REPO = path.resolve(ROOT, '..');
const B = require('./build.js');
const argv = process.argv.slice(2);
let fails = 0;
const ok = (c, msg) => { console.log((c ? '  ok   ' : '  FAIL ') + msg); if (!c) fails++; return c; };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const sha8 = t => crypto.createHash('sha256').update(t).digest('hex').slice(0, 8);
const KB = n => (n / 1024).toFixed(1) + ' KB';
const declOf = src => { const m = /^(?:const|let|var|function|class)\s+[\w$]+[^\n]*/m.exec(src); return m ? m[0] : null; };

// ---- 1 the file ---------------------------------------------------------------------------------------------------
const names = B.careerCoreNames(ROOT);
ok(names.length === 1, 'one career_core.<h8>.js beside the page (' + (names.join(', ') || 'none') + ')');
const NAME = names[0] || '';
const career = NAME ? read(NAME) : '';
ok(!!NAME && sha8(career) === NAME.slice(12, 20), NAME + ': named by its own sha256 (' + sha8(career) + ')');
const parts = {};
for (const f of B.MANIFEST.core) parts[f] = read('src/core/' + f);
const CAREER = B.MANIFEST.core.filter(f => B.MANIFEST.career.includes(f));
ok(CAREER.length === 9 && B.MANIFEST.career.length === 9, 'MANIFEST.career: the nine career-only modules (' + B.MANIFEST.career.join(', ') + ')');
ok(career.includes(CAREER.map(f => parts[f]).join('')), 'career_core = the nine modules concatenated in MANIFEST.core\'s order (' + KB(career.length) + ')');

// ---- 2 the page -----------------------------------------------------------------------------------------------------
const html = read('index.html'), dev = read('dev.html');
const inPage = CAREER.filter(f => html.includes(declOf(parts[f])));
ok(!inPage.length, 'index.html inlines none of the nine (a signature each: ' + CAREER.map(f => declOf(parts[f]).slice(0, 28)).join(' | ') + ')' + (inPage.length ? ' - FOUND ' + inPage.join(', ') : ''));
const rest = B.MANIFEST.core.filter(f => !CAREER.includes(f) && declOf(parts[f]));
const lost = rest.filter(f => !html.includes(declOf(parts[f])));
ok(!lost.length, 'index.html inlines every other core module (' + rest.length + ')' + (lost.length ? ' - MISSING ' + lost.join(', ') : ''));
ok(html.includes('var SRC = window.FLYDIY_CAREER_SRC = ' + JSON.stringify(NAME) + ';'), 'the page\'s career loader names ' + NAME);
const tagged = [...dev.matchAll(/<script data-career type="text\/x-flydiy" src="src\/core\/([^"?]+)\?v=/g)].map(m => m[1]);
ok(tagged.join() === CAREER.join(), 'dev.html tags exactly the nine data-career (' + tagged.length + ') and its promote skips them outside the rule');
ok(/if \(tags\[i\]\.hasAttribute\('data-career'\) && !career\) continue;/.test(dev), 'dev.html\'s promote: data-career only under FLYDIY_CAREER_WANT()');

// ---- 3 flight_core keeps everything -------------------------------------------------------------------------------
const fc = read('tools/flight_core.js');
const fcBody = fc.split('\n').slice(2).join('\n');
ok(fcBody === B.MANIFEST.core.map(f => parts[f]).join(''), 'tools/flight_core.js = every MANIFEST.core module in order, the nine included (' + KB(fcBody.length) + ')');

// ---- 4 the split runs ------------------------------------------------------------------------------------------------
{
  const blocks = [...html.matchAll(/<script(?: type="text\/x-flydiy")?>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const pageCore = blocks.find(b => b.includes('function makePilot('));
  const ctx = vm.createContext({ console: { log() {}, warn() {}, error() {}, info() {} } });
  let threw = null;
  try { vm.runInContext(pageCore, ctx, { filename: 'core.js' }); } catch (e) { threw = e; }
  ok(!threw, 'the page\'s core runs alone' + (threw ? ': ' + threw.message : ''));
  // every global the nine declare
  const globals = [];
  for (const f of CAREER) for (const m of parts[f].matchAll(/^(?:const|let|var|function|class)\s+([\w$]+)/gm)) globals.push(m[1]);
  const has = n => vm.runInContext('typeof ' + n + " !== 'undefined'", ctx);
  const early = globals.filter(has);
  ok(!early.length, 'before the career: none of its ' + globals.length + ' globals exists' + (early.length ? ' - ' + early.slice(0, 6).join(', ') : ''));
  try { vm.runInContext(career, ctx, { filename: NAME }); threw = null; } catch (e) { threw = e; }
  ok(!threw, NAME + ' runs right after it' + (threw ? ': ' + threw.message : ''));
  // the career names the page uses (every script that can reach them) and the core's own readers
  const users = ['src/viewer/app.js', 'src/viewer/world_boot.js', 'src/viewer/map_menu.js', 'src/viewer/freight_load.js']
    .concat(B.MANIFEST.core.filter(f => !CAREER.includes(f)).map(f => 'src/core/' + f));
  const re = new RegExp('(^|[^\\w$.\'"])(' + globals.map(g => g.replace(/\$/g, '\\$')).join('|') + ')(?![\\w$])', 'g');
  const used = new Set();
  for (const u of users) for (const l of read(u).split('\n')) { if (/^\s*\/\//.test(l)) continue; for (const m of l.replace(/\/\/.*$/, '').matchAll(re)) used.add(m[2]); }
  const missing = [...used].filter(n => !has(n));
  ok(used.size > 50 && !missing.length, 'after it, every career global the page names resolves (' + used.size + ' names across app.js, world_boot.js, map_menu.js, freight_load.js and the core)' + (missing.length ? ' - UNRESOLVED ' + missing.join(', ') : ''));
  const C = require('./flight_core.js');
  const same = (label, a, b) => ok(JSON.stringify(a) === JSON.stringify(b), label + ' = flight_core.js\'s');
  same('a new career\'s map record (careerNew + careerMapRecord)', vm.runInContext("careerMapRecord(careerNew({ id: 'dev', seed: 'dev' }), null, {})", ctx),
    C.careerMapRecord(C.careerNew({ id: 'dev', seed: 'dev' }), null, {}));
  same('the price book (KIT_PRICES, the shells)', vm.runInContext("[KIT_PRICES, Object.keys(SHELLS).map(s => shellPrice(s))]", ctx), [C.KIT_PRICES, Object.keys(C.SHELLS).map(s => C.shellPrice(s))]);
  same('the stage maxes (76_stages over CONTRACT_TRACKS)', vm.runInContext('stageMaxes()', ctx), C.stageMaxes());
  same('the first contract board (contractJobs)', vm.runInContext("Object.keys(CONTRACT_PROVIDERS).map(p => contractJobs('dev', p, 0))", ctx),
    Object.keys(C.CONTRACT_PROVIDERS).map(p => C.contractJobs('dev', p, 0)));
}

// ---- 5 the workers ---------------------------------------------------------------------------------------------------
{
  const sh = read('src/viewer/sim_host.js');
  const m = /const SIM_HOST_CORE = \[([\s\S]*?)\];/.exec(sh);
  const list = m ? [...m[1].matchAll(/'([\w$]+)'/g)].map(x => x[1]) : [];
  const globals = new Set();
  for (const f of CAREER) for (const g of parts[f].matchAll(/^(?:const|let|var|function|class)\s+([\w$]+)/gm)) globals.add(g[1]);
  ok(list.length > 5 && !list.some(n => globals.has(n)), 'the physics worker\'s core list (SIM_HOST_CORE, ' + list.length + ' names) names none of the career\'s: it imports tools/flight_core.js whole and calls nothing of it');
}

// ---- 6 sw.js in a vm -------------------------------------------------------------------------------------------------
(async () => {
  const swSrc = read('sw.js');
  ok(new RegExp('const CAREER_KEEP = \\["' + NAME.replace(/\./g, '\\.') + '"\\];').test(swSrc), 'sw.js lists this build\'s ' + NAME + ' (CAREER_KEEP)');
  const SCOPE = 'https://x.test/flyDiy/';
  const runSw = (clientUrls) => {
    const store = new Map(), net = [], L = {};
    const resp = (u, body) => ({ ok: true, status: 200, url: u, body, clone() { return resp(u, body); }, headers: { get: () => null } });
    const cache = {
      match: async r => store.get(typeof r === 'string' ? r : r.url) || undefined,
      put: async (r, res) => { store.set(typeof r === 'string' ? r : r.url, res); },
      add: async u => { net.push(u); store.set(u, resp(u, 'net')); },
      keys: async () => [...store.keys()].map(u => ({ url: u })),
      delete: async r => store.delete(r.url),
    };
    const self = {
      location: new URL(SCOPE + 'sw.js'), registration: { scope: SCOPE },
      addEventListener: (k, f) => { L[k] = f; }, skipWaiting() {},
      clients: { claim: async () => {}, matchAll: async () => clientUrls.map(url => ({ url })) },
    };
    const box = { self, caches: { open: async () => cache }, fetch: async r => { const u = typeof r === 'string' ? r : r.url; net.push(u); return resp(u, 'net'); },
      URL, Set, Map, Promise, console, Response: function () {} };
    vm.createContext(box);
    vm.runInContext(swSrc, box, { filename: 'sw.js' });
    const fire = async (k, ev) => { const w = []; ev.waitUntil = p => w.push(p); let rw = null; ev.respondWith = p => { rw = p; }; L[k](ev); await Promise.all(w); return rw ? await rw : null; };
    return { store, net, fire };
  };
  const cur = SCOPE + NAME, old = SCOPE + 'career_core.00000000.js';
  try {
    const a = runSw([SCOPE + 'index.html?career=1']);
    await a.fire('install', {});
    ok(a.store.has(cur) && a.net.length === 1, 'install with a career page open: ' + NAME + ' precached (' + a.net.length + ' fetch)');
    const b = runSw([SCOPE + 'index.html', SCOPE + 'index.html?mode=sandbox']);
    await b.fire('install', {});
    ok(!b.store.size && !b.net.length, 'install with sandbox pages open: nothing fetched, nothing cached');
    await b.fire('message', { data: { flydiy: 'career-core', src: NAME } });
    ok(b.store.has(cur) && b.net.length === 1, 'the career loader\'s word: cached');
    const n0 = b.net.length;
    const r1 = await b.fire('fetch', { request: { method: 'GET', url: cur, headers: { get: () => null } } });
    ok(!!r1 && b.net.length === n0, 'a fetch of it is answered from the cache (no network)');
    const c = runSw([]);
    const r2 = await c.fire('fetch', { request: { method: 'GET', url: cur, headers: { get: () => null } } });
    ok(!!r2 && c.store.has(cur) && c.net.length === 1, 'a fetch of it uncached: from the network, cached on the way through');
    const r3 = await c.fire('fetch', { request: { method: 'GET', url: old, headers: { get: () => null } } });
    ok(r3 === null, 'another build\'s career_core is not this worker\'s to answer');
    c.store.set(old, {}); c.store.set(SCOPE + 'media/tex/x.jpg', {});
    await c.fire('activate', {});
    ok(!c.store.has(old) && c.store.has(cur) && c.store.has(SCOPE + 'media/tex/x.jpg'), 'activate sweeps a superseded career_core and keeps this build\'s (and media/)');
    const d = runSw([]);
    const r4 = await d.fire('fetch', { request: { method: 'GET', url: SCOPE + 'src/viewer/app.js', headers: { get: () => null } } });
    ok(r4 === null, 'scripts and pages are still never the worker\'s (app.js passes through)');
  } catch (e) { ok(false, 'sw.js in a vm threw: ' + (e && e.stack || e)); }

  // ---- 7-9 the request lists --------------------------------------------------------------------------------------
  if (argv.includes('--no-browser')) console.log('  (--no-browser: the request lists not run)');
  else await requestLists();
  console.log('GATE LAZY: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
  process.exit(fails ? 1 : 0);
})();

function findPlaywright() {
  for (const p of ['playwright', '/opt/node-tools/node_modules/playwright', 'playwright-core']) { try { return require(p); } catch (e) {} }
  return null;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });

// the hook app.js's evaluation trips: window.FLYDIY_PLAYER is assigned once, in app.js's own body (after CAREER_DEV,
// PROCURE_PAGE and FREIGHT_PAGE are decided) - its setter records whether the career's core was there
const HOOK = `(() => {
  let v; window.__lazy = { app: null };
  Object.defineProperty(window, 'FLYDIY_PLAYER', { configurable: true, get: () => v, set: x => {
    if (!window.__lazy.app) window.__lazy.app = { t: performance.now(), career: typeof careerNew === 'function', procure: typeof procureBuyModel === 'function', freight: typeof freightLoadNew === 'function' };
    v = x; } });
})();`;

async function requestLists() {
  const PW = findPlaywright();
  if (!PW) { console.log('  no Playwright here: the request lists are a cloud session\'s / the box\'s (SKIPPED; the static half stands)'); return; }
  const secs = +((argv.find(a => a.startsWith('--secs=')) || '').slice(7) || 300);
  const port = await freePort();
  const server = spawn(process.execPath, [path.join(__dirname, '_serve.js'), String(port), REPO], { stdio: 'ignore' });
  let browser = null;
  const t0 = Date.now(), T = () => ((Date.now() - t0) / 1000).toFixed(0) + ' s';
  try {
    for (let i = 0; ; i++) {
      const up = await new Promise(res => { const rq = http.get('http://127.0.0.1:' + port + '/flyDiy/version.json', r => { r.resume(); res(true); }); rq.on('error', () => res(false)); });
      if (up) break; if (i > 80) throw new Error('the static server never answered'); await sleep(250);
    }
    browser = await PW.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-compositing', '--disable-accelerated-2d-canvas'] });
    const base = 'http://127.0.0.1:' + port + '/flyDiy/index.html';
    const boot = async (ctx, q, label) => {
      const reqs = [];
      const onReq = r => reqs.push({ url: r.url(), sw: !!(r.serviceWorker && r.serviceWorker()) });
      ctx.on('request', onReq);
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push(String(e.message || e).slice(0, 200)));
      await page.goto(base + q, { waitUntil: 'domcontentloaded', timeout: secs * 1000 });
      let app = null;
      for (const end = Date.now() + secs * 1000; Date.now() < end;) {
        app = await page.evaluate(() => window.__lazy && window.__lazy.app).catch(() => null);
        if (app) break; await sleep(1000);
      }
      const info = await page.evaluate(n => {
        const e = performance.getEntriesByType('resource').find(r => r.name.endsWith('/' + n));
        return { fetched: e ? { start: e.startTime, end: e.responseEnd, bytes: e.transferSize, enc: e.encodedBodySize } : null, ran: window.FLYDIY_CAREER_RAN || null,
          doors: { career: window.FLYDIY_CAREER !== undefined, procure: window.FLYDIY_PROCURE !== undefined, freight: window.FLYDIY_FREIGHT !== undefined } };
      }, NAME).catch(() => ({}));
      return { page, reqs, app, info, errs, label, off: () => ctx.off('request', onReq) };
    };
    // 7 the default sandbox
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      await ctx.addInitScript(HOOK);
      const r = await boot(ctx, '', 'default');
      await sleep(8000);   // the worker registers at load: its install must not fetch it either
      const hit = r.reqs.filter(q => /career_core\./.test(q.url));
      ok(!!r.app, 'default: app.js ran (' + T() + ', ' + r.reqs.length + ' requests, ' + r.reqs.filter(q => q.sw).length + ' from the worker)');
      ok(r.app && !r.app.career && !r.app.procure && !r.app.freight, 'default: app.js saw no career code (typeof careerNew / procureBuyModel / freightLoadNew undefined)');
      ok(!hit.length, 'THE DEFAULT SANDBOX NEVER REQUESTS career_core (' + (hit.map(q => q.url).join(', ') || 'none of ' + r.reqs.length) + ')');
      ok(!r.errs.length, 'default: no page error' + (r.errs.length ? ': ' + r.errs.slice(0, 2).join(' | ') : ''));
      r.off(); await ctx.close();
    }
    // 8 the three flags
    for (const [q, door] of [['?career=1', 'career'], ['?map=1', 'procure'], ['?freight=1', 'freight']]) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      await ctx.addInitScript(HOOK);
      const r = await boot(ctx, q, q);
      const i = r.reqs.findIndex(x => x.url.endsWith('/' + NAME)), iApp = r.reqs.findIndex(x => /\/src\/models\//.test(x.url));
      ok(i >= 0, q + ': ' + NAME + ' requested (request #' + i + ' of ' + r.reqs.length + ')');
      ok(!!r.app && r.app.career && r.app.procure && r.app.freight, q + ': answered and run BEFORE app.js (its setter saw careerNew, procureBuyModel, freightLoadNew)' + (r.info.fetched ? ' - fetched by ' + r.info.fetched.end.toFixed(0) + ' ms, app.js at ' + (r.app ? r.app.t.toFixed(0) : '?') + ' ms' : ''));
      ok(i >= 0 && (iApp < 0 || i < iApp), q + ': requested ahead of the promoted payloads (#' + i + ' < #' + iApp + ')');
      ok(r.info.doors && r.info.doors[door], q + ': app.js\'s ' + door + ' door is up (FLYDIY_' + door.toUpperCase() + ')');
      ok(!r.errs.length, q + ': no page error' + (r.errs.length ? ': ' + r.errs.slice(0, 2).join(' | ') : ''));
      // 9 offline, once: the same profile, career_core's network blocked - sw.js's cache answers
      if (q === '?career=1') {
        const cached = await r.page.evaluate(async n => { for (let k = 0; k < 40; k++) { const m = await caches.match(new URL(n, location.href).href); if (m) return true; await new Promise(z => setTimeout(z, 500)); } return false; }, NAME).catch(() => false);
        ok(cached, '?career=1: sw.js holds ' + NAME + ' after the visit');
        await r.page.close(); r.off();
        await ctx.route('**/' + NAME, rt => rt.abort());
        const r2 = await boot(ctx, q, 'offline');
        ok(!!r2.app && r2.app.career && r2.info.doors && r2.info.doors.career, 'OFFLINE: a second ?career=1 boot with ' + NAME + '\'s network blocked boots the career from sw.js\'s cache');
        r2.off();
      } else r.off();
      await ctx.close();
    }
    console.log('  the request lists in ' + T());
  } catch (e) { ok(false, 'the request lists: ' + (e && e.message || e)); }
  finally { try { if (browser) await browser.close(); } catch (e) {} try { server.kill(); } catch (e) {} }
}
