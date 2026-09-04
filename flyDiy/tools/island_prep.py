#!/usr/bin/env python3
"""island_prep.py — raw USGS tiles -> ONE grid the baker can read.

futureDesigns/ISLAND-PREPACK.md section 6, steps 1-3 and 8. It does the part
that needs GDAL — mosaic, clip, reproject, resample — and nothing else, then
writes a format so dull that `terrain_bake.js` needs twenty lines to read it:

    <name>.f32     raw float32, row-major, north-up, no header
    <name>.json    { w, h, x0, z0, cell, crs, nodata, source }

WHY NOT PARSE GeoTIFF IN NODE. Because mosaicking 39 tiles, reprojecting them
and clipping to a domain is GDAL's job and GDAL is already required for it. A
TIFF decoder in JavaScript would be a second implementation of something the
pipeline already has, and the baker would inherit compression schemes, tiling
layouts and nodata conventions it has no reason to know about. One dull file
between the two tools is the whole interface.

USAGE
    python3 tools/island_prep.py --in assets/island/raw/dtm \\
        --out bench/ursoy/dem --cell 25 --crs EPSG:32608

    # a 20 x 20 km slice to work on first (ISLAND-ADMIRALTY section 11, stage C)
    python3 tools/island_prep.py --in assets/island/raw/dtm \\
        --out bench/ursoy/slice --cell 10 --extent -1000 -1000 19000 19000

REQUIRES the GDAL command-line tools (gdalbuildvrt, gdalwarp) on PATH, plus
numpy. On Debian/Ubuntu: apt install gdal-bin python3-numpy.
"""
import argparse, glob, json, os, subprocess, sys, tempfile

def need(tool):
    from shutil import which
    if which(tool) is None:
        sys.exit(f"island_prep: '{tool}' not on PATH — install the GDAL "
                 f"command-line tools (apt install gdal-bin)")

def run(cmd):
    print("  $", " ".join(cmd[:6]), "…" if len(cmd) > 6 else "")
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="src", required=True,
                    help="directory of source tiles (.tif)")
    ap.add_argument("--out", required=True, help="output prefix")
    ap.add_argument("--cell", type=float, default=25.0, help="metres per cell")
    ap.add_argument("--crs", default="EPSG:32608",
                    help="target CRS. UTM 8N covers Ursoy; the alternative is "
                         "Alaska Albers EPSG:3338. PICK ONE AND NEVER CONVERT "
                         "AGAIN — this project has paid twice for a quantity "
                         "that lived in two frames.")
    ap.add_argument("--extent", nargs=4, type=float, default=None,
                    metavar=("X0", "Y0", "X1", "Y1"),
                    help="clip window in TARGET CRS metres; default = the data")
    ap.add_argument("--nodata", type=float, default=-32768.0)
    args = ap.parse_args()

    need("gdalbuildvrt"); need("gdalwarp")
    try:
        import numpy as np
    except ImportError:
        sys.exit("island_prep: numpy required")

    tiles = sorted(glob.glob(os.path.join(args.src, "*.tif")))
    if not tiles:
        sys.exit(f"island_prep: no .tif under {args.src} — has "
                 f"tools/island_fetch.sh run?")
    print(f"island_prep: {len(tiles)} tile(s) -> {args.out}.f32 "
          f"@ {args.cell} m, {args.crs}")

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        vrt = os.path.join(tmp, "mosaic.vrt")
        # -allow_projection_difference: the IFSAR tiles are delivered per
        # project and the projects do not all agree; gdalwarp reconciles them.
        run(["gdalbuildvrt", "-allow_projection_difference", vrt] + tiles)

        warped = os.path.join(tmp, "grid.tif")
        cmd = ["gdalwarp", "-t_srs", args.crs, "-tr", str(args.cell),
               str(args.cell), "-r", "cubic", "-dstnodata", str(args.nodata),
               "-of", "GTiff", "-co", "TILED=NO"]
        if args.extent:
            cmd += ["-te"] + [str(v) for v in args.extent]
        run(cmd + [vrt, warped])

        # read it back with gdal_translate to a headerless float32 raster —
        # ENVI is the one GDAL format that IS just the numbers plus a text
        # header, which is exactly the dull interface this script promises.
        need("gdal_translate")
        raw = os.path.join(tmp, "grid.bin")
        run(["gdal_translate", "-of", "ENVI", "-ot", "Float32", warped, raw])

        hdr = {}
        for line in open(raw + ".hdr", encoding="utf-8", errors="replace"):
            if "=" in line:
                k, v = line.split("=", 1)
                hdr[k.strip().lower()] = v.strip()
        w, h = int(hdr["samples"]), int(hdr["lines"])

        info = json.loads(subprocess.run(
            ["gdalinfo", "-json", warped], check=True,
            capture_output=True, text=True).stdout)
        gt = info["geoTransform"]          # x0, dx, 0, y0, 0, dy(neg)
        x0, y1 = gt[0], gt[3]
        z0 = y1 + gt[5] * h                # south edge: the baker is +z north

        a = np.fromfile(raw, dtype="<f4", count=w * h).reshape(h, w)
        # ENVI/GeoTIFF rows run NORTH to SOUTH; the baker indexes +z northward,
        # so flip once, here, and never think about it again downstream.
        a = np.flipud(a).astype("<f4", copy=False)
        # nodata -> sea. Ursoy's domain is mostly water and a hole in a
        # heightfield is a hole in the world; 0 is the honest fill.
        holes = int((a == args.nodata).sum())
        a[a == args.nodata] = 0.0
        a.tofile(args.out + ".f32")

        meta = {"w": w, "h": h, "x0": x0, "z0": z0, "cell": args.cell,
                "crs": args.crs, "nodata": args.nodata,
                "source": f"{len(tiles)} tiles from {args.src}",
                "hMin": float(a.min()), "hMax": float(a.max())}
        json.dump(meta, open(args.out + ".json", "w"), indent=1)

    mb = (w * h * 4) / 1048576
    print(f"  {w} x {h} = {w*h/1e6:.1f} M cells, {mb:.1f} MB")
    print(f"  height {meta['hMin']:.1f} .. {meta['hMax']:.1f} m"
          f"   nodata filled: {holes}")
    print(f"  wrote {args.out}.{{f32,json}}")
    print(f"\n  next:  node tools/terrain_bake.js --source grid "
          f"--grid {args.out} --eps 4 --out bench/terrain/ursoy")

if __name__ == "__main__":
    main()
