#!/usr/bin/env python3
# blend_nodes.py - ROCK-STUDY (15 Nov 2026): read a .blend's node trees WITHOUT Blender (the file's own SDNA walked:
# bNodeTree -> bNode (name, idname, custom1 = the math operation, storage = the texture's settings, the inputs' defaults)
# and bNodeLink). How the user's Mountain_rock.blend 'Cliff-Rock' group was read. Usage: python3 -I blend_nodes.py file.blend
# minimal .blend reader (SDNA): dumps shader node trees - nodes, settings, socket defaults, links
import sys, struct
b = open(sys.argv[1], 'rb').read()
assert b[:7] == b'BLENDER'; psz = 8 if b[7:8] == b'-' else 4; end = '<' if b[8:9] == b'v' else '>'
P = 'Q' if psz == 8 else 'I'
off = 12; blocks = []
while off < len(b):
    code = b[off:off + 4]; ln, = struct.unpack(end + 'i', b[off + 4:off + 8]); old, = struct.unpack(end + P, b[off + 8:off + 8 + psz])
    sdna, cnt = struct.unpack(end + 'ii', b[off + 8 + psz:off + 16 + psz]); data = off + 16 + psz
    blocks.append((code, ln, old, sdna, cnt, data)); off = data + ln
    if code == b'ENDB': break
dna = [x for x in blocks if x[0] == b'DNA1'][0]; d = b[dna[5]:dna[5] + dna[1]]
p = 0
def al(p): return (p + 3) & ~3
assert d[0:4] == b'SDNA'; p = 4
def strs(tag):
    global p
    assert d[p:p + 4] == tag, (d[p:p + 4], tag); p += 4; n, = struct.unpack(end + 'i', d[p:p + 4]); p += 4; out = []
    for i in range(n):
        e = d.index(b'\0', p); out.append(d[p:e].decode()); p = e + 1
    p = al(p); return out
names = strs(b'NAME'); types = strs(b'TYPE')
assert d[p:p + 4] == b'TLEN'; p += 4; tlen = struct.unpack(end + '%dh' % len(types), d[p:p + 2 * len(types)]); p = al(p + 2 * len(types))
assert d[p:p + 4] == b'STRC'; p += 4; ns, = struct.unpack(end + 'i', d[p:p + 4]); p += 4
structs = []
for i in range(ns):
    t, nf = struct.unpack(end + 'hh', d[p:p + 4]); p += 4; fs = []
    for j in range(nf):
        ft, fn = struct.unpack(end + 'hh', d[p:p + 4]); p += 4; fs.append((types[ft], names[fn]))
    structs.append((types[t], fs))
sidx = {s[0]: i for i, s in enumerate(structs)}
def fsize(tname, fname):
    import re
    n = 1
    for m in re.findall(r'\[(\d+)\]', fname): n *= int(m)
    if fname.startswith('*') or fname.startswith('(*'): return psz * n
    return tlen[types.index(tname)] * n
def layout(sname):
    out = {}; o = 0
    for tname, fname in structs[sidx[sname]][1]:
        sz = fsize(tname, fname); key = fname.split('[')[0].lstrip('*').replace('(', '').replace(')', '')
        out[key] = (o, tname, fname, sz); o += sz
    return out
byold = {x[2]: x for x in blocks}
def rd(addr, sname, field):
    blk = byold.get(addr)
    if not blk: return None
    L = layout(sname); o, tname, fname, sz = L[field]; base = blk[5] + o
    if fname.startswith('*'): return struct.unpack(end + P, b[base:base + psz])[0]
    if tname == 'char' and '[' in fname: return b[base:base + sz].split(b'\0')[0].decode(errors='replace')
    fmt = {'float': 'f', 'int': 'i', 'short': 'h', 'char': 'b', 'uchar': 'B'}.get(tname)
    if fmt:
        n = sz // struct.calcsize(fmt); v = struct.unpack(end + fmt * n, b[base:base + sz]); return v if n > 1 else v[0]
    return base
def listbase(addr, sname, field):
    L = layout(sname); o = L[field][0]; blk = byold[addr]; first = struct.unpack(end + P, b[blk[5] + o:blk[5] + o + psz])[0]
    out = []; cur = first
    while cur and cur in byold:
        out.append(cur); cur = struct.unpack(end + P, b[byold[cur][5]:byold[cur][5] + psz])[0]
    return out
def sockval(s):
    dv = rd(s, 'bNodeSocket', 'default_value'); idn = rd(s, 'bNodeSocket', 'idname')
    if not dv or dv not in byold: return None
    if 'Float' in idn: return round(rd(dv, 'bNodeSocketValueFloat', 'value'), 4)
    if 'Vector' in idn: return tuple(round(x, 3) for x in rd(dv, 'bNodeSocketValueVector', 'value'))
    if 'Color' in idn: return tuple(round(x, 3) for x in rd(dv, 'bNodeSocketValueRGBA', 'value'))
    if 'Int' in idn: return rd(dv, 'bNodeSocketValueInt', 'value')
    return None
trees = [x for x in blocks if structs[x[3]][0] == 'bNodeTree' or x[0] == b'NT']
for t in [x for x in blocks if x[3] < len(structs) and structs[x[3]][0] == 'bNodeTree']:
    tn = rd(t[2], 'ID', 'name') if False else None
    nm = b[t[5]:t[5] + 66].split(b'\0')[0][2:].decode(errors='replace') if False else None
    idname = rd(t[2], 'bNodeTree', 'idname')
    print('\n==== TREE', idname)
    nodes = listbase(t[2], 'bNodeTree', 'nodes'); nodename = {}
    for nd in nodes:
        name = rd(nd, 'bNode', 'name'); idn = rd(nd, 'bNode', 'idname'); nodename[nd] = name
        c1 = rd(nd, 'bNode', 'custom1'); c2 = rd(nd, 'bNode', 'custom2'); label = rd(nd, 'bNode', 'label')
        st = rd(nd, 'bNode', 'storage'); extra = ''
        if st and st in byold:
            sname = structs[byold[st][3]][0]
            if sname in ('NodeTexVoronoi', 'NodeTexNoise', 'NodeTexMusgrave'):
                L = layout(sname); extra = ' ' + sname + ' ' + str({k: rd(st, sname, k) for k in L if k in ('feature', 'distance', 'dimensions', 'musgrave_type', 'normalize')})
            elif sname == 'NodeGroup' or idn == 'ShaderNodeGroup': pass
        ins = []
        for s in listbase(nd, 'bNode', 'inputs'):
            v = sockval(s); lk = rd(s, 'bNodeSocket', 'link')
            if (rd(s, 'bNodeSocket', 'flag') or 0) & 2: continue   # hidden
            ins.append('%s=%s%s' % (rd(s, 'bNodeSocket', 'name'), v, '*' if lk else ''))
        print(' NODE %-22s %-26s c1=%s c2=%s %s%s | %s' % (name, idn, c1, c2, ('label=' + label + ' ') if label else '', extra, ', '.join(ins)))
    print(' LINKS')
    for lk in listbase(t[2], 'bNodeTree', 'links'):
        fn = rd(lk, 'bNodeLink', 'fromnode'); tn_ = rd(lk, 'bNodeLink', 'tonode'); fs = rd(lk, 'bNodeLink', 'fromsock'); ts = rd(lk, 'bNodeLink', 'tosock')
        print('  %s.%s -> %s.%s' % (nodename.get(fn), rd(fs, 'bNodeSocket', 'name'), nodename.get(tn_), rd(ts, 'bNodeSocket', 'name')))
