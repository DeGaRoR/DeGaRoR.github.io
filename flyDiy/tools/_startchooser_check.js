#!/usr/bin/env node
// GATE STARTCHOOSER - the sandbox's Fly / Drive verb with where from and where to (src/viewer/start_chooser.js; the user 13
// Nov: "Fly" for planes, "Drive" for cars, a little option beside it to choose the start and the destination, the autopilot
// from one to the other; the story keeps the hangar spawn).
// THE WIRING (source): the build carries the file; app.js syncGoLabel hands the verb to START_CHOOSER.label; editor.js asks
// START_CHOOSER.go() before today's roll-out; the chooser asks no browser question and calls only FLYDIY_START.
// THE FLOW (a DOM stub, FLYDIY_START stubbed - TOW-LAUNCH's API):
//   - no FLYDIY_START, or the story (available() false): no pill, the verb's words untouched, the one click is today's
//   - the verb reads Fly (a plane) / Drive (a car); the bench's warning rides the pill
//   - nothing remembered: the one click is today's roll-out (go() false)
//   - the sheet: From grouped, a start that cannot be used greyed with its reason; a glider's first start is the car tow
//   - a plane's To is the route's (FLYDIY_ROUTE), and Go hands { start, to } to FLYDIY_START.go; the start is remembered,
//     and the next one click goes from it
//   - a refusal is said on the sheet and the sheet stays
//   - a car: "Surprise me" picks a place the roads reach (never an unreachable one), said before it drives
//   node tools/_startchooser_check.js [--selftest]
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SELF = process.argv.includes('--selftest');
const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');

function sourceRows(S) {
  const bad = [], need = (k, re, what) => { if (!re.test(S[k])) bad.push(k + ': ' + what); };
  need('build', /'start_chooser\.js'/, 'the build carries start_chooser.js');
  need('app', /if \(window\.START_CHOOSER && window\.START_CHOOSER\.label\) window\.START_CHOOSER\.label\(v, b\.textContent, !!untested\);/, 'syncGoLabel hands the verb to the chooser');
  need('editor', /if \(window\.START_CHOOSER && window\.START_CHOOSER\.go && window\.START_CHOOSER\.go\(\)\) return;/, 'the verb asks the chooser before today\'s roll-out');
  if (/\b(confirm|alert|prompt)\s*\(/.test(strip(S.sc))) bad.push('start_chooser: a browser pop-up');
  if (/FLYDIY_ROUTE\.(to|spawn)\(|bGo/.test(strip(S.sc))) bad.push('start_chooser: it rolls out or routes by itself (only FLYDIY_START.go may)');
  need('css', /#scSheet \{ position:fixed;/, 'the sheet\'s look');
  return bad;
}

function dom() {
  const mkClass = () => { const s = new Set(); return { _s: s, add: c => s.add(c), remove: c => s.delete(c), contains: c => s.has(c), toggle: (c, on) => { if (on === undefined) on = !s.has(c); if (on) s.add(c); else s.delete(c); return on; } }; };
  const mk = tag => ({ tag, hidden: false, id: '', className: '', innerHTML: '', textContent: '', title: '', type: '', dataset: {}, classList: mkClass(), attrs: {}, on: {}, parentNode: null, kids: [],
    setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(k, f) { (this.on[k] = this.on[k] || []).push(f); },
    insertBefore(c) { c.parentNode = this; this.kids.push(c); return c; }, appendChild(c) { c.parentNode = this; this.kids.push(c); return c; } });
  const body = mk('body'), doc = { documentElement: { classList: mkClass() }, body, createElement: mk };
  const acts = mk('div'); const verb = mk('button'); verb.id = 'edRoll'; acts.appendChild(verb);
  return { doc, verb };
}

async function flow(src, o) {
  o = o || {};
  const bad = [], t = (ok, what) => { if (!ok) bad.push(what); };
  const { doc, verb } = dom(), store = new Map(), winOn = {};
  const calls = { go: [] };
  let kind = 'plane', powered = true, available = true, refuse = null;
  const STARTS = {
    plane: [{ id: 'HOME', mode: 'field', label: 'Jolene AFB', sub: 'an aerodrome', ok: true }, { id: 'w3', mode: 'field', label: 'w3 strip', sub: 'an aerodrome', ok: true },
            { id: 'SEA', mode: 'water', label: 'Metlakatla SPB', ok: false, why: 'water: needs floats' }],
    glider: [{ id: 'push:tw_ski', mode: 'push', label: 'A push off Skyline Altiport', ok: true }, { id: 'cartow:HOME', mode: 'cartow', label: 'The car tow', ok: true },
             { id: 'winch', mode: 'winch', label: 'A winch launch', ok: false, why: 'not built yet' }],
    car: [{ id: 'place:harbour', mode: 'place', label: 'Cedar Harbour front', ok: true }, { id: 'place:village', mode: 'place', label: 'The village', ok: true }],
  };
  const DESTS = { plane: [{ id: 'CIRCUIT', label: 'A circuit, back where it started', ok: true }, { id: 'w3', label: 'w3 strip', ok: true }],
                  car: [{ id: 'place:village', label: 'The village', ok: true }, { id: 'place:cannery', label: 'The cannery', ok: true }, { id: 'place:mine', label: 'Copperhead Mine', ok: false, why: 'no road from there' }] };
  const W = {
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) },
    matchMedia: () => ({ matches: false }), addEventListener: (k, f) => { (winOn[k] = winOn[k] || []).push(f); },
    FLYDIY_ROUTE: { get: () => ({ to: 'w3', want: 'w3' }) },
  };
  if (!o.noApi) W.FLYDIY_START = {
    available: () => available, vehicle: () => (kind === 'car' ? 'car' : 'plane'), powered: () => kind === 'plane' && powered,
    starts: () => Promise.resolve(STARTS[kind === 'plane' && !powered ? 'glider' : kind]),
    destinations: () => Promise.resolve(DESTS[kind === 'car' ? 'car' : 'plane']),
    go: x => { calls.go.push(x); return refuse ? Promise.reject(new Error(refuse)) : Promise.resolve(); },
  };
  const ctx = { window: W, document: doc, console, Promise, JSON, Math, String, Object, Array, setTimeout };
  vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'start_chooser.js' });
  const C = W.START_CHOOSER, tick = () => new Promise(r => setTimeout(r, 0)), settle = async () => { for (let i = 0; i < 6; i++) await tick(); };
  if (!C) return ['start_chooser: window.START_CHOOSER not published'];
  if (o.noApi) {
    verb.textContent = 'Roll out & fly'; C.label(verb, 'Roll out & fly', false);
    t(verb.textContent === 'Roll out & fly' && (!C._pill() || C._pill().hidden) && C.go() === false, 'no FLYDIY_START: the verb is today\'s, no pill, the one click today\'s');
    return bad;
  }
  // the story
  available = false; verb.textContent = 'Roll out'; C.label(verb, 'Roll out', false);
  t(verb.textContent === 'Roll out' && C._pill() && C._pill().hidden && C.go() === false, 'the story: the verb untouched, no pill, the one click is today\'s');
  available = true;
  // a plane
  C.label(verb, 'Roll out untested', true);
  t(verb.textContent === 'Fly' && !C._pill().hidden && /untested/.test(C._pill().html) && /where it stands/.test(C._pill().html), 'a plane: the verb says Fly; the bench\'s warning and the start ride the pill');
  t(C.go() === false && !calls.go.length, 'nothing remembered: the one click is today\'s roll-out');
  C.open(); await settle();
  const H = C._html();
  t(/>Fields</.test(H) && /Metlakatla SPB/.test(H) && /data-start="SEA" disabled title="water: needs floats"/.test(H), 'the sheet: fields grouped, a start that cannot be used greyed with its reason');
  t(C._state().pick === 'HOME' && C._state().to === 'w3', "the first usable start picked; the plane's To is the route's (" + C._state().to + ')');
  C._pick('w3'); await settle(); C._act('go'); await settle();
  t(calls.go.length === 1 && calls.go[0].start === 'w3' && calls.go[0].to === 'w3' && !C.isOpen(), 'Go hands { start, to } to FLYDIY_START.go, the sheet closed');
  t(/"plane":\{"start":"w3"/.test(store.get('flydiy.start') || ''), 'the start is remembered for planes');
  C.label(verb, 'Roll out & fly', false);
  t(C.go() === true && calls.go.length === 2 && calls.go[1].start === 'w3', 'the next one click goes from the remembered start');
  await settle();
  refuse = 'no such field: w3';
  C.go(); await settle();
  t(C.isOpen() && /Not from there: no such field: w3/.test(C._html()), 'a refusal is said on the sheet, which stays');
  refuse = null; C.close();
  // a glider
  powered = false;
  C.open(); await settle();
  t(C._state().kind === 'glider' && C._state().pick === 'cartow:HOME' && /data-start="winch" disabled title="not built yet"/.test(C._html()), "a glider: the car tow first (the user's Q4), the winch greyed, not built yet");
  C.close(); powered = true;
  // a car
  kind = 'car';
  C.label(verb, 'Roll out & fly', false);
  t(verb.textContent === 'Drive' && /Surprise me/.test(C._pill().html), 'a car: the verb says Drive, Surprise me by default');
  C.open(); await settle();
  const s = C._state();
  t(s.to === 'SURPRISE' && (s.surprise === 'place:village' || s.surprise === 'place:cannery') && /this time: /.test(C._html()), 'Surprise me draws a reachable place and says it (' + s.surprise + ')');
  for (let i = 0; i < 30; i++) { C.close(); C.open(); await settle(); if (C._state().surprise === 'place:mine') break; }
  t(C._state().surprise !== 'place:mine', 'Surprise me never draws a place the roads do not reach');
  C._act('go'); await settle();
  const g = calls.go[calls.go.length - 1];
  t(g.start === 'place:harbour' && (g.to === 'place:village' || g.to === 'place:cannery'), 'Drive hands the drawn place to FLYDIY_START.go: ' + JSON.stringify(g));
  const n = calls.go.length; C.go(); await settle();
  t(calls.go.length === n + 1 && calls.go[n].to !== 'place:mine' && /"car":\{"start":"place:harbour"[^}]*"to":"SURPRISE"/.test(store.get('flydiy.start') || ''), 'a car\'s one click draws again from where it remembered, never unreachable');
  // Escape
  C.open(); await settle();
  for (const f of winOn.keydown || []) f({ key: 'Escape', stopPropagation() {} });
  t(!C.isOpen(), 'Escape closes the sheet');
  return bad;
}

(async () => {
  const S = { sc: read('src/viewer/start_chooser.js'), app: read('src/viewer/app.js'), editor: read('src/viewer/editor.js'), build: read('tools/build.js'), css: read('src/viewer/editor.css') };
  const bad = sourceRows(S).concat(await flow(S.sc), await flow(S.sc, { noApi: true }));
  for (const b of bad) console.log('  FAIL ' + b);
  if (SELF) {
    const red = async (what, fn) => { const r = await fn(); console.log('  selftest ' + what + ': ' + (r.length ? 'red (ok)' : 'GREEN')); if (!r.length) bad.push('selftest inert: ' + what); };
    await red('the story gets the pill', () => flow(S.sc.replace("const avail = () => { try { return !!(S() && S().available()); }", "const avail = () => { try { return !!S(); }")));
    await red('Surprise me draws an unreachable place', () => flow(S.sc.replace('const ok = (L || []).filter(d => d.ok);', 'const ok = (L || []).slice(-1);')));
    await red('a greyed start can be picked', () => flow(S.sc.replace("(o.ok ? '' : ' disabled title=\"' + esc(o.why || '') + '\"')", "''")));
    await red('nothing remembered goes anyway', () => flow(S.sc.replace("if (!r) return false;                       // nothing chosen yet", "if (!r) return true;                       // nothing chosen yet")));
    await red('a refusal closes the sheet', () => flow(S.sc.replace('openSheet(true); st.msg = why; render();', 'closeSheet();')));
    await red('the verb rolls out by itself', () => sourceRows(Object.assign({}, S, { sc: S.sc + "\nwindow.FLYDIY_ROUTE.to('x');" })));
  }
  console.log('GATE STARTCHOOSER: ' + (bad.length ? 'FAIL (' + bad.length + ')' : 'PASS'));
  process.exit(bad.length ? 1 : 0);
})();
