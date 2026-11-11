#!/usr/bin/env node
// table.js - THE DRAFTING TABLE, HEADLESS: the same steps as the page (flyDiy/drafting.html), for a Claude session.
// Design: tools/DRAFTING_TABLE.md. Every command works on ONE plane file: the garage's own save format
// ({what: 'flydiy-build', v, name, spec}) with the reference block beside the spec ({ref}).
//
//   node tools/drafting/table.js new   <plane.json> --key <card> --ref <ref.json> [--name N]   birth a card, attach the reference
//   node tools/drafting/table.js check <plane.json> [--over JSON] [--level 0] [--sheet <img> --png <out-prefix>] [--json <out>]
//        builds the plane through the garage's generator, measures it, prints the key-measurements table against the
//        reference; --png writes <out>_{side,top,front}.png: the sheet faded, our outline in parts over it
//   node tools/drafting/table.js set   <plane.json> '<rows JSON>' [--why "..."]     writes cage rows (garage rows only)
//   node tools/drafting/table.js rows  [filter]                                     the garage's row definitions
//   node tools/drafting/table.js compare <ref.json> --keys beaver,caravan [--sheet <img> --png <prefix>]
//        the architecture step: the candidate cards measured against the reference, side by side
'use strict';
const fs = require('fs'), path = require('path');
const DT = require('./dt_node.js'), C = DT.CORE, PNG = require('./dt_png.js');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const pos = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
const cmd = pos[0];

function readPlane(f) { return JSON.parse(fs.readFileSync(f, 'utf8')); }
function writePlane(f, doc) { fs.writeFileSync(f, JSON.stringify(doc, null, 1)); }
function history(doc, step, line) {
  doc.ref = doc.ref || {}; doc.ref.history = doc.ref.history || [];
  doc.ref.history.push({ date: new Date().toISOString().slice(0, 16), who: process.env.DT_WHO || 'session', step, line });
}
const fmt = (v, u) => v == null ? '   -   ' : (u === 'deg' ? v.toFixed(1) : v.toFixed(3));

function table(ref, B) {
  const ours = C.measure(B, { stations: C.stations(ref) });
  const win = C.windows(B);
  const T = C.compare(ref, ours, win);
  return { ours, win, T };
}
function printTable(T, title) {
  console.log('\n' + (title || 'KEY MEASUREMENTS') + ': ' + T.pass + ' / ' + T.n + ' inside tolerance');
  console.log('  ' + 'measurement'.padEnd(36) + 'ours'.padStart(9) + 'ref'.padStart(9) + 'diff'.padStart(9) + '  tol    src');
  for (const r of T.rows) {
    const mark = r.ok == null ? ' ' : r.ok ? '+' : 'X';
    console.log(mark + ' ' + r.label.padEnd(36) + fmt(r.ours, r.unit).padStart(9) + fmt(r.ref, r.unit).padStart(9) +
      (r.diff == null ? '' : ((r.diff >= 0 ? '+' : '') + fmt(r.diff, r.unit))).padStart(9) +
      (r.tol == null ? '' : ('  ' + fmt(r.tol, r.unit))).padEnd(9) + ' ' + r.src);
  }
}
// the overlay: each view's box of the sheet, faded, with our outline over it
function overlays(ref, B, sheetFile, prefix) {
  const S = PNG.decode(fs.readFileSync(sheetFile));
  const out = [];
  for (const view of C.VIEWS) {
    const V = ref.views[view]; if (!V) continue;
    const [x0, y0, x1, y1] = V.box, W = x1 - x0, H = y1 - y0;
    const id = C.raster(view, B.tris, B.parts, V, W, H, x0, y0), E = C.edges(id, W, H);
    const img = Buffer.alloc(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const si = ((y0 + y) * S.W + (x0 + x)) * 4, o = (y * W + x) * 4;
      const g = S.rgba[si + 3] ? (S.rgba[si] + S.rgba[si + 1] + S.rgba[si + 2]) / 3 : 255;
      const v = 255 - (255 - g) * 0.45;                   // the sheet, faded
      img[o] = img[o + 1] = img[o + 2] = v; img[o + 3] = 255;
      const e = E[y * W + x];
      if (e) { const c = C.COLOURS[C.PARTS[e]] || '#000'; img[o] = parseInt(c.slice(1, 3), 16); img[o + 1] = parseInt(c.slice(3, 5), 16); img[o + 2] = parseInt(c.slice(5, 7), 16); }
    }
    // the reference's marks: small black crosses
    for (const k of Object.keys(ref.marks || {})) {
      const m = ref.marks[k]; if (m.view !== view) continue;
      for (const p of m.pts) for (let d = -3; d <= 3; d++) for (const [dx, dy] of [[d, 0], [0, d]]) {
        const x = Math.round(p[0] - x0 + dx), y = Math.round(p[1] - y0 + dy);
        if (x < 0 || y < 0 || x >= W || y >= H) continue; const o = (y * W + x) * 4; img[o] = 0; img[o + 1] = 0; img[o + 2] = 0;
      }
    }
    const f = prefix + '_' + view + '.png'; fs.writeFileSync(f, PNG.encode(W, H, img)); out.push(f);
  }
  return out;
}
function bornOrFile(doc) { return doc.spec; }

if (cmd === 'new') {
  const f = pos[1], key = opt('key'), refF = opt('ref');
  if (!f || !key) { console.error('usage: table.js new <plane.json> --key <card> --ref <ref.json>'); process.exit(2); }
  const spec = DT.birth(key);
  const ref = refF ? JSON.parse(fs.readFileSync(refF, 'utf8')) : { what: 'drafting-ref', v: 1, figures: {}, views: {}, marks: {} };
  ref.architecture = Object.assign({}, ref.architecture, { start: key });
  const doc = { what: 'flydiy-build', v: 8, name: opt('name', (ref.identity && ref.identity.variant) || key), spec, ref };
  history(doc, 'architecture', 'born from the ' + key + ' card');
  writePlane(f, doc); console.log('wrote ' + f + ' (' + key + ')');
} else if (cmd === 'check') {
  const doc = readPlane(pos[1]), over = JSON.parse(opt('over', '{}'));
  const B = DT.build(bornOrFile(doc), over, { level: +opt('level', 0) });
  if (B.errors.length) console.log('build errors: ' + B.errors.join(' | '));
  const r = table(doc.ref, B);
  printTable(r.T, (doc.name || '') + ' (build ' + B.ms + ' ms)');
  console.log('\nour windows (side, starboard): ' + r.win.map(w => w.a0.toFixed(2) + '-' + w.a1.toFixed(2) + ' x ' + w.h0.toFixed(2) + '..' + w.h1.toFixed(2)).join(' | '));
  if (opt('png') && opt('sheet')) console.log('overlays: ' + overlays(doc.ref, B, opt('sheet'), opt('png')).join(' '));
  if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify({ ours: r.ours, windows: r.win, table: r.T }, null, 1));
} else if (cmd === 'set') {
  const f = pos[1], rows = JSON.parse(pos[2] || '{}'), doc = readPlane(f);
  const defs = DT.rowDefs(), unknown = Object.keys(rows).filter(k => !defs[k] && !(k in (doc.spec.cage || {})));
  if (unknown.length) console.log('NOTE rows with no garage definition (kept, flagged): ' + unknown.join(' '));
  doc.spec.cage = Object.assign({}, doc.spec.cage, rows);
  history(doc, opt('step', 'fit'), (opt('why', '') + ' ' + JSON.stringify(rows)).trim());
  writePlane(f, doc); console.log('set ' + Object.keys(rows).length + ' rows in ' + f);
} else if (cmd === 'rows') {
  const defs = DT.rowDefs(), re = pos[1] ? new RegExp(pos[1], 'i') : null;
  for (const d of Object.values(defs)) if (!re || re.test(d.key + ' ' + d.label + ' ' + d.group))
    console.log(d.key.padEnd(16) + d.label.padEnd(34) + (d.min + '..' + d.max + ' /' + d.step).padEnd(18) + d.group);
} else if (cmd === 'compare') {
  const ref = JSON.parse(fs.readFileSync(pos[1], 'utf8'));
  for (const key of opt('keys', '').split(',').filter(Boolean)) {
    const B = DT.build(DT.birth(key), null, { level: 0 });
    const r = table(ref, B);
    printTable(r.T, 'CARD ' + key);
    if (opt('png') && opt('sheet')) console.log('overlays: ' + overlays(ref, B, opt('sheet'), opt('png') + '_' + key).join(' '));
  }
} else {
  console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 17).join('\n'));
}
