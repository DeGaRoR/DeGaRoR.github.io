#!/usr/bin/env node
// cowl_study/pusher_taper.js - PROPER-COWLS, A0's question of 9 Nov ("0,62 is good": a pusher's cowl keeps its taper
// toward the engine, the Busher's cw_taperW 0.62): what front width the straight rule gives a FRESH pusher, and why.
// Each pusher archetype born by the chooser's own path (NP.fromArchetype -> _newplane_lib joinedOf), the Busher from its
// saved file; for each, the rule's two terms: the engine's (1.06 x the drawn half-width at the front + 2 cm) and the
// floor (0.45 x the firewall's half-width), the front half-width a1 = min(aW, max(both)), taperW = a1 / aW.
// Reads only; writes nothing but its own JSON table.
//   node tools/cowl_study/pusher_taper.js [out.json]
'use strict';
const fs = require('fs'), path = require('path');
const NL = require('../_newplane_lib.js'); NL.init();
const NP = NL.NP();
const D = require('../_cage_design.js');
const ST = require('./straight.js');
const CLEAR = 1.06;

function terms(spec, label) {
  const r = ST.rowsFor(spec, { opt: 'waist' });
  if (!r.over) return { label, err: String(r.why) };
  const m = ST.measure(spec);
  const P = m.P, f = m.face;
  const aW = f ? f.halfW : null;
  const wE = r.why.env ? r.why.env.wE : null, wF = (r.why.drawn || {}).wFront || 0;
  const eng = CLEAR * Math.max(wE || 0, wF) + 0.02, floor = aW != null ? 0.45 * aW : null;
  return { label, engine: m.name, mount: m.mount, firewallHalfW: aW && +aW.toFixed(3),
           engineHalfW: wE != null ? +Math.max(wE, wF).toFixed(3) : null,
           engineTerm: +eng.toFixed(3), floorTerm: floor && +floor.toFixed(3),
           ruleTaperW: r.over.cw_taperW, savedTaperW: P.cw_taperW != null ? +(+P.cw_taperW).toFixed(3) : null,
           winner: eng >= (floor || 0) ? 'engine' : 'floor' };
}

const rows = [];
for (const a of D.ARCHETYPES) {
  const s = a.sel || {};
  if (s.engMount !== 'pusher' || a.blocked) continue;
  try {
    const ch = NP.fromArchetype(a);
    const { j } = NL.joinedOf(ch, {});
    rows.push(Object.assign({ key: a.key, authored: !!NP.authored(a) }, terms(j.spec, a.name)));
  } catch (e) { rows.push({ key: a.key, err: String(e && e.message || e).slice(0, 200) }); }
  console.log(JSON.stringify(rows[rows.length - 1]));
}
const busher = path.join(__dirname, '..', '..', 'builds', 'candidates', 'Twin_busher_floats_4b.json');
try {
  const j = JSON.parse(fs.readFileSync(busher, 'utf8'));
  rows.push(Object.assign({ key: 'Twin_busher_floats_4b (saved)' }, terms(j.spec || j, 'Twin busher floats 4b')));
} catch (e) { rows.push({ key: 'busher', err: String(e && e.message || e).slice(0, 200) }); }
console.log(JSON.stringify(rows[rows.length - 1]));
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(rows, null, 1));
