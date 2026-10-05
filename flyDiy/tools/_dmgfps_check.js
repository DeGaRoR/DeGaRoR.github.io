#!/usr/bin/env node
// GATE DMGFPS (G1805, DMG-D0; DEFORM-AND-BREAK §11.2 #5) - A LOW FRAME RATE NEVER FAKES A YIELD OR A CRASH.
//
// The physics dt is fixed: the page flies nStep = pc.steps x simRate steps of sim.step(1/60) a frame (app.js loop,
// 'G586: THE STEPS THE REAL TIME OWES'), the physics worker H.step likewise (sim_host.js, SIM_HOST_DT), and the damage
// layer reads only the solver's own step (dmgFrame's 50 ms filter on sim.step's dtFrame, armFrame once a step). So a low
// frame rate changes the BATCHING - how many steps run between two of the page's once-a-frame reads of
// sim.damage().over - never the step. This gate proves it on TREE-CRASH's own cases (tools/_treecrash_lib.js), with the
// damage layer ON (params.damage: true, as every damage gate says):
//   a. a flight into a trunk at 30 m/s, 4 m AGL (the Cub and the metal Cessna on the centreline, the Cub's wing 2.5 m out)
//   b. a legal hard landing that must not yield: the drop at FAR 23.473's limit sink (the Cub, the metal Cessna, the
//      Cessna on floats onto the water)
//   c. the water: the 5 m/s level pancake - the Cub's (on GEAR-WATER 2's wet body: skipped in a core without it, as GATE
//      TREECRASH skips it) and the Cessna on floats' (on its floats) - and the twin's float nose-in (90 km/h, 5 m/s, 20 deg)
// each flown at 60 fps (one step a read: the reference) and batched as the page batches them:
//   - the brief's nominal 2 / 5 / 10 / 30 fps: 30 / 12 / 6 / 2 steps between reads;
//   - THE PAGE'S OWN CLOCK at 2 / 5 / 10 / 30 fps, capped at 30 and at 60, at 1x and 2x: the PACE block lifted out of
//     app.js as written (GATE PACE's method) and driven with frames that long - its 4-step ceiling and its stall rule
//     (a 500 ms frame flies the cap's own steps) are the dilation, and they change the step count;
//   - THROUGH THE WORKER HOST (makeSimHost on the same sim, its H.step, its snapshot's F_CRASHED / F_DIVERGED): turns
//     of 1 and 4 steps (SIM_HOST_CATCH), the page reading the newest snapshot every 2 / 6 / 12 / 30 steps.
// Between two reads the page's reads are made as the page makes them (damage(), fault(), cgPos, cgVel, axes,
// wheelsOnGround, stats) - none may move a bit. ASSERTED, per case and schedule:
//   1. the run ends (the page sees `over`, or the run's length) at the FIRST read at or after the 60 fps run's end;
//   2. there, the state is the 60 fps run's at the same step, BITWISE: p and v (md5), the plastic work, the per-beam
//      work (G1802's DMG.wB, md5), the broken list, the yields;
//   3. the verdict (crashed, reason, at) is the 60 fps run's, and its broken list starts with the 60 fps run's;
//   4. the no-yield cases stay at zero (no yield, no work, no break, no crash) at every rate;
//   5. the velocity guard (G1801) never trips.
// Plus the anchor: the reference's own setup flies TREE-CRASH's case to the bit (the lib's atTrunk hash).
// Run: node tools/_dmgfps_check.js [--out <file.json>]   (one final `GATE DMGFPS: PASS|FAIL`; cases in child processes)
'use strict';
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const argv = process.argv.slice(2);
const L = require('./_treecrash_lib.js');
const ROOT = path.join(__dirname, '..');

// ---- the page's own clock: app.js's PACE block, lifted as written (GATE PACE's harness) ----
function paceSchedules() {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
  const tail = '    W.FLYDIY_PACE = api;\n    return api;\n  })();';
  const a = src.indexOf('  const PACE = (() => {'), b = src.indexOf(tail, a);
  if (!(a > 0 && b > a)) return null;
  const block = src.slice(a, b + tail.length);
  const make = cap => {
    const store = { 'flydiy.gfx': JSON.stringify({ pv: 7, fps: cap, fpsOwn: true }) }, clock = { t: 0 };
    const window = { document: { hidden: false, addEventListener: () => {} }, navigator: { webdriver: false, userAgent: 'Chrome' },
      location: { search: '' }, localStorage: { getItem: k => (k in store ? store[k] : null) }, FLYDIY_AA: { autoTarget: () => {}, autoState: () => ({ on: true, probing: false }) } };
    return new Function('window', 'performance', block + '\nreturn PACE;')(window, { now: () => clock.t });
  };
  const out = [];
  for (const cap of [30, 60]) for (const fps of [30, 10, 5, 2]) {
    const P = make(cap), iv = 1000 / fps, stepMs = 3.5, steps = [];
    let t = 1000;
    for (let f = 0; f < 80; f++) { t += iv; const fr = P.frame(t); if (fr) { steps.push(fr.steps); P.end(iv, fr.steps * stepMs, fr.steps, t); } }
    const st = steps.slice(4, 40);   // the steady frames (the first are the clock's own start)
    for (const rate of [1, 2]) out.push({ name: 'page ' + fps + ' fps, cap ' + cap + (rate > 1 ? ', 2x' : ''), fps, cap, rate, seq: st.map(n => n * rate) });
  }
  return out;
}

// ---- the cases: TREE-CRASH's (tools/_treecrash_lib.js), set up statement for statement; `go` returns the sim at the
// moment the page starts flying it (a drop's settle and a placement are the setup, not frames) and the steps to fly ----
const CASES = {
  'crash-cub': { label: 'the Cub into a trunk at 30 m/s, the centreline', key: 'cub', kind: 'trunk', o: { D: 40, agl: 4, V: 30, thr: 0, secs: 5, off: 0 } },
  'crash-metal': { label: 'the metal Cessna into a trunk at 30 m/s, the centreline', key: 'metal', kind: 'trunk', o: { D: 40, agl: 4, V: 30, thr: 0, secs: 5, off: 0 } },
  // (6 s: the wing breaks at 1.37 s and the flight is over 4 s after - the wreck flies on past the trunk, never at rest)
  'wing-cub': { label: 'the Cub into a trunk at 30 m/s, the wing 2.5 m out', key: 'cub', kind: 'trunk', o: { D: 40, agl: 4, V: 30, thr: 0, secs: 6, off: 2.5 } },
  'hard-cub': { label: 'the Cub dropped at FAR 23.473\'s limit sink', key: 'cub', kind: 'hard', calm: true },
  'hard-metal': { label: 'the metal Cessna dropped at FAR 23.473\'s limit sink', key: 'metal', kind: 'hard', calm: true },
  'hard-floats': { label: 'the Cessna on floats dropped onto the water at FAR 23.473\'s limit sink', key: 'floats', kind: 'hard', calm: true },
  'pancake-cub': { label: 'the Cub\'s 5 m/s level pancake on the water', key: 'cub', kind: 'water', o: { V: 0.3, sink: 5, pitch: 0, secs: 4 }, wet: true },
  'pancake-floats': { label: 'the Cessna on floats\' 5 m/s level pancake on the water', key: 'floats', kind: 'water', o: { V: 0.3, sink: 5, pitch: 0, secs: 4 } },
  'nosein-twin': { label: 'the twin\'s float nose-in (90 km/h, 5 m/s, 20 deg)', key: 'twinFloats', kind: 'water', o: { V: 90 / 3.6, sink: 5, pitch: 20, secs: 4 } },
};
// `hook(sim, def, world)`: called on the sim as it is made, before its setup (the worker host is made on it there: its own
// fresh() resets and places the sim, and the setup that follows resets and places it again, as the case says)
function go(c, hook) {
  const C = L.core(), k = c.key, o = c.o || {}, mk = (def, W) => { const s = C.makeSim(def, W); if (hook) hook(s, def, W); return s; };
  if (c.kind === 'trunk') {   // _treecrash_lib.js atTrunk / flyRun
    const def = L.defOf(k), elev = 300, { W, TH, strip } = L.flatWorld(elev), sim = mk(def, W);
    sim.reset(0);
    C.placeAtAerodrome(sim, Object.assign({}, strip, { elev, spawnElev: elev + (o.agl || 0) }));
    const fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg);
    if (!o.agl) for (let f = 0; f < 120; f++) sim.step(1 / 60);
    if (o.V) for (let i = 0; i < sim.n; i++) { sim.v[i*3] = o.V * fx; sim.v[i*3+2] = o.V * fz; }
    const c0 = sim.cgPos().slice(), off = o.off || 0, tk = { r: 0.3, h: 10.05, sink: 0 };
    const tx = c0[0] + fx * o.D - fz * off, tz = c0[2] + fz * o.D + fx * off;
    TH.set('fill:test', [tx, tz, elev - tk.sink, tk.r, elev - tk.sink + tk.h]);
    sim.ctl.thr = o.thr == null ? 0 : o.thr;
    return { sim, def, W, N: (o.secs || 8) * 60 };
  }
  if (c.kind === 'hard') {    // _treecrash_lib.js hardLanding at far473
    const def = L.defOf(k), probe = C.makeSim(def, null);
    let W, strip, sim;
    if (probe.hydro) { W = C.makeWorld(); strip = W.aerodromes.find(a => a.id === 'SEA'); sim = mk(def, W); sim.reset(0); C.placeAtAerodrome(sim, strip); }
    else { ({ W, strip } = L.flatWorld(0)); sim = mk(def, W); sim.reset(0); C.placeAtAerodrome(sim, Object.assign({}, strip, { elev: 0, spawnElev: 0 })); }
    for (let f = 0; f < 240; f++) sim.step(1 / 60);
    const sink = L.far473(k);
    for (let i = 0; i < sim.n; i++) { sim.p[i*3+1] += 0.02; sim.v[i*3] = 0; sim.v[i*3+1] = -sink; sim.v[i*3+2] = 0; }
    return { sim, def, W, N: 120, sink };
  }
  // _treecrash_lib.js waterCase
  const def = L.defOf(k), world = C.makeWorld(), sea = world.aerodromes.find(a => a.id === 'SEA');
  const sim = mk(def, world); sim.reset(0); C.placeAtAerodrome(sim, sea);
  const n = sim.n, p = sim.p, v = sim.v, [xA, , zR] = sim.axes(), c0 = sim.cgPos();
  const th = -(o.pitch || 0) * Math.PI / 180, kk = zR, cs = Math.cos(th), sn = Math.sin(th);
  for (let i = 0; i < n; i++) {
    const d = [p[i*3] - c0[0], p[i*3+1] - c0[1], p[i*3+2] - c0[2]], kd = kk[0]*d[0] + kk[1]*d[1] + kk[2]*d[2];
    const cr = [kk[1]*d[2] - kk[2]*d[1], kk[2]*d[0] - kk[0]*d[2], kk[0]*d[1] - kk[1]*d[0]];
    for (let j = 0; j < 3; j++) p[i*3+j] = c0[j] + d[j] * cs + cr[j] * sn + kk[j] * kd * (1 - cs);
  }
  const wh = world.waterH(c0[0], c0[2]);
  let yMin = Infinity; for (let i = 0; i < n; i++) yMin = Math.min(yMin, p[i*3+1] - def.nodes[i].r);
  const hl = Math.hypot(xA[0], xA[2]), V = o.V;
  for (let i = 0; i < n; i++) { p[i*3+1] += wh + 0.3 - yMin; v[i*3] = -V * xA[0] / hl; v[i*3+1] = -o.sink; v[i*3+2] = -V * xA[2] / hl; }
  sim.ctl.thr = 0;
  return { sim, def, W: world, N: (o.secs || 4) * 60 };
}

const md5 = (...bufs) => { const h = crypto.createHash('md5'); for (const b of bufs) h.update(Buffer.from(b.buffer, b.byteOffset, b.byteLength)); return h.digest('hex').slice(0, 16); };
// the page's reads once a frame (app.js loop / the HUD / the cockpit / the probe): none may move a bit
function pageReads(sim) {
  const D = sim.damage(); sim.fault && sim.fault(); sim.cgPos(); sim.cgVel(); sim.axes(); sim.wheelsOnGround(); sim.stats();
  return D;
}
const stateOf = (sim, steps) => { const D = sim.damage(), G = sim.guard ? sim.guard() : null;
  return { steps, h: md5(sim.p, sim.v), work: D.work, wB: D.wB ? md5(D.wB) : null, broken: D.broken.slice(), yields: D.yields, members: D.members,
    crashed: D.crashed, reason: D.reason, at: D.at, over: !!D.over, fault: G && G.fault ? G.fault.why : null, vPeak: G ? G.peak : null }; };

// THE REFERENCE: 60 fps, one step a read; every step's state kept. It flies on past `over` to the case's length (the
// batched runs end up to a frame later, and are compared with it at their own step); `end` is where the page would end it
function reference(c) {
  const S = go(c), sim = S.sim, rec = [stateOf(sim, 0)];
  let end = S.N;
  for (let s = 1; s <= S.N; s++) {
    sim.step(1 / 60);
    const D = pageReads(sim);
    rec.push(stateOf(sim, s));
    if (end === S.N && s < S.N && (D.over || (sim.fault && sim.fault()))) end = s;
  }
  // the lib's own hash of the last state (atTrunk: md5 of p's and v's buffers, 12 hex)
  const libHash = crypto.createHash('md5').update(Buffer.from(sim.p.buffer)).update(Buffer.from(sim.v.buffer)).digest('hex').slice(0, 12);
  return { rec, end, N: S.N, libHash };
}
// A BATCHED RUN inline: `seq` the steps a frame (cycled), the page's reads after each frame
function batched(c, seq) {
  const S = go(c), sim = S.sim;
  let s = 0, f = 0;
  const reads = [];
  while (s < S.N) {
    const k = seq[f++ % seq.length];
    for (let j = 0; j < k && s < S.N; j++) { sim.step(1 / 60); s++; }
    reads.push(s);
    const D = pageReads(sim);
    if (D.over || (sim.fault && sim.fault())) break;
  }
  return { st: stateOf(sim, s), reads };
}
// THROUGH THE WORKER HOST: makeSimHost on the same sim (keepSim), its H.step, a snapshot written after every turn of
// `turn` steps; the page reads the newest snapshot every `every` steps and stops on F_CRASHED / F_DIVERGED
function viaHost(c, turn, every) {
  const C = L.core(), SH = require(path.join(ROOT, 'src', 'viewer', 'sim_host.js'));
  let H = null;
  const S = go(c, (s, def, W) => { H = SH.makeSimHost(C, { keepSim: { def, sim: s }, day: false, withV: true, world: {} }, W); }), sim = S.sim;
  H.started = true; H.manual = true; H.hand = null; H.ap = { t: 0, box: null, phase: 'FLY', report: null };
  H.end = { air: false, wasAir: false, still: 0, over: false };
  const SN = SH.SIM_SNAP, f = new Float64Array(H.len), x = { running: true, seq: 0, wall: 0, stepMs: 0, dil: 1, droppedS: 0, maxMs: 0, ran: 0, allocs: 0, rate: 1 };
  let snapFlags = 0, snapStep = 0, flagAt = null, nextRead = every;
  const reads = [];
  while (H.steps < S.N) {
    for (let j = 0; j < turn && H.steps < S.N; j++) { H.step(true); if (H.diverged()) break; }
    x.seq++; x.ran = turn; H.write(f, x);
    snapFlags = f[SN.FLAGS]; snapStep = f[SN.STEP];
    if (flagAt === null && (snapFlags & (SN.F_CRASHED | SN.F_DIVERGED))) flagAt = snapStep;
    if (H.steps >= nextRead || H.steps >= S.N) { reads.push(H.steps); nextRead += every; if (snapFlags & (SN.F_CRASHED | SN.F_DIVERGED)) break; }
  }
  return { st: stateOf(sim, H.steps), reads, flagAt, hostSteps: H.steps };
}

// ---- a child: one case, every schedule ----
if (argv[0] === '--case') {
  const id = argv[1], c = CASES[id], C = L.core(), out = { id, label: c.label, calm: !!c.calm };
  if (c.wet && !(C.HYDRO && typeof C.HYDRO.wetBuild === 'function')) { out.skip = 'needs GEAR-WATER 2\'s wet body'; console.log('RESULT ' + JSON.stringify(out)); process.exit(0); }
  const t0 = Date.now();
  const R = reference(c);
  out.N = R.N; out.refEnd = R.end;
  const fin = R.rec[R.end];   // the 60 fps run where the page ends it
  out.ref = fin;
  // the reference's work along its steps (the plot)
  out.workTrace = R.rec.filter((r, i) => i % 3 === 0 || i === R.rec.length - 1).map(r => [r.steps, r.work, r.broken.length]);
  // the anchor: the trunk cases' setup IS TREE-CRASH's (the lib's own atTrunk, flown to the same length, hashed its way)
  if (c.kind === 'trunk') { const lib = L.atTrunk(c.key, c.o); out.anchor = { lib: lib.hash, here: R.libHash }; }
  // the inline schedules, one run per distinct step sequence (the page's clock at 2 / 5 / 10 / 30 fps flies only 1, 2, 4
  // or 8 steps a frame: its 4-step ceiling and its stall rule dilate the sim instead), each named for every case it is
  const sch = [], bySeq = new Map();
  const add = (name, seq) => { const key = seq.join(','); if (bySeq.has(key)) { bySeq.get(key).names.push(name); return; }
    const e = { name, names: [name], kind: 'inline', seq }; bySeq.set(key, e); sch.push(e); };
  for (const k of [30, 12, 6, 2]) add('nominal ' + (60 / k) + ' fps (' + k + ' steps a read)', [k]);
  for (const p of paceSchedules() || []) add(p.name, p.seq.every(x => x === p.seq[0]) ? [p.seq[0]] : p.seq);
  bySeq.delete('1'); const one = sch.findIndex(e => e.seq.length === 1 && e.seq[0] === 1); if (one >= 0) sch.splice(one, 1);   // 1 a frame IS the reference
  for (const turn of [1, 4]) for (const every of [30, 12, 6, 2]) sch.push({ name: 'worker host, turns of ' + turn + ', the page reading every ' + every, kind: 'host', turn, every });
  out.runs = sch.map(s => {
    const r = s.kind === 'host' ? viaHost(c, s.turn, s.every) : batched(c, s.seq);
    // the page's first read at or after the reference's end
    const want = r.reads.find(x => x >= R.end) ?? r.reads[r.reads.length - 1];
    const at = R.rec[r.st.steps];   // the reference at the same step
    const same = !!at && at.h === r.st.h && Object.is(at.work, r.st.work) && at.wB === r.st.wB && at.yields === r.st.yields
      && at.broken.length === r.st.broken.length && at.broken.every((b, i) => b === r.st.broken[i]);
    const verdict = r.st.crashed === fin.crashed && r.st.reason === fin.reason && Object.is(r.st.at, fin.at)
      && fin.broken.every((b, i) => b === r.st.broken[i]);
    return { name: s.names ? s.names.join(' = ') + ' [' + s.seq.join('/') + ' steps a frame]' : s.name, kind: s.kind, end: r.st.steps, want, endOk: r.st.steps === want, same, verdict, flagAt: r.flagAt ?? null,
      st: { work: r.st.work, broken: r.st.broken.length, yields: r.st.yields, members: r.st.members, crashed: r.st.crashed, reason: r.st.reason, at: r.st.at, fault: r.st.fault, vPeak: r.st.vPeak },
      dWork: r.st.work - fin.work, dBroken: r.st.broken.length - fin.broken.length };
  });
  out.secs = (Date.now() - t0) / 1000;
  console.log('RESULT ' + JSON.stringify(out));
  process.exit(0);
}

// ---- the gate ----
let checks = 0, fails = 0;
const yes = (ok, msg) => { checks++; if (!ok) fails++; console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + msg); };
const f2 = x => (x == null ? '-' : (+x).toFixed(2));
(async () => {
  const { spawn } = require('child_process');
  const ids = Object.keys(CASES), t0 = Date.now();
  const run = id => new Promise(res => {
    const ch = spawn(process.execPath, [__filename, '--case', id], { stdio: ['ignore', 'pipe', 'pipe'] });
    let so = '', se = ''; ch.stdout.on('data', d => { so += d; }); ch.stderr.on('data', d => { se += d; });
    ch.on('close', () => { const l = so.split('\n').reverse().find(x => x.indexOf('RESULT ') === 0); res(l ? JSON.parse(l.slice(7)) : { id, err: se.slice(-1200) }); });
  });
  const R = {}, q = ids.slice();
  await Promise.all([0, 1, 2, 3].map(async () => { while (q.length) { const id = q.shift(); R[id] = await run(id); } }));
  console.log('(' + ((Date.now() - t0) / 1000).toFixed(0) + ' s, ' + ids.length + ' cases, damage on)');
  const P = paceSchedules();
  yes(!!P && P.length === 16, 'the PACE block lifted out of app.js: ' + (P ? P.map(p => p.name + ' ' + [...new Set(p.seq)].join('/')).join('; ') : 'NOT FOUND'));
  for (const id of ids) {
    const r = R[id];
    console.log((r.label || id) + ':');
    if (r.err) { yes(false, 'the child ran: ' + r.err); continue; }
    if (r.skip) { console.log('  --    ' + r.skip + ' - skipped'); continue; }
    const f = r.ref;
    console.log('  the 60 fps run: ' + r.refEnd + ' of ' + r.N + ' steps' + (f.over ? ' (over: the page ends it)' : '') + '; ' + (f.crashed ? 'CRASHED (' + f.reason + ' at ' + f2(f.at) + ' s)' : 'no crash')
      + ', ' + f.members + ' members set, ' + f.broken.length + ' broken, ' + f.work.toFixed(1) + ' J; the fastest node ' + f2(f.vPeak) + ' m/s off the CG (' + (r.secs || 0).toFixed(0) + ' s)');
    if (r.anchor) yes(r.anchor.lib === r.anchor.here, 'the setup is TREE-CRASH\'s case to the bit (the lib\'s atTrunk ' + r.anchor.lib + ', here ' + r.anchor.here + ')');
    if (r.calm) yes(f.yields === 0 && f.work === 0 && f.broken.length === 0 && !f.crashed && !f.over, 'at 60 fps nothing yields (0 yields, 0 J, nothing broken, no crash)');
    else if (/crash|wing/.test(id)) yes(f.crashed && f.over, 'at 60 fps it crashes and the flight is over');
    yes(!f.fault, 'the velocity guard never trips (the fastest node ' + f2(f.vPeak) + ' m/s off the CG, the guard 150)');
    for (const x of r.runs) {
      const ok = x.endOk && x.same && x.verdict && !x.st.fault && (!r.calm || (x.st.yields === 0 && x.st.work === 0 && x.st.broken === 0 && !x.st.crashed));
      yes(ok, x.name + ': ends at step ' + x.end + (x.endOk ? ' (its first read at or after ' + r.refEnd + ')' : ' - ITS FIRST READ AT OR AFTER ' + r.refEnd + ' IS ' + x.want)
        + (x.flagAt != null ? ', the snapshot flagged at ' + x.flagAt : '')
        + '; ' + (x.same ? 'bitwise the 60 fps run there' : 'NOT THE 60 FPS RUN THERE') + ', ' + (x.verdict ? 'the same verdict' : 'A DIFFERENT VERDICT')
        + ' (' + x.st.work.toFixed(1) + ' J, ' + x.st.broken + ' broken, ' + x.st.yields + ' yields; past the 60 fps end +' + x.dWork.toFixed(3) + ' J, +' + x.dBroken + ' broken)');
    }
  }
  const outI = argv.indexOf('--out');
  if (outI >= 0) fs.mkdirSync(path.dirname(argv[outI + 1]), { recursive: true });
  if (outI >= 0) fs.writeFileSync(argv[outI + 1], JSON.stringify({ cases: R, pace: P }, null, 1));
  console.log('  ' + (checks - fails) + '/' + checks + ' checks');
  console.log('GATE DMGFPS: ' + (fails ? 'FAIL' : 'PASS'));
  process.exit(fails ? 1 : 0);
})();
