#!/usr/bin/env node
// master_bench.js - THE MASTER BENCHMARK (G1175, LOAD-COMPILE for A0; the user, 2026-10-01: "garage, roll out and taxi,
// water taxi, taxi at every location, fly on top of every location. Report both FPS and evenness. Report all load
// times, including switching world/garage ... a couple of stress cases, with high settings, but we still expect the
// computer to hold. We'll also celebrate by comparing with our previous figures, when we started this whole run.")
//
// PREP ONLY: run at the end of an optimisation run, on the BUILT page, under ONE GPU lock (~45-60 min). Not a gate.
// It drives the game the player's way (the bar's Roll out, the shed's route pick, the way back) in a HEADED Chrome with
// vsync on, at the player's viewport, like rollout_perf.js (whose rules it keeps: one press of #bGo - G1117 -, a
// private warm profile, its own server checked to be this tree's), and writes ONE report: a JSON and a readable table.
//
// THE SWEEP (`--plan` prints it with its expected minutes, no browser):
//   LOADS  - cold first load (a fresh profile, the Cub): navigation -> garage, then the first roll-out -> flight;
//            warm first load per build (navigation -> garage, first roll-out -> flight); garage -> world for every
//            location (a roll-out after the shed's route pick: the world's steps for the new stand under its screen);
//            world -> garage (every way back); a second round trip at HOME (back, roll out with no change).
//   SCENES - per build: the garage (the shed's own view, 6 s), the roll-out shot (click -> flight), and at EVERY land
//            location the world lists (FLIGHT_PROBE.world().aerodromes, kind 'strip' - not a hand list): taxi from the
//            stand in the chase view, the same taxi in the cockpit view, and a LOW PASS (~60 m AGL along the strip,
//            the pilot re-engaged in the air). The water: BOTH floatplanes the user validated - the Cessna floats and the
//            twin-582 on floats (G1178) - each on its lane (the game puts a float build on the SEA lane whatever the pick)
//            and a low pass over every water base.
//   STRESS - the Cub at HOME, each from its own (warm) load: preset ultra; gamer with shadows ultra; the town on
//            (?town=1). Taxi chase + low pass each.
//   PER SCENE: fps DELIVERED (frames / wall), the UNEVEN share (consecutive intervals changing their refresh count - the
//            judder a 60 Hz screen shows), dt p50 / p99 / worst, frames over 100 ms, the share at the 30 cap, long
//            tasks >= 200 ms / >= 1 s and the worst.
//   COMPARE - each metric against the figures at the start of the run where one exists: the A0 baseline
//            (futureDesigns/PLAYTEST-2026-09-26.md section 0.2, master 3da1c82a) and train 11's first ratchet baseline
//            (tools/perf/ratchet_baseline.json at c73886d3) - BASELINES below says what was taken from where.
//
// Usage: node tools/master_bench.js --plan                                   (the scenario table + minutes, no browser)
//        node tools/master_bench.js --port 8640 [--udd <short dir>] [--fallback D:/Dev/DeGaRoR.github.io]
//               [--builds cub,jodel,metal] [--only loads,garage,taxi,pass,water,stress] [--no-cold]
//               [--taxi 15] [--cockpit 10] [--pass 15] [--garage 6] [--water 25] [--label <name>] [--out <file.json>]
//        node tools/master_bench.js --report <file.json>                    (re-print a saved report's table)
// THE PROFILE (G1177): fresh per run set by default (%TEMP%/mb<MMDDhhmm>, warmed once by a discarded load + roll-out) - a
// profile kept for days filled its GPU disk cache and missed the ground's splats on EVERY run (train 21's ratchet: a 13 s
// worldCompile read as a regression). Every load row carries its links (the worst, how many over 5 s) and the profile's
// GPU cache size; a warm load with a link over 5 s says 'MISS suspected'. --udd <dir> reuses a profile (it must be a
// SHORT path: past MAX_PATH Chrome's caches do not persist - A5-LOAD). Always --port (a peer's stale server on a default
// port measured the other tree once). No --help: an unknown flag is ignored.
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const ROOT = path.join(__dirname, '..'), REPO = path.resolve(ROOT, '..');
const SECS = { garage: +opt('garage', 6), taxi: +opt('taxi', 15), cockpit: +opt('cockpit', 10), pass: +opt('pass', 15), water: +opt('water', 25) };
const BUILDS = {   // the three the user validated, and the two floatplanes for the water (W-CHECK's Cessna: cessnaFloats was rejected)
  cub: { label: 'Cub', build: 'default' },
  jodel: { label: 'Jodel', build: 'builds/jodel_2026-09-20_corrected.json' },
  metal: { label: 'metal Cessna', build: 'bugReports/cessnaMetal (1).json' },
  floats: { label: 'Cessna floats', build: 'bugReports/cessnaFloatsWOrks.json' },
  // THE TWIN ON FLOATS (the user, 2026-10-01: "the Cessna floats and the twin-something on floats" are validated too): the
  // user's twin-582 ultralight - the 'floatplane' stock card (tools/_cage_design.js, "a default game plane, along the cub
  // and the jodel") is built on it - flown as GATE FLOATS / GATE SEAPLANE fly it: the fixture with gear.type 'floats'
  twinFloats: { label: 'twin floatplane', build: 'tools/fixtures/build_v7_ultralight_2026-09-05.json', patch: j => { j.spec.gear.type = 'floats'; j.spec.cage = Object.assign({}, j.spec.cage, { gearFloats: 1 }); return j; } },   // (the editor reads its own row: cage.gearFloats)
};
const WATER = ['floats', 'twinFloats'];
const WANT = (opt('builds', 'cub,jodel,metal')).split(',').filter(b => BUILDS[b]);
const ONLY = new Set((opt('only', 'loads,garage,taxi,pass,water,stress')).split(','));
const STRESS = [
  { id: 'ultra', label: 'preset ultra', gfx: { preset: 'ultra' }, q: '' },
  { id: 'shadowsUltra', label: 'gamer, shadows ultra', gfx: { pv: 6, shadows: 'ultra' }, q: '' },
  { id: 'town', label: 'the town on (?town=1)', gfx: null, q: 'town=1' },
];
const SIZE = (opt('size', '2216x1023')).split('x').map(Number);
const REFRESH = 1000 / 60;

// ---- THE FIGURES AT THE START OF THE RUN -----------------------------------------------------------------------------
// A0 (PLAYTEST-2026-09-26 section 0.2, master 3da1c82a, RTX 3080, 2216x1023, gamer): the roll-out screen and the taxi
// frames of the OLD stock (the Cub's role then) and the aluminium Cessna (the metal Cessna); the garage boot was "9-14 s in
// every run" (taken as 12 s for the first flight). Train 11's ratchet baseline (c73886d3, 2026-09-28): the Cub
// ('default') and the metal Cessna, warm, medians of two runs.
const BASELINES = {
  a0: { src: 'A0 baseline (PLAYTEST-2026-09-26 s0.2, 3da1c82a)',
    firstFlightCold: { cub: 90 }, firstFlightWarm: { cub: 64, metal: 65 }, rolloutScreenWarm: { cub: 52, metal: 53 }, rolloutScreenCold: { cub: 78 },
    taxiFps: { cub: 13.5, metal: 8.6 }, taxiP90: { cub: 175, metal: 217 }, taxiWorst: { cub: 634, metal: 384 }, worstTask: { cub: 17000, metal: 17000 } },
  t11: { src: "train 11's ratchet baseline (c73886d3)",
    rolloutScreenWarm: { cub: 36.5, metal: 36.5 }, taxiFps: { cub: 31.15, metal: 30.75 }, taxiUneven: { cub: 0.11, metal: 0.10 },
    taxiP99: { cub: 33.5, metal: 33.5 }, worstTask: { cub: 1002, metal: 996 } },
};

// ---- the plan: the scenario list and its expected minutes (the --plan dry run, and the run's own order) ---------------
const EST = { coldLoad: 150, warmLoad: 55, firstRollout: 8, rolloutNewStand: 30, rolloutSame: 6, rollin: 4, reloadOverhead: 10, settle: 3 };
function placesFromFixture() {
  try {
    const F = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'island_jolene.json'), 'utf8'));
    return (F.layers.runways || []).filter(r => r.c && r.len > 0 && r.wid > 0).map(r => ({ id: r.id, name: r.name || r.id, kind: +r.surface === 4 ? 'water' : 'strip' }));
  } catch (e) { return []; }
}
function plan(places) {
  const land0 = places.filter(p => p.kind === 'strip'), water = places.filter(p => p.kind === 'water');
  const home = land0.find(p => p.id === 'HOME') || land0[0], land = home ? [home].concat(land0.filter(p => p !== home)) : land0;   // the run's order: HOME first
  const rows = []; let s = 0;
  const add = (part, scene, what, sec) => { rows.push({ part, scene, what, sec }); s += sec; };
  if (ONLY.has('loads') && !flag('no-cold')) add('loads', 'cold first load', 'Cub, a fresh profile: navigation -> garage -> first flight', EST.coldLoad);
  if (!opt('udd', null)) add('loads', 'warm-up (discarded)', 'the warm profile, fresh: the Cub loaded + rolled out once', EST.warmLoad + EST.firstRollout + 5);
  for (const b of WANT) {
    const B = BUILDS[b];
    add(B.label, 'warm first load', 'navigation -> garage (the one loading)', EST.warmLoad);
    if (ONLY.has('garage')) add(B.label, 'garage', 'the shed, ' + SECS.garage + ' s', SECS.garage + EST.settle);
    land.forEach((p, i) => {
      add(B.label, i ? 'garage -> world @' + p.id : 'roll-out shot @' + p.id, i ? 'route pick + Roll out (the stand\'s world steps)' : 'the first roll-out: the shot, the reveal', i ? EST.rolloutNewStand : EST.firstRollout);
      if (ONLY.has('taxi')) { add(B.label, 'taxi chase @' + p.id, p.name, SECS.taxi); add(B.label, 'taxi cockpit @' + p.id, p.name, SECS.cockpit); }
      if (ONLY.has('pass')) add(B.label, 'low pass @' + p.id, '~60 m AGL along the strip', SECS.pass + EST.settle);
      add(B.label, 'world -> garage', 'the way back', EST.rollin);
      if (!i && ONLY.has('loads')) { add(B.label, 'round trip 2', 'roll out (no change) + back', EST.rolloutSame + EST.rollin); }
    });
  }
  if (ONLY.has('water')) for (const wk of WATER) {
    const B = BUILDS[wk];
    add(B.label, 'warm first load', 'navigation -> garage', EST.warmLoad);
    add(B.label, 'roll-out @SEA', 'the game puts floats on the SEA lane', EST.firstRollout);
    add(B.label, 'water taxi @SEA', 'the run on the lane', SECS.water);
    for (const p of water) add(B.label, 'low pass @' + p.id, p.name, SECS.pass + EST.settle + (p.id === 'SEA' ? 0 : 10));
    add(B.label, 'world -> garage', 'the way back', EST.rollin);
  }
  if (ONLY.has('stress')) for (const S of STRESS) {
    add('stress', S.label, 'Cub @HOME: warm load + roll-out', EST.warmLoad + EST.firstRollout + (S.q ? 20 : 0));
    add('stress', S.label + ' taxi', 'chase', SECS.taxi);
    add('stress', S.label + ' pass', 'low pass', SECS.pass + EST.settle);
  }
  return { rows, sec: s, land: land.map(p => p.id), water: water.map(p => p.id) };
}

// ---- frame and task statistics ----------------------------------------------------------------------------------------
// fr rows: [now, dt, cap, Vg, agl, onG]; lt rows: [start, duration]
// G1180 (LOC-SWITCH): sc - the loading screens' spans [from, to] (the page's own BOOT, sampled): the loop draws nothing
// under a screen (holdRender), so the interval that spans one is the SCREEN, not a frame - a roll-out's 22 s screen
// read as "a 22 s frame". Those intervals leave the frame statistics; the screen's seconds are reported apart (screenS)
function stat(fr, lt, t0, t1, sc) {
  const under = r => (sc || []).some(w => w[0] < r[0] && (w[1] == null ? Infinity : w[1]) > r[0] - r[1]);
  const f = fr.filter(r => r[0] > t0 && r[0] <= t1 && r[1] > 0 && !under(r));
  if (f.length < 5) return null;
  const d = f.map(r => r[1]), s = d.slice().sort((a, b) => a - b), q = p => s[Math.min(s.length - 1, Math.floor(s.length * p))];
  let n = 0, ch = 0, prev = null;
  for (const x of d) { const k = Math.max(1, Math.round(x / REFRESH)); if (prev !== null) { n++; if (k !== prev) ch++; } prev = k; }
  const tasks = lt.filter(x => x[0] + x[1] > t0 && x[0] < t1).map(x => x[1]);
  return { frames: f.length, fps: +(1000 * f.length / (t1 - t0)).toFixed(1), uneven: n ? +(ch / n).toFixed(3) : null,
    p50: +q(0.5).toFixed(1), p99: +q(0.99).toFixed(1), worst: +s[s.length - 1].toFixed(1), over100: d.filter(x => x > 100).length,
    cap30: +(f.filter(r => r[2] === 30).length / f.length).toFixed(2), tasks200: tasks.filter(x => x >= 200).length, tasks1s: tasks.filter(x => x >= 1000).length,
    taskWorst: tasks.length ? Math.max(...tasks) : 0, onGround: +(f.filter(r => r[5] > 0).length / f.length).toFixed(2),
    screenS: +((sc || []).reduce((a, w) => a + Math.max(0, Math.min(t1, w[1] == null ? t1 : w[1]) - Math.max(t0, w[0])), 0) / 1000).toFixed(1) };
}

// ---- what the page is given before its first script --------------------------------------------------------------------
function preScript(build, gfx, patch) {
  const L = [];
  if (build === 'default') L.push('try{localStorage.removeItem("flydiy.wip")}catch(e){}');
  else { let txt = fs.readFileSync(path.join(ROOT, build), 'utf8'); if (patch) txt = JSON.stringify(patch(JSON.parse(txt)));
    L.push('try{localStorage.setItem("flydiy.wip",' + JSON.stringify(txt) + ')}catch(e){}'); }
  L.push('try{localStorage.removeItem("flydiy.gfx")}catch(e){}');
  // the flight's own prefs, the route and the world (rollout_perf G991): a warm profile keeps a peer's
  L.push('try{for(const k of Object.keys(localStorage))if(/^flydiy\\.(fl([A-Z]|$)|route$|world$)/.test(k))localStorage.removeItem(k)}catch(e){}');
  L.push('try{localStorage.setItem("flydiy.route",' + JSON.stringify(JSON.stringify({ from: 'HOME', dest: 'CIRCUIT' })) + ');localStorage.setItem("flydiy.flManual","0");localStorage.removeItem("flydiy.premises.game.jolene")}catch(e){}');
  if (gfx) L.push('try{localStorage.setItem("flydiy.gfx",' + JSON.stringify(JSON.stringify(gfx)) + ')}catch(e){}');
  // THE RECORDER: long tasks from the first byte; every rendered frame once FLYDIY_PACE exists (its end(), the loop's)
  L.push(`(function(){ if (window.__MB) return; var R = window.__MB = { lt: [], fr: [], last: 0 };
    try { new PerformanceObserver(function(l){ l.getEntries().forEach(function(e){ R.lt.push([Math.round(e.startTime), Math.round(e.duration)]); }); }).observe({ type: 'longtask', buffered: true }); } catch (e) {}
    var hook = function(){ var P = window.FLYDIY_PACE; if (!P || !P.end) { setTimeout(hook, 50); return; } if (P.__mb) return; P.__mb = 1; var end = P.end.bind(P);
      P.end = function (workMs, physMs, steps, now) { var gs = null, agl = null, onG = null;
        try { var F = window.FLIGHT_PROBE, s = F && F.sim && F.sim(); if (s && !document.body.classList.contains('mode-ws')) { var v = s.cgVel(), cg = s.cgPos(); gs = Math.hypot(v[0], v[2]); agl = F.agl(); onG = s.wheelsOnGround(); } } catch (e) {}
        var st = P.state ? P.state() : {}; R.fr.push([+now.toFixed(1), R.last ? +(now - R.last).toFixed(2) : 0, st.cap, gs == null ? null : +gs.toFixed(1), agl == null ? null : +agl.toFixed(1), onG]); R.last = now;
        if (R.fr.length > 200000) R.fr.splice(0, 50000);
        return end(workMs, physMs, steps, now); }; };
    hook();
    // G1180: the loading screens' spans (BOOT.state other than 'gone'), every 50 ms: [from, to] (to null: still up)
    R.sc = []; setInterval(function () { var up = !!(window.BOOT && BOOT.state && BOOT.state !== 'gone'), L = R.sc[R.sc.length - 1], t = Math.round(performance.now());
      if (up && !(L && L[1] == null)) R.sc.push([t, null]); else if (!up && L && L[1] == null) L[1] = t; }, 50);
    // G1177: EVERY PROGRAM LINK TIMED (progtime_hook's way: linkProgram issued, KHR_parallel_shader_compile's COMPLETION_STATUS
    // polled - never blocks). A warm load whose links run to seconds is a program cache that did not hit (train 21's
    // ratchet: a full GPU disk cache read as a 13 s worldCompile on every run), and the report says so per load
    R.ln = []; var P2 = WebGL2RenderingContext.prototype, lk = P2.linkProgram, pend = [], gl0 = null;
    P2.linkProgram = function (p) { gl0 = this; var e = [performance.now(), -1, p, this]; R.ln.push(e); pend.push(e);   /* G1180: e[3], its own context - a bake renderer links too */ return lk.apply(this, arguments); };
    var poll = function () { if (gl0 && pend.length) { var t = performance.now(), keep = [];
      for (var i = 0; i < pend.length; i++) { var e = pend[i], ok = true; try { ok = e[3].getProgramParameter(e[2], 0x91B1); } catch (x) {} if (ok) { e[1] = t - e[0]; e[2] = e[3] = null; } else keep.push(e); }
      pend = keep; } setTimeout(poll, 25); };
    poll(); })();`);
  return L.join('\n');
}

// ---- the page-side actions (strings evaluated in the page; --node-smoke runs them in tools/_page_node.js) --------------
const A = {
  places: "JSON.stringify((FLIGHT_PROBE.world().aerodromes || []).map(a => ({ id: a.id, name: a.name || a.id, kind: a.kind === 'water' || a.water ? 'water' : 'strip', x: +(+a.x).toFixed(1), z: +(+a.z).toFixed(1), hdg: +(+a.hdg || 0).toFixed(4), len: a.len, elev: +(+(a.spawnElev != null ? a.spawnElev : a.elev) || 0).toFixed(1) })))",
  // the shed's own Departure pick (#edRoute: the route select the garage shows), as a player's change makes it
  setFrom: id => "(() => { const s = [...document.querySelectorAll('#edRoute select, #bootRoute select')].find(x => x.title === 'Departure'); if (!s) return 'no select';"
    + " if (![...s.options].some(o => o.value === " + JSON.stringify(id) + ")) return 'no option'; s.value = " + JSON.stringify(id) + "; s.onchange({ target: s }); return window.FLYDIY_ROUTE ? FLYDIY_ROUTE.get().from : 'set'; })()",
  // G1117: ONE press - the bar's #bGo, else the first visible 'Roll out'
  rollOut: "(() => { const g = document.getElementById('bGo'); const l = [...document.querySelectorAll('button')].filter(b => /roll out/i.test(b.textContent) && b.offsetParent);"
    + " const b = g && g.offsetParent && /roll out/i.test(g.textContent) ? g : l[0]; if (!b) return 'no button'; b.click(); return b.id || 'button'; })()",
  rollIn: "(() => { const b = document.getElementById('bHangar2'); if (!b) return 'no button'; b.click(); return 'ok'; })()",
  trips: "(window.FLYDIY_TRIPS || []).length",
  lastTrip: "JSON.stringify((() => { const L = window.FLYDIY_TRIPS || []; const t = L[L.length - 1]; return { n: L.length, kind: t && t.kind, done: !!(t && t.done), ms: t && t.ms, anim: t && t.anim, ran: t ? t.steps.filter(s => s.ran).map(s => s.id) : [], boot: window.BOOT ? BOOT.state : '', shed: document.body.classList.contains('mode-ws') }; })())",
  cam: m => "(() => { FLIGHT_PROBE.camMode(" + JSON.stringify(m) + "); return FLIGHT_PROBE.camModeNow(); })()",
  // the flight running (the rig's way since rollout_perf: the bar's Go, the pause's Run, when the reveal left it held)
  run: "(() => { const b = document.getElementById('bGo'); if (b && b.offsetParent && !/roll out/i.test(b.textContent)) b.click(); const p = document.getElementById('bPause'); if (p && /run/i.test(p.textContent)) p.click(); return FLIGHT_PROBE.sim().t; })()",
  simT: 'FLIGHT_PROBE.sim().t',
  // THE LOW PASS: the CG 60 m over the strip's ground, 350 m short of its centre along the aeroplane's own heading (the
  // taxi's direction, else the strip's), at 42 m/s (over the three builds' stall); the pilot re-engaged in the air
  // (manual on then off: ap.reEngage reads a CLIMB from a ground phase above 10 m) - the world as a low pass meets it
  pass: (p, V) => "(async () => { const s = FLIGHT_PROBE.sim(), v = s.cgVel(); let hx = Math.cos(" + p.hdg + "), hz = Math.sin(" + p.hdg + ");"
    + " const g = Math.hypot(v[0], v[2]); if (g > 1.5) { hx = v[0] / g; hz = v[2] / g; }"
    + " const W = FLIGHT_PROBE.world(), x = " + p.x + " - hx * 350, z = " + p.z + " - hz * 350; const h = (W.terrainH ? W.terrainH(x, z) : " + p.elev + ");"
    + " await FLIGHT_PROBE.place({ at: [x, Math.max(h, " + p.elev + ") + 60, z], zeroV: true, dv: [hx * " + V + ", 0, hz * " + V + "] });"
    + " FLIGHT_PROBE.setManual(true); FLIGHT_PROBE.setManual(false); return FLIGHT_PROBE.ap().phase; })()",
};

// ---- the browser rig -----------------------------------------------------------------------------------------------------
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
function serve(port, fallback) {
  const a = [path.join(__dirname, '_serve.js'), String(port), REPO]; if (fallback) a.push('--fallback', fallback);
  const s = spawn(process.execPath, a, { stdio: 'ignore' });
  return s;
}
const serveRoot = port => new Promise(res => { const rq = http.get('http://127.0.0.1:' + port + '/flyDiy/version.json', r => { r.resume(); res(r.headers['x-serve-root'] ? decodeURIComponent(r.headers['x-serve-root']) : '(unnamed)'); }); rq.on('error', () => res(null)); rq.setTimeout(1500, () => { rq.destroy(); res(null); }); });
async function browser(udd) {
  const dport = 9300 + (process.pid % 500) + Math.floor(Math.random() * 100);
  const ch = spawn(CHROME, ['--remote-debugging-port=' + dport, '--window-size=' + (SIZE[0] + 16) + ',' + (SIZE[1] + 140), '--window-position=0,0', '--no-first-run',
    '--no-default-browser-check', '--user-data-dir=' + udd, '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    ...(process.env.MB_CHROME_FLAGS ? process.env.MB_CHROME_FLAGS.split(' ') : []), 'about:blank'], { stdio: 'ignore' });   // G1220: MB_CHROME_FLAGS, extra switches for a trial
  let tgt = null;
  for (let i = 0; i < 50 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + dport + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  if (!tgt) throw new Error('no page target');
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map(), exc = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') exc.push((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text || '').split('\n').slice(0, process.env.MB_STACK ? 6 : 1).join(' | ')); };   // (G1180: MB_STACK=1 keeps the stack's head)
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async (expr, ms) => {
    const p = cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    const r = await (ms ? Promise.race([p, sleep(ms).then(() => ({ result: { result: { value: '__timeout' } } }))]) : p);
    const d = r.result; if (!d || d.exceptionDetails) throw new Error('page: ' + (d && d.exceptionDetails ? (d.exceptionDetails.exception && d.exceptionDetails.exception.description || d.exceptionDetails.text) : JSON.stringify(r)));
    return d.result.value;
  };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: SIZE[0], height: SIZE[1], deviceScaleFactor: 1, mobile: false });
  await cmd('Page.bringToFront');
  let preId = null;
  const load = async (url, pre) => {   // a navigation with this page's own pre-script (the last one removed)
    if (preId) await cmd('Page.removeScriptToEvaluateOnNewDocument', { identifier: preId });
    preId = (await cmd('Page.addScriptToEvaluateOnNewDocument', { source: pre })).result.identifier;
    const t0 = Date.now(); await cmd('Page.navigate', { url }); await sleep(1500);
    const r = await ev("(() => Promise.race([(window.BOOT && BOOT.whenReady) ? BOOT.whenReady().then(() => 'ready') : new Promise(r => setTimeout(() => r('no BOOT'), 30000)), new Promise(r => setTimeout(() => r('boot timeout'), 300000))]))()", 310000);
    return { state: r, sec: +((Date.now() - t0) / 1000).toFixed(1) };
  };
  // the links of a window (page clock), summarised: count, still linking, the sum, the worst, how many over 5 s
  const links = async (t0, t1) => { const ln = JSON.parse(await ev('JSON.stringify((window.__MB.ln || []).filter(e => e[0] >= ' + (t0 || 0) + ' && e[0] <= ' + (t1 || 1e12) + ').map(e => [Math.round(e[0]), Math.round(e[1])]))'));
    const ms = ln.map(e => e[1]).filter(x => x >= 0);
    return { n: ln.length, pending: ln.filter(e => e[1] < 0).length, sumS: +(ms.reduce((a, x) => a + x, 0) / 1000).toFixed(1), worstS: ms.length ? +(Math.max(...ms) / 1000).toFixed(1) : 0, over5s: ms.filter(x => x > 5000).length }; };
  const close = async () => { try { await cmd('Browser.close'); } catch (e) {} await sleep(1500); try { if (process.platform === 'win32') execSync('taskkill /PID ' + ch.pid + ' /T /F', { stdio: 'ignore' }); else ch.kill(); } catch (e) {} };
  return { ev, load, close, exc, cmd, links, udd };
}

// the GPU disk caches of a profile (Chrome's program cache: Default/GPUCache; Skia's GrShaderCache), MB
function cacheMB(udd) {
  const du = d => { let t = 0; try { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const q = path.join(d, f.name); t += f.isDirectory() ? du(q) : fs.statSync(q).size; } } catch (e) {} return t; };
  return { gpuCache: +(du(path.join(udd, 'Default', 'GPUCache')) / 1048576).toFixed(1), grShader: +(du(path.join(udd, 'GrShaderCache')) / 1048576).toFixed(1) };
}
// ---- the sweep ---------------------------------------------------------------------------------------------------------
async function sweep() {
  // G1177: A FRESH PROFILE PER RUN SET by default (a short path under %TEMP%: mb<MMDDhhmm>) - a profile used for days can
  // hold a full GPU disk cache that misses on every run (train 21's ratchet); --udd <dir> keeps one on purpose
  const PORT = +opt('port', 0), FALLBACK = opt('fallback', null);
  const stamp = (d => [d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()].map(x => String(x).padStart(2, '0')).join(''))(new Date());
  const UDD = path.resolve(opt('udd', path.join(os.tmpdir(), 'mb' + stamp)));
  if (!PORT) { console.error('master_bench: --port is required for a run (--plan for the table)'); process.exit(2); }
  if (await serveRoot(PORT)) { console.error('master_bench: port ' + PORT + ' is taken - pick a free one'); process.exit(4); }
  const srv = serve(PORT, FALLBACK); await sleep(800);
  const root = await serveRoot(PORT);
  if (!root || path.resolve(root) !== path.resolve(REPO)) { console.error('master_bench: the server on ' + PORT + ' serves ' + root + ', not this tree'); try { srv.kill(); } catch (e) {} process.exit(4); }
  const BASE = 'http://localhost:' + PORT + '/flyDiy/index.html';
  const R = { meta: { date: new Date().toISOString(), commit: (() => { try { return execSync('git rev-parse --short HEAD', { cwd: REPO }).toString().trim(); } catch (e) { return '?'; } })(),
    build: (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8')).build; } catch (e) { return '?'; } })(), size: SIZE, secs: SECS, builds: WANT },
    loads: [], scenes: [], notes: [], exceptions: [], profile: { udd: null, fresh: null, cache: [] } };
  const log = s => console.log('  ' + s);
  const done = () => { try { srv.kill(); if (process.platform === 'win32') execSync('taskkill /PID ' + srv.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} };
  process.on('exit', done);
  // a page-session helper: scenes and trips on the open page
  const session = (b, label) => {
    const now = () => b.ev('performance.now()');
    const pull = async () => JSON.parse(await b.ev('JSON.stringify({ fr: __MB.fr.slice(-30000), lt: __MB.lt, sc: __MB.sc || [] })', 20000));
    const scene = async (build, name, sec, extra) => { const t0 = await now(); await sleep(sec * 1000); const t1 = await now(); const d = await pull(); const st = stat(d.fr, d.lt, t0, t1, d.sc);
      const row = Object.assign({ build, scene: name, sec }, st || { frames: 0 }, extra || {}); R.scenes.push(row);
      log(name.padEnd(28) + ' ' + (st ? st.fps + ' fps, uneven ' + (100 * st.uneven).toFixed(0) + ' %, p99 ' + st.p99 + ', worst ' + st.worst + ' ms, tasks>=200 ' + st.tasks200 : 'no frames')); return row; };
    const trip = async (build, name, kind, action, extra) => {
      const n0 = await b.ev(A.trips), t0 = await now(), w0 = Date.now(); const pressed = await b.ev(action);
      let d = null; const tEnd = Date.now() + 300000;
      while (Date.now() < tEnd) { d = JSON.parse(await b.ev(A.lastTrip, 30000)); if (d.n > n0 && d.kind === kind && d.done && d.boot === 'gone') break; d = null; await sleep(150); }
      const t1 = await now(); const fr = await pull(); const st = stat(fr.fr, fr.lt, t0, t1, fr.sc);
      const row = Object.assign({ build, load: name, kind, pressed, tripMs: d ? d.ms : null, wallSec: +((Date.now() - w0) / 1000).toFixed(1), ran: d ? d.ran : null, anim: d ? d.anim : null,
        frames: st, links: await b.links(t0, t1) }, extra || {}); R.loads.push(row);
      log(name.padEnd(28) + ' ' + (d ? (d.ms / 1000).toFixed(1) + ' s (wall ' + row.wallSec + ' s) ran [' + d.ran.join(' ') + ']' : 'NOT DONE (' + pressed + ')')); return row; };
    const flying = async () => { await sleep(1500); const t1 = await b.ev(A.simT); await sleep(1200); const t2 = await b.ev(A.simT); if (!(t2 > t1)) await b.ev(A.run); };
    return { now, scene, trip, flying };
  };
  // a page load's row: the seconds, the links it ran (a warm load linking seconds-long programs = the cache missed), the cache
  const loadRow = async (b, build, name, l, warm) => {
    const lk = await b.links(0, 1e12), cache = cacheMB(b.udd);
    const row = { build, load: name, sec: l.sec, state: l.state, links: lk, cache, cacheVerdict: warm ? (lk.over5s ? 'MISS suspected (' + lk.over5s + ' links > 5 s)' : 'hit') : 'cold' };
    R.loads.push(row); R.profile.cache.push({ at: build + ' ' + name, cache });
    log(name + ' ' + l.sec + ' s · links ' + lk.n + ' (worst ' + lk.worstS + ' s, ' + lk.over5s + ' over 5 s) · GPU cache ' + cache.gpuCache + ' MB · ' + row.cacheVerdict);
    return row; };
  const rollOutAt = async (S, bk, p, first) => {
    if (!first) { const r = await S.b.ev(A.setFrom(p.id)); if (r !== p.id) { R.notes.push(bk + ': route pick ' + p.id + ' -> ' + r); log('route pick ' + p.id + ': ' + r); return false; } }
    await S.trip(bk, first ? 'garage -> world (first) @' + p.id : 'garage -> world @' + p.id, 'rollout', A.rollOut, { place: p.id });
    await S.flying(); return true;
  };
  const taxiAndPass = async (S, bk, p, doCockpit) => {
    if (ONLY.has('taxi')) {
      await S.b.ev(A.cam('chase')); await S.scene(bk, 'taxi chase @' + p.id, SECS.taxi, { place: p.id });
      if (doCockpit) { await S.b.ev(A.cam('cockpit')); await S.scene(bk, 'taxi cockpit @' + p.id, SECS.cockpit, { place: p.id }); await S.b.ev(A.cam('chase')); }
    }
    if (ONLY.has('pass')) { const ph = await S.b.ev(A.pass(p, 42), 20000).catch(e => 'error ' + e.message); await sleep(EST.settle * 1000);
      await S.scene(bk, 'low pass @' + p.id, SECS.pass, { place: p.id, pilot: ph }); }
  };

  // ---- LOADS: cold (a fresh profile, the Cub) ----
  if (ONLY.has('loads') && !flag('no-cold')) {
    log('== cold first load (a fresh profile)');
    const udd = path.join(os.tmpdir(), 'mb_cold_' + Date.now());
    const b = await browser(udd); const S = Object.assign(session(b), { b });
    const l = await b.load(BASE, preScript('default', null));
    await loadRow(b, 'cub', 'cold: navigation -> garage', l, false);
    const tr = await S.trip('cub', 'cold: garage -> world (first)', 'rollout', A.rollOut);
    R.loads.push({ build: 'cub', load: 'cold: first flight', sec: +(l.sec + (tr.wallSec || 0)).toFixed(1) });
    R.exceptions.push(...b.exc.slice(0, 10)); await b.close();
  }
  // ---- per build, warm ----
  R.profile.udd = UDD; R.profile.fresh = !fs.existsSync(UDD);
  // G1220: A FRESH CHROME PER WARM LOAD (the same profile). In ONE Chrome session the ground's seven heaviest programs
  // (40-55 s each to link cold) hit and miss the program cache on alternate navigations - whatever the build: a warm
  // load in a long session paid +20-50 s on every second load, and the Jodel / the floats (the even slots) read as
  // 'MISS suspected' (CESSNA-LINKS). A player's load is a Chrome start on a warm disk cache: so is every warm load here
  // (--one-chrome: the old single session)
  let b = await browser(UDD), S = Object.assign(session(b), { b });
  const fresh = async () => { if (flag('one-chrome')) return; R.exceptions.push(...b.exc.slice(0, 10)); await b.close(); b = await browser(UDD); S = Object.assign(session(b), { b }); };
  let places = null;
  // THE WARM-UP (discarded): the Cub loaded and rolled out once, so the first build's 'warm' load meets a warm cache
  if (R.profile.fresh || flag('warmup')) { log('== warm-up (discarded) in ' + UDD);
    await b.load(BASE, preScript('default', null)); await S.trip('cub', 'warm-up roll-out', 'rollout', A.rollOut); await sleep(3000);
    R.loads.pop(); R.profile.cache.push({ at: 'after the warm-up', cache: cacheMB(UDD) }); }
  for (const bk of WANT) {
    const B = BUILDS[bk]; log('== ' + B.label + ' (warm)');
    await fresh();
    const l = await b.load(BASE, preScript(B.build, null));
    await loadRow(b, bk, 'warm: navigation -> garage', l, true);
    await b.ev('(async () => { await new Promise(r => setTimeout(r, 1500)); return 1; })()');
    if (!places) { places = JSON.parse(await b.ev('(async () => { for (let i = 0; i < 100 && !(window.FLIGHT_PROBE && FLIGHT_PROBE.world && FLIGHT_PROBE.world()); i++) await new Promise(r => setTimeout(r, 100)); return ' + A.places + '; })()'));
      R.meta.places = places; log('places: ' + places.map(p => p.id + (p.kind === 'water' ? '(water)' : '')).join(' ')); }
    if (ONLY.has('garage')) await S.scene(bk, 'garage', SECS.garage);
    const land = places.filter(p => p.kind === 'strip');
    const home = land.find(p => p.id === 'HOME') || land[0];
    const order = [home].concat(land.filter(p => p !== home));
    for (let i = 0; i < order.length; i++) {
      const p = order[i];
      if (!(await rollOutAt(S, bk, p, i === 0))) continue;
      if (i === 0) { const fl = R.loads.filter(x => x.build === bk); const g = fl.find(x => x.load === 'warm: navigation -> garage'), r = fl[fl.length - 1];
        R.loads.push({ build: bk, load: 'warm: first flight', sec: +(g.sec + (r.wallSec || 0)).toFixed(1) }); }
      await taxiAndPass(S, bk, p, true);
      await S.trip(bk, 'world -> garage @' + p.id, 'rollin', A.rollIn, { place: p.id });
      if (i === 0 && ONLY.has('loads')) {   // the second round trip: out again with no change, and back
        await S.trip(bk, 'round trip 2: garage -> world', 'rollout', A.rollOut, { place: p.id }); await S.flying();
        await S.trip(bk, 'round trip 2: world -> garage', 'rollin', A.rollIn, { place: p.id });
      }
    }
    // home again for the next build's load (the route is a pref: the preScript states HOME on every load)
  }
  // ---- the water ----
  if (ONLY.has('water')) for (const wk of WATER) {
    const B = BUILDS[wk]; log('== ' + B.label + ' (warm)');
    await fresh();
    const l = await b.load(BASE, preScript(B.build, null, B.patch));
    await loadRow(b, wk, 'warm: navigation -> garage', l, true);
    // G1180: the places from this page when no land build listed them (--builds none: the water alone had no low pass)
    if (!places) { places = JSON.parse(await b.ev('(async () => { for (let i = 0; i < 100 && !(window.FLIGHT_PROBE && FLIGHT_PROBE.world && FLIGHT_PROBE.world()); i++) await new Promise(r => setTimeout(r, 100)); return ' + A.places + '; })()')); R.meta.places = places; }
    await S.trip(wk, 'garage -> world (the SEA lane)', 'rollout', A.rollOut); await S.flying();
    await b.ev(A.cam('chase')); await S.scene(wk, 'water taxi @SEA', SECS.water);
    for (const p of (places || []).filter(q => q.kind === 'water')) {
      const ph = await b.ev(A.pass(p, wk === 'twinFloats' ? 32 : 45), 20000).catch(e => 'error ' + e.message); await sleep((EST.settle + (p.id === 'SEA' ? 0 : 10)) * 1000);
      await S.scene(wk, 'low pass @' + p.id, SECS.pass, { place: p.id, pilot: ph, teleport: p.id !== 'SEA' });
    }
    await S.trip(wk, 'world -> garage', 'rollin', A.rollIn);
  }
  // ---- stress ----
  if (ONLY.has('stress')) for (const X of STRESS) {
    log('== stress: ' + X.label);
    await fresh();
    const l = await b.load(BASE + (X.q ? '?' + X.q : ''), preScript('default', X.gfx));
    await loadRow(b, 'cub', 'stress ' + X.id + ': navigation -> garage', l, false);   // (new programs: the preset's own keys)
    const home = (places || []).find(p => p.id === 'HOME') || (places || [])[0];
    await S.trip('cub', 'stress ' + X.id + ': garage -> world', 'rollout', A.rollOut); await S.flying();
    await b.ev(A.cam('chase')); await S.scene('stress:' + X.id, 'taxi chase @HOME', SECS.taxi);
    if (home && ONLY.has('pass')) { const ph = await b.ev(A.pass(home, 42), 20000).catch(e => 'error ' + e.message); await sleep(EST.settle * 1000); await S.scene('stress:' + X.id, 'low pass @HOME', SECS.pass, { pilot: ph }); }
  }
  R.exceptions.push(...b.exc.slice(0, 20));
  await b.close(); done();
  return R;
}

// ---- the report: the table, the comparison -------------------------------------------------------------------------------
function compare(R) {
  const C = [];
  const get = (b, l) => { const x = R.loads.find(r => r.build === b && r.load === l); return x ? x.sec : null; };
  const sc = (b, s) => R.scenes.find(r => r.build === b && r.scene === s);
  const push = (metric, build, now, base, unit, lowerBetter) => { if (now == null) return;
    for (const k of ['a0', 't11']) { const B = BASELINES[k][base]; const was = B && B[build]; if (was == null) continue;
      C.push({ metric, build, was, now, unit, vs: k, src: BASELINES[k].src, better: lowerBetter ? now < was : now > was, x: lowerBetter ? +(was / Math.max(now, 1e-9)).toFixed(2) : +(now / Math.max(was, 1e-9)).toFixed(2) }); } };
  push('first flight, cold (s)', 'cub', get('cub', 'cold: first flight'), 'firstFlightCold', 's', true);
  for (const b of ['cub', 'metal']) {
    push('first flight, warm (s)', b, get(b, 'warm: first flight'), 'firstFlightWarm', 's', true);
    const t = sc(b, 'taxi chase @HOME');
    if (t) { push('taxi fps @HOME', b, t.fps, 'taxiFps', 'fps', false); push('taxi p99 (ms)', b, t.p99, 'taxiP99', 'ms', true); push('taxi uneven', b, t.uneven, 'taxiUneven', '', true); push('taxi worst frame (ms)', b, t.worst, 'taxiWorst', 'ms', true); }
    const worst = Math.max(0, ...R.scenes.filter(r => r.build === b).map(r => r.taskWorst || 0), ...R.loads.filter(r => r.build === b && r.frames).map(r => r.frames.taskWorst || 0));
    push('worst main-thread task (ms)', b, worst || null, 'worstTask', 'ms', true);
  }
  return C;
}
function table(R) {
  const L = [];
  const f = x => x == null ? '-' : String(x);
  L.push('MASTER BENCHMARK  ' + R.meta.date + '  commit ' + R.meta.commit + ' (build ' + R.meta.build + ')  ' + (R.meta.size || []).join('x'));
  L.push('', 'LOADS (s)');
  if (R.profile) L.push('  profile ' + R.profile.udd + (R.profile.fresh ? ' (fresh, warmed once)' : ' (reused)') + ' · GPU cache ' + (R.profile.cache || []).map(c => c.at + ' ' + c.cache.gpuCache + ' MB').join(', '));
  for (const l of R.loads) L.push('  ' + (l.build + ' ').padEnd(8) + (l.load || '').padEnd(42) + ' ' + f(l.sec != null ? l.sec : l.tripMs != null ? (l.tripMs / 1000).toFixed(1) : null).padStart(7)
    + (l.wallSec != null ? '  (wall ' + l.wallSec + ')' : '') + (l.frames ? (l.frames.screenS ? '  screen ' + l.frames.screenS + ' s' : '') + '  frames ' + l.frames.fps + ' fps, worst ' + l.frames.worst + ' ms, task ' + l.frames.taskWorst + ' ms' : '')
    + (l.links ? '  links ' + l.links.n + ' (worst ' + l.links.worstS + ' s' + (l.links.over5s ? ', ' + l.links.over5s + ' > 5 s' : '') + ')' : '') + (l.cacheVerdict ? '  cache: ' + l.cacheVerdict : ''));
  L.push('', 'SCENES  build | scene | fps delivered | uneven | p50 / p99 / worst ms | >100 ms | at 30 cap | tasks >=200 ms / >=1 s (worst)');
  for (const s of R.scenes) L.push('  ' + (s.build + ' ').padEnd(18) + (s.scene + ' ').padEnd(26) + f(s.fps).padStart(6) + '  ' + (s.uneven == null ? '-' : (100 * s.uneven).toFixed(0) + ' %').padStart(5)
    + '  ' + [s.p50, s.p99, s.worst].map(f).join(' / ').padEnd(18) + f(s.over100).padStart(4) + (s.cap30 == null ? '' : ('  ' + Math.round(100 * s.cap30) + ' %').padStart(7)) + '   ' + f(s.tasks200) + ' / ' + f(s.tasks1s) + ' (' + f(s.taskWorst) + ')');
  const C = R.compare || compare(R);
  if (C.length) { L.push('', 'COMPARED WITH THE START OF THE RUN'); for (const c of C) L.push('  ' + c.metric.padEnd(30) + (c.build + ' ').padEnd(7) + String(c.was).padStart(8) + ' -> ' + String(c.now).padEnd(8) + ' ' + (c.better ? 'x' + c.x + ' better' : 'WORSE') + '   (' + c.src + ')'); }
  if (R.notes && R.notes.length) L.push('', 'NOTES', ...R.notes.map(n => '  ' + n));
  return L.join('\n');
}

if (require.main === module) (async () => {
  if (opt('report', null)) { const R = JSON.parse(fs.readFileSync(path.resolve(opt('report')), 'utf8')); console.log(table(R)); return; }
  if (flag('plan')) {
    const P = plan(placesFromFixture());
    console.log('MASTER BENCHMARK - the plan (places from tools/fixtures/island_jolene.json; the run reads the world\'s own list)');
    console.log('  land: ' + P.land.join(' ') + ' · water: ' + P.water.join(' ') + ' · builds: ' + WANT.join(' ') + ' · seconds ' + JSON.stringify(SECS));
    let part = null;
    for (const r of P.rows) { if (r.part !== part) { part = r.part; console.log('\n  [' + part + ']'); } console.log('    ' + r.scene.padEnd(30) + ' ' + String(r.sec).padStart(4) + ' s  ' + r.what); }
    console.log('\n  scenes ' + P.rows.length + ', expected ' + (P.sec / 60).toFixed(0) + ' min (+~10 % overheads: ' + (P.sec * 1.1 / 60).toFixed(0) + ' min)');
    return;
  }
  const R = await sweep();
  R.compare = compare(R);
  const out = path.resolve(opt('out', path.join(__dirname, 'perf', 'master_bench_' + (opt('label', R.meta.commit)) + '.json')));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(R, null, 1));
  const txt = table(R); fs.writeFileSync(out.replace(/\.json$/, '.txt'), txt + '\n');
  console.log('\n' + txt + '\n\n  -> ' + out + ' (+ .txt)');
  process.exit(0);
})().catch(e => { console.error('master_bench: ' + (e && e.stack || e)); process.exit(1); });

module.exports = { stat, plan, compare, table, A, BASELINES, BUILDS, browser, preScript, serve, serveRoot, cacheMB };
