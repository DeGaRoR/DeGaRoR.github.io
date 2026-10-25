#!/usr/bin/env node
// crowd_shot.js - THE PASSENGERS' LINE ON THE REAL PAGE (G3619), FOR THE BOX'S GPU: the stills the user asked for
// ("I'll need to see some passengers queuing screenshots"). The C172 on the sandbox stand with '20 kg of bags + three
// passengers' (?freight=1&strapload=bags20p3:c172), rolled out; the line held (the run's goT pushed out) while the free
// eye looks at it from beside, then released: three stills - 1 the line waiting at the embark point, 2 walking out in
// order, 3 the queue at the cabin door - each with the crowd's state beside it. The eye is ASSERTED (FLYDIY_PREM_EYE
// true, the camera within 0.5 m of where it was put) and each still is checked for people drawn in it.
//   --people a,b,c   the bodies to seat when the page has no FLYDIY_PEOPLE (Game's seam): a stub pool of exactly those
//                    (the still's caption says so); with the seam on the page it is never replaced
//   cd <worktree> && node flyDiy/tools/_serve.js 8152 . --fallback D:/Dev/DeGaRoR.github.io &
//   node flyDiy/tools/crowd_shot.js [--port 8152] [--out <dir>] [--people adam,jody,kate] [--page dev.html]   -> "CROWD SHOT: PASS|FAIL"
// Guarded by boxlock (GPU) - never run beside a lock. No --help.
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process'), http = require('http'), os = require('os');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const PORT = +opt('port', 8152);
const OUT = path.resolve(opt('out', path.join(os.tmpdir(), 'crowd_shot')));
const PEOPLE = (opt('people', '') || '').split(',').filter(Boolean);
// dev.html by default: the page straight off src/ (a WIP branch's stills need no build); --page index.html for a built one
const BASE = 'http://127.0.0.1:' + PORT + '/flyDiy/' + opt('page', 'dev.html') + '?audio=0&freight=1&strapload=bags20p3:c172';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
// the box's own Chrome over CDP (crowd_probe.js's shim + a screenshot)
async function chrome() {
  const port = 9700 + (process.pid % 200);
  const udd = path.join(os.tmpdir(), 'crowd_shot_' + port + '_' + Date.now());
  const ch = cp.spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + port, '--window-size=1600,900', '--hide-scrollbars',
    '--no-first-run', '--user-data-dir=' + udd, '--disable-gpu-sandbox', '--ignore-gpu-blocklist', '--js-flags=--max-old-space-size=8192', 'about:blank'], { stdio: 'ignore' });
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
  const shot = async file => { const r = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: 88 }); fs.writeFileSync(file, Buffer.from(r.result.data, 'base64')); };
  return { ev, errors, shot, goto: async url => { await cmd('Page.navigate', { url }); await sleep(3000); },
    close: () => { try { ws.close(); } catch (e) {} try { ch.kill(); } catch (e) {} try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {} } };
}

(async () => {
  if (!CHROME) { console.error('crowd_shot: no Chrome'); process.exit(2); }
  fs.mkdirSync(OUT, { recursive: true });
  const fails = [], rows = [];
  const check = (c, what) => { if (!c) fails.push(what); console.log('  ' + (c ? 'ok  ' : 'FAIL') + ' ' + what); return c; };
  const P = await chrome();
  await P.goto(BASE);
  for (let k = 0; k < 900; k++) { if (!(await P.ev(() => !(window.BOOT && window.BOOT.state === 'gone')).catch(() => true))) break; await sleep(1000); }
  await sleep(2000);
  // the stub pool BEFORE the stand (fsPeople draws when the load lands) - only when the page has no seam of its own
  const stub = PEOPLE.length ? await P.ev(ks => {
    if (window.FLYDIY_PEOPLE) return false;
    window.FLYDIY_PEOPLE = { pool: () => ks.slice(), char: id => id, client: () => null };
    return true;
  }, PEOPLE) : false;
  await P.ev(() => { const b = [...document.querySelectorAll('#dfBirth button')].find(e => /keep the current/i.test(e.textContent)); if (b) b.click(); });
  await sleep(800);
  await P.ev(() => window.FLYDIY_FREIGHT.stand('c172'));
  await sleep(3000);
  await P.ev(() => window.FLYDIY_STRAP.rigLoad('bags20p3', 'c172'));
  await P.ev(() => document.getElementById('edRoll').click());
  for (let k = 0; k < 300; k++) { if (await P.ev(() => !!(window.FLYDIY_HOLDS && !window.FLYDIY_HOLDS().inGarage)).catch(() => false)) break; await sleep(1000); }
  // the line drawn: hold it (the shots need the eye placed and settled)
  let lined = false;
  for (let k = 0; k < 4 * 90 && !lined; k++) {
    await sleep(250);
    lined = await P.ev(() => { const M = window.CROWD && window.CROWD.last, one = M && M.runs[0];
      if (!one || !one.ready || !one.H.some(h => h && h.g.visible)) return false;
      one.R.goT = 1e9; return one.R.people.every(p => p.state === 'line'); }).catch(() => false);
  }
  check(lined, '1 the line is drawn at the embark point, everyone waiting');
  // the eye beside what is shown: the people's centroid, the line's direction toward the door, 8 m out to one side
  const aim = (side, back) => P.ev(([side, back]) => {
    const M = window.CROWD.last, one = M.runs[0], hs = one.H.filter(h => h && h.g.visible);
    if (!hs.length) return null;
    const c = [0, 0, 0]; for (const h of hs) { c[0] += h.g.position.x; c[1] += h.g.position.y; c[2] += h.g.position.z; }
    c[0] /= hs.length; c[1] /= hs.length; c[2] /= hs.length;
    const to = one.R.P.pts[one.R.P.pts.length - 1];
    let dx = to[0] - c[0], dz = to[1] - c[2]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const p = [c[0] - dz * side - dx * back, c[1] + 1.7, c[2] + dx * side - dz * back], t = [c[0] + dx * 2, c[1] + 0.9, c[2] + dz * 2];
    const ok = window.FLYDIY_PREM_EYE(p, t);
    return { ok, p, t, n: hs.length, keys: hs.map(h => h.p.key + ':' + h.p.state) };
  }, [side, back]);
  const take = async (n, name, side, back) => {
    const e = await aim(side, back);
    await sleep(1500);
    const st = await P.ev(() => ({ c: window.FLYDIY_CROWD ? window.FLYDIY_CROWD() : null,
      // the free eye's own pose (DEVCAM drives the camera from it every frame)
      cam: window.DEV_CAM ? [window.DEV_CAM.pos.x, window.DEV_CAM.pos.y, window.DEV_CAM.pos.z] : null })).catch(() => ({}));
    const file = path.join(OUT, 'crowd_' + n + '_' + name + '.jpg');
    await P.shot(file);
    const near = e && st.cam ? Math.hypot(st.cam[0] - e.p[0], st.cam[1] - e.p[1], st.cam[2] - e.p[2]) : null;
    check(!!(e && e.ok) && near != null && near < 0.5, `${n} the eye put beside the ${name} (PREM_EYE ${e && e.ok}${near != null ? ', the camera ' + near.toFixed(2) + ' m from it' : ''})`);
    check(!!(e && e.n > 0), `${n} people drawn in the ${name} still: ${e ? e.keys.join(', ') : 'none'}`);
    rows.push({ n, name, file, eye: e, crowd: st.c });
    console.log('     -> ' + file);
  };
  if (lined) {
    await take(1, 'line', 8, 2);
    // released: they walk out in order
    await P.ev(() => window.CROWD.last.runs[0].R.go());
    await sleep(3500);
    await take(2, 'walk-out', 9, 0);
    // the queue at the door: the first one turning / boarding
    let atDoor = false;
    for (let k = 0; k < 4 * 60 && !atDoor; k++) { await sleep(250); atDoor = await P.ev(() => { const one = window.CROWD.last.runs[0]; return !!one && one.R.people.some(p => p.state === 'turn' || p.state === 'board'); }).catch(() => false); }
    check(atDoor, '3 the first one reaches the cabin door');
    await take(3, 'door-queue', 7, 4);
  }
  check(!P.errors.length, '4 no page error' + (P.errors.length ? ': ' + P.errors.slice(0, 3).join(' | ') : ''));
  fs.writeFileSync(path.join(OUT, 'crowd_shot.json'), JSON.stringify({ stub: stub ? PEOPLE : null, rows }, null, 1));
  if (stub) console.log('  note: the page had no FLYDIY_PEOPLE - the bodies are the stub pool ' + PEOPLE.join(', '));
  P.close();
  console.log('CROWD SHOT: ' + (fails.length ? 'FAIL' : 'PASS'));
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
