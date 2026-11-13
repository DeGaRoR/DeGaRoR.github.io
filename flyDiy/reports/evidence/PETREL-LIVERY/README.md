# PETREL-LIVERY: the original Petrel liveries (SEAPLANES-LAND, 9 Nov 2026), recovered 13 Nov

The user's words (13 Nov, via A0): "It had designed one which was too dark, but it had this glorious WAVY pattern, a
sunburst but wavy, on the FIN. Then I asked for it to be CREAM ... The wavy pattern on the fin is the key."

Both are full cards of `builds/candidates/superpetrel_V4_1.json` as it stood on 9 Nov, with only `paint` and `finish`
changed (geometry, engine and floats are master's V4.1). `livery_layers.json` holds just the two `paint` + `finish`
blocks, to port onto V4.2.

## The two cards

- `superpetrel_V4_1_DARK_sand_2026-11-09.json`: the first one, the user's "too dark" (9 Nov 21:52). The paint base and
  trim are sand (0xD2B48C), but the m1 sweep paints teal over most of the airframe, so it reads dark.
- `superpetrel_V4_1_CREAM_2026-11-09.json`: the cream version (9 Nov 21:57). The same four decal layers, with:
  - the body sections tinted sand (0xD2B48C);
  - wings, tail, cowl and pylon, cabane, float decks, struts and interplane struts tinted cream (0xF2EAD3);
  - the two off-white decal colours (m2 D, m3 B) turned cream (0xF4F0E1 -> 0xF2EAD3);
  - subtle weathering added: `finish.weather` age 0.15, flight 0.2, bush 0.08, rain 0.1.

## The decal layers (finish.decals, the same in both)

| layer | pattern (aeroskin index) | what it is |
|---|---|---|
| m1 | 2 sweep | the teal (0x1F5A63) boot-top sweep, terracotta keyline (0xC0573A) |
| m2 | 1 twin stripe | the cheat line along the hull |
| **m3** | **7 sunburst, target 5 (the fin)** | **THE FIN'S SUNBURST: 14 rays (m3P), ray width 0.45 (m3Q), origin along 0 (m3R, the fin's root), origin across 0.5 (m3S); rays teal 0x1F5A63 (m3A), between them off-white/cream (m3B), m3Clr 2. The wave the user saw comes from the rays fitted over the fin and rudder's curved, swept surface** |
| m4 | 5 fade, target 4 | the teal wing-tip fade |

## Pictures (on the box, out of git)

- DARK: `D:/Dev/flydiy-notes/evidence-2026-10-18/2026-11-09/petrel-drawn/fix1/petrel_fixed_q34.jpg` and
  `petrel_fixed_side.jpg` (9 Nov 21:53; the wavy fin is plain on the q34).
- CREAM: `D:/Dev/flydiy-notes/evidence-2026-10-18/2026-11-10/petrel-items/petrel_cream_sand.jpg` (10 Nov 03:26, the crop
  sent to the user), from the full frames `S_side_11m.png`, `S_q34_10m.png` and `S_q34_26m.png` in the same folder.

## Why it was lost

It was never committed. The DARK card was designed in the worktree's `builds/candidates/superpetrel_V4_1.json`, copied
to the session scratchpad as `superpetrel_V4_1.sand.json`, and the worktree file was reverted (the rule: nothing changes
looks without the user's yes). The CREAM card was built from it in the scratchpad and drawn once, in an exported tree as
`superpetrel_cream_scratch.json`, for the 10 Nov 03:13 slot. It stayed "local until the user OKs". The yes never reached
SEAPLANES, and the V4.2 card (REAL-FIGURES' practical-cerf branch) was made from master's V4.1, which carries the plain
one-sweep livery. The scratchpad copies are what this folder holds, byte for byte.
