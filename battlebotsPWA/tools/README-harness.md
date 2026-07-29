# AI ROBOCLASH — harness QC

## Lancer

```bash
npm install jsdom          # seule dépendance
node tools/gate.js         # tout — doit afficher PORTE: ÉCHECS (0)
node tools/gate.js ui      # une suite (filtre sur le nom)
node tools/gate.js -v      # détail des OK, pas seulement des échecs
```

Durée totale : ~60-90 s pour 644 vérifications (26/07).

## Architecture

> **Corrigé le 25/07.** Ce document décrivait encore le modèle monolithe :
> « ai-roboclash-s4.html source unique de vérité » et « engine.js ARTEFACT,
> jamais édité à la main ». **C'est faux et dangereux** : `pwa/` est la source
> de vérité (README du jeu, règle 1), le monolithe est archivé, et
> `pwa/engine.js` est un **fichier source** qui s'édite normalement — l'en-tête
> d'`extract.js` le dit lui-même. Suivre l'ancienne consigne faisait perdre le
> travail moteur.

```
pwa/                   SOURCE DE VÉRITÉ (data.js → engine.js → app.js)
  engine.js            fichier SOURCE, édité à la main, sans DOM ni dépendance
engine.js (racine)     artefact CommonJS pour les suites — produit par extract.js
tools/
  extract.js    valide pwa/engine.js (marqueurs, IIFE, autonomie) → artefact racine
  world.js      charge le VRAI HTML dans jsdom, avec contexte 2D enregistreur
  check.js      reporter commun (format « ÉCHECS (n) » lisible par la porte)
  qc_pwa.js     structure du paquet, ordre de chargement, précache SW
  qc_engine.js  invariants moteur + gardes d'extensibilité (S19), sans DOM
  qc_editor.js  packer, mise en page, CG, hitbox, longerons
  qc_ui.js      navigation, contenu, i18n, dessin, chrome collant
  qc_journeys.js parcours joueur bout en bout, anti-gel
  qc_econ.js    scénarios économiques mesurés
  gate.js       lance tout, agrège
  bench.js      OUTIL MANUEL (hors porte) : banc de mesure. Voir plus bas.
  temoin.js     LE MATCH-TÉMOIN. Vérifié PAR LA PORTE (suite moteur, S26).
                `node tools/temoin.js`            vérifie
                `node tools/temoin.js --generer`  refige la référence
  temoin.json   la référence : 12 builds hydratés + 200 cas figés.
  fuzz_flows.js OUTIL MANUEL (hors porte) : fuzz des flux de combat, chaque
                scénario dans un processus borné — un gel devient un timeout.
                `node tools/fuzz_flows.js` → doit finir « 0 anomalie ».
```

### Le point clé : `world.js`

Pas de paquet `canvas` natif. `getContext("2d")` renvoie un **enregistreur** : chaque
appel est journalisé (`fillRect(10,20,5,5)`). Trois bénéfices d'un coup :

- « le code tourne » devient vérifiable,
- « le rendu est déterministe » se teste par diff de signature,
- zéro dépendance native, donc zéro compilation.

`Image` ne décode jamais les data-URL sous jsdom → `naturalWidth` reste à 0 →
`chassisSpriteReady()` est faux → **c'est le chemin de repli vectoriel qui est testé**.
Déterministe, mais à savoir : le rendu sprite n'est pas couvert.

`requestAnimationFrame` est mis en file, jamais bouclé. Les tests avancent
explicitement avec `w.step(n)`. Rien ne part en vrille.

### API de test

```js
const w = openWorld({ save });   // save = objet écrit dans localStorage avant boot
w.eval("S.garage.length")        // évalue dans la portée globale de la page (voit les const)
w.click("tabWorkshop")           // clic réel sur un élément
w.step(120, 33)                  // 120 frames de 33 ms
w.opsOf("cv")                    // opérations de dessin enregistrées
w.errors                         // toute erreur JS non rattrapée, depuis le boot
```

## Ce que chaque suite garantit

| Suite | Garantit |
|---|---|
| moteur | 150 duels se terminent · déterminisme graine→issue · builds générés valides · toutes stats dérivées finies sur 37 builds · modèle de multiplicité (masse, drain, autonomie) · `counts` absent ≡ `counts:1` |
| éditeur | 8 châssis se rangent · 296 équipements ne corrompent jamais l'état · empilement ×2 sur tous les slots/châssis · plafond réel · aucun chevauchement intra-couche · CG et hitbox finis · réparation de mise en page corrompue |
| interface | navigation à 3 onglets · contenu construit · FR/EN sans marqueur `{x}` orphelin · l'éditeur et l'arène dessinent · save/restore équilibrés · aucun NaN dans le rendu · rendu déterministe · combat complet + abandon + retour |
| parcours | nouveau joueur · **sauvegardes 1→4 bots × chaque bot actif** · pool de pièces partagé · achat→bascule→persistance→rechargement · ouverture des tournois · saison de ligue complète · gel du build en coupe · refus aux vérifications techniques · 8 sauvegardes hostiles |

## Pourquoi J2 existe

Le crash `STACK_SLOTS` est passé à travers toutes les suites précédentes parce
qu'elles démarraient toutes un joueur neuf à **un seul bot**. `installedElsewhere()`
saute le bot actif : avec un seul bot, la boucle ne touche jamais la variable.

Vérification faite : passé sur le fichier d'avant correctif, le harness rougit
en 5 points dont J2 en tête. C'est le test de non-régression de ce bug.

**Règle qui en découle** : toute forme de sauvegarde qu'un joueur réel peut
atteindre doit démarrer. J9 étend ça aux sauvegardes hostiles.

## Durcissement des sauvegardes

`validChassis(ch)` (déclaré avant le bloc de boot) rabat sur `"boxy"` tout châssis
que le moteur ne connaît pas. Appliqué à trois endroits : `defaultBot()`, chaque
bot du garage à la migration, et le build gelé d'une coupe en cours.

Détail qui compte : la validation lit **uniquement** `ENGINE.PHYS.chassis` et
`ENGINE.CHASSIS`, jamais `CHASSIS_SPEC`. Ce `const` de la couche applicative est
déclaré ~250 lignes *après* le bloc de boot — le lire ici recréerait exactement
le piège TDZ de `STACK_SLOTS`. Les deux registres moteur sont définis ligne 333,
bien avant.

Couvert par J9 : châssis inconnu sur le bot actif, sur un bot dormant, et dans un
build gelé de coupe. Dans les trois cas le jeu démarre et le bot rabattu reste
jouable (`layoutValid` vérifié).

## Le banc de mesure (`bench.js`, hors porte)

```bash
node tools/bench.js miroir     --classe M --n 150
node tools/bench.js poignees   --classe M --n 100
node tools/bench.js logiciels  --classe M --n 150
node tools/bench.js niveaux    --classe S --n 100
node tools/bench.js etalon     --classe M --n 120
node tools/bench.js rapport    --classe M --n 60      # la batterie complète
node tools/bench.js duel --a '{"motor":"m2"}' --b '{"motor":"m0"}'
node tools/bench.js duel --ficheA '<fiche exportée du jeu>' --ficheB '<fiche>'
```

Trois règles, et c'est tout l'intérêt de l'outil :

1. **Hydrater ou refuser.** Chaque build passe par l'éditeur RÉEL (autoArrange,
   layoutValid, buildColliders, computeCG, beamCellsOf) avant d'entrer en piste.
   Ce qui ne loge pas dans la coque n'est pas mesuré. Sans cette règle on mesure
   des bots imaginaires : le « trio S » à 1,36 kg n'entre dans AUCUNE coque S.
2. **Les deux côtés.** Chaque graine est jouée A-à-gauche puis A-à-droite.
3. **Le témoin est un TEST, pas un seuil.** Chaque bloc affiche en tête le
   miroir de sa référence : taux du bot 0, intervalle de confiance, verdict.
   L'alerte ⚠ ne se déclenche que si l'intervalle **exclut 50 %** — jamais sur
   un écart en points. Un seuil fixe signalait des biais imaginaires : à 40
   graines l'intervalle fait déjà ±11 points, et un miroir « biaisé » à 64/36
   sur 80 graines redescend à 55/45 sur 300. Chaque bloc imprime aussi la
   **sensibilité** de son effectif — le plus petit écart que l'instrument peut
   voir. En dessous, il est aveugle, et il vaut mieux l'écrire.

Sortie : taux de victoire, **intervalle de Wilson à 95 %**, effectif, répartition
par côté. Déterministe : même `--seed` → mêmes chiffres à la décimale.

Ordres de grandeur de la sensibilité : 30 graines → ±16,8 pt · 60 → ±12,3 pt ·
150 → ±7,9 pt · 300 → ±5,6 pt. Pour trancher un cas douteux, monter `--n`.

Les étalons de `REF` sont provisoires : la Ligne Calibrage (`BENCHMARKS` figés,
zéro rng) les remplacera.

## Le match-témoin (`temoin.js` + `temoin.json`)

Le filet du chantier pilote. `control()` va être découpé en perception,
décision et actionnement : la seule question qui vaille est **« le jeu
joue-t-il exactement pareil ? »**. 200 matchs de graines fixes y répondent au
tick près.

Ce qui est figé, et pourquoi chaque champ compte :

| champ | ce qu'il attrape |
|---|---|
| `winner` `reason` `t` `duels` | l'issue — nécessaire, très insuffisant |
| `ticks` | la durée en pas de simulation |
| `draws[0]` `draws[1]` | **les tirages d'aléa PAR BOT**. Le champ traître : la consommation dépend du MODE (`escape` et `hold` sortent de `control()` avant le tremblé de conduite et ne tirent rien). Un refactor qui déplacerait le tirage hors de ces branches garderait des issues identiques pendant des dizaines de matchs, puis désynchroniserait tout sans explication. |
| `sig` | empreinte de TOUTES les transitions de mode des deux bots, avec leur tick. Le champ sensible : il change dès qu'un bot pense différemment, même s'il gagne pareil. |

Les 12 builds sont **hydratés** (colliders, CG, longerons) à la génération et
stockés dans le JSON : la vérification rejoue la vraie géométrie de jeu sans
jsdom, en ~15 s. Ils sont choisis pour COUVRIR les branches de `control()` —
embuscade (mode `hold`, zéro tirage), v3 face à un lourd (`escape`), contre
(`orbit`), gardes au bord opposées, les deux classes et leurs deux rings.

Vérifié en conditions : un seuil déplacé d'une unité (`GUARD.normal` 38→39) et
un tirage d'aléa ajouté dans la branche `hold` sont tous deux détectés — le
second affiche `tirages par bot: 550,3838 → 2199,3840`, qui désigne
immédiatement la branche fautive.

> **Régénérer EFFACE le filet.** `--generer` ne se lance que pour un changement
> de comportement VOULU, assumé et mesuré. Jamais pour faire taire la porte.

## Ajouter un test

Un parcours dans `qc_journeys.js` :

```js
safe("J10 mon parcours", () => {
  const w = openWorld({ save: save({ bolts: 5000 }) });
  w.click("tabShop");
  w.eval(`buyBot("tortue")`);
  check("J10 …", w.eval("S.garage.length") === 2);
  check("J10 aucune erreur", w.errors.length === 0, w.errors[0] || "");
  w.close();
});
```

Deux réflexes : `openWorld` par parcours (isolation), et une vérification
`w.errors.length === 0` en fin de bloc — c'est elle qui attrape les crashes muets.

Dans `qc_editor.js`, appeler `w.eval("__resetBot()")` en tête de bloc : les
suites partagent un monde et les tests d'équipement mutent l'état.
