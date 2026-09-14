#!/usr/bin/env python3
"""island_landsat.py — the macro tint: an island's window of Landsat, public domain.

    py -3.11 tools/island_landsat.py --island jolene

ISLAND-ANNETTE.md section 6 ruled imagery IN as a macro tint only — 30 m,
blurred, low weight, never sampled as surface colour. The source is USGS
Landsat Collection 2 Level-2 surface reflectance (public domain). USGS's own
portals need a login and the AWS bucket is requester-pays, so the bytes are
read through Microsoft's Planetary Computer mirror: an anonymous STAC search
finds the scene, an anonymous container token signs the blob URLs, and
rasterio reads ONLY the island's window from each band's COG — a few MB per
scene instead of a 1 GB download. The result is one small GeoTIFF per scene
under assets/island/raw/<island>/landsat/, five bands: red, green, blue, nir,
qa_pixel, in the scene's own UTM. island_prep.py mosaics and warps them.

THE SCENES ARE PINNED PER ISLAND, not searched at run time: a tint is a
choice made by eye (cloud-free, summer, one day for the whole island so the
seams are invisible). `--search` prints candidates and stops.

The mirror is a build-time convenience, not a dependency: the written
GeoTIFFs are what the pipeline reads, and any other route to the same USGS
scenes (EarthExplorer, the AWS bucket) yields the same bytes.

Rate limits: the per-asset sign endpoint 429s after a handful of calls;
the per-container token is one call. GDAL's curl on Windows trips on an
antivirus TLS proxy (Avast) - GDAL_HTTP_UNSAFESSL is set for the read only.
"""
import argparse, json, os, ssl, sys, time, urllib.request

STAC = "https://planetarycomputer.microsoft.com/api/stac/v1"
TOKEN = "https://planetarycomputer.microsoft.com/api/sas/v1/token/landsateuwest/landsat-c2"
BANDS = ["red", "green", "blue", "nir08", "qa_pixel"]

# scenes chosen by eye: Landsat 8, 27 July 2022, path 055 rows 022 + 021 -
# one pass, cloud 0.06 % / 3.2 %, the island split across the two rows
ISLANDS = {
    "jolene": {
        "bbox": (-131.75, 54.95, -131.25, 55.35), "pad_m": 2000.0,
        "scenes": ["LC08_L2SP_055022_20220727_02_T1", "LC08_L2SP_055021_20220727_02_T1"],
    },
    "ursoy": {"bbox": (-134.95, 57.05, -133.75, 58.25), "pad_m": 4000.0, "scenes": []},
}


def get(url, tries=6):
    ctx = ssl.create_default_context()
    for i in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "flydiy"}),
                                          context=ctx, timeout=120).read()
        except urllib.error.HTTPError as e:
            if e.code == 429 and i < tries - 1:
                wait = 15 * (i + 1); print(f"    (429, waiting {wait} s)"); time.sleep(wait); continue
            raise


def search(isl):
    q = {"collections": ["landsat-c2-l2"], "bbox": list(isl["bbox"]),
         "datetime": "2016-06-01/2026-12-31", "limit": 100,
         "query": {"eo:cloud_cover": {"lt": 30}, "platform": {"in": ["landsat-8", "landsat-9"]}},
         "sortby": [{"field": "properties.eo:cloud_cover", "direction": "asc"}]}
    req = urllib.request.Request(STAC + "/search", data=json.dumps(q).encode(),
                                 headers={"Content-Type": "application/json", "User-Agent": "flydiy"})
    d = json.loads(urllib.request.urlopen(req, context=ssl.create_default_context(), timeout=120).read())
    for it in d.get("features", []):
        p = it["properties"]
        month = p["datetime"][5:7]
        print(f"  {it['id']}  {p['datetime'][:10]}  cloud {p.get('eo:cloud_cover'):5.2f} %  "
              f"path/row {p.get('landsat:wrs_path')}/{p.get('landsat:wrs_row')}"
              f"{'  SUMMER' if month in ('06','07','08','09') else ''}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--island", default="jolene", choices=sorted(ISLANDS))
    ap.add_argument("--search", action="store_true", help="list candidate scenes and stop")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()
    isl = ISLANDS[args.island]
    if args.search:
        search(isl); return
    if not isl["scenes"]:
        sys.exit("island_landsat: no scenes pinned for this island - run --search and pin")

    import rasterio
    from rasterio.warp import transform_bounds
    from rasterio.windows import from_bounds
    here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here)
    out = args.out or os.path.join(root, "assets", "island", "raw", args.island, "landsat")
    os.makedirs(out, exist_ok=True)
    # the window in Alaska Albers (the game frame), padded, as island_prep sees it
    w, s, e, n = transform_bounds("EPSG:4326", "EPSG:3338", *isl["bbox"], densify_pts=21)
    p = isl["pad_m"]; albers = (w - p, s - p, e + p, n + p)

    tok = json.loads(get(TOKEN))["token"]
    for sid in isl["scenes"]:
        dest = os.path.join(out, sid + "_rgbn_qa.tif")
        if os.path.exists(dest):
            print(f"  = {os.path.basename(dest)}  (have it)"); continue
        item = json.loads(get(f"{STAC}/collections/landsat-c2-l2/items/{sid}"))
        arrs = []
        with rasterio.Env(GDAL_HTTP_UNSAFESSL="YES", GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR"):
            for b in BANDS:
                href = item["assets"][b]["href"] + "?" + tok
                with rasterio.open("/vsicurl/" + href) as src:
                    win = from_bounds(*transform_bounds("EPSG:3338", src.crs, *albers), transform=src.transform)
                    win = win.round_offsets().round_lengths()
                    arrs.append(src.read(1, window=win))
                    wt, crs = src.window_transform(win), src.crs
                    print(f"    {sid} {b:9s} {arrs[-1].shape}")
        h, wd = arrs[0].shape
        with rasterio.open(dest, "w", driver="GTiff", height=h, width=wd, count=5, dtype="uint16",
                           crs=crs, transform=wt, compress="deflate", nodata=0) as dst:
            for i, a in enumerate(arrs): dst.write(a, i + 1)
            dst.update_tags(SOURCE=f"USGS Landsat Collection 2 Level-2 SR, {sid}, public domain; "
                                   f"island window read via Microsoft Planetary Computer",
                            BANDS=",".join(BANDS))
        print(f"  wrote {os.path.relpath(dest, root)}  {os.path.getsize(dest) // 1024} kB")


if __name__ == "__main__":
    main()
