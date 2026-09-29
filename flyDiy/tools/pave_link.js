// pave_link.js - WHAT MAKES THE PAVEMENT PROGRAM SLOW TO LINK (AS4b G928), for rollout_perf's --eval:
//   node tools/rollout_perf.js --port <p> --udd <dir> --secs 10 --q 'pave=new' --eval @tools/pave_link.js --eval-ms 900000
// One expression. The page's own pavement programs (the table's 'pavement:T', the old 'pavement:', whichever were
// built) are read back off the GL (their attached shaders' sources: the exact GLSL three handed ANGLE), a NONCE comment
// is added so no cache can answer, and each is compiled and linked on a fresh program, timed to completion
// (KHR_parallel_shader_compile's COMPLETION_STATUS polled, else the LINK_STATUS wait). Then VARIANTS of the table's
// fragment text, one suspect cut at a time (the text keeps compiling - it is a timing probe, not a picture):
//   marks   pvMarks' loops emptied            keep   pvKeep / pvInside's loops emptied
//   rows    every row read (texelFetch) replaced by a constant
// Also: the same source linked twice (does the process's own cache answer the second?).
(async () => {
  const W = window.WORLD, R = W.renderer, gl = R.getContext();
  const par = gl.getExtension('KHR_parallel_shader_compile');
  const raf0 = () => new Promise(r => requestAnimationFrame(() => r()));
  const srcOfPr = pr => { const sh = gl.getAttachedShaders(pr.program) || []; const o = {}; for (const s of sh) o[gl.getShaderParameter(s, gl.SHADER_TYPE) === gl.VERTEX_SHADER ? 'vs' : 'fs'] = gl.getShaderSource(s); return o; };
  const grab = () => { const o = []; for (const pr of R.info.programs) { const k = String(pr.cacheKey); if (/pavement:/.test(k) && (!pr.isReady || pr.isReady())) o.push({ table: /pavement:T/.test(k), key: k.slice(0, 30), src: srcOfPr(pr) }); } return o; };
  const PV = window.PAVEMENT || (typeof PAVEMENT !== 'undefined' ? PAVEMENT : null);
  let progs = grab();
  // the other mode's program too: switched once, its program read when linked, switched back
  if (PV && PV.ab && !progs.some(p => !p.table)) { const was = PV.MODE.table ? 'new' : 'old'; PV.ab(was === 'new' ? 'old' : 'new'); for (let i = 0; i < 1200 && !grab().some(p => p.table !== (was === 'new')); i++) await raf0(); progs = progs.concat(grab().filter(p => !progs.some(q => q.key === p.key))); PV.ab(was); }
  if (!progs.length) return { err: 'no pavement program built' };
  const srcOf = p => p.src;
  const nonce = (src, tag) => src.replace(/\n/, '\n// nonce ' + tag + ' ' + Math.random() + '\n');
  const raf = () => new Promise(r => requestAnimationFrame(() => r()));
  async function link(vs, fs) {
    const t0 = performance.now();
    const v = gl.createShader(gl.VERTEX_SHADER), f = gl.createShader(gl.FRAGMENT_SHADER), p = gl.createProgram();
    gl.shaderSource(v, vs); gl.compileShader(v); gl.shaderSource(f, fs); gl.compileShader(f);
    gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
    if (par) while (!gl.getProgramParameter(p, par.COMPLETION_STATUS_KHR)) await raf();
    const ok = gl.getProgramParameter(p, gl.LINK_STATUS), ms = Math.round(performance.now() - t0);
    const log = ok ? '' : (gl.getShaderInfoLog(f) || gl.getProgramInfoLog(p) || '').slice(0, 300);
    gl.deleteProgram(p); gl.deleteShader(v); gl.deleteShader(f);
    return { ms, ok, log };
  }
  const out = { parallel: !!par, programs: [] };
  for (const p of progs) {
    const s = srcOf(p);
    const r1 = await link(nonce(s.vs, 'a'), nonce(s.fs, 'a'));
    out.programs.push({ table: p.table, key: p.key, fsChars: s.fs.length, vsChars: s.vs.length, coldMs: r1.ms, ok: r1.ok, log: r1.log });
  }
  const T = progs.find(p => p.table);
  if (T) {
    const s = srcOf(T), fs = s.fs, vs = nonce(s.vs, 'v');
    const same = nonce(fs, 'same');
    out.twice = [(await link(vs, same)).ms, (await link(vs, same)).ms];
    const body = (txt, head) => { const i = txt.indexOf(head); if (i < 0) return null; let d = 0, j = txt.indexOf('{', i); for (let k = j; k < txt.length; k++) { if (txt[k] === '{') d++; else if (txt[k] === '}' && --d === 0) return [j, k + 1]; } return null; };
    const cut = (txt, head, repl) => { const b = body(txt, head); return b ? txt.slice(0, b[0]) + repl + txt.slice(b[1]) : null; };
    const V = {};
    V.marks = cut(fs, 'vec3 pvMarks(vec2 p, vec2 fw)', '{ return vec3(0.0); }');
    V.keep = (t => t && cut(t, 'float pvInside(vec2 p)', '{ return -1e3; }'))(cut(fs, 'float pvKeep(vec2 p)', '{ return 1.0; }'));
    const DEF = '#define PVT(i) texelFetch(uPavT, ivec2(i, gPavRow), 0)', CONST = '#define PVT(i) vec4(0.5 + 0.0 * float(i))';
    V.rows = fs.indexOf(DEF) >= 0 ? fs.replace(DEF, CONST) : null;
    V.all3 = (t => t && t.replace(DEF, CONST))((t => t && cut(t, 'float pvInside(vec2 p)', '{ return -1e3; }'))(cut(V.marks || fs, 'float pvKeep(vec2 p)', '{ return 1.0; }')));
    out.variants = {};
    for (const [k, t] of Object.entries(V)) { if (!t) { out.variants[k] = 'anchor not found'; continue; } const r = await link(vs, nonce(t, k)); out.variants[k] = { ms: r.ms, ok: r.ok, log: r.log, rowReads: (t.match(/PVT\(/g) || []).length }; }
    out.rowReadSites = (fs.match(/PVT\(/g) || []).length;
  }
  return out;
})()
