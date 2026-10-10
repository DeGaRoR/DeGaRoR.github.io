#!/usr/bin/env node
// finish_stills.js - FINISH-FIX G2750's before/after stills on the user's Mosquito (tools/fixtures/repro/mosquito_3.json:
// carbon fuselage, weather age 0.7, a bubble canopy, a registration). Drives a page kept up by tools/live_driver.js.
//   garage: the weathering on the carbon flank + fin (and the same view with each candidate layer pinned to 0, to name the
//           tiled one), the bubble canopy's surround (and with the cabin gain 0 / the shoulder off), the roof lights
//           from the floor (own camera on the hangar scene, the shed's renderer)
//   reg:    a new registration typed in the garage, then rolled out: the BAKE drawn (hyForce 0) must show the new letters
//   flight: the decal on the moving surfaces, live shader, four frames apart; the overlay over the runway; back to the
//           garage with the overlay on
// Usage: node tools/perf/finish_stills.js <cmdPort> <outDir> <tag> [steps=garage,reg,flight]   (GPU: hold the gpu lock)
'use strict';
const fs = require('fs'), path = require('path');
const PORT = +(process.argv[2] || 8572), OUT = path.resolve(process.argv[3] || 'finish_stills'), TAG = process.argv[4] || 'x';
const STEPS = (process.argv[5] || 'garage,reg,flight').split(',');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async (p, body) => { const r = await fetch('http://127.0.0.1:' + PORT + p, { method: 'POST', body }); return r.text(); };
const run = async body => { const t = await post('/run', body); try { return JSON.parse(t); } catch (e) { return t; } };
const shot = async n => { const f = path.join(OUT, TAG + '_' + n + '.png'); await fetch('http://127.0.0.1:' + PORT + '/shot?f=' + encodeURIComponent(f)); console.log('shot ' + n); return f; };
const until = async (cond, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await run('return !!(' + cond + ');')) === true) return true; await sleep(500); } throw new Error('timed out: ' + what); };
const frames = n => run(`await new Promise(r => { let k = ${n}; const f = () => (--k > 0 ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }); return 1;`);
const hideUi = () => run(`let s = document.getElementById('__fsHide'); if (!s) { s = document.createElement('style'); s.id = '__fsHide'; document.head.appendChild(s); }
  s.textContent = 'body > *:not(canvas):not(#c):not(:has(canvas)) { visibility: hidden !important; } #edWrap, #ui, .hud, #hud { visibility: hidden !important; }'; return 1;`);
const showUi = () => run(`const s = document.getElementById('__fsHide'); if (s) s.remove(); return 1;`);
const view = async (n, az, el, d, pan) => {
  await run(`FLIGHT_PROBE.camSet(${az}, ${el}, ${d}); ${pan ? `FLIGHT_PROBE.pan(${pan.join(',')});` : ''} return 1;`);
  await frames(20); await sleep(400); return shot(n);
};
// the shed's own renderer on its own camera: a still, read back in the same task as the draw
const ownShot = async (n, js) => {
  const url = await run(`const R = FLIGHT_PROBE.renderer(), S = FLIGHT_PROBE.hangarScene(); ${js}
    const c = R.domElement; const cam = new THREE.PerspectiveCamera(60, c.width / c.height, 0.05, 400); cam.position.copy(EYE); cam.lookAt(AT);
    cam.updateMatrixWorld(); R.setRenderTarget(null); R.render(S, cam); return c.toDataURL('image/png');`);
  if (typeof url !== 'string' || !url.startsWith('data:')) { console.log('ownShot ' + n + ': ' + String(url).slice(0, 200)); return null; }
  const f = path.join(OUT, TAG + '_' + n + '.png'); fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); console.log('shot ' + n); return f;
};
const garageBoot = async () => {
  await until(`window.BOOT && BOOT.state === 'gone' && window.FLIGHT_PROBE && window.CAGE_UI`, 600000, 'the garage boot');
  await run(`[...document.querySelectorAll('button')].filter(b => /keep the current build/i.test(b.textContent)).forEach(b => b.click()); return 1;`);
  await sleep(2500);
};
const rollOut = async () => {
  await run(`document.getElementById('bGo').click(); return 1;`);
  await until(`window.BOOT && BOOT.state === 'gone' && /Fly the circuit/.test((document.getElementById('bGo') || {}).textContent || '') && window.FLIGHT_PROBE && FLIGHT_PROBE.model()`, 900000, 'the roll-out');
  await frames(60); await sleep(1500);
};
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let didFlight = false;
  const log = { date: new Date().toISOString(), tag: TAG, notes: [] };
  await garageBoot();
  log.notes.push(await run(`const s = GARAGE_SPEC.get(); return { reg: s.meta && s.meta.reg, canopy: s.cage && s.cage.canopy, w: s.finish && s.finish.weather };`));
  if (STEPS.includes('garage')) try {
    await hideUi();
    // the flank and the fin, both sides, close
    await view('g_flank', 1.57, 0.12, 5.5);
    await view('g_flank_far', -1.57, 0.10, 7.5);
    await view('g_fin', 2.4, 0.15, 4.0);
    // which layer tiles: each candidate pinned to 0 over the flank view
    for (const k of ['scratch', 'panel', 'streakA', 'streakD', 'chip', 'fade', 'dust', 'cav', 'dep']) {
      await run(`aeroWxPin(null, '${k}', 0); return 1;`);
      await view('g_flank_no_' + k, 1.57, 0.12, 5.5);
      await run(`aeroWxPin(null, '${k}', null); return 1;`);
    }
    // the bubble's surround from above the nose, then the two suspects
    await view('g_bubble', 0.5, 0.55, 3.5);
    await view('g_bubble_side', 1.4, 0.35, 3.0);
    log.notes.push(await run(`return aeroSharedU(THREE).uCabin.value.x;`));
    await run(`window.__cab = aeroSharedU(THREE).uCabin.value.x; aeroSharedU(THREE).uCabin.value.x = 0; return 1;`);
    await view('g_bubble_cabin0', 0.5, 0.55, 3.5);
    await run(`aeroSharedU(THREE).uCabin.value.x = window.__cab; return 1;`);
    log.notes.push(await run(`CAGE_UI.setParam('shoulderOn', 0); CAGE_UI.build(); return 'shoulder off';`));
    await frames(30); await sleep(800);
    await view('g_bubble_noshoulder', 0.5, 0.55, 3.5);
    await run(`CAGE_UI.setParam('shoulderOn', 1); CAGE_UI.build(); return 1;`);
    await frames(30); await sleep(800);
    // the roof lights from the floor, from two eyes
    const sky = `const P = []; S.traverse(o => { if (o.isMesh && o.material && o.material.transparent && o.material.emissive && Math.abs(o.material.opacity - 0.30) < 1e-3) { o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); P.push(b.getCenter(new THREE.Vector3())); } });
      if (!P.length) return 'no roof light found'; P.sort((a, b) => a.x - b.x || a.z - b.z); const L = P[0];`;
    await ownShot('g_skylight', sky + `const AT = L.clone(); const EYE = new THREE.Vector3(L.x + 2.5, 1.7, L.z * 0.25);`);
    await ownShot('g_skylight_close', sky + `const AT = L.clone(); const EYE = new THREE.Vector3(L.x + 1.2, L.y - 3.2, L.z * 0.55);`);
    await showUi();
  } catch (e) { console.log('STEP garage FAILED ' + (e && e.message)); log.notes.push('garage failed: ' + (e && e.message)); }
  if (STEPS.includes('flight')) try {
    await rollOut(); didFlight = true;
    await hideUi();
    await run(`FLIGHT_PROBE.camMode('orbit'); FLOWN_BAKE.FB.hyForce = 1; return 1;`);
    // the moving surfaces under the live shader while the pilot works them (taxi): the tail, then a wing, 4 frames each
    for (const [n, az, el, d] of [['tail', 2.6, 0.25, 4.5], ['wing', 0.9, 0.6, 6.0]])
      for (let i = 0; i < 4; i++) {
        await run(`const I = FLIGHT_PROBE.input && FLIGHT_PROBE.input(); return 1;`);
        await view('f_' + n + '_' + i, az, el, d); await sleep(700);
      }
    await run(`FLOWN_BAKE.FB.hyForce = null; return 1;`);
    // the overlay over the runway, from above
    await run(`for (let i = 0; i < 3; i++) document.getElementById('bSkin').click(); return document.getElementById('bSkin').textContent;`);
    await view('f_overlay', 0.8, 0.9, 9.0);
    await view('f_overlay_low', 1.57, 0.25, 8.0);
    log.notes.push(await run(`return document.getElementById('bSkin').textContent;`));
    await showUi();
    await run(`FLIGHT_PROBE.endFlight(); await new Promise(r => setTimeout(r, 800)); document.getElementById('bHangar2').click(); return 1;`);
    await until(`window.BOOT && BOOT.state === 'gone' && window.CAGE_UI && !/Fly the circuit/.test((document.getElementById('bGo') || {}).textContent || '')`, 120000, 'back to the garage');
    await sleep(2500);
    log.notes.push(await run(`return document.getElementById('bSkin').textContent;`));
    await shot('f_garage_after');
  } catch (e) { console.log('STEP flight FAILED ' + (e && e.message)); log.notes.push('flight failed: ' + (e && e.message)); }
  if (STEPS.includes('reg')) try {
    // fly once on the loaded letters (the bake made), back to the shed, new letters, fly again: the bake must follow
    if (!didFlight) { await rollOut();
    await run(`FLIGHT_PROBE.endFlight(); await new Promise(r => setTimeout(r, 800)); document.getElementById('bHangar2').click(); return 1;`);
    await until(`window.BOOT && BOOT.state === 'gone' && window.CAGE_UI && !/Fly the circuit/.test((document.getElementById('bGo') || {}).textContent || '')`, 120000, 'back to the garage');
    await sleep(2000); }
    log.notes.push(await run(`GARAGE_SPEC.update({ meta: { reg: 'G-FIXD' } }); return GARAGE_SPEC.get().meta.reg;`));
    await sleep(1500);
    await rollOut();
    await run(`if (document.getElementById('bPause') && !window.FLYDIY_HELD) document.getElementById('bPause').click(); return 1;`); await frames(4);
    await hideUi();
    await run(`FLIGHT_PROBE.camMode('orbit'); return 1;`);
    for (const [k, t] of [['bake', 0], ['live', 1]]) {
      await run(`FLOWN_BAKE.FB.hyForce = ${t}; return 1;`);
      await view('r_reg_' + k, 1.57, 0.10, 6.5);
      await view('r_reg_' + k + '_l', -1.57, 0.10, 6.5);
    }
    await run(`FLOWN_BAKE.FB.hyForce = null; if (window.FLYDIY_HELD) document.getElementById('bPause').click(); return 1;`);
    log.notes.push(await run(`return window.FLYDIY_TRIPS ? FLYDIY_TRIPS.slice(-1)[0].steps : null;`));
    await showUi();
    await run(`FLIGHT_PROBE.endFlight(); await new Promise(r => setTimeout(r, 800)); document.getElementById('bHangar2').click(); return 1;`);
    await until(`window.BOOT && BOOT.state === 'gone' && window.CAGE_UI && !/Fly the circuit/.test((document.getElementById('bGo') || {}).textContent || '')`, 120000, 'back to the garage');
    await sleep(2000);
  } catch (e) { console.log('STEP reg FAILED ' + (e && e.message)); log.notes.push('reg failed: ' + (e && e.message)); }
  fs.writeFileSync(path.join(OUT, TAG + '_log.json'), JSON.stringify(log, null, 1));
  console.log('done');
})().catch(e => { console.error('finish_stills: ' + (e && e.stack || e)); process.exit(1); });
