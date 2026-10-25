#!/usr/bin/env node
// avionics_stills.js - THE GPS LIVE AND THE POWER BEHIND IT, FROM THE PILOT'S SEAT (G2807, AVIONICS-GPS phase 2)
//
// The cloud cannot render (SwiftShader draws the sky only): this is A0's evidence rig, on the box's GPU. It drives a
// page kept up by tools/live_driver.js (cockpit_ab.js's contract: POST /run, GET /shot), fits a GPS on the build on
// the stand (the Instruments column's own state, committed through GARAGE_SPEC), rolls it out and shoots the panel
// from the pilot's head in each power state, reading what the cockpit and the GPS say beside every picture:
//   00_shed_panel        the dash in the shed: the unit on the plate (standby), the breaker row and its tape
//   01_on_map            master + avionics on: the GPS live (map, track, leg, GS / DTK / DIS / ETE)
//   02_avionics_off      the avionics master off: the GPS (and COM / XPDR) dark, the dials alive
//   03_gps_cb_out        avionics on, the GPS breaker pulled: the GPS alone dark, its button standing out
//   04_master_off        the master off: every electric dial at rest, the GPS dark, the lamps dark
//   05_boot              the master back: the boot page (ACQUIRING SATELLITES)
//   06_on_again          ...then the map
//   07_taxi, 08_climb    moving: the track drawn, the GS and the track flown
//   09_dusk              the hour at dusk: the screen's glow under the night dimmer, the panel lights
// plus a readback count: gl.readPixels calls over 10 s with the GPS live (expected 0 from this work), and the GPS's
// own counters (paints, uploads: ~4 a second).
// Writes <out>/<NN_state>.png and <out>/avionics.json.
//
// Usage (A0's box, the GPU lock held - tools/perf/boxlock.sh take gpu AVIONICS):
//   node tools/live_driver.js <repo root> "flyDiy/bugReports/cessnaMetal (1).json" dev.html 8572
//   node tools/avionics_stills.js 8572 <outDir> [portable|panel|glass]
// G2808 (the user, 25 Oct: "GPS placement is in front of the pilot, glass cockpit style"): every kind lays out
// SCREEN FIRST, on the pilot's line - the shipped metal Cessna (tools/_load_build.js VALIDATED.metal) takes the glass
// unit there with all its dials and its 15 breakers (GATE GPSFACE F holds glass and portable); the C172 and the Cub
// likewise; a Jodel's portable stands in its glareshield cradle on the pilot's line (on its plate it would cost a
// dial), and its glass unit fits only in the middle, four gauges giving way (named, not drawn, not billed).
// Try `glass` first on the metal Cessna: node tools/avionics_stills.js 8572 <outDir> glass
'use strict';
const fs = require('fs'), path = require('path');
const PORT = +(process.argv[2] || 8572), OUT = path.resolve(process.argv[3] || 'avionics_stills');
const KIND = process.argv[4] || 'portable';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async (p, body) => { const r = await fetch('http://127.0.0.1:' + PORT + p, { method: 'POST', body }); return r.text(); };
const run = async body => { const t = await post('/run', body); try { return JSON.parse(t); } catch (e) { return t; } };
const shot = async f => { await fetch('http://127.0.0.1:' + PORT + '/shot?f=' + encodeURIComponent(f)); return f; };
const until = async (cond, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await run('return !!(' + cond + ');')) === true) return true; await sleep(500); } throw new Error('timed out: ' + what); };
const frames = n => run(`await new Promise(r => { let k = ${n}; const f = () => (--k > 0 ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }); return 1;`);
// what the cockpit and the GPS say
const READ = `const CK = window.FLYDIY_COCKPIT_I, G = window.FLYDIY_GPS, S = G ? G.state() : null, B = CK && CK.bus;
  return { gpsFit: !!(CK && CK.gpsFit), gpsOn: !!(CK && CK.gpsOn), kind: S && S.kind,
    paints: S && S.paints, uploads: S && S.uploads, gs: S && +S.gs.toFixed(2), trk: S && +(S.trk * 57.29578).toFixed(1), track: S && S.trN,
    glow: S && S.mat ? +S.mat.emissiveIntensity.toFixed(3) : null,
    bus: B ? { V: +B.V.toFixed(2), ok: B.ok, master: B.master, avionics: B.avionics, altOn: B.altOn, loadA: +B.loadA.toFixed(2),
               cbOut: Object.keys(B.cb).filter(k => B.cb[k] === false), tripped: Object.keys(B.tripped).filter(k => B.tripped[k]) } : null,
    sw: CK ? Object.fromEntries(Object.entries(CK.sw).filter(([k]) => /^(sw_master|sw_alt|sw_avionics|cb_)/.test(k))) : null,
    dials: CK ? { volts: +CK.readings.volts.toFixed(2), fuel: +CK.readings.fuelFrac.toFixed(3), r: +CK.readings.r.toFixed(3) } : null };`;
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const info = { kind: KIND, date: new Date().toISOString(), states: {} };
  await until(`window.BOOT && BOOT.state === 'gone'`, 600000, 'the garage boot');
  await sleep(1500);
  // ---- THE GPS ON THE BUILD: the Instruments column's own state (a custom fit keeps the rest of the build's)
  info.fit = await run(`const CP = window.CAGE_PANEL; if (!CP || !CP.state) return 'no panel layer (open the editor once)';
    const SY = CP.state(); if (SY.fit !== 'custom') { const R = CP.resolve(); SY.fit = 'custom'; SY.items = R.items.slice();
      for (const k of Object.keys(SY.elec)) if (SY.elec[k] == null) SY.elec[k] = R.elec[k];
      for (const k of Object.keys(SY.avionics)) if (SY.avionics[k] == null) SY.avionics[k] = R.avionics[k]; }
    SY.avionics.gps = '${KIND}';
    GARAGE_SPEC.update({ systems: JSON.parse(JSON.stringify(SY)) });
    if (window.CAGE_UI && CAGE_UI.build) CAGE_UI.build();
    const L = CP.last() && CP.last().layout;
    return { screens: L && L.screens, overflow: L && L.overflow, extraOverflow: L && L.extraOverflow, breakers: L && L.breakers && L.breakers.row.length };`);
  console.log('fit: ' + JSON.stringify(info.fit));
  await sleep(4000);
  // ---- 00 the shed: the pilot's eye on the dash
  // (the editor rail's own "pilot's eyes" camera button: editor.js titles it 'Look out of the pilot's eyes...')
  info.shedEye = await run(`const b = [...document.querySelectorAll('button')].find(q => /^Look out of the pilot/.test(q.title || ''));
    if (!b || b.disabled) return false; b.click(); return true;`);
  await frames(30); await sleep(800);
  await shot(path.join(OUT, '00_shed_panel.png'));
  // ---- THE ROLL-OUT
  await run(`document.getElementById('bGo').click(); return 1;`);
  await until(`window.BOOT && BOOT.state === 'gone' && window.FLIGHT_PROBE && FLIGHT_PROBE.model() && window.FLYDIY_COCKPIT_I && FLYDIY_COCKPIT_I.model`, 900000, 'the roll-out');
  await frames(90); await sleep(3000);
  // the HUD out of the frame; the cockpit camera on the panel
  await run(`const c = document.getElementById('c'); document.querySelectorAll('body *').forEach(e => { if (e !== c && !e.contains(c) && e.id !== 'bPause') e.style.visibility = 'hidden'; }); return 1;`);
  await run(`FLIGHT_PROBE.camMode('cockpit'); HEAD_CAM.yaw = 0; HEAD_CAM.pitch = -22 * Math.PI / 180; return 1;`);
  const CK = 'window.FLYDIY_COCKPIT_I';
  const state = async (tag, js, waitMs) => {
    if (js) await run(js + ' return 1;');
    await sleep(waitMs == null ? 1500 : waitMs); await frames(10);
    await shot(path.join(OUT, tag + '.png'));
    const r = info.states[tag] = await run(READ);
    console.log('  ' + tag.padEnd(16) + ' ' + JSON.stringify({ gpsOn: r.gpsOn, glow: r.glow, paints: r.paints, V: r.bus && r.bus.V, cbOut: r.bus && r.bus.cbOut }));
  };
  await state('01_on_map', null, 3000);
  // a readback count with the GPS live: every readPixels on the page's GL context for 10 s
  info.readPixels = await run(`const gl = FLIGHT_PROBE.renderer().getContext(); let n = 0; const rp = gl.readPixels;
    gl.readPixels = function () { n++; return rp.apply(this, arguments); };
    const p0 = FLYDIY_GPS.state().paints, u0 = FLYDIY_GPS.state().uploads;
    await new Promise(r => setTimeout(r, 10000));
    gl.readPixels = rp;
    return { readPixels10s: n, paints10s: FLYDIY_GPS.state().paints - p0, uploads10s: FLYDIY_GPS.state().uploads - u0 };`);
  console.log('  readback ' + JSON.stringify(info.readPixels));
  await state('02_avionics_off', `${CK}.dashAction('avionics');`);
  await state('03_gps_cb_out', `${CK}.dashAction('avionics'); ${CK}.sw.cb_gps = 1;`);
  await state('04_master_off', `${CK}.sw.cb_gps = 0; ${CK}.dashAction('master');`, 2500);
  await state('05_boot', `${CK}.dashAction('master');`, 500);
  await state('06_on_again', null, 2500);
  // ---- MOVING: the taxi, then the climb (the build's own pilot flies; the track and the GS come alive)
  await run(`document.getElementById('bGo').click(); return 1;`);
  { const t0 = Date.now(); let moved = false;
    while (Date.now() - t0 < 90000 && !moved) { await sleep(1000); moved = await run(`const v = FLIGHT_PROBE.sim().cgVel(); return Math.hypot(v[0], v[2]) > 3;`); } }
  await state('07_taxi', null, 6000);
  { const t0 = Date.now(); let up = false;
    while (Date.now() - t0 < 240000 && !up) { await sleep(1000); up = await run(`return (FLIGHT_PROBE.agl() || 0) > 150;`); } }
  await state('08_climb', null, 8000);
  await state('09_dusk', `DAY_CLOCK.preset('dusk');`, 5000);
  fs.writeFileSync(path.join(OUT, 'avionics.json'), JSON.stringify(info, null, 1));
  console.log('-> ' + path.join(OUT, 'avionics.json'));
})().catch(e => { console.error('avionics_stills: ' + (e && e.stack || e)); process.exit(1); });
