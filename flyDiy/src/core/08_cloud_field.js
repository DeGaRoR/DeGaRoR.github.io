// ============================================================
// THE CLOUD FIELD (CLOUDS C1, 2026-09-15) — the weather map, the height
// profiles, the layer, the column. Pure: no THREE, no Date, node-runnable.
//
// One field, every consumer derived (futureDesigns/CLOUDS-2026-09-15.md §3):
// the GPU march (clouds.js) samples THIS map as a texture and applies THIS
// profile in GLSL; the shadow (C3) integrates the column; the eye's white-out
// (C4) reads the density here. Everything is a pure function of (seed, the
// day's cover and type, the drift the wind and the clock give) so gates and
// screenshots reproduce.
//
// THE WEATHER MAP: N x N texels tiling over SPAN metres, RGBA =
//   R coverage   0..1 — the fraction of the column the cloud fills, 0 = clear
//   G height     0.5..1 — the column's own top as a fraction of the layer's
//   B lumpiness  0..1 — a second noise the GLSL uses to vary the profile
//   A wetness    reserved (precipitation is its own session)
// The coverage's threshold is the (1 − cover) QUANTILE of the noise, so the
// covered fraction of the map IS the day's cloudCover — exactly, not by eye
// (GATE CLOUD holds it within 5 % after the soft edge).
//
// THE PROFILE (Schneider 2015): a column fills between a rounded bottom and a
// top that the map's height channel sets; stratus flat and thin, cumulus
// tall with a domed top, cumulonimbus taller still. h is the height in the
// layer as a fraction of its thickness, hs the column's height scale.
// ============================================================
var CLOUD_FIELD = (function () {
  'use strict';
  const SPAN = 40000;                     // m, the map's tile
  const N_DEFAULT = 256;
  // the types: thickness (m), the profile's bottom / top fractions, the map's base frequency (cells per tile),
  // the map's soft edge (width), the columns' least height (hsMin), and - A6, 2026-09-20 - how much the
  // noise ERODES the column (erode: the worley fbm's share subtracted from the base noise - a stratus is a
  // sheet the noise barely touches, a cumulus is carved to half its column), the base noise's PERIOD (m: the
  // cells' size - a cumulus 1.5 km across, an altocumulus 600 m), and `alt`: the base an UPPER DECK takes when
  // none is given (the first layer's base is always the dewpoint's)
  const TYPES = Object.freeze({
    // top: where the column's fill starts to fall toward its own top (hs) - a cumulus keeps its density
    // to near the top (a domed, sharp cap, C2's eye); a stratus fades over half its depth
    st: Object.freeze({ label: 'stratus',       thick: 300,  bot: 0.05, top: 0.50, freq: 2,  width: 0.45, hsMin: 0.7, erode: 0.12, period: 9000,  alt: 400 }),
    sc: Object.freeze({ label: 'stratocumulus', thick: 700,  bot: 0.06, top: 0.70, freq: 4,  width: 0.35, hsMin: 0.6, erode: 0.30, period: 4000,  alt: 1500 }),
    cu: Object.freeze({ label: 'cumulus',       thick: 1500, bot: 0.08, top: 0.82, freq: 6,  width: 0.30, hsMin: 0.5, erode: 0.50, period: 6000,  alt: 1200 }),
    cb: Object.freeze({ label: 'cumulonimbus',  thick: 4000, bot: 0.06, top: 0.88, freq: 3,  width: 0.30, hsMin: 0.6, erode: 0.50, period: 8000,  alt: 1000 }),
    ac: Object.freeze({ label: 'altocumulus',   thick: 500,  bot: 0.10, top: 0.65, freq: 10, width: 0.40, hsMin: 0.7, erode: 0.35, period: 2500,  alt: 3500 }),
    as: Object.freeze({ label: 'altostratus',   thick: 1200, bot: 0.05, top: 0.55, freq: 2,  width: 0.50, hsMin: 0.7, erode: 0.10, period: 12000, alt: 4000 }),
  });
  const TYPE_ORDER = ['st', 'sc', 'cu', 'cb', 'ac', 'as'];
  const MAX_LAYERS = 3;                   // the low deck + two upper decks (the cirrus veil is the dome's, not a layer)
  const LAYER_GAP = 150;                  // m of clear air between one deck's top and the next one's base
  const typeOf = t => TYPES[t] ? t : 'cu';
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // ---- a tileable value noise on an integer lattice, seeded --------------
  function hash(ix, iz, seed) {
    let h = (ix * 374761393 + iz * 668265263 + seed * 1274126177) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  // value noise at (u, v) in tile units [0,1) with F cells per tile (tiles by construction: the lattice wraps)
  function vnoise(u, v, F, seed) {
    const x = u * F, z = v * F, ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz, sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
    const w = (a, b) => hash(((a % F) + F) % F, ((b % F) + F) % F, seed);
    const a = w(ix, iz), b = w(ix + 1, iz), c = w(ix, iz + 1), d = w(ix + 1, iz + 1);
    return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sz;
  }
  function fbm(u, v, F, seed, oct) {
    let s = 0, amp = 0.5, f = F, tot = 0;
    for (let i = 0; i < oct; i++) { s += amp * vnoise(u, v, f, seed + i * 7919); tot += amp; amp *= 0.5; f *= 2; }
    return s / tot;
  }

  // weatherMap({ seed, cover, type, N }) -> { N, span, data (Float32Array N*N*4), cover, type, seed, lo, hi }
  function weatherMap(o) {
    o = o || {};
    const N = o.N || N_DEFAULT, seed = (o.seed | 0) || 1, cover = clamp(o.cover != null ? o.cover : 0.2, 0, 1), type = typeOf(o.type), T = TYPES[type];
    const data = new Float32Array(N * N * 4), n0 = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) n0[j * N + i] = fbm(i / N, j / N, T.freq, seed, 5);
    // the threshold: the (1 - cover) quantile of the noise - the covered fraction IS the cover
    const sorted = Float32Array.from(n0).sort();
    const q = clamp(Math.round((1 - cover) * N * N), 0, N * N);
    const lo = cover <= 0 ? 2 : cover >= 1 ? -1 : sorted[Math.min(N * N - 1, q)];
    const hi = lo + T.width * (sorted[N * N - 1] - sorted[0]);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i, n = n0[k];
      const c = cover >= 1 ? 1 : cover <= 0 ? 0 : clamp((n - lo) / Math.max(1e-6, hi - lo), 0, 1);
      const h2 = fbm(i / N, j / N, 3, seed + 101, 3), l2 = fbm(i / N, j / N, 8, seed + 202, 3);
      data[k * 4] = c;
      data[k * 4 + 1] = T.hsMin + (1 - T.hsMin) * clamp(0.6 * Math.sqrt(c) + 0.4 * h2, 0, 1);   // bigger columns stand taller
      data[k * 4 + 2] = l2;
      data[k * 4 + 3] = 0;
    }
    return { N, span: SPAN, data, cover, type, seed, lo, hi };
  }
  // sample(map, x, z, [drift]) -> [coverage, height, lumpiness, wetness], bilinear, tiling; x z world metres
  function sample(map, x, z, drift, out) {
    const N = map.N, d = map.data, o = out || [0, 0, 0, 0];
    let u = (x + (drift ? drift[0] : 0)) / map.span, v = (z + (drift ? drift[1] : 0)) / map.span;
    u = (u - Math.floor(u)) * N - 0.5; v = (v - Math.floor(v)) * N - 0.5;
    const i0 = Math.floor(u), j0 = Math.floor(v), fu = u - i0, fv = v - j0;
    const ia = ((i0 % N) + N) % N, ib = (ia + 1) % N, ja = ((j0 % N) + N) % N, jb = (ja + 1) % N;
    for (let c = 0; c < 4; c++) {
      const a = d[(ja * N + ia) * 4 + c], b = d[(ja * N + ib) * 4 + c], e = d[(jb * N + ia) * 4 + c], f = d[(jb * N + ib) * 4 + c];
      o[c] = (a + (b - a) * fu) + ((e + (f - e) * fu) - (a + (b - a) * fu)) * fv;
    }
    return o;
  }
  // the covered fraction of the map (texels with any coverage)
  function coverFraction(map) { let n = 0; for (let k = 0; k < map.N * map.N; k++) if (map.data[k * 4] > 0) n++; return n / (map.N * map.N); }
  // profile(type, h, hs): the column's fill at height fraction h (0 the base, 1 the layer's top) for a column of height scale hs
  function profile(type, h, hs) {
    const T = TYPES[typeOf(type)], top = Math.max(0.05, hs || 1);
    if (h <= 0 || h >= top) return 0;
    return smooth(0, T.bot, h) * (1 - smooth(T.top * top, top, h));
  }
  // layer(day) -> { base, thick, top, type }: the day's base (the dewpoint spread), the type's thickness
  function layer(day, override) {
    const type = typeOf(day && day.cloudType), T = TYPES[type];
    let base = override && override.base != null ? override.base : (day && day.cloudBase != null ? day.cloudBase : 1000);
    base = clamp(base, 120, 5000);
    const thick = override && override.thick != null ? override.thick : T.thick;
    return { base, thick, top: base + thick, type };
  }
  // layers(day, override) -> [layer0, ...upper]: SEVERAL DECKS AT ONCE (A6, 2026-09-20 - the user: "generate several
  // cloud layers simultaneously, at different altitudes"). The first is layer(day) - the day's cover and type at the
  // dewpoint base; the others come from day.cloudUpper = [{ cover, type, base?, thick? }] (at most MAX_LAYERS - 1),
  // each base clamped ABOVE the deck below (LAYER_GAP of clear air - the march walks the decks in order along the
  // ray and never overlaps them) and under 12 km; a missing base is the type's `alt`. Every entry carries its
  // cover, its type and its index (the weather map and the drift are per deck).
  function layers(day, override) {
    const first = layer(day, override);
    first.cover = clamp(day && day.cloudCover != null ? day.cloudCover : 0.2, 0, 1); first.index = 0;
    const out = [first], up = (day && day.cloudUpper) || [];
    for (let i = 0; i < up.length && out.length < MAX_LAYERS; i++) {
      const u = up[i] || {}, type = typeOf(u.type), T = TYPES[type], prev = out[out.length - 1];
      let base = u.base != null && isFinite(+u.base) ? +u.base : T.alt;
      base = clamp(base, prev.top + LAYER_GAP, 12000);
      const thick = u.thick != null && +u.thick > 0 ? +u.thick : T.thick;
      out.push({ base, thick, top: base + thick, type, cover: clamp(u.cover != null ? +u.cover : 0, 0, 1), index: out.length });
    }
    return out;
  }
  // columnOD(map, x, z, layer, sigma): the column's optical depth straight down (the shadow's term, C3) -
  // coverage x the profile's mean fill x the column's height x sigma (per metre)
  const FILL = {};   // the profile's mean over h for hs = 1, per type (a constant of the type)
  for (const t of TYPE_ORDER) { let s = 0; for (let i = 0; i < 200; i++) s += profile(t, (i + 0.5) / 200, 1); FILL[t] = s / 200; }
  function columnOD(map, x, z, lay, sigma, drift) {
    const w = sample(map, x, z, drift);
    return w[0] * FILL[lay.type] * w[1] * lay.thick * (sigma != null ? sigma : SIGMA);
  }
  const SIGMA = 0.04;     // extinction per metre at full density (a fair-weather cumulus is 0.02-0.1)

  // upperWith(upper, i, patch): the day's cloudUpper with deck i (0 = the first upper deck) patched - a new array
  // for day.set({ cloudUpper }); a missing deck is born as a 0-cover altocumulus (the rails' rows share this)
  function upperWith(upper, i, patch) {
    const out = (Array.isArray(upper) ? upper : []).slice(0, MAX_LAYERS - 1).map(o => Object.assign({}, o));
    while (out.length <= i && out.length < MAX_LAYERS - 1) out.push({ cover: 0, type: 'ac' });
    if (out[i]) Object.assign(out[i], patch);
    return out;
  }
  const API = { SPAN, TYPES, TYPE_ORDER, MAX_LAYERS, LAYER_GAP, SIGMA, FILL, typeOf, weatherMap, sample, coverFraction, profile, layer, layers, upperWith, columnOD, vnoise, fbm };
  return API;
})();
if (typeof module !== 'undefined' && module.exports && !module.exports.makeWorld) module.exports = CLOUD_FIELD;
