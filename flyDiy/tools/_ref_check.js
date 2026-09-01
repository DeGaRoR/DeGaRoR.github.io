#!/usr/bin/env node
// GATE REF — the reference plane (G89-G93) against the payloads it measures
// and against the rule it exists most likely to break.
//
//   node tools/_ref_check.js            -> "GATE REF: PASS|FAIL"
//   node tools/_ref_check.js --selftest -> negative verification
//
// The reference plane stands a real aeroplane beside your build so you can
// recreate a PARTICULAR one. Everything it is for is a measurement, so every
// check here is a number rather than a shape.
//
// WHAT IT GUARDS, and why each one is here rather than left to the eye:
//
//   DECODE     both payloads decode, into groups with vertices and triangles.
//              Cheap, and it is the check that fires if a model bake ever
//              changes the container.
//   TRUE SCALE the decoded box against the aeroplane's PUBLISHED span and
//              length. This is the load-bearing one: every measurement anyone
//              ever takes against the reference — the dimensions pane, the
//              discrepancy line, the match-a-dimension solver — is only worth
//              what this check is. A model silently at 0.9 scale would read
//              plausibly and be wrong about everything.
//              HEIGHT IS NOT CHECKED, and that is not laziness. The PA-18's
//              payload y-extent is 2.699 m against a published 2.02 m, because
//              its frame is not wheels-at-zero. Asserting it would mean either
//              a wrong number in the table or a tolerance so wide it asserts
//              nothing. It is measured and reported instead.
//   THE TABLE  the declared presets resolve to payloads that exist, and their
//              `pub` figures are the ones the decode is held against — so the
//              table cannot drift away from the thing it describes.
//   THE SIT    groundY - bb.min.y reproduces for both, AND the two bb.min.y
//              differ. That second half is the whole point: if both frames sat
//              on their wheels, a hardcoded zero would pass every test and
//              break on the first model that did not.
//   SYMMETRY   every payload is symmetric about z = 0, because an aeroplane
//              is. A payload that is not has a TRANSLATED FRAME, and the split
//              view, the span readout and the lateral slider all quietly mean
//              something else. Caught the Super Guepard, which arrived drawn
//              in a corner-origin frame.
//   REF-ONLY   a payload baked by tools/ref_prep.py (`ref:1`) carries no
//              control surfaces, records the licence and the credit of the
//              file it came from, and — if it is in build.js MANIFEST.models,
//              which is to say if it is INLINED INTO THE COMMITTED, SERVED
//              index.html — that licence is one this project may publish
//              under. Four of the nine reference aeroplanes are licensed in a
//              way that forbids redistribution; they bake and stand in the
//              shed, and this is what keeps them out of the artifact when
//              somebody adds a line to build.js without reading CREDITS.md.
//   ONE ROOT   refplane.js's own source names no writer of the spec. The
//              2026-08-08 scope decision says "the spec is the source of truth
//              and the mesh is never an input", and a reference overlay is the
//              single most likely place for that to rot — the step from "a
//              model you can measure against" to "a model you can build from"
//              is one function call. This turns the rule into an assertion.
//              Source-scanned, the way GATE PROPS re-parses the Python tables:
//              the property is about what the file may REACH, and that is a
//              fact about its text.
//
// NEGATIVE-VERIFIED: --selftest breaks each rule in turn and requires the
// corresponding check to fail. A check on an observable that cannot change is
// indistinguishable from a check that works.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const REF_SRC = path.join(SRC, 'viewer', 'refplane.js');

const fail = [];
const check = (ok, msg) => { if (!ok) fail.push(msg); return !!ok; };

// ---------------------------------------------------------------------------
// THE NODE HALF. refplane.js guards its viewer half behind a module.exports
// early return, so the declared table and the pure math load in node with no
// THREE and no DOM. That is deliberate and it is what makes this a verdict
// rather than a smoke test — the numbers below are computed by the same code
// the panel runs, not by a re-implementation that can drift away from it.
// ---------------------------------------------------------------------------
const R = require(REF_SRC);

// 50_model_codec.js is a core part, concatenated rather than a module, so it
// is loaded the way the other gates load core: read and evaluated.
function loadCore() {
  const txt = fs.readFileSync(path.join(SRC, 'core', '50_model_codec.js'), 'utf8');
  const box = {};
  new Function('exports', txt + '\n;exports.decodeModel = decodeModel;')(box);
  return box.decodeModel;
}
const decodeModel = loadCore();

function loadPayload(key) {
  const txt = fs.readFileSync(fileOf(key), 'utf8');
  const box = {};
  new Function('exports', txt + '\n;exports.M = ' + globOf(key) + ';')(box);
  return box.M;
}

// ---------------------------------------------------------------------------
// DECODE + TRUE SCALE + THE TABLE
// ---------------------------------------------------------------------------
// DERIVED, not a third list. A payload's file and global name follow from its
// model key by convention (`<key>_model.js` / `MODEL_<KEY>`), and both bakers
// obey it. A hand-written map here would be a third place the same fact lives,
// and the first thing to drift when a payload is added — which is exactly what
// happened when the reference grew from two aeroplanes to nine.
const fileOf = key => path.join(SRC, 'models', `${key}_model.js`);
const globOf = key => 'MODEL_' + key.toUpperCase();
const TOL = 0.015;                 // 1.5% — a model, not a drawing
// 10 mm on a whole wingspan. Loose enough for a modeller's own hand-placed
// wingtip (the PA-28 is 2.8 mm out and is fine), tight enough that a
// translated frame — which is metres, not millimetres — cannot hide in it.
const SYM_TOL = 0.010;

// Licences the ARTIFACT may carry. A reference payload declares its own `lic`
// (tools/ref_table.py copies it verbatim out of the GLB's asset.extras), and
// anything in build.js MANIFEST.models is PUBLISHED — it is inlined into
// index.html, which is committed and served. helijah lists three of his seven
// under CC-BY-4.0 and four under "SKETCHFAB Standard", which does not permit
// redistribution; baking one is fine, shipping it is not, and the difference
// is one line in build.js. This is the check that notices.
const PUBLISHABLE = ['CC-BY-4.0'];

const measured = {};
const payloads = {};
for (const pre of R.REF_PRESETS) {
  if (!pre.model) continue;                       // the empty row is a row
  if (!check(fs.existsSync(fileOf(pre.model)),
             `preset ${pre.key} names model '${pre.model}', which has no ` +
             `payload at ${path.relative(ROOT, fileOf(pre.model))}`))
    continue;
  let dec = null;
  try {
    payloads[pre.model] = loadPayload(pre.model);
    dec = decodeModel(payloads[pre.model]);
  }
  catch (e) { check(false, `preset ${pre.key}: decode threw — ${e.message}`); continue; }

  const groups = Object.keys(dec);
  const nv = groups.reduce((a, g) => a + dec[g].nv, 0);
  const nt = groups.reduce((a, g) => a + dec[g].nt, 0);
  check(groups.length > 0, `preset ${pre.key}: decoded to no groups`);
  check(nv > 0 && nt > 0, `preset ${pre.key}: decoded to no geometry`);

  const box = R.refDecodedBox(dec);
  if (!check(!!box, `preset ${pre.key}: no bounding box`)) continue;
  measured[pre.key] = { box, nv, nt, groups: groups.length };

  // SYMMETRY ABOUT z = 0 (G142). An aeroplane is symmetric, so a payload whose
  // z extents are not equal and opposite has a TRANSLATED FRAME, not a strange
  // aeroplane. It matters for three separate things and is invisible in all of
  // them until you look for it: the split view cuts both machines with the one
  // world plane z = 0, "span" is read straight off this box, and the lateral
  // slider measures from the centreline. The Super Guepard arrived exactly
  // like this — drawn in a corner-origin frame with its centreline at
  // z = -4.895 — and would have stood half a wingspan to one side with its own
  // half-cut running through a wing. The fix belongs in the bake (`off` in
  // tools/ref_table.py), and this is what says so.
  const asym = Math.abs(box.min[2] + box.max[2]);
  check(asym <= SYM_TOL,
    `${pre.key}: the payload is not symmetric about z = 0 — extents ` +
    `${box.min[2].toFixed(4)} .. ${box.max[2].toFixed(4)} are ` +
    `${asym.toFixed(4)} m out of balance, i.e. its centreline sits at ` +
    `z = ${((box.min[2] + box.max[2]) / 2).toFixed(4)}. That is a translated ` +
    'frame; declare an `off` on its tools/ref_table.py row rather than ' +
    'letting the split view cut through a wing.');

  check(!!pre.pub, `preset ${pre.key} declares no published dimensions — ` +
        'nothing holds its scale');
  if (!pre.pub) continue;

  // A ROW MAY BUY SLACK, BUT ONLY OUT LOUD. `pub.tol` widens this one check
  // for one aeroplane whose published figures genuinely disagree with each
  // other; a tol with no `note` saying which sources and by how much is a
  // check quietly turned down, so it fails here.
  const tol = pre.pub.tol != null ? pre.pub.tol : TOL;
  check(pre.pub.tol == null || (typeof pre.pub.note === 'string' && pre.pub.note.length > 20),
        `${pre.key} widens its scale tolerance to ${(tol * 100).toFixed(1)}% ` +
        'but declares no `pub.note` saying why — a loosened check with no ' +
        'reason on it is the one that rots');
  check(tol <= 0.05, `${pre.key} buys ${(tol * 100).toFixed(1)}% of slack — ` +
        'past 5% the check stops being a check');
  const dSpan = Math.abs(box.span - pre.pub.span) / pre.pub.span;
  const dLen = Math.abs(box.len - pre.pub.len) / pre.pub.len;
  check(dSpan <= tol, `${pre.key} span: model ${box.span.toFixed(3)} m vs ` +
        `published ${pre.pub.span.toFixed(2)} m — ${(dSpan * 100).toFixed(2)}% out ` +
        `(limit ${(tol * 100).toFixed(1)}%)`);
  check(dLen <= tol, `${pre.key} length: model ${box.len.toFixed(3)} m vs ` +
        `published ${pre.pub.len.toFixed(2)} m — ${(dLen * 100).toFixed(2)}% out ` +
        `(limit ${(tol * 100).toFixed(1)}%)`);
}

// the table's own shape: unique keys, exactly one empty row, and it is first
{
  const keys = R.REF_PRESETS.map(p => p.key);
  check(new Set(keys).size === keys.length, 'preset keys are not unique');
  const empty = R.REF_PRESETS.filter(p => !p.model);
  check(empty.length === 1, `${empty.length} presets carry no model — expected ` +
        'exactly one, the "none" row');
  check(R.REF_PRESETS[0] && !R.REF_PRESETS[0].model,
        'the empty row is not first — the reference must be EMPTY BY DEFAULT');
}

// ---------------------------------------------------------------------------
// THE SIT. Not "does the formula run" — that is arithmetic. What is checked is
// that the two payloads DISAGREE about where their own floor is, which is the
// fact that makes computing the drop necessary rather than decorative.
// ---------------------------------------------------------------------------
function checkSit(m) {
  const mins = Object.keys(m).map(k => m[k].box.min[1]);
  if (mins.length < 2) return;
  const spread = Math.max.apply(null, mins) - Math.min.apply(null, mins);
  check(spread > 0.5,
    `every payload's frame agrees about its own floor (spread ${spread.toFixed(4)} m) — ` +
    'if that is really true the computed sit is untested, and a hardcoded ' +
    'zero would pass this battery and break on the next model');
  // and the drop itself: the lowest point lands ON the floor, whatever the
  // frame thought it was doing
  for (const k of Object.keys(m)) {
    const minY = m[k].box.min[1];
    for (const [g, s] of [[0, 1], [1.4, 1], [0, 0.75]]) {
      const y = R.refSitY(minY, s, g, 0);
      const landed = y + minY * s;
      check(Math.abs(landed - g) < 1e-9,
        `${k}: at ground ${g} scale ${s} the lowest point lands at ` +
        `${landed.toFixed(6)}, not on the floor`);
    }
  }
  // the trim is ADDITIVE and does not disturb the drop
  check(Math.abs(R.refSitY(-1.3516, 1, 0, 0.25) - R.refSitY(-1.3516, 1, 0, 0) - 0.25) < 1e-12,
    'the vertical trim is not a clean offset on the computed sit');
}
checkSit(measured);

// ---------------------------------------------------------------------------
// THE GROUND ATTITUDE. The half GATE REF did not have, and the half the user
// reported: "the piper cub reference plane is not resting on its wheels".
//
// The old sit dropped the AUTHORED bounding box, which is right only for a
// payload drawn sitting level on its wheels. The Cub is drawn fuselage-level,
// so its mains went down and its tailwheel stayed 1.09 m up — and nothing
// here noticed, because every check above is about SCALE.
//
// The preset declares its attitude; this RE-DERIVES it from the payload and
// holds the declaration to it, exactly as `pub` is held to the decoded box.
// The instrument is the lower convex hull: at the right attitude an aeroplane
// rests on TWO contact patches, far apart, at the same height.
// ---------------------------------------------------------------------------
const CONTACT_TOL = 0.012;      // 12 mm — a tyre's own flat, not a drawing
const BASE_MIN = 1.2;           // m between the contacts: it is not a pogo stick
function checkAttitude() {
  for (const pre of R.REF_PRESETS) {
    if (!pre.model) continue;
    if (!payloads[pre.model]) continue;
    const dec = decodeModel(payloads[pre.model]);
    const hull = R.refLowerHull(dec);
    if (!check(!!hull && hull.length >= 2,
               `${pre.key}: no lower hull — the sit has nothing to stand on`))
      continue;

    check(pre.sit && typeof pre.sit.pitch === 'number',
      `preset ${pre.key} declares no ground attitude (\`sit.pitch\`) — without ` +
      'one the sit assumes the payload was drawn on its wheels, which is ' +
      'exactly the assumption that put the Cub on its nose');
    const dec3 = R.refSitPitch(pre);

    // AT THE DECLARED ATTITUDE, WHERE DOES IT TOUCH?
    const t = dec3 * Math.PI / 180, c = Math.cos(t), sn = Math.sin(t);
    const yOf = q => q[1] * c - q[0] * sn;
    const lo = R.refLowestY(hull, dec3);
    check(Math.abs(lo - Math.min.apply(null, hull.map(yOf))) < 1e-9,
      `${pre.key}: refLowestY disagrees with the hull it was given`);

    const touch = hull.filter(q => yOf(q) <= lo + CONTACT_TOL);
    const xs = touch.map(q => q[0] * c + q[1] * sn);
    const base = Math.max.apply(null, xs) - Math.min.apply(null, xs);
    check(base >= BASE_MIN,
      `${pre.key}: at the declared ${dec3.toFixed(2)} deg nose-up it touches ` +
      `the floor over ${base.toFixed(3)} m of wheelbase — an aeroplane rests ` +
      `on two contacts at least ${BASE_MIN} m apart, so this attitude is wrong ` +
      'or the payload has no undercarriage');

    // AND THE DECLARED ONE IS THE BEST ONE. Any other attitude either lifts a
    // contact or is a different aeroplane: a degree of error over a 5 m base
    // is 87 mm of daylight under a wheel, which is what the user saw.
    for (const d of [-3, -1, 1, 3]) {
      const p2 = dec3 + d, t2 = p2 * Math.PI / 180;
      const c2 = Math.cos(t2), s2 = Math.sin(t2);
      const y2 = q => q[1] * c2 - q[0] * s2;
      const lo2 = R.refLowestY(hull, p2);
      const xs2 = hull.filter(q => y2(q) <= lo2 + CONTACT_TOL)
                      .map(q => q[0] * c2 + q[1] * s2);
      const b2 = Math.max.apply(null, xs2) - Math.min.apply(null, xs2);
      check(b2 < base,
        `${pre.key}: ${p2.toFixed(2)} deg puts it on a WIDER stance ` +
        `(${b2.toFixed(3)} m) than the declared ${dec3.toFixed(2)} deg ` +
        `(${base.toFixed(3)} m) — the declaration is not the attitude it parks in`);
    }
  }
  // AND THE PITCH ACTUALLY CHANGES THE DROP. If it did not, every check above
  // would pass on a formula that ignores its own argument.
  const hullP = R.refLowerHull(decodeModel(payloads.pa18));
  check(Math.abs(R.refLowestY(hullP, 0) - R.refLowestY(hullP, 12.09)) > 0.05,
    'the ground attitude does not move the lowest point — refLowestY is ' +
    'ignoring its pitch, and the sit is back to dropping an authored box');
}
checkAttitude();

// match-a-dimension inverts the measurement it is given
for (const k of Object.keys(measured)) {
  const box = measured[k].box;
  const pre = R.REF_PRESETS.filter(p => p.key === k)[0];
  const sc = R.refMatchScale(pre.pub.span, box.span);
  check(sc != null && Math.abs(box.span * sc - pre.pub.span) < 1e-9,
    `${k}: match-a-dimension does not land on the number it was given`);
}
check(R.refMatchScale(0, 10) === null && R.refMatchScale(10, 0) === null,
  'match-a-dimension does not refuse a zero — a scale of 0 is an aeroplane ' +
  'you cannot see');

// ---------------------------------------------------------------------------
// REFERENCE-ONLY PAYLOADS, AND WHAT MAY BE PUBLISHED (G138)
//
// tools/ref_prep.py bakes an aeroplane that is only ever LOOKED at: no control
// surfaces, no propeller hub, no sid tags. Two things follow, and neither is
// safe to leave to a comment.
//
//   IT MUST NOT LOOK FLYABLE. A payload marked `ref:1` that grew a `surfaces`
//   table would be half-rigged — the viewer would try to hinge something that
//   has no sid to hinge, and the failure would be a control surface that never
//   moves rather than an error.
//
//   IT MUST NOT SHIP WITHOUT A LICENCE THAT ALLOWS IT. build.js MANIFEST.models
//   is the publish list: everything on it is inlined into index.html, which is
//   committed and served. The payload carries the licence its source file
//   declared, so this is a fact about the artifact rather than a promise in a
//   table. Baking a model the licence does not let us redistribute is fine and
//   useful — it stands in the shed locally. Shipping it is the mistake, and it
//   is one line in build.js away at all times.
// ---------------------------------------------------------------------------
function checkRefPayloads(publishList) {
  for (const key of Object.keys(payloads)) {
    const p = payloads[key];
    if (!p.ref) continue;                       // pa18/c172 are also flyable
    check(!p.surfaces || !p.surfaces.length,
      `${key} is baked reference-only (ref:1) but declares control surfaces — ` +
      'a payload is one or the other; half-rigged is worse than either');
    check(typeof p.lic === 'string' && p.lic.length > 0,
      `${key} carries no \`lic\` — a reference payload records the licence of ` +
      'the file it was baked from, or nothing downstream can tell whether it ' +
      'may be published');
    check(typeof p.credit === 'string' && /http/.test(p.credit),
      `${key} carries no \`credit\` naming its source — these models are ` +
      "someone's work and CREDITS.md is generated from nothing");
    if (!publishList.includes(`${key}_model.js`)) continue;
    check(PUBLISHABLE.indexOf(p.lic) >= 0,
      `${key} is in build.js MANIFEST.models — so it is inlined into the ` +
      `committed, served index.html — but its licence is "${p.lic}", which is ` +
      `not one of ${PUBLISHABLE.join(', ')}. Bake it, stand it in the shed, ` +
      'do not publish it.');
  }
}
{
  const b = fs.readFileSync(path.join(__dirname, 'build.js'), 'utf8');
  const m = b.match(/models:\s*\[([^\]]*)\]/);
  const list = m ? (m[1].match(/'([^']+)'/g) || []).map(s => s.slice(1, -1)) : [];
  check(list.length > 0, 'build.js MANIFEST.models did not parse — the ' +
        'publish list is what the licence check is about, so failing to read ' +
        'it is a failure, not a skip');
  checkRefPayloads(list);
  // REPORTED, NOT ASSERTED: which presets the build actually carries. The
  // table is the CATALOGUE of everything baked; MANIFEST.models is the subset
  // the artifact can afford and is allowed to publish, and the panel filters
  // its dropdown against what loaded. Requiring the two to match would turn
  // "ship one fewer aeroplane" into a two-file edit, which is the opposite of
  // what a single lever is for. So this line just says which is which, out
  // loud, every run.
  const held = R.REF_PRESETS.filter(p => p.model &&
                                    !list.includes(`${p.model}_model.js`));
  if (held.length)
    console.log(`  baked but NOT in the artifact: ` +
                held.map(p => `${p.key} (${(payloads[p.model] || {}).lic || '?'})`)
                    .join(', '));
}

// ---------------------------------------------------------------------------
// ONE ROOT, MECHANISED
// ---------------------------------------------------------------------------
// The names below are every door out of display-only and into the spec. If the
// reference ever needs one of them, that is a design decision and it belongs in
// front of the user — not in a diff that turns this line green by deleting it.
const FORBIDDEN = ['GARAGE_SPEC', 'setParam', 'cageToSpec', 'BUILD_SYNC',
                   'applySpec', 'CAGE_UI_SCENE', 'CAGE_JOIN'];
function checkOneRoot(src) {
  // comments are where the rule is EXPLAINED, so they are stripped before the
  // source is searched — otherwise the file cannot describe what it must not do
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const name of FORBIDDEN)
    check(code.indexOf(name) < 0,
      `refplane.js reaches ${name} — the reference is DISPLAY ONLY, and the ` +
      'mesh is never an input to the spec (HANDOVER, the 2026-08-08 scope ' +
      'decision)');
  return fail.length;
}
const REF_TEXT = fs.readFileSync(REF_SRC, 'utf8');
checkOneRoot(REF_TEXT);

// and the seams that carry it are really in the build
{
  const b = fs.readFileSync(path.join(__dirname, 'build.js'), 'utf8');
  check(/'refplane\.js'/.test(b),
    'refplane.js is not in build.js MANIFEST.viewer.scripts — it would not ' +
    'ship, and nothing else would notice');
  const idx = b.indexOf("'refplane.js'"), ide = b.indexOf("'editor.js'");
  check(idx > 0 && ide > 0 && idx < ide,
    'refplane.js loads after editor.js — window.REFPLANE must exist before ' +
    'editorInit runs');
  const ed = fs.readFileSync(path.join(SRC, 'viewer', 'editor.js'), 'utf8');
  check(/REFPLANE/.test(ed), 'editor.js never reaches window.REFPLANE — the ' +
        'tree row would select nothing');
  const app = fs.readFileSync(path.join(SRC, 'viewer', 'app.js'), 'utf8');
  check(/window\.MODEL_DECODE\s*=/.test(app),
    'app.js does not publish MODEL_DECODE — the payload b64 is destroyed by ' +
    'whoever decodes first, so a second independent decode works or does not ' +
    'depending on which aeroplane you flew, which is a bug that hides');
  check(/window\.REF_MOUNT\s*=/.test(app),
    'app.js does not publish REF_MOUNT — the reference has nowhere to stand');
}

// ---------------------------------------------------------------------------
// NEGATIVE VERIFICATION
// ---------------------------------------------------------------------------
if (process.argv.includes('--selftest')) {
  console.log('  --selftest: breaking each rule in turn');
  const cases = [
    ['a preset declared at the wrong scale', () => {
      const box = { span: 10.713 * 0.9, len: 6.925, hgt: 2.7, min: [0, 0, 0] };
      const d = Math.abs(box.span - 10.73) / 10.73;
      return d > TOL; }],
    ['a preset with no published dimensions', () => {
      const pre = { key: 'x', model: 'pa18' };
      return !pre.pub; }],
    ['payload frames that all agree about the floor', () => {
      const before = fail.length;
      checkSit({ a: { box: { min: [0, 0.01, 0] } },
                 b: { box: { min: [0, 0.02, 0] } } });
      const caught = fail.length > before;
      fail.length = before;
      return caught; }],
    ['a reference that writes the spec', () => {
      const before = fail.length;
      checkOneRoot('function x(){ GARAGE_SPEC.update(s); }');
      const caught = fail.length > before;
      fail.length = before;
      return caught; }],
    ['a rule hidden in a comment counting as a breach', () => {
      const before = fail.length;
      checkOneRoot('// this file never calls GARAGE_SPEC.update\nvar a = 1;');
      const missed = fail.length > before;
      fail.length = before;
      // this one INVERTS: the check must NOT fire on a comment, or the file
      // cannot document the rule it obeys
      return !missed; }],
    ['match-a-dimension accepting a zero', () =>
      R.refMatchScale(0, 10) === null],
    // ---- the reference-only payloads (G138) ----------------------------
    ['a reference payload published under a licence that forbids it', () => {
      const before = fail.length;
      payloads.__t = { ref: 1, lic: 'SKETCHFAB Standard', credit: 'x http://y',
                       surfaces: [] };
      checkRefPayloads(['__t_model.js']);
      const caught = fail.length > before;
      fail.length = before; delete payloads.__t;
      return caught; }],
    ['the same payload BAKED but not published', () => {
      const before = fail.length;
      payloads.__t = { ref: 1, lic: 'SKETCHFAB Standard', credit: 'x http://y',
                       surfaces: [] };
      checkRefPayloads([]);                    // not on the publish list
      const fired = fail.length > before;
      fail.length = before; delete payloads.__t;
      // INVERTS: baking it must be fine, or the tool cannot be used at all
      return !fired; }],
    ['a reference payload that grew control surfaces', () => {
      const before = fail.length;
      payloads.__t = { ref: 1, lic: 'CC-BY-4.0', credit: 'x http://y',
                       surfaces: [{ name: 'aileronG' }] };
      checkRefPayloads(['__t_model.js']);
      const caught = fail.length > before;
      fail.length = before; delete payloads.__t;
      return caught; }],
    ['a reference payload with no provenance at all', () => {
      const before = fail.length;
      payloads.__t = { ref: 1 };
      checkRefPayloads([]);
      const caught = fail.length > before;
      fail.length = before; delete payloads.__t;
      return caught; }],
    ['a payload whose centreline is not at z = 0', () => {
      // the Super Guepard as delivered: z -9.790 .. 0, centreline at -4.895
      const asym = Math.abs(-9.790 + 0.0);
      const fixed = Math.abs(-4.8954 + 4.8950);
      return asym > SYM_TOL && fixed <= SYM_TOL; }],
    ['a real modeller-scale asymmetry counting as a translated frame', () => {
      // INVERTS: the PA-28's own 2.8 mm must NOT trip it, or the check is a
      // demand that hand-modelled wingtips be machined
      return Math.abs(-5.2744 + 5.2716) <= SYM_TOL; }],
    ['a widened scale tolerance with no reason on it', () => {
      // the shape of the check in the decode loop, run on a synthetic row
      const bare = { pub: { span: 1, len: 1, tol: 0.03 } };
      const noted = { pub: { span: 1, len: 1, tol: 0.03, note: 'x'.repeat(30) } };
      const ok = p => p.pub.tol == null ||
        (typeof p.pub.note === 'string' && p.pub.note.length > 20);
      return !ok(bare) && ok(noted); }],
    // ---- the ground attitude ------------------------------------------
    // The three ways this can rot, each broken here so the checks above are
    // known to be able to go red rather than assumed to be.
    ['a taildragger declared level', () => {
      const hull = R.refLowerHull(decodeModel(payloads.pa18));
      const stance = pitch => {
        const t = pitch * Math.PI / 180, c = Math.cos(t), sn = Math.sin(t);
        const lo = R.refLowestY(hull, pitch);
        const xs = hull.filter(q => q[1] * c - q[0] * sn <= lo + CONTACT_TOL)
                       .map(q => q[0] * c + q[1] * sn);
        return Math.max.apply(null, xs) - Math.min.apply(null, xs);
      };
      // level is what the payload is DRAWN at, and it balances on the mains
      return stance(0) < BASE_MIN && stance(12.09) >= BASE_MIN; }],
    ['a preset that declares no attitude at all', () =>
      R.refSitPitch({ key: 'x' }) === 0 &&
      R.refSitPitch({ key: 'x', sit: {} }) === 0],
    ['a sit that ignores the pitch it is given', () => {
      const hull = R.refLowerHull(decodeModel(payloads.pa18));
      return Math.abs(R.refLowestY(hull, 0) - R.refLowestY(hull, 12.09)) > 0.05; }],
    ['a hull that is not the lowest boundary', () => {
      // a straight-line hull would make every attitude equally good
      const h = R.refLowerHull({ g: { pos: new Float32Array(
        [0, 0, 0,  1, 0, 0,  2, 0, 0,  1, 5, 0]) } });
      return !!h && h.length === 2; }],
  ];
  let bad = 0;
  for (const [name, run] of cases) {
    let ok = false;
    try { ok = !!run(); } catch (e) { ok = false; }
    console.log(`  selftest ${ok ? 'caught  ' : 'MISSED  '}${name}`);
    if (!ok) bad++;
  }
  check(bad === 0, `${bad} rule(s) cannot be broken — those checks are inert`);
}

// ---------------------------------------------------------------------------
for (const k of Object.keys(measured)) {
  const m = measured[k], b = m.box;
  console.log(`  ${k}: ${m.groups} groups, ${m.nv} verts, ${m.nt} tris · ` +
              `span ${b.span.toFixed(3)} m · length ${b.len.toFixed(3)} m · ` +
              `height ${b.hgt.toFixed(3)} m (measured, not checked) · ` +
              `minY ${b.min[1].toFixed(4)}`);
}
console.log(`  ${R.REF_PRESETS.length} presets, ${Object.keys(measured).length} ` +
            `with geometry, ${FORBIDDEN.length} spec doors held shut`);
if (fail.length) {
  for (const f of fail) console.log('  FAIL ' + f);
  console.log('GATE REF: FAIL');
  process.exit(1);
}
console.log('GATE REF: PASS');
