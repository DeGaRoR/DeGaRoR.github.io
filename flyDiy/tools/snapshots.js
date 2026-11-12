#!/usr/bin/env node
// SNAPSHOTS (ENGINE-DIALS C, 2026-11-09; A0's brief: "make the per-aircraft snapshots in procurement, freight and
// economy derive from the build, so edits follow"). The pure core cannot measure an aeroplane at run time (a build's
// numbers are genShakedown's, its hold the editor's drawn sheet), so it carries SNAPSHOTS of the validated builds:
//   CONTRACT_DESIGNS  (src/core/72_contract_data.js) mass, empty, take-off, cruise, range, span, cost, tank - the
//                     numbers the contracts, the economy (ECON_BOOK's reference aeroplane) and procurement's stock
//                     certificate read
//   FREIGHT_CARDS     (src/core/76_freight.js) the hold, the seats, the doors and the mass block (tools/_freight_site.js)
//   PROCURE eff       (src/core/76_procure.js) each option's measured effect on its design (tools/_procure_check.js)
// Each was written by hand from a measurement and held by its gate to a tolerance (3 % for CONTRACT_DESIGNS), so an
// edit to a validated build moved the aeroplane and left its snapshot behind: measured today the metal Cessna's file
// gives 880.5 kg / 144 m where the table said 883 / 147. This tool is the ONE writer, from the build files:
//   node tools/snapshots.js --write   re-measures all three off the builds CONTRACT_DESIGNS names and rewrites them,
//                                     then stamps the build files' hash (SNAPSHOTS-OF, in 72_contract_data.js)
//   node tools/snapshots.js --check   the stamp against the build files as they are now (ms): GATE SNAPSHOTS - an
//                                     edit to a validated build is red until its snapshots follow it
// The stamp is the BUILD FILES' bytes (with each design's id, path and patch), never the core: a core change that
// moves a number is the 3 % gates' (CONTRACTS, FREIGHT, PROCURE) to catch, and the writer is the fix for both.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process');
const T = __dirname, ROOT = path.join(T, '..');
const DATA = path.join(ROOT, 'src/core/72_contract_data.js');
const PROCURE = path.join(ROOT, 'src/core/76_procure.js');
const argv = process.argv.slice(2);

// the designs, read off the source (the core may be stale while this runs)
function designs() {
  const src = fs.readFileSync(DATA, 'utf8');
  const a = src.indexOf('const CONTRACT_DESIGNS = {'), b = src.indexOf('\n};', a);
  const DS = new Function('return ' + src.slice(a + 'const CONTRACT_DESIGNS = '.length, b + 2) + ';')();
  return { src, a, b, DS };
}
function stampOf(DS) {
  const h = crypto.createHash('sha256');
  for (const k of Object.keys(DS).sort()) {
    h.update(k + '|' + DS[k].build + '|' + (DS[k].patch || '') + '\n');
    h.update(fs.readFileSync(path.join(ROOT, DS[k].build)));
  }
  return h.digest('hex').slice(0, 16);
}
const STAMP_RE = /\/\/ SNAPSHOTS-OF ([0-9a-f]{16})\b[^\n]*/;
function check() {
  const { src, DS } = designs();
  const m = STAMP_RE.exec(src), now = stampOf(DS);
  const ok = !!m && m[1] === now;
  console.log((ok ? '  ok     ' : '  FAIL   ') + 'the snapshots (CONTRACT_DESIGNS, FREIGHT_CARDS, PROCURE eff) are of the build files as they are: ' +
              'stamped ' + (m ? m[1] : 'never') + ', the files ' + now + (ok ? '' : ' - run node tools/snapshots.js --write'));
  console.log('GATE SNAPSHOTS: ' + (ok ? 'PASS' : 'FAIL'));
  return ok;
}

// ---- the writers --------------------------------------------------------------------------------------------------
// CONTRACT_DESIGNS: GATE CONTRACTS' own measurement (tools/_contracts_check.js measureDesigns), rounded as the table
// writes each field
const ROUND = { massKg: 0, emptyKg: 0, toM: 0, cruiseKmh: 0, rangeKm: 0, spanM: 1, cost: 0, tankL: 1 };
function writeContracts() {
  const CORE = require('./flight_core.js');
  const { src, a, b, DS } = designs();
  let block = src.slice(a, b);
  for (const k of Object.keys(DS)) {
    const D = DS[k];
    const j = JSON.parse(fs.readFileSync(path.join(ROOT, D.build), 'utf8'));
    if (D.patch === 'floats') { j.spec.gear.type = 'floats'; j.spec.cage = Object.assign({}, j.spec.cage, { gearFloats: 1 }); }
    const s = CORE.genShakedown(CORE.buildGen(CORE.genMigrateSpec(j.spec || j)));
    const X = { massKg: s.mass, emptyKg: s.empty, toM: s.TORun, cruiseKmh: s.VCruise * 3.6, rangeKm: s.rangeKm,
                spanM: s.span, cost: s.cost, tankL: s.energyL };
    // the row: from `  <k>: ` to the next row (or the block's end)
    const r0 = block.indexOf('\n  ' + k + ':'), r1 = (() => { const m = /\n  \w+:\s+\{ id:/g; m.lastIndex = r0 + 3; const x = m.exec(block); return x ? x.index : block.length; })();
    let row = block.slice(r0, r1);
    for (const [n, d] of Object.entries(ROUND)) {
      const v = +X[n].toFixed(d);
      row = row.replace(new RegExp('(\\b' + n + ': )-?[0-9.]+'), (m0, p) => p + v);
    }
    block = block.slice(0, r0) + row + block.slice(r1);
    console.log('  CONTRACT_DESIGNS.' + k + ': ' + Object.keys(ROUND).map(n => n + ' ' + (+X[n].toFixed(ROUND[n]))).join(', '));
  }
  fs.writeFileSync(DATA, src.slice(0, a) + block + src.slice(b));
}
const run = (args) => { const r = cp.spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }); return r; };
function writeFreight() {
  const r = run([path.join(T, '_freight_site.js'), '--write']);
  if (r.status !== 0) throw new Error('the freight writer: ' + (r.stderr || r.stdout).slice(-400));
  console.log('  FREIGHT_CARDS: ' + (r.stdout.trim().split('\n').slice(-1)[0] || 'written'));
}
// PROCURE: the gate's own measured effects (--emit prints `EFF <mid>|<design>|<row>=<val> <json>`), each written into
// its PE_({...}) on the option's line
function writeProcure() {
  const r = run([path.join(T, '_procure_check.js'), '--emit']);
  const rows = [...(r.stdout || '').matchAll(/  EFF (\w+)\|(\w+)\|(\w+)=(\w+) (\{[^\n]*\})/g)];
  if (!rows.length) throw new Error('the procurement gate printed no effect (' + (r.stdout || '').slice(-300) + ')');
  let src = fs.readFileSync(PROCURE, 'utf8');
  const fmt = o => '{ ' + Object.entries(o).map(([k, v]) => k + ': ' + v).join(', ') + ' }';
  let n = 0;
  for (const [, mid, design, row, val, json] of rows) {
    const m0 = src.indexOf('\n  ' + mid + ': {\n    id: \'' + mid + '\'');
    const m1 = src.indexOf('\n  ' + mid + ': {', m0 + 1) > 0 ? src.indexOf('\n  ' + mid + ': {', m0 + 1) : src.indexOf('\n};', m0);
    const r0 = src.indexOf('\n      ' + row + ':', m0);
    if (m0 < 0 || r0 < 0 || r0 > m1) throw new Error('no option row ' + mid + '.' + row);
    const v0 = src.indexOf(' ' + val + ': {', r0);
    const e0 = src.indexOf(design + ': PE_(', v0);
    if (v0 < 0 || e0 < 0) throw new Error('no effect ' + mid + '|' + design + '|' + row + '=' + val);
    const p0 = e0 + (design + ': PE_(').length, p1 = src.indexOf('})', p0) + 1;
    src = src.slice(0, p0) + fmt(JSON.parse(json)) + src.slice(p1);
    n++;
  }
  fs.writeFileSync(PROCURE, src);
  console.log('  PROCURE eff: ' + n + ' effects written');
}
function stamp() {
  const { src, DS } = designs();
  const now = stampOf(DS), line = '// SNAPSHOTS-OF ' + now + ' (tools/snapshots.js: CONTRACT_DESIGNS, FREIGHT_CARDS and PROCURE eff measured off these build files)';
  const out = STAMP_RE.test(src) ? src.replace(STAMP_RE, line) : src.replace('const CONTRACT_DESIGNS = {', line + '\nconst CONTRACT_DESIGNS = {');
  fs.writeFileSync(DATA, out);
  console.log('  stamped ' + now);
}
const build = () => { const r = run([path.join(T, 'build.js')]); if (r.status !== 0) throw new Error('build: ' + r.stderr.slice(-300)); };

if (argv.includes('--write')) {
  // the order matters: the contracts first (procurement's stock certificate is CONTRACT_DESIGNS), then a build, then
  // the cards and the effects off that core
  writeContracts(); build();
  writeFreight(); build();
  writeProcure(); stamp(); build();
  process.exit(0);
}
if (argv.includes('--stamp')) { stamp(); process.exit(0); }
process.exit(check() ? 0 : 1);
