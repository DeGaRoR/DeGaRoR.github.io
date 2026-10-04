#!/usr/bin/env node
// cold_links_bench.js - THE HEAVY PROGRAMS LINKED ALONE, COLD (COLD-LINKS, G1310). A cold first visit waits ~50 s on the
// ground's programs (CESSNA-LINKS G1221: seven world programs link in 40-58 s each under ANGLE/D3D11 - FXC's compile, on
// the GPU process's threads). This rig links ONLY those programs' exact sources (vertex + fragment, as three hands them
// to the driver - tools/perf/cold_links_src.js pulls them out of the page in node) in a FRESH Chrome profile with the
// GPU disk cache off, all issued at once as the game issues them (KHR_parallel_shader_compile: each one's completion
// polled, never blocking), and prints per program: the link time, LINK_STATUS (a program that fails to link is a
// fake-fast time - G568's grey ground), and the translated (HLSL) length. A variant of the ground shader is a second
// sources file: the same rig, minutes apart. Not a load: no game, no world - the link alone.
// Usage: node tools/perf/cold_links_bench.js --progs <sources.json> [--progs2 <sources.json>] [--udd D:/clb1] [--out <file.json>]
//        (GPU lock first: it is timed; --udd a SHORT fresh path; no --help - an unknown flag runs it)
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
process.env.MB_CHROME_FLAGS = ((process.env.MB_CHROME_FLAGS || '') + ' --disable-gpu-shader-disk-cache').trim();
const MB = require('../master_bench.js');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const FILES = [opt('progs', null), opt('progs2', null)].filter(Boolean);
if (!FILES.length) { console.error('cold_links_bench: --progs <sources.json> is required'); process.exit(2); }
const OUT = opt('out', null);

// the page side: every program compiled and linked at once, its completion polled (0x91B1 COMPLETION_STATUS_KHR)
const RUN = progs => `(async () => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; document.body.appendChild(cv);
  const gl = cv.getContext('webgl2', { antialias: false }); if (!gl) return JSON.stringify({ err: 'no webgl2' });
  const par = gl.getExtension('KHR_parallel_shader_compile'), dbg = gl.getExtension('WEBGL_debug_shaders');
  const P = ${JSON.stringify(progs)}, rows = [];
  const t0 = performance.now();
  for (const p of P) {
    const vs = gl.createShader(gl.VERTEX_SHADER), fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(vs, p.vs); gl.shaderSource(fs, p.fs); gl.compileShader(vs); gl.compileShader(fs);
    const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs);
    const t = performance.now(); gl.linkProgram(pr);
    rows.push({ name: p.name, pr, vs, fs, t, ms: -1 });
  }
  const issued = performance.now() - t0;
  for (let n = 0; n < 24000 && rows.some(r => r.ms < 0); n++) {
    await new Promise(r => setTimeout(r, 25));
    const now = performance.now();
    for (const r of rows) if (r.ms < 0 && (!par || gl.getProgramParameter(r.pr, 0x91B1))) r.ms = now - r.t;
  }
  return JSON.stringify({ issued: Math.round(issued), renderer: (gl.getExtension('WEBGL_debug_renderer_info') && gl.getParameter(0x9246)) || '', rows: rows.map(r => ({
    name: r.name, ms: Math.round(r.ms), ok: !!gl.getProgramParameter(r.pr, gl.LINK_STATUS), log: (gl.getProgramInfoLog(r.pr) || '').slice(0, 300),
    vsOk: !!gl.getShaderParameter(r.vs, gl.COMPILE_STATUS), fsOk: !!gl.getShaderParameter(r.fs, gl.COMPILE_STATUS), fsLog: (gl.getShaderInfoLog(r.fs) || '').slice(0, 300),
    hlslFs: dbg ? (dbg.getTranslatedShaderSource(r.fs) || '').length : -1, hlslVs: dbg ? (dbg.getTranslatedShaderSource(r.vs) || '').length : -1 })) });
})()`;

(async () => {
  const R = { runs: [] };
  for (let fi = 0; fi < FILES.length; fi++) {
    const progs = JSON.parse(fs.readFileSync(path.resolve(FILES[fi]), 'utf8'));
    const udd = path.resolve(opt('udd', path.join(os.tmpdir(), 'clb')) + (FILES.length > 1 ? '_' + fi : ''));
    const b = await MB.browser(udd);
    try {
      await sleep(1500);
      const t = Date.now();
      const d = JSON.parse(await b.ev(RUN(progs.map(p => ({ name: p.name, vs: p.vs, fs: p.fs }))), 900000));
      d.file = FILES[fi]; d.wallS = +((Date.now() - t) / 1000).toFixed(1); d.udd = udd; R.runs.push(d);
      console.log('cold_links_bench ' + FILES[fi] + ' (' + d.renderer + '): wall ' + d.wallS + ' s');
      for (const r of d.rows) console.log('  ' + (r.ms / 1000).toFixed(1).padStart(6) + ' s  ' + (r.ok ? 'linked' : 'FAILED ') + '  hlsl fs ' + String(r.hlslFs).padStart(7) + '  ' + r.name + (r.ok ? '' : '  ' + r.log + ' ' + r.fsLog));
    } finally { await b.close(); }
  }
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
