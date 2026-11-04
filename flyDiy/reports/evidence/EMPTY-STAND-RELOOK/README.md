# EMPTY-STAND-RELOOK: the empty stand after the user's ruling (evidence, 4 Nov 2026)

An evidence run, not a gate and not a fix: no game code changed, no built file touched. Base: `origin/claude/ready/empty-stand`
at `0c24a98c` (EMPTY-STAND `9f719453` + its built commit `d00aa746`). Page: the built `index.html` served by
`tools/_serve.js`, `?gfx=laptop&tutor=0`, host `flydiy.test` (a browser user agent, `navigator.webdriver` off). Rig:
`flyDiy/tools/empty_stand_relook.js` (new, not in `run_gates.js`), copied from `empty_stand_look.js`
(`claude/empty-stand-look`) and adapted to the ruling. Desktop 1280x800 only. Each career is a fresh browser context; every
step goes through the player's own controls (the CONTRACTS pill → the map → the hangar's icon → Go there; the chooser's
tiles, cancel and Escape; the card's buttons and its drag; a reload and the welcome's Continue).

**Renderer:** `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`. No frame time
is quoted.

**Page errors: none.** No `pageerror` and no console error in the run. Console warnings, verbatim:
`flyDiy: the saved day was not readable - the game’s day` (steps 2, 4, 5, 6, 7, 7) and `dialog beforeunload: ` at step 5's
reload (accepted by the rig).

The ruling (4 Nov): *"An empty garage should automatically open the interface allowing to choose a plane, either existing or
new, not to be confusing. But no plane should be drawn yet."*

## The verdict per step

| step | asserts | verdict |
|---|---|---|
| 1 new career, opening skipped | 4/4: no chooser by itself (`npWrap` never built, `NEW_PLANE.LOG.opened` 0; `FLYDIY_MODE` career, starter Rufus), Rufus on the stand, HOME owned and empty, no page error. Careers 2 and 3: see below | **PASS** |
| 2 map → HOME → Go there | 14/14: CHOOSE AN AEROPLANE open by itself 7 s after arrival; tiles Rufus ("in the field shed at Cabin Strip") then Client Cub ("the client’s, out at Jolene AFB 13/31"), last and named so; Buy one; Design a new aeroplane, Surprise me; `#stTim`, `#mapEntry`, `#stCard`, `#gmMenu`, `#gEmptyCard` all hidden, the panel on top at 5 points | **PASS** |
| 3 cancel | 6/7: the chooser closed, `onStand()` null, `body.gEmpty`, `#gEmptyCard` shown, columns and Roll out hidden, **no aeroplane drawn** (F1 fixed, looked at). FAIL: the view is 640 px wide at x 0 (`#c` box `[0,0,640,800]`, buffer 640x800), the right half of the page bare light blue (F3, R1) | **FAIL** (F3) |
| 4 drag; New aeroplane; Escape | 14/17: the card moved 470,96 → 110,276; New aeroplane opens the same CHOOSE AN AEROPLANE (all its asserts pass). FAIL: **Escape does not close it** (R2); the card checks after it fail with it (`#gEmptyCard` is hidden under `html.npOffer` while the chooser is up) | **FAIL** (R2) |
| 5 reload, Continue; cancel | 15/16: the chooser opened by itself after the reload (all its asserts pass); cancel: still empty in HOME, the card back at its dragged place, **no aeroplane drawn**. FAIL: the view 640 px (F3, R1) | **FAIL** (F3) |
| 6 the chooser's Rufus | 7/7: the panel closed, Rufus on the stand and drawn, `gEmpty` off, card gone, `#edWrap` and Roll out back, the view back to its column (`[320,0,320,800]`) | **PASS** |
| 7 Go to the empty w1; Design a new aeroplane; generate | 18/18: the chooser by itself on arrival (Rufus now "in the main hangar at Jolene AFB 13/31"); after 8, the card's New aeroplane → Design a new aeroplane → skip ×14 → summary → generate: the new build drawn, `gEmpty` off, card gone, columns back | **PASS** |
| 8 the chooser's Buy one | 8/8: the chooser closed, the map on its Market list; closed: the card, the stand still empty in w1, no aeroplane drawn | **PASS** |

Order note: 8 was run between 7's arrival and 7's generate, because 8 needs an empty stand and generate fills the last one.

## Findings (named, not fixed)

- **R1 = F3, still open: the view does not take the columns' room; it takes only the left one.** `editor.css:1957`
  (`body.mode-ws.gEmpty { --ws-left:0px; --ws-right:0px; }`) zeroes both, but the editor writes `--ws-right` as an INLINE
  style on `<body>` (`app.js:19369`, `panelWidth: … b.style.setProperty('--ws-right', …)`), and an inline custom property beats
  any stylesheet rule. So `--ws-left` is 0 and `--ws-right` stays 640: `#c` is `calc(100% - 0 - 640px)` = 640 px at x 0
  (`editor.css:1152-1153`), and the right half of the page is the bare body background (stills 3, 4a, 5b, 8b). Read at 3 s
  and still so at 8 s (the still).
- **R2, new: Escape does not close the chooser when it carries the empty stand's offer** (step 4: opened from the card;
  the same panel opens by itself on arrival). The menu's Escape handler runs in the capture phase on `window`
  (`app.js:18881-18886`): with `#gmPanel` shut and `gmBusy()` (`app.js:18685-18691`) not counting the chooser, it opens the
  menu and calls `stopImmediatePropagation()`, so `new_plane.js:90`'s Escape (registered later, when the panel is first
  built) never runs; the menu it opened is hidden by `html.npOffer` (`editor.css:1958`). Still `desktop_4c_after_escape.jpg`:
  the chooser unchanged. (The first look's Escape worked: that chooser was not the offer one.) A probe in career 2 reads the
  menu's state after Escape (below).
- **F5, still open: the chooser lists "candidate official — built, not validated" with developer notes in a career**
  (below the fold of stills 2, 4b, 5a, 7a; the run's tile list: "open finding: the prop passes through the body", "the
  user's pick ~22:25 - it replaces _2 and _3, now in review/ - flies as meant with claude/ready/boom-reach's float-step fix",
  "B-MOSQ (9 Oct; DESIGN-TRUST G2640: it would not fly level - its repro steps stay in tools/fixtures/repro/)").
  `new_plane.js` renderStart's CANDIDATE OFFICIAL block, offered whether or not the chooser is the career's.
- Noted only: after generate (7), `FLYDIY_STORE.onStand()` reads null with the build on the stand ("Garage build", unsaved,
  not in the fleet); `garages()` w1 `planes=[]`. Tim's band keeps T0's line in every hangar (`?tutor=0`: expected).
- The chooser holds the render loop (NEW-PLANE-HOLD): stills 2, 4b, 4c, 5a are the same panel, byte for byte.

## Stills, one row each

| file | what it shows | verdict |
|---|---|---|
| `desktop_1_new_career.jpg` | step 1: the new career's cabin shed, Rufus on the stand, the editor's columns; no chooser | PASS |
| `desktop_2x_map_go_row.jpg` | step 2: the map's Go row for HOME ("empty — Go there / Stay") | PASS |
| `desktop_2_chooser_by_itself.jpg` | step 2: CHOOSE AN AEROPLANE by itself in HOME: "The stand is empty - the main hangar at Jolene AFB 13/31", ONE OF YOURS (Rufus, Client Cub, Buy one), OR A NEW ONE (Design a new aeroplane, Surprise me, the shed's designs); nothing over it | PASS |
| `desktop_3_empty_room.jpg` | **the point of the run.** Step 3, cancelled: HOME's hangar empty, lit (the window light on the floor, the lamps), the card, CONTRACTS, Tim's band; **no aeroplane drawn**; the room only across x 0-640, the right half bare light blue | PASS (F1) / FAIL (F3) |
| `desktop_4a_card_dragged.jpg` | step 4: the card dragged to 110,276; still empty, still half the page | PASS (drag) / F3 |
| `desktop_4b_new_aeroplane_chooser.jpg` | step 4: the card's New aeroplane → the same CHOOSE AN AEROPLANE | PASS |
| `desktop_4c_after_escape.jpg` | step 4: after Escape: the chooser still up, unchanged | FAIL (R2) |
| `desktop_5a_reload_chooser.jpg` | step 5: after the reload (Continue): the chooser by itself | PASS |
| `desktop_5b_reload_cancelled.jpg` | step 5: cancelled: HOME empty, the card at its dragged place, **no aeroplane drawn**; half the page | PASS (F1) / FAIL (F3) |
| `desktop_6_rufus_on_stand.jpg` | step 6: the chooser's Rufus: Rufus drawn on HOME's stand, the columns, the view in its column | PASS |
| `desktop_7x_map_go_row.jpg` | step 7: the map's Go row for w1 ("the field shed at Cabin Strip? empty") | PASS |
| `desktop_7a_chooser_by_itself.jpg` | step 7: the chooser by itself in the cabin shed; Rufus "in the main hangar at Jolene AFB 13/31" | PASS |
| `desktop_8a_buy_one_market.jpg` | step 8: the chooser's Buy one: the map on MARKET (the makers, used, your drawing board) | PASS |
| `desktop_8b_map_closed_card.jpg` | step 8: the map closed: the cabin shed empty under its lamps, the card, **no aeroplane drawn**; half the page | PASS (F1) / FAIL (F3) |
| `desktop_7b_summary.jpg` | step 7: Design a new aeroplane, 14 steps skipped: the summary (Experimental, touring, flat engine, low tapered wing, taildragger, plywood, cream), generate | PASS |
| `desktop_7c_new_build_drawn.jpg` | step 7: generated: the cream "Garage build" drawn on the cabin shed's stand, the columns back | PASS |

## The runs

| run | results | stills |
|---|---|---|
| desktop, steps 1-8 | `results.json` | `desktop_*` |
| careers 2 and 3, step 1 alone (F2's count) + the Escape probe in career 2 | `results_f2.json` | `f2_*` |

`results*.json` holds, per step, every assertion and, under `prints`, `FLYDIY_STORE.onStand()`, `body.gEmpty`, `doc().here`,
the card's box and text, `#edRoll` / `#edWrap`, the chooser (title, tiles, what is over it), the canvas box and buffer,
`garages()`, plus page errors, console errors and warnings with their step.

    node flyDiy/tools/empty_stand_relook.js               # steps 1-8, ~31 min here (two boots, ~12.5 min each)
    node flyDiy/tools/empty_stand_relook.js --careers 2   # step 1 in two more careers, + the Escape probe
