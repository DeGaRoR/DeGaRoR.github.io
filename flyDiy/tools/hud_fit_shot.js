#!/usr/bin/env node
// hud_fit_shot.js - THE TOP BAR'S BOX, MEASURED IN A REAL LAYOUT ENGINE (POLISH-2, G1090)
//
// The PFD plate (#pfd: the readings, the phase rail, the pilot's explanation) must hold ONE size whatever it says
// (the user, 2026-09-29: "the top bar with the readings keeps resizing because of the explanation text of what the
// pilot is doing. It shouldn't resize"). GATE UISMOKE holds the CSS contract in node (a stub DOM has no layout);
// this rig is the measurement behind it: dev.html's own markup and style sheets, its scripts stripped, laid out by
// headless Chromium at a desktop and a phone width, the plate's box read after every text the pilot can produce -
// every phase label, the divergence card, the hand-flown line, the longest status and plan lines, the widest
// numbers and unit labels, held and flying. It prints the distinct sizes per breakpoint (the contract: ONE), and
// with --shots=<dir> saves a picture of the plate at the longest texts.
//
//   node tools/build.js && node tools/hud_fit_shot.js [--shots=<dir>]
//   (playwright: NODE_PATH=$(npm root -g); the browser: PLAYWRIGHT_BROWSERS_PATH, or CHROMIUM=<path>)
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  try { ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); }
  catch (e2) { console.log('hud_fit_shot: no playwright here - nothing measured'); process.exit(0); }
}
const arg = k => { const a = process.argv.find(s => s.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : null; };
const SHOTS = arg('shots');

// the page's markup and sheets, no script: the plate as CSS lays it out, texts written by hand below
const html = fs.readFileSync(path.join(ROOT, 'dev.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
const tmp = path.join(ROOT, '_hud_fit_tmp.html');
fs.writeFileSync(tmp, html);

// EVERY TEXT THE PLATE CAN BE ASKED TO CARRY (app.js setRail / railStatus / railPlan / hud / nrg)
const PHASES = ['HOLDING', 'DEPART', 'TAXI', 'LINE UP', 'STOP', 'HOLD', 'TAKEOFF ROLL', 'ABORT', 'LIFT-OFF', 'PUT DOWN', 'CLIMB',
  'CROSSWIND', 'DOWNWIND', 'BASE', 'ENROUTE', 'INBOUND', 'FINAL', 'GO-AROUND', 'GLIDE', 'FLARE', 'ROLLOUT', 'STOPPED', 'AP BOX',
  'GARAGE', 'SIM DIVERGED — RESET'];
const NEXT = ['', 'by hand',
  'following the taxi route to the hold — to hold 350/0 m · speed 3.1/4.2 m/s · heading 131/131 ° ✓  [ROUTE HOLD TAXI]',
  'holding short, engine at idle, waiting for the runway to be clear and the checks to be done — run-up 1150/1200 rpm · oil 71/60 °C ✓ · mags ok/ok ✓  [HDG ALT SPD]',
  'lined up on 13, brakes on, full power, rotate at the rotation speed — ias 0/72 km/h · rpm 2380/2300 ✓ · heading 131/131 ° ✓  [RWY PITCH TOGA]',
  'climbing out on the runway heading to the crosswind turn height — agl 87.4/150 m · ias 105/100 km/h ✓ · vs +3.4/+2.5 m/s ✓  [HDG VS CLB]',
  'x'.repeat(400)];
const PLAN = ['', 'to hold 350 m', 'to downwind abeam the threshold 1.2 km · target 305 m (287 agl) · descending −12.3 m/s (limit −5.0)',
  'to the field 14.8 km · target 1250 m (1204 over the field) · climbing +12.3 m/s (limit +6.0)'];
const NUM = { ias: ['0', '245', '999'], alt: ['0', '-3', '1250', '9999', '-12'], vs: ['+0.0', '-12.3', '+12.3', '-0.4'], nrg: ['0.0', '120.5', 'EMPTY', '9.9'], netto: ['+0.0', '-12.3'] };
const LAB = { ias: ['km/h ias', 'km/h gs'], nrgU: ['L fuel', 'L fuel · 45 min', 'kWh charge · 1.2 h', 'L fuel · 1.5 h'] };

(async () => {
  const exe = process.env.CHROMIUM || undefined;
  const b = await chromium.launch(exe ? { executablePath: exe } : {});
  let bad = 0;
  for (const [name, vw, vh] of [['desktop', 1440, 900], ['phone', 400, 860]]) {
    for (const [small, placed] of [[false, false], [true, false], [false, true]]) {
      const pg = await b.newPage({ viewport: { width: vw, height: vh } });
      await pg.goto('file://' + tmp);
      await pg.evaluate(() => document.fonts && document.fonts.ready);
      await pg.evaluate(sm => {
        const bo = document.getElementById('boot'); if (bo) bo.remove(); document.body.style.background = '#5d7a8c';
        document.body.className = ''; const ui = document.getElementById('ui'); ui.hidden = false; ui.style.display = '';
        document.getElementById('pfd').classList.toggle('small', sm[0]);
        // a plate the player dragged (app.js flPlace): re-parented to #ui, absolutely placed at left/top
        if (sm[1]) { const p = document.getElementById('pfd'); p.classList.add('placed'); ui.appendChild(p); p.style.left = '30px'; p.style.top = '200px'; }
        for (const d of document.querySelectorAll('#pfdRow .rd')) d.hidden = sm[0] ? ['ias', 'alt', 'vs', 'nrg', 'pwr'].indexOf(d.dataset.i) < 0 : ['ias', 'alt', 'vs', 'nrg'].indexOf(d.dataset.i) < 0;
        const tr = document.getElementById('track'); tr.innerHTML = ''; for (let i = 0; i < 14; i++) tr.appendChild(document.createElement('i'));
      }, [small, placed]);
      const sizes = new Map();
      const read = async tag => {
        const r = await pg.evaluate(() => { const b = document.getElementById('pfd').getBoundingClientRect(); return b.width.toFixed(2) + ' x ' + b.height.toFixed(2); });
        if (!sizes.has(r)) sizes.set(r, tag);
      };
      const set = (id, t) => pg.evaluate(([id, t]) => { const e = document.getElementById(id); if (e) e.textContent = t; }, [id, t]);
      const held = on => pg.evaluate(on => document.getElementById('rail').classList.toggle('held', on), on);
      await held(true); await read('held');
      await held(false);
      for (const ph of PHASES) { await set('phName', ph); await read('phase ' + ph); }
      for (const n of NEXT) { await set('phNext', n); await read('next ' + n.slice(0, 30)); }
      for (const p of PLAN) { await set('phPlan', p); await read('plan ' + p.slice(0, 30)); }
      for (const k in NUM) for (const v of NUM[k]) { await set('r-' + k, v); await read(k + ' ' + v); }
      for (const v of LAB.ias) { await pg.evaluate(v => { document.querySelector('#pfdRow .rd[data-i=ias] i').textContent = v; }, v); await read('ias label ' + v); }
      for (const v of LAB.nrgU) { await set('r-nrgU', v); await read('nrg label ' + v); }
      // the longest of everything at once, and back to held
      await set('phName', 'SIM DIVERGED — RESET'); await set('phNext', NEXT[3]); await set('phPlan', PLAN[2]);
      await set('r-vs', '-12.3'); await set('r-alt', '9999'); await set('r-nrg', 'EMPTY'); await set('r-nrgU', 'kWh charge · 1.2 h');
      await read('all longest');
      if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await (await pg.$('#pfd')).screenshot({ path: path.join(SHOTS, 'pfd_' + name + (small ? '_small' : '') + (placed ? '_placed' : '') + '.png') }); }
      await held(true); await set('phNext', ''); await set('phPlan', ''); await read('held again');
      const list = [...sizes.entries()];
      const ok = list.length === 1;
      if (!ok) bad++;
      console.log((ok ? 'ONE SIZE ' : 'RESIZES  ') + name + (small ? ' small' : placed ? ' dragged' : ' big  ') + ' ' + vw + 'x' + vh + ': ' + list.map(([s, t]) => s + ' (first at ' + t + ')').join(' | '));
      await pg.close();
    }
  }
  await b.close();
  fs.unlinkSync(tmp);
  console.log(bad ? 'hud_fit_shot: THE PLATE RESIZES in ' + bad + ' of 6 layouts' : 'hud_fit_shot: the plate holds one size in every layout');
  process.exit(bad ? 1 : 0);
})().catch(e => { try { fs.unlinkSync(tmp); } catch (e2) {} console.error(e); process.exit(2); });
