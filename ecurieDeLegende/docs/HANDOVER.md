# 🐴 Écurie de Légendes — DOCUMENT DE TRANSFERT (handover)
### État à la fin de la session · **v55** · pour la prochaine session : **+80 cartes**

---

## 0) TL;DR pour la prochaine session
- Le jeu est en **v55**, **5 pays / 55 étapes**, **91 cartes**, **QC vert (0 échec)**. App mono-fichier.
- Prochaine tâche : **intégrer 80 nouvelles cartes**. C'est **additif et à faible risque** — la
  section §5 explique exactement où et comment, et le **harnais QC** (`node tools/qc.js`) est le
  filet de sécurité (il a attrapé de vrais bugs toute cette session).
- **Toujours** avant de packager : `node --check` + `node tools/qc.js` (exit 0) + audit d'IDs +
  bumper **les 2 versions** (index + sw). Détails §6.

---

## 1) Où en est le jeu (fait cette session)
- **5 mondes complets, déblocage séquentiel** : Belgique → France → Îles Britanniques (UK+Irlande) →
  Allemagne & Pays-Bas → Espagne & Portugal. 11 étapes chacun (10 + boss-capitale).
- **5 mascottes** avec intro éducative 3 écrans (race → faits → lien au pays), + fil rouge
  « cousinages de races » : Pieter-Jan (trait belge) → Big Ben (Shire) → Inge (Frison) au nord ;
  Rocío (Andalou) → Lusitanien → **mustangs d'Amérique** au sud (teasing du futur monde).
- **Moteur enrichi** : critères d'équipe M_BLANC/NOIR/PIE/DORE/BEAUTE/ARABE, contraintes
  royaumeUnique / robesDistinctes, mini-jeu **course** (tap-galop, Newmarket), **équipe de 5**
  (Munich), signalétique **2 pays** (marqueurs 2 drapeaux, drapeau par étape, cartes « quel pays ? »).
- **Onboarding revu (v55)** : Écurie filtrée « Possédés » par défaut, **tutoriel Pieter-Jan** (cadeau
  de 3 cartes + explication de la boucle Défis→💎→Tirage→Aventure, 1×/profil), **dévoilement
  progressif** (onglet Concours masqué tant qu'on n'a pas tiré/fini une étape), **hooks de fonds
  d'écran**.
- **91 cartes** : commune 27, rare 24, épique 20, légendaire 12, mythique 8. 12 familles.

## 2) Revue critique — regard honnête (depuis le dernier playtest)

### ✅ Solide
- Les 5 mondes passent le QC (solvabilité de chaque slot, seuils atteignables, cibles ±12, robes,
  royaumes, ids d'achat/cadeau existants, **équilibre économique** modélisé au pire cas).
- Le **harnais QC** est mûr : il a intercepté cette session `hanovrien` (carte inexistante), 2
  objectifs impossibles, un `chr(39)` mal écrit, des seuils trop serrés. **À faire tourner
  systématiquement.**
- Onboarding propre et réconcilié (un incident de doublon `TUTO_ETAPES` a été diagnostiqué et
  résolu ; 1 seul tuto, 0 ID manquant).

### ⚠️ Non testé — à PLAYTESTER (le QC prouve la *solvabilité*, pas le *plaisir*)
- **Aucun playtest humain** des 4 nouveaux mondes de bout en bout : difficulté ressentie, rythme,
  fun. Le QC garantit qu'on *peut* finir, pas que c'est *agréable*.
- **UX visuelle non vérifiée sur appareil** : le mini-jeu **course** (feeling du tap), l'**équipe de
  5** (rendu des 5 slots sur mobile), les **5 cartes SVG** (pan/zoom, pins, lisibilité), les
  **marqueurs 2 drapeaux**, les **overlays d'intro mascotte**, et le **tutoriel d'onboarding** de
  bout en bout (créer un nouveau profil et vérifier le déroulé).
- Les **cartes géographiques sont stylisées** (silhouettes approximatives, pas cartographiques) —
  acceptable pour des enfants, mais à savoir.

### 🕳️ Manques connus (backlog)
- **Images de fond majoritairement absentes** (~44) : France ×10, Îles ×11, Rhin ×11, Ibérie ×11 +
  portraits `big_ben`/`inge`/`rocio` + fonds d'écran onboarding. **Repli sombre gracieux** en place,
  donc rien n'est cassé, mais c'est visuellement pauvre. (Denis génère les visuels ; voir
  `liste-images-a-generer.md`.) NB : les images des Îles auraient été générées mais **pas encore
  déposées dans le zip** — à confirmer.
- **P2 onboarding** non fait : guidage contextuel (« tu as gagné 💎 → va tirer ! »), vrai
  **écran d'accueil/hub** avec action suggérée, et les fonds d'écran.
- **Incohérence mineure** : les 3 boss anciens (**Bruxelles, Paris, Londres**) ont **6** sous-étapes,
  les 2 récents (Berlin, Madrid) en ont **7**. Non bloquant (le moteur lit `.length`). À harmoniser
  si on veut la régularité.
- **Flag mort** : `cadeauDepart:true` dans `etatVide()` n'est plus consommé (le cadeau passe par le
  tuto) — à nettoyer un jour.

## 3) Architecture & fichiers
- **App mono-fichier** : `index.html` (HTML + CSS + tout le JS dans un seul `<script>`). ~700 k.
- `sw.js` (service worker, cache PWA), `manifest.json`, icônes, `cartes/` (images cartes + fonds).
- `tools/qc.js` (harnais QC Node). `CHANGELOG.md`, `README.md`.
- **Rendu spécial** dans l'UI : les fonds de villes/écrans sont chargés depuis `cartes/fond_*.jpg`
  (repli sombre si absent).
- **Structures de données clés** (dans le `<script>`) :
  - `IMG = {id:"cartes/id.jpg", …}` puis `CARTES = [ {…}, … ]` (le roster).
  - `ROBES = {id:'noir'|'blanc'|'tachetee'|'pie'|'isabelle'|'alezan', …}`.
  - `RARETES` (poids de tirage par rareté).
  - Matchers `M_*` (fonctions carte→bool), utilisés par les slots d'étape.
  - Mondes : `ETAPES_BE/FR/GB/DE/ES`, `ETAP_ALL`, `MONDES{belgique,france,iles,rhin,iberie}`,
    `MASCOTTES{…}`. Chaque étape = 7 sous-étapes (`{titre,narr,activites:[…]}`).

## 4) Schéma d'une carte (à respecter pour les 80 nouvelles)
```js
{
  id:"trakehner",                 // minuscule, sans espace/accent ; unique
  nom:"Le Trakehner",             // affiché
  rarete:"rare",                  // commune | rare | epique | legendaire | mythique
  emoji:"🐴",
  image:IMG.trakehner,            // référence l'entrée IMG du même id
  desc:"…",                       // 1 phrase
  aff:["vitesse","beaute"],       // sous-ensemble de: force,endurance,vitesse,beaute,bataille,magie
  familles:["race","historiques"],// sous-ensemble de: pres,travail,race,sauvages,historiques,
                                  //   cousins,legende,course,bataille,eau,elementaires,mascotte
  royaume:"allemagne"             // texte libre; réutiliser les royaumes existants (cohérence!)
}
```
Royaumes déjà utilisés : belgique, france, angleterre, ecosse, irlande, allemagne, **pays_bas**
(underscore !), espagne, portugal, italie, suisse, autriche, luxembourg, norvege, grece, rome, chine,
inde, arabie, japon, egypte, afrique, amerique, steppe, avalon, camelot.

## 5) COMMENT AJOUTER LES 80 CARTES (procédure)
1. Pour **chaque** carte, ajouter une ligne à **`IMG`** : `id:"cartes/id.jpg",`.
2. Ajouter l'**objet carte** au tableau **`CARTES`** (schéma §4).
3. Si la carte a une **robe suivie** (noir/blanc/tachetée/pie/isabelle/alezan), l'ajouter à
   **`ROBES`** : `id:'noir',`. (Sinon ne rien mettre.)
4. Déposer l'image `cartes/id.jpg` (repli gracieux si absente).
5. **Vérifier** : `node --check` (syntaxe) → `node tools/qc.js` (doit rester **exit 0**) → audit d'IDs.
6. **Bumper les 2 versions** + rezip.

**Impact automatique (rien d'autre à toucher)** : les nouvelles cartes rejoignent d'office les pools
des familles/affinités/robes/royaumes → elles deviennent **jouables en Aventure** (via les matchers
M_*) et **tirables**. Les étapes existantes n'ont **pas** besoin d'être modifiées.

**Points de vigilance** :
- Ajouter beaucoup de cartes **change les probabilités de tirage** (pool par rareté) et peut
  **assouplir l'équilibre** des étapes (plus d'options d'achat) → le QC le confirmera ; surveiller
  d'éventuels avertissements de balance/seuils.
- **Ne pas** casser un id d'achat existant (les étapes référencent des ids précis dans leurs `buy`).
- Idéal : profiter des 80 cartes pour **combler les races citées mais absentes** (ex. `hanovrien`,
  `holsteiner`, `schwarzwälder`, `pottok`, `sorraia`, `criollo`…) et **enrichir les robes rares**
  (peu de noir/pie/doré aujourd'hui → les équipes NOIR/PIE/DORE sont chères ; plus de cartes = plus
  accessibles).

## 6) Workflow d'édition & pièges (IMPORTANT)
- **Édition** : python `str.replace` avec `assert count==1` **avant** de remplacer (sinon échec
  silencieux). Extraire le `<script>` → `node --check` → `node tools/qc.js` → **audit d'IDs**
  (comparer `$('#id')` référencés vs `id="…"` définis, avec la liste `dyn` d'exclusion) → bumper
  **`VERSION_APP='vNN'` (index) ET `VERSION='ecurie-vNN'` (sw)** → rezip → présenter.
- **Piège apostrophe** : ne jamais écrire `chr(39)` dans une chaîne JS — utiliser `\\'`. (Bug réel
  cette session, attrapé par le QC.)
- **Piège doublon** : vérifier qu'on ne redéclare pas un `const` déjà présent (incident
  `TUTO_ETAPES` cette session).
- Le QC simule chaque pays au **pire cas** (collection minimale, palier 1) ; il faut qu'il reste
  **0 échec**. Les avertissements « seuil serré » / « balance » sont à examiner.

## 7) Roadmap suggérée (après les 80 cartes)
1. **Playtest humain** des 5 mondes (difficulté/rythme/fun) — le vrai chaînon manquant.
2. **Images** : déposer les fonds générés (villes + écrans onboarding + portraits mascottes).
3. **P2 onboarding** : guidage contextuel + écran d'accueil/hub + fonds.
4. **Harmoniser** les 3 boss à 7 sous-étapes ; nettoyer `cadeauDepart`.
5. **Nouveaux mondes UE** (au moins un avant d'élargir) : Italie/Suisse (Haflinger/Avelignese),
   Scandinavie (Fjord/Islandais), Europe centrale… puis **les Amériques** (Mustang/Criollo — déjà
   annoncé par Rocío).

## 8) Fichiers de ce handover (dans /outputs)
- `ecurie-pwa-complete.zip` — **l'app complète v55** (à déployer / point de départ).
- `index.html`, `sw.js`, `CHANGELOG.md` — versions à plat.
- `HANDOVER.md` — ce document.
- Design docs de référence : `aventure-france-design*.md`, `aventure-iles-britanniques*.md`,
  `aventure-rhin-design.md`, `aventure-iberie-v2.md`, `mascottes-introduction.md`,
  `liste-images-a-generer.md`.

*Bonne suite — et bienvenue aux 80 nouveaux chevaux. 🐴*
