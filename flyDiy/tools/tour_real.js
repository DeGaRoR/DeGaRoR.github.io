#!/usr/bin/env node
// tour_real.js - TOUR-REAL (G2065-G2069): THE ISLAND TOUR FLOWN BY THE PAGE, ON THE GPU, THE PLAYER'S WAY.
//
// The user (2026-10-05): "the ultimate test of pilot one should be to do a full tour of the island's location in one
// go. Land at each, u-turn, take-off again, visit the next one. Success when it gets undamaged back to the mother
// airport." ISLAND-TOUR flew it in node (tools/_tour_lib.js: buildGen + sim.step at 1/60 in a node world); the user
// (6 Oct): "we'll need to check the path of island-tour with a real GPU run, because that sounds fishy to me."
//
// THIS RIG drives the GAME, not a node shortcut:
//   - a HEADED Chrome on the GPU (raw CDP, as rollout_perf.js), a FRESH profile, the page from --root's tree served by
//     its own _serve.js (the port checked free, the answering root checked), the default gamer preset (checked);
//   - the build in the WIP slot (localStorage flydiy.wip, as rollout_perf --build), ?damage=0|1, the route pref v2
//     { base: HOME, to: <the first To> } - the roll-out departs HOME's stand for it, exactly as the shed's To picker;
//   - EACH NEXT LEG the player's way: at STOPPED on the leg's To, the plate's To picker (#selDest) is set to the next
//     To and its change event fired - app.js setTo -> destApply -> nextLeg (DEST-TO: the From under the aeroplane, a
//     fresh pilot, no reset). No teleport, no reset, no FLIGHT_PROBE.place;
//   - --rate 2: the game's own 2x (TEST_FLIGHT.rate - the pilot flyout's '2x' row): the worker steps 60*rate steps of
//     1/60 s a wall second, the same dt and the same pilot step (the physics unchanged); the page drops it to 1x by
//     itself when the worker's dilation falls under 0.9, and at every arrival (flightArrived): the rig logs each drop
//     and re-arms it.
// WHAT IT RECORDS (--out <dir>):
//   samples.json   the flown track at 4 Hz of SIM time, taken in the page on each rendered frame (FLYDIY_PACE.end):
//                  [t, x, y, z, agl, phase, Vg, nose, onG, leg, wallMs, dil, hudAgl, fuelL] + the phase events
//   legs.json      per leg: the sim t of its start / stop, the page pilot's report (verdicts, landing, outcome), the
//                  To command's answer (FLYDIY_DEST_LAST), the stills taken (moment, sim t, files), the obstacles the
//                  page's world held at the stop (WORLD obstacles.list), the rate log
//   stills/        per leg, a CHASE still and a TOP-DOWN still (the orbit eye straight down) at fixed moments: the
//                  departure, the U-turn on the strip (90 deg into the turn), the roll start, the lift-off, the final at
//                  1 km and at 300 m, the touchdown, the roll-out stop
//   cast/          the whole flight as a screencast (Page.startScreencast, every --cast-nth frame); tools/tour_real_report.js cuts the U-turn and
//                  landing windows out of it (the top-down blips excluded)
//   flightlog      the game's own flight recorder (FLIGHT_REC.save, downloaded into --out) at the end
//   run.log        everything printed
// Usage: node tools/tour_real.js --root D:/Dev/wt-tour [--build builds/cub_2026-09-20_corrected.json]
//          [--order HOME,w3,tw_ski,mn_strip,w2,HOME] [--damage 0] [--rate 2] [--port 8771] [--size 1600x900]
//          [--out <dir>] [--deadline 09:58] [--fallback D:/Dev/DeGaRoR.github.io] [--cast-nth 5] [--legs N]
//          [--shakedown <s>] (stop <s> wall seconds after the flight starts: the rig's own check)
//          [--url <page url>] (a page served elsewhere - the mock in tools/tour_real_mock.html; no server, no build)
// A GPU run: bash tools/perf/boxlock.sh take gpu <who> "<what>" first, drop after. No --help (the rig would run).
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const ROOT = path.resolve(opt('root', path.join(__dirname, '..', '..')));
const BUILD = opt('build', 'builds/cub_2026-09-20_corrected.json');
const ORDER = opt('order', 'HOME,w3,tw_ski,mn_strip,w2,HOME').split(',');
const DAMAGE = opt('damage', '0');
const RATE = +opt('rate', 2);
const SPORT = +opt('port', 8771);
const SIZE = opt('size', '1600x900').split('x').map(Number);
const FALLBACK = opt('fallback', 'D:/Dev/DeGaRoR.github.io');
const CAST_NTH = +opt('cast-nth', 5);
const LEGS = +opt('legs', 99);
const SHAKEDOWN = +opt('shakedown', 0);
const DEADLINE = opt('deadline', null);
const HEADLESS = flag('headless');           // the mock's plumbing check only (never the game: G586's rig clock)
let URL = opt('url', null);
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '');
const OUT = path.resolve(opt('out', path.join(__dirname, '..', 'reports', 'evidence', 'TOUR-REAL', 'run_' + stamp)));
fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'cast'), { recursive: true });
const LOG = fs.createWriteStream(path.join(OUT, 'run.log'), { flags: 'a' });
const t00 = Date.now();
const log = (...a) => { const s = '[' + ((Date.now() - t00) / 1000).toFixed(1).padStart(7) + ' s] ' + a.join(' '); console.log(s); LOG.write(s + '\n'); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
const deadlineMs = (() => {
  if (!DEADLINE) return Infinity;
  const [h, m] = DEADLINE.split(':').map(Number), d = new Date(); d.setHours(h, m, 0, 0);
  if (d.getTime() < Date.now() - 6 * 3600e3) d.setDate(d.getDate() + 1);
  return d.getTime();
})();

const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('tour_real: no Chrome found'); process.exit(2); }

// ---- the static server: --root's tree, the port free first, the answer ours ----------------------------------
const portAnswer = () => new Promise(res => { const rq = http.get('http://127.0.0.1:' + SPORT + '/flyDiy/version.json', r => { r.resume(); res(r.headers['x-serve-root'] ? decodeURIComponent(r.headers['x-serve-root']) : '(unnamed)'); });
  rq.on('error', () => res(null)); rq.setTimeout(2000, () => { rq.destroy(); res(null); }); });
let server = null, serverExit = null, ch = null;
function killAll() {
  for (const p of [ch, server]) if (p) try { if (process.platform === 'win32') execSync('taskkill /PID ' + p.pid + ' /T /F', { stdio: 'ignore' }); else p.kill(); } catch (e) {}
  ch = server = null;
}
process.on('exit', killAll);
process.on('SIGINT', () => { log('SIGINT'); killAll(); process.exit(130); });

// ---- what the page is given before its first script ---------------------------------------------------------
function preScript() {
  const L = [];
  const txt = fs.readFileSync(path.resolve(ROOT, 'flyDiy', BUILD), 'utf8');
  L.push('try{localStorage.setItem("flydiy.wip",' + JSON.stringify(txt) + ')}catch(e){}');
  L.push('try{localStorage.removeItem("flydiy.gfx")}catch(e){}');
  L.push('try{for(const k of Object.keys(localStorage))if(/^flydiy\\.(fl([A-Z]|$)|route$|world$)/.test(k))localStorage.removeItem(k)}catch(e){}');
  // the shed's To picker's pref (G1945 v2): the roll-out departs the base's stand for the first To
  L.push('try{localStorage.setItem("flydiy.route",' + JSON.stringify(JSON.stringify({ v: 2, base: 'HOME', to: ORDER[1] })) + ');localStorage.setItem("flydiy.flManual","0")}catch(e){}');
  L.push('try{localStorage.removeItem("flydiy.premises.game.jolene")}catch(e){}');
  return L.join('\n');
}

// ---- the page-side sampler: one row each 0.25 s of SIM time, on the rendered frame ---------------------------
const INSTALL = `(() => {
  if (window.__TR) return 'have';
  const P = window.FLYDIY_PACE; if (!P || !window.FLIGHT_PROBE) return 'no-probe';
  const R = window.__TR = { rows: [], ev: [], leg: 1, nextT: -1, last: '', err: null, frames: 0 };
  const end0 = P.end;
  P.end = function () {
    try {
      R.frames++;
      const s = FLIGHT_PROBE.sim(), ap = FLIGHT_PROBE.ap(), W = FLIGHT_PROBE.world();
      if (s && ap && W) {
        const t = s.t, ph = ap.phase || '';
        if (ph !== R.last) { R.ev.push([+t.toFixed(3), ph, R.leg, ap.route ? (ap.route.to && ap.route.to.id) || ap.route.to || null : null]); R.last = ph; }
        if (t >= R.nextT) {
          R.nextT = Math.floor(t * 4 + 1) / 4;
          const cg = s.cgPos(), v = s.cgVel(), xA = s.axes()[0], nl = Math.hypot(xA[0], xA[2]) || 1e-9;
          const SW = window.FLYDIY_SIMW, w = SW && SW.perf ? SW.perf() : null;
          const r2 = q => Math.round(q * 100) / 100;
          R.rows.push([r2(t), r2(cg[0]), r2(cg[1]), r2(cg[2]), r2(cg[1] - W.terrainH(cg[0], cg[2])), ph, r2(Math.hypot(v[0], v[2])),
            +Math.atan2(-xA[2] / nl, -xA[0] / nl).toFixed(4), s.wheelsOnGround(), R.leg, Math.round(performance.now()),
            w && w.live ? +w.dil.toFixed(3) : null, r2(FLIGHT_PROBE.agl()), s.fuel && s.fuel.litres != null ? r2(s.fuel.litres) : null]);
        }
      }
    } catch (e) { R.err = String(e && e.stack || e).slice(0, 400); }
    return end0.apply(this, arguments);
  };
  return 'installed';
})()`;
// the rig's view of the flight, each poll
const STATE = `JSON.stringify((() => {
  const s = FLIGHT_PROBE.sim(), ap = FLIGHT_PROBE.ap(), cg = s.cgPos(), v = s.cgVel(), xA = s.axes()[0], nl = Math.hypot(xA[0], xA[2]) || 1e-9;
  const SW = window.FLYDIY_SIMW, w = SW && SW.perf ? SW.perf() : null, R = window.__TR || {};
  const rt = ap.route ? { from: (ap.route.from && ap.route.from.id) || ap.route.from || null, to: (ap.route.to && ap.route.to.id) || ap.route.to || null } : null;
  return { t: s.t, x: cg[0], y: cg[1], z: cg[2], agl: FLIGHT_PROBE.agl(), ph: ap.phase || '', rt, Vg: Math.hypot(v[0], v[2]),
    nose: Math.atan2(-xA[2] / nl, -xA[0] / nl), onG: s.wheelsOnGround(), over: FLIGHT_PROBE.over(), apT: ap.t,
    dil: w && w.live ? w.dil : null, dropped: w && w.live ? w.droppedS : null, stepMs: w && w.live ? w.stepMs : null, rows: (R.rows || []).length, err: R.err || null, frames: R.frames || 0,
    rate: window.TEST_FLIGHT ? TEST_FLIGHT.rate(${RATE}) : null };
})())`;

(async () => {
  log('tour_real: root ' + ROOT + ' · build ' + BUILD + ' · damage ' + DAMAGE + ' · rate ' + RATE + ' · ' + ORDER.join(' > ') + ' · out ' + OUT);
  if (!URL) {
    if (await portAnswer() !== null) { log('*** port ' + SPORT + ' already answers - another server; pass --port'); process.exit(4); }
    server = spawn(process.execPath, [path.join(ROOT, 'flyDiy', 'tools', '_serve.js'), String(SPORT), ROOT, '--fallback', FALLBACK], { stdio: 'ignore' });
    server.on('exit', c => { serverExit = c; });
    let root = null;
    for (let i = 0; i < 40 && root === null; i++) { await sleep(250); if (serverExit !== null) break; root = await portAnswer(); }
    if (root === null || path.resolve(root).toLowerCase() !== ROOT.toLowerCase()) { log('*** the server on ' + SPORT + ' is not ours (root ' + root + ')'); process.exit(4); }
    URL = 'http://localhost:' + SPORT + '/flyDiy/index.html?damage=' + DAMAGE;
    try { const V = await getJSON('http://127.0.0.1:' + SPORT + '/flyDiy/version.json'); log('  version.json ' + JSON.stringify(V)); } catch (e) {}
  }
  const DPORT = 9600 + (process.pid % 300);
  const UDD = path.join(os.tmpdir(), 'tour_real_udd_' + stamp);
  ch = spawn(CHROME, ['--remote-debugging-port=' + DPORT, '--window-size=' + (SIZE[0] + 16) + ',' + (SIZE[1] + 140), '--window-position=0,0',
    '--no-first-run', '--no-default-browser-check', '--user-data-dir=' + UDD,
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows']
    .concat(HEADLESS ? ['--headless=new', '--disable-gpu'] : [], ['about:blank']), { stdio: 'ignore' });
  log('  chrome pid ' + ch.pid + ' · devtools ' + DPORT + ' · profile ' + UDD);
  let tgt = null;
  for (let i = 0; i < 60 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + DPORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  if (!tgt) throw new Error('no page target');
  const ws = new WebSocket(tgt.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map(), exc = [];
  // ---- the screencast: every frame to cast/, its arrival on the rig's clock
  const cast = []; let castOn = false, castSeq = 0, castBlank = null;   // castBlank: [t0, t1] wall windows to drop (the top-down blips)
  const blanks = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; const s = ((d.exception && d.exception.description) || d.text || '').split('\n')[0]; exc.push(s); log('  page exception: ' + s); }
    if (m.method === 'Page.screencastFrame') {
      const p = m.params, n = ++castSeq, f = 'c' + String(n).padStart(6, '0') + '.jpg';
      ws.send(JSON.stringify({ id: ++id, method: 'Page.screencastFrameAck', params: { sessionId: p.sessionId } }));
      fs.writeFile(path.join(OUT, 'cast', f), Buffer.from(p.data, 'base64'), () => {});
      cast.push([n, Date.now(), p.metadata && p.metadata.timestamp ? p.metadata.timestamp : null, castBlank ? 1 : 0]);
    }
  };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async (expr, timeoutMs) => {
    const p = cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    const r = await Promise.race([p, sleep(timeoutMs || 30000).then(() => ({ result: { exceptionDetails: { text: 'timeout' } } }))]);
    const d = r.result;
    if (!d || d.exceptionDetails) throw new Error('page: ' + (d && d.exceptionDetails ? ((d.exceptionDetails.exception && d.exceptionDetails.exception.description) || d.exceptionDetails.text) : JSON.stringify(r)));
    return d.result.value;
  };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Page.addScriptToEvaluateOnNewDocument', { source: preScript() });
  await cmd('Emulation.setDeviceMetricsOverride', { width: SIZE[0], height: SIZE[1], deviceScaleFactor: 1, mobile: false });
  await cmd('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: OUT });
  await cmd('Page.bringToFront');
  const tNav = Date.now();
  await cmd('Page.navigate', { url: URL });
  log('  -> ' + URL);
  await sleep(2000);
  const boot = await ev("(() => Promise.race([(window.BOOT && BOOT.whenReady) ? BOOT.whenReady().then(() => 'ready') : new Promise(r => setTimeout(() => r('no BOOT'), 30000)), new Promise(r => setTimeout(() => r('boot timeout'), 300000))]))()", 310000);
  log('  garage: ' + boot + ' after ' + ((Date.now() - tNav) / 1000).toFixed(1) + ' s');
  const KEEP = "(()=>{const l=[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0&&b.offsetParent);l.forEach(x=>x.click());return l.length;})()";
  for (let i = 0; i < 10; i++) { const n = await ev(KEEP); await sleep(400); if (!n && i > 3) break; }
  await sleep(1500);
  const env = JSON.parse(await ev("JSON.stringify({ gpu: (()=>{const c=document.createElement('canvas').getContext('webgl2');const d=c&&c.getExtension('WEBGL_debug_renderer_info');return d?c.getParameter(d.UNMASKED_RENDERER_WEBGL):'?';})(), gfx: window.GFX ? GFX.get() : null, build: window.FLYDIY_BUILD || null, route: window.FLYDIY_ROUTE ? FLYDIY_ROUTE.get() : null, ua: navigator.userAgent, webdriver: navigator.webdriver })"));
  log('  env ' + JSON.stringify(env));
  if (env.gfx && env.gfx.preset && env.gfx.preset !== 'gamer') log('  !!! the preset is ' + env.gfx.preset + ', not gamer');
  // ROLL OUT: one press (rollout_perf G1117)
  await ev("(()=>{const g=document.getElementById('bGo');const l=[...document.querySelectorAll('button')].filter(b=>/roll out/i.test(b.textContent)&&b.offsetParent);const b=g&&g.offsetParent&&/roll out/i.test(g.textContent)?g:l[0];if(b)b.click();return l.length;})()");
  const tRoll = Date.now();
  let bs = '';
  for (let i = 0; i < 600; i++) {
    bs = await ev("window.BOOT ? BOOT.state : 'none'", 20000);
    if (bs === 'waiting') await ev("(()=>{const f=document.getElementById('bootFly');if(f&&!f.disabled)f.click();return 1;})()");
    if ((bs === 'gone' || bs === 'none') && Date.now() - tRoll > 3000) break;
    await sleep(500);
  }
  log('  roll-out screen: ' + bs + ' after ' + ((Date.now() - tRoll) / 1000).toFixed(1) + ' s');
  { const tw = Date.now() + 40000; while (Date.now() < tw && await ev('!!(window.ROLLANIM && ROLLANIM.busy())', 20000)) await sleep(200); }
  await sleep(1000);
  { const a = await ev('FLIGHT_PROBE.sim().t'); await sleep(1500); const b = await ev('FLIGHT_PROBE.sim().t');
    if (!(b > a)) { log('  the sim held after the reveal: pressing the bar'); await ev("(()=>{const b=document.getElementById('bGo');if(b&&b.offsetParent)b.click();const p=document.getElementById('bPause');if(p&&/run|resume/i.test(p.textContent))p.click();return 1;})()"); } }
  const start = JSON.parse(await ev("JSON.stringify((() => { const s = FLIGHT_PROBE.sim(), d = FLIGHT_PROBE.def(), W = FLIGHT_PROBE.world(), cg = s.cgPos(); const ap = FLIGHT_PROBE.ap();"
    + " return { route: FLYDIY_ROUTE.get(), where: FLYDIY_ROUTE.where ? FLYDIY_ROUTE.where() : null, span: d.params.gen ? d.params.gen.span : null, damage: d.params.damage, dmgPage: window.FLYDIY_DAMAGE, substeps: d.params.substeps, mass: Math.round(s.totalM || 0),"
    + " cg: cg.map(v => +v.toFixed(1)), phase: ap.phase, apRoute: ap.route, manual: FLIGHT_PROBE.manual(), simw: !!(window.FLYDIY_SIMW && FLYDIY_SIMW.perf && FLYDIY_SIMW.perf().live), t: s.t,"
    + " timeOrigin: performance.timeOrigin, weather: JSON.parse(JSON.stringify(W.weather || null)), day: W.day && W.day.spec ? JSON.parse(JSON.stringify(W.day.spec())) : null,"
    + " woodSolid: W.woodSolid, obstacles: W.obstacles ? W.obstacles.count : null, treeHits: W.treeHits ? (W.treeHits.n != null ? W.treeHits.n : W.treeHits.count != null ? W.treeHits.count : 'set') : null }; })())"));
  log('  start ' + JSON.stringify(start));
  const AERO = JSON.parse(await ev("JSON.stringify(FLIGHT_PROBE.world().aerodromes.map(a => ({ id: a.id, x: a.x, z: a.z, hdg: a.hdg, len: a.len, wid: a.wid, elev: a.elev, water: !!a.water || a.kind === 'water', name: a.name })))"));
  const A = id => AERO.find(a => a.id === id);
  for (const k of ORDER) if (!A(k)) { log('*** no aerodrome ' + k + ' in the page world'); process.exit(5); }
  await ev("FLIGHT_PROBE.camMode('chase'), 1");
  log('  install: ' + await ev(INSTALL));
  log('  rate: ' + await ev('window.TEST_FLIGHT ? TEST_FLIGHT.rate(' + RATE + ') : null'));
  await cmd('Page.startScreencast', { format: 'jpeg', quality: 60, maxWidth: 960, maxHeight: 540, everyNthFrame: CAST_NTH });
  castOn = true;

  // ---- the stills: chase, then the orbit eye straight down, then back to chase ----------------------------------
  const stills = [];
  const shot = async (leg, moment, st, D) => {
    const base = 'L' + leg + '_' + moment;
    const r1 = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
    fs.writeFileSync(path.join(OUT, 'stills', base + '_chase.jpg'), Buffer.from(r1.result.data, 'base64'));
    const w0 = Date.now(); castBlank = [w0, null];
    await ev("(() => { const c = FLIGHT_PROBE.cam(); FLIGHT_PROBE.camMode('orbit'); FLIGHT_PROBE.camSet(c.az, 1.45, " + D + "); return 1; })()");
    await sleep(350);
    const r2 = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
    fs.writeFileSync(path.join(OUT, 'stills', base + '_top.jpg'), Buffer.from(r2.result.data, 'base64'));
    await ev("FLIGHT_PROBE.camMode('chase'), 1");
    await sleep(500);
    blanks.push([w0, Date.now()]); castBlank = null;
    const rec = { leg, moment, t: st ? +st.t.toFixed(2) : null, ph: st ? st.ph : null, x: st ? +st.x.toFixed(1) : null, z: st ? +st.z.toFixed(1) : null,
      agl: st ? +st.agl.toFixed(1) : null, files: [base + '_chase.jpg', base + '_top.jpg'], topDist: D, wall: w0 };
    stills.push(rec);
    log('    still L' + leg + ' ' + moment + ' t ' + rec.t + ' ' + rec.ph + ' agl ' + rec.agl);
    return rec;
  };
  const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const frame = a => { const ux = Math.cos(a.hdg), uz = Math.sin(a.hdg); return { s: (x, z) => (x - a.x) * ux + (z - a.z) * uz, c: (x, z) => -(x - a.x) * uz + (z - a.z) * ux }; };
  const dThr = (b, st) => Math.hypot(st.x - b.x, st.z - b.z) - b.len / 2;
  const GROUND_PRE = new Set(['DEPART', 'TAXI', 'LINEUP', 'STOP', 'HOLD']);

  // ---- the tour --------------------------------------------------------------------------------------------------
  const legs = [], rateLog = [];
  let st = JSON.parse(await ev(STATE)), lastT = st.t, lastTWall = Date.now(), rowsPulled = 0, evPulled = 0;
  const spd = []; let slowNow = false;
  const rows = [], phaseEv = [];
  const pull = async () => {
    const got = JSON.parse(await ev('JSON.stringify({ r: (window.__TR.rows || []).slice(' + rowsPulled + '), e: (window.__TR.ev || []).slice(' + evPulled + ') })'));
    for (const r of got.r) rows.push(r); rowsPulled += got.r.length;
    for (const e of got.e) phaseEv.push(e); evPulled += got.e.length;
  };
  let end = null;
  const flightStartWall = Date.now();
  for (let li = 1; li < ORDER.length && li <= LEGS && !end; li++) {
    const a = A(ORDER[li - 1]), b = A(ORDER[li]), FA = frame(a);
    const L = { leg: li, from: a.id, to: b.id, tStart: st.t, wallStart: Date.now(), cmd: null, moments: {}, rate: [], stop: null, report: null, faults: [] };
    if (li > 1) {
      // THE NEXT TO, THE PLAYER'S WAY: the plate's To picker, its change event (app.js setTo -> destApply -> nextLeg)
      await sleep(800);
      const r = JSON.parse(await ev("JSON.stringify((() => { const s = document.getElementById('selDest'); const o = [...s.options].find(q => q.value === " + JSON.stringify(b.id) + ");"
        + " if (!o) return { err: 'no option ' + " + JSON.stringify(b.id) + " }; const dis = o.disabled; s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true }));"
        + " return { last: window.FLYDIY_DEST_LAST, disabled: dis, t: FLIGHT_PROBE.sim().t, phase: FLIGHT_PROBE.ap().phase }; })())"));
      L.cmd = r; L.tStart = r.t != null ? r.t : st.t;
      log('  LEG ' + li + ' ' + a.id + ' > ' + b.id + ': the To picker -> ' + JSON.stringify(r));
      if (!r.last || r.last.how !== 'leg') { L.faults.push({ k: 'to-picker', note: JSON.stringify(r) }); log('  !!! the To did not start a leg'); }
      await ev('window.__TR.leg = ' + li + ', 1');
    } else log('  LEG 1 ' + a.id + ' > ' + b.id + ' (the roll-out: the route pref ' + JSON.stringify(start.route) + ')');
    await ev("window.FLIGHT_REC && FLIGHT_REC.mark && FLIGHT_REC.mark('TOUR-REAL leg " + li + " " + a.id + " > " + b.id + "'), 1").catch(() => 0);
    let effSum = 0, effN = 0, effMin = Infinity;
    let turned = 0, prevNose = null, sawRoll = false, sawLift = false, air = false, sawFinal = false, sawTd = false, stopT = null, lastStill = 0;
    const M = L.moments;
    const take = async (k, D) => { if (M[k]) return; M[k] = await shot(li, k, st, D); };
    for (;;) {
      await sleep(150);
      try { st = JSON.parse(await ev(STATE, 15000)); } catch (e) { log('  poll: ' + e.message); await sleep(1000); continue; }
      const now = Date.now();
      // THE RATE, MEASURED: the page has no getter for its 2x (TEST_FLIGHT.rate sets it - STATE re-arms it each poll, so a
      // drop to 1x - the page's own on a slow worker, or an arrival's - lasts at most a poll); what the flight really ran
      // at is sim s over wall s, over the last 3 s - a stretch under 0.8 of the rate asked is logged, with the worker's dil
      spd.push([now, st.t]); while (spd.length > 2 && now - spd[0][0] > 3000) spd.shift();
      const eff = spd.length > 1 && now - spd[0][0] > 1500 ? (st.t - spd[0][1]) / ((now - spd[0][0]) / 1000) : null;
      if (eff !== null) {
        const slow = eff < 0.8 * RATE;
        if (slow !== slowNow) { slowNow = slow; rateLog.push({ wall: now, t: +st.t.toFixed(1), leg: li, eff: +eff.toFixed(2), slow, dil: st.dil, dropped: st.dropped, stepMs: st.stepMs, ph: st.ph });
          L.rate.push([+st.t.toFixed(1), +eff.toFixed(2), slow ? 'slow' : 'ok', st.dil]); log('  rate ' + (slow ? 'SLOW' : 'back') + ': ' + eff.toFixed(2) + 'x at t ' + st.t.toFixed(1) + ' (' + st.ph + ') dil ' + (st.dil != null ? st.dil.toFixed(2) : '-') + ' dropped ' + st.dropped); }
        effSum += eff; effN++; if (eff < effMin) effMin = eff;
      }
      if (st.t > lastT + 1e-6) { lastT = st.t; lastTWall = now; }
      else if (now - lastTWall > 30000) { end = 'the sim stopped advancing (30 s wall at t ' + st.t.toFixed(1) + ', phase ' + st.ph + ')'; L.faults.push({ k: 'stall', note: end }); break; }
      if (st.err) { log('  sampler error: ' + st.err); }
      const legT = st.t - L.tStart;
      // the moments
      if (!M.depart && legT > 3) await take('depart', 220);
      if (!sawRoll && GROUND_PRE.has(st.ph)) {
        const onStrip = Math.abs(FA.s(st.x, st.z)) < a.len / 2 + 5 && Math.abs(FA.c(st.x, st.z)) < a.wid / 2 + 15;
        if (prevNose !== null && onStrip) turned += wrap(st.nose - prevNose);
        prevNose = onStrip ? st.nose : null;
        if (!M.uturn && Math.abs(turned) >= Math.PI / 2) await take('uturn', 200);
      }
      if (st.ph === 'ROLL' && !sawRoll) { sawRoll = true; await take('roll', 220); }
      if ((st.ph === 'LIFTOFF' || (sawRoll && st.onG === 0 && st.agl > 1)) && !sawLift) { sawLift = true; await take('liftoff', 300); }
      if (sawLift && st.agl > 15) air = true;
      if (air && st.ph === 'FINAL') {
        const d = dThr(b, st);
        if (!M.final1k && d <= 1000) await take('final1k', 700);
        if (!M.final300 && d <= 300) await take('final300', 350);
      }
      if (air && !sawTd && (st.ph === 'ROLLOUT' || (st.onG > 0 && st.agl < 1.5 && (st.ph === 'FLARE' || st.ph === 'FINAL')))) { sawTd = true; await take('touchdown', 250); }
      // the ends
      if (st.over) { end = 'the flight ended (the card): ' + JSON.stringify(await ev("JSON.stringify(FLIGHT_PROBE.ap().report ? { outcome: FLIGHT_PROBE.ap().report.outcome, verdicts: FLIGHT_PROBE.ap().report.verdicts } : null)")); L.faults.push({ k: 'over', note: end }); await take('over', 300); break; }
      if (st.ph === 'STOPPED' && st.rt && st.rt.to === b.id && legT > 20) {
        if (stopT === null) stopT = now;
        if (now - stopT > 600) { await take('stop', 250); break; }
      } else stopT = null;
      if (st.ph === 'STOPPED' && st.rt && st.rt.to !== b.id && legT > 60 && st.onG > 0) { end = 'stopped bound for ' + st.rt.to + ', not ' + b.id; L.faults.push({ k: 'diverted', note: end }); await take('stop', 250); break; }
      if (st.ph === 'ABORT') { end = 'the take-off was rejected (ABORT)'; L.faults.push({ k: 'abort', note: end }); await take('abort', 250); break; }
      if (legT > 1800) { end = 'the leg took over 1800 s'; L.faults.push({ k: 'timeout', note: end }); break; }
      if (SHAKEDOWN && now - flightStartWall > SHAKEDOWN * 1000) { end = 'shakedown: ' + SHAKEDOWN + ' s'; break; }
      if (now > deadlineMs) { end = 'the deadline ' + DEADLINE; L.faults.push({ k: 'deadline', note: end }); break; }
      if (now - lastStill > 20000) { lastStill = now; await pull(); log('    t ' + st.t.toFixed(0) + ' (leg ' + legT.toFixed(0) + ' s) ' + st.ph + ' agl ' + st.agl.toFixed(0) + ' Vg ' + st.Vg.toFixed(1) + ' to ' + (st.rt && st.rt.to) + ' rate ' + st.rate + ' dil ' + (st.dil != null ? st.dil.toFixed(2) : '-') + ' rows ' + st.rows); }
    }
    L.tStop = st.t; L.wallStop = Date.now(); L.effRate = effN ? { mean: +(effSum / effN).toFixed(2), min: +effMin.toFixed(2), simOverWall: +((L.tStop - L.tStart) / ((L.wallStop - L.wallStart) / 1000)).toFixed(2) } : null;
    L.stop = { x: st.x, z: st.z, ph: st.ph };
    try { L.report = JSON.parse(await ev("JSON.stringify((() => { const ap = FLIGHT_PROBE.ap(); return { phase: ap.phase, route: ap.route, report: ap.report || null, tdInfo: ap.tdInfo || null, t: ap.t }; })())")); } catch (e) { L.report = { err: e.message }; }
    try { L.obstacles = JSON.parse(await ev("JSON.stringify((() => { const O = FLIGHT_PROBE.world().obstacles; return O && O.list ? O.list().map(o => [Math.round(o.x * 10) / 10, Math.round(o.z * 10) / 10, o.tag || null, o.shape && o.shape.r != null ? Math.round(o.shape.r * 10) / 10 : null]) : null; })())")); } catch (e) { L.obstacles = null; }
    const v = L.report && L.report.report ? L.report.report.verdicts || [] : [];
    log('  LEG ' + li + ' ' + (L.faults.length ? 'FAULTS ' + L.faults.map(f => f.k).join(',') : 'stopped at ' + b.id) + ' · ' + (L.tStop - L.tStart).toFixed(0) + ' s sim, ' + ((L.wallStop - L.wallStart) / 1000).toFixed(0) + ' s wall (' + JSON.stringify(L.effRate) + ') · verdicts ' + JSON.stringify(v.map(q => q.code + (q.note ? ': ' + q.note : ''))).slice(0, 600));
    legs.push(L);
    await pull();
  }
  // ---- the end: the flight log, the samples, the casts' index ---------------------------------------------------
  log('TOUR ' + (end ? 'ENDED: ' + end : (legs.length === ORDER.length - 1 ? 'DONE' : 'stopped after ' + legs.length + ' legs')) + ' · ' + ((Date.now() - flightStartWall) / 60000).toFixed(1) + ' min of flight');
  try { await cmd('Page.stopScreencast'); } catch (e) {}
  await pull().catch(e => log('  pull: ' + e.message));
  const before = new Set(fs.readdirSync(OUT));
  try { log('  flight log: ' + await ev('window.FLIGHT_REC && FLIGHT_REC.save ? FLIGHT_REC.save().then(r => JSON.stringify(r)) : "none"', 120000)); } catch (e) { log('  flight log: ' + e.message); }
  for (let i = 0; i < 60; i++) { const nw = fs.readdirSync(OUT).filter(f => !before.has(f) && /flightlog.*\.json$/.test(f)); if (nw.length) { log('  flight log saved: ' + nw.join(', ')); break; } await sleep(1000); }
  const fin = JSON.parse(await ev("JSON.stringify({ damage: (() => { try { return FLIGHT_PROBE.damage(); } catch (e) { return null; } })(), fuel: FLIGHT_PROBE.sim().fuel || null, rec: window.__TR ? { frames: __TR.frames, err: __TR.err } : null, simw: window.FLYDIY_SIMW && FLYDIY_SIMW.state ? FLYDIY_SIMW.state() : null })").catch(e => JSON.stringify({ err: e.message })));
  fs.writeFileSync(path.join(OUT, 'samples.json'), JSON.stringify({ kind: 'page', cols: ['t', 'x', 'y', 'z', 'agl', 'phase', 'Vg', 'nose', 'onG', 'leg', 'wallMs', 'dil', 'hudAgl', 'fuelL'], rows, ev: phaseEv }));
  fs.writeFileSync(path.join(OUT, 'legs.json'), JSON.stringify({ kind: 'page', root: ROOT, build: BUILD, order: ORDER, damage: DAMAGE, rate: RATE, url: URL, env, start, aerodromes: AERO, end, legs, stills, rateLog, exceptions: exc, fin,
    cast: { nth: CAST_NTH, frames: cast, blanks }, wall: { start: t00, flight: flightStartWall, end: Date.now() } }, null, 1));
  log('  wrote samples.json (' + rows.length + ' rows), legs.json (' + legs.length + ' legs, ' + stills.length + ' stills), cast ' + cast.length + ' frames');
  try { await cmd('Browser.close'); } catch (e) {}
  await sleep(1500);
  killAll();
  LOG.end();
  process.exit(end && !/shakedown/.test(end) ? 1 : 0);
})().catch(e => { log('*** ' + (e && e.stack || e)); killAll(); process.exit(3); });
