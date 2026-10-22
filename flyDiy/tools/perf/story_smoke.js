#!/usr/bin/env node
// story_smoke.js - THE STORY'S SMOKE RUN (the GAME COORDINATOR, 22 Oct): a New career played T0 -> T7 in headed Chrome
// (master_bench.js's CDP rig), on the LIVE Pages build (default) or this tree served (--port). Before the user's test.
//   A  NEW CAREER   a fresh profile, index.html?mode=career: the boot, the opening (played through: 'played'), the cabin
//                   garage at T0 - Tim's band, the beat card, the paint-only lock (Shape / Design disabled), no bench
//   B  T1           Rufus flown out (FLYDIY_STORE.fly: the roll-out): the tutorial ladder's first card on the stand; the
//                   AP's manual (FLYDIY_AP.set(false)) stops it; then "Skip the flight" (FLYDIY_STORY.skip) -> HOME, T2
//   C  T2 -> T7     DRIVEN through the story's own door (FLYDIY_STORY.event), NOT flown or built by hand: the client Cub
//                   in the hangar, its checklist met (a certified event), the delivery stop, the gift, three jobs, the
//                   water stop on floats -> a REAL route signed (career.routes, the down payment in the wallet), the
//                   three occasions on the market, the rails open
//   D  CAREERS      the page loaded again with no mode: the welcome's Continue (the story done) and Careers..., then
//                   New career -> a second career at T0 (the opening skipped with Esc), two ids in flydiy.careers
// A still per beat (--stills <dir>, OUTSIDE the repo; for A0's brief, never committed). Exceptions per beat.
// The profile is under the system temp dir (C:), deleted at the end. Run inside a slot A0 names (GPU lock: the caller).
// Usage: node tools/perf/story_smoke.js [--url <page>] [--port 8792] [--stills <dir>] [--out <json>]
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
    tim: el('stTim'), card: el('stCard'), skip: el('stSkip'), shape: tab('edTabShape'), design: tab('edTabDesign'), bench: (() => { const e = document.getElementById('edBench'); return e ? { hidden: document.body.classList.contains('stNoBench') || !e.getClientRects().length } : null; })(),
    lock: window.EDITOR_LOCK && window.EDITOR_LOCK.locked ? window.EDITOR_LOCK.locked() : null,
    intro: window.FLYDIY_INTRO_LAST || null, shed: d && d.sheds ? d.sheds[d.here] : null, edLock: typeof window.EDITOR_LOCK, benchHiddenAttr: (() => { const e = document.getElementById('tabBench'); return e ? { hidden: e.hidden, disp: getComputedStyle(e).display, inDom: document.body.contains(e) } : null; })(), careers: (() => { try { return JSON.parse(localStorage.getItem('flydiy.careers') || 'null'); } catch (e) { return null; } })() }; })())`;
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

(async () => {
  try {
    if (STILLS) fs.mkdirSync(STILLS, { recursive: true });
    let base = opt('url', 'https://degaror.github.io/flyDiy/index.html');
    if (PORT) { if (await MB.serveRoot(PORT)) { console.error('story_smoke: port ' + PORT + ' is taken'); process.exit(4); } srv = MB.serve(PORT); await sleep(800); base = 'http://localhost:' + PORT + '/flyDiy/index.html'; }
    R.meta.base = base;
    process.env.MB_CHROME_FLAGS = ((process.env.MB_CHROME_FLAGS || '') + ' --autoplay-policy=no-user-gesture-required').trim();
    b = await MB.browser(UDD);

    // ---- A: a New career, the opening played through, the cabin at T0
    const l = await b.load(base + '?mode=career', PRE);
    log('A boot ' + l.sec + ' s (' + l.state + ')');
    await waitFor('!!window.FLYDIY_INTRO_LAST || (!!window.FLYDIY_STORY && !document.getElementById("stIntro"))', 180000);
    await sleep(3000);
    await beat('A the opening, then the cabin at T0', P => [
      [P.intro && P.intro.how === 'played', 'the opening did not play through (' + JSON.stringify(P.intro) + ')'],
      [P.beat === 'T0', 'the story is not at T0 (' + P.beat + ')'],
      [P.hereBase && P.hereBase !== 'HOME', 'the garage is not at the cabin (' + P.hereBase + ')'],
      [P.homeLocked, 'HOME is not locked at T0'],
      [P.tim && P.tim.shown && /Tim/.test(P.tim.text), "Tim's band is not shown"],
      [P.card && P.card.shown, 'the beat card is not shown'],
      [P.mask === 'finish' && P.lock, 'the paint-only lock is not on (mask ' + P.mask + ', lock ' + P.lock + ')'],
      [P.shape && P.shape.disabled, 'Shape is not disabled at T0'],
      [P.bench && P.bench.hidden, 'the bench tab shows in the small shed'],
      [P.jobsOpen === false, 'the generated jobs are not held']]);

    // ---- B: T1 - the ack, the roll-out with the ladder's first card, manual stops it, Skip the flight
    let r = await ev({ k: 'ack' });
    await sleep(1500);
    await beat('B1 T0 read -> T1', P => [[r.ok && P.beat === 'T1', 'the ack did not move the story to T1 (' + (r.why || P.beat) + ')'],
      [P.mask !== 'finish' || true, '']]);
    const starter = (await probe()).planes.starter;
    const fly = await evJs('return window.FLYDIY_STORE && window.FLYDIY_STORE.fly ? (window.FLYDIY_STORE.fly(' + JSON.stringify(starter) + ') || { asked: true }) : { none: true };');
    await waitFor('!!(window.FLYDIY_STORY && window.FLYDIY_STORY.ladder && window.FLYDIY_STORY.ladder().card)', 90000);
    await sleep(2000);
    await beat('B2 T1 rolled out: the ladder\'s first card', P => [[!fly.none, 'FLYDIY_STORE.fly is missing'],
      [P.ladder && P.ladder.card, 'no tutorial card on the stand (' + JSON.stringify(P.ladder) + ')'],
      [P.tim && P.tim.shown, "Tim's band is not shown"], [P.skip && P.skip.shown, '"Skip the flight" is not shown']]);
    await evJs('window.FLYDIY_AP && window.FLYDIY_AP.set(false); return true;');
    await sleep(2500);
    await beat('B3 manual taken: the ladder stops', P => [[P.ap && P.ap.manual, 'the AP did not go manual'],
      [P.ladder && (P.ladder.off || !P.ladder.card), 'the ladder still runs on manual (' + JSON.stringify(P.ladder) + ')']]);
    r = await evJs('return window.FLYDIY_STORY.skip();');
    await waitFor('!!(window.FLYDIY_STORY && window.FLYDIY_STORY.story() && window.FLYDIY_STORY.story().beat === "T2")', 60000);
    await sleep(6000);
    await beat('B4 Skip the flight -> HOME, T2', P => [[r.ok !== false, 'skip refused: ' + r.why], [P.beat === 'T2', 'not at T2 (' + P.beat + ')'],
      [P.hereBase === 'HOME', 'the garage is not at HOME (' + P.hereBase + ')'], [!P.homeLocked, 'HOME is still locked'],
      [P.planes && P.planes.client, 'no client Cub bound'], [P.fleet.indexOf(P.planes && P.planes.client) >= 0, 'the client Cub is not in the fleet'],
      [!(P.shape && P.shape.disabled), 'the structure is still locked at T2']]);

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
