#!/usr/bin/env node
// look_shots.js - THE USER'S LOOK, ONE BUILD ON ONE TREE (C4b, 2026-09-30): two held frames for a side-by-side with
// another tree - the close chase on the fuselage's side (the orbit, CHASE: az, el, dist) and the cockpit out over the cowl
// and the wing (the head turned, COCKPIT: yaw rad, pitch deg). Drives a page kept up by tools/live_driver.js; rolls the
// build out, holds the flight (the pause), hides the HUD. Writes <out>/<tag>_chase.png, <tag>_cockpit.png and
// <out>/<tag>.json (the hybrid's t and pixels a texel where the page has it).
// Usage: node tools/look_shots.js <cmdPort> <outDir> <tag>
'use strict';
const fs = require('fs'), path = require('path');
const PORT = +(process.argv[2] || 8572), OUT = path.resolve(process.argv[3] || 'look'), TAG = process.argv[4] || 'x';
const CHASE = (process.env.CHASE || '1.45,0.08,3.6').split(',').map(Number), CK = (process.env.COCKPIT || '0.62,-9').split(',').map(Number);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async (p, body) => { const r = await fetch('http://127.0.0.1:' + PORT + p, { method: 'POST', body }); return r.text(); };
const run = async body => { const t = await post('/run', body); try { return JSON.parse(t); } catch (e) { return t; } };
const shot = async f => { await fetch('http://127.0.0.1:' + PORT + '/shot?f=' + encodeURIComponent(f)); return f; };
const until = async (cond, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await run('return !!(' + cond + ');')) === true) return true; await sleep(500); } throw new Error('timed out: ' + what); };
const frames = n => run(`await new Promise(r => { let k = ${n}; const f = () => (--k > 0 ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }); return 1;`);
const state = () => run(`const FB = window.FLOWN_BAKE && FLOWN_BAKE.FB; return FB ? { hybrid: !!FB.hybrid, t: FB.hyT, tEye: FB.hyTEye, tIn: FB.hyTIn, mag: FB.hyMag } : null;`);
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const info = { tag: TAG, date: new Date().toISOString() };
  await until(`window.BOOT && BOOT.state === 'gone'`, 600000, 'the garage boot');
  await sleep(1500);
  await run(`document.getElementById('bGo').click(); return 1;`);
  await until(`window.BOOT && BOOT.state === 'gone' && /Fly the circuit/.test((document.getElementById('bGo') || {}).textContent || '') && window.FLIGHT_PROBE && FLIGHT_PROBE.model()`, 900000, 'the roll-out');
  await frames(60); await sleep(1500);
  if (!(await run('return !!window.FLYDIY_HELD;'))) { await run(`document.getElementById('bPause').click(); return 1;`); await frames(4); }
  await run(`const c = document.getElementById('c'); document.querySelectorAll('body *').forEach(e => { if (e !== c && !e.contains(c) && e.id !== 'bPause') e.style.visibility = 'hidden'; }); return 1;`);
  await run(`FLIGHT_PROBE.camMode('orbit'); FLIGHT_PROBE.camSet(${CHASE[0]}, ${CHASE[1]}, ${CHASE[2]}); return 1;`);
  await frames(40); await sleep(400);
  info.chase = await state();
  await shot(path.join(OUT, TAG + '_chase.png'));
  await run(`FLIGHT_PROBE.camMode('cockpit'); HEAD_CAM.yaw = ${CK[0]}; HEAD_CAM.pitch = ${CK[1] * Math.PI / 180}; return 1;`);
  await frames(40); await sleep(400);
  info.cockpit = await state();
  await shot(path.join(OUT, TAG + '_cockpit.png'));
  fs.writeFileSync(path.join(OUT, TAG + '.json'), JSON.stringify(info, null, 1));
  console.log(TAG + ' ' + JSON.stringify(info));
})().catch(e => { console.error('look_shots: ' + (e && e.stack || e)); process.exit(1); });
