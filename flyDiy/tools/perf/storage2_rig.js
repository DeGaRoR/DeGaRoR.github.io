#!/usr/bin/env node
// storage2_rig.js - HANGAR-STORAGE-2 (G2700-G2704): THE STORAGE ON THE BOX - the drawn layer follows every move, a Fly
// from each kind, the stills. One headed Chrome on its own profile, the page (index.html?career=1: the career, where the
// garage's residents live) with tools/perf/storage2_set.js's `store` fleet (the main hangar's inside slots filled - ONE in a career's club since G2319.1 - four OUTSIDE).
//   1. THE FLEET BAKED: the six slots queued for the garage's idle bake (parked.js FLEET), waited for - every later step
//      must bake NOTHING (PARKED.fleet.stats: captures / bakes unchanged, the queue empty).
//   2. THE MOVES (FLYDIY_STORE.move: the panel's own door), on the LAPTOP RUNG (--cpu-throttle 3 --gpux 6): inside <->
//      long, inside <-> outside, outside <-> long, outside -> floor, inside -> floor (a swap). Per move: the call's ms, the
//      long tasks until 700 ms of quiet (worst, sum), the residents' plan after it (names, filled, how), the apron's plan
//      (FLEET_STAND.plan of HOME: the slot on its spot), the bakes - and the rules: the residents are the inside slots
//      (never a long-term one, at most the building's N), the apron's drawn set within PARKED.fleetCap() and never a
//      long-term one, no bake. Beside them on the same rung, the references: a garage slider's tick (5 ticks, with the
//      residents standing and with none) and today's slot load (GARAGE_SPEC.open).
//   3. THE STILLS (--shots), each ONLY ON A LOADED PAGE (BOOT 'gone', #boot hidden, no "laying out the world"; then 2 s;
//      checked again after the capture - a frame that met the overlay is discarded and retaken): the residents before /
//      after a move (the garage's room view, the residents counted in the frame), the storage panel with planes in every
//      column, a drag in progress (the card's dragstart + a slot's dragover, then the drop: a real move by drag and drop).
//   4. FLY FROM EACH KIND (the panel's Fly -> its confirmation -> fly; the page on the physics worker, its default):
//      inside (lined up on the runway: across the centreline, along it), outside (on its own apron spot, the apron's props
//      round it), the floor (today's roll-out). A still of each start 2 s after the reveal (+ the apron wide from the
//      outside start), then a short take-off (outside / floor: the taxi starts, then Skip to line-up), airborne inside
//      90 s; back to the garage. The aeroplane's place is unchanged by its flight.
// Usage: node tools/perf/storage2_rig.js --pre <storage2_set store .js> --out <json> [--shots <dir>] [--cpu-throttle 3]
//          [--gpux 6] [--size 2216x1023] [--sport 8701] [--dport 9501] [--udd D:/us2] [--label tree] [--only bake,moves,stills,fly]
// A browser on the GPU: under boxlock.sh take gpu (the window script's). No --help.
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.resolve(__dirname, '..', '..', '..');
const OUT = path.resolve(opt('out', 'storage2_rig.json')), SHOTS = opt('shots', null) ? path.resolve(opt('shots')) : null;
const PRE = opt('pre', null), LABEL = opt('label', 'tree');
const SIZE = opt('size', '2216x1023').split('x').map(Number);
const THROTTLE = +opt('cpu-throttle', 3) || 1, GPUX = +opt('gpux', 6) || 1;
const SPORT = +opt('sport', 8701), DPORT = +opt('dport', 9501), UDD = opt('udd', 'D:/us2');
const ONLY = new Set(opt('only', 'bake,moves,stills,fly').split(','));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
if (!PRE || !fs.existsSync(PRE)) { console.log('storage2_rig: --pre <storage2_set.js output> is required'); process.exit(2); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
const sh = c => { try { return execSync(c, { stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch (e) { return ''; } };
for (const p of [SPORT, DPORT]) if (new RegExp(':' + p + '\\s+\\S+\\s+LISTENING').test(sh('netstat -ano -p tcp'))) { console.log('storage2_rig: port ' + p + ' is taken (a stale server?) - refusing'); process.exit(2); }
let sha = '?'; try { sha = execSync('git rev-parse --short HEAD', { cwd: path.join(ROOT, 'flyDiy') }).toString().trim(); } catch (e) {}
try { fs.rmSync(UDD, { recursive: true, force: true }); } catch (e) {}
const server = spawn(process.execPath, [path.join(ROOT, 'flyDiy/tools/_serve.js'), String(SPORT), ROOT, '--fallback', 'D:/Dev/DeGaRoR.github.io'], { stdio: 'ignore' });
const ch = spawn(CHROME, ['--remote-debugging-port=' + DPORT, '--window-size=' + (SIZE[0] + 16) + ',' + (SIZE[1] + 140), '--window-position=0,0', '--no-first-run', '--no-default-browser-check',
  '--user-data-dir=' + UDD, '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', 'about:blank'], { stdio: 'ignore' });
const kill = () => { for (const p of [ch, server]) try { execSync('taskkill /PID ' + p.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} };
process.on('exit', kill); process.on('SIGINT', () => process.exit(0)); process.on('SIGTERM', () => process.exit(0));

const GPUX_SRC = `(function(){ if (window.__GPUXH || typeof WebGL2RenderingContext === 'undefined') return; window.__GPUXH = 1; window.__GPUX = 1;
  var P = WebGL2RenderingContext.prototype, BL = 0x0BE2, en = P.enable, dis = P.disable, de = P.drawElements, da = P.drawArrays, dei = P.drawElementsInstanced, dai = P.drawArraysInstanced, dre = P.drawRangeElements;
  P.enable = function (c) { if (c === BL) this.__bl = true; return en.call(this, c); };
  P.disable = function (c) { if (c === BL) this.__bl = false; return dis.call(this, c); };
  P.drawElements = function (m, c, t, o) { var k = window.__GPUX | 0; return k > 1 && !this.__bl ? dei.call(this, m, c, t, o, k) : de.call(this, m, c, t, o); };
  P.drawRangeElements = function (m, a, b, c, t, o) { var k = window.__GPUX | 0; return k > 1 && !this.__bl ? dei.call(this, m, c, t, o, k) : dre.call(this, m, a, b, c, t, o); };
  P.drawArrays = function (m, f, c) { var k = window.__GPUX | 0; return k > 1 && !this.__bl ? dai.call(this, m, f, c, k) : da.call(this, m, f, c); };
  P.drawElementsInstanced = function (m, c, t, o, n) { var k = window.__GPUX | 0; if (k > 1 && !this.__bl) for (var i = 1; i < k; i++) dei.call(this, m, c, t, o, n); return dei.call(this, m, c, t, o, n); };
  P.drawArraysInstanced = function (m, f, c, n) { var k = window.__GPUX | 0; if (k > 1 && !this.__bl) for (var i = 1; i < k; i++) dai.call(this, m, f, c, n); return dai.call(this, m, f, c, n); };
})();`;
// the long tasks from the first byte, [start, ms]
const LT_SRC = `(function(){ if (window.__S2LT) return; var L = window.__S2LT = [];
  try { new PerformanceObserver(function(l){ l.getEntries().forEach(function(e){ L.push([Math.round(e.startTime), Math.round(e.duration)]); }); }).observe({ type: 'longtask', buffered: true }); } catch (e) {} })();`;
const CAM_ROOM = 'FLIGHT_PROBE.pan && FLIGHT_PROBE.pan(0, 0, 0); FLIGHT_PROBE.camSet(-2.5, 0.22, 14);';
const LOADED = `(() => { if (!window.BOOT || BOOT.state !== 'gone') return false;
  const b = document.getElementById('boot'); if (b && !(b.classList.contains('gone') || b.hidden)) { const cs = getComputedStyle(b); if (b.offsetParent !== null && cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.02) return false; }
  if (/laying out the world/i.test(document.body.innerText || '')) return false; return true; })()`;
const RESIN = `(() => { const g = FLIGHT_PROBE.hangarScene().getObjectByName('garageResidents'); if (!g || !g.visible) return { filled: 0, inFrame: 0 };
  const cam = FLIGHT_PROBE.camera(); cam.updateMatrixWorld(); let filled = 0, inFrame = 0; const v = new THREE.Vector3(), b = new THREE.Box3();
  for (const c of g.children) { if (!c.userData || !c.userData.filled || !c.visible) continue; filled++; b.setFromObject(c); b.getCenter(v); v.project(cam);
    if (Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 && v.z < 1) inFrame++; }
  return { filled, inFrame }; })()`;

(async () => {
  let tgt = null;
  for (let i = 0; i < 60 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + DPORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map(); const errs = [];
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).slice(0, 300));
    if (m.method === 'Page.javascriptDialogOpening') { errs.push('dialog: ' + String(m.params.message).slice(0, 200)); cmd('Page.handleJavaScriptDialog', { accept: true }); } };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const run = async body => { const r = await cmd('Runtime.evaluate', { expression: '(async()=>{ ' + body + '\n })()', awaitPromise: true, returnByValue: true }); const d = r.result;
    if (!d || d.exceptionDetails) return 'ERR ' + (d && d.exceptionDetails ? (d.exceptionDetails.exception && d.exceptionDetails.exception.description || d.exceptionDetails.text) : JSON.stringify(r)); return d.result.value; };
  const until = async (cond, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await run('return !!(' + cond + ');')) === true) return Date.now() - t0; await sleep(500); } throw new Error('timed out: ' + what); };
  const route = 'try{localStorage.setItem("flydiy.route",' + JSON.stringify(JSON.stringify({ v: 2, base: 'HOME', to: 'CIRCUIT' })) + ');localStorage.setItem("flydiy.flManual","0");localStorage.removeItem("flydiy.gfx");localStorage.removeItem("flydiy.premises.game.jolene")}catch(e){}';
  const clear = 'try{for(const k of Object.keys(localStorage)) if(/^flydiy\\.(fl([A-Z]|$)|route$|world$|wip$)/.test(k)) localStorage.removeItem(k);}catch(e){}';
  const preOnce = 'if (!sessionStorage.getItem("__s2Pre")) { sessionStorage.setItem("__s2Pre", "1"); ' + clear + '\n' + fs.readFileSync(PRE, 'utf8') + '\n' + route + ' }';
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Page.addScriptToEvaluateOnNewDocument', { source: [preOnce, LT_SRC, GPUX_SRC].join('\n') });
  await cmd('Emulation.setDeviceMetricsOverride', { width: SIZE[0], height: SIZE[1], deviceScaleFactor: 1, mobile: false });
  await cmd('Page.bringToFront');
  const url = 'http://localhost:' + SPORT + '/flyDiy/index.html?career=1';
  const T0 = Date.now();
  await cmd('Page.navigate', { url });
  const res = { url, size: SIZE, label: LABEL, sha, rung: { cpu: THROTTLE, gpux: GPUX }, errs, stills: [], discarded: [], moves: [], refs: {}, flights: [], checks: [], fails: [] };
  const save = () => fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
  const check = (ok, what, extra) => { res.checks.push({ ok: !!ok, what, extra: extra == null ? null : extra }); if (!ok) res.fails.push(what); console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + what + (extra != null ? '  [' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) + ']' : '')); save(); return !!ok; };
  const rung = async on => { if (THROTTLE > 1) await cmd('Emulation.setCPUThrottlingRate', { rate: on ? THROTTLE : 1 }); if (GPUX > 1) await run('window.__GPUX = ' + (on ? GPUX : 1) + '; return 1;'); };
  await until(`window.BOOT && BOOT.state === 'gone' && window.FLIGHT_PROBE && window.GARAGE_ENV && window.FLYDIY_STORE`, 600000, 'the garage boot');
  res.load = (Date.now() - T0) / 1000; console.log('garage up in ' + res.load.toFixed(1) + ' s (' + url + ', ' + sha + ')');
  await run(`for (const b of document.querySelectorAll('button, [role=button]')) { if (/^\\s*keep the current build\\s*$/i.test(b.textContent || '') && b.offsetParent) { b.click(); break; } } return 1;`);
  await sleep(1500);
  res.simw = await run('return window.FLYDIY_SIMW && FLYDIY_SIMW.state ? FLYDIY_SIMW.state() : null;');
  const view = () => run('return FLYDIY_STORE.view();');
  const fleetStats = () => run('const F = PARKED.fleet; return { captures: F.stats.captures, bakes: F.stats.bakes, decodes: F.stats.decodes, queued: F.stats.queued, notWanted: F.stats.notWanted, queue: F.queue.length, busy: !!F.busy, cap: PARKED.fleetCap ? PARKED.fleetCap() : null };');
  const resNow = () => run('const R = GARAGE_ENV.residentsSync ? GARAGE_ENV.residentsSync() : null; return R ? { plan: R.plan.map(p => ({ name: p.name, filled: p.filled })), unplaced: R.unplaced, err: R.err, how: R.how, ms: R.ms, packs: R.packs } : null;');
  // the apron as the next roll-out stands it (FLEET_STAND's own plan: HOME, the stand's airframe left out, the drawn cap)
  const apronNow = () => run(`const W = FLIGHT_PROBE.world(), isl = W && W.island && W.island.id; const d = FLYDIY_PLAYER.doc ? FLYDIY_PLAYER.doc() : null;
    if (!window.FLEET_STAND || !d) return null; const P = FLEET_STAND.plan(d, FLYDIY_STORE.onStand(), window.FLEET_SPOTS_PACK, isl, null, 'HOME', PARKED.fleetCap());
    const spots = (FLEET_SPOTS_PACK.aero.HOME || []).map(s => s[3]);
    return { stand: P.stand.map(p => ({ slot: p.slot, spotI: spots.indexOf(p.spot) })), held: P.held.map(h => h.slot + ': ' + h.why), miss: P.miss.length };`);
  // the drawn layer's rules after any move: the residents ARE the inside slots (in slot order, at most N, never long-term,
  // never the stand's), the apron's drawn set within the cap, never a long-term one, an apron slot k on spot k
  const rules = async (tag) => {
    const V = await view(), R = await resNow(), A = await apronNow(), FS = await fleetStats(), stand = await run('return FLYDIY_STORE.onStand();');
    const ins = V.inside.slots.filter(n => n && n !== stand), names = (R && R.plan || []).map(p => p.name);
    check(R && !R.err && JSON.stringify(names) === JSON.stringify(ins.slice(0, V.inside.N)) || (V.floor && V.floor !== stand && JSON.stringify(names) === JSON.stringify(ins.concat([V.floor]).slice(0, V.inside.N))),
      tag + ': the residents are the inside slots, in order', { residents: names, inside: V.inside.slots, floor: V.floor, stand });
    check(!names.some(n => V.long.includes(n)), tag + ': no long-term aeroplane among the residents', V.long);
    check(R && R.plan.every(p => p.filled), tag + ': every resident drawn (filled from its bake)', R && R.plan);
    const ap = A ? A.stand.map(s => s.slot) : [];
    check(A && ap.length <= FS.cap && !ap.some(n => V.long.includes(n)), tag + ': the apron\'s drawn set within the cap (' + FS.cap + '), no long-term one', A);
    check(A && A.stand.every(s => V.outside.slots[s.spotI] === s.slot), tag + ': each apron slot k stands on spot k', { apron: A && A.stand, outside: V.outside.slots });
    return { V, R, A, FS };
  };
  const busyAfter = async (t0) => {   // the long tasks from t0 until 700 ms of quiet (at most 15 s)
    const tEnd = Date.now() + 15000; let last = Date.now();
    let n = -1;
    while (Date.now() < tEnd) { const k = await run('return window.__S2LT.length;'); if (k !== n) { n = k; last = Date.now(); } else if (Date.now() - last > 700) break; await sleep(150); }
    const L = await run(`return window.__S2LT.filter(x => x[0] >= ${t0} - 5);`);
    return { tasks: L.map(x => x[1]), worst: L.reduce((m, x) => Math.max(m, x[1]), 0), sum: L.reduce((s, x) => s + x[1], 0) };
  };

  // ---- 1. THE FLEET BAKED ------------------------------------------------------------------------------------------------
  if (ONLY.has('bake')) {
    await run(`for (const n of Object.keys(FLYDIY_PLAYER.doc().fleet)) PARKED.fleetQueue(n); return 1;`);
    const t0 = Date.now(); let R = null, FS = null;
    while (Date.now() - t0 < 300000) {
      R = await resNow(); FS = await fleetStats();
      // (every key the bound accepted baked - a long-term one is never wanted: notWanted)
      if (R && R.plan && R.plan.length && R.plan.every(p => p.filled) && !FS.queue && !FS.busy && FS.queued > 0 && FS.bakes + FS.decodes >= FS.queued) break;
      await sleep(3000);
    }
    res.baked = { secs: (Date.now() - t0) / 1000, residents: R, fleet: FS };
    console.log('the fleet: ' + JSON.stringify(res.baked));
    await sleep(4000);
  }
  res.start = await rules('start');
  res.stats0 = await fleetStats();

  // ---- 3a. THE RESIDENTS BEFORE A MOVE + the panel with planes in each column (box speed) -----------------------------------
  const shoot = async (name, text, needRes) => {
    if (!SHOTS) return false;
    await run(`let d = document.getElementById('__s2Lbl'); if (!d) { d = document.createElement('div'); d.id = '__s2Lbl'; d.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483647;font:600 14px/1.3 system-ui,sans-serif;color:#fff;background:rgba(0,0,0,.55);padding:4px 8px;border-radius:4px;pointer-events:none'; document.body.appendChild(d); } d.textContent = ${JSON.stringify(text)}; return 1;`);
    for (let k = 0; k < 3; k++) {
      try { await until(LOADED, 60000, 'a loaded page'); } catch (e) { res.discarded.push({ name, why: 'never loaded' }); continue; }
      await sleep(2000);
      if ((await run('return ' + LOADED + ';')) !== true) { res.discarded.push({ name, why: 'the overlay came back in the 2 s' }); continue; }
      const info = await run('const R = FLIGHT_PROBE.renderer(); return { calls: R.info.render.calls, tris: R.info.render.triangles, res: ' + RESIN + ', boot: BOOT.state };');
      if (needRes && !(info && info.res && info.res.inFrame > 0)) { res.discarded.push({ name, why: 'no resident in the frame', info }); console.log('  (no resident in the frame: ' + name + ')'); return false; }
      const r = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
      if ((await run('return ' + LOADED + ';')) !== true) { res.discarded.push({ name, why: 'a loading screen in the shot' }); console.log('  DISCARDED ' + name); continue; }
      fs.mkdirSync(SHOTS, { recursive: true }); fs.writeFileSync(path.join(SHOTS, name + '.jpg'), Buffer.from(r.result.data, 'base64'));
      res.stills.push({ name, text, info }); save();
      console.log('still ' + name + ' ' + JSON.stringify(info));
      return true;
    }
    return false;
  };
  const label = s => LABEL + ' ' + sha + ' · career · ' + s;
  if (ONLY.has('stills')) {
    await run(`if (window.DAY_CLOCK) DAY_CLOCK.preset('afternoon'); ${CAM_ROOM} GARAGE_ENV.setResidents && GARAGE_ENV.setResidents(true); return 1;`);
    await sleep(3000);
    await shoot('s2_residents_before', label('the garage: the Cub and the Jodel INSIDE (residents beside the stand)'), true);
  }

  // ---- 2. THE MOVES on the rung --------------------------------------------------------------------------------------------
  const move = async (tag, name, to) => {
    const t0 = await run('return performance.now();');
    const r = await run(`const t = performance.now(); const r = FLYDIY_STORE.move(${JSON.stringify(name)}, ${JSON.stringify(to)}); r.callMs = +(performance.now() - t).toFixed(1); return r;`);
    const B = await busyAfter(t0);
    const R = await rules(tag);
    const FS = R.FS;
    check(FS.captures === res.stats0.captures && FS.bakes === res.stats0.bakes && !FS.queue, tag + ': no bake, nothing queued', { before: res.stats0, after: FS });
    const m = { tag, name, to, ok: r && r.ok, why: r && r.why, swapped: r && r.swapped, callMs: r && r.callMs, busy: B, residents: R.R && R.R.plan.map(p => p.name), how: R.R && R.R.how, resMs: R.R && R.R.ms, apron: R.A && R.A.stand.map(s => s.slot), view: R.V };
    res.moves.push(m); save();
    console.log('  MOVE ' + tag + ' ' + name + ' -> ' + JSON.stringify(to) + ': ' + (m.ok ? 'ok' : 'REFUSED ' + m.why) + ', call ' + m.callMs + ' ms, long tasks ' + JSON.stringify(B.tasks) + ', residents ' + JSON.stringify(m.residents) + ' (' + m.how + '), apron ' + JSON.stringify(m.apron));
    return m;
  };
  // a slider's tick (the rollout_perf --trips probe: the editor's first range of these keys, a step; the input's task and
  // to the second frame), n ticks
  const slider = n => run(`const keys = ['noseLen', 'span', 'wingSpan', 'chord', 'fuseLen'].concat(window.CAGE_UI && CAGE_UI.P ? Object.keys(CAGE_UI.P) : []); const out = [];
    for (let i = 0; i < ${n}; i++) for (const k of keys) { const r = document.getElementById('p_' + k); if (!r || r.type !== 'range' || r.disabled || typeof r.oninput !== 'function') continue;
      const st = +r.step || 0.01, v = +r.value, nv = i % 2 ? v - st : v + st; const t0 = performance.now(); r.value = String(nv); r.oninput({ target: r }); const t1 = performance.now();
      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res))); out.push({ key: k, inputMs: +(t1 - t0).toFixed(1), toFrameMs: +(performance.now() - t0).toFixed(1) }); await new Promise(r => setTimeout(r, 400)); break; }
    return out;`);
  if (ONLY.has('moves')) {
    await run('if (window.STORAGE_UI) STORAGE_UI.close(); return 1;');
    await rung(true); await sleep(3000);
    res.refs.sliderResidents = await slider(5);
    console.log('  slider (with the residents): ' + JSON.stringify(res.refs.sliderResidents));
    // (a career's club main hangar has ONE inside slot since G2319.1 - the moves are written for N = 1; the Jodel starts
    // long-term)
    await move('M1 inside->long', 'fleet-1-cub', { kind: 'long' });
    await move('M2 long->inside', 'fleet-2-jodel', { kind: 'inside', slot: 0 });
    await move('M3 inside->outside', 'fleet-2-jodel', { kind: 'outside' });
    await move('M4 outside->inside', 'fleet-3-c172', { kind: 'inside', slot: 0 });
    await move('M5 outside->long', 'fleet-5-twinfloats', { kind: 'long' });
    await move('M6 long->outside', 'fleet-5-twinfloats', { kind: 'outside' });
    // a full inside refused, with its reason (nothing moved)
    const full = await run(`return FLYDIY_STORE.move('fleet-1-cub', { kind: 'inside', slot: 0 });`);
    check(full && !full.ok && !!full.why, 'a taken inside slot is refused with its reason', full && full.why);
    // the references on the rung: no residents (the inside one -> long), the slider again, then back
    await move('M7 inside->long', 'fleet-3-c172', { kind: 'long' });
    res.refs.sliderNone = await slider(5);
    console.log('  slider (no residents): ' + JSON.stringify(res.refs.sliderNone));
    await move('M8 long->inside', 'fleet-1-cub', { kind: 'inside', slot: 0 });
    // the floor: "Work on" an apron aeroplane (a slot load), then the inside one (the swap: the floor's goes to its slot)
    await move('M9 outside->floor', 'fleet-6-metal', { kind: 'floor' });
    await move('M10 inside->floor', 'fleet-1-cub', { kind: 'floor' });
    // today's slot load, the same door (the reference for the floor moves)
    res.refs.slotLoad = [];
    for (const n of ['fleet-6-metal', 'fleet-1-cub']) {
      const t0 = await run('return performance.now();');
      const r = await run(`const t = performance.now(); GARAGE_SPEC.open(${JSON.stringify(n)}); const load = performance.now() - t; await new Promise(q => requestAnimationFrame(() => requestAnimationFrame(q))); return { to: ${JSON.stringify(n)}, load: +load.toFixed(1), total: +(performance.now() - t).toFixed(1) };`);
      r.busy = await busyAfter(t0); res.refs.slotLoad.push(r); console.log('  slot load (today) ' + JSON.stringify(r));
    }
    await rung(false); await sleep(2000);
    res.afterMoves = await rules('after the moves');
    const nonFloor = res.moves.filter(m => !/floor/.test(m.tag));   // (the refused one is not a move: checked above)
    check(nonFloor.every(m => m.ok), 'every inside / outside / long move went through', nonFloor.filter(m => !m.ok).map(m => m.tag + ': ' + m.why));
    res.moveWorst = Math.max(0, ...nonFloor.map(m => m.busy.worst));
    check(nonFloor.every(m => m.busy.worst < 150), 'no inside / outside / long move holds a task of 150 ms on the laptop rung (the strict gate\'s task slack)', nonFloor.map(m => m.tag + ' ' + m.busy.worst));
    save();
  }

  // ---- 3b. THE STILLS: the residents after the moves, the panel, a drag in progress ------------------------------------------
  if (ONLY.has('stills')) {
    await run(`if (window.STORAGE_UI) STORAGE_UI.close(); ${CAM_ROOM} return 1;`);
    await sleep(2500);
    const V = await view();
    await shoot('s2_residents_after', label('after the moves: inside ' + V.inside.slots.map(n => n || '-').join(', ') + ' · the floor ' + V.floor), true);
    // a plane in every column: one apron aeroplane to long-term first
    const outs = V.outside.slots.filter(Boolean);
    if (!V.long.length && outs.length) await run(`FLYDIY_STORE.move(${JSON.stringify(outs[outs.length - 1])}, { kind: 'long' }); return 1;`);
    await run('STORAGE_UI.open(); return 1;');
    await sleep(800);
    const V2 = await view();
    check(V2.floor && V2.inside.slots.some(Boolean) && V2.outside.slots.some(Boolean) && V2.long.length, 'the panel has a plane on the floor and in every column', V2);
    await shoot('s2_panel_columns', label('STORAGE: the floor, INSIDE, OUTSIDE, LONG-TERM'), false);
    // a drag in progress: a long-term card dragged over a free apron slot (the slot lit, the card marked), then dropped
    const freeOut = V2.outside.slots.indexOf(null), dragN = V2.long[0];
    const dt = 'window.__s2DT || (window.__s2DT = new DataTransfer())';
    const dragOk = await run(`const c = document.querySelector('#hsStore .hsCard[data-name="${dragN}"]'), s = document.querySelector('#hsStore .hsCol[data-col="outside"] .hsSlot[data-slot="${freeOut}"]');
      if (!c || !s) return 'no card / slot';
      const dt = ${dt}; c.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
      s.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt })); s.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
      return c.classList.contains('hsDragging') && s.classList.contains('hsDrop') ? 'ok' : 'classes ' + c.className + ' / ' + s.className;`);
    check(dragOk === 'ok', 'a drag in progress: the card marked, the slot lit', dragOk);
    await shoot('s2_panel_drag', label('a drag in progress: ' + dragN + ' from LONG-TERM over apron slot ' + (freeOut + 1)), false);
    const drop = await run(`const c = document.querySelector('#hsStore .hsCard[data-name="${dragN}"]'), s = document.querySelector('#hsStore .hsCol[data-col="outside"] .hsSlot[data-slot="${freeOut}"]');
      const dt = ${dt}; s.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); if (c && c.isConnected) c.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
      return { where: FLYDIY_STORE.where(${JSON.stringify(dragN)}), msg: (document.querySelector('#hsStore .hsMsg') || {}).textContent };`);
    check(drop && drop.where && drop.where.kind === 'outside' && drop.where.slot === freeOut, 'the drop moved it onto apron slot ' + (freeOut + 1), drop);
    await shoot('s2_panel_dropped', label('dropped: ' + dragN + ' on apron slot ' + (freeOut + 1) + ' (' + ((drop && drop.msg) || '') + ')'), false);
    await rules('after the drag and drop');
    await run('STORAGE_UI.close(); return 1;');
  }

  // ---- 4. FLY FROM EACH KIND -----------------------------------------------------------------------------------------------
  if (ONLY.has('fly')) {
    const trips = () => run('return (window.FLYDIY_TRIPS || []).length;');
    const tripDone = async (kind, n0, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) {
      const d = await run(`const L = window.FLYDIY_TRIPS || [], t = L[L.length - 1]; return { n: L.length, kind: t && t.kind, done: !!(t && t.done), anim: t && t.anim, ms: t && t.ms, ran: t ? t.steps.filter(s => s.ran).map(s => s.id) : [], boot: window.BOOT ? BOOT.state : '' };`);
      if (d && d.n > n0 && d.kind === kind && d.done && d.boot === 'gone') return d; await sleep(300); } return null; };
    const isFloat = n => run(`const c = FLYDIY_STORE.card(${JSON.stringify(n)}); return !!(c && /float|amphib/.test(c.gear || ''));`);
    const pick = async kind => { const V = await view(); const L = kind === 'floor' ? [V.floor] : kind === 'inside' ? V.inside.slots : V.outside.slots;
      for (const n of L) if (n && !(await isFloat(n))) return n; return null; };
    for (const kind of ['inside', 'outside', 'floor']) {
      const name = await pick(kind);
      const F = { kind, name };
      res.flights.push(F);
      if (!name) { check(false, 'a ' + kind + ' aeroplane (not on floats) to fly'); continue; }
      const W0 = await run(`return FLYDIY_STORE.where(${JSON.stringify(name)});`);
      const st0 = await fleetStats();
      // the panel's own door: its card's Fly -> the confirmation -> fly
      await run('STORAGE_UI.open(); return 1;'); await sleep(500);
      const ask = await run(`const b = document.querySelector('#hsStore .hsCard[data-name="${name}"] .hsFly'); if (!b) return null; b.click(); await new Promise(r => setTimeout(r, 300));
        const a = document.querySelector('#hsStore .hsAsk'); return a && !a.hidden ? a.innerText.replace(/\\s+/g, ' ') : null;`);
      F.ask = ask;
      check(!!ask, kind + ': Fly asks first (' + name + ')', ask);
      if (kind === 'inside') await shoot('s2_fly_confirm', label('Fly ' + name + ' from inside: the confirmation'), false);
      const n0 = await trips(), tClick = Date.now();
      await run(`const g = document.querySelector('#hsStore .hsGo'); if (g) g.click(); return 1;`);
      const d = await tripDone('rollout', n0, 300000);
      F.trip = d; F.rollSecs = (Date.now() - tClick) / 1000;
      if (!check(!!d, kind + ': the roll-out reached the world', { secs: F.rollSecs })) { await run(`const b = document.getElementById('bHangar2'); if (b) b.click(); return 1;`); await sleep(20000); continue; }
      const tw = Date.now() + 30000; while (Date.now() < tw && (await run('return !!(window.ROLLANIM && ROLLANIM.busy());')) === true) await sleep(200);
      await sleep(1500);
      const s1 = await run('return FLIGHT_PROBE.sim().t;'); await sleep(1200); const s2 = await run('return FLIGHT_PROBE.sim().t;');
      if (!(s2 > s1)) await run(`const b = document.getElementById('bGo'); if (b && b.offsetParent) b.click(); return 1;`);
      F.pose = await run(`const s = FLIGHT_PROBE.sim(), cg = s.cgPos(), W = FLIGHT_PROBE.world(), a = (W.aerodromes || []).find(x => x.id === 'HOME');
        let nose = null; try { const ax = s.axes()[0]; nose = Math.atan2(-ax[2], -ax[0]); } catch (e) {}
        const ux = Math.cos(a.hdg), uz = Math.sin(a.hdg);
        return { cg: cg.map(v => +v.toFixed(2)), nose: nose == null ? null : +nose.toFixed(3), across: +(-(cg[0] - a.x) * uz + (cg[2] - a.z) * ux).toFixed(2), along: +((cg[0] - a.x) * ux + (cg[2] - a.z) * uz).toFixed(1),
          rwyHdg: +a.hdg.toFixed(3), phase: FLIGHT_PROBE.ap().phase, start: FLYDIY_STORE.start(), simw: window.FLYDIY_SIMW && FLYDIY_SIMW.state ? FLYDIY_SIMW.state() : null,
          where: FLYDIY_STORE.where(${JSON.stringify(name)}), stood: window.FLEET_STAND ? FLEET_STAND.state.plan.stand.map(p => p.slot) : null, agl: FLIGHT_PROBE.agl() };`);
      const P = F.pose;
      console.log('  FLY ' + kind + ' ' + name + ': ' + JSON.stringify(P));
      check(P.where && P.where.kind === W0.kind, kind + ': flying does not move it in the storage', { before: W0, after: P.where });
      check(P.simw && !P.simw.dead, kind + ': the flight runs on the physics worker', P.simw);
      const st1 = await fleetStats();
      check(st1.captures === st0.captures && st1.bakes === st0.bakes, kind + ': the roll-out baked nothing (the apron from the existing bakes)', { before: st0, after: st1 });
      if (kind === 'inside') {
        const e = P.nose == null ? 0 : Math.abs(Math.atan2(Math.sin(P.nose - P.rwyHdg), Math.cos(P.nose - P.rwyHdg)));
        check(P.start && P.start.start === 'lineup' && Math.abs(P.across) < 3 && Math.min(e, Math.PI - e) < 0.1, 'inside: lined up on the runway', { across: P.across, along: P.along, nose: P.nose, rwy: P.rwyHdg, phase: P.phase });
      } else if (kind === 'outside') {
        const sp = P.start && P.start.spot;
        const dd = sp ? Math.hypot(P.cg[0] - sp.x, P.cg[2] - sp.z) : null;
        check(sp && dd < 4, 'outside: on its own apron spot (' + (sp && sp.spot) + ')', { cgToSpot: dd == null ? null : +dd.toFixed(2), spot: sp });
        check(P.stood && !P.stood.includes(name), 'outside: its spot left empty for it, the other apron props stood', P.stood);
      } else {
        check((!P.start || P.start.start === 'door') && d.anim !== 'away', 'floor: today\'s roll-out (out of the door, not cut to a stand)', { anim: d.anim, start: P.start });
      }
      await run('FLIGHT_PROBE.camMode && FLIGHT_PROBE.camMode("chase"); return 1;');
      await sleep(600);
      await shoot('s2_start_' + kind, label('Fly from ' + kind.toUpperCase() + ': ' + name + ' - ' + (kind === 'inside' ? 'lined up on the runway' : kind === 'outside' ? 'on its apron spot' : "today's roll-out")), false);
      if (kind === 'outside') {
        await run('FLIGHT_PROBE.camSet(-2.2, 0.42, 55); return 1;'); await sleep(1500);
        await shoot('s2_apron_wide', label('the apron after the moves: ' + JSON.stringify(P.stood)), false);
        await run('FLIGHT_PROBE.camMode && FLIGHT_PROBE.camMode("chase"); return 1;');
      }
      // the short take-off: the taxi begins (outside / floor), then Skip to line-up
      if (kind !== 'inside') {
        const c0 = P.cg; await sleep(8000);
        const c1 = await run('return FLIGHT_PROBE.sim().cgPos();');
        F.taxied = +Math.hypot(c1[0] - c0[0], c1[2] - c0[2]).toFixed(1);
        check(F.taxied > 1, kind + ': the taxi starts', F.taxied + ' m in 8 s');
        F.skip = await run(`const b = document.getElementById('bSkip'); if (!b || b.hidden || b.disabled) return 'no skip (' + (b ? b.title : 'none') + ')'; b.click(); return 'skipped';`);
      }
      const tA = Date.now(); let air = null;
      while (Date.now() - tA < 90000) { const h = await run('return FLIGHT_PROBE.agl();'); if (h > 5) { air = (Date.now() - tA) / 1000; break; } await sleep(500); }
      F.airborneSecs = air;
      check(air != null, kind + ': a short take-off - airborne inside 90 s', air);
      if (air != null) { await sleep(2500); await shoot('s2_takeoff_' + kind, label(name + ' airborne from ' + kind), false); }
      save();
      // back to the garage
      const r0 = await trips();
      await run(`const b = document.getElementById('bHangar2'); if (b) b.click(); return 1;`);
      const back = await tripDone('rollin', r0, 240000);
      check(!!back, kind + ': back in the garage');
      await sleep(3000);
    }
    res.end = await rules('after the flights');
  }
  res.errsN = errs.length; res.wall = (Date.now() - T0) / 1000; save();
  console.log('STORAGE2_RIG ' + (res.fails.length ? 'FAIL (' + res.fails.length + '): ' + res.fails.join(' | ') : 'PASS') + ', ' + res.stills.length + ' stills, ' + errs.length + ' page errors, ' + res.wall.toFixed(0) + ' s');
  try { await run('location.href = "about:blank"; return 1;'); await sleep(2500); } catch (e) {}
  try { await cmd('Browser.close'); } catch (e) {}
  await sleep(500);
  process.exit(0);
})().catch(e => { console.log('FATAL ' + e.stack); try { fs.writeFileSync(OUT + '.fatal.txt', String(e.stack)); } catch (x) {} process.exit(1); });
