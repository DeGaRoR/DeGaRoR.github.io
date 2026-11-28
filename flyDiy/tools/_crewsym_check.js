#!/usr/bin/env node
// _crewsym_check.js - GATE CREWSYM (KNEE-SYM, 2026-11-23, the user via A0: "the pilot position is not symmetric, its
// right knee is more inside than its left").
//
// The knees' and elbows' IK poles were offset along the WORLD's axes (_cage_crew.js solveGripJob): in the shed the
// aeroplane lies along world x, so the "out" offset ran fore/aft (opposite for the two sides) and the "forward" one ran
// sideways (the same way for both knees) - a mirrored pair bent lopsided. They are the body's own now. This gate seats
// the pilot through the page's own load chain (tools/_load_build.js) on three aeroplanes - the metal Cessna, the Cub,
// the Chinook - and reads the pilot's joints in the pilot's frame from the hips (tools/_crewsym_probe.js):
//   1  THE KNEES MIRROR: the left knee mirrored across the pilot's middle lands on the right one within 1 cm, or within
//      the feet's own mismatch + 0.5 cm where the pedals themselves sit unevenly (the knee follows its foot)
//   2  THE HIPS MIRROR (the legs' roots, 5 mm): the rig itself is symmetric, so a knee row cannot pass on a lopsided seat
//   (1 and 2 as built AND turned: the crew layer's group a quarter turn about up and the legs solved again by its own
//   solver, as the shed lies the aeroplane along world x - the case the world-axis poles broke)
//   4  THE POSE IS THE BODY'S: the same solve (the card's knees / elbows rows) turned and not - the knees 5 mm apart at most
//   3  THE SOURCE: solveGripJob turns its pole offsets by the fig's own quaternion (no bare pole.x / pole.z += ...)
//   --selftest  doctored readings (a knee moved 3 cm in; the source's world-axis offsets back) must turn rows red
//   node tools/_crewsym_check.js [--selftest] [--report]
'use strict';
const fs = require('fs');
const path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const BUILDS = [
  ['metal Cessna', 'builds/cessna172r_2026-11-08.json'],
  ['Cub', 'builds/cub_2026-09-20_corrected.json'],
  ['Chinook', 'builds/chinook_2026-09-21_corrected.json'],
];
const argv = process.argv.slice(2);

function probe(build) {
  process.env.FLYDIY_JOIN_PROBE = path.join(T, '_crewsym_probe.js');
  process.env.FLYDIY_JOIN_NOCACHE = '1';                 // (the pose is the code's: never a cached page)
  delete process.env.FLYDIY_CREW_JOB_SET;
  const LB = require('./_load_build.js');
  const r = LB.loadBuild(build);
  return r.probe || { err: 'no probe result' + (r.errors && r.errors.length ? ': ' + String(r.errors[0]).slice(0, 160) : '') };
}
const mir = (L, R) => Math.hypot(L[0] + R[0], L[1] - R[1], L[2] - R[2]);

function verdicts(res, src) {
  const rows = [];
  const row = (id, ok, what, detail) => rows.push({ id, ok: !!ok, what, detail: detail || '' });
  for (const [label] of BUILDS) {
    const P = res[label];
    if (!P || P.err) { row('1 ' + label, false, label + ': the pilot seated and read', P ? P.err : 'no reading'); continue; }
    for (const [tag, J] of [['as built', P.joints], ['turned (the shed)', P.turned && P.turned.joints]]) {
      if (!J) { row('1 ' + label + ' ' + tag, false, label + ' ' + tag + ': the pilot re-solved', P.turned && P.turned.err); continue; }
      const knee = mir(J.LeftLeg, J.RightLeg), foot = mir(J.LeftFoot, J.RightFoot), hip = mir(J.LeftUpLeg, J.RightUpLeg);
      const lim = Math.max(0.01, foot + 0.005);
      row('1 ' + label + ' ' + tag, knee <= lim, label + ' ' + tag + ': the knees mirror (within ' + (lim * 100).toFixed(1) + ' cm)',
          'knee ' + (knee * 100).toFixed(1) + ' cm, feet ' + (foot * 100).toFixed(1) + ' cm; L ' + JSON.stringify(J.LeftLeg) + ' R ' + JSON.stringify(J.RightLeg));
      row('2 ' + label + ' ' + tag, hip <= 0.005, label + ' ' + tag + ': the hips mirror (5 mm)', (hip * 1000).toFixed(1) + ' mm');
    }
    if (P.resolved && P.resolved.joints && P.turned && P.turned.joints) {      // the pose is the body's: the same solve, turned or not
      const d = Math.max(...['LeftLeg', 'RightLeg'].map(b => Math.hypot(...[0, 1, 2].map(k => P.resolved.joints[b][k] - P.turned.joints[b][k]))));
      row('4 ' + label, d <= 0.005, label + ': the knees stand where they stood when the aeroplane is turned (5 mm)', (d * 1000).toFixed(1) + ' mm');
    }
  }
  const fn = (src.match(/function solveGripJob\([\s\S]*?\n}\n/) || [''])[0];
  row('3', fn && /applyQuaternion\(_qf\)/.test(fn) && !/pole\.(x|z) \+=/.test(fn) && !/pole\.y [-+]= /.test(fn),
      'solveGripJob turns its pole offsets by the fig\'s own quaternion (no world-axis pole offsets)');
  return rows;
}

const src = fs.readFileSync(path.join(T, '_cage_crew.js'), 'utf8');
const res = {};
for (const [label, b] of BUILDS) res[label] = probe(b);
if (argv.includes('--report')) console.log(JSON.stringify(res, null, 1));
const rows = verdicts(res, src);
let fails = 0;
console.log('GATE CREWSYM - the pilot sits symmetric: knees and hips mirror in the pilot\'s own frame');
for (const r of rows) { if (!r.ok) fails++; console.log('  ' + (r.ok ? 'ok   ' : 'FAIL ') + ' ' + r.what + (r.detail ? ' - ' + r.detail : '')); }
if (argv.includes('--selftest')) {
  const doctor = (what, id, fnR, fnS) => {
    const R2 = JSON.parse(JSON.stringify(res)); if (fnR) fnR(R2);
    const s2 = fnS ? fnS(src) : src;
    const bad = verdicts(R2, s2).find(r => r.id === id);
    const caught = bad && !bad.ok;
    console.log('  selftest ' + (caught ? 'caught  ' : 'MISSED  ') + what);
    if (!caught) fails++;
  };
  doctor('the Cessna right knee moved 3 cm in, turned', '1 metal Cessna turned (the shed)', R => { const t = R['metal Cessna'].turned, k = t && t.joints && t.joints.RightLeg; if (k) k[0] += (k[0] < 0 ? 0.03 : -0.03); });
  doctor('the world-axis pole offsets back in the source', '3', null,
    s => s.replace(/pole\.add\(_hf\.applyQuaternion\(_qf\)\);/, 'pole.x += _hf.x; pole.z += _hf.z;'));
}
console.log('GATE CREWSYM: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
process.exit(fails ? 1 : 0);
