// contracts/versions.js — the three SCHEMA versions.
//
// A0 decision (reported): 20 §8 says version.json is the only source of truth, but
// contracts need BRIDGE_V (pairSeed, record validity) and /engine/ cannot import
// /trunk/ (N3). So the three schema versions are declared here — they are schema
// decisions, made by hand, not build outputs — and version.json MIRRORS them.
// APP_V remains build-generated and is NOT here.
// A1 gate assertion: version.json's genome/bridge/ecology equal these three.

/** 01 §8 — bumps on genome schema change; requires a forward migration. */
export const GENOME_V = 5;

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
export const BRIDGE_V = 7;

/** 01 §8 — bumps on L3 rule change; stored runs kept but marked stale. */
export const ECOLOGY_V = 1;
