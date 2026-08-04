// tools/_zgrad.mjs — THE A3 GATES.
//
// 1. NEUTRAL AT INSERTION. A migrated v2 genome, whose gradient coefficients are
//    both 0, must reproduce its pre-A3 trajectory TO THE BIT. This is the
//    discipline every organ in this project is held to, and it is the only way a
//    schema bump can be trusted: if the migration moved a trajectory even
//    slightly, nothing measured before it could be compared with anything
//    measured after.
//
//    Checked by resolving the phase lags both ways on the SAME plan — once
//    through the live path, once against the raw node genes — rather than by
//    keeping a golden trace, which is how every other determinism assertion in
//    this repo works (self-comparison, no fixture).
//
// 2. COMMANDED COHERENCE. The CPG's own inter-joint coherence, which is what A3
//    exists to raise. Measured on the COMMAND, not on the body, so it is a
//    property of the controller alone and is invariant to the physics — the
//    handoff measured the command/dt ratio at exactly 1.000.
//
//    Baseline 0.615 before A2. After A2 put chains in the corpus it read 0.786,
//    but that average hid the whole story: spines measured 0.96-0.999 and
//    branched bodies 0.08-0.15. A spine was coherent BY ACCIDENT — one node
//    repeated is one lag repeated, which is a constant increment, which is a
//    travelling wave. A3 gives the branched bodies the same thing on purpose.
//
// Run: node tools/_zgrad.mjs [N=16]
import RAPIER from '@dimforge/rapier3d-compat';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { computePhases, targetAngles, makeControl } from '../engine/l1/controller.js';
import { signature } from '../engine/l1/naming.js';
import { assessViability } from '../engine/l1/viability.js';
import { migrate, deserialise } from '../engine/l1/genome.js';
import { W1_RESIDENT_GENOMES, W1_RESIDENT_IDS } from '../worlds/w1_residents.js';
import { rngFrom } from '../trunk/rng.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const N = Number(process.argv[2] ?? 16);

// ── 1. neutrality ───────────────────────────────────────────────────────────
//
// The residents are the real v2 fixtures in the repo, so they are the honest
// subject: load each through the live path and compare the resolved per-joint
// phase lags against the lags the same plan would have had before A3 existed
// (which is exactly the node gene, unmodified).
console.log('\n  1. NEUTRAL AT INSERTION — migrated v2 genomes\n');
let worst = 0, checked = 0;
for (const id of W1_RESIDENT_IDS) {
  const g = deserialise(JSON.stringify(W1_RESIDENT_GENOMES[id]));
  const plan = morphogenesis(g);
  const nodeById = new Map(g.nodes.map((n) => [n.id, n]));
  let d = 0;
  for (const j of plan.joints) {
    // Pre-A3 semantics: the joint's lag IS its node's gene, untouched.
    d = Math.max(d, Math.abs(j.phaseLag - nodeById.get(j.nodeId).joint.phaseLag));
    checked++;
  }
  worst = Math.max(worst, d);
  console.log(`    ${id.padEnd(8)} v${g.version}  phaseBase ${g.controller.phaseBase}`
    + `  phaseSlope ${g.controller.phaseSlope}  max |lag drift| ${d.toExponential(2)}`);
}
console.log(`\n    ${checked} joints checked, worst drift ${worst.toExponential(2)}`
  + (worst === 0 ? '   PASS — bit-identical' : '   FAIL'));

// And the gradient must actually DO something once it is non-zero, or the
// neutrality above would be satisfied by a no-op.
const live = migrate(JSON.parse(JSON.stringify(W1_RESIDENT_GENOMES[W1_RESIDENT_IDS[0]])));
live.controller.phaseBase = 0.7;
const planLive = morphogenesis(live);
const planNeutral = morphogenesis(deserialise(JSON.stringify(W1_RESIDENT_GENOMES[W1_RESIDENT_IDS[0]])));
const moved = planLive.joints.some((j, i) => j.phaseLag !== planNeutral.joints[i].phaseLag);
console.log(`    a non-zero phaseBase changes the resolved lags: ${moved ? 'yes   PASS' : 'NO — the gene is inert   FAIL'}`);

// ── 2. commanded coherence ──────────────────────────────────────────────────
//
// Same corpus construction as tools/_zcoh.mjs so the numbers are comparable.
const corpus = [];
for (let i = 0; corpus.length < N && i < N * 10; i++) {
  const g = createRandomGenome(rngFrom('decay', 'corpus', i));
  const v = assessViability(RAPIER, g, W1_SLICE);
  if (v.ok && v.plan.jointCount >= 3) corpus.push({ genome: g, plan: v.plan });
}

function corr(a, b) {
  const n = a.length; let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let sa = 0, sb = 0, sab = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; sa += x * x; sb += y * y; sab += x * y; }
  return sa > 1e-12 && sb > 1e-12 ? sab / Math.sqrt(sa * sb) : NaN;
}

// The COMMAND alone: sample targetAngles over 30 s at 10 Hz. No physics, so this
// is the controller's own coherence and nothing else.
const SEC = 30, HZ = 10, NS = SEC * HZ;
const rows = [];
for (const { genome, plan } of corpus) {
  const phases = computePhases(plan);
  const J = plan.jointCount;
  const tr = Array.from({ length: J }, () => new Float64Array(NS));
  const out = new Float64Array(J);
  const control = makeControl(plan, { effort: 1, turnBias: 0 });
  for (let s = 0; s < NS; s++) {
    targetAngles(plan, genome, s / HZ, phases, out, control);
    for (let j = 0; j < J; j++) tr[j][s] = out[j];
  }
  // SPLIT BY freqMult. Two joints running at different multiples of omega are
  // uncorrelated no matter what their phases are — sin(wt) against sin(2wt)
  // integrates to zero over a period — so a phase gradient cannot raise a pair
  // that does not share a frequency. Separating them says whether the residual
  // gap to 0.90 is A3's to close at all.
  let acc = 0, n = 0, accSame = 0, nSame = 0, accDiff = 0, nDiff = 0;
  const fm = (i) => genome.controller.jointGenes[plan.joints[i].nodeId].freqMult;
  for (let j = 0; j + 1 < J; j++) {
    const r = corr(tr[j], tr[j + 1]);
    if (!Number.isFinite(r)) continue;
    acc += Math.abs(r); n++;
    if (fm(j) === fm(j + 1)) { accSame += Math.abs(r); nSame++; }
    else { accDiff += Math.abs(r); nDiff++; }
  }
  let run = 0;
  try { run = signature(plan, genome).longestRun; } catch { /* 0 */ }
  if (n) rows.push({ J, run, coh: acc / n, same: nSame ? accSame / nSame : NaN, diff: nDiff ? accDiff / nDiff : NaN, pSame: nSame / n });
}

const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
const spined = rows.filter((r) => r.run >= 4), branched = rows.filter((r) => r.run < 4);

console.log('\n  2. COMMANDED INTER-JOINT COHERENCE\n');
console.log('     J  run   coherence');
for (const r of rows) {
  console.log('    ' + String(r.J).padStart(2) + String(r.run).padStart(5) + '   ' + r.coh.toFixed(3));
}
const overall = med(rows.map((r) => r.coh));
console.log(`\n    median, all (n=${rows.length})        ${overall.toFixed(3)}   (0.615 pre-A2, 0.786 post-A2, target >= 0.90)`);
if (spined.length) console.log(`    median, spines (n=${spined.length})       ${med(spined.map((r) => r.coh)).toFixed(3)}`);
if (branched.length) console.log(`    median, branched (n=${branched.length})     ${med(branched.map((r) => r.coh)).toFixed(3)}   <- what A3 is for`);
console.log(`\n    ${overall >= 0.90 ? 'PASS' : 'BELOW TARGET'}`);

const fin = (k) => rows.map((r) => r[k]).filter(Number.isFinite);
console.log('\n    BY FREQUENCY MATCH — can a phase gradient reach these pairs at all?');
console.log(`      adjacent pairs sharing freqMult   ${(100 * med(rows.map((r) => r.pSame))).toFixed(0)}%`);
console.log(`      coherence, SAME freqMult          ${med(fin('same')).toFixed(3)}`);
console.log(`      coherence, DIFFERENT freqMult     ${med(fin('diff')).toFixed(3)}   <- phase cannot fix this`);
console.log('');
