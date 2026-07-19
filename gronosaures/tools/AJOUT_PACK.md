# Méthodologie d'ajout d'un pack

Sept étapes, dans cet ordre. Les étapes 1 à 3 sont mécaniques et ne comportent aucun
risque d'invention. Les étapes 4 et 5 produisent du texte écrit à la main : ce sont
les seules à relire ligne à ligne.

---

## 1. Inventaire et réconciliation

Avant toute chose, confronter trois listes :

| Source | Contenu | Fichier |
|---|---|---|
| Le lot livré | illustrations + vue de site | le zip |
| L'index créatures | 113 fiches, 18 packs | `06_Index_creatures_MVP_complete.csv` |
| La banque de questions | 300 QCM d'origine + 60 rédigés | `quiz_paleontologie_300_questions.json`, `tools/quiz_complement.json` |

```bash
python3 tools/ingest.py --inventaire --packs XXX --assets /chemin,/autre/chemin
```

Ce qu'il faut regarder, dans l'ordre de gravité :

- **un `pack_id` du lot absent de l'index.** Vérifier d'abord qu'il ne s'agit pas du
  même pack sous un autre nom : le lot livré sous `BEL` était le pack `NWE`, « De
  Bernissart à Maastricht », et les six noms d'espèces correspondaient exactement.
  Comparer les noms scientifiques avant de conclure à une lacune.
- **une vue de site absente.** Le pack ne peut alors pas être ajouté : la modale
  d'ouverture et l'introduction s'appuient dessus. Convertir quand même les
  illustrations, elles serviront au lot suivant.
- **une banque de questions vide.** Cela bloque tout autant : la fouille consiste à
  répondre à une question du site. Voir le § 5 bis.
- **une créature sans illustration.** `ingest.py` n'émettra pas sa fiche — une image
  cassée dans la collection est pire qu'une absence. Trois créatures du Morrison sont
  dans ce cas.
- **des champs vides dans l'index.** Les masses manquantes sur l'Édiacarien, Mazon
  Creek, le Hunsrück et les trilobites ne sont pas un oubli : ces organismes n'ont pas
  de masse publiée. La fiche affiche « non estimable », pas un chiffre inventé.

## 2. Ingestion mécanique

```bash
python3 tools/ingest.py --packs EDI,TRI,BURG,... --assets /chemin --sortie w/data_bloc1.js
```

Régénère le bloc 1 de `data.js` (`CREATURES` + `QUIZ_PALEO`) à partir du CSV et des
banques de questions. Aucune reformulation : descriptions, mises en garde, sources et
niveaux de confiance sont recopiés tels quels.

Le CSV complet ne porte plus `age_min_ma` ni `age_max_ma` : ces bornes sont relues
depuis `age_display` par `bornes_age()`.

## 3. Conversion des assets

Même script. Cartes réduites à 760 px de large en JPEG q84, vues de site à 800 px,
renommées d'après le `creature_id`. Les illustrations portent déjà leur cartouche de
nom : l'interface ne le redouble jamais.

Trois conventions de nommage ont été rencontrées, toutes acceptées :

```
HUN-01 #U2014 Palaeoisopus problematicus.png    identifiant complet
TRI1_Paradoxides davidis.png                    identifiant sans zéro
GOBI_Tarbosaurus bataar.png                     pack (ou alias) + nom d'espèce
```

Plus une table d'alias de pack : `LOU→LUO`, `BEL→NWE`, `GOBI→NEM`, `HELL→HC`,
`JURNEW→JUR`, `YIX2→YIX`.

**L'appariement se fait d'abord par nom d'espèce**, jamais par identifiant en premier.
La forme courte « pack + numéro » entre en collision avec les alias numérotés :
`YIX` + créature 2 donne `YIX2`, qui est aussi le préfixe de tout un lot. Cette
collision a réellement attribué l'illustration de Changyuraptor à Sinosauropteryx.

## 4. Complétion éditoriale — la partie à relire

Les sources ne contiennent **pas** ce dont l'écran de chantier a besoin :

- l'ancrage géographique et les coordonnées de l'épingle ;
- l'accroche ;
- l'introduction en cinq volets ;
- le coût d'ouverture.

C'est écrit à la main, pack par pack, et c'est là que se logeraient d'éventuelles
erreurs factuelles.

## 5. Ancrer un pack non géographique

Huit sites sur dix-huit suivent un groupe, une lignée, une formation entière ou même
une démarche, pas un gisement ponctuel. Règle appliquée, dans cet ordre :

1. **un gisement réel qui fournit au moins une des créatures du pack.** Retenu pour
   Bear Gulch (chondrichthyens), l'Anti-Atlas (trilobites), Hokkaidō (céphalopodes),
   East Kirkton (Carbonifère), Miguasha (origine des membres), Zhenghe (révisions),
   Ouadi al-Hitan (cétacés) ;
2. à défaut, l'institution de référence sur le sujet ;
3. à défaut seulement, un lieu emblématique.

Dans tous les cas, le cinquième volet de l'introduction **dit explicitement** que le
site n'est qu'un point d'ancrage et que les créatures viennent de plusieurs
continents. Ne pas laisser croire à une unité de lieu qui n'existe pas.

## 5 bis. Écrire une banque de questions

Quand la banque source ne couvre pas un pack, les vingt QCM se rédigent dans
`tools/quiz_complement.json`, au format exact de la source. `ingest.py` le fusionne
automatiquement. Trois règles, appliquées aux packs Zhenghe, Nemegt et Hell Creek :

1. **Chaque question porte un lien.** L'objectif est d'apprendre, pas seulement de
   vérifier : l'explication donne la réponse et le lien permet d'aller plus loin.
   Priorité aux musées, aux revues et aux universités.
2. **Rien qui ne soit vérifié.** Les espèces récentes — Spicomellus, Alpkarakush,
   Fujianvenator, Mamenchisaurus — ont été recherchées avant rédaction.
3. **Une donnée absente reste absente.** Pas de masse inventée, pas de date précise
   affirmée sans source.

Contrôle avant intégration : distracteurs distincts, réponse cohérente avec
`correct_choice`, lien présent, explication substantielle, formulation interrogative.

## 6. Calage de l'épingle

`monde.jpg` est une image générée : sa projection n'est pas rigoureuse, l'échelle
mesurée varie de 4,2 à 6,6 pixels par degré. Procédure en deux temps :

1. `tools/pins.py` ajuste une transformation affine **locale**, pondérée par une
   gaussienne, sur vingt et un amers relevés dans l'image — mers intérieures et îles
   isolées. Contrôle croisé : erreur médiane 21 px, maximum 163. Ne pas revenir à une
   pondération inverse de la distance : elle s'effondre vers l'amer le plus proche et
   a collé Burgess sur Bear Gulch à 7 px l'un de l'autre ;
2. on recadre le masque terre/mer autour de la position proposée et **on vérifie à
   l'œil**. L'écart entre proposition et position retenue va de 3 à 60 px.

Deux contre-exemples à garder en tête. L'épingle du Karoo est restée trois versions
dans l'océan Indien, au sud de Madagascar, parce qu'elle avait été posée « à l'œil »
sans vérification. Et l'Anti-Atlas a d'abord été posé sur un liseré côtier qui
disparaît à la résolution du masque.

Enfin, certains sites sont trop proches pour être séparés : Bernissart et Bundenbach
sont à dix-sept pixels. L'application regroupe alors les épingles en grappes qui
s'ouvrent au zoom ; `qc.js` vérifie que toute grappe finit par s'ouvrir.

## 7. Portes de qualité

Aucune assertion nouvelle à écrire : `qc.js` et `smoke.js` bouclent sur `SITES` et
`CREATURES`. L'invariant « six créatures par site » a été retiré — Yixian en compte
huit — et tous les calculs raisonnent désormais par créature.

```bash
node --check data.js && node --check app.js && node --check sw.js
node tools/qc.js && node tools/smoke.js   # ÉCHECS (0) exigé
```

**Vérifier que chaque correctif s'applique.** Un `replace()` dont le motif n'existe
pas ne lève rien et laisse croire au travail fait. Cela s'est produit trois fois sur
ce projet, sur le README et sur ce fichier. Toute retouche scriptée doit échouer
bruyamment si son motif est absent.

---

## Écarts constatés lot par lot

| Lot | Écart | Traitement |
|---|---|---|
| BURG / KAR2 / YIX | — | — |
| LUO / EDI / MAZ / CHO / WHA | vue de Luoping livrée en `LOU_Luoping.png` | alias de pack |
| | masses absentes pour EDI et MAZ | « non estimable » |
| | `CHO` et `WHA` non géographiques | ancrés selon le § 5 |
| BEL / TRI / CEP / CAR / HUN | le pack `BEL` est le pack `NWE` de l'index | alias de pack |
| | nommage `TRI1_Nom.png` | deuxième convention acceptée |
| | six illustrations `DEV` sans vue de site | pack reporté au lot suivant |
| | quatre ancrages dans 400 km en Europe | regroupement des épingles au zoom |
| JURNEW / GOBI / HELL / MOR / YIX2 | index fourni en CSV, sans bornes d'âge | relues depuis `age_display` |
| | alias `GOBI→NEM`, `HELL→HC`, `JURNEW→JUR`, `YIX2→YIX` | table `ALIAS` |
| | nommage `GOBI_Nom scientifique.png` | troisième convention |
| | `YIX2` se confond avec « `YIX` + créature 2 » | appariement par espèce prioritaire |
| | `YIX` passe à 8 créatures, `MOR` à 9 | invariant « six par site » retiré |
| | trois créatures du Morrison sans illustration | fiches non émises |
| | `JUR`, `NEM`, `HC` sans questions | 60 QCM rédigés, `tools/quiz_complement.json` |
