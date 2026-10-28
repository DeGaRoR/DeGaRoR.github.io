#!/usr/bin/env node
// ============================================================================
// GATE PILOTCANFLY - G3760 (HIRE, Game's seam): pilotCanFly(profile, def,
// strip, wind, opts) -> { ok, why, kind, len, need }, the pilot's own laws
// asked before the flight (the hire card, routeSign).
// ============================================================================
// What is held, in blocks:
//   THE SAME JUDGE   the expert's 'land' refusal IS the flying pilot's: every
//                    validated land build x every land strip under 700 m,
//                    pilotCanFly('expert') refuses exactly where makePilot's
//                    departFrom says 'strip-too-short' and stops ('declined')
//   THE GEAR         floats refused on every land strip, wheels on every
//                    water lane ('gear', stripAllows' words); a water lane has
//                    no run law for floats
//   THE ROW          a CONTRACT_FIELDS row (len, surf, alti) answers as the
//                    world's aerodrome record does, for every field both know
//   THE TECHNIQUE    a profile without technique.field 'normal' answers as the
//                    expert; one with it refuses at least what the expert does,
//                    'technique' only where its normal landing (the aim, 3 s of
//                    float, the stop) is longer than the strip; every shape of
//                    a profile (a name, 76_pilots' object, a resolved one) the
//                    same answer
//   THE WIND         a two-way strip ignores the wind; a one-way strip
//                    (landHdg) grows its need with the wind behind the landing,
//                    never with a headwind
//   THE BOUNDARY     a doctored sheet: LDGrun = len refuses nothing, len + 1
//                    refuses 'land'
//   THE WORDS        a refusal's why names the person, the aeroplane and the
//                    strip, one line (<= 160 chars); an ok's why is ''
//   PURE             the same answer twice; the strip and the profile are not
//                    written to
// Then THE TABLE (information, not judged): every roster pilot x build x the
// short strips - what each would refuse, the hire card's "can fly".
//   node tools/_canfly_check.js             -> "GATE PILOTCANFLY: PASS|FAIL"
'use strict';
const fs = require('fs'), path = require('path');
const C = require('./flight_core.js'), TR = require('./_tour_lib.js'), IN = require('./island_node.js');
const PT = require('./pilot_trace.js');
const ROOT = path.join(__dirname, '..');
const fails = [], say = s => console.log(s), fail = s => { fails.push(s); say('  FAIL ' + s); };
if (typeof C.pilotCanFly !== 'function') { say('GATE PILOTCANFLY: FAIL (no pilotCanFly in the core)'); process.exit(1); }
const W = TR.tourWorld(C, IN, fs).W, A = id => W.aerodromes.find(a => a.id === id);
const t0 = Date.now();
const BUILDS = [
  ['cub', path.join(ROOT, 'builds', 'cub_2026-09-20_corrected.json')],
  ['jodel', path.join(ROOT, 'builds', 'jodel_2026-09-20_corrected.json')],
  ['c172', path.join(__dirname, 'fixtures', 'build_v10_cessnaMetal_2026-09-26.json')],
  ['c172w', path.join(ROOT, 'builds', 'cessna172_2026-09-20_corrected.json')],
];
const FLOATS = [['floats', path.join(ROOT, 'bugReports', 'cessnaFloatsWOrks.json')], ['pa18f', path.join(ROOT, 'builds', 'pa18_floats_2026-10-23.json')]];
const defs = {};
for (const [k, f] of BUILDS.concat(FLOATS)) { if (fs.existsSync(f)) defs[k] = C.buildGen ? TR.defOf(C, PT, f) : null; else fail('no build ' + f); }
const land = W.aerodromes.filter(a => a.len > 0 && a.surface !== 4 && !a.water && a.kind !== 'water' && a.kind !== 'meadow');
const wet = W.aerodromes.filter(a => a.surface === 4 || a.water || a.kind === 'water');
const shortL = land.filter(a => a.len < 700);
const CF = (id, pr, a, w, o) => C.pilotCanFly(pr, defs[id], a, w || null, o);

// THE SAME JUDGE
say('THE SAME JUDGE (the expert vs makePilot departFrom, ' + BUILDS.length + ' builds x ' + shortL.length + ' strips)');
let nJ = 0;
for (const [k] of BUILDS) {
  if (!defs[k]) continue;
  for (const a of shortL) {
    const r = CF(k, 'expert', a);
    const H = TR.gameHost(C, W, defs[k], A('HOME'), A('HOME'), { day: null, shake: false });
    H.ap.departFrom(A('HOME'), a);
    const declined = H.ap.phase === 'STOPPED' && (H.ap.report.outcome === 'declined');
    nJ++;
    if (declined !== (r.kind === 'land')) fail('same judge: ' + k + ' -> ' + a.id + ' (' + a.len + ' m): departFrom ' + (declined ? 'declined' : H.ap.phase) + ', pilotCanFly ' + (r.kind || 'ok') + ' (need ' + r.need + ')');
  }
}
say('  ' + nJ + ' pairs');

// THE GEAR
say('THE GEAR');
for (const [k] of FLOATS) {
  if (!defs[k]) continue;
  for (const a of land) { const r = CF(k, 'expert', a); if (r.ok || r.kind !== 'gear') fail('gear: ' + k + ' into ' + a.id + ' -> ' + (r.kind || 'ok')); }
  for (const a of wet) { const r = CF(k, 'expert', a); if (!r.ok) fail('gear: ' + k + ' on the water ' + a.id + ' refused (' + r.why + ')'); }
}
for (const [k] of BUILDS) { if (!defs[k]) continue; for (const a of wet) { const r = CF(k, 'expert', a); if (r.ok || r.kind !== 'gear') fail('gear: wheels ' + k + ' onto ' + a.id + ' -> ' + (r.kind || 'ok')); } }

// THE ROW
say('THE ROW (CONTRACT_FIELDS vs the aerodrome record)');
let nR = 0;
for (const a of W.aerodromes) {
  const row = C.CONTRACT_FIELDS && C.CONTRACT_FIELDS[a.id];
  if (!row || a.kind === 'meadow') continue;
  for (const [k] of BUILDS.concat(FLOATS)) {
    if (!defs[k]) continue;
    for (const pr of ['expert', 'student']) {
      const r1 = CF(k, pr, a), r2 = CF(k, pr, Object.assign({}, row, { len: a.len }));
      nR++;
      if (r1.ok !== r2.ok || r1.kind !== r2.kind || r1.need !== r2.need) fail('row: ' + k + ' ' + pr + ' ' + a.id + ': record ' + (r1.kind || 'ok') + '/' + r1.need + ', row ' + (r2.kind || 'ok') + '/' + r2.need);
    }
  }
}
say('  ' + nR + ' answers');

// THE TECHNIQUE
say('THE TECHNIQUE (every PILOT_PROFILES person + the roster as signed on)');
const persons = Object.keys(C.PILOT_PROFILES).map(n => [n, n]);
for (const id of Object.keys(C.PILOTS_ROSTER || {})) persons.push(['roster:' + id, C.pilotsBaseFlat(id)]);
for (const [pn, pr] of persons) {
  const P = C.pilotProfile(typeof pr === 'string' ? pr : C.pilotsProfile(pr, pn));
  const normal = P.active && P.field === 'normal';
  for (const [k] of BUILDS) {
    if (!defs[k]) continue;
    for (const a of land) {
      const e = CF(k, 'expert', a), r = CF(k, pr, a);
      if (!normal && (r.ok !== e.ok || r.kind !== e.kind || r.need !== e.need)) fail('technique: ' + pn + ' ' + k + ' ' + a.id + ' differs from the expert (' + (r.kind || 'ok') + ' vs ' + (e.kind || 'ok') + ')');
      if (normal) {
        if (!e.ok && r.ok) fail('technique: ' + pn + ' flies ' + k + ' into ' + a.id + ' that the expert refuses');
        if (r.kind === 'technique' && !(r.need > a.len)) fail('technique: ' + pn + ' ' + k + ' ' + a.id + ' refused with need ' + r.need + ' <= ' + a.len);
        if (r.ok && r.need != null && e.need != null && r.need < e.need) fail('technique: ' + pn + ' ' + k + ' ' + a.id + ' needs less than the expert');
      }
      // the shapes: a resolved profile and 76_pilots' object answer the same
      if (typeof pr !== 'string') {
        const r2 = CF(k, C.pilotsProfile(pr, pn), a);
        if (r2.ok !== r.ok || r2.kind !== r.kind || r2.need !== r.need) fail('shapes: ' + pn + ' ' + k + ' ' + a.id + ' resolved vs object');
      }
    }
  }
}

// THE WIND
say('THE WIND');
const one = W.aerodromes.find(a => a.altiport && typeof a.landHdg === 'number');
if (!one) fail('wind: no one-way strip (altiport with landHdg) in the world');
for (const [k] of BUILDS) {
  if (!defs[k]) continue;
  for (const a of shortL.filter(a => !a.altiport)) {
    const c = CF(k, 'expert', a), w = CF(k, 'expert', a, [6, -4]);
    if (c.ok !== w.ok || c.need !== w.need) fail('wind: two-way ' + a.id + ' ' + k + ' moved by the wind');
  }
  if (one) {
    const ux = Math.cos(one.landHdg), uz = Math.sin(one.landHdg);
    const c = CF(k, 'expert', one), h = CF(k, 'expert', one, [-5 * ux, -5 * uz]);
    if (h.need !== c.need) fail('wind: a headwind credited at ' + one.id + ' ' + k + ' (' + h.need + ' vs ' + c.need + ')');
    let last = c.need;
    for (const v of [2, 4, 8]) {
      const t = CF(k, 'expert', one, { x: v * ux, z: v * uz });
      if (t.need != null && last != null && !(t.need > last)) fail('wind: ' + v + ' m/s behind at ' + one.id + ' ' + k + ' does not grow the need (' + t.need + ' after ' + last + ')');
      if (t.ok === false && t.why.indexOf('behind') < 0) fail('wind: the refusal does not say the wind behind');
      last = t.need;
    }
  }
}

// THE BOUNDARY
say('THE BOUNDARY');
{
  const S = C.machineSheet(defs.cub), a = { id: 'x', name: 'test strip', len: Math.round(S.LDGrun), surface: 0 };
  const at = C.pilotCanFly('expert', defs.cub, a, null, { sheet: S }), over = C.pilotCanFly('expert', defs.cub, Object.assign({}, a, { len: a.len - 1 }), null, { sheet: S });
  if (!(S.LDGrun <= a.len ? at.ok : !at.ok)) fail('boundary: LDGrun ' + S.LDGrun.toFixed(1) + ' at a ' + a.len + ' m strip -> ' + (at.kind || 'ok'));
  if (over.ok || over.kind !== 'land') fail('boundary: a strip 1 m short -> ' + (over.kind || 'ok'));
  const doc = C.pilotCanFly('expert', defs.cub, { id: 'y', len: 100, surface: 0 }, null, { sheet: Object.assign({}, S, { LDGrun: 101, Vs0: null }) });
  if (doc.ok || doc.kind !== 'land') fail('boundary: a doctored 101 m run into 100 m -> ' + (doc.kind || 'ok'));
  const no = C.pilotCanFly('expert', defs.cub, { id: 'z', len: 100, surface: 0 }, null, { sheet: {} });
  if (!no.ok) fail('boundary: no sheet refused (the AP goes)');
}

// THE WORDS + PURE
say('THE WORDS + PURE');
for (const [k] of BUILDS.concat(FLOATS)) {
  if (!defs[k]) continue;
  for (const a of W.aerodromes.filter(a => a.kind !== 'meadow')) {
    const before = JSON.stringify(a), o = { who: 'Remy', plane: 'Cub' };
    const r = CF(k, 'student', a, null, o), r2 = CF(k, 'student', a, null, o);
    if (JSON.stringify(r) !== JSON.stringify(r2)) fail('pure: two answers for ' + k + ' ' + a.id);
    if (JSON.stringify(a) !== before) fail('pure: the strip ' + a.id + ' was written to');
    if (r.ok && r.why !== '') fail('words: an ok with a why');
    if (!r.ok && !(r.why.startsWith('Remy won\'t take the Cub into ') && r.why.indexOf(a.name || a.id) > 0 && r.why.length <= 160 && r.why.indexOf('\n') < 0)) fail('words: ' + JSON.stringify(r.why));
  }
}

// THE TABLE
say('THE TABLE (what each would refuse, strips under 700 m; - = flies it)');
const cols = shortL.map(a => a.id);
say('  ' + 'pilot / build'.padEnd(24) + cols.map(c => c.padStart(10)).join(''));
for (const [pn, pr] of persons.filter(p => p[0] === 'expert' || p[0].startsWith('roster:') || p[0] === 'student')) {
  for (const [k] of BUILDS) {
    if (!defs[k]) continue;
    say('  ' + (pn + ' / ' + k).padEnd(24) + shortL.map(a => { const r = CF(k, pr, a); return (r.ok ? '-' : r.kind + ' ' + r.need).padStart(10); }).join(''));
  }
}
say('  (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
say('GATE PILOTCANFLY: ' + (fails.length ? 'FAIL' : 'PASS'));
if (fails.length) process.exitCode = 1;
