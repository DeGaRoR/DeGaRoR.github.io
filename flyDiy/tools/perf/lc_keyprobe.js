#!/usr/bin/env node
// lc_keyprobe.js - LOAD-COMPILE (G1085): EVERY PROGRAM THE ONE LOADING MAKES, WITH THE STEP THAT MADE IT AND ITS KEY.
// The page in node (tools/_page_node.js, FRAMECOST's hooks: the real three.js on the recording GL). Each program three
// creates (renderer.info.programs.push) is recorded with the boot step it fell in (FRAMECOST's bootMark) and its full
// cacheKey; the read-out groups them by step and, for each program made AFTER the world's prelink ('garage:town'),
// finds the closest key the prelink made for the same shader and prints where they differ - a key made twice (a light
// count, a define) is a link paid twice.
//   node tools/perf/lc_keyprobe.js [--build <file.json>] [--out <file.json>]
'use strict';
const fs = require('fs'), path = require('path');
const FC = require('../_framecost_check.js');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
(async () => {
  const { openPage } = require('../_page_node.js');
  const C = FC.bootMark.C = { who: null, obr: 0, oar: 0, obs: 0, mobr: 0, umw: 0, um: 0, frustum: 0, terrainH: 0, grHeight: 0, renders: 0, pick: null };
  const base = FC.pageHooks(C, () => null);
  const PROGS = [];
  let wrapped = false;
  const wrap = P => {
    if (wrapped) return; const R = P.win.FLYDIY_RENDERER; if (!R || !R.info || !R.info.programs) return;
    wrapped = true; const arr = R.info.programs, push = arr.push;
    // LC_DEBUG=<mark>: every renderer.compile in that step, with the lights three will count in its lit scene
    if (process.env.LC_DEBUG) { const cmp = R.compile, dbg = {}; P.win.__LCDBG = dbg;
      R.compile = function (sc, cam, lit) { if (FC.bootMark.cur === process.env.LC_DEBUG) { const t = lit || sc; let p = 0, s = 0, all = 0;
        t.traverseVisible(o => { if (o.isLight && o.layers.test(cam.layers)) { if (o.isPointLight) p++; else if (o.isSpotLight) s++; } });
        t.traverse(o => { if (o.isPointLight || o.isSpotLight) all++; });
        const M = P.win.FLIGHT_PROBE && P.win.FLIGHT_PROBE.model && P.win.FLIGHT_PROBE.model();
        const k = (t.name || t.type) + ' p' + p + ' s' + s + ' all' + all + ' model:' + (M && M.grp ? (M.grp.visible + '/' + (M.grp.parent && (M.grp.parent.parent === t) ) ) : 'none'); dbg[k] = (dbg[k] || 0) + 1; }
        return cmp.apply(this, arguments); }; }
    // LC_STACK=<mark>: the JS stack of every program made in that step (who compiles it)
    arr.push = function () { for (const p of arguments) { const mark = FC.bootMark.cur || '?';
      PROGS.push({ mark, name: p.name, key: String(p.cacheKey), frame: -1, stack: process.env.LC_STACK === mark ? String(new Error().stack).split(String.fromCharCode(10)).slice(2, 16).map(l => l.trim().replace(/\(.*[\/\\]/, '(')).join(' < ') : undefined }); }
      return push.apply(this, arguments); };
  };
  const hooks = { beforeScript(n, P) { base.beforeScript(n, P); }, afterScript(n, P) { base.afterScript(n, P); wrap(P); } };
  const storage = {}; if (opt('build', null)) storage['flydiy.wip'] = fs.readFileSync(path.resolve(opt('build')), 'utf8');
  const P = await openPage({ quiet: true, storage, hooks, query: '' });
  const W = P.win;
  wrap(P);
  const t0 = Date.now();
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 1800000);
  FC.bootMark.close();
  console.log('boot done in ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s, programs ' + PROGS.length);
  // by step
  const by = {}; for (const p of PROGS) by[p.mark] = (by[p.mark] || 0) + 1;
  console.log('programs made, by step: ' + JSON.stringify(by));
  // the same shader's keys: the prelink's vs every later one - where do they differ?
  const parts = k => k.split(',');
  const pre = PROGS.filter(p => p.mark === 'garage:town');
  const later = PROGS.filter(p => /garage:(worldCompile|frames|craft|compile|firstFrame|images|recheck)/.test(p.mark));
  const why = {};
  for (const p of later) {
    let best = null, bd = 1e9;
    const pp = parts(p.key);
    for (const q of pre) { if (q.name !== p.name) continue; const qq = parts(q.key); if (qq.length !== pp.length) continue;
      let d = 0; for (let i = 0; i < pp.length; i++) if (pp[i] !== qq[i]) d++; if (d < bd) { bd = d; best = qq; } }
    if (!best) { const k = p.mark + ' | no prelink twin'; why[k] = (why[k] || 0) + 1; continue; }
    const diffs = []; for (let i = 0; i < pp.length; i++) if (pp[i] !== best[i]) diffs.push('#' + i + ':' + best[i].slice(0, 24) + '->' + pp[i].slice(0, 24));
    const k = p.mark + ' | ' + diffs.join(' ');
    why[k] = (why[k] || 0) + 1;
  }
  console.log('later programs vs the prelink\'s twin (count | step | differing key fields):');
  for (const [k, n] of Object.entries(why).sort((a, b) => b[1] - a[1]).slice(0, 60)) console.log('  ' + String(n).padStart(4) + '  ' + k);
  // a key made TWICE: its first program was released (every material wearing it disposed) and the same link paid again
  const seenK = new Map(), twice = {};
  for (const p of PROGS) { if (seenK.has(p.key)) { const k = seenK.get(p.key) + ' -> ' + p.mark + ' ' + p.name; twice[k] = (twice[k] || 0) + 1; } else seenK.set(p.key, p.mark); }
  console.log('keys made twice (first step -> again in, name): ' + JSON.stringify(twice));
  // by step and shader name
  const byName = {}; for (const p of PROGS) { const k = p.mark + ' ' + p.name; byName[k] = (byName[k] || 0) + 1; }
  console.log('by step and name: ' + JSON.stringify(byName));
  console.log('trips: ' + JSON.stringify((W.FLYDIY_TRIPS || []).map(t => ({ kind: t.kind, ran: t.steps.filter(s => s.ran).map(s => s.id + ':' + s.why) }))));
  if (process.env.LC_DEBUG) console.log('compiles in ' + process.env.LC_DEBUG + ': ' + JSON.stringify(W.__LCDBG));
  if (process.env.LC_STACK) { const st = {}; for (const p of PROGS) if (p.stack) st[p.stack] = (st[p.stack] || 0) + 1; console.log('stacks in ' + process.env.LC_STACK + ':'); for (const [k, n] of Object.entries(st)) console.log('  ' + n + '  ' + k); }
  const out = opt('out', null); if (out) fs.writeFileSync(out, JSON.stringify({ by, progs: PROGS, trips: W.FLYDIY_TRIPS }, null, 0));
  process.exit(0);
})().catch(e => { console.log('FAIL ' + (e && e.stack || e)); process.exit(1); });
