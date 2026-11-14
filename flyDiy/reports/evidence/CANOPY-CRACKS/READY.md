# CANOPY-CRACKS READY 1 (G3916, 12-13 Nov 2026, for train L40m / L40a)

For A0 (your GO: option B as a clean replace, acrylic + laminated; the rest stays study). On master **23ce68c1f** (L39b).
Code 3a7aeca3b, built 9e78043a1 (build a38bc1af3408), this note on top.

## Coded vs study

- **Coded:** the G3623 procedural star (fbm rays + 6x haze + rings + Voronoi honeycomb, ~70 hashes a fragment) is
  replaced by a baked crack sheet, one textureLod + ~30 ALU:
  - tools/crack_sheet_bake.js -> media/tex/crack/{acrylic,laminated}.<sha8>.png (~390 KB each) + the GENERATED table
    src/viewer/crack_sheet.js (manifest: before dmg_glass.js; GATE MEDIA's list).
  - dmg_glass.js GLSL_CRACK / crackJS; sheetOf: glass -> laminated, acrylic / polycarbonate / none -> acrylic.
  - aeroskin.js: tCrack (no-crack stand-in texel) + uCrackMat in aeroSharedU0; the eye for the glint; no new program.
  - app.js glassSheet: the flown aeroplane's sheet is fetched + uploaded at the flight start (glazing capture, damage on
    only), never at the crash. FLYDIY_GLASS_TEST(sev, at, look).
- **Study only** (HANDOVER G3916 "Not done"): option C (hole + shards held in the frame; the dark side through the tint
  pass), the polycarbonate and tempered looks (dropped by the user), contact-point triggers (the Deform Coordinator's).
- **Latent:** no flag (the user's "clean replace"). Nothing changes by default: the sheet loads only with damage on at a
  flight start; nothing draws until a frame member near the glass yields or breaks (G3623's triggers, unchanged). No
  new per-frame work.

## Gates (run_gates --no-build, this checkout; master = 23ce68c1f built in the SAME checkout)

| gate | branch | master | by check name |
|---|---|---|---|
| DMGGLASS (G3916) | PASS, selftest PASS | - | S U K G R B N T ok |
| DMGSKINGPU | PASS | - | |
| UISMOKE | PASS | - | |
| PROGRAMS, MEDIA, BUILD, SKINMAT | PASS | - | |
| LIVERY | FAIL 2/328 | FAIL, the same 2 | Cub strut paint (castAlu), standing |
| DMGLOOK | FAIL | FAIL | trunk rows only; the failing build flips run to run (jodel / metal / cub trunk-0), standing |
| FRAMECOST | FAIL | FAIL (cessna stand/draws.main) | extra on the branch: stand/taxi draws, uniforms, programs on cub + cessna = the STALE PARKED COOK |

FRAMECOST: src/core/parked_packs.json is keyed on build e4db3663b937 (master); this tree is a38bc1af3408
(`node tools/parked_cook.js --check`: STALE, "every key is captured live until a re-cook"). The aeroplane's own draws
are identical on both (84 main, 71 materials, 15 programs); the garage reads show the live capture (canvas drawImage
536 -> 608, +6 programs). The train's re-cook (as L38c2) clears it; re-run FRAMECOST after it.

## Evidence

reports/evidence/CANOPY-CRACKS/: cockpit stills on SwiftShader (tools/dmg_glass_stills.js): the page's default Cub,
acrylic at 1 and 0.3, the laminated look (--look laminated), list:40 Cessna 172 (career) --at view; stills.txt. Unseen
on a real GPU. Study + before/after: futureDesigns/CANOPY-CRACKS-2026-11.md, futureDesigns/canopy-cracks/canopy_cracks.html.
