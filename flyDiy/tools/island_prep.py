#!/usr/bin/env python3
"""island_prep.py — raw USGS/ESA tiles -> ONE grid the baker can read.

futureDesigns/ISLAND-PREPACK.md section 6, steps 1-3, 6 and 8. It does the
part that needs a raster library — mosaic, clip, reproject, resample — and
nothing else, then writes a format so dull that `terrain_bake.js` needs
twenty lines to read it:

    <out>.f32     heights, raw float32, row-major, SOUTH row first (+z north)
    <out>.u8      WorldCover class per cell, same grid (10 tree, 20 shrub,
                  30 grass, 60 bare, 70 snow, 80 water, 90 wetland; 0 = none)
    <out>.json    { w, h, x0, z0, cell, crs, ... }

THE LIBRARY IS rasterio, NOT THE GDAL COMMAND LINE. rasterio's wheel bundles
GDAL, so the whole toolchain is one `pip install rasterio` on the developer's
machine — no OSGeo4W, no conda, no PATH. (The first draft of this script
shelled out to gdalbuildvrt/gdalwarp and needed an installer this machine
never had.) The pipeline still has no runtime dependency on anything: the
raw tiles are a build input and only the dull files leave this script.

THE GAME FRAME IS ALASKA ALBERS, EPSG:3338 — decided by the data, 2026-09-14:
the IFSAR tiles are DELIVERED in it, so the elevation is never reprojected,
only cropped and resampled. WorldCover (EPSG:4326) is the one layer that is
warped, nearest-neighbour, onto the elevation's grid. Pick once, never
convert again — this project has paid twice for a quantity that lived in two
frames.

USAGE
    py -3.11 tools/island_prep.py --island annette              # 10 m
    py -3.11 tools/island_prep.py --island annette --cell 5     # native
    py -3.11 tools/island_prep.py --island annette --cell 25 --out bench/annette/coarse

REQUIRES  py -3.11 -m pip install numpy rasterio
"""
import argparse, glob, json, os, sys, time

# ---- the islands -----------------------------------------------------------
# bbox: the island's own footprint in lon/lat (W,S,E,N), as in island_fetch.js.
# pad: open sea kept on every side, metres. "Sea level does the edges."
# origin: THE WORLD ORIGIN, Albers metres (E, N), chosen once per world and
#   never moved. Game coordinates are Albers minus this: a float32 vertex at
#   1.4e6 m has 12 cm of precision and jitters, at 20 km it has 2 mm. Every
#   island added to the same world shares the origin, so they stay in one
#   frame without a conversion.
ISLANDS = {
    "annette": {"bbox": (-131.75, 54.95, -131.25, 55.35), "pad": 4000.0,
                "origin": (1408000.0, 808000.0)},
    "ursoy":   {"bbox": (-134.95, 57.05, -133.75, 58.25), "pad": 8000.0,
                "origin": (1220000.0, 1080000.0)},
}
CRS = "EPSG:3338"     # Alaska Albers. See the header. Do not make this a flag.
COVER_NODATA = 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--island", default="annette", choices=sorted(ISLANDS))
    ap.add_argument("--raw", default=None,
                    help="raw directory (default assets/island/raw/<island>)")
    ap.add_argument("--out", default=None,
                    help="output prefix (default bench/<island>/dem)")
    ap.add_argument("--cell", type=float, default=10.0, help="metres per cell")
    ap.add_argument("--extent", nargs=4, type=float, default=None,
                    metavar=("X0", "Z0", "X1", "Z1"),
                    help="clip window in EPSG:3338 metres; default = the "
                         "island's bbox plus its pad, snapped to the cell")
    ap.add_argument("--no-cover", action="store_true",
                    help="skip WorldCover (elevation only)")
    ap.add_argument("--neighbours", action="store_true",
                    help="keep the other islands' land inside the box. Default: "
                         "the ONE land component that is the island, the rest "
                         "becomes sea and the domain tightens to it plus its pad")
    args = ap.parse_args()

    try:
        import numpy as np
        import rasterio
        from rasterio.warp import reproject, transform_bounds, Resampling
        from rasterio.transform import from_origin
        from rasterio.merge import merge
    except ImportError as e:
        sys.exit(f"island_prep: {e} — run  py -3.11 -m pip install numpy rasterio")

    isl = ISLANDS[args.island]
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(here)
    raw = args.raw or os.path.join(root, "assets", "island", "raw", args.island)
    out = args.out or os.path.join(root, "bench", args.island, "dem")
    cell = args.cell

    tiles = sorted(glob.glob(os.path.join(raw, "dtm", "*.tif")))
    if not tiles:
        sys.exit(f"island_prep: no .tif under {raw}/dtm — run "
                 f"node tools/island_fetch.js --island {args.island}")
    covers = [] if args.no_cover else sorted(glob.glob(os.path.join(raw, "cover", "*.tif")))

    t0 = time.time()
    print(f"island_prep: {args.island} — {len(tiles)} DTM tile(s), "
          f"{len(covers)} cover tile(s) -> {out}.* @ {cell:g} m, {CRS}")

    # ---- the domain, in the game frame ------------------------------------
    if args.extent:
        x0, z0, x1, z1 = args.extent
    else:
        w, s, e, n = transform_bounds("EPSG:4326", CRS, *isl["bbox"], densify_pts=21)
        p = isl["pad"]
        x0, z0, x1, z1 = w - p, s - p, e + p, n + p
    # snap outward to whole cells so the grid's origin is a round number
    x0 = np.floor(x0 / cell) * cell; z0 = np.floor(z0 / cell) * cell
    x1 = np.ceil(x1 / cell) * cell;  z1 = np.ceil(z1 / cell) * cell
    W = int(round((x1 - x0) / cell)); H = int(round((z1 - z0) / cell))
    # rasterio's transform is north-up: row 0 is the NORTH edge
    dst_transform = from_origin(x0, z1, cell, cell)
    print(f"  domain x {x0:.0f}..{x1:.0f}  z {z0:.0f}..{z1:.0f}  "
          f"({(x1-x0)/1000:.1f} x {(z1-z0)/1000:.1f} km) = {W} x {H} cells")

    # ---- elevation ---------------------------------------------------------
    # One tile: warp straight from the dataset (GDAL reads only the window it
    # needs, through the overviews when the cell is coarser than the source).
    # Several tiles: mosaic first, at the target cell, so the seams are
    # resolved by the library and not by us.
    dem = np.full((H, W), np.nan, dtype="float32")
    srcs = [rasterio.open(t) for t in tiles]
    src_crs = srcs[0].crs
    same = src_crs is not None and rasterio.crs.CRS.from_string(CRS) == src_crs
    # the delivered tiles carry Albers with an unnamed GRS80 datum; treat it as
    # 3338 so the elevation is cropped, not warped. Report either way.
    proj = src_crs.to_dict() if src_crs else {}
    albers = (proj.get("proj") == "aea" and proj.get("lat_0") == 50 and
              proj.get("lon_0") == -154 and proj.get("lat_1") == 55 and
              proj.get("lat_2") == 65)
    print(f"  source crs: {'EPSG:3338' if same else ('Alaska Albers (unnamed datum) = 3338, no warp' if albers else src_crs)}")
    src_for_warp = CRS if (same or albers) else src_crs
    nodata = srcs[0].nodata
    if len(srcs) == 1:
        reproject(rasterio.band(srcs[0], 1), dem,
                  src_crs=src_for_warp, dst_transform=dst_transform, dst_crs=CRS,
                  src_nodata=nodata, dst_nodata=np.nan,
                  resampling=Resampling.average if cell > srcs[0].res[0] else Resampling.bilinear)
    else:
        mosaic, mt = merge(srcs, bounds=(x0, z0, x1, z1), res=cell, nodata=nodata,
                           resampling=Resampling.average if cell > srcs[0].res[0] else Resampling.bilinear)
        reproject(mosaic[0], dem, src_transform=mt, src_crs=src_for_warp,
                  dst_transform=dst_transform, dst_crs=CRS,
                  src_nodata=nodata, dst_nodata=np.nan, resampling=Resampling.bilinear)
    for s in srcs: s.close()

    holes = int(np.isnan(dem).sum())
    # nodata -> sea. The IFSAR tiles carry nodata over open water and a hole
    # in a heightfield is a hole in the world; 0 is the honest fill. Below
    # sea level on a tidal coast is radar noise at the water's edge — clamp.
    dem = np.nan_to_num(dem, nan=0.0)
    below = int((dem < 0).sum())
    dem = np.maximum(dem, 0.0)

    # ---- one island, taken whole ------------------------------------------
    # The box around an island in an archipelago holds its neighbours' edges
    # (Annette: Gravina 3 km across Nichols Passage). "Sea level does the
    # edges" needs the neighbours gone: label the land, keep the component
    # with the most area inside the island's own bbox, drown the rest, and
    # tighten the domain to what is left plus the pad. The neighbours return
    # the day a wider domain is baked — that is "add islands".
    if not args.neighbours:
        try:
            from scipy import ndimage
        except ImportError:
            sys.exit("island_prep: scipy needed for the island mask — "
                     "py -3.11 -m pip install scipy  (or pass --neighbours)")
        lab, n = ndimage.label(dem > 0)
        bw, bs, be, bn = transform_bounds("EPSG:4326", CRS, *isl["bbox"], densify_pts=21)
        # rows run north to south here: row 0 is z1
        r0 = int(max(0, (z1 - bn) / cell)); r1 = int(min(H, (z1 - bs) / cell))
        c0 = int(max(0, (bw - x0) / cell)); c1 = int(min(W, (be - x0) / cell))
        inside = np.bincount(lab[r0:r1, c0:c1].ravel(), minlength=n + 1); inside[0] = 0
        keep = int(inside.argmax())
        mask = lab == keep
        drowned = int(((dem > 0) & ~mask).sum())
        dem = np.where(mask, dem, 0.0).astype("float32")
        rows = np.flatnonzero(mask.any(axis=1)); cols = np.flatnonzero(mask.any(axis=0))
        pc = int(np.ceil(isl["pad"] / cell))
        r0, r1 = max(0, rows[0] - pc), min(H, rows[-1] + 1 + pc)
        c0, c1 = max(0, cols[0] - pc), min(W, cols[-1] + 1 + pc)
        dem = dem[r0:r1, c0:c1]
        x0, z1 = x0 + c0 * cell, z1 - r0 * cell
        H, W = dem.shape
        x1, z0 = x0 + W * cell, z1 - H * cell
        dst_transform = from_origin(x0, z1, cell, cell)
        print(f"  island: component {keep} of {n}, {int(mask.sum())*cell*cell/1e6:.0f} km2 kept, "
              f"{drowned*cell*cell/1e6:.0f} km2 of neighbours drowned")
        print(f"  domain x {x0:.0f}..{x1:.0f}  z {z0:.0f}..{z1:.0f}  "
              f"({(x1-x0)/1000:.1f} x {(z1-z0)/1000:.1f} km) = {W} x {H} cells")
    # rows run NORTH to SOUTH in the raster; the baker indexes +z northward,
    # so flip once, here, and never think about it again downstream.
    dem = np.flipud(dem).astype("<f4", copy=False)
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    dem.tofile(out + ".f32")
    land = int((dem > 0).sum())
    print(f"  heights {dem.min():.1f} .. {dem.max():.1f} m   land {land/1e6:.2f} M cells "
          f"= {land*cell*cell/1e6:.0f} km2   nodata->0: {holes}   <0 clamped: {below}")

    # ---- land cover, on the same grid -------------------------------------
    cov_classes = {}
    if covers:
        cov = np.zeros((H, W), dtype="uint8")
        for cpath in covers:
            with rasterio.open(cpath) as c:
                part = np.zeros((H, W), dtype="uint8")
                reproject(rasterio.band(c, 1), part, dst_transform=dst_transform,
                          dst_crs=CRS, src_nodata=COVER_NODATA, dst_nodata=COVER_NODATA,
                          resampling=Resampling.nearest)
                cov = np.where(part != COVER_NODATA, part, cov)
        cov = np.flipud(cov)
        # the DEM is the authority on where the sea is: a cover class over a
        # cell the DEM calls sea is a coastline disagreement at 10 m, and the
        # DEM's coast is the one the game will stand on.
        cov[dem <= 0] = 80
        cov.tofile(out + ".u8")
        vals, counts = np.unique(cov, return_counts=True)
        cov_classes = {int(v): int(n) for v, n in zip(vals, counts)}
        land = sum(n for v, n in cov_classes.items() if v not in (0, 80))
        print("  cover:", "  ".join(f"{v}:{100*n/max(land,1):.1f}%" for v, n in cov_classes.items()
                                     if v not in (0, 80)), "(of land)")

    oE, oN = isl["origin"]
    meta = {"island": args.island, "w": W, "h": H,
            "x0": float(x0 - oE), "z0": float(z0 - oN),        # game frame
            "origin": [oE, oN], "albers": {"x0": float(x0), "z0": float(z0)},
            "cell": cell, "crs": CRS, "nodata": 0.0,
            "hMin": float(dem.min()), "hMax": float(dem.max()),
            "cover": bool(covers), "coverClasses": cov_classes,
            "neighbours": bool(args.neighbours),
            "source": [os.path.basename(t) for t in tiles + covers],
            "bboxLonLat": isl["bbox"]}
    with open(out + ".json", "w") as f:
        json.dump(meta, f, indent=1)

    mb = (W * H * 4) / 1048576
    print(f"  {W} x {H} = {W*H/1e6:.1f} M cells, {mb:.1f} MB f32"
          f"{' + %.1f MB u8' % (W*H/1048576) if covers else ''}   {time.time()-t0:.1f} s")
    print(f"  game frame: x {x0-oE:.0f}..{x1-oE:.0f}  z {z0-oN:.0f}..{z1-oN:.0f}  "
          f"(Albers minus origin {oE:.0f} E {oN:.0f} N)")
    print(f"  wrote {out}.{{f32,{'u8,' if covers else ''}json}}")
    print(f"\n  next:  node tools/terrain_bake.js --source grid "
          f"--grid {os.path.relpath(out, root)} --eps 4 --out bench/terrain/{args.island}")


if __name__ == "__main__":
    main()
