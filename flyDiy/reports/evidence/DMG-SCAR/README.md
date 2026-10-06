# DMG-SCAR (G2357-G2360) - the evidence

The ground's scar after a crash: the physics' record (src/core/34_scar.js), the grass cull (src/viewer/cover_ring.js
`scar`), the decal (src/viewer/ground_scar.js). Node only; the coordinator shoots the box stills.

| file | what |
|---|---|
| `scars.svg` | THE PICTURE. Every standard crash on the three validated builds (the certificate stamped), top-down, one panel each at its own scale: the ground contacts GATE DMGSCAR's own reader saw (grey dots: a node that is not a wheel with its bottom on the ground, every frame), the CG's track (blue), the hub (orange, last frame), and the scar the solver sealed - the sweep (pale green, its width per leg), the gouges (brown strips at their footprint width; the propeller's slots darker), the craters (dark discs at their torn-turf radius). Made by `node tools/dmg_scar_evidence.js`. |
| `scars.json` | Every case's primitives as the hop carries them, their count, bytes and the record's counters. |
| `gate_dmgscar.txt` | GATE DMGSCAR's whole output (`node tools/_dmg_scar_check.js`). |
| `gate_dmgscar.json` | The gate's per-build results (every primitive, the hashes with / without the record, the hop, the page's cull / decal per crash). |
| `selftest.txt` | `node tools/_dmg_scar_check.js --selftest`: the gate with the record disabled (params.scar false) goes red. |
| `solver_bits.txt` | The solver's bits on 18 runs (6 standard crashes x 3 builds), damage OFF and ON, the base core (origin/claude/dmg-integration 9500f197) against this branch: identical. |
| `battery.txt` | The targeted battery (run_gates --only=..., --jobs=4): DMGSCAR, every DMG* gate, TREECRASH, TREEHIT, UISMOKE, BUILD, JOIN, LOAD, COVER. |
| `off_bytes.txt` | LOAD / UISMOKE / BUILD / JOIN with damage off (the default): this branch's outputs against the base's. |

## The numbers' sources (AS RECALLED - A0 to open)

| constant | value | source |
|---|---|---|
| `qB` - the soil's resistance to a blow (crater volume = E / qB) | 200 kPa | ultimate bearing of a turfed topsoil / loam, 100-300 kPa: Terzaghi's bearing capacity on a weak cohesive soil; Bowles, *Foundation Analysis and Design*, presumptive values (soft clay ~75, medium clay / loose sand 100-200, stiff clay 200-400 kPa) - the middle |
| `qP` - a plough's specific draft (furrow section = kP x friction / qP) | 60 kPa | ASAE D497 / tillage tables: mouldboard plough 30-50 (sandy loam), 50-80 (loam), 80-140 (clay) kN per m2 of furrow section - a loam |
| `kP` - the share of the sliding friction that ploughs | 0.5 | **GAME** |
| `rim`, `spoil` - torn turf round a bowl (x its radius), spoil each side of a furrow (x its depth) | 1.4, 1.0 | **GAME** |
| `eArm` - a scrape with no break needs this much contact work to scar | 250 J | **GAME** |
| `eCrater` - the least blow that digs a bowl | 300 J | **GAME** |
| `SCAR.W` - contact width by the member's ledger section | fuselage 0.2, wings 0.15, tail 0.1, engines 0.3, bracing 0.06, gear 0.08 m | **GAME** |
| `blade` - a propeller's slot width (+ its spoil) | 0.12 m | **GAME** |
| `hSweep` - a node lower than this sweeps the shrubs | 1.2 m | **GAME** (a shrub's height, the cover ring's 0.4-1.4 m) |

The bowl: a shallow paraboloid of depth r_b / 3, V = pi r_b^3 / 6 = E / qB. The prop's slot: the chord a bite b cuts from a
disc of radius R, 2 sqrt(2 R b - b^2), b deep (DMG-DRIVE's own bite).

The decal's texture is generated in ground_scar.js (value noise, 128 x 128 RGBA, 64 KB): no file, nothing to credit.
