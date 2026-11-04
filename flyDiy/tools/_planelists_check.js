#!/usr/bin/env node
// GATE PLANELISTS - the three lists (the user 4 Nov, off the all-planes sheet: "you can keep planes for internal testing
// too, so we have an exhaustive list"). Pure node, ~1 s, no page.
//
// THE LISTS (builds/lists/plane_lists.json): every row one list, one door and a unique name; a row's file exists and is a
//   build (a row whose file rides another ready branch is named, not red); every number of the sheet (1-38) still has its
//   row: nothing deleted. The Official list is the table below, row for row (the user's, relayed by A0).
// THE POOL AGREES: the Candidates list is builds/candidates/index.json's rows without official: true, the pool's official
//   rows are on the Official list, and no official or candidate row reads review/ (a plane left there is internal).
// THE MARKET IS NOT TOUCHED: every CONTRACT_DESIGNS file still exists (a plane retired from the list keeps its row in the
//   Market and the contracts), and the core does not name the lists.
// THE PAGE (source rows): the garage reads the file, internal + notes for the dev only (the filter run on stubs); the rack
//   has the button; new_plane.js draws the groups and opens through openListed (the flow itself: GATE NEWPLANE's DOM stub).
// THE EMPTY STAND (EMPTY-STAND-RELOOK): R1 the view takes the columns' room over the editor's inline --ws-right; R2 the menu
//   stands aside while the chooser is up, so Escape is the chooser's.
//
//   node tools/_planelists_check.js [--selftest]  -> "GATE PLANELISTS: PASS|FAIL"
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SELF = process.argv.includes('--selftest');

const OFFICIAL = {
  'Piper Cub': 'builds/cub_2026-09-20_corrected.json',
  'Jodel D112': 'builds/jodel_2026-09-20_corrected.json',
  'Metal Cessna': 'builds/cessna172_2026-09-20.json',
  'Metal Cessna on floats': 'builds/cessna172_floats_2026-11.json',
  'Twin busher floats 4b': 'builds/candidates/Twin_busher_floats_4b.json',
  'Rufus': 'builds/rufus_2026-10-18_certified.json',
  'Chinook': 'builds/chinook_2026-09-21_corrected.json',
  'STOL Cub': 'builds/candidates/stol_cub_showcase.json',
  'PA-18 on floats': 'builds/pa18_floats_2026-10-23.json',
  'Client Cub': 'builds/cub_2026-09-20.json',
};
const named = [];

function listRows(lists, index, thumbs, exists, contractFiles) {
  const bad = [];
  let L = null, I = null;
  try { L = JSON.parse(lists); } catch (e) { return ['plane_lists.json does not parse: ' + e.message]; }
  try { I = JSON.parse(index); } catch (e) { return ['index.json does not parse']; }
  if (!L || L.what !== 'flydiy-plane-lists' || !Array.isArray(L.planes)) return ['plane_lists.json is not a flydiy-plane-lists file'];
  const P = L.planes, nums = new Set(), names = new Set();
  for (const p of P) {
    const id = p.n + ' ' + p.name;
    if (nums.has(p.n)) bad.push('number ' + p.n + ' twice'); nums.add(p.n);
    if (!p.name || names.has(p.name)) bad.push('name missing or twice: ' + id); names.add(p.name);
    if (!['official', 'candidates', 'internal'].includes(p.list)) bad.push(id + ': no list');
    if ((p.file ? 1 : 0) + (p.stock ? 1 : 0) + (p.gen ? 1 : 0) !== 1) bad.push(id + ': not exactly one door');
    if (p.file) {
      if (!exists(p.file)) { if (p.rides) named.push(id + ': ' + p.file + ' rides ' + p.rides); else bad.push(id + ': ' + p.file + ' is not there'); }
      if (p.list !== 'internal' && /review\//.test(p.file)) bad.push(id + ': ' + p.list + ' reads review/');
    }
    if (p.thumb && !thumbs[p.thumb]) bad.push(id + ': no baked picture ' + p.thumb);
  }
  for (let n = 1; n <= 38; n++) if (!nums.has(n)) bad.push('the sheet\'s number ' + n + ' has no row (nothing is deleted)');
  const off = P.filter(p => p.list === 'official');
  for (const n of Object.keys(OFFICIAL)) { const r = off.find(p => p.name === n); if (!r || r.file !== OFFICIAL[n]) bad.push('Official: ' + n + ' is not ' + OFFICIAL[n]); }
  for (const r of off) if (!OFFICIAL[r.name]) bad.push('Official: ' + r.name + ' is not on the table');
  // the pool agrees
  const pool = 'builds/candidates/';
  const inList = new Set(P.filter(p => p.list === 'candidates').map(p => p.file));
  const cards = I.planes.filter(p => !p.official).map(p => pool + p.file);
  for (const f of cards) if (!inList.has(f)) bad.push('the pool offers ' + f + ', not on the Candidates list');
  for (const f of inList) if (!cards.includes(f)) bad.push('Candidates: ' + f + ' is not on the candidate cards');
  for (const p of I.planes.filter(p => p.official)) if (!off.some(r => r.file === pool + p.file)) bad.push('the pool calls ' + p.file + ' official, the list does not');
  for (const r of off) if (r.file.startsWith(pool) && !I.planes.some(p => p.official && pool + p.file === r.file)) bad.push(r.name + ' is official and still on the candidate cards');
  for (const f of contractFiles) if (!exists(f)) bad.push('CONTRACT_DESIGNS reads ' + f + ': gone');
  // the Client Cub's row is what the career hands over (the sandbox has no career core: the row carries it)
  const cc = P.find(p => p.name === 'Client Cub');
  if (cc && cc.file && exists(cc.file)) {
    const file = JSON.parse(read(cc.file)).spec, laid = JSON.parse(JSON.stringify(file));
    for (const k in cc.over || {}) laid[k] = Object.assign({}, laid[k], cc.over[k]);
    if (JSON.stringify(laid) !== JSON.stringify(require('./flight_core.js').storyClientSpec(file))) bad.push('Client Cub: the row is not storyClientSpec of its file');
  }
  return bad;
}

function pageRows(S) {
  const bad = [];
  const need = (src, re, what) => { if (!re.test(S[src])) bad.push(src + ': ' + what); };
  need('garage', /const LISTS_FILE = 'builds\/lists\/plane_lists\.json'/, 'the lists are read from the repo file');
  need('garage', /!p\.official && typeof p\.file === 'string'/, "an official pool row is off the candidate cards");
  need('garage', /planeLists, openListed,/, 'GARAGE_SPEC carries the lists');
  need('garage', /class="dfPill gfAll">all planes</, "the rack's button");
  need('garage', /\.gfAll'\)\.addEventListener\('click', \(\) => \{ closeFleet\(\); if \(window\.NEW_PLANE\) window\.NEW_PLANE\.open\(\{ all: true \}\)/, 'the button opens the screen');
  need('garage', /for \(const k in p\.over \|\| \{\}\) g\.spec\[k\] = Object\.assign\(\{\}, g\.spec\[k\], p\.over\[k\]\); loadSpec\(g\.spec, ''\)/, 'a row opens unnamed, no plaque, its sections laid over');
  need('np', /g0\.planeLists\(\)\.then\(list =>[\s\S]{0,1400}?g0\.openListed\(p\)/, 'the screen draws the lists and opens through the garage');
  need('np', /\['official', 'official'\], \['candidates', 'candidate'\], \['internal', 'internal testing'\]/, 'the three groups, each row its word');
  if (/plane_lists/.test(S.core)) bad.push('core: the career, the Market and the contracts must not read the lists');
  // internal + notes: the dev's, the garage's own filter on stubs
  const m = /const LISTS_FILE = [\s\S]*?const planeLists = \(\) => \{[\s\S]*?\n  \};/.exec(S.garage);
  if (!m) bad.push('garage: planeLists not found');
  else {
    const run = async (pathname, dev) => {
      const box = { window: { location: { pathname }, WELCOME: { mode: { dev } } }, Object, Array, Promise, fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ planes: [{ list: 'official', name: 'A', note: 'n', file: 'a.json' }, { list: 'internal', name: 'B', note: 'n', file: 'b.json' }] }) }) };
      return vm.runInNewContext(m[0] + '\nplaneLists();', box);
    };
    return Promise.all([run('/index.html', false), run('/dev.html', false), run('/index.html', true)]).then(([player, devHtml, devCareer]) => {
      if (player.length !== 1 || player[0].list !== 'official' || player[0].note || player[0].tip) bad.push('a player must read neither internal nor the notes');
      if (devHtml.length !== 2 || !devHtml[0].note || !devHtml[0].tip) bad.push('dev.html lost internal or the notes');
      if (devCareer.length !== 2) bad.push('the dev career lost internal');
      return stand(S, bad);
    }, e => { bad.push('the filter did not run: ' + e.message); return stand(S, bad); });
  }
  return Promise.resolve(stand(S, bad));
}
function stand(S, bad) {
  if (!/body\.mode-ws\.gEmpty, body\.mode-ws\.gEmpty\.info-off \{ --ws-left:0px !important; --ws-right:0px !important; \}/.test(S.css)) bad.push("editor.css: R1, the empty stand's view must beat the inline --ws-right");
  const g = /const gmBusy = \(\) => \{[\s\S]*?\n  \};/.exec(S.app);
  if (!g || !/window\.NEW_PLANE\.isOpen\(\)/.test(g[0])) bad.push('app.js: R2, gmBusy must count the chooser');
  return bad;
}

(async () => {
  const LF = 'builds/lists/plane_lists.json', IX = 'builds/candidates/index.json';
  const lists = read(LF), index = read(IX);
  let thumbs = JSON.parse(read('media/thumbs/index.json')); thumbs = thumbs.thumbs || thumbs.planes || thumbs;
  const exists = f => fs.existsSync(path.join(ROOT, f));
  const C = require('./flight_core.js');
  const contractFiles = Object.values(C.CONTRACT_DESIGNS).map(d => d.build).filter(Boolean);
  const coreDir = path.join(ROOT, 'src', 'core');
  const S = { garage: read('src/viewer/garage.js'), np: read('src/viewer/new_plane.js'), css: read('src/viewer/editor.css'), app: read('src/viewer/app.js'),
    core: fs.readdirSync(coreDir).filter(f => /\.js$/.test(f)).map(f => fs.readFileSync(path.join(coreDir, f), 'utf8')).join('\n') };
  const bad = listRows(lists, index, thumbs, exists, contractFiles).concat(await pageRows(S));
  const L = JSON.parse(lists).planes;
  console.log('GATE PLANELISTS - ' + L.length + ' rows: ' + ['official', 'candidates', 'internal'].map(k => k + ' ' + L.filter(p => p.list === k).length).join(', '));
  for (const n of named) console.log('  NAMED ' + n);
  if (SELF) {
    const red = async (what, r) => { r = await r; console.log('  selftest ' + what + ': ' + (r.length ? 'red (ok)' : 'GREEN - the check is inert')); if (!r.length) bad.push('selftest inert: ' + what); };
    const edit = fn => { const o = JSON.parse(lists); fn(o); return JSON.stringify(o); };
    const rows = (l, i) => listRows(l, i || index, thumbs, exists, contractFiles);
    await red('a sheet number deleted', rows(edit(o => { o.planes = o.planes.filter(p => p.n !== 31); })));
    await red('a file not there', rows(edit(o => { o.planes.find(p => p.n === 9).file = 'builds/nope.json'; })));
    await red('official names another file', rows(edit(o => { o.planes.find(p => p.n === 5).file = 'bugReports/cessnaMetal (1).json'; })));
    await red('a retired plane back on Official', rows(edit(o => { o.planes.find(p => p.n === 3).list = 'official'; })));
    await red('a candidate off the list', rows(edit(o => { o.planes.find(p => p.n === 9).list = 'internal'; })));
    await red('a flagship back on the cards', rows(lists, index.replace(/, "official": ?true/, '')));
    await red('the Client Cub row off the story', rows(edit(o => { o.planes.find(p => p.n === 26).over.paint.job = 'full'; })));
    await red('a Market file gone', listRows(lists, index, thumbs, f => f !== contractFiles[0] && exists(f), contractFiles));
    await red('the filter shows internal to a player', pageRows(Object.assign({}, S, { garage: S.garage.replace("(dev || p.list !== 'internal')", 'true') })));
    await red('the rack without its button', pageRows(Object.assign({}, S, { garage: S.garage.replace('gfAll">all planes<', 'gfAll"><') })));
    await red('R1 undone', pageRows(Object.assign({}, S, { css: S.css.replace('--ws-right:0px !important', '--ws-right:0px') })));
    await red('R2 undone', pageRows(Object.assign({}, S, { app: S.app.replace('!!(window.NEW_PLANE && window.NEW_PLANE.isOpen && window.NEW_PLANE.isOpen())', 'false') })));
  }
  for (const b of bad) console.log('  FAIL ' + b);
  console.log('GATE PLANELISTS: ' + (bad.length ? 'FAIL' : 'PASS'));
  process.exit(bad.length ? 1 : 0);
})();
