#!/usr/bin/env node
// card_roundtrip.js - A DRAFTING CARD IS THE PLAYER'S TO EDIT (13 Nov, the user: "put it as a candidate, and ensure I
// can edit it manually myself"). For each drafting card in the candidates pool: it loads through the game's own load
// door (tools/_load_build.js: the editor's layers draw it, the join measures it - the page's chain, headless) with no
// join error that stops it; no row of it is locked (no lock / plaque / certificate key); the drafting-only blocks
// (`ref`, `history`) ride beside the spec and never inside it; and a ROUND TRIP keeps an edit: one cage row changed on
// the loaded spec (the wing span, as a player drags it), the result saved as the game saves a design (an envelope with
// the spec) and loaded again through the same door - the edit is still there and the flown wing follows it.
//
//   node tools/drafting/card_roundtrip.js [file ...]     -> "CARD ROUNDTRIP: PASS|FAIL"
'use strict';
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
const LB = require(path.join(ROOT, 'tools', '_load_build.js'));
const files = process.argv.slice(2).length ? process.argv.slice(2)
  : ['builds/candidates/c337_drafting_2026-11-13.json', 'builds/candidates/pc6_drafting_2026-11-11.json'];
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
console.log('CARD ROUNDTRIP');
for (const f of files) {
  const env = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  const name = path.basename(f);
  ok(env.spec && env.spec.cage, name + ': an envelope with a spec and its cage');
  const locks = [];
  (function walk(o, p) {
    if (!o || typeof o !== 'object') return;
    for (const k of Object.keys(o)) { if (/^(lock|locked|plaque|cert|certificate|official|readonly)$/i.test(k)) locks.push(p + k); walk(o[k], p + k + '.'); }
  })(env.spec, '');
  ok(!locks.length, name + ': no locked row' + (locks.length ? ' (' + locks.join(', ') + ')' : ''));
  ok(!('ref' in env.spec) && !('history' in env.spec), name + ': the drafting blocks ride beside the spec, not in it');
  const a = LB.loadBuild(path.join(ROOT, f));
  ok(a.spec && !(a.errors || []).some(e => /fatal|throw|cannot/i.test(String(e))), name + ': loads through the load door' + ((a.errors || []).length ? ' (join findings: ' + a.errors.length + ', named)' : ''));
  const span0 = +a.spec.cage.wgSpan, span1 = +(span0 - 0.5).toFixed(2);
  const edited = JSON.parse(JSON.stringify(a.spec)); edited.cage.wgSpan = span1;
  const saved = { what: 'flydiy-build', v: env.v || 1, name: (env.name || name) + ' (edited)', spec: edited };
  const tmp = path.join(require('os').tmpdir(), 'roundtrip_' + process.pid + '_' + name);
  fs.writeFileSync(tmp, JSON.stringify(saved));
  const b = LB.loadBuild(tmp);
  fs.unlinkSync(tmp);
  ok(b.spec && Math.abs(+b.spec.cage.wgSpan - span1) < 1e-9, name + ': an edited row survives save and reload (wgSpan ' + span0 + ' -> ' + (b.spec && b.spec.cage.wgSpan) + ')');
  const flown = b.spec && b.spec.wings && b.spec.wings[0] ? +b.spec.wings[0].span : NaN;
  ok(Math.abs(flown - span1) < 0.05, name + ': the flown wing follows the edit (' + (isFinite(flown) ? flown.toFixed(2) : '-') + ' m)');
}
console.log('CARD ROUNDTRIP: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
