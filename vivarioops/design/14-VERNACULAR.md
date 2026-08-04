# VIVARIOOPS — 14 · Vernacular Names

**Document 14 of the Vivarioops design set.** Companion to 13 · Nomenclature.

| | |
|---|---|
| **Status** | Authoritative for common names. Specification only. |
| **Supersedes** | 13 §12 (deferred vernacular layer) |
| **Upstream** | 13 Nomenclature · 10 L1 Creature |
| **Downstream** | 21 UI (tank label, Atlas card, share card) · 20 Trunk (i18n) |
| **Breaks** | Nothing. Purely additive. |

---

## 1. Why this exists and what it must not be

The binomial is admirable and unmemorable. *Campylopachyteratops brevicaudissimus* is a
readable factsheet and nobody will ever say it out loud. The vernacular is the name the
player actually uses, and affection is what turns a list into a collection.

The failure mode is obvious and must be designed against: **a vernacular layer that is just
the binomial in English is redundant decoration.** *Dolichopodus* → "the long-foot" adds
nothing but a translation.

**The governing principle: the vernacular reads different axes than the binomial.**

| | Binomial reads | Vernacular reads |
|---|---|---|
| Source | topology — segments, limbs, depth, symmetry, joint DOF | appearance and motion — hue, pattern, gait, silhouette |
| Register | structural, Latinate, precise | impressionistic, Germanic, memorable |
| Function | identity | recognition |

The binomial says what the animal *is*. The vernacular says what it *looks like when you
watch it*. Those are genuinely different facts about the same creature, and colour and gait
are the two most memorable properties a swimming thing has — neither of which the binomial
touches at all.

A second consequence, which matters for §8: because the vernacular reads `MaterialGenes`
and the CPG parameters, it varies along axes the binomial does not. A converged lineage
whose topology has stopped moving still produces varied vernacular names.

---

## 2. Grammar

```
[POSSESSIVE] [RANK] [PATTERN] [COLOUR] [GAIT] HEAD
```

Six slots, but **never more than two modifiers plus the head are emitted.** The head noun
is mandatory; everything else is selected by the rules in §4.

```
the banded whipfoot
Gauder's greater rowing whipfoot
the pale marbled sprawler
the false azure sunburst
```

### 2.1 Memorability rules — hard constraints

| # | Rule | Rationale |
|---|---|---|
| M1 | Head noun is a **compound noun**, always last, always concrete | Compounds are how real field guides build memorable names |
| M2 | **Maximum two modifiers.** Three-modifier names are rejected and re-drawn | Four content words is the limit of what anyone repeats |
| M3 | Maximum **five syllables** excluding the possessive | — |
| M4 | Prefer Germanic monosyllables over Latinate polysyllables in every pool | "whipfoot" is remembered; "flagelliped" is not |
| M5 | **No diminutive suffixes** — `-ling`, `-y`, `-ie`, `-kin` are banned outright | This is the single mechanism by which the layer becomes twee |
| M6 | No word may repeat within a name | — |
| M7 | If a candidate alliterates, **keep it** — do not re-draw | Alliteration is free memorability and real vernaculars are full of it |
| M8 | Every word must plausibly appear in a field guide | The taste test. If it sounds like a cartoon, it is out |

M5 and M8 are the two doing real work. The others are arithmetic.

---

## 3. Pools

Total vocabulary: **24 head nouns + 44 modifiers**, per language.

### 3.1 Head nouns — from family (24, curated)

One per family, so **every creature in a clade shares its head noun**. This is the anchor:
a player who breeds *Dolichopodidae* for three hundred generations learns one word,
"whipfoot", and every specimen is a kind of whipfoot. That is exactly the relationship
between family and vernacular in real usage.

| Family | Head noun (EN) | Head noun (FR) |
|---|---|---|
| Brachypodidae | stubfoot | pied-court |
| Dolichopodidae | whipfoot | pied-fouet |
| Stenosomatidae | ribbonback | dos-ruban |
| Myriarthridae | hundredfoot | cent-pattes |
| Camphyloscelidae | crookleg | jambe-torse |
| Plagiocaudidae | slanttail | queue-oblique |
| Loxonotidae | wryback | dos-tordu |
| Scoliorhachidae | twistspine | échine-vrille |
| Nereidae | starfoot | pied-étoile |
| Proteidae | sunwheel | roue-soleil |
| Thetidae | crownbeast | bête-couronne |
| Hydridae | spokebeast | bête-rayon |
| Boreadidae | pinwheel | tourniquet |
| Echoidae | fanback | dos-éventail |
| Lethaeidae | ringwalker | marcheur-anneau |
| Charontidae | sunburst | éclat-soleil |
| Amorphidae | knuckle | phalange |
| Physaridae | bloatfoot | pied-enflé |
| Plasmatidae | sprawler | vautré |
| Chaomatidae | tanglebeast | bête-enchevêtrée |
| Atactidae | oddfoot | pied-bancal |
| Sphalmatidae | stumbler | trébucheur |
| Anomalidae | snarlback | dos-noué |
| Teratidae | briarbeast | bête-ronce |

### 3.2 Colour — from `MaterialGenes.hue` (12)

`scarlet · rust · amber · ochre · olive · jade · teal · azure · indigo · violet · rose · pearl`

Twelve hue sectors, one word each. Low saturation prefixes the colour with `pale` or
`dusky` (counts as part of the same modifier, not a second one). High saturation adds
nothing — the colour word is already vivid.

### 3.3 Pattern — from `MaterialGenes` pattern scale, contrast, anisotropy (8)

`banded · spotted · marbled · mottled · striped · veined · glossy · plain`

`plain` is emitted only when contrast is genuinely low, and then it usually loses the draw
to another slot. A name should not spend a modifier saying nothing.

### 3.4 Gait — from CPG frequency, phase lag, amplitude (10)

`creeping · darting · rowing · whirling · drifting · pulsing · lurching · gliding ·
tumbling · sculling`

The most valuable pool in the document. Gait is the thing you actually watch in the tank,
it is invisible to the binomial, and it mutates independently of morphology.

### 3.5 Rank — from species-epithet extremity (6 + 2)

`lesser · greater · common · dwarf · giant · true`

Plus two structural markers, which are not drawn but triggered:

- **`false`** — emitted when the specimen carries a **recombination scar** (13 §10). Real
  vernaculars use "false" exactly this way, for things later found to belong elsewhere.
  *the false azure sunburst* means the same thing as the parenthesised author citation,
  in a form a player will actually notice.
- **`true`** — emitted for a **tautonym** (13 §4.3). *the true whipfoot.*

Both are strong signals delivered at zero cost, and both make an Atlas event legible
without a legend.

### 3.6 Possessive — from author (13 §8)

`Gauder's`, `Kopij's`, `Stroobant's`. Emitted at **15%**, weighted heavily toward curated
authors, so the Easter eggs surface in the layer the player reads most.

The possessive does not count against M2 and does not count toward M3.

---

## 4. Assembly

Each slot is scored by how much it discriminates *within the current lineage* — the same
local normalisation as 13 §9. The two highest-scoring slots are emitted.

| Priority | Condition |
|---|---|
| 1 | `false` / `true` if triggered — always emitted, always first |
| 2 | The slot whose value is most unusual for this lineage |
| 3 | The next most unusual slot |
| — | Possessive drawn independently at 15% |

The consequence is that the vernacular **automatically names whatever is distinctive about
this specimen here.** In a lineage where every creature is teal, colour scores low and the
names discriminate on gait instead. In a lineage of uniform gait, colour and pattern take
over. The layer self-tunes to whatever axis is currently informative.

Fixed word order when two modifiers are emitted: `RANK > PATTERN > COLOUR > GAIT`. English
adjective ordering is not free and a generator that ignores it sounds wrong even when every
word is right.

---

## 5. Article

English names take `the` in display contexts and no article in labels:

- Tank label: `banded whipfoot`
- Atlas card: `the banded whipfoot`
- Possessive form never takes an article: `Gauder's banded whipfoot`

---

## 6. Localisation

**This layer is per-language and cannot be transliterated.** The whole point of the
binomial is that it is language-neutral; the whole point of the vernacular is that it is
not. Pools are authored per language, not machine-translated.

French grammar differs structurally and the generator must branch, not substitute:

| | EN | FR |
|---|---|---|
| Adjective position | pre-nominal | post-nominal, except `grand`/`petit`/`faux` |
| Agreement | none | gender + number with the head noun |
| Possessive | `Gauder's X` | `le X de Gauder` |
| Rank words | lesser/greater/dwarf/giant/true/false | petit/grand/nain/géant/vrai/faux |

```
EN  Gauder's greater banded whipfoot
FR  le grand pied-fouet barré de Gauder
```

Each head noun carries its grammatical gender in the FR table. Modifier pools store
masculine and feminine forms. Adding a language means authoring 68 words and one ordering
rule — deliberately small.

**Fallback:** if a language has no vernacular pool, the UI shows the binomial. It must never
show a half-translated name.

---

## 7. Uniqueness

**The vernacular is not an identifier.** The binomial is. Common names collide in reality
and they may collide here.

- Global collisions: **permitted**, unremarked.
- Within one Atlas: **suppressed** by the same draw-weight mechanism as 13 §9.1. An
  already-used vernacular has its component slots down-weighted, so the generator reaches
  for a different discriminating axis rather than manufacturing a duplicate.
- If suppression exhausts every combination, the name repeats. That is correct behaviour,
  not a bug — two whipfoots that look and move alike *should* have the same common name,
  and their binomials still separate them.

The player-authored **common name** field (21 §7.1) overrides the generated vernacular
entirely when set. It is a free-text release valve and has no rules.

---

## 8. Cardinality

| | Global | One lineage, 300 gen, 100 described |
|---|---|---|
| Head nouns | 24 | **1** |
| Two-modifier combinations | ~630 per head | ~120 reachable |
| With possessive | × ~40,000 authors | × 5–20 |
| **Distinct vernaculars** | **~15,000** without possessive | **≥ 60 distinct** |

Deliberately three orders of magnitude smaller than the binomial space. **A memorable
vocabulary must be a small vocabulary** — 15,000 is already far past what any player will
see, and every additional token bought here would be paid for in forgettability.

The single-lineage figure is the one that matters, and it is lower than the binomial's
95-of-100 target on purpose. Sixty distinct common names across a hundred described
specimens, all sharing one head noun, reads correctly: *they are all whipfoots, and some of
them are the same kind of whipfoot.* That is what a real collection looks like.

---

## 9. Display

Recommendation, for 21 to ratify:

| Surface | Primary | Secondary |
|---|---|---|
| Tank label | vernacular | — |
| Specimen sheet | vernacular, large | binomial, italic, below |
| Describe sheet | binomial (it is the ceremony) | vernacular below |
| Atlas card | vernacular | binomial, small italic |
| Atlas specimen | binomial + citation + synonymy | vernacular below |
| Share card | vernacular, large | binomial + citation |

The tank speaks vernacular; the Atlas speaks Latin. The tank is where you point at things;
the Atlas is the record. Denis's actual complaint — the Latin is unmemorable — is a
complaint about the tank, and this is where it is fixed.

---

## 10. Gate assertions

Suite `vernacular`. IDs provisional pending `gate/manifest.js`. Mutation-tested before green,
per the standing rule.

| ID | Assertion |
|---|---|
| VN-1 | Determinism: identical `(plan, genome, ctx, lang)` yields an identical string |
| VN-2 | Head noun always present, always last, always from the 24-entry table |
| VN-3 | Head noun is a pure function of family — 10k corpus, zero exceptions |
| VN-4 | M2: never more than two modifiers |
| VN-5 | M3: never more than five syllables excluding possessive |
| VN-6 | M5: no banned diminutive suffix appears in any pool or any output |
| VN-7 | M6: no word repeats within a name |
| VN-8 | Adjective order `RANK > PATTERN > COLOUR > GAIT` holds in EN, 10k corpus |
| VN-9 | `false` emitted iff a recombination scar is present |
| VN-10 | `true` emitted iff the binomial is a tautonym |
| VN-11 | Possessive rate 15% ± 3 points over 10k draws |
| VN-12 | FR: gender and number agreement correct for all 24 heads × 44 modifiers |
| VN-13 | FR: adjective post-position except the six pre-nominal rank words |
| VN-14 | Missing-pool fallback returns the binomial, never a partial translation |
| VN-15 | Slot selection tracks lineage-local unusualness — a lineage with fixed hue must emit colour in under 5% of names |
| VN-16 | **Drift harness extension** — 300 generations, 100 described: ≥ 60 distinct vernaculars, exactly 1 head noun |

VN-15 is the assertion that tests whether §4 actually works. If slot scoring is wrong the
layer will still produce grammatical names — it will just name the same uninformative axis
every time, and nothing else in the suite would catch it.

---

## 11. Open decisions

1. **FR head nouns above are first drafts.** Several are weak — `vautré`, `phalange` and
   `trébucheur` in particular read as adjectives or anatomy rather than as animal names.
   This table wants a native pass, and Louise's ear is probably better than mine here.
2. **Possessive rate 15%** — arbitrary until played.
3. **Whether `dwarf`/`giant` should read absolute size or lineage-relative size.**
   Recommendation: lineage-relative, consistent with 13 §9, but absolute is defensible for
   these two words specifically since a player compares across the whole Atlas.
4. **Third language.** The pool cost is 68 words. NL is the obvious candidate and its
   compounding suits the head nouns unusually well.
