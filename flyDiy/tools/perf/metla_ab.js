#!/usr/bin/env node
// metla_ab.js - METLA-RETURN (G1190-G1199): THE TOWN ON AGAINST OFF, the master bench's own scenes and rig.
// For each slot of --order (A = the town off, B = the town on: ?town=1) and each build: a page load (navigation ->
// garage), the first roll-out (garage -> world: the first flight is the two), the taxi in the chase view, the low pass
// at HOME. The same profile for every slot (warmed once, discarded). Per scene: master_bench's statistics, plus every
// frame over --long ms (default 80) with the flight recorder's slot split, and the recorder's events in the window
// (long tasks, LoAF scripts, premises built, links). --cpuprof <scene substring>: a CDP CPU profile over that scene,
// the heaviest self / inclusive functions inside its long tasks. --check: the generators (SPORT_GEN, MARINE_GEN) and
// the town's sport/marine entries built, every load. Exceptions are counted per load.
// Usage: node tools/perf/metla_ab.js --port 8651 --udd D:/um1 [--order A,B,B,A] [--builds cub,metal] [--taxi 15]
//          [--pass 15] [--cpuprof pass] [--out file.json] [--warmup A|B]
// METLA-TAXI (G1435): --gfx user|<file.json> (the user's custom near-ultra set, shader_guard's USER_GFX; default: none =
// the preset's default, gamer); --frames: every recorder row of each scene kept (t, dt, work, gpu, calls, tris, cap, the
// slots) with frame_dist's distribution; with --cpuprof, the profile is ALSO split per frame: the interval between two
// rendered frames' starts belongs to the EARLIER frame (EVEN-30: the recorder's dt is the gap BEFORE a frame, so the cost
// of a long interval sits in the previous frame's slots), and the self time a frame of each class (an interval over
// 1.25x the cap's frame time = 'long', else 'even') is compared function by function; the page's and the profile's
// clocks are aligned on a marker (__mtCal, a 12 ms busy loop at a known performance.now()). --toggle <file.js>: a
// snippet run at the middle of the taxi (the frames split into halves 'h0' / 'h1') - an in-page A/B of a suspect.
'use strict';
const fs = require('fs'), path = require('path');
const MB = require('../master_bench.js');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const PORT = +opt('port', 0), UDD = opt('udd', null);
if (!PORT || !UDD) { console.error('metla_ab: --port and --udd are required'); process.exit(2); }
const ORDER = opt('order', 'A,B,B,A').split(','), WANT = opt('builds', 'cub,metal').split(',');
const SEC = { taxi: +opt('taxi', 15), pass: +opt('pass', 15) }, LONG = +opt('long', 80), PROF = opt('cpuprof', null);
const OUT = path.resolve(opt('out', path.join(__dirname, 'metla_ab_' + Date.now() + '.json')));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BASE = 'http://localhost:' + PORT + '/flyDiy/index.html';
const SIDE = { A: 'town=0', B: 'town=1', M: 'town=1', T: 'town=1', C: 'town=0', P: 'town=1&towntrees=0' };   // TOWN-1: P = the town on, its trees its own (the before); M = B's flags on a master tree (a run per tree, same --udd)   // G1435: T = the town on, --toggle run at the taxi's middle (its rows apart)   // G1408: the town is ON by default - A says off explicitly
// G1435: the user's custom near-ultra (flydiy-flightlog-20261003T165355-7u7a header.gfx; tools/perf/shader_guard.js USER_GFX)
const USER_GFX = { preset: 'custom', pv: 6, fps: 'auto', ground: 'full', scale: 1, cover: 'full', scenery: 'full', drawDist: 'vis', terrain: 1, aa: 'full', density: 200,
  bands: 'mid', shadows: 'full', canopy: 'on', rails: 'on', poles: 'on', glare: 'on', sway: 'on', mist: 'land', clouds: 'full', water: 'full', mirror: 'live', lighting: 'sunset',
  tone: 'cineon', exposure: 1, colour: 'managed', bloom: 'soft', look: 'off', lens: 'off', rays: 'on', ao: 'off', eye: 'on', compositing: 'linear', town: 'nearby' };
const GFX = opt('gfx', null) === 'user' ? USER_GFX : opt('gfx', null) ? JSON.parse(fs.readFileSync(opt('gfx'), 'utf8')) : null;
const APPROACH = { sec: +opt('approach', 0), x: +String(opt('approach-at', '-2900,-8400')).split(',')[0], z: +String(opt('approach-at', '-2900,-8400')).split(',')[1], from: +opt('approach-from', 8000) };
// TOWN-1 (2026-11-07): --shots <dir>: the town's trees in stills - in the approach (the chase view at 3.4, 1.8 and 0.5 km out
// with --approach-from 4000, --approach 100) and, the flight held, the free camera on the town's tree centroid from inside,
// its edge, 400 m and 1.3 km out (the aeroplane and the UI hidden), named <side>_<build>_<view>.jpg
const SHOTS = opt('shots', null);
// TOWN-1 (A0 8 Nov: "name the +142 calls - which cells and materials"): --census (on with --shots) wraps the renderer's
// renderBufferDirect over a scene and over each still view and counts the draws per frame by key: the scene's top group |
// the nearest named object | the fill chunk + series | the material | the geometry's index count | the pass (main, shadow,
// a render target). Untimed runs only (a Map write per draw). tools/perf/census_diff.js subtracts one side from another.
const CENSUS = !!SHOTS || argv.includes('--census');
const CEN_ON = "(() => { const R = FLIGHT_PROBE.renderer(), C = window.__CEN || (window.__CEN = {}); C.m = new Map(); C.f = 0; C.on = true;"
  + " if (!C.orig) { C.orig = R.renderBufferDirect; R.renderBufferDirect = function (cam, scene, geo, mat, obj, grp) { const C = window.__CEN; if (C.on) { try {"
  + " let t = obj; while (t.parent && !t.parent.isScene) t = t.parent; let n = obj; while (n && !n.name) n = n.parent;"
  + " const e = obj.matrixWorld.elements, fill = obj.userData && obj.userData.fill ? 'fill s' + obj.userData.ser + ' c' + Math.floor(e[12] / 1000) + ',' + Math.floor(e[14] / 1000) : '';"
  + " const sh = mat.isMeshDepthMaterial || mat.isMeshDistanceMaterial || mat === obj.customDepthMaterial || mat === obj.customDistanceMaterial, rt = R.getRenderTarget();"
  + " const k = (t === obj ? '-' : (t.name || t.type)) + '|' + (n ? n.name : '') + '|' + fill + '|' + (mat.name || mat.type) + '|' + (geo.index ? geo.index.count : geo.attributes.position ? geo.attributes.position.count : 0) + (obj.isInstancedMesh ? 'i' : '') + '|' + (sh ? 'shadow' : rt ? 'rt' : 'main');"
  + " C.m.set(k, (C.m.get(k) || 0) + 1); } catch (x) {} } return C.orig.apply(this, arguments); }; }"
  + " if (!C.rorig) { C.rorig = R.render; R.render = function (sc, cam) { const C = window.__CEN; if (C.on && cam === FLIGHT_PROBE.camera()) C.f++; return C.rorig.apply(this, arguments); }; } C.t = 0; const tick = () => { if (!C.on) return; C.t++; requestAnimationFrame(tick); }; requestAnimationFrame(tick); return 1; })()";
const CEN_OFF = "(() => { const C = window.__CEN; if (!C) return 'null'; C.on = false; const f = Math.max(1, C.f), a = [...C.m].map(([k, v]) => [k, +(v / f).toFixed(2)]).sort((p, q) => q[1] - p[1]);"
  + " return JSON.stringify({ frames: C.f, ticks: C.t, perFrame: +a.reduce((s, x) => s + x[1], 0).toFixed(1), keys: a.slice(0, 600) }); })()";
// TOWN-1 8 Nov: the B page of the 17:45 run drew ~13 calls a frame with its world loaded and the aeroplane intact (sky
// only, chase and free views): the render state at each check - the camera's frustum terms and the draws per main render
// over 1.5 s - and a side under 60 draws is BLANK (logged, marked on the row, never a cost)
const RSTATE = "(async () => { const R = FLIGHT_PROBE.renderer(), cam = FLIGHT_PROBE.camera(); let n = 0, f = 0; const o = R.renderBufferDirect, r0 = R.render;"
  + " const mine = function () { n++; return o.apply(this, arguments); }, mineR = function (sc, c) { if (c === cam) { f++; window.__RS_SCENE = sc; } return r0.apply(this, arguments); };"
  + " R.renderBufferDirect = mine; R.render = mineR; await new Promise(r => setTimeout(r, 1500)); if (R.renderBufferDirect === mine) R.renderBufferDirect = o; if (R.render === mineR) R.render = r0;"
  + " const fin = m => m.elements.every(Number.isFinite), p = cam.position;"
  + " return JSON.stringify({ draws: f ? +(n / f).toFixed(1) : null, renders: f, cam: { fov: cam.fov, near: cam.near, far: cam.far, aspect: +(+cam.aspect).toFixed(3), layers: cam.layers.mask, proj: fin(cam.projectionMatrix), world: fin(cam.matrixWorld), pos: [p.x, p.y, p.z].map(Math.round) } }); })()";
// A0 8 Nov: a BLANK side may be a game bug, not the rig - at that moment the camera AND the scene graph: the scene the main
// camera renders (the world's or another), its top children (visible, layers, size), and the meshes through each of
// three's gates (visible chain, layers, the bounds' centre in the view, a NaN bound) - the camera's own matrices, no THREE
const BLANKDUMP = "(() => { const cam = FLIGHT_PROBE.camera(), R = FLIGHT_PROBE.renderer(); let S = FLIGHT_PROBE.craft() && FLIGHT_PROBE.craft().parent; while (S && S.parent) S = S.parent; const M = window.__RS_SCENE || S;"
  + " const fin = m => m.elements.every(Number.isFinite), v = cam.position.clone(), n = { meshes: 0, visible: 0, layers: 0, noCull: 0, inView: 0, nanBound: 0, noBound: 0 }, inView = {}, nan = [];"
  + " cam.updateMatrixWorld(); M.traverse(o => { if (!o.isMesh && !o.isPoints && !o.isLine && !o.isSprite) return; n.meshes++; for (let t = o; t; t = t.parent) if (!t.visible) return; n.visible++; if (!o.layers.test(cam.layers)) return; n.layers++;"
  + " let t = o; while (t.parent && t.parent !== M) t = t.parent; const top = t.name || t.type; if (o.frustumCulled === false) { n.noCull++; return; }"
  + " const bs = o.boundingSphere || (o.geometry && (o.geometry.boundingSphere || (o.geometry.computeBoundingSphere && (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere)))); if (!bs) { n.noBound++; return; }"
  + " if (!Number.isFinite(bs.radius) || !Number.isFinite(bs.center.x)) { n.nanBound++; if (nan.length < 8) nan.push(top + '/' + (o.name || o.type)); return; }"
  + " v.copy(bs.center).applyMatrix4(o.matrixWorld).applyMatrix4(cam.matrixWorldInverse).applyMatrix4(cam.projectionMatrix); if (Math.abs(v.x) <= 1.2 && Math.abs(v.y) <= 1.2 && v.z >= -1 && v.z <= 1) { n.inView++; inView[top] = (inView[top] || 0) + 1; } });"
  + " const p = cam.position;"
  + " return JSON.stringify({ scene: { name: M.name || M.type, isWorld: M === S, visible: M.visible, layers: M.layers.mask, kids: M.children.length, override: !!M.overrideMaterial, bg: M.background ? (M.background.isColor ? 'color' : M.background.isTexture ? 'texture' : 'other') : null },"
  + " cam: { type: cam.type, parent: cam.parent ? (cam.parent.name || cam.parent.type) : null, fov: cam.fov, near: cam.near, far: cam.far, aspect: cam.aspect, zoom: cam.zoom, layers: cam.layers.mask, proj: fin(cam.projectionMatrix), world: fin(cam.matrixWorld), inv: fin(cam.matrixWorldInverse), pos: [p.x, p.y, p.z].map(Math.round), up: [cam.up.x, cam.up.y, cam.up.z] },"
  + " renderer: { autoClear: R.autoClear, rt: !!R.getRenderTarget(), lost: R.getContext().isContextLost(), shadows: R.shadowMap.enabled }, gates: n, inView, nan,"
  + " tops: M.children.slice(0, 40).map(o => (o.name || o.type) + (o.visible ? '' : ' HIDDEN') + (o.layers.mask !== 1 ? ' L' + o.layers.mask : '') + ' ' + o.children.length) }); })()";
const cenTop = c => { if (!c || !c.keys) return String(c); const g = {}; for (const [k, v] of c.keys) { const p = k.split('|'), kk = p[0] + '|' + p[5]; g[kk] = (g[kk] || 0) + v; }
  return c.frames + ' fr, ' + c.perFrame + ' draws/frame: ' + Object.entries(g).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => k + ' ' + v.toFixed(1)).join(', '); };
// TOWN-1 (2026-11-08, A0: "no wreck"): the rig's taxi + 60 m pass at HOME left the Cub a wreck ("short of Jolene 13/31",
// broke up) before the approach, on both sides. --approach-first: the approach right after the roll-out (the aeroplane as it
// rolled out), then the pass, no taxi; --pass-h <m>: the pass's height over HOME's ground (master_bench's 60 by default).
// Every scene logs the aeroplane's state before and after it (intact: no ending latched, the structure's own summary).
const APP_FIRST = argv.includes('--approach-first'), PASS_H = +opt('pass-h', 60);
const FRAMES = argv.includes('--frames') || !!PROF, TOGGLE = opt('toggle', null) ? fs.readFileSync(opt('toggle'), 'utf8') : null;
let FD = null; try { FD = require('../frame_dist.js'); } catch (e) {}
// every recorder row in [t0, t1], columnar
const ROWSQ = (t0, t1) => `JSON.stringify((() => { const R = window.FLIGHT_REC && FLIGHT_REC.rec; if (!R) return null; const K = ['t', 'dt', 'work', 'gpu', 'calls', 'tris', 'cap', 'flags'].concat(FLIGHT_REC.SLOTS);
  const o = {}; for (const k of K) o[k] = []; for (let f = Math.max(0, R.frame - 60000); f < R.frame; f++) { const r = R.row(f); if (r.t < ${t0} || r.t > ${t1}) continue; for (const k of K) o[k].push(r[k] === r[k] ? +(+r[k]).toFixed(k === 't' ? 1 : 2) : null); } return o; })())`;
const CAL = '(function __mtCal() { const a = performance.now(); let x = 0; while (performance.now() - a < 12) x += Math.sqrt(x + 1); return a; })()';

// the recorder's frames over LONG ms in [t0, t1] with their slot split, and its events there
const RECQ = (t0, t1) => `JSON.stringify((() => { const R = window.FLIGHT_REC && FLIGHT_REC.rec; if (!R) return null;
  const out = { long: [], ev: [] }; for (let f = Math.max(0, R.frame - 60000); f < R.frame; f++) { const r = R.row(f); if (r.t < ${t0} || r.t > ${t1} || !(r.dt > ${LONG} || r.work > ${LONG})) continue;
    const s = {}; for (const k of FLIGHT_REC.SLOTS) if (r[k] > 2) s[k] = Math.round(r[k]); out.long.push({ t: Math.round(r.t), dt: Math.round(r.dt), work: Math.round(r.work), gpu: Math.round(r.gpu || 0), slots: s }); }
  out.ev = R.events.filter(e => e[0] >= ${t0} - 500 && e[0] <= ${t1} && (e[1] !== 'prem' || e[2] > 8) && e[1] !== 'cap').slice(-60); return out; })())`;
const CHECK = `JSON.stringify((() => { const P = WORLD && WORLD.premises; const T = window.FLYDIY_TOWN || {};
  let sport = 0, marine = 0; try { for (const it of (P && P.items ? P.items() : []) || []) { const k = String(it.key || ''); if (k.startsWith('sport/')) sport++; if (k.startsWith('marine/')) marine++; } } catch (e) {}
  return { town: !!T.all, cut: T.n || 0, gfx: (() => { try { const g = window.GFX && GFX.get(); return g ? { preset: g.preset, fps: g.fps, town: g.town, density: g.density, shadows: g.shadows } : null; } catch (e) { return null; } })(), hw: window.HOUSE_WORKER && HOUSE_WORKER.stats ? HOUSE_WORKER.stats() : null, SPORT_GEN: !!window.SPORT_GEN, MARINE_GEN: !!window.MARINE_GEN, sportEntries: sport, marineEntries: marine,
    stats: P && P.stats ? { houses: P.stats.houses, objects: P.stats.objects, queued: P.stats.queued } : null, kit: P && P.kitTownStats ? (() => { try { return P.kitTownStats(); } catch (e) { return 'err ' + e.message; } })() : null }; })())`;

(async () => {
  if (await MB.serveRoot(PORT)) { console.error('metla_ab: port ' + PORT + ' is taken'); process.exit(4); }
  const srv = MB.serve(PORT, opt('fallback', null)); await sleep(800);   // G1435: --fallback D:/Dev/DeGaRoR.github.io from a worktree (the gitignored assets, bench, media)
  const root = await MB.serveRoot(PORT);
  if (!root || path.resolve(root) !== path.resolve(__dirname, '..', '..', '..')) { console.error('metla_ab: the server serves ' + root); try { srv.kill(); } catch (e) {} process.exit(4); }
  const done = () => { try { srv.kill(); require('child_process').execSync('taskkill /PID ' + srv.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} };
  process.on('exit', done);
  const fresh = !fs.existsSync(UDD);
  // G1220: a fresh Chrome per slot (the same profile): in ONE session the ground's heaviest programs hit and miss the
  // program cache on alternate navigations, whatever the build - metla_ab1's 'metal +20 s' was its slot (CESSNA-LINKS).
  // --one-chrome: the old single session
  let b = await MB.browser(UDD);
  const R = { date: new Date().toISOString(), order: ORDER, builds: WANT, udd: UDD, fresh, gfx: GFX ? (GFX.preset || 'file') : 'default', rows: [] };
  const log = s => console.log('  ' + s);
  const shot = async (side, bk, n) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true });
    const r = await b.cmd('Page.captureScreenshot', { format: 'jpeg', quality: 88 }); const f = path.join(SHOTS, side + '_' + bk + '_' + n + '.jpg');
    fs.writeFileSync(f, Buffer.from(r.result.data, 'base64')); log('still ' + path.basename(f)); };
  const now = () => b.ev('performance.now()');
  const pull = async () => JSON.parse(await b.ev('JSON.stringify({ fr: __MB.fr.slice(-30000), lt: __MB.lt, sc: __MB.sc || [] })', 20000));
  const trip = async () => {   // the roll-out: press, wait for the trip's done and the screen gone
    const n0 = await b.ev(MB.A.trips), t0 = await now(), w0 = Date.now(); await b.ev(MB.A.rollOut);
    let d = null; const tEnd = Date.now() + 300000;
    while (Date.now() < tEnd) { const raw = await b.ev(MB.A.lastTrip, 30000); if (raw === "__timeout") { log("trip: the page busy over 30 s (a cold load), still waiting"); await sleep(500); continue; } d = JSON.parse(raw); if (d.n > n0 && d.kind === 'rollout' && d.done && d.boot === 'gone') break; d = null; await sleep(150); }
    const t1 = await now(), fr = await pull();
    return { ms: d ? d.ms : null, wall: +((Date.now() - w0) / 1000).toFixed(1), frames: MB.stat(fr.fr, fr.lt, t0, t1, fr.sc) };
  };
  const scene = async (name, sec, prof, tog) => {
    if (prof) { await b.cmd('Profiler.enable'); await b.cmd('Profiler.setSamplingInterval', { interval: +opt("cpuus", 1000) }); await b.cmd('Profiler.start'); }
    const RS = "JSON.stringify((() => { const P = FLIGHT_PROBE.world().premises, O = P && P.overlay; return O ? Object.assign({ cooked: O.rasterCooked || null }, O.raster) : null; })())";
    const r0 = JSON.parse(await b.ev(RS).catch(() => 'null'));
    const cal = prof ? +(await b.ev(CAL)) : null;
    const t0 = await now(); let tMid = null, tg = null;
    if (TOGGLE && tog && name === 'taxi') { await sleep(sec * 500); tMid = await now(); tg = await b.ev(TOGGLE, 20000).catch(e => 'error ' + e.message); log('toggle at ' + Math.round(tMid) + ': ' + String(tg).slice(0, 300)); await sleep(sec * 500); }
    else await sleep(sec * 1000);
    const t1 = await now();
    const r1 = JSON.parse(await b.ev(RS).catch(() => 'null'));
    const raster = r0 && r1 ? { baked: r1.baked - r0.baked, bakeMs: +(r1.bakeMs - r0.bakeMs).toFixed(1), evicted: r1.evicted - r0.evicted, decoded: r1.decoded - r0.decoded, tiles: r1.tiles, mb: +(r1.bytes / 1048576).toFixed(1), cookedCells: r1.cookedCells, cooked: r1.cooked, total: { baked: r1.baked, bakeMs: Math.round(r1.bakeMs), evicted: r1.evicted } } : null;
    let cpu = null; if (prof) { const p = await b.cmd('Profiler.stop'); cpu = p.result && p.result.profile; }
    const d = await pull(), st = MB.stat(d.fr, d.lt, t0, t1, d.sc);
    const rec = JSON.parse(await b.ev(RECQ(t0, t1), 20000));
    const tasks = d.lt.filter(x => x[0] + x[1] > t0 && x[0] < t1).sort((a, c) => c[1] - a[1]).slice(0, 5);
    const rows = FRAMES ? JSON.parse(await b.ev(ROWSQ(t0, t1), 30000)) : null;
    const halves = rows ? (tMid ? [['h0', t0, tMid], ['h1', tMid, t1]] : [['all', t0, t1]]).map(([k, a, z]) => [k, frameRead(rows, a, z)]) : null;
    return { scene: name, st, rec, tasks, t0, t1, tMid, toggle: tg, raster, rows, halves: halves ? Object.fromEntries(halves) : null,
      cpu: cpu ? hot(cpu, tasks.filter(x => x[1] >= 100), t0) : null, perFrame: cpu && rows ? perFrame(cpu, rows, cal, tMid) : null };
  };
  const flying = async () => { await sleep(1500); const a = await b.ev(MB.A.simT); await sleep(1200); const c = await b.ev(MB.A.simT); if (!(c > a)) await b.ev(MB.A.run); };
  let home = null;
  // G2060 (METLA-COOK): --warmup A: the fresh profile's discarded warm-up is a town-OFF load, so the first B slot is the
  // town's FIRST VISIT on a profile warm for everything else (its programs, caches and files never seen)
  const WU = opt('warmup', 'B');
  if (fresh) { log('== warm-up (discarded, ' + (SIDE[WU] || 'town=1') + ') ' + UDD); await b.load(BASE + '?' + (SIDE[WU] || 'town=1'), MB.preScript(MB.BUILDS[WANT[0]].build, GFX)); await trip(); await sleep(3000); }
  for (const side of ORDER) for (const bk of WANT) {
    const B = MB.BUILDS[bk]; log('== ' + side + ' (' + (SIDE[side] || 'town off') + ') ' + B.label);
    if ((R.rows.length || fresh) && !argv.includes('--one-chrome')) { await b.close(); b = await MB.browser(UDD); }   // G2060: the first slot too gets its own Chrome after a warm-up
    const e0 = b.exc.length;
    const l = await b.load(BASE + (SIDE[side] ? '?' + SIDE[side] : ''), MB.preScript(B.build, GFX, B.patch));
    const lk = await b.links(0, 1e12);
    // G2060: the house worker's cache at the garage (a first visit generates what a warm one reads back)
    const hwG = JSON.parse(await b.ev('JSON.stringify(window.HOUSE_WORKER && HOUSE_WORKER.stats ? HOUSE_WORKER.stats() : null)').catch(() => 'null'));
    if (!home) { const pl = JSON.parse(await b.ev('(async () => { for (let i = 0; i < 100 && !(window.FLIGHT_PROBE && FLIGHT_PROBE.world && FLIGHT_PROBE.world()); i++) await new Promise(r => setTimeout(r, 100)); return ' + MB.A.places + '; })()')); home = pl.find(p => p.id === 'HOME'); }
    await sleep(1500);
    const tr = await trip(); await flying();
    const row = { side, build: bk, garage: l.sec, rollout: tr.wall, firstFlight: +(l.sec + tr.wall).toFixed(1), rollFrames: tr.frames, links: lk, hwGarage: hwG };
    log('garage ' + l.sec + ' s, roll-out ' + tr.wall + ' s, first flight ' + row.firstFlight + ' s (links ' + lk.n + ', worst ' + lk.worstS + ' s, ' + lk.over5s + ' > 5 s)' + (hwG ? ', houses: built ' + hwG.built + ' hits ' + hwG.hits + ' misses ' + hwG.misses + ' gen ' + hwG.genMs + ' ms' : ''));
    await b.ev(MB.A.cam('chase'));
    const state = async () => JSON.parse(await b.ev("JSON.stringify((() => { const P = FLIGHT_PROBE; let st = null; try { st = P.structural ? P.structural() : null; } catch (e) {}"
      + " return { over: !!(P.over && P.over()), phase: P.ap ? P.ap().phase : null, crash: !!(P.damage && P.damage()), st: st ? JSON.stringify(st).slice(0, 160) : null }; })())").catch(() => 'null'));
    const intact = async (s, when) => { const x = await state(); if (x) { x.render = JSON.parse(await b.ev(RSTATE, 10000).catch(() => 'null')); if (x.render && x.render.draws != null && x.render.draws < 60) { log('  BLANK RENDER ' + when + ' ' + (s ? s.scene : '') + ': ' + JSON.stringify(x.render)); (row.blank || (row.blank = [])).push(when + (s ? ' ' + s.scene : '')); x.blankDump = JSON.parse(await b.ev(BLANKDUMP, 20000).catch(e => JSON.stringify('error ' + e.message))); log('  BLANK DUMP ' + JSON.stringify(x.blankDump)); } } if (s) (s.state || (s.state = {}))[when] = x; log('  aeroplane ' + when + ' ' + (s ? s.scene : '') + ': ' + JSON.stringify(x)); return x; };
    const passH = () => { const p = MB.A.pass(home, 42), q = p.replace(') + 60, z]', ') + ' + PASS_H + ', z]'); if (PASS_H !== 60 && q === p) throw new Error('--pass-h: master_bench pass changed'); return q; };
    const doTaxi = async () => { const x = await intact(null, 'before'); row.taxi = await scene('taxi', SEC.taxi, PROF && 'taxi'.includes(PROF), side === 'T' || side === 'C'); row.taxi.state = { before: x }; await intact(row.taxi, 'after'); };
    const doPass = async () => { if (APP_FIRST) { await b.ev(passH(), 20000).catch(() => 0); await sleep(12000); }   // (approach-first: HOME is ~9 km off; a first placement streams it, the measured one 12 s on)
      const x = await intact(null, 'before'); const ph = await b.ev(passH(), 20000).catch(e => 'error ' + e.message); await sleep(3000);
      row.pass = await scene('pass', SEC.pass, PROF && 'pass'.includes(PROF)); row.pass.pilot = ph; row.pass.state = { before: x }; await intact(row.pass, 'after'); };
    const doApproach = async () => {
    // G2063 (TOWN-GEO): --approach <sec> [--approach-at x,z] [--approach-from m]: the aeroplane put `from` metres (8000) from a
    // point (Metlakatla's middle) at 300 m over it, flying at it - the town's deferred patch and roads build on the way in
    if (APPROACH.sec > 0) { const x0 = await intact(null, 'before');
      const ap = await b.ev(`(async () => { const W = FLIGHT_PROBE.world(), tx = ${APPROACH.x}, tz = ${APPROACH.z}, d = ${APPROACH.from}, hx = (tx - ${home ? home.x : 0}), hz = (tz - ${home ? home.z : 0}), l = Math.hypot(hx, hz) || 1;
        const x = tx - hx / l * d, z = tz - hz / l * d, h = W.terrainH ? W.terrainH(x, z) : 0;
        await FLIGHT_PROBE.place({ at: [x, Math.max(h, 0) + 300, z], zeroV: true, dv: [hx / l * 45, 0, hz / l * 45] }); FLIGHT_PROBE.setManual(true); FLIGHT_PROBE.setManual(false);
        await new Promise(r => setTimeout(r, 600)); const ph0 = FLIGHT_PROBE.ap().phase;   // TOWN-1 8 Nov: the pilot left in TAXI 300 m up flew both sides into the ground
        if (ph0 === 'TAXI' || ph0 === 'DEPART' || ph0 === 'HOLD') { FLIGHT_PROBE.setManual(true); await new Promise(r => setTimeout(r, 200)); FLIGHT_PROBE.setManual(false); }
        const P = WORLD.premises, cg = FLIGHT_PROBE.sim().cgPos(); return JSON.stringify({ at: [Math.round(x), Math.round(z)], y: Math.round(cg[1]), h: Math.round(h), ph0, phase: FLIGHT_PROBE.ap().phase, onG: FLIGHT_PROBE.sim().wheelsOnGround(), pending: P && P.geoPending ? P.geoPending() : null, dist: P && P.geoDist ? Math.round(P.geoDist(x, z)) : null }); })()`, 20000).catch(e => 'error ' + e.message);
      await sleep(2000);
      // TOWN-1: the chase view's stills on the way in, timed off the placement (45 m/s), while the scene measures
      const sh = SHOTS ? [600, 1200, 1800, 2400, 3500].filter(m => m < APPROACH.from).map(m => sleep(Math.max(0, (APPROACH.from - m) / 45 - 2) * 1000).then(() => shot(side, bk, 'in' + m))) : [];
      if (CENSUS) await b.ev(CEN_ON).catch(() => 0);
      row.approach = await scene('approach', APPROACH.sec, PROF && 'approach'.includes(PROF)); row.approach.placed = ap;
      if (CENSUS) { row.approach.census = JSON.parse(await b.ev(CEN_OFF, 20000).catch(() => 'null')); log('approach census ' + cenTop(row.approach.census)); }
      await Promise.all(sh);
      row.approach.geo = JSON.parse(await b.ev("JSON.stringify((() => { const P = WORLD.premises; return P ? { pending: P.geoPending ? P.geoPending() : null, townGeo: P.stats.townGeo || null } : null; })())").catch(() => 'null'));
      row.approach.state = Object.assign({ before: x0 }, row.approach.state || {}); await intact(row.approach, 'after');
    }
    };
    if (APP_FIRST) { await doApproach(); await doPass(); } else { await doTaxi(); await doPass(); await doApproach(); }
    // TOWN-1: the town's trees up close, composed (2026-11-08, A0: "close before/after stills ... at the town edge where the old
    // 64 m cells popped"): the flight held, the aeroplane and the page's UI hidden, the free camera (FLIGHT_PROBE.devFree) on the
    // line from the town's tree centroid toward the way in (HOME): inside the town, at its edge, 400 m out and 1.3 km out (past
    // the old 900 m cull), each looking at the centroid. The orbit of 7 Nov shot the wreck of the rig's pass (both sides).
    if (SHOTS) {
      const at = JSON.parse(await b.ev(`(async () => { const W = FLIGHT_PROBE.world(), P = [window.WORLD && WORLD.premises, W.premises].find(p => p && p.overlay && p.overlay.records && p.overlay.frame), O = P && P.overlay, T = O && O.records && O.records.trees;
        if (!T || !O.frame) return 'null'; const pts = [];
        for (const t of T) { if (!t.key || t.key === 'stub|tree') continue; pts.push(O.frame.toWorld(t.x, t.z)); }
        if (!pts.length) return 'null';
        const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        const ds = pts.map(p => Math.hypot(p[0] - cx, p[1] - cz)).sort((x, y) => x - y), R = ds[Math.floor(ds.length * 0.85)];
        const cc = new Map(); for (const q of pts) { const k = Math.floor(q[0] / 64) + ',' + Math.floor(q[1] / 64); cc.set(k, (cc.get(k) || 0) + 1); }
        let bk = null, bn = 0; for (const [k, v] of cc) if (v > bn) { bn = v; bk = k; } const [bi, bj] = bk.split(',').map(Number);
        const p = document.getElementById('bPause'); if (p && /pause/i.test(p.textContent)) p.click();
        return JSON.stringify({ cx: Math.round(cx), cz: Math.round(cz), R: Math.round(R), dx: Math.round((bi + 0.5) * 64), dz: Math.round((bj + 0.5) * 64), dn: bn, trees: pts.length, fill: window.TREE_FILL && TREE_FILL.townStat ? TREE_FILL.townStat() : null, prem: P.stats ? { trees: P.stats.trees, cells: P.stats.treeCells, fill: P.stats.townFill } : null }); })()`, 20000).catch(e => JSON.stringify('error ' + e.message)));
      log('parked ' + JSON.stringify(at));
      if (at && at.cx !== undefined) {
        const hx = (home ? home.x : 0) - at.cx, hz = (home ? home.z : 0) - at.cz, hl = Math.hypot(hx, hz) || 1, ux = hx / hl, uz = hz / hl;
        await b.ev("(() => { const c = FLIGHT_PROBE.craft && FLIGHT_PROBE.craft(); if (c) c.visible = false; document.body.style.visibility = 'hidden'; const cv = document.getElementById('c'); if (cv) cv.style.visibility = 'visible'; return 1; })()");
        for (const [n, tx, tz, back, up, lift] of [['cell60', at.dx, at.dz, 60, 14, 4], ['cell130', at.dx, at.dz, 130, 24, 4], ['cell250', at.dx, at.dz, 250, 32, 6], ['cellover', at.dx, at.dz, 90, 35, 0],
          ['inside', at.cx, at.cz, at.R * 0.45, 22, 6], ['edge', at.cx, at.cz, at.R + 40, 16, 6], ['out400', at.cx, at.cz, at.R + 400, 60, 6], ['out1300', at.cx, at.cz, at.R + 1300, 130, 6]]) {
          const v = await b.ev(`(() => { const W = FLIGHT_PROBE.world(), ex = ${tx} + ${ux} * ${back}, ez = ${tz} + ${uz} * ${back};
            const gy = Math.max(W.terrainH ? W.terrainH(ex, ez) : 0, W.waterH ? W.waterH(ex, ez) : -1e9, 0), ey = gy + ${up}, ty = Math.max(W.terrainH ? W.terrainH(${tx}, ${tz}) : 0, 0) + ${lift};
            const dx = ${tx} - ex, dz = ${tz} - ez; FLIGHT_PROBE.devFree(ex, ey, ez, Math.atan2(dx, -dz), Math.atan2(ty - ey, Math.hypot(dx, dz)));
            return JSON.stringify({ eye: [Math.round(ex), Math.round(ey), Math.round(ez)], agl: ${up}, toCentre: Math.round(Math.hypot(dx, dz)) }); })()`).catch(e => 'error ' + e.message);
          await b.ev('new Promise(r => { let n = 0; const t = () => (++n < 90 ? requestAnimationFrame(t) : r(1)); requestAnimationFrame(t); })', 30000).catch(() => 0);
          if (CENSUS) await b.ev(CEN_ON).catch(() => 0); await sleep(6000); const vc = CENSUS ? JSON.parse(await b.ev(CEN_OFF, 20000).catch(() => 'null')) : null; if (vc) { (row.views || (row.views = {}))[n] = vc; log('view ' + n + ' draws ' + cenTop(vc)); }
          // the draw census of the view: the meshes drawn (an instanced one with instances), by the scene's top group, and the
          // frame's calls (the shadow passes in it) - where the fill's town chunks spend their calls
          const cen = await b.ev(`(() => { const R = FLIGHT_PROBE.renderer(), sc = FLIGHT_PROBE.craft() && FLIGHT_PROBE.craft().parent; let S = sc; while (S && S.parent) S = S.parent;
            const g = {}; if (S) S.traverseVisible(o => { if (!o.isMesh || (o.isInstancedMesh && !o.count)) return; let t = o; while (t.parent && t.parent !== S) t = t.parent;
              const k = t.name || t.type; const e = g[k] || (g[k] = [0, 0]); e[0]++; e[1] += o.isInstancedMesh ? o.count : 1; });
            return JSON.stringify({ calls: R.info.render.calls, tris: R.info.render.triangles, groups: Object.fromEntries(Object.entries(g).sort((a, b) => b[1][0] - a[1][0]).slice(0, 10)) }); })()`).catch(e => 'error ' + e.message);
          log('view ' + n + ' ' + v + '  census ' + cen); await shot(side, bk, n);
        }
        await b.ev("(() => { const c = FLIGHT_PROBE.craft && FLIGHT_PROBE.craft(); if (c) c.visible = true; document.body.style.visibility = ''; FLIGHT_PROBE.camMode('chase'); return 1; })()");
      }
      row.parked = at;
    }
    row.check = JSON.parse(await b.ev(CHECK, 20000).catch(() => 'null'));
    row.exceptions = b.exc.slice(e0);
    for (const s of [row.taxi, row.pass, row.approach].filter(Boolean)) { const x = s.st || {};
      log(s.scene.padEnd(5) + ' ' + x.fps + ' fps, uneven ' + (100 * x.uneven).toFixed(0) + ' %, p99 ' + x.p99 + ', worst ' + x.worst + ' ms, >100 ' + x.over100 + ', worst task ' + x.taskWorst
        + (s.rec && s.rec.long.length ? '  LONG ' + s.rec.long.map(f => f.dt + '(' + Object.entries(f.slots).map(([k, v]) => k + ' ' + v).join(',') + ')').join(' ') : ''));
      if (s.raster) log('  raster ' + JSON.stringify(s.raster));
      if (s.cpu) log('  cpu in long tasks: ' + s.cpu.self.slice(0, 12).map(h => h[0] + ' ' + h[1]).join(' | '));
      if (s.halves) for (const [k, h] of Object.entries(s.halves)) log('  frames ' + k + ': ' + h.line + '\n      ' + h.slotLine);
      if (s.perFrame) { const P = s.perFrame; log('  per frame (cal ' + P.cal + '): ' + P.classes.map(c => c.k + ' ' + c.n + ' fr, ' + c.ms + ' ms busy/fr').join(', '));
        log('    long-even ms/fr: ' + P.diff.slice(0, 14).map(h => h[0] + ' ' + h[1]).join(' | ')); } }
    if (row.approach) log('approach placed ' + row.approach.placed + ' -> ' + JSON.stringify(row.approach.geo));
    log('check ' + JSON.stringify(row.check) + ' exceptions ' + row.exceptions.length + (row.exceptions.length ? ': ' + row.exceptions.slice(0, 3).join(' || ') : ''));
    R.rows.push(row); fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
  }
  await b.close(); done();
  // the table: per side and build, the medians of its runs
  const med = a => { const s = a.filter(x => x != null).sort((p, q) => p - q); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
  console.log('\nside build  | garage  first-flight | TAXI fps uneven p99 worst task | PASS fps uneven p99 worst task (each: the runs\' median; worst = the max)');
  for (const bk of WANT) for (const side of ['A', 'B', 'M', 'P']) { const rs = R.rows.filter(r => r.side === side && r.build === bk); if (!rs.length) continue;
    const g = (k, s) => rs.map(r => r[s] && r[s].st ? r[s].st[k] : null), mx = a => Math.max(...a.filter(x => x != null));
    console.log([side, bk.padEnd(5), med(rs.map(r => r.garage)), med(rs.map(r => r.firstFlight)), '|', med(g('fps', 'taxi')), med(g('uneven', 'taxi')), med(g('p99', 'taxi')), mx(g('worst', 'taxi')), mx(g('taskWorst', 'taxi')),
      '|', med(g('fps', 'pass')), med(g('uneven', 'pass')), med(g('p99', 'pass')), mx(g('worst', 'pass')), mx(g('taskWorst', 'pass'))].join(' ')); }
  // G1435: per row, the frames' read (each half when toggled): the cap's share, the unevenness at 30 alone, the ladder
  if (FRAMES) { console.log('\nrow | scene half | uneven (all) | uneven@30 | caps | ladder (x16.7 ms) | p99 | even-frame / long-frame work, gpu, calls');
    R.rows.forEach((r, i) => { for (const s of [r.taxi, r.pass, r.approach].filter(Boolean)) for (const [k, h] of Object.entries(s.halves || {})) {
      const B2 = h.by || {}; console.log([i + ':' + r.side + (r.blank ? ' BLANK' : ''), r.build, s.scene, k, s.st ? s.st.uneven : '-', h.uneven30, JSON.stringify(h.caps), JSON.stringify(h.ladder), h.dist ? h.dist.p99 : '-',
        (B2.even ? B2.even.work + '/' + B2.even.gpu + '/' + B2.even.calls : '-') + ' | ' + (B2.long ? B2.long.n + 'fr ' + B2.long.work + '/' + B2.long.gpu + '/' + B2.long.calls : '-')].join(' ')); } }); }
  console.log('\n  -> ' + OUT);
  process.exit(0);
})().catch(e => { console.error('metla_ab: ' + (e && e.stack || e)); process.exit(1); });

// G1435: the scene's frames read - the distribution (frame_dist), and per class of the interval AFTER a frame (even / long:
// over 1.25x the cap's frame time) the frame's mean slots, work, GPU, calls and tris: a long interval's cost is in the
// frame BEFORE it (the recorder's dt is the gap before its own frame)
function frameRead(R, a, z) {
  const n = R.t.length, idx = []; for (let i = 1; i < n; i++) if (R.t[i] > a && R.t[i] <= z) idx.push(i);
  const dts = idx.map(i => R.dt[i]), caps = idx.map(i => R.cap[i]);
  const d = FD ? FD.dist(dts, caps) : null;
  const capMs = i => (R.cap[i] > 0 ? 1000 / R.cap[i] : 1000 / 60);
  const keys = ['work', 'gpu', 'calls', 'tris'].concat(Object.keys(R).filter(k => !['t', 'dt', 'work', 'gpu', 'calls', 'tris', 'cap', 'flags'].includes(k)));
  const cls = { even: [], long: [] };
  for (const i of idx) cls[R.dt[i] > 1.25 * capMs(i) ? 'long' : 'even'].push(i - 1);   // the frame before the interval
  const mean = (arr, k) => { const v = arr.map(j => R[k][j]).filter(x => x != null && isFinite(x)); return v.length ? +(v.reduce((p, q) => p + q, 0) / v.length).toFixed(k === 'tris' || k === 'calls' ? 0 : 2) : null; };
  const by = {}; for (const c of ['even', 'long']) { by[c] = { n: cls[c].length }; for (const k of keys) by[c][k] = mean(cls[c], k); }
  // the k-ladder: how many frames at 1x, 2x, 3x+ of the 60 Hz refresh (what 'uneven' counts changes of)
  const lad = {}; for (const x of dts) { const k = Math.min(4, Math.max(1, Math.round(x / (1000 / 60)))); lad[k] = (lad[k] || 0) + 1; }
  // the auto cap's own share (a 60 trial's frames are 16.7 ms: 'uneven' counts every switch) and the unevenness of the
  // frames AT 30 alone (two consecutive frames, both at the 30 cap, on different refresh multiples)
  const capN = {}; for (const i of idx) capN[R.cap[i]] = (capN[R.cap[i]] || 0) + 1;
  let n30 = 0, ch30 = 0; for (let j = 1; j < idx.length; j++) { const i = idx[j], h = idx[j - 1]; if (R.cap[i] !== 30 || R.cap[h] !== 30) continue; n30++; if (Math.round(R.dt[i] / (1000 / 60)) !== Math.round(R.dt[h] / (1000 / 60))) ch30++; }
  const uneven30 = n30 ? +(ch30 / n30).toFixed(3) : null;
  const slotLine = ['even', 'long'].map(c => c + ' (' + by[c].n + '): ' + keys.filter(k => by[c][k] != null && (by[c][k] >= 0.3 || k === 'gpu')).map(k => k + ' ' + by[c][k]).join(' ')).join(' || ');
  return { dist: d, by, ladder: lad, caps: capN, uneven30, line: (d && FD.line ? FD.line(d) : '') + ' ladder(x16.7ms) ' + JSON.stringify(lad) + ' caps ' + JSON.stringify(capN) + ' uneven@30 ' + uneven30, slotLine };
}

// G1435: the CPU profile split per frame. The page clock of a sample = its profile time + off, off from the marker __mtCal
// (its first sample sits at the marker's start, `cal`, give or take one sampling interval). Each interval [t(i-1), t(i)) of
// two consecutive recorded frames belongs to frame i-1; it is 'long' if dt(i) > 1.25x the cap's frame time. Per class:
// the self time by function, a frame (ms per frame), and the difference long - even, sorted.
function perFrame(p, R, cal, tMid) {
  if (!p || !p.samples || !R || R.t.length < 3) return null;
  const byId = new Map(p.nodes.map(n => [n.id, n]));
  const name = n => (n.callFrame.functionName || '(anon)') + '@' + (n.callFrame.url || '').split('/').pop().split('?')[0] + ':' + (n.callFrame.lineNumber + 1);
  let t = p.startTime; const at = []; for (const d of p.timeDeltas) { t += d; at.push(t / 1000); }
  let off = null;
  if (cal != null) for (let i = 0; i < p.samples.length; i++) { const n = byId.get(p.samples[i]); if (n && n.callFrame.functionName === '__mtCal') { off = cal - at[i]; break; } }
  if (off == null) return { cal: 'no marker' };
  const nS = p.samples.length, ts = R.t, n = ts.length;
  const capMs = i => (R.cap[i] > 0 ? 1000 / R.cap[i] : 1000 / 60);
  const acc = {}, cnt = {}, busy = {};
  const add = (c, k, v) => { (acc[c] = acc[c] || new Map()).set(k, ((acc[c].get(k)) || 0) + v); };
  let s = 0;
  for (let i = 1; i < n; i++) {
    const a = ts[i - 1], z = ts[i]; const c = (R.dt[i] > 1.25 * capMs(i) ? 'long' : 'even') + (tMid ? (a < tMid ? '_h0' : '_h1') : '');
    cnt[c] = (cnt[c] || 0) + 1;
    while (s < nS && at[s] + off < a) s++;
    for (let j = s; j < nS && at[j] + off < z; j++) { const nd = byId.get(p.samples[j]); if (!nd) continue; const k = name(nd); const dt = (p.timeDeltas[j + 1] || 1000) / 1000;
      add(c, k, dt); if (!/^\((idle|program)\)/.test(k)) busy[c] = (busy[c] || 0) + dt; }
  }
  const classes = Object.keys(cnt).sort().map(c => ({ k: c, n: cnt[c], ms: +((busy[c] || 0) / cnt[c]).toFixed(2),
    top: [...(acc[c] || new Map()).entries()].map(([k, v]) => [k, +(v / cnt[c]).toFixed(3)]).sort((x, y) => y[1] - x[1]).slice(0, 30) }));
  const L = acc[tMid ? 'long_h0' : 'long'] || new Map(), E = acc[tMid ? 'even_h0' : 'even'] || new Map(), nl = cnt[tMid ? 'long_h0' : 'long'] || 1, ne = cnt[tMid ? 'even_h0' : 'even'] || 1;
  const keys = new Set([...L.keys(), ...E.keys()]);
  const diff = [...keys].map(k => [k, +(((L.get(k) || 0) / nl) - ((E.get(k) || 0) / ne)).toFixed(3)]).sort((x, y) => y[1] - x[1]).slice(0, 30);
  return { cal: +off.toFixed(1), classes, diff };
}

// a CPU profile's samples inside the given long tasks (page clock): self time by function, top 20
function hot(p, tasks, t0page) {
  if (!p || !p.samples) return null;
  const byId = new Map(p.nodes.map(n => [n.id, n]));
  // the profile's clock is microseconds on its own origin: the first sample is ~ the start of the scene (t0page)
  let t = p.startTime; const at = []; for (const d of p.timeDeltas) { t += d; at.push(t); }
  const off = t0page - p.startTime / 1000;
  const inTask = ms => tasks.some(x => ms >= x[0] && ms <= x[0] + x[1]);
  const self = new Map(), incl = new Map(), stacks = new Map();
  const name = n => (n.callFrame.functionName || '(anon)') + '@' + (n.callFrame.url || '').split('/').pop().split('?')[0] + ':' + (n.callFrame.lineNumber + 1);
  const parent = new Map(); for (const n of p.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const bake = new Map();   // every sample under grBake, the whole scene: who asked (the stack down to it)
  for (let i = 0; i < p.samples.length; i++) { const n = byId.get(p.samples[i]); if (!n) continue; const path = []; for (let id = n.id; id != null; id = parent.get(id)) path.push(byId.get(id).callFrame.functionName || '(anon)');
    const k = path.indexOf('grBake'); if (k < 0) continue; const sk = path.slice(k).reverse().slice(1).join('>'); bake.set(sk, (bake.get(sk) || 0) + (p.timeDeltas[i + 1] || 1000) / 1000); }
  for (let i = 0; i < p.samples.length; i++) { const ms = at[i] / 1000 + off; if (!inTask(ms)) continue; const dt = (p.timeDeltas[i + 1] || 250) / 1000;
    const n = byId.get(p.samples[i]); if (!n) continue; const k = name(n); self.set(k, (self.get(k) || 0) + dt);
    const path = []; for (let id = n.id; id != null; id = parent.get(id)) path.push(byId.get(id).callFrame.functionName || '(anon)'); const sk = path.reverse().slice(1).join('>'); stacks.set(sk, (stacks.get(sk) || 0) + dt);
    const seen = new Set(); for (let id = n.id; id != null; id = parent.get(id)) { const kk = name(byId.get(id)); if (seen.has(kk)) continue; seen.add(kk); incl.set(kk, (incl.get(kk) || 0) + dt); } }
  const top = m => [...m.entries()].sort((a, c) => c[1] - a[1]).slice(0, 25).map(([k, v]) => [k, +v.toFixed(1)]);
  return { self: top(self), incl: top(incl), stacks: [...stacks.entries()].sort((a, c) => c[1] - a[1]).slice(0, 40).map(([k, v]) => [+v.toFixed(1), k]), bake: [...bake.entries()].sort((a, c) => c[1] - a[1]).slice(0, 30).map(([k, v]) => [+v.toFixed(1), k]), tasks };
}
