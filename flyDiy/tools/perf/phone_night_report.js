#!/usr/bin/env node
// phone_night_report.js <dir> - phone_night.sh's RESULTS.md: the night's after table on the user's S20 FE beside the 2 Nov live
// build's (before_live_2nov.json in the same folder), the typed values, the material census (the phone tier and the full
// look), the idle hold, PHONE-GARAGE's touch rows, the stills. Reads only the folder's JSON; writes RESULTS.md there.
'use strict';
const fs = require('fs'), path = require('path');
const dir = process.argv[2];
if (!dir) { console.error('usage: node tools/perf/phone_night_report.js <dir>'); process.exit(2); }
const J = f => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { return null; } };
const f0 = x => (x == null || !isFinite(x) ? '-' : Math.round(x) + '');
const before = J('before_live_2nov.json'), edits = J('edits.json'), typed = J('typed.json'), ct = J('census_tier.json'), cf = J('census_full.json'), cc = J('census_crew.json'), fly = J('fly.json'),
  idle = J('idle.json'), touch = J('touch.json');
const L = ['# PHONE-1 overnight check on the S20 FE', '', 'Generated ' + new Date().toISOString() + ' by tools/perf/phone_night_report.js from ' + dir + '.', ''];
if (edits) {
  L.push('## Slider edits (the user\'s Twin_busher_floats_2, the shed drawing; ms on the phone)', '',
    edits.device ? 'Device: ' + edits.device + '. Run: ' + edits.date + '.' : '', '',
    '| row | drag tick (median / max) | drag frame (median) | release before (2 Nov live) | release now | freeze now (release start to the last long task) |', '|---|---|---|---|---|---|');
  const B = new Map(((before && before.rows) || []).map(r => [r.k, r]));
  for (const r of edits.rows || []) {
    if (r.missing) { L.push('| ' + r.k + ' | (no slider) | | | | |'); continue; }
    const b = B.get(r.k);
    L.push('| ' + r.k + ' | ' + f0(r.tickMed) + ' / ' + f0(r.tickMax) + ' | ' + f0(r.dragFrameMed) + ' | ' + (b ? f0(b.release) : '-') + ' | ' + f0(r.release) + ' | ' + f0(r.freeze) + ' |');
  }
  if (edits.idle) L.push('', 'The idle shed (rendering continuously, ?idle=0): ' + JSON.stringify(edits.idle.stats ? { fps: +(+edits.idle.stats.fps).toFixed(1), med: +(+edits.idle.stats.med).toFixed(1), p90: +(+edits.idle.stats.p90).toFixed(1) } : edits.idle) +
    (before && before.idle ? ' (2 Nov live build: ' + JSON.stringify(before.idle.stats ? { fps: +(+before.idle.stats.fps).toFixed(1), med: +(+before.idle.stats.med).toFixed(1) } : before.idle) + ')' : ''));
  L.push('');
}
if (typed) {
  L.push('## Typed values (the value chip; ms on the phone)', '', '| row | handler | freeze |', '|---|---|---|');
  for (const r of typed.rows || []) L.push('| ' + r.k + ' | ' + (r.missing ? '(no field)' : f0(r.release)) + ' | ' + (r.missing ? '' : f0(r.freeze)) + ' |');
  L.push('');
}
const cen = (R, name) => { if (!R || !R.census) return; L.push('### ' + name, '', '| variant | fps | frame median | p90 | max | CPU work |', '|---|---|---|---|---|---|');
  for (const c of R.census) L.push('| ' + c.v + ' | ' + c.fps + ' | ' + c.p50 + ' | ' + c.p90 + ' | ' + c.max + ' | ' + c.work + ' |'); L.push(''); };
if (ct || cf) { L.push('## Materials (the shed rendering continuously)', ''); cen(ct, 'The phone tier (default)'); cen(cf, 'The full look (?phmat=full)'); }
if (cc) { L.push('## The crew in the shed (the user 2 Nov: untextured or hidden if they cost)', '', 'The crew layer: ' + JSON.stringify(cc.crewInfo || null), '');
  cen(cc, 'base / nocrew (the crew hidden) / crewflat (an untextured Lambert of each colour), on the phone tier'); }
if (idle && idle.idlecheck) L.push('## The idle hold', '', 'After 7 s untouched: ' + idle.idlecheck.idleFps + ' fps rendered (the hold: ' + idle.idlecheck.heldFrames + ' frames held); after a touch: ' + idle.idlecheck.afterTouchFps + ' fps.', '');
const regs = ['cub', 'twin'].map(b => [b, J('reg_' + b + '.json')]).filter(x => x[1]);
if (regs.length) {
  L.push('## The registration in the decal atlas (PHONE-GARAGE G3798c: PASS = page 0 inked)', '', '| build | verdict | inked px | context lost | events (last) |', '|---|---|---|---|---|');
  for (const [b, r] of regs) { const e = r.evaljs || {};
    L.push('| ' + b + ' | ' + (e.err ? 'ERR ' + e.err : e.pass ? 'PASS' : 'FAIL') + ' | ' + (e.inked == null ? '-' : e.inked) + ' | ' + (e.lost == null ? '-' : e.lost) + ' | ' + (Array.isArray(e.log) ? e.log.map(x => x.ev).join(' ').slice(0, 120) : String(e.log || '')) + ' |'); }
  L.push('');
}
if (touch && touch.touch) {
  L.push('## PHONE-GARAGE\'s touch checks (portrait, as held)', '', '| check | ok | detail |', '|---|---|---|');
  for (const [k, v] of Object.entries(touch.touch)) L.push('| ' + k + ' | ' + (v && v.ok ? 'ok' : 'FAIL') + ' | ' + JSON.stringify(v).slice(0, 160).replace(/\|/g, '/') + ' |');
  L.push('');
}
const stills = fs.readdirSync(dir).filter(f => /\.jpg$/.test(f));
if (stills.length) L.push('## Stills', '', ...stills.map(f => '- ' + f), '', 'Before (2 Nov, the live look and the phone tier): ../../2026-11-02/phone/s20_material_full.jpg, s20_material_tier1.jpg.', '');
if (fly && fly.fly) { const F = fly.fly, m = x => x && x.heap != null ? x.heap + ' MB' : '-', f = x => x && x.fps != null ? x.fps + ' fps (p90 ' + x.p90 + ' ms)' : '-';
  L.push('## The test flight on the phone (PHONE-TESTFLIGHT, the Cub)', '', '- verdict: ' + F.verdict + (F.outcome ? ' (outcome ' + F.outcome + ', ' + F.circuitSec + ' s after the tap, sim ' + F.simT + ' s)' : ''),
    '- the tap: ' + F.tap + '; reloaded into the flight ' + (F.reloaded != null ? F.reloaded + ' s' : 'NO') + ', boot lifted ' + (F.ready != null ? F.ready + ' s' : '-') + ', rolled out (first autopilot phase) ' + (F.rollout != null ? F.rollout + ' s' : '-') + ', take-off roll ' + (F.roll != null ? F.roll + ' s' : '-') + ' after the tap',
    '- heap: garage ' + m(F.garage && F.garage.mem) + ', in flight ' + m(F.flight && F.flight.mem) + ', the garage again ' + m(F.after && F.after.mem) + (F.shedSec != null ? ' (the shed button: ' + F.shedSec + ' s)' : ''),
    '- frames: garage ' + f(F.garage && F.garage.frames) + ', in flight ' + f(F.flight && F.flight.frames) + (F.flight ? ' (' + F.flight.phase + ')' : ''),
    '- phases: ' + (F.phases || []).map(p => p[1] + ' ' + p[0] + ' s').join(', '), (F.hiddenSeen ? '- the tab was HIDDEN in ' + F.hiddenSeen + ' polls (rAF stops: the flight waits)' : '- the tab stayed in front') + (F.started != null ? '; the roll-out called ' + F.started + ' s after the tap' : ''), '- battery temperature: ' + (F.temp || []).join(', ') + ' C', ''); }
fs.writeFileSync(path.join(dir, 'RESULTS.md'), L.join('\n'));
console.log('RESULTS.md: ' + L.length + ' lines');
