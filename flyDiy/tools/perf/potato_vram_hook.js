// potato_vram_hook.js - WHAT THE PAGE HOLDS ON THE GPU (POTATO-DEEP, G1520). Injected at document start
// (tools/perf/potato_census.js, Page.addScriptToEvaluateOnNewDocument): every WebGL2 allocation - texture levels
// (texImage2D/3D, texStorage2D/3D, compressedTexImage2D/3D), renderbuffers (with their samples), buffers (bufferData) -
// tallied per GL object and released on delete, so window.__VRAM.sum() is the bytes the page holds RIGHT NOW by kind.
// The GTX 660 the user tested on has 2 GB; a working set past it pages over PCIe every frame (the suspicion for its
// 450-580 ms GPU frames at 6-17 M triangles while the shed drew 6 M in 49 ms). Estimates: uncompressed formats by their
// internal format's bytes a texel, compressed by the data's length (or the block size), a renderbuffer x its samples;
// the canvas's own back buffer is not seen (the census adds it).
(function () {
  'use strict';
  if (typeof WebGL2RenderingContext === 'undefined' || window.__VRAM) return;
  const P = WebGL2RenderingContext.prototype;
  const G = WebGL2RenderingContext;
  // bytes a texel by internal format (the sized ones three uses; unsized RGBA/RGB by type)
  const BPP = {};
  const set = (k, v) => { if (G[k] !== undefined) BPP[G[k]] = v; };
  set('R8', 1); set('R8_SNORM', 1); set('R8UI', 1); set('R8I', 1); set('RG8', 2); set('RG8UI', 2); set('RGB8', 4); set('SRGB8', 4);
  set('RGBA8', 4); set('SRGB8_ALPHA8', 4); set('RGBA8UI', 4); set('RGB565', 2); set('RGBA4', 2); set('RGB5_A1', 2); set('RGB10_A2', 4);
  set('R16F', 2); set('RG16F', 4); set('RGB16F', 8); set('RGBA16F', 8); set('R32F', 4); set('RG32F', 8); set('RGB32F', 16); set('RGBA32F', 16);
  set('R11F_G11F_B10F', 4); set('RGB9_E5', 4); set('R16UI', 2); set('R32UI', 4); set('RG16UI', 4); set('RG32UI', 8); set('RGBA16UI', 8); set('RGBA32UI', 16);
  set('DEPTH_COMPONENT16', 2); set('DEPTH_COMPONENT24', 4); set('DEPTH_COMPONENT32F', 4); set('DEPTH24_STENCIL8', 4); set('DEPTH32F_STENCIL8', 8);
  set('RGBA', 4); set('RGB', 4); set('LUMINANCE', 1); set('ALPHA', 1); set('LUMINANCE_ALPHA', 2); set('RED', 1); set('RG', 2);
  const typeK = t => (t === G.FLOAT ? 4 : t === G.HALF_FLOAT ? 2 : 1);
  const bppOf = (fmt, type) => { let b = BPP[fmt] || 4; if ((fmt === G.RGBA || fmt === G.RGB || fmt === G.RED || fmt === G.RG) && type) b *= typeK(type); return b; };
  const st = new WeakMap();            // GL object -> { kind, levels: Map(key -> bytes), w, h, d, fmt }
  const live = new Set();              // the objects with bytes (for sum())
  const bound = { tex: new Map(), unit: 0, units: [], buf: new Map(), rb: null };
  const rec = (o, kind) => { let r = st.get(o); if (!r) { r = { kind, levels: new Map(), bytes: 0, w: 0, h: 0, d: 1, fmt: 0, compressed: false, samples: 0 }; st.set(o, r); } if (kind) r.kind = kind; live.add(o); return r; };
  const put = (r, key, b) => { r.bytes += b - (r.levels.get(key) || 0); r.levels.set(key, b); };
  const curTex = target => { const u = bound.units[bound.unit] || (bound.units[bound.unit] = new Map()); return u.get(target === G.TEXTURE_CUBE_MAP_POSITIVE_X || (target > G.TEXTURE_CUBE_MAP_POSITIVE_X && target <= G.TEXTURE_CUBE_MAP_NEGATIVE_Z) ? G.TEXTURE_CUBE_MAP : target); };
  const kindOf = target => (target === G.TEXTURE_2D ? 'tex2d' : target === G.TEXTURE_2D_ARRAY ? 'texArray' : target === G.TEXTURE_3D ? 'tex3d' : 'texCube');
  const wrap = (name, fn) => { const f = P[name]; if (!f) return; P[name] = function () { try { fn.apply(this, arguments); } catch (e) {} return f.apply(this, arguments); }; };
  wrap('activeTexture', function (u) { bound.unit = u - G.TEXTURE0; });
  wrap('bindTexture', function (target, t) { const u = bound.units[bound.unit] || (bound.units[bound.unit] = new Map()); u.set(target, t); });
  wrap('bindBuffer', function (target, b) { bound.buf.set(target, b); });
  wrap('bindRenderbuffer', function (target, rb) { bound.rb = rb; });
  wrap('texImage2D', function (target, level, ifmt, a3, a4, a5, a6, a7) {
    const t = curTex(target); if (!t) return;
    let w, h, fmt = ifmt, type;
    if (arguments.length >= 8 && typeof a3 === 'number' && typeof a4 === 'number') { w = a3; h = a4; type = a7; }
    else { const src = arguments[arguments.length - 1]; type = arguments[4]; w = src && (src.videoWidth || src.naturalWidth || src.displayWidth || src.width) || 0; h = src && (src.videoHeight || src.naturalHeight || src.displayHeight || src.height) || 0; }
    const r = rec(t, target === G.TEXTURE_2D ? 'tex2d' : 'texCube'); if (level === 0) { r.w = w; r.h = h; r.fmt = fmt; }
    put(r, target + ':' + level, w * h * bppOf(fmt, type));
  });
  wrap('texImage3D', function (target, level, ifmt, w, h, d, b, fmt, type) {
    const t = curTex(target); if (!t) return; const r = rec(t, kindOf(target)); if (level === 0) { r.w = w; r.h = h; r.d = d; r.fmt = ifmt; }
    put(r, target + ':' + level, w * h * d * bppOf(ifmt, type));
  });
  wrap('texStorage2D', function (target, levels, ifmt, w, h) {
    const t = curTex(target); if (!t) return; const r = rec(t, target === G.TEXTURE_2D ? 'tex2d' : 'texCube'); r.w = w; r.h = h; r.fmt = ifmt;
    const faces = target === G.TEXTURE_CUBE_MAP ? 6 : 1; let b = 0, x = w, y = h;
    const cb = CBPP[ifmt];
    for (let l = 0; l < levels; l++) { b += cb ? Math.ceil(x / 4) * Math.ceil(y / 4) * cb : x * y * bppOf(ifmt); x = Math.max(1, x >> 1); y = Math.max(1, y >> 1); }
    if (cb) r.compressed = true;
    put(r, 'storage', b * faces);
  });
  wrap('texStorage3D', function (target, levels, ifmt, w, h, d) {
    const t = curTex(target); if (!t) return; const r = rec(t, kindOf(target)); r.w = w; r.h = h; r.d = d; r.fmt = ifmt;
    let b = 0, x = w, y = h, z = d; const cb = CBPP[ifmt];
    for (let l = 0; l < levels; l++) { b += (cb ? Math.ceil(x / 4) * Math.ceil(y / 4) * cb : x * y * bppOf(ifmt)) * z; x = Math.max(1, x >> 1); y = Math.max(1, y >> 1); if (target === G.TEXTURE_3D) z = Math.max(1, z >> 1); }
    if (cb) r.compressed = true;
    put(r, 'storage', b);
  });
  wrap('compressedTexImage2D', function (target, level, ifmt, w, h, border, data) {
    const t = curTex(target); if (!t) return; const r = rec(t, target === G.TEXTURE_2D ? 'tex2d' : 'texCube'); r.compressed = true; if (level === 0) { r.w = w; r.h = h; r.fmt = ifmt; }
    const n = data && data.byteLength != null ? data.byteLength : (typeof data === 'number' ? data : Math.ceil(w / 4) * Math.ceil(h / 4) * (CBPP[ifmt] || 16));
    put(r, target + ':' + level, n);
  });
  wrap('compressedTexImage3D', function (target, level, ifmt, w, h, d, border, data) {
    const t = curTex(target); if (!t) return; const r = rec(t, kindOf(target)); r.compressed = true; if (level === 0) { r.w = w; r.h = h; r.d = d; r.fmt = ifmt; }
    const n = data && data.byteLength != null ? data.byteLength : (typeof data === 'number' ? data : Math.ceil(w / 4) * Math.ceil(h / 4) * d * (CBPP[ifmt] || 16));
    put(r, target + ':' + level, n);
  });
  wrap('renderbufferStorage', function (target, ifmt, w, h) { if (!bound.rb) return; const r = rec(bound.rb, 'rb'); r.w = w; r.h = h; r.fmt = ifmt; r.samples = 1; put(r, 'rb', w * h * bppOf(ifmt)); });
  wrap('renderbufferStorageMultisample', function (target, s, ifmt, w, h) { if (!bound.rb) return; const r = rec(bound.rb, 'rb'); r.w = w; r.h = h; r.fmt = ifmt; r.samples = s; put(r, 'rb', w * h * bppOf(ifmt) * Math.max(1, s)); });
  wrap('bufferData', function (target, a) { const b = bound.buf.get(target); if (!b) return; const r = rec(b, 'buffer'); put(r, 'data', typeof a === 'number' ? a : (a && a.byteLength) || 0); });
  const del = function (o) { const r = o && st.get(o); if (r) { r.bytes = 0; r.levels.clear(); } live.delete(o); };
  wrap('deleteTexture', del); wrap('deleteBuffer', del); wrap('deleteRenderbuffer', del);
  // compressed block bytes (4x4 blocks): BC1/ETC1/ETC2 RGB 8, BC3/BC7/ETC2 RGBA/ASTC4x4 16 (the KTX2 transcode targets)
  const CBPP = {};
  const cset = (v, b) => { CBPP[v] = b; };
  [0x83F0, 0x83F1, 0x8C4C, 0x8C4D, 0x8D64, 0x9274, 0x9275, 0x9276, 0x9277, 0x8DBB, 0x8DBC].forEach(v => cset(v, 8));   // S3TC DXT1, ETC1/ETC2 rgb, RGTC1
  [0x83F2, 0x83F3, 0x8C4E, 0x8C4F, 0x8E8C, 0x8E8D, 0x8E8E, 0x8E8F, 0x9278, 0x9279, 0x93B0, 0x93D0, 0x8DBD, 0x8DBE].forEach(v => cset(v, 16));   // DXT3/5, BPTC (BC7/BC6H), ETC2 rgba, ASTC 4x4, RGTC2
  window.__VRAM = {
    // the bytes held now, by kind (MB), with the largest objects
    sum: (top, keep) => {
      const by = {}, list = [];
      for (const o of live) { const r = st.get(o); if (!r || !r.bytes) continue; const k = r.kind + (r.compressed ? ':bc' : '') + (r.kind === 'rb' && r.samples > 1 ? ':msaa' : '');
        by[k] = (by[k] || 0) + r.bytes; list.push({ o, r }); }
      list.sort((a, b) => b.r.bytes - a.r.bytes);
      const MB = x => +(x / 1048576).toFixed(1);
      const out = { totalMB: MB(Object.values(by).reduce((s, v) => s + v, 0)), byKindMB: {} };
      for (const k in by) out.byKindMB[k] = MB(by[k]);
      out.all = list.map(({ o, r }) => ({ o, kind: r.kind, w: r.w, h: r.h, d: r.d, bytes: r.bytes }));   // (the census groups them by owner, then drops it)
      out.top = list.slice(0, top || 0).map(({ o, r }) => ({ o, kind: r.kind, w: r.w, h: r.h, d: r.d, fmt: '0x' + (r.fmt || 0).toString(16), bc: r.compressed, samples: r.samples, MB: MB(r.bytes) }));
      return out;
    },
    rec: o => st.get(o),
  };
})();
