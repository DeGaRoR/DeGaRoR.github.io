#!/usr/bin/env node
// phone_edit.js - PHONE-EDIT-PERF (2 Nov): THE PHONE GARAGE'S EDITS, ON A DESKTOP PROXY OF THE USER'S S20 FE.
// The user (2 Nov, the phone garage on a Galaxy S20 FE 5G): "very laggy ... second long waits. Impossible to operate" - every
// slider release froze the page 6-11 s (their flight log: one 10.2 s frame = a setTimeout 8.5 s + the pointerup 1.5 s), worse
// with floats. The user does not move sliders for tests, so this rig does: a Chrome on this box as a phone - ?profile=phone,
// mobile emulation (--w x --h at --dpr, touch), the CPU throttled --cpu times - booted into the phone garage on --build, then
// per row of --rows (default: one or more per slider family) and per --reps:
//   drag    - the finger's way, as phone.js's knob drives the editor (R12: a pointerdown on the range, an `input` a frame for
//             --ticks frames, then the window's pointerup and the range's `change`): the ticks' handler ms (median / max),
//             the frame intervals while dragging (what "the plane follows the finger" is judged on), the release's own
//             handler ms (pointerup + change), then every long task until the page has been quiet --quiet ms: the
//             FREEZE (release start to the last long task's end) and its tasks;
//   typed   - the value chip's way (_cage_ui's v_<key> `change`): the handler ms and the freeze after it (--typed);
//   the page's own garage edit log (_cage_ui 'gedit': how, path, builds, sheet, layers; 'gtask': the named timers) for each.
// --idle S: S seconds of the shed at rest first: the frame intervals, draws and triangles (renderer.info via the recorder).
// --prof: the first rep's release under the CDP CPU profiler: self ms by function.
// Usage: node tools/perf/phone_edit.js --port 8741 --udd D:/upe1 [--build twin|cub|jodel|cessna|floats|<path>]
//          [--rows wgSpan,fltL] [--reps 3] [--ticks 20] [--cpu 6] [--dpr 2.625] [--w 412] [--h 915] [--quiet 1500]
//          [--typed] [--idle 10] [--prof] [--query 'extra=1'] [--out file.json]
// The box: a browser run - boxlock + A0's slot first. No --help (an unknown flag is ignored).
'use strict';
const fs = require('fs'), path = require('path');
const MB = require('../master_bench.js');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const PORT = +opt('port', 0), UDD = opt('udd', null);
if (!PORT || !UDD) { console.error('phone_edit: --port and --udd are required'); process.exit(2); }
if (PORT >= 8600 && PORT <= 8680) { console.error('phone_edit: --port inside 8600-8680 (the cook ports) - pick 87xx'); process.exit(2); }
const REPO = path.resolve(__dirname, '..', '..', '..');
const BUILDS = { twin: 'bugReports/Twin_busher_floats_2.json', cub: 'builds/cub_2026-09-20_corrected.json', jodel: 'builds/jodel_2026-09-20_corrected.json',
  cessna: 'builds/cessna172_2026-09-20_corrected.json', floats: 'bugReports/cessnaFloatsWOrks.json', pa18: 'builds/pa18_floats_2026-10-23.json' };
const BK = opt('build', 'twin'), BUILD = BUILDS[BK] || BK;
// the slider families: wing, tail, fuselage (the sheet), boom, floats, engine, lights
const ROWS = opt('rows', 'wgSpan,wgChord,stSpan,finHeight,paxLen,halfW,boomLen,fltL,fltZ,engY,li_lampSize').split(',');
const REPS = +opt('reps', 3), TICKS = +opt('ticks', 20), CPU = +opt('cpu', 6), DPR = +opt('dpr', 2.625), VW = +opt('w', 412), VH = +opt('h', 915);
const QUIET = +opt('quiet', 1500), IDLE = +opt('idle', 0), TYPED = flag('typed');
const OUT = path.resolve(opt('out', path.join(__dirname, 'phone_edit_' + BK + '_' + Date.now() + '.json')));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = s => console.log('  ' + s);
const med = a => { const s = a.filter(x => x != null).slice().sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const r1 = x => x == null ? null : Math.round(x * 10) / 10;

// the page side: long tasks, frames, the garage edit log; a drag and a typed value as the phone sends them
const HARNESS = `(() => { if (window.__PE) return 'again';
  const G = window.__PE = { lt: [], fr: [], ev: [], last: 0 };
  try { new PerformanceObserver(l => l.getEntries().forEach(e => G.lt.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: false }); } catch (e) {}
  const loop = t => { if (G.last) G.fr.push([t, t - G.last]); G.last = t; if (G.fr.length > 40000) G.fr.splice(0, 20000); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  const F = window.FLIGHT_REC, e0 = F && F.event;
  if (F && e0) F.event = function (k, ms, d) { if (k === 'gedit' || k === 'gtask') G.ev.push([performance.now(), k, ms, d]); return e0.apply(F, arguments); };
  G.raf = () => new Promise(r => requestAnimationFrame(() => r(performance.now())));
  G.quiet = async (t0, q, cap) => { for (;;) { await new Promise(r => setTimeout(r, 100)); const now = performance.now(); const L = G.lt.filter(x => x[0] + x[1] > t0);
    const last = L.length ? Math.max(...L.map(x => x[0] + x[1])) : t0; if (now - last >= q || now - t0 > cap) return last; } };
  const PE = (t, o) => { try { return new PointerEvent(t, Object.assign({ bubbles: true, pointerId: 7, pointerType: 'touch' }, o || {})); } catch (e) { return new Event(t, { bubbles: true }); } };
  G.drag = async (k, ticks, quiet) => {
    const el = document.getElementById('p_' + k); if (!el || el.type !== 'range' || el.disabled) return { k, missing: true };
    const lo = +el.min, hi = +el.max, st = +el.step || 0.001, x0 = +el.value, dir = (hi - x0) > (x0 - lo) ? 1 : -1, span = Math.min(hi - lo, Math.abs(dir > 0 ? hi - x0 : x0 - lo)) * 0.6;
    const ev0 = G.ev.length, tk = [];
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: false }));
    let tLast = await G.raf(); const fr = [];
    for (let i = 1; i <= ticks; i++) {
      const v = x0 + dir * span * i / ticks; el.value = String(Math.round(v / st) * st);
      const a = performance.now(); el.dispatchEvent(new Event('input', { bubbles: true })); tk.push(performance.now() - a);
      const t = await G.raf(); fr.push(t - tLast); tLast = t;
    }
    const tR = performance.now();
    window.dispatchEvent(PE('pointerup')); el.dispatchEvent(new Event('change', { bubbles: true }));
    const rel = performance.now() - tR;
    const end = await G.quiet(tR, quiet, 60000);
    const L = G.lt.filter(x => x[0] + x[1] > tR).map(x => [+(x[0] - tR).toFixed(0), +x[1].toFixed(0)]);
    return { k, x0, x1: +el.value, ticks: tk, frames: fr, release: rel, freeze: Math.max(rel, end - tR), longs: L, ev: G.ev.slice(ev0).map(e => [+(e[0] - tR).toFixed(0), e[1], e[2], e[3]]) };
  };
  G.typed = async (k, quiet) => {
    const el = document.getElementById('p_' + k), vf = document.getElementById('v_' + k); if (!el || !vf || el.disabled) return { k, missing: true };
    const lo = +el.min, hi = +el.max, x0 = +el.value, dir = (hi - x0) > (x0 - lo) ? 1 : -1, v = x0 + dir * (hi - lo) * 0.05;
    const ev0 = G.ev.length; vf.value = String(+v.toFixed(4));
    const tR = performance.now(); vf.dispatchEvent(new Event('change', { bubbles: true })); const rel = performance.now() - tR;
    const end = await G.quiet(tR, quiet, 60000);
    const L = G.lt.filter(x => x[0] + x[1] > tR).map(x => [+(x[0] - tR).toFixed(0), +x[1].toFixed(0)]);
    return { k, x0, x1: +el.value, release: rel, freeze: Math.max(rel, end - tR), longs: L, ev: G.ev.slice(ev0).map(e => [+(e[0] - tR).toFixed(0), e[1], e[2], e[3]]) };
  };
  // back to a value, a plain release, settled
  G.back = async (k, v, quiet) => { const el = document.getElementById('p_' + k); if (!el) return 0; el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); await G.quiet(performance.now(), quiet, 60000); return 1; };
  G.idle = async s => { const t0 = performance.now(); await new Promise(r => setTimeout(r, s * 1000)); const fr = G.fr.filter(f => f[0] > t0).map(f => f[1]);
    const R = window.FLIGHT_REC, st = R && R.stats ? R.stats(s * 1000) : null, rr = window.FLYDIY_RENDERER || null;
    return { n: fr.length, fr, stats: st }; };
  return 'ok'; })()`;

(async () => {
  if (await MB.serveRoot(PORT)) { console.error('phone_edit: port ' + PORT + ' is taken'); process.exit(4); }
  const srv = MB.serve(PORT, null); await sleep(800);
  const root = await MB.serveRoot(PORT);
  if (!root || path.resolve(root) !== REPO) { console.error('phone_edit: the server serves ' + root + ', not ' + REPO); try { srv.kill(); } catch (e) {} process.exit(4); }
  const done = () => { try { srv.kill(); require('child_process').execSync('taskkill /PID ' + srv.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} };
  process.on('exit', done);
  const R = { date: new Date().toISOString(), build: BK, file: BUILD, cpu: CPU, dpr: DPR, w: VW, h: VH, ticks: TICKS, reps: REPS, rows: [] };
  const save = () => fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
  const b = await MB.browser(UDD);
  // the phone: its viewport and DPR, touch, a mobile UA's layout; the CPU after the boot (a 6x boot takes minutes)
  await b.cmd('Emulation.setDeviceMetricsOverride', { width: VW, height: VH, deviceScaleFactor: DPR, mobile: true });
  await b.cmd('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const url = 'http://localhost:' + PORT + '/flyDiy/index.html?profile=phone' + (opt('query', '') ? '&' + opt('query') : '');
  const l = await b.load(url, MB.preScript(BUILD, null, null));
  log('loaded ' + l.state + ' in ' + l.sec + ' s (' + url + ')');
  await sleep(6000);
  R.meta = JSON.parse(await b.ev(`JSON.stringify({ profile: window.PROFILE && PROFILE.name, catcher: window.POST_FX && POST_FX.catcher && POST_FX.catcher.summary(),
    menuLog: !!(window.FLYDIY_MENU), dpr: devicePixelRatio, canvas: (() => { const c = document.getElementById('c'); return c ? [c.width, c.height] : null; })() })`));
  log('page: ' + JSON.stringify(R.meta));
  log('harness ' + await b.ev(HARNESS));
  if (CPU > 1) await b.cmd('Emulation.setCPUThrottlingRate', { rate: CPU });
  await sleep(3000);
  if (IDLE) {
    const id = JSON.parse(await b.ev(`(async () => JSON.stringify(await __PE.idle(${IDLE})))()`, IDLE * 1000 + 30000));
    const s = id.fr.slice().sort((x, y) => x - y), q = p => s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null;
    R.idle = { n: id.n, p50: r1(q(0.5)), p90: r1(q(0.9)), max: r1(s[s.length - 1]), stats: id.stats };
    log('idle ' + IDLE + ' s: ' + id.n + ' frames, p50 ' + R.idle.p50 + ' p90 ' + R.idle.p90 + ' max ' + R.idle.max + ' ms; ' + JSON.stringify(id.stats || {}).slice(0, 300));
    save();
  }
  for (const k of ROWS) {
    const reps = []; let prof = null, x0 = null;
    for (let r = 0; r < REPS + (flag('prof') ? 1 : 0); r++) {
      const P = flag('prof') && r === 0;
      if (P) { await b.cmd('Profiler.enable'); await b.cmd('Profiler.setSamplingInterval', { interval: 500 }); await b.cmd('Profiler.start'); }
      const one = JSON.parse(await b.ev(`(async () => JSON.stringify(await __PE.${TYPED ? 'typed(' + JSON.stringify(k) + ', ' + QUIET + ')' : 'drag(' + JSON.stringify(k) + ', ' + TICKS + ', ' + QUIET + ')'}))()`, 180000));
      if (P) { const p = await b.cmd('Profiler.stop'); await b.cmd('Profiler.disable'); prof = p.result && p.result.profile ? selfTop(p.result.profile) : null; }
      if (one.missing) { log(k.padEnd(12) + ' (no slider)'); break; }
      if (x0 == null) x0 = one.x0;
      await b.ev(`(async () => __PE.back(${JSON.stringify(k)}, ${one.x0}, ${QUIET}))()`, 180000);
      if (!P) reps.push(one);
    }
    if (!reps.length) { R.rows.push({ k, missing: true }); save(); continue; }
    const tick = reps.flatMap(x => x.ticks || []), fr = reps.flatMap(x => x.frames || []);
    const row = { k, how: TYPED ? 'typed' : 'drag', tickMed: r1(med(tick)), tickMax: r1(tick.length ? Math.max(...tick) : null), dragFrameMed: r1(med(fr)), dragFrameMax: r1(fr.length ? Math.max(...fr) : null),
      release: r1(med(reps.map(x => x.release))), freeze: r1(med(reps.map(x => x.freeze))), freezeMax: r1(Math.max(...reps.map(x => x.freeze))), reps, prof };
    R.rows.push(row); save();
    log(k.padEnd(12) + (TYPED ? '' : ' tick ' + row.tickMed + '/' + row.tickMax + '  drag frame ' + row.dragFrameMed + '/' + row.dragFrameMax) + '  RELEASE ' + row.release + '  FREEZE ' + row.freeze + ' (max ' + row.freezeMax + ')');
    const last = reps[reps.length - 1];
    log('      long tasks: ' + last.longs.map(x => '+' + x[0] + ':' + x[1]).join(' '));
    for (const e of last.ev) log('      +' + e[0] + ' ' + e[1] + ' ' + r1(e[2]) + ' ms ' + (e[3] && typeof e[3] === 'object' ? [e[3].how, e[3].path, e[3].why, 'build ' + e[3].build + '/' + e[3].builds, 'sheet ' + e[3].sheet, 'onBuild ' + e[3].onBuild, e[3].layers].filter(Boolean).join(' | ') : e[3]));
    if (prof) log('      prof self: ' + prof.slice(0, 14).map(([f, ms]) => f + ' ' + ms).join(', '));
  }
  R.exc = b.exc.slice();
  if (CPU > 1) await b.cmd('Emulation.setCPUThrottlingRate', { rate: 1 });
  await b.close();
  save(); log('-> ' + OUT);
  process.exit(0);
})().catch(e => { console.error('phone_edit: ' + (e && e.stack || e)); process.exit(1); });

function selfTop(p) {
  const byId = new Map(p.nodes.map(n => [n.id, n])), self = new Map();
  for (let i = 0; i < p.samples.length; i++) { const n = byId.get(p.samples[i]), us = p.timeDeltas[i + 1] || 0; if (!n) continue;
    const cf = n.callFrame, k = (cf.functionName || '(anon)') + ' ' + (cf.url || '').split('/').pop().split('?')[0] + ':' + (cf.lineNumber + 1);
    self.set(k, (self.get(k) || 0) + us); }
  return [...self].filter(x => !/^\((idle|program|root)\)/.test(x[0])).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, us]) => [k, +(us / 1000).toFixed(1)]);
}
