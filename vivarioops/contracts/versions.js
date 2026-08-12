// contracts/versions.js — the three SCHEMA versions.
//
// A0 decision (reported): 20 §8 says version.json is the only source of truth, but
// contracts need BRIDGE_V (pairSeed, record validity) and /engine/ cannot import
// /trunk/ (N3). So the three schema versions are declared here — they are schema
// decisions, made by hand, not build outputs — and version.json MIRRORS them.
// APP_V remains build-generated and is NOT here.
// A1 gate assertion: version.json's genome/bridge/ecology equal these three.

/** 01 §8 — bumps on genome schema change; requires a forward migration. */
// 5 -> 6 (2026-08-09). TWO FIELDS IN ONE BUMP, per ROADMAP §5b's "spend the
// GENOME_V bump once": `morphology` (the proportion gradient — taperStrength /
// taperRatio) and `origin` (founder provenance that survives breeding). Both are
// bit-identical for migrated genomes: taperStrength 0 skips the resolver entirely,
// and founder null is "unknown", which is what a stored v5 genome honestly is.
// SCHEMA_OF maps genome, specimen AND lineage to this number — a missed migration
// has already made a player's whole Atlas invisible once.
// 6 -> 7 (2026-08-10). PHASE 4.3 — THE SECOND STEERING OUTPUT. `preyGain2` and
// `threatGain2`, the same form as the pair above but reading the OUT-OF-PLANE
// component of the bearing and driving the joints along the body's second
// principal bend axis. Until now the entire nervous system was one scalar, so
// the reachable postures were a one-dimensional family — bend one way or its
// exact opposite — whatever the body could do. Measured joint-axis spread says
// that was a real constraint for some bodies and not others: the eels are
// genuinely planar (1.000 / 0.000 / 0.000) but `spokebeast-banded` (0.754 /
// 0.174 / 0.072) and `protea` (0.737 / 0.203 / 0.060) have anatomy in three
// dimensions that nothing could command.
// Both genes migrate in at 0 and `targetAngles` guards on `turnBias2 !== 0`, so
// every stored creature is bit-identical, not merely equivalent.
// 7 -> 8 (2026-08-11). `brakeGain` — Phase 4.3's SECOND OUTPUT, `effort`, which
// the plan asked for and which nothing outside the forage kinesis had ever
// modulated. `effort = max(BRAKE_FLOOR, 1 - brakeGain * |bearing|)`: throttle the
// gait when badly aimed. Reads BEARING and not distance, because no creature in
// this project has a range sense and braking on distance would hand it one — and
// because the distance term was measured to add nothing and cost most of the harm.
// Migrates in at 0, `sensorEffort` returns exactly 1 there, so every stored
// creature is bit-identical.
// A GENE RATHER THAN A CONSTANT because the corpus wants opposite values: a
// creature that passes its target and leaves improves 3.56 -> 1.49 cm with it,
// one still converging at 75% of the trial degrades 1.41 -> 2.02.
export const GENOME_V = 8;

/** 01 §8 — bumps on any probe, reduction or duel-rule change; invalidates all records. */
// BUMPED 1 -> 2 when the CoM path length moved from 20 Hz trace samples to
// every physics step. `straightness` was aliased — the centre of mass wobbles at
// 12-22 Hz against a 10 Hz Nyquist limit — so every stored record's efficiency
// was over-reported. New fields comSpeed / netSpeed / efficiency ship with it.
// B2 §5 bumps this: S3 now emits turnPlaneX/Y/Z and `bearingTo` is expressed in
// that plane instead of the horizontal one, so every cached record was measured
// by a different bridge and a different sensor. 11 §4: "BRIDGE_VERSION bumps
// invalidate every cached record. This is the only invalidation mechanism and it
// must be respected."
// C0 (B3) bumps 4 -> 5 for TWO reductions landed together to spend one
// invalidation. (1) turn3d now reads the HEADING from the root's forward axis and
// accumulates it as a vector, and S3 differences that vector across +/-bias, so
// `turnRate3d`/`steeringAuthority` mean a coherent steering response rather than a
// per-stroke wobble — every stored turn number was measured by the old sensor.
// (2) the record gains `bodyLengthsPerSecond` and `stride` (C0.3), so the schema
// itself is wider. A record from bridge 4 is rejected, never migrated: a probe
// reduction has no forward migration, it must be re-measured.
// (3) C1 defaults the reference actuator (motorFreqHz 10, budgetScale 6, and the
// 00 §9 bound moved from a gain-divide to a per-step error clamp), so every
// creature's measured locomotion changes. That is a measured-behaviour change,
// not a schema one, but it invalidates cached records for the same reason a
// reduction change does — they were measured by a different actuator. It ships in
// the SAME session as (1) and (2) and nothing is persisted between them, so it
// rides this one bump rather than taking a second.
// BUMPED 5 -> 6 for the TWIST LIMIT BAND. `RANGE.twistLimit` narrows a twist
// joint's half-range from pi/2 to 0.35 rad, and morphogen.js clamps to it at
// expression, so every stored record for a creature carrying a twist joint was
// measured with axial roll the joint no longer has.
//
// NOT A TAIL CASE: 42 of the 89 joints the authored corpus actually EXPRESSES
// are twist (w1_residents + w1_spines + w1_player, measured by tools/_ztwist.mjs
// — count the plan, not the genome text, because recursive nodes instantiate a
// joint per repeat). Before: peak axial roll mean 43.3 deg, max 76.1, with 23 of
// 42 twist joints rolling past 45 deg. After: mean 18.0, max 20.5, none past 45.
// The peak sits AT the limit, so these joints were being driven into their stop —
// the roll was commanded, not incidental.
//
// COST, MEASURED AND NOT SMALL: displacement over 20 s falls a mean 22% on that
// corpus, concentrated entirely in the twist-heavy creatures (spine-1 -85%,
// res_c -72%, spine-4 -56%; the three w1_player creatures carry no twist joint
// and are bit-identical). A band sweep says this is NOT the 0.35 being too
// tight — the cost is flat at -22%/-22%/-19% across 0.20/0.35/0.50 and only
// recovers above 0.70, where max roll is back to 40 deg. It is the corpus having
// been bred and authored against an actuator that let a limb barber-pole for
// thrust. Re-select rather than widen the band.
//
// Not a schema change and not a migration — GENOME_V is untouched, every stored
// genome stays valid — but it is a measured-behaviour change, and 11 §4 makes a
// bridge bump the only invalidation mechanism there is.
// 6 -> 7 (2026-08-08). A NEW FIELD, `turnCapability`, and N21 now clamps by it
// instead of by `turnRate`. `turnRate` is the YAW component and reads near-zero for
// any body that bends in pitch — which is every self-connected chain, i.e. every
// good swimmer here. Measured: `eel-fast` reads yaw 0.00 in BOTH bias directions
// while turning at 1.09 deg/s in 3-D with full authority, and `eel` reads the same
// yaw 22.50 as `eel-unison` while being unable to reverse its turn at all. The
// clamp was capping the wrong animals. SESSION-10 §152 deferred this deliberately;
// tools/_zlight.mjs forced it by measuring taxis at r = 0.91 against turnRate3d.
//
// 7 -> 8 (2026-08-10). S3 NOW SWEEPS THE BIAS INSTEAD OF MEASURING AT ONE POINT,
// and every turning field is reported at the creature's own `bestBias`. A new
// field, `bestBias`, records which point that was.
//
// The single point was 1.0, and at TURN_AUTHORITY 1.0 that commands a full joint
// range of differential offset on top of a gait whose amplitude is already p50
// 0.69 of that range. `targetAngles` asks for an angle outside the joint's own
// limits, the joint pins against `setLimits`, the stroke rectifies and thrust
// collapses — so the probe was measuring the mechanism at the point where it
// stops working. The response is not monotone in the command:
//
//     eel-fast    6.18 deg/s @ 0.2   8.88 @ 0.5   1.25 @ 1.0
//
// and its minimum turning radius is 2.11 cm at bias 0.5 against the 35.01 cm the
// old formulation reported. `eel` and `eel-finned` reported turnCapability 0.000
// and an INFINITE radius, and `tools/_zgoal.mjs` then measured them as the two
// best goal-reachers in the library (+0.65 and +0.67 control-subtracted closure,
// arriving in four of six directions). The field was describing a body being
// asked the one question it cannot answer.
//
// `turnRadius` changes meaning with it: it was `cruiseSpeed / turnRate`, the
// straight-line speed over the yaw rate under a saturated bias, and it is now
// the mean speed and the 3-D heading rate from the same run at `bestBias`.
// Creatures travel at 0.26-0.55x cruise while holding a turn, so the old number
// overstated the radius by roughly that factor for anything that steers.
//
// Not a schema change — GENOME_V is untouched — but every stored S3 field now
// means something different, and 11 §4 makes a bridge bump the only invalidation
// mechanism there is. `turnRate3dAt1` / `turnRadiusAt1` are returned alongside so
// every figure quoted before this date stays auditable.
export const BRIDGE_V = 8;

// ⚠ BRIDGE_V IS NOT BUMPED FOR GENOME_V 7, and that is not an oversight.
// `genomeHash` mixes GENOME_V in, so every record key moves anyway; and the
// second steering channel changes no probe, no reduction and no duel rule. At
// `turnBias2 = 0` — which is every migrated creature — `targetAngles` does not
// execute the added line at all. Bumping both would claim a measurement change
// that did not happen.

/** 01 §8 — bumps on L3 rule change; stored runs kept but marked stale. */
export const ECOLOGY_V = 1;
