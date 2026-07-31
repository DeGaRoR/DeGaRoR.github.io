// HAND-DESIGNED SEEDS vs RANDOM. The reference initialises randomly ("Sims
// creatures initialise with a random genotype"), so seeding is not what
// separates us from it. But it is still worth knowing whether a DESIGNED body
// beats a random one — if a serpentine chain trounces the corpus, the search is
// starting somewhere bad; if it does not, the body plan was never the problem.
//
// Built from the same schema the factory emits, so these are ordinary genomes:
// mutation and breeding accept them unchanged.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { DRIVE } from '../engine/l1/controller.js';
import { GENOME_V } from '../contracts/versions.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const SEC = 12, STEPS = Math.round(SEC/FIXED_DT), W = { ...W1_SLICE, gravity: 0 };
const MOTOR = process.argv[2] ?? 'pd';

/** A chain: one node repeated down its own self-connection, plus a tail fin. */
function serpent({ segs = 4, segDims = [1.2, 0.5, 0.35], taper = 0.85,
                   lag = Math.PI / 2, amp = 0.9, omega = 2.0, fin = true } = {}) {
  const nodes = [{
    id: 'seg', dims: segDims, density: 1, recursiveLimit: segs,
    joint: { type: 'revolute', angleLimits: [0.9, 0.9, 0.9], phaseLag: lag },
    colorGenes: { hueShift: 0.5, valueShift: 0, patternPhase: 0 },
  }];
  const connections = [{
    id: 'c_self', parentNodeId: 'seg', childNodeId: 'seg',
    parentFace: 0,                       // +X, i.e. straight behind
    position: [0, 0], orientation: [0, 0, 0],
    scale: [taper, taper, taper],
    reflectX: false, reflectY: false, reflectZ: false, terminalOnly: false,
  }];
  const jointGenes = { seg: { amplitude: amp, bias: 0, freqMult: 1 } };
  if (fin) {
    nodes.push({
      id: 'fin', dims: [0.35, 1.6, 0.22], density: 1, recursiveLimit: 1,
      joint: { type: 'revolute', angleLimits: [0.7, 0.7, 0.7], phaseLag: lag },
      colorGenes: { hueShift: 0.6, valueShift: 0, patternPhase: 0 },
    });
    connections.push({
      id: 'c_fin', parentNodeId: 'seg', childNodeId: 'fin',
      parentFace: 0, position: [0, 0], orientation: [0, 0, 0], scale: [1, 1, 1],
      reflectX: false, reflectY: false, reflectZ: false, terminalOnly: true,
    });
    jointGenes.fin = { amplitude: amp, bias: 0, freqMult: 1 };
  }
  return {
    version: GENOME_V, seed: 0, rootNodeId: 'seg', nodes, connections,
    material: { hueShift: 0.5, valueShift: 0, patternPhase: 0 },
    controller: { omega, preyGain: 0, threatGain: 0, jointGenes },
    social: {},
  };
}

function trial(genome) {
  let plan; try { plan = morphogenesis(genome); } catch (e) { return { err: e.message }; }
  let sim; try { sim = createSimulation(RAPIER, plan, genome, W, { drive: DRIVE.POSITION, bounded: false, motor: MOTOR }); }
  catch (e) { return { err: e.message }; }
  const c0 = sim.centreOfMass(); let prev = c0, path = 0, bad = false;
  try { for (let s=0;s<STEPS;s++){ sim.step(); const c = sim.centreOfMass();
    if(!Number.isFinite(c[0]+c[1]+c[2])){bad=true;break;}
    path += Math.hypot(c[0]-prev[0],c[1]-prev[1],c[2]-prev[2]); prev = c; } } catch { bad = true; }
  const c1 = sim.centreOfMass(); const work = sim.work; sim.free();
  if (bad) return { err: 'diverged' };
  const net = Math.hypot(c1[0]-c0[0],c1[1]-c0[1],c1[2]-c0[2]);
  return { bodies: plan.bodyCount, net: net/SEC, com: path/SEC, eff: net/Math.max(path,1e-9), work };
}

const pct=(a,q)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.max(0,Math.round((s.length-1)*q))]:NaN;};
const rand=[];
for(let i=0;i<40;i++){const r=trial(createRandomGenome(rngFrom(0xC0DE^(i*2654435761)))); if(!r.err)rand.push(r);}
console.log(`\nmotor='${MOTOR}', ${SEC}s, gravity 0\n`);
console.log(`  RANDOM corpus  n=${rand.length}   net p50 ${pct(rand.map(r=>r.net),0.5).toFixed(3)}  p90 ${pct(rand.map(r=>r.net),0.9).toFixed(3)} m/s   eff p50 ${pct(rand.map(r=>r.eff),0.5).toFixed(3)}   best net ${Math.max(...rand.map(r=>r.net)).toFixed(3)}`);
console.log('\n  design                                  bodies    net m/s    COM m/s     eff');
const designs = [
  ['serpent 4 seg, lag pi/2',        {}],
  ['serpent 6 seg, lag pi/2',        { segs: 6 }],
  ['serpent 6 seg, lag pi/3',        { segs: 6, lag: Math.PI/3 }],
  ['serpent 6 seg, lag pi',          { segs: 6, lag: Math.PI }],
  ['serpent 6 seg, NO lag (unison)', { segs: 6, lag: 0 }],
  ['serpent 6, slender segs',        { segs: 6, segDims: [1.4, 0.35, 0.25] }],
  ['serpent 6, no fin',              { segs: 6, fin: false }],
  ['serpent 6, fast omega 4',        { segs: 6, omega: 4 }],
  ['serpent 6, slow omega 1',        { segs: 6, omega: 1 }],
  ['serpent 3, stubby',              { segs: 3, segDims: [0.8, 0.8, 0.5] }],
];
for (const [label, o] of designs) {
  const r = trial(serpent(o));
  if (r.err) { console.log(`  ${label.padEnd(38)} ERROR ${r.err}`); continue; }
  console.log(`  ${label.padEnd(38)} ${String(r.bodies).padStart(5)}  ${r.net.toFixed(3).padStart(9)}  ${r.com.toFixed(2).padStart(9)}  ${r.eff.toFixed(3).padStart(6)}`);
}
