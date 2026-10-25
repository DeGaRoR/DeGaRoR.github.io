#!/usr/bin/env node
// story_smoke.js - THE STORY'S SMOKE RUN (the GAME COORDINATOR, 22 Oct): a New career played T0 -> T7 in headed Chrome
// (master_bench.js's CDP rig), on the LIVE Pages build (default) or this tree served (--port). Before the user's test.
//   A  NEW CAREER   a fresh profile, index.html?mode=career: the boot, the opening (played through: 'played'; no clouds
//                   under it - G3588), the cabin garage at T0 - Tim's band, no card, the paint-only lock (Shape / Design
//                   disabled), no bench. G3580 (STORY-TUTOR) TIM IS THE TUTORIAL: each T0 step checked with REAL clicks
//                   (CDP mouse events, through the page's guard): a press off the step's control is held (the roll-out
//                   stays in the shed), Next on words, the paint (GARAGE_SPEC.update - the act, not the editor's widgets),
//                   the registration typed in its box (else the API), the OK -> T1; "Roll out" (G3583), N47RF (G3586)
//   B  T1           Tim's T1 steps (Next, Next), Storage held, then the real "Roll out" click: the ladder's first card;
//                   the AP's manual (FLYDIY_AP.set(false)) stops it; "Skip the flight" (FLYDIY_STORY.skip) -> ON THE FINAL
//                   at HOME (G3584: in the air, the autopilot's), the landing flown -> T2; the ending a line, no card (G3581)
//   B' T2 ARRIVAL   (G3585) Tim's "taxi or The shed" (nothing locked), the real The shed click -> the WWII hangar, Rufus
//                   on the stand; Next, Next; Storage (the only control) - the floor shows the stand's plane (G3587); the
//                   Cub's "work on" (real click) -> the Cub on the stand, Rufus out; Rufus tapped into INSIDE -> the list
//   C  T2 -> T7     DRIVEN through the story's own door (FLYDIY_STORY.event), NOT flown or built by hand: the client Cub
//                   in the hangar, its checklist met (a certified event), the delivery stop, the gift, three jobs, the
//                   water stop on floats -> a REAL route signed (career.routes, the down payment in the wallet), the
//                   three occasions on the market, the rails open
//   D  CAREERS      the page loaded again with no mode: the welcome's Continue (the story done) and Careers..., then
//                   New career -> a second career at T0 (the opening skipped with Esc), two ids in flydiy.careers
// A still per beat (--stills <dir>, OUTSIDE the repo; for A0's brief, never committed). Exceptions per beat.
// The profile is under the system temp dir (C:), deleted at the end. Run inside a slot A0 names (GPU lock: the caller).
// Usage: node tools/perf/story_smoke.js [--url <page>] [--port 8792] [--stills <dir>] [--out <json>] [--t0cost [--hold 90]]
//   (no --help: an unknown flag is ignored)
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
if (!argv.includes('--size')) process.argv.push('--size', '1600x900');
const MB = require('../master_bench.js');
const PORT = +opt('port', 0);
const stamp = new Date().toISOString().slice(5, 16).replace(/[-T:]/g, '');
const UDD = path.join(os.tmpdir(), 'ssm' + stamp);
const STILLS = opt('stills', null) ? path.resolve(opt('stills')) : null;
const OUT = path.resolve(opt('out', path.join(os.tmpdir(), 'story_smoke_' + stamp + '.json')));
const log = (...a) => console.log('[' + new Date().toISOString().slice(11, 19) + ']', ...a);
const R = { meta: { date: new Date().toISOString(), udd: UDD }, beats: [] };
let b = null, srv = null;

// one probe of the page's story state, as JSON
const PROBE = `JSON.stringify((() => { const S = window.FLYDIY_STORY, s = S && S.story ? S.story() : null; let d = null; try { d = window.FLYDIY_PLAYER.doc(); } catch (e) {}
  const el = id => { const e = document.getElementById(id); return e ? { shown: !e.hidden && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden', text: (e.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 140) } : null; };
  const tab = id => { const e = document.getElementById(id); return e ? { disabled: !!e.disabled, hidden: !!e.hidden } : null; };
  return { beat: s ? s.beat : null, open: s ? !!s.open : null, planes: s ? s.planes : null, here: d ? d.here : null,
    hereBase: d && d.sheds && d.sheds[d.here] ? d.sheds[d.here].base : null, wallet: d ? Math.round(d.wallet) : null,
    homeLocked: !!(d && d.sheds && d.sheds.HOME && d.sheds.HOME.locked), routes: d && d.career && d.career.routes ? d.career.routes.length : 0,
    fleet: d ? Object.keys(d.fleet || {}) : [], jobsOpen: S && S.jobsOpen ? S.jobsOpen() : null, mask: S && S.mask ? S.mask() : null,
    ladder: S && S.ladder ? S.ladder() : null, ap: window.FLYDIY_AP ? { manual: window.FLYDIY_AP.manual() } : null,
    tim: el('stTim'), card: el('stCard'), skip: el('stSkip'), arr: (() => { const e = document.getElementById('arrCard'); return e ? { shown: !e.hidden && e.getClientRects().length > 0, line: e.classList.contains('line'), text: (e.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 160) } : null; })(),
    tut: S && S.tutor ? S.tutor() : null, stTut: document.body.classList.contains('stTut'), roll: el('edRoll'), inGarage: !!(document.getElementById('edWrap') && !document.getElementById('edWrap').hidden),
    reg: (() => { try { const s = window.GARAGE_SPEC.get(); return s && s.meta ? s.meta.reg : null; } catch (e) { return null; } })(), stand: (() => { try { return window.GARAGE_SPEC.name(); } catch (e) { return null; } })(),
    passed: (() => { try { const st = window.BENCH_STATE(); return st ? { passed: !!st.passed, any: !!st.any } : null; } catch (e) { return null; } })(),
    storeView: (() => { try { const V = window.FLYDIY_STORE.view(); return V ? { floor: V.floor, inside: V.inside.slots, outside: V.outside.slots } : null; } catch (e) { return null; } })(),
    hsStore: el('hsStore'), shape: tab('edTabShape'), design: tab('edTabDesign'), bench: (() => { const e = document.getElementById('edBench'); return e ? { hidden: document.body.classList.contains('stNoBench') || !e.getClientRects().length } : null; })(),
    lock: window.EDITOR_LOCK && window.EDITOR_LOCK.locked ? window.EDITOR_LOCK.locked() : null,
    intro: window.FLYDIY_INTRO_LAST || null, shed: d && d.sheds ? d.sheds[d.here] : null, edLock: typeof window.EDITOR_LOCK, flood: window.CAGE_UI && window.CAGE_UI.P ? window.CAGE_UI.P.li_flood : null, benchHiddenAttr: (() => { const e = document.getElementById('tabBench'); return e ? { hidden: e.hidden, disp: getComputedStyle(e).display, inDom: document.body.contains(e) } : null; })(), careers: (() => { try { return JSON.parse(localStorage.getItem('flydiy.careers') || 'null'); } catch (e) { return null; } })() }; })())`;
const probe = async () => JSON.parse(await b.ev(PROBE, 30000));
async function still(name) {
  if (!STILLS) return null;
  const img = await b.cmd('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
  if (!(img.result && img.result.data)) return null;
  const f = path.join(STILLS, String(R.beats.length).padStart(2, '0') + '_' + name.replace(/\W+/g, '_') + '.jpg');
  fs.writeFileSync(f, Buffer.from(img.result.data, 'base64')); return f;
}
// one beat: its checks, its still, the page's exceptions since the last beat
async function beat(name, checks) {
  const P = await probe(), fails = [];
  for (const [ok, what] of checks(P)) if (!ok) fails.push(what);
  const f = await still(name), exc = b.exc.splice(0);
  R.beats.push({ name, ok: !fails.length && !exc.length, fails, exc, probe: P, still: f });
  log((fails.length || exc.length ? 'RED  ' : 'ok   ') + name + (fails.length ? ' - ' + fails.join('; ') : '') + (exc.length ? ' - exceptions: ' + exc.join(' | ').slice(0, 300) : ''));
  return P;
}
const waitFor = async (js, ms) => { const t = Date.now() + ms; while (Date.now() < t) { try { if (await b.ev(js, 10000) === true) return true; } catch (e) {} await sleep(500); } return false; };
const ev = async (o) => JSON.parse(await b.ev('JSON.stringify(window.FLYDIY_STORY.event(' + JSON.stringify(o) + '))', 30000));
// a fresh profile meets the welcome's first-visit graphics card ("Play on <preset>") before any mode, as a real first
// player does: the pre-script presses it (once per page) so the boot goes on; the menu (a returning player) is left alone
const PRE = `(function(){ var n = 0, t = setInterval(function(){ var p = document.querySelector('#welcome .wplay');
  if (p && !document.querySelector('#welcome .wmode')) { p.click(); clearInterval(t); } if (++n > 600) clearInterval(t); }, 500); })();`;
const evJs = async (js) => JSON.parse(await b.ev('JSON.stringify((() => { ' + js + ' })())', 30000));
// G3580: A REAL CLICK (CDP mouse events at the element's centre: through the page's capture-phase guard, as a player's)
async function click(sel) {
  const at = await evJs('const e = document.querySelector(' + JSON.stringify(sel) + '); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;');
  if (!at) return false;
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await b.cmd('Input.dispatchMouseEvent', { type, x: at.x, y: at.y, button: 'left', clickCount: 1 });
  await sleep(400);
  return true;
}
// (Enter carries its character: a text box commits on change, which Chrome fires only on the keypress, not the raw keyDown)
const key = async (k, code, vk) => { await b.cmd('Input.dispatchKeyEvent', Object.assign({ type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk }, k === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {})); await b.cmd('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk }); };
const waitStep = (id, ms) => waitFor('!!(window.FLYDIY_STORY && window.FLYDIY_STORY.tutor && window.FLYDIY_STORY.tutor().step === ' + JSON.stringify(id) + ')', ms || 20000);
const next = async () => { const ok = await click('#stTim [data-tim="tnext"]'); await sleep(1800); return ok; };

(async () => {
  try {
    if (STILLS) fs.mkdirSync(STILLS, { recursive: true });
    let base = opt('url', 'https://degaror.github.io/flyDiy/index.html');
    if (PORT) { if (await MB.serveRoot(PORT)) { console.error('story_smoke: port ' + PORT + ' is taken'); process.exit(4); } srv = MB.serve(PORT); await sleep(800); base = 'http://localhost:' + PORT + '/flyDiy/index.html'; }
    R.meta.base = base;
    process.env.MB_CHROME_FLAGS = ((process.env.MB_CHROME_FLAGS || '') + ' --autoplay-policy=no-user-gesture-required').trim();
    // G3585 (A0, 25 Oct): --t0cost - THE WAITING CUB'S COST in the T0 cabin garage: a New career (no opening), the garage
    // held still --hold s (no input: the fleet's bake may run), the page's long tasks and program links after the garage is
    // up, the fleet's bake stats; then the CONTROL, ?stcub=0 (the Cub only at T2), on a fresh profile. Nothing else runs
    if (argv.includes('--t0cost')) {
      const HOLD = +opt('hold', 90) * 1000;
      R.t0cost = [];
      for (const [name, q] of [['cub waiting', ''], ['control (?stcub=0)', '&stcub=0']]) {
        if (b) { await b.close(); try { fs.rmSync(UDD, { recursive: true, force: true }); } catch (e) {} }
        b = await MB.browser(UDD);
        // (the bench's recorder - long tasks, program links - without its storage writes: the pre-script from its recorder on)
        const REC = (() => { const t = MB.preScript('default'); return t.slice(t.indexOf('(function(){ if (window.__MB)')); })();
        const l0 = await b.load(base + '?mode=career&intro=0' + q, REC + ';' + PRE);
        await waitFor('!!(window.FLYDIY_STORY && window.FLYDIY_STORY.story() && window.FLYDIY_STORY.story().planes.starter && window.GARAGE_SPEC && window.GARAGE_SPEC.name())', 120000);
        const t0 = await b.ev('performance.now()');
        await sleep(HOLD);
        const t1 = await b.ev('performance.now()');
        const lt = JSON.parse(await b.ev('JSON.stringify((window.__MB.lt || []).filter(e => e[0] >= ' + t0 + '))'));
        const ln = await b.links(t0, t1);
        const fl = await evJs('const F = window.PARKED && window.PARKED.fleet; const s = window.FLYDIY_STORY.story(); return { stats: F ? F.stats : null, why: F ? F.why : null, queue: F ? F.queue.slice() : null, client: s.planes.client, beat: s.beat };');
        const ms = lt.map(e => e[1]);
        const row = { name, boot: l0.sec, hold: HOLD / 1000, longTasks: lt.length, worstMs: ms.length ? Math.max(...ms) : 0, over200: ms.filter(x => x >= 200).length, sumMs: ms.reduce((a, x) => a + x, 0), tasks: lt.slice(0, 40), links: ln, fleet: fl };
        R.t0cost.push(row);
        log('t0cost ' + name + ': boot ' + l0.sec + ' s; after the garage, ' + HOLD / 1000 + ' s still: ' + lt.length + ' long tasks, worst ' + row.worstMs + ' ms, ' + row.over200 + ' >= 200 ms; links ' + ln.n + ' (worst ' + ln.worstS + ' s); fleet ' + JSON.stringify(fl.stats) + ' client ' + fl.client);
        await still('t0cost ' + name);
      }
      const [w, c] = R.t0cost;
      R.beats.push({ name: 'T0COST the waiting Cub rides idle time', ok: w.over200 <= c.over200 && w.links.n <= c.links.n + 0, fails: [], exc: b.exc.splice(0), probe: { cub: w, control: c } });
      log((R.beats[0].ok ? 'ok   ' : 'RED  ') + 'T0COST: >= 200 ms tasks ' + w.over200 + ' vs ' + c.over200 + ', links ' + w.links.n + ' vs ' + c.links.n + ', worst ' + w.worstMs + ' vs ' + c.worstMs + ' ms');
      return;
    }
    b = await MB.browser(UDD);

    // ---- A: a New career, the opening played through, the cabin at T0
    const l = await b.load(base + '?mode=career', PRE);
    log('A boot ' + l.sec + ' s (' + l.state + ')');
    // G3588: no clouds under the opening (a still mid-way for A0's brief; the veil and the composite read)
    let introClouds = null;
    if (await waitFor('!!(window.FLYDIY_INTRO && window.FLYDIY_INTRO.state())', 120000)) {
      await sleep(9000);
      introClouds = await evJs('const C = typeof CLOUDS !== "undefined" ? CLOUDS : null, q = C && C.compositeMesh ? C.compositeMesh() : null; return C ? { veil: C.S.veil, comp: q ? q.visible : null } : { none: true };');
      await still('intro mid-way (no clouds)');
    }
    await waitFor('!!window.FLYDIY_INTRO_LAST || (!!window.FLYDIY_STORY && !document.getElementById("stIntro"))', 180000);
    await sleep(3000);
    await beat('A the opening, then the cabin at T0', P => [
      [P.intro && P.intro.how === 'played', 'the opening did not play through (' + JSON.stringify(P.intro) + ')'],
      [P.beat === 'T0', 'the story is not at T0 (' + P.beat + ')'],
      [P.hereBase && P.hereBase !== 'HOME', 'the garage is not at the cabin (' + P.hereBase + ')'],
      [P.homeLocked, 'HOME is not locked at T0'],
      [P.tim && P.tim.shown && /Tim/.test(P.tim.text), "Tim's band is not shown"],
      [!(P.card && P.card.shown), 'the beat card shows on the player page (G3357: Tim carries the beat)'],
      [+P.flood === 1, 'the cabin flood is not on at T0 (G3355 / G3357: ' + P.flood + ')'],
      [P.mask === 'finish' && P.lock, 'the paint-only lock is not on (mask ' + P.mask + ', lock ' + P.lock + ')'],
      [P.shape && P.shape.disabled, 'Shape is not disabled at T0'],
      [P.bench && P.bench.hidden, 'the bench tab shows in the small shed'],
      [P.jobsOpen === false, 'the generated jobs are not held'],
      [!introClouds || introClouds.none || (introClouds.veil === 0 && introClouds.comp !== true), 'clouds under the opening (G3588: ' + JSON.stringify(introClouds) + ')'],
      [P.tut && P.tut.beat === 'T0' && P.tut.step === 'hello' && P.stTut, "the tutor is not at T0's first step, locked (" + JSON.stringify(P.tut) + ')'],
      [P.reg === 'N47RF', "Rufus's registration is not N47RF (" + P.reg + ')'],
      [P.planes && P.planes.client && P.fleet.indexOf(P.planes.client) >= 0, "the client's Cub is not waiting at HOME yet (G3585: " + JSON.stringify(P.planes) + ')'],
      [P.roll && P.roll.text === 'Roll out', 'the roll-out button does not read just "Roll out" (' + (P.roll && P.roll.text) + ')']]);
    // the guard: the roll-out pressed off its step stays in the shed
    await click('#edRoll'); await sleep(2500);
    await beat('A2 a press off the step is held (the roll-out stays in the shed)', P => [[P.inGarage && P.tut.step === 'hello', 'the press went through (' + JSON.stringify({ g: P.inGarage, t: P.tut }) + ')']]);
    await next();
    await beat('A3 Next -> the paint step (waits, no Next)', P => [[P.tut.step === 'paint' && P.tut.lock && P.tut.lock.allow === '#edWrap', 'not at the paint step (' + JSON.stringify(P.tut) + ')'],
      [!/Next/.test(P.tim && P.tim.text || ''), 'the paint step offers a Next']]);
    await evJs('const s = window.GARAGE_SPEC.get(); window.GARAGE_SPEC.update({ paint: Object.assign({}, s.paint, { base: 0x2b5d8c, trim: 0xf2efe6 }) }); return true;');
    const painted = await waitStep('reg', 15000);
    await beat('A4 painted -> the registration step', P => [[painted, 'the paint did not move the step (' + JSON.stringify(P.tut) + ')']]);
    // the registration: typed in its box when the box is on screen (the tree's top), else the API (said)
    const box = '#edWrap [data-dec="reg"] input[type=text]';
    const typed = await evJs('const i = document.querySelector(' + JSON.stringify(box) + '); return !!(i && i.getClientRects().length);');
    if (typed) { await click(box); await evJs('const i = document.querySelector(' + JSON.stringify(box) + '); i.select(); return true;'); await b.cmd('Input.insertText', { text: 'N512TB' }); await key('Enter', 'Enter', 13); }
    else await evJs('window.GARAGE_SPEC.update({ meta: { reg: "N512TB" } }); return true;');
    const regd = await waitStep('cert', 15000);
    await beat('A5 the registration ' + (typed ? 'typed in its box' : 'set by the API (the box not on screen)') + ' -> the last words', P => [[regd, 'the registration did not move the step (' + JSON.stringify(P.tut) + ', reg ' + P.reg + ')']]);

    // ---- B: T1 - Tim's OK, his T1 steps, the real roll-out click, the ladder, manual, Skip onto the final, the landing
    await next();
    await beat("B1 the OK reads T0 -> T1 (Tim's news)", P => [[P.beat === 'T1' && P.tut.step === 'news', "not at T1's news (" + P.beat + ' ' + JSON.stringify(P.tut) + ')'],
      [P.passed && P.passed.passed, 'Rufus is not certified on the stand (BENCH_STATE ' + JSON.stringify(P.passed) + ') - its first flight would test it']]);
    await next(); await next();
    await click('#gStore'); await sleep(1500);
    await beat('B2 the roll step: Storage held, "Roll out" the way on', P => [[P.tut.step === 'roll', 'not at the roll step (' + JSON.stringify(P.tut) + ')'], [!(P.hsStore && P.hsStore.shown), 'Storage opened off its step']]);
    await click('#edRoll');
    await waitFor('!!(window.FLYDIY_STORY && window.FLYDIY_STORY.ladder && window.FLYDIY_STORY.ladder().card)', 90000);
    await sleep(2000);
    await beat("B3 T1 rolled out (the real click): the ladder's first card, nothing locked", P => [[P.ladder && P.ladder.card, 'no tutorial card on the stand (' + JSON.stringify(P.ladder) + ')'],
      [P.tim && P.tim.shown, "Tim's band is not shown"], [P.skip && P.skip.shown, '"Skip the flight" is not shown'], [!P.stTut, 'the page is locked in the air']]);
    await evJs('window.FLYDIY_AP && window.FLYDIY_AP.set(false); return true;');
    await sleep(2500);
    await beat('B4 manual taken: the ladder stops', P => [[P.ap && P.ap.manual, 'the AP did not go manual'],
      [P.ladder && (P.ladder.off || !P.ladder.card), 'the ladder still runs on manual (' + JSON.stringify(P.ladder) + ')']]);
    let r = await evJs('return window.FLYDIY_STORY.skip();');
    await sleep(3000);
    await still('on the final at HOME');
    await beat("B5 Skip the flight -> on the final at HOME (the autopilot's)", P => [[r.ok !== false && r.final, 'the skip did not go to the final: ' + JSON.stringify(r)], [P.beat === 'T1', 'T1 completed without a landing (' + P.beat + ')'], [P.ap && !P.ap.manual, 'the hand still has it'],
      [!(P.arr && P.arr.shown) && !P.inGarage, 'the flight ended at once (' + (P.arr && P.arr.text) + ')']]);
    const landed = await waitFor('!!(window.FLYDIY_STORY && window.FLYDIY_STORY.story() && window.FLYDIY_STORY.story().beat === "T2")', 300000);
    await sleep(4000);
    // G3585: the Cub stood on HOME's apron by the roll-out (FLEET_STAND's drawn set) - read, and a still for A0's brief
    const apron = await evJs('const F = window.FLEET_STAND, P = F && F.state ? F.state : null; return { plan: P && P.plan ? P.plan.stand.map(p => p.slot + "@" + p.aero) : null, placed: P && P.stats ? P.stats.placed : null };');
    await still('landed at HOME - the Cub waiting outside');
    await beat('B6 the final flown: landed at HOME -> T2; the ending a line, no card', P => [[landed && P.beat === 'T2', 'no landing at HOME within 5 min (' + P.beat + ')'], [!P.homeLocked, 'HOME is still locked'],
      [P.arr && P.arr.shown && P.arr.line, 'the ending is not a line (' + JSON.stringify(P.arr) + ')'], [P.tut && P.tut.step === 'down' && !P.stTut, 'Tim\'s "taxi or The shed" is not up, unlocked (' + JSON.stringify(P.tut) + ')'],
      [P.planes && P.planes.client, 'no client Cub bound'],
      [!apron.plan || apron.plan.some(x => x === P.planes.client + '@HOME'), "the Cub is not in HOME's drawn apron (" + JSON.stringify(apron) + ')']]);

    // ---- B': THE WWII ARRIVAL - The shed, Rufus in the new hangar, the contract, the Cub swapped in through Storage
    await click('#bHangar2');
    await waitFor('!!(window.FLYDIY_STORY.tutor().step === "hangar")', 90000);
    await sleep(3000);
    await beat("B'1 The shed -> the WWII hangar, Rufus on the stand", P => [[P.hereBase === 'HOME' && P.inGarage, 'not in the HOME garage (' + P.hereBase + ')'], [P.stand === P.planes.starter, 'Rufus is not on the stand (' + P.stand + ')'],
      [P.tut.step === 'hangar' && P.stTut, "Tim's hangar words are not up (" + JSON.stringify(P.tut) + ')']]);
    await next(); await next();
    await click('#gStore'); await sleep(2000);
    await beat("B'2 the contract, then Storage (the only control): the floor is the stand's", P => [[P.hsStore && P.hsStore.shown, 'Storage did not open'], [P.tut.step === 'swap', 'not at the swap (' + JSON.stringify(P.tut) + ')'],
      [P.storeView && P.storeView.floor === P.stand, 'the floor shows ' + (P.storeView && P.storeView.floor) + ' while ' + P.stand + ' is on the stand (G3587)'],
      [P.storeView && P.storeView.outside.indexOf(P.planes.client) >= 0, 'the Cub is not parked outside (' + JSON.stringify(P.storeView) + ')']]);
    const P0 = await probe(), cub = P0.planes.client, rufus = P0.planes.starter;
    await click('#hsStore .hsCard[data-name="' + rufus + '"] .hsFly'); await sleep(800);
    await click('#hsStore .hsCard[data-name="' + cub + '"] .hsWork');
    const swapped = await waitStep('park', 60000);
    await sleep(2000);
    await still('the Cub swapped onto the stand');
    await beat("B'3 the Cub's work on -> the Cub on the stand, Rufus out; Rufus's Fly was held", P => [[swapped && P.stand === cub, 'the Cub is not on the stand (' + P.stand + ', ' + JSON.stringify(P.tut) + ')'], [P.inGarage, 'something rolled out']]);
    await click('#hsStore .hsCard[data-name="' + rufus + '"]'); await click('#hsStore .hsCol[data-col="inside"] .hsColH');
    const parked = await waitStep('list', 20000);
    await sleep(1500);
    await beat("B'4 Rufus tapped into INSIDE -> Tim's list (the checklist)", P => [[parked, 'Rufus did not reach an inside slot (' + JSON.stringify(P.storeView) + ')'], [/client/.test(P.tim && P.tim.text || ''), "Tim's list is not up"]]);
    await next();
    await evJs('window.STORAGE_UI && window.STORAGE_UI.close(); return true;');
    await sleep(1000);
    await still('Rufus inside, the Cub on the stand');
    await beat("B'5 OK: the steps done, nothing locked", P => [[!P.stTut && !P.tut.step, 'still a step (' + JSON.stringify(P.tut) + ')']]);

    // ---- C: T2 -> T7 through the story's own door (not flown, not built by hand)
    const cert = await evJs(`const s = window.FLYDIY_STORY.story(), slot = s.planes.client; let spec = null;
      try { spec = JSON.parse(localStorage.getItem('flydiy.build.' + slot)).spec; } catch (e) {}
      if (!spec) return { ok: false, why: 'no client spec' };
      const t = JSON.parse(JSON.stringify(spec)), eng = Object.keys(POWERPLANTS).find(k => k !== t.engines[0].type);
      t.engines[0].type = eng; t.controls.flap = { type: 'plain', span: 0.4, chord: 0.25 }; t.gear.wheelR = +t.gear.wheelR * 1.3;
      t.systems = { fit: 'basic' }; t.paint = Object.assign({}, t.paint, { job: 'full', base: 0x2244aa });
      return window.FLYDIY_STORY.event({ k: 'certified', slot, spec: t, cost: 30000 });`);
    await sleep(1500);
    await beat('C1 T2 the checklist met (a certified event) -> T3', P => [[cert.ok, 'the certified event was refused: ' + cert.why], [P.beat === 'T3', 'not at T3 (' + P.beat + ')']]);
    // the stop at a role's field: the page's own pick first (storySite over MAP_PACK), then every aerodrome of that kind until
    // the story takes it - the rig must not guess wrong where the game's world lists more strips than the map (22 Oct)
    const stopAt = (role, who, extra) => evJs(`const s = window.FLYDIY_STORY.story(), slot = s.planes[${JSON.stringify(who)}];
      const L0 = (window.MAP_PACK && window.MAP_PACK.aerodromes) || [], first = storySite(${JSON.stringify(role)}, L0);
      const L = L0.concat(['w6', 'w7', 'w5', 'nv_strip', 'HOME'].concat(Array.from({ length: 30 }, (_, i) => 'w' + (i + 1))).map(id => ({ id, kind: 'strip' })), ['SEA', 'mk_sea'].map(id => ({ id, kind: 'water' })));
      const water = ${JSON.stringify(role)} === 'water', ids = [first].concat(L.filter(a => (a.kind === 'water') === water).map(a => a.id)).filter((x, i, A) => x && A.indexOf(x) === i);
      let r = { ok: false, why: 'no candidate' };
      for (const a of ids) { try { r = window.FLYDIY_STORY.event(Object.assign({ k: 'stop', slot, stop: careerStopRecord({ how: 'stopped', aero: a, slot, row: { from: 'HOME', to: a, t: 600 } }) }, ${JSON.stringify(extra || {})})); } catch (e) { r = { ok: false, why: 'not at ' + a + ' (threw: ' + e.message + ')' }; }
        if (r.ok) { r.at = a; break; } if (!/not at/.test(r.why || '')) break; }
      return r;`);
    r = await stopAt('client', 'client'); await sleep(1500);
    await beat("C2 T3 delivered at the owner's strip -> T4", P => [[r.ok, 'the delivery stop was refused: ' + r.why], [P.beat === 'T4', 'not at T4 (' + P.beat + ')']]);
    r = await ev({ k: 'ack' }); await sleep(1500);
    await beat('C3 T4 the gift -> T5', P => [[r.ok && P.beat === 'T5', 'not at T5 (' + (r.why || P.beat) + ')'], [P.planes && P.planes.gift, 'no gift plane']]);
    for (const id of ['clients.01', 'survey.01', 'resort.01']) { r = await ev({ k: 'jobDone', id }); await sleep(500); }
    await beat('C4 T5 three jobs -> T6', P => [[P.beat === 'T6', 'not at T6 (' + P.beat + ')']]);
    const w0 = (await probe()).wallet;
    r = await stopAt('water', 'gift', { gear: 'floats' }); await sleep(3000);
    await beat('C5 T6 the water stop on floats -> a route signed, T7', P => [[r.ok, 'the water stop was refused: ' + r.why], [P.beat === 'T7', 'not at T7 (' + P.beat + ')'],
      [P.routes >= 1, 'no route signed (career.routes ' + P.routes + ')'], [P.wallet > w0, 'no down payment in the wallet (' + w0 + ' -> ' + P.wallet + ')']]);
    const occ = await evJs(`try { return { n: procureMarketOf(window.FLYDIY_PLAYER.doc()).filter(L => /^occ:/.test(L.id || '')).length }; } catch (e) { return { n: -1, why: e.message }; }`);
    r = await ev({ k: 'ack' }); await sleep(1500);
    await beat('C6 T7 the occasions -> the rails open', P => [[occ.n === 3, 'the occasions on the market: ' + occ.n + (occ.why ? ' (' + occ.why + ')' : '')],
      [P.open && P.jobsOpen, 'the rails did not open (open ' + P.open + ', jobs ' + P.jobsOpen + ')']]);

    // ---- D: Careers - the welcome's menu on the same profile, Continue and a second New career
    await b.load(base + (PORT ? '?welcome=1' : ''), PRE);
    await waitFor('!!document.querySelector("#welcome .wmode, #welcome .wplay")', 120000);
    await evJs('const p = document.querySelector("#welcome .wplay"); if (p && !document.querySelector("#welcome .wmode")) p.click(); return true;');
    await waitFor('!!document.querySelector("#welcome .wmode[data-mode=continue]")', 30000);
    const menu = await evJs(`const t = k => { const e = document.querySelector('#welcome .wmode[data-mode=' + k + ']'); return e ? e.textContent.replace(/\\s+/g, ' ').trim() : null; };
      return { cont: t('continue'), car: t('career'), cars: t('careers') };`);
    await beat('D1 the welcome: Continue + Careers...', () => [[menu.cont && /story/.test(menu.cont), 'Continue is missing or names no story (' + menu.cont + ')'], [!!menu.cars, 'Careers... is missing']]);
    await evJs('document.querySelector("#welcome .wmode[data-mode=career]").click(); return true;');
    await waitFor('!!window.FLYDIY_STORY && !!document.getElementById("stIntro")', 180000);
    await sleep(4000);
    await b.cmd('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await b.cmd('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await waitFor('!document.getElementById("stIntro")', 60000);
    await sleep(3000);
    await beat('D2 a second New career at T0 (the opening skipped)', P => [[P.beat === 'T0', 'the second career is not at T0 (' + P.beat + ')'],
      [P.careers && P.careers.ids && P.careers.ids.length >= 2, 'flydiy.careers does not list two careers (' + JSON.stringify(P.careers) + ')']]);
  } catch (e) {
    log('RIG ERROR: ' + (e && e.stack || e)); R.error = String(e && e.message || e);
  } finally {
    try { if (b) await b.close(); } catch (e) {}
    try { if (srv) { srv.kill(); if (process.platform === 'win32') require('child_process').execSync('taskkill /PID ' + srv.pid + ' /T /F', { stdio: 'ignore' }); } } catch (e) {}
    try { fs.rmSync(UDD, { recursive: true, force: true }); } catch (e) {}
    const red = R.beats.filter(x => !x.ok);
    fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
    log('SMOKE ' + (R.error || red.length ? 'RED' : 'GREEN') + ': ' + (R.beats.length - red.length) + ' of ' + R.beats.length + ' beats ok' + (R.error ? ' (the rig stopped: ' + R.error + ')' : '') + ' -> ' + OUT);
    process.exit(R.error || red.length ? 1 : 0);
  }
})();
