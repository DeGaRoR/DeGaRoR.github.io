// IS THE SEEK SCORE A STEERING MEASURE, OR A SPEED PROXY IN DISGUISE?
//
// _capability.mjs found seek score spreads well (CV 0.85) but correlates 0.90
// with netSpeed and -0.02 with the sensor gene. That is the shape of a metric
// that measures swimming, not seeking: a fast creature closes distance on a
// target at any bearing simply by covering ground.
//
// Selecting on it would breed fast swimmers and leave the sensor gain drifting
// — the same trap as "displacement-only selection breeds efficient thrashers",
// one level up.
//
// Two things to separate:
//   1. Can the GENE move the score at all, on a fixed body? (plant question)
//   2. Does a CONTROL-SUBTRACTED score isolate steering? (objective question)
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { DRIVE, sensorTurnBias } from '../engine/l1/controller.js';
import { SEEDS } from '../worlds/seeds.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const W = { ...W1_SLICE, gravity: 0 };
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const MOTOR = { motor: 'solver' };

function seek(plan, genome, { plane='bend', R=6, SEC=30, gainOverride=null,
                             bearings=[0,60,120,180,240,300] } = {}) {
  const [A,B] = plane === 'yaw' ? [0,2] : [2,1];
  const sc = [];
  for (const deg of bearings) {
    let sim;
    try { sim = createSimulation(RAPIER, plan, genome, W, { drive: DRIVE.POSITION, bounded:false, ...MOTOR }); }
    catch { return null; }
    const c0 = sim.centreOfMass(), th = deg*Math.PI/180;
    const target = [...c0]; target[A] += R*Math.cos(th); target[B] += R*Math.sin(th);
    let best = R, bad = false, prev = c0, va = 0, vb = 0;
    try { for (let s=0;s<Math.round(SEC/FIXED_DT);s++){
      const c = sim.centreOfMass(); if(!Number.isFinite(c[0]+c[1]+c[2])){bad=true;break;}
      va = 0.98*va + 0.02*(c[A]-prev[A]); vb = 0.98*vb + 0.02*(c[B]-prev[B]);
      const ta = target[A]-c[A], tb = target[B]-c[B];
      if (Math.hypot(va,vb)>1e-7 && Math.hypot(ta,tb)>1e-4) {
        const bearing = wrap(Math.atan2(tb,ta)-Math.atan2(vb,va))/Math.PI;
        sim.control.turnBias = gainOverride === null
          ? sensorTurnBias(genome, bearing, bearing)
          : Math.max(-1, Math.min(1, gainOverride*bearing));
      }
      prev = c;
      const d = Math.hypot(target[0]-c[0],target[1]-c[1],target[2]-c[2]); if(d<best)best=d;
      sim.step(); } } catch { bad = true; }
    sim.free(); if (bad) return null;
    sc.push(Math.max(0,(R-best)/R));
  }
  return sc.reduce((a,b)=>a+b,0)/sc.length;
}

// ── 1. can the gene move the score on a FIXED body? ─────────────────────────
console.log('\n=== 1. GAIN SWEEP on fixed bodies (plant question) ===\n');
console.log('  body          ' + [-1,-0.5,0,0.5,1,2].map(g=>String(g).padStart(8)).join('') + '     range');
for (const s of SEEDS.filter(x=>['eel','eel-finned','eel-slow'].includes(x.id))) {
  const p = morphogenesis(s.genome);
  const v = [-1,-0.5,0,0.5,1,2].map(g => seek(p, s.genome, { gainOverride: g }));
  if (v.some(x=>x===null)) { console.log(`  ${s.id.padEnd(13)} diverged`); continue; }
  console.log(`  ${s.id.padEnd(13)} ` + v.map(x=>x.toFixed(3).padStart(8)).join('') + `    ${(Math.max(...v)-Math.min(...v)).toFixed(3)}`);
}
console.log('\n  gain 0 = sensor disabled, creature swims straight. A body that steers');
console.log('  must beat its own gain-0 column; the "range" is the whole prize.\n');

// ── 2. does control subtraction isolate steering? ───────────────────────────
const corpus = [];
for (const s of SEEDS) { try { corpus.push({ tag:s.id, g:s.genome, p:morphogenesis(s.genome) }); } catch {} }
const N = Number(process.argv[2] ?? 16);
for (let i=0; corpus.length < SEEDS.length+N && i<N*10; i++) {
  const g = createRandomGenome(rngFrom(0x5EE1 ^ (i*2654435761)));
  let p; try { p = morphogenesis(g); } catch { continue; }
  if (p.jointCount>=1) corpus.push({ tag:`rand${i}`, g, p });
}
const rows = [];
for (const { tag,g,p } of corpus) {
  const live = seek(p,g,{});
  const dead = seek(p,g,{ gainOverride: 0 });
  if (live===null||dead===null) continue;
  rows.push({ tag, live, dead, gain: g.controller.preyGain+g.controller.threatGain, benefit: live-dead });
}
const rank = v => { const i2 = v.map((x,i)=>[x,i]).sort((a,b)=>a[0]-b[0]); const r=[]; i2.forEach(([,i],k)=>r[i]=k); return r; };
const sp = (a,b) => { const ra=rank(a),rb=rank(b),n=a.length,m=(n-1)/2; let nu=0,da=0,db=0;
  for(let i=0;i<n;i++){nu+=(ra[i]-m)*(rb[i]-m);da+=(ra[i]-m)**2;db+=(rb[i]-m)**2;} return nu/Math.sqrt(da*db); };
console.log('=== 2. CONTROL SUBTRACTION (objective question), n=' + rows.length + ' ===\n');
console.log('  score      = mean fraction of 6 m closed, sensor live');
console.log('  control    = same, turnBias forced to 0 (swims straight)');
console.log('  benefit    = score - control, i.e. what the SENSOR contributes\n');
const b = rows.map(r=>r.benefit);
const mean = b.reduce((a,c)=>a+c,0)/b.length;
console.log(`  benefit: mean ${mean.toFixed(3)}   min ${Math.min(...b).toFixed(3)}   max ${Math.max(...b).toFixed(3)}`);
console.log(`  creatures where the sensor HELPS  (benefit > 0.02): ${b.filter(x=>x>0.02).length}/${b.length}`);
console.log(`  creatures where the sensor HURTS  (benefit < -0.02): ${b.filter(x=>x<-0.02).length}/${b.length}`);
console.log('\n  correlations');
console.log(`    score   vs control (is score just speed?)  ${sp(rows.map(r=>r.live), rows.map(r=>r.dead)).toFixed(2)}`);
console.log(`    benefit vs control (is benefit just speed?) ${sp(rows.map(r=>r.benefit), rows.map(r=>r.dead)).toFixed(2)}`);
console.log(`    benefit vs netGain                         ${sp(rows.map(r=>r.benefit), rows.map(r=>r.gain)).toFixed(2)}`);
console.log('');
