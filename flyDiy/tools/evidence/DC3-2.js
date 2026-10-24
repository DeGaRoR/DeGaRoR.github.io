#!/usr/bin/env node
// DC3-2.js - THE DC-3 ON THE PAGE (G3570-G3579, DC3-2 evidence, for A0 on the box). Headless Chromium (Playwright; the GPU
// on A0's box, SwiftShader on a cloud one - slow there, and the cloud session that wrote this could not render the game
// world: it is UNTESTED ON A SCREEN). It serves the repo (tools/_serve.js), opens dev.html?damage=1, DROPS the fixture on
// the garage as the user drops a file (garage.js DROP-JSON -> the load door), and:
//   1 THE GARAGE (G3570, the cabin floor height): three stills (quarter, side, side with SEE INSIDE on) and the numbers
//     behind them, read off the crew layer that drew them (window.CAGE_CREW): the floor under each seat, each occupant's
//     lowest and highest point, the pilot's eye against the windscreen's base. A row per occupant:
//       ROW occupant <i>: feet <y> over the floor <y> (<+cm>) - OK | BURIED
//     the user's complaint was "pilots and passengers are buried": every body's lowest point at or over the floor;
//   2 A PAGE TAXI (G3571, the user's run 1: "while TAXIING ... crashed: a tail member broke"): the roll-out, the pilot's
//     own taxi out for --taxi-s, then THE HAND (the takeover key, A) for 40 s on the keys a player uses - throttle up
//     (PageUp), S-turns on the pedals (Comma / Period), a firm stop on the brakes (B) - with the damage layer on;
//     the verdict: FLIGHT_PROBE.damage() (crashed? why?), the peak strain the trace reads;
//   3 A FIRM LANDING (G3572, the user's run 2: "dropped at 4.6 m/s ... the fuselage broke"): the skip to line-up, the
//     pilot's whole circuit and its landing (~5 min of sim), every touchdown's sink as the PFD's vertical speed reads it
//     and the damage after; then THE DROP on the stand: the aeroplane lifted and let fall at 3.05 m/s (10 ft/s, FAR
//     25.473's limit sink) and at 4.6 m/s (the user's) through the page's own placement door (FLIGHT_PROBE.place).
//
//   node tools/evidence/DC3-2.js [--file tools/fixtures/dc3_2026-10.json] [--out reports/evidence/DC3-2]
//        [--parts garage,taxi,land] [--taxi-s 30] [--size 1600x900] [--url <a running page>] [--headed]
// Prints DC32 {...} (one JSON summary line), the ROW lines and the PNG paths; exits 1 when an occupant is buried, the
// taxi crashed, or the 3.05 m/s drop broke anything.
'use strict';
const path = require('path');
const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const REPO = path.resolve(__dirname, '..', '..', '..');
const FD = path.join(REPO, 'flyDiy');
const FILE = path.resolve(FD, opt('file', 'tools/fixtures/dc3_2026-10.json'));
const OUT = path.resolve(FD, opt('out', 'reports/evidence/DC3-2'));
const PARTS = opt('parts', 'garage,taxi,land').split(',');
const [SW, SH] = opt('size', '1600x900').split('x').map(Number);
const TAXI_S = +opt('taxi-s', 30);
const sleep = ms => new Promise(r => setTimeout(r, ms));
function findPlaywright() { for (const p of ['playwright', '/opt/node-tools/node_modules/playwright', 'playwright-core']) { try { return require(p); } catch (e) {} } throw new Error('no playwright'); }
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let srv = null, url = opt('url', null);
  if (!url) {
    const port = await freePort();
    srv = spawn(process.execPath, [path.join(FD, 'tools', '_serve.js'), String(port), REPO], { stdio: 'ignore' });
    await sleep(800);
    url = 'http://127.0.0.1:' + port + '/flyDiy/dev.html?damage=1';
  }
  const { chromium } = findPlaywright();
  const browser = await chromium.launch({ headless: !argv.includes('--headed'), args: ['--use-angle=default', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: SW, height: SH } });
  page.on('pageerror', e => console.error('page exception: ' + String(e && e.message || e).split('\n')[0]));
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const shot = async name => { const f = path.join(OUT, name + '.png'); await page.screenshot({ path: f }); console.log('DC3-2: wrote ' + path.relative(REPO, f)); return f; };
  const S = { file: path.relative(REPO, FILE), url, parts: PARTS, fails: [] };
  const fail = why => { S.fails.push(why); console.log('FAIL ' + why); };
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 180000 });
    let up = false;
    for (let i = 0; i < 180 && !up; i++) { await sleep(1000); up = await ev(() => !!(document.getElementById('gLoad') && window.CAGE_UI && window.CAGE_ENERGY && window.FLIGHT_PROBE)); }
    if (!up) throw new Error('the garage never came up');
    await sleep(3000);
    // THE DROP: the file onto the window, as the user drops one (garage.js DROP-JSON)
    const txt = fs.readFileSync(FILE, 'utf8');
    await ev(([t, n]) => { const dt = new DataTransfer(); dt.items.add(new File([t], n, { type: 'application/json' }));
      window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); return 1; }, [txt, path.basename(FILE)]);
    await sleep(20000);
    await ev(() => { [...document.querySelectorAll('button,a,div')].filter(b => /keep the current build/i.test(b.textContent || '') && b.children.length === 0).forEach(x => x.click()); return 1; });
    await sleep(4000);
    S.loaded = await ev(() => { const s = window.GARAGE_SPEC && window.GARAGE_SPEC.get ? window.GARAGE_SPEC.get() : null;
      return s ? { name: s.meta && s.meta.name, span: s.wings && s.wings[0].span, floorUp: s.cabin && s.cabin.floorUp, cageFloorUp: s.cage && s.cage.floorUp } : null; });
    console.log('DC3-2: loaded ' + JSON.stringify(S.loaded));
    if (!S.loaded || !(S.loaded.span > 25)) fail('the DC-3 did not load (' + JSON.stringify(S.loaded) + ')');

    if (PARTS.includes('garage')) {
      // ---- 1. THE GARAGE: the floor and who stands on it --------------------------------------------------------------
      S.garage = await ev(() => {
        const CC = window.CAGE_CREW, A = CC && CC.A; if (!A) return { err: 'no crew layer' };
        const T = window.THREE, sc = window.FLIGHT_PROBE.hangarScene ? window.FLIGHT_PROBE.hangarScene() : null;
        // the occupants: every live dummy's skinned meshes, measured in the crew group's own frame (the floor's)
        // (each dummy hangs in the crew layer's group, whose frame is the anchors' - floorAt's - frame)
        const out = []; let grpFound = false;
        (CC.live || []).forEach((d, i) => {
          const root = d.root || d.obj || d; const b = new T.Box3();
          const par = root && root.parent; if (par) { par.updateMatrixWorld(true); grpFound = true; }
          const inv = par ? new T.Matrix4().copy(par.matrixWorld).invert() : null;
          if (root && root.traverse) root.traverse(o => { if (o.isMesh && o.geometry) { const bb = new T.Box3().setFromObject(o); if (inv) bb.applyMatrix4(inv); b.union(bb); } });
          const z = (b.min.z + b.max.z) / 2;
          out.push({ i, lo: +b.min.y.toFixed(3), hi: +b.max.y.toFixed(3), z: +z.toFixed(2), floor: +A.floorAt(z).toFixed(3) });
        });
        return { k: A.k, dashTop: A.dashTop, waist: A.waistY, roof: A.roofY, eye: window.FLYDIY_EYE || null, seats: CC.seats, occ: out, grpFound };
      });
      for (const o of (S.garage.occ || [])) {
        const d = o.lo - o.floor, ok = d > -0.02;
        console.log('ROW occupant ' + o.i + ': feet ' + o.lo + ' over the floor ' + o.floor + ' (' + (d * 100).toFixed(1) + ' cm) - ' + (ok ? 'OK' : 'BURIED') + '; head ' + o.hi);
        if (!ok) fail('occupant ' + o.i + ' buried ' + (d * 100).toFixed(1) + ' cm under the floor');
      }
      if (!(S.garage.occ && S.garage.occ.length)) console.log('ROW occupants: none measured (' + JSON.stringify(S.garage).slice(0, 300) + ') - read the stills');
      await ev(() => { const e = document.getElementById('edWrap'); if (e) e.style.visibility = 'hidden'; return 1; });
      const cam = async (a, e, d) => { await ev(([a1, e1, d1]) => (window.FLIGHT_PROBE.camSet(a1, e1, d1), 1), [a, e, d]); await sleep(2500); };
      await cam(0.85, 0.22, 30); await shot('garage_quarter');
      await cam(Math.PI / 2, 0.05, 28); await shot('garage_side');
      await ev(() => { const c = document.getElementById('xray'); if (c && !c.checked) c.click(); return 1; });
      await cam(Math.PI / 2, 0.08, 14); await shot('garage_side_inside');
      await ev(() => { const c = document.getElementById('xray'); if (c && c.checked) c.click(); const e = document.getElementById('edWrap'); if (e) e.style.visibility = ''; return 1; });
    }

    const rollOut = async () => {
      for (let a = 0; a < 10; a++) {
        await ev(() => { [...document.querySelectorAll('button')].filter(b => /roll out/i.test(b.textContent)).forEach(x => x.click()); });
        await sleep(8000);
        if (await ev(() => !!(window.FLIGHT_PROBE.ap && window.FLIGHT_PROBE.ap() && window.FLIGHT_PROBE.ap().phase))) return true;
      }
      return false;
    };
    const dmg = () => ev(() => { const d = window.FLIGHT_PROBE.damage(); return d ? { crashed: !!d.crashed, reason: d.reason || null, breaks: d.breaks, yields: d.yields } : null; });

    if (PARTS.includes('taxi')) {
      // ---- 2. A PAGE TAXI: the pilot out of the stand, then the hand --------------------------------------------------
      if (!(await rollOut())) fail('the roll-out never happened');
      await sleep(TAXI_S * 1000);
      const key = async (k, ms) => { await page.keyboard.down(k); await sleep(ms); await page.keyboard.up(k); };
      await page.keyboard.press('KeyA');                         // the takeover: the hand has it
      await sleep(500);
      let peak = 0;
      const t0 = Date.now();
      for (let s = 0; (Date.now() - t0) < 40000; s++) {
        await key('PageUp', 250);                                // a little more throttle
        await key(s % 2 ? 'Comma' : 'Period', 1800);             // the pedals, one way then the other
        if (s % 4 === 3) { await key('PageDown', 600); await key('KeyB', 1500); }   // off the power, a firm stop
        peak = Math.max(peak, await ev(() => { const s1 = window.FLIGHT_PROBE.sim(); return s1 && s1.stats ? s1.stats().smax : 0; }));
        const d = await dmg(); if (d && d.crashed) break;
      }
      await shot('taxi_end');
      S.taxi = { damage: await dmg(), peakStrainPct: +(peak * 100).toFixed(1), phase: await ev(() => window.FLIGHT_PROBE.ap().phase) };
      console.log('DC3-2: taxi ' + JSON.stringify(S.taxi));
      if (S.taxi.damage && S.taxi.damage.crashed) fail('the page taxi crashed: ' + S.taxi.damage.reason);
    }

    if (PARTS.includes('land')) {
      // ---- 3a. THE CIRCUIT AND ITS LANDING (the skip to line-up, the pilot's own) --------------------------------------
      await ev(() => { [...document.querySelectorAll('button')].filter(b => /restart|reset/i.test(b.textContent)).slice(0, 1).forEach(x => x.click()); });
      await sleep(5000);
      await ev(() => { [...document.querySelectorAll('button')].filter(b => /line.?up/i.test(b.textContent)).slice(0, 1).forEach(x => x.click()); });
      const tds = []; let was = false, ph = null, t0 = Date.now();
      while (Date.now() - t0 < 900000) {
        await sleep(250);
        const r = await ev(() => { const s1 = window.FLIGHT_PROBE.sim(), ap = window.FLIGHT_PROBE.ap(); if (!s1) return null;
          const v = s1.cgVel(); return { ph: ap && ap.phase, onG: s1.wheelsOnGround(), vy: v[1], agl: window.FLIGHT_PROBE.agl ? window.FLIGHT_PROBE.agl() : null }; });
        if (!r) continue; ph = r.ph;
        if (r.onG === 0 && r.agl > 3) was = true;
        if (r.onG > 0 && was) { tds.push(+(-r.vy).toFixed(2)); was = false; }
        const d = await dmg(); if (d && d.crashed) break;
        if (ph === 'STOPPED') break;
      }
      await shot('landing_end');
      S.circuit = { touchdownSinks: tds, phase: ph, damage: await dmg() };
      console.log('DC3-2: circuit ' + JSON.stringify(S.circuit));
      // ---- 3b. THE DROP ON THE STAND: 3.05 m/s (FAR 25.473), then 4.6 m/s ---------------------------------------------
      S.drops = [];
      for (const sink of [3.05, 4.6]) {
        await ev(() => { [...document.querySelectorAll('button')].filter(b => /restart|reset/i.test(b.textContent)).slice(0, 1).forEach(x => x.click()); });
        await sleep(8000);
        await ev(sk => window.FLIGHT_PROBE.place({ by: [0, 0.6, 0], dv: [0, -sk, 0] }), sink);
        await sleep(6000);
        const d = await dmg();
        S.drops.push({ sink, damage: d });
        console.log('DC3-2: drop ' + sink + ' m/s ' + JSON.stringify(d));
        if (sink < 4 && d && (d.crashed || d.breaks > 0)) fail('the 3.05 m/s drop broke the airframe: ' + JSON.stringify(d));
      }
    }
  } catch (e) { fail(e.message); }
  console.log('DC32 ' + JSON.stringify(S));
  await browser.close();
  if (srv) srv.kill();
  process.exit(S.fails.length ? 1 : 0);
})();
