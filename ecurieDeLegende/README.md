# Écurie de Légendes — PWA

Jeu de collection de chevaux pour Énola et Anaé : tirages, évolutions, révisions
(programme belge P3/P5), duels de concours, marchand et renommée.

## Déploiement sur GitHub Pages

1. Pousse **tout le contenu de ce dossier** à la racine du dépôt (ou dans `/docs`).
2. Active Pages : Settings → Pages → Deploy from branch → `main` / racine (ou `/docs`).
3. Ouvre `https://<user>.github.io/<repo>/` sur le téléphone.
4. Menu du navigateur → **« Ajouter à l'écran d'accueil »** → l'app s'installe
   (icône Pégase, plein écran, portrait).

Tous les chemins sont **relatifs** : ça fonctionne aussi bien à la racine d'un
domaine que sous `/<repo>/` sur github.io.

## Hors-ligne

Le service worker (`sw.js`) précache l'app et les 51 illustrations au premier
lancement. Ensuite, tout fonctionne **sans connexion** (les polices Google
gardent leur repli système hors-ligne).

## Mise à jour

À chaque modification déployée, **incrémente `VERSION` dans `sw.js`**
(`ecurie-v1` → `ecurie-v2`) : l'ancien cache est purgé et les clients
récupèrent la nouvelle version au rechargement suivant.

## Sauvegardes

Les profils (Énola, Anaé, …) sont dans le `localStorage` du navigateur,
liés au domaine. Elles survivent aux mises à jour de l'app, mais pas à un
changement de domaine ni à un effacement des données du site.

## Structure

```
index.html            l'app (HTML+CSS+JS, ~110 Ko)
manifest.json         manifeste PWA
sw.js                 service worker (précache + hors-ligne)
icon-192.png          icônes PWA (Pégase)
icon-512.png
icon-maskable-512.png
apple-touch-icon.png
cartes/*.jpg          51 illustrations (une par cheval, id = nom de fichier)
```

## Ajouter un cheval

1. Déposer `cartes/mon_cheval.jpg` (portrait, ~440 px de large suffit).
2. Dans `index.html` : ajouter `mon_cheval:"cartes/mon_cheval.jpg",` dans `IMG`
   et une entrée dans `CARTES` (`id`, `nom`, `rarete`, `emoji`, `image:IMG.mon_cheval`,
   `desc`, `aff:[...]`).
3. Ajouter `"./cartes/mon_cheval.jpg"` à la liste `IMAGES` de `sw.js`
   et incrémenter `VERSION`.
