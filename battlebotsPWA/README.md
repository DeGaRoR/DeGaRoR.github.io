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
5. Sauvegardes versionnées : jamais de bosse de SAVE_V sans migration (app.js).

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

## Ajouter du contenu
- **Une coque** : entrée `CHASSIS_REG` (data.js) avec `series`, `spec`, `info`,
  `sprite` + entrée `ENGINE.CHASSIS` (radius/leverage/battery/selfRight) +
  entrée `ENGINE.PHYS.chassis` (kg, r). Les trois sont exigées par la porte.
  Le rayon reste STOCKÉ : il porte une saveur par coque (−11 % à +37 % de la
  demi-dimension) et le dériver déplacerait l'équilibre.
- **Une série** : une entrée `CHASSIS_SERIES` + `series:"<id>"` sur ses coques.
  La boutique s'organise d'elle-même par série puis par classe.
- **Une pièce** : `ENGINE.PARTS` + `FOOT_BASE`/`FOOT_TIER` + `COMPONENT_SPRITES`
  + `DEF_SLOT` + i18n `pn_<id>` FR **et** EN (vérifié par la porte).
- **Un concours** : une entrée `TOURNAMENTS` (format existant, arène déclarée
  dans `ARENA_GEOM` — les deux vérifiés). `noEngage:true` = exhibition sans
  machine à états.

## QC
Harness dans le dépôt frère `roboclash-qc/` : `npm install jsdom && node tools/gate.js`
→ doit afficher `PORTE: ÉCHECS (0)` (478 vérifications, ~60-90 s).
Outil manuel hors porte : `node tools/fuzz_flows.js` (flux de combat, anti-gel).
