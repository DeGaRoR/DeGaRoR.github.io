# G5 LOOK PASS — handoff

Deliverable: the procedural aeroplane's **mesh, textures and materials**. Nothing
was written into the repo; the two changed files live in this project as edited
copies of the originals.

| this project | repo destination |
|---|---|
| `gen/63_gen_skin.js` | `src/core/63_gen_skin.js` |
| `gen/garage.js` | `src/viewer/garage.js` (only the paint-bake half changed; `garageInit` is byte-identical) |
| `gen/orig/*` | pristine copies, for diffing |
| `plane.html` / `plane-baseline.html` | viewers (after / before), not part of the artifact |

`00_registry.js`, `60_gen_spec.js`, `61_gen_frame.js` are copied unchanged — the
spec, the lattice, the masses, the ledger and the aero are untouched.

## The one viewer-side change you have to make

`63_gen_skin.js` now returns two DATA maps beside the colour ones, and the
payload names them:

```js
return { v: 5, generated: true, linTex: ['bump', 'mr'], … }
```

In `app.js`'s texture loop, the generated-payload branch forces sRGB on every
sheet. Normal and roughness/metalness maps must decode LINEAR:

```js
// was
if (data.generated) texs[t].encoding = THREE.sRGBEncoding;
// becomes
if (data.generated && !(data.linTex || []).includes(t))
  texs[t].encoding = THREE.sRGBEncoding;
```

`garage.js` must also hand the two new sheets over next to `paint`/`reg`/`tyre`:

```js
data.texs = { paint: genPaintDataURI(curDef.spec), … ,
              bump: genBumpDataURI(curDef.spec),
              mr:   genMrDataURI(curDef.spec) };
```

Both bakes are spec-dependent only through the wing position (the wing walk), so
they can be cached per build exactly like the paint sheet.

`m.mr` and `m.nrm` are already plumbed through `matFor` (the C172's glTF path),
so no material code changes.

## Frame-mode visibility

`applySkinVis` hides `frame` and `engine` in covered mode and hides `skin`/`cowl`
in Frame mode. The new covering groups belong on the same list, or the glazing
floats in mid-air over the bare truss:

```js
const COVER = new Set(['skin', 'cowl', 'decal', 'glass', 'gcabin', 'gframe']);
model.meshes[n].visible = (n === 'frame' || n === 'engine') ? skinMode === 2
                        : COVER.has(n) ? skinMode < 2 : true;
```

(`liftstrut`, `gearmetal`, `exhaust`, `spinner`, `prop`, `proptip`, `tyre`,
`wheelhub` are outside any covering and show in both modes, as the struts and
wheels already did.)

## New groups and materials

`glass`, `gcabin`, `gframe`, `spinner`, `proptip`, `exhaust`, `liftstrut` — seven
groups, each with an explicit `rough`/`metal` in the payload's `mats`, so the
`PBR` fallback table in `app.js` needs no new rows (add them if you want the
names documented there). `gframe` takes `paint.trim`, so a scheme change moves the
window frames with it.

Metalness notes, since they bit once already: paint over metal is a dielectric,
and anything at 0.8+ metalness with a dim sky reads black. Gear legs came down to
0.45, the spinner to 0.55.

## Cost

Stock `GEN_DEFAULT`, covered mode: **5 716 → 9 432 triangles** (20 groups, 15 716
including the hidden truss). Against a 186 k-triangle C172 skin and a ~1 M
triangle forest, this is free. The paint sheet went 512² → 1024²; the two data
maps are 512².

## Gate expectations

- **GATE GEN** skin/structure coherence: every new vertex — glazing, intakes,
  stacks, step, pitot, spinner, blades — is an affine blend of nodes that already
  exist, with weights summing to 1. Nothing new was added to the lattice.
- **GATE UISMOKE**: the two new bake functions are plain canvas work in
  `garage.js`, i.e. in the viewer block the smoke gate stubs, same as the
  existing bakes.
- Determinism: no randomness anywhere in the new code.
- Structure, mass, CG, strips, ledger, substeps: unchanged by construction.

## Known limits, deliberately

- The glazing is three offset sheets, not a cut-out. Panes are flat-ish patches
  of the body surface, so a heavily crowned turtledeck bends them with it (which
  is what you want) but a pane cannot be given its own curvature.
- Windows are placed off the fuselage's own station/angle parameters, so a
  `drone` cabin gets none and a very short cabin gets small ones. Rear quarter
  light only appears when the body still has stations behind the cabin.
- The rib tape count is a constant (13 across the semispan). It should really be
  the rib count `61_gen_frame.js` already computes from 0.4 m spacing — one line,
  left alone because it would change the UV pitch of every existing build.
- No wing-root fairing, no jury struts, no cabin interior. The interior sheet
  behind the glass is a flat dark colour; seats and a panel would be the next
  visible step, and they are real geometry rather than a texture trick.
- The blade tip stripe is a separate group rather than a UV band, so a blade with
  a different tip fraction means moving one constant (`iS = NR - 1`).
