# crew_cut: the cockpit as the game draws it, checked

These tools were built on 16 Nov 2026 for the LS4-alike. The user asked to see where the pilot sits, and for "the pedals
and the controls and all that stuff" not to poke through. The quick renderers (quickshot.js, cabin_stills.js) draw no
pilot, because the characters are only loaded in the load chain and the browser. These tools draw and measure the pilot
from the load chain, in the frame the crew layer works in (layer metres, +z the nose, +x the pilot's left).

## The one command

    tools/crew_cut/check.sh <build.json> <out-dir> <name> ['{"seatZ":-0.40,"dashBack":0.70}']

It takes about 45 s. The optional JSON holds cage rows written over the build's own, so a variant needs no file. It
prints:

- the dump's counts;
- the clash: the pilot's body against the dash shell and the panel, as points within 12 mm, and where they are;
- the pilot's head top, the body's extent and the reach misses. A hand misses by about 0.09 m and a foot by about
  0.06 m when it holds its grip, because the miss is measured from the wrist or ankle to the grip;
- the crew parts that stand outside the skin.

It writes:

- `<name>.png`, the cut;
- `<name>_side.png`, the outside with the hull whole;
- `<name>.poke`, the full list of parts outside the skin.

## The pieces

| file | what it does |
|---|---|
| `dump.js` | Runs the load chain with `probe_scene.js`: every visible mesh's triangles, with the pilot posed, plus the hull sheet from `_scene_headless`. |
| `cut.py` | The side cut with the near half of the hull removed and the crew whole. `--whole` keeps the hull opaque, so a crew part you can see is a part through the skin. `--view bottom` looks from below. |
| `poke.py` | Checks each crew vertex against the hull's outer skin and its composite liner, along a ray from the section's axis. |
| `clash.py` | Checks the pilot's body against the dash shell (`dash`, `dashFace`) and the panel (`edPanel*`) on a voxel grid. Keep the grid: a dense distance matrix once ran the session out of memory. |
| `bodycg.js` + `probe_bodycg.js` | The drawn pilot's mass centre: the posed bones with Winter's segment fractions, measured against the seat back. Use `--sweep` to vary rows. |

## How to read it

- **A `1000mm` row in the poke list.** The ray from the axis missed the skin, usually at a single vertex on a panel
  edge. Ignore it unless a whole part shows it.
- **A part flush on the wall.** The trim wheel's plate sits on the liner within 3–5 mm. The liner is 2–3 cm inside the
  outer skin, so nothing shows outside. A part that is really through the skin shows in `_side.png`.
- **Running beside the gates.** Never run this while a gate battery runs on the same box. The load chain and the gates
  compete for memory, and one of them gets killed.

## What it found on the LS4 (16 Nov 2026), and the rules it led to (`_cage_crew.js`, `_panel_gen.js`, `_cage_join.js`)

- **Floor through the belly (25 mm).** The floor's wall filter skipped the `composite` liner of a glass or carbon body,
  and the board ran on where the belly rises through it.
- **Pedal axle, airbrake bracket, trim plate (2–3 cm through the round flank).** `wallAt` reads only vertices more than
  15 cm off the centreline, so low in a round belly it answered 90 % of the cabin's half-width. The fix is `A.wallIn`,
  an exact ray at that height.
- **Portable GPS through the canopy (10 cm).** The fix is `A.ceilAt`. The cradle refuses a place through the glass, and
  the unit then goes on a side arm on the right wall.
- **A reclined pilot billed 0.1 m too far forward.** The join's station was 0.20 m ahead of the seat back for every
  seat. The drawn body bears that out upright (0.19 m), but measures 0.127 m in a 42° seat and 0.088 m in a 50° seat.
  The fix is `seatsAt[].cgFwd` (SEAT-CG), blended in between 28° and 42° of back.
