# AI ROBOCLASH — PWA

## Lancer en local
Le service worker exige http(s). Ouvrir index.html en `file://` fonctionne
depuis la v8 mais en MODE DÉGRADÉ : teinte des châssis simplifiée (multiply
plein au lieu de la séparation peinture/métal), pas de hors-ligne. Pour le
rendu complet et le SW :

    cd pwa
    python3 -m http.server 8080     # ou : npx serve .

puis http://localhost:8080. Sur GitHub Pages : pousser le contenu du dossier tel quel.

## Structure
- `index.html`  markup + enregistrement SW (gardé : http seulement)
- `roboclash-ui.css`  **feuille principale** (design system, tokens `--rc-*`)
- `styles.css`  résidu legacy remappé sur les tokens `--rc-*`
- `data.js`     données pures : i18n (STRINGS), sprites base64, taxonomie (TIERS)
- `engine.js`   moteur pur, déterministe, sans DOM — marqueurs ENGINE-START/END
- `app.js`      état, éditeur, tournois, rendu, UI
- `assets/`     sprites webp (104 fichiers) — la refonte graphique = remplacer ces fichiers
- `sw.js`       hors-ligne (precache + cache-first, TOUS les assets précachés)
- `manifest.webmanifest`, `icon.svg`

## Règles
1. **`pwa/` est la source de vérité.** Le monolithe ai-roboclash-s4.html est archivé, ne plus l'éditer.
2. À chaque livraison : bosser `CACHE = "roboclash-vN"` dans sw.js (invalide l'ancien cache).
3. Ordre de chargement intangible : data → engine → app.
4. engine.js ne référence jamais data.js ni app.js (vérifié par la porte).
5. Sauvegardes versionnées : toute bosse de `SAVE_V` s'accompagne d'une migration
   (`migrate`, chaîne v4→v5→v6) + une sauvegarde de secours de l'état brut ; une
   version inconnue déclenche un reset EXPLICITE (`SAVE_RESET_NOTICE`), jamais silencieux.

## Invariants d'échelle et de rendu (S16-S19)
- **1 cellule = 3 cm = 6,2 unités monde**, partout, sans exception.
- `CLASS_RING` (data.js) : diamètre RÉEL du plateau par classe — S 60 cm
  (desk), M/L/XXL 145 cm. Clés alignées sur le vocabulaire de `classBands`.
- `ARENA_GEOM` (data.js) : par sprite d'arène, `playEdge` = fraction du cadre
  où se trouve le bord du plateau, et `square` pour les images opaques
  (dessinées carrées, sans découpe circulaire).
- `BOT_FRAME` (app.js) : demi-cadrage COMMUN à l'éditeur, aux vignettes et au
  pointage tactile — c'est l'inverse exact du dessin, ne jamais dupliquer.
- `buildOfBot` / `layoutOfBot` : seule façon d'assembler un build pour une vue.
- `mkImg` : SEUL constructeur d'image (registre `IMG_REG`, états
  pending/ready/failed, sheen de chargement, journal sur échec).
- `dataName(v)` : seule lecture d'un nom de donnée — accepte `"chaîne"` (noms
  propres) ou `{fr,en}` (libellés traduisibles).
- **P-PILOTE : le pilote appartient au bot.** Les sept réglages de conduite
  (`ENGINE.OPTS`) vivent dans `bot.pilot`, jamais dans un global. `PILOT()` est
  le SEUL accès en lecture/écriture ; `S.settings` n'existe plus. Les clés sont
  DÉRIVÉES d'`ENGINE.OPTS` (`PILOT_KEYS`), jamais listées en dur, et
  `validPilot()` rabat toute valeur inconnue sur le défaut au boot.
- **S20-SCRUTIN : le build homologué est celui qui entre en piste.** `curConcoursId()`
  est la SEULE source de « quelle épreuve se dispute » (le gel se lisait sur
  `MODE_CONCOURS`, qui ne connaît que cupM/lightM). Une épreuve `noEngage`
  (échelle, libre) passe `checkEntry` au moment de disputer, pas jamais.
- **S20-GAMME : la teinte de tuile suit `part.gamme`, pas la position** dans
  `ENGINE.PARTS`. Toute pièce ajoutée déclare sa gamme — sans quoi une
  micro-pièce en fin de liste s'afficherait « haut de gamme ».
- **S21-COLLIDER : une mise en page échouée (`__nofit`) ne produit que la COQUE.**
  Longerons, blindage et propulsion sont neutralisés — ce qu'on n'a pas su placer
  ne dépasse pas. Sans cette garde la roue miroir partait hors grille et la
  hitbox atteignait 5× le rayon de coque.
- **S22-ÉQUITÉ : aucun avantage de CÔTÉ.** Le joueur est toujours le bot 0 :
  toute asymétrie indexée sur `bot.id` est un handicap permanent. Trois causes
  corrigées — décision et intégration entrelacées (le bot 1 lisait l'état que
  le bot 0 venait d'écrire dans le même tick), phases de visée et de cadence
  en `bot.id*k`, flux d'aléa partagé où le bot 0 tirait toujours en premier.
  Le `tick` fait désormais DEUX PASSES : tout le monde décide sur le même état,
  puis tout le monde intègre. Phases et flux sont TIRÉS par bot.
  Ne jamais réintroduire une quantité dérivée de `bot.id` : la porte le mesure
  au miroir (S22), le banc l'affiche sur chaque ligne.
- **CALIBRAGE : `ENGINE.BENCHMARKS`** — étalons ENTIÈREMENT figés (châssis,
  pièces, pilote), zéro rng. Une épreuve devient un étalon en écrivant
  `benchmark:"M3"` dans son entrée `TOURNAMENTS` : zéro code. **Une coque
  DIFFÉRENTE par barreau** (décision 26/07) : l'échelle monte par le matériel
  et le pilote, la coque donne le caractère — vérifié par la porte. La ligue
  `calibrage` a `purseMult:0` et n'alimente pas le palmarès — elle MESURE.
  Ne jamais retoucher un étalon sans mesurer : ça invalide tout l'historique.
- **P-FICHE : une « fiche » est un bot portable** (châssis, défs de pièces,
  multiplicités, pilote, placement, livrée ; aucun uid d'instance). `exportBot()`
  / `importBot()`, échangeable entre carrières et lisible par le banc
  (`node tools/bench.js duel --ficheA <fiche>`). Le placement voyage AVEC :
  sans lui, ce n'est pas le même bot (CG, colliders, longerons).
- **P-CRESUS** : une carrière nommée « cresus » (casse et accents indifférents)
  démarre à 999 999 € — outil de test, pas easter egg.
- **S23-PLAÇABLE : tout adversaire passe par `genOpponentFit()`**, jamais par
  `ENGINE.genOpponent` en direct. Le moteur ignore les empreintes (il ne
  référence pas app.js) : c'est l'app qui DÉGRADE le build, dans l'ordre
  déclaré par `DEGRADE`, jusqu'à ce qu'il loge. On dégrade, on ne re-tire
  jamais (le tirage doit rester reproductible par graine), et on ne remonte
  jamais une pièce en gamme. CPU et capteurs sont dégradés en DERNIER : ce
  sont eux qui portent le pilote.
- **Plafond classe S = 1,42 kg** (26/07), en données dans les trois épreuves S.
  À 1,36 le trio moteur+batterie+roues pesait 1,360 PILE : le moindre CPU
  faisait sauter la pesée. C'est le RÈGLEMENT qui a bougé, pas les pièces.
- **S24-MATIÈRE : la coque a une propriété mécanique en plus de sa masse.**
  `ENGINE.MATIERES` (acier · recup · plastik · polypro · circuit) donne `hull`
  = ténacité, facteur sur l'intégrité structurelle ET sur l'usure de coque.
  Un châssis déclare `mat:"plastik"` ; sans mention, acier (1,00) = comportement
  historique. `densite` ne sert PAS au runtime : c'est le facteur d'autorat de
  la masse (hull_masses.json), la masse restant STOCKÉE et mesurée.
- **S24-MICRO : la gamme qui rentre en classe S.** Une coque S fait ~9 cellules
  et n'héberge qu'UN bloc 2×2 : m1/m2 (2×2), m3/m4 (3×2, 3×3), r1/r2, pr1 (1×4)
  n'y ont jamais leur place. La gamme micro est en 1×1, 1×2 et 1×3 —
  `m5 m6` (moteurs) et `r3 r4` (srimech) suivent la règle **plus légère, plus
  chère, légèrement moins performante** que leur équivalent M, vérifiée par la
  porte.
- **S24-ROUES : le train roulant S est une échelle de GRIP et de FORMAT**, pas
  une miniaturisation — six entrées, deux roues par design (une empreinte,
  miroir L/R) : `pr4` 1×1 base · `pr5` 1×1 grip+protection · `pr6 pr7 pr8` 1×2
  à grip croissant · `pr9` 2×1 large blindée. `guard` = protection : les chocs
  reçus PAR la roue transmettent (1 − guard) de leur énergie à l'intégrité.
  C'est le crochet que le chantier armes reprendra pour le blindage latéral.
  Attention à l'intuition : la poussée est plafonnée par l'adhérence
  (min(force moteur, μ·m·g)), donc un petit rayon ne gagne rien en poussée et
  perd en vitesse — c'est μ qui porte l'échelle.
- Le règlement d'un concours en classe S pose `opts.micro` : `genOpponent` tire
  alors dans la gamme micro. Le moteur n'apprend rien des empreintes — il lit
  un drapeau. `repairFit` (app) substitue l'équivalent micro AVANT de dégrader,
  et sacrifie le support (refroidisseur, blindage, lest, batterie) avant la
  motricité.
- **S25-ÉTOILES : le palmarès est la clé du contenu.** Barème unique — 1re ★★★,
  2e ★★, 3e ★, MEILLEUR résultat conservé. Chaîne jamais punitive : épreuve
  suivante = 1★ dans chaque épreuve précédente de la ligue ; ligue suivante =
  1★ dans chaque épreuve de la ligue courante. **Les déblocages sont DÉRIVÉS**
  de `S.stars` à chaque rendu (`concoursUnlocked` / `ligueUnlocked`), jamais
  stockés. `noStars:true` sort une épreuve du barème ET de la chaîne — combat
  libre et étalons mesurent, ils ne récompensent pas. L'ordre du tableau
  `LIGUES` EST la progression.
- **Ligue Ouverte** : mixte par son PROGRAMME, jamais par le ring. Chaque
  épreuve reste mono-classe et garde le ring de sa classe. Les S serrent la
  pesée en laissant le logiciel libre, les M plafonnent le logiciel en laissant
  le matériel libre : deux philosophies de build, zéro champ nouveau.
- **S27-BUS : `control()` est découpé en trois phases.**
  `perceive` → `decide` → `actuate`. `perceive` est PUR (ne mute rien, ne
  consomme aucun aléa) et publie 17 signaux normalisés + les bits de présence
  capteur, masqués selon le capteur MONTÉ. `decide` est la cascade d'origine,
  déplacée telle quelle — c'est elle que l'arbitre à enchères remplacera.
  `actuate` porte la cible et le servo.
  ⚠ **Le masque porte sur les signaux normalisés seulement** : la cascade lit
  `P.raw` (géométrie brute, non masquée). C'est ce qui rend l'extraction
  numériquement neutre. Le masque deviendra effectif quand les modules
  remplaceront la cascade — décision assumée et mesurée, pas effet de bord.
  ⚠ **L'ordre des tirages d'aléa est un invariant** : `escape` et `hold`
  sortent avant le tremblé de conduite et ne tirent RIEN ; tout autre mode
  tire exactement deux fois, dans `actuate`. Le match-témoin compte les
  tirages par bot précisément pour ça.
- **S28-MODULES : la décision est un catalogue de modules à enchères.**
  `ENGINE.MODULES` — chacun déclare `{ id, mode, reflex?, needs, bid }`. `bid`
  ne mute rien, ne consomme aucun aléa, et rend 0 (inapplicable) ou une
  utilité. L'arbitre `priority` prend le PREMIER non nul dans l'ordre déclaré ;
  appliqué à ces modules, il reproduit exactement la cascade (témoin vert).
  **Deux étages** : les RÉFLEXES (`reflex:true` — GUARD, ESCAPE) sont évalués
  à chaque tick, hors cadence CPU (« tomber entre deux pensées serait
  injuste ») ; les PLANIFIÉS ne le sont que quand le bot pense, sinon le mode
  PERSISTE. **STALK est le module par défaut** : il enchérit toujours,
  faiblement — c'est lui qui garantit qu'un bot a un mode même sans capteur.
  Ajouter un module = une entrée dans `MODULES`, avec ses `needs` (vérifiés
  par la porte contre les signaux réels du bus).
  ⚠ Ce qui n'est PAS fait, délibérément : les listes de modules par palier
  logiciel (GUARD s'applique à tous les bots aujourd'hui), et le REFUS
  d'enchérir quand un capteur manque. Les imposer changerait le jeu — ce sera
  une décision mesurée, pas un effet de bord de refactor.
- **S29-UTILITÉ : l'arbitre `utility` et le palier v3.** `ENGINE.SOFTWARE` dit,
  en DONNÉES, ce que chaque palier sait faire : son arbitre et sa liste de
  modules (l'ordre de la liste EST la priorité, et départage les égalités en
  utilité). s0-s2 gardent la liste et l'arbitre historiques — comportement
  inchangé au tick près. s3 passe à `utility` : toutes les enchères sont
  évaluées, la meilleure gagne, égalité tranchée par l'ordre déclaré.
  Les RÉFLEXES restent en priorité même sous utilité : une garde au bord ne se
  met pas aux enchères. Sous `utility`, l'agressivité cesse d'être une porte
  binaire pour devenir un POIDS sur l'enchère.
  Renommage DISPLAY-ONLY : les libellés disent v0..v3, les ids restent s0..s3
  (taxonomie gelée). Les adversaires montent jusqu'à v3 et subissent le
  `maxSoftware` du concours — sans quoi ils auraient un logiciel interdit au
  joueur, ce qui n'est pas une difficulté mais une tricherie.
- ⚠ **CONSTAT MESURÉ sur v3, à ne pas prendre pour un succès** : son avance sur
  v2 est ENTIÈREMENT celle du levier d'agressivité (s3/équilibré vs s2/équilibré
  = 80 % ; s2/FÉROCE vs s2/équilibré = 80 % ; s3 vs s2 à agressivité égale
  = 50 %). L'arbitre fonctionne ; c'est le COMBAT qui n'a pas encore de
  décision intéressante à lui soumettre — charger est presque toujours juste,
  donc moduler ne bat pas « charger toujours ». Deux verrous, dans cet ordre :
  `aggression=balanced` est un piège (féroce gagne 77 % contre lui), et tant
  qu'aucune situation ne récompense le fait de NE PAS charger, aucun pilote ne
  peut être malin. Les armes et les dégâts positionnels créent ces situations.
- **DETTE connue (constatée à S27, non corrigée)** : la cible calculée dans le
  bloc `orbit` d'`actuate` est TOUJOURS écrasée par la branche `else` plus bas
  — mesuré 5820 fois sur 5820, de 70 unités en moyenne. Le mode `orbit` roule
  donc sur la cible de standoff. Corriger changerait le comportement : à
  trancher devant le simulateur, avec mesure.
- Le palier logiciel se lit sur la pièce **MONTÉE** sur le bot actif
  (`fittedSwTier()`), jamais sur les pièces possédées : un bot resté en s0
  n'hérite pas des contrôles d'un s2 acheté pour un autre.

## Ajouter du contenu
- **Une coque** : entrée `CHASSIS_REG` (data.js) avec `series`, `spec`, `info`,
  `sprite` + entrée `ENGINE.CHASSIS` (radius/leverage/battery/selfRight) +
  entrée `ENGINE.PHYS.chassis` (kg, r). Les trois sont exigées par la porte.
  Le rayon reste STOCKÉ : il porte une saveur par coque (−11 % à +37 % de la
  demi-dimension) et le dériver déplacerait l'équilibre.
- **Une série** : une entrée `CHASSIS_SERIES` + `series:"<id>"` sur ses coques.
  La boutique s'organise d'elle-même par série puis par classe.
- **Une pièce** : `ENGINE.PARTS` (avec son `gamme`) + `FOOT_BASE`/`FOOT_TIER` + `COMPONENT_SPRITES`
  + `DEF_SLOT` + i18n `pn_<id>` FR **et** EN (vérifié par la porte).
- **Un étalon** : une entrée `ENGINE.BENCHMARKS` + une entrée `TOURNAMENTS`
  portant `benchmark:"<id>"` + son id dans `LIGUES.calibrage.concours`.
- **Un concours** : une entrée `TOURNAMENTS` (format existant, arène déclarée
  dans `ARENA_GEOM` — les deux vérifiés). `noEngage:true` = exhibition sans
  machine à états.

## QC
Harness dans le dépôt frère `roboclash-qc/` : `npm install jsdom && node tools/gate.js`
→ doit afficher `PORTE: ÉCHECS (0)` (644 vérifications, ~60-90 s).
Outils manuels hors porte : `node tools/fuzz_flows.js` (flux de combat, anti-gel)
et `node tools/bench.js` (banc de mesure : taux de victoire hydratés, deux côtés,
intervalle de confiance — voir `tools/README-harness.md`).
