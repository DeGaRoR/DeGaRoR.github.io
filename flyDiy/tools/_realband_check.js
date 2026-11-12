#!/usr/bin/env node
// GATE REALBAND (REAL-FIGURES made perennial, 12 Nov 2026): the planes the report stands behind still fly the numbers
// it shows. Every live PLANES row on this tree (tools/_real_stamp.js liveKeys: not dropped, supersededBy, next or on
// another branch) is put through `real_check <key> --quick` (the airframe at MIN / TYP / MTOW, the shape, the empty mass:
// ~30 s a plane, no flights) and compared with tools/realband_baseline.json.
//
// RED when a plane's number moves past its tolerance, when a live plane has no baseline row, or when a baseline row is
// no longer live. A move is either a mistake or a change someone meant (a physics change, a refit of a card): then accept
// it with --write, and re-fly the full set for the report (`node tools/real_check.js --all`, then real_report), because
// every flown result of the moved planes is now stale (the report says so: tools/_real_stamp.js).
// Each red line says whether the plane's build file changed (the aeroplane moved) or only the core (the physics moved).
// Not red: the evidence's freshness (re-flying the full set takes hours); it is printed as a note.
//
//   node tools/_realband_check.js [--selftest] [--jobs=2]   -> "GATE REALBAND: PASS|FAIL"
//   node tools/_realband_check.js --write                   accept the current numbers as the baseline
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { spawn } = require('child_process');
const T = __dirname, ROOT = path.join(T, '..');
const args = process.argv.slice(2), has = k => args.includes('--' + k);
const opt = (k, d) => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const BASE = path.join(T, 'realband_baseline.json');
const ST = require(path.join(T, '_real_stamp.js'));
const { PLANES, REFS } = require(path.join(T, 'real_refs.js'));

// what is compared, and how far it may move: [relative, absolute] - the larger wins. The quick band is deterministic, so
// a move is real; the tolerances let through what would not move a report's figure (a speed by 1 %, a CG by 0.5 point)
const CASE_TOL = { mass: [0.002, 0.5], Vs: [0.01, 0], V75: [0.01, 0], Vmax: [0.01, 0], roc: [0.03, 0.05], LD: [0.02, 0],
                   TOgrass: [0.05, 3], cgMAC: [0, 0.5], sm: [0, 0.5] };
const DIM_TOL = [0.01, 0.01];
const FACT_TOL = { empty: [0.005, 0.5], fuelKg: [0.01, 0.2] };

function summarize(o) {
  const r = { stamp: { file: o.stamp && o.stamp.build && o.stamp.build.file, blob: o.stamp && o.stamp.build && o.stamp.build.blob, core: o.stamp && o.stamp.core },
              facts: {}, dims: {}, cases: {} };
  for (const k of Object.keys(FACT_TOL)) r.facts[k] = o.facts ? o.facts[k] : null;
  const d = (o.shape && o.shape.dims) || {};
  for (const k of Object.keys(d).sort()) r.dims[k] = d[k];
  for (const c of o.cases || []) { const q = {}; for (const k of Object.keys(CASE_TOL)) q[k] = c[k]; r.cases[c.id] = q; }
  return JSON.parse(JSON.stringify(r, (k, v) => (typeof v === 'number' ? +v.toPrecision(6) : v)));
}
const moved = (a, b, [rel, abs]) => {
  if (a == null && b == null) return false;
  if (a == null || b == null || !isFinite(a) !== !isFinite(b)) return true;
  return Math.abs(a - b) > Math.max(rel * Math.abs(b), abs);
};
// compare(now, base) -> the red lines
function compare(now, base) {
  const bad = [];
  for (const k of Object.keys(now)) {
    const n = now[k], b = base[k];
    if (!b) { bad.push(k + ': no baseline row (a new live plane: --write to take it in)'); continue; }
    const why = n.stamp.blob !== b.stamp.blob ? 'its build file changed (' + String(b.stamp.blob).slice(0, 9) + ' -> ' + String(n.stamp.blob).slice(0, 9) + ')'
              : n.stamp.core !== b.stamp.core ? 'the core changed (' + b.stamp.core + ' -> ' + n.stamp.core + ')' : 'build and core unchanged';
    const lines = [];
    for (const f of Object.keys(FACT_TOL)) if (moved(n.facts[f], b.facts[f], FACT_TOL[f])) lines.push(f + ' ' + b.facts[f] + ' -> ' + n.facts[f]);
    for (const f of new Set(Object.keys(n.dims).concat(Object.keys(b.dims)))) if (moved(n.dims[f], b.dims[f], DIM_TOL)) lines.push(f + ' ' + b.dims[f] + ' -> ' + n.dims[f]);
    for (const id of new Set(Object.keys(n.cases).concat(Object.keys(b.cases)))) {
      const nc = n.cases[id], bc = b.cases[id];
      if (!nc || !bc) { lines.push(id + ' case ' + (nc ? 'new' : 'gone')); continue; }
      for (const f of Object.keys(CASE_TOL)) if (moved(nc[f], bc[f], CASE_TOL[f])) lines.push(id + ' ' + f + ' ' + bc[f] + ' -> ' + nc[f]);
    }
    if (lines.length) bad.push(k + ' moved, ' + why + ': ' + lines.join('; '));
  }
  for (const k of Object.keys(base)) if (!now[k]) bad.push(k + ': in the baseline but no longer live (--write to drop it)');
  return bad;
}
function runQuick(keys, jobs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realband-'));
  return new Promise(resolve => {
    let i = 0, live = 0, done = 0; const out = {}, errs = [];
    const next = () => {
      if (done === keys.length) { fs.rmSync(dir, { recursive: true, force: true }); return resolve({ out, errs }); }
      while (live < jobs && i < keys.length) {
        const k = keys[i++], j = path.join(dir, k + '.json'); live++;
        const ch = spawn(process.execPath, [path.join(T, 'real_check.js'), k, '--quick', '--quiet', '--json=' + j], { stdio: ['ignore', 'ignore', 'pipe'] });
        let err = ''; ch.stderr.on('data', d => { err += d; });
        ch.on('exit', code => {
          live--; done++;
          try { out[k] = summarize(JSON.parse(fs.readFileSync(j, 'utf8'))); } catch (e) { errs.push(k + ': real_check --quick exit ' + code + ' ' + err.trim().split('\n').slice(-2).join(' ')); }
          next();
        });
      }
    };
    next();
  });
}

(async () => {
  const keys = ST.liveKeys(PLANES), t0 = Date.now();
  const { out: now, errs } = await runQuick(keys, +opt('jobs', 2));
  if (has('write')) {
    const o = { _note: 'GATE REALBAND baseline: real_check --quick of the live set (tools/_realband_check.js --write). Written ' + new Date().toISOString().slice(0, 10) + '.', planes: now };
    fs.writeFileSync(BASE, JSON.stringify(o, null, 1) + '\n');
    console.log('wrote ' + path.relative(process.cwd(), BASE) + ': ' + Object.keys(now).length + ' planes' + (errs.length ? '; NOT taken (failed): ' + errs.join('; ') : ''));
    process.exit(errs.length ? 1 : 0);
  }
  const base = fs.existsSync(BASE) ? JSON.parse(fs.readFileSync(BASE, 'utf8')).planes : {};
  const bad = errs.concat(compare(now, base));
  if (has('selftest')) {
    const red = (name, b) => { if (!b.length) bad.push('selftest: not red on ' + name); else console.log('  selftest red on ' + name + ': ' + b[0].slice(0, 110)); };
    const k0 = Object.keys(now)[0], cl = o => JSON.parse(JSON.stringify(o));
    let n = cl(now); const c0 = Object.keys(n[k0].cases)[0];
    n[k0].cases[c0].Vs *= 1.02; red('a stall speed 2 % up', compare(n, now));
    n = cl(now); n[k0].facts.empty += 5; red('the empty mass 5 kg up', compare(n, now));
    n = cl(now); n[k0].cases[c0].sm += 1; red('the margin a point up', compare(n, now));
    n = cl(now); n[k0].dims.span *= 1.02; red('the span 2 % up', compare(n, now));
    n = cl(now); delete n[k0]; red('a plane taken out of the live set', compare(n, now));
    n = cl(now); const b = cl(now); delete b[k0]; red('a live plane with no baseline', compare(n, b));
    n = cl(now); n[k0].cases[c0].Vs *= 1.005; if (compare(n, now).length) bad.push('selftest: red on a 0.5 % stall speed (inside its 1 %)');
  }
  // the note: how fresh the report's evidence is (not red)
  try {
    const ev = path.join(ROOT, 'reports', 'evidence'), newest = {};
    for (const d of fs.readdirSync(ev).filter(d => /^REAL-CHECK-/.test(d)).sort())
      for (const f of fs.readdirSync(path.join(ev, d)).filter(f => f.endsWith('.json') && !f.endsWith('.shape.json')))
        try { const o = JSON.parse(fs.readFileSync(path.join(ev, d, f), 'utf8')); if (o.key && o.cases) newest[o.key] = o; } catch (e) {}
    const st = keys.map(k => [k, newest[k] ? ST.check(newest[k], PLANES[k], REFS[PLANES[k].ref]).state : 'never flown']).filter(([, s]) => s !== 'fresh');
    console.log('  note: the report\'s evidence ' + (st.length ? 'is not fresh for ' + st.map(([k, s]) => k + ' (' + s + ')').join(', ') + ' - re-fly them (real_check --all)' : 'is fresh for every live plane'));
  } catch (e) { console.log('  note: the evidence not read (' + e.message + ')'); }
  for (const b of bad) console.log('  FAIL ' + b);
  console.log('  ' + Object.keys(now).length + ' planes in ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
  console.log('GATE REALBAND: ' + (bad.length ? 'FAIL' : 'PASS'));
  process.exit(bad.length ? 1 : 0);
})();
