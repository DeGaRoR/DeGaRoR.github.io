#!/usr/bin/env node
// fleet_b_table.js - FLEET-PROPS B (G2225): the slot's numbers, read off the runs' own files, into one table and
// numbers.json (each row labelled with the tree, the build, the preset, the mode). No browser.
//   node tools/perf/fleet_b_table.js <evidence dir> [--tree <sha>]
// Per preset: the roll-out runs (rollout_perf + fleet_b_eval: 0 = the flag off, 3 and 6 props) - the taxi's delivered fps,
// p99, loop / render ms, the GPU timer's median and p90 (FLIGHT_REC, taxi frames), draws, the air's if any; the ROLL-OUT
// SCREEN's long tasks (from the garage's end to the reveal: count, sum, worst) and the boot's; the fleet as it stood. The
// stills (fleet_b still --timed): the same held frame with the fleet shown / hidden, per view, GPU and draws.
'use strict';
const fs = require('fs'), path = require('path');
const DIR = path.resolve(process.argv[2] || '.');
const tree = (i => (i > 0 ? process.argv[i + 1] : null))(process.argv.indexOf('--tree'));
const rd = f => { try { return JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { return null; } };
const out = { tree, made: new Date().toISOString(), runs: {}, stills: {} };
const lines = [];
for (const p of ['retro', 'gamer', 'potato']) {
  for (const n of ['off', '3', '6']) {
    const j = rd('rp_' + p + '_' + n + '.json'); if (!j) continue;
    const e = typeof j.eval === 'string' ? JSON.parse(j.eval) : j.eval;
    const tx = j.phases && j.phases.taxi, st = j.phases && j.phases.stand;
    const g0 = (j.tGarage || 0) * 1000, g1 = g0 + (j.tReveal || 0) * 1000;
    const LT = (j.longTasks || []);
    const roll = LT.filter(t => t[0] >= g0 && t[0] <= g1 + 500), boot = LT.filter(t => t[0] < g0);
    const sum = a => a.reduce((s, t) => s + t[1], 0), worst = a => a.reduce((m, t) => Math.max(m, t[1]), 0);
    const r = {
      label: j.label, tree, build: e && e.build, preset: p, props: n === 'off' ? 0 : +n, flag: n !== 'off', mode: 'rollout_perf HOME/CIRCUIT chase, the Cub (builds/cub_2026-09-20_corrected.json), 90 s, TIMED',
      gpu: j.gpu, tGarage: j.tGarage, tReveal: j.tReveal,
      taxi: tx ? { fps: tx.fpsDelivered, p99: tx.dtP99, max: tx.dtMax, loopJS: tx.workMed, render: tx.renderMed, renderP90: tx.renderP90, frames: tx.frames } : null,
      stand: st ? { fps: st.fpsDelivered, p99: st.dtP99, max: st.dtMax, render: st.renderMed } : null,
      gpuTaxi: e && e.taxi ? { med: e.taxi.gpu, p90: e.taxi.gpuP90, calls: e.taxi.calls, tris: e.taxi.tris, n: e.taxi.gpuN } : null,
      gpuAir: e && e.air && e.air.n ? { med: e.air.gpu, p90: e.air.gpuP90, n: e.air.gpuN } : null,
      rollout: { tasks: roll.length, sumMs: sum(roll), worstMs: worst(roll), list: roll },
      boot: { tasks: boot.length, sumMs: sum(boot), worstMs: worst(boot) },
      fleet: e && e.stand ? { stood: e.stand.n, held: e.stand.stats && e.stand.stats.held, miss: e.stand.stats && e.stand.stats.miss, waitMs: e.stand.stats && e.stand.stats.waitMs,
        decodes: e.fleet && e.fleet.stats.decodes, captures: e.fleet && e.fleet.stats.captures, levels: (e.holders || []).map(h => h.slot.replace('fleet-', '') + ':' + h.level).join(' ') } : null,
    };
    out.runs[p + '_' + n] = r;
    lines.push([p, n === 'off' ? '0 (off)' : n, r.taxi ? r.taxi.fps : '-', r.taxi ? r.taxi.p99 : '-', r.taxi ? r.taxi.loopJS : '-', r.taxi ? r.taxi.render : '-',
      r.gpuTaxi && r.gpuTaxi.med != null ? r.gpuTaxi.med : 'n/a', r.gpuTaxi ? r.gpuTaxi.calls : '-', r.rollout.tasks + ' / ' + r.rollout.sumMs + ' / ' + r.rollout.worstMs,
      r.fleet ? r.fleet.stood + (r.fleet.decodes != null ? ' (dec ' + r.fleet.decodes + ', cap ' + r.fleet.captures + ')' : '') : '-'].join(' | '));
  }
  const s = rd('still_' + p + '.json');
  if (s) out.stills[p] = { tree, build: s.stateEnd && s.stateEnd.build, preset: p, mode: 'fleet_b still --timed: the SAME held frame, the fleet group shown / hidden, ' + (s.rounds || []).length / 4 + ' rounds a view, 60 frames each', summary: s.summary, close: s.close, near: s.near };
}
fs.writeFileSync(path.join(DIR, 'numbers.json'), JSON.stringify(out, null, 1));
console.log('preset | props | taxi fps | p99 ms | loop JS | render | GPU taxi ms | draws | roll-out tasks n / sum / worst ms | fleet');
for (const l of lines) console.log(l);
for (const p of Object.keys(out.stills)) for (const v of Object.keys(out.stills[p].summary || {})) { const x = out.stills[p].summary[v];
  console.log('still ' + p + ' ' + v + ': GPU ' + x.gpuOff + ' -> ' + x.gpuOn + ' ms (' + (x.dGpu >= 0 ? '+' : '') + x.dGpu + '), draws ' + x.callsOff + ' -> ' + x.callsOn + ', tris ' + x.trisOff + ' -> ' + x.trisOn + ', in view ' + x.inView + ' [' + x.levels + ']'); }
console.log('-> ' + path.join(DIR, 'numbers.json'));
