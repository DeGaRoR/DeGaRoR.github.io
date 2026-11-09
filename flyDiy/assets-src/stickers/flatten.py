#!/usr/bin/env python3
"""flyDiy livery stickers: THE CUTTER-READY FLATTEN (LIVERY-STICKERS, 9 Nov 2026).

  python3 flatten.py [src=mask] [dst=svg]   mask/NN_id.svg -> svg/NN_id.svg (+ cut.json, the game's source, for svg/)

The generator (make_v3.js) draws each mark as a LUMINANCE MASK: white shapes add ink, black shapes cut it, in paint
order, with clip paths, transforms and stroked halos (the separation gaps). A vinyl cutter wants none of that: one
colour, plain filled outlines, holes as real holes. This walks the mask in paint order and composites it as geometry:

  white region  -> ink = ink | region          (overlaps unioned)
  black region  -> ink = ink - region          (holes and halo gaps become geometry)
  region        = the element's fill (nonzero / evenodd, exact: every face of the linework is tested by its winding
                  number) | its stroke (a round-joined buffer of the outline, width in the element's own units)
                  & every clip path above it, all in the element's own frame and then mapped by its full transform

and writes ONE path per mark (fill-rule evenodd: the shells and their holes; shapely's parts never overlap, so nonzero
and evenodd agree). Curves are flattened to 0.02 units (a 240-unit mark at 30 cm: 0.025 mm) and then simplified to
0.03 units. needs: pip install shapely svgelements
"""
import json, math, os, re, sys, xml.etree.ElementTree as ET
from shapely.geometry import Polygon, MultiPolygon, LineString, Point, box
from shapely.ops import unary_union, polygonize
from shapely import affinity
import svgelements as SE

HERE = os.path.dirname(os.path.abspath(__file__))
NS = '{http://www.w3.org/2000/svg}'
TOL = 0.02          # flattening step (user units)
SIMPLIFY = 0.03     # output simplification (user units)


def tag(e):
    return e.tag.replace(NS, '')


def mat_of(s):
    """svg transform attribute -> svgelements Matrix (identity when absent)"""
    return SE.Matrix(s) if s else SE.Matrix()


def to_affine(m):
    # shapely: [a, b, d, e, xoff, yoff] for x' = a x + b y + xoff, y' = d x + e y + yoff
    return [m.a, m.c, m.b, m.d, m.e, m.f]


def subpaths(d):
    """a path's d -> list of closed point rings (flattened)"""
    p = SE.Path(d)
    rings, cur = [], []
    for seg in p:
        if isinstance(seg, SE.Move):
            if len(cur) > 2: rings.append(cur)
            cur = [(seg.end.x, seg.end.y)]
            continue
        if isinstance(seg, SE.Close):
            if len(cur) > 2: rings.append(cur)
            cur = []
            continue
        if isinstance(seg, SE.Line):
            cur.append((seg.end.x, seg.end.y)); continue
        L = seg.length(error=1e-4) if hasattr(seg, 'length') else 1
        n = max(4, int(math.ceil(L / (TOL * 10))))
        for i in range(1, n + 1):
            q = seg.point(i / n)
            cur.append((q.x, q.y))
    if len(cur) > 2: rings.append(cur)
    return rings


def ellipse_ring(cx, cy, rx, ry):
    n = max(48, int(math.ceil(2 * math.pi * max(rx, ry) / (TOL * 10))))
    return [(cx + rx * math.cos(2 * math.pi * i / n), cy + ry * math.sin(2 * math.pi * i / n)) for i in range(n)]


def winding(pt, ring):
    """winding number of a closed ring around pt"""
    x, y = pt; w = 0; n = len(ring)
    for i in range(n):
        x0, y0 = ring[i]; x1, y1 = ring[(i + 1) % n]
        if y0 <= y:
            if y1 > y and (x1 - x0) * (y - y0) - (x - x0) * (y1 - y0) > 0: w += 1
        elif y1 <= y and (x1 - x0) * (y - y0) - (x - x0) * (y1 - y0) < 0: w -= 1
    return w


def fill_region(rings, rule):
    """exact fill of a set of rings under a fill rule: polygonize the linework, keep the faces the rule fills"""
    if not rings: return Polygon()
    if len(rings) == 1:
        g = Polygon(rings[0])
        return g if g.is_valid else g.buffer(0)
    lines = unary_union([LineString(r + [r[0]]) for r in rings])
    keep = []
    for face in polygonize(lines):
        p = face.representative_point()
        w = sum(winding((p.x, p.y), r) for r in rings)
        if (w % 2 != 0) if rule == 'evenodd' else (w != 0): keep.append(face)
    return unary_union(keep)


def stroke_region(rings, width):
    if width <= 0: return Polygon()
    return unary_union([LineString(r + [r[0]]).buffer(width / 2, join_style='round', cap_style='round', quad_segs=16)
                        for r in rings])


def element_rings(e):
    t = tag(e)
    if t == 'path': return subpaths(e.get('d'))
    if t == 'circle':
        r = float(e.get('r')); return [ellipse_ring(float(e.get('cx', 0)), float(e.get('cy', 0)), r, r)]
    if t == 'ellipse':
        return [ellipse_ring(float(e.get('cx', 0)), float(e.get('cy', 0)), float(e.get('rx')), float(e.get('ry')))]
    if t == 'rect':
        x, y, w, h = (float(e.get(k, 0)) for k in ('x', 'y', 'width', 'height'))
        return [[(x, y), (x + w, y), (x + w, y + h), (x, y + h)]]
    raise ValueError('unhandled element ' + t)


def lum(c):
    c = (c or '').lower()
    if c in ('#fff', '#ffffff', 'white'): return 1
    if c in ('#000', '#000000', 'black'): return 0
    raise ValueError('mask colour must be #fff or #000, got ' + repr(c))


def flatten(svg_path):
    root = ET.parse(svg_path).getroot()
    vb = [float(v) for v in root.get('viewBox').split()]
    clips = {}
    for cp in root.iter(NS + 'clipPath'):
        clips[cp.get('id')] = cp
    mask = next(root.iter(NS + 'mask'))
    ink = Polygon()

    def clip_geom(cid, M):
        cp = clips[cid]; parts = []
        for ch in cp:
            # svgelements: Matrix product A * B applies A then B; a child's transform is applied first
            m2 = mat_of(ch.get('transform')) * M if ch.get('transform') else M
            g = fill_region(element_rings(ch), ch.get('clip-rule', 'nonzero'))
            parts.append(affinity.affine_transform(g, to_affine(m2)))
        return unary_union(parts)

    def walk(e, M, clip):
        nonlocal ink
        for ch in e:
            t = tag(ch)
            m2 = mat_of(ch.get('transform')) * M if ch.get('transform') else M
            c2 = clip
            cp = ch.get('clip-path')
            if cp:
                cid = re.match(r'url\(#(.+)\)', cp).group(1)
                cg = clip_geom(cid, m2)
                c2 = cg if c2 is None else c2.intersection(cg)
            if t == 'g':
                walk(ch, m2, c2); continue
            rings = element_rings(ch)
            fill = ch.get('fill', '#000')
            reg = Polygon()
            if fill != 'none': reg = fill_region(rings, ch.get('fill-rule', 'nonzero'))
            st = ch.get('stroke')
            if st and st != 'none':
                if lum(st) != lum(fill): raise ValueError('a stroke of another colour than its fill')
                reg = reg.union(stroke_region(rings, float(ch.get('stroke-width', 1))))
            reg = affinity.affine_transform(reg, to_affine(m2))
            if c2 is not None: reg = reg.intersection(c2)
            if reg.is_empty: continue
            ink = ink.union(reg) if lum(fill) else ink.difference(reg)

    walk(mask, SE.Matrix(), None)
    ink = ink.intersection(box(vb[0], vb[1], vb[0] + vb[2], vb[1] + vb[3]))
    ink = ink.simplify(SIMPLIFY, preserve_topology=True).buffer(0)
    polys = [ink] if isinstance(ink, Polygon) else [g for g in getattr(ink, 'geoms', []) if isinstance(g, Polygon)]
    polys = [p for p in polys if p.area > 0.05]
    return vb, polys


def ring_d(coords, k=100):
    pts = list(coords)[:-1]
    return 'M' + ' '.join('%s,%s' % (fmt(x), fmt(y)) for x, y in pts[:1]) + 'L' + ' '.join(
        '%s,%s' % (fmt(x), fmt(y)) for x, y in pts[1:]) + 'Z'


def fmt(v):
    s = ('%.2f' % v).rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


def polys_d(polys):
    out = []
    for p in polys:
        out.append(ring_d(p.exterior.coords))
        for h in p.interiors: out.append(ring_d(h.coords))
    return ''.join(out)


def main():
    src = os.path.join(HERE, sys.argv[1] if len(sys.argv) > 1 else 'mask')
    dst = os.path.join(HERE, sys.argv[2] if len(sys.argv) > 2 else 'svg')
    os.makedirs(dst, exist_ok=True)
    marks = []
    for f in sorted(os.listdir(src)):
        if not f.endswith('.svg'): continue
        vb, polys = flatten(os.path.join(src, f))
        d = polys_d(polys)
        title = re.search(r'<title>(.*?)</title>', open(os.path.join(src, f)).read())
        title = title.group(1) if title else f
        w, h = vb[2], vb[3]
        svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %s %s" width="%s" height="%s"><title>%s</title>'
               '<path fill="#1c2742" fill-rule="evenodd" d="%s"/></svg>\n') % (fmt(w), fmt(h), fmt(w * 3), fmt(h * 3), title, d)
        open(os.path.join(dst, f), 'w').write(svg)
        n_pts = sum(len(p.exterior.coords) + sum(len(i.coords) for i in p.interiors) for p in polys)
        holes = sum(len(p.interiors) for p in polys)
        thin = thin_report(polys)
        marks.append({'file': f, 'w': w, 'h': h, 'd': d, 'parts': len(polys), 'holes': holes, 'points': n_pts, **thin})
        print('%-26s parts %3d  holes %3d  points %5d  ink %.1f%%  thinnest ink %.2f  thinnest gap %.2f' % (
            f, len(polys), holes, n_pts, 100 * sum(p.area for p in polys) / (w * h), thin['thinInk'], thin['thinGap']))
    if dst == os.path.join(HERE, 'svg'): json.dump(marks, open(os.path.join(HERE, 'cut.json'), 'w'))


def thin_report(polys):
    """the narrowest ink and the narrowest gap a cutter has to hold, in user units: the largest r for which an
    opening by r keeps 99.5% of the ink (resp. a closing keeps the gaps)"""
    g = unary_union(polys)
    A = g.area

    def ink_ok(r): return g.buffer(-r).buffer(r).area >= A * 0.995

    def gap_ok(r): return g.buffer(r).buffer(-r).area <= A * 1.005
    out = {}
    for key, ok in (('thinInk', ink_ok), ('thinGap', gap_ok)):
        lo, hi = 0.0, 4.0
        for _ in range(10):
            mid = (lo + hi) / 2
            if ok(mid): lo = mid
            else: hi = mid
        out[key] = round(2 * lo, 2)
    return out


if __name__ == '__main__':
    main()
