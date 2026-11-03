#!/usr/bin/env node
// newplane_validate.js — THE ONE-TIME VALIDATION of the new-aeroplane generator (NEW-PLANE, 3 Nov 2026).
//
// The user: "Mathematically, you won't be able to test them all ... Propose a plan to test in a reasonable amount of
// time our generations" · "I will accept a test once, then small recurring tests. Our battery is already much too
// heavy." THIS IS THE ONCE: run in the cloud before the ready, its result written into
// reports/evidence/NEW-PLANE/STATUS.md. It is NOT in tools/run_gates.js and must not be added (GATE NEWPLANE,
// tools/_newplane_check.js, is the small recurring one). Rerun it by hand after a change to the generator's rules.
//
//   node tools/newplane_validate.js [--jobs=3] [--out=<file.jsonl>] [--only=arch|pair|ext] [--no-hop] [--resume]
//
// THE SET (~95 builds, ~25 s each on the cloud box with the hop, sharded over --jobs processes):
//   arch    every archetype's choice set, read back off its card (fromArchetype): 32
//   pair    a PAIRWISE COVERING ARRAY over the choices, constraint-aware: every offered (row = a, row' = b) pair in at
//           least one build, built greedily in step order so a greyed option is never asked (~50); the colour rotates
//           (cosmetic, kept out of the pairs)
//   ext     the extremes: the smallest and the largest, every engine count on its class, the turbine, the sailplane,
//           the biplane with open cockpits, floats under three engines... (~14)
// Each build is _newplane_lib.js judge(): builds, joins (engines drawn = flown), design check, green margin, stance,
// circuit-capable, a short hop (60 m in 120 s). One JSON line per build; a summary at the end.
'use strict';
const fs = require('fs'), path = require('path');
const { spawn } = require('child_process');
const T = __dirname;
const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };

function theSet() {
  const NL = require('./_newplane_lib.js'); NL.init();
  const NP = require('./_new_plane.js'), D = require('./_cage_design.js');
  const list = [];
  for (const a of D.ARCHETYPES) list.push({ id: 'arch:' + a.key, set: 'arch', ch: NP.fromArchetype(a), authored: NP.authored(a) });
  // ---- the pairwise covering array --------------------------------------------------------------------------------
  const rows = NP.ROW_KEYS.filter(k => k !== 'colour');
  const key = (r1, v1, r2, v2) => r1 + '=' + v1 + '|' + r2 + '=' + v2;
  const uncovered = new Set();
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++)
    for (const a of NP.optsOf(rows[i])) for (const b of NP.optsOf(rows[j])) if (!a.inactive && !b.inactive) uncovered.add(key(rows[i], a.value, rows[j], b.value));
  let seed = 7;
  const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return (seed >>> 8) / 16777216; };
  const sw = NP.SWATCHES;
  let n = 0, stall = 0;
  while (uncovered.size && n < 90 && stall < 6) {
    let best = null, bestGain = -1;
    for (let cand = 0; cand < 40; cand++) {
      const ch = {};
      for (const r of rows) {
        const live = NP.optsOf(r).filter(o => !NP.why(ch, r, o.value));
        if (!live.length) continue;
        let pick = null, pg = -1;
        for (const o of live) {
          let g = 0;
          for (const r2 of Object.keys(ch)) { const i1 = rows.indexOf(r2), i2 = rows.indexOf(r);
            const k = i1 < i2 ? key(r2, ch[r2], r, o.value) : key(r, o.value, r2, ch[r2]); if (uncovered.has(k)) g++; }
          g += rnd() * 0.9;
          if (g > pg) { pg = g; pick = o.value; }
        }
        ch[r] = pick;
      }
      let gain = 0;
      for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++)
        if (uncovered.has(key(rows[i], ch[rows[i]], rows[j], ch[rows[j]]))) gain++;
      if (gain > bestGain) { bestGain = gain; best = ch; }
    }
    if (bestGain <= 0) { stall++; continue; }
    for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) uncovered.delete(key(rows[i], best[rows[i]], rows[j], best[rows[j]]));
    best.colour = sw[n % sw.length][1];
    list.push({ id: 'pair:' + (++n), set: 'pair', ch: best });
  }
  const pairInfo = { builds: n, pairsLeft: uncovered.size, left: [...uncovered].slice(0, 40) };
  // ---- the extremes -----------------------------------------------------------------------------------------------
  const EXT = [
    ['smallest', { class: 'ul1', body: 'open', booms: 'rod', engArch: 'wingTop', engType: 'inline', wing: 'high', gear: 'trike' }],
    ['largest', { class: 'n23', engArch: 'four', bays: 4, wing: 'high', planform: 'rect', gear: 'trike', engType: 'flat' }],
    ['three on floats', { class: 'n23', engArch: 'three', gear: 'floats', wing: 'mid' }],
    ['twin bush', { class: 'n23', engArch: 'twin', bays: 4, mission: 'cargo', gear: 'trike', wing: 'high' }],
    ['push-pull', { class: 'n23', engArch: 'pushPull', booms: 'twin', gear: 'trike', wing: 'high' }],
    ['turboprop', { class: 'n23', engType: 'turbine', gear: 'trike', bays: 4, wing: 'high', planform: 'hershey' }],
    ['radial biplane', { class: 'n23', engType: 'radial', wing: 'biplane', top: 'open', bays: 1, gear: 'tail' }],
    ['vee elliptic', { class: 'eab', engType: 'vee', wing: 'low', planform: 'elliptic', bracing: 'cantilever', gear: 'tail', canopy: 'bubble', top: 'turtle' }],
    ['sailplane', { class: 'sail', engType: 'electric', wing: 'mid', planform: 'taper', tail: 't', fin: 'tall' }],
    ['sail pusher', { class: 'sail', engArch: 'pusher', engType: 'electric', wing: 'high' }],
    ['ul1 twin floats', { class: 'ul1', engArch: 'twin', gear: 'floats', engType: 'inline', booms: 'rod' }],
    ['lsa electric pusher', { class: 'lsa', engArch: 'pusher', engType: 'electric', booms: 'twin' }],
    ['eab swept low', { class: 'eab', wing: 'low', planform: 'swept', gear: 'trike', engType: 'flat', top: 'turtle', canopy: 'bubble' }],
    ['ulm cranked parasol', { class: 'ulm', wing: 'parasol', planform: 'cranked', gear: 'tail', engType: 'flat' }],
  ];
  for (const [nm, ch] of EXT) list.push({ id: 'ext:' + nm, set: 'ext', ch });
  return { list, pairInfo };
}

if (argv.includes('--child')) {
  const shard = +arg('shard', 0), of = +arg('of', 1);
  const NL = require('./_newplane_lib.js');
  const { list } = theSet();
  const only = arg('only', null);
  const skip = new Set((process.env.NEWPLANE_SKIP || '').split('\n').filter(Boolean));
  const mine = list.filter((x, i) => i % of === shard && (!only || x.set === only) && !skip.has(x.id));
  for (const x of mine) {
    let r;
    try { r = NL.judge(x.ch, { hop: !argv.includes('--no-hop') }); }
    catch (e) { r = { ok: false, fails: ['crash: ' + String(e && e.message || e).slice(0, 200)], m: {}, ms: 0 }; }
    process.stdout.write(JSON.stringify({ id: x.id, set: x.set, authored: !!x.authored, ok: r.ok, fails: r.fails, m: r.m, choices: r.choices || x.ch, ms: r.ms }) + '\n');
  }
  process.exit(0);
}

(async () => {
  const jobs = +arg('jobs', 3);
  const out = arg('out', path.join(T, '..', 'reports', 'evidence', 'NEW-PLANE', 'validation.jsonl'));
  const { list, pairInfo } = theSet();
  console.log('NEW-PLANE VALIDATION: ' + list.length + ' builds (' + list.filter(x => x.set === 'arch').length + ' archetypes, ' +
    pairInfo.builds + ' pairwise - ' + pairInfo.pairsLeft + ' feasible-looking pairs never offered together, ' +
    list.filter(x => x.set === 'ext').length + ' extremes), ' + jobs + ' jobs');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  // --resume: the builds already in the log are kept and skipped (a restarted container, a killed run)
  let done = [];
  if (argv.includes('--resume') && fs.existsSync(out))
    done = fs.readFileSync(out, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l).id);
  else fs.writeFileSync(out, '');
  if (done.length) console.log('resuming: ' + done.length + ' builds already in ' + out);
  const t0 = Date.now();
  const pass = argv.filter(a => a === '--no-hop' || a.startsWith('--only='));
  await Promise.all(Array.from({ length: jobs }, (_, i) => new Promise(res => {
    const p = spawn(process.execPath, ['--max-old-space-size=4096', __filename, '--child', '--shard=' + i, '--of=' + jobs].concat(pass),
      { cwd: T, env: Object.assign({}, process.env, { NEWPLANE_SKIP: done.join('\n') }) });
    let buf = '';
    p.stdout.on('data', d => { buf += d; let k; while ((k = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, k); buf = buf.slice(k + 1);
      if (!line.startsWith('{')) continue; fs.appendFileSync(out, line + '\n'); const j = JSON.parse(line);
      console.log((j.ok ? 'ok   ' : 'FAIL ') + j.id.padEnd(28) + ' ' + (j.ms / 1000).toFixed(0).padStart(3) + ' s  ' + j.fails.join(' | ').slice(0, 300)); } });
    p.on('close', res);
  })));
  const rows = fs.readFileSync(out, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
  const by = {};
  for (const r of rows) for (const f of r.fails) { const k = f.split(':')[0]; by[k] = (by[k] || 0) + 1; }
  console.log('DONE ' + rows.length + ' builds, ' + rows.filter(r => r.ok).length + ' clean, in ' + ((Date.now() - t0) / 60000).toFixed(1) + ' min; failures by kind: ' + JSON.stringify(by));
  fs.writeFileSync(out.replace(/\.jsonl$/, '_pairs.json'), JSON.stringify(pairInfo, null, 1));
})();
