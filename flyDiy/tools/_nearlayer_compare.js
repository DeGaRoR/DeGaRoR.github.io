#!/usr/bin/env node
// _nearlayer_compare.js - G1125 (NEAR-LAYER): what each shadow pass DREW, before and after, off two FRAMECOST censuses.
//
//   FRAMECOST_SHADOW_PASSES=1 node tools/_framecost_check.js --json base.json     (the base tree)
//   FRAMECOST_SHADOW_PASSES=1 node tools/_framecost_check.js --json new.json      (this tree)
//   node tools/_nearlayer_compare.js base.json new.json
//
// Each census carries, per build and view, the last measured frame's shadow draws by pass ('sun:0' the world's far map,
// 'sunNear:0' the craft's cascade, 'sunNear:1' the 60 m box), each draw keyed by its child-index path, family and layers
// (N near, C craft, F far). The scheme says: the far map and the cascade unchanged; the box = what it drew before that
// stands on NEAR_LAYER (nearTag's casters) or CRAFT_LAYER (the craft, kept whole: shadow_near.js boxCraft) - the rest
// (the instanced / batched casters, the crumbs, the trees) its drops.
// Exit 1 when a pass differs from what the scheme says.
'use strict';
const fs = require('fs');
const [a, b] = process.argv.slice(2);
if (!a || !b) { console.log('usage: node tools/_nearlayer_compare.js base.json new.json'); process.exit(2); }
const A = JSON.parse(fs.readFileSync(a, 'utf8')), B = JSON.parse(fs.readFileSync(b, 'utf8'));
let bad = 0;
const fam = k => k.split(' ').slice(1).join(' ');
const sum = o => Object.values(o || {}).reduce((x, y) => x + y, 0);
function diff(x, y) {   // multiset x - y
  const r = {}; for (const [k, v] of Object.entries(x || {})) { const d = v - ((y || {})[k] || 0); if (d > 0) r[k] = d; } return r;
}
const byFam = o => { const r = {}; for (const [k, v] of Object.entries(o)) { const f = fam(k); r[f] = (r[f] || 0) + v; } return Object.entries(r).sort((p, q) => q[1] - p[1]).map(([f, v]) => v + ' ' + f).join(', '); };
for (const build of Object.keys(B.builds || {})) {
  for (const view of ['stand', 'taxi']) {
    const pa = A.builds[build] && A.builds[build].detail && A.builds[build].detail[view] && A.builds[build].detail[view].shadowPasses;
    const pb = B.builds[build].detail && B.builds[build].detail[view] && B.builds[build].detail[view].shadowPasses;
    if (!pa || !pb) { console.log(`${build} ${view}: no shadow pass lists (run the censuses with FRAMECOST_SHADOW_PASSES=1)`); bad++; continue; }
    console.log(`${build} ${view}: draws by pass ` + ['sun:0', 'sunNear:0', 'sunNear:1'].map(p => `${p} ${pa[p] ? pa[p].n : '-'} -> ${pb[p] ? pb[p].n : '-'}`).join(', '));
    for (const p of ['sun:0', 'sunNear:0']) {
      const ka = (pa[p] || {}).keys, kb = (pb[p] || {}).keys, lost = diff(ka, kb), got = diff(kb, ka);
      const same = !sum(lost) && !sum(got);
      console.log(`  ${same ? 'same' : 'DIFF'} ${p}: ${sum(ka)} draws` + (same ? '' : ` - lost ${sum(lost)} (${byFam(lost)}), gained ${sum(got)} (${byFam(got)})`));
      if (!same) bad++;
    }
    const ka = (pa['sunNear:1'] || {}).keys || {}, kb = (pb['sunNear:1'] || {}).keys || {};
    const want = {}, drop = {};
    for (const [k, v] of Object.entries(ka)) (/\[[^\]]*[NC][^\]]*\]$/.test(k) ? want : drop)[k] = v;
    const lost = diff(want, kb), extra = diff(kb, want);
    const ok = !sum(lost) && !sum(extra);
    console.log(`  ${ok ? 'as the scheme' : 'DIFF'} sunNear:1 (the 60 m box): ${sum(ka)} -> ${sum(kb)} draws; kept ${sum(want)} near casters and craft draws` + (ok ? '' : `, lost ${sum(lost)} (${byFam(lost)}), extra ${sum(extra)} (${byFam(extra)})`));
    console.log(`    dropped ${sum(drop)}: ${byFam(drop) || 'nothing'}`);
    if (!ok) bad++;
  }
}
console.log(bad ? `NEARLAYER COMPARE: ${bad} pass(es) differ from the scheme` : 'NEARLAYER COMPARE: every pass as the scheme says');
process.exit(bad ? 1 : 0);
