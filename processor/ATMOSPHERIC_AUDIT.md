# Atmospheric Reference Audit — processThis v13.7.0

Audit goal: identify every reference to atmospheric conditions in the
codebase and assess terraforming compatibility (dynamic atmosphere).

---

## 1. How Atmosphere Works Today

```javascript
// Line 6900: frozen immutable object
SimSettings.atmosphere = Object.freeze({
  T_K: src.T_K,
  P_Pa: src.P_Pa,
  air: Object.freeze({ ...src.air }),
  presetName: src.name
});
```

Set once by preset selection. Consumers call `SimSettings.getAtmosphere()`
or read `SimSettings.atmosphere` directly. Never mutates during simulation.

---

## 2. All Consumers Classified

### A. LIVE READERS — Already terraforming-compatible ✅

These read `getAtmosphere()` every tick. If atmosphere becomes dynamic,
they automatically track changes.

| Line | Consumer | What it reads | Verdict |
|---|---|---|---|
| 12518 | **source_air tick** | composition, T_K, P_Pa | ✅ Reads live each tick. Emits current atmosphere. Perfect. |
| 13947 | **air_cooler tick** | T_K (as T_amb) | ✅ Reads live. Cooling target tracks ambient. |
| 20073 | **Pressure color band** | P_Pa (±20% band) | ✅ Reads live. Band shifts with atmosphere. |
| 23599 | **source_air inspector** | Full display (comp, T, P) | ✅ Reads live on panel build. |
| 23913 | **air_cooler inspector** | T_K, P_Pa display | ✅ Reads live on panel build. |
| 26786 | **Settings panel summary** | presetName, T_K, P_Pa | ✅ Reads on panel build. |
| 26586 | **Atmosphere modal** | Full preset display | ✅ Reads on build. |

### B. SNAPSHOT AT CREATION — Correct behavior, no change needed ✅

| Line | Consumer | What it captures | Verdict |
|---|---|---|---|
| 12668 | **Tank initInventory** | T_K, P_Pa at placement | ✅ Tank fills with atmosphere *at the moment it was placed*. Physically correct — later changes don't retroactively change the gas already in the tank. |
| 15736 | **Source default params** | T_K, P_Pa baked into `unit.params` | ✅ Source was placed at those conditions. Player can edit in inspector. |

### C. HARDCODED 101325 — Needs review ⚠️

These use `101325` as a fallback default. Most are harmless (they only
fire when data is missing), but some are conceptually wrong for non-Earth
planets.

| Line | Consumer | Context | Severity | Recommendation |
|---|---|---|---|---|
| 12494 | source_multi tick | `par.P ?? 101325` | **Low** — user always sets P in params | No change. User controls this explicitly. |
| 15784 | source_multi defaults | `P: 101325` at creation | **Medium** — new source_multi on Mars gets Earth pressure | **FIX:** `P: SimSettings.atmosphere.P_Pa` |
| 15765 | gas_turbine defaults | `Pout: 101325` at creation | **Medium** — turbine exhaust to atmosphere should be planet P | **FIX:** `Pout: SimSettings.atmosphere.P_Pa` |
| 15769 | valve defaults | `Pout: 101325` at creation | **Medium** — same issue | **FIX:** `Pout: SimSettings.atmosphere.P_Pa` |
| 12719 | Tank inventory fallback | `P_Pa: 101325` when no inventory | **Low** — only fires if inventory is null (shouldn't happen) | No change. Safety net. |
| 11423 | Stream validation | `stream.P = 101325` for NaN P | **Low** — error recovery only | No change. Safety net. |
| 14644 | Hub EMPTY_STREAM | `P: 101325` | **Low** — placeholder for no-flow | No change. Cosmetic. |
| 14669 | Hub outlet P fallback | `P_out = ... : 101325` | **Low** — fires when no outlet connected | No change. Safety net. |
| 14775 | HEX empty stream | `P: sIn.P \|\| 101325` | **Low** — uses inlet P first | No change. |
| 14853 | HEX empty stream | `P: sIn.P \|\| 101325` | **Low** — same pattern | No change. |
| 23650 | Source inspector | `u.params.P ?? 101325` display | **Low** — display fallback | No change. |
| 23788 | Valve inspector | `u.params.Pout \|\| 101325` display | **Low** — display fallback | No change. |
| 23833 | Turbine inspector | `101325` as default in params call | **Low** — display | No change. |

### D. ARCHITECTURAL BLOCKER — Must change for dynamic atmosphere ⚠️

| Line | Issue | Impact |
|---|---|---|
| 6900 | `Object.freeze()` on atmosphere | Cannot mutate atmosphere in place. Must replace entire object each tick. |

---

## 3. Firm Recommendations

### R1: Fix 3 default-param hardcodes NOW (10 minutes)

These are bugs on non-Earth planets today, regardless of terraforming:

```javascript
// Line 15765 — gas_turbine
case 'gas_turbine':
  unit.params = { Pout: SimSettings.atmosphere.P_Pa, eta: 0.88 };
  break;

// Line 15769 — valve
case 'valve':
  unit.params = { Pout: SimSettings.atmosphere.P_Pa };
  break;

// Line 15784 — source_multi
case 'source_multi':
  unit.params = {
    n: { ...SimSettings.atmosphere.air },
    T: SimSettings.atmosphere.T_K,
    P: SimSettings.atmosphere.P_Pa,
    phaseConstraint: 'V'
  };
  break;
```

These are bugs right now: a player on Mars who places a valve gets an
exhaust target of 101325 Pa instead of Mars's 636 Pa. Similarly,
source_multi defaults to Earth air composition on every planet.

**Impact:** 3 lines changed. No tests affected (tests set params explicitly).

### R2: Add atmospheric info display to status bar (30 minutes)

Show live atmospheric conditions somewhere always visible — the status
bar or a small HUD overlay. Not editable, just informational:

```
🪐 Planet X | T 305K | P 897 mbar | CO₂ 9.0% | O₂ 16.1%
```

This costs nothing architecturally — it's a display-only read of
`SimSettings.getAtmosphere()` rendered on each tick/solve. But it
immediately makes the atmosphere feel like a LIVE system parameter
rather than a hidden setting. When terraforming comes, these numbers
move and the player sees it.

**Implementation:** One `<div>` in the transport bar area, updated in
`afterSolve()` or `updateTransportUI()`. Read from getAtmosphere().

### R3: Add atmospheric dashboard to inspector (1 hour)

When no unit is selected, the inspector/properties panel could show
an atmospheric dashboard instead of being empty:

```
┌─ Atmosphere: Planet X ──────────────────┐
│                                         │
│  Surface conditions                     │
│  T_surface   305.2 K  (32.0 °C)       │
│  P_surface   89,660 Pa (0.897 bar)     │
│  ρ_air       1.024 kg/m³              │
│                                         │
│  Composition           mol%     ppm     │
│  N₂           ████████ 74.9%           │
│  O₂           ███░░░░░ 16.1%           │
│  CO₂          █░░░░░░░  9.0%  90,000   │
│  Ar           ░░░░░░░░  trace    230   │
│  CH₄          ░░░░░░░░  trace     18   │
│                                         │
│  Derived properties                     │
│  Mean MW      29.8 g/mol               │
│  Speed of sound  347 m/s               │
│  Dew point    varies by humidity       │
│                                         │
│  ── Your Impact (future) ──            │
│  CO₂ removed:  0 mol (no sinks to atm)│
│  O₂ released:  0 mol                  │
└─────────────────────────────────────────┘
```

The "Your Impact" section reads zero today. But it's the hook — the
player sees the slot where their contribution will appear. When
terraforming arrives, those numbers start moving.

**Derived properties** are computable from existing thermo functions:
density from ideal gas law (P × MW / R / T), speed of sound from
√(γRT/MW), mean MW from composition. All one-liners.

### R4: Prepare atmosphere for dynamic updates (S-TERRAFORM, not now)

When the time comes, the change to `_applyPreset` is small:

```javascript
// Replace Object.freeze with a mutable live object:
SimSettings._liveAtmosphere = {
  T_K: src.T_K,
  P_Pa: src.P_Pa,
  air: { ...src.air },
  presetName: src.name,
  inventory: { ... }   // total moles per species
};

// getAtmosphere() returns the same reference — consumers unchanged
getAtmosphere() { return SimSettings._liveAtmosphere; },

// New: tickAtmosphere() mutates _liveAtmosphere in place
tickAtmosphere(dt, scene) {
  // Sum emissions/intake from all units connected to sinks/sources
  // Update inventory
  // Recompute P, T, composition from inventory
}
```

All existing consumers already call `getAtmosphere()` — they'll
see the updated values without any code change. The freeze removal
is the only breaking change, and it breaks nothing because nobody
tries to write to the frozen object today.

### R5: Track plant-to-atmosphere flows (S-TERRAFORM, not now)

For the "Your Impact" display, every sink connected to the atmosphere
represents material leaving the process into the atmosphere, and every
source_air represents material drawn from it:

```javascript
// In afterSolve or tick summary:
let totalToAtm = {};
let totalFromAtm = {};
for (const [uid, u] of scene.units) {
  if (u.defId === 'sink') {
    // Whatever flows into this sink goes to atmosphere
    // (unless sink is labeled as "product" — future classification)
    const s = u.last?.stream;
    if (s?.n) for (const [sp, v] of Object.entries(s.n)) {
      totalToAtm[sp] = (totalToAtm[sp] || 0) + v;
    }
  }
  if (u.defId === 'source_air') {
    const s = /* outlet stream */;
    if (s?.n) for (const [sp, v] of Object.entries(s.n)) {
      totalFromAtm[sp] = (totalFromAtm[sp] || 0) + v;
    }
  }
}
// Net: totalToAtm[sp] - totalFromAtm[sp] = net emission per species
```

This can be displayed NOW as information even without dynamic atmosphere.
"Your plant emits 2.3 mol/s CO₂ to atmosphere and draws 1.0 mol/s O₂."
That's a meaningful engineering metric and a preview of terraforming.

---

## 4. Tank initInventory: N₂ Hardcode

Line 12668 fills every tank with pure N₂ at atmospheric conditions:

```javascript
const n_N2 = (atm.P_Pa * V) / (8.314 * atm.T_K);
return { n: { N2: n_N2 }, T_K: atm.T_K, P_Pa: atm.P_Pa };
```

This is being replaced by S5-lite's initInventory which takes
explicit (composition, T_init, P_init or level_init) from profiles.
No action needed on the current code — it's going away.

However, the S5-lite default should fill with ATMOSPHERIC composition,
not pure N₂. A new tank on Planet X should start filled with Planet X
air, not pure nitrogen:

```javascript
// S5-lite initInventory (recommended default):
const atm = SimSettings.getAtmosphere();
const n_total = (atm.P_Pa * V) / (8.314 * atm.T_K);
const n = {};
for (const [sp, frac] of Object.entries(atm.air)) {
  if (frac > 0) n[sp] = frac * n_total;
}
return { n, T_K: atm.T_K, P_Pa: atm.P_Pa };
```

This should be the default when no explicit initialComposition is
provided in the profile.

---

## 5. Summary: What to Do When

### NOW (during S5-lite, 2 hours total)

| # | Action | Effort | Impact |
|---|---|---|---|
| R1 | Fix 3 hardcoded 101325 defaults | 10 min | Bug fix for non-Earth planets |
| R2 | Atmospheric info in status bar | 30 min | Visible context, zero architecture cost |
| R3 | Atmospheric dashboard in inspector | 1 hour | Rich info display, terraforming preview |
| — | Tank initInventory uses atm composition | In S5-lite spec | Already planned |

### LATER (S-TERRAFORM phase)

| # | Action | Depends on |
|---|---|---|
| R4 | Remove Object.freeze, add tickAtmosphere() | S-SIM (tick loop) |
| R5 | Track plant-to-atmosphere flows | R3 dashboard exists |
| — | "Your Impact" section goes live | R4 + R5 |
| — | Sky/background responds to composition | S-3D or CSS update |
| — | Atmospheric milestones (breathable, etc.) | Mission system |

---

## 6. Architecture Verdict

**The codebase is 90% ready for dynamic atmosphere.** All critical
consumers (source_air, air_cooler, pressure vis) already read live.
The Object.freeze is the only real blocker and it's a one-line removal.
Three hardcoded defaults are bugs today on non-Earth planets.

The main work for terraforming is the PHYSICS (tickAtmosphere equation,
feedback loops, biological units) not the PLUMBING. The plumbing is
already there.
