#!/usr/bin/env node
// slider_audit_node.js - PERF-SLIDERS (23 Nov 2026): WHICH LAYERS RE-RUN FOR NOTHING ON A DRAG TICK, PER AEROPLANE.
// The DC-3's main gear station re-ran the whole crew layer on every tick (1.4 of a 2.0 s tick in the page in node) because
// the dash's gear selector read the row's raw value to ask one thing (s1X > 0.01). PERF-LEAD (23 Nov): "any other layer
// that reads a raw value only to compare it with a threshold ... is the same 35x waiting on another aeroplane; list them".
// Reading the code for them finds the ones looked for; this finds them by what they do. In the page in node
// (tools/_page_node.js), per aeroplane of the plane list and for EVERY slider of the editor that is enabled:
//   the row pressed and moved one small step (a tick), then moved back (a tick); no release between rows (the hand stays
//   down: only the ticks are looked at; one release at the end of the aeroplane);
//   before and after the first tick, each layer's own objects are digested (the scene objects the layer added: type,
//   name, visibility, place, every geometry's vertex count, index count and a weighted sum of its positions);
//   a layer that RAN in the tick (CAGE_CHAIN.last) and whose digest did not move BUILT THE SAME THING: its ms were
//   spent for nothing on this row - by a raw read of the row (`why` = the row's key: a threshold or an option read as a
//   number) or by an edge of the chain that this aeroplane does not use (`why` = fed).
// What a digest cannot see is a layer that changes only what it PUBLISHES (a global the next layer reads) and draws the
// same: every finding is a candidate, to be read against the code before a read is made a derived one. The deferred
// detail layers (access, light, energy, hinge) return early on a tick and are left out.
// The ms are this box's on the machine's clock (window.__realNow), under whatever ran beside: compare inside one run.
// Usage: node --max-old-space-size=6144 tools/perf/slider_audit_node.js [--planes list:12,list:8 | --all] [--min 2] [--out file.json]
//   --min   a wasted run under this many ms is not listed (default 2)
// Through the box's token: bash D:/Dev/flydiy-notes/cpu_token.sh run PERF-SLIDERS -- node ... No --help.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { performance: PERF } = require('perf_hooks');
const ROOT = path.join(__dirname, '..', '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const PLAYER = ['reproduction', 'story', 'original', 'wip'];
const LISTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds/lists/plane_lists.json'), 'utf8')).planes;
const has = p => p && p.file && fs.existsSync(path.join(ROOT, p.file));
const num = s => +String(s).replace(/^list:/, '');
const want = opt('planes', null) ? opt('planes').split(',').map(num) : null;
const PLANES = want ? want.map(n => LISTS.find(p => p.n === n)).filter(has) : LISTS.filter(p => has(p) && !p.rides && (argv.includes('--all') || PLAYER.includes(p.list)));
const MIN = +opt('min', 2);
const OUT = path.resolve(opt('out', path.join(__dirname, 'slider_audit_node_' + Date.now() + '.json')));
const log = s => console.log('  ' + s);
const r1 = x => Math.round(x * 10) / 10;

// the page's half: each layer's own objects, digested
const AUD = `(() => { if (window.__AUD) return 'again';
  const dig = () => { const C = window.CAGE_CHAIN, out = {};
    for (const l of C.layers) { let h = 7, n = 0; const add = x => { h = (Math.imul(h, 31) + (x | 0)) | 0; }, str = s => { for (let i = 0; i < s.length; i++) add(s.charCodeAt(i)); }, q = x => add(Math.round(x * 1e4));
      const walk = o => { n++; str(o.type || ''); str(o.name || ''); add(o.visible ? 1 : 0);
        q(o.position.x); q(o.position.y); q(o.position.z); q(o.quaternion.x); q(o.quaternion.y); q(o.quaternion.z); q(o.quaternion.w); q(o.scale.x); q(o.scale.y); q(o.scale.z);
        const g = o.geometry; if (g && g.attributes && g.attributes.position) { const a = g.attributes.position.array; let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * ((i % 7) + 1); add(a.length); q(s); if (g.index) add(g.index.count); }
        for (const c of o.children) walk(c); };
      for (const o of (l.objs || [])) if (o && o.parent) walk(o);
      out[l.name] = n + ':' + h; }
    return out; };
  window.__AUD = { dig, rows: () => [...document.querySelectorAll('input[type=range]')].filter(e => /^p_/.test(e.id) && !e.disabled).map(e => e.id.slice(2)) };
  return 'ok'; })()`;

(async () => {
  const { openPage } = require('../_page_node.js');
  const R = { date: new Date().toISOString(), min: MIN, planes: [] };
  try { R.sha = require('child_process').execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim(); } catch (e) {}
  const save = () => fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
  log('PERF-SLIDERS slider_audit_node: ' + PLANES.length + ' aeroplanes, every enabled slider, tree ' + R.sha);
  let P = null, W = null, D = null, U = null, CH = null, run = null;
  const boot = async file => {
    if (P) { try { P.close(); } catch (e) {} }
    P = await openPage({ quiet: true, storage: { 'flydiy.wip': fs.readFileSync(path.join(ROOT, file), 'utf8') }, query: 'fleet=0' + (opt('query', '') ? '&' + opt('query') : '') });
    W = P.win; D = W.document; run = c => vm.runInContext(c, P.ctx);
    await P.until(() => W.BOOT && W.BOOT.state === 'gone', 600000);
    await P.until(() => !!W.CAGE_UI, 60000);
    await P.until(() => false, 6000);
    W.__realNow = () => PERF.now();
    U = W.CAGE_UI; CH = W.CAGE_CHAIN; run(AUD);
  };
  const load = async p => {
    W.__AL = 'pending';
    const s0 = run('JSON.stringify(GARAGE_SPEC.get())');
    run('(() => { const p = ' + JSON.stringify({ file: p.file, n: p.n, name: p.name }) + '; try { Promise.resolve(GARAGE_SPEC.openListed(p)).then(() => { window.__AL = "ok"; }, e => { window.__AL = "err " + (e && e.message); }); } catch (e) { window.__AL = "threw " + e.message; } })()');
    await P.until(() => W.__AL !== 'pending', 600000);
    if (W.__AL !== 'ok') return W.__AL;
    await P.until(() => false, 4000);
    if (U.releaseFlush) U.releaseFlush();
    return run('JSON.stringify(GARAGE_SPEC.get())') !== s0 ? 'ok' : 'the spec on the stand did not change';
  };
  const DEF = () => (CH.DEFERS ? CH.DEFERS : new Set(['access', 'light', 'energy', 'hinge']));
  let first = true;
  for (const p of PLANES) {
    const row = { n: p.n, name: p.name, file: p.file, rows: 0, ticks: 0, wasted: [], byLayer: {}, tickMs: 0, wastedMs: 0 }, tP = Date.now();
    try {
      if (first) { await boot(p.file); first = false; row.load = 'boot'; }
      else { row.load = await load(p); if (row.load !== 'ok') { await boot(p.file); row.load = 'boot (after ' + row.load + ')'; } }
      const Ev = W.Event, PE = W.PointerEvent || W.Event, keys = Array.from(run('__AUD.rows()'));
      U.dragSettleMs = 1e9;
      for (const k of keys) {
        const el = D.getElementById('p_' + k); if (!el || el.disabled) continue;
        const lo = +el.min, hi = +el.max, x0 = +el.value, st = +el.step || 0.001; if (!(hi > lo)) continue;
        const d = Math.max(st, (hi - lo) * 0.012), v = (hi - x0) >= d ? x0 + d : x0 - d; if (v < lo - 1e-9) continue;
        const d0 = run('__AUD.dig()'), L0 = CH.last, pv0 = U.preview.n, df0 = U.preview.deform;
        el.dispatchEvent(new PE('pointerdown'));
        const t0 = PERF.now();
        el.value = String(lo + Math.round((v - lo) / st) * st); el.dispatchEvent(new Ev('input'));
        const ms = PERF.now() - t0, pth = U.preview.deform > df0 ? 'deform' : U.preview.n > pv0 ? 'preview' : 'whole';
        row.rows++; row.ticks++; row.tickMs += ms;
        if (pth === 'preview' && CH.last !== L0 && CH.last) {
          const d1 = run('__AUD.dig()'), plan = U.preview.last, why = plan && plan.why ? Array.from(plan.why) : [];
          Array.from(CH.last).forEach((l, i) => { if (!l.ran || DEF().has(l.name) || l.name === 'panel' || l.name === 'ext' || l.name === 'cowlAft') return;
            if (d0[l.name] !== d1[l.name]) return;
            row.wastedMs += l.ms; const b = row.byLayer[l.name] || (row.byLayer[l.name] = { n: 0, ms: 0 }); b.n++; b.ms += l.ms;
            if (l.ms >= MIN) row.wasted.push({ k, layer: l.name, why: why[i] === k ? 'reads ' + k : (why[i] || '?'), ms: r1(l.ms), tick: r1(ms) }); });
        }
        // back where it stood (a tick), the hand still down
        el.value = String(x0); el.dispatchEvent(new Ev('input')); row.ticks++;
        if (row.rows % 8 === 0) await P.frames(1);   // (the page's own housekeeping: the first run, no frame at all, died at a 6 GB heap)
      }
      U.dragSettleMs = 350;
      W.dispatchEvent(new PE('pointerup')); if (U.releaseFlush) U.releaseFlush();
      await P.until(() => false, 1500);
      row.wasted.sort((a, b) => b.ms - a.ms);
      for (const k of Object.keys(row.byLayer)) row.byLayer[k].ms = r1(row.byLayer[k].ms);
      row.tickMs = r1(row.tickMs); row.wastedMs = r1(row.wastedMs); row.sec = Math.round((Date.now() - tP) / 1000);
    } catch (e) { row.error = String(e && e.stack || e).split('\n').slice(0, 3).join(' | '); first = true; }
    R.planes.push(row); save();
    log('list:' + p.n + ' ' + p.name + (row.error ? ': ERROR ' + row.error.slice(0, 200) : ': ' + row.rows + ' rows, their first ticks ' + row.tickMs + ' ms, of it ' + row.wastedMs + ' ms in layers that built the same thing (' +
      Object.entries(row.byLayer).sort((a, b) => b[1].ms - a[1].ms).map(([k, v]) => k + ' ' + v.ms + ' ms x' + v.n).join(', ') + ')  [' + row.sec + ' s]'));
    for (const w of (row.wasted || []).slice(0, 12)) log('     ' + w.k.padEnd(14) + w.layer.padEnd(7) + String(w.ms).padStart(8) + ' ms of a ' + w.tick + ' ms tick   ' + w.why);
  }
  try { P.close(); } catch (e) {}
  save(); log('-> ' + OUT);
  process.exit(0);
})().catch(e => { console.error('slider_audit_node: ' + (e && e.stack || e)); process.exit(1); });
