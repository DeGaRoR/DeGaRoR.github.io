#!/usr/bin/env node
// join_parity_page.js (G1985, JOIN-PARITY) - THE GAME'S OWN ANSWER for the validated builds: a fresh page booted
// headless (Chromium, SwiftShader: no GPU needed) on the default aeroplane, the build then opened through THE LOAD DOOR
// (GARAGE_SPEC.set -> garage.js loadSpec: the door the shelf, the fleet, a file import and a new design all enter by),
// and once the crew has settled and the spec stopped moving, GARAGE_SPEC.get(): the spec the game then flies.
// --door boot puts the build in the autosave instead (flydiy.wip, the boot's restore) - see the G1985 HANDOVER entry
// for what the boot door adds (a follow row leaked from the boot's own builds, the floats' station). GATE JOINPARITY compares node's one load path (tools/_load_build.js) against these, def to def.
//
//   node tools/join_parity_page.js [--only cub,metal] [--jobs 2] [--out tools/fixtures/join_parity_page.json]
//
// One Chromium per build (its own profile: the autosave is the only build it has ever seen). ~4 min a boot under
// SwiftShader; --jobs 2 on 4 cores. Re-run it (and say so in the HANDOVER) when a change to the load chain - the editor's
// layers, the join, garage.js's load, the energy layer's write-back - is MEANT to move what the game flies: GATE
// JOINPARITY then names the build and the field that moved.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const T = __dirname, FLY = path.join(T, '..'), REPO = path.join(FLY, '..');
const LB = require(path.join(T, '_load_build.js'));
const KEYS = opt('only', Object.keys(LB.VALIDATED).join(',')).split(',');
const JOBS = +opt('jobs', 2);
const DOOR = opt('door', 'load');
const OUT = path.resolve(opt('out', path.join(T, 'fixtures', 'join_parity_page.json')));
const CHROME = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', process.env.CHROME,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => p && fs.existsSync(p));
if (!CHROME) { console.error('join_parity_page: no Chrome/Chromium'); process.exit(2); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
const SPORT = 8800 + (process.pid % 100);
const server = spawn(process.execPath, [path.join(T, '_serve.js'), String(SPORT), REPO], { stdio: 'ignore' });
const kids = [server];
const killAll = () => { for (const k of kids) try { k.kill('SIGKILL'); } catch (e) {} };
process.on('exit', killAll); process.on('SIGINT', () => process.exit(1));

async function capture(key, slot) {
  const B = LB.VALIDATED[key];
  let txt = fs.readFileSync(path.join(FLY, B.build), 'utf8');
  if (B.patch) txt = JSON.stringify(B.patch(JSON.parse(txt)));
  const DPORT = 9900 + slot * 7 + (process.pid % 50);
  const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'jpp_'));
  const ch = spawn(CHROME, ['--headless=new', '--no-sandbox', '--remote-debugging-port=' + DPORT, '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader', '--window-size=1280,800', '--no-first-run', '--user-data-dir=' + udd, 'about:blank'], { stdio: 'ignore' });
  kids.push(ch);
  const t0 = Date.now();
  try {
    let tgt = null;
    for (let i = 0; i < 60 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + DPORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
    if (!tgt) throw new Error('no page target');
    const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
    let id = 0; const waits = new Map();
    ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); } };
    const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      const d = r.result; if (!d || d.exceptionDetails) throw new Error('page: ' + JSON.stringify(d && d.exceptionDetails).slice(0, 300)); return d.result.value; };
    await cmd('Page.enable'); await cmd('Runtime.enable');
    await cmd('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.clear();' + (DOOR === 'boot' ? 'localStorage.setItem("flydiy.wip",' + JSON.stringify(txt) + ')' : '') + '}catch(e){}' });
    await cmd('Page.navigate', { url: 'http://localhost:' + SPORT + '/flyDiy/dev.html' });
    // the loading screen gone, no crew character on the wire, and the spec unchanged for 3 s (the energy layer's
    // write-back rides a timer)
    const ready = '(window.BOOT && BOOT.state === "gone" && window.GARAGE_SPEC && !(window.CAGE_CREW_PENDING && CAGE_CREW_PENDING()))';
    if (DOOR !== 'boot') {
      for (let i = 0; i < 900 && !(await ev(ready).catch(() => false)); i++) await sleep(2000);
      await sleep(3000);
      await ev('(GARAGE_SPEC.set(' + JSON.stringify(JSON.parse(txt).spec) + '), 1)');
    }
    let last = null, same = 0;
    for (let i = 0; i < 900; i++) {
      await sleep(2000);
      let s = null;
      try { s = await ev('(window.BOOT && BOOT.state === "gone" && window.GARAGE_SPEC && !(window.CAGE_CREW_PENDING && CAGE_CREW_PENDING())) ? JSON.stringify(GARAGE_SPEC.get()) : null'); } catch (e) {}
      if (!s) continue;
      if (s === last) { if (++same >= 2) break; } else { last = s; same = 0; }
    }
    if (!last) throw new Error('the page never settled');
    const info = await ev('(() => { const d = buildGen(GARAGE_SPEC.get()); let m = 0; for (const n of d.nodes) m += n.m; return { n: d.nodes.length, nb: d.beams.length, mass: m, build: typeof FLYDIY_BUILD !== "undefined" ? FLYDIY_BUILD : null }; })()');
    ws.close();
    return { key, spec: JSON.parse(last), page: info, secs: Math.round((Date.now() - t0) / 1000) };
  } finally { try { ch.kill('SIGKILL'); } catch (e) {} try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {} }
}

(async () => {
  await sleep(500);
  const prev = (() => { try { return JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { return null; } })();
  const out = { what: 'join-parity-page', at: new Date().toISOString(), door: DOOR === 'boot' ? 'boot (flydiy.wip)' : 'load (GARAGE_SPEC.set)', chainSig: LB.chainSig(),
    builds: {} };
  if (prev && prev.door === out.door) Object.assign(out.builds, prev.builds);   // --only refreshes rows of the same door
  let next = 0;
  const lane = async slot => {
    while (next < KEYS.length) {
      const k = KEYS[next++];
      try {
        const r = await capture(k, slot);
        out.builds[k] = { file: LB.VALIDATED[k].build, page: r.page, spec: r.spec };
        console.log(k.padEnd(11) + ' n ' + r.page.n + ' nb ' + r.page.nb + ' mass ' + r.page.mass.toFixed(3) + ' kg  (' + r.secs + ' s)');
      } catch (e) { console.log(k.padEnd(11) + ' FAILED ' + e.message); process.exitCode = 1; }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, JOBS) }, (_, i) => lane(i)));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log('wrote ' + path.relative(FLY, OUT));
  killAll(); process.exit(process.exitCode || 0);
})();
