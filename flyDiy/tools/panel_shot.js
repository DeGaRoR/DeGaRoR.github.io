#!/usr/bin/env node
// panel_shot.js - THE PANEL FROM THE PILOT'S EYE, HEADLESS (A3, 2026-09-20)
//
//   node tools/panel_shot.js --url "http://localhost:8462/flyDiy/dev.html?world=none" \
//        --build "bugReports/flydiy-build (4).json" --out bench/panel/shot.png \
//        [--soc 0.35] [--drain] [--cam cockpit|chase] [--look 30] [--wait 6000] [--js "<expr>"] [--scale 2] [--clip x,y,w,h]
//
// island_shot's rig (headless Chrome on this machine's GPU, the roll-out
// clicked, the chooser dismissed) with a BUILD loaded first: the file goes
// into localStorage's flydiy.wip before the page boots, so the aeroplane on
// the stand is the one under test. Then the CAMERA rail's `cockpit` pill, the
// sim held, one screenshot - and the cockpit's own readings printed (the
// fuel / charge gauge's fraction, the tacho, the PFD's energy cell), so the
// picture and the number can be compared. `--soc f` sets the pack's state of
// charge / the tank's fraction before the shot; `--drain` empties it with the
// sim running (the starved state: the motor stops, the needle on E, the PFD
// cell EMPTY). The flight rolls out on the analytic world (?world=none) by
// default - the island's boot is not what this measures.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL = opt('url', 'http://localhost:8462/flyDiy/dev.html?world=none');
const BUILD = opt('build', null);
const OUT = opt('out', 'bench/panel/shot.png');
const WAIT = +opt('wait', 6000);
const SOC = opt('soc', null);
const CAM = opt('cam', 'cockpit');
const JS = opt('js', null);
const LOOK = +opt('look', 0);          // degrees the pilot's head looks DOWN from its own line
const SCALE = +opt('scale', 1);
const CLIP = opt('clip', null);        // x,y,w,h in CSS px: a second file, <out>_clip.png, of that region at the same scale
const GARAGE = argv.includes('--garage');
const GCAM = opt('gcam', 'interior');       // the editor camera preset to shoot from in the shed (--garage: back in after the roll-out)
const PORT = 9400 + (process.pid % 500);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('panel_shot: no Chrome'); process.exit(2); }
const udd = path.join(require('os').tmpdir(), 'cdp_panel_' + PORT + '_' + Date.now());
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--window-size=1920,1080', '--hide-scrollbars',
  '--no-first-run', '--user-data-dir=' + udd, '--disable-gpu-sandbox', '--disable-frame-rate-limit', '--disable-gpu-vsync', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
(async () => {
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
    if (!r.result || r.result.exceptionDetails) { const d = r.result && r.result.exceptionDetails; throw new Error('page: ' + (d ? (d.exception && d.exception.description || d.text) : JSON.stringify(r.error)).split(String.fromCharCode(10))[0] + ' in ' + expr.slice(0, 80)); } return r.result.result.value; };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: SCALE, mobile: false });
  // THE BUILD FIRST: the page's origin must exist before its storage can be
  // written, so a trivial page of the same origin is opened, the file planted
  // as the working build, and the game booted ONCE (a second boot of dev.html
  // left the loader waiting on pieces the first had claimed)
  if (BUILD) {
    const txt = fs.readFileSync(BUILD, 'utf8');
    await cmd('Page.navigate', { url: URL.replace(/\/flyDiy\/.*$/, '/flyDiy/version.json') });
    // ...and the document must have COMMITTED: an evaluate on the about:blank
    // still showing lands on an opaque origin ("Access is denied" - so does a dead server's error page)
    for (let i = 0; i < 40; i++) { await sleep(500); if (await ev('/version/.test(location.pathname)').catch(() => false)) break; }
    await ev('(()=>{localStorage.setItem("flydiy.wip", ' + JSON.stringify(txt) + '); return 1;})()');
  }
  await cmd('Page.navigate', { url: URL });
  // the GARAGE boot first: a click under its overlay raced the editor's own
  // build (the roll-out then stalled on a blank frame, one run in three)
  for (let i = 0; i < 180; i++) {
    await sleep(1000);
    const up = await ev('(()=>{const b=document.getElementById("boot");return !!(b&&!b.hidden&&getComputedStyle(b).display!=="none");})()').catch(() => true);
    if (!up && i > 5) break;
  }
  await sleep(3000);
  // ONE roll-out click (a second one re-boots the flight and the loader
  // then waits on pieces the first boot had claimed), then the flight
  // The flight is UP when the roll-out screen (G420) has gone and the sim has
  // stepped (out.rpm filled). The chooser is dismissed as it appears. A
  // click every 30 s until then - a second click re-boots the flight, so
  // not sooner (the loader then waits on pieces the first boot had claimed).
  const KEEP = '(()=>{const n=[...document.querySelectorAll("button,a,div")].filter(b=>/keep the current build/i.test(b.textContent||"")&&b.children.length===0);n.forEach(x=>x.click());return n.length;})()';
  const READY = '(()=>{const b=document.getElementById("boot");const up=b&&!b.hidden&&getComputedStyle(b).display!=="none";const s=window.FLIGHT_PROBE&&FLIGHT_PROBE.sim();return !up&&!!s&&!!(s.out.rpm&&s.out.rpm.length)&&!!window.FLYDIY_COCKPIT_I&&!!FLYDIY_COCKPIT_I.model;})()';
  let flying = false;
  for (let a = 0; a < 120 && !flying; a++) {
    if (a % 30 === 0) await ev('(()=>{[...document.querySelectorAll("button")].filter(b=>/roll out|fly the circuit/i.test(b.textContent)).forEach(x=>x.click());})()');
    await sleep(1000);
    await ev(KEEP);
    flying = await ev(READY);
  }
  if (!flying) {
    const why = await ev('JSON.stringify((()=>{const t=id=>{const e=document.getElementById(id);return e?{text:(e.textContent||"").slice(0,120),hidden:e.hidden,disp:getComputedStyle(e).display}:null};const s=window.FLIGHT_PROBE&&FLIGHT_PROBE.sim();return {boot:t("boot"),phase:t("bootPhase"),note:t("bootNote"),tick:t("bootTick"),bGo:t("bGo"),sim:!!s,rpm:s&&s.out.rpm,ck:!!window.FLYDIY_COCKPIT_I,model:!!(window.FLYDIY_COCKPIT_I&&FLYDIY_COCKPIT_I.model)};})())');
    const shot0 = await cmd('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT.replace(/.png$/, '_stuck.png'), Buffer.from(shot0.result.data, 'base64'));
    throw new Error('the roll-out never happened (see ' + OUT.replace(/.png$/, '_stuck.png') + '): ' + why);
  }
  for (let i = 0; i < 6; i++) { await ev(KEEP); await sleep(500); }
  await sleep(2000);
  // the state under test: a fraction set, or the pack drained with the sim running
  if (SOC != null) await ev('(()=>{const F=FLIGHT_PROBE.sim().fuel;const f=' + (+SOC) + ';if(F.kind==="battery")F.soc=f;else{F.frac=f;F.litres=F.litres0*f;F.kg=F.kg0*f;}return 1;})()');
  if (argv.includes('--drain')) {
    await ev('(()=>{const s=FLIGHT_PROBE.sim(),F=s.fuel;if(F.kind==="battery")F.soc=0.0003;else{F.frac=0.0003;F.litres=F.litres0*0.0003;F.kg=F.kg0*0.0003;}s.ctl.thr=1;return 1;})()');
    await sleep(4000);
  }
  // THE SHED (G446.1): the flight's "The shed" door rolls back in and opens the
  // editor (rollInScreen); the editor rail's camera flyout has the INTERIOR
  // preset - the pilot's own eye point, the head hidden - which is the view
  // the user compares the flight's cockpit against
  if (GARAGE) {
    await ev('(()=>{const b=document.getElementById("bHangar2");if(b)b.click();return 1;})()');
    for (let i = 0; i < 90; i++) {
      await sleep(1000);
      const ok = await ev('(()=>{const b=document.getElementById("boot");const up=b&&!b.hidden&&getComputedStyle(b).display!=="none";return !up&&!!window.CAGE_CREW_EYE&&!!document.querySelector("#edRail [data-f=camera]");})()').catch(() => false);
      if (ok && i > 3) break;
    }
    await sleep(2000);
    await ev('(()=>{const r=document.querySelector("#edRail [data-f=camera]");if(r)r.click();return 1;})()');
    await sleep(500);
    let got = 0;   // the flyout fills a beat after the rail's click
    for (let i = 0; i < 20 && !got; i++) { got = await ev('(()=>{const p=[...document.querySelectorAll("#edFlyBody .pill")].find(b=>b.textContent.trim()==="' + GCAM + '");if(!p)return 0;p.click();return 1;})()'); if (!got) await sleep(300); }
    if (!got) console.error('panel_shot: no ' + GCAM + ' pill on the editor camera flyout');
    await sleep(500);
    await ev('(()=>{const r=document.querySelector("#edRail [data-f=camera]");if(r)r.click();return 1;})()');
    if (LOOK) { await sleep(1000); await ev('(()=>{if(window.HEAD_CAM)HEAD_CAM.pitch = ' + (-LOOK * Math.PI / 180) + ';return 1;})()'); }
    if (JS) console.log('panel_shot (garage) js: ' + await ev('(async()=>JSON.stringify(await (async()=>{' + JS + '})()))()'));
    await sleep(WAIT);
    const shotG = await cmd('Page.captureScreenshot', { format: 'png' });
    if (shotG.result) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, Buffer.from(shotG.result.data, 'base64')); }
    const yoke = await ev('JSON.stringify((()=>{const g=window.CAGE_CREW&&CAGE_CREW.moving||[];return {moving:g.filter(m=>/yoke|stick|throttle/.test(m.name)).map(m=>m.name),eye:!!window.CAGE_CREW_EYE};})())');
    console.log('panel_shot (garage): wrote ' + OUT + '\n  ' + yoke);
    ws.close(); ch.kill();
    try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
    return;
  }
  if (JS) await ev('(()=>{' + JS + ';return 1;})()');
  // the readings' lags let settle - the gauge's is 1.5 s of FRAME time, and
  // a headless frame at 2x is slow - so: until the hand agrees with the
  // tank to a hundredth, then the sim held, then the eye
  const SETTLED = '(()=>{const CK=window.FLYDIY_COCKPIT_I,F=FLIGHT_PROBE.sim().fuel;if(!CK||!F)return 1;const cap=CK.energy&&CK.energy.capacity;const want=F.kind==="battery"?F.soc:(cap>0?F.litres/cap:F.frac);return Math.abs(CK.readings.fuelFrac-want)<0.01;})()';
  for (let i = 0; i < 90; i++) { if (await ev(SETTLED)) break; await sleep(1000); }
  await sleep(1500);
  await ev('(()=>{const b=document.getElementById("bPause");if(b&&/pause/i.test(b.textContent))b.click();return 1;})()');
  if (CAM) {
    await ev('(()=>{const r=document.querySelector("#flRail [data-f=camera]");if(r)r.click();return 1;})()');
    await sleep(500);
    const got = await ev('(()=>{const p=[...document.querySelectorAll("#flFlyBody .pill")].find(b=>b.textContent.trim()==="' + CAM + '");if(!p)return 0;p.click();return 1;})()');
    if (!got) console.error('panel_shot: no ' + CAM + ' pill on the camera flyout');
    await sleep(500);
    // LOOKING DOWN AT THE DIALS: the head cam's own pitch (window.HEAD_CAM,
    // the pilot's head in the cockpit view), turned down by --look degrees
    if (LOOK) {
      await sleep(1000);
      await ev('(()=>{if(window.HEAD_CAM)HEAD_CAM.pitch = ' + (-LOOK * Math.PI / 180) + ';return 1;})()');
    }
    await ev('(()=>{const r=document.querySelector("#flRail [data-f=camera]");if(r)r.click();return 1;})()');
  }
  await sleep(WAIT);
  let shot = await cmd('Page.captureScreenshot', { format: 'png' });
  if (!shot.result) { console.error('panel_shot: capture refused (' + JSON.stringify(shot.error) + '), once more'); await sleep(2000); shot = await cmd('Page.captureScreenshot', { format: 'png' }); }
  if (!shot.result) throw new Error('capture refused: ' + JSON.stringify(shot.error));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, Buffer.from(shot.result.data, 'base64'));
  if (CLIP) {
    const [x, y, w, h] = CLIP.split(',').map(Number);
    const c = await cmd('Page.captureScreenshot', { format: 'png', clip: { x, y, width: w, height: h, scale: SCALE } });
    if (c.result) fs.writeFileSync(OUT.replace(/.png$/, '_clip.png'), Buffer.from(c.result.data, 'base64'));
  }
  const info = await ev('JSON.stringify((()=>{const CK=window.FLYDIY_COCKPIT_I,s=FLIGHT_PROBE.sim(),F=s.fuel||{};' +
    'const g=(CK&&CK.model&&CK.model.gauges||[]).filter(x=>x.c&&(x.c.gauge==="fuel"||x.c.gauge==="tacho")).map(x=>{const q=x.obj.quaternion;const a=2*Math.atan2(Math.hypot(q.x,q.y,q.z),q.w)*Math.sign(q.x+q.y+q.z||1)*57.2958;return x.c.gauge+"."+x.c.hand+" "+a.toFixed(1)+"deg (stops "+(x.c.stops?x.c.stops[0][1]+".."+x.c.stops[x.c.stops.length-1][1]:"-")+")";});' +
    'const cell=document.querySelector("#pfdRow .rd[data-i=nrg]");' +
    'return {energy:CK&&CK.energy,items:CK&&CK.fit&&CK.fit.items,energyKind:CK&&CK.fit&&CK.fit.energyKind,busOk:CK&&CK.busOk,' +
    'fuel:{kind:F.kind,frac:+(+F.frac).toFixed(3),soc:+(+F.soc).toFixed(3),litres:+(+F.litres).toFixed(2),kWh:F.kWh,starved:F.starved,enduranceS:F.enduranceS},' +
    'readings:CK&&{fuelFrac:+CK.readings.fuelFrac.toFixed(3),rpmEng:+CK.readings.rpmEng.toFixed(0)},running:s.eng&&s.eng.map(e=>e.running),rpm:s.out.rpm&&s.out.rpm.map(v=>+v.toFixed(0)),' +
    'hands:g,pfd:{nrg:document.getElementById("r-nrg")&&document.getElementById("r-nrg").textContent,label:document.getElementById("r-nrgU")&&document.getElementById("r-nrgU").textContent,warn:!!(cell&&cell.classList.contains("warn"))}};})())');
  console.log('panel_shot: wrote ' + OUT + '\n  ' + info);
  ws.close(); ch.kill();
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
})().catch(e => { console.error('panel_shot: ' + e.message); ch.kill(); process.exit(1); });
