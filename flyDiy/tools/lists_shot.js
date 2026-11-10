#!/usr/bin/env node
// lists_shot.js - EVERY PLANE LIST A PLAYER SEES, PICTURED (PLANE-RENDERS, the user 8 Nov: "where are we on just seeing the
// planes rather than seeing the names listed in the game?"). The real page (index.html served by tools/_serve.js, started
// here) in Chrome through the DevTools protocol (plane_shot.js's rig: --gpu the graphics card in a real window, else headless
// SwiftShader; no playwright needed), one still per list, each with a census of what its rows show - a picture (baked:
// media/thumbs/; the player's own: a data: URL drawn by PLANE_THUMB) or only a glyph / a name.
//   garage_fleet     the garage's plane list (THE FLEET, the Load button)
//   new_plane        the new-aeroplane chooser's first page (NEW_PLANE.open())
//   all_planes       All planes (NEW_PLANE.open({ all: true })), + all_planes_mid scrolled halfway
//   archetypes       the archetype tiles (DESIGN_FLOW.openBirth)
//   career_storage   ?career=1: the storage panel's cards (the career's planes)
//   map_market       ?career=1: the map's Market list
//   map_fleet        ?career=1: the map's Fleet list
// The sandbox page is seeded with three saved planes (the validated Cub, Jodel and Cessna envelopes); the Cub put on the
// stand by the fleet's own Load, then 25 s for its live picture - so the fleet shows one drawn row beside never-drawn ones,
// as a player's own saves do until each has been on the stand once.
//
//   node tools/lists_shot.js [--gpu] [--port 8731] [--out <dir>] [--only sandbox,career]   (a box run: one Chrome at a time)
'use strict';
const fs = require('fs'), path = require('path'), net = require('net'), os = require('os'), { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(opt('out', path.join(ROOT, 'reports', 'evidence', 'LISTS')));
const GPU = argv.includes('--gpu'), PORT = +opt('port', 8731), ONLY = opt('only', 'sandbox,career').split(',');
const URL0 = 'http://127.0.0.1:' + PORT + '/flyDiy/index.html?audio=0';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const env = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'builds', f), 'utf8'));
const SHELF = { 'My Cub': env('cub_2026-09-20_corrected.json'), 'My Jodel': env('jodel_2026-09-20_corrected.json'),
                'My Cessna': env('cessna172_2026-09-20_corrected.json') };
for (const n of Object.keys(SHELF)) { SHELF[n].name = n; if (SHELF[n].spec && SHELF[n].spec.meta) SHELF[n].spec.meta.name = n; }

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = spawn(process.execPath, [path.join(__dirname, '_serve.js'), String(PORT), path.join(ROOT, '..')], { stdio: 'ignore' });
  const index = [], errs = [], procs = [srv];
  const chrome = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                  '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => fs.existsSync(p));
  if (!chrome) { console.log('LISTS_SHOT FAIL no Chrome'); srv.kill(); process.exit(1); }
  const freePort = () => new Promise((res, rej) => { const q = net.createServer(); q.listen(0, '127.0.0.1', () => { const p = q.address().port; q.close(() => res(p)); }); q.on('error', rej); });
  // one page: Chrome on a fresh profile, its tab driven by the DevTools protocol
  async function openPage(seed, tag) {
    const port = await freePort(), udd = fs.mkdtempSync(path.join(os.tmpdir(), 'listsshot_'));
    const args = ['--remote-debugging-port=' + port, '--user-data-dir=' + udd, '--no-first-run', '--no-default-browser-check', '--ignore-gpu-blocklist',
      '--window-size=1600,900', '--window-position=0,0', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows', '--hide-scrollbars'];
    if (!GPU) args.push('--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader');
    args.push('about:blank');
    const proc = spawn(chrome, args, { stdio: 'ignore' }); procs.push(proc);
    let ok = false;
    for (let i = 0; i < 60 && !ok; i++) { try { ok = !!(await (await fetch('http://127.0.0.1:' + port + '/json/version')).json()); } catch (e) { await sleep(500); } }
    if (!ok) throw new Error('no DevTools port');
    const tab = await (await fetch('http://127.0.0.1:' + port + '/json/new?about:blank', { method: 'PUT' })).json();
    const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0; const waits = new Map();
    const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
      if (m.method === 'Runtime.exceptionThrown') errs.push(tag + ': ' + String((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text || '').split('\n')[0].slice(0, 160));
      if (m.method === 'Page.javascriptDialogOpening') cmd('Page.handleJavaScriptDialog', { accept: true });
    };
    await cmd('Page.enable'); await cmd('Runtime.enable');
    if (seed) await cmd('Page.addScriptToEvaluateOnNewDocument', { source: seed });
    return {
      goto: url => cmd('Page.navigate', { url }),
      // evaluate(fn, arg): the function's source called with its argument (JSON), awaited, its value back
      evaluate: async (fn, arg) => {
        const r = await cmd('Runtime.evaluate', { expression: '(' + fn.toString() + ')(' + JSON.stringify(arg === undefined ? null : arg) + ')', awaitPromise: true, returnByValue: true, timeout: 60000 });
        if (r.error) throw new Error(r.error.message);
        if (r.result && r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.text);
        return r.result && r.result.result ? r.result.result.value : undefined;
      },
      screenshot: async o => { const r = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: o.quality || 88 }); if (!r.result) throw new Error('no capture'); fs.writeFileSync(o.path, Buffer.from(r.result.data, 'base64')); },
      close: () => { try { ws.close(); } catch (e) {} try { proc.kill(); } catch (e) {} },
    };
  }
  const ev = (pg, fn, arg) => pg.evaluate(fn, arg).catch(e => ({ error: String(e.message || e).slice(0, 200) }));
  const until = async (pg, fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await ev(pg, fn); if (v && !v.error) return true; await sleep(500); } return false; };
  const loaded = async pg => {
    const t0 = Date.now();
    const ok = await until(pg, () => window.BOOT && BOOT.state === 'gone' && (() => { const b = document.getElementById('boot'); return !b || b.hidden || getComputedStyle(b).display === 'none' || b.classList.contains('gone'); })(), 300000);
    await sleep(2500);
    console.log('  loaded ' + ok + ' in ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
    return ok;
  };
  // what the list's rows show: pictures (baked / drawn here) vs glyphs; within <sel> when given
  const census = (pg, sel) => ev(pg, s => {
    const box = s ? document.querySelector(s) : document.body;
    if (!box) return { box: false };
    const vis = e => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 && getComputedStyle(e).visibility !== 'hidden'; };
    const imgs = [...box.querySelectorAll('img')].filter(vis);
    const baked = imgs.filter(i => /media\/thumbs\//.test(i.src)).length, heroes = imgs.filter(i => /media\/heroes\//.test(i.src)).length;
    const drawn = imgs.filter(i => /^(data|blob):/.test(i.src)).length;
    const glyphs = [...box.querySelectorAll('canvas.hsThumb, i.mmIc, .npGlyph, .dfGlyph')].filter(vis).length;
    const rows = [...box.querySelectorAll('button.gfLoad, [data-thumb], .hsCard, .mmRowI')].filter(vis);
    const rowsNoPic = rows.filter(r => !r.querySelector('img')).map(r => (r.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40));
    return { box: true, open: vis(box), rows: rows.length, rowsWithPic: rows.length - rowsNoPic.length, rowsNoPic, imgs: imgs.length, baked, heroes, drawn, glyphs, text: (box.innerText || '').replace(/\s+/g, ' ').slice(0, 300) };
  }, sel);
  const shot = async (pg, name, sel, note) => {
    await sleep(1500);
    const f = 'list_' + name + '.jpg';
    try { await pg.screenshot({ path: path.join(OUT, f), quality: 88 }); } catch (e) { console.log('  ' + f + ' NOT TAKEN: ' + e.message.slice(0, 120)); return; }
    const c = await census(pg, sel);
    index.push({ name, file: f, note, census: c });
    console.log('  ' + f + '  ' + JSON.stringify(Object.assign({}, c, { text: undefined })) + '  ' + note);
  };
  const click = (pg, s) => ev(pg, q => { const b = document.querySelector(q); if (b) b.click(); return !!b; }, s);

  if (ONLY.includes('sandbox')) {
    const seed = '(' + (shelf => { try { if (!sessionStorage.getItem('lsSeeded')) { for (const n of Object.keys(shelf)) localStorage.setItem('flydiy.build.' + n, JSON.stringify(shelf[n])); sessionStorage.setItem('lsSeeded', '1'); } } catch (e) {} }).toString() + ')(' + JSON.stringify(SHELF) + ')';
    const pg = await openPage(seed, 'sandbox');
    await pg.goto(URL0);
    if (await loaded(pg)) {
      await ev(pg, () => { try { if (window.NEW_PLANE && NEW_PLANE.isOpen()) NEW_PLANE.close(); } catch (e) {} const b = [...document.querySelectorAll('#dfBirth button')].find(e => /keep the current/i.test(e.textContent)); if (b) b.click(); });
      await sleep(800);
      // the Cub on the stand through the fleet's own Load, then its live picture's time
      await click(pg, '#gLoad'); await sleep(1200);
      const loadedCub = await ev(pg, () => { const b = [...document.querySelectorAll('#gFleet button.gfLoad')].find(e => /My Cub/.test(e.textContent)); if (b) b.click(); return !!b; });
      console.log('  the Cub loaded by the fleet: ' + JSON.stringify(loadedCub));
      const drew = await until(pg, () => window.PLANE_THUMB && PLANE_THUMB.get('mine:My Cub'), 25000);
      console.log('  its picture drawn: ' + drew);
      await ev(pg, () => { try { if (window.NEW_PLANE && NEW_PLANE.isOpen()) NEW_PLANE.close(); } catch (e) {} });
      if (!(await ev(pg, () => { const f = document.getElementById('gFleet'); return !!(f && !f.hidden); }))) await click(pg, '#gLoad');
      await shot(pg, 'garage_fleet', '#gFleet', 'the garage\'s plane list (Load): three saved planes, the Cub put on the stand once');
      await ev(pg, () => { const f = document.getElementById('gFleet'); if (f) f.hidden = true; });
      await ev(pg, () => window.NEW_PLANE && NEW_PLANE.open()); await sleep(2500);
      await shot(pg, 'new_plane', null, 'the new-aeroplane chooser, its first page');
      await ev(pg, () => { NEW_PLANE.close(); NEW_PLANE.open({ all: true }); }); await sleep(3500);
      await shot(pg, 'all_planes', null, 'All planes');
      await ev(pg, () => { const s = [...document.querySelectorAll('*')].find(e => e.scrollHeight > e.clientHeight + 200 && /auto|scroll/.test(getComputedStyle(e).overflowY) && e.getBoundingClientRect().height > 300); if (s) s.scrollTop = s.scrollHeight / 2; });
      await shot(pg, 'all_planes_mid', null, 'All planes, scrolled to the middle');
      await ev(pg, () => { try { NEW_PLANE.close(); } catch (e) {} try { DESIGN_FLOW.openBirth(); } catch (e) {} }); await sleep(2000);
      await shot(pg, 'archetypes', '#dfBirth', 'the archetype tiles (NEW AEROPLANE: start from an archetype)');
    }
    pg.close(); await sleep(1500);
  }
  if (ONLY.includes('career')) {
    const pg = await openPage(null, 'career');
    await pg.goto(URL0 + '&career=1');
    if (await loaded(pg)) {
      await ev(pg, () => { try { if (window.NEW_PLANE && NEW_PLANE.isOpen()) NEW_PLANE.close(); } catch (e) {} });
      await click(pg, '#fbName'); await sleep(400);
      const st = await click(pg, '#gStore'); await sleep(2000);
      if (st === true) await shot(pg, 'career_storage', '#hsStore', 'the career\'s storage panel: the career\'s planes as cards');
      else console.log('  no #gStore on the career page');
      await ev(pg, () => { const s = document.getElementById('hsStore'); if (s) s.hidden = true; try { window.STORAGE_UI && STORAGE_UI.close && STORAGE_UI.close(); } catch (e) {} });
      await until(pg, () => !!document.getElementById('mapEntry'), 60000);
      await click(pg, '#mapEntry');
      await until(pg, () => !!document.getElementById('mapScreen') && window.MAP_MENU && MAP_MENU.model(), 90000);
      await sleep(1500);
      await click(pg, '#mapScreen .mmSwB[data-list="market"]'); await sleep(2500);
      await shot(pg, 'map_market', '#mapScreen', 'the map\'s Market list');
      await click(pg, '#mapScreen .mmSwB[data-list="fleet"]'); await sleep(2500);
      await shot(pg, 'map_fleet', '#mapScreen', 'the map\'s Fleet list (the career\'s planes)');
    }
    pg.close(); await sleep(1500);
  }
  for (const p of procs) try { p.kill(); } catch (e) {}
  fs.writeFileSync(path.join(OUT, 'lists.json'), JSON.stringify({ what: 'lists_shot: every plane list a player sees', when: new Date().toISOString(), shots: index, errs }, null, 1));
  console.log('LISTS_SHOT ' + index.length + ' stills, ' + errs.length + ' page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  process.exit(0);
})().catch(e => { console.log('LISTS_SHOT FAIL ' + (e && e.stack || e)); process.exit(1); });
