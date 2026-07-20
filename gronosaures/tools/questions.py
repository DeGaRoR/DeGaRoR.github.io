# -*- coding: utf-8 -*-
"""Génère les entrées QUIZ_PALEO d'un pack depuis son fichier tools/PACK_*.md.

Lit deux sections :
  « ## Les vingt questions »  — format  N. **Énoncé ?** · *clé* · leurre · leurre · leurre
  « ## Les explications »     — format  N. Une phrase.

Le texte livré est donc rigoureusement celui qui a été mesuré par
tools/qcm_brouillon.js. Une explication manquante est une erreur : c'est la
dette repérée à la v64, et le générateur refuse désormais de la reconduire.
"""
import re, sys

def _sections(src, titre, fin):
    d = src.index(titre); f = src.index(fin, d)
    return src[d:f]

def lire(pack, racine='tools'):
    src = open('%s/PACK_%s.md' % (racine, pack), encoding='utf-8').read()
    qs = []
    for brut in re.split(r'\n(?=\s*\d+\.\s)', _sections(src, '## Les vingt questions', '\n---')):
        t = re.sub(r'\s*\n\s*', ' ', brut).strip()
        m = re.match(r'^(\d+)\.\s*(.*)$', t)
        if not m: continue
        parts = [x.strip() for x in m.group(2).split('·') if x.strip()]
        if len(parts) != 5: continue
        nu = lambda x: x.replace('**', '').replace('*', '').strip()
        qs.append((int(m.group(1)), nu(parts[0]), nu(parts[1]), [nu(p) for p in parts[2:]]))
    exps = {}
    if '## Les explications' in src:
        for ligne in _sections(src, '## Les explications', '\n---').split('\n'):
            m = re.match(r'^(\d+)\.\s*(.+)$', ligne.strip())
            if m: exps[int(m.group(1))] = m.group(2).strip()
    manque = [n for n, *_ in qs if not exps.get(n)]
    if manque:
        raise SystemExit('PACK_%s : explications manquantes pour %s' % (pack, manque))
    return [(n, q, r, a, exps[n]) for n, q, r, a in qs]

def js(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"

def bloc(packs, sources, entete):
    out = [entete]
    for pack in packs:
        titre, url = sources[pack]
        ent = []
        for n, q, r, autres, exp in lire(pack):
            # Pas de champ `diff` : rien ne le lit. Il était attribué par rang de
            # question, donc faux, et donnait l'illusion d'un dosage.
            ent.append("{id:%s, site:%s,\n  q:%s,\n  choix:[%s],\n  r:%s,\n  exp:%s,\n  src:[%s,%s]}" % (
                js('%s-%02d' % (pack, n)), js(pack), js(q),
                ', '.join(js(x) for x in [r] + autres), js(r), js(exp), js(titre), js(url)))
        out.append('\nQUIZ_PALEO.push(\n' + ',\n'.join(ent) + ');\n')
    return ''.join(out)
