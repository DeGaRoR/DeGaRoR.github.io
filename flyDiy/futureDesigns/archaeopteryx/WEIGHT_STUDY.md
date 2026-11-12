# WEIGHT HAS A PRICE - a study of light structure for the Archaeopteryx and every card after it (2026-11-12)

The ask (the user, 12 Nov, once the card was frozen as v1): "launch the study on weight. So do a lot of suggestions on
how we could handle elegantly this thing, and it has to have a weight, meaning that if I put such a lightweight wing,
for example, on another plane, it should probably break at some point. So let's offer the ultralight options, but with
the cost in terms of rigidity. Study first."

This is a study: nothing here is built. Section 6 lists the decisions it needs from the user.

## 0. In one paragraph

Today a part cannot be light, because everything structural is sized for the aeroplane it is on. Mass, strength and
stiffness are three separately calibrated channels, and all three follow the aeroplane's own design gross. So a light
wing does not exist. If it did, it would grow to fit any fuselage and could never break.

The proposal is one idea: **rated structure**. Each structural part carries the load it was built for: a design gross
in kg and a load factor in g (its **rating**). Its mass, strength and stiffness come from that rating, not from the
aeroplane. On its own aeroplane it holds what any certified part holds. On a heavier one it bends more and breaks
sooner, by a ratio anyone can read: **it breaks at n_ult × rating / actual weight**.

Absent, the rating follows the aeroplane, which is exactly today's behaviour, so every saved build stays identical.
The ultralight options are then construction rows and fixed-item rows that are honest at a low rating.

## 1. What the code does today (measured, with file references)

A read of the current tree (`wm` at v1), confirmed line by line where it matters:

**Mass:**
- Every member is billed at `0.5 · L · lin[class] · gauge` to its two ends (`src/core/61_gen_frame.js:528-554`).
- Every panel is billed at `area · cover · gauge` (`:664-693`), into a ledger by section (`:612-653`).
- The gauge is Raymer's resizing: `(W0 / refGross)^e`, with e = fus 0.30, wing 0.49, tail 0.41, gear 0.75, clamped
  0.6 to 3 (`GEN_GAUGE`, `60_gen_spec.js:1968`).
- W0 is the aeroplane's design gross, a fixed point (`genDesignGross`, `61_gen_frame.js:4185`).

**Strength:**
- A member's section is `A = max(lin · gauge, lin) / rho` (`61_gen_frame.js:477`). The section never drops below
  the ungauged row, so a light gauge saves mass but never strength.
- The certificate (`66_gen_cert.js`) flies the FAR 23 cases on *this* aeroplane at 3.8 g. It stamps each member to
  break at about 1.5 × 1.05 × its own limit load, capped by physics (A · sigma, Euler for tubes).
- So every certified aeroplane breaks near 6 g. Only a member whose physics cannot reach that ("the bad design the
  bench finds", `30_solver.js:877`) breaks sooner.

**Stiffness:**
- The wing's spring is `k.wing × KS × wingK`.
- `KS = (loaded mass / the fuselage row's refMass)^0.85`, clamped 0.45 to 4 (`61_gen_frame.js:4277`).
- So the spring follows the **aeroplane's** mass, not the wing's own section or mass.

**Hence: a light wing on a heavy aeroplane today:**
1. It is re-thickened by the gauge.
2. It is stiffened by KS.
3. It is certified on the heavy aeroplane's loads.

The headroom is huge anyway: a carbon wing member is 129 mm² × 600 MPa = 77 kN.

**Where the Archaeopteryx's mass sits (the birth card, v1):**
- 154 kg empty: wings 46.7, engines 36.0, fuselage 26.4, outfit 14.1, tail 8.2, bracing 6.8, gear 5.5, paint 5.1,
  furnishings 3.0, panel 2.1.
- The real aeroplane: 54 kg as a glider, parachute included, about 72 kg with its electric drive (`STUDY.md` §2).
- By section (`STUDY.md` §4):

| section | ours | the real one (estimate) | ratio |
|---|---|---|---|
| wing | 46.7 kg, 3.6 kg/m² | ~25 kg, ~1.9 kg/m² | ×1.9 |
| bracing | 6.8 | ~1 | ×7 |
| fuselage | 26.4 | ~14 | ×1.9 |
| tail | 8.2 | ~3 | ×2.7 |
| outfit | 14.1 | ~4 | ×3.5 |

**The binding fact.** `STUDY.md` measured it: lowering the gauge floor to 0.25 saves 0.7 kg. The mass is in the rows:
the per-metre member rates, the per-m² covers and the fixed items, all fitted on 400-600 kg aeroplanes. A light card
needs light rows. Light rows need a cost, or every card would use them. That cost is the subject here.

## 2. The keystone: rated structure

### 2.1 The rating

Each structural part (wing, tail, fuselage, gear; later the mast and the keel) gets a **rating**:
- `R`: the design gross it was built for, in kg;
- `nR`: its limit load factor, in g;
- together, a design load `R · nR` (kg·g).

**Absent, `R` is the aeroplane's own W0 and `nR` is 3.8:** today, bit for bit. The rating appears only when a
builder picks a lighter (or heavier) standard, and once set it **stays with the part**: in the saved build, through
an edit that makes the aeroplane heavier, and onto another aeroplane.

### 2.2 What the rating drives

| channel | today | rated | file |
|---|---|---|---|
| mass | `lin · (W0/refGross)^e` | `lin_row · (R·nR / (refGross·3.8))^e` | `61_gen_frame.js:528-554`, `60_gen_spec.js:1968` |
| strength | `A = max(lin·g, lin)/rho`: floored | `A = lin·g_R/rho`, **no floor**: the section is what was paid for | `61_gen_frame.js:477` |
| stiffness | `KS` from the aeroplane's mass | `KS_part` from `R` | `61_gen_frame.js:4277` |
| certificate | demand at W0, n = 3.8 | **unchanged**: demand at the actual W0, capped by the rated physics | `66_gen_cert.js`, `30_solver.js:880-905` |

The certificate is left alone on purpose. It already measures the real demand and caps each member at its physics.
So a part rated below its aeroplane is found by the existing path: the bench sees a member whose physics is under
1.5 × its limit load, and the stamp records where it breaks.

### 2.3 The law the player can read

For the strength-critical members, demand grows with the weight and the rated section does not:

    n_break ≈ n_ult × (R · nR) / (W · 3.8)        (n_ult = 1.5 × 3.8 = 5.7 g)

| the part | on | breaks at |
|---|---|---|
| a wing rated 250 kg | its 240 kg Archaeopteryx | ~5.9 g: certified |
| the same wing | a 400 kg ultralight | ~3.6 g: it holds 1 g, a hard pull-up breaks it |
| the same wing | a 600 kg two-seater | ~2.4 g: a gust, a steep turn, a bounced landing |
| the same wing | a 1 000 kg tourer | ~1.4 g: on the take-off run |

**The stiffness side is the "cost in rigidity" the user asked for.** Tip deflection grows as W / k, and k is set by
R, not W. On the 600 kg aeroplane that wing bends about 2.5 times as far at 1 g, and the drawn flex shows it
(`50_model_codec.js:165-200` already draws the simulated spar).

### 2.4 Why it is elegant

- One number per part, read in kg and g. Nothing else to calibrate: the gauge law, the certificate and the crash
  rows are the existing ones.
- Mass, strength and stiffness move together for the first time, as they do in a real structure.
- The mismatch is not a rule ("this wing is not allowed here"). It is physics the player can test: on the load-test
  bench (`65_gen_loadtest.js`: "BROKE AT 2.4 g"), in the air, or on a bounced landing.

## 3. The ultralight options (the suggestions)

Grouped by what they cost and what they save. Each is a garage row (REF_MATCH's rule: a missing control becomes a row).

### 3.1 The build standard: one tile, then per part

**S1. A Build standard tile** (the `BUILD STANDARD row` `tools/_weight_check.js:45-51` and HANDOVER already say is
owed). It sets the rating of every structural part at once:

| standard | nR (limit) | reference | for |
|---|---|---|---|
| Hang glider / foot-launch | +4 / -2 | the DHV / LTF hang-glider classes | Archaeopteryx, the Swift, the Atos |
| Microlight | +4 / -2 | LTF-UL, UK BCAR S | the `ul1`, MW5, trikes |
| Glider | +5.3 / -2.65 | CS-22 | motorgliders |
| Normal | +3.8 / -1.52 | FAR 23 | every card today (the default) |
| Utility | +4.4 / -1.76 | FAR 23 | trainers, bush |
| Aerobatic | +6 / -3 | FAR 23 | the Pitts |

- The standard also sets `R`. The tile's own pick is "this aeroplane as it is now", **frozen**: the rating stops
  following edits.
- The plaque prints it: "Built to: microlight, 250 kg, +4 / -2 g".
- A light standard is not free on the ground either: the gear's rating sets its sink-rate limit (S6).

**S2. Per-part override.** Each part's own rating row (wing, tail, fuselage, gear; later the mast and the keel), each
with a badge in the part tree: **"rated 250 kg · this aeroplane 240 kg"**, green, amber within 10 % over, red beyond.
This is the "light wing on another plane" case made visible before anyone flies.

**S3. The rating rides with the part.** A wing copied to another build keeps its R, nR and row, and is not re-gauged.
It is the same wing, so it breaks at the law's g.

### 3.2 Light construction rows (where the kilograms are)

**S4. A light-glider wing row: the carbon D-tube.**
- Construction: a carbon D-tube spar, carbon ribs, Mylar or fabric aft. The Archaeopteryx's, the Swift's, the Atos's.
- Its `refGross` is about 190 kg, so the gauge thins it at a microlift's weight. Cover about 0.6 kg/m², against the
  moulded carbon row's 1.6.
- Its k is about 0.5 × carbon's: it flexes visibly (the cost).
- `STUDY.md` §5: this is where 40-50 kg of the gap lives.

**S5. The tent (`CONFIG_STUDY.md` §3, already designed).**
- A `GEN_MATERIALS` row for the nacelle's non-structural members: thin poles with a small lin, a low k and Euler
  buckling on, under a ripstop at ~0.15 kg/m².
- Its `GEN_CRASH` row folds first.
- Materials by role: the keel, the mast and the V struts carbon; the rest the tent.
- It collapses under load **by the solver's own physics**. The cost: a heavy landing folds the cabin, not the keel.

**S6. A light gear class.**
- The bicycle wheel (`whProfile 3`) is already in. Two more pieces are needed:
  - a sink-rate rating (0.9 m/s for a foot-launch class against FAR 23's ~3 m/s), wired to the existing drop case;
  - a light leg (a carbon blade on the monowheel's fork).
- The cost: a firm landing on a light gear bends or breaks it (the DMGGEAR path).

**S7. A pinned carry-through.**
- A cantilever wing on a light pod is billed as the cantilever box: 7-8 kg on a carbon pod, 37 kg on a tube pod
  (`STUDY.md` §5).
- The real one is six pins and their fittings (~1 kg). A "pinned to the hub" rule would carry the wing's moment
  through the hub and the mast (already in the frame: `GEN_HANG`).
- The cost: the fittings become the weak link. The cert's `uFit` 1 already stamps fittings; a light standard lowers
  their rating.

**S8. A light tail row.** The tail at 8.2 kg against ~3: a foam-core carbon fin and stab, `tailSection` × 0.6, with
the rating's stiffness. The cost: rudder and elevator flutter at a lower speed (S10).

### 3.3 The fixed items (the kilograms nobody sees)

**S9. A minimal outfit standard.** One row with these pieces:
- **Seat:** a sling or bucket at 1.5 kg against the seat library's 4-8; the tube & sling seat exists, its mass
  billed light.
- **Controls:** `GEN_OUTFIT` bills 0.62 kg/m × reach (about 7 kg here); push-pull carbon rods and Dyneema run
  about 0.15 kg/m.
- **Glazing:** 3.6 kg/m² is aeroplane acrylic; 0.5 mm PETG or polycarbonate film is about 0.7 kg/m². The cost: it
  crazes and cracks (the DMGGLASS path, at a lower strain).
- **Paint:** off (bare carbon is a finish already: `paint.job bare`).
- **Panel:** the minimal tier still bills ASI, altimeter, tacho, oil and compass (1.9 kg). Add a vario-only tier at
  0.3 kg.
- **Engine:** an electric pusher in the 8-12 kW class (the e-PPG row is 7 kg), not the E-811's 30 kg.

### 3.4 Where the rigidity cost shows (so a light build is a choice, not a free win)

**S10. A Vne from stiffness: flutter.**
- Flutter speed scales as √(k / m). A rated-light, soft wing or tail gets a lower placard Vne, computed the same way
  for every part.
- Past it, the existing damage path takes the surface: a flutter case in the certificate at Vd that excites the
  hinge.
- This is the most honest "rigidity" cost: the light Archaeopteryx is a 100 km/h aeroplane because of it.

**S11. Visible bending.**
- At the rating, the wing tip rises its design deflection, about 8-10 % of the semispan for a hang-glider wing
  against ~3 % for a 172.
- It is drawn already (the spar flex). The study's point is to calibrate k from R so that it happens.
- In the garage: a "1 g / limit g" pose toggle on the bench.

**S12. Gusts.** The certificate has **no gust case today** (`66_gen_cert.js` flies the V-n corners, the bench, the
drop, the mount and the ground cases). Add one: the FAR 23 gust line, whose load factor grows as the wing loading
falls. A light, low-loaded wing sees larger gust load factors, and its rating decides whether it holds. Rough-air
flying becomes a real limit. (Nothing in the core models flutter either: S10 is new too.)

**S13. Fatigue and wear.**
- Rated-light parts age faster under use: `econAging`, a factor on the cycles counted above, say, 0.5 × nR.
- Hard landings and gusts shorten their life.
- The workshop sells a "re-rate" (a heavier spar cap) at a price.

**S14. Price.** Light is expensive. Carbon pre-preg and labour per kg saved: the price rows rise as the rating falls
below the aeroplane's natural gauge. A builder trades money and rigidity for kilograms.

### 3.5 The garage's feedback (so the player can judge it)

**S15. A weight-and-strength strip** on the part tree's root:
- empty / gross / each part's rating against the aeroplane's weight;
- the weakest part named: "the wing breaks first, at 4.1 g".

**S16. The load-test bench reads the ratings.** `makeLoadTest` already loads n × the weight and reports BROKE AT n g.
With rated parts it will report the real number, and the break will be where the law says.

**S17. A "what if" slider.** Add X kg of payload and watch the weakest-part g fall. It is the same law, read live: the
designer's view of "if I put this wing on another plane".

## 4. The physics plumbing (what would change, file by file)

The smallest set, each one absent-safe (no rating means today):

1. **The spec:** `wings[k].rated = { kg, n }`, `tail.rated`, `fuselage.rated`, `gear.rated`. Clamped (kg 60 to
   4 000, n 2 to 9); written only when a builder rates.
2. **`60_gen_spec.js`:**
   - `GEN_GAUGE` takes a part's `R · nR / 3.8` in place of W0 when rated;
   - the light rows (S4, S5, S8) and the standards table (S1);
   - `GEN_CRASH` rows for the tent and the film glazing.
3. **`61_gen_frame.js`:**
   - the section's floor (`:477`) is dropped for a rated part (the section is what was paid for);
   - `KS` per section from the part's rating (`:4277`), the fuselage's for the body as today.
4. **`66_gen_cert.js`:**
   - nothing new for strength: the stamps already cap at physics;
   - S10 adds a flutter case;
   - the cache key (`genCertKey`) gains the ratings.
5. **The garage:**
   - the Build standard tile and the per-part rows (`_cage_design.js`, `_cage_parts.js`);
   - the badges and the strip (S15);
   - the join writes `rated` (`_cage_join.js`).
6. **The gates:**
   - WEIGHT gains the hang-glider class band;
   - a new **GATE RATED**:
     - a rated wing on its own aeroplane certifies;
     - the same wing on a 2.4 × heavier one breaks within 10 % of the law's g on the bench;
     - its tip deflection grows with W / R;
     - every card without a rating hashes identical (the fleet hash used for v1).

## 5. The Archaeopteryx's path to ~72 kg

What each suggestion recovers on this card (estimates against `STUDY.md` §4's split; to be measured in phase 1):

| step | saves | empty after | the cost it brings |
|---|---|---|---|
| v1 today | | 154 kg | |
| E-811 30 kg to an 8-12 kW electric pusher (exists) + pack | ~10 net | ~144 | range |
| S4 the carbon D-tube wing at its 190 kg rating | ~20 | ~124 | flex, a lower Vne |
| S7 the pinned carry-through | ~6 | ~118 | the fittings rated |
| S5 the tent nacelle (keel, mast, struts carbon) | ~12 | ~106 | a hard landing folds the cabin |
| S8 the light tail | ~5 | ~101 | flutter speed |
| S9 the minimal outfit (seat, rods, film glazing, no paint, vario panel) | ~18 | ~83 | glazing cracks, no paint |
| S6 the light gear | ~3 | ~80 | sink-rate limit |
| the hang-glider standard (R 250, +4 g) over all of it | ~5-8 | **~72-75** | breaks at ~3.6 g on a 400 kg plane |

## 6. Decisions for the user

1. **The keystone first?** Build rated structure (S1-S3 with GATE RATED) before any light row, so the light rows
   arrive with their cost already in force? (Recommended: yes. Otherwise a light row is a free win.)
2. **One rating or two numbers?** `R` and `nR` separately (kg and g, as the plaque would print them), or a single
   "design load" in kg·g? (Recommended: two, picked together by the standard.)
3. **Does a rating follow edits?** Once set, frozen (a heavier edit turns the badge amber), or following the aeroplane
   until the builder locks it? (Recommended: the standard tile freezes it; untouched cards follow as today.)
4. **Which rigidity costs, and in what order?** Visible bending (S11, nearly free) and the load-test bench (S16, free)
   first; flutter Vne (S10) and gusts (S12) next; fatigue (S13) with the economy.
5. **The tent:** `CONFIG_STUDY.md` §3's role materials as designed, or wait for the rated keystone?
6. **Moving parts between aeroplanes:** is there to be a real "fit this wing to that aeroplane" action in the shed,
   or is the case only "this build got heavier"? (The law covers both; the UI differs.)

## 7. Phases (when decided)

| phase | what | done when |
|---|---|---|
| 0 | measure: the v1 card's weakest-member g at 1×, 1.5×, 2.4× its gross, today (the headroom) | a table in this file |
| 1 | the keystone: `rated` on the wing only, the floor and KS per part, GATE RATED, the badge | the wing breaks at the law's g on a heavier card |
| 2 | the standard tile, every structural part rated, the plaque | the WEIGHT gate's hang-glider band |
| 3 | the light rows: D-tube wing, light tail, tent, pinned carry-through, light gear | the Archaeopteryx at or under ~85 kg, certified at its standard |
| 4 | the fixed items (S9) and the electric pusher | ~72-75 kg |
| 5 | the rigidity costs: flutter Vne, gusts, fatigue, price | each its gate |
