#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tools/telecharger_art.py — rapatrier les six images des packs d'histoire de l'art.

CE QU'IL TE FAUT
----------------
Rien de plus que ce que tu utilises déjà. Ce script n'emploie que la bibliothèque
standard de Python : aucun `pip install`, aucune dépendance à installer. Si la
commande `python3 -m http.server 8080` fonctionne chez toi, celle-ci aussi.

OÙ LE LANCER
------------
Depuis le dossier `atlas/`, celui qui contient index.html et data.js :

    cd /chemin/vers/atlas
    python3 tools/telecharger_art.py --verifier   # n'écrit rien, montre la liste
    python3 tools/telecharger_art.py              # télécharge pour de bon

Sous Windows, écris `python` si `python3` est inconnu. Le script vérifie lui-même
qu'il est au bon endroit et te l'explique sinon.

OÙ ÇA ÉCRIT
-----------
Dans `atlas/art/` : six fichiers .jpg et un CREDITS.md. Le dossier est créé s'il
n'existe pas. Rien d'autre n'est touché — ni data.js, ni les images existantes.
Relancer est sans danger : ce qui est déjà là est laissé tel quel.

SI ÇA ÉCHOUE
------------
Ce n'est pas bloquant. L'application affiche les questions sans image quand le
fichier manque (`onerror="this.remove()"` dans app.js) : rien ne casse, il manque
seulement six illustrations sur les vingt questions du pack Europe.

SOURCE
------
National Gallery of Art, jeu de données ouvert :
https://github.com/NationalGalleryOfArt/opendata
Les images `openaccess` y sont versées au domaine public (CC0) et servies par un
point IIIF stable. C'est plus sûr que Wikimedia, où le statut de la photographie
d'une œuvre varie d'un fichier à l'autre.

Ce script n'a pas pu être exécuté dans l'environnement où il a été écrit, dont les
sorties réseau sont restreintes à quelques domaines dont api.nga.gov ne fait pas
partie. Sur une machine ordinaire, il fonctionne normalement.
"""
import argparse, os, sys, urllib.request, urllib.error

IIIF = "https://api.nga.gov/iiif/{uuid}/full/!1000,1000/0/default.jpg"
RACINE = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
DEST = os.path.join(RACINE, "art")

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


def verifier_emplacement():
    """Refuser de travailler ailleurs que dans un dossier atlas reconnaissable."""
    attendu = os.path.join(RACINE, "data.js")
    if os.path.exists(attendu):
        return True
    print("  Je ne trouve pas data.js à l'endroit attendu :")
    print("     " + attendu)
    print()
    print("  Ce script doit rester dans le dossier tools/ de l'atlas.")
    print("  Place-toi dans le dossier qui contient index.html, puis lance :")
    print("     python3 tools/telecharger_art.py")
    return False


def explique(e):
    """Traduire les erreurs réseau habituelles en français utile."""
    if isinstance(e, urllib.error.HTTPError):
        if e.code == 404:
            return ("le serveur répond « introuvable » (404). L'identifiant de "
                    "l'image a probablement changé côté musée.")
        if e.code == 403:
            return ("accès refusé (403). C'est le plus souvent un proxy ou un "
                    "réseau d'entreprise qui filtre. Réessaie depuis une "
                    "connexion domestique.")
        return "le serveur a répondu par une erreur %s." % e.code
    if isinstance(e, urllib.error.URLError):
        return ("impossible de joindre api.nga.gov. Vérifie ta connexion, ou un "
                "pare-feu / proxy qui bloquerait la sortie.")
    if isinstance(e, TimeoutError):
        return "le serveur n'a pas répondu dans les 90 secondes."
    return "%s — %s" % (type(e).__name__, e)


def main():
    ap = argparse.ArgumentParser(
        description="Rapatrie six images du domaine public pour les packs d'histoire de l'art.")
    ap.add_argument("--verifier", action="store_true",
                    help="affiche la liste sans rien telecharger ni ecrire")
    ap.add_argument("--refaire", action="store_true",
                    help="retelecharge meme les fichiers deja presents")
    a = ap.parse_args()

    print()
    print("  Images d'art — National Gallery of Art (domaine public, CC0)")
    print("  " + "-" * 58)
    if not verifier_emplacement():
        return 1
    print("  Destination : " + DEST)
    print()

    if a.verifier:
        for local, m in MANIFESTE.items():
            etat = "déjà là" if os.path.exists(os.path.join(DEST, local)) else "à prendre"
            print("  [%-9s] %-24s %-22s « %s »" % (etat, local, m["auteur"][:22], m["titre"][:32]))
        print()
        print("  Essai à blanc : rien n'a été téléchargé ni écrit.")
        print("  Relance sans --verifier pour télécharger.")
        return 0

    os.makedirs(DEST, exist_ok=True)
    credits, echecs, pris, sautes = [], [], 0, 0

    for local, m in MANIFESTE.items():
        url = IIIF.format(uuid=m["uuid"])
        credits.append(
            "- **%s** — %s, %s, %s\n"
            "  - domaine public (open access NGA, CC0)\n"
            "  - fiche : https://www.nga.gov/artworks/%s\n"
            "  - image : %s\n" % (local, m["titre"], m["auteur"], m["date"], m["objectid"], url))
        chemin = os.path.join(DEST, local)

        if os.path.exists(chemin) and not a.refaire:
            print("  ✓ %-24s déjà présent, laissé tel quel" % local)
            sautes += 1
            continue

        print("  … %-24s téléchargement" % local, end="", flush=True)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "AtlasTempsProfond/1.0"})
            donnees = urllib.request.urlopen(req, timeout=90).read()
            # Un JPEG commence par FF D8. Sinon on a reçu une page d'erreur HTML,
            # et mieux vaut le dire que d'écrire un fichier illisible.
            if not donnees.startswith(b"\xff\xd8"):
                raise ValueError("la réponse n'est pas une image JPEG")
            open(chemin, "wb").write(donnees)
            print("\r  ✓ %-24s %6.0f Ko          " % (local, len(donnees) / 1024))
            pris += 1
        except Exception as e:
            print("\r  ✗ %-24s échec                    " % local)
            echecs.append((local, explique(e)))

    entete = ("# Crédits des images\n\n"
              "Source : National Gallery of Art, jeu de données ouvert (CC0).\n"
              "Rapatriées par `tools/telecharger_art.py`.\n\n")
    open(os.path.join(DEST, "CREDITS.md"), "w", encoding="utf-8").write(
        entete + "\n".join(credits))

    print()
    print("  %d téléchargée(s), %d déjà présente(s), %d en échec." % (pris, sautes, len(echecs)))
    print("  Crédits écrits dans " + os.path.join(DEST, "CREDITS.md"))

    if echecs:
        print()
        print("  Détail des échecs :")
        for local, raison in echecs:
            print("    %s : %s" % (local, raison))
        print()
        print("  Ce n'est pas bloquant : l'application affiche les questions sans")
        print("  image quand le fichier manque, rien ne casse.")
    else:
        print()
        print("  Terminé. Recharge l'application : les images apparaissent après")
        print("  une bonne réponse dans le pack « Histoire de l'art — Europe ».")
    return 1 if echecs else 0


if __name__ == "__main__":
    sys.exit(main())
