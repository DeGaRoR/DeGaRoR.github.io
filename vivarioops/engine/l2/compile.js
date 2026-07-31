// engine/l2/compile.js — 11 §8's pipeline, solo half.
//
//   compile(genome, world, residents) -> CapabilityRecord
//
// "A PURE FUNCTION. Same inputs, same output, always, on the same device. No
// wall clock, no Math.random, no network, no learning, no fitting to anything
// other than the creature's own measured points." (11 §1)
//
// This file delivers everything EXCEPT the matchup half. `id` and `vs` are
// written by the fauna loader from PairMatchup records (03 §3), which is a
// separate and cheap step, and duel.js does not exist until C2. Every other
// field in `Species` is written here, and assertSolo() proves it.

import { makeSpecies, SPECIES_FIELDS, deriveThresholds } from '../../contracts/species.js';
import { BRIDGE_V } from '../../contracts/versions.js';
import { genomeHash } from '../l1/genome.js';
import { morphogenesis } from '../l1/morphogen.js';
import { binomial } from '../l1/naming.js';
import { assessViability } from '../l1/viability.js';
import { S1, S2, S3 } from './probes.js';
import { INVALID } from './probe.js';

/** Fields the fauna loader owns. Everything else is compileSolo's obligation. */
export const FAUNA_FIELDS = ['id', 'vs'];

/**
 * Compile one creature's solo capabilities.
 *
 * @param {object} RAPIER already-initialised
 * @param {object} args
 * @param {object} args.genome
 * @param {object} args.world
 * @param {string} args.worldHash   from contracts/world.js worldHash()
 * @param {string} [args.provenance] 'shipped' | 'player'
 * @param {object} [args.plan]      if morphogenesis has already run
 * @param {boolean} [args.checkViability] default true
 * @returns {{species:object|null, valid:boolean, reason:string|null, detail:object}}
 */
export function compileSolo(RAPIER, args) {
  const { genome, world } = args;
  const plan = args.plan ?? morphogenesis(genome);

  // 11 §8: `if (!viable(bodyPlan)) return invalid`. 11 §11 makes non-viability a
  // RECORD with honest numbers rather than an exception — "a creature that
  // cannot move is not an error; it is a creature that will die in the world" —
  // but a non-viable body cannot be measured at all, so the honest record is a
  // null one with a named reason.
  if (args.checkViability !== false) {
    const v = assessViability(RAPIER, genome, world, { plan });
    if (!v.ok) {
      return { species: null, valid: false, reason: INVALID.NONVIABLE, detail: { viability: v.reason } };
    }
  }

  const morph = S1(plan);
  const loco = S2(RAPIER, { plan, genome, world });
  if (!loco.valid) return { species: null, valid: false, reason: loco.reason, detail: { stage: 'S2' } };

  const turn = S3(RAPIER, { plan, genome, world, cruiseSpeed: loco.cruiseSpeed });
  if (!turn.valid) return { species: null, valid: false, reason: turn.reason, detail: { stage: 'S3' } };

  const thresholds = deriveThresholds(morph.massBase, morph.reach, world);
  const sp = makeSpecies();

  // ── identity ──────────────────────────────────────────────────────────────
  sp.genomeHash = genomeHash(genome);
  sp.worldHash = args.worldHash;
  sp.bridgeVersion = BRIDGE_V;
  // 10 §8 keeps naming to "function only, no UI" in the slice, but the RECORD
  // has always had the field and B4 wrote the function. This is where it lands.
  sp.name = binomial(plan, genome).binomial;
  sp.provenance = args.provenance ?? 'player';

  // ── S1 ────────────────────────────────────────────────────────────────────
  for (const k of ['massBase', 'volume', 'boundingRadius', 'longestAxis', 'frontalArea',
                   'harvestArea', 'reach', 'torsoExposure', 'bodyCount', 'jointCount', 'dofCount']) {
    sp[k] = morph[k];
  }

  // ── S2 ────────────────────────────────────────────────────────────────────
  for (const k of ['cruiseSpeed', 'burstSpeed', 'burstRatio', 'burstDuration',
                   'comSpeed', 'netSpeed', 'efficiency',
                   'cotC0', 'cotC1', 'basalRate', 'straightness', 'gaitFrequency']) {
    sp[k] = loco[k];
  }

  // ── S3 ────────────────────────────────────────────────────────────────────
  sp.turnRate = turn.turnRate;
  sp.turnRate3d = turn.turnRate3d;
  sp.steeringAuthority = turn.steeringAuthority;
  sp.turnPlaneX = turn.turnPlaneX;
  sp.turnPlaneY = turn.turnPlaneY;
  sp.turnPlaneZ = turn.turnPlaneZ;
  sp.turnRadius = turn.turnRadius;
  sp.turnSpeedRatio = turn.turnSpeedRatio;

  // ── fixture defaults — UNMEASURED until S4/S5 (30 §5 C1) ──────────────────
  sp.pursuitGain = world.pursuitGain;
  sp.evasionGain = world.evasionGain;

  // ── derived (03 §3) ───────────────────────────────────────────────────────
  sp.massMin = thresholds.massMin;
  sp.massReproduce = thresholds.massReproduce;
  sp.perceptionRadius = thresholds.perceptionRadius;

  // ── from the genome, not measured ─────────────────────────────────────────
  sp.trophic = genome.social.trophic;
  sp.boldness = genome.social.boldness;
  sp.cohesion = genome.social.cohesion;
  sp.separation = genome.social.separation;
  sp.alignment = genome.social.alignment;
  sp.separationRadius = genome.social.separationRadius;

  return {
    species: sp,
    valid: true,
    reason: null,
    detail: {
      degenerateFit: loco.degenerateFit,
      burstSaturated: loco.burstSaturated,
      intrinsicRate: turn.intrinsicRate,
      efforts: loco.runs.map(r => ({ effort: r.effort, speed: r.speed, power: r.power })),
    },
  };
}

/**
 * Which Species fields is a solo compile responsible for? Derived from the
 * producer table in contracts/species.js rather than restated, so a field added
 * there cannot be quietly left unwritten here — that is what gives the gate's
 * coverage assertion teeth.
 */
export function soloFields() {
  return SPECIES_FIELDS.map(f => f.name).filter(n => !FAUNA_FIELDS.includes(n));
}

/** @returns {string[]} fields a solo compile should have written and did not. */
export function missingSoloFields(species) {
  return soloFields().filter(n => species[n] === null || species[n] === undefined);
}
