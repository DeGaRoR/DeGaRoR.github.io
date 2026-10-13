#!/usr/bin/env node
// sim_clock_gpu.js - G2660-G2664 SIM-CLOCK-GPU: WHAT A JUMP OF THE CLOCK COSTS ON THE GPU, AND THAT THE DEFAULT BOOT IS
// THE SAME PICTURE (2026-10-10, for the GAME COORDINATOR; a LOCAL GPU rig - take tools/perf/boxlock.sh take gpu <who>).
//
// One headed Chrome, its own profile (--udd, KEPT between runs: the flight rig reuses it warm), the page at the laptop's
// 1920 x 1080 on ?gfx=retro (the laptop's preset), the user's Cub on the stand, NO CLOCK SET (flydiy.day.v3 removed: the
// game day, 16:00). The rung (the laptop: CDP CPU x N + HW-COVERAGE's GPU proxy x K, GARAGE-LAPTOP's 3 / 6) is applied
// for every TIMED window only; loads and stills run at the box's speed.
//   PARTS (--parts, comma list, in this order):
//   picture  THE DEFAULT PICTURE: the garage's still (room camera, UI hidden) and the world's (rolled out, the screen
//            lifted, the Cub at idle on the stand: manual), each with the day's state and the light (sun / hemisphere /
//            exposure). Run once per tree (--label); tools/perf/sim_clock_table.js compares the pair.
//   garage   THE JUMPS IN THE GARAGE: a baseline window, then --reps x [dusk, night, dawn, noon] through DAY_CLOCK.wait
//            (THE jump function, the guard: in the hangar) and one nextFullMoon. Per jump: the call's own ms, the next
//            --after frames (dt, work, render, shadow, shader slot, GPU), the frames over 50 / 100 ms, the long tasks
//            from the call to +6 s, the programs linked (renderer.info.programs), the atmosphere LUT re-bakes (ATMO.lut()'s
//            table replaced) and the world probe's bakes, and the last 60 frames against the baseline (back to it?).
//   gstills  ONE WAIT FOR THE USER, the garage: wait to dusk, a still; wait to night (the lamps on), a still.
//   stand    THE JUMPS ON THE HELD STAND: roll out, BOOT.hold() (the roll-out screen waits: rollHold, the guard's other
//            half), the same measure, then the screen lifted (BOOT.go) - the world, manual at idle on the stand.
//   wstills  ONE WAIT FOR THE USER, the world (after `stand`, which ends at dusk): a still at dusk on the stand; roll in,
//            wait to night in the hangar (the player's way), roll out, a still at night (the runway / premises lights).
//   EVERY STILL ONLY ON A LOADED PAGE (the user): BOOT gone, the overlay hidden, no "laying out the world", then the
//   light's settle + 2 s, the shot, the same check again - a shot that saw a loading screen is discarded and retaken.
//   --lut-ms: the LUT re-bake's own cost, timed once at the end (ATMO.bakeT + bakeMS called directly, the same tables).
//   --deadline <epoch ms>: no new step starts after it (the window's hard stop); the JSON is written after every step.
// Usage: node tools/perf/sim_clock_gpu.js --out <json> --parts picture,garage,gstills,stand,wstills [--shots <dir>]
//          [--label <tree>] [--q gfx=retro] [--cpu-throttle 3] [--gpux 6] [--reps 2] [--after 180] [--size 1920x1080]
//          [--sport 8693] [--dport 9693] [--udd D:/scg] [--fresh] [--deadline <ms>] [--lut-ms] [--root <repo root>]
// Rigs have no --help.
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const ROOT = path.resolve(opt('root', path.join(__dirname, '..', '..', '..')));   // --root <repo root>: serve ANOTHER tree (the reference) with this rig
const OUT = path.resolve(opt('out', 'sim_clock_gpu.json'));
const PARTS = String(opt('parts', 'picture,garage,gstills,stand,wstills')).split(',').filter(Boolean);
const Q = opt('q', 'gfx=retro'), SIZE = opt('size', '1920x1080').split('x').map(Number);
const SHOTS = opt('shots', null), LABEL = opt('label', 'tree');
const THROTTLE = +opt('cpu-throttle', 3) || 0, GPUX = +opt('gpux', 6) || 0, REPS = +opt('reps', 2) || 1, AFTER = +opt('after', 180) || 180;
const SPORT = +opt('sport', 8693), DPORT = +opt('dport', 9693), UDD = opt('udd', 'D:/scg');
const DEADLINE = +opt('deadline', 0) || 0;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CUB = 'builds/cub_2026-09-20_corrected.json';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const late = () => DEADLINE && Date.now() > DEADLINE;
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
let sha = '?'; try { sha = execSync('git rev-parse --short HEAD', { cwd: path.join(ROOT, 'flyDiy') }).toString().trim(); } catch (e) {}
let build = '?'; try { build = JSON.parse(fs.readFileSync(path.join(ROOT, 'flyDiy', 'version.json'), 'utf8')).build; } catch (e) {}
if (flag('fresh')) try { fs.rmSync(UDD, { recursive: true, force: true }); } catch (e) {}
// THE PORT IS FREE, OR THE RIG STOPS (rollout-perf-port-hijack: a peer's stale server serves ITS tree without a word)
try { const o = execSync('netstat -ano -p tcp', { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  for (const p of [SPORT, DPORT]) if (new RegExp(':' + p + '\\s+\\S+\\s+LISTENING').test(o)) { console.log('FATAL port ' + p + ' is held'); process.exit(3); } } catch (e) {}
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
// the page-side counters: long tasks from the first byte; per animation frame, the atmosphere's LUT table identity
// (ATMO's bakeT/bakeMS allocate a NEW table on every re-bake - a bundle-scope const, reached by name)
const MON_SRC = `(function(){ if (window.__SC) return; var S = window.__SC = { lt: [], lut: 0, lutT: null };
  try { new PerformanceObserver(function(l){ l.getEntries().forEach(function(e){ S.lt.push([Math.round(e.startTime), Math.round(e.duration)]); }); }).observe({ type: 'longtask', buffered: true }); } catch (e) {}
  function tick() { try { if (typeof ATMO !== 'undefined' && ATMO.lut) { var T = ATMO.lut().T; if (T && T !== S.lutT) { if (S.lutT) S.lut++; S.lutT = T; } } } catch (e) {} requestAnimationFrame(tick); }
  requestAnimationFrame(tick);
})();`;
const CAM_ROOM = 'FLIGHT_PROBE.pan && FLIGHT_PROBE.pan(0, 0, 0); FLIGHT_PROBE.camSet(-2.5, 0.22, 14);';
const LOADED = `(() => { if (!window.BOOT || BOOT.state !== 'gone') return false;
  const b = document.getElementById('boot'); if (b) { const cs = getComputedStyle(b); if (b.offsetParent !== null && cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.02) return false; }
  if (/laying out the world/i.test(document.body.innerText || '')) return false; return true; })()`;
const ROLL_OUT = `(() => { const g = document.getElementById('bGo'); const l = [...document.querySelectorAll('button')].filter(b => /roll out/i.test(b.textContent) && b.offsetParent);
  const b = g && g.offsetParent && /roll out/i.test(g.textContent) ? g : l[0]; if (!b) return 'no button'; b.click(); return b.id || 'button'; })()`;
const ROLL_IN = `(() => { const b = document.getElementById('bHangar2'); if (!b) return 'no button'; b.click(); return 'ok'; })()`;
// the clock and the light, read back (the day's instant, the sun, the version, the eased light's targets and its writes)
const STATE = `(() => { const w = FLIGHT_PROBE.world(), d = w && w.day, R = FLIGHT_PROBE.renderer(), LE = window.LIGHT_EASE, C = window.DAY_CLOCK;
  return { date: d && d.date, utc: d && Math.round(d.utc), localH: d ? +(d.localSeconds / 3600).toFixed(4) : null, sunEl: d ? +d.sunEl.toFixed(3) : null, version: d && d.version, rate: d && d.rate,
    turbidity: d && d.turbidity, cloudCover: d && d.cloudCover, label: C && C.label ? C.label() : null, jumps: C && 'jumps' in C ? C.jumps : null,
    exposure: +R.toneMappingExposure.toFixed(5), programs: R.info.programs ? R.info.programs.length : -1,
    le: LE ? { sunI: +LE.tSunI.toFixed(5), hemiI: +LE.tHemiI.toFixed(5), ex: +(LE.tEx || 0).toFixed(5), applies: LE.applies, writes: LE.writes } : null,
    holds: window.FLYDIY_HOLDS ? FLYDIY_HOLDS() : null, probe: (window.WORLD_RIG && WORLD_RIG.probeState) ? WORLD_RIG.probeState() : null, lut: window.__SC ? __SC.lut : null }; })()`;

(async () => {
  let tgt = null;
  for (let i = 0; i < 60 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + DPORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  if (!tgt) throw new Error('no Chrome page on ' + DPORT);
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map(); const errs = [];
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).slice(0, 300)); };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const run = async body => { const r = await cmd('Runtime.evaluate', { expression: '(async()=>{ ' + body + '\n })()', awaitPromise: true, returnByValue: true }); const d = r.result;
    if (!d || d.exceptionDetails) return 'ERR ' + (d && d.exceptionDetails ? (d.exceptionDetails.exception && d.exceptionDetails.exception.description || d.exceptionDetails.text) : JSON.stringify(r)); return d.result.value; };
  const until = async (cond, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await run('return !!(' + cond + ');')) === true) return Date.now() - t0; await sleep(500); } throw new Error('timed out: ' + what); };
  const pre = ['try{for(const k of Object.keys(localStorage)) if(/^flydiy\\.(fl([A-Z]|$)|route$|world$|gfx$|premises\\.game|build\\.|career\\.|player$|wip$|day\\.)/.test(k)) localStorage.removeItem(k);}catch(e){}',
    'try{localStorage.setItem("flydiy.wip",' + JSON.stringify(fs.readFileSync(path.resolve(ROOT, 'flyDiy', CUB), 'utf8')) + ')}catch(e){}',
    // the route HOME / CIRCUIT and MANUAL: after a lift the Cub stays at idle on the stand (the world's stills, no taxi)
    'try{localStorage.setItem("flydiy.route",' + JSON.stringify(JSON.stringify({ v: 2, base: 'HOME', to: 'CIRCUIT' })) + ');localStorage.setItem("flydiy.flManual","1")}catch(e){}'];
  // the first document only: a reload keeps what the page wrote
  const preOnce = 'if (!sessionStorage.getItem("__scPre")) { sessionStorage.setItem("__scPre", "1"); ' + pre.join('\n') + ' }';
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Page.addScriptToEvaluateOnNewDocument', { source: [preOnce, GPUX_SRC, MON_SRC].join('\n') });
  await cmd('Emulation.setDeviceMetricsOverride', { width: SIZE[0], height: SIZE[1], deviceScaleFactor: 1, mobile: false });
  await cmd('Page.bringToFront');
  const url = 'http://localhost:' + SPORT + '/flyDiy/index.html' + (Q ? '?' + Q : '');
  const T0 = Date.now();
  await cmd('Page.navigate', { url });
  console.log('nav ' + url + ' (' + LABEL + ' ' + sha + ' build ' + build + ')');
  const res = { url, size: SIZE, q: Q, label: LABEL, sha, build, parts: PARTS, rung: { cpu: THROTTLE || 1, gpux: GPUX || 1 }, reps: REPS, after: AFTER, errs,
    picture: {}, stills: [], discarded: [], baseline: {}, jumps: [], log: [] };
  const save = () => fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
  const note = s => { const l = new Date().toTimeString().slice(0, 8) + ' ' + s; res.log.push(l); console.log(l); };
  await until(`window.BOOT && BOOT.state === 'gone' && window.FLIGHT_PROBE && window.DAY_CLOCK && FLIGHT_PROBE.world && FLIGHT_PROBE.world().day`, 600000, 'the garage boot');
  res.load = (Date.now() - T0) / 1000; note('garage up in ' + res.load.toFixed(1) + ' s');
  await run(`for (const b of document.querySelectorAll('button, [role=button], div, span')) { if (/^\\s*keep the current build\\s*$/i.test(b.textContent || '') && b.offsetParent) { b.click(); break; } } return 1;`);
  res.gfx = await run('return window.GFX && GFX.get ? GFX.get() : null;');
  res.hasJump = await run('return typeof DAY_CLOCK.wait === "function" && "jumps" in DAY_CLOCK;');
  res.boot = await run('return ' + STATE + ';');
  note('boot state ' + JSON.stringify(res.boot));
  save();

  const rung = async on => {
    if (THROTTLE > 1) await cmd('Emulation.setCPUThrottlingRate', { rate: on ? THROTTLE : 1 });
    if (GPUX > 1) await run('window.__GPUX = ' + (on ? GPUX : 1) + '; return 1;');
  };
  // a still: the UI hidden, the label in the corner, only on a loaded page (before AND after the capture)
  const shoot = async (name, text, settleMs) => {
    await run(`if (window.SHOT_MODE) SHOT_MODE.enter(); let d = document.getElementById('__scLbl'); if (!d) { d = document.createElement('div'); d.id = '__scLbl'; d.style.cssText = 'position:fixed;left:8px;top:8px;z-index:2147483647;font:600 15px/1.3 system-ui,sans-serif;color:#fff;background:rgba(0,0,0,.55);padding:4px 8px;border-radius:4px;pointer-events:none'; document.body.appendChild(d); } d.textContent = ${JSON.stringify(text)}; return 1;`);
    await sleep(settleMs || 0);
    for (let k = 0; k < 3; k++) {
      try { await until(LOADED, 60000, 'a loaded page'); } catch (e) { res.discarded.push({ name, why: 'never loaded' }); continue; }
      await sleep(2000);
      const st = await run('return ' + STATE + ';');
      const r = SHOTS ? await cmd('Page.captureScreenshot', { format: 'png' }) : null;
      if ((await run('return ' + LOADED + ';')) !== true) { res.discarded.push({ name, why: 'a loading screen in the shot' }); note('DISCARDED ' + name); continue; }
      if (r && r.result) { fs.mkdirSync(SHOTS, { recursive: true }); fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(r.result.data, 'base64')); }
      const ri = await run('const R = FLIGHT_PROBE.renderer(); return { calls: R.info.render.calls, tris: R.info.render.triangles };');
      res.stills.push({ name, text, state: st, info: ri }); save();
      note('still ' + name + ' ' + JSON.stringify(st));
      await run('if (window.SHOT_MODE) SHOT_MODE.exit(); const d = document.getElementById("__scLbl"); if (d) d.remove(); return 1;');
      return st;
    }
    await run('if (window.SHOT_MODE) SHOT_MODE.exit(); const d = document.getElementById("__scLbl"); if (d) d.remove(); return 1;');
    return null;
  };
  const tag = (where, what) => [LABEL + ' ' + sha + ' (build ' + build + ')', 'retro' === (/gfx=(\w+)/.exec(Q) || [])[1] ? 'retro' : Q, 'sandbox', where, what].join(' · ');
  // the frames of a window [f0, f1) off the flight recorder
  const ROWS = (f0, f1) => `const REC_ = FLIGHT_REC.rec, rows = []; for (let f = ${f0}; f < ${f1}; f++) { const o = REC_.row(f); if (o && o.dt === o.dt) rows.push(o); } `;
  const STATS = `const q = (a, p) => { const s = a.filter(x => x === x).sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2) : null; };
    const col = k => rows.map(o => o[k]); const wall = rows.reduce((s, o) => s + o.dt, 0);
    const st = { frames: rows.length, fps: +(1000 * rows.length / Math.max(1, wall)).toFixed(1), dt50: q(col('dt'), .5), dt90: q(col('dt'), .9), dt99: q(col('dt'), .99), dtMax: q(col('dt'), 1),
      over50: rows.filter(o => o.dt > 50).length, over100: rows.filter(o => o.dt > 100).length, work50: q(col('work'), .5), render50: q(col('render'), .5), shadow50: q(col('shadow'), .5),
      gpu50: q(col('gpu'), .5), calls: q(col('calls'), .5) };`;
  const baseline = async (where, secs) => {
    const w = await run(`const f0 = FLIGHT_REC.rec.frame; await new Promise(r => setTimeout(r, ${secs * 1000})); const f1 = FLIGHT_REC.rec.frame; ${ROWS('f0', 'f1')} ${STATS} return st;`);
    res.baseline[where] = w; save(); note('baseline ' + where + ' ' + JSON.stringify(w)); return w;
  };
  // ONE JUMP, measured: the call through the jump function (wait / nextFullMoon), then the next AFTER frames
  const jump = async (where, target, rep) => {
    const r = await run(`await new Promise(r => setTimeout(r, 1500));
      const R = FLIGHT_REC.rec, RD = FLIGHT_PROBE.renderer(), S = window.__SC;
      const p0 = RD.info.programs ? RD.info.programs.length : -1, lut0 = S.lut, lt0 = S.lt.length, pb0 = (window.WORLD_RIG && WORLD_RIG.probeState && WORLD_RIG.probeState()) ? WORLD_RIG.probeState().bakes : null;
      const le0 = window.LIGHT_EASE ? LIGHT_EASE.applies : null, f0 = R.frame;
      const t0 = performance.now();
      const out = ${target === 'fullmoon' ? 'DAY_CLOCK.nextFullMoon()' : 'DAY_CLOCK.wait(' + JSON.stringify(target) + ')'};
      const callMs = performance.now() - t0;
      const tEnd = performance.now() + 15000;
      while (R.frame < f0 + ${AFTER} && performance.now() < tEnd) await new Promise(r => setTimeout(r, 100));
      await new Promise(r => setTimeout(r, Math.max(0, t0 + 6000 - performance.now())));   // the long tasks' window: the call to +6 s
      const f1 = Math.min(R.frame, f0 + ${AFTER});
      ${ROWS('f0', 'f1')}
      const first = rows.slice(0, 10).map(o => +o.dt.toFixed(1)), worstI = rows.reduce((b, o, i) => o.dt > rows[b].dt ? i : b, 0);
      const tail = rows.slice(-60).map(o => o.dt).sort((a, b) => a - b);
      const sh = rows.reduce((s, o) => s + (o.shader || 0), 0);
      const lts = S.lt.slice(lt0).filter(x => x[0] >= t0 - 50 && x[0] <= t0 + 6000);
      const pb1 = (window.WORLD_RIG && WORLD_RIG.probeState && WORLD_RIG.probeState()) ? WORLD_RIG.probeState().bakes : null;
      ${STATS}
      return { ok: !!(out && out.ok), why: out && out.why, jump: out && out.jump ? { why: out.jump.why, from: out.jump.from, to: out.jump.to, dtS: out.jump.dtS, version: out.jump.version } : null,
        callMs: +callMs.toFixed(2), first, worst: rows.length ? +rows[worstI].dt.toFixed(1) : null, worstAt: worstI, worstRow: rows.length ? { work: +rows[worstI].work.toFixed(1), render: +rows[worstI].render.toFixed(1), shadow: +rows[worstI].shadow.toFixed(1), shader: +rows[worstI].shader.toFixed(1), gpu: rows[worstI].gpu === rows[worstI].gpu ? +rows[worstI].gpu.toFixed(1) : null } : null,
        shaderMs: +sh.toFixed(1), programs: (RD.info.programs ? RD.info.programs.length : -1) - p0, lut: S.lut - lut0, probeBakes: pb0 == null ? null : pb1 - pb0, applies: le0 == null ? null : LIGHT_EASE.applies - le0,
        longTasks: lts.map(x => x[1]), tail50: tail.length ? +tail[tail.length >> 1].toFixed(2) : null, st,
        sunEl: +FLIGHT_PROBE.world().day.sunEl.toFixed(2), localH: +(FLIGHT_PROBE.world().day.localSeconds / 3600).toFixed(3) };`);
    const o = (r && typeof r === 'object') ? r : { err: String(r) };
    Object.assign(o, { where, target, rep });
    const b = res.baseline[where];
    if (b && o.st) { o.back = o.tail50 != null && b.dt50 != null ? o.tail50 <= b.dt50 * 1.1 + 2 : null;
      o.hitch = (o.worst > 100) || (o.longTasks || []).some(d => d > 150) || (b.dt99 != null && o.worst > b.dt99 + 17); }
    res.jumps.push(o); save();
    note('jump ' + where + ' ' + target + ' #' + rep + ' ' + JSON.stringify({ ok: o.ok, why: o.why, call: o.callMs, worst: o.worst, at: o.worstAt, first: o.first, lt: o.longTasks, prog: o.programs, lut: o.lut, probe: o.probeBakes, back: o.back, hitch: o.hitch, el: o.sunEl, h: o.localH }));
    return o;
  };
  const jumpSet = async (where, order) => {
    await rung(true); await sleep(3000);
    await baseline(where, 6);
    for (let k = 1; k <= REPS && !late(); k++) for (const t of order) { if (late()) break; await jump(where, t, k); }
    if (!late()) await jump(where, 'fullmoon', 1);
    await rung(false);
  };
  const rollOut = async hold => {
    const b = await run('return ' + ROLL_OUT + ';'); note('roll out: ' + b);
    if (hold) {
      // the roll-out shot plays in the garage first (~11 s), then the screen: hold it the moment it is up (a roll-out with
      // nothing to build has no screen at all - then there is no held stand to wait on, said and skipped)
      let held = false; const t0 = Date.now();
      while (!held && Date.now() - t0 < 90000) {
        held = (await run('return !!(window.BOOT && BOOT.state !== "gone" && BOOT.state !== "ready" && BOOT.hold());')) === true;
        if (!held && (await run('return !!(window.BOOT && BOOT.state === "gone" && !FLYDIY_HOLDS().inGarage && !FLYDIY_HOLDS().rollHold);')) === true) break;
        if (!held) await sleep(100);
      }
      note('hold: ' + held + ' after ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
      if (!held) throw new Error('no roll-out screen to hold (nothing to build?)');
      await until(`window.BOOT && BOOT.state === 'waiting' && FLYDIY_HOLDS().rollHold`, 300000, 'the held stand');
    } else await until(`window.BOOT && BOOT.state === 'gone' && !FLYDIY_HOLDS().inGarage && !FLYDIY_HOLDS().rollHold`, 300000, 'the lifted roll-out');
  };

  for (const part of PARTS) {
    if (late()) { note('DEADLINE: ' + part + ' not started'); break; }
    try {
      if (part === 'picture') {
        await run(CAM_ROOM + ' return 1;');
        res.picture.garage = await shoot(LABEL + '_default_garage', tag('the garage', 'default boot, no clock set'), 1500);
        await rollOut(false);
        res.picture.world = await shoot(LABEL + '_default_world', tag('the stand', 'default boot, no clock set, rolled out (manual, idle)'), 4000);
        await run('return ' + ROLL_IN + ';'); await until(`window.BOOT && BOOT.state === 'gone' && FLYDIY_HOLDS().inGarage`, 300000, 'back in the garage');
        await sleep(2000);
      } else if (part === 'garage') {
        await run(CAM_ROOM + ' return 1;');
        await jumpSet('garage', ['dusk', 'night', 'dawn', 'noon']);
      } else if (part === 'gstills') {
        await run(CAM_ROOM + ' return 1;');
        for (const t of ['dusk', 'night']) {
          const r = await run('const o = DAY_CLOCK.wait(' + JSON.stringify(t) + '); return o && o.ok ? o.jump.why : "refused: " + (o && o.why);'); note('wait ' + t + ': ' + r);
          await shoot(LABEL + '_wait_garage_' + t, tag('the garage', (t === 'dusk' ? 'BEFORE: waited to dusk' : 'AFTER: waited dusk -> night (the lamps)')), 5000);
        }
      } else if (part === 'stand') {
        await rollOut(true);
        res.standFrames = await run('const f = FLIGHT_REC.rec.frame; await new Promise(r => setTimeout(r, 2000)); return FLIGHT_REC.rec.frame - f;');
        note('held stand: ' + res.standFrames + ' frames drawn in 2 s');
        await jumpSet('stand', ['night', 'dawn', 'noon', 'dusk']);
        if (!(await run('return FLIGHT_PROBE.world().day.sunEl;') < 0)) { const r = await run('const o = DAY_CLOCK.wait("dusk"); return o && o.ok;'); note('to dusk for the world stills: ' + r); }
        await run('BOOT.go(); return 1;');
        await until(`window.BOOT && BOOT.state === 'gone' && !FLYDIY_HOLDS().rollHold`, 120000, 'the lift');
        note('lifted');
      } else if (part === 'wstills') {
        res.wstills = { before: await shoot(LABEL + '_wait_world_dusk', tag('the stand', 'BEFORE: dusk (waited on the held stand)'), 6000) };
        await run('return ' + ROLL_IN + ';'); await until(`window.BOOT && BOOT.state === 'gone' && FLYDIY_HOLDS().inGarage`, 300000, 'back in the garage');
        await sleep(1500);
        const r = await run('const o = DAY_CLOCK.wait("night"); return o && o.ok ? o.jump : "refused: " + (o && o.why);'); note('wait night in the hangar: ' + JSON.stringify(r));
        await rollOut(false);
        res.wstills.after = await shoot(LABEL + '_wait_world_night', tag('the stand', 'AFTER: waited dusk -> night in the hangar, rolled out'), 6000);
      }
    } catch (e) { note('PART ' + part + ' FAILED: ' + (e && e.message)); try { await rung(false); } catch (x) {} }
    save();
  }
  res.end = await run('return ' + STATE + ';');
  // (after the end state: the direct call replaces the CPU tables, which the frame monitor would count as a re-bake)
  if (flag('lut-ms')) res.lutMs = await run('const t0 = performance.now(); ATMO.bakeT(); const t1 = performance.now(); ATMO.bakeMS(); const t2 = performance.now(); return { T: +(t1 - t0).toFixed(1), MS: +(t2 - t1).toFixed(1) };');
  res.errsN = errs.length; res.wall = (Date.now() - T0) / 1000; save();
  note('done in ' + res.wall.toFixed(0) + ' s, ' + errs.length + ' page errors' + (res.lutMs ? ', LUT re-bake ' + JSON.stringify(res.lutMs) : ''));
  try { await cmd('Browser.close'); } catch (e) {}
  await sleep(800);
  process.exit(0);
})().catch(e => { console.log('FATAL ' + e.stack); try { fs.writeFileSync(OUT + '.fatal.txt', String(e.stack)); } catch (x) {} process.exit(1); });
