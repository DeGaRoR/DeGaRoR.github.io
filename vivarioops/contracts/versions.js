// contracts/versions.js — the three SCHEMA versions.
//
// A0 decision (reported): 20 §8 says version.json is the only source of truth, but
// contracts need BRIDGE_V (pairSeed, record validity) and /engine/ cannot import
// /trunk/ (N3). So the three schema versions are declared here — they are schema
// decisions, made by hand, not build outputs — and version.json MIRRORS them.
// APP_V remains build-generated and is NOT here.
// A1 gate assertion: version.json's genome/bridge/ecology equal these three.

/** 01 §8 — bumps on genome schema change; requires a forward migration. */
export const GENOME_V = 2;

/** 01 §8 — bumps on any probe, reduction or duel-rule change; invalidates all records. */
export const BRIDGE_V = 1;

/** 01 §8 — bumps on L3 rule change; stored runs kept but marked stale. */
export const ECOLOGY_V = 1;
