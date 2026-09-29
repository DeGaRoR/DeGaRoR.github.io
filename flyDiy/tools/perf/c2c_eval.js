// c2c_eval.js - rollout_perf --eval @tools/perf/c2c_eval.js (G840, C2c): what the town holds after the recording window.
// renderer.info (the memory counters, the programs) and an ESTIMATE of the GPU bytes three holds for the scene: every
// distinct texture a material or a uniform of the scene binds (w x h x layers x 4 bytes, x 4/3 with mips; a compressed
// one by its mip data) and every distinct buffer attribute and index (byteLength); the town's texture arrays by the
// stack's own count (its bytes are dropped after the upload); the premises' TARR / house-worker / stream state.
(async () => {
  const W = window.WORLD, R = W && W.renderer, P = W && W.premises;
  const out = { t: Math.round(performance.now()) };
  if (R && R.info) out.info = { memory: Object.assign({}, R.info.memory), programs: R.info.programs ? R.info.programs.length : null };
  const tex = new Set(), buf = new Set();
  let texB = 0, geoB = 0, arrB = 0;
  const texBytes = t => {
    if (!t || tex.has(t)) return; tex.add(t);
    const im = t.image || {}, mips = t.generateMipmaps || (t.mipmaps && t.mipmaps.length > 1) ? 4 / 3 : 1;
    if (t.isCompressedTexture || t.isCompressedArrayTexture) { let b = 0; for (const m of t.mipmaps || []) b += m.data ? m.data.byteLength : 0; texB += b; return; }
    const w = im.width || 0, h = im.height || 0, d = t.isDataArrayTexture || t.isData3DTexture ? (im.depth || 1) : 1;
    const bpp = t.type === 1015 /* Float */ ? 16 : t.type === 1016 /* HalfFloat */ ? 8 : 4;
    const b = w * h * d * bpp * mips; texB += b; if (t.isDataArrayTexture) arrB += b;
  };
  const scene = W && W.scene;
  if (scene) scene.traverse(o => {
    if (o.geometry) { const g = o.geometry; for (const k in g.attributes) { const a = g.attributes[k], x = a.isInterleavedBufferAttribute ? a.data : a; if (x && x.array && !buf.has(x)) { buf.add(x); geoB += x.array.byteLength; } } if (g.index && !buf.has(g.index)) { buf.add(g.index); geoB += g.index.array.byteLength; } }
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) { for (const k in m) { const v = m[k]; if (v && v.isTexture) texBytes(v); } if (m.uniforms) for (const k in m.uniforms) { const v = m.uniforms[k] && m.uniforms[k].value; if (v && v.isTexture) texBytes(v); } }
  });
  out.est = { texMiB: +(texB / 1048576).toFixed(1), arraysMiB: +(arrB / 1048576).toFixed(1), geoMiB: +(geoB / 1048576).toFixed(1), textures: tex.size, buffers: buf.size };
  if (P && P.stats) { const s = P.stats; out.prem = { houses: s.houses, objects: s.objects, queued: s.queued, obstacles: s.obstacles, hlodCells: s.hlodCells, tarrDraws: s.tarrDraws, tarrLayers: s.tarrLayers, tarrMB: s.tarrMB,
    tarrFmt: s.tarrFmt, tarrCooked: s.tarrCooked, tarrCanvas: s.tarrCanvas, tarrFetchMs: s.tarrFetchMs, tarrFillMs: s.tarrFillMs, tarrCheck: s.tarrCheck ? { same: s.tarrCheck.same, differ: s.tarrCheck.differ, worst: s.tarrCheck.worst, list: (s.tarrCheck.list || []).slice(0, 8) } : null,
    cook: s.cook || null } }
  if (window.HOUSE_WORKER && window.HOUSE_WORKER.stats) out.hw = window.HOUSE_WORKER.stats();
  if (P && P.hw) out.hwq = { dispatched: P.hw.dispatched, placed: P.hw.placed, local: P.hw.local, prefetch: P.hw.prefetch, tallyMiss: P.hw.tallyMiss || 0 };
  try { const gl = R.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); out.gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null; } catch (e) {}
  return out;
})()
