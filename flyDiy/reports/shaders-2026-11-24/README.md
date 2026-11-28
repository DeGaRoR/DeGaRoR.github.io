# Shader programs and materials, 24 Nov 2026

Every shader program the game linked in three runs on the user's box (RTX 3080, 5120x1440): a cold boot with the garage and
an 8-minute flight (L40M), a crash (L40M), and a garage-first load (the lab). Merged by program key. Made by
`python tools/perf/programs_csv.py <out dir> <flightlog.json> ...` from the flight recorder's `prog` / `progready` /
`linkwait` events; any newer flight log gives a newer list.

- `owners.csv`: one row per owner family (e.g. `aircraft / skin`): programs, materials, distinct shader sources, times.
- `materials.csv`: one row per material (owner + material name + three type): how many programs it costs.
- `programs.csv`: one row per program, with its owner, material, key and shader source fingerprint.

Columns:
- `owner` is the material's `progOwner` label (who made it); `family` is its first two parts.
- `programs` per material > 1 means variants: the same material compiled again for another light count, shadows on or
  off, fog, instancing, skinning, a scuff layer, or another render target (the env cube, the shadow map, the mirror).
- `distinct_shader_sources` / `shader_source_fp`: programs whose generated text is identical share a fingerprint;
  `same_source_programs` > 1 = the same text linked more than once under different keys (a cheap merge candidate).
- `link_ms`: the time from the link request to the program being ready. Links run in parallel on the driver, so the totals
  overstate wall time; they rank, they do not add.
- `first_use_wait_ms`: how long a frame (or a compile step) actually waited on that program - the part the player feels.
- `first_linked_in_step` / `first_ctx` / `target`: the boot step, whether a compile or a draw asked for it, and the target.
- `seen_in`: which of the three runs linked it.
