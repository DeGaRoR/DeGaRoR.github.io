#!/usr/bin/env node
// crowd_probe.js - THE PASSENGERS ON THE REAL PAGE (CHARACTERS G2970), FOR THE BOX'S GPU. Numbers only, no stills.
// The C172 with FREIGHT-STRAP's '60 kg of mail + a passenger' job (the sandbox freight rig, ?freight=1&strapload=),
// rolled out; then every 250 ms: the crowd (window.FLYDIY_CROWD: pending / waiting / seats / shown / posed / boarding),
// the roll-out's holds, and the page's frame times (a rAF counter). Checks:
//   1 the crowd comes up for the job (a seat to walk) and people are drawn
//   2 a boarding fade is seen, and every seat is handed back (seats empty) with the start released (waiting false)
//   3 the frames while people walk: the median and the p99 frame time, the share over 1.5x the cap (printed, gated
//     by the strict train gate's rows, not here)
//   4 GO DURING THE WALK (a second page): one press seats everyone and starts at once
//   5 no page error
//   cd <worktree> && node flyDiy/tools/_serve.js 8151 . --fallback D:/Dev/DeGaRoR.github.io &
//   node flyDiy/tools/crowd_probe.js [--port 8151] [--headed]          -> "CROWD PROBE: PASS|FAIL" (+ crowd_probe.json)
// Guarded by boxlock (GPU) - never run beside a lock. No --help.
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process'), http = require('http'), os = require('os');
const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const PORT = +opt('port', 8151);
const OUT = path.resolve(opt('out', path.join(os.tmpdir(), 'crowd_probe.json')));
const BASE = 'http://127.0.0.1:' + PORT + '/flyDiy/index.html?audio=0&freight=1&strapload=mail60p:c172';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
// the box's own Chrome over CDP (freight_strap_shot.js's shim, the calls this probe makes)
async function chrome(headed) {
  const port = 9700 + (process.pid % 200);
  const udd = path.join(os.tmpdir(), 'crowd_probe_' + port + '_' + Date.now());
  const ch = cp.spawn(CHROME, (headed ? [] : ['--headless=new']).concat(['--remote-debugging-port=' + port, '--window-size=1600,900',
    '--hide-scrollbars', '--no-first-run', '--user-data-dir=' + udd, '--disable-gpu-sandbox', '--ignore-gpu-blocklist', '--js-flags=--max-old-space-size=8192', 'about:blank']), { stdio: 'ignore' });
  let tgt = null;
  for (let i = 0; i < 60 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + port + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  if (!tgt) throw new Error('no Chrome page on ' + port);
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map(), errors = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; errors.push((d.exception && d.exception.description || d.text || '').split('\n')[0]); } };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  const ev = async (fn, arg) => {
    const expr = typeof fn === 'string' ? fn : '(' + fn.toString() + ')(' + JSON.stringify(arg === undefined ? null : arg) + ')';
    const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (!r.result || r.result.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.result && r.result.exceptionDetails && r.result.exceptionDetails.text));
    return r.result.result.value;
  };
  return { ev, errors, goto: async url => { await cmd('Page.navigate', { url }); await sleep(3000); },
    close: () => { try { ws.close(); } catch (e) {} try { ch.kill(); } catch (e) {} } };
}

(async () => {
  if (!CHROME) { console.error('crowd_probe: no Chrome'); process.exit(2); }
  const fails = [], out = { rows: [], go: null };
  const check = (c, what) => { if (!c) fails.push(what); console.log('  ' + (c ? 'ok  ' : 'FAIL') + ' ' + what); return c; };
  // the page loaded, the boot overlay gone; the C172 on the stand with the job's load; rolled out (the screen lifted)
  const ready = async P => {
    for (let k = 0; k < 900; k++) {
      const up = await P.ev(() => !(window.BOOT && window.BOOT.state === 'gone')).catch(() => true);
      if (!up) break; await sleep(1000);
    }
    await sleep(2000);
    await P.ev(() => { const b = [...document.querySelectorAll('#dfBirth button')].find(e => /keep the current/i.test(e.textContent)); if (b) b.click(); });
    await sleep(800);
    await P.ev(() => window.FLYDIY_FREIGHT.stand('c172'));
    await sleep(3000);
    await P.ev(() => window.FLYDIY_STRAP.rigLoad('mail60p', 'c172'));
    await P.ev(() => document.getElementById('edRoll').click());
    for (let k = 0; k < 300; k++) { if (await P.ev(() => !!(window.FLYDIY_HOLDS && !window.FLYDIY_HOLDS().inGarage)).catch(() => false)) break; await sleep(1000); }
    // the frame clock, from the roll-out on
    await P.ev(() => { window.__ft = []; let t0 = performance.now(); const f = t => { window.__ft.push(t - t0); t0 = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
  };
  const state = P => P.ev(() => ({ c: window.FLYDIY_CROWD ? window.FLYDIY_CROWD() : null, h: window.FLYDIY_HOLDS ? window.FLYDIY_HOLDS() : null }));

  // ---- 1-3 THE WALK, THE QUEUE, THE BOARDING ----------------------------------------------------------------------
  {
    const P = await chrome(argv.includes('--headed'));
    await P.goto(BASE);
    await ready(P);
    let maxSeats = 0, shown = 0, boarding = 0, done = null, t0 = Date.now(), lifted = null, ftWalk = [];
    for (let k = 0; k < 4 * 150; k++) {
      await sleep(250);
      const s = await state(P).catch(() => null);
      if (!s || !s.c) continue;
      const t = (Date.now() - t0) / 1000;
      out.rows.push(Object.assign({ t }, s.c, { rollHold: s.h && s.h.rollHold }));
      if (s.h && !s.h.rollHold && lifted == null) lifted = t;
      maxSeats = Math.max(maxSeats, s.c.seats.length);
      if (s.c.stats) { shown = Math.max(shown, s.c.stats.shown); boarding = Math.max(boarding, s.c.stats.boarding); }
      if (s.c.stats && s.c.stats.shown > 0) ftWalk = ftWalk.concat(await P.ev(() => window.__ft.splice(0)));
      else await P.ev(() => window.__ft.splice(0));
      if (lifted != null && maxSeats > 0 && !s.c.pending && !s.c.waiting && !s.c.seats.length) { done = t; break; }
    }
    check(out.rows.length && out.rows[0].on, '1 the crowd is on (a job with a passenger, the default)');
    check(maxSeats > 0, '1 seats to walk: ' + maxSeats);
    check(shown > 0, '1 people drawn: up to ' + shown + ' at once');
    check(boarding > 0, '2 a boarding fade seen');
    check(done != null, '2 every seat handed back and the start released' + (done != null ? ' (' + (done - lifted).toFixed(1) + ' s after the screen lifted)' : ''));
    const ft = ftWalk.filter(x => x > 0 && x < 2000).sort((a, b) => a - b), q = p => ft.length ? ft[Math.min(ft.length - 1, Math.floor(p * ft.length))] : NaN;
    out.walk = { frames: ft.length, median: q(0.5), p99: q(0.99), over50: ft.filter(x => x > 50).length / Math.max(1, ft.length) };
    console.log('  3 frames while people walk: ' + ft.length + ', median ' + q(0.5).toFixed(1) + ' ms, p99 ' + q(0.99).toFixed(1) + ' ms, over 50 ms ' + (100 * out.walk.over50).toFixed(1) + ' %');
    out.errors1 = P.errors.slice();
    P.close();
  }
  // ---- 4 GO DURING THE WALK ---------------------------------------------------------------------------------------
  {
    const P = await chrome(argv.includes('--headed'));
    await P.goto(BASE);
    await ready(P);
    let waiting = false;
    for (let k = 0; k < 4 * 60 && !waiting; k++) { await sleep(250); const s = await state(P).catch(() => null); waiting = !!(s && s.c && s.c.waiting && s.c.stats && s.c.stats.shown > 0); }
    check(waiting, '4 the start waits while people walk');
    await P.ev(() => document.getElementById('bGo').click());
    await sleep(500);
    const s = await state(P);
    out.go = s.c;
    check(s.c && !s.c.waiting && !s.c.seats.length && !(s.c.stats && s.c.stats.shown), '4 Go: everyone seated, nobody walking, the start released');
    out.errors2 = P.errors.slice();
    P.close();
  }
  const errs = (out.errors1 || []).concat(out.errors2 || []);
  check(!errs.length, '5 no page error' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log('rows -> ' + OUT);
  console.log('CROWD PROBE: ' + (fails.length ? 'FAIL' : 'PASS'));
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
