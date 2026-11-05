#!/usr/bin/env node
// livery5_shot.js - LIVERY-5's pictures and its ink check, from a cloud session (4 Nov). One headless Chromium on
// SwiftShader (no graphics card), dev.html's garage (?profile=phone: no world), the user's Cub imported through the
// fleet's own Import (#gFile). Every layer goes on through the editor's own door (CAGE_UI.finishFromSpec + build).
//   1 THE INK: the panel's own 'ink' well (the registration's colour input) set to a colour and its input event fired,
//     as the player does; then the export's regCol, atlas page 0's opaque pixels, and a still
//   2 the stills: the registration with no outline (side), stars hexagonal on the body, dots on shifted rows on the wing
//     (from above), a flag on the fin as a rectangle and as a disc, and the far flank of the rectangle
//   node flyDiy/tools/livery5_shot.js --out <dir> [--build <cub.json>] [--size 1280x800] -> <dir>/*.jpg (q85),
//   <dir>/livery5_log.json; LIVERY5_SHOT {json} on stdout. A page error or an unchanged ink is a FAIL line, exit 1.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), net = require('net');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const FLY = path.resolve(__dirname, '..'), REPO = path.resolve(FLY, '..');
const T0 = Date.now(), log = (...a) => console.log('[' + ((Date.now() - T0) / 1000).toFixed(1).padStart(6) + ' s]', ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });

(async () => {
  const out = path.resolve(opt('out', 'livery5_shots'));
  const build = path.resolve(opt('build', path.join(FLY, 'builds', 'cub_2026-09-20_corrected.json')));
  const size = opt('size', '1280x800').split('x').map(Number);
  fs.mkdirSync(out, { recursive: true });
  const PW = require('playwright');
  const R = { fails: [], errors: [], shots: {} };
  const fail = w => { R.fails.push(w); log('FAIL ' + w); };
  const port = await freePort();
  const serve = spawn(process.execPath, [path.join(FLY, 'tools', '_serve.js'), String(port), REPO], { stdio: 'ignore' });
  let browser = null;
  try {
    await sleep(1500);
    browser = await PW.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    const page = await browser.newPage({ viewport: { width: size[0], height: size[1] } });
    page.setDefaultTimeout(2400 * 1000);
    page.on('pageerror', e => { R.errors.push(String(e.message || e).slice(0, 300)); log('PAGEERR', String(e.message).slice(0, 200)); });
    page.on('dialog', d => d.accept().catch(() => {}));
    // a builder that catches its own error logs it (CAGE_UI's 'the finish panels did not build'): counted as one
    page.on('console', m => { if (m.type() === 'error' && /CAGE_UI|ReferenceError|TypeError/.test(m.text())) { R.errors.push('console: ' + m.text().slice(0, 300)); log('CONSOLEERR', m.text().slice(0, 200)); } });
    await page.addInitScript('window.__f=0;(function t(){window.__f++;requestAnimationFrame(t)})();');
    await page.goto('http://localhost:' + port + '/flyDiy/dev.html?profile=phone&gfx=laptop&intro=0');
    await page.waitForFunction(() => window.BOOT && BOOT.state === 'gone' && !BOOT.current && window.CAGE_UI && window.FLIGHT_PROBE && window.AEROSKIN,
      null, { polling: 2000 });
    log('garage up');
    R.renderer = await page.evaluate(() => { const gl = FLIGHT_PROBE.renderer().getContext(); const e = gl.getExtension('WEBGL_debug_renderer_info');
      return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); });
    R.atlasPx = await page.evaluate(() => AEROSKIN.aeroAtlas(THREE).image.width);
    log('renderer', R.renderer, 'atlas', R.atlasPx);
    await page.evaluate(() => { for (const x of document.querySelectorAll('.dfClose')) try { x.click(); } catch (e) {} });
    const frames = async n => { const f0 = await page.evaluate(() => window.__f); await page.waitForFunction(f => window.__f >= f, f0 + n, { polling: 200 }); };
    await page.setInputFiles('#gFile', build);
    await page.waitForFunction(() => { const s = GARAGE_SPEC.get(); return s && s.meta && /cub/i.test(JSON.stringify(s.meta)); }, null, { polling: 1000, timeout: 180000 }).catch(() => {});
    await sleep(4000); await frames(4);
    R.reg = await page.evaluate(() => { const s = GARAGE_SPEC.get(); return { reg: s.meta && s.meta.reg, trim: s.paint && s.paint.trim,
      decals: (s.finish && s.finish.decals) || null }; });
    log('build', JSON.stringify(R.reg).slice(0, 200));
    const f0 = await page.evaluate(() => JSON.stringify(CAGE_UI.finishToSpec() || {}));

    // ---- 1 THE INK, through the panel's own well -------------------------------------------------------------
    const page0 = () => page.evaluate(() => {
      const cv = AEROSKIN.aeroAtlas(THREE).image, P = cv.width / AEROSKIN.AERO_ATLAS_N;
      const t = document.createElement('canvas'); t.width = t.height = P; const tg = t.getContext('2d', { willReadFrequently: true });
      tg.drawImage(cv, 0, 0, P, P, 0, 0, P, P);
      const d = tg.getImageData(0, 0, P, P).data, h = new Map(); let n = 0, top = null, tn = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 127) { n++; const k = (d[i] << 16 | d[i + 1] << 8 | d[i + 2]) >>> 0; const v = (h.get(k) || 0) + 1; h.set(k, v); if (v > tn) { tn = v; top = k; } }
      return { opaque: n, top: top == null ? null : '#' + top.toString(16).padStart(6, '0'), share: n ? +(tn / n).toFixed(3) : 0 }; });
    R.ink = { before: await page0() };
    const well = await page.evaluate(() => {
      const ks = [...document.querySelectorAll('span.k')].filter(k => k.textContent.trim() === 'ink');
      const r = ks.map(k => k.parentElement).find(p => p && p.querySelector('input[type=color]'));
      if (!r) return null; const c = r.querySelector('input[type=color]'); c.id = '__ink'; return c.value; });
    if (!well) fail('the ink well is not in the panel');
    else {
      R.ink.wellBefore = well;
      await page.evaluate(() => { const c = document.getElementById('__ink'); c.value = '#c81e1e'; c.dispatchEvent(new Event('input', { bubbles: true })); });
      await sleep(800); await frames(3);
      R.ink.regCol = await page.evaluate(() => ((CAGE_UI.finishToSpec() || {}).decals || {}).regCol);
      R.ink.after = await page0();
      if (R.ink.regCol !== 0xc81e1e) fail('the ink well did not reach the export (regCol ' + R.ink.regCol + ')');
      if (R.ink.after.top !== '#c81e1e') fail('the ink well did not repaint atlas page 0 (top ' + R.ink.after.top + ')');
      log('ink', JSON.stringify(R.ink));
    }

    const LIGHT = argv.includes('--light');
    // ---- 2 THE STILLS -----------------------------------------------------------------------------------------
    const clsBox = cls => page.evaluate(cls => { const S = window.CAGE_UI_SCENE; S.updateWorldMatrix(true, true); const bb = new THREE.Box3();
      S.traverse(o => { if (!o.isMesh || !o.visible || !o.geometry) return; const ms = Array.isArray(o.material) ? o.material : [o.material];
        const m = ms.find(x => x && x.userData && x.userData.aeroskin); if (!m) return;
        if (cls >= 0 && (m.userData.aeroWing | 0) !== cls) return; bb.union(new THREE.Box3().setFromObject(o)); });
      return bb.isEmpty() ? null : { c: bb.getCenter(new THREE.Vector3()).toArray(), s: bb.getSize(new THREE.Vector3()).toArray(), max: bb.max.toArray() }; }, cls);
    const paint = layers => page.evaluate(async ([layers, f0]) => {
      const K = AEROSKIN.AERO_KIT, ix = nm => K.findIndex(k => k.name === nm);
      const f = JSON.parse(f0); f.decals = Object.assign({}, f.decals || {});
      for (const k of Object.keys(f.decals)) if (/^m[1-5]/.test(k)) delete f.decals[k];
      for (const [i, l] of Object.entries(layers)) for (const k in l) f.decals['m' + i + k] = k === 'Pat' ? ix(l[k]) : l[k];
      CAGE_UI.finishFromSpec(f); CAGE_UI.build();
      await new Promise(r => setTimeout(r, 2500));
      return AEROSKIN.aeroSharedU(THREE).uDecN.value; }, [layers, f0]);
    const shoot = async (name, cam, aimAt) => {
      const tgt = await page.evaluate(() => FLIGHT_PROBE.camGet().target);
      const pan = aimAt ? aimAt.map((x, i) => x - tgt[i]) : [0, 0, 0];
      await page.evaluate(([c, p]) => { FLIGHT_PROBE.pan(p[0], p[1], p[2]); FLIGHT_PROBE.camSet(c[0], c[1], c[2]); FLIGHT_PROBE.camSettle(); }, [cam, pan]);
      await page.evaluate(() => { const sc = FLIGHT_PROBE.hangarScene(); const hide = new Set();
        sc.traverse(o => { if (o.isSprite && o.parent && o.parent !== sc && !o.parent.getObjectById(CAGE_UI_SCENE.id)) hide.add(o.parent); });
        for (const o of hide) o.visible = false; });
      await frames(3);
      const clip = await page.evaluate(() => { const c = document.getElementById('c'); const r = c.getBoundingClientRect();
        window.__hid = []; for (const e of document.body.querySelectorAll('*')) { if (e === c || e.contains(c)) continue;
          if (getComputedStyle(e).position === 'fixed' || getComputedStyle(e).position === 'absolute') { window.__hid.push(e); e.style.visibility = 'hidden'; } }
        return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) }; });
      await frames(2);
      const to = path.join(out, name + '.jpg');
      await page.screenshot({ clip, path: to, type: 'jpeg', quality: 85, timeout: 600000 });
      await page.evaluate(() => { for (const e of window.__hid || []) e.style.removeProperty('visibility'); FLIGHT_PROBE.pan(0, 0, 0); });
      R.shots[name] = { cam, aim: aimAt }; log('shot', name);
    };
    const NAVY = 0x1b3a5c, RED = 0xc81e1e, WHITE = 0xf4f2ea;
    const body = await clsBox(0), wing = await clsBox(1), tail = await clsBox(2);
    R.boxes = { body, wing, tail };
    const span = Math.max(...wing.s);
    if (LIGHT) {
      const usa = { On: 1, Pat: 'flag', P: 16, Q: 0, R: 0.8, Fit: 1, Tgt: 6, Mode: 1 };
      await paint({});
      await shoot('cub_registration_red_ink', [-Math.PI / 2, 0.04, 0.32 * span], [body.c[0], body.c[1], body.c[2] - 0.15 * span]);
      R.decN = { far: await paint({ 4: usa }) };
      await shoot('flag_fin_rectangle_far_flank', [Math.PI / 2, 0.08, 0.32 * span], [tail.c[0], tail.c[1] + 0.25 * tail.s[1], tail.c[2]]);
      throw 'light';
    }
    // the registration, no outline (the ink back to following the trim first)
    await paint({});
    await page.evaluate(() => { const c = document.getElementById('__ink'); if (!c) return; const k = c.parentElement.querySelector('span.k'); k.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); });
    await sleep(800);
    await shoot('cub_registration_no_outline', [-Math.PI / 2, 0.05, 0.55 * span], body.c);
    // stars, hexagonal, on the body (side box, fitted)
    R.decN = {};
    R.decN.stars = await paint({ 1: { On: 1, Pat: 'pattern', P: 0, Q: 2, R: 0.07, S: 2.3, A: NAVY, D: NAVY, Clr: 2, Fit: 1, Tgt: 0, Mode: 1 } });
    await shoot('stars_hexagonal_body', [-Math.PI / 2 - 0.35, 0.12, 0.85 * span], body.c);
    // dots on shifted rows on the wing (plan, fitted), from above
    R.decN.dots = await paint({ 2: { On: 1, Pat: 'pattern', P: 1, Q: 1, R: 0.05, S: 2.2, A: RED, D: RED, Clr: 2, Fit: 1, Tgt: 4, Mode: 2 } });
    await shoot('dots_shifted_rows_wing', [-2.6, 1.05, 0.95 * span], wing.c);
    // a flag on the fin: rectangle, disc (layers 4 and 5: the images' old pages), and the far flank
    const finAt = [tail.c[0], tail.c[1] + 0.25 * tail.s[1], tail.c[2]];
    const usa = { On: 1, Pat: 'flag', P: 16, Q: 0, R: 0.8, Fit: 1, Tgt: 6, Mode: 1 };
    R.decN.flagRect = await paint({ 4: usa });
    await shoot('flag_fin_rectangle', [-Math.PI / 2, 0.08, 0.32 * span], finAt);
    await shoot('flag_fin_rectangle_far_flank', [Math.PI / 2, 0.08, 0.32 * span], finAt);
    R.decN.flagDisc = await paint({ 5: Object.assign({}, usa, { Q: 2, P: 18 }) });
    await shoot('flag_fin_disc_alaska', [-Math.PI / 2, 0.08, 0.32 * span], finAt);
    R.decN.five = await paint({ 1: { On: 1, Pat: 'pattern', P: 0, Q: 2, R: 0.07, S: 2.3, A: NAVY, D: NAVY, Clr: 2, Fit: 1, Tgt: 0, Mode: 1 },
      2: { On: 1, Pat: 'pattern', P: 1, Q: 1, R: 0.05, S: 2.2, A: RED, D: RED, Clr: 2, Fit: 1, Tgt: 4, Mode: 2 },
      3: { On: 1, Pat: 'tartan', Fit: 1, Tgt: 7, Mode: 2, A: 0x1d4d2b, B: RED, D: WHITE },
      4: usa, 5: { On: 1, Pat: 'flag', P: 0, Q: 1, R: 0.9, L: 0.6, C: 0.25, W: 0.45, H: 0.3, Tgt: 0, Mode: 0 } });
    await shoot('five_layers_three_quarter', [-2.4, 0.3, 1.0 * span], null);
    if (R.decN.five < 6) fail('five layers + the registration did not reach the block (' + R.decN.five + ')');
    if (R.errors.length) fail(R.errors.length + ' page error(s)');
  } catch (e) { if (e !== 'light') fail('threw: ' + (e && e.stack || e)); else if (R.errors.length) fail(R.errors.length + ' page error(s)'); }
  finally { if (browser) await browser.close().catch(() => {}); serve.kill(); }
  fs.writeFileSync(path.join(out, argv.includes('--light') ? 'livery5_light_log.json' : 'livery5_log.json'), JSON.stringify(R, null, 1));
  console.log('LIVERY5_SHOT ' + JSON.stringify({ fails: R.fails, ink: R.ink, decN: R.decN, renderer: R.renderer }));
  process.exit(R.fails.length ? 1 : 0);
})();
