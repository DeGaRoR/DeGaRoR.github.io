#!/usr/bin/env node
// PAVEMENT CHECK — GATE PAVEMENT (roads & runways, 2026-09-21): the pavement
// material's module (src/viewer/pavement.js), headless.
//
// What a headless node can hold about it:
//   1. THE BUILDERS — a strip's and a road's attributes, with the real vendor
//      three: every vertex inside the box, dEdge the box's own SDF (and 0 on
//      the pavement's edge row), u monotone along, y the drape plus the lift,
//      the road's u its polyRoad arclength, no fold, no NaN, indices in range.
//   2. THE FIELD — the CPU twin (what the scatter reads) equals the attribute
//      at every vertex.
//   3. THE RECORDER — sitePaintStrip on the analytic HOME's strip, recorded:
//      every opaque fill kept, all inside the box, the threshold bars at both
//      ends, the centre dashes one 29 m rule, the chevrons four segments, the
//      mowing stripes (translucent) skipped; a road's marks by class.
//   4. THE HOOK RULES — one hook, ATMO.inject its first statement, its source
//      the same whatever the strip (the program's key), every loop bound that
//      holds a texture read a uniform, no textureGrad/textureLod on the arrays,
//      every anchor the hook replaces present in r186's standard shaders (a
//      silent no-op replace is the version-bump failure), every GLSL uniform
//      declared in the material, at most 8 samplers.
//   5. THE RECIPE — every class row names sets the library bakes, tiles > 0,
//      a paved class turns its tiles little; export -> set -> export identical.
//
// node tools/_pavement_check.js [--verbose]
'use strict';
const fs = require('fs');
const path = require('path');
const VERB = process.argv.includes('--verbose');
let fails = 0;
const verdict = (ok, line) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + line); };
const f = (v, n = 3) => (typeof v === 'number' && Number.isFinite(v)) ? v.toFixed(n) : String(v);

const THREE = require('../vendor/three.min.js');
const P = require('../src/viewer/pavement.js');
const TEX = require('../src/viewer/pavement_tex.js');
const CORE = require('./flight_core.js');
const PG = CORE.PREMISES_GEN;

// ---- 1. THE BUILDERS ----------------------------------------------------------
console.log('1. THE BUILDERS - a strip and a road, draped');
const hAt = (x, z) => 20 + 3 * Math.sin(x / 90) + 2 * Math.cos(z / 70);
{
  const o = { len: 900, wid: 30, hdg: 0.7, cx: 120, cz: -40, shoulderW: 14, cls: 'concrete', seed: 3, heightAt: hAt, lift: 0.07 };
  const g = P.stripGeometry(THREE, o);
  const pos = g.attributes.position, pav = g.attributes.aPav, pk = g.attributes.aPavK, pt = g.attributes.aPavT, idx = g.index;
  const F = P.field(o), halfL = o.len / 2, halfW = o.wid / 2;
  let nan = 0, out = 0, sdErr = 0, yErr = 0, fErr = 0, edge0 = 0, edgeBad = 0, tErr = 0;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), u = pav.getX(i), v = pav.getY(i), d = pav.getZ(i), sh = pav.getW(i);
    if (![x, y, z, u, v, d, sh].every(Number.isFinite)) nan++;
    if (u < -o.shoulderW - 1e-6 || u > o.len + o.shoulderW + 1e-6 || Math.abs(v) > halfW + o.shoulderW + 1e-6) out++;
    // the box SDF, recomputed
    const du = Math.max(-u, u - o.len), dv = Math.abs(v) - halfW;
    const sd = -(Math.hypot(Math.max(du, 0), Math.max(dv, 0)) + Math.min(Math.max(du, dv), 0));
    if (Math.abs(sd - d) > 1e-4) sdErr++;
    if (Math.abs(y - (hAt(x, z) + 0.07)) > 1e-3) yErr++;
    const q = F.at(x, z); if (Math.abs(q.u - u) > 1e-3 || Math.abs(q.v - v) > 1e-3 || Math.abs(q.dEdge - d) > 1e-3) fErr++;
    if (Math.abs(Math.abs(v) - halfW) < 1e-6 && u >= 0 && u <= o.len) { edge0++; if (Math.abs(d) > 1e-6) edgeBad++; }
    if (Math.abs(pt.getX(i) - Math.cos(o.hdg)) > 1e-6 || Math.abs(pt.getZ(i) - Math.sin(o.hdg)) > 1e-6 || pt.getY(i) !== 1) tErr++;
    if (pk.getX(i) !== 0 || pk.getY(i) !== 3 || pk.getZ(i) !== halfW || pk.getW(i) !== halfL) tErr++;
  }
  verdict(nan === 0, `strip: ${pos.count} vertices, ${nan} with a NaN`);
  verdict(out === 0, `strip: every vertex inside the box + shoulder (${out} out)`);
  verdict(sdErr === 0, `strip: dEdge = the box SDF at every vertex (${sdErr} off by > 1e-4)`);
  verdict(edge0 >= 2 * (o.len / 6) && edgeBad === 0, `strip: the pavement's edge is a vertex row (${edge0} vertices at |v| = wid/2, ${edgeBad} with dEdge != 0)`);
  verdict(yErr === 0, `strip: y = heightAt + lift at every vertex (${yErr} off)`);
  verdict(fErr === 0, `strip: field.at agrees with the attributes at every vertex (${fErr} off)`);
  verdict(tErr === 0, `strip: the tangent is the heading, the shoulder keep 1, the class row right (${tErr} off)`);
  // u monotone along a column of constant v: consecutive columns
  const cols = g.userData.pav.cols, rows = g.userData.pav.rows; let mono = 0;
  for (let i = 1; i < cols; i++) if (pav.getX(i * rows) <= pav.getX((i - 1) * rows)) mono++;
  verdict(mono === 0 && cols * rows === pos.count, `strip: u monotone along (${cols} columns x ${rows} rows, ${mono} steps back)`);
  let idxBad = 0; for (let i = 0; i < idx.count; i++) if (idx.getX(i) >= pos.count) idxBad++;
  verdict(idxBad === 0 && idx.count === (cols - 1) * (rows - 1) * 6, `strip: ${idx.count} indices, all in range`);
  // winding: every triangle faces up once draped (the normal's y > 0)
  let down = 0; const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < idx.count; i += 3) { a.fromBufferAttribute(pos, idx.getX(i)); b.fromBufferAttribute(pos, idx.getX(i + 1)); c.fromBufferAttribute(pos, idx.getX(i + 2)); b.sub(a); c.sub(a); if (b.cross(c).y <= 0) down++; }
  verdict(down === 0, `strip: every triangle faces up (${down} wound down)`);
}
{
  const pts = [[-300, -200], [-120, -60], [40, 60], [180, 220], [360, 300]];
  const road = PG.polyRoad(pts, 6);
  const o = { road, w: 6, shoulderW: 3, cls: 'gravel', seed: 5, heightAt: hAt, lift: 0.06, step: 3, shoulderK: (x, z) => (x > 0 ? 0 : 1) };
  const g = P.roadGeometry(THREE, o);
  const pos = g.attributes.position, pav = g.attributes.aPav, pt = g.attributes.aPavT, idx = g.index;
  const F = P.field(o), rows = g.userData.pav.rows, cols = g.userData.pav.cols;
  let nan = 0, dErr = 0, uErr = 0, fErr = 0, kErr = 0, fold = 0, mono = 0;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), u = pav.getX(i), v = pav.getY(i), d = pav.getZ(i);
    if (![x, z, u, v, d].every(Number.isFinite)) nan++;
    if (Math.abs(d - (3 - Math.abs(v))) > 1e-6) dErr++;
    if (u < -1e-3 || u > road.length + 1e-3) uErr++;   // float32 storage: a thousandth
    if (Math.abs(v) < 1e-6) { const q = F.at(x, z); if (Math.abs(q.u - u) > 0.05 || Math.abs(q.v) > 0.05) fErr++; }
    if (pt.getY(i) !== (x > 0 ? 0 : 1)) kErr++;
  }
  for (let i = 1; i < cols; i++) {
    if (pav.getX(i * rows) <= pav.getX((i - 1) * rows)) mono++;
    const t0 = [pt.getX((i - 1) * rows), pt.getZ((i - 1) * rows)], t1 = [pt.getX(i * rows), pt.getZ(i * rows)];
    if (t0[0] * t1[0] + t0[1] * t1[1] <= 0) fold++;
  }
  verdict(nan === 0, `road: ${pos.count} vertices (${cols} x ${rows}), ${nan} with a NaN`);
  verdict(dErr === 0, `road: dEdge = w/2 - |v| at every vertex (${dErr} off)`);
  verdict(uErr === 0 && mono === 0, `road: u = the polyRoad's arclength, 0..${f(road.length, 1)}, monotone (${uErr} out, ${mono} back)`);
  verdict(fErr === 0, `road: field.at on the centre row returns the row's own (u, 0) (${fErr} off)`);
  verdict(fold === 0, `road: the tangent never folds (${fold} turns of more than 90 deg)`);
  verdict(kErr === 0, `road: the shoulder keep rides in aPavT.y (${kErr} off)`);
  const outer = []; // the outer edge longer than the inner on a curve: the row at v = +3 vs v = -3 lengths differ
  let lenP = 0, lenM = 0;
  for (let i = 1; i < cols; i++) { const jP = rows - 1, jM = 0; const a = i * rows, b = (i - 1) * rows;
    lenP += Math.hypot(pos.getX(a + jP) - pos.getX(b + jP), pos.getZ(a + jP) - pos.getZ(b + jP)); lenM += Math.hypot(pos.getX(a + jM) - pos.getX(b + jM), pos.getZ(a + jM) - pos.getZ(b + jM)); }
  verdict(Math.abs(lenP - lenM) > 1 && lenP > 0 && lenM > 0, `road: the two outer rows differ in length on the curve (${f(lenP, 1)} vs ${f(lenM, 1)} m)`);
  let idxBad = 0; for (let i = 0; i < idx.count; i++) if (idx.getX(i) >= pos.count) idxBad++;
  verdict(idxBad === 0, `road: ${idx.count} indices, all in range`);
}

{ // a paved polygon (the port): an L-shaped apron, faces up, dEdge + inside / - out, the band beyond it
  const poly = [[-30, -20], [30, -20], [30, 10], [0, 10], [0, 30], [-30, 30]];
  const g = P.polyGeometry(THREE, { poly, cls: 'concrete', shoulderW: 5, heightAt: hAt, res: 2, yaw: 0.4 });
  const pos = g.attributes.position, pav = g.attributes.aPav, idx = g.index;
  let down = 0, sdBad = 0; const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < idx.count; i += 3) { a.fromBufferAttribute(pos, idx.getX(i)); b.fromBufferAttribute(pos, idx.getX(i + 1)); c.fromBufferAttribute(pos, idx.getX(i + 2)); b.sub(a); c.sub(a); if (b.cross(c).y <= 0) down++; }
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), d = pav.getZ(i); const inside = PG.inPoly(poly, x, z); if ((d > 1e-6) !== inside && Math.abs(d) > 1e-6) sdBad++; }
  const rc = new THREE.Raycaster(new THREE.Vector3(-15, 60, 20), new THREE.Vector3(0, -1, 0));
  verdict(down === 0, `polygon: every triangle faces up (${down} wound down)`);
  verdict(sdBad === 0, `polygon: dEdge's sign is inPoly's at every vertex (${sdBad} off)`);
  verdict(rc.intersectObject(new THREE.Mesh(g, new THREE.MeshBasicMaterial())).length > 0, "polygon: a ray down onto the L's inner corner hits it");
}

// ---- 3. THE RECORDER ------------------------------------------------------------
console.log('3. THE RECORDER - sitePaintStrip on the analytic HOME');
{
  const world = CORE.makeWorld(0);
  const A = world.aerodromes.find(a => a.id === 'HOME'), R = CORE.siteRunway(A);
  // a counting context: how many opaque fills and strokes the painter makes
  let fills = 0, faint = 0, strokes = 0;
  const cnt = { globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, clearRect() {}, fillRect() { if (this.globalAlpha < 0.999) faint++; else fills++; }, beginPath() {}, moveTo() {}, lineTo() {}, stroke() { strokes++; }, closePath() {}, fill() {} };
  CORE.sitePaintStrip(cnt, R, R.len, R.wid, true);
  const M = P.marksOf(R, CORE.sitePaintStrip);
  verdict(M.raw === fills && fills > 40, `every opaque fill recorded: ${M.raw} of ${fills} (${faint} translucent mowing stripes skipped)`);
  verdict(M.segs.length === 2 * strokes && strokes === 2, `the chevrons: ${M.segs.length} segments from ${strokes} strokes`);
  const inBox = M.rects.every(r => r[0] >= -1e-6 && r[1] <= R.len + 1e-6 && r[2] >= -R.wid / 2 - 1e-6 && r[3] <= R.wid / 2 + 1e-6);
  verdict(inBox, `every rect inside the strip's box (${M.rects.length} rects/rules from ${M.raw} fills)`);
  const rules = M.rects.filter(r => r[5] > 0), centre = rules.find(r => Math.abs(r[5] - 29) < 1e-6 && r[6] === 0);
  verdict(!!centre && Math.abs(centre[7] - 11) < 1e-6 && Math.abs(centre[3] - centre[2] - 0.6) < 1e-6, `the centre dashes are ONE rule: period 29 m, 11 m dashes, 0.6 m wide` + (centre ? '' : ' (missing)'));
  const thr = M.rects.filter(r => r[5] > 0 && r[6] === 1 && Math.abs(r[5] - 4) < 1e-6);
  verdict(thr.length === 2 && thr.some(r => r[0] < 10) && thr.some(r => r[1] > R.len - 10), `the threshold bars: a v-rule of period 4 m at each end (${thr.length})`);
  const hold = M.rects.filter(r => r[4] === 1);
  verdict(hold.length >= 4 && hold.every(r => r[4] === 1), `the hold-short lines are yellow (kind 1): ${hold.length} rects/rules`);
  verdict(M.rects.every(r => r[4] === 0 || r[4] === 1 || r[4] === 2), 'every kind is 0 (white), 1 (yellow) or 2 (mown)');
  // the paint's frame: t from end 1; u from end 0 - the far threshold bar of the paint is the near of u
  const rm = P.roadMarks(400, 6, 'asphalt'), rg = P.roadMarks(400, 6, 'gravel'), rn = P.roadMarks(400, 4, 'asphalt');
  verdict(rm.rects.length === 3 && rg.rects.length === 0 && rn.rects.length === 2, `road marks: asphalt 6 m = 2 edge lines + a centre rule (${rm.rects.length}), 4 m = edge lines only (${rn.rects.length}), gravel none (${rg.rects.length})`);
}

// ---- 4. THE HOOK RULES ---------------------------------------------------------
console.log('4. THE HOOK RULES - one program for every pavement');
{
  const src = P.hook.toString(), G = P.GLSL;
  verdict(/^\s*sh\s*=>\s*\{\s*if \(typeof ATMO !== 'undefined'\) ATMO\.inject\(sh\);/.test(src), 'ATMO.inject is the hook\'s first statement');
  const all = Object.values(G).join('\n');
  verdict(!/textureGrad|textureLod/.test(all), 'no textureGrad / textureLod on the arrays (fxc)');
  // every loop bound with a texture read inside is a uniform
  const loops = all.match(/for \(int \w+ = 0; \w+ < [^;]+;/g) || [];
  const bad = loops.filter(l => !/< u[A-Z]\w*/.test(l) && !/< (?:2|4);/.test(l) && !/<= 1;/.test(l));
  verdict(bad.length === 0, `every loop's bound is a uniform or a small constant without a texture read (${loops.length} loops${bad.length ? ': ' + bad.join(' | ') : ''})`);
  const samplers = (all.match(/sampler2D(?:Array)?\s+[^;]+;/g) || []).reduce((n, d) => n + d.split(',').length, 0);
  verdict(samplers <= 8, `${samplers} samplers declared (the budget is 8 beside three's own)`);
  // every anchor the hook replaces exists in r186's standard shaders
  const vs = THREE.ShaderLib.standard.vertexShader, fsrc = THREE.ShaderLib.standard.fragmentShader;
  const anchors = ['#include <map_fragment>', '#include <roughnessmap_fragment>', '#include <normal_fragment_maps>', '#include <lights_fragment_end>', '#include <dithering_fragment>'];
  const missing = anchors.filter(a => fsrc.indexOf(a) < 0).concat(vs.indexOf('#include <begin_vertex>') < 0 ? ['#include <begin_vertex>'] : []);
  verdict(missing.length === 0, `every anchor the hook replaces is in r${THREE.REVISION}'s standard shaders` + (missing.length ? ': missing ' + missing.join(', ') : ''));
  // every GLSL uniform is a material uniform, and the hook's source does not change with the strip
  const lib = P.library(THREE, P.keysFor(['concrete', 'gravel']));
  const m1 = P.make(THREE, { lib, cls: 'concrete', marks: { rects: [[0, 10, -1, 1, 0, 0, 0, 0]], segs: [] } });
  const m2 = P.make(THREE, { lib, cls: 'gravel' });
  const declared = new Set(); for (const mm of all.match(/uniform [^;]+;/g) || []) for (const n of mm.replace(/uniform (?:highp )?\w+ /, '').replace(';', '').split(',')) declared.add(n.trim().replace(/\[.*\]/, ''));
  const undeclared = Array.from(declared).filter(n => !(n in m1.uniforms));
  verdict(undeclared.length === 0, `every GLSL uniform is in the material's table (${declared.size})` + (undeclared.length ? ': ' + undeclared.join(', ') : ''));
  verdict(m1.customProgramCacheKey() === m2.customProgramCacheKey() && m1.customProgramCacheKey().startsWith('pavement:'), 'the program key is the hook\'s, the same for a concrete strip and a gravel road');
  verdict(m1.uniforms.uMarkN.value === 1 && m2.uniforms.uMarkN.value === 0 && m1.uniforms.uLane.value.x === 1 && m2.uniforms.uLane.value.x === 0 && m2.uniforms.uRut2.value.z === 1, 'the per-material rows: the marks, the lanes (concrete), the ruts (gravel)');
  verdict(m1.transparent === true && m1.depthWrite === false, 'the material is transparent (the fade) and does not write depth');
  P.dispose(m1); P.dispose(m2);
}

// ---- 5. THE RECIPE ----------------------------------------------------------------
console.log('5. THE RECIPE - the classes name baked sets');
{
  const keys = new Set(TEX.PAVEMENT_TEX_CREDITS.map(r => r.key));
  const missing = [];
  for (const c of P.CLASSES) for (const s of P.SLOTS) if (!keys.has(P.CLASS_DEF[c][s])) missing.push(c + '.' + s + '=' + P.CLASS_DEF[c][s]);
  verdict(missing.length === 0, `every class slot names a set the prep baked (${P.CLASSES.length} classes x ${P.SLOTS.length} slots)` + (missing.length ? ': ' + missing.join(', ') : ''));
  verdict(TEX.PAVEMENT_TEX_CREDITS.every(r => r.metres > 0 && r.licence === 'CC0'), `every set has a size in metres and is CC0 (${TEX.PAVEMENT_TEX_CREDITS.length} sets)`);
  const media = fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'pavement_tex.js'), 'utf8').match(/media\/tex\/pavement\/[^']+.jpg/g) || [];
  const absent = media.filter(m => !fs.existsSync(path.join(__dirname, '..', m)));
  verdict(media.length === TEX.PAVEMENT_TEX_CREDITS.length * 4 && absent.length === 0, `the manifest's ${media.length} files are on disk` + (absent.length ? ' (missing ' + absent.length + ')' : ''));
  verdict(P.CLASSES.every(c => (c === 'concrete' || c === 'asphalt') ? P.CLASS_DEF[c].hexRot <= 10 : P.CLASS_DEF[c].hexRot >= 45), 'a paved class turns its hex tiles by 10 deg at most, a loose one freely');
  const e1 = P.exportRecipe(); P.set(THREE, e1); const e2 = P.exportRecipe();
  verdict(JSON.stringify(e1) === JSON.stringify(e2), 'export -> set -> export is bit-identical');
  const bad = Object.entries(P.RECIPE).filter(([k, v]) => k !== 'grade' && !(Number.isFinite(v)));
  verdict(bad.length === 0, `every knob's default is a finite number (${Object.keys(P.RECIPE).length - 1} knobs)`);
}

// ---- 6. THE COVER'S QUERY (v1.17) ---------------------------------------------------
console.log('6. COVERAT - what the cover ring may plant');
{
  const bad = P.CLASSES.filter(c => PG.PAVE_BAND[c] !== P.CLASS_DEF[c].band);
  verdict(bad.length === 0, 'PAVE_BAND (the core) equals CLASS_DEF.band (the viewer) for every class' + (bad.length ? ': ' + bad.join(', ') : ''));
  verdict(Math.abs(PG.PAVE_FADE - P.RECIPE.fadeW) < 1e-9, `PAVE_FADE ${PG.PAVE_FADE} = the recipe's fadeW ${P.RECIPE.fadeW}`);
  const j = require('./fixtures/island_jolene.json'), w0 = CORE.makeWorld(0), rec = PG.unwrap(j).rec, O = PG.compose(rec, w0, {});
  const F = O.frame, at = (lx, lz) => { const p = F.toWorld(lx, lz); return O.coverAt(p[0], p[1]); };
  const H = rec.layers.runways.find(r => r.id === 'HOME'), c = H.c, d = [Math.cos(H.hdg), Math.sin(H.hdg)], n = [-d[1], d[0]];
  const side = k => at(c[0] - n[0] * k, c[1] - n[1] * k);
  const c0 = at(c[0], c[1]), cb = side(H.wid / 2 + H.band - 1), cf = side(H.wid / 2 + H.band + 3), cz = side(H.wid / 2 + H.band + 20), far = at(4000, -8000);
  verdict(c0 && c0.kill === 1 && c0.cls === 'concrete', `13/31's centre: kill ${c0 && c0.kill} on ${c0 && c0.cls}`);
  verdict(cb && cb.kill === 1, `the band (1 m inside its edge): kill ${cb && cb.kill}`);
  verdict(cf && cf.kill > 0 && cf.kill < 1 && cf.boost > 0, `the fade (3 m past the band): kill ${cf && f(cf.kill)}, boost ${cf && f(cf.boost)}`);
  verdict(cz === null || (cz.kill === 0 && cz.boost === 0), `20 m past the band: nothing (${JSON.stringify(cz)})`);
  verdict(far === null, 'the far field answers null');
  const plot = O.records.plots.find(p => p.kind === 'residential');
  const inP = plot && at(plot.front[0] + plot.n[0] * (plot.depth * 0.5), plot.front[1] + plot.n[1] * (plot.depth * 0.5));
  verdict(inP && inP.kind === 'lawn' && inP.grass && inP.grass.h > 0 && inP.kill === 0, `a residential plot's middle: ${JSON.stringify(inP)}`);
  verdict(PG.zoneGrass({ kind: 'industrial' }).kind === 'none' && PG.zoneGrass({ kind: 'residential', rules: { grass: { kind: 'meadow' } } }).kind === 'meadow', 'the zone rule: industrial none, an override wins');
  const rd = w0.roadNet.roads.find(r => r.cls === 'road'), q = w0.coverAt(rd.pts[2][0], rd.pts[2][1]), h0 = w0.coverAt(-520, 0);
  verdict(q && q.kill === 1 && q.cls === 'gravel', `the analytic road: ${JSON.stringify(q)}`);
  verdict(h0 && Math.abs(h0.kill - 0.6) < 1e-9 && h0.cls === 'grass', `the analytic HOME (a grass strip thins, never bare): ${JSON.stringify(h0)}`);
  let t0 = Date.now(); for (let i = 0; i < 100000; i++) O.coverAt(-300 + i % 400, 200 + (i * 7) % 400); const ms = Date.now() - t0;
  verdict(ms < 2000, `100 000 coverAt calls in ${ms} ms`);
}

// ---- 7. THE GUARDRAIL (2026-09-22) --------------------------------------------------
console.log('7. THE GUARDRAIL - the rule, the runs, the beam');
{
  const GR = require('../src/viewer/guardrail.js');
  const road = (n, f) => { const pts = []; for (let i = 0; i <= n; i++) pts.push(f(i / n)); return PG.polyRoad(pts, 6); };
  // a) flat and straight: nothing
  const flat = road(20, u => [u * 400, 0]);
  verdict(GR.plan({ path: flat, w: 6, hAt: () => 10 }).length === 0, 'a flat straight road rails nothing');
  // b) a shelf on a bend: the OUTSIDE only, and the beam stands outside the pavement
  const bend = road(40, u => { const a = u * Math.PI * 0.9; return [120 * Math.cos(a), 120 * Math.sin(a)]; });
  const shelf = (x, z) => 40 - Math.max(0, Math.hypot(x, z) - 126) * 0.55;
  const runs = GR.plan({ path: bend, w: 6, hAt: shelf });
  verdict(runs.length === 1 && runs[0].side === 1, `the shelf bend: ${runs.length} run, side ${runs[0] && runs[0].side} (the outside)`);
  verdict(runs[0] && runs[0].drop > 5 && runs[0].rails === 1, `a ${f(runs[0] && runs[0].drop, 1)} m fall takes one beam (the second wants ${GR.DEF.twoAt} m)`);
  { const cliff = (x, z) => 40 - Math.max(0, Math.hypot(x, z) - 126) * 1.6;
    const r2 = GR.plan({ path: bend, w: 6, hAt: cliff });
    verdict(r2.length === 1 && r2[0].rails === 2, `a ${f(r2[0] && r2[0].drop, 1)} m cliff gets the picture's second beam`); }
  const G = GR.geometry(THREE, { path: bend, w: 6, runs, heightAt: shelf, seed: 3 });
  const pos = G.geo.attributes.position;
  let nan = 0, rMin = Infinity, rMax = 0, yMin = Infinity, yMax = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (![x, y, z].every(Number.isFinite)) nan++;
    const r = Math.hypot(x, z); rMin = Math.min(rMin, r); rMax = Math.max(rMax, r);
    const g = shelf(x, z); yMin = Math.min(yMin, y - g); yMax = Math.max(yMax, y - g);
  }
  verdict(nan === 0, 'no NaN in the beam');
  verdict(rMin > 123 && rMax < 125, `every vertex outside the pavement (r ${f(rMin, 2)}..${f(rMax, 2)}; the road's edge is 123.0, the post line 123.55)`);
  verdict(yMin > -GR.DEF.postBury - 0.7 && yMax < GR.DEF.railTop + GR.DEF.rail2 + 0.45, `the beam between ${f(yMin, 2)} and ${f(yMax, 2)} m over the ground`);
  verdict(G.tris / G.metres < 60, `${f(G.tris / G.metres, 1)} triangles a metre (the beam and a post every 4 m)`);
  // c) the hysteresis: a 10 m hit is dropped, and `keep` forbids
  const spot = road(60, u => [u * 600, 0]);
  const dip = (x, z) => 10 - (x > 300 && x < 308 ? 4 : 0);
  verdict(GR.plan({ path: spot, w: 6, hAt: dip }).length === 0, `an ${GR.DEF.minRun} m rule drops a single 8 m dip`);
  verdict(GR.plan({ path: bend, w: 6, hAt: shelf, keep: () => false }).length === 0, 'keep() false forbids every run (a plot, a junction)');
  verdict(GR.plan({ path: bend, w: 2.5, hAt: shelf }).length === 0, `a road under ${GR.DEF.minW} m wide carries no rail (a track)`);
  // d) the switch
  const m = GR.build(THREE, { path: bend, w: 6, runs, heightAt: shelf });
  GR.setOn(false); const off = !m.visible;
  const m2 = GR.build(THREE, { path: bend, w: 6, runs, heightAt: shelf });
  verdict(off && !m2.visible, 'GRAPHICS > guardrails off hides every rail, and one built while off');
  GR.setOn(true);
  verdict(m.visible && m2.visible, 'and on shows them again');
  GR.forget(m); GR.forget(m2);
  // e) the premises: a road may say
  verdict(GR.build(THREE, { path: bend, w: 6, mode: 'off', heightAt: shelf, hAt: shelf }) === null, "a road's `rail: 'off'` builds nothing");
  const all = GR.build(THREE, { path: bend, w: 6, mode: 'on', heightAt: shelf, hAt: shelf });
  verdict(all && all.userData.guardrail.runs === 2, "`rail: 'on'` rails both sides whole");
  GR.forget(all);
}

console.log('GATE PAVEMENT: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
