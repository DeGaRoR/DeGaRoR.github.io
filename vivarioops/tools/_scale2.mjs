// THROWAWAY (scale audit, step 2) — measured locomotion, then read under each
// candidate unit label. Answers: which unit reading gives a BIOLOGICALLY
// PLAUSIBLE animal (speed in body lengths/s, beat frequency in Hz, Reynolds
// number, implied muscle stress)? No engine change: the sim is untouched, only
// the interpretation of its numbers varies.
import RAPIER from '@dimforge/rapier3d-compat';
import { morphogenesis, totalMass, boundingRadius } from '../engine/l1/morphogen.js';
import { S1, S2 } from '../engine/l2/probes.js';
import { MUSCLE_STRESS, OMEGA_MAX, STABLE_SPEED, WALL, FIXED_DT } from '../engine/l1/physics.js';
import { createRandomGenome, SLICE_LIMITS } from '../engine/l1/factory.js';
import { assessViability } from '../engine/l1/viability.js';
import { makeRng } from '../trunk/rng.js';
import { deserialise } from '../engine/l1/genome.js';
import { SEEDS } from '../worlds/seeds.js';
import { W1_RESIDENT_GENOMES, W1_RESIDENT_IDS } from '../worlds/w1_residents.js';
import { W1_SLICE } from '../worlds/w1_slice.js';

await RAPIER.init();
const f = (x, n = 3) => (Number.isFinite(x) ? x.toFixed(n) : 'n/a').padStart(8);

const cases = [];
for (const s of SEEDS) if (s.id !== 'staircase') cases.push([s.id, s.genome]);
for (const id of W1_RESIDENT_IDS) cases.push([id, deserialise(W1_RESIDENT_GENOMES[id])]);

// a handful of viable random bodies, so the picture is not only the authored eels
const rng = makeRng(0x5CA1E);
for (let i = 0, found = 0; i < 300 && found < 8; i++) {
  const g = createRandomGenome(rng, SLICE_LIMITS);
  let v; try { v = assessViability(RAPIER, g, W1_SLICE); } catch { continue; }
  if (v.ok) { cases.push([`rand${found}`, g]); found++; }
}

console.log('\n  LOCOMOTION, raw engine units (S2, gravity 0, unbounded — the shipped probe)\n');
console.log('  name         L(units)  netSpd   comSpd     eff    gaitHz    BL/s    St');
const rows = [];
for (const [name, genome] of cases) {
  let plan; try { plan = morphogenesis(genome); } catch { continue; }
  const s1 = S1(plan);
  const r = S2(RAPIER, { plan, genome, world: W1_SLICE });
  if (!r.valid) { console.log(`  ${name.padEnd(12)} INVALID (${r.reason})`); continue; }
  const cr = r.runs[1];                          // effort 1.0
  const L = s1.longestAxis;
  const bl = cr.netSpeed / L;
  // Strouhal with tail amplitude taken as 0.2 L (no tip trace here) — order only.
  const st = cr.netSpeed > 0 ? (cr.gaitFrequency * 0.2 * L) / cr.netSpeed : NaN;
  rows.push({ name, L, net: cr.netSpeed, com: cr.comSpeed, eff: cr.netSpeed / (cr.comSpeed || 1), hz: cr.gaitFrequency, bl, st, mass: totalMass(plan) });
  console.log(`  ${name.padEnd(12)} ${f(L, 2)} ${f(cr.netSpeed, 4)} ${f(cr.comSpeed, 4)} ${f(cr.netSpeed / (cr.comSpeed || 1), 3)} ${f(cr.gaitFrequency, 3)} ${f(bl, 4)} ${f(st, 2)}`);
}

const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const mL = med(rows.map(r => r.L)), mNet = med(rows.map(r => r.net)), mHz = med(rows.map(r => r.hz));
const mMass = med(rows.map(r => r.mass));

console.log(`\n  median: length ${mL.toFixed(2)} u, netSpeed ${mNet.toFixed(4)} u/s, gait ${mHz.toFixed(2)} Hz, mass ${mMass.toFixed(2)} u^3`);
console.log(`  (BL/s = ${(mNet / mL).toFixed(4)} and gait Hz are UNIT-FREE: relabelling cannot change them)\n`);

console.log('  THE SAME SIMULATION READ UNDER THREE UNIT LABELS');
console.log('  (time is seconds in all three; only the length unit is reinterpreted)\n');
console.log('  1 unit =        length      mass       speed      Re      muscle sigma   v*=sqrt(s/rho)');
const NU = 1e-6;   // m^2/s, water at 20 C
for (const [nm, u] of [['1 m ', 1], ['1 dm', 0.1], ['1 cm', 0.01]]) {
  const Lm = mL * u;                        // m
  const vm = mNet * u;                      // m/s
  const kg = mMass * (u ** 3) * 1000;       // water density 1000 kg/m^3
  const Re = vm * Lm / NU;
  // stress unit = massUnit/(lengthUnit*s^2); massUnit = 1000*u^3 kg
  const stressUnit = 1000 * u ** 3 / u;     // Pa
  const sigma = MUSCLE_STRESS * stressUnit;
  const vstar = Math.sqrt(sigma / 1000);
  console.log(`  ${nm}         ${(Lm * 100).toFixed(1).padStart(7)} cm ${(kg >= 1 ? kg.toFixed(1) + ' kg' : (kg * 1000).toFixed(1) + ' g').padStart(10)} ${(vm * 100).toFixed(2).padStart(8)} cm/s ${Re.toExponential(1).padStart(9)}  ${sigma.toExponential(1).padStart(9)} Pa ${(vstar).toFixed(2).padStart(8)} m/s`);
}
console.log(`
  reference points: vertebrate skeletal muscle ~2e5 Pa;
                    water Re>~1000 = pressure drag dominates (the law implemented);
                    real swimmers 0.5-10 BL/s, tail beat 1-20 Hz, Strouhal 0.2-0.4.

  ENGINE CONSTANTS THAT CARRY A LENGTH AND WOULD HAVE TO MOVE
  (value as shipped, then what it MEANS under each reading)\n`);
const consts = [
  ['gravity (w1)', W1_SLICE.gravity, 'L/T^2', 'm/s^2'],
  ['STABLE_SPEED', STABLE_SPEED, 'L/T', 'm/s'],
  ['WALL', WALL, 'L', 'm'],
  ['tank X', W1_SLICE.tankBounds[0], 'L', 'm'],
  ['worldSize X', W1_SLICE.worldSize[0], 'L', 'm'],
  ['MUSCLE_STRESS', MUSCLE_STRESS, 'M/(L T^2)', 'Pa'],
  ['OMEGA_MAX', OMEGA_MAX, '1/T', 'rad/s'],
  ['FIXED_DT', FIXED_DT, 'T', 's'],
];
console.log('  constant            shipped   dim          as metres        as decimetres      as centimetres');
for (const [nm, v, dim] of consts) {
  const show = (u) => {
    let x = v, unit = '';
    if (dim === 'L') { x = v * u; unit = 'm'; }
    else if (dim === 'L/T') { x = v * u; unit = 'm/s'; }
    else if (dim === 'L/T^2') { x = v * u; unit = 'm/s^2'; }
    else if (dim === 'M/(L T^2)') { x = v * 1000 * u ** 3 / u; unit = 'Pa'; }
    else return `${v} ${dim === 'T' ? 's' : 'rad/s'}`.padStart(16);
    return `${x < 0.01 || x > 1e4 ? x.toExponential(2) : x.toPrecision(4)} ${unit}`.padStart(16);
  };
  console.log(`  ${nm.padEnd(16)} ${String(v).padStart(8)}  ${dim.padEnd(10)} ${show(1)} ${show(0.1)} ${show(0.01)}`);
}
console.log();
