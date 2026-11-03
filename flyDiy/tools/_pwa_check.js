#!/usr/bin/env node
// GATE PWA (G3910, PHONE-1b) - flyDiy as an INSTALLED app. The user, 2 Nov: "make flyDiy an installable PWA ... Please have
// a force sync explicit option, and check your service worker settings carefully, caching can be painful with installed
// PWA". In node: the manifest and its icons read off the disk, the pages' wiring, the BUILT sw.js run in a vm over a fake
// Cache Storage, and src/viewer/update_now.js's force sync run over a stubbed window.
//
//   W1  THE MANIFEST (manifest.webmanifest): JSON; name / short_name; id, start_url and scope './'; display standalone;
//       orientation any; background and theme colours #rrggbb; an icon 192 and 512 ('any') and a 512 'maskable'
//   W2  THE ICONS: every file the manifest names exists, is a PNG, and its IHDR says the size the manifest says
//   W3  THE PAGES LINK IT: shell.html (both pages' head) and the built index.html carry the manifest link and a
//       theme-color equal to the manifest's
//   W4  THE PAGE IS NEVER THE WORKER'S (the built sw.js): the installed app's start_url (./, ./?v=...), index.html,
//       dev.html, version.json, the manifest and the icons all go to the network - the worker answers none of them;
//       media/ stays cache-first. (GATE UPDATE P10 holds the same rule for the update's own URLs)
//   W5  FORCE SYNC, "Clean download & reload" (UPDATE_NOW.cleanReload): asked first, the cost named and the designs said
//       to be kept; a No changes nothing; a Yes saves the work, deletes every cache named flydiy* and no other, unregisters
//       this folder's worker and no other app's on the origin (degaror.github.io hosts more than one), never touches
//       localStorage, and replaces the page by itself under ?v= (the user's parameters kept) - once
//   W6  FORCE SYNC, "Check for update" (UPDATE_NOW.checkNow): the worker asked to update, version.json fetched no-store;
//       a newer build shows the pill (even after its x), the same build says "Up to date" and shows no pill
//   W7  THE WIRING: the menu's three rows (app.js: Check for update, Clean download & reload, Full screen); phone.css's
//       installed mode (overscroll-behavior none; display-mode standalone: the tab bar over the gesture bar's inset)
//
//   node tools/_pwa_check.js [--verbose]  -> "GATE PWA: PASS|FAIL"
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..'), V = p => path.join(ROOT, 'src', 'viewer', p);
const VERBOSE = process.argv.includes('--verbose');
const fails = [];
let nOk = 0;
const check = (ok, label, extra) => {
  if (!ok || VERBOSE) console.log((ok ? '  ok     ' : '  FAIL   ') + label + (extra ? ' - ' + extra : ''));
  if (ok) nOk++; else fails.push(label);
  return ok;
};
const read = p => { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; } };

// ---- a small DOM (GATE UPDATE's) -------------------------------------------------------------------------------------
class El {
  constructor(tag, doc) { this.tagName = String(tag).toUpperCase(); this.doc = doc; this.children = []; this.parentNode = null;
    this.attrs = {}; this.style = {}; this.className = ''; this._text = ''; this.hidden = false; this.id = ''; this.type = ''; this.title = '';
    const el = this, cls = () => el.className.split(/\s+/).filter(Boolean);
    this.classList = { contains: c => cls().includes(c),
      toggle: (c, on) => { const has = cls().includes(c); const want = on === undefined ? !has : !!on;
        el.className = (want ? cls().filter(x => x !== c).concat([c]) : cls().filter(x => x !== c)).join(' '); return want; } }; }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  set textContent(t) { this._text = String(t); this.children = []; }
  get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n === this.doc.documentElement; }
  appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; }
  insertBefore(c, ref) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; const i = ref ? this.children.indexOf(ref) : -1;
    if (i < 0) this.children.push(c); else this.children.splice(i, 0, c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentNode = null; return c; }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'id') this.id = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  walk(f) { f(this); for (const c of this.children) c.walk(f); }
  find(pred) { let hit = null; this.walk(n => { if (!hit && pred(n)) hit = n; }); return hit; }
}
function makeDoc() {
  const doc = { visibilityState: 'visible', listeners: {} };
  doc.createElement = t => new El(t, doc);
  doc.documentElement = new El('html', doc);
  doc.head = doc.documentElement.appendChild(new El('head', doc));
  doc.body = doc.documentElement.appendChild(new El('body', doc));
  doc.getElementById = id => doc.documentElement.find(n => n.id === id);
  doc.addEventListener = (k, f) => { (doc.listeners[k] = doc.listeners[k] || []).push(f); };
  return doc;
}
const ORIGIN = 'https://degaror.github.io', BASE = ORIGIN + '/flyDiy/';
// a window with Cache Storage, two service worker registrations (this folder's, another app's), a localStorage that
// records any touch, confirm(), location.replace
function boot(opt) {
  opt = Object.assign({ href: BASE + 'index.html?profile=phone#x', build: 'aaaaaaaaaaaa', server: 'aaaaaaaaaaaa', confirm: true }, opt || {});
  const log = [];
  const doc = makeDoc();
  const u = new URL(opt.href);
  const caches = new Set(['flydiy-media-v1', 'flydiy-extra', 'recycle-v3']);
  const regs = [{ scope: BASE, updated: 0, gone: false }, { scope: ORIGIN + '/recyclePWA/', updated: 0, gone: false }];
  for (const r of regs) { r.update = () => { r.updated++; log.push(['update', r.scope]); return Promise.resolve(); };
    r.unregister = () => { r.gone = true; log.push(['unregister', r.scope]); return Promise.resolve(true); }; }
  const lsTouched = [];
  const ss = new Map();
  const W = {
    FLYDIY_BUILD: opt.build, FLYDIY_BUILD_DATE: '2026-11-02T10:00:00.000Z',
    document: doc,
    navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 10) Chrome/141.0 Mobile', webdriver: false,
      serviceWorker: { getRegistration: () => Promise.resolve(regs[0]), getRegistrations: () => Promise.resolve(regs.slice()) } },
    location: { href: u.toString(), search: u.search, pathname: u.pathname, hash: u.hash,
                assign: to => log.push(['assign', to]), replace: to => log.push(['replace', to]), reload: () => log.push(['reload']) },
    history: { state: null, replaceState: () => {} },
    sessionStorage: { getItem: k => (ss.has(k) ? ss.get(k) : null), setItem: (k, v) => ss.set(k, String(v)), removeItem: k => ss.delete(k) },
    localStorage: new Proxy({}, { get: (t, k) => { lsTouched.push(String(k)); return () => null; } }),
    caches: { keys: () => Promise.resolve([...caches]), delete: k => { log.push(['cacheDelete', k]); return Promise.resolve(caches.delete(k)); } },
    confirm: msg => { log.push(['confirm', msg]); return opt.confirm; },
    listeners: {}, addEventListener(k, f) { (this.listeners[k] = this.listeners[k] || []).push(f); },
    setTimeout: () => 0, clearTimeout: () => {},
    URL,
  };
  W.fetch = (url, init) => { log.push(['fetch', url, init]); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ build: W._server, date: '2026-11-02T11:00:00.000Z' }) }); };
  W._server = opt.server;
  W.GARAGE_SPEC = { commit: () => { log.push(['commit']); return true; } };
  W.window = W;
  const ctx = vm.createContext({ window: W, URL, Promise, Date, console, Proxy });
  vm.runInContext(read(V('update_now.js')), ctx, { filename: 'update_now.js' });
  const settle = () => new Promise(r => setImmediate(r)).then(() => new Promise(r => setImmediate(r))).then(() => new Promise(r => setImmediate(r)));
  const shown = id => { const e = doc.getElementById(id); return !!(e && !e.hidden && e.isConnected); };
  return { W, U: W.UPDATE_NOW, doc, log, caches, regs, lsTouched, ss, settle, shown };
}

// PNG: the IHDR's width and height (bytes 16-23 after the 8-byte signature and the chunk's length + type)
function pngSize(file) {
  const b = fs.readFileSync(file);
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47 || b.toString('ascii', 12, 16) !== 'IHDR') return null;
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

(async () => {
  // ---- W1 / W2 -------------------------------------------------------------------------------------------------------
  const MP = path.join(ROOT, 'manifest.webmanifest');
  let M = null;
  try { M = JSON.parse(read(MP)); } catch (e) { M = null; }
  check(!!M, 'W1 manifest.webmanifest is JSON');
  M = M || {};
  check(M.name && /flyDiy/.test(M.name) && M.short_name === 'flyDiy', 'W1 name and short_name', M.name + ' / ' + M.short_name);
  check(M.id === './' && M.start_url === './' && M.scope === './', 'W1 id, start_url and scope are ./ (the folder; ?v= and the user\'s query stay the page\'s)');
  check(M.display === 'standalone' && M.orientation === 'any', 'W1 display standalone, orientation any');
  check(/^#[0-9a-f]{6}$/i.test(M.background_color || '') && /^#[0-9a-f]{6}$/i.test(M.theme_color || ''), 'W1 background and theme colours');
  const icons = Array.isArray(M.icons) ? M.icons : [];
  const has = (sz, purpose) => icons.find(i => i.sizes === sz && String(i.purpose || 'any').split(/\s+/).includes(purpose));
  check(has('192x192', 'any') && has('512x512', 'any') && has('512x512', 'maskable'), 'W1 icons: 192 and 512 (any), 512 (maskable)');
  for (const i of icons) {
    const f = path.join(ROOT, i.src || '');
    const s = fs.existsSync(f) ? pngSize(f) : null;
    check(!!s && i.type === 'image/png' && s.join('x') === i.sizes, 'W2 ' + i.src + ' is a ' + i.sizes + ' PNG', s ? s.join('x') : 'missing / not a PNG');
  }
  // ---- W3 ------------------------------------------------------------------------------------------------------------
  const link = /<link rel="manifest" href="manifest\.webmanifest">/, theme = new RegExp('<meta name="theme-color" content="' + (M.theme_color || '#?') + '">', 'i');
  const SH = read(V('shell.html')) || '', IX = read(path.join(ROOT, 'index.html')) || '';
  check(link.test(SH) && theme.test(SH), 'W3 shell.html links the manifest and carries its theme colour');
  check(link.test(IX) && theme.test(IX), 'W3 the built index.html does (rebuilt after shell.html)');
  // ---- W4 ------------------------------------------------------------------------------------------------------------
  {
    const SW = read(path.join(ROOT, 'sw.js')) || '';
    const L = {};
    const self = { addEventListener: (k, f) => { L[k] = f; }, skipWaiting: () => {}, clients: { claim: async () => {} }, location: { origin: ORIGIN },
                   registration: { scope: BASE } };
    const cache = { keys: async () => [], delete: async () => true, match: async () => null, put: async () => {}, add: async () => {} };
    vm.runInNewContext(SW, { self, caches: { open: async () => cache }, URL, fetch: () => Promise.resolve({ ok: false, status: 503 }), Response: function () {}, console });
    const answered = u => { let hit = false; L.fetch({ request: { method: 'GET', url: u, headers: { get: () => null } }, respondWith: () => { hit = true; } }); return hit; };
    const page = ['', '?v=bbbbbbbbbbbb', 'index.html', 'index.html?profile=phone', 'dev.html', 'version.json?t=1', 'manifest.webmanifest', ...icons.map(i => i.src)];
    const wrong = page.filter(p => answered(BASE + p));
    check(!wrong.length, 'W4 the worker answers none of the installed app\'s page URLs (start_url, ?v=, index, dev, version.json, the manifest, the icons)', wrong.join(', '));
    check(answered(BASE + 'media/tex/ground/grass.11223344.ktx2'), 'W4 media/ stays cache-first');
  }
  // ---- W5 ------------------------------------------------------------------------------------------------------------
  {
    const no = boot({ confirm: false });
    check(typeof no.U.cleanReload === 'function', 'W5 UPDATE_NOW.cleanReload exists');
    if (typeof no.U.cleanReload === 'function') {
      await no.U.cleanReload(); await no.settle();
      const asked = no.log.find(e => e[0] === 'confirm');
      check(!!asked && /download/i.test(asked[1]) && /kept/i.test(asked[1]), 'W5 asked first, the cost named and the designs said to be kept', asked ? JSON.stringify(asked[1]).slice(0, 120) : 'no confirm');
      check(!no.log.some(e => /cacheDelete|unregister|replace|assign|reload|commit/.test(e[0])), 'W5 a No changes nothing');
      const yes = boot({ confirm: true });
      const r = await yes.U.cleanReload(); await yes.settle();
      const ix = k => yes.log.findIndex(e => e[0] === k);
      check([...yes.caches].join() === 'recycle-v3', 'W5 every flydiy* cache deleted and no other', [...yes.caches].join());
      check(yes.regs[0].gone && !yes.regs[1].gone, 'W5 this folder\'s worker unregistered, another app\'s on the origin kept');
      check(!yes.lsTouched.length, 'W5 localStorage never touched', yes.lsTouched.join(','));
      const rep = yes.log.filter(e => e[0] === 'replace');
      let ok = rep.length === 1;
      if (ok) { const t = new URL(rep[0][1]); ok = t.pathname === '/flyDiy/index.html' && t.searchParams.get('profile') === 'phone' && !!t.searchParams.get('v') && t.hash === '#x'; }
      check(ok, 'W5 the page replaced by itself under ?v= (the user\'s parameters and hash kept), once', rep.map(e => e[1]).join(' | '));
      check(ix('commit') >= 0 && ix('commit') < ix('replace'), 'W5 the work saved before the reload');
      await yes.U.cleanReload(); await yes.settle();
      check(yes.log.filter(e => e[0] === 'replace').length === 1, 'W5 a second press does nothing');
    }
  }
  // ---- W6 ------------------------------------------------------------------------------------------------------------
  {
    const a = boot({ server: 'bbbbbbbbbbbb' });
    check(typeof a.U.checkNow === 'function', 'W6 UPDATE_NOW.checkNow exists');
    if (typeof a.U.checkNow === 'function') {
      await a.settle();
      a.ss.set('flydiy.updateDismissed', 'bbbbbbbbbbbb');   // the pill's x pressed earlier
      a.log.length = 0;
      await a.U.checkNow(); await a.settle();
      const f = a.log.filter(e => e[0] === 'fetch');
      check(a.regs[0].updated === 1, 'W6 the worker asked to update itself');
      check(f.length >= 1 && /version\.json/.test(f[f.length - 1][1]) && f[f.length - 1][2] && f[f.length - 1][2].cache === 'no-store', 'W6 version.json fetched no-store');
      check(a.shown('updNow'), 'W6 a newer build shows the pill (even after its x)');
      const b = boot({ server: 'aaaaaaaaaaaa' });
      await b.settle(); await b.U.checkNow(); await b.settle();
      const n = b.doc.getElementById('updNote');
      check(!b.shown('updNow') && !!n && !n.hidden && /up to date/i.test(n.textContent), 'W6 the same build: "Up to date", no pill', n ? n.textContent : 'no note');
    }
  }
  // ---- W7 ------------------------------------------------------------------------------------------------------------
  {
    const A = read(V('app.js')) || '';
    check(/FLYDIY_MENU\.add\(\{ k: 'updcheck', label: 'Check for update'[\s\S]{0,200}checkNow\(\)/.test(A), 'W7 the menu\'s "Check for update" calls checkNow');
    check(/FLYDIY_MENU\.add\(\{ k: 'updclean', label: 'Clean download & reload'[\s\S]{0,200}cleanReload\(\)/.test(A), 'W7 the menu\'s "Clean download & reload" calls cleanReload');
    check(/FLYDIY_MENU\.add\(\{ k: 'fullscreen', label: 'Full screen'[\s\S]{0,300}requestFullscreen/.test(A), 'W7 the menu\'s "Full screen" (the Fullscreen API)');
    const P = read(V('phone.css')) || '';
    check(/overscroll-behavior:\s*none/.test(P), 'W7 phone.css: no pull-to-refresh / overscroll on the phone');
    check(/@media \(display-mode: standalone\)[\s\S]{0,300}safe-area-inset-bottom/.test(P), 'W7 phone.css: the installed window keeps the tab bar over the gesture bar\'s inset');
  }

  console.log('  ' + nOk + ' checks ok' + (fails.length ? ', ' + fails.length + ' FAILED' : ''));
  console.log('GATE PWA: ' + (fails.length ? 'FAIL (' + fails.length + ')' : 'PASS'));
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('  FAIL ' + (e && e.stack || e)); console.log('GATE PWA: FAIL'); process.exit(1); });
