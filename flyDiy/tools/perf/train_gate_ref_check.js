#!/usr/bin/env node
// train_gate_ref_check.js - THE FIXED REFERENCE'S OWN CHECK (PERF-1 P1, no browser, seconds): synthetic gate JSONs through
// train_gate.js's compareRef / takeReference / printRef, in a scratch folder (TRAIN_GATE_REF_DIR) - never the real reference.
//   1. a reference is taken from a clean, complete run; a second take without the user's ruling is refused
//   2. a run on another GPU, viewport, Chrome, DPR, settings or --secs is NOT COMPARED; a run missing one is INCOMPLETE
//   3. FOUR TRAINS of +0.3 ms loop - each inside the per-train slack (0.8 ms) - are RED against the reference from the second
//      (+0.6 > the 0.5 ms cumulative budget): the slide the per-train gate cannot see
//   4. a ledger entry admits its amount until it expires; an expired one admits nothing
//   5. the reference's rule is FROZEN: a slack widened after the take does not forgive a row
//   node tools/perf/train_gate_ref_check.js     (exit 0: every check passed)
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tgref-'));
process.env.TRAIN_GATE_REF_DIR = DIR;
const TG = require('./train_gate.js');
let bad = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) bad++; };
const ENV = { gpu: 'ANGLE (NVIDIA RTX 3080)', size: '2216x1023', ua: 'Chrome/141', dpr: 1, settings: '{"preset":"gamer"}', flags: '[]', cap: 30,
  mode: 'light', secs: 20, reps: 1, glReps: 2, cold: false, remote: 'mn_strip', parts: 'bench,garage,rollout', rules: 'r1', aircraft: 'a,b,c' };
const CODE = { commit: 'aaaaaaa', source: 's', dirty: false, build: 'b', page: 'p', packs: 'k', cook: 'b' };
const rows = (loop, p99) => [
  { id: 'rollout|cub chase|loop', part: 'rollout', what: 'cub chase loop', value: loop, rule: { up: false, rel: 0.10, abs: 0.8, unit: 'ms' } },
  { id: 'rollout|cub chase|render', part: 'rollout', what: 'cub chase render', value: 13.1, rule: { up: false, rel: 0.10, abs: 0.6, unit: 'ms' } },
  { id: 'rollout|cub chase|p99all', part: 'rollout', what: 'cub chase p99all', value: p99, rule: { up: false, rel: 0.10, abs: 17, unit: 'ms' } },
  { id: 'bench|cub warm navigation -> garage|sec', part: 'bench', what: 'cub warm navigation -> garage', value: 67.4, rule: { rel: 0.10, abs: 4, unit: 's' } } ];
const gate = (loop, env, extra) => ({ meta: Object.assign({ date: '2026-10-18T09:30:00Z', commit: 'aaaaaaa', mode: 'light', parts: ['rollout', 'garage', 'bench'], steps: [],
  identity: { env: Object.assign({}, ENV, env || {}), code: CODE } }, extra || {}), rows: rows(loop, 50) });
// 1. the take
const ref0 = gate(18.9);
TG.takeReference(ref0, null);
const RF = path.join(DIR, 'train_gate_reference_light.json'), Ref = JSON.parse(fs.readFileSync(RF, 'utf8'));
ok(Ref.rows.length === 4 && Ref.identity.env.gpu === ENV.gpu && Ref.budgets.length >= 3, 'the reference is written with its identity, rows and budgets');
// 2. identity
for (const [k, v] of [['gpu', 'GTX 1660 Ti'], ['size', '1920x1080'], ['ua', 'Chrome/142'], ['dpr', 1.25], ['settings', '{"preset":"current"}'], ['secs', 25], ['rules', 'r2']]) {
  const C = TG.compareRef(gate(18.9, { [k]: v }), Ref, []);
  ok(C.refuse && C.refuse.some(x => x.startsWith(k)), 'another ' + k + ' is NOT COMPARED');
}
{ const C = TG.compareRef(gate(18.9, { ua: null }), Ref, []); ok(C.incomplete && C.incomplete.includes('ua'), 'a run without its Chrome is INCOMPLETE'); }
{ const C = TG.compareRef(gate(18.9, { settings: 'MIXED' }), Ref, []); ok(C.incomplete && C.incomplete.includes('settings'), 'a run whose settings differ run to run is INCOMPLETE'); }
{ const G = gate(18.9); delete G.meta.identity; ok(TG.compareRef(G, Ref, []).incomplete, 'a gate JSON from before PERF-1 is INCOMPLETE'); }
// 3. the slide: four trains, +0.3 ms each - the per-train compare passes every one, the reference catches the climb
let prev = ref0, caughtAt = 0;
for (let t = 1; t <= 4; t++) {
  const G = gate(+(18.9 + 0.3 * t).toFixed(2));
  const per = TG.compare(G, prev), C = TG.compareRef(G, Ref, []);
  ok(per.red.length === 0, 'train ' + t + ' (+0.3 ms on the last) passes the per-train gate');
  if (!caughtAt && C.red.some(r => r.id === 'rollout|cub chase|loop')) caughtAt = t;
  prev = G;
}
ok(caughtAt === 2, 'the reference turns the loop RED at the 2nd step (+0.6 ms > the 0.5 ms cumulative budget), caught at ' + caughtAt);
// 4. the ledger
const L = [{ id: 'rollout|cub chase|loop', add: 0.5, owner: 'test', train: 't99', ruling: 'synthetic', expires: '2999-01-01' }];
{ const C = TG.compareRef(gate(19.7), Ref, L); ok(!C.red.length && C.ledger.length === 1, '+0.8 ms with a 0.5 ms ledger entry: admitted, listed'); }
{ const C = TG.compareRef(gate(20.0), Ref, L); ok(C.red.length === 1, '+1.1 ms past budget + ledger: RED'); }
{ const C = TG.compareRef(gate(19.7), Ref, [Object.assign({}, L[0], { expires: '2020-01-01' })]); ok(C.red.length === 1, 'an expired ledger entry admits nothing'); }
// 5. the frozen rule: today's render slack widened to 5 ms does not apply - the reference's 1.31 ms does
{ const G = gate(18.9); G.rows[1].value = 15.0; G.rows[1].rule = { up: false, rel: 0, abs: 5, unit: 'ms' };
  const C = TG.compareRef(G, Ref, []); ok(C.red.some(r => r.id === 'rollout|cub chase|render'), 'render +1.9 ms is RED under the frozen 1.31 ms slack, whatever today\'s rule says'); }
// the box/gamer targets: p99 over 50 listed, not red
{ const G = gate(18.9); G.rows[2].value = 66.7; const C = TG.compareRef(G, Ref, []); ok(C.targets.length === 1 && !C.red.length, 'p99 66.7 ms is listed against the 50 ms target (inside its frozen 17 ms slack: not red)'); }
// GATE-ANCHOR: the per-train compare skips a rollout GROUP the run did not run (the metal Cessna's legs, replaced by the
// Cessna 172), and still reds a row lost from a group it ran
{ const B = gate(18.9); B.rows.push({ id: 'rollout|metal chase|loop', part: 'rollout', what: 'metal chase loop', value: 19.0, rule: { up: false, rel: 0.10, abs: 0.8, unit: 'ms' } });
  const G = gate(18.9); G.meta.groups = ['cub chase'];
  const C = TG.compare(G, B); ok(!C.red.length && C.skipped === 1, 'a baseline row of a group not run (metal chase) is skipped (' + C.skipped + '), not MISSING');
  const G2 = gate(18.9); G2.meta.groups = ['cub chase']; G2.rows = G2.rows.filter(r => !/\|render$/.test(r.id));
  ok(TG.compare(G2, B).red.some(r => /render/.test(r.id)), 'a row lost from a group the run ran is still MISSING'); }
fs.rmSync(DIR, { recursive: true, force: true });
console.log(bad ? '\nTRAIN GATE REFERENCE CHECK: ' + bad + ' FAILED' : '\nTRAIN GATE REFERENCE CHECK: PASS');
process.exit(bad ? 1 : 0);
