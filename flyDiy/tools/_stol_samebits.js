#!/usr/bin/env node
// THE SAME BITS (G2821, STOL-WING-2): the validated aircraft with no STOL part
// fly the bits they flew before the STOL wing existed.
//
//   node tools/_stol_samebits.js [--root=<a flyDiy tree>]
//       one line per validated build (the user's Cub, Jodel, Cessna 172 and
//       Rufus, builds/, JOINED as the garage flies them): def / 4 s / drawing
//       hashes, the design check + the machine sheet (fpCheck: every row, Vref,
//       Vs0, the take-off run) and the pilot's whole circuit (fpLap). Run
//       it once on an untouched master tree (--root=, built) and once here:
//       the lines must be identical, character for character.
//   node tools/_stol_samebits.js --root=<master tree> --capture
//       ALSO writes tools/fixtures/stol_baseline.json.gz (in THIS tree) from
//       that root: every card (the joined bake) and the four builds, their
//       joined spec and hashes, as master builds, flies and draws them -
//       GATE STOL's section 1 reads it. Re-capture after every merge of
//       master that moves the physics (the gate says FAIL in section 1, and
//       says which card).
//
// The build files and the load door are the root's (the files are the same in
// both trees); so are the core and the join.
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const T = __dirname;
const arg = k => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : null; };
const ROOT = path.resolve(arg('root') || path.join(T, '..'));
const RT = path.join(ROOT, 'tools');
const CAPTURE = process.argv.includes('--capture');
const NOLAP = process.argv.includes('--no-lap');
const C = require(path.join(RT, 'flight_core.js'));
const BJ = require(path.join(RT, '_bake_joined.js'));
// THE GAME'S OWN LOAD DOOR (tools/_load_build.js, G1985): the join over what the editor drew, the merge, the energy
// layer's write-back - the spec the game flies, never the file as written
const LB = require(path.join(RT, '_load_build.js'));
const FP = require(path.join(T, '_stol_fp.js'));

// THE VALIDATED AIRCRAFT AS THE GAME SHIPS THEM (A0, 22 Oct): the load door's own table (tools/_load_build.js
// VALIDATED - the Cub, the Jodel, the metal Cessna, the Cessna on floats, the twin floatplane with its float patch)
// and the user's certified Rufus, each loaded THE GAME'S WAY. (The corrected C172 file is gone from the set: the
// user dropped it.)
const VALID = [
  ['cub', { validated: 'cub' }], ['jodel', { validated: 'jodel' }], ['metal', { validated: 'metal' }],
  ['floats', { validated: 'floats' }], ['twinFloats', { validated: 'twinFloats' }],
  ['rufus', { file: 'builds/rufus_2026-10-18_certified.json' }],
];
const loadOf = L => L.validated ? LB.loadValidated(L.validated) : LB.loadBuild(L.file);
const fileOf = L => L.validated ? LB.VALIDATED[L.validated].build + (LB.VALIDATED[L.validated].patch ? ' (+ its float patch)' : '') : L.file;
const clone = o => JSON.parse(JSON.stringify(o));

BJ.loadPanel();
const out = { note: '', cards: {}, builds: {} };
for (const [k, LD] of VALID) {
  const t0 = Date.now();
  const spec = loadOf(LD).spec;
  const def = C.buildGen(clone(spec));
  const rec = { load: LD, file: fileOf(LD), spec, def: FP.fpDef(def), fly: FP.fpFly(C, def), draw: FP.fpDraw(C, def), ...FP.fpCheck(C, buildFresh(spec)) };
  if (!NOLAP) rec.lap = FP.fpLap(C, buildFresh(spec));
  out.builds[k] = rec;
  const L = rec.lap;
  console.log(k.padEnd(10) + ' def ' + rec.def + ' fly ' + rec.fly + ' draw ' + rec.draw + ' check ' + rec.check + ' (' + rec.checkWords + ')' +
              (L ? ' lap ' + L.hash + ' (' + L.outcome + ', ' + L.t.toFixed(2) + ' s, ' + L.phases + ' phases, lift-off ' +
                   (L.liftRun == null ? '-' : L.liftRun.toFixed(2)) + ' m, landing ' + (L.ldgRun == null ? '-' : L.ldgRun.toFixed(2)) + ' m)' : '') +
              '  [' + ((Date.now() - t0) / 1000).toFixed(0) + ' s]');
}
function buildFresh(spec) { return C.buildGen(clone(spec)); }

if (CAPTURE) {
  const { D } = BJ.loadPanel();
  for (const a of D.ARCHETYPES) {
    const r = BJ.bakeCard(a.key);
    if (!r) continue;
    const def = C.buildGen(clone(r.spec));
    out.cards[a.key] = { spec: r.spec, def: FP.fpDef(def), fly: FP.fpFly(C, def), draw: FP.fpDraw(C, def) };
  }
  let head = '';
  try { head = require('child_process').execSync('git -C ' + JSON.stringify(ROOT) + ' rev-parse --short=9 HEAD').toString().trim(); } catch (e) {}
  out.note = 'G2821 GATE STOL section 1: every card (the JOINED bake, tools/_bake_joined.js) and the four validated builds as master ' +
             head + ' built, flew and drew them, WITHOUT the STOL wing (tools/_stol_samebits.js --capture; tools/_stol_fp.js: def = sha1 of ' +
             'nodes/beams/strips/params, fly = 4 s of free flight, draw = genWing groups + moving, lap = the pilot\'s circuit)';
  out.master = head;
  const dst = path.join(T, 'fixtures', 'stol_baseline.json.gz');
  fs.writeFileSync(dst, zlib.gzipSync(JSON.stringify(out), { level: 9 }));
  console.log('captured ' + Object.keys(out.cards).length + ' cards + ' + Object.keys(out.builds).length + ' builds from ' + ROOT + ' (' + head + ') -> ' + path.relative(process.cwd(), dst));
}
