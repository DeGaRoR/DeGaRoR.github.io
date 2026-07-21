# HANDOVER — Gronosaures et Trilobytes, v105
## Pour initialiser la prochaine conversation

**Projet.** PWA éducative française (quiz/fouille/collection paléontologique)
pour **Louise** — compagne de Denis, passionnée Mésozoïque/Cambrien, anxieuse
face aux équations mais excellente sur les concepts, TRÈS pointilleuse sur
l'exactitude (elle vérifie ; ne jamais inventer, toujours sourcer). Son usage
réel : **l'attention s'éveille → elle suit le fil des liens → elle prend des
notes → les questions fixent**. Les crédits servent seulement à décompresser en
fin de session (fouilles). Elle accumule lentement, apprend profondément.

**Environnement.** Répertoire de travail `/home/claude/atlas/` ; blocs source
`/home/claude/w/data_blocNN.js` ; sorties `/mnt/user-data/outputs/`. Denis teste
sur téléphone via degaror.github.io ; **Claude ne voit jamais le rendu** — les
captures sont le seul canal. Denis enchaîne par « Continue » / « Go ».

## Démarrage d'une session

```
unzip g103.zip -d /home/claude/        # archive la plus récente
cd /home/claude/atlas
node tools/qc.js            # 13315+ assertions — exiger ÉCHECS (0)
node tools/smoke.js         # économie simulée
node tools/ui_niveaux.js    # parcours réel clic→volets→mission→question (faux DOM)
node tools/exploit_check.js # anti-triche : Valider martelé, rafales, inertie
node tools/profils_test.js
```

Ordre de concaténation de data.js (42 blocs) :
`1 2 4 5 6 7 12 16 8 9 10 11 13 14 15 3 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40 41 42`

Après tout changement : `node tools/version.js +` (synchronise sw.js et
VERSION_ATLAS ; **le menu affiche la version** — premier réflexe de diagnostic
quand Louise signale un bug déjà corrigé : lui faire lire ce bloc, le service
worker peut servir une build périmée jusqu'à deux rechargements).

## Règles de travail (payées cher, ne pas réapprendre)

1. **Éditer par contenu** (str_replace/motifs), vérifier CE QUI EST ÉCRIT avant
   de le décrire. Trois « fait » annoncés à tort dans la session précédente.
2. **Chaque décision = une assertion** dans qc.js ou ui_niveaux.js. Les
   assertions de données ne voient PAS les bugs d'écran : trois régressions
   (clic mort, Continuer mort, liens en tas) n'ont été vues qu'en playtest.
3. **Le biais QCM ne se sent pas, il se mesure.** Premier jet toujours à
   43-67 % de clés les plus longues ; cible < 25 % en ÉTOFFANT les leurres
   (jamais raccourcir les clés, jamais d'allongement mécanique — mauvais
   français garanti).
4. **Registre** : tools/BACKLOG.md (obligatoire, qc le vérifie). Historique
   complet v80→v105 dedans.
5. Un correctif d'écran ⇒ demander une capture.

## Contenu livré (tout jouable)

- Paléo : 30 chantiers, 193 créatures, 640 questions de fouille.
- **12 séries à niveaux, 43 niveaux, 348 volets, 300 questions** :
  matière (2 packs), quantique (3), astrophysique (5), conscience (2 — fournie
  par Denis, 13 chapitres, statuts [débattu], sources par carte).
- **188 liens** (min. 2/niveau, gate) dont 20 textes originaux (DOI/Gallica/
  CERN, appariés). Conscience : lien affiché SOUS sa carte (champ `v`) ;
  séries à équations : « Sources du niveau » au dernier volet.
- Notes aux trois moments : leçon (volet), question, rappel théorique.
- SVG du tableau de Mendeleïev affiché (matiere1 n2, `imgVolets`).
- Économie : séries payées 20/14/40 ◈ + prime 150 ◈/niveau (470 ◈ le niveau
  acquis) ; mission surprise 50 % scolaire, **jamais** dans les séries.
- Écran de leçon : croix de sortie, précédent (désactivé au volet 1, jamais
  masqué), compteur, pastilles cliquables, note, sources. Chaque bouton a son
  gestionnaire PROPRE (le clic global est sélectif et les ignore).

## Pédagogie des équations (l'esprit — audité v103, intact)

9 volets : I-V récit · VI équation familière du quotidien · VII la même en
français · VIII l'abréviation, chaque lettre nommée · IX ce qu'elle prédit,
chiffré pour de vrai. Aucune équation n'arrive la première ; les lettres
APRÈS le français ; on lit, on ne calcule pas ; chaque niveau se referme sur
ce qui reste insatisfaisant. Exemptions documentées dans qc.js
(SANS_EQUATION) : quanta3, quanta2:1, conscience, astro4:0, astro5:2.

## Vérité sur l'exploit signalé (v105)

Rejoué empiriquement (tools/exploit_check.js) : **le code actuel tient** —
8 pressions sur Valider = un seul gain ; après un raté = 7 ◈ une fois ; après
la fin, tout est inerte. Si Louise le voit encore : build périmée (voir bloc
version du menu). Trouvé au passage et corrigé : double-tap sur Continuer
après la dernière question → exception silencieuse (suite() gardée).
**Décision ouverte pour Denis** : la prime de fin de mission (12 ◈) tombe même
à six mauvaises réponses — voulu ou non ?

## Pending, par priorité (détail : tools/BACKLOG.md et tools/AUDIT_SERIES.md)

| # | Quoi | Note |
|---|---|---|
| A17 | **Vérification visuelle** — rien n'a jamais été vu par Claude | LE trou. 5 bugs attrapés par playtest, 0 par les portes. |
| A20 | Leurres conscience 53 % → <25 % | à la main |
| A22 | Leurres astro2-5 43 % → <25 % | à la main |
| A21 | 7 explications-replis conscience | extraire la bonne phrase |
| A7/A13/A18 | Valeurs à re-sourcer (quanta1, matiere2, Solvay 29/17) | web |
| S1-S3 | Sauvegarde Supabase | plan complet dans tools/PLAN_CLOUD.md, SQL prêt, S2 à trancher |
| C1b | 93 questions de fouille sans appui dans le corpus | rapport tools/RAPPORT_C1.txt |
| C2b/C3 | Relecture conjugaison+lecture ; monter le niveau ensuite | |
| I3, M1-M4 | Interface/mécanique mineurs | registre |

## Fichiers qui comptent

`tools/` : BACKLOG.md (registre), AUDIT_SERIES.md (garanties + trous),
PACK_*.md (docs de conception, la référence), liens_series.py (table des
liens, main tenue), conv_packs.py (markdown→bloc), qc.js / smoke.js /
ui_niveaux.js / exploit_check.js / profils_test.js (portes), version.js,
PLAN_CLOUD.md. Sources conscience : le JSON de Denis (uploads de la session
précédente, contenu intégré au bloc 41).
