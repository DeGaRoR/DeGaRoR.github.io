#!/usr/bin/env node
// freight_strap_shot.js - THE STRAPPED LOAD ON THE REAL PAGE (G2400-G2404, FREIGHT-STRAP), FOR THE BOX'S GPU (headless
// Chromium with the GPU: SwiftShader cannot draw the world). STILLS OF A LOADED PAGE ONLY: every still waits for
// BOOT.state 'gone' and #boot hidden, the roll-out's holds and the reveal done, then 2 s more - and a frame that still
// shows the overlay is discarded and taken again (never a loading screen). The page's own answers go to shots.json.
//
//   stand     ?freight=1: the validated Cub on the stand, 120 kg of crated parts as the packer proposes them, accepted
//             (FLYDIY_STRAP.rigLoad) - the strapped load drawn on the stand, the loading view's cut-away (the near skin
//             gone: FLYDIY_STRAP.cutaway) -> strap_cub_stand.jpg; the same for the C172's 60 kg of mail + a passenger
//             -> strap_c172_stand.jpg. THE PROGRAM CENSUS: renderer.info.programs before the load and after it is drawn.
//   flight    the cargo flights, each design twice on a fresh page - NO LOAD (strapload none) then LOADED - on the
//             physics worker (the default; FLYDIY_SIMW.live() read back): the Cub HOME -> Tamgas Hill Strip (w3) with
//             its crates, the C172 round the circuit with its mail and passenger. Sampled every 0.5 s: the phase, the
//             airspeed, the elevator and the throttle, the pitch, the CG along the body axis (bodyOrigin -> cgPos on
//             axes()[0]) and totalM; the CRUISE means (the CG and TRIM difference) to shots.json; in the loaded
//             flights the stills: the chase view (the load through the windows) -> strap_<d>_chase.jpg, the cockpit
//             view -> strap_<d>_cockpit.jpg, and the C172's passenger in the seat (a close orbit on the right side)
//             -> strap_c172_passenger.jpg.
//
//   cd D:/Dev/wt-fstrap && node flyDiy/tools/_serve.js 8141 . --fallback D:/Dev/DeGaRoR.github.io &
//   node flyDiy/tools/freight_strap_shot.js [--port 8141] [--only stand,flight] [--headed]
//   out: futureDesigns/game/evidence/FREIGHT-STRAP/ (jpg + shots.json). Guarded by boxlock (GPU) - never run beside a lock.
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('out', 'futureDesigns/game/evidence/FREIGHT-STRAP'));
const PORT = +opt('port', 8141), ONLY = opt('only', 'stand,flight').split(',');
const BASE = 'http://127.0.0.1:' + PORT + '/flyDiy/index.html?audio=0&freight=1';
const sleep = ms => new Promise(r => setTimeout(r, ms));
// THE BROWSER: the box's own Chrome over CDP (garage_shot.js's rig: headless=new on this machine's GPU - there is no
// playwright on the box), behind the few calls this rig makes: newContext({ viewport }) -> a fresh Chrome and profile,
// newPage, goto, evaluate(fn, arg), screenshot({ path, quality }), on('pageerror'), close
const http = require('http'), os = require('os');
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
function cdpBrowser(headed) {
  const procs = [];
  let seq = 0;
  return {
    async newContext(o) {
      const port = 9400 + (process.pid % 300) + (seq++ % 100);
      const udd = path.join(os.tmpdir(), 'fs_shot_' + port + '_' + Date.now());
      const vp = (o && o.viewport) || { width: 1600, height: 900 };
      const ch = cp.spawn(CHROME, (headed ? [] : ['--headless=new']).concat(['--remote-debugging-port=' + port, '--window-size=' + vp.width + ',' + vp.height,
        '--hide-scrollbars', '--no-first-run', '--user-data-dir=' + udd, '--disable-gpu-sandbox', '--ignore-gpu-blocklist', '--js-flags=--max-old-space-size=8192', 'about:blank']), { stdio: 'ignore' });
      procs.push(ch);
      let tgt = null;
      for (let i = 0; i < 60 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + port + '/json')).find(t => t.type === 'page'); } catch (e) {} }
      if (!tgt) throw new Error('no Chrome page on ' + port);
      const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
      let id = 0; const waits = new Map(), on = {};
      ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
        if (m.method === 'Runtime.exceptionThrown' && on.pageerror) { const d = m.params.exceptionDetails; on.pageerror({ message: (d.exception && d.exception.description || d.text || '').split('\n')[0] }); } };
      const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
      await cmd('Page.enable'); await cmd('Runtime.enable');
      await cmd('Emulation.setDeviceMetricsOverride', { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: false });
      const pg = {
        on: (k, f) => { on[k] = f; },
        goto: async url => { await cmd('Page.navigate', { url }); await sleep(3000); },
        evaluate: async (fn, arg) => {
          const expr = typeof fn === 'string' ? fn : '(' + fn.toString() + ')(' + JSON.stringify(arg === undefined ? null : arg) + ')';
          const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
          if (!r.result || r.result.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.result && r.result.exceptionDetails && (r.result.exceptionDetails.exception || {}).description || r.result && r.result.exceptionDetails && r.result.exceptionDetails.text));
          return r.result.result.value;
        },
        screenshot: async o2 => { const s = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: o2.quality || 88 }); fs.writeFileSync(o2.path, Buffer.from(s.result.data, 'base64')); },
      };
      return { newPage: async () => pg, close: async () => { try { ws.close(); } catch (e) {} try { ch.kill(); } catch (e) {} } };
    },
    async close() { for (const p of procs) { try { p.kill(); } catch (e) {} } },
  };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  if (!CHROME) { console.error('freight_strap_shot: no Chrome'); process.exit(2); }
  const browser = cdpBrowser(argv.includes('--headed'));
  let index = [];
  try { index = JSON.parse(fs.readFileSync(path.join(OUT, 'shots.json'), 'utf8')).shots.filter(s => !ONLY.includes(s.group)); } catch (e) {}
  const fails = [];
  const check = (c, what) => { if (!c) fails.push(what); console.log('  ' + (c ? 'ok  ' : 'FAIL') + ' ' + what); return c; };
  const ev = (pg, fn, arg) => pg.evaluate(fn, arg);
  // A LOADED PAGE: the boot overlay gone, the roll-out's holds lifted, the reveal done; then 2 s
  const overlay = pg => ev(pg, () => {
    const b = document.getElementById('boot');
    const bootUp = !(window.BOOT && window.BOOT.state === 'gone') || !!(b && getComputedStyle(b).display !== 'none' && !b.classList.contains('gone'));
    const H = window.FLYDIY_HOLDS ? window.FLYDIY_HOLDS() : {};
    const P = window.FLIGHT_PROBE, rev = P && P.cam ? P.cam().reveal : 0;
    const scr = [...document.querySelectorAll('#rollScreen, .rollScreen, #tripScreen')].some(e => getComputedStyle(e).display !== 'none' && e.offsetParent !== null);
    return bootUp || !!H.holdRender || !!H.rollHold || rev > 0 || scr;
  }).catch(() => true);
  const settle = async (pg, maxS) => {
    const t0 = Date.now();
    while (Date.now() - t0 < (maxS || 900) * 1000) { if (!(await overlay(pg))) break; await sleep(1000); }
    await sleep(2000);
  };
  const boot = async pg => {
    await settle(pg, 900);
    await ev(pg, () => { const b = [...document.querySelectorAll('#dfBirth button')].find(e => /keep the current/i.test(e.textContent)); if (b) b.click(); });
    await sleep(800);
  };
  const shoot = async (pg, name, twin, group) => {
    for (let k = 0; k < 4; k++) {
      await sleep(400);
      if (await overlay(pg)) { await settle(pg, 120); continue; }
      const f = path.join(OUT, name + '.jpg');
      await pg.screenshot({ path: f, type: 'jpeg', quality: 88 });
      if (await overlay(pg)) { fs.unlinkSync(f); console.log('  (discarded ' + name + ': the overlay came back)'); continue; }
      index.push(Object.assign({ file: name + '.jpg', group }, twin || {}));
      console.log('  still ' + name);
      return true;
    }
    check(false, name + ': no frame without the overlay');
    return false;
  };
  const strap = pg => ev(pg, () => (window.FLYDIY_STRAP ? window.FLYDIY_STRAP.state() : null));
  const programs = pg => ev(pg, () => { const r = window.FLIGHT_PROBE && window.FLIGHT_PROBE.renderer && window.FLIGHT_PROBE.renderer(); return r && r.info && r.info.programs ? r.info.programs.length : null; });
  const newPage = async q => {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const pg = await ctx.newPage();
    pg.on('pageerror', e => console.log('  page error: ' + e.message));
    await pg.goto(BASE + (q || ''), { waitUntil: 'load', timeout: 300000 });
    await boot(pg);
    return { pg, ctx };
  };
  const stand = async (pg, design) => {
    const ok = await ev(pg, d => window.FLYDIY_FREIGHT.stand(d), design);
    await settle(pg, 300);
    return ok;
  };
  const drawn = async pg => { for (let k = 0; k < 120; k++) { const s = await strap(pg); if (s && s.drawn && (s.stand || s.flight)) return s; await sleep(500); } return strap(pg); };

  // ---- THE STAND, CUT AWAY ------------------------------------------------------------------------------------
  if (ONLY.includes('stand')) {
    const { pg, ctx } = await newPage('');
    for (const [d, test, what] of [['cub', 'parts120', '120 kg of crated parts'], ['c172', 'mail60p', '60 kg of mail + a passenger']]) {
      check(await stand(pg, d), d + ': the validated build on the stand');
      const p0 = await programs(pg);
      const got = await ev(pg, a => window.FLYDIY_STRAP.rigLoad(a[0], a[1]), [test, d]);
      check(got && got.items > 0, d + ': ' + what + ' accepted (' + JSON.stringify(got) + ')');
      const s = await drawn(pg);
      check(s && s.drawn && s.stand, d + ': the strapped load drawn on the stand (' + JSON.stringify(s && s.drawn) + ')');
      check(await ev(pg, () => window.FLYDIY_STRAP.cutaway(true)), d + ': the cut-away');
      await sleep(1500);
      const p1 = await programs(pg);
      await shoot(pg, 'strap_' + d + '_stand', { what: d + ', ' + what + ', strapped, the stand cut away', strap: s, programs: { before: p0, after: p1 } }, 'stand');
      await ev(pg, () => window.FLYDIY_STRAP.cutaway(false));
      console.log('  programs: ' + p0 + ' -> ' + p1);
    }
    await ctx.close();
  }

  // ---- THE CARGO FLIGHTS --------------------------------------------------------------------------------------
  if (ONLY.includes('flight')) {
    const FLIGHTS = [['cub', 'parts120', 'w3', '120 kg of crated parts, HOME -> Tamgas Hill Strip'], ['c172', 'mail60p', 'CIRCUIT', '60 kg of mail + a passenger, the circuit']];
    const sample = pg => ev(pg, () => {
      const P = window.FLIGHT_PROBE, s = P.sim(), ap = P.ap();
      const cg = s.cgPos(), o = s.bodyOrigin(), x = s.axes()[0];
      return { t: ap.t, ph: ap.phase, V: s.out.V, alt: cg[1], de: s.ctl.de, thr: s.ctl.thr, pitch: s.out.pitch, cgx: (cg[0] - o[0]) * x[0] + (cg[1] - o[1]) * x[1] + (cg[2] - o[2]) * x[2], M: s.totalM,
               worker: !!(window.FLYDIY_SIMW && window.FLYDIY_SIMW.live()) };
    });
    const res = {};
    for (const [d, test, to, what] of FLIGHTS) {
      for (const load of ['none', test]) {
        const { pg, ctx } = await newPage('&strapload=' + load + ':' + d);
        await stand(pg, d);
        await ev(pg, a => window.FLYDIY_STRAP.rigLoad(a[0], a[1]), [load, d]);
        await ev(pg, t => window.FLYDIY_ROUTE.to(t), to);
        await ev(pg, () => document.getElementById('edRoll').click());
        await settle(pg, 300);
        const st0 = await strap(pg);
        if (load !== 'none') check(st0 && st0.applied && st0.simFreight > 0, d + ' loaded: the masses aboard at the roll-out (' + (st0 ? st0.adds + ' nodes, +' + (st0.dm || 0).toFixed(1) + ' kg' : 'none') + ')');
        else check(st0 && !st0.applied && st0.simFreight === 0, d + ' no load: the sim never asked');
        await ev(pg, () => document.getElementById('bGo').click());
        const rows = [];
        let shot = false;
        for (let k = 0; k < 480; k++) {
          await sleep(500);
          const r = await sample(pg).catch(() => null);
          if (!r) continue;
          rows.push(r);
          if (load !== 'none' && !shot && /ENROUTE|DOWNWIND|CROSSWIND|INBOUND|CLIMB/.test(r.ph) && r.alt > 120) {
            shot = true;
            await ev(pg, () => { window.FLIGHT_PROBE.camMode('chase'); window.FLIGHT_PROBE.camSettle(); });
            await shoot(pg, 'strap_' + d + '_chase', { what: d + ', ' + what + ': the chase view, the load through the windows', sample: r, strap: await strap(pg) }, 'flight');
            await ev(pg, () => window.FLIGHT_PROBE.camMode('cockpit'));
            await shoot(pg, 'strap_' + d + '_cockpit', { what: d + ', ' + what + ': the cockpit view', sample: r }, 'flight');
            if (d === 'c172') {
              await ev(pg, () => { window.FLIGHT_PROBE.camMode('orbit'); window.FLIGHT_PROBE.camSet(Math.PI / 2 + 0.25, 0.12, 3.6); });
              await shoot(pg, 'strap_c172_passenger', { what: 'the C172\'s passenger in the seat (the build\'s co-pilot is the job\'s passenger), the mail behind', sample: r }, 'flight');
            }
            await ev(pg, () => window.FLIGHT_PROBE.camMode('chase'));
          }
          if (/STOPPED|LANDED/.test(r.ph) && k > 60) break;
          // enough: 20 s of cruise sampled (and the loaded flight's stills taken)
          if ((load === 'none' || shot) && rows.filter(q => /ENROUTE|DOWNWIND|CROSSWIND|INBOUND/.test(q.ph)).length >= 40) break;
        }
        const cr = rows.filter(r => /ENROUTE|DOWNWIND|CROSSWIND|INBOUND/.test(r.ph));
        const mean = k => cr.length ? cr.reduce((a, r) => a + r[k], 0) / cr.length : null;
        res[d + ':' + load] = { rows: rows.length, cruise: cr.length, worker: rows.some(r => r.worker), M: rows.length ? rows[0].M : null,
                                cgx: mean('cgx'), de: mean('de'), pitch: mean('pitch'), thr: mean('thr'), V: mean('V'), end: rows.length ? rows[rows.length - 1].ph : null };
        check(res[d + ':' + load].worker, d + ' ' + load + ': flown on the physics worker');
        console.log('  ' + d + ' ' + load + ': ' + JSON.stringify(res[d + ':' + load]));
        await ctx.close();
      }
      const a = res[d + ':none'], b = res[d + ':' + test];
      if (a && b && a.cgx != null && b.cgx != null) {
        const diff = { what: d + ', ' + what, dM: b.M - a.M, dCG_mm: (b.cgx - a.cgx) * 1000, dElevator: b.de - a.de, dPitch_deg: (b.pitch - a.pitch) * 180 / Math.PI, dThrottle: b.thr - a.thr };
        console.log('  THE DIFFERENCE ' + JSON.stringify(diff));
        index.push({ file: null, group: 'flight', flight: d, none: a, loaded: b, diff });
        check(diff.dM > 0 && Math.abs(diff.dCG_mm) > 1, d + ': the load moved the mass (+' + diff.dM.toFixed(1) + ' kg) and the CG (' + diff.dCG_mm.toFixed(0) + ' mm)');
      }
    }
  }

  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify({ when: new Date().toISOString(), shots: index }, null, 1));
  await browser.close();
  console.log(fails.length ? 'freight_strap_shot: ' + fails.length + ' FAILED' : 'freight_strap_shot: done');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
