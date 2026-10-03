#!/usr/bin/env node
// luma_trace.js - THE LIGHT, FRAME BY FRAME, AND THE CUB AT A LOW SUN (LIGHT-SMOOTH G1350-G1359, 2026-10-03).
// Drives a page held by tools/live_driver.js (start that first, on its own ports and short profile) over its /eval,
// /run and /shot:
//   stills  the stock Cub at the stand, PAUSED, clouds' shadows off, the clock frozen: the sun at 8 deg on the RISING side
//           (at the evening's 8 deg the stand is in the hangar's shade) and noon, side and 3/4 rear, each with the G1350
//           graze fade off (FLOWN_BAKE.graze.value 1 = before) and on (0.25) -> <out>/still_*.png. After a time jump the
//           light eases, the probe fades and the eye adapts: it waits 8 s before shooting.
//   flight  skip to the line-up, take off on the autopilot, the day's clouds drifting (clock x RATE); the luma trace
//           (tools/luma_trace_page.js) over SEG-second blocks alternating BEFORE (LIGHT_EASE.on false, the probe's
//           PROBE_FADE.s 0, CLOUDS.S.shadowHold 0) and AFTER (all three on) -> <out>/luma_trace.json
// Usage: node tools/luma_trace.js <cmdPort> <outDir> [stills|flight|both] (env RATE=10 SEG=30 BLOCKS=4)
// It takes NO lock: run it inside `boxlock.sh take gpu <who>` / `drop gpu <who>`. Never pass --help (rigs run on it).
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const CPORT = +(process.argv[2] || 8642), OUT = path.resolve(process.argv[3] || 'lt_out'), WHAT = process.argv[4] || 'both';
const RATE = +(process.env.RATE || 10), SEG = +(process.env.SEG || 30), BLOCKS = +(process.env.BLOCKS || 4);
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = (p, body) => new Promise((res, rej) => {
  const rq = http.request({ host: '127.0.0.1', port: CPORT, path: p, method: body != null ? 'POST' : 'GET' }, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(b)); });
  rq.on('error', rej); if (body != null) rq.write(body); rq.end();
});
const E = x => post('/eval', x), RUN = x => post('/run', x), SHOT = f => post('/shot?f=' + encodeURIComponent(f));
const log = s => console.log('[' + new Date().toTimeString().slice(0, 8) + '] ' + s);
const frames = n => E(`(async()=>{ const R=FLIGHT_PROBE.renderer(), f0=R.info.render.frame; for(let i=0;i<400&&R.info.render.frame<f0+${n};i++) await new Promise(z=>setTimeout(z,16)); return R.info.render.frame-f0; })()`);
(async () => {
  for (let i = 0; i < 200; i++) { if (await E('window.BOOT && BOOT.state') === 'gone') break; await sleep(2000); }
  log('boot gone');
  await E("(document.getElementById('bGo').click(), 1)");
  for (let i = 0; i < 200; i++) { const s = await E("(()=>{const T=window.FLYDIY_TRIPS;const t=T&&T[T.length-1];return (t&&t.kind+':'+t.done)+' '+BOOT.state})()"); if (/rollout:true.*gone/.test(s)) break; await sleep(2000); }
  await sleep(4000);
  log('rolled out: ' + await E("FLIGHT_PROBE.ap().phase"));
  log(await RUN(fs.readFileSync(path.join(__dirname, 'luma_trace_page.js'), 'utf8') + '\nreturn "LT " + typeof LT;'));
  if (WHAT === 'stills' || WHAT === 'both') {
    await E('(()=>{ if (!window.FLYDIY_HELD) document.getElementById("bPause").click(); DAY_CLOCK.rate(0); CLOUDS.S.shadow = 0; return 1; })()');
    const c0 = JSON.parse(await E('JSON.stringify(FLIGHT_PROBE.camGet())'));
    log('cam ' + JSON.stringify({ az: c0.az, el: c0.el, dist: c0.dist }));
    const views = { side: [c0.az - 0.78, 0.16, 11], rear34: [c0.az + 0.7, 0.18, 11] };   // (Jolene's stand: az after the roll-out ~1.65)
    for (const hour of ['low', 'noon']) {
      await E(hour === 'low' ? '(()=>{ const w = FLIGHT_PROBE.world(), d = w.day; w.setDay({ utc: d.utcFor(8, true) }); return 1; })()' : '(DAY_CLOCK.preset("noon"), 1)');
      await sleep(8000);
      for (const [vn, v] of Object.entries(views)) {
        await E(`(FLIGHT_PROBE.camSet(${v[0]}, ${v[1]}, ${v[2]}), 1)`); await sleep(6000);
        for (const g of [1, 0.25]) {
          await E(`(FLOWN_BAKE.graze.value = ${g}, 1)`); await frames(6);
          await SHOT(path.join(OUT, `still_${hour}_${vn}_${g === 1 ? 'before' : 'after'}.png`));
        }
      }
    }
    await E('(()=>{ if (window.FLYDIY_HELD) document.getElementById("bPause").click(); return 1; })()');
    log('stills done');
    await E('(CLOUDS.S.shadow = 0.8, DAY_CLOCK.preset("afternoon"), FLIGHT_PROBE.camSet(' + c0.az + ',' + c0.el + ',' + c0.dist + '), 1)');
  }
  if (WHAT === 'flight' || WHAT === 'both') {
    await E(`(DAY_CLOCK.rate(${RATE}), 1)`);
    await E("(document.getElementById('bSkip') && document.getElementById('bSkip').click(), 1)"); await sleep(6000);
    await E("(document.getElementById('bGo').click(), 1)");
    for (let i = 0; i < 60; i++) { const a = +(await E('FLIGHT_PROBE.agl ? FLIGHT_PROBE.agl() : 0')); if (a > 15) break; await sleep(1000); }
    log('airborne: ' + await E("FLIGHT_PROBE.ap().phase + ' agl ' + (+FLIGHT_PROBE.agl()).toFixed(0)"));
    const blocks = [];
    await E('LT.start()');
    for (let b = 0; b < BLOCKS; b++) {
      const after = b % 2 === 1;
      await E(`(LIGHT_EASE.on = ${after}, ATMO.PROBE_FADE.s = ${after ? 2 : 0}, CLOUDS.S.shadowHold = ${after ? 1 : 0}, 1)`);
      const r0 = +(await E('LT.st.rows.length'));
      blocks.push({ b, after, r0 });
      log(`block ${b} ${after ? 'AFTER' : 'BEFORE'} from row ${r0}`);
      await sleep(SEG * 1000);
    }
    await E('LT.stop()');
    const dump = JSON.parse(await E('LT.dump()'));
    dump.blocks = blocks; dump.rate = RATE; dump.seg = SEG;
    fs.writeFileSync(path.join(OUT, 'luma_trace.json'), JSON.stringify(dump));
    log('trace rows ' + dump.rows.length + ', flagged ' + dump.snaps.length + (dump.err ? ' ERR ' + dump.err : ''));
  }
  log('done');
})().catch(e => { console.log('FATAL ' + (e.stack || e)); process.exit(1); });
