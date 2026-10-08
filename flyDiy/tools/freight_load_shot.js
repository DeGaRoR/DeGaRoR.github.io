#!/usr/bin/env node
// freight_load_shot.js - THE LOADING VIEW ON THE REAL PAGE (G2345-G2349, FREIGHT-LOAD). index.html served by
// tools/_serve.js in headless Chromium on SwiftShader. STILLS OF A LOADED PAGE ONLY: every still is taken after
// BOOT.state 'gone', #boot hidden and 2 s more (never a loading screen). The page's own answers go to shots.json.
//   sandbox        no flag: no FLYDIY_FREIGHT, no LOAD entry (the sandbox is today's page)
//   cub_crates     ?freight=1: the validated Cub on the stand, 120 kg of crated parts - the packer's proposal (one
//                  crate aboard, the other on the ground: the Cub's answer with its seats in)
//   cub_seat_out   ...the empty rear seat taken out and Propose again: both crates aboard, 30 kg over the MTOW shown red
//                  and allowed
//   c172_mail_pax  the C172, 60 kg of mail sacks + a passenger (the passenger's envelope drawn, the pilot the cage's)
//   c172_drag      a sack dragged with the mouse into the baggage bay (the pointer's own drag)
//   c172_red       120 kg of crates both moved into the baggage bay: the CG aft of the certified range, the placard
//                  and the floor - every number RED, the placement ALLOWED
//   career_*       ?career=1: the voucher's Cub bought and opened, a cargo job tracked (35 kg of tools), the LOAD entry,
//                  the view on the tracked job's items, Accept -> career.load (the plate's cargo is the items')
//   phone_*        ?freight=1 on a 390 x 844 phone: the same view, an item moved by tap-to-pick + tap-to-place
//
//   node tools/_serve.js 8125 &   node tools/freight_load_shot.js [--out futureDesigns/game/evidence/FREIGHT-LOAD] [--port 8125] [--only desk,career,phone]
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  try { ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); }
  catch (e2) { console.log('freight_load_shot: no playwright here - nothing pictured'); process.exit(0); }
}
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('out', 'futureDesigns/game/evidence/FREIGHT-LOAD'));
const PORT = +opt('port', 8125), ONLY = opt('only', 'sandbox,desk,career,phone').split(',');
const URL0 = 'http://127.0.0.1:' + PORT + '/flyDiy/index.html?audio=0';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  let index = [];
  try { index = JSON.parse(fs.readFileSync(path.join(OUT, 'shots.json'), 'utf8')).shots.filter(s => !ONLY.some(o => s.group === o)); } catch (e) {}
  const fails = [], errs = [];
  const check = (c, what) => { if (!c) fails.push(what); console.log('  ' + (c ? 'ok  ' : 'FAIL') + ' ' + what); return c; };
  const ev = (pg, fn, arg) => pg.evaluate(fn, arg);
  // A LOADED PAGE: the loading screen gone (BOOT.state 'gone', #boot hidden), then 2 s
  const loaded = async pg => {
    const t0 = Date.now();
    while (Date.now() - t0 < 900000) {
      const s = await ev(pg, () => ({ st: window.BOOT && window.BOOT.state, hid: (() => { const b = document.getElementById('boot'); return !b || getComputedStyle(b).display === 'none' || b.classList.contains('gone'); })() })).catch(() => null);
      if (s && s.st === 'gone' && s.hid) break;
      await sleep(1000);
    }
    await sleep(2000);
    // the first launch's "New aeroplane" picker: keep the current build
    await ev(pg, () => { const b = [...document.querySelectorAll('#dfBirth button')].find(e => /keep the current/i.test(e.textContent)); if (b) b.click(); });
    await sleep(800);
    return (Date.now() - t0) / 1000;
  };
  const probe = pg => ev(pg, () => {
    const F = window.FREIGHT_LOAD, R = F && F.isOpen() ? F.report() : null, st = F && F.isOpen() ? F.state() : null;
    const bar = document.getElementById('frLoad');
    return {
      boot: window.BOOT && window.BOOT.state, open: !!(F && F.isOpen()), card: F && F.card() ? F.card().id : null,
      placed: st ? st.placed.map(p => p.id + ' x ' + p.at.x0 + '-' + p.at.x1 + ' z ' + p.at.z0 + (p.on ? ' on ' + p.on : '') + ' [' + p.space + ']') : [],
      seatsOut: st ? st.seatsOut : [], pax: st ? st.pax : 0,
      report: R ? { kg: R.mass.kg, mtow: R.mass.mtow, massOk: R.mass.ok, cg: R.cg.pct, range: R.cg.pctRange, cgOk: R.cg.ok, floorOk: R.floorOk, bag: R.baggage, ok: R.ok, why: R.why, ashore: R.ashore } : null,
      bar: bar ? bar.innerText.replace(/\s+/g, ' ').trim().slice(0, 600) : null, red: bar ? bar.querySelectorAll('.bad').length : 0,
      check: window.FLYDIY_FREIGHT && window.FLYDIY_FREIGHT.frameCheck ? window.FLYDIY_FREIGHT.frameCheck() : null,
    };
  });
  const shot = async (pg, group, name, note) => {
    await sleep(1500);
    const f = 'freight_' + name + '.jpg';
    await pg.screenshot({ path: path.join(OUT, f), type: 'jpeg', quality: 84, timeout: 180000 });
    const st = await probe(pg);
    index.push(Object.assign({ group, name, file: f, note }, st));
    console.log('  ' + f + '  ' + note);
    return st;
  };
  const openView = (pg, test, design) => ev(pg, async ([t, d]) => {
    const F = window.FLYDIY_FREIGHT;
    if (window.FREIGHT_LOAD && window.FREIGHT_LOAD.isOpen()) window.FREIGHT_LOAD.close();
    F.test(t);
    if (d) await F.stand(d);
    const r = await F.open();
    await new Promise(res => setTimeout(res, 2500));
    return r;
  }, [test, design]);

  // ---- the sandbox: no flag ----------------------------------------------------------------------------------------
  if (ONLY.includes('sandbox')) {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } }), pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push('[sandbox] ' + String(e.message || e).slice(0, 160)));
    await pg.goto(URL0, { waitUntil: 'domcontentloaded' });
    console.log('the sandbox loaded in ' + (await loaded(pg)) + ' s');
    const st = await ev(pg, () => ({ door: !!window.FLYDIY_FREIGHT, view: !!window.FREIGHT_LOAD, entry: !!document.getElementById('frEntry') }));
    check(!st.door && !st.view && !st.entry, 'the sandbox: no FLYDIY_FREIGHT, no lazy view, no LOAD entry');
    index.push({ group: 'sandbox', name: 'sandbox', note: 'no flag: no loading view', door: st.door, entry: st.entry });
    await ctx.close();
  }
  // ---- ?freight=1 on the desktop -----------------------------------------------------------------------------------
  if (ONLY.includes('desk')) {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } }), pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push('[desk] ' + String(e.message || e).slice(0, 160)));
    await pg.goto(URL0 + '&freight=1', { waitUntil: 'domcontentloaded' });
    console.log('?freight=1 loaded in ' + (await loaded(pg)) + ' s');
    check(await ev(pg, () => !!document.getElementById('frEntry') && !document.getElementById('frEntry').hidden), 'the LOAD entry stands in the garage');
    let r = await openView(pg, 'parts120', 'cub');
    let st = await shot(pg, 'desk', 'cub_crates', 'the Cub, 120 kg of crated parts: the packer\'s proposal - one crate aboard behind the pilot, the other on the ground (the seats in)');
    check(r.ok && st.card === 'cub' && st.placed.length === 1 && st.report.ashore.length === 1 && st.report.ok, 'the Cub: one crate aboard, one on the ground, within every limit (' + st.placed.join('; ') + ')');
    check(st.check && st.check.hold.top < st.check.skin.roof && st.check.hold.half < st.check.skin.side && st.check.hold.floor > st.check.skin.under, 'the hold sits inside the drawn skin (' + JSON.stringify(st.check) + ')');
    await ev(pg, () => { window.FREIGHT_LOAD.seat(1); window.FREIGHT_LOAD.propose(); });
    st = await shot(pg, 'desk', 'cub_seat_out', 'the empty rear seat taken out (the cage\'s chair hides), Propose again: both crates aboard, 30 kg over the MTOW - red, allowed');
    check(st.seatsOut.join() === '1' && st.placed.length === 2 && !st.report.massOk && st.red > 0, 'seat 2 out, Propose again: both crates aboard, over the MTOW shown red (' + st.report.kg + ' / ' + st.report.mtow + ')');
    r = await openView(pg, 'mail60p', 'c172');
    st = await shot(pg, 'desk', 'c172_mail_pax', 'the C172, 60 kg of mail sacks + a passenger: the passenger\'s envelope (cyan) beside the pilot, the sacks behind');
    check(r.ok && st.card === 'c172' && st.pax === 1 && st.placed.length === 3 && st.report.ok, 'the C172: three mail sacks and a passenger, within every limit (CG ' + (st.report && st.report.cg) + ' %)');
    // THE POINTER'S OWN DRAG: the first sack into the baggage bay
    const pts = await ev(pg, () => { const F = window.FREIGHT_LOAD, s = F.state(), p = s.placed[0], H = F.card().hold, xb = F.card().cabinX1 + 0.35, ib = Math.round((xb - H.x0) / H.dx);
      return { id: p.id, a: F.screenOf((p.at.x0 + p.at.x1) / 2, p.at.y1, (p.at.z0 + p.at.z1) / 2), b: F.screenOf(xb, H.y0 + H.floor[ib] / 100, 0) }; });
    await pg.mouse.move(pts.a.x, pts.a.y); await pg.mouse.down();
    for (let k = 1; k <= 10; k++) { await pg.mouse.move(pts.a.x + (pts.b.x - pts.a.x) * k / 10, pts.a.y + (pts.b.y - pts.a.y) * k / 10); await sleep(80); }
    await pg.mouse.up();
    st = await shot(pg, 'desk', 'c172_drag', 'a sack dragged with the mouse into the baggage bay (snapped on the stations)');
    check(st.placed.some(l => l.startsWith(pts.id + ' ') && /\[baggage\]/.test(l)), 'the mouse\'s drag: ' + pts.id + ' into the baggage bay (' + st.placed.join('; ') + ')');
    r = await openView(pg, 'parts120', 'c172');
    // the rear seats out, the packer's answer, then each crate as far aft as it goes (the hand's own moves)
    const mv = await ev(pg, () => {
      const F = window.FREIGHT_LOAD; F.seat(2); F.seat(3); F.propose();
      const H = F.card().hold, out = [];
      for (const id of F.state().placed.slice().sort((a, b) => b.at.x0 - a.at.x0).map(p => p.id))
        for (let x = H.x0 + H.n * H.dx; x > H.x0; x -= 0.05) { const m = F.move(id, x, 0); if (m.ok) { out.push(id + ' @' + x.toFixed(2)); break; } }
      return { moved: out, aboard: F.state().placed.length };
    });
    st = await shot(pg, 'desk', 'c172_red', 'the C172\'s rear seats out and its two crates pushed aft into the baggage bay: the CG aft of the certified range, the placard and the floor - red, and the placement stands');
    check(mv.aboard === 2 && mv.moved.length === 2 && !st.report.cgOk && !st.report.bag.ok && !st.report.floorOk && st.red >= 3, 'out of range ALLOWED and shown red (' + mv.moved.join(', ') + '; CG ' + st.report.cg + ' % of ' + st.report.range.join('-') + '; ' + st.report.why.join('; ') + ')');
    // a refusal: into the pilot
    const no = await ev(pg, () => { const F = window.FREIGHT_LOAD, s = F.card().seats[0]; return F.move('parts.1', s.back - 0.3, s.z); });
    check(!no.ok && /pilot/.test(no.why), 'refused, said on the bar: ' + no.why);
    await ctx.close();
  }
  // ---- ?career=1: the tracked job -----------------------------------------------------------------------------------
  if (ONLY.includes('career')) {
    const KEY = 'flydiy.career.dev';
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } }), pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push('[career] ' + String(e.message || e).slice(0, 160)));
    await pg.goto(URL0 + '&career=1', { waitUntil: 'domcontentloaded' });
    console.log('?career=1 loaded in ' + (await loaded(pg)) + ' s');
    const setup = await ev(pg, async () => {
      const b = await window.FLYDIY_PROCURE.buyModel('scout', {}, { slot: 'Scout' });
      if (!b.ok) return { why: b.why };
      window.GARAGE_SPEC.load('Scout');
      const t0 = Date.now(); while (Date.now() - t0 < 120000 && !(window.FLYDIY_FREIGHT.card() && window.FLYDIY_FREIGHT.frame())) await new Promise(r => setTimeout(r, 500));
      window.FLYDIY_CAREER.act('job:field:0:0', 'track');
      await new Promise(r => setTimeout(r, 1500));
      const e = document.getElementById('frEntry');
      return { slot: b.slot, card: window.FLYDIY_FREIGHT.card() && window.FLYDIY_FREIGHT.card().id, entry: e && !e.hidden ? e.textContent : null, tracked: window.FLYDIY_CAREER.doc().career.contracts.tracked };
    });
    check(setup.card === 'cub' && setup.tracked === 'job:field:0:0' && /^LOAD · 35 kg$/.test(setup.entry || ''), 'the career: the voucher\'s Cub on the stand, the tools job tracked, the entry "' + setup.entry + '"');
    await ev(pg, () => document.getElementById('frEntry').click());
    await sleep(3500);
    let st = await shot(pg, 'career', 'career_cub_tools', 'the career: the tracked contract\'s load (35 kg of tools, the tool chests) proposed in the Cub');
    check(st.open && st.card === 'cub' && st.placed.length === 2 && /field|tools|Tamgas|Home|HOME/i.test(st.bar), 'the view opens on the tracked job\'s two tool chests');
    await ev(pg, () => window.FREIGHT_LOAD.accept());
    await sleep(800);
    st = await shot(pg, 'career', 'career_accepted', 'Accept: the placement in the career\'s record (career.load), the plate\'s cargo is the items\'');
    const rec = await ev(pg, k => { const d = JSON.parse(localStorage.getItem(k)); const A = window.FLYDIY_FREIGHT.accepted(); return { load: d.career.load, cargo: window.FLYDIY_CAREER.cargo(), strap: A && A.items.map(i => ({ id: i.id, kg: i.kg, c: i.c })) }; }, KEY);
    index[index.length - 1].record = rec;
    check(rec.load && rec.load.slot === 'Scout' && rec.load.contract === 'job:field:0:0' && rec.load.items.length === 2 && rec.load.items.every(i => i.at) && rec.cargo === Math.round(rec.load.kg) && rec.strap.length === 2,
          'Accept: career.load saved (Scout, job:field:0:0, 2 items with their boxes, ' + (rec.load && rec.load.kg) + ' kg); the plate\'s cargo ' + rec.cargo + ' kg; freightAccepted gives FREIGHT-STRAP the centres');
    await ctx.close();
  }
  // ---- the phone, ?freight=1: tap-to-pick, tap-to-place ---------------------------------------------------------------
  if (ONLY.includes('phone')) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }), pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push('[phone] ' + String(e.message || e).slice(0, 160)));
    await pg.goto(URL0 + '&freight=1', { waitUntil: 'domcontentloaded' });
    console.log('the phone loaded in ' + (await loaded(pg)) + ' s');
    const r = await openView(pg, 'mail60p', 'c172');
    let st = await shot(pg, 'phone', 'phone', 'the phone: the same view - the C172, 60 kg of mail + a passenger; the bar at the foot, 48 px targets');
    check(r.ok && st.open && st.placed.length === 3 && /phone/.test(await ev(pg, () => document.getElementById('frLoad').className)), 'the phone: the view open on the C172, the bar in its phone layout');
    // the sack on the cabin floor, to the first free spot from the tail forward (a target the hand allows)
    const pts = await ev(pg, () => {
      const F = window.FREIGHT_LOAD, s = F.state(), card = F.card(), H = card.hold;
      const p = s.placed.slice().sort((u, v) => u.at.x0 - v.at.x0)[0];
      let tx = null;
      for (let x = H.x0 + H.n * H.dx - 0.2; x > card.cabinX1 && tx == null; x -= 0.05) if (freightLoadTarget(card, s, p.id, { x, z: 0 }).ok) tx = x;
      const ib = Math.round((tx - H.x0) / H.dx);
      return { id: p.id, was: p.at, tx, a: F.screenOf((p.at.x0 + p.at.x1) / 2, p.at.y1, (p.at.z0 + p.at.z1) / 2), b: F.screenOf(tx, H.y0 + H.floor[ib] / 100, 0) };
    });
    const onCanvas = await ev(pg, P => [P.a, P.b].map(q => { const e = document.elementFromPoint(q.x, q.y); return !!e && e.id === 'c'; }), pts);
    if (!check(onCanvas[0] && onCanvas[1], 'the phone: the item and the place to tap are both on the view, not under the bar (' + JSON.stringify([pts.a, pts.b].map(q => [Math.round(q.x), Math.round(q.y)])) + ')')) throw new Error('the phone\'s taps would land on the bar');
    await pg.touchscreen.tap(pts.a.x, pts.a.y);
    await sleep(700);
    const picked = await ev(pg, () => window.FREIGHT_LOAD.picked());
    st = await shot(pg, 'phone', 'phone_picked', 'tap: ' + pts.id + ' picked (amber), the bar says what it is and to tap where it goes');
    check(picked === pts.id, 'tap-to-pick: ' + picked);
    await pg.touchscreen.tap(pts.b.x, pts.b.y);
    await sleep(700);
    st = await shot(pg, 'phone', 'phone_placed', 'tap: the sack from the cabin floor placed at the back of the baggage bay');
    check(/\[cabin\]/.test(JSON.stringify(pts.was)) || pts.was.x0 < 1.6, 'the phone moves a sack that was on the cabin floor (' + pts.id + ' x ' + pts.was.x0 + ')');
    check(st.placed.some(l => l.startsWith(pts.id + ' ') && /\[baggage\]/.test(l)) && !(await ev(pg, () => window.FREIGHT_LOAD.picked())), 'tap-to-place: ' + pts.id + ' from the cabin floor into the baggage bay at ' + (pts.tx && pts.tx.toFixed(2)) + ' (' + st.placed.join('; ') + ')');
    await ctx.close();
  }
  await browser.close();
  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify({ what: 'FREIGHT-LOAD stills (G2345): a loaded page only (BOOT gone, #boot hidden, + 2 s)', renderer: 'SwiftShader (headless Chromium)', fails, shots: index }, null, 1) + '\n');
  console.log(fails.length ? 'freight_load_shot: ' + fails.length + ' FAIL' : 'freight_load_shot: all checks ok');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('freight_load_shot: ' + (e && e.stack || e)); process.exit(1); });
