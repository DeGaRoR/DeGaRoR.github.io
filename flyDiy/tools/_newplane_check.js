#!/usr/bin/env node
// GATE NEWPLANE — the new-aeroplane generator's small recurring gate (NEW-PLANE, 3 Nov 2026).
//
// The user: "I will accept a test once, then small recurring tests. Our battery is already much too heavy." The once
// is tools/newplane_validate.js (run in the cloud, its result in reports/evidence/NEW-PLANE/STATUS.md, NOT in the
// battery). This is the small one, budgeted UNDER A MINUTE:
//
//   1 RULE UNITS (no build)   the steps (10-15, every option a symbol), every archetype's choice set reachable (the
//                             non-authored cards ARE the generator's outputs), the CONFIG-MATRIX greys, one cowl preset
//                             per engine type, the aero nose, the pusher's back cowl, the fin presets only, the wing
//                             presets' rows, the canopy rule, colour and material into the spec, an engine model for
//                             every offered family, random choice sets that never hold a greyed option
//   2 THE FLOW (a DOM stub)   src/viewer/new_plane.js driven tile by tile: nothing composed, built or loaded before
//                             Generate; the render hold up while choosing and released after; Generate loads once
//                             (+1 when the stance fit moved a leg), lands on the STRUCTURE view, cannot fire twice;
//                             Cancel leaves the stand untouched
//   3 FIXED BUILDS (joined)   one per gear kind and the saved failure fixtures (tools/fixtures/newplane/*.json): the
//                             chooser's own path (bake, the cowl's birth preset, the drawing layers + the join, the
//                             stance fit) judged by _newplane_lib.js: builds, joins, design check, margin, stance
//   4 SEEDED RANDOM BUILDS    5 composed + built pre-join (designBake + buildGen + shakedown): nothing throws, the
//                             mass and margin finite. The seed is printed; NEWPLANE_SEED=<n> replays it.
//
//   node tools/_newplane_check.js            -> "GATE NEWPLANE: PASS|FAIL" (core: 1, 2, the tricycle of 3, 4)
//   node tools/_newplane_check.js --builds   -> "GATE NEWPLANE-BUILDS: PASS|FAIL" (full: 3 whole, 4)
//   node tools/_newplane_check.js --selftest -> the negative proofs (a doctored rule each must go red)
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const T0 = Date.now();
const SELFTEST = process.argv.includes('--selftest');
const BUILDS = process.argv.includes('--builds');   // the joined fixed builds and fixtures (GATE NEWPLANE-BUILDS, full tier)
const NL = require('./_newplane_lib.js');
NL.init();
const NP = require('./_new_plane.js');
const D = require('./_cage_design.js');
const C = require('./flight_core.js');
const W = global.window;

let fails = 0, nOk = 0;
const ok = (c, m, extra) => { if (c) nOk++; else fails++; console.log((c ? '  ok     ' : '  FAIL   ') + m + (!c && extra ? ' - ' + extra : '')); return c; };

// ---- 1 RULE UNITS ---------------------------------------------------------------------------------------------------
function ruleUnits(np) {
  const out = [];
  const t = (c, m, x) => out.push([!!c, m, x]);
  const S = np.STEPS;
  t(S.length >= 10 && S.length <= 15, 'the main choices are 10-15 steps (' + S.length + ')');
  let noIcon = [];
  for (const s of S) for (const r of s.rows) for (const o of r.opts()) if (!o.icon || !o.icon.paths || !o.label) noIcon.push(r.key + '=' + o.value);
  t(!noIcon.length, 'every option carries its SVG symbol and a label', noIcon.slice(0, 5).join(', '));
  t(!np.ROW_KEYS.includes('prop') && !np.ROW_KEYS.includes('blades'), 'the propeller\'s blades are not a choice (the user: "not key")');
  // NEW-PLANE-HOLD (A0, 3 Nov): the first-launch chooser holds the render loop, so a RIG (a fresh profile) must never get
  // it by itself - GATE CLOUD's census drew 0 composites under it. The door's guard, read off the source
  { const df = fs.readFileSync(path.join(T, '..', 'src', 'viewer', 'design_flow.js'), 'utf8');
    const fn = (df.match(/function maybeAutoOpen\(\) \{[\s\S]*?\n\}/) || [''])[0];
    t(/if \(isRig\(\)\) return;/.test(fn) && /webdriver/.test(df) && /HeadlessChrome/.test(df) && /newplane=1/.test(df),
      'the first-launch chooser never opens by itself on a rig (webdriver / HeadlessChrome; ?newplane=1 forces it)'); }
  // every archetype reachable: its choice set, read back, holds no greyed option
  // (an AUTHORED card is drawn by hand to a reference and stays a card; one outside the chooser is printed, not failed)
  const unreach = [], authOut = [];
  for (const a of D.ARCHETYPES) {
    const ch = np.fromArchetype(a), c = np.complete(ch);
    if (c.cleared.length) (np.authored(a) ? authOut : unreach).push(a.key + ':' + c.cleared.map(k => k + '=' + ch[k]).join('/'));
  }
  // N4 (the user, 3 Nov): the cards whose disc strikes their wing are no longer generator outputs - named, so a NEW
  // unreachable card still goes red
  const N4_OUT = new Set(['mw5', 'pusherPod', 'archaeopteryx']);
  const n4 = unreach.filter(u => N4_OUT.has(u.split(':')[0]));
  for (const u of n4) unreach.splice(unreach.indexOf(u), 1);
  if (n4.length) console.log('           N4 - cards whose disc strikes the wing, greyed by the user\'s call: ' + n4.join('; '));
  t(!unreach.length, 'every non-authored archetype\'s choice set is offered (' + D.ARCHETYPES.filter(a => !np.authored(a)).length + ' cards)', unreach.join('; '));
  if (authOut.length) console.log('           authored cards outside the chooser (kept as cards): ' + authOut.join('; '));
  const gen = D.ARCHETYPES.filter(a => !np.authored(a));
  t(gen.length >= 15, 'the non-authored cards are the generator\'s outputs (' + gen.length + ' cards; authored ' +
    D.ARCHETYPES.filter(a => np.authored(a)).map(a => a.key).join(', ') + ')');
  // CONFIG-MATRIX section 11, as greys
  t(np.why({ engArch: 'pusher', class: 'ulm' }, 'booms', 'lofted'), 'CM: lofted single boom greyed for a pusher');
  t(np.why({ engArch: 'pushPull', class: 'n23' }, 'booms', 'rod'), 'CM: a single rod greyed for a push-pull');
  t(np.why({ booms: 'twin', class: 'n23' }, 'tail', 't') && np.why({ booms: 'twinRod', class: 'n23' }, 'tail', 'v'),
    'CM: T- and V-tails greyed on twin booms');
  t(np.why({ class: 'ul1' }, 'engArch', 'wingTop') && np.why({ engArch: 'pusher', class: 'ulm' }, 'wing', 'high') &&
    np.why({ engArch: 'pusher', class: 'ulm' }, 'wing', 'parasol') && !np.why({ engArch: 'pusher', class: 'ulm' }, 'wing', 'low'),
    'N4: the over-the-wing engine and a pusher under a high wing / parasol greyed (the disc strikes the wing), a low-wing pusher offered');
  t(!np.why({ engArch: 'nose', class: 'eab' }, 'booms', 'lofted'), 'a nose engine keeps the lofted body');
  // a grey reads only EARLIER choices: a later pick never greys an earlier step
  t(!np.why({ class: 'eab', booms: 'twin' }, 'engArch', 'pusher'), 'greys read only earlier steps (the order contract)');
  // the cowl: one preset per engine type, each a key of the cowl layer's table
  const keys = W.CAGE_COWL_PRESET_KEYS || [];
  const fam = D.designEngineFamilies().map(f => f.value);
  const bad = fam.filter(f => keys.indexOf(np.cowlPresetFor({ engType: f, engArch: 'nose' }).split('@')[0]) < 0);
  t(!bad.length && fam.length === 6, 'one cowl preset per engine type (' + fam.map(f => f + '->' + np.cowlPresetFor({ engType: f, engArch: 'nose' })).join(' ') + ')', bad.join(','));
  t(np.cowlPresetFor({ engType: 'flat', engArch: 'pusher' }) === 'flat@pusher', 'the pusher\'s preset is its type\'s, marked @pusher');
  // the aero nose and the pusher's back cowl
  for (const arch of ['pusher', 'twin', 'four']) {   // (over the wing: greyed by N4, its nose rule rides the same NOSE_FREE set)
    const cl = arch === 'four' || arch === 'twin' ? 'n23' : 'ulm';
    const c = np.compose({ class: cl, engArch: arch });
    const g = c.over.cage;
    t(g.noseFinish === 1 && g.cowlLoops === 3 && g.noseTip >= 0.95 && g.cowlEase > 0 && g.cowlEase < 0.5,
      'the aero nose when nothing is on it (' + arch + '): collapse ' + g.noseTip + ', ' + g.cowlLoops + ' rings, ease ' + g.cowlEase);
  }
  { const c = np.compose({ class: 'eab', engArch: 'nose' }); t(c.over.cage.noseFinish == null, 'a nose engine keeps its firewall face'); }
  { const c = np.compose({ class: 'ulm', engArch: 'pusher' });
    t(c.over.cage.cowlOn === 1 && c.over.cage.engBlockZ === 0 && c.over.cage.engBlockY === 0,
      'the pusher wears a back cowl, the block rows at 0 (FINISH-4)'); }
  // the fins: the presets only
  const fins = np.optsOf('fin').map(o => o.value);
  t(fins.every(f => D.FIN_ARCH[f]) && fins.length === Object.keys(D.FIN_ARCH).length, 'the fin choices are the FIN_ARCH presets, all of them');
  // the wing presets: each writes its planform rows on the class's chord
  const P = Object.assign(W.CAGE2.cageDefaults(), W.CAGE_PAGE.defaults || {}, { wgChord: 1.6, wgSpan: 10 });
  for (const k of Object.keys(D.WING_ARCH)) {
    const w = D.designApply(P, { wingArch: k }).cage;
    const a = D.WING_ARCH[k];
    const okk = a.k == null ? w.wgPlan === 1 : Math.abs(w.wgChordTip - 1.6 * a.k) < 0.011 && w.wgPlan === 0;
    t(okk && w.wgTip != null || (a.k == null && w.wgPlan === 1), 'wing preset ' + k + ': ' + JSON.stringify(w).slice(0, 110));
  }
  // the canopy rule
  { const c = np.compose({ class: 'eab', top: 'turtle', canopy: 'bubble' });
    t(c.sel.canopy === 'bubble' && c.over.cage.bubH === 0.79 && c.sel.mirror === 1, 'a bubble over a turtledeck: the G267 bubble (bubH 0.79)'); }
  { const c = np.compose({ class: 'eab', top: 'open', canopy: 'bubble' });
    t(c.sel.canopy === 'screen' && c.over.cage.cpOpen === 1, 'an open cockpit has no hood (the bubble falls back to its screens)'); }
  // colour and material into the spec
  { const c = np.compose({ class: 'eab', colour: 0x7fa8c9, material: 3 });
    t(c.over.spec.paint.base === 0x7fa8c9 && c.over.spec.finish.sections.body.tint === 0x7fa8c9 && c.sel.intCons === 3,
      'colour into paint + the body sections, material into intCons'); }
  // the engine model: every offered family has one
  const noModel = [];
  for (const cl of ['ul1', 'ulm', 'lsa', 'eab', 'n23', 'sail'])
    for (const f of fam) if (!np.why({ class: cl, engArch: 'nose' }, 'engType', f) && !np.modelFor(cl, f, 'nose')) noModel.push(cl + '/' + f);
  t(!noModel.length, 'every offered engine type has a catalogue model for the class', noModel.join(','));
  // random sets never hold a greyed option, and compose them
  let greyed = 0;
  for (let s = 1; s <= 40; s++) { const ch = np.randomChoices(s * 7919); const c = np.complete(ch); greyed += c.cleared.length; }
  t(greyed === 0, '40 random choice sets hold no greyed option');
  return out;
}

// ---- 2 THE FLOW, over a DOM stub ------------------------------------------------------------------------------------
function domStub() {
  const all = [];
  const mk = tag => {
    const e = { tagName: String(tag).toUpperCase(), children: [], _l: {}, hidden: false, disabled: false, textContent: '', className: '',
      dataset: {}, style: {}, title: '', type: '', _q: {},
      classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, on) { if (on === undefined ? !this._s.has(c) : on) this._s.add(c); else this._s.delete(c); }, contains(c) { return this._s.has(c); } },
      setAttribute() {}, addEventListener(k, f) { (this._l[k] = this._l[k] || []).push(f); },
      appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
      insertAdjacentHTML() {}, set innerHTML(v) { this.children = []; this._html = v; }, get innerHTML() { return this._html || ''; },
      querySelector(sel) { if (sel === 'img.npThumb') return this.children.find(c => c.tagName === 'IMG' && c.className === 'npThumb') || null; return this._q[sel] || (this._q[sel] = mk('div')); },
      prepend(c) { this.children.unshift(c); c.parentNode = this; return c; },
      querySelectorAll() { return []; }, click() { for (const f of (this._l.click || [])) f(); },
      get isConnected() { return true; }, scrollTop: 0 };
    all.push(e);
    return e;
  };
  const doc = { createElement: mk, body: mk('body'), documentElement: mk('html'), readyState: 'complete', activeElement: null,
                querySelectorAll: () => [], getElementById: () => null };
  return { doc, all };
}
const tilesIn = e => { const out = []; const walk = n => { for (const c of n.children || []) { if (c.tagName === 'BUTTON') out.push(c); walk(c); } }; walk(e); return out; };
async function flowCheck(np) {
  const out = [];
  const t = (c, m, x) => out.push([!!c, m, x]);
  const { doc } = domStub();
  const prevDoc = global.document, prevRaf = W.requestAnimationFrame;
  global.document = doc;
  const cnt = { bake: 0, set: 0, get: 0, buildGen: 0, view: null, hold: null };
  const realBake = D.designBake;
  D.designBake = function () { cnt.bake++; return realBake.apply(this, arguments); };
  const store = { spec: null, name: () => 'saved', get: () => { cnt.get++; return JSON.parse(JSON.stringify(store.spec)); },
                  set: s => { cnt.set++; store.spec = JSON.parse(JSON.stringify(s)); } };
  // the fit is stubbed (a patch once, then none): the flow holds the loop and its loads, the fit itself is held by the
  // joined builds below (the real fit on a stand that is never joined would chase the rule gear for three passes)
  let fitN = 0;
  const npFlow = Object.assign({}, np, { stanceFit: () => (fitN++ === 0 ? { s1Z: 1.5 } : null) });
  Object.assign(W, { CAGE_DESIGN: D, NEW_PLANE_GEN: npFlow, GARAGE_SPEC: store,
    FLYDIY_UI_HOLD: on => { cnt.hold = on; }, EDITOR_SET_VIEW: v => { cnt.view = v; },
    requestAnimationFrame: f => setTimeout(f, 0), addEventListener: () => {} });
  global.window.document = doc;
  delete require.cache[require.resolve('../src/viewer/new_plane.js')];
  require('../src/viewer/new_plane.js');
  const UI = W.NEW_PLANE;
  // Cancel: nothing touched
  UI.open();
  t(UI.isOpen() && cnt.hold === true, 'the chooser opens full-screen and holds the render loop');
  UI.close();
  t(!UI.isOpen() && cnt.hold === false && cnt.set === 0 && cnt.bake === 0, 'cancel leaves the stand untouched, the hold released');
  // THE VIGNETTE (PLANE_THUMB's hook; NEW-PLANE-THUMB's row, cloud session 01RorUqE6GL185zmnCrbumTb): a candidate tile wears
  // the baked side profile when the module answers, ONE picture, and is today's tile when it does not
  {
    store.candidates = () => Promise.resolve([{ file: 'x_2026-11.json', name: 'X' }]);
    store.openCandidate = () => {};
    const picsOf = () => {
      const host = doc.body.children.find(c => c.id === 'npWrap') || doc.body.children[doc.body.children.length - 1];
      const tiles = tilesIn(host.querySelector('.npBody')).filter(b => b.dataset && b.dataset.thumb === 'cand:x_2026-11.json');
      return tiles.length ? tiles[0].children.filter(ch => ch.tagName === 'IMG' && ch.className === 'npThumb' && ch.src === 'media/thumbs/cand_x.webp').length : null;
    };
    W.PLANE_THUMB = { get: k => (k === 'cand:x_2026-11.json' ? 'media/thumbs/cand_x.webp' : null) };
    UI.open(); await new Promise(r => setTimeout(r, 0));
    const withPic = picsOf(); UI.close();
    delete W.PLANE_THUMB;
    UI.open(); await new Promise(r => setTimeout(r, 0));
    const without = picsOf(); UI.close();
    delete store.candidates; delete store.openCandidate;
    t(withPic === 1 && without === 0, 'a candidate tile wears PLANE_THUMB\'s one picture when it answers, today\'s tile without it (with ' + withPic + ', without ' + without + ')');
  }
  // the walk: start, then every step's first offered tile, row by row
  UI.open();
  const body = doc.body.children.find(c => c.id === 'npWrap') || doc.body.children[doc.body.children.length - 1];
  const bodyEl = body.querySelector('.npBody');
  const click = btn => btn.click();
  click(tilesIn(bodyEl).find(b => /npLit/.test(b.className)));
  let guard = 0;
  while (UI._state().page === 'step' && guard++ < 60) {
    const s = UI._state();
    const grids = bodyEl.children.filter(c => /npGrid/.test(c.className));
    for (const g of grids) {
      const tile = g.children.find(b => !b.disabled);
      if (tile) click(tile);
      if (UI._state().stepI !== s.stepI || UI._state().page !== 'step') break;
    }
    if (UI._state().page === 'step' && UI._state().stepI === s.stepI) UI._next();
  }
  t(UI._state().page === 'summary', 'every step answered by a tile, the summary reached (' + guard + ' screens)');
  t(cnt.bake === 0 && cnt.set === 0 && cnt.get === 0, 'nothing composed, built or loaded while choosing (bake ' + cnt.bake + ', load ' + cnt.set + ')');
  // back and forth keep the picks
  UI._back(); UI._next();
  t(UI._state().page === 'step' || UI._state().page === 'summary', 'back / next move between the screens');
  while (UI._state().page !== 'summary') UI._next();
  UI._next();                                 // generate
  UI._next();                                 // a second press while it works: ignored
  await new Promise(r => setTimeout(r, 30));
  for (let i = 0; i < 200 && UI.isOpen(); i++) await new Promise(r => setTimeout(r, 25));
  t(!UI.isOpen() && cnt.hold === false && cnt.view === 'shape', 'generate hands over: the chooser closed, the hold released, the editor on STRUCTURE');
  t(cnt.bake === 1 && cnt.set === 2 && UI.LOG.generated === 1 && UI.LOG.fit && UI.LOG.fit.passes === 1,
    'ONE generate: one bake, one load, + one load for the fit pass that moved a leg (and none for the pass that did not) - bake ' + cnt.bake + ', loads ' + cnt.set + (UI.LOG.fit ? ' fit ' + JSON.stringify(UI.LOG.fit) : ''));
  t(store.spec && store.spec.meta && store.spec.meta.newPlane && store.spec.meta.newPlane.class, 'the spec on the stand says what was chosen (meta.newPlane)');
  D.designBake = realBake;
  global.document = prevDoc; W.requestAnimationFrame = prevRaf;
  return out;
}

// ---- 3 + 4 THE BUILDS -----------------------------------------------------------------------------------------------
// STANDING kinds: _newplane_lib.js standing() - reported, never hiding a new failure
const FIXED = [
  ['taildragger', { class: 'eab', gear: 'tail', engArch: 'nose', engType: 'flat', wing: 'low', planform: 'taper' }],
  ['tricycle', { class: 'n23', gear: 'trike', engArch: 'nose', engType: 'flat', wing: 'high', planform: 'hershey' }],
  ['floats', { class: 'ul1', gear: 'floats', engArch: 'nose', engType: 'inline', wing: 'high', planform: 'rect' }],
];
function fixtures() {
  const dir = path.join(T, 'fixtures', 'newplane');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    return [f.replace(/\.json$/, '') + (j.why ? ' (' + j.why + ')' : ''), j.choices, j.joined !== false];
  });
}
function judgeFixed(name, ch) {
  const r = NL.judge(ch, {});
  const real = NL.realFails(r.fails, r.choices);
  const standing = r.fails.length - real.length;
  ok(!real.length, 'fixed ' + name + ': ' + JSON.stringify(r.m).slice(0, 220) + ' (' + (r.ms / 1000).toFixed(1) + ' s' +
     (standing ? ', ' + standing + ' standing' : '') + ')', real.join(' | '));
}
function preJoin(name, ch) {
  try {
    const b = NP.bake(ch);
    const def = C.buildGen(JSON.parse(JSON.stringify(b.spec)));
    const sh = C.genShakedown(def, { slim: true });
    const fin = [sh.empty, sh.staticMargin, sh.Vs].every(v => typeof v === 'number' && isFinite(v));
    ok(fin, 'random ' + name + ': composed and built (' + b.choices.class + ' ' + b.choices.engArch + ' ' + b.choices.engType + ' ' +
       b.choices.wing + ' ' + b.choices.gear + ', empty ' + Math.round(sh.empty) + ' kg)');
  } catch (e) { ok(false, 'random ' + name + ': composed and built', String(e && e.message || e).slice(0, 200)); }
}

(async () => {
  if (SELFTEST) {
    // each doctored rule must go red, or its check is inert
    const doctor = (label, patch) => {
      const np = Object.assign({}, NP, patch);
      const r = ruleUnits(np);
      ok(r.some(x => !x[0]), 'selftest: ' + label + ' goes red');
    };
    doctor('a pusher allowed on a lofted body', { why: (c, r, v) => (r === 'booms' && v === 'lofted') ? null : NP.why(c, r, v) });
    doctor('the aero nose with four rings', { compose: ch => { const c = NP.compose(ch); if (c.over.cage.cowlLoops) c.over.cage.cowlLoops = 4; return c; } });
    doctor('a turbine without a cowl preset', { cowlPresetFor: ch => ch.engType === 'turbine' ? 'none' : NP.cowlPresetFor(ch) });
    doctor('an archetype unreachable', { fromArchetype: a => Object.assign(NP.fromArchetype(a), a.key === 'caravan' ? { booms: 'lofted', engArch: 'pusher' } : {}) });
    console.log('GATE NEWPLANE SELFTEST: ' + (fails ? 'FAIL' : 'PASS'));
    process.exitCode = fails ? 1 : 0;
    return;
  }
  if (!BUILDS) {
    console.log('1 RULE UNITS');
    for (const [c, m, x] of ruleUnits(NP)) ok(c, m, x);
    console.log('2 THE FLOW (src/viewer/new_plane.js over a DOM stub)');
    for (const [c, m, x] of await flowCheck(NP)) ok(c, m, x);
  }
  if (BUILDS) {
    console.log('3 FIXED BUILDS (the chooser\'s path, joined) - one per gear kind + the saved failure fixtures');
    for (const [n, ch] of FIXED) judgeFixed(n, ch);
    for (const [n, ch, joined] of fixtures()) { if (joined) judgeFixed(n, ch); else preJoin(n, ch); }
  } else {
    // (the LSA tricycle, validation A's nose-high one: two seats, so its fit needs no loading corners - the 4-seat
    // tricycle and its corners are NEWPLANE-BUILDS', where the minute does not bind)
    console.log('3 ONE JOINED BUILD (a tricycle: the user\'s "tricycles that make sense"; the rest: --builds, full tier)');
    judgeFixed('tricycle, LSA', { class: 'lsa', gear: 'trike', engArch: 'nose', engType: 'flat', wing: 'low', planform: 'taper' });
  }
  const seed = +(process.env.NEWPLANE_SEED || ((Date.now() / 86400000) | 0));
  console.log('4 SEEDED RANDOM BUILDS (pre-join) - seed ' + seed + ' (NEWPLANE_SEED=' + seed + ' replays it)');
  for (let i = 0; i < 5; i++) preJoin(seed + '#' + i, NP.randomChoices(seed * 31 + i));
  const s = ((Date.now() - T0) / 1000).toFixed(1);
  console.log('  ' + nOk + ' ok, ' + fails + ' failed, ' + s + ' s');
  console.log('GATE NEWPLANE' + (BUILDS ? '-BUILDS' : '') + ': ' + (fails ? 'FAIL' : 'PASS'));
  process.exitCode = fails ? 1 : 0;
})().catch(e => { console.log(String(e && e.stack || e)); console.log('GATE NEWPLANE: FAIL'); process.exitCode = 1; });
