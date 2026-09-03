# DEBT REGISTER — everything HANDOVER still owes (2026-09-01)

Compiled from HANDOVER.md's own "STILL OPEN / STILL OWED / DEFERRED" sections
(a full sweep of the file, ~26,500 lines), cross-checked against ROADMAP and
the code where a claim looked stale. Items HANDOVER later marks PAID are
dropped; two apparent debts were verified paid in code and are recorded at the
bottom so nobody re-opens them. Each item cites the G entry that owns the full
story.

**HOW THIS RELATES TO THE ROADMAP.** ROADMAP.md's PHASE 1 (the friction pass)
is drawn from §1, §2 and §6 below, and several other items are named inside
the phase that must take them (the seat-billing debt goes with Phase 5's mass
work; the leg-weight debt with Phase 2's Wilga suspension; the lower-wing
fittings with Phase 6's biplane). Everything NOT named in a phase lives here
as a menu — pick from it when a playtest or a nearby chantier makes it cheap.
Nothing here is forgotten; not everything here is scheduled.

## 1 · AWAITING THE USER'S OWN RULING (blocked on nobody else)

- ~~**GATE GEN sweep-30 red (69/70)**~~ — **RULED AND CLOSED, G150,
  2026-09-01.** The user: *"say it's a bad aeroplane."* It was a TIMEOUT, not
  a crash (SM 75.1 %, TO 1801 m, still INBOUND at the harness's 600 s bound);
  the cause is BALANCE, not planform; and the player can reach it because
  `tipX` clamps to the same envelope the retired sweep slider had. The check
  is replaced by four — the band that must fly still flies, and the extreme
  must never diverge, must reach a bounded verdict, and must say why if it
  does not complete. **Under the TEST PILOT it actually completes** (568 s),
  which the donor AP did not — so half the six-chantier red was the donor's
  rigidity. ONE THING OWED FROM THE RULING: the balance advisory (ROADMAP
  Phase 2 item 10) — nothing yet says "bad aeroplane" in words.
- **GATE WIND `W-DC3`** — the DC-3 crosswind touchdown drift, delivered red on
  purpose at G72. Two stacked pre-existing faults (ballooning wheel-landing
  flare, decrab rudder pinned while climbing); fixing either is arrival work on
  a calibrated fleet, WITH the user.
- **Window recess as default** — G118 took the blocker from 176 red to 22; the
  22 are genuine skin, so the reveal must move the sL/sC FIELD (a `cageWindows`
  vertex-field chantier). Separately: should it even be the default?
- **The `Home Field` village** — five procedural houses 50 m behind the shed,
  inside no exclusion zone (G123). Does the village belong there?
- **The root's name** — renamed "My Plane" at G108, contradicting the standing
  instruction ("Build Plane / Reference plane / Hangar / maybe world").
- **`#edName` vs the ribbon** — two name displays for one meaning (G129); fold
  or retire one.
- **Derived selectors** — nose-configuration and seating-starter now reachable
  only from root selection (G127); fold or retire.
- **Exterior-only reference bakes** — 11.67 vs 21.74 MB measured, per-row
  field, not taken (G142). Post-G149 the pressure is off; still the user's call.
- **Ref textures (`tex='copy'`)** — affordable since G149; per-aeroplane call.
- **Archetype role-targets** — printed, not judged; honest gaps recorded
  (Cub-alike TORun 442 m vs bush 180; electric trainer Vs 20.2 vs 15) (G127).
  The review of targets is P5/P6's opening move.
- **Tricycle stance** — gearLayout first-cut values deserve the user's eye on
  the stand (G127).
- **Day-cycle adoption** — the graded-panorama prototype (G62.1/G62.2,
  1.66 MB for every hour) reads well for all but overcast; adopting it is
  still an open decision (F4).

## 2 · THE PLAYER WILL TRIP ON THESE (friction in the live loop)

- ~~**The roll-out teleport**~~ — **PAID, G151, 2026-09-01.** The aeroplane
  starts on the declared stand and taxis out through the fence gate; the spawn
  identity never moved, because the taxi ENDS on it. Three measured failures
  on the way: LINEUP cannot cross an apron (324 s), an invented straight line
  drives through the fence, and the stand was parked facing the hangar so the
  first act was a 67° turn from rest with the rudder pinned at its clamp.
- **The taxi governor is thrust-limited** — NEW, found by G151. ~1.4 m/s where
  a real taxi is 4-5: throttle sits at 0.45 against its own 0.49 cap while the
  aeroplane accelerates at 0.015 m/s². `taxiFF` derives break-even as
  `CRR*m*g/T0`, which assumes thrust is LINEAR in throttle; it is not, so
  "0.27 of authority above break-even" is far less margin than it reads.
  Pre-existing (GATE XCTY5's backtrack crawls identically behind a 1500 s
  budget). Raising the cap moves every taxi in the battery — a controller
  decision to take WITH the fleet watching.
- **A standstill turn is the one thing the taxi cannot do** — also G151, and
  the same root. Full rudder at zero speed scrubs the tyres, which eats the
  thrust margin, which prevents the speed the turn rate needs. Worked around
  at HOME by parking the aeroplane pointing the way out; any future site with
  a stand must do the same, and GATE SITE now asserts it.
- **Vne and sink-rate warns** — owed, not faked (G141): they need a Vne
  declared on the plaque first. Only the stall warn is real.
- **No `fuel used` on the arrival card** — nothing burns fuel; `mFuel` is a
  mass, not a rate (G141). This IS the energy arc's declared next chantier.
- **The interior is dark** with cabin lights off, and bare beyond the crew
  layer's seats, panel and controls (G108).
- **Diagnostic colours on a finished aeroplane** — GEN_ACCESS fittings and
  G31's purple wingtip read as cyan/magenta debug (G108, G70's gap list).
- **Glass takes no wear** — the condition dial does not reach the glazing;
  wants a `wearM`-style multiplier per pane (G113.2).
- **The registration's colour** has no row of its own — still
  `spec.paint.trim` + white outline; wants reconciling with garage.js's
  legacy sheet (G113.1).
- **Reference preset lands silently** a beat after selection on a slow link —
  loading affordance owed (G149).
- **Pitch-black mood, full-strength glints** — the glass exemption wants a
  FLOOR on the glass factor (G129).
- **Nothing switches on at night by itself**; the instrument light is still
  the user's own "later" (G96). One lens spans both wings, so the two sides
  cannot be switched independently (G96).
- **DESIGN tab** leaves `reset part` / `expert rows` pills visible but inert
  for tiles (G129).

## 3 · SIM HONESTY (each one a lie the plaque or the flight tells)

- **The seat you MOVE is not the seat that is BILLED** — `seatX/Y/Pitch`
  reach the crew layer and stop; occupants bill at a frame index on the
  bottom longerons, so no CG height and no CG shift from sliding a seat
  (G119). Fixing it re-baselines the fourteen ENERGYBASE aeroplanes — take
  WITH the energy arc.
- **The donor AP's flare EAS/groundspeed mix** and the AP-retunes-itself
  masking of bad CG — both move the fleet; WITH the user (G115, G107).
- **Fleet wind gates still fly the uniform column** they were calibrated in,
  not the sheared wind F5 built (G72).
- **`aspiration: 'turbo'` reserved and unread** — the R-1830 lapses like a
  normally-aspirated engine (G72).
- **No battery model** — an electric aeroplane has a refusal to guess instead
  of a real ceiling (G72).
- **Interference drag** — wheel/leg junction; `gear.track` and camber unread
  by the drag model. Named the next physical lever (G133).
- **No trim** — `sim.ctl` has none; the solver holds attitude on the elevator
  directly; the trace's trim channel is owed to a solver that grows one
  (G141.2).
- **Reynolds number** — P12 by ruling, unchanged (G115).
- **intCons → fuselage.material** — the headline gap of the slider-physics
  audit (~550 rows censused; asterisk marking of physics-bearing rows also
  owed). Canonical: SLIDER-PHYSICS-AUDIT-2026-09-01.md.

- ~~**AN INLINE ENGINE IS DRAWN SIDEWAYS**~~ — **PAID, G163 (2026-09-03).**
  The user's diagnosis was right: "I had mistakenly asked for it to be rotated,
  and the table hasn't." Drawn 0.110 × 0.230 now against an envelope of
  0.139 × 0.386, and across nineteen engine fixtures only the two in-line rows
  changed a vertex. **THE ELEVEN ARTERIES DID NOT NEED RE-ROUTING** — they were
  already written in the cylinder's own frame, silently, and writing that frame
  down was the whole of it. What DID need moving was the case furniture: the
  oil filler, the coolant pump boss and the radiator all sat on the case's +y
  face, free air on a boxer and where an upright in-line's barrels stand.
  **AND THE HARDCODE LIVED TWICE** — `_eng_mesh_check.js` carried its own copy,
  so correcting the drawing made the gate test every lead against a capsule
  lying on its side. GATE ENGMESH now asserts the drawn engine stands the way
  its envelope says, which is the check whose absence let this run a fortnight.
  **AND THE ORIENTATION ROW LANDED THE SAME DAY — G164.** `cylinders point`
  (down/up/left/right) was one table row, exactly as G163 predicted: the
  envelope is measured off those angles and the cowl is built on the envelope.
  Three aims were free; DOWN found an aeroplane fact — the sump, carburettor
  and airbox hang from the one crankcase face an inverted bank occupies, which
  is why a Gipsy Major carries its induction on top. The exhaust outlet's four
  directions and the bank's are ONE table now. STILL OWED: the small in-lines
  (a Walter Mikron), which G157 held back only because they would have been
  drawn sideways.
  THE ORIGINAL ENTRY, for the record:

- ~~**AN INLINE ENGINE IS DRAWN SIDEWAYS**~~ — found by G157 while trying to
  add the user's in-line orientation row. `ENG_ARCH.inline.angles` returns 0
  (cylinders up, the convention that makes a boxer ±90) while `_eng_mesh.js`
  hardcodes `Math.PI / 2`, so the envelope an inline publishes is a quarter
  turn from the engine drawn. Measured on an inline twin: drawn 0.279 × 0.109,
  envelope 0.139 × 0.386; the flat control agrees perfectly, so only inline is
  wrong. THE TABLE IS RIGHT (a Gipsy Major, a Walter Mikron and a Rotax 582 all
  stand their cylinders vertically, and both `_eng_check` and GATE COWL assert
  it) — only the drawing is wrong, and the cowl is built around that envelope.
  Fixing the drawing breaks eleven arteries: the inline exhaust, plug leads and
  oil filler are routed as `c.sx * <radius>` and assume the cylinder lies along
  x. **Blocks the user's "in-line engine choice up/down/left/right", which is
  one line once the routing follows the cylinder.** Wants the user's eye on the
  drawn engine.

## 4 · UNDERCARRIAGE & STRUCTURE FOLLOW-UPS

- **Per-member two-end leg weights** — the single root→axle projection cannot
  pin a second airframe anchor (shock top, link rear V foot, oleo drag-brace
  top); its own chantier (G148).
- **The spat rides a linear ramp at ~half the wheel's travel** (G133's
  approximation, still standing at G148); a translate-only axle binding for
  the spat is its own join chantier (G133).
- **No unsprung node besides the axle** — the torque scissor's knee follows
  nothing (G148).
- **The empty ramp band** (`zRoot + 0.06` vs `zs[0] = zRoot`) — moving the
  gate inboard needs the G58.1 cabin-sidewall trap re-verified (G145).
- **Strut FITTINGS ride colour-keyed groups** under the wing-box law while
  the tube takes the two-end lerp — can diverge under load (G145).
- **`iStrut` findIndex −1 silently becomes station 0** — latent
  (`61_gen_frame.js:459`, G145).
- **GATE FLEX has no in-plane (drag-wise) load case** (G145).
- **The lift-strut pair roots at ONE frame node** — 116 mm apart where a real
  pair is far more; own stations = a FRAME chantier (G86-88). No jury struts,
  no wing-entry fairing.

## 5 · FITTINGS, GEOMETRY, DECALS

- **Cross-layer clearance** — GATE FIT checks fittings against their own skin
  and each other; blind to gear, engine, tail (the tie-down inside the castor
  was found by counting pixels) (G85).
- **Nothing is fitted to the fin or stabiliser** (G85).
- **A biplane's lower wing gets no fittings** — `wings` is an array and only
  the first plane carries them (G85; P7's problem, and the biplane arc's).
- **A decal is on BOTH sides or neither** (G69). STILL OPEN after G162: the
  roadmap asked for it inside the marking kit and the kit did not need it,
  because a livery IS symmetric. G162 did split the OTHER half of this — a
  registration mirrors on the far flank so it reads from both sides, and paint
  must not, or a sweep rises aft on one side of the aeroplane and fore on the
  other (`uDecC.w`). An ASYMMETRIC marking still wants a one-sided mask, which
  the surface field cannot supply.
- **A kit sweep stops at its own rectangle** (G162), and that bottom edge is a
  hard line — the help text says to give the layer depth enough to swallow the
  belly. A fill that ran to the end of the SURFACE rather than the end of the
  rect would be a shader change touching every decal.
- **The dash's riveted-metal face** needs `dash` promoted to a skin role or
  given its own grammar — a real design decision inside the livery arc (G112
  item 2).
- **The V-tail synthetic canted-panel probe** was never written — the claim
  rests on the box projector being frame-independent (G113.3). Becomes the
  V-tail chantier's opening gate.
- **Reference snapping to measured anchors** beyond the nose (firewall face,
  main axle, tailpost — `CAGE_GEAR.contacts` publishes what it needs)
  (G89-92).
- **Rib lacing** drawn on no surface; tail LE treatment fixed at G68.3 but
  lacing still owed (G68 gap list).
- **Wing spar SOLIDS** — deliberately left to the user's eye (G97, energy arc).

## 6 · UI & STYLING

- **The focus-visible / hover / reduced-motion sweep** over every surface
  added since G77 (rail, flyouts, information panel) (G108/G112).
- **15 native colour wells in `#cgUi`** styled only while borrowed into
  `#edRows` (G108).
- **The world root holds three rows of flight chrome** (sea-level temp, QNH,
  wind, refH) — a two-interface seam, its own chantier (G108).
- **The fleet RACK sheet** — forty aeroplanes, browsing width — remains its
  own chantier (UI-MODEL 2.4, re-affirmed G147).
- **The asset editor proper** — `_props.html` is its seed (G50).
- **The 2.8 m datum gap** — the editor's build and the physics lattice stand
  apart; moving the BUILD onto the lattice is its own chantier (G65.1).

## 6b · CORRECTIONS TO THIS REGISTER (found by reading the code)

Two entries in the source documents were STALE when this register was compiled.
Both are recorded here because the failure mode — a document outliving the
code it describes — is the register's own occupational hazard.

- **"The logbook is read by nothing"** (ROADMAP P3, repeated here) — WRONG.
  `renderLog()` has drawn the log in the information panel since **G130**. What
  was actually missing was the CLOCK on each row; **PAID as G152**, which added
  `t` / `on` / `run` and made hours accrue in the panel and on the rack.
- **G47.2 prop spin and control-surface deflection** — already live in app.js
  (per-vertex hinge bindings, prop spinning on the engine's own shaft axis
  since G59.1). Recorded under VERIFIED PAID at the foot of this file.

**FOUR MORE, all found by G153 when it checked before building:**

- **"Diagnostic colours on a finished aeroplane"** — the wingtip/aileron leak
  died at **G109**; the GEN_ACCESS fittings have routed through `CAGE_SECMAT`
  then `aeroHardMat` since **G111**, and the Lambert palette that looked like a
  diagnostic is a bench-only fallback.
- **"A pitch-black mood shows full-strength glints"** — the glass mood
  exemption was DELETED when transmission was measured out; `aeroGlass` says so
  in its own comment.
- **"The 15 native colour wells in `#cgUi`"** — covered by **G112**'s
  `:is(#wsUI, #edView) .r input[type=color]` rescope.
- **"The focus/hover/reduced-motion sweep"** — mostly done; only `#edView` was
  genuinely missing, and **PAID as G153**.

**THE RULE THIS BUYS:** before starting anything in this register, read the
code it names. A register entry is a LEAD, not a fact.

**AND WHY IT KEEPS HAPPENING**, because the rule alone will not stop it: a
chantier fixes a defect and updates ITS OWN handover entry, while the SAME
defect is also written down in a roadmap phase, in a predecessor's gap list and
here. Nothing walks those. A planning document decays silently, and the only
detector is the code. Six stale entries were found in two days.

## 7 · LARGER PARKED ITEMS (designed or named, not started)

- **Energy arc continuation** — G98 vessel catalogue · G99 placement/fit ·
  G100 loading table + CG(fill) · G101 balance panel; then BURN AND DISCHARGE
  (deliberately outside the bench arc). The fuel-system dress rides F2.
- **The ONE MISSION** — P3's genuine remainder. (Its companion item, the
  logbook, is DONE: read back at G130, given its clock and hours at G152.)
- **The fleet RACK** — UI-MODEL §2.4 reserves it a sheet: forty aeroplanes,
  browsing, width. Where G152's hours stop being a number on one build and
  become a comparison between aeroplanes. P6's subject.
- **Deform-and-break** — design doc first (P10).
- **Manual controls / joystick / TrackIR** — P10 option, on the user's own
  clock (reEngage/holdWas already landed in W14).
- **Item 17, the cabin artefact** — hunted twice, not reproduced (G117, G122);
  most likely fixed by G111/G112. Watch for it in playtests; needs the user's
  own save if it recurs.
- **A real slow-network session** — G149's pop-in/env-rebake verified by
  mechanism only, never under simulated 3G.
- **Full `run_gates.js --all`** — owed since G142 (the user stopped the
  battery at 61/3); re-run whenever the tree settles.

## VERIFIED PAID (so nobody re-opens them)

- **G47.2 prop spin + control-surface deflection** — both live in app.js:
  per-vertex hinge bindings with a hinge table (`applyHinges`, payload v2),
  and the prop spinning about the engine's own shaft axis with the throttle
  law (G59.1). Gear articulation paid by G148 (leg/spat weighting debts above
  are what remain).
- **G138's artifact ceiling** — paid by G149 (media/ store, GATE MEDIA).
