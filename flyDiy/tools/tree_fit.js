#!/usr/bin/env node
// tree_fit.js - EVERY SPECIES' TINT AND IMPLIGHT, FITTED ONCE (2026-09-20, the user:
// "fit once and for all all the tints for all species, it's always better")
//
//   node tools/tree_fit.js [--url http://localhost:8463/flyDiy/tools/_trees.html]
//        [--kinds tree,shrub] [--ref realistic_fir_trees_pack_lods_gameready.glb] [--target-ref] [--no-implight] [--dry]
//   node tools/tree_fit.js --kinds cover [--ground #6f7d3c]     the grass's light fitted to the ground it stands on
//
// The bench's own two fits, run headless over the whole shelf and written back
// to tools/_trees_tuning.json (the file the bench and tree_prep.py read):
//
//   1. THE TINT (suggestTuning): every species' cutout texels measured
//      (measureMats: the pixels that survive the alpha test, to HSL), then ONE
//      number per species per axis - hue to the reference's, saturation down to
//      the set's lower quartile (never up), lightness to the set's median. The
//      set is the canopy layer (trees + shrubs by default): a straw-coloured
//      sedge or a bare snag has no business pulling a forest's targets, so the
//      covers and the dead are measured for the record and left untinted.
//      --target-ref takes hue, saturation AND lightness from the reference's own
//      texels instead (the bushes to the ash, 2026-09-20).
//   2. IMPLIGHT (fitImplight): the species' 5x5 grove drawn as geometry and as
//      its sheet from one camera, the sheet's gamma bisected until the two
//      frames' mean luminance agree - at the bench's `imp lit` (0.9, G452).
//
// The bench's localStorage is what the page fits into; the export button's
// JSON (the same text the bench downloads) is read off the page and written to
// the file, so the committed record and the bench agree. Before/after per
// species on stdout. --dry prints and writes nothing.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const has = k => argv.includes('--' + k);
const URL = opt('url', 'http://localhost:8463/flyDiy/tools/_trees.html');
const KINDS = opt('kinds', 'tree,shrub').split(',');
const REF = opt('ref', null);
const PORT = 9800 + (process.pid % 90);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('tree_fit: no Chrome'); process.exit(2); }
const udd = path.join(require('os').tmpdir(), 'cdp_fit_' + PORT + '_' + Date.now());
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--window-size=1920,1080', '--hide-scrollbars',
  '--no-first-run', '--user-data-dir=' + udd, '--disable-gpu-sandbox', '--disable-frame-rate-limit', '--disable-gpu-vsync', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });

(async () => {
  let tgt = null;
  for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  if (!tgt) throw new Error('no page');
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') console.error('page exception: ' + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).split(String.fromCharCode(10)).slice(0, 2).join(' | ')); };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (!r.result || r.result.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.result && r.result.exceptionDetails && (r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description || r.result.exceptionDetails.text))); return r.result.result.value; };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  // the FILE's tuning, not this profile's: a fresh headless profile has no localStorage, so the
  // page boots on tools/_trees_tuning.json as committed - the fit starts from the record
  await cmd('Page.navigate', { url: URL });
  for (let i = 0; i < 60; i++) { await sleep(1000); try { if (await ev("typeof SPECIES !== 'undefined' && SPECIES.length > 0")) break; } catch (e) {} }
  if (REF) await ev("REFNAME = " + JSON.stringify(REF) + ", 1");
  const ref = await ev('REFNAME');
  const before = JSON.parse(await ev("JSON.stringify(Object.fromEntries(SPECIES.map(s => [s.key, (({hue, sat, light, implight}) => ({hue, sat, light, implight}))(tuneOf(s.key))])))"));
  const kinds = JSON.parse(await ev("JSON.stringify(Object.fromEntries(SPECIES.map(s => [s.key, s.kind])))"));
  console.log('tree_fit  ' + URL + '\n  reference ' + ref + ' · kinds ' + KINDS.join('+') + ' · imp lit ' + await ev('U_ILIT.value'));

  // 1. measure every species of the chosen kinds (the file loads, the maps decode, then the texels)
  const keys = Object.keys(kinds).filter(k => KINDS.includes(kinds[k]));
  const meas = {};
  // --kinds cover: THE GRASS FITTED TO THE GROUND (the user, 2026-09-20: "the ground colour
  // should blend with the grass ... the blades give dark green and the terrain bright green").
  // Each cover alone on the plane at its mix density, the plane at --ground (a hex; the
  // grassland's by default), the flight eye (35 m up, 40 deg down); the frame rendered to
  // a target, the cover's pixels and the bare ground's told apart by two mask renders, and
  // the species' `lift` (a scale on the instance colour) bisected until the tufts' mean
  // luminance is the ground's. The tufts already carry the ground's colour; this is what
  // the card's shading (vertical, wrapped, edge-blended) takes off, given back, measured.
  if (KINDS.length === 1 && KINDS[0] === 'cover') {
    const ground = opt('ground', '#6f7d3c');
    console.log('  cover fit: the plane at ' + ground + ', the flight eye');
    for (const k of keys) {
      if (kinds[k] === 'cover' && (await ev(`!!tuneOf(${JSON.stringify(k)}).noTint`))) continue;   // a flower keeps its own picture; no lift
      const r = JSON.parse(await ev(`(async () => {
        const key = ${JSON.stringify(k)}; const sp = spOf(key); if (!sp) return null;
        for (const s of SPECIES) PICK[s.key] = (s.key === key);
        Object.assign(FOREST, { count: 0, under: 0, cover: 1, reach: 120, impostor: false, ground: 'plane', wet: 0, radius: 220, seed: 7, taper: 0, holes: 1, groundColor: ${JSON.stringify(ground)} });
        if (MODE !== 'forest') setMode('forest'); else await showForest(true);
        for (let i = 0; i < 600; i++) { if ($('msg').textContent === '') break; await new Promise(r => setTimeout(r, 100)); } await texturesReady();
        const ex = camera.position.x, ez = camera.position.z, yy = Math.atan2(ex, ez);
        target.set(ex - 42 * Math.sin(yy), 0, ez - 42 * Math.cos(yy)); dist = 55; yaw = yy; pitch = 0.69; place();
        // planted AGAIN at the moved eye: the cover grows around the eye, and the first species' field
        // had grown around the shelf's eye 42 m away (grass_dry measured 0 px, lift ran to the stop)
        await showForest(); for (let i = 0; i < 600; i++) { if ($('msg').textContent === '') break; await new Promise(r => setTimeout(r, 100)); } await texturesReady();
        const R = renderer, W = 960, H = 540, rt = new THREE.WebGLRenderTarget(W, H, { format: THREE.RGBAFormat, generateMipmaps: false });
        rt.texture.colorSpace = THREE.SRGBColorSpace;
        const cover = []; stage.traverse(o => { if (o.isInstancedMesh) cover.push(o); });
        const shot = (show) => {   // show: 'all' | 'cover' | 'ground'
          const bg = scene.background, fog = scene.fog, vis = { man: man.visible, grid: grid.visible, ground: ground.visible };
          if (show !== 'all') { scene.background = null; scene.fog = null; }
          man.visible = false; grid.visible = false; ground.visible = show !== 'cover';
          for (const o of cover) o.visible = show !== 'ground';
          const pRT = R.getRenderTarget(), pAC = R.autoClear; R.setRenderTarget(rt); R.autoClear = true; R.setClearColor(0x000000, 0); R.clear(); R.render(scene, camera);
          const px = new Uint8Array(W * H * 4); R.readRenderTargetPixels(rt, 0, 0, W, H, px); R.setRenderTarget(pRT); R.autoClear = pAC;
          scene.background = bg; scene.fog = fog; man.visible = vis.man; grid.visible = vis.grid; ground.visible = vis.ground; for (const o of cover) o.visible = true;
          return px; };
        const mC = shot('cover'), mG = shot('ground');
        const lum = (px, i) => 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
        const measure = () => { const f = shot('all'); let cs = 0, cn = 0, gs = 0, gn = 0, cr = [0, 0, 0], gr = [0, 0, 0];
          for (let i = 0; i < W * H; i++) { const j = i * 4; if (mC[j + 3] > 0) { cs += lum(f, j); cn++; cr[0] += f[j]; cr[1] += f[j + 1]; cr[2] += f[j + 2]; }
            else if (mG[j + 3] > 0) { gs += lum(f, j); gn++; gr[0] += f[j]; gr[1] += f[j + 1]; gr[2] += f[j + 2]; } }
          return { cover: cn ? cs / cn : 0, ground: gn ? gs / gn : 0, cn, gn, crgb: cr.map(v => Math.round(v / Math.max(1, cn))), grgb: gr.map(v => Math.round(v / Math.max(1, gn))) }; };
        const t = tuneOf(key), before = measure();
        // the dial is lift, a scale on the instance colour (a texel clamps at 1, a colour does not):
        // the field is rebuilt per step, the ground the same
        const setLift = async v => { t.lift = v; TUNE[key] = t; await showForest();
          for (let i = 0; i < 600; i++) { if ($('msg').textContent === '') break; await new Promise(r => setTimeout(r, 50)); }
          cover.length = 0; stage.traverse(o => { if (o.isInstancedMesh) cover.push(o); }); };
        let lo = 0.1, hi = 4, m = before;   // 0.1: a flattened card (contrast dial) sits far BELOW 1 - the fit hit the old 0.3 floor
        for (let it = 0; it < 8; it++) { const mid = (lo + hi) / 2; await setLift(mid); m = measure(); if (m.cover > m.ground) hi = mid; else lo = mid; }
        await setLift(+((lo + hi) / 2).toFixed(3)); saveTune(); const after = measure(); rt.dispose();
        return JSON.stringify({ key, light: t.lift, before: { cover: +before.cover.toFixed(1), ground: +before.ground.toFixed(1), crgb: before.crgb, grgb: before.grgb }, after: { cover: +after.cover.toFixed(1), ground: +after.ground.toFixed(1), crgb: after.crgb, grgb: after.grgb, coverPx: after.cn } });
      })()`));
      if (r) console.log(`  ${k.padEnd(14)} lift -> ${r.light}   tufts ${r.before.cover} -> ${r.after.cover} (rgb ${r.after.crgb})   ground ${r.after.ground} (rgb ${r.after.grgb})   ${r.after.coverPx} px`);
    }
  }
  // --target ref: the reference is measured too, whatever its kind (it sets every axis below)
  for (const k of (has('target-ref') && !keys.includes(ref) ? keys.concat([ref]) : keys)) {
    const m = await ev(`(async () => { const sp = spOf(${JSON.stringify(k)}); const b = await ensureLoaded(sp.file); if (!b) return null;
      for (let i = 0; i < 20; i++) { await texturesReady(); const m = measureSpecies(sp); if (m) { MEAS[sp.key] = m; return JSON.stringify(m); } await new Promise(r => setTimeout(r, 250)); }
      return null; })()`);
    meas[k] = m ? JSON.parse(m) : null;
    console.log('  measured ' + k.padEnd(46) + (meas[k] ? `h ${meas[k].h.toFixed(3)} s ${meas[k].s.toFixed(3)} l ${meas[k].l.toFixed(3)} (${meas[k].px} px, ${meas[k].mats} maps)` : 'nothing (no cutout map)'));
  }
  // 2. the tint (not for the covers: their colour is the ground's): suggestTuning (hue from the reference, sat/light from the SET's quartile/median),
  //    or --target-ref: every axis from the reference's own texels ("the border should take as
  //    reference the colour of the ash") - sat never up, light within the dials' range
  const n = (KINDS.length === 1 && KINDS[0] === 'cover') ? 0 : has('target-ref')
    ? await ev(`(() => { const r = MEAS[REFNAME]; if (!r || !r.px) return 0; let n = 0;
        for (const k of ${JSON.stringify(keys)}) { const m = MEAS[k]; if (!m || !m.px) continue; const t = tuneOf(k);
          let dh = r.h - m.h; if (dh > 0.5) dh -= 1; if (dh < -0.5) dh += 1;
          t.hue = +dh.toFixed(3); t.sat = +Math.min(1, m.s > 1e-4 ? r.s / m.s : 1).toFixed(3);
          t.light = +Math.min(1.8, Math.max(0.4, m.l > 1e-4 ? r.l / m.l : 1)).toFixed(3); TUNE[k] = t; n++; }
        saveTune(); return n; })()`)
    : await ev('suggestTuning(REFNAME)');
  await ev("(() => { for (const k in cache) retint(k); return 1; })()");
  console.log('  suggestTuning set ' + n + ' species');
  // 3. implight per species, the bench's grove fit
  const fits = {};
  if (!has('no-implight') && !(KINDS.length === 1 && KINDS[0] === 'cover')) for (const k of keys) {
    if (!meas[k]) continue;
    try { const r = await ev(`fitImplight(${JSON.stringify(k)}).then(r => JSON.stringify(r))`); fits[k] = r ? JSON.parse(r) : null; }
    catch (e) { fits[k] = null; console.error('  fit failed ' + k + ': ' + e.message); }
    if (fits[k]) console.log('  implight ' + k.padEnd(46) + `mesh ${fits[k].geometry} sheet ${fits[k].impostor} -> ${fits[k].implight}`);
  }
  const after = JSON.parse(await ev("JSON.stringify(Object.fromEntries(SPECIES.map(s => [s.key, (({hue, sat, light, implight}) => ({hue, sat, light, implight}))(tuneOf(s.key))])))"));
  console.log('\n  ' + 'species'.padEnd(46) + 'hue            sat            light          implight');
  for (const k of keys) {
    const f = (a, b, d) => (a === undefined ? '-' : a) + ' -> ' + (b === undefined ? '-' : b);
    console.log('  ' + k.padEnd(46) + f(before[k].hue, after[k].hue).padEnd(15) + f(before[k].sat, after[k].sat).padEnd(15) + f(before[k].light, after[k].light).padEnd(15) + f(before[k].implight, after[k].implight));
  }
  // 4. the export, off the page, into the file
  const body = await ev("(() => { $('expo').click(); const t = $('expoTxt').value; $('expoBox').style.display = 'none'; return t; })()");
  if (has('dry')) console.log('\n  --dry: nothing written');
  else {
    const p = 'tools/_trees_tuning.json';
    const prev = fs.readFileSync(p, 'utf8');
    const nl = prev.includes('\r\n') ? '\r\n' : '\n';
    // `included` is THE GAME'S PAYLOAD LIST (tree_prep.py bakes it) and the bench exports it from
    // the current pick - the fit picks one species at a time, and eight commits carried
    // included: ["grass_scan"] (G454.11). The fit keeps the committed list; only the bench's own
    // export (the user picking the payload) may change it.
    const kept = JSON.parse(prev).included, out = JSON.parse(body); out.included = kept;
    fs.writeFileSync(p, JSON.stringify(out, null, 1).replace(/\r?\n/g, nl) + (prev.endsWith(nl) ? nl : ''));
    console.log('\n  wrote ' + p + ' (' + body.length + ' chars)');
  }
  ws.close(); ch.kill();
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
})().catch(e => { console.error('tree_fit: ' + e.message); ch.kill(); process.exit(1); });
