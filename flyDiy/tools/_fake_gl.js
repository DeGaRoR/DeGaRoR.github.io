// _fake_gl.js - THE REAL three.js ON A FAKE WebGL2 CONTEXT, for the gates (G584 GATE PROGRAMS, G585 GATE COVER).
// vendor/three.min.js (r186) runs as it runs in the page - its program keys, its shadow pass, its batches - on a
// context that records every shader source and every link and draws nothing. boot() gives a fresh three, a
// renderer (reversed depth, PCF shadows, ACES) and `links` [{ vs, fs }]; load(rel) runs a src/ file in the same
// context (its globals land on `ctx`); draws() counts renderBufferDirect calls by object for one render.
//
// makeGL(opts) is the context itself (G1010, GATE FRAMECOST shares it through tools/_page_node.js):
//   opts.links    the array every linkProgram pushes { vs, fs } to
//   opts.canvas   the canvas it answers for (drawingBuffer* read its size; default 64 x 64)
//   opts.rec      a RECORDER (makeRecorder()): every call counted by name, the bytes of every uniform, buffer and
//                 texture upload, the draws by the recorder's current `phase` - and, with it, REFLECTION: the
//                 program's active uniforms and attributes read off the linked GLSL (the preprocessor run on the
//                 source three hands over), so three builds its uniform tables and uploads what it would upload on
//                 a driver. Without a recorder a program has no uniforms and no attributes (GATE PROGRAMS' context).
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

// ---- the GLSL a driver would reflect: the preprocessor, the uniforms, the attributes ------------------
// the numeric types three's setters switch on (WebGLUniforms getSingularSetter / getPureArraySetter)
const GLT = { float: 5126, vec2: 35664, vec3: 35665, vec4: 35666, int: 5124, ivec2: 35667, ivec3: 35668, ivec4: 35669, bool: 35670, bvec2: 35671, bvec3: 35672, bvec4: 35673,
  uint: 5125, uvec2: 36294, uvec3: 36295, uvec4: 36296, mat2: 35674, mat3: 35675, mat4: 35676, mat2x3: 35685, mat2x4: 35686, mat3x2: 35687, mat3x4: 35688, mat4x2: 35689, mat4x3: 35690,
  sampler2D: 35678, samplerCube: 35680, sampler3D: 35679, sampler2DShadow: 35682, sampler2DArray: 36289, sampler2DArrayShadow: 36292, samplerCubeShadow: 36293,
  isampler2D: 36298, isampler3D: 36299, isamplerCube: 36300, isampler2DArray: 36303, usampler2D: 36306, usampler3D: 36307, usamplerCube: 36308, usampler2DArray: 36311 };
const GL_NAMES = { FLOAT: 5126, FLOAT_VEC2: 35664, FLOAT_VEC3: 35665, FLOAT_VEC4: 35666, INT: 5124, INT_VEC2: 35667, INT_VEC3: 35668, INT_VEC4: 35669, BOOL: 35670, BOOL_VEC2: 35671, BOOL_VEC3: 35672, BOOL_VEC4: 35673,
  UNSIGNED_INT: 5125, UNSIGNED_INT_VEC2: 36294, UNSIGNED_INT_VEC3: 36295, UNSIGNED_INT_VEC4: 36296, FLOAT_MAT2: 35674, FLOAT_MAT3: 35675, FLOAT_MAT4: 35676,
  SAMPLER_2D: 35678, SAMPLER_CUBE: 35680, SAMPLER_3D: 35679, SAMPLER_2D_SHADOW: 35682, SAMPLER_2D_ARRAY: 36289, SAMPLER_2D_ARRAY_SHADOW: 36292, SAMPLER_CUBE_SHADOW: 36293 };
const MAT_ROWS = { mat2: 2, mat3: 3, mat4: 4 };
function preprocess(src) {
  src = src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g, '').replace(/\\\n/g, '');
  const defs = new Map(), out = [], stack = [];
  let active = true;
  const expand = (e, d) => d > 8 ? e : e.replace(/\b[A-Za-z_]\w*\b/g, id => defs.has(id) && defs.get(id) !== null ? '(' + expand(defs.get(id), d + 1) + ')' : id);
  const evalIf = e => {
    e = e.replace(/defined\s*\(\s*(\w+)\s*\)|defined\s+(\w+)/g, (m, a, b) => defs.has(a || b) ? '1' : '0');
    e = expand(e, 0).replace(/\b[A-Za-z_]\w*\b/g, '0').replace(/(\d)[uU]\b/g, '$1');
    try { return !!Function('return (' + e + ');')(); } catch (x) { return false; }
  };
  for (const line of src.split('\n')) {
    const m = /^\s*#\s*(\w+)\s*(.*)$/.exec(line);
    if (!m) { if (active) out.push(line); continue; }
    const d = m[1], rest = m[2].trim(), top = stack[stack.length - 1];
    if (d === 'if' || d === 'ifdef' || d === 'ifndef') {
      const v = active && (d === 'if' ? evalIf(rest) : d === 'ifdef' ? defs.has(rest.split(/\s+/)[0]) : !defs.has(rest.split(/\s+/)[0]));
      stack.push({ pa: active, taken: v }); active = active && v;
    } else if (d === 'elif') { if (!top) continue; if (!top.pa || top.taken) active = false; else { const v = evalIf(rest); top.taken = v; active = v; } }
    else if (d === 'else') { if (!top) continue; active = top.pa && !top.taken; top.taken = true; }
    else if (d === 'endif') { const t = stack.pop(); active = t ? t.pa : true; }
    else if (active && d === 'define') { const dm = /^(\w+)(\([^)]*\))?\s*(.*)$/.exec(rest); if (dm) defs.set(dm[1], dm[2] ? null : dm[3]); }
    else if (active && d === 'undef') defs.delete(rest);
  }
  return { text: out.join('\n'), defs, size: e => { const v = +Function('return (' + expand(e, 0).replace(/\b[A-Za-z_]\w*\b/g, '0') + ');')(); return v | 0; } };
}
function reflectProgram(vsrc, fsrc) {
  const uni = new Map(), structs = new Map(), attrs = [];
  for (const [src, isVS] of [[vsrc, true], [fsrc, false]]) {
    const P = preprocess(src || '');
    const T = P.text;
    let m; const sre = /\bstruct\s+(\w+)\s*\{([^}]*)\}/g;
    while ((m = sre.exec(T))) {
      const mem = [];
      for (const decl of m[2].split(';')) { const dm = /^\s*(?:(?:lowp|mediump|highp)\s+)?(\w+)\s+(.+?)\s*$/.exec(decl); if (!dm) continue;
        for (const nm of dm[2].split(',')) { const am = /^\s*(\w+)\s*(?:\[([^\]]+)\])?\s*$/.exec(nm); if (am) mem.push({ type: dm[1], name: am[1], n: am[2] ? P.size(am[2]) : 0 }); } }
      structs.set(m[1], mem);
    }
    const ure = /(?:^|[;\n])\s*(?:layout\s*\([^)]*\)\s*)?uniform\s+(?:(?:lowp|mediump|highp)\s+)?(\w+)\s+([^;{]+);/g;
    while ((m = ure.exec(T))) {
      for (const nm of m[2].split(',')) { const am = /^\s*(\w+)\s*(?:\[([^\]]+)\])?\s*$/.exec(nm); if (!am) continue;
        if (!uni.has(am[1])) uni.set(am[1], { type: m[1], n: am[2] ? P.size(am[2]) : 0 }); }
    }
    if (isVS) { const are = /(?:^|[;\n])\s*(?:layout\s*\([^)]*\)\s*)?(?:attribute|in)\s+(?:(?:lowp|mediump|highp)\s+)?(\w+)\s+(\w+)\s*;/g;
      while ((m = are.exec(T))) if (GLT[m[1]] && !attrs.some(a => a.name === m[2])) attrs.push({ name: m[2], type: GLT[m[1]], size: 1, slots: MAT_ROWS[m[1]] || 1 }); }
  }
  const uniforms = [];
  const emit = (name, type, n, depth) => {
    if (GLT[type]) { uniforms.push(n > 0 ? { name: name + '[0]', type: GLT[type], size: n } : { name, type: GLT[type], size: 1 }); return; }
    const S = structs.get(type); if (!S || depth > 4) return;
    const each = pre => { for (const f of S) emit(pre + '.' + f.name, f.type, f.n, depth + 1); };
    if (n > 0) for (let i = 0; i < n; i++) each(name + '[' + i + ']'); else each(name);
  };
  for (const [name, u] of uni) emit(name, u.type, u.n, 0);
  let loc = 0; for (const a of attrs) { a.loc = loc; loc += a.slots; }
  return { uniforms, attrs };
}

// ---- the recorder: what the frames cost, by name ----------------------------------------------------------
const DRAWS = new Set(['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements',
  'multiDrawArraysWEBGL', 'multiDrawElementsWEBGL', 'multiDrawArraysInstancedWEBGL', 'multiDrawElementsInstancedWEBGL']);
function makeRecorder() {
  const R = { phase: 'other', calls: Object.create(null), bytes: Object.create(null), draws: Object.create(null), programs: new Set(), progUsed: new Set(), links: 0, contexts: 0,
    count(name, b) { R.calls[name] = (R.calls[name] || 0) + 1; if (b) R.bytes[name] = (R.bytes[name] || 0) + b; if (R.onCall) R.onCall(name, b); },
    snapshot() { return { calls: Object.assign({}, R.calls), bytes: Object.assign({}, R.bytes), draws: Object.assign({}, R.draws), links: R.links, progUsed: R.progUsed.size }; },
    resetUsed() { R.progUsed = new Set(); } };
  return R;
}
const viewBytes = v => v && typeof v.byteLength === 'number' ? v.byteLength : 0;
const texBytes = args => { for (const a of args) { if (a && typeof a.byteLength === 'number') return a.byteLength; if (a && typeof a === 'object' && a.width && a.height) return a.width * a.height * 4; } return 0; };
function byteCount(name, a) {
  if (name.startsWith('uniformMatrix')) return viewBytes(a[2]) || (a[2] && a[2].length * 4) || 0;
  if (/^uniform\d[fiu]i?v$/.test(name)) { const d = a[1]; if (!d) return 0; const n = a[3] || (d.length - (a[2] || 0)); return n * 4; }
  if (/^uniform\d/.test(name)) return (+name[7]) * 4;
  if (name === 'bufferData') return typeof a[1] === 'number' ? a[1] : viewBytes(a[1]);
  if (name === 'bufferSubData') { const d = a[2]; if (!d) return 0; return a[4] ? a[4] * (d.BYTES_PER_ELEMENT || 1) : viewBytes(d) - (a[3] || 0) * (d.BYTES_PER_ELEMENT || 1); }
  if (/^(compressedT|t)ex(Sub)?Image[23]D$/.test(name)) return texBytes(a);
  return 0;
}

function makeGL(opts) {
  opts = opts || {};
  const links = opts.links || [], rec = opts.rec || null;
  const WebGL2RenderingContext = opts.WebGL2RenderingContext || class WebGL2RenderingContext {};
  const K = new Map(), N = new Map(); let next = 0x8000;
  if (rec) for (const [k0, v] of Object.entries(GL_NAMES)) { K.set(k0, v); N.set(v, k0); }
  const k = name => { if (!K.has(name)) { const v = next++; K.set(name, v); N.set(v, name); } return K.get(name); };
  const canvas = opts.canvas || { width: 64, height: 64, style: {}, addEventListener() {}, removeEventListener() {} };
  const params = { VERSION: 'WebGL 2.0 (gate)', SHADING_LANGUAGE_VERSION: 'WebGL GLSL ES 3.00', VENDOR: 'gate', RENDERER: 'gate',
    MAX_TEXTURE_IMAGE_UNITS: 16, MAX_VERTEX_TEXTURE_IMAGE_UNITS: 16, MAX_COMBINED_TEXTURE_IMAGE_UNITS: 32, MAX_TEXTURE_SIZE: 16384, MAX_CUBE_MAP_TEXTURE_SIZE: 16384,
    MAX_VERTEX_ATTRIBS: 16, MAX_VERTEX_UNIFORM_VECTORS: 4096, MAX_VARYING_VECTORS: 30, MAX_FRAGMENT_UNIFORM_VECTORS: 1024, MAX_SAMPLES: 8, MAX_3D_TEXTURE_SIZE: 2048,
    MAX_ARRAY_TEXTURE_LAYERS: 2048, MAX_DRAW_BUFFERS: 8, MAX_COLOR_ATTACHMENTS: 8, MAX_RENDERBUFFER_SIZE: 16384, MAX_UNIFORM_BUFFER_BINDINGS: 72, MAX_TEXTURE_MAX_ANISOTROPY_EXT: 16,
    VIEWPORT: new Int32Array([0, 0, 64, 64]), SCISSOR_BOX: new Int32Array([0, 0, 64, 64]), MAX_VIEWPORT_DIMS: new Int32Array([16384, 16384]), ALIASED_LINE_WIDTH_RANGE: new Float32Array([1, 1]) };
  const exts = ['EXT_color_buffer_float', 'EXT_color_buffer_half_float', 'OES_texture_float_linear', 'EXT_texture_filter_anisotropic', 'KHR_parallel_shader_compile', 'EXT_clip_control', 'WEBGL_multi_draw', 'EXT_float_blend']
    .concat(opts.extraExts || []);
  const SH = new Map(), PR = new Map(); let ids = 0;
  const REF = new Map();   // program -> its reflection (with a recorder)
  const extProxy = name => new Proxy({}, { get: (t, p) => {
    if (typeof p !== 'string') return undefined;
    if (/^[A-Z0-9_]+$/.test(p)) return k(p);
    if (rec && DRAWS.has(p)) return (...a) => { rec.count(p); rec.draws[rec.phase] = (rec.draws[rec.phase] || 0) + 1; };
    return rec ? (...a) => { rec.count(name + '.' + p); return null; } : () => null;
  } });
  const EXTS = new Map();
  const fns = {
    getParameter: p => { const n = N.get(p); return n in params ? params[n] : 0; },
    getExtension: name => exts.includes(name) ? (EXTS.get(name) || (EXTS.set(name, extProxy(name)), EXTS.get(name))) : null,
    getSupportedExtensions: () => exts.slice(),
    getShaderPrecisionFormat: () => ({ precision: 23, rangeMin: 127, rangeMax: 127 }),
    getContextAttributes: () => ({ alpha: true, antialias: false, depth: true, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'default' }),
    createShader: type => { const s = { id: ++ids, type }; SH.set(s, ''); return s; },
    shaderSource: (s, src) => { SH.set(s, src); },
    createProgram: () => { const p = { id: ++ids }; PR.set(p, []); return p; },
    attachShader: (p, s) => { PR.get(p).push(s); },
    linkProgram: p => { const sh = PR.get(p) || []; const vs = sh.find(s => s.type === k('VERTEX_SHADER')), fs = sh.find(s => s.type !== k('VERTEX_SHADER'));
      const L = { vs: vs ? SH.get(vs) : '', fs: fs ? SH.get(fs) : '' }; links.push(L);
      if (rec) { rec.links++; REF.set(p, reflectProgram(L.vs, L.fs)); } },
    getProgramParameter: (p, q) => { const n = N.get(q);
      if (rec && REF.has(p)) { if (n === 'ACTIVE_UNIFORMS') return REF.get(p).uniforms.length; if (n === 'ACTIVE_ATTRIBUTES') return REF.get(p).attrs.length; }
      return /ACTIVE|ATTACHED/.test(n) ? 0 : true; },
    getActiveUniform: (p, i) => { const r = REF.get(p); return r ? r.uniforms[i] : null; },
    getActiveAttrib: (p, i) => { const r = REF.get(p); return r ? r.attrs[i] : null; },
    getShaderParameter: () => true, getProgramInfoLog: () => '', getShaderInfoLog: () => '', getShaderSource: s => SH.get(s) || '',
    checkFramebufferStatus: () => k('FRAMEBUFFER_COMPLETE'),
    getUniformLocation: (p, name) => rec && REF.has(p) ? { p: p.id, name } : null,
    getAttribLocation: (p, name) => { const r = rec && REF.get(p); const a = r && r.attrs.find(x => x.name === name); return a ? a.loc : -1; },
    isContextLost: () => false, getError: () => 0, getUniformBlockIndex: () => 0,
    readPixels: (x, y, w, h, f, t, buf) => { if (rec) rec.count('readPixels'); if (buf && buf.fill) buf.fill(0); },
  };
  const wrapped = new Map();
  const wrap = (p, f) => { let w = wrapped.get(p); if (w) return w;
    w = rec ? (DRAWS.has(p) ? (...a) => { rec.count(p); rec.draws[rec.phase] = (rec.draws[rec.phase] || 0) + 1; return f && f(...a); }
      : p === 'useProgram' ? (prog) => { rec.count(p); if (prog) rec.progUsed.add(prog.id); }
      : (...a) => { rec.count(p, byteCount(p, a)); return f ? f(...a) : undefined; }) : (f || (() => undefined));
    wrapped.set(p, w); return w; };
  const gl = new Proxy(Object.create(WebGL2RenderingContext.prototype), { get(t, p) {
    if (p in fns) return rec ? wrap(p, fns[p]) : fns[p];
    if (typeof p === 'string' && /^[A-Z0-9_]+$/.test(p)) return k(p);
    if (p === 'canvas') return canvas;
    if (p === 'drawingBufferWidth') return canvas.width || 64;
    if (p === 'drawingBufferHeight') return canvas.height || 64;
    if (p === 'drawingBufferColorSpace') return 'srgb';
    if (typeof p === 'string' && /^create/.test(p)) return rec ? wrap(p, () => ({ id: ++ids })) : () => ({ id: ++ids });
    if (typeof p === 'symbol') return undefined;
    return wrap(p, null);
  } });
  if (rec) rec.contexts++;
  return { gl, WebGL2RenderingContext, canvas };
}

// ---- the real three on a fake WebGL2 ------------------------------------------------------------
const THREE_SRC = fs.readFileSync(path.join(ROOT, 'vendor', 'three.min.js'), 'utf8');
function boot() {
  const links = [];                                   // { vs, fs } per linkProgram
  const { gl, WebGL2RenderingContext, canvas } = makeGL({ links });
  const ctx = { console, performance, setTimeout, clearTimeout, requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, WebGL2RenderingContext, navigator: { userAgent: 'node' } };
  ctx.globalThis = ctx; ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx); vm.runInContext(THREE_SRC, ctx);
  const THREE = ctx.THREE;
  canvas.getContext = () => gl;
  const renderer = new THREE.WebGLRenderer({ context: gl, canvas, reversedDepthBuffer: true });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  ctx.window.THREE = THREE;
  const load = rel => { vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/^'use strict';/m, ''), ctx); };
  // THE MATERIAL LIBRARY (AS4a, G920) comes with the three: the viewer's families make their materials through it
  load(path.join('src', 'viewer', 'matlib.js')); ctx.MATLIB = vm.runInContext('MATLIB', ctx);
  return { THREE, renderer, links, ctx, load };
}
module.exports = { boot, ROOT, makeGL, makeRecorder, reflectProgram, preprocess, THREE_SRC };
