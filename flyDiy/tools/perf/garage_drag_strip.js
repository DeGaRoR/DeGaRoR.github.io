#!/usr/bin/env node
// garage_drag_strip.js - GARAGE-INSTANT (G1446): A DRAG, FRAME BY FRAME, FOR THE USER. The garage loaded with a build
// (a fresh Chrome on --udd), then one slider dragged the way a hand drags it: pointerdown, then one input a frame
// (--ticks of them, --span of the slider's range in all), each tick's handler timed and the frame after it shot;
// then the release and the settle build, and the aeroplane it leaves. JPEGs in --dir (<build>_<row>_<n>.jpg) and a
// line per tick (ms of the handler, ms to the frame drawn). The pause that settles a drag is held off while the
// shots are taken (a screenshot outlasts 350 ms), so every shot is a preview tick's aeroplane.
// Usage: node tools/perf/garage_drag_strip.js --port 8879 --udd <dir> --dir reports/evidence/GARAGE-INSTANT
//          [--tree flyDiy] [--build cub|metal] [--row p_paxLen] [--ticks 4] [--span 0.15] [--page index.html]
//          [--clip x,y,w,h]   (a CSS-pixel crop of the shot)
// No --help.
'use strict';
const fs = require('fs'), path = require('path');
const MB = require('../master_bench.js');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const PORT = +opt('port', 0), UDD = opt('udd', null), DIR = path.resolve(opt('dir', 'reports/evidence/GARAGE-INSTANT'));
if (!PORT || !UDD) { console.error('garage_drag_strip: --port and --udd are required'); process.exit(2); }
const BUILDS = { cub: { build: 'builds/cub_2026-09-20_corrected.json' }, metal: MB.BUILDS.metal };
const BK = opt('build', 'cub'), ROWS = opt('row', 'p_paxLen').split(','), TICKS = +opt('ticks', 4), SPAN = +opt('span', 0.15);
const CLIP = opt('clip', null) ? opt('clip').split(',').map(Number) : null;
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  if (await MB.serveRoot(PORT)) { console.error('port taken'); process.exit(4); }
  const srv = MB.serve(PORT); await sleep(800);
  process.on('exit', () => { try { srv.kill(); } catch (e) {} });
  fs.mkdirSync(DIR, { recursive: true });
  const b = await MB.browser(UDD);
  const l = await b.load('http://localhost:' + PORT + '/' + opt('tree', 'flyDiy') + '/' + opt('page', 'index.html'), MB.preScript(BUILDS[BK].build, null, BUILDS[BK].patch));
  console.log('  loaded ' + l.state + ' in ' + l.sec + ' s'); await sleep(8000);
  const shot = async name => { const p = { format: 'jpeg', quality: 78 }; if (CLIP) p.clip = { x: CLIP[0], y: CLIP[1], width: CLIP[2], height: CLIP[3], scale: 1 };
    const r = await b.cmd('Page.captureScreenshot', p);
    const f = path.join(DIR, BK + '_' + name + '.jpg'); fs.writeFileSync(f, Buffer.from(r.result.data, 'base64')); return path.basename(f); };
  const frames = n => b.ev(`new Promise(r => { let k = ${n}; const f = () => (--k > 0 ? requestAnimationFrame(f) : r(1)); requestAnimationFrame(f); })`, 240000);
  const out = [];
  for (const ROW of ROWS) {
    const key = ROW.replace(/^p_/, '');
    await frames(3); console.log('  ' + await shot(key + '_0_settled'));
    await b.ev(`(() => { window.CAGE_UI.dragSettleMs = 600000; const el = document.getElementById(${JSON.stringify(ROW)}); window.__ds = { el, x0: +el.value }; el.dispatchEvent(new PointerEvent('pointerdown')); return 1; })()`);
    for (let k = 1; k <= TICKS; k++) {
      const r = JSON.parse(await b.ev(`(async () => { const S = window.__ds, el = S.el, lo = +el.min, hi = +el.max;
        const dir = (hi - S.x0) >= (S.x0 - lo) ? 1 : -1; el.value = String(Math.min(hi, Math.max(lo, S.x0 + dir * (hi - lo) * ${SPAN} * ${k} / ${TICKS})));
        const pv = window.CAGE_UI.preview ? window.CAGE_UI.preview.n : 0, dv = window.CAGE_UI.preview ? window.CAGE_UI.preview.deform : 0;
        const t = performance.now(); el.dispatchEvent(new Event('input')); const sync = performance.now() - t;
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        return JSON.stringify({ v: el.value, sync: +sync.toFixed(1), drawn: +(performance.now() - t).toFixed(1), preview: window.CAGE_UI.preview ? window.CAGE_UI.preview.n > pv : false,
          deformed: window.CAGE_UI.preview ? window.CAGE_UI.preview.deform > dv : false }); })()`, 120000));
      const f = await shot(key + '_' + k + '_tick');
      console.log('  ' + f + '  value ' + r.v + '  handler ' + r.sync + ' ms, drawn ' + r.drawn + ' ms' + (r.preview ? '  (preview' + (r.deformed ? ', deformed' : '') + ')' : '  (whole build)'));
      out.push(Object.assign({ build: BK, row: ROW, tick: k, file: f }, r));
    }
    const rel = JSON.parse(await b.ev(`(async () => { window.CAGE_UI.dragSettleMs = 0; const el = window.__ds.el; const t = performance.now();
      el.dispatchEvent(new Event('change')); window.dispatchEvent(new PointerEvent('pointerup')); const sync = performance.now() - t;
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      return JSON.stringify({ release: +sync.toFixed(1), drawn: +(performance.now() - t).toFixed(1) }); })()`, 120000));
    await sleep(1500); await frames(3);
    const f = await shot(key + '_' + (TICKS + 1) + '_released');
    console.log('  ' + f + '  release handler ' + rel.release + ' ms, drawn ' + rel.drawn + ' ms');
    out.push(Object.assign({ build: BK, row: ROW, tick: 'release', file: f }, rel));
    // back to the build's value (a whole build)
    await b.ev(`(() => { const S = window.__ds; S.el.value = String(S.x0); S.el.dispatchEvent(new Event('input')); S.el.dispatchEvent(new Event('change')); window.CAGE_UI.dragSettleMs = 350; return 1; })()`);
    await sleep(2000);
  }
  fs.writeFileSync(path.join(DIR, BK + '_strip.json'), JSON.stringify(out, null, 1));
  await b.close(); process.exit(0);
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
