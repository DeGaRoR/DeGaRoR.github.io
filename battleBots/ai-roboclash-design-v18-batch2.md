# AI ROBOCLASH — v18 : second lot (12 points)

## Bugs corrigés
**Niveau externe bloqué sur l'avant — trouvé et corrigé.** Les deux slots d'arme *réservés* (non montés, invisibles) occupaient chacun un bloc 3×3 en layout : ils squattaient l'avant de la coque et bloquaient le placement des capteurs partout ailleurs. Une arme non montée n'occupe plus **aucune** place (arrangement, validité, drag, hit). Vérifié : les capteurs se posent désormais sur 36/36 cellules du châssis boxy.

**Uniformité d'échelle — ton œil était bon.** L'échelle combat était basée sur le rayon du châssis : une cellule (3 cm) rendait à 6,2 px sur boxy, **4,8 sur wedge (77 % — ton "80 %")**, 4,0 sur dart. Mêmes batteries/chenilles, tailles différentes. Passage en échelle **cell-true** : une cellule = même taille à l'écran pour tous les châssis, pour le rendu ET les colliders (le wedge/dart deviennent physiquement cohérents — leurs hitbox grossissent en proportion). Vérifié : batterie b1 = 11 px partout (2 % résiduel du gap fixe, contre 36 % avant).

## UI demandée
- **Bouton de combat déplacé en haut**, juste sous la présentation des deux bots (versus). C'était demandé, c'est fait — désolé pour l'oubli.
- **Bots au max à l'écran** : marge du display rognée (cadrage serré sur l'arène, 40→6 unités de marge) — sans toucher au gameplay.
- **Feedback des décisions** : le cercle blanc pointillé = **Dominé** (tu perds le duel de levier — l'adversaire a plus de prise). Un label rouge « Dominé ! » flotte désormais au premier instant de chaque domination, et tous les modes de l'IA floatent leur label (rôde / CHARGE ! / au centre ! / orbite / à l'affût / FUITE !).
- **Stickers** : cartes à taille fixe → carrousel scrollable horizontalement ; bouton d'achat aligné sur le style des pièces (prix dans le bouton) ; **centrage possible** (snap demi-cellule → un sticker peut être pile sur l'axe) ; **plusieurs du même type** (chaque tape en pose un de plus, badge ×N) ; retrait en le glissant **hors de la coque**.

## Gameplay ciblé
**Fuite quand on est poussé — via update software, comme tu l'as proposé.** Nouveau *Firmware v3 Escape* (s2, 240🔩) : quand le bot est dominé au contact, il ne s'obstine plus dans un duel perdu — il **pivote puis recule** hors du corps-à-corps (le simple recul sous poussée maintenait le contact, mesuré et corrigé). Effet mesuré contre un flipper agressif : temps dominé −25 %, pire épinglage 2,2 s → 1,8 s. Outil de survie, pas de victoire.

**Cap batterie 4S au haut niveau — appliqué et vérifié.** Les adversaires ≥L3 sont capés à b1 (4S) ; et le m4 (3×3) est interdit au dart (trop étroit). Résultat : **480/480** loadouts générés (L1–L6) se placent légalement.

## Notes de design (pas implémenté, sur ta consigne de prudence)
- **Composants multiples** (2×/3× batteries, moteurs) pour les bots lourds : à faire avec les classes de poids / grands châssis (2d). Implications larges : masse, physStats (τ cumulés, Wh cumulés), slots dynamiques, UI. Noté pour la passe châssis.
- **Incohérence de données détectée** : la batterie b2 s'appelle « LiPo 6S » mais ses specs PHYS sont 4S/2200 mAh. À trancher : renommer (cosmétique) ou passer S=6 (rééquilibre le couplage tension). Je n'ai pas tranché seul.
- Rappel flags : stratégie **Pression** la plus forte contre adversaires variés.

## Tableau des pièces (généré depuis le code)
| Type | Pièce | Caractéristiques | Footprint |
|---|---|---|---|
| propulsion | pr0 Deux roues + patins | μ 0.7 · roue r3cm · 0.12 kg · 0🔩 | 1×2 /côté (miroir) |
| propulsion | pr1 4×4 crampons | μ 0.95 · roue r3cm · 0.3 kg · 90🔩 | 1×4 /côté (miroir) |
| propulsion | pr2 Triporteur sport | μ 1.05 · roue r3cm · 0.18 kg · 140🔩 | 2×3 /côté (miroir) |
| propulsion | pr3 Chenilles acier | μ 1.15 · roue r2cm · 0.55 kg · 200🔩 | 2×5 /côté (miroir) |
| motor | m0 Bobinage fatigué | τ 0.2 Nm · 600 rpm · 0.22 kg · 0🔩 | 1×1 |
| motor | m1 Twin 540 | τ 0.28 Nm · 650 rpm · 0.28 kg · 60🔩 | 2×2 |
| motor | m2 Vector Brushless | τ 0.42 Nm · 750 rpm · 0.34 kg · 150🔩 | 2×2 |
| motor | m3 KV90 Couple-Monstre | τ 0.75 Nm · 500 rpm · 0.46 kg · 230🔩 | 3×2 |
| motor | m4 KV600 Sprint | τ 0.3 Nm · 1400 rpm · 0.3 kg · 230🔩 | 3×3 |
| battery | b0 Pack gonflé | 3S 1300 mAh (14.4 Wh) · 0.11 kg · 0🔩 | 2×1 |
| battery | b1 LiPo 4S | 4S 1500 mAh (22.2 Wh) · 0.17 kg · 50🔩 | 2×2 |
| battery | b2 LiPo 6S | 4S 2200 mAh (32.6 Wh) · 0.24 kg · 120🔩 | 4×2 |
| battery | b3 Brique graphène | 6S 2200 mAh (48.8 Wh) · 0.33 kg · 190🔩 | 5×3 |
| cpu | c0 8-bit récupéré | réflexion 18 ticks · gain 0.85 · 0🔩 | 1×1 |
| cpu | c1 Cortex M7 | réflexion 8 ticks · gain 1.05 · 120🔩 | 1×1 |
| cpu | c2 Pod neuronal | réflexion 3 ticks · gain 1.3 · 240🔩 | 2×1 |
| cooling | k0 Passif | refroid. {"kg":0} · 0🔩 | 1×1 |
| cooling | k1 Ailettes alu | refroid. {"kg":0.05} · 70🔩 | 2×2 |
| cooling | k2 Watercooling | refroid. {"kg":0.12} · 160🔩 | 3×3 |
| ballast | l0 (aucun) | 0 kg (au plancher, baisse le CG) · 0🔩 | 1×1 |
| ballast | l1 Gueuse 300 g | 0.3 kg (au plancher, baisse le CG) · 40🔩 | 1×1 |
| ballast | l2 Gueuse 600 g | 0.6 kg (au plancher, baisse le CG) · 90🔩 | 2×1 |
| software | s0 Firmware v1 | logique de base · 0🔩 | 1×1 |
| software | s1 Firmware v2 VectorPush | poussée vectorielle · 150🔩 | 1×1 |
| software | s2 Firmware v3 Escape | fuite + poussée vectorielle · 240🔩 | 1×1 |
| srimech | r0 (aucun) | redressement ×1 · 0🔩 | 1×1 |
| srimech | r1 Bras basculeur | redressement ×0.6 · 130🔩 | 2×2 |
| srimech | r2 Piston CO₂ | redressement ×0.35 · 240🔩 | 3×2 |
| armor | a0 (tôle nue) | levier +0 · 0 kg · 0🔩 | coque + rangée avant |
| armor | a1 Lame acier | levier +0.3 · 0.08 kg · 180🔩 | coque + rangée avant |
| armor | a2 Fourche | levier +0.45 · 0.15 kg · 260🔩 | coque + rangée avant |
| sensors | n0 Pare-chocs | bruit visée 1 · 0🔩 | 1×1 |
| sensors | n1 IR 360° | bruit visée 0.45 · 110🔩 | 1×1 |
| sensors | n2 LIDAR | bruit visée 0.15 · 230🔩 | 2×1 |
| weapon1 | w0 (aucune) | réservé · 0🔩 | 3×3 |
| weapon2 | x0 (aucune) | réservé · 0🔩 | 3×3 |


## Porte
syntaxe · QC · smoke · render_diff · editor_check — tous 0 échec. (T1 re-choisi gagnable après le cell-true : wedge fearful, 3 %→95 % avec un levier.)
