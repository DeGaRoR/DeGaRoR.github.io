#!/usr/bin/env node
// avionics_pfd_stills.js - THE PFD AND THE MFD ON A REAL PAGE, BY DAY AND AT NIGHT, AND WHAT THEY COST (AVIONICS-PFD-LAND,
// 7 Nov; G2813-G2815 landed in FINISH-4 with no page evidence: "a GPU-backed page canvas should be well under that,
// still to be measured on A0's GPU")
//
// avionics_stills.js's contract (a page kept up by tools/live_driver.js: POST /run, GET /shot). It fits a GPS on the
// build on the stand (the Instruments column's own state, through GARAGE_SPEC), times the roll-out (#bGo to BOOT gone
// and the cockpit model), and in the flight shoots the panel from the pilot's head and reads:
//   00_shed_panel         the dash in the shed (the units in standby, their power buttons out)
//   01_stand_panel        the flight on the stand: the PFD (and a pair's MFD) live
//   02_stand_mfd          the head turned to the MFD (a pair only)
//   03_svt_off            the PFD's first key: the synthetic vision off (then back on)
//   04_climb_panel        climbing out (the build's own pilot): the synthetic vision's ground, the tapes moving
//   05_climb_mfd          the MFD in the climb (a pair only): the map, the engine strip
//   06_dusk_panel, 07_night_panel, 08_night_mfd
// and, on the stand, the frame interval over 8 s with the units on, then with their power buttons off (same page, same
// seconds, alternated twice), plus the PFD's own paint time (FLYDIY_GPS.tick wrapped: a call that painted).
// Writes <out>/<NN_state>.png and <out>/pfd_page.json.
//
// Usage (the GPU lock held - tools/perf/boxlock.sh take gpu <WHO> "UNTIMED ... ends by HH:MM"):
//   node tools/live_driver.js <repo root> "flyDiy/bugReports/cessnaMetal (1).json" dev.html 8573
//   node tools/avionics_pfd_stills.js 8573 <outDir> [flatPair|flat|glass|none] [pilot|copilot]
// `none` takes the GPS off the build: the roll-out with nothing fitted, for the A/B against a fitted unit.
'use strict';
const fs = require('fs'), path = require('path');
const PORT = +(process.argv[2] || 8573), OUT = path.resolve(process.argv[3] || 'avionics_pfd_stills');
const KIND = process.argv[4] || 'flatPair', SIDE = process.argv[5] && process.argv[5] !== '-' ? process.argv[5] : null;
const QUICK = process.env.QUICK === '1';   // the roll-out and the on / off cost only (the A/B passes)
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async (p, body) => { const r = await fetch('http://127.0.0.1:' + PORT + p, { method: 'POST', body }); return r.text(); };
const run = async body => { const t = await post('/run', body); try { return JSON.parse(t); } catch (e) { return t; } };
const shot = async f => { await fetch('http://127.0.0.1:' + PORT + '/shot?f=' + encodeURIComponent(f)); return f; };
const until = async (cond, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await run('return !!(' + cond + ');')) === true) return true; await sleep(500); } throw new Error('timed out: ' + what); };
const frames = n => run(`await new Promise(r => { let k = ${n}; const f = () => (--k > 0 ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }); return 1;`);
const READ = `const CK = window.FLYDIY_COCKPIT_I, G = window.FLYDIY_GPS; const u = i => { if (!G) return null; const S = G.state(i);
    return { kind: S.kind, page: S.page, on: S.on, svt: S.svt, terr: S.terr, paints: S.paints, uploads: S.uploads,
      W: S.cv ? S.cv.width : null, glow: S.mat ? +S.mat.emissiveIntensity.toFixed(3) : null }; };
  const out = { gpsFit: !!(CK && CK.gpsFit), gpsOn: !!(CK && CK.gpsOn), pair: !!(CK && CK.gpsPair), units: G ? G.units() : 0,
    u0: u(0), u1: G && G.units() > 1 ? u(1) : null, sw: CK ? { sw_gps: CK.sw.sw_gps, sw_gps2: CK.sw.sw_gps2 } : null,
    hour: window.DAY_CLOCK && DAY_CLOCK.now ? String(DAY_CLOCK.now().utc || DAY_CLOCK.now().date || "") : null,
    massModel: window.FLYDIY_MASS_MODEL != null ? +(+window.FLYDIY_MASS_MODEL).toFixed(3) : null,
    cgModel: window.FLYDIY_CG_MODEL ? window.FLYDIY_CG_MODEL.map(v => +(+v).toFixed(5)) : null,
    ledger: (() => { try { const L = FLIGHT_PROBE.def().parts.ledger || {}; let e = 0; const o = {}; for (const k in L) { if (!L[k].payload) e += L[k].mass; if (/sys|avion|panel|elec|instr/i.test(k)) o[k] = +L[k].mass.toFixed(3); } o.empty = +e.toFixed(3); return o; } catch (x) { return null; } })(),
    dg: CK && CK.readings ? +(+CK.readings.hdg).toFixed(1) : null,
    pfdHdg: window.FLIGHT_PROBE && FLIGHT_PROBE.sim && FLIGHT_PROBE.sim() ? +((FLIGHT_PROBE.sim().out.hdg * 57.29578 + 450) % 360).toFixed(1) : null,
    agl: window.FLIGHT_PROBE && FLIGHT_PROBE.agl ? +(FLIGHT_PROBE.agl() || 0).toFixed(1) : null };
  if (G) G.state(0); return out;`;
// the frame interval for ms (rAF deltas), and the GPS tick's own time on the calls that painted
const MEASURE = ms => `const G = window.FLYDIY_GPS || { tick: () => false }, t0 = G.tick, paint = [], all = [];
  G.tick = function (dt, CK) { const a = performance.now(); const p = t0.call(G, dt, CK); const d = performance.now() - a; all.push(d); if (p) paint.push(d); return p; };
  const dts = []; let last = performance.now();
  await new Promise(r => { const end = last + ${ms}; const f = () => { const n = performance.now(); dts.push(n - last); last = n; if (n < end) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); });
  G.tick = t0;
  const q = (a, p) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2); };
  return { frames: dts.length, med: q(dts, 0.5), p90: q(dts, 0.9), p99: q(dts, 0.99), over50: dts.filter(d => d > 50).length, over1s: dts.filter(d => d > 1000).length,
    tickMed: q(all, 0.5), paints: paint.length, paintMed: q(paint, 0.5), paintP90: q(paint, 0.9), paintMax: q(paint, 1) };`;
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const info = { kind: KIND, side: SIDE, date: new Date().toISOString(), states: {}, cost: [] };
  await until(`window.BOOT && BOOT.state === 'gone'`, 600000, 'the garage boot');
  await sleep(1500);
  info.fit = await run(`const CP = window.CAGE_PANEL; if (!CP || !CP.state) return 'no panel layer (open the editor once)';
    const SY = CP.state(); if (SY.fit !== 'custom') { const R = CP.resolve(); SY.fit = 'custom'; SY.items = R.items.slice();
      for (const k of Object.keys(SY.elec)) if (SY.elec[k] == null) SY.elec[k] = R.elec[k];
      for (const k of Object.keys(SY.avionics)) if (SY.avionics[k] == null) SY.avionics[k] = R.avionics[k]; }
    SY.avionics.gps = '${KIND}';
    ${SIDE ? `SY.gpsSide = '${SIDE}';` : ''}
    GARAGE_SPEC.update({ systems: JSON.parse(JSON.stringify(SY)) });
    if (window.CAGE_UI && CAGE_UI.build) CAGE_UI.build();
    const L = CP.last() && CP.last().layout;
    return { screens: L && L.screens && L.screens.map(s => ({ k: s.k, line: s.line, w: s.w, h: s.h })), overflow: L && L.overflow, extraOverflow: L && L.extraOverflow };`);
  console.log('fit: ' + JSON.stringify(info.fit));
  await sleep(4000);
  if (KIND !== 'none' && !QUICK) {
    // the garage rows that chose them: the Instruments part, its radios fold (the GPS select, the display side, where each went)
    info.rows = await run(`if (window.EDITOR_SELECT) EDITOR_SELECT('instruments');
      await new Promise(r => setTimeout(r, 1500));
      const f = [...document.querySelectorAll('details > summary')].find(q => q.textContent.trim() === 'radios');
      if (!f) return 'no radios fold'; f.parentNode.open = true; f.scrollIntoView({ block: 'start' });
      return [...f.parentNode.querySelectorAll('.r, label, select')].map(e => (e.tagName === 'SELECT' ? '[' + e.value + ']' : e.textContent.trim())).filter(Boolean).slice(0, 30);`);
    console.log('rows: ' + JSON.stringify(info.rows));
    await sleep(800);
    await shot(path.join(OUT, '00a_garage_rows.png'));
    info.shedEye = await run(`const b = [...document.querySelectorAll('button')].find(q => /^Look out of the pilot/.test(q.title || ''));
      if (!b || b.disabled) return false; b.click(); return true;`);
    await frames(30); await sleep(800);
    await shot(path.join(OUT, '00_shed_panel.png'));
  }
  // ---- THE ROLL-OUT, timed from the click to the cockpit's model
  const tR = Date.now();
  await run(`document.getElementById('bGo').click(); return 1;`);
  await until(`window.BOOT && BOOT.state === 'gone' && window.FLIGHT_PROBE && FLIGHT_PROBE.model() && window.FLYDIY_COCKPIT_I && FLYDIY_COCKPIT_I.model`, 900000, 'the roll-out');
  info.rolloutMs = Date.now() - tR;
  console.log('roll-out: ' + info.rolloutMs + ' ms');
  await frames(90); await sleep(3000);
  if (KIND === 'none' || QUICK) {
    if (KIND !== 'none') for (const on of [1, 0, 1, 0]) {
      await run(`const CK = window.FLYDIY_COCKPIT_I; CK.sw.sw_gps = ${on}; CK.sw.sw_gps2 = ${on}; return 1;`);
      await sleep(2500); const m = await run(MEASURE(8000)); m.on = on; info.cost.push(m);
      console.log('  cost ' + (on ? 'ON ' : 'OFF') + ' ' + JSON.stringify(m));
    } else { const m = await run(MEASURE(8000)); m.on = null; info.cost.push(m); console.log('  cost (none) ' + JSON.stringify(m)); }
    info.end = await run(READ); fs.writeFileSync(path.join(OUT, 'pfd_page.json'), JSON.stringify(info, null, 1)); return; }
  await run(`const c = document.getElementById('c'); document.querySelectorAll('body *').forEach(e => { if (e !== c && !e.contains(c) && e.id !== 'bPause') e.style.visibility = 'hidden'; }); return 1;`);
  await run(`FLIGHT_PROBE.camMode('cockpit'); HEAD_CAM.yaw = 0; HEAD_CAM.pitch = -20 * Math.PI / 180; return 1;`);
  const look = (yawDeg, pitchDeg) => `HEAD_CAM.yaw = ${yawDeg} * Math.PI / 180; HEAD_CAM.pitch = ${pitchDeg} * Math.PI / 180;`;
  const state = async (tag, js, waitMs) => {
    if (js) await run(js + ' return 1;');
    await sleep(waitMs == null ? 1500 : waitMs); await frames(10);
    await shot(path.join(OUT, tag + '.png'));
    const r = info.states[tag] = await run(READ);
    console.log('  ' + tag.padEnd(16) + ' ' + JSON.stringify({ gpsOn: r.gpsOn, pair: r.pair, u0: r.u0 && [r.u0.page, r.u0.W, r.u0.glow], u1: r.u1 && [r.u1.page, r.u1.W], dg: r.dg, pfdHdg: r.pfdHdg, agl: r.agl }));
  };
  const pair = KIND === 'flatPair';
  const mfdYaw = +(process.env.MFD_YAW || -18);
  await state('01_stand_panel', null, 4000);
  // (the head turned either way: which side the MFD - or a passenger-side display - is on, framed)
  await state('01b_look_plus', look(22, -20), 1200);
  await state('01c_look_minus', look(-22, -20), 1200);
  await run(look(0, -20) + ' return 1;');
  if (pair) await state('02_stand_mfd', look(mfdYaw, -20), 1500);
  await run(look(0, -20) + ' return 1;');
  // ---- THE COST on the stand, alternated on / off twice (the power buttons: the units' load off, no paint, no upload)
  for (let k = 0; k < 2; k++) {
    for (const on of [1, 0]) {
      await run(`const CK = window.FLYDIY_COCKPIT_I; CK.sw.sw_gps = ${on}; CK.sw.sw_gps2 = ${on}; return 1;`);
      await sleep(2500);
      const m = await run(MEASURE(8000)); m.on = on; info.cost.push(m);
      console.log('  cost ' + (on ? 'ON ' : 'OFF') + ' ' + JSON.stringify(m));
    }
  }
  await run(`const CK = window.FLYDIY_COCKPIT_I; CK.sw.sw_gps = 1; CK.sw.sw_gps2 = 1; return 1;`);
  await sleep(4000);    // (past the boot page again)
  await state('03_svt_off', `FLYDIY_GPS.key('rngDn', 0);`, 1200);
  await run(`FLYDIY_GPS.key('rngDn', 0); return 1;`);
  // ---- MOVING: the build's own pilot takes off
  await run(`document.getElementById('bGo').click(); return 1;`);
  { const t0 = Date.now(); let up = false;
    while (Date.now() - t0 < 200000 && !up) { await sleep(1000); up = await run(`return (FLIGHT_PROBE.agl() || 0) > 120;`); } info.climbReached = up; }
  await state('04_climb_panel', null, 4000);
  info.costClimb = await run(MEASURE(8000)); console.log('  cost climb ' + JSON.stringify(info.costClimb));
  if (pair) await state('05_climb_mfd', look(mfdYaw, -20), 1500);
  await state('06_dusk_panel', look(0, -20) + ` DAY_CLOCK.preset('dusk');`, 5000);
  await state('07_night_panel', `DAY_CLOCK.preset('night');`, 5000);
  info.costNight = await run(MEASURE(8000)); console.log('  cost night ' + JSON.stringify(info.costNight));
  if (pair) await state('08_night_mfd', look(mfdYaw, -20), 1500);
  fs.writeFileSync(path.join(OUT, 'pfd_page.json'), JSON.stringify(info, null, 1));
  console.log('-> ' + path.join(OUT, 'pfd_page.json'));
})().catch(e => { console.error('avionics_pfd_stills: ' + (e && e.stack || e)); process.exit(1); });
