#!/usr/bin/env node
// GATE PODEDITOR (G2679, BELLY-POD-2) - THE BELLY POD'S SECTION IN THE GARAGE EDITOR, DRIVEN THROUGH ITS OWN ROWS.
// The user (7 Oct): "it should be a configurable volume from the garage editor". tools/_cage_pod.js's section, run
// in node on a small DOM (the rows' own elements: ranges, a checkbox, a select, their oninput / onchange /
// ondblclick), over the real core (tools/flight_core.js) and a GARAGE_SPEC that records every write and rebuilds the
// aeroplane the page's way (buildGen, then the section handed the new def, as app.js setAircraft does):
//   OFF          a build loaded with no pod: one row (`fitted`), NOTHING written - the file's bytes and the bought
//                aeroplane's fingerprint (procureFp) unchanged
//   FIT          the box ticked: ONE write, { pod: { on: 1 } } (the core's defaults), the aeroplane rebuilt with it
//   THE ROWS     volume (GEN_POD_UI.litres), shape (0-1), the fairings / length / width / depth at GEN_POD.clamp's
//                ranges, fore / aft, door; each range's value is the resolved pod's
//   A DRAG       oninput moves the pod (the section's state, the mesh) and writes NOTHING; the release writes once
//   VOLUME       the release's len / width / depth are genPodFromVolume's on this aeroplane's frame, inside the clamp,
//                the hold = the litres asked (or the most the clamp allows, `reached` false)
//   SHAPE        length / depth = genPodLD(shape) (to the millimetre's rounding), the volume held
//   RESET        a double-click on a label: the row's default (depth -> GEN_POD.def.depth; volume -> the whole default
//                pod; fore / aft -> auto)
//   READOUTS     every line the core's number (genPodReadout on the def and its shakedown): the hold, the floor,
//                the rated load, the empty mass and the price (= the ledger's pod row), the drag area, the cruise and
//                range cost, the CG shift empty / full, the clearance per attitude
//   RED          the Jodel's default pod: red, "static margin" (full, negative); the Cub's 0.60 m pod: red, "strikes";
//                a Cub pod 0.05 m off the ground: red, "under 0.08 m"; the C172's default: no red
//   OFF AGAIN    unticked: GARAGE_SPEC.remove('pod') - the spec WITHOUT the key, its fingerprint the file's again
//   THE PAGE'S CORE  the section runs over the core's TEXT evaluated in its own global (index.html's shape: the
//                core's const tables in the lexical scope, not on window)
//   THE PAGE     the wiring's sources: the parts row, the manifest and the chain, the livery's section, the garage's
//                remove door, app.js's frame / refresh / the sheet bridge / the bench's toggle through the section;
//                the section's type (IBM Plex Sans, no serif, no italic; the --ed-* tokens)
//
//   node tools/_pod_editor_check.js             -> "GATE PODEDITOR: PASS|FAIL"
//   node tools/_pod_editor_check.js --selftest  -> the section's rules broken in its own source, each must go red
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const T = __dirname, ROOT = path.join(T, '..');
const SELF = process.argv.includes('--selftest'), SHOW = process.argv.includes('--show');
const C = require(path.join(T, 'flight_core.js'));
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const POD_SRC = rd('tools/_cage_pod.js');
const CORE_TXT = rd('tools/flight_core.js');
const FILES = { cub: 'builds/cub_2026-09-20_corrected.json', jodel: 'builds/jodel_2026-09-20_corrected.json',
                c172: 'builds/cessna172_2026-09-20_corrected.json' };
const clone = o => JSON.parse(JSON.stringify(o));
const specOf = k => { const j = JSON.parse(rd(FILES[k])); return j.spec || j; };

// ---- a small DOM: what the section touches ----------------------------------------------------------------------
function makeDoc() {
  const all = [];
  const mk = tag => {
    const e = { tagName: String(tag).toUpperCase(), children: [], parent: null, dataset: {}, style: {}, _cls: new Set(),
      _text: '', id: '', title: '', type: '', value: '', checked: false, min: '', max: '', step: '', selected: false, open: false };
    e.classList = { add: c => e._cls.add(c), remove: c => e._cls.delete(c), toggle: (c, on) => { if (on === undefined ? !e._cls.has(c) : on) e._cls.add(c); else e._cls.delete(c); },
                    contains: c => e._cls.has(c) };
    Object.defineProperty(e, 'className', { get: () => [...e._cls].join(' '), set: v => { e._cls = new Set(String(v).split(/\s+/).filter(Boolean)); } });
    Object.defineProperty(e, 'textContent', { get: () => e._text + e.children.map(c => c.textContent).join(''),
      set: v => { e._text = v == null ? '' : String(v); for (const c of e.children) c.parent = null; e.children = []; } });
    Object.defineProperty(e, 'innerText', { get: () => e._text + e.children.map(c => (c.tagName === 'DIV' ? '\n' : ' ') + c.innerText).join('') });
    Object.defineProperty(e, 'firstChild', { get: () => e.children[0] || null });
    e.appendChild = c => { if (c.parent) c.parent.children.splice(c.parent.children.indexOf(c), 1); c.parent = e; e.children.push(c); return c; };
    e.querySelector = () => null;
    all.push(e);
    return e;
  };
  return { createElement: mk, getElementById: id => all.find(e => e.id === id && attached(e)) || null, _all: all };
  function attached(e) { let p = e; while (p.parent) p = p.parent; return p.__root === true; }
}
const walk = (e, f) => { f(e); for (const c of e.children) walk(c, f); };
const byId = (root, id) => { let r = null; walk(root, e => { if (!r && e.id === id) r = e; }); return r; };
const byCls = (root, c) => { const out = []; walk(root, e => { if (e._cls.has(c)) out.push(e); }); return out; };

// ---- the rig: the section over the core, a recording GARAGE_SPEC that rebuilds the page's way ------------------
function rig(src, key, withPod) {
  const doc = makeDoc();
  // THE CORE AS THE PAGE HAS IT: its text evaluated in the section's own global, so its functions are globals and its
  // `const` tables (GEN_POD, GEN_POD_UI) live in the global LEXICAL scope, never on window - a section that reached
  // for window.GEN_POD would read undefined here exactly as it does in index.html
  const g = { console };
  const ctx = vm.createContext(g);
  vm.runInContext(CORE_TXT, ctx, { filename: 'flight_core.js' });
  vm.runInContext('var window = globalThis;', ctx);
  g.document = doc; g.console = console; g.CAGE_IN_GAME = true; g.CAGE_PAGE = {};
  let spec = clone(specOf(key)); delete spec.pod;
  if (withPod) spec.pod = clone(withPod);
  const R = { writes: [], spec: () => spec, def: null, sheets: new Map() };
  const rebuild = () => { R.def = C.buildGen(C.genMigrateSpec(clone(spec))); if (g.CAGE_POD) g.CAGE_POD.frame(R.def); };
  g.GARAGE_SPEC = {
    get: () => clone(spec),
    update: j => { R.writes.push({ update: clone(j) }); spec = C.genSpecMerge(spec, clone(j)); rebuild(); },
    remove: k => { R.writes.push({ remove: k }); if (k in spec) { spec = Object.assign({}, spec); delete spec[k]; } rebuild(); },
  };
  // the page's sheet door: the shakedown of the def in hand (app.js FLYDIY_POD.shake; measured once per def)
  g.FLYDIY_POD = { shake: () => { const d = R.def; if (!d) return null; if (!R.sheets.has(d)) R.sheets.set(d, C.genShakedown(d, { corners: false })); return R.sheets.get(d); } };
  vm.runInContext(src, ctx, { filename: '_cage_pod.js' });
  R.P = g.CAGE_POD;
  R.P.fromSpec(clone(spec));
  rebuild();
  R.root = R.P.panel(); R.root.__root = true;
  R.id = id => byId(R.root, id);
  R.g = g;
  return R;
}
const fire = (e, ev, v) => { if (v !== undefined) e.value = String(v); e[ev](); };

// ---- the checks -------------------------------------------------------------------------------------------------
function run(src, quiet) {
  let checks = 0, fails = 0;
  const lines = [];
  const ok = (c, m) => { checks++; if (!c) { fails++; lines.push('  FAIL ' + m); } else if (SHOW && !quiet) lines.push('  ok   ' + m); return !!c; };
  const rep = s => { if (!quiet) lines.push('  ' + s); };
  const near = (a, b, t) => a != null && b != null && isFinite(a) && isFinite(b) && Math.abs(a - b) <= t;
  const K = C.GEN_POD.clamp, D0 = C.GEN_POD.def, U = C.GEN_POD_UI;
  // OFF
  const A = rig(src, 'cub', null);
  const fp0 = C.procureFp(specOf('cub'));
  ok(A.writes.length === 0 && !('pod' in A.spec()) && !A.id('p_pod_litres') && A.id('p_pod_on') && A.id('p_pod_on').checked === false,
     'off: a build loaded with no pod shows one row (fitted, unticked) and writes NOTHING');
  ok(C.procureFp(A.spec()) === fp0, 'off: the bought aeroplane\'s fingerprint is the file\'s (' + fp0 + ')');
  // FIT
  fire(Object.assign(A.id('p_pod_on'), { checked: true }), 'onchange');
  ok(A.writes.length === 1 && A.writes[0].update && JSON.stringify(A.writes[0].update) === '{"pod":{"on":1}}' && A.def.parts.pod,
     'fit: ticked -> ONE write, { pod: { on: 1 } } (the core\'s defaults), the aeroplane rebuilt with it');
  // THE ROWS
  const R0 = A.def.parts.pod;
  const want = { litres: U.litres, shape: U.shape, noseFair: K.noseFair, tailFair: K.tailFair, len: K.len, width: K.width, depth: K.depth };
  for (const k in want) {
    const e = A.id('p_pod_' + k);
    ok(e && e.type === 'range' && +e.min === want[k][0] && +e.max === want[k][1], 'the row ' + k + ': a range over [' + want[k].join(', ') + ']');
  }
  ok(A.id('p_pod_x') && A.id('p_pod_x').type === 'range' && A.id('p_pod_door') && A.id('p_pod_door').tagName === 'SELECT', 'the rows fore / aft (a range) and door (a select)');
  ok(+A.id('p_pod_litres').value === Math.round(R0.litres) && +A.id('p_pod_len').value === D0.len && +A.id('p_pod_depth').value === D0.depth && near(+A.id('p_pod_shape').value, C.genPodShapeOf(R0.len, R0.depth), 1e-12),
     'the rows read the resolved pod: ' + Math.round(R0.litres) + ' L, shape ' + C.genPodShapeOf(R0.len, R0.depth).toFixed(3) + ', ' + D0.len + ' x ' + D0.width + ' x ' + D0.depth + ' m');
  // A DRAG, THEN THE RELEASE: VOLUME
  const n0 = A.writes.length, shape0 = +A.id('p_pod_shape').value;
  fire(A.id('p_pod_litres'), 'oninput', 240);
  const mid = A.P.state();
  ok(A.writes.length === n0 && mid && mid.depth > D0.depth, 'a drag moves the pod (depth ' + D0.depth + ' -> ' + (mid && mid.depth) + ' m) and writes NOTHING');
  fire(A.id('p_pod_litres'), 'onchange', 240);
  const w1 = A.writes[A.writes.length - 1], m1 = C.genPodFromVolume(Object.assign({}, A.def.spec, { pod: mid }), A.def.parts.ST, 240, shape0);
  ok(A.writes.length === n0 + 1 && w1.update && w1.update.pod.len === m1.len && w1.update.pod.width === m1.width && w1.update.pod.depth === m1.depth,
     'the release writes once: len / width / depth = genPodFromVolume\'s (' + m1.len + ' x ' + m1.width + ' x ' + m1.depth + ' m)');
  ok(near(A.def.parts.pod.litres, 240, 1.0) && ['len', 'width', 'depth'].every(k => A.def.parts.pod[k === 'width' ? 'hw' : k] != null),
     'the rebuilt aeroplane\'s hold is the volume asked: ' + A.def.parts.pod.litres.toFixed(1) + ' L of 240');
  // the clamp: the most this shape can hold
  render(A);
  fire(A.id('p_pod_shape'), 'oninput', 1); fire(A.id('p_pod_litres'), 'oninput', U.litres[1]);
  const big = A.P.state();
  ok(['len', 'width', 'depth'].every(k => big[k] >= K[k][0] && big[k] <= K[k][1]) && big.depth === K.depth[1],
     'a volume past the clamp stops AT the clamp (' + big.len + ' x ' + big.width + ' x ' + big.depth + ' m): never outside GEN_POD.clamp');
  // SHAPE (the drag above never released: the release-less pod is the def's again on the next render)
  render(A);
  fire(A.id('p_pod_litres'), 'onchange', 150);
  render(A);
  fire(A.id('p_pod_shape'), 'onchange', 0.25);
  render(A);
  const sp = A.P.state();
  ok(near(sp.len / sp.depth, C.genPodLD(0.25), 0.06) && near(C.genPodResolve(Object.assign({}, A.def.spec, { pod: sp }), A.def.parts.ST).litres, +A.id('p_pod_litres').value, 2.5),
     'shape 0.25: length / depth ' + (sp.len / sp.depth).toFixed(2) + ' (genPodLD ' + C.genPodLD(0.25).toFixed(2) + '), the volume held');
  // RESET
  A.id('p_pod_depth').parent.children[0].ondblclick();
  ok(A.P.state().depth === D0.depth && A.writes[A.writes.length - 1].update.pod.depth === D0.depth, 'double-click depth: the default ' + D0.depth + ' m, written');
  render(A);
  A.id('p_pod_x').parent.children[0].ondblclick();
  ok(A.P.state().x === null, 'double-click fore / aft: auto (centred on the quarter chord)');
  render(A);
  fire(A.id('p_pod_x'), 'onchange', 0.9);
  ok(A.P.state().x === 0.9 && near(A.def.parts.pod.x0, 0.9, 1e-9), 'fore / aft 0.90 m: the pod\'s nose at 0.90 m aft of the firewall');
  render(A);
  A.id('p_pod_litres').parent.children[0].ondblclick();
  const st = A.P.state();
  ok(['len', 'width', 'depth', 'noseFair', 'tailFair'].every(k => st[k] === D0[k]) && st.x === 0.9, 'double-click volume: the whole default pod (' + D0.len + ' x ' + D0.width + ' x ' + D0.depth + '), the position kept');
  render(A);
  const ds = A.id('p_pod_door'); ds.value = 'right'; ds.onchange();
  ok(A.writes[A.writes.length - 1].update.pod.door === 'right' && A.def.parts.pod.door.sideName === 'right', 'door: the right side, written and resolved');
  // the pod moved aft is closer to the ground tail-down: the section says so, red, with the number
  render(A);
  const aft = byCls(A.root, 'podWhy').filter(e => e._cls.has('bad')).map(e => e.textContent);
  ok(aft.some(t => /three-point, at rest: 0\.0\d m clear, under 0\.08 m/.test(t)), 'the Cub\'s pod moved aft to 0.90 m: RED - "' + aft.join('; ') + '"');
  A.id('p_pod_x').parent.children[0].ondblclick();
  // READOUTS = THE CORE'S NUMBERS (back at auto)
  render(A);
  const sh = A.g.FLYDIY_POD.shake(), RO = C.genPodReadout(A.def, sh), txt = A.root.innerText;
  const Lg = A.def.parts.ledger.pod;
  ok(RO && !RO.pending && near(RO.emptyKg, Lg.mass, 1e-9) && RO.price === Lg.cost && near(RO.litres, sh.pod.space.litres, 1e-9) && near(RO.cda, sh.pod.cda, 1e-12)
     && near(RO.cruise.dV, sh.pod.cruise.dV, 1e-12) && near(RO.cgFull.staticMargin, sh.pod.balance.staticMargin, 1e-12)
     && RO.clearance.length === sh.pod.clearance.rows.length && RO.clearance.every((r, i) => r.clear === sh.pod.clearance.rows[i].clear),
     'the readout is the core\'s: the ledger\'s pod row, the space, the drag, the cruise, the CG full, the clearance rows');
  const fmt = (v, d) => (+v).toFixed(d);
  const wantTxt = [Math.round(RO.litres) + ' L', fmt(RO.floorM2, 2) + ' m²', RO.maxKg + ' kg rated', '+' + fmt(RO.emptyKg, 1) + ' kg empty', Math.round(RO.price).toLocaleString('en') + ' cr',
    fmt(RO.cda, 3) + ' m²', fmt(Math.abs(RO.cruise.dV * 3.6), 1) + ' km/h', fmt(Math.abs(RO.dRangeKm), 0) + ' km', fmt(Math.abs(RO.cgEmpty.shift * 1000), 0) + ' mm',
    'margin ' + fmt(RO.cgFull.staticMargin, 2)].concat(RO.clearance.map(r => r.name + ' ' + fmt(r.clear, 2) + ' m'));
  const miss = wantTxt.filter(w => txt.replace(/\s+/g, ' ').indexOf(w.replace(/\s+/g, ' ')) < 0);
  ok(miss.length === 0, 'the section prints them: ' + wantTxt.slice(0, 6).join(' · ') + ' ...' + (miss.length ? ' MISSING ' + miss.join(' | ') : ''));
  ok(byCls(A.root, 'bad').length === 0 && RO.red.length === 0, 'the Cub\'s pod (' + RO.clearance.map(r => fmt(r.clear, 2)).join(' / ') + ' m clear, margin ' + fmt(RO.cgFull.staticMargin, 2) + '): no red');
  rep('cub: ' + txt.replace(/\s+/g, ' ').slice(0, 520));
  // OFF AGAIN
  fire(Object.assign(A.id('p_pod_on'), { checked: false }), 'onchange');
  ok(A.writes[A.writes.length - 1].remove === 'pod' && !('pod' in A.spec()) && !A.def.parts.pod && C.procureFp(A.spec()) === fp0,
     'unticked: GARAGE_SPEC.remove(\'pod\') - the key gone, the fingerprint the file\'s again (not { on: 0 }: ' + C.procureFp(Object.assign(clone(specOf('cub')), { pod: { on: 0 } })) + ')');
  // A NEW AEROPLANE FORGETS THE LAST ONE'S POD: the sizes kept while unticked are this aeroplane's only
  fire(Object.assign(A.id('p_pod_on'), { checked: true }), 'onchange');
  const back = A.writes[A.writes.length - 1].update.pod;
  fire(Object.assign(A.id('p_pod_on'), { checked: false }), 'onchange');
  A.P.fromSpec(specOf('jodel'));
  fire(Object.assign(A.id('p_pod_on'), { checked: true }), 'onchange');
  ok(back && back.door === 'right' && back.x === null && JSON.stringify(A.writes[A.writes.length - 1].update) === '{"pod":{"on":1}}',
     're-ticked, the same aeroplane gets its own pod back (door right, auto); a newly loaded one starts from the defaults ({ pod: { on: 1 } })');
  // RED, WITH THE REASON
  const J = rig(src, 'jodel', { on: 1 });
  const jr = byCls(J.root, 'podWhy').filter(e => e._cls.has('bad')).map(e => e.textContent);
  ok(jr.some(t => /full, its static margin is -0\.0\d \(unstable\)/.test(t)), 'the Jodel\'s default pod: RED - "' + jr.join('; ') + '"');
  const Cd = rig(src, 'cub', { on: 1, depth: 0.6 });
  const cr = byCls(Cd.root, 'podWhy').filter(e => e._cls.has('bad')).map(e => e.textContent);
  ok(cr.some(t => /it strikes three-point, at rest \(-0\.\d\d m\)/.test(t)) && byCls(Cd.root, 'podL').some(e => e._cls.has('bad')), 'the Cub\'s 0.60 m pod: RED - "' + cr.join('; ') + '"');
  const Cw = rig(src, 'cub', { on: 1, depth: 0.37 });
  const wr = byCls(Cw.root, 'podWhy').filter(e => e._cls.has('bad')).map(e => e.textContent);
  ok(wr.some(t => /three-point, at rest: 0\.0\d m clear, under 0\.08 m/.test(t)) && byCls(Cw.root, 'podL').some(e => e._cls.has('bad') && /three-point/.test(e.innerText)),
     'the Cub\'s 0.37 m pod: RED, its three-point row and the reason - "' + wr.join('; ') + '"');
  const S = rig(src, 'c172', { on: 1 });
  ok(byCls(S.root, 'bad').length === 0 && S.root.innerText.indexOf('rotated to the tail strike') >= 0, 'the C172\'s default pod: no red, its rotation to the tail strike shown');
  // THE PAGE (the wiring's sources)
  const parts = rd('tools/_cage_parts.js'), build = rd('tools/build.js'), chain = rd('tools/_cage_chain.js'), skin = rd('src/viewer/aeroskin.js');
  const garage = rd('src/viewer/garage.js'), app = rd('src/viewer/app.js'), ui = rd('tools/_cage_ui.js'), css = rd('src/viewer/editor.css');
  ok(/\{ key: 'pod', name: 'Belly pod', parent: 'fuselage', layer: 'pod',\s+panel: 'CAGE_POD', sections: \['pod'\] \}/.test(parts), '_cage_parts.js: the "Belly pod" part, a panel part under the fuselage');
  ok(/'_cage_hinge\.js',[\s\S]{0,400}'_cage_pod\.js',[\s\S]{0,80}'_cage_join\.js'/.test(build) && /'hinge', 'pod', 'ext'\]/.test(chain) && /pod: '_cage_pod'/.test(chain),
     'build.js / _cage_chain.js: the layer after the hinges, registered in the chain\'s order');
  ok(/pod:\s+\{ parent: 'body', fin: 'trim',\s+label: 'the belly pod',\s+layer: 'pod', wears: 'parent', noDec: true \}/.test(skin), 'aeroskin.js: the livery\'s `pod` section (the body\'s colour, moulded trim, no marking)');
  ok(/remove: k => \{ if \(!spec \|\| !\(k in spec\)\) return;/.test(garage), 'garage.js: GARAGE_SPEC.remove (a section taken off: the key gone)');
  ok(/window\.CAGE_POD\.frame\(def\)/.test(app) && /window\.CAGE_POD\.refresh\(\)/.test(app) && /window\.FLYDIY_POD = \{\s+shake:[^\n]+\n\s+need: \(\) => \{ if \(curKey === .gen. && inGarage && !shakeKnown\(\)\) shakeSoon\(\); \}/.test(app) && /window\.CAGE_POD\.setOn\(!!on\)/.test(app),
     'app.js: the garage\'s def handed over, the readouts refreshed when the sheet lands, the bench\'s toggle through the section');
  ok(/window\.CAGE_POD\.fromSpec\(spec\)/.test(ui), '_cage_ui.js applySpec: the pod comes with the aeroplane');
  const podCss = css.slice(css.indexOf('THE BELLY POD\'S SECTION'));
  ok(podCss.length > 100 && !/serif|italic|oblique/i.test(podCss.replace(/IBM Plex Sans/g, '')) && /IBM Plex Sans/.test(podCss) && /var\(--ed-bad\)/.test(podCss) && /var\(--ed-warn\)/.test(podCss),
     'editor.css: the section in IBM Plex Sans, no serif, no italic; red / amber the --ed-bad / --ed-warn tokens');
  return { checks, fails, lines };
}
// the section re-renders on the release the page's way (the new def handed over); a drag's rows are the last render's
function render(R) { R.P.frame(R.def); R.root = R.P.panel(); R.root.__root = true; }

const DOCTORS = [
  ['the volume row ignores the core (litres as the length)', "    v => { fromVolume(v, sh()); rel(); }, v => { fromVolume(v, sh()); done(); },", "    v => { POD = Object.assign({}, POD, { len: v / 100 }); rel(); }, v => { POD = Object.assign({}, POD, { len: v / 100 }); done(); },"],
  ['a drag writes the spec', "  const rel = () => { redraw(); readRender(); };", "  const rel = () => { redraw(); readRender(); commit(); };"],
  ['off writes { on: 0 } (another fingerprint)', "  else if (G.remove) G.remove('pod');", "  else if (G.update) G.update({ pod: { on: 0 } });"],
  ['the double-click forgets its default', "  ks.ondblclick = () => { reset(); };", "  ks.ondblclick = () => {};"],
  ['the dims off the clamp', "const dim = (k, label, title) => rowRange(body, k, label, title, K[k][0], K[k][1],", "const dim = (k, label, title) => rowRange(body, k, label, title, K[k][0], 2 * K[k][1],"],
  ['a clearance red only at a strike', "!(c.clear > 0) || c.clear < 0.08 ? 'bad' : ''", "!(c.clear > 0) ? 'bad' : ''"],
  ['the readout off the drag area', "line('drag', r.cda.toFixed(3) + ' m²'", "line('drag', (r.cda * 1.2).toFixed(3) + ' m²'"],
  ['the red reasons not shown', "for (const why of r.red) readEl.appendChild(el('div', 'podWhy bad',", "for (const why of [].slice(0, 0)) readEl.appendChild(el('div', 'podWhy bad',"],
  ['a new aeroplane keeps the last one\'s pod', "  MEM = POD ? clone(POD) : null;", "  if (POD) MEM = clone(POD);"],
  ['fitted with the old sizes forced', "  if (on) POD = Object.assign({}, MEM || {}, { on: 1 });", "  if (on) POD = Object.assign({ len: 3 }, MEM || {}, { on: 1 });"],
];

function main() {
  const t0 = Date.now();
  const r = run(POD_SRC, false);
  console.log(r.lines.join('\n'));
  let bad = 0;
  if (SELF) {
    for (const [name, from, to] of DOCTORS) {
      if (!POD_SRC.includes(from)) { console.log('  selftest MISSED  ' + name + ' (the anchor is gone)'); bad++; continue; }
      let red = false, nf = 0;
      try { const q = run(POD_SRC.split(from).join(to), true); red = q.fails > 0; nf = q.fails; } catch (e) { red = true; nf = -1; }
      if (!red) bad++;
      console.log('  selftest ' + (red ? 'caught  ' : 'MISSED  ') + name + (red ? ' (' + (nf < 0 ? 'threw' : nf + ' checks red') + ')' : ''));
    }
    console.log('  selftest: ' + (DOCTORS.length - bad) + ' of ' + DOCTORS.length + ' caught');
  }
  console.log('  ' + r.checks + ' checks, ' + r.fails + ' failed (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
  const pass = r.fails === 0 && bad === 0;
  console.log('GATE PODEDITOR: ' + (pass ? 'PASS' : 'FAIL'));
  process.exitCode = pass ? 0 : 1;
}
try { main(); } catch (e) { console.log(String(e && e.stack || e)); console.log('GATE PODEDITOR: FAIL'); process.exitCode = 1; }
