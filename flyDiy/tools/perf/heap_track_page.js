// heap_track_page.js - G1200 (MEM-DIET): WHO KEEPS THE TYPED ARRAYS. A page-side tracker (a string, run before the page's
// first script - heap_steps.js's pre-script, or the node page's beforeScript). A NEW backing store of >= MIN bytes is
// recorded once (its buffer's identity) with where it came from and a WeakRef:
//   - every typed-array constructor and ArrayBuffer (a Proxy's construct trap): the stack's frames (the app's first);
//   - the stores the page did not construct: fetch's Response.arrayBuffer ('fetch <file>'), a canvas's ImageData
//     ('imagedata'), a worker's messages ('worker <script>': its data walked 4 deep).
// window.__HT.report(n, byStep) groups the stores STILL ALIVE (the caller forces a GC first) by origin (byStep: by the BOOT step it was made in, and origin): [MB, count, origin].
// The sampling heap profiler sees the V8 heap only - this sees the backing stores (outside it), which are most of the
// renderer's memory (G1200: 2.2 GB of 2.5 after a desktop load). Changes nothing the page does.
'use strict';
const MIN = +(process.env.HT_MIN || 256 * 1024);
module.exports = String.raw`(function () { if (window.__HT) return; const MIN = ${MIN}; const L = []; const seen = new WeakSet();
  const strip = l => l.trim().replace(/^at /, '').replace(/\(?(https?:\/\/[^/]+)?\/?([^)]*\/)?([^/)?]+)(\?v=\w+)?:(\d+):\d+\)?$/, '$3:$5');
  const frames = () => { const all = (new Error().stack || '').split('\n').slice(3).map(strip).filter(l => !/heap_track|^Proxy|^new Proxy/.test(l));
    const app = all.filter(l => !/three|_page_node|_fake_gl|_page_dom|^Array\.|^new /.test(l));
    return (app.length ? app : all).slice(0, 4).join(' < '); };
  const note = (buf, why) => { if (!buf || !(buf.byteLength >= MIN) || seen.has(buf)) return; seen.add(buf); let st = ''; try { st = window.BOOT && BOOT.current ? String(BOOT.current.label || BOOT.current.id).replace(/ \d+ \/ \d+$/, '') : ''; } catch (e) {} L.push({ b: buf.byteLength, s: why || frames(), st, r: new WeakRef(buf) }); };
  for (const k of ['Float32Array', 'Float64Array', 'Uint8Array', 'Uint8ClampedArray', 'Int8Array', 'Uint16Array', 'Int16Array', 'Uint32Array', 'Int32Array', 'ArrayBuffer']) {
    const C = window[k]; if (!C) continue;
    window[k] = new Proxy(C, { construct(T, a, nt) { const o = Reflect.construct(T, a, nt === window[k] ? T : nt); try { note(k === 'ArrayBuffer' ? o : o.buffer); } catch (e) {} return o; } });
  }
  try { const RA = Response.prototype.arrayBuffer; Response.prototype.arrayBuffer = function () { const u = this.url ? 'fetch ' + String(this.url).replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, '').slice(-60) : 'response ' + frames(); return RA.call(this).then(b => { note(b, u); return b; }); }; } catch (e) {}
  try { const BA = Blob.prototype.arrayBuffer; Blob.prototype.arrayBuffer = function () { const u = 'blob ' + frames(); return BA.call(this).then(b => { note(b, u); return b; }); }; } catch (e) {}
  try { for (const k of ['get', 'getAll']) { const f = IDBObjectStore.prototype[k]; IDBObjectStore.prototype[k] = function () { const rq = f.apply(this, arguments), u = 'idb ' + this.name + ' < ' + frames(); rq.addEventListener('success', () => { try { walk(rq.result, u, 0); } catch (e) {} }); return rq; }; } } catch (e) {}
  try { const C2 = CanvasRenderingContext2D.prototype; for (const k of ['getImageData', 'createImageData']) { const f = C2[k]; C2[k] = function () { const d = f.apply(this, arguments); try { note(d.data.buffer, 'imagedata ' + k + ' < ' + frames()); } catch (e) {} return d; }; } } catch (e) {}
  const walk = (v, why, d) => { if (!v || typeof v !== 'object' || d > 8) return; if (ArrayBuffer.isView(v)) return note(v.buffer, why); if (v instanceof ArrayBuffer) return note(v, why);
    if (Array.isArray(v)) { for (let i = 0; i < Math.min(v.length, 4096); i++) walk(v[i], why, d + 1); return; } for (const k in v) walk(v[k], why, d + 1); };
  try { const WK = window.Worker; if (WK) window.Worker = new Proxy(WK, { construct(T, a, nt) { const w = Reflect.construct(T, a, nt === window.Worker ? T : nt);
    const u = 'worker ' + String(a[0] && a[0].name || a[0] || '').replace(/^.*\//, '').replace(/\?.*$/, '').slice(0, 40);
    w.addEventListener('message', e => { try { const k = e.data && (e.data.kind || e.data.type || e.data.op || e.data.cmd); walk(e.data, u + (k ? ' ' + k : ''), 0); } catch (x) {} }); return w; } }); } catch (e) {}
  window.__HT = { report(n, byStep) { const g = new Map(); let tot = 0, cnt = 0;
    for (const e of L) { const buf = e.r.deref(); if (!buf || buf.byteLength === 0) continue; tot += e.b; cnt++; const key = byStep ? e.st + ' | ' + e.s : e.s; const x = g.get(key) || [0, 0]; x[0] += e.b; x[1]++; g.set(key, x); }
    return { liveMB: +(tot / 1048576).toFixed(1), n: cnt, made: L.length, top: [...g].sort((a, b) => b[1][0] - a[1][0]).slice(0, n || 40).map(([s, x]) => [+(x[0] / 1048576).toFixed(1), x[1], s]) }; } };
})();`;
