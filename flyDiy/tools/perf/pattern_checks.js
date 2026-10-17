#!/usr/bin/env node
// pattern_checks.js - LIVERY-PATTERNS G2870's live checks on the user's Cub (builds/cub_2026-09-20_corrected.json),
// NUMBERS ONLY (the user's rule since 11 Oct: no evidence stills). Every render is decoded in the page into pixel
// fractions and discarded; nothing but the JSON log is written. Drives a page kept up by tools/live_driver.js.
//   fit:     the fitted L/C/W/H of a sunburst on the tail, one on the wings, a fade on the flank (side box)
//   atlas:   the drawn pages read back: a sunburst with transparent between is ~ray-width opaque and the rest alpha 0;
//            a fade to transparent runs alpha 255 -> 0 along; the time each page took to draw (a knob drag's cost)
//   render:  the fin / wing / flank on the shed renderer, own camera: the share of RED pixels before and after, and
//            after a GLOBAL REPAINT to green (rays stay red, the gaps turn green: the ruling); draw calls unchanged
//   flight:  rolled out with the sunburst: uDecN, and the red share with the far BAKE drawn (hyForce 0) vs live (1)
// Usage: node tools/perf/pattern_checks.js <cmdPort> <outDir> <tag> [steps=fit,atlas,render,flight]
'use strict';
const fs = require('fs'), path = require('path');
const PORT = +(process.argv[2] || 8762), OUT = path.resolve(process.argv[3] || 'pattern_checks'), TAG = process.argv[4] || 'x';
const STEPS = (process.argv[5] || 'fit,atlas,render,flight').split(',');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async (p, body) => { const r = await fetch('http://127.0.0.1:' + PORT + p, { method: 'POST', body }); return r.text(); };
const run = async body => { const t = await post('/run', body); try { return JSON.parse(t); } catch (e) { return t; } };
const until = async (cond, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await run('return !!(' + cond + ');')) === true) return true; await sleep(500); } throw new Error('timed out: ' + what); };
const frames = n => run(`await new Promise(r => { let k = ${n}; const f = () => (--k > 0 ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }); return 1;`);
const overlayGone = () => until(`window.BOOT && BOOT.state === 'gone' && (() => { const b = document.getElementById('boot'); if (!b) return true;
  const s = getComputedStyle(b); return s.display === 'none' || s.visibility === 'hidden' || +s.opacity < 0.01; })()`, 120000, 'the overlay');
// pixel classes, on the decoded frame (sRGB bytes): red rays, the green repaint, the Cub's own yellow
const CLASSIFY = `const cls = d => { let red = 0, grn = 0, yel = 0, n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) { const r = d[i], g = d[i + 1], b = d[i + 2];
      if (r > 120 && g < 0.45 * r && b < 0.45 * r) red++;
      else if (g > 70 && r < 0.75 * g && b < 0.85 * g) grn++;
      else if (r > 140 && g > 0.7 * r && b < 0.55 * r) yel++; }
    return { red: +(red / n).toFixed(4), green: +(grn / n).toFixed(4), yellow: +(yel / n).toFixed(4) }; };`;
// THE AIM, in the craft frame the decals use (x lateral, y aft, z up, metres; uCraftInv inverted): the centre of one
// surface class's meshes (0 body, 1 wing, 2 tail; -1 all) plus an eye and a look-at offset
const aim = (cls, eye, at) => `const CI = AEROSKIN.aeroSharedU(THREE).uCraftInv.value;
  const M3 = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().copy(CI).invert());
  const S = window.CAGE_UI_SCENE; S.updateWorldMatrix(true, true); const bb = new THREE.Box3();
  S.traverse(o => { if (!o.isMesh || !o.visible || !o.geometry) return; const ms = Array.isArray(o.material) ? o.material : [o.material];
    const m = ms.find(x => x && x.userData && x.userData.aeroskin); if (!m) return;
    if (${cls} >= 0 && (m.userData.aeroWing | 0) !== ${cls}) return; bb.union(new THREE.Box3().setFromObject(o)); });
  if (bb.isEmpty()) return 'no box ${cls}'; const C = bb.getCenter(new THREE.Vector3());
  const off = v => new THREE.Vector3(v[0], v[1], v[2]).applyMatrix3(M3);
  const EYE = C.clone().add(off(${JSON.stringify(eye)})), AT = C.clone().add(off(${JSON.stringify(at)}));`;
// the shed's renderer on its own camera, decoded into classes in the same task, the frame discarded
const measure = async js => {
  await overlayGone();
  return run(`const R = FLIGHT_PROBE.renderer(), SC = FLIGHT_PROBE.hangarScene(); ${js} ${CLASSIFY}
    const c = R.domElement, sz = R.getSize(new THREE.Vector2()), pr = R.getPixelRatio();
    R.setPixelRatio(1); R.setSize(800, 450, false);
    const cam = new THREE.PerspectiveCamera(38, 800 / 450, 0.05, 400); cam.position.copy(EYE); cam.lookAt(AT);
    cam.updateMatrixWorld(); R.setRenderTarget(null); R.info.reset(); R.render(SC, cam);
    const calls = R.info.render.calls;
    const cv = document.createElement('canvas'); cv.width = 800; cv.height = 450; const g = cv.getContext('2d');
    g.drawImage(c, 0, 0, 800, 450); const px = g.getImageData(0, 0, 800, 450).data;
    R.setPixelRatio(pr); R.setSize(sz.x, sz.y, false);
    return Object.assign({ calls }, cls(px));`);
};
const VIEWS = { tail: [2, [3.4, 1.4, 0.5], [0, 0.1, 0.15]], wing: [1, [2.2, 5.0, 4.6], [2.4, 0, 0]], flank: [0, [5.0, 0.0, 0.6], [0, 0, 0]] };
const measureAll = async () => { const o = {}; for (const k in VIEWS) o[k] = await measure(aim(...VIEWS[k])); return o; };
// the kit, by name, and a finish = the build's own + these layers, through the editor's own door
const paint = layers => run(`const K = AEROSKIN.AERO_KIT, ix = nm => K.findIndex(k => k.name === nm);
  const f = JSON.parse(window.__f0 || 'null') || {}; f.decals = Object.assign({}, f.decals || {});
  for (let i = 1; i <= 3; i++) for (const k of AEROSKIN.AERO_KIT_FIELDS) delete f.decals['m' + i + k];
  ${JSON.stringify(layers)}.forEach((l, i) => { const q = 'm' + (i + 1); for (const k in l) f.decals[q + k] = (k === 'Pat') ? ix(l[k]) : l[k]; });
  CAGE_UI.finishFromSpec(f); CAGE_UI.build();
  await new Promise(r => setTimeout(r, 1500));
  const d = (CAGE_UI.finishToSpec() || {}).decals || {};
  return [1, 2, 3].map(i => { const q = 'm' + i; return d[q + 'On'] ? { pat: K[d[q + 'Pat']] && K[d[q + 'Pat']].name, tgt: d[q + 'Tgt'],
    mode: d[q + 'Mode'], fit: d[q + 'Fit'], L: d[q + 'L'], C: d[q + 'C'], W: d[q + 'W'], H: d[q + 'H'] } : null; }).filter(Boolean);`);
const RED = 0xd01818, NAVY = 0x1b3a5c;
const SUN_TAIL = { On: 1, Pat: 'sunburst', A: RED, Clr: 2, P: 14, Q: 0.5, R: 0, S: 0.85, Fit: 1, Tgt: 5, Mode: 0 };
const SUN_WING = { On: 1, Pat: 'sunburst', A: RED, Clr: 2, P: 26, Q: 0.45, R: 0, S: 0.5, Fit: 1, Tgt: 4, Mode: 0 };
const FADE_FLANK = { On: 1, Pat: 'fade', A: RED, Clr: 2, P: 0, Q: 0.05, R: 0.8, Fit: 1, Tgt: 0, Mode: 1 };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const log = { date: new Date().toISOString(), tag: TAG, steps: STEPS };
  const save = () => fs.writeFileSync(path.join(OUT, TAG + '_log.json'), JSON.stringify(log, null, 1));
  await until(`window.BOOT && BOOT.state === 'gone' && window.FLIGHT_PROBE && window.CAGE_UI && window.AEROSKIN`, 600000, 'the garage boot');
  await run(`[...document.querySelectorAll('button')].filter(b => /keep the current build/i.test(b.textContent)).forEach(b => b.click()); return 1;`);
  await sleep(3000);
  log.build = await run(`const s = GARAGE_SPEC.get(); return { reg: s.meta && s.meta.reg, kit: AEROSKIN.AERO_KIT.map(k => k.name), decN0: AEROSKIN.aeroSharedU(THREE).uDecN.value };`);
  await run(`window.__f0 = JSON.stringify(CAGE_UI.finishToSpec()); return 1;`);
  try {
    if (STEPS.includes('render')) log.before = await measureAll();
    const SET = STEPS.includes('nofade') ? [SUN_TAIL, SUN_WING] : [SUN_TAIL, SUN_WING, FADE_FLANK];   // nofade: the rays alone (the repaint's red share)
    if (STEPS.includes('fit')) log.fitSun = await paint(SET);
    else await paint(SET);
    await frames(20);
    if (STEPS.includes('atlas')) log.atlas = await run(`const A = AEROSKIN, cv = A.aeroAtlas(THREE).image, N = A.AERO_ATLAS_N, P = cv.width / N;
      const page = p => cv.getContext('2d').getImageData((p % N) * P, Math.floor(p / N) * P, P, P);
      const st = p => { const im = page(p), d = im.data; let z = 0, o = 0; const col = [0, 0, 0, 0, 0];
        for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) { const a = d[(y * P + x) * 4 + 3]; if (a < 8) z++; if (a > 247) o++;
          col[Math.min(4, Math.floor(x / P * 5))] += a; }
        const n = P * P; return { clear: +(z / n).toFixed(3), opaque: +(o / n).toFixed(3), alphaByFifth: col.map(s => Math.round(s / (n / 5))) }; };
      const out = { px: P, sunTail: st(3), sunWing: st(4), fade: st(5) };
      // a knob drag's cost: one page redraw (the draw + the dilation), each pattern, signature forced
      const dd = (CAGE_UI.finishToSpec() || {}).decals || {}, D = Object.assign({}, A.AERO_DEC_DEF); for (const k in dd) if (dd[k] != null) D[k] = dd[k]; const L = A.aeroKitLayers(D);
      out.redrawMs = {};
      for (const nm of ['cheat line', 'fade', 'gradient', 'sunburst']) {
        const l = Object.assign({}, L[0], { pat: A.AERO_KIT.findIndex(k => k.name === nm), p: null, q: null });
        l.p = A.aeroKitKnob(A.AERO_KIT[l.pat], 0, null) + 1e-6 * Math.random(); l.q = A.aeroKitKnob(A.AERO_KIT[l.pat], 1, null);
        const t0 = performance.now(); A.aeroKitDraw(THREE, l); out.redrawMs[nm] = +(performance.now() - t0).toFixed(1); }
      A.aeroKitDraw(THREE, Object.assign({}, L[0], { p: L[0].p + 1e-6 })); A.aeroKitDraw(THREE, L[0]);   // page 3 back
      return out;`);
    save();
    if (STEPS.includes('render')) {
      await frames(10);
      log.after = await measureAll();
      // THE GLOBAL REPAINT through the base well's own handler (aeroBaseReach): the user's ruling keeps the patterns
      log.repaint = await run(`const ks = [...document.querySelectorAll('span.k')].filter(k => /^base colour$/.test(k.textContent.trim()));
        const c = ks.length ? ks[0].parentElement.querySelector('input[type=color]') : null; if (!c) return 'no base well';
        c.value = '#2e8b3e'; c.dispatchEvent(new Event('input')); c.dispatchEvent(new Event('change'));
        await new Promise(r => setTimeout(r, 1500)); const f = CAGE_UI.finishToSpec(), d = f.decals || {};
        return { kitKept: [d.m1On, d.m2On, d.m3On, d.m1Clr], body: (f.sections || {}).body };`);
      await frames(10);
      log.afterRepaint = await measureAll();
    }
    save();
    await run(`CAGE_UI.finishFromSpec(JSON.parse(window.__f0)); CAGE_UI.build(); return 1;`);
  } catch (e) { log.garageError = String(e && e.message); console.log('garage FAILED ' + log.garageError); }
  if (STEPS.includes('flight')) try {
    await paint([SUN_TAIL, SUN_WING]);
    await run(`GARAGE_SPEC.update({ finish: CAGE_UI.finishToSpec() }); return 1;`); await sleep(2000);
    await run(`document.getElementById('bGo').click(); return 1;`);
    await until(`window.BOOT && BOOT.state === 'gone' && /Fly the circuit/.test((document.getElementById('bGo') || {}).textContent || '') && window.FLIGHT_PROBE && FLIGHT_PROBE.model()`, 900000, 'the roll-out');
    await frames(60); await sleep(2500); await overlayGone();
    await run(`if (document.getElementById('bPause') && !window.FLYDIY_HELD) document.getElementById('bPause').click(); FLIGHT_PROBE.camMode('orbit'); return 1;`);
    log.flight = { decN: await run(`return AEROSKIN.aeroSharedU(THREE).uDecN.value;`) };
    for (const [k, t] of [['bake', 0], ['live', 1]]) {
      await run(`FLOWN_BAKE.FB.hyForce = ${t}; FLIGHT_PROBE.camSet(2.4, 0.32, 9.5); return 1;`);
      await frames(30); await sleep(600);
      // the app's own frame, copied in the same task as each draw to the canvas (no preserveDrawingBuffer): the
      // render is wrapped for three frames and the last on-screen draw is the one decoded
      log.flight[k] = await run(`${CLASSIFY} const R = FLIGHT_PROBE.renderer(), c = R.domElement, orig = R.render;
        const cv = document.createElement('canvas'); cv.width = 800; cv.height = 450; const g = cv.getContext('2d'); let got = 0;
        R.render = function (s, cam) { orig.call(this, s, cam); if (this.getRenderTarget() === null) { g.drawImage(c, 0, 0, 800, 450); got++; } };
        try { await new Promise(r => { let k = 3; const f = () => (--k > 0 ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }); }
        finally { R.render = orig; }
        return Object.assign({ draws: got }, cls(g.getImageData(0, 0, 800, 450).data));`);
    }
    await run(`FLOWN_BAKE.FB.hyForce = null; return 1;`);
  } catch (e) { log.flightError = String(e && e.message); console.log('flight FAILED ' + log.flightError); }
  save();
  console.log(JSON.stringify(log));
  console.log('done');
})().catch(e => { console.error('pattern_checks: ' + (e && e.stack || e)); process.exit(1); });
