#!/usr/bin/env node
// decision_table.js - THE DECISION TABLE (PERF-TRACE, 22 Nov 2026; the review's View C; the brief's item 5)
//
// One flight-recorder log of a load and a flight -> one row a FEATURE (the first word of the owners the materials
// declare: terrain, pavement, town, forest, cover, water, sky, aircraft, fleet, garage, fx, post ...), and under it a
// row a SYSTEM ('terrain / island ground'). For each, what it cost IN THIS LOG, and how sure that is:
//   programs        how many, how many variants (distinct #define sets), source KB, how many are SHARED with another
//                   feature (cutting this feature alone does not remove those)
//   link queue s    its programs' PENDING SHARE: the wall time of the link queue they stand for (program_report.js).
//                   An UPPER BOUND on what the load would gain without them, never a measurement of it.
//   load steps s    the loading steps that are its own by name (the world's layout = terrain, the forest ring = forest,
//                   parking = fleet ...) with what bound each (load_timeline.js); the compile steps are nobody's by
//                   name: their seconds are split between the features by pending share INSIDE the step
//   frame ms        the loop slots that are its own (premises = town, cover ring = cover, forest fill = forest, the
//                   water's mirror = water): mean ms a world frame
//   freeze ms       the freeze ledger's excess over the budget that names it (its slots, its programs' held draws and
//                   first uses), with the frames over 100 ms it is in
//   to garage / to flight   THE MARGINAL DELAY: what the load loses with the feature on. ONLY a controlled on / off
//                   pair measures it (the same build, browser profile, pilot, graphics, scene): `--ab pairs.json`
//                   [{ feature, toggle, toGarageS: [on, off], toFlightS: [on, off], runs, source }]. Without one the
//                   cell reads UNKNOWN and the bound beside it says what it cannot exceed.
// The rows are sorted by the measured delay to flight where there is one, then by the bound. What a feature is WORTH
// on screen is the owner's call: this table only says what it costs and how well that is known.
//
//   node tools/decision_table.js <flydiy-flightlog-*.json[.gz]> [--ab pairs.json] [--out table.json] [--md table.md]
'use strict';
const fs = require('fs'), path = require('path');
const AL = require(path.join(__dirname, 'analyze_log.js'));
const PR = require(path.join(__dirname, 'program_report.js'));
const FL = require(path.join(__dirname, 'freeze_ledger.js'));
const LT = require(path.join(__dirname, 'load_timeline.js'));
const r1 = v => v == null || v !== v ? null : Math.round(v * 10) / 10;

// what is whose BY NAME (the recorder's slots, the loading screen's steps). A step or a slot not listed is nobody's own.
const SLOT_OF = { prem: 'town', cover: 'cover', fill: 'forest', mirror: 'water' };
const STEP_OF = { world: 'terrain', stages: 'town', restore: 'town', town: 'town', trees: 'forest', treeBins: 'forest', ring: 'forest', parking: 'fleet', parked: 'fleet',
  aircraft: 'aircraft', seed: 'aircraft', snapshot: 'aircraft', bake: 'aircraft', spec: 'aircraft', craft: 'aircraft', recheck: 'aircraft', garage: 'garage', editor: 'garage', shed: 'garage', board: 'garage' };
const COMPILE = /^(compile|worldCompile|frames|firstFrame|shedWarm|shedCompile)$/;
const featureOf = o => String(o).split(' / ')[0], systemOf = o => String(o).split(' / ').slice(0, 2).join(' / ');

function table(log, opt) {
  const o = opt || {}, H = log.header || {};
  const progs = PR.programs(log), steps = PR.steps(log); PR.shares(progs);
  const T = LT.timeline(log, { appSrc: o.appSrc || '' }).summary, L = FL.ledger(log, {});
  const rows = AL.frames(log);
  const by = new Map();
  const row = k => { let g = by.get(k); if (!g) by.set(k, g = { key: k, programs: 0, variants: new Set(), kb: 0, shared: 0, queueS: 0, maxPendingS: 0, late: 0, neverDrawn: 0, firstUseMs: 0, heldMs: 0,
    stepS: 0, steps: [], compileS: 0, frameMs: null, freezeMs: 0, freezes: 0 }); return g; };
  // programs: to the feature and to the system; a program of several owners counts in each, its queue share split
  for (const p of progs) {
    const ows = p.own && p.own.length ? p.own : ['(unowned)'];
    const feats = new Set(ows.map(featureOf));
    for (const w of ows) for (const k of new Set([featureOf(w), systemOf(w)])) {
      const g = row(k), n = ows.length; g.programs += 1 / (k === featureOf(w) ? ows.filter(x => featureOf(x) === k).length : ows.filter(x => systemOf(x) === k).length);
      if (p.defs) g.variants.add(p.defs.join(' ')); if (p.vs != null) g.kb += (p.vs + p.fs) / 1024 / n;
      if (p.share != null) g.queueS += p.share / 1000 / n; if (p.readyT != null) g.maxPendingS = Math.max(g.maxPendingS, (p.readyT - p.t) / 1000);
      if (feats.size > 1) g.shared += 1 / n; if (p.ctx && p.ctx !== 'compile') g.late += 1 / n; if (p.useT == null) g.neverDrawn += 1 / n;
      if (p.firstUseMs) g.firstUseMs += p.firstUseMs / n; if (p.waitMs) g.heldMs += p.waitMs / n;
    }
  }
  // the loading steps: its own by name; the compile steps split by the pending share inside them
  for (const S of T.steps) {
    if (S.s == null) continue;
    const f = STEP_OF[S.id];
    if (f) { const g = row(f); g.stepS += S.s; g.steps.push({ step: S.set + ':' + S.id, s: S.s, bound: S.bound }); continue; }
    if (!COMPILE.test(S.id) || S.s < 0.2) continue;
    const st = steps.find(x => x.set === S.set && x.id === S.id && Math.abs(x.bootT / 1000 - S.startS) < 0.2); if (!st || st.t1 == null) continue;
    // each program's time in flight inside the step, divided by the crowd: the same sweep, clipped to the window
    const inside = progs.filter(p => p.readyT != null && p.t < st.t1 && p.readyT > st.t0).map(p => Object.assign({}, p, { t: Math.max(p.t, st.t0), readyT: Math.min(p.readyT, st.t1) }));
    const sh = PR.shares(inside), k = sh.busyMs > 0 ? Math.min(1, sh.busyMs / (st.t1 - st.t0)) : 0;
    for (const p of inside) { const ows = p.own && p.own.length ? p.own : ['(unowned)']; for (const w of ows) for (const key of new Set([featureOf(w), systemOf(w)])) row(key).compileS += (p.share / 1000) / ows.length; }
    row('(compile steps: nothing linking)').compileS += S.s * (1 - k);
  }
  // the loop's slots in the world, and the ledger's excess by name
  const world = rows.filter(r => FL.contextOf(r) === 'world' && r.dt === r.dt);
  for (const s of Object.keys(SLOT_OF)) { const v = world.map(r => r[s]).filter(x => x === x); if (v.length) { const g = row(SLOT_OF[s]); g.frameMs = (g.frameMs || 0) + v.reduce((a, b) => a + b, 0) / v.length; } }
  for (const e of L.entries) {
    if (e.ctx !== 'world') continue;
    const hit = new Set();
    for (const part of e.parts) {
      let f = null; const m = /^loop: (\w+)$/.exec(part.what);
      if (m && SLOT_OF[m[1]]) f = SLOT_OF[m[1]];
      else if (/^premises built/.test(part.what)) f = 'town';
      else { const q = /(?:held on a link|shader link call|first use of \d+ program\(s\)): (.+)$/.exec(part.what); if (q && !/^(UNOWNED|a program)/.test(q[1])) f = featureOf(q[1].split(' + ')[0].split(', ')[0]); }
      if (!f) continue; row(f).freezeMs += part.ms; hit.add(f);
    }
    if (e.ms > 100) for (const f of hit) row(f).freezes++;
  }
  // the measured pairs
  const ab = new Map(); for (const a of (o.ab || [])) ab.set(a.feature, a);
  const d = a => (Array.isArray(a) && a.length === 2 && a[0] != null && a[1] != null) ? r1(a[0] - a[1]) : null;
  const out = [...by.values()].map(g => { const a = ab.get(g.key);
    return { key: g.key, level: g.key.indexOf(' / ') >= 0 ? 'system' : 'feature', programs: r1(g.programs), variants: g.variants.size || null, sourceKB: Math.round(g.kb), sharedWithOtherFeatures: r1(g.shared),
      linkQueueS: r1(g.queueS), maxPendingS: r1(g.maxPendingS), compileStepsS: r1(g.compileS), ownStepsS: r1(g.stepS), ownSteps: g.steps, frameMs: r1(g.frameMs), freezeMs: Math.round(g.freezeMs), freezesOver100: g.freezes,
      lateprograms: r1(g.late), neverDrawn: r1(g.neverDrawn), firstUseMs: Math.round(g.firstUseMs), heldDrawMs: Math.round(g.heldMs),
      boundToFlightS: r1(g.stepS + g.compileS), toGarageS: a ? d(a.toGarageS) : null, toFlightS: a ? d(a.toFlightS) : null,
      evidence: a ? 'measured: ' + (a.toggle || 'on / off') + (a.runs ? ', ' + a.runs + ' runs' : '') + (a.source ? ' (' + a.source + ')' : '') : 'bound only (this log); the marginal delay is UNKNOWN' }; });
  out.sort((x, y) => (y.toFlightS != null ? 1e6 + y.toFlightS : y.boundToFlightS || 0) - (x.toFlightS != null ? 1e6 + x.toFlightS : x.boundToFlightS || 0));
  return { kind: 'flydiy-decision-table', v: 1, log: o.logFile || null, build: H.build || null, gpu: (H.gpu || {}).unmaskedRenderer || null,
    note: 'programs / link queue / compile steps come from the owners the materials declare (program_id.js); own steps and frame ms from what is the feature\'s BY NAME; the marginal delay only from a measured on / off pair',
    totals: { programs: progs.length, unowned: progs.filter(p => p.three && !(p.own && p.own.length)).length, loadStepsS: r1(T.steps.reduce((a, s) => a + (s.s || 0), 0)), worldSeconds: L.contexts.world ? L.contexts.world.seconds : null },
    features: out.filter(r => r.level === 'feature'), systems: out.filter(r => r.level === 'system') };
}

function text(R) {
  const L = [], lp = (s, n) => String(s == null ? '-' : s).padStart(n), pad = (s, n) => String(s == null ? '-' : s).padEnd(n);
  L.push('DECISION TABLE  ' + (R.log || '') + '  build ' + (R.build || '?') + '  ' + (R.gpu || ''));
  L.push('  ' + R.totals.programs + ' programs (' + R.totals.unowned + ' unowned), ' + R.totals.loadStepsS + ' s of loading steps, ' + (R.totals.worldSeconds || 0) + ' s in the world');
  const head = '  ' + pad('', 34) + lp('progs', 6) + lp('var', 5) + lp('KB', 7) + lp('shared', 7) + lp('queue s', 8) + lp('compile', 8) + lp('own steps', 10) + lp('BOUND s', 8) + lp('frame ms', 9) + lp('freeze ms', 10) + lp('>100', 5) + lp('to garage', 10) + lp('to flight', 10) + '  evidence';
  const line = r => '  ' + pad(r.key, 34) + lp(r.programs, 6) + lp(r.variants, 5) + lp(r.sourceKB, 7) + lp(r.sharedWithOtherFeatures, 7) + lp(r.linkQueueS, 8) + lp(r.compileStepsS, 8) + lp(r.ownStepsS, 10) + lp(r.boundToFlightS, 8) + lp(r.frameMs, 9) + lp(r.freezeMs, 10) + lp(r.freezesOver100, 5) +
    lp(r.toGarageS == null ? 'UNKNOWN' : r.toGarageS, 10) + lp(r.toFlightS == null ? 'UNKNOWN' : r.toFlightS, 10) + '  ' + r.evidence;
  L.push(''); L.push('BY FEATURE (queue s = the link queue\'s wall time its programs stand for; BOUND = own steps + its share of the compile steps: what the load cannot gain more than)'); L.push(head);
  for (const r of R.features) L.push(line(r));
  L.push(''); L.push('BY SYSTEM (the 40 largest bounds)'); L.push(head);
  for (const r of R.systems.slice(0, 40)) L.push(line(r));
  return L.join('\n');
}
module.exports = { table, text };

if (require.main === module) {
  const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
  const file = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && ['--out', '--md', '--ab'].includes(argv[i - 1])));
  if (!file) { console.error('usage: node tools/decision_table.js <flightlog.json[.gz]> [--ab pairs.json] [--out table.json] [--md table.md]'); process.exit(2); }
  let appSrc = ''; try { appSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'app.js'), 'utf8'); } catch (e) {}
  const ab = opt('ab', null) ? JSON.parse(fs.readFileSync(opt('ab'), 'utf8')) : [];
  const R = table(AL.load(file), { logFile: path.basename(file), ab, appSrc });
  const out = opt('out', file.replace(/\.json(\.gz)?$/i, '') + '.decision.json');
  fs.writeFileSync(out, JSON.stringify(R, null, 1));
  const txt = text(R); console.log(txt);
  if (opt('md', null)) fs.writeFileSync(opt('md'), '```\n' + txt + '\n```\n');
  console.log('\ndecision_table: ' + out);
}
