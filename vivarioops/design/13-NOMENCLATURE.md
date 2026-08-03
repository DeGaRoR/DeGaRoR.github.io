# VIVARIOOPS — 13 · Nomenclature

**Document 13 of the Vivarioops design set.** Refines 10 §A10 and §A17.5.

| | |
|---|---|
| **Status** | Authoritative for naming. Specification only — no implementation in this document. |
| **Supersedes** | 10 §A10 (derived binomial), 10 §A17.5 (naming table cardinality) |
| **Superseded by** | Nothing |
| **Upstream** | 00 Vision · 01 Contracts · 10 L1 Creature |
| **Downstream** | 21 UI (Describe sheet, Atlas) · 20 Trunk (store schema, gate manifest) |
| **Breaks** | `engine/l1/naming.js` public surface, gate assertions on `genusSpace()` and `EPITHET_COUNT`, genome schema (adds `tag`) |

---

## 1. What is wrong with the current system

`naming.js` composes a genus from 4 segment roots × 6 form roots × 3 suffixes and
selects one of 24 epithets by extremity. Nominal space is 1,728 binomials.

This is not a vocabulary shortage. It is a **bits shortage**. The signature feeding the
name carries roughly seven bits of discriminating information, and the four axes it reads
are correlated, so the occupied set is far smaller than the nominal one. The observed
symptom — the same names recurring constantly — is the arithmetic working correctly.

Three further defects, each independent of cardinality:

1. **Uniform texture.** Every output has the same slot count, the same syllable count and
   the same rhythm. The template becomes audible within about twenty names.
2. **No elision.** `macro` ⊕ `arthros` yields *Macroarthros*, which no classicist and no
   ear will accept. Roughly a third of raw combinations are malformed.
3. **Flat frequency.** A uniform draw over 24 epithets is not what a real corpus looks
   like. Real corpora are Zipfian, and the rare name only feels rare against a common one.

And one that only shows up in play: **a player who breeds a single clade for three hundred
generations never visits the morphospace.** Global cardinality is a statement about a
region the player does not enter. §9 is the answer to that, and it is the most important
section in this document.

---

## 2. Principles

**P1 — The binomial is derived, never authored.** Unchanged from 10 §7. Structurally
convergent creatures receive the same genus in different vivaria, and that is the entire
value of the mechanism. The player-authored channels defined in §11 sit deliberately
*outside* the binomial.

**P2 — Rank granularity mirrors mutational stability.** Family reads the most conserved
part of the signature, subspecies the least. This is what makes lineage legible: the
higher ranks hold still while the lower ones churn, so a wall of specimens reads as a
clade at a glance.

**P3 — Family and genus normalise globally; species and subspecies normalise locally.**
A genus is a claim about form and must mean the same thing everywhere. A species is a
claim about position within a population, and the relevant population for a bred lineage
is its own siblings. See §9.

**P4 — Naming is pure given an explicit context record.** Local normalisation and
collision suppression require state that naming previously did not read. That state is
injected, never fetched. `binomial(plan, genome, ctx)` is a pure function of its three
arguments. This is a real architectural change and §14 states its consequences.

**P5 — Every generated string must be pronounceable.** The phonotactic filter in §6 is
not decoration. It is the single highest-yield rule in this document.

---

## 3. Required signature

The signature is extended from four axes to eleven. Axes marked **(new)** must be added to
`signature()` before this document can be implemented.

| # | Axis | Type | Feeds |
|---|---|---|---|
| 1 | `symmetry` | plano · actino · ataxo | Family, terminal |
| 2 | `segmentBucket` | oligo · meso · poly · myria | Family |
| 3 | `mirrored` | bool | Family |
| 4 | `limbBucket` | 6 buckets | Genus prefix |
| 5 | `dofClass` | low · mixed · high **(new)** | Genus prefix |
| 6 | `depthBucket` | 4 buckets | Genus arity |
| 7 | `longestRun` | 5 buckets | Genus second prefix |
| 8 | `angleClass` | narrow · mid · wide **(new)** | Genus second prefix |
| 9 | `traits` | 6 continuous, z-scored | Species epithet |
| 10 | `mediumClass` | thin · nominal · dense **(new, from world)** | Habitat epithet |
| 11 | `tag` | uint32, inherited **(new, genome field)** | Author, subspecies |

**Dead axes.** The rule already established in `naming.js` holds and generalises: an axis
whose limits give it zero variance under the current `SLICE_LIMITS` is skipped at
selection, not removed from the table. `density` is presently such an axis. The skip must
be derived from the limits, not listed, so that restoring a real density band needs no
edit here.

---

## 4. Rank derivation

### 4.1 Family — 24 archetypes

```
archetype = symmetry (3) × segmentBucket (4) × mirrored (2)
family    = FAMILY_ROOT[archetype] + "idae"
```

`FAMILY_ROOT` is a **curated table of 24 entries**, not generated. Family names are the
part of the taxonomy the player sees most often and remembers longest; twenty-four strings
is a small enough budget to make every one of them good. Each entry also fixes that
family's **body stem** and **register** (§5.3), which is what produces visible nesting:
every genus in *Dolichopodidae* contains `pod`.

| Archetype | Family | Stem | Register |
|---|---|---|---|
| plano · oligo · mirrored | Brachypodidae | pod | anatomical |
| plano · meso · mirrored | Dolichopodidae | pod | anatomical |
| plano · poly · mirrored | Stenosomatidae | somat | anatomical |
| plano · myria · mirrored | Myriarthridae | arthr | anatomical |
| plano · oligo · unmirrored | Camphyloscelidae | scel | anatomical |
| plano · meso · unmirrored | Plagiocaudidae | caud | anatomical |
| plano · poly · unmirrored | Loxonotidae | not | anatomical |
| plano · myria · unmirrored | Scoliorhachidae | rhach | anatomical |
| actino · oligo · mirrored | Nereidae | Nere | mythological |
| actino · meso · mirrored | Proteidae | Prote | mythological |
| actino · poly · mirrored | Thetidae | Theti | mythological |
| actino · myria · mirrored | Hydridae | Hydr | mythological |
| actino · oligo · unmirrored | Boreadidae | Bore | mythological |
| actino · meso · unmirrored | Echoidae | Ech | mythological |
| actino · poly · unmirrored | Lethaeidae | Leth | mythological |
| actino · myria · unmirrored | Charontidae | Charont | mythological |
| ataxo · oligo · mirrored | Amorphidae | morph | abstract |
| ataxo · meso · mirrored | Physaridae | physar | abstract |
| ataxo · poly · mirrored | Plasmatidae | plasmat | abstract |
| ataxo · myria · mirrored | Chaomatidae | chaomat | abstract |
| ataxo · oligo · unmirrored | Atactidae | tact | abstract |
| ataxo · meso · unmirrored | Sphalmatidae | sphalmat | abstract |
| ataxo · poly · unmirrored | Anomalidae | anomal | abstract |
| ataxo · myria · unmirrored | Teratidae | terat | abstract |

Three registers, assigned by symmetry class, so a whole clade reads coherently. A bilateral
family sounds clinical; a radial one sounds like a Greek chorus; a chaotic one sounds like
a pathology report. Symmetry class is the most visually obvious property of a creature, so
tying register to it means the name *sounds like* what you are looking at.

### 4.2 Genus

```
stem   = elide( P₂? ⊕ P₁ ⊕ FAMILY_STEM )
genus  = capitalise( stem ) + TERMINAL[symmetry]
```

| Slot | Source | Cardinality |
|---|---|---|
| `P₁` | limbBucket (6) × dofClass (3) | 18 prefixes |
| `P₂` | longestRun (5) × angleClass (3), present only at arity 3 | 12 prefixes |
| `TERMINAL` | plano → `us` · actino → `a` · ataxo → `ops` | 3 |

**Variable arity — the fix for uniform texture.** Slot count is driven by `depthBucket`,
so name length carries information rather than being constant:

| depthBucket | Arity | Form | Example |
|---|---|---|---|
| 0–1 | 1 | bare stem | *Podus*, *Nerea*, *Teratops* |
| 2–3 | 2 | P₁ ⊕ stem | *Dolichopodus*, *Macronerea* |
| 4+ | 3 | P₂ ⊕ P₁ ⊕ stem | *Leptomacropodus*, *Campylopachyteratops* |

Target mix across a broad corpus is roughly 15 / 70 / 15. Blunt two-syllable names next to
seven-syllable monsters is what a real corpus sounds like; uniform four-syllable names are
what a generator sounds like.

Nominal genera per family: 1 + 18 + (18 × 12) = **235**. Across 24 families, **5,640
nominal** before elision culling and before axis correlation. See §13 for what is actually
reachable.

### 4.3 Species

Five channels, drawn by weight. Weights are the mechanism that makes rare names feel rare.

| Channel | Weight | Condition | Form |
|---|---|---|---|
| Descriptive | 72% | default | *elongatus*, *sublatus*, *brevissimus* |
| Habitat | 12% | any | *crassaquae*, *tenuiaquae*, *profundus* |
| Typicality | 9% | all \|z\| < 0.8 | *vulgaris*, *communis*, *mediocris* |
| Patronymic | 6% | any \|z\| > 2.5 | *gauderii*, *kopijae* |
| Misfit | 0.5% | any | *mirabilis*, *paradoxus*, *absurdus* |
| Tautonym | 0.5% | all \|z\| < 0.3 **and** archetype centroid | *Notus notus* |

Descriptive epithets compose as `QUALITY ⊕ TRAITSTEM + ending`:

- 20 quality prefixes: `longi, brevi, lati, angusti, crassi, tenui, celeri, tardi, rigidi, flexi, alti, humili, gracili, robusti, acuti, obtusi, denti, laevi, torti, recti`
- 18 trait stems: `caud, ped, corp, ala, artic, spin, front, later, vent, dors, rostr, palm, fibr, nod, flex, puls, grad, vibr`
- 3 intensities: `sub-` at \|z\| < 0.5 · plain · `-issimus` at \|z\| > 2.5

Intensity is the cheapest expressive win in the document. *elongatus* → *elongatissimus*
means the name carries magnitude and not just direction, and a player learns to read it at
a glance.

**Gender agreement is mandatory.** The epithet ending is fixed by the genus terminal:

| Genus terminal | Epithet ending | Example |
|---|---|---|
| `-us` | `-us` | *Dolichopodus longicaudatus* |
| `-a` | `-a` | *Macronerea longicaudata* |
| `-ops` | `-is` | *Teratops longicaudis* |

The `-ops` → `-is` mapping treats `-ops` as third-declension common gender, which is what
it is. Getting this wrong is the single most visible way a generated Latin name announces
itself as generated.

Nominal descriptive epithets: 20 × 18 × 3 intensities = **1,080 per gender**, **3,240
distinct strings**.

### 4.4 Subspecies

```
subspecies = LOCALITY_PREFIX ⊕ LOCALITY_STEM + gendered ending
key        = hash( cumulative mutation ops since last author event )
```

Derived from the **mutation path**, not from the body. This is deliberate: the path changes
on every single breeding by construction, so the trinomial churns even when morphology has
converged and the genus has held still for a hundred generations. That is also how real
long-isolated populations are treated — one species, many local forms.

- 14 locality prefixes: `orient, occident, boreal, austral, insul, litor, pelag, abyss, cavern, palud, ripar, alpin, campestr, silvat`
- 12 modifiers: `-alis, -icus, -ensis, -inus, -aceus, -osus, -atus, -iformis, -oides, -ellus, -ulus, -anus`

Nominal: 14 × 12 × 3 genders ≈ **500**.

A subspecies name is written only when the specimen's mutation distance from its described
ancestor exceeds a threshold. Below it, the binomial stands alone. Not every specimen
deserves three names.

---

## 5. Token pools

Full pools are given here so implementation requires no invention. Total hard-coded
vocabulary across the whole system is **approximately 190 tokens**, plus 24 curated family
names and 12 curated patronyms.

### 5.1 Genus prefixes P₁ — 18

`oligo, poly, myria, macro, micro, brachy, dolicho, platy, steno, eury, lepto, pachy,
ortho, campylo, hetero, iso, holo, hemi`

Assignment: `P₁ = POOL[ limbBucket * 3 + dofClass ]`.

### 5.2 Genus prefixes P₂ — 12

`allo, anisо, cyclo, dendro, gymno, litho, nemato, phyllo, schizo, sclero, strepto, thylo`

Assignment: `P₂ = POOL[ (longestRun * 3 + angleClass) mod 12 ]`.

### 5.3 Register stems

Body stems are fixed per family (§4.1 table) and are not independently drawn. The three
register pools exist so that the family table can be regenerated or extended coherently:

- **anatomical** — `pod, somat, arthr, scel, caud, not, rhach, cephal, dactyl, gnath,
  thorac, pleur`
- **mythological** — `Nere, Prote, Theti, Hydr, Bore, Ech, Leth, Charont, Triton, Nyx,
  Erebe, Kete`
- **abstract** — `morph, physar, plasmat, chaomat, tact, sphalmat, anomal, terat, schem,
  ide, tropi, styl`

### 5.4 Habitat epithets — 9

`crassaquae, tenuiaquae, profundus, superficialis, turbidus, limpidus, frigidus, gravis, levis`

Selected by `mediumClass` crossed with the world's gravity band. Habitat is one of the
largest real epithet categories and the world parameters are already recorded per specimen,
so this channel costs nothing.

### 5.5 Misfit epithets — 14

`mirabilis, monstrosus, paradoxus, inexpectatus, absurdus, elegantissimus, horridus,
ridiculus, obscurus, dubius, incognitus, fallax, insolitus, portentosus`

Drawn at 0.5%, entirely outside the derivation rules. These are the ones that get
screenshotted. The channel is worth more than its weight suggests, because its existence
means any given name *might* be one of them.

---

## 6. Phonotactics and elision

Applied at every seam, in order. A composition failing rule E5 or E6 is rejected and the
next candidate in a deterministic fallback order is tried.

| # | Rule | Example |
|---|---|---|
| E1 | Vowel + vowel at seam → drop the first | `macro ⊕ arthr` → *macrarthr* |
| E2 | Identical consonant at seam → collapse to one | `platy ⊕ ys` → *platys* |
| E3 | Consonant + consonant, both stops → insert `o` | `pachy ⊕ pod` → *pachypod* (already legal); `hemi ⊕ scel` → *hemioscel* |
| E4 | Terminal `y` before a consonant → keep; before a vowel → `y` → `i` | `brachy ⊕ artic` → *brachiartic* |
| E5 | **Reject** if any letter appears three times consecutively | — |
| E6 | **Reject** if syllable count > 7 | — |
| E7 | **Reject** if seam produces a cluster in the blacklist | `sr, tl, dl, vn, zg, kt` word-initial |
| E8 | Capitalise genus initial only; epithets always lowercase | — |

E5–E7 cull an estimated **25–35% of raw combinations**. This is intended. The rejected
combinations are the ones that make a generated corpus feel generated, and the cull is
already accounted for in §13.

---

## 7. The lineage tag

A single `uint32 tag` field is added to the genome.

- **Inherited verbatim** by every offspring.
- **Mutates on divergence, not on a coin flip.** The tag re-mints when the lineage's
  signature has drifted more than `TAG_DIVERGENCE` (proposed: normalised distance 0.35)
  from the signature recorded at the tag's founding.

Divergence-triggered minting is strictly better than a flat probability. A flat 2% over 300
generations gives about six author changes at arbitrary points. Divergence-triggering
self-scales — a fast-drifting lineage branches often, a stable one holds — and it makes the
scar meaningful: **the describer changes exactly when the animal stops being what it was.**

The tag feeds two things and nothing else: the author citation (§8) and the subspecies key
(§4.4).

---

## 8. Author citation

```
Dolichopodus longicaudatus Gauder, 2026
```

Written outside the binomial, roman rather than italic, per real convention. The author is
derived from `tag`, so **every creature in a lineage carries the same describer** while its
genus and species drift around it. This is the mechanism that makes a wall of specimens
read as kin, and it is the honest place for the Easter eggs, because in real nomenclature a
patronym honours the *describer*, not the animal.

**Date is the real date**, taken from the injected context, not the generation number. The
Atlas becomes a diary. Generation goes in the record, not the name.

### 8.1 Curated authors — Easter eggs

Seeded into the author pool so they are guaranteed reachable, with genitive by gender:

| Surname | Epithet form | Author form |
|---|---|---|
| Gauder | *gauderii* | Gauder |
| Kopij | *kopijae* | Kopij |
| Stroobant | *stroobantii* | Stroobant |
| Hoogendoorn | *hoogendoornii* | Hoogendoorn |
| Mons | *monsii* | Mons |
| Cupers | *cupersii* | Cupers |
| Dehon | *dehonii* | Dehon |
| Collette | *collettae* | Collette |
| Dozo | *dozoi* | Dozo |
| Demaere | *demaerei* | Demaere |
| Hubar | *hubarii* | Hubar |
| Enola | *enolae* | Enola |

These occupy a reserved band of the tag hash space so that they appear at a controlled
rate — proposed 1 in 64 lineages — rather than being lost in forty thousand generated
surnames.

### 8.2 Generated surnames — 9 regional grammars

Each region is a prefix pool, a root pool and a suffix pool. Roots are shared across
regions; only the affixes are regional. That is why the whole generator costs about 90
tokens and still produces tens of thousands of plausible surnames.

| Region | Prefix | Suffix |
|---|---|---|
| Flemish | `van, de, ver, van der, ø` | `-broek, -donk, -horst, -hoven, -dijk, -velde` |
| Walloon / French | `de, du, le, ø` | `-ard, -eau, -ot, -ier, -in, -et` |
| Slavic | `ø` | `-ov, -ev, -ski, -enko, -ich, -evic` |
| Nordic | `ø` | `-son, -sen, -strom, -lund, -qvist, -dahl` |
| Iberian / LatAm | `de, de la, ø` | `-ez, -es, -eiro, -illo` |
| Italian | `ø, di, da` | `-ini, -etti, -oni, -ucci, -ella` |
| German | `von, ø` | `-mann, -bach, -stein, -berger, -hardt` |
| Anglo | `Mac, Mc, O', ø` | `-son, -ton, -field, -wood, -ley` |
| Baltic / Finnic | `ø` | `-nen, -inen, -aitis, -kalns` |

**Latinisation**, applied when a surname is used as an epithet rather than as an author:

| Ending | Masculine | Feminine |
|---|---|---|
| consonant | `+ii` | `+ae` |
| `-a` | `+e` | `+e` |
| other vowel | `+i` | `+ae` |

Diacritics stripped. Particles (`van`, `de`) dropped from the epithet form, retained in the
author form.

Nominal surnames: **≈ 40,000**.

---

## 9. Local normalisation — the answer to the single-lineage problem

**This section is the reason the document exists.**

Global cardinality is a claim about the morphospace. A player who breeds one clade for
three hundred generations never enters the morphospace. If species epithets are z-scored
against a frozen global corpus median, a converged lineage collapses onto one or two
epithets and every specimen is called *vulgaris*.

**The rule.** Family and genus z-score against the global corpus. Species and subspecies
z-score against **the lineage's own running distribution**, maintained as a streaming
mean and variance over the last N described specimens (proposed N = 200).

The consequence is exactly what is needed. As a lineage converges its internal spread
shrinks, so the epithet keeps discriminating on ever-finer differences. *vulgaris* comes to
mean *typical here*, which still correctly names the modal sibling, while the odd one out
still earns *mirabilis*. Discriminating power is preserved at every scale of convergence.

This also retires the stale-reference-median defect already recorded against the `density`
axis: there is no longer a frozen B4 median to go stale.

### 9.1 Collision suppression, not disambiguation

The existing `DISAMBIGUATORS` mechanism — appending a token when a binomial is taken —
must be **removed**. Manufacturing *elongatus II* is the worst available outcome.

Replace with a **draw weight**: an epithet already present in this Atlas has its selection
probability multiplied by `SUPPRESSION` (proposed 0.05), so the generator prefers unseen
names. Genuine homonyms across separate lineages are permitted and resolve the real way —
the author citation distinguishes them, which is precisely what author citations are for.

---

## 10. Recombination scars

When a lineage's genus changes and a described ancestor carried the same species epithet
under the old genus, the author citation is **parenthesised**:

```
Brachypodus elongatus (Gauder, 2026)
  = Dolichopodus elongatus Gauder, 2026
```

The parenthesis means *this species was described in a different genus once*. It is not
decoration: it is a scar left by an actual event in the actual simulation, and it is the
cheapest history the design can produce.

**Scars are recorded in the Atlas only.** The tank shows the current binomial with no
parentheses and no synonymy. In the tank they are noise; in the Atlas they are the best
thing in the app.

The Atlas specimen view shows the full synonymy chain, most recent first, with the
generation at which each transfer occurred.

---

## 11. Player-authored channels

Two, both explicitly outside the derived binomial.

### 11.1 Provisional designator — `sp.`

An undescribed specimen in the tank reads:

```
Dolichopodus sp.
```

No ceremony. Most specimens are of no interest and the notation should say so.

The player may attach a **provisional designator** in field-collector notation — single
quotes, roman not italic, never italicised, never in the epithet slot:

```
Dolichopodus sp. 'Enola'
```

This is authentic practice: informal manuscript names are how working taxonomists label
material that is recognisably distinct but not yet described. Max 24 characters. It does
not break derivation because it never occupies a derived slot.

### 11.2 Promotion

On description, a provisional designator may be **promoted** to a species epithet, latinised
by the §8.2 rules:

```
Dolichopodus sp. 'Enola'  →  Dolichopodus enolae Gauder, 2026
```

This is the one place a player-authored string legitimately enters the taxonomy, and it is
the correct ceremony for the Describe sheet. Promotion is irreversible. A promoted epithet
is registered in the Atlas and suppressed from future draws exactly like a derived one.

The optional **common name** field from 21 §7.1 is unchanged and remains free text.

---

## 12. Vernacular layer — DEFERRED, decision open

A parallel English-grammar reading of the same signature:

> *Gauder's lesser ribbon-walker* · *the banded whipfoot* · *Kopij's paddlebeast*

The binomial is admirable; the vernacular is affectionate, and affection is what makes a
collection. This is likely where most of the felt joy would live.

It is **not in scope** pending an explicit decision. It roughly doubles the token work and
it is the component most likely to read as twee if executed badly. Recorded here so it is
not silently lost.

---

## 13. Reachability

Two numbers. Only the second one matters for play.

| | Global nominal | Global reachable (estimate) | Single lineage, 300 gen, 100 described |
|---|---|---|---|
| Families | 24 | 24 | 1 |
| Genera | 5,640 | **600 – 1,500** | 1 – 4 |
| Species epithets | 3,240 descriptive + 40,000 patronymic | ~2,400 + 40,000 | ≥ 95 distinct |
| Subspecies | 500 | ~420 | ~100, effectively all distinct |
| Authors | 40,000 | 40,000 | 5 – 20 |
| **Binomials** | ~10⁹ | — | — |

**The genus figure is given as a range because it must be measured, not asserted.** The
axes feeding genus are correlated — limb count and tree depth in particular — and the
elision filter culls a further 25–35%. Occupancy over a 10,000-genome corpus is the only
honest source for this number. That measurement is gate assertion NM-18 and it is expected
to be the first thing this design gets wrong.

**One genus across 300 generations is not a failure.** You bred one clade; it should read
as one clade. The requirement is narrower and much more testable: *the hundred specimens a
player cared enough to describe must carry a hundred distinct names.* §9 buys that, and
§14 asserts it.

---

## 14. Contract changes

### 14.1 Signature change

```
binomial(plan, genome, ctx) → { family, genus, species, subspecies?, author, year,
                                binomial, trinomial, citation, scars[], signature }
```

`ctx` is an injected record, never fetched:

```
ctx = { lineageStats, atlasUsage, date, worldParams, tagRegistry }
```

Naming was previously pure over `(plan, genome)`. It remains pure — over
`(plan, genome, ctx)`. **This is a real architectural change and every caller must supply
`ctx`.** It does not violate the standing rule against impure engine modules, because
`ctx` is a value, but it does mean the engine now requires the caller to hold naming state.
Callers: tank screen, Describe sheet, Atlas writer, share card.

### 14.2 Removed

- `genusSpace()` in its current form — replaced by `familySpace()` and
  `measuredGenusOccupancy(corpus)`.
- `EPITHET_COUNT` — replaced by per-channel counts.
- `DISAMBIGUATORS` — replaced by suppression weights (§9.1).
- Gate assertion **A17.5** — retired, replaced by NM-1 … NM-22.

### 14.3 Genome schema

`tag: uint32` is added. Schema version bumps; a migration must mint a tag for every existing
genome from its `genomeHash`.

**Open decision.** Does `tag` enter `genomeHash`? Recommendation: **yes** — the genome is
the genome, and excluding a field because it is inconvenient is how hash contracts rot.
Consequence: existing hashes change and the store migration must handle it. `tag` must
**not** enter `worldHash`, and must be excluded from any morphology-equality comparison.

---

## 15. Gate assertions

Suite `nomenclature`. IDs provisional pending `gate/manifest.js`. Every assertion is subject
to the standing rule: mutation-tested before green is accepted.

| ID | Assertion |
|---|---|
| NM-1 | Determinism: identical `(plan, genome, ctx)` yields an identical record, 1,000 trials |
| NM-2 | Gender agreement: epithet ending matches genus terminal for every corpus member |
| NM-3 | Every genus in a family contains that family's stem |
| NM-4 | Family name always ends `-idae`; exactly 24 distinct families reachable |
| NM-5 | No output violates E5 (triple letter) |
| NM-6 | No output violates E6 (> 7 syllables) |
| NM-7 | No output violates E7 (blacklisted cluster) |
| NM-8 | Elision E1–E4 applied at every seam — property test over all P × S pairs |
| NM-9 | Arity distribution over a 10k corpus falls within 15/70/15 ± 8 points |
| NM-10 | All 12 curated authors reachable within 10k tag draws |
| NM-11 | Curated author rate within 1-in-64 ± 30% |
| NM-12 | Latinisation table total over all 40k generated surnames — no empty, no duplicate collision with a curated form |
| NM-13 | Tag inherited verbatim when divergence < threshold, across 100 breedings |
| NM-14 | Tag re-mints within 5 generations of crossing `TAG_DIVERGENCE` |
| NM-15 | Scar recorded iff genus changes with epithet retained; synonymy chain ordered |
| NM-16 | Suppression: over 500 sequential draws into one Atlas, distinct-epithet rate ≥ 90% |
| NM-17 | Promotion: `sp. 'X'` → latinised epithet, registered, suppressed thereafter |
| NM-18 | **Measured genus occupancy over a 10k-genome corpus, reported not bounded** |
| NM-19 | Dead-axis skip derived from limits, not listed (regression on the `density` defect) |
| NM-20 | Local normalisation: streaming mean/variance matches batch to 1e-9 over 200 samples |
| NM-21 | Provisional designator never enters the epithet slot |
| NM-22 | **Drift harness** — see below |

### 15.1 NM-22, the drift harness

The assertion that actually tests the design:

> Breed 300 generations from a single founder under a fixed selection pressure. Describe
> every third generation, 100 specimens total. Assert:
>
> - distinct binomials ≥ **95**
> - distinct genera ≤ **5**
> - families = **1**
> - zero elision violations
> - at least one author change, at most eight
> - at least one recombination scar if genus changed at all

Runtime budget: under 90 seconds headless. If the design is wrong, this suite goes red, and
it is the only suite in the set that would catch it.

---

## 16. Open decisions

1. **Vernacular layer** (§12) — in or out.
2. **`tag` in `genomeHash`** (§14.3) — recommendation is yes; confirm before migration.
3. **`TAG_DIVERGENCE = 0.35`** — arbitrary until NM-14 and NM-22 are run.
4. **Curated author rate 1-in-64** — high enough to be found, low enough to stay special.
5. **Subspecies write threshold** — how far a specimen must sit from its described ancestor
   before a third name is written at all.
