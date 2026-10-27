#!/usr/bin/env node
// cowl_res_probe.js - THE EYE SHEET'S ENTRY AND EXIT, TIMED (G3716, COWL-RES)
//
//   node tools/cowl_res_probe.js --out <file.json> [--variants 0,3,4] [--builds a.json,b.json] [--toggles 5] [--log]
//
// The garage's interior view swaps the eye sheet in (G3715: _cage_ui.js eyeView) and its exit swaps the level-2 mesh
// back; the first entry of a build builds the eye sheet behind the progress cursor. Per build and per variant (the
// variants INTERLEAVED inside each build, v0 = no eye sheet = the baseline), on cowl_res_stills.js's rig (headless
// Chrome on this tree served by _serve.js, dev.html?world=none, the rail's camera pills):
//   - the exterior: the fuselage's triangles, which mesh stands (level 2, always)
//   - the FIRST entry: the eye sheet's build ms, the swap ms, the longest frame of the 2.5 s after the pill (rAF gaps
//     - what a hand on the mouse feels), the cockpit's fuselage triangles, the eye standing
//   - then --toggles exits and entries: each one's swap ms and longest frame
// The longest frame includes the pill's own work (the flyout, the camera): v0's numbers are that floor, and each
// variant's cost is its difference from v0. A GPU TOOL: hold the box's gpu lock in an A0 slot.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUTF = path.resolve(opt('out', 'cowl_res_probe.json'));
const BUILDS = opt('builds', 'builds/cessna172_2026-09-20_corrected.json,builds/cessna172_2026-09-20.json,builds/cub_2026-09-20_corrected.json').split(',');
const VARIANTS = opt('variants', '0,3,4').split(',').map(Number);
const TOGGLES = +opt('toggles', 5);
const WAIT = +opt('wait', 9000);
const LOG = argv.includes('--log');
const ROOT = path.join(__dirname, '..', '..');            // the repo root: the page is /flyDiy/dev.html
const MAIN = 'D:/Dev/DeGaRoR.github.io';
const PORT = 8700 + (process.pid % 200), DBG = 9700 + (process.pid % 200);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('cowl_res_probe: no Chrome'); process.exit(2); }
fs.mkdirSync(path.dirname(OUTF), { recursive: true });
const srv = spawn(process.execPath, [path.join(__dirname, '_serve.js'), String(PORT), ROOT, '--fallback', MAIN], { stdio: 'ignore' });
const udd = path.join(os.tmpdir(), 'cowlres_' + DBG + '_' + Date.now());
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + DBG, '--window-size=1920,1080', '--hide-scrollbars',
  '--no-first-run', '--user-data-dir=' + udd, '--disable-gpu-sandbox', '--disable-frame-rate-limit', '--disable-gpu-vsync', 'about:blank'], { stdio: 'ignore' });
console.log('cowl_res_probe: serve PID ' + srv.pid + ' port ' + PORT + ', chrome PID ' + ch.pid);
const done = code => { try { ch.kill(); } catch (e) {} try { srv.kill(); } catch (e) {}
  setTimeout(() => { try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {} process.exit(code); }, 1500); };
// a slot's hard end (timeout's TERM) takes Chrome and the server down with it - nothing left on the box
process.on('SIGTERM', () => { console.error('cowl_res_probe: stopped (TERM)'); done(5); });
process.on('SIGINT', () => { console.error('cowl_res_probe: stopped (INT)'); done(5); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
(async () => {
  let tgt = null;
  for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + DBG + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  if (!tgt) throw new Error('no page');
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map(); const errs = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') { const t = (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).split('\n').slice(0, 3).join(' | '); errs.push(t); console.error('page exception: ' + t); }
    if (LOG && m.method === 'Runtime.consoleAPICalled') console.log('page ' + m.params.type + ': ' + m.params.args.map(a => a.value !== undefined ? a.value : a.description).join(' ').slice(0, 600)); };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (!r.result || r.result.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.result && r.result.exceptionDetails && (r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description || r.result.exceptionDetails.text))); return r.result.result.value; };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  // ?world=none: the island's first layout is not what this looks at (panel_shot's way)
  await cmd('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/flyDiy/dev.html?world=none' });
  // THE GARAGE BOOT FIRST (panel_shot): the #boot overlay ("before you fly", the loader) stands over the shed until the
  // editor's own build is done - a still taken under it is the loading screen, not the aeroplane
  const BOOTUP = '(()=>{const b=document.getElementById("boot");return !!(b&&!b.hidden&&getComputedStyle(b).display!=="none");})()';
  const READY = "!!(window.CAGE_UI && window.GARAGE_SPEC && window.GARAGE_SPEC.set && document.querySelector('#edRail [data-f=\"camera\"]'))";
  const settle = async (n, what) => { for (let i = 0; i < n; i++) { await sleep(1000);
    const up = await ev(BOOTUP).catch(() => true), ok = await ev(READY).catch(() => false);
    if (!up && ok && i > 3) return true; } throw new Error(what + ': the boot overlay never went (' + n + ' s)'); };
  await settle(180, 'the garage');
  await sleep(3000);
  await ev("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click());return 1})()");
  // the pills live in the rail's camera flyout (editor.js buildCamera): the rail's camera opens it, the pill is pressed
  // once it has filled, and the rail's camera closes it again (panel_shot's way)
  const RAILCAM = "(()=>{const r=document.querySelector('#edRail [data-f=\"camera\"]');if(r)r.click();return !!r})()";
  const pill = async k => {
    await ev(RAILCAM); await sleep(500);
    let got = 0;
    for (let i = 0; i < 20 && !got; i++) {
      got = await ev("(()=>{const p=[...document.querySelectorAll('#edFlyBody .pill')].find(b=>b.textContent.trim()==='" + k + "');if(!p)return 0;if(p.disabled)return -1;p.click();return 1})()");
      if (!got) await sleep(300);
    }
    await sleep(300); await ev(RAILCAM);
    return got === 1;
  };
  // THE FRAME CLOCK: the longest rAF gap since the last reset (a frame the page could not draw is a freeze)
  await ev("(()=>{if(window.__crFG)return 1;const F=window.__crFG={max:0,last:performance.now(),n:0};const t=()=>{const n=performance.now();const d=n-F.last;if(d>F.max)F.max=d;F.last=n;F.n++;requestAnimationFrame(t);};requestAnimationFrame(t);return 1})()");
  const FG0 = "(()=>{const F=window.__crFG;F.max=0;F.n=0;F.last=performance.now();return 1})()";
  const FG = "(()=>{const F=window.__crFG;return JSON.stringify({maxMs:+F.max.toFixed(1),frames:F.n})})()";
  const FUS = "JSON.stringify((()=>{let fus=null;const S=window.CAGE_SCENE;const walk=o=>{if(o.userData&&o.userData.bodyZones&&o.parent){fus=o;}(o.children||[]).forEach(walk);};if(S)walk(S);const g=fus&&fus.geometry;const U=window.CAGE_UI;return {tris:g?(g.index?g.index.count/3:g.attributes.position.count/3):null,eye:!!(U.eyeStanding&&U.eyeStanding()),stats:U.eyeStats?Object.assign({},U.eyeStats):null};})())";
  const timed = async (k, settleMs) => { await ev(FG0); const ok = await pill(k); await sleep(settleMs); const fg = JSON.parse(await ev(FG)); const f = JSON.parse(await ev(FUS)); return { ok, fg, f }; };
  const rows = [];
  const r1 = x => x == null ? null : +(+x).toFixed(1);
  for (const b of BUILDS) {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', b), 'utf8'));
    const spec = raw.spec || raw, tag = path.basename(b, '.json');
    for (const v of VARIANTS) {
      await pill('3/4 front');
      await ev("(()=>{window.CAGE_EYE_VARIANT=" + v + ";window.GARAGE_SPEC.set(" + JSON.stringify(spec) + ");return 1})()");
      await sleep(WAIT);
      await settle(120, tag + ' v' + v);
      await ev("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click());return 1})()");
      await sleep(1500);
      const ext = JSON.parse(await ev(FUS));
      const row = { build: tag, variant: v, extTris: ext.tris, extEye: ext.eye, builds0: ext.stats ? ext.stats.builds : null };
      const e1 = await timed('interior', 2500);
      if (!e1.ok) { row.err = 'no interior view'; rows.push(row); console.log('cowl_res_probe: ' + JSON.stringify(row)); continue; }
      row.first = { maxFrameMs: e1.fg.maxMs, buildMs: e1.f.stats && e1.f.stats.builds > row.builds0 ? r1(e1.f.stats.buildMs) : 0,
        swapMs: e1.f.stats ? r1(e1.f.stats.swapMs) : null, cockpitTris: e1.f.tris, eye: e1.f.eye };
      const exits = [], entries = [];
      for (let i = 0; i < TOGGLES; i++) {
        const x = await timed('3/4 front', 1500);
        exits.push({ maxFrameMs: x.fg.maxMs, swapMs: x.f.stats ? r1(x.f.stats.swapMs) : null, eye: x.f.eye, tris: x.f.tris });
        const n = await timed('interior', 1500);
        entries.push({ maxFrameMs: n.fg.maxMs, swapMs: n.f.stats ? r1(n.f.stats.swapMs) : null, eye: n.f.eye, tris: n.f.tris });
      }
      const med = a => { const s = a.filter(x => x != null).sort((p, q) => p - q); return s.length ? s[s.length >> 1] : null; };
      row.exit = { maxFrameMsMed: med(exits.map(x => x.maxFrameMs)), swapMsMed: med(exits.map(x => x.swapMs)), allLevel2: exits.every(x => !x.eye) };
      row.entry = { maxFrameMsMed: med(entries.map(x => x.maxFrameMs)), swapMsMed: med(entries.map(x => x.swapMs)), allEye: entries.every(x => x.eye === (v >= 2)) };
      row.rebuilt = JSON.parse(await ev(FUS)).stats;
      rows.push(row);
      console.log('cowl_res_probe: ' + JSON.stringify(row));
    }
  }
  await pill('3/4 front');
  await ev("(()=>{window.CAGE_EYE_VARIANT=null;return 1})()");
  // the table: each variant against v0 of its build
  console.log('\nbuild                           v  ext tris  cockpit tris  1st entry: build ms  swap ms  max frame  | entry max frame  exit max frame');
  for (const r of rows) {
    if (!r.first) { console.log(r.build.padEnd(32) + r.variant + '  ' + r.err); continue; }
    const b0 = rows.find(x => x.build === r.build && x.variant === 0 && x.first);
    const d = (a, k) => b0 && a != null && k != null ? ' (' + (a - k >= 0 ? '+' : '') + (a - k).toFixed(1) + ')' : '';
    console.log(r.build.padEnd(32) + r.variant + '  ' + String(r.extTris).padStart(8) + '  ' + String(r.first.cockpitTris).padStart(12) +
      '  ' + String(r.first.buildMs).padStart(19) + '  ' + String(r.first.swapMs).padStart(7) + '  ' + String(r.first.maxFrameMs).padStart(9) + d(r.first.maxFrameMs, b0 && b0.first.maxFrameMs) +
      '  | ' + String(r.entry.maxFrameMsMed).padStart(15) + d(r.entry.maxFrameMsMed, b0 && b0.entry.maxFrameMsMed) +
      '  ' + String(r.exit.maxFrameMsMed).padStart(14) + d(r.exit.maxFrameMsMed, b0 && b0.exit.maxFrameMsMed) +
      (r.variant >= 2 && !(r.first.eye && r.entry.allEye && r.exit.allLevel2) ? '  SWAP WRONG' : '') +
      (r.extEye ? '  EXTERIOR HAS THE EYE SHEET' : ''));
  }
  const bad = rows.some(r => !r.first || r.extEye || (r.variant >= 2 && !(r.first.eye && r.entry.allEye && r.exit.allLevel2)));
  fs.writeFileSync(OUTF, JSON.stringify({ rows, errors: errs }, null, 1));
  console.log('cowl_res_probe: wrote ' + OUTF + (bad ? ' - NOT CLEAN' : ' - clean') + (errs.length ? ' (' + errs.length + ' page exceptions)' : ''));
  ws.close();
  done(bad ? 1 : 0);
})().catch(e => { console.error('cowl_res_probe: ' + e.message); done(1); });
