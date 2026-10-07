#!/usr/bin/env node
// route_draw_shot.js - THE DRAWN ROUTE'S UI STILLS (G2120 ROUTE-DRAW), headless (destto_shot.js's rig, G1945)
//
// The built index.html served from the repo root, booted with the user's Cub in flydiy.wip, rolled out to the flight
// screen; then the drawing (route_draw.js) opened with GATE ROUTE's own 5-point route over Jolene (ROUTE_DRAW.load) and
// shot where it lives - the map plate in its draw mode, the panel under it, the profile strip:
//   draw.jpg        the drawing: the route, a point selected, the capture rings, the panel and the strip
//   draw_hill.jpg   the same route with a point dragged onto the hill north-east of the field: the red stretch on the
//                   map and on the strip, the warning, the point flagged
//   armed.jpg       FLY THIS ROUTE pressed before the start: armed
//   flying.jpg      (when the flight reaches it inside --fly=s) the route flown: the strip's aeroplane, the active point,
//                   the plan line under the rail (planline.txt beside it)
// SwiftShader (software GL) - this is UI: the world's WebGL canvas is hidden for the shots (a software readback stalls
// a screenshot past 60 s); the map and the strip are 2-D canvases and are drawn as the page draws them. The world
// behind them is A0's box's: tools/perf/route_draw_stills.js on a live_driver page.
//
//   node tools/build.js && node tools/route_draw_shot.js --out=reports/evidence/ROUTE-DRAW [--fly=900]
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..'), REPO = path.join(ROOT, '..');
const opt = (k, d) => { const a = process.argv.find(s => s.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const OUT = path.resolve(ROOT, opt('out', 'reports/evidence/ROUTE-DRAW'));
const PORT = +opt('port', 8131), FLY_S = +opt('fly', 900), ONLY_UI = process.argv.includes('--no-fly');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require(path.join(cp.execSync('npm root -g').toString().trim(), 'playwright')); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const WIP = fs.readFileSync(path.join(__dirname, 'perf', 'garage_lag_cub_wip.json'), 'utf8');
// GATE ROUTE's route (tools/_route_check.js ROUTE_PTS): offsets from HOME's centre, m MSL
const PTS = [[1500, -2500, 170], [-1500, -5500, 350], [-4000, -3000, 300], [-3500, 0, 220], [-1500, 2500, 170]];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = cp.spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: REPO, stdio: 'ignore' });
  process.on('exit', () => { try { srv.kill(); } catch (e) {} });
  await sleep(1000);
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
  const browser = await pw.chromium.launch({ executablePath: exe, headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--max-old-space-size=8192'] });
  const t0 = Date.now(), el = () => Math.round((Date.now() - t0) / 1000) + ' s';
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  const errs = [], notes = [];
  page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await page.addInitScript(wip => {
    try {
      if (sessionStorage.getItem('__ev')) return; sessionStorage.setItem('__ev', '1');
      localStorage.clear();
      localStorage.setItem('flydiy.wip', wip);
      localStorage.setItem('flydiy.route', JSON.stringify({ v: 2, base: 'HOME', to: 'CIRCUIT' }));
      localStorage.setItem('flydiy.flManual', '0');
      localStorage.setItem('flydiy.flStart', 'lineup');
    } catch (e) {}
  }, WIP);
  const ev = async (expr, d) => { try { return await page.evaluate(expr); } catch (e) { return d === undefined ? 'ERR ' + e.message.split('\n')[0] : d; } };
  const hideGL = on => ev(`(()=>{ for (const c of document.querySelectorAll('canvas')) if (c.id !== 'mm' && c.id !== 'rtProf') c.style.visibility = ${on ? "'hidden'" : "''"};
    document.body.style.background = ${on ? "'#2a2622'" : "''"}; return 1; })()`, 0);
  const shot = async (name) => {
    await hideGL(true); await sleep(800);
    const h = await page.$('#mmp');
    let ok = false;
    for (let k = 0; k < 3 && !ok; k++) { try { await h.screenshot({ path: path.join(OUT, name), type: 'jpeg', quality: 86, timeout: 60000 }); ok = true; } catch (e) { console.log('  shot ' + name + ' (try ' + (k + 1) + '): ' + e.message.split('\n')[0]); await sleep(4000); } }
    await hideGL(false);
    console.log('  ' + name + (ok ? '' : ' FAILED') + ' ' + el());
    return ok;
  };
  await page.goto('http://127.0.0.1:' + PORT + '/flyDiy/index.html', { waitUntil: 'load', timeout: 240000 });
  // the garage, then ROLL OUT to the flight screen
  let ok = false;
  for (let i = 0; i < 300 && !ok; i++) {
    await sleep(2000);
    await ev("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click()); return 1;})()", 0);
    ok = (await ev("(()=>{ const b = document.getElementById('edRoll'); return !!(b && b.offsetParent) && (!window.BOOT || !BOOT.state || BOOT.state === 'gone'); })()", false)) === true;
  }
  console.log('garage ' + (ok ? 'up' : 'NOT up') + ' after ' + el());
  if (!ok) { await browser.close(); process.exit(1); }
  await sleep(3000);
  await ev("(()=>{const b=document.getElementById('edRoll'); if(b) b.click(); return !!b;})()");
  let flying = false;
  for (let i = 0; i < 450 && !flying; i++) {
    await sleep(2000);
    flying = (await ev("(()=>!!(document.getElementById('flPlate') && document.getElementById('flPlate').offsetParent) && (!window.BOOT || !BOOT.state || BOOT.state === 'gone') && !!window.ROUTE_DRAW)()", false)) === true;
  }
  console.log('flight screen ' + (flying ? 'up' : 'NOT up') + ' after ' + el());
  if (!flying) { await browser.close(); process.exit(1); }
  await sleep(4000);
  // THE GESTURES, by real pointer input on the map's canvas: three clicks add three points, a drag moves the second,
  // a right-click deletes the third, a touch long-press (pointerType touch, held 0.8 s) deletes the first
  // (the roll-out shot may still be playing on SwiftShader: its skip takes the first click or key, by design - rollanim.js)
  await page.keyboard.press('Space'); await sleep(1500);
  await ev("(()=>{ ROUTE_DRAW.setOn(true); ROUTE_DRAW.load({ name: 'gestures', pts: [] }); return 1; })()");
  await sleep(2500);
  const mm = await page.$('#mm'), bb = await mm.boundingBox();
  const at = (fx, fy) => [bb.x + bb.width * fx, bb.y + bb.height * fy];
  const n = async () => JSON.parse(await ev('JSON.stringify(ROUTE_DRAW.state())')).n;
  const G = {};
  for (const [fx, fy] of [[0.35, 0.35], [0.6, 0.4], [0.55, 0.65]]) { const [x, y] = at(fx, fy); await page.mouse.click(x, y); await sleep(700); }
  G.added = await n();
  const p2a = await ev('JSON.stringify(ROUTE_DRAW.route().pts[1])');
  { const [x, y] = at(0.6, 0.4), [x2, y2] = at(0.7, 0.3); await page.mouse.move(x, y); await page.mouse.down(); for (let k = 1; k <= 8; k++) { await page.mouse.move(x + (x2 - x) * k / 8, y + (y2 - y) * k / 8); await sleep(60); } await page.mouse.up(); await sleep(700); }
  const p2b = await ev('JSON.stringify(ROUTE_DRAW.route().pts[1])');
  G.moved = p2a !== p2b;
  { const [x, y] = at(0.55, 0.65); await page.mouse.click(x, y, { button: 'right' }); await sleep(700); }
  G.afterRight = await n();
  G.afterLong = await ev(`(async () => { const cv = document.getElementById('mm'), r = cv.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: r.left + r.width * 0.35, clientY: r.top + r.height * 0.35, button: 0 };
    cv.dispatchEvent(new PointerEvent('pointerdown', o)); await new Promise(q => setTimeout(q, 800)); cv.dispatchEvent(new PointerEvent('pointerup', o));
    return ROUTE_DRAW.state().n; })()`, null);
  notes.push('gestures: ' + JSON.stringify(G) + ' (want added 3, moved true, afterRight 2, afterLong 1)');
  console.log('  gestures ' + JSON.stringify(G));
  // THE DRAWING: the gate's route, loaded as the library would, WP2 selected
  const st = await ev(`(()=>{ const W = FLIGHT_PROBE.world ? FLIGHT_PROBE.world() : null; const H = (W || {}).aerodromes ? W.aerodromes.find(a => a.id === 'HOME') : null;
    const h = H || { x: -301, z: 221 };
    const R = { v: 1, id: 'rshot', name: 'Tamgas loop', end: 'home', margin: 60, pts: ${JSON.stringify(PTS)}.map(p => ({ x: Math.round(h.x + p[0]), z: Math.round(h.z + p[1]), alt: p[2], ref: 'msl', V: null })) };
    ROUTE_DRAW.setOn(true); ROUTE_DRAW.load(R); ROUTE_DRAW.select(1);
    return JSON.stringify(ROUTE_DRAW.state()); })()`);
  notes.push('drawing: ' + st);
  await sleep(2500);
  await shot('draw.jpg');
  const stat = await ev("(()=>{ const s = document.getElementById('rtStat'); return s ? s.textContent : null; })()", null);
  notes.push('draw status: ' + stat);
  // a point dragged onto the hill: the red stretch, the warning
  await ev(`(()=>{ const R = ROUTE_DRAW.route(); const h = R.pts[0]; const H = { x: h.x - 1500, z: h.z + 2500 };
    const r2 = JSON.parse(JSON.stringify(R)); r2.pts.splice(1, 0, { x: Math.round(H.x + 6000), z: Math.round(H.z - 2000), alt: 400, ref: 'msl', V: null });
    ROUTE_DRAW.load(r2); ROUTE_DRAW.select(1); return 1; })()`);
  await sleep(2500);
  await shot('draw_hill.jpg');
  notes.push('hill status: ' + await ev("(()=>{ const s = document.getElementById('rtStat'); return s ? s.textContent : null; })()", null));
  // back to the clean route, FLY THIS ROUTE before the start: armed
  await ev(`(()=>{ const R = ROUTE_DRAW.route(); R.pts.splice(1, 1); ROUTE_DRAW.load(R); ROUTE_DRAW.fly(); return 1; })()`);
  await sleep(2500);
  await shot('armed.jpg');
  notes.push('armed: ' + await ev("JSON.stringify({ rd: ROUTE_DRAW.state(), drawn: FLIGHT_PROBE.ap().drawn ? FLIGHT_PROBE.ap().drawn.state : null, pref: localStorage.getItem('flydiy.routeDraw') ? 'saved' : 'none' })", null));
  if (ONLY_UI) { fs.writeFileSync(path.join(OUT, 'shots_ui.txt'), notes.join('\n') + '\n'); console.log(notes.join('\n')); await browser.close(); process.exit(0); }
  // the start: Fly; wait for the route to be flown (the solver runs in its worker; SwiftShader's frames are slow)
  await ev("(()=>{ const g = document.getElementById('bGo'); if (g && g.offsetParent && !/roll out/i.test(g.textContent)) g.click(); return 1; })()");
  let ph = null;
  const tF = Date.now();
  while (Date.now() - tF < FLY_S * 1000) {
    await sleep(5000);
    ph = await ev("(()=>{ const a = FLIGHT_PROBE.ap(); return a ? a.phase + ' ' + (a.legI | 0) : null; })()", null);
    if (ph && /^ROUTE [1-9]/.test(ph)) break;
  }
  notes.push('after ' + Math.round((Date.now() - tF) / 1000) + ' s of flight: ' + ph);
  if (ph && /^ROUTE/.test(ph)) {
    await sleep(3000);
    await shot('flying.jpg');
    const pl = await ev("(()=>{ const p = document.getElementById('phPlan'); return p ? p.textContent : null; })()", null);
    fs.writeFileSync(path.join(OUT, 'planline.txt'), (pl || '') + '\n');
    notes.push('plan line: ' + pl);
    notes.push('flying status: ' + await ev("(()=>{ const s = document.getElementById('rtStat'); return s ? s.textContent : null; })()", null));
  } else console.log('  the flight did not reach the route inside ' + FLY_S + ' s (' + ph + ') - no flying shot');
  if (errs.length) notes.push('page errors: ' + errs.join(' / '));
  fs.writeFileSync(path.join(OUT, 'shots.txt'), notes.join('\n') + '\n');
  console.log(notes.join('\n'));
  await browser.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
