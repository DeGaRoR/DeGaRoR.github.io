#!/usr/bin/env node
// program_census.js - THE PROGRAMS A BOOT LINKS, COUNTED (G584, 2026-09-25)
//
// A MEASUREMENT, not a gate (it needs Chrome; GATE PROGRAMS holds the mechanisms in node). Boots the game N
// times in headless Chrome with ONE profile (the second boot is the warm one), presses ROLL OUT, and records
// every linkProgram the page makes: the program's vertex + fragment source (hashed), the boot step it ran in
// (BOOT.current: 'compile' is the roll-out's compile step, 'frames' the first frames under the overlay,
// after = past the reveal) and where it came from (the stack). Then it prints, per boot:
//   links, distinct programs, RE-LINKS (a source linked again: a program released and made anew, or keyed
//   apart from an identical one), links per step, and between boots the programs only one of them has.
// Counts, never times: the times depend on the GPU and on who else uses it; the counts do not.
//
// Usage: node tools/program_census.js [--url http://localhost:8361/flyDiy/dev.html?world=jolene] [--boots 2]
//          [--linkless] [--drain] [--out tools/perf/program_census.json] [--profile <dir>]
//   --linkless  record the sources but skip the driver's compile and link (draws then fail harmlessly): a
//               software GL (SwiftShader, a cloud box) needs minutes per program otherwise. The SOURCES and
//               the keys are three's either way, so the census is the same; the picture is not.
//   --drain     after the reveal, build the premises the game would stream in (WORLD.premises.step), the
//               renderer paused, then let frames draw them: what streaming will link in flight
// Needs a static server on the repo root (node flyDiy/tools/_serve.js 8361 .).
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const URL = opt('url', 'http://localhost:8361/flyDiy/dev.html?world=jolene');
const BOOTS = +opt('boots', 2), LINKLESS = flag('linkless'), DRAIN = flag('drain');
const OUT = opt('out', path.join(__dirname, 'perf', 'program_census.json'));
const UDD = opt('profile', path.join(os.tmpdir(), 'flydiy_program_census_' + Date.now()));
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('program_census: no Chrome found'); process.exit(2); }
const SOFT = /pw-browsers/.test(CHROME) ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] : ['--disable-gpu-sandbox'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = u => new Promise((res, rej) => http.get(u, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej));

// before any page script: the link recorder (no GL round trip - a status query would serialise the parallel compile)
const INJECT = `(() => {
  Error.stackTraceLimit = 80;
  const L = window.__LINKS = [], SRC = window.__SRC = {}, LINKLESS = ${LINKLESS};
  const h = s => { let a = 0x811c9dc5 >>> 0; for (let i = 0; i < s.length; i++) { a ^= s.charCodeAt(i); a = Math.imul(a, 16777619) >>> 0; } return ('0000000' + a.toString(16)).slice(-8); };
  const SH = new WeakMap(), PR = new WeakMap(), LINKED = new WeakSet();
  for (const C of [WebGL2RenderingContext, WebGLRenderingContext]) {
    const P = C.prototype, cs = P.createShader, ss = P.shaderSource, at = P.attachShader, lp = P.linkProgram;
    P.createShader = function (type) { const s = cs.call(this, type); if (s) SH.set(s, { type, src: '' }); return s; };
    P.shaderSource = function (s, src) { const r = SH.get(s); if (r) r.src = src; return ss.call(this, s, src); };
    P.attachShader = function (p, s) { let a = PR.get(p); if (!a) PR.set(p, a = []); a.push(s); return at.call(this, p, s); };
    P.linkProgram = function (p) {
      let vs = '', fs = '';
      for (const s of (PR.get(p) || [])) { const r = SH.get(s); if (!r) continue; if (r.type === 0x8B31) vs = r.src; else fs = r.src; }
      const hv = h(vs), hf = h(fs); SRC[hv] = vs; SRC[hf] = fs;
      const B = window.BOOT;
      L.push({ i: L.length, vs: hv, fs: hf, set: B && B.set, phase: B && B.current && B.current.id, state: B && B.state,
        at: (new Error().stack || '').split(String.fromCharCode(10)).slice(2, 80).map(s => s.trim().replace(/https?:[^ )]*[/]/g, '').replace(/[?]v=[0-9a-f]+/g, '')).filter(s => !/three[.]min/.test(s)).slice(0, 3).join(' < ') });
      if (LINKLESS) { LINKED.add(p); return; }
      return lp.call(this, p);
    };
    if (LINKLESS) {
      const cps = P.compileShader, gpp = P.getProgramParameter, gsp = P.getShaderParameter, gpl = P.getProgramInfoLog, gsl = P.getShaderInfoLog;
      P.compileShader = function () {};
      P.getShaderParameter = function (s, k) { return k === 0x8B4F ? SH.get(s).type : true; };
      P.getProgramParameter = function (p, k) { if (LINKED.has(p)) { if (k === 0x8B89 || k === 0x8B86 || k === 0x8C83 || k === 0x8A36) return 0; if (k === 0x8B85) return 2; return true; } return gpp.call(this, p, k); };
      P.getProgramInfoLog = function (p) { return LINKED.has(p) ? '' : gpl.call(this, p); };
      P.getShaderInfoLog = function () { return ''; };
    }
  }
  // the loading screen's watchdogs off: a software GL is ~50x slower than the reference GPU
  let B0; Object.defineProperty(window, 'BOOT', { configurable: true, get: () => B0, set: v => { B0 = v;
    if (v && v.show && !v.__wrapped) { const sh = v.show; v.show = (set, o) => { if (o) { o.idle = 1e9; o.hard = 1e9; } return sh(set, o); }; v.__wrapped = 1; } } });
})();`;

async function boot(n) {
  const PORT = 9300 + ((process.pid + n * 17) % 600);
  const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--window-size=960,540', '--no-first-run', '--user-data-dir=' + UDD].concat(SOFT, ['about:blank']), { stdio: 'ignore' });
  try {
    let tgt = null; for (let i = 0; i < 60 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
    if (!tgt) throw new Error('no page target');
    const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
    let id = 0; const W = new Map(); ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && W.has(m.id)) { W.get(m.id)(m); W.delete(m.id); } };
    const cmd = (method, params) => new Promise(r => { const i = ++id; W.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async e => { const r = await cmd('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); const d = r.result;
      if (!d || d.exceptionDetails) throw new Error('page: ' + JSON.stringify(d && d.exceptionDetails || r).slice(0, 300)); return d.result.value; };
    await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Page.addScriptToEvaluateOnNewDocument', { source: INJECT });
    const t0 = Date.now(), T = () => ((Date.now() - t0) / 1000).toFixed(0) + ' s';
    await cmd('Page.navigate', { url: URL });
    for (;;) { await sleep(1000); let s = null; try { s = await ev('window.BOOT && BOOT.state'); } catch (e) {} if (s === 'gone') break; if (Date.now() - t0 > 1800000) throw new Error('the shed never opened'); }
    await sleep(2000);
    console.log('  boot ' + n + ': the shed at ' + T());
    await ev("(()=>{[...document.querySelectorAll('button')].filter(b=>/roll out/i.test(b.textContent)).forEach(x=>x.click());})()");
    for (;;) { await sleep(2000); let s = null; try { s = JSON.parse(await ev('JSON.stringify({ st: BOOT.state, set: BOOT.set, done: BOOT.stepI >= BOOT.steps.length })')); } catch (e) { continue; }
      if (s.set === 'rollout' && s.st === 'gone' && s.done) break; if (Date.now() - t0 > 3600000) throw new Error('the roll-out never lifted'); }
    await sleep(5000);
    const reveal = await ev('__LINKS.length');
    console.log('  boot ' + n + ': revealed at ' + T() + ', ' + reveal + ' links');
    if (DRAIN) {
      await ev('(() => { const R = WORLD.renderer; R.__render = R.render; R.render = function () {}; return 1; })()');
      for (;;) { const q = await ev('(() => { const P = WORLD.premises; const t = performance.now(); while (P.stats.queued && performance.now() - t < 3000) P.step(5); return P.stats.queued; })()'); if (!q) break; await sleep(50); }
      await ev('(() => { const R = WORLD.renderer; R.render = R.__render; return 1; })()');
      await sleep(20000);
    }
    const links = JSON.parse(await ev('JSON.stringify(__LINKS)'));
    const steps = JSON.parse(await ev("JSON.stringify(BOOT.log.filter(e => e.k === 'step').map(e => ({ id: e.id, programs: e.programs })))"));
    return { links, reveal, steps };
  } finally { try { ch.kill(); } catch (e) {} await sleep(1500); }
}

(async () => {
  console.log('program_census: ' + BOOTS + ' boot(s), ' + (LINKLESS ? 'linkless' : 'real links') + (DRAIN ? ', the premises drained' : '') + ', profile ' + UDD);
  const runs = [];
  for (let n = 1; n <= BOOTS; n++) runs.push(await boot(n));
  const key = l => l.vs + ':' + l.fs;
  const rows = runs.map((r, n) => {
    const seen = new Set(); let relinks = 0; const by = {};
    for (const l of r.links) { if (seen.has(key(l))) relinks++; seen.add(key(l));
      if (l.set === 'rollout') { const k = l.i >= r.reveal ? 'drained' : (l.phase || 'after reveal'); by[k] = (by[k] || 0) + 1; } }
    return { boot: n + 1, links: r.links.length, distinct: seen.size, relinks, rollout: by };
  });
  for (const r of rows) console.log('  boot ' + r.boot + ': ' + r.links + ' links, ' + r.distinct + ' programs, ' + r.relinks + ' re-links; roll-out links by step ' + JSON.stringify(r.rollout));
  const sets = runs.map(r => new Set(r.links.map(key)));
  for (let n = 1; n < runs.length; n++) {
    const a = sets[0], b = sets[n], onlyA = [...a].filter(k => !b.has(k)), onlyB = [...b].filter(k => !a.has(k));
    console.log('  boot 1 vs boot ' + (n + 1) + ': ' + onlyA.length + ' programs only in boot 1, ' + onlyB.length + ' only in boot ' + (n + 1));
    for (const k of onlyA.slice(0, 8)) { const l = runs[0].links.find(x => key(x) === k); console.log('    only 1: ' + l.set + '/' + (l.phase || '-') + ' ' + l.at.slice(0, 140)); }
    for (const k of onlyB.slice(0, 8)) { const l = runs[n].links.find(x => key(x) === k); console.log('    only ' + (n + 1) + ': ' + l.set + '/' + (l.phase || '-') + ' ' + l.at.slice(0, 140)); }
  }
  const late = runs[runs.length - 1].links.filter(l => l.set === 'rollout' && l.phase === 'frames');
  for (const l of late) console.log('    linked in the first frames: ' + l.at.slice(0, 160));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ url: URL, linkless: LINKLESS, drain: DRAIN, rows, boots: runs.map(r => ({ steps: r.steps, links: r.links.map(l => ({ vs: l.vs, fs: l.fs, set: l.set, phase: l.phase, at: l.at })) })) }, null, 1));
  console.log('program_census: ' + OUT);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
