
## G121.1 — THE FAIRING SWITCH REACHES THE PHYSICS (2026-08-31, user: "do the
## join for the fairing switch" — G115's own named open item, closed)

One wire, and both of its ends already existed: the gear layer's three-state
row ('none'/'spat'/'trousers') has DRAWN the shell since the gear bench, and
since G115 `spec.gear.fairing` PRICES it (genGearCdA — spat 0.22 vs bare
0.55 on the wheel's frontal, trousers fairing the legs too). `cageJoinSpec`
now maps `s1Fair` -> 'none'/'spat'/'full' inside its gear block, as a PARAM
rather than a measurement, deliberately: the drawn spat is generated FROM
s1Fair, so the switch IS the geometry's own declaration — the same standing
accOn's switches have. The wheel radii were already measured rows
(contactR -> wheelR, twR), so the whole of genGearCdA's input surface now
arrives from the editor.

GATE JOIN grew four assertions in the G48 discipline — the export-side
mapping, then the RESOLVED spec through the clamp, at ALL THREE states,
because a mapping table with a hole is exactly the kind of thing that hides.
The canned P carries s1Fair at a NON-default state so "it landed" cannot be
impersonated by the default.

TRIED IN THE GAME, through the editor's own export path, on the user's WIP:
spats took the plaque's take-off run 646 -> 606 m and L/D 5.5 -> 5.6;
switched back, 646 and 5.5 exactly — the build ended where it started,
certificate re-earned. Still open, honestly: the third wheel's s2Fair has no
spec home (the drag model treats it as bare), and 'trousers' on the row maps
to the spec's 'full'.## G198.1 — G198's proof: WINGSPLIT re-frozen, GEN proven, TAKEOFF red for a
## reason that is not the pilot's (2026-09-05)

**WINGSPLIT** went red on 677306c because the CGE node moves every wing node's
INDEX up by one; every wing node is where it was, by tag, to the millimetre.
`tools/_wing_split.json` re-frozen. **GEN**: proven on a clean worktree of 677306c, alone on the
machine at last: 74/74 checks, the envelope, the wing flap and chatter all
inside (the two 1800 s timeouts were three batteries competing, not verdicts).

**TAKEOFF went red on 677306c, and it was the aeroplane, not the gate's
pilot.** The ultralight fixture's pulling 582 pair hangs its 2 x 43 kg at
the true CG, 0.17 m aft of the flange, so the fixture's CG moved 3.4 cm aft
(0.990 -> 1.024 m; the mains stay at 0.086, drawn) and its three crosswind
departures tracked 10.1-10.5 m through the roll against G193's 8 m bound —
monotonic in where the mass sits (6.53 / 8.07 / 10.11 / 11.48 m at 0 / 0.08
/ 0.17 / 0.30 m aft), the CGE node itself moving 2 mm through the roll. The
swing is the tail-up moment with the rudder at 0.95 for a full second in
both mass states; no pilot gain restores 8 m (the sweep was tried and NOT
landed — 40/41 are byte-identical). **The user ruled: re-freeze the wind
bound to the measured physics.** The gate is the UltraLight session's, and
its G193.1 carries the re-freeze and every number; calm stays at 4 m.


