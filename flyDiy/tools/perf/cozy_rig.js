#!/usr/bin/env node
// cozy_rig.js - G2315-G2319 WORKS-COZY + GARAGE-RESIDENTS: THE LOOK STILLS AND THE GARAGE'S FRAME, the cozy works (the
// career's main hangar, ?career=1) against today's club (the sandbox) at the same cameras.
//
// One headed Chrome, its own profile, the page at the laptop's 1920 x 1080 on ?gfx=<preset>[&career=1]. The stand holds
// the Jodel (flydiy.wip, GARAGE-LAPTOP's aeroplane); with --residents the profile also holds two saved builds - the
// user's Cub and the metal Cessna (flydiy.build.Cub / .Cessna) - which a new career lifts into its main hangar (PREM-S2's
// lift) and the garage stands as residents once FLEET-PROPS A's idle bake has baked them (the rig waits for both, then
// measures: no bake runs inside a still or a window).
//   STILLS (--shots <dir>): per hour (--hours afternoon,night) x camera (--cams room,wide,side) x residents (on, off when
//     there are any): the canvas, labelled in its top-left corner with the tree / SHA / preset / mode / hour / camera /
//     residents (--label names the tree), and the renderer's draws and triangles of that frame beside it (stills.json).
//   TIMED (--secs S): after the stills, the camera at the room view, CDP's CPU throttle (--cpu-throttle N) and HW-COVERAGE's
//     GPU proxy (--gpux K) applied (the laptop rung: GARAGE-LAPTOP's N 3 / K 6), windows of S seconds read off the flight
//     recorder (garage_fps.js's WIN0: fps, dt p50/p90/p99, slow frames, loop work, render, GPU ms, draws, triangles) - in
//     order ABBA over residents on / off when there are residents, else two windows.
// Usage: node tools/perf/cozy_rig.js --out <json> [--q 'gfx=gamer&career=1'] [--residents] [--shots <dir>] [--label <tree>]
//          [--hours afternoon,night] [--cams room,wide,side] [--secs 12] [--cpu-throttle N] [--gpux K] [--size 1920x1080]
//          [--sport 8591] [--dport 9491] [--udd C:/gcozy] [--wait 300]
// A GPU RUN: take tools/perf/boxlock.sh take gpu COZY first, drop it after. Rigs have no --help.
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const ROOT = path.resolve(__dirname, '..', '..', '..');
const OUT = path.resolve(opt('out', 'cozy_rig.json'));
const Q = opt('q', 'gfx=gamer&career=1'), SIZE = opt('size', '1920x1080').split('x').map(Number);
const SHOTS = opt('shots', null), LABEL = opt('label', 'tree');
const HOURS = opt('hours', 'afternoon,night').split(',').filter(Boolean);
const CAMS = opt('cams', 'room,wide,side').split(',').filter(Boolean);
const SECS = +opt('secs', 0) || 0, THROTTLE = +opt('cpu-throttle', 0) || 0, GPUX = +opt('gpux', 0) || 0;
const SPORT = +opt('sport', 8591), DPORT = +opt('dport', 9491), UDD = opt('udd', 'C:/gcozy'), WAITS = +opt('wait', 300);
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BUILD = 'builds/jodel_2026-09-20_corrected.json';
const RES = { Cub: 'builds/cub_2026-09-20_corrected.json', Cessna: 'bugReports/cessnaMetal (1).json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
let sha = '?'; try { sha = execSync('git rev-parse --short HEAD', { cwd: path.join(ROOT, 'flyDiy') }).toString().trim(); } catch (e) {}
let dirty = ''; try { dirty = execSync('git status --porcelain -- src', { cwd: path.join(ROOT, 'flyDiy') }).toString().trim() ? '+wip' : ''; } catch (e) {}
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

// the cameras (az, el, dist about the stand's target; the garage's orbit clamps the eye inside the room): `room` is the
// garage's own framing (garageCamera), `wide` stands back to read the room, `side` is the editor's side view (a close view)
const CAM = {
  room: 'FLIGHT_PROBE.camSet(...(() => { const c = FLIGHT_PROBE.cam(); return [c.azT, c.elT, c.distT]; })());',
  wide: 'FLIGHT_PROBE.camSet(-2.35, 0.30, 24);',
  back: 'FLIGHT_PROBE.camSet(-0.75, 0.22, 22);',
  side: 'FLIGHT_PROBE.camSet(-Math.PI / 2, 0.06, 13);',
};
// the editor's views set the residents' default the same way the camera pills do (room: on, side: off)
const VIEWK = { room: 'q', wide: 'q', back: 'q', side: 's' };

(async () => {
  let tgt = null;
  for (let i = 0; i < 60 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + DPORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map(); const errs = [];
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).slice(0, 300)); };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const run = async body => { const r = await cmd('Runtime.evaluate', { expression: '(async()=>{ ' + body + '\n })()', awaitPromise: true, returnByValue: true }); const d = r.result;
    if (!d || d.exceptionDetails) return 'ERR ' + (d && d.exceptionDetails ? (d.exceptionDetails.exception && d.exceptionDetails.exception.description || d.exceptionDetails.text) : JSON.stringify(r)); return d.result.value; };
  const until = async (cond, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await run('return !!(' + cond + ');')) === true) return Date.now() - t0; await sleep(1000); } throw new Error('timed out: ' + what); };
  const pre = ['try{for(const k of Object.keys(localStorage)) if(/^flydiy\\.(fl([A-Z]|$)|route$|world$|gfx$|premises\\.game|build\\.|career\\.|player$)/.test(k)) localStorage.removeItem(k);}catch(e){}',
    'try{localStorage.setItem("flydiy.wip",' + JSON.stringify(fs.readFileSync(path.resolve(ROOT, 'flyDiy', BUILD), 'utf8')) + ')}catch(e){}'];
  if (flag('residents')) for (const [n, f] of Object.entries(RES))
    pre.push('try{if(!localStorage.getItem("flydiy.build.' + n + '"))localStorage.setItem("flydiy.build.' + n + '",' + JSON.stringify(fs.readFileSync(path.resolve(ROOT, 'flyDiy', f), 'utf8')) + ')}catch(e){}');
  // the first document only: a reload keeps what the page wrote (the career's document, the bakes)
  const preOnce = 'if (!sessionStorage.getItem("__cozyPre")) { sessionStorage.setItem("__cozyPre", "1"); ' + pre.join('\n') + ' }';
  const inj = [preOnce]; if (GPUX > 1) inj.push(GPUX_SRC);
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Page.addScriptToEvaluateOnNewDocument', { source: inj.join('\n') });
  await cmd('Emulation.setDeviceMetricsOverride', { width: SIZE[0], height: SIZE[1], deviceScaleFactor: 1, mobile: false });
  await cmd('Page.bringToFront');
  const url = 'http://localhost:' + SPORT + '/flyDiy/index.html' + (Q ? '?' + Q : '');
  const T0 = Date.now();
  await cmd('Page.navigate', { url });
  console.log('nav ' + url);
  const mode = /career=1/.test(Q) ? 'career (cozy works)' : 'sandbox (club)';
  const preset = (/gfx=(\w+)/.exec(Q) || [])[1] || 'default';
  const res = { url, size: SIZE, q: Q, label: LABEL, sha: sha + dirty, mode, preset, errs, stills: [] };
  const save = () => fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
  await until(`window.BOOT && BOOT.state === 'gone' && window.FLIGHT_PROBE && window.GARAGE_ENV`, 600000, 'the garage boot');
  res.load = (Date.now() - T0) / 1000; console.log('garage up in ' + res.load.toFixed(1) + ' s');
  await run(`for (const b of document.querySelectorAll('button, [role=button], div, span')) { if (/^\\s*keep the current build\\s*$/i.test(b.textContent || '') && b.offsetParent) { b.click(); break; } } return 1;`);
  res.gfx = await run('return GFX.get();');
  res.room = await run('const h = GARAGE_ENV._debug().hangar; return h ? { shell: h.shell, layout: h.layout, dims: h.dims, unplaced: (h.fitReport && h.fitReport.unplaced || []).length, lamps: h.lampRig && h.lampRig() } : null;');
  console.log('room ' + JSON.stringify(res.room));
  res.debug = await run('let P = null; try { P = window.FLYDIY_PLAYER && FLYDIY_PLAYER.doc ? FLYDIY_PLAYER.doc() : null; } catch (e) { P = String(e); } return { keys: Object.keys(localStorage).filter(k => /flydiy\.(build|career|wip)/.test(k)), fleet: P && P.fleet, home: P && P.sheds && P.sheds.HOME, mode: P && P.mode, fleetOn: window.PARKED && PARKED.fleetOn(), res: GARAGE_ENV.residents ? GARAGE_ENV.residents() : "no api", flydiyFleet: window.FLYDIY_FLEET };');
  console.log('debug ' + JSON.stringify(res.debug));
  // THE RESIDENTS: wait for the idle bake to bake both and the garage to stand them (the editor nudged so applyEnv runs)
  if (flag('residents') && /career=1/.test(Q)) {
    const t0 = Date.now();
    while (Date.now() - t0 < WAITS * 1000) {
      const R = await run('const R = GARAGE_ENV.residentsSync ? GARAGE_ENV.residentsSync() : GARAGE_ENV.residents(); return R ? { plan: R.plan, unplaced: R.unplaced, err: R.err, ms: R.ms, hasDoor: !!(window.PARKED && PARKED.resident), stats: window.PARKED && PARKED.fleet.stats, why: window.PARKED && PARKED.fleet.why } : null;');
      if (R && (R.err || !R.hasDoor)) console.log('  residents: ' + JSON.stringify({ err: R.err, hasDoor: R.hasDoor, ms: R.ms }));
      res.residents = R;
      if (R && R.plan.length && R.plan.every(p => p.filled)) break;
      await run('if (window.FLIGHT_PROBE && FLIGHT_PROBE.camera) {} if (window.GARAGE_ENV && GARAGE_ENV.setMobile) GARAGE_ENV.setMobile(GARAGE_ENV.mobileShown()); return 1;');
      await sleep(4000);
    }
    res.residentsWait = (Date.now() - t0) / 1000;
    console.log('residents ' + JSON.stringify(res.residents && res.residents.plan) + ' after ' + res.residentsWait.toFixed(0) + ' s; fleet ' + JSON.stringify(res.residents && res.residents.stats));
    save();
  }
  const hasRes = !!(res.residents && res.residents.plan && res.residents.plan.some(p => p.filled));
  // a still: the UI hidden (SHOT_MODE), the label burned into the corner, the frame's draws and triangles
  const label = (hour, cam, r) => [LABEL + ' ' + res.sha, preset, mode, hour, cam, r === null ? '' : ('residents ' + (r ? 'on' : 'off'))].filter(Boolean).join(' · ');
  const shoot = async (name, text) => {
    await run(`let d = document.getElementById('__cozyLbl'); if (!d) { d = document.createElement('div'); d.id = '__cozyLbl'; d.style.cssText = 'position:fixed;left:8px;top:8px;z-index:2147483647;font:600 15px/1.3 system-ui,sans-serif;color:#fff;background:rgba(0,0,0,.55);padding:4px 8px;border-radius:4px;pointer-events:none'; document.body.appendChild(d); } d.textContent = ${JSON.stringify(text)}; return 1;`);
    await sleep(400);
    const info = await run('const R = FLIGHT_PROBE.renderer(); return { calls: R.info.render.calls, tris: R.info.render.triangles };');
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); const r = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: 88 }); fs.writeFileSync(path.join(SHOTS, name + '.jpg'), Buffer.from(r.result.data, 'base64')); }
    res.stills.push({ name, text, info }); save();
    console.log('still ' + name + ' ' + JSON.stringify(info));
  };
  await run('if (window.SHOT_MODE) SHOT_MODE.enter(); return 1;');
  for (const hour of HOURS) {
    await run(`if (window.DAY_CLOCK) DAY_CLOCK.preset(${JSON.stringify(hour)}); return 1;`);
    await sleep(3500);
    for (const cam of CAMS) {
      await run(`const E = window.EDITOR_API || null; ${CAM[cam] || CAM.room} return 1;`);
      for (const r of (hasRes ? [true, false] : [null])) {
        if (r !== null) await run(`GARAGE_ENV.setResidents(${r}); return 1;`);
        await sleep(1800);
        await shoot([preset, /career=1/.test(Q) ? 'cozy' : 'club', hour, cam, r === null ? 'nores' : (r ? 'res' : 'nores')].join('_'), label(hour, cam, r));
      }
    }
  }
  if (hasRes) await run('GARAGE_ENV.setResidents(true); return 1;');
  await run('if (window.SHOT_MODE) SHOT_MODE.exit(); const d = document.getElementById("__cozyLbl"); if (d) d.remove(); return 1;');
  if (SECS > 0) {
    await run(`if (window.DAY_CLOCK) DAY_CLOCK.preset('afternoon'); ${CAM.room} return 1;`);
    if (THROTTLE > 1) await cmd('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
    if (GPUX > 1) await run('window.__GPUX = ' + GPUX + '; return 1;');
    res.rung = { cpu: THROTTLE || 1, gpux: GPUX || 1 };
    await sleep(4000);
    const WIN = secs => `const R = FLIGHT_REC.rec; const f0 = R.frame; await new Promise(r => setTimeout(r, ${secs * 1000})); const f1 = R.frame;
      const rows = []; for (let f = f0; f < f1; f++) { const o = R.row(f); if (o && o.dt === o.dt) rows.push(o); }
      const q = (k, p) => { const a = rows.map(o => o[k]).filter(x => x === x).sort((x, y) => x - y); return a.length ? +a[Math.min(a.length - 1, Math.floor(p * a.length))].toFixed(2) : null; };
      const wall = rows.reduce((s, o) => s + o.dt, 0);
      return { frames: rows.length, fps: +(1000 * rows.length / Math.max(1, wall)).toFixed(1), dt50: q('dt', .5), dt90: q('dt', .9), dt99: q('dt', .99), slow: rows.filter(o => o.dt > 50).length,
        over50: +(rows.filter(o => o.dt > 50).length / Math.max(1, rows.length)).toFixed(3),
        work50: q('work', .5), render50: q('render', .5), shadow50: q('shadow', .5), gpu50: q('gpu', .5), gpu90: q('gpu', .9), calls: q('calls', .5), mtris: +(q('tris', .5) / 1e6).toFixed(3) };`;
    res.windows = [];
    for (const r of (hasRes ? [true, false, false, true] : [null, null])) {
      if (r !== null) await run(`GARAGE_ENV.setResidents(${r}); return 1;`);
      await sleep(2500);
      const w = await run(WIN(SECS)); w.residents = r; res.windows.push(w); save();
      console.log('  window residents ' + r + ' ' + JSON.stringify(w));
    }
    const by = {}; for (const w of res.windows) (by[String(w.residents)] = by[String(w.residents)] || []).push(w);
    const avg = (a, k) => +(a.reduce((s, w) => s + (w[k] || 0), 0) / a.length).toFixed(2);
    res.summary = Object.fromEntries(Object.entries(by).map(([k, a]) => [k, { fps: avg(a, 'fps'), dt50: avg(a, 'dt50'), dt90: avg(a, 'dt90'), dt99: avg(a, 'dt99'), over50: avg(a, 'over50'), work50: avg(a, 'work50'), render50: avg(a, 'render50'), gpu50: avg(a, 'gpu50'), gpu90: avg(a, 'gpu90'), calls: avg(a, 'calls'), mtris: avg(a, 'mtris') }]));
    console.log('COZY_RIG ' + JSON.stringify(res.summary));
    if (THROTTLE > 1) await cmd('Emulation.setCPUThrottlingRate', { rate: 1 });
  }
  res.errsN = errs.length; res.wall = (Date.now() - T0) / 1000; save();
  try { await cmd('Browser.close'); } catch (e) {}
  await sleep(500);
  process.exit(0);
})().catch(e => { console.log('FATAL ' + e.stack); try { fs.writeFileSync(OUT + '.fatal.txt', String(e.stack)); } catch (x) {} process.exit(1); });
