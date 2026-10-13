#!/usr/bin/env node
// cardmatch_probe.js - THE FAR CARDS AGAINST THE IMPOSTORS (CARD-MATCH G2940, the user 13 Oct: "a color/value shift has
// developed between the far cards for the trees and the impostors. The dark ones are the far cards, the greener ones the
// impostors"). A GPU census, two questions apart:
//   SHEETS  the stand card's baked sheet (stand_cards.js, key 'stand:<mix>') against the sheets of its mix's own species
//           (the fill's impostors): the mean linear albedo of the drawn texels, each sheet read back (imp_audit's way)
//   SCREEN  the same forest drawn three times from a held camera 300 m over the densest stand - the fill's impostors only,
//           the stand cards only (standIn off, near 0: the cards over the same ground), neither - the tree pixels (where a
//           frame differs from 'neither') averaged in linear RGB: cards / impostors per channel and in luma
// Both under the default look, then under a tinted one (the leaves' master light x 1.5 + a hue turn) - a card that does
// not follow the tint is a card that is not fed by the same source.
// Usage: node tools/perf/cardmatch_probe.js --url http://localhost:PORT/flyDiy/index.html [--out f.json] [--shots dir]
// A GPU measurement: the box's GPU lock first.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL = opt('url', 'http://localhost:8358/flyDiy/index.html'), OUT = opt('out', path.join(__dirname, 'cardmatch.json')), SHOTS = opt('shots', null);
// --gate: GATE CARDMATCH (G3185) - the default look's on-screen card / impostor luma inside BAND, and its NEGATIVE CONTROL: the
// same card at half its level (TREE_LOD.impLevel on its sheet x 0.5) must leave the band, or the row cannot see a mismatch
const GATE = argv.includes('--gate'), BAND = [0.85, 1.15];
// --compose 0: the card from the merged block's bake (G3181-G3183, levelled) - the A/B against the composed card (G3184)
const COMPOSE = opt('compose', null);
const PORT = 9400 + (process.pid % 500);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--window-size=1600,900', '--hide-scrollbars', '--no-first-run',
  '--user-data-dir=' + path.join(require('os').tmpdir(), 'cdp_cm_' + PORT + '_' + Date.now()), '--disable-gpu-sandbox', '--disable-frame-rate-limit', '--disable-gpu-vsync', 'about:blank'], { stdio: 'ignore' });
const kill = () => { try { ch.kill(); } catch (e) {} };
process.on('exit', kill); for (const s of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(s, () => { kill(); process.exit(1); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = u => new Promise((res, rej) => { http.get(u, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });

// the sheets: every baked atlas's drawn texels, mean linear albedo (sRGB bytes decoded)
const SHEETS = `(() => {
  const CUT = { rungs: 0.40, stand: 0.15, snag: 0.10 };
  const lin = v => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const R = WORLD.renderer, out = {};
  for (const a of WORLD.treeAtlases()) { if (!a.rt && !a.read) continue;
    const N = a.N || a.rt.width, px = new Uint8Array(N * N * 4);
    if (a.read) a.read(px); else R.readRenderTargetPixels(a.rt, 0, 0, N, N, px);
    let r = 0, g = 0, b = 0, n = 0;
    for (let p = 0; p < px.length; p += 4) if (px[p + 3] >= 255 * (CUT[a.series] || 0.4)) { r += lin(px[p]); g += lin(px[p + 1]); b += lin(px[p + 2]); n++; }
    out[(a.key || '?') + '|' + (a.series || '?')] = n ? [r / n, g / n, b / n, n] : null; }
  const SC = TREE_FILL.stands(), mixKey = SC.get().mixKey, M = TREE_FILL.biomes().mixOf(mixKey);
  const st = SC.stat ? SC.stat() : {};
  return JSON.stringify({ sheets: out, mixKey, species: Object.keys(M.species || {}), level: st.level, levelSrc: st.levelSrc }); })()`;
// one frame of the held view, read back: the canvas pixels (the frame as drawn)
const GRAB = `(async () => { await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const R = WORLD.renderer, gl = R.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  R.render(WORLD.scene, WORLD.camera);
  const px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return px; })()`;
// the frames stay in the page; the masked means are computed there (the tree pixels: where a frame differs from 'neither')
const GRABTO = m => `(async () => { window.__CM = window.__CM || {}; window.__CM['${m}'] = await ${GRAB}; return 1; })()`;
const MEANS = `(() => { const lin = v => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const Z = window.__CM.none, mean = A => { let r = 0, g = 0, b = 0, n = 0;
    for (let p = 0; p < A.length; p += 4) { const d = Math.abs(A[p] - Z[p]) + Math.abs(A[p + 1] - Z[p + 1]) + Math.abs(A[p + 2] - Z[p + 2]);
      if (d > 12) { r += lin(A[p]); g += lin(A[p + 1]); b += lin(A[p + 2]); n++; } }
    return n ? { r: r / n, g: g / n, b: b / n, y: (0.2126 * r + 0.7152 * g + 0.0722 * b) / n, cover: n / (A.length / 4) } : null; };
  return JSON.stringify({ imps: mean(window.__CM.imps), cards: mean(window.__CM.cards) }); })()`;
const MODE = m => `(() => { const SC = TREE_FILL.stands(); const fillMat = [];
  WORLD.scene.traverse(o => { if (o.isInstancedMesh && o.userData && o.userData.fill && o.geometry && o.geometry.attributes && o.geometry.attributes.aLayer) fillMat.push(o.material); });   // the fill's merged impostor meshes (impMerged: a BufferGeometry with a per-instance layer - not a PlaneGeometry: the census of 13 Oct 01:40 found none that way)
  const fillOn = ${m === 'imps'}, cardsOn = ${m === 'cards'};
  for (const mt of new Set(fillMat)) mt.visible = fillOn;
  SC.root.visible = cardsOn; if (cardsOn) SC.set({ standIn: false, near: 0 });
  return fillMat.length; })()`;

(async () => {
  let tgt = null;
  for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); } };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async x => { const r = await cmd('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); const d = r.result;
    if (!d || d.exceptionDetails) throw new Error('page: ' + JSON.stringify(d && d.exceptionDetails).slice(0, 400)); return d.result.value; };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Page.addScriptToEvaluateOnNewDocument', { source: require('../_stock_pin.js').pinScript() });
  await cmd('Page.navigate', { url: URL });
  await sleep(1500);
  try { await ev("(() => (window.BOOT && BOOT.whenReady) ? BOOT.whenReady().then(() => 'ready') : new Promise(r => setTimeout(() => r('no BOOT'), 18500)))()"); } catch (e) { await sleep(18500); }
  let flying = false;
  for (let a = 0; a < 8 && !flying; a++) { await ev("(()=>{const b=[...document.querySelectorAll('button')].find(b=>/roll out/i.test(b.textContent)&&b.offsetParent);if(b)b.click();})()"); await sleep(6000); flying = await ev("/TAXI|DOWNWIND|FINAL/.test(document.body.innerText)"); }
  if (!flying) throw new Error('no roll-out');
  await ev("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click());})()");
  await sleep(3000);
  // over the densest forest within 3 km (the fill's own plants), 300 m up, held
  const where = await ev(`(async () => { const w = FLIGHT_PROBE.world(), s = FLIGHT_PROBE.sim(), cg = s.cgPos(); let best = null;
    for (let gz = -3000; gz <= 3000; gz += 500) for (let gx = -3000; gx <= 3000; gx += 500) { const x = cg[0] + gx, z = cg[2] + gz;
      const n = TREE_FILL.plants(x - 150, z - 150, x + 150, z + 150).length / 3; if (!best || n > best.n) best = { x, z, n }; }
    await FLIGHT_PROBE.place({ by: [best.x - cg[0], w.terrainH(best.x, best.z) + 300 - cg[1], best.z - cg[2] + 600], zeroV: true });
    const b = document.getElementById('bPause'); if (b && /pause/i.test(b.textContent)) b.click();
    return JSON.stringify(best); })()`);
  for (let i = 0; i < 90; i++) { const q = await ev("JSON.stringify(TREE_FILL.stream ? TREE_FILL.stream() : {})"); const s = JSON.parse(q); if (!s.queued && !s.stale) break; await sleep(1000); }
  await sleep(4000);
  const pass = async tag => {
    const sheets = JSON.parse(await ev(SHEETS));
    for (const m of ['none', 'imps', 'cards']) { await ev(MODE(m)); await sleep(1500); await ev(GRABTO(m)); }
    await ev(MODE('imps')); await ev('TREE_FILL.stands().set({ standIn: true, near: 4000 }); TREE_FILL.stands().root.visible = true');
    const MM = JSON.parse(await ev(MEANS)), I = MM.imps, C = MM.cards;
    return { tag, sheets, screen: { imps: I, cards: C, ratio: I && C ? { r: C.r / I.r, g: C.g / I.g, b: C.b / I.b, y: C.y / I.y } : null } };
  };
  if (COMPOSE !== null) {   // the card rebuilt the other way, then let it settle
    await ev("(() => { const SC = TREE_FILL.stands(); if (SC && SC.set) SC.set({ compose: " + (COMPOSE === '0' ? 'false' : 'true') + " }); return 1; })()");
    for (let i = 0; i < 60; i++) { if (await ev("!!(TREE_FILL.stands() && TREE_FILL.stands().atlas())")) break; await sleep(1000); }
    await sleep(4000);
  }
  const res = { url: URL, compose: await ev("(() => { const SC = TREE_FILL.stands(); return SC && SC.get ? SC.get().compose : null; })()"), where: JSON.parse(where), passes: [] };
  res.passes.push(await pass('default'));
  await ev("(() => { const m = TREE_LEAF.master(); TREE_LEAF.tint({ light: m.light * 1.5, hue: (m.hue || 0) + 0.05 }); return 1; })()");
  res.passes.push(await pass('tinted'));
  if (GATE) {
    await ev("(() => { const m = TREE_LEAF.master(); TREE_LEAF.tint({ light: m.light / 1.5, hue: (m.hue || 0) - 0.05 }); return 1; })()");   // the default look back
    const key = await ev("(() => { const a = TREE_FILL.stands().atlas(); return a ? a.key + '|' + a.series : null; })()");
    const k0 = key ? await ev("TREE_LOD.impLevel(" + JSON.stringify(key) + ")") : null;
    if (key) await ev("TREE_LOD.impLevel(" + JSON.stringify(key) + ", " + (k0 * 0.5) + ")");
    res.control = await pass('control: the card at half its level');
    if (key) await ev("TREE_LOD.impLevel(" + JSON.stringify(key) + ", " + k0 + ")");
  }
  ws.close(); kill();
  fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
  for (const P of res.passes) {
    const S = P.sheets, card = Object.entries(S.sheets).find(([k]) => k.startsWith('stand:'));
    const spp = Object.entries(S.sheets).filter(([k, v]) => v && S.species.some(sp => k.startsWith(sp + '|')));
    const y = v => 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
    const sy = spp.length ? spp.reduce((a, [, v]) => a + y(v), 0) / spp.length : NaN;
    console.log(`${P.tag}: the card's level ${S.level === undefined ? "(none: master)" : S.level + " (" + S.levelSrc + ")"}`);
    console.log(`${P.tag}: card sheet ${card ? card[0] + ' luma ' + y(card[1]).toFixed(4) : 'none'} vs its species' sheets (${spp.length}) mean luma ${sy.toFixed(4)} -> ${card ? (y(card[1]) / sy).toFixed(2) : '-'}x`);
    const R = P.screen.ratio; console.log(`   on screen cards / impostors: r ${R && R.r.toFixed(2)} g ${R && R.g.toFixed(2)} b ${R && R.b.toFixed(2)} luma ${R && R.y.toFixed(2)} (cover imps ${P.screen.imps && P.screen.imps.cover.toFixed(2)}, cards ${P.screen.cards && P.screen.cards.cover.toFixed(2)})`);
  }
  console.log('-> ' + OUT);
  if (GATE) {
    const y = P => P && P.screen && P.screen.ratio ? P.screen.ratio.y : NaN, d = y(res.passes[0]), c = y(res.control);
    const inB = v => v >= BAND[0] && v <= BAND[1];
    console.log('  default look on screen ' + (isFinite(d) ? d.toFixed(2) : '-') + ' (band ' + BAND.join('-') + ') ' + (inB(d) ? 'ok' : 'RED') +
                ' | control (half level) ' + (isFinite(c) ? c.toFixed(2) : '-') + ' ' + (isFinite(c) && !inB(c) ? 'fails as it must' : 'RED: the row cannot see a mismatch'));
    console.log('GATE CARDMATCH: ' + (inB(d) && isFinite(c) && !inB(c) ? 'PASS' : 'FAIL'));
    process.exitCode = inB(d) && isFinite(c) && !inB(c) ? 0 : 1;
  }
})().catch(e => { console.error('cardmatch_probe: ' + (e && e.stack || e)); kill(); process.exit(1); });
