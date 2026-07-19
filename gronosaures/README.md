# Gronosaures et Trilobytes

PWA de paléontologie, locale et mono-utilisatrice. Rien ne quitte l'appareil ;
la sauvegarde tient dans `localStorage`, sous la clé `atlas_temps_profond_v1`.

Deux temps distincts :

**Bourse** — on gagne des crédits de recherche en enchaînant des missions de six
exercices. Deux filières : *Entraînement* (conjugaison, orthographe, mathématiques)
et *Sciences* (histoire du temps profond, biologie des lignées, philosophie des
sciences). **Les deux paient exactement pareil.**

C'est un changement de principe assumé, arrivé en v8. Le barème d'origine payait
l'entraînement 64 % de plus, au motif qu'il coûte plus d'effort et ne doit pas être
le choix perdant. Le raisonnement tient pour quelqu'un qui arbitre entre deux
matières également accessibles. Il se retourne contre une joueuse pour qui les
mathématiques sont une angoisse : l'app la payait davantage pour affronter ce qu'elle
redoute, et moins pour ce qui la porte. Chaque session devenait un arbitrage entre
son plaisir et son avancement. Une app qu'on abandonne a un rendement d'apprentissage
nul — cette contrainte prime sur toutes les autres. Le choix du pack ne coûte
désormais que du temps.

**Fouille** — on ouvre un chantier contre un coût unique, on lit son introduction,
puis chaque coup de pioche coûte 30 ◈ *et* exige de répondre juste à une question du
site. Réponse juste, la tranchée livre une créature ou un fragment. Deux erreurs, elle
livre quand même un fragment d'une créature déjà connue, la réponse s'affiche avec son
explication, et la question reviendra plus tard. C'était le seul endroit du jeu où
l'on perdait quelque chose, et il se trouvait du côté du plaisir. Les fragments débloquent trois niveaux
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
node tools/qc.js      # ~7100 assertions : contenu, cohérence, conjugueur, économie, carte
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
tirer — jusqu'à documenter intégralement les dix-huit sites, et contrôle la
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
sw.js           cache-first versionné (atlas-v15), 185 entrées (globes inclus) ; liste dérivée de data.js
monde.jpg       carte du monde, 1535 × 1024 ; repère des coordonnées d'épingles
cartes/         110 illustrations, nommées d'après creature_id
sites/          18 vues de site
tools/          qc.js, smoke.js, ingest.py, pins.py, masque_terre.json, AJOUT_PACK.md
```

## Contenu

Dix-huit sites, 110 créatures, 360 questions de fouille. `SITES` est classé du plus
ancien au plus récent, et c'est cet ordre qui structure la collection :

| | Site | Époque | Créatures | Coût |
|---|---|---|---|---|
| 1 | Côte d'Hiver, mer Blanche | Édiacarien, 558–550 Ma | 6 | 600 ◈ |
| 2 | Anti-Atlas marocain | Cambrien → Dévonien, 509–393 Ma | 6 | 280 ◈ |
| 3 | Schiste de Burgess | Cambrien moyen, 508–505 Ma | 6 | 80 ◈ |
| 4 | Groupe de Yezo, Hokkaidō | Ordovicien → Crétacé, 470–66 Ma | 6 | 680 ◈ |
| 5 | Calcaire de Bear Gulch | Dévonien → Permien, 410–272 Ma | 6 | 720 ◈ |
| 6 | Schistes du Hunsrück | Dévonien inférieur, 408–400 Ma | 6 | 520 ◈ |
| 7 | Falaise de Miguasha | Dévonien supérieur, 385–360 Ma | 6 | 480 ◈ |
| 8 | Carrière d'East Kirkton | Carbonifère, 340–299 Ma | 6 | 400 ◈ |
| 9 | Mazon Creek | Carbonifère, 310–307 Ma | 6 | 320 ◈ |
| 10 | Bassin du Karoo | Permien → Trias, 265–247 Ma | 6 | 160 ◈ |
| 11 | Biote de Luoping | Trias moyen, 247–242 Ma | 6 | 640 ◈ |
| 12 | Faune de Zhenghe | Jurassique, 186–150 Ma | 6 | 560 ◈ |
| 13 | Formation de Morrison | Jurassique supérieur, 157–148 Ma | 6 | 200 ◈ |
| 14 | De Bernissart à Maastricht | Crétacé, 130–66 Ma | 6 | 120 ◈ |
| 15 | Formation de Yixian | Crétacé inférieur, 126–120 Ma | **8** | 360 ◈ |
| 16 | Bassin de Nemegt | Crétacé supérieur, 70–68 Ma | 6 | 440 ◈ |
| 17 | Hell Creek | Crétacé terminal, 68–66 Ma | 6 | 240 ◈ |
| 18 | Ouadi al-Hitan | Éocène → Oligocène, 51–24 Ma | 6 | 760 ◈ |

Les coûts d'ouverture ne suivent pas l'ordre chronologique : ils dessinent un
parcours de jeu, dix-huit paliers de 40 ◈ à partir de 80.

Les sites n'ont pas tous le même nombre de créatures. Yixian en compte huit depuis
l'index complet ; la grille de vignettes, les portes de qualité et le calcul d'effort
du harnais raisonnent donc par créature et non par site.

Huit de ces « sites » suivent en réalité un groupe, une lignée, une formation ou
même une démarche plutôt qu'un gisement ponctuel : l'Anti-Atlas pour les trilobites,
Hokkaidō pour les céphalopodes, Bear Gulch pour les chondrichthyens paléozoïques,
Miguasha pour l'origine des membres, East Kirkton pour les géants du Carbonifère,
Dinosaur National Monument pour le Morrison, Zhenghe pour les révisions récentes,
Ouadi al-Hitan pour l'origine des cétacés. Le lieu n'est alors qu'un
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
- **Histoire de l'art — Europe** — banque de 20 QCM : le cursus tel qu'il
  s'enseigne ici, plus la question de savoir qui l'a construit. Vasari et
  l'invention du récit de progrès, la hiérarchie des genres de l'Académie, les noms
  de mouvements qui sont des insultes retournées, et ce que le canon a laissé
  dehors.
- **Histoire de l'art — hors d'Europe** — banque de 20 QCM : Ifé, Bénin, Nok,
  Grand Zimbabwe, Lalibela, peinture Song, ukiyo-e, bronzes Chola, muqarnas,
  miniature persane, Olmèques, Moche, art aborigène. Non comme supplément
  exotique : ces traditions ont traité les mêmes problèmes autrement, souvent plus
  tôt. Le pack documente aussi comment le regard européen les a reçues — Frobenius
  et l'Atlantide devant les têtes d'Ifé — et comment les objets sont arrivés ici.
- **Philosophie des sciences** — banque de 20 QCM : réfutabilité, induction, rasoir
  d'Ockham, ce qu'est une espèce fossile, biais d'échantillonnage, lecture
  téléologique. Chaque question est ancrée dans un cas concret de l'atlas —
  Helicoprion pour observer contre interpréter, Atopodentatus pour la révision,
  Tullimonstrum pour les limites de la quantité de données.
- **Biologie des lignées** — banque de 20 QCM sur quatre lignées marines :
  trilobites, holothuries, requins, cétacés. Cinq questions chacune, plus la
  convergence évolutive. Le fil est ce que le corps impose et ce qu'il laisse dans
  les roches : calcite chez les trilobites, cartilage chez les requins, spicules
  microscopiques chez les holothuries. **Écrite à la main**, mais chaque item porte
  son lien de lecture.

Les 360 QCM paléontologiques (20 par site) ne sont pas un pack : ils servent de droit
d'entrée à chaque coup de pioche, dans l'onglet Fouille.

Trois cents d'entre eux viennent de la banque source, avec leurs références. Les
soixante autres — packs Zhenghe, Nemegt et Hell Creek — ont été rédigés faute de
source disponible, et rassemblés dans `w/quiz_complement.json` au même format. Chacun
porte un lien de lecture : musées (NHM, Carnegie, Field Museum), revues (PNAS,
iScience), universités, agences de presse scientifique. **À relire** : c'est du texte
écrit, pas recopié.

## Ajouter un pack

`tools/AJOUT_PACK.md` décrit la procédure en sept étapes. Les outils :

```bash
python3 tools/ingest.py --inventaire --packs XXX --assets /chemin/du/lot
python3 tools/ingest.py --packs EDI,TRI,... --assets /chemin --sortie w/data_bloc1.js
python3 tools/pins.py                      # position proposée pour une épingle
```

`ingest.py` lit `06_Index_creatures_MVP_complete.csv` (à défaut le JSON d'origine),
recopie les fiches et la banque de questions sans les reformuler, et convertit les
illustrations. Il gère les écarts de nommage rencontrés — alias de pack `LOU→LUO`,
`BEL→NWE`, `GOBI→NEM`, `HELL→HC`, `JURNEW→JUR`, `YIX2→YIX` — et trois conventions de
fichier : `HUN-01 #U2014 Nom.png`, `TRI1_Nom.png`, `GOBI_Nom scientifique.png`.
L'appariement se fait d'abord par nom d'espèce : la forme courte « pack + numéro »
entre en collision avec les alias numérotés, `YIX` + créature 2 donnant `YIX2`.

Il n'émet jamais une fiche dont le JPEG n'existe pas : une créature sans
illustration afficherait une image cassée dans la collection.

La seule partie rédigée à la main est le bloc `SITES` : ancrage géographique,
coordonnées de l'épingle, accroche, introduction en cinq volets, coût. C'est donc la
seule à relire ligne à ligne.

## Réglages d'équilibrage

Tout est en tête du bloc 2 de `data.js` :

| Constante | Valeur | Effet |
|---|---|---|
| `CREDITS_DEPART` | 260 | Burgess plus six coups de pioche |
| `COUT_FOUILLE` | 30 | prix d'un coup de pioche |
| `SITES[].cout` | 80 → 760 | ouverture d'un chantier, dix-huit paliers de 40 ◈ |
| `BAREME.base` | 10 / 7 / 12 | juste · après indice · prime de mission |
| `BAREME.histoire` | 10 / 7 / 12 | **identique** : choisir son pack ne coûte rien |
| `NB_MISSION` | 6 | exercices par mission |
| `BONUS_SITE` | 200 | plancher du bonus d'achèvement |
| `BONUS_PART` | 0,6 | part du coût d'ouverture rendue quand le site est complété |
| `SEUILS_DOC` | `[0,2,5]` | fragments requis pour les niveaux 1 / 2 / 3 |
| `FOUILLE_VIDE` | `false` | `true` autorise une fouille stérile malgré une bonne réponse |
| `NB_ESSAIS` | 2 | essais sur la question de fouille (en tête de la section 4e d'`app.js`) |

Ordres de grandeur mesurés par le harnais : une mission parfaite rapporte 72 ◈ dans
les deux filières, soit 2,4 coups de pioche.
Documenter un site au niveau 3 sur ses six créatures demande 53 fouilles en médiane,
ce qui fait revenir chacune des 20 questions du site deux à trois fois.

Sur les dix-huit sites : découvrir les 110 créatures coûte environ 9 600 ◈ nets, soit
134 missions. Depuis la v6, le bonus d'achèvement vaut 60 % du coût d'ouverture du
site, avec un plancher de 200 ◈ : ouvrir Ouadi al-Hitan coûte près de dix fois
Burgess, le compléter ne pouvait pas rapporter la même chose.

Aucune pénalité ne retire de crédits acquis. Une réponse trouvée après l'indice ou au
second essai rapporte moins et ne compte pas comme maîtrise autonome, mais donne
quand même droit au tirage.

## Classement de la collection

Trois vues sur les mêmes créatures, choisies sous le titre de l'onglet Collection.
Le classement n'est pas un confort : chacun enseigne autre chose.

| Vue | Sections | Ce qu'elle fait voir |
|---|---|---|
| Par chantier | les 18 sites, par ordre chronologique | où l'on a creusé |
| Par période | Édiacarien → Néogène, avec l'ère et les bornes en Ma | ce qui a vécu en même temps, et les trous |
| Par famille | 14 grands groupes | qui est parent de qui, indépendamment de l'âge et du lieu |

Chaque section affiche son compte « trouvées / total ». Les sections vides sont
masquées — c'est le cas d'« Échinodermes », déclaré mais sans aucune créature, faute
d'holothurie fossile dans l'atlas.

Le champ `groupe` des fiches est trop fin pour servir de rubrique : il compte plus de
cent valeurs distinctes pour cent dix créatures. `grandGroupe()` le ramène à quatorze
ensembles par expressions régulières testées **dans l'ordre** — « reptile marin »
avant « reptile », « cétacé » avant « mammifère ». `qc.js` vérifie qu'aucune créature
ne retombe dans « Non classé » : un tel oubli ferait disparaître silencieusement une
créature d'une des trois vues.

## Une joueuse qui redoute l'échec

Les mathématiques, l'orthographe et la lecture de graphiques sont, pour la personne à
qui cette app est destinée, des sources d'angoisse. Plusieurs choix en découlent, et
ils priment sur les principes de game design habituels :

- **les deux filières paient pareil** — voir plus haut ;
- **aucune fouille ne rend rien.** Deux erreurs livrent quand même un fragment ;
- **aucune pénalité ne retire de crédits acquis.** Une réponse trouvée après l'indice
  ou au second essai rapporte moins, mais donne quand même droit au tirage ;
- **la fin de mission nomme ce qui a été appris, pas ce qui a manqué.** `phraseFin()`
  remplace « 2 / 6 » par une phrase de parcours. Aucune n'est fausse ;
- **le fond d'écran fait défiler les créatures déjà trouvées**, une par question.

Ce qui n'a pas été fait, délibérément : retirer les matières redoutées. Elle a demandé
cette app en connaissance de cause. L'objectif est de rendre l'évitement gratuit, pas
de décider à sa place qu'elle n'y arrivera pas.

## Images des packs d'art

Six questions déclarent une image d'appui (`art/*.jpg`). **Le dossier est vide dans
la livraison** : l'environnement de développement n'autorise les sorties réseau que
vers quelques domaines. `github.com` en fait partie — c'est ainsi que le catalogue a
été lu — mais `api.nga.gov` non. Le champ `img` est facultatif et l'affichage se
replie proprement quand le fichier manque (`onerror="this.remove()"`).

Pour les rapatrier, sur une machine ordinaire :

```bash
python3 tools/telecharger_art.py --verifier   # sources et fiches, sans télécharger
python3 tools/telecharger_art.py              # écrit atlas/art/ + art/CREDITS.md
```

**Source : le jeu de données ouvert de la National Gallery of Art**
(`github.com/NationalGalleryOfArt/opendata`). Les images marquées `openaccess` y
sont versées au domaine public et servies par un point IIIF stable. C'est plus sûr
que Wikimedia, où le statut de la photographie d'une œuvre varie d'un fichier à
l'autre : ici, le manifeste porte l'identifiant d'objet et l'URL permanente.

**Ce que cette collection ne couvre pas.** 63 305 images en accès libre, et
essentiellement rien pour Ifé, le Bénin, les Chola, les Moche ou la peinture Song.
Une recherche sur « africain », « chinois » ou « islamique » y ramène surtout des
œuvres occidentales dont le titre contient le mot — *Cigar Store Indian*, *Design
from China Closet*. La National Gallery est un musée occidental : sa collection
ouverte illustre superbement le premier pack d'art et reste muette sur le second.
C'est le sujet même du pack « hors d'Europe », ici mesuré plutôt qu'affirmé — et
c'est pourquoi la seule image non européenne du manifeste est une estampe de
Hiroshige.

## Bundenbach étendu — les échinodermes

Le site `HUN` compte **douze créatures et quarante questions** depuis l'ajout d'un
pack d'échinodermes. C'est le seul site de l'atlas à dépasser le socle de vingt
questions, et `qc.js` vérifie désormais une **proportion** — entre deux et huit
questions par créature — au lieu d'un compte fixe.

Le choix de Bundenbach plutôt qu'un site neuf est meilleur que celui que ce README
recommandait auparavant. Le Hunsrück est le gisement à échinodermes à tissus mous :
la pyritisation y a remplacé des podia, ces pieds ambulacraires mus par de l'eau sous
pression qui ne se conservent nulle part ailleurs. Le pack Biologie explique pourquoi
les holothuries sont quasi invisibles dans les roches ; *Palaeocucumaria
hunsrueckiana*, à Bundenbach, est l'exception qui rend la règle lisible.

Deux découvertes structurent les questions ajoutées : les podia fossiles de
l'ophiure *Bundenbachia beneckei*, premiers du registre fossile, publiés en 2004, et
ceux du crinoïde *Codiacrinus schultzei* en 2013. Les deux tiennent à des techniques
d'abrasion mises au point par des collectionneurs amateurs allemands.

**Note de vérification.** *Lotusoblastus medusa* est absent des listes de faune du
Hunsrück antérieures à 2024 : le genre a été érigé cette année-là, son espèce-type
étant le *Pentremitidea medusa* décrit par Jaekel en 1895. Le taxon est valide.

## Packs à venir

`tools/PACKS_A_GENERER.md` spécifie trois packs, et `tools/packs_a_generer.csv`
contient leurs dix-huit fiches au format exact de l'index, prêtes à coller :

| Pack | Ce qu'il comble | État |
|---|---|---|
| `SUD` → livré sous `SAM` — Luján, le continent séparé | le Néogène **et** le Quaternaire, plus un continent absent | **fait (v12)** |
| `SIL` — Silurien, le rivage franchi | le Silurien, entièrement vide (443,8 → 419,2 Ma) | à générer |
| `MES` — Messel, quarante-sept millions d'années intactes | le Cénozoïque, qui reste mince hors cétacés | à générer |

Le Quaternaire a été ajouté à `PERIODES` avec le pack SAM. **Le Silurien est
désormais la seule période vide** de l'Édiacarien à aujourd'hui.

## La carte du monde

`monde.jpg` fait 6 140 × 4 096 px depuis la v15, en JPEG (2,3 Mo). C'est un
agrandissement 4× de la carte précédente : écart moyen mesuré de 3,1/255 entre les
deux, soit rigoureusement la même image. Le `viewBox` du SVG reste fixé à
`0 0 1535 1024`, donc **aucune épingle ni le masque de terre n'ont bougé**.

Le seul gain est la netteté au zoom, mais il débloque autre chose : `CARTE_ZOOM_MIN`
est passé de 90 à 40, c'est-à-dire qu'on peut zoomer deux fois plus profond. Avec
l'ancienne carte, un viewBox de 40 px aurait grossi la source huit fois et demie —
de la bouillie. Avec 6 140 px de large, il ne demande qu'un facteur 2,1.

Ce zoom plus profond était nécessaire : Messel et Bundenbach sont distants de cent
kilomètres, soit **sept pixels**, et leur grappe ne s'ouvrait à aucun zoom
atteignable. Le plancher arbitraire de 8 px entre deux épingles a été ramené à 5 ;
la vraie garantie est l'assertion qui dérive le seuil des constantes de la carte.

**Sur le fait que cette carte soit générée.** Elle l'est, et c'est le seul élément de
l'application qui affirme un fait — la forme des continents — sans le dispositif de
prudence appliqué partout ailleurs. Chaque créature porte un niveau de confiance et
une mise en garde ; la carte, non. Ses côtes sont approximatives et les silhouettes
d'animaux qu'elle porte ne correspondent à aucune des 134 créatures de l'atlas.

Ce n'est pas grave tant que la carte sert à **trouver et toucher un chantier**, ce
qui est son seul rôle ici : on n'y lit aucune coordonnée, aucune distance. Ça le
deviendrait si l'on prétendait y apprendre la géographie. Deux sorties possibles le
jour où ça gênera : un fond de carte du domaine public (Natural Earth), au prix d'un
recalage des 21 épingles et du masque ; ou une mention discrète sur l'écran de carte
disant que c'est une illustration. La seconde coûte cinq minutes.

## Messel — le vingt-et-unième chantier

Ajouté en v15. Il n'ouvre aucune période neuve : il étoffe le Paléogène, qui ne
tenait que sur les six archéocètes d'Ouadi al-Hitan et n'offrait donc aucun animal
terrestre. Le Cénozoïque passe de 8 à 18 créatures.

Le fil du chantier est la **conservation**, en contrepoint direct du Hunsrück. Là-bas
la pyrite conserve des formes ; ici l'anoxie d'un lac de maar conserve des contenus —
le dernier repas d'une chauve-souris, un fœtus et son utérus, l'estomac d'un
pangolin. Une question du pack pose explicitement la comparaison. Et les silhouettes
de corps si caractéristiques de Messel ne sont pas de la peau : ce sont des tapis de
bactéries minéralisées dans la forme des tissus qu'elles ont consommés.

Le second fil est **Darwinius masillae**, cinq questions. Présenté en 2009 comme le
chaînon manquant de la lignée humaine, avec conférence de presse, documentaire et
livre coordonnés le même jour ; réfuté en moins de deux ans — c'est un adapiforme,
du côté des lémuriens. Le fossile est superbe et n'a jamais menti. La leçon tient en
une phrase : conservation et interprétation sont deux choses séparées, et un
spécimen complet à 95 % ne rend pas plus vraie l'hypothèse qu'on lui accroche.

## La frise — quatrième onglet

Une ligne du temps verticale, à échelle **linéaire**, pensée pour le pouce. Elle
n'a pas la même fonction que le tri « par période » de la collection : là-bas
toutes les tranches ont la même hauteur, et l'on ne sent pas que le Crétacé dure
quatre-vingts millions d'années quand le Quaternaire en dure deux et demi.

Trois décisions de conception, chacune imposée par une mesure :

- **La frise porte les chantiers, pas les créatures une à une.** Les douze bêtes du
  Hunsrück ont le même âge. Les empiler verticalement serait faux ; les étaler
  latéralement demandait quatorze colonnes, mesurées. Un gisement est un instant.
  Toucher un chantier déplie ses créatures.
- **Deux chantiers trop proches se décalent latéralement, jamais verticalement.**
  Nemegt et Hell Creek sont séparés de deux millions d'années, soit dix-huit
  pixels : ils sont contemporains et la frise doit le dire. Même principe que les
  grappes d'épingles de la carte. `qc.js` vérifie que deux colonnes suffisent.
- **Le Précambrien est annoncé, pas compressé en silence.** La première version
  partait de 4 540 Ma en linéaire : le Précambrien occupait 88 % de la hauteur pour
  six créatures, et douze bêtes se superposaient au même pixel. La frise commence
  donc à 650 Ma, et un encart en tête indique que les quatre milliards d'années
  précédentes mesureraient trente et un mètres à cette échelle.

## Le globe des vues satellites

Chaque vue de site porte en bas à droite un petit globe qui situe le continent sur
la Terre d'aujourd'hui. Il était perdu deux fois : le cadrage `cover` rogne les
côtés d'une image de ratio 1,6 sur un écran de ratio 2,1, et le bloc de texte de
l'introduction se pose exactement dessus.

Plutôt que de tordre le cadrage, `tools/globes.py` extrait le globe en pastille
circulaire, et l'introduction la pose en haut à droite, au-dessus du voile, là où
rien ne le masque. La boîte de découpe est exprimée en **fraction** et non en
pixels : les vues de site partagent leur largeur mais pas leur hauteur, qui va de
1 131 à 1 318 px selon les lots. `python3 tools/globes.py --planche` produit une
planche de contrôle des vingt pastilles.

Le voile de l'introduction a été allégé au passage : il montait de 30 % à 98 %, et
la vue satellite disparaissait dans sa moitié basse. Il va désormais de 12 % à 86 %.

## Ludlow — le vingtième chantier

Ajouté en v14, il comble le Silurien — **la dernière période vide**. De l'Édiacarien
à aujourd'hui, la frise n'a plus de trou.

Ancré à Ludlow plutôt qu'à Stonehaven pour deux raisons. La bonne : c'est là que
Murchison a défini le système silurien dans les années 1830, d'après les Silures, et
c'est d'où vient *Cooksonia*. La prosaïque : Stonehaven tombait à huit pixels du
chantier carbonifère écossais, trop près pour que la grappe s'ouvre même au zoom
maximal — Ludlow est à seize pixels, comme Bernissart et Bundenbach.

Deux créatures sur six sont des **plantes**, ce qui n'existait nulle part ailleurs
dans l'atlas alors que la sortie des eaux est d'abord végétale. Une rubrique
« Plantes » a été ajoutée au tri par famille.

**Une datation qui a changé trois fois.** *Pneumodesmus newmani*, le plus ancien
animal terrestre respirant l'air dont on ait le corps, a été daté du Silurien en
2004 d'après des spores prélevées sur des affleurements voisins mais tectoniquement
isolés ; rajeuni au Dévonien en 2017 par datation uranium-plomb sur zircons, ce qui
lui retirait son titre ; puis ramené au Silurien en 2024 par une étude combinant les
deux méthodes. Trois questions du pack portent là-dessus. Le fossile n'a jamais
bougé ; ce qui a changé, c'est ce à quoi on l'a comparé.

## Luján — le dix-neuvième chantier

Ajouté en v12. Six créatures, vingt questions, coût 800 ◈. L'épingle est calée à
x=412 y=842, côté atlantique, contrôlée contre `masque_terre.json`.

Le site comble le Néogène et le Quaternaire, et ouvre un continent absent. Il porte
deux fils. Le premier est biologique : trente millions d'années d'isolement
produisent des ordres entiers sans équivalent ailleurs — litopternes, notongulés,
prédateurs métathériens, oiseaux au sommet de la chaîne — puis l'isthme de Panamá se
ferme et la plupart disparaissent.

Le second est épistémologique, et c'est pour lui que ce chantier vaut le détour.
C'est ici que Cuvier fonde en 1796 l'idée d'extinction, sur les dessins d'un
squelette qu'il n'a jamais vu. Et c'est ici que la morphologie a échoué : rapprochés
tour à tour des éléphants, des chameaux, des rhinocéros, *Macrauchenia* et *Toxodon*
sont restés inclassables cent quatre-vingts ans. La question a été tranchée en 2015
par le collagène extrait de leurs os — deux équipes indépendantes, même résultat, et
aucun fossile nouveau. Ce sont des cousins des chevaux.

**Bug corrigé au passage.** Le générateur « Ordre de grandeur géologique » tirait une
créature au hasard et arrondissait son âge en millions d'années. Les créatures
quaternaires arrondissent à zéro : la question devenait « il y a environ 0 millions
d'années » avec quatre distracteurs tous égaux à zéro. Le générateur « Durée entre
deux âges » avait le même défaut. Les deux ne tirent plus que parmi les créatures de
plus de 2 Ma. Sans le pack SAM, le bug serait resté dormant.

## Ce qui n'est pas fait

- **Trois créatures du Morrison sont écartées** faute d'illustration : `MOR-03`
  Camarasaurus lentus, `MOR-05` Apatosaurus louisae, `MOR-06` Dryosaurus altus.
  L'index en déclare neuf, le jeu en propose six.
- **Trente-deux masses restent « non estimables »** — l'Édiacarien, Mazon Creek, le
  Hunsrück, les trilobites, deux céphalopodes. Ce n'est pas un oubli de l'index : ces
  organismes à corps mou ou à squelette externe n'ont pas de masse publiée robuste.
  Y mettre un chiffre serait inventer une donnée.
- **`03_Banque_complete_questions_MVP.docx` reste très largement inexploitable.**
  `tools/banque_docx.py --inventaire` en extrait les 120 fiches et n'en retient que
  32 : le document a été écrit pour une validation humaine, où l'on juge une réponse
  formulée librement. Ce que l'application sait corriger, c'est un choix parmi quatre
  ou une frappe exacte — pas « un écosystème marin situé au pied d'un escarpement
  sous-marin ». Les trois packs thématiques du document (frise du vivant, créatures
  et lignées, mondes et crises) tombent à deux fiches utilisables sur quarante-quatre.
  Les rendre jouables demanderait de les réécrire, pas de les importer.
- Pas de mode révision ciblé sur les erreurs passées.
- Deux erreurs sur une question de fouille coûtent 30 ◈ sans rien livrer. C'est le
  seul endroit du jeu où l'on perd quelque chose ; `NB_ESSAIS` permet de desserrer.
- Les positions d'épingles restent indicatives : `monde.jpg` est une image générée,
  dont l'échelle mesurée varie de 4,2 à 6,6 pixels par degré selon la région.
