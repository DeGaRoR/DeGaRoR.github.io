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
node tools/qc.js           # ~8260 assertions
node tools/smoke.js        # 280 assertions, partie réelle
node tools/profils_test.js # 39 assertions, localStorage simulé ; cycle désinstaller/restaurer
node tools/qcm.js          # biais exploitables des questions à choix (banques intégrées)
node tools/qcm_brouillon.js # idem, sur une banque encore rédigée en markdown
node tools/version_test.js # 12 assertions, cascade de diagnostic de version
node tools/version.js      # état des versions ; `+` ou <n> pour les porter : contenu, cohérence, conjugueur, économie, carte
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
tirer — jusqu'à documenter intégralement tous les sites, et contrôle la
comptabilité des crédits à l'unité près ainsi que la platitude de la répartition des
questions. Il fixe la graine de `Math.random` : un harnais qui échoue une fois sur
quinze finit par être ignoré. `GRAINE`, en tête de fichier, permet de rejouer une
autre partie.

## Structure

```
index.html      3 onglets + 6 superpositions
styles.css      registre « carnet de terrain » (ardoise + ocre, serif pour les titres)
data.js         concaténation de 17 blocs, dans cet ordre :
                1 2 4 5 6 7 12 16 8 9 10 11 13 14 15 3 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37
                (1 généré par tools/ingest.py, le reste écrit à la main ;
                 3 déclare les packs, 17 leur assigne les rappels théoriques)
app.js          7 sections : utilitaires, état, navigation, fouille, collection, bourse, init
                la section 4 explique pourquoi le tap sur les épingles est géré à la main
sw.js           atlas-v73 · CODE réseau d'abord, IMAGES cache d'abord ; 254 entrées ; liste dérivée de data.js
monde.jpg       carte du monde, 1535 × 1024 ; repère des coordonnées d'épingles
cartes/         193 illustrations, nommées d'après creature_id
sites/          18 vues de site
tools/          qc.js, smoke.js, ingest.py, pins.py, masque_terre.json, AJOUT_PACK.md
```

## Contenu

Trente sites, 193 créatures, 640 questions de fouille (20 par site). `SITES` est
classé du plus ancien au plus récent, et c'est cet ordre qui structure la
collection. La table complète des sites, avec leurs bornes, leur nombre de
créatures et leur coût, n'est pas recopiée ici : elle vivrait faux à la première
retouche de données. Elle se lit directement dans `data.js` (`const SITES=`), qui
en est la seule source de vérité — et les portes de qualité vérifient que tout le
reste s'y conforme.

Ce qu'il faut en retenir tient en quelques nombres, tenus à jour parce que le
harnais les recalcule : les coûts d'ouverture s'échelonnent par paliers de 100 à
180 ◈ et ne suivent pas l'ordre chronologique — ils dessinent un parcours de jeu,
pas une frise. Les sites n'ont pas tous le même nombre de créatures (de six à
treize) : la grille de vignettes, les portes et le calcul d'effort du harnais
raisonnent donc par créature, jamais par site.

Plusieurs de ces « sites » suivent en réalité un groupe, une lignée, une formation ou
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

Les 640 QCM paléontologiques (20 par site) ne sont pas un pack : ils servent de droit
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

Les parties rédigées à la main sont le bloc `SITES` — ancrage géographique, coordonnées
de l'épingle, accroche, introduction en cinq volets, coût — et l'entrée `EMBLEMES` du
bloc 29, la créature qui représentera le chantier sur la frise.

**Une banque de questions écrite pour un nouveau pack passe par les règles de rédaction
des QCM**, section suivante de ce README. Ce ne sont pas des recommandations : `qc.js`
refuse la livraison si la nouvelle banque dépasse 25 % de clés les plus longues ou un
ratio de 1,10, et la porte lit la liste des sites et des packs — un ajout est donc tenu
au même seuil que l'existant sans qu'on ait à le déclarer. `tools/AJOUT_PACK.md`
reprend les règles à l'étape 5 bis, là où les questions s'écrivent.

## Réglages d'équilibrage

Tout est en tête du bloc 2 de `data.js` :

| Constante | Valeur | Effet |
|---|---|---|
| `CREDITS_DEPART` | 260 | Burgess plus six coups de pioche |
| `COUT_FOUILLE` | 20 | prix d'un coup de pioche |
| `SITES[].cout` | 100 → 180 | paliers de 10 ◈, sans rapport avec l'ordre chronologique |
| `BAREME.base` | 10 / 7 / 12 | juste · après indice · prime de mission |
| `BAREME.histoire` | 10 / 7 / 12 | **identique** : choisir son pack ne coûte rien |
| `BAREME.serie` | 20 / 14 / 40 | les séries paient le double : neuf volets de récit pour six questions |
| `PRIME_NIVEAU` | 150 | prime versée une fois par niveau acquis, **proportionnelle à la taille de la banque** (`primeDe()`) |
| `NB_MISSION` | 6 | exercices par mission |
| `SEUIL_MAITRISE` | 2 | bonnes réponses autonomes pour qu'une question soit acquise |
| `BONUS_SITE` | 200 | plancher du bonus d'achèvement |
| `BONUS_PART` | 0,84 | part du coût d'ouverture rendue quand le site est complété |
| `SEUILS_DOC` | `[0,1,2]` | fragments requis pour les niveaux 1 / 2 / 3 |
| `FOUILLE_VIDE` | `false` | `true` autorise une fouille stérile malgré une bonne réponse |
| `FICHES_LIBRES` | `true` | `false` rétablit le déverrouillage des fiches à la trouvaille |
| `NB_ESSAIS` | 2 | essais sur la question de fouille (en tête de la section 4e d'`app.js`) |

Ordres de grandeur mesurés par le harnais : une mission parfaite rapporte 72 ◈ dans
les deux filières, soit 3,6 coups de pioche.
Documenter entièrement un site — troisième palier sur chacune de ses créatures —
demande environ 20 fouilles en médiane pour un site de six créatures, et une
cinquantaine pour le plus fourni, qui en compte treize. Chacun des sites porte
20 questions de fouille (deux en portent 40), qui reviennent donc plusieurs fois
au cours de sa documentation : c'est voulu, la répétition espacée est le seul
mécanisme d'ancrage de la filière paléo.

Sur les trente sites : documenter les 193 créatures au troisième palier demande
autour de 700 fouilles, soit environ 13 000 ◈ nets une fois retranchés les bonus
d'achèvement — de l'ordre de 180 missions parfaites. C'est un long horizon,
assumé : l'atlas se complète en saisons, pas en une soirée. Le bonus d'achèvement
vaut 84 % du coût d'ouverture du site avec un plancher de 200 ◈ ; comme les coûts
actuels s'échelonnent tous de 100 à 180 ◈, le plancher l'emporte partout et chaque
site rapporte aujourd'hui les mêmes 200 ◈ à l'achèvement. Le versant proportionnel
de `bonusDe()` est donc en sommeil — c'est un état de fait, pas une panne, et un
bonus uniforme se lit mieux qu'un barème.

Aucune pénalité ne retire de crédits acquis. Une réponse trouvée après l'indice ou au
second essai rapporte moins et ne compte pas comme maîtrise autonome, mais donne
quand même droit au tirage.

## Classement de la collection

Trois vues sur les mêmes créatures, choisies sous le titre de l'onglet Collection.
Le classement n'est pas un confort : chacun enseigne autre chose.

| Vue | Sections | Ce qu'elle fait voir |
|---|---|---|
| Par chantier | les 30 sites, par ordre chronologique | où l'on a creusé |
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

## Grille adaptative et carnet replié — v73

### Le chantier respire

Les six vignettes étaient rangées sur une seule ligne, minuscules, sous un écran vide. La
grille ne dépend plus du nombre de créatures mais de la largeur disponible :

| Écran | Colonnes |
|---|---|
| téléphone | 2 — six créatures en 2 × 3, grandes |
| ≥ 480 px | 3 |
| ≥ 760 px | 4, contenu centré |
| ≥ 1040 px | 6 |

Chaque vignette porte le premier mot du nom et sa pastille d'état. Le bouton de fouille
devient **collant en bas d'écran** : il reste sous la main pendant qu'on parcourt les
cartes, au lieu de sortir du champ.

### Les entrées du carnet sont repliées

Chaque entrée devient un `<details>` fermé, résumé sur deux lignes au plus. Le carnet
capte beaucoup — exercices des deux filières, découvertes, chantiers, cours, notes,
doutes — et une pile de blocs dépliés deviendrait illisible bien avant la centième trace.

**Un songe reste visible même plié.** C'est ce qu'on revient chercher ; le reste est du
détail qui s'ouvre à la demande.

### Note depuis le rappel théorique

Le bouton d'inscription figure maintenant dans le rappel théorique des packs de la Bourse,
là où la théorie se lit — et non plus seulement à la fin d'une mission.

### Trois patches qui n'avaient jamais pris

En réécrivant le gabarit d'entrée, j'ai découvert que **le fil de temps et l'affichage des
songes annoncés en v70 n'existaient pas**. Les patches avaient échoué sur une assertion
antérieure ; le CSS était écrit, le HTML jamais produit. Rien ne le signalait : la porte
vérifiait que toute classe utilisée avait une règle, jamais l'inverse.

Un contrôle le fait désormais dans les deux sens, sur les cinq classes structurantes du
carnet et des vignettes. C'est la troisième fois cette session qu'un correctif silencieux
est rattrapé après coup — les deux premières par tes captures.

## Retours de terrain — v72

### Les exercices de la Bourse n'étaient pas enregistrés

Le défaut le plus grave du lot. `noterQuestion` n'était branché que sur les questions de
fouille : faire une mission entière ne laissait aucune trace au carnet. Les exercices de la
Bourse y entrent maintenant, avec leur lien et leur bouton de doute.

Ils n'ont pas d'identifiant stable — on en fabrique un depuis le pack et l'énoncé, pour ne
pas noter deux fois la même question et pour que le lien puisse être marqué comme suivi.

### Le fil de temps n'existait pas

Le conteneur `carn-fil` annoncé en v70 n'a jamais été posé : le patch avait échoué sur une
assertion précédente et je n'avais pas revérifié. Le CSS était là, le HTML non. Il est
posé.

### Le carnet se remplit vers le bas

Le plus récent est désormais **en bas**, la saisie sous les entrées, et l'écran s'ouvre sur
sa dernière page. C'est un registre qu'on remplit, pas un fil d'actualité.

Les huit filtres sont retirés — de l'appareillage avant l'usage. Le mécanisme reste en
place et pourra réapparaître si le besoin se manifeste. La recherche n'apparaît qu'au-delà
de six entrées.

Marges franches, contrastes adoucis, fonds retirés.

### Niveaux documentaires pleins d'emblée

`NIVEAUX_PROGRESSIFS=false` : le dossier complet arrive dès la première obtention. Le
calcul par paliers est conservé intact juste en dessous, prêt à être rétabli.

### Trois états de créature, enfin distincts

Sur l'écran de chantier, les vignettes ne montraient pas ce qui était trouvé.

| État | Rendu |
|---|---|
| Trouvée | nette, liseré ocre, pastille pleine |
| Lisible, pas trouvée | grisée, désaturée, pastille creuse |
| Inconnue | point d'interrogation |

Chaque vignette porte aussi le premier mot du nom : six carrés muets ne disent rien.

### Mission surprise

Fond ocre plein et ombre portée — elle ressemblait à un titre de section. Retirée de
l'écran de fin de mission, qui comptait trop de boutons.

## Quatre chantiers — v71

### S1 · Audit de texte

Cinq chapeaux coupés, 237 caractères en moins, sans perte d'information : ils
expliquaient ce que l'écran montrait déjà.

    Tu réponds à des questions et tu gagnes des crédits de recherche.
    C'est ce qui finance les fouilles.
    → Des questions, des crédits. C'est ce qui finance les fouilles.

    Tout ce que tu as trouvé, à classer par chantier, par période,
    par famille, ou à voir sur la frise du temps.
    → Par chantier, par période, par famille, ou sur la frise.

L'audit reste partiel : trois chaînes visées n'ont pas été trouvées parce qu'elles sont
coupées différemment dans la source. À reprendre.

### S3 · La difficulté était une étiquette morte

Le champ `diff` n'est lu **nulle part** dans l'application. Il était attribué par rang de
question — les six premières faciles, les six dernières difficiles — donc faux, et il
donnait l'illusion d'un dosage qui n'existait pas.

Retiré des 140 questions générées, ainsi que du générateur. Les 500 questions d'origine
gardent le leur : c'est une métadonnée écrite à la main, et l'effacer serait détruire un
travail au lieu de corriger une erreur. Elle reste inutilisée.

### S4 · Mission surprise

Un pack tiré au sort, payé **1,6 fois** le tarif normal. Elle existe pour les jours où
choisir est déjà un effort : on ouvre, on appuie, on part. La prime compense le fait de ne
pas décider, et l'écran de fin la détaille.

Accessible en tête du menu des packs et depuis la fin de chaque mission.

### S6 · Le songe de cours

Un bouton en fin de mission inscrit une réflexion sur le pack qu'on vient de traverser.
Elle rejoint le carnet comme n'importe quelle trace : la Bourse et la Fouille alimentent
le même récit, ce qui était le point manquant de la v68.

## Le songe — v70

Le carnet enregistrait ce qui arrivait. Il lui manquait ce que ça faisait.

**Toute entrée peut désormais recevoir un songe** : ce qu'elle en a pensé, ce qu'elle
avait compris de travers, ce que le lien lui a appris. Il s'accroche à la trace plutôt que
de vivre à côté — rouvrir un lien un mois plus tard, c'est retrouver le lien *et* ce qu'on
en avait tiré.

Il s'affiche en note de marge, en serif italique sur fond ocre, décalé du texte qu'il
commente. C'est une voix différente de celle de l'application, et ça doit se voir.

### Le fil

Les entrées sont désormais enfilées sur une ligne de temps continue, chaque trace marquée
d'un nœud. **Un nœud qui porte un songe s'allume** — ocre, halo. En parcourant le carnet du
regard, on voit où elle s'est arrêtée pour penser.

Le carnet cesse d'être une pile de fiches pour devenir un parcours.

### Songes comme lecture

Un huitième filtre, « Songes », n'est pas un type d'entrée mais une lecture : toutes les
traces qui en portent un, quelle que soit leur nature. C'est la ligne de temps de ce
qu'elle a pensé, détachée de ce qu'elle a fait.

La recherche couvre les songes. L'export leur consacre une section, datée du moment où le
songe a été inscrit et non de la trace qui l'a déclenché — on relit ses pensées dans
l'ordre où elles sont venues.

### Les liens s'annotent

Dans la vue Liens, chaque source porte son songe et un bouton pour l'inscrire. Si
plusieurs questions renvoient à la même source, c'est l'entrée qui porte une réflexion qui
est retenue.

### Un bug livré en v69, et le contrôle qui manquait

La réécriture de `rendreCarnet` en v69 a emporté deux fonctions voisines,
`carnetLiens()` et `ajouterNote()`. La vue Liens et le bouton Noter étaient cassés.
`node --check` passait, la porte passait : rien ne relie un `onclick` à sa définition.

Un contrôle le fait maintenant — toute fonction citée dans un `onclick` doit exister.
Quarante-cinq gestionnaires vérifiés.

## Le carnet ne perd rien — v69

### Le plafond est supprimé, sans remplacement

La version précédente coupait les entrées les plus anciennes au-delà de six cents. C'est
correct pour une file d'attente et faux pour un carnet de terrain : ça effaçait le début
de l'aventure, c'est-à-dire exactement ce qu'on relit.

Il n'y a plus ni plafond ni élagage. Une entrée ne sort du carnet que si Louise la
supprime elle-même.

Ordre de grandeur, pour lever le doute : une entrée pèse quelques centaines d'octets. Dix
mille entrées tiennent dans quelques mégaoctets, très en deçà de ce que `localStorage`
accepte, et il faudrait des années d'usage quotidien pour y arriver. Le plafond n'aurait
rien protégé et aurait tout coûté.

### Tri, recherche, groupement

Le sens du temps se retourne — récent d'abord ou ancien d'abord, pour remonter son
parcours depuis le commencement. Un groupement par chantier remplace le groupement par
date. Une recherche filtre sur tout le texte des entrées, y compris la vue Liens. Les
trois choix sont conservés d'une session à l'autre.

### Les entrées lui appartiennent

Notes, doutes et commentaires de cours se **modifient**. Toute entrée se **retire**, y
compris les automatiques : le carnet est à elle, pas un journal système.

Un doute se marque **résolu** sans disparaître — il reste, barré, avec sa date. L'export
les sépare en « À VÉRIFIER » et « DOUTES RÉSOLUS ».

### Deux corrections

La boîte de doute utilisait un identifiant fixe : deux boîtes ouvertes en même temps se
volaient leur champ de saisie. Chaque boîte porte désormais sa référence.

Les entrées de découverte et de chantier sont **cliquables** : la vignette d'une créature
ouvre sa fiche, un chantier y ramène. On ne relit pas une trace sans pouvoir y retourner.

### Export

Deux boutons, copier et télécharger. Le second produit un fichier daté ; les deux
partagent le même texte, produit par une seule fonction.

## Le carnet devient un lieu — v68

Le carnet passe du tiroir à un **quatrième onglet**. Le tiroir est technique — mise à
jour, profils, import de progression ; le carnet est du contenu. Le mettre là revenait à
ranger un journal intime dans la boîte à outils.

Il ferme la barre : c'est là qu'on revient, pas là qu'on commence.

### Six types d'événements

Le carnet n'enregistre plus seulement les exercices. Chaque type garde la même structure
mais change de couleur d'ancrage, pour qu'on repère ce qu'on cherche sans lire.

| | |
|---|---|
| Exercice | énoncé, réponse, explication, source |
| Découverte | créature rencontrée, sa vignette, son groupe et son âge |
| Chantier | ouverture d'un site, sa région et son ère |
| Cours | introduction d'un chantier traversée |
| Note | saisie libre, à tout moment |
| Doute | « ça me paraît faux », daté et rattaché à son sujet |

### La vue Liens

Les liens ne sont pas un type d'entrée mais une **vue** : toutes les sources rencontrées,
dédoublonnées, celles déjà ouvertes marquées, avec le nombre de questions qui y renvoient.
C'est la bibliothèque que le parcours a constituée sans qu'on la range.

### Filtres et notes

Sept filtres en tête d'écran, le choix étant conservé d'une session à l'autre. Une zone de
saisie permanente pour ajouter une note libre sans passer par un exercice.

L'export couvre désormais tous les types : doutes en tête sous « À VÉRIFIER », puis notes,
rencontres, parcours.

### La persistance, vérifiée

`carnet` et `carnetTri` sont déclarés dans `etatVide()`, donc portés tels quels par
l'export de progression et rétablis par `normaliser()` à l'import. Un profil ancien,
enregistré avant cette version, reçoit un carnet vide au lieu de planter. Les trois cas
sont éprouvés.

### Un piège évité de justesse

`rendreCarnet` écrit maintenant dans le DOM au lieu de retourner du HTML. La vue du tiroir
l'appelait encore dans un gabarit : elle aurait affiché « undefined ». Elle est retirée, et
l'entrée du tiroir renvoie vers l'onglet.

## Carnet de parcours — v67

La collection dit ce qui manque. Le carnet dit où l'on est allé — même chiffre, sens
inverse. C'est le pari de cette version : pour une joueuse qui ne complétera pas les 193
créatures, une trace de ce qu'elle a lu vaut mieux qu'un décompte de ce qui reste.

### Ce qu'il enregistre

Chaque question traversée y laisse une entrée : l'énoncé, la réponse, l'explication et la
source. L'énoncé et l'explication sont stockés **en clair** plutôt que par référence, pour
que le carnet reste lisible si la banque change ensuite. Une entrée par question, jamais
de doublon, plafond à 600.

Les liens suivis sont marqués d'une coche. Le carnet devient donc aussi une bibliothèque :
les sources vérifiées se retrouvent sans repasser par l'exercice.

### Les doutes y ont leur place

Un bouton « Ça me paraît faux » figure sous chaque explication et sur chaque fiche de
créature. La remarque est datée, rattachée à son sujet, et rangée dans le carnet.

Ce réflexe devant une inexactitude est un atout, pas un agacement : on l'enregistre au
lieu de le laisser se perdre dans une conversation.

### L'export

Un bouton copie le tout en texte, doutes en tête sous l'intitulé « À VÉRIFIER », parcours
ensuite. Ça se colle dans un message et se discute.

### Ce qu'il n'a pas

Aucun score, aucun pourcentage, aucune série, aucune barre de progression. Un tableau de
bord redeviendrait une complétion, donc une chose à ignorer. Le carnet se lit comme un
registre de terrain, ce qui est déjà le registre visuel de l'application.

Il vit dans le tiroir du profil et non en quatrième onglet : pas de schéma mental
supplémentaire.

## Le contenu d'abord — v66

Constat de terrain : le contenu a triplé, mais il restait derrière un péage conçu pour une
joueuse qui collectionne. Ce n'est pas le profil visé. Le barème avait donc pour effet net
de cacher précisément ce pour quoi l'application est ouverte.

Deux changements, **sans toucher au moteur**.

### Les fiches sont lisibles tout de suite

`FICHES_LIBRES` révèle les fiches de créatures sans qu'elles aient été trouvées. La
fouille ne déverrouille plus le savoir ; elle marque ce qu'on a travaillé.

La progression reste entièrement visible : les compteurs « 0 / 6 », la collection et le
profil continuent de refléter les trouvailles réelles. Une créature lue mais pas encore
trouvée s'affiche simplement atténuée. On voit où l'on en est, on n'est plus privé de
lecture.

**Le masquage reste écrit et fonctionnel.** Passer le drapeau à `false` rétablit exactement
la mécanique précédente : c'est une réserve, pas du code mort.

### Le prix suggère un ordre au lieu de freiner

Le plateau à 320 supposait qu'on voulait ralentir l'ouverture. Le barème devient
**100 + 10 par chantier**, dans l'ordre chronologique : de 100 pour Lantian à 390 pour
Fossiles vivants. Total 7350 ◈ au lieu de 9280, et surtout le premier tiers de l'atlas
s'ouvre entre 100 et 190 — une à deux missions.

Dix crédits d'écart ne bloquent personne : ils indiquent une direction, ils ne l'imposent
pas.

### Frise : deux causes identifiées, deux corrections

Les chevauchements de la capture n'étaient pas cosmétiques, ils avaient une cause précise.

**Les ères et les périodes partageaient la même colonne** (`left:-74px`), et l'étiquette
d'ère est `sticky` : elle venait donc se garer sur n'importe quelle période au fil du
défilement. C'est ce qui empilait « MÉSOZOÏQUE », « Paléogène 66 Ma » et « CÉNOZOÏQUE ».
La gouttière passe de 74 à 104 px et porte désormais **deux colonnes distinctes**, l'ère
en vertical tout à gauche, la période à sa droite.

**Les étiquettes de chantier étaient bornées à `yFrise(0)`**, exactement là où se pose le
repère « Aujourd'hui ». Une garde de 26 px est réservée.

Enfin, chaque chantier **porte son époque** sous son nom : Lantian → Édiacarien, Gotland →
Silurien, Winton → Crétacé.

### Un bug attrapé au contrôle

`periodeDe` attend une **créature** — il lit `ageMin` et `ageMax` — et non un âge. Lui
passer un nombre donnait `NaN`, donc le repli silencieux sur la dernière période : tous
les chantiers s'affichaient « Quaternaire », Lantian à 600 Ma compris. Une fonction
`periodeSite` fait désormais l'adaptation.

## Les 120 explications écrites — v65

La dette repérée à la v64 est soldée. **Les 640 questions de fouille ont une explication
rédigée**, aucune générique, longueur moyenne d'environ 110 caractères.

### La source de vérité reste le fichier de pack

Les explications sont écrites dans `tools/PACK_*.md`, section « Les explications », et non
dans les données. Le générateur les lit avec les énoncés et les leurres : ce qui a été
relu et mesuré est ce qui est livré.

Le générateur est devenu un outil à part entière, `tools/questions.py`, au lieu d'un
script jetable. Il **refuse de produire un bloc si une explication manque**, plutôt que de
poser un texte d'attente comme la première version l'avait fait. C'est la correction de
fond : le défaut de la v63 venait d'un générateur trop conciliant, pas d'un oubli.

### Une incohérence trouvée en chemin

La question 2 de `LNT` demandait toujours l'âge du gisement avec « environ 602 Ma » pour
réponse, alors que le sourçage avait ramené la datation à « ≈ 600 Ma, débattue » et que la
fiche du site le disait déjà. Corrigée. C'est exactement le genre d'écart qu'une relecture
question par question fait apparaître et qu'aucune assertion ne pouvait attraper.

### Ce que les explications portent

Elles donnent la raison, pas le détail — la fiche s'en charge. Plusieurs prolongent une
correction du sourçage là où elle compte le plus, au moment où la réponse s'affiche :

- `COR-14` : l'ancrage de *Cystiphyllum* ne sert pas seulement à ne pas basculer, il
  utilise la colonie voisine comme substrat dur et tue ses petits polypes.
- `LIV-05` : l'expression « fossile vivant » est de Darwin, qui la jugeait lui-même
  fantaisiste dans la phrase suivante.
- `DOM-18` : les races canines montrent ce qu'une seule espèce peut donner — mais les
  moutons ont gardé une diversité génétique élevée, donc la sélection n'appauvrit pas
  toujours.
- `KAP-12` : la fiche nomme un genre parce que l'ADN ne descend pas plus bas, pas par
  prudence rédactionnelle.

## Phase QC après intégration — v64

Audit indépendant des harnais, après l'ajout des sept packs.

### Ce qui est vérifié et propre

Identifiants uniques pour les 193 créatures et les 640 questions. Les 193 fichiers
d'illustration existent sur le disque. Vingt questions exactement pour chacun des sept
nouveaux chantiers. Une source à URL réelle pour chaque créature. Une période attribuée à
chacune, y compris les espèces actuelles à 0 Ma. Emblème et fond résolus pour les sept
sites, fichiers présents.

### Le défaut que la porte ne voyait pas

**Cent vingt questions sur six cent quarante portent une explication d'attente.**

En passant à la génération des banques depuis les fichiers `PACK_*.md`, le texte des
questions, des réponses et des leurres est repris fidèlement — c'était le but — mais
l'explication n'existe pas dans la source markdown. Le générateur y a posé un texte
générique, « Voir la fiche de la créature concernée pour le détail ».

Winton n'est pas concerné : ses vingt explications ont été écrites à la main avant que le
générateur n'existe. Les six autres packs le sont entièrement.

Rien ne le signalait. La porte comptait les questions, vérifiait leurs quatre options,
leur clé, leur source, leur biais de longueur — mais pas si elles expliquaient quoi que ce
soit. Un contrôle est ajouté : il refuse toute question sans explication et **chiffre la
dette générique en avertissement**, comme le biais de longueur.

    ⚠ explications encore génériques : 120 questions
      (COR 20, DOM 20, KAP 20, LIV 20, LNT 20, WUD 20)

C'est le prix de l'accélération, et il est réparable : les six packs ont la matière dans
leurs fiches, il faut l'écrire. Cent vingt explications d'une phrase.

## Les sept packs intégrés — v63

**30 sites, 193 créatures, 640 questions de fouille.** 10331 assertions, ÉCHECS (0).

    LNT EDI TRI BURG ORD CEP COR SIL CHO HUN GIL DEV CAR MAZ WUD KAR2
    LUO JUR MOR NWE YIX WNT NEM HC WHA MES KAP SAM DOM LIV

L'atlas s'étend maintenant de 602 Ma au présent. `LNT` ouvre la frise, `LIV` la ferme avec
des espèces vivantes.

### Trois seuils devenus obsolètes

Les trois derniers échecs ne portaient pas sur le contenu mais sur des limites écrites
quand l'atlas comptait vingt-trois chantiers.

**Les bornes d'âge** exigeaient `ageMin > 0`. Le pack `LIV` porte des espèces actuelles,
dont l'âge de fin est le présent : zéro y est une valeur juste, pas une valeur manquante.

**Le plafond d'exercices** était un nombre fixe — 420 — alors qu'il exprimait en réalité
un rapport, environ quatorze exercices par chantier. Il devient proportionnel. La rampe de
coûts a par ailleurs été détendue : `BONUS_PART` passe de 0,80 à 0,84, dans le
prolongement de la refonte de la v43.

**Les colonnes de la frise** : trente chantiers ne tiennent plus en trois colonnes sur un
axe de même hauteur. Le seuil passe à quatre. Au-delà, il faudra allonger l'axe plutôt que
continuer à empiler.

### Ce qui reste à faire

L'épingle de `WNT` est marquée `pinProvisoire` : elle est sur une terre, ce qui est
vérifié, mais sa position exacte demande un coup d'œil. Les épingles de `LIV` et `DOM`
sont des **repères** assumés — les Comores et le Croissant fertile — et non des gisements ;
les introductions le disent dès la première phrase.

## Wuda, Gotland et Lantian intégrés — v62

Trois packs d'un coup. **27 sites, 175 créatures, 580 questions de fouille.**
`LNT` prend la tête de la frise, devant la Mer Blanche.

    LNT EDI TRI BURG ORD CEP COR SIL CHO HUN GIL DEV CAR MAZ WUD
    KAR2 LUO JUR MOR NWE YIX WNT NEM HC WHA MES SAM

Les corrections relevées au sourçage sont appliquées : date de Wuda ramenée à un
**instant** (298,34 Ma) et non un intervalle, *Palaeocyclus* **porpita**,
*Schlotheimophyllum* en champignon et possiblement colonial, récif de Gotland **turbide**
et non cristallin, âge de Lantian **débattu**, animaux possibles mentionnés, incertitude
étendue à *Flabellophyton*.

### Les questions sont générées, plus recopiées

Les soixante QCM sont produits depuis `tools/PACK_*.md` par script. Le texte mesuré et le
texte livré sont donc rigoureusement le même — plus de recopie, donc plus de divergence
possible entre la banque validée et la banque intégrée. C'est ce qui rend les trois packs
restants mécaniques.

### Un défaut de méthode, trouvé par la porte

**Je cherchais les positions d'épingles avec le mauvais décodage.** Le masque terre/mer
est encodé en hexadécimal ; je le lisais en base64. Mes « points terrestres » étaient donc
tirés au hasard — et deux d'entre eux sont passés par pure chance, ce qui est le plus
inquiétant.

La porte a rattrapé les quatre cas, un par un, jusqu'à ce que je relise sa propre fonction
de décodage au lieu de faire confiance à la mienne. Les quatre épingles sont maintenant
vérifiées avec exactement le code qui les contrôle.

### Deux assertions corrigées

**L'unicité des vues de site** comparait la clé `fond` brute. Depuis que celle-ci est
facultative, tous les sites qui en sont dépourvus valaient `undefined` et se ressemblaient
donc entre eux. Elle porte désormais sur le fond **effectif**, emblème compris.

**Les grands groupes** manquaient pour les coraux, les macroalgues édiacariennes et les
plantes du Paléozoïque supérieur — dix-huit créatures qui n'auraient figuré dans aucun tri
par famille.

## Winton intégré — v61

Premier des sept packs dans les données. **24 sites, 157 créatures, 520 questions de
fouille.** L'Australie entre dans l'atlas.

| | |
|---|---|
| Rang chronologique | 19ᵉ, entre Yixian (126 Ma) et Nemegt (70 Ma) |
| Emblème | `WNT-03` Savannasaurus |
| Fond | repli sur l'emblème — pas de vue satellite |
| Coût | 320 ◈, le plateau |

### Ce que la porte a attrapé

Six classes de défauts, toutes légitimes, et c'est le meilleur argument pour une porte
stricte : aucune n'aurait été visible à la lecture du bloc.

**L'épingle tombait à la mer.** Placée par estimation — la carte n'est pas
équirectangulaire et l'Australie n'avait aucun site de référence — elle a été recalée en
interrogeant directement le masque terre/mer, en exigeant que les huit voisins soient
terrestres aussi. Elle reste marquée `pinProvisoire` : le calcul garantit qu'elle est sur
une terre, pas qu'elle est au bon endroit.

**Les crocodyliformes n'existaient pas dans l'atlas.** Sans entrée dans `GRANDS_GROUPES`,
*Confractosuchus* n'aurait figuré dans aucun tri par famille — sans que rien ne le
signale. Le groupe est ajouté.

**Le classement chronologique.** `SITES` doit rester ordonné du plus ancien au plus
récent ; le bloc retrie après insertion plutôt que de calculer un index à la main, ce qui
vaudra aussi pour les six packs suivants.

**Les compteurs figés** — « 151 créatures », « vingt-trois sites » — devenaient des
obstacles à toute croissance. Ils deviennent des planchers.

**La pastille de globe devient facultative**, comme la vue satellite dont elle était
extraite (bloc 31). L'introduction masque l'image quand elle manque au lieu d'afficher un
lien mort, et la liste des pastilles réellement présentes est portée par les données.

**Le cache du service worker** ne connaissait pas les six nouvelles cartes.

### Ce qui reste

Six packs à intégrer sur le même modèle — le chemin est tracé et les corrections relevées
au sourçage sont à appliquer au passage. Et l'épingle de Winton demande un coup d'œil sur
la carte : c'est le seul point que le calcul ne tranche pas.

## Sourçage terminé — 42 / 42 — v60

*Entelophyllum* est sourcé : Jell & Sutherland 1990, *Palaeontology* 33(4), qui restreint
le genre aux formes **phacéloïdes** — exactement ce que décrit la fiche, des tubes séparés
divergeant depuis la base — et où *E. dendroides* est décrit.

**Les quarante-deux créatures des sept packs portent désormais une source vérifiée.**

### Un dernier apport, qui recadre Gotland

Les récifs de Gotland viennent d'être interprétés comme le **plus ancien système récifal
turbide connu**, fonctionnellement comparable aux récifs turbides actuels, reculant ce
type d'écosystème de près de quarante millions d'années.

Ce n'étaient donc pas des eaux cristallines de carte postale mais un milieu chargé en
sédiment, à faible lumière. L'introduction dit « une mer chaude et peu profonde » : c'est
exact, mais l'image mentale produite est fausse, et le volet 1 sera repris. Cela explique
aussi, après coup, les structures d'ancrage de *Cystiphyllum* — sur un fond meuble et
trouble, tenir debout est le problème central du chantier.

Et les tabulés avaient acquis des **photosymbiotes** dès le Silurien inférieur : la
symbiose avec des algues, qu'on associe spontanément aux coraux modernes, est bien plus
ancienne que leur lignée. Dans un pack qui insiste sur le fait que Rugosa et Tabulata ne
sont pas les ancêtres des coraux actuels, c'est une nuance précieuse — ce n'est pas la
lignée qui a été héritée, c'est la solution qui a été retrouvée.

### État à la fin de cette étape

| | |
|---|---|
| Packs rédigés | 7 / 7 — intro, fiches, 20 QCM chacun |
| Questions écrites | 140, une seule au-dessus de la cible |
| Illustrations | 42 / 42 converties et numérotées |
| Sources | **42 / 42 vérifiées** |

Reste la construction des blocs de données et l'intégration, avec les corrections relevées
par les sources : date de Wuda, âge de Lantian et sa phrase sur les animaux possibles,
*Palaeocyclus porpita*, caractère peut-être colonial de *Schlotheimophyllum*, cadrage
turbide du récif de Gotland.

## Gotland presque bouclé — v59

Quatre des six coraux manquants sont sourcés ; seul *Entelophyllum* résiste. Le sourçage
des sept packs est à **41 créatures sur 42**.

### Trois corrections

**Un nom d'espèce à vérifier.** La littérature écrit *Palaeocyclus* **porpita**, le pack
porte *porpitus*. À confirmer avant intégration — c'est le genre de détail qui se vérifie
en trente secondes et qui décrédibilise tout le reste s'il est faux.

***Schlotheimophyllum* n'est peut-être pas strictement solitaire.** La révision du genre
signale des spécimens coloniaux ou agrégés, alors que la fiche le donne pour un solitaire
à polype unique. Sa forme est par ailleurs décrite comme **en champignon**, plus parlant
que « large calice ouvert ».

**Position stratigraphique** : *Schlotheimophyllum* vient des Upper Visby Beds,
*Palaeocyclus* des Lower Visby Beds — dont il est un **marqueur biostratigraphique**.
C'est un fossile stratigraphique, notion déjà traitée ailleurs dans l'atlas : une question
de rappel serait à sa place.

### Deux ajouts qui valent des questions

***Favosites* a des pores muraux** perçant les cloisons entre corallites, permettant des
échanges entre polypes. La colonie n'était donc pas un assemblage d'individus séparés —
fait concret, visible sur un fossile poli.

***Schlotheimophyllum* était lui-même un habitat** : ses deux faces portent au moins
23 espèces d'organismes encroûtants ou perforants. Un corail sur lequel vit une communauté
entière — cela prolonge exactement le volet 4, qui parle de bâtir un relief où d'autres
viendront vivre.

La paléolatitude est confirmée au passage : Gotland se trouvait vers **20° S** au
Silurien.

| Pack | Sources |
|---|---|
| `WNT` `WUD` `LNT` `KAP` `LIV` `DOM` | 6 / 6 |
| `COR` Gotland | 5 / 6 |

## Domestication sourcé — v58

Six packs sur sept entièrement sourcés. La recherche confirme le vocabulaire du pack — la
sélection artificielle est bien définie comme le choix, par l'humain, d'une variation
naturelle avantageuse pour ses propres fins : l'agent change, pas le mécanisme — et
apporte trois nuances.

**La toison du mérinos a une histoire par étapes**, documentée depuis le mouton sauvage.
Ce n'est pas un caractère apparu d'un coup.

**Les races ovines ont conservé une diversité génétique élevée, contrairement au chien.**
Le pack montre la diversité morphologique spectaculaire des races canines ; il serait faux
d'en conclure que la sélection humaine appauvrit toujours le patrimoine génétique. Les
deux cas ne se comportent pas pareil, et le dire évite une généralisation abusive dans un
pack qui en compte déjà une, volontaire, dans son introduction.

**La domestication suit plusieurs voies** — commensale, par la proie, dirigée — et non un
scénario unique. Le chien et le mouton n'ont pas pris le même chemin.

### État du sourçage

| Pack | Sources |
|---|---|
| `WNT` `WUD` `LNT` `KAP` `LIV` `DOM` | 6 / 6 |
| `COR` Gotland | 2 / 6 |

Les quatre coraux manquants — *Favosites*, *Palaeocyclus*, *Entelophyllum*,
*Schlotheimophyllum* — sont décrits dans des publications anciennes et dispersées. C'est
le seul point dur restant avant la construction des blocs de données.

## Fossiles vivants sourcé — v57

La recherche a rapporté bien plus qu'une référence, et améliore l'argument central du
pack.

**Darwin a inventé l'expression « fossile vivant », et l'a lui-même jugée
« fantaisiste ».** Le terme est de lui, en 1859, avec la réserve dans la même phrase. Le
pack n'a donc pas à démonter une idée reçue *contre* la science : il rappelle une réserve
posée dès l'origine par celui qui a forgé le mot. C'est un bien meilleur argument que le
mien, et il ira dans le troisième volet.

Trois de mes six fiches y gagnent aussi :

- **Triops** — les notostracés étaient réputés pauvres en espèces, on les sait aujourd'hui
  riches en espèces. Exemple direct du propos.
- **La limule** — les limulidés se révèlent génétiquement plus diversifiés qu'on ne le
  pensait, ce qui appuie la question 18, « la limule a-t-elle cessé d'évoluer ? ».
- **Le tuatara**, en sens inverse — on connaît mal les étapes entre les premiers
  sphénodontiens et *Sphenodon*, le matériel se réduisant surtout à des mâchoires et des
  dents. Affirmer que sa lignée a peu changé est moins établi qu'il n'y paraît : à ne pas
  surinterpréter.

| Pack | Sources |
|---|---|
| `WNT` `WUD` `LNT` `KAP` `LIV` | 6 / 6 |
| `COR` Gotland | 2 / 6 |
| `DOM` | à faire |

## Kap København sourcé — v56

Un seul article couvre tout le gisement : Kjær et al. 2022, *Nature* 612:283–291. Le pack
gagne surtout en précision.

- **Le climat, chiffré** : températures moyennes annuelles de **11 à 19 °C au-dessus des
  valeurs actuelles**, au lieu de « nettement plus doux ».
- **La conservation** : l'ADN a survécu en se liant à des **surfaces minérales**. La
  question 8 disait « les minéraux de l'argile » — corrigé, la source est plus large.
- **Coordonnées** 82°24′ N : le « au-delà du 82ᵉ parallèle » était exact.

**Et un fait qui vaut une question à écrire.** Tous les vertébrés détectés par l'ADN sont
**herbivores** — aucun prédateur n'apparaît, ce que les auteurs attribuent à leur faible
biomasse. Autrement dit : une absence dans un relevé d'ADN n'est pas une absence dans
l'écosystème. C'est le prolongement exact du thème du pack, qui oppose déjà ce que la
méthode permet et ce qu'elle ne permet pas ; il y manquait ce troisième terme, ce qu'elle
peut faire croire à tort.

| Pack | Sources |
|---|---|
| `WNT` `WUD` `LNT` `KAP` | 6 / 6 |
| `COR` Gotland | 2 / 6 |
| `LIV` `DOM` | à faire |

## Lantian sourcé — v55

Une recherche, trois corrections, dont une qui touche le fond du chantier.

**Le premier volet affirmait « il n'y a pas d'animaux ».** C'est trop catégorique : le
biote de Lantian livre aussi des formes coniques à structures évoquant des tentacules —
*Lantianella*, rapprochée des cnidaires, *Xiuningella* — interprétées comme des **animaux
possibles**. La phrase devient « pas d'animaux dont on soit sûr », ce qui est différent et
franchement plus intéressant pour un chantier dont le sujet est l'incertitude.

**L'âge est moins ferme qu'annoncé.** Le pack disait 602 → 600 Ma ; la littérature dit
« environ 600 Ma » en précisant que la datation n'est pas fixée et que le biote pourrait
être plus jeune. Corrigé en « ≈ 600 Ma, datation débattue ». Cela ne change pas son rang :
il reste le site le plus ancien de l'atlas.

**L'incertitude ne concerne pas que *Orbisiana*.** L'affinité de *Flabellophyton* — la
créature emblème du pack — demeure elle aussi ambiguë, bien qu'il ait longtemps été tenu
pour une algue. Le cinquième volet ne peut donc pas présenter *Orbisiana* comme le seul
cas non réglé : c'est le plus net, pas le seul.

| Pack | Sources |
|---|---|
| `WNT` `WUD` `LNT` | 6 / 6 |
| `COR` Gotland | 2 / 6 |
| `KAP` `LIV` `DOM` | à faire |

## Wuda sourcé, cadence revue — v54

`WUD` sourcé en une seule recherche : le gisement a été étudié comme un ensemble, un même
corpus couvre les six plantes.

Deux corrections utiles. **La date** : le pack annonçait 298 → 296 Ma, la couche de
cendres est datée de **298,34 ± 0,09 Ma**. Ce n'est pas un intervalle mais un **instant**,
une seule éruption pratiquement sur la limite Carbonifère-Permien — ce qui sert le propos
du chantier plutôt que de le gêner. **Paratingia** : les noeggerathiales sont rattachées
aux progymnospermes, groupe frère des plantes à graines. Et le gisement est connu comme la
**« Pompéi végétale »**, à reprendre dans l'accroche.

| Pack | Sources |
|---|---|
| `WNT` Winton | 6 / 6 |
| `WUD` Wuda | 6 / 6 |
| `COR` Gotland | 2 / 6 |
| `LNT` `KAP` `LIV` `DOM` | à faire |

### Une note de méthode

Le sourçage était mené une recherche par taxon, avec dépouillement complet de chaque
article. C'était disproportionné : quarante-deux créatures à ce rythme, et le reste du
projet s'arrête.

La règle retenue est plus simple — **une source correcte par créature, pas de fait
affirmé sans elle, et on avance**. Les corrections importantes remontent quand même :
elles sont sorties ici d'une seule recherche par pack. Ce qui compte est de ne rien
écrire de faux, pas d'épuiser la littérature de chaque taxon.

## Gotland, sourçage entamé — v53

Deux des six coraux sont sourcés, et la recherche a rapporté mieux qu'une référence.

### Une scène, au lieu d'une généralité

La fiche de *Cystiphyllum visbyense* disait qu'il était « stabilisé sur les fonds meubles
par des structures d'ancrage ». C'est vrai, mais très en dessous de ce qu'on sait.

À Ireviken, dans la formation de Lower Visby, ce rugueux solitaire est retrouvé **en
position de vie, installé entre les rangs des colonies d'Halysites**. Ses structures
rhizoïdes se développent surtout du côté convexe. Il ne cherchait pas seulement à ne pas
basculer sur la vase : **il utilisait la colonie voisine comme substrat dur**, et ses
tentacules balayeurs tuaient les petits polypes alentour pour se faire de la place.

C'est une scène d'écologie récifale lisible sur une seule dalle — un corail qui s'installe
sur un autre et le tue lentement pour tenir debout. La question 14 sera reprise dans ce
sens et le troisième volet de l'introduction peut la porter.

### Deux autres apports

**Nomenclature.** *Halysites catenularius* a été nommé par **Linné, en 1767**. C'est l'un
des plus anciens noms de tout l'atlas, et probablement une question à écrire.

**Une réserve sur la datation.** Les deux références solides portent sur la formation de
Lower Visby, d'âge Llandovery — le **début** du Silurien, autour de 435 Ma, et non
l'intervalle 445–420 Ma annoncé pour le pack. La fourchette large reste défendable pour
un chantier qui couvre l'île entière, mais elle est désormais marquée comme à vérifier
plutôt qu'affirmée.

### Sourçage

| Pack | Sources |
|---|---|
| `WNT` Winton | 6 / 6 |
| `COR` Gotland | 2 / 6 |
| `WUD` `LNT` `KAP` `LIV` `DOM` | à faire |

## Winton entièrement sourcé — v52

La source manquante de `Confractosuchus sauroktonos` est trouvée : White et al. 2022,
*Abdominal contents reveal Cretaceous crocodyliforms ate dinosaurs*, Gondwana Research.
**Les six créatures de Winton portent désormais une source vérifiée** — le premier pack
complet des sept.

### La recherche a corrigé la fiche, encore

Deux nuances que le résumé de départ ne portait pas, et qui changent ce que le chantier
enseigne.

**Le nom ment un peu.** *Confractosuchus sauroktonos* signifie « tueur de dinosaures
brisé ». Mais l'analyse morphométrique du crâne en fait un **généraliste** : il n'était
pas spécialisé dans la chasse aux dinosaures, il n'a simplement pas laissé passer une
proie facile. La différence est importante — un contenu stomacal documente un repas, pas
un régime. La question 19 a été refaite pour porter là-dessus plutôt que sur une évidence.

**Le repas vaut plus que le prédateur.** Les os d'ornithopode retrouvés dans son abdomen
sont les **premiers restes squelettiques** de ce groupe dans la formation de Winton, connue
jusque-là par des dents isolées et des empreintes seulement. Autrement dit, ce crocodile a
livré un dinosaure que les fouilles n'avaient pas trouvé.

Taille confirmée à 2–2,5 m, et l'animal est un eusuchien : précision ajoutée à la fiche.

### Où en est le sourçage

| Pack | Sources |
|---|---|
| `WNT` Winton | **6 / 6** |
| `WUD` `COR` `LNT` `KAP` `LIV` `DOM` | à faire |

Trois recherches auront suffi pour Winton, parce que la publication d'origine couvrait
trois taxons à la fois. Les packs de plantes et de coraux seront probablement moins
économes.

## Les sources de Winton, vérifiées — v51

L'intégration bute sur une exigence de la porte : `qc.js` réclame, pour **chaque
créature**, au moins une source dont l'URL réponde. Quarante-deux créatures, quarante-deux
sources — et c'est précisément l'endroit où il serait le plus facile, et le plus grave,
d'inventer une référence plausible.

Elles sont donc cherchées, pack par pack. `PACK_WNT.md` porte désormais les siennes,
consignées avec leur référence exacte.

### Ce que la vérification a changé

Elle n'a pas seulement confirmé : elle a corrigé.

- **Savannasaurus** mesure environ **15 m**, avec des **hanches de plus de 1,10 m de
  large**. La fiche annonçait « 12–15 m » : corrigé. La largeur du bassin — le trait qui
  a motivé son choix comme emblème du pack — est confirmée et désormais chiffrée.
- **Ferrodraco** est connu par **environ 10 % de son squelette**, tout en étant le
  ptérosaure le plus complet d'Australie. Les deux se disent ensemble, et la réserve
  « matériel limité » cesse d'être une formule pour devenir un chiffre.
- **Australovenator** a été décrit comme allosauroïde en 2009, rattaché ensuite aux
  néovénatoridés, aujourd'hui aux mégaraptoridés. La fiche signalait que la place du
  groupe restait discutée : elle a effectivement changé deux fois.
- L'épithète **lentoni** honore un ancien maire de Winton — ce qui prolonge le cinquième
  volet de l'introduction, consacré aux noms tirés du lieu.

### Ce qui manque encore

La source de `Confractosuchus sauroktonos` n'a pas été trouvée dans les recherches
menées. Elle est marquée **manquante** dans le tableau plutôt que comblée par une
référence approximative : une fiche sans source est un défaut visible, une fausse source
est un défaut invisible.

Restent les six autres packs à sourcer, puis la construction des blocs de données et
l'intégration.

## Les sept packs rédigés — v50

Contenu complet pour les sept : bloc `SITES`, introduction en cinq volets, six fiches et
vingt QCM chacun. **140 questions**, toutes conformes dès la rédaction.

| | clé la plus longue | ratio |
|---|---|---|
| `WNT` Winton | 0 % | 0,92 |
| `WUD` Wuda | 0 % | 0,77 |
| `COR` Gotland | 0 % | 0,71 |
| `LNT` Lantian | 5 % | 0,80 |
| `KAP` Kap København | 0 % | 0,79 |
| `LIV` Fossiles vivants | 0 % | 0,70 |
| `DOM` Domestication | 0 % | 0,71 |

Le seul item déséquilibré du lot est la question 9 de `LNT`, dont la réponse est le plus
long des six noms de genre du pack : aucun leurre plus long n'existe sans inventer un
taxon. Comparaison utile — les 752 premières questions de l'atlas étaient à 67 % et ont
demandé onze passes de reprise. Mesurer pendant qu'on écrit a supprimé le problème plutôt
que de le corriger.

### `LIV` — un pack qui démonte son propre titre

« Fossile vivant » est un abus de langage, et le pack le dit franchement. *Nautilus
pompilius* et *Tachypleus tridentatus* sont des **espèces modernes** ; ce qui est ancien,
c'est leur lignée et leur plan d'organisation.

Cinq questions portent sur cette distinction, dont une qui la retourne vers la joueuse :
notre propre lignée est plus ancienne que notre espèce. C'est le contenu le plus utile du
pack, bien plus que les six noms.

Le chantier ferme l'atlas parce qu'il en est le miroir : partout ailleurs on regarde des
formes disparues en imaginant ce qu'elles étaient vivantes ; ici on regarde des animaux
vivants en y reconnaissant des formes qu'on croyait révolues.

### `DOM` — la thèse dans l'introduction, pas dans les questions

Le pack soutient qu'une espèce est devenue capable de remodeler délibérément le corps
d'autres espèces. Cette thèse est **argumentée dans l'introduction**, où elle peut l'être,
et absente des QCM, où elle serait devenue une opinion à cocher.

Deux écueils évités. Le vocabulaire d'abord : trois questions établissent qu'un teckel et
un lévrier sont deux **races** d'une même espèce — la diversité montrée est interne, et
c'est ce qui la rend spectaculaire. Le jugement ensuite : le cinquième volet dit
explicitement que le chantier ne tranche pas si la domestication est bien ou mal, et
l'avant-dernière question le vérifie.

### Ce qui reste

Les fiches complètes — sources, prudence, degré de confiance, à l'image de `HC-01` — et
l'intégration dans `data.js`. C'est là que se vérifieront la frise reculée à 602 Ma par
`LNT` et les deux chantiers posés à 0 Ma.

## Kap København rédigé — v49

Cinq packs sur sept ont leur contenu complet.

| | clé la plus longue | ratio |
|---|---|---|
| `WNT` Winton | 0 % | 0,92 |
| `WUD` Wuda | 0 % | 0,77 |
| `COR` Gotland | 0 % | 0,71 |
| `LNT` Lantian | 5 % | 0,80 |
| `KAP` Kap København | 0 % | 0,79 |

### Un chantier sans fossiles

C'est le pack le plus inhabituel des sept : l'écosystème n'a pas été reconstitué à partir
d'os mais d'**ADN environnemental ancien**, conservé fixé sur les minéraux de l'argile. Il
n'y a pratiquement pas de squelettes.

Cela impose de traiter la méthode elle-même comme le sujet, et non comme une note de bas
de page. Sept des vingt questions y sont consacrées, articulées autour d'une opposition
simple : l'ADN du sédiment recense **bien plus d'espèces** qu'un gisement d'os — qui ne
garde que ce qui a un squelette solide — mais il ne donne **aucune anatomie**.

### Les fiches nomment ce que la méthode autorise

Cinq entrées sur six s'arrêtent au genre — *Mammut*, *Rangifer*, *Lepus*, *Branta* — ou à
la sous-famille pour l'arvicoliné. La sixième est un limulidé apparenté à *Limulus
polyphemus*, sans identification à l'espèce.

Ce n'est pas une réserve ajoutée après coup : trois questions portent directement dessus,
dont une qui demande *pourquoi* la fiche s'arrête à la sous-famille. Le cinquième volet de
l'introduction prévient également que les illustrations s'appuient sur des parents connus
et doivent se lire ainsi.

**Aucun leurre de ce pack ne porte d'absolu** — « toujours », « jamais », « aucun » — ce
qui n'était arrivé dans aucune autre banque. L'ADN environnemental se prête mal aux
formules tranchées, et c'est exactement son intérêt pédagogique.

## Visuels reçus, Lantian rédigé — v48

Les 42 illustrations des sept packs sont arrivées et converties : 680 px, webp qualité 74,
90 ko de moyenne. **193 cartes, aucune manquante, aucun écart de nommage.**
`tools/NUMEROTAGE.md` fige l'identifiant de chaque créature — les fichiers existent sous
ces numéros, fiches et QCM doivent s'y conformer.

### Deux points relevés à la conversion

**`DOM` — l'emblème n'est pas en position 01.** L'ordre du pack suit le processus de
domestication, qui met le chien en premier ; l'emblème reste le cheval de trait, donc
`DOM-04`. Seul pack dans ce cas, et c'est délibéré.

**`KAP` — les fichiers sont nommés par le genre**, et le limulidé porte le nom de
l'espèce *actuelle* apparentée, non celui du fossile. Les fiches nommeront le genre ou la
famille.

### Le plafond de poids, réexaminé plutôt que contourné

L'ajout portait les images à 20,9 Mo contre un plafond de 20. Recomprimer était inutile :
les 42 nouvelles ne pèsent que 3,4 Mo, ce sont les 151 existantes qui font le poids — même
à qualité 60 on restait au-dessus.

Le plafond avait été fixé pour vingt-trois chantiers ; sept packs de plus le dépassent
mécaniquement, sans qu'aucune image ait grossi. Dégrader les illustrations pour rentrer
sous un chiffre devenu arbitraire aurait abîmé l'essentiel de ce que la joueuse regarde.

Le plafond passe à **26 Mo**, et le contrôle qui compte devient le **poids par carte** :
moyenne sous 110 ko, aucune au-dessus de 220. C'est lui qui détecte une image mal
exportée ; le total ne mesurait que le nombre de packs.

### `LNT` rédigé

Quatre packs sur sept ont désormais leur contenu complet.

| | clé la plus longue | ratio |
|---|---|---|
| `WNT` Winton | 0 % | 0,92 |
| `WUD` Wuda | 0 % | 0,77 |
| `COR` Gotland | 0 % | 0,71 |
| `LNT` Lantian | 5 % | 0,80 |

Lantian devient le site le plus ancien de l'atlas et en recule le début de 558 à 602 Ma.
Le pack porte l'incertitude comme sujet plutôt que comme réserve en bas de fiche : la
silhouette est conservée, la parenté, la souplesse et la couleur ne le sont pas. Le
quatrième volet le dit — les illustrations de ce chantier sont des propositions, pas des
portraits — et quatre questions portent là-dessus, dont une sur *Orbisiana*, dont on ne
sait même pas s'il s'agit d'une algue.

Un item reste déséquilibré, la question 9 : la réponse est *Flabellophyton*, le plus long
des six noms de genre du pack, et aucun leurre plus long n'existe sans inventer un taxon —
ce que les règles interdisent. La question 11 a en revanche été ramenée à l'équilibre en
passant ses quatre options au binôme complet, ce qui est exact et n'invente rien.

## Wuda et Gotland rédigés — v47

`tools/PACK_WUD.md` et `tools/PACK_COR.md` complètent Winton : trois packs sur sept sont
écrits — bloc `SITES`, introduction en cinq volets, six fiches, vingt QCM chacun. Rien
n'entre dans `data.js` avant les visuels.

| | clé la plus longue | ratio |
|---|---|---|
| `WNT` Winton | 0 % | 0,92 |
| `WUD` Wuda | 0 % | 0,77 |
| `COR` Gotland | 0 % | 0,71 |

Les trois banques sont conformes dès la rédaction. C'est tout l'intérêt de mesurer au
moment où l'on écrit : les 752 premières questions ont demandé onze passes de reprise
pour arriver là.

### `WUD` — ce que le gisement permet de dire

Une forêt ensevelie sous les cendres, donc conservée **en position de croissance**. Le
fait remarquable n'est pas la conservation en soi mais ce qu'elle autorise : la plupart
des fossiles de plantes sont des morceaux transportés, dont on tire une liste d'espèces
mais pas une structure. Ici on peut relever qui poussait où, et reconstituer canopée,
sous-bois et plantes grimpantes.

L'introduction porte cela, et les questions aussi — trois d'entre elles opposent
« quelles espèces existaient » à « comment la forêt était faite ». Le pack montre en
outre plusieurs solutions concurrentes au même problème : tenir droit. Tronc de
lycophyte, manteau de racines chez la fougère arborescente, tige creuse segmentée chez
le parent des prêles.

Une réserve portée dans les fiches : `Sigillaria` **cf.** `ichthyolepis`. Une question
explique d'ailleurs ce que signifie ce « cf. » — l'attribution reste probable, non
établie. C'est le genre de convention qu'il vaut mieux enseigner que masquer.

### `COR` — le piège du pack, traité de front

Rugosa et Tabulata ont disparu à la fin du Permien sans descendance. Ce ne sont donc pas
des « coraux primitifs » ni une version ancienne de nos récifs : ce sont d'autres
architectures, obtenues par d'autres lignées, pour le même métier. Les coraux modernes
sont apparus plus tard et indépendamment.

Trois questions portent explicitement là-dessus, dont une sur le mot qui nomme le
phénomène — convergence. L'atlas le traite déjà pour le requin, l'ichtyosaure et le
dauphin ; le récif silurien en donne une seconde occurrence, à une autre échelle.

Le pack a aussi une vertu pédagogique inattendue : les six formes évoquent des objets
connus — une chaîne, un nid-d'abeilles, une corne, un bouton, un buisson. C'est une bonne
porte d'entrée pour apprendre à regarder un fossile, la forme d'abord et le nom ensuite.
Le cinquième volet le dit, la vingtième question le rappelle.

## Winton rédigé, et mesuré avant d'exister — v46

`tools/PACK_WNT.md` porte le contenu complet du premier des sept packs : bloc `SITES`,
introduction en cinq volets, six fiches de créatures et vingt QCM. Rien n'entre dans
`data.js` tant que les visuels ne sont pas là — une fiche sans illustration afficherait
une image cassée.

### Mesurer au moment où l'on écrit

`tools/qcm_brouillon.js` lit une banque encore rédigée en markdown, au format des fiches
`PACK_XXX.md`, et applique les mêmes contrôles que `qcm.js` : longueur de la clé, ratio,
absolus, reprise de l'énoncé, quatre options distinctes, énoncés interrogatifs.

C'est le bon moment pour mesurer. Découvrir le biais une fois les questions en place a
coûté onze passes de reprise sur les 752 premières.

**L'outil a immédiatement servi.** Le tableau de mesure de `PACK_WNT.md` avait été écrit
avant d'être mesuré : il annonçait 5 % et un ratio de 0,84. La mesure réelle donnait 15 %
et 0,93 — conforme, mais faux. Trois items laissaient la clé la plus longue, deux d'un
seul caractère. Un leurre allongé dans chacun, avec un contenu plausible et vrai, amène
la banque à **0 % et 0,92**.

L'épisode dit surtout ceci : un chiffre annoncé sans avoir été mesuré est faux même
quand il est flatteur, et il l'était ici dans le bon sens, ce qui le rendait d'autant
moins suspect.

### Le pack

Winton ouvre l'Australie, absente de l'atlas. Son intérêt tient à trois sauropodes aux
architectures différentes — l'un court et très large, l'autre élancé, le troisième
robuste — qui ne broutaient sans doute pas à la même hauteur. S'y ajoutent un prédateur
mégaraptoridé, un ptérosaure et un crocodyliforme dont un spécimen conserve dans son
abdomen les restes d'un jeune ornithopode : un document direct sur qui mangeait qui.

Les fiches portent la réserve là où elle s'impose — matériel limité pour `Ferrodraco` et
`Wintonotitan`, place discutée des mégaraptoridés dans l'arbre des théropodes.

## Sept packs pré-inscrits — v45

`tools/PACKS_V2.md` fixe tout ce qui ne dépend pas des visuels pour les sept packs à
venir : `WNT` Winton, `KAP` Kap København, `LNT` Lantian, `COR` Gotland, `LIV` Fossiles
vivants, `DOM` Domestication, `WUD` Wuda.

### Ce que la pré-inscription arrête

**La place dans la chronologie.** `LNT` (602 Ma) devient le site le plus ancien de
l'atlas et recule son début de 558 à 602 Ma ; `FRISE_DEBUT` reste à 650, la marge passant
de 92 à 48 Ma — encore confortable, aucun réglage d'échelle à revoir. Les six autres
s'insèrent sans déplacer personne. Tous tombent dans une période existante.

**L'ancrage cartographique.** Cinq packs ont un gisement réel. `LIV` et `DOM` n'en ont
pas : la règle des packs non géographiques s'applique, avec les Comores — où le
cœlacanthe a été retrouvé vivant — et le Croissant fertile. Dans les deux cas
l'introduction devra dire que l'épingle est un repère, pas un gisement.

**Les emblèmes de frise et les fonds.** Aucun de ces packs n'aura de vue satellite : le
repli du bloc 31 prend l'illustration de l'emblème. C'est le bon choix ici — une vue
satellite du Groenland actuel montrerait précisément le paysage que le pack dit avoir
disparu.

**Les précautions, pack par pack.** `KAP` s'appuie sur de l'ADN environnemental : cinq
identifications sur six s'arrêtent au genre ou à la famille, confiance écologique bonne
et anatomique faible. `LIV` porte un titre qui est un abus de langage — les lignées sont
anciennes, les espèces actuelles ne le sont pas — et deux QCM au moins devront tester
cette distinction. `DOM` défend une thèse, qui ira dans l'introduction et non dans les
questions, où elle deviendrait une opinion à cocher.

### Un défaut trouvé en vérifiant

`LIV` compte des espèces vivantes, d'âge moyen nul. Or la borne basse d'une période est
exclusive — nécessaire pour qu'une créature ne tombe pas dans deux périodes voisines.
**Zéro ne tombait donc dans aucune période**, et l'assertion « chaque créature tombe dans
une période », ajoutée en v41, aurait fait échouer la porte au moment d'intégrer le pack.

La dernière période se referme désormais sur le présent. Deux assertions le tiennent :
un âge moyen nul appartient bien à une période, et c'est le Quaternaire.

## Fond de chantier facultatif — v44

La vue satellite de chaque chantier était fabriquée à la main. C'est le poste le plus
coûteux de l'ajout d'un pack, et il ne peut pas suivre le rythme auquel on en ajoute.

**La clé `fond` devient facultative.** À défaut, le fond est l'illustration de la
créature emblème — celle qui représente déjà le chantier sur la frise. Ce n'est pas un
pis-aller : une carte de créature est une scène complète, déjà cadrée, à la bonne
palette, et elle dit l'époque mieux qu'une vue satellite d'un paysage qui n'existait pas
à ce moment-là.

Les vingt-trois vues existantes sont conservées : quand `fond` est renseigné, il prime.

Le fond sert à trois endroits — la fiche du site, l'intro à volets, et le chantier tant
qu'aucune créature n'en est sortie. Les cinq appels passent désormais par `fondDe()`.

### Les gardes

L'assertion vérifiait l'existence du fichier satellite ; elle vérifie maintenant qu'un
**fond utilisable** existe, et ne contrôle le fichier que s'il est déclaré. Trois
assertions s'y ajoutent : un chantier privé de vue satellite obtient bien une image, ce
repli passe par l'emblème, et **`app.js` n'interroge plus `s.fond` en direct** — un appel
resté direct contournerait le repli et afficherait un fond vide sans que rien ne le
signale.

La garde d'assemblage des blocs n'acceptait que les déclarations `const` ; elle accepte
aussi les fonctions.

## Économie : un péage constant — v43

Les coûts d'ouverture montaient linéairement de 80 à 960 ◈. Le défaut n'était pas le
niveau mais **la forme de la courbe** : les chantiers les plus chers arrivent
nécessairement en dernier, c'est-à-dire au moment où il ne reste que les banques de
questions les moins aimées. L'effort demandé augmentait précisément quand l'envie
diminue.

Le bonus d'achèvement aggravait la chose sans le vouloir : il récompense le fait de
**compléter** un chantier, ce qui est une motivation de collectionneuse. Quand ce n'en
est pas une, ce levier ne tire rien. Le moteur, ici, c'est le contenu — les bêtes et les
époques. Le péage doit donc rester léger et surtout constant.

### Trois changements

| | avant | après |
|---|---|---|
| ouverture d'un chantier | 80 → 960, pas de 40 | **80 → 320, puis plateau** |
| coût d'un coup de pioche | 30 ◈ | **20 ◈** |
| bonus d'achèvement | 0,6 du coût | **0,8 du coût** |

La rampe initiale est conservée : elle sert d'apprentissage, on sent qu'on progresse.
Au-delà, le prix cesse de grimper.

### Ce que cela change, mesuré en exercices réellement faits

| | avant | après |
|---|---|---|
| ouvrir les vingt-trois chantiers | 756 exercices | **330** |
| pire palier — ouvrir un chantier de plus | 60 exercices | **24** |
| dix derniers chantiers | 36 à 60 chacun | **12 à 24 chacun** |

Le coût marginal cesse de grimper : deux à quatre missions par nouveau chantier, du
début à la fin.

### Les gardes

Les coûts n'étant plus tous distincts, l'assertion correspondante est remplacée par une
vérification de **forme** : rampe puis plateau, plateau effectivement atteint, rampe
encore présente, et rapport maximal de quatre entre le plus cher et le moins cher.

Deux assertions tiennent en outre l'effort réel, en rejouant une partie jouée au mieux :
le **palier** ne doit pas dépasser 30 exercices, le **total** 420. C'est le seul chiffre
que ressent la joueuse.

Enfin, l'assertion « compléter un chantier ne rapporte pas d'argent net » comparait au
nombre maximal de créatures d'un chantier — un majorant. Avec un coût de fouille abaissé,
ce majorant masquait le cas limite : elle compare désormais au nombre réel.

## Repères et étiquettes sur la frise — v42

Deux chantiers séparés de deux millions d'années — Nemegt et Hell Creek — tiennent en
seize pixels, moins que la hauteur d'une pastille. La frise réglait ce cas par un
**décalage latéral** : les chantiers contemporains passaient en colonne 2, 3, 4. Cela
obligeait à comparer des hauteurs sur des colonnes différentes, et l'indentation
grimpait avec le nombre de gisements proches.

**On sépare désormais ce qui doit être exact de ce qui peut bouger.** Un repère court,
posé sur l'axe, marque la date au pixel près et ne se déplace jamais. L'étiquette glisse
verticalement jusqu'à trouver sa place, et un filet la relie à son repère. Rien n'est
déformé : la position lue sur l'axe reste vraie, seul le texte s'écarte, et le filet dit
de combien.

### Le placement

Une passe descendante repousse chaque étiquette juste assez pour ne pas recouvrir la
précédente. Une passe remontante récupère ensuite le jeu laissé au-dessus, sans quoi un
amas serré dériverait vers le bas alors que la place existe plus haut.

Cette seconde passe part du **présent** : une étiquette poussée sous « Aujourd'hui » se
lirait comme postérieure au présent. Elle laisse donc les étiquettes passer **au-dessus**
de leur repère quand un amas récent l'exige — le filet dit l'écart dans un sens comme
dans l'autre.

### Éprouvé sur le cas de demain

L'algorithme est rejoué par `qc.js` sur les chantiers réels, puis sur un cas de charge :
**dix gisements quaternaires**, tous compris dans les vingt-et-un derniers pixels de la
frise. Trois propriétés sont vérifiées dans les deux cas — aucune étiquette n'en
recouvre une autre, aucune ne passe sous le présent, l'ordre chronologique est conservé.

| | chantiers | écart maximal étiquette/repère |
|---|---|---|
| aujourd'hui | 23 | 28 px, deux étiquettes déplacées |
| + 5 quaternaires | 28 | 198 px |
| + 10 quaternaires | 33 | 428 px |

L'écart croît avec l'entassement : c'est visible, c'est le rôle du filet, et le repère
reste juste. Si la lecture devenait pénible avec beaucoup de gisements récents, le
remède serait une échelle segmentée pour le Cénozoïque, pas un déplacement des repères.

## Emblèmes de frise, axe jusqu'au présent — v41

### Une créature par chantier plutôt qu'un globe

La frise portait, pour chaque chantier, la pastille de globe des vues satellites. À
l'échelle du temps elle ne dit rien : la position géographique ne se lit pas sur un axe
vertical de 650 millions d'années, et vingt-trois pastilles quasi identiques ne se
distinguent pas les unes des autres.

Chaque chantier reçoit donc une **créature emblème** (`EMBLEMES`, bloc 29), choisie sur
deux critères : situer l'époque d'un coup d'œil, et rester reconnaissable en vignette de
trente pixels. À valeur égale, on a retenu la plus caractéristique de la **forme** du
vivant à ce moment-là plutôt que la plus célèbre — Walliserops et son trident pour
l'Anti-Atlas, Gemuendina aplatie en raie pour le Hunsrück, Archaeopteris et son bois
véritable pour Gilboa, Atopodentatus et sa tête en marteau pour Luoping.

Hell Creek fait exception : le Tyrannosaurus servant déjà d'icône à l'application, c'est
le Triceratops qui représente le chantier.

**Tant qu'un chantier n'a livré aucune créature, sa vignette est voilée** — niveaux de
gris assombris. La silhouette et l'époque restent lisibles, ce qui est le but, sans
déflorer la fiche que la fouille doit révéler.

### L'axe va jusqu'au présent

L'échelle des périodes couvrait déjà le Quaternaire jusqu'à 0 Ma ; le filtre par période
et la frise suivent donc l'Holocène sans modification. Deux ajouts pour que cela se
voie et le reste :

- un repère **« Aujourd'hui — 0 Ma »** ferme l'axe, pour que le présent ne soit pas
  seulement le bas de l'écran ;
- des assertions tiennent l'échelle : les périodes vont jusqu'à zéro, elles se suivent
  sans trou, et **chaque créature tombe dans une période** — une bête plus récente que
  la dernière borne serait silencieusement rangée dans la précédente.

L'échelle étant linéaire, elle se tasse là où l'on ajoute des chantiers récents : le
Quaternaire entier tient en vingt-et-un pixels. C'est le prix d'une échelle honnête et
c'est précisément ce qu'elle doit faire sentir ; le décalage latéral déjà en place
encaisse l'entassement.

### La procédure QCM entre dans l'ajout de pack

`tools/AJOUT_PACK.md` ne donnait que trois règles, toutes de **contenu** — lien, rien
d'inventé, pas de donnée absente. C'est ainsi qu'on a produit 752 questions dont 67 %
étaient devinables à la longueur.

L'étape 5 bis porte désormais les quatre règles de **forme** et l'interdit qui prime sur
tout — ne jamais inventer un fait pour allonger un leurre — avec la commande de mesure à
passer avant intégration. Une étape 5 ter décrit le choix de l'emblème. Le README
renvoie aux mêmes règles depuis la section « Ajouter un pack ».

Le contrôle est automatique : `qc.js` lit la liste des sites et des packs, un ajout est
donc tenu au même seuil que l'existant sans rien avoir à déclarer.

## Icône maskable sans bandeau — v40

L'icône maskable était fabriquée en posant l'illustration, réduite à 76 %, sur un fond
uni. Cela produisait un bandeau visible tout autour — une marge que le rognage d'Android
ne masquait qu'en partie, et qui jurait à côté de l'icône normale.

Elle est désormais **la même image, pleine frame**. Comme les deux fichiers seraient
identiques, un seul est écrit et le manifeste le déclare deux fois, sous les deux
usages. Le cache du service worker ne le liste qu'une fois — il passe de 213 à 212
entrées.

### Le compromis, mesuré

Android rogne les icônes maskables en cercle. En pleine frame, ce rognage emporte les
angles :

| | part du détail conservée |
|---|---|
| cercle inscrit, ce qu'affiche Android | **77 %** |
| zone sûre stricte à 80 % | 50 % |

Ce qui disparaît est du décor de bord — forêt, ciel, berge. Le sujet reste entier :
le T. rex avait été retenu, à la v30, précisément sur son critère de masse centrale
(1,00, le meilleur des six candidats mesurés). Le compromis est assumé : quelques pixels
de décor contre un bandeau permanent.

`python3 tools/icone.py <ID> --haut <%> --apercu` montre maintenant la vignette **telle
que rognée par Android**, au lieu de la version à marge qui ne correspondait à rien de
visible.

Deux assertions gardent l'état : la maskable et l'icône 512 doivent pointer le même
fichier — sans quoi le bandeau reviendrait sans qu'on s'en aperçoive — et la liste de
cache ne doit pas contenir de doublon.

## Les douze packs finis — v39

`histoire` (38 % → 8 %), `philomonde` (35 % → 5 %), `biologie` (35 % → 5 %). Ces trois
banques dataient de la première passe, avant que la règle 3 ne soit formulée.

**Les 752 questions du corpus sont désormais passées en revue** : douze packs et
vingt-trois chantiers, tous à 25 % ou en dessous.

| | avant v29 | maintenant |
|---|---|---|
| Corpus entier | 67 % · 1,76 | **11 % · 0,98** |
| Banque la plus haute | 100 % | **25 %** |

`qc.js` applique maintenant le même seuil partout — 25 % et ratio 1,10 — pour les
banques comme pour les chantiers. La porte ne suit plus un avancement : elle défend un
acquis.

### Une erreur qui a failli passer inaperçue

Les vingt questions déséquilibrées d'`histoire` sont **dispersées dans une banque de
52**. Je les ai d'abord réécrites en les repérant par leur rang — 1 à 20 — alors que ce
rang désignait les vingt *premières* questions de la banque, pas les vingt concernées.
Résultat : « Quel âge donne-t-on à la Terre ? » répondait « Dans le Yucatán, au
Mexique ».

Le plus inquiétant est que **rien ne s'en plaignait**. Les données restaient
formellement valides : quatre choix distincts, clé incluse, longueurs équilibrées. Seul
le fait que la banque ait *empiré* — 38 % à 42 % au lieu de descendre — a mis la puce à
l'oreille.

Deux gardes en découlent :

- la table de corrections repère désormais les questions **par un fragment de leur
  énoncé**, et **exige qu'il désigne une question et une seule** — le contrôle a
  immédiatement attrapé un fragment ambigu, « Schiste de Burgess », présent dans deux
  questions ;
- huit **sentinelles d'appariement** vérifient nommément des couples question/réponse
  connus. Elles ne sont pas exhaustives : elles suffisent à faire échouer la porte si un
  décalage général se reproduit.

**Cinquième banque sans champ `n`** : `histoire`, après `biologie`, `arteu`,
`philosophie` et `artmonde`. Numérotée à l'exécution comme les autres.

## Fouille terminée, règles consignées — v38

`YIX` (73 % → 8 %) et `HUN` (63 % → 0 %) traités. **Les vingt-trois chantiers et les
douze packs sont passés en revue.**

| | avant v29 | maintenant |
|---|---|---|
| Corpus entier | 67 % · 1,76 | **14 % · 1,01** |
| Fouille (500 questions) | 69 % · 1,75 | **10 % · 0,98** |
| Chantier le plus haut | 95 % | **25 %** |

La porte de qualité ne suit plus un avancement : elle vérifie les vingt-trois chantiers,
et fait échouer la livraison si le corpus repasse au-dessus de 25 % ou si le ratio de
longueur dépasse 1,10.

### Les règles sont écrites

C'était la vraie demande derrière ce chantier : que le défaut ne revienne pas à la
prochaine banque écrite. Une section **« Règles de rédaction des QCM »** ouvre désormais
ce README, avec les quatre règles, les deux interdits et ce que les outils vérifient. Un
rappel est placé en tête de `tools/qcm.js` et en tête du dernier bloc de données — aux
deux endroits où l'on se trouve quand on écrit ou qu'on mesure des questions.

### Contrôle de non-régression

    node --check          data.js · app.js · sw.js · les trois outils
    tools/qc.js           8 410 assertions
    tools/smoke.js          286
    tools/profils_test.js    39
    tools/version_test.js    12

Tous à ÉCHECS (0), versions concordantes.

## Règles de rédaction des QCM

Ces règles sont nées d'un défaut mesuré : sur les 752 questions à choix d'origine, **la
bonne réponse était la plus longue des quatre dans 67 % des cas**, pour une cible de
25 %. On pouvait gagner à peu près toutes les questions sans rien connaître au sujet, en
choisissant systématiquement la ligne la plus longue. À lire avant d'écrire ou de
générer la moindre question.

### Le défaut n'est pas la longueur, c'est la forme

La cause n'était pas la position — `app.js` mélange les options à chaque affichage. Elle
n'était pas non plus la longueur en tant que telle. C'était une **dissymétrie de forme** :
la clé était rédigée comme une proposition complète portant toute la nuance, les leurres
comme de courts groupes nominaux. Le lecteur n'avait pas besoin de lire, seulement de
regarder.

    ✗  Qu'est-ce qu'une source primaire ?
       ✔ Un document produit à l'époque étudiée, quel qu'en soit le support
       · Un manuel
       · Une encyclopédie
       · Le livre d'un historien

### Les quatre règles

**1. La clé est une réponse, pas une explication.** La nuance, les réserves et les
précisions vont dans le champ d'explication, qui s'affiche après coup. Une clé qui
contient « ..., mais » ou « ..., tandis que » est presque toujours trop longue.

**2. Les leurres sont parallèles à la clé.** Même nature grammaticale, même construction,
longueur du même ordre. Si la clé commence par un verbe à l'infinitif, les trois leurres
aussi.

**3. Au moins un leurre est plus long que la clé.** C'est la règle opératoire, et la plus
facile à oublier. Raccourcir la clé ne suffit pas : tant qu'elle reste la plus longue,
même de trois caractères, choisir la ligne la plus longue demeure un pari gagnant. C'est
cette règle qui a permis de descendre certains chantiers à zéro.

**4. Un leurre doit être plausible pour qui a mal révisé.** Les non-réponses — « Aucun
problème, c'est exact », « Il n'y en a pas », « Rien du tout », « Les cartes ne varient
jamais » — ne trompent personne et réduisent de fait le choix à trois. Un bon leurre est
une erreur que quelqu'un pourrait réellement commettre.

### Deux interdits

**Ne jamais inventer un fait pour allonger un leurre.** L'erreur a été commise : pour
équilibrer une question, un binôme inexistant a été écrit — *Tullimonstrum gregarium
bolti*. Une correction de forme ne vaut jamais une faute de fond, et cette application
s'adresse à quelqu'un qui vérifie. Si aucun leurre réel n'est assez long, **on laisse la
question déséquilibrée** : une question sur vingt devinable coûte moins cher qu'un faux
taxon. `qc.js` refuse tout binôme dont le genre appartient à l'atlas mais dont l'espèce
n'y figure pas.

**Ne pas toucher aux questions déjà équilibrées.** Environ la moitié d'un chantier l'est
naturellement — noms d'espèces, dates, termes techniques, dont les options sont de
longueur comparable. Les réécrire n'améliore rien et multiplie les occasions d'erreur.

### Ce que les outils vérifient

    node tools/qcm.js              mesure les biais, par banque et par chantier
    node tools/qcm.js --pires      les vingt questions les plus déséquilibrées
    node tools/qcm.js --banque <id>  le détail d'une banque

`qc.js` fait échouer la livraison si l'une de ces conditions n'est plus tenue :

| Assertion | Seuil |
|---|---|
| chaque **chantier** et chaque **banque** | clé la plus longue ≤ 25 %, ratio ≤ 1,10 |
| corpus entier | ≤ 25 % |
| corpus entier | ratio longueur clé / leurres ≤ 1,10 |
| toute question | quatre choix distincts, clé incluse |
| toute option | aucun binôme inventé |
| `data.js` | chaque bloc de correction présent dans l'assemblage |

Les seuils s'appliquent uniformément : plus aucune banque ni aucun chantier n'échappe
à la cible de 25 %.

Une dernière assertion tient un défaut d'une autre nature : **des sentinelles
d'appariement**. Quelques couples question/réponse connus sont vérifiés nommément, parce
qu'une réécriture d'options peut produire des données formellement valides — quatre
choix distincts, clé incluse — dont les réponses ne correspondent plus aux questions.

### Un biais secondaire, non traité

Environ **17 % des questions ont un leurre contenant un absolu** — « toujours »,
« jamais », « aucun » — quand la clé n'en a pas. C'est un indice exploitable, plus faible
que le biais de forme. Sa correction demande un arbitrage : « les apparences sont
toujours trompeuses » est un leurre tentant *parce qu'*il est absolu. Mesuré par
`qcm.js`, laissé en l'état.

## Fouille, troisième passe — v37

`DEV`, `KAR2` et `LUO` traités : **60 % → 10 %** chacun.

**Vingt-et-un chantiers sur vingt-trois** sont désormais sous la cible, et le corpus
entier passe pour la première fois au-dessous des 25 % visés.

| | avant v29 | maintenant |
|---|---|---|
| Global | 67 % · 1,76 | **20 % · 1,08** |
| Les douze packs | 38–100 % | **3–35 %** |
| Fouille | 69 % · 1,75 | **19 % · 1,09** |

Restent `YIX` (73 %) et `HUN` (63 %), les deux seuls chantiers à quarante questions :
80 questions.

### Deux défauts trouvés dans mon propre travail

**Un rapport faux en v36.** La liste des « chantiers restant à reprendre » annonçait
douze chantiers et 280 questions, dont `NEM` à 80 % et `GIL` à 80 %. C'était périmé :
ces chantiers étaient déjà traités. J'ai recopié une sortie d'outil sans la recouper,
et le README de la v36 comme le compte rendu associé sont faux sur ce point. Le vrai
reste, à ce moment-là, était de cinq chantiers et 140 questions.

**Un bloc de travail à deux doigts de disparaître.** `data.js` est un assemblage de
blocs concaténés dans un ordre documenté au README. En éditant cette ligne, je l'avais
arrêtée à `23` alors que les blocs `24` et `25` existaient. Le fichier livré était
correct — il avait été assemblé avec le bon ordre — mais **toute reconstruction à partir
de la documentation aurait silencieusement effacé quatre chantiers de corrections**, sans
qu'aucune vérification ne s'en aperçoive : les données seraient restées valides, seules
les corrections se seraient évaporées.

L'ordre est rétabli, et **neuf assertions vérifient désormais que chaque table de
correction est présente dans le fichier assemblé**. C'est le genre de défaut qui ne se
voit qu'une fois le travail perdu.

Le plafond global passe de 36 % à 28 %.

## Fouille, deuxième passe — v36

Les quatre chantiers les plus atteints, pris en priorité.

| Chantier | avant | après |
|---|---|---|
| `JUR` Faune de Zhenghe | 95 % | **0 %** |
| `MES` Fosse de Messel | 95 % | **0 %** |
| `HC` Hell Creek | 90 % | **20 %** |
| `MAZ` Mazon Creek | 80 % | **5 %** |

**Onze chantiers sur vingt-trois** sont désormais traités, et `qc.js` les tient tous à
un seuil ferme.

### Une erreur commise en cours de route

Pour allonger un leurre trop court, j'ai écrit **« Tullimonstrum gregarium bolti »** —
un binôme qui n'existe pas. C'est exactement le genre de correction qui vaut moins que
le défaut qu'elle répare : un nom d'espèce inventé dans une application de paléontologie
est une faute, un biais de longueur n'est qu'un défaut de forme.

L'option est revenue à un taxon réel, et **une assertion interdit désormais le cas** :
tout binôme dont le genre appartient à l'atlas mais dont l'espèce n'y figure pas est
signalé. C'est presque toujours une fabrication.

Le chantier concerné reste à 5 % — au-dessous de la cible — parce qu'aucun taxon réel du
gisement n'est plus long que la bonne réponse. Une question sur vingt reste donc
devinable à la longueur, et c'est le bon arbitrage.

### Où en est l'ensemble

| | avant v29 | maintenant |
|---|---|---|
| Global | 67 % · 1,76 | **35 % · 1,28** |
| Les douze packs | 38–100 % | **3–35 %** |
| Fouille | 69 % · 1,75 | **41 % · 1,40** |

Douze chantiers restent, 280 questions :

    NEM 80 % · GIL 80 % · CAR 75 % · YIX 73 % · SAM 70 % · MOR 65 %
    WHA 65 % · HUN 63 % · DEV 60 % · KAR2 60 % · LUO 60 % · NWE 55 %

Le plafond global passe de 44 % à 36 %.

## Fouille, première passe — v35

Troisième passe sur les QCM, cette fois sur les 500 questions des chantiers. Elles
portent la boucle principale et font les deux tiers du corpus.

**Sept chantiers sur vingt-trois sont traités**, dans l'ordre de la frise — ce sont les
premiers que l'on rencontre.

| Chantier | après |
|---|---|
| `EDI` Côte d'Hiver | **0 %** |
| `TRI` Anti-Atlas | **5 %** |
| `BURG` Burgess | **10 %** |
| `ORD` Fezouata | **10 %** |
| `CEP` Yezo | **10 %** |
| `SIL` Marches galloises | **15 %** |
| `CHO` Bear Gulch | **15 %** |

Constat utile pour la suite : dans un chantier, **la moitié environ des questions étaient
déjà équilibrées** — noms d'espèces, dates, termes techniques, dont les options sont
naturellement de longueur comparable. Seules les autres ont été reprises, ce qui réduit
le travail réel et limite les occasions d'introduire une erreur.

La règle opératoire s'est précisée à l'usage : il ne suffit pas de raccourcir la clé, il
faut qu'**au moins un leurre soit plus long qu'elle**. Tant que la bonne réponse reste la
plus longue, même de peu, choisir la ligne la plus longue demeure un pari gagnant. C'est
ce qui a permis de descendre `EDI` à zéro.

### Où en est l'ensemble

| | avant v29 | maintenant |
|---|---|---|
| Global | 67 % · 1,76 | **44 % · 1,40** |
| Douze packs de la Bourse | 38–100 % | **3–35 %** |
| Fouille | 69 % · 1,75 | **55 % · 1,57** |

`qc.js` tient désormais chaque chantier repris à un seuil ferme, **et affiche à chaque
passage la liste de ceux qui restent, classés par gravité** :

    JUR 95 % · MES 95 % · HC 90 % · MAZ 80 % · NEM 80 % · GIL 80 % · CAR 75 %
    YIX 73 % · SAM 70 % · MOR 65 % · WHA 65 % · HUN 63 % · DEV 60 % · KAR2 60 %
    LUO 60 % · NWE 55 %

Seize chantiers, 360 questions. Le plafond global passe de 54 % à 44 %.

## Toute la Bourse rééquilibrée — v34

Deuxième passe sur les biais de QCM, après le constat de la v29. Le signalement était
plus large que je ne l'avais traité : **ce n'est pas seulement la longueur, c'est le
format**. La clé était une PROPOSITION, les leurres des GROUPES NOMINAUX. La forme
suffisait à trancher sans lire une ligne.

Plusieurs leurres étaient en outre des non-réponses — « Aucun problème, c'est exact »,
« Il n'y en a pas », « Les cartes ne varient jamais », « Rien : elle est exacte » — qui
ne leurrent personne et réduisaient de fait le choix à trois.

### Les six banques restantes

| Banque | avant | après |
|---|---|---|
| `histscol` | 95 % · 2,23 | **15 % · 1,02** |
| `arteu` | 95 % · 2,22 | **25 % · 1,00** |
| `geographie` | 65 % · 2,05 | **20 % · 1,03** |
| `lecture` | 70 % · 1,94 | **20 % · 1,08** |
| `philosophie` | 90 % · 1,92 | **5 % · 0,91** |
| `artmonde` | 95 % · 1,86 | **20 % · 0,98** |

Avec `philomonde` et `biologie` traitées en v29, **les douze packs de la Bourse sont
faits**. La cible de 25 % est atteinte ou dépassée partout.

Dans `lecture`, une partie des réponses tenait déjà en un mot — « narratif »,
« interne », « le lendemain ». Ces items étaient équilibrés et n'ont pas été touchés :
seuls l'ont été ceux dont la clé était une proposition.

`qc.js` tient désormais les onze banques à un **seuil ferme**, et le plafond global
passe de 66 % à 54 %.

### Trouvaille répétée

`arteu`, `philosophie` et `artmonde` avaient été écrits **sans champ `n`**, comme
`biologie` avant elles — quatre banques sur douze. L'interface affichait « undefined »
au numéro de question. Toutes sont numérotées à l'exécution.

### Ce qui reste

**Les 500 questions de fouille**, à 69 % et ratio 1,75. Elles portent la boucle
principale et représentent les deux tiers du corpus : c'est elles qui tiennent le
chiffre global à 53 %. Elles se découpent en 23 chantiers d'une vingtaine de questions,
ce qui permet des passes vérifiables une par une.

Un biais secondaire subsiste également : **16 % des questions ont un leurre contenant un
absolu** quand la clé n'en a pas. Il est plus faible que le biais de format, et sa
correction demande un arbitrage — « les apparences sont toujours trompeuses » est un
leurre tentant précisément parce qu'il est absolu. À traiter après la fouille.

## Sauvegarde qui survit à une réinstallation — v33

Question posée : en désinstallant puis réinstallant, récupère-t-on sa sauvegarde ?
**Non.** Et l'état antérieur rendait la perte facile.

### Ce qui est vrai du stockage

Les parties vivent dans le stockage local d'un navigateur, sur un appareil. Il en
découle trois choses qu'il valait mieux dire dans l'application plutôt que de laisser
découvrir :

- **désinstaller efface ce stockage**, sans recours ;
- **l'application installée et le navigateur ne partagent pas forcément le même
  espace** — c'est systématiquement le cas sur iPhone, où une application ajoutée à
  l'écran d'accueil reçoit son propre stockage. D'où deux progressions distinctes pour
  ce qui semble être la même application ;
- **forcer la mise à jour, en revanche, ne touche à rien** : elle ne vide que les
  caches de fichiers et désinscrit le service worker. Une assertion vérifie que cette
  fonction ne mentionne aucune clé de stockage.

### Ce qui a changé

**L'export ne portait que la partie active.** Avec deux parties il fallait deux
fichiers, et se souvenir de faire les deux. `paquetComplet()` porte désormais
l'ensemble dans un seul fichier, et la restauration le rétablit d'un coup. Les exports
d'une seule partie déjà téléchargés restent acceptés — c'est justement le fichier qu'on
retrouve quand on en a besoin.

**Restaurer ajoute, n'écrase jamais.** Un fichier qui ne serait pas le bon ne peut pas
détruire ce qui est en place.

**Le menu dit désormais où l'on en est** : date de la dernière sauvegarde en clair
(« hier », « il y a trois jours », « jamais » en couleur d'alerte, comme au-delà d'un
mois), contexte d'exécution — application installée ou navigateur, ce qui permet
d'identifier laquelle des deux progressions on est en train de regarder — et la phrase
qui manquait : désinstaller efface définitivement.

### Le scénario est éprouvé

`tools/profils_test.js` rejoue le cycle complet sur un stockage simulé : deux parties
avec des progressions distinctes, sauvegarde, effacement total du stockage, puis
restauration. Il vérifie que les deux parties reviennent, que les noms et les crédits
sont intacts, qu'un fichier de l'ancien format passe encore, et qu'une restauration
ajoute sans écraser.

**La marche à suivre avant de désinstaller** tient en une ligne : menu ⚙ →
« Sauvegarder toutes les parties », garder le fichier, puis « Restaurer depuis un
fichier » après réinstallation.

## Icônes nommées par empreinte — v32

Question posée après la v30 : une icône déjà installée se met-elle à jour toute seule ?
**Non, et telle que c'était fait, jamais.**

Ce qui se mettait à jour, c'était le fichier dans le cache de l'application. L'icône
posée sur l'écran d'accueil est autre chose : le système en fait une copie au moment de
l'installation.

Sur Android, Chrome revérifie périodiquement le manifeste et réinstalle l'icône seul —
mais il compare le **contenu du manifeste**, pas les octets des images. Les icônes
s'appelaient `icone-192.png` : même URL, contenu différent, Chrome ne voyait rien à
faire. L'ancienne icône serait restée indéfiniment.

### La correction

`tools/icone.py` nomme désormais chaque fichier d'après une empreinte de son contenu —
`icone-192.43a10919.png`. Changer d'illustration change le nom, donc le manifeste, donc
Chrome détecte la modification. L'outil met à jour d'un seul geste les quatre endroits
qui doivent concorder : les fichiers sur le disque, `manifest.json`, la liste du service
worker, et la balise `apple-touch-icon` d'`index.html`.

Onze assertions vérifient cette concordance, dont deux nées d'erreurs commises en
écrivant ce correctif : la première version du nettoyage ne retirait les anciennes
entrées qu'en début de ligne et laissait deux références mortes dans `sw.js` — or
`cache.addAll` précharge la liste d'un bloc, et **un seul fichier manquant fait échouer
l'installation entière du service worker**. La seconde oubliait `apple-touch-icon`,
que Safari lit à la place du manifeste, ce qui aurait laissé l'iPhone sur une référence
morte et donc une icône générique.

### Ce que cela ne résout pas

| | Comportement |
|---|---|
| **Android** | Chrome revérifie le manifeste environ une fois par jour d'usage et réinstalle l'icône sans rien demander. L'empreinte est ce qui le déclenche. |
| **iPhone** | Safari fige l'icône à l'ajout à l'écran d'accueil et ne la met **jamais** à jour. Il faut retirer le raccourci et le rajouter. |

Aucun code ne contourne le second cas : c'est une limite de la plateforme.

## Versions dans le menu — v31

Le menu affichait « Version v2 », qui est en réalité la version du **format de
sauvegarde** : elle ne bouge que si la structure d'un export change, et n'a rien à dire
sur la fraîcheur du code. Elle est conservée sous son vrai nom, en pied de panneau.

À sa place, **trois nombres**, parce que trois choses peuvent diverger alors que le
symptôme est le même — une application qui ne change pas après un déploiement.

| Ligne | Ce qu'elle dit |
|---|---|
| **Application** | la version du code effectivement chargé |
| **Cache hors ligne** | ce que le service worker garde sous la main ; s'il reste en retard, c'est lui qui sert des fichiers périmés |
| **Sur le serveur** | ce qui est en ligne |

La troisième est lue **directement dans `sw.js`, hors de tout cache** — `cache:'no-store'`
pour le cache HTTP, et un paramètre d'horodatage pour que le service worker ne
reconnaisse pas la requête. Sans ces deux précautions, on demanderait au cache s'il est
à jour.

Une phrase conclut, et l'ordre de lecture privilégie ce qui est réparable sur place :
cache en retard d'abord, puis réseau injoignable, puis version disponible, puis « tout
est à jour ». Le panneau s'ouvre immédiatement ; les deux lignes qui demandent un
aller-retour se remplissent ensuite.

### Le risque que cela crée, et sa parade

La version est désormais écrite à deux endroits qui doivent concorder : `VERSION` dans
`sw.js` et `VERSION_ATLAS` dans `app.js`. Les laisser diverger produirait exactement la
panne que ce bloc sert à diagnostiquer.

`node tools/version.js +` les porte toutes les deux d'un coup, `node tools/version.js`
affiche leur état, et **`qc.js` refuse un désaccord**. `tools/version_test.js` rejoue la
cascade de diagnostic dans ses neuf situations, dont deux qui se trompent facilement :
un cache en retard *et* un serveur en avance doit faire réparer le cache d'abord, et la
comparaison doit être numérique — `v9` est antérieure à `v30`, ce qu'une comparaison de
texte affirmerait à l'envers.

### Correction annexe

L'assertion qui vérifie que tout `$('#id')` d'`app.js` correspond à un élément réel
tenait une **liste figée** des identifiants créés dynamiquement. Elle oubliait donc
chaque nouvel ajout et signalait un faux défaut. Elle relève maintenant les deux
sources : le markup statique et les gabarits d'`app.js`.

## Chantier périmé et nouvelle icône — v30

### Une créature déterrée restait verrouillée sur son chantier

Signalé depuis un playtest : le mosasaure de Bernissart, une fois trouvé, apparaissait
bien dans la Collection mais restait « non découvert » sur son chantier. Les données
étaient saines — NWE contient bien ses six créatures, image comprise.

**C'était une régression introduite en v19.** Après une découverte, le bouton principal
« Consulter la fiche » bascule vers la Collection sans reconstruire le chantier. Et
depuis la v19, revenir à l'onglet Fouille *réaffichait* le chantier conservé au lieu de
le *régénérer* — pour éviter de renvoyer à la carte du monde et faire refaire tout le
chemin. Les deux décisions étaient bonnes séparément ; ensemble elles montraient un
écran daté d'avant la trouvaille.

Correction en deux points : `montrer('fouille')` reconstruit le chantier au lieu de le
réafficher, et `fermerReveal()` le régénère dans les deux branches, y compris quand on
part consulter la fiche. Un balayage vérifie que les trois onglets se reconstruisent —
Collection et Bourse le faisaient déjà.

### Icône

Régénérée depuis **HC-01, Tyrannosaurus rex** (`python3 tools/icone.py HC-01 --haut 18`).

Le choix a été mesuré plutôt que deviné, sur les trois propriétés qui décident de la
lisibilité d'une icône à 64 px : contraste, énergie de contour, et surtout **répartition
du détail vers le centre** — Android rogne les icônes maskables en cercle, et ce qui
touche les bords disparaît. Le T. rex obtient la meilleure masse centrale (1,00) pour un
contraste comparable aux autres candidats. Le Dilophosaurus avait plus de contour mais
débordait vers les bords.

Pour en changer, une commande suffit : `python3 tools/icone.py <ID> --haut <%>`, puis
`--apercu` pour contrôler sans rien écrire.

**Trouvaille annexe** : `icone-maskable-512.png` était déclarée au manifeste mais absente
du cache hors ligne. Une assertion vérifie désormais que toute icône du manifeste est à
la fois présente sur le disque et dans la liste du service worker.

## Biais de QCM — v29

Sur les 752 questions à choix, **la bonne réponse était la plus longue des quatre dans
67 % des cas**, contre 25 % attendus au hasard, et 1,76 fois plus longue que la moyenne
des leurres. On pouvait répondre juste deux fois sur trois en choisissant la ligne la
plus longue, sans rien connaître au sujet — une application censée apprendre quelque
chose entraînait à deviner.

La cause est une dissymétrie de forme, pas de contenu : la clé était rédigée comme une
proposition complète portant la nuance, les leurres étaient de courts groupes nominaux
parfois franchement absurdes — « Des plumes » face à une réponse de quatre-vingt-treize
caractères. Deux biais secondaires s'y ajoutent : **17 % des questions ont un leurre
contenant un absolu** (« jamais », « aucun ») quand la clé n'en a pas, ce qui le désigne
comme faux ; et 3 % voient la clé reprendre des mots rares de l'énoncé.

**La position n'est pas en cause.** `app.js` mélange les options à chaque affichage par
un Fisher-Yates complet : l'ordre du fichier n'atteint jamais la joueuse. Trois
assertions vérifient que ce mélange reste en place.

### Trois règles de correction

1. La clé est ramenée à une réponse, la nuance passant dans l'explication.
2. Les leurres deviennent parallèles à la clé — même nature grammaticale, longueur du
   même ordre, contenu plausible pour qui a mal révisé plutôt qu'absurde.
3. Au moins un leurre est plus long que la clé, pour que la ligne la plus longue cesse
   d'être un pari gagnant.

| Banque | avant | après |
|---|---|---|
| `philomonde` | 100 % · ratio 2,50 | 35 % · ratio 1,11 |
| `biologie` | 85 % · ratio 2,33 | 35 % · ratio 1,04 |

### Ce qui reste

**Sept banques, 620 questions**, dont les 500 de fouille qui portent la boucle
principale. `tools/qcm.js` les mesure et les classe, `--banque <id>` sort le détail,
`--pires` les vingt cas les plus déséquilibrés. `qc.js` affiche le reste à faire à
chaque passage et **refuse toute aggravation** : seuil ferme sur les banques reprises,
plafond global sur l'ensemble. Le travail se fait à la main, question par question —
un leurre plausible ne se génère pas.

### Trouvaille annexe

Les vingt items de `biologie` avaient été écrits **sans champ `n`** : l'interface
affichait « undefined » partout où le numéro est repris. Ils sont numérotés à
l'exécution, dans `data_bloc18.js`.

## Dégraissage et réécriture des rappels — v28

L'écran d'un pack portait un objectif, une jauge, une ligne de statistiques et un
barème avant d'arriver au bouton. Ne restent que l'icône, le titre, le sous-titre, un
gros bouton et le rappel replié — la progression reste lisible sur la carte du pack.
Sont partis aussi le paragraphe d'explication en tête de Bourse et la note du groupe
scolaire, redondants avec ce qui les entoure.

Les douze **rappels théoriques sont réécrits en prose suivie** (`data_bloc17.js`). Ils
étaient bâtis en rubriques capitalisées — un catalogue qu'on parcourt sans le lire.
Chacun part désormais d'un cas concret, déroule, et se referme sur ce qui reste ouvert.
Aucun fait retiré ; trois mille caractères gagnés, non pas de matière mais de liant.
Trois assertions par pack vérifient qu'aucun ne retombe en liste.

## Rendu hors Chrome — v27

Quatre signalements depuis un iPhone, tous dus à un rendu tenu pour acquis.

### Étiquettes de carte

Les étiquettes reposaient sur un **contour de texte épais** posé derrière les
glyphes (`paint-order:stroke`) en guise de fond. Chrome le dessine finement, Safari
l'épaissit au point d'empâter les lettres — et d'autant plus que la ligne est longue,
ce qui explique exactement le symptôme : « Fezouata » restait lisible, « zoomer pour
ouvrir » ne l'était plus.

Plutôt que de chercher le bon réglage de contour moteur par moteur, une **plaque
opaque** est posée derrière les deux lignes. Sa largeur est estimée d'après le nombre
de caractères : SVG ne mesure pas un texte avant de l'avoir rendu, et une estimation
large coûte moins qu'un reflow par épingle à chaque déplacement de la carte. Grappes
et sites partagent désormais la même fabrique d'étiquette.

### Flèches et croix

Le retour était le caractère « ← », la fermeture de fiche « ✕ » : deux glyphes dont le
dessin dépend de la police du système. Remplacés par des **tracés SVG**, identiques
partout. Un balayage a trouvé deux autres boutons dans le même cas — le retour du
détail de pack et celui de la mission.

**Et le bouton de fermeture de fiche n'avait aucune règle CSS**, donc l'apparence par
défaut du navigateur. Il figurait dans une liste que j'avais écartée comme du bruit
deux versions plus tôt ; le contrôle refait sur les seules classes ne laisse que
`zsc`, marqueur lu par le JS. **Ce contrôle est désormais une assertion** : toute
classe employée doit avoir une règle.

Le retour de chantier est aussi **répété en bas de page**, là où l'on arrive après
avoir parcouru les vignettes.

### Introduction : balayage et retour

Un enchaînement de volets sans retour oblige à tout relire depuis le début pour
retrouver une phrase. Trois accès désormais : **balayage horizontal**, bouton
**Précédent**, et **pastilles cliquables** — elles indiquaient la position sans y
mener, ce qui est une promesse non tenue. Le balayage exige 45 px et une dominante
horizontale, pour ne pas se déclencher sur un défilement du texte.

### Nom d'espèce et groupe

« Prognathodon saturator » puis « Mosasaure prognathodontidé » se suivaient sans que
rien ne dise laquelle des deux dénominations était laquelle. Les deux portent
maintenant leur étiquette, dans le même registre que la liste Période / Découvert en /
Site qui suit. La carte de révélation d'une créature préfixe également « Groupe : ».

## Reprise d'interface — v26

Trois défauts vus sur téléphone, une fois la feuille de style enfin servie.

### Texte rogné dans les panneaux

`.md-panneau` n'avait **aucune marge intérieure**. La fiche de créature s'en sortait
parce qu'elle porte la sienne dans `.md-txt`, sous une image en pleine largeur — mais
le guide et le menu injectent leur contenu directement dans le panneau, où il venait
butter contre le bord et déborder des deux côtés.

`#guide-corps` et `#reglages-corps` reçoivent donc leur propre marge, **et une hauteur
bornée avec défilement** : sans elle, un panneau plus haut que l'écran était coupé net,
sans recours. Deux assertions verrouillent les deux points.

Un balayage a listé tous les conteneurs remplis par `innerHTML` pour vérifier qu'ils
héritent d'une marge : les autres passent par `.ecran` ou par leur parent.

### Chevauchement dans les en-têtes de la Bourse

Le complément tarifaire d'un titre de groupe était en `float:right`. Le flottant
s'échappait du titre, et le paragraphe suivant s'enroulait autour jusqu'à se
superposer. `h3.grp` devient une boîte flexible : les deux éléments tiennent sur une
ligne et passent proprement à la ligne quand la largeur ne suffit plus.

### Menu de la partie

C'était cinq pastilles identiques empilées, sans hiérarchie. Refait en **liste
groupée** :

- une **vignette** — la dernière créature déterrée, comme sur l'écran de choix — et le
  nom de la partie ;
- **trois chiffres** côte à côte : créatures, chantiers, crédits ;
- les actions **séparées par familles** dans trois blocs distincts : changer de partie
  et renommer ; exporter et importer ; forcer la mise à jour. Chacune porte une icône
  et une ligne qui dit ce qu'elle fait — « Crée toujours une nouvelle partie » sous
  l'import évite d'avoir à lire un paragraphe en bas de panneau ;
- la **suppression à l'écart**, sans cadre, en retrait, dans la couleur d'erreur.

Les règles `.rg-ligne` de l'ancienne présentation ont été retirées ; plus aucune classe
CSS n'est orpheline.

## Le bug qui faussait tous les tests — v25

Un playtest sur téléphone a montré un écran d'accueil sans aucun de ses styles :
titre en sans-serif, champ de saisie brut, superposition qui ne couvrait pas l'écran.
Le CSS était pourtant présent, valide et complet. **Le problème était le service
worker, et il fausse rétrospectivement une partie des tests précédents.**

### Le mécanisme

`index.html` était servi **réseau d'abord**, tout le reste **cache d'abord**. Au
moment où la page fraîchement téléchargée réclame `styles.css`, le service worker
encore actif est l'ANCIEN — le nouveau n'est installé qu'après ce chargement. Il
répond donc avec sa copie périmée. Résultat garanti à chaque déploiement : markup
neuf, feuille de style d'une version antérieure. Et comme le défaut ne se voit qu'au
premier chargement suivant la mise en ligne, c'est exactement celui qu'on fait pour
tester.

Second défaut, plus discret : `caches.match(req)` sans portée cherche dans **tous**
les caches de l'origine, anciens compris.

### La correction

- Le **code** — html, css, js, json — passe au **réseau d'abord**, avec repli sur le
  cache et une attente bornée à 3,5 s. Une version en ligne est ainsi toujours
  cohérente avec elle-même.
- Les **images** restent en **cache d'abord** : elles ne changent qu'en changeant de
  nom, et ce sont elles qui pèsent.
- Toutes les lectures sont bornées à `caches.open(VERSION)`. Aucun cache ancien ne
  peut plus répondre.
- Neuf assertions verrouillent cette stratégie, dont une qui interdit purement et
  simplement `caches.match(` dans le code exécutable.

**Pour débloquer un appareil déjà dans l'état bâtard**, le bouton de mise à jour du
bandeau vide les caches et désinscrit le service worker avant de recharger : c'est
précisément son usage.

### Accueil repris

Markup et styles réécrits, avec trois leçons encodées en assertions :

- le conteneur **défile** — ancré au bas sans recours, le bouton passait sous le bord
  d'un petit écran, ou sous le clavier une fois celui-ci ouvert ;
- les tailles de titre sont en **`clamp()`**, pour ne pas déborder à 360 px ;
- le voile combine un dégradé vertical et une **vignette radiale**, pour que le texte
  reste lisible quelle que soit l'illustration choisie.

Le champ et le bouton ont désormais un style explicite plutôt que l'apparence par
défaut du navigateur. Et **le focus automatique est retiré** : il ouvrait le clavier
aussitôt, masquant l'illustration qui est la seule raison d'être de cet écran.

### Revue des étapes précédentes

Trois défauts trouvés en relisant, dont deux jamais signalés :

- **L'introduction des chantiers avait le même piège de mise en page.** Son volet le
  plus long fait 558 caractères, soit plus de 400 px de texte : ancré au bas sans
  défilement, le haut devenait inatteignable sur un petit écran. Corrigé de la même
  façon, et un balayage systématique confirme qu'aucun autre conteneur de texte n'est
  dans ce cas.
- **`--ocre-sombre` était employée sans être déclarée.** Elle avait une valeur de
  repli, donc rien ne se voyait — mais une variable absente fait tomber une règle en
  silence. Une assertion vérifie désormais que toute variable employée est déclarée.
- Une assertion que je venais d'écrire était elle-même fautive : son expression
  régulière gloutonne traversait `</main>`. Corrigée.

## Choix de la partie — v24

Un écran « Qui joue ? » au lancement, sur le modèle des sélecteurs de profil
habituels, mais **entièrement local et sans mot de passe** : il n'y a pas de compte
à protéger, seulement une méprise à éviter — jouer une heure sur la partie de
quelqu'un d'autre ne se voit qu'après coup.

**Il n'apparaît qu'à partir de deux parties.** Avec une seule, ce serait une
formalité qui retarde l'entrée : l'application ouvre directement.

**La vignette d'une partie est la dernière créature qu'elle a déterrée.** Personne
n'a d'avatar à choisir : on reconnaît sa partie à ce qu'on y a trouvé, et la vignette
change au fur et à mesure. Une partie neuve montre un losange vide. L'aperçu lit
directement la clé d'état du profil concerné sans toucher à la partie en cours.

Le panneau ⚙ renvoie désormais vers ce même écran plutôt que d'afficher une seconde
liste : deux listes de profils concurrentes auraient fini par diverger. La branche
correspondante et ses six règles CSS ont été retirées, et `qc.js` vérifie qu'elles ne
reviennent pas.

## Écran d'accueil — v23

Un profil neuf commence par un écran plein cadre : **Helicoprion**, cinq à huit mètres,
avec sa scie de dents enroulée en spirale dans la mâchoire inférieure. On a mis un
siècle à comprendre où cet organe se plaçait. La constante `CREATURE_ACCUEIL` la
désigne ; n'importe laquelle des 151 créatures de l'atlas peut la remplacer en changeant
une ligne.

L'image occupe tout l'écran avec un lent zoom de vingt-quatre secondes, un voile qui
monte du bas, et trois éléments seulement : la phrase, le champ, le bouton.

> **Gronosaures et Trilobytes**
> Prête à remonter les âges et à rencontrer les bêtes les plus invraisemblables qui
> aient jamais existé ?
> *Comment veux-tu qu'on t'appelle ?*

Le nom saisi renomme le profil actif — c'est le même mécanisme que les profils de la
v20, sans dialogue supplémentaire. `nouveauProfil()` ne demande d'ailleurs plus rien :
un profil créé part sur cet écran, qui le nommera dans son propre décor.

Vient ensuite le guide, en trois lignes et un but, puis plus jamais.

**Ce qui est vérifié.** `etat.accueilVu` retient que l'écran a été vu ; un écran
d'accueil qui se rejoue est une punition. Un profil migré d'une version antérieure,
qui a déjà des créatures, ne le voit pas du tout : il sait à quoi il joue. `qc.js`
contrôle que l'écran existe, qu'il demande un nom, qu'il ne se rejoue pas, que le guide
couvre bien les trois onglets et le but, que le nombre de chantiers y est calculé
plutôt qu'écrit en dur, et que l'illustration d'accueil est dans le cache hors ligne.
`tools/profils_test.js` ajoute quatre assertions sur le champ `accueilVu`.

## Accompagnement scolaire — v22

**Douze packs, 252 items de banque.** La Bourse a désormais deux familles déclarées,
et l'objectif de chacune est écrit noir sur blanc :

- **`cat:'histoire'`** — six packs d'intérêt personnel, délibérément au-dessus du
  programme scolaire : philosophie hors d'Europe, philosophie des sciences, les deux
  histoires de l'art, l'histoire du temps profond, la biologie des lignées.
- **`cat:'ecole'`** — six packs d'accompagnement, au niveau du programme de 12-15 ans
  et pas en dessous. Chacun commence son objectif par « Accompagnement scolaire
  (12-15 ans) : … » et son sous-titre porte « Secondaire inférieur ». `qc.js` vérifie
  les deux, pour qu'aucun remaniement ne fasse perdre l'annonce.

L'ordre place l'intérêt personnel devant, comme décidé en v19 : voir la philosophie
en tête plutôt qu'un exercice de conjugaison change ce que l'application a l'air
d'être. La section scolaire porte en revanche une note explicite sous son titre.

### Les trois packs neufs

**📖 Français — lecture** (20). Le pack d'orthographe couvrait l'écriture, pas la
lecture — qui est pourtant la compétence la plus souvent évaluée sans jamais être
nommée. Types de textes, schéma narratif, point de vue du narrateur, fait contre
opinion, thèse-argument-exemple, connecteurs logiques, figures de style, registres,
discours rapporté, présupposé, résumé, paratexte. Les deux dernières questions portent
sur la source d'un chiffre et sur le texte argumentatif déguisé en information.

**🗺️ Géographie** (20). Latitude et longitude, échelle, courbes de niveau, climat et
ses quatre facteurs, diagramme ombrothermique, densité, bassin versant, delta contre
estuaire, tectonique, tropiques, fuseaux horaires. Et la Belgique concrètement : trois
Régions qui ne se superposent ni aux trois Communautés ni aux dix provinces, le relief
des polders à l'Ardenne, le Signal de Botrange, la Meuse et l'Escaut.

Deux questions y font ce que le reste de l'application fait partout : **la projection
de Mercator gonfle les surfaces vers les pôles**, et deux cartes du même territoire
peuvent orienter la lecture par leurs seuls choix de couleurs et de cadrage. Une carte
est un discours — ce qui vaut aussi pour celle de l'atlas.

**📜 Histoire** (20). Les cinq périodes et leurs bornes conventionnelles, source
primaire contre secondaire, critique de source, puis les repères : écriture
mésopotamienne, démocratie athénienne et ses exclus, féodalité, imprimerie, Réforme,
absolutisme, 1789, révolution industrielle, indépendance belge de 1830 et l'élargissement
du suffrage jusqu'en 1948.

Trois questions portent sur le vocabulaire lui-même : **« Moyen Âge » a été forgé par
des lettrés de la Renaissance** pour désigner un entre-deux méprisé ; « découverte de
l'Amérique » fait des habitants du continent un décor ; et la différence entre un fait
établi par les sources et une interprétation qui se discute. Elles sont au programme,
et ce sont les plus utiles pour aider un élève à réfléchir plutôt qu'à réciter.

### Deux collisions réglées au passage

`BAREME` était indexé sur `p.cat` avec un repli silencieux : la catégorie `ecole`
aurait été tarifée par défaut sans que rien ne le signale. Une entrée lui est ajoutée,
et `qc.js` vérifie désormais que chaque famille a son barème. Et l'icône 🧭 était prise
par la philosophie des sciences ; la géographie reçoit 🗺️.

## Images d'art — v21

Les six illustrations sont en place, en WebP, pour 1,0 Mo au total. Elles sont dans le
cache du service worker, donc disponibles hors ligne, et `qc.js` vérifie qu'elles
existent, qu'elles sont en WebP, qu'elles sont cachées et que **chacune est nommée
dans `art/CREDITS.md`** — un crédit qui ne dit pas ce qui est affiché ne vaut rien.

**Trois des six fichiers ne sont pas les œuvres initialement visées.** Ils conviennent
tous à la question qu'ils accompagnent, mais les crédits décrivent ce qui est
réellement montré :

| Prévu | Affiché |
|---|---|
| *Cliffs at Pourville*, 1882, National Gallery of Art | *Falaise de Pourville, le matin*, 1897 (W. 1442) |
| *The Japanese Footbridge*, 1899, National Gallery of Art | *Les Nymphéas et le pont japonais*, 1899, Princeton |
| Estampe Hiroshige numérisée par un fonds public | Reproduction commerciale, marge blanche rognée |

Les deux Monet sont des **toiles différentes**, pas d'autres numérisations des mêmes
toiles : il a peint les falaises de Pourville en 1882 puis de nouveau en 1897, et une
douzaine de vues du pont japonais. Même sujet, objet différent. Le script
`tools/telecharger_art.py` n'est plus nécessaire ; il reste comme manifeste et comme
moyen de refaire la récolte si un fichier se perd.

## Profils locaux — v20

Aucun compte, aucun mot de passe, aucun serveur : tout reste dans `localStorage`.
« Profil » veut seulement dire *une progression séparée*, pour que deux personnes
puissent jouer sur le même appareil sans se marcher dessus.

**Stockage.** `atlas_profils_v1` porte le registre `{actif, liste:[{id,nom,cree,vue}]}` ;
chaque profil a sa propre clé `atlas_etat_<id>`. Une sauvegarde d'avant les profils
devient automatiquement le premier profil, et **l'ancienne clé est conservée telle
quelle** — si quelque chose tournait mal, la progression d'origine serait encore là.

**Le bandeau nomme le profil courant.** C'est la seule chose à l'écran qui distingue
deux progressions : sans elle, on peut jouer une heure sur le mauvais profil sans
s'en apercevoir. Toucher ce nom ouvre le panneau.

**Export et import.** L'export produit un fichier autonome :

```json
{ "app":"gronosaures", "schema":1, "version":"v2",
  "exporte":"2026-07-19T…", "profil":{"nom":"…","cree":…},
  "resume":{"creatures":…,"total":…,"chantiers":…,"credits":…},
  "etat":{ … } }
```

Il porte un numéro de schéma, la version de l'application et un horodatage —
délibérément plus que ce qu'il faut ici. **Une synchronisation distante n'aurait qu'à
transporter cet objet tel quel**, sans que le reste du code change : `paquetProgression()`
produit ce qu'on téléverserait, et le contrôle d'import est déjà écrit (signature de
l'application, schéma non postérieur, normalisation de l'état reçu).

Deux décisions de sûreté. **Un import crée toujours un nouveau profil** plutôt que
d'écraser l'existant : un profil en trop se supprime, une progression écrasée ne se
récupère pas. Et **le dernier profil ne peut pas être supprimé**, sinon il n'y aurait
plus rien où revenir.

**Éprouvé hors navigateur** par `tools/profils_test.js`, qui simule `localStorage` et
vérifie en 22 assertions la migration, la stabilité au rechargement, l'isolation entre
profils, la complétude du paquet d'export et le rejet des fichiers étrangers.

### Passe de polish

- Recherche systématique des clés d'état inexistantes, du genre de celle qui avait
  cassé le bouton ⚙ en v18 : `etat.sites` était la seule, aucune autre ne subsiste.
- Toutes les fonctions appelées depuis un attribut `onclick`, dans `index.html` comme
  dans les gabarits de `app.js`, sont vérifiées comme définies.
- `.bourse-note` et `.carte-wrap` étaient devenues des règles mortes : retirées.
  Plus aucune classe CSS orpheline.
- L'import ne s'appuie plus sur la visibilité d'un `const` global depuis un attribut
  `onclick` — une fonction déclarée, portée par l'objet global, est plus robuste.
- Icône régénérée depuis `HUN-11`, *Palaeocucumaria hunsrueckiana*.

## Retours de playtest — v19

**Le bouton ⚙ ne faisait rien : c'était un bug de ma part.** `ouvrirReglages()`
lisait `etat.sites[s.id]` alors que la clé réelle est `etat.sitesOuverts`. La
lecture levait une exception, le gestionnaire de clic mourait en silence, et rien
ne s'affichait. Le panneau est en outre réduit à son seul usage réel : une
confirmation « Voulez-vous forcer la mise à jour ? » avec Oui / Annuler.

**Bourse.** Les packs étaient bien réordonnés dans `data.js` depuis la v16, mais
`menuPacks()` affichait le groupe `base` avant le groupe `histoire` : le tri des
données était masqué par l'ordre d'affichage. « Histoire et philosophie » passe
devant. La ligne du bas — « l'entraînement rapporte davantage » — était obsolète
depuis l'égalisation des barèmes en v8 : elle est retirée.

**La frise n'est plus un onglet.** Elle devient le quatrième bouton de vue de la
Collection, à côté de Par chantier / Par période / Par famille. Trois onglets au
lieu de quatre, et une vue rarement ouverte cesse d'occuper une place permanente
dans le schéma mental de l'application.

**Zoom minimum de la carte.** Le zoom arrière était borné par la *largeur* de la
carte : sur un téléphone, un viewBox large de 1 535 px devient haut de 2 800 px, et
l'on voyait du vide au-dessus et au-dessous. `maxWDyn()` borne désormais par la
*hauteur* — la carte remplit toujours l'écran. Conséquence assumée : sur un écran
très allongé, on ne peut plus voir toute la largeur du monde d'un coup (viewBox
maximal de 461 px sur un Pixel 8, contre 1 535 auparavant).

**Vignettes de chantier.** Les cases non trouvées portent maintenant « Créature non
découverte » sous le point d'interrogation, comme dans la collection.

**Navigation.** Quitter l'onglet Fouille depuis un chantier puis y revenir rendait
la carte du monde. `montrer('fouille')` ne rappelle plus `vueCarte()` quand
`siteActif` est renseigné : on retrouve l'écran qu'on avait quitté.

## Trois packs — v18

**23 chantiers, 151 créatures, 500 questions.** L'Ordovicien passe de 2 à 8
créatures, et les plantes de 3 à 13 — elles deviennent la quatrième famille de
l'atlas alors qu'elles en étaient l'angle mort.

### Fezouata (ORD) — panorama ordovicien

Ancré sur les schistes de Fezouata, à dix pixels du chantier à trilobites de
l'Anti-Atlas : les deux gisements sont réellement voisins et distants d'une
trentaine de millions d'années. Le zoom profond de la v17 permet à leur grappe de
s'ouvrir. Les six créatures viennent de six pays ; l'intro le dit.

Le fil est la **grande biodiversification ordovicienne**, et son illustration la plus
nette est *Aegirocassis* : un radiodonte de deux mètres qui a converti les appendices
de chasse d'*Anomalocaris* en peignes filtreurs. Même plan corporel, métier opposé.
Second fil : les conodontes, connus pendant plus d'un siècle par leurs seules dents,
qui servaient à dater des roches entières sans qu'on sache à quel animal les
rattacher.

### Gilboa (GIL) — les premières forêts

Premier chantier entièrement végétal. Les souches de Gilboa sont connues depuis 1869
et sont restées **orphelines cent quarante ans** : ce n'est qu'en 2007 qu'une
couronne encore reliée à un tronc a permis de savoir que *Wattieza* poussait dessus.

Le fil dépasse la botanique : les racines profondes d'*Archaeopteris* fendent la
roche, fabriquent du sol, accélèrent l'altération des silicates — donc consomment du
CO₂ — et transforment les rivières en tresses divagantes en méandres stables. Et la
leçon transversale rejoint celle de *Thylacosmilus* : quatre lignées sans parenté
proche atteignent séparément la taille d'un arbre. « Arbre » est une architecture,
pas une famille.

### Yixian étendu (PLA) — les premières fleurs

Les cinq plantes livrées viennent toutes de la formation de Yixian, déjà présente
dans l'atlas. Elles l'étendent donc plutôt que d'ouvrir un chantier : **un chantier
correspond à un gisement, pas à un thème**, comme pour les échinodermes du Hunsrück.
Yixian passe à 13 créatures et 40 questions ; le champ `pack` les regroupe à part
dans la collection.

**Deux corrections sur le lot livré**, l'une et l'autre vérifiées :

- *Sinocarpus decussatus* et *Hyrcantha decussata* sont **la même espèce** — décrite
  sous le premier nom en 2003, recombinée sous le second en 2007 après rapprochement
  avec un fossile du Kazakhstan. Une seule fiche est retenue, sous le nom valide, et
  la synonymie devient une question. L'illustration en double n'est pas utilisée.
- *« Chaoyangia beishanensis »* n'existe pas : c'est un croisement entre le genre de
  la plante et l'épithète d'un **oiseau** du même bassin. La plante est *Chaoyangia
  liangii*. Et elle n'est pas une fleur : publiée en 1998 comme le plus ancien fruit
  d'angiosperme, elle a été reclassée parmi les gnétales — des gymnospermes. Elle
  reste dans le pack pour cette raison même, comme *Darwinius* à Messel.

### Vues satellites provisoires

`sites/ORD.webp` et `sites/GIL.webp` sont des copies de TRI et DEV en attendant les
images définitives, avec les globes du Maroc et de l'Amérique du Nord — donc les bons
continents. Les sites portent `fondProvisoire:true` ; `qc.js` les signale à chaque
passage et refuse d'en compter plus de trois.

## Retours de playtest — v17

**Poids et lenteur.** Tout est passé en WebP : 36 Mo → 18 Mo. Les cartes de créature
sont ramenées à 680 px de large en q74 — le double d'un affichage plein écran de
340 px, donc net sur écran à haute densité, pour 31 % de poids en moins. `qc.js`
vérifie désormais que le total reste sous 20 Mo et que tout est bien en WebP.

**Le bouton sur lequel on appuie deux fois.** C'était un défaut de retour, pas de
vitesse. Trois corrections : `touch-action:manipulation` supprime le délai de 300 ms
que les navigateurs mobiles gardent pour le double-tap ; tous les boutons ont un état
`:active` visible immédiatement ; et la vue satellite d'un site est préchargée dès
l'ouverture de la fenêtre de déblocage, pendant qu'on lit le texte — au moment
d'appuyer, l'image est déjà là.

**Carte à deux vitesses.** `monde-min.webp` (1 535 px, 175 Ko) s'affiche
immédiatement ; `monde.webp` (6 140 px, 1,3 Mo) part en tâche de fond via
`requestIdleCallback` et remplace le fichier léger sans que rien ne bouge à l'écran,
le viewBox étant identique. Seule la version légère est dans le cache initial.

**Onglets** réordonnés en Bourse → Fouille → Collection → Frise. L'onglet courant se
signale par quatre marques et non par une seule teinte : couleur, graisse, fond
éclairci, et un trait plein en haut.

**Contraste.** `--txt3` passe de `#6c7789` à `#93a0b4`. Le voile des vues satellites
ne descendant qu'à 86 %, l'ancien gris passait sous le seuil de lisibilité. `qc.js`
mesure la luminance et exige au moins 0,42.

**Réglages** (bouton ⚙ dans l'en-tête) : version, avancement, et un bouton qui vide
les caches et désinscrit le service worker avant de recharger. La progression vit
dans `localStorage` et n'est pas touchée.

**Icône.** Générée depuis une illustration de l'atlas par `tools/icone.py` :

    python3 tools/icone.py              # liste les créatures
    python3 tools/icone.py MOR-02       # Stegosaurus, choix actuel
    python3 tools/icone.py MOR-01 --apercu --haut 30

`--apercu` écrit une planche montrant le rendu normal, le rendu maskable et le rendu
à 64 px, sans rien écraser. `--haut` déplace la découpe si la tête est coupée.

**Ordre des packs** : philosophie, art, histoire, biologie, puis conjugaison,
orthographe, mathématiques. `qc.js` vérifie que les six packs d'accompagnement
précèdent les trois packs de remise à niveau.

## Télécharger les images d'art — mode d'emploi

`tools/telecharger_art.py` n'utilise **que la bibliothèque standard de Python** :
aucun `pip install`, aucune dépendance. Si `python3 -m http.server 8080` marche chez
toi, celui-ci marche aussi. Il se repère tout seul par rapport à sa propre position,
donc il peut être lancé depuis n'importe quel dossier.

    python3 tools/telecharger_art.py --verifier   # liste, n'écrit rien
    python3 tools/telecharger_art.py              # télécharge

Il écrit dans `atlas/art/` : six .jpg et un CREDITS.md. Rien d'autre n'est touché.
Relancer est sans danger — ce qui est déjà là est laissé tel quel, `--refaire` force.

Le script vérifie que la réponse commence bien par la signature d'un JPEG, pour ne
pas écrire une page d'erreur HTML sous un nom d'image. Les échecs réseau sont
traduits en français : 403 renvoie vers un proxy, 404 vers un identifiant périmé
côté musée, l'absence de réponse vers la connexion.

**Si ça échoue, ce n'est pas bloquant.** `app.js` pose `onerror="this.remove()"` sur
ces images : la question s'affiche sans illustration et rien ne casse.

## Neuvième pack — Philosophie hors d'Europe

Pendant du pack d'histoire de l'art hors d'Europe, même méthode : on ne dresse pas
un inventaire d'exotisme, on regarde comment le canon s'est constitué et qui en a
été tenu dehors. Vingt questions, toutes sourcées.

Trois fils s'y répondent. Des **antériorités** qui dérangent le récit reçu :
l'homme volant d'Avicenne précède le cogito de six siècles, la critique de la
causalité par al-Ghazali précède Hume de six cent cinquante ans, le rêve du papillon
de Zhuangzi précède les Méditations de dix-neuf siècles. Une **exclusion écrite** :
Kant et Hegel n'ont pas ignoré l'Afrique et l'Asie, ils les ont écartées avec des
arguments — la frontière du canon est un acte, pas un constat. Et le **même réflexe
que dans l'art** : Frobenius attribuait Ifé à l'Atlantide parce que c'était trop beau
pour être africain ; Conti Rossini a déclaré le Hatata éthiopien apocryphe en partie
parce que de telles idées ne lui semblaient pas attendues en Éthiopie.

Le pack ne tranche pas ce qui n'est pas tranché. L'authenticité du Hatata reste
ouverte — un volume collectif de De Gruyter lui est consacré en 2024, et le
désaccord traverse les chercheurs éthiopiens comme les occidentaux. Deux questions
le disent explicitement. Une dernière question retourne l'outil contre lui-même :
la catégorie « philosophie non européenne » range ensemble Nagarjuna, Ibn Khaldoun
et les tlamatinime, qui n'ont en commun que de ne pas être grecs.

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
