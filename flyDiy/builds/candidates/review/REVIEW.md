# Candidates for review (the user, 2 Nov)

Since 4 Nov (the three lists, `builds/lists/plane_lists.json`, GATE PLANELISTS) a plane left here is on the INTERNAL list: nothing is
deleted, the gates keep their files, and the All planes screen shows it to the dev only. Birdman, the v7 twin, the v8 pusher and
twinBoomFail were promoted to the pool on 4 Nov.

These planes were found in the repo. They are **not offered in game** and are not in `../index.json`. They stay here until
the user has reviewed them: AIRCRAFT-LOOKS renders their portraits, and the user promotes the ones they want.

To promote one: `git mv` it up one folder, then add its row to `../index.json` (file, name, note, from).
GATE CANDIDATES then checks it with the offered pool. Each file is a copy with its plaque dropped. The originals stay
where they were.

| file | the plane | where it came from | why it is here |
|---|---|---|---|
| build_v7_ultralight_2026-09-05.json | a single-seat ultralight (5 Sep, a v7 file) | tools/fixtures/ | found in the repo |
| composite_jodel_2026-10-07.json | JodelGlass, the Jodel D112 in composite and glass (7 Oct) | builds/ | found in the repo |
| stol_cub_kit.json | the Cub with the STOL kit (STOL-WING-2 G2824) | tools/fixtures/ | an earlier step of the offered STOL Cub (stol_cub_showcase: the same kit plus a Rotax 915 iS, a three-blade prop and tundra tyres) - unsure whether the user wants both |
| cub_quadwin_2026-10.json | the Cub with four rear windows (WINDOWS-FREE) | tools/fixtures/ | the plain Cub with a feature demo, a sibling of the offered cub_fittings_hand (2 Nov): neither is a configuration change - unsure whether the user wants both |
| Twin_busher_floats_3b.json | Twin busher floats _3b: FLAGSHIP's _3 on the Rotax 916 iS (2 Nov) | claude/ready/flagship (FLAGSHIP filed it in builds/candidates/) | a FLAGSHIP alternative, not picked: the user picked _4b (2 Nov ~22:25) |
| Twin_busher_floats_4.json | Twin busher floats _4: FLAGSHIP's _3 with the least sweep that stays green (2 Nov) | claude/ready/flagship (FLAGSHIP filed it in builds/candidates/) | a FLAGSHIP alternative, not picked: the user picked _4b (2 Nov ~22:25) |
| Twin_busher_floats_2.json | Twin busher floats, the user's twin pusher on floats as first built on the phone (2 Nov) | the user's phone export (evidence 2026-11-02/phone/) | REPLACED in the offered pool by Twin_busher_floats_4b (the user's pick 2 Nov ~22:25); kept here, not offered |
| Twin_busher_floats_3.json | Twin busher floats 3: FLAGSHIP's stabilised twin (drawn = flown, a drawn back window) (2 Nov) | claude/ready/flagship | REPLACED in the offered pool by Twin_busher_floats_4b (the user's pick 2 Nov ~22:25); kept here, not offered |
| cub_fittings_hand_2026-10.json | the Cub with its fittings placed by hand (FITTINGS-MANUAL, 2 Nov) | the pool, 4 Nov | INTERNAL (the user 4 Nov): from a test, not merged into the official Cub |
| sailPlane.json | sailPlane, the user's export | evidence 2026-11-04/candidates-user/ | INTERNAL (the user 4 Nov) |
