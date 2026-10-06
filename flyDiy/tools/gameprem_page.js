#!/usr/bin/env node
// gameprem_page.js - GAME-PREMISES (G2095) evidence: AN OLD SAVE BOOTS UNCHANGED IN THE PAGE ITSELF.
//
// GATE GAMEPREM proves the v1 -> v2 walk on the core functions; this rig proves it where the player meets it: the
// page in node (tools/_page_node.js, FRAMECOST's harness - dev.html's own scripts, the real three on the recording
// GL), booted to the stand with a SAVED PROFILE in its localStorage, then read back:
//   v1     flydiy.player = tools/fixtures/player_v1_2026-08-31.json (the club at 18 x 14 x 8, two dressed parts)
//   prefs  no player document, the PRE-S1 prefs flydiy.hangarDims / flydiy.hangarParts (the one-time lift's path)
//   fresh  nothing stored at all
// For each: the stored document after the boot (v2, its HOME shed field by field against what was saved), the room
// the garage built (GARAGE_ENV.shell / dims / kits), and the page's errors. ~4 min and ~3.5 GB a boot.
//
//   node tools/gameprem_page.js [--only v1|prefs|fresh] [--out file]
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const V1 = fs.readFileSync(path.join(__dirname, 'fixtures', 'player_v1_2026-08-31.json'), 'utf8');
const CASES = {
  v1: { 'flydiy.player': V1 },
  prefs: { 'flydiy.hangarDims': JSON.stringify({ HW: 16, HD: 13, EAVE: 7.5 }),
           'flydiy.hangarParts': JSON.stringify({ ground: { set: 'cracked', tile: 4, rough: 1, nrm: 1 } }) },
  fresh: {},
};
const lines = [];
const log = s => { console.log(s); lines.push(s); };

(async () => {
  const { openPage } = require('./_page_node.js');
  let bad = 0;
  for (const k of Object.keys(CASES)) {
    if (opt('only') && opt('only') !== k) continue;
    const t0 = Date.now();
    const P = await openPage({ quiet: true, storage: CASES[k] });
    const W = P.win;
    await P.until(() => W.BOOT && W.BOOT.state === 'gone', 900000);
    await P.until(() => !!(W.GARAGE_ENV && W.GARAGE_ENV.dims && W.GARAGE_ENV.dims()), 120000);
    let doc = null; try { doc = JSON.parse(W.localStorage.getItem('flydiy.player')); } catch (e) {}
    const GE = W.GARAGE_ENV, dims = GE.dims() || {};
    const room = { shell: GE.shell(), HW: dims.HW, HD: dims.HD, EAVE: dims.EAVE, kits: GE.kits().filter(x => x.on).map(x => x.key) };
    const checks = [];
    const ck = (c, m) => { checks.push((c ? 'ok    ' : 'FAIL  ') + m); if (!c) bad++; };
    ck(!!doc && doc.v === 2 && doc.what === 'flydiy-player', 'the stored player document is v2');
    ck(!!doc && doc.mode === 'sandbox' && doc.here === 'HOME' && doc.sheds.HOME.base === 'HOME', 'sandbox, the garage at HOME, HOME at HOME');
    if (k === 'v1') {
      const raw = JSON.parse(V1);
      for (const f of Object.keys(raw.sheds.HOME)) ck(JSON.stringify(doc.sheds.HOME[f]) === JSON.stringify(raw.sheds.HOME[f]), 'the saved shed\'s ' + f + ' unchanged');
      ck(doc.wallet === raw.wallet, 'the wallet unchanged');
      ck(room.HW === 18 && room.HD === 14 && room.EAVE === 8, 'the room the garage built is the saved 18 x 14 x 8');
    }
    if (k === 'prefs') ck(room.HW === 16 && room.HD === 13 && room.EAVE === 7.5 && doc.sheds.HOME.parts && doc.sheds.HOME.parts.ground, 'the pre-S1 prefs are lifted into the room');
    if (k === 'fresh') ck(room.shell === 'club' && room.HW === 15 && room.HD === 12.5, 'a fresh profile stands in the club at its own size');
    ck(!P.errors.length, 'no page error (' + P.errors.length + ')');
    log('== ' + k + '  (' + Math.round((Date.now() - t0) / 1000) + ' s)');
    log('   stored : ' + JSON.stringify(doc && { v: doc.v, mode: doc.mode, here: doc.here, wallet: doc.wallet, clock: doc.clock, fleet: doc.fleet, HOME: doc.sheds.HOME }));
    log('   room   : ' + JSON.stringify(room));
    for (const c of checks) log('   ' + c);
    for (const e of P.errors.slice(0, 5)) log('   error: ' + e);
    P.close();
  }
  log('GAMEPREM PAGE: ' + (bad ? 'FAIL (' + bad + ')' : 'PASS'));
  if (opt('out')) fs.writeFileSync(opt('out'), lines.join('\n') + '\n');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
