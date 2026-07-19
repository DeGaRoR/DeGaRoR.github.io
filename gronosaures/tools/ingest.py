#!/usr/bin/env python3
"""
tools/ingest.py — construire le bloc 1 de data.js et convertir les illustrations.

Ce script ne rédige rien. Il recopie l'index créatures et la banque de questions
tels quels, et redimensionne les images. Toute la partie écrite (ancrage
géographique, accroche, introduction en cinq volets, coût) reste dans le bloc 2,
à la main. Voir tools/AJOUT_PACK.md.

    python3 tools/ingest.py --inventaire
    python3 tools/ingest.py --packs BURG,KAR2,YIX,LUO,EDI,MAZ,CHO,WHA \
        --assets /chemin/vers/le/zip/decompresse --sortie /home/claude/w/data_bloc1.js
"""
import argparse, json, os, re, sys, unicodedata

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_CREAT = "/home/claude/w/creatures/06_Index_creatures_MVP.json"
SRC_QUIZ = "/home/claude/w/quiz/quiz_paleontologie_300_questions.json"

# Les lots ne nomment pas toujours les fichiers d'après le pack_id de l'index.
# Déjà rencontré : LOU_ pour le pack LUO, BEL_ pour le pack NWE.
ALIAS = {"LOU": "LUO", "BEL": "NWE"}

LARGEUR_CARTE = 760
LARGEUR_SITE = 800
QUALITE_CARTE = 84
QUALITE_SITE = 86


def charge():
    d = json.load(open(SRC_CREAT, encoding="utf-8"))
    q = json.load(open(SRC_QUIZ, encoding="utf-8"))
    qs = q if isinstance(q, list) else q.get("questions", q)
    return d["creatures"], {p["pack_id"]: p for p in d["packs"]}, qs


def candidats_fichier(cid):
    """Formes de nom de fichier acceptées pour un creature_id comme « NWE-01 »."""
    pack, num = cid.rsplit("-", 1)
    prefixes = [pack] + [a for a, v in ALIAS.items() if v == pack]
    formes = []
    for p in prefixes:
        formes.append(p + "-" + num)          # HUN-01 #U2014 Nom.png
        formes.append(p + num.lstrip("0"))    # BEL1_Nom.png
        formes.append(p + "_" + num)          # NWE_01_Nom.png
    return formes


def trouve_illustration(cid, fichiers):
    for f in candidats_fichier(cid):
        m = [x for x in fichiers if x.startswith(f) and not x[len(f):len(f)+1].isdigit()]
        if m:
            return m[0]
    return None


def trouve_vue(pid, fichiers, nom_pack=""):
    """Vue de site : fichier sans numéro de créature, sous le pack_id ou un alias."""
    prefixes = [pid] + [a for a, v in ALIAS.items() if v == pid]
    for p in prefixes:
        for f in fichiers:
            base = os.path.splitext(f)[0]
            if base.upper() == p or (base.upper().startswith(p) and
                                     not any(ch.isdigit() for ch in base[len(p):len(p)+2])):
                return f
    cle = normalise(nom_pack.split("—")[0])
    if cle:
        for f in fichiers:
            base = os.path.splitext(f)[0]
            if cle in normalise(base) and not base[-1].isdigit():
                return f
    return None


def normalise(s):
    """Repli pour rapprocher un nom de fichier d'un nom scientifique."""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def inventaire(packs_demandes, dossier_assets):
    creat, packs, quiz = charge()
    print("Packs présents dans l'index :", " ".join(sorted(packs)))
    fichiers = os.listdir(dossier_assets) if dossier_assets and os.path.isdir(dossier_assets) else []
    print("Fichiers dans le lot :", len(fichiers))
    ecarts = []
    for pid in packs_demandes:
        cr = [c for c in creat if c["pack_id"] == pid]
        qz = [q for q in quiz if q["pack_id"] == pid]
        ligne = f"  {pid:<5} créatures {len(cr):>2}  questions {len(qz):>2}"
        if len(cr) != 6:
            ecarts.append(f"{pid} : {len(cr)} créatures au lieu de 6")
        if len(qz) != 20:
            ecarts.append(f"{pid} : {len(qz)} questions au lieu de 20")
        # champs vides
        manquants = {}
        for c in cr:
            for k, v in c.items():
                if v in (None, "", "—"):
                    manquants.setdefault(k, 0)
                    manquants[k] += 1
        if manquants:
            ligne += "   champs vides : " + ", ".join(f"{k}×{v}" for k, v in manquants.items())
        # illustrations
        if fichiers:
            trouves = 0
            for c in cr:
                f = trouve_illustration(c["creature_id"], fichiers)
                if f:
                    trouves += 1
                    if not f.startswith(c["creature_id"]):
                        ecarts.append(f"{pid} : {c['creature_id']} livré sous « {f} »")
                else:
                    ecarts.append(f"{pid} : illustration absente pour {c['creature_id']}")
            vue = trouve_vue(pid, fichiers, packs[pid].get("pack_name", ""))
            if not vue:
                ecarts.append(f"{pid} : vue de site absente — le pack ne peut pas être ouvert")
            elif not vue.upper().startswith(pid):
                ecarts.append(f"{pid} : vue de site livrée sous « {vue} »")
            ligne += f"   illustrations {trouves}/6   vue {'oui' if vue else 'NON'}"
        print(ligne)
    print()
    if ecarts:
        print("ÉCARTS À TRAITER :")
        for e in ecarts:
            print("  ·", e)
    else:
        print("Aucun écart.")
    return ecarts


def convertir(packs_demandes, dossier_assets):
    from PIL import Image
    creat, packs, _ = charge()
    fichiers = os.listdir(dossier_assets)
    os.makedirs(os.path.join(RACINE, "cartes"), exist_ok=True)
    os.makedirs(os.path.join(RACINE, "sites"), exist_ok=True)
    n = 0
    for pid in packs_demandes:
        for c in [x for x in creat if x["pack_id"] == pid]:
            cid = c["creature_id"]
            src = trouve_illustration(cid, fichiers)
            if not src:
                print("  ! illustration absente :", cid)
                continue
            im = Image.open(os.path.join(dossier_assets, src)).convert("RGB")
            h = round(im.height * LARGEUR_CARTE / im.width)
            im = im.resize((LARGEUR_CARTE, h), Image.LANCZOS)
            im.save(os.path.join(RACINE, "cartes", cid + ".jpg"), quality=QUALITE_CARTE, optimize=True)
            n += 1
        # Vue de site : le préfixe du fichier ne suit pas toujours le pack_id
        # (déjà rencontré : LOU_Luoping.png pour le pack LUO).
        vue = trouve_vue(pid, fichiers, packs[pid].get("pack_name", ""))
        if vue and not vue.upper().startswith(pid):
            print(f"  ~ {pid} : vue de site rattachée depuis « {vue} »")
        if not vue:
            print("  ! vue de site absente :", pid)
            continue
        im = Image.open(os.path.join(dossier_assets, vue)).convert("RGB")
        h = round(im.height * LARGEUR_SITE / im.width)
        im.resize((LARGEUR_SITE, h), Image.LANCZOS).save(
            os.path.join(RACINE, "sites", pid + ".jpg"), quality=QUALITE_SITE, optimize=True)
        n += 1
    print(f"  {n} images converties")


def bloc1(packs_demandes, sortie):
    creat, packs, quiz = charge()
    C, Q = [], []
    for pid in packs_demandes:
        for c in [x for x in creat if x["pack_id"] == pid]:
            C.append({
                "id": c["creature_id"], "site": pid, "nom": c["scientific_name"],
                "groupe": c["taxonomic_group"], "periode": c["period"],
                "age": c["age_display"], "ageMin": c["age_min_ma"], "ageMax": c["age_max_ma"],
                "lieu": c["current_fossil_distribution"], "milieu": c["habitat_mode"],
                "regime": c["diet"], "taille": c["length_display"],
                "masse": c["mass_display"] or "Non estimée",
                "longevite": c["longevity_estimate"], "confLong": c["longevity_confidence"],
                "conf": c["graphical_confidence"], "confN": c["graphical_confidence_score"],
                "desc": c["description"], "prudence": c["reconstruction_caution"],
                "src": [[c["source_title_1"], c["source_url_1"]],
                        [c["source_title_2"], c["source_url_2"]]],
                "img": f"cartes/{c['creature_id']}.jpg"})
        for q in [x for x in quiz if x["pack_id"] == pid]:
            Q.append({"id": q["id"], "site": pid, "diff": q["difficulty"],
                      "q": q["question"], "choix": list(q["choices"].values()),
                      "r": q["correct_answer"], "exp": q["explanation"],
                      "src": [q["source_title"], q["source_url"]]})
    j = lambda o: json.dumps(o, ensure_ascii=False)
    txt = ["""/* ================================================================
   LE GRAND ATLAS DU TEMPS PROFOND — data.js
   Bloc 1 : généré par tools/ingest.py depuis 06_Index_creatures_MVP.json
   et quiz_paleontologie_300_questions.json. Ne pas éditer à la main.
   ================================================================ */""",
           f"/* {len(C)} créatures, {len(C)//6} sites. */", "const CREATURES=["]
    txt += [" " + j(c) + "," for c in C]
    txt += ["];", "", f"/* {len(Q)} QCM paléontologiques, 20 par site. */", "const QUIZ_PALEO=["]
    txt += [" " + j(q) + "," for q in Q]
    txt += ["];", ""]
    open(sortie, "w", encoding="utf-8").write("\n".join(txt))
    print(f"  bloc 1 : {len(C)} créatures, {len(Q)} questions → {sortie}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--packs", default="BURG,KAR2,YIX")
    ap.add_argument("--assets", default=None)
    ap.add_argument("--sortie", default="/home/claude/w/data_bloc1.js")
    ap.add_argument("--inventaire", action="store_true")
    a = ap.parse_args()
    P = [p.strip() for p in a.packs.split(",") if p.strip()]
    if a.inventaire:
        inventaire(P, a.assets)
        sys.exit()
    if a.assets:
        convertir(P, a.assets)
    bloc1(P, a.sortie)
