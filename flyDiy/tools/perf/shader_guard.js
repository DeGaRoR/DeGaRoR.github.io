#!/usr/bin/env node
// shader_guard.js - WHAT RECOMPILES IN FLIGHT (SHADER-GUARD, G1340). The user's flight-recorder logs (2026-10-03) held
// 79 s frames at the line-up skip's take-off: ONE frame, its `shader` slot the whole time, ~60 NEW programs linked in it.
// This rig flies the user's sequence (roll out, skip to line up, the pilot's take-off and climb) on the user's gfx and
// records EVERY program three makes (renderer.info.programs' push: name, cache key, frame, the visible lights by kind,
// the render target, the caller) and every one it destroys (pop), then names each new key's cause: the nearest earlier
// key of the same program name and the parameters that differ.
// Usage: node tools/perf/shader_guard.js --port 8741 --udd D:/sg1 [--tree _sg_3da1] [--day 2026-06-21T23:00Z]
//        [--fly 150] [--gfx <file.json>] [--out <file.json>] [--shed-dusk]   (GPU lock first; no --help: an unknown flag runs it)
//   --tree: a `git archive <sha> flyDiy | tar -x -C <repo>/<tree>` copy served from the same root (the bisect)
'use strict';
const fs = require('fs'), path = require('path');
const MB = require('../master_bench.js');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const PORT = +opt('port', 0), UDD = opt('udd', null), TREE = opt('tree', ''), DAY = opt('day', null), FLY = +opt('fly', 150), OUT = opt('out', null);
const sleep = ms => new Promise(r => setTimeout(r, ms));
if (!PORT || !UDD) { console.error('shader_guard: --port and --udd are required'); process.exit(2); }
// the user's custom near-ultra (flydiy-flightlog-20261003T165355-7u7a header.gfx)
const USER_GFX = { preset: 'custom', pv: 6, fps: 'auto', ground: 'full', scale: 1, cover: 'full', scenery: 'full', drawDist: 'vis', terrain: 1, aa: 'full', density: 200,
  bands: 'mid', shadows: 'full', canopy: 'on', rails: 'on', poles: 'on', glare: 'on', sway: 'on', mist: 'land', clouds: 'full', water: 'full', mirror: 'live', lighting: 'sunset',
  tone: 'cineon', exposure: 1, colour: 'managed', bloom: 'soft', look: 'off', lens: 'off', rays: 'on', ao: 'off', eye: 'on', compositing: 'linear', town: 'nearby' };
const GFX = opt('gfx', null) ? JSON.parse(fs.readFileSync(opt('gfx'), 'utf8')) : USER_GFX;

// THE RECORDER: three's program list, wrapped once the world's renderer exists
const HOOK = `(function(){ if (window.__SG) return; var SG = window.__SG = { add: [], del: [], lf: -1, lk: '' };
  var lights = function (R) { var f = R.info.render.frame; if (f === SG.lf) return SG.lk; SG.lf = f; var c = { d: 0, dS: 0, p: 0, pS: 0, s: 0, sS: 0, h: 0 };
    try { window.WORLD.scene.traverseVisible(function (o) { if (!o.isLight) return; if (o.isDirectionalLight) { c.d++; if (o.castShadow) c.dS++; } else if (o.isPointLight) { c.p++; if (o.castShadow) c.pS++; }
      else if (o.isSpotLight) { c.s++; if (o.castShadow) c.sS++; } else if (o.isHemisphereLight) c.h++; }); } catch (e) {}
    return SG.lk = 'D' + c.d + '/' + c.dS + ' P' + c.p + '/' + c.pS + ' S' + c.s + '/' + c.sS + ' H' + c.h; };
  var who = function () { var s = String(new Error().stack || '').split('\\n').slice(3, 14).map(function (l) { return l.trim().replace(/^at /, '').replace(/\\(?https?:[^)]*\\/([^/)]+)\\)?/, '@$1'); });
    return s.filter(function (l) { return !/WebGL(Programs|Renderer|Objects|Background)|getProgram|setProgram|renderObject|renderObjects|renderScene|projectObject|compile\\b/.test(l); }).slice(0, 4).join(' < '); };
  var hook = function () { var W = window.WORLD, R = W && W.renderer; if (!R || !R.info || !R.info.programs) { setTimeout(hook, 50); return; }
    var A = R.info.programs; if (A.__sg) return; A.__sg = 1; var push = A.push, pop = A.pop;
    A.push = function (p) { try { var rt = R.getRenderTarget(); SG.add.push([+performance.now().toFixed(1), p.id, p.name, String(p.cacheKey), R.info.render.frame, lights(R), rt ? (rt.name || 'rt') + rt.width + 'x' + rt.height : 'canvas', window.BOOT ? BOOT.state : '', who()]); } catch (e) {} return push.apply(this, arguments); };
    A.pop = function () { var p = this[this.length - 1]; try { if (p) SG.del.push([+performance.now().toFixed(1), p.id, p.name, String(p.cacheKey).length, R.info.render.frame]); } catch (e) {} return pop.apply(this, arguments); };
  };
  hook(); })();`;

(async () => {
  if (await MB.serveRoot(PORT)) { console.error('shader_guard: port ' + PORT + ' is taken'); process.exit(4); }
  const srv = MB.serve(PORT); await sleep(800);
  const BASE = 'http://localhost:' + PORT + '/' + (TREE ? TREE + '/' : '') + 'flyDiy/index.html' + (DAY ? '?day=' + DAY : '');
  const b = await MB.browser(path.resolve(UDD));
  const R = { tree: TREE || 'worktree', day: DAY, gfx: GFX, steps: [] };
  const step = (k, v) => { const e = { k, t: Date.now(), v }; R.steps.push(e); console.log('[' + new Date().toISOString().slice(11, 19) + '] ' + k + (v !== undefined ? ' ' + JSON.stringify(v) : '')); };
  try {
    const l = await b.load(BASE, MB.preScript('default', GFX) + '\n' + HOOK); step('loaded', l);
    await sleep(3000);
    const waitTrip = async (n0, kind, ms) => { for (const tEnd = Date.now() + ms; Date.now() < tEnd; await sleep(500)) { let d; try { d = JSON.parse(await b.ev(MB.A.lastTrip, 20000)); } catch (e) { continue; } if (d.n > n0 && (!kind || d.kind === kind) && d.done && d.boot === 'gone') return d;
      // a tree without FLYDIY_TRIPS (before B9, 28 Sep): the screen gone and the shed left
      if (!d.n && !n0 && kind === 'rollout' && d.boot === 'gone' && !d.shed && Date.now() > tEnd - ms + 15000) return Object.assign(d, { noTrips: true }); } return null; };
    // --shed-dusk: the day moved to night while the player is in the shed (the user's roll-out after an hour there)
    if (argv.includes('--shed-dusk')) { step('shedDusk', await b.ev("(() => { DAY_CLOCK.preset('night'); return WORLD.lampsWant ? WORLD.lampsWant() : 'n/a'; })()")); await sleep(3000); }
    let n0 = +(await b.ev(MB.A.trips)); step('rollOut', await b.ev(MB.A.rollOut));
    step('rolledOut', await waitTrip(n0, 'rollout', 600000));
    await sleep(2500); step('run', await b.ev(MB.A.run).catch(e => String(e)));
    await b.ev(MB.A.cam('chase')).catch(() => 0);
    await sleep(4000);
    const tSkip = +(await b.ev('performance.now()')), tWall = Date.now();
    n0 = +(await b.ev(MB.A.trips));
    step('skip', await b.ev("(() => { const s = document.getElementById('bSkip'); if (!s) return 'no button'; if (s.disabled) return 'disabled: ' + s.title; s.click(); return 'ok'; })()"));
    await waitTrip(n0, 'lineup', 120000).then(d => step('lineupTrip', d));
    // the pilot flies: watch the phase, the AGL and the frame dt until FLY s of page time after the skip
    for (let i = 0; ; i++) {
      await sleep(5000);
      if (Date.now() - tWall > (FLY + 240) * 1000) { step('wallCap', null); break; }   // never a run that cannot end
      let s; try { s = JSON.parse(await b.ev("JSON.stringify({ t: performance.now(), ph: (() => { try { return FLIGHT_PROBE.ap().phase; } catch (e) { return '?'; } })(), agl: (() => { try { return +FLIGHT_PROBE.agl().toFixed(1); } catch (e) { try { return +FLIGHT_PROBE.sim().cgPos()[1].toFixed(1); } catch (x) { return null; } } })(), progs: WORLD.renderer.info.programs.length, add: __SG.add.length, worst: Math.max(0, ...__MB.fr.slice(-400).map(f => f[1])) })", 200000)); } catch (e) { step('poll', String(e)); continue; }
      if (i % 3 === 0) step('fly', s);
      if (s.t - tSkip > FLY * 1000) break;
    }
    const d = JSON.parse(await b.ev("JSON.stringify({ add: __SG.add, del: __SG.del, fr: __MB.fr.map(f => [f[0], f[1]]), ln: (__MB.ln || []).map(e => [Math.round(e[0]), Math.round(e[1])]), lt: __MB.lt,"
      + " guard: window.FLYDIY_GUARD ? FLYDIY_GUARD.stats : null, lamps: (() => { const L = WORLD.premises && WORLD.premises.lamps; return L ? { armed: L.armed, ready: L.ready, prepping: L.prepping, litNow: L.litNow, pool: L.pool.length } : null; })(),"
      + " rec: window.FLIGHT_REC && FLIGHT_REC.rec ? FLIGHT_REC.rec.events.filter(e => e[1] === 'shaderslow' || e[1] === 'freeze') : null })", 120000));
    R.tSkip = tSkip; R.add = d.add; R.del = d.del; R.ln = d.ln; R.guard = d.guard; R.lamps = d.lamps; R.rec = d.rec;
    step('guard', d.guard); step('lamps', d.lamps);
    for (const e of (d.rec || []).filter(e => e[0] > tSkip - 5000)) step('rec', e);
    R.long = d.fr.filter(f => f[1] > 250).map(f => [Math.round(f[0]), Math.round(f[1])]);
    R.exc = b.exc.slice(0, 10);
  } catch (e) { step('ERROR', String(e && e.stack || e)); }
  await b.close();
  try { srv.kill(); require('child_process').execSync('taskkill /PID ' + srv.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {}
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(R));
  report(R);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });

// THE CAUSE OF EACH NEW KEY: the same name's nearest earlier key, token by token (three's key is comma-joined)
function report(R) {
  if (!R.add) return;
  const after = R.add.filter(a => a[0] > R.tSkip - 2000);
  console.log('programs: ' + R.add.length + ' made, ' + (R.del || []).length + ' destroyed; ' + after.length + ' made from the skip on');
  console.log('frames over 250 ms after the skip: ' + JSON.stringify((R.long || []).filter(f => f[0] > R.tSkip)));
  const byName = new Map();
  const diffs = new Map();
  for (const a of R.add) {
    const [t, id, name, key, fr, lk, rt, boot, who] = a;
    const prev = byName.get(name) || [];
    if (t > R.tSkip - 2000) {
      let best = null, bd = 1e9; const tk = key.split(',');
      for (const p of prev) { const pk = p.split(','); if (pk.length !== tk.length) continue; let n = 0; for (let i = 0; i < tk.length; i++) if (pk[i] !== tk[i]) n++; if (n < bd) { bd = n; best = pk; } }
      let cause = best ? tk.map((v, i) => best[i] !== v ? '#' + i + ':' + best[i] + '->' + v : null).filter(Boolean).join(' ') : 'NO EARLIER KEY OF THIS NAME (' + prev.length + ' of other lengths)';
      if (prev.includes(key)) cause = 'SAME KEY AS AN EARLIER PROGRAM (released and re-made)';
      const k = cause.slice(0, 200);
      const g = diffs.get(k) || { n: 0, names: new Set(), frames: new Set(), lights: new Set(), rts: new Set(), who: new Set(), boot: new Set() };
      g.n++; g.names.add(name); g.frames.add(fr); g.lights.add(lk); g.rts.add(rt); g.who.add(who.slice(0, 160)); g.boot.add(boot); diffs.set(k, g);
    }
    prev.push(key); byName.set(name, prev);
  }
  for (const [k, g] of diffs) console.log('  ' + g.n + ' x ' + k + '\n     names ' + [...g.names].slice(0, 8).join(', ') + '\n     frames ' + [...g.frames].slice(0, 10).join(',') + ' lights ' + [...g.lights].join(' | ') + ' rt ' + [...g.rts].join(',') + ' boot ' + [...g.boot].join(',') + '\n     who ' + [...g.who].slice(0, 3).join('\n         '));
}
