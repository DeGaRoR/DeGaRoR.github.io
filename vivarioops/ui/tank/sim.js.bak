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
  return { steps, carry: accumulated - steps * dt, dropped: wanted > maxSteps };
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

/** 21 §4.3: Speed cycles 1x/2x/4x, and is disabled while paused. */
export const SPEEDS = [1, 2, 4];
export const nextSpeed = (s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length];

/** 21 §4.4 — the states the screen can be in. */
export const STATE = {
  LOADING: 'LOADING', EMPTY: 'EMPTY', SIMULATING: 'SIMULATING',
  PAUSED: 'PAUSED', BREEDING: 'BREEDING', SHEET_OPEN: 'SHEET_OPEN',
};

/** 21 §4.4: "The BREEDING beat is not decoration" — 600 ms, visible. */
export const BREEDING_MS = 600;
