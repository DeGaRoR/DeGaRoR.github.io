#!/usr/bin/env python3
"""flyDiy sticker 12 (Alaska): THE OUTLINE FROM NATURAL EARTH (LIVERY-STICKERS, 9 Nov 2026).

  curl -sSfL -o states50.geojson \\
    https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson
  python3 alaska_ne.py states50.geojson      -> alaska_ne.json (read by marks_c.js)

Natural Earth is public domain (naturalearthdata.com: "No permission is needed to use Natural Earth"). The 1:50m
admin-1 polygon of Alaska is projected on the Alaska Albers equal-area conic (EPSG:3338's parameters: standard parallels
55 N and 65 N, origin 50 N 154 W; spherical), then SIMPLIFIED FOR A STICKER:
  - the mainland, Kodiak (with Afognak), St Lawrence Island and Nunivak are kept;
  - the southeast archipelago is closed into the panhandle (a morphological closing of 9 km), which is how the state
    reads at a sticker's size: a dozen islands 1 cm long and 1 mm apart are not a cuttable shape;
  - the outline is smoothed (an opening and a closing of 11 km take off the fjords a cutter cannot hold) and simplified
    (Douglas-Peucker 4 km);
  - the Aleutian chain is NOT drawn from the polygon: the mark draws it as tapering swooshes, laid along the real
    islands (their centroids, west of Unimak Pass) - the points are written out for marks_c.js.
Everything is scaled into the mark's own frame (262 wide with a margin; the height follows the map), and a few named places are projected
for the plane and its trail.
"""
import json, math, os, sys
from shapely.geometry import shape, Polygon, MultiPolygon
from shapely.ops import unary_union
from shapely import affinity

HERE = os.path.dirname(os.path.abspath(__file__))
W, MARGIN = 262.0, 6.0
R = 6371.0  # km


def albers(lon, lat, lon0=-154.0, lat0=50.0, lat1=55.0, lat2=65.0):
    f = math.radians
    n = (math.sin(f(lat1)) + math.sin(f(lat2))) / 2
    C = math.cos(f(lat1)) ** 2 + 2 * n * math.sin(f(lat1))
    rho = lambda la: R * math.sqrt(C - 2 * n * math.sin(f(la))) / n
    th = n * f(lon - lon0)
    return rho(lat) * math.sin(th), rho(lat0) - rho(lat) * math.cos(th)


def proj_poly(p):
    ext = [albers(x, y) for x, y in p.exterior.coords]
    return Polygon(ext, [[albers(x, y) for x, y in r.coords] for r in p.interiors])


def main():
    src = sys.argv[1]
    feats = [f for f in json.load(open(src))['features'] if f['properties'].get('name') == 'Alaska']
    g = shape(feats[0]['geometry'])
    parts = sorted(g.geoms, key=lambda q: -q.area)
    main_land = parts[0]
    named = lambda lon, lat: next(p for p in parts if p.contains(shape({'type': 'Point', 'coordinates': [lon, lat]})))
    kodiak = named(-153.5, 57.5)
    afognak = named(-152.7, 58.25)
    stlawrence = named(-170.0, 63.4)
    nunivak = named(-166.3, 60.1)
    se = [p for p in parts if p.bounds[0] > -138.0 and p.area > 0.02]
    # the Aleutian chain: islands whose centroid is west of Unimak Pass (165 W) and south of 56 N
    chain = [p for p in parts if p.centroid.x < -164.0 and p.centroid.y < 56.0 and p.area > 0.03]
    P = lambda geom: unary_union([proj_poly(q) for q in (geom.geoms if hasattr(geom, 'geoms') else [geom])])
    body = unary_union([P(main_land)] + [P(q) for q in se])
    body = body.buffer(9).buffer(-9)                         # close the archipelago into the panhandle
    body = body.buffer(-11).buffer(22).buffer(-11)          # take off the fjords: open 11 km, close 11 km
    islands = [unary_union([P(kodiak), P(afognak)]).buffer(4).buffer(-4), P(stlawrence), P(nunivak)]
    shapes = [body] + islands
    shapes = [s.simplify(4.0, preserve_topology=True) for s in shapes]
    # keep the main polygon of each (the closing may leave crumbs)
    def biggest(s):
        return max(s.geoms, key=lambda q: q.area) if hasattr(s, 'geoms') else s
    shapes = [biggest(s) for s in shapes]
    chain_pts = sorted([albers(p.centroid.x, p.centroid.y) for p in chain], key=lambda q: -q[0])
    # the frame: fit everything (with the chain) inside W x H; y down
    allx = [x for s in shapes for x, _ in s.exterior.coords] + [x for x, _ in chain_pts]
    ally = [y for s in shapes for _, y in s.exterior.coords] + [y for _, y in chain_pts]
    x0, x1, y0, y1 = min(allx), max(allx), min(ally), max(ally)
    k = (W - 2 * MARGIN) / (x1 - x0)                         # the width sets the scale; the height follows the map
    Hh = round((y1 - y0) * k + 2 * MARGIN, 1)
    ox = MARGIN + ((W - 2 * MARGIN) - (x1 - x0) * k) / 2
    oy = MARGIN
    T = lambda x, y: (round(ox + (x - x0) * k, 2), round(oy + (y1 - y) * k, 2))
    ring = lambda r: [T(x, y) for x, y in list(r.coords)[:-1]]
    places = {name: T(*albers(lon, lat)) for name, (lon, lat) in {
        'fairbanks': (-147.7, 64.8), 'anchorage': (-149.9, 61.2), 'denali': (-151.0, 63.07),
        'nome': (-165.4, 64.5), 'kotzebue': (-162.6, 66.9), 'brooks': (-152.0, 67.8), 'yukonDelta': (-163.0, 62.5),
        'bethel': (-161.8, 60.8), 'mcgrath': (-155.6, 62.95)}.items()}
    out = {'w': W, 'h': Hh, 'kmPerUnit': round(1 / k, 3), 'source': 'Natural Earth 1:50m admin-1 (public domain), Alaska Albers',
           'body': ring(shapes[0].exterior), 'bodyHoles': [ring(h) for h in shapes[0].interiors],
           'islands': [ring(s.exterior) for s in shapes[1:]], 'islandNames': ['Kodiak', 'St Lawrence', 'Nunivak'],
           'chain': [T(x, y) for x, y in chain_pts], 'places': places}
    json.dump(out, open(os.path.join(HERE, 'alaska_ne.json'), 'w'), separators=(',', ':'))
    print('body', len(out['body']), 'pts; islands', [len(i) for i in out['islands']], '; chain', len(out['chain']),
          '; 1 unit =', out['kmPerUnit'], 'km')


if __name__ == '__main__':
    main()
