# Registre — ce qui a été demandé et pas encore fait

Tenu pendant le playtest. **Rien n'est retiré de cette liste sans décision
explicite.** Une entrée traitée passe en « Fait », datée de sa version, plutôt
que de disparaître : c'est ce qui permet de vérifier après coup qu'une demande
n'a pas été perdue en route.

Trois annonces de correctif se sont révélées fausses au cours de cette session —
patches échoués au milieu d'un script, décrits comme faits. Ce registre existe
pour que ça ne se rejoue pas silencieusement.

---

## En attente

### Contenu

| # | Demande | Origine | Notes |
|---|---|---|---|
| C2b | **Poursuivre la relecture des banques de français** | mesure v85 | Trois énoncés fautifs corrigés en v85 sur les 40 d'orthographe. Restent conjugaison et lecture, non relus. |
| C3 | Monter le niveau des packs orthographe et conjugaison | Denis | Gardé pour plus tard. Dépend de C2b : corriger avant d'ajouter. |

### Interface

| # | Demande | Origine | Notes |
|---|---|---|---|
| I3 | Capture de songe accessible depuis n'importe quel écran | Claude, v70 | Elle peut avoir une idée pendant une fouille et l'oublier avant d'arriver au carnet. |

### Séries à niveaux

| # | Demande | Origine | Notes |
|---|---|---|---|
| A20 | **Rééquilibrer les leurres de la série conscience** | mesure v95 | 53 % des clés sont la proposition la plus longue, cible sous 25 %. La répartition A/B/C/D est en revanche excellente : 20/20/17/21. Étoffer les leurres, jamais raccourcir les clés. |
| A21 | **Reprendre sept explications de la série conscience** | mesure v95 | Les 78 explications sont extraites des cartes sourcées, jamais rédigées à neuf. Sept sont des replis — première phrase de la carte, faute de recouvrement suffisant avec la réponse — et n'expliquent donc pas vraiment. |
| A22 | **Rééquilibrer les leurres des packs astrophysiques 2 à 5** | mesure v96 | 43 % des clés sont la proposition la plus longue, cible sous 25 %. Un allongement mécanique a été tenté puis retiré : il produisait du mauvais français (« il observe la pomme tomber plusieurs fois dans tous les cas »). Demande une reprise à la main, comme pour les autres packs. |
| A17 | **Vérification visuelle des séries** | Claude, v89-97 | Écran de série, liste des niveaux, déroulé des volets, prime de 80 ◈, marque d'acquisition. Tout est raisonné et mesuré, rien n'est vu. |
| A18 | Vérifier deux points du pack quantique 3 | Claude, v90 | Participants et futurs lauréats à Solvay 1927 (29 et 17). La nuit blanche de Bohr, rapportée par Rosenfeld. |
| A7 | Vérifier les valeurs numériques du pack quantique 1 | Claude, v86 | `h`, travail d'extraction du sodium, 1,89 eV et 656 nm, durée de vie classique de l'atome. |
| A13 | Vérifier deux valeurs du pack particules B | Claude, v88 | « Une sur huit mille » et le rapport « cent mille fois ». |
| A12 | Déplacer le centre de gravité vers l'introduction | Denis | Petites vérifications glissées dans le déroulé plutôt qu'un bloc de questions à la fin. À ne pas précipiter. |

### Mécanique

| # | Demande | Origine | Notes |
|---|---|---|---|
| M1 | Cours difficiles, accès explicite jamais imposé (S7) | Louise | Elle l'a demandé en reconnaissant que ça pourrait la dégoûter. La récompense ne doit pas rendre le reste terne par comparaison. |
| M2 | Boucle du doute (S5) | Claude | Un rappel discret quand des doutes s'accumulent, pour qu'ils reviennent sans qu'elle y pense. |
| M3 | Champ `diff` inutilisé sur les 500 questions d'origine | v71 | Métadonnée écrite à la main, lue nulle part. À exploiter ou à retirer partout — décision à prendre. |
| M4 | Le carnet garde une trace par question, pas les retours | v67 | Cohérent avec « où je suis allée » plutôt que « combien de fois ». Une ligne à changer si l'on préfère l'inverse. |

---

## Fait

| Version | Demande |
|---|---|
| v108 | **P0 — une fouille payée pouvait disparaître.** Le crédit partait à l'ouverture de la tranchée, le résultat n'arrivait qu'après la question, et rien n'était écrit entre les deux : un rechargement ou une mise en veille du téléphone faisait perdre les crédits sans rien livrer. La fouille est maintenant une transaction (`etat.fouilleEnCours`) écrite dans le même `sauver()` que le débit et effacée dans le même `sauver()` que la récompense. `reprendreFouille()` rouvre la tranchée au démarrage, à l'entrée dans un profil et au changement de profil ; si la question n'existe plus, remboursement. |
| v108 | **Exploit trouvé au passage** : `tirage()` n'était pas idempotent — un double-tap sur « Extraire la pièce » livrait deux créatures pour une seule fouille (vérifié au harnais : 1 → 3 pièces sans le verrou). Même faille sur « Refermer la tranchée ». La transaction ne se consomme qu'une fois. |
| v108 | Ordre des propositions, marques et écarts d'indice de la tranchée persistés : une fouille reprise réapparaît exactement telle qu'on l'avait laissée, boutons écartés compris. |
| v108 | `tools/etats_test.js` à 67 assertions. Rechargement réel (même `localStorage`, application ré-évaluée) après paiement, après bonne réponse, avant extraction. Éprouvé contre deux régressions : sans verrou d'idempotence (1 échec), sans persistance (13 échecs). Harnais durci pour rapporter les échecs au lieu de planter. |
| v107 | **P0 — soft-lock de mission au retour dans la Bourse.** `montrer('bourse')` appelait `exoSuivant()` : avant réponse la question était remplacée et les essais remis à zéro (reroll gratuit en changeant d'onglet — et une note prise au Carnet coûtait la question) ; après résolution une question neuve était servie alors que `mission.resolue` restait vrai, propositions inertes et plus de bouton Continuer. La navigation passe par `reprendreExo()`, qui ne tire jamais de question. |
| v107 | **Un seul chemin de rendu de la question.** L'état d'interaction (`mission.marques`, `mission.juste`, `mission.aide`, `mission.essais`) vit dans la mission ; `rendreExo()` le reconstruit intégralement, `rendreFeedback()` produit indice, essai raté et correction. Deux implémentations concurrentes de ce correctif coexistaient dans l'arbre de travail — consolidées, assertion `qc.js` pour que la seconde ne revienne pas. |
| v107 | `tools/etats_test.js` porté à 41 assertions : interruption avant réponse, après un raté, après résolution, après indice. Vérifié contre la régression (rétablir `exoSuivant()` dans `montrer` → 10 échecs). |
| v106 | **P0 — un niveau ne pouvait pas être acquis.** `repondre()` n'écrit la maîtrise que si la question porte une `cle` ; les fiches de niveau n'en portaient pas, et `niveauAcquis()` lisait `c[q.n]`, que personne n'écrivait. Dix passages parfaits laissaient le niveau inachevé et la prime de 150 ◈ inaccessible. `exoDeNiveau()` normalise désormais toute fiche de niveau : clé préfixée par le rang du niveau, propositions construites depuis `autres`. Signalé par la revue de code indépendante. |
| v106 | **P0 — les QCM des séries se comportaient en saisie libre.** Le chemin des niveaux contournait la construction de `choix` : `rendreExo()` ne trouvait rien et affichait un champ texte. Il fallait retaper au caractère près des réponses conceptuelles longues. Même correctif. |
| v106 | **Porte de machine à états créée** — `tools/etats_test.js`. Joue réellement un niveau jusqu'à l'acquisition, mesure la prime par différence sur trois passages, vérifie l'étanchéité entre niveaux. Éprouvée contre le bug d'origine (3 échecs) et contre le correctif naïf `cle: q.n` (5 échecs, 214 collisions sur 300 clés). |
| v84 | Chantier non défilant : six grandes vignettes coupées, deux cartes et deux moitiés visibles |
| v84 | Tranchée défilante : bande de rappel, énoncé et propositions dépassaient l'écran |
| v83 | Registre des demandes créé |
| v105 | **Exploit rejoué et réfuté** (tools/exploit_check.js, permanent) : Valider martelé = un gain. Crash double-tap Continuer corrigé. Diagnostic probable côté Louise : build périmée (bloc version du menu). Décision ouverte : prime de mission même à 6 échecs. tools/HANDOVER.md écrit. |
| v104 | **Playtest 3** : « Continuer » tué par le clic sélectif v100 (bouton sans gestionnaire propre) — câblé, harnais exige un gestionnaire par bouton. Liens conscience rattachés à LEUR carte (champ v), sources de niveau au dernier volet ; fini le tas. |
| v103 | **Audit final avant déploiement** : intégrité md↔livré prouvée (0 écart), 6 DOI appariés, pédagogie jugée cas par cas (10 variations voulues, 0 trahison), tools/AUDIT_SERIES.md publie garanties ET trous. |
| v102 | **Retour à la conception** : 20 textes originaux en lien direct (DOI, Gallica, CERN) tirés des sections Sources des docs ; le SVG de Mendeleïev enfin affiché au volet V (imgVolets), la note de fichier retirée du texte lisible. Verrous : un original par série, aucune fuite de nom de fichier. |
| v101 | **Liens partout** : 87 liens ajoutés aux 30 niveaux qui n'en avaient aucun (table tools/liens_series.py), 168 liens au total sur 43/43 niveaux. Note pendant les questions. Porte : >=2 liens https par niveau, note aux trois moments. |
| v100 | **Playtest 2** : les liens n'étaient pas copiés au registre ; le clic global de l'écran avalait la croix, la note et les liens. Clic et balayage sélectifs, verrouillés au harnais. |
| v99 | **Playtest** : aucune question ne se posait (mission de niveau mal formée). Sortie de leçon, sources cliquables, prise de note, bouton précédent désactivé au lieu de masqué. Harnais étendu au parcours complet. |
| v98 | Mission surprise : 50 % scolaire, séries explicitement exclues. Barème de série (20/14/40) et prime portée à 150 ◈. |
| v97 | **Bug corrigé** : cliquer un niveau ne faisait rien (zone morte temporelle sur `SUJETS_INTRO`). Séries repliables. Harnais `tools/ui_niveaux.js` ajouté. |
| v96 | Série astrophysique achevée : packs 2 à 5 écrits et intégrés, 108 volets, 72 questions |
| v95 | Série conscience intégrée : 13 niveaux, 78 volets, 78 questions, 81 liens sourcés |
| v94 | **Six séries intégrées et validées** : 18 niveaux, 162 volets, 150 questions. Troncature des volets d'équation trouvée et corrigée. |
| v91 | Pack astrophysique 1 « Lire une équation » écrit et intégré : 27 volets, 18 questions |
| v90 | Série quantique écrite et intégrée : 3 packs, 9 niveaux, 81 volets, 96 questions |
| v89 | Série particules intégrée : introduction généralisée aux packs, niveaux, prime de 80 ◈ |
| v88 | Pack particules B : 27 volets, 18 questions à 0 % de clé la plus longue |
| v87 | Pack particules A : 27 volets, 18 questions à 6 % de clé la plus longue, tableau de Mendeleïev en SVG |
| v86 | Pack quantique 1 : 60 questions reprises, clé la plus longue de 65 % à 10 % |
| v85 | C1 — outil de couverture des questions, 640 mesurées, 93 cas isolés |
| v85 | C2 — trois énoncés fautifs corrigés dans le pack orthographe |
| v85 | C4 — extracteur de chaînes, 407 caractères coupés sur les sept plus longues |
| v82 | Exploit du bouton « Valider » : une bonne réponse pouvait être encaissée en boucle |
| v82 | Correction automatique désactivée sur les dictées |
| v82 | Consulter la fiche d'une créature déterrée ne bascule plus sur l'onglet Collection |
| v81 | Mission perdue quand on part écrire au carnet |
| v81 | Indice de fouille substantiel, avec caviardage de la réponse |
| v81 | Compteur « 7 / 20 » explicité |
| v81 | Créatures visibles pendant une question de fouille |
| v80 | Deux achèvements distingués : créatures rencontrées, dossiers complets |
| v79 | Niveaux documentaires à une copie par palier |
| v78 | Légende de vignette calibrée sur le mot le plus long, voile allégé |
| v77 | Nom sur deux lignes, genre et épithète |
| v76 | Inspecteur fermé pour une créature non trouvée ; chantiers plafonnés à 180 |
| v75 | Exercices groupés par mission ; vue Liens rétablie |
| v74 | Filtres du carnet retirés ; fin de mission dégraissée ; cartes non obtenues en noir et blanc |
| v73 | Grille adaptative du chantier ; entrées repliées ; note depuis le rappel théorique |
| v72 | Exercices de la Bourse enregistrés au carnet ; carnet rempli vers le bas |
