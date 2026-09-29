// ktx2_ab.js - THE GROUND'S COMPRESSED ARRAYS, SAMPLED ON THE GPU (G918, AS3). A page-side expression for frame_perf's
// --eval (the game rolled out and paused at the stand), ground_ab.js's twin:
//   node tools/frame_perf.js --url http://localhost:<port>/flyDiy/index.html?world=jolene --places stand --tiers gfx --frames 10 --eval @tools/ktx2_ab.js
// AS3 ships the ground library's layers as KTX2 (UASTC), transcoded in the page's workers into the GPU's own block format
// (BC7 on a desktop) and uploaded as CompressedArrayTextures. GATE KTX2 decodes every file in node with the same
// transcoder; THIS asks the box's GPU and driver: every layer of the live arrays (the splat's uSplat / uSplatN, the
// pavement's uPavA / uPavN) is drawn texel for texel at level 0 (texelFetch; an sRGB-typed array's decoded value is
// re-encoded, so the bytes compare as stored) into an RGBA8 target, read back, and scored against the RAW layer the
// page used before AS3 (the set's cooked .gz.bin, fetched and gunzipped here): PSNR of rgb and alpha, and each channel's
// mean. The floors are GATE KTX2's (25 dB); with ?ktx2=0 the arrays are the raw layers and every layer reads 99 dB.
// It changes nothing it does not restore.
(async () => {
  const W = (typeof WORLD !== 'undefined' && WORLD) || window.WORLD, R = W.renderer, gl = R.getContext();
  const FLOOR = { rgb: 25, a: 25 };
  const sp = W.ground && W.ground.splat && W.ground.splat();
  const [sA, sN] = sp && sp.arrays ? sp.arrays() : [null, null];
  const splatKeys = sp && sp.layers ? sp.layers() : [];
  const PV = (typeof PAVEMENT !== 'undefined' && PAVEMENT) || window.PAVEMENT, pav = PV && PV.sharedLib ? PV.sharedLib(THREE, []) : null;
  const layersOf = L => k => { if (L === 'splat') { const s = SPLAT_TEX_SETS.find(x => x.key === k); return s && s.layers; } const s = PAVEMENT_TEX_SETS[k]; return s && s.layers; };
  const raw = async url => new Uint8Array(await new Response((await fetch(url)).body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  // the sampling pass: one program, texelFetch of layer u_l at level 0
  const vs = '#version 300 es\nin vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
  const fs = '#version 300 es\nprecision highp float; precision highp sampler2DArray; uniform sampler2DArray t; uniform int l; uniform int enc; out vec4 o;\n' +
    'vec3 e(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }\n' +
    'void main(){ vec4 c = texelFetch(t, ivec3(ivec2(gl_FragCoord.xy), l), 0); o = enc == 1 ? vec4(e(c.rgb), c.a) : c; }';
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog);
  const vao = gl.createVertexArray(), vb = gl.createBuffer();
  gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.bindAttribLocation(prog, 0, 'p'); gl.linkProgram(prog); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const fb = gl.createFramebuffer(), rt = gl.createTexture();
  const read = (tex, layer) => {
    if (!R.properties.get(tex).__webglTexture) R.initTexture(tex);
    const t = R.properties.get(tex).__webglTexture; if (!t) return null;
    const w = tex.image.width, h = tex.image.height, px = new Uint8Array(w * h * 4);
    gl.bindTexture(gl.TEXTURE_2D, rt); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, rt, 0);
    gl.viewport(0, 0, w, h); gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.SCISSOR_TEST);
    gl.useProgram(prog); gl.bindVertexArray(vao);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
    gl.uniform1i(gl.getUniformLocation(prog, 't'), 0); gl.uniform1i(gl.getUniformLocation(prog, 'l'), layer);
    gl.uniform1i(gl.getUniformLocation(prog, 'enc'), tex.colorSpace === THREE.SRGBColorSpace ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return px;
  };
  const psnr = (a, b, chs) => { let se = 0, n = 0; for (let i = 0; i < a.length; i += 4) for (const c of chs) { const d = a[i + c] - b[i + c]; se += d * d; n++; } const m = se / n; return m ? 10 * Math.log10(65025 / m) : 99; };
  const drift = (a, b) => { let w = 0; for (let c = 0; c < 4; c++) { let sa = 0, sb = 0; for (let i = c; i < a.length; i += 4) { sa += a[i]; sb += b[i]; } w = Math.max(w, Math.abs(sa - sb) / (a.length / 4)); } return w; };
  const out = { renderer: gl.getParameter(gl.RENDERER), splat: null, pavement: null };
  for (const [L, keys, A, N] of [['splat', splatKeys, sA, sN], ['pavement', pav ? pav.keys : [], pav && pav.texA, pav && pav.texN]]) {
    const r = out[L] = { keys: keys.length, kind: A && A.isCompressedArrayTexture ? 'compressed (format ' + A.format + ')' : A ? 'raw RGBA8' : 'none', worst: { A: [99, 99, ''], N: [99, 99, ''] }, maxDrift: 0, below: [] };
    if (!A || !N || !A.image || A.image.depth !== keys.length) { r.error = 'no live arrays'; continue; }
    for (let i = 0; i < keys.length; i++) {
      const url = layersOf(L)(keys[i]); if (!url) { r.below.push(keys[i] + ' (no raw layer)'); continue; }
      const b = await raw(url), S = b.length / 2;
      for (const [P, tex, ref] of [['A', A, b.subarray(0, S)], ['N', N, b.subarray(S)]]) {
        const got = read(tex, i); if (!got) { r.below.push(keys[i] + ' ' + P + ' unreadable'); continue; }
        const pr = psnr(got, ref, [0, 1, 2]), pa = psnr(got, ref, [3]), d = drift(got, ref);
        if (pr < r.worst[P][0]) r.worst[P] = [+pr.toFixed(1), r.worst[P][1], keys[i]];
        if (pa < r.worst[P][1]) r.worst[P][1] = +pa.toFixed(1);
        r.maxDrift = Math.max(r.maxDrift, +d.toFixed(2));
        if (pr < FLOOR.rgb || pa < FLOOR.a || d > 1.5) r.below.push(`${keys[i]} ${P} rgb ${pr.toFixed(1)} a ${pa.toFixed(1)} dB mean ${d.toFixed(2)}`);
      }
    }
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb); gl.deleteTexture(rt); gl.deleteProgram(prog); gl.deleteBuffer(vb); gl.deleteVertexArray(vao); R.resetState();
  out.ktx2 = window.KTX2 ? KTX2.stats() : null; out.ground = window.GROUND_LIB ? GROUND_LIB.stats() : null;
  out.verdict = ['splat', 'pavement'].every(L => out[L] && !out[L].error && out[L].keys > 0 && !out[L].below.length) ? 'WITHIN FLOORS' : 'BELOW';
  return JSON.stringify(out);
})()
