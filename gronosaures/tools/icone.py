#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tools/icone.py — fabriquer les icônes de l'application à partir d'une créature.

Aucune dépendance hors Pillow, déjà nécessaire aux autres outils.

    python3 tools/icone.py                 # liste les créatures utilisables
    python3 tools/icone.py MOR-02          # Stegosaurus (choix par défaut)
    python3 tools/icone.py MOR-01 --haut 30
    python3 tools/icone.py MOR-02 --apercu # planche de contrôle sans rien écrire

`--haut` est la position, en pourcentage de la hauteur de la carte, du bord
supérieur du carré découpé. Monte-le si l'icône coupe la tête, baisse-le si elle
montre trop de ciel. Les cartes portent un cartouche de nom : le découpage carré
part par défaut à 22 % pour rester sur l'animal.

Écrit trois fichiers dans icones/ :
  icone-192.png, icone-512.png          — usage courant
  icone-maskable-512.png                — marge de 12 %, pour le rognage rond d'Android
"""
import argparse, glob, hashlib, json, os, re, sys
from PIL import Image

R = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
FOND = (10, 15, 26)


def noms():
    """Relever id -> nom depuis data.js, sans exécuter de JavaScript."""
    src = open(os.path.join(R, "data.js"), encoding="utf-8").read()
    out = {}
    for m in re.finditer(r'["\']?id["\']?\s*:\s*["\']([A-Z0-9]+-\d+)["\'].{0,200}?'
                         r'["\']?nom["\']?\s*:\s*["\']([^"\']+)["\']', src, re.S):
        out.setdefault(m.group(1), m.group(2))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("id", nargs="?", help="identifiant de créature, ex. MOR-02")
    ap.add_argument("--haut", type=float, default=22.0,
                    help="bord haut du carré, en %% de la hauteur (défaut 22)")
    ap.add_argument("--apercu", action="store_true", help="planche de contrôle, n'écrit pas les icônes")
    a = ap.parse_args()

    dispo = {os.path.basename(p)[:-5] for p in glob.glob(os.path.join(R, "cartes", "*.webp"))}
    N = noms()
    if not a.id:
        print("\n  Créatures disponibles :\n")
        for i in sorted(dispo):
            print("    %-9s %s" % (i, N.get(i, "")))
        print("\n  Exemple :  python3 tools/icone.py MOR-02\n")
        return 0
    if a.id not in dispo:
        print("  Identifiant inconnu :", a.id)
        print("  Lance le script sans argument pour voir la liste.")
        return 1

    src = os.path.join(R, "cartes", a.id + ".webp")
    im = Image.open(src).convert("RGB")
    w, h = im.size
    y0 = int(h * a.haut / 100)
    if y0 + w > h:
        y0 = max(0, h - w)
        print("  (découpe recalée : %s dépassait le bas de la carte)" % a.id)
    carre = im.crop((0, y0, w, y0 + w))

    if a.apercu:
        pl = Image.new("RGB", (600, 200), FOND)
        for i, t in enumerate((180, 180, 180)):
            v = carre.resize((t, t), Image.LANCZOS)
            if i == 1:
                b = Image.new("RGB", (t, t), FOND)
                m = int(t * 0.76)
                b.paste(carre.resize((m, m), Image.LANCZOS), ((t - m) // 2, (t - m) // 2))
                v = b
            if i == 2:
                v = v.resize((64, 64), Image.LANCZOS).resize((t, t), Image.NEAREST)
            pl.paste(v, (10 + i * 195, 10))
        p = os.path.join(R, "icones", "_apercu.png")
        pl.save(p)
        print("  Planche : %s" % p)
        print("  De gauche à droite : normale, maskable, rendu à 64 px.")
        return 0

    dest = os.path.join(R, "icones")
    os.makedirs(dest, exist_ok=True)

    # On efface les icônes précédentes : leurs noms portent une empreinte, donc
    # elles ne seront pas écrasées et s'accumuleraient dans le cache hors ligne.
    for vieux in glob.glob(os.path.join(dest, "icone-*.png")):
        os.remove(vieux)

    # Le nom porte l'empreinte du contenu. C'est ce qui permet à une icône déjà
    # installée d'être remplacée : Chrome compare le CONTENU DU MANIFESTE pour
    # décider s'il régénère l'icône de l'écran d'accueil. À URL constante, des
    # octets différents ne changent rien pour lui, et l'ancienne icône reste en
    # place indéfiniment. Un nom qui change rend la modification visible.
    ecrites = []
    def ecrire(img, gabarit):
        octets = img.tobytes()
        h = hashlib.sha256(octets).hexdigest()[:8]
        nom = gabarit % h
        img.save(os.path.join(dest, nom))
        ecrites.append(nom)
        return nom

    n192 = ecrire(carre.resize((192, 192), Image.LANCZOS), "icone-192.%s.png")
    n512 = ecrire(carre.resize((512, 512), Image.LANCZOS), "icone-512.%s.png")
    t = 512
    b = Image.new("RGB", (t, t), FOND)
    m = int(t * 0.76)
    b.paste(carre.resize((m, m), Image.LANCZOS), ((t - m) // 2, (t - m) // 2))
    nmsk = ecrire(b, "icone-maskable-512.%s.png")

    # Le manifeste et le cache hors ligne doivent suivre, sinon l'application
    # réclame des fichiers qui n'existent plus.
    pm = os.path.join(R, "manifest.json")
    man = json.load(open(pm, encoding="utf-8"))
    man["icons"] = [
        {"src": "icones/" + n192, "sizes": "192x192", "type": "image/png", "purpose": "any"},
        {"src": "icones/" + n512, "sizes": "512x512", "type": "image/png", "purpose": "any"},
        {"src": "icones/" + nmsk, "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
    ]
    with open(pm, "w", encoding="utf-8") as f:
        json.dump(man, f, ensure_ascii=False, indent=2)
        f.write("\n")

    # Toute référence à une ancienne icône doit disparaître, où qu'elle se
    # trouve sur la ligne : le service worker précharge cette liste d'un bloc et
    # un seul fichier manquant fait échouer l'installation entière.
    psw = os.path.join(R, "sw.js")
    sw = open(psw, encoding="utf-8").read()
    sw = re.sub(r"'\./icones/icone-[^']*',?\s*", "", sw)
    sw = sw.replace(
        "'./monde-min.webp',",
        "'./monde-min.webp',\n  './icones/%s', './icones/%s',\n  './icones/%s'," % (n192, n512, nmsk),
        1)
    open(psw, "w", encoding="utf-8").write(sw)

    # Safari n'ouvre pas le manifeste pour l'écran d'accueil : il lit
    # `apple-touch-icon` dans le HTML. L'oublier laisserait l'iPhone sur une
    # référence morte, donc sur une icône générique.
    ph = os.path.join(R, "index.html")
    html = open(ph, encoding="utf-8").read()
    html = re.sub(r'(<link rel="apple-touch-icon" href=")[^"]*(")',
                  r"\g<1>icones/" + n192 + r"\g<2>", html)
    open(ph, "w", encoding="utf-8").write(html)

    print("  Icônes régénérées depuis %s — %s" % (a.id, N.get(a.id, "")))
    for n in ecrites:
        print("    %s" % n)
    print("  manifest.json et sw.js mis à jour.")
    print()
    print("  Une icône DÉJÀ INSTALLÉE ne se remplace pas partout de la même façon :")
    print("    Android  Chrome revérifie le manifeste environ une fois par jour")
    print("             et réinstalle l'icône seul. L'empreinte dans le nom est")
    print("             ce qui lui signale le changement.")
    print("    iPhone   Safari fige l'icône à l'ajout à l'écran d'accueil et ne")
    print("             la met JAMAIS à jour : il faut retirer puis rajouter.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
