#!/usr/bin/env node
// cross_frames.js - THE HYBRID'S FIRST CROSSING, IN FRAMES (C4b, 2026-10-01): is the band's first crossing seamless in
// Chrome - no hitch, no long task? Drives a page kept up by tools/live_driver.js (a FRESH page: the first crossing of the
// session is the one that pays anything lazy). Rolls the build out, holds the flight (the world still, the frames still
// drawn), sets the orbit far (FAR m), lets 90 frames settle, then walks the orbit FAR -> NEAR -> FAR over 2 x STEPS frames
// IN THE PAGE, one distance a frame (rAF), recording each frame's time (rAF to rAF), the hybrid's t, and every long task
// (PerformanceObserver 'longtask') with the frame it fell in. Prints the worst frame and the long tasks at and after the
// first t > 0 frame (the crossing) against the settled frames before it.
// Usage: node tools/cross_frames.js <cmdPort> <out.json> [steps=90]
'use strict';
const fs = require('fs'), path = require('path');
const PORT = +(process.argv[2] || 8572), OUT = path.resolve(process.argv[3] || 'cross_frames.json'), STEPS = +(process.argv[4] || 90);
const FAR = +(process.env.FAR || 14), NEAR = +(process.env.NEAR || 2.6), AZ = +(process.env.AZ || 1.45), EL = +(process.env.EL || 0.08);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async (p, body) => { const r = await fetch('http://127.0.0.1:' + PORT + p, { method: 'POST', body }); return r.text(); };
const run = async body => { const t = await post('/run', body); try { return JSON.parse(t); } catch (e) { return t; } };
const until = async (cond, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await run('return !!(' + cond + ');')) === true) return true; await sleep(500); } throw new Error('timed out: ' + what); };
(async () => {
  await until(`window.BOOT && BOOT.state === 'gone'`, 600000, 'the garage boot');
  await sleep(1500);
  await run(`document.getElementById('bGo').click(); return 1;`);
  await until(`window.BOOT && BOOT.state === 'gone' && /Fly the circuit/.test((document.getElementById('bGo') || {}).textContent || '') && window.FLIGHT_PROBE && FLIGHT_PROBE.model()`, 900000, 'the roll-out');
  await sleep(2000);
  if (!(await run('return !!window.FLYDIY_HELD;'))) await run(`document.getElementById('bPause').click(); return 1;`);
  const res = await run(`
    const P = FLIGHT_PROBE, FB = window.FLOWN_BAKE && FLOWN_BAKE.FB;
    P.camMode('orbit'); P.camSet(${AZ}, ${EL}, ${FAR});
    await new Promise(r => { let k = 90; const f = () => (--k > 0 ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); });
    const longs = []; let obs = null;
    try { obs = new PerformanceObserver(l => { for (const e of l.getEntries()) longs.push([e.startTime, e.duration]); }); obs.observe({ entryTypes: ['longtask'] }); } catch (e) {}
    const N = ${STEPS}, rows = [];
    await new Promise(r => {
      let i = 0, last = performance.now();
      const f = now => {
        rows.push([i, now - last, FB ? FB.hyT : null, now]); last = now;
        if (i > 2 * N) return r();
        const u = i <= N ? i / N : 2 - i / N, d = ${FAR} * Math.pow(${NEAR} / ${FAR}, u);
        P.camSet(${AZ}, ${EL}, d); i++;
        requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    });
    await new Promise(r => setTimeout(r, 300));
    if (obs) obs.disconnect();
    return { rows, longs, hybrid: !!(FB && FB.hybrid), warmKey: !!(FB && FB.warmKey), warm: window.__hyWarm ? { n: window.__hyWarm.n, drawn: window.__hyWarm.drawn } : null };`);
  const rows = res.rows || [];
  const first = rows.find(r => r[2] > 0);
  const pre = rows.filter(r => !first || r[0] < first[0]).slice(5), post = first ? rows.filter(r => r[0] >= first[0] && r[0] < first[0] + 10) : [];
  const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
  const inFrames = (L, from, to) => L.filter(([s, d]) => s + d >= from && s <= to);
  const sum = {
    hybrid: res.hybrid, warmKey: res.warmKey, warm: res.warm, frames: rows.length,
    firstCrossFrame: first ? first[0] : null,
    settledMedianMs: +(med(pre.map(r => r[1])) || 0).toFixed(2), settledMaxMs: +Math.max(0, ...pre.map(r => r[1])).toFixed(2),
    crossingWorstMs: post.length ? +Math.max(...post.map(r => r[1])).toFixed(2) : null, crossingFrames: post.map(r => +r[1].toFixed(1)),
    walkWorstMs: +Math.max(0, ...rows.slice(1).map(r => r[1])).toFixed(2),
    longTasksAll: (res.longs || []).map(([s, d]) => +d.toFixed(0)),
    longTasksAtCrossing: first ? inFrames(res.longs || [], first[3] - 200, first[3] + 1000).map(([s, d]) => +d.toFixed(0)) : []
  };
  fs.writeFileSync(OUT, JSON.stringify({ sum, rows: rows.map(r => [r[0], +r[1].toFixed(2), r[2]]), longs: res.longs }, null, 1));
  console.log(JSON.stringify(sum));
})().catch(e => { console.error('cross_frames: ' + (e && e.stack || e)); process.exit(1); });
