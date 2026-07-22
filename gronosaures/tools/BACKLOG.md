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
| v113 | **Bug : la synchronisation ne démarrait jamais sur une partie antérieure.** `nuageTirer()` sortait en silence quand la partie n'était liée à aucune ligne distante — c'est-à-dire pour toutes celles créées avant v111. Rien ne se passait jusqu'au premier enregistrement, pastille au repos et aucune explication. Nouveau `nuageDemarrer()` : si la partie n'est pas liée, on la rattache et on la met à l'abri d'emblée. Signalé par Denis sur captures (v112, pastille inerte). Sondé : rétablir l'ancien comportement → 4 échecs, dont le symptôme exact (`inactif`). |
| v113 | **Le statut n'était visible nulle part** : le diagnostic n'existait que dans un sous-écran atteignable en appuyant sur une pastille dont rien n'indiquait l'usage. Ligne « Sauvegarde en ligne » ajoutée dans le bloc principal des réglages, plus une entrée de liste dédiée qui porte l'état et le détail. |
| v113 | **Textes corrigés** : « Les parties ne vivent que sur cet appareil / Désinstaller l'application les efface définitivement » et « Tout est enregistré sur cet appareil seulement » étaient devenus faux. Ils deviennent conditionnels — et quand la copie en ligne est à jour, le message le dit. |
| v113 | Pastille : même glyphe ☁ dans tous les états, seule la couleur change. La v112 affichait un cercle nu au repos, illisible comme indicateur. Seul l'échec ajoute ⚠, parce qu'il appelle une action. |
| v112 | **Configuration Supabase installée** (projet `broauveyitegsqzdilwo`, clé anon vérifiée : rôle `anon`, projet cohérent avec l'URL, valide jusqu'en 2036). La sauvegarde en ligne est active. |
| v112 | Nom de champ aligné sur l'Écurie de Légendes : `CLOUD.key`. Le code lit `CLOUD.key || CLOUD.cle`, pour qu'un copier-coller depuis l'un ou l'autre projet fonctionne sans avoir à se demander lequel. |
| v112 | **Garde-fou dans `nuage_test.js`** : le harnais substitue désormais les valeurs réelles par expression régulière, et s'ARRÊTE net si la substitution rate. Sans lui, un simple renommage de champ aurait fait frapper le vrai projet Supabase par des parties de test — la porte passait au vert précisément parce que la temporisation de 4 s ne se déclenche pas dans le harnais, donc l'absence d'appel réseau ne prouvait rien. Sondé : substitution cassée → arrêt immédiat. |
| v111 | **Sauvegarde en ligne — client.** `CLOUD.url` / `CLOUD.cle` dans `data.js` (à renseigner : tant qu'ils valent `null`, aucun appel réseau, pastille éteinte, application strictement inchangée). Rattachement paresseux au premier envoi, code **engendré** de 16 caractères sans I/O/0/1 rangé dans le registre local à côté du profil — Louise ne tape ni ne retient rien. Poussée différée de 4 s, une seule en vol à la fois (deux écritures concurrentes se répondraient en dernier arrivé gagne), relance automatique si l'état change pendant l'envoi. |
| v111 | **Pastille de synchronisation** dans le bandeau d'en-tête. Muette par construction — un glyphe, une couleur, un `title` — et cible tactile de 34 px. Six états distincts : éteinte, en cours, à jour, hors ligne, en échec, identifiants refusés. Elle ouvre le diagnostic d'un appui. |
| v111 | **Diagnostic utilisateur** (`ouvrirReglages('nuage')`) : état, dernier échange, réseau, partie liée ou non, nombre d'entrées de carnet, détail de l'erreur, et une phrase qui dit quoi en penser — « Rien n'est perdu : tout est sur l'appareil » en cas d'échec. Bouton « Synchroniser maintenant ». Identifiants de reprise (uuid + code) repliés sous un `<details>`, inutiles au quotidien. |
| v111 | **Hors ligne**, exigence maintenue : l'appareil est la référence, le serveur est un filet. `majLocal` horodate chaque écriture locale et voyage avec l'état — au démarrage, la copie distante ne remplace la locale que si elle est **plus récente**, mais le carnet est **toujours réuni**, jamais choisi. Reprise automatique sur l'événement `online`. |
| v111 | `tools/nuage_test.js` — 32 assertions contre un faux Supabase appliquant la même fusion que `atlas_sauver`, et sachant tomber en panne. Vérifie ce qui compte : aucun appel réseau si non configuré ; note écrite pendant une panne montée au retour du réseau ; hors ligne distingué de l'échec ; identifiants refusés sans perte locale ; **deux appareils** — carnets réunis, entrée retirée qui ne ressuscite pas, pierre tombale qui voyage, songe le plus récent gagnant ; version distante plus ancienne qui n'écrase pas la locale. Éprouvé contre trois régressions (fusion supprimée, tombes non transmises, distant toujours prioritaire). |
| v110 | **Identité stable des entrées de carnet (`eid`)** — prérequis de la sauvegarde en ligne, et bug local en soi. `t` est un `Date.now()` en millisecondes et plusieurs entrées naissent couramment dans la même : mesuré sur une partie jouée, **33 entrées pour 20 horodatages distincts**. `carnetSupprimer(t)` et `carnetEditer(t)` prenaient `t` pour une identité — « Retirer » pouvait donc effacer la voisine. Côté serveur, le plan initial dédoublonnait la fusion sur `t` : la première synchronisation aurait détruit un tiers des notes, exactement ce que `PLAN_CLOUD.md` déclare non négociable. |
| v110 | Six insertions directes contournaient `noterEvenement` (note libre, doute, leçon, pack, question, mission) et auraient produit des entrées sans identité — toutes estampillées. `carnetLiens()` projetait `t` : porte désormais `eid`. Les carnets antérieurs sont migrés dans `normaliser()` de façon **déterministe** (`legacy:<t>`, puis `-1`, `-2`…), donc deux appareils qui normalisent le même carnet hérité aboutissent aux mêmes identifiants — et `legacy:<t>` est exactement le repli qu'applique `atlas_sauver`. |
| v110 | **Pierres tombales** (`etat.carnetTombes`) : une suppression est enterrée, pas effacée. Sans cette trace, une entrée retirée sur un appareil reviendrait de l'autre à la synchronisation. Liste append-only, donc commutative. C'est l'option 2 du plan — le point « à trancher » est tranché. |
| v110 | `songeT` sert désormais d'horodatage de dernière modification pour `carnetEditer` et `carnetResoudre`, pas seulement pour le songe : sans lui, rouvrir un doute sur un appareil serait écrasé par la version plus ancienne de l'autre. |
| v110 | `tools/etats_test.js` section 7 (100 assertions au total) et `tools/fusion_test.js` (10 cas rejouant la logique de `atlas_sauver` en JS : jumeaux conservés, carnets réunis, songe le plus récent gagnant dans les deux ordres, entrée retirée qui ne ressuscite pas, fusion commutative, carnet hérité ni perdu ni dupliqué). Test durci après sonde : viser le **second** jumeau d'une paire, le premier laissant le bug invisible. |
| v110 | **SQL Supabase livré et exécuté** — `tools/CLOUD_SQL.sql`, table `atlas_profils` créée à côté de `comptes`, rien de l'Écurie touché. Trois écarts avec le plan : hachage du code **côté serveur** (sinon l'empreinte transmise devient elle-même le mot de passe et une base volée se rejoue telle quelle) ; `revoke`/`grant` explicites (dans PostgreSQL une fonction est exécutable par PUBLIC par défaut — une fonction `security definer` laissée ainsi contourne la RLS pour n'importe qui) ; aucune fonction d'administration exposée en RPC. Appareil perdu : le code n'est pas récupérable, même par l'administrateur — on le **remplace** par `update … set code_hash = atlas_empreinte('…')`, procédure documentée en fin de fichier. |
| v109 | **Prime de niveau proportionnelle.** Trois niveaux de quanta1 comptent 20 questions au lieu de 6 : les acquérir demandait 40 bonnes réponses autonomes contre 12 ailleurs, pour la même prime de 150 ◈. Invisible tant que l'acquisition était cassée. Décision Denis : la longueur reste, la récompense s'aligne — `primeDe() = 150 × banque / 6`, soit 500 ◈ pour quanta1 et 150 ◈ inchangé partout ailleurs. |
| v109 | **« Inscrire au carnet » était mort sur deux packs.** `esc()` n'échappe que `&<>"`, pas l'apostrophe ASCII : le nom interpolé dans `onclick="songePackNoter('…','Histoire de l'art — Europe')"` cassait l'attribut. Le clic ne faisait rien, silencieusement. Les deux autres chemins vers `ouvrirDoute` étaient déjà protégés ; celui-ci avait été oublié. |
| v109 | **Étiquette Surprise honnête.** L'interface promettait « gains × 1,6 » ; le multiplicateur ne touche que la prime de fin de 12 ◈ — mission parfaite : 72 ◈ ordinaire contre 79 ◈ en Surprise, soit × 1,10 réel. L'économie est inchangée, c'est l'étiquette qui devient exacte : « prime de fin +60 % ». |
| v109 | **Première fouille ratée d'un site neuf : plus d'écran vide.** Le pool de consolation était filtré sur `possede()`, donc vide sur un chantier vierge — 20 ◈ payés pour rien, au pire moment possible, contre la promesse du code lui-même. Le pool s'étend à tout le site quand rien n'est encore possédé ; le rang de découverte est enregistré comme dans `tirage()`. |
| v109 | **Garde sur `suite()`.** Exige `mission.resolue`. Le bouton n'existe à l'écran qu'une fois la question résolue, mais un état atteignable finit par être atteint. `exploit_check.js` réécrit vers le comportement validé : rafale sur Continuer = 0 gain, 0 avancement (l'ancienne version validait explicitement le saut). |
| v109 | `reprendreFouille()` appelé aussi depuis `supprimerProfil()` : la dette du profil entrant est honorée par tous les chemins. |
| v109 | **Isolation de profil enfin couverte** — `etats_test.js` section 5, le trou de couverture P0 #5 signalé à la revue. Mission ouverte sur A qui ne traverse pas vers B, gains qui restent sur le bon profil, fouille payée sur A due à A et reprise au retour. Piège de harnais corrigé : `basculerProfil` réassigne la variable module `etat`, donc toute lecture post-bascule passe par un getter — sans quoi on mesure le fantôme du profil précédent. 67 → 85 assertions. |
| v109 | **README resynchronisé et porte anti-dérive.** Il annonçait 18 sites / 110 créatures / 360 questions pour 30 / 193 / 640, et son tableau de réglages donnait `SEUILS_DOC [0,2,5]` (réel `[0,1,2]`), `BONUS_PART 0,6` (réel 0,84) et des coûts de site 80→320 (réels 100→180) — au point que les ordres de grandeur qui en dérivaient étaient faux d'un facteur deux. Table des 18 sites retirée au profit d'un renvoi à `data.js` comme source unique de vérité ; économie recalculée par simulation (~700 fouilles, ~13 000 ◈ nets, ~180 missions). Nouvelle porte dans `qc.js` : les nombres des sections AU PRÉSENT sont confrontés à `data.js` à chaque exécution. Les journaux de version datés sont laissés intacts — ils décrivent un passé exact. |
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
