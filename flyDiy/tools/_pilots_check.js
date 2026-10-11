#!/usr/bin/env node
// ============================================================================
// GATE PILOTS — the pilots you hire (G2290 PILOTS): the roster, hiring, who
// flies, refusals by trait, a pilot's place, skill growth from the logbook.
// ============================================================================
// futureDesigns/GAME-2026-10-06.md §9, §R (GQ13 four recruits on the existing
// bodies, no download; G-COST a one-time sign-on, no wages; GQ14 pilots are
// physical, the free boat home; GQ30 refusals by trait only).
// What is held, in blocks:
//   THE PACK       the roster IS the narrative pack's Block 3: parsed off the
//                  pack's own table (ID / BODY / SEED / PROFILE / TRAITS) -
//                  the ids in order, the body, the companion, the base profile,
//                  every knob's number, the style, every trait phrase mapped to
//                  its hook and its number (x0.9, x1.1), the ceilings, the
//                  cheapest / priciest sign-on; nothing on the roster that the
//                  pack does not say (what it leaves unsaid is listed, `pack`).
//   THE BODIES     every `who` is a chars_table.py key with its manifest and
//                  its chars_index.json entry (NO DOWNLOAD); the four distinct;
//                  ch20 (the test pilot) and ch02 (kept) are not recruits.
//   THE CLAMP      every profile (as signed on, and grown 0..120 landings)
//                  through PILOT-PERSONA's pilotProfile / pilotProfileSpec is a
//                  fixpoint inside PILOT_PROFILE_KNOBS' ranges, and the same
//                  bytes as the core hands makePilot today; an out-of-range
//                  person IS clamped by that path. PILOT-PERSONA's source: the
//                  core's own when it carries the knobs (train 40 on), else
//                  git (origin/master, then origin/claude/pilot-persona-g2085),
//                  else the knobs' snapshot below (edb17aa3) - printed.
//   REFUSALS       fire exactly: each kind on its trait at its boundary and on
//                  no other leg; the four recruits' matrix; refuses-nothing
//                  and fearless keep what they keep; an unknown fact refuses
//                  nothing; "I fly" never refused; the place (away / the boat).
//   GROWTH         deterministic (a replay, a shuffled logbook), monotone,
//                  capped at the ceiling, never away from the expert; remy to
//                  the expert in 30 landings, kit to the bush in 60, rafe
//                  never, sky on tailwheel landings only; only landings count.
//   THE PLACE      a pilot follows their aeroplane (playerArrive, "bring it
//                  home"); another flyer leaves them where it departed; the
//                  boat home is free and goes to HOME only; away = refused.
//   HIRING         the companion with careerNew (no fee); 2-3 offers, seeded,
//                  refreshed with the job market's epoch; hire charges the
//                  sign-on (the price book's when ECONOMY lands); refusals hand
//                  back the same document untouched; firing is free; a re-hire
//                  keeps the logbook; the normaliser is a fixpoint.
//   THE TEXT       every key resolves; the import (Block 5's "pilots").
//   THE SANDBOX    the page's career doors are inert without ?career=1
//                  (careerCrewProfile undefined: makePilot handed what it was);
//                  the persona select (when PILOT-PERSONA is in the tree) is
//                  PILOT-PERSONA's own, untouched; the crew's body door is the
//                  career's only.
//   PURITY         76_pilots.js touches no DOM, storage, clock, random, network.
//
//   node tools/_pilots_check.js             -> "GATE PILOTS: PASS|FAIL"
//   node tools/_pilots_check.js --selftest  -> negative verification: 76_pilots.js
//                  doctored one rule at a time; each must turn a check red
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const CORE = require('./flight_core.js');
const SELF = process.argv.includes('--selftest');

const SRC76 = fs.readFileSync(path.join(ROOT, 'src', 'core', '76_pilots.js'), 'utf8');
const SRC74 = fs.readFileSync(path.join(ROOT, 'src', 'core', '74_career.js'), 'utf8');   // careerNew / careerNormalise: the doors
const PACK = fs.readFileSync(path.join(ROOT, 'futureDesigns', 'game', 'NARRATIVE-PROMPT-PACK-2026-10-06.md'), 'utf8');
const CHARS_PY = fs.readFileSync(path.join(__dirname, 'chars_table.py'), 'utf8');
const APP = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
const BODY = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'body.html'), 'utf8');
const CREW = fs.readFileSync(path.join(__dirname, '_cage_crew.js'), 'utf8');
const namesOf = s => [...s.matchAll(/^(?:const|let|function)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);

// ---- PILOT-PERSONA's clamp: the core's, else git's, else the snapshot -------------------------------------------------
// (the snapshot: PILOT_PROFILE_KNOBS' ranges at edb17aa3, G2089 READY - only for a box without the ref)
const KNOBS_SNAPSHOT = [
  ['skill', 'reaction', 'range', 0, 0.6, 0], ['skill', 'smooth', 'range', 0.5, 2, 1], ['skill', 'hamFist', 'range', 0, 0.08, 0],
  ['skill', 'gain', 'range', 0.3, 1.5, null], ['quirks', 'overRotate', 'range', 0, 0.07, 0], ['quirks', 'flareK', 'range', 0.6, 1.3, 1],
  ['limits', 'bankK', 'range', 0.5, 1.3, 1], ['limits', 'comfortG', 'range', 1.05, 2, null],
  ['technique', 'field', 'pick', null, null, null], ['technique', 'slip', 'bool', null, null, false], ['technique', 'stepHold', 'bool', null, null, false],
].map(([sec, k, kind, lo, hi, d]) => Object.assign({ sec, k, kind, d }, kind === 'range' ? { lo, hi } : kind === 'pick' ? { opts: [null, 'normal', 'short'] } : {}));
function personaSource() {
  if (typeof CORE.PILOT_PROFILE_KNOBS !== 'undefined' && typeof CORE.pilotProfileSpec === 'function')
    return { from: 'the core (PILOT-PERSONA landed)', P: { PILOT_PROFILES: CORE.PILOT_PROFILES, PILOT_PROFILE_KNOBS: CORE.PILOT_PROFILE_KNOBS, pilotProfile: CORE.pilotProfile, pilotProfileSpec: CORE.pilotProfileSpec } };
  for (const ref of ['origin/master', 'origin/claude/pilot-persona-g2085']) {
    let s = '';
    try { s = cp.execSync('git show ' + ref + ':flyDiy/src/core/43_pilot.js', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 }).toString(); } catch (e) { continue; }
    const a = s.indexOf('const PILOT_PROFILES = {'), b = s.indexOf('function makePilot(');
    if (a < 0 || b < a || s.indexOf('PILOT_PROFILE_KNOBS') < 0) continue;
    const ctx = vm.createContext({});
    vm.runInContext(s.slice(a, b) + '\n;this.__P = { PILOT_PROFILES, PILOT_PROFILE_KNOBS, pilotProfile, pilotProfileSpec };', ctx);
    return { from: 'git ' + ref, P: ctx.__P };
  }
  return { from: 'the snapshot (edb17aa3: no PILOT-PERSONA in the core or git)', P: { PILOT_PROFILES: CORE.PILOT_PROFILES, PILOT_PROFILE_KNOBS: KNOBS_SNAPSHOT, pilotProfile: null, pilotProfileSpec: null } };
}
const PERSONA = personaSource();

// 76_pilots.js evaluated FRESH over the core's globals (minus its own names), so the selftest doctors exactly the rules
// under test; `persona` lays PILOT-PERSONA's four names over the core's (the roster as it flies after train 40)
function loadModel(mut, persona, extra) {
  const src = SRC74 + '\n' + (mut ? mut(SRC76) : SRC76);
  const names = namesOf(src);
  const base = Object.assign({ console }, CORE);
  for (const n of names) delete base[n];
  if (persona && persona.pilotProfile) Object.assign(base, persona);
  Object.assign(base, extra || {});
  const ctx = vm.createContext(base);
  vm.runInContext(src + '\n;this.__M = { ' + names.join(', ') + ' };', ctx, { filename: '76_pilots' });
  return Object.assign({}, CORE, persona && persona.pilotProfile ? persona : {}, extra || {}, ctx.__M, { __ctx: ctx });
}

// ---- the pack's Block 3 table, parsed by its own columns ----------------------------------------------------------------
function parsePack() {
  const blk = PACK.slice(PACK.indexOf('## BLOCK 3'), PACK.indexOf('## BLOCK 4'));
  const lines = blk.split('\n');
  const h = lines.findIndex(l => /^ID\s+BODY\s+SEED/.test(l));
  const H = lines[h], cols = ['ID', 'BODY', 'SEED', 'PROFILE', 'TRAITS'].map(w => H.indexOf(w));
  const rows = [];
  for (let i = h + 1; i < lines.length && !/^```/.test(lines[i]); i++) {
    const l = lines[i];
    if (!l.trim()) continue;
    const cut = cols.map((c, j) => l.slice(c, j + 1 < cols.length ? cols[j + 1] : undefined).trim());
    if (cut[0]) rows.push({ id: cut[0], body: cut[1], seed: [], profile: [], traits: [] });
    const r = rows[rows.length - 1];
    if (cut[2]) r.seed.push(cut[2]); if (cut[3]) r.profile.push(cut[3]); if (cut[4]) r.traits.push(cut[4]);
  }
  for (const r of rows) {
    r.seed = r.seed.join(' '); r.profile = r.profile.join(' '); r.traits = r.traits.join(' ');
    const [base, rest] = r.profile.split(';');
    r.base = base.trim(); r.knobs = {}; r.style = null;
    for (const it of rest.split(',').map(s => s.trim()).filter(Boolean)) {
      const m = /^(\w+)\s+(\S+)$/.exec(it);
      if (!m) { r.knobs[it] = true; continue; }
      if (m[1] === 'style') { r.style = m[2]; continue; }
      r.knobs[m[1]] = /^[-\d.]+$/.test(m[2]) ? +m[2] : m[2];
    }
    // the traits: comma-separated at depth 0
    const out = []; let d = 0, cur = '';
    for (const ch of r.traits) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && !d) { out.push(cur.trim()); cur = ''; } else cur += ch; }
    if (cur.trim()) out.push(cur.trim());
    r.phrases = out;
  }
  return { rows, reserved: /ch20[^.]*TEST PILOT/.test(blk) && /ch02 is kept/.test(blk) };
}
// each pack phrase -> what it means on the roster (a check); every roster trait must be named by some phrase
const PHRASES = [
  [/^mechanic \(field repairs x([\d.]+)\)$/, (M, R, m) => [R.traits.includes('mechanic') && M.PILOTS_TRAITS.mechanic.labourK === +m[1], ['mechanic']]],
  [/^cautious$/, (M, R) => [R.traits.includes('cautious') && M.PILOTS_TRAITS.cautious.refuse === 'weather', ['cautious']]],
  [/^night-shy$/, (M, R) => [R.traits.includes('night-shy') && M.PILOTS_TRAITS['night-shy'].refuse === 'night', ['night-shy']]],
  [/^grows (steadily|fast) \(ceiling: (\w+)\)$/, (M, R, m) => [!!R.grow && R.grow.rate === (m[1] === 'steadily' ? 'steady' : 'fast') && R.grow.ceiling === m[2], []]],
  [/^fearless \(no weather refusals\)$/, (M, R) => [R.traits.includes('fearless') && M.PILOTS_TRAITS.fearless.keeps.includes('weather'), ['fearless']]],
  [/^hard on airframes \(repair bills x([\d.]+)\)$/, (M, R, m) => [R.traits.includes('hard-on-airframes') && M.PILOTS_TRAITS['hard-on-airframes'].billK === +m[1], ['hard-on-airframes']]],
  [/^eager \(the cheapest sign-on\)$/, (M, R) => [R.traits.includes('eager') && M.PILOTS_ORDER.filter(x => x !== R.id && !M.PILOTS_ROSTER[x].companion).every(x => M.pilotsSignOn(x) > M.pilotsSignOn(R.id)), ['eager']]],
  [/^short-field$/, (M, R) => [R.traits.includes('short-field') && R.profile.knobs.field === 'short' && R.profile.knobs.slip === true, ['short-field']]],
  [/^loves taildraggers$/, (M, R) => [R.traits.includes('loves-taildraggers') && M.PILOTS_TRAITS['loves-taildraggers'].growOn === 'tw', ['loves-taildraggers']]],
  [/^the priciest sign-on$/, (M, R) => [M.PILOTS_ORDER.filter(x => x !== R.id).every(x => M.pilotsSignOn(x) < M.pilotsSignOn(R.id)), []]],
  [/^refuses nothing$/, (M, R) => [R.traits.includes('refuses-nothing') && M.PILOTS_TRAITS['refuses-nothing'].keeps === '*', ['refuses-nothing']]],
];

let fails = [], checks = 0;
const ok = (c, msg) => { checks++; if (!c) fails.push(msg); return !!c; };
const J = o => JSON.stringify(o);
const eq = (a, b) => J(a) === J(b);
const clone = o => JSON.parse(J(o));
const lines = [];

function run(mut) {
  fails = []; checks = 0; lines.length = 0;
  const M = loadModel(mut, null);
  const SRC = mut ? mut(SRC76) : SRC76;
  const R = M.PILOTS_ROSTER, ORDER = M.PILOTS_ORDER;
  const refused = (r, before, doc, label) => {
    ok(r && r.ok === false && typeof r.why === 'string' && r.why.length > 0, label + ': refused, with a reason');
    ok(r && r.doc === doc, label + ': the refusal hands back the same document');
    ok(eq(doc, before), label + ': the refusal changed nothing');
  };

  // ==== THE PACK =============================================================
  const P = parsePack();
  ok(P.rows.length === 4, 'the pack\'s Block 3 has four pilots (' + P.rows.length + ')');
  ok(eq(P.rows.map(r => r.id), ORDER) && eq(Object.keys(R), ORDER), 'the ids are the pack\'s, in its order: ' + P.rows.map(r => r.id).join() + ' vs ' + ORDER.join());
  for (const r of P.rows) {
    const X = R[r.id];
    if (!ok(!!X, 'no roster row for the pack\'s ' + r.id)) continue;
    ok(X.id === r.id, r.id + ': its id field');
    ok(X.who === r.body, r.id + ': the body is the pack\'s (' + r.body + ' vs ' + X.who + ')');
    ok(!!X.companion === /^COMPANION\b/.test(r.seed), r.id + ': the companion marker');
    ok(X.profile.base === r.base && !!M.PILOT_PROFILES[r.base], r.id + ': the base profile is the pack\'s (' + r.base + ' vs ' + X.profile.base + ')');
    ok(eq(Object.keys(X.profile.knobs).sort(), Object.keys(r.knobs).sort()), r.id + ': the knobs named are the pack\'s (' + Object.keys(r.knobs).sort() + ' vs ' + Object.keys(X.profile.knobs).sort() + ')');
    for (const k of Object.keys(r.knobs)) ok(X.profile.knobs[k] === r.knobs[k], r.id + ': ' + k + ' is the pack\'s ' + r.knobs[k] + ' (' + X.profile.knobs[k] + ')');
    ok(r.style ? X.style === r.style : (X.style === 'normal' && !!(X.pack && X.pack.style)), r.id + ': the style (the pack\'s ' + (r.style || 'unsaid: normal, listed in `pack`') + ')');
    ok(!!M.PILOT_STYLES[X.style], r.id + ': the style is a PILOT_STYLES name');
    const named = new Set();
    let growSaid = false;
    for (const ph of r.phrases) {
      const hit = PHRASES.find(([re]) => re.test(ph));
      if (!ok(!!hit, r.id + ': the pack\'s trait phrase "' + ph + '" maps to no hook')) continue;
      const [good, ids] = hit[1](M, X, hit[0].exec(ph));
      ok(good, r.id + ': the pack\'s "' + ph + '" is not what the roster does');
      ids.forEach(t => named.add(t));
      if (/^grows/.test(ph)) growSaid = true;
    }
    ok(eq(X.traits.slice().sort(), Array.from(named).sort()), r.id + ': the traits are exactly the pack\'s (' + X.traits + ' vs ' + Array.from(named) + ')');
    ok(growSaid || (X.grow === null ? !!(X.pack && X.pack.grow) : !!(X.pack && X.pack.grow)), r.id + ': a growth the pack does not state is listed in `pack`');
    ok(X.portrait === null, r.id + ': the portrait is null until the user\'s AI run');
    for (const t of X.traits) ok(!!M.PILOTS_TRAITS[t], r.id + ': trait ' + t + ' is a hook');
    if (X.grow) ok(!!M.PILOTS_GROW[X.grow.rate] && !!M.PILOT_PROFILES[X.grow.ceiling], r.id + ': the growth names a rate and a profile');
  }
  ok(P.reserved && eq(Object.keys(M.PILOTS_RESERVED).sort(), ['ch02', 'ch20']), 'ch20 (the test pilot) and ch02 (kept) are the reserved bodies, as the pack says');
  ok(M.PILOTS_COMPANION === 'kit' && R.kit.companion && ORDER.filter(id => R[id].companion).length === 1, 'one companion: kit');
  lines.push('the pack: 4 pilots, bodies, the companion, ' + P.rows.reduce((a, r) => a + Object.keys(r.knobs).length, 0) + ' knobs, ' + P.rows.reduce((a, r) => a + r.phrases.length, 0) + ' trait phrases - the roster exactly');

  // ==== THE BODIES: no download, every `who` in chars_table ===================
  const keys = [...CHARS_PY.slice(0, CHARS_PY.indexOf('ANIMS = [')).matchAll(/key='(\w+)'/g)].map(m => m[1]);
  const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'chars', 'chars_index.json'), 'utf8'));
  for (const id of ORDER) {
    const w = R[id].who;
    ok(keys.includes(w), id + ': ' + w + ' is a chars_table.py key');
    ok(fs.existsSync(path.join(ROOT, 'src', 'chars', w + '_char.js')) && index.includes(w + '_char.js'), id + ': ' + w + '\'s manifest ships (src/chars, chars_index.json): no download');
    ok(!M.PILOTS_RESERVED[w], id + ': wears a reserved body (' + w + ')');
  }
  ok(new Set(ORDER.map(id => R[id].who)).size === 4, 'the four bodies are distinct');
  ok(eq(ORDER.map(id => R[id].who), ['ch01', 'ch42', 'remy', 'ch22']), 'GQ13: kit ch01, rafe ch42, remy remy, sky ch22');
  ok(!/https?:|fetch\(|import\(|XMLHttpRequest|\.glb|\.fbx/.test(SRC), '76_pilots.js names no download');
  lines.push('the bodies: ' + ORDER.map(id => id + '=' + R[id].who).join(' ') + ' (chars_table keys, shipped manifests); ch20 / ch02 not recruits; no download');

  // ==== THE CLAMP: PILOT-PERSONA's path ========================================
  const PP = PERSONA.P;
  const MP = PP.pilotProfile ? loadModel(mut, PP) : null;
  const inRange = (flat, label) => {
    for (const K of PP.PILOT_PROFILE_KNOBS) {
      const v = flat[K.k];
      if (K.kind === 'range') ok(v == null ? K.d === null : (v >= K.lo - 1e-12 && v <= K.hi + 1e-12), label + ': ' + K.k + ' ' + v + ' outside ' + K.lo + '..' + K.hi);
      else if (K.kind === 'pick') ok(K.opts.includes(v == null ? null : v), label + ': ' + K.k + ' ' + v + ' not a choice');
    }
  };
  for (const id of ORDER) for (const n of [0, 1, 7, 15, 29, 30, 45, 59, 60, 61, 90, 120]) {
    const G = M.pilotsGrowth(id, n).flat;
    inRange(G, id + ' @' + n);
    const built = M.pilotsProfile(G, id);
    if (MP) {
      const flat = PP.pilotProfile(built);
      inRange(flat, id + ' @' + n + ' (clamped)');
      const spec = PP.pilotProfileSpec(flat);
      ok(eq(PP.pilotProfileSpec(PP.pilotProfile(Object.assign({ name: id, active: true }, spec))), spec), id + ' @' + n + ': the clamp is a fixpoint');
      const after = MP.pilotsProfile(G, id);
      ok(eq(Object.assign({}, after, { name: 0 }), Object.assign({ name: 0, active: true }, spec)), id + ' @' + n + ': the profile after train 40 is the clamp\'s spec');
      // the same person today (PILOT-ONE's sections) and after train 40 (the clamp): every knob the same value
      const a = PP.pilotProfile(built), b = PP.pilotProfile(after);
      for (const K of PP.PILOT_PROFILE_KNOBS) ok(a[K.k] === b[K.k] || (a[K.k] == null && b[K.k] == null), id + ' @' + n + ': ' + K.k + ' differs today / after train 40 (' + a[K.k] + ' / ' + b[K.k] + ')');
    }
  }
  if (MP) {
    const wild = MP.pilotsProfile({ reaction: 5, smooth: -1, hamFist: 1, overRotate: 2, flareK: 9, bankK: 0, comfortG: 9, field: 'sideways', slip: 'yes' }, 'wild');
    const f = Object.assign({}, wild.skill, wild.quirks, wild.limits, wild.technique);   // as handed to makePilot, unread
    ok(f.reaction === 0.6 && f.smooth === 0.5 && f.hamFist === 0.08 && f.comfortG === 2 && f.field == null && f.bankK === 0.5, 'an out-of-range person is clamped by the path (' + J([f.reaction, f.smooth, f.hamFist, f.comfortG, f.field, f.bankK]) + ')');
  }
  ok(M.pilotsProfile(M.pilotsBaseFlat('kit'), 'kit').skill.reaction === 0.25 && M.pilotsProfile(M.pilotsBaseFlat('sky'), 'sky').technique.field === 'short', 'the pack\'s knobs reach makePilot (kit reaction .25, sky short field)');
  lines.push('the clamp (' + PERSONA.from + '): 4 pilots x 12 growth points, every knob in range, a fixpoint, the same values today and after train 40; a wild person clamped');

  // ==== REFUSALS (GQ30: by trait only) ==========================================
  const F = M.CONTRACT_FIELDS;
  const base = { from: 'HOME', to: 'HOME', gear: 'wheels', windKt: 5, endHour: 12 };
  const LIM = M.PILOTS_WEATHER.windKt, DUSK = M.CONTRACT_DUSK_H, SH = M.PILOTS_SHORT_M;
  const legs = {
    weather: Object.assign({}, base, { windKt: LIM + 0.1 }), weatherAt: Object.assign({}, base, { windKt: LIM }),
    night: Object.assign({}, base, { endHour: DUSK }), nightBefore: Object.assign({}, base, { endHour: DUSK - 0.01 }),
    short: Object.assign({}, base, { to: { id: 'x', name: 'X', len: SH - 1, surf: 'concrete' } }), shortAt: Object.assign({}, base, { to: { id: 'x', name: 'X', len: SH, surf: 'concrete' } }),
    unpaved: Object.assign({}, base, { to: 'w3' }), water: Object.assign({}, base, { to: 'SEA' }), floats: Object.assign({}, base, { gear: 'floats' }),
    snow: Object.assign({}, base, { to: 'tw_ski' }), skis: Object.assign({}, base, { gear: 'skis' }),
    unknown: { from: 'HOME', to: 'HOME', gear: 'wheels' },
  };
  // what fires on each leg (the altiport is grass: snow AND unpaved; a water lane is never "unpaved")
  const fire = { weather: ['weather'], night: ['night'], short: ['short'], unpaved: ['unpaved'], water: ['water'], floats: ['water'], snow: ['snow', 'unpaved'], skis: ['snow'] };
  // the four recruits: only kit refuses, on the weather and the night
  for (const id of ORDER) {
    ok(M.pilotsRefusal(id, base) === null, id + ' refuses the plain leg');
    for (const k of Object.keys(legs)) {
      const r = M.pilotsRefusal(id, legs[k]);
      const exp = id === 'kit' && (k === 'weather' || k === 'night') ? k : null;
      ok((r ? r.kind : null) === exp, id + ' on the ' + k + ' leg: ' + (r ? r.kind : 'flies') + ', want ' + (exp || 'flies'));
      if (r) ok(!/\[|\{/.test(r.why) && r.why.includes(M.pilotsName(id)), id + ': the refusal\'s line resolves (' + r.why + ')');
    }
  }
  // every hook on a person of its own (a test row, never shipped): it fires on its leg and on no other
  const hooks = { cautious: 'weather', 'night-shy': 'night', 'short-strip-nerves': 'short', 'paved-only': 'unpaved', 'no-water': 'water', 'no-snow': 'snow' };
  for (const t of Object.keys(hooks)) {
    R.t_ = { id: 't_', who: 'ch01', profile: { base: 'club', knobs: {} }, style: 'normal', traits: [t], grow: null };
    for (const k of Object.keys(legs)) {
      const r = M.pilotsRefusal('t_', legs[k]);
      const exp = (fire[k] || []).includes(hooks[t]) ? hooks[t] : null;
      ok((r ? r.kind : null) === exp && (!r || r.trait === t), 'the ' + t + ' hook on the ' + k + ' leg: ' + (r ? r.kind : 'flies') + ', want ' + (exp || 'flies'));
    }
    ok(M.pilotsRefusal('t_', base) === null, 'the ' + t + ' hook refuses the plain leg');
  }
  R.t_ = { id: 't_', who: 'ch01', profile: { base: 'club', knobs: {} }, style: 'normal', traits: ['night-shy', 'cautious', 'no-water', 'refuses-nothing'], grow: null };
  ok(Object.keys(legs).every(k => M.pilotsRefusal('t_', legs[k]) === null), 'refuses-nothing keeps every refusal');
  R.t_.traits = ['cautious', 'fearless', 'night-shy'];
  ok(M.pilotsRefusal('t_', legs.weather) === null && (M.pilotsRefusal('t_', legs.night) || {}).kind === 'night', 'fearless keeps the weather, and only the weather');
  R.t_.traits = ['night-shy', 'cautious'];
  ok((M.pilotsRefusal('t_', Object.assign({}, legs.night, { windKt: 40 })) || {}).kind === 'night', 'two refusals: the first in the pilot\'s trait order');
  delete R.t_;
  ok(M.pilotsRefusal('kit', legs.unknown) === null, 'an unknown wind or hour refuses nothing');
  ok(M.pilotsRefusal('nobody', base) === null && M.pilotsRefusal('kit', null) === null, 'no pilot / no leg: no refusal');
  lines.push('refusals: the 4 recruits x ' + Object.keys(legs).length + ' legs (kit: wind > ' + LIM + ' kt, a leg ending at ' + DUSK + ' h); 6 hooks each on its leg alone, at its boundary; refuses-nothing, fearless, the order');

  // ==== THE CAREER: hiring, the place, growth ====================================
  const d0 = M.careerNew({ id: 't', seed: 'dev' });
  ok(eq(d0.career.roster, ['kit']) && d0.career.pilots.kit && d0.career.pilots.kit.fee === 0 && d0.career.pilotPick === 'kit', 'careerNew: the companion arrives, no fee, flies next');
  ok(d0.wallet === M.CAREER_GRANT && d0.ledger.length === 1 && d0.ledger[0].k === 'grant', 'careerNew: the grant alone in the ledger (no sign-on line for the companion)');
  ok(M.pilotsPlace(d0, 'kit') === 'HOME', 'the companion starts at HOME');
  ok(eq(M.careerNormalise(clone(d0)), d0), 'careerNormalise is a fixpoint with the roster');
  const odd = clone(d0); odd.career.roster.push('ghost', 'kit'); odd.career.pilots.ghost = { aero: 'w3' }; odd.career.pilotPick = 'ghost';
  const on = M.careerNormalise(odd);
  ok(eq(on.career.roster, ['kit']) && !on.career.pilots.ghost && on.career.pilotPick === 'kit', 'the normaliser drops an unknown pilot and a duplicate');
  const old = clone(d0); delete old.career.roster; delete old.career.pilots; delete old.career.pilotPick; delete old.career.pilotN;
  const no = M.careerNormalise(old);
  ok(eq(no.career.roster, []) && no.career.pilotPick === 'me' && no.career.pilotN === 0, 'an older career (no roster) normalises to "I fly"');
  // the market
  const offersAt = (doc, n) => { const x = clone(doc); x.career.contracts.done = Array.from({ length: n }, (_, i) => ({ id: 'x' + i, at: 0, pay: 0 })); return M.pilotsOffers(x); };
  const seen = new Set();
  for (let n = 0; n < 24; n++) {
    const o = offersAt(d0, n);
    ok(o.length >= M.PILOTS_MARKET.min && o.length <= M.PILOTS_MARKET.max && o.every(id => id !== 'kit' && R[id]), 'the offers at ' + n + ' done: 2-3 of the unhired (' + o + ')');
    ok(eq(o, offersAt(d0, n)), 'the offers are deterministic');
    ok(eq(o, offersAt(d0, M.contractEpoch(n) * M.CONTRACT_GEN.refreshEvery)), 'the offers hold within an epoch');
    seen.add(o.join());
  }
  ok(seen.size >= 2, 'the offers refresh with the market (' + seen.size + ' different sets over 8 epochs)');
  const d0b = clone(d0); d0b.career.seed = 'other';
  const seeds = new Set([0, 3, 6, 9, 12, 15].map(n => offersAt(d0b, n).join() + '|' + offersAt(d0, n).join()));
  ok(seeds.size >= 2, 'the offers follow the career\'s seed');
  // hire
  const off = M.pilotsOffers(d0), notOff = ORDER.filter(id => id !== 'kit' && !off.includes(id));
  const h = M.pilotsHire(d0, off[0]);
  ok(h.ok && h.doc.wallet === d0.wallet - M.pilotsSignOn(off[0]) && h.doc.career.roster.includes(off[0]), 'hire: on the roster, the sign-on charged (' + off[0] + ' ' + M.pilotsSignOn(off[0]) + ')');
  const L = h.doc.ledger[h.doc.ledger.length - 1];
  ok(L && L.k === 'signon' && L.ref === off[0] && L.amt === M.pilotsSignOn(off[0]), 'hire: the ledger\'s sign-on line');
  ok(M.pilotsPlace(h.doc, off[0]) === 'HOME', 'a new hire signs on at HOME');
  { const b = clone(d0); refused(M.pilotsHire(d0, 'kit'), b, d0, 'hire the hired'); }
  if (notOff.length) { const b = clone(d0); refused(M.pilotsHire(d0, notOff[0]), b, d0, 'hire one not on offer'); }
  { const poor = clone(d0); poor.wallet = 10; const b = clone(poor); refused(M.pilotsHire(poor, off[0]), b, poor, 'hire past the wallet'); }
  { const b = clone(d0); refused(M.pilotsHire(d0, 'nobody'), b, d0, 'hire nobody'); }
  { const b = clone(d0); refused(M.pilotsFire(d0, off[0]), b, d0, 'fire one not hired'); }
  ok(M.pilotsSignOn('kit') === 0 && M.pilotsSignOn('remy') < M.pilotsSignOn('rafe') && M.pilotsSignOn('rafe') < M.pilotsSignOn('sky'), 'the sign-ons: the companion free, remy the cheapest, sky the priciest');
  const ME = loadModel(mut, null, { econPrice: (k, id) => (k === 'signon' ? { kit: 999, remy: 111, rafe: 222, sky: 333 }[id] : null) });
  ok(ME.pilotsSignOn('rafe') === 222 && ME.pilotsSignOn('kit') === 0, 'the sign-on is the price book\'s when ECONOMY lands (econPrice(\'signon\', id))');
  // fire: free; the pick falls back; a re-hire keeps the logbook
  const fk = M.pilotsFire(d0, 'kit');
  ok(fk.ok && fk.doc.wallet === d0.wallet && fk.doc.ledger.length === d0.ledger.length && !fk.doc.career.roster.includes('kit') && fk.doc.career.pilotPick === 'me', 'fire: free, off the roster, the next flight is "I fly"');
  ok(M.pilotsCanFly(fk.doc, 'me', 'w3', legs.weather).ok, '"I fly" is never refused');
  ok(!M.pilotsCanFly(fk.doc, 'kit', 'HOME', base).ok, 'a fired pilot does not fly');
  // the place: with the aeroplane
  let d = clone(d0);
  d.fleet = { Cub: { hangar: 'HOME', aero: 'HOME' } };
  const fly = (doc, who, to, landed) => {
    const from = M.playerWhere(doc, 'Cub').aero;
    let x = doc;
    if (landed) x = M.playerArrive(x, 'Cub', to, {}).doc;
    const r = M.pilotsOnFlightEnd(x, { pilot: who, slot: 'Cub', from, to: landed ? to : null, landed, tw: true, t: 600 });
    return r.doc;
  };
  d = fly(d, 'kit', 'w3', true);
  ok(M.pilotsPlace(d, 'kit') === 'w3' && d.career.pilots.kit.plane === 'Cub' && d.career.pilots.kit.log.length === 1, 'kit flew the Cub to w3: kit is at w3, with it');
  const bh = M.playerBringHome(d, 'Cub', {}).doc;
  ok(M.pilotsPlace(bh, 'kit') === 'HOME', '"bring it home": the pilot with it comes home too');
  d = fly(d, 'me', 'mn_strip', true);
  ok(M.pilotsPlace(d, 'kit') === 'w3' && d.career.pilots.kit.plane === null && M.playerWhere(d, 'Cub').aero === 'mn_strip', 'you flew the Cub on to the mine: kit stays at w3');
  const away = M.pilotsCanFly(d, 'kit', 'mn_strip', base);
  ok(!away.ok && away.kind === 'away' && !away.boat && /w3|Tamgas/.test(away.why), 'kit is not where the aeroplane is: refused (' + away.why + ')');
  const boatQ = M.pilotsCanFly(d, 'kit', 'HOME', base);
  ok(!boatQ.ok && boatQ.boat === true, 'the aeroplane is at HOME: the boat brings kit');
  const bt = M.pilotsBoatHome(d, 'kit');
  ok(bt.ok && M.pilotsPlace(bt.doc, 'kit') === 'HOME' && bt.doc.wallet === d.wallet && bt.doc.ledger.length === d.ledger.length, 'the boat home: free, to HOME');
  { const b = clone(bt.doc); refused(M.pilotsBoatHome(bt.doc, 'kit'), b, bt.doc, 'the boat home when already at HOME'); }
  ok(M.pilotsCanFly(bt.doc, 'kit', 'HOME', base).ok, 'home by boat, kit flies the aeroplane at HOME');
  // a flight that ended in a wreck / off a field: the ledger keeps the aeroplane where it left, the pilot with it
  let w = fly(bt.doc, 'kit', 'w3', true);
  const before = M.pilotsPlace(w, 'kit');
  w = fly(w, 'kit', null, false);
  ok(M.pilotsPlace(w, 'kit') === before && w.career.pilots.kit.log.length === 3, 'a flight that did not land: the pilot stays with the aeroplane where it stands; logged');
  // the money hooks: with the aeroplane, the mechanic's field labour; rafe's bill
  ok(J(M.pilotsRepairK(w, 'Cub')) === J({ labour: 0.9, bill: 1, pilot: 'kit' }), 'the mechanic with the Cub, out at w3: field labour x0.9 (' + J(M.pilotsRepairK(w, 'Cub')) + ')');
  { const inn = clone(w); inn.fleet.Cub = { hangar: 'HOME', aero: 'HOME' }; ok(M.pilotsRepairK(inn, 'Cub').labour === 1, 'the mechanic\'s x0.9 is the field\'s only (in a hangar: x1)'); }
  ok(M.pilotsRepairK(d0, 'Cub').labour === 1 && M.pilotsRepairK(d0, 'Cub').bill === 1, 'nobody with it: x1');
  { const r = clone(w); r.career.roster.push('rafe'); r.career.pilots.rafe = { hired: 0, fee: 0, aero: 'w3', plane: null, log: [] };
    const rr = M.pilotsOnFlightEnd(M.playerArrive(r, 'Cub', 'HOME', {}).doc, { pilot: 'rafe', slot: 'Cub', from: 'w3', to: 'HOME', landed: true, tw: true, t: 1 }).doc;
    ok(M.pilotsRepairK(rr, 'Cub').bill === 1.1 && rr.career.pilots.kit.plane === null && M.pilotsPlace(rr, 'kit') === 'w3', 'rafe took the Cub: repair bills x1.1, and kit stays where it left from'); }
  // growth from the logbook
  const logOf = (n, tw, landed) => Array.from({ length: n }, (_, i) => ({ n: i + 1, at: i, slot: 'Cub', from: 'HOME', to: 'w3', landed: landed !== false, tw: !!tw, t: 600 }));
  const withLog = (id, log) => { const x = clone(d0); x.career.pilots[id] = { hired: 0, fee: 0, aero: 'HOME', plane: null, log }; if (!x.career.roster.includes(id)) x.career.roster.push(id); return x; };
  for (const id of ORDER) {
    const s = M.pilotsBaseFlat(id), E = M.pilotProfile('expert');
    let prev = s;
    for (let n = 0; n <= 130; n += 5) {
      const g = M.pilotsGrowth(id, n);
      ok(eq(g, M.pilotsGrowth(id, n)), id + ' @' + n + ': growth deterministic');
      for (const K of M.pilotsKnobs()) {
        if (K.kind !== 'range') continue;
        const top = K.hi != null ? K.hi : 2, num = v => (v == null ? top : v);
        const v = num(g.flat[K.k]), sv = num(s[K.k]), pv = num(prev[K.k]), ev = num(E[K.k]);
        if (sv == null || ev == null) continue;
        ok(Math.abs(v - ev) <= Math.abs(sv - ev) + 1e-9, id + ' @' + n + ': ' + K.k + ' grew AWAY from the expert (' + sv + ' -> ' + v + ')');
        ok(Math.abs(v - ev) <= Math.abs(pv - ev) + 1e-9, id + ' @' + n + ': ' + K.k + ' went back (' + pv + ' -> ' + v + ')');
        if (R[id].grow) {
          const cv = num(M.pilotProfile(R[id].grow.ceiling)[K.k]);
          ok(Math.min(sv, cv) - 1e-9 <= v && v <= Math.max(sv, cv) + 1e-9, id + ' @' + n + ': ' + K.k + ' past its ceiling (' + v + ')');
        }
      }
      prev = g.flat;
    }
    const N = R[id].grow ? M.PILOTS_GROW[R[id].grow.rate] : 0;
    if (N) ok(eq(M.pilotsGrowth(id, N).flat, M.pilotsGrowth(id, N + 77).flat) && M.pilotsGrowth(id, N).f === 1, id + ': capped at its ceiling (' + N + ' landings)');
  }
  const ex = M.pilotProfile('expert'), remyN = M.PILOTS_GROW.fast;
  ok(M.PILOTS_GROW.fast < M.PILOTS_GROW.steady && R.remy.grow.rate === 'fast', 'remy grows fast (' + remyN + ' landings) - faster than steadily (' + M.PILOTS_GROW.steady + ')');
  ok(M.pilotsKnobs().every(K => J(M.pilotsGrowth('remy', remyN).flat[K.k]) === J(ex[K.k])), 'remy at ' + remyN + ' landings flies as the expert');
  ok(M.pilotsGrowth('remy', remyN / 2).flat.reaction > 0, 'remy half-way is not yet the expert');
  const kitTop = M.pilotsGrowth('kit', M.PILOTS_GROW.steady).flat, bush = M.pilotProfile('bush');
  ok(kitTop.reaction === bush.reaction && kitTop.field === 'short' && kitTop.slip === true && kitTop.comfortG === bush.comfortG, 'kit at the ceiling flies the bush\'s reaction, technique and comfort');
  ok(M.pilotsGrowth('kit', 1e6).flat.reaction >= bush.reaction, 'kit never passes the bush');
  { // a ceiling FURTHER from the expert than the start (a test row: club -> student) never drags a knob back
    R.t_ = { id: 't_', who: 'ch01', profile: { base: 'club', knobs: {} }, style: 'normal', traits: [], grow: { rate: 'fast', ceiling: 'student' } };
    const s = M.pilotsBaseFlat('t_'), g = M.pilotsGrowth('t_', 1000).flat, E = M.pilotProfile('expert');
    ok(['reaction', 'smooth', 'hamFist', 'overRotate', 'flareK', 'bankK'].every(k => Math.abs(g[k] - E[k]) <= Math.abs(s[k] - E[k]) + 1e-9), 'a ceiling further from the expert drags nothing back (' + J(g) + ')');
    delete R.t_;
  }
  ok(eq(M.pilotsGrowth('rafe', 500).flat, M.pilotsBaseFlat('rafe')), 'rafe never changes (no ceiling)');
  ok(M.pilotsLandings({ log: logOf(10, false) }, R.sky) === 0 && M.pilotsLandings({ log: logOf(10, true) }, R.sky) === 10, 'sky grows on tailwheel landings only');
  ok(M.pilotsGrowth('sky', 60).flat.field === 'short' && M.pilotsGrowth('sky', 60).flat.slip === true, 'sky\'s short field and slips are the trait\'s: growth never moves them');
  ok(M.pilotsLandings({ log: logOf(10, true, false) }, R.kit) === 0, 'only landings count (a flight that did not land: none)');
  { const lg = logOf(23, true); const a = M.pilotsFlatOf(withLog('kit', lg), 'kit'), b = M.pilotsFlatOf(withLog('kit', lg.slice().reverse()), 'kit');
    ok(eq(a, b) && eq(a, M.pilotsGrowth('kit', 23).flat), 'growth replays from the logbook (order-free)'); }
  { const r = M.pilotsOnFlightEnd(withLog('kit', logOf(4, true)), { pilot: 'kit', slot: null, from: 'HOME', to: 'w3', landed: true, tw: false, t: 30 });
    ok(r.ok && r.doc.career.pilots.kit.log.length === 5 && r.logged.n === 1 && r.doc.career.pilotN === 1 && M.pilotsPlace(r.doc, 'kit') === 'w3', 'a logged flight of an unsaved build: the row, the pilot left at the stop'); }
  lines.push('the career: the companion with careerNew, 2-3 offers refreshed with the market (' + seen.size + ' sets), hire / fire / the boat, the place follows the aeroplane, growth capped and monotone');

  // ==== THE TEXT ==================================================================
  const T = M.PILOTS_TEXT;
  for (const id of ORDER) for (const k of ['name', 'tagline', 'bio', 'pitch']) ok(!!T['pilot.' + id + '.' + k], 'text: pilot.' + id + '.' + k);
  for (const t of Object.keys(M.PILOTS_TRAITS)) ok(!!T['pilot.trait.' + t], 'text: the trait chip ' + t);
  for (const k of M.PILOTS_REFUSALS.concat(['away', 'boat'])) ok(!!T['pilot.refuse.' + k], 'text: the refusal ' + k);
  for (const k of ['hired', 'takeoff', 'goodLanding', 'badLanding', 'refuse', 'weather', 'idle', 'longDay']) ok(!!T['pilot.bark.' + k], 'text: the bark ' + k);
  for (const m of SRC.matchAll(/'(pilot\.[\w.-]+)'/g)) if (!/\.$/.test(m[1])) ok(!!T[m[1]], 'text: ' + m[1] + ' is used and missing');
  for (const id of ORDER) {
    const c = M.pilotsCard(d0, id, null);
    ok([c.name, c.tagline, c.fliesLike].concat(c.traits.map(t => t.label), c.traits.map(t => t.how)).every(x => typeof x === 'string' && !/\[pilot\.|\{\w+\}/.test(x)) && c.fliesLike.length > 10 && c.initials.length >= 1, id + ': the card resolves');
  }
  const imp = M.pilotsImportPack({ pilots: [{ id: 'kit', name: 'Kit Alder', tagline: 't', backstory: 'b', fliesLike: 'f', pitch: 'p', barks: { hired: 'h' } }, { id: 'zed', name: 'Zed' }] });
  ok(!imp.ok && imp.text['pilot.kit.name'].t === 'Kit Alder' && imp.text['pilot.kit.name'].draft === false && imp.why.some(w => /zed/.test(w)) && M.PILOTS_TEXT['pilot.kit.name'].t === 'Kit', 'the import: Block 5\'s pilots over the keys, an unknown id refused, the table handed in kept');
  ok(M.pilotsCard(d0, 'kit', null).fliesLike === M.pilotsFliesLike(M.pilotsBaseFlat('kit')), 'the card\'s "flies like" is the profile in words until the pack writes it');
  lines.push('the text: every key resolves (' + Object.keys(T).length + ' draft keys); the Block 5 import');

  // ==== THE SANDBOX ===============================================================
  const fn = (name, src) => { const i = src.indexOf('function ' + name + '('); if (i < 0) return ''; let d = 0, j = src.indexOf('{', i); for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && !--d) break; } return src.slice(i, j + 1); };
  const ccp = fn('careerCrewProfile', APP);
  ok(/^function careerCrewProfile\(\) \{\s*if \(!CAREER_DEV \|\|/.test(ccp), 'careerCrewProfile returns before anything without ?career=1');
  { const box = { CAREER_DEV: false, pilotsProfileOf: () => { throw new Error('reached'); }, console };
    vm.createContext(box); vm.runInContext(ccp + ';this.r = careerCrewProfile();', box);
    ok(box.r === undefined, 'the sandbox: careerCrewProfile() is undefined - makePilot is handed the profile it was (the expert / the persona\'s)'); }
  // the door into makePilot (inline and the worker's): before PILOT-PERSONA the flag's own ternary; with it, the persona
  // keeper's personaProfile() answering the career first (the career's pick; 'me' the expert), the sandbox the persona's
  const viaTernary = /makePilot\(sim, def, world, \{[^}]*profile: CAREER_DEV \? careerCrewProfile\(\) : undefined/.test(APP) && /pilotProfile: CAREER_DEV \? careerCrewLatched\(\) : undefined/.test(APP);
  const viaPersona = /makePilot\(sim, def, world, \{[^}]*profile: personaProfile\(\)/.test(APP) && /pilotProfile: CAREER_DEV \? careerCrewLatched\(\) : personaProfile\(\)/.test(APP)
    && /function personaProfile\(\) \{\s*if \(CAREER_DEV\) return careerCrewProfile\(\) \|\| 'expert';/.test(APP);
  ok(viaTernary || viaPersona, 'the inline pilot and the worker\'s read the career\'s door, behind the flag (' + (viaPersona ? 'through personaProfile' : 'the ternary') + ')');
  for (const call of ['careerCrewRow(host, where);', 'pilotsOnFlightEnd(d, {', 'r.pilot = crFlyer']) {
    const i = APP.lastIndexOf(call);
    ok(i > 0 && /CAREER_DEV/.test(APP.slice(APP.lastIndexOf('\n', i - 300), i)), 'the page\'s ' + call.split('(')[0] + ' is under CAREER_DEV');
  }
  ok((APP.match(/CAGE_CREW_PILOT\(/g) || []).length === 1 && /function careerCrewBody\(\) \{\s*if \(!CAREER_DEV\) return;/.test(APP), 'the crew\'s body door is called by the career only');
  ok(/window\.CAGE_CREW_PILOT = key =>/.test(CREW) && /const pilotWho = crewIdx >= 0 \? crewIdx \+ 2 : P\.pilotWho;/.test(CREW) && (CREW.match(/FLYDIY_CREW_PILOT\s*=/g) || []).length === 1,
     'the crew: the pilot seat takes the career\'s body only through CAGE_CREW_PILOT; else the spec\'s pilotWho');
  // the persona select: PILOT-PERSONA's own (when it is in the tree), untouched by this session
  const hasPersona = /id="selPersona"/.test(BODY);
  if (hasPersona) {
    ok(/const PERSONA_ORDER = \['expert', 'club', 'student', 'bush', 'hamfist'\];/.test(APP), 'the sandbox persona select: PERSONA_ORDER is PILOT-PERSONA\'s five');
    ok(/function personaProfile\(\) \{\s*if \(CAREER_DEV\) return careerCrewProfile\(\) \|\| 'expert';[^\n]*\n\s*personaLoad\(\);/.test(APP), 'the persona keeper answers the career first, behind CAREER_DEV, then the persona as before');
    ok(/if \(CAREER_DEV\) careerCrewRow\(host, where\);[^\n]*\n\s*else \{\s*\n\s*\/\/ G2085 \(PILOT-PERSONA\): WHO FLIES IT/.test(APP), 'the route row: the career\'s roster pick, else PILOT-PERSONA\'s persona row untouched');
    ok(/function flPersona\(body\) \{\s*if \(CAREER_DEV\) return;/.test(APP), 'the plate\'s persona pills: the sandbox\'s only');
  }
  lines.push('the sandbox: the career doors inert without ?career=1 (careerCrewProfile undefined; the row, the logbook, the flight\'s end, the crew body under CAREER_DEV); ' +
    (hasPersona ? 'the persona select PILOT-PERSONA\'s own' : 'no persona select in this tree yet (PILOT-PERSONA lands with train 40): makePilot\'s sandbox profile is unchanged'));

  // ==== PURITY ======================================================================
  ok(!/\b(document|window|localStorage|sessionStorage|Math\.random|Date\.now|new Date|performance\.now|THREE)\b/.test(SRC.replace(/\/\/.*$/gm, '')), '76_pilots.js touches no DOM, storage, clock, random or THREE');
  return fails;
}

// ---- the selftest: each rule doctored must turn a check red ----------------------------------------------------------------
const sub = (a, b) => s => { if (s.indexOf(a) < 0) throw new Error('selftest anchor gone: ' + a); return s.split(a).join(b); };
const MUTS = [
  ['a pack knob off by a step', sub('reaction: 0.25, smooth: 0.8', 'reaction: 0.3, smooth: 0.8')],
  ['the mechanic\'s factor', sub('mechanic:             { labourK: 0.9 }', 'mechanic:             { labourK: 1.0 }')],
  ['the bill factor', sub("'hard-on-airframes':  { billK: 1.1 }", "'hard-on-airframes':  { billK: 1.2 }")],
  ['a body swapped to the test pilot', sub("kit:  { id: 'kit', who: 'ch01'", "kit:  { id: 'kit', who: 'ch20'")],
  ['a trait the pack does not give', sub("traits: ['eager']", "traits: ['eager', 'no-water']")],
  ['the base profile', sub("profile: { base: 'hamfist'", "profile: { base: 'club'")],
  ['the ceiling', sub("grow: { rate: 'steady', ceiling: 'bush' }", "grow: { rate: 'steady', ceiling: 'expert' }")],
  ['the sign-on order', sub('remy: 1500, rafe: 4000', 'remy: 4500, rafe: 4000')],
  ['the weather boundary', sub('leg.windKt > PILOTS_WEATHER.windKt', 'leg.windKt >= PILOTS_WEATHER.windKt')],
  ['the dusk boundary', sub('leg.endHour >= CONTRACT_DUSK_H', 'leg.endHour > CONTRACT_DUSK_H')],
  ['the short strip boundary', sub('e.len < PILOTS_SHORT_M', 'e.len <= PILOTS_SHORT_M')],
  ['refuses-nothing keeps nothing', sub("if (T.some(t => t.keeps === '*')) return null;", '')],
  ['fearless keeps everything', sub("fearless:             { keeps: ['weather'] }", "fearless:             { keeps: '*' }")],
  ['floats are not water', sub("gear === 'floats' || gear === 'amphibian' || ", '')],
  ['the growth cap', sub('Math.min(1, landings / (PILOTS_GROW[R.grow.rate] || PILOTS_GROW.steady))', '(landings / (PILOTS_GROW[R.grow.rate] || PILOTS_GROW.steady))')],
  ['growth away from the expert', sub('if (!(Math.abs(cv - ev) < Math.abs(sv - ev) - 1e-9)) continue;', '')],
  ['growth counts every flight', sub('r && r.landed && ', 'r && ')],
  ['a fixed knob grows', sub('if (fixed.has(k) || !(k in s)) continue;', 'if (!(k in s)) continue;')],
  ['growth not by the logbook (a clock)', sub('return pilotsGrowth(id, pilotsLandings(rec, PILOTS_ROSTER[id])).flat;', 'return pilotsGrowth(id, (rec && rec.log ? rec.log.length : 0) + 3).flat;')],
  ['the place ignores the aeroplane', sub("if (P.plane && doc.fleet && doc.fleet[P.plane]) { const W = playerWhere(doc, P.plane); if (W.aero) return W.aero; }", '')],
  ['another flyer drags the pilot along', sub('if (id !== who && P.plane === f.slot) { P.aero = fromAero || pilotsPlace(doc, id); P.plane = null; }', '')],
  ['the boat costs', sub('P.aero = home; P.plane = null;', 'P.aero = home; P.plane = null; playerCharge(d, 100, \'boat\', id);')],
  ['the boat goes anywhere', sub("const boat = at === plHome(doc);", "const boat = true;")],
  ['firing costs', sub("c.pilots[id].hired = null; c.pilots[id].plane = null;", "c.pilots[id].hired = null; c.pilots[id].plane = null; playerCharge(d, 500, 'fire', id);")],
  ['hire with no fee', sub("if (fee) playerCharge(d, fee, 'signon', id);", '')],
  ['hire anyone', sub("if (!pilotsOffers(doc).includes(id)) return plNo(doc, pilotsName(id) + ' is not looking for work right now');", '')],
  ['hire past the wallet', sub("if (doc.mode === 'career' && (doc.wallet || 0) < fee)", 'if (false)')],
  ['a refusal that mutates', sub('if (pilotsHired(doc).includes(id)) return plNo(doc,', 'if (pilotsHired(doc).includes(id)) return plNo((doc.wallet -= 1, doc),')],
  ['the market shows everyone', sub('const n = Math.min(pool.length, PILOTS_MARKET.min + Math.floor(rng() * (PILOTS_MARKET.max - PILOTS_MARKET.min + 1)));', 'const n = pool.length;')],
  ['the market never refreshes', sub("String(c.seed) + ':pilots:' + epoch", "String(c.seed) + ':pilots:'")],
  ['no companion', sub('c.roster = [PILOTS_COMPANION];', 'c.roster = [];')],
  ['the companion charged', sub('function pilotsSignOn(id) {\n  if (PILOTS_ROSTER[id] && PILOTS_ROSTER[id].companion) return 0;', 'function pilotsSignOn(id) {')],
  ['the price book ignored', sub("if (typeof econPrice === 'function')", 'if (false)')],
  ['the clamp bypassed', sub("if (typeof pilotProfileSpec === 'function') return Object.assign({ name: o.name, active: true }, pilotProfileSpec(pilotProfile(o)));", '')],
  ['a text key dropped', sub("  'pilot.refuse.snow': PLT_('{name} won\\'t land on snow.'),\n", '')],
  ['a clock read', sub('const plClone = o => JSON.parse(JSON.stringify(o));', 'const plClone = o => (Date.now(), JSON.parse(JSON.stringify(o)));')],
];

const f0 = run(null);
for (const l of lines) console.log('  ' + l);
console.log(checks + ' checks');
if (f0.length) { for (const f of f0.slice(0, 40)) console.log('FAIL: ' + f); if (f0.length > 40) console.log('... ' + (f0.length - 40) + ' more'); }
console.log('GATE PILOTS: ' + (f0.length ? 'FAIL' : 'PASS'));
if (SELF) {
  let bad = 0;
  for (const [what, m] of MUTS) {
    let r;
    try { r = run(m); } catch (e) { r = ['threw: ' + e.message]; if (/anchor gone/.test(e.message)) { bad++; console.log('  selftest: ' + what + ' - ' + e.message); continue; } }
    const caught = r.length > 0;
    if (!caught) bad++;
    console.log('  selftest: ' + what + ' -> ' + (caught ? 'caught (' + r.length + ': ' + r[0] + ')' : 'NOT CAUGHT'));
  }
  console.log('GATE PILOTS selftest: ' + (bad ? 'FAIL (' + bad + ' not caught)' : 'PASS (' + MUTS.length + ' of ' + MUTS.length + ')'));
  if (bad) process.exitCode = 1;
}
if (f0.length) process.exitCode = 1;
