#!/usr/bin/env node
// radialdiv_stills.js - THE RADIAL-DIVERGE EVIDENCE (G2630). Drives a page kept up by tools/live_driver.js (the build
// in its flydiy.wip) and shoots, only after the loading overlay is gone + 2 s:
//   MODE takeoff  rolled out on HOME's stand (stand), the pilot's circuit: 20 / 40 / 60 s into the taxi (taxi20/40/60,
//                 the heading logged - master's Mosquito turns on the spot), then the roll, the lift-off and the climb
//                 (roll, lift, climb) when they come (sim at 2x)
//   MODE diverge  rolled out, the pilot's circuit started; FORCE=1 forces a divergence (the worker's place door, a NaN
//                 velocity) after 3 s; 12 s later (div12), then the card's Fly and 6 s (again); the light ease and the
//                 eye logged with each shot
// Usage: node tools/perf/radialdiv_stills.js <cmdPort> <outDir> <prefix> <takeoff|diverge>   (env FORCE=1)
// A GPU run: hold boxlock.sh's gpu lock while the driver's page is up.
'use strict';
const fs = require('fs'), path = require('path');
const PORT = +process.argv[2], OUT = path.resolve(process.argv[3]), PFX = process.argv[4] || '', MODE = process.argv[5] || 'takeoff';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async (p, body) => { const r = await fetch('http://127.0.0.1:' + PORT + p, { method: 'POST', body }); return r.text(); };
const run = async body => { const t = await post('/run', body); try { return JSON.parse(t); } catch (e) { return t; } };
const until = async (cond, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await run('return !!(' + cond + ');')) === true) return true; await sleep(400); } throw new Error('timed out: ' + what); };
const frames = n => run(`await new Promise(r => { let k = ${n}; const f = () => (--k > 0 ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }); return 1;`);
const state = () => run(`const s = FLIGHT_PROBE.sim(), ap = FLIGHT_PROBE.ap(), LE = window.LIGHT_EASE || {}, c = FLIGHT_PROBE.camGet();
  const x = s.axes()[0], cg = s.cgPos();
  return { t: +(s.t || 0).toFixed(1), phase: ap && ap.phase, hdg: +(Math.atan2(-x[2], -x[0]) * 57.2958).toFixed(1), cg: cg.map(v => +(+v).toFixed(2)),
           outcome: ap && ap.report ? ap.report.outcome : null, over: FLIGHT_PROBE.over(), cT: LE.cT, hemiI: LE.hemiI, sunI: LE.sunI,
           eye: c.eye.map(v => +(+v).toFixed(1)), overlay: !!(window.BOOT && BOOT.state !== 'gone') };`);
const info = { date: new Date().toISOString(), mode: MODE, shots: [] };
async function shot(name) {
  await frames(6); await sleep(300);
  const s = await state();
  if (s && s.overlay) { console.log('  (overlay up - ' + name + ' not shot)'); return; }
  const f = path.join(OUT, PFX + name + '.png');
  await fetch('http://127.0.0.1:' + PORT + '/shot?f=' + encodeURIComponent(f));
  info.shots.push({ f: path.basename(f), state: s });
  console.log('  ' + path.basename(f) + '  ' + JSON.stringify(s));
}
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await until(`window.BOOT && BOOT.state === 'gone'`, 600000, 'the garage boot');
  await sleep(3000);
  await run(`const b = document.getElementById('bGo'); b.click(); return 1;`);
  await until(`window.BOOT && BOOT.state === 'gone' && /Fly the circuit/.test((document.getElementById('bGo') || {}).textContent || '') && window.FLIGHT_PROBE && FLIGHT_PROBE.model()`, 900000, 'the roll-out');
  await frames(60); await sleep(2000);
  await run(`try { DAY_CLOCK.set({ rate: 0 }); } catch (e) {} FLIGHT_PROBE.camMode('orbit'); return 1;`);
  const chase = (el, d) => run(`const s = FLIGHT_PROBE.sim(), x = s.axes()[0]; FLIGHT_PROBE.camSet(Math.atan2(x[2], x[0]) + 0.5, ${el}, ${d}); return 1;`);
  await chase(0.25, 14); await frames(30);
  await shot('stand');
  await run(`document.getElementById('bGo').click(); return 1;`);   // Fly the circuit
  if (MODE === 'diverge') {
    await sleep(3000); await shot('flying3');
    if (process.env.FORCE === '1') await run(`await FLIGHT_PROBE.place({ dv: [NaN, NaN, NaN] }); return 1;`);
    await sleep(12000); await chase(0.3, 16); await shot('div12');
    await run(`const b = document.getElementById('bGo'); if (b) b.click(); return 1;`);   // the card's Fly
    await sleep(6000); await chase(0.3, 16); await shot('again');
  } else {
    await run(`try { TEST_FLIGHT.rate(2); } catch (e) {} return 1;`);
    for (const t of [20, 40, 60]) { await sleep(10000); await chase(0.9, 30); await shot('taxi' + t); }
    const seen = {};
    const t0 = Date.now();
    while (Date.now() - t0 < 240000) {
      const s = await state();
      if (!s || s.over) break;
      if (s.phase === 'ROLL' && !seen.roll) { seen.roll = 1; await sleep(2500); await chase(0.15, 18); await shot('roll'); }
      if ((s.phase === 'LIFTOFF' || s.phase === 'CLIMB') && !seen.lift) { seen.lift = 1; await sleep(1500); await chase(0.12, 18); await shot('lift'); }
      if (s.phase === 'CLIMB' && seen.lift && !seen.climb) { seen.climb = 1; await sleep(5000); await chase(0.1, 25); await shot('climb'); break; }
      await sleep(500);
    }
  }
  fs.writeFileSync(path.join(OUT, PFX + 'stills.json'), JSON.stringify(info, null, 1));
  console.log('done');
})().catch(e => { console.log('FATAL ' + e.message); fs.writeFileSync(path.join(OUT, PFX + 'stills.json'), JSON.stringify(info, null, 1)); process.exit(1); });
