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
    // THE PUDDLES ARE GONE (2026-09-23, the user: "just fully remove the puddles on the runways and
    // the roads, they just look bad ... let's just remove them overall"). Two passes tried to make
    // standing water read on pavement - a darker bed, then half the sky off its mirror - and neither
    // earned its place. The reason is structural, not a setting: the pavement is a DRAPED mesh with
    // no low spot for water to lie in, so a puddle is a shape painted on a slope, and the eye reads
    // the shape before it reads the shine. `wet` stays - a damp coast is a film, and a film follows
    // the surface it wets. puddleCover / puddleScale / puddleEdge are retired with their uniform.
    wet: 0.35,
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
    // THE SIDES FADE TO THE GROUND (G660, the user after the 2026-09-26 playtest: "do not touch the runways
    // (their surface looks good), just their sides ... maybe transparent for now"). A strip's and a paved
    // polygon's band - the gravel, the grass creeping in, the shoulder's vehicle paths - is no longer drawn:
    // past the edge the surface's own colour goes to alpha over sideW metres (from sideA), and the island's
    // ground shows. The band still EXCLUDES the vegetation (coverAt's PAVE_BAND is untouched). 0 = the band.
    sideFade: 1, sideW: 1.2, sideA: 0.35,
    // THE ROADS' SIDES (G1391, RUNWAY-LOOK: "the dirt runway / path, which is very large" - a 6 m road drew 15.7 m, its
    // band + the fade past it at alpha >= 0.5): a road fades its side out like a strip (1), its declared width the drawn
    // one; 0 = every road draws its band again. A road whose entry declares its own `band` draws it either way.
    roadSide: 1,
    detailFrom: 250, detailTo: 900, normalFrom: 120, normalTo: 500,
    specK: 1.0, nrmK: 1.0, specAA: 0.35, jointAniso: 1,
    softMix: 0.8, coarseK: 0.7, wheelBand: 0.85, treadK: 0.8, paintRelief: 1.0, mow: 0.6, edgeSoft: 2.6, grassRough: 0.82,
    grade: { gravelR: [1.0, 0.55], gravelK: [0.95, 0.55], gravelS: [1.0, 0.5], dry: [0.40, 0.58, 0.96, 1.0, 0.91], concreteA: [1.7, 0.45, 0.94, 0.98, 1.06], concreteB: [1.25, 0.6, 0.95, 0.98, 1.05], concreteD: [1.1, 0.7], mudAir: [1.1, 0.6], dirtP: [1.0, 0.7], grass: [0.9, 1.0], gravelG: [0.85, 0.7, 1.06, 1.0, 0.9], gravelF: [0.6, 0.6, 1.12, 1.0, 0.84], gravelB: [1.25, 0.55, 1.0, 1.0, 0.92], rockG: [0.75, 0.7, 1.02, 1.0, 0.94], dirtS: [2.9, 0.7], trailR: [0.55, 0.7], dirtG: [1.0, 0.8], tracksM: [2.6, 0.35], grassG: [0.9, 1.0, 0.9, 1.0, 0.8], grassP: [0.55, 0.9, 0.95, 1.0, 0.9], grassS: [1.6, 0.9], leafygrass: [0.8, 0.9, 0.85, 1.0, 0.75], fieldgrass: [0.85, 0.85], lush: [0.85, 1.0], sandC: [1.3, 0.8], gravelS: [0.6, 0.5] },
  };
  // THE RUNWAY LOOK (G1390, RUNWAY-LOOK; the user, 3 Oct: "I would want to color the runway and its sides further, more
  // control over those"). Per SURFACE TYPE - `pv` the paved (concrete, asphalt), `sf` the soft (gravel, dirt, sand), `gr`
  // the grass - nine knobs: the surface's brightness, its tint (a hue and how much of it: a multiplier whose mean stays 1)
  // and its WEAR (a factor on the class's wear knobs, below), and the side's own brightness and tint, its width (m past
  // the edge zone; -1 = the edge zone's sideW) and the alpha it starts from (-1 = sideA). Saved with the premises
  // (rec.pavement: the editor's PAVEMENT section lists them); the world look's RUNWAY section lays a live overlay over
  // every pavement (look()) and exports it. The defaults draw what G1391 draws: brightness 1, no tint, wear 1, the paved
  // side at the edge zone's sideA, the soft and grass sides their ragged edge alone (alpha 0) over edgeSoft (G1395).
  const LOOK_GROUPS = { pv: ['concrete', 'asphalt'], sf: ['gravel', 'dirt', 'sand'], gr: ['grass'] };
  const LOOK_NAMES = { pv: 'paved (concrete, asphalt)', sf: 'soft (gravel, dirt, sand)', gr: 'grass' };
  // G1395: a soft / grass side's spread at -1 is the edge zone's edgeSoft (2.6 m: the old torn edge, reaching ~3 x it out);
  // the paved one's the edge zone's sideW
  const LOOK_K = ['Bright', 'Hue', 'Tint', 'Wear', 'SideBright', 'SideHue', 'SideTint', 'SideW', 'SideA'];
  const LOOK_KEYS = [];
  for (const g in LOOK_GROUPS) for (const k of LOOK_K) {
    LOOK_KEYS.push(g + k);
    RECIPE[g + k] = { Bright: 1, Hue: 0.12, Tint: 0, Wear: 1, SideBright: 1, SideHue: 0.12, SideTint: 0, SideW: -1, SideA: g === 'pv' ? -1 : 0 }[k];
  }
  // what WEAR scales, per surface type: the paved class's ageing, the soft ground's traffic
  const LOOK_WEAR = { pv: ['crackK', 'damageK', 'patchK', 'mossK', 'stainK', 'rubberK'], sf: ['wheelBand', 'coarseK', 'rutDepth', 'treadK'], gr: ['wheelBand', 'coarseK', 'rutDepth', 'treadK'] };
  const groupOf = cls => (cls === 'concrete' || cls === 'asphalt') ? 'pv' : (cls === 'grass' ? 'gr' : 'sf');
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
    ['wet', 'wet film', 0, 1, 0.02],
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
    ['sideFade', 'strip sides fade to the ground (0/1)', 0, 1, 1], ['sideW', 'side fade width (m)', 0.5, 10, 0.5], ['sideA', 'side fade from alpha', 0, 1, 0.05], ['roadSide', "roads' sides fade like the strips' (1) / draw their band (0)", 0, 1, 1],
    ['edgeChip', 'edge chipping (m)', 0, 2, 0.05], ['band', 'gravel band (m, -1 = class)', -1, 40, 0.5], ['bandNoise', 'band raggedness', 0, 1, 0.02], ['grassReach', 'grass creeps in over (m)', 0.5, 30, 0.5], ['fadeW', 'fade to terrain over (m)', 0.5, 30, 0.5],
    ...Object.keys(LOOK_GROUPS).flatMap(g => [['— runway look: ' + LOOK_NAMES[g] + ' —'],
      [g + 'Bright', 'surface brightness', 0.3, 2, 0.02], [g + 'Hue', 'surface tint hue (0 red, .17 yellow, .33 green, .67 blue)', 0, 1, 0.01], [g + 'Tint', 'surface tint amount', 0, 1, 0.02],
      [g + 'Wear', "wear (x the class's cracks, patches, ruts...)", 0, 2, 0.05],
      [g + 'SideBright', 'side brightness', 0.3, 2, 0.02], [g + 'SideHue', 'side tint hue', 0, 1, 0.01], [g + 'SideTint', 'side tint amount', 0, 1, 0.02],
      [g + 'SideW', g === 'pv' ? "side width (m past the edge zone, -1 = the edge zone's)" : "side spread (m: the torn edge reaches ~3 x it; -1 = edgeSoft)", -1, 12, 0.1], [g + 'SideA', "side starts at alpha (blend into the ground; -1 = the edge zone's)", -1, 1, 0.05]]),
    ['— distance —'],
    ['detailFrom', 'detail fades from (m)', 20, 1500, 10], ['detailTo', 'detail gone by (m)', 50, 3000, 10], ['normalFrom', 'normal fades from (m)', 10, 1000, 10], ['normalTo', 'normal gone by (m)', 30, 2000, 10],
    ['specK', 'specular (haze fade x)', 0, 2, 0.05], ['nrmK', 'normal strength', 0, 3, 0.05], ['specAA', 'specular anti-alias (as the ground)', 0, 1, 0.05], ['jointAniso', 'joints AA per axis (1) / isotropic (0)', 0, 1, 1],
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
  // G1001: `inPin` pins a row that far INSIDE the edge too - where the lift ends (SINK.liftIn), so the edge's lift is
  // not interpolated across the whole next row (a 24 m taxiway's rows are 4 m apart: 45 mm at 1.7 m in, measured)
  function rowsAcross(halfW, shW, band, fadeW, resV, inPin) {
    const pins = [0, halfW, halfW + Math.max(0.3, band), halfW + Math.max(band + 0.6, shW - fadeW), halfW + shW];
    if (inPin > 0 && inPin < halfW) pins.push(halfW - inPin);
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
  // ---- THE GROUND UNDER THE PAVEMENT (G660) ------------------------------------
  // The pavement is transparent (its sides fade), writes no depth, and was lifted 5-8 cm over a ground
  // patch whose LOD levels stray up to ~40 cm from the fine grid: at a distance, and at a grazing angle
  // anywhere, the ground's triangles pierced it and which ones did moved with the camera (the playtest's
  // 141608 / 144959 / 145145) - and the wheels, which roll on terrainH, sat those 5-8 cm into it (142532).
  // Now the ground is SUNK under the pavement's opaque interior (render_premises' patch, by sinkAt) and
  // the pavement comes DOWN to terrainH there (liftK), so no camera distance can pierce it and the drawn
  // surface is the solver's. Near the edge, where the pavement is not yet opaque, both keep the old lift.
  //   opaqueDepth(cls, halfW, recipe, kind): how far inside the edge the shader's alpha is 1 for sure - the paved
  //     edge's chipping (edgeChip), a soft edge's and a grass strip's tear the same (G1391); a grass road
  //     or polygon is translucent over its whole width and never sinks (Infinity)
  //   sinkAt(dE, d0): the ground's drop, S over `ramp` metres from d0 inward
  //   liftK(dE, d0): the pavement's lift factor, 1 at the edge -> 0 at `liftIn` inside it (G1001, below; it
  //     was 1 -> 0 only `pad` metres past the full sink)
  // G1001 (A6-GROUND, the playtest's "floaty" taxi): THE LIFT STAYS AT THE EDGE, NOT ACROSS THE PAVEMENT. The lift
  // went to 0 only pad + fall (4.5 m) past the full sink: 8 m inside a concrete edge, never on a 10 m taxiway, a
  // gravel strip (d0 6.6 m) or a grass one (d0 Infinity) - the wheels, which stand on terrainH, sat 7-8 cm into
  // every one of them (tools/ground_surface.js: roads +67 mm on average, aprons +38, gravel and grass strips +70).
  // Now the lift is the SIDE's (dE <= 0, where the ground shows through and the roads' band is drawn) and falls to 0
  // over `liftIn` inside the edge, on every class: past it the pavement is drawn at terrainH, the wheels' surface.
  // THE LIFT MOVES TO THE GROUND: over the same `liftIn`, by the same law, the patch drops `pre` (the builders' 7 cm)
  // before the deep sink takes over from d0 - so the pavement stands over the ground by what it always did at every
  // depth (the patch's own 2 cm + 7), and nothing is seen to sink through a torn soft edge but those 7 cm.
  // Measured on Jolene (tools/ground_surface.js --sep, the 0.5 m grid, points of pavement within 5 mm of the drawn
  // ground, master -> now): runways and strips 0 -> 0; road edge 257 -> 220, side 2862 -> 2625, band 19 -> 75; apron
  // edge 6 -> 18 (terrain curvature on the roads' grade blends). --grid, past liftIn: the drawn surface over terrainH
  // on the roads 67 -> 0 mm mean, p5..p95 -4..4 (HANDOVER G1001; GATE CONTACT holds both).
  const SINK = { S: 0.8, ramp: 3, pad: 3, fall: 1.5, liftIn: 1.5, pre: 0.07 };   // pad, fall: G660's, unused since G1001
  const ss01 = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // G1391 (RUNWAY-LOOK): a soft edge tears as deep as a paved edge chips (edgeChip) and no deeper, a grass STRIP's too (a
  // grass road, an apron of grass: still the world's grass with tracks in it - translucent, never sunk). `kind` is pavedAt's ('strip' | 'road' | 'poly'); without it a grass pavement keeps the safe Infinity.
  function opaqueDepth(cls, halfW, recipe, kind) {
    const r = recipe || R;
    if (cls === 'grass' && kind !== 'strip') return Infinity;
    return Math.max(r.edgeChip || 0, cls === 'concrete' || cls === 'asphalt' ? 0 : 0.1) + 0.2;
  }
  const sinkAt = (dE, d0) => Math.max(SINK.pre * ss01(0, SINK.liftIn, dE), isFinite(d0) ? SINK.S * ss01(d0, d0 + SINK.ramp, dE) : 0);   // G1001: pre first
  const liftK = (dE, d0) => 1 - ss01(0, SINK.liftIn, dE);   // G1001: d0 no longer delays it (kept in the signature)
  // a builder's lift at a vertex: o.sinkD0 (the caller's opaqueDepth) says the ground under it is sunk
  const liftOf = (o, lift, dE) => (o.sinkD0 !== undefined && o.sinkD0 !== null ? lift * liftK(dE, o.sinkD0) : lift);
  function stripGeometry(THREE, o) {
    const cls = CLASSES.indexOf(o.cls || 'concrete'), seed = o.seed || 0, shW = o.shoulderW !== undefined ? o.shoulderW : 12;
    const lift = o.lift !== undefined ? o.lift : 0.07, resU = o.resU || 6, resV = o.resV || 3;
    const band = o.band !== undefined ? o.band : CLASS_DEF[CLASSES[cls]].band, fadeW = o.fadeW !== undefined ? o.fadeW : R.fadeW;
    const F = stripFrame(o), halfL = F.halfL, halfW = F.halfW, len = o.len;
    const V = rowsAcross(halfW, shW, band, fadeW, resV, o.sinkD0 !== undefined && o.sinkD0 !== null ? SINK.liftIn : 0);
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
      const y = (o.heightAt ? o.heightAt(w[0], w[1]) : 0) + liftOf(o, lift, sdBox(u, v, halfL, halfW, len));
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
    g.computeVertexNormals(); g.computeBoundingSphere();   // world-space vertices: an honest sphere, frustum-culled (G663)
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
    const halfW = w / 2, V = rowsAcross(halfW, shW, band, fadeW, resV, o.sinkD0 !== undefined && o.sinkD0 !== null ? SINK.liftIn : 0);
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
        const y = (o.heightAt ? o.heightAt(wp[0], wp[1]) : 0) + liftOf(o, lift, halfW - Math.abs(v));
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
    g.computeVertexNormals(); g.computeBoundingSphere();
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
      const x = x0 + (x1 - x0) * i / nx, z = z0 + (z1 - z0) * j / nz, dE = sd(x, z);
      const y = (o.heightAt ? o.heightAt(x, z) : 0) + liftOf(o, lift, dE);
      const dx = x - cx, dz = z - cz, u = dx * c + dz * sn, v = -dx * sn + dz * c;
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
      pav[k * 4] = u + halfW; pav[k * 4 + 1] = v; pav[k * 4 + 2] = dE; pav[k * 4 + 3] = shW;
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
    g.computeVertexNormals(); g.computeBoundingSphere();
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
  // THE LAYERS ARE COOKED (G911, AS2): each set's two planes were packed OFFLINE by tools/ground_tex_prep.js, byte for
  // byte what this function's canvas loop packed in the page (GATE GROUNDLIB holds every key to it); GROUND_LIB
  // fetches and copies them. No Image, no canvas, no getImageData here any more. A set whose file FAILS takes its
  // mean colour (sRGB-encoded, the array is sRGB-typed) over a flat normal, and never stalls the library (G751).
  // `prev` (sharedLib's grow): the arrays being replaced lend the layers they already hold.
  function library(THREE, keys, done, prev) {
    const SETS = (typeof PAVEMENT_TEX_SETS !== 'undefined') ? PAVEMENT_TEX_SETS : null;
    const lib = { keys: keys.slice(), layerOf: {}, metres: {}, mean: {}, texA: null, texN: null, ready: false };
    keys.forEach((k, i) => { lib.layerOf[k] = i; const s = SETS && SETS[k]; lib.metres[k] = s ? s.metres : 2; lib.mean[k] = s && s.mean ? s.mean : [0.2, 0.2, 0.2]; });
    if (!SETS || typeof document === 'undefined' || typeof GROUND_LIB === 'undefined') { if (done) done(lib); return lib; }
    const px = (typeof GROUND_TEX !== 'undefined' && GROUND_TEX) ? GROUND_TEX.px : 512, N = keys.length;
    for (const k of keys) if (!SETS[k]) console.warn('pavement: no set ' + k);
    const lend = prev && prev.texA && prev.texN && prev.texA.image && prev.texN.image
      ? { urls: prev.keys.map(k => SETS[k] && SETS[k].layers), A: GROUND_LIB.planeOf(prev.texA), N: GROUND_LIB.planeOf(prev.texN) } : null;
    GROUND_LIB.pack(keys.map(k => SETS[k] ? { layers: SETS[k].layers, ktx: SETS[k].ktx, mean: lib.mean[k], label: k } : null), (data, dataN, failed) => {
      if (!data) { if (done) done(lib); return; }
      for (const k of failed) console.warn('pavement: ' + k + ' layers failed - its mean colour stands in');
      // THE COLOUR ARRAY IS sRGB-TYPED (2026-09-22): the GPU decodes before it filters, so a mip is the
      // mean of linear texels. Decoding in the shader after the fetch filtered in sRGB space, and a far
      // texel came out 17-29 % darker than the near ones on the dark, contrasty sets (Jensen). The
      // height in alpha rides along untouched (alpha is never transferred). AS3 (G917): the planes may arrive
      // as KTX2 (a compressed array, the file's mips averaged in linear light as this sRGB texture's own were);
      // GROUND_LIB.arrayTexture makes either kind with these same settings.
      // G662: anisotropy 16 - three clamps to the GPU's maximum; 8 blurred the grain at grazing angles (142931)
      const mk = (dd, srgb) => GROUND_LIB.arrayTexture(THREE, dd, N, { srgb, aniso: 16 });
      lib.texA = mk(data, true); lib.texN = mk(dataN, false); lib.ready = true;
      for (const m of MATS) if (m.userData.pavLib === lib) { m.uniforms.uPavA.value = lib.texA; m.uniforms.uPavN.value = lib.texN; m.uniforms.uPavOn.value = 1; applyOne(THREE, m); }
      if (done) done(lib);
    }, lend);
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
      if (TAB.mat && SHARED === L) { const U = TAB.mat.uniforms; U.uPavA.value = L.texA; U.uPavN.value = L.texN; U.uPavOn.value = 1; }   // G925: the one material
      if (old && old.texA && old !== L) { old.texA.dispose(); old.texN.dispose(); }
      for (const w of L.waiters || []) w(L); if (L.waiters) L.waiters.length = 0;   // (headless the library calls back at once, before `waiters`)
      if (onReady) onReady(L);
    }, old && old.ready ? old : null);   // G911: the old arrays lend the layers they hold (a grow fetches only the new sets)
    lib.waiters = lib.waiters || [];
    // until the new arrays decode, the materials keep the old ones (their layers still valid there)
    if (old && old.ready) { lib.texA = old.texA; lib.texN = old.texN; lib.readyOld = true; }
    SHARED = lib;
    if (lib.ready && TAB.mat) { const U = TAB.mat.uniforms; U.uPavA.value = lib.texA; U.uPavN.value = lib.texN; U.uPavOn.value = 1; }   // (headless: ready at once)
    return lib;
  }
  // the keys a class needs, in slot order (base, damage, shoulder, grass, tracks, moss, macro), deduplicated
  function keysFor(classes) {
    const out = [];
    for (const c of classes) for (const s of SLOTS.concat(['roadShoulder'])) { const k = CLASS_DEF[c][s]; if (k && out.indexOf(k) < 0) out.push(k); }
    return out;
  }

  // ---- the shader ------------------------------------------------------------
  const NMARK = 40, NSEG = 8, NKEEP = 4;
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
uniform vec4 uSide, uRoadEnd; uniform int uKeepN; uniform vec4 uKeepA[${NKEEP}], uKeepB[${NKEEP}];
varying vec4 vPav; varying vec4 vPavK; varying vec3 vPavW; varying vec3 vPavT; varying vec3 vPavNg; varying float vPavSh;
float gPavR; vec3 gPavN; float gPavA; vec3 gPavDbg; float gPlain; float gRot; float gHexSoft;
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
  if (uHex.y < 0.5 || gPlain > 0.999) return pvFetch(layer, st, vec2(1.0, 0.0), slot);
  vec2 sk = mat2(1.0, 0.0, -0.57735027, 1.15470054) * (st * uHex.z);
  vec2 base = floor(sk); vec3 t = vec3(fract(sk), 0.0); t.z = 1.0 - t.x - t.y;
  float s = step(0.0, -t.z), s2 = 2.0 * s - 1.0;
  vec3 w = vec3(-t.z * s2, s - t.y * s2, s - t.x * s2);
  vec2 v1 = base + vec2(s, s), v2 = base + vec2(s, 1.0 - s), v3 = base + vec2(1.0 - s, s);
  // EACH FETCH KEEPS ITS VERTEX ACROSS A TRIANGLE EDGE (B11-PAVEGRAIN G1030, landed here 2026-10-01 - the user: "1-pixel
  // lines ... colours feel scrambled ... they follow 3 directions and intersect forming triangles"). The three reads
  // were handed out by the triangle (v1 = the corner at base or base + 1): crossing the diagonal SWAPS v2 and v3,
  // crossing a cell edge moves all three, so a 2 x 2 quad astride an edge fed one texture() two different vertices'
  // coordinates - offsets 7.3 tiles apart - and its implicit derivative asked for the smallest mip (16x anisotropy
  // along a random axis): every triangle edge of the lattice drew a 1-2 px line of wrong-mip texels that crawled with
  // the camera. The lattice (edges (1,0), (0,1), (1,-1)) is three-coloured by (i - j) mod 3 - every triangle holds one
  // corner of each colour - so fetch k reads THE CORNER OF COLOUR k: across an edge the two shared corners stay in
  // their fetch and the third comes in at weight 0. Derivatives are the surface's again; a few selects. (Mikkelsen's
  // own answer passes the unrotated derivatives explicitly - explicit gradients on an array: an fxc internal error.) The rest
  // of B11's branch (claude/upbeat-hertz-3fa42a: the noises' and the relief's footprint fades) is not taken here.
  {
    float cb = base.x - base.y; cb -= 3.0 * floor((cb + 0.5) / 3.0);   // v1's colour, 0..2 (v2 is cb + s2, v3 cb - s2)
    float c2 = cb + s2; c2 -= 3.0 * floor((c2 + 0.5) / 3.0);
    vec3 cc = vec3(cb, c2, 3.0 - cb - c2);
    vec2 q0 = cc.x < 0.5 ? v1 : (cc.y < 0.5 ? v2 : v3), q1 = abs(cc.x - 1.0) < 0.5 ? v1 : (abs(cc.y - 1.0) < 0.5 ? v2 : v3), q2 = cc.x > 1.5 ? v1 : (cc.y > 1.5 ? v2 : v3);
    w = vec3(cc.x < 0.5 ? w.x : (cc.y < 0.5 ? w.y : w.z), abs(cc.x - 1.0) < 0.5 ? w.x : (abs(cc.y - 1.0) < 0.5 ? w.y : w.z), cc.x > 1.5 ? w.x : (cc.y > 1.5 ? w.y : w.z));
    v1 = q0; v2 = q1; v3 = q2;
  }
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
  // the far tier's plain fetch comes in over a band, not at one distance (G662: a hard step at 900 m swept
  // down the runway as the camera moved)
  if (gPlain > 0.001) { Smp pl = pvFetch(layer, st, vec2(1.0, 0.0), slot); o.c = mix(o.c, pl.c, gPlain); o.n = mix(o.n, pl.n, gPlain); }
  return o;
}
// THE OTHER PAVEMENTS' BOXES (G664): a strip's side does not lie over another strip's surface - exact per
// pixel (the per-vertex shoulder keep was 3 x 6 m coarse, and the game's strips never had it). A box is
// (centre x, z, the axis cos, sin) + (half length, half width); 0 inside, 1 two metres out
float pvKeep(vec2 p) {
  float k = 1.0;
  for (int i = 0; i < ${NKEEP}; i++) {
    if (i >= uKeepN) break;
    vec4 A = uKeepA[i], B = uKeepB[i]; vec2 d = p - A.xy;
    vec2 q = vec2(abs(d.x * A.z + d.y * A.w) - B.x, abs(-d.x * A.w + d.y * A.z) - B.y);
    float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
    k = min(k, smoothstep(0.3, 2.0, sd));
  }
  return k;
}
// how deep p lies inside the deepest keep box (metres, <= 0 outside): a road's or an apron's own surface fades out
// just inside a strip's box (G981), so the strip's surface is the one seen at a junction
float pvInside(vec2 p) {
  float din = -1e3;
  for (int i = 0; i < ${NKEEP}; i++) {
    if (i >= uKeepN) break;
    vec4 A = uKeepA[i], B = uKeepB[i]; vec2 d = p - A.xy;
    vec2 q = vec2(abs(d.x * A.z + d.y * A.w) - B.x, abs(-d.x * A.w + d.y * A.z) - B.y);
    din = max(din, -(length(max(q, 0.0)) + min(max(q.x, q.y), 0.0)));
  }
  return din;
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
    // THE SEED IS SNAPPED (G1046, the user's TEST 11): vPavK is constant per mesh, but a perspective-correct
    // varying is NOT returned bit-exact (a / w interpolated, then times w: an ulp or two off, varying with the view).
    // The slab hashes (pvHash = fract(sin(dot(p, (127.1, 311.7))) * 43758.5)) turn that ulp into a new random
    // number PER PIXEL: slab lengths, joints and slab tones flipped from pixel to pixel and crawled as the camera
    // moved - the runway's flicker. pavSeed is k / 37 (render_world, render_premises), so the snap is exact.
    float cls = floor(vPavK.x + 0.5), seed = floor(vPavK.y * 37.0 + 0.5) / 37.0, halfW = vPavK.z, halfL = vPavK.w;
    vec2 P = vec2(u, v);
    vec2 uvS = P + vec2(seed * 37.0, seed * 91.0);
    vec2 pdx = dFdx(P), pdy = dFdy(P);                              // one pair of derivatives for both footprints (G1047)
    vec2 fw = abs(pdx) + abs(pdy) + 1e-5;                              // = fwidth(P)
    float fwm = max(fw.x, fw.y);
    // THE FOOTPRINT PER AXIS (G1047): a line of constant v (a longitudinal joint) is crossed by v alone, so its
    // anti-alias width is v's footprint - the length of v's screen gradient - not the larger of the two: looking
    // down a runway u's footprint is metres, v's centimetres, and max() smeared every longitudinal joint by u's
    vec2 fwA = sqrt(pdx * pdx + pdy * pdy) + 1e-5;
    float dist = distance(vPavW, cameraPosition);
    float detail = 1.0 - smoothstep(uDist.x, uDist.y, dist);
    float nrmK = uSpec.y * (1.0 - smoothstep(uDist.z, uDist.w, dist));
    gPlain = smoothstep(uDist.y * 0.8, uDist.y * 1.1, dist);
    bool sideFade = uSide.x > 0.5;
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
      vec2 fj = mix(vec2(fwm), fwA, uEdge2.y);                         // G1047: each joint by the footprint across it
      float jv = (1.0 - smoothstep(jw - fj.y, jw + fj.y, dv)) * min(1.0, 2.0 * jw / fj.y), ju = (1.0 - smoothstep(jw * 0.6 - fj.x, jw * 0.6 + fj.x, du)) * 0.35 * min(1.0, 1.2 * jw / fj.x);
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
    if (dE < -0.5 && uRut2.w > 0.5 && uEdge.y > 4.0 && !sideFade) {
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
      // a soft road has no edge: the loose stuff thins out through three octaves of noise (15 m, 4 m, 1 m) - islands of
      // dirt in the grass, tongues of grass in the dirt. G1391 (RUNWAY-LOOK, the user: "the grass runway is very thin at
      // the same dimensions as the dirt runway / path, which is very large"): the declared width is all surface (never
      // eaten deeper than edgeChip, a paved edge's chipping) and the blend is OUTSIDE it, over the side's reach tw. It
      // was centred 0.3 x edgeSoft outside the edge with +-2 x edgeSoft of noise either way: a dirt strip drew islands
      // ~8 m past its edge and was opaque only ~6 m inside it. G1395 (the user on the evidence: "the new side patch blend
      // a lot worse with the environment than before"): the first cut tore over 1.8 m with a hard 0.42-0.58 threshold -
      // a ruled line, and a second cut whose reach wandered too little read the same from the air. So the side IS the
      // old edge again, line for line - the loose stuff thinning out through three octaves (15 m bays, 4 m tongues, 1 m
      // crumbs) over the side's spread s (sfSideW / grSideW; -1 = edgeSoft, 2.6 m, at most 0.6 x halfW as before) - and
      // the declared width is FILLED under it: opaque from edgeChip in (a paved edge's chipping), never eaten deeper.
      float tc = max(uEdge.x, 0.1), soft = clamp(min(uSide.y, halfW * 0.6), 0.3, 6.0);
      float e2 = dE + soft * (0.9 * (pvNoise(vec2(u / 15.0, seed + 19.0)) - 0.5) * 2.0 + 0.7 * (pvFbm(uvS / 4.0 + 23.0) - 0.5) * 2.0 + 0.35 * (pvNoise(uvS / 1.0) - 0.5) * 2.0);
      wPav = max(smoothstep(-soft * 1.1, soft * 0.5, e2), smoothstep(-tc, tc, dE));
    }
    float bandW = uEdge.y;
    float bn = pvFbm(uvS / 2.5 + 31.0);
    float wBand = bandW > 0.01 ? (1.0 - smoothstep(bandW * (0.6 + uEdge2.x * bn), bandW * (1.4 + uEdge2.x * bn), -eEdge)) : 0.0;
    float gr = smoothstep(0.0, max(min(uEdge.z, shW), 0.5), -eEdge - bandW * 0.5);
    float wGrass = (1.0 - wPav) * smoothstep(0.35, 0.65, gr * 0.7 + pvFbm(uvS / 1.7 + 77.0) * 0.6 - 0.15);
    // a soft strip's border: the loose stuff and the grass mingle over the band, the coarse set among them
    if (!paved) { wBand *= 0.6; coarse = max(coarse, (1.0 - wPav) * wBand * 0.5); }
    wGrass = max(wGrass, grassStripe);
    if (sideFade) { wBand = 0.0; wGrass = 0.0; coarse = 0.0; }        // no band sets: the side is the surface fading out
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
    // ---- 10b THE RUNWAY LOOK (G1392): the surface's and the side's own colour multipliers (brightness x a tint whose
    // mean is 1; applyOne computes them per surface type), the side's where the surface has gone; the paint keeps its own
    col *= mix(mix(vec3(uEdge2.z, uEdge2.w, uSpec.w), uWet.yzw, wPav), vec3(1.0), paint);
    // ---- 11 the wet: a FILM, and nothing else. Grass does not shine; loose ground shines little
    float wetC = paved ? 1.0 : (grassy ? 0.12 : 0.25);
    float wet = uWet.x * mix(0.3, 1.0, wPav) * wetC;
    if (uLane.x > 0.5 && concrete && !road && wPav > 0.5) { float lvv2 = v + halfW + uLane.y * 0.5; float ln2 = floor(lvv2 / max(uLane.y, 0.5)); wet *= 0.55 + 0.9 * pvHash(vec2(ln2 * 2.0, seed + 11.0)) * smoothstep(0.3, 0.7, pvNoise(vec2(u / 60.0, ln2 + seed))); }
    float wetK = wet;
    col *= 1.0 - 0.38 * wetK; rough = mix(rough, 0.12, wet);
    if (!paved) rough = max(rough, uSoft2.w);                          // loose ground does not shine
    // ---- the normal into the world, the roughness, the alpha
    vec3 T = normalize(vPavT), Ng = normalize(vPavNg), Bv = normalize(cross(Ng, T));
    vec3 nTn = normalize(vec3(nT.xy * nrmK, max(nT.z, 0.2)));
    gPavN = normalize(T * nTn.x + Bv * nTn.y + Ng * nTn.z);
    gPavR = clamp(rough, 0.03, 1.0);
    // THE SPECULAR ANTI-ALIAS (G1047, the ground's: splat_ground uSFilt.y): the roughness floor grows with the
    // pixel's footprint (sqrt of metres a pixel), so a relief finer than the pixel cannot throw the sun's lobe about
    if (uSpec.z > 0.0) gPavR = max(gPavR, min(1.0, uSpec.z * sqrt(length(fw))));
    // THE FADE TO ALPHA (the user, three times): the mesh is the pavement and its band; past the band
    // it goes to nothing over fadeW metres - the ground under it is the world's, never this mesh's
    // grass - and the fade always fits inside the shoulder (a 3 m road shoulder fades over 2 m)
    float fade1 = shW, fade0 = clamp(min(bandW + 0.3, shW - max(uEdge.w, 0.6)), 0.0, shW - 0.3);
    gPavA = 1.0 - smoothstep(fade0, fade1, -dE);
    gPavA = mix(wPav, gPavA, clamp(vPavSh, 0.0, 1.0));
    if (sideFade) {
      // THE SIDE (G660): the surface's own colour going to alpha past the (chipped) edge; a soft edge is
      // already a torn fade and keeps it
      // G1392: every class's side starts at its surface type's alpha (the soft and grass default 0: the torn edge alone)
      float sideA = uSide.z * (1.0 - smoothstep(0.0, uSide.y, -eEdge));
      gPavA = max(wPav, sideA * clamp(vPavSh, 0.0, 1.0));
    }
    if (dE < 0.0 && uKeepN > 0) gPavA *= pvKeep(vPavW.xz);
    // THE JUNCTIONS (G981): a road or an apron over a strip hands over to it 0.8-2.5 m inside the strip's box (the
    // strip's chipped edge stays covered); a road END carried onto an apron fades over its last metres
    if (uSide.w > 0.5 && uKeepN > 0) gPavA *= 1.0 - smoothstep(0.8, 2.5, pvInside(vPavW.xz));
    if (road && !isPoly) {
      if (uRoadEnd.x > 0.0) gPavA *= smoothstep(0.0, uRoadEnd.x, u);
      if (uRoadEnd.y > 0.0) gPavA *= smoothstep(0.0, uRoadEnd.y, 2.0 * halfL - u);
    }
    // A GRASS ROAD IS THE WORLD'S GRASS WITH TRACKS IN IT: the mesh shows only where the wheels wore
    // it (the ruts, the compacted band, the tread). A grass STRIP is its own mown lawn over its whole declared width
    // (G1391: it kept 45 % of its lawn, over a ground of grass, so only the worn band a third of its width read - the
    // "very thin" grass runway); its colour against the island's grass is the runway look's (grBright / grTint)
    if (grassy && road) { float worn = clamp(rut * 1.3 + wheel + tread * 0.6, 0.0, 1.0); gPavA *= worn; }
    diffuseColor.rgb = col; diffuseColor.a = gPavA;
    gPavDbg = uPavDbg < 1.5 ? gPavN * 0.5 + 0.5 : uPavDbg < 2.5 ? vec3(gPavR) : uPavDbg < 3.5 ? vec3(wetK, 0.0, 0.0) : uPavDbg < 4.5 ? mk
      : uPavDbg < 5.5 ? vec3(wp, wb, wg) : uPavDbg < 6.5 ? vec3(clamp(dE / 10.0, 0.0, 1.0), clamp(-dE / shW, 0.0, 1.0), gPavA) : uPavDbg < 7.5 ? vec3(fract(laneTone * 4.0), joint, spall)
      : uPavDbg < 8.5 ? vec3(crack, dmg, pch) : uPavDbg < 9.5 ? vec3(rut, grassStripe, moss) : uPavDbg < 10.5 ? vec3(rubber, paint, damp) : uPavDbg < 11.5 ? vec3(wheel, tread, coarse + mixW * 0.5) : col;
  }`;
  GLSL.rough = `  float roughnessFactor = gPavR;`;
  GLSL.normal = `
  normal = normalize((viewMatrix * vec4(gPavN, 0.0)).xyz);`;
  GLSL.lights = `
  { float pvS = uSpec.x * smoothstep(0.85, 0.45, roughnessFactor); reflectedLight.directSpecular *= pvS; reflectedLight.indirectSpecular *= pvS; }`;
  GLSL.debug = `
  if (uPavDbg > 0.5) gl_FragColor = vec4(gPavDbg, 1.0);`;

  // ---- THE TABLE (AS4b M4, G925): ONE MATERIAL FOR EVERY PAVEMENT, EACH STRIP'S VALUES A ROW OF DATA -------------
  // Until G925 every strip, road and apron carried a material of its own: the same program, but ~30 vec4 uniforms, the
  // grade/tint rows and 112 vec4 of marks and keep boxes (uMarkR/uMarkK[40], uSeg/uSegK[8], uKeepA/uKeepB[4]) uploaded
  // at every one of its draws, and three cannot merge two meshes that wear different materials. Now the values a
  // material held are a ROW of one RGBA32F texture (uPavT, PV.W texels a row) and every pavement wears ONE material:
  //   texels 0..30  the recipe/class vec4s, in PV_VEC's order (what applyOne writes - the rows are packed from the very
  //                 uniform objects the old material held, so the numbers are the same float32 either way)
  //   PV.K          cls, seed, halfW, halfL - what the geometry's aPavK carried (now exact: a texel is not interpolated)
  //   PV.N          uMarkN, uSegN, uKeepN
  //   PV.G / PV.T   the 8 grade and 8 tint rows;  PV.KA / PV.KB the keep boxes;  PV.S / PV.SK the segments
  //   PV.MR / PV.MK the markings' rects and rules - THE MARKINGS ATLAS: a strip's paint is its row's last 80 texels
  // The row is picked by `aPavId`, a vertex attribute constant over a part, read through a FLAT varying (the provoking
  // vertex's value, never interpolated: G1046's lesson - a hash must never see an interpolated input) and rounded.
  // Because the material is one, the pavements MERGE (merge() below: whole parts, the overlapping ones together, grouped
  // within 1.5 km; the draw order kept inside each mesh).
  // The shader text is the shipped one: tableGLSL() derives it by anchored replacements (the uniform declarations
  // become globals, pvLoad() fills them from the row at the top of the chain, the array reads become texel reads), so
  // `?pave=old` draws exactly the pre-G925 program and the two cannot drift apart silently (GATE PAVEMENT 12).
  const PV_VEC = ['uLayer', 'uLayer2', 'uTile', 'uTile2', 'uHex', 'uMacro', 'uLane', 'uLane2', 'uCrack', 'uPatch', 'uMoss', 'uStain', 'uWet', 'uMark',
    'uPaint0', 'uPaint1', 'uRubber', 'uRubber2', 'uRut', 'uRut2', 'uRoad', 'uEdge', 'uEdge2', 'uDist', 'uSpec', 'uClass', 'uSoft', 'uSoft2', 'uMean', 'uSide', 'uRoadEnd'];
  const PV = { K: PV_VEC.length, N: PV_VEC.length + 1, G: PV_VEC.length + 2 };
  PV.T = PV.G + 8; PV.KA = PV.T + 8; PV.KB = PV.KA + NKEEP; PV.S = PV.KB + NKEEP; PV.SK = PV.S + NSEG; PV.MR = PV.SK + NSEG; PV.MK = PV.MR + NMARK; PV.W = PV.MK + NMARK;
  // ?pave=old: every pavement its own material and mesh, as shipped before G925 (the A/B); default: the table
  const MODE = { table: true, ab: false };
  try { const q = typeof location !== 'undefined' && /[?&]pave=([^&]*)/.exec(location.search); if (q) { MODE.ab = true; MODE.table = !/^old$/i.test(decodeURIComponent(q[1])); } } catch (e) {}
  let GLSLT = null;
  function tableGLSL() {
    if (GLSLT) return GLSLT;
    const T = {}, miss = [];
    const rep = (s, a, b) => { if (s.indexOf(a) < 0) { miss.push(a.slice(0, 80)); return s; } return s.split(a).join(b); };
    T.vertex = rep(rep(GLSL.vertex, 'attribute vec4 aPavK;', 'attribute float aPavId;'), 'varying vec4 vPavK;', 'flat varying float vPavId;');
    T.vertexBody = rep(GLSL.vertexBody, 'vPavK = aPavK;', 'vPavId = aPavId;');
    let c = GLSL.common;
    // THE ROW'S VALUES ARE READ WHERE THEY ARE USED: each former uniform vec4 is a macro for its texel (#define uLane
    // PVT(6)), the grade/tint rows are read inside pvFetch - nothing held in a register across the chain. (Loaded once
    // into globals at the top, ~30 vec4 stayed live through the whole shader: measured +0.3 ms of pavement GPU at the
    // stand, +0.5 ms once packed tighter - register pressure, not texel reads; tools/pave_ab.js, G928.) A texel read
    // twice in a block is one cached read; the uniforms' own cost was a constant buffer, this is the texture cache.
    c = rep(c, '\nuniform vec4 ' + PV_VEC.slice(0, 28).join(', ') + ';', '');
    c = rep(c, '\nuniform vec4 uGrade[8], uTint[8];', '');
    c = rep(c, '\nuniform vec4 uMean;', '');
    c = rep(c, '\nuniform int uMarkN, uSegN;', '\nint uMarkN, uSegN;');
    c = rep(c, `\nuniform vec4 uMarkR[${NMARK}], uMarkK[${NMARK}], uSeg[${NSEG}], uSegK[${NSEG}];`,
      '\nuniform highp sampler2D uPavT;\nint gPavRow; float gSegHW;\n#define PVT(i) texelFetch(uPavT, ivec2(i, gPavRow), 0)\n' + PV_VEC.map((n, i) => '#define ' + n + ' PVT(' + i + ')').join('\n'));
    c = rep(c, `\nuniform vec4 uSide, uRoadEnd; uniform int uKeepN; uniform vec4 uKeepA[${NKEEP}], uKeepB[${NKEEP}];`, '\nint uKeepN;');
    // the slot's grade and tint: read ONCE per set in pvSet (pvFetch is reached only through pvSet -> pvTile, 3-4 samples a set)
    c = rep(c, '\n#define PVT(i)', '\nvec4 gGr, gTn;\n#define PVT(i)');
    c = rep(c, '  vec4 g = uGrade[slot];', '  vec4 g = gGr;');
    c = rep(c, 'uTint[slot].rgb', 'gTn.rgb');
    c = rep(c, '  gRot = (slot == 0 || slot == 1 || slot == 5) ? uHex.w : (slot == 4 ? 0.0 : 1.5708);',
      `  gRot = (slot == 0 || slot == 1 || slot == 5) ? uHex.w : (slot == 4 ? 0.0 : 1.5708);\n  gGr = PVT(${PV.G} + slot); gTn = PVT(${PV.T} + slot);`);
    c = rep(c, 'varying vec4 vPav; varying vec4 vPavK;', 'varying vec4 vPav; flat varying float vPavId;');
    c = rep(c, 'vec4 A = uKeepA[i], B = uKeepB[i];', `vec4 A = PVT(${PV.KA} + i), B = PVT(${PV.KB} + i);`);
    // THE MARKS' EARLY OUT (the same coverage, bit for bit): a mark is bounded by its rect (a rule's too: [u0, uEnd] x
    // [v0, v1]) and pvBox is exactly 0 a footprint outside it, so a pixel outside skips the mark's second texel and its
    // box (the max() that gathers the marks does not care which are skipped); a segment is exactly 0 once its distance
    // passes the row's widest half-width (PV.N .w) plus the footprint. Without it the table's texel reads in the paint
    // loops cost the pavement +0.6 ms of GPU at the stand (tools/pave_ab.js, G928)
    c = rep(c, 'vec4 Rr = uMarkR[i]; vec4 K = uMarkK[i];', `vec4 Rr = PVT(${PV.MR} + i);\n    if (p.x < Rr.x - fw.x || p.x > Rr.y + fw.x || p.y < Rr.z - fw.y || p.y > Rr.w + fw.y) continue;\n    vec4 K = PVT(${PV.MK} + i);`);
    c = rep(c, 'vec4 S = uSeg[i]; vec4 K = uSegK[i];', `vec4 S = PVT(${PV.S} + i);`);
    c = rep(c, '    float d = distance(p, a + ab * t), hw = K.x * 0.5, f = max(fw.x, fw.y);',
      `    float d = distance(p, a + ab * t), f = max(fw.x, fw.y);\n    if (d >= gSegHW + f) continue;\n    vec4 K = PVT(${PV.SK} + i); float hw = K.x * 0.5;`);
    // the row picked, and its counts (the loops' bounds) read once, at the top of the chain
    c += '\nvoid pvLoad() {\n  gPavRow = int(vPavId + 0.5);' +
      `\n  vec4 pvN = PVT(${PV.N}); uMarkN = int(pvN.x + 0.5); uSegN = int(pvN.y + 0.5); uKeepN = int(pvN.z + 0.5); gSegHW = pvN.w;\n}`;
    T.common = c;
    T.map = rep(GLSL.map, 'float cls = floor(vPavK.x + 0.5), seed = floor(vPavK.y * 37.0 + 0.5) / 37.0, halfW = vPavK.z, halfL = vPavK.w;',
      `pvLoad(); vec4 pvK = PVT(${PV.K});   // G925: the row (the table), cls/seed/halfW/halfL exact per part\n    float cls = floor(pvK.x + 0.5), seed = floor(pvK.y * 37.0 + 0.5) / 37.0, halfW = pvK.z, halfL = pvK.w;`);
    for (const k of ['rough', 'normal', 'lights', 'debug']) T[k] = GLSL[k];
    T.miss = miss;
    if (miss.length) console.error('pavement: the table shader lost ' + miss.length + ' anchor(s) - ' + miss.join(' | '));
    return (GLSLT = T);
  }
  // the table's hook: the same order as `hook`, the table text
  const hookT = sh => {
    if (typeof ATMO !== 'undefined') ATMO.inject(sh);
    Object.assign(sh.uniforms, sh._pavU);
    const G = tableGLSL();
    sh.vertexShader = G.vertex + '\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>' + G.vertexBody);
    sh.fragmentShader = G.common + '\n' + sh.fragmentShader
      .replace('#include <map_fragment>', '#include <map_fragment>' + G.map)
      .replace('#include <roughnessmap_fragment>', G.rough)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>' + G.normal)
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>' + G.lights)
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>' + G.debug);
  };

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
    const c = gradedMean(row.shoulder, r, SHARED), lk = lookOf(cls, r);
    return [c[0] * lk.side[0], c[1] * lk.side[1], c[2] * lk.side[2]];   // G1392: the side's look
  }
  // ---- THE RUNWAY LOOK (G1392) -------------------------------------------------------------------------------
  // LIVE: the world look's overlay (look()), laid over every pavement's own recipe for the look's keys only
  let LIVE = null;
  // a hue (0..1) and how much of it -> an rgb multiplier whose mean is 1 (red at 0, green at 1/3, blue at 2/3)
  const tintRGB = (h, k) => [0, 1, 2].map(c => 1 + (k || 0) * Math.cos(2 * Math.PI * ((h || 0) - c / 3)));
  // lookOf(cls, r): the surface type's look in r (+ LIVE) - { g, surf: rgb, side: rgb, wear, sideW, sideA }
  function lookOf(cls, recipe) {
    const r = recipe || R, g = groupOf(cls), q = k => (LIVE && LIVE[g + k] !== undefined ? +LIVE[g + k] : (r[g + k] !== undefined ? +r[g + k] : RECIPE[g + k]));
    const mul = (b, h, k) => tintRGB(h, k).map(c => Math.max(0, c * b));
    const sw = q('SideW'), sa = q('SideA');
    return { g, surf: mul(q('Bright'), q('Hue'), q('Tint')), side: mul(q('SideBright'), q('SideHue'), q('SideTint')), wear: Math.max(0, q('Wear')),
      sideW: sw >= 0 ? sw : (g === 'pv' ? (r.sideW || 1.2) : (r.edgeSoft || 2.6)), sideA: sa >= 0 ? sa : (r.sideA === undefined ? 0.35 : r.sideA) };
  }
  const KNOB_MAX = {};
  for (const row of KNOBS) if (row.length > 1) KNOB_MAX[row[0]] = row[3];
  // the recipe a part is drawn with: its own (or the module's), its surface type's WEAR applied to the wear knobs
  function wornRecipe(r, lk) {
    if (Math.abs(lk.wear - 1) < 1e-9) return r;
    const o = Object.assign({}, r);
    for (const k of LOOK_WEAR[lk.g]) o[k] = Math.min(KNOB_MAX[k] !== undefined ? KNOB_MAX[k] : Infinity, (+r[k] || 0) * lk.wear);
    return o;
  }
  // look(THREE, o): the live overlay - an object of LOOK_KEYS (a key at undefined/null leaves it), null clears it;
  // returns the overlay. Every pavement in the page is re-applied (a row repack each: no rebuild)
  function look(THREE, o) {
    if (o === null) LIVE = null;
    else if (o && typeof o === 'object') {
      const n = Object.assign({}, LIVE);
      for (const k in o) if (LOOK_KEYS.indexOf(k) >= 0) { if (o[k] === undefined || o[k] === null || !Number.isFinite(+o[k])) delete n[k]; else n[k] = +o[k]; }
      LIVE = Object.keys(n).length ? n : null;
    } else return LIVE ? Object.assign({}, LIVE) : {};
    applyAll(THREE);
    return LIVE ? Object.assign({}, LIVE) : {};
  }
  // ---- THE ALPHA'S CPU TWIN (G1393): the shader's edge law, line for line, at a point of a strip or a road
  // (u along, v across, the noise ported from pvHash / pvNoise / pvFbm) - what tools/pavement_widths.js and GATE
  // PAVEMENT 16 measure the drawn width with. The ends and the keep boxes are left out (the census is across the middle).
  // Returns { a: the alpha, surf: the surface's own share (wPav) } - a grass ROAD's alpha is its tracks' (worn): `worn` true.
  const fr = x => x - Math.floor(x);
  const tHash = (x, y) => fr(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
  const tNoise = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = tHash(ix, iy), b = tHash(ix + 1, iy), c = tHash(ix, iy + 1), d = tHash(ix + 1, iy + 1); return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy; };
  const tFbm = (x, y) => tNoise(x, y) * 0.5 + tNoise(x * 2.03 + 17.1, y * 2.03 + 17.1) * 0.3 + tNoise(x * 4.11 + 41.7, y * 4.11 + 41.7) * 0.2;
  function alphaTwin(o) {
    const r = o.recipe || R, cls = o.cls, paved = cls === 'concrete' || cls === 'asphalt', lk = lookOf(cls, r), u = o.u, v = o.v, halfW = o.halfW;
    const seed = Math.round((o.seed || 0) * 37) / 37, us = u + seed * 37, vs = v + seed * 91, dE = halfW - Math.abs(v);
    const eEdge = dE + r.edgeChip * (tNoise(u / 1.5, seed + 9) - 0.5) * 2;
    let wPav;
    if (paved) wPav = ss01(-0.05, 0.05, eEdge);
    else {
      const tc = Math.max(r.edgeChip, 0.1), soft = Math.max(0.3, Math.min(6, Math.min(lk.sideW, halfW * 0.6)));
      const e2 = dE + soft * (0.9 * (tNoise(u / 15, seed + 19) - 0.5) * 2 + 0.7 * (tFbm(us / 4 + 23, vs / 4 + 23) - 0.5) * 2 + 0.35 * (tNoise(us, vs) - 0.5) * 2);
      wPav = Math.max(ss01(-soft * 1.1, soft * 0.5, e2), ss01(-tc, tc, dE));
    }
    let a;
    if (o.side && (r.sideFade === undefined ? 1 : r.sideFade) > 0.5) a = Math.max(wPav, lk.sideA * (1 - ss01(0, lk.sideW, -eEdge)));
    else {
      const shW = o.shW !== undefined ? o.shW : shoulderFor(o.band, r), bandW = o.band;
      const f1 = shW, f0 = Math.max(0, Math.min(Math.min(bandW + 0.3, shW - Math.max(r.fadeW, 0.6)), shW - 0.3));
      a = 1 - ss01(f0, f1, -dE);
    }
    return { a, surf: wPav, worn: cls === 'grass' && !!o.road };
  }
  function applyOne(THREE, m) {
    const U = m.uniforms, d = m.userData.pav, lib = m.userData.pavLib, cls = CLASS_DEF[d.cls];
    const lk = lookOf(d.cls, m.userData.pavRecipe || R), r = wornRecipe(m.userData.pavRecipe || R, lk);
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
    U.uWet.value.set(r.wet, lk.surf[0], lk.surf[1], lk.surf[2]);          // .yzw (the puddles' until 2026-09-23): the runway look's surface multiplier (G1392)
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
    U.uEdge2.value.set(r.bandNoise, r.jointAniso === undefined ? 1 : r.jointAniso, lk.side[0], lk.side[1]);   // .y: the joints' footprint per axis (G1047); .zw + uSpec.w: the side's multiplier (G1392)
    U.uDist.value.set(r.detailFrom, r.detailTo, r.normalFrom, r.normalTo);
    U.uSpec.value.set(r.specK, r.nrmK, r.specAA || 0, lk.side[2]);   // .z: the specular anti-alias (G1047)
    const sk = cls.soft || [1, 1, 1, 1];                                       // the class's own share of each soft layer
    U.uSoft.value.set(r.softMix * sk[0], r.coarseK * sk[1], r.wheelBand * sk[2], r.treadK * sk[3]);
    U.uSoft2.value.set(r.paintRelief, r.mow, r.edgeSoft, r.grassRough);
    U.uSide.value.set(d.side && (r.sideFade === undefined ? 1 : r.sideFade) > 0.5 ? 1 : 0, lk.sideW, lk.sideA, d.road ? 1 : 0);   // .w: the surface hands over inside a strip's box (roads, aprons); .yz the surface type's side (G1392)
    if (m.isPavPart) pack(m);
  }
  // setKeep(m, boxes): the pavements this one's side must not lie over (G664) - [{ cx, cz, hdg, halfL, halfW }],
  // the strip frame's own convention (T = [cos hdg, sin hdg]); at most NKEEP, the nearest first
  function setKeep(m, boxes) {
    const U = m.uniforms, B = (boxes || []).slice(0, NKEEP);
    B.forEach((b, i) => { U.uKeepA.value[i].set(b.cx, b.cz, Math.cos(b.hdg || 0), Math.sin(b.hdg || 0)); U.uKeepB.value[i].set(b.halfL, b.halfW, 0, 0); });
    U.uKeepN.value = B.length;
    if (m.isPavPart) pack(m);
  }
  // ---- the table's state: one RGBA32F texture, a row a part; the parts are PROXIES (isPavPart) holding the very
  // uniform objects an old material held, so applyOne / setKeep / the library's re-point write them unchanged and
  // pack() copies them into the row
  const TAB = { data: null, tex: null, cap: 0, used: 0, free: [], mat: null, parts: new Set(), uploads: 0 };
  function tabGrow(THREE, cap) {
    const data = new Float32Array(PV.W * cap * 4);
    if (TAB.data) data.set(TAB.data);
    const t = new THREE.DataTexture(data, PV.W, cap, THREE.RGBAFormat, THREE.FloatType);
    t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.flipY = false; t.name = 'pavement:rows'; t.needsUpdate = true;
    const old = TAB.tex;
    TAB.data = data; TAB.tex = t; TAB.cap = cap;
    if (TAB.mat) TAB.mat.uniforms.uPavT.value = t;
    if (old) old.dispose();
  }
  function rowAlloc(THREE) {
    if (TAB.free.length) return TAB.free.pop();
    if (TAB.used >= TAB.cap) tabGrow(THREE, Math.max(64, TAB.cap * 2));
    return TAB.used++;
  }
  function rowFree(P) {
    if (!P || P.row < 0) return;
    const i = MATS.indexOf(P); if (i >= 0) MATS.splice(i, 1);
    TAB.parts.delete(P);
    if (TAB.data) { TAB.data.fill(0, P.row * PV.W * 4, (P.row + 1) * PV.W * 4); TAB.tex.needsUpdate = true; }
    TAB.free.push(P.row); P.row = -1;
  }
  function pack(P) {
    if (!TAB.data || !(P.row >= 0)) return;
    const d = TAB.data, o = P.row * PV.W * 4, U = P.uniforms;
    const put = (i, v) => { const k = o + i * 4; d[k] = v.x; d[k + 1] = v.y; d[k + 2] = v.z; d[k + 3] = v.w; };
    for (let i = 0; i < PV_VEC.length; i++) put(i, U[PV_VEC[i]].value);
    d.set(P.pk, o + PV.K * 4);
    const n = o + PV.N * 4; d[n] = U.uMarkN.value; d[n + 1] = U.uSegN.value; d[n + 2] = U.uKeepN.value;
    { let hw = 0; for (let i = 0; i < U.uSegN.value; i++) hw = Math.max(hw, Math.fround(U.uSegK.value[i].x) * 0.5); d[n + 3] = hw; }   // the widest segment's half-width (the segments' early out)
    for (let i = 0; i < 8; i++) { put(PV.G + i, U.uGrade.value[i]); put(PV.T + i, U.uTint.value[i]); }
    for (let i = 0; i < NKEEP; i++) { put(PV.KA + i, U.uKeepA.value[i]); put(PV.KB + i, U.uKeepB.value[i]); }
    for (let i = 0; i < NSEG; i++) { put(PV.S + i, U.uSeg.value[i]); put(PV.SK + i, U.uSegK.value[i]); }
    for (let i = 0; i < NMARK; i++) { put(PV.MR + i, U.uMarkR.value[i]); put(PV.MK + i, U.uMarkK.value[i]); }
    TAB.tex.needsUpdate = true; TAB.uploads++;
  }
  // the pavement's material object, the one site that makes it (the old path's per-part ones and the table's one)
  const pavMat = THREE => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, transparent: true, depthWrite: false, side: THREE.FrontSide });
  // THE ONE MATERIAL: the shared library's arrays, the rows, the debug switch - nothing per strip
  function tableMat(THREE) {
    if (TAB.mat) return TAB.mat;
    const L = SHARED;
    const m = pavMat(THREE);
    m.name = 'pavement';
    m.uniforms = { uPavA: { value: L ? L.texA : null }, uPavN: { value: L ? L.texN : null }, uPavOn: { value: L && (L.ready || L.readyOld) ? 1 : 0 }, uPavDbg: DBG, uPavT: { value: TAB.tex } };
    m.userData.pavTable = true;
    m.onBeforeCompile = sh => { sh._pavU = m.uniforms; hookT(sh); if (PT.frag) sh.fragmentShader = PT.frag(sh.fragmentShader); };
    m.customProgramCacheKey = () => 'pavement:T' + hookT.toString().length + PT.key;
    if (PT.want && !PT.scene) m.onBeforeRender = PT.catch;
    return (TAB.mat = m);
  }
  const isTable = m => !!(m && m.userData && m.userData.pavTable);
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
  // ---- THE EYES TEST (B11-EYES, G1045): the user's four material swaps, one at a time, the user LOOKING ----------
  // ?pavetest=t1|t2|t2b|t3|t3u|t4 at load, or PAVTEST('t3') live (PAVTEST('t0') = as shipped). ONLY the material of
  // every pavement mesh changes (strips, taxiways, roads, aprons): geometry, position and renderOrder are untouched,
  // and a swapped-in material draws in the pavement's own pass and blend (transparent, no depth write).
  //   t1   the markings MECHANISM off: section 7 (the paint layer, pvMarks' rects/segs) cut out of the shader, the
  //        rect/seg counts zeroed
  //   t2   the side band's recipe on the interior: the pavement shader at the side's alpha (uSide.z, 0.35) all over,
  //        over the ground - what the calm band IS on a strip (sideFade: the same colour chain at <= 0.35)
  //   t2b  the island ground's own material on the pavement: the premises patch's (the band's ground), cloned
  //   t3   plain white MeshStandardMaterial, no maps;  t3u  plain white MeshBasicMaterial (unlit)
  //   t5   the per-pixel NORMAL off: the pavement shader as shipped, gPavN = the mesh's normal (the user's extra test)
  //   t6   TARMAC: the concrete pavements switched to the asphalt class (its sets, no slabs)
  //   t8   the band's PATH at full alpha: every pixel shaded as a band pixel 0.3 m outside the edge, opaque
  //   t4   the island's GRASS round the field: the patch material with the splat's terrain type forced to the most
  //        common open-ground code 40-120 m round the camera (PAVTEST('t4', code) to name one), no polygons over it
  // An on-screen box (top centre) names what is on. Default off: with no query and no call nothing here runs.
  const PT = { mode: 't0', key: '', frag: null, want: null, scene: null, camera: null, swapped: new Map(), timer: 0, code: -1, box: null };
  const PT_TEXT = {
    t0: 'TEST 0 - baseline: the pavement as shipped',
    t1: 'TEST 1 - markings MECHANISM off (paint layer + marks rects/segs + their shader code removed)',
    t2: 'TEST 2 - border recipe: the pavement shader drawn like the side band (alpha 0.35 over the island ground)',
    t2b: 'TEST 2b - border material: the island ground\'s own material (premises patch) on the pavement mesh',
    t3: 'TEST 3 - plain white MeshStandardMaterial, no maps',
    t3u: 'TEST 3u - plain white unlit (MeshBasicMaterial)',
    t4: 'TEST 4 - grass: the island ground\'s grass (splat type forced to the field\'s grass code) on the pavement mesh',
    t5: 'TEST 5 - NORMALS OFF: the pavement shader as shipped, its per-pixel normal replaced by the mesh\'s own normal',
    t6: 'TEST 6 - TARMAC: every concrete pavement switched to the asphalt class (its sets: worn asphalt + cracked asphalt)',
    t8: 'TEST 8 - THE BAND PATH at full alpha: every pixel shaded as a band pixel 0.3 m outside the edge, drawn opaque',
  };
  // t6: the concrete pavements re-pointed at the asphalt class, the shared library grown to hold its sets
  function ptSets(mode) {
    const T3 = (typeof THREE !== 'undefined' && THREE) || null;
    for (const m of MATS) if (m.userData.pavClsOrig) { m.userData.pav.cls = m.userData.pavClsOrig; delete m.userData.pavClsOrig; }
    if (mode === 't6') {
      for (const m of MATS) if (m.userData.pav.cls === 'concrete') { m.userData.pavClsOrig = 'concrete'; m.userData.pav.cls = 'asphalt'; }
      if (T3) sharedLib(T3, keysFor(['asphalt']));
    }
    for (const m of MATS) applyOne(T3, m);
  }
  PT.cut = src => {
    let s = src;
    if (PT.mode === 't1') {
      const a = s.indexOf('    // ---- 7 the markings'), b = s.indexOf('    // ---- 8 the rubber');
      if (a < 0 || b < a) { console.error('PAVTEST t1: the markings section was not found - NOT cut'); return src; }
      s = s.slice(0, a) + '    vec3 mk = vec3(0.0); float paint = 0.0;   // PAVTEST t1: the markings mechanism cut\n' + s.slice(b);
    }
    if (PT.mode === 't2') {
      const k = 'diffuseColor.rgb = col; diffuseColor.a = gPavA;';
      if (s.indexOf(k) < 0) { console.error('PAVTEST t2: the alpha line was not found - NOT applied'); return src; }
      s = s.replace(k, 'gPavA = min(gPavA, uSide.z);   // PAVTEST t2: the interior at the side band\'s alpha\n    ' + k);
    }
    if (PT.mode === 't8') {
      const a = '    float u = vPav.x, v = vPav.y, dE = vPav.z, shW = vPav.w;', k = 'diffuseColor.rgb = col; diffuseColor.a = gPavA;';
      if (s.indexOf(a) < 0 || s.indexOf(k) < 0) { console.error('PAVTEST t8: the dE / alpha lines were not found - NOT applied'); return src; }
      s = s.replace(a, '    float u = vPav.x, v = vPav.y, dE = min(vPav.z, -0.3), shW = vPav.w;   // PAVTEST t8: every pixel a band pixel')
           .replace(k, 'gPavA = 1.0;   // PAVTEST t8: full alpha\n    ' + k);
    }
    if (PT.mode === 't5') {
      const k = '    gPavN = normalize(T * nTn.x + Bv * nTn.y + Ng * nTn.z);';
      if (s.indexOf(k) < 0) { console.error('PAVTEST t5: the normal line was not found - NOT applied'); return src; }
      s = s.replace(k, '    gPavN = Ng;   // PAVTEST t5: the per-pixel normal off, the mesh normal');
    }
    return s;
  };
  PT.catch = function (renderer, scene, camera) { if (!PT.scene) { PT.scene = scene; PT.camera = camera; for (const m of MATS.concat(TAB.mat ? [TAB.mat] : [])) if (m.onBeforeRender === PT.catch) delete m.onBeforeRender; if (PT.want) { const w = PT.want; PT.want = null; pavtest(w[0], w[1]); } } };
  function ptBox() {
    if (typeof document === 'undefined') return;
    if (!PT.box) {
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;top:118px;left:50%;transform:translateX(-50%);z-index:99999;pointer-events:none;max-width:70vw;text-align:center;' +
        'background:rgba(0,0,0,0.78);color:#fff;font:600 15px/1.35 system-ui,sans-serif;padding:7px 14px;border-radius:6px;border:1px solid #ffd54a';
      document.body.appendChild(d); PT.box = d;
    }
    PT.box.textContent = (PT_TEXT[PT.mode] || PT.mode) + (PT.mode === 't4' && PT.code >= 0 ? ' [code ' + PT.code + ']' : '');
  }
  // the band's ground: a premises patch mesh on the INNER ring's material (the '-2' key is the far terrain's)
  function ptGround() {
    let best = null;
    PT.scene.traverse(o => { if (best || !o.isMesh || o.name !== 'premises:patch') return; const k = o.material.customProgramCacheKey ? o.material.customProgramCacheKey() : ''; if (k.indexOf('-2') < 0) best = o.material; });
    return best;
  }
  // the open ground's commonest terrain code 40-120 m round the camera (the codes the band stamp never copies skipped)
  function ptGrassCode() {
    const W = typeof window !== 'undefined' && window.WORLD, isl = W && W.island, g = isl && isl.grid, T = isl && isl.ttype, c = PT.camera;
    if (!g || !T || !c) return 15;
    const skip = [0, 1, 8, 10, 12, 13, 16], n = {};
    for (let r = 40; r <= 120; r += 10) for (let q = 0; q < 16; q++) {
      const x = c.position.x + Math.cos(q * Math.PI / 8) * r, z = c.position.z + Math.sin(q * Math.PI / 8) * r;
      const i = Math.floor((x - g.x0) / g.cell), j = Math.floor((z - g.z0) / g.cell); if (i < 0 || j < 0 || i >= g.w || j >= g.h) continue;
      const v = T[j * g.w + i]; if (skip.indexOf(v) < 0) n[v] = (n[v] || 0) + 1;
    }
    let best = 15, bn = 0; for (const k in n) if (n[k] > bn) { bn = n[k]; best = +k; }
    return best;
  }
  function ptMaterial(THREE) {
    const mode = PT.mode;
    if (mode === 't3') return new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, transparent: true, depthWrite: false });
    if (mode === 't3u') return new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false });
    const G = ptGround(); if (!G) return null;
    const M = G.clone(), inner = G.onBeforeCompile, key = G.customProgramCacheKey;
    M.transparent = true; M.depthWrite = false;
    if (mode === 't2b') { M.onBeforeCompile = inner; M.customProgramCacheKey = () => key.call(G) + '-pavtest'; }
    else {   // t4: the splat's type read pinned to one code, the material polygons' mix off
      const code = PT.code;
      M.onBeforeCompile = sh => {
        inner(sh);
        const a = sh.fragmentShader.indexOf('return min(int(texture2D(uGPackB');
        if (a < 0) console.error('PAVTEST t4: the splat type read was not found - NOT forced');
        else { const b = sh.fragmentShader.indexOf(';', a); sh.fragmentShader = sh.fragmentShader.slice(0, a) + 'return ' + code + ';   /* PAVTEST t4 */' + sh.fragmentShader.slice(b + 1); }
        sh.fragmentShader = sh.fragmentShader.replace('if (uMatOn > 0.5) {', 'if (false) {');
      };
      M.customProgramCacheKey = () => key.call(G) + '-pavtest-grass' + code;
    }
    return M;
  }
  function ptSwap() {
    if (!PT.scene) return;
    const T3 = (typeof THREE !== 'undefined' && THREE) || (typeof window !== 'undefined' && window.THREE) || null;
    const swapping = PT.mode === 't2b' || PT.mode === 't3' || PT.mode === 't3u' || PT.mode === 't4';
    if (!swapping) { for (const [o, m] of PT.swapped) { if (o.material !== m) { const t = o.material; o.material = m; t.dispose(); } } PT.swapped.clear(); return; }
    if (!T3) { console.error('PAVTEST: no THREE'); return; }
    let mat = null; const miss = [];
    PT.scene.traverse(o => { if (o.isMesh && (MATS.indexOf(o.material) >= 0 || isTable(o.material))) miss.push(o); });
    for (const o of miss) { if (!mat) mat = ptMaterial(T3); if (!mat) break; PT.swapped.set(o, o.material); o.material = mat; }
    return miss.length;
  }
  function pavtest(mode, code) {
    mode = String(mode || 't0').toLowerCase();
    if (!PT_TEXT[mode]) return 'modes: ' + Object.keys(PT_TEXT).join(' ');
    if (!PT.scene) { PT.want = [mode, code]; for (const m of MATS) m.onBeforeRender = PT.catch; if (TAB.mat) TAB.mat.onBeforeRender = PT.catch; return 'armed: ' + mode + ' (on the next pavement draw)'; }
    // back to the pavement's own materials first, then the new mode
    if (PT.swapped.size) { const was = PT.mode; PT.mode = 't0'; ptSwap(); PT.mode = was; }
    clearInterval(PT.timer); PT.timer = 0;
    PT.mode = mode;
    const shaderMode = mode === 't1' || mode === 't2' || mode === 't5' || mode === 't8';
    PT.key = shaderMode ? ':pavtest-' + mode : ''; PT.frag = shaderMode ? PT.cut : null;
    for (const m of MATS) {
      const U = m.uniforms, nm = m.userData.pavNM || (m.userData.pavNM = [U.uMarkN.value, U.uSegN.value]);
      U.uMarkN.value = mode === 't1' ? 0 : nm[0]; U.uSegN.value = mode === 't1' ? 0 : nm[1];
      if (m.isPavPart) pack(m); else m.needsUpdate = true;
    }
    if (TAB.mat) TAB.mat.needsUpdate = true;
    if (mode === 't4') PT.code = code !== undefined ? +code : ptGrassCode();
    ptSets(mode);
    let n = 0;
    if (!shaderMode && mode !== 't0') {
      n = ptSwap();
      // a mesh streamed in later (or a patch not built yet) is taken up on the next sweep
      PT.timer = setInterval(ptSwap, 1500);
    }
    ptBox();
    return PT_TEXT[mode] + (n ? ' (' + n + ' meshes)' : '');
  }
  try { const q = typeof location !== 'undefined' && /[?&]pavetest=([^&]*)/.exec(location.search); if (q) { PT.want = [decodeURIComponent(q[1])]; } } catch (e) {}
  if (typeof window !== 'undefined') window.PAVTEST = pavtest;
  // make(THREE, o): the material for one pavement. With `o.geo` (the part's geometry) and the page's shared library,
  // the TABLE (G925): the part becomes a row, its geometry is tagged with the row (aPavId; aPavK and the unused uv
  // dropped) and the ONE material is returned. Without either (the bench, a private library, ?pave=old) a material of
  // its own, as before.
  function make(THREE, o) {
    const lib = o.lib, cls = o.cls || 'concrete';
    const table = MODE.table && o.geo && lib && lib === SHARED && o.geo.attributes && o.geo.attributes.aPavK && THREE.DataTexture && THREE.FloatType !== undefined;
    const m = table ? { isPavPart: true, uniforms: null, userData: {}, row: -1, pk: null } : pavMat(THREE);
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
      uMarkR: { value: mR }, uMarkK: { value: mK }, uSeg: { value: sg }, uSegK: { value: sk },
      uSide: v4(), uRoadEnd: { value: new THREE.Vector4(+o.fadeA || 0, +o.fadeB || 0, 0, 0) }, uKeepN: { value: 0 }, uKeepA: { value: Array.from({ length: NKEEP }, () => new THREE.Vector4()) }, uKeepB: { value: Array.from({ length: NKEEP }, () => new THREE.Vector4()) } };
    // side: the band fades to the ground (G660) - a strip's and a paved polygon's by default, a road's only when the caller says (a taxiway, G980)
    m.userData.pav = { cls, road: !!o.road || !!o.poly, poly: !!o.poly, wid: (o.marks && o.marks.wid) || 0, side: o.side !== undefined ? !!o.side : !o.road }; m.userData.pavLib = lib; m.userData.pavRecipe = o.recipe || null;   // a resolved recipe of its own (the game), or the module's (the bench)
    if (o.band !== undefined && o.band !== null) m.userData.pavBand = +o.band;
    if (table) {
      // THE ROW: cls, seed, halfW, halfL off the geometry's aPavK (constant over a part), the row id on every vertex
      const g = o.geo, K = g.attributes.aPavK, n = g.attributes.position.count;
      m.pk = new Float32Array([K.getX(0), K.getY(0), K.getZ(0), K.getW(0)]);
      m.row = rowAlloc(THREE);
      g.setAttribute('aPavId', new THREE.BufferAttribute(new Float32Array(n).fill(m.row), 1));
      g.deleteAttribute('aPavK'); if (g.attributes.uv) g.deleteAttribute('uv');
      g.userData.pavRow = m;
      if (PT.mode === 't1') { m.userData.pavNM = [m.uniforms.uMarkN.value, m.uniforms.uSegN.value]; m.uniforms.uMarkN.value = 0; m.uniforms.uSegN.value = 0; }
      MATS.push(m); TAB.parts.add(m);
      applyOne(THREE, m);
      if (o.keep) setKeep(m, o.keep);
      return tableMat(THREE);
    }
    m.onBeforeCompile = sh => { sh._pavU = m.uniforms; hook(sh); if (PT.frag) sh.fragmentShader = PT.frag(sh.fragmentShader); };
    m.customProgramCacheKey = () => 'pavement:' + hook.toString().length + PT.key;
    if (PT.want && !PT.scene) m.onBeforeRender = PT.catch;
    if (PT.mode === 't1') { m.userData.pavNM = [m.uniforms.uMarkN.value, m.uniforms.uSegN.value]; m.uniforms.uMarkN.value = 0; m.uniforms.uSegN.value = 0; }
    MATS.push(m);
    applyOne(THREE, m);
    if (o.keep) setKeep(m, o.keep);
    return m;
  }
  // the mesh's shoulder for a band: the band, the fade past it, a metre of grass creep
  const shoulderFor = (band, recipe) => Math.max(1, band + (recipe || R).fadeW + 1);
  function set(THREE, o) { for (const k in o) { if (k === 'grade') Object.assign(R.grade, o.grade); else R[k] = o[k]; } applyAll(THREE); }
  function reset(THREE) { R = JSON.parse(JSON.stringify(RECIPE)); applyAll(THREE); }
  function debug(v) { DBG.value = v; }
  // ---- THE A/B (G928): `?pave=old` or `?pave=new` at load, PAVE_AB('old' | 'new') live, or a click on the box -----
  // The box (top centre, under PAVTEST's) names what is drawn. Live, each builder that registered a rebuild
  // (onRebuild: render_world's strips, render_premises' roads and aprons) stands every pavement again the other way -
  // the same builders, the same recipe, a second or so of main thread - so the two can be compared taxiing, by eye.
  const AB = { hooks: [], box: null, timer: 0 };
  function onRebuild(fn) { if (typeof fn === 'function') AB.hooks.push(fn); }
  const sceneOf = () => (typeof window !== 'undefined' && window.WORLD && window.WORLD.scene) || PT.scene || null;
  function census(scene) {
    const c = { mode: MODE.table ? 'new' : 'old', meshes: 0, visible: 0, merged: 0, materials: new Set(), verts: 0, rows: TAB.used - TAB.free.length, tableKB: TAB.data ? Math.round(TAB.data.byteLength / 1024) : 0 };
    if (scene) scene.traverse(o => { if (!o.isMesh || !(isTable(o.material) || MATS.indexOf(o.material) >= 0)) return;
      c.meshes++; if (o.visible) { c.visible++; c.verts += o.geometry.attributes.position.count; } if (o.geometry.userData.pavRows) c.merged++; c.materials.add(o.material.uuid); });
    c.materials = c.materials.size;
    return c;
  }
  function abBox() {
    if (typeof document === 'undefined' || !document.body) return false;
    if (!AB.box) {
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;top:160px;left:50%;transform:translateX(-50%);z-index:99999;cursor:pointer;user-select:none;max-width:70vw;text-align:center;' +
        'background:rgba(0,0,0,0.78);color:#fff;font:600 15px/1.35 system-ui,sans-serif;padding:7px 14px;border-radius:6px;border:1px solid #7fd4ff';
      d.title = 'click: switch the pavement between OLD and NEW';
      d.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); ab(MODE.table ? 'old' : 'new'); });
      d.addEventListener('pointerdown', e => e.stopPropagation());
      document.body.appendChild(d); AB.box = d;
    }
    const c = census(sceneOf());
    AB.box.textContent = 'PAVEMENT ' + (MODE.table ? 'NEW (G925: one material, a row each, merged)' : 'OLD (a material and a mesh per strip, as shipped)') +
      (c.meshes ? ' - ' + c.visible + ' meshes, ' + c.materials + ' material' + (c.materials === 1 ? '' : 's') : '') + '   [click to switch]';
    return true;
  }
  function ab(mode) {
    const want = String(mode || (MODE.table ? 'old' : 'new')).toLowerCase() !== 'old';
    MODE.ab = true;
    if (want !== MODE.table) { MODE.table = want; for (const f of AB.hooks) { try { f(); } catch (e) { console.error('pavement A/B rebuild', e); } } }
    abBox();
    if (typeof setTimeout === 'function') setTimeout(abBox, 1500);   // the counts once the rebuilt meshes stand
    return 'pavement: ' + (MODE.table ? 'new' : 'old');
  }
  if (typeof window !== 'undefined') {
    window.PAVE_AB = ab;
    // the box stays up while the page runs with ?pave= (refreshed every 5 s: the counts follow the stream)
    if (MODE.ab && typeof setInterval === 'function') AB.timer = setInterval(abBox, 5000);
  }
  function exportRecipe() { return JSON.parse(JSON.stringify(R)); }
  // dispose(material, geometry): an own material is freed; the ONE material never is - the geometry's row (a part) or
  // rows (a merged cell that owns them, merge()) are given back
  function dispose(m, geo) {
    if (isTable(m)) {
      const U = geo && geo.userData;
      if (U && U.pavRows) for (const P of U.pavRows) rowFree(P);
      if (U && U.pavRow) rowFree(U.pavRow);
      if (U) { delete U.pavRows; delete U.pavRow; }
      return;
    }
    const i = MATS.indexOf(m); if (i >= 0) MATS.splice(i, 1); m.dispose();
  }
  // ---- THE MERGE (G926): the table's parts as a few meshes -----------------------------------------------------
  // mergeSteps(THREE, parts, o, out) - parts [{ geo, order }] (world-space geometries tagged by make(), their draw
  // order = the renderOrder each would have had), a generator yielding after each merged mesh; `out` receives
  // [{ geo, order, parts }], the parts' triangles in DRAW ORDER inside each (order, then the order given): inside one
  // draw the GPU blends in primitive order, so the per-runway order of G664 (the longest strip last) holds exactly
  // where two strips cross. Across meshes three sorts by renderOrder (the mesh's lowest - the caller keeps a bucket
  // per order CLASS: strips, aprons, roads) and then by distance - so two triangles of different parts that overlap
  // must never end in two meshes. Two ways to cut:
  //   WHOLE PARTS (default): parts whose boxes meet are one component, and components are GROUPED while the group
  //     stays within BATCH.reach (below) - a part is never cut;
  //   o.split: per cell (o.cell) by triangle centroid, with CONTESTED ZONES - where two parts' boxes intersect, grown by
  //     the largest triangle's extent, every triangle whose centroid is inside goes to the zone's cell (zones that touch
  //     are one zone): two triangles that overlap both reach into that intersection, so both centroids lie in the zone.
  // Rows move to the merged geometries (each part's row owned by exactly one: dispose() frees it with that one); the
  // sources are the caller's to drop. A2-RUNWAYS' culling holds per merged mesh (each has its own sphere).
  const BATCH = { cell: 1024, zoneGrid: 64, split: false, reach: 1500 };
  function* mergeSteps(THREE, parts, o, out) {
    o = o || {};
    const C = o.cell || BATCH.cell, ZG = BATCH.zoneGrid;
    const list = parts.map((p, i) => ({ g: p.geo, order: +p.order || 0, i })).filter(p => p.g && p.g.index && p.g.attributes.position)
      .sort((a, b) => a.order - b.order || a.i - b.i);
    if (!list.length) return out;
    const names = Object.keys(list[0].g.attributes).sort(), sig = g => Object.keys(g.attributes).sort().map(k => k + g.attributes[k].itemSize).join();
    const sig0 = sig(list[0].g);
    for (const p of list) if (sig(p.g) !== sig0) throw new Error('pavement merge: parts with different attributes (' + sig(p.g) + ' vs ' + sig0 + ')');
    // the parts' boxes and the largest triangle
    let margin = 0;
    for (const p of list) {
      const P = p.g.attributes.position.array, I = p.g.index.array;
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
      for (let v = 0; v < P.length; v += 3) { const x = P[v], z = P[v + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
      for (let t = 0; t < I.length; t += 3) {
        const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
        const ex = Math.max(P[a], P[b], P[c]) - Math.min(P[a], P[b], P[c]), ez = Math.max(P[a + 2], P[b + 2], P[c + 2]) - Math.min(P[a + 2], P[b + 2], P[c + 2]);
        if (ex > margin) margin = ex; if (ez > margin) margin = ez;
      }
      p.box = [x0, z0, x1, z1];
    }
    margin += 0.5;
    const cellKey = (x, z) => (Math.floor(x / C) + 32768) * 65536 + (Math.floor(z / C) + 32768);
    const cells = new Map();
    if (!(o.split !== undefined ? o.split : BATCH.split)) {
      // WHOLE PARTS (the default, G926): a part is never cut. Parts whose boxes (grown by the largest triangle) meet are
      // one COMPONENT - the only parts that can overlap on screen - and a component goes whole to the cell of its box's
      // centre; the components of a cell share its mesh. (Cutting parts per cell made more meshes, not fewer: Jolene's
      // strips are 1.2-2.4 km long - 6 strips became 13 cell pieces at 1 km.)
      const par = list.map((_, i) => i), find = i => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; };
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const A = list[i].box, B = list[j].box;
        if (A[0] - margin <= B[2] && B[0] - margin <= A[2] && A[1] - margin <= B[3] && B[1] - margin <= A[3]) par[find(i)] = find(j);
      }
      const uni = (a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
      const rad = b => Math.hypot(b[2] - b[0], b[3] - b[1]) / 2;
      const comps = new Map();
      list.forEach((p, i) => { const r = find(i), c = comps.get(r); if (!c) comps.set(r, { box: p.box.slice(), idx: [i] }); else { c.box = uni(c.box, p.box); c.idx.push(i); } });
      // THE GROUPS: a component joins the group it grows least, while the group's box stays within `reach` of a sphere
      // (BATCH.reach, 1.5 km half-diagonal) or within 5 % of its own when it is already bigger (a turnaround at the end
      // of a 2.4 km runway joins the runway's group); what lies further off keeps a mesh of its own - A2-RUNWAYS'
      // culling, per group. (Grid cells did not do it: the airfield straddles the cell lines.)
      const groups = [], REACH = o.reach || BATCH.reach, gOf = new Int32Array(list.length);
      for (const c of Array.from(comps.values()).sort((a, b) => rad(b.box) - rad(a.box))) {
        let best = -1, br = Infinity;
        groups.forEach((g, gi) => { const r = rad(uni(g.box, c.box)); if (r <= Math.max(REACH, rad(g.box) * 1.05) && r < br) { best = gi; br = r; } });
        if (best < 0) { groups.push({ box: c.box.slice() }); best = groups.length - 1; } else groups[best].box = uni(groups[best].box, c.box);
        for (const i of c.idx) gOf[i] = best;
      }
      list.forEach((p, i) => { const k = gOf[i], tris = [];
        for (let t = 0; t < p.g.index.count; t += 3) tris.push(t);
        let cl = cells.get(k); if (!cl) cells.set(k, cl = []); cl.push({ p, tris }); });
    } else {
    // THE SPLIT (o.split): per cell by triangle; the contested zones, and the zones that touch joined
    const zones = [];
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const A = list[i].box, B = list[j].box, x0 = Math.max(A[0], B[0]), z0 = Math.max(A[1], B[1]), x1 = Math.min(A[2], B[2]), z1 = Math.min(A[3], B[3]);
      if (x0 <= x1 && z0 <= z1) zones.push([x0 - margin, z0 - margin, x1 + margin, z1 + margin]);
    }
    const par = zones.map((_, i) => i), find = i => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; };
    for (let i = 0; i < zones.length; i++) for (let j = i + 1; j < zones.length; j++) {
      const A = zones[i], B = zones[j];
      if (A[0] <= B[2] && B[0] <= A[2] && A[1] <= B[3] && B[1] <= A[3]) par[find(i)] = find(j);
    }
    const gbox = new Map();
    zones.forEach((z, i) => { const r = find(i), b = gbox.get(r); if (!b) gbox.set(r, z.slice()); else { b[0] = Math.min(b[0], z[0]); b[1] = Math.min(b[1], z[1]); b[2] = Math.max(b[2], z[2]); b[3] = Math.max(b[3], z[3]); } });
    const zoneCell = zones.map((z, i) => { const b = gbox.get(find(i)); return cellKey((b[0] + b[2]) / 2, (b[1] + b[3]) / 2); });
    const zgrid = new Map(), gk = (i, j) => (i + 32768) * 65536 + (j + 32768);
    zones.forEach((z, i) => { for (let a = Math.floor(z[0] / ZG); a <= Math.floor(z[2] / ZG); a++) for (let b = Math.floor(z[1] / ZG); b <= Math.floor(z[3] / ZG); b++) { const k = gk(a, b); let l = zgrid.get(k); if (!l) zgrid.set(k, l = []); l.push(i); } });
    const keyAt = (x, z) => {
      const l = zgrid.get(gk(Math.floor(x / ZG), Math.floor(z / ZG)));
      if (l) for (const i of l) { const q = zones[i]; if (x >= q[0] && x <= q[2] && z >= q[1] && z <= q[3]) return zoneCell[i]; }
      return cellKey(x, z);
    };
    // every triangle to its cell, per part (the part's triangles keep their own order)
    for (const p of list) {
      const P = p.g.attributes.position.array, I = p.g.index.array, by = new Map();
      for (let t = 0; t < I.length; t += 3) {
        const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
        const k = keyAt((P[a] + P[b] + P[c]) / 3, (P[a + 2] + P[b + 2] + P[c + 2]) / 3);
        let l = by.get(k); if (!l) by.set(k, l = []); l.push(t);
      }
      for (const [k, tris] of by) { let cl = cells.get(k); if (!cl) cells.set(k, cl = []); cl.push({ p, tris }); }
    }
    }
    yield 'pavement:cells';
    // each cell: the vertices its triangles use, compacted, part after part in draw order
    const owned = new Set();
    for (const [, cl] of cells) {
      let nV = 0, nI = 0;
      for (const e of cl) {
        const I = e.p.g.index.array, nv = e.p.g.attributes.position.count, map = new Int32Array(nv).fill(-1), verts = [], idx = new Uint32Array(e.tris.length * 3);
        let q = 0;
        for (const t of e.tris) for (let s = 0; s < 3; s++) { const v = I[t + s]; if (map[v] < 0) { map[v] = verts.length; verts.push(v); } idx[q++] = map[v]; }
        e.verts = verts; e.idx = idx; nV += verts.length; nI += idx.length;
      }
      const g = new THREE.BufferGeometry(), arrays = {};
      for (const k of names) { const A = list[0].g.attributes[k]; arrays[k] = new A.array.constructor(nV * A.itemSize); }
      const index = new (nV > 65535 ? Uint32Array : Uint16Array)(nI);
      let vo = 0, io = 0, order = Infinity;
      const rows = [];
      for (const e of cl) {
        const G = e.p.g;
        for (const k of names) { const A = G.attributes[k], s = A.itemSize, src = A.array, dst = arrays[k]; let w = vo * s;
          for (const v of e.verts) { const r = v * s; for (let c = 0; c < s; c++) dst[w++] = src[r + c]; } }
        for (let i = 0; i < e.idx.length; i++) index[io + i] = e.idx[i] + vo;
        vo += e.verts.length; io += e.idx.length;
        order = Math.min(order, e.p.order);
        const P = G.userData.pavRow; if (P && !owned.has(P)) { owned.add(P); rows.push(P); }
      }
      for (const k of names) { const A = list[0].g.attributes[k]; g.setAttribute(k, new THREE.BufferAttribute(arrays[k], A.itemSize, A.normalized)); }
      g.setIndex(new THREE.BufferAttribute(index, 1));
      g.computeBoundingSphere();
      g.userData.pavRows = rows;
      g.userData.pav = { kind: 'merged', parts: new Set(cl.map(e => e.p.i)).size, verts: nV, tris: nI / 3 };
      out.push({ geo: g, order, parts: g.userData.pav.parts });
      yield 'pavement:merge';
    }
    for (const p of list) delete p.g.userData.pavRow;   // the rows are the merged geometries' now
    return out;
  }
  function merge(THREE, parts, o) { const out = [], it = mergeSteps(THREE, parts, o, out); while (!it.next().done); return out; }
  const api = { CLASSES, CLASS_DEF, SLOTS, RECIPE, KNOBS, ENTRY_KNOBS, PRESETS, resolve, NMARK, NSEG, get recipe() { return R; },
    stripGeometry, roadGeometry, polyGeometry, field, opaqueDepth, sinkAt, liftK, SINK, setKeep, NKEEP, shoulderFor, sharedLib, groundColor, gradedMean, lanesOf, standMarks, marksOf, roadMarks, collapse, recorder, library, keysFor, make, set, reset, debug, pavtest, exportRecipe, dispose, GLSL, hook, mats: MATS,
    // G925-G928: the table, the one material, the merge, the A/B
    // G1390-G1393: the runway look (per surface type), its live overlay, the alpha's CPU twin
    LOOK_GROUPS, LOOK_KEYS, LOOK_WEAR, groupOf, lookOf, look, tintRGB, alphaTwin, twinNoise: { hash: tHash, noise: tNoise, fbm: tFbm },
    PV, PV_VEC, MODE, TAB, BATCH, tableGLSL, hookT, tableMat, isTable, pack, merge, mergeSteps, onRebuild, ab, census, get table() { return MODE.table; } };
  return api;
})();
if (typeof module !== 'undefined' && module.exports) module.exports = PAVEMENT;
if (typeof window !== 'undefined') window.PAVEMENT = PAVEMENT;   // (a top-level const is no window property: the rigs read it here)
