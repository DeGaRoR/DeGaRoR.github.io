# HANGARS — the shed as a thing you own, choose and outgrow
## Shell · fit-out · capability, and the seed of a hangar per airfield
### (2026-08-31, from the user's design session)

STATUS: S1+S2+S3 LANDED 2026-08-31 (HANDOVER G126): the player document
(`flydiy.player`, src/core/70_player.js, GATE PLAYER), the kit fit-out and
placement engine (src/core/26_hangar_fit.js, GATE HANGAR), `club` + `works`
live with per-shell slider limits, GATE SITE extended. S4 LANDED same day
(HANDOVER G127): the `field` timber shell is LIVE — half-dims CONFIRMED by
the user (14 x 18 m outside), FRAME branch in genHangarBuild, one top-hung
leaf on an outrigger track, GATE HANGAR at 739 checks. S5 LANDED same day
(HANDOVER G128): AIRFIELD_SITES registry + siteOf (alias kept forever),
siteOnFlat per aerodrome, the editor's advisory line, and SHELLS.sky =
'alps' as the shed<->HDRI association point. THE SPEC IS IMPLEMENTED END
TO END; what §8 deferred stays deferred (enforcement, economy, discovery,
the hangar editor, the real WIP mechanism).

CORRECTIONS found during implementation (G126):
1. §4.2's premise is stale since G62.10 — the two Jodel airframes ARE baked
   props (jodel_prep.py). The user ruled them a tenth `wip` display kit, so
   rule 4 has no exception list and a bare shed is truly bare.
2. §3's "the truss count is already a loop over the depth" was wrong — the
   count was a fixed 7; only spacing stretched. NT/nBay/NLIGHT now derive
   from HD (G126).
3. §5's hook fields: `intCons`/`wgCons` etc. are CAGE params, not resolved
   spec fields — `hangarWants` reads `fuselage.material`, `wings[].material`
   and `tail.finMaterial/stabMaterial` instead.
4. The shell dims column is HALF-dims (club's row is today's shed verbatim);
   §4.3's "a 7 × 9 field shed" prose reads as full metres but cannot be — a
   7 m-wide shed passes no wing this generator builds. CONFIRMED by the user
   2026-08-31 ("yes half-dims is right"): field = 14 × 18 m outside.

WHAT IT RELATES TO:
- `src/viewer/hangar.js` — the room, already one function, already
  parameterised by dims, already carrying a 14-part material wardrobe.
- `src/core/25_airfield.js` — `AIRFIELD_SITE`, the declared place. Today a
  SINGLETON; §5 makes it a registry.
- `tools/props_table.py` — the declared prop table, 44 rows, 9 editor groups.
- `futureDesigns/UI-MODEL.md` §2.4 — `⌂ THE SHED` is already a tree root.
- ROADMAP P5 (economy) and P6 (fleet & discovery) — this spec declares the
  seed both will grow from, and §7 argues they want ONE container.

---

## 0. THE RULE, IN ONE LINE

**A hangar is three separable things — a SHELL, a FIT-OUT and a set of
CAPABILITIES — and the whole design is in refusing to collapse them into one
"level".**

---

## 1. WHAT ALREADY EXISTS (read before planning anything)

Far more than the ask assumes. Measured on disk, 2026-08-31:

**THE SHELL IS ALREADY PARAMETRIC.** `genHangarBuild(THREE, dims, opts)` takes
`{HW, HD, EAVE, RIDGE}` and rebuilds the whole room; the door width follows the
gable and the back doors follow the width. A different size is a call, not a
chantier.

**THE EXTERIOR IS THE SAME FUNCTION.** `opts.exterior` returns the shell
without the interior structure, and `render_world.js` stands THAT in the world
at `AIRFIELD_SITE.hangar`. So a new shell class gets its matching exterior for
free and the two cannot drift. This is the single biggest reason this spec is
cheaper than it looks.

**THE ROOM HAS A MATERIAL WARDROBE.** `PARTS` names 14 surfaces — ground,
apron, taxiway, grass, strip, side walls, back wall, brick stem, roof, main
beams, secondary beams, windows, man door, hangar doors — each an ordinary
material that can wear any set in `LIB` (the wall sets, ten CC0 site scans, the
floor) at its own tile / roughness / normal. **A timber-looking shed is already
reachable as a SKIN.** What is not reachable is a timber-BUILT shed: the
structure is a steel portal frame — seven trusses, their purlins, corrugated
cladding, a concrete stem — and that is hardcoded.

**THE PROPS ARE DECLARED, THE PLACEMENT IS NOT.** `tools/props_table.py` holds
44 rows in 9 groups, `_prop_check.js` gates the baked payload against it, and
nothing discovers props by scanning. But `hangar.js` places them with 70
hardcoded `prop(key, x, z, ry, y)` calls. The one exception is `MOBILE` — six
props placed on a clearance ring around the aeroplane's own bounding box, so a
DC-3 pushes them out and a drone lets them back in. **That is the pattern the
rest of the fit-out wants.**

**THE MACHINES THE USER ASKED FOR ARE ALREADY IN THE ROOM.** `bandsaw`,
`panelsaw`, `thicknesser`, `jointer`, `drillpress`, `vice_bench`, `weldingcart`,
`compressor`. The "medium hangar with woodworking machines" does not need new
assets. It needs the OTHER hangars to be able to NOT have them.

**AND ONE REAL DEFECT.** The shed's entire state lives in browser prefs:

    flydiy.hangarDims     the size
    flydiy.hangarParts    every part's material, tile, roughness, normal
    flydiy.hangarMobile   whether the kit is shown
    flydiy.hangarEnvSrc   room or sky environment

This is EXACTLY the defect G105 fixed for the aeroplane — per-section finish
and tint moved out of a pref and into `spec.finish`, under ruling 4, because a
pref cannot be saved, shared or reasoned about. The shed never got the same
treatment, and the moment there is more than one hangar a pref cannot hold them
at all. **Fixing this is stage 1 and everything else stands on it.**

---

## 2. THREE THINGS, NOT ONE LEVEL

The failure mode available here is "Hangar Level 3" — one number that makes the
building bigger, better equipped and more capable at once. It is the wrong
model for this game, because the whole aeroplane side of it is built on the
opposite principle: you choose the material AND the bracing AND the engine, and
a bad combination is content.

So a hangar is three declarations, and any combination of them is legal:

    SHELL         what the building IS: structure family + dimensions.
                  A shed, not a score.

    FIT-OUT       what is IN it: a set of KITS, each a named group of props
                  with a placement rule. Owned separately from the shell.

    CAPABILITY    what you can DO there: a set of verbs. DERIVED from the
                  fit-out, never set directly — you can weld because there
                  is a welding kit, not because the hangar says level 3.

The point of the split, in one example the user already named: **a big
industrial shed with nothing in it, and a small wooden field shed with a good
bench.** The first is worth more parking and less work; the second is the
opposite. One number cannot say that.

---

## 3. THE SHELL

    key      stable id, saved
    name     what the UI shows
    frame    the structure family — a BUILD, not a material
    dims     { HW, HD, EAVE, RIDGE } defaults
    doors    the door family
    skin     the default material set per PART (a map into LIB)
    price    credits
    status   'live' | 'declared'

### The three families

| key | name | frame | dims (HW/HD/EAVE) | doors | cost to build |
|---|---|---|---|---|---|
| `field` | Field shed | timber post-and-beam, board cladding | 7 / 9 / 3.6 | one sliding leaf | **HIGH — new shell** |
| `club` | Club hangar | steel portal, corrugated, glazing band | 15 / 12.5 / 7.0 | six-leaf front + bi-parting back | **NONE — this is today's shed** |
| `works` | Works | steel portal, more bays, taller | 20 / 20 / 9.5 | full-width, powered | **LOW — dims + truss count + a skin** |

**BE HONEST ABOUT THE COSTS, because they are not close.**

`club` is free: it is the room that exists, given a key.

`works` is nearly free. The truss count is already a loop over the depth, the
door already follows the width, and the material wardrobe already exists — so
"bigger, more bays, industrial skin" is dimensions plus a declared skin map. A
crane rail, if wanted, is one new drawn element.

`field` is the real work and the only genuinely new modelling. A timber shed is
not the steel shed made smaller: different structure (posts and rafters, no
portal), different cladding (boards, not corrugated), different door (one leaf
on a track, not six), different proportions, no glazing band, no concrete stem.
Roughly the same order of work as the original shed's frame. **It is also the
one the user named first and the one that carries the most character.**

Recommendation: ship `club` and `works` in the first chantier so the whole
mechanism is live and testable on two real shells, and take `field` as its own
chantier immediately after. Shipping the mechanism with one shell proves
nothing; shipping it with three delays it behind the expensive one.

### Dimensions stay free

The shell's dims are DEFAULTS, not limits. The existing size sliders keep
working and simply start from the class. Same ruling as the aeroplane's:
*derivation is the engineer's handbook, never a guardrail.* A `field` shed
stretched to 20 m is a barn somebody extended, and that is fine.

---

## 4. THE FIT-OUT: KITS

### 4.1 Why a kit table and not a field on the prop

The obvious move is a `hangar` column in `props_table.py`. It is wrong: a
workbench belongs to the bench kit AND the wood kit AND the metal kit, so the
column becomes a list on every row, and the question "what does the wood kit
contain" is answered by scanning 44 rows.

The question is about the KIT. So the kit is the record.

`props_table.py` keeps its `group` untouched — it is the EDITOR's display
section and it is doing that job correctly. Kits are a second, orthogonal axis
in their own table.

### 4.2 The kits

Every prop currently in the room, assigned. Nine kits over 44 props:

| kit | name | props | grants |
|---|---|---|---|
| `park` | Bare shed | — | `park` |
| `bench` | Workbench | `workbench_wood` `vice_bench` `stool_wood` `toolrack_wall` `toolbox_open` `toolchest_metal` | `handwork` |
| `wood` | Woodshop | `bandsaw` `panelsaw` `thicknesser` `jointer` `crate_wood_a/b/c` | `wood` |
| `metal` | Metalshop | `weldingcart` `compressor` `drillpress` `rack_steel` `drum_steel` | `metal` `tube` |
| `store` | Stores | `box_cardboard` `barrel_plastic` `bin_metal` `bin_metal_rust` `jerrycan` `bottle_lpg` `bottle_propane` | `store` |
| `handling` | Handling | `handtruck` `stepladder` `work_trestle` `cart_tool` `cart_tool_cab` `cart_storage` | `handling` |
| `office` | Office corner | `desk_metal` `radio_bench` `instrument_panel` `lamp_desk` | `avionics` `paperwork` |
| `comfort` | Comfort | `stove_masonry` `stove_barrel` `chair_lounge` `rug_persian` `lamp_pendant` `hosereel_wall` | `warm` |
| `curio` | Curios | `car_covered` `tyre` `table_wood` | — |

Two props are not furniture and stay outside the kit system: the workshop
pieces `airframe_jodel_wing` and `airframe_jodel_body`, which are not baked
props at all — `workshop.js` builds them from the game's own generator. They
belong to a WORK IN PROGRESS, which is a different mechanism (§8).

### 4.3 Placement — extend the MOBILE pattern, do not hand-place three sheds

70 hardcoded coordinates were composed against ONE shed at ONE size. They will
not survive a 7 × 9 field shed, and hand-placing a second and third set is
three layouts to maintain and two to forget.

`placeMobile` already solves the general problem: it takes the aeroplane's
bounding box, computes a clearance ring, and places six props against real
geometry. Generalise it.

**A kit declares SITES, not coordinates.** A site is an anchor plus an offset:

    { at: 'wallPort',  along: 0.30, out: 1.05, ry: 'faceIn' }
    { at: 'cornerAft', ... }
    { at: 'aircraft',  ring: 1.15 }        # what MOBILE does today

Anchors are named features the shell already knows: the two side walls, the
back wall, the door wall, the four corners, the floor centre, and the
aeroplane's own box. `hangar.js` computes them from HW/HD/EAVE — which it
already does implicitly, in the `FX`/`FZ` mapping that scales the authored
layout's absolute coordinates ("only the positions ALONG the walls scale").

**That mapping is the existing proof this works.** It was written for exactly
this reason and it is already half of the anchor system. Finishing it is
cheaper than maintaining a second layout.

A kit that does not fit its shell places what it can and reports the rest —
never silently. A field shed cannot take the full woodshop, and being told so
is the mechanism working.

---

## 5. CAPABILITIES

A capability is a VERB, derived from the fit-out. Never set directly.

    park       keep an aeroplane here                    every shell
    handwork   bench work, rigging, small repairs        bench
    wood       build wooden airframes                    wood
    tube       weld a steel tube fuselage                metal
    metal      alloy sheet work                          metal
    composite  layup — needs a warm, clean, enclosed bay  comfort + bench,
                                                          and NOT `field`
    engine     engine bench work                          metal + handling
    avionics   systems and panel fit                      office
    heavy      an aeroplane over N metres of span         SHELL, from dims

**`heavy` comes from the SHELL and everything else from the FIT-OUT**, which is
the split doing its job: a big empty shed lets you park a big aeroplane and
build nothing.

### The hook this is really for

The aeroplane already declares what it is made of — `intCons` and, since G116,
per-surface `wgCons` / `finCons` / `stCons`. So:

> a wooden wing wants a hangar with `wood`; a steel tube fuselage wants `tube`;
> a carbon aeroplane wants `composite`.

That is the loop this whole spec is a seed for, and it lands on machinery that
already exists on both sides.

**DO NOT ENFORCE IT IN THIS CHANTIER.** Gating what a player may build on where
they are standing changes the game's core loop and is a P5 decision with the
economy beside it. Declare the capabilities, show them on the hangar's card,
and let the aeroplane editor READ them to show an advisory line — the
engineer's handbook, once more, not a guardrail. Enforcement is one line and
one ruling later; an unconsidered enforcement is a game nobody can play.

---

## 6. A HANGAR PER AIRFIELD

The user's seed, and the shape is already sitting there.

`AIRFIELD_SITE` (`25_airfield.js`) is a declared place — hangar position and
dims, apron, taxiway, boundary — and its header already says why it exists:
three copies of one runway had disagreed, so the site became one record both
scenes read. **It is a singleton for one aerodrome.**

And `world.aerodromes` is already a registry with stable ids:

    HOME  Home Strip    main    x -520  z 0     1100 × 30 grass
    M1    Meadow 1      meadow  x -2200 z -1500 460 m
    M2    Meadow 2      meadow  x 1800  z 1500  520 m
    M3    Meadow 3      meadow  x -3400 z 650   480 m

The three meadows have no buildings at all.

**THE MOVE: `AIRFIELD_SITE` becomes `AIRFIELD_SITES`, keyed by aerodrome id.**
`HOME` carries today's record verbatim, so nothing in either scene moves and
GATE SITE passes unchanged. The meadows get no site — which is what a meadow
is — and a site can be GRANTED later.

    AIRFIELD_SITES = {
      HOME: { …exactly today's AIRFIELD_SITE… },
      M1: null, M2: null, M3: null,
    }

A granted site is a hangar record on that aerodrome: a shell, a fit-out, and
whatever paving comes with it. Discovering a meadow and finding a derelict
timber shed with a bench in it is the whole fantasy in one object, and it is
reachable from here.

**KEEP THE SINGLETON'S ACCESSOR.** Everything that reads `AIRFIELD_SITE` today
should keep working through `siteOf('HOME')` — the frame conversions
(`siteToLocal`, `siteToWorld`), the runway, the markers, the pad test, the
hangar box. A registry that forces every call site to learn a key is a
migration; a registry with a default is a rename.

---

## 7. WHERE THE STATE LIVES — and why this is the same problem as the fleet

The prefs (§1) cannot hold this. Four reasons, in order of severity: a hangar
per airfield is a collection, not a value; a hangar must be shareable, which is
ruling 4's whole point; a hangar must survive a browser; and an aeroplane's
save cannot hold it, because a hangar is not part of an aeroplane.

So a new container is needed. **And P6 needs exactly the same one.** The fleet
is "rows of named aeroplanes with plaques, logbooks, hours, wear" — persistent
player property, keyed, saved, outside any one spec. That is the same sentence
as the hangars.

> **RECOMMENDATION: this chantier and P6 agree on ONE container before either
> writes a save format.** Call it what you like — `estate`, `holdings`, the
> player record — but the aeroplanes, the hangars, the credits and later the
> logbooks are one document with one version and one migrator, not four
> parallel ones invented three months apart.

Two things belong in it immediately, and nothing else needs to yet:

    sheds   { <aerodromeId>: { shell, dims?, parts?, kits[], name? } }
    wallet  credits

`parts` is the existing per-part material overrides, moved out of
`flydiy.hangarParts` verbatim. `dims` is `flydiy.hangarDims`, likewise. Neither
changes shape; both change home. **That alone is a complete, shippable, useful
chantier** — nothing new is modelled, and the shed stops being something the
browser happens to remember.

`flydiy.hangarMobile` and `flydiy.hangarEnvSrc` stay prefs, and that is correct:
they are VIEW state, like `explodeD`. G106's ruling applies — view state never
flies, and view state is not property.

---

## 8. WHAT THIS DOES NOT DO

- **No hangar editor.** Placing individual props by hand is a different tool
  and a much bigger one. The fit-out is chosen by KIT; the kit places itself.
- **No enforcement of capabilities** (§5). Declared and advisory only.
- **No economy.** `wallet` is declared so the container has a shape; earning
  and spending are P5.
- **No discovery.** §6 makes a site per airfield POSSIBLE. Which airfields
  exist, how they are found and what granting one costs are P6.
- **No new props.** The 44 that exist cover all nine kits. `field` may want a
  timber-shed-specific few later; that is the shell chantier's problem.
- **No work-in-progress mechanism.** `workshop.js` builds half-finished
  aeroplanes from the generator and stands them on the floor. Making those the
  aeroplane you are ACTUALLY building — your wing on your trestles — is a
  lovely idea, a separate one, and it wants the fleet container first.

---

## 9. THE GATES

**GATE HANGAR** (new).
1. Every declared shell builds, interior and exterior, at its own dims.
2. Interior and exterior agree: same HW/HD/EAVE, doors in the same place.
   (`opts.exterior` makes this nearly free and therefore worth asserting.)
3. Every prop named by a kit exists in `props_table.py`.
4. Every prop in `props_table.py` is claimed by exactly one kit, or is
   declared unkitted with a reason (the two workshop airframes).
5. Every capability is granted by at least one kit or shell — a verb nothing
   can grant is a dead string.
6. Every kit places into every shell, or reports which sites it could not fill.
   A kit that silently drops props is the failure this rule exists for.

**GATE SITE** (extend). It already asserts the base aerodrome is one declared
place inside the flat pad. Extend it to iterate `AIRFIELD_SITES`: every site's
buildings inside their aerodrome's own flat region, every frame conversion
round-tripping, and `siteOf('HOME')` byte-identical to today's singleton.

**GATE PROPS** (exists, unchanged).

---

## 10. STAGING

**S1 — the state moves home.** `flydiy.hangarDims` and `flydiy.hangarParts`
into the player container (§7), agreed with P6. Nothing new is modelled and
nothing on screen changes. Everything below depends on it.

**S2 — kits.** The kit table, the anchor-based placement generalised out of
`placeMobile`, `club` declared as today's shell. Immediately useful: the same
shed, well or badly equipped, and the woodshop can be absent.

**S3 — `works`.** Dims, truss count, an industrial skin map. Cheap, and it is
what proves the shell axis is real rather than a name for one building.

**S4 — `field`.** The timber shell. The expensive one, and the one with the
most character.

**S5 — sites.** `AIRFIELD_SITES`, capabilities on the hangar card, the
aeroplane editor's advisory line. The seed handed to P5 and P6.

S1 and S2 together are a complete chantier and the honest first delivery.

---

## 11. OPEN QUESTIONS

1. **The container** (§7). Does this chantier define it, or does it wait for
   P6 to? Whoever goes first defines it for both, and it should be a decision
   rather than a race. (Recommendation: define it HERE, minimally — `sheds`
   and `wallet` — precisely because it is small enough to get right, and hand
   P6 a shape rather than a blank page.)
2. **`field` first or last?** This spec puts it last on cost. The counter-
   argument is that it is the shell the user named first and the one that makes
   the feature FEEL like something, and shipping `club` + `works` is shipping
   two steel sheds of different sizes.
3. **How many hangars at once?** One per airfield with only HOME granted is
   the simple start. Owning several at HOME (a hangar and a workshop) is a
   different and larger mechanism.
4. **Does the aeroplane's build ledger spend the wallet?** `61_gen_frame.js`
   already prices every build through `bill`/`spend`, and nothing pays. Joining
   those two is a one-line change with a very large gameplay consequence, and
   it belongs to P5 — but the container should be shaped so it is one line.
