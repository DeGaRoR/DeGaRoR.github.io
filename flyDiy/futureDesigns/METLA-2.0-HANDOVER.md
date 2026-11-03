# METLAKATLA 2.0 — handover (HWCOV / METLA-ON session, 18 Oct 2026)

## 0. THE KEY OBSERVATION (the user, 18 Oct, watching the run)

> "Even when the town is only a few boxes, it impacts frame evenness like crazy. It's not normal with regard to the amount
> of geometry involved. We have to do better than that."

**The numbers agree.** At 6.4 km the town on screen is a few boxes: +16 draw calls, +1.4 M triangles, and taking 0.6 M of
those away (the far roads) changed nothing. Yet:
- frames over 100 ms go 0.02 % → 0.33 %, sixteen times more;
- the worst frame goes 167 → 300-750 ms;
- p99 goes 50 → 66.7 ms;
- the loop is +4 ms.

**The spikes are not geometry.** They are per-object CPU work done for a town that is far away and idle.

**The 2.0 requirement: an idle far town costs ~0 ms of CPU per frame and allocates nothing per frame.** It is measured, not
assumed: a per-frame "town ms" meter (every town-owned tick summed into the frame row), and every >100 ms frame attributed
by a profile (`rollout_perf --profile-live`).

What to look at, all per frame (or per stream tick) and per house / plot / object. None of it has been profiled yet:
- **the streaming queue**: `sortFrom` re-sorts the whole queue, every plot, and any build that lands in a frame (a house,
  a lot, a kit row);
- **per-house builds and teardowns** (buildOne0, bareMetla's disposals) and the GC they leave;
- **the world update / the town tick**: detailTick, hlodTick, traffic, life loops over every plot, not the near ones;
- **matrix updates and culling**: three's updateMatrixWorld and the frustum test over every town Object3D. There are 279
  house objects ON vs 42 OFF, all culled at the circuit, paid every frame anyway;
- **shadow re-tags** (ktShadow) and **lotsNear** (every 10 frames over the lot cells): cheap per call, but they must not
  walk the town;
- **GC from allocations**: arrays, closures and vectors made per frame per object; a GC pause is a spike.

**The user, 18 Oct:** "wrap up what we have. Maybe publish it behind a flag for now. And let's focus our efforts later on
Metlakatla 2.0. We have lost enough time with it."

Metlakatla stays **behind the town flag, default OFF**: the GRAPHICS 'towns' row → 'with Metlakatla' (capped on laptop,
potato and the software rung), or `?town=1` in the URL. With the town OFF the **seaplane base stays** as a standalone site.
It is `PREMISES_GEN.TOWN_OFF`: the `mk_sea` water lane with its player plot, the `mk_mp_air` trestle and the `mk_mf_air` float.
The career's minedock arc (minedock.05 / .06), the generated jobs and the floats' routes all fly there. Branch
`claude/ready/metla-wrapup` (core TOWN_OFF + world_boot + the 'default' cook variant + GATE PREMISES 14q rows).

## 1. What is on master (proven, keep for 2.0)

| lever | what | effect (ON − OFF, floats circuit) |
| --- | --- | --- |
| G3210 lever 1 (L15c) | **Metlakatla bare**: an mk_ plot's fence and yard, mk_ site fences, mk_ road rails taken down at buildOne0 (`?metlabare=0`). **Lots near-only**: a lot cell's merged meshes drawn within 600 m only (`?lotnear=`) | loop +12.1 → +5.8 ms, draws +506 → +22, tris +5.4 M → +0.6 M, lots held 549 → 110 MB, heap +1.5-2.3 → +0.8 GB |
| G3212 lever 2 (L18a) | **The kit far-deferred in the premises stream**: a kit plot farther than 1200 m sorts behind every near one (`?kitnear=`). **Kit shadows near only**: a kit host casts within 600 m (`?kitshadow=`) | premises stream 3.0 → 0.01 ms/frame, loop +5.85 → +4.75 ms, frames >34 ms 9.85 → 4.16 % (OFF 1.88), >100 ms 0.49 → 0.16 %, heap +0.9 → +0.3 GB |

Not landed: **G3214 far roads** (branch `claude/metla-roads-g3214`, d6d01cdd1). Past 1500 m the town's roads are one
coarse ribbon (`?roadfar=`), the town's sources merged in their own buckets. The user OK'd the look, but there was **no
measurable gain**: −0.6 M tris, same draws, loop within run-to-run spread. It was pulled from L18d. Retest it only where the
GPU is the limit (the laptop rung with `--gpux`).

## 2. Where Metlakatla ON stands (18 Oct 20:05, d6d01cdd1 = master L18b + far roads)

Rig: floats (`bugReports/cessnaFloatsWOrks.json`), mirror pinned off (`--gfx-set mirror=off`). The arms ran
B C O O C B: B = ON + far roads, C = ON as master, O = OFF (`--variant nomet-sea`).
Evidence: `D:/pl/tools/flyDiy/reports/evidence/PERF-LEDGER/metla-on4/`, summary `node tools/perf/metla_ab3.js <dir> --prefix ab`.

| window | p99 ON / OFF | >34 ms ON / OFF | >100 ms ON / OFF | worst ON / OFF | loop ON − OFF | world | render | draws | tris |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| circuit, 6.4 km from mk_sea (median) | 66.7 / 50.0 | 1.95 / 1.40 % | 0.33 / 0.02 % | 300 / 167 ms | **+4.0 ms** | +1.5 | +2.5 | +16 | +1.4 M |
| close visit, < 1.5 km of mk_sea | 83.4 / 33.5 | 2.42 / 0.66 % | 0.93 / 0.03 % | 334 / 167 ms | **+7.8 ms** | +4.5 | +3.4 | +140 | +3.4 M |

**The enable rule** (ON adds ≤ 3 ms of loop at 4 km, and frames >34 ms within ~1 point of OFF):
- evenness passes (+0.55 pt);
- the loop fails (+4.0 ms);
- the close visit is the real blocker (p99 83 vs 34 ms, +7.8 ms).

## 3. Where the milliseconds go — as far as known (not profiled: the 01:50 profile slot was cancelled)

- **render +2.5 ms at 6 km with only +16 draw calls**: this is not GPU work. The census (metla_eval `census`) shows ON
  carrying 279 `premises:houses` objects against 42 OFF (237 more, every one frustum-culled at the circuit: `inView` 0), plus
  more patch, box and prop objects. The cost is the renderer's per-object CPU work (matrixWorld, culling, the render list)
  over the town's scene graph, paid every frame for objects that never draw. **2.0: no per-house Object3D far away.**
- **world +1.5 ms (circuit) / +4.5 ms (visit)**: the town's per-frame JS (detailTick / hlodTick / traffic / life loops over
  every plot, G3210's next-lever note). Lever 2 removed the stream's share (3 ms → 0.01) but not these. **2.0: per-frame
  work O(near), never O(town).**
- **The hitches (>100 ms 0.33 % vs 0.02 %, worst 233-750 ms ON)**: unexplained. Candidates are a stream build or program
  compile landing in a frame (the near kit, lots near-only switching cells). Profile with `rollout_perf --profile-live <at>,<secs>`.
- Triangles are not the limit on this box: the far roads took 0.6 M away for no gain.

## 4. The 2.0 rebuild (the direction the numbers point to)

1. **A cooked, instanced town kit**: every house, outbuilding and prop of the town as instance rows. The kit host already
   draws the kit houses from the cooked instance table (BatchedMesh). This becomes the only path: no per-plot Object3D,
   no per-plot JS.
2. **Merged far cells**: past ~1 km the town is a handful of static merged meshes per cell (roofs, walls, the roads'
   ribbon, the lots' ground), one draw per cell, built at cook time, not at boot. Near cells switch to the instanced kit.
3. **Per-frame JS bounded by the near ring**: traffic, life, detail and HLOD ticks walk a near list kept by the stream,
   not the town.
4. **Shadows near only** (lever 2's kit rule, for everything).
5. Measure with the same rig: the same route, arms and summary (section 5). Accept on the enable rule **and** the close
   visit (p99 ≤ ~50 ms within 1.5 km).

## 5. Tools kept (rig tree `D:/pl/tools`, branch claude/perf-ledger-g3200)

- `tools/rollout_perf.js`:
  - `--variant nomet-sea` (OFF with the runways kept) and `--fixture`;
  - `--gfx-set k=v` (a row pinned over the default preset, e.g. `mirror=off`);
  - per-frame draws / tris (r[29] / r[30]);
  - `--profile-live`, `--gpux` / `--gpux-at` (the GPU proxy).
- `tools/perf/metla_eval.js` (town state, census by class, lots held, heap), `metla_report.js` (OFF/ON evenness by window),
  `metla_ab3.js` (three-arm A/B: evenness first, then the loop).
- `flyDiy/tools/perf/roads_far_diag.js` (node page: the far-roads switch, `DIAG_Q`; on the roads branch).
- Routes: the floats now fly into mk_sea (`--dest mk_sea`, floats-fix G3078); `--dest CIRCUIT` is the 4-6 km window.
- Evidence: `reports/evidence/PERF-LEDGER/{metla, metla-on, metla-on3, metla-roads, metla-roads2, metla-on4}/`.

## 6. Traps met

- A whole-build town (the spawn within the 7 km geo reach) has no town part. Anything hooked on the part never runs.
- The pavement merge joins parts whose boxes touch, so the town's roads merge with the field's unless bucketed apart.
- `premises_packs.json` 'default' is cooked from the record *as the page drops it*. Change the switch and that variant
  must be re-cooked (per cell: only the touched cells change). `premises_cook.js` reads `TOWN_OFF` for it.
- The LIFTS regions of render_premises.js must stay byte-identical (GATE PREMCOOK).
- A timed A/B needs an empty box. A user playing on the box voids it (16:35 slot, 18 Oct).
