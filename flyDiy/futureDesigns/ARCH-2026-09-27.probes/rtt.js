// ARCH-2026-09-27 probe (node only, not a gate): the bare transport, no sim - a round trip carrying N node positions, 5000 times
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const now = () => Number(process.hrtime.bigint()) / 1e6;
const N3 = 110 * 3;
if (!isMainThread) {
  if (workerData.sab) { const c = new Int32Array(workerData.sab); const B = new Float32Array(workerData.buf);
    for (;;) { Atomics.wait(c, 0, 0); if (c[1]) break; for (let i = 0; i < N3; i++) B[i] = i * 0.5 + c[2]; Atomics.store(c, 0, 0); Atomics.notify(c, 0); } }
  else parentPort.on('message', m => { const a = new Float32Array(m); for (let i = 0; i < N3; i++) a[i] += 1; parentPort.postMessage(m, [m]); });
  return;
}
const pct = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(q * s.length)]; };
(async () => {
  { const w = new Worker(__filename, { workerData: {} }); let buf = new ArrayBuffer(4 * N3); const L = [];
    for (let i = 0; i < 5000; i++) { const t = now(); w.postMessage(buf, [buf]); buf = await new Promise(r => w.once('message', r)); L.push(now() - t); }
    console.log('postMessage (transferred ArrayBuffer, ' + N3 * 4 + ' B) round trip ms p50/p99', pct(L, .5).toFixed(3), pct(L, .99).toFixed(3)); await w.terminate(); }
  { const w = new Worker(__filename, { workerData: {} }); const L = [];
    for (let i = 0; i < 5000; i++) { const t = now(); w.postMessage(new Float64Array(N3 * 2).buffer); await new Promise(r => w.once('message', r)); L.push(now() - t); }
    console.log('postMessage (structured-clone copy, p+v float64 ' + N3 * 16 + ' B) round trip ms p50/p99', pct(L, .5).toFixed(3), pct(L, .99).toFixed(3)); await w.terminate(); }
  { const sab = new SharedArrayBuffer(16), buf = new SharedArrayBuffer(4 * N3), c = new Int32Array(sab); const w = new Worker(__filename, { workerData: { sab, buf } }); await new Promise(r => setTimeout(r, 200)); const L = [];
    for (let i = 0; i < 5000; i++) { const t = now(); c[2] = i; Atomics.store(c, 0, 1); Atomics.notify(c, 0); Atomics.wait(c, 0, 1); L.push(now() - t); }
    console.log('SharedArrayBuffer + Atomics.wait/notify round trip ms p50/p99', pct(L, .5).toFixed(3), pct(L, .99).toFixed(3)); c[1] = 1; Atomics.store(c, 0, 1); Atomics.notify(c, 0); await w.terminate(); }
  process.exit(0);
})();
