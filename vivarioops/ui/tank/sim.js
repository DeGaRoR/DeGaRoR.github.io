// ui/tank/sim.js — the tank's pure arithmetic. No DOM, no three.js, no Rapier.
//
// Everything here is extracted from the screen precisely so it can be asserted.
// A screen is the one part of this project a gate cannot look at, so whatever
// can be moved out of it should be: the layout, the fixed-timestep accumulator
// and the hit-test radius are all decisions that fail silently and would
// otherwise be checkable only by a person staring at a tank.

/**
 * TILED TANKS — a deviation from 21 §4.2 in mechanism, not in appearance.
 *
 * 21 §4.2 resolves the layout question as ONE SHARED TANK and rejects pods and
 * viewports, because they trade away the aquarium, which is the thing the game
 * is selling. This keeps the aquarium.
 *
 * But `createSimulation` constructs its own `RAPIER.World` per call, so six
 * creatures in one physics world would mean reworking it — and it is under a
 * green B3 gate, with every viability threshold in B4a measured against W1's
 * tank exactly as it stands. So each creature gets its OWN unmodified W1 tank,
 * and the six tanks are TILED in the render: cell centres one full tank apart,
 * so a creature confined to its own cell can never reach another's. The box
 * drawn on screen is exactly the union of the six real tanks, which is a true
 * statement about the space rather than a decorative one.
 *
 * What it costs: creatures cannot touch each other. Nothing in the slice needs
 * them to — duels are their own simulation at C2, and there is no damage system.
 * What it buys: physics untouched, viability numbers still valid, and each
 * creature's motion is independently reproducible from its own seed.
 */
export const GRID = { cols: 3, rows: 2 };

/**
 * The grid follows the SCREEN, not a constant.
 *
 * A fixed 3x2 lays the six cells out 48 m wide by 32 m deep. On a portrait
 * phone the visible horizontal extent is roughly two thirds of the vertical
 * one, so the outer column falls off both edges and two of the six creatures
 * are simply not there. Rotating the grid costs nothing and the alternative —
 * pulling the camera back far enough to fit a wide grid into a tall window —
 * makes every creature smaller than it needs to be.
 */
export function gridFor(aspect) {
  return aspect >= 1 ? { cols: 3, rows: 2 } : { cols: 2, rows: 3 };
}

/**
 * The camera distance that FITS the union box, rather than a multiplier that
 * happened to look right in one window.
 *
 * The union's bounding sphere is framed against whichever field of view is
 * narrower. A perspective camera's `fov` is vertical, so in portrait the
 * horizontal one is smaller and is what actually crops — computing only against
 * the vertical fov is exactly how content ends up cut off the sides.
 */
export function frameDistance(bounds, fovV, aspect, margin = 1.08) {
  const radius = 0.5 * Math.hypot(bounds[0], bounds[1], bounds[2]);
  const fovH = 2 * Math.atan(Math.tan(fovV / 2) * aspect);
  return (margin * radius) / Math.sin(Math.min(fovV, fovH) / 2);
}

/** Cell centres, in world metres, for a tank of `bounds` = [w, h, d]. */
export function cellCentres(bounds, grid = GRID) {
  const [w, , d] = bounds;
  const out = [];
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      out.push([
        (c - (grid.cols - 1) / 2) * w,
        0,
        (r - (grid.rows - 1) / 2) * d,
      ]);
    }
  }
  return out;
}

/** The union volume the wireframe draws — six real tanks, not an invented box. */
export function unionBounds(bounds, grid = GRID) {
  return [bounds[0] * grid.cols, bounds[1], bounds[2] * grid.rows];
}

/**
 * FIXED TIMESTEP with an accumulator. Physics runs at 1/120 (01 §7) whatever
 * the display does, or determinism is a function of frame rate and two runs of
 * the same seed diverge on a busy phone.
 *
 * The clamp is the part that matters. Without it, a frame that took 400 ms asks
 * for 48 steps, which takes longer than a frame, which asks for more steps next
 * time — the spiral of death, and it presents as "the app froze". Dropping
 * simulated time is the correct failure: the creatures run slow rather than the
 * page hanging.
 *
 * @returns {{steps:number, carry:number, dropped:boolean}}
 */
export function stepBudget(accumulated, dt, maxSteps = 8) {
  const wanted = Math.floor(accumulated / dt);
  const steps = Math.min(wanted, maxSteps);

  // THE DEBT IS ACTUALLY DROPPED, which is what this function has always said
  // and never did. Carrying `accumulated - steps * dt` keeps every unexecuted
  // step, so a 400 ms stall asks for 48, runs 8, and carries 40 into the next
  // frame — which runs 8 again, and again, for six more frames. It avoids the
  // one catastrophic frame and buys a prolonged catch-up instead, during which
  // the simulation is off the wall clock and the tank runs visibly slow.
  //
  // Dropping means dropping: keep only the sub-step remainder, which is the
  // fractional part that has not earned a step yet. `carry` is then always less
  // than `dt` after a capped frame, and the next frame is a normal frame.
  const carry = wanted > maxSteps ? accumulated - wanted * dt : accumulated - steps * dt;
  return { steps, carry, dropped: wanted > maxSteps };
}

/**
 * 21 §4.3: hit testing ray-casts an invisible sphere sized
 * `max(boundingRadius, 44 pt at current zoom)`, so A SMALL CREATURE IS NEVER
 * HARDER TO SELECT THAN A LARGE ONE. Without the floor, selecting the smallest
 * creature in the tank is a game of its own, and the player concludes selection
 * is broken rather than fiddly.
 *
 * The world size of one screen pixel at distance `dist` under a vertical field
 * of view: the frustum is `2*dist*tan(fov/2)` tall and `viewportPx` pixels tall.
 *
 * @param {number} boundingRadius  metres
 * @param {number} dist            metres, creature to camera
 * @param {number} fovRadians
 * @param {number} viewportPx      canvas height in CSS pixels
 * @param {number} tapPx           the tap target, from --tapsize
 */
export function hitRadius(boundingRadius, dist, fovRadians, viewportPx, tapPx) {
  const worldPerPx = (2 * dist * Math.tan(fovRadians / 2)) / Math.max(1, viewportPx);
  return Math.max(boundingRadius, (tapPx / 2) * worldPerPx);
}

/**
 * 21 §4.3: "pointer-down moving < 8 px and released < 250 ms is a tap.
 * Implemented once in the 3D view component, never per screen."
 */
export const TAP = { maxMovePx: 8, maxDurationMs: 250, longPressMs: 400 };

export function classifyPointer({ dx, dy, ms }) {
  if (Math.hypot(dx, dy) >= TAP.maxMovePx) return 'drag';
  if (ms >= TAP.longPressMs) return 'longpress';
  if (ms < TAP.maxDurationMs) return 'tap';
  return 'hold';
}

/**
 * Per-creature speed label (21 §4.5) — HORIZONTAL centre-of-mass speed, smoothed.
 *
 * Three things this is deliberately not:
 *
 *   - not the fastest body. That was the first version and it is backwards: a
 *     creature thrashing one limb while going nowhere posts a large number, so
 *     the one label meant to stop the player selecting on looks alone instead
 *     rewards flailing.
 *   - not the full centre-of-mass speed. Buoyant drift exceeds locomotion by
 *     about 40x (B3) and gravity is the only vertical force, so a 3-D speed is
 *     mostly a rise-and-sink rate and reads nearly the same for all six.
 *     Horizontal motion of the centre of mass is thrust and nothing else.
 *   - not instantaneous. An undulating creature's speed oscillates with its own
 *     gait, and at 4x the raw number is unreadable.
 *
 * Exponential moving average with a time constant in SECONDS, so the smoothing
 * does not change when the frame rate or the speed multiplier does.
 */
export const SPEED_TAU = 0.6;

export function smoothSpeed(previous, sample, dt, tau = SPEED_TAU) {
  if (!(dt > 0)) return previous;
  const a = 1 - Math.exp(-dt / tau);
  return previous + a * (sample - previous);
}

export function horizontalSpeed(velocity) {
  return Math.hypot(velocity[0], velocity[2]);
}

/** 21 §4.3: Speed cycles 1x/2x/4x, and is disabled while paused. */
export const SPEEDS = [1, 2, 4];
export const nextSpeed = (s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length];

/** 21 §4.4 — the states the screen can be in. */
export const STATE = {
  LOADING: 'LOADING', EMPTY: 'EMPTY', SIMULATING: 'SIMULATING',
  PAUSED: 'PAUSED', BREEDING: 'BREEDING', SHEET_OPEN: 'SHEET_OPEN',
  // C3 — the gait burst runs for many seconds; the sim freezes and input is
  // ignored while it does, exactly as BREEDING does, but it holds until the
  // async search resolves rather than expiring on a timer.
  BURSTING: 'BURSTING',
};

/** 21 §4.4: "The BREEDING beat is not decoration" — 600 ms, visible. */
export const BREEDING_MS = 600;

// ── the burst's selection policy ─────────────────────────────────────────────
//
// THE BURST IS NOW THE BREED LOOP, AUTOMATED. It was a separate mechanism that
// ignored the player's selection entirely, expanded the tank, hill-climbed every
// gait and replaced all six slots by speed — so a player who had spent ten
// minutes curating three shapes lost them to one tap, and the screen never said
// what "best" meant. It is the same act the player performs by hand (select,
// breed, keep what looks good, repeat) run several rounds with the keeping done
// by a stated objective.
//
// The two decisions that make it that are here, extracted from the screen because
// they are exactly the kind that fail silently: a policy that quietly stopped
// pinning, or that let a pinned creature be the one breed() drops, would look
// like nothing at all from outside.

/** Pool size and round counts. Physics rounds cost ~4 s each; geometry is free. */
export const BURST = {
  pool: 12,
  // Rounds when the objective must simulate. Six is what fits the budget the
  // old burst already spent (~20 s), now spent on selection rather than on
  // re-adapting creatures that were never going to be kept.
  physicsRounds: 6,
  // Geometry costs no simulation, so the same wall-clock buys far more search.
  freeRounds: 20,
  // Hill-climb per body: (1+3)x2 = 7 evaluations. Below gait.js's (1+8)x3
  // default because the burst now pays for MORE ROUNDS instead of a deeper climb
  // per body — the outer loop is what the measurements say is worth the trials.
  candidates: 3,
  iterations: 2,
};

/**
 * Who breeds this round: the player's pins, then the best of the rest.
 *
 * PINS COME FIRST IN THE ARRAY AND THAT IS LOAD-BEARING, not cosmetic. breed()
 * drops `selected[ELITE_CAP]` when the selection overflows the elite budget —
 * the LAST one, deliberately, so the outcome is predictable from the player's own
 * last tap. Here it means a pinned creature can only be dropped if the pins alone
 * overflow, which the caller prevents by construction. Ordering this array the
 * other way round would silently discard a pin on a full tank.
 *
 * @param {number[]} pinned  slot indices the player selected; always breed
 * @param {number[]} scores  per-slot objective score, aligned with the pool
 * @param {number} selectN   how many parents this round wants in total
 * @returns {number[]} indices to hand breed() as `selected`
 */
export function burstSelection(pinned, scores, selectN) {
  const isPinned = new Set(pinned);
  const room = Math.max(0, selectN - pinned.length);
  const rest = scores
    .map((s, i) => ({ s, i }))
    .filter(x => !isPinned.has(x.i))
    // Index as the tie-break, so an all-zero round (nothing viable, everything
    // scores 0) is still deterministic instead of depending on sort stability.
    .sort((a, b) => (b.s - a.s) || (a.i - b.i))
    .slice(0, room)
    .map(x => x.i);
  return [...pinned, ...rest];
}

/**
 * The final tank: every pin back in its OWN slot, untouched, and the free slots
 * filled by the best of everything else.
 *
 * "Untouched" is the whole promise of pinning and it is why this returns indices
 * into the pool rather than genomes — the caller copies references, so a pinned
 * creature is the same object it was before the burst, which is the same
 * guarantee N18 gives an elite across a breed.
 *
 * @returns {number[]} length `population`, pool indices, pins at their own slot
 */
export function burstKeep(pinned, scores, population) {
  const isPinned = new Set(pinned);
  const out = new Array(population).fill(-1);
  for (const i of pinned) if (i >= 0 && i < population) out[i] = i;
  const rest = scores
    .map((s, i) => ({ s, i }))
    .filter(x => !isPinned.has(x.i))
    .sort((a, b) => (b.s - a.s) || (a.i - b.i))
    .map(x => x.i);
  let k = 0;
  for (let i = 0; i < population; i++) if (out[i] === -1) out[i] = rest[k++];
  return out;
}
