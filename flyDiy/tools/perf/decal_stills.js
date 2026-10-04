#!/usr/bin/env node
// decal_stills.js - THE DECALS ON THE CONTROL SURFACES, BAKE vs LIVE (HYBRID-TRIPS G1493: the user saw "decals on the flaps
// and ailerons" once G1325's band put the live aeroplane at chase distance). Drives a page kept up by tools/live_driver.js
// (hybrid_ab.js's way): roll out, hold, HUD hidden, then for each orbit view (env VIEWS 'az,el,dist;...') the SAME held frame
// drawn as the bake (FLOWN_BAKE.FB.hyForce 0) and as the live shader (1). -> <tag>_v<i>_bake.png, <tag>_v<i>_live.png, decals.json
// Usage: node tools/perf/decal_stills.js <cmdPort> <outDir> <tag>     (a GPU run: hold boxlock.sh's gpu lock)
'use strict';
const fs = require('fs'), path = require('path');
const PORT = +(process.argv[2] || 8572), OUT = path.resolve(process.argv[3] || 'decal_stills'), TAG = process.argv[4] || 'x';
const VIEWS = (process.env.VIEWS || '0.6,0.7,9;2.6,0.7,9;1.45,0.12,8').split(';').map(v => v.split(',').map(Number));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async (p, body) => { const r = await fetch('http://127.0.0.1:' + PORT + p, { method: 'POST', body }); return r.text(); };
const run = async body => { const t = await post('/run', body); try { return JSON.parse(t); } catch (e) { return t; } };
const shot = async f => { await fetch('http://127.0.0.1:' + PORT + '/shot?f=' + encodeURIComponent(f)); return f; };
const until = async (cond, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await run('return !!(' + cond + ');')) === true) return true; await sleep(500); } throw new Error('timed out: ' + what); };
const frames = n => run(`await new Promise(r => { let k = ${n}; const f = () => (--k > 0 ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }); return 1;`);
const pause = async on => { if ((await run('return !!window.FLYDIY_HELD;')) !== on) { await run(`document.getElementById('bPause').click(); return 1;`); await frames(4); } };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const info = { date: new Date().toISOString(), tag: TAG, shots: [] };
  await until(`window.BOOT && BOOT.state === 'gone'`, 600000, 'the garage boot');
  await sleep(1500);
  await run(`document.getElementById('bGo').click(); return 1;`);
  await until(`window.BOOT && BOOT.state === 'gone' && /Fly the circuit/.test((document.getElementById('bGo') || {}).textContent || '') && window.FLIGHT_PROBE && FLIGHT_PROBE.model()`, 900000, 'the roll-out');
  await frames(60); await sleep(1500);
  await pause(true);
  await run(`const c = document.getElementById('c'); document.querySelectorAll('body *').forEach(e => { if (e !== c && !e.contains(c) && e.id !== 'bPause') e.style.visibility = 'hidden'; }); return 1;`);
  await run(`FLIGHT_PROBE.camMode('orbit'); return 1;`);
  for (let i = 0; i < VIEWS.length; i++) {
    const [az, el, d] = VIEWS[i];
    await run(`FLIGHT_PROBE.camSet(${az}, ${el}, ${d}); return 1;`); await frames(15);
    for (const [k, t] of [['bake', 0], ['live', 1]]) {
      await run(`FLOWN_BAKE.FB.hyForce = ${t}; return 1;`); await frames(6); await sleep(150);
      const f = await shot(path.join(OUT, TAG + '_v' + i + '_' + k + '.png'));
      info.shots.push({ view: i, az, el, d, draw: k, file: path.basename(f) });
      console.log(TAG + ' view ' + i + ' (' + az + ', ' + el + ', ' + d + ') ' + k);
    }
  }
  await run(`FLOWN_BAKE.FB.hyForce = null; return 1;`);
  fs.writeFileSync(path.join(OUT, TAG + '_decals.json'), JSON.stringify(info, null, 1));
})().catch(e => { console.error('decal_stills: ' + (e && e.stack || e)); process.exit(1); });
