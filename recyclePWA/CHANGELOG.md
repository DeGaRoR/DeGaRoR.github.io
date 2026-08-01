# RECYCLE — Changelog

## v1.7.0 — Playtest fixes: economy, overload, forklift pooling (2026-08-01)
- **One-time grants no longer pollute the recurring daily P&L.** Milestone/phase rewards were booked to the same `subsidies` ledger account as the recurring per-tonne bonuses (diversion €20/t, EPR +5%), so a grant day spiked the HUD "HIER" per-day figure and let the €5k/10k/20k-per-day objectives unlock instantly. Split a dedicated one-time **`grants`** account (`LEDGER_INCOME`): `claimObjective`/phase rewards now post there, it's excluded from every recurring per-day accumulator (`recurringNet`, `careerDaily`, `recordOpexDay`), and it surfaces as a **"Subventions (ponctuelles)"** line under INVESTISSEMENT in the Bilan. `pnlReport().net` still equals `G.cash`.
- **Fixed false OVERLOAD.** The badge was a buffer-fill proxy tripping at ~46% of the backpressure buffer (`inBuf / (BUF_CAP × 0.45)`), decoupled from the rated `t.cap` — a 10 t/h unit flagged OVERLOAD at ~5 t/h. Threshold raised to ~90% of the buffer and gated by a sustained-time timer (`OVER_T`, mirrors STARVE_T/JAM_T) so transient tick-quantized spikes no longer flash. A genuine over-feed past belt capacity still reads OVERLOAD.
- **Default contract downscaled 5 → 4 t/h** on both supplier streams (Wasteminster, Binfinity) and every fallback; inbound still scales by signing more suppliers (2 contracts = 8 t/h, inside the 10 t/h belt ceiling). QC retuned.
- **Forklifts now pool on a baler.** A `some()` dedup hard-capped each baler to one active forklift, so adding forklifts couldn't relieve a full baler (you had to split the flux and add a second baler). Replaced with committed-bale reservation mirroring the loader pool, plus a **fullest-baler-first** dispatch priority; the same pooling was applied to container trucks (bulk→landfill). Export/landfill room is reserved so pooled vehicles never strand a load.
- **Sponsor achievement** ("Décroche un sponsor") now pays a **100k€ signing bonus** (routed through `grants`) on top of its permanent −20% equipment-capex perk, and the Goals card shows the "−20% équipement" perk instead of reading a bare "0 €".
- **Outgoing landfill truck** enlarged to match the bale trucks (was ~84% the size) and its hauled container reseated on the flatbed behind the cab (was overhanging the rear).
- **Not bugs, verified:** masses reconcile exactly — a bale is 0.5 t, and 4 t/h × 24 h/day = 96 t/day = 192 bales/day (was 240 at 5 t/h); realistic vs. small/mid MRFs (~5–30 t/h, 0.2–1.1 t bales). No physics/relabel change.

## v1.6.0 — Throughput pass: 10 t/h lines (2026-07-13)
- **The real ceiling was the supply contract**, not the belts: each supplier stream feeds 5 t/h (split across its bunkers), so no line could exceed 5 regardless of unit caps. Contracts stay at **5 t/h each** — inbound scales by **signing more suppliers** (2 contracts = 10 t/h, verified), not by inflating one. Belts + units are now sized so a single line carries that 10 t/h.
- **Belts carry a nominal 10 t/h regardless of length**: capacity is now throughput-derived (max×speed ≈ 10 t/h; long belts hold proportionally more in flight) instead of a fixed 14-sprite cap that silently throttled long runs to <1 t/h. Belt animation speed doubled. Conveyor speed/capacity are **re-derived on save load** (old saves are retuned automatically — behaviour changes, accepted).
- **Unit caps**: bag opener 5→10 t/h, magnet 8→10 (transport-grade stages follow the feeder; sorters stay low — parallelise them). **Feeder slider capped at 10 t/h.** Two merged feeders (e.g. 10+8) now genuinely overload a single 10 t/h belt — the intended failure mode.
- Verified end-to-end: a line fed by two 5 t/h contracts carries **10.0 t/h** (a single contract feeds 5). Reference plant re-measured: **12,285 €/day** (was 11,188 — faster baler belts). The Fable benchmark (16,669) predates this pass and needs re-establishing. New qc guard `site-throughput-10` locks the 10 t/h behaviour (45 suites).

## v1.5.0 — Throughput bug + mobile UI fixes (2026-07-13)
- **Fixed the throughput collapse**: restored saves ran the landfill truck on a stale `lfCadence:15` (from two scenario presets) instead of the intended `0.3`, throttling reject evacuation ~50×. A simple opener→magnet line at 5 t/h choked to ~0.7 t/h and jammed the whole chain. The bulk→landfill drain now keeps up; the same line runs at its 5 t/h.
- **Fixed false JAMMED**: unit state was set from a per-tick flag, so a belt saturated-but-flowing flickered JAMMED. State now needs sustained choke (material waiting, nothing moved for >1.2 s). A line at full belt capacity reads OVERLOAD (buffer full), not JAMMED.
- **Mobile UI**: (1) the tutorial coach’s “Step” placeholder no longer leaks at the page bottom (the active `#coachTut` had no hide rule); (2) inspector sliders now respond during play — the live refresh no longer rebuilds the sheet mid-drag; (3) the top HUD clears the phone status bar when the safe-area inset reports 0 (Android).

## v1.4.0 — R&D tree, prices & bonuses pass (2026-07-12)
- **R&D tree finalised.** Unit unlocks are no longer free — each is a small licence fee, distinct from the per-build capex. Branched topology (metals route = eddy; plastics route = air → NIR/film) so you choose your path. Licences: air 8k, splitter 5k, pick 10k, eddy 20k, vacuum-film 25k, NIR 45k (cheap toward low-grade products, dearer toward premium PET). Whole set 113k — real but meaningful when cash is tight.
- **Upgrades repriced down** (they were dear vs their swing): high-strength magnet 120k→60k, wide belts 120k→80k, VFD 90k→30k, trained sorters 40k→30k, new supplier/buyer 60k/50k→40k each. **Yards** (the scaling wall): 150/500/1000k → 120/350/800k — yard1 is effectively mandatory for a 27-unit plant (base is 20 slots).
- **Green subsidy trimmed** +10% → +8% to keep the full bonus + R&D stack under ×2 (measured ×1.76 on the reference plant).
- **Prices nudged**: OCC carton €95→100/t, PE film €120→130/t. All other prices unchanged (already real-anchored).
- **Achievements trimmed** on the late milestones (€10k/day 400→300k, €20k/day 600→400k) — total one-shot grants 1.95M → 1.65M; the crucial early grants (first bale, €5k/day, 80% diversion) are kept to cushion the deficit-heavy start.
- **Verified**: bootstrap (steel+PET line + air/NIR licences ≈ 1.0M of the 2.5M budget) stays well inside budget and returns ~+160 €/t; the full plant (≈ 2.76M incl. licences + yard1) is reached progressively via profit + early grants.

## v1.3.0 — R&D-gated build palette (2026-07-12)
- **Progression is now R&D-driven**: in a budgeted career the build palette only offers what you've researched. Base units (bunker, feeder, opener, magnet, baler, exports, bulk, landfill) are always available; pick, eddy, air, NIR, vacuum film extractor and splitter are greyed with an “Unlock in R&D” hint until their (free) unlock node is researched. Sandbox / free-play and scenario setup are exempt.
- **Placement safety-net** in `sitePlaceUnit` refuses a not-yet-researched unit (reason `locked`), so the gate holds even outside the palette.
- **Verified buildable within budget**: unit unlocks are free, so gating only sequences the tech walk — affordability is unchanged. A profitable bootstrap (steel + PET line ≈ 950k of the 2.5M Atelier budget) returns ~+160 €/t and funds expansion; the full reference plant (≈2.53M from the starter) is reached progressively via running profit + milestone grants.

## v1.2.0 — Vacuum film extractor (2026-07-12)
- **New unit — Vacuum film extractor** (`vfilm`): a vacuum hood + cyclone that lifts loose 2D film off the belt. Reuses the probability-sort branch verbatim (deterministic, mass-conserving — no new tick logic). Real-anchored: cap 3 t/h, 18 kW, site 160k / capex 130k, R&D unlock `r_vfilm` (free, gated behind the air line). Differentiated false-positives by liftability (film 0.88, paper 0.012, rigids ~0.003) so it clears film's three contaminant caps at once.
- **Fixes film/carton on-spec**: measured on a reference mix, the pulled stream is 97% film / 1.1% paper / 0.8% PET / 0.3% PVC — all caps cleared, ~87% of feed film captured. Additive: existing plants unchanged, no recalibration.
- Sprite cut from the uploaded machine art (border flood-fill + colour defringe → no white halo), mapped to `unit_7`.

## v1.0.0 — PWA (2026-07-12)
First served build. Split from the single-file standalone (archived as `recycle_standalone_final.html`) into a full PWA: `index.html` shell, `css/app.css`, `js/engine.js` (sentinels kept), `js/app.js`, 79 assets extracted from base64 to `assets/*.webp`, `manifest.webmanifest`, precache-everything `sw.js` (full offline), icons rendered from the wheel-loader sprite. Test harnesses rewired through a shared `tools/_load.js` resolver (accept the folder, `index.html`, or a legacy single-file build). Gameplay work shipped in the same window:

- **Reference plant replaced** by the hand-built profit-positive 27-unit / 29-connection plant (fleet 3/7/1, feeder 3 t/h) — op net ≈ +10.1 k€/day, tech tree unblocked. Belt speeds and per-node settings preserved from the authored save.
- **Atelier mode**: financial-constraint career, no tutorial — 2.5 M€, starter bays pre-placed (2 bunkers, bulk, PET + ferrous export, landfill), fleet 1/1/1. R&D fully functional without the guide.
- **Economy rebalance**: balers 220k→140k (site) / 180k→120k (capex); r_mag re-tariffed 35k→120k (its alu jackpot stays, payback 11→38 days); full R&D stack measured ×1.59 over base.
- **Achievements revamp**: 6 tutorial-centric goals replaced by Growth (first bale +200k, 5k/day +250k, 15 units +200k, 10k/day +400k, 20k/day +600k) and Impact (100 t +150k, 80% diversion +150k, corporate sponsor at 250 t). Recurring bonuses: 20 €/t diversion premium + 5% EPR subsidy on on-spec sales; sponsor covers 20% of new-equipment capex. Combined bonuses + full R&D measured ×1.82 — no runaway.
- **PVC product**: spec + default buyer (Vinyl Countdown, 90 €/t) — salvage the killer contaminant instead of paying 110 €/t to landfill it. Dedicated bale sprite + export-bay slab.
- **Rendering**: drop shadows on all raised objects (equipment, vehicles, conveyor casings, containers, bales) — none on flat zones or waste particles; grid shown only while placing/moving; right-strip baler no longer vertically flipped (180° art rotation removed for horizontal balers); uniform belt world-speed guard added to qc.
- **Sizing pass**: ctruck/lftruck unified at hl 27; supplier truck and loader −20%; containers −20% via CONT_W/H; single BALE_W/H constant across stack/belt/fork/truck-bed (client-truck bale no longer shrank).

## Single-file era

Migrated verbatim from the in-code changelog at the PWA split.

### v0.6.0-dev35
Output (export) inspector revamp. Dropped the meaningless "Throughput" row on storage (exports sell on arrival -- the rate meant nothing). Buyer + supplier selectors wrap with content-sized chips instead of stretching; the buyer chip is just name + product dot. Added Product (target + purity), Price /t, On-spec/bale price RANGE (0.8-1.2x base over a 0.5 t bale), Off-spec/bale (a loss), an explicit On-spec rule (>=threshold target, LIBERATED only, contaminant caps) + a grading note. New euroF.

### v0.6.0-dev34
Money readability + toast fix. Toasts now render above the palette/sheet (z-index 30->60) so "Not enough cash" is visible instead of hiding behind the Add panel. Global budget (HUD cash, R&D / Goals balance) and equipment cost (capex + R&D node costs) now display in k\u20AC; all amounts use a thin no-break-space thousands separator (e.g. 2\u202F000 k\u20AC). The P&L keeps full \u20AC but gains the same separator.

### v0.6.0-dev33
Bugfix: careers created before the dev30 economy reset carried an old-scale bank (which reads as ~0 against the rescaled capex), so a "new career" off a cached save started broke and couldn't even place the first unit. Careers now carry an economy version (ECON_V); loading one older than current reseeds the bank to ECON.startCash. newCareer stamps the current version.

### v0.6.0-dev32
UI polish. The top HUD bar (cash / recycling / clock / home) now persists across all three views -- it was sitting under the R&D and Goals panels (z-index); lifted above them and the panels inset below it, so the same live bar shows everywhere. Burger glyph replaced with a home icon. The start menu scrolls when it overflows a short iframe (safe-centred, overflow-y auto) so the language row / Sandbox button stay reachable on small screens. Menu tagline under the logo removed. Fix: the R&D tree no longer collapses to just the root during the tutorial (the dev27 tree-lock hid every non-focus node, so chapters with no R&D step showed nothing) -- the full tree now shows with locked nodes dimmed, the current step's node still highlighted and panned to.

### v0.6.0-dev31
Contract model correction (pre-v1). Contracts/agreements are CONTINUOUS and never expire -- only achievements track tonnage. The pmc career is now continuous from the first frame (plain standard/film contracts stay finite/legacy); the tonnage-gated phase-completion path is dead for it. Tutorial chapters advance when the COACH finishes one (new tutNextChapter(), feed untouched), the last chapter sets tutorialComplete -- there is no graduation-on-tonnage. The Intake gains a "None (idle)" supplier that stops the feed (explicit stop). Progress bar now tracks cumulative on-spec EXPORT toward the first milestone (100 t), never a contract quota. continuous/phases/progress/objectives re-baselined to the chapter+export model. Liberation model untouched. Suppliers: blue (PMC, Wasteminster) vs grey (fully-mixed, Binfinity) carry distinct composition, BAG COLOUR, and gate price -- grey is metal-poor + film/paper-heavy and pays a higher gate (volume play) while blue yields better product (margin play); the per-supplier gate now drives tipping income, and the bag sprite + legend take the active supplier's colour. Finite storage (4b): storage units hold realistic per-role volumes (input ~1 day / buffer ~hours / output ~days) via capOf(n) while process units keep the small BUF_CAP backpressure buffer; the real-estate branch (yard exts) now also enlarges the bunkers (storeCap ×1.5 each).

### v0.6.0-dev30
Economy + storage realism, slice 4a -- the capital reset (P2-4, step 4). Every number now sits in a real-world ballpark per RECYCLE_ECONOMY.md: start cash EUR2,000,000 (small-plant budget); per-unit capex in real EUR (intake/output 40k, opener 80k, magnet 35k, eddy 90k, air 120k, NIR 300k, baler 180k, pick 50k, splitter 20k, buffer 25k); campaign tonnages (tutorial phases 150/200/300 t); phase + objective rewards 40-80k; tech-node R&D costs 35k-1M (unlock-nodes stay free -- capex is the real spend); base 20 machine slots, yard exts +15/+20/+25; sim fast-forward bumped (x0.04) + an 8x speed so a campaign contract still plays in ~2-4 min. Per-tonne flows (tipping/landfill/elec/prices) UNCHANGED. Balance/tech/objectives/ progress/guardrails re-baselined to the new scale (ratios identical, only magnitudes moved). Finite storage next.

### v0.6.0-dev29
Organic tech tree, slice 3a (P2-4, step 3). The tree is now one 1->N dependency tree laid out by req topology (not class columns): techNodes() places children in their parent's angular sector, radius = depth. Nodes are coloured by their fx-family (8 families in CL_META: equipment / sorting / cost / logistics / real estate / HR / subsidies / sales). req rewired diegetically -- the eddy opens sort/cost/logistics, trained sorters hang off the pick cabin. New levers: Subsidies (+price), HR (+picking), and Sales nodes that unlock suppliers/buyers (TECHMOD.price/suppliers/buyers; Wasteminster + one buyer per spec free by default). Subsidy lifts sale price in the sell path. Intake Supplier + Output Buyer pickers (slice 3b) wire to the unlocked roster; Binfinity has a stream so switching it changes the feed.

### v0.6.0-dev28
Agreement loop (P2-4, step 2). COMPANIES registry (12 named suppliers + 8 buyers, per-language name map via coName(), default EN) + defaultBuyer() per spec. The PMC tutorial is a structured agreement with Wasteminster Council as supplier (shown in the P&L; balance sheet colours inflows green, outflows orange). Career now GRADUATES from the guided tutorial into continuous operation: no win screen, the feed runs off the supplier’s stream, the tonnage cap lifts, the tree unlocks. Career starts straight into the tutorial (no contract picker). Supplier/buyer pickers on the units land with the tree rework (dev29).

### v0.6.0-dev27
R&D + Goals legibility. Tech nodes show their NAME (not the price) on the tree face; price + effect stay in the tap sheet. The tree is LOCKED during the tutorial -- only the root and the node the tutorial points at render, so it is not a field of faint locked "ghost" circles and you cannot research ahead of the guide. Goals view fully localised: objective names, headers (Progression/Milestones), Claim/Requires/All-claimed chrome and the equipment tag all route through tr(); French strings added.

### v0.6.0-dev26
Clock + calendar; time-medal retired (P2-4, step 1). The HUD gains a date/time readout (year/day-month, HH:MM) off a pure calendar(t): 12 months x 30 days, season-derived for the parked night/seasonal cycle. The cosmetic gold/silver/bronze time-medal is gone from the win screen and balance sheet (performance is P&L + Recycling %, not speed); tierFor/G.tier stay in state pending the continuous-career rework that removes the win screen entirely.

### v0.6.0-dev25
Unit cap made visible + yard progression (P2-3). The machine-slot cap already existed (base 10 + tech); now the Add sheet shows a \u201cMachine slots X / N\u201d bar (amber\u2192red when full, hidden in sandbox), and the yard line is a real ladder: Yard extension I/II/III (+3/+4/+5, chained) taking the cap 10\u219213\u219217\u219222. Storage units (intake/output/buffer) stay uncapped.

### v0.6.0-dev24
Top stat: \u201cRecycling\u201d, recovery-based (playtest fix). The HUD/P&L stat is renamed from Diversion to Recycling and now reads recovered on-spec product \u00f7 total intake (new run-total counter G.deliveredTot), instead of (intake\u2212landfill)\u00f7intake. Stockpiling can no longer fake 100% \u2014 held material isn\u2019t recovered, so it can\u2019t pad the number; the stat now starts at 0% and is earned up. (A recent-window version of this rate comes with the P5 telemetry.)

### v0.6.0-dev23
Tech-tree core = \u201cBase equipment\u201d (P2-2). The R&D root is no longer an anonymous \u201cFacility\u201d trunk: it\u2019s now \u201cBase equipment\u201d \u2014 an owned, labelled node (equipment icon + \u2713) that tapping opens a sheet listing the starting kit (intake/output/buffer/opener/magnet/baler), the gear every contract begins with. Tier-1 research still branches from it (unchanged __root chaining); purely structural/presentational.

### v0.6.0-dev22
Storage split (P2-1). The generic \u201cStorage + role toggle\u201d is replaced by three palette units \u2014 Intake / Output / Buffer \u2014 each placing a role-keyed storage node (one engine, unchanged). The inspector role toggle is gone (role is fixed by what you place); the inspector title and on-canvas labels read the role name. Output\u2019s sell-spec selector is now generated from SPECS, so Aluminium is selectable (it wasn\u2019t \u2014 a latent gap) and any future product appears automatically. Landfill stays an Output set to dispose. Tutorial/help copy updated to the new unit names; FR strings added. Old saves (source/export/landfill/mixer) still migrate via MIG.

### v0.6.0-dev21
Phase-complete celebration beat (item 4, part 2). Clearing a phase now leads the next briefing with a green \u201c\u2713 <phase> complete\u201d banner showing +reward banked and the on-spec tonnage recovered this phase (engine records G.lastPhase at the completion point; applyPhase keeps a per-product baseline). Replaces the flat \u201cPhase complete\u201d toast. Pops in with a small spring. FR strings added.

### v0.6.0-dev20
Phase progress bar + on-spec totaliser foundation (item 4, part 1). New pure engine accessor phaseProgress() reports fill toward the phase\u2019s feed-tonnage quota (G.delivered/tonnage). A slim bar above the play dock shows \u201cPhase i/n \u00b7 <product> \u2014 x.x / N t\u201d, tinted with the product colour, filling live as you process. Foundation for P5 telemetry: per-material lifetime on-spec mass now accrues into CAREER.counters.onSpec{} at settlement (run-level per-material already in G.sold). Phase-complete celebration beat still to come (part 2).

### v0.6.0-dev19
ONE career account (playtest). Killed the cash/bank split: research, objective rewards, and contract settlement now all move the same money as tipping/sales/capex \u2014 G.cash is the live balance and CAREER.bank is just its persisted carry between contracts (fresh career seeds it with the starting capital; a new contract carries the balance instead of resetting). The R&D/Goals header now reads \u201cBalance\u201d and shows the same number as the top-left Cash. (Career tech still persists across runs \u2014 a true \u201cnew career\u201d reset comes with the career manager; that\u2019s why a replayed tutorial can skip unlocks.)

### v0.6.0-dev18
Onboarding clarity (playtest). R&D tree now distinguishes the two lock reasons: a node whose prerequisites aren\u2019t met stays heavily greyed (\u201clocked\u201d), while one you simply can\u2019t afford yet shows normally-lit with its price in amber (\u201cpoor\u201d) \u2014 so it\u2019s clear WHY a node is unavailable. Coach overlay no longer covers the first card in the Goals/R&D panels: those panels now reserve space under the fixed coach (measured, refreshed on step/view/resize).

### v0.6.0-dev17
Hit-testing, the real cause (playtest). \u201cHitboxes too low, top grabs too easily\u201d was a stale-canvas bug: #cv is CSS-sized (100%/100%) but the backing store is set manually in resize(), which only fires on window \u2018resize\u2019 \u2014 mobile URL bars resize the canvas WITHOUT that event, so the browser stretched a stale backing store (a vertical scale the hit-math didn\u2019t know about, worse farther from the top). Fix: ResizeObserver + visualViewport listeners + a size-drift guard at pointerdown keep the backing store locked to the display. Added a #hit URL-hash overlay (hit regions + last-tap crosshair) for on-device verification.

### v0.6.0-dev16
Hit-testing, the robust way (playtest). Root cause of \u201chitbox not on the visual / barely selectable\u201d: the pointer\u2192world transform read raw viewport coords and ignored where the canvas actually sits (HUD, safe-area insets, the mobile URL bar), so every tap was offset and fell through to pan. Fix is the standard node-editor pattern \u2014 one shared transform via getBoundingClientRect (syncRect on resize + each gesture), plus ports tested FIRST at finger size (screen-px radius / zoom) so port selection stays reliable at any zoom. No library, no rewrite: the canvas sim is untouched.

### v0.6.0-dev15
Inspector: drop the redundant top \u201cThroughput\u201d row on the Input storage (it showed the static placeholder cap, not the real rates) \u2014 the Input/Output rate section below is the source of truth.

### v0.6.0-dev14
Input-storage overhaul (playtest). Split the conflated rate: the CONTRACT delivers at a fixed input rate (G.contract.feedTph) and the Input storage\u2019s own rate is the OUTPUT rate (how fast it feeds the line, default = contract rate). This fixes the \u201cset 10 t/h, drains, then stops\u201d bug \u2014 output > delivery just empties the bin and runs delivery-bound, never halting. Trucks never stop: a full bin now FORCES the overflow to landfill (charged) with a popup + auto-pause instead of silently back-pressuring. Inspector shows Input rate (contract, read-only) + Output rate (settable); tutorial + FR updated. Feeder tests rewritten to the new semantics + an overflow-to-landfill regression. 92/92.

### v0.6.0-dev13
Tutorial + readability + i18n (playtest). First tutorial line rewritten in plain Input/Output terms (dropped the cryptic \u201cStorage set to Output\u201d role jargon) and fixed the undefined French \u201cbac\u201d (Landfill is now named + placed plainly). Starved hysteresis: units accumulate idle TIME and only show STARVED after 1.5s of CONTINUOUS starvation (STARVE_T), so the line no longer flickers STARVED during normal flow \u2014 applied to processors and balers alike. The P&L / balance sheet is now fully bilingual (income/costs/result/tonnage rows + FR keys).

### v0.6.0-dev12
Canvas legibility (playtest). Removed the vehicle-vs-belt edge styling: storage bundles its own receiving bin + feeder, so every vehicle trip happens INSIDE a storage unit and no on-canvas connection is a vehicle route \u2014 all edges/ports now render as uniform grey belts. Added an always-on particle legend: a compact bilingual strip above the tab bar mapping each material colour (+ the blue bag) so the new bag\u2192item colours are readable at a glance.

### v0.6.0-dev11
Bag/opener/liberation pass (playtest). Pre-opener particles render as uniform blue PMC bags (material hidden); per-material colour appears only after the opener liberates them. Bag opener is now 100% efficient (every bag opened; rng draw kept so the sequence is stable) and immune to film \u2014 the film-wrap mechanic + indicator are gone (downtime/maintenance is a later, deliberate system). On-spec now requires LIBERATION: grade() counts only item-state target, so anything baled while still bagged fails spec (bypassing the opener costs you). Ports inherit their connection regime, so a machine port on a vehicle (storage) edge renders yellow like the edge. Balance band re-baselined for the higher on-spec yield; eddy grade() tests pass buffers; +1 liberation regression test. 91/91.

### v0.6.0-dev10
Seeded engine RNG. Every sim draw now comes from a per-run seeded PRNG (G.seed + G.rngState, mulberry32) via rng() \u2014 replacing the engine\u2019s unseeded draws. Runs are reproducible per seed, and seed+state persist through save, so a reload continues the exact same sequence. The UI supplies real entropy (a fresh seed per new game); the engine stays pure. The harness routes its test seed straight into G.rngState (the old Math swap is moot now). Three guardrail tests: the engine is RNG-source-clean, runs are deterministic per seed, and rng state round-trips through save. 90/90.

### v0.6.0-dev9
Hardening sweep (from an external code review). Single source of truth for capex: removed the dead TYPES.*.capex fields (incl. the baler 150-vs-300 and storage 0-vs-40 traps) \u2014 ECON.capex is the only source now. P&L reads the run\u2019s actual start cash (G.startCash, persisted) instead of a hardcoded ECON.startCash, so it stays correct under varied scenarios. No hidden default game on boot: the menu waits for an explicit Career/Sandbox/Resume and shows no phantom Resume. Removed the dead shredder render branch and stale shredder/buyer-truck wording. Two guardrail tests pin capex single-source and P&L start-cash so the drift can\u2019t silently return. 87/87.

### v0.6.0-dev8
Progression Step 8 \u2014 tutorial integration (the arc\u2019s last step). The headline sorter unlocks (eddy/air/NIR) are no longer auto-granted: the tutorial now guides the player to the R&D tab to unlock each one (free) as the phase needs it \u2014 phase 2 the eddy, phase 3 air then NIR. Support units (splitter, picker) stay auto-granted. Each guided step carries a node target: the R&D tab pulses, and opening it pans that node into the clear centre with a glow so the coach hint never sits on the node (the modal-obscures-target rule). Unlocking returns you to Process to place it. 85/85.

### v0.6.0-dev7
Progression Step 7 \u2014 objectives UI completion (the list itself shipped in dev5). Adds objective prerequisites: a generic req chains goals (the equipment goals now run eddy\u2192air\u2192NIR in order), shown as a locked row with a "Requires \u2026" line until the earlier goal is claimed. The Goals list now live-refreshes while open \u2014 the line keeps selling in the background, so a goal flips to claimable as you watch \u2014 with scroll position preserved and swipe animations protected. 85/85.

### v0.6.0-dev6
Progression Step 6 \u2014 tech tree constellation (UI). The R&D tab is now the node graph from the mockup: Facility at the centre, three clusters (recovery / energy / yard) branching out, curved connectors that light as prereqs are met, owned/affordable/locked states, pan + pinch + zoom. Tapping a node opens its detail sheet (effect, cost, requires, research/refund) \u2014 and first pans that node into the clear upper area so the sheet never hides it (the modal-obscures-the-target note). 84/84.

### v0.6.0-dev5
Progression Step 5 \u2014 views & navigation (UI). A bottom tab bar switches three views: Process (the existing canvas), R&D and Goals, over the shared career bank. R&D lists tech by cluster with research/refund from the bank (validated: prereqs + affordability; sandbox owns all). Goals lists objectives in two sections with progress bars and a manual Claim that pays the bank and swipes the card out left; an attention dot on the Goals tab lights when a claim is ready. Added engine research/refund helpers (techResearchable/researchTech/techRefundable/refundTech). 84/84.

### v0.6.0-dev4
Progression Step 4 \u2014 objectives engine (engine only, no UI). Data-driven OBJ registry (6 starter goals: complete the tutorial, run eddy/air/NIR, export 10t, 10-unit line) over a condition vocabulary (metric-gte / event / owns). One generic evaluator turns lifetime monotonic counters (exportedOnSpec, maxUnits, profitBanked, bestDiversion, contractsWon) and event flags (tutorialComplete, unitRan) into claimable state. Manual claim pays the bank once, idempotently; hasClaimable() drives the future attention badge. Counters bump in career mode only. 81/81.

### v0.6.0-dev3
Progression Step 3 \u2014 equipment via the tree (first on-screen change). The palette is now gated by tech: base units (storage/opener/magnet/baler) are always available; eddy/air/NIR/splitter/ picker appear only once their tech is owned (Sandbox shows all). The PMC tutorial trunk grants those as the free tech nodes \u2014 phase 2 grants the eddy line, phase 3 grants air/NIR/splitter/picker (auto-granted for now; Step 8 turns this into an interactive tree-click). Placement is capped at techSlots (base 10 machines, +3 per yard tech); storage is uncapped. 73/73.

### v0.6.0-dev2
Progression Step 2 \u2014 effect engine (engine only, no UI). Data-driven TECH registry (7 starter nodes: free eddy/air/NIR unlocks, high-strength magnet, VFD, wide belts, yard) over a closed effect vocabulary (unlock/cap/kw/prob/openEff/pickEff/elec/slots). A memoized TECHMOD folds owned tech once; O(1) accessors (techCap/techKW/techProb/techOpenEff/techPickEff/techElecMult/ techSlots/unitUnlocked) are wired into the tick \u2014 capacity, energy, sorter odds, opener/picker efficiency, power cost. No-ops until owned; Sandbox owns the whole tree. 73/73.

### v0.6.0-dev1
Progression Step 1 \u2014 career bank (engine only, no UI). Adds a per-career save layer (localStorage key recycle.career): a persistent bank, an owned-tech set, a claimed-objective set, and lifetime counters. A finished contract settles its profit (cash minus start) into the bank via settleCareer, invoked from endGame; Sandbox is skipped and treats the whole tree as already unlocked (careerTechOwned). Nothing is visible yet \u2014 the bank just accrues. 66/66.

### v0.5.23
Calmer particle pace + cleaner HUD + cleaner menu. Loose particles travel ~6x slower: the master real\u2192sim time compression dropped 0.019\u21920.003. This is a visual/real-time pace change only \u2014 sim-time balance and tiers are unchanged, and the 2\u00d7/4\u00d7 buttons still apply on top. Top HUD now shows only the home button, Cash, and Diversion % (the tonnage bar and phase chip removed). Start menu flags ONE primary action in accent \u2014 Resume when a run is resumable, otherwise Career \u2014 with the others subdued; the accent button\u2019s sub-label is now dark so it\u2019s legible (was grey-on-orange). 60/60.

### v0.5.22
Flush confirm + description modal + WYSIWYG bales + language pill + tutorial nomenclature. Flush-to-landfill now asks yes/no before dumping a storage. The unit description opens in its own modal (tap the info dot) instead of expanding the inspector, so the sheet height stays fixed. Bales: a full bale travels its connection at a deliberate pace and is graded + paid the instant it reaches the Output storage \u2014 the "bales waiting" readout and the buyer-truck cadence are gone (sell-on-arrival); disposal still trucks on a cadence. The start-menu language toggle is restyled as a clean segmented pill. Tutorial wording aligned to the palette: a sell point is "a Storage set to Output", not "export"/"output". 60/60.

### v0.5.21
Per-phase retry + menu Resume + Cash P&L + paper removal in the PET tutorial. Retry on a scenario now restores a per-phase checkpoint (snapshot taken at each phase start) instead of restarting from phase 1 \u2014 phases stay separate, the run keeps its tonnage gate, the final phase\u2019s spec still decides win/offspec. The Cash stat is now tappable (the HUD was pointer-events:none) so the detailed P&L opens on tap. Phase 3 of the tutorial rebuilt to teach a CLEAN PET line: add an air classifier to blow film+paper out, magnet for steel, NIRs eject PVC \u2014 or ballots miss the \u226595% spec. A dedicated tutorial step points to the Cash P&L. Main menu no longer resets: a Resume button continues the run, and starting a new game asks to confirm first (custom modal, since the iframe blocks the native prompt). French: bales \u2192 ballots, masc. agreement, inspector labels. 60/60.

### v0.5.20
Phase fix + inspector overhaul + FR. applyPhase now zeroes the per-phase delivered tonnage, so each phase must actually be run \u2014 phase 2 no longer auto-completes from phase 1\u2019s count and jump straight to the phase-3 briefing. Inspector rebuilt: compact and height-capped (predictable), big buttons swapped for small icon actions (info / flush / cut-film / remove), description tucked behind an info toggle, body leads with parameters, limits and costs (throughput, power \u20AC/h, capex, buffer fill / limit). The sheet can be swiped down to close. Baler draws a dashed full-ballot ceiling so the max level is visible. French: bales \u2192 ballots throughout, inspector labels localized. 60/60.

### v0.5.19
Layout zones + condensed copy + French unit names. The inspector (bottom sheet) now sits above the coach banner and toasts and carries an explicit \u2715 close, and the coach hides while any sheet is open \u2014 so the close control can never be trapped under the guidance banner (dedicated zones: HUD top, coach below it, build area middle, sheet bottom). Tutorial coach copy tightened in BOTH languages, same steps and checks. Unit names now localize everywhere they show \u2014 on-canvas labels, palette, inspector titles, stream, the added toast \u2014 when FR is active. 60/60.

### v0.5.18
Bilingual EN/FR (option 2). Added a language toggle on the start menu (EN/FR, persisted to localStorage). Two-track i18n: prose (tutorial steps, phase names, briefings) carries co-located French (f/okf/name_f/briefing_f) so onboarding can never key-mismatch; short UI labels go through tr() — an English-keyed dictionary with safe English fallback (menu, HUD Cash/Diversion/Phase/Mode, palette unit names, Continue/Start/Got it/Step/Done, key toasts). First-pass French for Denis to review; inspector deep descriptions + long end-screen copy still English (a later pass). 60/60.

### v0.5.17
Icons + tutorial fixes. Added the missing BAG OPENER glyph (a slit sack with a freed item) and EDDY glyph (a rotor flinging a particle) — both rendered blank before (no case in icon()). Tutorial: the magnet-rest step now says route the rest to the Landfill OR any Storage you place (and accepts either), and a new step points out that INTAKE is the FEEDER with a settable Feed rate (t/h). 60/60.

### v0.5.16
STEP-BY-STEP TUTORIAL coach. The fleeting first toast is replaced by a persistent banner that guides one action at a time and watches the game until it is done: place each unit, wire each connection (port-aware), press play, sell the first bale — then it flashes a congrats, briefly auto-pauses on milestones, and advances. Per-phase step lists live in the engine with pure check(G) predicates (testable); the coach polls from render() so it works while paused. The PMC scenario now pre-places the scene (Intake + Ferrous export + Landfill) so the player wires a real line. Phases 2-3 have their own step sets (eddy/alu, NIR+splitter/PET). tutorial.test.js (scene / placement / port-aware wiring / save-restore). 60/60.

### v0.5.15
Publish build: head metadata for a hosted web app — description, theme-color, mobile web-app + apple-touch tags (clean "Add to Home Screen"), Open Graph link-preview tags, and an inline SVG favicon (bag + item, on-brand; no extra files). Shipped as index.html. No engine change; 56/56.

### v0.5.14
CRASH FIX (stale-save). A save written before the remodel (buffers with no aluminium key, or the old 3 size-bands) crashed the render loop with "reading '0'" — outside the boot try/catch, so it surfaced as an Uncaught Error. Three guards: cnt/comp now treat a missing material key as 0; restore runs every buffer through migrateBuf() to rebuild the current material×state shape; and SAVE_KEY bumped v2→v3 so genuinely incompatible saves are dropped to a fresh game. migrate.test.js (pre-alu restore / 3-wide migrate / missing-key cnt). 56/56.

### v0.5.13
Subsidy income lever (5.7): per-tonne PREMIUM on the active phase's product — on-spec bales of that product credit an extra €/t to Subsidies. Phase 1 carries an €80/t ferrous premium (first-pass; tune with playtest). Flows through applyPhase + plain contracts (null → no-op), baseline byte-identical. premium.test.js (credits / product-gating / plain-none). 53/53. Spine now structurally complete: scoring + phases + scenario UI + rewards + premiums.

### v0.5.12
Scenario UI (5.7). The PMC tutorial is now selectable — a card at the top of the career picker — with a BRIEFING MODAL on scenario start and on every phase transition (pauses the run; "Continue" resumes), and a PHASE CHIP in the HUD (e.g. "P1/3 · ferrous"). Wires UI.onPhase to the briefing; scenario-aware end-screen copy. UI-layer only; engine 50/50 unaffected. NEEDS BROWSER VERIFY: picker → tutorial, briefing show/dismiss, phase chip, phase-transition pause/resume.

### v0.5.11
Phase/scenario engine (5.7 spine). Scenarios = multi-phase challenges on one continuous line: each phase swaps the feed + product goal, and on completion pays a reward (→ Subsidies) and unlocks units before advancing; the last phase ends the run. The PMC tutorial is defined as data (P1 Ferrous → P2 Aluminium → P3 PET & capacity). Additive + guarded on G.scenario, so plain contracts and the canonical baseline are byte-identical. applyPhase()/paletteUnits use G.unlocked; UI.onPhase() hook for the briefing (modal still to come). phases.test.js (advance / reward / plain-unaffected). 50/50. Next: subsidy wiring + briefing/spec-sheet modals.

### v0.5.10
Product-aware scoring (5.7 groundwork). The win condition was PET-specific; it now reads the CONTRACT'S product — `contractWon()` checks ≥80% of that product on-spec + solvency, and sellBale books a per-spec on/off tally in G.sold. Standard/film keep product "PET", so the bar and the canonical baseline are unchanged. Unblocks ferrous/aluminium goals for the tutorial. scoring.test.js (ferrous/alu/solvency/PET-compat). 47/47, baseline byte-identical.

### v0.5.9
Disposal primitive completed (5.3, Bible §7/§143): disposal now batches like selling — the dispose heap accrues on arrival and a disposal truck dumps it to landfill on the cadence (charged by weight). MANUAL FLUSH-TO-LANDFILL added on any storage (inspector button): dumps its whole content (loose + waiting bales + dispose heap) by weight. Also fixed a remodel straggler: inspectEdge used the removed SZ/size (threw on tapping a bale-carrying edge). disposal.test.js (cadence / flush / mass); inFlightMass now counts seller + dispose heaps. Balance held (minCash floor lifted 332→383, in band). 43/43.

### v0.5.8
Selling-side rework (5.3, Bible §7): GRADE-AT-EVACUATION. Bales no longer sell on arrival — they accumulate at the Output seller and a buyer's truck arrives on a cadence (EVAC_CADENCE 0.45s), grades EACH bale, pays on-spec, dumps off-spec. BALES-ONLY enforced: loose material at a seller is wasted (no baler upstream = no sale). A final truck evacuates every seller at completion. Inspector shows bales-waiting; a € pops on each truck visit. selling.test.js (cadence / bales-only / reconciliation). Balance held (minCash floor 349→332, in band). 40/40. Still open in 5.3: disposal-contract cadence + manual flush-to-landfill.

### v0.5.7
Aluminium + EDDY-CURRENT SEPARATOR (ECS) — the Phase-2 jackpot. New material aluminium (silver, conductive, €1200/t). New unit: the eddy-current separator flings non-ferrous metal to its "aluminium" port (~90%), capex €300, rated to swallow full feed. MAGNET-BEFORE-EDDY is physical: any steel left in the feed is flung with the aluminium and fouls the bale (steel→alu at 80%), so skipping the magnet yields off-spec alu. Existing contracts keep alu=0, so the canonical baseline is byte-identical. eddy.test.js (recovery / sequencing / jackpot / mass). 37/37. Playable Al contract + product-aware scoring deferred to 5.7 (tutorial).

### v0.5.6
BAG'ITEM REMODEL (Bible §6 -- the truthfulness fix). Retired 3-band granulometry; particles now carry ONE liberation state: bag ' item. SHREDDER REMOVED; BAG OPENER added -- does the single bag'item liberation (OPEN_EFF 92%/pass), NEVER size-reduces, film-wrap susceptible, capex €350. Sorters gate on STATE not size: NIR (needsItem) ejects bagged material as lost yield (badge BAGGED); magnet/air act by field regardless of state. Particles render bag=square / item=round. Buffers 3'2 wide; size'st throughout. Re-banded (NNG-5): 29/30 win (seed 12 off-spec from imperfect liberation, stays solvent), cash 875'1551, minCash 349'451, mass residual 0. 33/33.

### v0.5.5
Connection + port colours by transport regime (Bible §7): connections crossing a storage boundary (zone'line) render as VEHICLE routes -- yellow dashed -- and within-line machine'machine links as CONVEYOR belts -- grey solid; ports inherit (storage-zone ports yellow, machine ports grey). Pure render change; engine + 33 tests untouched.

### v0.5.4
(1) New game now starts with just ONE input zone + ONE output zone (was 1-in/3-out); add more outputs as needed. (2) viewReset frames the camera to the placed units (fits on screen). (3) TAP-TO-INSPECT fixed for real: was a touch ghost-click -- the synthetic click after a canvas tap hit the scrim and slammed the sheet shut; scrim now closes on pointerdown with an open-guard. (4) SAVE_KEY bumped to v2 so the stale 1-in/3-out autosave is dropped.

### v0.5.3
Save-compat fix: pre-typed-storage saves (source/export/landfill/mixer nodes) crashed the boot because those TYPES no longer exist. restoreGame now MIGRATES old node types to Storage roles (source'input, export'output, landfill'output+dispose, mixer'buffer), DROPS unknown types and dangling edges, and the boot wraps restore in a guard -- any incompatible save is cleared and a fresh career starts instead of crashing.

### v0.5.2
Closed the v0.4 visual backlog: PORT CONVENTION (inlet'left / selected'up / rest'right) with labels; TAP-TO-INSPECT fixed (body-first hit-test, port nubs offset outside the body so body taps inspect & nub taps wire); DUAL WIRING (the two separated outputs are each independently tappable); SLOWER PARTICLES via the playback clock only (0.03' 0.019 -- sim + balance untouched, tests drive tick directly); HOPPER PILE-UP (rising composition pile in the unit + overload/jam outline). Engine unchanged: 33/33, canonical numbers identical.

### v0.5.1
FEEDER -- the Input storage now meters onto the line at a player-set rate (inspector dial, default 5 = unchanged balance). It is the metering bin. No burden-depth penalty: the line's own per-unit caps are the ceiling, so overfeeding overwhelms units (backpressure/ overload) with no speed-up, while underfeeding starves & drags the run. Bottleneck-capped and mass-conserving at every rate (feeder.test.js). 33/33.

### v0.5.0
TYPED STORAGE -- source/export/landfill are gone as standalone units. ONE Storage unit now carries a ROLE set in its inspector: Input (feeds the line), Output (sells PET/ferrous, or disposes to landfill), or Buffer (holds & relays). Its icon shows an in/out arrow per role. Intake, sinks, disposal and completion are driven by node.role, not node.type. Engine behaviour unchanged (30/30, canonical numbers identical); rendering + inspector reworked (needs a browser eyeball). This opens v0.5; v0.4 engine/economy/structure is closed.

### v0.4.7
Closed the testable v0.4 slice: 6 NON-NEGOTIABLES pinned at the top of the file; mixer unit removed (redundant — merging happens at storage in v0.5); NNG-6 soft-fail — no hard game-over on cash<0, the run continues and is recoverable, a poor finish reads as "in the red" not "bankrupt". VERSION constant added. Gating tests reuse a magnet as the neutral relay now the mixer is gone. 30/30; canonical numbers unchanged.

### v0.4.6
Decoupled the ENGINE (pure sim/economy/save) from the BROWSER LAYER (render/UI/wiring) inside the one file: the engine reaches the outside world only through a UI{} hook object, so it carries no DOM. The test harness now loads the ENGINE BLOCK ALONE (between the @ENGINE-START@/@ENGINE-END@ sentinels) -- the suite passing on the engine in isolation PROVES the decoupling, and a guardrail test keeps it DOM-free. Behavior identical. (Physical file-split into engine.js/ui.js lands with the v0.5 PWA graduation.)

### v0.4.5
Save/load: localStorage autosave (guarded with try/catch -- degrades gracefully where storage is blocked) persists the build + economy and restores on load, so a refresh no longer wipes progress. Career palette restricted to each contract's necessary units (discovery); sandbox shows the full toolbox. Detailed balance-sheet popup (tap the Cash HUD) via balanceSheetHTML(). Confirmed: no time-limit fail anywhere -- tiers are cosmetic.

### v0.4.4
Time-tiers (gold/silver/bronze by completion time; bronze = untimed floor) shown on the end screen; cost-center P&L surfaced there via pnlReport(). Both are tested logic. Bug fixed: newGame dropped contract.tiers. (UI HUD strip / report+briefing modals deferred to a browser-verifiable session.)

### v0.4.3
Economy centralized in one ECON block (every price/rate, current + future placeholders). Landfill/disposal now CHARGED on actual weight via dumpToLandfill() — the never-charged gate-fee bug is fixed; tipping and disposal are both strictly weight-based. Baler repriced 150→300. Line stays winnable (30/30) but thin (minCash floor ~86): honest, since the canonical line bins its steel. Ledger still reconciles to the cent.

### v0.4.2
Cost-center P&L ledger (instrumentation): tipping/sales/subsidies/labour/logistics/ power/landfill/capex, reconciling to cash to the cent. Generalizes the wage model (wages → Labour) and scaffolds Logistics & upkeep (placeholder 0) for vehicles. No cash-flow change (balance unchanged). Landfill charge stays OFF pending the 4.2 re-tune.

### v0.4.1
Doubly-gated transfers: a transfer commits only when the destination has room; a stalled output now restores the particle UNCHANGED (fixes the film-wrap leak the old pop-then-jam had on a full output). Backpressure/starvation/deadlock are emergent and mass-conservative. Behavior-preserving on the standard contract (balance unchanged).

### v0.3
Prototype: granulometry + tangler/picking-station vertical slice.
