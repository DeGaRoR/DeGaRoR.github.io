#!/usr/bin/env node
// stickers_shot.js - LIVERY-STICKERS' pictures, from a cloud session (9 Nov). livery5_shot.js's rig: one headless
// Chromium on SwiftShader (no graphics card), dev.html's garage, the stickers put on through the editor's own door
// (CAGE_UI.finishFromSpec + build) and, once per run, through the panel's own buttons (a mark button and the 'on' tick,
// as a player does).
//   node flyDiy/tools/stickers_shot.js --out <dir> [--gfx gamer|laptop] [--size 1600x1000] [--probe] [--only cub|twin]
//     --probe   the flank test: one grizzly on the right side only, then mirrored on both, shot from both sides
//     default   the stills: the stock Cub and the Twin busher on floats (builds/candidates/Twin_busher_floats_4b.json,
//               through the fleet's Import), 3-4 stickers each, in the shed's daylight mood, three-quarter and side views
// -> <dir>/*.jpg (q90), <dir>/stickers_log.json; STICKERS_SHOT {json} on stdout. A page error, a sticker cell left empty
// after the marks' file landed, or a panel click that did not reach the export is a FAIL line, exit 1.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), net = require('net');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const FLY = path.resolve(__dirname, '..'), REPO = path.resolve(FLY, '..');
const T0 = Date.now(), log = (...a) => console.log('[' + ((Date.now() - T0) / 1000).toFixed(1).padStart(6) + ' s]', ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });
const MK = id => ['stol-river', 'grizzly-range', 'orca', 'winged-prop', 'midnight-valley', 'northern-shield', 'bear-paw',
  'true-north', 'bull-moose', 'lighthouse', 'glassy-panorama', 'alaska'].indexOf(id);

(async () => {
  const out = path.resolve(opt('out', 'stickers_shots'));
  const gfx = opt('gfx', 'gamer');
  const size = opt('size', '1600x1000').split('x').map(Number);
  const PROBE = argv.includes('--probe'), ONLY = opt('only', null);
  fs.mkdirSync(out, { recursive: true });
  const PW = require('playwright');
  const R = { gfx, fails: [], errors: [], shots: {}, notes: [] };
  const fail = w => { R.fails.push(w); log('FAIL ' + w); };
  const port = await freePort();
  const serve = spawn(process.execPath, [path.join(FLY, 'tools', '_serve.js'), String(port), REPO], { stdio: 'ignore' });
  let browser = null;
  try {
    await sleep(1500);
    browser = await PW.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
      // the gamer preset's frames (shadows, MSAA, bloom) take seconds on SwiftShader: the GPU watchdog would lose the context
      .concat(argv.includes('--nowatchdog') ? ['--disable-gpu-watchdog'] : []) });
    const page = await browser.newPage({ viewport: { width: size[0], height: size[1] } });
    page.setDefaultTimeout(2400 * 1000);
    page.on('pageerror', e => { R.errors.push(String(e.message || e).slice(0, 300)); log('PAGEERR', String(e.message).slice(0, 200)); });
    page.on('dialog', d => d.accept().catch(() => {}));
    page.on('console', m => { if (m.type() === 'error' && /CAGE_UI|ReferenceError|TypeError/.test(m.text())) { R.errors.push('console: ' + m.text().slice(0, 300)); log('CONSOLEERR', m.text().slice(0, 200)); } });
    await page.addInitScript('window.__f=0;(function t(){window.__f++;requestAnimationFrame(t)})();');
    await page.goto('http://localhost:' + port + '/flyDiy/dev.html?gfx=' + gfx + '&intro=0');
    await page.waitForFunction(() => window.BOOT && BOOT.state === 'gone' && !BOOT.current && window.CAGE_UI && window.FLIGHT_PROBE && window.AEROSKIN,
      null, { polling: 2000 });
    log('garage up');
    R.renderer = await page.evaluate(() => { const gl = FLIGHT_PROBE.renderer().getContext(); const e = gl.getExtension('WEBGL_debug_renderer_info');
      return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); });
    R.atlasPx = await page.evaluate(() => AEROSKIN.aeroAtlas(THREE).image.width);
    R.moods = await page.evaluate(() => window.GARAGE_ENV && GARAGE_ENV.moods ? GARAGE_ENV.moods() : null);
    log('renderer', R.renderer, 'atlas', R.atlasPx, 'moods', JSON.stringify(R.moods));
    // THE COST, measured on the page: the skin programs' uniform vectors (vec4 slots: a mat4 is 4, a vec3 / float 1, times the
    // array size) against the context's MAX_FRAGMENT / MAX_VERTEX_UNIFORM_VECTORS; and the decal arrays' own share
    const uniCost = () => page.evaluate(() => {
      const r = FLIGHT_PROBE.renderer(), gl = r.getContext(), out = { maxFrag: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
        maxVert: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS), programs: 0, worst: 0, decal: 0, worstName: null };
      const rows = t => ({ [gl.FLOAT_MAT4]: 4, [gl.FLOAT_MAT3]: 3, [gl.FLOAT_MAT2]: 2 })[t] || 1;
      for (const p of r.info.programs || []) {
        const prog = p.program; if (!prog) continue;
        const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS); let tot = 0, dec = 0, any = false;
        for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(prog, i); const v = rows(u.type) * u.size; tot += v;
          if (/^uDec[A-E]/.test(u.name)) { dec += v; any = true; } }
        if (!any) continue; out.programs++;
        if (tot > out.worst) { out.worst = tot; out.decal = dec; out.worstName = p.name; }
      }
      return out; });
    await page.evaluate(() => { for (const x of document.querySelectorAll('.dfClose')) try { x.click(); } catch (e) {} });
    const frames = async n => { const f0 = await page.evaluate(() => window.__f); await page.waitForFunction(f => window.__f >= f, f0 + n, { polling: 200 }); };
    const mood = +opt('mood', -1);   // (the stills set their own, per plane, below)
    if (mood >= 0) { await page.evaluate(i => GARAGE_ENV.setMood(i), mood); await sleep(1500); }
    R.mood = await page.evaluate(() => window.GARAGE_ENV && GARAGE_ENV.mood ? GARAGE_ENV.mood() : null);

    const clsBox = cls => page.evaluate(cls => { const S = window.CAGE_UI_SCENE; S.updateWorldMatrix(true, true); const bb = new THREE.Box3();
      S.traverse(o => { if (!o.isMesh || !o.visible || !o.geometry) return; const ms = Array.isArray(o.material) ? o.material : [o.material];
        const m = ms.find(x => x && x.userData && x.userData.aeroskin); if (!m) return;
        if (cls >= 0 && (m.userData.aeroWing | 0) !== cls) return; bb.union(new THREE.Box3().setFromObject(o)); });
      return bb.isEmpty() ? null : { c: bb.getCenter(new THREE.Vector3()).toArray(), s: bb.getSize(new THREE.Vector3()).toArray(), min: bb.min.toArray(), max: bb.max.toArray() }; }, cls);
    let f0 = null;
    // the stickers through the editor's own door: f.decals' vn rows replaced, everything else the build's own
    const stick = st => page.evaluate(async ([st, f0]) => {
      const f = JSON.parse(f0); f.decals = Object.assign({}, f.decals || {});
      for (const k of Object.keys(f.decals)) if (/^vn[1-4]/.test(k)) delete f.decals[k];
      for (const [i, l] of Object.entries(st)) for (const k in l) f.decals['vn' + i + k] = l[k];
      CAGE_UI.finishFromSpec(f); CAGE_UI.build();
      await new Promise(r => setTimeout(r, 2500));
      // the marks' file is lazy: wait for it, then for the cells to be drawn again
      for (let i = 0; i < 40 && !window.LIVERY_MARKS; i++) await new Promise(r => setTimeout(r, 250));
      return { n: AEROSKIN.aeroSharedU(THREE).uDecN.value, marks: !!window.LIVERY_MARKS }; }, [st, f0]);
    // what a sticker cell holds: opaque pixels and the top colour
    const cell = slot => page.evaluate(slot => {
      const A = AEROSKIN, cv = A.aeroAtlas(THREE).image, c = A.aeroVinylCell(slot, 1, cv.width);
      const t = document.createElement('canvas'); t.width = t.height = Math.round(c.C); const tg = t.getContext('2d', { willReadFrequently: true });
      tg.drawImage(cv, c.px, c.py, c.C, c.C, 0, 0, c.C, c.C);
      const d = tg.getImageData(0, 0, t.width, t.height).data, h = new Map(); let n = 0, top = null, tn = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 127) { n++; const k = (d[i] << 16 | d[i + 1] << 8 | d[i + 2]) >>> 0; const v = (h.get(k) || 0) + 1; h.set(k, v); if (v > tn) { tn = v; top = k; } }
      return { opaque: n, share: +(n / (t.width * t.height)).toFixed(3), top: top == null ? null : '#' + top.toString(16).padStart(6, '0') }; }, slot);
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
      await page.screenshot({ clip, path: to, type: 'jpeg', quality: 90, timeout: 600000 });
      await page.evaluate(() => { for (const e of window.__hid || []) e.style.removeProperty('visibility'); FLIGHT_PROBE.pan(0, 0, 0); });
      R.shots[name] = { cam, aim: aimAt }; log('shot', name);
    };
    // THE PICTURE IS THE WHOLE WINDOW: the editor's two columns folded (its own pcol-off / prop-off classes) and, if the
    // canvas is still narrower than the window, the canvas laid over it; a resize so the renderer takes the size
    const fullFrame = async () => {
      const r = await page.evaluate(async () => {
        const w = document.getElementById('edWrap'); if (w) w.classList.add('pcol-off', 'prop-off');
        window.dispatchEvent(new Event('resize')); await new Promise(r => setTimeout(r, 600));
        const c = document.getElementById('c');
        if (c.getBoundingClientRect().width < innerWidth * 0.9) {
          c.style.cssText += ';position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:0';
          window.dispatchEvent(new Event('resize')); await new Promise(r => setTimeout(r, 600));
        }
        const q = c.getBoundingClientRect(); return { w: Math.round(q.width), h: Math.round(q.height), bw: c.width, bh: c.height }; });
      await frames(3); log('frame', JSON.stringify(r)); R.frame = r; return r;
    };

    const plane = async (key) => {
      if (key === 'twin') {
        await page.setInputFiles('#gFile', path.join(FLY, 'builds', 'candidates', 'Twin_busher_floats_4b.json'));
        await page.waitForFunction(() => { const s = GARAGE_SPEC.get(); return s && /busher/i.test(JSON.stringify(s.meta || {})); }, null, { polling: 1000, timeout: 180000 }).catch(() => {});
        await sleep(5000); await frames(4);
      }
      f0 = await page.evaluate(() => JSON.stringify(CAGE_UI.finishToSpec() || {}));
      R[key] = { meta: await page.evaluate(() => { const s = GARAGE_SPEC.get(); return { name: s.meta && (s.meta.name || s.meta.title), reg: s.meta && s.meta.reg, trim: s.paint && s.paint.trim, base: s.paint && s.paint.base }; }),
                 body: await clsBox(0), wing: await clsBox(1), tail: await clsBox(2) };
      log(key, JSON.stringify(R[key].meta), 'body', JSON.stringify(R[key].body));
      await fullFrame();
      return R[key];
    };

    if (PROBE) {
      const P = await plane('cub'), span = Math.max(...P.wing.s);
      const g = { On: 1, Mk: MK('grizzly-range'), Col: 0xc81e1e, H: 0.5, L: 3.0, C: 0.1 };
      R.probe = {};
      R.probe.right = await stick({ 1: Object.assign({ Side: 1 }, g) });
      R.probe.cellRight = await cell(0);
      await shoot('probe_rightonly_from_minus', [-Math.PI / 2, 0.05, 0.55 * span], P.body.c);
      await shoot('probe_rightonly_from_plus', [Math.PI / 2, 0.05, 0.55 * span], P.body.c);
      R.probe.both = await stick({ 1: Object.assign({ Side: 0, Mir: 0 }, g) });
      await shoot('probe_both_from_minus', [-Math.PI / 2, 0.05, 0.55 * span], P.body.c);
      await shoot('probe_both_from_plus', [Math.PI / 2, 0.05, 0.55 * span], P.body.c);
      R.probe.mir = await stick({ 1: Object.assign({ Side: 0, Mir: 1 }, g) });
      await shoot('probe_mirror_from_minus', [-Math.PI / 2, 0.05, 0.55 * span], P.body.c);
      await shoot('probe_mirror_from_plus', [Math.PI / 2, 0.05, 0.55 * span], P.body.c);
      throw 'done';
    }
    // A SURFACE'S BOX in a projection's own frame, measured by the editor itself: a kit layer (5) switched on, invisible,
    // FITTED to the target in that mode (G2870's decFitApply), its L / C / W / H read off the export, the layer removed
    const fitOf = (tgt, mode) => page.evaluate(async ([tgt, mode, f0]) => {
      const f = JSON.parse(f0); f.decals = Object.assign({}, f.decals || {});
      Object.assign(f.decals, { m5On: 1, m5Fit: 1, m5Tgt: tgt, m5Mode: mode, m5Alp: 0, m5Pat: 0 });
      CAGE_UI.finishFromSpec(f); CAGE_UI.build();
      await new Promise(r => setTimeout(r, 2000));
      // (the export holds DEVIATIONS: a fitted value that equals the layer's default is absent - read the default then)
      const d = (CAGE_UI.finishToSpec() || {}).decals || {}, D0 = AEROSKIN.AERO_DEC_DEF;
      const v = k => (d['m5' + k] != null ? d['m5' + k] : D0['m5' + k]);
      return { L: v('L'), C: v('C'), W: v('W'), H: v('H') }; }, [tgt, mode, f0]);
    // THE NOSE in the side box's own frame (craft y aft, z up): the body class's vertices in the first 0.45 m, through the
    // shared uCraftInv - where a cowl sticker goes (the cowl takes the box projection only)
    const noseOf = () => page.evaluate(() => {
      const S = window.CAGE_UI_SCENE, U = AEROSKIN.aeroSharedU(THREE), M = U.uCraftInv.value, v = new THREE.Vector3(), pts = [];
      S.updateWorldMatrix(true, true);
      S.traverse(o => { if (!o.isMesh || !o.visible || !o.geometry || !o.geometry.attributes.position) return;
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        if (!ms.some(m => m && m.userData && m.userData.aeroskin && (m.userData.aeroWing | 0) === 0)) return;
        const P = o.geometry.attributes.position, st = Math.max(1, Math.floor(P.count / 4000));
        for (let i = 0; i < P.count; i += st) { v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld).applyMatrix4(M); pts.push([v.x, v.y, v.z]); } });
      // the fuselage's own nose: vertices near the centreline (|x| < 0.5 m: not a float, not a boom)
      const c = pts.filter(p => Math.abs(p[0]) < 0.5);
      const y0 = Math.min(...c.map(p => p[1]));
      const z = c.filter(p => p[1] < y0 + 0.45).map(p => p[2]).sort((a, b) => a - b);
      // the cowl's middle (0.6 m aft of the spinner's tip, on the thrust line), in the world: where a close-up aims
      const zMid = z.length ? (z[0] + z[z.length - 1]) / 2 : 0;
      const wp = new THREE.Vector3(0, y0 + 0.6, zMid).applyMatrix4(M.clone().invert());
      return { y0, zMid, zLo: z[0], zHi: z[z.length - 1], n: c.length, world: wp.toArray() }; });
    // A FLOAT's side in the side box's frame: the body class's vertices out of the centreline (|x| > 0.6 m) and below the
    // pod's own bottom - its length's middle and its height's middle (LIVERY-STICKERS: floats take stickers)
    const floatOf = zTop => page.evaluate(zTop => {
      const S = window.CAGE_UI_SCENE, M = AEROSKIN.aeroSharedU(THREE).uCraftInv.value, v = new THREE.Vector3(), b = [1e9, -1e9, 1e9, -1e9];
      S.updateWorldMatrix(true, true);
      S.traverse(o => { if (!o.isMesh || !o.visible || !o.geometry || !o.geometry.attributes.position) return;
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        if (!ms.some(m => m && m.userData && m.userData.aeroskin && (m.userData.aeroWing | 0) === 0)) return;
        const P = o.geometry.attributes.position, st = Math.max(1, Math.floor(P.count / 4000));
        for (let i = 0; i < P.count; i += st) { v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld).applyMatrix4(M);
          if (Math.abs(v.x) > 0.6 && v.z < zTop) { b[0] = Math.min(b[0], v.y); b[1] = Math.max(b[1], v.y); b[2] = Math.min(b[2], v.z); b[3] = Math.max(b[3], v.z); } } });
      return b[1] > b[0] ? { y: (b[0] + b[1]) / 2, len: b[1] - b[0], z: (b[2] + b[3]) / 2, ht: b[3] - b[2], zLo: b[2] } : null; }, zTop);
    // THE COMPOSITIONS: 3-4 stickers a plane, placed off the measured boxes
    const COMPOSE = {
      async cub(P) {
        const fin = await fitOf(6, 1), nose = await noseOf();
        R.fits = { fin, nose }; log('fits', JSON.stringify(R.fits));
        const ink = 0x1a1a1a;
        // the right flank wears the grizzly (head to the nose as drawn), the left the moose (its art faces left: to the nose
        // on that flank with no mirror) - the same place, between the cabin and the registration; the map on the fin both
        // sides; the winged prop on the cowl both sides
        return {
          // (the Cub's registration fills the rear fuselage from the cabin aft: the flank stickers go on the COWL, nose art, aft of
          // the cooling inlet and below the exhaust)
          1: { On: 1, Mk: MK('grizzly-range'), Col: ink, Side: 1, H: 0.27, L: +(nose.y0 + 0.78).toFixed(2), C: +(nose.zMid - 0.09).toFixed(2), Tgt: 0, Mode: 1 },
          2: { On: 1, Mk: MK('alaska'), Col: 0x1f3550, H: +(fin.H * 0.42).toFixed(2), L: +(fin.L + fin.W * 0.04).toFixed(2), C: +(fin.C + fin.H * 0.02).toFixed(2), Tgt: 6, Mode: 1 },
          4: { On: 1, Mk: MK('bull-moose'), Col: 0x8a1c14, Side: 2, H: 0.27, L: +(nose.y0 + 0.78).toFixed(2), C: +(nose.zMid - 0.09).toFixed(2), Tgt: 0, Mode: 1 },
        };
      },
      async twin(P) {
        const fin = await fitOf(6, 1), wing = await fitOf(4, 2), nose = await noseOf(), flt = await floatOf(nose.zLo - 0.3);
        R.fits = { fin, wing, nose, flt }; log('fits', JSON.stringify(R.fits));
        const T = R.twin.meta, ink = T.trim != null ? T.trim : 0x1b3a5c, green = 0x22432b;
        // the orca on both fins (mirrored on the left: it leaps forward on both flanks), the panorama on the pod's flanks
        // (side box, behind the nose), the midnight valley on a wing's top in the trim
        return {
          1: { On: 1, Mk: MK('glassy-panorama'), Col: green, H: 0.20, L: +(nose.y0 + 1.15).toFixed(2), C: +(nose.zMid - 0.05).toFixed(2), Tgt: 0, Mode: 1 },
          2: { On: 1, Mk: MK('orca'), Col: ink, Mir: 1, H: +(fin.H * 0.45).toFixed(2), L: +fin.L.toFixed(2), C: +(fin.C + fin.H * 0.05).toFixed(2), Tgt: 6, Mode: 1 },
          // (the wing without the registration's wing copy; the trim's orange on the white and green: the dark green vanished)
          4: { On: 1, Mk: MK('midnight-valley'), Col: ink, H: 1.0, L: +(wing.L + wing.W * 0.27).toFixed(2), C: +wing.C.toFixed(2), Tgt: 4, Mode: 2 },
          // THE FLOATS TAKE STICKERS (the user, 9 Nov): the bear paw on both floats' sides, in the side box on the forward half
          // of the hull, centred 0.2 m above its keel (the measured box runs up the struts: its middle was above the hull),
          // in the trim's orange (dark green vanished into the float's green side); the letters are still declined there
          3: flt ? { On: 1, Mk: MK('bear-paw'), Col: ink, H: 0.28, L: +(flt.y - flt.len * 0.18).toFixed(2), C: +(flt.zLo + 0.20).toFixed(2), Tgt: 0, Mode: 1 } : undefined,
        };
      },
    };
    if (!PROBE && !opt('plan', null)) {
      for (const key of ONLY ? [ONLY] : ['cub', 'twin']) {
        // THE LIGHT: GOLDEN, the late sun through the door (the gamer preset's AFTERNOON lights the shed from the skylights
        // only, with real shadows: too dark to read a sticker); --mood overrides
        if (opt('mood', null) == null) { await page.evaluate(i => GARAGE_ENV.setMood(i), 1); await sleep(1500); }
        const P = await plane(key), span = Math.max(...P.wing.s);
        R[key].mood = await page.evaluate(() => GARAGE_ENV.mood());
        const st = await COMPOSE[key](P);
        R[key].st = st; log(key, 'stickers', JSON.stringify(st));
        R[key].put = await stick(st);
        await frames(4); R.uniforms = await uniCost(); log('uniforms', JSON.stringify(R.uniforms));
        for (let s = 0; s < 4; s++) if (st[s + 1]) { const c = await cell(s); R[key]['cell' + (s + 1)] = c; if (!c.opaque) fail(key + ' sticker ' + (s + 1) + "'s cell is empty"); }
        const B = P.body, Tl = P.tail;
        // a photographer's angles: the three-quarter from the right, low; the three-quarter from the left; the tail
        // (az -pi/2 is the right flank, nose to the right of the picture; az toward 0 swings the eye aft - measured in the probe)
        await shoot(key + '_' + gfx + '_threequarter_right', [-Math.PI / 2 - 0.62, 0.10, 0.82 * span], B.c);
        if (key === 'twin') {
          await shoot(key + '_' + gfx + '_tail_right', [-Math.PI / 2 + 0.30, 0.07, 0.50 * span], [Tl.c[0], Tl.c[1] + 0.1 * Tl.s[1], Tl.c[2]]);
          await shoot(key + '_' + gfx + '_threequarter_left', [Math.PI / 2 + 0.62, 0.12, 0.95 * span], B.c);
          await shoot(key + '_' + gfx + '_above', [-Math.PI / 2 - 0.5, 0.80, 0.95 * span], P.wing.c);
        }
        if (key === 'cub') {
          // THE FIRST PLACE, through the panel (the user: "in the middle of the fuselage"): slot 3 (empty here) ticked on
          // as a player does; its station must be the body's field box mid-length and its top just under the waist
          const fld = await fitOf(0, 0);
          await stick(st);
          R.firstPlace = await page.evaluate(async () => {
            const det = document.querySelector('[data-g="sticker/3"]'); if (!det) return { err: 'no sticker block 3' };
            const c = det.querySelector('input[type=checkbox]'); if (!c) return { err: 'no on tick' };
            c.click(); await new Promise(r => setTimeout(r, 2500));
            const d = (CAGE_UI.finishToSpec() || {}).decals || {};
            return { vn3On: d.vn3On, vn3L: d.vn3L, vn3C: d.vn3C, vn3Mode: d.vn3Mode }; });
          R.firstPlace.fieldMid = +fld.L.toFixed(2);
          log('first place', JSON.stringify(R.firstPlace));
          // (its top just under the waist: C = -(size / 2 + 3 cm), the size at its default 0.35 m)
          if (R.firstPlace.vn3On !== 1 || Math.abs((R.firstPlace.vn3L || 0) - fld.L) > 0.011 || R.firstPlace.vn3C !== -0.21)
            fail('a slot switched on did not go to the middle of the fuselage: ' + JSON.stringify(R.firstPlace));
          await shoot(key + '_' + gfx + '_first_place', [-Math.PI / 2 - 0.10, 0.05, 0.62 * span], B.c);
          await stick(st);                       // (the composition back: slot 3 off again)
          // the nose's flanks at mid range, aimed half way from the centre to the cowl (closer, the shed's walls clamp the eye)
          const nw = R.fits.nose.world, mid = B.c.map((x, i) => (x + nw[i]) / 2);
          await shoot(key + '_' + gfx + '_nose_right', [-Math.PI / 2 - 0.30, 0.06, 0.52 * span], mid);
          await shoot(key + '_' + gfx + '_left_side', [Math.PI / 2 + 0.15, 0.06, 0.80 * span], B.c);
          await shoot(key + '_' + gfx + '_nose_left', [Math.PI / 2 + 0.35, 0.06, 0.52 * span], mid);
        }
      }
      // ONCE THROUGH THE PANEL: sticker 1's 'on' tick off and on again, mark 12 picked by its button, as a player does
      R.panel = await page.evaluate(async () => {
        const det = document.querySelector('[data-g="sticker/1"]'); if (!det) return { err: 'no sticker block' };
        const bt = det.querySelector('button[data-mk="11"]'); if (!bt) return { err: 'no mark button' };
        bt.click(); await new Promise(r => setTimeout(r, 1500));
        const d = (CAGE_UI.finishToSpec() || {}).decals || {};
        return { vn1On: d.vn1On, vn1Mk: d.vn1Mk, thumb: !!bt.querySelector('svg path'), summary: det.querySelector('summary').textContent }; });
      log('panel', JSON.stringify(R.panel));
      if (!R.panel || R.panel.vn1Mk !== 11 || R.panel.vn1On !== 1) fail('the panel\'s mark button did not reach the export: ' + JSON.stringify(R.panel));
      if (R.panel && !R.panel.thumb) fail('the mark buttons have no pictures');
      if (R.errors.length) fail(R.errors.length + ' page error(s)');
      throw 'done';
    }
    const plan = JSON.parse(opt('plan', 'null') || 'null');
    if (plan) {   // a free composition: --plan '{"plane":"cub","st":{...},"shots":[[name,az,el,distK,aimCls,dx,dy,dz]]}'
      const P = await plane(plan.plane), span = Math.max(...P.wing.s);
      R.plan = await stick(plan.st);
      await frames(4); R.uniforms = await uniCost(); log('uniforms', JSON.stringify(R.uniforms));
      for (let s = 0; s < 4; s++) if (plan.st[s + 1]) { const c = await cell(s); R['cell' + (s + 1)] = c; if (!c.opaque) fail('sticker ' + (s + 1) + "'s cell is empty"); }
      for (const [nm, az, el, dk, cls, dx, dy, dz] of plan.shots) {
        const b = cls == null ? null : (cls === 'body' ? P.body : cls === 'wing' ? P.wing : P.tail);
        await shoot(plan.plane + '_' + gfx + '_' + nm, [az, el, dk * span], b ? [b.c[0] + (dx || 0), b.c[1] + (dy || 0), b.c[2] + (dz || 0)] : null);
      }
      throw 'done';
    }
    if (R.errors.length) fail(R.errors.length + ' page error(s)');
  } catch (e) { if (e !== 'done') fail('threw: ' + (e && e.stack || e)); else if (R.errors.length) fail(R.errors.length + ' page error(s)'); }
  finally { if (browser) await browser.close().catch(() => {}); serve.kill(); }
  fs.writeFileSync(path.join(out, 'stickers_log_' + gfx + (PROBE ? '_probe' : '') + '.json'), JSON.stringify(R, null, 1));
  console.log('STICKERS_SHOT ' + JSON.stringify({ fails: R.fails, renderer: R.renderer, atlas: R.atlasPx, probe: R.probe, uniforms: R.uniforms, frame: R.frame }));
  process.exit(R.fails.length ? 1 : 0);
})();
