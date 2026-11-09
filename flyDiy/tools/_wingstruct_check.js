#!/usr/bin/env node
// GATE WINGSTRUCT (WING-STRUCTURE, 9 Nov 2026; futureDesigns/WING-STRUCTURE-STUDY-2026-11.md): the wing's inside
// (src/viewer/wing_struct.js) on the validated aeroplanes (tools/_load_build.js VALIDATED, each as the game flies it),
// node only (~5 s). What is held:
//   THE SPARS     drawn through the frame's own spar nodes: at every spar station the front spar's centre line within
//                 1 mm of the WF node's chord line, the rear spar's of the WR node's (61_gen_frame) - the field's integer
//                 rails 0 and 1, the lines the covering prints (_cage_wing.js wingField .w: (cf - sparF) / (sparR - sparF))
//   THE RIBS      drawn at the root and at the deduped parts.ribZ (<= the straight wing's end) - the field's integer
//                 stations (.z), the rule re-run here as _cage_wing.js writes it, and that file still writing it so
//   THE WIRES     each drawn drag / anti-drag wire joins two stations the SOLVER joins: a front-spar node of station i and
//                 the rear-spar node of station i + 1 (or the reverse) with a member of def.beams between them (DMG breaks
//                 those); a compression strut at every interior station
//   THE STRINGERS a stressed-skin wing's at whole multiples of its grammar's stringerPitch (aeroskin.js uG0.y prints those)
//   THE KIND      each validated wing's construction row read as the study says (the Jodel's cantilever wood = dbox, the
//                 Cub's strut-braced wood = cub, the Cessnas = alloy, the twin = cub, the Petrel = carbon) and every row
//                 of GEN_SURF_MATERIALS (and fabricAlu) has a kind
//   THE BUDGET    per wing half: <= BUDGET.tris[lod] triangles at both LODs, <= BUDGET.draws materials
//   INSIDE        every drawn vertex inside the covering's own box (genWing's skin, the same def) + 5 mm
//   NO PHYSICS    the core never names it (flight_core.js); the page builds it only at a broken wing member (app.js
//                 wsWreck, from brkCage) or on demand in the garage (never under a plain build); the join skips it (edMarker)
//   node tools/_wingstruct_check.js [--selftest]  -> "GATE WINGSTRUCT: PASS|FAIL"
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const rd = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const SELF = process.argv.includes('--selftest');
const CORE = rd('tools/flight_core.js');
const ctx = { console, Math, JSON, Float32Array, Float64Array, Int32Array, Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array, Uint8ClampedArray, Map, Set, Array, Object, Number, String, Boolean, Infinity, NaN, isFinite, parseFloat, parseInt, Error, Symbol, Date, WeakMap, Promise, RegExp, TypeError, RangeError };
vm.createContext(ctx);
vm.runInContext(CORE, ctx, { filename: 'flight_core.js' });
const C = n => vm.runInContext(n, ctx);
const lib = { genAfEval: C('genAfEval'), genSurfKey: C('genSurfKey'), GEN_FLAPS: C('GEN_FLAPS'), GEN_BUILD_GRAMMAR: C('GEN_BUILD_GRAMMAR') };
const LB = require('./_load_build.js');
const DEFS = {};
for (const k of Object.keys(LB.VALIDATED)) DEFS[k] = C('buildGen')(LB.loadValidated(k).spec);
const KIND_WANT = { cub: 'cub', jodel: 'dbox', metal: 'alloy', floats: 'alloy', twinFloats: 'cub', petrel: 'carbon' };
function load(src) { const m = { exports: {} }; new Function('module', 'window', src)(m, undefined); return m.exports; }
function run(WSsrc, files) {
  const fails = []; let checks = 0;
  const ok = (c, m) => { checks++; if (!c) fails.push(m); };
  let WS;
  try { WS = load(WSsrc); } catch (e) { fails.push('wing_struct.js does not load: ' + e.message); return { fails, checks }; }
  const genWing = C('genWing'), genRestFrame = C('genRestFrame');
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const nz = a => { const L = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / L, a[1] / L, a[2] / L]; };
  const stats = [];
  for (const [key, def] of Object.entries(DEFS)) {
    const N = def.nodes;
    // the beams as a set of node pairs
    const BS = new Set(def.beams.map(b => Math.min(b.a, b.b) + ':' + Math.max(b.a, b.b)));
    // the covering's box (genWing's skin, rest frame -> body)
    let skinBox = null;
    try {
      const pay = genWing(def), FR = genRestFrame(def), g = pay.groups.skin, inv = FR.from || null;
      if (g && g.pos && inv) {
        skinBox = [[1e9, 1e9, 1e9], [-1e9, -1e9, -1e9]];
        for (let i = 0; i < g.pos.length; i += 3) { const p = inv([g.pos[i], g.pos[i + 1], g.pos[i + 2]]); for (let j = 0; j < 3; j++) { skinBox[0][j] = Math.min(skinBox[0][j], p[j]); skinBox[1][j] = Math.max(skinBox[1][j], p[j]); } }
      }
    } catch (e) { skinBox = null; }
    for (const lod of [0, 1]) {
      let pl;
      try { pl = WS.plan(def, { lib, lod, audit: true }); } catch (e) { ok(false, key + ' lod ' + lod + ': plan threw ' + e.message); continue; }
      ok(pl.halves.length >= 2, key + ' lod ' + lod + ': both halves drawn');
      for (const h of pl.halves) {
        const tag = key + ' plane ' + h.plane + h.side + ' lod ' + lod;
        ok(h.tris > 0 && h.tris <= WS.BUDGET.tris[lod], tag + ': ' + h.tris + ' triangles within the budget ' + WS.BUDGET.tris[lod]);
        ok(h.draws >= 1 && h.draws <= WS.BUDGET.draws, tag + ': ' + h.draws + ' draws <= ' + WS.BUDGET.draws);
        if (lod === 0) stats.push(tag.replace(' lod 0', '') + ' ' + h.kind + ' ' + h.tris + 't');
        let finite = true; for (const v of h.A.p) if (!Number.isFinite(v)) { finite = false; break; }
        ok(finite, tag + ': every position finite');
        if (skinBox && h.plane === 0) {   // the covering's box holds plane 0's structure (+ 5 mm)
          let out = 0; const e = 0.005;
          for (let i = 0; i < h.A.p.length; i += 3) for (let j = 0; j < 3; j++) { const v = h.A.p[i + j]; if (v < skinBox[0][j] - e || v > skinBox[1][j] + e) { out++; break; } }
          ok(out === 0, tag + ': ' + out + ' vertices outside the covering\'s box');
        }
        if (lod !== 0) continue;
        const PP = (def.parts.planes && def.parts.planes[h.plane]) || def.parts, fw = PP.wf[h.side];
        const zAll = [PP.zRoot, ...PP.zs], info = pl.info.planes.find(p => p.plane === h.plane);
        // THE KIND
        if (h.plane === 0) ok(h.kind === KIND_WANT[key], tag + ': kind ' + h.kind + ', want ' + KIND_WANT[key]);
        // THE SPARS through the nodes: the spar centre at each station on the node's chord line (the up axis free)
        const AU = h.audit;
        // the FRONT spar on its nodes; the REAR on the covering's printed rail - sparRear of the LOCAL chord along the
        // nodes' chord axis (wingSectionAt's map): on a tapered wing the solver's rear nodes keep a constant spacing
        // (61_gen_frame sparSpacing) and the print does not (the study, part 2)
        for (const [w, list] of [['F', AU.spars.F], ['R', AU.spars.R]]) {
          let worst = 0;
          list.forEach((s, i) => {
            const pF = N[fw.F[i]].p, pR = N[fw.R[i]].p, ch = nz(sub(pR, pF));
            const tgt = w === 'F' ? pF : [0, 1, 2].map(j => pF[j] + ch[j] * (PP.sparRear - PP.sparFront) * PP.chordAt(s.z));
            const d = sub(s.p, tgt), span = [0, 0, 1];
            const dc = Math.abs(dot(d, ch)), ds = Math.abs(dot(d, span) - dot(ch, span) * dot(d, ch));
            worst = Math.max(worst, dc, ds);
          });
          ok(worst < 0.001, tag + ': the ' + (w === 'F' ? 'front spar ' : 'rear spar ') + (worst * 1000).toFixed(2) + ' mm off ' + (w === 'F' ? 'its nodes\' chord line' : 'the printed rail'));
        }
        // THE RIBS at the field's integer stations: the root and _cage_wing.js's deduped ribZ, to the straight end
        const ribZ = (PP.ribZ || []).slice().sort((a, b) => a - b).filter((z, i, A) => i === 0 || z - A[i - 1] > 1e-4);
        const want = [PP.zRoot, ...ribZ].filter(z => z <= info.zS + 1e-6);
        if (h.kind !== 'carbon' && h.kind !== 'glass') {
          const miss = want.filter(z => !h.ribs.some(r => Math.abs(r - z) < 1e-6));
          ok(!miss.length, tag + ': ribs at every field station (' + miss.length + ' of ' + want.length + ' missing)');
          // and none off them but the special stations (the strut's, the crank's, the tip's)
          const extra = h.ribs.filter(r => !want.some(z => Math.abs(r - z) < 1e-6));
          ok(extra.length <= 3, tag + ': ' + extra.length + ' ribs off the field\'s stations (the specials only)');
        }
        // THE WIRES: each joins station i's spar node and station i+1's other spar node, a member the solver has
        const bayZ = zAll.filter(z => z <= info.zS + 1e-6);
        if (WS.KINDS[h.kind].wires) {
          ok(AU.wires.length === 2 * (bayZ.length - 1), tag + ': two wires a bay (' + AU.wires.length + ' for ' + (bayZ.length - 1) + ' bays)');
          ok(AU.struts.length === bayZ.length - 1, tag + ': a compression strut at every station past the root');
          let bad = 0;
          for (const W of AU.wires) {
            const a = W.from === 'F' ? fw.F[W.i] : fw.R[W.i], b = W.from === 'F' ? fw.R[W.i + 1] : fw.F[W.i + 1];
            if (!BS.has(Math.min(a, b) + ':' + Math.max(a, b))) bad++;
            // the drawn ends on the drawn spars of those two stations (their faces: within a spar's width and depth)
            const sp = (k2, i2) => AU.spars[k2][i2] && AU.spars[k2][i2].p;
            const ea = sp(W.from, W.i), eb = sp(W.from === 'F' ? 'R' : 'F', W.i + 1);
            if (!ea || !eb || Math.hypot(...sub(W.a, ea)) > 0.08 || Math.hypot(...sub(W.b, eb)) > 0.08) bad++;
          }
          ok(bad === 0, tag + ': ' + bad + ' wires on no member of the solver');
        } else ok(AU.wires.length === 0, tag + ': no wires on a ' + h.kind + ' wing');
        // THE STRINGERS at whole multiples of the grammar's pitch
        if (WS.KINDS[h.kind].stringers && h.side === 'R') {
          const pitch = lib.GEN_BUILD_GRAMMAR[info.row].stringerPitch;
          ok(info.stringers.length > 0 && info.stringers.every(s => Math.abs(s / pitch - Math.round(s / pitch)) < 1e-9), tag + ': stringers at the grammar\'s pitch ' + pitch);
        }
      }
    }
  }
  // THE LAMP BAY: the nose's cover and ribs stop at its edges, a pocket stands in it
  { const d = DEFS.cub, semi = d.spec.geom.semi, b = { z0: semi * 0.24 - 0.17, z1: semi * 0.24 + 0.17, chord: 0.13, depth: 0.06 };
    const a = WS.plan(d, { lib, sides: ['R'] }), c = WS.plan(d, { lib, sides: ['R'], bays: [b] });
    const ip = c.info.planes[0];
    ok(ip.lamps && ip.lamps.length === 1 && Math.abs(ip.lamps[0].z0 - b.z0) < 1e-9, 'the lamp bay recorded');
    // no vertex of the nose cover inside the bay (the sheet's points sit at the upper contour, ahead of the spar)
    const A = c.halves[0].A, PP = d.parts.planes[0], N = d.nodes, fw = PP.wf.R, x0 = N[fw.F[0]].p[0];
    let inside = 0;
    for (let i = 0; i < A.p.length; i += 3) { const z = Math.abs(A.p[i + 2]); if (z > b.z0 + 0.02 && z < b.z1 - 0.02 && A.p[i] < x0 - 0.12) inside++; }
    ok(inside === 0, 'nothing of the nose drawn in the lamp bay (' + inside + ' vertices)');
    ok(c.halves[0].tris !== a.halves[0].tris, 'the bay changes the drawing'); }
  // every construction row has a kind (and fabricAlu, REAL-FIGURES-3's, before it lands)
  for (const r of Object.keys(C('GEN_SURF_MATERIALS')).concat(['fabricAlu'])) ok(r === 'fabric' || !!WS.KINDS[r], 'the row ' + r + ' has a kind');
  ok(!!(WS.KINDS.dbox && WS.KINDS.cub), 'the wooden row\'s two kinds');
  // THE TEXTURE'S RULES are still the ones re-run above
  ok(/const ribZ = \(PT\.ribZ \|\| \[\]\)\.slice\(\)\.sort\(\(a, b\) => a - b\)\s*\.filter\(\(z, i, A\) => i === 0 \|\| z - A\[i - 1\] > 1e-4\)/.test(files.wing), '_cage_wing.js: the field\'s rib stations (deduped ribZ)');
  ok(/\(cf - sparF\) \/ sparSpan\]/.test(files.wing), '_cage_wing.js: the field\'s rails (the spars at 0 and 1)');
  ok(/v4\('uG0', GR \? GR\.framePitch : 0, GR \? GR\.stringerPitch : 0/.test(files.skin), 'aeroskin.js: the metric stringers at the grammar\'s pitch');
  // NO PHYSICS, NO FLIGHT COST, NOT THE AEROPLANE
  ok(!/WING_STRUCT|wing_struct/.test(CORE), 'the core never names it');
  ok(/'wing_struct\.js', 'garage\.js'/.test(files.build) && !/src\/core\/[^']*wing_struct/.test(files.build), 'build.js loads it with the viewer');
  ok(/function wsWreck\(D, K, o\) \{\s*if \(model\.wsRigs !== undefined/.test(files.app) && /if \(!D\.br\.some\(bi =>/.test(files.app), 'app.js builds it only at a broken wing member');
  ok((files.app.match(/wsWreck\(D, K, o\);/g) || []).length === 1 && files.app.indexOf('wsWreck(D, K, o);') > files.app.indexOf('function brkCage('), 'app.js: only brkCage asks for it');
  ok(/wsClear\(model\);/.test(files.app) && /wsClear\(BRK\.model\);/.test(files.app), 'app.js: the heal takes it away');
  ok(/o\.userData\.edMarker = true/.test(WSsrc) && /userData && o\.userData\.edMarker\) return;/.test(files.join), 'the join skips it (edMarker)');
  ok(/const want = !!\(T && W && W\.def && W\.nodeCage && scene && \(L\.force \|\| cut\)\);/.test(WSsrc), 'the garage builds it only for the fiche or the cutaway box');
  ok(/if \(window\.CAGE_WINGSTRUCT_DRAW\) window\.CAGE_WINGSTRUCT_DRAW\(ctx\);/.test(files.wing), 'the wing layer hands it its build');
  // the garage's def is the wing rows' alone: the kind is read off the build's own spec (the 172 drew as cloth without it)
  ok(/spec: full, bays \}\);/.test(WSsrc) && /window\.GARAGE_SPEC\.get\(\)/.test(WSsrc), 'the garage reads the kind off the whole build\'s spec');
  { const d = DEFS.metal, spec0 = JSON.parse(JSON.stringify(d.spec)); spec0.material = 'tubeFabric';
    for (const w of spec0.wings) w.material = null;
    ok(WS.kindOf({ spec: spec0, parts: d.parts }, 0, lib, d.spec).key === 'alloy', 'a wing-rows def with the whole build\'s spec: the 172 is alloy'); }
  ok(/MATLIB/.test(WSsrc) && !/new [A-Za-z.]*Material\(/.test(WSsrc), 'its materials are the library\'s');
  // THE FUSELAGE'S FINISHES (the user 9 Nov): AEROSKIN's rows, this file's own copies (never the pooled one the fuselage wears)
  ok(/aeroDupe\(G2\.aeroMaterial\(T, \{ finish: fin, surf: 0, fieldM: 1/.test(WSsrc), 'the finishes are AEROSKIN\'s, copied');
  ok(/spruce: 'spruce', ply: 'ply', alu: 'bareAlu'/.test(WSsrc) && /steel: 'steelTube'/.test(WSsrc) && /carbon: 'composite', glass: 'gelcoat'/.test(WSsrc), 'each class on its fuselage finish');
  // THE FICHE'S CUTAWAY (plane_fiche.js, this chantier's seam)
  const F = files.fiche;
  ok(/window\.CAGE_WINGSTRUCT\.show\(true\); window\.CAGE_WINGSTRUCT\.fiche\(true\)/.test(F) && /CAGE_WINGSTRUCT\.show\(false\)/.test(F), 'the fiche shows it for the cutaway and takes it away');
  ok(/NEAR_KEEP_STRUCT = \['brace', 'light'\]/.test(F) && /keptStrut\(o, Lr\)/.test(F), 'the near struts and lamps stay with the structure');
  ok(/if \(En && fus && !WSg\)/.test(F), 'the near wing\'s tanks stay with the structure');
  ok(/ghostNacelles\(T, root, left, cl, hw, st\);/.test(F) && /g\.transparent = true; g\.opacity = a; g\.depthWrite = false/.test(F), 'the cut side\'s wing nacelles are ghosts');
  ok(/cutTaper\(T, root, p1, p2, st\);/.test(F) && /nm\[i\] !== 'taperPanel'/.test(F), 'the pod-and-rod\'s taper cladding is cut');
  return { fails, checks, stats };
}
const files = { fiche: rd('src/viewer/plane_fiche.js'), wing: rd('tools/_cage_wing.js'), skin: rd('src/viewer/aeroskin.js'), build: rd('tools/build.js'), app: rd('src/viewer/app.js'), join: rd('tools/_cage_join.js') };
const WSsrc = rd('src/viewer/wing_struct.js');
const base = run(WSsrc, files);
for (const s of base.stats || []) console.log('  ' + s);
if (!SELF) {
  for (const m of base.fails) console.log('  FAIL ' + m);
  console.log('  ' + base.checks + ' checks');
  console.log('GATE WINGSTRUCT: ' + (base.fails.length ? 'FAIL (' + base.fails.length + ' of ' + base.checks + ')' : 'PASS'));
  process.exit(base.fails.length ? 1 : 0);
}
const BREAKS = [
  ['the front spar 2 % of chord aft', WSsrc.replace("spar(sparF, KD.spar, sw, KD.sparC, KD.webC);", "spar(sparF + 0.02, KD.spar, sw, KD.sparC, KD.webC);").replace("['F', sparF, sw], ['R', sparR, rw]]) AU.spars", "['F', sparF + 0.02, sw], ['R', sparR, rw]]) AU.spars")],
  ['the ribs at their own 0.3 m', WSsrc.replace("const ribZ = uniq([PP.zRoot, ...(PP.ribZ || [])])", "const ribZ = uniq([PP.zRoot, ...Array.from({ length: 40 }, (_, i) => PP.zRoot + 0.3 * (i + 1))])")],
  ['a wire across the wrong bay', WSsrc.replace("wire(f, xa, g, xb, 0.006);", "wire(f, xa, frameAt(bayZ[Math.min(bayZ.length - 1, i + 2)]), xb, 0.006);")],
  ['the budget doubled away', WSsrc.replace("const BUDGET = { tris: [12000, 7000], draws: 3 };", "const BUDGET = { tris: [120, 70], draws: 3 };")],
  ['stringers off the grammar', WSsrc.replace("const sC = j * strPitch;", "const sC = j * strPitch + 0.03;")],
  ['the join takes it', WSsrc.replace("o.userData.edMarker = true; ", "")],
  ['built under every build', WSsrc.replace("(L.force || cut));", "true);")],
  ['the cub wing as a D-box', WSsrc.replace("if (row === 'fabric') key = (PP.useStrut || PP.truss) ? 'cub' : 'dbox';", "if (row === 'fabric') key = 'dbox';")],
  ['the garage without the build\'s spec', WSsrc.replace("const L = libOf(lib), S = spec || def.spec,", "const L = libOf(lib), S = def.spec,")],
  ['a spar outside the covering', WSsrc.replace("const P = (f, xc, ym) => map(", "const P = (f, xc, ym) => map(xc > 0.6 ? [1e3, 0, 0] : ")],
];
let bad = 0;
for (const [nm, f2] of BREAKS) {
  if (f2 === WSsrc) { console.log('  selftest ' + nm + ': the break did not apply'); bad++; continue; }
  const r = run(f2, files);
  if (!r.fails.length) { console.log('  selftest ' + nm + ': NOT caught'); bad++; }
}
const APP_BREAKS = [['built at every break', files.app.replace("if (!D.br.some(bi => { const b = def.beams[bi]; return b && WN.has(b.a) && WN.has(b.b); })) return;", "")]];
for (const [nm, a2] of APP_BREAKS) {
  if (a2 === files.app) { console.log('  selftest ' + nm + ': the break did not apply'); bad++; continue; }
  const r = run(WSsrc, Object.assign({}, files, { app: a2 }));
  if (!r.fails.length) { console.log('  selftest ' + nm + ': NOT caught'); bad++; }
}
const FICHE_BREAKS = [['the tanks halved again', files.fiche.replace('if (En && fus && !WSg)', 'if (En && fus)')],
  ['the nacelle left solid', files.fiche.replace('    ghostNacelles(T, root, left, cl, hw, st);\n', '')],
  ['the taper left whole', files.fiche.replace('    cutTaper(T, root, p1, p2, st);\n', '')]];
for (const [nm, f2] of FICHE_BREAKS) {
  if (f2 === files.fiche) { console.log('  selftest ' + nm + ': the break did not apply'); bad++; continue; }
  const r = run(WSsrc, Object.assign({}, files, { fiche: f2 }));
  if (!r.fails.length) { console.log('  selftest ' + nm + ': NOT caught'); bad++; }
}
const n = BREAKS.length + APP_BREAKS.length + FICHE_BREAKS.length;
console.log('  selftest: ' + (n - bad) + ' of ' + n + ' caught');
for (const m of base.fails) console.log('  FAIL ' + m);
console.log('  ' + base.checks + ' checks');
console.log('GATE WINGSTRUCT: ' + (bad || base.fails.length ? 'FAIL' : 'PASS'));
process.exit(bad || base.fails.length ? 1 : 0);
