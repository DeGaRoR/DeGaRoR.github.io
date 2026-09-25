#!/usr/bin/env python3
"""geo.py - the island frame, in one place.

Until now nothing in the repo could turn a latitude and a longitude into a game
coordinate: every number in jolene_author.py was read off a picture by eye. The
frame itself has been settled since G391 and is stated in src/core/28_island.js:

    game x = Albers E - origin E
    game z = origin N - Albers N          (north is -z)

with Albers = EPSG:3338 (Alaska Albers) and the origin pinned per island in
tools/island_prep.py's ISLANDS table. Jolene's is the WWII field's centre.

    from geo import lonlat_to_game, game_to_lonlat, true_to_grid
    x, z = lonlat_to_game(-131.5750, 55.1290)      # Metlakatla's centre

The projection comes from rasterio (already a dev dependency; its wheel bundles
PROJ). pyproj is NOT installed on this machine - do not reach for it.

The grid's north is NOT true north: at Jolene the convergence is 19.32 deg EAST
of true (src/core/28_island.js ISLAND_GEO, measured, and 06_solar.js turns the
sun's azimuth by it). A bearing read off a north-up satellite picture is TRUE;
the record wants the GRID one, so subtract it - true_to_grid below.
"""
import math

# tools/island_prep.py ISLANDS - the origin is pinned and never moves
ORIGINS = {
    'jolene': (1406524.0, 798714.0),
}
# src/core/28_island.js ISLAND_GEO
CONVERGENCE_DEG = {
    'jolene': 19.32,
}
CRS = 'EPSG:3338'


def _transform(lons, lats, inverse=False):
    from rasterio.warp import transform
    src, dst = ('EPSG:4326', CRS) if not inverse else (CRS, 'EPSG:4326')
    a, b = transform(src, dst, list(lons), list(lats))
    return a, b


def lonlat_to_game(lon, lat, island='jolene'):
    """(lon, lat) in degrees -> (x, z) in the game frame. Scalars or sequences."""
    oE, oN = ORIGINS[island]
    scalar = not hasattr(lon, '__len__')
    lons = [lon] if scalar else list(lon)
    lats = [lat] if scalar else list(lat)
    E, N = _transform(lons, lats)
    xs = [e - oE for e in E]
    zs = [oN - n for n in N]
    return (xs[0], zs[0]) if scalar else (xs, zs)


def game_to_lonlat(x, z, island='jolene'):
    """(x, z) in the game frame -> (lon, lat) in degrees."""
    oE, oN = ORIGINS[island]
    scalar = not hasattr(x, '__len__')
    xs = [x] if scalar else list(x)
    zs = [z] if scalar else list(z)
    E = [q + oE for q in xs]
    N = [oN - q for q in zs]
    lon, lat = _transform(E, N, inverse=True)
    return (lon[0], lat[0]) if scalar else (lon, lat)


def true_to_grid(bearing_deg, island='jolene'):
    """A TRUE bearing (off a north-up picture) -> the game's grid bearing."""
    return bearing_deg - CONVERGENCE_DEG[island]


def grid_to_true(bearing_deg, island='jolene'):
    return bearing_deg + CONVERGENCE_DEG[island]


def hdg_of(bearing_deg, island='jolene'):
    """A TRUE compass bearing -> the record's `hdg` in radians.

    The record's hdg is the direction (cos hdg, sin hdg) in (x, z): hdg 0 points
    +x (grid east) and grows toward +z (grid south). A grid bearing b (0 = grid
    north = -z) is therefore hdg = (b - 90) in radians... measured the other way
    round, so: hdg = radians(b - 90) with z flipped == radians(90 - b) is wrong.
    Work it out once, here, and never again:
        grid north = -z  ->  b=0   must give ( 0, -1)  ->  hdg = -pi/2
        grid east  = +x  ->  b=90  must give ( 1,  0)  ->  hdg =  0
        grid south = +z  ->  b=180 must give ( 0,  1)  ->  hdg =  pi/2
    so hdg = radians(b - 90).
    """
    return math.radians(true_to_grid(bearing_deg, island) - 90.0)


def bearing_of(hdg_rad, island='jolene'):
    """The inverse of hdg_of: the record's hdg -> a TRUE compass bearing."""
    return grid_to_true(math.degrees(hdg_rad) + 90.0, island) % 360.0


if __name__ == '__main__':
    import sys
    if len(sys.argv) >= 3:
        a, b = float(sys.argv[1]), float(sys.argv[2])
        if abs(a) > 200 or abs(b) > 200:      # game coordinates
            print('lon %.6f lat %.6f' % game_to_lonlat(a, b))
        else:
            print('x %.1f z %.1f' % lonlat_to_game(a, b))
    else:
        # the self-check: the origin must come back as (0, 0)
        print('origin  -> x %.2f z %.2f' % lonlat_to_game(-131.57222, 55.04327))
        print('metlakatla -> x %.1f z %.1f' % lonlat_to_game(-131.5750, 55.1290))
        print('round trip -> lon %.5f lat %.5f' % game_to_lonlat(*lonlat_to_game(-131.5750, 55.1290)))
        print('hdg of true 150 deg = %.4f rad (grid %.2f deg)' % (hdg_of(150.0), true_to_grid(150.0)))
        print('bearing_of(0.7156) = %.2f deg true' % bearing_of(0.7156))
