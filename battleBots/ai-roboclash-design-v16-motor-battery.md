# AI ROBOCLASH — Design v16 : couplage physique moteur ↔ batterie

Réponse au diagnostic précédent : les plaques signalétiques étaient réalistes mais découplées. Trois liens physiques établis.

## 1. Courbe couple-vitesse
Un moteur DC voit son couple chuter linéairement du calage (à l'arrêt) à zéro au régime libre. La force de traction suit désormais cette courbe : `F(v) = F_stall · max(0, 1 − v/v_libre)`. Conséquence : **la vitesse de pointe émerge de la physique** (la force s'annule au régime libre) au lieu d'être un plafond artificiel. L'accélération est forte à basse vitesse et s'estompe près du top speed — comportement réaliste. Vérifié : le pic de vitesse atteint reste sous la vitesse-stat (la force se tarit).

## 2. Tension → régime et couple (le nombre de cellules compte)
Le régime libre d'un moteur DC est ∝ V (constante Kv) et son couple de calage ∝ V (Kt·V/R). Donc **plus de cellules S = plus vite ET plus fort**. Les plaques rpm/couple sont cotées au pack stock 3S, donc le stock est inchangé ; les packs 4S/6S scalent au-dessus. Couplage **tempéré** (rendements décroissants : `1 + 0,5·(V/V_ref − 1)`) parce qu'en vrai on ne fait pas tourner un moteur 3S sur 6S pour un doublement gratuit — un moteur a une plage de tension utile. Résultat : vitesse stock 88 → b1 (4S) 103 → b3 (6S) 132. La force gagne aussi, mais reste souvent plafonnée par le grip (physiquement correct : le surplus part en patinage).

## 3. Wh → autonomie
L'énergie de simu vient maintenant des **Wh réels du pack** (`S·3,7·mAh`), plus un nombre abstrait. Un pack 6S 2200 (48,8 Wh) donne bien plus d'autonomie qu'un 3S 1300 (14,4 Wh). Calé pour que le stock reste à 130 ; les ratios de décharge par châssis (boxy/wedge/dart) sont préservés, et le couplage Wh joue à l'intérieur de chaque coque (boxy b0 130 → b3 440). Le fade de fin de match est reformulé comme un **affaissement de tension** LiPo sous charge/décharge.

## Ce qui restait déjà rigoureux (inchangé)
Réduction (levier Puissance = vrai compromis couple/vitesse), friction de Coulomb statique/cinétique + μ d'arène, masse bottom-up → inertie/ancrage, capacité Wh calculée.

## Recalibration
Le vrai modèle change la dynamique (upgrades batterie plus fortes), donc re-calage — comme à chaque passe physique. Stock RUSTY inchangé (vitesse 88, push 165, énergie 130). Écart boutique élargi (les upgrades comptent davantage). L'arc professeur a été rendu **robuste** (il cherche automatiquement le levier gagnant plutôt qu'une leçon codée en dur — plus de re-chasse à chaque passe), conformément à ta consigne de ne pas s'obséder sur les professeurs. cpu reste une pièce quasi neutre (subtile).

## Garde-fous
- QC couplage : plus de cellules → plus de vitesse ET de force, plus gros pack → plus d'autonomie, vitesse de pointe émergente sous la stat.
- Porte : syntaxe · QC · smoke · render_diff · editor_check — tous 0 échec.

## Fondamentaux : état
Moteur et batterie sont maintenant **couplés physiquement** (tension↔régime/couple, couple↔vitesse, Wh↔autonomie), sur une base déjà saine (friction Coulomb, masse réelle, hitbox WYSIWYG, CG). Ouvertures restantes : dégâts/arrachage par composant (colliders tagués), classes de poids / plus gros châssis.
