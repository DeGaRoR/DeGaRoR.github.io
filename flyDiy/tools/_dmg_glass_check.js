#!/usr/bin/env node
// _dmg_glass_check.js - GATE DMGGLASS (G3623, DMG-GLASS): THE IMPACT MARK ON THE GLAZING. The user, 27 Oct: "never seen an
// impact mark on glass". A star of cracks at the point of a pane where the airframe hit it (src/viewer/dmg_glass.js), drawn
// by the glass's own shader (aeroskin.js AEROGLASS_HOOK, the crack block), off the damage state the page already holds.
//
//   S  THE SOURCE: aeroskin.js AERO_GLASS_CRACK_FS is dmg_glass.js GLSL_CRACK, textually (--sync rewrites it); the glass
//      hook splices it, calls dgCrack in its roughness and adds the scatter at its output; the aeroplane-wide block carries
//      uCrackN / uCrackP[MAX] / uCrackQ[MAX] (none drawn by default); the manifest loads dmg_glass.js before app.js; app.js
//      runs glassMarks after the pose (uCraftInv this frame's) and exposes FLYDIY_GLASS / FLYDIY_GLASS_TEST.
//   U  THE RULES (pure): no mark under SET_LIGHT (an elastic flex, a hard landing), the full star at SET_HARD, broken = 1;
//      marks never move nor shrink; marks on one pane within MERGE are one; at most MAX, the strongest; pack() fills the
//      uniforms and clears the rest; the mask is 0 past its reach, a light star has no arcs and no crazed core, a broken
//      member's has the core; a line under a pixel fades (its share of the pixel), it never fattens.
//   G  THE MIRROR (headless Chromium, WebGL2 on SwiftShader - NOT RUN without it, said so, never a pass): GLSL_CRACK run
//      in a real GLSL ES 3.00 compiler (transform feedback) on 24000 samples against crackJS: |d| > 0.05 on under 0.3 %.
//   R  THE PAGE'S MATERIAL (the same Chromium): the real aeroGlass (vendor three r186 + aeroskin.js) on a 1 m pane under a
//      sun: links; with no mark the picture is the same bits before and after a mark came and went; a broken member's mark
//      brightens 1500 px or more and darkens none (the glass only adds light); a mark 5 cm off the pane's plane, or facing
//      away from it, changes not one pixel; a mark costs no program (renderer.info.programs the same). --png <file> keeps
//      the marked picture.
//   T  THE TRIGGERS on the user's validated builds (the Cub, the Jodel, the metal Cessna), node only, the page's own path:
//      the panes are the flown snapshot's glass groups (tools/_dmg_wall_study.js prepare: windshield, the cabin windows,
//      a drawn pane, the skylights) in the design frame, the members the def's (not gear, not wires) at their rest
//      midpoints; every frame the damage hop the page runs inline (sim_host.js simDmgHop -> sim_view.js simViewDmgApply)
//      and, at each event (vB | sS moved), DMG_GLASS.impacts - as app.js glassMarks does.
//        the 3 m/s taxi into a trunk and FAR 23.473's drop onto the wheels (10 ft/s): NO MARK (the user, 25 Oct: no crazing
//        on hard landings); the 30 m/s trunk on the centreline: one mark or more; it and the one 2.5 m out (the wing takes
//        it: on the Jodel and the metal Cessna nothing near the glazing bends - no mark, rightly): every mark on a glass
//        pane, within R_NEAR of the member that made it, drawn where it is (shadeJS at its point > 0), its severity in
//        (0, 1]; marks never moved nor were displaced by an equal one, event to event; the centreline flown twice: the
//        same marks. REPORTED: the 4 m/s nose-over, the 6 m/s drop, the 12 m/s runway stump (no expectation).
//
//   node tools/_dmg_glass_check.js             -> "GATE DMGGLASS: PASS|FAIL", exit 1 on FAIL
//   node tools/_dmg_glass_check.js --sync      -> rewrites aeroskin.js's copy of the GLSL from dmg_glass.js, then the gate
//   node tools/_dmg_glass_check.js --selftest  -> the gate on a sabotaged copy (the GLSL copy one character off; the members'
//                                                 reach 0): S and T must go red
'use strict';
const path = require('path'), fs = require('fs'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const DG = require(path.join(ROOT, 'src', 'viewer', 'dmg_glass.js'));
const AS_FILE = path.join(ROOT, 'src', 'viewer', 'aeroskin.js');
const GLASS_SECS = new Set(['windshield', 'pilotWindow', 'pasengerWindow', 'drawnPane', 'skyWindows']);   // aeroskin.js's glass role
const BUILDS = ['cub', 'jodel', 'metal'];

// ---------------------------------------------------------------------------------------------------------------------
// THE CHILD: one build's triggers (T)
// ---------------------------------------------------------------------------------------------------------------------
if (argv[0] === '--build') {
  const k = argv[1], rNear = opt('rnear', null) == null ? null : +opt('rnear');
  const WS = require('./_dmg_wall_study.js'), S = require('./_dmg_scar_lib.js');
  const SH = require(path.join(ROOT, 'src', 'viewer', 'sim_host.js')), SV = require(path.join(ROOT, 'src', 'viewer', 'sim_view.js'));
  const t0 = Date.now(), P0 = WS.prepare(k), def = P0.def;
  // the panes: each glass group's vertices (at most ~1500 a pane, as app.js glassPanes samples), area-weighted normals
  const pts = [], nrm = [], pane = [], secs = []; let id = 0;
  for (const g of P0.groups) {
    if (!GLASS_SECS.has(g.sec)) continue;
    const nv = g.nv, B = g.bD, N = new Float64Array(nv * 3);
    for (let t = 0; t < g.idx.length; t += 3) {
      const a = g.idx[t], b = g.idx[t + 1], c = g.idx[t + 2];
      const ux = B[b * 3] - B[a * 3], uy = B[b * 3 + 1] - B[a * 3 + 1], uz = B[b * 3 + 2] - B[a * 3 + 2];
      const vx = B[c * 3] - B[a * 3], vy = B[c * 3 + 1] - B[a * 3 + 1], vz = B[c * 3 + 2] - B[a * 3 + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const q of [a, b, c]) { N[q * 3] += nx; N[q * 3 + 1] += ny; N[q * 3 + 2] += nz; }
    }
    const step = Math.max(1, Math.floor(nv / 1500));
    for (let v = 0; v < nv; v += step) {
      const l = Math.hypot(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]) || 1;
      pts.push(B[v * 3], B[v * 3 + 1], B[v * 3 + 2]); nrm.push(N[v * 3] / l, N[v * 3 + 1] / l, N[v * 3 + 2] / l); pane.push(id);
    }
    secs.push(g.sec); id++;
  }
  const P = { pts: Float32Array.from(pts), nrm: Float32Array.from(nrm), pane: Int32Array.from(pane), n: pane.length, panes: id };
  const mids = [];
  def.beams.forEach((b, bi) => { if (b.cls === 'gear' || b.cls === 'wire') return; mids.push({ bi, mid: [0, 1, 2].map(j => (P0.rest[b.a * 3 + j] + P0.rest[b.b * 3 + j]) / 2) }); });
  const M = P.n ? DG.members(P, mids, rNear) : [];
  const out = { key: k, panes: secs, points: P.n, members: M.length, prepMs: Date.now() - t0, cases: {} };
  const core = def.refs && def.refs.noseFrame ? def.refs.noseFrame[0] : 0;
  const fly = (c) => {
    let hop = null, st = null, marks = [], key = '', events = 0, moved = 0, lastEv = -1;
    const tA = Date.now();
    const r = S.runCase(k, c, { onFrame: (sim, f) => {
      if (!hop) { hop = SH.simDmgHop0(); st = SV.simViewDmgState(sim.n, sim.beams.length); }
      const pay = SH.simDmgHop(sim, hop, core, 0); if (pay) SV.simViewDmgApply(st, pay);
      if (!(st.br.length > 0 || st.sS !== '0:0')) return;
      const kk = st.vB + '|' + st.sS; if (kk === key) return; key = kk; events++;
      const prev = marks; marks = DG.impacts(P, M, st, marks);
      // never moved, never displaced by an equal one: each mark before is still there at its point (its severity the same
      // or more), or the list is full of marks stronger than it
      for (const q of prev) {
        const still = marks.find(m => m.pane === q.pane && m.p[0] === q.p[0] && m.p[1] === q.p[1] && m.p[2] === q.p[2] && m.sev >= q.sev);
        if (!still && !(marks.length >= DG.MAX && marks.every(m => m.sev > q.sev))) moved++;
      }
      if (marks.length) lastEv = sim.t;
    } });
    const drawn = marks.map(m => { const s = DG.shadeJS(marks, m.p, m.n, 0.002); return Math.max(s[0], s[1]); });
    const reach = marks.map(m => { const mm = mids.find(x => x.bi === m.bi); return mm ? Math.hypot(mm.mid[0] - m.p[0], mm.mid[1] - m.p[1], mm.mid[2] - m.p[2]) : Infinity; });
    return { crashed: !!r.crashed, breaks: r.breaks || 0, events, moved, wallMs: Date.now() - tA,
      marks: marks.map((m, i) => ({ p: m.p.map(x => +x.toFixed(4)), n: m.n.map(x => +x.toFixed(3)), sev: +m.sev.toFixed(3), seed: m.seed, pane: m.pane, sec: secs[m.pane], bi: m.bi, cls: def.beams[m.bi].cls, d: +reach[i].toFixed(3), drawn: +drawn[i].toFixed(3) })) };
  };
  const byId = id => S.CASES.find(c => c.id === id);
  for (const id of ['taxi', 'drop', 'fly0', 'fly25', 'noseover', 'drop6', 'stump']) out.cases[id] = fly(byId(id));
  out.cases.fly0b = fly(byId('fly0'));
  process.stdout.write('\nDMGGLASS_JSON ' + JSON.stringify(out) + '\n');
  process.exit(0);
}

// ---------------------------------------------------------------------------------------------------------------------
// THE PARENT
// ---------------------------------------------------------------------------------------------------------------------
const SELF = argv.includes('--selftest');
const rows = [];
const row = (id, ok, txt) => { rows.push({ id, ok: !!ok, txt }); console.log((ok ? '  ok   ' : '  FAIL ') + id.padEnd(8) + txt); };

// ---- the GLSL copy in aeroskin.js: its lines, the region, a sync ----
const FS_HEAD = 'const AERO_GLASS_CRACK_FS = [\n', FS_TAIL = "].join('\\n');";
function asCopy(src) {
  const a = src.indexOf(FS_HEAD); if (a < 0) return null;
  const b = src.indexOf(FS_TAIL, a); if (b < 0) return null;
  return { a, b: b + FS_TAIL.length, text: src.slice(a, b + FS_TAIL.length) };
}
const asBlock = () => FS_HEAD + DG.GLSL_CRACK.split('\n').map(l => '  ' + JSON.stringify(l) + ',\n').join('') + FS_TAIL;
if (argv.includes('--sync')) {
  const src = fs.readFileSync(AS_FILE, 'utf8'), c = asCopy(src);
  if (!c) { console.error('aeroskin.js: no AERO_GLASS_CRACK_FS block'); process.exit(1); }
  if (c.text !== asBlock()) { fs.writeFileSync(AS_FILE, src.slice(0, c.a) + asBlock() + src.slice(c.b)); console.log('synced aeroskin.js AERO_GLASS_CRACK_FS from dmg_glass.js'); }
  else console.log('aeroskin.js AERO_GLASS_CRACK_FS already in sync');
}

// ---- S: the source ----
function rowS() {
  let src = fs.readFileSync(AS_FILE, 'utf8');
  if (SELF) src = src.replace('float dgSm(float a, float b, float x) {', 'float dgSm(float a, float b, float x)  {');   // the sabotage: one character
  const c = asCopy(src);
  let loads = true; try { delete require.cache[AS_FILE]; require(AS_FILE); } catch (e) { loads = false; }
  const shared = (src.match(/function aeroSharedU0\(THREE, z4\) \{[\s\S]*?\n\}/) || [''])[0];
  const hook = (src.match(/const AEROGLASS_HOOK = [\s\S]*?\n};/) || [''])[0];
  const man = require('./build.js').MANIFEST, vw = (man.viewer && man.viewer.scripts) || [];
  const app = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
  const chk = {
    copy: !!c && c.text === asBlock(),
    pars: /AERO_GLASS_CRACK_PARS/.test(hook) && /uniform float uCrackN;/.test(src) && /uniform vec4 uCrackP\[4\];/.test(src) && /uniform vec4 uCrackQ\[4\];/.test(src),
    call: /dgCrack\(/.test(hook) && /roughnessFactor \+= 0\.6 \* aeroCrack\.x/.test(hook),
    scatter: /aeroCrk/.test(hook) && /\+ aeroCrk, 1\.0\)/.test(hook),
    loads,
    uniforms: /uCrackN: \{ value: 0 \}/.test(shared) && new RegExp('uCrackP: \\{ value: Array\\.from\\(\\{ length: ' + DG.MAX + ' \\}').test(shared) && new RegExp('uCrackQ: \\{ value: Array\\.from\\(\\{ length: ' + DG.MAX + ' \\}').test(shared),
    gates: hook.indexOf('abs(dot(dgD, dgN)) > ' + DG.GATE_DN) >= 0 && hook.indexOf('dot(dgNf, dgN) < ' + DG.GATE_FACE) >= 0 && hook.indexOf('i < ' + DG.MAX + ';') >= 0,
    manifest: vw.indexOf('dmg_glass.js') >= 0 && vw.indexOf('dmg_glass.js') < vw.indexOf('app.js'),
    app: /if \(!inGarage\) glassMarks\(\);/.test(app) && /window\.FLYDIY_GLASS_TEST = /.test(app) && app.indexOf('glassMarks();') > app.indexOf('function poseModel('),
  };
  const bad = Object.keys(chk).filter(x => !chk[x]);
  row('S', !bad.length, 'the source: the GLSL copy = GLSL_CRACK, the hook splices / calls / scatters, the uniforms, the manifest, app.js' + (bad.length ? ' - FAILED: ' + bad.join(', ') : ''));
}

// ---- U: the rules, pure ----
function rowU() {
  const f = [];
  const sv = DG.severity;
  if (sv(DG.SET_LIGHT * 0.9, 0) !== 0 || sv(-DG.SET_LIGHT * 0.9, 0) !== 0) f.push('a set under SET_LIGHT marks');
  if (!(sv(DG.SET_LIGHT, 0) > 0) || Math.abs(sv(DG.SET_HARD, 0) - 0.85) > 1e-9 || sv(0.5, 0) !== 0.85 || sv(0, 1) !== 1) f.push('severity levels');
  // a pane of 3 points 5 cm apart (pane 0) and one 1 m off (pane 1)
  const P = { pts: Float32Array.from([0, 0, 0, 0.05, 0, 0, 0.5, 0, 0, 0, 1, 0]), nrm: Float32Array.from([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]), pane: Int32Array.from([0, 0, 0, 1]), n: 4 };
  const M = DG.members(P, [{ bi: 0, mid: [0, 0, 0.1] }, { bi: 1, mid: [0.05, 0, 0.1] }, { bi: 2, mid: [0.5, 0, 0.1] }, { bi: 3, mid: [0, 1, 0.1] }, { bi: 4, mid: [0, 0, 2] }]);
  if (M.length !== 4 || M.some(m => m.bi === 4)) f.push('members: the reach');
  const D = (sets, br) => ({ set: Float32Array.from(sets), broken: Uint8Array.from(br || [0, 0, 0, 0, 0]) });
  let mk = DG.impacts(P, M, D([0.001, 0.001, 0.001, 0.001, 0.5]));
  if (mk.length) f.push('elastic sets marked');
  mk = DG.impacts(P, M, D([0.01, 0.02, 0, 0, 0]));
  if (mk.length !== 1 || Math.abs(mk[0].sev - sv(0.02, 0)) > 1e-6) f.push('merge within MERGE (got ' + mk.length + ')');
  const mk2 = DG.impacts(P, M, D([0, 0, 0, 0, 0]), mk);
  if (mk2.length !== 1 || mk2[0].p[0] !== mk[0].p[0] || mk2[0].sev !== mk[0].sev) f.push('marks shrink or move when the sets fall');
  const mk3 = DG.impacts(P, M, D([0.01, 0.02, 0.05, 0.004, 0], [0, 0, 0, 1, 0]), mk);
  if (mk3.length !== 3 || mk3[0].sev !== 1 || mk3[0].pane !== 1) f.push('order / count');
  const many = []; for (let i = 0; i < 6; i++) many.push({ p: [i, 0, 0], n: [0, 0, 1], sev: 0.5, seed: i, pane: i, bi: i });
  const mk4 = DG.impacts(P, [], D([0, 0, 0, 0, 0]), many);
  if (mk4.length !== DG.MAX || mk4.some((m, i) => m.bi !== i)) f.push('MAX, the earlier kept');
  // pack
  const V4 = function () { this.v = [0, 0, 0, 0]; }; V4.prototype.set = function (a, b, c, d) { this.v = [a, b, c, d]; return this; };
  const U = { uCrackN: { value: 9 }, uCrackP: { value: [0, 1, 2, 3].map(() => new V4()) }, uCrackQ: { value: [0, 1, 2, 3].map(() => new V4()) } };
  DG.pack(U, mk3);
  if (U.uCrackN.value !== 3 || U.uCrackP.value[0].v[3] !== 1 || U.uCrackP.value[3].v.join() !== '0,0,0,0' || U.uCrackQ.value[3].v.join() !== '0,0,1,0') f.push('pack');
  DG.pack(U, []); if (U.uCrackN.value !== 0) f.push('pack: clear');
  // the mask
  const ring = (sev, seed, r, px) => { let L = 0, H = 0; for (let i = 0; i < 720; i++) { const a = i / 720 * Math.PI * 2, c = DG.crackJS(r * Math.cos(a), r * Math.sin(a), sev, seed, px); L = Math.max(L, c[0]); H = Math.max(H, c[1]); } return [L, H]; };
  for (const sev of [0.2, 0.6, 1]) { const reach = 0.06 + 0.3 * sev; if (ring(sev, 7919, reach * 1.06, 0.001).some(x => x > 0)) f.push('the mask past its reach (sev ' + sev + ')'); }
  // the crazed core from 0.85 (a broken member's star) and not under it: the haze round the centre (3-4.5 cm out) just over
  // the threshold against just under it - the same rays, the core alone between them
  const hz = sev => { let h = 0; for (const r of [0.03, 0.045]) for (let i = 0; i < 400; i++) { const a = i / 400 * Math.PI * 2; h += DG.crackJS(r * Math.cos(a), r * Math.sin(a), sev, 7919, 0.001)[1]; } return h / 800; };
  const core = hz(0.86) - hz(0.84), noCore = hz(0.84) - hz(0.82);
  if (!(core > 0.04 && Math.abs(noCore) < 0.01)) f.push('the crazed core (' + core.toFixed(3) + ' over 0.85, ' + noCore.toFixed(3) + ' under)');
  // a line under a pixel: its peak dims with the pixel (never brighter than its share w / px), and widens no more than a pixel
  const peak = px => { let L = 0; for (let i = 0; i < 3600; i++) { const a = i / 3600 * Math.PI * 2; L = Math.max(L, DG.crackJS(0.05 * Math.cos(a), 0.05 * Math.sin(a), 1, 7919, px)[0]); } return L; };
  const p1 = peak(0.0005), p2 = peak(0.004), p3 = peak(0.016);
  if (!(p1 > 0.9 && p2 < p1 && p3 < p2 && p3 <= 0.00115 / 0.016 * 1.02)) f.push('the sub-pixel fade (' + [p1, p2, p3].map(x => x.toFixed(3)).join(' > ') + ')');
  row('U', !f.length, 'the rules: thresholds, merge, never moved, MAX, pack, the mask (reach, core, sub-pixel fade)' + (f.length ? ' - FAILED: ' + f.join('; ') : ''));
}

// ---- G + R: Chromium ----
function chromiumOf() {
  try { return require('playwright').chromium; } catch (e) {
    try { return require(path.join(cp.execSync('npm root -g').toString().trim(), 'playwright')).chromium; } catch (e2) { return null; } }
}
async function rowsGR() {
  const chromium = chromiumOf();
  let br = null;
  if (chromium) try { br = await chromium.launch(Object.assign({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }, process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {})); } catch (e) { br = null; }
  if (!br) { console.log('  --   G     the mirror: NOT RUN (no Chromium)'); console.log('  --   R     the page\'s material: NOT RUN (no Chromium)'); return; }
  try {
    // G: the mirror
    const N = 24000, inp = [], seeds = [];
    let s = 12345; const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) | 0) >>> 0) / 4294967296;
    for (let i = 0; i < N; i++) {
      const sev = [0.2, 0.45, 0.6, 0.8, 0.9, 1][Math.floor(rnd() * 6)], reach = 0.06 + 0.3 * sev;
      const r = reach * 1.1 * Math.sqrt(rnd()), a = rnd() * Math.PI * 2, px = 0.0004 + 0.006 * rnd();
      inp.push(r * Math.cos(a), r * Math.sin(a), sev, px); seeds.push(7919 + Math.floor(rnd() * 1200) * 131);
    }
    const pg = await br.newPage();
    const res = await pg.evaluate(([glsl, inp, seeds]) => {
      const cv = document.createElement('canvas'), gl = cv.getContext('webgl2'); if (!gl) return { err: 'no webgl2' };
      const vs = '#version 300 es\nprecision highp float;\nprecision highp int;\nin vec4 aQ;\nin float aSeed;\nout vec2 vOut;\n' + glsl + '\nvoid main() { vOut = dgCrack(aQ.xy, aQ.z, int(aSeed), aQ.w); gl_Position = vec4(0.0); }\n';
      const fs = '#version 300 es\nprecision highp float;\nout vec4 o;\nvoid main() { o = vec4(0.0); }\n';
      const sh = (t, src) => { const x = gl.createShader(t); gl.shaderSource(x, src); gl.compileShader(x); return gl.getShaderParameter(x, gl.COMPILE_STATUS) ? x : { err: gl.getShaderInfoLog(x) }; };
      const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs); if (v.err) return { err: v.err }; if (f.err) return { err: f.err };
      const pr = gl.createProgram(); gl.attachShader(pr, v); gl.attachShader(pr, f);
      gl.transformFeedbackVaryings(pr, ['vOut'], gl.INTERLEAVED_ATTRIBS); gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return { err: gl.getProgramInfoLog(pr) };
      gl.useProgram(pr);
      const n = seeds.length, bq = gl.createBuffer(), bs = gl.createBuffer(), bo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, bq); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(inp), gl.STATIC_DRAW);
      const lq = gl.getAttribLocation(pr, 'aQ'); gl.enableVertexAttribArray(lq); gl.vertexAttribPointer(lq, 4, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, bs); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(seeds), gl.STATIC_DRAW);
      const ls = gl.getAttribLocation(pr, 'aSeed'); gl.enableVertexAttribArray(ls); gl.vertexAttribPointer(ls, 1, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, bo); gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, n * 8, gl.STATIC_READ);
      const tf = gl.createTransformFeedback(); gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf); gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, bo);
      gl.enable(gl.RASTERIZER_DISCARD); gl.beginTransformFeedback(gl.POINTS); gl.drawArrays(gl.POINTS, 0, n); gl.endTransformFeedback(); gl.disable(gl.RASTERIZER_DISCARD);
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
      const outF = new Float32Array(n * 2); gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, bo); gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, 0, outF);
      return { out: Array.from(outF), err: gl.getError() || null };
    }, [DG.GLSL_CRACK, inp, seeds]);
    if (res.err && !res.out) row('G', false, 'the mirror: the GLSL did not build - ' + String(res.err).slice(0, 300));
    else {
      const f32 = new Float32Array(inp);
      let bad = 0, worst = 0, nz = 0, both = 0;
      for (let i = 0; i < seeds.length; i++) {
        const c = DG.crackJS(f32[i * 4], f32[i * 4 + 1], f32[i * 4 + 2], seeds[i], f32[i * 4 + 3]);
        const d = Math.max(Math.abs(c[0] - res.out[i * 2]), Math.abs(c[1] - res.out[i * 2 + 1]));
        if (d > 0.05) bad++; worst = Math.max(worst, d);
        if (c[0] > 0.05 || c[1] > 0.05) { nz++; if (res.out[i * 2] > 0.05 || res.out[i * 2 + 1] > 0.05) both++; }
      }
      row('G', bad / seeds.length < 0.003 && nz > 500, 'the mirror: GLSL_CRACK in WebGL2 vs crackJS on ' + seeds.length + ' samples - |d| > 0.05 on ' + bad + ' (' + (100 * bad / seeds.length).toFixed(2) + ' %, under 0.3 %), worst ' + worst.toFixed(3) + '; the crack where JS has it ' + both + ' / ' + nz);
    }
    await pg.close();
    // R: the page's material
    const pg2 = await br.newPage({ viewport: { width: 256, height: 256 } });
    const errs = []; pg2.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 300)); }); pg2.on('pageerror', e => errs.push('pageerror: ' + e.message));
    await pg2.setContent('<canvas id=c width=256 height=256></canvas>');
    for (const f of ['vendor/three.min.js', 'src/viewer/dmg_glass.js', 'src/viewer/aeroweather.js', 'src/viewer/aeroskin.js']) await pg2.addScriptTag({ content: fs.readFileSync(path.join(ROOT, f), 'utf8') });
    const R = await pg2.evaluate(() => {
      const W = 256, cv = document.getElementById('c');
      const Rn = new THREE.WebGLRenderer({ canvas: cv, antialias: false, preserveDrawingBuffer: true });
      Rn.setSize(W, W, false); Rn.setClearColor(0x000000, 1);
      const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(46, 1, 0.05, 50); cam.position.set(0, 0, 0.9); cam.lookAt(0, 0, 0);
      sc.add(new THREE.AmbientLight(0xffffff, 0.6)); const dl = new THREE.DirectionalLight(0xffffff, 2.5); dl.position.set(0.3, 0.6, 1); sc.add(dl);
      const g = new THREE.PlaneGeometry(1, 1, 8, 8), P = g.attributes.position, n = P.count;
      const st = new Float32Array(n * 4), rs = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { st[i * 4] = P.getX(i) + 0.5; st[i * 4 + 1] = P.getY(i) + 0.5; rs[i * 4] = P.getX(i); rs[i * 4 + 1] = P.getY(i); rs[i * 4 + 2] = P.getZ(i); rs[i * 4 + 3] = 2; }
      g.setAttribute('aStruct', new THREE.BufferAttribute(st, 4)); g.setAttribute('aRest', new THREE.BufferAttribute(rs, 4));
      const m = AEROSKIN.aeroGlass(THREE, { screen: 1, ext: [0, 1, 0, 1], fieldM: 1 });
      sc.add(new THREE.Mesh(g, m));
      const U = AEROSKIN.aeroSharedU(THREE), gl = Rn.getContext(), px = new Uint8Array(W * W * 4);
      const shot = () => { Rn.render(sc, cam); gl.readPixels(0, 0, W, W, gl.RGBA, gl.UNSIGNED_BYTE, px); return Array.from(px); };
      const cmp = (a, b) => { let br = 0, dk = 0, ch = 0; for (let i = 0; i < W * W; i++) { const la = a[i * 4] + a[i * 4 + 1] + a[i * 4 + 2], lb = b[i * 4] + b[i * 4 + 1] + b[i * 4 + 2]; if (la !== lb || a[i * 4 + 3] !== b[i * 4 + 3]) ch++; if (lb > la + 6) br++; if (lb < la - 1) dk++; } return { br, dk, ch }; };
      const mk = (p, nn, sev) => [{ p, n: nn, sev, seed: 7919 }];
      const u0 = U.uCrackN.value === 0 && U.uCrackP.value.length === DMG_GLASS.MAX && U.uCrackQ.value.length === DMG_GLASS.MAX;
      DMG_GLASS.pack(U, []); const a = shot(), progA = Rn.info.programs.length, ok = !!(Rn.info.programs.length && gl.getError() === 0);
      DMG_GLASS.pack(U, mk([0.05, 0.02, 0], [0, 0, 1], 1)); const c = shot(), img = cv.toDataURL('image/png'), progC = Rn.info.programs.length;
      DMG_GLASS.pack(U, mk([0.05, 0.02, 0.05], [0, 0, 1], 1)); const off = shot();
      DMG_GLASS.pack(U, mk([0.05, 0.02, 0], [0, 0, -1], 1)); const away = shot();
      DMG_GLASS.pack(U, mk([0.05, 0.02, 0], [0, 0, 1], 0.2)); const light = shot();
      DMG_GLASS.pack(U, []); const a2 = shot();
      return { ok, u0, progA, progC, mark: cmp(a, c), off: cmp(a, off), away: cmp(a, away), light: cmp(a, light), back: cmp(a, a2), img };
    });
    if (opt('png')) fs.writeFileSync(opt('png'), Buffer.from(R.img.split(',')[1], 'base64'));
    const ok = R.ok && R.u0 && !errs.length && R.progA === R.progC && R.mark.br >= 1500 && R.mark.dk === 0 && R.off.ch === 0 && R.away.ch === 0 && R.back.ch === 0 && R.light.br > 50 && R.light.br < R.mark.br;
    row('R', ok, 'the page\'s material (the real aeroGlass, three r186): links' + (R.u0 ? '' : ' - the shared block has no uCrack* of MAX') + (errs.length ? ' - ERRORS: ' + errs.slice(0, 2).join(' | ') : '') + '; programs ' + R.progA + ' -> ' + R.progC +
      '; a broken member\'s mark brightens ' + R.mark.br + ' px (>= 1500), darkens ' + R.mark.dk + '; a light one ' + R.light.br + ' px; 5 cm off the plane ' + R.off.ch + ' px changed, facing away ' + R.away.ch + ', cleared ' + R.back.ch);
  } finally { await br.close(); }
}

// ---- T: the triggers, three children at once ----
function rowsT() {
  const kids = BUILDS.map(k => new Promise(res => {
    const a = [__filename, '--build', k].concat(SELF ? ['--rnear', '0'] : []);
    const ch = cp.spawn(process.execPath, ['--max-old-space-size=4096'].concat(a), { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let o = '', e = ''; ch.stdout.on('data', d => { o += d; }); ch.stderr.on('data', d => { e += d; });
    ch.on('close', code => { const m = o.match(/DMGGLASS_JSON (.*)/); res(m ? JSON.parse(m[1]) : { key: k, err: 'exit ' + code + ': ' + (e || o).slice(-600) }); });
  }));
  return Promise.all(kids).then(outs => {
    for (const B of outs) {
      if (B.err) { row('T.' + B.key, false, 'the child failed - ' + B.err); continue; }
      const C = B.cases, f = [];
      if (C.taxi.marks.length) f.push('the taxi marked ' + C.taxi.marks.length);
      if (C.drop.marks.length) f.push('the FAR drop marked ' + C.drop.marks.length + ' (no crazing on hard landings)');
      for (const id of ['fly0', 'fly25']) {
        const c = C[id];
        if (id === 'fly0' && !c.marks.length) f.push(id + ': no mark');
        for (const m of c.marks) {
          if (!GLASS_SECS.has(m.sec)) f.push(id + ': a mark off the glass (' + m.sec + ')');
          if (!(m.d <= DG.R_NEAR + 1e-6)) f.push(id + ': a mark ' + m.d + ' m from its member');
          if (!(m.drawn > 0)) f.push(id + ': a mark not drawn at its point');
          if (!(m.sev > 0 && m.sev <= 1)) f.push(id + ': severity ' + m.sev);
        }
        if (c.moved) f.push(id + ': ' + c.moved + ' marks moved or displaced');
      }
      if (JSON.stringify(C.fly0.marks) !== JSON.stringify(C.fly0b.marks)) f.push('fly0 twice: not the same marks');
      const line = id => { const c = C[id]; return id + ' ' + c.marks.length + (c.marks.length ? ' [' + c.marks.map(m => m.sec + ' ' + m.sev).join(', ') + ']' : '') + ' (' + c.events + ' events, ' + (c.wallMs / 1000).toFixed(1) + ' s)'; };
      row('T.' + B.key, !f.length, B.key + ': panes ' + B.panes.join('/') + ', ' + B.points + ' points, ' + B.members + ' members near; ' +
        ['taxi', 'drop', 'fly0', 'fly25'].map(line).join('; ') + '; fly0 again the same' + (f.length ? ' - FAILED: ' + f.join('; ') : ''));
      console.log('         reported: ' + ['noseover', 'drop6', 'stump'].map(line).join('; '));
    }
  });
}

(async () => {
  const t0 = Date.now();
  console.log('GATE DMGGLASS (G3623): the impact mark on the glazing' + (SELF ? ' - SELFTEST (sabotaged: S and T must go red)' : ''));
  rowS(); rowU();
  const pT = rowsT();
  await rowsGR();
  await pT;
  const fail = rows.filter(r => !r.ok);
  if (SELF) {
    const redS = fail.some(r => r.id === 'S'), redT = BUILDS.every(k => fail.some(r => r.id === 'T.' + k));
    const ok = redS && redT;
    console.log('GATE DMGGLASS SELFTEST: ' + (ok ? 'PASS (S red, T red on every build)' : 'FAIL (the sabotage went unseen: S ' + (redS ? 'red' : 'green') + ', T ' + (redT ? 'red' : 'not red everywhere') + ')') + ' - ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
    process.exit(ok ? 0 : 1);
  }
  console.log('GATE DMGGLASS: ' + (fail.length ? 'FAIL (' + fail.map(r => r.id).join(', ') + ')' : 'PASS') + ' - ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
  process.exit(fail.length ? 1 : 0);
})();
