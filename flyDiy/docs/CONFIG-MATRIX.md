# CONFIG-MATRIX — which garage choices go together (2 Nov 2026)

The user, 2 Nov: "On the twin floats, switching back from pod and rod to lofted skin removes the engine. Nevertheless,
twin booms are still drawn, and now they allow for a dorsal fin, which I would have liked on the pod too. So we have
several inconsistencies here. Let's figure out consistent sets, add missing points and disable dysfunctional
combinations."

This is the map. Every cell below was measured with `tools/config_matrix.js`: the stock aeroplane, the design tiles
applied in the order a builder clicks them (`CAGE_DESIGN.designApply`, `seeds:false`, the same call as
`design_flow.js pick`), every drawing layer the game uses (`_scene_headless.js`), then the join (what the game flies).
The sweep log is `reports/evidence/CONFIG-MATRIX/sweep_before.txt`.

```
node tools/config_matrix.js --sweep                       # the whole table, one line per cell
node tools/config_matrix.js <build.json> --tile=boomStyle:0 # one build, one tile, before / after
```

What each line reports: the engine units the engine layer bolted on (`CAGE_NOSE.engineFaces`), the engines the join
flies (mount, and the measured station or `@rule` when nothing was measured), whether the two agree (WYSIWYG), the
booms, the aft aperture, the dorsal the fin layer draws and the dorsal area the join flies, the tail type, and the
notices the layers wrote.

## Verdicts

- **WORKS**: drawn = flown, and it is a real aeroplane.
- **MISSING ROW**: works, but a part a real aeroplane of this kind has is not offered.
- **BROKEN**: a part is lost or orphaned by the switch, drawn but not flown, or flown but not drawn.
- **NONSENSE**: no real aeroplane is built this way; the tile should be greyed with a one-line reason.

## 1. How the rows reach each other (the code)

| row (tile) | writes | gates |
|---|---|---|
| Fuselage style: Lofted / Rod & pod | `boomStyle` 0 / 1 (+`taperOn`) | the aft aperture for a pusher (`_cage_gen.js` `rearAperture`: `engMount 1 && boomStyle`), the dorsal and keel clamp (`_cage_fin.js`, `_tail_headless.js`: `boomStyle` → `finDorsal 0, finKeel 0`), the fin's saddles (a tube host), the single rod's stab saddle, the rod rows and the taper rows (`_cage_page5.js`) |
| Booms: Single / Twin | `boomTwin` 0 / 1 (+`stMount 3`, `stX`, `finOn`) | the pod ENDS at the aft bulkhead on twin booms whatever the style (`S.rod` is set by `boomTwin`); the fins ride the booms; the stab sits between them |
| Engine mount: Nose / Pusher / Over the wing | `engMount` 0 / 1 / 2 | Pusher also writes `boomStyle 1` (the rod) and turns the cowl off; Over the wing writes `wgPos 0` |
| Engines: 1 / Twin / Push-pull / Three / Four | `engMount` 0-1 / 3 / 4 / 5 / 6 | Push-pull also writes `boomTwin 1` and the boom track outboard of the rear disc |
| Empennage: Conv / T / Cruciform / V | `stMount`, `stY`, `stCant`, `finOn` | Conv seats the stab between the booms on a twin (`stMount 3`); T, Cruciform and V do not look at the booms |
| Leading edge (dorsal) / Keel extension | `finDorsal` / `finKeel` | the row is hidden and the part clamped off whenever `boomStyle` is set — on a single tube AND on rod-style twin booms |
| Undercarriage: Tail / Trike / Floats | `s1/s2` stations, `gearFloats` | the ventral fin row shows with floats or twin booms |
| Wing position | `wgPos` | the over-the-wing mount needs a high wing or a parasol (`engineFaces` returns nothing otherwise) |

The engine face: `engineFaces` (`_cage_cowl.js`) finds the pusher's face with `noseFace(mesh, FS, 'tail')`, the
aft-most capped aperture. When the body has NO aft aperture the aft-most cap is the NOSE's (or, on an aerodynamic
nose, the windscreen band `pillarFront`), so the pusher is bolted on the front of the aeroplane facing backwards — or,
when no cap is left at all, it is not drawn. In both cases the join still flies a pusher (`_cage_join.js` writes
`engines` from `engMount`, whatever was drawn).

## 2. Fuselage × booms (a nose engine, conventional tail)

| | Single | Twin booms |
|---|---|---|
| **Lofted skin** | WORKS | WORKS — the pod ends at the bulkhead, the booms are lofted, the fins root on the boom skin with a fillet, the dorsal rides each boom's fin (the 337's) |
| **Rod & pod** | WORKS — the bare tube, the fin and the stab on saddles, no dorsal, no keel | WORKS, **MISSING ROW**: the dorsal is clamped off and its row hidden, although the booms are the same lofted section as the lofted style (`BOOM_GEN.boomMesh` takes no style); only the fin's root (saddles) and the booms' fallback paint differ |

On twin booms the Fuselage-style row is nearly cosmetic: the pod ends at the bulkhead either way. That is what made the
user's switch half-applied — the twin booms stayed (correctly: the Booms row owns them), the pusher's aperture went
(wrongly: it read the style, not the pod's end), and the dorsal came (the clamp read the style, not the host).

## 3. Engine placement × body (the switch the user made is the B order)

A = body tiles first, then the engine tiles; B = engine tiles first, then the body (a switch).

| mount | Lofted single | Rod & pod single | Lofted twin | Rod & pod twin |
|---|---|---|---|---|
| Nose | WORKS | WORKS | WORKS | WORKS |
| Pusher (A) | the Pusher tile writes Rod & pod: = Rod single | WORKS | WORKS | WORKS |
| Pusher (B, switched to the body) | **BROKEN**: the pusher bolts onto the windscreen band facing aft (flown at x −0.15 to −0.38 m, the prop in front of the cabin) or vanishes (the user's `_4b`: flown, not drawn) | WORKS | **BROKEN**: the user's case — no aft aperture, the engine and the prop gone, still flown at the old station | WORKS |
| Over the wing | WORKS | WORKS | WORKS | WORKS |
| Twin (wings) | WORKS | WORKS | WORKS | WORKS |
| Push-pull (A) | the tile writes twin booms: = Lofted twin | = Rod twin | WORKS | WORKS |
| Push-pull (B, switched to single) | **BROKEN**: the rear engine bolts onto the windscreen band (flown at −0.09) | **BROKEN**: the rear disc sweeps through the rod (the Pusher tile's boom-under-the-engine rule never ran) | WORKS | WORKS |
| Three / Four | WORKS | WORKS | WORKS | WORKS |

## 4. Tail kinds and tail parts × body

| | Lofted single | Rod single | Lofted twin | Rod twin |
|---|---|---|---|---|
| Conventional | WORKS | WORKS | WORKS (stab between the booms) | WORKS |
| T-tail | WORKS | WORKS | **BROKEN**: the stab is seated on a centre fin that does not exist; its halves kink up to the two fin tips | **BROKEN** (same) |
| Cruciform | WORKS | WORKS | WORKS (the stab between the fins at mid height, the OV-10's) | WORKS |
| V-tail | WORKS | WORKS | **BROKEN / NONSENSE as built**: one canted panel on one boom, flown as `twinBoom` with no fin | **BROKEN** (same) |
| Dorsal fillet | WORKS | clamped, row hidden (a bare tube has no deck — G26.4) | WORKS (on each boom's fin) | **MISSING ROW** (the user's ask) |
| Keel extension | WORKS | clamped, row hidden (it wraps a keel a tube has not) | WORKS (on the boom's belly) | clamped, row hidden |
| Ventral fin | with floats: WORKS | with floats: WORKS | WORKS (one a boom) | WORKS |

## 5. Gear × body and mount

| | single body | twin booms | notes |
|---|---|---|---|
| Taildragger | WORKS | WORKS — the tailwheel under the pod's end (2.5 m wheelbase on the stock) | |
| Tricycle | WORKS | WORKS | |
| Floats | WORKS | WORKS (the user's `_4b`) | floats + pusher WORKS on both rod bodies |
| Amphibian floats, skis | not built — a garage gap, not a cell | | |

## 6. Cowls

| face | mounts | verdict |
|---|---|---|
| body face (the cowl fitted to the fuselage's own aperture) | nose, pusher, push-pull's two | WORKS; the Pusher tile turns it off and the row puts it back (WORKS both ways). PHONE-1b is changing where a body-face cowl starts and how a cowled pusher reads engBlockZ/Y: not touched here |
| synthetic face (the engine's own plate) | over the wing, the nacelles | WORKS |
| no face | the BROKEN pusher cells above, over-the-wing on a mid/low wing | the cowl says "no engine face on this body" and draws nothing: it follows the engine, the fault is the engine's |

## 7. Wing rows that gate other rows

| | verdict |
|---|---|
| Over the wing × High / Parasol | WORKS |
| Over the wing × Mid / Low (the wing moved after the mount) | **BROKEN**: the engine vanishes ("the over-the-wing mount needs a HIGH wing"), still flown |
| Over the wing × Biplane | WORKS (the upper plane) |
| Struts / cantilever | gate nothing in this matrix (the strut tanks are TANK-FIT's) |
| Covering: open frame × pusher, any body | WORKS |

## 8. The one rule under every BROKEN engine cell

The join flies `engines` from the mount row, whatever the engine layer drew. Any state where the layer bolts fewer
units than the mount lists is flown-not-drawn, silently. The fix is in two halves: the faces (a pusher's face exists
only where the pod really ends at a bulkhead), and the join (an engine the layer could not bolt on is an ERROR row,
the bench's failed test, with the layer's own reason — never a silent rule station).

## 9. The switch rules (the fixes, CONFIG-MATRIX step 2)

1. **The pod's end decides the pusher, not the style.** A pusher's face is the aft bulkhead wherever the pod ends at
   one: Rod & pod (single), and twin booms of either style (the push-pull's rule since G2790, now the pusher's too). So
   on twin booms the pusher survives Rod & pod ↔ Lofted, on the same aft face.
2. **No aft face, no aft engine — said, not drawn somewhere else.** A pusher (or a push-pull's rear) on a body with no
   aft aperture is not bolted to the nose; the engine layer says why, and the join files it as an error row.
3. **The booms belong to the Booms row.** The style row never adds or removes them; Single removes them whole (the
   fins come back to the body, the stab back to its keel seat — the tile already writes that).
4. **A rod clears the rear disc** (the user, 2 Nov: "very possible, with Rod on top or below the engine and prop").
   The tile that puts an aft engine on a single rod moves the rod to the far side of the disc, 80 mm clear; the prop
   check files a disc through the rod as an error.
5. **Tail parts follow their real host.** The dorsal is the fin's: it rides each boom's fin on twin booms of either
   style; switching Rod & pod ↔ Lofted on twin booms carries it over.

## 10. Missing points (step 3) and the gaps left

| point | status |
|---|---|
| Dorsal fillet on rod-style twin booms | ADDED (step 3) — opt-in (`finDorsalTube`), so a saved rod twin stays bit-identical |
| Dorsal on a single bare rod | ADDED (the user: yes) — the same opt-in row |
| T-tail between two fin tips (the Adam A500's) | garage gap |
| Inverted V on twin booms (the Shadow UAV's) | garage gap |
| A tail-cone pusher on a single lofted body (Do 335, Lear Fan) | garage gap |
| Amphibian floats, skis | garage gap |

## 11. The disables (step 4, a separate commit for the user's veto)

Greyed tiles with their one-line reason (a saved build holding one loads unchanged, with the join's notice):

| tile | greyed when | why |
|---|---|---|
| Fuselage style · Lofted skin | a pusher or a push-pull on a single boom | a lofted body runs to the tail: no aft bulkhead for the pusher |
| Booms · Single | a pusher or push-pull on a LOFTED body (on a rod it stays live: the rod fit moves the rod clear of the disc — the user's call) | the pod would run to the tail |
| Empennage · T-tail, V-tail | twin booms | the stab cannot seat on a centre fin the booms do not have |
| Wing position · Mid, Low | over-the-wing engine | the pylon stands on a high wing or a parasol |

Repo builds in a BROKEN/NONSENSE cell: **none** (every `*.json` with a `spec.cage` in the repo, the 32 archetype cards,
and `builds/candidates/` on `claude/ready/candidates-4b`, scanned by mount, body, booms, wing and tail).
