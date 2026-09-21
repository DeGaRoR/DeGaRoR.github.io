#!/usr/bin/env node
// sampler_census.js - THE TEXTURE UNITS EACH GROUND PROGRAM SPENDS, read off the
// GL program (G424's instrument: a declared-but-unsampled sampler costs
// nothing, the source count is wrong). Headless Chrome on this GPU, the game
// booted on Jolene (the chooser's first row, the roll-out), then every
// material in WORLD.scene with a compiled program: active sampler uniforms
// counted, the ground ones named. Run BEFORE adding a sampler to a world
// material - MAX_TEXTURE_IMAGE_UNITS is 16 and the premises patch is the
// tightest program on the island.
//
//   node tools/sampler_census.js [--port 8461] [--wait 40000] [--all]
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'); const path = require('path'); const http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL = opt('url', `http://localhost:${opt('port', '8461')}/flyDiy/dev.html?world=jolene`);
const WAIT = +opt('wait', 40000), ALL = argv.includes('--all');
const PORT = 9400 + (process.pid % 500);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'].find(p => fs.existsSync(p));
const udd = path.join(require('os').tmpdir(), 'cdp_census_' + PORT + '_' + Date.now());
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--window-size=1600,1000', '--no-first-run', '--user-data-dir=' + udd, '--disable-gpu-sandbox', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
(async () => {
  let tgt = null;
  for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') console.error('page exception: ' + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).split('\n')[0].slice(0, 300)); };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (!r.result || r.result.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.result && r.result.exceptionDetails && r.result.exceptionDetails.text)); return r.result.result.value; };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: URL });
  await sleep(WAIT * 0.5);
  // the roll-out: the chooser's first row, then the button (island_shot's steps)
  for (let a = 0; a < 24; a++) {
    await ev("(()=>{[...document.querySelectorAll('button')].filter(b=>/roll out/i.test(b.textContent)).forEach(x=>x.click());})()").catch(() => {});
    await sleep(5000);
    if (await ev("!!(window.WORLD && window.WORLD.scene)").catch(() => false)) break;
  }
  await sleep(WAIT * 0.5);
  // --eval "<expr>": print an expression's value from the booted page (a probe without a new rig)
  const EV = opt('eval', null);
  if (EV) { console.log('eval:', await ev(EV).catch(e => 'ERR ' + e.message)); ws.close(); ch.kill(); process.exit(0); }
  const out = await ev(`(()=>{
    const R = window.FLYDIY_RENDERER, S = window.WORLD && window.WORLD.scene; if (!R || !S) return 'no renderer/scene';
    const gl = R.getContext(), MAXU = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
    const seen = new Map();
    S.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) {
      const p = R.properties.get(m).currentProgram; if (!p || !p.program || seen.has(p.program)) continue;
      const n = gl.getProgramParameter(p.program, gl.ACTIVE_UNIFORMS); const samp = [];
      for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(p.program, i); if (u && (u.type === gl.SAMPLER_2D || u.type === gl.SAMPLER_CUBE || u.type === 0x8DC1 || u.type === 0x8B62 || u.type === 0x8DC5)) samp.push(u.name.replace('[0]', '') + (u.size > 1 ? 'x' + u.size : '')); }
      seen.set(p.program, { name: m.name || m.type, mesh: o.name || o.type, samplers: samp.length, list: samp }); } });
    const rows = [...seen.values()].sort((a, b) => b.samplers - a.samplers);
    return JSON.stringify({ MAXU, rows });
  })()`);
  const r = JSON.parse(out);
  console.log('MAX_TEXTURE_IMAGE_UNITS', r.MAXU);
  for (const row of r.rows) if (ALL || row.samplers >= 8 || /ground|ring|patch|lake|water|Ground|Ring/.test(row.mesh + row.name)) console.log(`${String(row.samplers).padStart(2)}  ${row.mesh.padEnd(28)} ${row.name.padEnd(22)} ${row.list.join(' ')}`);
  ws.close(); ch.kill(); try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
  process.exit(0);
})().catch(e => { console.error('sampler_census: ' + e.message); ch.kill(); process.exit(1); });
