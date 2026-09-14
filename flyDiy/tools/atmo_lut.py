#!/usr/bin/env python3
"""atmo_lut.py — the numpy mirror of src/viewer/atmo.js (SKY S3, 2026-09-14).

The atmosphere's model is written twice on purpose, the way sky_grade.py
holds the hangar's grade: the JS (and its GLSL) is what ships, this file is
the second pair of hands. It reproduces the Hillaire medium, Bruneton's
transmittance mapping and the 40-step transmittance integral step for step,
plus the single-scatter sky radiance along a few rays (no multi-scatter: that
table is the JS's own and the gate checks its sanity separately), and writes
tools/atmo_ref.json for GATE ATMO (tools/_atmo_check.js) to hold the JS to.

    py -3.11 tools/atmo_lut.py          -> tools/atmo_ref.json

Requires numpy. Every number is per unit sun illuminance (E_sun = 1), km.
"""
import json, math, os, sys
import numpy as np

Rg, Rt = 6360.0, 6460.0
RAY_S = np.array([5.802e-3, 13.558e-3, 33.1e-3]); RAY_H = 8.0
MIE_S, MIE_A, MIE_H, MIE_G = 3.996e-3, 4.40e-3, 1.2, 0.8
OZ_A = np.array([0.650e-3, 1.881e-3, 0.085e-3]); OZ_C, OZ_W = 25.0, 15.0
MIE_K, OZ_K, ALBEDO = 1.0, 1.0, 0.15


def medium(h):
    dR = math.exp(-h / RAY_H); dM = math.exp(-h / MIE_H) * MIE_K
    dO = max(0.0, 1.0 - abs(h - OZ_C) / OZ_W) * OZ_K
    sR = RAY_S * dR; sM = MIE_S * dM
    e = sR + (MIE_S + MIE_A) * dM + OZ_A * dO
    return sR, sM, e


def ray_sphere(r, mu, R):
    b = r * mu; c = r * r - R * R; disc = b * b - c
    if disc < 0: return -1.0
    s = math.sqrt(disc); t0 = -b - s; t1 = -b + s
    if t1 < 0: return -1.0
    return t0 if t0 >= 0 else t1


def path_end(r, mu):
    tg = ray_sphere(r, mu, Rg)
    if tg >= 0: return tg, True
    return ray_sphere(r, mu, Rt), False


def transmittance(r, mu, steps=40):
    t_end, _ = path_end(r, mu)
    if t_end <= 0: return np.ones(3)
    dt = t_end / steps; acc = np.zeros(3)
    for i in range(steps):
        t = (i + 0.5) * dt
        h = math.sqrt(r * r + t * t + 2 * r * mu * t) - Rg
        acc += medium(h)[2] * dt
    return np.exp(-acc)


def t_from_uv(u, v):
    H = math.sqrt(Rt * Rt - Rg * Rg); rho = H * v
    r = math.sqrt(rho * rho + Rg * Rg)
    d_min = Rt - r; d_max = rho + H; d = d_min + u * (d_max - d_min)
    mu = 1.0 if d == 0 else (H * H - rho * rho - d * d) / (2 * r * d)
    return r, max(-1.0, min(1.0, mu))


def phase_r(c): return 3.0 / (16 * math.pi) * (1 + c * c)


def phase_m(c):
    g = MIE_G; g2 = g * g
    return 3.0 / (8 * math.pi) * (1 - g2) / (2 + g2) * (1 + c * c) / (1 + g2 - 2 * g * c) ** 1.5


def single_scatter(r, d, sun, steps=32):
    """the sky's SINGLE-scatter radiance along d (no Psi_ms term, no ground term)."""
    mu = d[1]; t_end, ground = path_end(r, mu)
    L = np.zeros(3)
    if t_end <= 0: return L
    dt = t_end / steps; ct = float(np.dot(d, sun)); pR = phase_r(ct); pM = phase_m(ct)
    T = np.ones(3)
    for s in range(steps):
        t = (s + 0.5) * dt
        p = np.array([0.0, r, 0.0]) + np.array(d) * t
        rr = float(np.linalg.norm(p)); h = rr - Rg
        sR, sM, e = medium(h)
        muS = float(np.dot(p, sun)) / rr
        shadow = 0.0 if ray_sphere(rr, muS, Rg) >= 0 else 1.0
        S = (sR * pR + sM * pM) * transmittance(rr, muS, 40) * shadow
        seg = (1 - np.exp(-e * dt)) / np.maximum(1e-9, e)
        L += T * S * seg
        T *= np.exp(-e * dt)
    return L


def main():
    out = {'note': 'numpy mirror of atmo.js; E_sun = 1; km', 'T_uv': [], 'T_el': [], 'S1': []}
    # the transmittance LUT at sampled (u, v) cells: the same cells the JS bakes
    TW, TH = 256, 64
    for (i, j) in [(0, 0), (64, 0), (128, 0), (200, 0), (255, 0), (0, 32), (128, 32), (255, 32), (0, 63), (128, 63), (255, 63), (192, 8), (40, 16)]:
        r, mu = t_from_uv((i + 0.5) / TW, (j + 0.5) / TH)
        out['T_uv'].append({'i': i, 'j': j, 'r': r, 'mu': mu, 'T': transmittance(r, mu).tolist()})
    # the sun's transmittance at sea level (10 m) for the elevations the calibration and the gate quote
    for el in [90, 58.4, 33.4, 10.6, 5, 2, 0.5, 0]:
        mu = math.sin(math.radians(el))
        out['T_el'].append({'el': el, 'T': transmittance(Rg + 0.01, mu).tolist()})
    # single scatter along a few rays: the JS's skyRadiance minus its Psi_ms term must match these
    for el_sun in [58.4, 33.4, 10.6, 2.0]:
        sun = np.array([0.0, math.sin(math.radians(el_sun)), math.cos(math.radians(el_sun))])
        for d in [[0.0, 1.0, 0.0], [0.0, 0.05, 0.9987], [0.0, 0.05, -0.9987], [0.9987, 0.05, 0.0]]:
            out['S1'].append({'sunEl': el_sun, 'd': d, 'L': single_scatter(Rg + 0.01, d, sun).tolist()})
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'atmo_ref.json')
    with open(p, 'w', newline='\n') as f: json.dump(out, f, indent=1)
    print('wrote', p, len(out['T_uv']), 'T cells,', len(out['T_el']), 'sun rows,', len(out['S1']), 'rays')


if __name__ == '__main__':
    main()
