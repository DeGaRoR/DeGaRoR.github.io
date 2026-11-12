#!/usr/bin/env node
// _strut_opt_digest.js (STRUT-OPTIONS, 2026-11-10) - THE SHIPPED BUILDS' FRAMES, FROZEN: the instrument the strut
// options (wing 'struts & fixation': wgStrutSec, wgJury) were held to. Every build in builds/ and builds/candidates/
// goes through the GAME'S OWN LOAD DOOR (tools/_load_build.js gameSpec: the editor draws it, the join measures it),
// then buildGen; per build it prints the certificate key (genCertKey) and a sha1 of the nodes (p, m, tag), the beams
// (every field) and the params (the aero table). A build that never touched the new rows must read the same bytes
// before and after.
//
//   node tools/_strut_opt_digest.js > before.txt       (on the base commit, after `node tools/build.js`)
//   node tools/_strut_opt_digest.js > after.txt ; diff before.txt after.txt
//   node tools/_strut_opt_digest.js --raw               buildGen on the file as written (no load door; fast)
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const RAW = process.argv.includes('--raw');
const C = require(path.join(__dirname, 'flight_core.js'));
const LB = RAW ? null : require(path.join(__dirname, '_load_build.js'));
const sha = o => crypto.createHash('sha1').update(JSON.stringify(o)).digest('hex').slice(0, 16);
const files = [];
for (const d of ['builds', 'builds/candidates'])
  for (const f of fs.readdirSync(path.join(ROOT, d)).sort())
    if (f.endsWith('.json') && !f.endsWith('.edits.json') && f !== 'index.json') files.push(d + '/' + f);
for (const f of files) {
  let line;
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    if (!raw || !raw.spec) continue;
    const spec = RAW ? raw.spec : LB.gameSpec(raw);
    const d = C.buildGen(JSON.parse(JSON.stringify(spec)));
    line = [f, C.genCertKey(d),
            'n' + d.nodes.length + ':' + sha(d.nodes.map(n => [n.p, n.m, n.tag])),
            'b' + d.beams.length + ':' + sha(d.beams),
            'p:' + sha(d.params)].join('  ');
  } catch (e) { line = f + '  ERROR ' + (e && e.message); }
  console.log(line);
}
