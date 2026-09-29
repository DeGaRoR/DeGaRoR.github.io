// ground_ab.js - THE GROUND'S ARRAYS, READ BACK OFF THE GPU (G913, AS2). A page-side expression for frame_perf's --eval
// (the game rolled out and paused at the stand), shell_ab.js's pattern:
//   node tools/frame_perf.js --url http://localhost:<port>/flyDiy/index.html?world=jolene --places stand --tiers gfx --frames 10 --eval @tools/ground_ab.js
// The one ground library (G910-G911) fills the splat's and the pavement's texture arrays from layers COOKED offline, where
// the page used to pack them through a canvas. GATE GROUNDLIB proves in node that every cooked layer is byte for byte what
// the old code packed in Chrome; THIS proves it on the box's own GPU and driver, after the upload: every layer of the live
// arrays (the splat's uSplat / uSplatN, the pavement's shared uPavA / uPavN) is attached to a framebuffer, read back
// (readPixels: an sRGB-typed array reads back its stored bytes, not decoded ones) and hashed against the same fingerprints
// (tools/perf/ground_layers_before.json: SHA-256 per library, key and plane, packed by b3bf0431's code). Run it on the
// branch; on the base it answers the same numbers from the old path (the arrays hold what the canvas packed there), so
// the two runs together are the before/after on this GPU. It changes nothing and draws nothing.
(async () => {
  const W = (typeof WORLD !== 'undefined' && WORLD) || window.WORLD, R = W.renderer, gl = R.getContext();   // script-scope bindings, not window's
  const FP = await (await fetch('tools/perf/ground_layers_before.json')).json();
  const hex = async u8 => [...new Uint8Array(await crypto.subtle.digest('SHA-256', u8))].map(b => b.toString(16).padStart(2, '0')).join('');
  // the arrays: the splat's (its api), the pavement's shared pair
  const sp = W.ground && W.ground.splat && W.ground.splat();
  let [sA, sN] = sp && sp.arrays ? sp.arrays() : [null, null];
  if (!sA) W.scene.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];   // the base: no arrays() -
    for (const m of ms) { const pr = R.properties.get(m), U = (pr && pr.uniforms) || {};                                      // the compiled ground's uniforms
      if (U.uSplat && U.uSplat.value && U.uSplat.value.image && U.uSplat.value.image.depth > 1) { sA = U.uSplat.value; sN = U.uSplatN.value; } } });
  const splatKeys = sp && sp.layers ? sp.layers() : [];
  const PV = (typeof PAVEMENT !== 'undefined' && PAVEMENT) || window.PAVEMENT, pav = PV && PV.sharedLib ? PV.sharedLib(THREE, []) : null;
  const fb = gl.createFramebuffer();
  const read = async (tex, layer) => {
    if (!R.properties.get(tex).__webglTexture) R.initTexture(tex);   // not drawn yet: upload it as the roll-out's upload step would
    const t = R.properties.get(tex).__webglTexture; if (!t) return null;
    const w = tex.image.width, h = tex.image.height, px = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fb);
    gl.framebufferTextureLayer(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, t, 0, layer);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return hex(px);
  };
  const out = { splat: { keys: splatKeys.length, same: 0, differ: [] }, pavement: { keys: pav && pav.keys ? pav.keys.length : 0, same: 0, differ: [] } };
  for (const [L, keys, A, N] of [['splat', splatKeys, sA, sN], ['pavement', pav ? pav.keys : [], pav && pav.texA, pav && pav.texN]]) {
    if (!A || !N || !A.image || A.image.depth !== keys.length) { out[L].error = 'no live arrays (' + (A && A.image ? A.image.depth + ' layers for ' + keys.length + ' keys' : 'none') + ')'; continue; }
    for (let i = 0; i < keys.length; i++) {
      const f = FP[L][keys[i]]; if (!f) { out[L].differ.push(keys[i] + ' (no fingerprint)'); continue; }
      const a = await read(A, i), n = await read(N, i);
      if (a === f.A && n === f.N) out[L].same++; else out[L].differ.push(keys[i] + (a !== f.A ? ' A' : '') + (n !== f.N ? ' N' : ''));
    }
  }
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.deleteFramebuffer(fb); R.resetState();
  out.renderer = gl.getParameter(gl.RENDERER);
  out.verdict = (!out.splat.error && !out.pavement.error && !out.splat.differ.length && !out.pavement.differ.length && out.splat.keys > 0 && out.pavement.keys > 0) ? 'SAME TEXELS' : 'DIFFER';
  return JSON.stringify(out);
})()
