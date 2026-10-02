#!/usr/bin/env node
// heap_steps.js - G1200 (MEM-DIET): THE LOAD'S JS HEAP, STEP BY STEP. One headed load (master_bench's rig: a fresh --udd,
// its own server on --port), the heap polled over CDP every 200 ms (Runtime.getHeapUsage: the V8 heap used + the
// ArrayBuffers' backing stores) against BOOT.current's label; per step the heap when it ended and the most it reached.
// With --sample (default on) V8's sampling heap profiler runs from the first byte: at the end of the load (after a full GC)
// the live bytes by allocating function (self and the stack's top frames) = WHO KEEPS the heap.
// --track 0: without the typed-array tracker (tools/perf/heap_track_page.js, on by default).
// Usage: node tools/perf/heap_steps.js --port 8653 --udd <short fresh dir> [--build cub|metal] [--out x.json]
//        [--gcsteps 1: a full GC at each step change, its retained floor in gcAB / gcHeap] [--settle 15] [--sample 0] [--fallback D:/Dev/DeGaRoR.github.io] [--top 40]
// GPU lock first (a browser run). No --help: an unknown flag is ignored.
'use strict';
const fs = require('fs'), path = require('path');
const MB = require('../master_bench.js');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const REPO = path.resolve(__dirname, '..', '..', '..');
const PORT = +opt('port', 0), UDD = opt('udd', null), BK = opt('build', 'cub'), OUT = opt('out', null);
const GCSTEPS = opt('gcsteps', '0') === '1', SAMPLE = opt('sample', '1') !== '0', SETTLE = +opt('settle', 15), TOP = +opt('top', 40);
if (!PORT || !UDD) { console.error('heap_steps: --port and --udd are required'); process.exit(2); }
if (PORT === 8531) { console.error('heap_steps: not 8531 (a peer\'s server)'); process.exit(2); }
const MiB = x => +(x / 1048576).toFixed(1);

(async () => {
  if (await MB.serveRoot(PORT)) { console.error('port ' + PORT + ' is taken'); process.exit(4); }
  const srv = MB.serve(PORT, opt('fallback', null)); await sleep(800);
  const root = await MB.serveRoot(PORT);
  if (!root || path.resolve(root) !== REPO) { console.error('the server serves ' + root); srv.kill(); process.exit(4); }
  const b = await MB.browser(path.resolve(UDD));
  const B = MB.BUILDS[BK] || MB.BUILDS.cub;
  const out = { build: BK, rows: [], steps: [], at: new Date().toISOString() };
  if (SAMPLE) { await b.cmd('HeapProfiler.enable'); await b.cmd('HeapProfiler.startSampling', { samplingInterval: 65536 }); }
  // the poll: the step's label (BOOT.current) and the heap, every 200 ms, alongside the load's own wait
  let polling = true; const t0 = Date.now();
  const poll = (async () => {
    while (polling) {
      try {
        let lab = await b.ev("(window.BOOT && BOOT.current ? (BOOT.current.label || BOOT.current.id) : (window.BOOT ? 'BOOT ' + BOOT.state : 'page'))", 3000);
        // --gcsteps 1: a full GC on every step change first - the step's RETAINED floor, not what V8 had not collected yet
        const L = out.rows[out.rows.length - 1]; let gc = 0; if (GCSTEPS && (!L || L[1] !== lab)) { await b.cmd('HeapProfiler.collectGarbage'); gc = 1; }
        const h = (await b.cmd('Runtime.getHeapUsage')).result || {};
        out.rows.push([Date.now() - t0, lab, MiB(h.usedSize || 0), MiB(h.backingStorageSize || 0), gc]);
      } catch (e) {}
      await sleep(200);
    }
  })();
  const l = await b.load('http://localhost:' + PORT + '/flyDiy/' + opt('page', 'index.html'), MB.preScript(B.build, null, B.patch) + String.fromCharCode(10) + (opt('track', '1') !== '0' ? require('./heap_track_page.js') : ''));
  console.log('load ' + l.sec + ' s (' + l.state + ')'); out.load = l;
  await sleep(SETTLE * 1000); polling = false; await poll;
  // per step: the heap at its end, the most it reached (in its rows), the backing stores at its end
  for (const r of out.rows) { const L = out.steps[out.steps.length - 1];
    if (!L || L.step !== r[1]) out.steps.push({ step: r[1], t: r[0], end: r[2], peak: r[2], ab: r[3], gcAB: r[4] ? r[3] : null, gcHeap: r[4] ? r[2] : null }); else { L.end = r[2]; L.peak = Math.max(L.peak, r[2]); L.ab = r[3]; L.peakAB = Math.max(L.peakAB || 0, r[3]); } }
  out.peak = Math.max(...out.rows.map(r => r[2])); out.peakAB = Math.max(...out.rows.map(r => r[3]));
  out.settled = out.rows[out.rows.length - 1];
  await b.cmd('HeapProfiler.collectGarbage'); await sleep(500);
  const hg = (await b.cmd('Runtime.getHeapUsage')).result || {}; out.afterGC = { used: MiB(hg.usedSize), ab: MiB(hg.backingStorageSize || 0) };
  // the typed arrays' backing stores still alive, by the stack that made them (heap_track_page.js)
  try { out.typed = JSON.parse(await b.ev('JSON.stringify(window.__HT ? __HT.report(' + TOP + ') : null)'));
    out.typedBySteps = JSON.parse(await b.ev('JSON.stringify(window.__HT ? __HT.report(' + TOP + ', true) : null)')); } catch (e) { out.typed = String(e); }
  if (SAMPLE) {
    const p = (await b.cmd('HeapProfiler.getSamplingProfile')).result.profile;
    const self = new Map(), incl = new Map();
    const name = cf => (cf.functionName || '(anon)') + ' ' + (cf.url || '').replace(/^.*\/flyDiy\//, '') + ':' + (cf.lineNumber + 1);
    const walk = (n, stack) => { const k = name(n.callFrame); const s = stack.concat([k]);
      if (n.selfSize) { self.set(k, (self.get(k) || 0) + n.selfSize);
        // the first frame of the app's own (not three/vendor) up the stack: who asked
        const own = s.slice().reverse().find(f => / (src|flight_core|index|dev)\b/.test(f) && !/vendor|three/.test(f)) || k;
        incl.set(own, (incl.get(own) || 0) + n.selfSize); }
      for (const c of n.children || []) walk(c, s); };
    walk(p.head, []);
    const top = m => [...m].sort((a, c) => c[1] - a[1]).slice(0, TOP).map(([k, v]) => [MiB(v), k]);
    out.bySelf = top(self); out.byOwn = top(incl);
    out.sampledLive = MiB([...self.values()].reduce((a, x) => a + x, 0));
  }
  out.exc = b.exc.slice(0, 10);
  await b.close(); srv.kill();
  console.log('step'.padEnd(36) + 'end MB  peak MB  arraybuf MB  (after a GC)');
  for (const s of out.steps) console.log(String(s.step).slice(0, 35).padEnd(36) + String(s.end).padStart(7) + String(s.peak).padStart(9) + String(s.ab).padStart(13) + (s.gcAB != null ? String(s.gcAB).padStart(10) : ''));
  console.log('PEAK heap ' + out.peak + ' MB, arraybuffers ' + out.peakAB + ' MB; settled ' + JSON.stringify(out.settled) + '; after GC ' + JSON.stringify(out.afterGC));
  if (SAMPLE) { console.log('live sampled ' + out.sampledLive + ' MB. BY APP FRAME:'); for (const r of out.byOwn.slice(0, 25)) console.log('  ' + String(r[0]).padStart(7) + '  ' + r[1]);
    console.log('BY ALLOCATING FRAME:'); for (const r of out.bySelf.slice(0, 20)) console.log('  ' + String(r[0]).padStart(7) + '  ' + r[1]); }
  if (out.typed && out.typed.top) { console.log('TYPED ARRAYS live ' + out.typed.liveMB + ' MB in ' + out.typed.n + ' stores >= 256 KB:'); for (const r of out.typed.top.slice(0, 30)) console.log('  ' + String(r[0]).padStart(7) + '  x' + r[1] + '  ' + r[2]); }
  if (out.typedBySteps && out.typedBySteps.top) { console.log('BY STEP:'); for (const r of out.typedBySteps.top.slice(0, 40)) console.log('  ' + String(r[0]).padStart(7) + '  x' + r[1] + '  ' + r[2].slice(0, 170)); }
  if (out.exc.length) console.log('exceptions: ' + out.exc.join(' || '));
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
