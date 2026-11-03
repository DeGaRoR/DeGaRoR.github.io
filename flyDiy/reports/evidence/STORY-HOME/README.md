# STORY-HOME-LOOK: a story career's two hangars, on the page (evidence, 3 Nov 2026)

An evidence run, not a gate and not a fix. Base: `origin/master` at `adb2d2a9` (train L30b, built). Page: the built
`index.html`, served by `tools/_serve.js`. Rig: `flyDiy/tools/story_home_look.js`, a new evidence tool that is not in
`run_gates.js`. It uses Playwright on the image's Chromium headless shell with plane_shot.js's SwiftShader flags. It loads
the page under `flydiy.test` (mapped to the server) with a browser's user agent and `navigator.webdriver` off, so
`welcome.js` takes the real-host path. Each career start is a fresh browser context (an empty profile). JPG q85.

**Renderer:** `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`.
No frame time is quoted. A boot is roughly 15 min on this renderer.

## The runs

| run | results file | stills prefix | how |
|---|---|---|---|
| A, main (desktop 1280x800) | `results.json` (its `phone` key is a stub: that pass was stopped at step 1, see below) | `desktop_*` | `--only desktop`, with `?gfx=laptop` |
| B, phone 360x800 | `results_phone_tutor0.json` | `phone_tutor0_phone_*` | `--only phone --tutor0`: steps 1 and 2 on the player's page, step 4 after a Continue reload with `?tutor=0` |
| C, desktop step 4 again | `results_tutor0.json` | `tutor0_desktop_*` | `--only desktop --tutor0 --skip 5` |
| D, phone through the device gate | `results_phone_gate.json` | `phone_gate_phone_*` | `--only phone --uamobile --nogfx --skip 4` |
| E, desktop after the F2 fix | `results_f2fix.json` | `f2fix_desktop_*` | `--only desktop --tutor0 --skip 5 --tag f2fix`, on L30c + the fix |

Why B and C exist: at T0, on the player's page, Tim's tutorial holds every click outside his band (finding F1). Run A's
map and roll-out therefore never happened. `?tutor=0` is the game's own dev flag (`app.js:10261` STORY_TUTOR_OFF): Tim's
steps keep stepping and nothing is held. With it, run C pictures step 4 at T0 on the desktop.

Why D exists: `?gfx=` skips the device gate as well as the graphics card (`welcome.js:174`). Run B used `?gfx=laptop`,
and Playwright's user-agent override leaves `navigator.userAgentData.mobile` false. So B's "phone" got the desktop menu
directly: it is a 360-px-wide page that the game treats as a computer. Run D drops `?gfx=` and sets the CDP user-agent
metadata `mobile: true`. The gate then shows ("The workshop fits in a phone"), the rig presses "try anyway
(experimental)", and New career is pressed in the menu, as a phone player would do it.

## Stills, one row each

| file | what it shows | asserts |
|---|---|---|
| `desktop_1_opening.jpg` | step 1: the opening over the cabin strip, once its black had lifted, just before Skip | PASS: FLYDIY_MODE career; no page error; `story().beat === 'T0'`; `doc().here === 'w1'` = `story().cabin.hangar`, based at `w1` = `story().cabin.aero` (Cabin Strip; no no-cabin note) |
| `desktop_2_cabin_shed.jpg` | step 2: T0 in the cabin's field shed, UI on (Tim's band, FINISH tab, Rufus on the stand) | PASS: `garages()` HOME `locked:false`, `why:''`; no "not yours yet" in body text; no page error |
| `desktop_3_beat_card.jpg` | step 3: `?storycard=1`, the beat card top-left: "THE STORY / The cabin / Your ultralight waits in the shed…" + OK. Taken at HOME (step 4 had moved `here` before this reload; see F6) | PASS: card shown (no `stNoCard`), box [12,72,296,138] top-left; title "The cabin"; no " of N" (card text: `THE STORY\nThe cabin\n\nYour ultralight waits in the shed. Make it yours - a colour, a name - then come and read the letter.\n\nOK`); no "not yours yet"; no page error |
| `desktop_4a_home_inside.jpg` | step 4: after `gotoGarage('HOME')`: HOME's club hangar inside (corrugated walls), Rufus on the stand | PASS: `{ok:true, why:'', stand:'Rufus'}`; HOME `here`; both hangars listed, HOME open; no "not yours yet" |
| `desktop_4b_map_FAIL.jpg` | step 4, player's page: the CONTRACTS pill pressed, the map never opened (5 min) | **FAIL**: map open: `{"lazy":false,"open":false,"screen":false,"img":null,"gar":0}` (F1) |
| `desktop_4d_rollout_HELD.jpg` | step 4, player's page: Roll out pressed, still in the shed after 20 min (renamed from `_rollout_outside`: it is not outside) | **FAIL**: the roll-out reached the world (body `stNoCard fl2 mode-ws stTut`) (F1). PASS: no page error |
| `desktop_5_old_save_reloaded.jpg` | step 5 (b): a save with `sheds.HOME.locked='story'` written raw to `flydiy.career.<id>`, reloaded with `?storycard=1` (Continue). The same load as step 3, so the same frame | PASS: (a) `FLYDIY_PLAYER.set` + reload: HOME open; (b) raw save + reload: HOME open, saved doc's lock gone (`locked: null`); no "not yours yet"; no page error |
| `tutor0_desktop_1_opening.jpg`, `tutor0_desktop_2_cabin_shed.jpg` | run C's own steps 1 and 2 (a second New career): the same as A | PASS (all of steps 1 and 2 again) |
| `tutor0_desktop_4a_home_inside.jpg` | run C: HOME inside after `gotoGarage('HOME')`, `?tutor=0` | PASS: `{ok:true}`; HOME here; both listed, HOME open; no "not yours yet" |
| `tutor0_desktop_4b_map_garages.jpg` | run C: the map (CONTRACTS) with both garage icons: HOME ringed (here) at Jolene AFB, the field shed at Cabin Strip | PASS: map opens, 2 `.mmGar`, none `locked`; labels "the main hangar at Jolene AFB 13/31: you are here", "the field shed at Cabin Strip: go there" |
| `tutor0_desktop_4c_map_go_row.jpg` | run C: the Go row for the cabin shed: "Go to the field shed at Cabin Strip? with Rufus / Go there / Stay" | PASS: Go row offers "Go there", no "not yours yet" |
| `tutor0_desktop_4d_rollout_outside.jpg` | run C: Roll out from HOME's garage: the aeroplane outside, but **at Cabin Strip** (route chip "Cabin Strip → Cir…") | PASS as asserted (left the shed, no page error), **but wrong field** (F2) |
| `phone_tutor0_phone_1_opening.jpg` | run B: the opening at 360x800 | PASS (step 1 as A: T0, here `w1` = the cabin's shed, no page error) |
| `phone_tutor0_phone_2_cabin_shed.jpg` | run B step 2: the desktop editor squeezed into 360 px: panels cut, no 3D view visible, CONTRACTS over the parts tree, Tim's band over ROLL OUT | PASS: HOME `locked:false`, `why:''`; no "not yours yet"; no page error. Layout: see F7 |
| `phone_tutor0_phone_4a_home_inside.jpg` | run B: after `gotoGarage('HOME')`: the same squeezed editor, no view of the hangar | PASS: `{ok:true}`; HOME here; both listed; no "not yours yet" |
| `phone_tutor0_phone_4b_map_garages.jpg` | run B: the map at 360 px, sheet with "THE STORY · 1 OF 8 / The cabin" | PASS: 2 garages, none locked, no "not yours yet". Counter on the map: F4 |
| `phone_tutor0_phone_4c_map_go_row.jpg` | run B: Go row for the cabin shed | PASS: "Go there". Its "Stay" is under the map's ✕ (F8) |
| `phone_tutor0_phone_4d_rollout_outside.jpg` | run B: roll-out, aeroplane outside (route chip "C…": Cabin Strip) | PASS as asserted, wrong field (F2) |
| `phone_gate_phone_1_opening.jpg` | run D: the opening at 360x800, after the device gate ("The workshop fits in a phone") → "try anyway (experimental)" → menu → New career | PASS: FLYDIY_MODE career; no page error; T0; here `w1` = the cabin's shed |
| `phone_gate_phone_2_cabin_shed.jpg` | run D step 2: T0 in the cabin shed, the welcome's own preset (no `?gfx=`): the same squeezed computer layout as run B | PASS: HOME `locked:false`, `why:''`; no "not yours yet"; no page error. Layout: F7 |

## garages() as printed

Step 2 (T0, at the cabin; identical in runs A, B, C, D):
```
{"id":"HOME","name":"the main hangar at Jolene AFB 13/31","aero":"HOME","here":false,"locked":false,"why":"","planes":[],"stand":null}
{"id":"w1","name":"the field shed at Cabin Strip","aero":"w1","here":true,"locked":false,"why":"","planes":["Rufus"],"stand":"Rufus"}
```
Step 4 (after `gotoGarage('HOME')`; identical in runs A, B, C):
```
{"id":"HOME","name":"the main hangar at Jolene AFB 13/31","aero":"HOME","here":true,"locked":false,"why":"","planes":[],"stand":"Rufus"}
{"id":"w1","name":"the field shed at Cabin Strip","aero":"w1","here":false,"locked":false,"why":"","planes":["Rufus"],"stand":"Rufus"}
```
Step 5 (a) after `FLYDIY_PLAYER.set` (HOME locked) + reload, and (b) after the raw locked save + reload: both the same as step 4:
```
{"id":"HOME","name":"the main hangar at Jolene AFB 13/31","aero":"HOME","here":true,"locked":false,"why":"","planes":[],"stand":"Rufus"}
{"id":"w1","name":"the field shed at Cabin Strip","aero":"w1","here":false,"locked":false,"why":"","planes":["Rufus"],"stand":"Rufus"}
```
`set()` returned a document with `sheds.HOME.locked` already gone (`null`): playerNormalise lifts the lock at the door.
The raw save held `'story'`; after the reload the saved document holds `null`.

## Failures and page errors, verbatim

- Page errors: **none** in any run (`pageerror` listener). Console errors: none.
- Run A, step 4: `FAIL the map opens (#mapEntry) with its garage icons {"lazy":false,"open":false,"screen":false,"img":null,"gar":0,"title":null}`
- Run A, step 4: `FAIL the roll-out reached the world (the shed left)` (body class `stNoCard fl2 mode-ws stTut`, after 20 min)
- Console warning on the career boots of runs A, B and C, including the first on an empty profile: `flyDiy: the saved day was not readable - the game’s day` (F9)
- A `beforeunload` dialog on each reload (accepted by the rig).
- Rig failures, now fixed in the rig (not the game): a `page.evaluate` with no timeout hung run A's first attempt at the
  map; `Emulation.setEmitTouchEventsForMouse` made Playwright's clicks hang (removed).
- Run D logged one other warning: `flyDiy: the loader fetched the town raster cells, the page composes default - those cells bake lazily`.

## F2 fixed (the user, 3 Nov: "going to HOME rolls out from HOME")

`playerGoTo(doc, id, { carry, foots })` (`71_player_bases.js`) now takes the aeroplane on the stand along when the hangar
gone to holds no aeroplane of its own. It is sent there with `playerSendTo` (free, instant: the store's send-to) and set
on that hangar's floor. The page's `gotoGarage` hands it `slotOnStand()` from the garage only; out of a flight,
`playerFlightEnd` still decides where the aeroplane stands. A hangar with its own aeroplane keeps the old rule. GATE
STORY has 10 new rows; the rig asserts it in step 4. Run E, on the built page:

| file | what it shows | asserts |
|---|---|---|
| `f2fix_desktop_4a_home_inside.jpg` | HOME's hangar after `gotoGarage('HOME')`, Rufus on the stand | PASS: `{ok:true}`; HOME here; **`rollFrom()` = `"HOME"`**; **Rufus not also listed at `w1`** |
| `f2fix_desktop_4b_map_garages.jpg` | the map, both garages | PASS: 2 garages, none locked |
| `f2fix_desktop_4c_map_go_row.jpg` | the Go row for the cabin shed, now "empty" | PASS: "Go to the field shed at Cabin Strip? / empty / Go there / Stay" |
| `f2fix_desktop_4d_rollout_outside.jpg` | Roll out: the roll-out screen, **BASE "HOME BASE · THE WWII H…"**, TO Circuit (the still caught the loading screen; its backdrop is the screen's stock image) | PASS: left the shed; body `mode-fly rollShot`; `here` HOME, `rollFrom` HOME; no page error |

`garages()` after the fix (step 4):
```
{"id":"HOME","name":"the main hangar at Jolene AFB 13/31","aero":"HOME","here":true,"locked":false,"why":"","planes":["Rufus"],"stand":"Rufus"}
{"id":"w1","name":"the field shed at Cabin Strip","aero":"w1","here":false,"locked":false,"why":"","planes":[],"stand":null}
```
New observation on that still: the roll-out screen's CLOCK reads "16:01 · 21 Jun" (the sandbox's GAME_DAY) in a career
that L30c set to 15 July (`74_career.js` CAREER_DAY0). Not investigated.

Gates on the fix (L30c + the fix): STORY, GAMEPREM, STORAGE, UISMOKE, UISMOKE-PHONE PASS. DESTTO red in two shards,
**identical on clean master L30c** (each shard run on both trees): `air:cub` capsized in ROLLOUT on w2 (shard 0/3) and
`ltd:floats` gave up in ROLLOUT on water at mk_sea (shard 2/3). Neither involves `playerGoTo`'s new option.

## Findings (named; F2 fixed since, see above)

- **F1. At T0 the player's page holds the map and Roll out, so the player cannot reach HOME yet.** Tim's step `hello`
  (`79_story.js:174`) carries no `allow`, so `storyTutorLock` (`app.js:10341`) locks everything, and `storyTutorGuard`
  (`app.js:10356`, registered `app.js:10369`) stops every click, key and touch outside `#stTim` in the capture phase.
  The CONTRACTS pill's click never reaches its `onclick`, so `map_pack`/`map_menu` are never fetched (`MAP_MENU` stays
  undefined), and `#edRoll` is held too. HOME is open in the data (`garages()`), but the Go door is held. That is
  consistent with Tim's script, but it means the "both hangars from the start" change shows only through
  `FLYDIY_PLAYER.gotoGarage`, never through a player's tap at T0. (A side probe on `?profile=phone&map=1`, with no
  story, opened the map in about 3 s, so the lazy load itself works.)
- **F2 (FIXED, see above). Going to an empty HOME kept the cabin's aeroplane on the stand, and Roll out left from the cabin.**
  `gotoGarage` (`app.js:10730-10731`) only swaps the stand when the target hangar has a plane (`n` is null for an empty
  HOME), so Rufus stays on HOME's stand. `garagesList` (`app.js:10711`) then reports Rufus as HOME's `stand` while `w1`
  still lists it in `planes` (one aeroplane in two hangars, in the printout above). `rollFromId` (`app.js:6647`, via
  `playerRollFrom`) follows Rufus's fleet row, so `FLYDIY_PLAYER.rollFrom()` is `'w1'` while `doc().here` is `'HOME'`.
  The roll-out from HOME's hangar spawns at Cabin Strip (route chip "Cabin Strip → Cir…" in
  `tutor0_desktop_4d_rollout_outside.jpg`). If the story later lets the player use the map at T0 or T1, this also lets a
  player "be at HOME" without flying there (T1's goal `stop at home`, `79_story.js:79`).
- **F3. T0/T1 words still say HOME is not ours yet.** `79_story.js:78` T1 brief: "The proposal was accepted: the old WWII
  field is ours." `79_story.js:183` (and `:111`) Tim at T1: "Good news: we got the old WWII airport." T1's `done` adds
  `{k:'hangar', at:'home', shell:'club'}` (`79_story.js:80`) for a hangar the player already holds. None of this says
  "not yours yet", but it reads as the pre-STORY-1 story.
- **F4. The map's story strip carries a step counter: "THE STORY · 1 OF 8".** `map_menu.js:421` (`S.step + ' of ' +
  S.of`), fed by `app.js:9919` from `79_story.js:629`. The beat card dropped its counter (G3356: "That's for us"); the
  map's copy did not. The brief's " of N" assert was for the card, which passes.
- **F5. The map's held-work wording.** Every contract row reads "AFTER THE MOVE-IN" and the story strip says "The rest of
  the work comes after the move-in." (`app.js:9919`, `held: 'after the move-in'`). With HOME open from T0, "move-in" is
  ambiguous to a player who is already in HOME's hangar.
- **F6. Tim and the beat card talk about "this shed" at HOME.** After `gotoGarage('HOME')` Tim's band still says
  "Morning! The ultralight has sat in this shed all winter." (`79_story.js:174`) and the card says "Your ultralight waits
  in the shed." Both are T0's cabin lines, now spoken in the WWII club hangar (`desktop_4a`, `desktop_3`).
- **F7. A phone that "tries anyway" gets the desktop editor at 360 px.** In runs B and D the garage is the
  computer layout: the left and middle panels cut off, no 3D view, the CONTRACTS pill over the parts tree's "Design &
  construction", Tim's band over ROLL OUT. The welcome says the career needs a computer, so this may be expected for
  "experimental". Recorded as a look, not a bug.
- **F8. The map's Go row at 360 px: "Stay" sits under the map's ✕ close button** (`phone_tutor0_phone_4c`). The row and
  the ✕ share the top-right corner. Desktop is fine.
- **F9. `day_clock.js:46-48` warns "the saved day was not readable" on career boots in runs A, B and C**, even on an
  empty profile's first New career. All three loaded with `?gfx=laptop`; run D (no `?gfx=`, the welcome's pick) never
  logged it. No visible effect was seen.
- **F10. Desktop 1280x800: the CONTRACTS pill covers the right panel's mask note** "…structure comes later in the story -
  paint, liveries and colours" (reads "…ture comes later…") in every garage still, and the beat card (step 3) covers
  the left panel's PLAQUE field.

## Re-running

```
node flyDiy/tools/story_home_look.js --only desktop
node flyDiy/tools/story_home_look.js --only desktop --tutor0 --skip 5
node flyDiy/tools/story_home_look.js --only phone --tutor0 --tag phone_tutor0
node flyDiy/tools/story_home_look.js --only phone --uamobile --nogfx --skip 4 --tag phone_gate
node flyDiy/tools/story_home_look.js --only desktop --tutor0 --skip 5 --tag f2fix
```
About 30 to 65 min each on SwiftShader. Runs A and C each started their own New career on a fresh profile; so did B and D.
