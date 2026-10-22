#!/usr/bin/env node
// stol_shots.js - THE STOL WING, PHOTOGRAPHED AND FLOWN IN THE PAGE (G2825, STOL-WING-2) - FOR A0's BOX
// (UNTESTED HERE: written in a cloud session with no GPU. garage_shot.js's rig, verbatim where it could be.)
//
//   node tools/_serve.js 8450 &        (or any server over the repo root)
//   node tools/stol_shots.js --url http://localhost:8450/flyDiy/dev.html \
//        --build tools/fixtures/stol_cub_kit.json --compare builds/cub_2026-09-20_corrected.json \
//        --out screenshots/stol-2026-10-22/cubkit [--views q,s,f,le,tip,panel,air] [--wait 15000] [--log]
//
// For each build (the kit, then --compare's stock aeroplane): the page booted, the build put through the garage's
// NEW-AEROPLANE door (GARAGE_SPEC.set - the editor seeds its rows from the spec, draws, and the join flies what it
// drew), and then:
//   - WYSIWYG, read off the page: the editor's own STOL rows (CAGE_UI.P wgSlat / wgVG / wgFence / wgCuff / wgDroop /
//     wgFowlerGrow / wgTip) against the spec the join wrote (GARAGE_SPEC.get().wings[0].stol and .tip), printed
//     side by side - they must say the same thing;
//   - STILLS (the editor's panels away): q / s / f (quarter, side, front), le (the leading edge close: the slot
//     standing off the nose, the VG row), tip (the drooped tip from the front), panel (the editor showing the wing:
//     the STOL tiles in their rows' slots, the --ed look);
//   - AIR: the roll-out and the pilot's own take-off, the AP sampled every 100 ms (FLIGHT_PROBE.ap(): its phase,
//     dbg.s - the run - and the flap lever): the run from ROLL to LIFTOFF in metres, the lift-off IAS, stills at the
//     roll's start, at lift-off and 10 s into the climb, and the ailerons' drooped angle read off the model's
//     moving parts with the flap down. Everything lands in <out>_<name>_takeoff.json beside the PNGs.
// What A0 sends back: the PNGs and the two _takeoff.json (kit and stock): the lift-off runs in the page against
// GATE STOL section 6's node numbers (kit 91 m, stock 105 m; the plaque's TO 106 / 157 m).
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL = opt('url', 'http://localhost:8450/flyDiy/dev.html');
const BUILDS = [opt('build', 'tools/fixtures/stol_cub_kit.json'), opt('compare', null)].filter(Boolean);
const OUT = opt('out', 'screenshots/stol-shots');
const VIEWS = opt('views', 'q,s,f,le,tip,panel,air').split(',');
const WAIT = +opt('wait', 15000);
const AIR_MAX = +opt('airmax', 120000);
const PORT = 9400 + (process.pid % 500);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('stol_shots: no Chrome'); process.exit(2); }
const ROOT = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
const say = s => console.log('stol_shots: ' + s);

async function one(file) {
  const name = path.basename(file, '.json');
  const raw = JSON.parse(fs.readFileSync(path.isAbsolute(file) ? file : path.join(ROOT, file), 'utf8'));
  const spec = raw.spec || raw;
  const udd = path.join(require('os').tmpdir(), 'cdp_stol_' + PORT + '_' + Date.now());
  const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--window-size=1920,1080', '--hide-scrollbars',
    '--no-first-run', '--user-data-dir=' + udd, '--disable-gpu-sandbox', '--disable-frame-rate-limit', '--disable-gpu-vsync', 'about:blank'], { stdio: 'ignore' });
  const kill = () => { try { if (process.platform === 'win32') require('child_process').execSync('taskkill /PID ' + ch.pid + ' /T /F', { stdio: 'ignore' }); else ch.kill(); } catch (e) { try { ch.kill(); } catch (e2) {} } };
  try {
    let tgt = null;
    for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
    if (!tgt) throw new Error('no page');
    const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
    let id = 0; const waits = new Map();
    const LOG = argv.includes('--log');
    ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
      if (m.method === 'Runtime.exceptionThrown') console.error('page exception: ' + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).split(String.fromCharCode(10)).slice(0, 3).join(' | '));
      if (LOG && m.method === 'Runtime.consoleAPICalled') console.log('page ' + m.params.type + ': ' + m.params.args.map(a => a.value !== undefined ? a.value : a.description).join(' ').slice(0, 1200)); };
    const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (!r.result || r.result.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.result && r.result.exceptionDetails && (r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description || r.result.exceptionDetails.text))); return r.result.result.value; };
    const shot = async v => { const s = await cmd('Page.captureScreenshot', { format: 'png' });
      fs.mkdirSync(path.dirname(OUT), { recursive: true });
      const f = OUT + '_' + name + '_' + v + '.png'; fs.writeFileSync(f, Buffer.from(s.result.data, 'base64')); say('wrote ' + f); };
    await cmd('Page.enable'); await cmd('Runtime.enable');
    await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    await cmd('Page.navigate', { url: URL });
    let up = false;
    for (let i = 0; i < 60 && !up; i++) { await sleep(1000); up = await ev("!!(window.GARAGE_SPEC && window.CAGE_UI && window.CAGE_JOIN && window.FLIGHT_PROBE)"); }
    if (!up) throw new Error('the garage never came up');
    await sleep(3000);
    // the fresh profile's chooser, if it is up: keep the build (the set below replaces it)
    await ev("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click());return 1})()");
    // THE NEW-AEROPLANE DOOR, with the build's spec
    await ev('(()=>{window.GARAGE_SPEC.set(' + JSON.stringify(spec) + ');return 1})()');
    await sleep(WAIT);
    await ev("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click());return 1})()");
    await sleep(1500);
    const rec = { build: file, at: new Date().toISOString() };
    // WYSIWYG: the editor's rows against the spec the join wrote
    rec.rows = await ev("(()=>{const P=(window.CAGE_UI&&window.CAGE_UI.P)||{};const o={};for(const k of ['wgSlat','wgSlatSpan','wgVG','wgFence','wgCuff','wgCuffSpan','wgDroop','wgFowlerGrow','wgTip','wgFlapType'])o[k]=P[k];return o})()");
    rec.spec = await ev("(()=>{const s=window.GARAGE_SPEC.get();return {stol:s.wings[0].stol===undefined?'absent':s.wings[0].stol,tip:s.wings[0].tip,flap:s.controls&&s.controls.flap}})()");
    say(name + ' rows ' + JSON.stringify(rec.rows) + ' | spec ' + JSON.stringify(rec.spec));
    // the panel first (the editor showing the wing's rows and the STOL tiles in their slots)
    if (VIEWS.includes('panel')) {
      await ev("(()=>{try{if(window.EDITOR_SELECT)window.EDITOR_SELECT('wings');}catch(e){}return 1})()");      // editor.js's select (frames_shot.js's handle)
      await sleep(1500);
      await ev("FLIGHT_PROBE.camSet(0.85,0.22,11),1"); await sleep(1500);
      await shot('panel');
    }
    // the panels away, the aeroplane alone
    await ev("(()=>{for(const id of ['edWrap']){const e=document.getElementById(id);if(e)e.style.visibility='hidden';}for(const b of document.querySelectorAll('button')){if(/^‹(Properties|Parts)$/.test(b.textContent.trim()))b.click();}return 1})()");
    await sleep(1200);
    const PRESETS = { q: [0.85, 0.22, 11], s: [Math.PI / 2, 0.05, 12], f: [0, 0.08, 11], le: [0.35, 0.10, 4.5], tip: [0.05, 0.02, 6.5] };
    for (const v of VIEWS) {
      const p = PRESETS[v]; if (!p) continue;
      await ev('FLIGHT_PROBE.camSet(' + p.join(',') + '),1'); await sleep(1500);
      await shot(v);
    }
    if (VIEWS.includes('air')) {
      await ev("(()=>{for(const id of ['edWrap']){const e=document.getElementById(id);if(e)e.style.visibility='';}return 1})()");
      let flying = false;
      for (let a = 0; a < 8 && !flying; a++) {
        await ev("(()=>{[...document.querySelectorAll('button')].filter(b=>/roll out/i.test(b.textContent)).forEach(x=>x.click());})()");
        await sleep(6000);
        flying = await ev("(()=>{try{const ap=FLIGHT_PROBE.ap();return !!(ap&&ap.phase)}catch(e){return false}})()");
      }
      if (!flying) throw new Error('the roll-out never happened');
      await ev("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click());})()");
      // the take-off, sampled
      const t0 = Date.now(); let last = null, sRoll = null, lift = null, shotRoll = false, shotLift = false, liftT = 0;
      rec.trace = [];
      while (Date.now() - t0 < AIR_MAX) {
        const s = await ev("(()=>{const ap=FLIGHT_PROBE.ap(),sim=FLIGHT_PROBE.sim();return {ph:ap.phase,s:ap.dbg?ap.dbg.s:null,ias:sim&&sim.out?(sim.out.ias!=null?sim.out.ias:sim.out.V):null,alt:sim&&sim.out?sim.out.alt:null,flap:sim?sim.ctl.flap:null}})()");
        if (s.ph !== last) { rec.trace.push([((Date.now() - t0) / 1000).toFixed(1), s.ph, s.s, s.ias]); last = s.ph; say(name + ' ' + s.ph + ' s=' + s.s + ' ias=' + s.ias); }
        if (s.ph === 'ROLL' && sRoll == null) sRoll = s.s;
        if (s.ph === 'ROLL' && !shotRoll) { shotRoll = true; await ev('FLIGHT_PROBE.camSet(0.9,0.18,14),1'); await sleep(2000); await shot('roll'); }
        if (s.ph === 'LIFTOFF' && lift == null && sRoll != null) { lift = Math.abs(s.s - sRoll); rec.liftIas = s.ias; rec.liftFlap = s.flap; liftT = Date.now(); }
        if (lift != null && !shotLift) { shotLift = true; await shot('liftoff'); }
        if (lift != null && Date.now() - liftT > 10000) { await shot('climb'); break; }
        await sleep(100);
      }
      rec.liftRun = lift;
      say(name + ' LIFT-OFF RUN ' + (lift == null ? 'not seen' : lift.toFixed(1) + ' m') + ' at ' + rec.liftIas + ' m/s, flap ' + rec.liftFlap);
      // the ailerons' droop, read off the flown model's moving parts with the flap lever down
      rec.droop = await ev("(()=>{try{const m=FLIGHT_PROBE.model();const P=(m.surfParts||[]).filter(s=>/^ail/.test(s.surf||s.group||''));return P.map(s=>({surf:s.surf||s.group,drive2:s.drive2||null,k2deg:s.k2?+(s.k2*57.2958).toFixed(1):null}))}catch(e){return String(e)}})()");
      say(name + ' ailerons ' + JSON.stringify(rec.droop));
    }
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT + '_' + name + '_takeoff.json', JSON.stringify(rec, null, 1));
    say('wrote ' + OUT + '_' + name + '_takeoff.json');
    ws.close();
  } finally {
    kill();
    try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
  }
}
(async () => { for (const b of BUILDS) await one(b); })().catch(e => { console.error('stol_shots: ' + e.message); process.exit(1); });
