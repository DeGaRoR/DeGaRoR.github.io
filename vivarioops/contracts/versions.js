// contracts/versions.js — the three SCHEMA versions.
//
// A0 decision (reported): 20 §8 says version.json is the only source of truth, but
// contracts need BRIDGE_V (pairSeed, record validity) and /engine/ cannot import
// /trunk/ (N3). So the three schema versions are declared here — they are schema
// decisions, made by hand, not build outputs — and version.json MIRRORS them.
// APP_V remains build-generated and is NOT here.
// A1 gate assertion: version.json's genome/bridge/ecology equal these three.

/** 01 §8 — bumps on genome schema change; requires a forward migration. */
export const GENOME_V = 4;

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
export const BRIDGE_V = 5;

/** 01 §8 — bumps on L3 rule change; stored runs kept but marked stale. */
export const ECOLOGY_V = 1;
