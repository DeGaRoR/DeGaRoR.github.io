# Méthodologie d'ajout d'un pack

Sept étapes, dans cet ordre. Les étapes 1 à 3 sont mécaniques et ne comportent aucun
risque d'invention. L'étape 4 est la seule qui produit du texte écrit de ma main :
c'est donc la seule à relire ligne à ligne.

---

## 1. Inventaire et réconciliation

Avant toute chose, confronter trois listes :

| Source | Contenu | Fichier |
|---|---|---|
| Le zip livré | illustrations + vue de site | `LUO_EDI_MAZ_CHO_WHA.zip` |
| L'index créatures | 90 fiches, 15 packs | `06_Index_creatures_MVP.json` |
| La banque de questions | 300 QCM, 20 par pack | `quiz_paleontologie_300_questions.json` |

`python3 tools/ingest.py --inventaire` affiche les écarts. Ce qu'il faut regarder :

- un `pack_id` du zip absent de l'index → il faudra écrire les six fiches à la main ;
- un préfixe de fichier qui ne correspond pas au `pack_id` (déjà vu : la vue satellite
  de Luoping est livrée sous `LOU_Luoping.png` alors que le pack est `LUO`) ;
- des champs vides dans l'index. Les masses manquantes sur l'Édiacarien et Mazon Creek
  ne sont pas un oubli : ces organismes à corps mou n'ont pas de masse publiée. La fiche
  doit afficher « non estimée », pas un chiffre inventé.

## 2. Ingestion mécanique

`python3 tools/ingest.py --packs LUO,EDI,MAZ,CHO,WHA` régénère le bloc 1 de `data.js`
(`CREATURES` + `QUIZ_PALEO`) pour l'ensemble des packs actifs, à partir des JSON.
Aucune reformulation : descriptions, mises en garde, sources et niveaux de confiance
sont recopiés tels quels. Si une source manque, la fiche le dira.

## 3. Conversion des assets

Même script. Cartes réduites à 760 px de large en JPEG q84, vues de site à 800 px,
renommées d'après le `creature_id` (`cartes/WHA-03.jpg`). Les illustrations portent
déjà leur cartouche de nom : l'interface ne le redouble jamais.

## 4. Complétion éditoriale — la partie à relire

Les sources ne contiennent **pas** ce dont l'écran de chantier a besoin :

- l'ancrage géographique et les coordonnées de l'épingle ;
- l'accroche ;
- l'introduction en cinq volets (découverte, taphonomie, débats, enjeux) ;
- le coût d'ouverture.

C'est écrit à la main, pack par pack, et c'est là que se logeraient d'éventuelles
erreurs factuelles.

## 5. Ancrer un pack non géographique

Trois packs sur huit sont thématiques et non géographiques : une lignée évolutive
(`WHA`), un clade (`CHO`). Règle appliquée, dans cet ordre de préférence :

1. **un gisement réel qui fournit au moins une des six créatures du pack.** Retenu
   pour `CHO` → Bear Gulch, Montana, d'où proviennent effectivement *Belantsea
   montana*, *Stethacanthus* et les inioptérygiens. Retenu pour `WHA` → Wadi Al-Hitan,
   Égypte, d'où provient *Basilosaurus isis*.
2. à défaut, l'institution de référence sur le sujet ;
3. à défaut seulement, un lieu emblématique.

Dans les deux cas, le cinquième volet de l'introduction **dit explicitement** que le
site n'est qu'un point d'ancrage et que les six créatures viennent de plusieurs
continents. Ne pas laisser croire à une unité de lieu qui n'existe pas.

## 6. Calage de l'épingle

`monde.jpg` est une image générée : sa projection n'est pas rigoureuse et aucune
formule ne donnera un résultat juste partout. Procédure en deux temps :

1. `tools/pins.py` ajuste une transformation affine **locale**, pondérée par une
   gaussienne, sur 21 amers relevés dans l'image — mers intérieures et îles isolées.
   Contrôle croisé : erreur médiane 21 px, maximum 163. Ne pas revenir à une
   pondération inverse de la distance : elle s'effondre vers l'amer le plus proche
   et a collé Burgess sur Bear Gulch à 7 px l'un de l'autre ;
2. on recadre `monde.jpg` autour de la position proposée et **on vérifie à l'œil**
   contre les repères côtiers. La proposition n'est qu'un point de départ.

L'écart constaté entre proposition et position retenue va de 3 à 60 px.

Un contre-exemple à garder en tête : l'épingle du Karoo est restée trois versions
dans l'océan Indien, au sud de Madagascar, parce qu'elle avait été posée « à l'œil »
sans vérification. D'où le masque terre/mer et l'assertion automatique du § 7.

## 7. Portes de qualité

Aucune assertion nouvelle à écrire : `qc.js` et `smoke.js` bouclent sur `SITES` et
`CREATURES`, donc tout pack ajouté est contrôlé automatiquement — images présentes,
mises en cache par le service worker, 20 questions, six créatures, introduction
d'au moins cinq volets substantiels, coût positif, épingle dans le cadre de la carte.

```bash
node --check data.js && node --check app.js && node --check sw.js
node tools/qc.js && node tools/smoke.js   # ÉCHECS (0) exigé
```

---

## Écarts constatés lot par lot

| Lot | Écart | Traitement |
|---|---|---|
| BURG / KAR2 / YIX | — | — |
| LUO / EDI / MAZ / CHO / WHA | vue de Luoping livrée en `LOU_Luoping.png` | renommée à l'ingestion |
| | masses absentes pour les 12 créatures d'EDI et MAZ | affichage « non estimée » |
| | `CHO` et `WHA` non géographiques | ancrés selon la règle du § 5 |

## Ce que les sources ne contiennent pas

L'index et la banque de questions couvrent les 15 packs. En revanche, **aucune source
ne fournit** : la localisation géographique du site, les coordonnées de l'épingle,
l'accroche, l'introduction en cinq volets, le coût d'ouverture. Pour un pack absent de
l'index, il faudrait en plus écrire les six fiches créatures (groupe taxinomique,
période, milieu, régime, taille, masse, longévité, confiance graphique, description,
mise en garde, deux sources) et vingt questions. `--inventaire` le signale
immédiatement : « créatures 0 ».

**Une banque de questions vide bloque tout autant qu'une vue de site absente.** La
fouille consiste à répondre à une question du site : sans les vingt QCM, le chantier
est inutilisable. `--inventaire` affiche « questions 0 ». Dans ce cas, convertir les
assets — ils sont prêts pour plus tard — mais ne pas déclarer le site dans `SITES`.
