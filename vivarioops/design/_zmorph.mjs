// _zmorph.mjs — census of the ACTUAL morphospace the factory produces.
// No hypotheses. Just: what shapes are we making, numerically?
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { assessViability } from '../engine/l1/viability.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
// ONE CORPUS, ONE SEED FAMILY, ONE n, ACROSS ALL FOUR _z SCRIPTS — and the n is
// printed. The first version of this set mixed rngFrom('decay','corpus',i) at
// n=10-12 against rngFrom('morph','census',i) at n=120 and printed both into a
// single table described as "a fresh corpus, this build".
const N = Number(process.argv[2] ?? 120);
const gen = [], viable = [];
let tried = 0;
while (viable.length < N && tried < N * 20) {
  const g = createRandomGenome(rngFrom('morph', 'census', tried++));
  gen.push(g);
  const v = assessViability(RAPIER, g, W1_SLICE);
  if (v.ok) viable.push({ g, plan: v.plan });
}
const pc = (a, q) => { const b = a.filter(Number.isFinite).sort((x,y)=>x-y); return b.length ? b[Math.min(b.length-1, Math.floor(q*b.length))] : NaN; };
const f = (x) => Number.isFinite(x) ? x.toFixed(3) : ' n/a ';
const line = (lbl, a) => console.log(`${lbl.padEnd(30)} p10 ${f(pc(a,0.1))}  p50 ${f(pc(a,0.5))}  p90 ${f(pc(a,0.9))}`);

console.log(`viable ${viable.length} / ${tried} tried  (accept ${(viable.length/tried*100).toFixed(0)}%)\n`);

// --- per-body shape ---
const aspect = [], minDim = [], sv = [];
for (const {plan} of viable) for (const b of plan.bodies) {
  const d = b.dims, mx = Math.max(...d), mn = Math.min(...d);
  aspect.push(mx/mn); minDim.push(mn);
  const [x,y,z] = d;
  sv.push(2*(x*y+y*z+z*x) / (x*y*z));
}
console.log('BODY SHAPE');
line('  aspect ratio max/min', aspect);
line('  min half-thickness (cm)', minDim.map(x=>x/2));
line('  surface/volume (1/cm)', sv);

// --- body count / chain structure ---
const nb = viable.map(v=>v.plan.bodies.length), nj = viable.map(v=>v.plan.jointCount);
// DEPTH IS RECOMPUTED FROM THE JOINT LIST, not read from plan.bodies[].depth.
// That field is PER NODE TYPE (morphogen.js:105) — it resets to 0 whenever the
// chain moves to a different node and increments only on self-reference — so
// `max(b.depth)` is not tree depth and this line used to print near-zeros for
// every creature. A different quantity that happens to share a name.
const treeDepth = (plan) => {
  const parent = new Array(plan.bodies.length).fill(-1);
  for (const j of plan.joints) parent[j.childBody] = j.parentBody;
  return Math.max(...plan.bodies.map((_, i) => { let d = 0, k = i; while (parent[k] >= 0) { k = parent[k]; d++; } return d; }));
};
const depth = viable.map(v => treeDepth(v.plan));
console.log('\nSTRUCTURE');
line('  bodies per creature', nb);
line('  joints per creature', nj);
line('  max TREE depth (recomputed)', depth);

// --- symmetry ---
let anyRefl = 0, reflConn = 0, totConn = 0;
for (const {g} of viable) {
  let has = false;
  for (const c of g.connections) { totConn++;
    if (c.reflectX||c.reflectY||c.reflectZ) { reflConn++; has = true; } }
  if (has) anyRefl++;
}
console.log('\nSYMMETRY');
console.log(`  creatures with >=1 reflected connection : ${anyRefl}/${viable.length}  (${(anyRefl/viable.length*100).toFixed(0)}%)`);
console.log(`  connections carrying a reflection       : ${reflConn}/${totConn}  (${(reflConn/totConn*100).toFixed(0)}%)`);

// --- attachment position: centre or corner? ---
const posMag = [];
for (const {g} of viable) for (const c of g.connections) posMag.push(Math.hypot(c.position[0], c.position[1]));
console.log('\nATTACHMENT (0 = face centre, 1.41 = corner)');
line('  |position| on parent face', posMag);

// --- scale: does the chain taper, or wander? ---
//
// MEASURED FROM THE BUILT PLAN, NOT FROM `c.scale`. Since GENOME_V 6 the drawn
// per-axis scales are not the ones applied: `taperScale` pulls them toward their
// geometric mean and adds a per-depth gradient at morphogenesis. Reading
// `g.connections[].scale` here reported the DRAWN value and showed the taper
// having no effect at all — a measurement of the input, presented as a
// measurement of the output.
//
// `cumulativeScale` is the running product down the chain, so the effective scale
// applied at one connection is the child's divided by the parent's, per axis.
const scaleAnisoDrawn = [], scaleAniso = [], scaleMean = [];
for (const {g} of viable) for (const c of g.connections) {
  const s = c.scale;
  scaleAnisoDrawn.push(Math.max(...s) / Math.min(...s));
}
for (const {plan} of viable) for (const b of plan.bodies) {
  if (b.parent < 0) continue;
  const p = plan.bodies[b.parent];
  const s = [0, 1, 2].map(k => b.cumulativeScale[k] / p.cumulativeScale[k]);
  const mx = Math.max(...s), mn = Math.min(...s);
  if (!(mn > 0)) continue;
  scaleAniso.push(mx / mn);
  scaleMean.push(Math.cbrt(s[0] * s[1] * s[2]));
}
console.log('\nSCALE PER CONNECTION');
line('  anisotropy DRAWN (gene)', scaleAnisoDrawn);
line('  anisotropy APPLIED (body)', scaleAniso);
line('  mean scale (1 = no change)', scaleMean);

// --- parent-child geometric relation: overlap, abut, or float? ---
import { morphogenesis, obbOverlap } from '../engine/l1/morphogen.js';
let over = 0, tot = 0, gaps = [];
for (const {plan} of viable) {
  for (const j of plan.joints) {
    const A = plan.bodies[j.parentBody], B = plan.bodies[j.childBody];
    const boxA = { position: A.position, rotation: A.rotation, dims: A.dims };
    const boxB = { position: B.position, rotation: B.rotation, dims: B.dims };
    tot++;
    if (obbOverlap(boxA, boxB)) over++;
    const d = Math.hypot(A.position[0]-B.position[0], A.position[1]-B.position[1], A.position[2]-B.position[2]);
    const rA = 0.5*Math.min(...A.dims), rB = 0.5*Math.min(...B.dims);
    gaps.push(d - (rA + rB));   // >0 suggests a gap between the inscribed cores
  }
}
console.log('\nPARENT-CHILD GEOMETRY (rest pose)');
console.log(`  pairs whose OBBs overlap : ${over}/${tot}  (${(over/tot*100).toFixed(0)}%)`);
line('  centre dist - core radii', gaps);
