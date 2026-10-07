#!/usr/bin/env node
// pilots_shot.js - THE PILOTS ON THE REAL PAGE (G2290, PILOTS). index.html served by tools/_serve.js in headless Chromium
// on SwiftShader; one still per state and the page's own answers in shots.json:
//   sandbox        no flag: no career door, no pilot row on the route, the crew's body door never set (today's page)
//   career_route   ?career=1: the route row's pilot (the roster + "I fly"), the companion flying next
//   career_pilots  the MAP's Pilots tab on the real record: Kit hired, 2-3 looking for work, a card each
//   career_hired   Hire pressed: the sign-on charged (the ledger's line), the roster grown, the card's Fire
//   career_card    a pilot's card: flies like, the traits, the record
//   career_flying  the roll-out with the pick: the flyer is the hired pilot, the crew's seat wears their body
//   phone_pilots   the phone's sheet on the Pilots tab
//
//   node tools/_serve.js 8125 &   node tools/pilots_shot.js [--out reports/evidence/PILOTS] [--port 8125]
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  try { ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); }
  catch (e2) { console.log('pilots_shot: no playwright here - nothing pictured'); process.exit(0); }
}
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('out', 'reports/evidence/PILOTS'));
const PORT = +opt('port', 8125), PAGE = opt('page', 'index.html');
const URL0 = 'http://127.0.0.1:' + PORT + '/flyDiy/' + PAGE;
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (/\.(jpg|png)$/.test(f)) fs.unlinkSync(path.join(OUT, f));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const index = [], fails = [], errs = [];
  const check = (c, what) => { if (!c) fails.push(what); console.log('  ' + (c ? 'ok  ' : 'FAIL') + ' ' + what); return c; };
  const until = async (pg, fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await pg.evaluate(fn)) return true; } catch (e) {} await sleep(500); } return false; };
  const ev = (pg, fn, arg) => pg.evaluate(fn, arg);
  const tap = (pg, sel) => ev(pg, s => { const b = document.querySelector(s); if (b) b.click(); return !!b; }, sel);
  const keep = pg => ev(pg, () => { [...document.querySelectorAll('button,a,div')].filter(b => /keep the current build/i.test(b.textContent || '') && b.children.length === 0).forEach(x => x.click()); return 1; });
  const probe = pg => ev(pg, () => {
    let car = null; try { car = JSON.parse(localStorage.getItem('flydiy.career.dev') || 'null'); } catch (e) {}
    const row = document.querySelector('#edRoute .crewPick select'), why = document.querySelector('#edRoute .crewWhy');
    const scr = document.getElementById('mapScreen');
    return {
      mode: window.FLYDIY_MODE, door: !!window.FLYDIY_CAREER, pilotsDoor: !!(window.FLYDIY_CAREER && window.FLYDIY_CAREER.pilots),
      crewBody: window.FLYDIY_CREW_PILOT === undefined ? '(never set)' : window.FLYDIY_CREW_PILOT,
      row: row ? { value: row.value, options: [...row.options].map(o => o.value + ':' + o.textContent) } : null, why: why ? why.textContent : null,
      career: car && car.career ? { wallet: car.wallet, roster: car.career.roster, pick: car.career.pilotPick, ledger: car.ledger.map(l => l.k + ' ' + l.amt + (l.ref ? ' ' + l.ref : '')),
                                    places: Object.fromEntries(Object.keys(car.career.pilots || {}).map(id => [id, car.career.pilots[id].aero + (car.career.pilots[id].plane ? '+' + car.career.pilots[id].plane : '')])) } : null,
      flyer: window.FLYDIY_CAREER && window.FLYDIY_CAREER.pilots ? window.FLYDIY_CAREER.pilots.flyer() : null,
      open: !!scr, pilots: scr ? [...scr.querySelectorAll('.mmPilot .mmRowT b')].map(b => b.textContent).filter(Boolean) : [],
      list: scr ? ((scr.querySelector('.mmList') || scr.querySelector('.mmSheetBody') || {}).innerText || '').replace(/\s+/g, ' ').trim().slice(0, 1400) : '',
      card: scr ? ((scr.querySelector('.mmRight') || scr.querySelector('.mmSheetBody') || {}).innerText || '').replace(/\s+/g, ' ').trim().slice(0, 1200) : '',
    };
  });
  const shot = async (pg, name, note, clip) => {
    await sleep(500);
    const f = name + '.jpg';
    await pg.screenshot({ path: path.join(OUT, f), type: 'jpeg', quality: 84, timeout: 120000, clip });
    const st = await probe(pg);
    index.push(Object.assign({ name, file: f, note, url: pg.url() }, st));
    console.log('  ' + f + '  ' + note);
    return st;
  };
  const garageUp = async (pg, career) => {
    for (let i = 0; i < 150; i++) {
      await sleep(2000); await keep(pg);
      if (await ev(pg, c => { const h = document.getElementById('edRoute'); return !!(h && h.offsetParent && window.FLIGHT_PROBE && window.FLYDIY_PLAYER && (!c || h.querySelector('.crewPick'))) && (!window.BOOT || !BOOT.state || BOOT.state === 'gone'); }, career)) return true;
    }
    return false;
  };

  // ---- the sandbox --------------------------------------------------------------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } }), pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push('[sandbox] ' + String(e.message || e).slice(0, 160)));
    await pg.goto(URL0 + '?audio=0', { waitUntil: 'domcontentloaded' });
    check(await garageUp(pg, false), 'the sandbox garage is up');
    await sleep(1500);
    const st = await shot(pg, 'sandbox', 'the sandbox (no ?career=1): the route row as today, no pilot pick');
    check(st.mode === 'sandbox' && !st.door && st.row === null && st.crewBody === '(never set)', 'the sandbox: no career door, no pilot row on the route, the crew\'s body door never set');
    await ctx.close();
  }
  // ---- ?career=1 (desktop) ----------------------------------------------------------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } }), pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push('[career] ' + String(e.message || e).slice(0, 160)));
    await pg.goto(URL0 + '?audio=0&career=1', { waitUntil: 'domcontentloaded' });
    check(await garageUp(pg, true), 'the career garage is up with the pilot row');
    await sleep(1500);
    const box = await ev(pg, () => { const r = document.getElementById('edRoute').getBoundingClientRect(); return { x: Math.max(0, r.left - 16), y: Math.max(0, r.top - 16), width: Math.min(1600 - Math.max(0, r.left - 16), r.width + 32), height: r.height + 64 }; });
    let st = await shot(pg, 'career_route', '?career=1: the route row\'s pilot - the roster and "I fly"', box);
    check(st.pilotsDoor && st.row && st.row.value === 'kit' && st.row.options.join() === 'kit:Kit,me:I fly', 'the route row: Kit (the companion) flies next; "I fly" beside (' + (st.row && st.row.options.join(' | ')) + ')');
    check(st.career && st.career.roster.join() === 'kit' && st.career.wallet === 60000, 'careerNew: Kit on the roster, the grant untouched');
    await tap(pg, '#mapEntry');
    check(await until(pg, () => !!document.getElementById('mapScreen') && window.MAP_MENU && window.MAP_MENU.model() && document.querySelector('#mapScreen .mmPlane img').complete, 90000), 'the MAP opens');
    await tap(pg, '#mapScreen .mmTab[data-tab="pilots"]');
    st = await shot(pg, 'career_pilots', 'the Pilots tab: your pilots, then the ones looking for work');
    check(st.pilots.length >= 3 && st.pilots[0] === 'Kit' && /Looking for work/.test(st.list) && /flies like/.test(st.list), 'the tab: Kit first, ' + (st.pilots.length - 1) + ' looking for work, "flies like" (' + st.pilots.join(', ') + ')');
    const hire = await ev(pg, () => { const b = document.querySelector('#mapScreen [data-act="pilot"][data-pa="hire"]'); return b ? b.dataset.pid : null; });
    const fee = await ev(pg, id => window.FLYDIY_CAREER.pilots.card(id).signOn, hire);
    await tap(pg, '#mapScreen [data-act="pilot"][data-pa="hire"][data-pid="' + hire + '"]');
    await sleep(600);
    st = await shot(pg, 'career_hired', 'Hire ' + hire + ': the sign-on charged, on the roster');
    check(st.career.roster.join() === 'kit,' + hire && st.career.wallet === 60000 - fee && st.career.ledger.includes('signon ' + fee + ' ' + hire), 'hired ' + hire + ': the roster, the wallet -' + fee + ', the ledger\'s sign-on line');
    await tap(pg, '#mapScreen .mmRow[data-sel="p:kit"]');
    st = await shot(pg, 'career_card', 'Kit\'s card: flies like, the traits (mechanic, cautious, night-shy), the record');
    check(/Flies like/i.test(st.card) && /mechanic/.test(st.card) && /night-shy/.test(st.card) && /toward bush/.test(st.card), 'Kit\'s card: flies like, the traits, growing toward bush');
    await tap(pg, '#mapScreen [data-act="pilot"][data-pa="pick"][data-pid="' + hire + '"]');
    await sleep(400);
    await tap(pg, '#mapScreen [data-act="close"]');
    await sleep(800);
    st = await probe(pg);
    check(st.career.pick === hire && st.row && st.row.value === hire, 'Flies next: ' + hire + ' is the route row\'s pick (' + (st.row && st.row.value) + ')');
    // the roll-out with the pick
    await tap(pg, '#edRoll');
    const flying = await until(pg, () => !!(window.FLIGHT_PROBE && FLIGHT_PROBE.ap()) && !(document.getElementById('edActs') && document.getElementById('edActs').offsetParent) && (!window.BOOT || !BOOT.state || BOOT.state === 'gone'), 300000);
    check(flying, 'rolled out');
    await sleep(4000);
    st = await shot(pg, 'career_flying', 'rolled out: ' + hire + ' flies it (the crew\'s seat wears their body)');
    check(st.flyer === hire || st.flyer === 'me', 'the flyer is decided at the roll-out (' + st.flyer + (st.flyer === 'me' ? ': refused - ' + (st.why || '') : '') + ')');
    check(st.flyer !== hire || st.crewBody !== '(never set)', 'the crew\'s body door was set for ' + hire + ' (' + st.crewBody + ')');
    await ctx.close();
  }
  // ---- the phone ----------------------------------------------------------------------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }), pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push('[phone] ' + String(e.message || e).slice(0, 160)));
    await pg.goto(URL0 + '?audio=0&career=1', { waitUntil: 'domcontentloaded' });
    const up = await until(pg, () => !!window.FLYDIY_CAREER && !!document.getElementById('mapEntry'), 300000);
    check(up, 'the phone page is up with the MAP entry');
    await sleep(2000); await keep(pg);
    await tap(pg, '#mapEntry');
    check(await until(pg, () => !!document.getElementById('mapScreen') && window.MAP_MENU && window.MAP_MENU.model(), 90000), 'the phone MAP opens');
    await ev(pg, () => window.MAP_MENU.set({ tab: 'pilots', sheet: 'open', detail: false }));
    const st = await shot(pg, 'phone_pilots', 'the phone: the sheet on the Pilots tab');
    check(st.pilots.length >= 3 && /Kit/.test(st.list), 'the phone sheet lists the pilots (' + st.pilots.join(', ') + ')');
    const small = await ev(pg, () => [...document.querySelectorAll('#mapScreen .mmSheetBody button')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 47.5).map(b => b.className + ':' + b.textContent.slice(0, 20)));
    check(!small.length, 'R1: every pilot target on the phone >= 48 px' + (small.length ? ' (' + small.join(' | ') + ')' : ''));
    await ctx.close();
  }
  await browser.close();
  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify({ what: 'PILOTS stills (G2290)', page: PAGE, renderer: 'SwiftShader (headless Chromium)', fails, shots: index }, null, 1) + '\n');
  console.log(fails.length ? 'pilots_shot: ' + fails.length + ' FAIL' : 'pilots_shot: all checks ok (' + index.length + ' stills)');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('pilots_shot: ' + (e && e.stack || e)); process.exit(1); });
