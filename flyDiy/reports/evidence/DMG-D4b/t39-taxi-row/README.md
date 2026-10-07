# DMG-D4b on the train-39 assembly: the DMGWRECK taxi row (2026-10-07 10:40-10:46, cpu DMG-D4b, node only)

**The code**: claude/dmg-d4b-t39 ed0a83b8, off the train-39 assembly claude/dmg-t39 58d853c6 (DMG-DRIVE2 ab53b8e4 and DMG-WALL in it).
**The row**: DRIVE2 grades the strike at the hub's band. At 3 m/s, throttle shut, the spinner crushes on the trunk first
and no blade strikes it. The old row ("the 3 m/s taxi into a trunk strikes the prop") went red on all three aeroplanes.
It now asserts two things: the nose / spinner crushes on the trunk (DRIVE's nose element); and a strike is drawn only as
DRIVE grades one. The prop strike on a trunk is asserted on trunk-0 (30 m/s, the centreline).

- `DMGWRECK.txt`: PASS, 160/160. The taxi crush: Cub 13.4 cm, Jodel 11.8 cm, Cessna 19.9 cm (the spinner layer), no
  strike graded. Trunk-0: the prop struck on the trunk (Cub and Jodel 'separation', Cessna 'stoppage').
- `DMGUPLOAD.txt`: PASS, 0 stale buffers (Cub 366, metal 427), damage OFF 0 heal marks. NOTE: on this assembly the
  Cub's crash is mild (12 broken, 2 wreck bodies; 210 / 11 on D4b's READY). A breaking-up Cub staging is added for train 41.
