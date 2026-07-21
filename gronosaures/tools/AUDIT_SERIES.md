# AUDIT DES SÉRIES — v103, avant déploiement

Ce document existe parce que la confiance s'était abîmée, et à raison : trois
défauts majeurs (volets tronqués, clics morts, liens absents) ont été livrés
« prêts » avant d'être attrapés par les playtests. Il dit ce qui est **prouvé**,
ce qui a été **jugé**, et ce qui reste **ouvert** — chaque affirmation étant
reproductible par la commande indiquée.

---

## 1. Ce qui est prouvé mécaniquement

| Garantie | Preuve | Résultat |
|---|---|---|
| Chaque volet, question, clé et explication du markdown est livré intégral dans data.js | audit md ↔ livré, tolérance 4 car. | **0 écart** sur les 10 packs à équations |
| La série conscience livre les 13 chapitres, statuts [débattu] et sources | qc.js | 78 volets, 78 questions, 81 liens d'origine |
| 43/43 niveaux portent ≥ 2 liens https | qc.js (assertion permanente) | 188 liens au total |
| Chaque série à équations propose ≥ 1 **texte original** (DOI, Gallica, CERN) | qc.js | 20 originaux ; astro1 exempté (sources antiques, documenté) |
| Les 6 DOI les plus célèbres pointent le bon article | appariement libellé ↔ identifiant | 0 écart (EPR, Aspect, Hubble, Penzias, Dirac, E=mc²) |
| La note est offerte aux trois moments : leçon, question, rappel | qc.js | présent |
| Le parcours clic → 9 volets → mission → question fonctionne | tools/ui_niveaux.js (faux DOM, app.js réellement chargé) | 0 échec |
| Le tableau de Mendeleïev est affiché (volet V, niveau 2) et aucun nom de fichier ne fuit dans le texte | qc.js | présent |
| La mission surprise tire 50 % scolaire et jamais dans les séries | mesure sur 4000 tirages + assertion sur le code | 49,1 % / 0 série |
| Rémunération majorée : 20/14/40 ◈ + prime 150 ◈, visible avant d'entrer | qc.js | un niveau acquis = 470 ◈ |
| Aucun balisage markdown ni troncature dans les 348 volets | qc.js (plancher 55 car., motifs) | 0 |

Portes au moment de l'audit : **qc.js 13 315 · smoke 380 · ui_niveaux · profils 39 — zéro échec.**

## 2. Ce qui a été jugé (audit contradictoire de la pédagogie)

Un détecteur a accusé 19 niveaux de trahir les règles (symboles non nommés,
volet IX sans nombre). Chaque cas a été **lu** :

- 9 accusations venaient du détecteur (verbes au pluriel non prévus, nombres en
  lettres) ;
- 10 sont des variations **voulues par la conception** : Mendeleïev n'abrège pas
  une moyenne, les quarks s'écrivent en fractions nues, Dirac n'a pas d'ordre de
  grandeur parce que sa chute est la prédiction elle-même, la gravité « se lit
  sans calculer » (règle 3).

Conclusion : la structure récit → équation familière → français → symboles →
prédiction est intacte partout où elle s'applique, et ses écarts sont des choix,
pas des oublis.

## 3. Ce qui reste ouvert — les trous, visibles

| # | Trou | Gravité | Détail honnête |
|---|---|---|---|
| — | **v104 : deux régressions de plus attrapées par playtest, pas par les portes** | — | « Continuer » mort (victime du clic sélectif v100), liens affichés en tas au lieu de suivre leur carte. Les portes correspondantes existent maintenant, mais la leçon vaut d'être écrite : chaque correctif d'écran doit être suivi d'une capture. |
| A17 | **Aucun écran n'a jamais été vu par Claude** | HAUTE | Tout est raisonné, mesuré, simulé en faux DOM — rien n'est constaté visuellement. Les playtests ont attrapé 3 défauts que les portes ne voyaient pas. Une session de captures reste le seul vrai contrôle. |
| A20 | Leurres conscience : 53 % de clés les plus longues | moyenne | Cible < 25 %. Répartition A/B/C/D excellente (20/20/17/21). Reprise à la main. |
| A22 | Leurres astro2-5 : 43 % | moyenne | L'allongement mécanique a été tenté et retiré (mauvais français). Reprise à la main. |
| A21 | 7 explications conscience sont des replis | basse | Première phrase de la carte faute de recouvrement — elles situent sans expliquer. |
| — | Les DOI peuvent mener à des pages payantes | basse | Ils identifient l'article exact ; le texte intégral n'est pas garanti. Les entrées Wikipédia restent le chemin libre. |
| A7/A13/A18 | Valeurs à re-sourcer | basse | h/sodium (quanta1), 1 sur 8000 et 100 000× (matiere2), Solvay 29/17 et la nuit de Bohr (quanta3). Les docs les signalent déjà comme à vérifier. |
| — | Accroches engendrées = 1ʳᵉ phrase tronquée à 120 car. | cosmétique | Visible seulement au carnet. |

## 4. Comment vérifier soi-même

```
node tools/qc.js            # 13 315 assertions, contenu et règles
node tools/smoke.js         # simulation économique
node tools/ui_niveaux.js    # parcours réel clic → question, faux DOM
node tools/profils_test.js  # profils
```

Le registre complet des décisions et de l'historique v80 → v103 est dans
`tools/BACKLOG.md`. Les tables de liens sont dans `tools/liens_series.py`
(main tenue, modifiable sans toucher au moteur).
