# CERT-REVIEW — an independent review of the certification mechanism (2026-10-24, G3550-G3559)

The user, 24 Oct: *"I would also like that we do an independent review of the certification mechanism ... a
certified plane remains certified in most conditions, based on reality ... almost every flight re-certifies ... I
don't trust that system."* Earlier: *"the Rufus is tested ... not be misleading. I feel like we always invalidated
our planes much too fast."*

Method: I read the code, not its comments, and measured what I could in node on this tree (master 20a13667, train
L23b): the page's own editor layers through `tools/_load_build.js` (the JOIN-PARITY load path), the real
`src/viewer/bench.js` fingerprint over what they export. Where a claim needs the real page, it says so and
`tools/evidence/CERT-REVIEW.js` measured it on the real page (headless Chromium on `dev.html`, SwiftShader; it ran here, see §3.1).

**Status: REVIEW READY. Nothing in the game has changed. The rule in §6 waits for the user's OK.**

---

## 0. The verdict in five lines

1. The user is right. The bench certificate is withdrawn by things that are not changes to the aeroplane: every
   physics update (6 in 31 days), a passenger in a seat, a different pilot, the crew shown or hidden, a GPS fitted,
   and on the Cessna floatplane by its own load, with nothing touched (measured, §3).
2. When the certificate goes, it goes whole (all seven tests, every number) and it **forgets what it was**. The
   withdrawn row drops its fingerprint, so undoing the change cannot bring it back (`bench.js:800-806`).
3. "Every flight re-certifies" is real. After any withdrawal, the next arrival re-awards the test flight with its
   ceremony card (`bench.js:1164-1174`). Since the withdrawals in (1) are constant, the card comes back over and over.
   Meanwhile the airworthiness roundel stays off, because the bench check and the wing loading stay withdrawn.
4. The opposite failure exists too. **Damage never touches the certificate**: a damaged aeroplane keeps its roundel,
   and the free repair changes nothing (`76_economy.js:167-177`). Only an *armed* test flight that ends damaged fails.
5. There are four separate "certificates", each with its own fingerprint and version tag. They drift apart: the
   career's factory certificate is **withdrawn and billed** at the next save after a physics update
   (`76_procure.js:401, 751-760`), and it still counts the cabin light switch that G3449 removed from the bench's
   fingerprint.

The fix is one rule (§6): **a certificate belongs to the design's major rows. Game updates re-check silently and
never withdraw. Minor changes and loading never withdraw. A major change asks for only the tests it concerns and
says which change did it. Damage grounds the aeroplane until it is repaired.**

---

## 1. What "certified" means today: four stamps, not one

| # | stamp | what it is | where it lives | the player sees |
|---|---|---|---|---|
| A | **bench certificate** (+ the airworthiness "master" roundel, the stickers) | one result per bench test (`shake` bench check, `load` wing loading, `flight` test flight; advisory `dalt`, `xwind`, `hydro`, `pod`), each stamped with the day and a fingerprint. Airworthy = every *gating* test awarded (`bench.js:794-795`: shake + load + flight) | `results` in the bench closure, persisted in the save envelope's `plaque` (`bench.js:840-851`) | the plaque, the stickers and roundel on the fuselage (`stickers.js`), ROLL OUT's label (`app.js:13015-13031`), the flight HUD notice "the bench has not passed for this build" (`app.js:16160-16164`) |
| B | **structural certificate** (DMG) | each member's certified load envelope; the solver stamps the members from it | `66_gen_cert.js` (`genCertify`, key `genCertKey` `:143-155` = GEN_CERT_V + GEN_CERT + PHYSICS_V + spec), computed on the bench thread at roll-out (`app.js:11616-11650` `certKick`), cached in IndexedDB | nothing directly (it shapes how the aeroplane breaks) |
| C | **factory certificate** (career) | a maker's or used airframe arrives "factory-certified" with the validated design's numbers | `career.airframes[slot]` `{ fp, cert, factory, modified, anchored }` (`76_procure.js`), fingerprint `procureFp` `:391-403` | the contract mark and fleet cards (`75_career_wire.js:202-213`) |
| D | **acceptance evidence** | the signed acceptance legs and the logbook's flight rows that contract criteria read (`tasKmh`, `takeoffAt`, ...) | `log.accept`, `log.flights[].fp` (`app.js:9999-10000`), judged by `72_accept.js:508-575` | contract rows "needs-flight: every leg was flown before the build changed (withdrawn)"; the plaque's "proved in flight" row (`app.js:10601-10606`) |

The story listens to A (`BENCH_CERTIFIED` → `storyCertified`, `app.js:8828-8836`; beat T2's goal `k: 'certified'`,
`79_story.js:83, 252`).

Only A has the "withdrawn" behaviour the user sees. B is the model to copy (§6): when the physics changes, its key
changes and it **re-computes silently**. Nobody is ever told it was invalid.

### 1.1 Every place a certificate is created, checked, withdrawn or re-awarded

**A — the bench certificate (`src/viewer/bench.js` unless named)**

| action | where |
|---|---|
| the fingerprint | `benchStripCosmetic` `:586-617` (drops `paint`, `finish`, `meta`, the energy/system looks, `BENCH_STATE_ROWS` `:585`, cage rows at their default, frame rows as deviations `:618-681`); `benchVersionTag` `:714-718` = `'f2'` + `GEN_SPEC_V` + `PHYSICS_V`; `benchFingerprint` `:719-722`; `fpNow` `:765-775` hashes the **join's export** (`CAGE_JOIN.export()`) against `GARAGE_SPEC.cageDefaults()` |
| created (awarded) | `settle` `:944-964` (stamps `when`, `fp`, `fps`); from `runOne` `:1048-1110` (the instant and live tests: fp taken at the click); from `BENCH_FLIGHT_LOGGED` `:1164-1174` (the test flight: fp = the armed fp, else the roll-out's `outFp` `:1159`, else `fpNow()`); the master card `awardMaster` `:969+` when the last gating test lands (`:961`) |
| a test can fail it | the bench check: a design FAIL row withholds (`:102-109`); the wing loading: broke/diverged/bent > 15 % (`:179-184`); the test flight: no arrival, or damaged (`:292-311`) |
| checked | `BENCH_STATE` `:921-927` (`passed`, `certs`, `stale`), read by `stickers.js:383, 448`, `app.js:12731, 13015, 16160`, `accept_rec.js:111`; `72_accept.js:162-168` (a withdrawn shake row gives no rudder row to contracts) |
| withdrawn | `withdraw(reason)` `:800-815`, from the dirty hook `BENCH_DIRTY` `:823-838` (any rebuild: `app.js:13044` `CAGE_ON_BUILD`) when any settled fp ≠ the live fp, or one is unstamped; from `BENCH_RESTORE` `:854-910` at every load (`garage.js:923` slot/import/new, `app.js:17344` boot) when the stored fp ≠ the live fp, or fps ≠ `'f2'`, or no fp; a sync failure at a run turns the plaque off (`:1053-1063`); a new aeroplane (`GARAGE_SPEC.set`) restores an empty bench |
| re-awarded | any unarmed arrival when the flight row is not currently held (`:1169-1174`: only an arrival under the *same* fp as a *held* flight row is skipped); the master card again whenever `passed()` turns true again (`:961`); `BENCH_CERTIFIED` → the story event again (`:963`) |

**B — the structural certificate**: created `genCertify` (`66_gen_cert.js`), key `:143-155`, version `GEN_CERT_V`
`:126`; attached at roll-out/landing `app.js:11616-11650`; the bench's test to destruction reads it
(`bench.js:1021-1035`). Never withdrawn: a stale key is simply a cache miss.

**C — the factory certificate (`src/core/76_procure.js`)**: created at purchase (`procureBuyModel` and
`procureBuyUsed` `:561, 696`, `fp: procureFp(spec)`); signed on the garage's own build while it settles
(`procureAnchor` `:727-738`: provisional until the build is stable, then final); **withdrawn** by `procureOnSave`
`:744-761` on every slot save whose `procureFp` differs (`factory=false`, `modified=true`, `cert=null`, the edit
**billed**), called from `app.js:645-655`; read by `75_career_wire.js:202-213`, `77_freight_load.js:222-226`.

**D — acceptance evidence (`src/core/72_accept.js`)**: signed with the roll-out fp (`accept_rec.js:22`, `app.js:9999`);
checked `acceptLegsFor` `:508-511` and the logbook filter `:556` (`f.fp === ev.fp`); the plaque row
`acceptPlaqueLeg` `:581-587`. Any fingerprint change expires every leg and every landing row a contract counted.

---

## 2. Every trigger, and how often a player meets it

"Proven" = measured on this tree (§3). "Read" = established by reading the code, not run.

| # | trigger | what happens | stamps hit | how often a normal player meets it | proof |
|---|---|---|---|---|---|
| T1 | **a game update that bumps `PHYSICS_V` or `GEN_SPEC_V`** | at the next load `BENCH_RESTORE` withdraws every result: *"the build or its physics changed since the certificate"* (`bench.js:875-901`) | A, D (legs and landing rows expire), C (MODIFIED + billed at the next save: `procureFp`'s tag `76_procure.js:401`), B (silent recompute, fine) | **PHYSICS_V moved 6 times in 31 days** (7 Sep → 8 Oct, `60_gen_spec.js:2919-2949`), so roughly every 5 days. The last two bumps (5: G2080 torque, 6: G2470 Munk arm) say in their own entries that *"the plaque's own numbers ... do not move"*, yet both withdrew every certificate in every save. This is the Rufus' WITHDRAWN at HOME. | read + the Rufus history (`fe8435ba`) |
| T2 | **a change of fingerprint scheme** (`BENCH_FP_SCHEME`) | the same, reason *"certified under the old fingerprint"* (`bench.js:883`) | A | once so far (f1 → f2, A9, 21 Sep) | read |
| T3 | **the build's own load, nothing touched (the Cessna on floats)** | the join's measured `gear.floats.x` moves while the editor settles (the step follows the CG, the CG follows the step: `_cage_energy.js` balanceApply, `_load_build.js` 3c), so the fingerprint moves after the load. Depending on when it was stamped, the restore or the next dirty hook withdraws it: *"the build changed"* | A, D | **every load of a floatplane** | **proven in node** (§3.1): `0eed4c37 → 3a55b61f → 486838d7` over the load's three rounds, the one diff `gear.floats.x 1.2923 → 1.2272`. Cub, Jodel, metal Cessna and Rufus are steady. **Proven on the page too** (§3.1): `ba141769 → 040bab61`, a certificate stamped on the settled value withdrawn at the reload. The procure code already knew this (*"the C172's cabin box and seat stations, the twin's drawn engine stations and the floats' station move after the load door"*, `76_procure.js:720-726`) and protected only C against it |
| T4 | **a passenger in a seat** (`paxOcc<n>`; on a side-by-side the right seat `cabOcc`) | the occupancy rows are listed as STATE (`BENCH_STATE_ROWS`), but the join writes them again as `cabin.occupied / pilots / pax` (`_cage_join.js:476, 1736-1749`), and those are hashed. Every certificate is withdrawn | A, D (C if then saved) | **every time the cabin is loaded for a job**. W&B, not a change | **proven in node**: Cub, one passenger aboard → `11419de2 → ac258478`, the diff `cabin.pax 0→1, cabin.occupied [1,0]→[1,1]` |
| T5 | **a different pilot in the seat / the crew hidden** (`pilotWho`, `crewOn`) | `pilotWho` and `crewOn` are not state rows; the energy layer also re-shapes a bayless tank to the crew's feet (the Cub's nose tank 27 → 24 L with pilot 2; 37 L with the crew hidden), so even the *tank* moves | A, D | every time the player changes who sits. The career's hired pilot wears their body through `CAGE_CREW_PILOT` (`app.js:8550`, `_cage_crew.js:3546-3551`) without writing `pilotWho`. Whether that body re-shapes the tank on the page is **not measured** | **proven in node** (pilotWho 0→2: `→ 420ed77b`; crewOn 0: `→ 12a838bf`) |
| T6 | **minor avionics** (a GPS, a radio, the panel tier: `systems.*`) | the whole `systems` block except `look` is hashed: withdrawn | A, D | whenever the panel is touched | **proven in node**: GPS fitted → `97331bad` |
| T7 | **any real design edit, however small** | every result is withdrawn, the advisory ones included, whether the test concerns the change or not (a fuel tank resize withdraws the wing loading). The withdrawn row keeps only `{stale, was, ok:false, when, why}`: **its fingerprint and its numbers are thrown away** (`bench.js:803-805`), so dragging the slider back cannot restore it | A, D, C | every edit session | read |
| T8 | **damage** | an armed test flight that ends damaged fails the flight row (`bench.js:296-311`). Nothing else: a damaged aeroplane flown by hand keeps every certificate and its roundel (an unarmed non-arrival is ignored, `:1169`). The career's damage record (`fleet[slot].damage`) and its repair (`econRepair` `76_economy.js:167-177`, free; `careerCrashReset` `75_career_wire.js:286-298`) never touch any certificate | none, which is the bug | every crash the player walks away from | read |
| T9 | **the flight's award, replayed** | an unarmed arrival re-awards the flight row with its card whenever it is not held (`bench.js:1169-1174`). After T1/T3-T7 it is never held, so the card comes back after the next landing. A *failed* armed flight replaces a held flight certificate (`settle` overwrites) | A | **after every withdrawal, at the next landing**: this is the user's *"almost every flight re-certifies"* | read |
| T10 | an unstamped result (a save from before G208) | withdrawn at the restore *"certified before fingerprints"* | A | old saves only | read |

**What does NOT withdraw today** (measured, Cub): a repaint (the join does not export paint), the light switches
(G3449). Not measured: a lamp *fitted*, the registration (stripped as `meta`).

**The career's factory certificate (C) has its own drift**: `PROCURE_STATE_ROWS` (`76_procure.js:64`) lacks the
G3449 light-switch rows that `BENCH_STATE_ROWS` gained, so **switching the cabin flood on and saving makes a bought
aeroplane MODIFIED and bills it** (read; the list is a copy that was not kept in step).

### 2.1 Why the player sees "every flight re-certifies"

Load the floatplane: T3 withdraws the bench. Or load anything after an update: T1. Or put a passenger in for a job:
T4. Then fly it: the arrival awards the test flight again with its card (T9), but the roundel does not come back,
because the bench check and the wing loading stay struck. Back in the garage, the next load or seat change withdraws
again. So the flight card returns over and over, the HUD says *"the bench has not passed for this build"* on every
flight, and the contract rows fall back to *"needs-flight ... (withdrawn)"*. **What the player sees is accurate
about the code. The code is withdrawing for no reason.**

---

## 3. Measurements

### 3.1 The fingerprint at a load, nothing touched (node: the page's own editor layers)

`_load_build.js`'s child chain (the editor's layers, the join, the second round, the CG handshake, the energy
write-back), with `CAGE_JOIN.export()` captured after every round and an extra rebuild at the end; the hash is
`bench.js`'s own (`benchStripCosmetic` + `benchCanon` + `benchHash`), against the editor's defaults:

| build | round 1 | round 2 | CG handshake | after the write-back | extra rebuild |
|---|---|---|---|---|---|
| Cub | 11419de2 | 11419de2 | — | 11419de2 | 11419de2 |
| Jodel | 3c2f8318 | 3c2f8318 | — | 3c2f8318 | 3c2f8318 |
| metal Cessna | bee27d93 | bee27d93 | — | bee27d93 | bee27d93 |
| **Cessna floats** | **0eed4c37** | **3a55b61f** | **486838d7** | 486838d7 | 486838d7 |
| Rufus | 3f4540a5 | 3f4540a5 | — | 3f4540a5 | 3f4540a5 |

(The absolute values are node's. The page hashes the frame rows through its UI's frame table, and my node hash of
Rufus (`0ec85e6b` with that table) does not reproduce the page's `a77a11c0`. The floats' moving row is
`gear.floats.x`, an ordinary non-frame row hashed as written, so the drift carries over to the page.)

**On the real page** (`tools/evidence/CERT-REVIEW.js`, headless Chromium + SwiftShader, `dev.html`, run here):
measured on this tree, 24 Oct, 45 s of samples per door, one fresh boot per build:

| build | the load door (`GARAGE_SPEC.set`), `BENCH_FP()` each second | a bench check certificate stamped on the SETTLED fp, re-loaded through the slot door (`GARAGE_SPEC.load`) | the file's own plaque |
|---|---|---|---|
| **Cessna floats** | **`ba141769 → 040bab61`: moved with no input** | **WITHDRAWN at once**: *"the build or its physics changed since the certificate"* (the restore compared the pre-handshake `ba141769`) | withdrawn 17 Sep, no fp |
| Cub | `7072b5e6` steady | kept, all 45 s | none |
| Rufus (master's file) | `a77a11c0` steady | kept, all 45 s | stamp `5a8b130e` (PHYSICS_V 4): **withdrawn**, *"the build or its physics changed"*. The live `a77a11c0` is exactly the stamp the pending re-stamp (`fe8435ba`, `claude/ready/rufus-plaque`) carries, so that file will load held on master |

So T3 is real on the page: **a floatplane certified on its settled build loses the certificate at its next load**, with nothing touched.

### 3.2 What withdraws (node, the Cub, one change at a time through the page's editor layers)

| change | fingerprint | verdict today | real world |
|---|---|---|---|
| none | 11419de2 | — | — |
| a passenger aboard (`paxOcc1`) | ac258478 | **withdraws** | loading: W&B within limits, no re-approval |
| a different pilot (`pilotWho`) | 420ed77b | **withdraws** (and the nose tank 27 → 24 L) | nothing |
| crew hidden (`crewOn` 0) | 12a838bf | **withdraws** (tank 27 → 37 L) | nothing (a display toggle) |
| a GPS fitted | 97331bad | **withdraws** | minor alteration: logbook entry, W&B update |
| a repaint | 11419de2 | keeps | keeps |

### 3.3 Static margin of the validated planes (node, `genShakedown` with the loading corners)

| build | as drawn | worst corner (which) | the bench row today | under a 0.05 warn line |
|---|---|---|---|---|
| Cub | 0.156 | **0.027** (full cabin, reserves) | pass | **warn** |
| Jodel | **0.049** | **0.030** (solo, reserves) | pass | **warn** |
| metal Cessna | 0.242 | 0.152 | pass | pass |
| Cessna floats | 0.313 | 0.232 | pass | pass |
| Rufus | 0.176 | 0.165 | pass | pass |

---

## 4. CERT-SLIM (G2840), read critically

The branch `claude/cert-slim-g2840` (`1c7969ec`, `3da6621f`, 12 Oct; cut 18 Oct, never merged) answered the user's
*"make the tests shorter"*. It made the certificate = the bench check + the test flight, folded hot-and-high into the
bench check, made the wing loading a quiet computed bonus, made the crosswind row conditional on a contract, and
added a five-number fiche and a red/yellow list. It was a good **presentation** change. Its fiche and attention list
are worth reviving, and so is "the wing loading computed off the stand".

**It did not touch a single withdrawal trigger.** Same fingerprint, same version tag, same `withdraw()` dropping the
fp, same replayed flight card. It would have made each re-certification cheaper (one short card instead of a 7.5 s
watched rig and a 17-35 s crosswind ladder), which hides the problem rather than fixing it. The user's complaint now
is not that re-certifying is long. It is that it is asked for when nothing changed. Take CERT-SLIM's fiche *after*
this rule, not instead of it.

---

## 5. The real-world rule

- **The type certificate** (the design) and **the certificate of airworthiness** (this airframe, conforming to that
  design and in a condition for safe operation) **stay valid**. They are not re-issued per flight, per season, per
  software release of anything.
- **Re-approval follows a MAJOR change** (FAR 21.93 / 43 Appendix A, as recalled): structure; wing (span, area,
  section, incidence); tail and control surfaces; the engine or the propeller; the gear type (wheels ↔ floats ↔ skis);
  the fuel system; a weight & balance change beyond the certified limits; a major repair. That means a conformity
  check, the relevant tests, a check flight.
- **Not a re-approval**: a repaint, a registration, minor avionics (a logbook entry and a W&B update), who is aboard,
  the cargo, the fuel aboard (all W&B, the pilot's job, within the limits), a flight, a software update to anything.
- **Damage** makes an aircraft **unairworthy** until repaired; the repair is inspected and signed off, then a check
  flight for a major one. It is not "decertified": the design is still certified, this airframe is grounded.
- **Operating limits** are read off the certificate every flight: MTOW, the CG range, the placards. Being outside
  them makes *this flight* illegal, not the certificate void.

---

## 6. THE PROPOSED RULE (the user decides)

### R1. The certificate belongs to the design's MAJOR rows
A new fingerprint scheme **`f3` = the MAJOR fingerprint**: what the player designed, not what the join measured and
not which game version measured it.
- **In**: the cage rows that differ from the default aeroplane, minus the minor and state rows below (structure,
  fuselage, wing, tail, controls, engine/propeller preset, gear type and geometry, seat *capacity*, tank *capacity
  and position*, a pod); the energy layer's vessel design (bay, capacity, form); the engine and propeller rows.
- **Out**: everything the join **measures** from those rows (`gear.floats.x`, `cabin.glazedM2`, `cabin.seatsX`,
  `cabin.occupied/pilots/pax`, the derived areas; T3 and T4 die here), the **minor** rows (`systems.*` avionics and
  instruments, lamps fitted, crew and pilot choice, occupancy, the fuel aboard; T4-T6 die here), cosmetics as today,
  and **no version tag** (T1 and T2 die here).
- The rule for which rows count is **a list in one place**, shared by A, C and D (the bench, `procureFp`, the
  acceptance legs) so the copies cannot drift apart again (the G3449 / `PROCURE_STATE_ROWS` gap).

### R2. Minor changes and loading never withdraw
They update the **weight & balance** live. A loading outside the certified envelope (over the certified gross, CG
outside the corners' range) is an **operating limit**: the flight notice says *"over the certified weight"* or
*"CG aft of the certified range"*. Nothing is withdrawn.

### R3. A game update never withdraws: it re-checks silently
Each result records the versions it was measured under (`sv`, `pv`, beside `fp`). When they differ from the
running game's, the certificate **stays held**, and the bench re-runs its instant check in the background (the bench
check = `genShakedown` + the design rows, already on the sheet thread: 0.4-0.9 s). This is what the structural
certificate B already does.
- still passes → re-stamped with the new versions, one logbook line (*"re-checked under the 24 Oct update: holds"*);
- now **fails** (a FAIL row, or it no longer flies a circuit) → the certificate is **suspended**, not withdrawn: the
  row, the number and the fix (*"after the update of 24 Oct the bench check finds: static margin -0.01 at full cabin,
  reserves → move the CG 4 cm forward"*). Fixing it re-runs the check; it is not a re-certification;
- the wing loading and the test flight are **kept** across an update. The structure and the airframe did not change;
  only the model did, and the structural certificate B re-computes by itself.

### R4. A major change asks for re-certification: only the tests it concerns, and it says which change did it
The major fingerprint is kept **per group** (wing & structure / engine & propeller / gear / tail & controls / tanks &
seats & pod), so the bench can name the change and its tests:

| change | re-run |
|---|---|
| wing, structure, bracing | the bench check (itself), the wing loading, the test flight |
| engine, propeller | the bench check, the test flight (hot-and-high if held) |
| gear type or geometry (floats!) | the bench check, the test flight (+ the hydroplane) |
| tail, control surfaces | the bench check, the test flight |
| tank capacity / position, seat capacity, pod | the bench check (W&B) |

The instant check re-runs itself; the others are asked for in one line that names the change (*"the wing changed:
span 10.7 → 11.2 m. Wing loading and test flight to re-run"*). The superseded result keeps its numbers and its
fingerprint (struck through), so **undoing the change restores it**, with no re-test.

### R5. Damage grounds the aeroplane; the repair returns it
A flight that ends with structural damage (DMG's verdict, the career's `fleet[slot].damage`) **suspends
airworthiness**: the roundel greys out, *"grounded: damaged (the left strut). Repair it"*. The repair (`econRepair`,
`careerCrashReset`) clears it, and the next arrival is the check flight that brings the roundel back (option b below
skips the flight). A crash with no damage is not an event for the certificate.

### R6. Flights never re-award
A flight of a certified aeroplane is a flight. The test flight is awarded **once**: the first arrival after the
bench check, or after a major change that asks for it. The card is never replayed, and the master card shows once
per certification, not once per return.

### 6.1 Migration (nothing lost that was earned)
- **M1, stamped results (f2)**: at the first restore under f3, a result whose f2 fingerprint matches the live build
  under **any** `(GEN_SPEC_V, PHYSICS_V)` pair that ever existed (v ≤ 10, p ≤ 6: a handful of hashes of the same
  body, on the page) was measured on this same aeroplane, so it is **re-stamped f3 silently**, keeping its date, and
  the R3 re-check runs once. This rescues **the Rufus' story file as it is on master** (stamped on PHYSICS_V 4) with
  no re-stamp file.
- **M2, already withdrawn (no fingerprint)**: `withdraw()` threw the fp away, so "same aeroplane" cannot be
  proven. They stay withdrawn, honestly, and one run of the bench restores them (the Cessna files in
  `bugReports/`). From f3 on, a withdrawn row keeps its fp and numbers (R4), so this never happens again.
- **M3, career factory certificates (C)**: `procureFp` drops its version tag (`p1` → `p2`) and uses R1's list. An
  airframe made MODIFIED by a version bump alone (its `fpFile`/old fp reproducible under an older tag over the
  same spec) gets its factory certificate back. Its bill was 0 when the ledger did not move; if it billed, the line
  is refunded.
- **M4, acceptance legs and logbook rows (D)**: evaluated against the live f3 *and* the live f2 candidates of M1, so
  contract progress made before the change is kept.

### 6.2 The validated planes keep their stamps, and how Phase 2 proves it
On master today, of the user's validated planes, **only the Rufus carries a bench certificate, and on master it is
WITHDRAWN** (stamped on PHYSICS_V 4; the re-stamp `fe8435ba` waits on `claude/ready/rufus-plaque`). The Cub and
Jodel files carry no plaque; the two Cessna files carry ones withdrawn on 17 Sep. In the career, the four maker
models carry factory certificates (C). The proof in Phase 2:
- Rufus: both the master file (f2/p4) and the re-stamped file (f2/p6) load **held** under f3, through M1, on the
  page (the evidence script: today the p4 file loads withdrawn, and the page's live fp is the re-stamp's `a77a11c0`), and in node through a gate row that stamps and restores in the same harness;
- the floatplane: the f3 fingerprint is the same over every round of its load (the §3.1 harness becomes a gate row);
- the career's four models: GATE PROCURE with a simulated `PHYSICS_V + 1`: no airframe turns MODIFIED, no bill;
- T4-T6 each become a GATE BENCH "keeps" row, and each major group a "withdraws, and names the change" row.

---

## 7. The static margin: two thresholds on one quantity

Today (code read):

| reader | loading it reads | red / fail | orange / warn | green |
|---|---|---|---|---|
| bench design check `pitch.sm` (`64b_gen_design.js:240-256`): what certifies and what the plaque's design rows show | the **worst loading corner** (solo/full cabin × full fuel/reserves) | < 0 → FAIL, withholds | < **0.02**, or > 0.40 as drawn | otherwise |
| the plaque's "static margin" row (`plaque.js:284`) | **as loaded** | < 0 | < **0.05** | ≥ 0.05 |
| the garage's CG/NP posts (`app.js:10899, 10906`) | **as loaded** (the live balance job) | < **0.05** (one colour) | — | ≥ 0.05 |
| T-P1's posts (RUFUS's line) | as loaded | < 0 | 0-0.05, or > 0.40 | 0.05-0.40 |
| the belly pod row (`bench.js:456`) | the pod full | < **0.05** refused | — | — |

The bench's own fix text already aims at 0.05 (*"move the CG forward by (0.05 − sm) × c"*, `64b_gen_design.js:251`):
**0.02 is the odd one out.**

**Decision proposed:**
1. **One set of bands everywhere: red < 0, orange 0-0.05 or > 0.40, green 0.05-0.40.** 0.05 is the light-aircraft
   rule of thumb for hands-off pitch stability (5-10 %, the low end); the bench's warn line moves 0.02 → 0.05. The
   **FAIL line stays at 0**: a WARN still certifies, so **no certificate changes**.
2. **Which loading:** the **bench reads the worst corner**. That is what a weight & balance sheet certifies: the
   aeroplane is stable anywhere in its certified CG range. **The indicator and the plaque read the live loading**,
   because they answer *"as it stands now"*. With the same bands, the two can only disagree one way: the bench warns
   about a corner worse than the current loading. The bench row then names the corner (it already does: *"at the
   worst loading corner (full cabin · reserves) 0.027"*), and under R2 the flight notice says when the live loading
   leaves the certified range.
3. **The indicator's one line (RUFUS's):** keep T-P1's bands as they are, read as loaded. Nothing more.
4. **Consequence to know:** the **Cub (0.027 at full cabin, reserves) and the Jodel (0.030 solo with reserves; 0.049
   as drawn) will show an orange "static margin" pointer** on the bench check. They still certify, and both
   already carry a design verdict of `warn` from other rows. That is honest about the model's own numbers. If the
   user thinks the real Cub is not that close to neutral at its aft corner, that is a question about the Cub model's
   loading corners, not about the line.

---

## 8. What the player sees (one honest line, the garage look)

The bench header carries exactly one line about the certificate:

| state | the line | the look |
|---|---|---|
| held | **Airworthy** · certified 20 Oct · re-checked 24 Oct | the roundel, the stickers |
| held, after an update, checked | (the same line: "re-checked" carries the date) | unchanged |
| minor change / loading | (nothing; the W&B rows move) | unchanged |
| loading outside the certified range | **Airworthy** · this loading: CG aft of the certified range (the flight notice too) | unchanged; the CG post orange/red |
| major change | **Re-certification needed** · the wing changed (span 10.7 → 11.2 m): wing loading, test flight | the roundel greyed; the old rows struck through, numbers kept |
| suspended by an update | **Suspended** after the 24 Oct update · static margin −0.01 at full cabin, reserves → move the CG 4 cm forward | the roundel greyed, an amber "re-check" mark |
| damaged | **Grounded** · damaged (the left strut): repair it | the roundel greyed, a red tag |

ROLL OUT is never locked (as today), and the HUD notice speaks only in the last four states, never for a version.

---

## 9. Phase 2 (after the user's OK): where it lands

Extending the existing code, no parallel system:
- `bench.js`: `benchMajorFingerprint` (f3, per-group), the shared row list, `withdraw()` keeping fp/numbers and
  naming the group, `BENCH_RESTORE` doing M1 and R3 (suspend instead of withdraw), `BENCH_FLIGHT_LOGGED` R6, R5's
  grounded state from `fleet[slot].damage` / the flight's DMG verdict;
- `76_procure.js`: `procureFp` on the shared list, no version tag; M3;
- `72_accept.js` / `accept_rec.js`: M4;
- `64b_gen_design.js:243`: 0.02 → 0.05;
- `plaque.js` / `app.js`: the one header line, the HUD notice's states.

Gates to run, from grepping `tools/` for the readers: BENCH, DESIGNCHECK, ACCEPT, PROCURE, STORY, CONTRACTS,
DMGCERT, DMGINSTRUMENTS, POD, CARDS, SPECFIX, SHEETWORKER (`node tools/run_gates.js --only=... --no-build`), plus
new GATE BENCH rows for §6.2.

## 10. The questions for the user

1. **The rule**: R1-R6 as written?
2. **Minor list**: avionics/instruments, lamps fitted, who sits, the crew shown, the fuel aboard, the cargo: never
   withdraw. Seat **capacity** and tank **capacity** = major (W&B group, the bench check re-runs itself). Agreed?
3. **Damage**: grounded until repaired, then (a) the next arrival is the check flight, or (b) the repair alone
   returns it?
4. **Already-withdrawn certificates with no fingerprint** (M2): stay withdrawn, one bench run restores them. Agreed?
5. **Static margin**: bench warn 0.05 at the worst corner (FAIL stays < 0); the indicator and the plaque as loaded,
   same bands. The Cub and the Jodel then show an orange pointer. Agreed?
6. **Per-test relevance** (R4's table) rather than "every test again"?
