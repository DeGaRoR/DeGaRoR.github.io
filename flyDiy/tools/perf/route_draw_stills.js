#!/usr/bin/env node
// route_draw_stills.js - THE DRAWN ROUTE, ON THE BOX (G2120 ROUTE-DRAW): the drawing and its profile strip over the real
// world, then the route flown. The cloud session that built it had no GPU (tools/route_draw_shot.js shot the map plate
// alone under SwiftShader); this is A0's run on a page kept up by tools/live_driver.js (decal_stills.js's way).
//   1 draw        roll out (lined up), the drawing open with GATE ROUTE's 5-point route over Jolene, WP2 selected
//   2 hill        a point dragged onto the hill north-east of the field: the red stretch on the map and the strip
//   3 armed       the clean route, FLY THIS ROUTE before the start
//   4 climb       the start, the climb-out (the route armed on the map, dimmed join line)
//   5 route       the route flown (ROUTE, WP2 or later): the drawing open - the strip's aeroplane, the active point
//   6 planline    the drawing closed: the world, the plan line under the rail, the small map with the route's legs
//   7 end         the route's end (home: ENROUTE / the circuit), the map
// -> <outDir>/route_<n>_<name>.png and route_stills.json (each shot's phase, the plan line, the strip's status line)
// Usage: node tools/live_driver.js <repo> builds/cub_2026-09-20_corrected.json index.html 8572   (keep it up), then
//        node tools/perf/route_draw_stills.js 8572 reports/evidence/ROUTE-DRAW/box      (a GPU run: hold boxlock.sh's gpu lock)
'use strict';
const fs = require('fs'), path = require('path');
const PORT = +(process.argv[2] || 8572), OUT = path.resolve(process.argv[3] || 'route_stills');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async (p, body) => { const r = await fetch('http://127.0.0.1:' + PORT + p, { method: 'POST', body }); return r.text(); };
const run = async body => { const t = await post('/run', body); try { return JSON.parse(t); } catch (e) { return t; } };
const shotF = async f => { await fetch('http://127.0.0.1:' + PORT + '/shot?f=' + encodeURIComponent(f)); return f; };
const until = async (cond, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await run('return !!(' + cond + ');')) === true) return true; await sleep(1000); } throw new Error('timed out: ' + what); };
const frames = n => run(`await new Promise(r => { let k = ${n}; const f = () => (--k > 0 ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }); return 1;`);
const PTS = [[1500, -2500, 170], [-1500, -5500, 350], [-4000, -3000, 300], [-3500, 0, 220], [-1500, 2500, 170]];   // tools/_route_check.js ROUTE_PTS
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const info = { date: new Date().toISOString(), shots: [] };
  let n = 0;
  const shot = async name => {
    await frames(20); await sleep(400);
    const f = await shotF(path.join(OUT, 'route_' + (++n) + '_' + name + '.png'));
    const s = await run(`const a = FLIGHT_PROBE.ap(), p = document.getElementById('phPlan'), r = document.getElementById('rtStat');
      return { phase: a ? a.phase : null, leg: a ? a.legI : null, plan: p ? p.textContent : null, strip: r ? r.textContent : null, rd: ROUTE_DRAW.state() };`);
    info.shots.push(Object.assign({ file: path.basename(f), name }, s));
    console.log(n + ' ' + name + ': ' + JSON.stringify(s));
  };
  await until(`window.BOOT && BOOT.state === 'gone'`, 600000, 'the garage boot');
  await sleep(1500);
  await run(`localStorage.setItem('flydiy.flStart', 'lineup'); document.getElementById('bGo').click(); return 1;`);
  await until(`window.BOOT && BOOT.state === 'gone' && window.FLIGHT_PROBE && FLIGHT_PROBE.model() && window.ROUTE_DRAW`, 900000, 'the roll-out');
  await frames(60); await sleep(1500);
  await run(`const W = FLIGHT_PROBE.world(), h = W.aerodromes.find(a => a.id === 'HOME');
    const R = { v: 1, id: 'rbox', name: 'Tamgas loop', end: 'home', margin: 60, pts: ${JSON.stringify(PTS)}.map(p => ({ x: Math.round(h.x + p[0]), z: Math.round(h.z + p[1]), alt: p[2], ref: 'msl', V: null })) };
    ROUTE_DRAW.setOn(true); ROUTE_DRAW.load(R); ROUTE_DRAW.select(1); return 1;`);
  await shot('draw');
  await run(`const W = FLIGHT_PROBE.world(), h = W.aerodromes.find(a => a.id === 'HOME'), R = JSON.parse(JSON.stringify(ROUTE_DRAW.route()));
    R.pts.splice(1, 0, { x: Math.round(h.x + 6000), z: Math.round(h.z - 2000), alt: 400, ref: 'msl', V: null }); ROUTE_DRAW.load(R); ROUTE_DRAW.select(1); return 1;`);
  await shot('hill');
  await run(`const R = JSON.parse(JSON.stringify(ROUTE_DRAW.route())); R.pts.splice(1, 1); ROUTE_DRAW.load(R); ROUTE_DRAW.fly(); return 1;`);
  await shot('armed');
  await run(`ROUTE_DRAW.setOn(false); const g = document.getElementById('bGo'); if (g && !/roll out/i.test(g.textContent)) g.click(); return 1;`);
  await until(`FLIGHT_PROBE.ap() && FLIGHT_PROBE.ap().phase === 'CLIMB'`, 600000, 'the climb-out');
  await sleep(8000);
  await shot('climb');
  await until(`FLIGHT_PROBE.ap() && FLIGHT_PROBE.ap().phase === 'ROUTE' && FLIGHT_PROBE.ap().legI >= 1`, 900000, 'WP2');
  await run(`ROUTE_DRAW.setOn(true); return 1;`);
  await sleep(1500);
  await shot('route');
  await run(`ROUTE_DRAW.setOn(false); return 1;`);
  await sleep(1500);
  await shot('planline');
  await until(`FLIGHT_PROBE.ap() && !['ROUTE', 'CLIMB'].includes(FLIGHT_PROBE.ap().phase)`, 1200000, 'the route\'s end');
  await sleep(5000);
  await shot('end');
  fs.writeFileSync(path.join(OUT, 'route_stills.json'), JSON.stringify(info, null, 1));
  console.log('done: ' + n + ' shots in ' + OUT);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
