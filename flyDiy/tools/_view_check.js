#!/usr/bin/env node
// GATE VIEW — the view is not the aeroplane (G106).
//
//   node tools/_view_check.js             -> "GATE VIEW: PASS|FAIL"
//   node tools/_view_check.js --selftest  -> each rule broken must go red
//
// WHAT THIS EXISTS TO CATCH, and it is not the bug that was reported.
//
// `CAGE_JOIN.snapshot()` freezes the editor's meshes into the mesh that flies,
// AS DRAWN. So every control that changes how the build is DRAWN is one more
// way to fly the wrong aeroplane, and each one was found the same way: by
// somebody noticing their aeroplane looked wrong in the air. The section
// colours at G47 ("the fuselage is suddenly all grey"), the explode distance
// at G63, the family alphas and the three mesh-replacing display modes at
// G106. Three separate chantiers, three ad-hoc save/force/restore pairs, and
// the fourth was found only because the third went looking.
//
// The fix is not another pair. It is a DECLARED TABLE — every display control
// the game has, each either neutralised for the capture or exempt WITH ITS
// REASON — and this gate, which holds that table against the list of display
// controls the editor actually shows. A control added later without a decision
// here turns the battery red instead of turning up in flight six weeks on.
//
// THE TWO SOURCES, and neither is a copy of the other:
//   editor.js's RAIL    what the player can actually reach: the display and
//                       explode flyouts, listed by row label
//   _cage_join.js       VIEW_STATE (neutralised) + VIEW_KEEP (exempt, why)
//
// A row in one and not the other is the failure. Both directions, because a
// stale exemption for a control that no longer exists is a lie that reads
// exactly like a decision.
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const { VIEW_STATE, VIEW_KEEP } = require('./_cage_join.js');

const SELFTEST = process.argv.includes('--selftest');
let fails = 0;
const ok = (cond, label) => {
  console.log((cond ? '  ok     ' : '  FAIL   ') + label);
  if (!cond) fails++;
};

// ---------------------------------------------------------------------------
// THE RAIL, read out of editor.js. It is a literal array of literals — every
// field is a string, an array of strings or a boolean — so it evaluates in an
// empty context with nothing to reach for. Sliced by bracket matching rather
// than by regex: the icon paths are full of commas and braces.
// ---------------------------------------------------------------------------
// ...and the QUICK table beside it (2026-09-03) by the same reader: its
// entries carry arrow functions, which PARSE in an empty context as long as
// nothing calls them — and nothing here does. Only the literal fields (`k`,
// `row`, `state`, `why`) are read.
function readTable(src, decl) {
  const at = src.indexOf(decl);
  if (at < 0) throw new Error('editor.js has no ' + decl.split(' ')[1] + ' table');
  const start = src.indexOf('[', at);
  let depth = 0, end = -1;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (!depth) { end = i + 1; break; } }
  }
  if (end < 0) throw new Error(decl + ' does not close');
  return vm.runInNewContext('(' + src.slice(start, end) + ')');
}

const edSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'viewer', 'editor.js'), 'utf8');
const RAIL = readTable(edSrc, 'const RAIL = [');

// WHICH FLYOUTS ARE ABOUT THE MESH. `night` is the light in the room and
// `measure` is a readout; neither changes a vertex or a material the capture
// reads, and neither has ever been in the capture's way. Named here rather
// than inferred, so adding a flyout is a decision somebody makes on purpose.
const MESH_FLYOUTS = ['display', 'explode'];
const shown = [];
for (const t of RAIL) {
  if (MESH_FLYOUTS.indexOf(t.k) < 0) continue;
  for (const r of (t.rows || [])) shown.push(r);
}
ok(shown.length >= 12,
   'the editor shows ' + shown.length + ' controls that draw the build');

// ---------------------------------------------------------------------------
// 1. EVERY CONTROL IS DECIDED. Neutralised, or exempt with a reason.
// ---------------------------------------------------------------------------
const neutral = VIEW_STATE.map(r => r.row);
const keep = Object.keys(VIEW_KEEP);
{
  const undecided = shown.filter(r =>
    neutral.indexOf(r) < 0 && keep.indexOf(r) < 0);
  ok(undecided.length === 0,
     'every display control is either neutralised or exempt' +
     (undecided.length ? ' (undecided: ' + undecided.join(', ') + ')' : ''));
}

// ---------------------------------------------------------------------------
// 2. AND EACH IS DECIDED ONCE. A control in both tables is a control whose
//    exemption argues with its neutralisation, and the reader cannot tell
//    which one the code obeys without running it.
// ---------------------------------------------------------------------------
{
  const both = neutral.filter(r => keep.indexOf(r) >= 0);
  ok(both.length === 0,
     'no control is both neutralised and exempt' +
     (both.length ? ' (' + both.join(', ') + ')' : ''));
  const dup = neutral.filter((r, i) => neutral.indexOf(r) !== i);
  ok(dup.length === 0, 'no control is neutralised twice' +
     (dup.length ? ' (' + dup.join(', ') + ')' : ''));
}

// ---------------------------------------------------------------------------
// 3. NOTHING IS DECIDED THAT DOES NOT EXIST. A stale row reads exactly like a
//    decision and protects nothing — this is the direction GATE PARTS taught,
//    and the one a table drifts in when a control is renamed.
// ---------------------------------------------------------------------------
{
  // ...EXCEPT a row that says so. `hidden` means "pinned in the capture and
  // deliberately NOT offered in the game" — subsurf, which is a bench
  // instrument. It is a claim about the rail, so it has to be written down
  // rather than inferred from the row's absence, which is what a ghost looks
  // like too.
  const pinnedOnly = VIEW_STATE.filter(r => r.hidden).map(r => r.row);
  const ghosts = neutral.concat(keep)
    .filter(r => shown.indexOf(r) < 0 && pinnedOnly.indexOf(r) < 0);
  ok(ghosts.length === 0,
     'every decided control is one the editor really shows, or says why not' +
     (ghosts.length ? ' (ghosts: ' + ghosts.join(', ') + ')' : ''));
  const listed = pinnedOnly.filter(r => shown.indexOf(r) >= 0);
  ok(listed.length === 0,
     'and a control marked as not offered really is not in the rail' +
     (listed.length ? ' (' + listed.join(', ') + ')' : ''));
  const mute = VIEW_STATE.filter(r => r.hidden !== undefined &&
    (typeof r.hidden !== 'string' || r.hidden.length < 20)).map(r => r.row);
  ok(mute.length === 0, 'and it says WHY it is not offered' +
     (mute.length ? ' (' + mute.join(', ') + ')' : ''));
}

// ---------------------------------------------------------------------------
// 4. A NEUTRALISED ROW CAN ACTUALLY BE READ, WRITTEN AND RESTORED. The table
//    is only worth anything if the capture can use it, and `to` must be a
//    value rather than a function — the neutral is a CONSTANT, not something
//    to be computed at capture time out of the state being neutralised.
// ---------------------------------------------------------------------------
{
  const bad = VIEW_STATE.filter(r =>
    typeof r.get !== 'function' || typeof r.set !== 'function' ||
    r.to === undefined || typeof r.to === 'function');
  ok(bad.length === 0, 'every neutralised control has a get, a set and a ' +
     'constant neutral' +
     (bad.length ? ' (' + bad.map(r => r.row).join(', ') + ')' : ''));
}

// ---------------------------------------------------------------------------
// 4b. THE QUICK BAR IS A SHORTCUT, NEVER A NEW CONTROL (2026-09-03).
//     editor.js grew a second surface that reaches display controls — the
//     quick actions over the render — and this gate's whole premise is that
//     the RAIL is what the player can reach. A button there that pressed
//     something the rail does not offer would be a control with no capture
//     decision, arriving by the exact route rule 1 exists to close.
//
//     So every QUICK entry either NAMES a rail row (and inherits that row's
//     decision, because it presses the row's own element) or declares the
//     `state` it drives with a reason — the same shape, and the same minimum,
//     as a `hidden` row's.
// ---------------------------------------------------------------------------
const QUICK = readTable(edSrc, 'const QUICK = [');
const railRows = [];
for (const t of RAIL) for (const r of (t.rows || [])) railRows.push(r);
const quickOrphans = () =>
  QUICK.filter(q => q.row && railRows.indexOf(q.row) < 0);
const quickMute = () => QUICK.filter(q => !q.row &&
  (typeof q.state !== 'string' || typeof q.why !== 'string' ||
   q.why.length < 20));
{
  ok(QUICK.length >= 1, 'the editor declares its quick actions');
  const orphan = quickOrphans();
  ok(orphan.length === 0,
     'every quick action presses a row the rail also offers' +
     (orphan.length ? ' (only on the bar: ' +
      orphan.map(q => q.row).join(', ') + ')' : ''));
  const undeclared = quickMute();
  ok(undeclared.length === 0,
     'and one that presses no row says what state it drives, and why' +
     (undeclared.length ? ' (' + undeclared.map(q => q.k).join(', ') + ')' : ''));
}

// ---------------------------------------------------------------------------
// 5. AN EXEMPTION SAYS WHY. A bare `true` in an exemption list is how a table
//    stops being a decision and becomes a place to put things.
// ---------------------------------------------------------------------------
{
  const mute = keep.filter(k => typeof VIEW_KEEP[k] !== 'string' ||
                                VIEW_KEEP[k].length < 20);
  ok(mute.length === 0, 'every exemption carries its reason' +
     (mute.length ? ' (' + mute.join(', ') + ')' : ''));
}

// ---------------------------------------------------------------------------
// 6. THE CAPTURE USES THE TABLE, AND PUTS IT BACK LAST. Read off the source,
//    because `snapshot` needs a document and a built scene and no node harness
//    has either. A table nothing reads is a table that is always right.
//
//    THE `finally` IS THE POINT, and it is the G106 bug in one line. The
//    restore runs `build()`, which puts the whole scene back the way the
//    builder had it — and the capture reads the scene AFTER the vertices are
//    merged, for the propeller's hub and its shaft axis. With the restore in
//    the middle, the vertices came out un-exploded and the prop's pivot came
//    out exploded, and the propeller flew a metre off the nose. So the restore
//    belongs to a wrapper AROUND the whole capture and nowhere inside it.
// ---------------------------------------------------------------------------
{
  const src = fs.readFileSync(path.join(__dirname, '_cage_join.js'), 'utf8');
  const fn = name => {
    const at = src.indexOf('const ' + name + ' = ');
    return at < 0 ? '' : src.slice(at, at + 900);
  };
  ok(/VIEW_STATE\.map\(/.test(fn('viewNeutral')) &&
     /r\.set\(r\.to\)/.test(fn('viewNeutral')),
     'the capture forces the WHOLE table to its neutrals, not named knobs');
  ok(/VIEW_STATE\.forEach/.test(fn('viewRestore')) && /r\.set\(was\[i\]\)/.test(fn('viewRestore')),
     '...and puts the whole table back');
  const wrapAt = src.indexOf('const snapshot = spec =>');
  const wrap = wrapAt < 0 ? '' : src.slice(wrapAt, wrapAt + 400);
  ok(/try\s*\{[^}]*snapshotAt\(spec\)[^}]*\}\s*finally\s*\{\s*viewRestore\(\)/.test(wrap),
     '...in a finally AROUND the whole capture, so a throw cannot strand the ' +
     'builder in a neutralised view');
  const capAt = src.indexOf('const snapshotAt = spec =>');
  const body = capAt < 0 ? ''
    : src.slice(capAt, src.indexOf('\n  };', capAt));
  ok(/viewNeutral\(\)/.test(body), 'the capture asks for the neutral state');
  ok(!/viewRestore\(\)/.test(body),
     '...and NEVER restores inside itself — that is where the prop pivot was ' +
     'read out of a scene that had already been put back');
}

if (SELFTEST) {
  // Each rule broken in turn must fail its OWN check. The tables are objects
  // this process owns, so the break is a mutation and not a file edit — which
  // also means it cannot be left behind on disk if this exits early.
  console.log('');
  console.log('--- selftest: each rule broken must go red ---');
  let missed = 0;
  const trial = (label, bend) => {
    const before = fails;
    const undo = bend();
    // re-run the two table rules the mutation can reach
    const n2 = VIEW_STATE.map(r => r.row), k2 = Object.keys(VIEW_KEEP);
    const p2 = VIEW_STATE.filter(r => r.hidden).map(r => r.row);
    const undecided = shown.filter(r => n2.indexOf(r) < 0 && k2.indexOf(r) < 0);
    const ghosts = n2.concat(k2)
      .filter(r => shown.indexOf(r) < 0 && p2.indexOf(r) < 0);
    const bad = VIEW_STATE.filter(r => typeof r.get !== 'function' ||
      typeof r.set !== 'function' || r.to === undefined);
    const mute = k2.filter(k => typeof VIEW_KEEP[k] !== 'string' ||
                                VIEW_KEEP[k].length < 20)
      .concat(VIEW_STATE.filter(r => r.hidden !== undefined &&
        (typeof r.hidden !== 'string' || r.hidden.length < 20)).map(r => r.row));
    const listed = p2.filter(r => shown.indexOf(r) >= 0);
    const caught = undecided.length || ghosts.length || bad.length ||
                   mute.length || listed.length ||
                   quickOrphans().length || quickMute().length;
    undo();
    fails = before;
    console.log((caught ? '  caught  ' : '  MISSED  ') + label);
    if (!caught) missed++;
  };
  // a row the rail REALLY LISTS: dropping the `hidden` one (subsurf) leaves
  // nothing undecided, because the rail does not offer it in the first place
  trial('a control nobody decided', () => {
    const i = VIEW_STATE.findIndex(r => !r.hidden && shown.indexOf(r.row) >= 0);
    const gone = VIEW_STATE.splice(i, 1)[0];
    return () => VIEW_STATE.splice(i, 0, gone);
  });
  trial('a decision for a control that does not exist', () => {
    VIEW_STATE.push({ row: 'holographic mode', get: () => null,
                      set: () => {}, to: 0 });
    return () => VIEW_STATE.pop();
  });
  trial('a neutralised control with no setter', () => {
    const was = VIEW_STATE[0].set;
    VIEW_STATE[0].set = null;
    return () => { VIEW_STATE[0].set = was; };
  });
  trial('an exemption with no reason', () => {
    const k = Object.keys(VIEW_KEEP)[0], was = VIEW_KEEP[k];
    VIEW_KEEP[k] = true;
    return () => { VIEW_KEEP[k] = was; };
  });
  // ...and the two rules the `hidden` flag brought with it (G106.1)
  trial('a row claiming to be unoffered while the rail offers it', () => {
    const r = VIEW_STATE.find(x => x.hidden);
    const was = r.row; r.row = shown[0];
    return () => { r.row = was; };
  });
  trial('a row claiming to be unoffered with no reason', () => {
    const r = VIEW_STATE.find(x => x.hidden);
    const was = r.hidden; r.hidden = true;
    return () => { r.hidden = was; };
  });
  // ...and the two the quick bar brought (2026-09-03)
  trial('a quick action that presses something the rail does not offer', () => {
    QUICK.push({ k: 'ghost', row: 'holographic mode' });
    return () => QUICK.pop();
  });
  trial('a quick action driving a state it does not declare', () => {
    QUICK.push({ k: 'mystery' });
    return () => QUICK.pop();
  });
  console.log(missed ? '  SELFTEST FAILED (' + missed + ' missed)'
                     : '  selftest: every rule discriminates');
  if (missed) fails++;
}

console.log('');
console.log(neutral.length + ' controls neutralised, ' + keep.length +
            ' exempt, over ' + shown.length + ' the editor shows');
console.log('GATE VIEW: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
process.exit(fails ? 1 : 0);
