#!/usr/bin/env node
// _names_check.js - GATE NAMES (G3240-G3249 NAMES, 2026-10-22; GAME-PLAN-2026-10-15 §R and §13). The user, 15 Oct:
// "Everything should have a fictional name, I don't want to get in hot waters with some Indian community thing."
//   node tools/_names_check.js [--selftest]      -> "GATE NAMES: PASS|FAIL"
//
// Holds that no REAL name listed below is SHOWN, read four ways:
//   1 THE SOURCE'S TEXT: every string literal (comments are skipped: they are never shown) of src/core/*.js and
//     src/viewer/**/*.js, the JSON the page shows from (shots_pack.json, the voice script's lines, world_packs' island
//     names), and every string of the island record (tools/fixtures/island_jolene.json: the runways, sites, roads,
//     junctions - what the scenery editor and the composed world show);
//   2 THE BUILT PAGE: the string literals of index.html's inline scripts and of the chunks written beside it
//     (career_core.<h8>.js, route_draw.<h8>.js), and index.html's markup text outside them;
//   3 THE TEXT TABLES, evaluated (tools/flight_core.js): GAME_NAMES (src/core/01_names.js, THE ONE TABLE), the contract
//     fields and every CONTRACT_TEXT line, the plot words (BASE_OFFERS), the beacons (NAV_FIXES), the story's beats and
//     Tim's lines, the pilots' text; the loading screen's cards (BOOT_CARDS over the table, as the BOOT block runs
//     them); the map (MAP_PACK: the aerodromes, the places, the labels, the credit);
//   4 THE USER'S OWN SAVE: a record still carrying an old name (the user's localStorage copy of the scenery: the
//     fixture is never re-revved over it) shows the table's - every field the table names, through
//     PREMISES_GEN.runwayAerodrome and contractFieldsOf.
// A HOLD is a real name that cannot be fixed from text (a painted sign's picture, a recorded voice line): each is named
// below with its owner, printed every run, and a hold that no longer matches anything FAILS (the list stays honest).
// `--selftest`: doctored inputs (a brief, the table, the record, a card, the page, a stale hold, the override undone,
// a comment that must stay green), each must go red except the comment.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const SELF = process.argv.includes('--selftest');

// ---- THE REAL NAMES held out (the user's table, then the G3240 audit's finds) -----------------------------------------
const REAL = [
  ['Annette', 'the island (Jolene)'], ['Metlakatla', 'the town (Cedar Harbour)'], ['Tamgas', 'the hill and the summit (Ridgeback, Mount Ardent)'],
  ['Jumbo', 'the mine (Copperhead Mine)'],
  ['Alaska', 'a real state (the island is Jolene)'], ['Tongass', 'a real forest / borough'], ['Ketchikan', 'a real town'], ['Tsimshian', 'a real people'],
  ['Walden', 'a real point on the island'], ['Duncan', 'a real person (William Duncan)'], ['Richard Johnson', 'a real person'],
  ['Alaska Commercial', 'a real company'], ["Al's American", 'a real cafe'], ['United States Postal Service', 'a real organisation'],
  ['Shadow Mountain', 'a real business'], ['Southeast Winds', 'a real business'], ['MIC', 'the real community\'s initials'],
  ['Indian Community', 'the real community'], ['Ceremonial Grounds', 'the real community\'s grounds'],
];
const RE = REAL.map(([w]) => [w, new RegExp('(^|[^A-Za-z])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z])')]);
const realIn = s => { const out = []; for (const [w, r] of RE) if (r.test(s)) out.push(w); return out; };

// ---- THE HOLDS: shown, real, and not fixable from text - the owner re-makes the asset ----------------------------------
const HOLDS = [
  { file: /^src\/viewer\/sign_tex\.js$/, text: 'Tongass Marine Supply', owner: 'A0 / the user',
    why: 'a PAINTED sign (assets/billboards, the user\'s own picture; sign_tex.js is sign_prep.js\'s output): the board shows the words - repaint it (proposed: Harbour Marine Supply) and re-run tools/sign_prep.js' },
  { file: /^media\/audio\/voice\/radio_script\.[0-9a-f]{8}\.json$/, text: 'After this rain, Tamgas Hill strip will be soft', owner: 'A0',
    why: 'a RECORDED voice line (wx.softStrip.1): the mp3 says the old name - re-voice it as "Ridgeback strip" (tools/audio/voice_render.py, local) or drop the line' },
];

// ---- a JS source's string literals (comments skipped); a template's text parts; the regex literals read past --------
function strings(src) {
  const out = []; let i = 0, line = 1, prev = '';
  const n = src.length;
  const regexOk = () => prev === '' || /[(,=:[!&|?{};+\-*%<>~^]$/.test(prev) || /^(return|typeof|case|in|of|delete|void|throw|new|else|do|yield|await)$/.test(prev);
  function readStr(q) { let s = ''; const st = line; i++; while (i < n) { const c = src[i]; if (c === '\\') { if (src[i + 1] === '\n') line++; else s += src[i + 1]; i += 2; continue; } if (c === q) { i++; break; } if (c === '\n') { line++; break; } s += c; i++; } return { s, line: st }; }
  function readTpl() {
    let s = '', st = line; i++;
    while (i < n) {
      const c = src[i];
      if (c === '\\') { s += src[i + 1]; i += 2; continue; }
      if (c === '`') { i++; break; }
      if (c === '$' && src[i + 1] === '{') { out.push({ s, line: st }); s = ''; i += 2; let depth = 1; scan(() => { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (depth === 0) { i++; return true; } } return false; }); st = line; continue; }
      if (c === '\n') line++;
      s += c; i++;
    }
    out.push({ s, line: st });
  }
  function scan(stop) {
    while (i < n) {
      if (stop && stop()) return;
      const c = src[i], d = src[i + 1];
      if (c === '\n') { line++; i++; continue; }
      if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && d === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; } i += 2; continue; }
      if (c === '"' || c === "'") { out.push(readStr(c)); prev = 'a'; continue; }
      if (c === '`') { readTpl(); prev = 'a'; continue; }
      if (c === '/' && regexOk()) { i++; let cls = false; while (i < n) { const e = src[i]; if (e === '\\') { i += 2; continue; } if (e === '[') cls = true; else if (e === ']') cls = false; else if (e === '/' && !cls) { i++; break; } else if (e === '\n') break; i++; } while (/[a-z]/i.test(src[i] || '')) i++; prev = 'a'; continue; }
      if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
      if (/[\w$]/.test(c)) { let w = ''; while (i < n && /[\w$]/.test(src[i])) { w += src[i]; i++; } prev = w; continue; }
      prev = c; i++;
    }
  }
  scan(null);
  return out;
}
// every string of a JSON value (keys too), with the path that holds it
function jsonStrings(o, pth, out) {
  out = out || [];
  if (typeof o === 'string') out.push({ s: o, line: pth });
  else if (Array.isArray(o)) o.forEach((v, k) => jsonStrings(v, pth + '[' + k + ']', out));
  else if (o && typeof o === 'object') for (const k of Object.keys(o)) { out.push({ s: k, line: pth + '.' + k + ' (key)' }); jsonStrings(o[k], pth + '.' + k, out); }
  return out;
}
// the strings of a value that the game evaluates (a table): every string, deep, with its path
const tableStrings = (o, name) => jsonStrings(JSON.parse(JSON.stringify(o === undefined ? null : o)), name);

// ---- THE INPUTS (a map path -> text, so the selftest doctors exactly one) --------------------------------------------
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');
const walk = (d, re) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name), re) : re.test(e.name) ? [path.join(d, e.name)] : []);
function inputs() {
  const F = {};
  const add = p => { F[rel(p)] = fs.readFileSync(p, 'utf8'); };
  for (const p of walk(path.join(ROOT, 'src', 'core'), /\.js$/)) add(p);
  for (const p of walk(path.join(ROOT, 'src', 'viewer'), /\.js$/)) add(p);
  add(path.join(ROOT, 'src', 'viewer', 'shots_pack.json'));
  add(path.join(ROOT, 'src', 'core', 'world_packs.json'));
  add(path.join(ROOT, 'tools', 'fixtures', 'island_jolene.json'));
  const vc = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'audio', 'voice_catalogue.json'), 'utf8'));
  const scriptFile = vc && vc.script && vc.script.file;
  if (scriptFile && fs.existsSync(path.join(ROOT, scriptFile))) add(path.join(ROOT, scriptFile));
  add(path.join(ROOT, 'index.html'));
  for (const f of fs.readdirSync(ROOT)) if (/^(career_core|route_draw)\.[0-9a-f]{8}\.js$/.test(f)) F['@built/' + f] = fs.readFileSync(path.join(ROOT, f), 'utf8');
  return F;
}

// ---- THE CHECK -------------------------------------------------------------------------------------------------------
function check(F, opt) {
  opt = opt || {};
  const hits = [], held = HOLDS.map(() => 0);
  const say = (where, s) => {
    const w = realIn(s); if (!w.length) return;
    const h = HOLDS.findIndex(H => H.file.test(where.split(':')[0]) && s.indexOf(H.text) >= 0);
    if (h >= 0) { held[h]++; return; }
    hits.push(where + ': ' + w.join(', ') + ' in "' + s.replace(/\s+/g, ' ').slice(0, 140) + '"');
  };
  // 1 + 2: the source's and the built page's text
  for (const f of Object.keys(F)) {
    const t = F[f];
    if (/\.js$/.test(f)) { for (const x of strings(t)) say(f + ':' + x.line, x.s); continue; }
    if (f === 'index.html') {
      const re = /<script([^>]*)>([\s\S]*?)<\/script>/g; let m, k = 0;
      while ((m = re.exec(t))) { k++; if (!/\bsrc=/.test(m[1])) for (const x of strings(m[2])) say('index.html script ' + k + ':' + x.line, x.s); }
      const markup = t.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, '\n');
      for (const l of markup.split('\n')) if (l.trim()) say('index.html markup', l.trim());
      continue;
    }
    if (/\.json$/.test(f)) {
      let J; try { J = JSON.parse(t); } catch (e) { hits.push(f + ': not JSON (' + e.message + ')'); continue; }
      // world_packs.json: the islands' names are shown (the GRAPHICS menu's world row); its data credit is not
      // (CREDITS.md carries the source honestly: a real place's DATA is credited, never shown as the island's name)
      if (/world_packs\.json$/.test(f)) { for (const I of (J.islands || [])) say(f + ':' + I.id + '.name', String(I.name)); continue; }
      for (const x of jsonStrings(J, '')) say(f + ':' + x.line, x.s);
    }
  }
  // 3: the text tables, evaluated
  const C = opt.core || require('./flight_core.js');
  const T = [['GAME_NAMES', C.GAME_NAMES], ['CONTRACT_FIELDS', C.CONTRACT_FIELDS], ['CONTRACT_TEXT', C.CONTRACT_TEXT], ['BASE_OFFERS', C.BASE_OFFERS],
             ['NAV_FIXES', C.NAV_FIXES], ['STORY_BEATS', C.STORY_BEATS], ['STORY_TIM', C.STORY_TIM], ['STORY_LADDER', C.STORY_LADDER],
             ['STORY_NO_CABIN', C.STORY_NO_CABIN], ['PILOTS_TEXT', C.PILOTS_TEXT], ['PILOTS_ROSTER', C.PILOTS_ROSTER]];
  let tables = 0;
  for (const [nm, v] of T) { if (v === undefined) { hits.push('the table ' + nm + ' is not exported by tools/flight_core.js'); continue; } tables++; for (const x of tableStrings(v, nm)) say('table ' + x.line, x.s); }
  if (C.STORY_BEATS && typeof C.storyTimLines === 'function') for (const B of C.STORY_BEATS) for (const l of C.storyTimLines(B.id)) say('table storyTimLines(' + B.id + ')', String(l));
  // the loading screen's cards, as the BOOT block runs them: the names table, then the cards
  const box = { window: {} }; box.window = box; vm.createContext(box);
  vm.runInContext(F['src/core/01_names.js'], box, { filename: '01_names.js' });
  vm.runInContext(F['src/viewer/boot_cards.js'], box, { filename: 'boot_cards.js' });
  const cards = box.BOOT_CARDS || (box.window && box.window.BOOT_CARDS);
  if (!Array.isArray(cards) || !cards.length) hits.push('the boot cards did not evaluate to a list');
  else for (const x of tableStrings(cards, 'BOOT_CARDS')) say('table ' + x.line, x.s);
  // the map, as the MAP screen reads it
  const mbox = { window: {} }; vm.createContext(mbox);
  vm.runInContext(F['src/viewer/map_pack.js'], mbox, { filename: 'map_pack.js' });
  if (!mbox.window.MAP_PACK || !Array.isArray(mbox.window.MAP_PACK.aerodromes)) hits.push('map_pack.js did not evaluate to a MAP_PACK');
  else for (const x of tableStrings(mbox.window.MAP_PACK, 'MAP_PACK')) say('table ' + x.line, x.s);
  // 4: THE USER'S OWN SAVE - every field the table names, recorded under its OLD name, shows the table's
  const PG = C.PREMISES_GEN, rec = JSON.parse(F['tools/fixtures/island_jolene.json']);
  const Fr = { toWorld: (x, z) => [x, z], toLocal: (x, z) => [x, z], yaw: 0 };
  const OLD = { w3: 'Tamgas Hill Strip', SEA: 'Annette Dock', mk_sea: 'Metlakatla Seaplane Base', mn_strip: 'Jumbo Mine Street' };
  let saved = 0;
  for (const id of Object.keys(C.GAME_NAMES.fields)) {
    const r0 = (rec.layers.runways || []).find(q => q.id === id);
    if (!r0) { hits.push('the table names a field the island record lacks: ' + id); continue; }
    const r = Object.assign({}, PG.RUNWAY_DEF, r0, { name: OLD[id] || 'Jumbo ' + id });
    const a = (opt.runwayAerodrome || PG.runwayAerodrome)(r, Fr, 0, [], null);
    const row = C.contractFieldsOf([Object.assign({}, r, { kind: a.kind })])[id];
    if (a.name !== C.GAME_NAMES.fields[id] || !row || row.name !== C.GAME_NAMES.fields[id]) hits.push('a saved record naming ' + id + ' "' + r.name + '" shows "' + a.name + '" / "' + (row && row.name) + '", not the table\'s "' + C.GAME_NAMES.fields[id] + '"');
    else saved++;
  }
  // the record's own names for the fields the table names agree with it (an editor and the world say the same)
  for (const id of Object.keys(C.GAME_NAMES.fields)) { const r0 = (rec.layers.runways || []).find(q => q.id === id); if (r0 && r0.name !== C.GAME_NAMES.fields[id]) hits.push('the island record names ' + id + ' "' + r0.name + '", the table "' + C.GAME_NAMES.fields[id] + '"'); }
  // a hold that matches nothing is stale: take it off the list
  HOLDS.forEach((H, k) => { if (!held[k]) hits.push('a stale hold (nothing shows "' + H.text + '" any more): remove it from HOLDS'); });
  return { hits, held, tables, saved, files: Object.keys(F).length };
}

// ---- RUN: the check, then (--selftest) the doctored inputs; ONE verdict line ------------------------------------------
const t0 = Date.now();
const F0 = inputs();
const R = check(F0);
console.log('GATE NAMES - ' + REAL.length + ' real names held out of ' + R.files + ' files (the source, the record, the built page), ' + R.tables + ' text tables + the cards + the map, ' + R.saved + ' fields read off an old save');
HOLDS.forEach((H, k) => console.log('  HELD x' + R.held[k] + ' "' + H.text + '" (' + H.owner + '): ' + H.why));
for (const h of R.hits) console.log('  FAIL ' + h);
let bad = 0;
if (SELF) {
  console.log('SELFTEST (each break must go red; the kept case must stay green)');
  const C = require('./flight_core.js');
  const sub = (f, a, b) => { const G = Object.assign({}, F0); if (G[f].indexOf(a) < 0) throw new Error('selftest: "' + a + '" not in ' + f); G[f] = G[f].split(a).join(b); return G; };   // every occurrence (a sign's name rides in two tables)
  const CASES = [
    ['a brief names the real hill', () => check(sub('src/core/72_contract_data.js', "CT_('Show us the old field still flies: over to ' + GAME_NAMES.hill + ' and back.')", "CT_('Show us the old field still flies: over to Tamgas Hill and back.')"))],
    ['the table names the real town', () => check(sub('src/core/01_names.js', "town:     'Cedar Harbour',", "town:     'Metlakatla',"), { core: Object.assign({}, C, { GAME_NAMES: Object.assign({}, C.GAME_NAMES, { town: 'Metlakatla' }) }) })],
    ['the record\'s site back to a real organisation', () => check(sub('tools/fixtures/island_jolene.json', '"name": "Harbour Credit Union"', '"name": "Tongass Federal Credit Union"'))],
    ['a card names the real island', () => check(sub('src/viewer/boot_cards.js', "its names are the game's own.", "it is Annette Island."))],
    ['the built page carries a real name', () => check(sub('index.html', 'Ridgeback Strip', 'Tamgas Hill Strip'))],
    ['the map pack says the old dock', () => check(sub('src/viewer/map_pack.js', '"name":"Greywater Dock"', '"name":"Annette Dock"'))],
    ['the override undone (a saved record shows its old name)', () => check(F0, { runwayAerodrome: (r, Fr, e, fl, h) => Object.assign(C.PREMISES_GEN.runwayAerodrome(r, Fr, e, fl, h), { name: r.name }) })],
    ['a stale hold (the sign fixed, the hold left)', () => check(sub('src/viewer/sign_tex.js', 'Tongass Marine Supply', 'Harbour Marine Supply'))],
  ];
  const GREEN = [['a real name in a COMMENT (never shown)', () => check(sub('src/core/01_names.js', '// the name a field shows:', '// (Metlakatla) the name a field shows:'))]];
  for (const [what, fn] of CASES) { let r; try { r = fn(); } catch (e) { r = { hits: [] }; console.log('  (threw: ' + e.message + ')'); } const red = r.hits.length > 0; if (!red) bad++; console.log('  ' + (red ? 'caught ' : 'MISSED ') + what + (red ? ' (' + r.hits[0].slice(0, 150) + ')' : '')); }
  for (const [what, fn] of GREEN) { let r; try { r = fn(); } catch (e) { r = { hits: ['threw ' + e.message] }; } const green = !r.hits.length; if (!green) bad++; console.log('  ' + (green ? 'green  ' : 'RED    ') + what + (green ? '' : ' (' + r.hits[0].slice(0, 150) + ')')); }
  console.log('  selftest: ' + (CASES.length + GREEN.length - bad) + ' of ' + (CASES.length + GREEN.length) + ' as they must be');
}
console.log('(' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
const FAILED = R.hits.length > 0 || bad > 0;
console.log('GATE NAMES: ' + (FAILED ? 'FAIL' : 'PASS'));
process.exit(FAILED ? 1 : 0);
