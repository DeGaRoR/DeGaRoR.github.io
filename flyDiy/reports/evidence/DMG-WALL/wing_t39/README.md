# DMG-WALL - wing_t39 - FLOWN, DEFAULT MODE

**Flown, default mode** (the physics worker): the page's own loop flies each crash once (placed with its speed, the trunk / stump in world.treeHits). tools/dmg_wall_census.js --worker.

## noseover - a nose-over: 12 m/s on the ground into a 35 cm stump (the wheels stopped) (flown, default mode)

verdict: {"crashed":true,"over":true,"reason":"a gear member broke","broken":9}; heal after, through the hangar: true

- `noseover_1_flown_default_mode.jpg` (+ `_cls`) - camera [200,22,9]: not yellow 36.6 % (by layer: outer 35.58, liner 0.03, struct 0.01, fire 0.03, cabin 0.14, trim 0.01, part 0.63, back 0.18)
- `noseover_2_flown_default_mode.jpg` (+ `_cls`) - camera [90,15,7]: not yellow 8.77 % (by layer: outer 8.04, struct 0.05, fire 0.01, trim 0.02, part 0.52, back 0.13)
- `noseover_3_flown_default_mode.jpg` (+ `_cls`) - camera [300,40,10]: not yellow 27.11 % (by layer: outer 26.44, liner 0.06, struct 0.01, fire 0.02, trim 0.05, part 0.44, back 0.1)
- `noseover_4_flown_default_mode.jpg` (+ `_cls`) - camera [180,72,11]: not yellow 8.41 % (by layer: outer 7.96, liner 0.03, trim 0, part 0.4, back 0.01)

## taxi - a taxi into a trunk at 3 m/s, the throttle shut (flown, default mode)

verdict: {"crashed":false,"over":false,"reason":null,"broken":0}; heal after, through the hangar: true

- `taxi_1_flown_default_mode.jpg` (+ `_cls`) - camera [150,8,4.5]: not yellow 12.65 % (by layer: outer 12.21, fire 0.01, trim 0.12, part 0.25, back 0.06)
- `taxi_2_flown_default_mode.jpg` (+ `_cls`) - camera [215,14,6]: not yellow 59.79 % (by layer: outer 59.23, struct 0.01, fire 0, trim 0.01, part 0.54, back 0)
