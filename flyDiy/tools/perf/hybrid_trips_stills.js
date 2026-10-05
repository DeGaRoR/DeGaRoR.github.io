#!/usr/bin/env node
// hybrid_trips_stills.js - THE CUB AT TAXI DISTANCE, BAKE vs LIVE (HYBRID-TRIPS G1490, the evidence of what G1325's band
// buys). Drives a page kept up by tools/live_driver.js (hybrid_ab.js's way: roll out, hold, HUD hidden, the orbit camera),
// measures the screen pixels a bake texel covers at a reference distance (FLOWN_BAKE.FB.hyMag; it goes as 1/distance), then
// stands the camera where a texel covers 1.6 px (where train 29's band 1.6-2.0 starts the live shader), MAG_TAXI px (the
// taxi chase's: master_bench's taxi read 1.08-1.12) and 1.0 px (where G1325's band 1.0-1.25 starts), and at each shoots the
// SAME held frame three ways: the bake alone (FB.hyForce 0), the live shader (1), and the rule (null: what the default band
// draws there). -> m<mag>_bake.png, m<mag>_live.png, m<mag>_rule.png, stills.json
// Usage: node tools/perf/hybrid_trips_stills.js <cmdPort> <outDir>   (env STILL='az,el' the view, MAG_TAXI=1.1)
// A GPU run: hold boxlock.sh's gpu lock while the driver's page is up.
'use strict';
const fs = require('fs'), path = require('path');
const PORT = +(process.argv[2] || 8572), OUT = path.resolve(process.argv[3] || 'hybrid_trips_stills');
const VIEW = (process.env.STILL || '1.45,0.12').split(',').map(Number), D0 = 6, MAG_TAXI = +(process.env.MAG_TAXI || 1.1);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async (p, body) => { const r = await fetch('http://127.0.0.1:' + PORT + p, { method: 'POST', body }); return r.text(); };
const run = async body => { const t = await post('/run', body); try { return JSON.parse(t); } catch (e) { return t; } };
const shot = async f => { await fetch('http://127.0.0.1:' + PORT + '/shot?f=' + encodeURIComponent(f)); return f; };
const until = async (cond, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await run('return !!(' + cond + ');')) === true) return true; await sleep(500); } throw new Error('timed out: ' + what); };
const frames = n => run(`await new Promise(r => { let k = ${n}; const f = () => (--k > 0 ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }); return 1;`);
const pause = async on => { if ((await run('return !!window.FLYDIY_HELD;')) !== on) { await run(`document.getElementById('bPause').click(); return 1;`); await frames(4); } };
const state = () => run(`const FB = FLOWN_BAKE.FB; return { t: FB.hyT, mag: FB.hyMag == null ? null : +FB.hyMag.toFixed(3), A: FB.hyA, B: FB.hyB, cam: FLIGHT_PROBE.cam() };`);
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const info = { date: new Date().toISOString(), view: VIEW, shots: [] };
  await until(`window.BOOT && BOOT.state === 'gone'`, 600000, 'the garage boot');
  await sleep(1500);
  await run(`document.getElementById('bGo').click(); return 1;`);
  await until(`window.BOOT && BOOT.state === 'gone' && /Fly the circuit/.test((document.getElementById('bGo') || {}).textContent || '') && window.FLIGHT_PROBE && FLIGHT_PROBE.model()`, 900000, 'the roll-out');
  await frames(60); await sleep(1500);
  await pause(true);
  await run(`const c = document.getElementById('c'); document.querySelectorAll('body *').forEach(e => { if (e !== c && !e.contains(c) && e.id !== 'bPause') e.style.visibility = 'hidden'; }); return 1;`);
  await run(`FLIGHT_PROBE.camMode('orbit'); FLIGHT_PROBE.camSet(${VIEW[0]}, ${VIEW[1]}, ${D0}); return 1;`);
  await frames(20); await sleep(300);
  const s0 = await state(); info.ref = { d: D0, mag: s0.mag, band: [s0.A, s0.B] };
  console.log('reference: ' + D0 + ' m -> ' + s0.mag + ' px a texel; band ' + s0.A + '-' + s0.B);
  for (const [tag, mag] of [['1.6', 1.6], ['taxi' + MAG_TAXI, MAG_TAXI], ['1.0', 1.0]]) {
    const d = D0 * s0.mag / mag;
    await run(`FLIGHT_PROBE.camSet(${VIEW[0]}, ${VIEW[1]}, ${d}); return 1;`); await frames(12);
    for (const [k, t] of [['bake', 0], ['live', 1], ['rule', null]]) {
      await run(`FLOWN_BAKE.FB.hyForce = ${t}; return 1;`); await frames(6); await sleep(150);
      const f = await shot(path.join(OUT, 'm' + tag + '_' + k + '.png'));
      const st = await state();
      info.shots.push({ at: tag, d: +d.toFixed(2), draw: k, t: st.t, mag: st.mag, file: path.basename(f) });
      console.log(tag.padEnd(8) + ' ' + d.toFixed(2) + ' m  ' + k.padEnd(4) + '  t ' + st.t + '  mag ' + st.mag);
    }
  }
  await run(`FLOWN_BAKE.FB.hyForce = null; return 1;`);
  fs.writeFileSync(path.join(OUT, 'stills.json'), JSON.stringify(info, null, 1));
  console.log('-> ' + path.join(OUT, 'stills.json'));
})().catch(e => { console.error('hybrid_trips_stills: ' + (e && e.stack || e)); process.exit(1); });
