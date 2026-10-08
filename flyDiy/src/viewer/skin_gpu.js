// G1818 (DMG-SKINGPU): THE WRECK'S SKIN RIDDEN ON THE GPU. DMG-D4a / D4b's riding (skin_break.js poseCage, the world
// frame) re-posed every vertex of the broken cage on the CPU each frame - ~500k vertices (~85k welded places) on the
// user's Cub, every one through its K <= 4 nodes' frames, its normal turned, and ~12 MB of positions and normals sent up
// again: 25-29 ms a re-posed frame on the box. Here the same formula runs on the GPU:
//   - AT THE FIRST BREAK (as the records are made): each riding vertex's place and rest normal go up ONCE as vertex
//     attributes, each place's data (skin_break.js packPlaces: its offset off its nodes' blend, the drape's sag, its kept
//     weights and nodes in 8 slots) as five float textures, refreshed only at a break event or a step of the binding;
//   - EACH POSED FRAME: only the nodes (2 texels a node: the live place less the frame's origin, the turn - ~100-130
//     nodes, ~4 kB) and four small uniforms; one TRANSFORM FEEDBACK draw a riding range writes the drawn position and the
//     turned normal straight into the buffers the aeroplane is drawn from (the fold's, or the bucket's own).
// WHY A TRANSFORM FEEDBACK, NOT A MATERIAL VARIANT: a riding vertex is drawn by the folds (plain and skinned), their near
// views on every live material, the band twins, the cabin's fold, and every depth pass three runs with its own or an
// override material - a vertex-shader variant in onBeforeCompile would be one new program per material x pass, linked at
// the first break (COLD-LINKS G1310 / SHADER-GUARD G1340: a program here costs real link time, and keys re-key). Writing
// the buffers they ALL read leaves every program as it is: one tiny program of its own (RIDE_VS), linked off the main
// thread (KHR_parallel_shader_compile) at the first break while the records are still being made, the CPU's riding
// meanwhile. The drawn buffers become the page's own (THREE.GLBufferAttribute on the geometries that drew the old
// attribute) while a wreck rides, and go back - re-uploaded whole from the CPU arrays - at the heal.
// The CPU keeps: the records, the events, the binding, the nodes' frames (Horn, ~0.3 ms), the tear (skin_break.js
// tearPlaces: every watched triangle, on the places' world positions this shader makes in its places mode - read back
// behind a fence a frame later, never waited on), the confetti. The parts of a fold that do not ride (the legs, the
// floats, the links: their rigs write the CPU arrays) are sent up by range as their attribute's version moves.
// No THREE at load, no DOM: node loads the shader text and the layout (GATE DMGSKINGPU). window.SKIN_GPU in the page.
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : null;
  const PW_W = 2048;                                     // = skin_break.js GPU_W: the place textures' width
  const TXK = ['PA', 'PW0', 'PW1', 'PI0', 'PI1'];       // the place textures (skin_break.js placeArrays), units 1-5
  const SB_placeArrays = rows => { const n = rows * PW_W * 4, o = {}; for (const k of TXK) o[k] = new Float32Array(n); return o; };

  // THE RIDING, per vertex: skin_break.js rideMirror is this, line for line. aPl: the vertex's place (texel aPl % 2048,
  // aPl / 2048 of uPA / uPW0-1 / uPI0-1: 8 slots, the dominant first; a slot past the binding has weight 0 - after the
  // fourth the loop stops there, the mirror runs them through: + 0); aN0: its rest normal in the frame's rest coordinates. uNd: 2 texels a node - (live -
  // origin, 0), its turn (x, y, z, w). uMi: the live oblique basis' inverse, uBt its transpose (the normal drawn as the
  // CPU's turnN draws it: B^T n), uPx the group's offset (o + the part's pivot), uDown gravity (the drape)
  const RIDE_VS = [
    '#version 300 es',
    'precision highp float; precision highp int; precision highp sampler2D;',
    'layout(location = 0) in uint aPl;',
    'layout(location = 1) in vec3 aN0;',
    'uniform sampler2D uNd; uniform sampler2D uPA; uniform sampler2D uPW0; uniform sampler2D uPW1; uniform sampler2D uPI0; uniform sampler2D uPI1;',
    'uniform mat3 uMi; uniform mat3 uBt; uniform vec3 uPx; uniform vec3 uDown; uniform int uMode;',
    'out vec3 vPos; out vec3 vNrm;',
    'vec3 qrot(vec4 q, vec3 v) { vec3 t = 2.0 * cross(q.xyz, v); return v + q.w * t + cross(q.xyz, t); }',
    'void main() {',
    '  ivec2 c = ivec2(int(aPl & 2047u), int(aPl >> 11u));',
    '  vec4 A = texelFetch(uPA, c, 0);',
    '  vec4 W0 = texelFetch(uPW0, c, 0), W1 = texelFetch(uPW1, c, 0);',
    '  vec4 F0 = texelFetch(uPI0, c, 0), F1 = texelFetch(uPI1, c, 0);',
    '  float w[8] = float[8](W0.x, W0.y, W0.z, W0.w, W1.x, W1.y, W1.z, W1.w);',
    '  float f[8] = float[8](F0.x, F0.y, F0.z, F0.w, F1.x, F1.y, F1.z, F1.w);',
    // (G2040 x G1818: a node id stored as -(id + 1) is a POSITION-ONLY slot - a node of another piece the covering is
    // held to by FABRIC's ties: onNodes blends the turn of the place's own piece only)
    '  int id[8]; bool tn[8];',
    '  for (int a = 0; a < 8; a++) { tn[a] = f[a] >= 0.0; id[a] = tn[a] ? int(f[a] + 0.5) : int(-f[a] - 0.5); }',
    '  vec4 q0 = texelFetch(uNd, ivec2(2 * id[0] + 1, 0), 0);',
    '  vec4 q = vec4(0.0); vec3 l = vec3(0.0);',
    '  for (int a = 0; a < 8; a++) {',
    '    if (a >= 4 && w[a] == 0.0) break;',           // (a binding of four or fewer: the second texel's slots are empty)
    '    vec4 qi = texelFetch(uNd, ivec2(2 * id[a] + 1, 0), 0);',
    '    if (tn[a]) q += (dot(qi, q0) < 0.0 ? -w[a] : w[a]) * qi;',
    '    l += w[a] * texelFetch(uNd, ivec2(2 * id[a], 0), 0).xyz;',
    '  }',
    '  float L = length(q); if (L > 0.0) q /= L;',
    '  vec3 p = (l + qrot(q, A.xyz)) + A.w * uDown;',
    '  if (uMode == 1) { vPos = p; vNrm = vec3(0.0); }',   // (the places mode: the world position less the origin - the tear's)
    '  else {',
    '    vPos = uMi * p - uPx;',
    '    vec3 n = uBt * qrot(q, aN0); float nn = length(n);',
    '    vNrm = nn > 0.0 ? n / nn : n;',
    '  }',
    '  gl_Position = vec4(0.0, 0.0, 0.0, 1.0);',   // (no gl_PointSize: nothing is rasterised - and ANGLE's point-sprite path stays out)
    '}'].join('\n');
  const RIDE_FS = '#version 300 es\nprecision lowp float; out vec4 o; void main() { o = vec4(0.0); }';

  const G = { prog: null, gl: null, ext: null, t0: 0, linkMs: null, ok: null, err: null, loc: null, tf: null, nd: null, ndW: 0,
              stats: { frames: 0, draws: 0, ms: 0, msMax: 0, upPl: 0, upNon: 0, drawers: 0, ranges: 0 } };

  // ---- the program: linked once a page, off the main thread where the driver can (KHR_parallel_shader_compile) ----
  function prepare(renderer) {
    if (G.prog || G.ok === false) return;
    const gl = renderer && renderer.getContext && renderer.getContext();
    if (!gl || typeof WebGL2RenderingContext === 'undefined' || !(gl instanceof WebGL2RenderingContext)) { G.ok = false; G.err = 'no WebGL2'; return; }
    G.gl = gl; G.ext = gl.getExtension('KHR_parallel_shader_compile'); G.t0 = performance.now();
    // a lost context ends the GPU's riding for the page (its program and buffers went with it): the CPU rides from then on
    try { gl.canvas.addEventListener('webglcontextlost', () => { G.ok = false; G.err = 'the WebGL context was lost'; G.lostAt = G.stats.frames; }); } catch (e) {}
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const vs = sh(gl.VERTEX_SHADER, RIDE_VS), fs = sh(gl.FRAGMENT_SHADER, RIDE_FS), p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs);
    gl.transformFeedbackVaryings(p, ['vPos', 'vNrm'], gl.SEPARATE_ATTRIBS);
    gl.linkProgram(p);
    G.prog = p; G.vs = vs; G.fs = fs;
  }
  // true once linked (polled each frame: never blocks while the driver still links, where it can say so)
  function ready() {
    if (G.ok !== null) return G.ok;
    const gl = G.gl, p = G.prog;
    if (!p) return false;
    if (G.ext && !gl.getProgramParameter(p, G.ext.COMPLETION_STATUS_KHR)) return false;
    G.linkMs = performance.now() - G.t0;
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      G.ok = false; G.err = (gl.getProgramInfoLog(p) || '') + (gl.getShaderInfoLog(G.vs) || '');
      console.warn('SKIN_GPU: the riding program did not link - the CPU rides:', G.err);
      return false;
    }
    const u = n => gl.getUniformLocation(p, n);
    G.loc = { nd: u('uNd'), tx: ['uPA', 'uPW0', 'uPW1', 'uPI0', 'uPI1'].map(u), mi: u('uMi'), bt: u('uBt'), px: u('uPx'), down: u('uDown'), mode: u('uMode') };
    G.tf = gl.createTransformFeedback();
    G.ok = true;
    return true;
  }

  // ---- a DRAWER: one position attribute the aeroplane is drawn from (a fold's, or a bucket's own) ----
  // o: { THREE, A, AN (the normal attribute: a drawer needs one), geos (every geometry drawing A), views (the fold's members:
  // [{ pa, na, o, n }], or null: the bucket is drawn alone) }. Its buffers start as the CPU arrays stand
  function drawer(o) {
    const gl = G.gl, THREE = o.THREE, A = o.A, AN = o.AN, nV = A.count;
    const mk = arr => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW); return b; };
    const D = { A, AN, nV, geos: o.geos.slice(), views: o.views || null, posBuf: mk(A.array.subarray(0, nV * 3)), nrmBuf: AN ? mk(AN.array.subarray(0, nV * 3)) : null,
                recs: [], key: '', vao: null, inPl: null, inN: null, tex: null, np: 0, rows: 0, ver: null, upNeed: false };
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    D.glA = new THREE.GLBufferAttribute(D.posBuf, gl.FLOAT, 3, 4, nV);
    D.glN = AN ? new THREE.GLBufferAttribute(D.nrmBuf, gl.FLOAT, 3, 4, nV) : null;
    // (the CPU's arrays stay readable through them - a raycast, a rig's dump: the last CPU pose, not the GPU's riding)
    for (const [ga, a] of [[D.glA, A], [D.glN, AN]]) if (ga) { ga.array = a.array; ga.getX = i => a.array[i * 3]; ga.getY = i => a.array[i * 3 + 1]; ga.getZ = i => a.array[i * 3 + 2];
      ga.getComponent = (i, c) => a.array[i * 3 + c]; }
    for (const g of D.geos) if (!g.boundingSphere) g.computeBoundingSphere();
    D.saved = D.geos.map(g => [g, g.attributes.position, g.attributes.normal]);
    for (const g of D.geos) { g.attributes.position = D.glA; if (AN && g.attributes.normal === AN) g.attributes.normal = D.glN; }
    // the members that do not ride: their attribute versions, as last sent up (the fold's own range test, kept apart)
    if (D.views) D.ver = D.views.map(v => [v.pa.version, v.na ? v.na.version : -1]);
    return D;
  }
  // the drawer's riding ranges changed (a record joined): its inputs made again. recs: [{ R, vo (the record's first
  // vertex in the drawer), pa (its position attribute), nB (its rest normals) }] - skin_break.js placesOf has run on each R
  function layout(D, recs) {
    const gl = G.gl;
    D.recs = recs.slice().sort((a, b) => a.vo - b.vo);
    D.riding = new Set(D.recs.map(r => r.pa));
    let nIn = 0, np = 0;
    for (const r of D.recs) { r.ci = nIn; r.p0 = np; nIn += r.R.nv; np += r.R.pl.length; }
    const inPl = new Uint32Array(nIn), inN = new Float32Array(nIn * 3);
    for (const r of D.recs) { const nv = r.R.nv, pf = r.R.plOf;
      for (let v = 0; v < nv; v++) inPl[r.ci + v] = r.p0 + pf[v];
      if (r.nB) inN.set(r.nB.subarray(0, nv * 3), r.ci * 3); }
    free(D, true);
    const buf = arr => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); return b; };
    D.inPl = buf(inPl); D.inN = buf(inN);
    D.vao = gl.createVertexArray(); gl.bindVertexArray(D.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, D.inPl); gl.enableVertexAttribArray(0); gl.vertexAttribIPointer(0, 1, gl.UNSIGNED_INT, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, D.inN); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    // THE PLACES MODE's inputs (the tear's world positions): every place once, in order; the normal unread (no array)
    const ids = new Uint32Array(np); for (let j = 0; j < np; j++) ids[j] = j;
    D.inId = buf(ids);
    D.vaoW = gl.createVertexArray(); gl.bindVertexArray(D.vaoW);
    gl.bindBuffer(gl.ARRAY_BUFFER, D.inId); gl.enableVertexAttribArray(0); gl.vertexAttribIPointer(0, 1, gl.UNSIGNED_INT, 0, 0);
    gl.bindVertexArray(null);
    // (wBuf takes the feedback; rBuf - never bound for it - is copied from it on the GPU and read: WebGL refuses to map a
    // buffer bound for transform feedback, and Chrome lost the whole context over it on the box)
    D.wBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, D.wBuf); gl.bufferData(gl.ARRAY_BUFFER, Math.max(1, np) * 12, gl.STREAM_COPY);
    D.rBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, D.rBuf); gl.bufferData(gl.ARRAY_BUFFER, Math.max(1, np) * 12, gl.STREAM_READ);
    D.wSink = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, D.wSink); gl.bufferData(gl.ARRAY_BUFFER, Math.max(1, np) * 12, gl.STREAM_COPY);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    D.Wp = new Float32Array(np * 3); D.wSeq = 0; D.wantW = false;
    D.np = np; D.rows = Math.max(1, Math.ceil(np / PW_W));
    D.cpu = SB_placeArrays(D.rows);
    D.tex = TXK.map(() => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, PW_W, D.rows); return t; });
    gl.bindTexture(gl.TEXTURE_2D, null);
    for (const r of D.recs) r.R.dvUp = -1;               // every record packed and sent again
    D.key = D.recs.map(r => r.vo).join(',');
  }
  // THE STALE PLACES PACKED into D.cpu: a record whose data moved since it last went up (R.dv: an event) whole, else the
  // places a binding step listed (R.dirtyPl). Returns the rows [r0, r1) to send. Pure (GATE DMGSKINGPU runs it)
  function packStale(D, SB, rest, baseOf) {
    let r0 = Infinity, r1 = -1;
    for (const r of D.recs) {
      const R = r.R;
      if (R.dvUp !== R.dv) { SB.packPlaces(R, rest, baseOf(r), D.cpu, r.p0);
        R.dvUp = R.dv; R.dirtyPl = null; r0 = Math.min(r0, Math.floor(r.p0 / PW_W)); r1 = Math.max(r1, Math.ceil((r.p0 + R.pl.length) / PW_W)); }
      else if (R.dirtyPl && R.dirtyPl.length) {
        for (const j of R.dirtyPl) { SB.packPlaces(R, rest, baseOf(r), D.cpu, r.p0, j, j + 1);
          const row = Math.floor((r.p0 + j) / PW_W); if (row < r0) r0 = row; if (row + 1 > r1) r1 = row + 1; }
        R.dirtyPl = null;
      }
    }
    return [r0, r1];
  }
  // the place texels of rows [r0, r1) up
  function upRows(D, r0, r1) {
    const gl = G.gl;
    unpack(gl);
    for (let k = 0; k < TXK.length; k++) { gl.bindTexture(gl.TEXTURE_2D, D.tex[k]);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, r0, PW_W, r1 - r0, gl.RGBA, gl.FLOAT, D.cpu[TXK[k]], r0 * PW_W * 4); }
    gl.bindTexture(gl.TEXTURE_2D, null);
    G.stats.upPl += (r1 - r0) * PW_W;
  }
  function unpack(gl) {
    gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0); gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0); gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0); gl.pixelStorei(gl.UNPACK_IMAGE_HEIGHT, 0);
  }

  // ---- THE FRAME: the stale places packed and sent, the members that do not ride sent by range, the nodes, the draws ----
  // F: { SB (skin_break), rest, n, NF, live, cg, Mi, B, down, drawers: [D], pxOf(r) -> [x, y, z], base(r) -> the record's
  // rest (R.baseD), renderer }. Returns the ms spent
  function frame(F) {
    const gl = G.gl, t0 = performance.now(), L = G.loc;
    // (debug, G.dbgErr > 0: the GL error after each step, for that many frames - the box rig's hunt; a sync stall each)
    const chk = G.dbgErr > 0 ? (what => { const e = gl.getError(); if (e && !G.firstErr) G.firstErr = { e, what, frame: G.stats.frames }; }) : null;
    if (chk) { G.dbgErr--; chk('before'); }
    // the nodes' texture (2 texels a node)
    const n = F.n;
    if (!G.nd || G.ndW < 2 * n) {
      if (G.nd) gl.deleteTexture(G.nd);
      G.nd = gl.createTexture(); G.ndW = 2 * n; gl.bindTexture(gl.TEXTURE_2D, G.nd);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, G.ndW, 1); G.ndA = new Float32Array(G.ndW * 4);
    }
    F.SB.packNodes(F.NF, F.live, n, F.cg, G.ndA);
    unpack(gl);
    gl.bindTexture(gl.TEXTURE_2D, G.nd); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 2 * n, 1, gl.RGBA, gl.FLOAT, G.ndA);
    gl.useProgram(G.prog);
    // uMi: the CPU's row-major inverse, into GLSL's column-major (transposed); uBt: the row-major basis read as columns = B^T
    const Mi = F.Mi, B = F.B;
    gl.uniformMatrix3fv(L.mi, false, [Mi[0], Mi[3], Mi[6], Mi[1], Mi[4], Mi[7], Mi[2], Mi[5], Mi[8]]);
    gl.uniformMatrix3fv(L.bt, false, B);
    gl.uniform3f(L.down, F.down[0], F.down[1], F.down[2]);
    gl.uniform1i(L.nd, 0); L.tx.forEach((u, k) => gl.uniform1i(u, 1 + k)); gl.uniform1i(L.mode, 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, G.nd);
    gl.enable(gl.RASTERIZER_DISCARD);
    let draws = 0;
    for (const D of F.drawers) {
      // the stale records: packed (whole after an event, by place after a step of the binding) and sent by rows
      const [r0, r1] = packStale(D, F.SB, F.rest, F.base);
      if (r1 > r0) { upRows(D, r0, r1); gl.useProgram(G.prog); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, G.nd); }
      if (chk) chk('places up');
      // the members that do not ride (a fold's legs, floats, links): sent by range as their attributes moved
      if (D.views) {
        const P = D.A.array, N = D.AN ? D.AN.array : null;
        for (let i = 0; i < D.views.length; i++) {
          const v = D.views[i], s = D.ver[i];
          if (v.pa.version === s[0] && (!v.na || v.na.version === s[1])) continue;
          const dp = v.pa.version !== s[0], dn = v.na && v.na.version !== s[1];
          s[0] = v.pa.version; if (v.na) s[1] = v.na.version;
          if (D.riding && D.riding.has(v.pa)) continue;   // (a riding member: the draws below write it)
          if (dp) { gl.bindBuffer(gl.ARRAY_BUFFER, D.posBuf); gl.bufferSubData(gl.ARRAY_BUFFER, v.o * 4, P, v.o, v.n); }
          if (dn && N && D.nrmBuf) { gl.bindBuffer(gl.ARRAY_BUFFER, D.nrmBuf); gl.bufferSubData(gl.ARRAY_BUFFER, v.o * 4, N, v.o, v.n); }
          G.stats.upNon += v.n / 3;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
      }
      if (chk) chk('non-riding up');
      if (!D.vao || D.off) continue;
      for (let k = 0; k < TXK.length; k++) { gl.activeTexture(gl.TEXTURE1 + k); gl.bindTexture(gl.TEXTURE_2D, D.tex[k]); }
      gl.bindVertexArray(D.vao);
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, G.tf);
      // the riding ranges, one draw a RUN: records side by side in the drawer and in the inputs, with the same offset (the
      // fold's members a rig writes lie together: ~100 records, a handful of draws - a feedback draw's fixed cost is the CPU's)
      const draw = (vo, ci, n, px) => {
        gl.uniform3f(L.px, px[0], px[1], px[2]);
        gl.bindBufferRange(gl.TRANSFORM_FEEDBACK_BUFFER, 0, D.posBuf, vo * 12, n * 12);
        gl.bindBufferRange(gl.TRANSFORM_FEEDBACK_BUFFER, 1, D.nrmBuf, vo * 12, n * 12);
        gl.beginTransformFeedback(gl.POINTS); gl.drawArrays(gl.POINTS, ci, n); gl.endTransformFeedback();
        draws++;
        if (chk) chk('draw vo ' + vo + ' n ' + n + ' of ' + D.nV);
      };
      let run = null;
      for (const r of D.recs) {
        if (!r.R.active || r.cpu) { if (run) { draw(run.vo, run.ci, run.n, run.px); run = null; } continue; }
        const px = F.pxOf(r), nv = r.R.nv;
        if (run && r.vo === run.vo + run.n && r.ci === run.ci + run.n && px[0] === run.px[0] && px[1] === run.px[1] && px[2] === run.px[2]) { run.n += nv; continue; }
        if (run) draw(run.vo, run.ci, run.n, run.px);
        run = { vo: r.vo, ci: r.ci, n: nv, px };
      }
      if (run) draw(run.vo, run.ci, run.n, run.px);
      // THE PLACES MODE, asked by the tear (D.wantW) with none in flight: every place's world position into wBuf, fenced -
      // read when the fence has passed (poll), never waited on
      let wPass = false;
      if (D.wantW && !D.pend && D.np) {
        gl.uniform1i(L.mode, 1);
        gl.bindVertexArray(D.vaoW);
        gl.bindBufferRange(gl.TRANSFORM_FEEDBACK_BUFFER, 0, D.wBuf, 0, D.np * 12);
        gl.bindBufferRange(gl.TRANSFORM_FEEDBACK_BUFFER, 1, D.wSink, 0, D.np * 12);
        gl.beginTransformFeedback(gl.POINTS); gl.drawArrays(gl.POINTS, 0, D.np); gl.endTransformFeedback();
        gl.uniform1i(L.mode, 0);
        wPass = true; D.wantW = false; draws++; G.stats.wPass = (G.stats.wPass || 0) + 1;
        if (chk) chk('places pass ' + D.np);
      }
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null); gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, null);
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
      gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null);
      gl.bindVertexArray(null);
      // the places, out of the feedback's buffer into the one read (a GPU copy), fenced: poll reads it once the fence passed
      if (wPass) {
        gl.bindBuffer(gl.COPY_READ_BUFFER, D.wBuf); gl.bindBuffer(gl.COPY_WRITE_BUFFER, D.rBuf);
        gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.COPY_WRITE_BUFFER, 0, 0, D.np * 12);
        gl.bindBuffer(gl.COPY_READ_BUFFER, null); gl.bindBuffer(gl.COPY_WRITE_BUFFER, null);
        D.pend = { sync: gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0), t: performance.now(), tag: F.tag };   // (tag: the frame sampled - G1818 t41)
        if (chk) chk('places copied');
      }
    }
    gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null);
    gl.disable(gl.RASTERIZER_DISCARD);
    for (let k = 0; k <= TXK.length; k++) { gl.activeTexture(gl.TEXTURE0 + k); gl.bindTexture(gl.TEXTURE_2D, null); }
    gl.activeTexture(gl.TEXTURE0);
    gl.useProgram(null);
    const ms = performance.now() - t0, S = G.stats;
    S.frames++; S.draws += draws; S.ms += ms; S.msMax = Math.max(S.msMax, ms); S.drawers = F.drawers.length; S.ranges = F.drawers.reduce((a, D) => a + D.recs.length, 0);
    return ms;
  }
  // THE TEAR'S POSITIONS: a places pass whose fence has passed is read (no stall: the GPU is done with it) into D.Wp;
  // D.wSeq counts the reads. Returns true when one was read
  function poll(D) {
    const gl = G.gl, P = D.pend;
    if (!P) return false;
    const st = gl.getSyncParameter(P.sync, gl.SYNC_STATUS);
    if (st !== gl.SIGNALED) return false;
    gl.deleteSync(P.sync); D.pend = null;
    gl.bindBuffer(gl.COPY_READ_BUFFER, D.rBuf); gl.getBufferSubData(gl.COPY_READ_BUFFER, 0, D.Wp, 0, D.np * 3); gl.bindBuffer(gl.COPY_READ_BUFFER, null);
    D.wSeq++; D.wTag = P.tag; G.stats.wReads = (G.stats.wReads || 0) + 1; G.stats.wLagMs = Math.max(G.stats.wLagMs || 0, performance.now() - P.t);
    return true;
  }
  // THREE'S GL STATE KEPT: every binding this module touches is read before and put back after (the program, the vertex
  // array, the active unit and the six units' 2D textures, the array / unpack buffers, the unpack settings, the feedback,
  // the rasterizer discard) - three's own caches then stay true. Not renderer.resetState(): r186's resets the depth
  // state's `reversed` to false without undoing the clip control, and the page draws reversed-Z - the box lost the runway
  // and the aeroplane from every frame after the first riding one (re-asserting it re-cleared the depth wrong: a grey
  // frame). getParameter on these is served from the client's cache (no GPU round trip)
  const UNITS = 6;
  function saveGL() {
    const gl = G.gl, st = { prog: gl.getParameter(gl.CURRENT_PROGRAM), vao: gl.getParameter(gl.VERTEX_ARRAY_BINDING), unit: gl.getParameter(gl.ACTIVE_TEXTURE),
      ab: gl.getParameter(gl.ARRAY_BUFFER_BINDING), pub: gl.getParameter(gl.PIXEL_UNPACK_BUFFER_BINDING), tfb: gl.getParameter(gl.TRANSFORM_FEEDBACK_BINDING),
      disc: gl.isEnabled(gl.RASTERIZER_DISCARD), tex: [],
      px: [gl.UNPACK_ALIGNMENT, gl.UNPACK_FLIP_Y_WEBGL, gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, gl.UNPACK_ROW_LENGTH, gl.UNPACK_SKIP_ROWS, gl.UNPACK_SKIP_PIXELS, gl.UNPACK_IMAGE_HEIGHT].map(k => [k, gl.getParameter(k)]) };
    for (let k = 0; k < UNITS; k++) { gl.activeTexture(gl.TEXTURE0 + k); st.tex.push(gl.getParameter(gl.TEXTURE_BINDING_2D)); }
    gl.activeTexture(st.unit);
    return st;
  }
  function restoreGL(st) {
    const gl = G.gl;
    if (st.disc) gl.enable(gl.RASTERIZER_DISCARD); else gl.disable(gl.RASTERIZER_DISCARD);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, st.tfb);
    for (let k = 0; k < UNITS; k++) { gl.activeTexture(gl.TEXTURE0 + k); gl.bindTexture(gl.TEXTURE_2D, st.tex[k]); }
    gl.activeTexture(st.unit);
    gl.bindVertexArray(st.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, st.ab);
    gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, st.pub);
    for (const [k, v] of st.px) gl.pixelStorei(k, v);
    gl.useProgram(st.prog);
  }
  const kept = fn => function () { if (!G.gl) return fn.apply(this, arguments); const st = saveGL(); try { return fn.apply(this, arguments); } finally { restoreGL(st); } };
  // the drawn buffers read back (a debug check: a synchronous stall - the box's tolerance rig only)
  // (copied first into a buffer never bound for the feedback: WebGL will not map one that is)
  function readBack(D, vo, n) {
    const gl = G.gl, P = new Float32Array(n * 3), N = new Float32Array(n * 3), tmp = gl.createBuffer();
    gl.bindBuffer(gl.COPY_WRITE_BUFFER, tmp); gl.bufferData(gl.COPY_WRITE_BUFFER, n * 12, gl.STREAM_READ);
    for (const [src, dst] of [[D.posBuf, P], [D.nrmBuf, N]]) { if (!src) continue;
      gl.bindBuffer(gl.COPY_READ_BUFFER, src); gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.COPY_WRITE_BUFFER, vo * 12, 0, n * 12);
      gl.getBufferSubData(gl.COPY_WRITE_BUFFER, 0, dst); }
    gl.bindBuffer(gl.COPY_READ_BUFFER, null); gl.bindBuffer(gl.COPY_WRITE_BUFFER, null); gl.deleteBuffer(tmp);
    return { P, N };
  }
  function free(D, inputsOnly) {
    const gl = G.gl;
    if (D.vao) gl.deleteVertexArray(D.vao); if (D.inPl) gl.deleteBuffer(D.inPl); if (D.inN) gl.deleteBuffer(D.inN);
    if (D.vaoW) gl.deleteVertexArray(D.vaoW); if (D.inId) gl.deleteBuffer(D.inId); if (D.wBuf) gl.deleteBuffer(D.wBuf); if (D.rBuf) gl.deleteBuffer(D.rBuf); if (D.wSink) gl.deleteBuffer(D.wSink);
    if (D.pend) gl.deleteSync(D.pend.sync);
    if (D.tex) for (const t of D.tex) gl.deleteTexture(t);
    D.vao = D.inPl = D.inN = D.tex = D.vaoW = D.inId = D.wBuf = D.rBuf = D.wSink = D.pend = null; D.wSeq = 0;
    if (inputsOnly) return;
    if (D.posBuf) gl.deleteBuffer(D.posBuf); if (D.nrmBuf) gl.deleteBuffer(D.nrmBuf);
    D.posBuf = D.nrmBuf = null;
  }
  // THE HEAL: the geometries draw their own attributes again, sent up whole from the CPU arrays (the rigs kept writing
  // them; three sent nothing while they were not drawn), and the drawer's GL objects freed
  function release(D, renderer) {
    for (const [g, a, n] of D.saved) { if (g.attributes.position === D.glA) g.attributes.position = a; if (D.glN && g.attributes.normal === D.glN) g.attributes.normal = n; }
    for (const a of [D.A, D.AN]) if (a) { if (a.clearUpdateRanges) a.clearUpdateRanges(); a.needsUpdate = true; }
    free(D);
  }

  const API = { RIDE_VS, RIDE_FS, PW_W, TXK, G, packStale, prepare, ready, drawer: kept(drawer), layout: kept(layout),
                frame: kept(frame), poll, readBack: kept(readBack), release: kept(release) };   // (poll binds only COPY_READ_BUFFER, which three never caches: unwrapped - wrapped, its 39 calls a frame were ~800 getParameter, ~5 ms a frame on the box)
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (W) W.SKIN_GPU = API;
})();
