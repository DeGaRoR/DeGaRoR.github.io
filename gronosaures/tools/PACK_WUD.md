# `WUD` — Wuda, la forêt que le volcan a figée

Contenu rédigé, prêt à ingérer dès réception des visuels. Vingt QCM écrits sous les
**règles de rédaction des QCM** et mesurés en fin de document.

---

## Bloc `SITES`

```js
{
  id:'WUD',
  nom:'La forêt que le volcan a figée',
  court:'Wuda',
  region:'Mongolie-Intérieure, Chine',
  pays:'Chine',
  ere:'Permien inférieur, ≈ 298,3 Ma',
  age:'298,34 ± 0,09 millions d’années',
  cout:320,
  accroche:'Une forêt ensevelie debout, sous un mètre de cendres.',
  intro:[ /* cinq volets, ci-dessous */ ]
}
```

Épingle : bassin houiller de Wuda, Mongolie-Intérieure.
Emblème : `WUD-02` Sigillaria — le tronc à cicatrices en sceaux.
Position : après `MAZ` Mazon Creek, avant `KAR2` Karoo.

---

## Introduction en cinq volets

**1. Le lieu**

Un bassin houiller de Mongolie-Intérieure, exploité pour son charbon. Le charbon, ici
comme ailleurs, est une forêt comprimée. La différence, à Wuda, c'est qu'une couche de
cendres volcaniques repose juste au-dessus — et que cette couche a tout changé.

**2. Ce qui s'est passé**

Une éruption a couvert la forêt marécageuse de cendres, très vite. Assez vite pour que
les plantes n'aient pas le temps de tomber, de pourrir, d'être emportées. Elles ont été
ensevelies à peu près là où elles poussaient.

**3. Pourquoi c'est rare**

La plupart des fossiles de plantes sont des morceaux : une feuille, un fragment de tronc,
transportés par l'eau puis déposés loin de leur point de départ. On sait alors quelles
espèces existaient, mais pas comment elles étaient disposées. Ici, on peut relever la
position de chaque plante et reconstituer la forêt : la canopée, le sous-bois, ce qui
grimpait sur quoi.

**4. Ce qu'on y voit**

Plusieurs solutions concurrentes au même problème — se tenir droit et capter la lumière.
Des lycophytes arborescentes au tronc couvert de cicatrices régulières. Des fougères
arborescentes enveloppées de racines. Des parents géants des prêles, creux et
segmentés. Et déjà des plantes à graines, dont une qui grimpait.

**5. Une remarque**

Une des feuilles porte des traces de morsures, des galles et des pontes d'insectes. Ce
n'est pas un détail : c'est la preuve que cette forêt était habitée, et que les relations
entre plantes et insectes que nous connaissons existaient déjà.

---

## Les six fiches

| id | Espèce | Groupe | Taille | Confiance |
|---|---|---|---|---|
| `WUD-01` | *Paratingia wuhaia* | Noeggerathiale | ≈ 3–4 m | bonne |
| `WUD-02` | *Sigillaria* cf. *ichthyolepis* | Lycophyte arborescente | ≈ 10–20 m | bonne |
| `WUD-03` | *Scolecopteris libera* | Fougère marattiale arborescente | ≈ 5 m | bonne |
| `WUD-04` | *Palaeostachya guanglongii* | Sphénophyte, parent des prêles | ≈ 3–5 m | moyenne |
| `WUD-05` | *Pterophyllum* sp. cf. *P. daihoense* | Cycadophyte | feuilles ≈ 30–50 cm | moyenne |
| `WUD-06` | *Wudaeophyton wangii* | Plante à graines grimpante | port lianescent | moyenne |

**WUD-01 — Paratingia wuhaia.** Petit arbre à couronne de feuilles composées, portant des
organes fertiles cylindriques d'aspect conique. Ils produisaient pourtant des spores et
non des graines : c'est précisément ce qui rend les noeggerathiales instructives, elles
ressemblent à ce qu'elles ne sont pas.

**WUD-02 — Sigillaria cf. ichthyolepis.** Lycophyte arborescente au tronc presque
dépourvu de branches, couvert de rangées régulières de cicatrices foliaires en forme de
sceaux. La mention *cf.* signale que l'attribution à l'espèce reste probable et non
établie.

**WUD-03 — Scolecopteris libera.** Fougère arborescente à couronne de grandes frondes.
Son tronc n'est pas du bois : c'est un manteau épais de racines adventives enveloppant
une tige mince, une autre manière de tenir debout.

**WUD-04 — Palaeostachya guanglongii.** Parent géant des prêles actuelles, à tronc creux
et segmenté, branches disposées en verticilles et nombreux cônes reproducteurs. Les
proportions d'ensemble sont reconstituées à partir d'éléments dispersés.

**WUD-05 — Pterophyllum sp. cf. P. daihoense.** Cycadophyte primitive à feuilles pennées
rigides. Le spécimen de Wuda porte de nombreuses traces de consommation, des galles et
des pontes d'insectes.

**WUD-06 — Wudaeophyton wangii.** Petite plante à graines grimpante, portant plusieurs
formes de feuilles selon leur position. Elle s'enroulait autour des fougères
arborescentes et des autres arbres de la forêt.

---

## Sources

Un même corpus couvre les six plantes : le gisement a été étudié comme un ensemble.

| | Source |
|---|---|
| tout le pack | Wang, Pfefferkorn, Zhang & Feng 2012, *Permian vegetational Pompeii from Inner Mongolia* — PNAS 109:4927 · https://www.pnas.org/doi/10.1073/pnas.1115076109 |
| `WUD-01` | Wang et al. 2021, *Ancient noeggerathialean reveals the seed plant sister group* — PNAS · https://www.pnas.org/doi/10.1073/pnas.2013442118 |
| site | UNESCO/IUGS, *Permian vegetation of the Wuda Fossil Site* · https://iugs-geoheritage.org/geoheritage_sites/permian-vegetation-of-the-wuda-fossil-site/ |

### Corrections apportées

**La date.** Le pack annonçait 298 → 296 Ma. La couche de cendres est datée de
**298,34 ± 0,09 Ma** — une seule éruption, pratiquement à la limite Carbonifère-Permien.
Ce n'est pas un intervalle mais un **instant**, ce qui sert le propos du chantier. Bloc
`SITES` et fiches à corriger.

**Paratingia.** Les noeggerathiales ne sont pas seulement « instructives parce qu'elles
ressemblent à ce qu'elles ne sont pas » : elles sont rattachées aux **progymnospermes**,
groupe frère des plantes à graines. La question 15 gagne à le dire.

**Le surnom.** Le gisement est connu comme la **« Pompéi végétale »**. À reprendre dans
l'accroche ou le volet 2.

---

## Les vingt questions

1. **Où se trouve le gisement de Wuda ?** · *En Mongolie-Intérieure, en Chine* · En
   Mongolie, au nord de la frontière chinoise · Dans le bassin du Donetsk, en Ukraine ·
   En Sibérie orientale, près de la Toungouska

2. **À quelle période appartient la forêt de Wuda ?** · *Au Permien inférieur* · Au
   Carbonifère inférieur · Au Trias moyen · Au Dévonien supérieur

3. **Qu'est-ce qui a enseveli cette forêt ?** · *Une pluie de cendres volcaniques* · Une
   coulée de boue descendue d'un versant · Une crue exceptionnelle du fleuve voisin · Un
   effondrement du sol tourbeux sous son poids

4. **Pourquoi le gisement est-il exploité ?** · *Pour son charbon* · Pour ses minerais de
   fer · Pour ses gisements de sel gemme · Pour ses argiles réfractaires

5. **Qu'est-ce que le charbon, du point de vue d'un paléobotaniste ?** · *Une forêt
   comprimée* · Une roche formée au fond des océans · Un sédiment déposé par les
   glaciers · Un dépôt chimique de source chaude

6. **Qu'a de rare la conservation de Wuda ?** · *Les plantes sont restées où elles
   poussaient* · Les tissus mous ont gardé leur couleur d'origine · Le bois s'est
   entièrement transformé en opale · Les racines ont été remplacées par de la pyrite

7. **Que sont, le plus souvent, les fossiles de plantes ?** · *Des morceaux transportés
   par l'eau* · Des empreintes laissées dans la cendre sèche · Des troncs entiers
   conservés debout · Des graines enfermées dans de l'ambre

8. **Que permet la position d'origine des plantes ?** · *Reconstituer la structure de la
   forêt* · Dater la couche à l'année près · Connaître la couleur du feuillage ·
   Déterminer la durée de vie des arbres

9. **Quelle plante porte des cicatrices foliaires en forme de sceaux ?** · *Sigillaria* ·
   Palaeostachya · Scolecopteris · Paratingia

10. **À quel groupe appartient Sigillaria ?** · *Aux lycophytes* · Aux gymnospermes · Aux
    fougères · Aux prêles

11. **De quoi est fait le tronc d'une fougère arborescente comme Scolecopteris ?** ·
    *D'un manteau de racines* · De bois dense, comme chez un chêne · De fibres tressées
    autour d'un axe creux · De tissu spongieux gorgé d'eau

12. **Qu'est-ce que Palaeostachya ?** · *Un parent géant des prêles* · Un conifère à
    aiguilles courtes · Une mousse formant des coussins · Une algue d'eau douce fixée

13. **Comment sont disposées les branches de Palaeostachya ?** · *En verticilles* · En
    spirale continue · Par paires opposées · Toutes du même côté

14. **Que produisait Paratingia, malgré ses organes en forme de cônes ?** · *Des spores* ·
    Des graines protégées par un tégument · Des fruits charnus dispersés par le vent ·
    Des bulbes portés au niveau du sol

15. **Pourquoi les noeggerathiales sont-elles instructives ?** · *Elles ressemblent à ce
    qu'elles ne sont pas* · Elles sont les ancêtres directs des conifères · Elles descendent
    des lycophytes arborescentes · Elles se reproduisaient par bouturage

16. **Qu'est-ce que Wudaeophyton ?** · *Une plante à graines grimpante* · Une fougère
    aquatique flottant en surface · Un arbre dominant de la canopée · Une mousse tapissant
    le sol du marécage

17. **Que porte le spécimen de Pterophyllum de Wuda ?** · *Des traces d'insectes* · Des
    marques de brûlure sur le limbe · Des cristaux de sel entre les nervures · Des
    fragments de coquilles d'œufs

18. **Que montrent les galles et les pontes conservées sur une feuille ?** · *Que la forêt
    était habitée* · Que la plante était malade avant l'éruption · Que les insectes ont
    causé la mort de la forêt · Que la feuille était tombée depuis longtemps

19. **Que signifie la mention « cf. » devant un nom d'espèce ?** · *L'attribution reste
    probable* · L'espèce a été renommée depuis sa description · Le spécimen est un
    hybride entre deux espèces · Le nom n'a jamais été publié officiellement

20. **Quelle idée générale la forêt de Wuda illustre-t-elle ?** · *Plusieurs manières de
    faire un arbre* · Que les forêts anciennes se ressemblaient entre elles · Que les arbres
    descendent tous d'un même ancêtre récent · Que le bois est apparu en une fois

---

## Les explications

Une phrase par question, donnant la raison de la réponse. La fiche donne le détail.

1. Le bassin houiller de Wuda, exploité pour son charbon, se trouve en Mongolie-Intérieure.
2. La couche de cendres est datée de 298,34 Ma, soit tout au début du Permien, pratiquement sur la limite avec le Carbonifère.
3. Une éruption a couvert la forêt de cendres assez vite pour que les plantes n’aient pas le temps de tomber ni de pourrir.
4. Le charbon exploité ici est la forêt elle-même, comprimée par le poids des sédiments qui l’ont recouverte.
5. Un gisement de charbon est une ancienne tourbière : de la matière végétale accumulée puis compactée pendant des millions d’années.
6. Ailleurs, les plantes fossiles ont été transportées avant d’être enfouies. Ici, elles ont été ensevelies à peu près là où elles poussaient.
7. Une feuille isolée, un fragment de tronc : le transport par l’eau disperse et trie, si bien qu’on récupère rarement une plante entière.
8. Connaître la position de chaque plante permet de relever la canopée, le sous-bois, et ce qui grimpait sur quoi — pas seulement la liste des espèces.
9. Ces cicatrices régulières sont les points d’attache des feuilles tombées, disposées en rangées le long du tronc.
10. Les lycophytes sont aujourd’hui de petites plantes rampantes ; au Paléozoïque, certaines atteignaient vingt mètres.
11. Sa tige est mince : ce qui donne l’épaisseur du tronc est un manteau de racines adventives qui l’enveloppe.
12. Les prêles actuelles mesurent quelques dizaines de centimètres. Palaeostachya en était un parent de plusieurs mètres.
13. Les branches partent toutes du même niveau, en couronne autour de la tige — une disposition caractéristique du groupe.
14. C’est ce qui rend la plante instructive : l’organe ressemble à un cône de conifère, mais il libère des spores.
15. Les noeggerathiales sont rattachées aux progymnospermes, groupe frère des plantes à graines : elles annoncent la graine sans la produire.
16. Elle s’enroulait autour des fougères arborescentes, ce qui suppose déjà une forêt assez dense pour qu’il vaille la peine de grimper.
17. Le spécimen porte des morsures, des galles et des pontes — trois types de traces laissées par des insectes.
18. Une galle est une réaction de la plante à un parasite : elle prouve une interaction, pas seulement une cohabitation.
19. « cf. » signifie « à comparer avec » : le fossile ressemble à cette espèce sans que l’attribution soit établie.
20. Lycophytes, fougères, sphénophytes et plantes à graines résolvent le même problème — se tenir droit et capter la lumière — par des architectures différentes.

---

## Mesure

    node tools/qcm_brouillon.js tools/PACK_WUD.md --pires
