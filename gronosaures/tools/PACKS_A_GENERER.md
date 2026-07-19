# Trois packs à générer — spécification

Version 1, pour *Gronosaures et Trilobytes*. Format identique à
`06_Index_creatures_MVP_complete.csv` : les six fiches de chaque pack sont prêtes
à y être collées, et `tools/ingest.py` les ingérera sans retouche.

Ce que ce document **ne** contient pas : les vingt QCM par pack, à rédiger ensuite,
et le bloc `SITES` (ancrage, accroche, introduction en cinq volets), qui est la
seule partie écrite à la main.

---

## Pourquoi ces trois-là

L'état des lieux, mesuré sur les 110 créatures actuelles :

| Trou | Constat |
|---|---|
| **Silurien** | 443,8 → 419,2 Ma : **zéro créature**. Vingt-cinq millions d'années vides. |
| **Néogène** | 23 → 2,58 Ma : **zéro créature**. |
| **Quaternaire** | absent de `PERIODES` — la liste s'arrête au Néogène. |
| **Après les dinosaures** | 6 créatures sur 110, toutes des cétacés, un seul site. |
| **Amérique du Sud** | zéro site. Australie, Inde, Antarctique : zéro. |
| **Ordovicien** | 2 créatures seulement. |

Les trois packs ci-dessous comblent le Silurien, le Néogène **et** le Quaternaire,
font passer le Cénozoïque de 6 à 18 créatures, et ouvrent deux continents.

**Modification préalable à `data_bloc2.js`** — ajouter le Quaternaire, sans quoi la
mégafaune sud-américaine tomberait hors classement :

```js
{nom:'Quaternaire', ere:'Cénozoïque', de:2.58, a:0}
```

---

# Pack 1 — `SIL` · Sortir de l'eau

**Nom du pack** : Silurien — Le rivage franchi
**Bornes** : ≈ 428–419 Ma
**Ancrage proposé** : les carrières de la région de Ludlow et des Welsh Borderlands
(Angleterre / pays de Galles), où la stratigraphie du Silurien a été définie au
XIXᵉ siècle par Murchison. Deux des six créatures en proviennent.
**Coordonnées d'épingle** : environ 52,37 N / −2,72 E → à recaler avec `tools/pins.py`.

**Angle** : le Silurien est la période où la vie quitte l'eau — non par conquête
héroïque, mais parce que quelques lignées de plantes et d'arthropodes trouvent
comment ne pas se dessécher. C'est aussi une période courte, discrète, et
systématiquement sautée dans les récits grand public, coincée entre l'Ordovicien et
le Dévonien. Il y a là une leçon de composition à faire passer : les moments décisifs
ne sont pas toujours les plus spectaculaires.

| id | espèce | groupe | âge | lieu | taille | masse |
|---|---|---|---|---|---|---|
| SIL-01 | *Cooksonia pertoni* | Plante vasculaire primitive | ≈ 425 Ma | Shropshire, Angleterre | ≈ 3 cm | non estimable |
| SIL-02 | *Pneumodesmus newmani* | Myriapode, diplopode | ≈ 425 Ma | Stonehaven, Écosse | ≈ 1 cm | non estimable |
| SIL-03 | *Pterygotus anglicus* | Euryptéride ptérygotidé | ≈ 419–412 Ma | Écosse et Angleterre | ≈ 1,6 m | ≈ 10–20 kg |
| SIL-04 | *Eurypterus remipes* | Euryptéride euryptéridé | ≈ 432–418 Ma | État de New York, États-Unis | ≈ 20 cm | ≈ 0,3 kg |
| SIL-05 | *Birkenia elegans* | Agnathe anaspide | ≈ 428–423 Ma | Lanarkshire, Écosse | ≈ 10 cm | non estimable |
| SIL-06 | *Baragwanathia longifolia* | Lycophyte | ≈ 425–410 Ma | Victoria, Australie | ≈ 40 cm | non estimable |

**Notes de génération.**
- *Cooksonia* est une tige nue, dichotomique, terminée par des sporanges : à
  illustrer à contre-jour sur une vasière, pas comme une plante d'appartement. C'est
  l'une des premières plantes vasculaires connues, et elle mesure trois centimètres.
- *Pneumodesmus* est **le plus ancien animal respirant l'air connu** : ses stigmates
  trachéens sont visibles sur le fossile. Un mille-pattes d'un centimètre sur du
  sable humide — l'humilité de l'image fait partie du propos.
- *Pterygotus* est le grand prédateur du lot, avec ses chélicères en pinces
  dentelées. Attention : ne pas le peindre en monstre de couverture. Milieu côtier,
  eau trouble.
- *Eurypterus* est le fossile officiel de l'État de New York — un détail savoureux.
- **Deux plantes sur six** : c'est délibéré et sans précédent dans l'atlas. Aucun
  végétal n'y figure pour l'instant, alors que la colonisation des terres est
  d'abord végétale. Si tu préfères six animaux, remplacer SIL-06 par *Climatius
  reticulatus* (acanthodien, Écosse, ≈ 420 Ma, ≈ 7 cm) — mais on perdrait le point.

---

# Pack 2 — `SUD` · L'île-continent

**Nom du pack** : Amérique du Sud — Le continent séparé
**Bornes** : ≈ 17 Ma – 11 000 ans (Miocène → Pléistocène terminal)
**Ancrage proposé** : la vallée de Luján, province de Buenos Aires, Argentine, où
Manuel Torres exhume en 1787 le squelette envoyé à Madrid. Deux créatures du pack en
proviennent, et c'est le lieu de naissance de la paléontologie sud-américaine.
**Coordonnées d'épingle** : environ −34,57 N / −59,10 E → à recaler.

**Angle** : pendant une trentaine de millions d'années, l'Amérique du Sud est une
île. Des lignées entières y évoluent sans équivalent ailleurs — des ongulés qui ne
sont ni des chevaux ni des ruminants, des marsupiaux prédateurs, des oiseaux au
sommet de la chaîne. Puis l'isthme de Panamá se ferme, les faunes du nord
descendent, et la plupart de ces lignées disparaissent. C'est le Grand
Interchange américain, et c'est l'expérience naturelle la plus nette qui soit sur ce
que l'isolement produit et ce que la connexion coûte.

**Deuxième fil, épistémologique** : c'est ici que naît la science de l'extinction.
Cuvier décrit le *Megatherium* en 1796 sur des dessins et affirme qu'il s'agit d'une
espèce disparue — avant les mosasaures de Maastricht. Et *Macrauchenia* et *Toxodon*,
ramassés par Darwin lui-même, sont restés inclassables cent quatre-vingts ans, jusqu'à
ce que les protéines fossiles tranchent en 2015-2017.

| id | espèce | groupe | âge | lieu | taille | masse |
|---|---|---|---|---|---|---|
| SUD-01 | *Megatherium americanum* | Xénarthre, paresseux terrestre | ≈ 0,4–0,011 Ma | Luján, Argentine | ≈ 6 m | ≈ 4 t |
| SUD-02 | *Glyptodon clavipes* | Xénarthre, cingulé | ≈ 0,8–0,011 Ma | Pampa argentine | ≈ 3,3 m | ≈ 1 t |
| SUD-03 | *Macrauchenia patachonica* | Litopterne macrauchéniidé | ≈ 0,7–0,011 Ma | Patagonie, Argentine | ≈ 3 m | ≈ 1 t |
| SUD-04 | *Toxodon platensis* | Notongulé toxodontidé | ≈ 2,6–0,011 Ma | Argentine, Uruguay, Brésil | ≈ 2,7 m | ≈ 1,4 t |
| SUD-05 | *Phorusrhacos longissimus* | Oiseau phorusrhacidé | ≈ 17–15 Ma | Santa Cruz, Argentine | ≈ 2,5 m | ≈ 130 kg |
| SUD-06 | *Thylacosmilus atrox* | Sparassodonte, métathérien | ≈ 9–3 Ma | Catamarca, Argentine | ≈ 1,2 m | ≈ 100 kg |

**Notes de génération.**
- *Megatherium* debout, appuyé sur sa queue en trépied, à hauteur d'un premier étage.
  Griffes recourbées : il marchait sur le bord externe des pieds.
- *Macrauchenia* : narines placées **haut sur le crâne**, entre les yeux. On en a
  longtemps déduit une trompe ; l'hypothèse est aujourd'hui discutée. À illustrer
  sans trompe marquée, ou avec une mention explicite dans la mise en garde de la
  fiche — c'est exactement le genre de détail sur lequel une reconstitution s'engage
  sans le dire.
- *Thylacosmilus* : canines à croissance continue, **sans lien de parenté avec
  *Smilodon***, arrivé plus tard du nord. La mâchoire inférieure porte deux longues
  brides osseuses qui protègent les canines — absentes chez les félins à dents de
  sabre. C'est la convergence la plus démonstrative de tout l'atlas, à mettre en
  regard du requin et du dauphin du pack Biologie.
- *Phorusrhacos* : bec crochu haut comme une tête de cheval, ailes réduites, pattes
  de coureur. Ne pas en faire un « dinosaure survivant » : c'est un oiseau moderne,
  et son rôle de superprédateur tient à l'absence de carnivores placentaires.
- Deux fiches (SUD-05, SUD-06) sont **néogènes**, quatre sont **quaternaires** : le
  pack comble donc les deux trous d'un coup.

---

# Pack 3 — `MES` · La fosse de Messel

**Nom du pack** : Messel — Quarante-sept millions d'années, intactes
**Bornes** : ≈ 48–47 Ma (Éocène moyen, Lutétien)
**Ancrage** : la fosse de Messel, près de Darmstadt, Hesse, Allemagne. **Les six
créatures en proviennent** — c'est le pack le plus homogène de tout l'atlas, avec le
Hunsrück.
**Coordonnées d'épingle** : environ 49,92 N / 8,76 E → attention, c'est à environ
50 px du Hunsrück : le regroupement d'épingles s'en chargera.
**Note pour Denis** : Messel est à trois heures et demie de route de Liège, et le
site se visite.

**Angle** : un lac de maar, formé par une explosion phréatomagmatique, dont les eaux
profondes restent anoxiques. Rien ne se décompose, rien ne fouille le fond. Ce qui
tombe dedans reste. On y lit le contenu stomacal des chauves-souris, les bactéries de
la peau, la couleur structurale des élytres de coléoptères, et une jument gravide
avec son fœtus en place. Le site a failli devenir une décharge municipale dans les
années 1970 ; il est classé au patrimoine mondial depuis 1995.

**Le fil scientifique** : c'est le monde d'après. Quinze millions d'années après la
disparition des dinosaures non-aviens, les mammifères ont pris les places, mais rien
n'a encore la forme attendue — les chevaux ont la taille d'un chien, les fourmis
celle d'un colibri, et un serpent avale un lézard qui vient d'avaler un insecte.

| id | espèce | groupe | âge | lieu | taille | masse |
|---|---|---|---|---|---|---|
| MES-01 | *Eurohippus messelensis* | Périssodactyle équidé basal | ≈ 47 Ma | Messel, Allemagne | ≈ 60 cm | ≈ 10 kg |
| MES-02 | *Palaeochiropteryx tupaiodon* | Chiroptère | ≈ 47 Ma | Messel, Allemagne | ≈ 25 cm d'envergure | ≈ 10 g |
| MES-03 | *Darwinius masillae* | Primate adapiforme | ≈ 47 Ma | Messel, Allemagne | ≈ 58 cm avec la queue | ≈ 700 g |
| MES-04 | *Titanomyrma giganteum* | Fourmi formicidé | ≈ 47 Ma | Messel, Allemagne | ≈ 5 cm (reine) | non estimable |
| MES-05 | *Messelobunodon schaeferi* | Artiodactyle diacodexéidé | ≈ 47 Ma | Messel, Allemagne | ≈ 60 cm | ≈ 5 kg |
| MES-06 | *Eomanis waldi* | Pholidote, pangolin | ≈ 47 Ma | Messel, Allemagne | ≈ 50 cm | ≈ 3 kg |

**Notes de génération.**
- *Eurohippus* : quatre doigts devant, trois derrière, dos arqué, pas de sabot. Le
  spécimen célèbre est **une femelle gravide dont l'utérus et le ligament placentaire
  sont conservés**. À illustrer en sous-bois dense, pas en prairie — la prairie
  n'existe pas encore.
- *Palaeochiropteryx* : plusieurs spécimens conservent le **contenu stomacal**, ce
  qui a permis d'identifier les papillons de nuit consommés. La forme des ailes
  indique un vol lent sous la canopée. L'écholocation était probablement déjà en
  place.
- *Darwinius* — le fossile « Ida ». Une leçon en soi : présenté en 2009 comme le
  chaînon manquant de l'ascendance humaine, avec conférence de presse, documentaire
  et livre le même jour. La communauté a rapidement établi qu'il s'agit d'un
  adapiforme, du côté des lémuriens, et non de notre lignée. **Le spécimen est
  extraordinaire, la campagne l'a desservi.** À traiter explicitement dans la mise en
  garde : c'est un cas d'école pour le pack Philosophie.
- *Titanomyrma* : une reine de cinq centimètres, envergure alaire de seize. Le genre
  est aussi connu du Wyoming, ce qui a nourri l'hypothèse d'un passage arctique
  pendant un maximum thermique.
- *Eomanis* : un pangolin de quarante-sept millions d'années, avec écailles **et**
  contenu stomacal — insectes et fragments de plantes. Le groupe n'a presque pas
  bougé depuis.
- Toutes les fiches doivent mentionner la **préservation en huile de schiste** : les
  fossiles sortent d'une roche gorgée d'eau qui se fend et s'effrite en séchant. On
  les transfère à la résine époxy dans les heures qui suivent l'extraction. Sans
  cette technique, mise au point dans les années 1960, il n'y aurait pas de
  collection de Messel.

---

## Après génération

1. Coller les 18 lignes dans `06_Index_creatures_MVP_complete.csv`.
2. Livrer les illustrations (18 créatures + 3 vues de site) sous n'importe laquelle
   des trois conventions de nommage reconnues par `ingest.py`.
3. Ajouter le Quaternaire à `PERIODES`.
4. Rédiger 20 QCM par pack dans `tools/quiz_complement.json`, avec liens.
5. Écrire les trois entrées `SITES` — ancrage, accroche, cinq volets, coût.
6. `node tools/qc.js && node tools/smoke.js` → `ÉCHECS (0)`.

L'atlas passerait alors à **21 sites et 128 créatures**, sans période vide entre
l'Édiacarien et aujourd'hui.
