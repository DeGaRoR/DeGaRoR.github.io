#!/usr/bin/env python3
"""
tools/telecharger_art.py — rapatrier les images des packs d'histoire de l'art.

SOURCE : National Gallery of Art, jeu de données ouvert
         https://github.com/NationalGalleryOfArt/opendata

Les images marquées `openaccess` y sont versées au domaine public (CC0) et
servies par un point IIIF stable : api.nga.gov/iiif/{uuid}. C'est nettement plus
sûr que de puiser sur Wikimedia, où le statut de la photographie d'une œuvre
varie d'un fichier à l'autre.

POURQUOI CE SCRIPT N'A PAS ÉTÉ EXÉCUTÉ ICI
------------------------------------------
L'environnement de développement n'autorise les sorties réseau que vers quelques
domaines. github.com est autorisé — c'est ainsi que le catalogue a été lu — mais
api.nga.gov ne l'est pas. Le téléchargement se fait donc sur une machine
ordinaire, où le script fonctionnera normalement.

    python3 tools/telecharger_art.py --verifier   # liste sans télécharger
    python3 tools/telecharger_art.py              # écrit atlas/art/ + CREDITS.md

CE QUE LA COLLECTION NE COUVRE PAS
----------------------------------
63 305 images en accès libre, et essentiellement rien pour Ifé, le Bénin, les
Chola, les Moche ou la peinture Song. La National Gallery est un musée
occidental : sa collection ouverte illustre superbement le premier pack et reste
muette sur le second. Cette asymétrie est exactement le sujet du pack « hors
d'Europe » — elle est ici mesurée plutôt qu'affirmée.
"""
import argparse, json, os, sys, urllib.request

IIIF = "https://api.nga.gov/iiif/{uuid}/full/!1000,1000/0/default.jpg"
DEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "art")

# nom local -> métadonnées, relevées dans data/published_images.csv et objects.csv
MANIFESTE = {
    "ginevra.jpg": {
        "uuid": "8f29e3c9-a289-4d53-abf0-31a66e9e98fa", "objectid": "50724",
        "titre": "Ginevra de' Benci", "auteur": "Leonardo da Vinci", "date": "v. 1474/1478"},
    "annonciation.jpg": {
        "uuid": "46633bd6-4834-40fb-8ce0-fb975c731dc1", "objectid": "46",
        "titre": "The Annunciation", "auteur": "Jan van Eyck", "date": "v. 1434/1436"},
    "falaises_pourville.jpg": {
        "uuid": "31a2c319-1d47-4119-82c1-dbe8f9ed2e58", "objectid": "66425",
        "titre": "Cliffs at Pourville", "auteur": "Claude Monet", "date": "1882"},
    "pont_japonais.jpg": {
        "uuid": "0b9cefb5-1ee4-401a-8154-8d4039191a28", "objectid": "74796",
        "titre": "The Japanese Footbridge", "auteur": "Claude Monet", "date": "1899"},
    "cezanne_eau.jpg": {
        "uuid": "192960e2-e4f3-4645-be6f-414a492e1f48", "objectid": "53119",
        "titre": "At the Water's Edge", "auteur": "Paul Cézanne", "date": "v. 1890"},
    "hiroshige_ara.jpg": {
        "uuid": "6e12c3a9-743d-4c1c-95e5-a136be4c1b27", "objectid": "49078",
        "titre": "Macaw on a Pine Branch", "auteur": "Andō Hiroshige", "date": "1840-1844"},
}

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--verifier", action="store_true")
    a = ap.parse_args()
    os.makedirs(DEST, exist_ok=True)
    credits, echecs = [], []

    for local, m in MANIFESTE.items():
        url = IIIF.format(uuid=m["uuid"])
        print(f"  {local:<24} {m['auteur'][:24]:<24} « {m['titre'][:34]} »")
        credits.append(
            f"- **{local}** — {m['titre']}, {m['auteur']}, {m['date']}\n"
            f"  - domaine public (open access NGA, CC0)\n"
            f"  - fiche : https://www.nga.gov/artworks/{m['objectid']}\n"
            f"  - image : {url}\n")
        if a.verifier:
            continue
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "AtlasTempsProfond/1.0"})
            open(os.path.join(DEST, local), "wb").write(
                urllib.request.urlopen(req, timeout=90).read())
        except Exception as e:
            echecs.append(f"{local} : {type(e).__name__} — {e}")

    if not a.verifier:
        entete = ("# Crédits des images\n\n"
                  "Source : National Gallery of Art, jeu de données ouvert (CC0).\n"
                  "Rapatriées par `tools/telecharger_art.py`.\n\n")
        open(os.path.join(DEST, "CREDITS.md"), "w", encoding="utf-8").write(
            entete + "\n".join(credits))
        print(f"\n  {len(MANIFESTE)} image(s) → {os.path.normpath(DEST)}, crédits dans art/CREDITS.md")
    for e in echecs:
        print("  ÉCHEC :", e, file=sys.stderr)
    sys.exit(1 if echecs else 0)
