// dt_node.js - the drafting table's build under node: the SAME files the page's worker loads (dt_manifest.js), in a vm
// context with the six-line document every garage layer already guards for (tools/_scene_headless.js's harness).
//   const DT = require('./dt_node.js');  DT.birth('beaver') -> spec;  DT.build(spec, over, opts) -> B (dt_build.js)
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');            // flyDiy/
const MAN = require('./dt_manifest.js');
let W = null, LOAD = null;

function context() {
  if (W) return W;
  const t0 = Date.now();
  const el = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, addEventListener() {},
    setAttribute() {}, textContent: '', value: '', checked: false, querySelector: () => null, querySelectorAll: () => [] });
  const g = {
    console, setTimeout, clearTimeout, Image: function () { return el(); },
    performance: { now: () => Number(process.hrtime.bigint()) / 1e6 }, navigator: { userAgent: 'node' },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el,
      body: el(), head: el() },
  };
  W = vm.createContext(g);
  vm.runInContext('var window = globalThis; var self = globalThis;', W);
  const errors = [];
  for (const f of MAN.ALL) {
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), W, { filename: f }); }
    catch (e) { errors.push(f + ': ' + (e && e.message)); }
  }
  LOAD = { ms: Date.now() - t0, errors };
  return W;
}
function birth(key) { return context().DT_BUILD.birth(W, key); }
// a card's birth with some of its choices changed (the architecture step): the card's sel + over, designBake's own way
function birthSel(key, sel) {
  const D = context().CAGE_DESIGN, a = D.ARCHETYPES.find(x => x.key === key);
  if (!a) throw new Error('no archetype ' + key);
  return D.designBake(Object.assign({}, a.sel, sel), a.over);
}
function build(spec, over, opts) { return context().DT_BUILD.build(W, spec, over, opts); }
// THE VALUE A FOLLOW ROW TAKES (a frame row left null follows the reference section): the generator's own resolved
// frame (cageSpec(P).frames.<frame>.val), so a search can start a follow row from where it stands
const FRAME = { Nose: 'nose', Win: 'win', Post: 'post', Cab: 'cab', Pax: 'pax', Boom: 'boom' };
function followValue(spec, key, over) {
  const m = /^fr(Nose|Win|Post|Cab|Pax|Boom)(Top|Waist|Bot)(Y|W|Z)$/.exec(key);
  if (!m) return null;
  const W = context(), P = Object.assign(W.CAGE2.cageFromSpec(spec), over || {});
  const fr = W.CAGE2.cageSpec(Object.assign({}, P)).frames || {};
  const f = fr[FRAME[m[1]]], k = m[2].toLowerCase() + m[3];
  return f && f.val && isFinite(f.val[k]) ? f.val[k] : null;
}
function rowDefs() { return context().DT_BUILD.rowDefs(W); }
function load() { context(); return LOAD; }
module.exports = { context, birth, birthSel, build, rowDefs, followValue, load, ROOT, CORE: require('./dt_core.js') };
