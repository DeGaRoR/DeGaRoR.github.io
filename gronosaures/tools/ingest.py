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
SRC_CREAT = "/home/claude/w/06_Index_creatures_MVP_complete.csv"
SRC_CREAT_JSON = "/home/claude/w/creatures/06_Index_creatures_MVP.json"
SRC_QUIZ = "/home/claude/w/quiz/quiz_paleontologie_300_questions.json"
# Banque complémentaire, rédigée pour les packs absents de la banque d'origine.
SRC_QUIZ_SUP = "/home/claude/w/quiz_complement.json"

# Les lots ne nomment pas toujours les fichiers d'après le pack_id de l'index.
# Déjà rencontré : LOU_ pour le pack LUO, BEL_ pour le pack NWE.
ALIAS = {"LOU": "LUO", "BEL": "NWE", "GOBI": "NEM", "HELL": "HC",
         "JURNEW": "JUR", "YIX2": "YIX"}

LARGEUR_CARTE = 760
LARGEUR_SITE = 800
QUALITE_CARTE = 84
QUALITE_SITE = 86


def bornes_age(txt):
    """« ≈ 126–122 Ma » → (122, 126) ; « ≈ 125 Ma » → (125, 125).
    Le CSV ne porte plus age_min_ma / age_max_ma, il faut les relire de l'affichage."""
    n = [float(x.replace(",", ".")) for x in re.findall(r"\d+(?:[.,]\d+)?", txt or "")]
    if not n:
        return None, None
    return min(n), max(n)


def charge():
    """Index créatures : CSV complet s'il existe, sinon le JSON d'origine."""
    if os.path.exists(SRC_CREAT):
        import csv
        rows = list(csv.DictReader(open(SRC_CREAT, encoding="utf-8-sig")))
        creatures, packs = [], {}
        for r in rows:
            lo, hi = bornes_age(r.get("age_display", ""))
            r["age_min_ma"], r["age_max_ma"] = lo, hi
            try:
                r["graphical_confidence_score"] = int(float(r.get("graphical_confidence_score") or 0))
            except ValueError:
                r["graphical_confidence_score"] = 0
            creatures.append(r)
            p = packs.setdefault(r["pack_id"], {"pack_id": r["pack_id"],
                                                "pack_name": r.get("pack_name", ""),
                                                "creatures": []})
            p["creatures"].append(r["scientific_name"])
    else:
        d = json.load(open(SRC_CREAT_JSON, encoding="utf-8"))
        creatures = d["creatures"]
        packs = {p["pack_id"]: p for p in d["packs"]}
    q = json.load(open(SRC_QUIZ, encoding="utf-8"))
    qs = list(q if isinstance(q, list) else q.get("questions", q))
    if os.path.exists(SRC_QUIZ_SUP):
        sup = json.load(open(SRC_QUIZ_SUP, encoding="utf-8"))
        qs += list(sup if isinstance(sup, list) else sup.get("questions", sup))
    return creatures, packs, qs


SEPARATEURS = " _-#."


def candidats_fichier(cid):
    """Formes de nom de fichier acceptées pour un creature_id comme « NWE-01 »."""
    pack, num = cid.rsplit("-", 1)
    prefixes = [pack] + [a for a, v in ALIAS.items() if v == pack]
    formes = []
    for p in prefixes:
        formes.append(p + "-" + num)          # HUN-01 #U2014 Nom.png
        formes.append(p + num.lstrip("0"))    # TRI1_Nom.png
        formes.append(p + "_" + num)          # NWE_01_Nom.png
    return formes


def trouve_illustration(cid, fichiers, espece=None):
    """Trois conventions rencontrées :
         HUN-01 #U2014 Nom.png     — identifiant complet
         TRI1_Nom.png              — identifiant sans zéro
         GOBI_Nom scientifique.png — pack (ou alias) + nom d'espèce, sans numéro

    Le nom d'espèce est essayé EN PREMIER : la forme courte « pack + numéro »
    entre en collision avec les alias numérotés — « YIX » + créature 2 donne
    « YIX2 », qui est aussi le préfixe de tout un lot.
    """
    pack = cid.rsplit("-", 1)[0]
    prefixes = [pack] + [a for a, v in ALIAS.items() if v == pack]
    if espece:
        cle = normalise(espece)
        for x in fichiers:
            base = os.path.splitext(x)[0]
            if not any(base.upper().startswith(p) for p in prefixes):
                continue
            reste = normalise(base.split("_", 1)[-1] if "_" in base else base)
            # égalité stricte d'abord : « Yi qi » est trop court pour l'inclusion
            if reste and reste == cle:
                return x
            # inclusion ensuite : tolère « lujiatunensi » pour « lujiatunensis »
            if len(reste) > 8 and (reste in cle or cle in reste):
                return x
    for f in candidats_fichier(cid):
        m = [x for x in fichiers
             if x.startswith(f) and x[len(f):len(f) + 1] in SEPARATEURS]
        if m:
            return m[0]
    return None


def trouve_vue(pid, fichiers, nom_pack="", especes=()):
    """Vue de site : fichier sous le pack_id (ou un alias) dont le reste du nom ne
    correspond à aucune espèce du pack. Exemples rencontrés : BURG.jpg, JURNEW.png,
    GOBI_NemegtLeGobiVert.png, MOR_MorrisonValley.png."""
    prefixes = [pid] + [a for a, v in ALIAS.items() if v == pid]
    cles = [normalise(e) for e in especes]
    exact, approx = None, None
    for f in fichiers:
        base = os.path.splitext(f)[0]
        if not any(base.upper().startswith(p) for p in prefixes):
            continue
        if base.upper() in prefixes:
            exact = f
            continue
        reste = normalise(base.split("_", 1)[-1] if "_" in base else base)
        if any(reste and (reste in k or k in reste) for k in cles):
            continue                      # c'est une créature, pas la vue de site
        if any(ch.isdigit() for ch in base):
            continue
        approx = approx or f
    if exact or approx:
        return exact or approx
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


def liste_assets(chemins):
    """Accepte plusieurs répertoires séparés par une virgule."""
    out = {}
    for d in (chemins or "").split(","):
        d = d.strip()
        if d and os.path.isdir(d):
            for f in os.listdir(d):
                out.setdefault(f, os.path.join(d, f))
    return out


def inventaire(packs_demandes, dossier_assets):
    creat, packs, quiz = charge()
    print("Packs présents dans l'index :", " ".join(sorted(packs)))
    idx = liste_assets(dossier_assets)
    fichiers = sorted(idx)
    print("Fichiers dans le lot :", len(fichiers))
    ecarts = []
    for pid in packs_demandes:
        cr = [c for c in creat if c["pack_id"] == pid]
        qz = [q for q in quiz if q["pack_id"] == pid]
        ligne = f"  {pid:<5} créatures {len(cr):>2}  questions {len(qz):>2}"
        if len(cr) < 6:
            ecarts.append(f"{pid} : seulement {len(cr)} créatures dans l'index")
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
                f = trouve_illustration(c["creature_id"], fichiers, c["scientific_name"])
                if f:
                    trouves += 1
                    if not f.startswith(c["creature_id"]):
                        ecarts.append(f"{pid} : {c['creature_id']} livré sous « {f} »")
                else:
                    ecarts.append(f"{pid} : illustration absente pour {c['creature_id']}")
            vue = trouve_vue(pid, fichiers, packs[pid].get("pack_name", ""),
                             [c["scientific_name"] for c in cr])
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
    idx = liste_assets(dossier_assets)
    fichiers = sorted(idx)
    os.makedirs(os.path.join(RACINE, "cartes"), exist_ok=True)
    os.makedirs(os.path.join(RACINE, "sites"), exist_ok=True)
    n = 0
    for pid in packs_demandes:
        for c in [x for x in creat if x["pack_id"] == pid]:
            cid = c["creature_id"]
            src = trouve_illustration(cid, fichiers, c["scientific_name"])
            if not src:
                print("  ! illustration absente :", cid)
                continue
            im = Image.open(idx[src]).convert("RGB")
            h = round(im.height * LARGEUR_CARTE / im.width)
            im = im.resize((LARGEUR_CARTE, h), Image.LANCZOS)
            im.save(os.path.join(RACINE, "cartes", cid + ".jpg"), quality=QUALITE_CARTE, optimize=True)
            n += 1
        # Vue de site : le préfixe du fichier ne suit pas toujours le pack_id
        # (déjà rencontré : LOU_Luoping.png pour le pack LUO).
        vue = trouve_vue(pid, fichiers, packs[pid].get("pack_name", ""),
                         [c["scientific_name"] for c in [x for x in creat if x["pack_id"] == pid]])
        if vue and not vue.upper().startswith(pid):
            print(f"  ~ {pid} : vue de site rattachée depuis « {vue} »")
        if not vue:
            print("  ! vue de site absente :", pid)
            continue
        im = Image.open(idx[vue]).convert("RGB")
        h = round(im.height * LARGEUR_SITE / im.width)
        im.resize((LARGEUR_SITE, h), Image.LANCZOS).save(
            os.path.join(RACINE, "sites", pid + ".jpg"), quality=QUALITE_SITE, optimize=True)
        n += 1
    print(f"  {n} images converties")


def bloc1(packs_demandes, sortie):
    """Une fiche sans illustration afficherait une image cassée dans la collection :
    on n'émet que les créatures dont le JPEG existe réellement sur le disque."""
    creat, packs, quiz = charge()
    C, Q, ecartees = [], [], []
    for pid in packs_demandes:
        for c in [x for x in creat if x["pack_id"] == pid]:
            if not os.path.exists(os.path.join(RACINE, "cartes", c["creature_id"] + ".jpg")):
                ecartees.append(c["creature_id"] + " " + c["scientific_name"])
                continue
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
                "pack": c.get("pack_name", ""),
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
    if ecartees:
        print(f"  {len(ecartees)} créature(s) écartée(s), faute d'illustration :")
        for e in ecartees:
            print("     ·", e)


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
