#!/usr/bin/env node
// G1818 (DMG-SKINGPU): THE WRECK'S SKIN ON THE GPU, ON THE BOX - the crash's frames with the riding on the CPU (D4b's G1869
// cuts on: the "before") and on the GPU (the "after"), and the GPU's drawn buffers read back against the CPU's riding of
// the same frame. A client of tools/live_driver.js (TAKE THE GPU LOCK FIRST: tools/perf/boxlock.sh take gpu <who>), the
// user's Cub rolled out, ?damage=1 (add simw=0 for the inline solver; without it the worker steps it):
//   SPORT=8581 DPORT=9481 UDD=C:/skgpu Q='damage=1&simw=0' node tools/live_driver.js <root> builds/cub_2026-09-20_corrected.json dev.html 8582
//   node tools/dmg_skingpu_box.js [--cmd 8582] [--boot] [--cases trunk-0,trunk-2.5,taxi,nosein] [--modes cpu,gpu] [--out file.json] [--check 15]
//        [--stills [--shots dir]] [--lose] [--flown [--secs 12]]
//   --stills: the GPU / CPU still pair of each case at rest; --lose: the context lost 20 frames into the crash, restored 30
//   later (the CPU's riding must carry on); --flown: under the worker (start the driver without simw=0), the page's own loop
// Each case staged as tools/dmg_wreck_stills.js stages it (the trunk the physics' own; the page's own solver stepped two
// steps a frame), every frame timed (the page's own rAF to rAF) and split by the flight recorder's slots and the skin
// break's own read-out; under the GPU every `check`-th frame from the first break the readback (FLYDIY_SKINGPU_CHECK: a
// stall, so the frame after it is not timed). -> per case and mode: the worst frame, p95, the impact second's mean (from
// the first break), the calm before, the wreck at rest; the readback's worst position (mm, world) and normal (deg); the
// programs three holds (renderer.info.programs) before and after.
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const W = require('./dmg_wreck_stills.js');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// the page's crash, timed: W.pageStage's stepper (dmg_wreck_stills.js pageRunOn) with the readback between frames
async function pageRunGpu(o) {
  const P = FLIGHT_PROBE, sim = P.sim(), step = window.__d4bStep || sim.step;
  const raf = () => new Promise(r => requestAnimationFrame(() => r()));
  const FRr = window.FLIGHT_REC && window.FLIGHT_REC.rec, C = FRr ? FRr.COLS : null, col = k => C ? C.indexOf(k) : -1;
  const R3 = window.FLYDIY_RENDERER, progs0 = R3 && R3.info && R3.info.programs ? R3.info.programs.length : null;
  const trace = [], chk = { n: 0, dP: 0, dN: 0, over: 0, ambiguous: 0, verts: 0, nanG: 0, at: null, err: null };
  let s = 0, settled = 0, t1 = performance.now(), first = -1, skip = false, since = 0;
  const inline = !sim.dmgState;
  for (; s < (o.steps || 1200); s += 2) {
    const p0 = performance.now();
    if (inline) { step(1 / 60); step(1 / 60); }
    const phys = performance.now() - p0;
    await raf();
    const t2 = performance.now(), ms = t2 - t1; t1 = t2;
    const f = FRr ? FRr.frame - 1 : -1, v = k => (f >= 0 && col(k) >= 0 ? +FRr.val(f, col(k)).toFixed(2) : null);
    const SB2 = window.FLYDIY_SKINBREAK_STATS ? window.FLYDIY_SKINBREAK_STATS() : null, M = SB2 ? SB2.ms : {};
    const D = sim.damage(), nb = D.broken.length;
    if (nb > 0 && first < 0) first = trace.length;
    if (!skip) trace.push({ t: +sim.t.toFixed(3), ms: +ms.toFixed(2), phys: +phys.toFixed(2), scene: v('scene'), render: v('render'), shader: v('shader'), shadow: v('shadow'), work: v('work'),
      brk: M.lastT === sim.t ? +(M.last || 0).toFixed(2) : 0, brkRec: M.lastT === sim.t ? +(M.lastRec || 0).toFixed(2) : 0, brkEv: M.lastT === sim.t ? +(M.lastEv || 0).toFixed(2) : 0,
      brkPose: M.lastT === sim.t ? +(M.lastPose || 0).toFixed(2) : 0, gpu: M.lastT === sim.t ? +(M.lastGpu || 0).toFixed(2) : 0, broken: nb });
    skip = false;
    // the readback, under the GPU, every `check`-th frame from the first break (its stall lands in the next frame: untimed)
    if (first >= 0) since++;
    // (--lose: the WebGL context lost on purpose mid-crash, WEBGL_lose_context; restored `o.lose` frames later - the GPU's
    // riding must end and the CPU's carry on, with no exception)
    if (o.lose && since === 20) { const X = window.FLYDIY_RENDERER.getContext().getExtension('WEBGL_lose_context'); window.__lose = { at: sim.t, ext: !!X, gpuBefore: Object.assign({}, window.FLYDIY_SKINBREAK_STATS().gpu) }; if (X) X.loseContext(); }
    if (o.lose && since === 20 + o.lose && window.__lose) { const X = window.FLYDIY_RENDERER.getContext().getExtension('WEBGL_lose_context'); window.__lose.gpuLost = Object.assign({}, window.FLYDIY_SKINBREAK_STATS().gpu);
      window.__lose.cpuPoseFrames = trace.slice(-o.lose + 2).filter(r => r.brkPose > 0).length; if (X) X.restoreContext(); }
    if (o.check && first >= 0 && since % o.check === 1 && window.FLYDIY_SKINGPU !== false && window.FLYDIY_SKINGPU_CHECK) {
      await raf();                                     // (the page's own frame posed this step: its rAF may follow the rig's)
      const c = window.FLYDIY_SKINGPU_CHECK();
      if (c.err) chk.err = c.err; else { chk.n++; chk.verts += c.verts; chk.over += c.over; chk.ambiguous += c.ambiguous; chk.nanG += c.nanG;
        if (c.dP > chk.dP) { chk.dP = c.dP; chk.at = Object.assign({ t: +sim.t.toFixed(3) }, c.at); } chk.dN = Math.max(chk.dN, c.dN); }
      skip = true; t1 = performance.now();
    }
    if (!inline) await new Promise(r => setTimeout(r, 0));
    const Wk = window.FLYDIY_WRECK_STATS ? window.FLYDIY_WRECK_STATS() : { bodies: [] };
    if ((D.over || (!D.crashed && s > 400)) && Wk.bodies.every(b => b.asleep)) { if (++settled > 40) break; }
  }
  const D = sim.damage();
  if (window.__lose) { window.__lose.lostNow = window.FLYDIY_RENDERER.getContext().isContextLost(); window.__lose.gpuEnd = Object.assign({}, window.FLYDIY_SKINBREAK_STATS().gpu); }
  return { steps: s, crashed: D.crashed, over: !!D.over, reason: D.reason, broken: D.broken.length, brokeUp: !!D.brokeUp, first, trace, check: chk, lose: window.__lose || null,
    progs: [progs0, R3 && R3.info && R3.info.programs ? R3.info.programs.length : null], skin: window.FLYDIY_SKINBREAK_STATS ? window.FLYDIY_SKINBREAK_STATS() : null };
}
// UNDER THE WORKER (--flown; a page without simw=0): the page's own loop flies the crash (tools/dmg_crash_flown.js's
// set-up: the hand on the controls, 4 m up at 30 m/s along the heading, a trunk `D` m ahead and `off` m to the side),
// every rAF timed in the page for `secs` s; the solver's steps are the worker's, the frame the page's
async function pageFlown(o) {
  const P = FLIGHT_PROBE, world = P.world();
  window.FLYDIY_WRECK = true; window.FLYDIY_SKINBREAK = true; window.FLYDIY_WRECK_FAST = true; window.FLYDIY_SKINGPU = o.gpu;
  const go = document.getElementById('bGo'); if (go && !P.over() && go.offsetParent) go.click();
  await new Promise(r => setTimeout(r, 2500));
  P.setManual(true); P.camMode('chase');
  const sim = P.sim(), [xA] = sim.axes(), hl = Math.hypot(xA[0], xA[2]), fx = -xA[0] / hl, fz = -xA[2] / hl;
  const c = sim.cgPos(), g = world.terrainH(c[0], c[2]);
  await P.place({ at: [c[0], g + 4 + (c[1] - sim.p.reduce((m, v, i) => (i % 3 === 1 ? Math.min(m, v) : m), Infinity)), c[2]], zeroV: true, dv: [o.V * fx, 0, o.V * fz] });
  const c2 = sim.cgPos(), tx = c2[0] + fx * o.D - fz * o.off, tz = c2[2] + fz * o.D + fx * o.off, gt = world.terrainH(tx, tz);
  world.treeHits.set('fill:skingpu', [tx, tz, gt, 0.3, gt + 10]);
  sim.ctl.thr = 0;
  const raf = () => new Promise(r => requestAnimationFrame(() => r()));
  const R3 = window.FLYDIY_RENDERER, progs0 = R3.info.programs.length;
  const trace = [], t0 = performance.now(); let t1 = t0, first = -1;
  while (performance.now() - t0 < o.secs * 1000) {
    await raf();
    const t2 = performance.now(), ms = t2 - t1; t1 = t2;
    const SB2 = window.FLYDIY_SKINBREAK_STATS(), M = SB2.ms, D = P.damage ? P.damage() : null, nb = sim.dmgState ? (sim.dmgState() || { br: [] }).br.length : 0;
    if (nb > 0 && first < 0) first = trace.length;
    trace.push({ t: +sim.t.toFixed(3), ms: +ms.toFixed(2), brk: M.lastT === sim.t ? +(M.last || 0).toFixed(2) : 0, gpu: M.lastT === sim.t ? +(M.lastGpu || 0).toFixed(2) : 0, broken: nb });
  }
  const SB3 = window.FLYDIY_SKINBREAK_STATS();
  return { first, trace, reason: P.damage && P.damage() ? P.damage().reason : null, broken: trace.length ? trace[trace.length - 1].broken : 0, progs: [progs0, R3.info.programs.length],
    check: null, skin: SB3 };
}
// THE STILL PAIR (--stills): the wreck at rest (the stepper done, the solver held), one camera, drawn by the GPU's riding
// and then by the CPU's (window.FLYDIY_SKINGPU flipped: the page re-poses on the flip) - two JPEGs and their difference
// in the page: the pixels whose colour moved by more than 24 (of 255) on a channel
async function pageShotPair(o) {
  const raf = () => new Promise(r => requestAnimationFrame(() => r()));
  const wait = async n => { for (let i = 0; i < n; i++) await raf(); await new Promise(r => setTimeout(r, 120)); };
  const grab = async () => { await wait(4); const c = document.querySelector('canvas'); return c.toDataURL('image/png'); };
  window.FLYDIY_SKINGPU = true; await wait(6);
  const g = await grab();
  window.FLYDIY_SKINGPU = false; await wait(6);
  const cpu = await grab();
  window.FLYDIY_SKINGPU = true; await wait(4);
  const img = async u => { const i = new Image(); i.src = u; await i.decode(); return i; };
  const A = await img(g), B = await img(cpu), W = A.width, H = A.height, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d', { willReadFrequently: true });
  x.drawImage(A, 0, 0); const a = x.getImageData(0, 0, W, H).data; x.drawImage(B, 0, 0); const b = x.getImageData(0, 0, W, H).data;
  let diff = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 24 || Math.abs(a[i + 1] - b[i + 1]) > 24 || Math.abs(a[i + 2] - b[i + 2]) > 24) diff++;
  const jpg = im => { const c = document.createElement('canvas'); c.width = W / 2; c.height = H / 2; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.85).slice(23); };
  return { gpu: jpg(A), cpu: jpg(B), diff, px: W * H, share: +(diff / (W * H)).toFixed(5) };
}
const summary = st => {
  const T = st.trace || [], i0 = st.first >= 0 ? st.first : T.length, t0 = i0 < T.length ? T[i0].t : 0;
  const win = T.filter(r => r.t >= t0 && r.t < t0 + 1 && i0 < T.length), q = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? { med: b[b.length >> 1], p95: b[Math.floor(b.length * 0.95)], max: b[b.length - 1] } : null; };
  const sum = k => +win.reduce((a, r) => a + (r[k] || 0), 0).toFixed(1);
  const ev = T.slice(i0).filter(r => r.brkEv > 1), fb = i0 < T.length ? T[i0] : null;
  return { reason: st.reason, broken: st.broken, frames: T.length, crash: q(T.slice(i0).map(r => r.ms)), worst: T.reduce((a, r) => (r.ms > a.ms ? r : a), { ms: 0 }),
    impactQ: q(win.map(r => r.ms)), firstBreak: fb && { ms: fb.ms, brk: fb.brk, rec: fb.brkRec, ev: fb.brkEv, pose: fb.brkPose, scene: fb.scene },
    events: { n: ev.length, ev: q(ev.map(r => r.brkEv)), frame: q(ev.map(r => r.ms)) }, lose: st.lose,
    impactMean: win.length ? +(win.reduce((a, r) => a + r.ms, 0) / win.length).toFixed(1) : null, impactFrames: win.length,
    impactSum: { ms: sum('ms'), phys: sum('phys'), scene: sum('scene'), brk: sum('brk'), brkRec: sum('brkRec'), brkEv: sum('brkEv'), brkPose: sum('brkPose'), gpu: sum('gpu'), render: sum('render'), shader: sum('shader') },
    calm: q(T.slice(0, i0).map(r => r.ms)), rest: q(T.slice(-60).map(r => r.ms)), check: st.check, progs: st.progs,
    gpu: st.skin && st.skin.gpu, skinMs: st.skin && st.skin.ms };
};
(async () => {
  const until = async (expr, ms, what) => { const t = Date.now(); for (;;) { const v = await W.post('/eval', expr); if (v === 'true') return; if (Date.now() - t > ms) throw new Error('timeout: ' + what); await sleep(1000); } };
  if (argv.includes('--boot')) {
    await until(`window.BOOT && BOOT.state === 'gone'`, 600000, 'the garage boot');
    await sleep(1500);
    await W.post('/run', `document.getElementById('bGo').click(); return 1;`);
    await until(`!!(window.BOOT && BOOT.state === 'gone' && /Fly the circuit/.test((document.getElementById('bGo') || {}).textContent || '') && window.FLIGHT_PROBE && FLIGHT_PROBE.model())`, 900000, 'the roll-out');
    await sleep(3000);
  }
  const out = { at: new Date().toISOString(), q: await W.post('/eval', 'location.search'), cases: {} };
  const check = +opt('check', 15);
  // UNDER THE WORKER: a page load a run (a crash ends the flight), cpu and gpu in turn, each case
  if (argv.includes('--flown')) {
    const FL = { 'trunk-0': { D: 40, off: 0, V: 30 }, 'trunk-2.5': { D: 40, off: 2.5, V: 30 } };
    for (const k of opt('cases', 'trunk-0,trunk-2.5').split(',')) for (const mode of opt('modes', 'cpu,gpu').split(',')) {
      await W.get('/reload');
      await sleep(3000);
      await until(`!!(window.BOOT && BOOT.state === 'gone')`, 600000, 'the garage boot');
      await sleep(1500);
      await W.post('/run', `document.getElementById('bGo').click(); return 1;`);
      await until(`!!(window.BOOT && BOOT.state === 'gone' && /Fly the circuit/.test((document.getElementById('bGo') || {}).textContent || '') && window.FLIGHT_PROBE && FLIGHT_PROBE.model())`, 900000, 'the roll-out');
      await sleep(3000);
      const st = await W.run(pageFlown, Object.assign({}, FL[k], { gpu: mode === 'gpu', secs: +opt('secs', 12) }));
      if (!st || !st.trace) { console.log(k + ':flown:' + mode + ' FAILED ' + JSON.stringify(st).slice(0, 500)); continue; }
      const S = summary(st);
      out.cases[k + ':flown:' + mode] = Object.assign(S, { trace: st.trace });
      console.log(k + ':flown:' + mode + ' ' + JSON.stringify({ reason: S.reason, broken: S.broken, impactMean: S.impactMean, impactFrames: S.impactFrames, crash: S.crash, worst: S.worst, calm: S.calm, rest: S.rest,
        impactSum: S.impactSum, progs: S.progs, gpu: S.gpu && { ok: S.gpu.ok, linkMs: S.gpu.linkMs, drawers: S.gpu.drawers, recs: S.gpu.recs, err: S.gpu.err, stats: S.gpu.stats } }));
      const f = opt('out', null); if (f) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(out, null, 1)); }
    }
    process.exit(0);
  }
  for (const k of opt('cases', 'trunk-0,trunk-2.5,taxi,nosein').split(',')) for (const mode of opt('modes', 'cpu,gpu').split(',')) {
    await W.post('/run', 'window.FLYDIY_WRECK_FAST = true; window.FLYDIY_SKINGPU = ' + (mode === 'gpu') + '; return 1;');
    const o = Object.assign({}, W.CASES[k].o);
    await W.run(W.pageStage, Object.assign({}, o, { placeOnly: true }));
    await W.post('/run', 'await new Promise(r => setTimeout(r, 800)); return 1;');
    const st = await W.run(pageRunGpu, Object.assign({}, o, { check: mode === 'gpu' ? check : 0, lose: mode === 'gpu' && argv.includes('--lose') ? 30 : 0 }));
    if (!st || !st.trace) { console.log(k + ':' + mode + ' FAILED ' + JSON.stringify(st).slice(0, 500)); continue; }
    const S = summary(st);
    out.cases[k + ':' + mode] = Object.assign(S, { trace: st.trace });
    if (argv.includes('--stills') && mode === 'gpu') {
      const dir = path.resolve(opt('shots', path.join(__dirname, '..', 'reports', 'evidence', 'DMG-SKINGPU')));
      fs.mkdirSync(dir, { recursive: true }); S.stills = [];
      for (const [ci, cam] of W.CASES[k].cams.slice(0, 2).entries()) {
        await W.run(W.pageView, cam);
        const P2 = await W.run(pageShotPair, {});
        if (!P2 || !P2.gpu) { S.stills.push({ cam, err: JSON.stringify(P2).slice(0, 200) }); continue; }
        const base = k + '_' + (ci + 1);
        fs.writeFileSync(path.join(dir, base + '_gpu.jpg'), Buffer.from(P2.gpu, 'base64')); fs.writeFileSync(path.join(dir, base + '_cpu.jpg'), Buffer.from(P2.cpu, 'base64'));
        S.stills.push({ cam, gpu: base + '_gpu.jpg', cpu: base + '_cpu.jpg', diffPx: P2.diff, share: P2.share });
        console.log('  still ' + base + ': ' + P2.diff + ' pixels differ (' + (P2.share * 100).toFixed(3) + ' %)');
      }
      await W.post('/run', "document.getElementById('d4bHide') && document.getElementById('d4bHide').remove(); FLIGHT_PROBE.camMode('chase'); return 1;");
    }
    console.log(k + ':' + mode + ' ' + JSON.stringify({ reason: S.reason, broken: S.broken, impactMean: S.impactMean, impactFrames: S.impactFrames, impactQ: S.impactQ, firstBreak: S.firstBreak, events: S.events, lose: S.lose, crash: S.crash, worst: S.worst, calm: S.calm, rest: S.rest,
      impactSum: S.impactSum, check: S.check, progs: S.progs, gpu: S.gpu && { ok: S.gpu.ok, linkMs: S.gpu.linkMs, drawers: S.gpu.drawers, recs: S.gpu.recs, err: S.gpu.err, stats: S.gpu.stats } }));
    const f = opt('out', null); if (f) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(out, null, 1)); }
  }
  process.exit(0);
})().catch(e => { console.log('SKINGPU_BOX_FAIL ' + (e && e.stack || e)); process.exit(1); });
