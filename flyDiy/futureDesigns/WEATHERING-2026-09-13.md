# WEATHERING v2 — bench first, four macros, into the game (G345)

**Status: LANDED 2026-09-13** as `src/viewer/aeroweather.js` + hook points in
`aeroskin.js`, the bench `tools/_weather.html` (launch `flydiy-weather`, port
8386), GATE WEATHER (`tools/_weather_check.js`), the four macro rows in the
editor, `spec.finish.weather`, the sources across the join, the flown build
weathered. The design below is what was built; §7 lists what is owed.

The user's ask (verbatim intent): revamp the weathering completely, layer by
layer — exhaust marks at the actual exhaust, belly dirt, mud projection from
wheels, splattered insects on fascia and all front-facing, dirt in
depressions, edge paint peel, edge rust, paint partial decolouring, dirt from
the top, roughness increasing on all, subtle grunge textures, multi-layer
dirt (pale brown dry dirt, spotted black for insects, tar, darker brown for
heavier mud), scratches and impacts, lots of dirt in corners, dirt around all
rivets generated through normals, dirt on all seams and rivets of the cowl,
streaks of dirt longitudinal to the aircraft. Fine sliders for all of it,
then a reduction to macro sliders in four groups — AGE wear / NORMAL FLIGHT /
BUSH (mud, absent in normal flight) / RAIN — later triggered by the airports
landed. Retire the old fresh-to-old slider. Glass: mostly roughness, and
"stuff you put on the glass very easily becomes unreadable and annoying
speckles — be rigorous". Interior: edge paint chipping is the key, plus
fingerprints. Everything affects PBR, roughness above all; NO SHINY DIRT.

## 1. What G70 was, and why it could not grow

One dial (`uWear.x`), four masks in the albedo pass (grime in the sheet's
valleys, chalking on up-facing, an exhaust streak, a wheel splash), the two
streaks in the SURFACE FIELD only — so they stopped dead at the cowl, the
spats, the gear and every triplanar surface; engine 0 and main wheel 0 only;
`app.js` never called `aeroSetWear`, so the flown aeroplane inherited whatever
the editor had last written into the shared block; the glass baked its years
into two dials at build time. No cavity, no chips, no rust, no insects, no
rain, no interior ageing.

## 2. The architecture (the rules that hold it)

1. **A separate module** `src/viewer/aeroweather.js` — the tables, the
   uniforms, the GLSL, the setters, the lab store. `aeroskin.js` reads it
   lazily (`aeroWx()`), splices its three blocks into the hooks AT COMPILE and
   otherwise carries only: the four-macro `uWear`, the globals `aeroWxCov /
   aeroCav / aeroDep`, the cavity export in `aeroStructure`, the glass's
   shared block and per-pane multiplier. It MUST load before aeroskin.js
   (build manifest, every bench): r128 keys the program on the hook's source.
2. **ONE weathering block at the tail of the surface pass** (after
   `AERO_SURFACE_FS`), not G70's albedo/surface split: `diffuseColor` is
   still writable there, the decals have composited (dirt over markings), and
   the grammar's cavity exists. One uniform branch `if (aeroWxOn > 0.0)`; a
   fresh aeroplane pays one compare.
3. **`uWear` = the four macros** (x age, y flight, z bush, w rain).
   `uWearK` (finish rate × the section's `wear x`) multiplies everything.
4. **The recipe is resolved on the CPU**: layer strength = clamp(Σ macro ×
   coefficient), 24 layers into `uWxL[6]`. A bench fine slider is a PIN on one
   resolved value. A negative coefficient is a wash (rain takes the dust and
   the insects off).
5. **Craft space** (`vCraftPos`/`vCraftNrm`: metres, x lateral, y aft, z up)
   for every placement. The grunge is read in THREE craft planes weighted
   by the normal (flank: along-up, deck: along-lateral, NOSE: lateral-up);
   two planes left a forward face with no variation along the body and
   every feature on the cowl front stretched into a line (the user's hangar
   shot). A flank excludes forward and aft faces, so the aft streaks never
   sweep a nose. A WHEEL TURNS AND IS UNWRAPPED: inside a wheel's cylinder the read is the
   tread band cut at a declared seam (u = arc length, v = lateral) and the
   flanks continued over the shoulder (v = hw + R - r), angle from object
   space in flight (the pivot groups; app.js sets `pivot`) and from the
   craft-space axle in the editor; flank dirt peaks toward the shoulder and
   cleans at the rim, the tread is lightly muddy with loaded grooves, no
   rain or insects; the propeller reads its disc plane in its own frame. A COWL IS A BODY OF
   REVOLUTION: near an engine's thrust line (in the sources with the cowl's
   radius and length) the triplanar parts read cylindrically — across the
   arc with the seam at the bottom, along the meridian y + r — and the
   fielded skin reads its own field; no plane blend anywhere a shear could
   show. Every placement — so a plume reaches the cowl and a wheel sprays a
   strut. Sources are uniform arrays (`#define` bounds, break on a uniform).
   ZERO new varyings; +2 grunge fetches net; 37 new vec4 shared + 2 per
   material (gate-counted, ≤ 48).
6. **No shiny dirt**, once, after every mask: roughness saturates UP to the
   layer's floor (≥ 0.85; tar 0.60 by exemption), metalness × (1 − cover),
   clear coat × (1 − cover) (a chunk append after `lights_physical_fragment`),
   dust fills the microsurface toward `geometryNormal`. A CHIP is not dirt: it
   exposes the substrate (`AERO_WX_SUB`, per finish — bare alloy may be
   metallic) and is applied after the invariants.
7. **Nothing on `material.userData`**: per-material uniforms are functions of
   the finish, so the JOIN CENSUS stays whole.
8. **Every number is a table entry** (RENDERER-DECISION §4b: the r128 →
   current upgrade recalibrates by table). The lab (`flydiy.aeroWx`,
   deviations only, JSON export) edits the live tables; the bench keeps
   reference shots.

## 3. The layers (mechanism · frame · channels)

| layer | macro coefficients (age, flight, bush, rain) | mechanism |
|---|---|---|
| dust on the tops | 0.15 0.55 0.30 −0.35 | up-facing × coarse blotch; dust colour; flattens the normal |
| belly dirt | 0.10 0.60 0.50 0.10 | down^1.5 × blotch |
| dirt in rivets, seams, sag | 0.30 0.50 0.30 0.20 | `aeroCav` (the grammar's slope magnitude: rivet flanks, tape edges, laps, seams) + `aeroDep` (sag valleys) |
| dirt in depressions | 0.30 0.35 0.40 0.20 | concave screen-derivative curvature (hardware only — a subdivided skin has none) |
| paint fade | 0.90 0.10 0 0 | patchy milky desaturation, +rough |
| chalking | 0.70 0.15 0 0 | up², milky and LIGHTER (G70's rule) |
| roughness floor | 0.80 0.20 0 0.10 | everything toward 0.72 |
| panel tone | 0.60 0.20 0 0 | ±7 % per grammar cell (needs a panelled construction) |
| exhaust soot | 0.20 0.85 0.10 −0.10 | per engine ≤ 4: point + blown direction (½ pipe + slipstream), sag, width 0.28 → 1.2 m over the run, 3-D distance to the axis; a facing BIAS not a gate |
| wheel mud | 0 0 1.00 0.15 | per wheel ≤ 6: contact = axle − R; cone aft + up (zTop = 0.25 + R(1.5 + 6t)), lateral = tyre half-width (1 + 2.5t); tailwheel 0.35; spatter cells |
| insects | 0.05 0.70 0.20 −0.50 | fwd^0.7 × cells at the 0.30 m tile; dark body + pale halo |
| streaks swept aft | 0.20 0.60 0.20 0.30 | flank × stretched grunge (along y) |
| drips down | 0.10 0 0.10 0.90 | (1 − up) × stretched grunge (along −z), gathered under cavities |
| chips and peel | 0.85 0.20 0.10 0 | convex curvature + cavity → hard threshold on the mottle → substrate |
| rust | 0.60 0 0.10 0.50 | steel substrates: chips go rust; bleed down the flank |
| scratches | 0.30 0.15 0.10 0 | stretched read thresholded high, flanks, substrate |
| stone chips | 0.20 0.50 0.60 0 | fwd² × cells → substrate |
| tar / oil | 0.30 0.50 0.10 0 | belly + low flanks, large cells; the one glossy floor |
| cabin corners | 0.50 0.30 0.40 0.10 | inside × (concave + floor trough at the footwell's floor) |
| fingerprints | 0.30 0.60 0 0 | inside × handled finishes; roughness only |
| glass dust film | 0.20 0.45 0.35 −0.30 | roughness + clear coat, ≥ 0.5 m features, never the fine sheet |
| glass frame grime | 0.60 0.30 0.20 0.20 | the pane's own extent (uGlassE) |
| glass rain spots | 0 0 0 0 | OFF by table (the rulings) |
| glass insects | 0 0 0 0 | OFF by table; lives in the multiply pass |

Palette (linear, floor): dust (0.100,0.088,0.072 · 0.88), dirt (0.130,0.104,
0.076 · 0.90), mud (0.085,0.062,0.040 · 0.95), soot (0.045,0.040,0.036 ·
0.92), bug (0.060,0.045,0.030 · 0.85), tar (0.030,0.028,0.025 · 0.60), rust
(0.200,0.075,0.030 · 0.95), grime (0.070,0.060,0.048 · 0.92).

## 4. The glass rulings

Roughness and the clear coat only; NO albedo on any pane by default. Insects
and rain spots exist as layers and ship OFF; a coefficient goes positive only
after the bench's legibility measurement (from the pilot's eye, a chart behind
the screen at dial 0 vs 1, contrast loss and high-frequency energy bounded)
admits it — not built yet, see §7. Nothing tilts the clear-coat normal (G217
stands). The pane reads the shared block and takes the macros live through
`uWearK` = the section's `wear x`; the G113.4 bake is gone.

## 5. The sources

`applyWeather()` in `_cage_ui.js` (after the layers, every build): every
`CAGE_ENG.units[*].exhaustAt` + `exhaustDir` (published by G345 from the
tailpipe's last run in `_eng_mesh.js`, turned by the engine layer), every
`CAGE_GEAR.contacts` with `R`, the tyre half-width off `GEAR_GEN.TYRE`, and
the third wheel by `st.leg === 3`; the footwell's floor for the corner
trough; all through `uCraftInv` into craft space. The join's `snapshotAt`
carries the same as `weather = { exhaust, wheels, floor }` through `vtx`
(points and, origin-subtracted, directions); `app.js` hands them to
`aeroWxSetSources` beside the holes and the macros to `aeroWxSetMacro` from
`aeroWxMacroFromSpec(genSpec)` beside the decals.

THE TRAP MET: the editor's craft frame stayed IDENTITY on a bench page with
no join mount (`CAGE_JOIN.mount()` absent, `CAGE_UI_SCENE` null), so every
source was measured in scene coordinates; the fallback is now the axis
convention over the identity — a bench's aeroplane is at the origin.

## 6. The bench and its verdicts

`tools/_weather.html` = cage8's chain + the module before aeroskin + a panel
(`tools/_weather_bench.js`, `window.WX_BENCH`): the four macros with presets,
every layer as a pin with its derived value, coefficients / palette / knobs
(the lab), debug views (cover, cavity, signed curvature, plume/mud, grunge,
up/fwd/down — UNLIT, as emissive over black), camera presets incl. the
close-ups (`front`, `le`, `seam`, `screen`, `cockpit`), and the measurement:
`measure(layer)` shoots the layer's preset at pin 0 and pin 1 off a
320² render target (viewport by hand, the `_light_probe` method) and reports
changed pixels; `?nowx` loads the page with the module off for a reference
shot kept in localStorage; `diff vs ref` proves the zero-macro page is the
pre-change page.

`measureAll()` on the stock build, 2026-09-13 (% pixels changed at pin 0 → 1
on the layer's own preset; FAIL under 0.5 %):

dust 68.2 · belly 57.9 · cav 21.2 · dep 0.0 FAIL · fade 50.6 · chalk 62.5 ·
rough 5.8 · panel 0.0 FAIL · exhaust 40.6 · mud 2.2 · bug 5.3 · streakA 27.0 ·
streakD 25.8 · chip 0.7 · rust 4.8 · scratch 1.2 · impact 0.7 · tar 0.9 ·
corner 3.4 · hands 15.3 · gDust 53.7 · gEdge 14.2 · gRain 0.8 · gBug 0.6

The two FAILs are honest: `dep` is concave curvature and a subdivided skin has
none (it lives on hardware grooves and dome roots); `panel` needs a panelled
construction (the stock build's covering has no panel cells).

THREE MEASUREMENTS THAT DECIDED THINGS: (1) the first `measureAll` came back
24 × 0 % — a pin over four zero macros never opened the uniform branch; a
pin now floors age at 0.001. (2) The plume painted nothing: the pipe tip the
engine layer measures sits INSIDE the cowl volume, so a pipe-width plume
reached no surface and a facing GATE zeroed every fragment facing away from
the axis; the plume is wide from the start and the gate is a bias. (3) The
"cover" band seen at the exhaust preset was identical with the layer at 0
and at 1 — a surface outside the branch (a part whose `wear x` is 0 in the
person's own prefs, most likely the propeller), which the unlit debug view
shows lit. Measure before believing a picture.

## 7. Owed

- The glass legibility measurement (pilot's eye, chart, contrast bound) —
  until it exists gRain/gBug stay at 0 by table.
- The lab's fifth `editing:` kind (weather) in the editor's own lab panel;
  the bench carries the whole lab meanwhile.
- The chip lip normal (2 offset evaluations) and a mud relief normal.
- `dep` on the skin needs a baked cavity (vertex or sheet) — the derivative
  curvature cannot see a subdivided surface's grooves.
- The airport-driven macros (bush from grass landings, rain from parking) —
  the spec shape `finish.weather {age, flight, bush, rain}` is ready for it.
- The W0.5a recalibration: re-shoot the bench's references after the
  three.js upgrade and re-tune the palette by table.
