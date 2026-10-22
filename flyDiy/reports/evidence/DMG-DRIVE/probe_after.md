### Dives (engine rpm over its rated; helical tip Mach)
| build | engine (rated) | V_NE / V_D m/s | VNE full | 1.1 VD full | VNE cruise (thr) | VNE idle | VNE key off | drive state after |
|---|---|---|---|---|---|---|---|---|
| Cub | Continental A-65 (2300) | 52.108 / 57.897 | 2580 (12.2 %), M 0.795 | 2797 (21.6 %), M 0.863 | 2300 (0.0 %), M 0.712 (0.652) | 1653 (-28.2 %), M 0.522 | 1526 (-33.6 %), M 0.486 | VNE full: - os:inspect 1.122; 1.1 VD full: - os:overhaul 1.216; VNE cruise: - os:logged 1; VNE idle: -; VNE off: - |
| Jodel | Continental A-65 (2300) | 60.351 / 67.056 | 2585 (12.4 %), M 0.77 | 2892 (25.8 %), M 0.858 | 2304 (0.2 %), M 0.691 (0.651) | 1667 (-27.5 %), M 0.515 | 1543 (-32.9 %), M 0.482 | VNE full: - os:inspect 1.124; 1.1 VD full: - os:overhaul 1.258; VNE cruise: - os:logged 1.002; VNE idle: -; VNE off: - |
| metal Cessna | Lycoming O-540-B2C5 (2575) | 71.51 / 79.456 | 2845 (10.5 %), M 0.952 | 3072 (19.3 %), M 1.031 | 2348 (-8.8 %), M 0.794 (0.472) | 1788 (-30.6 %), M 0.62 | 1640 (-36.3 %), M 0.575 | VNE full: - os:inspect 1.105; 1.1 VD full: - os:inspect 1.193; VNE cruise: -; VNE idle: -; VNE off: - |
| Cessna floats | Lycoming O-540-B2C5 (2575) | 82.303 / 91.447 | 2994 (16.3 %), M 1.005 | 3271 (27.0 %), M 1.102 | 2668 (3.6 %), M 0.901 (0.624) | 2010 (-21.9 %), M 0.698 | 1880 (-27.0 %), M 0.658 | VNE full: - os:inspect 1.163; 1.1 VD full: - os:overhaul 1.27; VNE cruise: - os:logged 1.036; VNE idle: -; VNE off: - |
| twin floatplane | Rotax 582 + 2.62 red. (6500, gear 2.62) | 52.292 / 58.102 | 7327 (12.7 %), M 0.859 | 7946 (22.2 %), M 0.934 | 6294 (-3.2 %), M 0.741 (0.55) | 4728 (-27.3 %), M 0.566 | 4375 (-32.7 %), M 0.527 | VNE full: - os:logged 1.078; 1.1 VD full: - os:inspect 1.169; VNE cruise: -; VNE idle: -; VNE off: - |

### Nose-overs (the nose falling at V; engine at 0.2)
| build | V | first contact | disc touches at s | strike registered at s | deepest bite into the disc (m, of R) | engine after | drive | broke (groups) | crashed |
|---|---|---|---|---|---|---|---|---|---|
| Cub | 2 | disc | 0.017 | 0.05 | 0.699 (0.955) | seized | stoppage (bite 0.173 R, tip 111 m/s) FAILED(stoppage) | 0 (-) | no |
| Cub | 4 | disc | 0.017 | 0.033 | 0.682 (0.955) | seized | stoppage (bite 0.153 R, tip 111 m/s) FAILED(stoppage) | 0 (-) | no |
| Cub | 8 | disc | 0.017 | 0.017 | 0.955 (0.955) | seized | stoppage (bite 0.156 R, tip 112 m/s) FAILED(stoppage) | 62 (eng:mount, stab:attach) | a wing member broke |
| Jodel | 2 | disc | 0.033 | 0.05 | 0.621 (0.915) | seized | stoppage (bite 0.173 R, tip 106 m/s) FAILED(stoppage) internal | 0 (-) | no |
| Jodel | 4 | disc | 0.017 | 0.033 | 0.618 (0.915) | seized | stoppage (bite 0.152 R, tip 106 m/s) FAILED(stoppage) internal | 0 (-) | no |
| Jodel | 8 | disc | 0.017 | 0.017 | 0.916 (0.915) | seized | stoppage (bite 0.154 R, tip 107 m/s) FAILED(stoppage) internal | 31 (eng:mount, fin:attach) | a fus member broke |
| metal Cessna | 2 | disc | 0.017 | 0.033 | 0.137 (1.03) | running | bent (bite 0.042 R, tip 134 m/s) | 0 (-) | no |
| metal Cessna | 4 | disc | 0.017 | 0.017 | 0.26 (1.03) | seized | stoppage (bite 0.157 R, tip 134 m/s) FAILED(stoppage) | 0 (-) | no |
| metal Cessna | 8 | disc | 0.017 | 0.017 | 0.941 (1.03) | seized | stoppage (bite 0.187 R, tip 134 m/s) FAILED(stoppage) | 22 (tw:gear, eng:mount) | a gear member broke |

### A floatplane's nose-in (the bow digs in; engine at 0.2)
| build | V m/s, sink m/s, pitch deg | strike | engine after | drive | broke (groups) | crashed |
|---|---|---|---|---|---|---|
| Cessna floats | 20, 1.5, 8 | NO | running | - | 0 (-) | no |
| Cessna floats | 25, 5, 20 | NO | running | - | 0 (-) | no |
| twin floatplane | 20, 1.5, 8 | NO | running, running | -, - | 0 (-) | no |
| twin floatplane | 25, 5, 20 | ground | seized, seized | stoppage (bite 0.331 R, tip 127 m/s) gb:damaged FAILED(stoppage), stoppage (bite 0.33 R, tip 127 m/s) gb:damaged FAILED(stoppage) | 0 (-) | no |

### A trunk in the disc
| build | V | strike | engine after | drive | broke (groups) | crashed |
|---|---|---|---|---|---|---|
| Cub | 3 | trunk @2.383 | seized | separation (bite 1.314 R, tip 128 m/s) FAILED(separation) | 0 (-) | no |
| Cub | 10 | trunk @2.117 | seized | separation (bite 1.314 R, tip 131 m/s) FAILED(separation) | 65 (eng:mount, wing0R:root, wing0L:root, wing0L:strut ...) | a fus member broke |
| Cub | 30 (flown) | trunk @0.183 | seized | separation (bite 1.314 R, tip 229 m/s) FAILED(separation) | 175 (eng:mount, wing0R:root, wing0L:root, wing0R:strut ...) | broke up: the fuselage parted (TPB off the core) |
| Jodel | 3 | trunk @2.45 | seized | separation (bite 1.328 R, tip 122 m/s) FAILED(separation) internal | 1 (-) | no |
| Jodel | 10 | trunk @2.15 | seized | separation (bite 1.328 R, tip 125 m/s) FAILED(separation) internal | 121 (eng:mount, wing0R:root, wing0L:root, fin:attach ...) | the airframe crushed (3.3 kJ of plastic work) |
| Jodel | 30 (flown) | trunk @0.183 | seized | separation (bite 1.328 R, tip 215 m/s) FAILED(separation) internal | 222 (eng:mount, wing0R:root, wing0L:root, gearL:gear ...) | broke up: the fuselage parted (TPB off the core) |
| metal Cessna | 3 | trunk @2.45 | seized | stoppage (bite 1.291 R, tip 154 m/s) FAILED(stoppage) | 1 (-) | no |
| metal Cessna | 10 | trunk @2.15 | seized | stoppage (bite 1.291 R, tip 156 m/s) FAILED(stoppage) | 102 (tw:gear, eng:mount, wing0R:root, wing0L:root ...) | broke up: the fuselage parted (TPB off the core) |
| metal Cessna | 30 (flown) | trunk @0.183 | seized | separation (bite 1.291 R, tip 266 m/s) FAILED(separation) | 210 (tw:gear, eng:mount, wing0R:root, wing0L:root ...) | broke up: the fuselage parted (TPB off the core) |
| Cessna floats | 3 | n/a (a floatplane on land) | | | | |
| Cessna floats | 10 | n/a (a floatplane on land) | | | | |
| Cessna floats | 30 (flown) | trunk @0.183 | seized | separation (bite 1.291 R, tip 266 m/s) FAILED(separation) internal | 229 (eng:mount, wing0R:root, wing0L:root, wing0R:strut ...) | broke up: the fuselage parted (TPB off the core) |
| twin floatplane | 3 | n/a (a floatplane on land) | | | | |
| twin floatplane | 10 | n/a (a floatplane on land) | | | | |
| twin floatplane | 30 (flown) | trunk @0.217 | seized, seized | separation (bite 1.314 R, tip 248 m/s) os:failed 1.45 gb:failed FAILED(overspeed), separation (bite 1 R, tip 239 m/s) os:failed 1.45 gb:failed FAILED(overspeed) | 190 (engL:mount, wing0L:strut, stab:attach, floatL:strut ...) | broke up: the fuselage parted (TPB off the core) |

### The mount (worst mount member's peak over its certified yield; the engine body's own members apart)
| build | full power tied down | 3.8 g pull at full power | snap-roll entry (rates rad/s: roll, yaw, pitch) | 23.473 sink | 1.5 x sink |
|---|---|---|---|---|---|
| Cub | 0.106 (ENGR-S0TR t) | 0.344 (CGE-S0TR t) nz 3.874 | 0.938 (CGE-S0TR c) w 2.914/0.951/2.002 | 0.274 (CGE-S0TR t) | 0.361 (CGE-S0TR t) |
| Jodel | 0.096 (ENGL-S0TL t) | 0.298 (CGE-S0TR t) nz 4.421 | 0.543 (CGE-S0TR c) w 2.811/1.254/2.538 | 0.258 (CGE-S0TR t) | 0.381 (CGE-S0TL t) |
| metal Cessna | 0.18 (ENGR-S0BR t) | 0.351 (CGE-S0TL t) nz 4.988 | 0.729 (CGE-S0TR c) w 2.366/1.032/2.162 | 0.312 (ENGL-S0BR t) | 0.443 (ENGL-S0BR t) |
| Cessna floats | 0.122 (ENGR-S0BR t) | 0.149 (CGE-S0TL t) nz 5.108 | 0.314 (CGE-S0BR t) w 2.761/1.631/1.909 | 0.131 (CGE-S0TL t) | 0.223 (CGE-S0TL t) |
| twin floatplane | 0.102 (ENGL-WF t) | 0.546 (MNTL-WF c) nz 4.729 | 0.655 (MNTL-WF t) w 1.491/0.801/2.542 | 0.246 (ENGR-WR c) | 0.388 (ENGL-WR c) |
