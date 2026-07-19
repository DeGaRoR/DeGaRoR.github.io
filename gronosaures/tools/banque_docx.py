#!/usr/bin/env python3
"""
tools/banque_docx.py — extraire les questions de 03_Banque_complete_questions_MVP.docx.

Le document contient 120 questions en 7 packs, sous forme de fiches textuelles.
Toutes ne sont pas exploitables par l'application :

  · à choix multiple      → les options sont dans l'énoncé, après « Choix : »
  · réponse courte        → saisie libre, corrigée par egal()
  · réponse construite    → un paragraphe attendu, non corrigeable automatiquement

Ce script n'écrit rien : il recopie énoncés, réponses, explications, indices et
liens tels quels, et écarte ce qui n'est pas corrigeable.

    python3 tools/banque_docx.py --packs CGP --sortie w/carto.js --nom CARTO
    python3 tools/banque_docx.py --inventaire
"""
import argparse, json, re, sys

SRC = "/mnt/user-data/uploads/03_Banque_complete_questions_MVP.docx"
NOMS = {"CGP": "Cartes, graphiques et planification", "MAT": "Mathématiques fondamentales",
        "GRA": "Grammaire et conjugaison", "ORT": "Orthographe et accords",
        "FRI": "La frise du vivant", "LIG": "Créatures et lignées",
        "MON": "Mondes, climats et crises"}
def saisissable(rep):
    """Une réponse en saisie libre doit pouvoir être TAPÉE par la joueuse.

    « 2,3 km » ou « 50 % » conviennent. « Cambrien → Permien → Trias → Crétacé »
    ou « un écosystème marin situé au pied d'un escarpement sous-marin » ne
    conviennent pas : la comparaison exigerait une frappe au caractère près.
    Un critère de longueur seul ne suffit pas — il laissait passer les deux.
    """
    r = rep.strip()
    if not r or len(r) > 34:
        return False
    if "→" in r or "," in r or ";" in r:
        return False
    if len(r.split()) > 5:
        return False
    # Une phrase commençant par un article est une définition, pas une réponse.
    if re.match(r"^(un|une|le|la|les|des|il|elle|ils|elles|c'est|ce sont)\b", r, re.I):
        return False
    return True


def lire():
    from docx import Document
    d = Document(SRC)
    out = []
    for t in d.tables:
        txt = t.rows[0].cells[0].text
        m = re.match(r"^([A-Z]{3})-(\d+) — (.+)", txt)
        if not m:
            continue
        lignes = [l.strip() for l in txt.split("\n") if l.strip()]
        meta = [x.strip() for x in lignes[1].split("•")]
        champs, dernier = {}, None
        for l in lignes[2:]:
            mm = re.match(r"^(Question|Réponse attendue|Explication|Indice|Support|"
                          r"Approfondissement)\.\s*(.*)", l)
            if mm:
                dernier = mm.group(1)
                champs[dernier] = mm.group(2)
            elif dernier:
                champs[dernier] += " " + l
        out.append({"pack": m.group(1), "num": int(m.group(2)), "titre": m.group(3),
                    "niveau": meta[0], "theme": meta[1] if len(meta) > 1 else "",
                    "type": meta[2] if len(meta) > 2 else "", **champs})
    return out


def decoupe_choix(enonce):
    """« … ? Choix ou données. Choix : A. x ; B. y ; C. z ; D. w. » → (énoncé, [x,y,z,w])"""
    m = re.search(r"Choix\s*:\s*(.+)$", enonce)
    if not m:
        return enonce, None
    opts = [re.sub(r"^[A-D]\.\s*", "", p).strip().rstrip(".")
            for p in re.split(r"\s*;\s*", m.group(1).rstrip("."))]
    if len(opts) < 3:
        return enonce, None
    q = enonce[:m.start()]
    q = re.sub(r"\s*Choix ou données\.\s*$", "", q).strip()
    return q, opts


NIVEAU = {"Fondation": 1, "Intermédiaire": 2, "Avancé": 3}


def convertit(q):
    enonce, choix = decoupe_choix(q["Question"])
    rep = q["Réponse attendue"].strip().rstrip(".")
    if choix:
        # La réponse attendue doit correspondre à l'une des options, sinon on écarte.
        norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())
        exact = [c for c in choix if norm(c) == norm(rep)]
        proches = [c for c in choix if norm(c) and norm(c) in norm(rep)]
        if exact:
            rep = exact[0]
        elif len(proches) == 1:
            rep = proches[0]
        else:
            # La réponse attendue reformule au lieu de reprendre une option :
            # on retombe alors sur la saisie libre plutôt que d'écarter la fiche.
            enonce, choix = q["Question"], None
            enonce = re.sub(r"\s*Choix ou données\..*$", "", enonce).strip()
        if choix:
            autres = [c for c in choix if c != rep]
            if len(autres) < 2:
                return None, "moins de trois options distinctes"
    if not choix:
        if not saisissable(rep):
            return None, "réponse non saisissable en frappe libre"
        autres = None
    item = {"niv": NIVEAU.get(q["niveau"], 2), "q": enonce, "r": rep,
            "exp": q.get("Explication", "").strip()}
    if autres:
        item["autres"] = autres
    if q.get("Indice"):
        item["indice"] = q["Indice"].strip()
    if q.get("Approfondissement"):
        item["lien"] = [q["Approfondissement"].strip(), ""]
    return item, None


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--packs", default="CGP")
    ap.add_argument("--sortie")
    ap.add_argument("--nom", default="CARTO")
    ap.add_argument("--inventaire", action="store_true")
    a = ap.parse_args()
    Q = lire()

    if a.inventaire:
        print(f"{len(Q)} fiches lues dans le document\n")
        print(f"{'pack':<5} {'nom':<36} {'total':>5} {'retenues':>9} {'écartées':>9}")
        for p, nom in NOMS.items():
            sous = [q for q in Q if q["pack"] == p]
            ok = sum(1 for q in sous if convertit(q)[0])
            print(f"{p:<5} {nom:<36} {len(sous):>5} {ok:>9} {len(sous)-ok:>9}")
        print()
        motifs = {}
        for q in Q:
            it, m = convertit(q)
            if m:
                motifs.setdefault(m, []).append(q["pack"] + "-%02d" % q["num"])
        for m, l in motifs.items():
            print(f"  {m} : {len(l)}")
            print("     ", " ".join(l[:14]) + (" …" if len(l) > 14 else ""))
        sys.exit()

    packs = [p.strip() for p in a.packs.split(",")]
    items, ecartes = [], []
    for q in sorted([q for q in Q if q["pack"] in packs], key=lambda x: (x["pack"], x["num"])):
        it, m = convertit(q)
        (items.append(it) if it else ecartes.append(q["pack"] + "-%02d" % q["num"] + " : " + m))
    j = lambda o: json.dumps(o, ensure_ascii=False)
    txt = [f"const {a.nom}=[", *[" " + j(i) + "," for i in items], "];", ""]
    if a.sortie:
        open(a.sortie, "w", encoding="utf-8").write("\n".join(txt))
    print(f"  {len(items)} question(s) retenue(s) → {a.sortie or 'stdout'}")
    for e in ecartes:
        print("     écartée :", e)
