# EMPTY-STAND-LOOK: the empty stand, on the page (evidence, 3-4 Nov 2026)

An evidence run, not a gate and not a fix: no game code changed. Base: `origin/claude/empty-stand` at `b3da1749`
(EMPTY-STAND (built), on STORY-HOME-FIX `09a391eb`). Page: the built `index.html`, served by `tools/_serve.js`.
Rig: `flyDiy/tools/empty_stand_look.js` (new, not in `run_gates.js`), built on `story_home_look.js` from
`claude/story-home-look`. It runs Playwright on the image's Chromium headless shell with plane_shot.js's SwiftShader
flags, under the `flydiy.test` host (a browser user agent, `navigator.webdriver` off: welcome.js's real-host path). Each
career is a fresh browser context. URL `?gfx=laptop&tutor=0` (Tim's T0 holds every click without it: the user's ruling).
Every step goes through the player's own controls: the CONTRACTS pill → the map → the hangar's icon → "Go there"; the
card's buttons; the card dragged by its body with the mouse; Escape on the chooser; a reload and the welcome's Continue.

**Renderer:** `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)` (all runs).
No frame time is quoted.

**Page errors: none.** No `pageerror` in any run (run 1, run 2, run 3, the phone), and no console error. Console
warnings (run 3): `flyDiy: the saved day was not readable - the game’s day` at steps 1, 5 and 7, and a `beforeunload`
dialog at step 7's reload (accepted by the rig).

The career: a story career starts in the cabin's field shed `w1` (Cabin Strip) with Rufus on the stand, and HOME (the
main hangar at Jolene AFB 13/31) is owned and empty: `garages()` = `HOME planes=[]`, `w1 planes=["Rufus"] (here)`.

## The user's ruling on this look (4 Nov)

> "An empty garage should automatically open the interface allowing to choose a plane, either existing or new, not to
> be confusing. But no plane should be drawn yet."

What that means against this evidence (for the Game session; this run changes no game code):
- arriving in an empty hangar should OPEN the choice by itself, either one of yours (Bring here) or a new one (the
  chooser), not leave a small card over the room to be found. Today `#gEmptyCard` shows and New aeroplane is one click
  further;
- **nothing is drawn on the stand until a plane is chosen.** F1 below breaks this at every empty state today;
- F2 (the chooser opening by itself on a NEW story career, which has its starter) stays a fault: the ruling is about an
  empty hangar, and that hangar is not empty.

## The verdict per step (run 3, desktop 1280x800; the phone 412x915)

| step | DOM checks | picture | verdict |
|---|---|---|---|
| 1 before | 4/5 PASS: Rufus on the stand, no empty state, an empty owned HOME, no page error. FAIL: the chooser came up by itself (F2) | the cabin shed, Rufus on the stand (after the chooser's cancel) | **PASS** (F2 aside) |
| 2 Go to the empty hangar | 9/9 PASS: `onStand()` null, `body.gEmpty`, `#gEmptyCard` shown, `#edRoll` and `#edWrap` hidden, no page error | **an aeroplane drawn on the empty stand** (F1); the view a 320-px column on a bare background (F3) | **FAIL** |
| 3 drag the card | 4/4 PASS: moved 470,96 → 110,276, the same 5 s later, still empty; `flydiy.cardPos.emptyStand` = {x:110, y:276} | the card where it was dropped | **PASS** |
| 4 Bring here | 5/5 PASS: Rufus on the stand, `gEmpty` off, card hidden, Roll out back | Rufus in HOME's hangar, the editor back | **PASS** |
| 5 back to empty + New aeroplane | 12/12 PASS: Go to `w1` ("empty"), the empty state again (card at its dragged place), the chooser opens; Escape closes it, still empty | 5a: **Rufus drawn in the empty shed** (F1); 5b: the chooser, with developer notes in it (F5) | **FAIL** (picture) |
| 6 Buy one | 3/3 PASS: the map opens on its Market list; closed, still empty, card back | the map's Market (makers, used, your drawing board) | **PASS** |
| 7 reload while empty | 6/6 PASS: still empty in `w1` (`flydiy.standEmpty` = `w1`), card back at its dragged place | **Rufus drawn in the empty shed** (F1) | **FAIL** (picture) |
| phone 1 | 5/5 PASS (no chooser this time) | the editor's columns over the shed (the computer layout at 412 px) | **PASS** |
| phone 2 | 9/9 PASS (as desktop 2) | **Rufus drawn** (F1); the view a ~90-px strip on the right (F3); CONTRACTS over the card's corner (F4) | **FAIL** |

## Findings

- **F1, a real break: an aeroplane is drawn on the empty stand.** At every empty state (desktop 2, 3, 5a, 7; phone 2;
  run 2's 2 and 3), the aeroplane last on the stand (Rufus, red, at the stand's place) is in the picture while the card says
  "The stand is empty" and `FLYDIY_STORE.onStand()` is null. It is not a stale frame: the room behind it is the new room
  (HOME's corrugated hangar at step 2, the cabin shed at 5a), and at 5a the camera framing differs from step 1. The rig
  cannot reach `craft.visible` (no window hook). `renderer.info` reads 1 call / 2 triangles at every step (the last
  composite pass only), so it says nothing either way. Not traced further (no code change in this run).
- **F2: the first-launch New aeroplane chooser came up by itself over a new story career, in 2 of 3 desktop runs** (run 1,
  run 3; not run 2, not the phone). When the rig read it, both of `design_flow.js maybeAutoOpen`'s guards said "stay shut"
  (`flydiy.wip` set, `FLYDIY_STORY_STARTER` = "Rufus"). So it is either a race (opened before they were set) or another
  door. While it is up it holds the render loop and takes every pointer. In run 1 it covered the whole run: the drag
  selected chooser text instead of moving the card, and Bring here timed out ("`#npWrap` … intercepts pointer events"). The
  CONTRACTS pill and Tim's band are drawn over the chooser (`desktop_1a_chooser_at_start.jpg`). `?tutor=0` is not the
  cause: run 2 used it and had no chooser.
- **F3: with the editor's columns hidden, the 3D view does not widen.** It stays the 320-px column between where the
  columns were (desktop: x 320-640). Elsewhere the page is a bare light-blue background, and on the phone only a ~90-px strip
  of hangar shows at the right.
- **F4 (phone): the CONTRACTS pill overlaps the card's top-right corner** (card at 36,96; the pill over it).
- **F5: the chooser opened from the card lists "CANDIDATE OFFICIAL — built, not validated" rows with developer notes**
  ("the user's pick ~22:25 - it replaces _2 and _3, now in review", "open finding: the prop passes through the body") in a
  career (`desktop_5b_new_aeroplane_chooser.jpg`). The step-1 chooser showed "authored recreations" in that place.
- **F6 (wording): the card shows raw ids.** "Rufus — in w1" (not "the field shed at Cabin Strip"), "Client Cub — out at
  HOME", and after step 4 "Rufus — in HOME". It also offers the story's **Client Cub** (the client's aeroplane, `out at
  HOME`) as "one of yours", listed first.
- Tim's band keeps T0's line ("…sat in the cabin's shed all winter") in HOME's hangar (`?tutor=0`: expected, noted only).

## Stills, one row each

| file | what it shows | verdict |
|---|---|---|
| `desktop_1a_chooser_at_start.jpg` | run 3 step 1: the New aeroplane chooser up by itself over the new story career; CONTRACTS and Tim's band over it | FAIL (F2) |
| `desktop_1_before.jpg` | step 1 (after the chooser's cancel): the cabin shed, Rufus on the stand, the editor's columns, Roll out | PASS |
| `desktop_2x_map_go_row.jpg` | step 2: the map's Go row "Go to the main hangar at Jolene AFB 13/31? empty — Go there / Stay" | PASS |
| `desktop_2_empty_stand.jpg` | step 2: HOME's hangar, `#gEmptyCard` (New aeroplane, Buy one, Client Cub / Rufus Bring here), no columns, no Roll out, **Rufus drawn**, the view a 320-px column | FAIL (F1, F3) |
| `desktop_3_card_dragged.jpg` | step 3: the card dragged down-left to 110,276; **Rufus still drawn** | PASS (drag); F1 |
| `desktop_4_brought_here.jpg` | step 4: Bring here Rufus: Rufus on HOME's stand, the editor's columns back | PASS |
| `desktop_5x_map_go_row.jpg` | step 5: the map's Go row "Go to the field shed at Cabin Strip? empty" | PASS |
| `desktop_5a_empty_again.jpg` | step 5: the cabin shed empty again (card at its dragged place; Rufus listed "in HOME"); **Rufus drawn** | FAIL (F1, F3) |
| `desktop_5b_new_aeroplane_chooser.jpg` | step 5: the card's New aeroplane → the full-screen chooser (the candidate rows, F5) | PASS (F5) |
| `desktop_6_buy_one_market.jpg` | step 6: the card's Buy one → the map on its Market list | PASS |
| `desktop_7_reload_still_empty.jpg` | step 7: after a reload (Continue): still empty, the card back at its dragged place; **Rufus drawn** | FAIL (F1, F3) |
| `phone_1_before.jpg` | phone step 1: the cabin shed with the editor's columns at 412 px (the computer layout: `?gfx=laptop` skips the device gate) | PASS |
| `phone_2x_map_go_row.jpg` | phone step 2: the map's Go row for HOME | PASS |
| `phone_2_empty_stand.jpg` | phone step 2: the card, CONTRACTS over its corner, the hangar in a ~90-px strip at the right with **Rufus drawn** | FAIL (F1, F3, F4) |
| `run1_desktop_1_before.jpg` | run 1 step 1: the chooser up by itself (the rig did not yet cancel it) | FAIL (F2) |
| `run1_desktop_2x_map_go_row.jpg`, `run1_desktop_2_empty_stand.jpg`, `run1_desktop_3_card_dragged.jpg` | run 1, steps 2-3 under the chooser (it holds the render loop: every still the same chooser; the drag selected its text). Step 2's DOM checks passed; step 3's drag FAILED; step 4's Bring here timed out ("`#npWrap` subtree intercepts pointer events") | FAIL (F2) |
| `run2_desktop_1_before.jpg` … `run2_desktop_4_brought_here.jpg` | run 2, steps 1-4: no chooser; the same as run 3 (Rufus drawn at 2 and 3). Bring here took the first row, the **Client Cub** (onto HOME's stand, PASS) | as run 3 |
| `run2_desktop_5x_map_go_row.jpg`, `run2_desktop_5a_empty_again.jpg` | run 2 step 5: `w1` still held Rufus (the rig's own slip: it brought the Cub), so the Go row said "with Rufus" and Rufus came onto the stand: correct, not an empty state. The rig was fixed to bring step 1's plane (run 3) | rig slip, no verdict |

## The runs

| run | results | stills | notes |
|---|---|---|---|
| 1 desktop | `run1_results_desktop.json` | `run1_desktop_*` | the chooser up from step 1 (F2); ended at step 4 (the click intercepted) |
| (phone, first try) | none | none | the renderer killed by the out-of-memory killer (two SwiftShader pages at once): runs then went one at a time |
| 2 desktop | `run2_results_desktop.json` | `run2_desktop_*` | steps 1-4; step 5 a rig slip (above) |
| (phone, second try) | none | none | lost to a container restart |
| 3 desktop | `results_desktop.json` | `desktop_*` | steps 1-7, the verdict above |
| phone | `results_phone.json` | `phone_*` | steps 1-2 |

Each `results_*.json` holds, per step, every assertion and, under `prints`, `FLYDIY_STORE.onStand()`, `body.gEmpty`,
`doc().here`, the card's box and text, `#edRoll` / `#edWrap` visibility, `flydiy.standEmpty`, `renderer.info` and
`FLYDIY_HOLDS()`, plus the page errors, console errors and warnings, each with the step it came at.

    node flyDiy/tools/empty_stand_look.js --only desktop     # ~27 min here (two boots)
    node flyDiy/tools/empty_stand_look.js --only phone       # ~19 min
