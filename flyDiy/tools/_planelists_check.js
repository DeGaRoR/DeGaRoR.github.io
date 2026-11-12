#!/usr/bin/env node
// GATE PLANELISTS - THE PLANE LIST (the user 10 Nov: "I do not want to see duplicated planes anymore"; before, the three lists
// of 4 Nov: "you can keep planes for internal testing too, so we have an exhaustive list"). Pure node, ~1 s, no page.
// THE CLASSES: reproduction (REAL-FIGURES' types), story (the story and the career's fleet: the validated Cessnas only),
//   original (the game's own), wip - the player's four, the table below row for row; next (a reproduction's next version),
//   legacy (the test planes the gates fly), archive - the developer's. One row per plane: a file on one row only; nothing a
//   player sees reads review/; the garage has no stock-designs shelf (its presets were copies of listed planes).
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

// the player's classes, the user's (10 Nov, relayed by A0; the plane-list page v4): name -> [class, file]
const CLASSES = {
  "Piper Cub": ["reproduction", "builds/cub_2026-09-20_corrected.json"],
  "Jodel D112": ["reproduction", "builds/jodel_2026-09-20_corrected.json"],
  "Cessna 172": ["reproduction", "builds/cessna172r_2026-11-08.json"],
  "PA-18 on floats": ["reproduction", "builds/pa18_floats_2026-10-23.json"],
  "Carbon Cub SS": ["reproduction", "builds/candidates/carbon_cub_ss.json"],
  "Chinook": ["reproduction", "builds/chinook_2026-09-21_corrected.json"],
  "Super Petrel LS": ["reproduction", "builds/candidates/superpetrel_V4_1.json"],
  "DC-3-alike": ["reproduction", "builds/candidates/dc3_2026-10.json"],
  "Stearman-alike": ["reproduction", "builds/candidates/stearman_2026-10.json"],
  "Tiger Moth-alike": ["reproduction", "builds/candidates/tigermoth_2026-10.json"],
  "Camel-alike": ["reproduction", "builds/candidates/camel_2026-10.json"],
  "Rufus": ["story", "builds/rufus_2026-10-18_certified.json"],
  "Client Cub": ["story", "builds/cub_2026-09-20.json"],
  "Cessna (validated)": ["story", "bugReports/cessnaMetal (1).json"],
  "Cessna on floats (validated)": ["story", "bugReports/cessnaFloatsWOrks.json"],
  "Twin busher floats 4b": ["original", "builds/candidates/Twin_busher_floats_4b.json"],
  "Ultralight twin on floats": ["original", "builds/candidates/build_v7_ultralight_2026-09-05_floats.json"],
  "STOL Cub": ["original", "builds/candidates/stol_cub_showcase.json"],
  "pusherLight": ["original", "builds/candidates/build_v8_pusher_2026-09-11.json"],
  "twinBoomFail": ["original", "builds/candidates/flydiy-build (4).json"],
  "mosquito": ["original", "builds/candidates/mosquito.json"],
  "B-ITES": ["original", "builds/candidates/B-ITES.json"],
  "ugly bi": ["original", "builds/candidates/ugly_bi.json"],
  "Pawnee": ["wip", "builds/candidates/pawnee (1).json"],
  "sailPlane": ["wip", "builds/candidates/sailPlane.json"],
  // (the Ruckus x2 join as reproductions with REAL-FIGURES' ready; the Spitfire and the Skymaster as WIP with the chooser's
  //  shapes ready; the Cessna 172 on floats V2 when the user answers its plan)
};
const PLAYER = ['reproduction', 'story', 'original', 'wip'], ALL = PLAYER.concat(['next', 'legacy', 'archive']);
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
    if (!ALL.includes(p.list)) bad.push(id + ': no class (' + p.list + ')');
    if ((p.file ? 1 : 0) + (p.stock ? 1 : 0) + (p.gen ? 1 : 0) !== 1) bad.push(id + ': not exactly one door');
    if (p.file) {
      if (!exists(p.file)) { if (p.rides) named.push(id + ': ' + p.file + ' rides ' + p.rides); else bad.push(id + ': ' + p.file + ' is not there'); }
      if (!['legacy', 'archive'].includes(p.list) && /review\//.test(p.file)) bad.push(id + ': ' + p.list + ' reads review/');
    }
    if (p.thumb && !thumbs[p.thumb]) bad.push(id + ': no baked picture ' + p.thumb);
  }
  { const seen = {}; for (const p of P) if (p.file) { if (seen[p.file]) bad.push('one plane, one row: ' + p.file + ' on rows ' + seen[p.file] + ' and ' + p.n); seen[p.file] = p.n; } }
  for (let n = 1; n <= 38; n++) if (!nums.has(n)) bad.push('the sheet\'s number ' + n + ' has no row (nothing is deleted)');
  for (const n of Object.keys(CLASSES)) { const r = P.find(p => p.name === n), [c, f] = CLASSES[n]; if (!r || r.list !== c || r.file !== f) bad.push(c + ': ' + n + ' is not ' + f); }
  for (const r of P.filter(p => PLAYER.includes(p.list))) if (!CLASSES[r.name]) bad.push(r.list + ': ' + r.name + ' is not on the table');
  // the pool agrees: a card the rack offers is a player's plane; a hidden card is a test plane or a next version; the pool's
  // official rows (the chooser's own group) are reproductions, story or originals; a lab row is a lab row on the list
  const pool = 'builds/candidates/', row = f => P.find(q => q.file === pool + f);
  for (const c of I.planes) {
    const r = row(c.file);
    if (!r) { bad.push('the pool names ' + c.file + ', the list does not'); continue; }
    if (c.hide && r.list !== c.hide) bad.push('the pool hides ' + c.file + ' as ' + c.hide + ', the list says ' + r.list);
    if (!c.hide && !PLAYER.includes(r.list)) bad.push('the rack offers ' + c.file + ', a ' + r.list + ' plane');
    if (c.official && !['reproduction', 'story', 'original'].includes(r.list)) bad.push('the pool calls ' + c.file + ' official, the list says ' + r.list);
    if (!!c.lab !== !!r.lab) bad.push('the lab flag differs for ' + c.file);
  }
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
  need('garage', /!p\.official && !p\.hide && labOk\(p\) && typeof p\.file === 'string'/, "an official pool row is off the candidate cards (and a lab row, SEA-OFF, and a hidden test plane or next version)");
  need('garage', /const PLAYER_CLASSES = \['reproduction', 'story', 'original', 'wip'\];/, "the player's four classes");
  if (/gfStock/.test(S.garage)) bad.push("garage: the stock-designs shelf is back (the user 10 Nov: no duplicated planes)");
  need('garage', /\.filter\(p => p && p\.official && labOk\(p\)\)/, 'a lab row is off the official pool (SEA-OFF)');
  need('garage', /planeLists, openListed, officialPool,/, 'GARAGE_SPEC carries the lists');
  need('np', /poolCards\(g0\.officialPool, 'official', 'official'\)/, "the chooser's official group (the user 4 Nov: \"yes, both on the chooser\")");
  need('garage', /class="dfPill gfAll">all planes</, "the rack's button");
  need('garage', /\.gfAll'\)\.addEventListener\('click', \(\) => \{ closeFleet\(\); if \(window\.NEW_PLANE\) window\.NEW_PLANE\.open\(\{ all: true \}\)/, 'the button opens the screen');
  need('garage', /for \(const k in p\.over \|\| \{\}\) g\.spec\[k\] = Object\.assign\(\{\}, g\.spec\[k\], p\.over\[k\]\); loadSpec\(g\.spec, ''\)/, 'a row opens unnamed, no plaque, its sections laid over');
  need('np', /g0\.planeLists\(\)\.then\(list =>[\s\S]{0,1400}?g0\.openListed\(p\)/, 'the screen draws the lists and opens through the garage');
  need('np', /const LIST_CLASSES = \[\['reproduction', 'reproductions', 'reproduction'\], \['story', 'story', 'story'\], \['original', 'originals', 'original'\],\s*\['wip', 'work in progress', 'work in progress'\], \['next', /, 'the classes, each its heading and its word');
  if (/plane_lists/.test(S.core)) bad.push('core: the career, the Market and the contracts must not read the lists');
  // internal + notes: the dev's, the garage's own filter on stubs
  const m = /const LISTS_FILE = [\s\S]*?const planeLists = \(\) => \{[\s\S]*?\n  \};/.exec(S.garage);
  if (!m) bad.push('garage: planeLists not found');
  else {
    const run = async (pathname, dev) => {
      const box = { window: { location: { pathname }, WELCOME: { mode: { dev } } }, labOk: q => !q.lab, Object, Array, Promise, fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ planes: [{ list: 'reproduction', name: 'A', note: 'n', file: 'a.json' }, { list: 'legacy', name: 'B', note: 'n', file: 'b.json' }, { list: 'original', name: 'C', lab: true, file: 'c.json' }] }) }) };
      return vm.runInNewContext(m[0] + '\nplaneLists();', box);
    };
    return Promise.all([run('/index.html', false), run('/dev.html', false), run('/index.html', true)]).then(([player, devHtml, devCareer]) => {
      if (player.length !== 1 || player[0].list !== 'reproduction' || player[0].note || player[0].tip) bad.push('a player must read neither legacy, a lab row nor the notes');
      if (devHtml.length !== 3 || !devHtml[0].note || !devHtml[0].tip) bad.push('dev.html lost legacy or the notes');
      if (devCareer.length !== 3) bad.push('the dev career lost legacy');
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
  console.log('GATE PLANELISTS - ' + L.length + ' rows: ' + ALL.map(k => k + ' ' + L.filter(p => p.list === k).length).join(', '));
  for (const n of named) console.log('  NAMED ' + n);
  if (SELF) {
    const red = async (what, r) => { r = await r; console.log('  selftest ' + what + ': ' + (r.length ? 'red (ok)' : 'GREEN - the check is inert')); if (!r.length) bad.push('selftest inert: ' + what); };
    const edit = fn => { const o = JSON.parse(lists); fn(o); return JSON.stringify(o); };
    const rows = (l, i) => listRows(l, i || index, thumbs, exists, contractFiles);
    await red('a sheet number deleted', rows(edit(o => { o.planes = o.planes.filter(p => p.n !== 31); })));
    await red('a file not there', rows(edit(o => { o.planes.find(p => p.n === 9).file = 'builds/nope.json'; })));
    await red('a reproduction names another file', rows(edit(o => { o.planes.find(p => p.n === 50).file = 'builds/cessna172_2026-09-20.json'; })));
    await red('a test plane back on a player class', rows(edit(o => { o.planes.find(p => p.n === 3).list = 'reproduction'; })));
    await red('a reproduction off to legacy', rows(edit(o => { o.planes.find(p => p.n === 9).list = 'legacy'; })));
    await red('one plane on two rows', rows(edit(o => { o.planes.find(p => p.n === 48).file = 'builds/cub_2026-09-20_corrected.json'; })));
    await red('a hidden test plane back on the rack', rows(lists, index.replace('"hide": "legacy", ', '')));
    await red('the Client Cub row off the story (bare again)', rows(edit(o => { o.planes.find(p => p.n === 26).over.paint = { job: 'bare' }; })));
    await red('a player plane reading review/', rows(edit(o => { o.planes.find(p => p.n === 38).file = 'builds/candidates/review/stol_cub_kit.json'; })));
    await red('a Market file gone', listRows(lists, index, thumbs, f => f !== contractFiles[0] && exists(f), contractFiles));
    await red('the filter shows internal to a player', pageRows(Object.assign({}, S, { garage: S.garage.replace("(dev || (PLAYER_CLASSES.includes(p.list) && labOk(p)))", 'true') })));
    await red('the stock shelf back', pageRows(Object.assign({}, S, { garage: S.garage + '\n<div class="gfStock"></div>' })));
    await red('the rack without its button', pageRows(Object.assign({}, S, { garage: S.garage.replace('gfAll">all planes<', 'gfAll"><') })));
    await red('the chooser without its official group', pageRows(Object.assign({}, S, { np: S.np.replace("poolCards(g0.officialPool, 'official', 'official')", '0') })));
    await red('R1 undone', pageRows(Object.assign({}, S, { css: S.css.replace('--ws-right:0px !important', '--ws-right:0px') })));
    await red('R2 undone', pageRows(Object.assign({}, S, { app: S.app.replace('!!(window.NEW_PLANE && window.NEW_PLANE.isOpen && window.NEW_PLANE.isOpen())', 'false') })));
  }
  for (const b of bad) console.log('  FAIL ' + b);
  console.log('GATE PLANELISTS: ' + (bad.length ? 'FAIL' : 'PASS'));
  process.exit(bad.length ? 1 : 0);
})();
