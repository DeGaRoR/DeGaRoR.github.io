# Écurie de Légendes — Changelog

Convention : `VERSION_APP` (index.html) = `ecurie-vNN` (sw.js), incrémentés à CHAQUE livraison
(invalidation du cache PWA). QC : `node tools/qc.js` avant chaque livraison.

## v71 — Stats de concours stables
- **Suppression du bruit aléatoire `+rnd(-5,8)`** sur la performance en concours (joueur ET
  adversaires). La stat affichée sur la fiche est désormais exactement celle avec laquelle le cheval
  concourt : un cheval annoncé à 48 fait 48. Fini l'incohérence 48 → 52.
- La variété du peloton reste assurée par les adversaires tirés au hasard (5 cartes de la division,
  paliers 1-5), sans dé caché. Progression lisible : meilleure carte / palier plus haut = meilleur score.
## v70 — Mini-jeux intégrés au flux des défis
- **Pack « Détente » retiré** du menu des défis : plus d'accès explicite aux mini-jeux.
- Les mini-jeux **surgissent automatiquement tous les 5 exercices**, uniquement dans **Général**
  et **Général +1** (constante `JEU_TOUS_LES=5`, compteur `jeuCompteur` remis à zéro à l'entrée du
  pack). Cadence : 5 exercices → 1 jeu → 5 exercices → … Les autres packs (Chevaux, Origines, langues,
  ortho…) restent purement studieux.
- Nettoyage : suppression de la variable morte `CHANCE_JEU` (jamais utilisée).
## v69 — Correctifs playtest
- **BLOQUANT corrigé** : le tutoriel se relançait pour un joueur existant (save sans `tutoVu`),
  redistribuait des cartes déjà possédées et se figeait. `normaliserEtat` infère désormais
  `tutoVu=true` dès qu'il y a de la progression (tirages, aventure, collection>3, bonnes réponses).
  Plus d'onboarding parasite au rechargement.
- **Page tirage refaite** : pile de boutons pleine largeur alignés, super-tirage avec style propre
  (violet, sous-titre « Épique ou mieux garanti », coût ⭐), et soldes 💎/⭐ affichés lisiblement.
- **Quiz chevaux** : les questions « devine le cheval / d'où vient-il » montrent l'illustration NUE
  (plus de nom, rareté ni drapeau du royaume sur la carte) — via `artNu`. Fini les réponses triviales.
- **Vocabulaire concours** aligné sur les raretés : Commune, Rare, Épique, Légendaire, Mythique
  (la division mythique s'appelait « Légendaire » — corrigé).
- Cartes-cadeau du tutoriel remises au bon ratio portrait (plus de format carré).
## v68 — Rééquilibrage, chantier D (gabarit poney/cheval)
- **Attribut `gabarit`** (orthogonal aux familles) : set `PONEYS` de 20 ids (toise < 1,48 m),
  helper `gabaritDe`. Badge 🐴 Poney / 🐎 Cheval affiché sur la fiche.
- **Concours poneys** : transversaux aux familles, une division par rareté où ≥3 poneys existent
  (commune 5, rare 11, épique 4 poneys). Donnent une scène aux petits gabarits, sinon écrasés par
  les grands en concours de famille. Champ `co.gab` + filtre centralisé `poolConcours` ; l'éligibilité
  joueur et les adversaires passent par le gabarit. Vérifié : apparaissent ~11 jours/14 en rotation.
- Note : les poneys existent en commune/rare/épique uniquement (aucun poney légendaire/mythique).
- **Réponse coverage concours** : matrice famille×rareté vérifiée — les 14 familles ET les 5 raretés
  ont chacune ≥1 concours viable (aucun trou). Points minces (1 seule rareté) : mascotte, prés,
  licorne, plantes, robot, band, sombres — exploitables mais rares en rotation.
## v67 — Rééquilibrage, chantier C (stats caractérielles)
- **Affinité renforcée : +18 → +22** sur les 1-2 capacités marquées d'une carte.
- **Faiblesses par famille (−14)** : nouvelle table `FAM_FAIBLESSE`, une capacité contrastant avec
  l'identité de la famille (travail↓vitesse, course↓force, sombres↓beauté, prés↓combat, légende↓agilité,
  élémentaires↓force, sauvages↓beauté, robot↓magie, plantes↓vitesse…). Basée sur la famille primaire ;
  ne s'applique jamais à une affinité de la carte (le talent l'emporte sur la faiblesse).
- Effet : profils lisibles, choix de carte stratégique en concours. Un épique bien monté peut battre
  un mythique **hors de son domaine** (vérifié en simu : épique beauté 93 > mythique Guerre 59).
- **Fiche stats** : repères ▲ point fort / ▼ point faible ajoutés sur les barres. Clamp 1..99 préservé.
- Stats dérivées → aucune migration ; la collection d'Enola se recalcule au chargement.
## v66 — Rééquilibrage, chantier B (remap des familles 19→14)
- **5 familles fusionnées** (50 cartes remappées, dedupe) : historiques→bataille, eau→élémentaires,
  cousins→sauvages, gourmand→prés, beasts→légende. Familles restantes (14) : travail, race,
  mascotte, bataille, légende, élémentaires, sauvages, course, prés, band, licorne, plantes,
  robot, sombres.
- **Matchers d'aventure repointés** vers les cibles de fusion (M_HISTORIQUES→bataille,
  M_EAU→élémentaires, M_COUSINS→sauvages) — les étapes restent complétables (assouplies).
  QC : 5 aventures terminées au pire cas, 0 échec.
- **Concours** : 32 combos viables (famille×rareté, pool≥3), répartis sur des familles plus denses
  (bataille 40 membres / 5 divisions, légende 47 / 4…). Régénérés quotidiennement, aucune casse
  de la save existante.
## v65 — Rééquilibrage, chantier A (tirage & économie)
- **Poids de tirage rééquilibrés** : commune 55 / rare 27 / épique 13 / légendaire 4,5 / mythique 0,5
  (mythique ~1/200 tirages, contre ~1/670 avant).
- **Pity** : épique+ garanti tous les 20 tirages, légendaire+ tous les 100 (compteurs `etat.pity`,
  migration ascendante transparente). S'applique aux tirages ×1 et ×10.
- **Super-tirage** (nouveau) : payé en **renommée** (35 ⭐), garantit un **épique ou mieux**.
  Second débouché pour la renommée à côté du marchand. N'affecte pas le pity.
- **Suppression du plafond journalier** de gains (`crediterDefi` rend le gain plein) — conforme
  « pas de limite par jour ». Le sink crins viendra avec la fusion (chantier E).
- **`cheval_boucle` reclassé** : cheval fantaisie (famille `pres`), plus une race. `curly` (v63)
  reste la vraie race épique.
- Reste à faire (chantiers B→F) : remap familles + matchers, faiblesses/aff, gabarit poney,
  fusion 3→1, célestes + jalons, reclassement pyramide.
## v64
- **Nouvelles CARTES — 10 poneys + 5 « sombres » (15 cartes ; 165 au total).**
- **10 poneys de race, tous RARES** (famille `race` + secondaire) : Welsh (galles), Basotho
  (afrique), Caspian (perse), Connemara (irlande), Eriskay (ecosse), Exmoor & Fell (angleterre),
  Highland (ecosse), Hutsul (ukraine), Mérens (france).
- **5 chevaux « dark » — nouvelle famille `sombres` 💀** (contrepoids aux licornes) : Cheval pâle
  de la Mort & Cheval rouge de la Guerre (mythiques, royaume `outremonde`), Helhest (mythique,
  danemark), Dullahan (légendaire, irlande), Mari Lwyd (légendaire, galles). `sombres` → FAM_CARAC
  `magie`. ⚠️ 3 mythiques dans `sombres` ⇒ un concours mythique `sombres` apparaît (additif, voulu).
- **3 nouveaux royaumes** : galles 🏴, ukraine 🇺🇦, outremonde 🌑 (pour les cavaliers sans patrie).
- **Robes** (poneys uniquement ; dark = pelages spectraux/magiques → aucune robe) : Welsh + Caspian
  *alezan*, Connemara + Eriskay *blanc*, Fell + Mérens *noir*, Highland *isabelle*. Basotho/Exmoor
  (bai, non assignable) et Hutsul (grullo) laissés sans robe.
- ⚠️ Équilibrage : rare 38→48, mythique 20→23, légendaire 20→22. À intégrer au passage global.
  QC : 0 échec. Note : id carte `connemara` distinct de la clé d'étape d'aventure homonyme.
## v63
- **Nouvelles CARTES — extension série `race` (12 cartes ÉPIQUES ; 150 au total).**
- **12 chevaux de race, tous épiques** : Cheval yakoute (russie), Curly (amerique), Falabella
  (argentine), Finnhorse (finlande), Cheval islandais (islande), Kladruber & Lipizzan (autriche),
  Knabstrupper (danemark), Konik (pologne), Mangalarga Marchador (bresil), Nonius (hongrie),
  Trotteur Orlov (russie).
- **8 nouveaux royaumes** : russie 🇷🇺, argentine 🇦🇷, finlande 🇫🇮, islande 🇮🇸, danemark 🇩🇰,
  pologne 🇵🇱, bresil 🇧🇷, hongrie 🇭🇺. Aucune nouvelle famille (tout dans `race` + secondaires
  existantes travail/sauvages/course/historiques).
- **Robes naturelles ajoutées** (renforce les pools faibles) : Knabstrupper *tachetée* (×1→×2),
  Falabella + Mangalarga *pie* (×2→×4), Curly + Finnhorse *alezan*, Nonius *noir*, Kladruber +
  Lipizzan + Orlov *blanc*.
- ⚠️ À arbitrer : `curly` fait doublon conceptuel avec `cheval_boucle` (commune) ; `falabella`
  est un miniature (règle poney→rare) laissé en épique par cohérence de série. Épique 28→40 :
  à intégrer à l'équilibrage global. QC : 0 échec.
## v62
- **Nouvelles CARTES — 3 séries (17 cartes ; 138 au total) + reclassement.**
- **Chevaux nommés mythologiques (famille `legende`) — 8 mythiques** : Xanthos, Balios (Grèce),
  Enbarr (Irlande), Grani (Norvège), Gringolet (Camelot), Kanthaka (Inde), Rakhsh (Perse, nouveau
  royaume), Veillantif (France). Groupés avec les steeds existants (Bucéphale, Bayard, Sleipnir…).
- **Hybrides végétaux (nouvelle famille `plantes`) — 5 rares** : lierre, cactus, chêne, roses,
  nénuphar. `cheval_champignon` rattaché à la famille `plantes`.
- **Robots (nouvelle famille `robot`, royaume `futur`) — 4 rares** : cryo, éclaireur, prototype,
  solaire. `cheval_cyberpunk` rattaché à la famille `robot`.
- **Reclassement : les 6 champions de course passent de mythique à LÉGENDAIRE** (Secrétariat,
  Frankel, Man o''' War, Phar Lap, Seabiscuit, Zenyatta).
- Robes naturelles ajoutées aux steeds (Balios noir, Gringolet/Kanthaka blanc, Veillantif alezan).
  Raretés et stats à revoir globalement. QC : 0 échec.
## v61
- **Nouvelles CARTES — 4 séries (15 cartes + 3 portraits mascottes ; 121 cartes au total).**
- **Légendes de course XXᵉ (famille `course`+`historiques`) — 5 mythiques** (comme Secrétariat) :
  Frankel (Angleterre), Man o''' War, Seabiscuit, Zenyatta (Amérique), Phar Lap (Australie, nouveau royaume).
- **Gourmands (famille `gourmand`) — 5 communes** : mangeurs de pommes, carottes, citrouilles, grain,
  trèfle. Robes naturelles attribuées (alezan ×2, isabelle, pie) → renforcent les pools de robes rares.
- **Licornes à travers les âges (famille `licorne`) — 5 cartes** : antique orientale, apothicaire,
  Pride contemporaine (épiques) ; bestiaire médiéval, héraldique écossaise (légendaires).
- **3 portraits de mascottes manquants fournis** : Big Ben, Inge, Rocío (images seules — cartes déjà
  existantes, aucune carte dupliquée). Il ne manquait plus qu''eux côté mascottes.
- Familles `gourmand` (🍎) et `licorne` (🦄) enregistrées. Équilibrage global à venir (mythique = 18).
  QC : 0 échec.
## v60
- **Nouvelles CARTES — 2 premières séries (15 cartes, 106 au total).**
- **Série « Pop » (famille `band`, royaume Scène) — 10 cartes fictionnelles** : Pink Pop Queen,
  Starfire Diva, Golden Ace, Moon Prince, Crystal Princess (épiques) ; Purple Rebel, Electric Shadow,
  Steel Phantom, Midnight Lead, Pastel Dream (rares).
- **Série « Hybrides » (famille `beasts`) — 5 créatures mythologiques, toutes mythiques** : Qilin,
  Longma (Chine), Alicorne (Avalon), Hippogriffe, Hippalectryon (Grèce).
- Familles `band` (🎸 Pop) et `beasts` (🐲 Hybrides) enregistrées → jouables en Concours. Nouveau
  royaume `scene` (🎤). Équilibrage global à faire ultérieurement. QC : 0 échec.
## v59
- **Ibérie (Espagne & Portugal) + boss Bruxelles : 12 fonds ajoutés** (Séville, Grenade, Tolède,
  Valence, Barcelone, Compostelle, Bilbao, Porto, Sintra, Lisbonne, Madrid + Bruxelles), dans
  `aventure/`. **Les 5 mondes ont désormais TOUS leurs décors** : 55 fonds d'étape + le fond monde
  `fond_belgique` = 56 images en cache offline. Plus aucun repli sombre en Aventure.
## v58
- **Rhin (Allemagne & Pays-Bas) : 11 fonds d'aventure ajoutés** (Cologne, Lorelei, Forêt-Noire,
  Munich, Hambourg, Dülmen, Amsterdam, Kinderdijk, Friesland, Rotterdam + ★ Berlin), dans `aventure/`.
  Cache `sw.js` : 44 fonds mis en cache offline. Reste l'Ibérie (11) + le boss Bruxelles.
## v57
- **Îles Britanniques : 11 fonds d'aventure ajoutés** (Douvres, Stonehenge, Dartmoor, Snowdonia,
  Newmarket, York, Édimbourg, Loch Ness, Shetland, Connemara + ★ Londres), dans `aventure/`. Le monde
  UK/Irlande a désormais tous ses décors. Cache `sw.js` : 33 fonds mis en cache offline.
- **Icône maskable** alignée sur `icon-512.png` (suppression de la bordure noire ; `icon-maskable-512.png`
  est maintenant une copie exacte de `icon-512.png`).
## v56
- **Fonds d'aventure : dossier dédié + France complète.** Les 55 fonds d'étape (tous pays) migrés de
  `cartes/` vers un dossier séparé **`aventure/`** ; fonds d'écran (Écurie, Tirage…) inchangés dans
  `cartes/`. **11 illustrations France ajoutées** (Lille, Rouen, Mont-Saint-Michel, Brocéliande, Dune
  du Pilat, Pau, Camargue, Chamonix, Lyon, Strasbourg, Paris) — `fond_paris.jpg` remplacé par une
  version haute résolution raccord au lot. Cache `sw.js` complété : les 22 fonds réellement présents
  (10 étapes belges + monde + 11 France) sont désormais mis en cache offline. QC : 0 échec.
## v55
- **Prise en main (onboarding) revue.** Écurie **filtrée sur « Possédés » par défaut** (fini l écran
  vide). **Tutoriel de bienvenue** guidé par Pieter-Jan : cadeau de 3 cartes offert (1er tirage mis
  en scène) + explication de la boucle (Défis 💎 -> Tirage -> Aventure), lancé une seule fois par
  profil, puis atterrissage direct sur l Aventure. **Dévoilement progressif** : l onglet Concours
  reste masqué tant qu on n a pas tiré ou fini une étape. **Hooks de fonds d écran** pour Écurie,
  Tirage, Défis, Concours, Scores (repli sombre gracieux tant que l image n est pas fournie).
## v54
- **Monde 5 : Espagne & Portugal — complet !** Carte SVG de la péninsule ibérique (2 pays, marqueur
  2 drapeaux, les Pyrénées en clin d oeil à Pau), débloqué séquentiellement après l Allemagne & les
  Pays-Bas. Mascotte **Rocío l Andalouse** (perle du sud, intro race/faits/lien + payoff cousinage :
  Andalou -> Lusitanien -> mustangs d Amérique). Critères neufs **M_BEAUTE** (flamenco) & **M_ARABE**
  (chevaux mauresques). Cartes légendaire **Rocío** (91 cartes ; andalou/lusitanien déjà présents).
- 11 étapes : Séville (compás flamenco), Grenade (Al-Andalus), Tolède (3 cultures), Valence (oranges/
  climat), Barcelone (mosaïque Gaudí), Compostelle (le Camino), Bilbao (le basque, Pottok), Porto
  (portugais, Douro), Sintra (palais de conte de fées), Lisbonne (Grandes Découvertes) + ★ Madrid
  (carte 2 pays, explorateurs, Rocío légendaire). Espagnol + portugais. QC 5 pays : 0 échec (55 étapes).
## v53
- **Allemagne & Pays-Bas — étapes 2 à 10** (Lorelei, Forêt-Noire, Munich, Hambourg, Dülmen,
  Amsterdam, Kinderdijk, Friesland, Rotterdam), 7 sous-étapes chacune. Nouveautés : **équipe de 5**
  (le char de l Oktoberfest à Munich), critère **robe DORÉE** (Forêt-Noire). Contenu éducatif :
  le voyage du Rhin (source→mer→delta), les contes de Grimm, **sous le niveau de la mer** + les
  moulins qui pompent (polders), le **néerlandais** (goedendag, dank je), Klaus le poney sauvage
  Dülmener, la Frise natale d Inge, le Mur de Berlin. QC 4 pays : 0 échec, 0 avertissement (44 étapes).

## v52
- **Monde 4 : Allemagne & Pays-Bas — fondations.** Carte SVG (Allemagne + Pays-Bas, marqueur à 2
  drapeaux, labels des 2 pays + « le Rhin »), débloqué séquentiellement quand les Îles sont finies.
  Mascotte **Inge la Frisonne** (perle noire, intro race/faits/lien + payoff cousinage avec Big Ben
  et Pieter-Jan). Critère **M_DORE** (robe alezan/isabelle). Carte légendaire **Inge** (90 cartes).
- **Étape 1 Cologne** (cathédrale, le voyage du Rhin source→mer, trait rhénan, allemand) + **★ Boss
  Berlin** (capitale, carte des 2 pays, frise du Mur, Inge légendaire garantie). QC 4 pays : 0 échec.
- Étapes Rhin 2-10 : à venir.

## v51
- **Monde 3 : les Îles Britanniques — complet !** Carte SVG (Grande-Bretagne + Irlande) + marqueur
  R.-U. (débloqué quand la France est finie). Mascotte **Big Ben le Shire** (intro race/faits/lien,
  + cousinage avec Pieter-Jan via la Flandre). 11 étapes : Douvres, Stonehenge, Dartmoor, Snowdonia,
  Newmarket, York, Édimbourg, Loch Ness, Shetland, Connemara + ★ Londres (boss, carte des 4 nations,
  Big Ben légendaire garanti).
- Nouveautés moteur : mini-jeu **course** (Newmarket), critères **M_NOIR** (Dartmoor), **M_PIE**
  (Connemara), contrainte **royaumeUnique** (le clan d'Édimbourg). Anglais spiralaire + gallois/
  gaélique. QC : 0 échec, 0 avertissement sur les 33 étapes (3 pays).
- Cartes : **Big Ben** (légendaire, 89 cartes). Images de fond Îles + François/France : à générer.

## v50
- **Intro-mascotte éducative** (3 écrans : race → faits marquants → lien historique au pays),
  déclenchée à la 1ʳᵉ entrée dans un pays. Appliquée rétro-activement à Pieter-Jan (trait belge/
  Brabançon) et François (cheval de Camargue). État mascVue par pays.

## v49
- **France — étapes 2 à 10** (Rouen, Mont-Saint-Michel, Brocéliande, Dune du Pilat, Pau, Camargue,
  Chamonix, Lyon, Strasbourg), 7 sous-étapes chacune, sur le moule enrichi : objectifs P5/P6
  (Seine/Monet, marées, légendes, érosion, étagement du relief, delta/flamants, altitude/
  température, suites logiques, langues+UE) et équipes originales (prés-doux, équipe LÉGÈRE
  puissanceMax, légende/magie, cousins, cordée de 4, manade tout-blanc, élémentaires, historiques,
  royaumes distincts). Contraintes moteur puissanceMax + royaumesDistincts. Matcher M_HISTORIQUES
  (oubli attrapé par le QC). QC multi-pays : 0 échec sur les 22 étapes.

## v48
- **Monde 2 : la France — fondations.** Architecture multi-pays (MONDES / ETAP_ALL / avMonde / MC,
  gating & pins scopés par pays). Carte SVG de France (hexagone + 10 pins géo + drapeau Paris) +
  marqueur France sur la carte-monde (débloqué quand la Belgique est finie). Mascotte **François
  de Camargue** (guide). Nouveaux critères : M_BLANC, M_PRES, M_LEGENDE, M_ELEM.
- **Étape 1 Lille** (braderie, boussole/orientation, portefaix) + **★ Boss Paris** (carte de France,
  gala M_RARE, défilé 14 juillet, François légendaire garanti). QC multi-pays : 0 échec.
- Étapes France 2-10 : à venir (pins verrouillés en attendant).

## v47
- Carte mascotte **François de Camargue** (légendaire, robe blanche, familles mascotte/sauvages/
  legende, royaume france) ajoutée au roster (88 cartes). Image stockée aussi en fond_paris.jpg
  (base France). Aucune autre implémentation France (design en attente de validation).

## v46
- **10 images de villes** (Pieter-Jan dans chaque chef-lieu) intégrées en fond d'étape (dimmed) +
  **écran de révélation** à la première entrée dans une région : la ville en grand + une explication
  du monument (Bueren, Citadelle, Gravensteen, Hôtel de Ville de Louvain, beffrois…). État vu par
  province. Images optimisées JPG 820px (~2,6 Mo au total).

## v45
- **Exercices graphiques & schémas dans tous les packs** : +22 questions (lecture de graphiques en
  barres et diagrammes à symboles) réparties dans BANK_FR, HIST, SCI, GEO, MATHS, GEEK, ANGLAIS,
  NEERLANDAIS, ART — alignées P5/P6. Total 250 questions, 25 visuelles, 0 doublon.

## v44
- **Fix majeur** (détecté par le nouveau harnais QC) : `key` manquant sur les étapes
  Anvers/Gand/Bruges → les pins 1-3 lançaient tous Anvers et le déblocage de Bruges était cassé.
- Dédoublonnage de `melange()` (une définition mutante écrasait la version par copie).
- Méthode « nouveau pays » documentée en tête du bloc aventure + validateur runtime `validerEtapes()`
  (console.warn : champs requis, clés cohérentes, ids de cartes/achats existants).
- Nouveau harnais de QC `tools/qc.js` : faisabilité de toute l'aventure au pire cas (palier 1,
  zéro tirage), seuils/cibles atteignables, robes distinctes, types d'activités, balance
  gains/achats. Résultat : 0 échec, 0 avertissement.
- CHANGELOG.md introduit.

## v43
- Étape 10 Arlon (chaîne alimentaire, chevaliers M_BATAILLE) ; ★ Boss Bruxelles (type `carte` :
  10 chefs-lieux↔provinces, grand rappel, défi de gala M_RARE, final, Pieter-Jan légendaire garanti).
- **Fix critique** : `avMajPins` était resté câblé en dur (anvers/gand/bruges) — provinces 4-10
  définitivement verrouillées. Remplacé par le gating data-driven + drapeau boss cliquable.
- `avBonus` : carte précise (`carteId`) ; en-tête « ★ Grand Boss ».

## v42
- Étape 8 Namur (cycle de l'eau en `ordre`, mariniers M_EAU, graphique des pluies).
- Étape 9 Liège **deluxe** (principauté 800 ans, Montagne de Bueren, type `circuit` « rallumer la
  Cité Ardente », forge M_ENDURANCE, Tchantchès, récompenses doublées, bonus rare/épique, gaufre 🧇).
- Moteur : type `circuit` ; `avBonus` accepte un filtre de rareté.

## v41
- Étapes 6 Wavre (ligne du temps `ordre`, messagers M_VITESSE) et 7 Mons (cortège `robesDistinctes`,
  orthographe en aventure, saint Georges).
- Achats multi-options (`buy` = tableau) ; critère robes distinctes ; M_ROBE.

## v40
- Capacité **graphiques & schémas dans les Défis** (`graphHTML`/`visuelQ`, champs `graph`/`schema`
  sur toute question de banque) + 3 questions de démonstration.

## v39
- Moteur enrichi : types `graphique`, `ordre`, `ortho` ; critères M_VITESSE/M_ENDURANCE/M_BATAILLE/
  M_RARE/M_RACE/M_COUSINS ; étape 5 Louvain (ouverture-histoire, graphique du labo, équipe de
  savants, néerlandais + anglais, états de la matière).

## v38
- Bannière d'ENJEU permanente (« X a besoin de toi pour… ») + carte d'identité chef-lieu↔province
  sur chaque écran d'étape ; rétro-appliqué aux étapes 1-4.

## v37
- +8 questions sciences forêt ; pack 🇳🇱 Néerlandais (22 mots) ; néerlandais + forêt dans l'étape 4.

## v36
- Étape 4 Hasselt/Limbourg (Campine M_SAUVAGE, chevaux de mine, rares dans les cadeaux).
- Streamlining : ajout d'une province = objet ETAPE + entrée ETAPES (pins + gating data-driven).

## v35
- Étape 3 Bruges (Zwin, Bourse, cygnes, M_EAU) ; **achat dans l'histoire** (boutique quand une
  compo manque de chevaux, PRIX_ACHAT par rareté) ; retrofit des achats sur Anvers/Gand.

## v34
- Étape 2 Gand ; architecture multi-provinces (état par province, rappels inter-étapes agrégés,
  migration de l'ancien état) ; hooks images de fond (`fond:`) ; softcaps relâchés (600/1400,
  ×0.65/×0.4).

## v33
- Rééquilibrage économique : tirage 70→120, gains défis 10/45→6/20, multiplicateurs modérés,
  légendaire 4→2.5 %, mythique 0.4→0.15 %, plafond quotidien (crediterDefi), complétion de pack
  180+30N ; fix déclaration `crinsGain` ; ajustements aventure v32 (nomenclature, icône, rappels
  data-driven).

## ≤ v32
- Voir l'historique de conversation (Supabase famille+PIN, classement mondial, chouchous, packs de
  défis avec maîtrise/complétion, théorie, orthographe, concours, marchand, évolution, aventure
  Anvers, intro cinématique, cartes SVG monde/Belgique…).
