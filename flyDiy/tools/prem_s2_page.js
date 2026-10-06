#!/usr/bin/env node
// prem_s2_page.js - PREM-S2 (G2230) evidence: THE PAGE HOLDS THE FLEET LEDGER, in the page itself.
//
// GATE GAMEPREM proves the rules and scans the page's doors; GATE DESTTO flies the w3 case on the core; GATE UISMOKE
// drives the base select and the fleet popup on DOM shims. This rig boots the PAGE in node (tools/_page_node.js,
// FRAMECOST's harness - dev.html's own scripts on the recording GL, the analytic world) with a saved profile and reads
// back what the player meets:
//   lift   the v1 player save of G2095 + three saved builds (the user's Cub, Jodel and Cessna): after the boot the
//          stored document is the same sandbox (the shed, the wallet, the room unchanged) with THREE AIRFRAMES in its
//          fleet at HOME (inside while a slot is free and the floor packs them, the rest tied down outside), the
//          base row today's line, no page error.
//   away   a v2 sandbox whose saved Cub stands AWAY at A0 (it landed there), the Cub on the stand (the working build
//          names its slot): the roll-out starts at A0 (FLYDIY_PLAYER.rollFrom, then FLYDIY_ROUTE.where on the
//          aerodrome A0 after the roll-out); a walk back to the shed mid-flight ends that flight for the clock and
//          moves NOTHING (gp4: it stays away at A0); "bring it home" then puts it in HOME (free).
// ~4 min and ~3.5 GB a boot.
//
//   node tools/prem_s2_page.js [--only lift|away] [--out file]
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const V1 = fs.readFileSync(path.join(__dirname, 'fixtures', 'player_v1_2026-08-31.json'), 'utf8');
const B = f => fs.readFileSync(path.join(__dirname, '..', 'builds', f), 'utf8');
const slot = (name, txt) => { const o = JSON.parse(txt); o.name = name; return JSON.stringify(o); };
const CUB = slot('Cub', B('cub_2026-09-20_corrected.json'));
const AWAY = JSON.stringify({ what: 'flydiy-player', v: 2, wallet: 0, mode: 'sandbox', here: 'HOME', clock: 3600,
  sheds: { HOME: { shell: 'club', kits: ['park', 'bench', 'wood', 'metal', 'store', 'handling', 'office', 'comfort', 'curio', 'wip'], base: 'HOME', tenure: 'own' } },
  fleet: { Cub: { hangar: null, aero: 'A0', outSince: 0, left: 'HOME' } }, ledger: [] });
const CASES = {
  lift: { 'flydiy.player': V1, 'flydiy.build.Cub': CUB, 'flydiy.build.Jodel': slot('Jodel', B('jodel_2026-09-20_corrected.json')),
          'flydiy.build.Cessna': slot('Cessna', B('cessna172_2026-09-20_corrected.json')) },
  away: { 'flydiy.player': AWAY, 'flydiy.build.Cub': CUB, 'flydiy.wip': CUB },
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
    const stored = () => { try { return JSON.parse(W.localStorage.getItem('flydiy.player')); } catch (e) { return null; } };
    const checks = [];
    const ck = (c, m) => { checks.push((c ? 'ok    ' : 'FAIL  ') + m); if (!c) bad++; };
    let doc = stored();
    log('== ' + k);
    if (k === 'lift') {
      const raw = JSON.parse(V1), GE = W.GARAGE_ENV, dims = GE.dims() || {};
      ck(!!doc && doc.v === 2 && doc.mode === 'sandbox' && doc.here === 'HOME', 'a v2 sandbox, the garage at HOME');
      for (const f of Object.keys(raw.sheds.HOME)) ck(JSON.stringify(doc.sheds.HOME[f]) === JSON.stringify(raw.sheds.HOME[f]), 'the saved shed\'s ' + f + ' unchanged');
      ck(doc.wallet === raw.wallet && !doc.ledger.length, 'the wallet unchanged, nothing charged');
      ck(dims.HW === 18 && dims.HD === 14 && dims.EAVE === 8, 'the room the garage built is the saved 18 x 14 x 8');
      const names = Object.keys(doc.fleet).sort();
      ck(names.join() === 'Cessna,Cub,Jodel', 'the three saved builds are three airframes in the fleet (' + names.join(', ') + ')');
      ck(names.every(n => doc.fleet[n].aero === 'HOME'), 'all three stand at HOME');
      const inside = names.filter(n => doc.fleet[n].hangar === 'HOME'), out = names.filter(n => !doc.fleet[n].hangar);
      ck(inside.length >= 1 && inside.length <= 3 && inside.length + out.length === 3, 'inside while a slot is free and the floor packs them (' + inside.join(', ') + '), outside after (' + (out.join(', ') || 'none') + ')');
      ck(out.every(n => typeof doc.fleet[n].outSince === 'number'), 'those outside start their wear clock');
      const row = W.FLYDIY_ROUTE && W.FLYDIY_ROUTE.baseRow ? W.FLYDIY_ROUTE.baseRow('garage') : null;
      ck(!!row && row.kind === 'line' && row.text === 'Home base · the WWII hangar', 'the base row is today\'s line');
      log('   fleet  : ' + names.map(n => n + ' ' + W.FLYDIY_PLAYER.place(n).text).join(' · '));
    } else {
      const G = W.GARAGE_SPEC;
      ck(!!G && G.name() === 'Cub', 'the Cub is on the stand (its slot restored with the working build)');
      ck(W.FLYDIY_PLAYER.place('Cub').text.indexOf('away at') === 0, 'it stands ' + W.FLYDIY_PLAYER.place('Cub').text);
      ck(W.FLYDIY_PLAYER.rollFrom() === 'A0', 'its roll-out starts where it stands: ' + W.FLYDIY_PLAYER.rollFrom());
      const n0 = (W.FLYDIY_TRIPS || []).length;
      W.document.getElementById('bGo').click();
      const okR = await P.until(() => { const L = W.FLYDIY_TRIPS || []; const t = L[L.length - 1]; return L.length > n0 && t.kind === 'rollout' && t.done && W.BOOT.state === 'gone'; }, 900000);
      await P.frames(30);
      const wh = W.FLYDIY_ROUTE.where(), R0 = W.FLYDIY_ROUTE.get(), T = (W.FLYDIY_TRIPS || []).slice(-1)[0] || {};
      ck(okR && wh && wh.id === 'A0', 'rolled out ON A0 (' + (wh && wh.kind) + ' ' + (wh && wh.id) + '; the leg\'s From ' + R0.from + '; the roll-out shot ' + T.anim + ')');
      ck(R0.from === 'A0', 'the flight\'s From is A0, not the base');
      ck(W.FLYDIY_PLAYER.slot() === 'Cub', 'the flight flies the Cub\'s airframe');
      await P.frames(240);
      W.document.getElementById('bHangar2').click();
      await P.until(() => { const L = W.FLYDIY_TRIPS || []; const t = L[L.length - 1]; return t && t.kind === 'rollin' && t.done && W.BOOT.state === 'gone'; }, 900000);
      doc = stored();
      const E = W.FLYDIY_PLAYER.last();
      ck(!!E && E.how === 'abandoned' && !E.moved, 'walked back to the shed mid-flight: the flight ended for the clock, nothing moved');
      ck(doc.clock > 3600 && doc.fleet.Cub.aero === 'A0' && !doc.fleet.Cub.hangar, 'the clock ran (' + doc.clock.toFixed(1) + ' s) and the Cub is still away at A0 (gp4)');
      ck(doc.fleet.Cub.foot && doc.fleet.Cub.foot.half > 4, 'its footprint was measured at the roll-out: ' + JSON.stringify(doc.fleet.Cub.foot));
      const bh = W.FLYDIY_PLAYER.bringHome('Cub');
      doc = stored();
      ck(!!bh && bh.ok && doc.fleet.Cub.aero === 'HOME' && doc.wallet === 0, 'bring it home: ' + W.FLYDIY_PLAYER.place('Cub').text + ', free');
      ck(W.FLYDIY_PLAYER.rollFrom() === 'HOME', 'and its next roll-out is HOME again');
    }
    const errs = P.errors.filter(e => /^(script |timer: |frame: |FLYDIY_BOOT)/.test(e));
    ck(!errs.length, 'no page error (' + errs.length + '; ' + (P.errors.length - errs.length) + ' GL-less bake notes)');
    log('   stored : ' + JSON.stringify(doc && { v: doc.v, mode: doc.mode, here: doc.here, wallet: doc.wallet, clock: doc.clock, fleet: doc.fleet, ledger: doc.ledger }));
    for (const c of checks) log('   ' + c);
    for (const e of errs.slice(0, 5)) log('   error: ' + e);
    log('   (' + Math.round((Date.now() - t0) / 1000) + ' s)');
    P.close();
  }
  log('PREM-S2 PAGE: ' + (bad ? 'FAIL (' + bad + ')' : 'PASS'));
  if (opt('out')) fs.writeFileSync(opt('out'), lines.join('\n') + '\n');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
