#!/usr/bin/env node
// _wingsmith_check.js - GATE WINGSMITH (9 Nov 2026). The user: "Wingsmith is the name of the game instead of flyDiy, the cub
// remains the cub" and "I don't have a logo or typography yet, so it's a placeholder for now". The game's player-facing name
// is ONE string, GAME_NAMES.game (src/core/01_names.js), read wherever a player reads the game's name; the repo, its folder,
// URLs, files, storage keys and save formats keep "flydiy" (a rename there would lose saves and links).
//   1  GAME_NAMES.game is a name (a non-empty string), and the only place the name is written in the source
//   2  no player-facing "flyDiy" in the places that show the game's name (the welcome card, the device gate, the Back box,
//      the build import, the clean download, the self-test, the AIRWORTHY sticker): their string literals, comments and
//      console lines aside; each of them reads GAME_NAMES.game
//   3  the built pages (index.html, dev.html): <title> and the loading screen's brand are the name, no unfilled mark
//   4  the installed app: manifest name and short_name are the name; id, start_url and scope unchanged ("./") - the
//      install and the player's data stay (a changed id would be a new app)
//   5  the saves untouched: the storage keys (flydiy.player, flydiy.build.*), the build file's tag (flydiy-build), the
//      worker's cache name (flydiy-media-v1) and the clean download's cache test (/^flydiy/) are all still there
//   node tools/_wingsmith_check.js [--selftest]    -> "GATE WINGSMITH: PASS|FAIL"
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const SELF = process.argv.includes('--selftest');
const FILES = ['src/core/01_names.js', 'src/viewer/welcome.js', 'src/viewer/back_guard.js', 'src/viewer/garage.js', 'src/viewer/update_now.js',
  'src/viewer/diag.js', 'src/viewer/stickers.js', 'src/viewer/shell.html', 'src/viewer/body.html', 'manifest.webmanifest', 'index.html', 'dev.html',
  'src/viewer/app.js', 'tools/build.js'];
const inputs = () => { const F = {}; for (const f of FILES) F[f] = fs.readFileSync(path.join(ROOT, f), 'utf8'); return F; };
// the places a player reads the game's name, and the line each must read it on
const SHOWN = [
  ['src/viewer/welcome.js', /'wbrand',\s*\(\(typeof GAME_NAMES !== 'undefined' && GAME_NAMES\.game\)/, 'the welcome card\'s brand'],
  ['src/viewer/welcome.js', /GAME_NAMES\.game\) \|\| 'the game'\) \+ ' needs WebGL2'/, 'the device gate\'s title'],
  ['src/viewer/back_guard.js', /'Leave ' \+ \(\(typeof GAME_NAMES !== 'undefined' && GAME_NAMES\.game\)/, 'the Back box'],
  ['src/viewer/garage.js', /'That file is not a ' \+ \(\(typeof GAME_NAMES/, 'the build import\'s refusal'],
  ['src/viewer/garage.js', /<span>a ' \+ \(\(typeof GAME_NAMES/, 'the drop zone'],
  ['src/viewer/update_now.js', /Everything ' \+ \(\(typeof GAME_NAMES/, 'the clean download'],
  ['src/viewer/diag.js', /'<h3>' \+ \(\(typeof GAME_NAMES/, 'the self-test card'],
  ['src/viewer/stickers.js', /ring: \(typeof GAME_NAMES !== 'undefined' && GAME_NAMES\.game \? String\(GAME_NAMES\.game\)\.toUpperCase\(\)/, 'the AIRWORTHY sticker\'s ring'],
];
// a file's text a player can read: its string literals, with comments and console lines taken out
const shownText = s => s.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l) && !/console\.(warn|info|log|error)/.test(l)).map(l => l.replace(/\s\/\/ .*$/, '')).join('\n');
const nameOf = F => { const box = {}; vm.createContext(box); vm.runInContext(F['src/core/01_names.js'], box); return box.GAME_NAMES && box.GAME_NAMES.game; };
function check(F) {
  const hits = [], rows = [];
  const say = (ok, row, what, why) => { rows.push((ok ? '  PASS ' : '  FAIL ') + row + ' ' + what + (ok || !why ? '' : '  (' + why + ')')); if (!ok) hits.push(row); };
  // 1
  let name = null; try { name = nameOf(F); } catch (e) { name = null; }
  const elsewhere = name ? ['src/viewer/welcome.js', 'src/viewer/back_guard.js', 'src/viewer/garage.js', 'src/viewer/update_now.js', 'src/viewer/diag.js', 'src/viewer/stickers.js', 'src/viewer/shell.html', 'src/viewer/body.html']
    .filter(f => { const s = shownText(F[f]); return s.includes("'" + name + "'") || s.includes('>' + name + '<') || s.includes(name.toUpperCase() + ' ·'); }) : [];   // (comments aside)
  say(typeof name === 'string' && name.trim().length > 0 && !elsewhere.length, 1, 'GAME_NAMES.game is the game\'s name ("' + name + '"), written once (01_names.js)', elsewhere.length ? 'also written in ' + elsewhere.join(', ') : 'not a name');
  // 2
  const left = [];
  for (const f of ['src/viewer/welcome.js', 'src/viewer/back_guard.js', 'src/viewer/garage.js', 'src/viewer/update_now.js', 'src/viewer/diag.js', 'src/viewer/stickers.js']) {
    // (a word, not an identifier: W.FLYDIY_BUILD, FLYDIY_DRAG and the like are code, never shown)
    const m = shownText(F[f]).match(/['"`][^'"`\n]*(?<![.\w])(flyDiy|FlyDiy|FLYDIY)(?!\w)[^'"`\n]*['"`]/g);
    if (m) left.push(f + ': ' + m.slice(0, 2).join(' | '));
  }
  const unread = SHOWN.filter(([f, re]) => !re.test(F[f])).map(([, , w]) => w);
  say(!left.length && !unread.length, 2, 'no player-facing "flyDiy" left; the ' + SHOWN.length + ' places read GAME_NAMES.game', left.concat(unread.map(w => w + ' does not read the name')).join('; '));
  // 3
  const page = [];
  for (const f of ['index.html', 'dev.html']) {
    const t = (F[f].match(/<title>([^<]*)<\/title>/) || [])[1], b = (F[f].match(/id="bootBrand">([^<]*)</) || [])[1];
    if (t !== name) page.push(f + ' <title> "' + t + '"'); if (b !== name) page.push(f + ' #bootBrand "' + b + '"');
    if (F[f].includes('__GAME_NAME__')) page.push(f + ' carries an unfilled name mark');
  }
  if (!/<title>__GAME_NAME__<\/title>/.test(F['src/viewer/shell.html']) || !/id="bootBrand">__GAME_NAME__</.test(F['src/viewer/body.html'])) page.push('the shell / body do not carry the name mark (a second copy of the name?)');
  if (!/function fillGameName\(/.test(F['tools/build.js'])) page.push('build.js does not fill the name');
  say(!page.length, 3, 'the built pages\' <title> and loading brand are the name (build.js fills them from GAME_NAMES.game)', page.join('; '));
  // 4
  let M = null; try { M = JSON.parse(F['manifest.webmanifest']); } catch (e) { M = null; }
  const man = !M ? ['the manifest does not parse'] : [['name', name], ['short_name', name], ['id', './'], ['start_url', './'], ['scope', './']].filter(([k, v]) => M[k] !== v).map(([k, v]) => k + ' "' + M[k] + '" (want "' + v + '")');
  say(!man.length, 4, 'the installed app: name and short_name are the name; id, start_url and scope stay "./" (the install and its data stay)', man.join('; '));
  // 5
  const keep = [['src/viewer/app.js', "'flydiy.player'", 'the player\'s save key'], ['src/viewer/app.js', "'flydiy.build.'", 'the build slots\' key'], ['src/viewer/app.js', "what: 'flydiy-build'", 'the build file\'s tag'],
    ['tools/build.js', "const CACHE = 'flydiy-media-v1';", 'the worker\'s media cache'], ['src/viewer/update_now.js', '/^flydiy/.test(k)', 'the clean download\'s cache test']].filter(([f, s]) => !F[f].includes(s)).map(([, , w]) => w);
  say(!keep.length, 5, 'the saves untouched: flydiy.player, flydiy.build.*, the flydiy-build tag, the flydiy-media-v1 cache, the /^flydiy/ cache test', 'gone: ' + keep.join(', '));
  return { hits, rows };
}
const F0 = inputs();
const R = check(F0);
console.log('GATE WINGSMITH - the game\'s player-facing name from one string, the saves and the install untouched');
for (const r of R.rows) console.log(r);
let bad = 0;
if (SELF) {
  console.log('SELFTEST (each break must go red)');
  const sub = (f, a, b) => { const G = Object.assign({}, F0); if (!G[f].includes(a)) throw new Error('selftest: "' + a + '" not in ' + f); G[f] = G[f].split(a).join(b); return G; };
  const CASES = [
    ['the Back box says flyDiy again', () => check(sub('src/viewer/back_guard.js', "'Leave ' + ((typeof GAME_NAMES !== 'undefined' && GAME_NAMES.game) || 'the game') + '?'", "'Leave flyDiy?'"))],
    ['the sticker\'s ring written by hand', () => check(sub('src/viewer/stickers.js', "ring: (typeof GAME_NAMES !== 'undefined' && GAME_NAMES.game ? String(GAME_NAMES.game).toUpperCase() + ' · ' : '') + 'CERTIFIED'", "ring: 'FLYDIY · CERTIFIED'"))],
    ['the name emptied', () => check(sub('src/core/01_names.js', "game:     'Wingsmith',", "game:     '',"))],
    ['the built page\'s title stale', () => check(sub('index.html', '<title>Wingsmith</title>', '<title>Garage Flight Sim</title>'))],
    ['the manifest id changed', () => check(sub('manifest.webmanifest', '"id": "./"', '"id": "./wingsmith"'))],
    ['the player\'s save key renamed', () => check(sub('src/viewer/app.js', "'flydiy.player'", "'wingsmith.player'"))],
  ];
  for (const [what, fn] of CASES) { let r; try { r = fn(); } catch (e) { r = { hits: [] }; console.log('  (threw: ' + e.message + ')'); } const red = r.hits.length > 0; if (!red) bad++; console.log('  ' + (red ? 'caught ' : 'MISSED ') + what); }
  console.log('  selftest: ' + (CASES.length - bad) + ' of ' + CASES.length + ' caught');
}
const FAILED = R.hits.length > 0 || bad > 0;
console.log('GATE WINGSMITH: ' + (FAILED ? 'FAIL' : 'PASS'));
process.exit(FAILED ? 1 : 0);
