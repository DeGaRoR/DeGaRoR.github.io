# Playtest Report #001 — First Contact

**Date:** March 2026  
**Build:** v16.9.1  
**Tester profile:** Non-engineer, no chemical process background. Plays Car Mechanic Simulator, Roadcraft, PowerWash Simulator, a shipyard sim. Tendency for clickers. Watched Denis play Kerbal for hours as "copilot" — understood complex satellite mission plans and provided key numbers at critical moments. Won't plan or fly, but loves understanding systems and seeing them work. Not a sim player per se, but deeply attracted to mechanical/tactile satisfaction loops.  
**Facilitator:** Denis (developer)  
**Mission attempted:** Condense water from a reservoir vent (prototype of Mission 1: "Get Water")  
**Duration:** ~45 minutes  
**Outcome:** Completed with heavy facilitator assistance

---

## Executive Summary

The tester demonstrated strong spatial reasoning and natural discovery instincts — he found the open tank and air cooler on his own, understood the cooler concept immediately, and correctly diagnosed that the tank needed cooling upstream. But the game's interface, vocabulary, and feedback systems created friction at nearly every step. The core loop of "try → fail → understand → fix" works in principle, but the "understand" step is where we lose players. Failures happen silently, diagnostics are hidden behind extra clicks, and recovery requires knowledge the game hasn't taught yet.

The single most impactful finding: **the catastrophic failure modal tells you something broke but not why, and not what to do about it.** The player had to dismiss the modal and manually inspect units to find the cause. This is the exact moment where engagement is most fragile.

---

## Findings by Severity

### P0 — Blocked the player entirely (needed facilitator intervention)

**F-01: Catastrophic modal blocks the drama instead of debriefing it**  
When equipment is destroyed, the modal fires immediately, covering the canvas. The player never sees the destruction happen — the fried overlay, the red X, the smoke, whatever visual effects exist are hidden behind a popup the instant they appear. This is backwards. In Kerbal, you watch your rocket tear itself apart in slow motion, debris spinning away, before the flight summary screen appears. The dramatic moment IS the teaching moment — the player sees which part failed, sees the cascade, builds physical intuition. Then the debrief screen gives them stats and options.

PTIS currently does: catastrophe → instant modal wall → player reads text about something they never saw → clicks "Continue" or "Revert" without understanding what happened. The modal has no diagnostic content (just unit names), blocks the visual feedback, and interrupts the game rhythm.

*Impact:* The catastrophic event — which should be the most memorable, most educational moment in the game — is the least informative. The player learns nothing from it because they literally can't see it.  
*Recommendation:* Three-phase catastrophe sequence:

**Phase 1 — The Drama (2-3 seconds):** Auto-pause simulation. Camera zooms to the destroyed unit. Fried overlay, red flash, smoke/steam effects play out visibly. Player watches the destruction happen. No modal yet.

**Phase 2 — The Debrief (modal appears after delay):** Semi-transparent modal slides in from the side or bottom, not covering the destroyed unit. Contains: what broke (unit name + material description), why it broke (the limit that was exceeded, actual value vs limit, in plain language: "Tank pressure hit 6.2 bar — polypropylene ruptures above 5 bar"), what to do about it (one-line hint: "Add a relief valve, or reduce inlet pressure"). The diagnostic data exists in AlarmSystem — it just needs to be surfaced here.

**Phase 3 — The Choice:** Two clear buttons: "⏪ Revert to before the failure" and "Continue with damaged equipment." Both already exist — they just need better placement and the diagnostic context above them.

This matches Kerbal's post-crash flow: drama → stats → choice. The modal becomes a learning tool instead of a wall.

**F-02: Reservoir CV/opening defaults produce unusable flow**  
Reservoir was placed at 400K / 15 bar with default opening at 0%. Player got zero flow and couldn't understand why. Facilitator had to set opening to 10% before anything worked.

*Impact:* Complete blocker for unsupervised play.  
*Recommendation:* Default opening should be non-zero (e.g. 50% for T1 reservoir). A unit that produces nothing by default teaches the player nothing. Alternatively, the first mission should explicitly state "set the opening to X%" — but better to have sensible defaults.

**F-03: Air cooler couldn't cool below ~160°C regardless of configuration**  
Two air coolers in series still couldn't reach condensation temperature. Root cause was oversized source flow relative to cooler capacity at T1 sizing.

*Impact:* Player concluded the game was broken. Said "I would have shut down the game."  
*Recommendation:* This is a dimensioning problem. The first mission needs either pre-sized equipment or a smaller source flow that T1 coolers can handle. The game should guide the player to success before teaching them about sizing constraints. See Design Implications below.

**F-04: Power hub port confusion**  
Player plugged an air cooler into the overflow port of the power hub. Port labels were too small to read, and the port validation wasn't obvious enough to prevent mis-wiring.

*Impact:* Wasted ~5 minutes debugging incorrect connections.  
*Recommendation:* Larger port labels on hover. Consider color-coding material vs electrical ports more aggressively (the type colors exist but are subtle at small scale). Port validation tooltip should be more prominent — a brief flash or shake on the rejected port.

### P1 — Significant friction (player struggled but recovered with hints)

**F-05: No way to identify that a port needs electricity**  
The air cooler port icon was "too small" to tell it needed electrical power. Player knew the cooler needed "something" but not what.

*Impact:* Trial-and-error to find the right connection type.  
*Recommendation:* Electrical ports should have a visible ⚡ indicator or distinct color even at normal zoom. The unconnected-port alarm already says "No electrical supply" but the player has to solve first, then read the alarm, then find the right unit. A tooltip on the port itself ("Electrical input — connect a grid supply or power hub") would short-circuit this.

**F-06: Grid supply not discoverable**  
Player browsed the palette but couldn't identify which unit provides electrical power. "Grid supply" doesn't say "power" or "electricity" to a non-engineer.

*Impact:* Facilitator had to point to it.  
*Recommendation:* Rename to "Power Supply" or "Electric Generator" for T1. Or: when an unconnected electrical port exists, the palette could highlight compatible units. The ⚡ icon helps but the name matters more for discovery.

**F-07: Open tank fried from temperature — cause not immediately clear**  
Hot fluid from the reservoir went directly into the open tank. Tank fried from T_HH violation. The player saw the error but didn't immediately connect "high temperature" to "need a cooler in between."

*Impact:* Needed facilitator hint: "What if you cool the fluid first?"  
*Recommendation:* The limit violation message should include the actual value vs the limit: "Temperature 400K exceeds limit 353K (80°C). Cool the inlet stream before it enters the tank." The remediation hint in ErrorCatalog exists for some errors but not for limit violations.

**F-08: Flash drum name is incomprehensible to non-engineers**  
"Flash drum" meant nothing. Player skipped it entirely. Open tank and air cooler were immediately understood from their names.

*Impact:* Player would never discover phase separation without guidance.  
*Recommendation:* Rename to "Vapor-Liquid Separator" for the display name. Keep "flash_drum" as defId. Add a one-line tooltip: "Separates a hot stream into vapor (top) and liquid (bottom)." Wording is everything for non-engineers.

**F-09: Power hub role completely opaque**  
Player had no mental model for why a hub was needed. Facilitator had to explain the concept of power distribution.

*Impact:* Would not have discovered independently.  
*Recommendation:* For Mission 1, consider not requiring a hub at all — a single grid supply can wire directly to one consumer. Introduce the hub in Mission 2 when multiple consumers exist. Alternatively, the hub tooltip needs to explain its purpose in survival terms: "Distributes power from generators to equipment. Required when you have multiple powered devices."

**F-19: "How am I supposed to know it's polypropylene?"**  
When told the tank fried because it exceeded the temperature rating of a polypropylene vessel, the tester's reaction was immediate: he felt the game had withheld essential information. The unit didn't tell him what it was made of, what it could handle, or where the danger zone was. The numbers in the inspector were too abstract — "353K" means nothing without "this is a plastic tank rated to 80°C."

*Impact:* Failures felt arbitrary rather than logical.  
*Recommendation:* Each equipment profile needs a one-line material/construction description visible in both the palette tooltip and the inspector header: "Polypropylene vessel — rated to 80°C, 5 bar." This turns opaque limits into physical intuition. Player thinks "plastic can't handle hot steam" rather than "T_HH = 353K."

**F-20: Palette tooltips are ugly and uninformative**  
The current palette hover shows the unit name and category. No description of what the unit does, what it's made of, what it can handle. The visual presentation is bare.

*Impact:* Palette browsing doesn't teach the player anything.  
*Recommendation:* Rich palette tooltips with: one-line description ("Cools a stream using ambient air"), material/rating ("Steel shell, rated to 350°C / 120 bar"), and operating range as a visual bar or tag. This is the primary discovery interface — it deserves real design attention.

### P2 — Moderate friction (player adapted but was confused)

**F-10: Expected drag-to-insert on existing connections**  
Player tried to drag a unit onto an existing pipe to splice it in. This is a common UX pattern (Factorio, Satisfactory) but PTIS doesn't support it.

*Impact:* Wasted ~2 minutes trying, then manually rewired.  
*Recommendation:* Auto-insert when dropping on a connection: break the connection, wire source → new unit → destination. This is a significant UX feature but would dramatically improve flow. Track as future enhancement.

**F-11: Expected click-release pipe drawing instead of click-click**  
Player tried to drag from port to port in one gesture. PTIS uses click-on-source-port, then click-on-target-port.

*Impact:* Mild confusion, adapted quickly.  
*Recommendation:* Support both: click-click (current) and click-drag-release. The drag gesture is more intuitive for most players. Low priority if click-click is documented in a tutorial.

**F-12: Couldn't figure out how to delete a connection**  
Player tried dragging the pipe off-screen, selecting it and pressing Delete, right-clicking it. None worked (connection deletion requires selecting the connection line, then pressing Delete or using the context menu).

*Impact:* Moderate frustration.  
*Recommendation:* Selected connections should show a visible ✕ delete button (same as units do). Right-click context menu on connections. Consider a "scissors" cursor mode for cutting pipes.

**F-13: Inspector felt overwhelming**  
Too many numbers, too many parameters. Player stopped reading values after the first few.

*Impact:* Reduced ability to diagnose problems.  
*Recommendation:* Inspector needs a progressive disclosure redesign. Default view: name, mode, 2-3 key values (T, P, flow), alarm status. "Advanced" expander for full parameter list. The current flat list of every parameter is correct for engineers but hostile to new players.

**F-23: Warning messages are engineering gibberish — only the parenthetical helped**  
The air cooler inspector showed messages with "UA-NTU" terminology. The only thing the tester found useful was a small parenthetical like "(fan at max speed)." Everything else — the method name, the heat transfer coefficients, the capacity ratio — was noise. The one human-readable phrase buried in the jargon was the only thing that communicated what was actually happening.

*Impact:* Player learned to ignore warning messages entirely — they were written for engineers, not for him. This means the game's primary feedback channel (alarm messages) is effectively muted for non-engineer players.  
*Recommendation:* Every alarm and warning needs a two-layer message structure. **Layer 1 (always shown):** plain language, no units, no method names. "Cooler running at full power — can't reach target temperature." **Layer 2 (expandable):** the engineering detail for players who want it. "UA-NTU limited: ε=0.82, Q_actual=1.2kW < Q_demand=3.4kW." The parenthetical that worked ("fan at max speed") is exactly the right voice for Layer 1. It tells the player what the machine is *doing*, not how the math works. This applies to every unit's warning/error messages — audit all `u.last.error.message` strings for engineer-speak.

**F-14: Equipment limits not visible before failure**  
Player didn't know the tank had temperature limits until it fried. The limits exist in the profile but are only shown as colored parameter highlights after solving.

*Impact:* Failures felt unfair — "how was I supposed to know?"  
*Recommendation:* Show limit ranges in tooltips on the palette ("Operating range: -10°C to 80°C, 0.8–5 bar"). Show them as colored bands on parameter sliders in the inspector. The information exists, it just isn't surfaced at the moment of decision.

### P3 — Wishes and positive signals

**F-15: Wants "old cute Flash game" feel — things that move, drip, leak**  
Not asking for realism. Asking for charm. Referenced PowerWash Simulator's satisfaction loop, old Flash games with bouncy physics and visible causality. Specifically mentioned wanting to "patch leaky pipes" — a maintenance/repair gameplay loop that doesn't exist yet. Said things should move, pipes should drip, tanks should visibly fill. The static SVG boxes feel dead.

*Insight:* This is the Car Mechanic Simulator / PowerWash Simulator player. The satisfaction comes from visible cause-and-effect: I turned a wrench, the bolt came off. I pointed the hose, the grime disappeared. PTIS currently has the cause (change params, step) but not the visible effect (nothing moves, nothing flows, nothing fills). The gap between action and visible feedback is where engagement dies.

*Recommendation:* This is the single strongest signal about the game's identity crisis. The engine is a process simulator. The player wants a tactile tinkering game. These aren't incompatible — but the presentation needs to bridge the gap. Pipe flow animation (dashes moving), tank level fill indicators, equipment vibration/hum when running, drip effects on cooler outlets, steam wisps on hot streams — these are all cosmetic animations that don't affect physics but communicate "the system is alive." S-ICONS Phase 2 animation is the right track. Pipe flow animation should be prioritized above almost everything else.

**F-16: Tooltips were actually read and useful**  
Despite struggling, the player did hover over units and read tooltips when stuck. This channel works — the content just needs to be better.

*Recommendation:* Invest in tooltip content quality. Every palette item needs a one-sentence "what it does" and a one-sentence "when you'd use it." This is cheap to implement and directly addresses F-06, F-08, F-09.

**F-17: Correctly identified air cooler from name alone**  
"Air cooler" immediately communicated "cools things down." This is the gold standard for unit naming.

**F-18: Found open tank independently**  
Browsed the palette, saw "Open Tank," understood it could receive liquid. Good naming + clear category.

**F-21: Would stay for hours watching someone else play Kerbal**  
This is a critical player archetype signal. The tester isn't a planner or a min-maxer. He's a systems-watcher who derives satisfaction from understanding a complex system, not from optimizing it. He understood satellite orbital mechanics as a copilot. He plays games where you fix/clean/build things with your hands. He likes clickers — the satisfaction of numbers going up visually.

*Insight:* PTIS's current presentation speaks to the planner ("set Pout to 300 kPa, eta 0.8"). This player wants to see the machine work, hear it hum, watch the water drip into the tank. He'll learn the parameters eventually — but only after the system has charmed him into caring.

**F-22: The game looks "too process-oriented" — politely calling it boring**  
Didn't want to hurt Denis's feelings, but the subtext was clear: spreadsheets with boxes. The engineering substance is there, but the presentation doesn't invite non-engineers in. The current aesthetic says "industrial control room." This player wants "scrappy workshop on an alien planet."

*Insight:* The ragtag theme was the right instinct. It needs to go further: weathered textures, hand-drawn feel, things that rattle and hiss. The gap between the game's narrative (crash-landed, building life support from salvage) and its visual language (clean SVG boxes with precise labels) is the core identity tension.

---

## Player Archetype: The Tinkerer

This tester isn't the audience we designed for (engineer, sim player) — he's the audience we *need* to reach. His gaming DNA tells a clear story:

| Game | What he loves about it |
|---|---|
| Car Mechanic Simulator | Disassemble → diagnose → fix → test. Visible mechanical causality. |
| PowerWash Simulator | Point tool at problem → problem visibly disappears. Satisfaction loop. |
| Shipyard sim | Build something physical piece by piece. See it take shape. |
| Kerbal (as copilot) | Understand complex systems. Read gauges. Call out numbers. |
| Clickers | Numbers going up. Visible progress. Low-friction engagement. |

**The Tinkerer archetype:** Learns by doing, not by reading. Understands systems by watching them work, not by studying parameters. Derives satisfaction from visible cause-and-effect, not from optimization. Will invest hours watching a complex system — but only if the system *shows* him what it's doing.

**What this means for PTIS:** The engineering model is the game's core strength — it's real, it's deep, it's correct. But the presentation layer assumes the player already cares about pressure drop and heat capacity. The Tinkerer needs to be seduced by the machine before he'll learn its language. He needs to see water dripping, hear compressors whining, watch tank levels rising. The numbers come after the charm, not before.

**The Kerbal lesson:** KSP doesn't start with orbital mechanics. It starts with a rocket that explodes hilariously. And critically — *you watch the explosion*. The camera follows the debris. The aerodynamic forces rip the fairings off visually. You see which strut failed. THEN the flight results screen appears with stats. The drama teaches; the debrief confirms.

PTIS currently does the opposite: the debrief (modal) appears *instead of* the drama. The fried overlay exists, the smoke system exists, the red X exists — but the player never sees them because a modal covers the canvas 0ms after the catastrophe fires. The fix isn't better modal content (though that helps too). The fix is: **let the player watch the machine break, then tell them why.**

---

## Design Implications

### The Dimensioning Problem

The most important structural insight: **the game currently requires the player to size equipment correctly before they can succeed.** A T1 air cooler with default params may not have enough capacity for the reservoir's flow rate. The player doesn't know what "Cv" means, doesn't know what flow rate they're dealing with, and has no intuition for whether 150W of fan power is a lot or a little.

This makes the first 10 minutes a sizing exercise rather than a discovery exercise. The player should be learning "cooler goes before tank" and "you need power for the cooler," not "the Cv coefficient on the reservoir outlet determines whether your cooler can handle the thermal load."

**Proposed fix:** Mission 1 should use pre-configured sources with flow rates that T1 equipment can handle with default parameters. The reservoir should default to a modest flow (opening 50%, small volume) so that one T1 cooler is sufficient. Sizing challenges belong in Mission 2+ after the player understands the basic vocabulary.

### The Failure Communication Gap

The game has excellent diagnostic data internally (ErrorCatalog with causes, fixes, and explanations; limit system with exact values; alarm system with severity and messages). But this data is scattered across three separate UI locations:

1. Catastrophic modal — shows unit names only, no cause
2. Inspector alarm banners — shows message, but requires clicking the unit
3. Diagnostic center — shows everything, but requires opening a separate panel

For the try-fail-fix loop, the player needs the diagnostic at the point of failure, not behind two clicks. The catastrophic modal should be the diagnostic center for that moment.

### Palette Curation for Mission Scope

The full palette has 28+ unit types. For Mission 1 ("get water"), the player needs: reservoir, air cooler, open tank, grid supply, sink. That's 5 units out of 28. The other 23 are noise — including the flash drum that the player correctly ignored because the name was meaningless.

**Proposed fix:** Mission-scoped palette that unlocks units progressively. Mission 1 shows only the units needed for water condensation. Mission 2 adds the power hub, compressor, etc. This is a game design pattern (tech tree) that directly addresses discoverability.

### The Equipment Identity Problem

"How am I supposed to know it's polypropylene?" This single quote reveals a category of missing information. Every piece of equipment has a physical identity — what it's made of, how big it is, what it can handle — and the game currently hides all of it behind abstract parameter names (T_HH, P_LL, mass_HH).

In Car Mechanic Simulator, when you look at a part, you see what it is: a cast iron brake caliper, a rubber timing belt. You develop intuition: rubber melts, cast iron doesn't. PTIS needs the same: "Polypropylene tank — good for water at room temperature, will melt above 80°C." "Steel pressure vessel — handles 50 bar, won't survive cryogenic temperatures."

This isn't about adding data — the data exists in the profile limits. It's about translating engineering parameters into physical descriptions that build intuition. Each tier of each profile needs a one-line material description that explains *why* the limits are what they are.

### The "Alive Machine" Gap

The tester's reference to "old cute Flash games" isn't nostalgia — it's a design vocabulary. Flash games from 2005-2012 had a specific quality: everything jiggled, bounced, dripped, and responded. They communicated state through motion, not through numbers. The satisfaction was in watching the Rube Goldberg machine work.

PTIS currently communicates through numbers: T=373K, P=101325, n=1.23. The Tinkerer sees a static box with text. He needs to see: the pipe shaking slightly (high flow), steam wisping from the vent (relief valve open), the tank filling visually (inventory increasing), the cooler humming (power consumed), droplets forming on the cold side (condensation happening).

None of these need physics changes. They're purely cosmetic animations keyed to existing solver output. But they transform the game from "interactive spreadsheet" to "alive machine on an alien planet."

### The Message Voice Problem

The air cooler finding is the most actionable structural issue in the report. The game's entire feedback system — warnings, errors, alarm messages — is written in engineer voice. "UA-NTU capacity limited: ε=0.82" is correct and useful for an engineer debugging a simulation. It is invisible to a non-engineer trying to understand why their cooler isn't working.

The parenthetical "(fan at max speed)" was the only thing that landed, because it describes what the machine is *doing* rather than how the math works. This is the voice the game needs for Layer 1 messages:

| Engineer voice (current) | Tinkerer voice (needed) |
|---|---|
| UA-NTU limited: ε=0.82, Q < Q_demand | Cooler running flat out — can't keep up with the heat |
| Temperature cross: T_hot_out < T_cold_in | Hot side already cooler than cold side — impossible heat transfer |
| Curtailment factor 0.6 — insufficient power | Only getting 60% of the power it needs — running slow |
| Cavitation: vapor fraction > 0.1 at inlet | Pump choking on gas bubbles — needs liquid feed |
| P exceeds P_HH limit (5 bar) | Tank about to burst — pressure way over safety limit |

The engineering detail stays available (Layer 2 / inspector advanced view), but the first thing the player sees should answer "what is the machine trying to tell me?" not "what equation failed?"

This isn't a cosmetic rewrite. It's a fundamental voice decision that affects every `u.last.error.message` string in the codebase. But it's the difference between a game that communicates and one that lectures.

---

## Action Items

| ID | Priority | Category | Description | Effort |
|---|---|---|---|---|
| A-01 | P0 | UI | Catastrophic sequence: delay modal 2-3s, zoom to unit, show drama, then debrief with diagnostic + plain-language cause + remediation | M |
| A-02 | P0 | Balance | Reservoir default opening → 50% (or per-mission preset) | XS |
| A-03 | P0 | Balance | Mission 1 source sizing: ensure T1 defaults handle the load | S |
| A-04 | P1 | UI | Rename "Flash Drum" → "Vapor-Liquid Separator" (display only) | XS |
| A-05 | P1 | UI | Rename "Grid Supply" → "Power Supply" (display only) | XS |
| A-06 | P1 | UI | Electrical port ⚡ indicator visible at normal zoom | S |
| A-07 | P1 | UI | Limit violation messages: include actual value vs limit + fix hint | M |
| A-08 | P1 | Content | Two-layer alarm messages: plain language (always) + engineering detail (expandable) | L |
| A-09 | P1 | Content | Palette tooltips: one-line purpose + one-line "when to use" for every unit | M |
| A-10 | P1 | Content | Equipment material/construction description per profile tier (palette + inspector) | M |
| A-11 | P1 | UI | Rich palette tooltips: description, material rating, operating range visual | M |
| A-12 | P2 | UX | Connection delete: visible ✕ button on selected connections | S |
| A-13 | P2 | UX | Inspector progressive disclosure (collapsed advanced params) | M |
| A-14 | P2 | UX | Show equipment limits in palette tooltip + inspector slider bands | M |
| A-15 | P3 | Visual | **Pipe flow animation** (dashes/particles moving along connections) | M |
| A-16 | P3 | Visual | Tank level fill indicator (visual fill line keyed to inventory) | S |
| A-17 | P3 | Visual | Equipment "alive" cues: hum, vibration, steam wisps, condensation drops | L |
| A-18 | P3 | UX | Auto-insert unit on existing connection (drag-to-splice) | L |
| A-19 | P3 | UX | Click-drag-release pipe drawing (alternative to click-click) | M |
| A-20 | P3 | Design | Mission-scoped palette (progressive unit unlock) | L |
| A-21 | P3 | Design | Maintenance/repair gameplay loop (patch leaks, replace gaskets) | L |

*Effort: XS = 1 hour, S = half day, M = 1 day, L = multi-day*

---

## Key Quotes

> "I would have shut down the game by now" — after two air coolers couldn't cool below 160°C

> "I have no clue what a flash drum is" — while browsing palette

> "I can see it needs something but I can't tell what" — looking at air cooler electrical port

> "How am I supposed to know?" — when told the tank was polypropylene with an 80°C limit

> [on air cooler warnings] — ignored everything except "(fan at max speed)" buried in UA-NTU jargon

> [facilitator note] "The modal masks the dramatic effects. It should be more like Kerbal — you have a little time to see your craft miserably crash in all its glory before the popup comes." — Denis

> "More animation, things that move, pipes that drip" — end-of-session feedback

> [referenced "old cute Flash games"] — the aesthetic he's looking for isn't realism, it's charm

---

## What Worked

- Open tank and air cooler discovered independently from names alone
- Tooltips were read when the player was stuck — this channel works
- The port type validation prevented wrong-type connections (eventually)
- Player correctly reasoned "hot → cooler → tank" after seeing the temperature error
- The step-by-step simulation model (pause, step, inspect) was understood quickly
- Player browsed the entire palette voluntarily — curiosity is there

## What Didn't Work

- Catastrophic failures gave no actionable diagnostic at the point of failure
- Equipment limits were invisible until violated — "how was I supposed to know?"
- Equipment identity hidden — no material, no physical description, just abstract params
- Naming assumed engineering vocabulary ("flash drum", "grid supply", "Cv")
- Warning messages written for engineers ("UA-NTU limited") — player ignored them entirely
- Inspector was a wall of numbers with no hierarchy
- Default equipment sizing required expert knowledge to be functional
- Connection management (creating, deleting, splicing) was unintuitive
- The game looks static and "process-oriented" — alive machines need visible motion
- Palette tooltips too bare to support discovery

---

*Next playtest: After implementing A-01 through A-05 (catastrophic modal, defaults, naming, material descriptions), retest Mission 1 with a different non-engineer tester. Target: complete water condensation without facilitator intervention.*
