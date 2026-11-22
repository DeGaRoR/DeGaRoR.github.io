---
name: sandbox-start-chooser-2026-11-13
description: USER 13 Nov ~01:15 - SANDBOX: "Fly" (planes) / "Drive" (cars) with a chooser for START and DESTINATION; start anywhere (incl. trailer); unpowered planes get altiport push or cable launch; cars get car-only destinations; story = start from the hangar spawn, physical
metadata:
  type: project
---

The user, 13 Nov ~01:15: "in sandbox mode, the button 'fly' should have a little option next to it, allowing to choose where to start from. Merged with the option to start from a trailer ... unpowered planes ... launch from the altiport with a little push, like the tow session has done, or through a cable launch. In story mode, we'll probably constrain the plane to start from its hangar spawn place, but in sandbox, we should be able to start from anywhere. ... a list of car only destinations ... the autopilot takes us from the chosen spawn point to the chosen destination. The spawn point is chosen in the garage. ... 'Fly' for planes and 'Drive' for cars. ... maybe the chooser allows selecting start and end point ... I know it's walking back on what I once asked, but ... the story and the sandbox should behave differently here; in the story the planes are real and physical, not in sandbox."

**Why:** the sandbox is for freedom, the story for physical continuity.
**How to apply:** the garage's roll-out button = "Fly" / "Drive" (by spec.kind) + a start/destination chooser. Start options depend on the vehicle:
- powered plane: any aerodrome or water base, the trailer;
- unpowered plane: the altiport push, a cable (winch) launch, the tow;
- car: car-only places.
In the story it is locked to the hangar spawn. Owners: Game (garage UI) + TOW-LAUNCH (start modes, car places) + the winch launch (sailplane-launch study).

**API ~02:00 (TOW-LAUNCH):** window.FLYDIY_START {available, vehicle, powered, starts -> [{id, mode field|water|trailer|push|cartow|winch|place, label, sub, ok, why}], destinations(startId), go({start, to})}. Sandbox only.
- WINCH does NOT exist: shown greyed "not built yet". ~1 day of work, named for later (Mon 16 Nov at the earliest).
- AEROTOW (behind a tow plane) does NOT exist: what exists is a CAR tow, label 'cartow'.
- Mine street is not a car place (separate road network); the tramway station replaces it.

**Game's side (13 Nov 01:35):**
- Design page v1: https://claude.ai/artifact/PxtJtevjPWUxRWNWEc6bfe (scratchpad start/start_chooser.html), sent to A0 13 Nov ~01:35. Five questions, each with a default (one click = remembered start per kind; no To = circuit; car no To = free drive; glider = car tow first; winch shown greyed).
- API (TOW-LAUNCH, claude/tow-launch-onmaster): window.FLYDIY_START { available, vehicle, powered, starts() -> Promise<Start{id, mode field|water|trailer|push|cartow|winch|place, label, sub, ok, why}>, destinations(startId), go({start, to}) rejects with a reason }.
- Today's pieces:
  - #edRoll → #bGo (app.js), the start from rollFromId; To = #edRoute behind #edDestB + #selDest (FLYDIY_PLAN.set).
  - The trailer dialog is launchAsk (onmaster).
  - "Drive the pickup" always drives the stock pickup (useCar unwired).
- Gaps: NO winch/cable launch anywhere; NO aerotow (it's a car tow - never label it aerotow); the altiport push is test-only.

**Why:** a user ask, owned by Game for the UI.
**How to apply:** build ~6 h after the answers (silence = defaults) for L40c, ref Sat 20:00. Verb identical to today when FLYDIY_START is absent or available() is false.

**USER answers ~02:15 (design page PxtJtevjPWUxRWNWEc6bfe):**
- Q1 one click = the remembered start: yes.
- Q2 no To = a circuit: yes.
- Q3 a car with no To: not "free drive"; a circuit, or a RANDOM reachable place.
- Q4 a glider starts with the car tow, "we stay at home" (from HOME if the runway allows).
- Q5 the winch greyed: yes, AND the user wants the WINCH built now plus a 3D model rendered in QuickShot. Given to the "Sailplane launch mechanisms study" cloud session: model page first, then the physics on tow.js with a fixed drum; L40c if it fits.
- 13 Nov 02:35: CODED + PUSHED work branch claude/start-chooser dcb266387, on fleet-screen. Gates PASS. Latent until tow-launch-onmaster lands. Owed: a page check on a merge with tow-launch-onmaster (~30 min GPU, asked A0), then claude/ready/start-chooser for L40c.
- User answers: Q1 remembered start YES; Q2 circuit YES; Q3 car = "Surprise me" (random reachable, named); Q4 car tow (HOME = Jolene AFB, already home); Q5 winch greyed, and the user wants the winch BUILT (launch-study session).
- 11:25 SLOT ORDER (A0, outranks all): FIRST check plain origin/master 23ce68c1f for a BLANK WORLD after roll-out (02:40 on the restore build: pale/blank at TAXI, sim t 3.2, stage 1 and 3, "continue anyway" pressed both times). Roll out, wait for rollShot to clear and sim t > 5 s, screenshot chase + cockpit, read pixels and console; retry without skipping the shader compile. Blank = message A0 at once. Then the chooser check on local tmp/sc-tl (merge 722e15d6a with tow-launch 480ea6df3 - REBUILD it: start-chooser has moved since, merge again).

13 Nov 11:25 slot: chooser on tmp/sc-tl works except go() got bare field ids ('w3' -> HOME); fix = send mode:id
(+ TOW-LAUNCH told to accept bare ids); pill squeezed at 1024 px; sheet anchored over the editor. Fixes listed in
scratchpad stand/EDITOR_PLAN.md; NOT ready for L40a -> L40c. Blank world: master + restore stage 1 both clean without
"continue anyway"; the continue-anyway path unproven (shader cache shared across origins).
