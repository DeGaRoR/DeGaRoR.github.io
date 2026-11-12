# CANOPY-CRACKS — how to draw broken glazing with a professional look (study, no code)

12 Nov 2026. For A0 (Performance Coordinator) and the Deform Coordinator. Implementation comes after the perf round
(13–14 Nov), on the user's choice.

## DECISION (the user, 12 Nov)
**Option B, with two looks only: acrylic and laminated glass.** The polycarbonate look ("plain unreadable") and the
tempered look ("not good enough") are dropped and not built. Two sheets, not three:
- `glazeMat` 0 acrylic → the acrylic sheet;
- `glazeMat` 1 polycarbonate → the acrylic sheet for now (no polycarbonate look kept; no listed plane uses it);
- `glazeMat` 2 glass → the laminated sheet on every pane (no tempered split).

`uCrackMat`: 0 = acrylic sheet, 1 = laminated sheet. C (the broken pane) stays the follow-up, for these two looks
only: the acrylic hole with shards held in the frame, and laminated glass that holds. Sections 2-5 below are the
study as written; where they describe polycarbonate or tempered looks, the decision above overrides them.

- The page, with pictures inline (mock-ups drawn live, the real stills, a viewer): https://claude.ai/artifact/68UDJfb7MQRDhC7QdkF1QC
- Its source: `futureDesigns/canopy-cracks/canopy_cracks.html` (self-contained, opens in a browser)

The user, 12 Nov, on the Super Petrel (list:41 Super Petrel LS) crash stills: the canopy cracks look "like children
drawings", and that pattern does not happen on polymer glass.

## 1. Why today's crack reads as a child's drawing (G3623, `src/viewer/dmg_glass.js` GLSL_CRACK)
1. **A chalk stroke.** Each ray carries a haze of 0.55 out to max(6w, 2 px). From the seat the lines come out
   3–5 px wide and evenly glowing. A real crack is a hairline, invisible along most of its length.
2. **Hand tremor.** The ray angle wobbles with two fbm octaves. Brittle cracks are straight with sharp kinks, and they
   fork. The angular-cell method cannot fork.
3. **Same brightness everywhere.** Every ray adds 0.85 × irradiance from centre to tip. Real cracks are facets that
   glint where they face the light and stay faint elsewhere. The add-only pane cannot darken, so the dark side is missing.
4. **A spider web plus a honeycomb.** The rings are a laminated-glass feature. The Voronoi net (`dgVor`, 60 cells/m)
   is tempered-glass dicing. Neither happens on 3 mm acrylic.
5. **Scale and count.** 5–9 rays from one point over up to 36 cm make a symmetrical asterisk. Real acrylic has a small
   crushed white spot, a fringe of short cracks (hackle) and a few long runners to the frame.
6. **One look for all materials.** The polycarbonate pane breaks like acrylic.

## 2. Real materials
- **Acrylic** (cast or stretched; the whole fleet): brittle. A crushed, whitened spot, short hackle, and a few long
  branching runners that run to a frame or edge. Shards are sharp and can come out (the 2010 Jersey bird strike; the
  S-76 N748P cast-acrylic windshield). Rings are rare and short. Stretched acrylic keeps its runners shorter.
  AC 43.13-1B's stop-drill (Fig. 3-21) exists because acrylic cracks run.
- **Polycarbonate:** ductile. It dents, stress-whitens to a milky ring and crazes (fine micro-cracks lying in rings,
  sparkling together). A severe hit gives a petalled puncture tear, never long running cracks.
- **Laminated glass** (windscreens on bigger types): a spider web that holds on the PVB interlayer. The pane bulges and
  each fragment catches the light differently.
- **Tempered glass** (side panes): holds, or dices whole into 1–2 cm cubes and falls out, leaving a fringe in the frame.

## 3. The garage row: it exists
`glazeMat` (cage glazing group: acrylic 0 / polycarbonate 1 / glass 2) → `cabin.glazingMat` (`_cage_join.js`). The
weight (`GEN_OUTFIT.glassKgM2By`), the tech tree (`79b_tech.js` `glaze:*`) and the clear-pane look (`aeroskin.js`
`GLASS_MATS`) read it. **The crack does not.** Every listed plane is acrylic today.
- Smallest change: one float uniform `uCrackMat` in `aeroSharedU`, set at roll-out. A uniform links no new program.
- For glass (2), split by pane role on the existing material names: `windshield` is laminated, the other panes tempered.
- A cast/stretched sub-row is not worth adding: the only difference is runner length, and that can ride severity.

## 4. Techniques (phone budget: a stable 30 fps on weak machines)
- **Procedural in the shader** (today): about 70 hash calls a fragment inside the star, up to 4 marks, cannot fork.
  Keep it only as a fallback.
- **Crack decal atlas with distance-field lines** (Green, Valve 2007): any shape, crisp at any zoom, mipmapped.
  1–2 reads. **Use it.**
- **Glint per facet, stress-whitening, crazing, thickness parallax** (a dark companion offset by 3 mm of sheet): cheap.
  **Use them.**
- **Normal-mapped crazing:** keep G3623's roughness bump. No normal writes (the smooth-shading rule).
- **Screen-space refraction:** needs a copy of the frame. Rejected.
- **Shard meshes or runtime Voronoi fracture:** draw calls, bodies, floating pieces and torn triangles. Rejected. A
  discard hole plus shards held in the frame gives the read.

## 5. Options
| | Look | Per-pixel cost | Memory | Sessions |
|---|---|---|---|---|
| Today | childish (the user) | ~70 hashes | 0 | – |
| A: retune GLSL_CRACK | clean hairlines, glint per ray, white core, per material, no forks | ~⅓ of today | 0 | 1 |
| **B: baked crack sheet per material** (recommended) | forks, hackle, segment glint, thickness, per material | 1–2 reads + ~40 ALU | 1.3–5.3 MB, lazy, own material only | 2 |
| **C: B + the broken pane** (then) | acrylic hole + shards held in frame; PC petals; laminated holds; tempered falls out | +1 read on the tint pass | +0.35 MB | +1 |

The costs are estimates from reading the shader. The perf round should time today's crack against B's read with a full
windscreen in view.

**B, the sheet:** R the distance to the crack (0–8 mm), G the arrival order (reveals by severity and tapers the tips), B
the facet phase (glint), A the whitening and crazing. Two sheets (acrylic, laminated glass; the decision), each holding 2×2 variants
picked and rotated by the mark's seed. A node generator `tools/crack_sheet.js` (seeded) writes them. G3623's
triggers, gating, tangent frame, irradiance scatter and roughness bump stay. GATE DMGGLASS gains rows for the sheet
hash, monotone reveal, the material switch and 0 new programs.

**C:** the hole is a discard in both glass passes (the add pane and the tint companion). Nothing new is spawned.

For later, to the Deform Coordinator: a trigger from the contact point on the pane, so a trunk that hits the glass
between members still marks it (G3623's stated limit).

## Sources
FAA AC 43.13-1B ch. 3; Mitsubishi Chemical PMMA vs PC; Laird Plastics; Plaskolite; K-online (PC deforms instead of
shattering); States of Jersey 5 Jul 2010; FAA lessons learned S-76C++ N748P; FSF "Windshield weakness"; AAIB Bell 429
M-YMCM; Wikipedia: laminated glass, tempered glass, fractography; C. Green 2007 (SDF); Desbenoit et al. 2005 (cracks).
The links are on the page. No copyrighted images are copied into the repo; the only pictures are the game's own stills
(`reports/evidence/DMG-GLASS/`) and the page's drawings.
