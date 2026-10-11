#!/usr/bin/env node
// econ_page.js - THE CAREER WALLET ON THE REAL PAGE (G2260, ECONOMY). index.html served by tools/_serve.js in headless
// Chromium on SwiftShader; the page's own answers at each step in econ_page.json:
//   sandbox   no flag: no FLYDIY_ECON, no #ecWallet; a NEW airframe saved, a kit fitted, the shell and the size changed
//             through the garage's own doors - the player document's wallet and ledger exactly as before (nothing
//             charged, nothing recorded: today's page), the room changed as always
//   career    ?career=1: the wallet line in the garage ("Wallet 60 000 ₵") and on the flight plate; a NEW airframe saved
//             = materialised (the ledger x the main hangar's labour: an `airframe` line, the wallet down by it); saving
//             over it again costs nothing; a kit fitted = a purchase (`upgrade`, KIT_PRICES); the wallet emptied -> a
//             new airframe's save REFUSED (no slot written, nothing charged), a kit refused (the room unchanged);
//             below -20 000 the Trust's loan job is first on the MAP's record
//
//   node tools/_serve.js 8125 &   node tools/econ_page.js [--out reports/evidence/ECONOMY] [--port 8125]
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  try { ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); }
  catch (e2) { console.log('econ_page: no playwright here - nothing run'); process.exit(0); }
}
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('out', 'reports/evidence/ECONOMY'));
const PORT = +opt('port', 8125), PAGE = opt('page', 'index.html');
const URL0 = 'http://127.0.0.1:' + PORT + '/flyDiy/' + PAGE;
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const index = [], fails = [], errs = [];
  const check = (c, what) => { if (!c) fails.push(what); console.log('  ' + (c ? 'ok  ' : 'FAIL') + ' ' + what); return c; };
  const until = async (pg, fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await pg.evaluate(fn)) return true; } catch (e) {} await sleep(250); } return false; };
  const ev = (pg, fn, arg) => pg.evaluate(fn, arg);
  const doc = (pg, key) => ev(pg, k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }, key);
  const wl = pg => ev(pg, () => { const e = document.getElementById('ecWallet'); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; });
  // the page's state at each step (no still: the page boots onto the roll-out screen over the garage, so a picture
  // would show the loading card, not the wallet line - the line's own text is recorded instead)
  const shot = async (pg, name, note, extra) => {
    await sleep(400);
    index.push(Object.assign({ name, note, wallet: await wl(pg) }, extra || {}));
    console.log('  [' + name + ']  ' + note);
  };
  const boot = async (q, tag) => {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } }), pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push('[' + tag + '] ' + String(e.message || e).slice(0, 160)));
    pg.on('dialog', d => { index.push({ name: tag + '_dialog', note: d.message() }); d.dismiss().catch(() => {}); });
    await pg.goto(URL0 + q, { waitUntil: 'domcontentloaded' });
    await until(pg, () => !!window.FLIGHT_PROBE && !!window.FLYDIY_PLAYER && !!window.GARAGE_SPEC && !!window.GARAGE_ENV, 240000);
    await sleep(2500);
    return { ctx, pg };
  };
  const shelf = pg => ev(pg, () => { const o = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^flydiy\.build\./.test(k)) o.push(k.slice(13)); } return o.sort(); });

  // ---- the sandbox: the same doors, nothing charged, nothing recorded -------------------------------------------------
  {
    const { ctx, pg } = await boot('?audio=0', 'sandbox');
    const d0 = await doc(pg, 'flydiy.player');
    check(!(await ev(pg, () => !!window.FLYDIY_ECON)) && (await wl(pg)) === null, 'the sandbox: no FLYDIY_ECON, no wallet line');
    await ev(pg, () => window.GARAGE_SPEC.save('Econ Sandbox'));
    await sleep(800);
    const kits0 = await ev(pg, () => window.GARAGE_ENV.kits().filter(k => k.on).map(k => k.key));
    const off = kits0.find(k => k === 'metal') || kits0[0];
    await ev(pg, k => { window.GARAGE_ENV.setKit(k, false); window.GARAGE_ENV.setKit(k, true); }, off);
    const dims0 = await ev(pg, () => window.GARAGE_ENV.dims());
    await ev(pg, d => window.GARAGE_ENV.setDims({ HW: d.HW + 1 }), dims0);
    await sleep(800);
    const d1 = await doc(pg, 'flydiy.player');
    check(d1.wallet === d0.wallet && JSON.stringify(d1.ledger) === JSON.stringify(d0.ledger), 'the sandbox: a new airframe, a kit, a size - the wallet (' + d1.wallet + ') and the ledger (' + d1.ledger.length + ' lines) exactly as before');
    check(!!d1.fleet['Econ Sandbox'] && Math.abs(d1.sheds.HOME.dims.HW - (dims0.HW + 1)) < 1e-6, 'the sandbox: the airframe is in the fleet, the room grew - as always');
    check(!(await ev(pg, () => { for (let i = 0; i < localStorage.length; i++) if (/^flydiy\.career/.test(localStorage.key(i))) return true; return false; })), 'the sandbox: no career key');
    await shot(pg, 'sandbox', 'the sandbox: the garage with no wallet line', { ledger: d1.ledger.length, wallet0: d0.wallet, wallet1: d1.wallet });
    await ev(pg, () => { for (const k of Object.keys(localStorage)) if (/^flydiy\.build\.Econ Sandbox$/.test(k)) localStorage.removeItem(k); });
    await ctx.close();
  }

  // ---- the career: the wallet charges ------------------------------------------------------------------------------------
  {
    const { ctx, pg } = await boot('?career=1&audio=0', 'career');
    const K = 'flydiy.career.dev';
    let d = await doc(pg, K);
    check(d && d.mode === 'career' && d.wallet === 60000, 'the career: flydiy.career.dev, the 60 000 grant');
    check(/^Wallet 60 000 ₵/.test((await wl(pg)) || ''), 'the career: the wallet line in the garage (' + (await wl(pg)) + ')');
    await shot(pg, 'career_garage', 'the career: the garage\'s wallet line');
    const P = await ev(pg, () => window.FLYDIY_ECON.price());
    check(P && P.price > 0 && P.cost > 0, 'the build on the stand priced: the ledger ' + (P && P.cost) + ' -> ' + (P && P.price) + ' (wants ' + (P && P.wants.join(',')) + ')');
    await ev(pg, () => window.GARAGE_SPEC.save('Econ Career'));
    await sleep(800);
    // the price of what was saved (the stand may still have been settling when it was first read: read it again)
    const P1 = await ev(pg, () => window.FLYDIY_ECON.price());
    if (P1 && P1.price !== P.price) { index.push({ name: 'reprice', note: 'the stand settled: ' + P.price + ' -> ' + P1.price }); Object.assign(P, P1); }
    d = await doc(pg, K);
    const L = d.ledger[d.ledger.length - 1];
    check(d.fleet['Econ Career'] && L.k === 'airframe' && L.amt === P.price && d.wallet === 60000 - P.price && d.career.airframes['Econ Career'].paid === P.price,
          'a new airframe saved: materialised, ' + P.price + ' charged (an airframe line, the price on its row; the wallet ' + d.wallet + ')');
    await ev(pg, () => window.GARAGE_SPEC.save('Econ Career'));
    await sleep(500);
    const d2 = await doc(pg, K);
    check(d2.wallet === d.wallet && d2.ledger.length === d.ledger.length, 'saving over it again costs nothing');
    await shot(pg, 'career_bought', 'the career: an airframe bought', { wallet: d2.wallet });
    // a kit: off (free), back on (paid)
    await ev(pg, () => window.GARAGE_ENV.setKit('metal', false));
    await sleep(300);
    const w0 = (await doc(pg, K)).wallet;
    await ev(pg, () => window.GARAGE_ENV.setKit('metal', true));
    await sleep(500);
    const d3 = await doc(pg, K), L3 = d3.ledger[d3.ledger.length - 1];
    const kp = await ev(pg, () => KIT_PRICES.metal);
    check(L3.k === 'upgrade' && L3.amt === kp && d3.wallet === w0 - kp && d3.sheds.HOME.kits.includes('metal'), 'a kit fitted: paid ' + kp + ' (an upgrade line)');
    // empty the wallet: a new airframe's save is refused, a kit refused
    await ev(pg, () => { const x = window.FLYDIY_PLAYER.doc(); x.wallet = 500; window.FLYDIY_PLAYER.set(x); });
    await ev(pg, () => window.GARAGE_ENV.setKit('wood', false));
    await sleep(300);
    const before = await doc(pg, K), shelf0 = await shelf(pg);
    await ev(pg, () => window.GARAGE_SPEC.save('Econ Poor'));
    await sleep(600);
    const after = await doc(pg, K), shelf1 = await shelf(pg);
    check(!shelf1.includes('Econ Poor') && !after.fleet['Econ Poor'] && after.wallet === before.wallet && after.ledger.length === before.ledger.length && JSON.stringify(shelf0) === JSON.stringify(shelf1),
          'the wallet short: a new airframe\'s save REFUSED (no slot written, nothing charged)');
    const r = await ev(pg, () => window.GARAGE_ENV.setKit('wood', true));
    const after2 = await doc(pg, K);
    check(!after2.sheds.HOME.kits.includes('wood') && after2.wallet === before.wallet && Array.isArray(r) && !r.includes('wood'), 'the wallet short: a kit refused, the room unchanged');
    await shot(pg, 'career_refused', 'the career: a purchase refused (the wallet line says why)', { note2: await ev(pg, () => window.FLYDIY_ECON.note()) });
    // below -20 000: the Trust's loan job, first on the map's record
    await ev(pg, () => { const x = window.FLYDIY_PLAYER.doc(); x.wallet = -20001; window.FLYDIY_PLAYER.set(x); });
    const rec = await ev(pg, () => window.FLYDIY_CAREER.record());
    const c0 = rec.contracts[0];
    check(c0 && c0.id === 'loan:field:1' && c0.pay.total === 21000 && c0.provider === 'field', 'below -20 000: the Trust\'s loan job first on the map (' + (c0 && c0.id) + ', pays ' + (c0 && c0.pay.total) + ')');
    const pl = await ev(pg, () => { const e = document.getElementById('crPlate'); return e ? e.textContent.replace(/\s+/g, ' ') : ''; });
    check(/wallet/.test(pl), 'the flight plate carries the wallet (CAREER-WIRE\'s #crPlate)');
    await ev(pg, () => { for (const k of Object.keys(localStorage)) if (/^flydiy\.build\.Econ /.test(k)) localStorage.removeItem(k); });
    await ctx.close();
  }
  await browser.close();
  check(!errs.length, 'no page error' + (errs.length ? ': ' + errs.join(' | ') : ''));
  fs.writeFileSync(path.join(OUT, 'econ_page.json'), JSON.stringify({ index, fails, errs }, null, 1));
  console.log('econ_page: ' + (fails.length ? 'FAIL (' + fails.length + ')' : 'PASS'));
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
