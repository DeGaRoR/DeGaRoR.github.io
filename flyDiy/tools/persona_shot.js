#!/usr/bin/env node
// persona_shot.js - THE PILOT-PERSONA UI STILLS (G2085), headless (destto_shot.js's rig: SwiftShader, the repo served,
// the user's Cub in flydiy.wip). The page is booted twice in one profile directory (localStorage kept between them):
//   1  garage     the shed's flight setup beside ROLL OUT (#edRoute: base / to / pilot), the pilot list expanded
//                 the player picks 'student' there -> flydiy.player.pilot.profile
//      rollout    the roll-out screen's route row (#bootRoute) - the same pilot on it
//      flight     the flight plate's `pilot` slot flyout (#flFly): the style, the personality pills, a line each;
//                 then the custom pilot's knobs unfolded (a knob moved: the pilot becomes 'custom')
//      the pilot flying is read (FLIGHT_PROBE.ap().profile) - the page's own pilot is the student
//   2  reload     a fresh page on the same storage: the player's pilot is still the custom one (persisted per player)
// SwiftShader (software GL) - this is UI; --nogl hides the scene's canvases for the DOM shots.
//
//   node tools/build.js && node tools/persona_shot.js --out=reports/evidence/PILOT-PERSONA/ui [--nogl]
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const ROOT = path.join(__dirname, '..'), REPO = path.join(ROOT, '..');
const opt = (k, d) => { const a = process.argv.find(s => s.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const OUT = path.resolve(ROOT, opt('out', 'reports/evidence/PILOT-PERSONA/ui'));
const PORT = +opt('port', 8131);
let pw;
try { pw = require('playwright'); } catch (e) { pw = require(path.join(cp.execSync('npm root -g').toString().trim(), 'playwright')); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const WIP = fs.readFileSync(path.join(__dirname, 'perf', 'garage_lag_cub_wip.json'), 'utf8');
const NOGL = process.argv.includes('--nogl');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = cp.spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: REPO, stdio: 'ignore' });
  process.on('exit', () => { try { srv.kill(); } catch (e) {} });
  await sleep(1000);
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'persona_'));
  const ctx = await pw.chromium.launchPersistentContext(prof, { executablePath: exe, headless: true, viewport: { width: 1600, height: 900 },
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--max-old-space-size=8192'] });
  const notes = [];
  const t0 = Date.now(), el = () => Math.round((Date.now() - t0) / 1000) + ' s';
  let page = ctx.pages()[0] || await ctx.newPage();
  const errs = [];
  const hook = p => p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  hook(page);
  await ctx.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window), Q = [];
    window.requestAnimationFrame = cb => { if (window.__evHold) { Q.push(cb); return 0; } return raf(cb); };
    window.__evRelease = () => { window.__evHold = false; Q.splice(0).forEach(cb => raf(cb)); return 1; };
  });
  await ctx.addInitScript(wip => {
    try {
      if (localStorage.getItem('__ev')) return; localStorage.setItem('__ev', '1');
      localStorage.setItem('flydiy.wip', wip);
      localStorage.setItem('flydiy.flManual', '0');
    } catch (e) {}
  }, WIP);
  const ev = async (expr, d) => { try { return await page.evaluate(expr); } catch (e) { return d === undefined ? 'ERR ' + e.message.split('\n')[0] : d; } };
  const held = async fn => { for (let k = 0; k < 3; k++) { await ev('window.__evHold = true', 0); await sleep(3000); let done = false;
    try { await fn(); done = true; } catch (e) { console.log('  shot (try ' + (k + 1) + '): ' + e.message.split('\n')[0]); }
    await ev('window.__evRelease && window.__evRelease()', 0); if (done) return true; await sleep(5000); } return false; };
  const nogl = async on => { if (NOGL) await ev("(()=>{ for (const c of document.querySelectorAll('canvas')) c.style.visibility = " + (on ? "'hidden'" : "''") + "; document.body.style.background = " + (on ? "'#2a2622'" : "''") + "; return 1; })()", 0); };
  const playerPilot = () => ev("(()=>{ try { return JSON.stringify(JSON.parse(localStorage.getItem('flydiy.player')).pilot || null); } catch (e) { return 'none'; } })()", null);
  const garageUp = async () => {
    for (let i = 0; i < 300; i++) {
      await sleep(2000);
      await ev("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click()); return 1;})()", 0);
      const ok = (await ev("(()=>{const h=document.getElementById('edRoute'); const s=h&&h.querySelector('select.persona'); return !!(s&&h.offsetParent) && (!window.BOOT || !BOOT.state || BOOT.state === 'gone');})()", false)) === true;
      if (ok) return true;
    }
    return false;
  };
  await page.goto('http://127.0.0.1:' + PORT + '/flyDiy/index.html', { waitUntil: 'load', timeout: 240000 });
  if (!await garageUp()) { console.log('garage NOT up after ' + el() + ' ' + errs.slice(0, 3).join(' / ')); process.exit(1); }
  console.log('garage up after ' + el());
  await sleep(3000);
  notes.push('first boot: player.pilot = ' + await playerPilot() + ' (absent: the expert)');
  // GARAGE: the route row, the pilot list expanded in place
  const rowText = () => ev(`(()=>{ const h = document.getElementById('edRoute'); return JSON.stringify([...h.querySelectorAll('label')].map(l => {
    const s = l.querySelector('select'), k = l.querySelector('span'); return (k ? k.textContent : '') + ': ' + (s ? s.value + ' | ' + [...s.options].map(o => o.textContent + (o.title ? ' (' + o.title + ')' : '')).join(' | ') : l.textContent); })); })()`, null);
  notes.push('garage #edRoute: ' + await rowText());
  const pick = v => ev(`(()=>{ const s = document.querySelector('#edRoute select.persona'); s.value = ${JSON.stringify(v)}; s.onchange({ target: s }); return s.value; })()`);
  await pick('student');
  notes.push('garage: picked student -> player.pilot = ' + await playerPilot() + ', #selPersona = ' + await ev("document.getElementById('selPersona').value"));
  await ev(`(()=>{ const h = document.getElementById('edRoute'); const s = h.querySelector('select.persona'); s.size = s.options.length; s.style.height = 'auto'; s.style.position = 'relative'; s.style.zIndex = 50;
    h.style.alignItems = 'flex-start'; const acts = document.getElementById('edActs'); if (acts) acts.style.zIndex = 9999;
    let p = h; while (p && p !== document.body) { p.style.overflow = 'visible'; p = p.parentElement; } return 1; })()`);
  await sleep(500);
  const box = JSON.parse(await ev(`(()=>{ const h = document.getElementById('edActs'); const r = h.getBoundingClientRect(); let [l, t, rr, b] = [r.left, r.top, r.right, r.bottom];
    for (const s of h.querySelectorAll('select, b, button')) { const q = s.getBoundingClientRect(); l = Math.min(l, q.left); t = Math.min(t, q.top); rr = Math.max(rr, q.right); b = Math.max(b, q.bottom); }
    return JSON.stringify([l, t, rr, b]); })()`));
  const clip = { x: Math.max(0, box[0] - 12), y: Math.max(0, box[1] - 12), width: Math.min(1600, box[2] + 12) - Math.max(0, box[0] - 12), height: Math.min(900, box[3] + 12) - Math.max(0, box[1] - 12) };
  await nogl(true);
  await held(() => page.screenshot({ path: path.join(OUT, '1_garage_route_pilot.jpg'), type: 'jpeg', quality: 85, clip, timeout: 60000 }));
  await nogl(false);
  await ev(`(()=>{ const s = document.querySelector('#edRoute select.persona'); s.size = 0; s.style.height = ''; return 1; })()`);
  // ROLL OUT: the roll-out screen's route row, then the flight
  await ev("(()=>{const b=document.getElementById('edRoll'); if(b) b.click(); return !!b;})()");
  let bootShot = false, flying = false;
  for (let i = 0; i < 400 && !flying; i++) {
    await sleep(2000);
    if (!bootShot && (await ev("(()=>{const h=document.getElementById('bootRoute'); return !!(h && !h.hidden && h.offsetParent && h.querySelector('select.persona'));})()", false)) === true) {
      await sleep(1500);
      notes.push('roll-out #bootRoute pilot: ' + await ev("document.querySelector('#bootRoute select.persona').value"));
      const bh = await page.$('#bootRoute');
      if (bh) { await held(() => bh.screenshot({ path: path.join(OUT, '2_rollout_route_pilot.jpg'), type: 'jpeg', quality: 85, timeout: 60000 })); bootShot = true; console.log('  roll-out row shot ' + el()); }
    }
    flying = (await ev("(()=>!!(document.getElementById('flPlate') && document.getElementById('flPlate').offsetParent) && (!window.BOOT || !BOOT.state || BOOT.state === 'gone'))()", false)) === true;
  }
  if (!flying) { console.log('  no flight screen after ' + el()); process.exit(1); }
  await sleep(4000);
  await ev("(()=>{ const g = document.getElementById('bGo'); if (g && g.offsetParent && !/roll out/i.test(g.textContent)) g.click(); return 1; })()");
  await sleep(12000);
  notes.push('flight: the plate reads "' + await ev("document.getElementById('flPilotV').textContent") + '"; the pilot flying: ' +
             await ev("(()=>{ const a = window.FLIGHT_PROBE && FLIGHT_PROBE.ap(); return a ? a.profile + ' in ' + a.phase : null; })()"));
  // the plate's pilot slot
  await ev(`(()=>{ const b = document.querySelector('#flSlots .flSlot[data-s="pilot"]'); if (b) b.click(); return !!b; })()`);
  await sleep(2500);
  const flyText = () => ev(`(()=>{ const h = document.getElementById('flFlyBody'); return h ? h.innerText.replace(/\\n+/g, ' / ') : null; })()`, null);
  notes.push('flight #flFly (pilot): ' + await flyText());
  await nogl(true);
  let fly = await page.$('#flFly');
  if (fly) await held(() => fly.screenshot({ path: path.join(OUT, '3_flight_pilot_slot.jpg'), type: 'jpeg', quality: 85, timeout: 60000 }));
  await nogl(false);
  // the custom pilot's knobs: unfold, move one (the reaction to 0.3 s) - the pilot becomes 'custom', saved
  await ev(`(()=>{ const b = [...document.querySelectorAll('#flFlyBody .pill')].find(x => /show the knobs/i.test(x.textContent)); if (b) b.click(); return !!b; })()`);
  await sleep(1200);
  await ev(`(()=>{ const r = [...document.querySelectorAll('#flFlyBody .fr')].find(x => x.querySelector('span.k') && x.querySelector('span.k').textContent === 'reaction');
    const i = r && r.querySelector('input'); if (!i) return false; i.value = 0.3; i.oninput(); i.onchange && i.onchange(); return true; })()`);
  await sleep(1500);
  notes.push('flight: a knob moved (reaction 0.3 s) -> player.pilot = ' + await playerPilot() + '; the plate reads "' + await ev("document.getElementById('flPilotV').textContent") + '"');
  notes.push('flight #flFly (custom): ' + await flyText());
  await ev(`(()=>{ const f = document.getElementById('flFly'); f.style.maxHeight = 'none'; return 1; })()`);
  await nogl(true);
  fly = await page.$('#flFly');
  if (fly) await held(() => fly.screenshot({ path: path.join(OUT, '4_flight_custom_knobs.jpg'), type: 'jpeg', quality: 85, timeout: 60000 }));
  await nogl(false);
  // RELOAD: the same storage, a fresh page - the player's pilot is kept
  await page.goto('http://127.0.0.1:' + PORT + '/flyDiy/index.html', { waitUntil: 'load', timeout: 240000 });
  if (await garageUp()) {
    await sleep(2000);
    notes.push('reload: player.pilot = ' + await playerPilot() + '; the shed\'s pilot picker = ' + await ev("document.querySelector('#edRoute select.persona').value") +
               '; #selPersona = ' + await ev("document.getElementById('selPersona').value"));
  } else notes.push('reload: garage NOT up');
  if (errs.length) notes.push('page errors: ' + errs.join(' / '));
  fs.writeFileSync(path.join(OUT, 'ui_notes.txt'), notes.join('\n') + '\n');
  console.log(notes.join('\n'));
  console.log('done ' + el());
  await ctx.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
