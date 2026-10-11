# FREIGHT-ASSETS — the loads' own models (G2405-G2409, 2026-10-07)
### the existing props mapped to item kinds, the Poly Haven matches baked, and THE GAP LIST for the user's Sketchfab scouting

From FREIGHT-2026-10-07.md §4 / §4b and the user's ruling (7 Oct): *"The loads will need their own models. You are
allowed to use polyhaven if you find matching assets, otherwise I'll scout sketchfab."*

**Built:** a third library on the one prop baker (the pier kit's pattern) — `tools/load_table.py` (rows, SOURCES and the
CATALOGUE) → `tools/load_prep.py` → `src/loads/loads_load.js`, `loads_camp.js` + `media/geo/loads/`, `media/tex/loads/`;
levels by `node tools/prop_lod.js --kit loads` → `src/loads/loads_lods.js` + `media/geo/loads_lod/`; the catalogue with
MEASURED dims → `src/loads/loads_catalogue.json`; held by **GATE LOADS** (`tools/_load_check.js`, core tier,
negative-verified). In the world pack after the pier's (slim manifests; bins load on first use). Not rows in
`props_table.py`: GATE HANGAR rule 4 wants every hangar prop claimed by one hangar kit, and a mail bag is not furniture.
Fetcher: `python tools/polyhaven_fetch.py <main checkout>/flyDiy/assets/loads <id>...` (delivered bytes, md5-checked).

## 1. The catalogue: what each prop IS as freight (`src/loads/loads_catalogue.json`)

Dims are `[x, y(up), z]` metres **measured off the baked bins** (GATE LOADS re-measures and holds them equal). `kind` is
the packer's class (FREIGHT §1). The masses are sensible loaded masses; a contract may scale them.

| key | kind | item | dims (m) | kg | |
|---|---|---|---|---|---|
| `crate_wood_a` | crate | crated parts | 0.41 × 0.41 × 0.42 | 25 | |
| `crate_wood_b` | crate | crated parts, tall | 0.41 × 0.82 × 0.42 | 40 | |
| `crate_wood_c` | crate | crated parts, long | 1.01 × 0.41 × 0.42 | 45 | |
| `box_cardboard` | box | groceries / mail parcel | 0.39 × 0.34 × 0.52 | 12 | |
| `drum_steel` | drum | 200 l fuel drum, full | 0.63 × 0.93 × 0.64 | 165 | no-stack |
| `barrel_plastic` | drum | water / food barrel | 0.49 × 0.88 × 0.48 | 120 | no-stack |
| `jerrycan` | box | 10 l fuel can | 0.27 × 0.32 × 0.34 | 9 | |
| `bottle_propane` | drum | propane bottle (11 kg) | 0.34 × 0.55 × 0.34 | 23 | no-stack |
| `bottle_lpg` | drum | propane bottle (15 kg) | 0.41 × 0.64 × 0.41 | 33 | no-stack |
| `toolchest_metal` | crate | tool chest | 0.69 × 0.65 × 0.41 | 45 | |
| `bags_flat` | bag | sack of soil / feed | 0.63 × 0.14 × 0.85 | 20 | soft |
| `bag_compost` | bag | sack, slumped | 0.54 × 0.43 × 0.47 | 20 | soft |
| `jerrycan_green` | box | 20 l fuel can | 0.36 × 0.50 × 0.17 | 19 | |
| `oil_tin` | box | 4 l oil tin | 0.12 × 0.20 × 0.15 | 4 | |
| `pallet_one` | bulk | empty pallet | 1.72 × 0.20 × 1.17 | 25 | **oversize as delivered** (a EUR pallet is 1.2 × 0.8): belly-pod / Caravan only |
| `load_case_medical` | box | medical case | 0.53 × 0.10 × 0.35 | 6 | fragile |
| `load_fishbox` | crate | box of fish on ice | 0.51 × 0.25 × 0.41 | 25 | |
| `load_tote` | crate | fish tote | 0.35 × 0.41 × 0.63 | 30 | no-stack (open top) |
| `load_tub` | box | camping gear / groceries tub | 0.90 × 0.43 × 0.63 | 30 | the cooler's stand-in |
| `load_crate_samples` | crate | ore samples | 0.82 × 0.35 × 0.41 | 60 | |
| `load_can_steel` | box | ammunition / sample can | 0.09 × 0.18 × 0.26 | 7 | |
| `load_bag_cement` | bag | cement bag | 0.46 × 0.18 × 0.70 | 25 | soft — the unit a bulk load splits into |
| `load_generator` | crate | portable generator | 0.82 × 0.58 × 0.56 | 70 | no-stack |
| `load_suitcase` | box | passenger suitcase | 0.69 × 0.57 × 0.24 | 15 | |
| `load_lifejacket` | bag | life jacket | 0.70 × 0.18 × 0.99 | 1 | soft |

Left out of the catalogue on purpose: `bags_stack` / `bags_lean` / `bags_stand` (poses of the same compost bags — scenery,
not an item), `cement_bags` (a 2 m heap: the bulk pile at a site BEFORE it is split into `load_bag_cement`),
`pallets_*`, `cinder_pallet` (yard dressing).

## 2. The Poly Haven matches, baked (all CC0)

As-is geometry (rule 1); the in-cabin level `_l1` is ≤ 2 000 tris from 2 m (the loading view's close-up keeps the
as-is), `_l2` 400 from 15 m; maps 512 (256 under half a metre).

| key | Poly Haven page | as-is tris → in-cabin | note |
|---|---|---|---|
| `load_case_medical` | https://polyhaven.com/a/medical_box | 3 718 → 2 000 | green steel first-aid case, lid shut |
| `load_fishbox` | https://polyhaven.com/a/plastic_crate_02 | 5 840 → 2 000 | vented yellow stacking crate = the cannery's fish box |
| `load_tote` | https://polyhaven.com/a/industrial_pastic_container | 2 392 (in budget) | delivered with BOTH lids flung open: the body alone is baked (an open fish tote) |
| `load_tub` | https://polyhaven.com/a/plastic_container | 4 070 → 2 000 | black tub, red snap lid |
| `load_crate_samples` | https://polyhaven.com/a/wooden_crate_01 | 6 576 → 2 000 | lidded plank crate with a hasp |
| `load_can_steel` | https://polyhaven.com/a/ammo_box | 4 382 → 2 000 | small steel ammo can |
| `load_bag_cement` | https://polyhaven.com/a/cement_bag | 844 (in budget) | one bag, flat |
| `load_generator` | https://polyhaven.com/a/portable_generator | 26 419 → 2 049 | the heaviest; the dial glass keeps its 54 |
| `load_suitcase` | https://polyhaven.com/a/vintage_suitcase | 8 237 → 2 000 | the first of the delivered pair (node selection) |
| `load_lifejacket` | https://polyhaven.com/a/life_jacket | 8 968 → 2 000 | laid face-up (a quarter turn about x) |
| `camp_firepit` | https://polyhaven.com/a/stone_fire_pit | 3 887 (yard ladder 1 199 / 400) | the campfire ring, 1.45 m |
| `camp_table` | https://polyhaven.com/a/outdoor_table_chair_set_01 | 2 324 | folding slatted table |
| `camp_chair` | https://polyhaven.com/a/outdoor_table_chair_set_01 | 3 752 | its folding chair, squared up (−13.91° about y) |
| `camp_lantern` | https://polyhaven.com/a/wooden_lantern_01 | 8 321 | wooden storm lantern with glass |

Payload: 1.48 MB geometry + 2.47 MB maps for the 14 as-is, + 27.6k tris in 26 levels. Poly Haven also has **`hessian_230`
/ `hessian_380`** (burlap textures) — the cloth for a drawn mail sack or for the straps if FREIGHT-STRAP draws them.

## 3. THE GAP LIST — for the user's Sketchfab scouting

Licence: CC0 / CC-BY only (no NC / SA / ND). Budget for a load: **≤ 2k tris** (or a clean mesh the pipeline can cut
to 2k — see §4), **one material, 512² maps** (1k delivered is fine, the baker resizes). glTF/GLB preferred.

| # | wanted | look | size / mass | budget | search words |
|---|---|---|---|---|---|
| 1 | **mail sacks** | canvas / jute postal sack, drawstring or clipped neck, stencilled "U.S. MAIL"-style or plain; filled & lumpy, lying down | ~0.9 × 0.5 × 0.35 m, 15-25 kg (soft, `bag`) | 2k, 1 mat | "mail bag", "post sack", "canvas sack", "burlap sack" |
| 2 | **stretcher with a patient** — HERO | an orange rescue basket (Stokes) or a folding canvas stretcher, a person under a blanket strapped in; **patient as its own node** so the empty stretcher works too | 2.0 × 0.6 × 0.5 m, ~95 kg (`long`) | hero: ≤ 8k L0, 1k maps OK | "stokes basket", "rescue stretcher", "stretcher patient", "litter" |
| 3 | **cooler** | 50-70 qt camping cooler, white body + coloured lid (Coleman / Igloo style), handles | 0.75 × 0.42 × 0.42 m, ~25 kg (`box`) | 2k | "cooler", "ice chest", "camping cooler" |
| 4 | **backpacks** | 65-80 l trekking / expedition pack, standing, straps; 2-3 colours ideal | 0.8 × 0.35 × 0.3 m, 15-20 kg (`bag`) | 2k | "hiking backpack", "rucksack", "expedition backpack" |
| 5 | **tent bags / duffels** | a packed tent in its stuff sack (cylinder) + a gear duffel | tent 0.6 × Ø0.2 m 4 kg; duffel 0.8 × 0.4 × 0.4 m 15 kg (`bag`) | 1k / 2k | "duffel bag", "tent bag", "stuff sack", "sleeping bag" |
| 6 | **canoe** | 16-17 ft open canoe — aluminium (Grumman) or red / green Royalex; a kayak as a bonus | 5.0 × 0.9 × 0.35 m, ~30 kg (`long`; external load later) | ≤ 4k, 1k map OK | "canoe", "aluminum canoe", "kayak" |
| 7 | **cargo straps / net** | a ratchet buckle (the strap band itself is better DRAWN along the item, by FREIGHT-STRAP) + a cargo net with an alpha texture | buckle 0.1 m | ≤ 300 tris; net = a texture | "ratchet strap", "cargo net" |
| 8 | **tents, pitched** (§4b camping) | a 2-3 person dome tent + a canvas wall tent (the bush camp) | dome 2.1 × 1.5 × 1.1 m; wall tent 4 × 3 × 2.5 m | ≤ 3k each | "dome tent", "camping tent", "wall tent", "canvas tent" |
| 9 | **camp chairs (fabric)** | the folding fabric camp chair with a cup holder (the Poly Haven slatted chair stands in) | 0.9 × 0.6 × 0.6 m | 2k | "camping chair", "folding chair fabric" |
| 10 | **ambulance** (§4b medevac) | US Type III box ambulance (E-series cutaway) — or the user decides a livery on `auto_van_econoline` will do | ~6.5 m | ≤ 10k (the auto pack's range) | "ambulance", "type III ambulance" |
| 11 | **remote lake cabin** (§4b) | a small trapper's / hunting log cabin with a porch — unless the house kit builds one | ~6 × 5 m | ≤ 10k | "log cabin", "trapper cabin", "hunting cabin" |
| 12 | **people round the fire, a medic, a waving person** | characters — the chars pipeline (rigged, BlenderKit / Mixamo), not props | — | the chars budget | (characters track) |

Already covered, no scouting needed: **fish totes** (`load_fishbox` + `load_tote`), **ore-sample boxes**
(`load_crate_samples`, `load_can_steel`), **medical case**, **a small dock** (`pier_*`, Poly Haven
`modular_wooden_pier`), **a campfire** (`camp_firepit`), **groceries** (`box_cardboard`, `load_tub`), propane, fuel.

## 4. Size budgets (the pipeline's own)

- **Geometry is as-is** ([[import-models-as-is]]): the bake never cuts. The budget is met by the LEVELS:
  `prop_lod.js`'s `load` ladder is `[[2000, 2000, 2], [400, 400, 15]]` — `_l1` ≤ 2 000 tris standing in from 2 m,
  `_l2` 400 from 15 m; a prop under ~2.9k gets no `_l1` (it is already in budget; GATE LOADS reads "~2k" as ≤ 2.5k).
  The `camp` group takes the yard's ladder (a quarter from 20 m, 6 % from 60 m).
- **Maps**: 512 per row, 256 under half a metre (`tex`); delivered maps stay full-size in `assets/loads/`.
- **A hero** (the stretcher) may declare `tex=1024` and keep a higher `_l1`: add a `hero` ladder row if it comes.
- **Adding a scouted asset**: put the delivered files in `assets/loads/<slug>/`, one `SOURCES` row (title, author,
  licence, url), one `P()` row, one `C()` catalogue row; `python tools/load_prep.py`, `node tools/prop_lod.js --kit
  loads`, `node tools/_load_check.js`; name it in CREDITS.md (GATE LOADS checks).

## 5. Open (for the coordinator)

- **KTX2 twins not made** for the loads (`tools/ktx2_twins.js` has no `loads` family; needs basisu, which A0's worktrees
  lack). The page uses the JPEGs; add the family when a load is placed in the world (FREIGHT-STRAP).
- **No consumer yet**: FREIGHT-MODEL reads `loads_catalogue.json` (dims + kind + kg); FREIGHT-STRAP places
  `propPlace('<key>')`, the in-cabin level by distance.
- **No stills taken** (no GPU window asked): the bench `tools/_props.html` shows the hangar packs only; the loads were
  judged off the Poly Haven previews and the measured dims.
