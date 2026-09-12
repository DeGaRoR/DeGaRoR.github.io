# INTERIOR LIGHTING — the audit (2026-09-12)

*The user, after G291: "Can you do a full audit of the interior lighting? I
think it does not consider enough options. A skylight, a closed canopy or a
bubble will have the ceiling lamps behave real differently. We need to be
clever about this and stick them where they should. Your instruments should
also light up … I'd avoid the shortcut of doing emissive textures on the
quadrants, and I would try to light them from inside the dial, like IRL."*

The audit is in three parts: what is built, what is wrong with it, and the
design that answers the brief — with a session plan at the end. Nothing here
is implemented yet; the plan is the ask.

---

## 1. What is built (G94 → G291)

**The sites** (`tools/_cage_light.js`, `sites()`), all measured off the
crew layer's anchors, all drawn as real fittings (housing, reflector, bulb,
dome, gasket — "no light without emitting geometry", G96):

| key | where it is placed today | how | in flight |
|---|---|---|---|
| `flood` (cabin) | over the pilot, `ceilAt(pilot.x, zBack+0.12)` — a downward face of the ROOF set in the cabin's upper half; else the spec's `roofY` | one PointLight in the **editor** (0.9 × dimmer) | glows (emissive), lights **nothing** — `CK.setupLights`: "the cabin flood is owed" |
| `pedal` (footwell) | the dash box's underside, 8 cm forward of the aft face (G291; it floated before) | emissive only | glows, lights nothing |
| `pax` | one per non-pilot seat, same `ceilAt` rule; none under a bubble | emissive only | glows, lights nothing |
| `instr` | no lamp: the dial faces' own material (`byPanel`) | the atlas as `emissiveMap`, intensity = dimmer × 1.6 | the same, per frame |
| `nav / beacon / land / taxi` | exterior (not this audit) | landing = SpotLight in both hosts | — |
| master / alt caps | lit rocker caps (`litCapMat`) | emissive | driven by the bus |

**The one cabin rule** is `bubble` (`P.canopy === 3`): no flood, no pax
lamps. Everything else — closed, convertible, open cockpit, skylight on or
off — gets the same roof lamp, and `ceilAt`'s ROOF set (`ceilingLoop, body,
plywood, cloth, composite, toele, waistband`) deliberately excludes glass,
so over a **skylight** it finds no face and falls back to `roofY − 0.03`:
a dome lamp hanging in the middle of the glass. That is the G94 fallback
firing on a case it was never meant for.

**The darkness.** The cabin is 81 % darker than outside (G206.1 `uCabin`),
the footwell darker again (G272). At night nothing inside is lit but the
glowing domes and the glowing dial faces: the pilot's hands, the stick, the
plate and the switch row are black.

## 2. What is wrong, precisely

1. **Placement does not read the cabin.** Four kinds of top (closed,
   convertible, open, bubble) × skylight (on/off) × liner or bare skin =
   one rule and one exception. The lamp is on the glass under a skylight,
   in mid-air over an open cockpit, and on the removable top of a
   convertible.
2. **No interior light in flight.** The flood is a light in the shed and a
   glowing dome in the aeroplane. The pedalier lamp has never been a light
   anywhere. With the night cycle coming (ROADMAP), the cockpit will be
   unflyable in the dark.
3. **The instruments glow.** `emissiveMap = the atlas` lights the printing
   and the black face equally (uniformly, the shortcut the user names).
   A real face is *lit* — by posts at the bezel rim, by wedge bulbs in the
   case, or by a glareshield flood — with a falloff, a hub shadow and a
   bezel that catches light; the needle is lit from the same source.
4. **One switch, one lamp.** Real cabins split "cabin" and "map/reading";
   ours has flood (roof), pedalier (footwell), pax (roof, per seat) and the
   instruments. That set is fine — it is where they go that is wrong.

## 3. The design

### 3.1 Where a lamp goes — by what the cabin IS

The site finder becomes a **ladder of structures**, tried in order over
each seat, the first that exists wins; each rung is a real face of the cage
(named material, downward or inward normal), never a spec number:

| cabin top | flood / pax lamp | map light (new, pilot only) |
|---|---|---|
| closed roof, no skylight | the ceiling liner / roof skin over the seat (as now) | door post at shoulder height, aimed at the panel |
| closed roof + skylight | **the roof frame beside the glass**: the `ceilingLoop` band at the skylight's edge, nearest the seat's x, aimed down-inward — never on the glass | as above |
| convertible top | the **windscreen header bow** (fixed structure), aimed aft-down over the seats — never on the removable top | door post |
| open cockpit | none overhead | a coaming-mounted map light on the pilot's side, aimed at the panel; the instruments carry the rest |
| bubble canopy | none overhead (as now) | the canopy's fixed **rear arch** (turtledeck bow) aimed forward-down, or the sidewall console; pax none |
| tandem | one rung per seat (the rear seat's roof is often the turtledeck: rung 1 or 3) | — |

Implementation: `ceilAt` grows into `mountAt(seat, want)` where `want` is
one of `roof | frame | header | arch | wall | coaming`; each rung is a
face query on `CAGE_UI.MS` by material set and normal, with the lateral
search for `frame` (walk outward from the seat's x in 2 cm steps until a
ROOF-set face is found under the cabin's half-width). The lamp's axis is
the face's inward normal (already the rule). `P.canopy` and `P.skylight`
select the ladder; a cabin with none of the rungs gets no lamp and says so
in NOTES (the G205 idiom), never a lamp in the air.

### 3.2 The lights in flight — a budget of three

The forward renderer pays for every light in every material's shader, so
the interior gets **at most three sources in flight**, all owned by
cockpit.js beside the landing spot (`CK.setupLights`):

1. the cabin flood — a PointLight at the flood's site (the editor's own
   numbers: 0.9 × dimmer, 2.4 m, decay 1.6);
2. the pedalier — a small PointLight (0.4 × dimmer, 1.0 m) under the dash;
3. the **panel flood** — one PointLight under the glareshield's lip, aimed
   at the plate, IF the builder fits it (a new row on the Instruments part,
   `lighting: post | flood | internal`, see 3.3). Pax lamps stay emissive
   (a passenger's dome in flight lights a face nobody looks at).

The bus already meters them (G260 `makeBus` loads); the switches already
reach them (cockpit.js writes the same `li_*` state the layer reads). The
only new plumbing is the site coordinates crossing the join (`data.lights`
already carries the switch state; it gains the three sites in the model
frame, through `vtx` like the footwell and the holes).

### 3.3 The instruments — lit, not glowing

Three real ways a dial is lit, offered as the Instruments part's `lighting`
row, priced and weighed like everything else:

- **post** (the default, the era's own): two small lamp posts on the bezel
  at 10 and 2 o'clock, their lenses lit; the FACE is lit from them.
- **internal** (wedge / edge-lit): bulbs in the case behind the face ring,
  the whole face lit with a soft rim gradient and a hub shadow.
- **flood**: no per-dial lamps; the glareshield flood (3.2) does it all,
  and the faces take only what it throws.

How the face is lit **without a light per dial** (17 PointLights would be
17 × every shader): the faces material gets an **irradiance map** — a
second 512 px slot per dial painted by `_panel_gen` from the chosen
source: for `post`, two cosine falloffs from the post positions with the
bezel's inner shadow and the hub's shadow; for `internal`, a rim-bright
gradient. In the shader the emitted term becomes
`albedo × irradiance × dimmer × warmth` — which IS what a lit face is
(radiance = albedo × irradiance), not "the texture, brighter". The printing
stays white-on-black, the black stays black, the needle takes the same map
through its own uv (a strip), the glass (owed) catches a highlight from the
post. The `instr` dimmer drives it; the bus meters the posts (0.1 A each).
This is the honest middle: the light is real in its shape and its
switching, and only its transport is precomputed.

### 3.4 Owed with it

- The night cycle (ROADMAP): without a dark sky none of this shows.
  Sessions L1–L3 can be verified in the shed with the sky mood set to
  night (`hangar_sky` has a dusk).
- The dial glass (the plan's "glass recess") — the posts' highlight lands
  on it.
- Stickers: "master", "alt", "taxi" (to retire "cruise"); a "map" tape if
  the map light lands; a round OFF·L·R·BOTH·START placard for the key.

## 4. Plan

| session | scope | gate |
|---|---|---|
| **L1** | `mountAt` ladder + the cabin table (3.1); the map light as a new LIGHTS row; NOTES when no rung exists | GATE LIGHT: six fixtures (closed / skylight / convertible / open / bubble / tandem), every interior site on a face of the right set, none on glass, none in the air (distance to the nearest cage face < 5 mm) |
| **L2** | the three flight sources (3.2) through the join; bus loads | GATE PANEL §lights: the sites cross the join within 1 mm; GATE ELEC: the loads sum |
| **L3** | the `lighting` row, the posts, the irradiance slots, the shader term (3.3) | GATE PANEL: an irradiance slot per face, the emitted term reads it, `emissiveMap` is gone from the faces material |
| **L4** | the night look: fly the circuit at dusk, screenshots from the seat; tune | the user's eye |

Sizes: L1 medium, L2 small, L3 large, L4 small.
