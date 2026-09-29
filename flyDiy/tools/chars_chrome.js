#!/usr/bin/env node
// chars_chrome.js - THE CHARACTERS' BUDGET SET IN A REAL BROWSER (AS6, G937). Headless Chromium (Playwright; SwiftShader
// by default, --gl gpu for the box's GPU) boots the garage, then for every character material (tools/_cage_char.js via
// CAGE_CHAR.flatMaterial: the textures the crew wears) draws each texture TEXEL FOR TEXEL off the GL context and scores
// it against the texels the budget was cut to (the page's own canvas decode of the 2048 map, halved by the GPU's 2x2 box
// - in linear light for the diffuse, on the stored values for the normal and the gloss - to the budget's size):
//   default   the texture must be COMPRESSED (the KTX2 file, the transcoder's target on this GL) and its level 0 within
//             GATE KTX2's bar (25 dB rgb; for a normal carrying a gloss, 25 dB on its alpha = the Glossiness map)
//   ktx2=0    the texture must be the 2048 IMAGE (the old path) - and its level 1, the GPU's OWN generateMipmap, is scored
//             against the same cut: what the old path drew wherever it sampled mip 1 or coarser, i.e. the texels the
//             budget's level 0 stands for
//   node tools/_serve.js 8125 &   node tools/chars_chrome.js [--url http://localhost:8125/flyDiy/dev.html] [--query ktx2=0] [--gl gpu]
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const Q = opt('query', '');
const URL = opt('url', 'http://localhost:8125/flyDiy/dev.html') + (Q ? '?' + Q : '');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright')); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- in the page ------------------------------------------------------------------------------------------------
const PAGE = async () => {
  const R = window.FLYDIY_RENDERER, T3 = THREE;
  const TB = CHAR_KTX2_TABLE, reg = CAGE_CHAR.list();
  const S2L = new Float32Array(256).map((_, v) => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
  const L2S = x => Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055));
  const box = (d, w, h, srgb) => { const W = w >> 1, H = h >> 1, o = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 4; c++) { let s = 0;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const v = d[((2 * y + dy) * w + 2 * x + dx) * 4 + c]; s += srgb && c < 3 ? S2L[v] : v; }
      o[(y * W + x) * 4 + c] = srgb && c < 3 ? L2S(s / 4) : Math.round(s / 4); }
    return { w: W, h: H, d: o }; };
  const decode = url => new Promise((res, rej) => { const im = new Image(); im.onload = () => { const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0); res({ w: im.width, h: im.height, d: new Uint8Array(g.getImageData(0, 0, im.width, im.height).data.buffer) }); }; im.onerror = rej; im.src = url; });
  const cut = (im, size, srgb) => { while (im.w > size) im = box(im.d, im.w, im.h, srgb); return im; };
  // one texture's level `lod`, texel for texel, re-encoded to sRGB when the texture is sRGB-typed (the GPU decoded it)
  const quad = new T3.Mesh(new T3.PlaneGeometry(2, 2), new T3.ShaderMaterial({ uniforms: { t: { value: null }, lod: { value: 0 }, enc: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D t; uniform float lod; uniform float enc; varying vec2 vUv;\n' +
      'vec3 enc3(vec3 c){ return mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }\n' +
      'void main(){ vec4 c = textureLod(t, vUv, lod); if (enc > 0.5) c.rgb = enc3(c.rgb); gl_FragColor = c; }', depthTest: false, depthWrite: false }));
  quad.frustumCulled = false;
  const sc = new T3.Scene(); sc.add(quad); const cam = new T3.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const read = (tex, lod, w, h) => {
    const rt = new T3.WebGLRenderTarget(w, h, { depthBuffer: false });
    quad.material.uniforms.t.value = tex; quad.material.uniforms.lod.value = lod; quad.material.uniforms.enc.value = tex.colorSpace === T3.SRGBColorSpace ? 1 : 0;
    const prev = R.getRenderTarget(); R.setRenderTarget(rt); R.render(sc, cam); const px = new Uint8Array(w * h * 4); R.readRenderTargetPixels(rt, 0, 0, w, h, px); R.setRenderTarget(prev); rt.dispose();
    return px;
  };
  // THE MASK (the diffuse's rgb): a 2D canvas stores PREMULTIPLIED alpha, so getImageData hands back rgb 0 under a
  // transparent texel and rounded rgb under a faint one - and the linear-light halving then darkens the cut's edge texels.
  // Only a texel whose cut alpha is 255 (all four 2048 texels opaque) is the browser's true colour: rgb is scored there.
  // (tools/char_tex_budget.js cuts from Pillow's straight-alpha decode, GATE KTX2 check 10 scores every texel.)
  const psnr = (a, b, chs, mask) => { let se = 0, n = 0; for (let i = 0; i < a.length; i += 4) { if (mask && b[i + 3] < 255) continue; for (const c of chs) { const d = a[i + c] - b[i + c]; se += d * d; n++; } } return se ? 10 * Math.log10(255 * 255 * n / se) : 99; };
  const mean = (a, b, c, mask) => { let s = 0, n = 0; for (let i = c; i < a.length; i += 4) { if (mask && b[i - c + 3] < 255) continue; s += a[i] - b[i]; n++; } return n ? Math.abs(s / n) : 0; };
  const out = { rows: [], stats: KTX2.stats(), off: KTX2.off('chars') };
  const mats = [];
  for (const c of reg) c.mats.forEach((m, mi) => mats.push({ c, m, mi, mat: CAGE_CHAR.flatMaterial(c.key, mi) }));
  // every texture landed (an image loaded or a KTX2 transcoded) - the first flatMaterial of a character not seated starts its loads
  for (let i = 0; i < 300; i++) { if (mats.every(x => ['map', 'normalMap'].every(s => !x.mat[s] || x.mat[s].isCompressedTexture || (x.mat[s].image && x.mat[s].image.complete && x.mat[s].image.naturalWidth)))) break; await new Promise(r => setTimeout(r, 200)); }
  const seen = new Set(), dec = {};
  const decodeOnce = u => (dec[u] = dec[u] || decode(u));
  for (const { c, m, mi, mat } of mats) {
    const row = TB[c.key] && TB[c.key].mats[mi];
    for (const [slot, id, srgb] of [['map', m.map, true], ['normalMap', m.nrm, false]]) {
      const t = mat[slot]; if (!t || !id || seen.has(t)) continue; seen.add(t);
      const im = await decodeOnce(c.texs[id]);
      let ref = cut(im, 1024, srgb);
      const gl = slot === 'normalMap' && row && row.gloss && c.texs[m.mr];
      if (gl) { const g = cut(await decodeOnce(c.texs[m.mr]), 1024, false); ref = { w: ref.w, h: ref.h, d: new Uint8Array(ref.d) }; for (let i = 3; i < ref.d.length; i += 4) ref.d[i] = g.d[i - 2]; }
      const comp = !!t.isCompressedTexture, W = t.image.width, lod = Math.log2(W / ref.w);
      const px = read(t, lod, ref.w, ref.h);
      out.rows.push({ tex: c.texs[id].split('/').pop(), kind: comp ? 'compressed (format ' + t.format + ')' : 'image ' + W + 'x' + t.image.height, lod,
        rgb: +psnr(px, ref.d, [0, 1, 2], srgb).toFixed(2), a: comp && (gl || srgb) ? +psnr(px, ref.d, [3]).toFixed(2) : null, mean: +Math.max(mean(px, ref.d, 0, srgb), mean(px, ref.d, 1, srgb), mean(px, ref.d, 2, srgb)).toFixed(2) });
    }
  }
  const r = out.rows;
  out.worst = r.reduce((w, x) => (x.rgb < w.rgb ? x : w), { rgb: 99 });
  out.verdict = r.length && r.every(x => x.rgb >= 25 && (x.a == null || x.a >= 25) && x.mean <= 1.5) ? 'WITHIN FLOORS' : 'BELOW';
  return JSON.stringify(out);
};

(async () => {
  const exe = opt('chrome', ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p)));
  const args = (opt('gl', 'swiftshader') === 'gpu' ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']).concat(['--js-flags=--max-old-space-size=8192']);
  const browser = await pw.chromium.launch({ executablePath: exe, headless: true, args });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const logs = [], t0 = Date.now(), el = () => Math.round((Date.now() - t0) / 1000) + ' s';
  // a software GL redraws the garage every frame and starves every call made from here: once the garage is up, hold
  // the page's frames (the readback draws its own) - ktx2_chrome.js's way
  await page.addInitScript(() => { const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = cb => (window.__HOLD ? 0 : raf(cb)); });
  page.on('console', m => { const t = m.text(); if (m.type() === 'error' || /ktx2|KTX2|char /.test(t)) logs.push(m.type() + ': ' + t.slice(0, 300)); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  const tryEv = async expr => { try { return await page.evaluate(expr); } catch (e) { return 'ERR ' + e.message.split('\n')[0]; } };
  await page.goto(URL, { waitUntil: 'load', timeout: 180000 });
  for (let i = 0; i < 300; i++) {
    await sleep(2000);
    if (await tryEv("!!window.BOOT && BOOT.state === 'gone' && !!window.CAGE_CHAR")) break;
    await tryEv("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click()); return 1;})()");
  }
  console.log('garage up', el());
  await sleep(20000);                                   // the crew's maps land (the loading screen waited for them)
  await tryEv('window.__HOLD = true');
  await sleep(3000);
  const r = await tryEv('(' + PAGE.toString() + ')()');
  let v = null; try { v = JSON.parse(r); } catch (e) { console.log('page ->', r); }
  if (v) { for (const x of v.rows) console.log(`  ${x.tex.padEnd(46)} ${x.kind.padEnd(28)} lod ${x.lod}  rgb ${x.rgb} dB${x.a != null ? '  a ' + x.a : ''}  mean ${x.mean}`);
    console.log('  KTX2 ' + JSON.stringify(v.stats) + '; off(chars): ' + v.off); }
  console.log('logs (' + logs.length + '):\n  ' + logs.slice(0, 20).join('\n  '));
  await browser.close();
  const want = /ktx2=0/.test(Q) ? 'image' : 'compressed';
  const ok = v && v.verdict === 'WITHIN FLOORS' && v.rows.every(x => x.kind.startsWith(want));
  console.log('CHARS CHROME: ' + (ok ? 'PASS' : 'FAIL') + ' (' + want + ' textures expected; ' + (v ? v.rows.length + ' textures, worst rgb ' + v.worst.rgb + ' dB [' + v.worst.tex + ']' : 'no result') + '; ' + el() + ')');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
