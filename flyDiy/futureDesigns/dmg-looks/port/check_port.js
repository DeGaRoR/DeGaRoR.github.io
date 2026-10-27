#!/usr/bin/env node
// DMG-LOOKS PORT KIT - THE CHECK: the GLSL is the mirror (a real WebGL2: headless Chromium on SwiftShader, transform
// feedback), plus the mirror's own sanity. Run before wiring, and again after pasting the GLSL into the pool's shader.
//   node futureDesigns/dmg-looks/port/check_port.js        -> "PORT CHECK: PASS|FAIL", exit 1 on FAIL
//   ALLOY  SMOOTH NORMALS (the user, 27 Oct: no flat shading on a deformed part): every vertex's normal (poseJS) against
//          the posed mesh's own surface there (its face strip's incident triangles, area-weighted), and GLSL vs JS;
//          every canonical vertex posed by GLSL vs poseJS over crushed (0-90 mm) and torn (A / B) slots, random
//          orientations: |dpos| < 0.2 mm, |dx| < 0.2 mm; fragments (random + round the holes): the same keep and colour
//          on >= 99.5 % (the rest: points within float rounding of a crack or a hole edge)
//          sanity: a crushed slot's ends land on its nodes; a torn piece never passes its bound
//   RIM    (dmg_looks_rim.js) the bands' GLSL vs JS on random (e, x, y, finish); the incremental rim on a synthetic sheet
//          equals the from-scratch rim after a run of events
'use strict';
const path = require('path'), fs = require('fs');
const AL = require('./dmg_looks_alloy.js');
let RIM = null; try { RIM = require('./dmg_looks_rim.js'); } catch (e) { /* not written yet */ }
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const rnd = (() => { let a = 12345; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
const norm = v => { const l = Math.hypot(...v); return v.map(q => q / l); };

function alloyCases() {
  const C = AL.canon(), cases = [];
  for (const [mode, par] of [[0, 0], [0, 0.005], [0, 0.02], [0, 0.04], [0, 0.06], [0, 0.09], [1, 0.3], [2, 0.3], [1, 0.55], [2, 0.7], [1, 0.45], [2, 0.45]]) {
    const L0 = 0.35 + 0.3 * rnd(), seed = (rnd() * 1e5) | 0, A = [rnd() * 4 - 2, rnd() * 2, rnd() * 4 - 2], dir = norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]);
    const c = mode === 0 ? L0 - par : L0, B = A.map((q, j) => q + dir[j] * c), up = norm([rnd() - 0.5, 1, rnd() - 0.5]);
    const S = AL.slotState(mode === 0 ? { mode, L0, kt1: 0.4 + 0.2 * rnd(), seed } : { mode, L0, tb: par, seed });
    const verts = []; for (let v = 0; v < C.nv; v++) verts.push(Array.from(C.attr.slice(v * C.stride, v * C.stride + C.stride)));
    const frags = [];
    for (let i = 0; i < 400; i++) frags.push([rnd() * L0, (rnd() * 2 - 1) * AL.DEF.w, rnd() < 0.5 ? 1 : 0, rnd() < 0.8 ? 1 : 0]);
    if (mode) for (let i = 0; i < 400; i++) { const hx = S[14] + (rnd() * 4 - 1.5) * S[10]; frags.push([hx + (rnd() - 0.5) * 0.008, -S[11] * S[4] + (rnd() - 0.5) * 0.006, 1, 1]); }
    cases.push({ mode, par, L0, A, B, up, S: Array.from(S), verts, frags });
  }
  return cases;
}

async function gpuRun(cases, glsl) {
  let pw; try { pw = require('playwright'); } catch (e) { return { skip: 'no playwright' }; }
  const b = await pw.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage();
  const out = await pg.evaluate(([cases, glsl]) => {
    const cv = document.createElement('canvas'), gl = cv.getContext('webgl2'); if (!gl) return { err: 'no webgl2' };
    const vs = '#version 300 es\nprecision highp float; precision highp int;\n' + glsl + '\n' +
      'in vec3 aA; in vec3 aB; in vec2 aN; in vec4 aF; uniform float uS[16]; uniform vec3 uA; uniform vec3 uB; uniform vec3 uUp;\n' +
      'out vec3 vPos; out float vX; out vec4 vFrag; out vec3 vNrm;\n' +
      'void main() { float a[6]; a[0] = aA.x; a[1] = aA.y; a[2] = aA.z; a[3] = aB.x; a[4] = aB.y; a[5] = aB.z;\n' +
      '  float S[16]; for (int i = 0; i < 16; i++) S[i] = uS[i]; float xo;\n' +
      '  vPos = dlAlloyPose(a, S, uA, uB, uUp, xo); vX = xo; vFrag = dlAlloyFrag(aF.x, aF.y, aF.z, aF.w > 0.5, S); vNrm = dlAlloyNormal(a, aN, S, uA, uB, uUp); gl_Position = vec4(0.0); }';
    const fs = '#version 300 es\nprecision highp float; out vec4 o; void main() { o = vec4(0.0); }';
    const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
    const pr = gl.createProgram();
    try { gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); } catch (e) { return { err: 'compile: ' + e.message }; }
    gl.transformFeedbackVaryings(pr, ['vPos', 'vX', 'vFrag', 'vNrm'], gl.INTERLEAVED_ATTRIBS); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return { err: 'link: ' + gl.getProgramInfoLog(pr) };
    gl.useProgram(pr); gl.enable(gl.RASTERIZER_DISCARD);
    const loc = n => gl.getAttribLocation(pr, n), res = [];
    for (const C of cases) {
      const n = Math.max(C.verts.length, C.frags.length), data = new Float32Array(n * 12);
      for (let i = 0; i < n; i++) { const v = C.verts[i % C.verts.length], f = C.frags[i % C.frags.length]; data.set(v.slice(0, 8), i * 12); data.set(f, i * 12 + 8); }
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      for (const [nm, sz, off] of [['aA', 3, 0], ['aB', 3, 3], ['aN', 2, 6], ['aF', 4, 8]]) { const l = loc(nm); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, sz, gl.FLOAT, false, 48, off * 4); }
      gl.uniform1fv(gl.getUniformLocation(pr, 'uS'), new Float32Array(C.S)); gl.uniform3fv(gl.getUniformLocation(pr, 'uA'), C.A); gl.uniform3fv(gl.getUniformLocation(pr, 'uB'), C.B); gl.uniform3fv(gl.getUniformLocation(pr, 'uUp'), C.up);
      const tf = gl.createBuffer(); gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, tf); gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, n * 11 * 4, gl.STREAM_READ);
      const T = gl.createTransformFeedback(); gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, T); gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, tf);
      gl.beginTransformFeedback(gl.POINTS); gl.drawArrays(gl.POINTS, 0, n); gl.endTransformFeedback(); gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
      const outb = new Float32Array(n * 11); gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, tf); gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, 0, outb);
      res.push(Array.from(outb));
    }
    return { res, renderer: gl.getParameter(gl.RENDERER) };
  }, [cases, glsl]);
  await b.close();
  return out;
}

(async () => {
  console.log('PORT CHECK - ALLOY');
  const C = AL.canon(); ok(C.ntri === (AL.RINGS[0] + AL.RINGS[1] + AL.RINGS[2]) * 24, `canonical slot: ${C.nv} vertices, ${C.ntri} triangles, ${C.rings} rings`);
  const cases = alloyCases();
  // the mirror's sanity
  { let endErr = 0, pass = 0;
    for (const K of cases) for (const v of K.verts) { const r = AL.poseJS(v, Float32Array.from(K.S), K.A, K.B, K.up);
      if (K.mode === 0 && (v[0] === -1 || v[0] === 1) && v[1] === 0 && v[2] === 0 && v[3] === 0) { const E = v[0] === -1 ? K.A : K.B; endErr = Math.max(endErr, Math.hypot(...r.pos.map((q, j) => q - E[j]))); }
      if (K.mode === 1 && r.x > K.S[13] + 1e-9) pass++; if (K.mode === 2 && r.x < K.S[12] - 1e-9) pass++; }
    ok(endErr < 1e-6, `a crushed slot's ends land on its nodes (worst ${(endErr * 1000).toFixed(4)} mm)`);
    ok(pass === 0, `a torn piece never passes its bound (${pass} vertices past)`); }
  // the normals follow the deformed shape: each vertex's against its face strip's posed triangles round it (area-weighted;
  // a collapsed vertex - a torn piece's past its bound - the 5 mm of curled lip, and a crimp's CLOSED FOLD (the shape runs back
  // over itself there: poseJS fold) and the kink's apex (poseJS crease: over 30 deg ring to ring), with the triangles touching them, skipped: the tear and the fold are the real creases)
  { const angs = [], angS = []; let hard = 0, nFold = 0;
    for (const K of cases) { const S = Float32Array.from(K.S), R = K.verts.map(v => AL.poseJS(v, S, K.A, K.B, K.up)), acc = R.map(() => [0, 0, 0]);
      for (let t = 0; t < C.ntri; t++) { const i = [C.index[t * 3], C.index[t * 3 + 1], C.index[t * 3 + 2]], P = i.map(j => R[j].pos);
        const u = [P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]], w = [P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]];
        const nn = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; for (const j of i) for (let c = 0; c < 3; c++) acc[j][c] += nn[c]; }
      const folded = new Uint8Array(R.length); for (let t = 0; t < C.ntri; t++) { const i = [C.index[t * 3], C.index[t * 3 + 1], C.index[t * 3 + 2]]; if (i.some(j => R[j].fold || R[j].crease)) for (const j of i) folded[j] = 1; }
      R.forEach((r, j) => { const l = Math.hypot(...acc[j]); if (l < 1e-12) return;
        if (folded[j]) { nFold++; angS.push(Math.acos(Math.max(-1, Math.min(1, (acc[j][0] * r.nrm[0] + acc[j][1] * r.nrm[1] + acc[j][2] * r.nrm[2]) / l))) * 180 / Math.PI); return; } if (K.mode && (Math.abs(r.x - S[12]) < 0.006 || Math.abs(r.x - S[13]) < 0.006 || r.x > S[13] || r.x < S[12])) return;
        const a = Math.acos(Math.max(-1, Math.min(1, (acc[j][0] * r.nrm[0] + acc[j][1] * r.nrm[1] + acc[j][2] * r.nrm[2]) / l))) * 180 / Math.PI; angs.push(a); if (a > 25) hard++; }); }
    angs.sort((a, b) => a - b); const q = f => angs[Math.min(angs.length - 1, Math.floor(f * angs.length))];
    angS.sort((a, b) => a - b); const qs = f => angS.length ? angS[Math.min(angS.length - 1, Math.floor(f * angS.length))].toFixed(1) : '-';
    ok(q(0.95) < 6 && q(0.999) < 20, `ALLOY normals follow the deformed shape: vs the posed mesh round each vertex - median ${q(0.5).toFixed(2)} deg, 95 % ${q(0.95).toFixed(2)}, 99.9 % ${q(0.999).toFixed(2)}, worst ${angs[angs.length - 1].toFixed(1)} (${angs.length} vertices, ${hard} over 25 deg; ${nFold} on a closed fold or the kink's crease, skipped - there, reported: median ${qs(0.5)} deg, 90 % ${qs(0.9)})`); }
  const G = await gpuRun(cases, AL.GLSL);
  if (G.skip) { console.log('  SKIP the GLSL parity: ' + G.skip); }
  else if (G.err) ok(false, 'the GLSL: ' + G.err);
  else {
    console.log('  (renderer: ' + G.renderer + ')');
    let dp = 0, dx = 0, fN = 0, fBad = 0, dn = 0;
    cases.forEach((K, ci) => { const out = G.res[ci], n = out.length / 11, S = Float32Array.from(K.S);
      for (let i = 0; i < K.verts.length; i++) { const r = AL.poseJS(K.verts[i], S, K.A, K.B, K.up);
        dp = Math.max(dp, Math.hypot(out[i * 11] - r.pos[0], out[i * 11 + 1] - r.pos[1], out[i * 11 + 2] - r.pos[2])); dx = Math.max(dx, Math.abs(out[i * 11 + 3] - r.x));
        dn = Math.max(dn, Math.acos(Math.max(-1, Math.min(1, out[i * 11 + 8] * r.nrm[0] + out[i * 11 + 9] * r.nrm[1] + out[i * 11 + 10] * r.nrm[2]))) * 180 / Math.PI); }
      for (let i = 0; i < n; i++) { const f = K.frags[i % K.frags.length]; if (i >= K.frags.length) break; const e = AL.fragJS(f[0], f[1], f[2], f[3] > 0.5, S); fN++;
        const g = out.slice(i * 11 + 4, i * 11 + 8); if ((g[3] > 0.5) !== (e[3] > 0.5) || (e[3] > 0.5 && Math.hypot(g[0] - e[0], g[1] - e[1], g[2] - e[2]) > 1e-3)) fBad++; } });
    ok(dp < 2e-4, `GLSL pose = poseJS: worst |dpos| ${(dp * 1000).toFixed(4)} mm over ${cases.reduce((s, K) => s + K.verts.length, 0)} vertices, 12 slots`);
    ok(dx < 2e-4, `GLSL station = poseJS: worst ${(dx * 1000).toFixed(4)} mm`);
    ok(dn < 0.5, `GLSL normal = poseJS: worst ${dn.toFixed(3)} deg`);
    ok(fBad / fN <= 0.005, `GLSL fragment = fragJS: ${fN - fBad} / ${fN} the same (${(100 * fBad / fN).toFixed(2)} % differ)`);
  }
  if (RIM && RIM.selfCheck) { console.log('PORT CHECK - RIM'); await RIM.selfCheck(ok, gpuRunGeneric); }
  console.log('PORT CHECK: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
  process.exit(fails ? 1 : 0);
})();

// a generic transform-feedback runner for other GLSL functions (the rim's bands): vsMain gets attribute aIn (vec4) and
// must write `out vec4 vOut`; returns the vec4s
async function gpuRunGeneric(glsl, vsMain, inputs) {
  let pw; try { pw = require('playwright'); } catch (e) { return { skip: 'no playwright' }; }
  const b = await pw.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage();
  const out = await pg.evaluate(([glsl, vsMain, inputs]) => {
    const gl = document.createElement('canvas').getContext('webgl2'); if (!gl) return { err: 'no webgl2' };
    const vs = '#version 300 es\nprecision highp float; precision highp int;\n' + glsl + '\nin vec4 aIn; out vec4 vOut;\n' + vsMain;
    const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
    const pr = gl.createProgram();
    try { gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float; out vec4 o; void main() { o = vec4(0.0); }')); } catch (e) { return { err: 'compile: ' + e.message }; }
    gl.transformFeedbackVaryings(pr, ['vOut'], gl.INTERLEAVED_ATTRIBS); gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return { err: gl.getProgramInfoLog(pr) };
    gl.useProgram(pr); gl.enable(gl.RASTERIZER_DISCARD);
    const data = new Float32Array(inputs.flat()), n = inputs.length, buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const l = gl.getAttribLocation(pr, 'aIn'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 4, gl.FLOAT, false, 16, 0);
    const tf = gl.createBuffer(); gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, tf); gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, n * 16, gl.STREAM_READ);
    const T = gl.createTransformFeedback(); gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, T); gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, tf);
    gl.beginTransformFeedback(gl.POINTS); gl.drawArrays(gl.POINTS, 0, n); gl.endTransformFeedback();
    const o = new Float32Array(n * 4); gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, 0, o); return { res: Array.from(o) };
  }, [glsl, vsMain, inputs]);
  await b.close(); return out;
}
