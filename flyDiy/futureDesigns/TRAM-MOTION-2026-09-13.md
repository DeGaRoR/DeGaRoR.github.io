# THE TRAM MOVES — a plan (2026-09-13)

The user: "At some point, we will want to see these move. Can we start
planning for it and thinking about it? And they should adapt to different
cable length, so we can deploy and reconfigure easily, it's not tied to a
single slope value."

This note fixes the CONTRACT between what the generators publish and what a
runtime needs to move two cabins on a jig-back line, so that the geometry
side (done, G342-G349) and the motion side (to write) meet at one record and
nothing is tied to one slope, one length or one pair of stations.

## 1. What is already published, and why it is enough

Every station build publishes `stats.station`, in the station's own frame:

| field | meaning |
| --- | --- |
| `hooks.track[i]` | `{p, dir}` the track rope's point on the saddle (top) or the saddle shoe (base) for line `i`, and the unit direction the rope LEAVES in |
| `hooks.haul[2i], haul[2i+1]` | the haul rope's two strands off line `i`'s wheel: the top strand and the bottom strand, tangent points and direction |
| `hooks.anchor[i]` | where the track rope is fixed behind the saddle (the arch cable's start at the top; the drum at the base) |
| `hooks.dock` | `{p, dx, w, depth}`: the cabin's floor origin when docked, the two lines' offset `±dx` across, the slot's width and depth |
| `wheels[i]` | `{c, r, axis}` the bull wheel (top) or tension wheel (base) of line `i` |
| `ropeAtDock`, `hang` | the track rope's height over the dock and the cabin's carriage height over its floor origin - the two numbers that made them agree |
| `kind` | `'top'` / `'base'` |

The village places two stations and solves the line between them
(`VILLAGE_GEN.tramLine`): it reads both stations' hooks in the WORLD, takes
the angle the hooks make, sets `lineDeg` on both presets and builds again
(three passes; the hooks move under a centimetre), then publishes
`vil.tram = { angle, ropes: [{a, b, kind}], docks: [{p, yaw, dx, station}] }`.
Nothing in either generator assumes a slope: the arch is solved from the
cabin's hang and the line's angle; the barn's eave, the tower's crossbeam
and the wheels' heights are solved from the rope over the dock and the
angle. Put the stations anywhere, run `tramLine`, and the ropes meet the
saddles and the carriages.

So the motion side needs no new geometry. It needs:

1. the four track ropes as CURVES, not straight lines (§2);
2. a cabin POSE along a rope (§3);
3. a schedule for two cabins (§4);
4. the wheels' spin and the haul strands' motion, cosmetic (§5).

## 2. The rope as a curve

A track rope between two saddles is a catenary; at tram tension it is
within a hand of a parabola. For a span from `a` (base) to `b` (top):

```
p(t) = lerp(a, b, t) - up * sag(t),   sag(t) = 4 * S * t * (1 - t),   S = k * |b - a|
```

with `k` the sag ratio (1.2 % of the span drawn today in the bench; a
dial). Nothing else is needed for the eye. The runtime keeps `L = |b - a|`
and the per-rope curve; the SAME function draws the rope (a tube) and moves
the cabin, so the wheels never leave the rope.

`t` is the cabin's parameter along ITS rope, 0 at the base saddle, 1 at the
top saddle. The docks are not at the saddles: the cabin stops where its
carriage is over the dock, i.e. at `t_dock(base) = tanBack_base / L` and
`t_dock(top) = 1 - tanBack_top / L` - both stations publish the distance
from the saddle to the dock along the line (`tanBack` at the top; `towerIn
+ dockIn` at the base), so the runtime derives the end parameters and
never hard-codes them.

## 3. The cabin's pose on the rope

The cabin prop's frame: its floor origin at (0, 0, 0), its length along z,
its carriage `hang` (8.6 m, `CABIN.HANG`) over the origin. On the rope:

```
carriage = rope.p(t)                       // the wheels sit ON the rope
tangent  = normalize(rope.p'(t))           // along the rope
yaw      = atan2(tangent.x, tangent.z)     // the carriage runs along the line
pitch    = 0                               // a hanger hangs VERTICAL: the cabin does not tilt with the slope
origin   = carriage - up * hang
```

The carriage is a short rail of wheels; on a 30-degree rope its ends sit a
few centimetres off the curve. Ignore it (the carriage is 5 m and the rope
bends 1 % over that), or pitch the CARRIAGE alone by the local slope if the
prop is ever split into hanger and carriage parts (the bake keeps parts by
material; the carriage is the `Black_Yellow` part's upper half - a split by
height is a one-line change in `cabin.js`'s plan if wanted).

The docks are where the pose meets the station: at `t_dock` the origin is
`hooks.dock.p ± dx` by construction (that is what `ropeAtDock == dock.p.y +
hang` in GATE HOUSE 38/39 holds), so a cabin arrives exactly in its slot
without a special case.

## 4. The schedule: a jig-back

Two cabins on two lines, tied by one haul loop: cabin A goes up while cabin
B comes down, both at the same speed, both stopping when one is in its dock.
One scalar drives everything:

```
s(time) in [0, 1]      // 0: A at the base dock, B at the top dock; 1: the reverse
tA = t_dock_base + s * (t_dock_top - t_dock_base)
tB = t_dock_top  - s * (t_dock_top - t_dock_base)
```

with a speed profile on `s` (a smooth start and stop over ~8 s at 0.6 m/s²,
cruise at `v` m/s, Goldbelt runs ~6 m/s), a dwell at each end (doors), and
the direction flipping at each dwell. Line lengths differ between the two
ropes of a pair by nothing (same saddles), and between stations by the
build, so `v` is in metres per second on the rope and `s` per second is
`v / L_cabin_rope` - the two cabins keep the same `s` because they share
one haul loop, and if their ropes' lengths ever differed (they do not, by
symmetry) the haul loop would still force one `s`.

## 5. The cosmetic motion

- **The bull and tension wheels** spin at `omega = v / r` about their `axis`
  (`wheels[i].axis` is x in the station frame), the top wheels one way and
  the base wheels the other for the same strand direction; when `s`
  reverses, both reverse.
- **The haul strands** are drawn as tubes between the base wheel's tangent
  points and the top wheel's, with the same sag as the track ropes; they
  need not move visibly (a rope moving along itself is invisible) - a UV
  scroll on the tube would be a later polish.
- **The carriage's own wheels** (the `Black_Yellow` part near the top of the
  prop) could spin; not needed at the game's distances.

## 6. Reconfiguration

To deploy elsewhere: place a `tram base station` and a `tram top station`
(any distance, any height difference within 15-45 degrees), call
`tramLine(vil, buildFn)`, draw `vil.tram.ropes` as tubes, stand the cabins on
`vil.tram.docks`. To change the cabin: `hangH` on both presets is the new
carriage height, the arch and the barn resolve. To change the line's angle
band: the gate's 15-45 is the tram's plausible range, not a limit of the
geometry. The stations know nothing of each other; the line is solved
between them, at their expense.

## 7. What to write, in order

1. `src/viewer/tram_run.js`: `TRAM_RUN.make(vil.tram, cabinsByDock) ->
   { tick(dt), s, cabins: [{obj, t}], wheels }` - the curve of §2, the pose
   of §3, the schedule of §4, the spin of §5. Pure math plus THREE objects it
   is handed; no geometry.
2. The village bench: a "tram runs" toggle that ticks it from the pane's
   pump (rAF is dead in the pane - the bench's own pump), the cabins it
   already stands on the docks handed over.
3. GATE VILLAGE 18: for `s` in 0, 0.25, 0.5, 0.75, 1 the cabins' carriages
   are on their ropes (distance < 1 cm), their hangers vertical, at `s = 0`
   and `1` a cabin is in a dock within 2 cm, the two cabins never closer
   than a cabin's width across (the lines are `2 dx` apart).
4. The game: the same module driven by the world clock; the sound and the
   doors later.
