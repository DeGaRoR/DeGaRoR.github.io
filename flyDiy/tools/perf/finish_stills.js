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
    const c = R.domElement, sz = R.getSize(new THREE.Vector2()), pr = R.getPixelRatio();
    R.setPixelRatio(1); R.setSize(1600, 900, false);
    const cam = new THREE.PerspectiveCamera(42, 1600 / 900, 0.05, 400); cam.position.copy(EYE); cam.lookAt(AT);
    cam.updateMatrixWorld(); R.setRenderTarget(null); R.render(S, cam); const url = c.toDataURL('image/png');
    R.setPixelRatio(pr); R.setSize(sz.x, sz.y, false); return url;`);
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
  // THE AEROPLANE ON ITS OWN CAMERA, in the mount's frame (x lateral, y up, z along, aft +): REF 'glass' (the canopy's
  // transparent meshes) or 'all'; eye/at are offsets in metres from that box's centre (at may name 'aft' etc. via js)
  const craftCam = (ref, eye, at) => `const MT = CAGE_JOIN.mount(); MT.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(MT.matrixWorld).invert();
    const bb = new THREE.Box3(), tmp = new THREE.Box3();
    MT.traverse(o => { if (!o.isMesh || !o.visible || !o.geometry) return; const ms = Array.isArray(o.material) ? o.material : [o.material];
      const gl = ms.some(m => m && m.transparent && m.opacity < 0.9);
      if ('${ref}' === 'cage') { if (!(o.userData && o.userData.matNames)) return; } else if (('${ref}' === 'glass') !== gl && '${ref}' !== 'all') return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); tmp.copy(o.geometry.boundingBox).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)); bb.union(tmp); });
    if (bb.isEmpty()) return 'no ${ref} box'; const C = bb.getCenter(new THREE.Vector3()), SZ = bb.getSize(new THREE.Vector3());
    const L = (x, y, z) => MT.localToWorld(new THREE.Vector3(C.x + x, C.y + y, C.z + z));
    const EYE = L(${eye.join(',')}), AT = L(${at.join(',')});`;
  if (STEPS.includes('bubble')) try {
    const eyes = [['a', [1.8, 0.75, -1.25], [0, -0.12, 0]], ['b', [-1.55, 0.5, 1.25], [0, -0.12, 0]]];
    const all = async tag => { for (const [k, e, a] of eyes) await ownShot('b_' + tag + '_' + k, craftCam('glass', e, a)); };
    await all('base');
    await run(`window.__cab = aeroSharedU(THREE).uCabin.value.x; aeroSharedU(THREE).uCabin.value.x = 0; return 1;`);
    await all('cabin0');
    await run(`aeroSharedU(THREE).uCabin.value.x = window.__cab; return 1;`);
    // one candidate section at a time in magenta, through the editor's own finish door (finishToSpec / finishFromSpec):
    // whichever paints the band names it
    await run(`window.__f0 = JSON.stringify(CAGE_UI.finishToSpec()); return 1;`);
    for (const sec of ['waistband', 'composite', 'joint', 'shoulder', 'pillarCabin', 'dash', 'body']) {
      log.notes.push(sec + ': ' + await run(`const f = JSON.parse(window.__f0); f.sections = f.sections || {};
        f.sections['${sec}'] = Object.assign({}, f.sections['${sec}'] || {}, { tint: 0xff00ff });
        CAGE_UI.finishFromSpec(f); CAGE_UI.build(); return 'ok';`));
      await frames(20); await sleep(500);
      await ownShot('b_mag_' + sec, craftCam('glass', eyes[0][1], eyes[0][2]));
      await ownShot('b_mag_' + sec + '_b', craftCam('glass', eyes[1][1], eyes[1][2]));
    }
    await run(`CAGE_UI.finishFromSpec(JSON.parse(window.__f0)); CAGE_UI.build(); return 1;`); await frames(20); await sleep(500);
    // the FINISH view's rows: which sections a builder can reach
    log.notes.push(await run(`if (window.EDITOR_SET_VIEW) EDITOR_SET_VIEW('finish'); await new Promise(r => setTimeout(r, 800));
      const rows = [...document.querySelectorAll('input[type=color]')].map(c => { const r = c.parentElement; return r ? (r.textContent || '').trim().slice(0, 40) : ''; });
      if (window.EDITOR_SET_VIEW) EDITOR_SET_VIEW('shape'); return rows;`));
    // a click on the band in the FINISH view: which row it lands on (G2750), and the panel as it then stands
    log.notes.push({ clickBand: await run(`EDITOR_SET_VIEW('finish'); await new Promise(r => setTimeout(r, 600));
      EDITOR_PICK({ section: 'waistband', name: '' }, false); await new Promise(r => setTimeout(r, 450));
      const f = document.querySelector('#edWrap .secFlash'); return f ? (f.dataset.sec + ' | ' + (f.textContent || '').trim().slice(0, 60)) : 'no row flashed';`) });
    await shot('b_finish_click');
    await run(`EDITOR_SET_VIEW('shape'); return 1;`);
    await run(`CAGE_UI.setParam('shoulderOn', 0); CAGE_UI.build(); return 1;`); await frames(30); await sleep(800);
    await all('noshoulder');
    await run(`CAGE_UI.setParam('shoulderOn', 1); CAGE_UI.build(); return 1;`); await frames(30); await sleep(800);
    log.notes.push(await run(`return Object.keys(GARAGE_SPEC.get().finish.sections || {});`));
  } catch (e) { console.log('STEP bubble FAILED ' + (e && e.message)); log.notes.push('bubble failed: ' + (e && e.message)); }
  // WORLD aim off the cage sheet (the fuselage alone): its long horizontal axis, the nose being the end nearer the glass;
  // f 0 nose .. 1 tail, side metres out to the +lateral side, up metres over the axis
  const fuseCam = (f, side, up, ty) => `const MT = CAGE_JOIN.mount(); MT.updateMatrixWorld(true); const bb = new THREE.Box3(), gb = new THREE.Box3();
    MT.traverse(o => { if (!o.isMesh || !o.visible || !o.geometry) return; const ms = Array.isArray(o.material) ? o.material : [o.material];
      if (o.userData && o.userData.matNames) bb.union(new THREE.Box3().setFromObject(o));
      else if (ms.some(m => m && m.transparent && m.opacity < 0.9)) gb.union(new THREE.Box3().setFromObject(o)); });
    const C = bb.getCenter(new THREE.Vector3()), SZ = bb.getSize(new THREE.Vector3()), G0 = gb.getCenter(new THREE.Vector3());
    const ax = SZ.x >= SZ.z ? 'x' : 'z', lat = ax === 'x' ? 'z' : 'x', L = SZ[ax];
    const sgn = (G0[ax] > C[ax]) ? 1 : -1;            // the nose is on the glass's side
    const P = new THREE.Vector3().copy(C); P[ax] = C[ax] + sgn * L * (0.5 - ${f});
    const AT = P.clone(); AT.y += ${ty}; const EYE = P.clone(); EYE[lat] += ${side}; EYE.y += ${up};`;
  if (STEPS.includes('flankw')) try {
    const V = [['mid', 0.45, 1.9, 0.25, 0.05], ['aft', 0.72, 1.7, 0.3, 0.05], ['fin', 0.93, 2.2, 0.9, 0.55]];
    const allV = async tag => { for (const [k, f, sd, up, ty] of V) await ownShot('x_' + k + '_' + tag, fuseCam(f, sd, up, ty)); };
    await allV('base');
    await run(`window.__m0 = JSON.stringify(AEROWX.AERO_WX.macro); aeroWxSetMacro(null, { age: 0, flight: 0, bush: 0, rain: 0 }); return 1;`); await frames(3);
    await allV('wxoff');
    await run(`aeroWxSetMacro(null, JSON.parse(window.__m0)); return 1;`); await frames(3);
    for (const k of ['scratch', 'streakA', 'streakD', 'chip', 'fade']) {
      await run(`aeroWxPin(null, '${k}', 0); return 1;`); await frames(3);
      await allV('no_' + k);
      await run(`aeroWxPin(null, '${k}', null); return 1;`);
    }
    await run(`aeroWxPin(null, 'scratch', 1); return 1;`); await frames(3);
    await allV('scratch1');
    await run(`aeroWxPin(null, 'scratch', null); return 1;`);
  } catch (e) { console.log('STEP flankw FAILED ' + (e && e.message)); log.notes.push('flankw failed: ' + (e && e.message)); }
  if (STEPS.includes('flank')) try {
    // (the mount's +z is FORWARD: the tail is at -z)
    const V = [['mid', [1.7, 0.15, -1.0], [0, 0.05, -1.0]], ['aft', [1.6, 0.3, -2.4], [0, 0.15, -2.4]], ['fin', [1.9, 0.9, -3.2], [0, 0.7, -3.3]]];
    const allV = async tag => { for (const [k, e, a] of V) await ownShot('w_' + k + '_' + tag, craftCam('cage', e, a)); };
    await allV('base');
    log.notes.push(await run(`window.__m0 = JSON.stringify(AEROWX.AERO_WX.macro); return window.__m0;`));
    await run(`aeroWxSetMacro(null, { age: 0, flight: 0, bush: 0, rain: 0 }); return 1;`); await frames(3);
    await allV('wxoff');
    await run(`aeroWxSetMacro(null, JSON.parse(window.__m0)); return 1;`); await frames(3);
    for (const k of ['scratch', 'streakA', 'streakD', 'chip', 'fade', 'chalk', 'dust', 'cav', 'dep']) {
      await run(`aeroWxPin(null, '${k}', 0); return 1;`); await frames(3);
      await allV('no_' + k);
      await run(`aeroWxPin(null, '${k}', null); return 1;`);
    }
  } catch (e) { console.log('STEP flank FAILED ' + (e && e.message)); log.notes.push('flank failed: ' + (e && e.message)); }
  if (STEPS.includes('sky')) try {
    const sky = `const P = []; S.traverse(o => { if (o.isMesh && o.material && o.material.transparent && o.material.emissive && Math.abs(o.material.opacity - 0.30) < 1e-3) { o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); P.push(b.getCenter(new THREE.Vector3())); } });
      if (!P.length) return 'no roof light found'; P.sort((a, b) => a.x - b.x || a.z - b.z); const L = P[0];`;
    await ownShot('g_skylight', sky + `const AT = L.clone(); const EYE = new THREE.Vector3(L.x + 2.5, 1.7, L.z * 0.25);`);
    await ownShot('g_skylight_close', sky + `const AT = L.clone(); const EYE = new THREE.Vector3(L.x + 1.2, L.y - 3.2, L.z * 0.55);`);
    // ...and the room as the player sees it from the stand, looking up the slope
    await ownShot('g_skylight_room', sky + `const AT = L.clone(); const EYE = new THREE.Vector3(L.x + 6, 1.6, 0);`);
  } catch (e) { console.log('STEP sky FAILED ' + (e && e.message)); }
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
  const back = async () => {
    await run(`FLIGHT_PROBE.endFlight(); await new Promise(r => setTimeout(r, 800)); document.getElementById('bHangar2').click(); return 1;`);
    await until(`window.BOOT && BOOT.state === 'gone' && window.CAGE_UI && !/Fly the circuit/.test((document.getElementById('bGo') || {}).textContent || '')`, 120000, 'back to the garage');
    await sleep(2000);
  };
  const tripSteps = () => run(`const t = window.FLYDIY_TRIPS ? FLYDIY_TRIPS.filter(x => x.kind !== 'rollin').slice(-1)[0] : null;
    return t ? t.steps.filter(s => /snapshot|bake|spec/.test(s.id)).map(s => s.id + ':' + (s.ran ? 'ran' : 'skip ' + (s.why || ''))) : null;`);
  // a rough frame sample: the mean / p95 rAF interval over n frames and the draws of the last one (not a bench - A0's train
  // battery is the ratchet; this is the same-window sanity line)
  const sample = (n) => run(`const R = FLIGHT_PROBE.renderer(); const d = []; let t0 = performance.now();
    await new Promise(r => { let k = ${n}; const f = () => { const t = performance.now(); d.push(t - t0); t0 = t; (--k > 0) ? requestAnimationFrame(f) : r(); }; requestAnimationFrame(f); });
    d.shift(); d.sort((a, b) => a - b); const m = d.reduce((a, b) => a + b, 0) / d.length;
    return { mean: +m.toFixed(2), p95: +d[Math.floor(d.length * 0.95)].toFixed(2), calls: R.info.render.calls, tris: R.info.render.triangles };`);
  if (STEPS.includes('perf')) try {
    log.notes.push({ garage: await sample(240) });
  } catch (e) { console.log('STEP perf FAILED ' + (e && e.message)); }
  // A0's proof round (Sun 07:36): the scratches still there at higher wear (just not in columns), the decal on a rudder
  // held hard over, a held-camera pair while the aeroplane moves - live shader throughout
  if (STEPS.includes('proof')) try {
    await rollOut(); didFlight = true;
    await hideUi();
    await run(`FLIGHT_PROBE.camMode('orbit'); FLOWN_BAKE.FB.hyForce = 1; window.__m0 = JSON.stringify(AEROWX.AERO_WX.macro); return 1;`);
    const key = (code, down) => run(`window.dispatchEvent(new KeyboardEvent('${down ? 'keydown' : 'keyup'}', { code: '${code}', bubbles: true })); return 1;`);
    // the held-camera pair first, unpaused: the pilot taxis, the frame flexes, the camera rides the CG
    for (let i = 0; i < 3; i++) { await view('p_held_' + i, 2.9, 0.22, 3.2); await sleep(600); }
    // the wear series, held (the same frame on both trees)
    await run(`if (!window.FLYDIY_HELD) document.getElementById('bPause').click(); return 1;`); await frames(4);
    for (const age of [0.5, 1.0]) {
      await run(`aeroWxSetMacro(null, { age: ${age}, flight: 0.15, bush: 0, rain: 0 }); return 1;`); await frames(3);
      await view('p_wear' + age + '_flank', 2.9, 0.22, 3.2);
      await view('p_wear' + age + '_cowl', 0.2, 0.22, 3.4);
    }
    await run(`aeroWxPin(null, 'scratch', 1); return 1;`); await frames(3);
    await view('p_scratch1_flank', 2.9, 0.22, 3.2);
    await view('p_scratch1_cowl', 0.2, 0.22, 3.4);
    await run(`aeroWxPin(null, 'scratch', null); aeroWxSetMacro(null, JSON.parse(window.__m0)); document.getElementById('bPause').click(); return 1;`); await frames(4);
    // the rudder held hard over, both ways, on manual with the throttle closed and the brakes on
    await run(`FLIGHT_PROBE.setManual(true); return 1;`); await sleep(300);
    await key('End', true); await key('KeyB', true); await sleep(1500);
    for (const [k, code] of [['right', 'Period'], ['left', 'Comma']]) {
      await key(code, true); await sleep(1500);
      log.notes.push({ ['rudder_' + k]: await run(`const s = FLIGHT_PROBE.sim(); return s && s.ctl ? +(+s.ctl.dr).toFixed(3) : null;`) });
      for (const az of [3.14, 2.75, 3.55]) await view('p_rud_' + k + '_az' + az, az, 0.18, 4.2);
      await key(code, false); await sleep(400);
    }
    await key('KeyB', false); await key('End', false);
    await run(`FLOWN_BAKE.FB.hyForce = null; return 1;`);
    await showUi();
    await back();
  } catch (e) { console.log('STEP proof FAILED ' + (e && e.message)); log.notes.push('proof failed: ' + (e && e.message)); }
  if (STEPS.includes('flight')) try {
    await rollOut(); didFlight = true;
    await hideUi();
    await run(`FLIGHT_PROBE.camMode('orbit'); FLOWN_BAKE.FB.hyForce = 1; return 1;`);
    // THE REST PLACE, measured (G2750): every flown aeroskin geometry carries aRest, the rigs move the vertices, the rest stays
    log.notes.push({ rest: await run(`const M = FLIGHT_PROBE.model(); let geos = 0, withRest = 0, moved = 0, maxD = 0;
      M.grp.traverse(o => { if (!o.isMesh || !o.geometry) return; const ms = Array.isArray(o.material) ? o.material : [o.material];
        if (!ms.some(m => m && (m.userData || {}).aeroskin)) return; geos++; const a = o.geometry.attributes; if (!a.aRest) return; withRest++;
        const p = a.position.array, r = a.aRest.array; let d = 0; for (let i = 0, j = 0; i < p.length; i += 3, j += 4) d = Math.max(d, Math.abs(p[i] - r[j]), Math.abs(p[i + 1] - r[j + 1]), Math.abs(p[i + 2] - r[j + 2]));
        if (d > 1e-4) moved++; maxD = Math.max(maxD, d); });
      return { geos, withRest, moved, maxD: +maxD.toFixed(4) };`) });
    if (STEPS.includes('perf')) log.notes.push({ taxi: await sample(240) });
    // the moving surfaces under the live shader while the pilot works them (taxi): four eyes round the tail, two frames each
    for (const az of [0.2, -0.4, 2.9, 3.5])
      for (let i = 0; i < 2; i++) { await view('f_tail_az' + az + '_' + i, az, 0.22, 3.6); await sleep(900); }
    for (let i = 0; i < 3; i++) { await view('f_wing_' + i, 0.9, 0.6, 6.0); await sleep(900); }
    await run(`FLOWN_BAKE.FB.hyForce = null; return 1;`);
    // the overlay over the runway: from above, then low so the strip lies behind the lines
    await run(`for (let i = 0; i < 3; i++) document.getElementById('bSkin').click(); return document.getElementById('bSkin').textContent;`);
    await view('f_overlay', 0.8, 0.9, 9.0);
    for (const az of [0, 1.57, 3.14, 4.71]) await view('f_overlay_low_' + az, az, 0.05, 9.0);
    log.notes.push(await run(`return document.getElementById('bSkin').textContent;`));
    await showUi();
    await back();
    log.notes.push({ skinAfterGarage: await run(`return document.getElementById('bSkin').textContent;`) });
    await shot('f_garage_after');
  } catch (e) { console.log('STEP flight FAILED ' + (e && e.message)); log.notes.push('flight failed: ' + (e && e.message)); }
  if (STEPS.includes('reg')) try {
    // keys settled by one flight, then one more flight with NOTHING changed (the trips skip), then a registration-only
    // change: the export alone compared, and the roll-out's trips and the bake's letters
    if (!didFlight) { await rollOut(); await back(); }
    await rollOut(); log.notes.push({ unchanged: await tripSteps() }); await back();
    log.notes.push({ exportSameAfterReg: await run(`const a = JSON.stringify(CAGE_JOIN.export()); GARAGE_SPEC.update({ meta: { reg: 'G-FIXD' } });
      await new Promise(r => setTimeout(r, 1500)); const b = JSON.stringify(CAGE_JOIN.export()); return [a === b, GARAGE_SPEC.get().meta.reg];`) });
    await rollOut(); log.notes.push({ regOnly: await tripSteps() });
    await run(`if (document.getElementById('bPause') && !window.FLYDIY_HELD) document.getElementById('bPause').click(); return 1;`); await frames(4);
    await hideUi();
    await run(`FLIGHT_PROBE.camMode('orbit'); return 1;`);
    for (const [k, t] of [['bake', 0], ['live', 1]]) {
      await run(`FLOWN_BAKE.FB.hyForce = ${t}; return 1;`);
      await view('r_reg_' + k, 1.57, 0.10, 6.5);
      await view('r_reg_' + k + '_l', -1.57, 0.10, 6.5);
    }
    await run(`FLOWN_BAKE.FB.hyForce = null; if (window.FLYDIY_HELD) document.getElementById('bPause').click(); return 1;`);
    await showUi();
    await back();
  } catch (e) { console.log('STEP reg FAILED ' + (e && e.message)); log.notes.push('reg failed: ' + (e && e.message)); }
  fs.writeFileSync(path.join(OUT, TAG + '_log.json'), JSON.stringify(log, null, 1));
  console.log('done');
})().catch(e => { console.error('finish_stills: ' + (e && e.stack || e)); process.exit(1); });
