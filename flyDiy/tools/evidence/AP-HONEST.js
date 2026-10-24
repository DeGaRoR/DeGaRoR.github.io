#!/usr/bin/env node
// AP-HONEST.js - THE AUTOPILOT SAYS WHAT IT DOES, IN A REAL BROWSER (G3560-G3569 evidence, for A0's box, Mon 26 Oct 18:00).
// The game's own page (index.html, the physics worker ON - the default), Chromium through Playwright: on A0's box the GPU
// (the stills are the look), on a cloud box --swiftshader (slow; the text twins are the record there).
//
// THE COMMAND LINES (from flyDiy/):
//   node tools/build.js
//   node tools/evidence/AP-HONEST.js                        # the default: from HOME to the first long land strip
//   node tools/evidence/AP-HONEST.js --to=w2 --rate=4       # a chosen To, the sim at 4x
//   node tools/evidence/AP-HONEST.js --natural --to=jumbo   # ALSO the user's case: the user's build (--wip=<file>) to Jumbo
//                                                           # Mine Street, no forcing - a real refusal + divert if it comes
//   [--out=reports/evidence/AP-HONEST] [--port=8131] [--size=1600x900] [--swiftshader] [--wip=<a build json>] [--headed]
//
// THE RIG (each step's stills + one JSON text twin, steps.json: FLYDIY_APWHY.log(), FLYDIY_PLAN.get(), FLYDIY_APROUTE.get(),
// the arrival card's text):
//   0 boot clean (localStorage cleared; the route pref { v: 2, base: 'HOME', to: <To> }; the autopilot on), the garage, ROLL
//     OUT, the roll-out screen, SKIP TO LINE-UP (#bSkip), Fly (#bGo) - the sim at --rate.
//   1 CLIMB: the map (#mmp) - the dashed line HOME -> To and the label "AP · <To>": shot 1_map_route.png
//   2 THE TOGGLE: FLIGHT_PROBE.setManual(true), 4 s, setManual(false) -> #apWhy "AUTOPILOT ON - flying to <To>, as planned";
//     FLYDIY_PLAN.get() before == after (the plan untouched): shots 2_toggle_why.png (the top-right rows), 2_toggle.png
//   3 A FORCED GO-AROUND (real: the pilot decides it): on FINAL, under 600 m from the field, the aeroplane is LIFTED 70 m by
//     the rig's placement door (FLIGHT_PROBE.place({ by: [0, 70, 0] }) - on the worker's sim, the velocities kept) -> the
//     pilot's own "high on the slope" / "past the aim" go-around -> #apWhy "GOING AROUND AT <To> - too high on the
//     approach" the moment it happens: shots 3_goaround_why.png, 3_goaround.png (the whole screen: nothing centred)
//   4 A FORCED DIVERT (the worker's messages altered in the page, as GATE APHONEST does in node: the worker's snapshot's
//     route ids moved to a second strip, the report given the three verdicts 43_pilot.js says when it refuses a strip -
//     strip-too-short, go-around, divert): #apWhy "DIVERTING TO <T2> - <To> is too short today: landing at 84 km/h needs
//     231 m to stop, only 180 m are left", the brief's trip line "... -> <T2> · diverted", the map's line to T2 and the
//     To it left crossed: shots 4_divert_why.png, 4_divert_map.png, 4_divert.png. Then the alteration is lifted (the
//     worker's real route comes back on the next snapshot: the page follows the worker, whatever it says).
//   5 (--natural only) the user's case, unforced: the flight flown to its end (STOPPED / the card), every #apWhy row logged
//     as it came; the arrival card shot 5_card.png - its title names where the aeroplane really went ("Arrived at" the
//     diversion's strip, never "Short of" the one it left) and a "diverted" row says from where and why.
// WHAT TO LOOK AT: the rows sit in the top right, the bar's empty third column above the map (never a card in the screen's
// centre; the story's beat card keeps the top left), the map stepped down under them, the game's
// plate (--ed-plate, the warn label, IBM Plex Sans, no italics); each appears within a frame of the pilot's decision.
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process'), net = require('net');
const ROOT = path.join(__dirname, '..', '..'), REPO = path.join(ROOT, '..');
const opt = (k, d) => { const a = process.argv.find(s => s.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const has = k => process.argv.includes('--' + k);
const OUT = path.resolve(ROOT, opt('out', 'reports/evidence/AP-HONEST'));
const [SW, SH] = opt('size', '1600x900').split('x').map(Number);
const RATE = +opt('rate', 4);
const TO = opt('to', null), NATURAL = has('natural');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require(path.join(cp.execSync('npm root -g').toString().trim(), 'playwright')); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const PORT = +opt('port', 0) || await freePort();
  const srv = cp.spawn(process.execPath, [path.join(ROOT, 'tools', '_serve.js'), String(PORT), REPO], { stdio: 'ignore' });
  process.on('exit', () => { try { srv.kill(); } catch (e) {} });
  await sleep(1200);
  const args = has('swiftshader') ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'];
  const browser = await pw.chromium.launch({ headless: !has('headed'), args: args.concat(['--js-flags=--max-old-space-size=8192']) });
  const ctx = await browser.newContext({ viewport: { width: SW, height: SH } });
  const page = await ctx.newPage();
  const errs = [], log = [], T = { t0: Date.now() };
  const el = () => Math.round((Date.now() - T.t0) / 1000) + ' s';
  const say = s => { console.log('[' + el() + '] ' + s); log.push(s); };
  page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  const WIP = opt('wip', null) ? fs.readFileSync(path.resolve(opt('wip')), 'utf8') : null;
  // the storage, once; and THE WORKER'S MESSAGES, seen by the page's tamper (step 4) before the page's own handler
  await page.addInitScript(([wip]) => {
    try {
      if (!sessionStorage.getItem('__aph')) { sessionStorage.setItem('__aph', '1'); localStorage.clear(); localStorage.setItem('flydiy.flManual', '0');
        localStorage.setItem('flydiy.flPanels', JSON.stringify({ map: true, trace: false, big: false }));   // the small map open (#mmp)
        if (wip) localStorage.setItem('flydiy.wip', wip); }
    } catch (e) {}
    const W0 = window.Worker;
    if (W0) window.Worker = class extends W0 {
      set onmessage(f) { super.onmessage = typeof f === 'function' ? (e => { const t = window.__aphTamper; if (t && e && e.data) { try { t(e.data); } catch (x) {} } return f(e); }) : f; }
      get onmessage() { return super.onmessage; }
    };
  }, [WIP]);
  const ev = async (expr, d) => { try { return await page.evaluate(expr); } catch (e) { return d === undefined ? 'ERR ' + e.message.split('\n')[0] : d; } };
  const shot = async (name, sel) => {
    try {
      const f = path.join(OUT, name + '.png');
      if (sel) { const h = await page.$(sel); if (!h) { say('  (no ' + sel + ' for ' + name + ')'); return; } await h.screenshot({ path: f, timeout: 90000 }); }
      else await page.screenshot({ path: f, timeout: 90000 });
      say('  shot ' + name + '.png');
    } catch (e) { say('  shot ' + name + ' failed: ' + e.message.split('\n')[0]); }
  };
  const state = () => ev(`JSON.stringify({ phase: FLIGHT_PROBE.ap() && FLIGHT_PROBE.ap().phase, plan: FLYDIY_PLAN.get(), route: FLYDIY_APROUTE.get(), rows: FLYDIY_APWHY.rows(), simw: !!(window.FLYDIY_SIMW && FLYDIY_SIMW.live()) })`, null).then(s => { try { return JSON.parse(s); } catch (e) { return { err: s }; } });
  const waitFor = async (expr, maxS, every) => { const t = Date.now(); while (Date.now() - t < maxS * 1000) { if ((await ev(expr, false)) === true) return true; await sleep(every || 1000); } return false; };
  const steps = {};

  // 0 boot -> the garage -> the route -> roll out -> skip -> fly
  await page.goto('http://127.0.0.1:' + PORT + '/flyDiy/index.html', { waitUntil: 'load', timeout: 300000 });
  if (!await waitFor("!!(window.BOOT && BOOT.state === 'gone' && window.FLYDIY_ROUTE && window.FLYDIY_PLAN && document.getElementById('bGo'))", 900, 2000)) { say('the garage never came up'); return end(1); }
  const pick = await ev(`(()=>{ const A = FLIGHT_PROBE.world().aerodromes, want = ${JSON.stringify(TO)};
    const long = A.filter(a => a.id && a.id !== 'HOME' && !a.water && a.surface !== 4 && a.kind !== 'water' && a.len >= 700);
    const to = want ? (A.find(a => a.id === want) || A.find(a => new RegExp(want, 'i').test(a.name || ''))) : long[0];
    const t2 = long.find(a => to && a.id !== to.id);
    return JSON.stringify({ to: to && { id: to.id, name: to.name, len: to.len }, t2: t2 && { id: t2.id, name: t2.name } }); })()`, null);
  const PK = JSON.parse(pick || '{}');
  if (!PK.to) { say('no To found for ' + TO); return end(1); }
  say('To ' + PK.to.name + ' (' + PK.to.id + ', ' + Math.round(PK.to.len) + ' m); the divert strip ' + (PK.t2 && PK.t2.name));
  await ev(`FLYDIY_PLAN.set(${JSON.stringify(PK.to.id)}, { by: 'player' })`);   // the player's pick (the picker's own door)
  await ev("document.getElementById('bGo').click()");
  if (!await waitFor("!!(document.getElementById('flPlate') && (!window.BOOT || BOOT.state === 'gone') && FLIGHT_PROBE.ap())", 900, 2000)) { say('no flight screen'); return end(1); }
  await sleep(3000);
  await ev("(()=>{ const b = document.getElementById('bSkip'); if (b && !b.disabled && !b.hidden) b.click(); return 1; })()");
  await sleep(2000);
  await ev("(()=>{ const g = document.getElementById('bGo'); if (g && g.offsetParent && !/roll out/i.test(g.textContent)) g.click(); return 1; })()");
  await ev(`TEST_FLIGHT.rate(${RATE})`);
  steps.start = await state();
  say('flying: ' + JSON.stringify({ phase: steps.start.phase, plan: steps.start.plan, simw: steps.start.simw }));

  // 1 the climb: the map's route
  if (!await waitFor("['CLIMB','CROSSWIND','ENROUTE','DOWNWIND','ROUTE'].includes(FLIGHT_PROBE.ap().phase)", 600)) say('  (no climb within 600 s)');
  await sleep(4000);
  steps.climb = await state();
  await shot('1_map_route', '#mmp');

  // 2 the toggle
  const p0 = await ev('JSON.stringify(FLYDIY_PLAN.get())', null);
  await ev('FLIGHT_PROBE.setManual(true)'); await sleep(4000); await ev('FLIGHT_PROBE.setManual(false)'); await sleep(1500);
  const p1 = await ev('JSON.stringify(FLYDIY_PLAN.get())', null);
  steps.toggle = Object.assign(await state(), { before: JSON.parse(p0), after: JSON.parse(p1), same: p0 === p1 });
  say('toggle: plan ' + (p0 === p1 ? 'UNCHANGED' : 'CHANGED ' + p0 + ' -> ' + p1) + '; rows ' + JSON.stringify(steps.toggle.rows.map(r => r.head + ' - ' + r.line)));
  await shot('2_toggle_why', '#apWhy'); await shot('2_toggle');

  if (!NATURAL) {
    // 3 a forced go-around: lifted on final
    if (await waitFor(`(()=>{ const a = FLIGHT_PROBE.ap(), c = FLIGHT_PROBE.sim().cgPos(), t = a.route && a.route.to; return a.phase === 'FINAL' && t && Math.hypot(c[0] - t.x, c[2] - t.z) < 600; })()`, 1500)) {
      await ev('TEST_FLIGHT.rate(1)');
      await ev('FLIGHT_PROBE.place({ by: [0, 70, 0] })');
      say('lifted 70 m on final');
      const ok = await waitFor("FLYDIY_APWHY.rows().some(r => r.kind === 'go-around')", 60, 250);
      steps.goaround = await state();
      say('go-around ' + (ok ? 'SAID: ' + JSON.stringify(steps.goaround.rows[0]) : 'not said in 60 s (phase ' + steps.goaround.phase + ')'));
      await shot('3_goaround_why', '#apWhy'); await shot('3_goaround');
      await ev(`TEST_FLIGHT.rate(${RATE})`);
    } else say('  (no FINAL within 1500 s - no forced go-around)');
    // 4 a forced divert (the worker's messages altered)
    if (PK.t2) {
      await ev(`(()=>{ const ap = FLIGHT_PROBE.ap(), from = ${JSON.stringify(PK.to)}, to = ${JSON.stringify(PK.t2)};
        const rep = JSON.parse(JSON.stringify(ap.report || { verdicts: [], outcome: null, landing: null, phases: [] })), t = Math.round(ap.t * 10) / 10;
        rep.verdicts.push({ t, code: 'strip-too-short', note: from.name + ': the elevator holds 23.4 m/s, the short-field stop from it needs 231 m, 180 m are left past the aim and the float - not landing there' },
                          { t, code: 'go-around', note: 'the strip is too short for 23.4 m/s (attempt 1)' },
                          { t, code: 'divert', note: 'diverting to ' + to.name + ' (900 m, 3.2 km): ' + from.name + ' is too short for the speed this aeroplane holds' });
        let sent = false;
        window.__aphTamper = m => { if (!m || m.kind !== 'snap' || !m.meta || !m.meta.ap) return; m.meta.ap.route = { from: from.id, to: to.id };
          if (!sent) { m.meta.ap.report = rep; sent = true; } };
        return 1; })()`);
      const ok = await waitFor("FLYDIY_APWHY.rows().some(r => r.kind === 'divert')", 30, 250);
      await sleep(1500);
      steps.divert = Object.assign(await state(), { trip: await ev("document.getElementById('flRouteV').textContent", null) });
      say('divert ' + (ok ? 'SAID: ' + JSON.stringify(steps.divert.rows[0]) : 'not said') + '; trip "' + steps.divert.trip + '"; route ' + JSON.stringify(steps.divert.route && steps.divert.route.to));
      await shot('4_divert_why', '#apWhy'); await shot('4_divert_map', '#mmp'); await shot('4_divert');
      await ev('window.__aphTamper = null');
    }
  } else {
    // 5 the user's case, unforced, to its end
    let n = 0;
    const tEnd = Date.now() + 1800 * 1000;
    while (Date.now() < tEnd) {
      const L = JSON.parse(await ev('JSON.stringify(FLYDIY_APWHY.log())', '[]'));
      for (; n < L.length; n++) { say('  row: ' + L[n].head + ' - ' + L[n].line); await shot('5_row_' + n, '#apWhy'); }
      if ((await ev("FLIGHT_PROBE.ap().phase === 'STOPPED' || FLIGHT_PROBE.over()", false)) === true) break;
      await sleep(1000);
    }
    await sleep(2000);
    steps.end = Object.assign(await state(), { card: await ev("(()=>{ const c = document.getElementById('arrCard'); return c && !c.hidden ? c.innerText : null; })()", null) });
    say('the end: ' + JSON.stringify({ phase: steps.end.phase, card: steps.end.card }));
    await shot('5_card');
  }
  return end(0);

  async function end(code) {
    steps.log = JSON.parse(await ev('JSON.stringify(window.FLYDIY_APWHY ? FLYDIY_APWHY.log() : null)', 'null'));
    steps.errors = errs;
    fs.writeFileSync(path.join(OUT, 'steps.json'), JSON.stringify(steps, null, 1));
    fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n') + '\n' + (errs.length ? 'page errors:\n' + errs.join('\n') + '\n' : ''));
    say('written ' + OUT + (errs.length ? ' (' + errs.length + ' page errors: ' + errs.slice(0, 3).join(' / ') + ')' : ''));
    await browser.close();
    process.exit(code);
  }
})().catch(e => { console.error(e); process.exit(1); });
