# NEW AIRCRAFT — the birth certificate
## The macro-parameter model, and the flow that creates an aeroplane
### (2026-08-31, from the user's design session)

STATUS: IMPLEMENTED (2026-08-31, the same day — the birth-flow session).
The declaration is `tools/_cage_design.js`, the renderer is
`src/viewer/design_flow.js`, the gates are GATE DESIGN and GATE ARCHETYPES.
§12 records where this document was WRONG against the code, because the
corrections are the useful part; the sections above it are kept as written,
with a `CORRECTED — see §12` mark where a claim did not survive
verification. Read §12 before quoting anything it names.

WHAT IT RELATES TO:
- `futureDesigns/UI-MODEL.md` — authority on WHAT GOES WHERE in the workshop.
  This document adds one thing to that model and changes nothing in it.
- `ROADMAP.md` P8 §3 ("configure THEN shape: a first screen of ~eight
  discriminators") — this is that item, specified, and widened: the screen is
  ~20 rows, not 8, and it is also the door through which an aeroplane is BORN.
- `tools/_cage_parts.js`, the `design` part — the declaration that already
  exists, which this EXTENDS rather than replaces.
- ROADMAP P6 (fleet) and P7 (powerplant plurality) — this spec declares rows
  those chantiers will activate. It does not implement either.

---

## 0. THE RULE, IN ONE LINE

**One declaration, two renderings, two kinds of row — and a starter says how
much it is about to overwrite.**

---

## 1. WHY THIS EXISTS

There is no way to start a new aeroplane. `GEN_PRESETS` has exactly one entry
(`garage: GEN_DEFAULT`), the editor opens on whatever was last saved, and every
macro decision — what class of machine this is, what it is made of, what it is
FOR — is either absent or reachable only as a slider filed under a part of the
aeroplane it describes the whole of.

The nearest thing that exists is `Design & construction`, first under the
aeroplane in the part tree, holding nine rows. It is the right idea in the right
place and it is a third of what it needs to be.

---

## 2. TWO KINDS OF MACRO ROW

The rows below are not one thing. Treating them as one is the first mistake
available, and it costs the player their work.

**DISCRIMINATOR** — decides WHICH PARTS EXIST. Canopy style, mirrored pod,
engine mount, gear layout, empennage type, wing position, flaps.
- Editable at ANY time, not only at birth.
- Changing one makes rows appear and disappear (the `when` mechanism, live
  since the panel-grammar work).
- Never destructive: it hides rows, it does not overwrite their values.

**STARTER** — writes a COHERENT SET OF VALUES, ONCE. Size class, role, section
profile, interior style, wing planform, suspension.
- Applying one a second time OVERWRITES hand-tuned work.
- The existing precedent and the correct wording is `engPreset`'s own label:
  **"preset (applies once)"**. The seating starter is the other one.
- REQUIRED: before applying, a starter states how many currently-non-default
  values it will overwrite, and the action is undoable as ONE step.

**THE TEST**, when a new row is added and its kind is unclear:
*does undoing this choice make controls disappear?*
Yes → discriminator. No, it only moves values → starter.

A row may be BOTH (size class discriminates nothing but writes twenty values;
construction material both writes values and changes what parts look like). When
in doubt it is a starter, because the starter contract is the cautious one.

---

## 3. ONE DECLARATION, TWO RENDERINGS

The macro rows are declared ONCE, in one table, beside the spec — the same
argument `_cage_parts.js` makes in its own header, for the same reason: four
things read it and none of them is a panel.

    THE DECLARATION  (new: tools/_cage_design.js, beside _cage_parts.js)
            │
            ├──► ROWS rendering    the properties panel, as today's tree rows
            │                      — the shape the editor already draws
            │
            ├──► TILES rendering   the grid of large buttons with silhouettes
            │                      — the creation flow, and the same grid when
            │                        `Design & construction` is selected
            │
            ├──► ARCHETYPES        the named canonical builds (§7) are rows of
            │                      this table with values filled in
            │
            └──► GATE DESIGN       every row claimed, every option reachable,
                                   every inactive option carrying a reason

This is deliberately the SHAPE/FINISH pattern from UI-MODEL §2.3 — "two views
of the same tree, not two panels". It is what keeps the creation flow from
becoming a second place that writes the same state.

**THERE IS NO MODAL.** UI-MODEL's closing worry is accumulating navigation
axes, and a pop-up is a fifth surface. The tiles render INTO the properties
panel, so the aeroplane stays visible in the centre and updates on every click —
which is what the flow is for. The ONE exception is first launch with no
aeroplane on the stand: nothing to look at, so the same component takes the
whole viewport. Same component, two hosts.

---

## 4. THE ROW FORMAT

    key        the spec path or panel param this writes. Stable.
    label      what the row shows.
    kind       'discriminator' | 'starter'
    options    [{ value, label, icon, note, when?, inactive? }]
    writes     for a starter: the map of values it applies.
    icon       'gen:<fn>' to GENERATE the thumbnail from the build functions
               (see §8), or an inline SVG path for the rest.
    inactive   a REASON string. An option that exists in the design but not yet
               in the code renders greyed with its reason on hover. It is never
               simply absent — absence hides the backlog; a greyed tile with
               "pusher cowl: ROADMAP P7" documents it where it is felt.
    status     'live' | 'declared'  — GATE DESIGN counts both.

---

## 5. THE ROWS

Status column: **L** = the underlying param exists and is wired today.
**D** = declared here, not yet built. **P** = partly there, see the note.

### 5.1 IDENTITY

| row | kind | writes | status | note |
|---|---|---|---|---|
| name | starter | `meta.name` | L | free text |
| registration | starter | `meta.reg` | L | free text; `paint.regX` places it |
| **role** | starter | `meta.role` (NEW) | **D** | see below |

**ROLE** is the macro-parameter this project does not have and most needs. It
is not a geometry, it is an INTENTION — and it is what gives every other choice
a meaning and the game something to judge the aeroplane against ("you built a
bush aeroplane with a 400 m take-off run"). It is the hook into P5 (missions)
and P6 (the WHY report).

    bush      short field, rough ground, load      → taildragger, big tyres,
                                                     Fowler/slotted flaps, long
                                                     span, strut brace
    touring   distance, comfort, speed             → tricycle, spats, low drag,
                                                     cantilever, bigger tank
    aerobatic strength and roll rate               → symmetric section, short
                                                     span, big ailerons, low
                                                     wing, high load factor
    glider    L/D above all                        → long span, high AR,
                                                     retractable/none gear
    cargo     payload and volume                   → high wing, big cabin box,
                                                     cargo bay
    trainer   forgiving, cheap                     → the middle of everything

Role writes DEFAULTS and nothing more. ROADMAP P8 §3 already ruled on the
tension: *"derivation framed as the engineer's handbook (guidance you can
ignore), never as guardrails that prevent building a bad aeroplane. Building it
wrong and learning why is content, not error."* Role never clamps.

**ANSWERED (2026-08-31): defaults now, TARGETS DECLARED now, judging later.**

The field has to exist in this chantier or P5 and P6 have nothing to read. But
the interesting half — the plaque saying *"bush: 180 m take-off. Yours is
410 m."* — is P5/P6 work and does not belong here.

The cheap move that reserves the right shape: **each role declares its targets
NOW, in the units `genShakedown` already returns**, and nothing reads them yet.
Those units exist and are measured on every build:

    Vs · VCruise · LD · TORun · climbRate · climbGrad · wingLoad ·
    powerLoad · staticMargin · cnBeta · empty / payload (the ledger split)

So a role row is `{ key, label, writes: {...}, targets: {...} }`, the targets
sit unread beside the defaults, and the day the plaque grows a role line it
reads a table that has been filled in and reviewed for months rather than one
invented in a hurry. Declaring a target costs one line; retrofitting the whole
table under P5's deadline costs a session.

RANGE and ENDURANCE are deliberately NOT in that list yet: `60c_gen_energy.js`
(G97-G101) is laying the geometry those numbers will come from and has not
produced them. A `touring` role wants a range target and must wait for one.

### 5.2 SIZE CLASS — and the envelope problem

| row | kind | writes | status |
|---|---|---|---|
| **size class** | starter | `meta.class` (NEW) + ~20 values | **D** |

The class is the only macro row that cascades into everything: cabin box,
span, chord, engine family, gear, tank, systems fit, default material.

**IT IS A LABEL, NOT A CONSTRAINT.** It is stored on the spec because it is
useful elsewhere — missions, economy, the hangar, and above all the plaque: an
aeroplane that declares itself an ultralight and weighs 900 kg is a piece of
GAMEPLAY INFORMATION, not an error. The gap between the declared class and the
built aeroplane is content.

The classes, anchored on real categories (the figures are game-facing
approximations of the real ones, not certification rules):

| key | name | anchor | MTOW | seats | power | span | build? |
|---|---|---|---|---|---|---|---|
| `rc` | RC model | park flyer → large sport | 0.3–8 kg | 0 | 0.2–2.2 kW | 0.8–2.5 m | **NO** |
| `ul1` | Ultralight, single seat | US Part 103 (115 kg empty, 1 seat) | ~180 kg | 1 | 15–25 kW | 8–9 m | yes |
| `ulm` | Microlight / ULM | European 2-seat (472.5 → 600 kg) | 472–600 kg | 2 | 45–75 kW | 8.5–10 m | yes |
| `lsa` | Light Sport | LSA (600 kg, 2 seats, 45 kt stall) | 600 kg | 2 | 60–80 kW | 8–10 m | yes |
| `eab` | Experimental, amateur-built | Jodel, Cub, RV | 550–900 kg | 2–4 | 45–135 kW | 7–11 m | yes |
| `n23` | Normal category | CS/FAR-23 (C172, DR400) | 1000–1500 kg | 4 | 110–160 kW | 10–11 m | yes |
| `util` | Utility / cargo | Beaver, DC-3 | 2500–5700 kg | 6–20 | 300–900 kW | 14–29 m | **NO** |
| `sail` | Sailplane / motorglider | ASK-21, FES sustainer | 400–600 kg | 1–2 | 0–22 kW | 15–18 m | **NO** |

**THE FINDING, AND IT IS A DECISION FOR THE USER.** `clampSpec` bounds the
buildable envelope today at:

    wing span    6.5 – 14.0 m   (and 4× to 10× chord)
    wing chord   1.15 – 2.10 m
    fuel         0 – 140 L

That is honestly ULM through CS-23 and nothing else. **`rc`, `util` and `sail`
are all outside it** — while the engine catalogue already spans 180 W to 895 kW
and contains an RC outrunner, an FES sustainer and an R-1830. So:

> **DECIDED WITH THE USER (2026-08-31): ship five classes (`ul1` `ulm` `lsa`
> `eab` `n23`) live, and declare `rc`, `util` and `sail` inactive with
> "outside the buildable envelope: wing clamps" as their reason.**

The user's own words: *"pour l'instant on ne supporte pas tout, et on prendra
le temps de tester que tout marche déjà à l'intérieur de nos classes
existantes."* Which is the right order — proving the five live classes fly is
GATE ARCHETYPES' whole job, and it is a job that has to be done before the
envelope grows, not after.

Widening the span clamp to 18 m changes the aeroplane every fleet gate flies.
It belongs to its own chantier with its own measurements, and the three greyed
tiles are what will keep asking for it.

### 5.3 CABIN & OCCUPANTS

| row | kind | writes | status | note |
|---|---|---|---|---|
| seat arrangement | discriminator | `seatLayout` | L | single · side-by-side · tandem |
| passenger bays | discriminator | `paxCount` 0–4 | L | one bay = one row of passengers |
| ~~seating layout~~ | — | `cabin.seating` | — | **DERIVED. NOT A ROW.** See below. |
| **canopy style** | discriminator | `canopy` | **P** | see below |
| **body & deck** | discriminator | `mirror` | L | `Cabin` · `Turtledeck` — see below |
| **interior style** | starter | `seatType` + trim | **P** | `seatType` (tube frame · composite shell · airliner) exists; headliner/console/trim to add |

#### Seating is MEASURED, not chosen — do not offer it

**ANSWERED (2026-08-31), by reading `_cage_join.js`.** `cabin.seating` looks
like the obvious tile and must NOT be one. The join DERIVES it:

    bays    = round(P.paxCount)
    abreast = round(P.seatLayout) === 1
    seating = bays >= 3 ? (abreast ? 'side4' : 'tandem4')
            : bays >= 1 ? (abreast ? 'side2' : 'tandem2')
            : 'single'

So the builder chooses **`paxCount` and `seatLayout`** — both cage params, both
things you can see in the model — and the game's `GEN_SEATING` enum follows.
`cabin.pilots` and `cabin.pax` are LOADINGS on top of that ("an aeroplane is
not flown full because it could be"), set from `dum2On` and the seating table's
own capacity. They are flight settings, not birth settings, and the birth flow
does not touch them.

Offering `cabin.seating` as a tile would put a second control on a derived
value — the same defect the spec has already paid for twice (the flat engine
alias in G45, the flat cabin aliases in G48).

**AND A FINDING WHILE READING IT.** `paxCount` runs 0–4 but the mapping above
has only THREE outcomes: bays 1 and 2 both give a two-seater, bays 3 and 4 both
give a four-seater. Two of the five slider positions add a fuselage bay — real
structure, real drag, real length — and change NOTHING about the seats, the
crew mass or the cabin the mass model bills. `GEN_SEATING` tops out at four
crew and the cage can draw more bays than the table can name.

That is not this chantier's bug to fix, but the birth flow must not pretend
otherwise: the passenger-bay tiles are labelled by what they BUILD ("2 bays")
and never by what they seat, until the seating table grows a six-seat row.

#### Canopy and body are TWO questions

The user's three canopy styles — windscreen · half-bubble · full bubble — map
onto `canopy` ALONE. `mirror` is not a glazing choice at all: it decides what
the top of the fuselage does BEHIND the cockpit.

**THE FOUR COMBINATIONS ARE ALL REAL AEROPLANES**, which is the proof that
they are two rows and not one:

    cabin      + windscreen    Piper Cub, Cessna 172
    cabin      + bubble        a sliding hood on a cabin body
                               (Grumman AA-5, Bolkow Junior)
    turtledeck + windscreen    razorback fighters, Jodel D11
    turtledeck + bubble        Spitfire low-back, glider pod, RV-4

Merging them into one control would make two of those four unreachable.

#### The name: `mirror` keeps its key and loses its label

"Mirrored pod" is wrong twice.

Wrong once because it names a MECHANISM, not a shape: what the flag does is
hand the aft body the NOSE's own machinery (`3b · aft deck` and `4b · aft
cabin` are the full front control set, duplicated). A builder does not choose
"a mirroring". They choose what the top of the fuselage does behind the seat.

Wrong twice because the mirroring is not even a standing property. The
FOREVER-SPLIT rule in `_cage_ui.js` gives each aft parameter a ONE-SHOT copy of
its front counterpart and then the two halves are independent for ever. The
name promises a symmetry the model deliberately refuses to maintain — the
user's own *"ça ne sera jamais complètement symétrique"*.

**THE ROW IS `Body & deck`. THE OPTIONS ARE `Cabin` AND `Turtledeck`.**

    Cabin        the body keeps its full section past the cockpit and the roof
                 runs aft to the boom; the glazing is a CUT into it.
                 Cub · C172 · Cherokee · DC-3                    (`mirror` 0)

    Turtledeck   the deck falls away behind the cockpit the way it rises in
                 front of it, and the cockpit stands proud of the body.
                 Spitfire · Jodel · glider pod · RV-4            (`mirror` 1)

`turtledeck` is the term of art for the decking aft of a cockpit. It names the
PART the choice creates, and a builder who looks it up finds exactly the right
photographs. Two alternatives, rejected:

- **"Cabin / Cockpit"** is the truest pair in plain aviation English — you sit
  IN a cabin and UNDER a canopy in a cockpit — but `cockpit` is ALREADY a group
  name in the cage panel (dash setback, dash lip, dash depth). One word naming
  two things is the ambiguity this project keeps removing.
- **"Full height / cut down"** borrows the real historical operation ("the rear
  fuselage was cut down to take a bubble hood") but describes only half the
  geometry: the mirrored deck also TAPERS, it is not merely lowered.

**KEEP THE PARAMETER KEY `mirror`.** It is the honest name of the MECHANISM,
it is what `CAGE_AFT_SUB` and the forever-split read, and — decisively — it
rides through `spec.cage` verbatim into every saved build. Renaming the key is
a migration with a `GEN_SPEC_V` bump behind it; renaming the label is a string.
Change the label and the tile, and say so in the code where the key is declared
so the next reader does not "fix" the mismatch.

#### Half-bubble: a STARTER, not a fourth value — verified

**ANSWERED (2026-08-31), by reading `_cage_gen.js` and `_cage_page5.js`.**

`canopy` is 0..3 = `closed · conv · open · bubble`, and the mode does two
distinct things in the generator: `conv`/`open`/`bubble` all make a CUT in the
body (`CNCUT`), and only `bubble` builds a shell standing on it (`CNBUB`). The
shell's shape is then continuous:

    bubH   [CORRECTED — see §12.2: this sentence is the DEAD
           spec.cabin.canopy.height's comment, not bubH's. The live bubH
           rises off the SILL RAILS and its slider floor is 0.2.]
    bubW   the MAX WIDTH past the sill line. 1.0 is flush with the body,
           1.4 is a blown hood standing proud of it.
    bubAt  the apex station, and canLoops 1..3 control loops along it.

So the continuum from *flush* to *blown* already exists, in two parameters,
with the flush end explicitly documented as the zero. **A half-bubble is not a
missing enum value; it is a low `bubH` and a `bubW` near 1.0.**

The three tiles are therefore:

    Windscreen    canopy 0 (closed) — no cut, no shell; the glazing is the
                  body's own windscreen step and side windows
    Half-bubble   canopy 3 + STARTER: low bubH, bubW ~1.0, canLoops 1
                  — a hood let into the deck
    Full bubble   canopy 3 + STARTER: tall bubH, bubW proud of the body
                  — a blown hood standing on it

Windscreen is a DISCRIMINATOR (it removes the cut and every bubble row with
it). The two bubbles are ONE discriminator value plus a STARTER — which is why
§2's two kinds of row had to be separable in the first place, and why a tile is
allowed to be both. `convertible` and `open` stay out of the birth flow, per
the user ("je garderai ça pour plus tard"), and remain on the slider.

#### WRITE THE CAGE'S PARAMS, NOT `spec.cabin.canopy`

**A trap worth one paragraph, found while answering the above.** There are TWO
canopy parameter sets in this project:

    spec.cabin.canopy   height · sill · skew · bubble · lid · width · x0/x1 ·
                        reach · joint · facet · sun · sides · wsAngle · wsCurve
    the CAGE's own       canopy · bubH · bubAt · bubW · canLoops · bub{H,At,W}{2,3}

The first belonged to `genSkin`, which built the whole aeroplane from the
truss — **and `genSkin` is gone**. `63_gen_skin.js` became `63_gen_wing.js` at
G67.1 and its own header says so: "the cage replaced every part of that except
the WING". `spec.cabin.canopy` is now filled in by `resolveSpec` and read by
NOTHING (verified: the only hits in `src/` are the three `put()` calls that
derive `reach`, `x1` and `wsAngle`).

The birth flow builds a CAGE aeroplane. It writes cage params. A tile that
wrote `cabin.canopy.height` would change nothing on screen and would look like
a bug in the tile.

FLAGGED FOR ANOTHER CHANTIER, not this one: `spec.cabin.canopy` and
`cabin.glazing` are dead fields that still round-trip through every save. They
should either be removed with a `GEN_SPEC_V` bump or documented as vestigial
where they are declared. Leaving an unread block that LOOKS live is how the
next reader wires a control to it.

### 5.4 STRUCTURE

| row | kind | writes | status | note |
|---|---|---|---|---|
| construction | discriminator | `intCons` | L | composite · steel tube · plywood · aluminium |
| fuselage style | discriminator | `boomStyle` + `taperOn` | L | lofted skin · rod-and-pod; the taper section is its own presence flag |
| section profile | starter | `topRound` `botRound` `topAngCeil` `topAngRoof` | L | four tiles: **box** · **round top, flat bottom** · **flat top, round bottom** · **round** — the four the user named. Continuous underneath, so any of them is a starting point and not a cage. |

Per-surface materials (`wgCons`, `finCons`, `stCons` — landed) are NOT in the
birth flow. They are a refinement of a built aeroplane and belong to their
parts. The birth flow sets `intCons`, which they all default to.

### 5.5 WING

| row | kind | writes | status |
|---|---|---|---|
| position | discriminator | `wgPos` (high · mid · low) | L |
| bracing | discriminator | `wgBrace` (struts · cantilever) | L |
| planform | starter | `wgChordTip` `wgSweep` | L |
| tips | starter | `wgTip` (6 in `GEN_TIPS`) | L |
| flaps | discriminator | `wgFlapType` (4 in `GEN_FLAPS`) | L |

**PLANFORM** is the user's "droite ou swept", widened to the three that are
actually different aeroplanes: **rectangular** (taper 1, sweep 0 — the Cub),
**tapered** (taper ~0.6, sweep 0 — the Jodel), **swept** (taper ~0.7, sweep
15–25). Forward sweep stays reachable on the slider and is not a tile; the
generator already prices it honestly (`|sweep|` costs lift-curve slope either
way, which is why forward sweep is not a free CG trick).

### 5.6 PROPULSION

| row | kind | writes | status | note |
|---|---|---|---|---|
| **powertrain family** | discriminator | `engFamily` (NEW, replaces `engPower` + `arch`) | **P** | see §6 |
| engine model | starter | `engPreset` | L | 18 presets, FILTERED by family |
| **mount** | discriminator | `engines[].mount` | **P** | nose live; pusher and wing nacelles declared |
| **engine count** | discriminator | `engines[].length` | **P** | 1 live; the solver has counted engines honestly since G4.9, the CAGE has not |
| propeller | starter | `prop.blades` `.material` `.pitch` | L | |

### 5.7 TAIL

| row | kind | writes | status | note |
|---|---|---|---|---|
| **empennage type** | discriminator | `tail.type` + `stabH` | **P** | see below |

    conventional   tail.type 'conventional', stabH 0          LIVE
    T-tail         tail.type 'conventional', stabH 1          LIVE (measured
                                                              off the cage)
    V-tail         tail.type 'v'                              DECLARED —
        the SPEC and the SOLVER both support it (the ruddervator mixing falls
        out of the panel normals), but the CAGE does not build one.
        [CORRECTED — see §12.3: `_cage_fin.js` says the OPPOSITE — its
        classifier is deliberately V-tail-proof. True by absence, not by
        declaration; the shipped reason string says so.]
    cruciform      stabH ~0.4                                 DECLARED
    twin boom      two fins on a twin tail carrier            DECLARED —
        the natural companion to `boomStyle`, and it is the one empennage that
        needs a new BOOM, not a new tail.

### 5.8 UNDERCARRIAGE

| row | kind | writes | status | note |
|---|---|---|---|---|
| layout | discriminator | `gear.type` | L | taildragger · tricycle; measured off the built cage today |
| **retraction** | discriminator | `gear.retract` (NEW) | **D** | fixed · retractable. Absent everywhere today. A real discriminator (mass, drag, price, complexity) and a genre classic. |
| suspension | starter | `gear.suspension` | L | bungee · spring steel · oleo (`GEN_SUSPENSION`) |
| fairings | starter | `s1Fair` | L | none · spats · trousers |

### 5.9 LIVERY

| row | kind | writes | status |
|---|---|---|---|
| scheme | starter | `paint.sweep` `paint.job` | L |
| base colour | starter | `paint.base` | L |
| trim colour | starter | `paint.trim` | L |

**WRITE `paint`, NOT `finish`.** There are two colour systems: `paint`
(base/trim/sweep — the generated scheme, which EVERY aeroplane in the fleet has
had since G4) and `finish` (the AEROSKIN per-section overrides, landed at
G105). The birth flow writes `paint` only. `finish` stays `null` — the factory
finish — and is where the fine work happens later, in the FINISH tab that
already exists for it. Writing both at birth would recreate exactly the "two
ways to state one fact" ambiguity G105 removed.

The user's "a little extra colour on the wing edges and the control surfaces"
is `paint.trim` doing what it already does. No new field.

---

## 6. THE ENGINE, IN TWO LEVELS

The user's ask is right and the action is a MERGE, not an addition. Two
competing hierarchies exist today:

    engPower   in _cage_eng.js     piston | electric
    ENG_ARCH   in _eng_gen.js      flat | inline | vee | radial | electric

Adding a third master category would make three. So:

**LEVEL 1 — the family.** [CORRECTED — see §12.1: the two-stroke split
ALREADY EXISTS and IS the inline row; the list below is superseded by the
five ENG_ARCH rows.] `engFamily` absorbs both. `ENG_ARCH` stays exactly
what it is — the geometry table, one row per family, which is the design that
makes a V12 cost a table row and not a builder — and the family row on the
panel simply selects into it, with the two-stroke split out because it is a
different machine and the mass law says so:

    electric        outrunners, e-PPG, FES, EMRAX, E-811, SP260D
    two-stroke      Rotax 277, Rotax 582
    flat (boxer)    A-65, O-200, VW, Jabiru, Rotax 912, IO-360
    inline          — no registry model (UNVALIDATED in ENG_ARCH)
    V               — no registry model (UNVALIDATED in ENG_ARCH)
    radial          R-1830

**LEVEL 2 — the model.** `engPreset` (18 today), FILTERED to the chosen family.
This is what makes the list legible: choosing "electric" then picking among
seven, rather than scrolling one list of eighteen where an outrunner sits next
to a Twin Wasp.

**NOT A LEVEL.** `aspiration` (`na` / `electric` in the registry, read by
`atmosPowerRatio`) is DERIVED from the family, never chosen. A turbocharged row
would be a third value there and a real choice — but it is a change to the
altitude model, not to this flow.

**A FAMILY WITH NO MODELS IS STILL A FAMILY.** `inline` and `V` have no
registry entry and `ENG_ARCH` marks both UNVALIDATED. They render live anyway,
because the engine BENCH can build one from bore/stroke/cylinders — the model
list is simply empty and the rows below are the builder's. That is the seam
where the procedural engine generator arrives.

---

## 7. THE ARCHETYPES, AND THEIR GATE

The user: *"on vérifiera que les différents stéréotypes volent."* Correct, and
it is a gate. The trap is the cartesian product — 5 classes × 3 canopies × 5
empennages × 2 gears × 3 wing positions is 450 aeroplanes and hours of battery.

**So: a DECLARED LIST of named archetypes, not a product.** Roughly a dozen,
each a recognisable aeroplane, each a full row of the table in §5 with its
values filled in. They are also the seed of P6's rack and the answer to "what
do I start from".

Proposed set (each one exercises a different corner of the declaration):

| archetype | class | exercises |
|---|---|---|
| Cub-alike | `eab` | taildragger, high strut-braced wing, windscreen, tube+fabric, tandem |
| Jodel-alike | `eab` | cantilever cranked wing, wood, side-by-side, tricycle-or-tail |
| C172-alike | `n23` | alloy, tricycle, 2+2 cabin, slotted flaps |
| RV-alike | `eab` | low wing, bubble canopy, cantilever, alloy, fast |
| Savannah-alike | `ulm` | STOL, high wing, big flaps, bush role |
| single-seat ultralight | `ul1` | the smallest buildable, minimum systems |
| pod-and-boom pusher | `ulm` | `mirror` + `boomStyle` rod + pusher **(inactive until P7)** |
| motorglider | `sail` | long span **(inactive until the clamps widen)** |
| radial biplane-alike | `n23` | radial family, the heaviest live engine |
| electric trainer | `lsa` | electric family, no fuel, the altitude model's other branch |
| T-tail tourer | `n23` | `stabH` 1, retractable **(gear inactive)** |
| V-tail tourer | `n23` | `tail.type` v **(inactive until the cage builds one)** |

**GATE ARCHETYPES.** For every archetype whose every option is LIVE:
1. it resolves, clamps and builds without a clamp biting a declared value
   (a class that promises a 16 m span and gets 14 is a FAILURE, not a clamp
   doing its job — that is the §5.2 finding, gated);
2. `genShakedown` returns no red row;
3. it flies a circuit, as GATE GEN does.

Archetypes with an inactive option are SKIPPED WITH THEIR REASON PRINTED, so
the gate log is also the backlog.

**GATE DESIGN**, separately and cheaply: every row in the declaration is
claimed by exactly one group, every option either writes something or carries a
reason, and every param the table writes exists in the panel. Same discipline
as GATE PARTS, same argument.

---

## 8. THE UI

### 8.1 Hosts

    no aeroplane on the stand   the tiles fill the viewport
    an aeroplane on the stand   the tiles render in the PROPERTIES panel when
                                `Design & construction` is selected

One component, two hosts. No modal, no new surface, no new navigation axis
(UI-MODEL §3).

### 8.2 The tiles

Large buttons, one row of tiles per macro row, silhouette above and label
below, the current value marked. The row's own help is one line under the row
heading, not per tile — per-tile prose turns a grid into a form.

### 8.3 The thumbnails — GENERATE THEM

The naive count is ~60 hand-drawn SVGs. It is about fifteen, because the build
functions are already exported (`90_node_exports.js`): `genSect`, `genSuper`,
`genCrownToN`, `genCrownScale`, `genBodyCurve`, `genBodyRows`, `genAirfoil`.

    GENERATE   section profiles (the four), wing planforms, tips (6 in
               GEN_TIPS), airfoil sections, canopy sections, empennage
               outlines. One function per family, called with the option's
               own values, emitting a path — so the tile cannot disagree with
               the aeroplane the option builds, which a hand-drawn icon can
               and eventually will.

    DRAW       the ones with no geometry behind them: role, class, powertrain
               family, engine mount, gear layout, construction material,
               interior style. Roughly a dozen, and they are SILHOUETTES —
               a three-quarter or side outline of the machine — not
               pictograms. A pictogram of "bush role" is a guess; a silhouette
               of a taildragger on big tyres is the answer.

### 8.4 The pre-plaque

The flow shows, live, what the current selection PRODUCES: estimated empty
mass, stall speed, price, and the declared class beside the computed one.
[CORRECTED — see §12.4: the plaque is NOT live and must not become so —
"THE PLAQUE IS EARNED" (app.js) is an explicit ruling, bench-gated and
withdrawn on every rebuild. Decided with the user: the three-number strip
lives INSIDE the tile component on BOTH hosts, compute-only through the
join, and the plaque ruling stands.]

### 8.5 Surprise me

One button, one seed. Picks a random VALID combination — valid meaning every
option live and the archetype rules satisfied — and applies it as one undoable
starter. Nearly free once the declaration exists, and it is the fastest way a
new player learns what the axes are.

---

## 9. WHAT THIS SPEC DOES NOT DO

- It does not implement pushers, multi-engine, retractable gear, V-tails,
  cruciform or twin-boom empennages, or the RC / utility / sailplane classes.
  It DECLARES them, with reasons, so they render as greyed tiles and the
  backlog lives where it is felt.
- It does not widen `clampSpec`. §5.2 names the decision; taking it is another
  chantier with the gate battery watching.
- It does not touch `finish` / AEROSKIN. Birth writes `paint`.
- It does not add a mode, a modal, or a fifth surface.
- It does not make role or class into constraints. Both are labels, and the
  gap between the label and the built aeroplane is content (ROADMAP P8 §3).

---

## 10. QUESTIONS — ASKED, AND ANSWERED

All five were resolved with the user or by investigation on 2026-08-31. They
are kept, not deleted: an implementation session that can see the question and
the answer will not re-open it.

1. ~~**Classes**: five live, or widen the wing clamps first?~~
   **DECIDED: five live (`ul1` `ulm` `lsa` `eab` `n23`), three greyed.**
   Folded into §5.2.

2. ~~**Half-bubble**: a third `canopy` value, or a starter?~~
   **VERIFIED: a STARTER over `bubH` / `bubW` / `canLoops`.** The flush-to-blown
   continuum already exists and its zero is documented. Folded into §5.3, with
   the `spec.cabin.canopy` trap that turned up beside it.

3. ~~**Role**: defaults only, or a judged target?~~
   **DECIDED: defaults now, TARGETS DECLARED now in `genShakedown`'s own units,
   judging when P5/P6 arrive.** Folded into §5.1.

4. ~~**Passenger bays vs seating layout**: one question or two?~~
   **VERIFIED: neither — `cabin.seating` is DERIVED by the join from
   `paxCount` + `seatLayout` and must not be offered at all.** Folded into
   §5.3, with the finding that two of `paxCount`'s five positions change no
   seat and no mass.

5. ~~**Birth flow vs `Design & construction`**: same row set?~~
   **DECIDED: the same row set, one declaration, two renderings** (§3). The
   difference is SEQUENCE, not content — the birth flow walks the rows in a
   fixed order, the tree groups them. Two things exist only at birth and are
   NOT rows: the archetype picker (§7) and `Surprise me` (§8.5). The
   pre-plaque (§8.4) exists in both and is free in the tree, because the
   INFO panel is already permanent.

---

## 11. THE FINDINGS THIS SPEC TURNED UP

Not part of the flow. Each is a real defect or a real gap, found while
answering the questions above, and each belongs to somebody else's chantier.
Listed so they are not found again.

1. **`spec.cabin.canopy` and `cabin.glazing` are dead.** Filled by
   `resolveSpec`, read by nothing since `genSkin` was deleted at G67.1. They
   still round-trip through every save and still look live. Remove with a
   version bump, or mark vestigial where declared. (§5.3)

2. **`paxCount` 0-4 has three outcomes.** Bays 1 and 2 both seat two; bays 3
   and 4 both seat four. Two slider positions build real structure and bill no
   crew. `GEN_SEATING` needs a six-seat row, or the mapping needs to say why
   not. (§5.3)

3. **The buildable envelope is narrower than the engine catalogue.** Span
   6.5-14 m and chord 1.15-2.10 m against powerplants from 180 W to 895 kW —
   an RC outrunner, an FES sustainer and an R-1830 all have engines and no
   airframe that can carry them. (§5.2)

4. **Two engine hierarchies.** `engPower` (piston/electric) in the cage panel
   and `ENG_ARCH` (flat/inline/vee/radial/electric) in the generator, naming
   overlapping sets. §6 merges them; until it lands they can disagree.

5. **The V-tail exists in the spec and the solver, and not in the cage.**
   `tail.type: 'v'` resolves, the ruddervator mixing falls out of the panel
   normals in `30_solver.js`, and `_cage_fin.js` says in as many words that no
   V-tail can be built. A configuration the physics supports and the builder
   cannot reach. (§5.7) [The `_cage_fin.js` attribution is wrong — §12.3.]

---

## 12. VERIFIED AGAINST THE CODE (2026-08-31, the implementation session)

Where this document did not survive verification. Kept in the §10 spirit: a
session that can see the claim and the correction will not re-quote the claim.

1. **§6's engine list — the two-stroke split ALREADY EXISTS and IS the
   inline row.** `_eng_page.js:146-147` labels the arch
   `['inline', 'inline (2-stroke)']`, `_eng_mesh.js:193` forces
   `twoStroke = 1`, and Rotax 277/582 are the inline family's two registry
   models — not orphans of a missing family. Splitting two-stroke out would
   empty `inline` and duplicate a distinction the code carries. SHIPPED:
   `engFamily` = the five ENG_ARCH rows — electric (7 models) · two-stroke/
   inline (2) · flat (**8**, not 6: the spec missed 'flat twin' and 'flat
   six') · vee (0, UNVALIDATED, greyed with that reason rather than the
   spec's render-live) · radial (1). Bonus finding: the old arch dropdown
   offered only 3 of ENG_ARCH's 5 rows, so `vee` was doubly unreachable.

2. **§5.3's `bubH` semantics were borrowed from the dead field it warns
   about.** The "rise above the deck line, 0 = flush" prose is
   `spec.cabin.canopy.height`'s comment (`60_gen_spec.js:1189-90`) — the very
   field §5.3 declares vestigial. The live `bubH` rises off the SILL RAILS
   (`_cage_gen.js:6540`) and its slider floor is 0.2 (`_cage_page5.js:254`).
   The two-starter design stands; the shipped numbers are half = bubH 0.30 /
   bubW 1.0, full = bubH 0.85 / bubW 1.25, derived from the generator.

3. **§5.7's V-tail reason string was unsourced.** `_cage_fin.js:396-402`
   says the OPPOSITE of what §5.7 attributes to it — the classifier is
   deliberately V-tail-proof, and `_cage_stab.js:66-67` anticipates one.
   "The cage builds no V-tail" is true BY ABSENCE. Shipped reason: "the spec
   and the solver both support it; the cage does not build one yet."

4. **§8.4's pre-plaque contradicted a standing ruling.** "THE PLAQUE IS
   EARNED" (app.js): bench-gated, withdrawn on every rebuild — not live, and
   deliberately. DECIDED WITH THE USER: a three-number strip (empty mass,
   stall, take-off run + the declared class) INSIDE the tile component on
   both hosts, compute-only through the join (the "export is not a button"
   ruling also stands — nothing commits).

5. **§5's L column overstated six rows.** `gear.suspension`, `prop.*`,
   `paint.*`, `meta.reg` are live in the MODEL and had NO editor row —
   nothing in `src/viewer/` edited a spec path at all. The tile grid is now
   their full UI, writing through `GARAGE_SPEC.update` (per-key merge).

6. **§5.8's layout row — `gear.type` is a MEASUREMENT** (`_cage_join.js:369`
   derives it from where the built third wheel stands), so the tile is a
   STARTER over the cage's own stations plus a spec-channel INTENT write,
   and the join's measurement must agree with the starter. MEASURED: the
   tricycle values ship agreeing (the join reads 'tricycle' after the
   starter runs). The same trap caught §5.7's empennage: `tail.stabH` is
   measured too, and the first-guess stY 1.25 measured stabH **0.52** — a
   cruciform wearing a T-tail's tile. Shipped values are measured: stY
   0.408 → 0.10, 1.05 → ~0.40, 2.35 → ~0.97.

7. **§5.1's name row would have recreated the G65 defect.** `meta.name` is
   written from the save-slot name (garage.js: "NAMING IT IS NAMING IT").
   No name row shipped; naming stays the save action. `meta.reg` kept its
   field.

8. **§8.3's GENERATE list was optimistic by two.** Canopy sections and
   empennage outlines are not generable from `90_node_exports.js`
   (`cageCanopy` is 3D post-subdivision; the fin lives in `_fin_gen.js`).
   Both moved to DRAW — a parameterised side-view silhouette builder, so the
   drawn family stays one hand.

9. **§7's "radial biplane-alike" promised a biplane nothing builds** (one
   `wings[0]` everywhere). Shipped as the radial MONOPLANE tourer, same
   class, same purpose. And §5.6's engine-model row contradicts
   `_cage_parts.js:109-115` (which rules `engPreset` out of the design
   part) — that comment is revised rather than silently contradicted.

10. **Two states this spec assumed do not exist.** (a) There is no
    "no aeroplane on the stand" state — boot always loads the WIP or the
    jodel; the viewport host is ENTERED via the fleet's "✚ new aeroplane"
    row, and opens itself only on a truly fresh browser (no WIP key).
    (b) There is no undo system anywhere — the one-step starter undo is a
    single-slot snapshot local to the flow.

11. **Wording**: `GEN_PRESETS` is UNREAD (a dead symbol, not merely
    single-entry); `GEN_SEATING` has an unreachable seventh row `drone`
    (crew 0); the mirror FOREVER-SPLIT has a re-copy gesture
    (`_cage_ui.js:839-841`), not strictly one-shot; `s1Fair` maps to
    `gear.fairing` `none · spat · full` (not "trousers");
    `cabin.glazing` IS read by clampSpec three times — all inside the dead
    block, so the conclusion holds; stale `63_gen_skin.js` references
    remain in `60_gen_spec.js` (:909, :1175, :1685, :1956).

12. **GATE ARCHETYPES found two content limits by FLYING them.** The Rotax
    277 cannot climb what the cage bills for even the smallest buildable
    airframe (empty 208 kg where a US-103 frame is ~115; climbRate
    0.09 m/s; take-off rejected) — the `ul1` class fits the 582 until a
    lighter-structure chantier exists. And the R-1830 tourer FLIES (TORun
    187 m, VCruise 67 m/s) but cannot be LANDED — gave-up still INBOUND at
    900 s, carded circuits refused (cant-hold-speed) — which is §11's
    finding 3 arriving as a flight result; the archetype is `blocked` with
    that measurement and unblocks with the `util` class. Seven archetypes
    fly complete circuits; five skip with printed reasons.

13. **The birth spec must STATE what it chose.** A baked `{cage}` alone
    flies GEN_DEFAULT's wing and engine until the join's first export —
    which the app runs at load, and a gate does not. `designBake` therefore
    writes the chosen wing, bracing, flap type and engine through the
    join's own verbatim maps (`CAGE_JOIN_ENGINES`, the tip/flap key
    tables), and only for CHOICES — everything the join MEASURES stays
    derived. Also: `meta.role`/`meta.class` ride saves through
    `genNormaliseSpec` with no version bump (5→6 stays the energy arc's);
    their one-line GEN_DEFAULT declaration + clampSpec type guard is owed
    to `60_gen_spec.js` when that file cools — GATE DESIGN carries the two
    paths explicitly until then.
