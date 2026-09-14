#!/usr/bin/env python3
"""island_look.py — a picture of what island_prep.py wrote.

    py -3.11 tools/island_look.py bench/jolene/dem                 # -> dem.png (cover)
    py -3.11 tools/island_look.py bench/jolene/dem --layer tint    # -> dem.tint.png
    py -3.11 tools/island_look.py bench/jolene/dem --layer all     # every layer present
    py -3.11 tools/island_look.py bench/jolene/dem --max 1600      # longest side

Layers: cover (WorldCover classes), canopy (height, dark -> bright green),
ori (radar backscatter, grey), tint (Landsat true colour), ndvi.

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


def load(prefix, ext, dtype, H, W, n=1):
    import os
    if not os.path.exists(prefix + ext): return None
    a = np.fromfile(prefix + ext, dtype=dtype)
    return a.reshape(H, W, n) if n > 1 else a.reshape(H, W)


def main():
    prefix = sys.argv[1]
    maxside = int(sys.argv[sys.argv.index("--max") + 1]) if "--max" in sys.argv else 1600
    want = sys.argv[sys.argv.index("--layer") + 1] if "--layer" in sys.argv else "cover"
    meta = json.load(open(prefix + ".json"))
    W, H, cell = meta["w"], meta["h"], meta["cell"]
    dem = np.fromfile(prefix + ".f32", dtype="<f4").reshape(H, W)
    layers = {
        "cover":  load(prefix, ".u8", "u1", H, W) if meta.get("cover") else None,
        "canopy": load(prefix, ".canopy.u8", "u1", H, W),
        "ori":    load(prefix, ".ori.u8", "u1", H, W),
        "tint":   load(prefix, ".tint.rgb", "u1", H, W, 3),
        "ndvi":   load(prefix, ".ndvi.u8", "u1", H, W),
    }
    names = [k for k, v in layers.items() if v is not None] if want == "all" else [want]

    # decimate to the picture's size (mean over blocks keeps the coast honest)
    k = max(1, int(np.ceil(max(W, H) / maxside)))
    Hk, Wk = H // k, W // k
    def dec(a, mean):
        if k == 1: return a
        a = a[:Hk * k, :Wk * k]
        if mean:
            if a.ndim == 3: return a.reshape(Hk, k, Wk, k, 3).mean(axis=(1, 3))
            return a.reshape(Hk, k, Wk, k).mean(axis=(1, 3))
        return a[::k, ::k][:Hk, :Wk]
    demk = dec(dem, True); h, w = demk.shape; c = cell * k

    # hillshade, sun from the north-west, 45 deg up
    gz, gx = np.gradient(demk, c)          # rows are +z north (island_prep flipped)
    slope = np.arctan(np.hypot(gx, gz))
    aspect = np.arctan2(-gx, gz)
    az, alt = np.deg2rad(315.0), np.deg2rad(45.0)
    shade = np.clip(np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect), 0, 1)
    sea = demk <= 0
    step = int(round(10000 / c))

    for name in names:
        L = layers.get(name)
        if L is None and name != "height":
            print(f"  (no {name} layer in {prefix})"); continue
        if name == "cover":
            lut = np.zeros((256, 3), dtype=np.float32)
            for k_, v in PALETTE.items(): lut[k_] = v
            rgb = lut[dec(L, False)]
        elif name == "canopy":
            t = np.clip(dec(L.astype(np.float32), True) / 40.0, 0, 1)[..., None]
            rgb = (1 - t) * np.array([150, 140, 110]) + t * np.array([20, 110, 30])
        elif name == "ori":
            g = dec(L.astype(np.float32), True)[..., None]
            rgb = np.repeat(g, 3, axis=2)
        elif name == "tint":
            rgb = dec(L.astype(np.float32), True)
        elif name == "ndvi":
            t = np.clip((dec(L.astype(np.float32), True) / 127.0 - 1.0), 0, 1)[..., None]
            rgb = (1 - t) * np.array([180, 160, 120]) + t * np.array([10, 90, 20])
        rgb = rgb.astype(np.float32)
        rgb[sea] = PALETTE[80]
        light = (0.35 + 0.65 * shade)[..., None] if name in ("cover", "canopy", "ndvi") else (0.7 + 0.3 * shade)[..., None]
        rgb = rgb * np.where(sea[..., None], 0.9, light)
        if step > 0:
            rgb[::step, :] = rgb[::step, :] * 0.6 + 90
            rgb[:, ::step] = rgb[:, ::step] * 0.6 + 90
        img = np.clip(rgb, 0, 255).astype(np.uint8)[::-1]   # north up
        out = prefix + (".png" if name == "cover" else f".{name}.png")
        png(out, img)
        print(f"  {out}  {w} x {h} px at {c:g} m/px")
    print(f"  land {(demk > 0).sum() * c * c / 1e6:.0f} km2   hMax {meta['hMax']:.0f} m")


if __name__ == "__main__":
    main()
