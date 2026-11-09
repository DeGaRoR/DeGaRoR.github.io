# SHED-FLOOR + VEG-1 READY (CABIN-CRAFT, 9 Nov 2026, for the next train)

Branch claude/ready/veg-1, on master ebc4c9edd (L35d). Code 24b0668ae + e36f0c882, built 9d7f6a0ce (build d37aa32e1ab9). On top: this note and HANDOVER.

The user 8 Nov, via A0: "looking at flowers and small vegetation is really something that caught my eye... let's first try to keep optimizing what we have, the flowers and the berry bushes." A0: no new species, no cost increase (draws and tris counted); and the grass on the world sheds' floors.

## What lands

- **No ground cover on a standing shed's floor** (`render_world.js`, `cover_ring.js`). Grass, fireweed, bunchberry and a shrub (the "sapling") grew inside the world's works shed, on master too: the player sheds have no slab, and the cover's masks read only the surface and the water. Now every player shed files its footprint (its HD x HW plus 0.3 m, turned with the shed) in `SHED_FLOORS`; both cover rings (the field and the shared push) skip a plant inside it AFTER its draws, so every other plant's stream is untouched; a shed that stands or comes down replants only the cells it touches (`replantBox`).
- **The berry bushes gather into thickets** (`cover_ring.js`, the raspberry shrub rows). A bush walks up a 16 m clump field (up to 3 steps, inside its own cell, only onto ground the same land tests pass), so the same bushes stand in groups with open ground between: not one bush more. Size by the thicket (x0.82-1.18) with a few old big (x1.3) and young small (x0.62) ones; colour value +-12 %, shade in a thicket's heart, a few paler. New randomness comes from the per-position hash, so the shared cell stream is unchanged.
- **The flower beds** (on top of ROOF-LIGHTS's clumping, landed L35d): a few tall spikes (4 %, x1.35) and a few more strays near the beds (3.5 -> 5 % of the near rim).

## Stills (Mon 9 Nov 05:05-05:12, GPU UNTIMED; evidence-2026-10-18/2026-11-09/veg-1)

- Before = the roof-lights tree's stills of 8 Nov (`2026-11-08/roof-lights/after2/HOME.2` and `after2/HOME`), the same rig and eyes.
- **Works B1_side (inside the shed)**: before, a field of grass with fireweed, bunchberry and the sapling on the floor; after, the bare floor and the path, nothing growing. Club B1_side: nothing grew there before or after.
- **Club O (the bed in the background)**: the clumped bed keeps its look, with a few taller spikes and strays; the bushes to its right regroup.
- No eye in the rig frames a thicket from near. A bush eye would be the next still if the user wants to judge the thickets.

## Cost

- Node census (scratchpad `veg_probe.js`, the stub cover ring on L35d): shrubs 3840 (= master), instanced meshes 192 (= master), so draws and tris unchanged. Shrub nearest neighbour 3.60 -> 2.98 m, empty 10 m squares 35.5 -> 43 % (the thickets). Shrub meshes now carry an instance colour (96 coloured meshes): at most one program variant, no draw.
- Floor cut (`floor_probe.js`): inside 269 -> 0, outside 211 275 identical; removing the shed restores all of it exactly (4 cells dropped and regrown). CPU: one bounding-box test per plant per standing shed, at build time only.

## Gates (node, on the rebased tree)

COVER PASS, FADES PASS, STAND PASS, HANGAR PASS, HANGARVIEW PASS; node --check OK.

## Open

- The grass field thinner in the flower beds' cores (how they meet the grass): needs a bed test per tuft; later, with its CPU cost measured (A0).
- The sheds' floors are bare terrain (no slab), on master too: a floor is a separate piece of work.
