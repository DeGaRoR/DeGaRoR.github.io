#!/usr/bin/env node
// wheel_ao_stills.js - THE CONTACT AO, SEEN (WHEEL-AO G2055). Drives a page kept up by tools/live_driver.js (one build) and
// shoots, each view TWICE on the same held frame - the contact layer off (CONTACT_SHADOW.S.on false) and on:
//   shed_*      the garage: the build standing in the shed (the cage), low by the mains and three-quarter;
//   stand_*     rolled out, on HOME's stand, paused: noon and golden hour (DAY_CLOCK presets, the clock frozen);
//   taxi_*      the circuit flown by the pilot, paused on the taxi (noon), a low side view;
//   lift_<h>    the take-off: paused as the mains' tyres pass h = 0 / 0.1 / 0.25 / 0.45 m over the ground (the fade).
// The page's master ('-m' run) has no S.on toggle worth reading past G1002's blob: run it with OFFON=0 for one shot a view.
// Usage: node tools/perf/wheel_ao_stills.js <cmdPort> <outDir> [prefix]    (env OFFON=0: one shot a view, as the page draws;
//        SHEDONLY=1: the shed's views only - a seaplane)
// A GPU run: hold boxlock.sh's gpu lock while the driver's page is up.
'use strict';
const fs = require('fs'), path = require('path');
const PORT = +(process.argv[2] || 8592), OUT = path.resolve(process.argv[3] || 'wheel_ao_stills'), PFX = process.argv[4] || '';
const OFFON = process.env.OFFON !== '0';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async (p, body) => { const r = await fetch('http://127.0.0.1:' + PORT + p, { method: 'POST', body }); return r.text(); };
const run = async body => { const t = await post('/run', body); try { return JSON.parse(t); } catch (e) { return t; } };
const shotF = async f => { await fetch('http://127.0.0.1:' + PORT + '/shot?f=' + encodeURIComponent(f)); return f; };
const until = async (cond, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await run('return !!(' + cond + ');')) === true) return true; await sleep(400); } throw new Error('timed out: ' + what); };
const frames = n => run(`await new Promise(r => { let k = ${n}; const f = () => (--k > 0 ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }); return 1;`);
const held = () => run('return !!window.FLYDIY_HELD;');
const pause = async on => { if ((await held()) !== on) { await run(`document.getElementById('bPause').click(); return 1;`); await frames(4); } };
const hideUI = () => run(`if (!document.getElementById('waoHide')) { const s = document.createElement('style'); s.id = 'waoHide';
  s.textContent = 'body > *:not(canvas):not(#c):not(:has(canvas)) { visibility: hidden !important; }'; document.head.appendChild(s); }
  const c = document.getElementById('c'); document.querySelectorAll('body *').forEach(e => { if (e !== c && !e.contains(c) && e.tagName !== 'CANVAS') e.style.visibility = 'hidden'; }); return 1;`);
// the mains' tyres over the ground (m) and the blobs' strength, read off the page
const wheelsH = () => run(`const s = FLIGHT_PROBE.sim(), d = FLIGHT_PROBE.def(), w = FLIGHT_PROBE.world(); if (!s || !d || !w) return null;
  const R = d.refs, out = []; for (const i of R.mains) out.push(+(s.p[i*3+1] - (d.nodes[i].r || 0.1) - w.terrainH(s.p[i*3], s.p[i*3+2])).toFixed(3));
  return out;`);
const blobs = () => run(`const s = FLIGHT_PROBE.sim(), d = FLIGHT_PROBE.def(), w = FLIGHT_PROBE.world(); if (!s || !d || !w) return null;
  const xa = s.axes()[0]; return CONTACT_SHADOW.blobsFor(s, d, w, { axis: [xa[0], xa[2]] }).map(b => b.kind[0] + ' a' + b.a.toFixed(2) + ' c' + (b.core || 0).toFixed(2) + ' ' + b.len.toFixed(2) + 'x' + b.wid.toFixed(2));`);
// a view about the aeroplane: deg 0 = off its right wing, + toward the nose; el rad; d m
const view = (deg, el, d) => run(`const s = FLIGHT_PROBE.sim(), a = s.axes(), x = a[0], r = a[2], t = ${deg} * Math.PI / 180;
  const dx = r[0] * Math.cos(t) - x[0] * Math.sin(t), dz = r[2] * Math.cos(t) - x[2] * Math.sin(t);
  FLIGHT_PROBE.camSet(Math.atan2(dz, dx), ${el}, ${d}); return 1;`);
const info = { date: new Date().toISOString(), shots: [] };
async function both(name, note) {
  for (const on of OFFON ? [false, true] : [null]) {
    if (on !== null) await run(`CONTACT_SHADOW.S.on = ${on}; return 1;`);
    await frames(8); await sleep(250);
    const f = path.join(OUT, PFX + name + (on === null ? '' : on ? '_on' : '_off') + '.png');
    await shotF(f);
    info.shots.push({ f: path.basename(f), note: note || null });
    console.log('  ' + path.basename(f) + (note ? '  ' + JSON.stringify(note) : ''));
  }
  if (OFFON) await run(`CONTACT_SHADOW.S.on = true; return 1;`);
}
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await until(`window.BOOT && BOOT.state === 'gone'`, 600000, 'the garage boot');
  await sleep(3000); await frames(30);
  await run(`try { DAY_CLOCK.set({ rate: 0 }); } catch (e) {} return 1;`);
  await hideUI();
  // THE SHED: low by the mains, then three-quarter (the garage orbit takes az / el / dist about the build)
  for (const [n, az, el, d] of [['shed_low', 0.35, 0.02, 4.2], ['shed_3q', 2.4, 0.22, 7.5]]) {
    await run(`FLIGHT_PROBE.camSet(${az}, ${el}, ${d}); return 1;`); await frames(20);
    await both(n);
  }
  // SHEDONLY=1 (a seaplane: in the shed it stands on its keels; on the water no contact is drawn): stop here
  if (process.env.SHEDONLY === '1') { await run(`FLIGHT_PROBE.camSet(1.2, 0.05, 5.5); return 1;`); await frames(20); await both('shed_side');
    fs.writeFileSync(path.join(OUT, PFX + 'stills.json'), JSON.stringify(info, null, 1)); return; }
  // ROLL OUT (the first visible Roll-out / bGo button: one press)
  await run(`const b = document.getElementById('bGo'); b.style.visibility = ''; b.click(); return 1;`);
  await until(`window.BOOT && BOOT.state === 'gone' && /Fly the circuit/.test((document.getElementById('bGo') || {}).textContent || '') && window.FLIGHT_PROBE && FLIGHT_PROBE.model()`, 900000, 'the roll-out');
  await frames(90); await sleep(2000);
  await pause(true); await hideUI();
  await run(`FLIGHT_PROBE.camMode('orbit'); return 1;`);
  for (const t of ['noon', 'golden']) {
    await run(`DAY_CLOCK.preset('${t}'); DAY_CLOCK.set({ rate: 0 }); return 1;`); await frames(40); await sleep(800);
    await view(15, 0.10, 7.0); await frames(20); await both('stand_' + t + '_side', await wheelsH());
    await view(-35, 0.22, 10); await frames(20); await both('stand_' + t + '_3q', await blobs());
  }
  // THE TAXI: the pilot flies the circuit; paused 14 s into it (off the stand, on the apron / taxiway)
  await run(`DAY_CLOCK.preset('golden'); DAY_CLOCK.set({ rate: 0 }); return 1;`);
  await pause(false);
  await run(`const b = document.getElementById('bGo'); b.click(); return 1;`);
  await sleep(14000);
  await pause(true); await hideUI();
  await frames(30); await sleep(500);
  await view(20, 0.08, 7.5); await frames(20); await both('taxi_golden_side', await wheelsH());
  await view(-150, 0.16, 9); await frames(20); await both('taxi_golden_rear', await blobs());
  await run(`DAY_CLOCK.preset('noon'); DAY_CLOCK.set({ rate: 0 }); return 1;`); await frames(40); await sleep(500);
  await view(20, 0.08, 7.5); await frames(20); await both('taxi_noon_side');
  // SKIP TO LINE-UP (the taxi to the runway is minutes long): the pilot then takes off from the hold
  await pause(false);
  await run(`const b = document.getElementById('bSkip'); if (b && !b.disabled) b.click(); return 1;`);
  await sleep(1500);
  await until(`window.BOOT && BOOT.state === 'gone'`, 300000, 'the line-up');
  // THE LIFT-OFF: a page-side watcher pauses the instant the mains' lowest tyre passes each height (the camera held
  // to a low side view through the roll)
  await view(25, 0.06, 9);
  for (const h of [0.0, 0.10, 0.25, 0.45]) {
    await run(`window.__waoH = ${h}; window.__waoHit = false; return 1;`);
    await run(`const s = FLIGHT_PROBE.sim, d = FLIGHT_PROBE.def, w = FLIGHT_PROBE.world;
      const tick = () => { if (window.__waoHit) return; const S = s(), D = d(), W = w();
        if (S && D && W && !window.FLYDIY_HELD) { let lo = Infinity, v = Math.hypot(S.cgVel()[0], S.cgVel()[2]);
          for (const i of D.refs.mains) lo = Math.min(lo, S.p[i*3+1] - (D.nodes[i].r || 0.1) - W.terrainH(S.p[i*3], S.p[i*3+2]));
          if (v > 12 && (window.__waoH === 0 ? lo > 0.002 : lo >= window.__waoH)) {
            window.__waoHit = true; document.getElementById('bPause').click(); return; } }
        requestAnimationFrame(tick); };
      requestAnimationFrame(tick); return 1;`);
    await pause(false);
    await until(`window.__waoHit`, 240000, 'the lift-off at ' + h + ' m');
    await frames(4); await hideUI();
    await view(25, 0.06, 9); await frames(12);
    await both('lift_' + String(h).replace('.', 'p'), await wheelsH());
  }
  fs.writeFileSync(path.join(OUT, PFX + 'stills.json'), JSON.stringify(info, null, 1));
  console.log('-> ' + path.join(OUT, PFX + 'stills.json'));
})().catch(e => { console.error('wheel_ao_stills: ' + (e && e.stack || e)); process.exit(1); });
