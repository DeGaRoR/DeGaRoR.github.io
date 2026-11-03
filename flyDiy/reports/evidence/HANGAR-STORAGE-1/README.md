# HANGAR-STORAGE-1 (G2690-G2694) - evidence

- `gates.txt` - `node tools/run_gates.js --only=STORAGE,GAMEPREM,PLAYER,SAVE,BUILD,LAZY,UISMOKE,UISMOKE-PHONE,DESTTO --jobs=4`
  (UISMOKE / UISMOKE-PHONE red there on a syntax slip in the gate's own log line - fixed and re-run: `gates_uismoke.txt`)
- `gates_uismoke.txt` - UISMOKE + UISMOKE-PHONE after the fix: PASS; `uismoke_desktop.txt` - the desktop smoke's full log
- `parked.txt` - GATE PARKED full (the page in node), alone: PASS, 196 checks, 7 min 52 s
- `storage_selftest.txt`, `gameprem_selftest.txt` - the two selftests (13 / 13; GAMEPREM every break honest)
- `destto_store_cub.txt` - DESTTO's store:cub case with --show (inside: lined up; apron: the stand, the taxi)
- `storage_*.jpg` + `shots.json` - tools/storage_shot.js (headless Chromium / SwiftShader; every still on a loaded page:
  BOOT gone + 2 s); shots.json carries the page's own answers per still (the view, the status line, the font, how the
  phone's taps were delivered)
