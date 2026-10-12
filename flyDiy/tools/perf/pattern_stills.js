#!/usr/bin/env node
// pattern_stills.js - LIVERY-PATTERNS G2870's stills on the user's Cub (builds/cub_2026-09-20_corrected.json), for the
// user who asked for the patterns. Drives a page kept up by tools/live_driver.js (see pattern_window.sh).
//   garage:  SUNBURST on the tail and on the wings (rays in red, TRANSPARENT between: the Cub's own paint shows),
//            then a FADE navy -> transparent along the flank and a three-stop GRADIENT red / clear / blue on the wings;
//            the same sunburst after a GLOBAL REPAINT (the base well's own handler): the new base under the rays.
//   flight:  rolled out with the sunburst: the far BAKE drawn (hyForce 0) and the live shader (1), the same view.
// Every layer is FITTED (the editor measures the surface); the fitted L/C/W/H are logged. A shot is taken only with
// the boot overlay gone (BOOT.state 'gone' + 2.5 s), and each one is checked again just before.
// Usage: node tools/perf/pattern_stills.js <cmdPort> <outDir> <tag> [steps=garage,flight]   (GPU: hold the gpu lock)
'use strict';
const fs = require('fs'), path = require('path');
const PORT = +(process.argv[2] || 8762), OUT = path.resolve(process.argv[3] || 'pattern_stills'), TAG = process.argv[4] || 'x';
const STEPS = (process.argv[5] || 'garage,flight').split(',');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async (p, body) => { const r = await fetch('http://127.0.0.1:' + PORT + p, { method: 'POST', body }); return r.text(); };
const run = async body => { const t = await post('/run', body); try { return JSON.parse(t); } catch (e) { return t; } };
const until = async (cond, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await run('return !!(' + cond + ');')) === true) return true; await sleep(500); } throw new Error('timed out: ' + what); };
const frames = n => run(`await new Promise(r => { let k = ${n}; const f = () => (--k > 0 ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }); return 1;`);
const overlayGone = () => until(`window.BOOT && BOOT.state === 'gone' && (() => { const b = document.getElementById('boot'); if (!b) return true;
  const s = getComputedStyle(b); return s.display === 'none' || s.visibility === 'hidden' || +s.opacity < 0.01; })()`, 120000, 'the overlay');
const shot = async n => {
  await overlayGone();
  const f = path.join(OUT, TAG + '_' + n + '.png');
  await fetch('http://127.0.0.1:' + PORT + '/shot?f=' + encodeURIComponent(f)); console.log('shot ' + n); return f;
};
const hideUi = () => run(`let s = document.getElementById('__psHide'); if (!s) { s = document.createElement('style'); s.id = '__psHide'; document.head.appendChild(s); }
  s.textContent = 'body > *:not(canvas):not(#c):not(:has(canvas)) { visibility: hidden !important; } #edWrap, #ui, .hud, #hud { visibility: hidden !important; }'; return 1;`);
const showUi = () => run(`const s = document.getElementById('__psHide'); if (s) s.remove(); return 1;`);
// THE AIM, in the craft frame the decals use (x lateral, y aft, z up, metres; uCraftInv inverted): the centre of the
// meshes of one surface class (0 body, 1 wing, 2 tail; -1 all), an eye offset and a look-at offset from it
const aim = (cls, eye, at) => `const A = window.AEROSKIN, CI = A.aeroDecUniforms(THREE).uCraftInv.value;
  const Mi = new THREE.Matrix4().copy(CI).invert(), M3 = new THREE.Matrix3().setFromMatrix4(Mi);
  const S = window.CAGE_UI_SCENE; S.updateWorldMatrix(true, true); const bb = new THREE.Box3();
  S.traverse(o => { if (!o.isMesh || !o.visible || !o.geometry) return; const ms = Array.isArray(o.material) ? o.material : [o.material];
    const m = ms.find(x => x && x.userData && x.userData.aeroskin); if (!m) return;
    if (${cls} >= 0 && (m.userData.aeroWing | 0) !== ${cls}) return; bb.union(new THREE.Box3().setFromObject(o)); });
  if (bb.isEmpty()) return 'no box ${cls}'; const C = bb.getCenter(new THREE.Vector3());
  const off = v => new THREE.Vector3(v[0], v[1], v[2]).applyMatrix3(M3);
  const EYE = C.clone().add(off(${JSON.stringify(eye)})), AT = C.clone().add(off(${JSON.stringify(at)}));`;
// the shed's own renderer on its own camera: a still, read back in the same task as the draw
const ownShot = async (n, js) => {
  await overlayGone();
  const url = await run(`const R = FLIGHT_PROBE.renderer(), SC = FLIGHT_PROBE.hangarScene(); ${js}
    const c = R.domElement, sz = R.getSize(new THREE.Vector2()), pr = R.getPixelRatio();
    R.setPixelRatio(1); R.setSize(1600, 900, false);
    const cam = new THREE.PerspectiveCamera(38, 1600 / 900, 0.05, 400); cam.position.copy(EYE); cam.lookAt(AT);
    cam.updateMatrixWorld(); R.setRenderTarget(null); R.render(SC, cam); const url = c.toDataURL('image/png');
    R.setPixelRatio(pr); R.setSize(sz.x, sz.y, false); return url;`);
  if (typeof url !== 'string' || !url.startsWith('data:')) { console.log('ownShot ' + n + ': ' + String(url).slice(0, 200)); return null; }
  const f = path.join(OUT, TAG + '_' + n + '.png'); fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); console.log('shot ' + n); return f;
};
// the kit, by name (the table's own order), and a finish = the build's own + these layers, through the editor's door
const paint = layers => run(`const K = AEROSKIN.AERO_KIT, ix = nm => K.findIndex(k => k.name === nm);
  const f = JSON.parse(window.__f0 || 'null') || {}; f.decals = Object.assign({}, f.decals || {});
  const L = ${JSON.stringify(layers)};
  for (let i = 1; i <= 3; i++) for (const k of ['On','Pat','A','B','D','Alp','P','Q','R','S','Clr','Fit','Tgt','Mode','Flip','L','C','W','H','Rot']) delete f.decals['m' + i + k];
  L.forEach((l, i) => { const q = 'm' + (i + 1); for (const k in l) f.decals[q + k] = (k === 'Pat') ? ix(l[k]) : l[k]; });
  CAGE_UI.finishFromSpec(f); CAGE_UI.build();
  await new Promise(r => setTimeout(r, 1200));
  const out = CAGE_UI.finishToSpec(), d = (out && out.decals) || {};
  return [1, 2, 3].map(i => ['L','C','W','H','Tgt','Mode','Fit'].map(k => k + '=' + d['m' + i + k]).join(' '));`);
const RED = 0xc62828, NAVY = 0x1b3a5c, BLUE = 0x1565c0;
const SUN_TAIL = { On: 1, Pat: 'sunburst', A: RED, Clr: 2, P: 14, Q: 0.5, R: 0, S: 0.85, Fit: 1, Tgt: 5, Mode: 0 };
const SUN_WING = { On: 1, Pat: 'sunburst', A: RED, Clr: 2, P: 26, Q: 0.45, R: 0, S: 0.5, Fit: 1, Tgt: 4, Mode: 0 };
const FADE_BODY = { On: 1, Pat: 'fade', A: NAVY, Clr: 2, P: 0, Q: 0.05, R: 0.8, Fit: 1, Tgt: 0, Mode: 1 };
const GRAD_WING = { On: 1, Pat: 'gradient', A: RED, B: 0xffffff, D: BLUE, Clr: 2, P: 0, Q: 0, R: 0.5, S: 1, Fit: 1, Tgt: 4, Mode: 0 };
const garageBoot = async () => {
  await until(`window.BOOT && BOOT.state === 'gone' && window.FLIGHT_PROBE && window.CAGE_UI`, 600000, 'the garage boot');
  await run(`[...document.querySelectorAll('button')].filter(b => /keep the current build/i.test(b.textContent)).forEach(b => b.click()); return 1;`);
  await sleep(2500);
};
const rollOut = async () => {
  await run(`document.getElementById('bGo').click(); return 1;`);
  await until(`window.BOOT && BOOT.state === 'gone' && /Fly the circuit/.test((document.getElementById('bGo') || {}).textContent || '') && window.FLIGHT_PROBE && FLIGHT_PROBE.model()`, 900000, 'the roll-out');
  await frames(60); await sleep(2500);
};
const garageViews = async tag => {
  // the fin from the right, a little aft and above; the wing from above behind the trailing edge; the whole from 3/4
  await ownShot(tag + '_tail', aim(2, [3.4, 1.4, 0.5], [0, 0.1, 0.15]));
  await ownShot(tag + '_wing', aim(1, [2.2, 5.0, 4.6], [2.4, 0, 0]));
  await ownShot(tag + '_three_quarter', aim(-1, [6.5, -5.5, 2.4], [0, 0.3, 0]));
};
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const log = { date: new Date().toISOString(), tag: TAG, notes: [] };
  await garageBoot();
  log.notes.push({ build: await run(`const s = GARAGE_SPEC.get(); return { reg: s.meta && s.meta.reg, kit: AEROSKIN.AERO_KIT.map(k => k.name) };`) });
  await run(`window.__f0 = JSON.stringify(CAGE_UI.finishToSpec()); return 1;`);
  if (STEPS.includes('garage')) try {
    await hideUi();
    await garageViews('0_before');
    log.notes.push({ sunburst_fit: await paint([SUN_TAIL, SUN_WING]) });
    await frames(20); await sleep(600);
    await garageViews('1_sunburst');
    log.notes.push({ fade_fit: await paint([FADE_BODY, GRAD_WING]) });
    await frames(20); await sleep(600);
    await garageViews('2_fade_gradient');
    // THE GLOBAL REPAINT (the user's ruling: patterns kept, the new base under the transparent stops): the base well's
    // own handler (aeroBaseReach), driven like a pick
    await paint([SUN_TAIL, SUN_WING]); await frames(10);
    log.notes.push({ repaint: await run(`const ks = [...document.querySelectorAll('span.k')].filter(k => /^base colour$/.test(k.textContent.trim()));
      const c = ks.length ? ks[0].parentElement.querySelector('input[type=color]') : null; if (!c) return 'no base well';
      c.value = '#2e7d4f'; c.dispatchEvent(new Event('input')); c.dispatchEvent(new Event('change'));
      await new Promise(r => setTimeout(r, 1500)); const d = CAGE_UI.finishToSpec().decals || {};
      return { m1Pat: d.m1Pat, m2Pat: d.m2Pat, m1Clr: d.m1Clr, body: (CAGE_UI.finishToSpec().sections || {}).body };`) });
    await frames(20); await sleep(600);
    await garageViews('3_sunburst_after_repaint');
    await run(`CAGE_UI.finishFromSpec(JSON.parse(window.__f0)); CAGE_UI.build(); return 1;`);
    await showUi();
  } catch (e) { console.log('STEP garage FAILED ' + (e && e.message)); log.notes.push('garage failed: ' + (e && e.message)); }
  if (STEPS.includes('flight')) try {
    log.notes.push({ flight_fit: await paint([SUN_TAIL, SUN_WING]) });
    await run(`GARAGE_SPEC.update({ finish: CAGE_UI.finishToSpec() }); return 1;`); await sleep(2000);
    await rollOut();
    await run(`if (document.getElementById('bPause') && !window.FLYDIY_HELD) document.getElementById('bPause').click(); return 1;`); await frames(4);
    await hideUi();
    await run(`FLIGHT_PROBE.camMode('orbit'); return 1;`);
    log.notes.push({ flownDecals: await run(`const U = AEROSKIN.aeroDecUniforms(THREE); return U.uDecN.value;`) });
    for (const [k, t] of [['bake', 0], ['live', 1]]) {
      await run(`FLOWN_BAKE.FB.hyForce = ${t}; FLIGHT_PROBE.camSet(2.4, 0.32, 9.5); return 1;`);
      await frames(30); await sleep(600);
      await shot('4_flight_' + k);
    }
    await run(`FLOWN_BAKE.FB.hyForce = null; return 1;`);
    await showUi();
  } catch (e) { console.log('STEP flight FAILED ' + (e && e.message)); log.notes.push('flight failed: ' + (e && e.message)); }
  fs.writeFileSync(path.join(OUT, TAG + '_log.json'), JSON.stringify(log, null, 1));
  console.log('done');
})().catch(e => { console.error('pattern_stills: ' + (e && e.stack || e)); process.exit(1); });
