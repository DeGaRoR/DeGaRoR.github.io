#!/usr/bin/env node
// tree_crash_shots.js - THE BENT AEROPLANE ON A REAL GPU (TREE-CRASH G1470-G1479). For A0's box: the cloud's software GL
// cannot draw the game, so this was written blind against tools/lake_holes_shot.js's rig (the same boot, roll-out and
// staging) and is untested on a GPU.
//
// Headless Chromium (Playwright, --gl gpu on the box) boots the page on Jolene and rolls out. Then for each CASE it puts
// one trunk on the world's own trunk index (world.treeHits - the same set the forest's trees register on, carried to the
// physics worker by sim_link's tset op) D m ahead of the aeroplane on a flat bit of the apron's grass. It places the
// aeroplane through FLIGHT_PROBE.place (the rig's sanctioned door, under the worker too) at the case's height and speed,
// resumes, and lets the sim run until the flight ends on its own (the crash card: 'crashed') or `secs` pass. Then it
// pauses, hides the HUD and the card, and shoots the wreck from the orbit camera at a few azimuths.
//
//   node tools/_serve.js 8125 &   node tools/tree_crash_shots.js --url http://localhost:8125/flyDiy/dev.html?world=jolene \
//        --out reports/evidence/TREE-CRASH/gpu [--cases fly,wing,taxi] [--w 1280 --h 720] [--gl gpu] [--log]
//
// The cases (the trunk 0.3 m in radius, 10 m tall: a fill fir's by TREE_HITS.trunkOf):
//   fly   30 m/s at 4 m AGL into a trunk on the centreline (the nose, the cabin, the wings fold round it)
//   wing  the same, the trunk 2.5 m out on the left wing (the wing tears)
//   taxi  3 m/s on the ground, the throttle shut, into a trunk on the centreline (a dent: the nose, the prop; no crash)
// Each case writes <case>_az<deg>.jpg and <case>_damage.json (sim.damage(): the members set and broken, the reason).
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL = opt('url', 'http://localhost:8125/flyDiy/dev.html?world=jolene');
const OUT = opt('out', 'reports/evidence/TREE-CRASH/gpu');
const VW = +opt('w', 1280), VH = +opt('h', 720), Q = +opt('q', 0.88);
const CASES = {
  fly:  { V: 30, agl: 4, off: 0, D: 40, thr: 0, secs: 8 },
  wing: { V: 30, agl: 4, off: 2.5, D: 40, thr: 0, secs: 8 },
  taxi: { V: 3, agl: 0, off: 0, D: 6, thr: 0, secs: 8 },
};
const AZ = [30, 120, 210, 300];
const names = opt('cases', Object.keys(CASES).join(',')).split(',');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright')); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const KEEP = "(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click()); return 1;})()";
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const exe = opt('chrome', ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p)));
  const args = (opt('gl', 'gpu') === 'gpu' ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']).concat(['--js-flags=--max-old-space-size=8192']);
  const browser = await pw.chromium.launch({ executablePath: exe, headless: true, args });
  const page = await browser.newPage({ viewport: { width: VW, height: VH } });
  const t0 = Date.now(), el = () => Math.round((Date.now() - t0) / 1000) + ' s';
  const logs = [], LOG = argv.includes('--log');
  page.on('pageerror', e => { logs.push('pageerror: ' + e.message); if (LOG) console.log('  pageerror: ' + e.message.slice(0, 300)); });
  page.on('console', m => { if (m.type() === 'error') logs.push('error: ' + m.text().slice(0, 300)); if (LOG) console.log('  page ' + m.type() + ': ' + m.text().slice(0, 200)); });
  const tryEv = async (expr, arg) => { try { return await page.evaluate(expr, arg); } catch (e) { return 'ERR ' + e.message.split('\n')[0]; } };
  await page.goto(URL, { waitUntil: 'load', timeout: 180000 });
  for (let i = 0; i < 300; i++) {
    await sleep(2000);
    if (await tryEv("!!document.getElementById('bGo') && !document.getElementById('bGo').disabled")) break;
    await tryEv(KEEP);
  }
  console.log('garage up', el());
  await tryEv("(()=>{const b=document.getElementById('bGo'); if(b) b.click(); return !!b;})()");
  for (let i = 0; i < 600; i++) {
    await sleep(3000);
    const st = await tryEv("(()=>{ const b = window.BOOT; return (typeof FLIGHT_PROBE !== 'undefined' && FLIGHT_PROBE.sim() ? 'sim' : 'wait') + '/' + (b ? b.state : 'none'); })()");
    if (i % 10 === 0) console.log('  roll-out', el(), st);
    if (/^sim\/(gone|none)/.test(st)) break;
    await tryEv("(()=>{const b=document.getElementById('bGo'); if(b && !b.disabled && b.offsetParent) b.click(); return 1;})()");
    await tryEv(KEEP);
  }
  for (let i = 0; i < 5; i++) { await tryEv(KEEP); await sleep(2000); }
  // hand-flown, so the pilot does not taxi off with the aeroplane between the cases
  await tryEv("(() => { try { FLIGHT_PROBE.setManual(true); } catch (e) {} return 1; })()");
  const results = [];
  for (const name of names) {
    const K = CASES[name]; if (!K) { console.log('no case ' + name); continue; }
    // the stage: the aeroplane where it stands, its heading; the trunk D m on along the nose, `off` m to the left
    const set = await tryEv(([K]) => {
      const sim = FLIGHT_PROBE.sim(), W = FLIGHT_PROBE.world(), ax = sim.axes()[0];
      const hx = -ax[0], hz = -ax[2], hl = Math.hypot(hx, hz) || 1, fx = hx / hl, fz = hz / hl;
      const cg = sim.cgPos(), x = cg[0], z = cg[2], g = W.terrainH(x, z);
      const tx = x + fx * K.D - fz * K.off, tz = z + fz * K.D + fx * K.off, tg = W.terrainH(tx, tz);
      W.treeHits.set('crashshot', [tx, tz, tg, 0.3, tg + 10]);
      // the case's height (over the ground under the CG; on the ground: where it stands) and its speed along the nose
      return FLIGHT_PROBE.place({ at: [x, K.agl ? g + K.agl + 1.2 : null, z], dv: [fx * K.V, 0, fz * K.V] }).then(c => ({ trunk: [tx, tz, tg], cg: c, hdg: [fx, fz] }));
    }, [K]);
    console.log(name, JSON.stringify(set));
    // run: resumed, the throttle shut, until the card comes up (the crash, the wreck at rest) or secs
    await tryEv(([K]) => { const s = FLIGHT_PROBE.sim(); s.ctl.thr = K.thr; const b = document.getElementById('bPause'); if (b && /resume/i.test(b.textContent)) b.click(); return 1; }, [K]);
    const tEnd = Date.now() + K.secs * 1000 * 4;   // (wall time: a GPU box runs the sim at about real time)
    let over = false;
    while (Date.now() < tEnd) { await sleep(500); over = await tryEv('FLIGHT_PROBE.over()'); if (over === true) break; }
    const dmg = await tryEv(() => { const D = FLIGHT_PROBE.damage();
      return D ? { crashed: D.crashed, over: D.over, reason: D.reason, members: D.members, breaks: D.breaks, work: D.work, propStrike: D.propStrike, phase: document.getElementById('phName') && document.getElementById('phName').textContent } : null; });
    console.log('  ', over === true ? 'the flight ended' : 'no ending in ' + K.secs + ' s', JSON.stringify(dmg));
    // the stills: paused, the HUD and the card hidden, the orbit round the wreck
    await tryEv(`(() => { const b = document.getElementById('bPause'); if (b && /pause/i.test(b.textContent)) b.click();
      let css = document.getElementById('__crashcss'); if (!css) { css = document.createElement('style'); css.id = '__crashcss';
      css.textContent = '#ui, #devPanel, #hud, .hud, #toast, #boot, #arrival, .arrival, .card { display: none !important; }'; document.head.appendChild(css); }
      return 1; })()`);
    for (const az of AZ) {
      await tryEv(([az]) => { FLIGHT_PROBE.camSet(az * Math.PI / 180, 0.35, 11); return 1; }, [az]);
      await sleep(1500);
      const file = path.join(OUT, name + '_az' + az + '.jpg');
      try { await page.screenshot({ path: file, type: 'jpeg', quality: Math.round(Q * 100), timeout: 600000 }); console.log('  wrote ' + file); }
      catch (e) { console.log('  no shot: ' + e.message.split('\n')[0]); }
    }
    fs.writeFileSync(path.join(OUT, name + '_damage.json'), JSON.stringify({ case: K, set, over, dmg }, null, 1));
    results.push({ name, over, dmg });
    // the next case from a whole aeroplane: the trunk gone, the card down, the flight reset (the Restart button)
    await tryEv(`(() => { FLIGHT_PROBE.world().treeHits.drop('crashshot'); const css = document.getElementById('__crashcss'); if (css) css.remove();
      const r = [...document.querySelectorAll('button')].find(b => /restart|fly again/i.test(b.textContent || '')); if (r) r.click(); return !!r; })()`);
    await sleep(8000);
  }
  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify({ url: URL, w: VW, h: VH, results, logs: logs.slice(0, 20) }, null, 1));
  console.log('page errors: ' + logs.length + (logs.length ? '  ' + logs.slice(0, 3).join(' | ') : ''));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
