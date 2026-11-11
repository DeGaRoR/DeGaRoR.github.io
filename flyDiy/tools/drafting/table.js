#!/usr/bin/env node
// table.js - THE DRAFTING TABLE, HEADLESS: the same steps as the page (flyDiy/drafting.html), for a Claude session.
// Design: tools/DRAFTING_TABLE.md. Every command works on ONE plane file: the garage's own save format
// ({what: 'flydiy-build', v, name, spec}) with the reference block beside the spec ({ref}).
//
//   node tools/drafting/table.js new   <plane.json> --key <card> --ref <ref.json> [--sel JSON] [--name N]
//        birth a card (its choices changed by --sel: the architecture step), attach the reference
//   node tools/drafting/table.js check <plane.json> [--over JSON] [--level 0] [--sheet <img> --png <out-prefix>] [--json <out>]
//        builds the plane through the garage's generator, measures it, prints the key-measurements table against the
//        reference; --png writes <out>_{side,top,front}.png: the sheet faded, our outline in parts over it
//   node tools/drafting/table.js set   <plane.json> '<rows JSON>' [--why "..."]     writes cage rows (garage rows only)
//   node tools/drafting/table.js rows  [filter]                                     the garage's row definitions
//   node tools/drafting/table.js fit   <plane.json> '{"row":[lo,hi,step],...}' --km id,id [--write]
//        a scoped search of one step's rows against that step's key measurements (sessions; the page uses marks)
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
  const ours = C.measure(B, { stations: C.stations(ref), probes: C.probes(ref) });
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
  const sel = JSON.parse(opt('sel', 'null'));
  const spec = sel ? DT.birthSel(key, sel) : DT.birth(key);
  const ref = refF ? JSON.parse(fs.readFileSync(refF, 'utf8')) : { what: 'drafting-ref', v: 1, figures: {}, views: {}, marks: {} };
  ref.architecture = Object.assign({}, ref.architecture, { start: key }, sel ? { sel } : {});
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
} else if (cmd === 'fit') {
  // A SCOPED SEARCH (the old fitters' way, kept for sessions; the page's way is marks and sliders): the rows of ONE
  // step, walked one at a time a step up and down, the step halved when nothing helps, scored on that step's key
  // measurements (sum of (diff / tol)^2). Writes the result into the plane file only with --write.
  const f = pos[1], doc = readPlane(f), rows = JSON.parse(pos[2]);   // {"row": [lo, hi, step], ...}
  const ids = opt('km', '').split(',').filter(Boolean);
  const ref = doc.ref, stations = C.stations(ref);
  const score = over => {
    const B = DT.build(doc.spec, over, { level: 0, passes: +opt('passes', 2) });
    const T = C.compare(ref, C.measure(B, { stations, probes: C.probes(ref) }), C.windows(B));
    let s = 0, n = 0;
    for (const r of T.rows) {
      if (r.diff == null || !r.tol) continue;
      if (ids.length && !ids.some(k => r.id === k || r.id.indexOf(k + '.') === 0 || (/^(profile|window)$/.test(k) && r.id.indexOf(k) === 0))) continue;
      s += Math.min(400, (r.diff / r.tol) ** 2); n++;
    }
    return { s, n, T };
  };
  const cur = Object.assign({}, doc.spec.cage), step = {}, base = DT.build(doc.spec, null, { level: 0, passes: 1 }).P;
  const over = {};
  for (const k of Object.keys(rows)) {
    over[k] = cur[k] != null ? cur[k] : base[k]; step[k] = rows[k][2];
    // a row that FOLLOWS (null: the garage derives it, e.g. a frame that follows the reference section) has no number
    // to start from: it is left out of the search, named, and set by hand if it must move
    if (over[k] == null || !isFinite(+over[k])) { console.log('  ' + k + ' follows (no value): left out'); delete over[k]; delete rows[k]; }
  }
  let best = score(over); console.log('start ' + best.s.toFixed(2) + ' over ' + best.n + ' rows ' + JSON.stringify(over));
  for (let round = 0; round < +opt('rounds', 6); round++) {
    let moved = false;
    for (const k of Object.keys(rows)) {
      for (const sg of [1, -1]) {
        for (;;) {
          const v = +Math.min(rows[k][1], Math.max(rows[k][0], over[k] + sg * step[k])).toFixed(4);
          if (v === over[k]) break;
          const tr = Object.assign({}, over, { [k]: v }), sc = score(tr);
          if (sc.s < best.s - 1e-6) { best = sc; Object.assign(over, tr); moved = true; console.log('  ' + k.padEnd(14) + String(v).padStart(9) + '  -> ' + best.s.toFixed(2)); }
          else break;
        }
      }
    }
    if (!moved) { if (Object.keys(step).every(k => step[k] <= rows[k][2] / 4)) break; for (const k of Object.keys(step)) step[k] /= 2; }
  }
  // rounded to each row's own garage step
  const defs = DT.rowDefs();
  for (const k of Object.keys(over)) { const st = defs[k] && defs[k].step; if (st) over[k] = +(Math.round(over[k] / st) * st).toFixed(4); }
  console.log('best ' + best.s.toFixed(2) + ' ' + JSON.stringify(over));
  if (argv.includes('--write')) { doc.spec.cage = Object.assign({}, doc.spec.cage, over); history(doc, opt('step', 'fit'), 'fit ' + JSON.stringify(over)); writePlane(f, doc); console.log('written'); }
} else if (cmd === 'weigh') {
  // THE LIGHT CHECKS (no flight): the garage's own load door (tools/_load_build.js: the join, the energy write-back)
  // and its own bookkeeping (genBuild, genShakedown) - mass, CG, the stability margin, standing on the wheels - set
  // against the reference's figures (empty mass, the CG envelope). Takes ~20 s (the join is the garage's, whole).
  const doc = readPlane(pos[1]), ref = doc.ref || {};
  const LB = require('../_load_build.js'), K = require('../flight_core.js');
  const r = LB.gameSpecFull({ v: doc.v, spec: doc.spec });
  if (r.errors.length) console.log('join errors: ' + r.errors.slice(0, 4).join(' | '));
  const def = K.buildGen(r.spec), sh = K.genShakedown(def, { slim: true });
  const cg = (sh.cgX - sh.xLEmac) / sh.cBar * 100, cgE = (sh.cgEmptyX - sh.xLEmac) / sh.cBar * 100;
  const fig = k => C.figValue(ref, k), out = [];
  const row = (label, ours, refv, ok, note) => out.push({ label, ours, ref: refv, ok, note });
  const emptyRef = fig('specs.basicOperating');
  row('empty mass (kg)', sh.empty, emptyRef, emptyRef ? Math.abs(sh.empty - emptyRef) / emptyRef < 0.05 : null, 'the factsheet\'s basic operating mass, configuration-dependent');
  row('as built (kg)', sh.mass, null, null, 'the garage\'s default load: ' + (sh.payload != null ? 'payload ' + (+sh.payload).toFixed(0) + ' kg' : ''));
  // the TCDS envelope, as % MAC at a mass: straight lines between the stated points
  const env = ref.cgEnvelope || null;
  let lim = null;
  if (env && env.length) {
    const m = sh.mass, pts = env.slice().sort((a, b) => a.kg - b.kg);
    const at = m <= pts[0].kg ? pts[0] : m >= pts[pts.length - 1].kg ? pts[pts.length - 1] : null;
    if (at) lim = [at.fwd, at.aft];
    else for (let i = 0; i + 1 < pts.length; i++) if (m >= pts[i].kg && m <= pts[i + 1].kg) {
      const t = (m - pts[i].kg) / (pts[i + 1].kg - pts[i].kg);
      lim = [pts[i].fwd + t * (pts[i + 1].fwd - pts[i].fwd), pts[i].aft + t * (pts[i + 1].aft - pts[i].aft)];
    }
  }
  row('CG as built (% MAC)', cg, lim ? lim[0].toFixed(1) + '-' + lim[1].toFixed(1) : '15-35 (default band)', lim ? cg >= lim[0] && cg <= lim[1] : cg >= 15 && cg <= 35,
      ref.datumLE != null ? '= ' + (ref.datumLE + cg / 100 * (fig('geometry.chord') || sh.cBar) * 1000).toFixed(0) + ' mm from the TCDS datum' : '');
  row('CG empty (% MAC)', cgE, null, null, '');
  row('static margin (% MAC)', sh.staticMargin * 100, '5-20', sh.staticMargin >= 0.05 && sh.staticMargin <= 0.20, 'the garage\'s own probe (the design check\'s), not the formula');
  // the angle from the main axle to the CG (genShakedown noseOver, degrees); the game's aid band (64c_gen_aids:
  // a taildragger 12-25, a tricycle's own) is a rule of thumb, so outside it is a FLAG, never a failure by itself
  const band = sh.gearType === 'tail' || /^TW/.test(sh.restsOn || '') ? [12, 25] : null;
  row('main axle to CG (deg)', sh.noseOver, band ? band.join('-') + ' (the game\'s rule)' : '-', band ? (sh.noseOver >= band[0] && sh.noseOver <= band[1]) : null,
      'stands on ' + (sh.restsOn || '?') + (band && sh.noseOver > band[1] ? ': the mains far forward of the CG (a STOL type may sit there on purpose)' : ''));
  row('prop clearance (m)', sh.propClear, '>= 0.18 (FAR 23.925, from memory)', sh.propClear == null ? null : sh.propClear >= 0.18, '');
  row('mean chord (m)', sh.cBar, fig('geometry.chord'), fig('geometry.chord') ? Math.abs(sh.cBar - fig('geometry.chord')) < 0.05 : null, 'as the join flies it');
  row('wing area (m2)', sh.Sw, fig('geometry.wingArea'), fig('geometry.wingArea') ? Math.abs(sh.Sw - fig('geometry.wingArea')) / fig('geometry.wingArea') < 0.02 : null, '');
  row('engine', sh.engineName + ' ' + (sh.hp || 0).toFixed(0) + ' hp, ' + (sh.engineMass || 0).toFixed(0) + ' kg', fig('specs.power') + ' shp, ' + (fig('specs.engineMass') || '?') + ' kg', null, '');
  console.log('\nLIGHT CHECKS (' + (doc.name || '') + ')');
  for (const o of out) console.log((o.ok == null ? ' ' : o.ok ? '+' : 'X') + ' ' + o.label.padEnd(24) + String(typeof o.ours === 'number' ? o.ours.toFixed(o.ours > 100 ? 0 : 2) : o.ours).padStart(14) + '   ref ' + String(o.ref == null ? '-' : o.ref).padEnd(26) + ' ' + (o.note || ''));
  if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify({ checks: out, shakedown: { mass: sh.mass, empty: sh.empty, cgMAC: cg, sm: sh.staticMargin, cBar: sh.cBar, Sw: sh.Sw } }, null, 1));
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
