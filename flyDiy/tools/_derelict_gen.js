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
  HW: 20, HD: 20, EAVE: 9.5, floorY: 0.25, slopeX: 0, slopeZ: 0,   // the works hangar's envelope (HANGAR_GEN PRESETS)
  decay: 0.8,      // how far gone the derelict is: 0 a sound shell with its cladding, 1 a skeleton
  wet: 0.65,       // the slab after rain (stages 0-1; the roofed slab dries): 0 dry .. 1 a sheet of water
  gallery: 5.5, bay: 5,
  graffiti: 1, barriers: 1, weeds: 1, litter: 1, rubble: 1,
  apron: 0, apronL: 26,   // the build's own cracked apron (the premises' pavement draws it in game)
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
    ['gallery', 'gallery depth', 3.5, 7, 0.25], ['bay', 'frame spacing', 4, 6.5, 0.25], ['floorY', 'slab above datum', 0, 1.2, 0.05],
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
              'glass', 'water', 'decal', 'stain', 'weed', 'plastic', 'ply'];
const EXTRA = ['aoskirt'];
const FOLD = [null,
  [['steelNew', 'steel'], ['decal', null], ['stain', null], ['plastic', null], ['weed', null]],
  [['steelNew', 'steel'], ['sheetWhite', 'sheetPale'], ['concFloor', 'concWall'], ['ply', 'sheetDark'], ['glass', null], ['water', null],
   ['decal', null], ['stain', null], ['plastic', null], ['weed', null]]];
const NO_AO = { glass: 1, water: 1, decal: 1, stain: 1, weed: 1 };   // flat or cut: no voxels of their own in the bake

// ---- the numbers ----------------------------------------------------------------------------------------------------------
function dimsOf(P) {
  const HW = P.HW, HD = P.HD, fy = P.floorY, EAVE = P.EAVE, RIDGE = EAVE + 2.6, tp = 2.6 / HW;
  const yR = x => fy + EAVE + (HW - Math.min(HW, Math.abs(x))) * tp;   // the roof's top (the sheet) over x
  const yTC = x => yR(x) - 0.32;                                        // the truss's top chord, under the purlins
  const GW = clamp(P.gallery, 3, HW * 0.4), xG = HW - GW;
  const yL2 = fy + 4.0, yGR = fy + 8.0, yBC = fy + EAVE - 1.0;
  const NB = Math.max(4, Math.round(2 * HD / P.bay)), BAY = 2 * HD / NB;
  const zF = k => -HD + k * BAY;
  const DH = Math.min(6.4, EAVE - 1.4);                                  // the works' door head
  const BW = Math.min(16, 2 * xG - 4), BH = Math.min(5.2, EAVE - 3);
  const xC = HW - 0.45;                                                  // the main columns' line, inboard of the stem wall
  const xe = xC - 0.19;                                                  // the truss's ends, at the columns' inner flange
  const slopeLen = Math.hypot(HW, 2.6);
  return { HW, HD, fy, EAVE, RIDGE, tp, yR, yTC, GW, xG, yL2, yGR, yBC, NB, BAY, zF, DH, BW, BH, xC, xe, slopeLen,
           DOOR_W: 2 * xG, NP: 16, NPU: Math.max(6, Math.round(slopeLen / 1.55) + 1) };
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
const ATLAS = { decal: null, weed: null };
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

// ---- the build ------------------------------------------------------------------------------------------------------------
function build(P0, lod, F) {
  const P = Object.assign({}, DEF, P0 || {});
  const stage = clamp(Math.round(P.stage || 0), 0, 3);
  if (stage === 3) return restored(P, lod, F);
  const L = clamp(lod | 0, 0, 2);
  const D = dimsOf(P);
  const { HW, HD, fy, yR, yTC, xG, yL2, yGR, yBC, NB, zF, DH, BW, BH, xC, xe } = D;
  const bags = {};
  for (const k of BAGS.concat(EXTRA)) bags[k] = Bag(k);
  const g = HG.groundFn(P);
  const seed = P.seed | 0, decay = clamp(P.decay, 0, 1);
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
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x0 = -HW + 2 * HW * i / nx, x1 = -HW + 2 * HW * (i + 1) / nx, z0 = -HD + 2 * HD * j / nz, z1 = -HD + 2 * HD * (j + 1) / nz;
      face(b, [[x0, fy, z1], [x1, fy, z1], [x1, fy, z0], [x0, fy, z0]], Yup, uvFrame([0, fy, 0], [1, 0, 0], [0, 0, -1]));
    }
    // the slab's edge, down into the ground (the foundation the works shell stands on, G405.1's ring)
    for (const [A, B] of [[[-HW, HD], [HW, HD]], [[HW, HD], [HW, -HD]], [[HW, -HD], [-HW, -HD]], [[-HW, -HD], [-HW, HD]]])
      K.wall(bags.concWall, { A, B, y0: gLo - 0.35, t: 0.3, topAt: () => fy, ext: [0.15, 0.15], inner: false, endCap: [false, false], capBot: false, capTop: true, sub: L === 0 ? 4 : 0 });
    // the column piers (a concrete pedestal 0.3 m proud of the slab under every column)
    const pier = (x, z) => K.boxAB(bags.concWall, [x - 0.34, fy - 0.02, z - 0.34], [x + 0.34, fy + 0.3, z + 0.34], { ny: true });
    for (let k = 0; k <= NB; k++) {
      const z = clamp(zF(k), -HD + 0.35, HD - 0.35);
      for (const s of [-1, 1]) { pier(s * xC, z); pier(s * xG, z); }
    }
    if (P.apron) {
      // THE APRON: worn concrete bays (5 m), its joints the stain bag's, weeds in them (below)
      const zA0 = HD + 0.15, zA1 = HD + P.apronL, xA = HW + 6, ya = (x, z) => g(x, z) + 0.06;
      const ca = L === 0 ? 2.5 : 10, nax = Math.round(2 * xA / ca), naz = Math.max(1, Math.round((zA1 - zA0) / ca));
      for (let i = 0; i < nax; i++) for (let j = 0; j < naz; j++) {
        const x0 = -xA + 2 * xA * i / nax, x1 = -xA + 2 * xA * (i + 1) / nax, z0 = zA0 + (zA1 - zA0) * j / naz, z1 = zA0 + (zA1 - zA0) * (j + 1) / naz;
        face(b, [[x0, ya(x0, z1), z1], [x1, ya(x1, z1), z1], [x1, ya(x1, z0), z0], [x0, ya(x0, z0), z0]], Yup, uvFrame([0, 0, 0], [1, 0, 0], [0, 0, -1]));
      }
      if (L === 0) {                                                       // its joints and its cracks, its oil
        const ra = rng(seed * 19 + 2), yl = (x, z) => ya(x, z) + 0.004;
        const jl = (a, b, w) => { const d2 = nrm(sub(b, a)), nn = [-d2[2], 0, d2[0]], q = [add(a, mul(nn, -w)), add(b, mul(nn, -w)), add(b, mul(nn, w)), add(a, mul(nn, w))].map(p => [p[0], yl(p[0], p[2]), p[2]]);
          face(bags.stain, q, Yup, p => { const r0 = sub(p, a); return CELL(15, dot(r0, d2) / Math.max(0.01, len(sub(b, a))), (dot(r0, nn) + w) / (2 * w)); }); };
        for (let x = -xA + 2.5; x < xA; x += 5) jl([x, 0, zA0], [x, 0, zA1], 0.05);
        for (let z = zA0 + 5; z < zA1; z += 5) jl([-xA, 0, z], [xA, 0, z], 0.05);
        for (let c = 0; c < 26; c++) { let x = (ra() * 2 - 1) * xA, z = zA0 + ra() * (zA1 - zA0), a = ra() * 6.28;
          for (let q = 0; q < 8 + ra() * 10; q++) { a += (ra() - 0.5) * 0.9; const x2 = x + Math.cos(a) * 0.7, z2 = z + Math.sin(a) * 0.7; jl([x, 0, z], [x2, 0, z2], 0.02 + ra() * 0.025); x = x2; z = z2; } }
        for (let q = 0; q < 9; q++) { const x = (ra() * 2 - 1) * (xA - 3), z = zA0 + 2 + ra() * Math.min(30, zA1 - zA0 - 4), r = 0.5 + ra() * 1.1, c = q < 6 ? 11 : 12;
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
    if (k === 0 || k === NB) return out;
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
    const pH = 0.035 * decay * (region.hang || 1), pB = 0.1 * decay * (region.bend || 1), pT = 0.07 * decay;
    if (der) {
      if (r2 < pH) return { k: 'hang', a };
      if (r2 < pH + pB) return { k: 'bent', a };
      if (r2 < pH + pB + pT) return { k: 'torn', a };
    } else if (r2 < pH + pB) return { k: 'gone' };   // made safe: the loose ones came down
    return { k: 'ok', a };
  };
  const streak = (F, u0, w, vTop, d, len, cell, prob, r) => {
    if (L > 0 || r > prob) return;
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
  const pick = (main, alt, pAlt) => (p, a) => (hp(p, 51, seed) < pAlt ? bags[alt] : bags[main]);

  // ===================================================================== THE FRONT: towers, header girder, the gable band
  const FR = frame([0, 0, HD], [1, 0, 0], Yup);                  // the front's face plane (outside +z)
  const zT = 0.3;                                                 // the towers stand proud of the gable
  const towerTop = yGR + 0.85;
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
      const keep = rg.keep !== undefined ? rg.keep : 0.05 + 0.3 * (1 - decay);
      if (r < keep) {                                                     // a milky pane left whole (or cracked)
        face(bags.glass, [P2(a0, b0, -0.01), P2(a1, b0, -0.01), P2(a1, b1, -0.01), P2(a0, b1, -0.01)], F2.N, uvFrame(P2(a0, b0), F2.X, F2.Y));
        st.panesMilky++; continue;
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
    const A = s > 0 ? [xG - 0.15, HD + zT] : [-HW - 0.15, HD + zT], B = s > 0 ? [HW + 0.15, HD + zT] : [-xG + 0.15, HD + zT];
    const Lw = B[0] - A[0];
    const dS = s > 0 ? 1.0 : Lw - 2.2;                                   // the ground-floor door, toward the opening
    const holes = [{ s0: dS, s1: dS + 1.2, y0: fy, y1: fy + 2.3 },
                   { s0: s > 0 ? 2.7 : 0.8, s1: s > 0 ? Lw - 0.8 : Lw - 2.7, y0: fy + 1.2, y1: fy + 3.3 },
                   { s0: 0.8, s1: Lw - 0.8, y0: yL2 + 0.8, y1: yGR - 0.5 }];
    const wins = [{ s0: holes[1].s0, s1: holes[1].s1, y0: holes[1].y0, y1: holes[1].y1, cols: 4, rows: 4 },
                  { s0: holes[2].s0, s1: holes[2].s1, y0: holes[2].y0, y1: holes[2].y1, cols: 8, rows: 5 }];
    towerFace(A, B, fy, towerTop, holes, wins);
    // the tower's return beside the opening (the reveal of the big door, solid concrete up to the tower's head)
    const xR = s * xG;
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
    member(bags.steel, [-xG, yb, zH], [xG, yb, zH], 'hchord', Z, L, -1);
    if (L < 2) for (let i = 0; i <= np; i++) {
      const x = -xG + 2 * xG * i / np;
      member(bags.steel, [x, yb + 0.1, zH], [x, yt - 0.08, zH], 'web', Z, L);
      if (i < np) { const x1 = -xG + 2 * xG * (i + 1) / np; if (i < np / 2) member(bags.steel, [x, yt - 0.08, zH], [x1, yb + 0.1, zH], 'web', Z, L); else member(bags.steel, [x, yb + 0.1, zH], [x1, yt - 0.08, zH], 'web', Z, L); }
    }
    // the gable over the header: posts at the panel points up to the frame's top chord, girts every ~1.6 m
    if (L < 2) for (let i = 1; i < np; i++) { const x = -xG + 2 * xG * i / np; member(bags.steel, [x, yBC, zH - 0.0], [x, yTC(x) - 0.06, zH], 'chanS', [0, 0, 1], L); }
    for (let y = yBC + 1.0; y < yR(0) - 0.6; y += 1.6) {
      const xs = HW - (y - (fy + D.EAVE)) / D.tp;                       // where this girt meets the rake
      const xm = Math.min(HW - 0.2, xs - 0.2);
      if (xm > 0.5) member(bags.steel, [-xm, y, zH + 0.12], [xm, y, zH + 0.12], 'chanS', [0, 0, 1], L);
    }
    // the door's top track, under the girder, and its floor rail (bent and broken in the derelict)
    member(bags.steel, [-xG - 0.2, fy + DH - 0.05, HD - 0.05], [xG + 0.2, fy + DH - 0.05, HD - 0.05], 'chanS', [0, 0, 1], L);
    if (L < 2) {
      const segs = 8;
      for (let i = 0; i < segs; i++) {
        const x0 = -xG + 2 * xG * i / segs + 0.05, x1 = -xG + 2 * xG * (i + 1) / segs - 0.05;
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
      gone: (p, n, ri, nr) => (0.04 + 0.32 * n * n + (ri === nr - 1 ? 0.18 : 0) + (Math.abs(p[0]) > xG - 2 ? 0.08 : 0)) * decay,
      bend: 1.4, hang: 0.6, streaks: 0.9,
    };
    // in vertical strips so the top follows the rake (each strip clipped to its own roof line)
    const dz = 0.06;
    cladGable(FR, -xG - 0.1, xG + 0.1, fy + DH - 0.2, u => top(u), dz, reg);
    for (const s of [-1, 1]) { const xa = s > 0 ? xG + 0.1 : -HW - 0.05, xb = s > 0 ? HW + 0.05 : -xG - 0.1; cladGable(FR, xa, xb, towerTop + 0.05, u => top(u), dz, reg); }
    // the flashing over the door head (a bent strip along the whole opening)
    beam(bags.sheetDark, [-xG, fy + DH - 0.22, HD + 0.09], [xG, fy + DH - 0.22, HD + 0.09], 0.004, 0.06, [0, 0, 1], 0);
    // the barge flashing up the rake (in pieces, some gone)
    if (L < 2) for (const s of [-1, 1]) for (let i = 0; i < 8; i++) {
      const x0 = s * HW * i / 8, x1 = s * HW * (i + 1) / 8;
      if (der && hashN(i, s + 5, 92, seed) < 0.3 * decay) continue;
      beam(bags.sheetDark, [x0, yR(x0) + 0.03, HD + 0.12], [x1, yR(x1) + 0.03, HD + 0.12], 0.06, 0.012, [0, 1, 0], 0);
    }
  }

  // ===================================================================== THE FLANKS (the galleries' outer walls)
  for (const s of [-1, 1]) {
    const F2 = frame([s * HW, 0, s > 0 ? HD : -HD], [0, 0, -s], Yup);  // s along the wall from the front (right) / back (left)
    const zOf = u => (s > 0 ? HD - u : -HD + u), uOf = z => (s > 0 ? HD - z : z + HD);
    // the stem: concrete to 1.0 m, the full length
    K.wall(bags.concWall, { A: s > 0 ? [HW - 0.12, HD] : [-HW + 0.12, -HD], B: s > 0 ? [HW - 0.12, -HD] : [-HW + 0.12, HD], y0: g(s * HW, 0) - 0.3, t: 0.24,
                             topAt: () => fy + 1.0, inner: true, endCap: [false, false], capTop: true, capBot: false, sub: L === 0 ? 2 : 0 });
    // the girts (sill, head, sill, head, the band's middle) per bay, on the columns' outer flanges
    const gys = [fy + 1.05, fy + 3.35, yL2 + 0.85, yL2 + 3.55, (yL2 + 3.55 + yR(HW)) / 2];
    if (L < 2) for (let k = 0; k < NB; k++) for (const y of gys) {
      if (der && hashN(k, Math.round(y * 10), 93 + s, seed) < 0.06 * decay) continue;
      member(bags.steel, [s * (HW - 0.17), y, zF(k)], [s * (HW - 0.17), y, zF(k + 1)], 'chanS', [s, 0, 0], L);
    }
    // the windows, a pair of storeys a bay; the sheets round them
    const reg = {
      bag: pick('sheetPale', 'sheetDark', 0.3),
      gone: (p, n) => (0.1 + 0.45 * n * n) * decay, bend: 1, hang: 1,
    };
    const regBand = { bag: pick('sheetDark', 'sheetPale', 0.25), gone: (p, n, ri) => (0.15 + 0.5 * n) * decay, bend: 1.2, hang: 1.2 };
    for (let k = 0; k < NB; k++) {
      const ua = uOf(zF(k + 1)) * (s > 0 ? 1 : 0) + uOf(zF(k)) * (s > 0 ? 0 : 1);
      const u0 = Math.min(uOf(zF(k)), uOf(zF(k + 1))), u1 = Math.max(uOf(zF(k)), uOf(zF(k + 1)));
      void ua;
      const w0 = u0 + 0.55, w1 = u1 - 0.55;
      const boarded = roofed;                                          // stage 2: the ground floor boarded
      if (boarded) {
        sheet(bags.ply, F2, w0, w1 - w0, fy + 1.1, fy + 3.3, 0.04, { lod: 1 });
        if (L === 0) for (let q = 1; q < 4; q++) beam(bags.ply, F2.P(w0, fy + 1.1 + 0.55 * q, 0.06), F2.P(w1, fy + 1.1 + 0.55 * q, 0.06), 0.004, 0.003, F2.N, 0);
      }
      windowWall(F2, w0, w1, fy + 1.1, fy + 3.3, -0.02, 8, 4);
      windowWall(F2, w0, w1, yL2 + 0.9, yL2 + 3.5, -0.02, 8, 5);
      // piers beside the windows, the spandrel between the storeys, the band over the upper ones
      clad(F2, u0, w0, fy + 1.0, yL2 + 0.9, 0.04, reg); clad(F2, w1, u1, fy + 1.0, yL2 + 0.9, 0.04, reg);
      clad(F2, w0, w1, fy + 3.3, yL2 + 0.9, 0.04, reg);
      clad(F2, u0, w0, yL2 + 0.9, yL2 + 3.5, 0.04, reg); clad(F2, w1, u1, yL2 + 0.9, yL2 + 3.5, 0.04, reg);
      clad(F2, u0, u1, yL2 + 3.5, yR(HW) + 0.02, 0.04, regBand);
      if (L === 0) for (let q = 0; q < 3; q++) {                         // water down the stem from the sill
        const uq = w0 + (w1 - w0) * (0.15 + 0.7 * hashN(k, q, 99 + s, seed)), wq = 0.25 + 0.35 * hashN(k, q, 100 + s, seed), Lq = 0.5 + 0.45 * hashN(k, q, 101, seed);
        face(bags.stain, [F2.P(uq, fy + 1.0 - Lq, 0.005), F2.P(uq + wq, fy + 1.0 - Lq, 0.005), F2.P(uq + wq, fy + 1.0, 0.005), F2.P(uq, fy + 1.0, 0.005)], F2.N,
             p => { const q2 = sub(p, F2.P(uq, fy + 1.0, 0)); return CELL(q % 2 ? 7 : 5, dot(q2, F2.X) / wq, -q2[1] / Lq); });
        st.decals++;
      }
      void zOf;
    }
    // the eave: the gutter's remains (lengths missing, one hanging), the fascia flashing
    if (L < 2) {
      const xg = s * (HW + 0.12), yg = yR(HW) - 0.06;
      for (let i = 0; i < NB; i++) {
        const z0 = zF(i) + 0.03, z1 = zF(i + 1) - 0.03;
        const r = hashN(i, s, 94, seed);
        if (roofed) continue;                                            // stage 2 hangs new gutters (below)
        if (der && r < 0.35 * decay) continue;
        if (der && r < 0.5 * decay) { const a = [xg, yg, z0], b = [xg + s * 0.4, yg - 2.2, z1 - 1.5]; K.sweepProfile(bags.sheetDark, a, b, K.troughSection(0.075, 0.004, L === 0 ? 7 : 3), [0, 1, 0], 'shell'); continue; }
        K.sweepProfile(bags.sheetDark, [xg, yg, z0], [xg, yg, z1], K.troughSection(0.075, 0.004, L === 0 ? 7 : 3), [0, 1, 0], 'shell');
      }
    }
  }

  // ===================================================================== THE GALLERIES
  for (const s of [-1, 1]) {
    const xi = s * xG;
    // columns, edge beams, joists; the floor and the roof slabs (a bay of the floor fallen in, stage 0-1)
    for (let k = 0; k <= NB; k++) {
      const z = clamp(zF(k), -HD + 0.25, HD - 0.25);
      if (k < NB) column(bags.steel, xi, z, yGR);
      if (L < 2) for (const y of [yL2 - 0.2, yGR - 0.2]) member(bags.steel, [xi, y, z], [s * xC, y, z], 'chan', [0, 1, 0], L);
    }
    for (const y of [yL2 - 0.2, yGR - 0.2]) member(bags.steel, [xi, y, -HD + 0.2], [xi, y, HD - 0.2], 'col', [s, 0, 0], L);
    const hole = (der || stage === 1) && P.rubble ? Math.floor(hashN(s, 1, 95, seed) * (NB - 3)) + 1 : -1;   // the fallen bay
    for (const [y, th] of [[yL2, 0.16], [yGR, 0.14]]) {
      for (let k = 0; k < NB; k++) {
        const z0 = k === 0 ? -HD + 0.1 : zF(k), z1 = k === NB - 1 ? HD - 0.1 : zF(k + 1);
        const x0 = Math.min(xi, s * (HW - 0.24)), x1 = Math.max(xi, s * (HW - 0.24));
        if (k === hole && y === yL2) {
          // half the bay is gone, the rest hangs at a tilt on its reinforcement
          const zm = (z0 + z1) / 2;
          K.plate(bags.concFloor, [[x0, y, z0], [x1, y, z0], [x1, y, zm - 0.6], [x0, y, zm - 0.6]], th, [0, -1, 0]);
          const slab = [[x0, y, zm + 0.1], [x1, y, zm + 0.1], [x1, y - 1.4, zm + 1.2], [x0, y - 0.9, zm + 1.4]];
          K.plate(bags.concFloor, slab, th, [0, -1, 0]);
          if (stage === 1) for (const zz of [zm - 1.0, zm + 0.6]) for (const xx of [x0 + 0.8, x1 - 0.8]) beam(bags.steelNew, [xx, fy, zz], [xx, y - th, zz], 0.04, 0.04, [1, 0, 0], 0);   // acrow props
          continue;
        }
        K.plate(bags.concFloor, [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], th, [0, -1, 0]);
      }
    }
    // the gallery's ground under the slab (darker: concrete, the same slab) - nothing to add; THE INNER WALL toward the bay
    const F2 = frame([xi, 0, s > 0 ? -HD : HD], [0, 0, s], Yup);        // N = X x Y: toward the bay's middle
    const uOf = z => (s > 0 ? z + HD : HD - z);
    for (let k = 0; k < NB; k++) {
      const u0 = Math.min(uOf(zF(k)), uOf(zF(k + 1))) + 0.2, u1 = Math.max(uOf(zF(k)), uOf(zF(k + 1))) - 0.2;
      const front = k === NB - 1;
      if (front) {                                                        // the tower: solid concrete toward the bay too
        const A = s > 0 ? [xi, HD - D.BAY + 0.2] : [xi, HD], B = s > 0 ? [xi, HD] : [xi, HD - D.BAY + 0.2];
        const As = A, Bs = B;
        K.wall(bags.concWall, { A: As, B: Bs, y0: fy, t: 0.25, topAt: () => yGR, holes: [{ s0: 1.6, s1: 2.8, y0: fy, y1: fy + 2.2 }],
                                 inner: true, endCap: [false, false], capTop: false, capBot: false, sub: L === 0 ? 1.5 : 0 });
        continue;
      }
      // the ground storey: the right-hand gallery (x < 0 seen from the door) white sheet with X rods; the left windows and doors
      if (s < 0) {
        const regW = { bag: () => bags.sheetWhite, gone: (p, n) => (0.03 + 0.25 * n * n) * decay, bend: 0.8, hang: 0.3, len: 2.4, bendIn: false };
        clad(F2, u0, u1, fy + 0.05, yL2 - 0.3, 0.06, regW);
        if (L < 2) {
          const xr = xi + 0.13, za = zF(k) + 0.25, zb = zF(k + 1) - 0.25;
          member(bags.steel, [xr, fy + 0.4, za], [xr, yL2 - 0.4, zb], 'rod', [1, 0, 0], L);
          member(bags.steel, [xr, fy + 0.4, zb], [xr, yL2 - 0.4, za], 'rod', [1, 0, 0], L);
          member(bags.steel, [xr - 0.02, fy + 2.1, zF(k) + 0.15], [xr - 0.02, fy + 2.1, zF(k + 1) - 0.15], 'chanS', [1, 0, 0], L);
        }
      } else {
        const door = k % 3 === 1;
        if (door) {
          windowWall(F2, u0 + 0.2, u0 + 1.9, fy + 2.4, yL2 - 0.4, 0, 3, 3);
          windowWall(F2, u0 + 3.2, u1 - 0.2, fy + 1.0, yL2 - 0.4, 0, 5, 5);
          clad(F2, u0, u0 + 0.2, fy + 0.05, yL2 - 0.3, 0.03, reg2());
          clad(F2, u0 + 1.9, u0 + 3.2, fy + 0.05, yL2 - 0.3, 0.03, reg2());
          clad(F2, u0 + 3.2, u1, fy + 0.05, fy + 1.0, 0.03, reg2());
        } else {
          windowWall(F2, u0 + 0.15, u1 - 0.15, fy + 1.0, yL2 - 0.4, 0, 8, 5);
          clad(F2, u0, u1, fy + 0.05, fy + 1.0, 0.03, reg2());
        }
      }
      // the upper storey: a window wall over a sheet spandrel, both galleries
      windowWall(F2, u0 + 0.15, u1 - 0.15, yL2 + 0.95, yGR - 0.45, 0, 8, 5);
      clad(F2, u0, u1, yL2 - 0.3, yL2 + 0.95, 0.03, reg2());
    }
  }
  function reg2() { return { bag: pick('sheetPale', 'sheetWhite', 0.35), gone: (p, n) => (0.06 + 0.3 * n * n) * decay, bend: 0.8, hang: 0.5, len: 2.2 }; }

  // ===================================================================== THE BACK
  {
    const FB = frame([0, 0, -HD], [-1, 0, 0], Yup);                     // outside -z; s runs +x -> -x
    for (const s of [-1, 1]) {
      // the back towers: concrete, a door and a window a storey
      const A = s > 0 ? [HW + 0.15, -HD - 0.15] : [-xG + 0.15, -HD - 0.15], B = s > 0 ? [xG - 0.15, -HD - 0.15] : [-HW - 0.15, -HD - 0.15];
      const Lw = Math.abs(B[0] - A[0]);
      towerFace(A, B, fy, yGR + 0.4, [{ s0: 1.6, s1: 2.8, y0: fy, y1: fy + 2.2 }, { s0: 3.3, s1: Lw - 0.6, y0: yL2 + 1.0, y1: yGR - 0.6 }],
                [{ s0: 3.3, s1: Lw - 0.6, y0: yL2 + 1.0, y1: yGR - 0.6, cols: 4, rows: 4 }], 0.25);
    }
    const zb = -HD + 0.12;
    // the wind posts, the opening's head, girts at the sides and over the head
    for (const x of [-BW / 2, BW / 2, -(xG + BW / 2) / 2, (xG + BW / 2) / 2, 0]) {
      if (x === 0) { member(bags.steel, [0, fy + BH, zb], [0, yTC(0) - 0.05, zb], 'col', [1, 0, 0], L); continue; }
      member(bags.steel, [x, fy + 0.3, zb], [x, yTC(x) - 0.05, zb], 'col', [1, 0, 0], L);
    }
    member(bags.steel, [-BW / 2, fy + BH, zb], [BW / 2, fy + BH, zb], 'col', [0, 1, 0], L);
    const gys = [fy + 1.2, fy + 3.0, fy + BH];
    for (let y = fy + BH + 1.6; y < yR(0) - 0.5; y += 1.6) gys.push(y);
    if (L < 2) for (const y of gys) {
      const xs = Math.min(xG, HW - Math.max(0, y - (fy + D.EAVE)) / D.tp - 0.2);
      if (y <= fy + BH + 0.01) { for (const sx of [-1, 1]) member(bags.steel, [sx * BW / 2, y, zb - 0.1], [sx * xs, y, zb - 0.1], 'chanS', [0, 0, 1], L); }
      else if (xs > 0.5) member(bags.steel, [-xs, y, zb - 0.1], [xs, y, zb - 0.1], 'chanS', [0, 0, 1], L);
    }
    // the cladding: stripped worst here (the weather's side)
    const regB = { bag: pick('sheetDark', 'sheetPale', 0.4), gone: (p, n) => (0.25 + 0.55 * n) * decay, bend: 1.3, hang: 1.4 };
    const top = x => yR(x) + 0.02;
    for (const sx of [-1, 1]) {                                              // beside the opening
      const ua = sx > 0 ? -xG : BW / 2, ub = sx > 0 ? -BW / 2 : xG;       // FB's s = -x
      clad(FB, ua, ub, fy + 0.05, fy + BH, 0.08, regB);
    }
    cladGable(FB, -xG, xG, fy + BH, u => top(-u), 0.08, regB);              // over the head, under the rake
    for (const sx of [-1, 1]) {                                              // over the back towers
      const ua = sx > 0 ? -HW : xG, ub = sx > 0 ? -xG : HW;
      cladGable(FB, ua, ub, yGR + 0.45, u => top(-u), 0.08, regB);
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
    const cs = L === 0 ? 0.5 : 1.0, x0 = -xG + 0.4, x1 = xG - 0.4, z0 = -HD + 0.6, z1 = HD - 0.4;
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
    } else if (roofed) contour(bags.stain, 0.2, fy + 0.003, () => CELL(13, 0.5, 0.5));   // the damp patches where it stood
    if (L === 0) {
      // the joints (5 m bays, sawn) and the cracks (random walks across the slab, worse where it sank)
      const line = (a, b, w, y, cell) => { const d2 = nrm(sub(b, a)), nn = [-d2[2], 0, d2[0]];
        face(bags.stain, [add(a, mul(nn, -w)), add(b, mul(nn, -w)), add(b, mul(nn, w)), add(a, mul(nn, w))].map(p => [p[0], y, p[2]]), Yup,
             p => { const q = sub(p, a); return CELL(cell, dot(q, d2) / Math.max(0.01, len(sub(b, a))), (dot(q, nn) + w) / (2 * w)); }); };
      for (let x = -HW + 5; x < HW; x += 5) line([x, 0, -HD + 0.2], [x, 0, HD - 0.2], 0.035, fy + 0.002, 15);
      for (let z = -HD + 5; z < HD; z += 5) line([-HW + 0.2, 0, z], [HW - 0.2, 0, z], 0.035, fy + 0.002, 15);
      const rc = rng(seed * 3 + 7);
      for (let c = 0; c < 22; c++) {
        let x = (rc() * 2 - 1) * (xG - 1), z = (rc() * 2 - 1) * (HD - 1), a = rc() * 6.28;
        const n = 6 + Math.floor(rc() * 14);
        for (let q = 0; q < n; q++) {
          a += (rc() - 0.5) * 0.9; const sl = 0.4 + rc() * 0.7, x2 = clamp(x + Math.cos(a) * sl, -HW + 0.3, HW - 0.3), z2 = clamp(z + Math.sin(a) * sl, -HD + 0.3, HD - 0.3);
          line([x, 0, z], [x2, 0, z2], 0.02 + rc() * 0.03, fy + 0.0025, 15);
          if (der && P.weeds && rc() < 0.18) weed(x2, fy, z2, 0.25 + rc() * 0.3, rc() < 0.7 ? 0 : 3, rc());
          x = x2; z = z2;
        }
      }
      // oil and moss patches
      for (let q = 0; q < 10; q++) { const x = (rc() * 2 - 1) * (xG - 2), z = (rc() * 2 - 1) * (HD - 2), r = 0.6 + rc() * 1.6, c = q < 5 ? 11 : 12;
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
      for (const s of [-1, 1]) {
        const k = Math.floor(hashN(s, 1, 95, seed) * (NB - 3)) + 1, zc = (zF(k) + zF(k + 1)) / 2 + 0.8;
        pile(s * (HW - D.GW / 2), zc, 1.8, L === 0 ? 70 : 12);
      }
      for (let q = 0; q < 5; q++) pile((rc() * 2 - 1) * (xG - 2), (rc() * 2 - 1) * (HD - 3), 0.8, L === 0 ? 14 : 3);
      // sheets fallen on the floor, bent
      if (L === 0) for (let q = 0; q < 14; q++) {
        const x = (rc() * 2 - 1) * (xG - 1), z = (rc() * 2 - 1) * (HD - 1), a = rc() * 6.28;
        const Fx = frame([x, fy + 0.03 + rc() * 0.05, z], [Math.cos(a), 0, Math.sin(a)], [-Math.sin(a), 0, Math.cos(a)]);
        const vk = 0.6 + rc() * 0.8;
        sheet(rc() < 0.6 ? bags.sheetDark : bags.sheetPale, Fx, 0, 0.9, 0, 1.4 + rc() * 1.4, 0, { lod: 0, vk: [vk], rots: [{ piv: Fx.P(0, vk, 0), ax: Fx.X, ang: -(0.2 + rc() * 0.6), when: (u, v) => v > vk }] });
      }
    } else {
      pile(-xG + 3.5, HD - 6, 2.2, L === 0 ? 120 : 16); pile(xG - 3.5, -HD + 6, 2.0, L === 0 ? 100 : 14);
    }
  }
  // the litter on the floor and the apron
  if (P.litter && L === 0 && stage < 2) {
    const rc = rng(seed * 11 + 3);
    const n = der ? 40 : 8;
    for (let q = 0; q < n; q++) {
      const out = P.apron && rc() < 0.35;
      const x = (rc() * 2 - 1) * (out ? HW + 4 : xG - 0.5), z = out ? HD + 1 + rc() * (P.apronL - 2) : (rc() * 2 - 1) * (HD - 0.5), r = 0.35 + rc() * 0.4, a = rc() * 6.28;
      const y = out ? g(x, z) + 0.065 : fy + 0.004;
      const ca = Math.cos(a) * r, sa = Math.sin(a) * r;
      face(bags.decal, [[x - ca + sa, y, z - sa - ca], [x + ca + sa, y, z + sa - ca], [x + ca - sa, y, z + sa + ca], [x - ca - sa, y, z - sa + ca]], Yup,
           p => { const dx = p[0] - x, dz = p[2] - z; return CELL(10, (dx * Math.cos(a) + dz * Math.sin(a)) / (2 * r) + 0.5, (-dx * Math.sin(a) + dz * Math.cos(a)) / (2 * r) + 0.5); });
      st.decals++;
    }
  }

  // ===================================================================== GRAFFITI
  if (P.graffiti && L === 0) {
    const rc = rng(seed * 13 + 5);
    const tag = (Fw, u, y, w, d, cell, follow) => {
      const h = w * (0.45 + rc() * 0.25);
      if (follow) sheet(bags.decal, Fw, u, w, y, y + h, d + AMP + 0.004, { lod: 0, uvf: (uu, vv) => CELL(cell, (uu - u) / w, (vv - y) / h) });
      else face(bags.decal, [Fw.P(u, y, d), Fw.P(u + w, y, d), Fw.P(u + w, y + h, d), Fw.P(u, y + h, d)], Fw.N, p => { const q = sub(p, Fw.P(u, y, d)); return CELL(cell, dot(q, Fw.X) / w, dot(q, Fw.Y) / h); });
      st.decals++;
    };
    // the white wall's foot (the right-hand gallery, toward the bay)
    const FW = frame([-xG, 0, HD], [0, 0, -1], Yup);
    for (let k = 0; k < NB - 1; k++) if (rc() < 0.8) tag(FW, D.BAY * (k + 1) + 0.3 + rc() * 2.2, fy + 0.25 + rc() * 0.4, 1.4 + rc() * 1.6, 0.06, Math.floor(rc() * 4), true);
    // the towers' fronts, low
    const FT = frame([0, 0, HD + zT + 0.152], [1, 0, 0], Yup);
    for (const s of [-1, 1]) for (let q = 0; q < 2; q++) tag(FT, s * (xG + 1.2 + rc() * 2.5) - 0.8, fy + 0.3 + rc() * 0.5, 1.2 + rc() * 1.2, 0.0, Math.floor(rc() * 4), false);
    // a column pier or two
    for (let q = 0; q < 4; q++) { const k = 1 + Math.floor(rc() * (NB - 1)), sx = rc() < 0.5 ? -1 : 1, Fp = frame([sx * xG - 0.35, 0, zF(k) + 0.35], [1, 0, 0], Yup);
      tag(Fp, 0.02, fy + 0.04, 0.66, 0.0, Math.floor(rc() * 4), false); }
  }

  // ===================================================================== BARRIERS AND BOARDS
  if (P.barriers && L < 2) {
    const barrier = (x, z, yaw, tip) => {
      // a water-filled jersey barrier, 2.0 x 0.45 x 0.8, its profile extruded; tipped over in the derelict
      const prof = [[-0.24, 0], [0.24, 0], [0.24, 0.12], [0.11, 0.3], [0.09, 0.78], [-0.09, 0.78], [-0.11, 0.3], [-0.24, 0.12]];
      const c = Math.cos(yaw), sn = Math.sin(yaw), Lb = 1.0;
      const T = (px, py, pz) => {                                         // local (across, up, along) -> world
        let a = px, u = py;
        if (tip) { const ca = Math.cos(tip), sa = Math.sin(tip); const a2 = a * ca - u * sa, u2 = a * sa + u * ca; a = a2; u = u2 + (tip > 0 ? 0.24 : 0.24); }
        return [x + a * c + pz * sn, fy + u, z - a * sn + pz * c];
      };
      const n = prof.length;
      for (let i = 0; i < n; i++) { const p = prof[i], q = prof[(i + 1) % n];
        const nn = [q[1] - p[1], -(q[0] - p[0])];
        face(bags.plastic, [T(p[0], p[1], -Lb), T(q[0], q[1], -Lb), T(q[0], q[1], Lb), T(p[0], p[1], Lb)], nrm(sub(T(p[0] + nn[0], p[1] + nn[1], 0), T(p[0], p[1], 0)))); }
      for (const e of [-1, 1]) face(bags.plastic, prof.map(p => T(p[0], p[1], e * Lb)), nrm(sub(T(0, 0.4, e * 2), T(0, 0.4, 0))));
      st.barriers++;
    };
    if (der) {
      barrier(-xG + 0.9, 6.0, Math.PI / 2 + 0.1, 0); barrier(-xG + 0.8, 8.3, Math.PI / 2 - 0.05, 0);
      barrier(-xG + 1.4, 10.6, Math.PI / 2 + 0.5, 1.45); barrier(-xG + 0.9, -4.0, Math.PI / 2, 0);
    } else if (stage === 1) {
      for (let x = -xG + 1.5; x < xG - 1; x += 2.6) if (Math.abs(x) > 1.5) barrier(x + 1.0, HD + 1.6, Math.PI / 2, 0);
      for (const x of [-6, 6]) {                                            // the boards on their posts
        for (const dx of [-0.55, 0.55]) beam(bags.steelNew, [x + dx, fy, HD + 2.3], [x + dx, fy + 1.9, HD + 2.3], 0.025, 0.025, [1, 0, 0], 0);
        K.boxAB(bags.ply, [x - 0.65, fy + 1.0, HD + 2.33], [x + 0.65, fy + 1.9, HD + 2.36]);
        face(bags.decal, [[x - 0.62, fy + 1.0, HD + 2.37], [x + 0.62, fy + 1.0, HD + 2.37], [x + 0.62, fy + 1.9, HD + 2.37], [x - 0.62, fy + 1.9, HD + 2.37]], [0, 0, 1],
             p => CELL(14, (p[0] - x + 0.62) / 1.24, 0.2 + (p[1] - fy - 1.0) / 0.9 * 0.6));
      }
    } else {
      for (let q = 0; q < 3; q++) barrier(xG + 1.0, HD - 2.5 - q * 0.6, 0, 0);
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
    for (const s of [-1, 1]) along(s * (HW + 0.25), -HD, s * (HW + 0.25), HD, gy, k0, false);
    along(-HW, -HD - 0.4, HW, -HD - 0.4, gy, k0 * 1.2, false);
    for (const s of [-1, 1]) along(s * xG, HD + zT + 0.4, s * HW, HD + zT + 0.4, gy, k0 * 1.5, false);
    // the corners at the opening: alder and fireweed up against the towers
    if (!roofed) for (const s of [-1, 1]) for (let q = 0; q < (der ? 3 : 1); q++) weed(s * (xG + 0.8 + rc() * 3), gy(s * HW, HD + 1), HD + zT + 0.6 + rc() * 0.8, 1.3 + rc() * 1.5, 2, rc());
    if (der) {
      // inside: the gallery walls' feet toward the bay, the back opening spilling in, the gallery roofs (open to the sky)
      for (const s of [-1, 1]) along(s * (xG - 0.3), -HD + 0.5, s * (xG - 0.3), HD - 1, () => fy, 0.9, true);
      along(-D.BW / 2, -HD + 0.6, D.BW / 2, -HD + 0.6, () => fy, 1.8, false);
      for (const s of [-1, 1]) along(s * (xG + D.GW * 0.45), -HD + 0.5, s * (xG + D.GW * 0.45), HD - 0.8, () => yGR, 1.4, true);
      // the side bays' ground storey at the front: bushes in the light of the tower door
      for (const s of [-1, 1]) for (let q = 0; q < 4; q++) weed(s * (xG + 1 + rc() * (D.GW - 2)), fy, HD - 1 - rc() * 3, 0.6 + rc() * 1.2, rc() < 0.5 ? 2 : 1, rc());
    }
    if (P.apron) {                                                           // the apron's joints
      for (let x = -HW - 6 + 2.5; x < HW + 6; x += 5) along(x, HD + 0.6, x, HD + P.apronL - 0.5, gy, safe ? 0.3 : 0.7, false, true);
      for (let z = HD + 5; z < HD + P.apronL; z += 5) along(-HW - 6, z, HW + 6, z, gy, safe ? 0.3 : 0.7, false, true);
    }
  }
  // the stains down the concrete under the tower windows and the coping (water runs)
  if (L === 0) {
    const FT = frame([0, 0, HD + zT + 0.153], [1, 0, 0], Yup);
    for (const s of [-1, 1]) for (let q = 0; q < 7; q++) {
      const u = s * xG + s * (0.6 + (D.GW - 0.8) * hashN(q, s, 97, seed)) - 0.15, top = q < 4 ? towerTop - 0.02 : (q < 6 ? yGR - 0.5 : fy + 3.3), Ls = 0.8 + 1.8 * hashN(q, s, 98, seed);
      face(bags.stain, [FT.P(u, top - Ls, 0), FT.P(u + 0.3, top - Ls, 0), FT.P(u + 0.3, top, 0), FT.P(u, top, 0)], FT.N, p => CELL(7, (p[0] - u) / 0.3, (top - p[1]) / Ls));
      st.decals++;
    }
  }

  // ===================================================================== THE GROUND SKIRT, THE BAKE, THE LEDGER
  const occ = [{ x: 0, z: 0, hx: HW + 0.3, hz: HD + 0.3, k: 0.6, soft: 2.2, dry: true }];
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
    door: { x: 0, z: HD, w: D.DOOR_W, h: D.DH, leaves: 0, shut: false, open: true },
    galleries: { depth: D.GW, floors: [yL2, yGR] }, frames: NB + 1, bay: D.BAY, purlins: NPU * 2, instances,
    front: { x: 0, z: HD + 1.5, side: 1, depth: 0 },
    ground: g, groundAO: occ, aoFoot: null, ao: aoInfo, path: [], people: null, yard: null, pier: null,
    lit: { lights: [], panes: 0, windows: 0 }, smoke: null, sign: null,
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
const DRESS = {
  steel:      ['house', 'rust', [1.05, 0.62, 0.55], 0.3, 0.9],   // red-oxide primer gone to rust (an isotropic scan: a streaked one barber-poles a 70 mm member)
  steelNew:   ['house', 'steelgrey', 0x9aa0a4, 0.4, 0.6],      // the grey primer of the made-safe stage
  sheetPale:  ['house', 'corrworn', 0xfff8ee, 0.45, 0.45],      // the pale, streaked header band
  sheetDark:  ['house', 'corrworn', 0x5a4e46, 0.4, 0.45],      // the dark eave sheets
  sheetWhite: ['house', 'steelgrey', 0xffffff, 0.15, 0.5],     // the white-painted inner wall
  sheetNew:   ['house', 'galv', 0xe8ecef, 0.6, 0.4],           // the new roof
  concFloor:  ['site', 'cracked', [1.5, 1.6, 1.75], 0, 1.0],    // worn, dusty, cracked (the photos' apron and slab): the scan is dark and brown, lifted to grey
  concWall:   ['hangar', 'concrete008', 0xe9e4d8, 0, 1.0],
  ply:        ['house', 'greywood', 0xc8b89a, 0, 0.8],
};
let MATS = null;
function matsOrNull() { return MATS; }
function makeMats() {
  if (typeof MATLIB === 'undefined' || typeof THREE === 'undefined' || !THREE.MeshStandardMaterial) return null;
  const sh = (k, shape, p) => MATLIB.shared(THREE, shape, p, 'derelict:' + k);
  const side2 = THREE.DoubleSide;
  const M = {};
  for (const k of ['steel', 'steelNew', 'concFloor', 'concWall', 'ply']) M[k] = sh(k, 'std', { color: 0xa09080, roughness: 0.9, metalness: 0 });
  for (const k of ['sheetPale', 'sheetDark', 'sheetWhite', 'sheetNew']) M[k] = sh(k, 'std', { color: 0x9a9a9a, roughness: 0.8, metalness: 0.3, side: side2 });
  M.glass = sh('glass', 'glass', { color: 0xaeb9b6, roughness: 0.3, metalness: 0, opacity: 0.4, side: side2, depthWrite: false });
  M.water = sh('water', 'std', { color: 0x101214, roughness: 0.035, metalness: 0, envMapIntensity: 1.25, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  M.decal = sh('decal', 'cut', { color: 0xffffff, roughness: 0.85, metalness: 0, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, side: side2 });
  M.stain = sh('stain', 'glass', { color: 0xffffff, roughness: 0.95, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  M.weed = sh('weed', 'cut', { color: 0xffffff, roughness: 0.9, metalness: 0, alphaTest: 0.42 });
  M.plastic = sh('plastic', 'std', { color: 0xe2541a, roughness: 0.55, metalness: 0 });
  const HF = HG.makeFinish ? HG.makeFinish() : null;
  M.aoskirt = HF && HF.MAT ? HF.MAT.aoskirt : null;
  return M;
}
function makeFinish() { const M = makeMats(); return { MAT: M, SHADE_U: HG.makeShadeU(), hn: HN() && HN().makeFinish ? HN().makeFinish() : null }; }
let DEFAULT_FINISH = null;
function defaultFinish() { if (!DEFAULT_FINISH) { DEFAULT_FINISH = makeFinish(); MATS = DEFAULT_FINISH.MAT; } return DEFAULT_FINISH; }
function applyFinish(P0, F0) {
  const P = Object.assign({}, DEF, P0 || {});
  const F = F0 || defaultFinish();
  if ((P.stage | 0) >= 3) { const H = HN(); if (H && F.hn) H.applyFinish(worksP(P), F.hn); return F; }
  const M = F.MAT; if (!M) return F;
  const SU = F.SHADE_U;
  for (const k in DRESS) {
    const m = M[k]; if (!m) continue;
    const [lib, key, tint, metal, ns] = DRESS[k];
    const d = texOf(lib, key, 'diff');
    if (d) { m.map = d; m.normalMap = texOf(lib, key, 'nor') || texOf(lib, key, 'nor_gl'); m.roughnessMap = texOf(lib, key, 'rough'); m.roughness = 1; }
    if (Array.isArray(tint)) m.color.setRGB(tint[0], tint[1], tint[2]); else m.color.setHex(tint);
    m.metalness = metal; if (m.normalScale) m.normalScale.set(ns, ns);
    if (HG.shadeHouse && !(m.userData && m.userData.houseShaded)) HG.shadeHouse(m, SU);
    if (HG.cloudWeather && /^(sheet|concWall)/.test(k)) HG.cloudWeather(m, k === 'sheetNew' ? 0.1 : 0.55, 0);
    m.needsUpdate = true;
  }
  if (!ATLAS.decal) { const c = decalCanvas(); if (c) { ATLAS.decal = new THREE.CanvasTexture(c); ATLAS.decal.colorSpace = THREE.SRGBColorSpace; ATLAS.decal.anisotropy = 8; } }
  if (!ATLAS.weed) { const c = weedCanvas(); if (c) { ATLAS.weed = new THREE.CanvasTexture(c); ATLAS.weed.colorSpace = THREE.SRGBColorSpace; ATLAS.weed.anisotropy = 8; } }
  if (ATLAS.decal) { M.decal.map = ATLAS.decal; M.stain.map = ATLAS.decal; M.decal.needsUpdate = M.stain.needsUpdate = true; }
  if (ATLAS.weed) { M.weed.map = ATLAS.weed; M.weed.needsUpdate = true; }
  // the dirt ramp off the slab (the house's): the dark tide line on the concrete, rust-brown splash on the sheets
  if (SU) {
    SU.uDirtTop.value = P.floorY + 0.9; SU.uDirtH.value = 1.1; SU.uDirtK.value = 0.6; SU.uNoiseK.value = 0.2; SU.uAOd.value = 0.4; SU.uSag.value = 0;
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
  atlasCanvas: { decal: decalCanvas, weed: weedCanvas }, corrugation: { PITCH, CREST, AMP },
  get MAT() { return defaultFinish().MAT; },
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
    hooks: P => [{ name: 'door', kind: 'apron', p: [0, 0, ((P && P.HD) || Pd.HD) + 2], dir: [0, 0, 1] }], hooksOf: () => [],
    lod: { dist: [0, 200, 600, 1500] }, slots: { ao: 'stats.groundAO' },
    tags: ['airport', 'hangar', 'derelict', 'story'], role: 'hangar', cat: 'airport m', headless: true, gate: 'DERELICT' };
});
})();
