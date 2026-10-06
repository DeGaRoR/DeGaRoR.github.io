#!/usr/bin/env node
// welcome_modes_boot.js - G2214 (WELCOME-MODES): DOES THE MENU ADD LOAD TIME TO THE SANDBOX? The garage boot's own step
// log (BOOT.log: each step's start, 'ready') on headless Chromium + SwiftShader, one fresh context per run (no HTTP cache,
// no service worker), for a page BEFORE the menu and the page AFTER it, on the two paths a load can take:
//   local   127.0.0.1, the rig browser: the localhost skip (no screen on either page)
//   host    flydiy.test (mapped to the server), a browser's own user agent, webdriver off: a player's load. Before: no
//           screen (?gfx= chose the preset); after: the menu, Sandbox pressed the moment it is up. The wait on the menu is
//           taken out by the page itself (BOOT.shift) and reported beside it.
// SwiftShader is not a computer's GPU: read the two pages against each other, never the seconds on their own.
//   node tools/_serve.js 8125 &   node tools/perf/welcome_modes_boot.js --before index_before.html [--after index.html]
//        [--port 8125] [--runs local,host] [--reps 1] [--wait 900] [--out reports/evidence/WELCOME-MODES/boot_steps.json]
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); }
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..', '..');
const PORT = +opt('port', 8125), WAIT = +opt('wait', 900) * 1000, REPS = +opt('reps', 1);
const PAGES = { before: opt('before', 'index_before.html'), after: opt('after', 'index.html') };
const RUNS = opt('runs', 'local,host').split(',');
const OUT = path.resolve(ROOT, opt('out', 'reports/evidence/WELCOME-MODES/boot_steps.json'));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const one = async (which, run) => {
  const host = run === 'host';
  const browser = await chromium.launch(host
    ? { ignoreDefaultArgs: ['--enable-automation'], args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--host-resolver-rules=MAP flydiy.test 127.0.0.1', '--disable-blink-features=AutomationControlled'] }
    : { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext(host ? { viewport: { width: 1600, height: 900 }, userAgent: UA } : { viewport: { width: 1600, height: 900 } });
  const pg = await ctx.newPage();
  let errors = 0; pg.on('pageerror', () => errors++);
  const url = 'http://' + (host ? 'flydiy.test' : '127.0.0.1') + ':' + PORT + '/flyDiy/' + PAGES[which] + '?audio=0&gfx=potato';
  const t0 = Date.now();
  await pg.goto(url, { waitUntil: 'domcontentloaded' });
  let menuMs = 0, menu = false;
  // the menu (after, host): pressed the moment it is up
  for (let i = 0; i < 40; i++) {
    const s = await pg.evaluate(() => ({ m: !!document.querySelector('#welcome .wmode[data-mode=sandbox]'), w: !!document.getElementById('welcome'), held: !!window.FLYDIY_WELCOME }));
    if (s.m) { const tm = Date.now(); await pg.evaluate(() => document.querySelector('#welcome .wmode[data-mode=sandbox]').click()); menuMs = Date.now() - tm; menu = true; break; }
    if (!s.held) break;
    await sleep(100);
  }
  const tClick = Date.now();
  let st = null;
  while (Date.now() - t0 < WAIT) {
    try { st = await pg.evaluate(() => window.BOOT ? BOOT.state : null); } catch (e) {}
    if (st === 'ready' || st === 'gone' || st === 'waiting') break;
    await sleep(1000);
  }
  const res = await pg.evaluate(() => {
    const L = (window.BOOT && BOOT.log) || [];
    const steps = L.filter(e => e.k === 'step').map(e => [e.id, e.t]);
    const ready = (L.find(e => e.k === 'ready' || e.k === 'waiting') || {}).t;
    const run = (L.find(e => e.k === 'run') || {}).t;
    return { steps, run, ready, state: BOOT.state, mode: window.FLYDIY_MODE === undefined ? 'undefined' : window.FLYDIY_MODE, held: !!window.FLYDIY_WELCOME, world: window.FLYDIY_WORLD };
  });
  // a step's duration: to the next step's start (the last one to 'ready')
  res.dur = {};
  for (let i = 0; i < res.steps.length; i++) res.dur[res.steps[i][0]] = (i + 1 < res.steps.length ? res.steps[i + 1][1] : res.ready) - res.steps[i][1];
  Object.assign(res, { which, run, page: PAGES[which], menu, menuMs, wall: Math.round((Date.now() - t0) / 1000), wallFromChoice: Math.round((Date.now() - tClick) / 1000), errors });
  await browser.close();
  console.log(which.padEnd(7) + run.padEnd(6) + ' menu ' + (menu ? 'yes' : 'no ') + '  mode ' + res.mode + '  run@' + res.run + ' ms  ready@' + res.ready + ' ms (BOOT clock)  wall ' + res.wall + ' s  state ' + res.state + '  errors ' + errors);
  return res;
};

(async () => {
  const out = { at: new Date().toISOString(), pages: PAGES, runs: [] };
  for (let r = 0; r < REPS; r++) for (const run of RUNS) for (const which of ['before', 'after']) out.runs.push(await one(which, run));
  // the table: step ms before vs after, per path (the mean over the reps)
  const ids = [...new Set(out.runs.flatMap(x => x.steps.map(s => s[0])))];
  const mean = (which, run, f) => { const xs = out.runs.filter(x => x.which === which && x.run === run).map(f).filter(v => v != null && !isNaN(v)); return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null; };
  out.table = {};
  for (const run of RUNS) {
    out.table[run] = { run_ms: [mean('before', run, x => x.run), mean('after', run, x => x.run)], ready_ms: [mean('before', run, x => x.ready), mean('after', run, x => x.ready)], steps: {} };
    for (const id of ids) out.table[run].steps[id] = [mean('before', run, x => x.dur[id]), mean('after', run, x => x.dur[id])];
    console.log('\n' + run + ': step ms, before -> after');
    console.log('  scripts (T0 -> run)  ' + out.table[run].run_ms.join(' -> '));
    for (const id of ids) console.log('  ' + id.padEnd(20) + ' ' + out.table[run].steps[id].join(' -> '));
    console.log('  READY                ' + out.table[run].ready_ms.join(' -> '));
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
})().catch(e => { console.error(e); process.exit(1); });
