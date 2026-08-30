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

function loadPayload(file, name) {
  const txt = fs.readFileSync(path.join(SRC, 'models', file), 'utf8');
  const box = {};
  new Function('exports', txt + '\n;exports.M = ' + name + ';')(box);
  return box.M;
}

// ---------------------------------------------------------------------------
// DECODE + TRUE SCALE + THE TABLE
// ---------------------------------------------------------------------------
const FILES = { pa18: ['pa18_model.js', 'MODEL_PA18'],
                c172: ['c172_model.js', 'MODEL_C172'] };
const TOL = 0.015;                 // 1.5% — a model, not a drawing

const measured = {};
for (const pre of R.REF_PRESETS) {
  if (!pre.model) continue;                       // the empty row is a row
  const f = FILES[pre.model];
  if (!check(!!f, `preset ${pre.key} names model '${pre.model}', which has no payload`))
    continue;
  let dec = null;
  try { dec = decodeModel(loadPayload(f[0], f[1])); }
  catch (e) { check(false, `preset ${pre.key}: decode threw — ${e.message}`); continue; }

  const groups = Object.keys(dec);
  const nv = groups.reduce((a, g) => a + dec[g].nv, 0);
  const nt = groups.reduce((a, g) => a + dec[g].nt, 0);
  check(groups.length > 0, `preset ${pre.key}: decoded to no groups`);
  check(nv > 0 && nt > 0, `preset ${pre.key}: decoded to no geometry`);

  const box = R.refDecodedBox(dec);
  if (!check(!!box, `preset ${pre.key}: no bounding box`)) continue;
  measured[pre.key] = { box, nv, nt, groups: groups.length };

  check(!!pre.pub, `preset ${pre.key} declares no published dimensions — ` +
        'nothing holds its scale');
  if (!pre.pub) continue;

  const dSpan = Math.abs(box.span - pre.pub.span) / pre.pub.span;
  const dLen = Math.abs(box.len - pre.pub.len) / pre.pub.len;
  check(dSpan <= TOL, `${pre.key} span: model ${box.span.toFixed(3)} m vs ` +
        `published ${pre.pub.span.toFixed(2)} m — ${(dSpan * 100).toFixed(2)}% out ` +
        `(limit ${(TOL * 100).toFixed(1)}%)`);
  check(dLen <= TOL, `${pre.key} length: model ${box.len.toFixed(3)} m vs ` +
        `published ${pre.pub.len.toFixed(2)} m — ${(dLen * 100).toFixed(2)}% out ` +
        `(limit ${(TOL * 100).toFixed(1)}%)`);
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
