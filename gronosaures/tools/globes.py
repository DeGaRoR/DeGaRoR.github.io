#!/usr/bin/env python3
"""
tools/globes.py — extraire les pastilles de globe des vues satellites.

Chaque vue de site porte, en bas à droite, un petit globe qui situe le continent
sur la Terre d'aujourd'hui. Sur un téléphone, ce coin était perdu deux fois :
le cadrage `cover` rogne les côtés d'une image de ratio 1,65 sur un écran de
ratio 2,1, et le bloc de texte de l'introduction se pose exactement dessus.

Plutôt que de tordre le cadrage, on extrait le globe en pastille circulaire et on
le pose comme élément d'interface, au-dessus du voile, là où rien ne le masque.

    python3 tools/globes.py            # écrit globes/{SITE}.png
    python3 tools/globes.py --planche  # planche de contrôle des 19 pastilles

La boîte est fixe et a été calée à l'œil puis vérifiée sur les dix-neuf sites :
les globes varient un peu en taille et en position, la marge absorbe l'écart.
Après ajout d'un site, relancer avec --planche et vérifier que le nouveau globe
est entier.
"""
import argparse, glob, os
from PIL import Image, ImageDraw

# Les vues de site partagent leur largeur (800 px) mais pas leur hauteur : elle
# varie de 1131 à 1318 px selon les lots de génération. La boîte est donc exprimée
# en fraction, ancrée au coin bas-droit, et non en pixels absolus.
FRAC = (0.650, 0.800, 0.985, 0.997)   # gauche, haut, droite, bas
TAILLE = 180
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")

def boite(taille):
    W, H = taille
    return (int(W*FRAC[0]), int(H*FRAC[1]), int(W*FRAC[2]), int(H*FRAC[3]))

def pastille(chemin):
    im = Image.open(chemin)
    c = im.crop(boite(im.size)).convert("RGB")
    w, h = c.size
    d = min(w, h)
    c = c.crop(((w-d)//2, (h-d)//2, (w-d)//2+d, (h-d)//2+d)).resize((TAILLE, TAILLE), Image.LANCZOS)
    m = Image.new("L", (TAILLE, TAILLE), 0)
    ImageDraw.Draw(m).ellipse((2, 2, TAILLE-3, TAILLE-3), fill=255)
    out = Image.new("RGBA", (TAILLE, TAILLE), (0, 0, 0, 0))
    out.paste(c, (0, 0), m)
    return out

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--planche", action="store_true")
    a = ap.parse_args()
    os.makedirs(os.path.join(R, "globes"), exist_ok=True)
    fs = sorted(glob.glob(os.path.join(R, "sites", "*.jpg")))
    faits = []
    for f in fs:
        sid = os.path.basename(f)[:-4]
        if Image.open(f).size[0] != 800:
            print("  largeur inattendue, ignoré :", sid); continue
        pastille(f).save(os.path.join(R, "globes", sid + ".webp"))
        faits.append(sid)
    print(f"  {len(faits)} pastille(s) de {TAILLE} px dans globes/")
    if a.planche:
        n = len(faits); cols = 7
        pl = Image.new("RGB", (90*cols, 90*((n+cols-1)//cols)), (12, 17, 26))
        for i, sid in enumerate(faits):
            im = Image.open(os.path.join(R, "globes", sid + ".webp")).resize((86, 86))
            pl.paste(im, ((i % cols)*90+2, (i//cols)*90+2), im)
        pl.save(os.path.join(R, "globes", "_planche.png"))
        print("  planche de contrôle : globes/_planche.png")
