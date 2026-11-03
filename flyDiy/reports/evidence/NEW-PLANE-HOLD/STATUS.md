# NEW-PLANE-HOLD — the first-launch chooser held the render loop over every rig (3 Nov, A0 20:15)

Branch `claude/ready/new-plane-hold`, base origin/master `e6bcfb36` (train L30c).

**The cause, confirmed.** Since NEW-PLANE the front door is the full-screen chooser, which holds the render loop while it
is up (the user's "no rendering while choosing"). `design_flow.js maybeAutoOpen` opens it by itself on a FIRST LAUNCH
(no `flydiy.wip`). Every rig boots a fresh profile, so the chooser opened over it and nothing was drawn behind it. GATE
CLOUD's per-preset census runs `_framecost_check.js --census cub`, whose node page starts with empty storage
(`BUILDS.cub = null`): on `e6bcfb36` it read **0 composite draws** on current, gamer and ultra (3 of 239 rows red,
reproduced here).

**The fix** (`src/viewer/design_flow.js`): the rigs never get the first-launch chooser - the same test the welcome
screen and the back guard use (`WELCOME.RIG`, else `navigator.webdriver` or `HeadlessChrome`; the node page declares
`webdriver`). `?newplane=1` forces the door for a rig that wants to look at it. A real first launch is unchanged; the
NEW button is unchanged. GATE NEWPLANE gained a rule unit holding the guard in the source.

**The other Chrome / page gates** (A0's list and a grep of every `tools/_*_check.js` that launches Chrome or the node
page - 36 files): CARDS launches `--headless=new` (HeadlessChrome), PARKED and FRAMECOST run the node page
(webdriver), BACKGUARD and UISMOKE use no browser (stubs), SPLAT's `--gpu` path is still `--headless=new`; plane_shot
closes the chooser itself since NEW-PLANE. All are covered by the page-side rule; no gate needed its own change.

**Gates on this branch** (`--no-build` over its own build):

| gate | result |
|---|---|
| CLOUD | **PASS** (current / gamer / ultra: 6 composite draws each, no feedback) — was FAIL (3 of 239) on `e6bcfb36` |
| NEWPLANE, CARDS, BACKGUARD, UISMOKE, UISMOKE-PHONE, STORY | **PASS** |
| PARKED | FAIL — node out of memory (`FatalProcessOutOfMemory`), alone too (443 s); being run on master `e6bcfb36` at this push to see if it stands there |
