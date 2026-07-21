import re, json, sys

def parse(path):
    s=open(path,encoding='utf-8').read()
    niveaux=[]
    for bl in s.split('## Niveau ')[1:]:
        titre=bl.split('\n')[0].strip()
        num, nom = titre.split('—',1)
        nom=nom.strip()
        # volets
        # Un volet court jusqu'au volet suivant ou jusqu'au titre de section.
        # La première version s'arrêtait à la première ligne vide : tout volet
        # contenant une équation en bloc citation perdait l'équation, qui est
        # précisément ce que le volet servait à montrer. Le défaut ne se voyait
        # pas dans le markdown, seulement dans les données engendrées.
        volets=[re.sub(r'\s*\n\s*',' ',m.group(2)).strip()
                for m in re.finditer(r'\*\*([IVX]+)\.\*\*[ ](.+?)(?=\n\*\*[IVX]+\.\*\*[ ]|\n### |\n---|\n## |\Z)',
                                     bl, re.S)]
        # Les notes en italique isolées (anecdotes de fin) restent dans le
        # dernier volet, ce qui est voulu.
        volets=[re.sub(r'\s{2,}', ' ', v) for v in volets]
        volets=[re.sub(r'\*\*(.+?)\*\*', r'\1', v) for v in volets]
        volets=[re.sub(r'\*(.+?)\*', r'\1', v) for v in volets]
        volets=[v.replace('> ','').strip() for v in volets]
        # Les accents graves du markdown balisent les symboles ; l'écran les
        # afficherait tels quels. On les rend en guillemets français, qui sont
        # la ponctuation de tout le reste de l'atlas.
        volets=[re.sub(r'`([^`]+)`', r'« \1 »', v) for v in volets]
        # questions
        qs=[]
        for b in re.split(r'\n(?=\d+\. \*\*)', bl):
            if not re.match(r'^\d+\. \*\*', b): continue
            t=re.sub(r'\s*\n\s*',' ', b.split('\n\n')[0]).strip()
            p=[x.strip() for x in t.split('·')]
            if len(p)!=5: continue
            n=int(p[0].split('.')[0])
            q=re.sub(r'^\d+\.\s*\*\*(.+?)\*\*$', r'\1', p[0]).strip()
            r=p[1].strip('*').strip()
            qs.append({'n':n,'q':q,'r':r,'autres':[x.strip() for x in p[2:]]})
        # explications
        ex={}
        m=re.search(r'### Les explications\n(.*?)(?=\n---|\n## |\Z)', bl, re.S)
        if m:
            for e in re.split(r'\n(?=\d+\. )', m.group(1)):
                mm=re.match(r'^(\d+)\. (.+)$', re.sub(r'\s*\n\s*',' ',e).strip(), re.S)
                if mm: ex[int(mm.group(1))]=mm.group(2).strip()
        for q in qs: q['exp']=ex.get(q['n'],'')
        niveaux.append({'titre':nom, 'accroche':volets[0][:120] if volets else '',
                        'intro':volets, 'questions':qs})
    return niveaux

A=parse('/home/claude/atlas/tools/PACK_PARTICULES_A.md')
B=parse('/home/claude/atlas/tools/PACK_PARTICULES_B.md')
for nom,N in [('A',A),('B',B)]:
    print('  pack %s : %d niveaux' % (nom, len(N)))
    for n in N:
        manque=[q['n'] for q in n['questions'] if not q['exp']]
        print('    %-46s volets %d · questions %d%s' % (n['titre'][:46], len(n['intro']), len(n['questions']),
              ' · SANS EXPLICATION '+str(manque) if manque else ''))
json.dump({'A':A,'B':B}, open('/home/claude/packs.json','w'), ensure_ascii=False)
