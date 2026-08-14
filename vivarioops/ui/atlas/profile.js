// ui/atlas/profile.js — the stamp on a cached card measurement.
//
// LIVED IN ui/screens/atlas.js UNTIL THE INDEX NEEDED IT TOO. Three readers now
// — the index that stores it, the grid that sorts on it, the specimen page that
// prints it beside the numbers so a stale figure is explicable — and a constant
// copied into three files is exactly the drift its own docstring warns about.

/**
 * A profile is a claim about THIS physics, THIS food model and THIS window. Move
 * any of them and a stored number is a measurement of a build that no longer
 * exists — the identical problem `RENDER_TAG` solves for portraits, so it is
 * solved the identical way. BUMP THIS whenever `forageProfile`, `FORAGE_WARMUP`,
 * `FORAGE_WINDOW`, the harvest model or the actuator changes.
 */
export const PROFILE_TAG = 'p1:w30:m150';

/** True when a record's cached measurement was taken by THIS build. */
export const profileFresh = (spec) => spec?.profile?.tag === PROFILE_TAG;
