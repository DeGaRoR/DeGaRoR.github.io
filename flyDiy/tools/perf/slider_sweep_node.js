#!/usr/bin/env node
// slider_sweep_node.js - PERF-SLIDERS (23 Nov 2026): THE DRAG'S OWN WORK, PER AEROPLANE, IN THE PAGE IN NODE (no GPU).
// The user (22 Nov, from a playtest): "editing the dc3 is really laggy on the phone, while the chinook was really easy.
// Let's make sure that all planes are workable. The thing is laggy even before it updates." PERF-OBJECTIVES row 1: no frame
// over 50 ms while a slider moves. The browser sweep (slider_sweep.js, a GPU window) says what the player meets; this one
// says WHY, with no GPU and no window: the page in node (tools/_page_node.js, GATE INSTANT's harness), each aeroplane of
// the plane list put on the stand, and per slider a drag as the editor hears it (pointerdown, an `input` a tick, the
// slider's change, the pointer up):
//   - each tick's handler ms on the MACHINE's clock (window.__realNow: the chain's and the edit log's own real clock),
//     its path (deform / preview / whole), the post chain's layers that ran and their ms (CAGE_CHAIN.last);
//   - the frame after each tick through the recording GL: draw calls, GL calls, buffer bytes uploaded (the counts are
//     the tree's, the same on every box: what a gate can hold);
//   - the release (change + pointer up + the settle build) and a plain whole build of the same row;
//   - the aeroplane on the stand: meshes, triangles, vertices (CAGE_SCENE, visible).
// --prof list:12,list:8: those planes' ticks once more under the inspector's CPU profiler (ticks only: no frame, no
// release inside the profile) - <out>_<n>.cpuprofile + the self time by function and by file in the JSON.
// The ms are this box's, under whatever ran beside it (nice 19, a token): compare planes inside ONE run, never two runs.
// Usage: node --max-old-space-size=4096 tools/perf/slider_sweep_node.js [--planes list:12,list:8 | --all] [--rows wgSpan,paxLen,s1X]
//          [--ticks 10] [--prof list:12,list:8] [--query profile=phone] [--fresh] [--out file.json]
//   --planes   rows of builds/lists/plane_lists.json by number (default: the player's classes with a file, garage.js
//              PLAYER_CLASSES); --all: every row with a file
//   --rows     the sliders (default: a wing dimension, a fuselage dimension, a position - the first of each family the
//              aeroplane has: wgSpan|wgChord, paxLen|halfW|boomLen, s1X|engY|stX)
//   --fresh    a page boot per aeroplane (flydiy.wip, as GATE INSTANT) instead of the garage's own load in one page
// Through the box's token: bash D:/Dev/flydiy-notes/cpu_token.sh run PERF-SLIDERS -- node ... No --help.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), inspector = require('inspector');
const { performance: PERF } = require('perf_hooks');
const ROOT = path.join(__dirname, '..', '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const TICKS = +opt('ticks', 10), QUERY = opt('query', ''), FRESH = flag('fresh');
const BUDGET = +opt('budget', 0), FORCE = opt('force', null);   // --force held|lite|live: CAGE_UI.dragBudgetForce   // --budget <ms>: CAGE_UI.dragBudgetMs (fix 1, the drag budget), the held / live ticks counted
const OUT = path.resolve(opt('out', path.join(__dirname, 'slider_sweep_node_' + Date.now() + '.json')));
const FAMILIES = opt('rows', null) ? opt('rows').split(',').map(k => [k]) : [['wgSpan', 'wgChord'], ['paxLen', 'halfW', 'boomLen'], ['s1X', 'engY', 'stX']];
const PLAYER = ['reproduction', 'story', 'original', 'wip'];
const LISTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds/lists/plane_lists.json'), 'utf8')).planes;
const has = p => p.file && fs.existsSync(path.join(ROOT, p.file));
const want = opt('planes', null) ? opt('planes').split(',').map(s => +String(s).replace(/^list:/, '')) : null;
const PLANES = want ? want.map(n => LISTS.find(p => p.n === n)).filter(p => p && has(p))
  : LISTS.filter(p => has(p) && !p.rides && (flag('all') || PLAYER.includes(p.list)));
const PROF = (opt('prof', '') || '').split(',').filter(Boolean).map(s => +String(s).replace(/^list:/, ''));
const log = s => console.log('  ' + s);
const now = () => PERF.now();
const r1 = x => x == null ? null : Math.round(x * 10) / 10;
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const sum = o => Object.values(o || {}).reduce((a, x) => a + x, 0);

// the aeroplane on the stand: what is visible in the editor's scene (an invisible group's children are not walked)
const CENSUS = `(() => { const S = window.CAGE_SCENE; if (!S) return null; let meshes = 0, tris = 0, verts = 0, objs = 0, mats = new Set();
  const walk = o => { if (!o.visible) return; objs++;
    if (o.isMesh && o.geometry && o.geometry.attributes && o.geometry.attributes.position) { const g = o.geometry, n = g.attributes.position.count; meshes++; verts += n;
      tris += (g.index ? g.index.count : n) / 3 * (o.isInstancedMesh ? o.count : 1); for (const m of (Array.isArray(o.material) ? o.material : [o.material])) if (m) mats.add(m.uuid); }
    for (const c of o.children) walk(c); };
  walk(S); return JSON.stringify({ objs, meshes, tris: Math.round(tris), verts, materials: mats.size }); })()`;

function selfTop(p, n) {
  const byId = new Map(p.nodes.map(x => [x.id, x])), self = new Map(), file = new Map(); let total = 0;
  for (let i = 0; i < p.samples.length; i++) { const nd = byId.get(p.samples[i]), us = p.timeDeltas[i + 1] || 0; if (!nd) continue;
    const cf = nd.callFrame, f = (cf.url || '').split(/[\\/]/).pop().split('?')[0] || '(native)', k = (cf.functionName || '(anon)') + ' ' + f + ':' + (cf.lineNumber + 1);
    if (/^\((idle|program|root)\)/.test(cf.functionName || '')) continue;
    total += us; self.set(k, (self.get(k) || 0) + us); file.set(f, (file.get(f) || 0) + us); }
  const top = m => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, us]) => [k, +(us / 1000).toFixed(1)]);
  return { totalMs: +(total / 1000).toFixed(1), fn: top(self), file: top(file) };
}

(async () => {
  const { openPage } = require('../_page_node.js');
  const R = { date: new Date().toISOString(), ticks: TICKS, query: QUERY, fresh: FRESH, node: process.version, planes: [] };
  try { R.sha = require('child_process').execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim(); } catch (e) {}
  const save = () => fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
  log('PERF-SLIDERS slider_sweep_node: ' + PLANES.length + ' aeroplanes, ' + TICKS + ' ticks a slider, tree ' + R.sha + (QUERY ? ', ?' + QUERY : ''));
  let P = null, W = null, D = null, U = null, run = null;
  const boot = async file => {
    if (P) { try { P.close(); } catch (e) {} }
    const t0 = Date.now();
    P = await openPage({ quiet: true, storage: { 'flydiy.wip': fs.readFileSync(path.join(ROOT, file), 'utf8') }, query: 'fleet=0' + (QUERY ? '&' + QUERY : '') });
    W = P.win; D = W.document; run = c => vm.runInContext(c, P.ctx);
    await P.until(() => W.BOOT && W.BOOT.state === 'gone', 600000);
    await P.until(() => !!W.CAGE_UI, 60000);
    await P.until(() => false, 6000);
    W.__realNow = now;
    U = W.CAGE_UI;
    if (BUDGET > 0) U.dragBudgetMs = BUDGET;
    if (FORCE) U.dragBudgetForce = FORCE;
    return Date.now() - t0;
  };
  const load = async p => {
    W.__SW = 'pending';
    const s0 = run('JSON.stringify(GARAGE_SPEC.get())');
    run('(() => { const p = ' + JSON.stringify({ file: p.file, n: p.n, name: p.name }) + '; try { Promise.resolve(GARAGE_SPEC.openListed(p)).then(() => { window.__SW = "ok"; }, e => { window.__SW = "err " + (e && e.message); }); } catch (e) { window.__SW = "threw " + e.message; } })()');
    await P.until(() => W.__SW !== 'pending', 600000);
    if (W.__SW !== 'ok') return W.__SW;
    await P.until(() => false, 4000);
    if (U.releaseFlush) U.releaseFlush();
    // (GARAGE_SPEC.listed() goes null when the load's own sync replaces the spec: on the stand = the spec changed)
    return run('JSON.stringify(GARAGE_SPEC.get())') !== s0 ? 'ok' : 'the spec on the stand did not change';
  };
  const snapD = (a, b) => ({ draws: sum(b.draws) - sum(a.draws), calls: sum(b.calls) - sum(a.calls), tris: sum(b.tris) - sum(a.tris),
    upKB: Math.round(((b.bytes.bufferData || 0) + (b.bytes.bufferSubData || 0) - (a.bytes.bufferData || 0) - (a.bytes.bufferSubData || 0)) / 1024) });
  const layersNow = () => { const L = W.CAGE_CHAIN && W.CAGE_CHAIN.last; return L ? Array.from(L).filter(l => l.ran).map(l => [l.name, l.ms]) : []; };
  // one drag: the ticks (and, unless bare, the frame after each), then the release and a plain build back at the start
  const drag = async (k, bare) => {
    const el = D.getElementById('p_' + k); if (!el || el.type !== 'range' || el.disabled) return null;
    const Ev = W.Event, PE = W.PointerEvent || W.Event;
    const lo = +el.min, hi = +el.max, x0 = +el.value, st = +el.step || 0.001, dir = (hi - x0) > (x0 - lo) ? 1 : -1, span = Math.abs(dir > 0 ? hi - x0 : x0 - lo) * 0.5;
    const o = { k, x0, x1: null, ticks: [], path: {}, layers: {}, frame: [], frameMs: [] };
    const bg0 = U.budget ? [U.budget.held, U.budget.rests, U.budget.live, U.budget.lites] : null;
    U.dragSettleMs = 1e9;
    el.dispatchEvent(new PE('pointerdown'));
    for (let i = 1; i <= TICKS; i++) {
      el.value = String(lo + Math.round((x0 + dir * span * i / TICKS - lo) / st) * st);
      const pv0 = U.preview.n, df0 = U.preview.deform, L0 = W.CAGE_CHAIN && W.CAGE_CHAIN.last, s0 = bare ? null : P.rec.snapshot();
      const t0 = now(); el.dispatchEvent(new Ev('input')); o.ticks.push(now() - t0);
      const pth = U.preview.deform > df0 ? 'deform' : U.preview.n > pv0 ? (U.budget && U.budget.last === 'lite' ? 'lite' : 'preview') : (U.budget && U.budget.last === 'held' ? 'held' : 'whole');
      o.path[pth] = (o.path[pth] || 0) + 1;
      if (W.CAGE_CHAIN && W.CAGE_CHAIN.last !== L0) for (const [name, ms] of layersNow()) o.layers[name] = (o.layers[name] || 0) + ms;
      if (!bare) { const t1 = now(); await P.frames(1); o.frameMs.push(now() - t1); o.frame.push(snapD(s0, P.rec.snapshot())); }
    }
    o.x1 = +el.value;
    if (bg0) o.budget = { held: U.budget.held - bg0[0], rests: U.budget.rests - bg0[1], live: U.budget.live - bg0[2], lites: U.budget.lites - bg0[3], full: r1(U.budget.full.get(k)), lone: r1(U.budget.lone.get(k)) };
    U.dragSettleMs = 350;
    const rl0 = U.release ? U.release.n : 0, rw0 = U.release ? U.release.whole : 0;
    const tR = now();
    el.dispatchEvent(new Ev('change')); W.dispatchEvent(new PE('pointerup')); if (U.releaseFlush) U.releaseFlush();
    o.release = now() - tR;
    o.releaseHow = !U.release ? null : U.release.n > rl0 ? 'partial' : U.release.whole > rw0 ? 'whole' : 'none';
    await P.until(() => false, 1500);
    // back at the start, by a plain `input` (no pointer down: the whole build, as a click or a typed value)
    el.value = String(x0);
    const tB = now(); el.dispatchEvent(new Ev('input')); el.dispatchEvent(new Ev('change')); o.whole = now() - tB;
    await P.until(() => false, 1500);
    for (const n of Object.keys(o.layers)) o.layers[n] = r1(o.layers[n] / TICKS);
    return o;
  };

  let first = true;
  for (const p of PLANES) {
    const row = { n: p.n, name: p.name, list: p.list, file: p.file, drags: [] };
    try {
      if (first || FRESH) { row.bootMs = await boot(p.file); first = false; row.load = 'boot'; }
      else { const tL = Date.now(); row.load = await load(p); row.loadMs = Date.now() - tL; }
      if (row.load !== 'ok' && row.load !== 'boot') { log('list:' + p.n + ' ' + p.name + ': NOT LOADED (' + row.load + ') - a fresh boot'); row.bootMs = await boot(p.file); row.load = 'boot (after ' + row.load + ')'; }
      row.census = JSON.parse(run(CENSUS) || 'null');
      { const s0 = P.rec.snapshot(); const t0 = now(); await P.frames(5); row.idle = Object.assign({ frameMs: r1((now() - t0) / 5) }, snapD(s0, P.rec.snapshot())); for (const k of ['draws', 'calls', 'tris', 'upKB']) row.idle[k] = Math.round(row.idle[k] / 5); }
      for (const fam of FAMILIES) {
        let d = null; for (const k of fam) { d = await drag(k, false); if (d) break; }
        if (!d) { row.drags.push({ k: fam[0], missing: true }); continue; }
        d.tickMed = r1(med(d.ticks)); d.tickMax = r1(Math.max(...d.ticks)); d.frameMsMed = r1(med(d.frameMs));
        d.drawsMed = med(d.frame.map(f => f.draws)); d.upKBMed = med(d.frame.map(f => f.upKB)); d.callsMed = med(d.frame.map(f => f.calls));
        d.ticks = d.ticks.map(r1); d.frameMs = d.frameMs.map(r1); delete d.frame;
        d.release = r1(d.release); d.whole = r1(d.whole);
        row.drags.push(d);
      }
      row.tickWorst = Math.max(0, ...row.drags.filter(d => !d.missing).map(d => d.tickMed));
      if (PROF.includes(p.n)) {
        const S = new inspector.Session(); S.connect();
        const post = (m, a) => new Promise((res, rej) => S.post(m, a || {}, (e, r) => e ? rej(e) : res(r)));
        await post('Profiler.enable'); await post('Profiler.setSamplingInterval', { interval: 200 });
        row.prof = {};
        for (const d0 of row.drags.filter(d => !d.missing)) {
          const el = D.getElementById('p_' + d0.k), Ev = W.Event, PE = W.PointerEvent || W.Event;
          const lo = +el.min, hi = +el.max, x0 = +el.value, st = +el.step || 0.001, dir = (hi - x0) > (x0 - lo) ? 1 : -1, span = Math.abs(dir > 0 ? hi - x0 : x0 - lo) * 0.5;
          U.dragSettleMs = 1e9; el.dispatchEvent(new PE('pointerdown'));
          await post('Profiler.start');
          for (let i = 1; i <= TICKS * 2; i++) { el.value = String(lo + Math.round((x0 + dir * span * i / (TICKS * 2) - lo) / st) * st); el.dispatchEvent(new Ev('input')); }
          const pr = (await post('Profiler.stop')).profile;
          U.dragSettleMs = 350; el.dispatchEvent(new Ev('change')); W.dispatchEvent(new PE('pointerup')); if (U.releaseFlush) U.releaseFlush();
          await P.until(() => false, 1500);
          el.value = String(x0); el.dispatchEvent(new Ev('input')); el.dispatchEvent(new Ev('change')); await P.until(() => false, 1500);
          const pf = OUT.replace(/\.json$/, '') + '_list' + p.n + '_' + d0.k + '.cpuprofile';
          fs.writeFileSync(pf, JSON.stringify(pr));
          const t = selfTop(pr, 25); t.ticks = TICKS * 2; t.perTickMs = r1(t.totalMs / (TICKS * 2)); t.file_ = path.basename(pf);
          row.prof[d0.k] = t;
        }
        await post('Profiler.disable'); S.disconnect();
      }
      row.errors = P.errors.length; row.errorsLast = P.errors.slice(-4).map(e => String(e).slice(0, 220));
    } catch (e) { row.error = String(e && e.stack || e).split('\n').slice(0, 3).join(' | '); first = true; }
    R.planes.push(row); save();
    log(('list:' + p.n).padEnd(8) + String(p.name).slice(0, 26).padEnd(27) + (row.error ? 'ERROR ' + row.error.slice(0, 160)
      : 'tris ' + String(row.census && row.census.tris).padStart(7) + '  meshes ' + String(row.census && row.census.meshes).padStart(4) + '  idle draws ' + String(row.idle.draws).padStart(4) + '  | ' +
        row.drags.map(d => d.missing ? d.k + ' -' : d.k + ' tick ' + d.tickMed + '/' + d.tickMax + ' [' + Object.keys(d.path).join('+') + '] up ' + d.upKBMed + ' KB rel ' + d.release + ' whole ' + d.whole).join('  | ')));
  }
  try { P.close(); } catch (e) {}
  // the table, worst first (the median tick of the worst slider)
  const T = R.planes.filter(r => !r.error).sort((a, b) => b.tickWorst - a.tickWorst);
  console.log('\n  THE DRAG TICK IN NODE (handler ms on this box, median/max a slider), worst first');
  for (const r of T) console.log('  ' + ('list:' + r.n).padEnd(8) + String(r.name).slice(0, 26).padEnd(27) + String(r.census ? r.census.tris : '').padStart(8) + ' tris  ' +
    r.drags.map(d => d.missing ? (d.k + ' -').padEnd(22) : (d.k + ' ' + d.tickMed + '/' + d.tickMax).padEnd(22)).join(' '));
  save(); log('-> ' + OUT);
  process.exit(0);
})().catch(e => { console.error('slider_sweep_node: ' + (e && e.stack || e)); process.exit(1); });
