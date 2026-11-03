#!/usr/bin/env node
// _floatdup_check.js - GATE FLOATDUP (G3449, RUFUS-CERT for A0): ONE PAIR OF FLOATS IN THE SHED.
//
// The user, 22 Oct (the 172 on its Wipline 2350s in the garage): "I think that's actually the old double floats bug
// back. It's not an elongated floats, it's a duplicate, untextured." HANDOVER G451.1 item 94 ("the double floats on the
// first swap") had been closed as NOT REPRODUCED by a wheels -> floats swap that never re-applied the spec. FLOAT-DUP's
// probe (23 Oct, uuid-deduped, master and claude/float-kit) named it: floats added IN THE SHED, then any GARAGE_SPEC
// update (a design tile, the float kit's propeller pitch) rebuilds the flight model from the spec without the cage's
// drawn float parts (model.floatRigs empty), and app.js buildFloatMeshes then draws the PHYSICS hull (the flat cream
// mesh on `craft`) beside the cage's floats. The fix: the physics hull is never shown in the shed - the cage layer
// draws the floats there - and is synced only in flight.
//
// The page (dev.html, sandbox, headless Chrome, software GL - a CPU run, no GPU bench), the builder's path:
//   the corrected 172 on wheels -> floats on -> the Wipline 2350 -> a spec update (the pitch) -> the 2100 -> wheels ->
//   floats -> the shipped float Cessna (bugReports/cessnaFloatsWOrks.json) loaded -> a spec update
// and at every step with floats on: exactly 2 cage hulls (edFloatHull*) drawn and 0 physics hulls SHOWN (a mesh with
// userData.fx, its own and every parent's visible), every object counted once (uuid) across every scene root.
//
//   node tools/_floatdup_check.js            -> "GATE FLOATDUP: PASS|FAIL|SKIP"   (SKIP without Chrome)
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const { spawn, execSync } = require('child_process');
const T = __dirname, FLY = path.join(T, '..'), REPO = path.join(FLY, '..');
const CHROME = [process.env.CHROME, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  .find(p => p && fs.existsSync(p));
if (!CHROME) { console.log('GATE FLOATDUP: SKIP (no Chrome)'); process.exit(0); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
const readSpec = rel => { const j = JSON.parse(fs.readFileSync(path.join(FLY, rel), 'utf8')); return j.spec || j; };
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) fails++; console.log((c ? '  ok     ' : '  FAIL   ') + m); return c; };

// the page side: every scene root (the cage scene, and every root the flight model's objects climb to), every object
// once (uuid); the cage's drawn hulls and the physics hulls with their visibility down the parent chain
const COUNT = `(()=>{const roots=new Set();if(window.CAGE_SCENE)roots.add(window.CAGE_SCENE);
  const climb=o=>{let r=o;while(r&&r.parent)r=r.parent;if(r)roots.add(r);};
  const M=window.FLIGHT_PROBE&&FLIGHT_PROBE.model&&FLIGHT_PROBE.model();const seen=new Set();
  const dig=(v,d)=>{if(!v||typeof v!=='object'||seen.has(v)||d>3)return;seen.add(v);if(v.isObject3D){climb(v);return;}for(const k in v){try{dig(v[k],d+1)}catch(e){}}};dig(M,0);
  const shown=o=>{let p=o;while(p){if(!p.visible)return false;p=p.parent;}return true;};
  const U=new Set();let cage=0,cageShown=0,phys=0,physShown=0;
  for(const s of roots)s.traverse(o=>{if(U.has(o.uuid))return;U.add(o.uuid);
    if(o.isMesh&&/^edFloatHull/.test(o.name||'')){cage++;if(shown(o))cageShown++;}
    if(o.isMesh&&o.userData&&o.userData.fx){phys++;if(shown(o))physShown++;}});
  return JSON.stringify({roots:roots.size,cage,cageShown,phys,physShown,floats:window.CAGE_UI?+CAGE_UI.P.gearFloats:-1,
    rigs:M&&M.floatRigs?M.floatRigs.length:0});})()`;

(async () => {
  const t0 = Date.now();
  // the page served from this tree; the media the tree does not carry from the main checkout (the shared assets)
  let fallback = '';
  try { fallback = path.dirname(execSync('git rev-parse --path-format=absolute --git-common-dir', { cwd: FLY }).toString().trim()); } catch (e) {}
  const srvPort = 8600 + (process.pid % 300);
  const srv = spawn(process.execPath, [path.join(T, '_serve.js'), String(srvPort), REPO].concat(fallback && fallback !== REPO ? ['--fallback', fallback] : []), { stdio: 'ignore' });
  const dbg = 9600 + (process.pid % 300);
  const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp_floatdup_'));
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader', '--no-first-run', '--no-default-browser-check',
    '--mute-audio', '--window-size=1280,800', '--remote-debugging-port=' + dbg, '--user-data-dir=' + udd]
    .concat(process.getuid && process.getuid() === 0 ? ['--no-sandbox'] : []).concat(['about:blank']), { stdio: 'ignore' });
  const done = code => { try { ch.kill(); } catch (e) {} try { srv.kill(); } catch (e) {}
    setTimeout(() => { try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {} process.exit(code); }, 1500); };
  try {
    for (let i = 0; i < 40; i++) { try { await new Promise((res, rej) => http.get('http://127.0.0.1:' + srvPort + '/flyDiy/dev.html', r => { r.resume(); r.statusCode === 200 ? res() : rej(); }).on('error', rej)); break; } catch (e) { await sleep(500); } }
    let tgt = null; for (let i = 0; i < 60 && !tgt; i++) { await sleep(250); try { tgt = (await getJSON('http://127.0.0.1:' + dbg + '/json')).find(t => t.type === 'page'); } catch (e) {} }
    if (!tgt) throw new Error('no page target from Chrome');
    const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('CDP socket')); });
    let id = 0; const waits = new Map();
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
      if (m.method === 'Runtime.exceptionThrown') console.log('  page exception: ' + String((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text).split('\n')[0].slice(0, 200)); };
    const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (!r.result || r.result.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.result && r.result.exceptionDetails && r.result.exceptionDetails.text)); return r.result.result.value; };
    await cmd('Page.enable'); await cmd('Runtime.enable');
    await cmd('Page.navigate', { url: 'http://127.0.0.1:' + srvPort + '/flyDiy/dev.html?mode=sandbox&audio=0' });
    let up = false;
    for (let i = 0; i < 180 && !up; i++) { await sleep(1000); try { up = await ev("!!(window.CAGE_UI && window.GARAGE_SPEC && window.FLIGHT_PROBE)"); } catch (e) {} }
    if (!up) throw new Error('the garage never came up');
    await ev('(window.BOOT && window.BOOT.hold && window.BOOT.hold(), 1)');
    for (let i = 0; i < 180; i++) { await sleep(1000); if (/waiting|gone|ready/.test(await ev("window.BOOT ? String(window.BOOT.state) : 'none'"))) break; }
    await ev("(()=>{try{window.FLYDIY_SETUP&&window.FLYDIY_SETUP.close();}catch(e){}return 1})()");
    const KEEP = "(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click());return 1})()";
    const step = async (label, expr, wait, want) => {
      await ev(expr); await sleep(wait); await ev(KEEP); await sleep(1500);
      const r = JSON.parse(await ev(COUNT));
      const line = label + ': floats ' + r.floats + ', cage hulls ' + r.cageShown + '/' + r.cage + ' shown, physics hulls ' + r.physShown + '/' + r.phys + ' shown, model.floatRigs ' + r.rigs;
      if (want) ok(r.cageShown === 2 && r.physShown === 0, line + ' (one pair: 2 cage hulls, 0 physics hulls shown)');
      else ok(r.cageShown === 0 && r.physShown === 0, line + ' (wheels: no float drawn)');
    };
    const load = s => '(GARAGE_SPEC.set(' + JSON.stringify(s) + '), 1)';
    const set = (k, v) => `(()=>{const U=window.CAGE_UI;U.P.${k}=${v};U.syncSliders();U.build();return 1})()`;
    const preset = n => `(()=>{const U=window.CAGE_UI;U.P.fltPreset=(window.CAGE_FLOAT_PRESETS||[]).indexOf('${n}');U.syncSliders();U.build();return 1})()`;
    const upd = p => "(GARAGE_SPEC.update({prop:{pitch:'" + p + "'}}),1)";
    console.log('THE BUILDER\'S PATH (the corrected 172)');
    await step('wheels, loaded', load(readSpec('builds/cessna172_2026-09-20_corrected.json')), 14000, false);
    await step('floats on', set('gearFloats', 1), 7000, true);
    await step('the Wipline 2350', preset('Wipline 2350'), 7000, true);
    await step('a spec update (the pitch: what a design tile or the float kit writes)', upd('climb'), 7000, true);
    await step('the Wipline 2100', preset('Wipline 2100'), 7000, true);
    await step('wheels again', set('gearFloats', 0), 7000, false);
    await step('floats again', set('gearFloats', 1), 7000, true);
    console.log('A FLOAT BUILD FROM ITS FILE (the shipped float Cessna)');
    await step('loaded', load(readSpec('bugReports/cessnaFloatsWOrks.json')), 14000, true);
    await step('a spec update', upd('standard'), 7000, true);
    ws.close();
    console.log(checks + ' checks, ' + fails + ' failed (' + Math.round((Date.now() - t0) / 1000) + ' s)');
    console.log('GATE FLOATDUP: ' + (fails ? 'FAIL' : 'PASS'));
    done(fails ? 1 : 0);
  } catch (e) {
    console.log('  FAIL   ' + e.message);
    console.log('GATE FLOATDUP: FAIL');
    done(1);
  }
})();
