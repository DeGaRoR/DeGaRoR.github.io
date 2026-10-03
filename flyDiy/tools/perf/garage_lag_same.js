#!/usr/bin/env node
// garage_lag_same.js - GARAGE-LAG-2 (G1300-G1302): THE SHORT PATHS LEAVE THE SAME AEROPLANE AS THE LONG ONE.
// The editor now keeps the sheet while its spec is unchanged (G1300), repaints on a paint row (G1301) and defers the
// tank release's shakedown (G1302). Each is claimed exact; this rig measures the claim both ways in the real page.
// For each build (the Cub, the metal Cessna) and each change, the row is moved the player's way (its widget, its
// event: the short path runs), the editor's whole scene is fingerprinted (every object in order: type, name,
// visibility, matrix; a mesh's geometry - counts and a sum over its positions and index - and every material slot:
// type, colour, opacity and the flags, its defines and every uniform's value, textures by name and size), then the
// SAME parameters are built the long way (CAGE_UI.sheetKeep = false, CAGE_UI.build()) and fingerprinted again.
// Any difference is printed and fails the run. The materials also compare by identity (the pools hand back the same
// object for the same look): reported, informational.
// Usage: node tools/perf/garage_lag_same.js --port 8873 --udd <fresh dir> [--builds cub,metal] [--tree flyDiy]
// No --help (an unknown flag is ignored).
'use strict';
const fs = require('fs'), path = require('path');
const MB = require('../master_bench.js');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const PORT = +opt('port', 0), UDD = opt('udd', null);
if (!PORT || !UDD) { console.error('garage_lag_same: --port and --udd are required'); process.exit(2); }
const REPO = path.resolve(__dirname, '..', '..', '..');
const TREE = opt('tree', 'flyDiy');
const BUILDS = { cub: { label: 'Cub', build: 'tools/perf/garage_lag_cub_wip.json' }, metal: MB.BUILDS.metal };
const WANT = opt('builds', 'cub,metal').split(',');
const ONLY = opt('only', null) ? new Set(opt('only').split(',')) : null;
const OUT = path.resolve(opt('out', path.join(__dirname, 'garage_lag_same_' + Date.now() + '.json')));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = s => console.log('  ' + s);

// the changes: [name, page expression for the widget, the long way]
const ROW = id => `document.getElementById(${JSON.stringify(id)})`;
const FIN = re => `(() => [...document.querySelectorAll('input')].find(x => typeof x.oninput === 'function' && ${re}.test(((x.closest('.r') || x.parentElement || {}).textContent || '').trim())) || null)()`;
const CHANGES = [
  ['wingSpan', ROW('p_wgSpan')], ['wingChord', ROW('p_wgChord')], ['tailSize', ROW('p_stSpan')], ['gearTrack', ROW('p_s1X')],
  ['engine', ROW('p_engPreset')], ['fuseLen', ROW('p_paxLen')], ['fuseWidth', ROW('p_halfW')], ['frame', ROW('p_frCabTopW')],
  ['wingSpan2', ROW('p_wgSpan')],
  ['baseColour', `(() => [...document.querySelectorAll('input[type=color]')].find(x => typeof x.oninput === 'function' && /^base colour/.test(((x.closest('.r') || x.parentElement || {}).textContent || '').trim())) || null)()`],
  ['baseMetal', FIN('/^base metallic/')], ['baseRough', FIN('/^base roughness/')],
  ['secColour', `(() => [...document.querySelectorAll('.r[data-sec] input[type=color]')].find(x => typeof x.oninput === 'function') || null)()`],
  ['secDial', `(() => [...document.querySelectorAll('.r.dial input[type=range]')].find(x => /roughness x/.test(((x.closest('.r') || {}).textContent || ''))) || null)()`],
  ['baseColour2', `(() => [...document.querySelectorAll('input[type=color]')].find(x => typeof x.oninput === 'function' && /^base colour/.test(((x.closest('.r') || x.parentElement || {}).textContent || '').trim())) || null)()`],
];

const FP = `(() => {
  const S = window.CAGE_SCENE; if (!S) return null;
  const r = x => Math.round(x * 1e5) / 1e5;
  const val = v => { if (v == null) return String(v); if (typeof v === 'number') return String(r(v)); if (typeof v === 'boolean' || typeof v === 'string') return String(v);
    if (v.isTexture) return 'tex:' + (v.name || '') + ':' + ((v.image && v.image.width) || 0) + 'x' + ((v.image && v.image.height) || 0);
    if (v.isColor) return 'c' + v.getHexString(); if (typeof v.toArray === 'function') return '[' + v.toArray().map(r).join(',') + ']';
    if (Array.isArray(v)) return '[' + v.map(val).join(',') + ']'; return typeof v; };
  // userData walked by hand (JSON would call a texture's toJSON, uuid and all, before any replacer saw it)
  const ud = (x, d) => { if (x == null || typeof x !== 'object') return typeof x === 'function' ? 'fn' : val(x); if (x.isTexture || x.isColor || typeof x.toArray === 'function') return val(x);
    if (d > 4) return '...'; if (Array.isArray(x)) return '[' + x.map(y => ud(y, d + 1)).join(',') + ']';
    return '{' + Object.keys(x).sort().map(k => k + ':' + ud(x[k], d + 1)).join(',') + '}'; };
  const matFp = m => { if (!m) return 'none'; const o = [m.type, m.name || '', m.color ? m.color.getHexString() : '', m.emissive ? m.emissive.getHexString() : '', r(m.opacity), m.transparent, m.side, m.depthWrite, m.depthTest,
      m.polygonOffset, m.polygonOffsetFactor, m.visible, m.metalness != null ? r(m.metalness) : '', m.roughness != null ? r(m.roughness) : '', (m.clippingPlanes || []).length, JSON.stringify(m.defines || {}),
      m.map ? val(m.map) : '', ud(m.userData, 0)];
    const U = m.uniforms || (m.userData && m.userData.U) || null; if (U) for (const k of Object.keys(U).sort()) o.push(k + '=' + val(U[k] && U[k].value));
    return o.join('|'); };
  const geoFp = g => { if (!g) return 'none'; const p = g.getAttribute && g.getAttribute('position'); let s = 0, q = 0; if (p) for (let i = 0; i < p.array.length; i++) { s += p.array[i]; q += p.array[i] * ((i % 7) + 1); }
    const ix = g.index; let si = 0; if (ix) for (let i = 0; i < ix.array.length; i++) si = (si + ix.array[i] * ((i % 13) + 1)) % 1e9;
    return (p ? p.count : 0) + ':' + (ix ? ix.count : 0) + ':' + r(s) + ':' + r(q) + ':' + si + ':' + Object.keys(g.attributes || {}).sort().join(',') + ':' + (g.groups || []).map(x => x.start + '/' + x.count + '/' + x.materialIndex).join(';'); };
  const out = [], ids = [];
  S.updateMatrixWorld(true);
  S.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    // a Bone's pose is the crew's idle animation (it moves between two frames of the same build): its name only
    out.push([o.type, o.name || '', o.visible, o.renderOrder, o.isBone ? 'animated' : o.matrixWorld.elements.map(r).join(','), o.geometry ? geoFp(o.geometry) : '', ms.map(matFp)].join(' # '));
    ids.push(ms.map(m => m ? m.uuid : '-').join(',')); });
  return JSON.stringify({ out, ids });
})()`;

(async () => {
  if (await MB.serveRoot(PORT)) { console.error('garage_lag_same: port ' + PORT + ' is taken'); process.exit(4); }
  const srv = MB.serve(PORT); await sleep(800);
  const root = await MB.serveRoot(PORT);
  if (!root || path.resolve(root) !== REPO) { console.error('garage_lag_same: the server serves ' + root); try { srv.kill(); } catch (e) {} process.exit(4); }
  process.on('exit', () => { try { srv.kill(); } catch (e) {} });
  const R = { date: new Date().toISOString(), tree: TREE, rows: [] };
  let bad = 0, b = null;
  for (const bk of WANT) {
    const B = BUILDS[bk]; log('== ' + B.label);
    if (b) await b.close(); b = await MB.browser(UDD);
    const l = await b.load('http://localhost:' + PORT + '/' + TREE + '/index.html', MB.preScript(B.build, null, B.patch));
    log('loaded ' + l.state + ' in ' + l.sec + ' s'); await sleep(6000);
    for (const [name, expr] of CHANGES.filter(c => !ONLY || ONLY.has(c[0]))) {
      const got = JSON.parse(await b.ev(`(async () => { const el = ${expr}; if (!el) return JSON.stringify({ missing: true });
        const U = window.CAGE_UI; U.sheetKeep = true; U.repaintOn = true;
        const q = () => new Promise(r => setTimeout(r, 400));
        let v; if (el.tagName === 'SELECT') { const o = [...el.options].map(x => x.value); v = o[(o.indexOf(el.value) + 1) % o.length]; }
        else if (el.type === 'color') { v = '#' + ((parseInt(el.value.slice(1), 16) + 0x3a2f17) & 0xffffff).toString(16).padStart(6, '0'); }
        else { const lo = +el.min, hi = +el.max, x = +el.value, st = +el.step || 0.01; v = String(Math.min(hi, Math.max(lo, x + ((hi - x) > (x - lo) ? 1 : -1) * Math.max(st, (hi - lo) * 0.03)))); }
        // a slider is dragged (the pointer held: G1303's deferred tick), then the hand stops: its settle build runs
        const drag = el.type === 'range' && /^p_/.test(el.id || '');
        if (drag) el.dispatchEvent(new PointerEvent('pointerdown'));
        const t0 = performance.now(); el.value = v; el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input')); const ms = performance.now() - t0;
        // the drag settles first (its pause); every other change is read in the same task, before any timer it
        // armed (the autosave's commit writes the paint block the decals read) can move the state under the long way
        if (drag) { await q(); await q(); window.dispatchEvent(new PointerEvent('pointerup')); await q(); }
        const info = U.repaintInfo || null; U.repaintInfo = null;
        const A = ${FP};
        U.sheetKeep = false; const t1 = performance.now(); U.build(); const msLong = performance.now() - t1; U.sheetKeep = true;
        const Bf = ${FP};
        U.sheetKeep = false; U.build(); U.sheetKeep = true; const Cf = ${FP};
        await q();
        return JSON.stringify({ v, ms: +ms.toFixed(1), msLong: +msLong.toFixed(1), info, A: JSON.parse(A), B: JSON.parse(Bf), C: JSON.parse(Cf) }); })()`, 300000));
      if (got.missing) { log(name.padEnd(12) + ' NO WIDGET'); R.rows.push({ build: bk, change: name, missing: true }); continue; }
      // the long way twice: an object the long way itself does not repeat (the crew's IK starts from the pose it
      // stands in) is noise, not the short path's - counted apart, never as a difference
      const A = got.A.out, Bo = got.B.out, Co = got.C.out, diffs = [], noise = [];
      for (let i = 0; i < Math.max(A.length, Bo.length); i++) {
        if (A[i] === Bo[i]) continue;
        if (A.length === Bo.length && Bo.length === Co.length && (Bo[i] !== Co[i] || A[i] === Co[i])) { noise.push(i); continue; }
        const a = A[i] || '(none)', bb = Bo[i] || '(none)'; let c = 0; while (c < a.length && a[c] === bb[c]) c++;
        diffs.push([i, a.slice(0, 60) + ' ... @' + c + ': ' + a.slice(Math.max(0, c - 120), c + 200), bb.slice(0, 60) + ' ... @' + c + ': ' + bb.slice(Math.max(0, c - 120), c + 200)]);
      }
      let noiseLL = 0; for (let i = 0; i < Math.min(Bo.length, Co.length); i++) if (Bo[i] !== Co[i]) noiseLL++;
      let idDiff = 0; for (let i = 0; i < Math.min(got.A.ids.length, got.B.ids.length); i++) if (got.A.ids[i] !== got.B.ids[i]) idDiff++;
      if (diffs.length) bad++;
      R.rows.push({ build: bk, change: name, v: got.v, info: got.info, short: got.ms, long: got.msLong, objects: A.length, diffs: diffs.slice(0, 20), nDiff: diffs.length, idDiff, noise: noise.length, noiseLongLong: noiseLL });
      if (A.length !== Bo.length || Bo.length !== Co.length) log('   (object counts: short ' + A.length + ', long ' + Bo.length + ', long again ' + Co.length + ')');
      if (got.info) log('   repaint: ' + JSON.stringify(got.info));
      log(name.padEnd(12) + ' short ' + String(got.ms).padStart(7) + ' ms  long ' + String(got.msLong).padStart(7) + ' ms  objects ' + A.length + '  ' + (diffs.length ? 'DIFFER ' + diffs.length : 'same') + '  (long vs long: ' + noiseLL + ' objects move by themselves' + (idDiff ? '; material identity differs on ' + idDiff : '') + ')');
      for (const d of diffs.slice(0, 4)) log('   @' + d[0] + '\n     short: ' + d[1] + '\n     long:  ' + d[2]);
    }
    R.rows.push({ build: bk, exc: b.exc.slice(0, 10) });
  }
  if (b) await b.close();
  fs.writeFileSync(OUT, JSON.stringify(R, null, 1)); console.log('  -> ' + OUT);
  console.log(bad ? '  FAIL: ' + bad + ' change(s) differ' : '  PASS: every short path left the long path\'s aeroplane');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('garage_lag_same: ' + (e && e.stack || e)); process.exit(1); });
