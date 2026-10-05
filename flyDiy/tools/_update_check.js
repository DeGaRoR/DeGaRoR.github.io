#!/usr/bin/env node
// GATE UPDATE (UPDATE-NOW, G1535-G1539) - "A NEW VERSION IS AVAILABLE - UPDATE", in node: the real
// src/viewer/update_now.js run in a vm over a stubbed window (location, history, fetch, timers, sessionStorage and a
// small DOM), the built pages' wiring read off index.html / dev.html / version.json, and the built sw.js run over a fake
// Cache Storage across an update.
//
//   P1  DIFFERING BUILDS SHOW THE PILL: version.json's build != the page's -> #updNow in the body, not hidden, naming both
//       builds; the shed's stamp and the loading screen's line are the PAGE's build and date
//   P2  THE SAME BUILD SHOWS NOTHING (no #updNow at all)
//   P3  A FAILED version.json SHOWS NOTHING: a rejected fetch (offline), a 404, a body that is not JSON, JSON with no
//       build; and a pill that was up goes away when the next check fails
//   P4  THE UPDATE URL: the same page with ?v=<server build>, every other parameter and the hash kept, an old ?v=
//       replaced; and the new page strips ?v= at eval (history.replaceState, the user's parameters kept; no ?v=, no call)
//   P5  THE AUTOSAVE RUNS BEFORE THE NAVIGATION: GARAGE_SPEC.commit and every onBeforeUpdate flush, then
//       location.assign - once (a second press does nothing); premises_ui.js registers its flush; a thrown flush does
//       not stop the update
//   P6  NEVER WITHOUT THE PRESS: no check ever navigates; the pill's × hides it for this session and this server build,
//       a NEWER server build shows it again
//   P7  THE SCHEDULE: one check at boot, a timer of 5 min (re-armed; skipped while the tab is hidden), a regained tab
//       (visibilitychange / focus) checks at most once every 30 s; no requestAnimationFrame anywhere in the file, one URL
//       fetched (version.json, no-store, a ?t= query)
//   P8  THE RIGS: navigator.webdriver -> no fetch, no pill (a shared tree is rebuilt under a running rig); ?update=1
//       forces it on, ?update=0 off
//   P9  THE WIRING (the built pages): FLYDIY_BUILD + FLYDIY_BUILD_DATE in a plain script ahead of update_now.js, ahead of
//       welcome.js, ahead of the vendor (never inert); the same build in index.html, dev.html and version.json; dev.html
//       refs update_now.js; welcome.js stamps its card; storage.js asks UPDATE_NOW
//   P10 THE MEDIA CACHE ACROSS AN UPDATE (sw.js, built): install skips waiting, activate claims and sweeps exactly the
//       media/world + media/geo entries outside this build's keep list (textures, audio, this build's world kept); the
//       fetch handler answers media/ only - index.html?v=..., version.json?t=... and the scripts go to the network
//
//   node tools/_update_check.js [--verbose]  -> "GATE UPDATE: PASS|FAIL"
//   node tools/_update_check.js --selftest   -> eight sabotaged copies of update_now.js, each must go red
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
const SRC_ARG = (process.argv.find(a => a.startsWith('--src=')) || '').slice(6);
const SRC = fs.readFileSync(SRC_ARG || V('update_now.js'), 'utf8');

// --selftest: the gate run over SABOTAGED copies of update_now.js, each of which must go red (a check that cannot
// fail is not a check)
if (process.argv.includes('--selftest')) {
  const os = require('os'), { spawnSync } = require('child_process');
  const real = fs.readFileSync(V('update_now.js'), 'utf8');
  const SAB = [
    ['no autosave before the navigation', 'saveAll();\n    let to;', 'let to;'],
    ['the pill on the same build', "const newer = () => !!(S.server && S.build && S.server !== S.build);", 'const newer = () => !!(S.server && S.build);'],
    ['a failed check keeps the last answer', '.catch(() => { S.failed++; S.server = null; S.serverAt = null; return null; })', '.catch(() => { S.failed++; return S.server; })'],
    ['no cache-buster', 'u.searchParams.set(PARAM, String(server || Date.now()));', ''],
    ['the cache-buster never stripped', "if (clean && W.history && W.history.replaceState)", 'if (false)'],
    ['a navigation without the press', '.then(b => { inflight = null; render(); notify(); return b; });', '.then(b => { inflight = null; render(); notify(); if (newer()) update(); return b; });'],
    ['checked on every regain', 'if (visible() && Date.now() - S.last >= REGAIN) check();', 'check();'],
    ['the rigs see it', 'const enabled = () => !OFF && (FORCE || !RIG);', 'const enabled = () => !OFF;'],
  ];
  let bad = 0;
  for (const [what, a, b] of SAB) {
    if (!real.includes(a)) { console.log('  FAIL   selftest: the sabotage target is gone: ' + what); bad++; continue; }
    const f = path.join(os.tmpdir(), 'update_now_sab_' + process.pid + '.js');
    fs.writeFileSync(f, real.split(a).join(b));
    const r = spawnSync(process.execPath, [__filename, '--src=' + f], { encoding: 'utf8' });
    fs.unlinkSync(f);
    const red = r.status !== 0 && /GATE UPDATE: FAIL/.test(r.stdout);
    console.log((red ? '  ok     ' : '  FAIL   ') + 'selftest: ' + what + ' -> ' + (red ? 'red (' + (r.stdout.match(/^ {2}FAIL {3}.*$/gm) || []).length + ' checks)' : 'GREEN'));
    if (!red) bad++;
  }
  console.log('GATE UPDATE selftest: ' + (bad ? 'FAIL (' + bad + ')' : 'PASS'));
  process.exit(bad ? 1 : 0);
}

// ---- a small DOM ---------------------------------------------------------------------------------------------------
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
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  get nextSibling() { if (!this.parentNode) return null; const s = this.parentNode.children; return s[s.indexOf(this) + 1] || null; }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'id') this.id = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  walk(f) { f(this); for (const c of this.children) c.walk(f); }
  find(pred) { let hit = null; this.walk(n => { if (!hit && pred(n)) hit = n; }); return hit; }
  click() { if (typeof this.onclick === 'function') this.onclick({ type: 'click', target: this }); }
}
function makeDoc(opt) {
  const doc = { visibilityState: 'visible', listeners: {} };
  doc.createElement = t => new El(t, doc);
  doc.createTextNode = t => { const e = new El('#text', doc); e._text = String(t); return e; };
  doc.documentElement = new El('html', doc);
  doc.head = doc.documentElement.appendChild(new El('head', doc));
  doc.body = doc.documentElement.appendChild(new El('body', doc));
  doc.getElementById = id => doc.documentElement.find(n => n.id === id);
  doc.addEventListener = (k, f) => { (doc.listeners[k] = doc.listeners[k] || []).push(f); };
  doc.fire = k => { for (const f of doc.listeners[k] || []) f({ type: k }); };
  if (opt.boot !== false) {   // the loading screen's panel, as body.html has it ahead of the BOOT slot
    const boot = doc.body.appendChild(new El('div', doc)); boot.setAttribute('id', 'boot');
    const panel = boot.appendChild(new El('div', doc)); panel.setAttribute('id', 'bootPanel');
    const brand = panel.appendChild(new El('span', doc)); brand.setAttribute('id', 'bootBrand'); brand.textContent = 'Garage Flight Sim';
    const phase = panel.appendChild(new El('div', doc)); phase.setAttribute('id', 'bootPhase');
  }
  return doc;
}

// ---- a window --------------------------------------------------------------------------------------------------------
// opt: href, build, date, server (a build string | {status} | 'reject' | 'garbage' | {json}), webdriver, garage
function boot(opt) {
  opt = Object.assign({ href: 'https://degaror.github.io/flyDiy/index.html', build: 'aaaaaaaaaaaa', date: '2026-10-04T15:08:19.810Z',
                        server: 'aaaaaaaaaaaa' }, opt || {});
  const log = [];   // the order of things that matter: fetch, commit, flush, assign, replaceState
  const doc = makeDoc(opt);
  const timers = [];
  let now = 1e12;
  const u = new URL(opt.href);
  const ss = new Map();
  const W = {
    FLYDIY_BUILD: opt.build, FLYDIY_BUILD_DATE: opt.date,
    document: doc,
    navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/141.0', webdriver: !!opt.webdriver },
    location: { href: u.toString(), search: u.search, pathname: u.pathname, hash: u.hash,
                assign: to => log.push(['assign', to]), reload: () => log.push(['reload']) },
    history: { state: { k: 1 }, replaceState: (st, t, url) => log.push(['replaceState', url, st]) },
    sessionStorage: { getItem: k => (ss.has(k) ? ss.get(k) : null), setItem: (k, v) => ss.set(k, String(v)) },
    listeners: {},
    addEventListener(k, f) { (this.listeners[k] = this.listeners[k] || []).push(f); },
    setTimeout: (f, ms) => { timers.push({ f, ms, live: true }); return timers.length; },
    clearTimeout: id => { if (timers[id - 1]) timers[id - 1].live = false; },
    URL,
  };
  W.fetch = (url, init) => {
    log.push(['fetch', url, init]);
    const s = typeof W._server === 'function' ? W._server() : W._server;
    if (s === 'reject') return Promise.reject(new TypeError('Failed to fetch'));
    const res = (status, body) => ({ ok: status >= 200 && status < 300, status,
      json: () => (typeof body === 'string' ? Promise.resolve().then(() => JSON.parse(body)) : Promise.resolve(body)) });
    if (s && typeof s === 'object' && s.status) return Promise.resolve(res(s.status, '<html>404</html>'));
    if (s === 'garbage') return Promise.resolve(res(200, '<!doctype html> not json'));
    if (s && typeof s === 'object' && s.json) return Promise.resolve(res(200, s.json));
    return Promise.resolve(res(200, { build: s, date: '2026-10-05T09:00:00.000Z' }));
  };
  W._server = opt.server;
  if (opt.garage) W.GARAGE_SPEC = { commit: () => { log.push(['commit']); return true; } };
  W.window = W;
  const ctx = vm.createContext({ window: W, URL, Promise, Date: { now: () => now }, console });
  vm.runInContext(SRC, ctx, { filename: 'update_now.js' });
  const U = W.UPDATE_NOW;
  const settle = () => new Promise(r => setImmediate(r)).then(() => new Promise(r => setImmediate(r)));
  const pill = () => doc.getElementById('updNow');
  const shown = () => { const p = pill(); return !!(p && !p.hidden && p.isConnected); };
  return { W, U, doc, log, timers, settle, pill, shown, ss, tick: ms => { now += ms; }, fetches: () => log.filter(e => e[0] === 'fetch') };
}

(async () => {
  // ---- P1 ------------------------------------------------------------------------------------------------------------
  {
    const b = boot({ server: 'bbbbbbbbbbbb' });
    await b.settle();
    check(b.shown(), 'P1 a differing build shows the pill');
    const t = b.pill() ? b.pill().textContent : '';
    check(/A new version is available/.test(t) && /Update/.test(t), 'P1 the pill says "A new version is available" and offers Update', JSON.stringify(t));
    check(t.includes('aaaaaaaa') && t.includes('bbbbbbbb'), 'P1 the pill names the page\'s build and the server\'s');
    const go = b.pill() && b.pill().find(n => n.className === 'uGo'), x = b.pill() && b.pill().find(n => n.className === 'uX');
    check(!!go && go.tagName === 'BUTTON' && !!x && x.tagName === 'BUTTON', 'P1 Update and dismiss are buttons');
    check(!!b.doc.getElementById('updNowCss') && /pointer:coarse\)[^@]*button \{ min-height:44px/.test(b.doc.getElementById('updNowCss').textContent),
      'P1 a finger-size target on a touch screen (44 px under pointer:coarse)');
    const css = b.doc.getElementById('updNowCss').textContent;
    check(/z-index:95/.test(css), 'P1 above the welcome card (90) and the loading screen (70): z 95');
    check(/body\.mode-fly #updNow \{ left:auto; right:22px; bottom:76px;/.test(css) && /body\.mode-ws #updNow \{ bottom:72px; left:calc\(var\(--ws-left/.test(css)
      && /body\.shot #updNow \{ display:none; \}/.test(css) && /max-width:760px\) \{ body\.mode-fly #updNow \{ right:12px; bottom:112px; \}/.test(css),
      'P1 its place: in flight the right column above the verbs (a phone: over the verbs\' two rows), the garage\'s 3D view, never in a photo');
    const bb = b.doc.getElementById('bootBuild');
    check(!!bb && bb.textContent === 'build aaaaaaaa · 4 Oct 2026' && bb.parentNode.id === 'bootPanel'
      && bb.parentNode.children.indexOf(bb) === 1, 'P1 the loading screen stamps the PAGE\'s build and date under the brand', bb && bb.textContent);
    check(b.U.stamp() === 'build aaaaaaaa · 4 Oct 2026', 'P1 UPDATE_NOW.stamp() is the page\'s build and date (not the server\'s)');
    check(b.log.every(e => e[0] !== 'assign' && e[0] !== 'reload'), 'P1 showing the pill navigates nowhere');
    check(b.doc.documentElement.classList.contains('updNowUp') && /html\.updNowUp #bootPanel \{ bottom:84px; \}/.test(b.doc.getElementById('updNowCss').textContent),
      'P1 the loading screen\'s panel steps up above the pill (html.updNowUp)');
  }
  // ---- P2 ------------------------------------------------------------------------------------------------------------
  {
    const b = boot({ server: 'aaaaaaaaaaaa' });
    await b.settle();
    check(b.fetches().length === 1 && !b.pill() && !b.U.state.shown && !b.doc.documentElement.classList.contains('updNowUp'), 'P2 the same build: checked once, nothing shown');
  }
  // ---- P3 ------------------------------------------------------------------------------------------------------------
  for (const [what, s] of [['offline (rejected)', 'reject'], ['a 404', { status: 404 }], ['a body that is not JSON', 'garbage'],
                           ['JSON with no build', { json: { date: 'x' } }], ['an empty build', { json: { build: '' } }]]) {
    const b = boot({ server: s });
    await b.settle();
    check(b.fetches().length === 1 && !b.shown() && b.U.state.server === null, 'P3 a failed version.json shows nothing: ' + what);
  }
  {
    const b = boot({ server: 'bbbbbbbbbbbb' });
    await b.settle();
    const was = b.shown();
    b.W._server = 'reject'; b.tick(60e3); b.W.listeners.focus.forEach(f => f()); await b.settle();
    check(was && !b.shown() && !b.doc.documentElement.classList.contains('updNowUp'), 'P3 a pill that was up goes away when the next check fails (the panel steps back down)');
  }
  // ---- P4 ------------------------------------------------------------------------------------------------------------
  {
    const b = boot({ server: 'bbbbbbbbbbbb', href: 'https://degaror.github.io/flyDiy/index.html?gfx=potato&town=1&audio=0#cub' });
    await b.settle();
    b.pill().find(n => n.className === 'uGo').click();
    const a = b.log.find(e => e[0] === 'assign');
    const to = a ? new URL(a[1]) : null;
    check(!!to && to.searchParams.get('v') === 'bbbbbbbbbbbb', 'P4 Update goes to ?v=<server build>', a && a[1]);
    check(!!to && to.origin + to.pathname === 'https://degaror.github.io/flyDiy/index.html', 'P4 ...the same page');
    check(!!to && to.searchParams.get('gfx') === 'potato' && to.searchParams.get('town') === '1' && to.searchParams.get('audio') === '0' && to.hash === '#cub',
      'P4 ...every other parameter and the hash kept');
    const r = new URL(b.U.updateUrl('https://h/flyDiy/dev.html?v=old&x=1', 'new'));
    check(r.searchParams.getAll('v').length === 1 && r.searchParams.get('v') === 'new' && r.searchParams.get('x') === '1', 'P4 an old ?v= is replaced, not doubled (dev.html too)');
  }
  {
    const b = boot({ href: 'https://degaror.github.io/flyDiy/index.html?gfx=potato&v=bbbbbbbbbbbb&town=1#cub' });
    const rs = b.log.find(e => e[0] === 'replaceState');
    const to = rs ? new URL(rs[1]) : null;
    check(!!to && !to.searchParams.has('v') && to.searchParams.get('gfx') === 'potato' && to.searchParams.get('town') === '1' && to.hash === '#cub',
      'P4 the new page strips ?v= at eval, the user\'s parameters and the hash kept', rs && rs[1]);
    check(!!rs && rs[2] && rs[2].k === 1, 'P4 ...and keeps history.state');
    check(b.log.indexOf(rs) < b.log.findIndex(e => e[0] === 'fetch'), 'P4 ...before its first check');
    const c = boot({ href: 'https://degaror.github.io/flyDiy/index.html?gfx=potato' });
    check(!c.log.some(e => e[0] === 'replaceState'), 'P4 no ?v=: the address is left alone');
  }
  // ---- P5 ------------------------------------------------------------------------------------------------------------
  {
    const b = boot({ server: 'bbbbbbbbbbbb', garage: true });
    b.U.onBeforeUpdate(() => b.log.push(['flush']));
    b.U.onBeforeUpdate(() => { throw new Error('a broken flush'); });
    b.U.onBeforeUpdate(() => b.log.push(['flush2']));
    await b.settle();
    b.pill().find(n => n.className === 'uGo').click();
    const k = b.log.map(e => e[0]);
    const iC = k.indexOf('commit'), iF = k.indexOf('flush'), iF2 = k.indexOf('flush2'), iA = k.indexOf('assign');
    check(iC >= 0 && iA > iC, 'P5 the garage\'s autosave (GARAGE_SPEC.commit -> flydiy.wip) runs before the navigation', k.join(','));
    check(iF > 0 && iF < iA && iF2 > 0 && iF2 < iA, 'P5 every registered flush runs before it, a thrown one does not stop the update');
    b.pill() && b.pill().find(n => n.className === 'uGo').click(); b.U.update();
    check(k.length && b.log.filter(e => e[0] === 'assign').length === 1, 'P5 one navigation however often it is pressed');
    check(!b.shown(), 'P5 the pill goes once Update is pressed');
    const P = fs.readFileSync(V('premises_ui.js'), 'utf8');
    check(/UPDATE_NOW\.onBeforeUpdate\(\(\) => \{ if \(!saveT \|\| !storage\) return;[^\n]*storage\.setItem\(LS_WIP/.test(P),
      'P5 premises_ui.js registers its pending autosave as a flush');
    const G = fs.readFileSync(V('garage.js'), 'utf8');
    check(/function commit\(\)[\s\S]{0,400}writeWip\(\)/.test(G) && /touch, commit, onCommit/.test(G), 'P5 GARAGE_SPEC.commit is garage.js\'s autosave (writeWip)');
    const n = boot({ server: 'bbbbbbbbbbbb' });   // no garage on the page (the welcome screen): the update still goes
    await n.settle(); n.U.update();
    check(n.log.some(e => e[0] === 'assign'), 'P5 no garage yet (welcome / loading screen): Update still goes');
  }
  // ---- P6 ------------------------------------------------------------------------------------------------------------
  {
    const b = boot({ server: 'bbbbbbbbbbbb' });
    await b.settle();
    for (let i = 0; i < 4; i++) { b.tick(301e3); const t = b.timers.filter(x => x.live).pop(); if (t) { t.live = false; t.f(); } await b.settle(); }
    check(b.fetches().length === 5 && !b.log.some(e => e[0] === 'assign' || e[0] === 'reload'), 'P6 four timed checks, still no navigation without the press');
    b.pill().find(n => n.className === 'uX').click();
    check(!b.shown(), 'P6 × hides the pill');
    b.tick(60e3); b.W.listeners.focus.forEach(f => f()); await b.settle();
    check(!b.shown(), 'P6 ...for this session and this server build (a later check keeps it hidden)');
    const c = boot({ server: 'bbbbbbbbbbbb' }); c.ss.set('flydiy.updateDismissed', 'bbbbbbbbbbbb'); await c.settle();
    check(!c.shown(), 'P6 a reload of the tab keeps the dismissal (sessionStorage)');
    b.W._server = 'cccccccccccc'; b.tick(60e3); b.W.listeners.focus.forEach(f => f()); await b.settle();
    check(b.shown() && b.pill().textContent.includes('cccccccc'), 'P6 a NEWER server build shows it again');
  }
  // ---- P7 ------------------------------------------------------------------------------------------------------------
  {
    const b = boot({ server: 'aaaaaaaaaaaa' });
    await b.settle();
    const live = () => b.timers.filter(x => x.live);
    check(b.fetches().length === 1 && live().length === 1 && live()[0].ms === 5 * 60 * 1000, 'P7 one check at boot and one 5-min timer');
    const f0 = b.fetches()[0];
    check(/^version\.json\?t=\d+$/.test(f0[1]) && f0[2] && f0[2].cache === 'no-store', 'P7 the check is version.json, no-store, a ?t= past the CDN', f0[1]);
    b.doc.visibilityState = 'hidden'; b.tick(300e3); { const t = live()[0]; t.live = false; t.f(); } await b.settle();
    check(b.fetches().length === 1 && live().length === 1, 'P7 a hidden tab is not checked; the timer re-arms');
    b.doc.visibilityState = 'visible'; b.doc.fire('visibilitychange'); await b.settle();
    check(b.fetches().length === 2, 'P7 the tab comes back: checked at once');
    b.tick(5e3); b.W.listeners.focus.forEach(f => f()); b.doc.fire('visibilitychange'); await b.settle();
    check(b.fetches().length === 2, 'P7 ...at most once every 30 s');
    b.tick(31e3); b.W.listeners.focus.forEach(f => f()); await b.settle();
    check(b.fetches().length === 3, 'P7 focus after 30 s: checked');
    const code = SRC.replace(/\/\/[^\n]*/g, '');
    check(!/requestAnimationFrame|setInterval/.test(code), 'P7 no requestAnimationFrame, no setInterval: one re-armed timer');
    check((code.match(/fetch\(/g) || []).length === 1 && /W\.fetch\('version\.json\?t='/.test(code), 'P7 one URL fetched: version.json');
  }
  // ---- P8 ------------------------------------------------------------------------------------------------------------
  {
    const b = boot({ server: 'bbbbbbbbbbbb', webdriver: true });
    await b.settle();
    check(b.fetches().length === 0 && !b.pill() && b.timers.length === 0, 'P8 a rig: no fetch, no timer, no pill');
    check(!!b.doc.getElementById('bootBuild'), 'P8 ...the loading screen\'s stamp still there');
    const f = boot({ server: 'bbbbbbbbbbbb', webdriver: true, href: 'https://h/flyDiy/index.html?update=1' });
    await f.settle();
    check(f.shown(), 'P8 ?update=1 forces it on a rig');
    const o = boot({ server: 'bbbbbbbbbbbb', href: 'https://h/flyDiy/index.html?update=0' });
    await o.settle();
    check(o.fetches().length === 0 && !o.pill(), 'P8 ?update=0 turns it off');
  }
  // ---- P9 ------------------------------------------------------------------------------------------------------------
  {
    const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), dev = fs.readFileSync(path.join(ROOT, 'dev.html'), 'utf8');
    const ver = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));
    const tagRe = /<script>window\.FLYDIY_BUILD='([0-9a-f]{12})';window\.FLYDIY_BUILD_DATE='([^']+)';<\/script>/;
    const mi = tagRe.exec(idx), md = tagRe.exec(dev);
    check(!!mi && !!md, 'P9 both pages carry the build tag (FLYDIY_BUILD + FLYDIY_BUILD_DATE) as a plain script');
    check(!!mi && mi[1] === ver.build && md && md[1] === ver.build && mi[2] === ver.date && md[2] === ver.date,
      'P9 index.html, dev.html and version.json name the same build and date', mi && (mi[1] + ' ' + ver.build));
    const coreLine = /window\.FLYDIY_BUILD='([0-9a-f]{12})';window\.FLYDIY_AUDIO_SRC/.exec(idx);
    check(!!coreLine && coreLine[1] === ver.build, 'P9 the CORE slot\'s line agrees (storage.js, the parked cook read that one)');
    const iTag = mi ? mi.index : -1, iUpd = idx.indexOf("W.UPDATE_NOW = {"), iWel = idx.indexOf('W.WELCOME = {'),
          iVendor = idx.indexOf('<!--ISLAND-LOADER-->') >= 0 ? idx.indexOf('<!--ISLAND-LOADER-->') : idx.indexOf('window.FLYDIY_BOOT = Promise.resolve()');
    check(iTag >= 0 && iTag < iUpd && iUpd < iWel && iWel < iVendor, 'P9 index.html: the tag, then update_now.js, then welcome.js, all before the vendor / the island loader',
      [iTag, iUpd, iWel, iVendor].join(' < '));
    const upTag = idx.lastIndexOf('<script', iUpd);
    check(upTag >= 0 && idx.slice(upTag, upTag + 8) === '<script>', 'P9 update_now.js is a live script, never the inert text/x-flydiy');
    check(idx.split("W.UPDATE_NOW = {").length === 2, 'P9 update_now.js is in index.html once');
    const dTag = md ? md.index : -1, dUpd = dev.search(/<script src="src\/viewer\/update_now\.js\?v=[0-9a-f]{8}"><\/script>/),
          dWel = dev.search(/<script src="src\/viewer\/welcome\.js\?v=/);
    check(dTag >= 0 && dTag < dUpd && dUpd < dWel, 'P9 dev.html: the tag, then update_now.js (a src ref), then welcome.js');
    const W2 = fs.readFileSync(V('welcome.js'), 'utf8');
    check(/const stampFoot = card =>[\s\S]{0,200}U\.stamp\(\)/.test(W2) && (W2.match(/stampFoot\(card\)/g) || []).length >= 2,
      'P9 welcome.js stamps its card\'s footer (the welcome and the device gate)');
    const ST = fs.readFileSync(V('storage.js'), 'utf8');
    check(/const U = W\.UPDATE_NOW;\s*if \(U && typeof U\.check === 'function'\) return U\.check\(\)/.test(ST), 'P9 storage.js checks through UPDATE_NOW (one fetch path)');
    check(/UPDATE_NOW\.day\(W\.FLYDIY_BUILD_DATE\)/.test(ST), 'P9 the menu\'s line and the shed\'s stamp carry the page\'s date');
  }
  // ---- P10 -----------------------------------------------------------------------------------------------------------
  {
    const SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    const ver = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));
    check(SW.includes('Build ' + ver.build + '.'), 'P10 sw.js names this build (its bytes change with every build: the browser installs it)');
    const keepW = JSON.parse(/const WORLD_KEEP = (.*);/.exec(SW)[1]), keepG = JSON.parse(/const GEO_KEEP = (.*);/.exec(SW)[1]);
    const ORIGIN = 'https://degaror.github.io', BASE = ORIGIN + '/flyDiy/';
    const store = new Map();
    const add = p => store.set(BASE + p, { url: BASE + p });
    const keptWorld = keepW[0], keptGeo = keepG[0];
    if (keptWorld) add(keptWorld);
    if (keptGeo) add(keptGeo);
    add('media/world/jolene/terrain.0123abcd.bin'); add('media/geo/props/old_crate.89abcdef.bin');
    add('media/tex/ground/grass.11223344.ktx2'); add('media/audio/sfx/engine.55667788.mp3');
    const cache = { keys: async () => [...store.values()], delete: async r => store.delete(r.url),
                    match: async () => null, put: async () => {} };
    const L = {};
    let skipped = 0, claimed = 0;
    const self = { addEventListener: (k, f) => { L[k] = f; }, skipWaiting: () => { skipped++; }, clients: { claim: async () => { claimed++; } },
                   location: { origin: ORIGIN } };
    vm.runInNewContext(SW, { self, caches: { open: async () => cache }, URL, fetch: () => Promise.reject(new Error('net')), Response: function () {}, console });
    L.install({ waitUntil: () => {} });
    let done = null; L.activate({ waitUntil: p => { done = p; } }); await done;
    check(skipped === 1 && claimed === 1, 'P10 install skips waiting, activate claims the open pages (the update\'s page is served by the new worker at once)');
    check(!store.has(BASE + 'media/world/jolene/terrain.0123abcd.bin') && !store.has(BASE + 'media/geo/props/old_crate.89abcdef.bin'),
      'P10 the sweep drops the superseded world and mesh entries');
    check((!keptWorld || store.has(BASE + keptWorld)) && (!keptGeo || store.has(BASE + keptGeo)) && keepW.length > 0 && keepG.length > 0,
      'P10 ...keeps this build\'s world and meshes (' + keepW.length + ' + ' + keepG.length + ' in its keep list)');
    check(store.has(BASE + 'media/tex/ground/grass.11223344.ktx2') && store.has(BASE + 'media/audio/sfx/engine.55667788.mp3'),
      'P10 ...and every other media entry (textures, audio: content-hashed, another tab may want them)');
    const answered = u => { let hit = false; L.fetch({ request: { method: 'GET', url: u, headers: { get: () => null } }, respondWith: () => { hit = true; } }); return hit; };
    check(!answered(BASE + 'index.html?v=bbbbbbbbbbbb') && !answered(BASE + 'version.json?t=1') && !answered(BASE + 'dev.html')
      && !answered(BASE + 'src/viewer/app.js?v=12345678') && !answered(BASE + 'sw.js'),
      'P10 the update\'s page, version.json, the scripts and sw.js go to the network (the worker answers none)');
    check(answered(BASE + 'media/tex/ground/grass.11223344.ktx2'), 'P10 media/ stays cache-first');
  }

  console.log('  ' + nOk + ' checks ok' + (fails.length ? ', ' + fails.length + ' FAILED' : ''));
  console.log('GATE UPDATE: ' + (fails.length ? 'FAIL (' + fails.length + ')' : 'PASS'));
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('  FAIL ' + (e && e.stack || e)); console.log('GATE UPDATE: FAIL'); process.exit(1); });
