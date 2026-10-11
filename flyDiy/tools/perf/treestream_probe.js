#!/usr/bin/env node
// treestream_probe.js - THE TREE STREAM ON THE ISLAND (TREE-STREAM G2934, 2026-10-11)
//
// The user: "far away, everything is OK, then there is a transition with nothing, then the more detailed trees will
// load, eventually, per tile, and sometimes after a really long time." The node rows (GATE WORLDRENDER S1-S4) hold the
// streamer's law on a headless analytic world; this is the page's half, on Jolene at the user's density:
//   EDIT  the whole ring re-walked (TREE_FILL.set(NG): the density dial, the same path as a mix or biome edit)
//   JUMP  the aircraft placed JUMP_M toward the island's middle (a teleport, a location switch's worst case)
// and in each, sampled every 200 ms for at most CAP s: when the ring within 1.5 / 3 / 4 km stands (WORLD.ringReady:
// every chunk's base and complement BUILT - on master an unbuilt chunk inside 4 km is bare ground, the stand cards
// being cut at 4 km), the fill's per-part cost at this density (TREE_FILL.stat deltas), the frame's own length
// (rAF intervals: the urgent budget's price) and, where the build has it (G2933, TREE_FILL.stream), the cells with
// NEITHER layer (holes, holeFrames), the cards standing in, the stale parts, the worst need -> ready of a near part.
// Works on master and on the branch alike (the stream rows read '-' on master).
//
// Usage: node tools/perf/treestream_probe.js --url http://localhost:PORT/flyDiy/dev.html [--ng 200] [--cap 150]
//                                            [--jump 5000] [--out tools/perf/treestream_<tag>.json] [--tag branch]
// A MEASUREMENT on the GPU: take the box's GPU lock first (tools/perf/boxlock.sh), never beside a node battery.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL = opt('url', 'http://localhost:8358/flyDiy/dev.html');
const NG = +opt('ng', 200), CAP = +opt('cap', 150), JUMP = +opt('jump', 5000), TAG = opt('tag', 'run');
const OUT = opt('out', path.join(__dirname, 'treestream_' + TAG + '.json'));
const PORT = 9400 + (process.pid % 500);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('treestream_probe: no Chrome found'); process.exit(2); }
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--window-size=1920,1080', '--hide-scrollbars', '--no-first-run',
  '--user-data-dir=' + path.join(require('os').tmpdir(), 'cdp_ts_' + PORT + '_' + Date.now()),
  '--disable-gpu-sandbox', '--disable-frame-rate-limit', '--disable-gpu-vsync', 'about:blank'], { stdio: 'ignore' });
const kill = () => { try { ch.kill(); } catch (e) {} };
process.on('exit', kill);
for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(sig, () => { kill(); process.exit(1); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });

// the page's side: a sampler (every 200 ms) and a frame clock (every rAF), both on window.__TS
const ARM = `(() => { const T = window.__TS = { rows: [], frames: [], last: performance.now(), on: true };
  const tick = () => { const n = performance.now(); if (T.on) T.frames.push(+(n - T.last).toFixed(2)); T.last = n; requestAnimationFrame(tick); };
  requestAnimationFrame(tick); return 'armed'; })()`;
const SAMPLE = `(() => { const s = FLIGHT_PROBE.sim(), cg = s.cgPos(), W = WORLD, F = window.TREE_FILL;
  const st = F && F.stat ? F.stat() : null, rs = W.ringStat ? W.ringStat() : null, sr = F && F.stream ? F.stream() : null;
  return JSON.stringify({ t: performance.now(), r15: !!W.ringReady(cg, 1500, true), r30: !!W.ringReady(cg, 3000, true), r40: !!W.ringReady(cg, 4000, true),
    gens: st ? st.gens : null, walkMs: st ? st.walkMs : null, buildMs: st ? st.buildMs : null, maxMs: st ? st.maxMs : null, frameMax: st ? st.frameMax : null,
    queued: rs ? rs.queued : null, base: rs ? rs.base : null, fill: rs ? rs.fill : null,
    stream: sr ? { holes: sr.holes, holeFrames: sr.holeFrames || 0, standInNear: sr.standInNear, stale: sr.stale, urgent: sr.urgent, nearMaxMs: sr.nearMaxMs, oldestMs: sr.oldestMs, swaps: sr.swaps } : null }); })()`;

(async () => {
  let tgt = null;
  for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  if (!tgt) throw new Error('no page target');
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); } };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); const d = r.result;
    if (!d || d.exceptionDetails) throw new Error('page: ' + (d && d.exceptionDetails ? (d.exceptionDetails.exception && d.exceptionDetails.exception.description) || d.exceptionDetails.text : JSON.stringify(r))); return d.result.value; };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.addScriptToEvaluateOnNewDocument', { source: require('../_stock_pin.js').pinScript() });
  await cmd('Page.navigate', { url: URL });
  await sleep(1500);
  try { await ev("(() => (window.BOOT && BOOT.whenReady) ? BOOT.whenReady().then(() => 'ready') : new Promise(r => setTimeout(() => r('no BOOT'), 18500)))()"); } catch (e) { await sleep(18500); }
  await sleep(500);
  let flying = false;
  for (let a = 0; a < 8 && !flying; a++) {
    // ONE roll-out button (the rigs' forEach clicked every match: flydiy-rig-flag-traps)
    await ev("(()=>{const b=[...document.querySelectorAll('button')].find(b=>/roll out/i.test(b.textContent)&&b.offsetParent);if(b)b.click();})()");
    await sleep(6000);
    flying = await ev("/TAXI|DOWNWIND|FINAL/.test(document.body.innerText)");
  }
  if (!flying) throw new Error('the roll-out never happened');
  await ev("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click());})()");
  await sleep(4000);
  if (!(await ev("typeof treeReady === 'function' && treeReady()"))) throw new Error('the tree payload never arrived - the world is drawing cones');
  const gpu = await ev("(()=>{const g=WORLD.renderer.getContext();const d=g.getExtension('WEBGL_debug_renderer_info');return d?g.getParameter(d.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER);})()");
  const build = await ev("String(window.FLYDIY_BUILD || '')");
  const hasStream = await ev("!!(window.TREE_FILL && TREE_FILL.stream)");
  // held: the sim paused, the world still streams and renders
  await ev("(()=>{const b=document.getElementById('bPause');if(b&&/pause/i.test(b.textContent))b.click();return b&&b.textContent;})()");
  await ev(ARM);
  const ng0 = await ev("TREE_FILL.get()");
  // the ring settled at the preset's density first (at most CAP s), so EDIT starts from a whole ring
  for (let i = 0; i < CAP * 2; i++) { const s = JSON.parse(await ev(SAMPLE)); if (s.r40 && !s.queued) break; await sleep(500); }
  const phase = async (name, act) => {
    await ev("(()=>{__TS.frames.length=0;" + (hasStream ? "TREE_FILL.stream(true);" : "") + "})()");
    const s0 = JSON.parse(await ev(SAMPLE));
    if (act) await ev(act);
    const t0 = s0.t, rows = [];
    let at = { r15: null, r30: null, r40: null, fresh: null };
    for (let i = 0; i < CAP * 5; i++) {
      await sleep(200);
      const s = JSON.parse(await ev(SAMPLE)); s.dt = (s.t - t0) / 1000; rows.push(s);
      for (const k of ['r15', 'r30', 'r40']) if (s[k] && at[k] === null) at[k] = +s.dt.toFixed(1);
      if (s.stream && !s.stream.stale && !s.queued && at.fresh === null) at.fresh = +s.dt.toFixed(1);
      if (at.r40 !== null && !s.queued && (!s.stream || !s.stream.stale)) break;
    }
    const fr = JSON.parse(await ev("JSON.stringify(__TS.frames)")).slice(1).sort((a, b) => a - b);
    const q = k => fr.length ? fr[Math.min(fr.length - 1, Math.floor(k * fr.length))] : null;
    const last = rows[rows.length - 1] || s0, gens = (last.gens || 0) - (s0.gens || 0);
    const per = gens > 0 ? { parts: gens, walkMs: +(((last.walkMs || 0) - (s0.walkMs || 0)) / gens).toFixed(1), buildMs: +(((last.buildMs || 0) - (s0.buildMs || 0)) / gens).toFixed(1) } : null;
    const sr = last.stream;
    const holesMax = rows.reduce((m, r) => Math.max(m, r.stream && r.stream.holes || 0), 0);
    const notR40 = rows.filter(r => !r.r40).length * 0.2;
    return { name, at, seconds: +(last.dt || 0).toFixed(1), notReady4kmS: +notR40.toFixed(1), per,
             frames: { n: fr.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: fr.length ? fr[fr.length - 1] : null }, streamFrameMaxMs: last.frameMax,
             stream: sr ? { holeFrames: sr.holeFrames, holesMax, nearMaxMs: sr.nearMaxMs, swaps: sr.swaps, standInNearMax: rows.reduce((m, r) => Math.max(m, r.stream && r.stream.standInNear || 0), 0), urgentS: +(rows.filter(r => r.stream && r.stream.urgent).length * 0.2).toFixed(1) } : null };
  };
  const res = [];
  res.push(await phase('EDIT (density ' + ng0 + ' -> ' + NG + ')', 'TREE_FILL.set(' + NG + ')'));
  const JUMPJS = `(async () => { const w = FLIGHT_PROBE.world(), B = w.bounds, s = FLIGHT_PROBE.sim(), cg = s.cgPos();
    const mx = (B.x0 + B.x1) / 2, mz = (B.z0 + B.z1) / 2, d = Math.hypot(mx - cg[0], mz - cg[2]) || 1, k = Math.min(1, ${JUMP} / d);
    const x = cg[0] + (mx - cg[0]) * k, z = cg[2] + (mz - cg[2]) * k, gy = w.terrainH(x, z);
    await FLIGHT_PROBE.place({ by: [x - cg[0], gy + 300 - cg[1], z - cg[2]], zeroV: true }); return [x | 0, z | 0].join(','); })()`;
  res.push(await phase('JUMP (' + JUMP + ' m toward the middle, 300 m AGL)', JUMPJS));
  // BIOME (G2935, the user 12 Oct: "the biome polygon does nothing I can see"): a 400 m square of OPEN ground near the
  // aircraft (the fewest fill trees, mostly GRASS) is given a forest mix through the overlay's own interface - vegAt,
  // vegPolys (the premises frame's box), vegSig - and TREE_FILL.vegChanged() is called as the editor's rebuild calls it;
  // the walk's trees in the square (TREE_FILL.plants: the streamer's own walk) before and after, the far cards
  // restaled, the parts' swap; then the polygon goes and the square is counted again
  const BIOME = `(async () => { const w = FLIGHT_PROBE.world(), O = w.premises && w.premises.overlay, F = O && O.frame, TF = window.TREE_FILL, B = TF.biomes && TF.biomes();
    if (!O || !F || !B) return JSON.stringify({ skipped: 'no overlay / frame / biomes' });
    const cg = FLIGHT_PROBE.sim().cgPos(), H = 200;
    let best = null;
    for (let gz = -2400; gz <= 2400; gz += 400) for (let gx = -2400; gx <= 2400; gx += 400) { const x = cg[0] + gx, z = cg[2] + gz;
      if (Math.hypot(gx, gz) < 600) continue;
      let g = 0, n = 0; for (let k = -H; k <= H; k += 50) for (let l = -H; l <= H; l += 50) { n++; if (w.treeGround(x + k, z + l) === w.SURFACE.GRASS && w.terrainH(x + k, z + l) > 2) g++; }
      if (g / n < 0.7) continue;
      const t = TF.plants(x - H, z - H, x + H, z + H).length / 3;
      if (!best || t < best.t) best = { x, z, t, grass: +(g / n).toFixed(2) }; }
    if (!best) return JSON.stringify({ skipped: 'no open square within 2.4 km' });
    const mix = B.mixes.conifer ? 'conifer' : Object.keys(B.mixes).find(k => B.mixes[k].forest && B.mixes[k].forest.count > 0);
    const x0 = best.x - H, x1 = best.x + H, z0 = best.z - H, z1 = best.z + H;
    const loc = (x, z) => { const dx = x - F.anchor.x, dz = z - F.anchor.z; return [dx * F.c - dz * F.s, dx * F.s + dz * F.c]; };
    const cs = [loc(x0, z0), loc(x1, z0), loc(x1, z1), loc(x0, z1)];
    const bbox = { x0: Math.min(...cs.map(c => c[0])), z0: Math.min(...cs.map(c => c[1])), x1: Math.max(...cs.map(c => c[0])), z1: Math.max(...cs.map(c => c[1])) };
    const vegAt0 = O.vegAt, polys0 = O.vegPolys, sig0 = O.vegSig;
    const SC = TF.stands && TF.stands(), r0 = SC && SC.stat ? (SC.stat().restaled || 0) : null;
    O.vegAt = function (x, z) { return (x >= x0 && x <= x1 && z >= z0 && z <= z1) ? mix : vegAt0.call(this, x, z); };
    O.vegPolys = (polys0 || []).concat([{ id: '__probe', poly: cs, bbox, mix }]); O.vegSig = sig0 + '|probe';
    const t0 = performance.now(); TF.vegChanged(); const veg = performance.now() - t0;
    const after = TF.plants(x0, z0, x1, z1).length / 3;
    let fresh = null; for (let i = 0; i < 300; i++) { await new Promise(r => setTimeout(r, 100)); const q = TF.stream ? TF.stream() : null; if (!q || (!q.stale && !q.queued)) { fresh = +((performance.now() - t0) / 1000).toFixed(1); break; } }
    const r1 = SC && SC.stat ? (SC.stat().restaled || 0) : null;
    O.vegAt = vegAt0; O.vegPolys = polys0; O.vegSig = sig0; TF.vegChanged();
    const back = TF.plants(x0, z0, x1, z1).length / 3;
    return JSON.stringify({ at: [best.x | 0, best.z | 0], grass: best.grass, mix, before: best.t, after, back, vegChangedMs: +veg.toFixed(1), freshS: fresh, cardsRestaled: r1 === null ? null : r1 - r0 }); })()`;
  let biome = null;
  try { biome = JSON.parse(await ev(BIOME)); } catch (e) { biome = { error: String(e && e.message || e) }; }
  ws.close(); kill();
  const out = { date: new Date().toISOString(), tag: TAG, url: URL, build, gpu, ng: NG, ng0, hasStream, phases: res, biome };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(`treestream_probe ${TAG}  build ${build}  ${gpu}  density ${ng0} -> ${NG}  stream API ${hasStream ? 'yes' : 'no (master)'}`);
  for (const p of res) {
    console.log(`  ${p.name}: ring 1.5/3/4 km at ${p.at.r15}/${p.at.r30}/${p.at.r40} s${p.at.fresh !== null ? ', fresh at ' + p.at.fresh + ' s' : ''}; 4 km not whole ${p.notReady4kmS} s; frames p50 ${p.frames.p50} p95 ${p.frames.p95} p99 ${p.frames.p99} max ${p.frames.max} ms`);
    if (p.per) console.log(`     per part at this density: walk ${p.per.walkMs} + build ${p.per.buildMs} ms (${p.per.parts} parts); streamer's worst frame ${p.streamFrameMaxMs && p.streamFrameMaxMs.toFixed(1)} ms`);
    if (p.stream) console.log(`     holes: ${p.stream.holeFrames} frames (max ${p.stream.holesMax} cells); cards standing in near: max ${p.stream.standInNearMax}; near part worst ${(p.stream.nearMaxMs / 1000).toFixed(1)} s; swaps ${p.stream.swaps}; urgent ${p.stream.urgentS} s`);
  }
  if (biome) console.log('  BIOME polygon (' + (biome.mix || '-') + ' over open ground at ' + (biome.at || '-') + '): ' + (biome.skipped || biome.error || ('trees in the 400 m square ' + biome.before + ' -> ' + biome.after + ' -> ' + biome.back + ' (removed); vegChanged ' + biome.vegChangedMs + ' ms; the ring fresh at ' + biome.freshS + ' s; far card chunks restaled ' + biome.cardsRestaled)));
  console.log('  -> ' + OUT);
})().catch(e => { console.error('treestream_probe: ' + (e && e.stack || e)); kill(); process.exit(1); });
