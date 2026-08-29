# flyDiy — ROADMAP (2026-08-26, v2: the vertical slice)

This document SUPERSEDES `HANDOVER.md` § ROADMAP (the sessions 1-6 / W-branch
list). That section stays where it is as history — its entries are cited all
over the handover — but the living plan is here. One chantier per session, the
battery green at the end of each, exactly as before; chantiers keep taking G
numbers as they happen and get written up in HANDOVER as always. This file
holds the ORDER and the WHY, not the as-builts.

v2, same day as v1: restructured around the game loop. v1 was a parts
pipeline — eight phases of bench and editor work with the game deferred to
the last three — which left the core hypothesis untested until after
materials. v2 puts the loop's first full turn immediately after wings and
interleaves bench work with loop work from there.

## THE GAME, IN ONE PARAGRAPH (the judging criterion for every phase)

Design your plane, see if it flies. Test it — yourself or automatically —
collect its stats, make some faster, some landing shorter, some carrying
people or heavy cargo. Collect your planes, customize them, get attached to
them, fly missions with them, modify them, build a fleet, and discover the
principles of flight by doing all of it. You are the engineer more than the
pilot: THE AUTOPILOT IS THE PILOT, and hand-flying arrives eventually as an
option, not as a gate.

## THE RULINGS

1. **BENCH UNTIL INTEGRATION.** The cage bench stays the working surface; the
   in-game garage is kept but frozen, and is REBASED at P10 on the bench's
   parameter model. This is the architecture G21 settled: the bridge between
   editors is the SPEC, not the UI — generators are modules, the game
   consumes the same modules. Nothing bench-side is lost; nothing is spent on
   the old panel meanwhile. The vertical slice does not contradict this: the
   harness is headless and the bench already exports the game's own build
   envelope.
2. **THE LOOP IS VALIDATED UGLY.** The slice (P3) exists to test whether
   design → fly → stats → hangar → mission is fun, with zero art budget.
   Every phase after it is judged by what it adds to the loop.
3. **THE PHYSICS-BEARING PARAMETER SET IS DECLARED, NOT DISCOVERED.** A table
   (written in P3, kept in HANDOVER) says which parameters reach physics —
   masses and positions from the dressed parts, areas and arms from the
   outlines, drag increments per feature — and everything else is DECLARED
   cosmetic. A player who finds sliders that move nothing on the plaque loses
   the engineering fantasy; a slider must either move a number or be honest
   set dressing. Corollary: aero is never re-derived from arbitrary mesh —
   that is a tar pit with no floor. Physics deepens by INCREMENTAL JOINS
   (the engine bench deriving mass from geometry is the pattern), never by a
   mesh-aero rewrite.
4. **SAVE COMPATIBILITY IS FOREVER, FROM THE SLICE ONWARD.** Builds become
   collectibles at P3; attachment means a build from a year ago must load
   forever. `GEN_SPEC_V` migration becomes a permanent discipline: every
   version bump ships its migrator, and the battery keeps one old build of
   each vintage as a loading gate.

## WHERE THE BENCH STANDS (2026-08-26)

| Part | Bench | State |
|---|---|---|
| Fuselage cage (template, creases, windows, canopy, interior, crew) | `_cage8.html` lineage (G12-G19) | live |
| Undercarriage | `_gear.html` + cage layer (G20, G21§2) | DONE, integrated |
| Cowl + propeller | `_pwr.html` + `_cage_cowl.js` (G21§4) | DONE, integrated |
| Fin + stabiliser | `_cage7.html` (G22, G23) | DONE, integrated |
| Engine, dressed, all ten registry families + electric | `_engine.html` (G24, G25) | DONE, **not integrated** |
| Rod & pod (taper section, rod boom, tail pod) | G26, `_cage8.html` | IN PROGRESS — rod in, pod remaining |
| Wings | game-side only (`src/core/6x_gen_*`) | not in the bench |
| Fuel / battery / payload systems | — | not started |

## THE PHASES

**P0 — finish what is open.** — DONE 2026-08-26 (G26 rod-and-pod by the
user; the engine into the cage is HANDOVER G29: dressed engine on the
genuine firewall, prop + nose cone re-parented to it, global detail dial
in polycount, no auto cowl fitting).
G26 rod-and-pod to completion. Then the engine into the cage: the cowl layer
consumes the dressed engine mesh instead of the bare `engResolve` envelope
(the fit contract already exists — the cowl wraps `env.hull`), firewall and
mount arteries land on the cage's own frame, and the G24.3 LOD ladder is what
the game will actually load — the hero build stays a bench luxury. Nose-mount
only here; wing mounts and pushers are P7's problem.

**P1 — panel grammar (tranche A of the UI revamp).** — DONE 2026-08-26
(HANDOVER G27, second pass G28: resize handle, chrome consolidated into
the panel, flattened nesting, polycount group, relationship audit
completed, waist-rides-edges + radial explode + flat seals; the gear
bench page and segmented button rows recorded as follow-ups).
The cheap two-thirds of the slider revamp, done BEFORE wings so every page
written afterwards inherits it instead of being retrofitted:
- §1 the control type is a property of the parameter, decided in `mkRow`:
  two-state → checkbox, short name-list → dropdown/segment row, small integer
  span → stepper, everything else a slider with a typeable number and
  double-click reset. G24.8 already made this ruling for the engine page —
  this generalises it to the row helper every bench shares.
- §2 existence is declarative: `when` (the cowl rows already carry it, the
  engine groups carry `show` — unify), `link: 'key'` replacing every −1
  "follows the front" sentinel with a visible checkbox, and
  `level: basic | detail | expert` replacing "don't touch" with a global
  expert switch. The conditionals become one auditable table per page.
- §5's glossary fix rides along: one word per concept (windscreen, width,
  sharpness, roundness), units in metres after `planeScale`, one sign
  convention stated once (+forward, +up, +pilot's left).

**P2 — wings into the bench.** — STARTED 2026-08-26 (G30: the game wing
verbatim on the cage, binding-filtered extraction, deck/keel anchoring,
"6 · wings" panel; the rework arc — cage-style outline/creases, struts on
the cage, structure display — continues with the user).
Import the game's wing generator (`6x_gen_*`) as modules — the G21 move,
again — and rework outline, tips, crank, sweep and creases in the cage style,
against the live fuselage the way the fin was built against the live deck.
The physics contract (`62_gen_aero`) does not move. STOL is NOT implemented
here, but the geometry RESERVES it: hinge lines, aft-spar nodes and slat/flap
station allowances exist from the first build, so P12 adds surfaces without
rebuilding the wing.

**P3 — THE VERTICAL SLICE (the hinge).** — STARTED 2026-08-28 (G35: the
cage editor EMBEDS in the game and replaces the old garage panel — the
P10 "garage rebased" move pulled forward by the user; the old game is
archived whole as earlierVersions/2026-08-28-preP3-last-old-garage.html;
the hangar room carried over as the editor's backdrop, matured G40-44
into the part-system material library + real lighting).
THE JOIN LANDED same day (G45): the declared physics-bearing table is
in HANDOVER (ruling 3, written before the button), _cage_join.js maps
it, `build & fly` runs export → GARAGE_SPEC.set → the stand, and the
FIRST FULL DESIGN→FLY TURN is verified — an editor-set 912 + 11.6 m
wing flew ROLL→LIFT-OFF→CLIMB on the AP. REMAINING in P3: the TEST
FLIGHT button + THE PLAQUE (headless SHAKEDOWN from the editor),
save-to-hangar naming + logbook stub, the ONE MISSION.
The first full turn of the loop, ugly by design. Almost everything it needs
already exists — GATE GEN flies a generated aeroplane headless around a full
circuit and prints its stats (the SHAKEDOWN line: Vs, VCruise, L/D, wing
loading, static margin, TO run), the hangar exists (G6), saving a build
exists (G7), the aerodrome registry and multi-leg AP routes exist (W10/W11/
W14). The slice wires them into one player-facing turn:
- **The physics-bearing parameter set, declared** (ruling 3's table) — the
  minimal spec→physics join for a bench build: engine mass/position from the
  registry + dressed envelope, gear from its layer, crew, cage-derived mass
  and CG contributions, wing from P2. Written down BEFORE the button, so the
  plaque's numbers are known to respond to known knobs.
- **TEST FLIGHT**: one button on the bench build. Export the spec, fly the
  harness circuit, return the PLAQUE — the stat card. Whether the button
  shells to node (the bench's verdict pattern) or steps the sim in-page (the
  game already runs the same sim in the browser) is the chantier's first
  decision; neither needs the game shell.
- **THE PLAQUE**: the SHAKEDOWN numbers plus landing run, formatted as the
  thing you get attached to. It is the game's unit of pride.
- **SAVE TO HANGAR**: name it, keep the plaque and a logbook stub with it.
- **ONE MISSION**: a cargo contract from HOME to one existing aerodrome,
  flown by the AP end-to-end (watch it, or skip to the outcome — both must
  exist, because "skip" is what fleet play will actually use). Outcome to
  the logbook.
What the slice is NOT: no economy, no art pass, no game shell, no manual
flying, no balancing. It exists to answer two questions — is the loop fun,
and which numbers must the plaque show — before polish is spent anywhere.

**P4 — energy & payload (the plaque grows range and load).**
The old "energy module" rider, PROMOTED — missions make it load-bearing.
Tanks and battery packs as volume + mass + CG (bench geometry, gameplay
numbers); fuel burn and pack discharge in the solver (contact arrays
refreshed ~1 Hz, not per-substep, per the old rider's note); cargo and
passengers as stationed MASS, not just cabin geometry. Range, payload,
endurance and cruise-at-weight join the plaque — the numbers "carries a lot"
and "flies far" are made of. The fuel-system DRESS (lines, gascolator,
plumbing at engine-bench finish) is explicitly deferred cosmetics — it rides
with F2 or a later dress pass.

**P5 — missions & economy v0.**
Contracts generated over the aerodrome registry: cargo demand, passengers
who want to go somewhere, payment in the credits the registry already prices
engines in. Accept → the AP flies it → outcome, wear and earnings to the
logbook. Design note written here: THE WORLD IS THE MISSION BOARD —
destinations need reasons (what does Morford want, what does Stein sell),
even if v0 hardcodes them. Materials economy (the old garage-arc G4 half
that never landed) starts here: parts cost credits, missions fund parts.

**P6 — fleet & discovery.**
The attachment systems. Fleet: the hangar as a collection — rows of named
aeroplanes with plaques, logbooks, hours, wear; the found aircraft (PA-18,
C172) as measuring sticks in the same rack, exactly the role the 2026-08-08
scope decision gave them; F1 imports join the rack as references. Discovery:
the teaching instrument, v1 — a post-flight WHY report built from the checks
and traces the project already computes (CG angle, nose load, static margin,
the AP's own telemetry): why it porpoised, why it would not rotate, why it
dropped a wing. The envelope card (Vs to Vne, the corners flown by the
harness) joins the plaque. Half the fantasy is discovering principles; this
is where the game starts explaining instead of just failing.

**P7 — powerplant plurality.**
Multiple engines (wing nacelles — physics has counted engines honestly since
G4.9; this unlocks the heavy-cargo mission tier), no engine (glider noses —
winch/aerotow stay in the far backlog), pushers (the Chinook has always been
one in physics; the bench needs the pusher cowl and mount). Judged by the
loop: each configuration must earn mission types or plaque numbers, not just
exist.

**P8 — the editor experience (tranche B of the UI revamp).**
The structural half, designed AFTER the loop is live because the loop is
what it serves — the badges ARE stat feedback now, not tool decoration:
- §3 configure THEN shape: a first screen of ~eight discriminators, each
  writing derived values once and deciding which parts exist. DECIDED HERE:
  the tension between auto-derived correctness and the discovery fantasy —
  derivation framed as the engineer's handbook (guidance you can ignore),
  never as guardrails that prevent building a bad aeroplane. Building it
  wrong and learning why is content, not error.
- §4 a part tree + inspector replaces the flat slider tree; selection tints
  geometry (SEC groups), viewport clicks select parts (raycast on material
  groups); the tree's nesting replaces the "3b/4b/4c" suffixes.
- §5 every part opens with the same placement strip: fore/aft, up/down,
  length, width — same order, labels, signs.
- §6 game feel: hover-tints, changed-from-preset dots with per-row/per-part
  reset, drag ghosts, undo/redo, A/B snapshots, checks as green/amber/red
  badges on the tree, randomise-within-envelope per part.
- §7 parent-child as DATA: children reference named parent anchors (deck
  line, keel, firewall face, tailpost), placement params are offsets, `link`
  is the general mechanism — the mirrored pod becomes an instance with
  per-param links instead of 22 duplicated rows.

**P9 — materials & mapping.**
Parameter-space UVs (the C4 item, still open), PBR materials per part,
liveries and registration decals (G4.5's decals are the seed). Liveries are
an ATTACHMENT system as much as an art one — your plane, your colours — and
land after P8 because materials hang off the final part model.

**P10 — into the game shell.**
- The garage rebased on the bench modules and the P8 part tree; the spec
  round-trips already (`GEN_SPEC_V5`, G21§1).
- Boot & packaging: per-model payload splitting (the SKIN-PROC §6 open
  item), deferred model decode, a build step baking `src/` into one file —
  the bench pages prove the single-file boot; this dissolves the loading and
  server-mount complaints.
- Physics deepening, by ruling 3's increments: per-feature drag (spats
  already flagged in `62_gen_aero`), cooling drag, body lift where the
  ledger earns it — never a mesh-aero rewrite.
- The deform-and-break plan: WRITTEN as a design doc first (it does not
  exist on paper), then built. Its game role is named now: breaking is
  content — test-to-destruction in the bench, damage and repairs in the
  logbook, scars as attachment.
- The fixed-step accumulator (the timestep HONEST CUT: the sim currently
  runs at the display's refresh rate) — feel work starts here, and
  slow-motion-reads-as-rubber must die first.
- Manual controls (old session 4) — the OPTION the vision always said it
  was, not a gate anything waited on. reEngage and holdWas landed in W14;
  what remains is input UI and its gate.

**P11 — the world glow-up.**
Aeroplanes of P9 fidelity cannot land in the current world. Two halves:
- RENDERING, the overhaul backlog by name: chunked terrain LOD (far
  cliffs), contour-traced lakes, animated water shader, triplanar splat,
  per-surface detail + near-field clutter (W15 b+c), ultra-inner aerodrome
  bakes (W15 d), sky/lighting to match the PBR skins. The world DATA
  pipeline (stages 0-5) is complete and untouched.
- THE MISSION BOARD MATURES: P5's hardcoded demand becomes worldgen —
  settlements produce and want things, strips have character, distance and
  terrain price the contracts. The world stops being scenery.

**P12 — validation against reality.**
Build two or three real aircraft against reference models (F1), benchmark
against published numbers — the DIVERGENCE LEDGER machinery is exactly this
— and tweak the physical model where the ledger says so. STOL goes LIVE on
the P2 reservations (flaps/slats/VGs with physics to measure them). Far
backlog behind it: STOL competition mode, the jet module + SubSonex, the
gliders' atmosphere (thermals/ridge — the wind(x,y,z,t) plumbing is where
they plug in).

## FLOATING CHANTIERS (pull forward at will)

**F1 — the reference overlay.** 3D model import instead of blueprints: a GLB
as a ghost in the bench, scale/align, match by eye. The in-repo Cub and C172
are free; more from the same modeller as they come. Display-only, r128 loads
GLBs, deliberately small. Pull it forward the moment matching a real
aeroplane would help — wings (P2) is the likely moment. Blueprints only if a
wanted aeroplane has no model. Imports also join the P6 rack as found
aircraft.

**F2 — naked structures.** Door removal and the tube structure dressed to
hero level for the open-frame class (Top Rudder / Ruckus): the truss stops
being interior and becomes the visible airframe — gussets, fittings, bolted
clusters at the engine-bench finish. G13's I-series is the foundation.
Aesthetic content with no loop dependency, so it floats; the deferred
fuel-plumbing dress from P4 can ride with it.

**F3 — the prop library and the asset editor.** LANDED in part, 2026-08-28
(HANDOVER G50): 29 downloaded objects are a declared table, a baker, group
packs, one material factory, GATE PROPS and a bench (`tools/_props.html`).
A second batch (G51) took it to 40 props and DID the hangar swap: the drawn
bench/pegboard/shelving/toolChest/drum/tyreStack/bottleRack/stepladder/
partsTrolley are deleted and the room is furnished from the library. What
remains is the asset editor proper, growing out of that bench — it already
lists, groups and reports facts from PROP_REG, so what is missing is the
working surface, not the data. Floating because it is set dressing: it makes
the shed a place, and it moves no number on the plaque.

**F4 — the day cycle.** LANDED in part, 2026-08-29 (HANDOVER G62): the
hangar's moods are five HDRI skies (the alps field plus the Kloppenheim
noon / covered / sunset / night series), each carrying a light rig
MEASURED off its own HDR — sun direction and colour, how directional the
sky is, sky and ground colour — with one authored `level` per row for the
day cycle, because Poly Haven's HDRIs are not calibrated to a common
absolute scale. `tools/sky_prep.py` is where that line between measured
and authored lives.

What remains is the cycle itself and the WORLD's half of it. The room is
lit by a time of day; the sim's own scenery is not, so flying out of a
sunset hangar still arrives in the world's fixed daylight. That is the
P11 consistency goal seen from the other end (recorded at G41: "the
honest destination is the GAME's own scenery seen from the hangar"), and
the two should be one clock. Also open: the procedural grass and strip
outside the door are lit by the room's lights rather than by the sky's own
ground, and a mission that names a time of day has nothing to set.

## SEQUENCING RATIONALE

- **Why the slice sits at P3 and not later:** it is the earliest HONEST
  point — it needs wings (P2) and the declared join, and nothing else it
  needs is new (harness circuit + SHAKEDOWN, hangar, saves, aerodromes, AP
  routes all exist). Every phase before it in v1's order — editor tranche B,
  materials, packaging — was polish on an unvalidated loop.
- **Why bench and loop interleave after P3 instead of bench-then-game:**
  each bench phase is judged by what it adds to the loop (ruling 2), and the
  loop phases feed the bench phases — P8's badges are designed against P3's
  plaque, P9's liveries against P6's fleet.
- **Slider revamp split (unchanged from v1):** tranche A (P1) is
  one-function-deep and every later page inherits it; tranche B (P8) must
  see all the parts AND the live loop to be designed once.
- **Cage vs in-game editor (unchanged):** the bench is the editor; the
  garage is replaced-in-place at P10 by the same part tree over the same
  spec.
- **Manual controls demoted on purpose:** the vision says the autopilot is
  the pilot. The AP-flown mission game needs zero new flying tech — that is
  what makes P3-P5 cheap — and hand-flying is a P10 option.
- **Physics-from-mesh refused (ruling 3):** the loop needs physics that
  responds CONSISTENTLY to design choices, not physics derived from
  arbitrary mesh. Incremental joins, declared boundary, no tar pit.

## WHAT THE OLD ROADMAP'S LIVE ITEMS BECAME

| Old item | Where it lives now |
|---|---|
| Session 4 — manual controls | P10 option (holdWas/reEngage prerequisites DONE in W14) |
| Session 5 — STOL competition | P12 far backlog (STOL surfaces: reserved P2, live P12) |
| Session 6 — jet module + SubSonex | P12 far backlog |
| Rider — energy module (fuel burn, packs) | P4, PROMOTED to load-bearing |
| Rider — gliders | noses P7, atmosphere P12 far backlog |
| Old garage arc G4 — save/persistence + materials economy | saves landed as G7; the economy is P5 |
| Old garage arc G5 — missions over the 24 km world | P5 (v0) + P11 (mission board matures) |
| Renderer-overhaul backlog (W15/W17 notes) | P11 |
| SKIN-PROC §6 per-model payload splitting | P10 boot & packaging |
| Timestep-is-not-wall-clock (HONEST CUTS) | P10 |
| POST-G6 spats drag accounting (`62_gen_aero`) | P3's physics-bearing table names it; P10 implements the increment |
