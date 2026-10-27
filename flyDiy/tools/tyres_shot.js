#!/usr/bin/env node
// tyres_shot.js - THE TYRES PROPOSAL ON THE BENCH, BEFORE AND AFTER, FROM A CLOUD SESSION (G3851, 2026-10-27)
//
// The user, 27 Oct: "fitting huge wheels is really all the rage today, so these need to look good" - "don't wanna
// wait": renders today. One headless Chromium on SwiftShader (no graphics card), the phone profile's garage
// (?profile=phone: no world), dev.html (the loose tools/_gear_gen.js, where the proposal lives). Each build comes in
// through the fleet's own Import (#gFile), then is drawn TWICE with the same camera: GEAR_GEN.TYRE_LOOK.on = 0
// (today's G3548 wheel) and = 1 (the proposal, futureDesigns/TYRES-2026-10.md), CAGE_UI.build() between them.
//
//   node flyDiy/tools/tyres_shot.js --out <dir> --build <a.json>[,<b.json>...] [--views q,s,wheel,tail]
//        [--size 1280x960] [--secs 2400]
//   views: q 3/4 front, s side (the editor's presets, the distance scaled to the build's box), wheel a close-up of
//   the main wheel nearer the 3/4 eye, tail the tail/nose wheel's (the station on the centreline)
//   -> <dir>/<build>_<view>_before.png, _after.png, _pair.png (before | after, labelled), and TYRES_SHOT {json}
//
// THE ASSERTS (each failure a `FAIL` line and exit 1; a failed view writes nothing): the import raised no alert and
// the page's cage is the file's (>= 90 % of its numeric rows equal); the eye is where it was set (camGet); the frame is
// not one flat colour and the aeroplane is in it (hiding the build changes > 2 % of the pixels); the proposal changed
// the drawing (the scene's triangle count differs between before and after). Composites are drawn in the same page.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const FLY = path.resolve(__dirname, '..'), REPO = path.resolve(FLY, '..');
const T0 = Date.now();
const log = (...a) => console.log('[' + ((Date.now() - T0) / 1000).toFixed(1).padStart(6) + ' s]', ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });
function findPlaywright() {
  for (const p of ['playwright', '/opt/node-tools/node_modules/playwright', 'playwright-core']) { try { return require(p); } catch (e) {} }
  return null;
}

// the editor's presets (app.js camera(k)): az, el, dist for a ~7 m aeroplane; scaled to the build's box
const PRESET = { q: [-2.5, 0.25, 12], s: [-Math.PI / 2, 0.06, 13] };

(async () => {
  const out = path.resolve(opt('out', 'tyres_shots'));
  const builds = (opt('build', '') || '').split(',').filter(Boolean);
  const views = (opt('views', 'q,s,wheel')).split(',').filter(Boolean);
  const size = (opt('size', '1280x960')).split('x').map(Number);
  const secs = +opt('secs', 2400);
  if (!builds.length) { console.log('FAIL --build <file.json>[,...]'); process.exit(1); }
  for (const b of builds) if (!fs.existsSync(b)) { console.log('FAIL no such build ' + b); process.exit(1); }
  const PW = findPlaywright();
  if (!PW) { console.log('FAIL no playwright here'); process.exit(2); }
  fs.mkdirSync(out, { recursive: true });
  const R = { builds: [], fails: [], errors: [], dialogs: [] };
  const fail = why => { R.fails.push(why); log('FAIL ' + why); };
  const port = await freePort();
  const serve = spawn(process.execPath, [path.join(FLY, 'tools', '_serve.js'), String(port), REPO], { stdio: 'ignore' });
  let browser = null;
  try {
    await sleep(1500);
    browser = await PW.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    const page = await browser.newPage({ viewport: { width: size[0], height: size[1] } });
    page.setDefaultTimeout(secs * 1000);
    page.on('pageerror', e => { R.errors.push(String(e.message || e).slice(0, 300)); log('PAGEERR', String(e.message).slice(0, 200)); });
    page.on('dialog', d => { R.dialogs.push(d.type() + ': ' + d.message()); d.accept().catch(() => {}); });
    await page.addInitScript('window.__shotFrames=0;(function t(){window.__shotFrames++;requestAnimationFrame(t)})();' +
      'document.addEventListener("DOMContentLoaded",()=>{const s=document.createElement("style");s.textContent="*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}";document.head.appendChild(s);});');
    const url = 'http://localhost:' + port + '/flyDiy/dev.html?profile=phone&gfx=laptop&intro=0';
    log('page', url);
    await page.goto(url);
    await page.waitForFunction(() => window.BOOT && BOOT.state === 'gone' && !BOOT.current && window.CAGE_UI && window.FLIGHT_PROBE && window.GEAR_GEN,
      null, { timeout: secs * 1000, polling: 2000 });
    log('garage up');
    if (!(await page.evaluate(() => !!(GEAR_GEN.TYRE_LOOK && GEAR_GEN.tyreLook)))) throw new Error('this _gear_gen.js has no TYRE_LOOK (the proposal is not here)');
    await page.evaluate(() => { for (const x of document.querySelectorAll('.dfClose')) try { x.click(); } catch (e) {} });
    const frames = async n => { const f0 = await page.evaluate(() => window.__shotFrames); await page.waitForFunction(f => window.__shotFrames >= f, f0 + n, { polling: 200 }); };
    const tris = () => page.evaluate(() => { let n = 0; CAGE_UI_SCENE.traverse(o => { if (o.isMesh && o.geometry) { const g = o.geometry; n += g.index ? g.index.count / 3 : (g.attributes.position ? g.attributes.position.count / 3 : 0); } }); return n; });
    const settle = async () => { let prev = null; for (let i = 0; i < 15; i++) { await frames(2); const t = await tris(); if (t === prev) return t; prev = t; } return prev; };

    for (const file of builds) {
      const base = path.basename(file).replace(/\.json$/i, '');
      const BR = { file, views: {} }; R.builds.push(BR);
      const want = JSON.parse(fs.readFileSync(file, 'utf8')).spec.cage;
      const d0 = R.dialogs.length;
      await page.evaluate(() => { GEAR_GEN.TYRE_LOOK.on = 0; });
      await page.setInputFiles('#gFile', path.resolve(file));
      const keys = Object.keys(want).filter(k => typeof want[k] === 'number');
      let same = 0;
      for (let i = 0; i < 120; i++) {
        await sleep(1000);
        if (R.dialogs.length > d0) break;
        const got = await page.evaluate(() => { const s = GARAGE_SPEC.get(); return s && s.cage; }).catch(() => ({})) || {};
        same = keys.filter(k => typeof got[k] === 'number' && Math.abs(got[k] - want[k]) <= 1e-6 * Math.max(1, Math.abs(want[k]))).length;
        if (same / keys.length >= 0.9) break;
      }
      BR.cageSame = same + '/' + keys.length;
      if (R.dialogs.length > d0) { fail(base + ': the import said ' + R.dialogs.slice(d0).join(' / ')); continue; }
      if (same / keys.length < 0.9) { fail(base + ': the page\'s build is not the file\'s (' + BR.cageSame + ')'); continue; }
      BR.trisBefore = await settle();
      // THE CAMERAS, measured once on the BEFORE drawing and used verbatim for both: the build's box scales the
      // presets; the wheels' centres are the gear's contacts in the scene's frame
      const geo = await page.evaluate(() => {
        FLIGHT_PROBE.pan(0, 0, 0); FLIGHT_PROBE.camSettle();
        const g = FLIGHT_PROBE.camGet(), b = new THREE.Box3().setFromObject(CAGE_UI_SCENE), sz = b.getSize(new THREE.Vector3());
        CAGE_UI_SCENE.updateMatrixWorld(true);
        const wh = (CAGE_GEAR.contacts || []).filter(c => c.p).map(c => ({ R: c.R || (c.st && c.st.R), w: CAGE_UI_SCENE.localToWorld(new THREE.Vector3(...c.p)).toArray(), x: c.p[0] }));
        return { target: g.target, span: Math.max(sz.x, sz.z), size: sz.toArray(), wh, fov: g.fov };
      });
      BR.span = +geo.span.toFixed(2); BR.wheels = geo.wh.map(w => ({ R: w.R, at: w.w.map(v => +v.toFixed(3)) }));
      const k = Math.max(0.55, geo.span / 10.5);   // the presets frame a ~10 m span
      const cams = {};
      for (const v of views) {
        if (PRESET[v]) cams[v] = { az: PRESET[v][0], el: PRESET[v][1], dist: PRESET[v][2] * k, pan: [0, 0, 0] };
        else if (v === 'wheel' || v === 'tail') {
          const mains = geo.wh.filter(w => Math.abs(w.x) > 0.05), tails = geo.wh.filter(w => Math.abs(w.x) <= 0.05);
          const az = v === 'wheel' ? -2.2 : -2.0, el = 0.30;   // high enough to see the crown's tread
          // the main nearer the eye at this azimuth (the eye sits at target + dist (sin az cos el, ., cos az cos el))
          const eyeDir = [Math.sin(az), 0, Math.cos(az)];
          const pick = v === 'wheel' ? mains.sort((a, b) => (b.w[0] * eyeDir[0] + b.w[2] * eyeDir[2]) - (a.w[0] * eyeDir[0] + a.w[2] * eyeDir[2]))[0] : tails[0];
          if (!pick) { fail(base + ' ' + v + ': no such wheel on this build'); continue; }
          cams[v] = { az, el, dist: Math.max(0.55, pick.R * 7.0), pan: pick.w.map((x, i) => x - geo.target[i]), R: pick.R };
        } else fail('unknown view ' + v);
      }
      BR.cams = cams;
      for (const variant of ['before', 'after']) {
        if (variant === 'after') {
          await page.evaluate(() => { GEAR_GEN.TYRE_LOOK.on = 1; CAGE_UI.build(); });
          BR.trisAfter = await settle();
          if (BR.trisAfter === BR.trisBefore) fail(base + ': the proposal changed nothing in the scene (' + BR.trisAfter + ' triangles both ways)');
        }
        for (const [v, c] of Object.entries(cams)) {
          const VR = BR.views[v] = BR.views[v] || {};
          await page.evaluate(c => { FLIGHT_PROBE.pan(0, 0, 0); FLIGHT_PROBE.pan(c.pan[0], c.pan[1], c.pan[2]); FLIGHT_PROBE.camSet(c.az, c.el, c.dist); FLIGHT_PROBE.camSettle(); }, c);
          // the garage's CG / neutral-point labels and posts (app.js buildIndicators' group: the sprites' parent) are
          // not the picture: hidden for the still
          await page.evaluate(() => { const sc = FLIGHT_PROBE.hangarScene && FLIGHT_PROBE.hangarScene(); if (!sc) return; const hide = new Set();
            sc.traverse(o => { if (o.isSprite && o.parent && o.parent !== sc && !o.parent.getObjectById(CAGE_UI_SCENE.id)) hide.add(o.parent); });
            for (const o of hide) o.visible = false; });
          await frames(2);
          const g = await page.evaluate(() => FLIGHT_PROBE.camGet());
          if (Math.abs(g.az - c.az) > 0.01 || Math.abs(g.el - c.el) > 0.01 || Math.abs(g.dist - c.dist) / c.dist > 0.05) { fail(base + ' ' + v + ' ' + variant + ': the eye is not where it was set (' + [g.az, g.el, g.dist].map(x => x.toFixed(3)) + ')'); continue; }
          VR.eye = { az: +g.az.toFixed(4), el: +g.el.toFixed(4), dist: +g.dist.toFixed(3), target: g.target.map(x => +x.toFixed(3)) };
          const clip = await page.evaluate(() => { const c = document.getElementById('c'); const r = c.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) }; });
          await page.evaluate(() => { const c = document.getElementById('c'); window.__shotHid = []; for (const e of document.body.querySelectorAll('*')) { if (e === c || e.contains(c) || (e.closest('svg') && e.tagName !== 'svg')) continue; if (getComputedStyle(e).visibility !== 'hidden') { window.__shotHid.push([e, e.style.visibility]); e.style.setProperty('visibility', 'hidden', 'important'); } } });
          await frames(1);
          const shotA = await page.screenshot({ clip, timeout: 300000 });
          // the frame check (the aeroplane is in it) on the BEFORE still; the after one has the same eye
          let shotB = null;
          if (variant === 'before') {
            await page.evaluate(() => { CAGE_UI_SCENE.visible = false; });
            await frames(2);
            shotB = await page.screenshot({ clip, timeout: 300000 });
          }
          await page.evaluate(() => { CAGE_UI_SCENE.visible = true; for (const [e, v] of (window.__shotHid || [])) { e.style.removeProperty('visibility'); if (v) e.style.visibility = v; } window.__shotHid = []; });
          const P = await page.evaluate(async ([a, b]) => {
            const img = s => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/png;base64,' + s; });
            const px = async s => { const i = await img(s); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height).data; };
            const A = await px(a), B = b ? await px(b) : null, n = A.length / 4; const hist = new Map(); let top = 0, on = 0;
            for (let i = 0; i < A.length; i += 4) {
              const k = (A[i] >> 3) << 10 | (A[i + 1] >> 3) << 5 | (A[i + 2] >> 3); const v = (hist.get(k) || 0) + 1; hist.set(k, v); if (v > top) top = v;
              if (B && Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])) > 12) on++;
            }
            return { topShare: +(top / n).toFixed(4), craftShare: B ? +(on / n).toFixed(4) : null };
          }, [shotA.toString('base64'), shotB ? shotB.toString('base64') : null]);
          VR[variant] = P;
          if (P.topShare > 0.97) { fail(base + ' ' + v + ' ' + variant + ': one flat colour'); continue; }
          if (variant === 'before' && !(P.craftShare > 0.02)) { fail(base + ' ' + v + ' ' + variant + ': the aeroplane is not in the frame (' + P.craftShare + ')'); continue; }
          const to = path.join(out, base + '_' + v + '_' + variant + '.png');
          fs.writeFileSync(to, shotA);
          log(base, v, variant, 'ok' + (P.craftShare != null ? ' - aeroplane ' + (100 * P.craftShare).toFixed(1) + ' % of the frame' : ''), '->', path.relative(process.cwd(), to));
        }
      }
      await page.evaluate(() => { GEAR_GEN.TYRE_LOOK.on = 0; CAGE_UI.build(); });
      // THE COMPOSITES: before | after, the same eye, labelled
      for (const v of Object.keys(cams)) {
        const fa = path.join(out, base + '_' + v + '_before.png'), fb = path.join(out, base + '_' + v + '_after.png');
        if (!fs.existsSync(fa) || !fs.existsSync(fb)) continue;
        const lab = [base + ' - ' + v + ' - TODAY (G3548)', 'PROPOSAL (G3851)'];
        const png = await page.evaluate(async ([a, b, lab]) => {
          const img = s => new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = 'data:image/png;base64,' + s; });
          const A = await img(a), Bi = await img(b), H = 30, G = 8;
          const c = document.createElement('canvas'); c.width = A.width + G + Bi.width; c.height = H + Math.max(A.height, Bi.height);
          const g = c.getContext('2d'); g.fillStyle = '#1a1816'; g.fillRect(0, 0, c.width, c.height); g.drawImage(A, 0, H); g.drawImage(Bi, A.width + G, H);
          g.fillStyle = '#e8ded0'; g.font = '18px sans-serif'; g.fillText(lab[0], 8, 21); g.fillText(lab[1], A.width + G + 8, 21);
          return c.toDataURL('image/png').split(',')[1];
        }, [fs.readFileSync(fa).toString('base64'), fs.readFileSync(fb).toString('base64'), lab]);
        fs.writeFileSync(path.join(out, base + '_' + v + '_pair.png'), Buffer.from(png, 'base64'));
        log('pair', base, v);
      }
    }
  } catch (e) {
    fail(e.message);
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    try { serve.kill(); } catch (e) {}
  }
  if (R.errors.length) fail('page errors: ' + R.errors.slice(0, 3).join(' | '));
  R.secs = +((Date.now() - T0) / 1000).toFixed(1);
  console.log('TYRES_SHOT ' + JSON.stringify(Object.assign({ ok: !R.fails.length }, R)));
  process.exit(R.fails.length ? 1 : 0);
})();
