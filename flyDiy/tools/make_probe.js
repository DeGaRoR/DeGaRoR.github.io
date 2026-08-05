// Renderer probe generator (dev instrument, not part of the artifact).
//
// Why it exists: the agent Browser pane stops compositing when it is not
// displayed, which throttles requestAnimationFrame to nothing — the sim boots,
// never draws a frame, and every live measurement silently reads zero. This
// writes tools/_probe.html: dev.html's exact markup and script list, plus
//   - an rAF shim (frames are pumped by hand through window.__pump)
//   - an error trap, so a shader that fails to compile is readable
//   - draw-call / triangle counters wrapped around the GL draw entry points
// and, with --base, a second page (_probe_base.html) running the PREVIOUS
// committed render_world.js so a change can be measured against itself on the
// same machine at the same resolution instead of against a remembered number.
//
//   node tools/make_probe.js            -> tools/_probe.html
//   node tools/make_probe.js --base     -> also _probe_base.html + _base_render_world.js
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.join(__dirname, '..');

const HEAD = `
<script>
window.__err = [];
window.addEventListener('error', e => __err.push('ERR ' + e.message +
  (e.error && e.error.stack ? '\\n' + e.error.stack.split('\\n').slice(0, 4).join('\\n') : '')));
{ const ce = console.error, cw = console.warn;
  console.error = (...a) => { __err.push('console.error: ' + a.map(String).join(' ')); ce(...a); };
  console.warn = (...a) => { __err.push('console.warn: ' + a.map(String).join(' ')); cw(...a); }; }
// hand-pumped frames
let _q = [];
window.requestAnimationFrame = f => _q.push(f);
window.__pump = (n, ms) => {
  const t0 = performance.now();
  for (let i = 0; i < (n || 1); i++) { const q = _q; _q = []; for (const f of q) f(performance.now()); }
  return performance.now() - t0;
};
// GL counters
window.__gl = { on: false, calls: 0, tris: 0 };
{ const tri = c => c / 3;
  const hook = (proto, name, count) => {
    if (!proto || !proto[name]) return;
    const f = proto[name];
    proto[name] = function (...a) {
      if (__gl.on) { __gl.calls++; __gl.tris += count(a); }
      return f.apply(this, a);
    };
  };
  for (const P of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!P) continue;
    hook(P.prototype, 'drawElements', a => tri(a[1]));
    hook(P.prototype, 'drawArrays', a => tri(a[2]));
    hook(P.prototype, 'drawElementsInstanced', a => tri(a[1]) * a[4]);
    hook(P.prototype, 'drawArraysInstanced', a => tri(a[2]) * a[3]);
    // WebGL1 instancing arrives through an extension object, not the context
    const ge = P.prototype.getExtension;
    P.prototype.getExtension = function (n) {
      const e = ge.call(this, n);
      if (e && n === 'ANGLE_instanced_arrays' && !e.__hooked) {
        e.__hooked = true;
        hook(e, 'drawElementsInstancedANGLE', a => tri(a[1]) * a[4]);
        hook(e, 'drawArraysInstancedANGLE', a => tri(a[2]) * a[3]);
      }
      return e;
    };
  }
}
<\/script>
`;

// buildWorldScene's return value lives in app.js's closure; wrapping the global
// between the two script tags is the only seam that catches it, and it is what
// lets the probe reach WF.treeLod to force the whole forest to one LOD tier.
const CATCH = '<script>{ const _b = buildWorldScene;\n' +
  'window.buildWorldScene = function (scene, world, renderer, camera) {\n' +
  '  Object.assign(window, { __scene: scene, __world: world, __renderer: renderer, __camera: camera });\n' +
  '  return window.__WF = _b.apply(this, arguments); }; }<\/script>\n';

// which viewer sources `--base` pins to the previous commit. Both, because a
// renderer change and a material change land on the same frame: pinning only
// one gives a chimera that was never a real build.
const BASE_OF = ['src/viewer/render_world.js', 'src/viewer/app.js'];

function build(name, swap) {
  let h = fs.readFileSync(path.join(root, 'dev.html'), 'utf8');
  h = h.replace(/(src|href)="(?!https?:|\/)/g, '$1="../');
  // CATCH goes in BEFORE the base swap, or the anchor it keys on has already
  // been renamed and the base page silently loses every handle.
  h = h.replace('<script src="../src/viewer/app.js">', CATCH + '<script src="../src/viewer/app.js">');
  if (swap) for (const f of BASE_OF) h = h.replace('../' + f, swap(f));
  h = h.replace('</head>', HEAD + '</head>');
  fs.writeFileSync(path.join(__dirname, name), h);
  console.log('wrote tools/' + name + (swap ? '  (viewer <- HEAD)' : ''));
}

const baseName = f => '_base_' + path.basename(f);
build('_probe.html', null);
if (process.argv.includes('--base')) {
  for (const f of BASE_OF) {
    const prev = cp.execSync('git show HEAD:flyDiy/' + f,
      { cwd: path.join(root, '..'), maxBuffer: 1 << 26 });
    fs.writeFileSync(path.join(__dirname, baseName(f)), prev);
  }
  build('_probe_base.html', baseName);
}
