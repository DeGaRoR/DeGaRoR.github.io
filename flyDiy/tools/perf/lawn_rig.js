#!/usr/bin/env node
// lawn_rig.js - THE MOWN GRASS AS CARDS, VARIANT BY VARIANT (GRASS-CARDS, 16 Nov 2026; the user: "when the grass is really small,
// they look just like little dots ... all mown grass needs to be addressed through grass cards ... we should do studies on that").
// One boot through tools/page_rig.js (RIG-PROCEDURE.md: the server, Chrome, the real-GPU check, the wipe, Go until flying, pause,
// devFree, the AA.render grab, WHY on a miss, the hard cap), then per EYE x per CONFIG:
//   config   the lawn (cover_ring layer 'lawn': on/off + its dials) and the field's floor (minH), set live through TREE_FILL
//            (lawnOn / lawn().set / grass().set), both rings replanted, then the rings idle (nothing queued, no dirty block)
//   a still  <out>/<eye>__<config>.jpg (page_rig's grab: readPixels after FLYDIY_AA.render)
//   cost     over --frames frames: the lawn's draws, instances and triangles submitted a frame (every draw whose userData.lawn
//            is set) and, with --gpu, each lawn draw in its own TIME_ELAPSED query, summed a frame (median) = the lawn's GPU ms;
//            the field's the same (userData.coverKind 'cover', not lawn); the ring stats (cells, held, plantMs, last cell ms)
// Eyes: HOME's cockpit at the stand, HOME's paved runway side (8 m off the edge, 1.8 m up: its mown band), a low pass over HOME's
// threshold (10 m), and the user's Cabin Strip back eye (the 15 Nov purple mask: the aircraft placed there first).
// Usage: node tools/perf/lawn_rig.js --out <dir> [--gpu] [--frames 60] [--cap 2500] [--eyes cockpit,rwyside,app10,cabin]
//          [--configs master,edge,A,B,C,D,phone] [--size 1600x900] [--q ''] [--at HH:MM (start no earlier)] [--until HH:MM (hard end)]
//          [--latest HH:MM (the GPU not free by then: skip)]
// A GPU RUN NEEDS A0's SLOT: the script takes `boxlock.sh take gpu GRASS-CARDS` itself (waiting while the GPU is held), drops it on
// exit, and ends itself before --until.
'use strict';
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const OUT = path.resolve(opt('out', 'lawn_rig_out')), GPU = flag('gpu'), FR = +opt('frames', 60);
const EYES = opt('eyes', 'cockpit,rwyside,app10,cabin').split(','), CONFIGS = opt('configs', 'master,edge,A,B,C,D,phone').split(',');
const sleep = ms => new Promise(r => setTimeout(r, ms));
// HH:MM -> the NEXT such time (armed at 22:00 for 06:00 means tomorrow's; a time up to 2 h past is today's, the slot running)
const hm = s => { if (!s) return null; const [h, m] = s.split(':').map(Number), d = new Date(); d.setHours(h, m, 0, 0); if (d.getTime() < Date.now() - 2 * 3600e3) d.setDate(d.getDate() + 1); return d.getTime(); };
const AT = hm(opt('at', null)), UNTIL = hm(opt('until', null)), LATEST = hm(opt('latest', null));   // --latest HH:MM: the GPU not free by then = skip the slot (A0)
const BOX = 'D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh';   // (the main checkout's: the locks live there, whatever the worktree)
fs.mkdirSync(OUT, { recursive: true });
const LOG = [], log = s => { const l = new Date().toTimeString().slice(0, 8) + ' ' + s; LOG.push(l); console.log(l); try { fs.appendFileSync(path.join(OUT, 'lawn_rig.log'), l + '\n'); } catch (e) {} };

// THE CONFIGS: today's master (the 8 cm tufts, no floor), grass-edge (the 30 cm floor: the user's stopgap), and the lawn's four
// (density x length) + the phone's (the GRAPHICS 'lean' column). `field` sets the grass field; `lawn` sets the lawn (null: off)
const CFG = {
  master: { label: 'today (8 cm tufts)', field: { minH: 0 }, lawn: null },
  edge:   { label: 'grass-edge (30 cm floor)', field: { minH: 0.3 }, lawn: null },
  A:      { label: 'A: 6 cm, 80 cards/m2', field: { minH: 0.3 }, lawn: { cutH: 0.06, dens: 80, reach: 40, near: 10 } },
  B:      { label: 'B: 8 cm, 150 cards/m2', field: { minH: 0.3 }, lawn: { cutH: 0.08, dens: 150, reach: 40, near: 10 } },
  C:      { label: 'C: 12 cm, 150 cards/m2', field: { minH: 0.3 }, lawn: { cutH: 0.12, dens: 150, reach: 40, near: 10 } },
  D:      { label: 'D: 10 cm, 300 cards/m2, 20 m reach', field: { minH: 0.3 }, lawn: { cutH: 0.10, dens: 300, reach: 20, near: 6 } },
  phone:  { label: 'phone: B at 60 cards/m2, 20 m reach', field: { minH: 0.3 }, lawn: { cutH: 0.08, dens: 60, reach: 20, near: 6 } },
  // the final (the 12:40 slot): what SHIPS - the build's own defaults, nothing set - and the same build with the lawn off (?lawn=0's A/B)
  ship:   { label: 'shipped (the build defaults)', field: {}, lawn: {} },
  off:    { label: 'shipped, lawn off', field: {}, lawn: null },
};

// the page's instrument: the lawn's and the field's draws counted (and timed with --gpu), the rings idle, the eyes
const INSTRUMENT = `(() => {
  if (window.__LWN) return 'have';
  const FP = window.FLIGHT_PROBE, R = FP.renderer(), gl = R.getContext(), X = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const S = { on: false, time: false, frame: 0, pending: [], acc: { lawn: [], field: [] }, n: { lawn: [0, 0, 0], field: [0, 0, 0] } };
  const rbd = R.renderBufferDirect;
  const which = o => !o || !o.userData ? null : o.userData.lawn ? 'lawn' : o.userData.coverKind === 'cover' ? 'field' : null;
  R.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
    const w = S.on ? which(object) : null; if (!w) return rbd.apply(this, arguments);
    const n = object.isInstancedMesh ? object.count : 1, idx = geometry && geometry.index ? geometry.index.count : (geometry && geometry.attributes.position ? geometry.attributes.position.count : 0);
    const c = S.n[w]; c[0]++; c[1] += n; c[2] += n * idx / 3;
    if (!S.time || !X) return rbd.apply(this, arguments);
    const q = gl.createQuery(); gl.beginQuery(X.TIME_ELAPSED_EXT, q); const r = rbd.apply(this, arguments); gl.endQuery(X.TIME_ELAPSED_EXT); S.pending.push({ q, f: S.frame, w }); return r;
  };
  const poll = () => { const keep = []; for (const h of S.pending) { if (gl.getQueryParameter(h.q, gl.QUERY_RESULT_AVAILABLE)) {
      const a = S.acc[h.w]; a[h.f] = gl.getParameter(X.GPU_DISJOINT_EXT) ? NaN : (a[h.f] || 0) + gl.getQueryParameter(h.q, gl.QUERY_RESULT) / 1e6; gl.deleteQuery(h.q); } else keep.push(h); } S.pending = keep; };
  const med = a => { const b = a.filter(x => x === x).sort((x, y) => x - y); return b.length ? +b[b.length >> 1].toFixed(3) : null; };
  const cost = (n, time) => new Promise(res => {
    const REC = window.FLIGHT_REC; const tOn = time && REC && REC.gpuTimer ? REC.gpuTimer() : false; if (tOn) REC.gpuTimer(false);
    S.on = true; S.time = !!time && !!X; S.frame = 0; S.acc = { lawn: [], field: [] }; S.n = { lawn: [0, 0, 0], field: [0, 0, 0] };
    const tick = () => { if (S.time) poll(); S.frame++; if (S.frame < n) return requestAnimationFrame(tick);
      S.on = false; const fr = S.frame; S.time = false; let k = 0;
      const dr = () => { poll(); if (S.pending.length && ++k < 60) return requestAnimationFrame(dr); if (tOn) REC.gpuTimer(true);
        const per = w => ({ ms: time ? med(S.acc[w].slice(5).map(v => v || 0)) : null, draws: +(S.n[w][0] / fr).toFixed(1), instK: +(S.n[w][1] / fr / 1000).toFixed(1), trisM: +(S.n[w][2] / fr / 1e6).toFixed(3) });
        res({ lawn: per('lawn'), field: per('field') }); };
      requestAnimationFrame(dr); };
    requestAnimationFrame(tick); });
  const rings = () => { const T = window.TREE_FILL; return [T.cover && T.cover(), T.grass && T.grass(), T.lawn && T.lawn()].filter(Boolean); };
  const idle = () => new Promise(res => { let ok = 0; const t0 = performance.now();
    const tick = () => { const all = rings().every(r => { if (!r.get().on || r.get().off) return true; const s = r.stat(); return !s.queued && !s.dirty && !s.tierUp; });
      ok = all ? ok + 1 : 0; if (ok >= 20 || performance.now() - t0 > 60000) return res(Math.round(performance.now() - t0)); requestAnimationFrame(tick); };
    requestAnimationFrame(tick); });
  const stat = r => { if (!r) return null; const s = r.stat(); return { on: !!r.get().on, live: s.live, held: s.instances, submitted: s.submitted, draws: s.draws, lastMs: +(s.lastMs || 0).toFixed(2), maxMs: +(s.maxMs || 0).toFixed(2), meanMs: s.built ? +((s.sumMs || 0) / s.built).toFixed(2) : null, plantMs: +(s.plantMs || 0).toFixed(2) }; };
  const frame = async ms => { const REC = window.FLIGHT_REC && FLIGHT_REC.rec; if (!REC) return {}; const f0 = REC.frame; await new Promise(r => setTimeout(r, ms));
    const g = [], dt = [], calls = [], cov = []; for (let f = f0; f < REC.frame; f++) { const r = REC.row(f); if (!r || !(r.dt === r.dt)) continue; dt.push(r.dt); if (r.gpu === r.gpu) g.push(r.gpu); if (r.calls === r.calls) calls.push(r.calls); if (r.cover === r.cover) cov.push(r.cover); }
    const sum = dt.reduce((a, b) => a + b, 0); return { frameGpuMs: med(g), fps: sum ? +(1000 * dt.length / sum).toFixed(1) : null, draws: med(calls), coverCpuMs: med(cov) }; };
  window.__LWN = { cost, idle, frame, stat: () => ({ field: stat(window.TREE_FILL.grass && TREE_FILL.grass()), lawn: stat(window.TREE_FILL.lawn && TREE_FILL.lawn()) }) };
  return 'installed' + (X ? ' (timer)' : ' (no timer)');
})()`;
// the eyes: HOME's from the world itself (grass_cost.js's geometry), the Cabin Strip back eye from the brief
const LOCS = `(() => {
  const wd = FLIGHT_PROBE.world(), A = wd.aerodromes.find(a => a.id === 'HOME') || wd.aerodromes[0], H = (x, z) => wd.terrainH(x, z);
  const look = (e, t) => { const f = [t[0] - e[0], t[1] - e[1], t[2] - e[2]], l = Math.hypot(f[0], f[1], f[2]); return [Math.atan2(f[0] / l, -f[2] / l), Math.asin(f[1] / l)]; };
  const dir = [Math.cos(A.hdg), Math.sin(A.hdg)], perp = [-dir[1], dir[0]], out = {};
  const thr = [A.x - dir[0] * A.len / 2, A.z - dir[1] * A.len / 2];
  { const h = 10, d = h / Math.tan(3 * Math.PI / 180), x = thr[0] - dir[0] * d, z = thr[1] - dir[1] * d; out.app10 = { eye: [x, H(x, z) + h, z], yp: [Math.atan2(dir[0], -dir[1]), -4 * Math.PI / 180] }; }
  { const s0 = A.len * 0.15, ex = A.x + dir[0] * s0 + perp[0] * A.wid / 2, ez = A.z + dir[1] * s0 + perp[1] * A.wid / 2;
    const eye = [ex + perp[0] * 8, H(ex + perp[0] * 8, ez + perp[1] * 8) + 1.8, ez + perp[1] * 8], tx = ex + dir[0] * 25, tz = ez + dir[1] * 25;
    out.rwyside = { eye, yp: look(eye, [tx, H(tx, tz), tz]) }; }
  return out;
})()`;
const CABIN = { eye: [2696.3, 197.03, -15925.44], yp: [Math.atan2(-0.4062, 0.9138), -0.06] };

(async () => {
  // the slot: not before --at, the GPU free, taken in our name, dropped on exit
  if (AT && Date.now() < AT) { log('waiting for ' + opt('at')); while (Date.now() < AT) await sleep(5000); }
  let took = false;
  const drop = () => { if (took) { try { execSync('bash "' + BOX + '" drop gpu GRASS-CARDS', { stdio: 'ignore' }); } catch (e) {} took = false; } };
  process.on('exit', drop); process.on('SIGINT', () => process.exit(130)); process.on('SIGTERM', () => process.exit(143));
  if (GPU) {
    for (;;) { let s = ''; try { s = execSync('bash "' + BOX + '" show', { encoding: 'utf8' }); } catch (e) { s = String(e.stdout || ''); }
      // free = no GPU bench lock and no reservation but ours (boxlock's own take waits on both, with no end: this loop has one)
      // (a reservation over 180 min old is ignored, as boxlock.sh's own take ignores it: its HH:MM, today or yesterday)
      const rv = /^RESERVED: (\S+) (\d\d):(\d\d)/m.exec(s); let resv = !!rv && rv[1] !== 'GRASS-CARDS';
      if (resv) { const t = new Date(); t.setHours(+rv[2], +rv[3], 0, 0); if (t.getTime() > Date.now()) t.setDate(t.getDate() - 1); if (Date.now() - t.getTime() > 180 * 60e3) resv = false; }
      if (!/GPU_BENCH\.lock/.test(s) && !resv) break;
      if (LATEST && Date.now() > LATEST) { log('the GPU was not free by ' + opt('latest') + ': the slot is skipped'); process.exit(4); }
      if (UNTIL && Date.now() > UNTIL - 20 * 60e3) { log('the GPU never came free before ' + opt('until') + ' - 20 min: stop'); process.exit(4); }
      log('the GPU is held: ' + s.trim().replace(/\n/g, ' | ')); await sleep(15000); }
    // THE CPU RULE (the user via A0, 17 Nov, after two thermal shutdowns: "keep CPU loads towards 80 %"): wait while the box's CPU
    // load is over --maxLoad % (60), inside the same --latest cut-off
    const MAXL = +opt('maxLoad', 60), load = () => { try { return +execSync('powershell -NoProfile -Command "(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average"', { encoding: 'utf8' }).trim(); } catch (e) { return NaN; } };
    for (let L = load(); L > MAXL; L = load()) {
      if (LATEST && Date.now() > LATEST) { log('CPU load ' + L + ' % over ' + MAXL + ' % until ' + opt('latest') + ': the slot is skipped'); process.exit(4); }
      log('CPU load ' + L + ' % > ' + MAXL + ' %: waiting'); await sleep(15000); }
    execSync('bash "' + BOX + '" take gpu GRASS-CARDS "lawn variants x eyes + GPU timer"', { stdio: 'inherit' }); took = true;
  }
  const capS = UNTIL ? Math.max(120, Math.floor((UNTIL - Date.now()) / 1000) - 90) : +opt('cap', 2500);
  log('cap ' + capS + ' s; eyes ' + EYES.join(',') + '; configs ' + CONFIGS.join(','));
  const rig = await require('../page_rig.js').start({ cap: capS, q: opt('q', ''), size: opt('size', '1280x720'), name: 'lawn_rig' });
  const rows = [];
  try {
    await rig.fly(); await rig.pause();
    log('flying, paused; gpu ' + rig.gpu + '; ' + await rig.ev(INSTRUMENT));
    const locs = await rig.J(LOCS);
    let misses = 0;
    const setCfg = async c => {
      const C = CFG[c];
      return rig.J(`(async () => { const T = window.TREE_FILL, f = T.grass && T.grass(), l = T.lawn && T.lawn();
        if (!f || !l) return { err: 'no field / no lawn ring' };
        f.set(${JSON.stringify(C.field)});
        if (${JSON.stringify(!!C.lawn)}) { l.set(${JSON.stringify(C.lawn || {})}); T.lawnOn(true); } else T.lawnOn(false);
        f.replant(); l.replant(); return { field: f.get().minH, lawn: l.get().on, dens: l.get().dens, cutH: l.get().cutH }; })()`);
    };
    for (const e of EYES) {
      let eye = null, mode = null;
      if (e === 'cockpit') mode = 'cockpit';
      // the Cabin Strip eye is far from HOME: the aircraft goes there first (the world streams round it), 12 m ahead of the eye as
      // in the user's frame; it is shot LAST, so HOME's eyes never need the aircraft back
      else if (e === 'cabin') { const f = [Math.sin(CABIN.yp[0]), -Math.cos(CABIN.yp[0])]; await rig.place(CABIN.eye[0] + f[0] * 12, CABIN.eye[2] + f[1] * 12, 0.3); await rig.pause(); eye = CABIN; }
      else eye = locs[e];
      if (!eye && !mode) { log(e + ': no such place'); continue; }
      for (const c of CONFIGS) {
        if (!CFG[c]) { log('no config ' + c); continue; }
        try {
          const set = await setCfg(c);
          if (mode) await rig.ev(`(()=>{const FP=FLIGHT_PROBE; if (FP.camModeNow()!=='${mode}') FP.camMode('${mode}'); return FP.camModeNow();})()`);
          else await rig.eye(eye.eye[0], eye.eye[1], eye.eye[2], eye.yp[0], eye.yp[1]);
          const idleMs = await rig.ev('__LWN.idle()');
          if (!mode) await rig.eye(eye.eye[0], eye.eye[1], eye.eye[2], eye.yp[0], eye.yp[1]);
          await rig.frames(30);
          const png = await rig.grab({ jpeg: 0.82 }).catch(err => ({ err: String(err) }));
          const name = e + '__' + c + '.jpg';
          if (png && png.length) fs.writeFileSync(path.join(OUT, name), png);
          const cost = await rig.ev('__LWN.cost(' + FR + ',' + (GPU ? 'true' : 'false') + ')');
          const fr = GPU ? await rig.ev('__LWN.frame(1500)') : {};
          const st = await rig.ev('__LWN.stat()');
          const row = { eye: e, config: c, label: CFG[c].label, set, idleMs, still: png && png.length ? name : null, info: png && png.info, cost, frame: fr, rings: st };
          rows.push(row); fs.writeFileSync(path.join(OUT, 'lawn_rig.json'), JSON.stringify({ base: rig.base || null, gpu: rig.gpu, frames: FR, timed: GPU, rows }, null, 1));
          log(e + ' / ' + c + ': lawn ' + JSON.stringify(cost.lawn) + ' field ' + JSON.stringify(cost.field) + ' frame ' + JSON.stringify(fr) + (png && png.info && png.info.blank ? ' BLANK' : ''));
        } catch (err) {
          misses++; log('MISS ' + misses + ' at ' + e + ' / ' + c + ': ' + (err && err.message || err)); try { log('WHY: ' + JSON.stringify(await rig.why())); } catch (x) {}
          if (misses >= 2) throw new Error('two misses: stop (RIG-PROCEDURE 4)');
        }
      }
    }
  } catch (err) {
    log('MISS: ' + (err && err.stack || err)); try { log('WHY: ' + JSON.stringify(await rig.why())); } catch (e) {}
    process.exitCode = 1;
  } finally { await rig.close().catch(() => null); drop(); }
  log('done: ' + rows.length + ' rows -> ' + OUT);
})();
