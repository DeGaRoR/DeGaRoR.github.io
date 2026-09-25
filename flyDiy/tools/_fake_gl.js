// _fake_gl.js - THE REAL three.js ON A FAKE WebGL2 CONTEXT, for the gates (G580 GATE PROGRAMS, G581 GATE COVER).
// vendor/three.min.js (r186) runs as it runs in the page - its program keys, its shadow pass, its batches - on a
// context that records every shader source and every link and draws nothing. boot() gives a fresh three, a
// renderer (reversed depth, PCF shadows, ACES) and `links` [{ vs, fs }]; load(rel) runs a src/ file in the same
// context (its globals land on `ctx`); draws() counts renderBufferDirect calls by object for one render.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
// ---- the real three on a fake WebGL2 ------------------------------------------------------------
const THREE_SRC = fs.readFileSync(path.join(ROOT, 'vendor', 'three.min.js'), 'utf8');
function boot() {
  class WebGL2RenderingContext {}
  const ctx = { console, performance, setTimeout, clearTimeout, requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, WebGL2RenderingContext, navigator: { userAgent: 'node' } };
  ctx.globalThis = ctx; ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx); vm.runInContext(THREE_SRC, ctx);
  const THREE = ctx.THREE;
  const links = [];                                   // { vs, fs } per linkProgram
  const K = new Map(), N = new Map(); let next = 0x8000;
  const k = name => { if (!K.has(name)) { const v = next++; K.set(name, v); N.set(v, name); } return K.get(name); };
  const params = { VERSION: 'WebGL 2.0 (gate)', SHADING_LANGUAGE_VERSION: 'WebGL GLSL ES 3.00', VENDOR: 'gate', RENDERER: 'gate',
    MAX_TEXTURE_IMAGE_UNITS: 16, MAX_VERTEX_TEXTURE_IMAGE_UNITS: 16, MAX_COMBINED_TEXTURE_IMAGE_UNITS: 32, MAX_TEXTURE_SIZE: 16384, MAX_CUBE_MAP_TEXTURE_SIZE: 16384,
    MAX_VERTEX_ATTRIBS: 16, MAX_VERTEX_UNIFORM_VECTORS: 4096, MAX_VARYING_VECTORS: 30, MAX_FRAGMENT_UNIFORM_VECTORS: 1024, MAX_SAMPLES: 8, MAX_3D_TEXTURE_SIZE: 2048,
    MAX_ARRAY_TEXTURE_LAYERS: 2048, MAX_DRAW_BUFFERS: 8, MAX_COLOR_ATTACHMENTS: 8, MAX_RENDERBUFFER_SIZE: 16384, MAX_UNIFORM_BUFFER_BINDINGS: 72, MAX_TEXTURE_MAX_ANISOTROPY_EXT: 16,
    VIEWPORT: new Int32Array([0, 0, 64, 64]), SCISSOR_BOX: new Int32Array([0, 0, 64, 64]), MAX_VIEWPORT_DIMS: new Int32Array([16384, 16384]), ALIASED_LINE_WIDTH_RANGE: new Float32Array([1, 1]) };
  const exts = ['EXT_color_buffer_float', 'EXT_color_buffer_half_float', 'OES_texture_float_linear', 'EXT_texture_filter_anisotropic', 'KHR_parallel_shader_compile', 'EXT_clip_control', 'WEBGL_multi_draw', 'EXT_float_blend'];
  const SH = new Map(), PR = new Map(); let ids = 0;
  const fns = {
    getParameter: p => { const n = N.get(p); return n in params ? params[n] : 0; },
    getExtension: name => exts.includes(name) ? new Proxy({}, { get: (t, p) => typeof p === 'string' && /^[A-Z0-9_]+$/.test(p) ? k(p) : (typeof p === 'string' ? () => null : undefined) }) : null,
    getSupportedExtensions: () => exts.slice(),
    getShaderPrecisionFormat: () => ({ precision: 23, rangeMin: 127, rangeMax: 127 }),
    getContextAttributes: () => ({ alpha: true, antialias: false, depth: true, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'default' }),
    createShader: type => { const s = { id: ++ids, type }; SH.set(s, ''); return s; },
    shaderSource: (s, src) => { SH.set(s, src); },
    createProgram: () => { const p = { id: ++ids }; PR.set(p, []); return p; },
    attachShader: (p, s) => { PR.get(p).push(s); },
    linkProgram: p => { const sh = PR.get(p) || []; const vs = sh.find(s => s.type === k('VERTEX_SHADER')), fs = sh.find(s => s.type !== k('VERTEX_SHADER'));
      links.push({ vs: vs ? SH.get(vs) : '', fs: fs ? SH.get(fs) : '' }); },
    getProgramParameter: (p, q) => { const n = N.get(q); return /ACTIVE|ATTACHED/.test(n) ? 0 : true; },
    getShaderParameter: () => true, getProgramInfoLog: () => '', getShaderInfoLog: () => '', getShaderSource: s => SH.get(s) || '',
    checkFramebufferStatus: () => k('FRAMEBUFFER_COMPLETE'), getUniformLocation: () => null, getAttribLocation: () => -1,
    isContextLost: () => false, getError: () => 0, getUniformBlockIndex: () => 0,
  };
  const canvas = { width: 64, height: 64, style: {}, addEventListener() {}, removeEventListener() {} };
  const gl = new Proxy(Object.create(WebGL2RenderingContext.prototype), { get(t, p) {
    if (p in fns) return fns[p];
    if (typeof p === 'string' && /^[A-Z0-9_]+$/.test(p)) return k(p);
    if (p === 'canvas') return canvas;
    if (p === 'drawingBufferWidth' || p === 'drawingBufferHeight') return 64;
    if (p === 'drawingBufferColorSpace') return 'srgb';
    if (typeof p === 'string' && /^create/.test(p)) return () => ({ id: ++ids });
    if (typeof p === 'symbol') return undefined;
    return () => undefined;
  } });
  canvas.getContext = () => gl;
  const renderer = new THREE.WebGLRenderer({ context: gl, canvas, reversedDepthBuffer: true });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  ctx.window.THREE = THREE;
  const load = rel => { vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/^'use strict';/m, ''), ctx); };
  return { THREE, renderer, links, ctx, load };
}
module.exports = { boot, ROOT };
