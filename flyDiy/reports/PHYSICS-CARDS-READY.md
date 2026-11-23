# PHYSICS-CARDS: READY 1b (ref `claude/ready/physics-cards-1b`, ON TOP of `claude/ready/physics-audit-1b`)

**1b = 1 (`c77a37959`) carried onto physics-audit-1b (`143eff6db`), whose only change is its own note. The cards, the
baseline and the two fiches are the same bytes.**

The user, 22 Nov: "If you modified the planes disabling handle and stuff like that, you should submit their new
version, shouldn't you?" - and "Yes you may push". A0, 22 Nov: its own ref, on top of physics-audit-1 (its figures
were measured on that physics: it must not land before it), the same train.

Seven cards corrected to their parents. Found while building the fuselage-drag line; each stands on its own, without
that line's physics. No core file, no tool, no built file moves: cards, the REALBAND baseline, two fiches' baked
physics pages.

## The cards

Error against the book, `real_check --quick`, physics-audit-1 → this ref (`~` near, `!` outside):

| card | rows | why | what moves |
|---|---|---|---|
| `builds/candidates/jodel_geo.json` (Jodel D.112) | `s1Fair 1`, `s1LegFair 1` | the card drew bare round oleo legs and no spats; the D.11 family has "a fixed, spatted undercarriage" (Wikipedia, Jodel D.11). **The leg fairing is read off photographs, not a document** | top speed -11 → -5, cruise -6 → 0, glide -9 → -1, take-off roll -1 → -3, empty 0 → +4 |
| `builds/candidates/superpetrel_V4_2.json` (Super Petrel) | `wgCons 5`, `w2Cons 5` (aluminium tube + fabric) | the card's wings were "as the aeroplane" = moulded carbon; the real wing is tubular aluminium spars, foam ribs and fabric | max cruise +12 ~ → +7 ~, glide +16 ~ → +7, empty +2 → -3; **take-off roll +21 ~ → +24 !** (the one row that moves away) |
| `builds/candidates/tigermoth_2026-10.json` | `s1LegFair 1` | its parent's gear struts are streamline sections | top speed -1 → +1, cruise +7 → +9, climb +2 → +5 |
| `builds/candidates/camel_2026-10.json` | `s1LegFair 1` | the same | top speed -3 → -1 |
| `builds/candidates/electric_trainer.json`, `builds/archaeopteryx_2026-11-10.json`, `builds/ls4_2026-11-13.json` | `accHandling 0` | no boarding steps or grab handles on a Velis, an Archaeopteryx or a sailplane | nothing on this physics (the drawing only) |

What is DRAWN changes on all seven (spats, leg fairings, no steps or handles): their thumbnails and fiche pictures
want a re-bake on the box (A0: AIRCRAFT-LOOKS, on the merged tree).

## Re-pin

| gate | what | why |
|---|---|---|
| REALBAND | `tools/realband_baseline.json` re-written on this tree | the four cards above move their planes' figures (jodelg, petrel42, tigermothm, camelm); the reason is in the file's history |

## Gates

Run on the same files (physics-cards-1: physics-audit-1 4a1989294 + the cards + the baseline + the two re-baked fiches;
on 1b itself CARDS, PLANELISTS, SNAPSHOTS, BUILT and COMMITHYGIENE were run again): CARDS, PLANELISTS,
REALBAND, SNAPSHOTS, DRAGROWS, COOL, BIPLANE, WIRES, CARDDRAG, HONEST, PLANEFICHE, BUILT, COMMITHYGIENE - 13 of 13 pass.

Nothing else was run on this ref: it changes no code, so its reds are physics-audit-1's (that ref's note and its
chunk logs). The fiches' baked physics pages: re-baked, two moved (the Camel's and the Tiger Moth's).

## Not here

Three card changes that need a row only the fuselage line has ride physics-audit-2: the Client Cub's narrowed, cut
cowl; the Electric trainer's propeller cut; the DC-3's root fillet.
