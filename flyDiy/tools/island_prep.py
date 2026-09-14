#!/usr/bin/env python3
"""island_prep.py — raw USGS/ESA tiles -> ONE grid the baker can read.

futureDesigns/ISLAND-PREPACK.md section 6, steps 1-3, 6 and 8. It does the
part that needs a raster library — mosaic, clip, reproject, resample — and
nothing else, then writes a format so dull that `terrain_bake.js` needs
twenty lines to read it:

    <out>.f32         heights, raw float32, row-major, NORTH row first: the
                      game's frame has north at -z (the analytic world's
                      mountains are "northern" at z < 0), so row 0 is z0
    <out>.u8          WorldCover class per cell, same grid (10 tree, 20 shrub,
                      30 grass, 60 bare, 70 snow, 80 water, 90 wetland; 0 = none)
    <out>.canopy.u8   canopy height, metres (DSM - DTM, 0..120), if raw/dsm/tif
    <out>.ori.u8      radar backscatter, stretched 2..98 % over land, if raw/ori/tif
    <out>.tint.rgb    Landsat surface reflectance, u8 RGB interleaved, if raw/landsat
    <out>.ndvi.u8     (NDVI + 1) * 127, same source
    <out>.json        { w, h, x0, z0, cell, crs, layers: {...}, ... }

Every layer is on the DEM's grid, masked to the island, north row first.
The layers are the three real inputs ISLAND-PREPACK section 3.2 named —
class (WorldCover), height (DSM - DTM), density (ORI) — plus the macro tint
ISLAND-ANNETTE section 6 ruled in. None is a texture; all are masks.

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
    py -3.11 tools/island_prep.py --island jolene               # 10 m
    py -3.11 tools/island_prep.py --island jolene --cell 5      # native
    py -3.11 tools/island_prep.py --island jolene --cell 25 --out bench/jolene/coarse

REQUIRES  py -3.11 -m pip install numpy rasterio
"""
import argparse, glob, json, os, sys, time

# ---- the islands -----------------------------------------------------------
# bbox: the island's own footprint in lon/lat (W,S,E,N), as in island_fetch.js.
# pad: open sea kept on every side, metres. "Sea level does the edges."
# origin: THE WORLD ORIGIN, Albers metres (E, N), chosen once per world and
#   never moved. Game x = E - oE, game z = oN - N (north is -z, as in the
#   analytic world): a float32 vertex at 1.4e6 m has 12 cm of precision and
#   jitters, at 20 km it has 2 mm. Every island added to the same world
#   shares the origin, so they stay in one frame without a conversion.
ISLANDS = {
    # JOLENE ISLAND = Annette Island, Alaska (the source name stays out of the
    # shipped data: GATE ISLAND 1)
    # the origin is the WWII field's centre (the centroid of the built-up
    # class on the south-west lobe, 2026-09-14): HOME's strip is cut there
    "jolene":  {"bbox": (-131.75, 54.95, -131.25, 55.35), "pad": 4000.0,
                "origin": (1406524.0, 798714.0)},
    "ursoy":   {"bbox": (-134.95, 57.05, -133.75, 58.25), "pad": 8000.0,
                "origin": (1220000.0, 1080000.0)},
}
CRS = "EPSG:3338"     # Alaska Albers. See the header. Do not make this a flag.
COVER_NODATA = 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--island", default="jolene", choices=sorted(ISLANDS))
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
    # rows run NORTH to SOUTH in the raster and in the game (+z is south):
    # no flip, anywhere, ever.
    dem = np.ascontiguousarray(dem, dtype="<f4")
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

    # ---- the layers: canopy, radar, tint -------------------------------
    # Each is optional (present when its raw directory is) and each lands on
    # the DEM's grid through one warp, then the island mask, then the flip.
    layers = {}
    landmask = dem > 0
    # THE COAST (2026-09-14, the user: "extend the imagery slightly beyond the
    # contours ... a very simple transparency as function of depth on the
    # sea"). Two things from one distance transform: every layer is EXTENDED
    # past the coastline with its nearest land value (300 m), so a texel
    # straddling the shore never samples black; and `.coast.u8` carries the
    # distance to land in metres / 4 (0 on land, 255 = 1 km+) - there is no
    # bathymetry, and a shelf that deepens with distance from the shore is
    # what the eye expects of one.
    try:
        from scipy import ndimage
        dist, (ni, nj) = ndimage.distance_transform_edt(~landmask, return_indices=True)
        dist_m = dist * cell
        # SIGNED, so a bilinear sample reconstructs the coastline as a smooth
        # curve (the iso-contour at 128) instead of the mesh's 10 m staircase:
        # 128 + inland distance / 4 on land, 128 - sea distance / 4 at sea,
        # clamped at +-508 m. The shelf, the beach band, the waterline and the
        # flattened bank all read this one field.
        inland_m = ndimage.distance_transform_edt(landmask) * cell
        sdf = np.where(landmask, 128.0 + np.minimum(inland_m, 508.0) / 4.0,
                                 128.0 - np.minimum(dist_m, 508.0) / 4.0)
        # one cell of Gaussian rounds the corners a binary mask's EDT leaves
        sdf = ndimage.gaussian_filter(sdf.astype("float32"), 1.0)
        np.clip(np.round(sdf), 0, 255).astype("uint8").tofile(out + ".coast.u8")
        layers["coast"] = {"file": ".coast.u8", "unit": "signed m/4, 128 = the waterline, + inland"}
        ext = (~landmask) & (dist_m <= 300.0)
        def extend(a):
            """fill the 300 m sea fringe of a layer with its nearest land value"""
            if a.ndim == 3:
                a[ext] = a[ni[ext], nj[ext]]
            else:
                a[ext] = a[ni[ext], nj[ext]]
            return a
        print(f"  coast: distance field written; layers extended {int(ext.sum())*cell*cell/1e6:.0f} km2 past the shore")
    except ImportError:
        extend = lambda a: a
        print("  (no scipy: no coast field, layers not extended)")
    def onto_grid(paths, dtype, resampling, nodata=None, band=1, count=1):
        """warp each source onto the grid, first non-empty wins; flipped south-first.
        One warp per source (not a mosaic): the sources need not share a frame
        (Landsat comes in UTM, IFSAR in Albers), and GDAL reads only the window
        each one contributes."""
        dst = np.zeros((count, H, W), dtype=dtype)
        for t in paths:
            with rasterio.open(t) as src:
                src_crs = CRS if src.crs.to_dict().get("proj") == "aea" else src.crs
                part = np.zeros((count, H, W), dtype=dtype)
                for b in range(count):
                    reproject(rasterio.band(src, band + b), part[b], src_crs=src_crs,
                              dst_transform=dst_transform, dst_crs=CRS,
                              src_nodata=nodata, dst_nodata=0, resampling=resampling)
                if nodata is not None:
                    part[np.isclose(part, nodata)] = 0    # a tile with no data is empty, not a value
                empty = dst[0] == 0
                dst[:, empty] = part[:, empty]
        return dst if count > 1 else dst[0]

    avg = Resampling.average if cell > 5 else Resampling.bilinear
    # CANOPY HEIGHT. Two sources, in order of trust:
    #  1. Meta/WRI global canopy height (1.2 m, imagery + lidar model, CC BY
    #     4.0), tiles under raw/canopy/meta_chm_*.tif, decimated on read.
    #     GEDI-calibrated maps (GLAD, ETH) stop at 52 N; the island is at 55.
    #  2. IFSAR DSM - DTM, under raw/dsm/tif. On this island it is NOT the
    #     forest: at a lake shore in closed canopy the DSM equals the DTM
    #     (2026-09-14, ISLAND-ANNETTE.md), so it is written only as a
    #     fallback and its statistics say so.
    chms = sorted(glob.glob(os.path.join(raw, "canopy", "meta_chm_*.tif")))
    dsms = sorted(glob.glob(os.path.join(raw, "dsm", "tif", "*.tif")))
    tree = (cov == 10) if covers else landmask
    if chms:
        canopy = np.zeros((H, W), dtype="float32")
        for cp in chms:
            with rasterio.open(cp) as c:
                k = max(1, int(cell / c.res[0]))          # 1.2 m -> 10 m: read at 1/8
                oh, ow = c.height // k, c.width // k
                a = c.read(1, out_shape=(oh, ow), resampling=Resampling.average).astype("float32")
                t = c.transform * c.transform.scale(c.width / ow, c.height / oh)
                part = np.zeros((H, W), dtype="float32")
                reproject(a, part, src_transform=t, src_crs=c.crs, dst_transform=dst_transform,
                          dst_crs=CRS, src_nodata=None, dst_nodata=0, resampling=Resampling.average)
                canopy = np.maximum(canopy, part)
        canopy = np.clip(canopy, 0, 120); canopy[~landmask] = 0
        canopy = extend(canopy)
        canopy.astype("uint8").tofile(out + ".canopy.u8")
        layers["canopy"] = {"file": ".canopy.u8", "unit": "m", "source": "meta_chm", "tiles": len(chms),
                            "meanOverTreeCover": float(canopy[tree].mean()) if tree.any() else 0,
                            "p90OverTreeCover": float(np.percentile(canopy[tree], 90)) if tree.any() else 0}
        print(f"  canopy: Meta CHM, {len(chms)} tiles; over tree cover mean {layers['canopy']['meanOverTreeCover']:.1f} m, "
              f"p90 {layers['canopy']['p90OverTreeCover']:.1f} m")
    if dsms:
        dsm = onto_grid(dsms, "float32", avg, nodata=-999999.0)
        dsm = np.where(dsm < -1000, 0, dsm)
        ifsar = np.clip(dsm - dem, 0, 120); ifsar[~landmask] = 0
        ifsar.astype("uint8").tofile(out + ".ifsar_canopy.u8")
        layers["ifsarCanopy"] = {"file": ".ifsar_canopy.u8", "unit": "m", "tiles": len(dsms),
                                 "meanOverTreeCover": float(ifsar[tree].mean()) if tree.any() else 0,
                                 "verdict": "DSM equals DTM under closed canopy on this island; not the forest"}
        print(f"  ifsar canopy (DSM-DTM, fallback only): {len(dsms)} tiles; over tree cover mean "
              f"{layers['ifsarCanopy']['meanOverTreeCover']:.1f} m")

    oris = sorted(glob.glob(os.path.join(raw, "ori", "tif", "*.tif")))
    if oris:
        ori = onto_grid(oris, "float32", Resampling.average, nodata=0)
        # stretch over land that is not water (lakes are ~1) — 5..95 % so the
        # mask keeps its mid-tones and only the extremes clip
        lo, hi = np.percentile(ori[landmask & (ori > 5)], [5, 95])
        o8 = np.clip((ori - lo) / max(hi - lo, 1) * 255, 0, 255).astype("uint8")
        o8[~landmask] = 0
        o8 = extend(o8)
        o8.tofile(out + ".ori.u8")
        layers["ori"] = {"file": ".ori.u8", "tiles": len(oris), "stretch": [float(lo), float(hi)]}
        print(f"  ori: {len(oris)} tiles; stretched {lo:.0f}..{hi:.0f} -> 0..255")
        # THE PYRAMID, for the bump. A normal taken from the raw radar is a
        # texel-grid weave: single-texel speckle plus the gradient jumps of a
        # bilinear texture (G345's "a texel's gradient is a sparkle"). The bench
        # bumps from the DIFFERENCE of two levels - the features between two
        # wavelengths - so both ends are options. Normalised convolution keeps
        # the coast from bleeding sea into the land's mean.
        try:
            from scipy import ndimage
            m = (landmask & (ori > 5)).astype("float32")
            base = o8.astype("float32") * m
            for lvl, wl in enumerate([10.0, 25.0, 60.0, 140.0], start=1):
                sig = wl / cell / 2.0
                num = ndimage.gaussian_filter(base, sig); den = ndimage.gaussian_filter(m, sig)
                sm = np.where(den > 1e-3, num / np.maximum(den, 1e-3), 0).astype("float32")
                sm = extend(np.clip(sm, 0, 255).astype("uint8"))
                sm.tofile(out + f".ori{lvl}.u8")
                layers[f"ori{lvl}"] = {"file": f".ori{lvl}.u8", "wavelength_m": wl}
            print("  ori pyramid: levels at 10 / 25 / 60 / 140 m")
        except ImportError:
            print("  (no scipy: ori pyramid skipped)")

    lsat = sorted(glob.glob(os.path.join(raw, "landsat", "*.tif")))
    if lsat:
        # bands as written by the fetch: red, green, blue, nir, qa_pixel
        # (Collection 2 Level-2: reflectance = DN * 2.75e-5 - 0.2)
        L = onto_grid(lsat, "float32", Resampling.bilinear, nodata=0, band=1, count=5)
        refl = L[:4] * 2.75e-5 - 0.2
        qa = L[4].astype("uint16")
        cloud = ((qa >> 3) & 1) | ((qa >> 4) & 1) | ((qa >> 1) & 1) | ((qa >> 2) & 1)
        cloud = (cloud == 1) & landmask
        # a gentle stretch: reflectance 0..0.35 -> 0..255 with a gamma, so
        # the dark rainforest keeps its greens without being lifted to grey
        rgb = np.clip(refl[:3] / 0.35, 0, 1) ** 0.7
        rgb8 = (rgb * 255).astype("uint8")
        rgb8[:, ~landmask] = 0
        rgb8 = np.ascontiguousarray(rgb8.transpose(1, 2, 0))
        rgb8 = extend(rgb8)
        rgb8.tofile(out + ".tint.rgb")
        ndvi = (refl[3] - refl[0]) / np.maximum(refl[3] + refl[0], 1e-3)
        n8 = np.clip((ndvi + 1) * 127, 0, 254).astype("uint8"); n8[~landmask] = 0
        n8 = extend(n8)
        n8.tofile(out + ".ndvi.u8")
        layers["tint"] = {"file": ".tint.rgb", "source": [os.path.basename(f) for f in lsat],
                          "cloudCells": int(cloud.sum()),
                          "meanReflRGB": [float(v) for v in refl[:3][:, landmask].mean(axis=1)]}
        layers["ndvi"] = {"file": ".ndvi.u8", "meanOverLand": float(ndvi[landmask].mean())}
        print(f"  tint: {len(lsat)} scene(s); cloud/shadow over land {100*cloud.sum()/max(landmask.sum(),1):.2f} %; "
              f"NDVI over land mean {ndvi[landmask].mean():.2f}")

    oE, oN = isl["origin"]
    meta = {"island": args.island, "w": W, "h": H,
            "x0": float(x0 - oE), "z0": float(oN - z1),        # game frame: row 0 is the north edge
            "origin": [oE, oN], "albers": {"x0": float(x0), "z0": float(z0), "z1": float(z1)},
            "cell": cell, "crs": CRS, "nodata": 0.0,
            "hMin": float(dem.min()), "hMax": float(dem.max()),
            "cover": bool(covers), "coverClasses": cov_classes, "layers": layers,
            "neighbours": bool(args.neighbours),
            "source": [os.path.basename(t) for t in tiles + covers],
            "bboxLonLat": isl["bbox"]}
    with open(out + ".json", "w") as f:
        json.dump(meta, f, indent=1)

    mb = (W * H * 4) / 1048576
    print(f"  {W} x {H} = {W*H/1e6:.1f} M cells, {mb:.1f} MB f32"
          f"{' + %.1f MB u8' % (W*H/1048576) if covers else ''}   {time.time()-t0:.1f} s")
    print(f"  game frame: x {x0-oE:.0f}..{x1-oE:.0f}  z {oN-z1:.0f}..{oN-z0:.0f} (north is -z)  "
          f"origin {oE:.0f} E {oN:.0f} N")
    print(f"  wrote {out}.{{f32,{'u8,' if covers else ''}{''.join(l['file'][1:]+',' for l in layers.values())}json}}")
    print(f"\n  next:  node tools/terrain_bake.js --source grid "
          f"--grid {os.path.relpath(out, root)} --eps 4 --out bench/terrain/{args.island}")


if __name__ == "__main__":
    main()
