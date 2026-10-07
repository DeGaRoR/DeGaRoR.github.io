#!/usr/bin/env node
// career_wire_shot.js - THE DEV CAREER ON THE REAL PAGE (G2320, CAREER-WIRE). index.html served by tools/_serve.js in
// headless Chromium on SwiftShader; one still per state and the page's own answers in shots.json:
//   sandbox        no flag: FLYDIY_MODE 'sandbox', no career key in localStorage, no FLYDIY_CAREER, no career plate, no
//                  MAP entry (the sandbox is today's page)
//   career_boot    ?career=1: FLYDIY_MODE 'career', flydiy.career.dev created (careerNew, seed 'dev': the grant, the
//                  voucher, 20 offers), the sandbox's flydiy.player neither read nor written, the MAP entry, the plate
//   career_map     the MAP on the real record: 5 provider tabs + All, 20 rows (every provider's first arc + 3 jobs)
//   career_card    a carry job's card: both ends, the payload, contractPay's pay
//   career_tracked Track pressed: the career document written (careerAccept + careerTrack), the plate's cargo = the
//                  job's declared load, and after a reload still tracked (the document is the page's)
//
//   node tools/_serve.js 8125 &   node tools/career_wire_shot.js [--out reports/evidence/CAREER-WIRE] [--port 8125]
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  try { ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); }
  catch (e2) { console.log('career_wire_shot: no playwright here - nothing pictured'); process.exit(0); }
}
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('out', 'reports/evidence/CAREER-WIRE'));
const PORT = +opt('port', 8125), PAGE = opt('page', 'index.html');
const URL0 = 'http://127.0.0.1:' + PORT + '/flyDiy/' + PAGE;
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (/\.(jpg|png)$/.test(f)) fs.unlinkSync(path.join(OUT, f));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const index = [], fails = [], errs = [];
  const check = (c, what) => { if (!c) fails.push(what); console.log('  ' + (c ? 'ok  ' : 'FAIL') + ' ' + what); return c; };
  const until = async (pg, fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await pg.evaluate(fn)) return true; } catch (e) {} await sleep(250); } return false; };
  const ev = (pg, fn, arg) => pg.evaluate(fn, arg);
  const tap = (pg, sel) => ev(pg, s => { const b = document.querySelector(s); if (b) b.click(); return !!b; }, sel);
  const probe = pg => ev(pg, () => {
    const keys = []; for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
    let car = null; try { car = JSON.parse(localStorage.getItem('flydiy.career.dev') || 'null'); } catch (e) {}
    const scr = document.getElementById('mapScreen'), pl = document.getElementById('crPlate');
    return {
      mode: window.FLYDIY_MODE, keys: keys.filter(k => /^flydiy\.(career|player)/.test(k)), door: !!window.FLYDIY_CAREER, entry: !!document.getElementById('mapEntry'),
      plate: pl ? pl.textContent.replace(/\s+/g, ' ').trim() : null, cargo: pl ? (pl.querySelector('#crKg') || {}).value : null,
      career: car && car.career ? { mode: car.mode, seed: car.career.seed, wallet: car.wallet, offered: car.career.contracts.offered.length, accepted: car.career.contracts.accepted.slice(),
                                    tracked: car.career.contracts.tracked, ledger: car.ledger.map(l => l.k + ' ' + l.amt), voucher: car.career.voucher } : null,
      open: !!scr, rows: scr ? scr.querySelectorAll('.mmList .mmRow').length : 0, tabs: scr ? [...scr.querySelectorAll('.mmTabs:not(.mmAssets) .mmTab')].map(t => t.textContent.trim()) : [],
      source: window.MAP_MENU && window.MAP_MENU.model && window.MAP_MENU.model() ? window.MAP_MENU.model().source : null,
      card: scr ? (scr.querySelector('.mmRight') || {}).innerText.replace(/\s+/g, ' ').trim().slice(0, 1200) : '',
    };
  });
  const shot = async (pg, name, note) => {
    await sleep(400);
    const f = 'career_' + name + '.jpg';
    await pg.screenshot({ path: path.join(OUT, f), type: 'jpeg', quality: 84, timeout: 120000 });
    const st = await probe(pg);
    index.push(Object.assign({ name, file: f, note, url: pg.url() }, st));
    console.log('  ' + f + '  ' + note);
    return st;
  };

  // ---- the sandbox: no flag, no career --------------------------------------------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } }), pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push('[sandbox] ' + String(e.message || e).slice(0, 160)));
    await pg.goto(URL0 + '?audio=0', { waitUntil: 'domcontentloaded' });
    await until(pg, () => !!window.FLIGHT_PROBE && !!window.FLYDIY_PLAYER, 240000);
    await sleep(2000);
    const st = await shot(pg, 'sandbox', 'the sandbox (no ?career=1): today\'s page');
    check(st.mode === 'sandbox' && !st.door && st.plate === null && !st.entry, 'the sandbox: FLYDIY_MODE sandbox, no FLYDIY_CAREER, no career plate, no MAP entry');
    check(!st.keys.some(k => /^flydiy\.career\./.test(k)), 'the sandbox: no career key written (' + st.keys.join(', ') + ')');
    await ctx.close();
  }
  // ---- ?career=1 ----------------------------------------------------------------------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } }), pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push('[career] ' + String(e.message || e).slice(0, 160)));
    await pg.goto(URL0 + '?audio=0&career=1', { waitUntil: 'domcontentloaded' });
    await until(pg, () => !!window.FLIGHT_PROBE && !!window.FLYDIY_CAREER && !!document.getElementById('mapEntry'), 240000);
    await sleep(2000);
    let st = await shot(pg, 'boot', '?career=1: the career mode, the dev career created, the plate and the MAP entry');
    check(st.mode === 'career' && st.door && st.entry && /Career/.test(st.plate || '') && /nothing tracked/.test(st.plate || ''), '?career=1: FLYDIY_MODE career, FLYDIY_CAREER, the MAP entry, the plate ("nothing tracked")');
    check(st.career && st.career.mode === 'career' && st.career.seed === 'dev' && st.career.wallet === 60000 && st.career.offered === 20 && st.career.voucher && st.career.voucher.model === 'cub'
          && st.career.ledger.join() === 'grant -60000', 'flydiy.career.dev: careerNew (seed dev): the 60 000 grant in the ledger, the Cub voucher, 20 offers');
    check(!st.keys.includes('flydiy.player'), 'the sandbox\'s flydiy.player neither read nor written by the career page (' + st.keys.join(', ') + ')');
    await tap(pg, '#mapEntry');
    const opened = await until(pg, () => !!document.getElementById('mapScreen') && window.MAP_MENU && window.MAP_MENU.model() && document.querySelector('#mapScreen .mmPlane img').complete, 90000);
    check(opened, 'the MAP opens');
    st = await shot(pg, 'map', 'the MAP on the real record: a new career\'s offers');
    check(st.source === 'career' && st.rows === 20 && st.tabs.length === 6 && /Trust/.test(st.tabs.join()) && /Mine & Dock/.test(st.tabs.join()), 'the real record: 20 rows, All + 5 provider tabs (' + st.tabs.join(' | ') + ')');
    const job = await ev(pg, () => window.FLYDIY_CAREER.doc().career.contracts.offered.find(id => /^job:field:/.test(id) && window.FLYDIY_CAREER.record().contracts.find(c => c.id === id).stages[0].subs[0].do === 'carry'));
    await tap(pg, '#mapScreen .mmRow[data-sel="c:' + job + '"]');
    st = await shot(pg, 'card', 'a carry job\'s card (' + job + '): both ends, the payload, contractPay\'s pay');
    const pay = await ev(pg, j => window.FLYDIY_CAREER.record().contracts.find(c => c.id === j).pay.total, job);
    check(/Jolene AFB 13\/31|Tamgas Hill Strip/.test(st.card) && / kg/.test(st.card) && st.card.includes(String(pay) + ' net'), 'the card: both ends, the payload, the pay ' + pay + ' net');
    await tap(pg, '#mapScreen .mmRight [data-act="track"]');
    await sleep(500);
    st = await shot(pg, 'tracked', 'Track: the career document written (accepted and tracked); the plate follows');
    const kg = await ev(pg, j => window.FLYDIY_CAREER.record().contracts.find(c => c.id === j).stages[0].subs[0].load.kg, job);
    check(st.career.accepted.includes(job) && st.career.tracked === job, 'Track wrote flydiy.career.dev: accepted and tracked ' + job);
    check(/★/.test(st.plate || '') && String(st.cargo) === String(kg), 'the plate: the tracked job, the cargo aboard = its declared ' + kg + ' kg (' + st.plate + ')');
    // a reload: the career is the page's document
    await pg.reload({ waitUntil: 'domcontentloaded' });
    await until(pg, () => !!window.FLIGHT_PROBE && !!window.FLYDIY_CAREER && !!document.getElementById('crPlate'), 240000);
    await sleep(1500);
    st = await shot(pg, 'reloaded', 'a reload: the dev career is still the page\'s, the job still tracked');
    check(st.career && st.career.tracked === job && /★/.test(st.plate || ''), 'a reload: still tracked (' + (st.career && st.career.tracked) + ')');
    await ctx.close();
  }
  await browser.close();
  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify({ what: 'CAREER-WIRE stills (G2320)', page: PAGE, renderer: 'SwiftShader (headless Chromium)', fails, shots: index }, null, 1) + '\n');
  console.log(fails.length ? 'career_wire_shot: ' + fails.length + ' FAIL' : 'career_wire_shot: all checks ok (' + index.length + ' stills)');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('career_wire_shot: ' + (e && e.stack || e)); process.exit(1); });
