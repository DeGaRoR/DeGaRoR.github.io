#!/usr/bin/env node
// G1869 (DMG-D4b): THE FRAMES OF A CRASH - where the impact's frame time goes, on the box. A client of tools/live_driver.js
// (as tools/dmg_wreck_stills.js; TAKE THE GPU LOCK FIRST), the user's Cub, ?damage=1&simw=0: each case staged on the
// runway as the stills stage it and stepped two physics steps a frame, every frame split - the physics (its two steps),
// the recorder's slots of the frame the page drew (`scene`: the pose, the skin break, the debris; `render`; `shader`: the
// programs linked), the skin break's own part (the records, the events, the riding) and the debris'.
//   node tools/dmg_crash_trace.js [--cmd 8572] [--cases trunk-0,trunk-2.5,nosein] [--out file.json] [--label before]
// -> per case: the worst frame, the mean of the impact's second (from the first break), and the same split summed there
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const R = require('./dmg_wreck_stills.js');
(async () => {
  const out = { label: opt('label', ''), at: new Date().toISOString(), cases: {} };
  for (const k of opt('cases', 'trunk-0,trunk-2.5,nosein').split(',')) {
    const o = Object.assign({}, R.CASES[k].o, { trace: true });
    await R.run(R.pageStage, Object.assign({}, o, { placeOnly: true }));
    const st = await R.run(R.pageStage, Object.assign({}, o, { run: true }));
    const T = st.trace || [], i0 = T.findIndex(r => r.broken > 0), t0 = i0 >= 0 ? T[i0].t : 0;
    const win = T.filter(r => r.t >= t0 && r.t < t0 + 1);
    const sum = key => +win.reduce((a, r) => a + (r[key] || 0), 0).toFixed(1);
    const worst = T.reduce((a, r) => (r.ms > a.ms ? r : a), { ms: 0 });
    out.cases[k] = { label: R.CASES[k].label, reason: st.reason, broken: st.broken, frames: T.length,
      worst, impactMean: win.length ? +(win.reduce((a, r) => a + r.ms, 0) / win.length).toFixed(1) : null, impactFrames: win.length,
      impactSum: { ms: sum('ms'), phys: sum('phys'), scene: sum('scene'), brk: sum('brk'), brkRec: sum('brkRec'), brkEv: sum('brkEv'), brkPose: sum('brkPose'), wreck: sum('wreck'), render: sum('render'), shader: sum('shader'), shadow: sum('shadow') },
      calm: (() => { const c = T.slice(0, Math.max(1, i0)).map(r => r.ms).sort((a, b) => a - b); return c.length ? c[c.length >> 1] : null; })(),
      trace: T };
    const c = out.cases[k];
    console.log(k + ': worst ' + worst.ms + ' ms at t ' + worst.t + ' (phys ' + worst.phys + ', scene ' + worst.scene + ' [brk ' + worst.brk + ': rec ' + worst.brkRec + ' ev ' + worst.brkEv + ' pose ' + worst.brkPose + ', wreck ' + worst.wreck + '], render ' + worst.render + ', shader ' + worst.shader + '); the impact second ' + c.impactMean + ' ms mean over ' + c.impactFrames + ' frames (calm ' + c.calm + ') - summed ' + JSON.stringify(c.impactSum));
  }
  const f = opt('out', null); if (f) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(out, null, 1)); }
  process.exit(0);
})().catch(e => { console.log('TRACE_FAIL ' + (e && e.stack || e)); process.exit(1); });
