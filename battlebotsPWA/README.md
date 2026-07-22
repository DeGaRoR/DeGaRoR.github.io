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
- `styles.css`  styles
- `data.js`     données pures : i18n (STRINGS), sprites base64, taxonomie (TIERS)
- `engine.js`   moteur pur, déterministe, sans DOM — marqueurs ENGINE-START/END
- `app.js`      état, éditeur, tournois, rendu, UI
- `assets/`     sprites webp (35 fichiers) — la refonte graphique = remplacer ces fichiers
- `sw.js`       hors-ligne (precache + cache-first, TOUS les assets précachés)
- `manifest.webmanifest`, `icon.svg`

## Règles
1. **`pwa/` est la source de vérité.** Le monolithe ai-roboclash-s4.html est archivé, ne plus l'éditer.
2. À chaque livraison : bosser `CACHE = "roboclash-vN"` dans sw.js (invalide l'ancien cache).
3. Ordre de chargement intangible : data → engine → app.
4. engine.js ne référence jamais data.js ni app.js (vérifié par la porte).
5. Sauvegardes versionnées : jamais de bosse de SAVE_V sans migration (app.js).

## QC
Harness dans le dépôt frère `roboclash-qc/` : `npm install jsdom && node tools/gate.js`
→ doit afficher `PORTE: ÉCHECS (0)` (127 vérifications).
