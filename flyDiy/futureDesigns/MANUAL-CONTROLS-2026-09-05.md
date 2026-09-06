# MANUAL CONTROLS — the study, what landed (G200), and the two plans not executed

*2026-09-05. The user: "at some point, I'll want to fly them myself" — then "it
will be time soon", with four steps named: keyboard; stick and throttle with a
mapping interface; TrackIR; interior instruments and interior view. Ruling on
scope the same day: items 1 and 2 land, with ONE proper mapping interface from
the keyboard step onward, opened from both the shed and the flight screen,
mapping actions against N devices (keyboard, joystick, throttle, later
TrackIR). Items 3 and 4 are written here as plans and NOT executed.*

Hardware named: TrackIR read by opentrack; a separate stick and throttle
(measured on the user's machine during G200: a Thrustmaster HOTAS Warthog
throttle and a VKBsim Gladiator EVO R, 10 axes and 32 buttons each).

## The sizing, as studied

| # | Item | Size | Sessions | Status |
|---|------|------|----------|--------|
| 1 | Keyboard flying + AP/manual toggle | S-M | 1 | LANDED G200 |
| 1b | Fixed-step accumulator (ROADMAP Phase 8 item 6) | M | 1 | owed — feel starts here |
| 2 | HOTAS via the Gamepad API + the mapping panel | M | 1-2 | LANDED G200 |
| 3 | TrackIR via opentrack → vJoy + a free-look camera | S-M | 1 | PLAN, below |
| 4 | Live needles + interior finish | L | 3-4 | PLAN, below |

Why 1-3 are small: `sim.ctl` is a plain object the solver never clamps and
that `tools/test_stress.js` already drove mid-flight; `ap.reEngage()` (W14)
already re-latched every integrator; the cage surfaces already draw from
`sim.ctl` through `makeLinkage`; the cockpit eye already exists. Why 4 is
large: the needles are hash-frozen decoration merged by material into the
flight bake, and three instruments have no honest source at all (shaft rpm,
in-flight fuel burn, load factor).

## What landed — G200

**`src/viewer/input.js`** — the device-agnostic model, shaped like
`aa_resolve.js`: it owns the action table, the profile and its own pref
(`flydiy.input`), publishes `window.FLYDIY_INPUT_API` at eval and a
`module.exports` for node; `app.js` makes the one instance
(`window.FLYDIY_INPUT`). Actions are AXES (pitch, roll, yaw, throttle, four
engine levers, six head axes), BUTTONS (brakes) and STEPS (flaps, trim, the
AP toggle, the view). A binding is one device's way of asking for one action;
keys bind by `KeyboardEvent.code` (layout-independent); a gamepad axis
carries invert / deadzone / expo / the raw span it maps (so a throttle that
idles at +1 lands on 0). Keyboard axes are rate-shaped (full in 0.4 s, centre
in under 0.2), the throttle latches, trim is an input-side bias on the
elevator applied after the merge. The solver's sign convention is carried by
the yaw scale (dr>0 is nose LEFT), so "right pedal" is +1 wherever a human
sees it.

**`src/viewer/input_panel.js` + `src/viewer/controls.css`** — the one
mapping interface. `#ctlPanel` is a THIRD top-level host in body.html:
`#ui` and `#wsUI` each hide the other by a body-class rule, so a panel inside
either would exist on one screen only. Both rails carry a `controls` entry
(the editor's is literal-only, so GATE VIEW's vm read of the RAIL table
survives; `openFly` builds it by name as it does `camera`). The panel: the
devices the browser can see with a tiny meter per axis (wiggle a stick to
tell which is which), one row per action with a chip per device, a LISTEN
flow (press the chip, then press the key / move the axis the positive way /
press the button — the model infers sign and span from what you did), the
tuning under an axis chip, a live bar per action, defaults / export / import
as a text document (the artifact sandbox blocks downloads).

**The mux** — `script()` in app.js: `manual ? INP.write(sim.ctl) : ap.update(dt)`;
the hand is READ at the top of `loop()` so the A key works under the AP and
the stand's control-check sweep yields to a real hand. `setManual(on)`:
hand → AP re-engages with a PHASE (`ap.reEngage({ phase })`, both pilots —
a hand-flown take-off leaves the AP in DEPART at 300 m) and pushes the test
pilot's watchdog budget out; AP → hand seeds the input from the live ctl
(the AP's elevator becomes trim, nothing jumps). `fullReset` remembers who
flies (`flydiy.flManual`). The HUD, the trace and the arrival card read
`flDbg()` — `ap.dbg` under the AP, the same numbers computed from
`sim.axes()/cgPos()/cgVel()` under the hand (AGL against the terrain, since a
flight that starts by hand never latched `refAlt`). The PFD's elevator /
aileron / rudder cells are back as `instruments` toggles, signed as a pilot
reads them. A manual flight ENDS the way a real one does: airborne once, then
still on at least two wheels for three seconds → touchdown measured on the
first frame back on the wheels, `completed` within a kilometre of the
destination, else `landed-out` (and then the touchdown is not logged as an
arrival). An abandoned take-off is not an ending; the shed is the door.

**Also fixed on the way**: the cage join named the flap drive `'fl'` and the
linkage carries `'flap'`, so a cage build's flaps NEVER deflected on screen
(now `'flap'`, scaled 0.70 rad like the generated table); a pressed button
kept focus so Space re-fired it (every button blurs after its click).

**GATE INPUT** (`tools/test_input.js`, core tier, 86 checks): the table, the
shaping, the mapping, the listen inference on a HOTAS fixture (idle-at-+1
throttle, hat on axis 9), the profile round trip, the seed — and the W14
note FLOWN: a held 30° bank under the hand, then the AP takes it back, on
both pilots, once through the keyboard so ArrowRight-rolls-right and
ArrowDown-is-nose-up are proven end to end. GATE UISMOKE runs input.js in
its sandbox and flies a key through `FLIGHT_PROBE.setManual`.

### Measured traps (each cost a red gate)

- **The listen baseline must be the first poll AFTER the ask.** A baseline
  taken at the ask, with no gamepads polled, read the throttle's resting +1
  as an excursion and bound it to roll.
- **The last to speak owns the axis, and a still stick does not speak.** The
  first merge let a stick that already owned an axis keep it over a held key.
  Now: a stick that MOVED this frame, else a key that is held, else the owner.
- **A device seen for the first time only records itself** — or a throttle
  idling at +1 pulls the lever to idle the moment it is plugged in. The
  corollary: a binding just made or just tuned must CLAIM the action, or a
  lever bound at full sits at idle until it moves again.
- **The pane's rAF is dead** (`requestAnimationFrame` never fires in the
  Browser pane, measured with a race): the game loop cannot be watched there.
  The DOM key path was proven by dispatching real KeyboardEvents and stepping
  `INP.update` by hand; motion is the node gate's.
- **The G-number race, twice in one evening**: G196, G197 and G198 were all taken
  between the plan and the commit; this arc is G200.

## Owed from this arc

- **The fixed-step accumulator** (ROADMAP Phase 8 item 6). The sim steps 1/60
  per rAF; a 120/144 Hz monitor flies 2-2.4× fast, and a hand on the stick
  will notice what the autopilot never did.
- The shed flyout's device labels truncate at the editor's `.v` width.
- Real-hardware listen not exercised by a session (the devices were visible
  to the page; the fixture stands in). The user's first mapping session is
  the measurement.

## PLAN — item 3, TrackIR [S-M, one session] — NOT EXECUTED

**Route (recommended): opentrack → vJoy output → Gamepad API.** opentrack's
vjoy output presents the six head axes (x, y, z, yaw, pitch, roll) as one
more gamepad; the G200 mapper already carries `headYaw/Pitch/Roll/X/Y/Z` as
pass-through actions, so binding them is six listens with a scale each.
Zero bridge code. Prerequisite: the vJoy driver (the maintained signed build
runs on Windows 11). FIRST CHECK: that Chrome sees the vJoy device with all
six axes — that one fact decides the route.

Fallbacks: opentrack UDP output → a 20-line node bridge → `ws://localhost`
(Chrome allows an insecure WebSocket to localhost from https; +½ session and
a process to run). Webcam-in-page (MediaPipe) not recommended: an external
dependency against the vendored stance, and lower fidelity.

**The actual work**: a fourth camera branch that sets `camera.position` and
`camera.quaternion` DIRECTLY — eye from `flyEyeAt()`, body basis from
`sim.axes()`, head offset and rotation applied in the body frame — skipping
`placeCamera()` for that frame (`placeCamera` can only express
position + lookAt; today's cockpit is an orbit of radius 0.35 m about a point
0.35 m ahead of the eyes, app.js `flCamera`'s cockpit branch; HANDOVER's own
pre-G107 note already names "a camera that is not an orbit"). The same
branch is a mouse FREE-LOOK when no tracker is bound, which is a better
cockpit than the orbit. FOV stays the camera flyout's; `camera.up` already
takes the body up.

**Consequence**: hide the pilot's head in flight. Turning the head 90° with
tracking looks at the dummy's own skull from inside. The bake merges by
material, so the head has to be lifted out as a NAMED part — the
`edProp`/`edWheel*` precedent in `_cage_join.js`'s snapshot (identity beats
surgery). Shared with item 4b.

**Gate**: the pose is a pure function (eye, fwd, basis, head) → (position,
quaternion), node-tested against a fabricated basis; the UISMOKE-style
probes on `flEyeWhy` stay.

## PLAN — item 4, interior instruments [L, three to four sessions] — NOT EXECUTED

The interior VIEW is already delivered (G107 / G141: cockpit mode, the eye
point, the panel, seats, controls, floorboards, DoubleSide skin). What is
left is (a) needles that read the aeroplane, (b) an interior worth sitting
in, (c) sources that do not exist.

**4a. Live needles [M].** Lift each needle out of the merge as
`edNeedle_<k>` pivoting at its dial centre (needles today are hash-frozen
decoration, `_cage_crew.js` `buildPanel`), pose per frame in app.js like the
prop spin. Drives, all available: ASI ← `out.Veas`; altimeter ← `cgPos()[1]`
(QNH = field elevation for now); VSI ← `out.vs`; turn ← yaw rate (compute it
in the viewer); slip ball ← β (the `flDbg()` computation from G200); DG /
compass ← heading from `sim.axes()`. The attitude indicator and the compass
card want a CanvasTexture FACE (a painted horizon; a rotating scale) — a new
`dialFace` material with a map, which must join `CAGE_MATS` (the G26 rule)
and sits outside the AEROSKIN pooled material. Needles first; the AI and
the card second; the dial faces have no scales today and get them by the
same mechanism.

**4b. An interior worth looking at [M].** The head hidden (shared with 3);
the instrument light and cabin light (owed since the lighting arc —
"dark with cabin lights off"); the stick, pedals and throttle moving from
`sim.ctl` (they are static meshes today); placards later. The glazing is
FrontSide, so from inside you look out through nothing — fine.

**4c. Sources that do not exist — separate physics items.** Tachometer: there
is no shaft rpm in the model (`60_gen_spec.js` says so, and names the
missing rpm limit as a defect); a tacho needle without an rpm breaks the
honesty rule — the empty tacho until the propulsion model gains a shaft
speed (the PROP-THRUST follow-on, [M]). Fuel gauge: no in-flight burn;
`setNodeMass` is the sanctioned door and nothing calls it in flight ([M]).
Oil P/T, volts: no source, static at nominal, declared decorative. G-meter:
load factor from CG acceleration is cheap if a fit tier ever buys one.

**Rulings owed before 4 starts**: the empty tacho vs. shaft rpm first; QNH
as a setting or the field's elevation.

## Recommended order from here

1b (the accumulator) as soon as feel is judged on the real stick → 3 → 4a →
4b. Needles (4a) are independent and fit any short session.
