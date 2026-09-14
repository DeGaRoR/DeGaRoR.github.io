#!/usr/bin/env python3
"""island_look.py — a picture of what island_prep.py wrote.

    py -3.11 tools/island_look.py bench/annette/dem            # -> dem.png
    py -3.11 tools/island_look.py bench/annette/dem --max 1600 # longest side

Hillshade from the north-west over the WorldCover class colours (tree, shrub,
grass, bare, snow, water, wetland), sea in blue, a 10 km grid, north up.
Pure numpy + zlib: no plotting library, no GDAL. The point is to LOOK at the
data before arguing about it — the doc's own rule for every choice that
defines the island's character.
"""
import json, struct, sys, zlib
import numpy as np

# WorldCover class -> RGB. Muted on purpose: the hillshade carries the form.
PALETTE = {
    0:   (120, 120, 120),   # no data
    10:  (34,  84,  40),    # tree cover
    20:  (140, 150, 60),    # shrubland
    30:  (170, 190, 90),    # grassland
    40:  (200, 180, 120),   # cropland
    50:  (190, 60,  60),    # built-up
    60:  (150, 140, 130),   # bare / sparse
    70:  (240, 240, 245),   # snow and ice
    80:  (40,  70,  120),   # permanent water
    90:  (110, 150, 120),   # herbaceous wetland (muskeg)
    95:  (60,  120, 110),   # mangroves (n/a)
    100: (170, 170, 110),   # moss and lichen
}


def png(path, rgb):
    h, w, _ = rgb.shape
    raw = b"".join(b"\x00" + rgb[y].tobytes() for y in range(h))
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)))
        f.write(chunk(b"IDAT", zlib.compress(raw, 6)))
        f.write(chunk(b"IEND", b""))


def main():
    prefix = sys.argv[1]
    maxside = int(sys.argv[sys.argv.index("--max") + 1]) if "--max" in sys.argv else 1600
    meta = json.load(open(prefix + ".json"))
    W, H, cell = meta["w"], meta["h"], meta["cell"]
    dem = np.fromfile(prefix + ".f32", dtype="<f4").reshape(H, W)
    cov = None
    if meta.get("cover"):
        cov = np.fromfile(prefix + ".u8", dtype="u1").reshape(H, W)

    # decimate to the picture's size (mean over blocks keeps the coast honest)
    k = max(1, int(np.ceil(max(W, H) / maxside)))
    if k > 1:
        Hk, Wk = H // k, W // k
        dem = dem[:Hk * k, :Wk * k].reshape(Hk, k, Wk, k).mean(axis=(1, 3))
        if cov is not None:
            cov = cov[:Hk * k, :Wk * k][::k, ::k][:Hk, :Wk]
    h, w = dem.shape
    c = cell * k

    # hillshade, sun from the north-west, 45 deg up
    gz, gx = np.gradient(dem, c)          # rows are +z north (island_prep flipped)
    slope = np.arctan(np.hypot(gx, gz) * 1.0)
    aspect = np.arctan2(-gx, gz)
    az, alt = np.deg2rad(315.0), np.deg2rad(45.0)
    shade = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
    shade = np.clip(shade, 0, 1)

    rgb = np.zeros((h, w, 3), dtype=np.float32)
    if cov is not None:
        lut = np.zeros((256, 3), dtype=np.float32)
        for k_, v in PALETTE.items(): lut[k_] = v
        rgb = lut[cov]
    else:
        t = np.clip(dem / max(meta["hMax"], 1), 0, 1)[..., None]
        rgb = (1 - t) * np.array([60, 110, 50]) + t * np.array([230, 230, 230])
    sea = dem <= 0
    rgb[sea] = PALETTE[80]
    light = (0.35 + 0.65 * shade)[..., None]
    rgb = rgb * np.where(sea[..., None], 0.9, light)
    # a faint band above the snowline proposed in ISLAND-ADMIRALTY §4.2
    rgb[(dem >= 900) & ~sea] = rgb[(dem >= 900) & ~sea] * 0.5 + 120

    # 10 km grid, one pixel, from the domain origin
    step = int(round(10000 / c))
    if step > 0:
        rgb[::step, :] = rgb[::step, :] * 0.6 + 90
        rgb[:, ::step] = rgb[:, ::step] * 0.6 + 90

    img = np.clip(rgb, 0, 255).astype(np.uint8)[::-1]   # north up
    png(prefix + ".png", img)
    print(f"  {prefix}.png  {w} x {h} px at {c:g} m/px   "
          f"land {(dem > 0).sum() * c * c / 1e6:.0f} km2   hMax {meta['hMax']:.0f} m")


if __name__ == "__main__":
    main()
