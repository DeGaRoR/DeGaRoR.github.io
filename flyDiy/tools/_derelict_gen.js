// THE DERELICT HANGAR (DERELICT-HANGAR, the user 9 Nov: "The large hangar, the one we have just placed ... in the story at
// some point you can buy that one, that allows you to construct bigger planes, and it's not just buying it, it's actually
// restoring it, from the state of the actual Metlakatla or Annette Island World War II hangar, which is currently
// derelict ... the new derelict hangar should fit the dimensions of the large one that we have, and look somehow a bit like
// the real one ... Professional level of modelling quality.") - the works hangar (tools/_hangar_gen.js 'works hangar':
// HW 20, HD 20, EAVE 9.5, the ridge EAVE + 2.6, the slab at floorY) as the derelict WWII steel hangar, and the stages the
// story walks it through back to today's works. Design note: futureDesigns/DERELICT-HANGAR-2026-11-09.md.
//
// THE FRAME IS THE HOUSE'S (the hangar generator's): the slab's centre at the origin, +z THE DOOR END, x across the width,
// z along the depth, the ridge along z; `P.ground(lx, lz)` when the world hands one in. The envelope is the works': the
// same outer walls, the eave and ridge lines, the door head (DOOR_H 6.4); `stage 3` IS HANGAR_GEN.build('works hangar').
//
// THE STRUCTURE (WWII steel hangar practice, in a 40 m square): nine frames at 5 m - a built-up I column on a concrete pier
// and a pitched PRATT truss (the top chord under the roof line, the bottom chord level 1 m under the eave: 0.75 m deep at
// the knee, 3.3 m at the ridge, span/12), 16 panels, double-angle chords with gussets at every panel point, knee braces;
// channel purlins at ~1.55 m cut per bay, sag rods, X-rod bracing in the end and middle bays, bottom-chord ties, girts.
// The real hangar's two-storey LEAN-TO GALLERIES are 5.5 m deep down both flanks, inside the envelope (the works' eave is at
// the outer wall): concrete floors at 4.0 and 8.0 m, steel-framed multi-pane window walls outside and toward the bay, the
// right-hand inner wall at ground level white-painted sheet with X-bracing. THE FRONT: a doorless 29 m span under a 2.1 m
// Pratt header girder clad in pale corrugated sheet to the roof line; the CORNER TOWERS (the galleries' front ends) in pale
// concrete, 0.3 m proud. THE BACK: a 16 m opening, wind posts and girts, the cladding mostly stripped.
//
// THE STAGES (P.stage; the story steps them): 0 derelict (the photos), 1 made safe (loose sheets down, rubble heaped,
// shards out, weeds cut inside, failed steel replaced in grey primer, a barrier line), 2 roofed (a new galvanised roof with
// roof lights and gutters; the walls still stripped, the ground-floor windows boarded; the slab dries), 3 restored (the
// works hangar itself). Every random choice is keyed to a PLACE (hash of the rounded position), never to a stream position,
// so a sheet that survives stage 1 is the same sheet that hung there in stage 0, and a dial elsewhere moves nothing here.
//
// THE COST: a bag per material (one draw each - steel, steelNew, sheetPale, sheetDark, sheetWhite, sheetNew, concFloor,
// concWall, glass, water, decal, stain, weed, plastic, ply, aoskirt; a stage uses 11-13), the interior truss built once and
// stamped onto every sound frame (Bag.append; the prototype and its frames published in stats.instances.truss for a GPU
// InstancedMesh), three lods that are constructions, not decimations (lod 1: flat sheets, single-box members, no gussets,
// rods, shards, weeds, stains; lod 2: the massing, the header band, the chords and the purlins).
//
// Materials are asked of MATLIB (GATE ASSETS AS4a: no material site here); headless (node, the gate) there are none and the
// build is the bags alone.
'use strict';
(() => {
const K = window.HOUSE_KIT;
const HG = window.HOUSE_GEN;
const { clamp, sub, add, mul, len, nrm, dot, crs, Bag, face, uvFrame, beam } = K;
const HN = () => window.HANGAR_GEN || null;

// ---- the dials ------------------------------------------------------------------------------------------------------------
const STAGES = ['derelict', 'made safe', 'roofed', 'restored'];
const DEF = {
  seed: 1942, stage: 0,
  // THE REAL PROPORTIONS (the user's measurements off the map, 9 Nov via A0: "about 60 m DEEP and 50 m WIDE overall ... the
  // side gallery takes about 5-10 m, so the hall is ~40-45 m wide ... the gallery has NO second floor ... the FRONT FACADE
  // stays whole at full height across the gallery too (a false front)"): HW / HD are the HALL's half-width and half-depth
  // (44 x 60 m), the office gallery a one-storey lean-to OUTSIDE the hall's right wall (`gallery` deep: 44 + 6 = 50 m)
  HW: 22, HD: 30, EAVE: 9.5, floorY: 0.25, slopeX: 0, slopeZ: 0,
  decay: 0.8,      // how far gone the derelict is: 0 a sound shell with its cladding, 1 a skeleton
  wet: 0.65,       // the slab after rain (stages 0-1; the roofed slab dries): 0 dry .. 1 a sheet of water
  gallery: 6, galleryL: 1.0, pierR: 1.0, bay: 6,   // gallery: the lean-to's depth outside the hall; galleryL / pierR: the door's
                                                    // concrete piers, left and right, inside the hall's width
  leaves: 10,      // the big door's leaves, half a side, each its own track: open they stack at the jambs, the CLEAR width
                   // what is left between the stacks (a DC-3: 28.96 m span, the fin 5.16 m tail-down)
  graffiti: 1, barriers: 1, weeds: 1, litter: 1, rubble: 1, lamps: 0,   // lamps: the made-safe line's warning lamps lit (the night's)
  apron: 0, apronL: 40, doorOpen: 0, backOpen: 0,   // the restored hangar's doors, 0 shut .. 1 open (telescoped to the jambs): the front's, the back's   // the build's own cracked apron (the premises' pavement draws it in game)
  ao: 0.8, aoRange: 0.9, aoGround: 1,
};
const ROWS = [
  ['the hangar', [
    ['stage', 'restoration stage', 0, 3, 1, STAGES],
    ['decay', 'how far gone', 0, 1, 0.05, null, P => (P.stage | 0) === 0],
    ['wet', 'after rain', 0, 1, 0.05, null, P => (P.stage | 0) < 2],
    ['seed', 'seed', 1, 9999, 1],
  ]],
  ['the shell', [
    ['HW', 'half width', 14, 24, 0.5], ['HD', 'half depth', 14, 24, 0.5], ['EAVE', 'eave', 8, 11, 0.1],
    ['gallery', 'gallery depth (right)', 3.5, 7, 0.25], ['galleryL', 'facade depth (left)', 0.6, 7, 0.25], ['bay', 'frame spacing', 4, 6.5, 0.25], ['floorY', 'slab above datum', 0, 1.2, 0.05],
  ]],
  ['the dressing', [
    ['graffiti', 'graffiti', 0, 1, 1], ['barriers', 'barriers', 0, 1, 1], ['weeds', 'weeds', 0, 1, 1],
    ['litter', 'litter', 0, 1, 1], ['rubble', 'rubble', 0, 1, 1], ['apron', 'its own apron', 0, 1, 1],
    ['ao', 'baked occlusion', 0, 1, 0.05],
  ]],
];
const PRESETS = {
  'derelict hangar':            { stage: 0 },
  'derelict hangar, made safe': { stage: 1 },
  'derelict hangar, roofed':    { stage: 2 },
  'derelict hangar, restored':  { stage: 3 },
};
const BAGS = ['steel', 'steelNew', 'sheetPale', 'sheetDark', 'sheetWhite', 'sheetNew', 'concFloor', 'concWall',
              'glass', 'water', 'decal', 'stain', 'weed', 'plastic', 'lamp', 'fit', 'ply'];
const EXTRA = ['aoskirt'];
const FOLD = [null,
  [['steelNew', 'steel'], ['decal', null], ['stain', null], ['plastic', null], ['lamp', null], ['weed', null]],
  [['steelNew', 'steel'], ['sheetWhite', 'sheetPale'], ['concFloor', 'concWall'], ['ply', 'sheetDark'], ['glass', null], ['water', null],
   ['decal', null], ['stain', null], ['plastic', null], ['lamp', null], ['weed', null], ['fit', null]]];
const NO_AO = { glass: 1, water: 1, decal: 1, stain: 1, weed: 1, lamp: 1 };   // flat or cut: no voxels of their own in the bake

// ---- the numbers ----------------------------------------------------------------------------------------------------------
function dimsOf(P) {
  const HW = P.HW, HD = P.HD, fy = P.floorY, EAVE = P.EAVE, RIDGE = EAVE + 2.6, tp = 2.6 / HW;
  const yR = x => fy + EAVE + (HW - Math.min(HW, Math.abs(x))) * tp;   // the roof's top (the sheet) over x
  const yTC = x => yR(x) - 0.32;                                        // the truss's top chord, under the purlins
  // THE GALLERIES ARE NOT A PAIR (the user 9 Nov: "narrow the one on the left, not the one on the right to get a few meters
  // clearance for the DC3. The real hangar has offices and workshops on the right, but the left is mostly a facade"):
  // seen from the apron the right (+x) keeps its two-storey gallery, the left (-x) is a 1 m facade - its window walls
  // and a narrow concrete tower front, nothing behind them but the hall. The door runs from the facade to the gallery:
  // 33.5 m, its centre 2.25 m left of the building's axis (doorX); a DC-3 (28.96 m) clears it by 2.27 m a side.
  // THE GALLERY IS A LEAN-TO (the user's measurements): one storey OUTSIDE the hall's right wall, x HW .. xO, under its own
  // flat roof at yGR; the front stays whole at full height across it (the false front: from the apron the building reads
  // whole, from the side and above it steps down). The door's jambs are the two concrete piers inside the hall's width.
  const GW = clamp(P.gallery === undefined ? 6 : P.gallery, 0, 12), GWL = clamp(P.galleryL === undefined ? 1.0 : P.galleryL, 0.6, HW * 0.2);
  const PR = clamp(P.pierR === undefined ? 1.0 : P.pierR, 0.6, HW * 0.2);
  const xGR = HW - PR, xGL = HW - GWL, xG = HW, xO = HW + GW;           // the jambs; the gallery's inner (the hall's wall) and outer lines
  const xGs = s => (s > 0 ? xGR : xGL), GWs = s => (s > 0 ? PR : GWL), gal = s => s > 0 && GW >= 2.5;
  const yL2 = fy + 4.0, yGR = fy + 4.4, yTW = fy + 8.0, yBC = fy + EAVE - 1.0;   // yGR: the gallery's roof; yTW: the towers' upper floor line
  const NB = Math.max(4, Math.round(2 * HD / P.bay)), BAY = 2 * HD / NB;
  const zF = k => -HD + k * BAY;
  const DH = Math.min(6.4, EAVE - 1.4);                                  // the door head (a DC-3's fin 5.16 m tail-down: 1.2 m under it)
  const BW = Math.min(16, 2 * Math.min(xGL, xGR) - 4), BH = Math.min(5.2, EAVE - 3);
  const xC = HW - 0.45;                                                  // the main columns' line, inboard of the stem wall
  const xe = xC - 0.19;                                                  // the truss's ends, at the columns' inner flange
  const slopeLen = Math.hypot(HW, 2.6);
  // the door: the opening between the piers, and its CLEAR width - the leaves stacked at the jambs, half a side
  const NL = Math.max(4, 2 * Math.round((P.leaves || 10) / 2)), LW = (xGL + xGR) / NL + 0.12;
  return { HW, HD, fy, EAVE, RIDGE, tp, yR, yTC, GW, GWL, PR, xG, xGR, xGL, xO, xGs, GWs, gal, yL2, yGR, yTW, yBC, NB, BAY, zF, DH, BW, BH, xC, xe, slopeLen,
           DOOR_W: xGL + xGR, doorX: (xGR - xGL) / 2, NL, LW, xDo0: xG + 0.45, xDo1: xG + 1.65, CLEAR: xGL + xGR - 2 * (LW + 0.05), NP: 16, NPU: Math.max(6, Math.round(slopeLen / 1.55) + 1) };
}

// ---- randomness keyed to places -------------------------------------------------------------------------------------------
function hashN(a, b, c, s) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2147483647) + Math.imul(s | 0, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; h = Math.imul(h, 2246822519); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
// a number in [0,1) for a place (metres, rounded to 5 cm) and a salt
const hp = (p, salt, seed) => hashN(Math.round(p[0] * 20), Math.round(p[1] * 20), Math.round(p[2] * 20), (seed | 0) * 131 + salt);
function vnoise(x, z, s) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hashN(i, j, 0, s), b = hashN(i + 1, j, 0, s), c = hashN(i, j + 1, 0, s), d = hashN(i + 1, j + 1, 0, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function rng(seed) { let st = ((seed | 0) * 2654435761 + 11) >>> 0; return () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// rotate p about the axis (unit) through `piv` by `ang` (Rodrigues)
function rot(p, piv, ax, ang) {
  const v = sub(p, piv), c = Math.cos(ang), s = Math.sin(ang);
  const r = add(add(mul(v, c), mul(crs(ax, v), s)), mul(ax, dot(ax, v) * (1 - c)));
  return add(piv, r);
}
// a plane frame: s along X, y along Y, d along N = X x Y (the outside)
function frame(O, X, Y) {
  const N = nrm(crs(X, Y));
  return { O, X, Y, N, P: (s, y, d) => add(add(add(O, mul(X, s)), mul(Y, y)), mul(N, d || 0)) };
}

// ---- THE ATLASES (one canvas each; the decal bag and the stain bag share the first, the weeds have the second) ------------
// decal atlas, 4 x 4 cells: 0-3 tags; 4-6 rust streaks, 7 a water streak; 8, 9 crack patches, 10 litter, 11 oil;
// 12 moss, 13 a soft dark blob (the wet margin, damp), 14 the DANGER board, 15 a soft line (cracks, joints)
const CELL = (c, u, v) => [((c % 4) + clamp(u, 0.004, 0.996)) / 4, 1 - (Math.floor(c / 4) + 1 - clamp(v, 0.004, 0.996)) / 4];
// weed atlas, 2 x 2: 0 grass, 1 fireweed, 2 alder, 3 dry grass
const WCELL = (c, u, v) => [((c % 2) + clamp(u, 0.004, 0.996)) / 2, 1 - (Math.floor(c / 2) + 1 - clamp(v, 0.004, 0.996)) / 2];
const ATLAS = { decal: null, weed: null, barrier: null, fit: null };
function decalCanvas() {
  if (typeof document === 'undefined') return null;
  const S = 256, c = document.createElement('canvas'); c.width = c.height = 4 * S;
  const g = c.getContext('2d'), r = rng(19420607);
  const at = cell => [(cell % 4) * S, Math.floor(cell / 4) * S];
  const rr = (a, b) => a + (b - a) * r();
  g.clearRect(0, 0, 4 * S, 4 * S);
  // THE TAGS: abstract piece-style forms - angular, letter-LIKE glyphs (no alphabet: nothing reads as a word or as
  // anybody's real tag), overlapping, a fill fading through two colours, a dark outline, a block shadow, white
  // highlights; a thin hand-tag scrawl across it and drips off the bottom
  const PAL = [['#c9cdd3', '#7d8794', '#111111'], ['#d23c3c', '#f08a2c', '#1b1b1b'], ['#2f6fd0', '#6fd0e8', '#101010'], ['#e45aa5', '#8e3fc2', '#151515'], ['#5fae4a', '#d8e05a', '#121212'], ['#f2f2ee', '#b8b8b2', '#202020']];
  for (let t = 0; t < 4; t++) {
    const [x0, y0] = at(t), [c0, c1, line] = PAL[(t * 2 + 1) % PAL.length];
    g.save(); g.translate(x0, y0); g.beginPath(); g.rect(0, 0, S, S); g.clip();
    const n = 3 + (t % 2), gw = (S - 36) / n, glyphs = [];
    for (let k = 0; k < n; k++) {
      const cx = 18 + gw * (k + 0.5) + rr(-6, 6), cy = S * 0.5 + rr(-10, 10), w = gw * rr(0.9, 1.25), h = rr(70, 110), sk = rr(-0.25, 0.1);
      // a glyph: a chunky box with a notch, a leg kicked out, a cut corner - a dozen points
      const P0 = [[-0.5, -0.5], [0.15, -0.5], [0.5, -0.2], [0.5, 0.05], [0.25, 0.12], [0.55, 0.5], [0.12, 0.5], [-0.05, 0.22], [-0.12, 0.5], [-0.5, 0.5], [-0.38, 0.05], [-0.58, -0.12]];
      const pts = P0.map(([px, py]) => [cx + (px + rr(-0.08, 0.08) + py * sk) * w, cy + (py + rr(-0.06, 0.06)) * h]);
      glyphs.push(pts);
    }
    const poly = (pts, dx, dy) => { g.beginPath(); g.moveTo(pts[0][0] + dx, pts[0][1] + dy); for (const p of pts.slice(1)) g.lineTo(p[0] + dx, p[1] + dy); g.closePath(); };
    g.lineJoin = 'round';
    g.fillStyle = line; for (const p of glyphs) for (let d = 1; d <= 9; d++) { poly(p, d, d); g.fill(); }          // the block shadow
    g.lineWidth = 9; g.strokeStyle = line; for (const p of glyphs) { poly(p, 0, 0); g.stroke(); }
    const gr = g.createLinearGradient(0, S * 0.3, 0, S * 0.75); gr.addColorStop(0, c0); gr.addColorStop(1, c1);
    g.fillStyle = gr; for (const p of glyphs) { poly(p, 0, 0); g.fill(); }
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 3;
    for (const p of glyphs) { g.beginPath(); g.moveTo(p[0][0] + 6, p[0][1] + 8); g.lineTo(p[1][0] - 4, p[1][1] + 8); g.stroke(); }
    g.strokeStyle = line; g.lineWidth = 3; g.beginPath();                        // the hand tag over it
    let sx = 22, sy = S * 0.3 + rr(-10, 10); g.moveTo(sx, sy);
    while (sx < S - 30) { sx += rr(12, 24); g.bezierCurveTo(sx - 14, sy - rr(10, 30), sx - 4, sy + rr(10, 30), sx, sy + rr(-5, 5)); }
    g.stroke();
    g.fillStyle = c1;                                                            // the drips
    for (let k = 0; k < 8; k++) { const dx = rr(30, S - 30), dy = S * 0.5 + rr(30, 50), dl = rr(10, 60); g.fillRect(dx, dy, 2.5, dl); g.beginPath(); g.arc(dx + 1.2, dy + dl, 2.4, 0, 7); g.fill(); }
    g.globalCompositeOperation = 'destination-out';                             // weathered: flecks of it gone
    for (let k = 0; k < 500; k++) { g.fillStyle = `rgba(0,0,0,${rr(0.2, 0.8)})`; g.fillRect(rr(0, S), rr(0, S), rr(1, 4), rr(1, 3)); }
    g.globalCompositeOperation = 'source-over';
    g.restore();
  }
  // THE STREAKS: rust off a fixing or a lap, darkest at the head, a few rivulets fading down
  for (let t = 4; t < 8; t++) {
    const [x0, y0] = at(t); g.save(); g.translate(x0, y0); g.beginPath(); g.rect(0, 0, S, S); g.clip();
    const col = t === 7 ? [38, 36, 32] : [[122, 58, 24], [140, 72, 30], [96, 46, 22]][t - 4];
    for (let k = 0; k < 9; k++) {
      const x = S * 0.5 + rr(-S * 0.3, S * 0.3), w = rr(5, 22), L = rr(S * 0.4, S * 0.98);
      const gr = g.createLinearGradient(0, 0, 0, L);
      gr.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${rr(0.55, 0.9)})`); gr.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
      g.fillStyle = gr; g.beginPath(); g.moveTo(x - w / 2, 0); g.lineTo(x + w / 2, 0); g.lineTo(x + w * 0.2 + rr(-6, 6), L); g.lineTo(x - w * 0.2 + rr(-6, 6), L); g.fill();
    }
    const hg = g.createRadialGradient(S / 2, 6, 2, S / 2, 6, S * 0.4);
    hg.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},0.7)`); hg.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
    g.fillStyle = hg; g.fillRect(0, 0, S, S * 0.4);
    g.restore();
  }
  // THE CRACKS: branching dark lines on transparent
  for (const t of [8, 9]) {
    const [x0, y0] = at(t); g.save(); g.translate(x0, y0); g.beginPath(); g.rect(0, 0, S, S); g.clip();
    g.strokeStyle = 'rgba(18,16,14,0.9)'; g.lineCap = 'round';
    const crack = (x, y, a, L, w) => {
      g.lineWidth = w; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < L; k++) { a += rr(-0.5, 0.5); x += Math.cos(a) * 9; y += Math.sin(a) * 9; g.lineTo(x, y); if (w > 1.2 && r() < 0.12) crack(x, y, a + rr(-1.2, 1.2), L * 0.4, w * 0.6); }
      g.stroke();
    };
    crack(10, S * rr(0.3, 0.7), rr(-0.3, 0.3), 30, t === 8 ? 3 : 2.2);
    g.restore();
  }
  { // LITTER: paper scraps, a flattened can, a bottle's glint
    const [x0, y0] = at(10); g.save(); g.translate(x0, y0);
    for (let k = 0; k < 9; k++) {
      g.save(); g.translate(rr(30, S - 30), rr(30, S - 30)); g.rotate(rr(0, 6.3));
      const kind = k % 3;
      if (kind === 0) { g.fillStyle = ['#e8e2d0', '#d0c8b0', '#f2efe6'][k % 3]; g.beginPath(); g.moveTo(-18, -12); g.lineTo(16, -14); g.lineTo(20, 10); g.lineTo(-14, 14); g.fill(); g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(-10, -4, 22, 2); }
      else if (kind === 1) { g.fillStyle = ['#b8262c', '#2a5fa0', '#c9c9c9'][k % 3]; g.fillRect(-12, -6, 24, 12); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(-12, -6, 24, 3); }
      else { g.fillStyle = 'rgba(60,110,60,0.85)'; g.fillRect(-16, -5, 26, 10); g.fillRect(10, -2.5, 9, 5); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(-12, -4, 16, 2); }
      g.restore();
    }
    g.restore();
  }
  { // OIL: a dark soft stain
    const [x0, y0] = at(11), gr = g.createRadialGradient(x0 + S / 2, y0 + S / 2, 4, x0 + S / 2, y0 + S / 2, S / 2);
    gr.addColorStop(0, 'rgba(20,18,15,0.42)'); gr.addColorStop(0.55, 'rgba(24,22,18,0.2)'); gr.addColorStop(1, 'rgba(24,22,18,0)');
    g.fillStyle = gr; g.fillRect(x0, y0, S, S);
  }
  { // MOSS: green-black speckle, soft edged
    const [x0, y0] = at(12);
    for (let k = 0; k < 900; k++) { const a = rr(0, 6.3), d = Math.sqrt(r()) * S * 0.48; g.fillStyle = `rgba(${40 + rr(0, 30) | 0},${60 + rr(0, 40) | 0},${24 + rr(0, 14) | 0},${rr(0.2, 0.6)})`; g.fillRect(x0 + S / 2 + Math.cos(a) * d, y0 + S / 2 + Math.sin(a) * d, rr(2, 6), rr(2, 6)); }
  }
  { // THE SOFT DARK BLOB (the wet margin round a puddle, damp patches)
    const [x0, y0] = at(13), gr = g.createRadialGradient(x0 + S / 2, y0 + S / 2, 2, x0 + S / 2, y0 + S / 2, S / 2);
    gr.addColorStop(0, 'rgba(14,13,12,0.34)'); gr.addColorStop(0.75, 'rgba(14,13,12,0.26)'); gr.addColorStop(1, 'rgba(14,13,12,0)');
    g.fillStyle = gr; g.fillRect(x0, y0, S, S);
  }
  { // THE DANGER BOARD (made safe): white board, red band, black stencil
    const [x0, y0] = at(14);
    g.fillStyle = '#f1efe8'; g.fillRect(x0 + 6, y0 + 50, S - 12, S - 100);
    g.fillStyle = '#c4161c'; g.fillRect(x0 + 6, y0 + 50, S - 12, 52);
    g.fillStyle = '#ffffff'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.fillText('DANGER', x0 + S / 2, y0 + 92);
    g.fillStyle = '#151515'; g.font = 'bold 26px sans-serif'; g.fillText('UNSAFE STRUCTURE', x0 + S / 2, y0 + 140); g.fillText('KEEP OUT', x0 + S / 2, y0 + 176);
  }
  { // THE SOFT LINE (a crack or a joint, stretched along its run)
    const [x0, y0] = at(15), gr = g.createLinearGradient(0, y0, 0, y0 + S);
    gr.addColorStop(0, 'rgba(10,9,8,0)'); gr.addColorStop(0.42, 'rgba(10,9,8,0.55)'); gr.addColorStop(0.5, 'rgba(6,5,4,0.95)'); gr.addColorStop(0.58, 'rgba(10,9,8,0.55)'); gr.addColorStop(1, 'rgba(10,9,8,0)');
    g.fillStyle = gr; g.fillRect(x0, y0, S, S);
  }
  return c;
}
function weedCanvas() {
  if (typeof document === 'undefined') return null;
  const S = 512, c = document.createElement('canvas'); c.width = c.height = 2 * S;
  const g = c.getContext('2d'), r = rng(19420608), rr = (a, b) => a + (b - a) * r();
  g.clearRect(0, 0, 2 * S, 2 * S);
  const blade = (x, base, h, w, lean, c0, c1) => {
    const gr = g.createLinearGradient(0, base, 0, base - h); gr.addColorStop(0, c0); gr.addColorStop(1, c1);
    g.fillStyle = gr; g.beginPath(); g.moveTo(x - w / 2, base);
    g.quadraticCurveTo(x - w / 4 + lean * 0.5, base - h * 0.55, x + lean, base - h);
    g.quadraticCurveTo(x + w / 4 + lean * 0.5, base - h * 0.55, x + w / 2, base); g.fill();
  };
  // 0 GRASS
  for (let i = 0; i < 70; i++) { const d = r() < 0.5; blade(rr(40, S - 40), S, rr(120, 420), rr(8, 18), rr(-60, 60), d ? '#34421d' : '#435427', d ? '#7d9448' : '#a3b462'); }
  // 1 FIREWEED (Chamaenerion: the first thing up through a broken slab in Alaska): stems, lance leaves, a magenta spike
  g.save(); g.translate(S, 0);
  for (let i = 0; i < 7; i++) {
    const x = rr(90, S - 90), h = rr(300, 480), lean = rr(-25, 25);
    g.strokeStyle = '#5a3a2c'; g.lineWidth = 5; g.beginPath(); g.moveTo(x, S); g.quadraticCurveTo(x + lean * 0.4, S - h * 0.5, x + lean, S - h); g.stroke();
    for (let k = 0; k < 14; k++) {
      const t = k / 14, lx = x + lean * t, ly = S - h * t * 0.78, side = k % 2 ? 1 : -1;
      g.fillStyle = k % 3 ? '#3f5a28' : '#4d6a30';
      g.beginPath(); g.ellipse(lx + side * 24, ly, 30 * (1 - t * 0.5), 6, side * 0.5, 0, 7); g.fill();
    }
    for (let k = 0; k < 26; k++) {
      const t = 0.72 + 0.28 * k / 26, fx = x + lean * t + rr(-12, 12) * (1 - (t - 0.72) * 2), fy = S - h * t;
      g.fillStyle = k > 20 ? '#a84a86' : (k % 2 ? '#d9479a' : '#c33b8a'); g.beginPath(); g.arc(fx, fy, rr(6, 10), 0, 7); g.fill();
    }
  }
  g.restore();
  // 2 ALDER (the scrub that takes the edges): a few stems fanning out, leaf sprays along each, an open ragged outline
  g.save(); g.translate(0, S);
  for (let i = 0; i < 9; i++) {
    const x0 = rr(190, 320), ang = rr(-1.0, 1.0) - Math.PI / 2, Ls = rr(240, 430);
    const x1 = x0 + Math.cos(ang) * Ls, y1 = S + Math.sin(ang) * Ls;
    g.strokeStyle = '#4b4238'; g.lineWidth = rr(3, 6); g.beginPath(); g.moveTo(x0, S); g.quadraticCurveTo((x0 + x1) / 2 + rr(-40, 40), (S + y1) / 2, x1, y1); g.stroke();
    for (let k = 0; k < 46; k++) {
      const t = 0.3 + 0.7 * r(), bx = x0 + (x1 - x0) * t + rr(-40, 40) * t, by = S + (y1 - S) * t + rr(-30, 30) * t, kk = rr(0.55, 1.15);
      g.fillStyle = r() < 0.2 ? `rgba(${150 * kk | 0},${178 * kk | 0},${92 * kk | 0},0.85)` : `rgb(${44 * kk | 0},${76 * kk | 0},${30 * kk | 0})`;
      g.beginPath(); g.ellipse(bx, by, rr(9, 17), rr(5, 9), rr(0, 3.1), 0, 7); g.fill();
    }
  }
  g.restore();
  // 3 DRY GRASS (last year's straw)
  g.save(); g.translate(S, S);
  for (let i = 0; i < 80; i++) blade(rr(40, S - 40), S, rr(90, 360), rr(5, 12), rr(-90, 90), '#6b5d3e', '#c8b582');
  g.restore();
  return c;
}

// ---- the sections ---------------------------------------------------------------------------------------------------------
// A MEMBER between two points. kinds: 'chord' (double angle back to back about a 12 mm gusset gap; one box at lod 1+),
// 'web' (two flat legs; one box), 'hchord' (the header girder's heavier chord), 'col' (a built-up I), 'chan' (a channel:
// purlin, girt, strut), 'rod' (a tension rod). `pn` is the frame's plane normal (trusses) or the member's "up".
const SEC = {
  chord:  { d: 0.075, w: 0.075, t: 0.009, g: 0.012 },
  hchord: { d: 0.11, w: 0.10, t: 0.012, g: 0.014 },
  web:    { d: 0.045, w: 0.04, t: 0.008, g: 0.012 },
};
function member(bag, a, b, kind, pn, lod, flange) {
  const X = nrm(sub(b, a));
  if (!isFinite(X[0])) return;
  let W = sub(pn, mul(X, dot(pn, X))); if (len(W) < 1e-6) W = sub([0, 0, 1], mul(X, X[2])); W = nrm(W);
  const U = crs(W, X);                                        // in the plane, square to the member
  if (kind === 'rod') { beam(bag, a, b, 0.011, 0.011, U, 0); return; }
  if (kind === 'chord' || kind === 'hchord' || kind === 'web') {
    const S = SEC[kind];
    if (lod > 0) { beam(bag, a, b, S.g / 2 + (kind === 'web' ? S.t : S.w), S.d, U, 0); return; }
    for (const sg of [-1, 1]) {
      const o1 = mul(W, sg * (S.g / 2 + S.t / 2));
      beam(bag, add(a, o1), add(b, o1), S.t / 2, S.d, U, 0);                          // the leg in the plane
      if (kind !== 'web') {
        const fs = flange || 1;
        const o2 = add(mul(U, fs * (S.d - S.t / 2)), mul(W, sg * (S.g / 2 + S.w / 2)));
        beam(bag, add(a, o2), add(b, o2), S.w / 2, S.t / 2, U, 0);                    // the outstanding leg
      }
    }
    return;
  }
  if (kind === 'col') {                                        // depth along U (the frame's plane), flanges along W
    const dd = 0.18, fw = 0.15, ft = 0.009;
    if (lod > 0) { beam(bag, a, b, fw, dd, U, 0); return; }
    for (const sg of [-1, 1]) { const o = mul(U, sg * (dd - ft)); beam(bag, add(a, o), add(b, o), fw, ft, U, 0); }
    beam(bag, a, b, 0.006, dd - 2 * ft, U, 0);
    return;
  }
  if (kind === 'chan' || kind === 'chanS') {                   // web along `pn`, flanges toward U
    const h = kind === 'chanS' ? 0.075 : 0.1, fw = 0.032, t = 0.004;
    let Up = sub(pn, mul(X, dot(pn, X))); Up = nrm(Up); const Wd = crs(X, Up);
    if (lod > 0) { beam(bag, a, b, fw, h, Up, 0); return; }
    beam(bag, a, b, t, h, Up, 0);
    for (const sg of [-1, 1]) { const o = add(mul(Up, sg * (h - t)), mul(Wd, fw)); beam(bag, add(a, o), add(b, o), fw, t, Up, 0); }
    return;
  }
  beam(bag, a, b, 0.05, 0.05, pn, 0);
}
// a member that may be bent (a bow `sag` metres off the line, in the plane, toward `dir`)
function memberBent(bag, a, b, kind, pn, lod, sag, dir) {
  if (!sag) return member(bag, a, b, kind, pn, lod);
  const m = add(mul(add(a, b), 0.5), mul(nrm(dir), sag));
  member(bag, a, m, kind, pn, lod); member(bag, m, b, kind, pn, lod);
}

// ---- the corrugated sheet ------------------------------------------------------------------------------------------------
// THE PROFILE IS THE TEXTURE'S (house_tex corrworn: 16 ribs to its 3.6 m tile = 0.225 m pitch, the crest at u = 0.037 m
// off its normal map, measured): u is metres along the frame's X, so the rib under a texel is the rib in the geometry.
const PITCH = 0.225, CREST = 0.0368, AMP = 0.017;
const SM = (a, b, x) => { const q = clamp((x - a) / (b - a), 0, 1); return q * q * (3 - 2 * q); };
const corr = u => AMP * Math.cos(2 * Math.PI * (u - CREST) / PITCH);
// a sheet on frame F over [u0, u0 + w] x [v0, v1] at depth d; `rots`: [{ piv, ax, ang, when(u, v) }] applied in order
// (a kink, a hang); `uvf` maps (u, v) to the bag's uv (default metres); `vk` extra rows (the kink lines)
function sheet(bag, F, u0, w, v0, v1, d, o) {
  const opt = o || {};
  const ns = opt.lod === 0 && !opt.flat ? Math.max(2, Math.ceil(w / PITCH * 4)) : 1;
  const vs = [v0].concat((opt.vk || []).filter(v => v > v0 + 1e-3 && v < v1 - 1e-3)).concat([v1]).sort((a, b) => a - b);
  const ids = [];
  for (let j = 0; j < vs.length; j++) for (let i = 0; i <= ns; i++) {
    const u = u0 + w * i / ns, v = vs[j];
    let p = F.P(u, v, d + (ns > 1 ? corr(u) : 0) + (opt.lift || 0));
    for (const R of (opt.rots || [])) if (!R.when || R.when(u, v)) p = rot(p, R.piv, R.ax, R.ang);
    ids.push(bag.v(p, opt.uvf ? opt.uvf(u, v) : [u, v]));
  }
  const n = ns + 1;
  for (let j = 0; j + 1 < vs.length; j++) for (let i = 0; i < ns; i++) {
    const a = ids[j * n + i], b = ids[j * n + i + 1], c = ids[(j + 1) * n + i + 1], e = ids[(j + 1) * n + i];
    bag.quad(a, b, c, e);
  }
}

// ---- THE BARRIER: a water-filled plastic jersey barrier --------------------------------------------------------------
// The common rotomoulded HDPE site barrier: 1.6 m long, 0.5 m across the foot, 0.92 m tall; a jersey profile (a foot with
// a rounded shoulder, a 60-degree slope, an upper wall leaning 3 degrees in) with two moulded grooves, the rotomould's
// parting line along its crown; two forklift tunnels through the foot; interlocking knuckles (two on one end, one on
// the other, so a line locks end to end); the filler cap on the crown, the drain plug low on an end. Rounded arrises are
// shaded smooth (per-vertex normals where the profile turns under 45 degrees), the grooves and the foot's edges stay hard.
// THE SHEET IS PAINTED, like the buoys' (BUOY-LOOK): one 1024 canvas, the side unrolled along the profile's own
// perimeter (so "up the barrier" is down the sheet and every weathering law is a law of height or of facing), the ends,
// the plain parts, the lamp's housing, for a red and a white unit. See barrierCanvas.
const BARRIER = { L: 1.6, PXM: 220 };
const BHALF = [[0.25, 0.0], [0.25, 0.105], [0.243, 0.126], [0.228, 0.141], [0.140, 0.300], [0.130, 0.322],
  [0.1236, 0.450], [0.1116, 0.456], [0.1116, 0.499], [0.1206, 0.505], [0.1150, 0.620], [0.1030, 0.626], [0.1030, 0.669], [0.1120, 0.675],
  [0.104, 0.840], [0.094, 0.875], [0.074, 0.898], [0.044, 0.912], [0.0, 0.917]];
const BPATH = (() => {                                     // bottom-left, up, over the crown, down to bottom-right
  const left = BHALF.map(([x, y]) => [-x, y]), right = BHALF.slice(0, -1).reverse().map(([x, y]) => [x, y]);
  const pts = left.concat(right), t = [0];
  for (let i = 1; i < pts.length; i++) t.push(t[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  // a vertex is smooth where the profile turns less than 45 degrees
  const segN = []; for (let i = 0; i + 1 < pts.length; i++) { const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], l = Math.hypot(dx, dy); segN.push([-dy / l, dx / l]); }
  const smooth = pts.map((_, i) => i > 0 && i < pts.length - 1 && (segN[i - 1][0] * segN[i][0] + segN[i - 1][1] * segN[i][1]) > 0.707);
  return { pts, t, P: t[t.length - 1], segN, smooth };
})();
// the sheet's regions (canvas px; the white unit's are 512 lower)
const BREG = { side: [0, 0, 768, 512], end: [768, 0, 256, 256], plain: [768, 256, 256, 96], yellow: [768, 352, 256, 80], black: [768, 432, 256, 80] };
const buv = (X, Y) => [X / 1024, 1 - Y / 1024];
function barrierMesh(bags, o) {
  const bag = bags.plastic, Lb = BARRIER.L, PX = BARRIER.PXM, Y0 = o.white ? 512 : 0, lod = o.lod | 0;
  const c = Math.cos(o.yaw), sn = Math.sin(o.yaw);
  // tipped onto its side (about its long axis), resting on its foot's edge and its crown
  const tip = o.tip ? 1.42 : 0, ct = Math.cos(tip), st2 = Math.sin(tip);
  let lift = 0;
  if (tip) { lift = 1e9; for (const [x, y] of BPATH.pts) lift = Math.min(lift, x * st2 + y * ct); lift = -lift; }
  const T = (x, y, z) => { const a = x * ct - y * st2, u = x * st2 + y * ct + lift; return [o.x + a * c + z * sn, o.y + u, o.z - a * sn + z * c]; };
  const TN = (nx, ny, nz) => { const a = nx * ct - ny * st2, u = nx * st2 + ny * ct; return [a * c + nz * sn, u, -a * sn + nz * c]; };
  const off = o.off || 0, sideU = z => (z + Lb / 2 + off) * PX;
  const V = (p, uv, n) => bag.v(p, uv, n);
  // ---- the sides: spans along the length, the tunnels' spans start their profile 0.10 m up
  const pk = lod === 0 ? [[-0.55, -0.25], [0.25, 0.55]] : [];
  const spans = []; { let z = -Lb / 2; for (const [a, b] of pk) { spans.push([z, a, 0]); spans.push([a, b, 1]); z = b; } spans.push([z, Lb / 2, 0]); }
  const { pts, t, segN, smooth } = BPATH, n = pts.length;
  for (const [za, zb, tun] of spans) {
    for (let i = 0; i + 1 < n; i++) {
      let p0 = pts[i], p1 = pts[i + 1], t0 = t[i], t1 = t[i + 1];
      if (tun && i === 0) { p0 = [p0[0], 0.10]; t0 = 0.10; }
      if (tun && i === n - 2) { p1 = [p1[0], 0.10]; t1 = BPATH.P - 0.10; }
      const nA = smooth[i] ? nrm2(segN[i - 1], segN[i]) : segN[i], nB = smooth[i + 1] ? nrm2(segN[i], segN[i + 1]) : segN[i];
      const a = V(T(p0[0], p0[1], za), buv(sideU(za), Y0 + t0 * PX), TN(nA[0], nA[1], 0)), b = V(T(p0[0], p0[1], zb), buv(sideU(zb), Y0 + t0 * PX), TN(nA[0], nA[1], 0));
      const e = V(T(p1[0], p1[1], zb), buv(sideU(zb), Y0 + t1 * PX), TN(nB[0], nB[1], 0)), d = V(T(p1[0], p1[1], za), buv(sideU(za), Y0 + t1 * PX), TN(nB[0], nB[1], 0));
      bag.quad(a, b, e, d);
    }
    if (tun) {                                             // the tunnel: its roof, and the two walls it is cut between
      const yt = 0.10, gr = (zz, xx) => buv(sideU(zz), Y0 + 2 + Math.abs(xx) * 8);
      const q = [T(-0.25, yt, za), T(0.25, yt, za), T(0.25, yt, zb), T(-0.25, yt, zb)], dn = TN(0, -1, 0);
      const ids = q.map((p, k) => V(p, gr(k < 2 ? za : zb, k === 0 || k === 3 ? -0.25 : 0.25), dn)); bag.quad(ids[0], ids[1], ids[2], ids[3]);
      for (const [zz, s2] of [[za, 1], [zb, -1]]) {
        const w = [T(-0.25, 0, zz), T(0.25, 0, zz), T(0.25, yt, zz), T(-0.25, yt, zz)], nn = TN(0, 0, s2);
        const iw = w.map((p, k) => V(p, gr(zz, k % 3 ? 0.25 : -0.25), nn)); if (s2 > 0) bag.quad(iw[0], iw[1], iw[2], iw[3]); else bag.quad(iw[0], iw[3], iw[2], iw[1]);
      }
    } else if (tip) {                                      // the underside, seen only when it lies on its side
      const q = [T(-0.25, 0, za), T(0.25, 0, za), T(0.25, 0, zb), T(-0.25, 0, zb)], dn = TN(0, -1, 0);
      const ids = q.map((p, k) => V(p, buv(sideU(k < 2 ? za : zb), Y0 + 3), dn)); bag.quad(ids[0], ids[1], ids[2], ids[3]);
    }
  }
  // ---- the ends: a fan from inside the profile, mapped flat onto the end region
  const [ex, ey] = BREG.end;
  for (const s2 of [-1, 1]) {
    const z = s2 * Lb / 2, nn = TN(0, 0, s2), cuv = (x, y) => buv(ex + 18 + (x + 0.25) * PX, Y0 + ey + 18 + (0.917 - y) * PX);
    const ctr = V(T(0, 0.42, z), cuv(0, 0.42), nn);
    const ring = pts.concat([[0.25, 0], [-0.25, 0]].slice(0, 1)).map(p => V(T(p[0], p[1], z), cuv(p[0], p[1]), nn));
    for (let i = 0; i + 1 < ring.length; i++) { if (s2 > 0) bag.tri(ctr, ring[i + 1], ring[i]); else bag.tri(ctr, ring[i], ring[i + 1]); }
    const b0 = V(T(-0.25, 0, z), cuv(-0.25, 0), nn), b1 = V(T(0.25, 0, z), cuv(0.25, 0), nn);
    if (s2 > 0) bag.tri(ctr, b0, b1); else bag.tri(ctr, b1, b0);
  }
  // ---- the knuckles (two on +z, one on -z), the filler cap, the drain plug: small cylinders on the plain region
  const [px0, py0] = BREG.plain;
  const cylB = (cx, cy, cz, ax, r, h, seg, reg) => {
    const [rx, ry, rw, rh] = reg || BREG.plain;
    const A = ax === 'y' ? [0, 0, 1] : [1, 0, 0], B = ax === 'y' ? [1, 0, 0] : [0, 1, 0], U = ax === 'y' ? [0, 1, 0] : [0, 0, 1];   // (A, B, U) right-handed: the rings wind outward
    const ring = (hh) => { const out = []; for (let k = 0; k <= seg; k++) { const a = k / seg * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      out.push({ p: [cx + (A[0] * ca + B[0] * sa) * r + U[0] * hh, cy + (A[1] * ca + B[1] * sa) * r + U[1] * hh, cz + (A[2] * ca + B[2] * sa) * r + U[2] * hh], n: [A[0] * ca + B[0] * sa, A[1] * ca + B[1] * sa, A[2] * ca + B[2] * sa], k }); } return out; };
    const r0 = ring(-h / 2), r1 = ring(h / 2), uvk = (k, top) => buv(rx + 8 + (rw - 16) * k / seg, Y0 + ry + (top ? 10 : rh - 10));
    for (let k = 0; k < seg; k++) {
      const a = V(T(...r0[k].p), uvk(k, 0), TN(...r0[k].n)), b = V(T(...r0[k + 1].p), uvk(k + 1, 0), TN(...r0[k + 1].n));
      const e = V(T(...r1[k + 1].p), uvk(k + 1, 1), TN(...r1[k + 1].n)), d = V(T(...r1[k].p), uvk(k, 1), TN(...r1[k].n));
      bag.quad(a, b, e, d);
    }
    for (const [rr, sgn] of [[r1, 1], [r0, -1]]) {
      const cc = V(T(cx + U[0] * sgn * h / 2, cy + U[1] * sgn * h / 2, cz + U[2] * sgn * h / 2), buv(rx + rw / 2, Y0 + ry + rh / 2), TN(U[0] * sgn, U[1] * sgn, U[2] * sgn));
      for (let k = 0; k < seg; k++) { const a = V(T(...rr[k].p), buv(rx + rw / 2 + 30 * Math.cos(k / seg * 6.28), Y0 + ry + rh / 2 + 30 * Math.sin(k / seg * 6.28)), TN(U[0] * sgn, U[1] * sgn, U[2] * sgn));
        const b = V(T(...rr[k + 1].p), buv(rx + rw / 2 + 30 * Math.cos((k + 1) / seg * 6.28), Y0 + ry + rh / 2 + 30 * Math.sin((k + 1) / seg * 6.28)), TN(U[0] * sgn, U[1] * sgn, U[2] * sgn));
        if (sgn > 0) bag.tri(cc, a, b); else bag.tri(cc, b, a); }
    }
  };
  void px0; void py0;
  const sg = lod === 0 ? 10 : 6;
  cylB(0, 0.24, Lb / 2 + 0.035, 'y', 0.048, 0.13, sg); cylB(0, 0.62, Lb / 2 + 0.035, 'y', 0.048, 0.13, sg);
  cylB(0, 0.43, -Lb / 2 - 0.035, 'y', 0.048, 0.13, sg);
  cylB(0, 0.917 + 0.004, -0.35, 'y', 0.07, 0.035, sg);                     // the filler cap
  if (lod === 0) cylB(0.13, 0.05, -Lb / 2 - 0.012, 'z', 0.028, 0.03, 8);    // the drain plug
  // ---- the warning lamp (made safe): a yellow housing clipped on the crown, an amber lens each side
  let lamp = null;
  if (o.lamp) {
    const hz = 0.25, yb = 0.917, yc = yb + 0.13;
    cylB(0, yb + 0.03, hz, 'y', 0.035, 0.06, 8, BREG.black);                  // the clip on the crown
    cylB(0, yc, hz, 'z', 0.085, 0.07, 14, BREG.yellow);                      // the housing
    const lb = bags.lamp;
    for (const s2 of [-1, 1]) {                                               // the lens: a shallow dome each face
      const zc = hz + s2 * 0.035, seg = 14, ring = 4, R = 0.072, dep = 0.03;
      const pt = (a, k) => { const rr = R * Math.sin(k / ring * Math.PI / 2), d = dep * Math.cos(k / ring * Math.PI / 2); return [Math.cos(a) * rr, yc + Math.sin(a) * rr, zc + s2 * d]; };
      const nrmL = (a, k) => { const th = k / ring * Math.PI / 2; return [Math.cos(a) * Math.sin(th), Math.sin(a) * Math.sin(th), s2 * Math.cos(th)]; };
      const top = lb.v(T(0, yc, zc + s2 * dep), [0.5, 0.5], TN(0, 0, s2));
      let prev = null;
      for (let k = 1; k <= ring; k++) {
        const cur = []; for (let q = 0; q <= seg; q++) { const a = q / seg * Math.PI * 2, p = pt(a, k); cur.push(lb.v(T(p[0], p[1], p[2]), [0.5 + 0.5 * Math.cos(a) * k / ring, 0.5 + 0.5 * Math.sin(a) * k / ring], TN(...nrmL(a, k)))); }
        for (let q = 0; q < seg; q++) { if (!prev) { if (s2 > 0) lb.tri(top, cur[q], cur[q + 1]); else lb.tri(top, cur[q + 1], cur[q]); }
          else { if (s2 > 0) lb.quad(prev[q], cur[q], cur[q + 1], prev[q + 1]); else lb.quad(prev[q], prev[q + 1], cur[q + 1], cur[q]); } }
        prev = cur;
      }
    }
    const lp = T(0, yc, hz);
    lamp = { x: lp[0], y: lp[1], z: lp[2], nx: sn, nz: c, col: [1.0, 0.56, 0.12], k: 0.35, range: 7, kind: 'barrier' };
  }
  return { lamp };
}
const nrm2 = (a, b) => { const x = a[0] + b[0], y = a[1] + b[1], l = Math.hypot(x, y) || 1; return [x / l, y / l]; };

// THE BARRIER'S SHEET: three canvases off one plan - the albedo, the roughness, the height (made a normal map by a Sobel
// pass). Red and white units: the red halfway to its own grey (BUOY-DESAT: the full traffic red is a toy in this
// light), the white an old HDPE white gone grey-cream. The laws, each a function of the profile's height or facing:
// UV CHALKING on what faces the sky (the crown and the slope pale and dull, the walls a little); GRIME rising from the
// ground (the foot dark, splash speckle to 40 cm); RUNS down the walls from the crown and the cap; SCUFFS and black
// TYRE MARKS low on the ends and the foot; ALGAE green-black in the foot's shadow and the grooves on one face; the
// moulded legend and the fill line embossed; the parting line along the crown; a stencilled unit number, worn.
function barrierCanvas() {
  if (typeof document === 'undefined') return null;
  const W = 1024, mk = () => { const c = document.createElement('canvas'); c.width = c.height = W; return c; };
  const cD = mk(), cR = mk(), cH = mk(), gD = cD.getContext('2d'), gR = cR.getContext('2d'), gH = cH.getContext('2d');
  const r = rng(19420916), rr = (a, b) => a + (b - a) * r();
  const PX = BARRIER.PXM, { pts, t, segN, P } = BPATH;
  gR.fillStyle = 'rgb(105,105,105)'; gR.fillRect(0, 0, W, W);             // moulded HDPE: a satin 0.41
  gH.fillStyle = 'rgb(128,128,128)'; gH.fillRect(0, 0, W, W);
  // per perimeter metre: the height above the ground and how much the face looks at the sky
  const at = tt => { let i = 0; while (i < t.length - 2 && t[i + 1] < tt) i++; const f = (tt - t[i]) / Math.max(1e-6, t[i + 1] - t[i]); return { y: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f, ny: segN[i][1], side: tt < P / 2 ? -1 : 1 }; };
  const sm = (a, b, x) => { const q = Math.max(0, Math.min(1, (x - a) / (b - a))); return q * q * (3 - 2 * q); };
  for (const white of [0, 1]) {
    const Y0 = white ? 512 : 0;
    const base = white ? [206, 202, 191] : [163, 58, 46], chalk = white ? [222, 218, 206] : [196, 132, 118];
    const [sx, sy, sw, sh] = BREG.side;
    // the body, row by row (a row is a height on the profile)
    for (let yy = 0; yy < sh; yy++) {
      const q = at(yy / PX); if (yy / PX > P) break;
      const up = sm(0.15, 0.95, q.ny) * 0.85 + 0.12, grime = 1 - sm(0.0, 0.32, q.y);
      const cc = base.map((v, k) => v + (chalk[k] - v) * up * (white ? 0.5 : 0.75));
      const gk = grime * 0.55;
      gD.fillStyle = `rgb(${cc[0] * (1 - gk) + 62 * gk | 0},${cc[1] * (1 - gk) + 54 * gk | 0},${cc[2] * (1 - gk) + 44 * gk | 0})`;
      gD.fillRect(sx, Y0 + sy + yy, sw, 1);
      const ro = 105 + up * 85 + grime * 110; gR.fillStyle = `rgb(${ro | 0},${ro | 0},${ro | 0})`; gR.fillRect(sx, Y0 + sy + yy, sw, 1);
    }
    const Yt = tt => Y0 + sy + tt * PX;                                    // the row of a perimeter position
    const tOfY = (y, side) => { for (let k = 0; k <= 400; k++) { const tt = side < 0 ? k / 400 * P / 2 : P - k / 400 * P / 2; if (at(tt).y >= y) return tt; } return P / 2; };
    // chalk mottling where the sun has been at it
    for (let k = 0; k < 1800; k++) { const tt = rr(0, P), q = at(tt), up = sm(0.15, 0.95, q.ny); if (r() > up + 0.15) continue;
      gD.fillStyle = `rgba(${chalk[0] + 20},${chalk[1] + 20},${chalk[2] + 20},${rr(0.04, 0.16)})`; gD.beginPath(); gD.ellipse(rr(sx, sx + sw), Yt(tt), rr(4, 22), rr(2, 8), 0, 0, 7); gD.fill(); }
    // the splash speckle up the foot, both faces
    for (let k = 0; k < 2600; k++) { const side = r() < 0.5 ? -1 : 1, y = Math.pow(r(), 2.2) * 0.42, tt = tOfY(y, side);
      gD.fillStyle = `rgba(${52 + rr(0, 30) | 0},${46 + rr(0, 24) | 0},${36 + rr(0, 16) | 0},${rr(0.15, 0.55)})`; gD.fillRect(rr(sx, sx + sw), Yt(tt) + rr(-2, 2), rr(1, 3.5), rr(1, 3)); }
    // the runs: from the crown and the cap down both walls, grey-brown, thin, fading
    for (let k = 0; k < 120; k++) {
      const side = r() < 0.5 ? -1 : 1, x = rr(sx, sx + sw), t0 = P / 2 + side * rr(0.02, 0.2), t1 = side < 0 ? rr(0.15, t0 - 0.1) : rr(t0 + 0.1, P - 0.15);
      const g = gD.createLinearGradient(0, Yt(t0), 0, Yt(t1)), a = rr(0.08, 0.3);
      g.addColorStop(0, `rgba(58,52,44,${a})`); g.addColorStop(1, 'rgba(58,52,44,0)');
      gD.strokeStyle = g; gD.lineWidth = rr(0.8, 3.2); gD.beginPath(); gD.moveTo(x, Yt(t0)); gD.lineTo(x + rr(-3, 3), Yt(t1)); gD.stroke();
      gR.strokeStyle = 'rgba(210,210,210,0.25)'; gR.lineWidth = 2; gR.beginPath(); gR.moveTo(x, Yt(t0)); gR.lineTo(x, Yt(t1)); gR.stroke();
    }
    // algae: green-black in the foot's shade and the grooves, one face (the north one) more
    for (let k = 0; k < 900; k++) { const side = r() < 0.75 ? -1 : 1, y = r() < 0.93 ? Math.pow(r(), 1.8) * 0.13 : (r() < 0.5 ? rr(0.452, 0.462) : rr(0.622, 0.632)), tt = tOfY(y, side);
      gD.fillStyle = `rgba(${34 + rr(0, 20) | 0},${52 + rr(0, 26) | 0},${30 + rr(0, 10) | 0},${rr(0.12, 0.45)})`; gD.beginPath(); gD.arc(rr(sx, sx + sw), Yt(tt) + rr(-3, 3), rr(1.5, 6), 0, 7); gD.fill();
      gR.fillStyle = 'rgba(235,235,235,0.3)'; gR.fillRect(rr(sx, sx + sw), Yt(tt), 4, 3); }
    // scuffs: pale gouges and dark tyre marks, low; scratches anywhere
    for (let k = 0; k < 70; k++) { const side = r() < 0.5 ? -1 : 1, low = r() < 0.85, y = low ? rr(0.02, 0.3) : rr(0.3, 0.8), tt = tOfY(y, side), x = rr(sx, sx + sw), l = rr(6, 40), a = rr(-0.5, 0.5);
      const pale = r() < 0.55;
      gD.strokeStyle = pale ? `rgba(${chalk[0] + 30},${chalk[1] + 30},${chalk[2] + 30},${rr(0.25, 0.6)})` : `rgba(18,16,14,${rr(0.2, 0.55)})`; gD.lineWidth = pale ? rr(0.6, 1.8) : rr(2, 7);
      gD.beginPath(); gD.moveTo(x, Yt(tt)); gD.lineTo(x + Math.cos(a) * l, Yt(tt) + Math.sin(a) * l * 0.4); gD.stroke();
      if (pale) { gH.strokeStyle = 'rgba(60,60,60,0.7)'; gH.lineWidth = 1.2; gH.beginPath(); gH.moveTo(x, Yt(tt)); gH.lineTo(x + Math.cos(a) * l, Yt(tt) + Math.sin(a) * l * 0.4); gH.stroke(); } }
    // the moulding: the legend and the fill line, embossed (height up, the albedo a touch paler, glossier), both faces
    for (const side of [-1, 1]) {
      const tt = tOfY(0.56, side), ty = tOfY(0.76, side);
      for (const cx of [sx + 150, sx + 520]) {
        gH.fillStyle = 'rgb(176,176,176)'; gH.font = 'bold 22px sans-serif'; gH.textAlign = 'center';
        gD.fillStyle = `rgba(${chalk[0]},${chalk[1]},${chalk[2]},0.35)`; gD.font = 'bold 22px sans-serif'; gD.textAlign = 'center';
        for (const [g, txt, yy] of [[gH, 'WATER FILL', tt], [gD, 'WATER FILL', tt]]) { g.save(); g.translate(cx, Yt(yy)); if (side > 0) g.scale(-1, 1); else g.scale(1, -1); g.fillText(txt, 0, 8); g.restore(); }   // (the unroll runs up the left face and down the right: each face's text drawn so it reads on the barrier - measured on the stills)
        gH.fillRect(cx - 70, Yt(ty) - 1.5, 140, 3); gH.fillStyle = 'rgb(176,176,176)';
        gH.beginPath(); gH.moveTo(cx + 80, Yt(ty) - 9 * side); gH.lineTo(cx + 92, Yt(ty) + 4 * side); gH.lineTo(cx + 68, Yt(ty) + 4 * side); gH.fill();   // the arrow at MAX
        gR.fillStyle = 'rgb(80,80,80)'; gR.fillRect(cx - 70, Yt(ty) - 2, 140, 4);
      }
    }
    // the parting line along the crown (a raised seam), a hairline darker
    gH.fillStyle = 'rgb(160,160,160)'; gH.fillRect(sx, Yt(P / 2) - 1.5, sw, 3);
    gD.fillStyle = 'rgba(40,30,25,0.18)'; gD.fillRect(sx, Yt(P / 2) - 1, sw, 2);
    // the stencilled unit number on one face, worn, in white (red unit) or black (white unit)
    gD.save(); gD.font = 'bold 54px sans-serif'; gD.textAlign = 'center';
    for (const cx of [sx + 330, sx + 700]) {
      const num = String(10 + Math.floor(r() * 80)), tt = tOfY(0.66, -1);
      gD.fillStyle = white ? 'rgba(30,28,26,0.75)' : 'rgba(236,232,224,0.8)'; gD.save(); gD.translate(cx, Yt(tt)); gD.scale(1, -1); gD.fillText(num, 0, 20); gD.restore();
    }
    gD.globalCompositeOperation = 'destination-out';
    gD.restore();
    gD.save(); gD.globalCompositeOperation = 'source-atop';
    for (let k = 0; k < 900; k++) { gD.fillStyle = `rgba(${base[0]},${base[1]},${base[2]},${rr(0.5, 1)})`; const tt = tOfY(0.66, -1); gD.fillRect(rr(sx + 260, sx + 760), Yt(tt) + rr(-30, 30), rr(1, 4), rr(1, 3)); }
    gD.restore();
    // a dent or two (soft, low)
    for (let k = 0; k < 14; k++) { const tt = tOfY(rr(0.08, 0.6), r() < 0.5 ? -1 : 1), x = rr(sx, sx + sw), R2 = rr(8, 24), g = gH.createRadialGradient(x, Yt(tt), 1, x, Yt(tt), R2);
      g.addColorStop(0, 'rgba(70,70,70,0.6)'); g.addColorStop(1, 'rgba(128,128,128,0)'); gH.fillStyle = g; gH.fillRect(x - R2, Yt(tt) - R2, 2 * R2, 2 * R2); }
    // the plastic's own grain (a fine orange-peel), everywhere
    for (let k = 0; k < 9000; k++) { const v = 128 + rr(-14, 14) | 0; gH.fillStyle = `rgba(${v},${v},${v},0.5)`; gH.fillRect(rr(0, W), Y0 + rr(0, 512), 2, 2); }
    // ---- the ends: the body's colour, chalked at the top, grimed at the foot, scuffed, a tyre mark
    const [ex, ey, ew, eh] = BREG.end;
    for (let yy = 0; yy < eh; yy++) { const y = 0.917 - (yy - 18) / PX, grime = 1 - sm(0.0, 0.3, y), up = sm(0.75, 0.92, y) * 0.5 + 0.12, gk = grime * 0.55;
      const cc = base.map((v, k) => v + (chalk[k] - v) * up * (white ? 0.5 : 0.75));
      gD.fillStyle = `rgb(${cc[0] * (1 - gk) + 62 * gk | 0},${cc[1] * (1 - gk) + 54 * gk | 0},${cc[2] * (1 - gk) + 44 * gk | 0})`; gD.fillRect(ex, Y0 + ey + yy, ew, 1);
      const ro = 110 + up * 80 + grime * 110; gR.fillStyle = `rgb(${ro | 0},${ro | 0},${ro | 0})`; gR.fillRect(ex, Y0 + ey + yy, ew, 1); }
    for (let k = 0; k < 40; k++) { const x = rr(ex + 10, ex + ew - 10), y = Y0 + ey + rr(eh * 0.55, eh - 6); gD.strokeStyle = `rgba(18,16,14,${rr(0.2, 0.5)})`; gD.lineWidth = rr(2, 6); gD.beginPath(); gD.moveTo(x, y); gD.lineTo(x + rr(-20, 20), y + rr(-6, 6)); gD.stroke(); }
    // ---- the plain parts (the knuckles, the cap), the lamp's yellow housing and its black clip
    { const [qx, qy, qw, qh] = BREG.plain, g = gD.createLinearGradient(0, Y0 + qy, 0, Y0 + qy + qh); g.addColorStop(0, `rgb(${chalk.join(',')})`); g.addColorStop(1, `rgb(${base.map(v => v * 0.7 | 0).join(',')})`); gD.fillStyle = g; gD.fillRect(qx, Y0 + qy, qw, qh); }
    { const [qx, qy, qw, qh] = BREG.yellow; gD.fillStyle = 'rgb(196,160,40)'; gD.fillRect(qx, Y0 + qy, qw, qh); for (let k = 0; k < 300; k++) { gD.fillStyle = `rgba(60,50,30,${rr(0.05, 0.25)})`; gD.fillRect(rr(qx, qx + qw), Y0 + qy + rr(0, qh), rr(1, 4), rr(1, 3)); } gR.fillStyle = 'rgb(95,95,95)'; gR.fillRect(qx, Y0 + qy, qw, qh); }
    { const [qx, qy, qw, qh] = BREG.black; gD.fillStyle = 'rgb(28,27,26)'; gD.fillRect(qx, Y0 + qy, qw, qh); gR.fillStyle = 'rgb(150,150,150)'; gR.fillRect(qx, Y0 + qy, qw, qh); }
  }
  // the height -> a tangent-space normal map (Sobel; GL convention, y up the sheet = +v)
  const hd = gH.getImageData(0, 0, W, W).data, out = gH.createImageData(W, W), o2 = out.data, k3 = 2.2 / 255;
  const H = (x, y) => hd[(((y + W) % W) * W + ((x + W) % W)) * 4];
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x - 1, y) - H(x - 1, y + 1)) * k3;
    const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x, y - 1) - H(x + 1, y - 1)) * k3;
    const l = Math.hypot(dx, dy, 1), i = (y * W + x) * 4;
    o2[i] = (0.5 - 0.5 * dx / l) * 255; o2[i + 1] = (0.5 + 0.5 * dy / l) * 255; o2[i + 2] = (0.5 + 0.5 / l) * 255; o2[i + 3] = 255;
  }
  const cN = mk(); cN.getContext('2d').putImageData(out, 0, 0);
  return { diff: cD, rough: cR, nor: cN };
}

// ---- THE FITTINGS' ATLAS (the restored hangar's working details): one 1024 canvas, painted regions --------------------
const FREG = {
  signH: [0, 0, 1024, 192], office: [0, 192, 256, 64], nosmoke: [256, 192, 128, 128], fire: [384, 192, 128, 128],
  num1: [512, 192, 64, 64], hazard: [576, 192, 192, 64], red: [768, 192, 32, 32], yellow: [800, 192, 32, 32], white: [832, 192, 32, 32],
  dark: [864, 192, 32, 32], grey: [896, 192, 32, 32], navy: [928, 192, 32, 32], green: [960, 192, 32, 32], wood: [992, 192, 32, 32],
  mat: [768, 224, 32, 32], planter: [800, 224, 64, 64], soil: [864, 224, 32, 32],
  acfront: [0, 320, 256, 224], cabinet: [256, 320, 128, 224], meter: [384, 320, 128, 128], keypad: [512, 320, 64, 96],
  extinguisher: [576, 320, 96, 224], hose: [672, 320, 160, 160], binfront: [832, 320, 128, 192],
};
function fitCanvas() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const g = c.getContext('2d'), r = rng(19421109), rr = (a, b) => a + (b - a) * r();
  const R = (k, col) => { const [x, y, w, h] = FREG[k]; g.fillStyle = col; g.fillRect(x, y, w, h); return [x, y, w, h]; };
  g.fillStyle = '#7d8286'; g.fillRect(0, 0, 1024, 1024);
  const grime = (k, a) => { const [x, y, w, h] = FREG[k]; for (let i = 0; i < 60 * w * h / 4096; i++) { g.fillStyle = `rgba(40,36,30,${rr(0.02, a)})`; g.fillRect(x + rr(0, w), y + rr(0, h), rr(1, 3), rr(1, 3)); }
    const gr = g.createLinearGradient(0, y + h * 0.6, 0, y + h); gr.addColorStop(0, 'rgba(40,36,30,0)'); gr.addColorStop(1, `rgba(40,36,30,${a})`); g.fillStyle = gr; g.fillRect(x, y, w, h); };
  { // the hangar's name board: white on a deep blue, a border, slight wear
    const [x, y, w, h] = R('signH', '#1d3557'); g.strokeStyle = '#e8e6df'; g.lineWidth = 6; g.strokeRect(x + 10, y + 10, w - 20, h - 20);
    g.fillStyle = '#efede6'; g.font = 'bold 118px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('HANGAR 1', x + w / 2, y + h / 2 + 6); grime('signH', 0.12); }   // (the user: this one is Hangar 1, the medium one Hangar 2)
  { const [x, y, w, h] = R('office', '#2b2f33'); g.fillStyle = '#e9e7e0'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('OFFICE', x + w / 2, y + h / 2 + 2); }
  { const [x, y, w, h] = R('nosmoke', '#f4f3ee'); g.strokeStyle = '#c8102e'; g.lineWidth = 12; g.beginPath(); g.arc(x + 64, y + 64, 48, 0, 7); g.stroke();
    g.fillStyle = '#222'; g.fillRect(x + 32, y + 58, 52, 12); g.fillStyle = '#d0a060'; g.fillRect(x + 84, y + 58, 10, 12); g.strokeStyle = '#c8102e'; g.beginPath(); g.moveTo(x + 30, y + 30); g.lineTo(x + 98, y + 98); g.stroke(); }
  { const [x, y, w, h] = R('fire', '#c8102e'); g.fillStyle = '#fff'; g.fillRect(x + 54, y + 34, 22, 66); g.fillRect(x + 44, y + 24, 30, 12); g.beginPath(); g.moveTo(x + 76, y + 30); g.lineTo(x + 96, y + 22); g.lineTo(x + 96, y + 34); g.fill();
    g.font = 'bold 16px sans-serif'; g.textAlign = 'center'; g.fillText('FIRE POINT', x + 64, y + 118); }
  { const [x, y, w, h] = R('num1', '#f4f3ee'); g.fillStyle = '#1d3557'; g.font = 'bold 54px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('1', x + 32, y + 34); }
  { const [x, y, w, h] = R('hazard', '#e8b812'); g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.fillStyle = '#1a1a1a'; for (let k = -4; k < 12; k++) { g.beginPath(); g.moveTo(x + k * 32, y + h); g.lineTo(x + k * 32 + 16, y + h); g.lineTo(x + k * 32 + 16 + h, y); g.lineTo(x + k * 32 + h, y); g.fill(); } g.restore(); grime('hazard', 0.25); }
  R('mat', '#24282b'); { const [x, y, w, h] = R('planter', '#a9a7a0'); for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(60,58,52,${rr(0.05, 0.25)})`; g.fillRect(x + rr(0, w), y + rr(0, h), 2, 2); } } R('soil', '#3b2f24');
  R('red', '#b5171f'); R('yellow', '#d9a90f'); R('white', '#e3e2dc'); R('dark', '#2a2c2e'); R('grey', '#8a8f93'); R('navy', '#1d3557'); R('green', '#3c5a3e'); R('wood', '#7a5434'); { const [x, y, w, h] = FREG.wood; for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(40,24,12,${rr(0.15, 0.35)})`; g.fillRect(x, y + rr(0, h), w, 1); } }
  { // the heat pump's front: a white case, a round fan grille, louvres, a badge
    const [x, y, w, h] = R('acfront', '#e6e5df'); g.fillStyle = '#d6d5cf'; g.fillRect(x + 8, y + 8, w - 16, h - 16);
    const cx = x + 96, cy = y + h / 2; g.fillStyle = '#3a3d40'; g.beginPath(); g.arc(cx, cy, 78, 0, 7); g.fill();
    g.strokeStyle = '#c9c8c2'; g.lineWidth = 3; for (let k = 1; k < 6; k++) { g.beginPath(); g.arc(cx, cy, k * 15, 0, 7); g.stroke(); }
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 78, cy + Math.sin(a) * 78); g.stroke(); }
    for (let k = 0; k < 9; k++) { g.fillStyle = '#b9b8b2'; g.fillRect(x + 190, y + 30 + k * 18, 52, 6); }
    g.fillStyle = '#4a6fa5'; g.fillRect(x + 196, y + h - 40, 40, 12); grime('acfront', 0.12); }
  { const [x, y, w, h] = R('cabinet', '#9aa0a3'); g.strokeStyle = '#6d7275'; g.lineWidth = 3; g.strokeRect(x + 6, y + 6, w - 12, h - 12);
    for (let k = 0; k < 6; k++) { g.fillStyle = '#7c8285'; g.fillRect(x + 24, y + 150 + k * 10, 80, 4); }
    g.fillStyle = '#e8b812'; g.beginPath(); g.moveTo(x + 64, y + 40); g.lineTo(x + 94, y + 92); g.lineTo(x + 34, y + 92); g.fill(); g.fillStyle = '#111'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.fillText('!', x + 64, y + 88);
    g.fillStyle = '#333'; g.fillRect(x + 108, y + 110, 8, 30); grime('cabinet', 0.18); }
  { const [x, y, w, h] = R('meter', '#a7aba8'); g.fillStyle = '#1e2a2c'; g.fillRect(x + 30, y + 26, 68, 44); g.fillStyle = '#9fc2b8'; g.fillRect(x + 38, y + 34, 52, 16); g.fillStyle = '#333'; g.fillRect(x + 56, y + 90, 16, 16); grime('meter', 0.18); }
  { const [x, y, w, h] = R('keypad', '#2c2e30'); g.fillStyle = '#9a9c9e'; for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) g.fillRect(x + 10 + i * 16, y + 26 + j * 16, 11, 11); g.fillStyle = '#3fb34f'; g.fillRect(x + 26, y + 10, 10, 6); }
  { const [x, y, w, h] = R('extinguisher', '#b5171f'); g.fillStyle = '#e8e6df'; g.fillRect(x + 12, y + 12, w - 24, 46); g.fillStyle = '#b5171f'; g.font = 'bold 14px sans-serif'; g.textAlign = 'center'; g.fillText('FIRE', x + w / 2, y + 32); g.fillText('EXT.', x + w / 2, y + 50);
    g.fillStyle = 'rgba(200,230,235,0.35)'; g.fillRect(x + 14, y + 70, w - 28, h - 90); g.fillStyle = '#8e1016'; g.fillRect(x + 32, y + 90, 32, 110); }
  { const [x, y, w, h] = R('hose', '#b5171f'); g.fillStyle = 'rgba(210,235,240,0.45)'; g.fillRect(x + 14, y + 14, w - 28, h - 28); g.strokeStyle = '#7a0d12'; g.lineWidth = 10; g.beginPath(); g.arc(x + w / 2, y + h / 2, 44, 0, 7); g.stroke(); g.beginPath(); g.arc(x + w / 2, y + h / 2, 26, 0, 7); g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 16px sans-serif'; g.textAlign = 'center'; g.fillText('FIRE HOSE', x + w / 2, y + h - 6); }
  { const [x, y, w, h] = R('binfront', '#3c5a3e'); g.fillStyle = '#2f4731'; g.fillRect(x, y, w, 26); g.fillStyle = '#e3e2dc'; g.font = 'bold 18px sans-serif'; g.textAlign = 'center'; g.fillText('LITTER', x + w / 2, y + 100); grime('binfront', 0.2); }
  return c;
}

// ---- the build ------------------------------------------------------------------------------------------------------------
function build(P0, lod, F) {
  const P = Object.assign({}, DEF, P0 || {});
  const stage = clamp(Math.round(P.stage || 0), 0, 3);
  if (stage === 3 && P.legacy) return restored(P, lod, F);   // (A/B only: the works shell this stage replaced)
  const L = clamp(lod | 0, 0, 2);
  const D = dimsOf(P);
  const { HW, HD, fy, yR, yTC, xG, xGR, xGL, xO, GW, xGs, GWs, gal, yL2, yGR, yTW, yBC, NB, zF, DH, BW, BH, xC, xe } = D;
  const dC = D.doorX, dW = D.DOOR_W / 2;                                // the door's centre and half width (the bay's)
  const bags = {};
  for (const k of BAGS.concat(EXTRA)) bags[k] = Bag(k);
  const g = HG.groundFn(P);
  const seed = P.seed | 0, rest = stage === 3, decay = rest ? 0 : clamp(P.decay, 0, 1);   // the restored hangar: nothing gone, nothing bent
  const der = stage === 0, safe = stage >= 1, roofed = stage >= 2;
  const wet = roofed ? 0 : clamp(P.wet, 0, 1);
  const st = { members: 0, sheets: 0, sheetsGone: 0, sheetsBent: 0, sheetsHung: 0, panes: 0, panesMilky: 0, shards: 0,
               weeds: 0, decals: 0, puddleArea: 0, chunks: 0, barriers: 0, replaced: 0 };
  const steelFor = id => bags.steel;
  const Z = [0, 0, 1], Yup = [0, 1, 0];
  // the decay field: where the weather got in (the back and the high corners worst, a few patches anywhere)
  const rot0 = (x, y, z) => clamp(0.55 * vnoise(x / 9 + 3.1, z / 9 - 1.7, seed) + 0.25 * vnoise(x / 3.3, (y + z) / 3.3, seed + 9) +
                                  0.2 * clamp((-z / HD) * 0.5 + 0.5, 0, 1), 0, 1);

  // ===================================================================== THE SLAB, THE PIERS, THE APRON
  {
    let gLo = 1e9;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) gLo = Math.min(gLo, g(sx * HW, sz * HD));
    const cs = L === 0 ? 2 : (L === 1 ? 5 : 40), nx = Math.max(1, Math.round(2 * HW / cs)), nz = Math.max(1, Math.round(2 * HD / cs));
    const b = bags.concFloor;
    // (P.room: the garage room stands its own floor - hangar.js's slab, its scan and its shadow bake - so none here)
    if (!P.room) for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x0 = -HW + 2 * HW * i / nx, x1 = -HW + 2 * HW * (i + 1) / nx, z0 = -HD + 2 * HD * j / nz, z1 = -HD + 2 * HD * (j + 1) / nz;
      face(b, [[x0, fy, z1], [x1, fy, z1], [x1, fy, z0], [x0, fy, z0]], Yup, uvFrame([0, fy, 0], [1, 0, 0], [0, 0, -1]));
    }
    // the slab's edge, down into the ground (the foundation the works shell stands on, G405.1's ring)
    if (!P.room) for (const [A, B] of [[[-HW, HD], [HW, HD]], [[HW, HD], [HW, -HD]], [[HW, -HD], [-HW, -HD]], [[-HW, -HD], [-HW, HD]]])
      K.wall(bags.concWall, { A, B, y0: gLo - 0.35, t: 0.3, topAt: () => fy, ext: [0.15, 0.15], inner: false, endCap: [false, false], capBot: false, capTop: true, sub: L === 0 ? 4 : 0 });
    // the column piers (a concrete pedestal 0.3 m proud of the slab under every column)
    const pier = (x, z) => K.boxAB(bags.concWall, [x - 0.34, fy - 0.02, z - 0.34], [x + 0.34, fy + 0.3, z + 0.34], { ny: true });
    for (let k = 0; k <= NB; k++) {
      const z = clamp(zF(k), -HD + 0.35, HD - 0.35);
      for (const s of [-1, 1]) { pier(s * xC, z); if (gal(s)) pier(xO - 0.2, z); }
    }
    if (P.apron) {
      // THE APRON: worn concrete bays (5 m), its joints the stain bag's, weeds in them (below)
      // (the whole front, the gallery's included, 6 m beyond either side: a DC-3's 29 m turns on it; A0 9 Nov: "Design
      // its apron and approach for a DC-3 taxiing in")
      const zA0 = HD + 0.15, zA1 = HD + P.apronL, xAL = -HW - 6, xAR = (gal(1) ? xO : HW) + 6, ya = (x, z) => g(x, z) + 0.06;
      const ca = L === 0 ? 2.5 : 10, nax = Math.round((xAR - xAL) / ca), naz = Math.max(1, Math.round((zA1 - zA0) / ca));
      for (let i = 0; i < nax; i++) for (let j = 0; j < naz; j++) {
        const x0 = xAL + (xAR - xAL) * i / nax, x1 = xAL + (xAR - xAL) * (i + 1) / nax, z0 = zA0 + (zA1 - zA0) * j / naz, z1 = zA0 + (zA1 - zA0) * (j + 1) / naz;
        face(b, [[x0, ya(x0, z1), z1], [x1, ya(x1, z1), z1], [x1, ya(x1, z0), z0], [x0, ya(x0, z0), z0]], Yup, uvFrame([0, 0, 0], [1, 0, 0], [0, 0, -1]));
      }
      if (L === 0) {                                                       // its joints and its cracks, its oil
        const ra = rng(seed * 19 + 2), yl = (x, z) => ya(x, z) + 0.004;
        const jl = (a, b, w) => { const d2 = nrm(sub(b, a)), nn = [-d2[2], 0, d2[0]], q = [add(a, mul(nn, -w)), add(b, mul(nn, -w)), add(b, mul(nn, w)), add(a, mul(nn, w))].map(p => [p[0], yl(p[0], p[2]), p[2]]);
          face(bags.stain, q, Yup, p => { const r0 = sub(p, a); return CELL(15, dot(r0, d2) / Math.max(0.01, len(sub(b, a))), (dot(r0, nn) + w) / (2 * w)); }); };
        for (let x = xAL + 2.5; x < xAR; x += 5) jl([x, 0, zA0], [x, 0, zA1], 0.05);
        for (let z = zA0 + 5; z < zA1; z += 5) jl([xAL, 0, z], [xAR, 0, z], 0.05);
        for (let c = 0; c < 26; c++) { let x = (xAL + xAR) / 2 + (ra() * 2 - 1) * (xAR - xAL) / 2, z = zA0 + ra() * (zA1 - zA0), a = ra() * 6.28;
          for (let q = 0; q < 8 + ra() * 10; q++) { a += (ra() - 0.5) * 0.9; const x2 = x + Math.cos(a) * 0.7, z2 = z + Math.sin(a) * 0.7; jl([x, 0, z], [x2, 0, z2], 0.02 + ra() * 0.025); x = x2; z = z2; } }
        for (let q = 0; q < (rest ? 2 : 9); q++) { const x = (xAL + xAR) / 2 + (ra() * 2 - 1) * ((xAR - xAL) / 2 - 3), z = zA0 + 2 + ra() * Math.min(30, zA1 - zA0 - 4), r = 0.5 + ra() * 1.1, c = q < 6 ? 11 : 12;
          face(bags.stain, [[x - r, yl(x, z), z + r], [x + r, yl(x, z), z + r], [x + r, yl(x, z), z - r], [x - r, yl(x, z), z - r]], Yup, p => CELL(c, (p[0] - x + r) / (2 * r), (z + r - p[2]) / (2 * r))); }
      }
      // the step from the apron up to the slab
      K.boxAB(bags.concWall, [-HW, ya(0, HD) - 0.05, HD + 0.0], [HW, fy, HD + 0.18], { ny: true, nz: true });
    }
  }

  // ===================================================================== THE FRAMES
  const pts = [];
  for (let i = 0; i <= D.NP; i++) { const x = -xe + 2 * xe * i / D.NP; pts.push({ x, yt: yTC(x), yb: yBC }); }
  const mid = D.NP / 2;
  // which frames are hurt (stage 0), and how; replaced in grey primer from stage 1
  const dmgOf = k => {
    const out = { skip: new Set(), bend: new Map() };
    if (k === 0 || k === NB || rest) return out;
    const rr = hashN(k, 7, 0, seed);
    if (rr < 0.35 + 0.3 * decay) {
      const n = 1 + Math.floor(hashN(k, 8, 0, seed) * (1 + 3 * decay));
      for (let q = 0; q < n; q++) {
        const i = 1 + Math.floor(hashN(k, 9, q, seed) * (D.NP - 2)), kind = hashN(k, 10, q, seed);
        if (kind < 0.55) out.skip.add('d' + i); else if (kind < 0.8) out.bend.set('v' + i, 0.12 + 0.25 * hashN(k, 11, q, seed)); else out.bend.set('d' + i, 0.15 + 0.3 * hashN(k, 12, q, seed));
      }
    }
    return out;
  };
  const truss = (bag, z, dmg) => {
    const P3 = (x, y) => [x, y, z];
    const mem = (id, a, b, kind, fl) => {
      const hurt = dmg && (dmg.skip.has(id) || dmg.bend.has(id));
      if (hurt && der) {
        if (dmg.skip.has(id)) return;
        memberBent(bag, a, b, kind, Z, L, dmg.bend.get(id), [hashN(z * 10, id.length, 3, seed) < 0.5 ? 1 : -1, 0, 0]); st.members++; return;
      }
      member(hurt ? bags.steelNew : bag, a, b, kind, Z, L, fl); st.members++; if (hurt) st.replaced++;
    };
    const p0 = pts[0], pM = pts[mid], pN = pts[D.NP];
    mem('tcL', P3(p0.x, p0.yt), P3(pM.x, pM.yt), 'chord', -1);
    mem('tcR', P3(pM.x, pM.yt), P3(pN.x, pN.yt), 'chord', -1);
    mem('bc', P3(p0.x, yBC), P3(pN.x, yBC), 'chord', 1);
    if (L < 2) {
      for (let i = 1; i < D.NP; i++) if (L === 0 || i === mid) mem('v' + i, P3(pts[i].x, yBC + 0.07), P3(pts[i].x, pts[i].yt - 0.07), 'web');
      mem('v0', P3(p0.x, yBC), P3(p0.x, p0.yt), 'web'); mem('vN', P3(pN.x, yBC), P3(pN.x, pN.yt), 'web');
      for (let i = 0; i < D.NP; i++) {
        const a = pts[i], b = pts[i + 1];
        if (i < mid) mem('d' + i, P3(a.x, a.yt - 0.06), P3(b.x, yBC + 0.06), 'web');
        else mem('d' + i, P3(b.x, b.yt - 0.06), P3(a.x, yBC + 0.06), 'web');
      }
      if (L === 0) for (let i = 0; i <= D.NP; i++) {            // the gussets, a plate at every panel point
        const a = pts[i];
        beam(bag, P3(a.x - 0.17, yBC + 0.04), P3(a.x + 0.17, yBC + 0.04), 0.006, 0.13, Yup, 0);
        const sl = nrm([1, a.x < 0 ? D.tp : -D.tp, 0]);
        beam(bag, add(P3(a.x, a.yt - 0.05), mul(sl, -0.17)), add(P3(a.x, a.yt - 0.05), mul(sl, 0.17)), 0.006, 0.13, [-sl[1], sl[0], 0], 0);
      }
    }
  };
  const column = (bag, x, z, yTop) => { member(bag, [x, fy + 0.3, z], [x, yTop, z], 'col', Z, L); st.members++; };
  const knees = (bag, z) => {
    if (L === 2) return;
    for (const s of [-1, 1]) member(bag, [s * (xC - 0.19), yBC - 1.6, z], [s * (xC - 2.4), yBC - 0.06, z], 'web', Z, L);
  };
  // THE PROTOTYPE: one sound interior truss at z = 0, stamped onto every sound frame (Bag.append)
  const proto = Bag('proto');
  truss(proto, 0, null);
  const instances = { truss: { tris: proto.tris, z: [] } };
  for (let k = 0; k <= NB; k++) {
    const zk = k === 0 ? -HD + 0.25 : (k === NB ? HD - 0.25 : zF(k));
    const dmg = dmgOf(k);
    if (!dmg.skip.size && !dmg.bend.size) { bags.steel.append(proto, { dz: zk }); instances.truss.z.push(+zk.toFixed(3)); }
    else truss(bags.steel, zk, dmg);
    for (const s of [-1, 1]) column(bags.steel, s * xC, zk, yTC(xC) + 0.12);
    knees(bags.steel, zk);
  }

  // ===================================================================== THE PURLINS, THE RODS, THE TIES
  const NPU = D.NPU;
  const purX = j => 0.15 + (HW - 0.3) * j / (NPU - 1);
  const purlinFate = (s, j, k) => {
    if (j === 0 || j === NPU - 1) return 'ok';
    const r = hashN(s * 31 + j, k, 21, seed), n = rot0(s * purX(j), 10, zF(k) + 2);
    if (r < (0.02 + 0.12 * n) * decay) return 'gone';
    if (r < (0.04 + 0.2 * n) * decay) return 'sag';
    return 'ok';
  };
  for (const s of [-1, 1]) {
    const nS = nrm([s * D.tp, 1, 0]);
    for (let j = 0; j < NPU; j++) {
      const x = s * purX(j), y = yR(x) - 0.13;
      if (L === 2 && j % 2) continue;
      if (L > 0) { member(bags.steel, [x, y, -HD - 0.3], [x, y, HD + 0.3], 'chan', nS, L); continue; }
      for (let k = 0; k < NB; k++) {
        const z0 = k === 0 ? -HD - 0.3 : zF(k), z1 = k === NB - 1 ? HD + 0.3 : zF(k + 1);
        const f = purlinFate(s, j, k);
        if (f === 'ok') { member(bags.steel, [x, y, z0], [x, y, z1], 'chan', nS, L); continue; }
        if (safe) { member(bags.steelNew, [x, y, z0], [x, y, z1], 'chan', nS, L); st.replaced++; continue; }
        if (f === 'sag') memberBent(bags.steel, [x, y, z0], [x, y, z1], 'chan', nS, L, 0.25 + 0.5 * hashN(j, k, 22, seed), [0, -1, 0]);
      }
    }
    if (L === 0) {
      // the sag rods at mid-bay, ridge to eave on the purlins' webs
      for (let k = 0; k < NB; k++) {
        const zc = (zF(k) + zF(k + 1)) / 2;
        member(bags.steel, [s * purX(0), yR(purX(0)) - 0.12, zc], [s * purX(NPU - 1), yR(purX(NPU - 1)) - 0.12, zc], 'rod', Yup, L);
      }
      // the X-rods in the roof plane: the end bays and the middle one
      for (const k of [0, Math.floor(NB / 2), NB - 1]) for (let q = 0; q < 3; q++) {
        const xa = s * (0.4 + (xe - 0.4) * q / 3), xb = s * (0.4 + (xe - 0.4) * (q + 1) / 3);
        const za = zF(k) + 0.1, zb = zF(k + 1) - 0.1, ya = x => yTC(x) + 0.09;
        member(bags.steel, [xa, ya(xa), za], [xb, ya(xb), zb], 'rod', Yup, L);
        member(bags.steel, [xb, ya(xb), za], [xa, ya(xa), zb], 'rod', Yup, L);
      }
    }
  }
  if (L < 2) {
    // the bottom-chord ties along the building, and the eave struts on the columns' heads
    for (const x of [0, -xe * 0.5, xe * 0.5]) for (let k = 0; k < NB; k++) member(bags.steel, [x, yBC - 0.1, zF(k)], [x, yBC - 0.1, zF(k + 1)], 'chanS', Yup, L);
    for (const s of [-1, 1]) member(bags.steel, [s * xC, yTC(xC) + 0.05, -HD], [s * xC, yTC(xC) + 0.05, HD], 'chan', [s, 0, 0], L);
  }
  // one fallen purlin across the floor (stage 0; carted away from stage 1)
  if (der && P.rubble && L < 2) {
    const a = [-3.2, fy + 0.11, 4.5], b = [2.8, fy + 0.11 + 0.6, 0.6];
    member(bags.steel, a, b, 'chan', nrm([0.3, 1, 0.2]), L);
  }

  // ===================================================================== CLADDING
  // a run of sheets on frame F over [u0, u1] x [v0, v1]: columns of 0.9 m cover lapped half a rib, rows lapped 150 mm
  // (the higher one outside: `upOut` for walls; the roof's v runs DOWN the slope, so its upper row is the lower v)
  const sheetFate = (p, region, ri, nRows) => {
    const r1 = hp(p, 41, seed), r2 = hp(p, 42, seed), n = rot0(p[0], p[1], p[2]);
    let pg = region.gone(p, n, ri, nRows);
    if (r1 < pg) return { k: 'gone' };
    const a = (r1 - pg) / Math.max(1e-3, 1 - pg);
    const pH = 0.018 * decay * (region.hang || 1), pB = 0.05 * decay * (region.bend || 1), pT = 0.035 * decay;
    if (der) {
      if (r2 < pH) return { k: 'hang', a };
      if (r2 < pH + pB) return { k: 'bent', a };
      if (r2 < pH + pB + pT) return { k: 'torn', a };
    } else if (r2 < pH + pB) return { k: 'gone' };   // made safe: the loose ones came down
    return { k: 'ok', a };
  };
  const streak = (F, u0, w, vTop, d, len, cell, prob, r) => {
    if (L > 0 || r > prob * (rest ? 0.12 : 1)) return;   // restored: new sheet, a streak here and there
    const sw = 0.12 + 0.3 * hashN(Math.round(u0 * 40), Math.round(vTop * 40), 5, seed), uc = u0 + (w - sw) * hashN(Math.round(u0 * 40), 3, 6, seed);
    sheet(bags.stain, F, uc, sw, vTop - len, vTop, d + 0.004, { lod: 0, uvf: (u, v) => CELL(cell, (u - uc) / sw, (vTop - v) / len) });
    st.decals++;
  };
  function clad(F, u0, u1, v0, v1, d, region) {
    const cw = 0.9, lap = 0.15, Lm = region.len || 3.05, H = v1 - v0;
    if (H < 0.05 || u1 - u0 < 0.05) return;
    const nRows = Math.max(1, Math.ceil((H - lap) / (Lm - lap))), rowL = (H + (nRows - 1) * lap) / nRows;
    let ci = 0;
    if (L === 2) {
      for (let u = u0; u < u1 - 0.04; u += cw, ci++) {
        const w = Math.min(cw + 0.11, u1 - u);
        let up = 0;
        for (let ri = 0; ri < nRows; ri++) { const a = v0 + ri * (rowL - lap), b = Math.min(v1, a + rowL); if (sheetFate(F.P(u + w / 2, (a + b) / 2, 0), region, ri, nRows).k !== 'gone') up++; }
        st.sheets += nRows;
        if (up * 2 >= nRows) sheet(region.bag(F.P(u + w / 2, (v0 + v1) / 2, 0), 0.5), F, u, w, v0, v1, d + (ci % 2) * 0.004, { lod: 2 });
      }
      return;
    }
    for (let u = u0; u < u1 - 0.04; u += cw, ci++) {
      const w = Math.min(cw + 0.11, u1 - u);
      for (let ri = 0; ri < nRows; ri++) {
        let a = v0 + ri * (rowL - lap), b = Math.min(v1, a + rowL);
        const outer = region.downOut ? (nRows - 1 - ri) : ri;
        const dd = d + outer * 0.012 + (ci % 2) * 0.004;
        const pc = F.P(u + w / 2, (a + b) / 2, 0);
        const fate = sheetFate(pc, region, ri, nRows);
        st.sheets++;
        if (fate.k === 'gone') { st.sheetsGone++; continue; }
        const bagS = region.bag(pc, fate.a);
        const o = { lod: L };
        if (fate.k === 'torn') {                       // torn off short: the lower (or upper) part gone
          const cut = 0.25 + 0.5 * fate.a;
          if (hp(pc, 43, seed) < 0.5) a = a + (b - a) * cut; else b = b - (b - a) * cut;
        }
        if (fate.k === 'bent') {                       // kicked out from a fixing line: the free part rotated off the wall
          const vk = region.downOut ? a + (b - a) * (0.35 + 0.3 * fate.a) : a + (b - a) * (0.4 + 0.35 * fate.a);
          const free = region.downOut ? 1 : -1, out = region.bendIn ? -1 : 1;
          const ang = free * out * (0.25 + 0.6 * fate.a) * (region.bendK || 1);
          o.vk = [vk]; o.rots = [{ piv: F.P(u, vk, dd), ax: F.X, ang, when: (uu, vv) => (free > 0 ? vv > vk + 1e-4 : vv < vk - 1e-4) }];
          st.sheetsBent++;
        }
        if (fate.k === 'hang') {                       // hung off one fixing: swung down about a corner, leaning off the wall
          const left = hp(pc, 44, seed) < 0.5, vTop = region.downOut ? a : b;
          const piv = F.P(left ? u + 0.05 : u + w - 0.05, vTop + (region.downOut ? 0.08 : -0.08), dd);
          const swing = (left ? -1 : 1) * (region.downOut ? -1 : 1) * (region.downOut ? 0.08 + 0.3 * fate.a : 0.5 + 0.9 * fate.a);   // a roof sheet dangles more than it swings
          o.rots = [{ piv, ax: F.N, ang: swing }, { piv, ax: F.X, ang: -(region.downOut ? 0.25 + 0.5 * fate.a : 0.1 + 0.3 * fate.a) * (region.hangOut || 1) }];
          st.sheetsHung++;
        }
        if (fate.k === 'ok' && region.sag && a < region.sag - 0.05 && b > region.sag + 0.05) {
          const vk = region.sag;
          o.vk = [vk]; o.rots = [{ piv: F.P(u, vk, dd), ax: F.X, ang: -(0.05 + 0.16 * hp(pc, 53, seed) * decay), when: (uu, vv) => vv > vk + 1e-4 }];
        }
        sheet(bagS, F, u, w, a, b, dd, o);
        if (fate.k === 'ok' && !region.noStreak) {
          const top = region.downOut ? a : b;
          if (region.downOut) { /* roof: no streaks drawn on the top face */ }
          else {
            const sk = region.streaks || 0.6;
            streak(F, u, w, top - 0.05, dd + 0.006 + AMP, Math.min(b - a - 0.1, 0.6 + 1.6 * hp(pc, 45, seed)), 4 + Math.floor(hp(pc, 46, seed) * 3), sk, hp(pc, 47, seed));
            streak(F, u + w * 0.45, w * 0.5, top - 0.05, dd + 0.007 + AMP, Math.min(b - a - 0.1, 0.4 + 1.2 * hp(pc, 54, seed)), 4 + Math.floor(hp(pc, 55, seed) * 3), sk * 0.7, hp(pc, 56, seed));
            if (ri > 0) streak(F, u, w, a + lap, dd - 0.012 + 0.006 + AMP, Math.min(1.4, a + lap - v0), 4 + Math.floor(hp(pc, 48, seed) * 3), 0.3, hp(pc, 49, seed));
          }
        }
      }
    }
  }
  // a gable run, a sheet column at a time, each cut to the rake at its low corner (`topU(u)`: the roof line over u)
  function cladGable(F, uA, uB, yb, topU, d, region) {
    for (let u = uA; u < uB - 0.04; u += 0.9) { const u1 = Math.min(uB, u + 0.9); clad(F, u, u1, yb, Math.min(topU(u), topU(u1)), d, region); }
  }
  const pick = (main, alt, pAlt) => (p, a) => (hashN(Math.round((p[0] + p[2]) / 0.9), Math.round(p[0] * p[2] > 0 ? 1 : 2), 51, seed) < pAlt ? bags[alt] : bags[main]);   // a column at a time

  // ===================================================================== THE FRONT: towers, header girder, the gable band
  const FR = frame([0, 0, HD], [1, 0, 0], Yup);                  // the front's face plane (outside +z)
  const zT = 0.3;                                                 // the towers stand proud of the gable
  const towerTop = yTW + 0.85;
  const winGrid = (F2, s0, s1, y0, y1, d, cols, rows, region) => windowWall(F2, s0, s1, y0, y1, d, cols, rows, region);
  // ---- the window walls (steel sash: an outline, T mullions; the glass mostly gone, a few milky panes, shards)
  function windowWall(F2, s0, s1, y0, y1, d, cols, rows, region) {
    if (L > 0) return;                                                    // past 200 m a 70 mm sash is under a pixel: a window is its hole
    const bS = bags.steel, rg = region || {};
    const frameM = (a, b) => member(bS, a, b, 'chan', F2.N, Math.max(L, 1));
    // the outline (a 70 x 50 section) and the bars (a T: 24 wide, 36 deep)
    const P2 = (s, y, dd) => F2.P(s, y, d + (dd || 0));
    const ow = 0.035;
    beam(bS, P2(s0, y0 + ow), P2(s1, y0 + ow), ow, 0.03, F2.Y, 0); beam(bS, P2(s0, y1 - ow), P2(s1, y1 - ow), ow, 0.03, F2.Y, 0);
    beam(bS, P2(s0 + ow, y0), P2(s0 + ow, y1), ow, 0.03, F2.X, 0); beam(bS, P2(s1 - ow, y0), P2(s1 - ow, y1), ow, 0.03, F2.X, 0);
    void frameM;
    if (L === 1) return;                                                  // the middle band: the outline alone
    const cs = 1;
    for (let i = cs; i < cols; i += cs) { const s = s0 + (s1 - s0) * i / cols; beam(bS, P2(s, y0 + ow, -0.005), P2(s, y1 - ow, -0.005), 0.012, 0.018, F2.X, 0); }
    for (let j = cs; j < rows; j += cs) { const y = y0 + (y1 - y0) * j / rows; beam(bS, P2(s0 + ow, y, -0.005), P2(s1 - ow, y, -0.005), 0.012, 0.018, F2.Y, 0); }
    if (L > 0) return;
    const pw = (s1 - s0) / cols, ph = (y1 - y0) / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const a0 = s0 + pw * i + (i === 0 ? ow * 2 : 0.012), a1 = s0 + pw * (i + 1) - (i === cols - 1 ? ow * 2 : 0.012);
      const b0 = y0 + ph * j + (j === 0 ? ow * 2 : 0.012), b1 = y0 + ph * (j + 1) - (j === rows - 1 ? ow * 2 : 0.012);
      const pc = P2((a0 + a1) / 2, (b0 + b1) / 2);
      const r = hp(pc, 61, seed), r2 = hp(pc, 62, seed);
      st.panes++;
      const keep = rest ? 1 : (rg.keep !== undefined ? rg.keep : 0.05 + 0.3 * (1 - decay));   // restored: every pane glazed
      if (r < keep) {                                                     // a milky pane left whole (or cracked)
        face(bags.glass, [P2(a0, b0, -0.01), P2(a1, b0, -0.01), P2(a1, b1, -0.01), P2(a0, b1, -0.01)], F2.N, uvFrame(P2(a0, b0), F2.X, F2.Y));
        if (!rest) st.panesMilky++; continue;
      }
      if (!der) continue;                                                 // made safe: the shards are out
      if (r < keep + 0.32) {                                              // shards left in the putty: a corner, or a jagged band
        const nsd = 1 + Math.floor(r2 * 3);
        for (let q = 0; q < nsd; q++) {
          const c = Math.floor(hp(pc, 63 + q, seed) * 4), e1 = 0.2 + 0.6 * hp(pc, 70 + q, seed), e2 = 0.2 + 0.6 * hp(pc, 80 + q, seed);
          const C = [[a0, b0], [a1, b0], [a1, b1], [a0, b1]], A = C[c], Bq = C[(c + 1) % 4], Dq = C[(c + 3) % 4];
          const t1 = [A[0] + (Bq[0] - A[0]) * e1, A[1] + (Bq[1] - A[1]) * e1], t2 = [A[0] + (Dq[0] - A[0]) * e2, A[1] + (Dq[1] - A[1]) * e2];
          face(bags.glass, [P2(A[0], A[1], -0.01), P2(t1[0], t1[1], -0.01), P2(t2[0], t2[1], -0.01)], F2.N, uvFrame(P2(a0, b0), F2.X, F2.Y));
          st.shards++;
        }
      }
    }
  }
  // ---- a concrete tower face with its openings (the kit's wall: reveals, caps), and its windows in the reveals
  function towerFace(A, B, y0, y1, holes, wins, t) {
    const W = K.wall(bags.concWall, { A, B, y0, t: t || 0.3, topAt: () => y1, holes, ext: [0, 0], inner: true, endCap: [true, true], capBot: false, capTop: true, sub: L === 0 ? 1.5 : 0 });
    if (!W) return null;
    const F2 = { X: W.X, Y: Yup, N: W.N, P: (s, y, dd) => { const q = W.P(s, y, 0); return add(q, mul(W.N, dd || 0)); } };
    for (const h of wins) windowWall(F2, h.s0, h.s1, h.y0, h.y1, -0.05, h.cols, h.rows);
    return { W, F2 };
  }
  for (const s of [-1, 1]) {
    // the front tower: the gallery's front end, x in [xG, HW], its face zT proud
    // (the right one runs on across the gallery to its outer wall: THE FALSE FRONT, at full height over a one-storey lean-to)
    const A = s > 0 ? [xGR - 0.15, HD + zT] : [-HW - 0.15, HD + zT], B = s > 0 ? [xO + 0.15, HD + zT] : [-xGL + 0.15, HD + zT];
    const Lw = B[0] - A[0];
    const dS = s > 0 ? D.xDo0 - A[0] : Lw - 2.2;                          // the ground-floor door: the offices' (into the gallery)
    const holes = [{ s0: dS, s1: dS + 1.2, y0: fy, y1: fy + 2.3 },
                   { s0: s > 0 ? dS + 1.8 : 0.8, s1: s > 0 ? Lw - 0.8 : Lw - 2.7, y0: fy + 1.2, y1: fy + 3.3 },
                   { s0: 0.8, s1: Lw - 0.8, y0: yL2 + 0.8, y1: yTW - 0.5 }];
    const wins = [{ s0: holes[1].s0, s1: holes[1].s1, y0: holes[1].y0, y1: holes[1].y1, cols: 4, rows: 4 },
                  { s0: holes[2].s0, s1: holes[2].s1, y0: holes[2].y0, y1: holes[2].y1, cols: 8, rows: 5 }];
    if (gal(s)) {
      towerFace(A, B, fy, towerTop, holes, wins);
      // the false front's upper windows look into nothing (the gallery's roof is a storey down): a dark backing panel behind
      // them, so from the apron a room reads there - the building whole from the front, stepped from the side and above
      sheet(bags.sheetDark, frame([A[0], 0, HD - 0.45], [1, 0, 0], Yup), holes[2].s0 - 0.2, holes[2].s1 - holes[2].s0 + 0.4, holes[2].y0 - 0.2, holes[2].y1 + 0.2, 0.0, { lod: L });
      K.boxAB(bags.concWall, [xG, yGR, HD - 0.5], [xO + 0.15, yGR + 0.12, HD]);   // the false front's back: a floor under the backing
    } else towerFace(A, B, fy, towerTop, [], []);                              // the facade's front: a plain concrete pier
    // the tower's return beside the opening (the reveal of the big door, solid concrete up to the tower's head)
    const xR = s * xGs(s);
    K.wall(bags.concWall, { A: s > 0 ? [xR, HD] : [xR, HD + zT + 0.15], B: s > 0 ? [xR, HD + zT + 0.15] : [xR, HD], y0: fy, t: 0.3, topAt: () => towerTop, inner: false, endCap: [false, false], capTop: true, capBot: false, sub: L === 0 ? 1.5 : 0 });
    // the coping on the tower's head
    K.boxAB(bags.concWall, [Math.min(A[0], B[0]) - 0.08, towerTop, HD - 0.5], [Math.max(A[0], B[0]) + 0.08, towerTop + 0.18, HD + zT + 0.23]);
    // and the tower's front-corner column (heavy) at the opening, under the header girder
    column(bags.steel, xR, HD - 0.25, yBC + 0.1);
  }
  // ---- the header girder (a Pratt, its top chord the front frame's bottom chord) and the posts and girts of the gable
  const zH = HD - 0.25;
  {
    const yb = fy + DH + 0.12, yt = yBC, np = 12;
    member(bags.steel, [-xGL, yb, zH], [xGR, yb, zH], 'hchord', Z, L, -1);
    const gx = i => -xGL + (xGL + xGR) * i / np;
    if (L < 2) for (let i = 0; i <= np; i++) {
      const x = gx(i);
      member(bags.steel, [x, yb + 0.1, zH], [x, yt - 0.08, zH], 'web', Z, L);
      if (i < np) { const x1 = gx(i + 1); if (i < np / 2) member(bags.steel, [x, yt - 0.08, zH], [x1, yb + 0.1, zH], 'web', Z, L); else member(bags.steel, [x, yb + 0.1, zH], [x1, yt - 0.08, zH], 'web', Z, L); }
    }
    // the gable over the header: posts at the panel points up to the frame's top chord, girts every ~1.6 m
    if (L < 2) for (let i = 1; i < np; i++) { const x = gx(i); member(bags.steel, [x, yBC, zH - 0.0], [x, yTC(x) - 0.06, zH], 'chanS', [0, 0, 1], L); }
    for (let y = yBC + 1.0; y < yR(0) - 0.6; y += 1.6) {
      const xs = HW - (y - (fy + D.EAVE)) / D.tp;                       // where this girt meets the rake
      const xm = Math.min(HW - 0.2, xs - 0.2);
      if (xm > 0.5) member(bags.steel, [-xm, y, zH + 0.12], [xm, y, zH + 0.12], 'chanS', [0, 0, 1], L);
    }
    // the door's top track, under the girder, and its floor rail (bent and broken in the derelict)
    member(bags.steel, [-xGL - 0.2, fy + DH - 0.05, HD - 0.05], [xGR + 0.2, fy + DH - 0.05, HD - 0.05], 'chanS', [0, 0, 1], L);
    if (L < 2) {
      const segs = 8;
      for (let i = 0; i < segs; i++) {
        const x0 = -xGL + (xGL + xGR) * i / segs + 0.05, x1 = -xGL + (xGL + xGR) * (i + 1) / segs - 0.05;
        if (der && hashN(i, 3, 91, seed) < 0.25 * decay) continue;
        const lift = der && hashN(i, 4, 91, seed) < 0.2 * decay ? 0.12 : 0;
        beam(bags.steel, [x0, fy + 0.012, HD - 0.3], [x1, fy + 0.012 + lift, HD - 0.3], 0.03, 0.012, Yup, 0);
      }
    }
  }
  // ---- the gable band: pale sheets from the door head to the rake, the towers' heads to the rake
  {
    const top = s => yR(s) + 0.02;
    const reg = {
      bag: pick('sheetPale', 'sheetDark', 0.08),
      gone: (p, n, ri, nr) => (0.015 + 0.6 * SM(0.62, 0.9, n) + (ri === nr - 1 ? 0.1 : 0) + (p[0] > xGR - 1.5 || p[0] < -xGL + 1.5 ? 0.05 : 0)) * decay,
      bend: 1.4, hang: 0.6, streaks: 0.9,
    };
    // in vertical strips so the top follows the rake (each strip clipped to its own roof line)
    const dz = 0.06;
    cladGable(FR, -xGL - 0.1, xGR + 0.1, fy + DH - 0.2, u => top(u), dz, reg);
    for (const s of [-1, 1]) { const xa = s > 0 ? xGR + 0.1 : -HW - 0.05, xb = s > 0 ? HW + 0.05 : -xGL - 0.1; cladGable(FR, xa, xb, towerTop + 0.05, u => top(u), dz, reg); }
    // the flashing over the door head (a bent strip along the whole opening)
    beam(bags.sheetDark, [-xGL, fy + DH - 0.22, HD + 0.09], [xGR, fy + DH - 0.22, HD + 0.09], 0.004, 0.06, [0, 0, 1], 0);
    // the barge flashing up the rake (in pieces, some gone)
    if (L < 2) for (const s of [-1, 1]) for (let i = 0; i < 8; i++) {
      const x0 = s * HW * i / 8, x1 = s * HW * (i + 1) / 8;
      if (der && hashN(i, s + 5, 92, seed) < 0.3 * decay) continue;
      beam(bags.sheetDark, [x0, yR(x0) + 0.03, HD + 0.12], [x1, yR(x1) + 0.03, HD + 0.12], 0.06, 0.012, [0, 1, 0], 0);
    }
  }

  // ===================================================================== THE FLANKS
  // A WALL RUN along a side, a bay at a time: window rows (`rows`: [{ y0, y1, cols, rows, ground }]), the sheets round them
  // (piers, spandrels, the band to `yTop`), the girts, a concrete stem to 1 m (`stem`), the gutter at its eave (`gut`: the
  // gutter's height). The hall's left wall (two rows to the eave), the hall's right wall over the gallery's roof (a clerestory
  // row), and the gallery's outer wall (one storey) are three runs of it.
  function flank(s, xw, yBot, rows, yTop, stem, gut) {
    const F2 = frame([s * xw, 0, s > 0 ? HD : -HD], [0, 0, -s], Yup);  // u along the wall from the front (right) / back (left)
    const uOf = z => (s > 0 ? HD - z : z + HD);
    if (stem) K.wall(bags.concWall, { A: s > 0 ? [xw - 0.12, HD] : [-xw + 0.12, -HD], B: s > 0 ? [xw - 0.12, -HD] : [-xw + 0.12, HD], y0: g(s * xw, 0) - 0.3, t: 0.24,
                                      topAt: () => fy + 1.0, inner: true, endCap: [false, false], capTop: true, capBot: false, sub: L === 0 ? 2 : 0 });
    const gys = [];
    for (const r of rows) gys.push(r.y0 - 0.05, r.y1 + 0.05);
    gys.push((rows[rows.length - 1].y1 + yTop) / 2);
    if (L < 2) for (let k = 0; k < NB; k++) for (const y of gys) {
      if (y > yTop - 0.2) continue;
      if (der && hashN(k, Math.round(y * 10), 93 + s + Math.round(xw), seed) < 0.06 * decay) continue;
      member(bags.steel, [s * (xw - 0.17), y, zF(k)], [s * (xw - 0.17), y, zF(k + 1)], 'chanS', [s, 0, 0], L);
    }
    const reg = { bag: pick('sheetPale', 'sheetDark', 0.12), gone: (p, n) => (0.015 + 0.5 * SM(0.64, 0.9, n)) * decay, bend: 1, hang: 1 };
    const regBand = { bag: pick('sheetDark', 'sheetPale', 0.15), gone: (p, n, ri) => (0.03 + 0.55 * SM(0.6, 0.88, n)) * decay, bend: 1.2, hang: 1.2 };
    for (let k = 0; k < NB; k++) {
      const u0 = Math.min(uOf(zF(k)), uOf(zF(k + 1))), u1 = Math.max(uOf(zF(k)), uOf(zF(k + 1)));
      const w0 = u0 + 0.55, w1 = u1 - 0.55;
      let yPrev = yBot;
      for (const r of rows) {
        if (r.ground && roofed && !rest) {                             // stage 2: the ground floor boarded
          sheet(bags.ply, F2, w0, w1 - w0, r.y0, r.y1, 0.04, { lod: 1 });
          if (L === 0) for (let q = 1; q < 4; q++) beam(bags.ply, F2.P(w0, r.y0 + (r.y1 - r.y0) * q / 4, 0.06), F2.P(w1, r.y0 + (r.y1 - r.y0) * q / 4, 0.06), 0.004, 0.003, F2.N, 0);
        }
        windowWall(F2, w0, w1, r.y0, r.y1, -0.02, r.cols || 8, r.rows || 4);
        if (r.y0 - yPrev > 0.05) clad(F2, w0, w1, yPrev, r.y0, 0.04, reg);                  // the spandrel under the row
        clad(F2, u0, w0, yPrev, r.y1, 0.04, reg); clad(F2, w1, u1, yPrev, r.y1, 0.04, reg);  // the piers beside it
        yPrev = r.y1;
      }
      if (yTop - yPrev > 0.05) clad(F2, u0, u1, yPrev, yTop, 0.04, regBand);               // the band over the last row
      if (stem && L === 0 && !rest) for (let q = 0; q < 3; q++) {      // water down the stem from the sill (restored: washed)
        const uq = w0 + (w1 - w0) * (0.15 + 0.7 * hashN(k, q, 99 + s, seed)), wq = 0.25 + 0.35 * hashN(k, q, 100 + s, seed), Lq = 0.5 + 0.45 * hashN(k, q, 101, seed);
        face(bags.stain, [F2.P(uq, fy + 1.0 - Lq, 0.005), F2.P(uq + wq, fy + 1.0 - Lq, 0.005), F2.P(uq + wq, fy + 1.0, 0.005), F2.P(uq, fy + 1.0, 0.005)], F2.N,
             p => { const q2 = sub(p, F2.P(uq, fy + 1.0, 0)); return CELL(q % 2 ? 7 : 5, dot(q2, F2.X) / wq, -q2[1] / Lq); });
        st.decals++;
      }
    }
    // the eave: the gutter's remains (lengths missing, one hanging); stage 2 hangs new gutters (below)
    if (L < 2 && gut !== undefined && !roofed) {
      const xg = s * (xw + 0.12), yg = gut;
      for (let i = 0; i < NB; i++) {
        const z0 = zF(i) + 0.03, z1 = zF(i + 1) - 0.03, r = hashN(i, s + Math.round(xw), 94, seed);
        if (der && r < 0.35 * decay) continue;
        if (der && r < 0.5 * decay) { const a = [xg, yg, z0], b = [xg + s * 0.4, yg - 2.2, z1 - 1.5]; K.sweepProfile(bags.sheetDark, a, b, K.troughSection(0.075, 0.004, L === 0 ? 7 : 3), [0, 1, 0], 'shell'); continue; }
        K.sweepProfile(bags.sheetDark, [xg, yg, z0], [xg, yg, z1], K.troughSection(0.075, 0.004, L === 0 ? 7 : 3), [0, 1, 0], 'shell');
      }
    }
  }
  const ROW_G = { y0: fy + 1.1, y1: fy + 3.3, cols: 8, rows: 4, ground: true }, ROW_U = { y0: yL2 + 0.9, y1: yL2 + 3.5, cols: 8, rows: 5 };
  flank(-1, HW, fy + 1.0, [ROW_G, ROW_U], yR(HW) + 0.02, true, yR(HW) - 0.06);               // the hall's left wall
  if (gal(1)) {
    flank(1, HW, yGR + 0.3, [{ y0: yGR + 0.9, y1: yGR + 3.1, cols: 8, rows: 4 }], yR(HW) + 0.02, false, yR(HW) - 0.06);   // over the gallery
    flank(1, xO, fy + 1.0, [ROW_G], yGR + 0.4, true, yGR + 0.3);                                // the gallery's outer wall
  } else flank(1, HW, fy + 1.0, [ROW_G, ROW_U], yR(HW) + 0.02, true, yR(HW) - 0.06);

  // ===================================================================== THE GALLERY (the offices: a lean-to, one storey)
  if (gal(1)) {
    const s = 1, xi = HW;
    // the outer columns, the beams across to the hall's columns, the flat roof slab (a bay of it fallen in, stage 0-1)
    for (let k = 0; k <= NB; k++) {
      const z = clamp(zF(k), -HD + 0.25, HD - 0.25);
      column(bags.steel, xO - 0.2, z, yGR);
      if (L < 2) member(bags.steel, [xO - 0.2, yGR - 0.2, z], [xC, yGR - 0.2, z], 'chan', [0, 1, 0], L);
    }
    member(bags.steel, [xO - 0.2, yGR - 0.2, -HD + 0.2], [xO - 0.2, yGR - 0.2, HD - 0.2], 'col', [1, 0, 0], L);
    const hole = (der || stage === 1) && P.rubble ? Math.floor(hashN(s, 1, 95, seed) * (NB - 3)) + 1 : -1;   // the fallen bay
    const y = yGR, th = 0.14, x0 = xi, x1 = xO;
    for (let k = 0; k < NB; k++) {
      const z0 = k === 0 ? -HD : zF(k), z1 = k === NB - 1 ? HD : zF(k + 1);
      if (k === hole) {
        // half the bay is gone, the rest hangs at a tilt on its reinforcement
        const zm = (z0 + z1) / 2;
        K.plate(bags.concFloor, [[x0, y, z0], [x1, y, z0], [x1, y, zm - 0.6], [x0, y, zm - 0.6]], th, [0, -1, 0]);
        K.plate(bags.concFloor, [[x0, y, zm + 0.1], [x1, y, zm + 0.1], [x1, y - 1.4, zm + 1.2], [x0, y - 0.9, zm + 1.4]], th, [0, -1, 0]);
        if (stage === 1) for (const zz of [zm - 1.0, zm + 0.6]) for (const xx of [x0 + 0.8, x1 - 0.8]) beam(bags.steelNew, [xx, fy, zz], [xx, y - th, zz], 0.04, 0.04, [1, 0, 0], 0);   // acrow props
        continue;
      }
      K.plate(bags.concFloor, [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], th, [0, -1, 0]);
    }
    // its parapet (a dark flashing along the outer edge and the back) and the gallery's floor (the hall's slab stops at the wall)
    beam(bags.sheetDark, [xO + 0.02, yGR + 0.32, -HD], [xO + 0.02, yGR + 0.32, HD - 0.4], 0.006, 0.12, [1, 0, 0], 0);
    face(bags.concFloor, [[xi, fy, HD], [xO, fy, HD], [xO, fy, -HD], [xi, fy, -HD]], Yup, uvFrame([0, fy, 0], [1, 0, 0], [0, 0, -1]));
    // THE INNER WALL toward the hall (the gallery's ground storey on the hall's right wall line): the white sheet with X rods,
    // an office door and window every third bay, up to the gallery's ceiling; over it the hall's own clerestory (the flank)
    const yW = yGR - 0.3;
    const F2 = frame([xi, 0, -HD], [0, 0, s], Yup);                     // N = X x Y: toward the hall
    const uOf = z => z + HD;
    for (let k = 0; k < NB; k++) {
      const u0 = Math.min(uOf(zF(k)), uOf(zF(k + 1))) + 0.2, u1 = Math.max(uOf(zF(k)), uOf(zF(k + 1))) - 0.2;
      if (k % 3 !== 1) {
        const regW = { bag: () => bags.sheetWhite, gone: (p, n) => (0.01 + 0.35 * SM(0.7, 0.92, n)) * decay, bend: 0.8, hang: 0.3, len: 2.4, bendIn: false };
        clad(F2, u0, u1, fy + 0.05, yW, 0.06, regW);
        if (L < 2) {
          const xr = xi - 0.13, za = zF(k) + 0.25, zb = zF(k + 1) - 0.25;
          member(bags.steel, [xr, fy + 0.4, za], [xr, yW - 0.1, zb], 'rod', [1, 0, 0], L);
          member(bags.steel, [xr, fy + 0.4, zb], [xr, yW - 0.1, za], 'rod', [1, 0, 0], L);
          member(bags.steel, [xr + 0.02, fy + 2.1, zF(k) + 0.15], [xr + 0.02, fy + 2.1, zF(k + 1) - 0.15], 'chanS', [1, 0, 0], L);
        }
      } else {
        windowWall(F2, u0 + 0.2, u0 + 1.9, fy + 2.4, yW - 0.1, 0, 3, 3);
        windowWall(F2, u0 + 3.2, u1 - 0.2, fy + 1.0, yW - 0.1, 0, 5, 5);
        clad(F2, u0, u0 + 0.2, fy + 0.05, yW, 0.03, reg2());
        clad(F2, u0 + 1.9, u0 + 3.2, fy + 0.05, yW, 0.03, reg2());
        clad(F2, u0 + 3.2, u1, fy + 0.05, fy + 1.0, 0.03, reg2());
      }
      clad(F2, u0 - 0.2, u1 + 0.2, yW, yGR + 0.3, 0.03, reg2());          // the strip up to the gallery's roof
    }
  }
  function reg2() { return { bag: pick('sheetPale', 'sheetWhite', 0.25), gone: (p, n) => (0.015 + 0.4 * SM(0.66, 0.9, n)) * decay, bend: 0.8, hang: 0.5, len: 2.2 }; }

  // ===================================================================== THE BACK
  {
    const FB = frame([0, 0, -HD], [-1, 0, 0], Yup);                     // outside -z; s runs +x -> -x
    for (const s of [-1, 1]) {
      // the back towers: concrete, a door and a window a storey
      // the back piers: concrete, the hall's full height; behind the gallery its own end wall, one storey, a door and a window
      const A = s > 0 ? [HW + 0.15, -HD - 0.15] : [-xGL + 0.15, -HD - 0.15], B = s > 0 ? [xGR - 0.15, -HD - 0.15] : [-HW - 0.15, -HD - 0.15];
      towerFace(A, B, fy, yTW + 0.4, [], [], 0.25);
      if (s > 0 && gal(s)) {
        const Ag = [xO + 0.15, -HD - 0.15], Bg = [HW + 0.15, -HD - 0.15], Lg = Ag[0] - Bg[0];
        towerFace(Ag, Bg, fy, yGR + 0.4, [{ s0: 0.9, s1: 2.1, y0: fy, y1: fy + 2.2 }, { s0: 2.7, s1: Lg - 0.6, y0: fy + 1.2, y1: fy + 3.3 }],
                  [{ s0: 2.7, s1: Lg - 0.6, y0: fy + 1.2, y1: fy + 3.3, cols: 3, rows: 3 }], 0.25);
      }
    }
    const zb = -HD + 0.12;
    // the wind posts, the opening's head, girts at the sides and over the head
    for (const x of [-BW / 2, BW / 2, -(xGL + BW / 2) / 2, (xGR + BW / 2) / 2, 0]) {
      if (x === 0) { member(bags.steel, [0, fy + BH, zb], [0, yTC(0) - 0.05, zb], 'col', [1, 0, 0], L); continue; }
      member(bags.steel, [x, fy + 0.3, zb], [x, yTC(x) - 0.05, zb], 'col', [1, 0, 0], L);
    }
    member(bags.steel, [-BW / 2, fy + BH, zb], [BW / 2, fy + BH, zb], 'col', [0, 1, 0], L);
    const gys = [fy + 1.2, fy + 3.0, fy + BH];
    for (let y = fy + BH + 1.6; y < yR(0) - 0.5; y += 1.6) gys.push(y);
    if (L < 2) for (const y of gys) {
      const rake = HW - Math.max(0, y - (fy + D.EAVE)) / D.tp - 0.2, xsR = Math.min(xGR, rake), xsL = Math.min(xGL, rake);
      if (y <= fy + BH + 0.01) { member(bags.steel, [BW / 2, y, zb - 0.1], [xsR, y, zb - 0.1], 'chanS', [0, 0, 1], L); member(bags.steel, [-BW / 2, y, zb - 0.1], [-xsL, y, zb - 0.1], 'chanS', [0, 0, 1], L); }
      else if (rake > 0.5) member(bags.steel, [-xsL, y, zb - 0.1], [xsR, y, zb - 0.1], 'chanS', [0, 0, 1], L);
    }
    // the cladding: stripped worst here (the weather's side)
    const regB = { bag: pick('sheetDark', 'sheetPale', 0.4), gone: (p, n) => (0.25 + 0.55 * n) * decay, bend: 1.3, hang: 1.4 };
    const top = x => yR(x) + 0.02;
    for (const sx of [-1, 1]) {                                              // beside the opening
      const ua = sx > 0 ? -xGR : BW / 2, ub = sx > 0 ? -BW / 2 : xGL;     // FB's s = -x
      clad(FB, ua, ub, fy + 0.05, fy + BH, 0.08, regB);
    }
    cladGable(FB, -xGR, xGL, fy + BH, u => top(-u), 0.08, regB);            // over the head, under the rake
    for (const sx of [-1, 1]) {                                              // over the back towers
      const ua = sx > 0 ? -HW : xGL, ub = sx > 0 ? -xGR : HW;
      cladGable(FB, ua, ub, yTW + 0.45, u => top(-u), 0.08, regB);
    }
  }

  // ===================================================================== THE DOORS (restored)
  // THE BIG DOOR: six leaves across the 29 m between the towers on three tracks under the header (two leaves a track, the
  // outer pair outermost), each a frame of channels - stiles, rails, a brace - skinned outside in the wall's corrugated
  // sheet; `P.doorOpen` (0 shut .. 1 open) runs them telescoped to the jambs, three a side. THE BACK DOORS: four leaves
  // over the 16 m opening on two tracks, open behind the wall either side. In the house frame; the room flips it.
  const doors = [];
  if (rest) {
    const open = clamp(P.doorOpen || 0, 0, 1);
    const openB = clamp(P.backOpen || 0, 0, 1);   // (the user 9 Nov: "close the back door in the restored version" - its own dial, shut)
    // (glazed: THE BACK LEAVES ARE WINDOWS - the user 9 Nov: "let's not shut the back door, but make it sort of a window with
    // integrated opening, yet closed ... So we have light": a steel sash over a sheet kick panel, shut, the daylight through)
    const leaf = (cx, zf, w, y0, y1, out, glazed) => {
      const F2 = frame([cx - w / 2 * out, 0, zf], [out, 0, 0], Yup);      // X across the leaf, N toward `out` z
      if (glazed) {
        const yk = y0 + 1.1;
        sheet(bags.sheetPale, F2, 0, w, y0, yk, 0.035, { lod: L });
        if (L === 0) windowWall(F2, 0.06, w - 0.06, yk, y1 - 0.08, -0.01, Math.max(2, Math.round(w / 0.9)), 4);
        else face(bags.glass, [F2.P(0.06, yk, -0.01), F2.P(w - 0.06, yk, -0.01), F2.P(w - 0.06, y1 - 0.08, -0.01), F2.P(0.06, y1 - 0.08, -0.01)], F2.N, uvFrame(F2.P(0, yk, 0), F2.X, F2.Y));
      } else sheet(bags.sheetPale, F2, 0, w, y0, y1, 0.035, { lod: L });
      if (L < 2) {
        const P2 = (u, y, d) => F2.P(u, y, d), d0 = -0.04, sec = L === 0 ? 'chanS' : 'chanS';
        for (const y of [y0 + 0.08, y0 + (y1 - y0) / 3, y0 + 2 * (y1 - y0) / 3, y1 - 0.08]) member(bags.steel, P2(0.05, y, d0), P2(w - 0.05, y, d0), sec, F2.N, L);
        for (const u of [0.06, w - 0.06]) member(bags.steel, P2(u, y0, d0), P2(u, y1, d0), sec, F2.N, L);
        if (L === 0) member(bags.steel, P2(0.15, y0 + 0.15, d0 - 0.02), P2(w - 0.15, y0 + (y1 - y0) / 3 - 0.1, d0 - 0.02), 'web', F2.N, L);
      }
      doors.push({ x: cx, z: zf, w, h: y1 - y0 });
    };
    // the front: closed, leaf i covers its sixth; open, the three of a side stack at their jamb
    const n = D.NL, W = D.LW, y0 = fy + 0.03, y1 = fy + DH - 0.14;      // (dims: the leaves and the CLEAR width they leave)
    for (let i = 0; i < n; i++) {
      const side = i < n / 2 ? -1 : 1, trk = side < 0 ? i : n - 1 - i;      // 0 outermost
      const xc = -xGL + (2 * dW / n) * (i + 0.5), xo = side < 0 ? -xGL + W / 2 + 0.05 : xGR - W / 2 - 0.05;
      leaf(xc + (xo - xc) * open, HD - 0.42 - trk * 0.24, W, y0, y1, 1);
    }
    for (let k = 0; k < n / 2 && L < 2; k++) member(bags.steel, [-xGL - 0.1, fy + DH - 0.05, HD - 0.42 - k * 0.24], [xGR + 0.1, fy + DH - 0.05, HD - 0.42 - k * 0.24], 'chanS', [0, 0, 1], L);
    // the back: four leaves, two tracks, parting in the middle
    const bw = BW / 4 + 0.08, by1 = fy + BH - 0.1;
    for (let i = 0; i < 4; i++) {
      const side = i < 2 ? -1 : 1, trk = side < 0 ? i : 3 - i;
      const xc = -BW / 2 + (BW / 4) * (i + 0.5), xo = side * (BW / 2 + bw * (0.6 + (1 - trk) * 0.9));
      leaf(xc + (xo - xc) * openB, -HD + 0.38 + trk * 0.2, bw, fy + 0.03, by1, -1, true);
    }
  }

  // ===================================================================== THE ROOF
  if (!roofed) {
    // what is left of the cladding: dark sheets along the eaves (sagging off the last purlin), strays, milky roof lights
    for (const s of [-1, 1]) {
      const FRf = frame([0, yR(0) - 0.02, 0], [0, 0, s], nrm([s * HW, -2.6, 0]));   // u along z, v down the slope from the ridge
      const vEave = D.slopeLen + 0.25, vSag = D.slopeLen - 1.55;
      const regR = {
        downOut: true, len: 5.3, noStreak: true,
        bag: (p, a) => (hp(p, 52, seed) < 0.12 ? bags.glass : bags.sheetDark),
        gone: (p, n, ri, nr) => {
          const t = Math.abs(p[0]) / HW;                                 // 0 the ridge .. 1 the eave
          const kf = t > 0.78 ? 0.75 - 0.4 * n : (t > 0.5 ? 0.1 - 0.08 * n : 0.03);   // at decay 1
          return 1 - (kf + (1 - kf) * Math.pow(1 - decay, 1.5));
        },
        bend: 2.0, hang: 1.6, hangOut: 2.0, bendIn: true, bendK: 0.7, sag: D.slopeLen - 1.55,
      };
      // the eave sheets first, as their own run so the sag sits at the last purlin
      const u0 = -HD - 0.25, u1 = HD + 0.25;
      clad(FRf, u0, u1, 0.0, vEave, 0.0, regR);
      // the sag: every surviving eave sheet bends down off the last purlin (drawn in clad as 'bent' when chosen; the
      // rest of the eave course sags a little more as a body) - a gentle fold on the sheets still whole
      void vSag;
    }
  } else {
    // ---- STAGE 2: THE NEW ROOF - galvanised sheets lapped down the slope, roof lights (the works' rhythm), a ridge cap,
    // gutters and downpipes
    for (const s of [-1, 1]) {
      const FRf = frame([0, yR(0) + 0.0, 0], [0, 0, s], nrm([s * HW, -2.6, 0]));
      const vE = D.slopeLen + 0.3, cw = 0.9;
      const NL = Math.max(2, Math.round(2 * HD / 6.25));
      const lightZ = q => -HD + 3.4 + q * (2 * HD - 6.8) / Math.max(1, NL - 1);
      for (let u = -HD - 0.3, ci = 0; u < HD + 0.3; u += cw, ci++) {
        const w = Math.min(cw + 0.11, HD + 0.3 - u), zc = s * (u + w / 2);
        const rows = [[0, 6.9], [6.75, 13.65], [13.5, vE]];
        for (let ri = 0; ri < 3; ri++) {
          const lightHere = ri === 1 && Array.from({ length: NL }, (_, q) => Math.abs(zc - lightZ(q)) < 1.8).some(Boolean);
          sheet(lightHere ? bags.glass : bags.sheetNew, FRf, u, w, rows[ri][0], rows[ri][1], (2 - ri) * 0.012 + (ci % 2) * 0.004, { lod: L });
        }
      }
      if (L < 2) {
        const xg = s * (HW + 0.3), yg = yR(HW) - 0.12;
        K.sweepProfile(bags.steelNew, [xg, yg, -HD - 0.3], [xg, yg, HD + 0.3], K.troughSection(0.075, 0.004, L === 0 ? 9 : 4), [0, 1, 0], 'shell');
        for (const zc of [-HD + 0.5, HD - 0.5]) K.cyl(bags.steelNew, [s * (HW + 0.12), g(s * HW, zc) + 0.15, zc], [0, 1, 0], 0.045, yg - g(s * HW, zc) - 0.3, L === 0 ? 8 : 5, false);
      }
    }
    beam(bags.steelNew, [0, yR(0) + 0.05, -HD - 0.3], [0, yR(0) + 0.05, HD + 0.3], 0.18, 0.04, [0, 1, 0], 0);
  }

  // ===================================================================== THE FLOOR: puddles, cracks, joints, rubble, litter
  if (L < 2) {
    // THE PUDDLES: one low-frequency field for where the slab sank; marching squares at the water's level
    const hF = (x, z) => 0.55 * vnoise(x / 7.5 + 11, z / 7.5 - 4, seed + 3) + 0.3 * vnoise(x / 2.6, z / 2.6, seed + 4) + 0.15 * vnoise(x / 0.9, z / 0.9, seed + 5)
                         + 0.08 * (Math.abs(x) / HW) - (Math.abs(x) < xG - 1 ? 0 : 0.0);
    const cs = L === 0 ? 0.5 : 1.0, x0 = -xGL + 0.4, x1 = xGR - 0.4, z0 = -HD + 0.6, z1 = HD - 0.4;
    const lvl = 0.12 + 0.42 * wet;
    const contour = (bag, level, y, uvf) => {
      let area = 0;
      const nx = Math.ceil((x1 - x0) / cs), nz = Math.ceil((z1 - z0) / cs);
      const val = [];
      for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) val.push(hF(x0 + i * cs, z0 + j * cs) - level);
      const V = (i, j) => val[j * (nx + 1) + i];
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const c = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], vv = c.map(q => V(q[0], q[1]));
        if (vv.every(v => v > 0)) continue;
        const poly = [];
        for (let q = 0; q < 4; q++) {
          const a = c[q], b = c[(q + 1) % 4], va = vv[q], vb = vv[(q + 1) % 4];
          if (va <= 0) poly.push([x0 + a[0] * cs, z0 + a[1] * cs]);
          if ((va <= 0) !== (vb <= 0)) { const t = va / (va - vb); poly.push([x0 + (a[0] + (b[0] - a[0]) * t) * cs, z0 + (a[1] + (b[1] - a[1]) * t) * cs]); }
        }
        if (poly.length < 3) continue;
        const ring = poly.map(p => [p[0], y, p[1]]);
        face(bag, ring, Yup, uvf || uvFrame([0, y, 0], [1, 0, 0], [0, 0, -1]));
        for (let q = 1; q + 1 < poly.length; q++) area += Math.abs((poly[q][0] - poly[0][0]) * (poly[q + 1][1] - poly[0][1]) - (poly[q + 1][0] - poly[0][0]) * (poly[q][1] - poly[0][1])) / 2;
      }
      return area;
    };
    if (wet > 0.01) {
      st.puddleArea = contour(bags.water, lvl, fy + 0.006);
      contour(bags.stain, lvl + 0.07, fy + 0.003, () => CELL(13, 0.5, 0.5));       // the wet margin, darker slab round each
    } else if (roofed && !rest) contour(bags.stain, 0.2, fy + 0.003, () => CELL(13, 0.5, 0.5));   // the damp patches where it stood
    if (L === 0 && !P.room) {
      // the joints (5 m bays, sawn) and the cracks (random walks across the slab, worse where it sank)
      const line = (a, b, w, y, cell) => { const d2 = nrm(sub(b, a)), nn = [-d2[2], 0, d2[0]];
        face(bags.stain, [add(a, mul(nn, -w)), add(b, mul(nn, -w)), add(b, mul(nn, w)), add(a, mul(nn, w))].map(p => [p[0], y, p[2]]), Yup,
             p => { const q = sub(p, a); return CELL(cell, dot(q, d2) / Math.max(0.01, len(sub(b, a))), (dot(q, nn) + w) / (2 * w)); }); };
      for (let x = -HW + 5; x < HW; x += 5) line([x, 0, -HD + 0.2], [x, 0, HD - 0.2], 0.035, fy + 0.002, 15);
      for (let z = -HD + 5; z < HD; z += 5) line([-HW + 0.2, 0, z], [HW - 0.2, 0, z], 0.035, fy + 0.002, 15);
      const rc = rng(seed * 3 + 7);
      for (let c = 0; c < (rest ? 5 : 22); c++) {
        let x = dC + (rc() * 2 - 1) * (dW - 1), z = (rc() * 2 - 1) * (HD - 1), a = rc() * 6.28;
        const n = 6 + Math.floor(rc() * 14);
        for (let q = 0; q < n; q++) {
          a += (rc() - 0.5) * 0.9; const sl = 0.4 + rc() * 0.7, x2 = clamp(x + Math.cos(a) * sl, -HW + 0.3, HW - 0.3), z2 = clamp(z + Math.sin(a) * sl, -HD + 0.3, HD - 0.3);
          line([x, 0, z], [x2, 0, z2], 0.02 + rc() * 0.03, fy + 0.0025, 15);
          if (der && P.weeds && rc() < 0.18) weed(x2, fy, z2, 0.25 + rc() * 0.3, rc() < 0.7 ? 0 : 3, rc());
          x = x2; z = z2;
        }
      }
      // oil and moss patches
      for (let q = 0; q < 10; q++) { const x = dC + (rc() * 2 - 1) * (dW - 2), z = (rc() * 2 - 1) * (HD - 2), r = 0.6 + rc() * 1.6, c = q < 5 ? 11 : 12;
        face(bags.stain, [[x - r, fy + 0.0028, z + r], [x + r, fy + 0.0028, z + r], [x + r, fy + 0.0028, z - r], [x - r, fy + 0.0028, z - r]], Yup, p => CELL(c, (p[0] - x + r) / (2 * r), (z + r - p[2]) / (2 * r))); st.decals++; }
    }
  }
  // the rubble: piles of broken concrete and sheet off the fallen gallery bay and along the walls (stage 0); two neat
  // heaps (stage 1); swept (stage 2)
  if (P.rubble && L < 2 && stage < 2) {
    const rc = rng(seed * 5 + 1);
    const chunk = (x, z, r) => {
      const up = nrm([rc() - 0.5, 1, rc() - 0.5]), ax = nrm([rc() - 0.5, (rc() - 0.5) * 0.4, rc() - 0.5]), l = r * (0.5 + rc());
      const c = [x, fy + r * 0.35, z];
      beam(bags.concFloor, add(c, mul(ax, -l / 2)), add(c, mul(ax, l / 2)), r * (0.4 + rc() * 0.5), r * (0.25 + rc() * 0.35), up, 0);
      st.chunks++;
    };
    const pile = (cx, cz, R, n) => { for (let q = 0; q < n; q++) { const a = rc() * 6.28, d = Math.sqrt(rc()) * R; chunk(cx + Math.cos(a) * d, cz + Math.sin(a) * d, 0.08 + 0.3 * rc() * (1 - d / R * 0.6)); } };
    if (der) {
      for (const s of [1]) {                                                    // under the gallery's fallen bay
        const k = Math.floor(hashN(s, 1, 95, seed) * (NB - 3)) + 1, zc = (zF(k) + zF(k + 1)) / 2 + 0.8;
        pile(s * (HW - D.GW / 2), zc, 1.8, L === 0 ? 70 : 12);
      }
      for (let q = 0; q < 5; q++) pile(dC + (rc() * 2 - 1) * (dW - 2), (rc() * 2 - 1) * (HD - 3), 0.8, L === 0 ? 14 : 3);
      // sheets fallen on the floor, bent
      if (L === 0) for (let q = 0; q < 14; q++) {
        const x = dC + (rc() * 2 - 1) * (dW - 1), z = (rc() * 2 - 1) * (HD - 1), a = rc() * 6.28;
        const Fx = frame([x, fy + 0.03 + rc() * 0.05, z], [Math.cos(a), 0, Math.sin(a)], [-Math.sin(a), 0, Math.cos(a)]);
        const vk = 0.6 + rc() * 0.8;
        sheet(rc() < 0.6 ? bags.sheetDark : bags.sheetPale, Fx, 0, 0.9, 0, 1.4 + rc() * 1.4, 0, { lod: 0, vk: [vk], rots: [{ piv: Fx.P(0, vk, 0), ax: Fx.X, ang: -(0.2 + rc() * 0.6), when: (u, v) => v > vk }] });
      }
    } else {
      pile(-xGL + 3.5, HD - 6, 2.2, L === 0 ? 120 : 16); pile(xGR - 3.5, -HD + 6, 2.0, L === 0 ? 100 : 14);
    }
  }
  // the litter on the floor and the apron
  if (P.litter && L === 0 && stage < 2) {
    const rc = rng(seed * 11 + 3);
    const n = der ? 40 : 8;
    for (let q = 0; q < n; q++) {
      const out = P.apron && rc() < 0.35;
      const x = out ? (rc() * 2 - 1) * (HW + 4) : dC + (rc() * 2 - 1) * (dW - 0.5), z = out ? HD + 1 + rc() * (P.apronL - 2) : (rc() * 2 - 1) * (HD - 0.5), r = 0.35 + rc() * 0.4, a = rc() * 6.28;
      const y = out ? g(x, z) + 0.065 : fy + 0.004;
      const ca = Math.cos(a) * r, sa = Math.sin(a) * r;
      face(bags.decal, [[x - ca + sa, y, z - sa - ca], [x + ca + sa, y, z + sa - ca], [x + ca - sa, y, z + sa + ca], [x - ca - sa, y, z - sa + ca]], Yup,
           p => { const dx = p[0] - x, dz = p[2] - z; return CELL(10, (dx * Math.cos(a) + dz * Math.sin(a)) / (2 * r) + 0.5, (-dx * Math.sin(a) + dz * Math.cos(a)) / (2 * r) + 0.5); });
      st.decals++;
    }
  }

  // ===================================================================== GRAFFITI
  if (P.graffiti && L === 0 && !rest) {
    const rc = rng(seed * 13 + 5);
    const tag = (Fw, u, y, w, d, cell, follow) => {
      const h = w * (0.45 + rc() * 0.25);
      if (follow) sheet(bags.decal, Fw, u, w, y, y + h, d + AMP + 0.004, { lod: 0, uvf: (uu, vv) => CELL(cell, (uu - u) / w, (vv - y) / h) });
      else face(bags.decal, [Fw.P(u, y, d), Fw.P(u + w, y, d), Fw.P(u + w, y + h, d), Fw.P(u, y + h, d)], Fw.N, p => { const q = sub(p, Fw.P(u, y, d)); return CELL(cell, dot(q, Fw.X) / w, dot(q, Fw.Y) / h); });
      st.decals++;
    };
    // the white wall's foot (the right-hand gallery, toward the bay)
    const FW = frame([xGR, 0, -HD], [0, 0, 1], Yup);                       // the white wall faces the bay (-x)
    for (let k = 0; k < NB - 1; k++) if (k % 3 !== 1 && rc() < 0.85) tag(FW, D.BAY * k + 0.3 + rc() * 2.2, fy + 0.25 + rc() * 0.4, 1.4 + rc() * 1.6, 0.06, Math.floor(rc() * 4), true);
    // the towers' fronts, low
    const FT = frame([0, 0, HD + zT + 0.152], [1, 0, 0], Yup);
    for (const s of [1]) for (let q = 0; q < 2; q++) tag(FT, s * (xGR + 1.2 + rc() * 2.5) - 0.8, fy + 0.3 + rc() * 0.5, 1.2 + rc() * 1.2, 0.0, Math.floor(rc() * 4), false);
    // a column pier or two
    for (let q = 0; q < 4; q++) { const k = 1 + Math.floor(rc() * (NB - 1)), Fp = frame([xGR - 0.35, 0, zF(k) + 0.35], [1, 0, 0], Yup);
      tag(Fp, 0.02, fy + 0.04, 0.66, 0.0, Math.floor(rc() * 4), false); }
  }

  // ===================================================================== BARRIERS, LAMPS AND BOARDS
  // (the user 9 Nov: "rework the red plastic barriers ... professional quality. Texture work, proper weathering, and more
  // realistic tone"): the water-filled jersey barrier of barrierMesh below, its painted sheet (barrierCanvas), red and
  // white units in turn, interlocked end to end where they make a line; warning lamps on the made-safe line
  const lights = [];
  if (P.barriers && L < 2) {
    const put = (x, z, yaw, o) => { const r = barrierMesh(bags, Object.assign({ x, y: fy, z, yaw, lod: L, off: hashN(Math.round(x * 10), Math.round(z * 10), 61, seed) * 1.8 }, o || {})); st.barriers++; if (r.lamp) lights.push(r.lamp); return r; };
    // a run of interlocked units from (x0, z0) along `yaw`, each joint a few degrees off true, every `lampEvery` a lamp
    const run = (x0, z0, yaw, n, o) => {
      let x = x0, z = z0, a = yaw;
      for (let q = 0; q < n; q++) {
        const ja = (hashN(q, Math.round(x0 * 10), 62, seed) - 0.5) * 0.08;
        a += ja;
        const cx = x + Math.sin(a) * BARRIER.L / 2, cz = z + Math.cos(a) * BARRIER.L / 2;
        put(cx, cz, a, Object.assign({ white: (q + (o.w0 || 0)) % 2 === 1, lamp: o.lampEvery && q % o.lampEvery === 1 ? 1 : 0 }, o.each ? o.each(q) : {}));
        x += Math.sin(a) * (BARRIER.L + 0.015); z += Math.cos(a) * (BARRIER.L + 0.015);
      }
    };
    if (der) {
      // along the white wall's foot: three still locked, one pulled out and turned, one on its side, one faded white
      run(xGR - 0.75, 3.0, 0, 3, { w0: 0 });
      put(xGR - 1.6, 9.6, -0.55, { white: false });
      put(xGR - 1.5, 11.9, -0.35, { white: false, tip: 1 });
      put(xGR - 0.8, -4.0, -0.06, { white: true, fade: 1 });
    } else if (stage === 1) {
      // the line across the front, the access gap in the middle, a lamp on every fourth
      const zl = HD + 1.7, half = BARRIER.L + 0.015;
      run(-xGL + 0.6, zl, Math.PI / 2, Math.floor((dC - 2.2 + xGL - 0.6) / half), { lampEvery: 4 });
      run(dC + 2.2, zl, Math.PI / 2, Math.floor((xGR - 0.6 - dC - 2.2) / half), { lampEvery: 4, w0: 1 });
      for (const x of [-6, 6]) {                                            // the boards on their posts
        for (const dx of [-0.55, 0.55]) beam(bags.steelNew, [x + dx, fy, HD + 2.6], [x + dx, fy + 1.9, HD + 2.6], 0.025, 0.025, [1, 0, 0], 0);
        K.boxAB(bags.ply, [x - 0.65, fy + 1.0, HD + 2.63], [x + 0.65, fy + 1.9, HD + 2.66]);
        face(bags.decal, [[x - 0.62, fy + 1.0, HD + 2.67], [x + 0.62, fy + 1.0, HD + 2.67], [x + 0.62, fy + 1.9, HD + 2.67], [x - 0.62, fy + 1.9, HD + 2.67]], [0, 0, 1],
             p => CELL(14, (p[0] - x + 0.62) / 1.24, 0.2 + (p[1] - fy - 1.0) / 0.9 * 0.6));
      }
    } else if (stage === 2) {
      run(xGR + 0.6, HD + 1.4, Math.PI / 2, 3, { w0: 0 });                    // stood aside, in front of the right tower
    }
  }

  // ===================================================================== WEEDS
  function weed(x, y, z, h, cell, r) {
    if (L > 0 || !P.weeds) return;
    const a = (r || 0.37) * 6.28, n = cell === 2 ? 3 : 2, wv = h * (cell === 1 ? 0.6 : 1);
    for (let q = 0; q < n; q++) {
      const t = a + q * Math.PI / n, dx = Math.cos(t) * wv / 2, dz = Math.sin(t) * wv / 2;
      const p = [[x - dx, y, z - dz], [x + dx, y, z + dz], [x + dx, y + h, z + dz], [x - dx, y + h, z - dz]];
      const uv = [WCELL(cell, 0, 0), WCELL(cell, 1, 0), WCELL(cell, 1, 1), WCELL(cell, 0, 1)];
      const ids = p.map((pp, i) => bags.weed.v(pp, uv[i], [0, 1, 0]));
      bags.weed.quad(ids[0], ids[1], ids[2], ids[3]); bags.weed.quad(ids[3], ids[2], ids[1], ids[0]);
    }
    st.weeds++;
  }
  if (P.weeds && L === 0) {
    const rc = rng(seed * 17 + 9);
    const along = (xa, za, xb, zb, yf, dens, inside, joint) => {
      const Ld = Math.hypot(xb - xa, zb - za), n = Math.round(Ld * dens);
      for (let q = 0; q < n; q++) {
        const t = rc(), x = xa + (xb - xa) * t, z = za + (zb - za) * t;
        const clump = vnoise(x / 3, z / 3, seed + 21);
        if (rc() > clump * 1.4) continue;
        const kind = rc(), off = (rc() - 0.3) * 0.5;
        const nx = -(zb - za) / Ld, nz = (xb - xa) / Ld;
        const xx = x + nx * off, zz = z + nz * off, y = yf(xx, zz);
        if (kind < 0.55 || joint) weed(xx, y, zz, (0.25 + rc() * 0.4) * (joint ? 0.7 : 1), kind < 0.75 || !joint ? 0 : 3, rc());
        else if (kind < 0.75) weed(xx, y, zz, 0.3 + rc() * 0.4, 3, rc());
        else if (kind < 0.93 && (!inside || der)) weed(xx, y, zz, 0.7 + rc() * 0.7, 1, rc());
        else if (!inside) weed(xx, y, zz, 0.7 + rc() * 0.9, 2, rc());
      }
    };
    const gy = (x, z) => g(x, z) + (P.apron && z > HD ? 0.06 : 0);
    const k0 = roofed ? 0.5 : (safe ? 0.8 : 1.6);
    // outside: the flanks' feet, the towers' feet, the back
    for (const s of [-1, 1]) { const xw = s > 0 && gal(1) ? xO : HW; along(s * (xw + 0.25), -HD, s * (xw + 0.25), HD, gy, k0, false); }
    along(-HW, -HD - 0.4, gal(1) ? xO : HW, -HD - 0.4, gy, k0 * 1.2, false);
    for (const s of [-1, 1]) along(s * xGs(s), HD + zT + 0.4, s > 0 && gal(1) ? xO : s * HW, HD + zT + 0.4, gy, k0 * 1.5, false);
    // the corners at the opening: alder and fireweed up against the towers
    if (!roofed) for (const s of [-1, 1]) for (let q = 0; q < (der ? 3 : 1); q++) weed(s * (xGs(s) + 0.8 + rc() * (gal(s) ? 3 : 1.5)), gy(s * HW, HD + 1), HD + zT + 0.6 + rc() * 0.8, 1.3 + rc() * 1.5, 2, rc());
    if (der) {
      // inside: the gallery walls' feet toward the bay, the back opening spilling in, the gallery roofs (open to the sky)
      for (const s of [-1, 1]) along(s * (HW - 0.3), -HD + 0.5, s * (HW - 0.3), HD - 1, () => fy, 0.9, true);
      along(-D.BW / 2, -HD + 0.6, D.BW / 2, -HD + 0.6, () => fy, 1.8, false);
      for (const s of [1]) along(s * (xG + D.GW * 0.45), -HD + 0.5, s * (xG + D.GW * 0.45), HD - 0.8, () => yGR, 1.4, true);
      // the side bays' ground storey at the front: bushes in the light of the tower door
      for (const s of [1]) for (let q = 0; q < 4; q++) weed(s * (xG + 1 + rc() * (D.GW - 2)), fy, HD - 1 - rc() * 3, 0.6 + rc() * 1.2, rc() < 0.5 ? 2 : 1, rc());
    }
    if (P.apron) {                                                           // the apron's joints
      const xR6 = (gal(1) ? xO : HW) + 6;
      for (let x = -HW - 6 + 2.5; x < xR6; x += 5) along(x, HD + 0.6, x, HD + P.apronL - 0.5, gy, safe ? 0.3 : 0.7, false, true);
      for (let z = HD + 5; z < HD + P.apronL; z += 5) along(-HW - 6, z, xR6, z, gy, safe ? 0.3 : 0.7, false, true);
    }
  }
  // the stains down the concrete under the tower windows and the coping (water runs)
  if (L === 0) {
    const FT = frame([0, 0, HD + zT + 0.153], [1, 0, 0], Yup);
    for (const s of [-1, 1]) for (let q = 0; q < (rest ? 2 : 7); q++) {
      const u = s * xGs(s) + s * (0.3 + Math.max(0.1, (s > 0 && gal(1) ? xO - xGR : GWs(s)) - 0.6) * hashN(q, s, 97, seed)) - 0.15, top = q < 4 ? towerTop - 0.02 : (q < 6 ? yTW - 0.5 : fy + 3.3), Ls = 0.8 + 1.8 * hashN(q, s, 98, seed);
      face(bags.stain, [FT.P(u, top - Ls, 0), FT.P(u + 0.3, top - Ls, 0), FT.P(u + 0.3, top, 0), FT.P(u, top, 0)], FT.N, p => CELL(7, (p[0] - u) / 0.3, (top - p[1]) / Ls));
      st.decals++;
    }
  }

  // ===================================================================== A WORKING BUILDING (restored)
  // (the user 9 Nov: "add detail that screams restored, like pipes and little furnishing on the facade that show that
  // it's actually working"): the services a used hangar wears - a sign over the door and floodlights on the header with
  // their conduit to the cabinet and the meter box; the office entrance (a canopy, a bulkhead, the door's number, a plate,
  // a bench, a bin); the fire point (extinguisher, hose reel, the signs); a yellow gas pipe; heat-pump units on their pad
  // along the office flank, their pipes up the wall; a stainless flue through the roof over the offices; a camera;
  // hazard stripes on the jambs; the apron's lead-in line. One painted atlas (the `fit` bag) for every coloured part.
  if (rest && L < 2) {
    const fb = bags.fit, T0 = HD + zT + 0.15;                               // the towers' concrete face
    const fv = (reg, u, v) => { const [x, y, w, h] = FREG[reg]; return [(x + clamp(u, 0.01, 0.99) * w) / 1024, 1 - (y + clamp(v, 0.01, 0.99) * h) / 1024]; };
    // an oriented box: centre c, X across, Y up, Z = X x Y out of its wall; the front wears `rf`, the rest `rs` (a solid)
    const obox = (c, X, Y, hx, hy, hz, rf, rs) => {
      const Zv = nrm(crs(X, Y)), P0 = (a, b, d) => add(add(add(c, mul(X, a * hx)), mul(Y, b * hy)), mul(Zv, d * hz));
      const F = (pts, n, uvf) => { const ids = pts.map(p => fb.v(p, uvf(p), n)); fb.quad(ids[0], ids[1], ids[2], ids[3]); };
      const so = () => fv(rs || 'grey', 0.5, 0.5);
      F([P0(-1, -1, 1), P0(1, -1, 1), P0(1, 1, 1), P0(-1, 1, 1)], Zv, p => { const q = sub(p, c); return fv(rf || rs || 'grey', 0.5 + dot(q, X) / (2 * hx), 1 - (0.5 + dot(q, Y) / (2 * hy))); });
      F([P0(1, -1, -1), P0(-1, -1, -1), P0(-1, 1, -1), P0(1, 1, -1)], mul(Zv, -1), so);
      F([P0(1, -1, 1), P0(1, -1, -1), P0(1, 1, -1), P0(1, 1, 1)], X, so);
      F([P0(-1, -1, -1), P0(-1, -1, 1), P0(-1, 1, 1), P0(-1, 1, -1)], mul(X, -1), so);
      F([P0(-1, 1, 1), P0(1, 1, 1), P0(1, 1, -1), P0(-1, 1, -1)], Y, so);
      F([P0(-1, -1, -1), P0(1, -1, -1), P0(1, -1, 1), P0(-1, -1, 1)], mul(Y, -1), so);
    };
    // a tube a -> b (radius r) in one colour of the atlas, with elbows left to the joints
    const tube = (a, b, r, reg, seg) => {
      const n = seg || 8, ax = nrm(sub(b, a)); let u = Math.abs(ax[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const e1 = nrm(crs(ax, u)), e2 = crs(e1, ax), uv = fv(reg, 0.5, 0.5);
      const ring = p => { const out = []; for (let k = 0; k <= n; k++) { const t = k / n * Math.PI * 2, d = add(mul(e1, Math.cos(t)), mul(e2, Math.sin(t))); out.push(fb.v(add(p, mul(d, r)), uv, d)); } return out; };
      const A = ring(a), B = ring(b); for (let k = 0; k < n; k++) fb.quad(A[k], A[k + 1], B[k + 1], B[k]);
    };
    const pipe = (pts, r, reg) => { for (let i = 0; i + 1 < pts.length; i++) tube(pts[i], pts[i + 1], r, reg); };
    const lens = (c, X, Y, hx, hy) => { const Zv = nrm(crs(X, Y)), P0 = (a, b) => add(add(add(c, mul(X, a * hx)), mul(Y, b * hy)), mul(Zv, 0.003));
      const ids = [P0(-1, -1), P0(1, -1), P0(1, 1), P0(-1, 1)].map((p, i) => bags.lamp.v(p, [i % 3 ? 1 : 0, i > 1 ? 1 : 0], Zv)); bags.lamp.quad(ids[0], ids[1], ids[2], ids[3]); };
    const lamp = (p, nrmv, k, range, col, spot) => lights.push({ x: p[0], y: p[1], z: p[2], nx: nrmv[0], ny: nrmv[1], nz: nrmv[2], col: col || [1.0, 0.86, 0.66], k, range, kind: spot ? 'flood' : 'facade' });   // a flood throws a cone (ny: its aim's drop)
    const Xp = [1, 0, 0], Yp = [0, 1, 0];
    // ---- THE SIGN over the door, on brackets off the header band (its centre the door's)
    {
      const yc = fy + DH + 1.75, w = 7.6, h = 1.42, z = HD + 0.2;
      obox([dC, yc, z], Xp, Yp, w / 2, h / 2, 0.03, 'signH', 'navy');
      if (L === 0) for (const dx of [-2.6, 0, 2.6]) for (const dy of [-0.45, 0.45]) member(bags.steel, [dC + dx, yc + dy, HD + 0.06], [dC + dx, yc + dy, z - 0.03], 'rod', Yp, L);
    }
    // ---- THE FLOODLIGHTS on the header, aimed down at the apron, their conduit along the header and down the tower
    const yF = fy + DH + 0.42, fx = [dC - 10.5, dC, dC + 10.5];
    for (const x of fx) {
      const tilt = 0.6, Yt = [0, Math.cos(tilt), Math.sin(tilt)], c = [x, yF, HD + 0.42];
      obox(c, Xp, Yt, 0.24, 0.17, 0.07, 'dark', 'dark');
      lens(add(c, mul(nrm(crs(Xp, Yt)), 0.072)), Xp, Yt, 0.2, 0.13);
      if (L === 0) { member(bags.steel, [x, yF + 0.12, HD + 0.08], [x, yF + 0.04, HD + 0.35], 'rod', Yp, L); }
      lamp(add(c, [0, -0.1, 0.12]), [0, -0.5, 0.86], 1.2, 30, [1.0, 0.93, 0.82], true);
    }
    if (L === 0) {
      const yc0 = fy + DH + 0.2, zc = HD + 0.12;
      pipe([[fx[0], yc0, zc], [xGR + 0.4, yc0, zc]], 0.016, 'grey');
      for (const x of fx) pipe([[x, yc0, zc], [x, yF + 0.12, zc]], 0.016, 'grey');
      pipe([[xGR + 0.4, yc0, zc], [xGR + 0.4, yc0, T0 + 0.03], [xGR + 0.4, fy + 1.45, T0 + 0.03]], 0.016, 'grey');
    }
    if (L === 0) {
      // ---- THE OFFICE ENTRANCE: the right tower's door (x 15.35 .. 16.55), a canopy, its lamp, its number, its plate
      const dx0 = D.xDo0, dx1 = D.xDo1, dxc = (dx0 + dx1) / 2, yC = fy + 2.62;
      obox([dxc, yC + 0.06, T0 + 0.55], Xp, Yp, 0.95, 0.06, 0.55, null, 'grey');                       // the canopy's deck
      obox([dxc, yC - 0.02, T0 + 1.09], Xp, Yp, 0.97, 0.12, 0.02, 'office', 'grey');                  // its fascia, the plate on it
      for (const sx of [-0.9, 0.9]) member(bags.steel, [dxc + sx, yC + 0.55, T0 + 0.02], [dxc + sx, yC + 0.1, T0 + 1.05], 'rod', Xp, L);   // the hangers
      obox([dxc, fy + 2.4, T0 + 0.025], Xp, Yp, 0.1, 0.1, 0.02, 'num1', 'white');                      // the door's number
      obox([dx0 - 0.28, fy + 2.15, T0 + 0.06], Xp, Yp, 0.09, 0.12, 0.06, 'dark', 'dark');            // the bulkhead
      lens([dx0 - 0.28, fy + 2.15, T0 + 0.121], Xp, Yp, 0.07, 0.09);
      lamp([dx0 - 0.28, fy + 2.15, T0 + 0.25], [0, 0, 1], 0.5, 9);
      obox([dx1 + 0.22, fy + 1.35, T0 + 0.02], Xp, Yp, 0.05, 0.08, 0.02, 'keypad', 'dark');          // the keypad
      obox([dx1 + 0.22, fy + 1.15, T0 + 0.11], Xp, Yp, 0.12, 0.3, 0.1, 'extinguisher', 'red');       // the extinguisher in its box
      obox([dx1 + 0.22, fy + 1.72, T0 + 0.01], Xp, Yp, 0.1, 0.1, 0.006, 'fire', 'red');
      // THE OFFICE'S FRONT, ON THE GROUND (the slab stops at the wall: outside, things stand on the ground, not at the floor)
      const gy = (x, z) => g(x, z) + (P.apron ? 0.06 : 0);
      // the step up to the door's sill, and a mat on it
      { const z0 = T0, z1 = T0 + 0.42, y0 = gy(dxc, z1);
        K.boxAB(bags.concWall, [dx0 - 0.3, y0 - 0.1, z0], [dx1 + 0.3, fy, z1]);
        obox([dxc, fy + 0.008, (z0 + z1) / 2], Xp, Yp, 0.5, 0.008, 0.16, null, 'mat'); }
      // the bench under the window, its back to the wall: two cast end frames (a leg fore and aft, an arm), three seat
      // slats, two back slats leaning back
      const bench = (cx, cz) => {
        const y0 = gy(cx, cz), Lh = 0.85, frame = (sx) => {
          const x = cx + sx;
          tube([x, y0, cz + 0.2], [x, y0 + 0.44, cz + 0.16], 0.022, 'dark', 6);            // the front leg
          tube([x, y0, cz - 0.2], [x, y0 + 0.44, cz - 0.17], 0.022, 'dark', 6);            // the back leg
          tube([x, y0 + 0.44, cz - 0.2], [x, y0 + 0.86, cz - 0.3], 0.022, 'dark', 6);      // the back's upright
          tube([x, y0 + 0.44, cz + 0.2], [x, y0 + 0.44, cz - 0.2], 0.02, 'dark', 6);       // the seat rail
          tube([x, y0 + 0.64, cz + 0.17], [x, y0 + 0.64, cz - 0.24], 0.018, 'dark', 6);    // the arm
          tube([x, y0 + 0.44, cz + 0.17], [x, y0 + 0.64, cz + 0.17], 0.018, 'dark', 6);
        };
        frame(-Lh); frame(Lh);
        for (let q = 0; q < 3; q++) obox([cx, y0 + 0.47, cz + 0.14 - q * 0.13], Xp, Yp, Lh + 0.08, 0.018, 0.055, 'wood', 'wood');
        const Yb = [0, 0.97, -0.24];
        for (let q = 0; q < 2; q++) obox([cx, y0 + 0.62 + q * 0.17, cz - 0.24 - q * 0.04], Xp, Yb, Lh + 0.08, 0.05, 0.016, 'wood', 'wood');
      };
      const bx = (dx1 + 1.8 + xO - 0.6) / 2;
      bench(bx, T0 + 0.42);
      // a round bin with its lid, and a planter with its shrub, right of the door
      { const x = dx1 + 0.75, z = T0 + 0.32, y0 = gy(x, z);
        tube([x, y0, z], [x, y0 + 0.78, z], 0.23, 'green', 14); tube([x, y0 + 0.78, z], [x, y0 + 0.86, z], 0.25, 'dark', 14);
        const top = fb.v([x, y0 + 0.86, z], fv('dark', 0.5, 0.5), Yp), ring = [];
        for (let k = 0; k <= 14; k++) { const a = k / 14 * Math.PI * 2; ring.push(fb.v([x + Math.cos(a) * 0.25, y0 + 0.86, z + Math.sin(a) * 0.25], fv('dark', 0.5, 0.5), Yp)); }
        for (let k = 0; k < 14; k++) fb.tri(top, ring[k + 1], ring[k]); }
      for (const x of [dx1 + 1.4]) {                                           // (left of the door the cabinet has the wall)
        const z = T0 + 0.33, y0 = gy(x, z);
        obox([x, y0 + 0.24, z], Xp, Yp, 0.24, 0.24, 0.24, 'planter', 'planter');
        obox([x, y0 + 0.47, z], Xp, Yp, 0.21, 0.01, 0.21, null, 'soil');
        weed(x, y0 + 0.47, z, 0.75, 2, 0.31); weed(x, y0 + 0.47, z, 0.55, 2, 0.77);
      }
      // the cabinet on its plinth, the meter box, the gas pipe from the ground into the wall (the front only)
      { const x = xGR + 0.5, z = T0 + 0.16, y0 = gy(x, z);
        K.boxAB(bags.concWall, [x - 0.38, y0 - 0.05, z - 0.2], [x + 0.38, y0 + 0.12, z + 0.2]);
        obox([x, y0 + 0.12 + 0.55, z], Xp, Yp, 0.32, 0.55, 0.15, 'cabinet', 'grey'); }
      { const x = HW - 0.55, y0 = gy(x, T0 + 0.1);
        obox([x, fy + 0.9, T0 + 0.13], Xp, Yp, 0.25, 0.3, 0.12, 'meter', 'grey');
        pipe([[x, y0 - 0.05, T0 + 0.07], [x, fy + 0.6, T0 + 0.07]], 0.024, 'yellow');
        pipe([[x + 0.18, fy + 1.2, T0 + 0.07], [x + 0.18, fy + 1.45, T0 + 0.07], [x + 0.18, fy + 1.45, T0 - 0.2]], 0.02, 'yellow'); }
      // the camera on the tower's corner, looking down the apron
      obox([HW - 0.1, towerTop - 0.45, T0 + 0.28], [0.8, 0, 0.6], [0, 0.94, -0.33], 0.07, 0.06, 0.15, 'dark', 'white');
      member(bags.steel, [HW - 0.1, towerTop - 0.35, T0 + 0.01], [HW - 0.1, towerTop - 0.4, T0 + 0.2], 'rod', Yp, L);
      // ---- THE FIRE POINT on the left facade's pier: the hose reel, the no-smoking sign, the fire sign; a lamp over
      const pc = -(xGL + HW) / 2;
      obox([pc, fy + 1.25, T0 + 0.11], Xp, Yp, 0.36, 0.36, 0.1, 'hose', 'red');
      obox([pc, fy + 1.9, T0 + 0.006], Xp, Yp, 0.13, 0.13, 0.005, 'fire', 'red');
      obox([pc, fy + 2.35, T0 + 0.006], Xp, Yp, 0.16, 0.16, 0.005, 'nosmoke', 'white');
      obox([pc, fy + 3.0, T0 + 0.06], Xp, Yp, 0.09, 0.12, 0.06, 'dark', 'dark'); lens([pc, fy + 3.0, T0 + 0.121], Xp, Yp, 0.07, 0.09); lamp([pc, fy + 3.0, T0 + 0.25], [0, 0, 1], 0.5, 9);
      // ---- HAZARD STRIPES up the opening's jambs (the towers' returns), to 1.5 m
      for (const [x, nx] of [[xGR - 0.151, -1], [-xGL + 0.151, 1]]) {
        const ids = [[x, fy + 0.02, HD + 0.02], [x, fy + 0.02, T0 - 0.02], [x, fy + 1.5, T0 - 0.02], [x, fy + 1.5, HD + 0.02]].map((p, i) => fb.v(p, fv('hazard', i === 1 || i === 2 ? 0.45 : 0, i > 1 ? 0.99 : 0.01), [nx, 0, 0]));
        if (nx > 0) fb.quad(ids[0], ids[1], ids[2], ids[3]); else fb.quad(ids[0], ids[3], ids[2], ids[1]);
      }
      // ---- THE HEAT PUMPS on the roof over the offices, on a level steel frame (the user: "refrain from putting anything
      // on the side ... there might be things just sticking next to this, like another hangar"), their pipes into the roof
      for (const zc of [HD - 6.5, HD - 9.0]) {
        const x0 = HW + 1.4, x1 = HW + 3.2, yb = yGR + 0.3, yf = yb + 0.12;              // the frame's deck on the gallery's flat roof
        for (const x of [x0, x1]) for (const dz of [-0.55, 0.55]) member(bags.steel, [x, yGR + 0.07, zc + dz], [x, yf, zc + dz], 'rod', Xp, L);
        for (const dz of [-0.55, 0.55]) member(bags.steel, [x0 - 0.05, yf, zc + dz], [x1 + 0.05, yf, zc + dz], 'chanS', Yp, L);
        obox([(x0 + x1) / 2, yf + 0.43, zc], [0, 0, 1], Yp, 0.45, 0.4, 0.17, 'acfront', 'white');   // the fan toward the front
        pipe([[(x0 + x1) / 2 + 0.3, yf + 0.2, zc - 0.2], [(x0 + x1) / 2 + 0.3, yf - 0.05, zc - 0.2], [x1 + 0.35, yf - 0.05, zc - 0.2], [x1 + 0.35, yGR + 0.05, zc - 0.2]], 0.028, 'white');
      }
      // ---- THE BACK, SEEN FROM THE ROAD (A0 9 Nov, the user's HOME layout: "the road curves BEHIND it ... design the BACK
      // and the sides to be seen too"): the HANGAR 1 board on the back gable, a bulkhead over either side of the glazed
      // leaves, the downpipes at the back corners off the eave gutters
      {
        const zb = -HD - 0.2, Xb = [-1, 0, 0];
        obox([0, fy + BH + 2.0, zb], Xb, Yp, 3.8, 0.71, 0.03, 'signH', 'navy');
        for (const dx of [-2.6, 0, 2.6]) for (const dy of [-0.45, 0.45]) member(bags.steel, [dx, fy + BH + 2.0 + dy, -HD + 0.02], [dx, fy + BH + 2.0 + dy, zb + 0.03], 'rod', Yp, L);
        for (const sx of [-1, 1]) {
          const x = sx * (BW / 2 + 0.7), c = [x, fy + BH + 0.35, zb];
          obox(c, Xb, Yp, 0.09, 0.12, 0.06, 'dark', 'dark');
          lens([x, fy + BH + 0.35, zb - 0.061], Xb, Yp, 0.07, 0.09);
          lamp([x, fy + BH + 0.35, zb - 0.25], [0, 0, -1], 0.5, 9);
        }
        for (const x of [-HW - 0.05, HW + 0.05]) pipe([[x, yR(HW) - 0.1, -HD + 0.35], [x, yR(HW) - 0.1, -HD - 0.05], [x, g(x, -HD) + 0.25, -HD - 0.05], [x + (x > 0 ? 0.2 : -0.2), g(x, -HD) + 0.08, -HD - 0.25]], 0.045, 'grey');
        if (gal(1)) pipe([[xO + 0.05, yGR + 0.25, -HD + 0.35], [xO + 0.05, yGR + 0.25, -HD - 0.05], [xO + 0.05, g(xO, -HD) + 0.25, -HD - 0.05], [xO + 0.25, g(xO, -HD) + 0.08, -HD - 0.25]], 0.045, 'grey');
      }
      // ---- THE APRON'S LEAD-IN LINE and the door's threshold stripe (yellow paint), when the build lays its apron
      if (P.apron) {
        const yl = (x, z) => g(x, z) + 0.069, line = (x0, z0, x1, z1, w) => { const d = nrm([x1 - x0, 0, z1 - z0]), nn = [-d[2], 0, d[0]];
          const q = [[x0 - nn[0] * w, z0 - nn[2] * w], [x1 - nn[0] * w, z1 - nn[2] * w], [x1 + nn[0] * w, z1 + nn[2] * w], [x0 + nn[0] * w, z0 + nn[2] * w]].map(([a, b]) => fb.v([a, yl(a, b), b], fv('yellow', 0.5, 0.5), Yp));
          fb.quad(q[0], q[3], q[2], q[1]); };
        line(dC, HD + 0.6, dC, HD + Math.min(P.apronL - 1, 24), 0.08);
        line(-xGL + 0.3, HD + 0.6, xGR - 0.3, HD + 0.6, 0.06);
      }
    }
    // ---- THE OFFICES LIT (P.offices: the garage room's - the user 9 Nov: "the lighting in the galleries will be most
    // important. Light some of the offices"): ceiling panels under both of the gallery's floors, glowing (the lamp bag:
    // no lamp, no shadow map), most bays on, a few dark; and a little furniture where the windows show it - a desk, its
    // chair, a cabinet, a plan chest - light on triangles, the rooms read lived in
    if (P.offices && L === 0) {
      const xm = (HW + xO) / 2, gw = GW, xG0 = HW;
      // (hung BELOW the window heads - 3.6 m and 7.55 m - or the hall never sees them: a lit office reads by its lamps)
      for (let k = 0; k < NB; k++) for (const [yc, lvl, yc0] of [[yGR - 0.72, 0, yGR - 0.15]]) {
        if (hashN(k, lvl, 141, seed) < 0.22) continue;                       // a dark office or two
        const zc = (zF(k) + zF(k + 1)) / 2;
        for (const dz of [-1.3, 1.3]) {
          const q = [[xm - 0.32, yc, zc + dz - 0.6], [xm + 0.32, yc, zc + dz - 0.6], [xm + 0.32, yc, zc + dz + 0.6], [xm - 0.32, yc, zc + dz + 0.6]];
          const ids = q.map((p, i) => bags.lamp.v(p, [i % 3 ? 1 : 0, i > 1 ? 1 : 0], [0, -1, 0])); bags.lamp.quad(ids[0], ids[3], ids[2], ids[1]);
          obox([xm, yc + 0.035, zc + dz], Xp, Yp, 0.36, 0.035, 0.64, null, 'white');  // the fitting's body
          for (const sx of [-0.3, 0.3]) tube([xm, yc + 0.07, zc + dz + sx * 1.6], [xm, yc0, zc + dz + sx * 1.6], 0.006, 'grey', 4);   // its hangers
        }
        if (hashN(k, lvl, 142, seed) < 0.55) {                              // the furniture
          const y0 = lvl ? yL2 : fy, z0 = zc - 1.1;
          obox([xG0 + gw * 0.42, y0 + 0.74, z0], Xp, Yp, 0.75, 0.02, 0.38, 'wood', 'wood');        // the desk's top
          for (const [ax, az] of [[-0.7, -0.33], [0.7, -0.33], [-0.7, 0.33], [0.7, 0.33]]) obox([xG0 + gw * 0.42 + ax, y0 + 0.36, z0 + az], Xp, Yp, 0.025, 0.36, 0.025, null, 'dark');
          obox([xG0 + gw * 0.42, y0 + 0.45, z0 - 0.75], Xp, Yp, 0.24, 0.04, 0.24, null, 'dark');   // the chair's seat
          obox([xG0 + gw * 0.42, y0 + 0.75, z0 - 0.97], Xp, Yp, 0.22, 0.28, 0.03, null, 'dark');   // its back
          obox([xG0 + gw * 0.42, y0 + 0.22, z0 - 0.75], Xp, Yp, 0.03, 0.22, 0.03, null, 'dark');   // its post
          obox([xO - 0.55, y0 + 0.66, zc + 1.6], Xp, Yp, 0.24, 0.66, 0.3, 'cabinet', 'grey');     // a cabinet by the wall
          if (!lvl) obox([xG0 + gw * 0.42, y0 + 0.45, zc + 1.3], Xp, Yp, 0.6, 0.45, 0.42, null, 'grey');   // a plan chest
        }
      }
    }
    // ---- THE FLUE: stainless, through the roof over the offices, a rain cap on it
    {
      const xf = gal(1) ? HW + 1.6 : HW - 2.6, zf = -2.0, yb = gal(1) ? yGR + 0.14 : yR(xf), top = yb + 3.0;
      K.cyl(bags.steel, [xf, yb - 0.1, zf], [0, 1, 0], 0.13, top - yb + 0.1, L === 0 ? 12 : 6, true, { smooth: true });
      if (L === 0) { K.cyl(bags.steel, [xf, yb - 0.02, zf], [0, 1, 0], 0.22, 0.12, 12, true); K.cyl(bags.steel, [xf, top + 0.12, zf], [0, 1, 0], 0.24, 0.04, 12, true); }
    }
    // ---- AT NIGHT the offices are lit: a warm card behind some of the right flank's and the tower's windows
    if (P.lamps && L === 0) {
      const F2 = frame([gal(1) ? xO : HW, 0, HD], [0, 0, -1], Yp), uOf = z => HD - z;
      for (let k = 0; k < NB; k++) for (const [ya, yb] of [[fy + 1.1, fy + 3.3]]) {
        if (hashN(k, Math.round(ya), 131, seed) > 0.55) continue;
        const u0 = Math.min(uOf(zF(k)), uOf(zF(k + 1))) + 0.6, u1 = Math.max(uOf(zF(k)), uOf(zF(k + 1))) - 0.6;
        const ids = [F2.P(u0, ya, -0.6), F2.P(u1, ya, -0.6), F2.P(u1, yb, -0.6), F2.P(u0, yb, -0.6)].map((p, i) => bags.lamp.v(p, [i % 3 ? 1 : 0, i > 1 ? 1 : 0], F2.N));
        bags.lamp.quad(ids[0], ids[1], ids[2], ids[3]);
      }
      const ids = [[D.xDo1 + 0.7, fy + 1.2, T0 - 0.5], [xO - 0.6, fy + 1.2, T0 - 0.5], [xO - 0.6, fy + 3.3, T0 - 0.5], [D.xDo1 + 0.7, fy + 3.3, T0 - 0.5]].map((p, i) => bags.lamp.v(p, [i % 3 ? 1 : 0, i > 1 ? 1 : 0], [0, 0, 1]));
      bags.lamp.quad(ids[0], ids[1], ids[2], ids[3]);
    }
  }

  // ===================================================================== THE GROUND SKIRT, THE BAKE, THE LEDGER
  const xR0 = gal(1) ? xO : HW, occ = [{ x: (xR0 - HW) / 2, z: 0, hx: (xR0 + HW) / 2 + 0.3, hz: HD + 0.3, k: 0.6, soft: 2.2, dry: true }];
  if (P.aoGround && HG.buildGroundAO) HG.buildGroundAO(bags.aoskirt, occ, g);
  // THE FAR BANDS FOLD BAGS (a draw each saved where the difference is under a pixel): the grey primer into the steel, the
  // white sheet into the pale, the slab into the concrete, the boards into the dark sheet; the dressing leaves
  for (const [from, to] of (FOLD[L] || [])) { if (to) bags[to].append(bags[from], {}); bags[from] = Bag(from); }
  const OUT = BAGS.concat(EXTRA);
  const aoInfo = P.ao > 0 ? K.bakeAO(OUT.filter(k => !NO_AO[k] && k !== 'aoskirt').map(k => bags[k]), { strength: P.ao, range: P.aoRange || 0.9, ground: g }) : null;
  let tris = 0, verts = 0; const per = {};
  const bb = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
  for (const k of OUT) {
    const d = bags[k].data(); per[k] = bags[k].tris; tris += bags[k].tris; verts += bags[k].verts;
    for (let i = 0; i < d.pos.length; i += 3) { const x = d.pos[i], y = d.pos[i + 1], z = d.pos[i + 2]; if (x < bb.x0) bb.x0 = x; if (x > bb.x1) bb.x1 = x; if (y < bb.y0) bb.y0 = y; if (y > bb.y1) bb.y1 = y; if (z < bb.z0) bb.z0 = z; if (z > bb.z1) bb.z1 = z; }
  }
  const draws = OUT.filter(k => bags[k].tris > 0).length;
  instances.truss.frames = instances.truss.z.length;
  const stats = Object.assign(st, {
    tris, verts, per, draws, bbox: bb, footprint: 4 * HW * HD, eave: fy + D.EAVE, ridge: fy + D.RIDGE, eaveY: fy + D.EAVE, ridgeY: fy + D.RIDGE, floorY: fy,
    stage, stageName: STAGES[stage], lod: L, shell: 'derelict', dims: { HW, HD, EAVE: D.EAVE }, role: 'hangar', source: 'derelict',
    // w: the CLEAR width an aeroplane passes (restored: what the stacked leaves leave; else the bare opening between the piers)
    door: { x: dC, z: HD, w: rest ? D.CLEAR : D.DOOR_W, opening: D.DOOR_W, clear: rest ? D.CLEAR : D.DOOR_W, h: D.DH, leaves: rest ? D.NL : 0, shut: rest && !(P.doorOpen > 0), open: !rest || P.doorOpen > 0, openK: rest ? clamp(P.doorOpen || 0, 0, 1) : 1 }, doors,
    galleries: { right: D.GW, left: D.GWL, outside: true, roof: yGR }, footprint: { x0: -HW, x1: gal(1) ? xO : HW, z0: -HD, z1: HD }, frames: NB + 1, bay: D.BAY, purlins: NPU * 2, instances,
    front: { x: 0, z: HD + 1.5, side: 1, depth: 0 },
    ground: g, groundAO: occ, aoFoot: null, ao: aoInfo, path: [], people: null, yard: null, pier: null,
    lit: { lights, panes: 0, windows: 0 }, smoke: null, sign: null,
  });
  return { bags, stats, P, V: { L: 2 * HW, w: 2 * HD, floorY: fy }, R: null, MAT: (F && F.MAT) || matsOrNull(), BAGS: OUT };
}

// THE RESTORED STAGE IS THE WORKS HANGAR ITSELF (HANGAR_GEN 'works hangar'): the same envelope, so nothing to reconcile
function worksP(P) {
  const H = HN();
  return Object.assign({}, H.DEF, H.PRESETS['works hangar'], { seed: P.seed, floorY: P.floorY, slopeX: P.slopeX, slopeZ: P.slopeZ, ground: P.ground,
                                                               HW: P.HW, HD: P.HD, EAVE: P.EAVE, ao: P.ao, aoGround: P.aoGround });
}
function restored(P, lod, F) {
  const H = HN();
  if (!H) throw new Error('DERELICT_GEN: the restored stage needs HANGAR_GEN (tools/_hangar_gen.js)');
  const out = H.build(worksP(P), lod, F && F.hn);
  out.stats.stage = 3; out.stats.stageName = STAGES[3];
  out.stats.draws = out.BAGS.filter(k => out.bags[k] && out.bags[k].tris > 0).length;
  return out;
}

// ---- THE MATERIALS (MATLIB's, scoped; dressed from the libraries the hangar and the house already load) ----------------
const TEXC = new Map();
function libOf(lib) {
  if (lib === 'site') return (typeof SITE_TEX_SETS !== 'undefined' && SITE_TEX_SETS) || null;   // the ground library's site view (ground_tex.js)
  return lib === 'hangar' ? ((typeof HANGAR_WALL_SETS !== 'undefined' && HANGAR_WALL_SETS) || null) : (HG.libSets ? HG.libSets() : null);
}
function texOf(lib, key, mapName) {
  const S = libOf(lib), set = S && S[key];
  if (!set) return null;
  const img = set[mapName];
  if (!img) return null;
  if (Array.isArray(img)) return typeof TEX_FLAT === 'function' ? TEX_FLAT(img, mapName === 'diff' ? THREE.SRGBColorSpace : '') : null;
  const ck = lib + '|' + key + '|' + mapName;
  if (TEXC.has(ck)) return TEXC.get(ck);
  const t = new THREE.Texture(img);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (mapName === 'diff') t.colorSpace = THREE.SRGBColorSpace;
  const tile = lib === 'hangar' ? 2 : (set.tile || 2);
  t.repeat.set(1 / tile, 1 / tile);
  const ok = () => { t.needsUpdate = true; };
  if (img.complete && img.naturalWidth) ok(); else if (img.addEventListener) img.addEventListener('load', ok);
  TEXC.set(ck, t);
  return t;
}
// role -> [lib, set, tint, metalness, normalScale]
// THE ALBEDO IS CALIBRATED, NOT GUESSED (the user 9 Nov: "the ground surface often reads as black in your screenshots, why
// is that?" - measured: the floor's scan averages 0.11 linear, a third of real concrete, and a hand gain of 1.5 left it
// at 0.18; with the map off the floor read 126/255 against 38). A scanned diffuse is not an albedo: each set's mean is
// measured off its own pixels when it lands (albedoOf) and the colour is set so the MEAN reaches the material's real
// value, the scan keeping its own variation. The hue is a luminance-1 tint over the scan's own colour.
// role -> [lib, set, target albedo (linear luminance), hue [r, g, b], metalness, normalScale]
// targets (linear): weathered concrete 0.25-0.35, pale cast concrete 0.35-0.45, rust 0.10-0.15, worn galvanised and
// pale painted sheet 0.35-0.45, white paint 0.55-0.7, dark weathered sheet ~0.08, grey timber 0.25-0.3
const DRESS = {
  steel:      ['house', 'rust', 0.12, [1.45, 0.82, 0.62], 0.3, 0.9],       // red-oxide primer gone to rust (an isotropic scan: a streaked one barber-poles a 70 mm member)
  steelNew:   ['house', 'steelgrey', 0.30, [0.98, 1.0, 1.03], 0.4, 0.6],   // the grey primer of the made-safe stage
  sheetPale:  ['house', 'corrworn', 0.40, [1.03, 1.0, 0.95], 0.45, 0.45],  // the pale, streaked header band
  sheetDark:  ['house', 'corrworn', 0.085, [1.12, 0.98, 0.86], 0.4, 0.45], // the dark eave sheets
  sheetWhite: ['house', 'steelgrey', 0.58, [1.0, 1.0, 0.98], 0.15, 0.5],   // the white-painted inner wall
  sheetNew:   ['house', 'galv', 0.45, [0.98, 1.0, 1.02], 0.6, 0.4],        // the new roof
  concFloor:  ['site', 'cracked', 0.27, [0.95, 1.0, 1.08], 0, 1.0],        // worn, dusty, cracked (the photos' apron and slab): the brown scan pulled to grey
  concWall:   ['hangar', 'concrete008', 0.40, [1.02, 1.0, 0.96], 0, 1.0],
  ply:        ['house', 'greywood', 0.28, [1.06, 1.0, 0.9], 0, 0.8],
};
// THE RESTORED HANGAR'S DRESS (stage 3): the same bags, new finishes - the steel painted a mid grey, every sheet new
// (a pale grey-green painted profile, the WWII depot colour gone to its post-war repaint), the inner walls white, a
// clean brushed slab; the glass clear (applyFinish)
const DRESS_R = {
  steel:      ['house', 'galv', 0.22, [0.96, 1.0, 1.04], 0.35, 0.3],
  sheetPale:  ['house', 'galv', 0.42, [0.93, 1.0, 0.95], 0.5, 0.35],
  sheetDark:  ['house', 'galv', 0.42, [0.93, 1.0, 0.95], 0.5, 0.35],
  sheetWhite: ['house', 'galv', 0.62, [1.0, 1.0, 0.99], 0.15, 0.3],
  concFloor:  ['site', 'brushed', 0.3, [0.97, 1.0, 1.05], 0, 0.8],
};
// the mean linear luminance of an image (32 x 32, sRGB decoded per pixel), once per image
const ALB = new WeakMap();
const s2l = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
function albedoOf(img) {
  if (!img) return null;
  if (Array.isArray(img)) return 0.2126 * s2l(img[0] / 255) + 0.7152 * s2l(img[1] / 255) + 0.0722 * s2l(img[2] / 255);
  if (ALB.has(img)) return ALB.get(img);
  if (!(img.complete && img.naturalWidth) || typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0, 32, 32);
  let px; try { px = g.getImageData(0, 0, 32, 32).data; } catch (e) { return null; }
  let sum = 0; for (let i = 0; i < px.length; i += 4) sum += 0.2126 * s2l(px[i] / 255) + 0.7152 * s2l(px[i + 1] / 255) + 0.0722 * s2l(px[i + 2] / 255);
  const a = sum / (px.length / 4); ALB.set(img, a); return a;
}
// set m.color so the map's mean reaches `target` (now, or when the image lands); `then` runs after
function calibrate(m, img, target, hue, then) {
  const hl = 0.2126 * hue[0] + 0.7152 * hue[1] + 0.0722 * hue[2];
  const set = () => { const a = albedoOf(img) || 0.18; const k = target / a / hl; m.color.setRGB(hue[0] * k, hue[1] * k, hue[2] * k); if (then) then(); };
  if (!img || Array.isArray(img) || (img.complete && img.naturalWidth)) set();
  else { m.color.setRGB(hue[0] * target / 0.18 / hl, hue[1] * target / 0.18 / hl, hue[2] * target / 0.18 / hl); if (img.addEventListener) img.addEventListener('load', set, { once: true }); }
}
let MATS = null;
function matsOrNull() { return MATS; }
// a finish's materials are its own (`tag`: the room's, the world's): the house shader's uniforms (the dirt line lifted by
// where the building stands) live on the finish, and a material shared by two finishes would take the first's alone
function makeMats(tag) {
  if (typeof MATLIB === 'undefined' || typeof THREE === 'undefined' || !THREE.MeshStandardMaterial) return null;
  const sh = (k, shape, p) => MATLIB.shared(THREE, shape, p, 'derelict:' + (tag ? tag + ':' : '') + k);
  const side2 = THREE.DoubleSide;
  const M = {};
  for (const k of ['steel', 'steelNew', 'concFloor', 'concWall', 'ply']) M[k] = sh(k, 'std', { color: 0xa09080, roughness: 0.9, metalness: 0 });
  for (const k of ['sheetPale', 'sheetDark', 'sheetWhite', 'sheetNew']) M[k] = sh(k, 'std', { color: 0x9a9a9a, roughness: 0.8, metalness: 0.3, side: side2 });
  M.glass = sh('glass', 'glass', { color: 0xaeb9b6, roughness: 0.3, metalness: 0, opacity: 0.4, side: side2, depthWrite: false });
  M.water = sh('water', 'std', { color: 0x4a4a4a, roughness: 0.04, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  M.decal = sh('decal', 'cut', { color: 0xffffff, roughness: 0.85, metalness: 0, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, side: side2 });
  M.stain = sh('stain', 'glass', { color: 0xffffff, roughness: 0.95, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  M.weed = sh('weed', 'cut', { color: 0xffffff, roughness: 0.9, metalness: 0, alphaTest: 0.42 });
  M.plastic = sh('plastic', 'std', { color: 0xffffff, roughness: 1, metalness: 0 });
  M.fit = sh('fit', 'std', { color: 0xffffff, roughness: 0.55, metalness: 0.1 });
  M.lamp = sh('lamp', 'glow', { color: 0xd88a2a, roughness: 0.25, metalness: 0, emissive: 0xff9a26, emissiveIntensity: 0 });
  const HF = HG.makeFinish ? HG.makeFinish() : null;
  M.aoskirt = HF && HF.MAT ? HF.MAT.aoskirt : null;
  return M;
}
// THE PUDDLE IS WET CONCRETE UNDER A WATER SURFACE (the user 9 Nov: "Is the water shader for the puddle appropriate,
// maintainable and accurate?" - it was not: an opaque near-black sheet that hid the slab, and a bench hook that forced
// a 35 % mirror at every angle over the whole lit colour). A puddle a few millimetres deep is two things, both of which
// a standard PBR material already draws correctly: the bed seen through the water - the slab's own map, its albedo
// darkened by the water filling the pores (x 0.45 at standing water, the wet-film law pavement.js keeps at x 0.62 for a
// film) and a little more saturated - and the water's surface: roughness 0.04, a dielectric whose reflection three's
// own Fresnel weights (F0 0.04, water's is 0.02: near enough at grazing, where it matters). No second water system:
// water.js is the bodies' (depth, waves, foam); a film on a slab is a material. The bench's mirror (tools/_derelict.html)
// replaces only the environment's RADIANCE in the specular term, under the same Fresnel.
const WET_DARK = 0.45, WET_SAT = 1.15;
function wetFrom(M) {
  if (!M || !M.water || !M.concFloor) return;
  const w = M.water, f = M.concFloor, c = f.color, l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  w.map = f.map; w.normalMap = null; w.roughnessMap = null; w.roughness = 0.04; w.metalness = 0;
  w.color.setRGB((l + (c.r - l) * WET_SAT) * WET_DARK, (l + (c.g - l) * WET_SAT) * WET_DARK, (l + (c.b - l) * WET_SAT) * WET_DARK);
  w.needsUpdate = true;
}
function makeFinish(tag) { const M = makeMats(tag); return { MAT: M, SHADE_U: HG.makeShadeU(), hn: HN() && HN().makeFinish ? HN().makeFinish() : null }; }
let DEFAULT_FINISH = null;
function defaultFinish() { if (!DEFAULT_FINISH) { DEFAULT_FINISH = makeFinish(); MATS = DEFAULT_FINISH.MAT; } return DEFAULT_FINISH; }
function applyFinish(P0, F0) {
  const P = Object.assign({}, DEF, P0 || {});
  const F = F0 || defaultFinish();
  if ((P.stage | 0) >= 3 && P.legacy) { const H = HN(); if (H && F.hn) H.applyFinish(worksP(P), F.hn); return F; }
  const M = F.MAT; if (!M) return F;
  const SU = F.SHADE_U;
  for (const k in DRESS) {
    const m = M[k]; if (!m) continue;
    const [lib, key, target, hue, metal, ns] = ((P.stage | 0) === 3 && DRESS_R[k]) || DRESS[k];
    const d = texOf(lib, key, 'diff');
    if (d) { m.map = d; m.normalMap = texOf(lib, key, 'nor') || texOf(lib, key, 'nor_gl'); m.roughnessMap = texOf(lib, key, 'rough'); m.roughness = 1; }
    const S0 = libOf(lib), img = S0 && S0[key] ? S0[key].diff : null;
    calibrate(m, img, target, hue, k === 'concFloor' ? () => wetFrom(M) : null);
    m.metalness = metal; if (m.normalScale) m.normalScale.set(ns, ns);
    if (HG.shadeHouse && !(m.userData && m.userData.houseShaded)) HG.shadeHouse(m, SU);
    if (HG.cloudWeather && /^(sheet|concWall)/.test(k)) HG.cloudWeather(m, k === 'sheetNew' || (P.stage | 0) === 3 ? 0.08 : 0.55, 0);   // (the user: the restored "still very dirty" - a little weathering, no more)
    m.needsUpdate = true;
  }
  if (!ATLAS.decal) { const c = decalCanvas(); if (c) { ATLAS.decal = new THREE.CanvasTexture(c); ATLAS.decal.colorSpace = THREE.SRGBColorSpace; ATLAS.decal.anisotropy = 8; } }
  if (!ATLAS.weed) { const c = weedCanvas(); if (c) { ATLAS.weed = new THREE.CanvasTexture(c); ATLAS.weed.colorSpace = THREE.SRGBColorSpace; ATLAS.weed.anisotropy = 8; } }
  if (ATLAS.decal) { M.decal.map = ATLAS.decal; M.stain.map = ATLAS.decal; M.decal.needsUpdate = M.stain.needsUpdate = true; }
  if (ATLAS.weed) { M.weed.map = ATLAS.weed; M.weed.needsUpdate = true; }
  if (!ATLAS.barrier) { const B = barrierCanvas(); if (B) { const tx = (cv, srgb) => { const t = new THREE.CanvasTexture(cv); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
    ATLAS.barrier = { diff: tx(B.diff, true), rough: tx(B.rough), nor: tx(B.nor) }; } }
  if (!ATLAS.fit) { const c = fitCanvas(); if (c) { ATLAS.fit = new THREE.CanvasTexture(c); ATLAS.fit.colorSpace = THREE.SRGBColorSpace; ATLAS.fit.anisotropy = 8; } }
  if (ATLAS.fit && M.fit) { M.fit.map = ATLAS.fit; M.fit.needsUpdate = true; }
  if (ATLAS.barrier && M.plastic) {
    const m = M.plastic; m.map = ATLAS.barrier.diff; m.roughnessMap = ATLAS.barrier.rough; m.normalMap = ATLAS.barrier.nor; m.normalScale.set(0.7, 0.7); m.color.setHex(0xffffff); m.roughness = 1;
    m.needsUpdate = true;   // (no house finish on it: its sheet carries its own grime and the house's hook re-reads the map)
  }
  // the glass: milky and broken in the derelict, clear and new restored
  if (M.glass) { const r = (P.stage | 0) === 3; M.glass.color.setHex(r ? 0x8fa3a8 : 0xaeb9b6); M.glass.opacity = r ? 0.32 : 0.4; M.glass.roughness = r ? 0.06 : 0.3; M.glass.needsUpdate = true; }
  // the lamps (the buoys' rule: off unless asked - P.lamps, the night's): an amber lens, its glow an exposed level
  if (M.lamp) { const r3 = (P.stage | 0) === 3; M.lamp.emissiveIntensity = P.lamps ? (r3 ? 1.6 : 2.2) : 0; M.lamp.emissive.setHex(r3 ? 0xfff0d8 : 0xff9a26); M.lamp.color.setHex(P.lamps ? (r3 ? 0xfff6e8 : 0xffb050) : 0xc88a3a); M.lamp.needsUpdate = true; }
  // the dirt ramp off the slab (the house's): the dark tide line on the concrete, rust-brown splash on the sheets
  if (SU) {
    const R3 = (P.stage | 0) === 3;
    SU.uDirtTop.value = P.floorY + (R3 ? 0.5 : 0.9); SU.uDirtH.value = R3 ? 0.7 : 1.1; SU.uDirtK.value = R3 ? 0.22 : 0.6; SU.uNoiseK.value = 0.2; SU.uAOd.value = 0.4; SU.uSag.value = 0;
    for (const k in DRESS) { const D2 = M[k] && M[k].userData && M[k].userData.dirt; if (!D2) continue;
      D2.uDirtGain.value = k === 'concFloor' ? 0 : (k === 'concWall' ? 1.5 : (k === 'sheetNew' ? 0.3 : 1.0));   // (a floor is not a wall: no splash line) D2.uDirtOwn.value.setHex(/^conc/.test(k) ? 0x3d382f : 0x5a4232); D2.uWander.value = 0;
      D2.uAgeDesat.value = /^(steel|sheetPale|sheetDark)$/.test(k) ? 0.2 : 0; D2.uAgeDark.value = k === 'steel' ? 0.12 : 0; }
  }
  return F;
}
function finishReport() {
  const M = (DEFAULT_FINISH && DEFAULT_FINISH.MAT) || {};
  return BAGS.map(k => ({ slot: k, map: !!(M[k] && M[k].map), nor: !!(M[k] && M[k].normalMap), rough: !!(M[k] && M[k].roughnessMap) }));
}

window.DERELICT_GEN = {
  LOD_DETAIL: /^(glass|water|ply)$/,
  DEF, ROWS, PRESETS, STAGES, BAGS, EXTRA, dimsOf, build, applyFinish, makeFinish, finishReport, worksP,
  atlasCanvas: { decal: decalCanvas, weed: weedCanvas, barrier: barrierCanvas, fit: fitCanvas }, BARRIER, barrierMesh, corrugation: { PITCH, CREST, AMP },
  get MAT() { return defaultFinish().MAT; },
  albedoOf, calibrate, DRESS, WET: { dark: WET_DARK, sat: WET_SAT },
};
// THE CATALOGUE: one building, its stage a dial (the story's), its door hook toward the apron - the works' own entry
window.DERELICT_GEN.CATALOGUE_V = 1;
window.DERELICT_GEN.CATALOGUE_ALIASES = {};
window.DERELICT_GEN.CATALOGUE = ['derelict hangar'].map(name => {
  const Pd = Object.assign({}, DEF, PRESETS[name]);
  const rect = (HW, HD) => [[-HW - 1, -HD - 1], [HW + 1, -HD - 1], [HW + 1, HD + 1], [-HW - 1, HD + 1]];
  return { key: 'hangar/' + name, kind: 'building', gen: 'DERELICT_GEN', preset: name, P: Object.assign({}, Pd), frame: 'house',
    foot: P => rect((P && P.HW) || Pd.HW, (P && P.HD) || Pd.HD), keepOut: 4,
    ground: { need: 'level', level: 'high', falloff: 8, standing: 'slab' },
    size: P => ({ L: 2 * ((P && P.HW) || Pd.HW) + 2, w: 2 * ((P && P.HD) || Pd.HD) + 2 }),
    hooks: P => [{ name: 'door', kind: 'apron', p: [dimsOf(Object.assign({}, Pd, P || {})).doorX, 0, ((P && P.HD) || Pd.HD) + 2], dir: [0, 0, 1] }], hooksOf: () => [],   // the door is off the axis (the facade side)
    lod: { dist: [0, 200, 600, 1500] }, slots: { ao: 'stats.groundAO' },
    tags: ['airport', 'hangar', 'derelict', 'story'], role: 'hangar', cat: 'airport m', headless: true, gate: 'DERELICT' };
});
})();
