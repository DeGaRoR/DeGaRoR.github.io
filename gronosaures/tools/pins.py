#!/usr/bin/env python3
"""
tools/pins.py — placer une épingle sur monde.jpg à partir de (longitude, latitude).

Pourquoi ce n'est pas une simple formule : monde.jpg est une image générée, pas une
projection. L'échelle longitudinale mesurée varie de 4,2 px/degré au Proche-Orient à
6,6 px/degré en Asie de l'Est. Un ajustement affine global laisse des résidus de
±90 px, soit plus de 1 500 km. On ajuste donc une transformation affine LOCALE, pondérée par une gaussienne, sur
des amers relevés dans l'image elle-même : mers intérieures et îles isolées, dont
l'identification ne prête pas à discussion. Une pondération inverse de la distance
ne convient pas — elle s'effondre vers la valeur de l'amer le plus proche et colle
deux sites voisins l'un sur l'autre. L'affine local conserve l'échelle.

La sortie reste une proposition. Deux garde-fous :
  1. l'épingle est ramenée sur la terre ferme la plus proche si elle tombe en mer ;
  2. `tools/qc.js` revérifie ce point à chaque livraison, via masque_terre.json.

Usage :
    python3 tools/pins.py                  # recalcule les huit sites
    python3 tools/pins.py 30.04 29.27      # une position ponctuelle
"""
import json, os, sys
import numpy as np

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---------------------------------------------------------------------------
# Amers relevés sur monde.jpg. Mers intérieures et îles isolées uniquement :
# leur forme les rend identifiables sans ambiguïté, contrairement à un point de
# côte quelconque. Coordonnées réelles arrondies au dixième de degré.
# ---------------------------------------------------------------------------
AMERS = [
    # nom                        lon     lat      x     y
    ("détroit de Gibraltar",   -5.6,   36.0,   709,  389),
    ("golfe d'Iskenderun",     36.2,   36.6,   897,  390),
    ("mer Noire",              34.5,   43.5,   887,  343),
    ("mer Caspienne",          50.5,   41.5,   960,  350),
    ("mer Rouge",              38.0,   21.5,   912,  488),
    ("golfe Persique",         52.0,   27.0,   973,  447),
    ("lac Supérieur",         -87.8,   47.7,   346,  290),
    ("lac Michigan-Huron",    -85.5,   43.8,   338,  314),
    ("Madagascar",             46.9,  -18.8,   946,  717),
    ("cap des Aiguilles",      20.0,  -34.8,   729,  854),
    ("pointe des Almadies",   -17.5,   14.7,   528,  570),
    ("cap Byron",             153.6,  -28.6,  1433,  753),
    ("Japon",                 138.3,   37.5,  1485,  311),
    ("cap Comorin",            77.6,    8.1,  1086,  553),
    ("Sri Lanka",              80.7,    7.9,  1100,  556),
    ("Nouvelle-Guinée",       141.0,   -5.4,  1376,  618),
    ("cap Horn",              -67.3,  -56.0,   433,  913),
    ("baie d'Hudson",         -85.5,   59.5,   397,  199),
    ("mer Baltique",           19.0,   59.0,   819,  236),
    ("lac Baïkal",            107.5,   53.5,  1179,  260),
    ("Nouvelle-Zélande sud",  170.5,  -43.7,  1465,  878),
]

# Sites du jeu. Pour les packs non géographiques, voir tools/AJOUT_PACK.md § 5.
# Position retenue dans data.js, pour comparaison avec la proposition.
SITES = [
    ("EDI",  "Zimnie Gory, mer Blanche",      40.00,  65.60,  913, 193),
    ("BURG", "col de Burgess, Yoho",        -116.47,  51.43,  204, 266),
    ("CHO",  "Bear Gulch, Montana",         -108.90,  47.10,  238, 294),
    ("MAZ",  "Mazon Creek, Illinois",        -88.25,  41.35,  332, 331),
    ("KAR2", "Grand Karoo",                   22.50, -32.30,  747, 831),
    ("LUO",  "Luoping, Yunnan",              104.30,  24.90, 1210, 440),
    ("YIX",  "Beipiao, Liaoning",            120.80,  41.60, 1311, 311),
    ("WHA",  "Ouadi al-Hitan, Fayoum",        30.04,  29.27,  882, 448),
]

SIGMA = 45.0   # portée de la pondération, en degrés ; calibrée par contrôle croisé
RIDGE = 1e-3   # régularisation, pour les régions où les amers sont presque alignés


def interpole(lon, lat, amers=AMERS, sigma=SIGMA):
    """Régression affine pondérée : x, y = f(lon, lat), ajustée autour du point."""
    L = np.array([[a[1], a[2], 1.0] for a in amers])
    X = np.array([a[3] for a in amers], float)
    Y = np.array([a[4] for a in amers], float)
    d = np.hypot(L[:, 0] - lon, L[:, 1] - lat)
    W = np.diag(np.exp(-(d / sigma) ** 2) + 1e-6)
    A = L.T @ W @ L + RIDGE * np.eye(3)
    cx = np.linalg.solve(A, L.T @ W @ X)
    cy = np.linalg.solve(A, L.T @ W @ Y)
    v = np.array([lon, lat, 1.0])
    return float(v @ cx), float(v @ cy)


def controle_croise():
    """Erreur en laissant chaque amer de côté : ordre de grandeur de la précision."""
    err = []
    for i, a in enumerate(AMERS):
        autres = AMERS[:i] + AMERS[i + 1:]
        x, y = interpole(a[1], a[2], autres)
        err.append((a[0], x - a[3], y - a[4]))
    return err


def charge_masque():
    p = os.path.join(RACINE, "tools", "masque_terre.json")
    if not os.path.exists(p):
        return None
    m = json.load(open(p))
    bits = np.unpackbits(np.frombuffer(bytes.fromhex(m["bits"]), dtype=np.uint8))
    return m, bits[: m["h"] * m["w"]].reshape(m["h"], m["w"]).astype(bool)


def sur_terre(x, y, meta, masque):
    if masque is None:
        return None
    c = int(x / meta["echelle"]), int(y / meta["echelle"])
    if not (0 <= c[1] < meta["h"] and 0 <= c[0] < meta["w"]):
        return False
    return bool(masque[c[1], c[0]])


def ramene_sur_terre(x, y, meta, masque, rmax=60):
    """Si l'épingle tombe en mer, la ramener sur le point de terre le plus proche."""
    if masque is None or sur_terre(x, y, meta, masque):
        return round(x), round(y), 0.0
    e = meta["echelle"]
    ys, xs = np.where(masque)
    d = np.hypot(xs * e - x, ys * e - y)
    i = int(np.argmin(d))
    if d[i] > rmax:
        return round(x), round(y), float(d[i])
    return int(xs[i] * e + e / 2), int(ys[i] * e + e / 2), float(d[i])


if __name__ == "__main__":
    meta, masque = charge_masque() if charge_masque() else (None, None)

    if len(sys.argv) == 3:
        lon, lat = float(sys.argv[1]), float(sys.argv[2])
        x, y = interpole(lon, lat)
        print("proposition : (%d, %d)" % (round(x), round(y)))
        if masque is not None:
            print("sur terre   :", sur_terre(x, y, meta, masque))
        sys.exit()

    print("Contrôle croisé (erreur quand l'amer est retiré du jeu) :")
    e = controle_croise()
    for nom, dx, dy in e:
        print("  %-24s Δx %+6.1f  Δy %+6.1f" % (nom, dx, dy))
    n = np.array([np.hypot(dx, dy) for _, dx, dy in e])
    print("  → erreur médiane %.0f px, maximum %.0f px\n" % (np.median(n), n.max()))

    print("Proposition vs position retenue dans data.js :")
    for pid, nom, lon, lat, rx, ry in SITES:
        x, y = interpole(lon, lat)
        xs, ys, dep = ramene_sur_terre(x, y, meta, masque)
        ecart = np.hypot(xs - rx, ys - ry)
        terre = sur_terre(rx, ry, meta, masque)
        print("  %-5s %-28s proposé (%4d,%4d)  retenu (%4d,%4d)  écart %3.0f px  %s"
              % (pid, nom, xs, ys, rx, ry, ecart,
                 "terre ferme" if terre else "!! EN MER !!"))
    print("\nLa correction manuelle est attendue : la proposition n'est qu'un point"
          "\nde départ, on tranche à l'œil sur le masque. Voir AJOUT_PACK.md § 6.")
