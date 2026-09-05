# flyDiy — ROADMAP (v3 2026-09-01: the player's reorder · v2 2026-08-26: the vertical slice)

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

---

# THE PLAN (v3 — 2026-09-01)

> **2026-09-05 (G184).** The hand-written fleet is RETIRED — every vessel is a
> garage build, the fiches and their gates are gone, the PA-18 and C172 are
> reference planes. The bench-page audit in Phase 1 §8 is ruled: `_cage2..7`,
> `_lean`, `_pwr`, `loft_fit`, `_spat_norm`, `obj_sanitize` deleted; `_cage8`,
> `_engine`, `_gear`, `_terrain`, `_props` stay. Raw external assets are
> gitignored (media/ is the shipped store). Wherever a phase below says
> "fleet" it means the player's rack of garage builds, never the fiches.

> **2026-09-05 (G188).** The join's measurements now REACH the frame on every
> build: the third wheel is classified by station identity (not lateral
> offset), a mirrored pod publishes its aft pillar and takes its post off the
> skin, the nose engine and the wing's height are measured, and resolveSpec's
> clamps and the 0.9-chord tail-arm floor no longer override a measured
> station. Owed there: the merge's "last good number" hazard for any
> measurement not on the ERRS list (HANDOVER G188).

The loop is live end to end: design → certify on the bench tab → roll out →
AP circuit or leg → arrival card → logbook write. So the plan stops being
sequenced by architecture and is sequenced by play. The judging criterion for
everything below, in the user's words:

> "I want to build lots of small planes, test them, do some little airports,
> reach them and watch the autopilot struggle or not."

**HOW TO READ THIS.** Eight phases, in the order I suggest tackling them.
Items inside a phase are ordered too, but a phase is done when its items are —
not in lockstep. **Everything the project owes is in a phase below**: the old
P-phases, the debt register, WORLD-V2's W-stages, and the user's own idea
list. If it is not below, it is not planned. Sizes are S (a few hours, several
fit in a session), M (one chantier), L (its own arc, opened with a design
conversation). The old P/W/G numbers stay in brackets so every item is
traceable to the record below and to `futureDesigns/`.

**THREE SCOPE RULINGS** that shape the order. The GAME aspect — economy,
progression, missions-as-pressure — is deprioritised on the user's own call
("I don't care so much about the game aspect at this stage"), so the old P5
economy is Phase 8 and the one mission is flavour, not pressure. MANUAL
CONTROLS, joystick and TrackIR stay an OPTION, pulled when the user asks
("you're the engineer, not the pilot" is the current fun, and it holds).
And the ONE EDITOR ruling (§ THE RULINGS, below the plan) governs everything:
no item may deliver a control that lives only on a bench page.

**TWO THINGS THAT ARE NOT PHASES**, because they ride along with whatever
chantier touches them:

- **STANDING DEBT.** `futureDesigns/DEBT-REGISTER-2026-09-01.md` holds every
  open item from HANDOVER, deduplicated, with the paid ones verified and
  struck. The ones that must be TAKEN WITH a specific chantier are named in
  the phases below; the rest are picked up by whoever is next in that file.
- **THE PLAYTEST CYCLE.** Play → a numbered review → the review becomes
  chantiers. It is the proven engine here: the 21-item review became G108-G118
  and the 20-item batch became G112-G119, both landed whole. Open each stretch
  with a playtest, and let it REORDER what follows. This plan is a proposal,
  not a queue that outranks what the aeroplane in front of you is doing.

---

## PHASE 1 — THE FRICTION PASS
*Make what already exists feel finished. Everything here is visible in the
first ten minutes of play, and almost all of it is small.*

1. ~~**The sweep-30 ruling, applied.**~~ **DONE — G150, 2026-09-01.** The one
   red in the battery, ruled and closed. It was a TIMEOUT, not a crash. Leaves
   ONE item owed, promoted into Phase 2 below: the **balance advisory**.
2. ~~**The roll-out spot.**~~ **DONE — G151, 2026-09-01.** The aeroplane is
   wheeled out now: it starts on the declared stand and TAXIS to the
   centreline through the fence gate, under both pilots, reaching the take-off
   roll in 91 s where the first attempt took 324 s. `HOME.spawn` never moved —
   the taxi ends on it — so every take-off measurement in the battery is
   unchanged. GATE SITE +11 checks, 8 negative trials, 8 caught.
   LEFT OWED, measured not excused: **the taxi governor is thrust-limited**
   (~1.4 m/s where a real taxi is 4-5), because `taxiFF` derives break-even as
   `CRR*m*g/T0` and thrust is not linear in throttle. Pre-existing — XCTY5's
   backtrack crawls the same way behind a 1500 s budget. Raising the cap moves
   every taxi in the battery, so it is a controller decision to take WITH the
   fleet watching. In the register.
3. ~~**The logbook reads back.**~~ **DONE — G152, 2026-09-01, and this item
   was HALF STALE.** The read-back itself landed at **G130**: `renderLog()`
   has been drawing built date, flight count and the last six flights in the
   information panel all along, and this roadmap went on saying "nothing shows
   it". What was genuinely missing was the CLOCK — the rows carried no time, so
   the logbook could count flights and could never total anything. Flights now
   record `t` (the flight's own clock, taxi included), `on` (the date) and
   `run` (the landing run, when the pilot measured one — present or absent,
   never faked), and hours accrue in the panel (`3 flights · 0.25 h`) and on
   the fleet rack. GATE BUILD +8, negative-verified 5/5 against the real
   source. No version bump (the G105 ruling again).
   **THE LESSON, and it is now twice in two days:** read the code before
   believing a document that says something is missing — including this one.
   G47.2's prop spin was the same kind of stale.
4. ~~**Diagnostic colours off the finished aeroplane.**~~ **STALE — already
   fixed.** The wingtip/aileron leak died at **G109** (per-part rows answered
   it) and the GEN_ACCESS fittings have routed through `CAGE_SECMAT` /
   `aeroHardMat` since **G111**; the Lambert palette that looked like a
   diagnostic is a bench-only fallback. Verified in the code, G153.
5. ~~**The styling sweep.**~~ **DONE — G153**, and half of it was stale too:
   the 15 colour wells were covered by G112's `:is(#wsUI, #edView) .r` rescope.
   What was genuinely missing was **`#edView`** — the icon rail, its flyouts,
   the camera pills and the two verbs float over the render rather than inside
   `#edWrap`, so no focus rule reached them, and the reduced-motion rule had
   the container but not its children. Both closed; flight.css already did the
   same for `#ui`, so the two stylesheets now agree.
6. **Small honesty fixes** — one of three was real.
   - ~~a floor on the glass factor (G129)~~ **STALE**: the glass exemption was
     deleted when transmission was measured out; glass scales with the mood
     like every other material.
   - **The reference panel's loading affordance** — **DONE, G153.** It said
     `No reference standing.` while the bytes were in the air, which is a
     statement about the aeroplane, not the panel. It now names what it is
     loading, and gives a failed fetch its own words.
   - **The DESIGN tab's inert pills** — **DONE, G153.** `.fin` hid them for
     FINISH; DESIGN set no class, so both stood there inert.
7. ~~**Latent guards.**~~ **DONE — G153.** `iStrut`'s `Math.max(0, -1)` turned
   "crank not found" into station 0, the CENTRELINE — it would have rooted both
   lift struts at the fuselage and drawn a plausible aeroplane with its bracing
   attached to nothing. Falls back to the uncranked rule now. Dead `APRON`
   deleted: zero readers, and since G151 it also carried a stale stand pose
   beside the live one.
8. **The bench-page audit** — **DONE as an audit, G153; NOTHING DELETED.**
   Of the seventeen: `_probe` / `_probe_base` / `_lean` are LIVE TOOLING, not
   benches (the capture rig is GATE LIGHT's own path); `_cage8` is cited by
   `build.js` as the authority for `MANIFEST.editor`'s script list AND its
   order; six have a live `.js` partner; five are cited only by HANDOVER; and
   **`_cage6.html` and `_loft.html` are referenced by nothing at all.**
   Those two are the only clear candidates. **Left in place on purpose:** a
   grep finds what references a page, not a page you open by hand, and
   `_loft.html` is the largest of them. They are tracked, so retiring them
   later costs nothing. **Your call.**

## PHASE 2 — THE CATALOGUE, BREADTH
*"Build lots of small planes." The amateur range, filled. Every item is small
or medium, and each one directly multiplies what you can build tonight.*

1. ~~**The cowl follows the engine.**~~ **DONE — G154, 2026-09-02.** A radial
   now gets a round open cowl CALIBRATED to it (from `env.radius`, which the
   engine generator publishes as "what a cowl actually needs"); boxer, inline
   and electric keep today's default, and that is written into the table as a
   `null` so it reads as a decision. Fires as a starter on an architecture
   change, overridable after. **The registry's `family` was the wrong key** —
   it is thermodynamic, so the R-1830 radial is `family: 'four'` exactly like
   an O-200 boxer; the engine bench's own `arch` was the right one and already
   existed. **The CUT-OUT needed nothing** — `cw_cutSpan` / `cw_cutAz` have
   been live editor rows all along. GATE COWL +18, and it caught a 4 mm
   clearance bug caused by rounding the taper to nearest instead of up.
   OWED, an honest limit: the taper caps at 1.15, so a big radial on a slim
   fuselage cannot be enclosed and is REPORTED rather than drawn through. A
   cowl carrying its own aft diameter and fairing back is its own chantier.
2. **Amateur-range engine fill** — **G157 + G163, 2026-09-02/03.**
   THE RADIALS ARE IN: **Verner Scarlett 7U** (7-cyl, 78 kW) and **Rotec
   R3600** (9-cyl, 112 kW), with the real displacements and the R-1830's own
   radial treatment. The registry used to jump from a 100 hp flat four to a
   1200 hp Twin Wasp, so the only round engine in the game was a DC-3's; these
   are the ones G154's radial cowl was built for.
   **THE IN-LINE ENGINE STANDS UP — G163, 2026-09-03.** It was drawn with its
   cylinders out to starboard while the envelope the COWL is built around
   described a tall narrow engine (drawn 0.279 × 0.109 against 0.139 × 0.386);
   it is 0.110 × 0.230 now, and the flat control did not move. The hardcode
   lived TWICE — `_eng_mesh_check.js` carried its own copy, so correcting the
   drawing made the gate test every lead against a capsule lying on its side.
   Both are gone; both sides read `place.ang`. The eleven arteries did not
   need re-routing after all: they were already written in the cylinder's own
   frame, silently, and writing that frame down (`route(out, across, along)`)
   was the whole of it — across nineteen engine fixtures only the two in-line
   rows changed a single vertex. What DID need moving was the CASE FURNITURE:
   the oil filler, the coolant pump boss and the whole radiator sat on the
   case's +y face, which is free air on a boxer and is where an upright
   in-line's barrels stand. GATE ENGMESH gains **the drawn engine must stand
   the way its envelope says** — the check whose absence let this run a
   fortnight, because `_eng_check` and GATE COWL both read the envelope.
   **THE ORIENTATION ROW LANDED — G164, 2026-09-03.** `cylinders point`:
   down (inverted) / up / left / right, in the bench and the game editor and
   saved with the build. G163 said it was a table row and it was — `engResolve`
   measures the ENVELOPE off those angles, so an in-line aimed left publishes
   0.348 × 0.177 where an upright one publishes 0.139 × 0.386 and the cowl
   follows without being told; and ONE entry in `_eng_page.js` gave the bench
   row, the editor row, the spec key and the default, because `_cage_eng.js`
   renders the same list `engSpecOfP` walks. The exhaust outlet's four
   directions and the bank's are ONE table now (`ENG_AIM`), and the panel
   generates both drop lists from it. Three of the four aims were free; DOWN
   was not, and what it found is an aeroplane fact — the sump, carburettor and
   airbox hang from the one face of the crankcase an inverted bank occupies,
   which is why a Gipsy Major carries its induction on top. GATE ENGMESH gains
   three FIXTURES rather than three checks, so the whole battery runs on each;
   8/8 negative probes caught.
   **AND THE SMALL IN-LINES LANDED — G165, the last of this item.** A second
   wall was behind the first: EVERY in-line was a two-stroke BY LAW, which was
   reasonable while the only ones were a Rotax 277 and a 582 but excludes the
   engines the range actually wants — a Walter Mikron, a Gipsy Major, a Renault
   4Pei are all INVERTED FOUR-STROKE in-lines, the aeroplane G164 down aim
   exists for. It is a DEFAULT now, so all thirty pre-existing engine fixtures
   come out identical to the vertex. Four things had never been asked to fit
   round an upright bank and each was found by putting a Mikron in the battery:
   the plugs stood across the WORLD rather than across the cylinder, a single
   bank induction runner has to come round the barrel (its bank stands at right
   angles to its induction face, where a boxer does not), and an expansion
   chamber turned out to be a TWO-STROKE exhaust rather than an in-line one.
   **THE ROW IS NO LONGER A GUESS**: kM was UNVALIDATED because there was no
   registry example, and there was none because of the law — fitted now on two
   published engines, 1.06 -> 1.02, residuals -8% / +9% on mass and under 5% on
   power, DECLARED and held by a check. The two props are genPropSynth output,
   verified by reproducing the Jabiru row exactly first. 8/8 probes caught.
   **PHASE 2 ITEM 2 IS DONE.**
3. **Exhaust, properly** — **THE OUTLET LANDED as G155, 2026-09-02.** The
   routed pipes, the stacks, the radial ring and the per-bank collectors all
   already existed; what did not was any say over where the pipe ENDS. Five
   rows now: `exOut` (one can per bank or one that both feed), `exAim`
   (down/up/left/right) and `exOutX/Y/Z` on all three axes. The defaults draw
   the previous pipe exactly, which is why every engine in GATE ENGMESH comes
   out at its old vertex counts. The outlet is PUBLISHED as
   `ports.exhaustOut` — G70's soot streak has wanted that point since it was
   written and only ever had the head ports.
   **THE COWL CUT IS NOT ATTEMPTED**, on the user's own condition ("only if we
   are sure we can manage to do that properly"): it is a boolean against a
   swept tube on an analytic lofted surface, and this generator has no
   machinery for it. The pipe leaves below or behind the cowl lip instead.
   STILL OWED from this item: a SILENCER, and whether any of it earns a
   declared drag row (ruling 3 — honest set dressing is allowed, a fake number
   is not).
4. **Registration on the wing** [S]. The plan-mode projector already exists
   (G113), so this is placement, not plumbing. Take the registration-ink row
   (G113.1) with it.
5. ~~**Recent colours remembered** in the livery editor.~~ **DONE — G156,
   2026-09-02.** One strip for all forty wells, not one per row. **It opens on
   HOVER, and that is forced rather than chosen**: a colour input opens the OS
   picker on the CLICK, so a strip shown on focus is drawn under a modal
   dialog exactly when it is wanted. Its own localStorage key — which colours
   you reached for last is the person's, not the aeroplane's, and must never
   ride a saved build. Verified live in the page, because no gate can
   exercise a hover.
6. ~~**Engine braces pickable.**~~ **DONE — G156.** `engMount` is a livery
   section on the eng layer. **Not a fourth castings group**: the hardware
   table already calls it "a painted steel engine mount", so it bottoms out on
   `trim` and follows the BODY — a mount is painted to match the aeroplane it
   is bolted to, and putting it under `engBlock` would let a painted crankcase
   drag the airframe's mount with it. The rubber pucks stay rubber (G104's
   rule). GATE SKINMAT holds the section, its finish, its parent, and the
   hardware fact it was written against.
7. ~~**The decal kit.**~~ **DONE — G162, 2026-09-03.** Five patterns —
   cheat line, twin stripe, sweep, flash, chequer — over three independent
   layers, each with its own colours, two shape knobs, opacity and placement.
   **A PATTERN IS A RECIPE, NOT PIXELS**, which is why unlike the two image
   channels it fits in `spec.finish.decals`, travels with the build and is
   redrawn on the flight side — verified by rolling one out and photographing
   it on the apron. Nothing new underneath: no shader branch, no second
   geometry; `AERO_MAXD` went 4 to 6 and `uDecC.w` (documented "unused") is
   now the per-decal mirror flag. **TWO DEFECTS ONLY A PICTURE FOUND** — a
   layer opened in a frame its own default numbers were not written in (the
   same 2.2 lands 4.85 m aft in the box projection, off the back of a light
   aeroplane), and a livery run through the registration's far-flank mirror
   rose AFT on one side of the aeroplane and FORE on the other. GATE SKINMAT
   +35 check sites, 22/22 negative probes caught.
   STILL OWED: **the both-sides-or-neither debt (G69)** — the roadmap asked
   for it here and the kit did not need it, because a livery IS symmetric; an
   asymmetric marking still wants a one-sided mask the surface field cannot
   supply. And a sweep stops at its own rectangle, so that bottom edge is a
   hard line — give the layer depth enough to swallow the belly.
8. **The travel pod** [M]. A belly/baggage pod as a real solid with honest
   mass, GEN_ACCESS-style.
9. **Wilga-type suspension** [M]. A leg family on G148's drawn-place + delta
   contract. Its natural co-chantier is the per-member two-end leg weights
   G148 left owed.
10. **The balance advisory** [M, owed by G150's ruling]. The engineer's
   handbook, first instance: when a design choice walks the neutral point away
   from the CG — a swept tip is the measured case, 0.62 m → 2.52 m with
   nothing following it — the editor SAYS so and suggests the wing station
   that fixes it. **Guidance you may ignore, never a guardrail** (P8 §3's own
   ruling: building it wrong and learning why is content). This is what makes
   G150's "it is a bad aeroplane" true in words and not only in the plaque's
   numbers, and the same machinery serves every later configuration in
   Phase 6 — a V-tail and a biplane both move the balance.

## PHASE 3 — THE GROUND LOOKS REAL
*Three chantiers, and the first is the largest single visible improvement
available anywhere in the project. All on today's 24 km world — no new data,
no size change, no contract change.*

1. **W1 — the splat terrain material** [M]. Replaces altitude-banded vertex
   colour (a coloured paste) with tiling PBR materials selected per fragment,
   triplanar on steep ground. **The ten CC0 scans are already shipped** in
   `site_tex.js` and the weights are already computed (the SURFACE classifier
   + the biome stage). Depends on nothing.
2. **W3 — tree source geometry** [M]. Today: a cylinder, a cone and an
   icosahedron. The impostor ladder, chunking, species and tinting all stay —
   the atlas is baked at boot FROM the near geometry, so replacing the source
   upgrades every tier at once. Taken before W2 because it is cheaper and more
   visible on the world we are actually flying.
3. **W2 — the clipmap** [L]. Replaces the two-ring mesh; removes the ring
   seam, the ~100 m far strips and the 5 km fog cap in one move, and is what
   makes metre-scale ground under the wheels possible at all.

## PHASE 4 — LITTLE AIRPORTS
*The user's named joy: "in FS, I designed hundreds of little airports, but
here they get to be in the official game." This is WORLD-V2 §9, pulled far
forward from its W7 slot, because it is playable content and its foundation
is already sitting hardcoded in the physics hot path.*

1. **The modifier layer** [M]. Generalise the two hardcoded rectangles inside
   `h0` into §9.2's typed list — flatten / grade / surface / exclude first.
   The spec's own words: this is "simultaneously the editor's foundation and
   half of the world's quality". It is also the move `25_airfield.js` already
   made once, for the same reason.
2. **The strip is a profile, not a rectangle** [M]. Centreline (bush strips
   CURVE), width that may vary, longitudinal slope, crossfall, surface →
   the friction row that `GROUND_SURF` already holds. **The one-way sloping
   strip** — land uphill, take off downhill — falls out for free, and is a
   signature bush mechanic.
3. **The airfield editor v0** [L]. In the game, on the modifier format. Place
   and edit a strip. Designed against §9.5's two constraints: it may only ever
   write modifier records (an editor that MUTATES terrain breaks GATE WORLD
   silently), and physics and renderer must agree in the same frame.
4. **The base aerodrome, rebuilt through the new layer** [M]. Its own proof,
   and it retires the last hand-written numbers.
5. **Sites become destinations** [S]. The `AIRFIELD_SITES` null meadow slots
   (G128) are the granting hook.

**THE HONEST COST, stated up front:** airports authored on today's 24 km world
DO NOT SURVIVE the island — the coordinates die at Phase 7's W5. The FORMAT,
the editor and the practice all survive. Build practice airports on the
3b. **The pattern editor** [M]. G193 (2026-09-05) declared the GROUND PATTERN
   per aerodrome — the taxi graph with its filleted corners and hold points,
   the two approaches with their touchdown targets and slopes — as data
   (`sitePattern` builds it from the datums, an authored `site.pattern` is
   taken verbatim, `sitePatternIssues` validates either) and drew it in
   flight (the rail's `patterns` flyout). What is owed is the hand: drag a
   node, add a hold, set a slope, save it into the site — the same modifier
   format as 3, written against the same validator, so a pattern a player
   draws is refused the moment it crosses the fence.
practice world knowingly, or wait for Phase 7 and lose the play in between.
My recommendation is to build them now: the editor is the durable artefact.

## PHASE 5 — REACH THEM, AND WATCH
*"Reach them and watch the autopilot struggle or not." The flying half. The
machinery mostly exists — departure/destination selects, multi-leg chaining
(W14), arrival cards for both pilots (G107.2).*

1. **Destinations worth the leg** [S, then free]. The world has exactly FOUR
   today (HOME + three meadows). Every strip Phase 4 births lands here.
2. **Fuel burn and pack discharge** [M-L, P4's declared remainder]. The one
   thing the arrival card cannot say: there is no `fuel used` row because
   nothing burns fuel (`mFuel` is a mass, not a rate). Contact arrays refresh
   ~1 Hz, not per substep. Range, endurance and cruise-at-weight join the
   plaque with it.
3. **Vne and a sink-rate limit** [M, G141]. Declared nowhere, so only the
   stall colours a readout today. The two PFD warns were left OWED rather
   than faked; this is where they are paid.
4. **The WHY report** [M, old P6]. Post-flight: why it porpoised, why it would
   not rotate, why it dropped a wing — built from checks the project already
   computes (CG angle, nose load, static margin, the AP's own telemetry). The
   arrival card is the natural surface and the test pilot's verdicts are
   already the raw material.
5. **The seat you MOVE is the seat that is BILLED** [M, G119]. `seatX/Y/Pitch`
   reach the crew layer and stop, so sliding a seat aft changes the drawing
   and not the balance. Fixing it re-baselines the fourteen ENERGYBASE
   aeroplanes — which is exactly why it belongs beside item 2, whose mass work
   re-baselines them anyway. Do both once.
6. **The ONE MISSION** [M, P3's last named item]. A cargo contract HOME → an
   existing aerodrome, AP end to end, watch it or skip to the outcome (both,
   because skip is what fleet play will use), outcome to the logbook.

## PHASE 6 — THE CATALOGUE, CONFIGURATIONS
*The shapes that need a design conversation before a line is written. Each is
its own arc; none is a side effect of another. Ordered by ratio of new
aeroplanes to risk.*

1. **V-tail** [L] — **LANDED as G173** (2026-09-04): `stCant` + `stMount`,
   the join writes `tail.type v` from the cant, ruddervators through the
   codec's second drive. Was: the physics half exists — settable Sv/Sh since G115, and
   the microsurface already resolves canted panels without knowing V-tails
   exist. Geometry and join are the arc. Its opening gate is the synthetic
   canted-panel probe G113.3 owed and never wrote.
2. **Double boom** [M-L]. The rod exists (G26); twin booms carrying a shared
   tail.
3. **Elliptic wing** [M-L]. An outline family decided against the
   three-station architecture G140 just landed — more stations versus an
   analytic outline is the chantier's first decision, and it is taken with the
   wing's owner.
4. **Retractable gear** [L]. G148's rigging contract is the enabler and drag
   is already delta-from-reference (G115), so this is a drag delta + a motion
   law + editor rows rather than new physics.
5. **Wing-mounted engines and multiengine** [L, old P7] — **LANDED as G174**
   (a tractor pair on the wing; engine-out / Vmc still nobody's number).
   Was: physics has counted
   engines honestly since G4.9. Unlocks the twin references (P.68) as mimicry
   targets and the heavy-cargo tier later.
6. **Pushers** [M-L, old P7] — **LANDED as G174** (the aft bulkhead on a rod
   boom, and one engine over a high wing). Was: the Chinook has always been
   one in physics; the bench needs the pusher cowl and mount.
7. **Turboprops and small turbines** [L]. A new registry family and its
   aspiration law. Distinct from the far-backlog jet module. COSTED 2026-09-04
   (HANDOVER G176): a `turbine` family + flat-rated lapse branch in 05_atmos,
   a bench architecture (can + inlet + gearbox + stack), a nacelle cowl style,
   PT6A rows with synthesised props, Jet-A in GEN_FUELS — two sessions. Unlocks
   the Caravan / Kodiak-alikes the user named.
8. **Biplane** [L]. The big one: a second wing plane, cabane and interplane
   struts, fittings for the lower wing (G85 names the gap — `wings` is an
   array and only the first plane carries fittings), and the join.
9. **STOL surfaces** [L]. Slats and tips as GEOMETRY on the stations P2
   reserved. **The PHYSICS stays in Phase 8** by the standing ruling: flaps
   are real and measured (GATE FLAPS), and a slat without measured physics is
   a slider that lies.

## PHASE 7 — THE ISLAND
*The world grows up. WORLD-V2 §2-§8. This is the only phase that invalidates
every golden hash, and it is staged so that the step which does that does
nothing else.*

0. **THE WORLD-PATH DECISION** — real topology or procedural. Needed BEFORE
   W4, and nothing in Phases 1-6 depends on it. Recommendation and reasoning
   in the section below.
1. **W4 — the offline bake** [L]. The node tool: erosion at 4096², the guide
   fields (flow accumulation, slope, curvature, aspect, fill depth), the delta
   format, the `h0` fallback. Still on the 24 km domain, so it is provable
   against a world that already works. **§4.3's guided detail is the single
   highest-value idea in the world spec** — detail synthesised BELOW the bake
   and steered by the erosion reads as eroded all the way down, which is
   precisely the defect the user named in MSFS.
2. **W5 — the island** [L]. Grow the domain, lay in the spine, re-bake. The
   step that changes every golden, and it should change ONLY that.
3. **W6 — hero tiles and site nomination** [L]. 4 m tiles streamed near sites;
   the landability pass scores and NOMINATES, the author PROMOTES. Over
   22 000 km² that is the difference between forty sites and four.
4. **W7 — the editor matures** on the format Phase 4 shipped.
5. **Aerial perspective** [M, W-V2 §6.4]. On a 250 km island the horizon at
   3000 m is 195 km. Height-dependent extinction and in-scattering, not fog.
6. **ONE CLOCK for hangar and world** [M, F4's owed half]. Flying out of a
   sunset hangar still arrives in fixed daylight. Includes the
   graded-panorama adoption decision (G62.2 — 1.66 MB for every hour there
   will ever be) and the outdoor grass still lit by the room's lights.

## PHASE 8 — DEPTH, WHEN YOU WANT IT
*Everything deliberately deferred. Not "someday" — each has a trigger, and the
trigger is you asking for it.*

1. **Manual controls, joystick, TrackIR** [L]. The user's own "at some point,
   I'll want to fly them myself." `reEngage` and `holdWas` landed in W14; what
   remains is input UI and its gate.
2. **Fleet and discovery** [L, old P6]. The rack (forty aeroplanes — the one
   sheet UI-MODEL still reserves), hours, wear, the found aircraft as
   measuring sticks, the envelope card on the plaque.
3. **Missions and economy v0** [L, old P5]. Contracts over the site registry,
   parts costing credits, the wallet the player document already declares and
   nothing charges (HANGARS.md §11 Q4 is one line).
4. **Validation against reality** [L, old P12]. Two or three real aircraft
   against reference models, benchmarked on published numbers through the
   DIVERGENCE LEDGER. **STOL physics goes live here** on Phase 6's geometry.
   **Reynolds number lands here and nowhere earlier** — F5 gave the air a
   density and deliberately left Cd0 and CLmax fixed against it.
5. **Deform and break** [L]. Design doc first — it does not exist on paper.
   Breaking is content: test-to-destruction, damage and repairs in the
   logbook, scars as attachment.
6. **The fixed-step accumulator** [M]. The sim runs at the display's refresh
   rate. Feel work starts here, and slow-motion-reads-as-rubber dies first.
7. **The remaining sim-honesty debts** [M each, all in the register]: the
   donor AP's flare EAS/groundspeed mix; the fleet wind gates still flying the
   uniform column F5 replaced; turbo/supercharging (`aspiration` reserves
   'turbo' and the R-1830 lapses like a normally-aspirated engine); the
   battery model that would give an electric aeroplane a real ceiling;
   interference drag (`gear.track` and camber are unread by the drag model);
   `intCons → fuselage.material`, the slider audit's headline gap.
8. **Far backlog**: the jet module and SubSonex, thermals and ridge lift (the
   `wind(x,y,z,t)` plug F5 made load-bearing), STOL competition mode, the
   asset editor proper (G50's step 3), naked structures / open-frame dress
   (old F2, with P4's deferred fuel plumbing riding along).

---

## THE SWEEP-30 RULING — **RULED AND LANDED as G150** (2026-09-01)

Asked since G130 and re-named in six chantiers without ever being made
concrete. Measured first, then ruled by the user the same day: **"say it's a
bad aeroplane."** Full write-up in HANDOVER G150; the measurement that made
the decision possible is kept below because it is the useful part.

**THE LESSON:** a question that has been asked six times is not waiting for an
answer, it is waiting for a MEASUREMENT.

**AND THE SURPRISE:** under the TEST PILOT the 30° aeroplane *completes* the
circuit (568 s, zero verdicts) — the donor `makeAutopilot` hung at the same
geometry. So the red was half about the aeroplane and half about the DONOR
AP's rigidity, the same class of defect as G115's self-retuning AP. **When a
gate says an aeroplane cannot fly, ask which pilot was flying it.**

**IT IS A TIMEOUT, NOT A CRASH.** The harness flies 600 simulated seconds and
requires `STOPPED`. Nothing diverges; no NaN; the physics is sound and the
gate's other two sweep checks (np walks aft monotonically, sweep costs
lift-curve slope symmetrically) both PASS.

| sweep | static margin | TO run | circuit |
|---|---|---|---|
| 0° | 21.5 % | 351 m | 294 s — flies |
| 16° | 48.4 % | 615 m | 273 s — flies |
| 24° | 63.2 % | 1129 m | 312 s — flies |
| 27° | 69.0 % | 1624 m | 356 s — flies |
| **30°** | **75.1 %** | **1801 m** | **stuck in INBOUND at 600 s** |

**THE PLAYER CAN REACH IT.** G140 retired the sweep slider, but `tipX` clamps
to `tan(30°) × exposed semispan` — deliberately the same envelope. Dragging
the tip fully aft gives SM 76.1 %, TO 1746 m, and reaches ROLLOUT at 594 s of
a 600 s budget. So it is not a legacy-only corner; it is one slider away.

**WHAT IS ACTUALLY WRONG WITH THE AEROPLANE:** sweeping the wing walks the
neutral point from 0.62 m to 2.52 m and NOTHING moves the CG to follow. A
75 % static margin is a dart — it needs 1.8 km of runway and flies the
circuit at a crawl. Measured confirmation that balance is the whole story:
`sweep 30 + xLE −0.7` (pull the wing forward) lands SM at 51.8 % and flies a
normal 302 s circuit.

**THE OPTIONS:**
- **A — it is a bad aeroplane, and the game should say so.** Stop requiring a
  completed circuit at the extreme; assert instead that THE TEST PILOT
  returns a bounded verdict naming the problem. Fits ruling 3's own words:
  *building it wrong and learning why is content, not error.* The machinery
  exists (`41_test_pilot.js` already returns 'wont-climb', 'card-clamped').
- **B — narrow the envelope.** Clamp the tip offset so full deflection is
  ~24-27°, which flies. Costs a legal design and raises a save-compat
  question for anything already at full reach.
- **C — raise the harness budget.** Cheapest, and the tip-offset case really
  does land at 594 s. But "it eventually lands" is a weak standard and a
  20-minute-per-case gate is expensive.
- **D — let the balance follow the planform.** The engineer's-handbook idea
  P8 §3 already ruled for: the editor ADVISES that a swept tip wants the wing
  forward, guidance you may ignore. Fixes the cause rather than the symptom,
  but is a feature, not a gate decision.

**THE USER CHOSE A** (2026-09-01). `swept wings still fly a circuit` is
retired; four checks replace it — the band that must fly still flies on the
donor AP, and the extreme must never diverge, must reach a bounded verdict,
and must name the reason if it does not complete. **Silence is the only
failure left.** Negative-verified 3/3 on doctored reports.

**D IS STILL OWED, and it is the honest remainder.** Nothing yet says the
aeroplane is bad *in words* — the plaque's 1801 m take-off run says it in
numbers, but no verdict names the 75 % static margin, because the test pilot
completed the flight and had nothing to complain about. The BALANCE ADVISORY
(the editor telling you a swept tip wants the wing forward — P8 §3's
engineer's handbook, guidance you may ignore) is what fully serves the ruling.
It was deliberately not smuggled into G150. It is Phase 2/5 work.

## THE WORLD-PATH RULING (recommendation, decision open)

The question: stay procedural, or start from existing topology (Sicily?
Kodiak?). The answer WORLD-V2's own architecture gives: **tier 1 does not
care who authored it** — it is a baked grid either way, goldens re-captured
in the commit that lands it. The question is therefore only "what is the best
way to fill a 49 m grid with believable orogeny", and there the recommendation
is clear:

**RECOMMENDED: a real island's DEM as the tier-1 base.** Copernicus GLO-30
(free, 30 m, whole earth) resampled onto the 49 m grid; `bakeHydrology` and
the guide-field export run OVER it, so §4.3's guided detail — the document's
own "single highest-value idea" — works identically; hero tiles still bake;
modifiers still compose. What it buys:
- It DELETES the two hardest unpriced jobs in the spec: authoring a
  convincing 250 × 90 spine, and making browser-scale erosion iterations
  read as real mountain structure at 49 m. A real DEM **is** the erosion,
  already run for a few million years at full resolution.
- The user's own MSFS critique ("l'érosion a fait un job superficiel — real
  data, generic noise beneath") is answered from BOTH ends: real structure
  above the bake, guided synthesis below it.
- The airport joy doubles on places that exist: real valleys, real approaches,
  real river bars to find.

**Candidate: CORSICA, and it was already the spec's anchor** — 183 × 83 km
fits the 200 km box the spec keeps, the spine crossing IS the signature
flight §2.2 wants, and it has genuine mountain strips to mimic. Kodiak
(160 × 108) is the purest bush fantasy but largely treeless; Sicily
(~290 km wide) oversizes the box and is agricultural across the west — Etna
is tempting and it is the least bush of the three. Taste decides; the
engineering is identical. A middle option that keeps the "official game"
feel: REAL ROCK, INVENTED NAMES — the topology is Corsica's, the places are
ours, and nobody expects LFKJ's charts to work.

The §12 Q2 fallback (authored mask + procedural fill) stays available if a
real island chafes. DECISION DEADLINE: before W4, because the bake tool's
input pipeline differs (DEM ingest vs erosion loop — ingest is the simpler
tool). Nothing before W4 depends on it.

## THE IDEA LIST, MAPPED (the user's 2026-09-01 list, so nothing is lost)

Every idea from the list, with the phase that owns it. Sorted by phase, so
this doubles as "what do I get, and when".

| idea | phase | item | size |
|---|---|---|---|
| Cowl preset follows engine type | 2 | 1 | M |
| More radials + inlines (amateur range filled) | 2 | 2 | S each |
| In-line engine up/down/left/right | 2 | 2 | M |
| Exhaust proper + silencer | 2 | 3 | M |
| Registration on the wing | 2 | 4 | S |
| Remember recent colours | 2 | 5 | S |
| Colour for engine braces | 2 | 6 | S |
| Ready-to-apply layered decals | 2 | 7 | M-L |
| Travel pod | 2 | 8 | M |
| Wilga-type suspension | 2 | 9 | M |
| Little airports | 4 | all | L (the phase) |
| V-tail — **LANDED G173** (2026-09-04) | 6 | 1 | L |
| Double boom | 6 | 2 | M-L |
| Elliptic wing | 6 | 3 | M-L |
| Retractable wheels | 6 | 4 | L |
| Wing-mounted engines / multiengine — **LANDED G174** (a wing pair; no engine-out yet) | 6 | 5 | L |
| Pushers — **LANDED G174** (aft bulkhead + over the wing) | 6 | 6 | M-L |
| Turboprops / small turbines | 6 | 7 | L |
| Biplane | 6 | 8 | L |
| STOL wing, slats/tips (geometry) | 6 | 9 | L |
| Time of day synced with the hangar | 7 | 6 | M |
| Manual controls, joystick, TrackIR | 8 | 1 | L |
| STOL physics | 8 | 4 | L |

## THE ARCHETYPE BENCH (2026-09-04, the user: "Let's build more archetypes,
fine tune them, then they will eventually become our extended test bench
rather than the rather outdated original planes like the DC3 ... Eventually,
there will only be garage builds")

GATE ARCHETYPES flies every LIVE card of tools/_cage_design.js (G175/G176:
seventeen — the twelve of the list, the Whittaker-alike, the Archaeopteryx-
alike, the DA62-alike, the Twin bush hauler and the Beaver-alike; the utility
class is the one card still out). Each card carries `kind`: a RECREATION
(after a real aeroplane, the user reviews and exports each) or FICTION. The direction: each card that
lands gets a role target and a measured line, and a fiche the fleet keeps only
until a card covers it. The next round is a TUNING pass card by card in the
page (the gate flies the pre-join spec; the stand flies the joined build), then
the DC-3 / Chinook / drone fiches go to reference-only as their cards arrive.

## THE NEXT PLAYTEST (proposed)

Themed: **build three real aeroplanes against their reference ghosts** (the
split view exists for exactly this), certify each on the bench tab, fly each
to a meadow and back, land the review as a numbered batch. It exercises the
catalogue's gaps — the review will name which PHASE 2 items hurt first, which
is better information than this document can give itself — plus the
references, the AP and the arrival cards. It will also run straight into
Phase 1's logbook gap and roll-out teleport, which is the point: **the order
should come from play.** If the playtest disagrees with the phases above, the
playtest wins.

---

## THE GAME, IN ONE PARAGRAPH (the judging criterion for every phase)

Design your plane, see if it flies. Test it — yourself or automatically —
collect its stats, make some faster, some landing shorter, some carrying
people or heavy cargo. Collect your planes, customize them, get attached to
them, fly missions with them, modify them, build a fleet, and discover the
principles of flight by doing all of it. You are the engineer more than the
pilot: THE AUTOPILOT IS THE PILOT, and hand-flying arrives eventually as an
option, not as a gate.

## THE RULINGS

1. ~~**BENCH UNTIL INTEGRATION.**~~ **OVERTURNED BY THE USER 2026-09-01:**
   *"I disagree with bench until integration. The bench does not exist anymore,
   the editor is in game. We do not need separate benches anymore."*
   **THE RULING IS NOW: ONE EDITOR, AND IT IS IN THE GAME.** The in-game
   editor IS the working surface — it has been since G35 embedded it and G65
   collapsed the flow, and the roadmap simply never caught up. What the old
   ruling got right is kept and is the reason the reversal costs nothing: the
   bridge is the SPEC, not the UI, and the generators are MODULES, so the game
   consumes exactly what the bench pages consumed. What changes:
   - New part work is designed against the in-game editor. No chantier may
     require a bench page to be useful, and none may deliver a control that
     exists only on one.
   - The seventeen `tools/*.html` bench pages are LEGACY. They are not deleted
     in the same breath — some are the only harness for a checker, and the
     retirement is an audit, not a keystroke (Phase 1, item 8) — but nothing
     new is built on them and the `CAGE_IN_GAME` carve-out that keeps the old
     accordion alive is a debt, not an architecture.
   - The HEADLESS half is untouched and was never the bench: the node
     verdicts (`_cage_fit`, `_fin_check`, `_join_check`, GATE GEAR's THREE
     stub …) are the battery and stay exactly as they are.
   The P10 line "the garage rebased on the bench modules" is therefore already
   DONE, and was done early, by the user's own call at G35.
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

---
---

# ════════ THE RECORD ════════
#### Everything below this line is HISTORY, kept because it is cited all over
#### HANDOVER and because the as-built detail is the useful part. **THE PLAN
#### ABOVE SUPERSEDES ITS ORDERING.** The old phase numbers (P0-P12) and
#### floating chantiers (F1-F6) survive as LABELS you will meet in commit
#### messages and gate comments — every live item they still own has been
#### lifted into a numbered phase above. Read this section to find out how
#### something came to be, not to find out what to do next.

## WHERE THE BENCH STOOD (2026-08-26 — superseded by the ONE EDITOR ruling)

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

## THE OLD PHASES (P0-P12) — AS-BUILT RECORD, NOT THE PLAN

*(Superseded for ORDERING by THE PLAN at the top of this file. Kept whole
because the as-built notes under each are cited across HANDOVER and are the
most detailed account of how each system came to be.)*

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
it, `build & fly` ran export → the save pipeline → the stand (that
button is retired at G65; the export is a step inside testing and
rolling out now), and the FIRST FULL DESIGN→FLY TURN is verified — an editor-set 912 + 11.6 m
wing flew ROLL→LIFT-OFF→CLIMB on the AP. THE PLAQUE landed at G60.
THE SHELF landed at G63 (the user: "the save/import mechanism seems
broken, and it is somehow redundant with the presets in the editor") —
one store and one format instead of three, the editor finally LOADS
what you loaded, the join UPDATES instead of replacing, the stock
designs are ordinary builds, and GATE BUILD is the loading gate
ruling 4 has been promising since the slice opened.
THE ENGINEERING BENCH landed at G64 and the FLOW COLLAPSED at G65, so
P3's turn is now a turn: pick the Garage build and you are in the
hangar editing; the bench tab runs a DECLARED LIST of tests and the
plaque fills from them; any slider withdraws the certificate; ROLL OUT
& FLY exports through the join and flies what you built. No
intermediate screen anywhere in it. The wing loading came back with the
aeroplane ON ITS BACK — how a homebuilt sandbag test is actually done,
and the only way the bags can push the wing the way they look like they
push it (the rig loaded +y while the viewer drew the bags on top; the
physics was right and the picture was not). G46's declared visual gap
closed on the way past: the save carries the cage, the editor is seeded
from it, and the snapshot is REGENERATED — no mesh bytes in storage.

REMAINING in P3: the ONE MISSION. The logbook stub it writes into
exists (built date, tests, flights) and nothing reads it back yet.

FOUND BY PUTTING BOTH ON SCREEN (G65.1): the editor's cage build and
the physics lattice stand ~2.8 m apart along the room, and always have
— placeEditor grounds the build and leaves it at the CAGE's own datum.
It was invisible while the two were never up together. The instruments
now measure the gap and follow the aeroplane you can see; moving the
BUILD onto the lattice instead is the deeper fix and wants its own
chantier, because it re-places the aeroplane in a room P11's own work
is composed around.

TEST FLIGHT — BUILT at G107 (2026-08-31), exactly as declared: IN PAGE, an
offscreen fast-stepped circuit flown by THE TEST PILOT (`41_test_pilot.js`,
the second autopilot — `makeAutopilot` forked verbatim and given BOUNDED
ATTEMPTS WITH STRUCTURED VERDICTS: rejected takeoff, put-down from a
ground-effect hover, accepted ceilings, terrain go-around, a watchdog).
Generated builds fly it in the game too; the hand-built fleet keeps the old
AP so its eleven gates stay benchmarks. The LANDING RUN is on the plaque,
GATE PILOT (core, --selftest) holds it negative-first, the strips wear
TOUCHDOWN MARKERS at the registry's own tdz rule, and the dalt row went
ADVISORY (TESTED is not PASSED). THE TEST CARD landed at G107.1 (same day):
target altitude + target speed on the flight row, the pilot clamps an unsafe
ask to its OWN approach speed and says so, flown means judged against the
ask on the plaque, 'cant-hold-speed' said with both numbers — tried in the
game on the user's 0.10 m/s WIP: "REJECTED TAKEOFF — card-clamped,
wont-climb". THE ARRIVAL CARD landed at G107.2 (same day): the flight ends
with a card — outcome, touchdown, landing run, past the aim, the test card
asked-vs-held, the pilot's notes verbatim — for BOTH pilots (the fleet AP's
falls back to tdInfo), with "Fly again" (the dead bGo, fixed) and "Back to
the hangar". PLAQUE PERSISTENCE landed at G107.3, closing the arc: the
certificate (bench results + the thin-air and test-flight sheets) rides the
envelope and survives reload/save/import; the one rule that made it safe in
a tree where LOADING fires the dirty hook — a dirty that arrives with
nothing on the bench never touches the store — plus capture-at-entry,
restore-LAST ordering in loadSpec and the boot. GATE BUILD block N holds
the order; flown in the page both directions (restore after reload, and a
real slider edit withdrawing store and all). The G107 arc is WHOLE.
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

OPENED 2026-08-30, arc numbers claimed **G97-G101** (see the claim block in
HANDOVER; it was G95-G99 until the P8 session took those mid-planning, and it
is held loosely per the numbering note below). A tank or a pack is a PHYSICAL
THING YOU BUY — a real solid at a standard capacity, dropped into a declared
bay, positioned and rotated until it fits around the pilot, whose swept volume
IS its capacity. G97 the interior volume + the wing spars · G98 the vessel
catalogue · G99 placement, fit and clearance · G100 the loading table and
CG(fill) · G101 the balance panel. BURN AND DISCHARGE is deliberately NOT in
this arc — it needs the flight loop, while everything above is provable on the
bench (RULING 1), so it is named and left for the next chantier.

**THE HANGAR-MANAGEMENT SEED LANDED AHEAD OF BOTH PHASES BELOW** (2026-08-31,
futureDesigns/HANGARS.md S1+S2+S3, HANDOVER G126): the PLAYER document
(`flydiy.player` — sheds + wallet, own version + migrator + vintage fixture;
named `player` because "estate" was taken by G77.1's screen sense) is the ONE
container this roadmap's P5/P6 were told to agree on, defined minimally with
`fleet`/`logs` reserved — P6's lift from `flydiy.build.*` is its migrator
table's first real entry, not a new format. Kits + capabilities are declared
and ADVISORY; the wallet is declared and nothing charges it — §11 Q4's join
(`wallet -= shakedown.cost`) stays one line, owed to P5. The `field` timber
shell LANDED the same day (G127 — half-dims confirmed by the user, FRAME
branch, one top-hung leaf on an outrigger track), and S5 closed the spec
(G128): AIRFIELD_SITES registry with siteOf and null meadow slots ready for
P6's granting, siteOnFlat per aerodrome, the editor's advisory line, and
SHELLS.sky = 'alps' as the shed↔HDRI association point (all moods are
gradings of the one alps panorama today, so that IS the current truth).
HANGARS.md is implemented END TO END; its §8 deferrals are the P5/P6 hooks.

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

**P8 — the editor experience (tranche B of the UI revamp).** — STARTED
2026-08-30, and it carries a DESIGN: the Claude design session's option 9b
("Bone") rebaselines the whole editor screen on one rule — every surface has
exactly one job. The view shows and is manipulated directly; the parts column
selects; the properties column edits; everything about the aeroplane AS AN
OBJECT lives behind its name. High fidelity: colours, type, spacing and copy
are final. The handoff bundle is `design_handoff_garage_editor_9b`.

THE ARC, AND ITS NUMBERS ARE RESERVED (three sessions share this tree, and
G72 went to the atmosphere while this was mid-flight):
- **G76 — the part table. LANDED.** `tools/_cage_parts.js`: 7 assemblies,
  33 parts, the param -> part map, the part -> section map, the placement
  strip per part, and the existence rules. GATE PARTS (tier core, `--selftest`
  negative-verified) holds it against the editor's own 537 rows and the 28
  sections real builds emit.
- **G77 — the panel is two columns. LANDED.** `src/viewer/editor.js` +
  `editor.css`. §4's tree and inspector, §5's placement strip, §6's
  changed-from-loaded dots with per-row and per-part reset. It builds no
  widget: the rows are `_cage_ui.js`'s own elements, moved, so the row grammar
  stays one implementation across the game and the benches.
- **G78 — the view owns looking. LANDED.** The icon rail (camera, display,
  night, explode, measure) with its flyouts, the name chip, the two verbs
  bottom left, and the SHED'S OWN SHEET (user's ruling: tuning the atmosphere
  or the hangar is a different interface). `#edBar`, `#bEnv`, `#bMood`,
  `#bEdit` and the game's whole bottom bar left the garage with it, and the
  STUDIO stopped being a choice — the hangar is the only room. Also G77.1
  (user): the render is the FREE ESTATE, not a full frame under an opaque
  panel, so the orbit centre follows the space available.
- **G79 — selection is bidirectional. LANDED.** A raycast on the material
  groups selects the part, hover tints both ways (view → tree row, tree row →
  geometry), and the selected part carries the design's callout, pinned to a
  world point on itself. app.js reports a HIT and editor.js resolves it
  through the part table, so an unknown layer — GEN_ACCESS's, when it lands —
  resolves the moment its part row exists, with no edit to the editor. The
  root is a tree row now, which is what makes "everything visible" a place you
  can go back to.
- ~~G80 — the sheet behind the aeroplane's NAME.~~ **SUPERSEDED 2026-08-30 by
  the user's design review**: the plaque, the bench and the store go into a
  permanent LEFT INFORMATION PANEL instead of a sheet, because a plaque you
  have to open hides the consequence of the slider you just moved. Only the
  fleet RACK stays a sheet. The name chip goes with it — it was a door to a
  sheet that no longer exists. See G87.

**THE UI MODEL (2026-08-30, the user's design review after G76-G79).** The
review is written up as `futureDesigns/UI-MODEL.md` — the authority on WHAT
GOES WHERE, with the 9b handoff remaining the authority on colour, type,
spacing and copy, and the three layout disagreements between them listed and
argued. In one line: **two interfaces, one renderer; in the workshop, observe
LEFT, change RIGHT, select RIGHTMOST, look in the MIDDLE.**
Arc numbers: **G86 LANDED**. The rest are NOT pre-reserved — see the note on
numbering below.
- **G86 the two interfaces. LANDED.** FLIGHT and WORKSHOP as separate chrome
  layers (`#ui` / `#wsUI`), so the aircraft card cannot render under the name
  chip and the PFD cannot watch you build. The mode follows the GARAGE, not the
  editor's boot. Gated twice: the mode is observable (UISMOKE's classList stub
  is real now) and the seam holds (ten flight ids inside `#ui`, eight workshop
  ids inside `#wsUI`, checked on the built artifact). The `#edStat` blob and
  the parts column's help text went with it.
- **THE FLIGHT SCREEN'S OWN REBASELINE. LANDED as G141.** The pass G77-G108
  gave the workshop, given to the other screen from a Claude Design handoff
  (`design_handoff_flight_interface/`, high fidelity). The editor's rule is
  spatial; flight's is TEMPORAL — what am I flying / what is it doing / what
  happened, in the order the flight asks them, and nothing that answers one
  stays up while another is being asked. Four surfaces: the brief plate and
  the verbs on the editor's own top-bar pixels, the look rail bottom-left
  (five flyouts: camera, instruments, map, trace, air), the PFD bottom-right
  with the phase rail inside it, and three summoned panels. The bottom bar's
  eight controls are still the writers, hidden in `#flStore` and driven by
  the plate — no second source of truth. A third stylesheet, `flight.css`,
  carrying the editor's Bone palette on `#ui`; Mono is gone from the HUD.
  The camera flyout is genuinely new and `cockpit` is G107's pilot eye walked
  into the flying frame, not a second implementation. TWO WARNS ARE OWED, not
  faked: Vne and a sink-rate limit are declared nowhere, so only the stall
  colours a readout — and the arrival card has no `fuel used` row for the
  same reason. HANDOVER G141 is canonical.
  **G141.1 is the user's first look at it**, and three rulings that override
  the handoff: the stack is DECLARED (the flyout must never be under the trace
  it opens over), the PFD rides the TOP ROW in the middle (in the flow, so it
  cannot land on an open brief), and the plate is GLASS on this layer —
  `--ed-plate` .68 for the surfaces that carry a decision, `--fl-glass` .54
  for the two you read through, the arrival card still opaque. The trace is
  furniture now: lighter, at the bottom of the stack, draggable by its header,
  resizable by its grip, double-click to put it back, geometry persisted.
  **G141.2 gave the screen its shape**: the look ribbon stands VERTICALLY up
  the left edge, the verbs are their own surface at the bottom right, the PFD
  is centred by a `1fr auto 1fr` grid, the trace starts at the bottom across
  two thirds of the row — and the trace became an INSTRUMENT: fifteen
  channels (everything the PFD can carry, plus the three stick positions,
  flap and brake), one LANE each over one clock rather than fifteen lines on
  one axis, selectable from the legend, labelled with the LATEST value and
  with the value under the crosshair. Six colour families, validated. THERE
  IS NO TRIM to plot — `sim.ctl` has none — so flap and brake stand in its
  place, and the trim channel is owed to a solver that grows one. GATE
  UISMOKE now BALANCES the flight layer's tags: a lost `</div>` nested the
  map and the trace inside a hidden flyout and every id assertion still
  passed. **G141.3 made the panels furniture**: the PFD, the map, the ribbon
  and the trace all drag (the brief and the verbs deliberately do not — they
  are the anchors), each re-parenting to `#ui` on its first drag and going
  home on a double-click; the map sits in the top-right corner again (the top
  bar's BOX spans the screen, its content in that column does not); the PFD
  has a SMALL mode — IAS/alt/VS/power at 19 px plus the steps — that overrides
  the instrument selection rather than editing it; and the trace is eleven
  channels, three on by default.
- **the INFORMATION panel. LANDED as G91.** Plaque, bench and fleet on the
  left, 280 px, folding, pushing the render and its centring. The
  aeroplane's SHEET and the NAME CHIP retire with it (a door to a room
  that is now a wall is a sign), and so do the design/bench TABS — they
  existed because the plaque and the sliders shared a column, and they are
  on opposite sides of the screen now. The two panel insets became two
  custom properties on <body>, because four things have to agree about the
  free estate and the same arithmetic was written out four times.
- **the tree's TOP LEVEL. LANDED as G102.** It is a SCENE, not an aeroplane:
  roots register themselves through `window.CAGE_TREE_ROOTS.add({...})`, so
  the shed and the world join it without editing editor.js — which is what
  three sessions in one file most needed. Build plane and Reference plane
  read as peers now (they always shared a class; one was in capitals). The
  tree folds per branch, with `fold all`, persisted.
- **the THIRD FOLD. LANDED as G103.** The properties column folds too, so
  all three workshop surfaces do and folded to their spines the render has
  the screen (651 px -> 1433 px of a 1571 px window). The right panel's
  four widths are COMPUTED in one place and published as a number rather
  than declared as four classes.
- **the tree grows its remaining ROOTS. LANDED as G108.** Four roots — the
  build, the reference, `The shed` and `The world` — through G102's registry,
  which had two callers and both were in editor.js. The SHED SHEET retires with
  them (G78's ruling reversed on UI-MODEL section 2.4's own argument: one
  selector scales, two interfaces do not), and `#edScrim` / `body.sheet-open`
  go with it — the FLEET RACK brings its own back when it lands.
  `Design & construction` is the first row under the aeroplane, holding
  construction, the two derived configuration selectors, boom style, pod and
  canopy, wing position and bracing, and the three existence switches. NOT
  `engPreset`: it names a model rather than deciding what exists. GATE PARTS'
  "assembly with no children" rule was widened to "no children NOR rows" for
  the one case that is deliberately a top-level row heading nothing, with its
  own negative probe. Per-assembly collapse already landed at G102.
- **the FINISH view. LANDED as G104.** SHAPE/FINISH as two views of the SAME
  tree — the tree stays the only selector (the noun), the tab is the
  adjective. Per-part finish, tint and G102's three dials, moved from
  `_cage_ui.js`'s materials panel under the part whose `sections` claim them;
  whole-aeroplane livery and markings on the root; and the CONCEPTION row the
  user could not find (`intCons`) is live at the head of the livery instead of
  read out dead beside it. The join is `sections` in the part table, which
  GATE PARTS already held true in both directions — the finish view needed no
  new rule. The part callout went with it, at the user's request, and took
  `EDITOR_FRAME`, `projectPoint` and ~900 vector ops per highlight build.
- **`spec.finish`. LANDED as G105**, and it closes what ROADMAP has owed since
  G67. The finish is the aeroplane's now, not the browser's: it rides out
  through the join beside the shape and in through `applySpec`, so two designs
  keep two liveries and a build file carries its own paint. Deviations only,
  one object per section, null = the factory finish.
  **NO GEN_SPEC_V BUMP, and that is the finding** — the version exists to
  branch a MIGRATION on and there is nothing to branch: an old spec gets null,
  null means "no overrides", which is what it always meant. The 5 -> 6 bump
  stays the ENERGY MODULE's, whose `spec.fuel` change really does need one.
  GATE BUILD +12 checks, each negative-verified; the converters measured in
  the browser and in `CAGE_VISUAL` (no node harness boots `_cage_ui.js`).
  Still not carried, declared: a loaded livery IMAGE (placement yes, pixels
  no), and the finish is exactly as fresh as the shape — it lands on the next
  build sync, like every slider.
- **VIEW STATE NEVER FLIES. LANDED as G106**, and the plan above was wrong
  in three places, which is written up in HANDOVER because the corrections are
  the useful part. The VERTICES were already un-exploded (G63 works). What
  flew exploded was **the PROPELLER'S PIVOT** — the restore sat in the MIDDLE
  of the capture, and its `build()` put the scene back before the hub and the
  shaft axis were read out of it: measured at explode 0.9, the hub at -3.4792
  became -4.4828, a metre off the nose. The restore is a `finally` around the
  WHOLE capture now, so the capture happens in one state. This probably also
  closes the G58.4 "prop sometimes ends up in the middle" tripwire, whose own
  warning asks the reporter whether explode was on.
  Reading for the user's other half — alpha — turned up three more: the family
  alphas (4 translucent materials became 18: a see-through aeroplane) and the
  two display modes that REPLACE the fuselage mesh outright, wireframe
  (409,944 vertices to 276,114 — no fuselage at all) and the surface field.
  The fix is a DECLARED TABLE in `_cage_join.js`: VIEW_STATE (10 neutralised,
  each with a constant neutral) + VIEW_KEEP (5 exempt, each with its reason,
  all five measured). **GATE VIEW** (new, tier core) holds it against
  editor.js's own RAIL in both directions, so a display control added later
  without a decision is red. 12 checks, every rule negative-verified.
  ALSO NOT a usable instrument, contrary to the plan: "vertex-identical at two
  explode settings" — two captures at the SAME setting disagree in the third
  decimal on one translucent group, so that gate would have been red on
  arrival.
  **G106.1 — SUBSURF IS NOT A CHOICE.** I left subsurf alone and flagged it;
  the user overruled it ("it shouldn't even be an option in this editor
  anymore. OK to keep it in the cage, but not in game"), and the ruling is
  right: the subdivision level is how smooth the aeroplane IS, not how you are
  looking at it. Gone from the game in three places — `_cage_ui.js` does not
  adopt it under CAGE_IN_GAME, the rail does not list it, and it is pinned at
  2 in VIEW_STATE regardless. The ELEMENT stays parked and hidden because
  `build()` reads its value every build. GATE VIEW gained a `hidden: '<why>'`
  flag and two rules for it, since "decided but not shown" is exactly what a
  stale ghost row looks like. Measured: editor at L1 (6,515 v on screen),
  capture still 412,602 v.
- **the TYPE LADDER, the top bar, the way inside and THE SCENE. LANDED as
  G108** — the first four chantiers of the user's twenty-one-item review
  (2026-08-31; the ordered plan for all of it is in the session's plan file). The heading
  hierarchy item below is CLOSED by it, and so is half the pass: there is one
  type scale now, declared on `#edWrap` and used by both columns, with
  uppercase reserved for group labels — the ladder had been running BACKWARDS
  (a root drawn quieter than the assembly inside it) and the tree's assembly
  style was byte-identical to the properties column's group style. Separators
  moved to the END of sections in both columns. Also: click-outside deselects;
  `Wheels & tyres` highlighted NOTHING and now highlights the wheels (it
  failed in both directions and had since the part table declared the kit);
  hover narrows to the named instance; the icon rail and the two verbs became
  ONE BAR across the top with `Save` on it; `Run the bench` is deleted, not
  moved, because it only ever pressed a button already on screen in the
  information panel; and the INTERIOR VIEW is real — `_cage_crew.js` publishes
  the pilot's eye point (it was computed and thrown away, drawn as a marker
  and askable by nobody), the orbit pivots 0.35 m in front of the eyes, the
  polar / radius / shed clamps come off and the near plane goes to 35 mm.
  GATE: UISMOKE's seam gained four ids, three RETIRED ids asserted absent, and
  the two-file interior contract; four negative probes, four reds.
- ~~the pass — the 108 NATIVE checkboxes whose OS accent is the red the user
  has no place for~~ **LANDED as G112**, together with the scrollbars (which
  had NO styling anywhere in the project outside `tools/_pwr.html`). Measured
  after: 0 of 123 checkboxes and 0 of 565 ranges native, across both workshop
  roots. TWO THINGS THE DIAGNOSIS GOT SHORT: the workshop is `#wsUI` AND
  `#edView` — the flyout lives in the second, so `#wsUI .r` alone would have
  left the very surface the diagnosis named untouched; and the PALETTE has the
  same defect one level down, so after the rescope the flyout's toggles came
  out `appearance:none` with a transparent track. Both roots carry the control
  rules and the tokens now. THE RULE: in a re-parenting architecture, a look
  keys off the ROW, not off the place the row is standing.
  STILL OWED from this item: the focus-visible / hover / reduced-motion sweep
  across the surfaces added since G77.
- **THE SECOND BATCH — the user's twenty-item review after G108. SIX LANDED as
  G112** (2026-08-31; the ordered plan for all twenty is in the session's plan
  file): the instrument panel is ON the dashboard and the dash IS its plate —
  it was displaced by exactly `dashDepth`, 0.35 m, because `dashLip` measured
  the BOTTOM of the dash box and the panel was hung below it, and then buried
  38 mm INSIDE the box once the height was right; the shed's lamps spread 135°
  and the ground bounce is 1, with GATE LIGHT's own `< 1` bound rewritten
  because the user overruled the G94 occlusion term (the argument stays in the
  file, with a paragraph saying who overruled it); the Piper Cub rests on its
  wheels — it is drawn FUSELAGE-LEVEL, 12.09° from its parked attitude, and
  the `pitch trim` slider was rotating about the wrong axis and ROLLING it;
  the tail's tranche is smooth-shaded and the flats are not, with `tailRimN`
  a row (the tail was flat by CONSTRUCTION — non-indexed geometry, so
  `computeVertexNormals` could only ever give face normals); the cowl's oil
  door is a superellipse; and the styling pass above.
  **SIX MORE LANDED as G117** — the beacon is SEATED on the fin instead of
  straddling it (it was never a depth trick: the fairing's centre sat ON the
  fitted top line by design, 286 of 633 vertices under the fin's own edge, and
  DoubleSide did the rest); the cabin lamps MEASURE the ceiling they hang from
  and are now identical on a high wing and a low one (the report was not what
  the code did — `roofY` is a fuselage number, but a high wing sits 25 mm from
  it, so the lamp only LOOKED attached); the wingtip navs and every fairing
  gained placement and shape rows; the ceiling flood gained a reflector at all
  (`PROF.can` is a housing; `PROF.cup` existed and was used only by the wing
  lamp and the beacon's mirror) and it glows on the lamp's own dimmer; the aft
  bulkhead slides through its pillar; the door's gap is its own row FILED UNDER
  THE DOOR (`rimW` was claimed by `joints`, which is why the user could not
  find the control that already existed — and `rimDoor` was bench-only, so the
  door had no outline bead at all); and every one of the 19 declared fittings
  gained two nudges, GENERATED from GEN_ACCESS's own keys in both the row table
  and the part table so they cannot drift.
  GATE LIGHT gained 13 source rules over the arc, negative-verified.
  **THE REAL WINDOW RECESS IS REACHABLE BUT NOT THE DEFAULT**, and that is
  measured rather than cautious: `winFrameW` on globally turns GATE FIT red on
  176 checks, because the reveal's triple ring round every glazed zone reads to
  the fitting placer as extra skin and a fitting the table wants once resolves
  to three sites. Isolated by A/B on that one number. Teaching `_fit_site.js`
  to skip reveal rings is its own chantier and is what stands between the user's
  request and the default.
  **ITEM 10 LANDED as G118** — the waist bump line stops at the window pillar.
  Measured off the running build's own uniforms rather than guessed: it is not
  the mould parting line (partingW 0 — that skin is `wood`), it is the
  LONGITUDINAL PANEL LAP, `panelAround 0.85` putting one lap exactly on the
  waist with a 0.4 mm step against the tape's 0.12 mm. `sL = 0` already IS the
  windscreen base ring by the join's own G49 definition, so the mask is a
  smoothstep on m.x — no uniform, no attribute, no plumbing. A sheet edge stops
  where the sheet run stops; the STRINGER tape and the CIRCUMFERENTIAL lap do
  NOT stop, because a longeron runs forward and the nose has its own frames.
  BODY ONLY: on a wing `sL` is spanwise, and masking there would strip the laps
  off half the surface. Five rules in GATE SKINMAT, five negative trials, five
  reds — including two that catch OVER-masking, which is the failure mode that
  would look like success.
  **AND HALF THE RECESS BLOCKER, also G118.** The reveal's frame bands inset
  along the NORMAL, so they carry the same (sL, sC) as the loop they came from
  — three faces at one point. They are marked and `_fit_site.js` prefers real
  skin over them, falling back only where they are the sole body surface (the
  inside of a window frame, where "no site at all" is worse). **176 red -> 22.**
  Two traps paid for: `cageSubdivide` drops any face field it does not NAME, so
  the first attempt left the gate at exactly 176 with the fix apparently in
  place; and skipping the bands outright took four probe stations to zero sites.
  THE 22 THAT REMAIN ARE NOT THE BANDS — they are genuine skin, so the reveal
  moves the FIELD itself, and GATE SURF agrees. That is a `cageWindows`
  vertex-field chantier and it is what still stands between the user's request
  and the default. All of it is inert at winFrameW 0.
  **ITEM 6, PASSENGERS, LANDED as G119** — the last unstarted item. The cage
  could already build four bays; nothing downstream could carry them. Four
  gaps closed where they live: `GEN_SEATING` gains `side4`/`tandem4` (new
  VALUES, no version bump — `genNormaliseSpec` IS the migration path);
  `cabin.pax` is a LOADING beside `pilots`, clamped to the seats left and 0 by
  default; `genFrame`'s two-element seat-ring literal becomes per-layout, so a
  third occupant stops being billed onto the front row with the pilot; and the
  cage places four, fills every non-pilot seat, and the join reads the capacity
  from GEN_SEATING so the loading it hands the game is the loading you can see
  — it used to hand over two while the screen showed four.
  Measured: tandem2 pax1 +79.9 kg and 92 mm aft; side4 pax3 +238.8 kg and
  325 mm aft; **GATE ENERGYBASE PASS**, the fourteen frozen aeroplanes unmoved.
  Nine checks in GATE BUILD, two negative trials, both red. The 80 kg arrives
  as 79.9 because genFrame's second pass sizes the structure for the mass the
  first found — written down, because a 1e-6 tolerance there would only ever
  have passed by accident.
  **STILL OWED from item 6, and it is the honest half of "impacting the CG":**
  the seat you MOVE is not the seat that is BILLED. `seatX`/`seatY`/`seatPitch`
  reach the crew layer and stop; `pt(rg.BL, 40)` puts an occupant at a frame
  INDEX on the bottom longerons only, so the crew adds no CG height and sliding
  a seat aft changes the drawing and not the balance. Fixing it moves EVERY
  aeroplane's CG and therefore re-baselines the fourteen ENERGYBASE aeroplanes
  the energy arc froze — a decision to take WITH that baseline's owner.
  **STILL OWED, all named in HANDOVER G112, G117, G118 and G119 with what the
  reading established:**
  **ALL TWENTY ARE NOW ACCOUNTED FOR.** Landed: 3, 5, 11, 13, 14, 16, 19
  (G117) · 4, 7, 9, 12, 15, 18, 20 (G112) · 10 (G118) · 6 (G119). Item 8 was
  already done at G108 and was reported rather than redone.
  HANDED to the per-part livery arc on the user's own call: **items 1 and 2**
  — the `rubber` finish already exists and the joints are four words in
  `AERO_BY_CONS`; the dash's "riveted metal face" is the STRUCTURE grammar and
  `AERO_SKIN_ROLES` is `{skin, rail, pillar}`, so it is a real decision inside
  that arc's own subject.
  **ITEM 17 was hunted on the user's own WIP build and NOT FOUND (G122)** —
  most likely fixed by G111/G112, which reworked `_cage_eng.js` and rewrote
  `makeDummy` hours after the report.
  **THREE THINGS ARE STILL GENUINELY OWED, and each is named where it lives:**
  the window RECESS as a default (G118 — the reveal moves the sL/sC FIELD, not
  just the faces; 176 red -> 22, and the 22 are genuine skin); the seat you
  MOVE not being the seat that is BILLED (G119 — fixing it re-baselines the
  fourteen ENERGYBASE aeroplanes, so it goes WITH the energy arc); and the
  focus-visible / hover / reduced-motion sweep left over from the styling
  pass (G112).

**ON NUMBERING, AND WHY THIS ARC STOPPED RESERVING (2026-08-30).** G76-G80 were
reserved in this file before the work started, and the reservation was read and
honoured by the GEN_ACCESS session (which took G81-G85 the same way). It was
then quietly broken twice: the ATMOSPHERE session took G72 mid-flight, and the
REFERENCE-OVERLAY session took G89 AND G90 — both reserved here — and had
working code on disk with those numbers baked into its comments before anybody
noticed. Renumbering someone else's in-flight work is worse than the collision,
so both were ceded.

THE HONEST CONCLUSION: a reservation only binds sessions that read it, and a G
number is a LABEL, not an identifier. Nothing in the code, the gates or the save
format keys off one; the cost of a collision is a confusing handover, not a
broken build. So the protocol changes:

  TAKE A NUMBER WHEN THE CHANTIER LANDS, not when it is planned — by reading
  the last `## G` heading in HANDOVER.md and taking the next free one. Reserve
  at most the one you are writing right now.

Planned work is named by WHAT IT IS, as the list above now does. A plan that
needs a number to be findable was not named well enough.

DECIDED WITH THE USER ON THE WAY IN (2026-08-30): the standalone cage benches
KEEP today's accordion — the new UI is game-side, which is also the smallest
footprint in `_cage_ui.js` while the materials session is live in it; the
editor IS the garage screen (no "back to the game" door, the parts column
folds instead); and every tree node is selectable including the assemblies and
a root, because "we should still have a top layer where everything is visible".

The structural half, designed AFTER the loop is live because the loop is
what it serves — the badges ARE stat feedback now, not tool decoration:
- §3 configure THEN shape: a first screen of ~eight discriminators, each
  writing derived values once and deciding which parts exist. DECIDED HERE:
  the tension between auto-derived correctness and the discovery fantasy —
  derivation framed as the engineer's handbook (guidance you can ignore),
  never as guardrails that prevent building a bad aeroplane. Building it
  wrong and learning why is content, not error.
  LANDED (2026-08-31) as THE BIRTH FLOW — specified and widened in
  `futureDesigns/NEW-AIRCRAFT.md` (~29 macro rows, two kinds of row, one
  declaration in `tools/_cage_design.js`, tiles in `design_flow.js`, the
  fleet's "✚ new aeroplane" door, GATE DESIGN + GATE ARCHETYPES; the spec's
  §12 records where it was corrected against the code). Role/class are
  LABELS on `spec.meta`, targets declared unread — P5/P6's hook.
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

**P9 — materials & mapping.** — PULLED FORWARD, STARTED 2026-08-29 (G66),
user: "we are going to give materials to the procedural planes".
Parameter-space UVs (the C4 item, still open), PBR materials per part,
liveries and registration decals (G4.5's decals are the seed). Liveries are
an ATTACHMENT system as much as an art one — your plane, your colours — and
land after P8 because materials hang off the final part model.

WHY THE P8 DEPENDENCY DISSOLVED, and it is not a waiver: P8 §4 says selection
tints geometry "(SEC groups)". The cage's ~30 section names ALREADY ARE the
part model as far as materials are concerned — a material system keyed on them
needs nothing P8 has not got, and P8's part tree will be a nicer selector over
the same keys, not a different set of keys. The ordering argument that stands
is the other one: P9's liveries are designed against P6's fleet, so the
LIVERY half still wants the fleet in front of it. The material half does not.

The arc, one chantier each: G66 the surface field (the coordinate that
replaces a UV unwrap — LANDED); G67 AEROSKIN, the one material — finish table,
per-section tint, the materials panel, glass, the moods reaching the aeroplane
at last, GATE SKINMAT (LANDED; the four constructions now measurably differ,
and a livery set in the editor arrives unchanged on the aeroplane that flies).
Still owed from G67: the detail sheets are procedural rather than the agreed
~25 MB of curated CC0, only the CAGE is AEROSKIN (the wing/gear/engine layers
still wear G38's grey), and the per-section finish and tint live in a pref
rather than in the spec — ruling 4 wants them in a `spec.finish` block with a
GEN_SPEC_V bump and its migrator before liveried builds are shared.
G68 the structure grammar — LANDED: GEN_BUILD_GRAMMAR beside GEN_MATERIALS,
fasteners and seams and panel lines and oil-canning per construction, from the
real structure in real millimetres, with the analytic masks deciding WHERE and
a mipped stamp supplying the pixels. THE "FOUR MATERIALS LOOK IDENTICAL"
PLAYTEST ITEM IS CLOSED — fabric and alloy now differ 3.5x in measured local
contrast at the same luminance. G68.1 then gave the WING its own field, at the
user's steer ("do the wing spars first"): rib tapes on the stations the mass
model paid for, spars as integer rails, the washed-out leading edge — the
three things the user named as right about the old yellow plane. G68.2 then
did the FIN and STAB — one `finMesh`, both surfaces, because the stab is the
fin laid flat (G23) — with a DECLARED tail rib pitch, since the frame bills no
tail ribs to read. Still owed: rib LACING is not drawn on any surface, the
tail's LE treatment is a chord FRACTION where it should be metres from the
edge, and GEN_ACCESS (hatches, inspection rings, fuel caps) is designed and
unwritten.
G68.3 put the leading-edge treatment in METRES rather than chord fraction.
G69 the decals — LANDED: the surface field IS the projection, so a marking is
placed in metres and holds its proportions on any shape (G4.5's own conclusion,
generalised); the registration reads correctly on both flanks, an atlas with
dilated pages carries it and any image the player loads, and the panel edits
it. Still owed from G69: a decal is on BOTH sides or neither. Its other two
debts are PAID: placement moved into the spec at G105, and THE CRAFT-SPACE
ORTHOGRAPHIC PROJECTOR LANDED AS G113 — two channels (fuselage+cowl+tail, and
wing+slabs), three modes per decal (field, side, plan), a surface CLASS in
place of the old is-it-a-flying-surface flag, and the decal loop out of the
field's own `#if` so an analytic surface can carry a marking at all. THE
FINDING WORTH CARRYING: `uFieldM` is NOT a common frame — measured, the cowl is
in metres and the fin in cage units — so the projector reads a shared
`uCraftInv`/`vCraftPos` instead of `vObjPos`, which also retired `uSideAxis`
(declared, defaulted and passed by no caller since G69). G113.1 then gave the MARKING its own controls (independent width with a
lock, and a face table) — and found that every registration since G69 has
been drawn at a weight this build does not vendor, so the bold the whole
fleet wears is SYNTHESISED; GATE SKINMAT now holds every face against
style.css's own @font-face rules. The user's "colour to the cone" was
LANDED BY ANOTHER SESSION as G111. G113.3 CLOSED ITEM 21 and found the real defect under it: the tail's chord
coordinate was NEGATIVE on a fifth of the stabiliser (348 of 1728 vertices)
and 6.7 % of the fin, because `finField` interpolates the leading edge between
BIN CENTRES and a vertex that IS its bin's maximum gets an `le` behind itself.
`max(sC, 0)` then saturated the wash-out band in a shape following the
TRIANGULATION — the user's "completely irregular". One dilation pass over the
binned envelope makes it provably non-negative (residual now 0.1 microns,
float32 noise). The microsurface is box-mapped off a craft-space plane the
panel's OWN NORMALS choose, so a canted V-tail resolves itself without the code
knowing V-tails exist; the structure grammar, the wash-out and the field-mode
decals all keep the field, because they are different consumers of one
attribute. All three of its owed items are PAID by G113.4 below.
G113.2 THE GLAZING — LANDED (2026-08-31, the review's chantier 9). Glass had
a DEAD ROW: the panel printed the word "glass" and the only user-facing glass
control in the game was the view alpha. Six dials now (clarity, scratches,
wiper arc, edge grime, reflections, rainbow) plus the per-pane colour well
aeroGlass has accepted since G67, one set for every pane because a windscreen
and a skylight are the same glass cut twice. WHAT r128 ALLOWS SHAPED IT: no
`ior`, no `iridescence`, no `thickness` on this path, so clarity and reflection
are material fields and the rest is analytic — the scratch sheet is PROCEDURAL
against the user's own "you can probably find one online", because a download
would be the only bitmap in a system whose every other sheet is baked.
THE MEASUREMENT THAT SAVED IT: modulating `roughnessFactor` — which is what "a
scratch roughness map" literally means — was INVISIBLE (zero changed pixels) on
a transmission-0.92/clearcoat-1.0 pane. A scratch is GEOMETRY and must tilt the
CLEARCOAT normal; measured after, 6.01 % of pixels change at the top of the
dial. Edge grime is measured off the PANE'S OWN extent, not a screen-space edge
detect — dirt that moves when the camera does is not dirt. The wear it left
owed is PAID by G113.4 below.


G113.4 THE ENGINE, THE INK, THE FRAME AND THE GLAZING'S YEARS — LANDED
(2026-08-31), closing the twenty-one-item review. FOUR ITEMS, three of them
debts this arc wrote down against itself and one the user added: "get the
material and color picker from the engine (block and covers should be
pickable)". THE ENGINE IS NOW PAINTABLE IN THREE GROUPS — engBlock (crankcase,
ridge, sump, accessory case, pads), engJug (barrels, fins, heads), engCover
(the rocker covers, the accent) — inheriting down the chain, with `matOf`
consulting the livery section BEFORE AERO_HARD but seeding it with the
hardware finish, so a crankcase left alone is still cast aluminium and a
crankcase picked is cast aluminium in your colour. G104's rule ("a tyre is
rubber and a chromed oleo is chrome") was not overturned: it was given its
declared exception, because a tyre is rubber for what it DOES and a crankcase
is grey because somebody left it grey. The other 25 names in AERO_HARD.eng are
untouched. AND THE PART TABLE HAD TO CLAIM THEM, which is a separate thing and was the
last gap: the sections resolved, painted and persisted while selecting Engine
in the livery view still showed the no-finish note, because `renderFinish`
builds a part's rows from its `sections` list and `engine` had none — all
fifteen rows fell into the root's UNCLAIMED bucket. That bucket is a
deliberate safety net and nothing was lost, but a control reached through a
catch-all on another part HAS NOT BEEN PUT ANYWHERE. GATE PARTS was green
throughout (its invariant is "every row claimed exactly once", not "claimed by
the RIGHT part") and so was the spec round trip; only opening the tree and
selecting Engine showed it. Now asserted by name, negative-verified.
THE PROOF WAS THE ROUND TRIP, NOT THE PIXEL — the first probe
sampled the PROPELLER's birch (the prop is on the eng layer too) and reported
no change; what settled it was `spec.finish.sections -> { engBlock: { tint:
13378048 } }`, i.e. the paint survives a save, which no screenshot shows.
THE REGISTRATION HAS ITS OWN INK, and `null` is the default because null means
INHERIT — an untouched aeroplane still wears spec.paint.trim with a white
outline, so the panel and the legacy sheet cannot disagree.
A MODE CHANGE NO LONGER MOVES THE MARKING, and the plan for it was WRONG:
there is no firewall offset to plumb, because sL/sC are ARC LENGTHS and craft
space is Cartesian — measured, the implied offset spread 2.32 m along and
1.25 m up over ONE aeroplane. So `decReframe` re-reads rather than converts:
the vertex nearest the marking in the old frame, reported in the new one.
Measured live, field 2.10/0.29 becomes box -0.80/0.27 — the numbers change
because the frames differ and the marking stays put.
GLASS TAKES ITS YEARS at last, closing G70's own gap where it was named: the
condition ADDS to the builder's dials (scratch + wear*0.55, grime + wear*0.70)
rather than replacing them, because the dials are the floor an aeroplane
leaves the factory with and the years are what happens after. Tint, reflection,
rainbow and clarity take no wear and the gate asserts they do not — those are
choices, and years do not change what colour a pane was tinted.
GATE SKINMAT +13 assertions, NEGATIVE-VERIFIED TWICE: twelve synthetic probes
all caught, and then four REAL mutations of the real files (hardware table
hoisted above the section, ink defaulted to a colour, one projection row
unwired, glass wear made to replace instead of add) — 4/4 red with the right
message, all sources restored byte-for-byte and asserted so.
STILL WORTH NAMING, neither a defect: the engine's paint is invisible under a
closed cowl and the panel does not say so; and `decReframe` snaps to the
NEAREST vertex, so it is exact only where the mesh is dense — a tolerance of a
centimetre or two on a coarse panel, which is the right trade against a
conversion that cannot exist.

G124 THE COWL GETS OUT OF THE WAY — LANDED (2026-08-31; user: "when editing
the livery of the engine, the cowl should automatically be set to transparent,
or almost"). G113.4 closed its own entry naming this exact complaint — the
engine's paint is invisible under a closed cowl — and the user arrived at it
from the other side. NOTHING NEW WAS BUILT, which is the point: `cowl α` is
G29's own dial ("see the engine through the shell") and the ghost DRIVES it
rather than adding a second way to fade a cowl, because two controls for one
look is the failure UI-MODEL §3 exists to prevent. Trigger is the livery view
+ the engine + a cowl that exists; NOT the structure view, where the cowl's fit
round the engine is half of what you are judging. It is a VIEW change and
touches no spec — and the join already pins the row for flight (VIEW_STATE
`{ row: 'cowl α', to: 1 }`), written three arcs ago for the x-ray knobs and
covering this for free. TWO JUDGEMENT CALLS, BOTH TOWARDS THE BUILDER, neither
in the ask: if they move the dial while the ghost holds it, it is THEIRS (only
the value the ghost wrote is taken back — verified, dragged to 0.60 and it
survived); and if they are already more see-through than the ghost would make
them, it does NOTHING at all (verified at 0.10, untouched entering and
leaving). The slider is moved with the value, or the panel disagrees with
itself. THE ONE REAL COST: `cowlA` is read BEFORE the shell is built
(`cowlMats(cA)` — it decides WHICH material this is, G29's deliberate choice),
so selecting the engine in the livery view triggers a FULL REBUILD, and so
does leaving it. That is the honest price of driving the existing dial.
GATE UISMOKE gained the contract (7 assertions, modelled on the interior
view's) because the interesting failures are all in the halves that are NOT
the ghost: the layer must read the dial, the rail must keep offering it, the
join must reset it, the slider must not lie. Every needle is proven to be CODE
by comment-stripping all three sources — 7/7 — because the block's own
comments name `cowl α` and VIEW_STATE. NEGATIVE-VERIFIED 7/7, EACH WITH ITS
OWN MESSAGE.
THE MISTAKE WORTH CARRYING: the first mutation harness rewrote src/ in a loop,
a restore write failed with EUNKNOWN (a Windows lock, almost certainly the dev
server's watcher), and it left editor.js mutated AND index.html rebuilt from
it. Every later probe then went "RED" and six reds in a row looked exactly
like a pass — until it was noticed that all six carried the SAME message
rather than their own. A PROBE THAT FAILS FOR SOMEBODY ELSE'S REASON HAS NOT
BEEN VERIFIED. A mutation harness in a shared tree should break the BUILT
ARTIFACT (what the gate reads, and disposable) rather than sources under a
live watcher, and must restore in a finally with a retrying write.

G70 the interior, the technical parts and the wear — LANDED: the gear, the
engine, the cowl, the propeller and the cabin leave G38's understudy grey for
AEROSKIN through `AERO_HARD` (65 material names over 4 layers, read out of the
four layers' own tables), eight new finishes for the hardware vocabulary, and
ONE CONDITION DIAL whose every placement is derived — grime in the
microsurface, chalking on what faces the sun, metal dulling, and streaks that
run from the MEASURED exhaust exit and the mains' own contact. Still owed from
G70: glass takes no wear, the streaks are on the fielded surfaces only, there
is no per-part condition, and the wing's diagnostic part colours (G31's purple
tip, orange ailerons) survive into the material view where they read as a
mistake rather than as a part list.
G109 the per-part livery, phase A (2026-08-31) — LANDED: the flying surfaces
are SECTIONS now (AERO_SEC in aeroskin.js: wingSkin/wingTip/wingAil/wingFlap,
finSkin/finRud, stabSkin/stabElev), each with the full finish/tint/three-dials
row set in the livery view under its own part, and each FOLLOWING its parent —
control surfaces the wing, the wing and the tail the fuselage — through a pure
resolver (`aeroSecResolve`) the gate exercises directly. No new machinery: the
five override maps, the pref, `spec.finish.sections` and the join carry the
new names exactly as they carried the cage's (NO GEN_SPEC_V bump — the G105
ruling, for the same reason). The join's colour-only fallback bucket gained
the finish identity, or a carbon fin and a green-ply stab wearing one tint
would merge irreversibly. G70's leaked diagnostic colours are DELETED,
answered by real per-part rows. PHASE B LANDED AS G110 the same day: per-part
CONSTRUCTION (wgCons/finCons/stCons, structure tab, 0 = 'as the aeroplane'),
feeding grammar AND the auto-finish bottom-out — carbon fins on a wooden
fuselage measured on the meshes themselves (fin composite/carbon beside wing
ply/wood in one build); mass/price do not follow it yet, declared. PHASE C
LANDED AS G111: seven hardware sections (strut — joining AEROSKIN at last —
spat, gearLeg, prop, spinner-follows-prop, cowlSkin, accPaint), the
PINNED-FIN rule (an ancestor's finish never reaches painted hardware, its
colour does) and `tint0` (the layer's legacy palette as the walk's last word
before the finish base). PHASE D LANDED AS G112, closing the arc: seatTrim
(cushion+pipe in the M getter, following nobody) and one suit tint per dummy
(dummy2 follows dummy1; the figures are named edDum1/edDum2; editor.js
untouched). THE ARC IS CLOSED — every part the user listed has a livery row
under its own part or a declared reason not to. G114 then closed three of
its four debts in one sweep: the dials/ribM/wearK CROSS THE JOIN now (they
never did, cage included, since G105), the crew NAMES its furniture
(edSeat/edCtl/edConsole + HIT_NAME), and PER-PART CONDITION landed as a
fourth walked dial (`wear x` — G70's owed item). THE LAST DEBT LANDED AS
G116 on the user's own ruling ("carbon should cost"): wgCons/finCons/stCons
are PHYSICS-BEARING rows now — additive spec fields through the join, the
ledger's section marker doubling as the billing-material switch in
genLattice, mass/CG/price moving per the material table. "G117 WYSIWYG"
then finished it on the user's next ruling: STIFFNESS AND DAMPING follow
the part too — safe exactly because G116's mass move made a mixed build's
wing k/m ratio equal the all-carbon corner the FLEX matrix already flies;
the BRACING keeps the aeroplane's material by section (a strut is a steel
tube whatever the wing it holds). Measured live: aluminium wing
60.1 -> 72.0 kg and 2122 -> 4867 credits; carbon fin 12.1 -> 11.5 kg; and
a carbon-wing/carbon-fin/alloy-stab build FLEW A FULL CIRCUIT under the
test pilot (completed, 288.6 s vs stock 294.2) with per-material k/c live
in the solver. (G117 is a double heading again — this arc's WYSIWYG and
the lamps chantier both hold it, both with code footprints, so neither
moves; cite by name.)
HANDOVER G109-G114 + G116 are canonical. (G115 WAS a double heading and is
not one any more: the second of the two — the lamps/bulkhead/door/nudges
chantier — renumbered itself to G117 on finding that the SIM-DOES-NOT-LIE
session had baked G115 into a dozen `src/core` comments while it had the
number only in documents. When two sessions collide in flight, the one with
the cheaper footprint moves.)
G67.1 the default cage at boot — LANDED, and larger than it looked: the game
now OPENS on the cage build, in the hangar, with the editor open and committed,
so the aeroplane you see first is the one you are building; AEROSKIN is the
default view rather than the section palette; and `buildModel('gen')` no longer
falls back to the old generated skin, which is what actually took it off the
flight path. THE OLD SKIN IS NOT DELETED, and the reason is worth carrying:
`_cage_wing.js` builds the WING of every cage build out of `genSkin`, so the
wing was lifted out of it first — `genWingInto`/`genWing`, verbatim, with GATE
WINGSPLIT freezing thirteen wings as digests to prove the move changed nothing
— and the workshop's wing and engine were re-homed with it (the engine on the
bench is the engine bench's own engine now). What still holds the file alive is
GATE GEN, which asserts on the old aeroplane's fuselage, tail, cowl, prop and
gear MESHES; deleting it means promoting the cage's own checkers
(`_cowl_check`, `_fin_check`, `_eng_mesh_check`, `_cage_fit`, `_join_check`,
none of them in the battery) rather than accepting a quietly smaller gate.
G67.2 CLOSED IT (2026-08-30): `63_gen_skin.js` is `63_gen_wing.js`, genSkin is
deleted (flight_core 658 -> 538 KB), and the coverage moved rather than
vanished — `_cage_fit`, `_fin_check`, `_cowl_check`, `_eng_mesh_check` and
`_join_check` joined the battery as CAGEFIT/FIN/COWL/ENGMESH/JOIN (five
checkers that had existed for chantiers and were only ever run by hand). GATE
GEN kept 70 of its 75 checks; the five that went are each recorded where they
stood. G67.3 THEN CLOSED THE ONE GAP IT DECLARED: GATE GEAR (`tools/_gear_check.js`)
runs the undercarriage headless on a THREE stub and asserts the three leg
families are three different drawings — the check GATE GEN lost — plus the
wheel turning on its own, the tyre reading as a circle, the leg mirroring
vertex for vertex, the spat clearing the ground and the castor filling its own
bags. TWO LESSONS IN IT: a dodecagon tyre PASSED the first roundness check
(a revolve puts every vertex on the circle, so faceting is a SAGITTA and not a
radial spread), and the wheel deliberately does not mirror — a valve stem and a
bolt circle are fitted at an arbitrary clock angle, so the structure is checked
vertex-for-vertex and the wheel as a volume.
THE INSTRUMENT WORTH REUSING: diff a gate's CHECK NAMES before and after
surgery. A deleted assertion leaves no trace, and this one immediately caught a
frame-side gear check deleted by accident because it shared a comment header
with its skin-side neighbour.
G94-G98 CLOSED THE INTERIOR AND LIT THE AEROPLANE (2026-08-30). G94 the
instrument panel, the floorboards and the cowl's own detail — the panel's
rows are laid out first and then CENTRED on the pilot, and its height comes
from a MEASURED coaming lip rather than from the throttle's mounting height.
G95 the part highlight became an OUTLINE in a noticeable colour, at the user's
ask, with the mode kept as an option so the default can be chosen later.
G96 THE AEROPLANE HAS LIGHTS: eight of them, in the user's own two groups
(outside = physical switches, inside = potentiometers), every one owning
emitting geometry per the user's rule "there should be no light without
emitting geometry", every position measured off the thing it is mounted on,
levers and knobs on the panel, and exactly TWO real `THREE.Light`s because r128
is a forward renderer and the hangar already runs seven. G97 the fin and stab's
dendritic shading — the tail's ribs were on the object-space path where the
rail coordinate jumps between panels; `ribM` puts them on the metric one.
G98 THE LAMP BAY became a real fitting: the wing is CUT along its own loft
rows, the hole is closed by an interior cage the user drew himself (a quad and
two ribs on the aerofoil profile, all three from the cut's own boundary), the
lamp is a solid of revolution, and it is FITTED to the interpolated section at
its own station so it cannot protrude — GATE BAY asserts all three, each
against the defect that produced it. Four frames-and-measurement lessons in it,
all in the HANDOVER entry: a bench with no transform cannot catch a frame bug;
a bay is ONE LOFT CELL, so it has no mid-span; DIHEDRAL makes the intersection
of two stations a section neither of them has; and a floor on a derived
quantity is a way of ignoring the measurement that was taken.
G99 THE BEACON TURNS: a real mirror inside the dome, and the flash computed
against the camera rather than animated — a clock-only pulse would flash at the
same instant for every observer, which is a strobe and not a beacon. The rate
IS the rotation rate, so there is no second number to disagree with the first.
GATE BEACON's AIM assertion is what tells the two apart.
G100 THE FITTINGS FIT THE SURFACE: the beacon was a metre forward because
`cageLayer:fin` carries the STABILISER (G96's "the group is not only the wing",
now on the tail) and because a fin tip is SWEPT, so a fairing laid at the apex
floats over the forward half of its own edge; the black square through every
lamp was an axis-aligned gasket plate on a surface that does not lie in the
world's axes; and the discs on blades became TEARDROP FAIRINGS sized from the
surface's own thickness — a straddling base for the beacon (an anti-collision
light cannot be let into a fin and still be seen), and a tip fairing whose NOSE
IS THE LENS for the nav lights.
STILL OWED from the lighting arc: the instrument light (the user's own
"later"), and nothing switches on at night by itself.

The material library and the wall-wardrobe prune ride with G66/G67.

GEN_ACCESS — THE FITTINGS — OPENED 2026-08-30, arc numbers RESERVED G81-G85
(claimed in HANDOVER before starting, per the G76-G80 note's own protocol).
This is the "technical parts" third of G70 and it is not a new design: the
G68 gap list already declares it — "a declared table of REQUIREMENTS, each
naming what it serves and a placement rule, resolved against built geometry
and SNAPPED to structure" — with the acceptance test stated, "you can point
at any hatch and say what is behind it, and no tank means no fuel cap".
What the arc adds is REAL GEOMETRY, because a filler cap and a pitot mast
stand off the skin and the grammar can only draw what is flush.
DERIVED, NEVER PLACED: `spec.fuel.tank` decides where the cap goes,
`spec.systems.fit` decides how many aerials, `spec.fuselage.material`
decides whether a panel laces, screws or doubles. That is the wear ruling
("a hand-placed smudge is decoration, and decoration does not survive the
aeroplane changing shape under it") applied to the thing it was written
about. THE MOUNT ALREADY EXISTS: `fitFrame`/`fitPad` in _gear_gen.js:606
answer point-normal-and-bolted-pad on the skin, proven on the whole
undercarriage; the surface field's integer st/lv choose the station, the
contract mounts the part. G81 the site · G82 the table · G83 the body's
fittings · G84 the wing and the cowl · G85 it was already saved.

G81-G84 LANDED (uncommitted). 19 declared requirements, 14 forms, three
skins each with its own placer — the fuselage a mesh with a field in cage
units, the wing the SAME FIELD in metres meaning span/chord/rib/spar, the
cowl an analytic surface evaluated rather than searched. GATE FIT is core
tier: 354 fittings measured over 6 shapes x 5 specifications, eleven
negative probes all caught. Measured in the page: 14 fittings on the stock
aeroplane, 18 with wing tanks + IFR + a cargo bay, and SIX on a minimal
day-VFR machine with no tank — which is the acceptance test doing its job.
G85 CLOSED THE ARC BY CORRECTING IT. The gap G83 and G84 both declared —
"spec.access does not exist, the switches live in the panel not the save" —
was WRONG: `cageToSpec` passes every unrecognised key straight into
`spec.cage` and `cageFromSpec` reads it back, which is how all eight cage
layers persist theirs. A private `spec.access` would have singled this one
out from seven; a GEN_SPEC_V bump would have been dishonest (nothing about
the shape changed); and a migrator is forbidden by the version note's own
last line. What was owed was a TEST — what an aeroplane wears is saved
because what it IS is saved — so GATE FIT now asserts the equipment and the
switches both survive a round trip, and that the aeroplane asks for the same
fittings on both sides of it. Thirteen negative probes.

STILL OPEN: cross-layer clearance (the gate checks fittings against their own
skin and each other, not against the gear, engine or tail — the tail tie-down
buried inside the tailwheel castor was found by counting pixels, and nothing
stops the next one); nothing on the fin or stabiliser; a biplane's lower wing;
~~and ONE NAMED BOUNDARY DEFECT — an aeroplane that IS the template still writes
sixteen layer keys into `spec.cage`~~ — CLOSED at G106 (2026-08-30, the quality
review's P-1): "sixteen" had grown to **518 keys, ~470 of them frozen layer
defaults**, before the boundary learned to read the declaration that existed
all along — `CAGE_PAGE.defaults`, THE DEFAULT AEROPLANE — lazily, with the
baseline split (cage keys vs the template, layer keys vs the default
aeroplane). The default bake is 42 keys now, all genuine cage deviations, and
GATE BUILD holds it with a negative probe plus a frozen fat-vintage fixture
(`tools/fixtures/`) that must load forever. The same chantier gave
`GEN_SPEC_V` its first reader: `GEN_MIGRATORS`/`genMigrateSpec`, the empty,
exercised walk the energy arc's v6 plugs into.

THE LIFT-STRUT FOOT — LANDED 2026-08-30, arc numbers RESERVED G86-G88
(claimed in HANDOVER before starting, same protocol). User, with both feet
circled on a screenshot: the struts were drawn from `63_gen_skin`'s beams and
stopped at truss NODES with no fitting at all — in mid-air beside the belly at
one end and buried in the covering at the other. Now every one of the four
ends is a bolted doubler with a clevis on it: the fuselage foot through the
undercarriage's own `fitFrame`/`fitPad` (the user named the method), the wing
fitting through the same object on the wing's own surface, under a high wing
and over a low one. Two editor rows, `strut fore/aft` (which moves BOTH ends,
so the strut stays straight) and `foot lateral` (arc length round the section),
BOUNDED by the wing's structural chord — `strutBand`, 6 % clear of the leading
edge and 4 % clear of the aileron hinge — so the drawn ends can never leave
the beams they stand for. GATE STRUT, core tier.
THE FOOT DID NOT ACTUALLY TOUCH ITS PLATE UNTIL G108 (2026-08-31, the user:
"there is a small gap between the end of the struts and the metal plate they
attach to, on both ends"). Measured on the drawn geometry: the clevis ear
spanned 38.9-71.0 mm off a 7 mm doubler at the fuselage and 21.9-53.7 mm off a
5 mm one at the wing — thirty-two and seventeen millimetres of daylight, at all
four ends. `lug`'s tang does not follow the vector its signature calls `up`; it
follows the BINORMAL, so handing it the surface normal threw both ears sideways
at pin height and `stand * 0.92` bought nothing. One exported line
(`strutClevisUp`) and the ears now root 4.4 / 3.0 mm off the skin, inside their
plates. `lug` untouched — the undercarriage is drawn with it. GATE STRUT gained
a headless measurement of the DRAWN ear (GATE GEAR's stub trick), and its
negative probe is the bug itself.

NO NEW PHYSICS, on the user's ruling ("prefer constraining the visuals to the
existing physics rather than adding new physics now"): the divergence between
each drawn wing fitting and its beam is REPORTED every build, and is 3 mm at
zero trim. STILL OPEN, and it is where the user's "if the attachment points
are significantly shifted, it should be reflected in the physics" points:
`61_gen_frame` roots both members of a side at ONE node, so the two clevises
are 116 mm apart where a real pair is much further; giving them their own
stations is a FRAME chantier. Also open: no jury struts, no fairing where a
strut enters the wing.
THE LESSON THIS ARC PAID FOR, three times: a frame that is nearly right draws
a picture that is nearly right. `toCage` undoes genSkin's rest pose and is for
SKIN vertices; a node sent through it tilts by the whole rest pitch. The
airframe contract is a SAMPLED surface and missed the drawn skin by 3.5 mm,
enough to cut a doubler in half. And the ray that finds the wing must be cast
ACROSS it, not along the strut, or a 28-degree strut walks its fitting 153 mm
inboard of the spar. All three were found by LOOKING, and all three would have
survived any gate this project has.

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
the P2 reservations (flaps/slats/VGs with physics to measure them). REYNOLDS
NUMBER lands here and nowhere earlier: F5 gave the air a density and
deliberately left Cd0 and CLmax fixed against it, which is a real omission
and exactly the kind the ledger is built to price. Far backlog behind it:
STOL competition mode, the jet module + SubSonex, the gliders' atmosphere
(thermals/ridge — the wind(x,y,z,t) plumbing is where they plug in, and F5
made that argument load-bearing instead of decorative).

## FLOATING CHANTIERS (pull forward at will)

**F1 — the reference overlay.** — PULLED FORWARD, STARTED 2026-08-30, arc
numbers RESERVED G89-G93 (claimed in HANDOVER before starting, per the
G76-G80 note's own protocol), user: "the goal is to recreate an existing
airplane by importing the model in lieu of blueprints".
3D model import instead of blueprints: a GLB
as a ghost in the bench, scale/align, match by eye. The in-repo Cub and C172
are free; more from the same modeller as they come. Display-only, r128 loads
GLBs, deliberately small. Pull it forward the moment matching a real
aeroplane would help — wings (P2) is the likely moment. Blueprints only if a
wanted aeroplane has no model. Imports also join the P6 rack as found
aircraft.

**"MORE FROM THE SAME MODELLER AS THEY COME" ARRIVED — G138, 2026-09-01.**
Seven of helijah's aeroplanes: Jodel D.112, Alpi Pioneer 200, Cessna 195
Businessliner, Aeroprakt A22 Foxbat, Partenavia P.68, Van's RV-8, Cirrus
SR22. Nine presets where there were two, and the set now spans taildragger to
tricycle, rag-and-tube to composite, single to twin. `tools/ref_prep.py` +
`tools/ref_table.py` make a new one a five-line row rather than an afternoon
with a contact sheet. THREE THINGS THIS ENTRY DID NOT ANTICIPATE:
- the licences differ per LISTING (three CC-BY-4.0, four "SKETCHFAB
  Standard"), so only three are published and GATE REF enforces it;
- `sit` is not optional — three of the seven are taildraggers drawn level;
- **the artifact hit its ceiling.** "The reference costs zero new bytes" was
  true of the Cub and the C172 and is not true of these. See G138's last
  section: 97% of `index.html` is base64 binary and it is at 96.5 of a hard
  100 MiB. THE ARTIFACT'S SIZE IS NOW ITS OWN OWED CHANTIER and it blocks the
  next feature that needs a few MB, not just this one.
  **PAID — G149, 2026-09-01.** The artifact went multi-file and every texture
  and mesh became a real file under `media/` (the user: "3d models and
  textures should all get out and into their proper external structure").
  index.html is 3.98 MiB against a mechanical 6 MiB budget (GATE MEDIA), the
  ceiling is gone, all eleven CC-BY references ship, and the four
  "SKETCHFAB Standard" imports were deleted outright rather than held. New
**F0 — propeller effects** (torque, slipstream swirl; P-factor and gyroscopic
later). ASSESSED 2026-09-05 instead of coded, at the user's ruling during the
UltraLight3 pass: `futureDesigns/PROP-EFFECTS-2026-09-05.md`. Felt on one
aeroplane only — the single-engine taildragger's roll (~0.4 of rudder at
rotation); a twin's pairs fly identically same-hand or counter-rotating
until then. Needs a SHAFT SPEED on every registry row first; `sense` per
engine already ships (G194). One gated chantier: torque + swirl + rpm.

  assets cost their own bytes now, not a slice of a shared ceiling.

**AND EIGHT MORE, ALL CC-BY — G142, 2026-09-01.** Diamond DA40, Grob G115,
Stemme S6, Super Guepard 912, Yak-18T, PZL Wilga "Draco", Fokker E.III, Piper
PA-28 Cadet. Sixteen payloads baked, SEVENTEEN presets, and the split view
(`cut: split`) that makes the reference worth having: your right half and
theirs left, meeting on the centreline as one aeroplane. Two of the eight are
in the artifact and five more are correct, licensed, gated and one line from
shipping — **the ceiling, not the aeroplanes, is what stops them.** This is the
second feature in one session to be cut short by it, which is the argument for
taking the size chantier before the next one. Draco has no preset: nobody has
published the dimensions of a one-off, so nothing can hold its scale.

TWO THINGS THE ENTRY ABOVE GOT WRONG, both found by measuring rather than
reading, and they make this cheaper than it looks. THERE IS NO GLB TO LOAD
and r128 does NOT load one — no loader is vendored. The Cub and the C172 are
already BAKED payloads (`MODEL_PA18`/`MODEL_C172`, `src/models/`), already
inlined in the artifact, already decoded by `decodeModel`: the reference
costs zero new bytes and no loader. And it lands in the GAME EDITOR, not the
bench — the editor is the garage screen now (G35/G78), and the benches keep
their accordion (the P8 ruling). Both models measure TRUE SCALE on decode
(PA-18 span 10.713 m, C172 11.00 m), so the size slider is a correction knob
for future imports, not a necessity for these two.

**F2 — naked structures.** The HONEST half LANDED as G172 (2026-09-04):
`skinOn` 0 is `fuselage.covering open` — no covering mass, an open-frame drag
delta, a Covering design tile. The DRESS below is still owed. Door removal and the tube structure dressed to
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

Also open, and the user's own proposal (2026-08-29): ONE panorama graded into
several hours instead of one per hour. Prototyped at G62.1 as a test area
(`tools/sky_grade.py`, `sky_prep.py --lab`, `make_probe.js --sky-lab`) and it
reads — golden, sunset, dusk and night all convince in the real room; only
overcast does not, and cannot, since there are no clouds in a clear-sky source
to reveal. Adopting it shrinks the SOURCES (125 MB of HDR to 26); shrinking the
PAYLOAD as well meant moving the grade into a fragment shader, and G62.2 did:
base.jpg + a per-channel gain map = 1.66 MB for every hour there will ever
be, verified against the offline grade to one 8-bit level. Mounted at
`tools/_sky.html`. The decision to adopt it is still open.

**F5 — the atmosphere.** LANDED 2026-08-30 (HANDOVER G72), pulled forward on
the user's own reading: "our skies are poorly modelled. No air density, no
engine response to lower air density. Probably nothing about temperature
either... we need a very correct flight model. Not the ultimate super accurate
one, but something that does not lie."

The air is a real thing now. `src/core/05_atmos.js` is one constant-lapse-rate
atmosphere in four lines — temperature, pressure, density, speed of sound —
exact at ISA and exact for an offset day, with the only two chosen numbers
being the ones that describe the DAY (sea-level temperature and QNH). It feeds
every dynamic-pressure term, the propwash disc, and the propeller, and the
engine's response falls out of 60_gen_spec's own momentum-theory synthesis
rather than being asserted: a naturally aspirated piston lapses (Gagg-Ferrar),
an electric motor does not, and the difference is one declared `aspiration`
field on the registry row.

The load-bearing half was NOT the density. It was declaring that every V-number
in the project — Vs, VClimb, VCruise, VAppr — is an EQUIVALENT airspeed, which
they all already were and nobody had said. The autopilot flew them as TRUE
airspeeds, which is identical at sea level and stalls the aeroplane at altitude;
the instrument printed "ias" over a true airspeed for the same reason. One
factor of sqrt(sigma) in one place in `40_autopilot.js` fixed both.

The bench earned a DENSITY ALTITUDE test (the same genClimbAt / genTORunAt
measurements, run in different air) and the plaque a "in thin air" section, so
the qualifier that has silently sat on every number the game ever showed — at
ISA, at sea level — is now visible and answerable. Wind grew a vertical
dimension: `refH` makes a wind a SURFACE wind and the column shears above it.

DELIVERED RED, deliberately, on the user's own call. GATE WIND fails one case —
the DC-3's crosswind landing, touchdown drift 0.79 -> -3.67 m/s against a 1.8
bound. It is NOT the density (isolated: density live + autopilot on TAS lands
unchanged) and it is NOT new (HEAD's own physics fails identically on a +0.8%
cruise-speed nudge; the cliff sat 0.5% away). Two stacked pre-existing faults,
both traced: the DC-3's wheel-landing flare balloons when it arrives slightly
hot, and the decrab rudder then sits pinned at its clamp for five seconds while
the aeroplane is CLIMBING, turning the crab into a sideslip. Fixing either is
arrival work on a calibrated fleet and happens WITH the user. The bound was not
relaxed and nothing was tuned. Full writeup in HANDOVER G72.

STILL OPEN, and named rather than implied: that DC-3 arrival; re-anchoring the fleet's wind gates
onto sheared wind (they still fly the uniform column they were calibrated in);
Reynolds number (P12); turbo/supercharging (`aspiration` reserves 'turbo' and
the R-1830 is lapsing like a normally-aspirated engine because of it); the
battery model that would give an electric aeroplane a real ceiling instead of a
refusal to guess; thermals and ridge lift, which are the same `wind(x,y,z,t)`
plug the roadmap has always pointed at.

**F6 — the base aerodrome, as ONE place.** LANDED 2026-08-31 (HANDOVER G123),
pulled forward on the user's own reading: "The 3d models outside the hangar in
build mode are an eye sore ... the real plan is to have the outside airport
correspond ... The assets should be kept in sync in the 2 scenes (only around
the base airport) from now on."

This is the P11 consistency goal G41 recorded and G44 parked — "the honest
destination is the GAME's own scenery seen from the hangar" — taken from the
hangar's end. The defect underneath the eyesore was that the base field existed
THREE times: the `HOME` record in `20_world.js` that the autopilot flies, the
same 1100 x 30 restated as literals in `render_world.js`, and an unrelated
320 x 24 strip pointing out of the garage door. `src/core/25_airfield.js`
collapses them — the runway is DERIVED from the registry record and the site
(paving, buildings, furniture) is declared once for both scenes — and GATE SITE
asserts that nobody goes back to writing their own numbers.

The hangar in the flight world is now the real shell, doors shut, built by the
same `genHangarBuild` the garage runs (`opts.exterior`) rather than a twin, so
taxiing past the shed and standing inside it are one building. The garage's
outdoors is that same aerodrome at door-view quality: a jointed slab with kerbs
and a lead-in line, a taxiway that actually reaches the strip, the strip
crossing the view with its threshold abeam the shed, ten CC0 scanned ground sets
in the editor's own wardrobe, and 7 000 instanced grass tufts.

Still open, and each named in G123: the ROLL-OUT still teleports to
`HOME.spawn` 75 m from the hangar (the site declares a `stand` pose and wires it
to nothing, because `HOME.spawn` is the W10 spawn identity every flying gate
departs from); `APRON` in `app.js` is dead code saying the same thing; the
`Home Field` village drops five procedural houses 50 m behind the shed; and F4's
other half — the outdoors takes the SKY's reflection now, but still the ROOM's
lights.

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
