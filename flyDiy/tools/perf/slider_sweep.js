#!/usr/bin/env node
// slider_sweep.js - PERF-SLIDERS (23 Nov 2026): PERF-OBJECTIVES ROW 1, PER AEROPLANE, IN A VISIBLE BROWSER.
// The user (22 Nov, from a playtest): "editing the dc3 is really laggy on the phone, while the chinook was really easy.
// Let's make sure that all planes are workable. The thing is laggy even before it updates." Row 1 of the official table:
// "Garage sliders instantaneous: no frame > 50 ms while a slider moves". The in-game Benchmark's sliders row steps the first
// four sliders on screen of ONE aeroplane with input + change (a plain build, no drag); this rig drags, on EVERY aeroplane.
// One page (tools/page_rig.js: HEADED and live - the user's rule of 22 Nov, a visible Chrome with its own vsync), each
// aeroplane of the plane list put on the stand through the garage's own door (GARAGE_SPEC.openListed), then:
//   (a) IDLE     --idle seconds of the garage at rest with that aeroplane: the frame intervals (p50 / p95 / max), and a
//                census of the frame (draw calls, triangles, by counting the context's own draw calls over 30 frames);
//   (b) DRAG     per slider (a wing dimension, a fuselage dimension, a position: the first of each family the aeroplane
//                has), as phone.js's knob and a mouse drive the editor: a pointerdown on the range, then an `input` a
//                frame for --sec seconds (the value sweeping half its free range), then the window's pointerup and the
//                range's `change`. Measured: the first tick's INPUT TO THE CHANGED FRAME (the tick dispatched between
//                two frames as a pointer event is; the frame that draws it; its presentation = the next frame's stamp),
//                every tick's handler ms, every frame interval of the drag (median / p95 / WORST - the bar is on the
//                worst), the ticks' paths (deform / preview / whole) and the long tasks inside the drag;
//   (c) RELEASE  the release's handler ms and the FREEZE after it (release to the end of the last long task, the page
//                quiet --quiet ms), the page's own edit log for it (gedit: path, why, layers), and a plain whole build
//                of the same row (back to the start value by input + change: what a click or a typed value costs).
// Two set-ups (--setup): phone = ?profile=phone&idle=0 in a 412x915 viewport at DPR 2.625, touch, the CPU throttled
// --cpu times (4) after the boot (the proxy of the user's S20 FE, as phone_edit.js); desktop = ?mode=sandbox at the
// user's screen (5120x1271, DPR 1, no throttle).
// --prof list:12,list:8: one more drag a slider on those planes under the CDP CPU profiler (the ticks only: stopped
// before the release) - <out>_list<N>_<key>.cpuprofile and the self time by function and by file in the JSON.
// --gate: exit 1 when any aeroplane's worst drag frame is over --bar ms (50). THE TABLE is printed worst first and
// written beside the JSON as <out>.md.
// Usage: node tools/perf/slider_sweep.js --setup phone|desktop [--planes list:12,list:8 | --all] [--rows wgSpan,paxLen,s1X]
//          [--sec 3] [--idle 4] [--quiet 1500] [--cpu 4] [--bar 50] [--gate] [--prof list:12,list:8] [--query 'k=v&k2=v2']
//          [--size 5120x1271] [--cap 5400] [--headless] [--label before] [--out file.json]
// A GPU RUN: only as  bash D:/Dev/flydiy-notes/cpu_token.sh run <WHO> --gpu -- bash <slot.sh>  in a window A0 gave.
// Check the cap against the plan: a plane takes about 1 minute at the desktop and 2 on the throttled phone.
'use strict';
const fs = require('fs'), path = require('path');
const PR = require('../page_rig.js');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const ROOT = path.join(__dirname, '..', '..');
const SETUP = opt('setup', 'phone');
if (!['phone', 'desktop'].includes(SETUP)) { console.error('slider_sweep: --setup phone|desktop'); process.exit(2); }
const SEC = +opt('sec', 3), IDLE = +opt('idle', 4), QUIET = +opt('quiet', 1500), BAR = +opt('bar', 50), LABEL = opt('label', '');
const CPU = +opt('cpu', SETUP === 'phone' ? 4 : 1), CAP = +opt('cap', 5400);
const FAMILIES = opt('rows', null) ? opt('rows').split(',').map(k => [k]) : [['wgSpan', 'wgChord'], ['paxLen', 'halfW', 'boomLen'], ['s1X', 'engY', 'stX']];
const PLAYER = ['reproduction', 'story', 'original', 'wip'];
const LISTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds/lists/plane_lists.json'), 'utf8')).planes;
const has = p => p.file && fs.existsSync(path.join(ROOT, p.file));
const num = s => +String(s).replace(/^list:/, '');
const want = opt('planes', null) ? opt('planes').split(',').map(num) : null;
const PLANES = want ? want.map(n => LISTS.find(p => p.n === n)).filter(p => p && has(p))
  : LISTS.filter(p => has(p) && !p.rides && (flag('all') || PLAYER.includes(p.list)));
const PROF = (opt('prof', '') || '').split(',').filter(Boolean).map(num);
const OUT = path.resolve(opt('out', path.join(__dirname, 'slider_sweep_' + SETUP + '_' + Date.now() + '.json')));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const r1 = x => x == null || !Number.isFinite(x) ? null : Math.round(x * 10) / 10;
const qt = (a, p) => { const s = a.filter(Number.isFinite).slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };

// ---- the page's half ---------------------------------------------------------------------------------------------------------
const HARNESS = `(() => { if (window.__SW) return 'again';
  const G = window.__SW = { lt: [], ev: [], fr: [], last: 0, st: null };
  try { new PerformanceObserver(l => l.getEntries().forEach(e => G.lt.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: false }); } catch (e) {}
  const loop = t => { if (G.last) G.fr.push([t, t - G.last]); G.last = t; if (G.fr.length > 60000) G.fr.splice(0, 30000); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  const F = window.FLIGHT_REC, e0 = F && F.event;
  if (F && e0) F.event = function (k, ms, d) { if (k === 'gedit' || k === 'gtask') G.ev.push([performance.now(), k, ms, d]); return e0.apply(F, arguments); };
  const now = () => performance.now();
  G.raf = () => new Promise(r => requestAnimationFrame(r));
  G.sleep = ms => new Promise(r => setTimeout(r, ms));
  // the page quiet: no long task ending in the last q ms (and the loading screen not up), or the cap
  G.quiet = async (t0, q, cap) => { for (;;) { await G.sleep(100); const t = now(); const L = G.lt.filter(x => x[0] + x[1] > t0);
    const last = L.length ? Math.max(...L.map(x => x[0] + x[1])) : t0; const busy = !!(window.BOOT && ((BOOT.state && BOOT.state !== 'gone') || (BOOT.busy && BOOT.busy())));
    if ((!busy && t - last >= q) || t - t0 > cap) return last; } };
  G.idle = async s => { const t0 = now(); await G.sleep(s * 1000); const fr = G.fr.filter(f => f[0] > t0).map(f => +f[1].toFixed(1));
    let st = null; try { const R = window.FLIGHT_REC; st = R && R.stats ? R.stats(s * 1000) : null; } catch (e) {}
    return { n: fr.length, fr, stats: st ? { fps: st.fps, med: st.med, p90: st.p90, max: st.max, work: st.work } : null }; };
  // THE FRAME'S CENSUS: the context's own draw calls counted over n frames (the wrappers are taken off after)
  G.census = async n => { const P = WebGL2RenderingContext.prototype, K = ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements'], o = {}; let calls = 0, tris = 0;
    for (const k of K) { o[k] = P[k]; }
    P.drawElements = function (m, c) { calls++; if (m === 4) tris += c / 3; return o.drawElements.apply(this, arguments); };
    P.drawRangeElements = function (m, a, b, c) { calls++; if (m === 4) tris += c / 3; return o.drawRangeElements.apply(this, arguments); };
    P.drawArrays = function (m, f, c) { calls++; if (m === 4) tris += c / 3; return o.drawArrays.apply(this, arguments); };
    P.drawElementsInstanced = function (m, c, t, of, ic) { calls++; if (m === 4) tris += c / 3 * ic; return o.drawElementsInstanced.apply(this, arguments); };
    P.drawArraysInstanced = function (m, f, c, ic) { calls++; if (m === 4) tris += c / 3 * ic; return o.drawArraysInstanced.apply(this, arguments); };
    await G.raf(); calls = 0; tris = 0; for (let i = 0; i < n; i++) await G.raf();
    for (const k of K) P[k] = o[k];
    const r = window.FLYDIY_RENDERER, m = r && r.info && r.info.memory, c = r && r.domElement;
    return { draws: Math.round(calls / n), tris: Math.round(tris / n), geometries: m ? m.geometries : null, textures: m ? m.textures : null, programs: r && r.info.programs ? r.info.programs.length : null, canvas: c ? [c.width, c.height] : null }; };
  // the aeroplane on the stand (the editor's scene, visible)
  G.plane = () => { const S = window.CAGE_SCENE; if (!S) return null; let meshes = 0, tris = 0, verts = 0;
    const walk = o => { if (!o.visible) return; if (o.isMesh && o.geometry && o.geometry.attributes && o.geometry.attributes.position) { const g = o.geometry, n = g.attributes.position.count; meshes++; verts += n; tris += (g.index ? g.index.count : n) / 3 * (o.isInstancedMesh ? o.count : 1); }
      for (const c of o.children) walk(c); }; walk(S); return { meshes, tris: Math.round(tris), verts }; };
  const PE = (t, o) => { try { return new PointerEvent(t, Object.assign({ bubbles: true, pointerId: 7, pointerType: 'touch' }, o || {})); } catch (e) { return new Event(t, { bubbles: true }); } };
  // THE DRAG'S TICKS (the release is G.dragEnd: a profile stops between the two)
  G.dragTicks = async (k, sec) => {
    const el = document.getElementById('p_' + k); if (!el || el.type !== 'range' || el.disabled) return { k, missing: true };
    const lo = +el.min, hi = +el.max, stp = +el.step || 0.001, x0 = +el.value, dir = (hi - x0) > (x0 - lo) ? 1 : -1, span = Math.abs(dir > 0 ? hi - x0 : x0 - lo) * 0.5;
    const snap = v => { const dec = (String(el.step).split('.')[1] || '').length; v = lo + Math.round((v - lo) / stp) * stp; return dec ? +v.toFixed(dec + 1) : v; };
    const U = window.CAGE_UI, pv = U && U.preview;
    const S = G.st = { k, el, x0, ev0: G.ev.length, pv0: pv ? pv.n : 0, df0: pv ? pv.deform : 0, tk: [], fr: [], first: null, steps: Math.round(span / stp) };
    // between two frames, as a pointer's events arrive: the press, then the first tick
    await G.raf(); await G.sleep(3);
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: false }));
    const N = Math.max(8, Math.round(sec * 60)); let i = 1, last = x0;
    const tD = S.tD = now();
    { const v = snap(x0 + dir * span * i / N); el.value = String(v); last = +el.value; const a = now(); el.dispatchEvent(new Event('input', { bubbles: true })); S.tk.push(now() - a); }
    const f1 = await G.raf(), f2 = await G.raf();          // the frame that draws the tick; its presentation
    S.first = f2 - tD; S.fr.push(f1 - (G.fr.length > 1 ? G.fr[G.fr.length - 2][0] : f1 - 16.7), f2 - f1);
    let tLast = f2;
    while (now() - tD < sec * 1000 && i < N) {
      i = Math.min(N, Math.max(i + 1, Math.round((now() - tD) / (sec * 1000) * N)));
      const v = snap(x0 + dir * span * i / N);
      if (v !== last) { el.value = String(v); last = +el.value; const a = now(); el.dispatchEvent(new Event('input', { bubbles: true })); S.tk.push(now() - a); }
      const t = await G.raf(); S.fr.push(t - tLast); tLast = t;
    }
    S.tE = now();
    return { k, ticks: S.tk.length };
  };
  G.dragEnd = async quiet => {
    const S = G.st, el = S.el, U = window.CAGE_UI, pv = U && U.preview; G.st = null;
    const pvN = pv ? pv.n - S.pv0 : null, dfN = pv ? pv.deform - S.df0 : null;
    const longsDrag = G.lt.filter(x => x[0] + x[1] > S.tD && x[0] < S.tE).map(x => +x[1].toFixed(0));
    const rl = U && U.release, rl0 = rl ? rl.n : 0, rw0 = rl ? rl.whole : 0;
    const tR = now();
    window.dispatchEvent(PE('pointerup')); el.dispatchEvent(new Event('change', { bubbles: true }));
    const rel = now() - tR;
    const end = await G.quiet(tR, quiet, 60000);
    const relHow = !rl ? null : rl.n > rl0 ? 'partial' : rl.whole > rw0 ? 'whole' : 'none';
    const longs = G.lt.filter(x => x[0] + x[1] > tR).map(x => [+(x[0] - tR).toFixed(0), +x[1].toFixed(0)]);
    const evs = G.ev.slice(S.ev0).map(e => [+(e[0] - tR).toFixed(0), e[1], +(+e[2]).toFixed(1), e[3]]);
    // back at the start by a plain input + change (no pointer down): the whole build, as a click or a typed value
    const x1 = +el.value; el.value = String(S.x0);
    const tB = now(); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); const whole = now() - tB;
    const endB = await G.quiet(tB, quiet, 60000);
    return { k: S.k, x0: S.x0, x1, steps: S.steps, ticks: S.tk, frames: S.fr, first: S.first, previews: pvN, deforms: dfN, longsDrag, release: rel, freeze: Math.max(rel, end - tR), relHow, longs, ev: evs,
      whole, wholeFreeze: Math.max(whole, endB - tB) };
  };
  G.load = async p => { const t0 = now(); G.alerts = window.__ALERTS ? window.__ALERTS.length : 0;
    await Promise.resolve(GARAGE_SPEC.openListed(p)); const end = await G.quiet(t0, 2000, 180000);
    if (window.CAGE_UI && CAGE_UI.releaseFlush) CAGE_UI.releaseFlush();
    const l = GARAGE_SPEC.listed && GARAGE_SPEC.listed();
    return { ms: Math.round(end - t0), file: l ? l.file : null, alerts: (window.__ALERTS || []).slice(G.alerts) }; };
  return 'ok'; })()`;

function selfTop(p, n) {
  const byId = new Map(p.nodes.map(x => [x.id, x])), self = new Map(), file = new Map(); let total = 0;
  for (let i = 0; i < p.samples.length; i++) { const nd = byId.get(p.samples[i]), us = p.timeDeltas[i + 1] || 0; if (!nd) continue;
    const cf = nd.callFrame; if (/^\((idle|program|root)\)/.test(cf.functionName || '')) continue;
    const f = (cf.url || '').split('/').pop().split('?')[0] || '(native)', k = (cf.functionName || '(anon)') + ' ' + f + ':' + (cf.lineNumber + 1);
    total += us; self.set(k, (self.get(k) || 0) + us); file.set(f, (file.get(f) || 0) + us); }
  const top = m => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, us]) => [k, +(us / 1000).toFixed(1)]);
  return { totalMs: +(total / 1000).toFixed(1), fn: top(self), file: top(file) };
}

function table(R) {
  const rows = R.planes.filter(p => !p.error && p.worst != null).sort((a, b) => b.worst - a.worst), L = [];
  const fails = rows.filter(p => p.worst > R.bar).length;
  L.push('# Garage sliders, per aeroplane: ' + R.setup + (R.label ? ' (' + R.label + ')' : ''));
  L.push('');
  L.push(R.what);
  L.push('');
  L.push('The bar (PERF-OBJECTIVES row 1): no frame over ' + R.bar + ' ms while a slider moves. **' + fails + ' of ' + rows.length + ' aeroplanes fail.** Times in ms; frame = the interval between two frames during the drag (median / worst); input = the first tick to its frame on screen; freeze = the release to the page quiet; whole = a plain build of the row.');
  L.push('');
  L.push('| # | aeroplane | bar | worst drag frame | idle frame p50 / max | draws / tris a frame | plane tris | ' + R.families.map(f => f + ': frame med / worst, input, tick, path, freeze, whole').join(' | ') + ' |');
  L.push('|---|---|---|---|---|---|---|' + R.families.map(() => '---').join('|') + '|');
  for (const p of rows) L.push('| list:' + p.n + ' | ' + p.name + ' | ' + (p.worst > R.bar ? '**FAIL**' : 'pass') + ' | ' + p.worst + ' | ' + (p.idle ? p.idle.p50 + ' / ' + p.idle.max : '') + ' | ' +
    (p.census ? p.census.draws + ' / ' + p.census.tris : '') + ' | ' + (p.plane ? p.plane.tris : '') + ' | ' +
    p.drags.map(d => d.missing ? '(no ' + d.k + ')' : d.k + ': ' + d.frameMed + ' / ' + d.frameMax + ', ' + d.first + ', ' + d.tickMed + ', ' + d.path + ', ' + d.freeze + ', ' + d.wholeFreeze).join(' | ') + ' |');
  for (const p of R.planes.filter(p => p.error)) L.push('| list:' + p.n + ' | ' + p.name + ' | not measured | ' + String(p.error).slice(0, 120).replace(/\|/g, '/') + ' |');
  return L.join('\n') + '\n';
}

(async () => {
  if (!PLANES.length) { console.error('slider_sweep: no aeroplane to measure'); process.exit(2); }
  const phone = SETUP === 'phone';
  const q = [phone ? 'profile=phone&idle=0' : 'mode=sandbox', opt('query', '')].filter(Boolean).join('&');
  const size = opt('size', phone ? '412x915' : '5120x1271');
  const what = 'PERF-SLIDERS slider sweep, ' + SETUP + (LABEL ? ' ' + LABEL : '') + ': ' + PLANES.length + ' aeroplanes, ' + FAMILIES.length + ' sliders each, ' + SEC + ' s a drag' +
    (phone ? ', a 412x915 phone viewport at DPR 2.625, CPU throttle ' + CPU + 'x' : ', the desktop garage at ' + size) + ', ?' + q;
  const R = { date: new Date().toISOString(), setup: SETUP, label: LABEL, what, q, size, cpu: CPU, sec: SEC, bar: BAR, headed: !flag('headless'), families: FAMILIES.map(f => f[0]), planes: [] };
  try { R.sha = require('child_process').execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim(); } catch (e) {}
  const save = () => { fs.writeFileSync(OUT, JSON.stringify(R, null, 1)); fs.writeFileSync(OUT.replace(/\.json$/, '') + '.md', table(R)); };
  // the page's first log line and its title say who runs and what (the user watches the window); an alert never blocks
  const init = 'console.log(' + JSON.stringify(what) + '); window.alert = m => { (window.__ALERTS = window.__ALERTS || []).push(String(m)); };' +
    'addEventListener("DOMContentLoaded", () => { try { document.title = "PERF-SLIDERS slider sweep (' + SETUP + ') - " + document.title; } catch (e) {} });';
  const first = PLANES[0];
  const rig = await PR.start({ name: 'PERF-SLIDERS', headed: !flag('headless'), live: true, size, q, cap: CAP, init, boot: 420,
    seed: { 'flydiy.wip': fs.readFileSync(path.join(ROOT, first.file), 'utf8') },
    metrics: phone ? { width: 412, height: 915, deviceScaleFactor: 2.625, mobile: true } : null, touch: phone });
  const log = rig.log;
  log(what);
  let code = 0;
  try {
    R.gpu = rig.gpu; R.bootS = rig.bootS;
    await sleep(6000);
    log('harness ' + await rig.ev(HARNESS));
    R.meta = await rig.J("({ profile: window.PROFILE && (typeof PROFILE.name === 'function' ? PROFILE.name() : PROFILE.name), dpr: devicePixelRatio, view: [innerWidth, innerHeight], vis: document.visibilityState, focus: document.hasFocus(), build: window.FLYDIY_BUILD || null, body: document.body.className })");
    log('page ' + JSON.stringify(R.meta));
    if (CPU > 1) { await rig.cmd('Emulation.setCPUThrottlingRate', { rate: CPU }); log('CPU throttle ' + CPU + 'x'); }
    await sleep(2000);
    let n = 0;
    for (const p of PLANES) {
      const row = { n: p.n, name: p.name, list: p.list, file: p.file, drags: [] }; n++;
      try {
        if (n > 1) { row.load = await rig.J('__SW.load(' + JSON.stringify({ file: p.file, n: p.n, name: p.name }) + ')');
          if (row.load.file !== p.file) throw new Error('not on the stand (' + JSON.stringify(row.load).slice(0, 200) + ')'); }
        await sleep(1500);
        row.plane = await rig.J('__SW.plane()');
        const id = await rig.J('__SW.idle(' + IDLE + ')');
        row.idle = { n: id.n, p50: r1(qt(id.fr, 0.5)), p95: r1(qt(id.fr, 0.95)), max: r1(Math.max(...id.fr, 0)), stats: id.stats };
        row.census = await rig.J('__SW.census(30)');
        for (const fam of FAMILIES) {
          let d = null;
          for (const k of fam) { const t = await rig.J('__SW.dragTicks(' + JSON.stringify(k) + ', ' + SEC + ')'); if (!t.missing) { d = await rig.J('__SW.dragEnd(' + QUIET + ')'); break; } }
          if (!d) { row.drags.push({ k: fam[0], missing: true }); continue; }
          const fr = d.frames.slice(1);          // (the first entry is the frame the press fell in)
          Object.assign(d, { n: d.ticks.length, tickMed: r1(qt(d.ticks, 0.5)), tickMax: r1(Math.max(...d.ticks)), frameMed: r1(qt(fr, 0.5)), frameP95: r1(qt(fr, 0.95)), frameMax: r1(Math.max(...fr)),
            first: r1(d.first), release: r1(d.release), freeze: r1(d.freeze), whole: r1(d.whole), wholeFreeze: r1(d.wholeFreeze),
            path: d.previews == null ? '?' : d.deforms ? 'deform' : d.previews >= d.ticks.length ? 'preview' : d.previews ? 'mixed' : 'whole' });
          d.ticks = d.ticks.map(r1); d.frames = d.frames.map(r1);
          row.drags.push(d);
        }
        const got = row.drags.filter(d => !d.missing);
        row.worst = got.length ? Math.max(...got.map(d => d.frameMax)) : null;
        row.pass = row.worst != null && row.worst <= BAR;
        if (PROF.includes(p.n)) {
          row.prof = {};
          await rig.cmd('Profiler.enable'); await rig.cmd('Profiler.setSamplingInterval', { interval: 250 });
          for (const d0 of got) {
            await rig.cmd('Profiler.start');
            const t = await rig.J('__SW.dragTicks(' + JSON.stringify(d0.k) + ', ' + SEC + ')');
            const pr = await rig.cmd('Profiler.stop');
            await rig.J('__SW.dragEnd(' + QUIET + ')');
            if (pr.result && pr.result.profile) { const pf = OUT.replace(/\.json$/, '') + '_list' + p.n + '_' + d0.k + '.cpuprofile'; fs.writeFileSync(pf, JSON.stringify(pr.result.profile));
              const s = selfTop(pr.result.profile, 30); s.ticks = t.ticks; s.sec = SEC; s.file_ = path.basename(pf); row.prof[d0.k] = s; }
          }
          await rig.cmd('Profiler.disable');
        }
      } catch (e) { row.error = String(e && e.message || e).slice(0, 400); }
      R.planes.push(row); save();
      log((n + '/' + PLANES.length).padEnd(6) + ('list:' + p.n).padEnd(8) + String(p.name).slice(0, 26).padEnd(27) + (row.error ? 'ERROR ' + row.error
        : (row.pass ? 'pass ' : 'FAIL ') + 'worst ' + row.worst + '  idle ' + row.idle.p50 + '/' + row.idle.max + '  draws ' + row.census.draws + ' tris ' + row.census.tris + '  | ' +
          row.drags.map(d => d.missing ? d.k + ' -' : d.k + ' fr ' + d.frameMed + '/' + d.frameMax + ' in ' + d.first + ' tk ' + d.tickMed + ' ' + d.path + ' frz ' + d.freeze + ' whole ' + d.wholeFreeze).join('  | ')));
    }
    R.errors = rig.errors.slice(0, 40);
    if (CPU > 1) await rig.cmd('Emulation.setCPUThrottlingRate', { rate: 1 });
    save();
    console.log('\n' + table(R));
    const fails = R.planes.filter(p => p.error || !p.pass).length;
    log('-> ' + OUT + '  (' + fails + ' of ' + R.planes.length + ' over the bar or not measured)');
    if (flag('gate') && fails) code = 1;
  } catch (e) { log('FAILED ' + (e && e.stack || e)); try { log('WHY ' + JSON.stringify(await rig.why())); } catch (x) {} R.failed = String(e && e.message || e); save(); code = 1; }
  await rig.close();
  process.exit(code);
})().catch(e => { console.error('slider_sweep: ' + (e && e.stack || e)); process.exit(1); });
