// ===========================================================================
// THE PAVEMENT (roads & runways, 2026-09-21) — ONE material for every strip,
// taxiway and road: concrete, asphalt, gravel, dirt, sand, grass, with its
// shoulders. Bench-first (tools/_pavement.html); the game's port follows.
// ===========================================================================
// WHAT THIS FILE OWNS
//   PAVEMENT.CLASSES           the six classes and what each reaches for
//   PAVEMENT.RECIPE            the knobs (one table; the bench edits it, the game ships it)
//   PAVEMENT.stripGeometry     a runway with its shoulders, draped, with the attributes
//   PAVEMENT.roadGeometry      a road ribbon along a polyRoad, the same attributes
//   PAVEMENT.field             the CPU twin of the attributes (the scatter, the gate)
//   PAVEMENT.marksOf           the strip's paint as a RECT LIST, recorded off sitePaintStrip
//   PAVEMENT.roadMarks         a road's edge / centre lines by class
//   PAVEMENT.library           the sets a recipe names -> two texture arrays
//   PAVEMENT.make              the material (MeshStandardMaterial + the hook); { lib, cls, marks, road }
//   PAVEMENT.GLSL / hook       the shader text and the hook, for the gate
//
// THE IDEA. A road or a runway is a RIBBON: every vertex knows how far along
// it is (u, metres), how far across (v, metres, 0 on the centreline) and how
// far from the pavement's edge (dEdge, negative on the shoulder). Everything
// the surface wears - the paving lanes and their joints, the cracks, the
// patches, the moss at the edges, the markings, the rubber in the touchdown
// zone, the ruts, the gravel band, the grass creeping in - is a function of
// (u, v, dEdge) and a seed, evaluated per pixel, so it is crisp at 2 m and
// correct at 2 km and never repeats. The scanned sets under it are hex-tiled
// (Mikkelsen 2022, the splat's own sTile) so the texture never repeats
// either. The last metres of the shoulder fade to alpha 0, and the island's
// own ground shows through: the mesh blends into whatever it is laid on.
//
// THE MARKINGS are not a picture. src/core/25_airfield.js's sitePaintStrip
// draws the strip's paint into a 2D context; handed a RECORDING context (a
// metric canvas, len x wid) it yields the rectangles in metres, and the
// shader draws each as an anti-aliased box - the same source of truth the
// analytic field has always had, at any distance. Progressions (the centre
// dashes every 29 m, the hold-short dashes every 3 m) collapse to RULES.
//
// RULES (the splat's, learned on ANGLE/D3D): the texture arrays are read
// with implicit texture() only (textureGrad on an array is an fxc internal
// error); loop bounds that hold a texture read are UNIFORMS; one struct
// through the chain, no `out` parameters; sRGB is decoded in GLSL (an sRGB
// array upload is refused). Nothing per strip is interpolated into the GLSL:
// the hook's source is the program's cache key, so every pavement on an
// island is one program.
'use strict';
const PAVEMENT = (() => {
  const CLASSES = ['concrete', 'asphalt', 'gravel', 'dirt', 'sand', 'grass'];
  // what each class reaches for in the library (keys of PAVEMENT_TEX_SETS), and its own numbers.
  // lanes: the concrete's paving lanes; hexRot: degrees a hex tile may turn (a brushed finish is
  // directional, loose material is not); rut: whether the pavement itself carries ruts.
  const CLASS_DEF = {
    // paved: base + damage (cracked), the shoulder band, the grass beyond, the tracks on the band, the moss, the far macro
    concrete: { base: 'concreteA', damage: 'concreteB', shoulder: 'dry',     grass: 'grassG', tracks: 'mudAir',  moss: 'concreteM', macro: 'concreteD',     lanes: 1, hexRot: 8,   rut: 0, marks: 1, rubber: 1, band: 4, roadShoulder: 'gravelB' },
    asphalt:  { base: 'asphaltW',  damage: 'asphaltC',  shoulder: 'gravelB', grass: 'grassG', tracks: 'mudAir',  moss: 'concreteM', macro: 'asphaltaerial', lanes: 0, hexRot: 8,   rut: 0, marks: 1, rubber: 1, band: 1.5 },
    // soft (2026-09-22): base + damage = the COARSE stony patches, tracks = the COMPACTED wheel band, moss = the
    // SECOND GROUND in patches (and the tyres' tread, oriented along the road), shoulder = the border's stuff
    gravel:   { base: 'gravelG',   damage: 'rockG',     shoulder: 'gravelB', grass: 'grassG', tracks: 'gravelF', moss: 'gravelB',   macro: 'dirtAir',       lanes: 0, hexRot: 90, rut: 1, marks: 0, rubber: 0, band: 2.5, soft: [0.6, 0.6, 0.55, 0.8] },
    dirt:     { base: 'dirtS',     damage: 'trailR',    shoulder: 'dry',     grass: 'grassG', tracks: 'dirtG',   moss: 'tracksM',   macro: 'dirtAir',       lanes: 0, hexRot: 90, rut: 1, marks: 0, rubber: 0, band: 1.5, soft: [0.6, 0.7, 0.8, 1.0] },
    sand:     { base: 'sandC',     damage: 'gravelS',   shoulder: 'sandC',   grass: 'grassG', tracks: 'dirtG',   moss: 'mudAir',    macro: 'dirtAir',       lanes: 0, hexRot: 90, rut: 1, marks: 0, rubber: 0, band: 1.0, soft: [0.5, 0.5, 0.6, 1.0] },
    grass:    { base: 'fieldgrass', damage: 'grassS',   shoulder: 'grassG',  grass: 'lush',   tracks: 'grassP', moss: 'grassG',     macro: 'fieldgrass',   lanes: 0, hexRot: 90, rut: 1, marks: 1, rubber: 0, band: 1.5, soft: [0.6, 0.3, 0.85, 0.7] },
  };

  const SLOTS = ['base', 'damage', 'shoulder', 'grass', 'tracks', 'moss', 'macro'];
  // THE RECIPE: every knob the bench edits, with the defaults the first shot was judged at.
  // Distances in metres, strengths 0..1 unless said. `grade` per set key: [gain, saturation].
  const RECIPE = {
    hexOn: 1, hexDepth: 0.25, hexCells: 2, hexRotK: 1,
    macroLuma: 0.35, macroHue: 0.06, macroRough: 0.15,
    laneW: 6.0, slabL: 18.0, jointW: 0.03, jointDepth: 1.0, laneTone: 0.13, jointChip: 0.6, jointDirt: 0.55, spall: 0.3,
    crackK: 0.5, crackW: 0.02, crackCell: 2.6, damageK: 0.5,
    patchK: 0.06, patchTone: 0.45, patchRough: 0.85, patchLen: 14,
    mossK: 0.55, mossEdge: 7.0, mossJoint: 0.5, mossScale: 4.0,
    stainK: 0.45, stainScale: 14, stainRough: 0.25,
    wet: 0.35, puddleCover: 0.25, puddleScale: 4.0, puddleEdge: 0.05,
    // paintAge/chalk are the MIDDLE of the road now (2026-09-23): 0.85 was the WWII runway's, and with
    // it a road's lines were gone before they were drawn. The extremes live in PRESETS - `fresh` 0.3,
    // `worn` 0.9 - which is where Jolene's strips take theirs.
    paintAge: 0.5, paintRough: 0.7, chalk: 0.55, paintOnGrass: 0.35,
    rubberK: 0.7, rubberStart: 120, rubberPeak: 420, rubberEnd: 900, rubberTrack: 2.4, rubberSpread: 1.4, rubberStreak: 0.6,
    rutTrack: 0.85, rutW: 0.3, rutDepth: 0.7, rutAmp: 1.0, rutLambda: 80, rutGrass: 0.6, shoulderPaths: 2,
    roadLane: 3.5, wheelPolish: 0.5,
    // THE BAND MEETS THE ISLAND (2026-09-23, the user on an aerial of Jolene: "there is a huge
    // difference in light and color between the runway sides and the surrounding terrain ... the
    // colours should blend better with their environment ... the current settings are too harsh").
    // Measured at 620 m over 13/31: the band read luma 136 against 84-96 for the graded grass beside
    // it and 41-59 for the muskeg beyond - 2.3x to 3.3x, and neutral grey against a green island.
    // Two levers, both here: the grass reaches FURTHER in over the band and its edge is raggeder
    // (below), and the `dry` set's own grade is pulled down and turned toward the ground (in `grade`).
    edgeChip: 0.6, band: -1, grassReach: 13, fadeW: 6, bandNoise: 0.85,
    detailFrom: 250, detailTo: 900, normalFrom: 120, normalTo: 500,
    specK: 1.0, nrmK: 1.0,
    softMix: 0.8, coarseK: 0.7, wheelBand: 0.85, treadK: 0.8, paintRelief: 1.0, mow: 0.6, edgeSoft: 2.6, grassRough: 0.82,
    grade: { gravelR: [1.0, 0.55], gravelK: [0.95, 0.55], gravelS: [1.0, 0.5], dry: [0.40, 0.58, 0.96, 1.0, 0.91], concreteA: [1.7, 0.45, 0.94, 0.98, 1.06], concreteB: [1.25, 0.6, 0.95, 0.98, 1.05], concreteD: [1.1, 0.7], mudAir: [1.1, 0.6], dirtP: [1.0, 0.7], grass: [0.9, 1.0], gravelG: [0.85, 0.7, 1.06, 1.0, 0.9], gravelF: [0.6, 0.6, 1.12, 1.0, 0.84], gravelB: [1.25, 0.55, 1.0, 1.0, 0.92], rockG: [0.75, 0.7, 1.02, 1.0, 0.94], dirtS: [2.9, 0.7], trailR: [0.55, 0.7], dirtG: [1.0, 0.8], tracksM: [2.6, 0.35], grassG: [0.9, 1.0, 0.9, 1.0, 0.8], grassP: [0.55, 0.9, 0.95, 1.0, 0.9], grassS: [1.6, 0.9], leafygrass: [0.8, 0.9, 0.85, 1.0, 0.75], fieldgrass: [0.85, 0.85], lush: [0.85, 1.0], sandC: [1.3, 0.8], gravelS: [0.6, 0.5] },
  };
  let R = JSON.parse(JSON.stringify(RECIPE));
  // THE KNOBS (the port, 2026-09-22): one table for the bench's aside and the editor's PAVEMENT
  // section - [key, label, min, max, step]; a row of one string is a section heading
  const KNOBS = [
    ['— tiling & macro —'],
    ['hexOn', 'hex tiling (0/1)', 0, 1, 1], ['hexDepth', 'hex blend depth', 0.02, 1, 0.02], ['hexCells', 'hex cells per tile', 0.5, 6, 0.5], ['hexRotK', 'hex rotation (x class)', 0, 1, 0.05],
    ['macroLuma', 'macro luminance', 0, 1, 0.02], ['macroHue', 'macro hue turn', 0, 0.3, 0.01], ['macroRough', 'macro roughness', 0, 0.5, 0.01],
    ['— lanes & joints (concrete) —'],
    ['laneW', 'lane width (m)', 2, 12, 0.25], ['slabL', 'slab length (m)', 3, 60, 1], ['jointW', 'joint half-width (m)', 0.005, 0.12, 0.005], ['jointDepth', 'joint relief', 0, 3, 0.05],
    ['laneTone', 'lane tone ±', 0, 0.3, 0.01], ['jointChip', 'joint chipping', 0, 2, 0.05], ['jointDirt', 'joint dirt + spall', 0, 1, 0.02],
    ['— cracks & patches —'],
    ['crackK', 'crack amount', 0, 1, 0.02], ['crackW', 'crack width (m)', 0.005, 0.08, 0.005], ['crackCell', 'crack cell (m)', 0.5, 12, 0.25], ['damageK', 'damage set where cracked', 0, 1, 0.02],
    ['patchK', 'patch probability', 0, 0.6, 0.01], ['patchTone', 'patch tone', 0.1, 1, 0.02], ['patchRough', 'patch roughness', 0.2, 1, 0.02], ['patchLen', 'patch cell (m)', 4, 40, 1],
    ['— moss & stains —'],
    ['mossK', 'moss amount', 0, 1, 0.02], ['mossEdge', 'moss reach from edge (m)', 0, 20, 0.5], ['mossJoint', 'moss in joints', 0, 1, 0.02], ['mossScale', 'moss scale (m)', 1, 20, 0.5],
    ['stainK', 'damp stains', 0, 1, 0.02], ['stainScale', 'stain scale (m)', 3, 60, 1], ['stainRough', 'stain roughness drop', 0, 0.6, 0.02],
    ['— wet —'],
    ['wet', 'wet film', 0, 1, 0.02], ['puddleCover', 'puddle cover', 0, 0.8, 0.01], ['puddleScale', 'puddle scale (m)', 1, 20, 0.5], ['puddleEdge', 'puddle edge', 0.005, 0.2, 0.005],
    ['— markings —'],
    ['paintAge', 'paint age', 0, 1.2, 0.02], ['paintRough', 'paint roughness', 0.2, 1, 0.02], ['chalk', 'chalking', 0, 1, 0.02], ['paintOnGrass', 'mown line on grass', 0, 1, 0.02], ['paintRelief', 'paint edge relief', 0, 3, 0.1],
    ['— rubber (touchdown) —'],
    ['rubberK', 'rubber amount', 0, 1, 0.02], ['rubberStart', 'rubber from (m)', 0, 400, 10], ['rubberPeak', 'rubber peak (m)', 50, 800, 10], ['rubberEnd', 'rubber to (m)', 100, 1500, 10],
    ['rubberTrack', 'gear track half (m)', 0, 6, 0.1], ['rubberSpread', 'rubber spread (m)', 0.2, 5, 0.1], ['rubberStreak', 'streak density', 0, 1, 0.02],
    ['— ruts & tracks —'],
    ['rutTrack', 'half-track (m: 0.85 = a 1.7 m pickup)', 0.35, 1.6, 0.05], ['rutW', 'rut width (m)', 0.1, 0.8, 0.02], ['rutDepth', 'rut relief', 0, 2, 0.05], ['rutAmp', 'rut meander (m)', 0, 3, 0.1], ['rutLambda', 'meander length (m)', 10, 200, 5],
    ['rutGrass', 'grass stripe between', 0, 1, 0.02], ['shoulderPaths', 'shoulder paths (n)', 0, 4, 1],
    ['roadLane', 'lane width (m, paved)', 2.6, 5, 0.1], ['wheelPolish', 'traffic polish in the wheel paths', 0, 1, 0.02],
    ['— soft ground —'],
    ['softMix', 'second ground in patches', 0, 1, 0.02], ['coarseK', 'coarse stony patches', 0, 1, 0.02], ['wheelBand', 'compacted wheel band', 0, 1, 0.02], ['treadK', 'tyre tread in the tracks', 0, 1, 0.02],
    ['edgeSoft', 'soft edge spread (m)', 0.3, 5, 0.1], ['mow', 'mowing stripes (grass)', 0, 1, 0.05], ['grassRough', 'soft roughness floor', 0.5, 1, 0.02],
    ['— edge zone —'],
    ['edgeChip', 'edge chipping (m)', 0, 2, 0.05], ['band', 'gravel band (m, -1 = class)', -1, 40, 0.5], ['bandNoise', 'band raggedness', 0, 1, 0.02], ['grassReach', 'grass creeps in over (m)', 0.5, 30, 0.5], ['fadeW', 'fade to terrain over (m)', 0.5, 30, 0.5],
    ['— distance —'],
    ['detailFrom', 'detail fades from (m)', 20, 1500, 10], ['detailTo', 'detail gone by (m)', 50, 3000, 10], ['normalFrom', 'normal fades from (m)', 10, 1000, 10], ['normalTo', 'normal gone by (m)', 30, 2000, 10],
    ['specK', 'specular (haze fade x)', 0, 2, 0.05], ['nrmK', 'normal strength', 0, 3, 0.05],
  ];
  // THE PER-ENTRY KNOBS: the handful a strip or a road may own (contract v1.16 `pav`); the rest is the
  // material's character, the premises' (rec.pavement) or the module's
  const ENTRY_KNOBS = ['paintAge', 'crackK', 'rubberK', 'laneW', 'wet', 'mossK', 'patchK'];
  // THE PRESETS: a runway look is a class + one of these (the bench's judged exports)
  const PRESETS = {
    fresh: { crackK: 0.12, damageK: 0.3, paintAge: 0.3, chalk: 0.3, mossK: 0.15, patchK: 0.02, laneW: 7.5, stainK: 0.25 },
    worn:  { crackK: 0.6, damageK: 0.6, paintAge: 0.9, chalk: 0.8, mossK: 0.7, patchK: 0.08, laneW: 6.1, stainK: 0.5, rubberK: 0 },   // the WWII field: no jet ever landed
  };
  // resolve(entry, rec): the three levels laid one over the other - the module's defaults, the premises'
  // `pavement`, the entry's `pav` - plus the look's preset between the first two; returns { recipe,
  // cls, band, marks, preset }. One function, read by both renderers and by GATE PREMISES.
  function resolve(entry, rec, look) {
    const L = look || null, cls = L && L.cls ? L.cls : (entry && entry.cls && CLASSES.indexOf(entry.cls) >= 0 ? entry.cls : 'gravel');
    const r = JSON.parse(JSON.stringify(RECIPE));
    const lay = o => { if (!o) return; for (const k in o) { if (k === 'grade') Object.assign(r.grade, o.grade); else if (k in RECIPE && Number.isFinite(+o[k])) r[k] = +o[k]; } };
    if (L && L.preset && PRESETS[L.preset]) lay(PRESETS[L.preset]);
    lay(rec && rec.pavement);
    const pav = entry && entry.pav; if (pav) { const own = {}; for (const k of ENTRY_KNOBS) if (pav[k] !== undefined && pav[k] !== null) own[k] = pav[k]; lay(own); }
    const band = entry && entry.band !== undefined && entry.band !== null ? +entry.band : (CLASS_DEF[cls] ? CLASS_DEF[cls].band : 2);
    return { recipe: r, cls, band, marks: (pav && pav.marks) || 'auto', preset: L && L.preset || null };
  }

  // ---- the attributes: strip -------------------------------------------------
  // A runway with its shoulders. u along (0 at end 0, +len at end 1), v across (+ on the right-hand
  // side looking along +u, the polyRoad's `n`), dEdge = the box SDF of the pavement (+ inside, - on
  // the shoulder). Row lines are PINNED at the edge, the band and the fade so the laws land on a
  // vertex; the rest is a grid at resU x resV. Draped: y = heightAt(x, z) + lift.
  function rowsAcross(halfW, shW, band, fadeW, resV) {
    const pins = [0, halfW, halfW + Math.max(0.3, band), halfW + Math.max(band + 0.6, shW - fadeW), halfW + shW];
    const out = new Set();
    for (const p of pins) out.add(+Math.min(p, halfW + shW).toFixed(3));
    const n = Math.max(2, Math.ceil(halfW / resV));
    for (let i = 1; i < n; i++) out.add(+(halfW * i / n).toFixed(3));
    const m = Math.max(1, Math.ceil(shW / resV));
    for (let i = 1; i < m; i++) out.add(+(halfW + shW * i / m).toFixed(3));
    const pos = Array.from(out).sort((a, b) => a - b);
    return pos.slice(1).reverse().map(p => -p).concat(pos);   // symmetric, -.. 0 ..+
  }
  function stripFrame(o) {
    const hdg = o.hdg || 0, c = Math.cos(hdg), s = Math.sin(hdg);
    const T = [c, s], N = [s, -c];                            // the right-hand side (polyRoad's n = [tg.z, -tg.x])
    const cx = o.cx || 0, cz = o.cz || 0, halfL = o.len / 2, halfW = o.wid / 2;
    return { T, N, cx, cz, halfL, halfW,
      toWorld: (u, v) => [cx + T[0] * (u - halfL) + N[0] * v, cz + T[1] * (u - halfL) + N[1] * v],
      toLocal: (x, z) => { const dx = x - cx, dz = z - cz; return [dx * T[0] + dz * T[1] + halfL, dx * N[0] + dz * N[1]]; } };
  }
  const sdBox = (u, v, halfL, halfW, len) => { const du = Math.max(-u, u - len), dv = Math.abs(v) - halfW; return -(Math.hypot(Math.max(du, 0), Math.max(dv, 0)) + Math.min(Math.max(du, dv), 0)); };
  function stripGeometry(THREE, o) {
    const cls = CLASSES.indexOf(o.cls || 'concrete'), seed = o.seed || 0, shW = o.shoulderW !== undefined ? o.shoulderW : 12;
    const lift = o.lift !== undefined ? o.lift : 0.07, resU = o.resU || 6, resV = o.resV || 3;
    const band = o.band !== undefined ? o.band : CLASS_DEF[CLASSES[cls]].band, fadeW = o.fadeW !== undefined ? o.fadeW : R.fadeW;
    const F = stripFrame(o), halfL = F.halfL, halfW = F.halfW, len = o.len;
    const V = rowsAcross(halfW, shW, band, fadeW, resV);
    const nu = Math.max(2, Math.ceil((len + 2 * shW) / resU));
    const U = []; for (let i = 0; i <= nu; i++) U.push(-shW + (len + 2 * shW) * i / nu);
    // the pavement's own ends pinned too (u = 0 and u = len rows)
    for (const p of [0, len]) if (!U.some(x => Math.abs(x - p) < 1e-6)) U.push(p);
    U.sort((a, b) => a - b);
    const nV = V.length, nU = U.length, n = nU * nV;
    const pos = new Float32Array(n * 3), pav = new Float32Array(n * 4), pk = new Float32Array(n * 4), pt = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let k = 0;
    for (let i = 0; i < nU; i++) for (let j = 0; j < nV; j++, k++) {
      const u = U[i], v = V[j], w = F.toWorld(u, v);
      const y = (o.heightAt ? o.heightAt(w[0], w[1]) : 0) + lift;
      pos[k * 3] = w[0]; pos[k * 3 + 1] = y; pos[k * 3 + 2] = w[1];
      pav[k * 4] = u; pav[k * 4 + 1] = v; pav[k * 4 + 2] = sdBox(u, v, halfL, halfW, len); pav[k * 4 + 3] = shW;
      pk[k * 4] = cls; pk[k * 4 + 1] = seed; pk[k * 4 + 2] = halfW; pk[k * 4 + 3] = halfL;
      pt[k * 3] = F.T[0]; pt[k * 3 + 1] = o.shoulderK ? o.shoulderK(w[0], w[1]) : 1; pt[k * 3 + 2] = F.T[1];
      uv[k * 2] = u; uv[k * 2 + 1] = v;
    }
    const idx = new (n > 65535 ? Uint32Array : Uint16Array)((nU - 1) * (nV - 1) * 6);
    let q = 0;
    for (let i = 0; i < nU - 1; i++) for (let j = 0; j < nV - 1; j++) {
      const a = i * nV + j, b = a + nV;
      idx[q++] = a; idx[q++] = b; idx[q++] = a + 1; idx[q++] = a + 1; idx[q++] = b; idx[q++] = b + 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aPav', new THREE.BufferAttribute(pav, 4));
    g.setAttribute('aPavK', new THREE.BufferAttribute(pk, 4));
    g.setAttribute('aPavT', new THREE.BufferAttribute(pt, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    // a winding check: the first triangle must face +y once draped (the drape never flips it)
    g.userData.pav = { kind: 'strip', len, wid: o.wid, shoulderW: shW, cls: CLASSES[cls], seed, frame: F, rows: V.length, cols: U.length };
    return g;
  }

  // ---- the attributes: road --------------------------------------------------
  // A ribbon along a polyRoad (27_premises.js: arclength s, at(t) -> { p, tg, n }), u = arclength,
  // v across on n (the right-hand side), dEdge = w/2 - |v| (exact on the straights; a mitred corner
  // is what polyRoad's own normal gives). `toWorld` maps the premises frame to the world when the
  // road is authored in one; the tangent turns with it.
  function roadGeometry(THREE, o) {
    const road = o.road, w = o.w !== undefined ? o.w : road.w, cls = CLASSES.indexOf(o.cls || 'gravel'), seed = o.seed || 0;
    const shW = o.shoulderW !== undefined ? o.shoulderW : 3, lift = o.lift !== undefined ? o.lift : 0.06, step = o.step || 3, resV = o.resV || 1.5;
    const band = o.band !== undefined ? o.band : CLASS_DEF[CLASSES[cls]].band, fadeW = o.fadeW !== undefined ? o.fadeW : Math.min(R.fadeW, shW * 0.6);
    const halfW = w / 2, V = rowsAcross(halfW, shW, band, fadeW, resV);
    const L = road.length, nu = Math.max(1, Math.ceil(L / step));
    const S = []; for (let i = 0; i <= nu; i++) S.push(L * i / nu);
    for (const s of road.s) if (!S.some(x => Math.abs(x - s) < 1e-6)) S.push(s);   // the polyline's own nodes
    S.sort((a, b) => a - b);
    const tw = o.toWorld || ((x, z) => [x, z]);
    const nV = V.length, nU = S.length, n = nU * nV;
    const pos = new Float32Array(n * 3), pav = new Float32Array(n * 4), pk = new Float32Array(n * 4), pt = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let k = 0;
    for (let i = 0; i < nU; i++) {
      const A = road.at(S[i]);
      // the tangent in the world: through the frame's rotation (toWorld of two points)
      const p0 = tw(A.p[0], A.p[1]), p1 = tw(A.p[0] + A.tg[0], A.p[1] + A.tg[1]);
      const tx = p1[0] - p0[0], tz = p1[1] - p0[1], tl = Math.hypot(tx, tz) || 1;
      for (let j = 0; j < nV; j++, k++) {
        const v = V[j], lp = [A.p[0] + A.n[0] * v, A.p[1] + A.n[1] * v], wp = tw(lp[0], lp[1]);
        const y = (o.heightAt ? o.heightAt(wp[0], wp[1]) : 0) + lift;
        pos[k * 3] = wp[0]; pos[k * 3 + 1] = y; pos[k * 3 + 2] = wp[1];
        pav[k * 4] = S[i]; pav[k * 4 + 1] = v; pav[k * 4 + 2] = halfW - Math.abs(v); pav[k * 4 + 3] = shW;
        pk[k * 4] = cls; pk[k * 4 + 1] = seed; pk[k * 4 + 2] = halfW; pk[k * 4 + 3] = L / 2;
        pt[k * 3] = tx / tl; pt[k * 3 + 1] = o.shoulderK ? o.shoulderK(wp[0], wp[1]) : 1; pt[k * 3 + 2] = tz / tl;
        uv[k * 2] = S[i]; uv[k * 2 + 1] = v;
      }
    }
    const idx = new (n > 65535 ? Uint32Array : Uint16Array)((nU - 1) * (nV - 1) * 6);
    let q = 0;
    for (let i = 0; i < nU - 1; i++) for (let j = 0; j < nV - 1; j++) {
      const a = i * nV + j, b = a + nV;
      idx[q++] = a; idx[q++] = b; idx[q++] = a + 1; idx[q++] = a + 1; idx[q++] = b; idx[q++] = b + 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aPav', new THREE.BufferAttribute(pav, 4));
    g.setAttribute('aPavK', new THREE.BufferAttribute(pk, 4));
    g.setAttribute('aPavT', new THREE.BufferAttribute(pt, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    g.userData.pav = { kind: 'road', len: L, wid: w, shoulderW: shW, cls: CLASSES[cls], seed, rows: V.length, cols: S.length };
    return g;
  }

  // ---- the attributes: polygon --------------------------------------------------
  // A PAVED POLYGON (the port): an apron, a turnaround, a pad. A grid over the polygon's box plus the
  // band, every vertex carrying u/v in a frame turned by `yaw` (the lanes of a concrete apron run
  // with its long side), dEdge = the polygon's own signed distance (+ inside), the shoulder keep
  // 1; the alpha past the band is the mesh's own fade, so the grid's waste beyond it draws nothing.
  // `poly` is in the WORLD (the caller transforms a premises polygon first).
  function polyGeometry(THREE, o) {
    const cls = CLASSES.indexOf(o.cls || 'concrete'), seed = o.seed || 0, shW = o.shoulderW !== undefined ? o.shoulderW : 6;
    const lift = o.lift !== undefined ? o.lift : 0.08, res = o.res || 2;
    const poly = o.poly, yaw = o.yaw || 0, c = Math.cos(yaw), sn = Math.sin(yaw);
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const p of poly) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
    x0 -= shW; z0 -= shW; x1 += shW; z1 += shW;
    const nx = Math.max(2, Math.ceil((x1 - x0) / res)), nz = Math.max(2, Math.ceil((z1 - z0) / res)), n = (nx + 1) * (nz + 1);
    const pos = new Float32Array(n * 3), pav = new Float32Array(n * 4), pk = new Float32Array(n * 4), pt = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, halfW = Math.max(x1 - x0, z1 - z0) / 2;
    const inP = (x, z) => { let inside = false; for (let i = 0, m = poly.length, j = m - 1; i < m; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; } return inside; };
    const dSeg = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1e-9; const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)); return Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t)); };
    const sd = (x, z) => { let d = Infinity; for (let i = 0; i < poly.length; i++) d = Math.min(d, dSeg(x, z, poly[i], poly[(i + 1) % poly.length])); return inP(x, z) ? d : -d; };
    let k = 0;
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++, k++) {
      const x = x0 + (x1 - x0) * i / nx, z = z0 + (z1 - z0) * j / nz;
      const y = (o.heightAt ? o.heightAt(x, z) : 0) + lift;
      const dx = x - cx, dz = z - cz, u = dx * c + dz * sn, v = -dx * sn + dz * c;
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
      pav[k * 4] = u + halfW; pav[k * 4 + 1] = v; pav[k * 4 + 2] = sd(x, z); pav[k * 4 + 3] = shW;
      pk[k * 4] = cls; pk[k * 4 + 1] = seed; pk[k * 4 + 2] = halfW; pk[k * 4 + 3] = halfW;
      pt[k * 3] = c; pt[k * 3 + 1] = 1; pt[k * 3 + 2] = sn;
      uv[k * 2] = u; uv[k * 2 + 1] = v;
    }
    const idx = new (n > 65535 ? Uint32Array : Uint16Array)(nx * nz * 6);
    let q = 0;
    // x then z is the left-handed order of the strip's u then v: wound the other way so the faces look up
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const a = i * (nz + 1) + j, b = a + nz + 1; idx[q++] = a; idx[q++] = a + 1; idx[q++] = b; idx[q++] = a + 1; idx[q++] = b + 1; idx[q++] = b; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aPav', new THREE.BufferAttribute(pav, 4));
    g.setAttribute('aPavK', new THREE.BufferAttribute(pk, 4));
    g.setAttribute('aPavT', new THREE.BufferAttribute(pt, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    g.userData.pav = { kind: 'poly', shoulderW: shW, cls: CLASSES[cls], seed, rows: nz + 1, cols: nx + 1, halfW, cx, cz };
    return g;
  }

  // ---- the field: the CPU twin -------------------------------------------------
  // field(strip).at(x, z) -> { u, v, dEdge } for a strip { len, wid, hdg, cx, cz } or a road
  // { road: polyRoad, w, toLocal? }. What the scatter reads (a tuft in the grass band, a stone in the
  // gravel band) and what the gate holds against the attributes.
  function field(o) {
    if (o.road) {
      const road = o.road, halfW = (o.w !== undefined ? o.w : road.w) / 2, tl = o.toLocal || ((x, z) => [x, z]);
      return { at: (x, z) => {
        const L = tl(x, z); let best = null;
        for (let i = 1; i < road.pts.length; i++) {
          const a = road.pts[i - 1], b = road.pts[i], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1;
          const t = Math.max(0, Math.min(1, ((L[0] - a[0]) * dx + (L[1] - a[1]) * dz) / l2));
          const px = a[0] + dx * t, pz = a[1] + dz * t, d = Math.hypot(L[0] - px, L[1] - pz);
          if (!best || d < best.d) { const ll = Math.sqrt(l2), n = [dz / ll, -dx / ll]; best = { d, u: road.s[i - 1] + t * ll, v: (L[0] - px) * n[0] + (L[1] - pz) * n[1] }; }
        }
        return { u: best.u, v: best.v, dEdge: halfW - Math.abs(best.v) };
      } };
    }
    const F = stripFrame(o);
    return { at: (x, z) => { const l = F.toLocal(x, z); return { u: l[0], v: l[1], dEdge: sdBox(l[0], l[1], F.halfL, F.halfW, o.len) }; }, frame: F };
  }

  // ---- the markings: recorded off sitePaintStrip -----------------------------
  // marksOf(R, paint) hands paint (sitePaintStrip) a METRIC recording context - RW = len, RH =
  // wid, so every fillRect lands in metres - and turns what it drew into rects [u0, u1, v0, v1,
  // kind] and segments [u0, v0, u1, v1, w, kind]. The paint's frame runs t from END 1 (u_paint = 0)
  // to end 0; the strip's u runs from end 0, so u = len - t. kind: 0 white, 1 yellow, 2 the mown
  // edge line (a grass strip's), skipped fills: globalAlpha < 1 (the mowing stripes).
  // Progressions - same size, same row, equal steps - collapse to a RULE [u0, uEnd, v0, v1, kind,
  // period, axis, span]: the box repeats every `period` along `axis` (0 = u, 1 = v), `span` long.
  const KIND = { '#e9e4d6': 0, '#d9d3c0': 0, '#efe9da': 0, '#e6c35c': 1, '#8e9a55': 2 };
  function recorder(len, wid) {
    const rects = [], segs = [], q = { globalAlpha: 1, fillStyle: '#fff', strokeStyle: '#fff', lineWidth: 1, _path: [] };
    const kindOf = c => (KIND[String(c).toLowerCase()] !== undefined ? KIND[String(c).toLowerCase()] : 0);
    q.clearRect = () => {}; q.fillRect = (x, y, w, h) => {
      if (q.globalAlpha < 0.999) return;
      // x: paint-t of the left edge; the strip's u = len - t; y: v + wid/2
      rects.push([len - (x + w), len - x, y - wid / 2, y + h - wid / 2, kindOf(q.fillStyle)]);
    };
    q.beginPath = () => { q._path = []; }; q.moveTo = (x, y) => { q._path.push([x, y]); }; q.lineTo = (x, y) => { q._path.push([x, y]); };
    q.stroke = () => { for (let i = 1; i < q._path.length; i++) { const a = q._path[i - 1], b = q._path[i]; segs.push([len - a[0], a[1] - wid / 2, len - b[0], b[1] - wid / 2, q.lineWidth, kindOf(q.strokeStyle)]); } };
    q.closePath = () => {}; q.fill = () => {}; q.save = () => {}; q.restore = () => {};
    return { q, rects, segs };
  }
  function collapse(rects) {
    // group by (du, dv, v0, v1, kind) -> a progression along u; by (du, dv, u0, u1, kind) -> along v
    const key = (r, axis) => axis === 0 ? [r[1] - r[0], r[3] - r[2], r[2], r[3], r[4]].map(x => +x.toFixed(3)).join('|') : [r[1] - r[0], r[3] - r[2], r[0], r[1], r[4]].map(x => +x.toFixed(3)).join('|');
    const out = [], used = new Set();
    for (const axis of [0, 1]) {
      const groups = new Map();
      rects.forEach((r, i) => { if (used.has(i)) return; const k = key(r, axis); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); });
      for (const ids of groups.values()) {
        if (ids.length < 3) continue;
        const at = i => rects[i][axis === 0 ? 0 : 2];
        ids.sort((a, b) => at(a) - at(b));
        const step = at(ids[1]) - at(ids[0]);
        if (step < 0.05 || ids.some((id, j) => j > 0 && Math.abs(at(id) - at(ids[j - 1]) - step) > 0.02)) continue;
        const r0 = rects[ids[0]], rN = rects[ids[ids.length - 1]];
        const span = axis === 0 ? r0[1] - r0[0] : r0[3] - r0[2];
        out.push(axis === 0 ? [r0[0], rN[1], r0[2], r0[3], r0[4], step, 0, span] : [r0[0], r0[1], r0[2], rN[3], r0[4], step, 1, span]);
        ids.forEach(i => used.add(i));
      }
    }
    rects.forEach((r, i) => { if (!used.has(i)) out.push([r[0], r[1], r[2], r[3], r[4], 0, 0, 0]); });
    return out;
  }
  function marksOf(Rw, paint) {
    const { q, rects, segs } = recorder(Rw.len, Rw.wid);
    paint(q, Rw, Rw.len, Rw.wid, true);
    return { rects: collapse(rects), segs, raw: rects.length, len: Rw.len, wid: Rw.wid };
  }
  // a road's paint by class: asphalt wears an edge line each side and, from 5.5 m wide, a centre
  // dash (3 m on, 9 m period); concrete the edge lines; the loose classes nothing
  // HOW MANY LANES A ROAD HAS (2026-09-23, the user: "have a dynamic number of lanes function of road
  // width"): a lane is `roadLane` metres - 3.5 by default (a rural highway's; 3.0 a town street, 3.7
  // an interstate). Under 5.2 m there is ONE lane whatever the class: a single track everyone shares,
  // which is why such a road wears one set of ruts and carries no centre line.
  function lanesOf(w, cls, laneW) {
    if (!(w > 0)) return 0;
    if (w < 5.2) return 1;
    if (cls !== 'asphalt' && cls !== 'concrete') return 2;                       // soft: two tracks, never painted
    return Math.max(2, Math.min(6, Math.round(w / Math.max(2.6, laneW || R.roadLane || 3.5))));
  }
  // A ROAD'S PAINT, BY ITS LANES (the American convention, which is Alaska's): the EDGE lines white
  // and solid; the line between the two DIRECTIONS yellow - dashed where you may overtake, a DOUBLE
  // solid once the carriageway is four lanes or more; the dividers between lanes going the SAME way
  // white and dashed. 3 m of line, 9 m of gap (the US standard). A soft road carries no paint at all,
  // and a single-lane road carries nothing but its edges.
  function roadMarks(len, w, cls, recipe) {
    const rects = [], paved = cls === 'asphalt' || cls === 'concrete';
    const n = lanesOf(w, cls, recipe && recipe.roadLane);
    if (!paved) return { rects, segs: [], raw: 0, len, wid: w, lanes: n };
    const EW = 0.06;
    for (const sg of [1, -1]) rects.push([2, len - 2, sg * (w / 2 - 0.35) - EW, sg * (w / 2 - 0.35) + EW, 0, 0, 0, 0]);
    if (n >= 2) {
      const left = Math.floor(n / 2), lw = w / n, vC = -w / 2 + left * lw;
      if (n >= 4) for (const o of [-0.1, 0.1]) rects.push([3, len - 3, vC + o - 0.05, vC + o + 0.05, 1, 0, 0, 0]);
      else rects.push([4, len - 4, vC - EW, vC + EW, 1, 12, 0, 3]);
      for (let i = 1; i < n; i++) { if (i === left) continue;
        const v = -w / 2 + i * lw; rects.push([4, len - 4, v - EW, v + EW, 0, 12, 0, 3]); }
    }
    return { rects, segs: [], raw: rects.length, len, wid: w, lanes: n };
  }

  // THE STANDS (2026-09-23, the user: "you may also further design a parking area for planes, with
  // clear ground markings"): a light-aircraft stand is a LEAD-IN LINE with a nose-stop bar across it -
  // the pilot tracks the line and stops with the nose wheel on the bar - painted yellow, `n` of them
  // `pitch` metres apart. Drawn in a paved POLYGON's own frame, whose u/v are centred on the polygon
  // and turned by its yaw, so the row runs along the apron's own axis.
  // `uMid` is the polygon's own centre in ITS u: polyGeometry writes aPav.x = u + halfW, so a mark
  // written about the middle of an apron must carry that offset or it lands off the mesh entirely
  // (the first six stands did, 2026-09-23). The strip's u starts at 0, so uMid is 0 there.
  function standMarks(o, uMid) {
    o = o || {};
    const n = Math.max(1, Math.min(24, (o.n | 0) || 6)), pitch = +o.pitch > 0 ? +o.pitch : 11;
    const lead = +o.lead > 0 ? +o.lead : 9, bar = +o.bar > 0 ? +o.bar : 2.6, w = 0.075;
    const mid = +uMid || 0;
    const v0 = -(n - 1) * pitch / 2 + (+o.vOff || 0), u0 = mid + (o.u0 === undefined ? -lead / 2 : +o.u0);
    const rects = [];
    for (let i = 0; i < n; i++) {
      const v = v0 + i * pitch;
      rects.push([u0, u0 + lead, v - w, v + w, 1, 0, 0, 0]);                                        // the lead-in line
      rects.push([u0 + lead - w * 2, u0 + lead + w * 2, v - bar / 2, v + bar / 2, 1, 0, 0, 0]);      // the nose stop
    }
    return { rects, segs: [], raw: rects.length, len: lead, wid: n * pitch, lanes: 0, stands: n };
  }

  // ---- the library: the sets a recipe names -> two arrays ---------------------
  // library(THREE, keys, done) builds uPavA (colour rgb + height a) and uPavN (normal xyz + rough a)
  // from PAVEMENT_TEX_SETS for exactly `keys`, in that order; returns { layerOf, metres, mean, ready }.
  // The Images are SHARED with every other consumer: a listener, never an onload property.
  function library(THREE, keys, done) {
    const SETS = (typeof PAVEMENT_TEX_SETS !== 'undefined') ? PAVEMENT_TEX_SETS : null;
    const lib = { keys: keys.slice(), layerOf: {}, metres: {}, mean: {}, texA: null, texN: null, ready: false };
    keys.forEach((k, i) => { lib.layerOf[k] = i; const s = SETS && SETS[k]; lib.metres[k] = s ? s.metres : 2; lib.mean[k] = s && s.mean ? s.mean : [0.2, 0.2, 0.2]; });
    if (!SETS || typeof document === 'undefined') { if (done) done(lib); return lib; }
    const px = 512, S = px * px * 4, N = keys.length;
    const data = new Uint8Array(S * N), dataN = new Uint8Array(S * N);
    const cnv = document.createElement('canvas'); cnv.width = cnv.height = px;
    const ctx = cnv.getContext('2d', { willReadFrequently: true });
    const dec = img => (img.complete && img.naturalWidth ? Promise.resolve() : new Promise(r => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); }));
    Promise.all(keys.map(async (k, i) => {
      const m = SETS[k]; if (!m) { console.warn('pavement: no set ' + k); return; }
      const [d, n, g, h] = [m.diff, m.nor, m.rough, m.height];
      await Promise.all([dec(d), dec(n), dec(g), dec(h)]);
      const o = i * S;
      if (d.naturalWidth) { ctx.drawImage(d, 0, 0, px, px); data.set(ctx.getImageData(0, 0, px, px).data, o); }
      if (h.naturalWidth) { ctx.drawImage(h, 0, 0, px, px); const hd = ctx.getImageData(0, 0, px, px).data; for (let q = 0; q < px * px; q++) data[o + q * 4 + 3] = hd[q * 4]; }
      else for (let q = 0; q < px * px; q++) data[o + q * 4 + 3] = 128;
      if (n.naturalWidth) { ctx.drawImage(n, 0, 0, px, px); dataN.set(ctx.getImageData(0, 0, px, px).data, o); }
      else for (let q = 0; q < px * px; q++) { dataN[o + q * 4] = 128; dataN[o + q * 4 + 1] = 128; dataN[o + q * 4 + 2] = 255; }
      if (g.naturalWidth) { ctx.drawImage(g, 0, 0, px, px); const gd = ctx.getImageData(0, 0, px, px).data; for (let q = 0; q < px * px; q++) dataN[o + q * 4 + 3] = gd[q * 4]; }
      else for (let q = 0; q < px * px; q++) dataN[o + q * 4 + 3] = 230;
    })).then(() => {
      const mk = (dd, srgb) => { const t = new THREE.DataArrayTexture(dd, px, px, N);
        t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType; t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true;
        // THE COLOUR ARRAY IS sRGB-TYPED (2026-09-22): the GPU decodes before it filters, so a mip is the
        // mean of linear texels. Decoding in the shader after the fetch filtered in sRGB space, and a far
        // texel came out 17-29 % darker than the near ones on the dark, contrasty sets (Jensen). The
        // height in alpha rides along untouched (alpha is never transferred)
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8; t.needsUpdate = true; return t; };
      lib.texA = mk(data, true); lib.texN = mk(dataN, false); lib.ready = true;
      for (const m of MATS) if (m.userData.pavLib === lib) { m.uniforms.uPavA.value = lib.texA; m.uniforms.uPavN.value = lib.texN; m.uniforms.uPavOn.value = 1; applyOne(THREE, m); }
      if (done) done(lib);
    });
    return lib;
  }
  // THE SHARED LIBRARY (the game): one pair of arrays per page, built for the keys asked so far and
  // GROWN when a later caller (a road of a new class, a live edit) names a set it lacks - the new
  // arrays replace the old in every material standing (their layer indices re-resolved), the old
  // are disposed once the new have decoded. `sharedLib(THREE, keys)` returns the library at once
  // (ready or not: uPavOn gates the draw); `onReady` fires when the arrays are up.
  let SHARED = null;
  function sharedLib(THREE, keys, onReady) {
    const want = keys.filter(k => k);
    if (SHARED && want.every(k => SHARED.layerOf[k] !== undefined)) { if (onReady) { if (SHARED.ready) onReady(SHARED); else SHARED.waiters.push(onReady); } return SHARED; }
    const all = SHARED ? SHARED.keys.slice() : [];
    for (const k of want) if (all.indexOf(k) < 0) all.push(k);
    const old = SHARED;
    const lib = library(THREE, all, L => {
      for (const m of MATS) if (m.userData.pavLib === old || m.userData.pavLib === L) { m.userData.pavLib = L; m.uniforms.uPavA.value = L.texA; m.uniforms.uPavN.value = L.texN; m.uniforms.uPavOn.value = 1; applyOne(THREE, m); }
      if (old && old.texA && old !== L) { old.texA.dispose(); old.texN.dispose(); }
      for (const w of L.waiters) w(L); L.waiters.length = 0;
      if (onReady) onReady(L);
    });
    lib.waiters = [];
    // until the new arrays decode, the materials keep the old ones (their layers still valid there)
    if (old && old.ready) { lib.texA = old.texA; lib.texN = old.texN; lib.readyOld = true; }
    SHARED = lib;
    return lib;
  }
  // the keys a class needs, in slot order (base, damage, shoulder, grass, tracks, moss, macro), deduplicated
  function keysFor(classes) {
    const out = [];
    for (const c of classes) for (const s of SLOTS.concat(['roadShoulder'])) { const k = CLASS_DEF[c][s]; if (k && out.indexOf(k) < 0) out.push(k); }
    return out;
  }

  // ---- the shader ------------------------------------------------------------
  const NMARK = 40, NSEG = 8;
  const GLSL = {};
  GLSL.vertex = `
attribute vec4 aPav; attribute vec4 aPavK; attribute vec3 aPavT;
varying vec4 vPav; varying vec4 vPavK; varying vec3 vPavW; varying vec3 vPavT; varying vec3 vPavNg; varying float vPavSh;`;
  GLSL.vertexBody = `
  vPav = aPav; vPavK = aPavK; vPavSh = aPavT.y;
  vPavW = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vPavT = normalize((modelMatrix * vec4(aPavT.x, 0.0, aPavT.z, 0.0)).xyz);
  vPavNg = normalize((modelMatrix * vec4(objectNormal, 0.0)).xyz);`;
  GLSL.common = `
precision highp sampler2DArray;
uniform highp sampler2DArray uPavA, uPavN;
uniform float uPavOn, uPavDbg;
uniform vec4 uLayer, uLayer2, uTile, uTile2, uHex, uMacro, uLane, uLane2, uCrack, uPatch, uMoss, uStain, uWet, uMark, uPaint0, uPaint1, uRubber, uRubber2, uRut, uRut2, uRoad, uEdge, uEdge2, uDist, uSpec, uClass, uSoft, uSoft2;
uniform vec4 uGrade[8], uTint[8];
uniform vec4 uMean;
uniform int uMarkN, uSegN;
uniform vec4 uMarkR[${NMARK}], uMarkK[${NMARK}], uSeg[${NSEG}], uSegK[${NSEG}];
varying vec4 vPav; varying vec4 vPavK; varying vec3 vPavW; varying vec3 vPavT; varying vec3 vPavNg; varying float vPavSh;
float gPavR; vec3 gPavN; float gPavA; vec3 gPavDbg; float gPlain; float gRot; float gHexSoft; float gPudK;
struct Smp { vec4 c; vec4 n; };
float pvHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 pvHash2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
float pvNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(pvHash(i), pvHash(i + vec2(1.0, 0.0)), f.x), mix(pvHash(i + vec2(0.0, 1.0)), pvHash(i + vec2(1.0, 1.0)), f.x), f.y); }
float pvFbm(vec2 p) { return pvNoise(p) * 0.5 + pvNoise(p * 2.03 + 17.1) * 0.3 + pvNoise(p * 4.11 + 41.7) * 0.2; }
vec3 pvHueTurn(vec3 c, float k) { vec3 w = vec3(0.2126, 0.7152, 0.0722); float l = dot(c, w); vec3 warm = vec3(1.08, 0.98, 0.86), cool = vec3(0.9, 0.98, 1.12);
  return c * mix(vec3(1.0), k > 0.0 ? warm : cool, abs(k)); }
vec3 pvHw3(float ha, float wa, float hb, float wb, float hc, float wc, float depth) {
  float ma = max(max(ha + wa, hb + wb), hc + wc) - depth;
  vec3 b = max(vec3(ha + wa, hb + wb, hc + wc) - ma, 0.0); return b / (b.x + b.y + b.z); }
vec2 pvHw2(float ha, float wa, float hb, float wb, float depth) {
  float ma = max(ha + wa, hb + wb) - depth; vec2 b = max(vec2(ha + wa, hb + wb) - ma, 0.0); return b / (b.x + b.y); }
float pvLayerOf(int slot) { return slot == 0 ? uLayer.x : slot == 1 ? uLayer.y : slot == 2 ? uLayer.z : slot == 3 ? uLayer.w : slot == 4 ? uLayer2.x : slot == 5 ? uLayer2.y : uLayer2.z; }
float pvTileOf(int slot) { return slot == 0 ? uTile.x : slot == 1 ? uTile.y : slot == 2 ? uTile.z : slot == 3 ? uTile.w : slot == 4 ? uTile2.x : slot == 5 ? uTile2.y : uTile2.z; }
Smp pvFetch(float layer, vec2 uv, vec2 cs, int slot) {
  Smp o;
  vec4 c = texture(uPavA, vec3(uv, layer));
  o.c = c;                                                            // linear already: the array is sRGB-typed
  vec4 nr = texture(uPavN, vec3(uv, layer));
  // GL green points UP the image (toward row 0); v runs DOWN it: flip, then turn back by the tile's rotation
  vec2 t = vec2(nr.x * 2.0 - 1.0, -(nr.y * 2.0 - 1.0));
  t = vec2(cs.x * t.x + cs.y * t.y, -cs.y * t.x + cs.x * t.y);
  o.n = vec4(t, nr.z * 2.0 - 1.0, nr.a);
  vec4 g = uGrade[slot];
  o.c.rgb *= g.x * uTint[slot].rgb; float l = dot(o.c.rgb, vec3(0.2126, 0.7152, 0.0722)); o.c.rgb = mix(vec3(l), o.c.rgb, g.y);
  return o;
}
Smp pvTile(float layer, vec2 st, int slot) {
  if (uHex.y < 0.5 || gPlain > 0.5) return pvFetch(layer, st, vec2(1.0, 0.0), slot);
  vec2 sk = mat2(1.0, 0.0, -0.57735027, 1.15470054) * (st * uHex.z);
  vec2 base = floor(sk); vec3 t = vec3(fract(sk), 0.0); t.z = 1.0 - t.x - t.y;
  float s = step(0.0, -t.z), s2 = 2.0 * s - 1.0;
  vec3 w = vec3(-t.z * s2, s - t.y * s2, s - t.x * s2);
  vec2 v1 = base + vec2(s, s), v2 = base + vec2(s, 1.0 - s), v3 = base + vec2(1.0 - s, s);
  vec2 r1 = pvHash2(v1), r2 = pvHash2(v2), r3 = pvHash2(v3);
  float a1 = (r1.x - 0.5) * 2.0 * gRot, a2 = (r2.x - 0.5) * 2.0 * gRot, a3 = (r3.x - 0.5) * 2.0 * gRot;
  mat2 R1 = mat2(cos(a1), sin(a1), -sin(a1), cos(a1)), R2 = mat2(cos(a2), sin(a2), -sin(a2), cos(a2)), R3 = mat2(cos(a3), sin(a3), -sin(a3), cos(a3));
  Smp s1 = pvFetch(layer, R1 * st + r1 * 7.3, vec2(cos(a1), sin(a1)), slot);
  Smp s2v = pvFetch(layer, R2 * st + r2 * 7.3, vec2(cos(a2), sin(a2)), slot);
  Smp s3 = pvFetch(layer, R3 * st + r3 * 7.3, vec2(cos(a3), sin(a3)), slot);
  // Mikkelsen's contrast ramp for every set - the weights sharpened and renormalised, no height
  // selection: a height blend picks the highest of the three samples and that favours the intact,
  // lighter aggregate over the pits, so the near composite ran 17-29 % brighter than the texture's
  // own mean (what the far tier is); the ramp has no such bias, and no cell border becomes a seam
  vec3 hw = pow(w, vec3(3.0)) / max(dot(pow(w, vec3(3.0)), vec3(1.0)), 1e-5);
  Smp o; o.c = s1.c * hw.x + s2v.c * hw.y + s3.c * hw.z; o.n = s1.n * hw.x + s2v.n * hw.y + s3.n * hw.z;
  return o;
}
// a slot's set at the pavement's (u, v): the paved slots turn a little (a brushed finish has a grain), the loose ones any way
Smp pvSet(int slot, vec2 uv) {
  float tile = max(pvTileOf(slot), 0.05);
  gRot = (slot == 0 || slot == 1 || slot == 5) ? uHex.w : (slot == 4 ? 0.0 : 1.5708);
  gHexSoft = uClass.x < 1.5 ? 1.0 : 3.0;                             // loose ground: a wide, soft cell blend
  return pvTile(pvLayerOf(slot), uv / tile, slot);
}
// a box's anti-aliased coverage at p, footprint fw
float pvBox(vec2 p, vec2 a, vec2 b, vec2 fw) {
  vec2 lo = smoothstep(a - fw, a + fw, p), hi = 1.0 - smoothstep(b - fw, b + fw, p);
  return lo.x * hi.x * lo.y * hi.y;
}
// the marks: the rects and rules -> (white, yellow, mown) coverage
vec3 pvMarks(vec2 p, vec2 fw) {
  vec3 m = vec3(0.0);
  for (int i = 0; i < uMarkN; i++) {
    vec4 Rr = uMarkR[i]; vec4 K = uMarkK[i];
    vec2 a = vec2(Rr.x, Rr.z), b = vec2(Rr.y, Rr.w), q = p;
    if (K.y > 0.0) {
      if (K.z < 0.5) { if (p.x < Rr.x - fw.x || p.x > Rr.y + fw.x) continue; q.x = Rr.x + mod(p.x - Rr.x, K.y); b.x = Rr.x + K.w; }
      else { if (p.y < Rr.z - fw.y || p.y > Rr.w + fw.y) continue; q.y = Rr.z + mod(p.y - Rr.z, K.y); b.y = Rr.z + K.w; }
    }
    float c = pvBox(q, a, b, fw);
    if (K.x < 0.5) m.x = max(m.x, c); else if (K.x < 1.5) m.y = max(m.y, c); else m.z = max(m.z, c);
  }
  for (int i = 0; i < uSegN; i++) {
    vec4 S = uSeg[i]; vec4 K = uSegK[i];
    vec2 a = S.xy, b = S.zw, ab = b - a; float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
    float d = distance(p, a + ab * t), hw = K.x * 0.5, f = max(fw.x, fw.y);
    float c = 1.0 - smoothstep(hw - f, hw + f, d);
    if (K.y < 0.5) m.x = max(m.x, c); else if (K.y < 1.5) m.y = max(m.y, c); else m.z = max(m.z, c);
  }
  return m;
}
// Voronoi edge distance (F2 - F1) at p, for the cracks
float pvVoro(vec2 p) {
  vec2 i = floor(p), f = fract(p); float f1 = 8.0, f2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y)); vec2 o = pvHash2(i + g); vec2 r = g + o - f; float d = dot(r, r);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return sqrt(f2) - sqrt(f1);
}
// a rut pair across v at centre c: coverage (compaction) and the slope (d height / d v)
vec2 pvRuts(float v, float c, float halfTrack, float w, float depth) {
  float cov = 0.0, slope = 0.0;
  for (int k = 0; k < 2; k++) {
    float x = v - (c + (k == 0 ? -halfTrack : halfTrack));
    float g = exp(-x * x / (w * w));
    cov = max(cov, g); slope += depth * g * (2.0 * x / (w * w));
  }
  return vec2(cov, slope);
}
// THE RUTS WITH THEIR VARIATION (2026-09-22): each of the pair has its own width and depth along the
// track (a 3 m and a 5 m noise), a ragged edge (a half-metre noise on x), and the trough is flat-
// bottomed (a tyre, not a knife): returns (coverage, slope across, x from the nearer rut, its width)
vec4 pvRuts2(float u, float v, float c, float halfTrack, float w, float depth, float seed) {
  float cov = 0.0, slope = 0.0, xn = 9.0, wn = w;
  for (int k = 0; k < 2; k++) {
    float fk = float(k);
    float wk = w * (0.75 + 0.6 * pvNoise(vec2(u / 3.1 + fk * 7.0, seed + fk)));
    float dk = depth * (0.6 + 0.8 * pvNoise(vec2(u / 5.3 + fk * 3.0, seed + 2.0 + fk)));
    float x = v - (c + (k == 0 ? -halfTrack : halfTrack)) + 0.12 * wk * (pvNoise(vec2(u / 0.45 + fk * 11.0, seed + 5.0)) - 0.5);
    float q = x / wk;
    float g = exp(-pow(q * q, 1.6));                                  // flat-bottomed, steep-sided
    float ridge = exp(-pow((abs(q) - 1.5) / 0.45, 2.0)) * 0.35;         // the displaced ground beside it
    cov = max(cov, g); slope += dk * (g * 3.2 * q * q * q / wk * sign(q) - ridge * 2.0 * (abs(q) - 1.5) / (0.45 * wk) * sign(q) * 0.3);
    if (abs(x) < abs(xn)) { xn = x; wn = wk; }
  }
  return vec4(cov, slope, xn, wn);
}
// A TYRE'S IMPRINT: lugs along the track in three staggered columns across it, a lug missing now and
// then, pressed into the surface. x is the across offset from the rut's centre, w the rut's half
// width; the footprint rule keeps it from shimmering at a distance (the lug pitch is 16 cm)
float pvTread(float u, float x, float w, float seed) {
  float period = 0.16;
  float xs = (x / max(w, 0.05) + 1.0) * 1.5;                          // 0..3 across the rut
  float col = floor(xs), xc = fract(xs);
  float su = u / period + col * 0.5;
  float lug = floor(su), f = fract(su);
  float on = step(0.22, pvHash(vec2(lug, col + seed)));
  float blockU = smoothstep(0.12, 0.28, f) * (1.0 - smoothstep(0.66, 0.84, f));
  float blockX = smoothstep(0.1, 0.3, xc) * (1.0 - smoothstep(0.7, 0.9, xc));
  float inside = 1.0 - smoothstep(0.75, 1.05, abs(x) / max(w, 0.05));
  return blockU * blockX * on * inside;
}`;
  // THE CHAIN, spliced after map_fragment. Inputs: vPav (u, v, dEdge, shoulderW), vPavK (class, seed, halfW, halfL).
  GLSL.map = `
  {
    float u = vPav.x, v = vPav.y, dE = vPav.z, shW = vPav.w;
    float cls = vPavK.x, seed = vPavK.y, halfW = vPavK.z, halfL = vPavK.w;
    vec2 P = vec2(u, v);
    vec2 uvS = P + vec2(seed * 37.0, seed * 91.0);
    vec2 fw = fwidth(P) + 1e-5;
    float fwm = max(fw.x, fw.y);
    float dist = distance(vPavW, cameraPosition);
    float detail = 1.0 - smoothstep(uDist.x, uDist.y, dist);
    float nrmK = uSpec.y * (1.0 - smoothstep(uDist.z, uDist.w, dist));
    gPlain = step(uDist.y, dist);
    bool paved = cls < 1.5, concrete = cls < 0.5, grassy = cls > 4.5, road = uClass.w > 0.5, isPoly = uClass.w > 1.5;
    // THE FOOTPRINT RULE: a thin feature (a joint, a crack, a paint edge) is anti-aliased by fwidth,
    // and once the pixel's footprint exceeds the feature's width its coverage must SHRINK to the
    // width's share of the footprint - or a 6 cm joint paints a half-dark band as wide as the pixel
    // down the whole far runway (the user's circled blur, 2026-09-22)
    #define PV_THIN(width) min(1.0, (width) / max(fwm, 1e-5))
    // ---- 1-2 the base, hex-tiled, and its macro variation
    Smp base = pvSet(0, uvS);
    vec3 col = base.c.rgb; float hgt = base.c.a; vec3 nT = base.n.xyz; float rough = base.n.a;
    float m1 = pvNoise(uvS / 8.0), m2 = pvNoise(uvS / 40.0 + 3.7), m3 = pvNoise(uvS / 200.0 + 9.1);
    float macroL = (m1 - 0.5) * 0.3 + (m2 - 0.5) * 0.5 + (m3 - 0.5) * 0.6;
    float macroK = paved ? 1.0 : 1.6;                                  // a soft surface varies more: the wet, the dry, the mown
    col *= 1.0 + macroL * uMacro.x * 2.0 * macroK; col = pvHueTurn(col, macroL * uMacro.y * 3.0 * macroK); rough += macroL * uMacro.z;
    // THE FAR TIER IS THE SAME SURFACE (the user, 2026-09-22: "their values are radically different"):
    // no second set at a distance, no pull toward a mean either - a mip-averaged hex sample IS the
    // set's mean, and the layers on it (the damage, the moss, the wear) stay what they are; only the
    // relief goes flat. The near and the far are one luminance by construction; the rig's gate
    // measures it (--gate: the unlit albedo from 200 m against 3000 m, per class, within 12 %)
    if (detail < 0.999) { nT = mix(vec3(0.0, 0.0, 1.0), nT, detail); }
    float damp = smoothstep(0.55, 0.85, m3 * 0.6 + m2 * 0.4) * uStain.x;
    float dampN = pvFbm(uvS / uStain.y);
    damp = max(damp, smoothstep(0.6, 0.8, dampN) * uStain.x * 0.8);
    // the rubber's band, read by the moss (nothing grows in the touchdown zone) and painted below;
    // on a soft strip the same band is where the tyres MARK the surface
    float rubberPre = 0.0;
    if (!road) {
      float s0 = u, s1 = 2.0 * halfL - u;
      float band = max(smoothstep(uRubber.x, uRubber.y, s0) * (1.0 - smoothstep(uRubber.y, uRubber.z, s0)), smoothstep(uRubber.x, uRubber.y, s1) * (1.0 - smoothstep(uRubber.y, uRubber.z, s1)));
      float x = (abs(v) - uRubber2.y) / max(uRubber.w, 0.1);
      rubberPre = band * exp(-x * x);
    }
    // ---- 3 the paving lanes and their joints (concrete)
    float joint = 0.0, laneTone = 0.0, spall = 0.0;
    if (uLane.x > 0.5 && concrete) {
      // a concrete ROAD is poured in two lanes: one joint down the middle, its dirt and spall a
      // fraction of a runway's (the same band that reads as a joint on 45 m reads as a split on 6)
      float laneW = (road && !isPoly) ? max(halfW, 1.5) : max(uLane.y, 0.5), lvv = v + halfW + laneW * 0.5;
      float roadK = (road && !isPoly) ? 0.45 : 1.0;
      float lane = floor(lvv / laneW), lv = lvv - lane * laneW;
      float slabL = max(uLane2.y, 1.0) * (0.8 + 0.5 * pvHash(vec2(lane, seed + 7.0))), su = u + pvHash(vec2(lane, seed)) * slabL, slab = floor(su / slabL), lu = su - slab * slabL;
      laneTone = (pvHash(vec2(lane, seed + 1.0)) - 0.5) * 2.0 * uLane2.x + (pvHash(vec2(lane * 3.0, slab + seed)) - 0.5) * uLane2.x;
      float chip = pvNoise(uvS * 2.7) * uLane2.z;
      float jw = uLane.z * (0.6 + chip);
      float sv = lv < laneW - lv ? lv : lv - laneW, su2 = lu < slabL - lu ? lu : lu - slabL;
      float dv = abs(sv), du = abs(su2);
      float jv = (1.0 - smoothstep(jw - fwm, jw + fwm, dv)) * PV_THIN(2.0 * jw), ju = (1.0 - smoothstep(jw * 0.6 - fwm, jw * 0.6 + fwm, du)) * 0.35 * PV_THIN(1.2 * jw);
      joint = max(jv, ju);
      float kd = uLane.w * 0.8;
      nT.y += -jv * kd * (sv / max(jw, 1e-3)) * nrmK; nT.x += -ju * kd * (su2 / max(jw, 1e-3)) * nrmK;
      spall = (1.0 - smoothstep(0.02, 0.45 * roadK, min(dv, du))) * smoothstep(0.35, 0.7, pvNoise(uvS * 1.7 + 5.0)) * uLane2.w * roadK;
      col *= 1.0 - joint * uLane2.w * 0.9 * roadK - spall * 0.35; rough = mix(rough, 0.95, joint * 0.7);
      hgt -= joint * 0.3;
    }
    col *= 1.0 + laneTone;
    // ---- 4 the cracks, and the damage set where the cracks are (paved)
    float crack = 0.0, dmg = 0.0;
    if (uCrack.x > 0.001 && paved) {
      float dens = pvFbm(uvS / 40.0 + 11.0) * 0.75 + pvFbm(uvS / 9.0 + 4.0) * 0.25;
      float near = (1.0 - smoothstep(0.0, 2.5, dE)) * 0.18 + joint * 0.12;
      float thr = 0.72 - uCrack.x * 0.35;
      float field = smoothstep(thr, thr + 0.22, dens + near);
      dmg = smoothstep(thr + 0.06, thr + 0.3, dens + near) * uCrack.w;
      if (field > 0.01) {
        float cw = uCrack.y + fwm;
        vec2 wp = uvS + (vec2(pvNoise(uvS / 3.7), pvNoise(uvS / 3.1 + 9.0)) - 0.5) * uCrack.z * 0.9;
        float e = pvVoro(wp / uCrack.z + 3.0);
        float wob = pvNoise(uvS * 5.0) * 0.6 + 0.4;
        float gate = smoothstep(0.35, 0.6, pvNoise(wp / (uCrack.z * 1.7) + 21.0) * 0.6 + field * 0.5);
        crack = (1.0 - smoothstep(cw * wob * 0.5, cw * wob * 1.5 + fwm, e * uCrack.z)) * field * gate * detail * PV_THIN(2.0 * uCrack.y);
        float e2 = pvVoro((wp + vec2(0.02, 0.0)) / uCrack.z + 3.0), e3 = pvVoro((wp + vec2(0.0, 0.02)) / uCrack.z + 3.0);
        vec2 ge = vec2(e2 - e, e3 - e) / 0.02;
        nT.xy += ge * crack * 0.35 * nrmK;
      }
      if (dmg > 0.004) { Smp d = pvSet(1, uvS); vec2 w2 = pvHw2(hgt, 1.0 - dmg, d.c.a, dmg, uHex.x); col = col * w2.x + d.c.rgb * w2.y * (1.0 + laneTone); nT = nT * w2.x + d.n.xyz * w2.y; rough = rough * w2.x + d.n.a * w2.y; hgt = hgt * w2.x + d.c.a * w2.y; }
      col *= 1.0 - crack * 0.7; rough = mix(rough, 0.97, crack);
    }
    // ---- 4b THE SOFT SURFACE (gravel, dirt, sand, grass): a second ground in patches, coarse
    // stony patches toward the edges, the compacted wheel band, and - on a road - the two ruts
    // with the tyres' tread and the grass between; on a strip the aircraft's own tracks
    float mixW = 0.0, coarse = 0.0, wheel = 0.0, tread = 0.0;
    float rut = 0.0, grassStripe = 0.0; vec2 rr = vec2(0.0);
    float aE = abs(v) / max(halfW, 0.5);                                // 0 on the centreline, 1 at the edge
    if (!paved) {
      // the second ground, in 10-25 m patches (the drier / the wetter / the mown), torn by a 2 m noise
      float mx = pvFbm(uvS / vec2(22.0, 9.0) + 41.0) * 0.75 + pvNoise(uvS / vec2(3.0, 1.6) + 8.0) * 0.25;
      mixW = smoothstep(0.48, 0.7, mx) * uSoft.x * 0.6;
      if (mixW > 0.004) { Smp m = pvSet(5, uvS); vec2 w2 = pvHw2(hgt, 1.0 - mixW, m.c.a, mixW, uHex.x * 4.0); col = col * w2.x + m.c.rgb * w2.y; nT = nT * w2.x + m.n.xyz * w2.y; rough = rough * w2.x + m.n.a * w2.y; hgt = hgt * w2.x + m.c.a * w2.y; }
      // the coarse, stony patches: more toward the edges (the loose stuff the wheels push out), less in the wheel band
      float cx = pvFbm(uvS / vec2(11.0, 4.5) + 17.0) * 0.7 + pvNoise(uvS / vec2(1.4, 0.8) + 3.0) * 0.3 + aE * 0.1;
      coarse = smoothstep(0.6, 0.82, cx) * uSoft.y * 0.7;
      if (coarse > 0.004) { Smp d = pvSet(1, uvS); vec2 w2 = pvHw2(hgt, 1.0 - coarse, d.c.a, coarse, uHex.x * 2.5); col = col * w2.x + d.c.rgb * w2.y; nT = nT * w2.x + d.n.xyz * w2.y; rough = rough * w2.x + d.n.a * w2.y; hgt = hgt * w2.x + d.c.a * w2.y; }
      if (road && !isPoly && uRut2.z > 0.5) {
        // THE ROAD: the wheel pair about a wandering centre; a second, fainter pair where the
        // traffic went round (a 200 m noise says where); the tread set ORIENTED along the road.
        // IN PROPORTION: the track never wider than the road holds, the wander inside it
        // THE TRACK IS A VEHICLE'S, NOT THE ROAD'S (2026-09-23, the user: "do they represent a real
        // interaxle distance? They seem big"). uRut.x is the HALF-TRACK in metres: 0.85 is a 1.7 m
        // pickup, and a pair of ruts sits at its centre +- that. It used to be 1.55 and was clamped to
        // halfW * 0.5, so a 6 m road wore its ruts 3 m apart - a vehicle nobody builds.
        // A road wide enough for two to PASS carries a track per direction on the lane centres; a
        // narrower one carries the single shared track, with the fainter second pass where the
        // traffic went round (a 200 m noise says where).
        float ht = min(uRut.x, halfW * 0.5), rw = min(uRut.y, halfW * 0.22);
        float twin = step(ht * 2.0 + rw * 2.0 + 0.35, halfW);     // 1 when two tracks fit side by side (a road over ~5.3 m)
        float lane = halfW * 0.5;
        float wander = min(uRut.w, max(mix(halfW, lane, twin) - ht - rw * 1.5, 0.0));
        float wa = wander * (pvNoise(vec2(u / uRut2.x, seed)) - 0.5) * 2.0;
        float wb = wander * (pvNoise(vec2(u / uRut2.x + 31.0, seed + 3.0)) - 0.5) * 2.0;
        float c = mix(wa, -lane + wa, twin);
        float c2 = mix(c + (pvHash(vec2(seed, 5.0)) > 0.5 ? 1.0 : -1.0) * (0.6 + 0.8 * pvNoise(vec2(u / 37.0, seed + 2.0))), lane + wb, twin);
        float on2 = mix(smoothstep(0.5, 0.65, pvNoise(vec2(u / 200.0 + 9.0, seed))), 1.0, twin);
        float k2 = mix(0.6, 1.0, twin);                            // the second track is as worn as the first when it is the other direction
        vec4 r1 = pvRuts2(u, v, c, ht, rw, uRut.z, seed);
        rr = r1.xy; rut = r1.x;
        vec4 r2 = pvRuts2(u, v, c2, ht, rw * mix(1.2, 1.0, twin), uRut.z * mix(0.5, 0.9, twin), seed + 9.0);
        rr += r2.xy * on2 * k2; rut = max(rut, r2.x * on2 * mix(0.7, 1.0, twin));
        // THE IMPRINT: the tyres' lugs pressed into the trough - a mask with its own relief (the
        // mask's gradient), where the ground is soft enough to take it (dirt and sand fully, gravel
        // and grass faintly), fading with the footprint (a 16 cm lug) and the distance
        float imp = uSoft.w * detail * PV_THIN(0.16) * (cls > 2.5 && cls < 4.5 ? 1.0 : 0.35);
        if (imp > 0.01 && r1.x > 0.05) {
          float tx = r1.z, tw = r1.w;
          float t0 = pvTread(u, tx, tw, seed), tu = pvTread(u + 0.012, tx, tw, seed), tv = pvTread(u, tx + 0.012, tw, seed);
          float lugK = imp * r1.x;
          nT.xy += vec2(tu - t0, tv - t0) / 0.012 * 0.075 * lugK * nrmK;       // the lug's walls
          col *= 1.0 - t0 * lugK * 0.1; rough += t0 * lugK * 0.06;              // its floor: pressed, damper
          tread = max(tread, t0 * lugK);
        }
        // the compacted band is wider than the trough (the wheels wander a little every pass)
        float gx1 = (v - c) / max(ht, 0.3);
        float bw = grassy ? 0.6 : 0.32;                                   // worn grass spreads wider than a rut in dirt
        wheel = max(exp(-pow((abs(gx1) - 1.0) / bw, 2.0)), on2 * mix(0.7, 1.0, twin) * exp(-pow((abs((v - c2) / max(ht, 0.3)) - 1.0) / bw, 2.0)));
        wheel = min(wheel, 1.0) * uSoft.z;
        tread = max(tread, rut * uSoft.w * 0.5);
        // the grass down the middle: between the wheels of a single track, between the two TRACKS on a
        // road that carries one each way (which is where it really grows - nobody drives the crown)
        float gc = mix(c, 0.0, twin), gw = mix(ht * 0.55, max(lane - ht, 0.35), twin);
        float gx = (v - gc) / max(gw, 0.1);
        grassStripe = uRut2.y * exp(-gx * gx) * smoothstep(0.3, 0.6, pvNoise(uvS / 1.3 + 7.0) * 0.7 + pvNoise(uvS / 9.0 + 2.0) * 0.3) * (grassy ? 0.0 : 1.0);
      } else if (!road || isPoly) {
        // THE STRIP: the aircraft roll down the middle - a compacted band a third of the width,
        // its edge ragged; in the touchdown zones the tyres mark it in streaks; and one or two
        // wandering wheel pairs (the aeroplanes do not all track the centreline)
        float wb = 1.0 - smoothstep(0.12, 0.52, aE + (pvNoise(vec2(u / 9.0, seed + 4.0)) - 0.5) * 0.2 + (pvNoise(uvS / 1.7) - 0.5) * 0.1);
        wheel = wb * uSoft.z * (0.75 + 0.25 * pvNoise(uvS / 3.0));
        float streak = pvFbm(vec2(u / 6.0, v / 0.35) + seed * 3.0);
        tread = rubberPre * smoothstep(0.42, 0.7, streak) * uSoft.w * 0.5;
        float imp = uSoft.w * detail * PV_THIN(0.16) * (cls > 2.5 && cls < 4.5 ? 1.0 : 0.35);
        for (int k = 0; k < 2; k++) {
          float fk = float(k);
          float c = (pvNoise(vec2(u / (uRut2.x * 2.5) + fk * 13.0, seed + fk)) - 0.5) * halfW * 0.5;
          float on = smoothstep(0.45, 0.6, pvNoise(vec2(u / 260.0 + fk * 7.0, seed + 3.0 + fk)));
          vec4 r2 = pvRuts2(u, v, c, uRubber2.y, uRut.y * 1.4, uRut.z * 0.35, seed + fk * 4.0);
          rr += r2.xy * on * 0.5; rut = max(rut, r2.x * on * 0.6);
          // the imprint along the pair (the same lugs a road's ruts carry)
          if (imp > 0.01 && r2.x * on > 0.05) {
            float t0 = pvTread(u, r2.z, r2.w, seed + fk), tu = pvTread(u + 0.012, r2.z, r2.w, seed + fk), tv = pvTread(u, r2.z + 0.012, r2.w, seed + fk);
            float lugK = imp * r2.x * on;
            nT.xy += vec2(tu - t0, tv - t0) / 0.012 * 0.075 * lugK * nrmK;
            col *= 1.0 - t0 * lugK * 0.1; rough += t0 * lugK * 0.06;
            tread = max(tread, t0 * lugK);
          }
        }
      }
      // the compacted band: the tracks set (finer, packed, a shade darker), its normal calmer
      if (wheel > 0.004) { Smp t = pvSet(4, uvS); vec2 w2 = pvHw2(hgt, 1.0 - wheel, t.c.a, wheel, uHex.x); col = col * w2.x + t.c.rgb * w2.y * 0.92; nT = nT * w2.x + t.n.xyz * w2.y * 0.7; rough = rough * w2.x + (t.n.a - 0.06) * w2.y; hgt = hgt * w2.x + t.c.a * w2.y; }
      // the tread is the lugs' own relief (above) and a compaction of the ground they pressed: a shade
      // darker, a little smoother - never a texture of its own (an oriented, stretched set drew the hex
      // lattice as triangles and moired into a flicker, 2026-09-22)
      if (tread > 0.004) { col *= 1.0 - tread * 0.08; rough -= tread * 0.05; }
      // the rut's relief: the trough's slope, in proportion to its width (a 30 cm rut is not a ditch)
      nT.y += -rr.y * uRut.y * 0.9 * nrmK;
      col *= 1.0 - rut * 0.06;
      // a grass strip is mown: stripes across, 3.5 m, a few per cent - the cut, not a colour
      if (grassy) { float mw = uSoft2.y * 0.05 * (mod(floor((v + halfW) / 3.5), 2.0) * 2.0 - 1.0) * smoothstep(0.0, 1.0, dE); col *= 1.0 + mw; }
    }
    // ---- 5 the patches (a repair over the old surface, paved), with a rim
    float pch = 0.0;
    if (uPatch.x > 0.001 && paved) {
      vec2 cell = vec2(uPatch.w, 6.0), ci = floor(uvS / cell); vec2 h = pvHash2(ci + seed);
      if (h.x < uPatch.x) {
        vec2 h2 = pvHash2(ci * 3.1 + 7.0), lo = ci * cell + h2 * cell * 0.4, hi = lo + cell * (0.35 + 0.5 * pvHash2(ci + 2.0));
        pch = pvBox(uvS, lo, hi, fw + 0.12);
        float pl = dot(col, vec3(0.2126, 0.7152, 0.0722));
        vec3 pc = mix(vec3(pl), col, 0.35) * (0.28 + 0.5 * uPatch.y) * (0.9 + 0.2 * pvNoise(uvS * 3.0));
        // the rim: the patch stands a little proud - its edge's gradient tilts the normal
        vec2 gp = vec2(pvBox(uvS + vec2(0.03, 0.0), lo, hi, fw + 0.12) - pch, pvBox(uvS + vec2(0.0, 0.03), lo, hi, fw + 0.12) - pch) / 0.03;
        nT.xy += gp * 0.06 * nrmK * detail;
        col = mix(col, pc, pch); rough = mix(rough, uPatch.z, pch); crack *= 1.0 - pch; joint *= 1.0 - pch; nT.xy *= 1.0 - pch * 0.7;
      }
    }
    // ---- 6 the moss and the stains (paved)
    float moss = 0.0;
    if (uMoss.x > 0.001 && paved) {
      float mn = pvFbm(uvS / uMoss.w + 23.0) * 0.7 + pvNoise(uvS / 0.45 + 3.0) * 0.3;
      float er = min(uMoss.y, halfW * 0.35);
      float reach = (1.0 - smoothstep(0.0, max(er, 0.3), dE)) * 0.45 + joint * uMoss.z * 0.6 + crack * 0.35 + spall * 0.3;
      moss = smoothstep(0.66, 0.84, mn + reach * 0.35) * uMoss.x * (1.0 - rubberPre);
      if (moss > 0.004) { Smp m = pvSet(5, uvS); vec2 w2 = pvHw2(hgt, 1.0 - moss, m.c.a, moss, uHex.x); col = col * w2.x + m.c.rgb * w2.y; nT = nT * w2.x + m.n.xyz * w2.y; rough = rough * w2.x + m.n.a * w2.y; }
    }
    col *= 1.0 - damp * 0.35; rough -= damp * uStain.z;
    // ---- 6b THE TRAFFIC'S POLISH (2026-09-23): a paved road wears in the WHEEL PATHS - two to a
    // lane, at the vehicle's own half-track from the lane's centre. The aggregate there is polished
    // smoother and a shade darker, and the paint that crosses them is scrubbed away. It needs no
    // special case for the centre line: that line lies between the wheels of both directions, which
    // is exactly why it outlives the edge lines on a real road.
    float polish = 0.0;
    if (paved && road && !isPoly && uRoad.x > 0.5 && uRoad.z > 0.001) {
      float lw = max(uRoad.y, 1.5);
      float lane = clamp(floor((v + halfW) / lw), 0.0, uRoad.x - 1.0);
      float lc = (lane + 0.5) * lw - halfW;
      float dmin = min(abs(v - (lc - uRut.x)), abs(v - (lc + uRut.x)));
      polish = exp(-pow(dmin / 0.42, 2.0)) * uRoad.z * (0.65 + 0.35 * pvNoise(vec2(u / 29.0, seed + 6.0)));
      col *= 1.0 - polish * 0.06;
      rough = mix(rough, rough * 0.70, polish);
    }
    // ---- 7 the markings (rects, rules, segments), weathered; the paint is a LAYER: it fills the
    // surface's grain, it has its own roughness, and its edge is a step the light catches
    vec3 mk = vec3(0.0); float paint = 0.0;
    if (uMarkN > 0 || uSegN > 0) {
      mk = pvMarks(P, fw);
      float wear = clamp((pvFbm(uvS / 0.45 + 51.0) * 0.7 + pvFbm(uvS / 3.0 + 8.0) * 0.3 - 0.15) / 0.7, 0.0, 1.0);
      float age = uMark.x;
      // ...and the traffic: paint under a wheel path is scrubbed, paint between them keeps
      float keep = smoothstep(age - 0.35, age + 0.15, wear) * (1.0 - crack * 0.8) * (1.0 - joint * 0.7) * (1.0 - spall * 0.6) * (1.0 - pch)
                 * (1.0 - polish * 0.8) * (1.0 - wheel * 0.5);
      float w = mk.x * keep, y = mk.y * keep;
      float mown = grassy ? mk.z * uMark.w : 0.0;
      vec3 pw = uPaint0.rgb, py = uPaint1.rgb;
      float chalk = uMark.z * age;
      col = mix(col, mix(pw, col, chalk * 0.7), w); col = mix(col, mix(py, col, chalk * 0.6), y);
      col = mix(col, col * 0.86, mown);
      paint = max(w, y);
      rough = mix(rough, uMark.y + chalk * 0.25, paint);
      nT.xy *= 1.0 - paint * 0.6;                                        // the paint fills the grain
      if (uSoft2.x > 0.001 && detail > 0.01 && paint > 0.002 && paint < 0.998) {
        // the edge: the coverage's gradient, two more reads of the rect list, only on the edge itself
        vec3 m1x = pvMarks(P + vec2(0.01, 0.0), fw), m1y = pvMarks(P + vec2(0.0, 0.01), fw);
        vec2 gm = vec2(max(m1x.x, m1x.y) - max(mk.x, mk.y), max(m1y.x, m1y.y) - max(mk.x, mk.y)) / 0.01;
        nT.xy -= gm * uSoft2.x * 0.004 * keep * nrmK;
      }
    }
    // ---- 8 the rubber in the touchdown zones (paved)
    float rubber = 0.0;
    if (rubberPre > 0.001 && uRubber2.x > 0.001) {
      float streak = pvFbm(vec2(u / 8.0, v / 0.3) + seed);
      rubber = uRubber2.x * rubberPre * smoothstep(0.35, 0.75, streak + uRubber2.z * 0.3 - 0.15);
      col *= 1.0 - rubber * 0.8; rough = mix(rough, 0.45, rubber); nT.xy *= 1.0 - rubber * 0.5;
    }
    // ---- 9 the shoulder's vehicle paths (any class with a band wide enough to drive on)
    if (dE < -0.5 && uRut2.w > 0.5 && uEdge.y > 4.0) {
      float room = smoothstep(4.0, 9.0, uEdge.y);
      for (int k = 0; k < 4; k++) {
        if (float(k) >= uRut2.w) break;
        float fk = float(k) + (v < 0.0 ? 4.0 : 0.0);
        float mean = 2.5 + max(uEdge.y - 5.0, 0.5) * pvHash(vec2(fk, seed + 3.0));
        float wander = uRut.w * 6.0 * (pvNoise(vec2(u / uRut2.x + fk * 17.0, seed)) - 0.5) + uRut.w * 1.5 * (pvNoise(vec2(u / (uRut2.x * 0.23) + fk * 3.0, seed + 1.0)) - 0.5);
        float off = mean + wander;
        float on = room * smoothstep(0.42, 0.58, pvNoise(vec2(u / 140.0 + fk * 5.0, seed + fk))) * smoothstep(1.0, 2.5, off) * (1.0 - smoothstep(uEdge.y - 2.5, uEdge.y - 1.0, off));
        vec2 r2 = pvRuts(-dE, off, uRut.x, uRut.y, uRut.z);
        rr += r2 * on; rut = max(rut, r2.x * on);
      }
    }
    // ---- 10 the edge zone: the chipped edge, the gravel band, the grass creeping in, the fade.
    // A paved edge is a line chipped by a small noise; a SOFT edge is not a line at all - the
    // loose stuff spreads out over a couple of metres and the grass comes in through it
    float eEdge = dE + uEdge.x * (pvNoise(vec2(u / 1.5, seed + 9.0)) - 0.5) * 2.0;
    float wPav;
    if (paved) wPav = smoothstep(-fwm - 0.05, fwm + 0.05, eEdge);
    else {
      // a soft road has no edge: the loose stuff thins out over edgeSoft metres through three
      // octaves of noise (15 m, 4 m, 1 m) - islands of dirt in the grass, tongues of grass in the dirt
      float soft = clamp(min(uSoft2.z, halfW * 0.6), 0.3, 6.0);
      float e2 = dE + soft * (0.9 * (pvNoise(vec2(u / 15.0, seed + 19.0)) - 0.5) * 2.0 + 0.7 * (pvFbm(uvS / 4.0 + 23.0) - 0.5) * 2.0 + 0.35 * (pvNoise(uvS / 1.0) - 0.5) * 2.0);
      wPav = smoothstep(-soft * 1.1, soft * 0.5, e2);
    }
    float bandW = uEdge.y;
    float bn = pvFbm(uvS / 2.5 + 31.0);
    float wBand = bandW > 0.01 ? (1.0 - smoothstep(bandW * (0.6 + uEdge2.x * bn), bandW * (1.4 + uEdge2.x * bn), -eEdge)) : 0.0;
    float gr = smoothstep(0.0, max(min(uEdge.z, shW), 0.5), -eEdge - bandW * 0.5);
    float wGrass = (1.0 - wPav) * smoothstep(0.35, 0.65, gr * 0.7 + pvFbm(uvS / 1.7 + 77.0) * 0.6 - 0.15);
    // a soft strip's border: the loose stuff and the grass mingle over the band, the coarse set among them
    if (!paved) { wBand *= 0.6; coarse = max(coarse, (1.0 - wPav) * wBand * 0.5); }
    wGrass = max(wGrass, grassStripe);
    vec3 nS = nT; float rS = rough; vec3 cS = col; float hS = hgt;
    float outside = 1.0 - wPav;
    float wb = outside * wBand * (1.0 - wGrass), wg = wGrass, wp = 1.0 - wb - wg;
    if (wb > 0.004) { Smp s = pvSet(2, uvS); cS = s.c.rgb; nS = s.n.xyz; rS = s.n.a; hS = s.c.a; }
    Smp g; g.c = vec4(0.0); g.n = vec4(0.0, 0.0, 1.0, 0.9);
    if (wg > 0.004) g = pvSet(3, uvS);
    if (wb > 0.004 || wg > 0.004) {
      vec3 w3 = pvHw3(hgt, wp, hS, wb, g.c.a, wg, uHex.x * 2.0);
      col = col * w3.x + cS * w3.y + g.c.rgb * w3.z; nT = nT * w3.x + nS * w3.y + g.n.xyz * w3.z; rough = rough * w3.x + rS * w3.y + g.n.a * w3.z;
    }
    // the shoulder's paths press the ground: the tracks set, a shade darker, the trough's slope
    if (dE < -0.5 && rut > 0.004) { Smp t = pvSet(4, uvS); float rw = rut * 0.4; col = mix(col, t.c.rgb, rw); rough = mix(rough, t.n.a - 0.1, rw); nT = mix(nT, t.n.xyz, rw * 0.5); col *= 1.0 - rut * 0.14; nT.y += -rr.y * uRut.y * 0.9 * nrmK; }
    // ---- 11 the wet: the film and the puddles. Grass does not shine; loose ground shines little
    float wetC = paved ? 1.0 : (grassy ? 0.12 : 0.25);
    float wet = uWet.x * mix(0.3, 1.0, wPav) * wetC;
    if (uLane.x > 0.5 && concrete && !road && wPav > 0.5) { float lvv2 = v + halfW + uLane.y * 0.5; float ln2 = floor(lvv2 / max(uLane.y, 0.5)); wet *= 0.55 + 0.9 * pvHash(vec2(ln2 * 2.0, seed + 11.0)) * smoothstep(0.3, 0.7, pvNoise(vec2(u / 60.0, ln2 + seed))); }
    float pud = 0.0;
    if (uWet.y > 0.001) {
      float pn = pvFbm(uvS / uWet.z + 61.0) + (paved ? 0.06 * abs(v) / max(halfW, 1.0) : 0.0) + rut * 0.14 + joint * 0.05 - (grassy ? 0.08 : 0.0);
      float t = 1.0 - uWet.y * 0.9;
      // THE COVER IS AN AREA, NOT A DEPTH (2026-09-23, the user: "the puddles should influence the
      // colour too. Darker under the puddles, that's why they look odd"). pud was multiplied by
      // uWet.y a second time, so at the shipped cover of 0.25-0.35 it peaked at 0.35 and pudK, a
      // smoothstep over [0.15, 0.6], never got past 0.41: the bed was blended in at two fifths, the
      // mirror at two fifths, and a puddle read as a faint gloss decal on dry concrete. The
      // THRESHOLD is where the cover belongs - it already sets how much of the ground is under
      // water - and inside that water the puddle is a whole puddle.
      pud = smoothstep(t, t + uWet.w, pn);
    }
    float wetK = clamp(wet + pud * 0.6, 0.0, 1.0);
    col *= 1.0 - 0.38 * wetK; rough = mix(rough, 0.12, wet);
    // A PUDDLE IS WATER (the user, 2026-09-22: "give them a good water reflective material"): a flat
    // mirror (roughness 0.02, the normal straight up) over the wet bed - the bed dark and, on soft
    // ground, a shade of its own mud - so what the eye sees in it is the sky the environment gives
    float pudK = smoothstep(0.15, 0.6, pud);
    gPudK = pudK;
    vec3 bed = col * (paved ? 0.60 : 0.50) * (paved ? vec3(1.0) : vec3(1.0, 0.94, 0.86));
    col = mix(col, bed, pudK);
    rough = mix(rough, 0.02, pudK);
    nT = mix(nT, vec3(0.0, 0.0, 1.0), pudK);
    if (!paved) rough = max(rough, mix(uSoft2.w, 0.02, pudK));         // loose ground does not shine; a puddle does
    // ---- the normal into the world, the roughness, the alpha
    vec3 T = normalize(vPavT), Ng = normalize(vPavNg), Bv = normalize(cross(Ng, T));
    vec3 nTn = normalize(vec3(nT.xy * nrmK, max(nT.z, 0.2)));
    gPavN = normalize(T * nTn.x + Bv * nTn.y + Ng * nTn.z);
    gPavR = clamp(rough, 0.03, 1.0);
    // THE FADE TO ALPHA (the user, three times): the mesh is the pavement and its band; past the band
    // it goes to nothing over fadeW metres - the ground under it is the world's, never this mesh's
    // grass - and the fade always fits inside the shoulder (a 3 m road shoulder fades over 2 m)
    float fade1 = shW, fade0 = clamp(min(bandW + 0.3, shW - max(uEdge.w, 0.6)), 0.0, shW - 0.3);
    gPavA = 1.0 - smoothstep(fade0, fade1, -dE);
    gPavA = mix(wPav, gPavA, clamp(vPavSh, 0.0, 1.0));
    // A GRASS ROAD IS THE WORLD'S GRASS WITH TRACKS IN IT: the mesh shows only where the wheels wore
    // it (the ruts, the compacted band, the tread); a grass STRIP keeps a share of its own lawn (it
    // is mown, and that reads) - the rest is the ground under it
    if (grassy) { float worn = clamp(rut * 1.3 + wheel + tread * 0.6, 0.0, 1.0); gPavA *= clamp((road ? 0.0 : 0.45) + worn, 0.0, 1.0); }
    diffuseColor.rgb = col; diffuseColor.a = gPavA;
    gPavDbg = uPavDbg < 1.5 ? gPavN * 0.5 + 0.5 : uPavDbg < 2.5 ? vec3(gPavR) : uPavDbg < 3.5 ? vec3(wetK, pud, 0.0) : uPavDbg < 4.5 ? mk
      : uPavDbg < 5.5 ? vec3(wp, wb, wg) : uPavDbg < 6.5 ? vec3(clamp(dE / 10.0, 0.0, 1.0), clamp(-dE / shW, 0.0, 1.0), gPavA) : uPavDbg < 7.5 ? vec3(fract(laneTone * 4.0), joint, spall)
      : uPavDbg < 8.5 ? vec3(crack, dmg, pch) : uPavDbg < 9.5 ? vec3(rut, grassStripe, moss) : uPavDbg < 10.5 ? vec3(rubber, paint, damp) : uPavDbg < 11.5 ? vec3(wheel, tread, coarse + mixW * 0.5) : col;
  }`;
  GLSL.rough = `  float roughnessFactor = gPavR;`;
  GLSL.normal = `
  normal = normalize((viewMatrix * vec4(gPavN, 0.0)).xyz);`;
  GLSL.lights = `
  { float pvS = uSpec.x * smoothstep(0.85, 0.45, roughnessFactor) * mix(1.0, 0.5, gPudK); reflectedLight.directSpecular *= pvS; reflectedLight.indirectSpecular *= pvS; }`;
  GLSL.debug = `
  if (uPavDbg > 0.5) gl_FragColor = vec4(gPavDbg, 1.0);`;

  // ---- the material ------------------------------------------------------------
  // Every material carries its own uniform rows (a strip's marks, a class's layers) and every knob
  // of the recipe; set() writes the recipe into all of them. A handful of materials a scene, so a
  // loop over them is nothing, and no per-draw trick is needed to keep one program.
  const MATS = [];
  function applyAll(THREE) { for (const m of MATS) applyOne(THREE, m); }
  // a set's mean colour graded as the shader grades it (gain, tint, saturation): linear rgb, what the
  // eye sees of that set on average - the far tier's uMean and the cover ring's `col` (v1.17)
  function gradedMean(key, r, lib) {
    const g = (r.grade && r.grade[key]) || [1, 1], t = g.length >= 5 ? g.slice(2, 5) : [1, 1, 1];
    const mean = (lib && lib.mean[key]) || ((typeof PAVEMENT_TEX_SETS !== 'undefined' && PAVEMENT_TEX_SETS[key] && PAVEMENT_TEX_SETS[key].mean) || [0.2, 0.2, 0.2]);
    const c = [mean[0] * g[0] * t[0], mean[1] * g[0] * t[1], mean[2] * g[0] * t[2]], l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    return [l + (c[0] - l) * g[1], l + (c[1] - l) * g[1], l + (c[2] - l) * g[1]];
  }
  // groundColor(cls, recipe): the drawn ground's linear colour beside a pavement of this class - its
  // BAND set (the cleared earth, the crushed stone) graded by the recipe (the premises' over the
  // module's); a tuft standing there takes it (the cover ring, v1.17)
  function groundColor(cls, recipe) {
    const row = CLASS_DEF[cls]; if (!row) return null;
    const r = recipe ? Object.assign(JSON.parse(JSON.stringify(RECIPE)), recipe, { grade: Object.assign({}, RECIPE.grade, recipe.grade || {}) }) : R;
    return gradedMean(row.shoulder, r, SHARED);
  }
  function applyOne(THREE, m) {
    const r = m.userData.pavRecipe || R, U = m.uniforms, d = m.userData.pav, lib = m.userData.pavLib, cls = CLASS_DEF[d.cls];
    // a road's band is crushed stone where a runway's is the cleared bare ground (the pale band beside a road read as a halo)
    const keyOf = s => (s === 'shoulder' && d.road && cls.roadShoulder) ? cls.roadShoulder : cls[s];
    const lay = s => (lib.layerOf[keyOf(s)] !== undefined ? lib.layerOf[keyOf(s)] : 0), met = s => lib.metres[keyOf(s)] || 2;
    U.uLayer.value.set(lay('base'), lay('damage'), lay('shoulder'), lay('grass'));
    U.uLayer2.value.set(lay('tracks'), lay('moss'), lay('macro'), 0);
    U.uTile.value.set(met('base'), met('damage'), met('shoulder'), met('grass'));
    U.uTile2.value.set(met('tracks'), met('moss'), met('macro'), 0);
    SLOTS.forEach((s, i) => { const g = (r.grade && r.grade[keyOf(s)]) || [1, 1]; U.uGrade.value[i].set(g[0], g[1], 0, 0); const t = g.length >= 5 ? g.slice(2, 5) : [1, 1, 1]; U.uTint.value[i].set(t[0], t[1], t[2], 0); });
    U.uClass.value.set(CLASSES.indexOf(d.cls), cls.lanes, cls.rut, d.poly ? 2 : (d.road ? 1 : 0));
    // the base's mean colour, graded exactly as the shader grades the base (gain, tint, saturation)
    { const c = gradedMean(cls.base, r, lib); U.uMean.value.set(c[0], c[1], c[2], 0.85); }
    U.uHex.value.set(r.hexDepth, r.hexOn, r.hexCells, cls.hexRot * Math.PI / 180 * r.hexRotK);
    U.uMacro.value.set(r.macroLuma, r.macroHue, r.macroRough, 0);
    U.uLane.value.set(cls.lanes, r.laneW, r.jointW, r.jointDepth);
    U.uLane2.value.set(r.laneTone, r.slabL, r.jointChip, r.jointDirt);
    U.uCrack.value.set(r.crackK, r.crackW, r.crackCell, r.damageK);
    U.uPatch.value.set(r.patchK, r.patchTone, r.patchRough, r.patchLen);
    U.uMoss.value.set(r.mossK, r.mossEdge, r.mossJoint, r.mossScale);
    U.uStain.value.set(r.stainK, r.stainScale, r.stainRough, 0);
    U.uWet.value.set(r.wet, r.puddleCover, r.puddleScale, r.puddleEdge);
    U.uMark.value.set(r.paintAge, r.paintRough, r.chalk, r.paintOnGrass);
    U.uRubber.value.set(r.rubberStart, r.rubberPeak, r.rubberEnd, r.rubberSpread);
    U.uRubber2.value.set(cls.rubber && !d.road ? r.rubberK : 0, r.rubberTrack, r.rubberStreak, 0);   // the rubber is a paved runway's (the touchdown zones); a soft strip's tyres MARK the same band
    U.uRut.value.set(r.rutTrack, r.rutW, r.rutDepth, r.rutAmp);
    U.uRut2.value.set(r.rutLambda, r.rutGrass, cls.rut, r.shoulderPaths);
    // the lanes: how many, how wide, how hard the traffic polishes their wheel paths. The same
    // lanesOf the PAINT used, so the wear and the markings cannot disagree about where a lane is.
    { const wRoad = d.wid || 0, nL = (wRoad > 0 && d.road && !d.poly) ? lanesOf(wRoad, d.cls, r.roadLane) : 0;
      U.uRoad.value.set(nL, nL > 0 ? wRoad / nL : 0, r.wheelPolish, 0); }
    const band = m.userData.pavBand !== undefined ? m.userData.pavBand : (r.band >= 0 ? r.band : (d.road ? Math.min(cls.band, 1.2) : cls.band));
    U.uEdge.value.set(r.edgeChip, band, r.grassReach, r.fadeW);
    U.uEdge2.value.set(r.bandNoise, 0, 0, 0);
    U.uDist.value.set(r.detailFrom, r.detailTo, r.normalFrom, r.normalTo);
    U.uSpec.value.set(r.specK, r.nrmK, 0, 0);
    const sk = cls.soft || [1, 1, 1, 1];                                       // the class's own share of each soft layer
    U.uSoft.value.set(r.softMix * sk[0], r.coarseK * sk[1], r.wheelBand * sk[2], r.treadK * sk[3]);
    U.uSoft2.value.set(r.paintRelief, r.mow, r.edgeSoft, r.grassRough);
  }
  // the hook: ONE function, its source the program's key; the uniforms ride in on sh._pavU
  const hook = sh => {
    if (typeof ATMO !== 'undefined') ATMO.inject(sh);
    Object.assign(sh.uniforms, sh._pavU);
    sh.vertexShader = GLSL.vertex + '\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>' + GLSL.vertexBody);
    sh.fragmentShader = GLSL.common + '\n' + sh.fragmentShader
      .replace('#include <map_fragment>', '#include <map_fragment>' + GLSL.map)
      .replace('#include <roughnessmap_fragment>', GLSL.rough)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>' + GLSL.normal)
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>' + GLSL.lights)
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>' + GLSL.debug);
  };
  const DBG = { value: 0 };   // one debug switch for every pavement
  function make(THREE, o) {
    const lib = o.lib, cls = o.cls || 'concrete';
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, transparent: true, depthWrite: false, side: THREE.FrontSide });
    const v4 = () => ({ value: new THREE.Vector4() });
    const marks = (CLASS_DEF[cls].marks ? o.marks : null) || { rects: [], segs: [] };
    const mR = [], mK = [];
    for (let i = 0; i < NMARK; i++) { const r = marks.rects[i]; mR.push(new THREE.Vector4(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0, r ? r[3] : 0)); mK.push(new THREE.Vector4(r ? r[4] : 0, r ? r[5] : 0, r ? r[6] : 0, r ? r[7] : 0)); }
    const sg = [], sk = [];
    for (let i = 0; i < NSEG; i++) { const s = marks.segs[i]; sg.push(new THREE.Vector4(s ? s[0] : 0, s ? s[1] : 0, s ? s[2] : 0, s ? s[3] : 0)); sk.push(new THREE.Vector4(s ? s[4] : 0, s ? s[5] : 0, 0, 0)); }
    m.uniforms = { uPavA: { value: lib.texA }, uPavN: { value: lib.texN }, uPavOn: { value: (lib.ready || lib.readyOld) ? 1 : 0 }, uPavDbg: DBG,
      uLayer: v4(), uLayer2: v4(), uTile: v4(), uTile2: v4(), uClass: v4(), uHex: v4(), uMacro: v4(), uLane: v4(), uLane2: v4(), uCrack: v4(), uPatch: v4(),
      uMoss: v4(), uStain: v4(), uWet: v4(), uMark: v4(), uPaint0: { value: new THREE.Vector4(0.62, 0.60, 0.55, 1) }, uPaint1: { value: new THREE.Vector4(0.70, 0.54, 0.14, 1) },
      uRubber: v4(), uRubber2: v4(), uRut: v4(), uRut2: v4(), uRoad: v4(), uEdge: v4(), uEdge2: v4(), uDist: v4(), uSpec: v4(), uSoft: v4(), uSoft2: v4(),
      uMean: { value: new THREE.Vector4(0.2, 0.2, 0.2, 0.9) }, uGrade: { value: Array.from({ length: 8 }, () => new THREE.Vector4(1, 1, 0, 0)) }, uTint: { value: Array.from({ length: 8 }, () => new THREE.Vector4(1, 1, 1, 0)) },
      uMarkN: { value: Math.min(NMARK, marks.rects.length) }, uSegN: { value: Math.min(NSEG, marks.segs.length) },
      uMarkR: { value: mR }, uMarkK: { value: mK }, uSeg: { value: sg }, uSegK: { value: sk } };
    m.userData.pav = { cls, road: !!o.road || !!o.poly, poly: !!o.poly, wid: (o.marks && o.marks.wid) || 0 }; m.userData.pavLib = lib; m.userData.pavRecipe = o.recipe || null;   // a resolved recipe of its own (the game), or the module's (the bench)
    if (o.band !== undefined && o.band !== null) m.userData.pavBand = +o.band;
    m.onBeforeCompile = sh => { sh._pavU = m.uniforms; hook(sh); };
    m.customProgramCacheKey = () => 'pavement:' + hook.toString().length;
    MATS.push(m);
    applyOne(THREE, m);
    return m;
  }
  // the mesh's shoulder for a band: the band, the fade past it, a metre of grass creep
  const shoulderFor = (band, recipe) => Math.max(1, band + (recipe || R).fadeW + 1);
  function set(THREE, o) { for (const k in o) { if (k === 'grade') Object.assign(R.grade, o.grade); else R[k] = o[k]; } applyAll(THREE); }
  function reset(THREE) { R = JSON.parse(JSON.stringify(RECIPE)); applyAll(THREE); }
  function debug(v) { DBG.value = v; }
  function exportRecipe() { return JSON.parse(JSON.stringify(R)); }
  function dispose(m) { const i = MATS.indexOf(m); if (i >= 0) MATS.splice(i, 1); m.dispose(); }
  const api = { CLASSES, CLASS_DEF, SLOTS, RECIPE, KNOBS, ENTRY_KNOBS, PRESETS, resolve, NMARK, NSEG, get recipe() { return R; },
    stripGeometry, roadGeometry, polyGeometry, field, shoulderFor, sharedLib, groundColor, gradedMean, lanesOf, standMarks, marksOf, roadMarks, collapse, recorder, library, keysFor, make, set, reset, debug, exportRecipe, dispose, GLSL, hook, mats: MATS };
  return api;
})();
if (typeof module !== 'undefined' && module.exports) module.exports = PAVEMENT;
