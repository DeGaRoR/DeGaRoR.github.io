# Le Grand Atlas du Temps profond

PWA de paléontologie, locale et mono-utilisatrice. Rien ne quitte l'appareil ;
la sauvegarde tient dans `localStorage`, sous la clé `atlas_temps_profond_v1`.

Deux temps distincts :

**Bourse** — on gagne des crédits de recherche en enchaînant des missions de six
exercices. Deux filières : *Entraînement* (conjugaison, orthographe, mathématiques)
et *Histoire* (échelle des temps, extinctions, histoire de la discipline).
L'entraînement paie mieux — 10 ◈ par bonne réponse contre 6 ◈ — parce qu'il coûte
plus d'effort et ne doit jamais être le choix perdant.

**Fouille** — on ouvre un chantier contre un coût unique, on lit son introduction,
puis chaque coup de pioche coûte 30 ◈ *et* exige de répondre juste à une question du
site. Réponse juste, la tranchée livre une créature ou un fragment ; deux erreurs,
elle est stérile et la question reviendra. Les fragments débloquent trois niveaux
documentaires sur la fiche : fragment identifié, spécimen documenté, dossier
reconstitué — seul le troisième donne les limites de la reconstruction et les sources.

## Lancer

Un service worker exige `http://`, pas `file://` :

```bash
cd atlas
python3 -m http.server 8080
# puis http://localhost:8080
```

## Porte de qualité

Aucune livraison sans `ÉCHECS (0)` sur les trois commandes :

```bash
node --check data.js && node --check app.js && node --check sw.js
node tools/qc.js      # ~4150 assertions : contenu, cohérence, conjugueur, économie, carte
node tools/smoke.js   # exécution réelle du jeu, DOM bouché
```

`qc.js` vérifie notamment que chaque `$('#id')` d'`app.js` existe dans `index.html`,
que chaque image déclarée existe sur le disque et figure dans le cache du service
worker, et que 27 formes verbales témoins sont exactes.

Il contrôle aussi la carte contre `tools/masque_terre.json`, un masque terre/mer
calculé depuis `monde.jpg` : aucune épingle ne doit tomber en pleine mer. Cette
assertion existe parce que l'épingle du Karoo se trouvait dans l'océan Indien, au sud
de Madagascar, et que personne ne l'avait vu pendant trois versions. Elle a resservi
depuis, en attrapant l'Anti-Atlas posé sur un liseré côtier.

`smoke.js` joue la boucle réelle — ouvrir un chantier, poser la question, répondre,
tirer — jusqu'à documenter intégralement les treize sites, et contrôle la
comptabilité des crédits à l'unité près ainsi que la platitude de la répartition des
questions. Il fixe la graine de `Math.random` : un harnais qui échoue une fois sur
quinze finit par être ignoré. `GRAINE`, en tête de fichier, permet de rejouer une
autre partie.

## Structure

```
index.html      3 onglets + 6 superpositions
styles.css      registre « carnet de terrain » (ardoise + ocre, serif pour les titres)
data.js         bloc 1 généré par tools/ingest.py + blocs 2/3/4 écrits à la main
app.js          7 sections : utilitaires, état, navigation, fouille, collection, bourse, init
                la section 4 explique pourquoi le tap sur les épingles est géré à la main
sw.js           cache-first versionné (atlas-v4), 100 entrées ; incrémenter VERSION pour publier
monde.jpg       carte du monde, 1535 × 1024 ; repère des coordonnées d'épingles
cartes/         78 illustrations, nommées d'après creature_id
sites/          13 vues de site, fond des écrans d'ouverture et d'introduction
tools/          qc.js, smoke.js, ingest.py, pins.py, masque_terre.json, AJOUT_PACK.md
```

## Contenu

Treize sites, 78 créatures, 260 questions de fouille. `SITES` est classé du plus
ancien au plus récent, et c'est cet ordre qui structure la collection :

| | Site | Époque | Coût |
|---|---|---|---|
| 1 | Côte d'Hiver, mer Blanche | Édiacarien, 558–550 Ma | 560 ◈ |
| 2 | Anti-Atlas marocain | Cambrien → Dévonien, 509–393 Ma | 260 ◈ |
| 3 | Schiste de Burgess | Cambrien moyen, 508–505 Ma | 80 ◈ |
| 4 | Groupe de Yezo, Hokkaidō | Ordovicien → Crétacé, 470–66 Ma | 680 ◈ |
| 5 | Calcaire de Bear Gulch | Dévonien → Permien, 410–272 Ma | 740 ◈ |
| 6 | Schistes du Hunsrück | Dévonien inférieur, 408–400 Ma | 500 ◈ |
| 7 | Carrière d'East Kirkton | Carbonifère, 340–299 Ma | 440 ◈ |
| 8 | Mazon Creek | Carbonifère, 310–307 Ma | 320 ◈ |
| 9 | Bassin du Karoo | Permien → Trias, 265–247 Ma | 200 ◈ |
| 10 | Biote de Luoping | Trias moyen, 247–242 Ma | 620 ◈ |
| 11 | De Bernissart à Maastricht | Crétacé, 130–66 Ma | 140 ◈ |
| 12 | Formation de Yixian | Crétacé inférieur, 126–120 Ma | 380 ◈ |
| 13 | Ouadi al-Hitan | Éocène → Oligocène, 51–24 Ma | 800 ◈ |

Les coûts d'ouverture ne suivent pas l'ordre chronologique : ils dessinent un
parcours de jeu, treize paliers de 60 ◈ à partir de 80.

Cinq de ces « sites » suivent en réalité un groupe ou une lignée plutôt qu'un
gisement : l'Anti-Atlas pour les trilobites, Hokkaidō pour les céphalopodes,
Bear Gulch pour les chondrichthyens paléozoïques, East Kirkton pour les géants du
Carbonifère, Ouadi al-Hitan pour l'origine des cétacés. Le lieu n'est alors qu'un
point d'ancrage, et le cinquième volet de leur introduction le dit explicitement.
La règle de choix est écrite dans `tools/AJOUT_PACK.md` § 5.

### Regroupement des épingles

Bernissart et Bundenbach sont distants de quatre cents kilomètres, soit dix-sept
pixels sur `monde.jpg`. Aucune position ne les sépare au zoom faible : les épingles
trop proches à l'écran fusionnent donc en une grappe numérotée, qui se déplie au tap.
Trois constantes gouvernent cela dans le bloc 2 — `CARTE_ZOOM_MIN`, `CARTE_GROUPE`,
`CARTE_LARGEUR_MIN` — et `qc.js` vérifie qu'au zoom maximal, sur l'écran le plus
étroit envisagé, toute grappe finit par s'ouvrir.

## Packs de la Bourse

- **Conjugaison** — génératif. 26 verbes réguliers dérivés mécaniquement, 18
  paradigmes irréguliers saisis en entier, 6 temps. Alternance QCM / saisie libre.
- **Orthographe** — banque de 40 items adultes (homophones, accords du participe
  passé, subjonctif après « bien que » contre indicatif après « après que »).
- **Mathématiques** — 19 générateurs : pourcentages, règle de trois, échelles,
  fractions, conversions, équations, notation scientifique, ordres de grandeur.
- **Histoire du temps profond** — banque de 52 QCM : échelle des temps, cinq
  extinctions, méthodes de datation, grandes découvertes de Sténon aux Alvarez,
  position des grands groupes. **Écrite à la main, sans source attachée** : à relire
  si un chiffre paraît douteux.

Les 260 QCM paléontologiques (20 par site) ne sont pas un pack : ils servent de droit
d'entrée à chaque coup de pioche, dans l'onglet Fouille. Ceux-là viennent des JSON
sources avec leurs références.

## Ajouter un pack

`tools/AJOUT_PACK.md` décrit la procédure en sept étapes. Les outils :

```bash
python3 tools/ingest.py --inventaire --packs XXX --assets /chemin/du/lot
python3 tools/ingest.py --packs EDI,TRI,... --assets /chemin --sortie w/data_bloc1.js
python3 tools/pins.py                      # position proposée pour une épingle
```

`ingest.py` recopie l'index créatures et la banque de questions sans les reformuler,
et convertit les illustrations. Il gère les écarts de nommage déjà rencontrés :
`LOU_` pour le pack `LUO`, `BEL_` pour le pack `NWE`, et deux conventions de numéro
(`TRI-01 …` et `TRI1_…`).

La seule partie rédigée à la main est le bloc `SITES` : ancrage géographique,
coordonnées de l'épingle, accroche, introduction en cinq volets, coût. C'est donc la
seule à relire ligne à ligne.

## Réglages d'équilibrage

Tout est en tête du bloc 2 de `data.js` :

| Constante | Valeur | Effet |
|---|---|---|
| `CREDITS_DEPART` | 260 | Burgess plus six coups de pioche |
| `COUT_FOUILLE` | 30 | prix d'un coup de pioche |
| `SITES[].cout` | 80 → 800 | ouverture d'un chantier, treize paliers de 60 ◈ |
| `BAREME.base` | 10 / 4 / 12 | juste · après aide · prime de mission |
| `BAREME.histoire` | 6 / 3 / 8 | idem, filière Histoire |
| `NB_MISSION` | 6 | exercices par mission |
| `BONUS_SITE` | 200 | les six créatures d'un site trouvées |
| `SEUILS_DOC` | `[0,2,5]` | fragments requis pour les niveaux 1 / 2 / 3 |
| `FOUILLE_VIDE` | `false` | `true` autorise une fouille stérile malgré une bonne réponse |
| `NB_ESSAIS` | 2 | essais sur la question de fouille (en tête de la section 4e d'`app.js`) |

Ordres de grandeur mesurés par le harnais : une mission d'entraînement parfaite
rapporte 72 ◈, soit 2,4 coups de pioche ; une mission d'histoire, 44 ◈, soit 1,5.
Documenter un site au niveau 3 sur ses six créatures demande 53 fouilles en médiane,
ce qui fait revenir chacune des 20 questions du site deux à trois fois.

Sur les treize sites : découvrir les 78 créatures coûte environ 7 700 ◈ nets, soit
une centaine de missions ; tout documenter au niveau 3 en coûte près de 23 000.

Aucune pénalité ne retire de crédits acquis. Une réponse trouvée après l'indice ou au
second essai rapporte moins et ne compte pas comme maîtrise autonome, mais donne
quand même droit au tirage.

## Ce qui n'est pas fait

- **`DEV` — « Inventer les jambes »** est prêt côté données (six créatures, vingt
  questions) et les six illustrations sont converties dans le lot reçu, mais la vue
  de site manque. Le pack est en attente : la modale d'ouverture et l'introduction
  s'appuient dessus. Il reste également `MOR` (Morrison) dans l'index, sans assets.
- Les 120 questions de `03_Banque_complete_questions_MVP.docx` ne sont pas intégrées :
  les trois packs d'entraînement sont générés à la place.
- Pas de mode révision ciblé sur les erreurs passées.
- Deux erreurs sur une question de fouille coûtent 30 ◈ sans rien livrer. C'est le
  seul endroit du jeu où l'on perd quelque chose ; `NB_ESSAIS` permet de desserrer.
- Les positions d'épingles restent indicatives : `monde.jpg` est une image générée,
  dont l'échelle mesurée varie de 4,2 à 6,6 pixels par degré selon la région.
