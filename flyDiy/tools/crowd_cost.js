#!/usr/bin/env node
// crowd_cost.js - WHAT THE PASSENGERS' LINE COSTS AT THE STAND (G3619), FOR THE BOX'S GPU: the frame-cost table the user's
// "strict performance" asks for, and the two shadow rulings (26 Oct: "passengers should have shadows", "make the idle
// shadows smooth if cheap"). The C172 on the sandbox stand, rolled out, the free eye beside the line (crowd_shot's), the
// line HELD (the run's goT pushed out) so every row measures the same scene; one fresh page per row:
//   none      parts60 (no passenger: no crowd fetched)            - the stand's own cost, the eye where the line stood
//   off       bags20p3 ?crowdshadow=0&crowdcontact=0              - three waiting, casting nothing, no feet blobs
//   nofeet    bags20p3 ?crowdcontact=0&posedhz=0                  - casting (cached), no feet blobs (the contact A/B: cache - nofeet)
//   cache     bags20p3 ?posedhz=0                                 - casting + feet, the near map cached (redrawn when a caster moves, or 2 s)
//   hz12      bags20p3 ?posedhz=12                                - the near map redrawn at 12 Hz while one idles
//   every     bags20p3 ?posedhz=60                                - redrawn every frame while one idles
//   board     bags20p3 ?posedhz=12 - the plane nearby (A0 / the user 26 Oct): the line released, walking out and boarding
//             beside the C172, then `Fly the circuit` once all are seated (a press seats everyone at once, so the plane
//             never moves while one queues) and the roll-off; --boardSecs (30) of frames, split: people shown / the taxi
// Each row, over --secs (10) of frames: the frame time (rAF: median, p95, frames over 100 ms), the draws and triangles a
// frame (renderer.info summed over the frame's render calls) and those inside the shadow passes (shadowMap.render wrapped),
// the near map's draws / holds (SHADOW_NEAR.CACHE.stat), and the crowd's shown / posed / line. -> crowd_cost.json + a table.
//   cd <worktree> && node flyDiy/tools/_serve.js 8165 . --fallback D:/Dev/DeGaRoR.github.io &
//   node flyDiy/tools/crowd_cost.js [--port 8165] [--out <dir>] [--people adam,jody,kate] [--page dev.html] [--secs 10] [--rows none,off,nofeet,cache,hz12,board,every] [--boardSecs 30]
// Numbers only (the table is A0's to judge): exits 0 when every row measured, 1 when one did not. Guarded by boxlock (GPU).
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process'), http = require('http'), os = require('os');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const PORT = +opt('port', 8165);
const OUT = path.resolve(opt('out', path.join(os.tmpdir(), 'crowd_cost')));
const PEOPLE = (opt('people', '') || '').split(',').filter(Boolean);
const SECS = +opt('secs', 10), BOARD_SECS = +opt('boardSecs', 30);
const PAGE = 'http://127.0.0.1:' + PORT + '/flyDiy/' + opt('page', 'dev.html') + '?audio=0&freight=1';
const ROWS = { none: ['parts60', ''], off: ['bags20p3', '&crowdshadow=0&crowdcontact=0'], nofeet: ['bags20p3', '&crowdcontact=0&posedhz=0'], cache: ['bags20p3', '&posedhz=0'], hz12: ['bags20p3', '&posedhz=12'], every: ['bags20p3', '&posedhz=60'],
  board: ['bags20p3', '&posedhz=12'] };
const WANT = (opt('rows', 'off,none,nofeet,cache,hz12,board,every')).split(',').filter(k => ROWS[k]);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
// the box's own Chrome over CDP (crowd_shot.js's shim)
async function chrome() {
  const port = 9700 + (process.pid % 200);
  const udd = path.join(os.tmpdir(), 'crowd_cost_' + port + '_' + Date.now());
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
  return { ev, errors, goto: async url => { errors.length = 0; await cmd('Page.navigate', { url }); await sleep(3000); },
    close: () => { try { ws.close(); } catch (e) {} try { ch.kill(); } catch (e) {} try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {} } };
}

(async () => {
  if (!CHROME) { console.error('crowd_cost: no Chrome'); process.exit(2); }
  fs.mkdirSync(OUT, { recursive: true });
  const P = await chrome(), rows = [];
  let eye = null, bad = 0;
  for (const key of WANT) {
    const [load, qs] = ROWS[key];
    await P.goto(PAGE + '&strapload=' + load + ':c172' + qs);
    for (let k = 0; k < 900; k++) { if (!(await P.ev(() => !(window.BOOT && window.BOOT.state === 'gone')).catch(() => true))) break; await sleep(1000); }
    await sleep(2000);
    // the stub pool (only when the page has no FLYDIY_PEOPLE - Game's seam), before the stand seats the job
    if (PEOPLE.length) await P.ev(ks => { if (!window.FLYDIY_PEOPLE) window.FLYDIY_PEOPLE = { pool: () => ks.slice(), char: id => id, client: () => null }; }, PEOPLE);
    await P.ev(() => { const b = [...document.querySelectorAll('#dfBirth button')].find(e => /keep the current/i.test(e.textContent)); if (b) b.click(); });
    await sleep(800);
    await P.ev(() => window.FLYDIY_FREIGHT.stand('c172'));
    await sleep(3000);
    await P.ev(l => window.FLYDIY_STRAP.rigLoad(l, 'c172'), load);
    await P.ev(() => document.getElementById('edRoll').click());
    for (let k = 0; k < 300; k++) { if (await P.ev(() => !!(window.FLYDIY_HOLDS && !window.FLYDIY_HOLDS().inGarage)).catch(() => false)) break; await sleep(1000); }
    let lined = load !== 'bags20p3';
    for (let k = 0; k < 4 * 90 && !lined; k++) {
      await sleep(250);
      lined = await P.ev(() => { const M = window.CROWD && window.CROWD.last, one = M && M.runs[0];
        if (!one || !one.ready || !one.H.some(h => h && h.g.visible)) return false;
        one.R.goT = 1e9; return one.R.people.every(p => p.state === 'line'); }).catch(() => false);
    }
    if (!lined) { console.log('  FAIL ' + key + ': the line never stood'); bad++; rows.push({ key, err: 'no line' }); continue; }
    // the eye: beside the line (crowd_shot's 8 m to the side, 2 m back), kept for the 'none' row (the same view, nobody in it)
    if (load === 'bags20p3' && !eye) eye = await P.ev(() => {
      const one = window.CROWD.last.runs[0], hs = one.H.filter(h => h && h.g.visible), c = [0, 0, 0];
      for (const h of hs) { c[0] += h.g.position.x; c[1] += h.g.position.y; c[2] += h.g.position.z; }
      c[0] /= hs.length; c[1] /= hs.length; c[2] /= hs.length;
      const to = one.R.P.pts[one.R.P.pts.length - 1]; let dx = to[0] - c[0], dz = to[1] - c[2]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
      return { p: [c[0] - dz * 8 - dx * 2, c[1] + 1.7, c[2] + dx * 8 - dz * 2], t: [c[0] + dx * 2, c[1] + 0.9, c[2] + dz * 2] };
    });
    // (the board row keeps the free eye beside the line: the plane rolls off through it)
    const put = eye ? await P.ev(e => !!window.FLYDIY_PREM_EYE(e.p, e.t), eye) : false;
    await sleep(3000);   // settled: the eye's first frames, the near map's first draw
    const m = await P.ev(([secs, board]) => new Promise(res => {
      const R = window.FLYDIY_RENDERER, info = R.info, SM = R.shadowMap, SN = window.SHADOW_NEAR;
      const st0 = SN && SN.CACHE ? Object.assign({}, SN.CACHE.stat) : null;
      const au = info.autoReset; info.autoReset = false; info.reset();
      const sh = { calls: 0, tris: 0 }, orig = SM.render;
      SM.render = function () { const c = info.render.calls, t = info.render.triangles; const r = orig.apply(this, arguments); sh.calls += info.render.calls - c; sh.tris += info.render.triangles - t; return r; };
      const dts = [], calls = [], tris = [], scalls = [], stris = [], crowd = [], withP = [];
      // A0 27 Oct: each frame over 100 ms told apart - what the crowd did across it (each one's state before / after),
      // programs compiled and textures / geometries uploaded across it, and whether `Fly the circuit` was pressed yet
      const hitches = [], mem = () => [info.programs ? info.programs.length : 0, info.memory.textures, info.memory.geometries];
      const states = () => { const r = window.CROWD && window.CROWD.last && window.CROWD.last.runs[0]; return r && r.R ? r.R.people.map(p => p.state).join(',') : '-'; };
      let stB = states(), st = stB, mm = mem();   // stB: two frames back (the work of a frame lands in the next tick's dt)
      // the board row: released now; `Fly the circuit` pressed once everyone sat (the crowd's seats handed back)
      let pressed = !board, pressAt = null;
      if (board) window.CROWD.last.runs[0].R.go();
      let last = performance.now(); const t0 = last;
      const tick = () => {
        const now = performance.now();
        dts.push(now - last); last = now;
        const st2 = states(), mm2 = mem();
        if (dts[dts.length - 1] > 100 && dts.length > 1) hitches.push({ i: dts.length - 1, ms: +dts[dts.length - 1].toFixed(1), at: +((now - t0) / 1000).toFixed(2), was: stB, now: st2,
          programs: mm2[0] - mm[0], textures: mm2[1] - mm[1], geometries: mm2[2] - mm[2], pressed: pressAt != null, calls: info.render.calls });
        stB = st; st = st2; mm = mm2;
        calls.push(info.render.calls); tris.push(info.render.triangles); scalls.push(sh.calls); stris.push(sh.tris);
        info.reset(); sh.calls = 0; sh.tris = 0;
        const c = window.FLYDIY_CROWD ? window.FLYDIY_CROWD() : null; if (c && c.stats) crowd.push(c.stats);
        withP.push(!!(c && c.stats && c.stats.shown > 0));
        if (!pressed && c && !c.seats.length && !(c.stats && c.stats.shown)) { pressed = true; pressAt = dts.length; const b = document.getElementById('bGo'); if (b) b.click(); }
        if (now - t0 < secs * 1000) return requestAnimationFrame(tick);
        SM.render = orig; info.autoReset = au;
        const st1 = SN && SN.CACHE ? SN.CACHE.stat : null;
        const q = (a, f) => { const s = a.slice(1).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(f * s.length))] : null; };
        const last1 = crowd[crowd.length - 1] || {};
        const part = f => { const a = dts.filter((d, i) => i > 0 && f(i)); return a.length ? { n: a.length, p50: q([0].concat(a), 0.5), p95: q([0].concat(a), 0.95), over100: a.filter(d => d > 100).length } : null; };
        res({ hitches, split: board ? { people: part(i => withP[i]), taxi: pressAt != null ? part(i => i > pressAt + 30) : null, pressedAt: pressAt } : null, frames: dts.length - 1, p50: q(dts, 0.5), p95: q(dts, 0.95), over100: dts.slice(1).filter(d => d > 100).length,
              calls: q(calls, 0.5), tris: q(tris, 0.5), shadowCalls: q(scalls, 0.5), shadowTris: q(stris, 0.5), shadowCallsP95: q(scalls, 0.95),
              nearDrawn: st0 && st1 ? st1.drawn - st0.drawn : null, nearHeld: st0 && st1 ? st1.held - st0.held : null, nearWhys: st1 ? st1.whys : null,
              shown: last1.shown, posed: last1.posed, line: last1.line, feet: last1.feet });
      };
      requestAnimationFrame(tick);
    }), [key === 'board' ? BOARD_SECS : SECS, key === 'board']).catch(e => ({ err: String(e && e.message || e) }));
    if (m.err) { bad++; console.log('  FAIL ' + key + ': ' + m.err); } else if (!put) console.log('  note ' + key + ': PREM_EYE refused the eye (the row measured the roll-out view)');
    rows.push(Object.assign({ key, load, qs, eye: put, errors: P.errors.slice(0, 3) }, m));
    console.log('  ' + key.padEnd(6) + (m.err ? '' : ` p50 ${m.p50.toFixed(2)} p95 ${m.p95.toFixed(2)} ms  over100 ${m.over100}  draws ${m.calls} (shadow ${m.shadowCalls}, p95 ${m.shadowCallsP95})  tris ${(m.tris / 1e3).toFixed(0)}k (shadow ${(m.shadowTris / 1e3).toFixed(0)}k)  near map ${m.nearDrawn} drawn / ${m.nearHeld} held  crowd shown ${m.shown} posed ${m.posed} feet ${m.feet}`) +
      (m.hitches && m.hitches.length ? '\n         over 100 ms: ' + m.hitches.map(h => `#${h.i} ${h.ms} ms @${h.at} s [${h.was}] -> [${h.now}] +${h.programs} prog +${h.textures} tex +${h.geometries} geo${h.pressed ? ' (after the press)' : ''}`).join('\n                      ') : '') +
      (m.split ? `
         people walking/boarding: ${JSON.stringify(m.split.people)}  the taxi after the press: ${JSON.stringify(m.split.taxi)}` : ''));
  }
  P.close();
  fs.writeFileSync(path.join(OUT, 'crowd_cost.json'), JSON.stringify({ page: PAGE, secs: SECS, people: PEOPLE, rows }, null, 1));
  const by = k => rows.find(r => r.key === k && !r.err);
  const d = (a, b, f) => (by(a) && by(b) ? (by(a)[f] - by(b)[f]) : null);
  console.log('  vs none: queue (cache) ' + (d('cache', 'none', 'p50') != null ? '+' + d('cache', 'none', 'p50').toFixed(2) + ' ms p50' : '-') +
    ' | shadows (cache - off) ' + (d('cache', 'off', 'p50') != null ? d('cache', 'off', 'p50').toFixed(2) + ' ms, ' + d('cache', 'off', 'shadowCalls') + ' shadow draws' : '-') +
    ' | feet (cache - nofeet) ' + (d('cache', 'nofeet', 'p50') != null ? d('cache', 'nofeet', 'p50').toFixed(2) + ' ms, ' + d('cache', 'nofeet', 'calls') + ' draws' : '-') +
    ' | smooth idles (every - cache) ' + (d('every', 'cache', 'p50') != null ? d('every', 'cache', 'p50').toFixed(2) + ' ms p50, ' + d('every', 'cache', 'p95').toFixed(2) + ' p95' : '-'));
  console.log('CROWD COST: ' + (bad ? 'INCOMPLETE (' + bad + ')' : 'MEASURED') + ' -> ' + path.join(OUT, 'crowd_cost.json'));
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
