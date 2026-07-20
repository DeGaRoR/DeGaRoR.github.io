# Sept packs à intégrer — pré-inscription

Spécification arrêtée avant réception des visuels. Elle fixe ce qui ne dépend pas des
images : place dans la chronologie, ancrage cartographique, emblème de frise, et les
précautions propres à chaque pack.

Les six fiches de créatures et les vingt QCM se rédigent pack par pack. Les **règles de
rédaction des QCM** (README, section dédiée) s'appliquent dès l'écriture, pas après coup.

---

## Place dans la chronologie

`SITES` est ordonné du plus ancien au plus récent, par `ageMax`. Les sept packs
s'insèrent ainsi :

| Rang | Pack | ageMax → ageMin | Vient après |
|---|---|---|---|
| **1** | `LNT` Lantian | 602 → 600 Ma | *aucun* — devient le plus ancien site de l'atlas |
| 5 | `COR` Gotland | 445 → 420 Ma | `ORD` Fezouata, avant `SIL` |
| 13 | `WUD` Wuda | 298 → 296 Ma | `MAZ` Mazon Creek, avant `KAR2` |
| 19 | `WNT` Winton | 100 → 93 Ma | `YIX` Yixian, avant `NEM` |
| 25 | `KAP` Kap København | 2,4 → 2,0 Ma | `SAM` Luján |
| 26 | `DOM` Domestication | 0,012 → 0 Ma | `KAP` |
| 27 | `LIV` Fossiles vivants | 0 Ma | dernier |

`LNT` recule le début de l'atlas de 558 à 602 Ma. **`FRISE_DEBUT` (650 Ma) reste
suffisant** — la marge passe de 92 à 48 Ma, ce qui est encore confortable. Aucun autre
réglage d'échelle n'est nécessaire.

`PERIODES` couvre déjà l'Édiacarien (635 → 538,8) et le Quaternaire (2,58 → 0) : les
sept packs tombent tous dans une période existante, `KAP` à cheval sur la limite
Pliocène–Pléistocène étant rangé au Néogène ou au Quaternaire selon son âge moyen.

---

## Ancrage cartographique

Cinq packs ont un gisement réel, à traiter normalement (`tools/pins.py`) :

| Pack | Épingle |
|---|---|
| `WNT` | Winton, Queensland central, Australie — **ouvre l'Australie** |
| `KAP` | Peary Land, extrême nord du Groenland, au-delà de 82° N |
| `LNT` | Formation de Lantian, Anhui, Chine du Sud |
| `COR` | Île de Gotland, Suède |
| `WUD` | Bassin houiller de Wuda, Mongolie-Intérieure, Chine |

`LIV` et `DOM` n'ont pas de gisement. La règle de `AJOUT_PACK.md` §5 s'applique :
retenir un lieu de référence défendable plutôt qu'un point arbitraire.

- **`LIV`** → les Comores, archipel où le cœlacanthe a été retrouvé vivant. C'est le
  lieu qui porte le sens du pack : l'endroit où une lignée crue éteinte est réapparue.
- **`DOM`** → le Croissant fertile, foyer des premières domestications. Le pack porte
  sur un processus, pas sur un site ; ce point en est l'origine documentée.

Dans les deux cas, l'introduction doit **dire explicitement que l'épingle est un repère
et non un gisement**. Sans quoi elle ment sur ce qu'elle montre.

---

## Emblèmes de frise

Choisis sur les deux critères habituels — situer l'époque, rester lisible à trente
pixels — et, à valeur égale, la forme plutôt que la notoriété.

| Pack | Emblème | Motif |
|---|---|---|
| `WNT` | Savannasaurus | silhouette presque quadrangulaire, unique parmi les sauropodes de l'atlas |
| `KAP` | *Mammut* sp. | un mastodonte au pôle Nord dit tout le pack d'un coup d'œil |
| `LNT` | Flabellophyton | le thalle en éventail, forme végétale et non animale |
| `COR` | Halysites | le réseau en maillons de chaîne, reconnaissable entre tous |
| `LIV` | Latimeria | le cœlacanthe, emblème même de l'idée de fossile vivant |
| `DOM` | Cheval de trait belge | la masse produite par sélection, lisible en vignette |
| `WUD` | Sigillaria | le tronc à cicatrices en sceaux, signature du Carbonifère-Permien |

---

## Fonds de chantier

Aucun de ces packs n'aura de vue satellite : la clé `fond` reste **absente** et le repli
du bloc 31 prend l'illustration de l'emblème. C'est le meilleur choix ici — une vue
satellite du Groenland actuel ou de l'Anhui d'aujourd'hui montrerait précisément le
paysage que le pack dit avoir disparu.

---

## Précautions par pack

### `KAP` — l'identification s'arrête au genre

Cinq des six entrées ne sont pas des espèces : `Mammut` sp., `Rangifer` sp., `Lepus` sp.,
`Branta` sp., un arvicoliné indéterminé, un limulidé apparenté à *Limulus polyphemus*.
L'écosystème est reconstitué par **ADN environnemental ancien**, non par des squelettes.

Conséquences, non négociables :

- les fiches nomment le genre ou la famille, **jamais une espèce inventée pour faire
  joli** ;
- le degré de confiance est **écologique bon, anatomique faible** : on sait qu'un
  mastodonte était là, on ne sait pas à quoi il ressemblait exactement ;
- les QCM peuvent porter là-dessus — c'est un excellent sujet d'épistémologie, du même
  ordre que Tullimonstrum ou Darwinius, déjà traités ailleurs dans l'atlas.

L'assertion anti-binôme-inventé de `qc.js` couvre déjà le risque principal.

### `LNT` — morphologie connue, parenté incertaine

Les formes fossiles sont bien décrites ; leur parenté avec les algues actuelles, leur
souplesse, leur texture et leurs couleurs ne le sont pas. Les fiches décrivent la
**forme** et s'arrêtent là. `Orbisiana` : affinité algale probable, non démontrée — à
dire ainsi.

### `DOM` — un pack à thèse

Le pack soutient quelque chose : l'humain devient un facteur évolutif. Cette thèse va
dans l'**introduction**, où elle peut être argumentée, pas dans les QCM, où elle
deviendrait une opinion à cocher.

Deux écueils à éviter dans les questions : juger la sélection (« la sélection est-elle
cruelle ? » n'a pas de réponse vérifiable) et laisser croire qu'une race est une espèce.

### `LIV` — le titre est un abus de langage, et il faut le dire

« Fossile vivant » suggère une espèce inchangée depuis le temps profond. C'est faux pour
les six : les lignées sont anciennes, les espèces actuelles ne le sont pas. *Nautilus
pompilius* et *Tachypleus tridentatus* sont des espèces modernes ; leur **plan
d'organisation** est conservateur.

L'introduction doit poser cette distinction, et **au moins deux QCM doivent la tester** —
c'est le contenu le plus utile du pack.

### `COR` — deux groupes entièrement éteints

Rugosa et Tabulata disparaissent à la fin du Permien. Ce ne sont pas des « coraux
anciens » au sens de coraux modernes primitifs : ce sont d'autres architectures. Les
fiches évitent toute formulation qui en ferait des ancêtres des coraux actuels.

### `WNT` et `WUD` — les plus simples

Écosystèmes cohérents, taxons décrits à l'espèce, pas de piège particulier. `WNT` ouvre
l'Australie, absente de l'atlas. `WUD` est une forêt ensevelie sous les cendres, donc
conservée **en position de croissance** : c'est ce qui permet d'en reconstruire la
structure, et c'est le fait remarquable à porter.

---

## Ordre d'exécution proposé

1. **`WNT`** — le plus simple, et il ouvre un continent. Sert de patron aux suivants.
2. `WUD`, `COR` — mêmes caractéristiques, aucun piège méthodologique.
3. `LNT` — recule le début de l'atlas, à vérifier sur la frise.
4. `KAP` — demande le traitement le plus prudent des identifications.
5. `LIV`, `DOM` — packs conceptuels, introductions à écrire avec soin.
