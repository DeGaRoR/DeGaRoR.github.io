# AI RoboClash — visual / design review

_Full-surface visual pass: Garage, Championnats, League/concours, VS, Combat,
Debrief, Settings, Shop, Chassis sub-page, Welcome. Reviewed in-browser at ~635px
(mobile-first PWA)._

## Overall
The **art direction is strong and cohesive** — workshop-desk backgrounds, the
green cutting mat, rendered bots, the dohyo arena, the "CTRL-ALT-DESTROY" decals.
It reads like a real hobbyist-robot world. Nearly all the problems live in the
**typographic / UI layer on top of the art**, and most are systemic (fix once →
fix everywhere).

## 🔴 Highest impact — accents are stripped  ✅ FIXED (2026-07-30)
> Root cause: `t()` ended with `return da(s)` and `da` stripped diacritics globally
> (the source strings *do* carry accents, e.g. `scrPass:"Éligible"`). The fonts —
> with new `Barlow/Saira Condensed` fallbacks on the decorative roles — render
> accents fine. Fix: `da` → identity; font-var fallbacks added; two QC assertions
> that hard-coded stripped forms updated. Verified in-browser; gate green.

Every French string renders without diacritics: "pieces libres", "Equipement",
"Reglages", "Carrieres", "Feroce", "Agressivite", "precedente", "Bientot",
"ARENE S'EST REFERMEE". To a French reader this reads as broken/machine-translated
and undercuts the art. It's a global `da()` transform applied because a couple of
display fonts render accents poorly. **Fix:** stop stripping globally; apply an
accent-safe font only to the roles that need it. Nothing else moves the needle
this much.

## 🟠 High-impact systemic
1. **Too many type styles, low legibility.** Pixel font + condensed sans + a
   script italic ("Nouveau", "Machine") + mono, often small and ALL-CAPS. Tighten:
   pixel font for **big titles only**, one legible sans for labels/body, mono for
   numbers.
2. **ALL-CAPS on body/coaching text** — walls of caps. Sentence case reads better.
   ✅ **Done (2026-07-30):** the debrief coaching (`#ovCause`) moved off the short-
   label style onto a proper body treatment (Barlow, 14px, 1.45 line-height,
   sentence case); the concours constraint/CT chips (`.rc-chip`) de-capped to
   sentence case at 10px. (CSS `text-transform` only — DOM text is unchanged, so no
   QC impact.) *Remaining:* consolidating the decorative fonts (the script "Nouveau"
   badge, "Machine" style label) into the label system — smaller follow-up.
3. **Emoji mixed with custom glyphs** (🔒 ⚙ ● vs the geometric ◈ / bolt SVG) —
   render per-platform, clash with the pixel aesthetic. Swap for SVG/custom icons.
4. **Low contrast on secondary text** (stat-bar labels, "usure 18%", rules chips,
   locked-league subtitles). Raise a notch.
5. **Vertical void on tall screens** — mobile-first layout leaves a large dead dark
   area below content. Center vertically or cap width + center.

## 🟡 Component-level
- **Stat bars** (Vitesse/Poussée/Prise/Traction/Énergie): thin, dim, no numbers,
  tiny labels — under-designed for a key data component.
- **Rules run-on line** ("CLASSE S · ARMES INTERDITES · … · ≤1.42 KG") — hard to
  scan; use real pill/chip components.
- **CT error panel**: 4 red ✗ lines for a bare bot is alarming clutter —
  consolidate ("CT : 4 pièces manquantes ▸") or soften.
- **Shop carousels clip** the 4th card at the right edge with no scroll affordance.
- **VS card asymmetry**: opponent has an archetype line (NIVEAU 1 · FONCEUR); the
  player card has an empty gap there.
- **Combat has no live HP/dominance readout** — can't read who's winning until the
  debrief.
- **Garage bot-strip**: "JETER" overlaps the thumbnail; the "Boutique +" cell is
  plain vs the bot cells.

## 🐛 Also spotted
- **"Ligne Calibrage"** in the leagues list — likely a typo for **"Ligue"**.
- Locked leagues repeat a generic subtitle ("Étoiles requises dans la ligue
  précédente") — could state how many stars.

## Suggested order of attack
1. **Accents** — biggest visual win (font-role change + drop the global strip).
2. **Type hierarchy + de-cap body text** — legibility everywhere.
3. **Emoji→SVG icons + contrast pass** — polish, consistency.
4. **Stat bars + rules chips redesign** — most-seen data components.
5. Small bugs (carousel clip, Ligne→Ligue, VS gap).

_Scope note: this covers what's visible statically. A deeper pass could cover
motion, focus states, and accessibility (the code review already flagged
non-semantic controls + missing focus styles)._
