#!/usr/bin/env node
// CONFIG-MATRIX (2 Nov, the user: "On the twin floats, switching back from pod and rod to lofted skin removes the
// engine. Nevertheless, twin booms are still drawn, and now they allow for a dorsal fin ... Let's figure out
// consistent sets, add missing points and disable dysfunctional combinations").
//
// THE INSTRUMENT: one base aeroplane, a list of row changes, each applied IN ONE PAGE CONTEXT the way the editor
// applies a tile (CAGE_DESIGN.designApply, seeds:false - design_flow.js pick) or a raw row (P[k] = v), then the page's
// drawing chain (tools/_scene_headless.js: every layer the game draws with) and the JOIN (what the game flies). Each
// row of the output says, for that state:
//   drawn   the layers that drew a group, the engine units (CAGE_NOSE.engineFaces: what the engine layer bolts to),
//           the booms, the aero aft, the dorsal the fin layer draws (its clamp, read as the layer reads it)
//   flown   the join's engines (mount, measured station or the spec's own rule), the tail type, the dorsal area the
//           join measured, the fuselage boom kind
//   notice  what the layers wrote on the stat line (the page's own notices: "engine: ...")
// and a verdict per row: WYSIWYG holds when every flown engine has a drawn unit and every drawn unit is flown.
//
//   node tools/config_matrix.js <build.json | default> [--switch=k:v,k:v] [--tile=row:value] [--json]
//   node tools/config_matrix.js --sweep [--json]    the matrix sweep (CONFIG-MATRIX.md's measured table)
//
// The sweep builds each cell from the stock aeroplane by the DESIGN TILES (the way a builder gets there), so a cell
// is the state the editor produces, not a hand-made P.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const T = __dirname, ROOT = path.join(T, '..');
const SH = require(path.join(T, '_scene_headless.js'));
const C = require(path.join(T, 'flight_core.js'));
const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const clone = o => JSON.parse(JSON.stringify(o));

let X = null, W = null;
function ctx() {
  if (X) return X;
  X = SH.context();
  W = X.ctx;
  // the design rows (the editor's tiles) in the same page context: the page loads them with the editor
  vm.runInContext(fs.readFileSync(path.join(T, '_cage_design.js'), 'utf8'), W, { filename: '_cage_design.js' });
  W.CAGE_UI_LAZY = true;
  vm.runInContext(fs.readFileSync(path.join(T, '_cage_join.js'), 'utf8'), W, { filename: '_cage_join.js' });
  return X;
}

// ONE STATE: P (the editor's), drawn through the chain and joined. `spec` is the build's own sections (the join merges
// onto them, as GARAGE_SPEC.update does).
function state(P, spec) {
  ctx();
  const quiet = console.error, qw = console.warn;
  console.error = () => {}; console.warn = () => {};
  let r;
  const store = { get: () => clone(spec), resolved: () => C.buildGen(clone(spec)).spec, update() {} };
  try {
    r = SH.sceneBuild({ cage: P }, { over: P, garage: store.get(), resolved: store.resolved, inGame: true,
      prebuild: Q => { for (const f of (W.CAGE_PAGE.coerce || [])) try { f(Q); } catch (e) {} } });
  } finally { console.error = quiet; console.warn = qw; }
  const scene = r.scene;
  const outer = new W.THREE.Group(), inner = new W.THREE.Group();
  for (const ch of scene.children.slice()) inner.add(ch);
  outer.add(inner); scene.add(outer); scene.updateMatrixWorld(true);
  W.CAGE_UI = { P: r.P, glazedM2: W.CAGE2.cageGlazedM2 ? W.CAGE2.cageGlazedM2(r.built.mesh, r.FS) : 0 };
  W.GARAGE_SPEC = store;
  let J = null, jerr = null;
  try { J = W.CAGE_JOIN.export(); } catch (e) { jerr = String(e && e.message || e); }
  const layers = {};
  scene.traverse(o => { if (o.name && o.name.indexOf('cageLayer:') === 0) {
    let n = 0; o.traverse(c => { if (c.isMesh) n++; }); layers[o.name.slice(10)] = (layers[o.name.slice(10)] || 0) + n; } });
  let units = [];
  try { units = W.CAGE_NOSE.engineFaces(r.built.sheet, r.FS, r.P).map(u => u.kind); } catch (e) {}
  const S = r.built.spec || {};
  const cfg = S.config || {};
  const P2 = r.P;
  const dorsalDrawn = !!(+P2.finOn && +P2.finDorsal && !+P2.boomStyle);   // _cage_fin.js's clamp, as the layer reads it
  const flown = J ? {
    engines: (J.engines || []).map(e => e.mount + (isFinite(e.x) ? '@' + (+e.x).toFixed(2) : '@rule')),
    tail: J.tail && J.tail.type, boom: J.fuselage && J.fuselage.boom,
    dorsalA: J.tail && J.tail.dorsal ? +(+J.tail.dorsal.area || 0).toFixed(3) : null,
    Sv: J.tail && isFinite(J.tail.Sv) ? +(+J.tail.Sv).toFixed(3) : null,
    errors: (W.CAGE_JOIN.errors && W.CAGE_JOIN.errors()) || [] } : { jerr };
  // WYSIWYG on the engines: every flown entry is a drawn unit (an entry with no drawn unit flies at the spec's rule)
  const nFlown = flown.engines ? flown.engines.length : 0;
  const engOK = !+P2.engOn ? nFlown === 0 || true : units.length === nFlown;
  return {
    P: P2,
    drawn: { layers, units, booms: !!W.CAGE_BOOMS, boomsLofted: W.CAGE_BOOMS ? !W.CAGE_BOOMS.lofted ? 0 : 1 : null,
             rearAperture: cfg.rearAperture, aeroAft: !!cfg.aeroAft, rod: !!(S.rod), dorsal: dorsalDrawn },
    flown, stat: (r.stat || '').replace(/^\s*·\s*/, '').trim(), errors: r.errors,
    wysiwyg: { engines: engOK },
  };
}

// a build file (or the stock aeroplane) -> { P, spec }: the editor's P as the page's applySpec makes it
function baseOf(file) {
  ctx();
  if (!file || file === 'default') {
    const spec = clone(C.GEN_DEFAULT);
    const P = Object.assign(W.CAGE2.cageDefaults(), W.CAGE_PAGE.defaults || {}, W.CAGE2.cageFromSpec(spec));
    return { P, spec };
  }
  const j = JSON.parse(fs.readFileSync(path.isAbsolute(file) ? file : path.join(ROOT, file), 'utf8'));
  const spec = C.genNormaliseSpec(clone(j.spec || j));
  if (W.CAGE_PAGE.load) try { W.CAGE_PAGE.load(spec); } catch (e) {}
  const P = Object.assign(W.CAGE2.cageDefaults(), W.CAGE_PAGE.defaults || {}, W.CAGE2.cageFromSpec(spec));
  return { P, spec };
}

// a TILE, as design_flow.js pick applies it (the live writes, seeds:false); a raw ROW is P[k] = v
function tile(P, row, value) {
  ctx();
  const v = /^-?\d+(\.\d+)?$/.test(String(value)) ? +value : value;
  const r = W.CAGE_DESIGN.designApply(P, { [row]: v }, { seeds: false });
  if (r.missing.length) throw new Error('tile ' + row + '=' + value + ': ' + r.missing.join(','));
  return Object.assign({}, P, r.cage);
}
function tiles(P, list) { for (const [k, v] of list) P = tile(P, k, v); return P; }

function line(lb, s) {
  const d = s.drawn, f = s.flown;
  const lay = Object.keys(d.layers).filter(k => /^(eng|boom|fin|stab|cowl|float|gear|aeroAft)/.test(k)).sort().join(',');
  return lb.padEnd(46) + ' | units ' + (d.units.join('+') || '-').padEnd(14) +
    ' | flown ' + ((f.engines || []).join('+') || '-').padEnd(22) +
    ' | ' + (s.wysiwyg.engines ? 'ok ' : 'XX ') +
    '| booms ' + (d.booms ? 'Y' : '-') + ' aper ' + d.rearAperture + ' rod ' + (d.rod ? 'Y' : '-') +
    ' dorsal ' + (d.dorsal ? 'Y' : '-') + ' dA ' + f.dorsalA + ' tail ' + f.tail + ' boom ' + f.boom +
    ' | ' + lay + (s.stat ? ' | NOTICE ' + s.stat : '');
}

// ---- THE SWEEP ------------------------------------------------------------------------------------------------------
// the bodies (the two structure rows), the mounts (the mount and count rows), each reached by its tiles
const BODIES = {
  'loft single': [['boomStyle', 0], ['booms', 'single']],
  'rod single': [['boomStyle', 1], ['booms', 'single']],
  'loft twin': [['boomStyle', 0], ['booms', 'twin']],
  'rod twin': [['boomStyle', 1], ['booms', 'twin']],
};
const MOUNTS = {
  nose: [['engCount', 1], ['engMount', 'nose']],
  pusher: [['engCount', 1], ['engMount', 'pusher']],
  wingTop: [['engCount', 1], ['engMount', 'wingTop']],
  'twin wings': [['engCount', 2]],
  pushPull: [['engCount', 'pushPull']],
  three: [['engCount', 3]],
  four: [['engCount', 4]],
};
function sweep() {
  const b = baseOf('default');
  const rows = [];
  const run = (lb, list, extra) => {
    let P = tiles(b.P, list);
    if (extra) P = Object.assign({}, P, extra);
    const s = state(P, b.spec);
    rows.push({ k: lb, s });
    if (!json) console.log(line(lb, s));
  };
  // A: body then mount (a builder choosing the body first), B: mount then body (the switch the user made)
  for (const bk in BODIES) for (const mk in MOUNTS) run('A ' + bk + ' > ' + mk, BODIES[bk].concat(MOUNTS[mk]));
  for (const mk in MOUNTS) for (const bk in BODIES) run('B ' + mk + ' > ' + bk, MOUNTS[mk].concat(BODIES[bk]));
  // the tails on each body (a nose engine)
  for (const bk in BODIES) for (const t of ['conv', 't', 'cruci', 'v'])
    run('T ' + bk + ' > ' + t, BODIES[bk].concat([['empennage', t]]));
  // the tail parts on each body: the dorsal, the keel extension, the ventral (floats)
  for (const bk in BODIES) {
    run('D ' + bk + ' + dorsal', BODIES[bk].concat([['finDorsalT', 1]]));
    run('K ' + bk + ' + keel', BODIES[bk].concat([['finKeelT', 1]]));
    run('F ' + bk + ' + floats', BODIES[bk].concat([['gearLayout', 'floats']]));
    run('F ' + bk + ' + floats + pusher', BODIES[bk].concat([['gearLayout', 'floats'], ['engMount', 'pusher']]));
  }
  // the wing gates: the over-the-wing mount, then the wing moved off high; a biplane under it
  for (const w of [0, 1, 2, 3]) run('W wingTop > wgPos ' + w, MOUNTS.wingTop.concat([['wgPos', w]]));
  run('W wingTop > biplane', MOUNTS.wingTop.concat([['planes', 'biplane']]));
  // the cowl on each mount (the cowl row's own switch, on and off)
  for (const mk in MOUNTS) for (const c of [0, 1]) run('C ' + mk + ' cowlOn ' + c, MOUNTS[mk], { cowlOn: c });
  // the covering
  for (const bk of ['loft single', 'rod twin']) run('O ' + bk + ' open frame + pusher', BODIES[bk].concat([['engMount', 'pusher'], ['covering', 'open']]));
  return rows;
}

module.exports = { state, baseOf, tile, tiles, ctx: () => (ctx(), W), line, sweep, BODIES, MOUNTS };
const json = argv.includes('--json');
if (require.main === module && argv.includes('--sweep')) {
  const rows = sweep();
  if (json) process.stdout.write(JSON.stringify(rows.map(({ k, s }) => ({ k, drawn: s.drawn, flown: s.flown, stat: s.stat,
    wysiwyg: s.wysiwyg, P: { boomStyle: s.P.boomStyle, boomTwin: s.P.boomTwin, engMount: s.P.engMount, cowlOn: s.P.cowlOn,
      finDorsal: s.P.finDorsal, finKeel: s.P.finKeel, wgPos: s.P.wgPos, stMount: s.P.stMount, finOn: s.P.finOn } })), null, 1) + '\n');
}

if (require.main === module && !argv.includes('--sweep')) {

  {
    const file = argv.find(a => !a.startsWith('--')) || 'default';
    const b = baseOf(file);
    let P = b.P;
    const out = [];
    const s0 = state(P, b.spec);
    out.push(['base', s0]);
    for (const t of (arg('tile', '') ? arg('tile').split(',') : [])) {
      const [k, v] = t.split(':'); P = tile(P, k, v);
      out.push(['tile ' + t, state(P, b.spec)]);
    }
    for (const t of (arg('switch', '') ? arg('switch').split(',') : [])) {
      const [k, v] = t.split(':'); P = Object.assign({}, P, { [k]: +v });
      out.push(['row ' + t, state(P, b.spec)]);
    }
    if (json) process.stdout.write(JSON.stringify(out.map(([k, s]) => ({ k, drawn: s.drawn, flown: s.flown, stat: s.stat, wysiwyg: s.wysiwyg })), null, 1) + '\n');
    else for (const [k, s] of out) console.log(line(k, s));
  }
}
