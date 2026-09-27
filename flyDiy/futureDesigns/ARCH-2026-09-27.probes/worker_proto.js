// ARCH-2026-09-27 probe (node only, not a gate): the solver + pilot in a worker_threads Worker, the "render" thread reading node positions.
// modes: inline (today: step on the render thread), sab (SharedArrayBuffer triple buffer + Atomics), post (postMessage, transferred)
'use strict';
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const now = () => Number(process.hrtime.bigint()) / 1e6;
if (!isMainThread) {
  const setup = require(workerData.dir + '/sim_setup.js');
  const S = setup(workerData);
  const N3 = S.n * 3;
  const step = () => { S.ap.update(1 / 60); S.sim.step(1 / 60); };
  for (let i = 0; i < 60; i++) step();   // JIT + settle, as the roll-out screen does
  if (workerData.mode === 'sab') {
    const ctl = new Int32Array(workerData.ctl), bufs = workerData.bufs.map(b => new Float32Array(b)), meta = new Float64Array(workerData.meta);
    parentPort.postMessage({ ready: true, n: S.n, substeps: S.substeps });
    let owed = 0, slot = 0;
    for (;;) {
      if (Atomics.load(ctl, 0) === 0 && owed === 0) Atomics.wait(ctl, 0, 0, 50);
      owed += Atomics.exchange(ctl, 0, 0);
      if (Atomics.load(ctl, 3)) break;
      if (owed <= 0) continue;
      const t0 = now(); step(); owed--; const ms = now() - t0;
      // publish into the slot the reader is not holding: triple buffer, ctl[1] = latest published, ctl[2] = reader's
      const reading = Atomics.load(ctl, 2), latest = Atomics.load(ctl, 1);
      slot = [0, 1, 2].find(k => k !== reading && k !== latest);
      const B = bufs[slot], p = S.sim.p; for (let i = 0; i < N3; i++) B[i] = p[i];
      meta[slot * 2] = now(); meta[slot * 2 + 1] = ms;
      Atomics.store(ctl, 1, slot); Atomics.add(ctl, 4, 1);
    }
    process.exit(0);
  } else {
    parentPort.postMessage({ ready: true, n: S.n, substeps: S.substeps });
    parentPort.on('message', m => {
      if (m.stop) { process.exit(0); }
      let ms = 0;
      for (let k = 0; k < m.steps; k++) { const t0 = now(); step(); ms += now() - t0; }
      const out = m.buf ? new Float32Array(m.buf) : new Float32Array(N3);
      const p = S.sim.p; for (let i = 0; i < N3; i++) out[i] = p[i];
      parentPort.postMessage({ buf: out.buffer, t: now(), ms, seq: m.seq }, [out.buffer]);
    });
  }
  return;
}
// ---- main: a synthetic render loop at `hz`, `renderMs` of busy work a frame, for `secs`
const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const mode = arg('mode', 'sab'), hz = +arg('hz', 60), renderMs = +arg('render', 8), secs = +arg('secs', 10), build = arg('build', null), worldId = arg('world', 'jolene');
const busy = ms => { const e = now() + ms; while (now() < e); };
const pct = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN; };
const report = (name, frames, extra) => {
  const dt = frames.map(f => f.dt).slice(5), phys = frames.map(f => f.phys), age = frames.map(f => f.age).filter(isFinite);
  console.log(name.padEnd(8), 'fps', (1000 / pct(dt, 0.5)).toFixed(1), '| frame dt p50/p90/max', pct(dt, .5).toFixed(1), pct(dt, .9).toFixed(1), Math.max(...dt).toFixed(1),
    '| physics on the render thread p50/max', pct(phys, .5).toFixed(3), Math.max(...phys).toFixed(3), age.length ? '| pose age p50/p90 ' + pct(age, .5).toFixed(2) + ' ' + pct(age, .9).toFixed(2) + ' ms' : '', extra || '');
};
(async () => {
  const period = 1000 / hz;
  if (mode === 'inline') {
    const setup = require(__dirname + '/sim_setup.js'); const S = setup({ build, world: worldId });
    const step = () => { S.ap.update(1 / 60); S.sim.step(1 / 60); };
    for (let i = 0; i < 60; i++) step();
    const frames = []; let acc = 0, last = now(), stepMs = [];
    const t1 = now() + secs * 1000;
    while (now() < t1) {
      const t = now(), dt = t - last; last = t; acc += dt / 1000;
      let owed = Math.min(4, Math.floor(acc * 60 + 0.25)); acc -= owed / 60; if (acc < -0.1) acc = 0;
      const a = now(); for (let k = 0; k < owed; k++) { const s0 = now(); step(); stepMs.push(now() - s0); } const phys = now() - a;
      busy(renderMs);
      frames.push({ dt, phys, age: NaN });
      const wait = period - (now() - t); if (wait > 0) busy(wait);   // vsync stand-in
    }
    report('inline', frames, '| step p50 ' + pct(stepMs, .5).toFixed(2) + ' ms, substeps ' + S.substeps + ', nodes ' + S.n);
    return;
  }
  const N3max = 400 * 3;
  const ctlB = new SharedArrayBuffer(4 * 8), ctl = new Int32Array(ctlB);
  const bufsB = [0, 1, 2].map(() => new SharedArrayBuffer(4 * N3max)), metaB = new SharedArrayBuffer(8 * 6), meta = new Float64Array(metaB);
  const w = new Worker(__filename, { workerData: { dir: __dirname, mode, ctl: ctlB, bufs: bufsB, meta: metaB, build, world: worldId } });
  const info = await new Promise(r => w.once('message', r));
  const N3 = info.n * 3, pose = new Float32Array(N3);
  const frames = []; let acc = 0, last = now(), seq = 0, inflight = 0, latest = null, stepMs = [];
  let spare = [new ArrayBuffer(4 * N3), new ArrayBuffer(4 * N3)];
  if (mode === 'post') w.on('message', m => { if (m.buf) { latest = m; inflight--; stepMs.push(m.ms); } });
  const t1 = now() + secs * 1000;
  const tick = () => new Promise(r => setImmediate(r));
  Atomics.store(ctl, 2, -1); Atomics.store(ctl, 1, -1);
  while (now() < t1) {
    const t = now(), dt = t - last; last = t; acc += dt / 1000;
    let owed = Math.min(4, Math.floor(acc * 60 + 0.25)); acc -= owed / 60; if (acc < -0.1) acc = 0;
    const a = now(); let age = NaN;
    if (mode === 'sab') {
      if (owed) { Atomics.add(ctl, 0, owed); Atomics.notify(ctl, 0); }
      const s = Atomics.load(ctl, 1);
      if (s >= 0) { Atomics.store(ctl, 2, s); const B = new Float32Array(bufsB[s]); pose.set(B.subarray(0, N3)); age = now() - meta[s * 2]; stepMs.push(meta[s * 2 + 1]); Atomics.store(ctl, 2, -1); }
    } else {
      if (latest) { pose.set(new Float32Array(latest.buf)); age = now() - latest.t; spare.push(latest.buf); latest = null; }
      if (owed && inflight < 2) { const buf = spare.pop() || new ArrayBuffer(4 * N3); w.postMessage({ steps: owed, buf, seq: seq++ }, [buf]); inflight++; }
    }
    const phys = now() - a;
    busy(renderMs);
    frames.push({ dt, phys, age });
    const wait = period - (now() - t); if (wait > 1) await new Promise(r => setTimeout(r, wait - 1)); else await tick();
    while (now() - t < period) await tick();
  }
  if (mode === 'sab') { Atomics.store(ctl, 3, 1); Atomics.add(ctl, 0, 1); Atomics.notify(ctl, 0); } else w.postMessage({ stop: true });
  await Promise.race([new Promise(r => w.once('exit', r)), new Promise(r => setTimeout(r, 2000))]); 
  report(mode, frames, '| step p50 ' + pct(stepMs, .5).toFixed(2) + ' ms (worker), substeps ' + info.substeps + ', nodes ' + info.n);
  process.exit(0);
})();
