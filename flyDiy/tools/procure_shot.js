#!/usr/bin/env node
// procure_shot.js - THE MARKET ON THE REAL PAGE (G2280, PROCURE). index.html served by tools/_serve.js in headless
// Chromium on SwiftShader; one still per state and the page's own answers in shots.json:
//   sandbox        no flag: no FLYDIY_PROCURE, no MAP entry (the sandbox is today's page)
//   market         ?career=1: the MAP's Market tab - the four makers' models, then the used listings, their markers
//   model_card     a maker's model: its certificate, its options sheet, the price, Buy
//   model_opts     an option chosen (the engine): the sheet, the certificate and the price follow
//   bought_voucher the stock Scout bought with the voucher: the slot written, the airframe row (factory, its
//                  fingerprint), delivered into the main hangar, the wallet untouched
//   used_card      a used listing: where it stands (its marker on), its history, its certificate, its price
//   bought_used    bought where it stands: the airframe stationed at the listing's aerodrome, paid
//   garage_join    the bought Scout opened in the garage: the join's export against the factory fingerprint, and a
//                  Save with no edit (procureOnSave: modified or not) - the measurement, stated as found
//   phone_*        ?map=1 on a 390 x 844 phone: the sheet's Market, a model's card, Take (free in the sandbox)
//
//   node tools/_serve.js 8125 &   node tools/procure_shot.js [--out reports/evidence/PROCURE] [--port 8125]
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  try { ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); }
  catch (e2) { console.log('procure_shot: no playwright here - nothing pictured'); process.exit(0); }
}
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('out', 'reports/evidence/PROCURE'));
const PORT = +opt('port', 8125), PAGE = opt('page', 'index.html');
const URL0 = 'http://127.0.0.1:' + PORT + '/flyDiy/' + PAGE;
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (/\.(jpg|png)$/.test(f)) fs.unlinkSync(path.join(OUT, f));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const index = [], fails = [], errs = [];
  const check = (c, what) => { if (!c) fails.push(what); console.log('  ' + (c ? 'ok  ' : 'FAIL') + ' ' + what); return c; };
  const until = async (pg, fn, ms, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await pg.evaluate(fn, arg)) return true; } catch (e) {} await sleep(250); } return false; };
  const ev = (pg, fn, arg) => pg.evaluate(fn, arg);
  const tap = (pg, sel) => ev(pg, s => { const b = document.querySelector(s); if (b) b.click(); return !!b; }, sel);
  const probe = (pg, key) => ev(pg, key => {
    let doc = null; try { doc = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) {}
    const scr = document.getElementById('mapScreen');
    const slots = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^flydiy\.build\./.test(k)) slots.push(k.slice(13)); }
    const M = window.MAP_MENU && window.MAP_MENU.model ? window.MAP_MENU.model() : null;
    const card = scr ? ((scr.querySelector('.mmRight') && scr.querySelector('.mmRight').innerText) || (scr.querySelector('.mmSheetBody') && scr.querySelector('.mmSheetBody').innerText) || '') : '';
    return {
      door: !!window.FLYDIY_PROCURE, entry: !!document.getElementById('mapEntry'), open: !!scr, slots: slots.sort(),
      wallet: doc ? doc.wallet : null, ledger: doc ? doc.ledger.slice(-3).map(l => l.k + ' ' + l.amt + (l.free ? ' free' : '')) : [],
      fleet: doc ? doc.fleet : null, airframes: doc && doc.career ? doc.career.airframes : null, voucher: doc && doc.career ? doc.career.voucher : null,
      marketRows: scr ? scr.querySelectorAll('[data-sel^="m:"]').length : 0, usedRows: scr ? scr.querySelectorAll('.mmRow[data-sel^="u:"]').length : 0,
      usedMarks: scr ? scr.querySelectorAll('.mmMk.used').length : 0, used: M && M.market ? M.market.used.map(L => ({ id: L.id, aero: L.aero, price: L.price, model: L.model })) : [],
      card: card.replace(/\s+/g, ' ').trim().slice(0, 1400),
    };
  }, key);
  const shot = async (pg, name, note, key) => {
    await sleep(500);
    const f = 'procure_' + name + '.jpg';
    await pg.screenshot({ path: path.join(OUT, f), type: 'jpeg', quality: 84, timeout: 120000 });
    const st = await probe(pg, key);
    index.push(Object.assign({ name, file: f, note, url: pg.url() }, st, { fleet: undefined, airframes: undefined }));
    console.log('  ' + f + '  ' + note);
    return st;
  };
  const openMap = async pg => {
    await tap(pg, '#mapEntry');
    return until(pg, () => !!document.getElementById('mapScreen') && window.MAP_MENU && window.MAP_MENU.model() && document.querySelector('#mapScreen .mmPlane img').complete, 90000);
  };

  // ---- the sandbox: no flag ----------------------------------------------------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } }), pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push('[sandbox] ' + String(e.message || e).slice(0, 160)));
    await pg.goto(URL0 + '?audio=0', { waitUntil: 'domcontentloaded' });
    await until(pg, () => !!window.FLIGHT_PROBE && !!window.FLYDIY_PLAYER, 240000);
    await sleep(1500);
    const st = await shot(pg, 'sandbox', 'the sandbox (no flag): today\'s page - no market door, no MAP entry', 'flydiy.player');
    check(!st.door && !st.entry && !st.slots.length, 'the sandbox: no FLYDIY_PROCURE, no MAP entry, no slot written');
    await ctx.close();
  }
  // ---- ?career=1 ---------------------------------------------------------------------------------------------------
  const KEY = 'flydiy.career.dev';
  {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } }), pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push('[career] ' + String(e.message || e).slice(0, 160)));
    await pg.goto(URL0 + '?audio=0&career=1', { waitUntil: 'domcontentloaded' });
    await until(pg, () => !!window.FLIGHT_PROBE && !!window.FLYDIY_CAREER && !!window.FLYDIY_PROCURE && !!document.getElementById('mapEntry'), 240000);
    await sleep(1500);
    check(await openMap(pg), 'the MAP opens');
    await tap(pg, '#mapScreen .mmTab[data-tab="market"]');
    let st = await shot(pg, 'market', 'the Market tab: the four makers\' models, then the used listings where they stand (their markers on the map)', KEY);
    check(st.marketRows === 4 && st.usedRows >= 1 && st.usedRows <= 4 && st.usedMarks === st.usedRows, 'the Market: 4 models, ' + st.usedRows + ' listings, a marker each (' + st.usedMarks + ')');
    await tap(pg, '#mapScreen .mmRow[data-sel="m:scout"]');
    st = await shot(pg, 'model_card', 'a maker\'s model: its certificate, the options sheet, the price (the voucher pays a stock one), Buy', KEY);
    check(/Its certificate/i.test(st.card) && /take-off run/.test(st.card) && /Options/i.test(st.card) && /voucher pays this one/.test(st.card) && /Buy · 0/.test(st.card), 'the Scout\'s card: certificate, options, the voucher, Buy · 0');
    await tap(pg, '#mapScreen [data-opt="scout:engine:o200"]');
    st = await shot(pg, 'model_opts', 'the engine chosen: the certificate and the price follow (the voucher no longer applies)', KEY);
    check(/engine \+?17 ?400|engine 17 ?400/.test(st.card.replace(/ /g, ' ')) || /Buy · 5\d ?\d00/.test(st.card), 'the price follows the option (' + (st.card.match(/Buy · [\d ]+/) || [''])[0] + ')');
    await tap(pg, '#mapScreen [data-opt="scout:engine:a65"]');
    await tap(pg, '#mapScreen [data-act="buy"]');
    await until(pg, () => /is yours/.test((document.querySelector('#mapScreen .mmMsg') || {}).textContent || ''), 30000);
    st = await shot(pg, 'bought_voucher', 'the stock Scout bought with the voucher: in the main hangar, the airframe row factory-certified', KEY);
    const scout = st.airframes && Object.keys(st.airframes).find(k => st.airframes[k].model === 'scout');
    check(!!scout && st.airframes[scout].factory && !!st.airframes[scout].fp && st.voucher.used && st.wallet === 60000 && st.slots.includes(scout)
          && st.fleet[scout] && st.fleet[scout].hangar === 'HOME', 'the voucher Scout: slot "' + scout + '", factory, its fingerprint, the voucher used, the wallet 60 000, in the main hangar');
    // a used listing, the cheapest
    const L = st.used.slice().sort((a, b) => a.price - b.price)[0];
    if (!check(!!L, 'a used listing to buy')) throw new Error('no used listing on the page');
    await tap(pg, '#mapScreen .mmTab[data-tab="market"]');
    await tap(pg, '#mapScreen .mmRow[data-sel="u:' + L.id + '"]');
    st = await shot(pg, 'used_card', 'a used listing (' + L.id + ', ' + L.model + ' at ' + L.aero + '): where it stands, its history, its certificate, its price', KEY);
    check(/it stands at/i.test(st.card) && /Its history/i.test(st.card) && /Buy where it stands/.test(st.card), 'the listing\'s card');
    const w0 = st.wallet;
    await tap(pg, '#mapScreen [data-act="buy"]');
    await until(pg, () => /is yours/.test((document.querySelector('#mapScreen .mmMsg') || {}).textContent || ''), 30000);
    st = await shot(pg, 'bought_used', 'bought where it stands: an airframe stationed at ' + L.aero, KEY);
    const used = st.airframes && Object.keys(st.airframes).find(k => st.airframes[k].listing === L.id);
    check(!!used && st.fleet[used] && (st.fleet[used].aero === L.aero || (st.fleet[used].hangar && L.aero === 'HOME')) && st.wallet === w0 - L.price && !st.used.some(x => x.id === L.id),
          'the used one: stationed at ' + L.aero + ' (' + (used && JSON.stringify(st.fleet[used])) + '), paid ' + L.price + ', gone from the market');
    // the drawing board: the bought Scout filed as a design (free), then that design built (the ledger's price)
    await tap(pg, '#mapScreen .mmTab[data-tab="market"]');
    await tap(pg, '#mapScreen [data-board="save"][data-slot="' + scout + '"]');
    await sleep(400);
    const design = scout + ' (design)';
    let w1 = (await probe(pg, KEY)).wallet;
    await tap(pg, '#mapScreen [data-board="build"][data-slot="' + design + '"]');
    await sleep(800);
    await ev(pg, () => { const b = document.querySelector('#mapScreen .mmList .mmBoard'); if (b && b.scrollIntoView) b.scrollIntoView(); });
    st = await shot(pg, 'board', 'the drawing board: the Scout filed as a design, the design built into an airframe (paid at the ledger)', KEY);
    check(st.slots.includes(design) && st.airframes[design] && st.airframes[design].from === 'board' && st.wallet < w1 && st.fleet[design], 'the board: "' + design + '" filed, then built (' + (w1 - st.wallet) + ' paid), an airframe in the fleet');
    // the garage: the bought Scout opened and saved with no edit
    await tap(pg, '#mapScreen [data-act="close"]');
    const join = await ev(pg, async n => {
      const G = window.GARAGE_SPEC; if (!G || !G.load) return { why: 'no garage' };
      G.load(n);
      await new Promise(r => setTimeout(r, 6000));
      const env = JSON.parse(G.json()), doc = window.FLYDIY_CAREER.doc(), A = doc.career.airframes[n];
      const fpJ = procureFp(env.spec);
      const out = { slot: n, factoryFp: A.fpFile || A.fp, joinedFp: fpJ, same: fpJ === (A.fpFile || A.fp), signed: !!A.anchored };
      if (!out.same) {   // what the join re-measured: the top-level rows that differ
        const saved = JSON.parse(localStorage.getItem('flydiy.build.' + n)).spec;
        out.rows = Object.keys(Object.assign({}, saved, env.spec)).filter(k => !['meta', 'finish', 'paint'].includes(k) && JSON.stringify(saved[k]) !== JSON.stringify(env.spec[k]));
      }
      G.save(n);
      await new Promise(r => setTimeout(r, 1500));
      const A2 = window.FLYDIY_CAREER.doc().career.airframes[n];
      out.afterSave = { factory: A2.factory, modified: A2.modified };
      return out;
    }, scout);
    st = await shot(pg, 'garage_join', 'the Scout in the garage after the join; saved with no edit', KEY);
    index[index.length - 1].join = join;
    console.log('  the join: ' + JSON.stringify(join));
    check(join && join.slot === scout && join.afterSave.factory && !join.afterSave.modified, 'the garage opened the bought Scout (the join ' + (join.same ? 'kept the file\'s fingerprint' : 're-measured ' + (join.rows || []).join(', ')) + '); signed there, a no-edit Save keeps the factory certificate (' + JSON.stringify(join.afterSave) + ')');
    // EVERY OPTION THROUGH THE JOIN: each single-option variant bought, opened in the garage (the join settles), its rows
    // read back off the garage's spec, saved with no edit (not modified), and an edit saved (modified, billed)
    const rows = await ev(pg, async () => {
      const out = [], G = window.GARAGE_SPEC, P = window.FLYDIY_PROCURE;
      const d0 = window.FLYDIY_PLAYER.doc(); d0.wallet = 1e7; window.FLYDIY_PLAYER.set(d0);
      const cases = [];
      for (const id of procureModelIds()) {
        const M = PROCURE_MODELS[id];
        for (const r of Object.keys(M.opts)) {
          if (M.opts[r].cosmetic) continue;
          for (const v of Object.keys(M.opts[r].vals)) if (v !== M.opts[r].def) cases.push([id, r, v]);
        }
      }
      const read = (sp, r) => r === 'engine' ? sp.engines.map(e => e.type).join('+') + ' #' + sp.cage.engPreset
        : r === 'tank' ? sp.energy.vessels.slice(1).map(x => x.bay + ':' + x.capacity).join(' ') + ' (nose ' + sp.energy.vessels[0].capacity + ')'
        : r === 'seats' ? String(sp.cabin.seats) : r === 'avionics' ? String(sp.systems.fit)
        : r === 'gear' ? sp.gear.type + ' r' + sp.gear.wheelR : '';
      let i = 0;
      for (const [id, r, v] of cases) {
        const slot = 'probe ' + (i++);
        const b = await P.buyModel(id, { [r]: v }, { slot });
        if (!b.ok) { out.push({ id, r, v, why: b.why }); continue; }
        const saved = JSON.parse(localStorage.getItem('flydiy.build.' + slot)).spec;
        G.load(slot);
        const atLoad = G.preview(JSON.parse(JSON.stringify(window.CAGE_JOIN.export())));
        await new Promise(res => setTimeout(res, 5000));
        const got = G.get(), A0 = window.FLYDIY_CAREER.doc().career.airframes[slot];
        G.save(slot); await new Promise(res => setTimeout(res, 800));
        const A1 = window.FLYDIY_CAREER.doc().career.airframes[slot], after = JSON.parse(localStorage.getItem('flydiy.build.' + slot)).spec;
        // what moved between the load (the signature) and the save, when the save withdrew it
        const moved = [];
        const walk = (u, w, p) => { if (moved.length > 8 || JSON.stringify(u) === JSON.stringify(w)) return;
          if (u && w && typeof u === 'object' && typeof w === 'object' && !Array.isArray(u)) { for (const k of new Set(Object.keys(u).concat(Object.keys(w)))) walk(u[k], w[k], p + '.' + k); }
          else moved.push(p + ': ' + JSON.stringify(u) + ' > ' + JSON.stringify(w)); };
        const saveKeeps = A1.factory && !A1.modified;
        if (!saveKeeps) for (const k of Object.keys(after)) if (!['meta', 'finish', 'paint', 'fuel'].includes(k)) walk(atLoad[k], after[k], k);
        out.push({ id, r, v, asked: read(saved, r).replace(/ \(nose [^)]*\)/, ''), built: read(got, r).replace(/ \(nose [^)]*\)/, ''), nose: r === 'tank' ? [saved.energy.vessels[0].capacity, got.energy.vessels[0].capacity] : undefined,
                   kept: read(saved, r).replace(/ \(nose [^)]*\)/, '') === read(got, r).replace(/ \(nose [^)]*\)/, ''), signed: !!A0.anchored, saveKeeps, moved });
      }
      return out;
    });
    for (const x of rows) console.log('  join  ' + JSON.stringify(x));
    index.push({ name: 'options_through_the_join', note: 'every single-option variant bought, opened in the garage, saved with no edit', rows });
    check(rows.every(x => x.kept), 'every option\'s rows survive the garage\'s join (' + rows.filter(x => !x.kept).map(x => x.id + ' ' + x.r + '=' + x.v + ': ' + x.asked + ' -> ' + x.built).join('; ') + ')');
    check(rows.every(x => x.signed && x.saveKeeps), 'each is signed on the garage\'s aeroplane and a no-edit Save keeps the factory certificate');
    await ctx.close();
  }
  // ---- the phone, ?map=1 (the sandbox: Take, free) -------------------------------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }), pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push('[phone] ' + String(e.message || e).slice(0, 160)));
    await pg.goto(URL0 + '?audio=0&map=1', { waitUntil: 'domcontentloaded' });
    await until(pg, () => !!window.FLIGHT_PROBE && !!window.FLYDIY_PROCURE && !!document.getElementById('mapEntry'), 240000);
    await sleep(1500);
    check(await openMap(pg), 'the phone: the MAP opens');
    await tap(pg, '#mapScreen .mmSheetTabs .mmTab[data-tab="market"]');
    await tap(pg, '#mapScreen [data-act="sheet"]');
    let st = await shot(pg, 'phone_market', 'the phone: the Market in the sheet (48 px rows), the listings on the map', 'flydiy.player');
    check(st.marketRows >= 4 && st.usedMarks >= 1, 'the phone\'s Market: the models and the listings\' markers');
    await tap(pg, '#mapScreen .mmSheetBody .mmRow[data-sel="m:pinson"]');
    st = await shot(pg, 'phone_card', 'the phone: a model\'s card, its options as 48 px chips, Take it (free in the sandbox)', 'flydiy.player');
    check(/Take it · free in the sandbox/.test(st.card) && /the list/.test(st.card), 'the phone card: Take it free, a way back');
    await tap(pg, '#mapScreen [data-act="buy"]');
    await until(pg, () => /is yours/.test((document.querySelector('#mapScreen .mmMsg') || {}).textContent || ''), 30000);
    st = await shot(pg, 'phone_taken', 'taken: free in the sandbox (a free ledger line), in the hangar, a slot of the shelf', 'flydiy.player');
    const n = st.slots.find(s => /Pinson/.test(s));
    check(!!n && st.wallet === 0 && /^buy \d+ free$/.test(st.ledger.slice(-1)[0] || '') && st.fleet[n] && !st.airframes, 'the sandbox Take: "' + n + '", the wallet 0, a free line (' + st.ledger.slice(-1)[0] + '), no career block');
    await ctx.close();
  }
  await browser.close();
  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify({ what: 'PROCURE stills (G2280)', page: PAGE, renderer: 'SwiftShader (headless Chromium)', fails, shots: index }, null, 1) + '\n');
  console.log(fails.length ? 'procure_shot: ' + fails.length + ' FAIL' : 'procure_shot: all checks ok (' + index.length + ' stills)');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('procure_shot: ' + (e && e.stack || e)); process.exit(1); });
