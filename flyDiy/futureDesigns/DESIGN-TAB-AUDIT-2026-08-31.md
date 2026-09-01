# THE DESIGN TAB'S ACCESS PATHS — an audit (2026-08-31)

The user's concern, in their own words: "multiple access points and discrete
choices which should really be part of the shape section with appropriate
sliders" — a purpose tile that "changes things 2 ways" so a later shape edit
"renders it moot", and the fear that framing tiles as initialization lets
them go stale. This document walks every row of `tools/_cage_design.js`
against its slider-side twins in `tools/_cage_parts.js` (and the engine,
gear, cowl and wing pages), states what each row reads and writes, and
classifies the failure modes. Verified against the code on 2026-08-31; line
references are to the current tree.

## The law the file already declares (and where it holds)

`_cage_design.js`'s own header rules: a tile is "a second rendering of state
the panel already owns, never a second home for it"; rows are DISCRIMINATORS
(live both ways, never destructive) or STARTERS (write once, must warn, must
undo). `design_flow.js` implements the starter contract: the overwrite count
is computed against the page base (`designOverwriteCount`), the tile arms
("will overwrite N tuned values — click again"), and there is a one-slot
undo. GATE DESIGN (`_design_check.js`) holds the DECLARATION honest: every
option writes something or carries a reason, every cage key real, every spec
path in GEN_DEFAULT, archetypes resolve.

**What no gate checks**: (1) READ FIDELITY — that applying an option leaves
the row's own `read` returning that option; (2) CHANNEL COHERENCE — that a
row writing a cage key AND a spec path (two homes for one fact) cannot have
the two moved apart by any other control. Both gaps are load-bearing below.

## Classification of all 28 rows

### X — SPLIT-BRAIN DUALS (correctness bugs, the real thing to fear)

Two rows write ONE FACT into TWO homes — the spec (physics) and the cage
(the drawing) — and the tile is the only thing keeping them in step. The
slider-side twin moves the drawing alone, and the join never measures these
back. This is the WYSIWYG rule (G117) violated by construction:

1. **suspension** — writes `spec.gear.suspension` (consumed by
   61_gen_frame:46, `GEN_SUSPENSION`: leg architecture, softness, mass) AND
   `cage s1_shockKind` (the drawn bungee/spring/oleo). But `s1_shockKind`
   and `s2_shockKind` are ordinary rows in the mains/third parts' `shock`
   groups (_cage_parts.js:519,539) — move one and you fly a bungee wearing
   an oleo. The join measures `gear.type` off the built cage; it does NOT
   measure suspension. The tile reads spec only, so it goes on claiming the
   physics truth while the drawing lies.

2. **prop** — writes `spec.prop {blades, material, pitch}` (mass, price,
   thrust family — 60_gen_spec clamps, GEN_PROP_MATS prices) AND
   `cage cw_material / cw_bladeN` (the drawn blade). The G125 note in the
   row says exactly why: before it, "a 3-blade carbon tile drew two birch
   blades". The tile path is fixed; the SLIDER path is not — `cw_bladeN`
   and `cw_material` are rows in the prop part's `blades` group
   (_cage_parts.js:493). Same shear, one control further down. (`cw_propD`
   vs `spec.prop.D` should be checked in the same pass — not verified
   here.)

**Fix shape** (the house pattern, gear.type's own): the JOIN measures the
built cage — shock kind → `gear.suspension`, blade count/material →
`spec.prop` — so the cage is the one author and the spec records it. Then
the sliders become honest and the tiles become mirrors. Small, contained,
and `_join_check` gets the two new measured rows.

### L — INTENT LABELS WEARING STATE-TILE CLOTHES (the "moot" rows)

**role** and **class**. Both write real geometry once (role: wgFlapType,
wgPos, wgBrace, s1R, wgCamber, wgSweep, wgAilSpan/Chord, s1Fair + spec
fuel/cargo/systems; class: span, chords, seats, cabin widths, engine preset
+ spec fuel/systems/baggage) — but READ only `meta.role` / `meta.class`.
So the tile stays lit forever, whatever the sliders have since become: the
user's "purpose changes things 2 ways, and a shape change renders it moot",
precisely. The declarations DO frame them as intent ("an intention, not a
geometry", "a label, not a constraint — the gap is content", and P5/P6 will
judge intent against measurement) — the framing is right and worth keeping.
What's wrong is the PRESENTATION: an intent label and a geometry starter
fused into one tile that renders exactly like a discriminator. Nothing on
screen says "this lit tile is a claim about intent, not about the
aeroplane".

**Fix shape**: split the two meanings. The identity row keeps the label
(writes meta.* only — can never go stale because it claims nothing about
geometry); the geometry seeding becomes the birth flow's business (where it
already runs) plus, at most, an explicit "re-seed from role (applies once)"
action styled like the engine-model row. The engModel row is the exemplar
already in the file: `read: () => null`, "a preset (applies once) — every
engine row stays yours after". No highlight, no staleness, no lie.

### C — LOSSY CLASSIFIER READS (tiles that approximate the sliders)

These reads recompute at every render (rowBlock calls `read` live), so they
don't strand — but they BUCKET a continuous truth, and the bucket can
misreport:

- **planform** (the worst): `|sweep| >= 8 → 'swept'`, else taper>0.85 →
  'rect' else 'tapered'. A hand-set 5° sweep is invisible; an 18° sweep
  erases the taper claim; and a CRANKED wing (wgCrankAt > 0) doesn't exist
  in the tile's vocabulary at all, though the generator builds it and
  'jodel crank' is a named GEN case. Worse, re-applying 'rect' or 'tapered'
  writes `wgSweep: 0` — a hand-set sweep is silently zeroed as a SIDE
  EFFECT of picking a taper (the armed warning fires, but "planform:
  rectangular" nowhere says "…and your sweep goes").
- **canopy**: half vs full = `bubH < 0.55`; a hand-tuned hood flips the
  tile across the threshold. Convertible/open read as nothing selected
  (honest).
- **section**: topRound/botRound ≥ 0.5 buckets; also writes
  topAngCeil/topAngRoof on apply (armed warning covers).
- **empennage**: stY buckets (≥1.8 T, ≥0.75 cruciform) — measured-
  calibrated (the entry says so) and a fair mirror; writes stZ alongside.
- **scheme / base / trim**: read global `spec.paint` — live, but since the
  per-part livery arc (G109-G112) a part override can make the global claim
  partial. Cosmetic-tier.

### D — BENIGN DUALS (two doors, one room — policy, not correctness)

Tile and raw row write the SAME single key, and the tile's read is the key
itself, so they cannot desync: **wgFlapType** (also in wingCtl's `flaps`
group), **wgTip** (also in planform group), **s1Fair** (also in mains
`station`), **intCons** (also the design part's own `construction` raw row),
**engFamily/engPreset** (also the engine part's `fitted`/`geometry` rows),
**gearLayout** (mirrors s2Leg; its nine station writes are re-editable in
the gear part, and the join measuring `gear.type` closes the loop — the
documented self-correcting case). These are the "multiplicity" the user
distrusts; they are safe, but each is a place where the design tab and the
shape section must be understood as TWO VIEWS OF ONE STATE, and the G129
tab split already argues exactly that. Recommend: keep, but they inherit
whatever visual grammar distinguishes discriminators from starters (below).

### S — SOLE ACCESS OR INERT (fine, as the user said)

reg (field, meta.reg), seatLayout, paxCount, mirror, boomStyle, wgPos,
wgBrace (their raw twins on the design part write the same key), seatType,
engMount / engCount / retract (single live option or declared-inactive).

## The starter warning's calibration (minor)

`designOverwriteCount` measures "tuned" against the PAGE BASE — so values a
CLASS starter wrote earlier count as tuned forever after (over-warning),
and a hand-set value that happens to equal the base is free
(under-warning). Fine for tonight's honesty, worth a note in the file.

## The wing: the user's three-station model vs the current law

Current (61_gen_frame:306-321): chord is `linC` — ONE linear taper from
root chord to tip chord across the whole semi-span; sweep is ONE angle
walking both spars aft from the root; `wgCrankAt` breaks ONLY dihedral
(piecewise) and inserts a spar joint — the chord line and sweep line run
straight through the crank, and a cranked wing forfeits its struts
(61:350). So the current parameter set CANNOT express: constant-chord
inner + tapered outer (the actual Jodel/C172 planform), outer-panel-only
sweep, or an LE/TE kink — the 'jodel crank' preset approximates with a
global taper.

The user's proposal — sections at ROOT, CRANK and TIP (before the tip
bow), each with a chord and a fore/aft position — is a strict
generalization: `{chord@root, chord@crank, chord@tip, x@crank, x@tip}` +
the existing `wgCrankAt` subsumes `wgChord`, `wgChordTip` and `wgSweep`
(per-panel sweep falls out of the x offsets), gives the Jodel its real
wing, and lets the planform TILE become either a pure starter over those
sliders or three icons that write them — no discrete state left to go
stale. Scope, honestly: `chordAt`/`xFat`/`xRat` become two-segment
piecewise (61_gen_frame), the covering/rib mass integrals and aero strips
follow (61, 62), the skin (63) and the bench mirror (_cage_wing) follow,
`spec.wings[0]` grows fields → **GEN_SPEC_V bump + migrator + a vintage
fixture** (save compatibility is forever, ROADMAP ruling 4), the join
mappings and GATE GEN/JOIN grow rows. A proper chantier — G-scale, not an
evening — and the strut-vs-crank exclusion (61:350) needs its own ruling
(a cranked strut-braced wing is a real aeroplane: the Cessna's is cranked
at the strut).

## Recommendations, in order — STATUS 2026-09-01: 1–4 LANDED as G132
## ("one fact, one keeper"); 5 LANDED as G140 ("the wing is three
## stations") in the joint session, with the crank-strut ruling settled
## the user's way (crank constrained to the strut when one exists) and
## the planform tile retired entirely. HANDOVER canonical for both.

1. **Close the two split-brains (X)** — join measures suspension and prop
   blades/material off the built cage, `_join_check` gates the mappings.
   Small, restores WYSIWYG, no UI change.
2. **Give starters the engModel grammar** — "applies once", no persistent
   highlight (read → null or a ghost state), so initialization CANNOT go
   stale because it never claims to be state. Planform, section, canopy's
   bubble pair, empennage, gearLayout, suspension, prop, wgTip keep their
   tiles but stop pretending to be the current configuration where their
   read is lossy.
3. **Split role/class into label + seed** — the meta write stays a live
   identity row; the geometry write runs at birth (and optionally behind an
   explicit re-seed action). The tile then never lies.
4. **GATE DESIGN grows two check families** — read fidelity (designApply an
   option on the page base → the row's read returns that option, for every
   live option of every faithful-read row) and channel coherence (every
   row that writes cage+spec pairs DECLARES the pairing; the gate asserts
   the join measures it or the pair is tile-only).
5. **The three-station wing** — its own chantier with the spec migration,
   designed WITH the user (G34's lesson stands).

Nothing in this document is landed; it is the audit the user asked for.
