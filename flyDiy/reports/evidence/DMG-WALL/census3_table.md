# census3 - ONE recorded crash a case (wind off), replayed under each binding: the same wreck

Heal checks (index + static positions hashed against the fresh load, 236 geometries): taxi True, trunk-0 True, trunk-2.5 True, noseover True; garage -> roll-out after the last wreck: True

| case | camera | BEFORE: inside layers showing | AFTER | not yellow before / after |
|---|---|---|---|---|
| taxi | [150, 8, 4.5] | 1.84 {'liner': 1.35, 'struct': 0.18, 'fire': 0.02, 'sill': 0.06, 'cabin': 0.12, 'back': 0.11} | 0.30 {'struct': 0.08, 'fire': 0.02, 'back': 0.2} | 39.4 / 37.6 |
| taxi | [215, 14, 6] | 0.00 {} | 0.00 {} | 8.3 / 8.7 |
| trunk-0 | [200, 22, 14] | 32.13 {'liner': 18.24, 'fire': 1.71, 'sill': 2.18, 'cabin': 3.72, 'back': 6.28} | 19.49 {'liner': 1.27, 'struct': 0.42, 'fire': 0.98, 'sill': 0.84, 'cabin': 9.86, 'back': 6.12} | 56.4 / 51.7 |
| trunk-0 | [300, 45, 20] | 25.25 {'liner': 15.31, 'fire': 0.47, 'sill': 2.95, 'cabin': 3.93, 'back': 2.59} | 19.87 {'liner': 8.09, 'struct': 0.85, 'fire': 0.42, 'sill': 2.38, 'cabin': 4.25, 'back': 3.88} | 38.6 / 31.9 |
| trunk-0 | [120, 12, 7] | 14.51 {'liner': 7.9, 'fire': 0.48, 'sill': 1.14, 'cabin': 2.12, 'back': 2.87} | 13.54 {'liner': 3.86, 'struct': 0.16, 'fire': 0.41, 'sill': 1.04, 'cabin': 2.85, 'back': 5.22} | 44.1 / 51.6 |
| trunk-2.5 | [200, 22, 16] | 21.55 {'liner': 6.5, 'struct': 10.96, 'fire': 0.2, 'sill': 0.64, 'cabin': 1.31, 'back': 1.94} | 10.32 {'liner': 0.66, 'struct': 0.83, 'fire': 0.17, 'sill': 0.3, 'cabin': 2.78, 'back': 5.58} | 38.4 / 24.2 |
| trunk-2.5 | [250, 55, 26] | 13.82 {'liner': 7.78, 'struct': 3.41, 'fire': 0.28, 'sill': 1.03, 'cabin': 0.41, 'back': 0.91} | 2.72 {'liner': 0.75, 'struct': 0.35, 'fire': 0.06, 'sill': 0.16, 'cabin': 0.87, 'back': 0.53} | 30.3 / 24.0 |
| trunk-2.5 | [140, 15, 7] | 23.83 {'liner': 9.31, 'struct': 5.32, 'fire': 0.14, 'sill': 1.39, 'cabin': 6.56, 'back': 1.11} | 33.40 {'liner': 4.55, 'struct': 5.75, 'fire': 0.25, 'sill': 0.71, 'cabin': 11.66, 'back': 10.48} | 50.3 / 40.8 |
| noseover | [200, 22, 9] | 3.06 {'liner': 2.25, 'struct': 0.58, 'fire': 0.02, 'sill': 0.11, 'back': 0.1} | 1.29 {'liner': 0.97, 'struct': 0.13, 'fire': 0.01, 'sill': 0.06, 'back': 0.12} | 18.1 / 16.3 |
| noseover | [90, 15, 7] | 9.21 {'liner': 3.4, 'struct': 4.43, 'fire': 0.44, 'sill': 0.19, 'cabin': 0.05, 'back': 0.7} | 2.65 {'liner': 0.54, 'struct': 0.15, 'fire': 0.09, 'sill': 0.07, 'cabin': 0.32, 'back': 1.48} | 26.5 / 19.1 |
| noseover | [300, 40, 10] | 2.20 {'liner': 1.09, 'struct': 1.01, 'fire': 0.01, 'sill': 0.02, 'cabin': 0.01, 'back': 0.06} | 0.62 {'liner': 0.21, 'struct': 0.06, 'fire': 0.02, 'sill': 0.03, 'back': 0.3} | 39.7 / 38.8 |
