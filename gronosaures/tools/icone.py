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
import argparse, glob, os, re, sys
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
    for t in (192, 512):
        carre.resize((t, t), Image.LANCZOS).save(os.path.join(dest, "icone-%d.png" % t))
    t = 512
    b = Image.new("RGB", (t, t), FOND)
    m = int(t * 0.76)
    b.paste(carre.resize((m, m), Image.LANCZOS), ((t - m) // 2, (t - m) // 2))
    b.save(os.path.join(dest, "icone-maskable-512.png"))
    print("  Icônes régénérées depuis %s — %s" % (a.id, N.get(a.id, "")))
    print("  → %s" % dest)
    print("  Pense à forcer la mise à jour dans l'application pour les voir changer.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
