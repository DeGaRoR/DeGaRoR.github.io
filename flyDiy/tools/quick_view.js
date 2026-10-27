#!/usr/bin/env node
// quick_view.js - A LOOK AT A BUILD WITHOUT THE GAME (G3578, the user 27 Oct: "a super simple renderer for real quick
// visualization ... without booting the game"). A TOOL, not a gate.
//
// The build goes through the page's own load door (tools/_load_build.js: the editor's layers draw it headless, as the
// garage would), the scene's visible meshes come out as one triangle soup (tools/_quick_view_probe.js) and land in ONE
// self-contained HTML file: a small WebGL2 viewer, no library, no server - drag to orbit, wheel to zoom, shift-drag (or
// the right button) to pan, the view buttons for side / top / front / three-quarter / the four at once.
//
//   node tools/quick_view.js [build.json] [--out=<file.html>] [--png=<file.png>] [--cage=k=v,k=v] [--size=1400x900]
//
//   build.json  a saved build (the {spec} envelope the garage writes); default tools/fixtures/dc3_2026-10.json
//   --out       the viewer (default reports/quick_view/<build name>.html - not committed: reports/ is a scratch)
//   --png       also the four views at once as a picture (the pre-installed Chromium, headless, through Playwright)
//   --cage      cage rows set first (a what-if without writing a file)
//   (the page opens on the view its hash names: #three #side #top #front #grid; window.__qv = { cam, draw, set } for a script)
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const file = argv.find(a => !a.startsWith('--')) || path.join(T, 'fixtures', 'dc3_2026-10.json');

const j = JSON.parse(fs.readFileSync(file, 'utf8'));
const spec = j.spec && typeof j.spec === 'object' ? j.spec : j;
const cage = opt('cage');
if (cage) for (const kv of cage.split(',')) { const [k, v] = kv.split('='); spec.cage[k] = isNaN(+v) ? v : +v; }
const t0 = Date.now();
// the page chain's own child (tools/_load_build.js --child, as gameSpecFull runs it), its stdout to a FILE: the scene is
// megabytes, and the child exits straight after writing - a pipe would be cut short (a file write is synchronous)
const os = require('os'), tmp = path.join(os.tmpdir(), 'quick_view_' + process.pid + '.json'), fd = fs.openSync(tmp, 'w');
const ch = require('child_process').spawnSync(process.execPath, ['--max-old-space-size=4096', path.join(T, '_load_build.js'), '--child'],
  { input: JSON.stringify(spec), stdio: ['pipe', fd, 'pipe'], cwd: ROOT, encoding: 'utf8',
    env: Object.assign({}, process.env, { FLYDIY_JOIN_PROBE: path.join(T, '_quick_view_probe.js') }) });
fs.closeSync(fd);
let res = null;
try { const s = fs.readFileSync(tmp, 'utf8'); res = JSON.parse(s.slice(s.indexOf('\u0001') + 1)); } catch (e) {}
try { fs.unlinkSync(tmp); } catch (e) {}
const P = res && res.probe;
if (!P || typeof P === 'string' || !P.V) {
  console.error('quick_view: the scene did not come out (exit ' + ch.status + ') - ' + (typeof P === 'string' ? P : String(ch.stderr || '').split('\n').slice(-6).join(' | ')));
  process.exit(1);
}

// positions quantized to 16 bits over the scene's box (a 20 m aeroplane: 0.3 mm steps)
const V = Float64Array.from(P.V, x => x / 1e4), nV = V.length / 3, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < nV; i++) for (let a = 0; a < 3; a++) { const x = V[3 * i + a]; if (x < lo[a]) lo[a] = x; if (x > hi[a]) hi[a] = x; }
const mid = lo.map((l, a) => (l + hi[a]) / 2), half = Math.max(...lo.map((l, a) => (hi[a] - l) / 2), 1e-6);
const Q = new Int16Array(3 * nV);
for (let i = 0; i < 3 * nV; i++) Q[i] = Math.round((V[i] - mid[i % 3]) / half * 32767);
// one gzipped blob, the triangles first (4-byte aligned), then the positions and the colours; the page unpacks it with
// the browser's own DecompressionStream
const bytes = a => Buffer.from(a.buffer, a.byteOffset, a.byteLength);
const I32 = new Uint32Array(P.I), C8 = Uint8Array.from(P.C);
const blob = require('zlib').gzipSync(Buffer.concat([bytes(I32), bytes(Q), bytes(C8)]), { level: 9 }).toString('base64');
const name = (j.name || path.basename(file, '.json')).replace(/[^\w .()-]/g, '');
const data = { name, mid, half, size: hi.map((h, a) => +(h - lo[a]).toFixed(2)), nOpaque: P.nOpaque,
               nI: I32.length, nV, blob };

const out = opt('out', path.join(ROOT, 'reports', 'quick_view', name.replace(/[^\w-]+/g, '_') + '.html'));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, page().split('__TITLE__').join(name).replace('__DATA__', () => JSON.stringify(data)));
console.log('quick_view: ' + name + ' - ' + P.parts + ' parts, ' + P.trisIn + ' triangles drawn as ' + (P.I.length / 3) +
            ', ' + nV + ' vertices, box ' + data.size.join(' x ') + ' (scene units); ' + (fs.statSync(out).size / 1e6).toFixed(1) +
            ' MB, ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s\n  ' + out);

const png = opt('png');
if (png) shoot(out, png, opt('size', '1400x900')).catch(e => { console.error('quick_view: no picture - ' + e.message); process.exit(1); });

async function shoot(html, pngFile, size) {
  const [w, h] = size.split('x').map(Number);
  const { chromium } = require('playwright');
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: w, height: h } });
  await pg.goto('file://' + path.resolve(html) + '#grid');
  await pg.waitForFunction(() => window.__qvReady === true || typeof window.__qvError === 'string', null, { timeout: 120000 });
  const err = await pg.evaluate(() => window.__qvError);
  if (err) throw new Error(err);
  await pg.screenshot({ path: pngFile });
  await b.close();
  console.log('  ' + pngFile);
}

// ---- THE VIEWER (one page, WebGL2, no library) ---------------------------------------------------------------------
// The scene's axes as the editor's: y up, z the fuselage (the nose +z), x the span. Flat shading from the screen-space
// derivatives (no normals shipped), lit from the eye and from above, both faces (the meshes' winding is not one rule).
function page() { return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>__TITLE__</title>
<style>
  :root { --bg: #e9ecef; --ink: #1d232a; --chip: #ffffffcc; --line: #c5ccd3; }
  @media (prefers-color-scheme: dark) { :root { --bg: #1b1f24; --ink: #e6e9ec; --chip: #2a3038cc; --line: #3a424c; } }
  html, body { margin: 0; height: 100%; background: var(--bg); color: var(--ink); font: 13px/1.3 system-ui, sans-serif; overflow: hidden; }
  canvas { display: block; width: 100vw; height: 100vh; touch-action: none; }
  #bar { position: fixed; left: 12px; top: 12px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; max-width: calc(100vw - 24px); }
  #bar b { margin-right: 6px; }
  button { font: inherit; color: inherit; background: var(--chip); border: 1px solid var(--line); border-radius: 6px; padding: 4px 9px; cursor: pointer; }
  .lab { position: fixed; font-weight: 600; opacity: .7; pointer-events: none; }
</style></head><body>
<canvas id="c"></canvas>
<div id="bar"><b>__TITLE__</b>
  <button data-v="three">3/4</button><button data-v="side">side</button><button data-v="top">top</button>
  <button data-v="front">front</button><button data-v="grid">all four</button><button id="xr">x-ray</button></div>
<script>
const D = __DATA__;
const cv = document.getElementById('c'), gl = cv.getContext('webgl2', { antialias: true, preserveDrawingBuffer: true });
(async () => { try {
  if (!gl) throw new Error('no WebGL2');
  const b = atob(D.blob), z = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) z[i] = b.charCodeAt(i);
  const raw = await new Response(new Blob([z]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  const I = new Uint32Array(raw, 0, D.nI), Qv = new Int16Array(raw, 4 * D.nI, 3 * D.nV), Cv = new Uint8Array(raw, 4 * D.nI + 6 * D.nV, 4 * D.nV);
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o);
    if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, \`#version 300 es
    in vec3 q; in vec4 c; uniform mat4 mvp; uniform vec3 mid; uniform float half_;
    out vec3 wp; out vec4 col;
    void main() { wp = mid + q * half_; col = c; gl_Position = mvp * vec4(wp, 1.0); }\`));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, \`#version 300 es
    precision highp float; in vec3 wp; in vec4 col; uniform vec3 eye; uniform float xray; out vec4 o;
    void main() {
      vec3 n = normalize(cross(dFdx(wp), dFdy(wp))), e = normalize(eye - wp);
      if (dot(n, e) < 0.0) n = -n;
      float l = 0.38 + 0.47 * max(dot(n, e), 0.0) + 0.22 * max(dot(n, normalize(vec3(0.3, 1.0, 0.2))), 0.0);
      o = vec4(col.rgb * l, xray > 0.5 ? 0.18 : col.a);
    }\`));
  gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
  gl.useProgram(pr);
  const buf = (target, data) => { const b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, data, gl.STATIC_DRAW); return b; };
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  buf(gl.ARRAY_BUFFER, Qv);
  let L = gl.getAttribLocation(pr, 'q'); gl.enableVertexAttribArray(L); gl.vertexAttribPointer(L, 3, gl.SHORT, true, 0, 0);
  buf(gl.ARRAY_BUFFER, Cv);
  L = gl.getAttribLocation(pr, 'c'); gl.enableVertexAttribArray(L); gl.vertexAttribPointer(L, 4, gl.UNSIGNED_BYTE, true, 0, 0);
  buf(gl.ELEMENT_ARRAY_BUFFER, I);
  const U = n => gl.getUniformLocation(pr, n);
  gl.uniform3fv(U('mid'), D.mid); gl.uniform1f(U('half_'), D.half);

  // the camera: an orbit round a target (yaw about y, pitch, distance)
  const VIEWS = { three: [-0.9, 0.38], side: [-Math.PI / 2, 0], top: [-Math.PI / 2, Math.PI / 2 - 1e-3], front: [0, 0.05] };
  // each view framed on what it shows: [across, up, depth] of the box seen from there (the 3/4 on its diagonal)
  const [sx, sy, sz] = D.size, dg = Math.hypot(sx, sz);
  const EXT = { three: [0.86 * dg, 0.55 * dg, dg], side: [sz, sy, sx], top: [sx, sz, sy], front: [sx, sy, sz] };
  const fit = (n, aspect) => { const t = Math.tan(0.31), e = EXT[n]; return 1.08 * Math.max(e[1] / 2 / t, e[0] / 2 / t / aspect) + e[2] / 2; };
  const cam = { yaw: VIEWS.three[0], pitch: VIEWS.three[1], dist: fit('three', innerWidth / innerHeight), tgt: D.mid.slice() };
  let grid = location.hash === '#grid', xray = false;
  const persp = (f, a, n, fa) => { const t = 1 / Math.tan(f / 2); return [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]; };
  const look = (e, t) => { const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], nrm = a => { const l = Math.hypot(...a); return a.map(x => x / l); };
    const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const z = nrm(sub(e, t)), x = nrm(cr(Math.abs(z[1]) > 0.999 ? [0, 0, -1] : [0, 1, 0], z)), y = cr(z, x);
    return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dt(x, e), -dt(y, e), -dt(z, e), 1]; };
  const mul = (a, b) => { const o = new Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; };
  const eyeOf = c => [c.tgt[0] + c.dist * Math.cos(c.pitch) * Math.sin(c.yaw), c.tgt[1] + c.dist * Math.sin(c.pitch), c.tgt[2] + c.dist * Math.cos(c.pitch) * Math.cos(c.yaw)];
  const labs = [];
  const label = (txt, x, y) => { const d = document.createElement('div'); d.className = 'lab'; d.textContent = txt; d.style.left = x + 'px'; d.style.top = y + 'px'; document.body.appendChild(d); labs.push(d); };
  function drawOne(c, x, y, w, h) {
    gl.viewport(x, y, w, h); gl.scissor(x, y, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const e = eyeOf(c);
    gl.uniformMatrix4fv(U('mvp'), false, mul(persp(0.62, w / h, D.half * 0.05, D.half * 20), look(e, c.tgt)));
    gl.uniform3fv(U('eye'), e); gl.uniform1f(U('xray'), xray ? 1 : 0);
    if (xray) { gl.enable(gl.BLEND); gl.depthMask(false); gl.drawElements(gl.TRIANGLES, I.length, gl.UNSIGNED_INT, 0); gl.depthMask(true); return; }
    gl.disable(gl.BLEND); gl.drawElements(gl.TRIANGLES, D.nOpaque, gl.UNSIGNED_INT, 0);
    if (I.length > D.nOpaque) { gl.enable(gl.BLEND); gl.depthMask(false);
      gl.drawElements(gl.TRIANGLES, I.length - D.nOpaque, gl.UNSIGNED_INT, D.nOpaque * 4); gl.depthMask(true); }
  }
  function draw() {
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(cv.clientWidth * dpr), H = Math.round(cv.clientHeight * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const bg = getComputedStyle(document.body).backgroundColor.match(/\\d+/g).map(v => v / 255);
    gl.clearColor(bg[0], bg[1], bg[2], 1); gl.enable(gl.DEPTH_TEST); gl.enable(gl.SCISSOR_TEST);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    labs.splice(0).forEach(d => d.remove());
    if (!grid) return drawOne(cam, 0, 0, W, H);
    const w = Math.floor(W / 2), h = Math.floor(H / 2), names = ['three', 'side', 'top', 'front'];
    names.forEach((n, i) => { const c = { yaw: VIEWS[n][0], pitch: VIEWS[n][1], dist: fit(n, w / h), tgt: D.mid };
      const x = (i % 2) * w, y = i < 2 ? H - h : 0; drawOne(c, x, y, w, h);
      label(n === 'three' ? '3/4' : n, x / dpr + 14, (H - y - h) / dpr + (i < 2 ? 48 : 12)); });
  }
  const set = n => { if (n === 'grid') grid = true; else { grid = false; cam.yaw = VIEWS[n][0]; cam.pitch = VIEWS[n][1]; cam.dist = fit(n, innerWidth / innerHeight); cam.tgt = D.mid.slice(); } draw(); };
  document.querySelectorAll('[data-v]').forEach(b => b.onclick = () => set(b.dataset.v));
  document.getElementById('xr').onclick = () => { xray = !xray; draw(); };
  let drag = null;
  cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, pan: e.shiftKey || e.button === 2 }; cv.setPointerCapture(e.pointerId); if (grid) { grid = false; } });
  cv.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if (drag.pan) { const k = cam.dist / cv.clientHeight * 0.75, cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
      cam.tgt = [cam.tgt[0] - k * dx * cy, cam.tgt[1] + k * dy, cam.tgt[2] + k * dx * sy]; }
    else { cam.yaw -= dx * 0.008; cam.pitch = Math.max(-1.55, Math.min(1.55, cam.pitch + dy * 0.008)); }
    draw(); });
  cv.addEventListener('pointerup', () => drag = null);
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('wheel', e => { e.preventDefault(); cam.dist *= Math.exp(e.deltaY * 0.0012); draw(); }, { passive: false });
  window.addEventListener('resize', draw);
  const h0 = location.hash.slice(1);
  if (VIEWS[h0]) set(h0); else draw();
  window.__qv = { cam, draw, set }; window.__qvReady = true;
} catch (e) { window.__qvError = String(e && e.message || e); document.body.insertAdjacentHTML('beforeend', '<p style="padding:60px 16px">' + window.__qvError + '</p>'); } })();
</script></body></html>`; }
