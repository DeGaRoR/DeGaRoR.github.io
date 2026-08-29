// ============================================================
// THE HANGAR — the garage's room, ported from the design session's hangar.html
// (futureDesigns/transfer-glazing2/hangar.html). Everything is built from
// primitives and canvas-baked sheets: no external art, no network, and a seeded
// PRNG, so the shed is the same shed every time.
//
// WHAT CHANGED IN THE PORT. The session targets three 0.184 as an ES module off
// a CDN; this repo pins r128, vendored, offline. Three real differences, each
// marked at its site:
//   - texture colour space is an ENCODING in r128, not a `colorSpace`
//   - MeshPhysicalMaterial has no `thickness` before r132
//   - there is no `scene.environmentIntensity`; the moods scale each material's
//     own `envMapIntensity` instead, which is the r128 equivalent
// NOT copied: the session sets `PCFShadowMap` because PCFSoftShadowMap is
// deprecated in r184. That is not true in r128, where soft PCF is strictly
// better, so the viewer's own shadow settings are left alone.
//
// The room is a GROUP with its own lights. The viewer adds it to the scene and
// takes it out again; see `installEnv` in app.js.
// ============================================================

// Which THREE features the room needs. The headless smoke gate stubs THREE with
// only what the viewer used before this file existed, so the garage ASKS rather
// than assumes and falls back to the studio when the answer is no. A missing
// constructor is a fallback, not a crash.
const GEN_HANGAR_NEEDS = ['Group', 'Color', 'Fog', 'Mesh', 'BoxGeometry',
  'CylinderGeometry', 'PlaneGeometry', 'ConeGeometry', 'TorusGeometry',
  'ShapeGeometry', 'Shape', 'BufferGeometry', 'Float32BufferAttribute',
  'MeshStandardMaterial', 'MeshBasicMaterial', 'MeshPhysicalMaterial',
  'HemisphereLight', 'DirectionalLight', 'PointLight', 'SpotLight',
  'CanvasTexture',
  'Vector2', 'Vector3', 'Matrix4', 'Box3'];
function genHangarSupported(THREE) {
  return !!THREE && GEN_HANGAR_NEEDS.every(k => THREE[k] !== undefined);
}

function genHangarBuild(THREE, dims) {

// ===========================================================================
// THE GARAGE. A working hangar, sized by its caller — 20 m deep, 28 m wide and
// 7.0 m to the eaves by default, which is a club hangar for one or two light
// aeroplanes rather than the DC-3 shed it was first drawn as. Long axis is x,
// doors at -x, which is the end the aeroplane's nose points at (model frame:
// x AFT).
//
// Everything here is built from primitives and canvas-baked sheets — no
// external art. The light is the point: north glazing down both flanks, four
// roof lights, a warm shop lamp over every bay, and the door open on a bright
// afternoon. What sells a big interior is the SOFT half of that, so the scene
// bakes its own environment map off itself (CubeCamera -> PMREM) and every
// material reads its ambient from the room it is standing in.
// ===========================================================================
// THE DIMENSIONS ARE A PARAMETER (G53, user: "I think the hangar is a tad too
// big ... could you get its dimension parametrized"). The whole room is this
// one function, so it always could be: the caller passes half-width,
// half-depth and eaves height, and asking again with different numbers builds
// a different shed. The ridge follows the eaves unless it is given, and the
// door follows the width — a shed you cannot get the aeroplane into is not a
// shed, and a door that no longer fits its own gable is not a door.
//
// HANGAR_DIMS is the DEFAULT, and it changed with this chantier: the shed was
// drawn for a DC-3's 29 m span, and this game's generator clamps a wing to
// 14 m. 36 m of width put the aeroplane in the middle of a field.
const D0 = dims || (typeof HANGAR_DIMS !== 'undefined' ? HANGAR_DIMS : null) || {};
const HW = D0.HW || 14, HD = D0.HD || 10, EAVE = D0.EAVE || 7.0;
const RIDGE = D0.RIDGE || (EAVE + 2.6);
// The opening is nearly the whole gable end. It leaves 2.5 m of wall each side
// for the leaves to park against, and it cannot be taller than the eaves.
const DOOR_W = Math.max(6, 2 * HW - 5), DOOR_H = Math.min(6.4, EAVE - 1.4);

// THE LAYOUT WAS COMPOSED against the authored shed — 26 m deep by 36 m wide,
// HD 13 and HW 18 — and every ABSOLUTE coordinate in the placement below is
// mapped through these. Anything written against a wall (HW - 1.05) is a real
// clearance and is left alone: the bench stands a metre off the wall in any
// shed. Only the positions ALONG the walls scale.
const FX = v => v * HD / 13, FZ = v => v * HW / 18;

const rand = (s => () => (s = s * 1664525 + 1013904223 >>> 0) / 4294967296)(20260811);
const rr = (a, b) => a + (b - a) * rand();

// ---- canvas sheets --------------------------------------------------------
const sheet = (w, h, draw, linear) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  // r128 declares colour space per texture as an ENCODING; a data sheet
  // (normal, roughness) must stay linear or every value in it is bent.
  if (!linear) t.encoding = THREE.sRGBEncoding;
  t.anisotropy = (typeof window !== "undefined" && window.FLYDIY_ANISO) || 8;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};

// THE FLOOR. Power-trowelled concrete: cool grey, mottled, saw-cut on a 4 m
// grid, with a lifetime of oil in front of the benches and a yellow bay line.
// The roughness sheet is where the reflection lives — a polished slab is not
// uniformly polished, it is burnished where the machine went and dull where
// the traffic is, and that variation is the whole look.
const floorAlb = sheet(2048, 2048, (g, W, H) => {
  g.fillStyle = '#615e58'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) {          // aggregate mottle
    const x = rand() * W, y = rand() * H, r = rr(6, 90);
    g.globalAlpha = rr(0.02, 0.07);
    g.fillStyle = rand() < 0.5 ? '#8a877e' : '#565450';
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 900; i++) {           // fine grit
    g.globalAlpha = rr(0.05, 0.16);
    g.fillStyle = rand() < 0.5 ? '#a5a299' : '#484641';
    g.fillRect(rand() * W, rand() * H, rr(1, 3), rr(1, 3));
  }
  g.globalAlpha = 1;
  // saw cuts, 4 m on a 40 m sheet
  g.strokeStyle = 'rgba(38,36,33,.62)'; g.lineWidth = 5;
  for (let i = 1; i < 10; i++) {
    const p = i / 10 * W;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, H); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(W, p); g.stroke();
  }
  // oil, in the bays where work happens
  for (const [cx, cy, R] of [[0.30, 0.30, 190], [0.72, 0.22, 130], [0.24, 0.74, 150]]) {
    for (let i = 0; i < 200; i++) {
      const a = rand() * 7, d = Math.pow(rand(), 0.6) * R;
      g.globalAlpha = rr(0.02, 0.10);
      g.fillStyle = '#2c2620';
      g.beginPath();
      g.arc(cx * W + Math.cos(a) * d, cy * H + Math.sin(a) * d, rr(4, 26), 0, 7);
      g.fill();
    }
  }
  g.globalAlpha = 1;
  g.strokeStyle = 'rgba(214,176,60,.55)'; g.lineWidth = 9;
  g.beginPath(); g.moveTo(0.10 * W, 0); g.lineTo(0.10 * W, H); g.stroke();
  g.beginPath(); g.moveTo(0.90 * W, 0); g.lineTo(0.90 * W, H); g.stroke();
}, false);
const floorRgh = sheet(1024, 1024, (g, W, H) => {
  g.fillStyle = '#333333'; g.fillRect(0, 0, W, H);          // 0.20 base
  for (let i = 0; i < 500; i++) {                            // burnished swirls
    g.globalAlpha = rr(0.05, 0.18);
    g.fillStyle = '#242424';
    const x = rand() * W, y = rand() * H;
    g.beginPath(); g.ellipse(x, y, rr(40, 220), rr(20, 90), rand() * 7, 0, 7); g.fill();
  }
  for (let i = 0; i < 260; i++) {                            // scuffed, duller
    g.globalAlpha = rr(0.06, 0.20);
    g.fillStyle = '#7d7d7d';
    g.beginPath(); g.arc(rand() * W, rand() * H, rr(20, 120), 0, 7); g.fill();
  }
  g.globalAlpha = 1;
}, true);
// metric-uv re-base (G41): same one-sheet-over-the-floor look
floorAlb.repeat.set(1 / 26, 1 / 36); floorRgh.repeat.set(1 / 26, 1 / 36);

// corrugated sheeting, as a normal map: a real profile, not a bump guess
const corrNrm = sheet(512, 64, (g, W, H) => {
  const d = g.createImageData(W, H);
  for (let x = 0; x < W; x++) {
    const ph = (x / W) * Math.PI * 2 * 16;                   // 16 ribs per tile
    const nx = Math.cos(ph) * 0.55;
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx));
    for (let y = 0; y < H; y++) {
      const o = (y * W + x) * 4;
      d.data[o] = (nx * 0.5 + 0.5) * 255;
      d.data[o + 1] = 128;
      d.data[o + 2] = nz * 255;
      d.data[o + 3] = 255;
    }
  }
  g.putImageData(d, 0, 0);
}, true);

const woodAlb = sheet(512, 512, (g, W, H) => {
  g.fillStyle = '#8a6b47'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 220; i++) {
    g.globalAlpha = rr(0.05, 0.22);
    g.strokeStyle = rand() < 0.5 ? '#6a4f31' : '#a8875e';
    g.lineWidth = rr(1, 5);
    const y = rand() * H;
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= W; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + i) * rr(1, 6));
    g.stroke();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 14; i++) {                             // knots
    const x = rand() * W, y = rand() * H, R = rr(5, 16);
    for (let k = 4; k > 0; k--) {
      g.globalAlpha = 0.3;
      g.strokeStyle = '#4f3a22'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(x, y, R * k / 4, R * k / 6, 0.4, 0, 7); g.stroke();
    }
  }
  g.globalAlpha = 1;
});
woodAlb.repeat.set(3, 1);

// ---- materials ------------------------------------------------------------
// PROFILED STEEL SHEETING, drawn rather than tinted: panel seams every sheet
// width, the fixing line down each purlin, streaks under the laps and rust
// creeping up from the bottom edge. A flat colour with a corrugation normal map
// reads as plastic — what makes sheeting look like sheeting is that no two bays
// have weathered the same.
const wallAlb = sheet(1024, 512, (g, W, H) => {
  g.fillStyle = '#8b8d82'; g.fillRect(0, 0, W, H);
  const SH = W / 8;                                  // eight sheets across
  for (let i = 0; i < 8; i++) {
    g.globalAlpha = rr(0.03, 0.10);                  // every sheet a shade off
    g.fillStyle = rand() < 0.5 ? '#a2a496' : '#6f7167';
    g.fillRect(i * SH, 0, SH, H);
  }
  g.globalAlpha = 1;
  for (let i = 0; i <= 8; i++) {                     // the lap at each joint
    g.fillStyle = 'rgba(48,50,45,.42)'; g.fillRect(i * SH - 2, 0, 4, H);
    g.fillStyle = 'rgba(206,208,198,.30)'; g.fillRect(i * SH + 2, 0, 2, H);
  }
  for (let k = 1; k < 6; k++) {                      // fixing lines on the rails
    const y = H * k / 6;
    g.fillStyle = 'rgba(60,58,52,.22)'; g.fillRect(0, y, W, 2);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = 'rgba(40,38,34,.55)';
      g.beginPath(); g.arc(i * SH + SH * 0.5, y + 1, 2.2, 0, 7); g.fill();
    }
  }
  for (let i = 0; i < 140; i++) {                    // rain streaks
    const x = rand() * W, w = rr(2, 9), y0 = rr(0, H * 0.5);
    g.globalAlpha = rr(0.03, 0.11);
    g.fillStyle = rand() < 0.6 ? '#5e6058' : '#b6b8ac';
    g.fillRect(x, y0, w, rr(H * 0.2, H * 0.6));
  }
  for (let i = 0; i < 260; i++) {                    // rust from the ground up
    const y = H - Math.pow(rand(), 2.2) * H * 0.42;
    g.globalAlpha = rr(0.03, 0.13);
    g.fillStyle = rand() < 0.5 ? '#7a4a2c' : '#5d4433';
    g.beginPath(); g.arc(rand() * W, y, rr(3, 22), 0, 7); g.fill();
  }
  g.globalAlpha = 1;
});
// METRIC-LEGACY repeats (G40): the wall boxes now carry world-metre UVs,
// so the baked sheet's old "3 tiles per wall, 1 per height" becomes
// per-metre numbers sized to the long side wall it was authored against.
// The short bands squish a little — the baked wall is the LEGACY option
// in the wardrobe now, kept working, not kept perfect.
wallAlb.repeat.set(3 / 26, 1 / 8.4);
// the outside is the same sheeting, weathered harder and never in the sun here
const wallOutAlb = sheet(512, 256, (g, W, H) => {
  g.fillStyle = '#5f6259'; g.fillRect(0, 0, W, H);
  for (let i = 0; i <= 8; i++) g.fillRect(i * W / 8 - 1, 0, 2, H);
  for (let i = 0; i < 90; i++) {
    g.globalAlpha = rr(0.04, 0.14);
    g.fillStyle = rand() < 0.5 ? '#4a4c45' : '#74776c';
    g.fillRect(rand() * W, rand() * H * 0.6, rr(2, 7), rr(30, 140));
  }
  g.globalAlpha = 1;
});
wallOutAlb.repeat.set(4, 1);
// rendered blockwork for the stem wall, courses and all
const blockAlb = sheet(512, 256, (g, W, H) => {
  g.fillStyle = '#6b675f'; g.fillRect(0, 0, W, H);
  const rows = 5, bw = W / 6;
  for (let r = 0; r < rows; r++) {
    const y = r * H / rows, off = (r % 2) * bw / 2;
    for (let c = -1; c < 7; c++) {
      g.globalAlpha = rr(0.05, 0.16);
      g.fillStyle = rand() < 0.5 ? '#7c786f' : '#5b5851';
      g.fillRect(c * bw + off + 2, y + 2, bw - 4, H / rows - 4);
    }
    g.globalAlpha = 0.5; g.fillStyle = '#494640';
    g.fillRect(0, y, W, 2.5);
    for (let c = -1; c < 7; c++) g.fillRect(c * bw + off, y, 2.5, H / rows);
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 120; i++) {                    // scuffs where things hit it
    g.globalAlpha = rr(0.03, 0.12);
    g.fillStyle = rand() < 0.5 ? '#3f3c36' : '#8a867c';
    g.beginPath(); g.arc(rand() * W, H - Math.pow(rand(), 1.6) * H, rr(3, 16), 0, 7); g.fill();
  }
  g.globalAlpha = 1;
});
// metric-uv re-base (G41): 6 courses per 26 m, one per 1.1 m stem
blockAlb.repeat.set(6 / 26, 1 / 1.1);
// the roof, inside: unlined sheeting, dustier and darker than the walls
const roofAlb = sheet(512, 256, (g, W, H) => {
  g.fillStyle = '#5a5b54'; g.fillRect(0, 0, W, H);
  for (let i = 0; i <= 10; i++) {
    g.fillStyle = 'rgba(36,37,33,.5)'; g.fillRect(i * W / 10 - 1.5, 0, 3, H);
    g.fillStyle = 'rgba(150,152,142,.16)'; g.fillRect(i * W / 10 + 1.5, 0, 1.5, H);
  }
  for (let i = 0; i < 120; i++) {
    g.globalAlpha = rr(0.03, 0.12);
    g.fillStyle = rand() < 0.5 ? '#43443e' : '#71736a';
    g.beginPath(); g.ellipse(rand() * W, rand() * H, rr(10, 60), rr(4, 20), 0, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
});

// ---- WALL FINISHES ---------------------------------------------------------
// Same shed, four linings. Sheet steel is the honest industrial one; the other
// three are what a shed becomes once someone has spent winters in it. Each is a
// drawn albedo — the difference between them is what the surface has been
// through, not a tint.
const timberAlb = sheet(1024, 512, (g, W, H) => {
  g.fillStyle = '#9a7146'; g.fillRect(0, 0, W, H);
  const nb = 14, bh = H / nb;                     // horizontal boarding
  for (let r = 0; r < nb; r++) {
    const y = r * bh;
    g.globalAlpha = 1;
    const warm = rr(0.86, 1.12);
    g.fillStyle = 'rgb(' + Math.round(154 * warm) + ',' + Math.round(113 * warm) + ',' + Math.round(70 * warm) + ')';
    g.fillRect(0, y, W, bh - 1);
    for (let i = 0; i < 26; i++) {                // grain
      g.globalAlpha = rr(0.04, 0.13);
      g.fillStyle = rand() < 0.5 ? '#6b4a29' : '#c2a072';
      const yy = y + rand() * bh;
      g.beginPath(); g.moveTo(0, yy);
      for (let x = 0; x <= W; x += 64) g.lineTo(x, yy + Math.sin(x * 0.02 + r) * 1.6);
      g.lineWidth = rr(0.6, 2.4); g.strokeStyle = g.fillStyle; g.stroke();
    }
    g.globalAlpha = 1;
    for (let i = 0; i < 3; i++) {                 // knots
      if (rand() > 0.5) continue;
      const kx = rand() * W, ky = y + bh * 0.5, kr = rr(3, 7);
      g.fillStyle = 'rgba(84,56,30,.65)';
      g.beginPath(); g.ellipse(kx, ky, kr, kr * 0.7, 0, 0, 7); g.fill();
    }
    g.fillStyle = 'rgba(58,40,22,.45)'; g.fillRect(0, y + bh - 2, W, 2);
    g.fillStyle = 'rgba(214,186,146,.16)'; g.fillRect(0, y, W, 1.5);
  }
  for (let i = 0; i < 26; i++) {                  // the odd nail
    g.fillStyle = 'rgba(50,42,34,.5)';
    g.beginPath(); g.arc(rand() * W, rand() * H, 1.8, 0, 7); g.fill();
  }
});
timberAlb.repeat.set(3, 1);

const brickAlb = sheet(1024, 512, (g, W, H) => {
  g.fillStyle = '#6d5b4c'; g.fillRect(0, 0, W, H);          // mortar
  const rows = 22, bw = W / 11, bh = H / rows;
  for (let r = 0; r < rows; r++) {
    const y = r * bh, off = (r % 2) * bw / 2;
    for (let c = -1; c < 12; c++) {
      const t = rand();
      const base = t < 0.12 ? [122, 62, 48] : t < 0.3 ? [150, 84, 60] : t < 0.85 ? [136, 74, 54] : [112, 70, 58];
      const k = rr(0.88, 1.12);
      g.fillStyle = 'rgb(' + Math.round(base[0]*k) + ',' + Math.round(base[1]*k) + ',' + Math.round(base[2]*k) + ')';
      g.fillRect(c * bw + off + 1.5, y + 1.5, bw - 3, bh - 3);
      g.globalAlpha = rr(0.05, 0.16);              // face mottle
      g.fillStyle = rand() < 0.5 ? '#5a3428' : '#a3705a';
      g.fillRect(c * bw + off + 1.5, y + 1.5, bw - 3, bh - 3);
      g.globalAlpha = 1;
    }
  }
  for (let i = 0; i < 200; i++) {                  // soot and damp
    g.globalAlpha = rr(0.02, 0.09);
    g.fillStyle = rand() < 0.5 ? '#3a2a22' : '#8d7f70';
    g.beginPath(); g.arc(rand() * W, rand() * H, rr(6, 40), 0, 7); g.fill();
  }
  g.globalAlpha = 1;
});
brickAlb.repeat.set(3, 1);

const limeAlb = sheet(1024, 512, (g, W, H) => {
  g.fillStyle = '#d9d2c2'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 420; i++) {                  // brush and patch
    g.globalAlpha = rr(0.02, 0.09);
    g.fillStyle = rand() < 0.55 ? '#eee8da' : '#b8b0a0';
    g.beginPath(); g.ellipse(rand() * W, rand() * H, rr(14, 90), rr(6, 26), rand(), 0, 7); g.fill();
  }
  const rows = 16, bw = W / 9, bh = H / rows;      // the block still shows through
  g.globalAlpha = 0.12; g.fillStyle = '#8e8676';
  for (let r = 0; r < rows; r++) {
    const y = r * bh, off = (r % 2) * bw / 2;
    g.fillRect(0, y, W, 1.6);
    for (let c = -1; c < 10; c++) g.fillRect(c * bw + off, y, 1.6, bh);
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 120; i++) {                  // scuffs, and damp at the foot
    const y = H - Math.pow(rand(), 2.0) * H * 0.35;
    g.globalAlpha = rr(0.03, 0.11);
    g.fillStyle = rand() < 0.5 ? '#9a9080' : '#7c6f5c';
    g.beginPath(); g.arc(rand() * W, y, rr(5, 26), 0, 7); g.fill();
  }
  g.globalAlpha = 1;
});
limeAlb.repeat.set(3, 1);

// ---- height -> normal ------------------------------------------------------
// One converter, used by every surface that wants relief: draw a GREYSCALE
// height field and Sobel it. Cheaper to author than hand-drawn normals and it
// cannot disagree with the albedo, because both are drawn by the same code.
const normalFromHeight = (w, hgt, draw, strength) => {
  const c = document.createElement('canvas'); c.width = w; c.height = hgt;
  const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, w, hgt);
  draw(g, w, hgt);
  const src = g.getImageData(0, 0, w, hgt).data;
  const out = g.createImageData(w, hgt);
  const S = strength == null ? 2.2 : strength;
  const at = (x, y) => src[((y + hgt) % hgt * w + (x + w) % w) * 4] / 255;
  for (let y = 0; y < hgt; y++) for (let x = 0; x < w; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * S;
    const dy = (at(x, y + 1) - at(x, y - 1)) * S;
    const L = Math.hypot(dx, dy, 1);
    const o = (y * w + x) * 4;
    out.data[o] = (-dx / L * 0.5 + 0.5) * 255;
    out.data[o + 1] = (-dy / L * 0.5 + 0.5) * 255;
    out.data[o + 2] = (1 / L * 0.5 + 0.5) * 255;
    out.data[o + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = (typeof window !== "undefined" && window.FLYDIY_ANISO) || 8;
  return t;
};

// ---- the doors -------------------------------------------------------------
// Vertical corrugation, not the wall's horizontal profile — a sliding leaf is
// sheeted up and down so the water runs off it, and getting that wrong is the
// first thing that reads as wrong on a hangar door.
const doorAlb = sheet(512, 512, (g, W, H) => {
  g.fillStyle = '#33503c'; g.fillRect(0, 0, W, H);
  const nR = 18, rw = W / nR;
  for (let i = 0; i < nR; i++) {                    // shaded corrugation
    const x = i * rw;
    const lg = g.createLinearGradient(x, 0, x + rw, 0);
    lg.addColorStop(0, 'rgba(0,0,0,.30)');
    lg.addColorStop(0.42, 'rgba(255,255,255,.10)');
    lg.addColorStop(0.62, 'rgba(255,255,255,.04)');
    lg.addColorStop(1, 'rgba(0,0,0,.26)');
    g.fillStyle = lg; g.fillRect(x, 0, rw, H);
  }
  for (let i = 0; i < 260; i++) {                   // weathering, chalked paint
    g.globalAlpha = rr(0.02, 0.10);
    g.fillStyle = rand() < 0.45 ? '#6d8a72' : rand() < 0.6 ? '#22301f' : '#7a5a34';
    g.beginPath(); g.ellipse(rand() * W, rand() * H, rr(4, 34), rr(10, 70), 0, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 40; i++) {                    // rust creeping up from the sill
    const y = H - Math.pow(rand(), 2.4) * H * 0.4;
    g.globalAlpha = rr(0.05, 0.22);
    g.fillStyle = '#7c4a24';
    g.beginPath(); g.ellipse(rand() * W, y, rr(3, 12), rr(8, 40), 0, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
});
// metric-uv re-base (G41): 2 tiles per 5.15 m leaf, one per door height
doorAlb.repeat.set(2 / 5.15, 1 / 6.4);
const doorNrm = normalFromHeight(512, 512, (g, W, H) => {
  const nR = 18, rw = W / nR;
  for (let i = 0; i < nR; i++) {
    const x = i * rw;
    const lg = g.createLinearGradient(x, 0, x + rw, 0);
    lg.addColorStop(0, '#3a3a3a'); lg.addColorStop(0.5, '#e0e0e0'); lg.addColorStop(1, '#3a3a3a');
    g.fillStyle = lg; g.fillRect(x, 0, rw, H);
  }
}, 2.6);
doorNrm.repeat.set(2, 1);
const doorRgh = sheet(256, 256, (g, W, H) => {
  g.fillStyle = '#6e6e6e'; g.fillRect(0, 0, W, H);   // chalky paint, fairly matte
  for (let i = 0; i < 200; i++) {
    g.globalAlpha = rr(0.05, 0.2);
    g.fillStyle = rand() < 0.5 ? '#8f8f8f' : '#4a4a4a';
    g.beginPath(); g.arc(rand() * W, rand() * H, rr(6, 40), 0, 7); g.fill();
  }
  g.globalAlpha = 1;
}, true);
doorRgh.repeat.set(2, 1);

// ---- wall relief, one per finish -------------------------------------------
const timberNrm = normalFromHeight(512, 256, (g, W, H) => {
  const nb = 14, bh = H / nb;
  for (let r = 0; r < nb; r++) {
    const y = r * bh;
    const lg = g.createLinearGradient(0, y, 0, y + bh);
    lg.addColorStop(0, '#c9c9c9'); lg.addColorStop(0.75, '#9a9a9a'); lg.addColorStop(1, '#3c3c3c');
    g.fillStyle = lg; g.fillRect(0, y, W, bh);
  }
}, 2.0);
timberNrm.repeat.set(3, 1);
const brickNrm = normalFromHeight(512, 256, (g, W, H) => {
  g.fillStyle = '#3a3a3a'; g.fillRect(0, 0, W, H);          // mortar, recessed
  const rows = 22, bw = W / 11, bh = H / rows;
  for (let r = 0; r < rows; r++) {
    const y = r * bh, off = (r % 2) * bw / 2;
    for (let c = -1; c < 12; c++) {
      g.fillStyle = '#c8c8c8';
      g.fillRect(c * bw + off + 1.5, y + 1.5, bw - 3, bh - 3);
    }
  }
}, 2.4);
brickNrm.repeat.set(3, 1);
const limeNrm = normalFromHeight(512, 256, (g, W, H) => {
  g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, W, H);
  const rows = 16, bw = W / 9, bh = H / rows;
  g.fillStyle = '#6a6a6a';
  for (let r = 0; r < rows; r++) {
    const y = r * bh, off = (r % 2) * bw / 2;
    g.fillRect(0, y, W, 2);
    for (let c = -1; c < 10; c++) g.fillRect(c * bw + off, y, 2, bh);
  }
  for (let i = 0; i < 200; i++) {                            // trowel texture
    g.globalAlpha = rr(0.05, 0.16);
    g.fillStyle = rand() < 0.5 ? '#a8a8a8' : '#707070';
    g.beginPath(); g.ellipse(rand() * W, rand() * H, rr(10, 50), rr(4, 16), rand(), 0, 7); g.fill();
  }
  g.globalAlpha = 1;
}, 1.4);
limeNrm.repeat.set(3, 1);
// one grime sheet, shared: nothing is uniformly rough
const wallRgh = sheet(512, 256, (g, W, H) => {
  g.fillStyle = '#b4b4b4'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 300; i++) {
    g.globalAlpha = rr(0.04, 0.16);
    g.fillStyle = rand() < 0.5 ? '#dcdcdc' : '#8a8a8a';
    g.beginPath(); g.ellipse(rand() * W, rand() * H, rr(12, 90), rr(8, 40), rand(), 0, 7); g.fill();
  }
  g.globalAlpha = 1;
}, true);
wallRgh.repeat.set(3, 1);

// ---- FLOOR FINISHES --------------------------------------------------------
// The slab is half the room's light: it is the biggest surface, and everything
// glossy in here reflects it. Four of them, from the burnished concrete it is
// poured as to the resin a tidy shop rolls on.
const epoxyAlb = sheet(1024, 1024, (g, W, H) => {
  g.fillStyle = '#4a5a58'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) {                 // roller mottle, flow lines
    g.globalAlpha = rr(0.02, 0.07);
    g.fillStyle = rand() < 0.5 ? '#5f716e' : '#3b4846';
    g.beginPath(); g.ellipse(rand() * W, rand() * H, rr(30, 200), rr(10, 50), rand(), 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  g.strokeStyle = 'rgba(24,30,29,.5)'; g.lineWidth = 4;    // the saw cuts still telegraph
  for (let i = 1; i < 6; i++) {
    const p = i / 6 * W;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, H); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(W, p); g.stroke();
  }
  g.strokeStyle = 'rgba(222,186,70,.7)'; g.lineWidth = 10;
  g.beginPath(); g.moveTo(0.12 * W, 0); g.lineTo(0.12 * W, H); g.stroke();
  g.beginPath(); g.moveTo(0.88 * W, 0); g.lineTo(0.88 * W, H); g.stroke();
});
const epoxyRgh = sheet(512, 512, (g, W, H) => {
  g.fillStyle = '#1c1c1c'; g.fillRect(0, 0, W, H);          // near-gloss resin
  for (let i = 0; i < 300; i++) {
    g.globalAlpha = rr(0.04, 0.16);
    g.fillStyle = rand() < 0.5 ? '#2e2e2e' : '#101010';
    g.beginPath(); g.ellipse(rand() * W, rand() * H, rr(30, 160), rr(14, 60), rand(), 0, 7); g.fill();
  }
  g.globalAlpha = 1;
}, true);
const wornAlb = sheet(1024, 1024, (g, W, H) => {
  g.fillStyle = '#726c62'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 1400; i++) {                // exposed aggregate
    g.globalAlpha = rr(0.03, 0.14);
    g.fillStyle = rand() < 0.5 ? '#958f83' : '#565049';
    g.beginPath(); g.arc(rand() * W, rand() * H, rr(2, 9), 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 26; i++) {                  // patches and repairs
    g.globalAlpha = rr(0.10, 0.26);
    g.fillStyle = rand() < 0.5 ? '#807a6e' : '#5d574e';
    const x = rand() * W, y = rand() * H;
    g.beginPath();
    for (let k = 0; k <= 9; k++) {
      const a = k / 9 * 7, r = rr(30, 110);
      g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    g.fill();
  }
  g.globalAlpha = 1;
  g.strokeStyle = 'rgba(40,37,33,.5)'; g.lineWidth = 3;   // cracks
  for (let i = 0; i < 22; i++) {
    let x = rand() * W, y = rand() * H;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 7; k++) { x += rr(-70, 70); y += rr(-70, 70); g.lineTo(x, y); }
    g.stroke();
  }
});
const wornRgh = sheet(512, 512, (g, W, H) => {
  g.fillStyle = '#b0b0b0'; g.fillRect(0, 0, W, H);          // dry, barely reflective
  for (let i = 0; i < 300; i++) {
    g.globalAlpha = rr(0.05, 0.18);
    g.fillStyle = rand() < 0.5 ? '#d0d0d0' : '#8c8c8c';
    g.beginPath(); g.arc(rand() * W, rand() * H, rr(20, 120), 0, 7); g.fill();
  }
  g.globalAlpha = 1;
}, true);
const woodFlAlb = sheet(1024, 1024, (g, W, H) => {
  g.fillStyle = '#8a6437'; g.fillRect(0, 0, W, H);
  const nb = 20, bw = W / nb;
  for (let i = 0; i < nb; i++) {                  // boards, end joints staggered
    const x = i * bw, k = rr(0.85, 1.15);
    g.fillStyle = 'rgb(' + Math.round(138 * k) + ',' + Math.round(100 * k) + ',' + Math.round(55 * k) + ')';
    g.fillRect(x, 0, bw - 1, H);
    for (let j = 0; j < 40; j++) {
      g.globalAlpha = rr(0.03, 0.12);
      g.strokeStyle = rand() < 0.5 ? '#5b3f20' : '#b18f5e';
      g.lineWidth = rr(0.6, 2.2);
      const xx = x + rand() * bw;
      g.beginPath(); g.moveTo(xx, 0);
      for (let y = 0; y <= H; y += 64) g.lineTo(xx + Math.sin(y * 0.02 + i) * 2.0, y);
      g.stroke();
    }
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(48,32,16,.45)'; g.fillRect(x + bw - 2, 0, 2, H);
    const jy = rand() * H;                        // the odd end joint
    g.fillRect(x, jy, bw, 2);
  }
  for (let i = 0; i < 300; i++) {                 // wear down the traffic lines
    g.globalAlpha = rr(0.02, 0.08);
    g.fillStyle = rand() < 0.5 ? '#c6a578' : '#4a3218';
    g.beginPath(); g.ellipse(rand() * W, rand() * H, rr(20, 120), rr(30, 180), 0, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
});
const woodFlRgh = sheet(512, 512, (g, W, H) => {
  g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 240; i++) {
    g.globalAlpha = rr(0.05, 0.2);
    g.fillStyle = rand() < 0.5 ? '#6a6a6a' : '#a6a6a6';
    g.beginPath(); g.ellipse(rand() * W, rand() * H, rr(20, 120), rr(8, 40), 0, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
}, true);
for (const t of [epoxyAlb, epoxyRgh, wornAlb, wornRgh, woodFlAlb, woodFlRgh]) t.repeat.set(1, 1);

// ---- floor relief ----------------------------------------------------------
// Slabs are not flat: there is a saw cut every four metres and the trowel
// leaves a swirl. Small amplitudes on purpose — a floor that reads bumpy reads
// as gravel.
const slabNrm = normalFromHeight(512, 512, (g, W, H) => {
  g.fillStyle = '#808080'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 240; i++) {                       // trowel swirl
    g.globalAlpha = 0.10;
    g.fillStyle = rand() < 0.5 ? '#8e8e8e' : '#727272';
    g.beginPath(); g.ellipse(rand() * W, rand() * H, rr(40, 200), rr(16, 70), rand(), 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  g.strokeStyle = '#3a3a3a'; g.lineWidth = 5;           // the saw cuts
  for (let i = 1; i < 5; i++) {
    const p = i / 5 * W;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, H); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(W, p); g.stroke();
  }
}, 1.6);
const gritNrm = normalFromHeight(512, 512, (g, W, H) => {
  g.fillStyle = '#808080'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2200; i++) {                      // exposed aggregate
    g.fillStyle = rand() < 0.5 ? '#b4b4b4' : '#5c5c5c';
    g.beginPath(); g.arc(rand() * W, rand() * H, rr(2, 7), 0, 7); g.fill();
  }
  g.strokeStyle = '#4a4a4a'; g.lineWidth = 3;           // cracks, as grooves
  for (let i = 0; i < 20; i++) {
    let x = rand() * W, y = rand() * H;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 7; k++) { x += rr(-70, 70); y += rr(-70, 70); g.lineTo(x, y); }
    g.stroke();
  }
}, 1.8);
const boardNrm = normalFromHeight(512, 512, (g, W, H) => {
  g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, W, H);
  const nb = 20, bw = W / nb;
  for (let i = 0; i < nb; i++) {                        // each board crowns
    const x = i * bw;
    const lg = g.createLinearGradient(x, 0, x + bw, 0);
    lg.addColorStop(0, '#4c4c4c'); lg.addColorStop(0.18, '#a4a4a4');
    lg.addColorStop(0.82, '#a4a4a4'); lg.addColorStop(1, '#4c4c4c');
    g.fillStyle = lg; g.fillRect(x, 0, bw, H);
  }
}, 1.5);
for (const t of [slabNrm, gritNrm, boardNrm]) t.repeat.set(1, 1);

// THE FLOOR WEARS A SCANNED SLAB when the payload is present (G37, user):
// concrete_floor_damaged_01 (Poly Haven CC0), one tile = 5 m of real
// floor, carried by src/viewer/hangar_floor.js as pre-decoding images.
// The baked canvas floor stays the fallback, so a payload-less build
// (and the smoke gate's stub) still stands. The material object joins M
// either way, so the moods' envMapIntensity scaling covers it unchanged.
const FLOOR_IMG = (typeof HANGAR_FLOOR_IMG !== 'undefined') ? HANGAR_FLOOR_IMG : null;
const floorTex = (img, srgb) => {
  const t = new THREE.Texture(img);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = (typeof window !== "undefined" && window.FLYDIY_ANISO) || 8;
  if (srgb) t.encoding = THREE.sRGBEncoding;
  // the floor plane carries METRIC uvs since G41 — one tile = tile metres
  const tile = (typeof HANGAR_FLOOR_TILE_M === 'number') ? HANGAR_FLOOR_TILE_M : 5;
  t.repeat.set(1 / tile, 1 / tile);
  const ok = () => { t.needsUpdate = true; };
  if (img.complete && img.naturalWidth) ok(); else img.onload = ok;
  return t;
};

const M = {
  floor: FLOOR_IMG
    ? new THREE.MeshStandardMaterial({ map: floorTex(FLOOR_IMG.diff, true),
        roughnessMap: floorTex(FLOOR_IMG.rough),
        normalMap: floorTex(FLOOR_IMG.nor),
        normalScale: new THREE.Vector2(1, 1),
        roughness: 1, metalness: 0.06, envMapIntensity: 1.7 })
    : new THREE.MeshStandardMaterial({ map: floorAlb, roughnessMap: floorRgh,
        normalMap: slabNrm, normalScale: new THREE.Vector2(0.35, 0.35),
        roughness: 1, metalness: 0.12, envMapIntensity: 1.7 }),
  wall: new THREE.MeshStandardMaterial({ map: wallAlb, normalMap: corrNrm,
    normalScale: new THREE.Vector2(0.8, 0.8), roughnessMap: wallRgh,
    roughness: 0.70, metalness: 0.14, side: THREE.DoubleSide }),
  // roofAlb re-based (G41): the quad's old uvScale 6 became metric uv
  roofIn: new THREE.MeshStandardMaterial({ map: roofAlb, normalMap: corrNrm,
    normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.80, metalness: 0.10,
    side: THREE.FrontSide }),
  roofOut: new THREE.MeshStandardMaterial({ map: wallOutAlb, roughness: 0.86,
    metalness: 0.10, side: THREE.FrontSide }),
  wallOut: new THREE.MeshStandardMaterial({ map: wallOutAlb, roughness: 0.85,
    metalness: 0.10, side: THREE.BackSide }),
  stem: new THREE.MeshStandardMaterial({ map: blockAlb, roughness: 0.94 }),
  // the doors: corrugation running VERTICALLY, and a coat of paint that has
  // been in the weather since somebody's father hung them
  door: new THREE.MeshStandardMaterial({ map: doorAlb, normalMap: doorNrm,
    normalScale: new THREE.Vector2(0.9, 0.9), roughnessMap: doorRgh,
    roughness: 1, metalness: 0.20 }),
  doorTrim: new THREE.MeshStandardMaterial({ color: 0x2f4436, roughness: 0.62,
    metalness: 0.35 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x565c63, roughness: 0.44, metalness: 0.85 }),
  steelDark: new THREE.MeshStandardMaterial({ color: 0x33383e, roughness: 0.55, metalness: 0.70 }),
  paintGreen: new THREE.MeshStandardMaterial({ color: 0x3c5a4a, roughness: 0.52, metalness: 0.18 }),
  paintRed: new THREE.MeshStandardMaterial({ color: 0x9a2f26, roughness: 0.42, metalness: 0.22 }),
  paintBlue: new THREE.MeshStandardMaterial({ color: 0x27455e, roughness: 0.48, metalness: 0.20 }),
  wood: new THREE.MeshStandardMaterial({ map: woodAlb, roughness: 0.74, metalness: 0 }),
  woodPale: new THREE.MeshStandardMaterial({ color: 0xc2a276, roughness: 0.80 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xdce8f0, roughness: 0.06, metalness: 0,
    // `thickness` is r132+ and this build is r128: transmission alone, with
    // the opacity carrying what the refraction slab would have.
    transmission: 0.90, transparent: true, opacity: 0.5,
    envMapIntensity: 1.4, side: THREE.DoubleSide }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x22242a, roughness: 0.95 }),
  // the filament itself: emissive, unlit by anything else, and scaled with the
  // moods like every other material in here
  bulb: new THREE.MeshStandardMaterial({ color: 0x1a1206, roughness: 0.35,
    emissive: 0xffcc7a, emissiveIntensity: 2.2 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb08d4a, roughness: 0.32, metalness: 0.9 }),
  alu: new THREE.MeshStandardMaterial({ color: 0xa8adb3, roughness: 0.30, metalness: 0.92 }),
  canvasM: new THREE.MeshStandardMaterial({ color: 0xa89a80, roughness: 0.95 }),
  lampWarm: new THREE.MeshStandardMaterial({ color: 0xffe6b8, emissive: 0xffcf87,
    emissiveIntensity: 3.2, roughness: 0.6 }),
  // THE ROOF PANE IS GLAZING, not a lit panel (G56, user: "I can't see the HDRI
  // through the roof windows, did you remove the mesh?"). The mesh was never
  // removed and the hole is genuinely cut — but this material was an OPAQUE
  // emissive, so the opening was filled by a glowing sheet and the sky behind
  // it was never in the picture. Transparent now, with the emissive kept as the
  // milky wash a diffusing rooflight really has over what you can see through
  // it; depthWrite off so the sky sphere sorts behind it rather than being
  // rejected by its own depth.
  skyPanel: new THREE.MeshStandardMaterial({ color: 0xdfeaf6, emissive: 0xcfe2f7,
    emissiveIntensity: 1.7, roughness: 0.9, side: THREE.DoubleSide,
    transparent: true, opacity: 0.30, depthWrite: false }),
  daylight: new THREE.MeshBasicMaterial({ color: 0xf2ecdc, side: THREE.FrontSide }),
};
// DEDICATED PART MATERIALS (G41, user: assign materials to parts of the
// hangar). Parts the library dresses independently need their OWN
// instances — M.wall was every interior wall, M.steel every piece of
// steel — split here so the part system below can dress one without
// dressing them all. Same authored numbers as their parents.
M.wallBack = M.wall.clone();
M.beamMain = M.steel.clone();
M.beamSec = M.steelDark.clone();
M.manDoor = M.paintGreen.clone();

// ---- primitive helpers ----------------------------------------------------
const G = new THREE.Group();                 // everything static
const box = (w, h, d, mat, x, y, z, ry) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); if (ry) m.rotation.y = ry;
  m.castShadow = m.receiveShadow = true;
  return m;
};
// A WALL BOX CARRIES METRIC, WORLD-ALIGNED UVs (G40, user: "get the
// textures projected coherently — same size, no stretching"). BoxGeometry
// UVs run 0..1 per face, so a texture stretches with the face; here every
// vertex instead takes its WORLD coordinates (metres) along the face's
// two in-plane axes, so one texture.repeat = 1/tileM projects every wall
// piece at the same real size, and adjacent bands stay continuous (the
// world offset rides in the uv rather than restarting per box). Walls are
// axis-aligned translated boxes — no ry — which is what makes this exact.
// Only the WALL pieces use it: everything else keeps the 0..1 grammar its
// baked sheets were authored in.
const mbox = (w, h, d, mat, x, y, z) => {
  const m = box(w, h, d, mat, x, y, z);
  const g = m.geometry, pos = g.attributes.position,
        nrm = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i));
    const px = pos.getX(i) + x, py = pos.getY(i) + y, pz = pos.getZ(i) + z;
    if (nx > 0.5) uv.setXY(i, pz, py);          // side faces: (z, y)
    else if (ny > 0.5) uv.setXY(i, px, pz);     // top/bottom: (x, z)
    else uv.setXY(i, px, py);                   // front/back: (x, y)
  }
  uv.needsUpdate = true;
  return m;
};
const cyl = (r1, r2, h, mat, x, y, z, seg) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg || 18), mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
};
const put = (...m) => { for (const x of m) G.add(x); return m[0]; };
// FOUR CORNERS, in order. A sloping roof panel is a quadrilateral in space and
// the honest way to build one is to say where its corners are — chaining
// rotation.set() with rotateX() to tip a PlaneGeometry into the slope is what
// had the deck facing outward and the roof lights lying in a different plane
// from the roof they are supposed to be holes in.
const quad = (a, b, c, d, mat, uvScale) => {
  const g2 = new THREE.BufferGeometry();
  g2.setAttribute('position', new THREE.Float32BufferAttribute(
    [...a, ...b, ...c, ...a, ...c, ...d], 3));
  // uvScale: a number (square, the original grammar) or [uw, vh] —
  // the metric form the part system's surfaces use (G41)
  const us = uvScale || 1,
        uw = Array.isArray(us) ? us[0] : us,
        vh = Array.isArray(us) ? us[1] : us;
  g2.setAttribute('uv', new THREE.Float32BufferAttribute(
    [0, 0, uw, 0, uw, vh, 0, 0, uw, vh, 0, vh], 2));
  g2.computeVertexNormals();
  const m = new THREE.Mesh(g2, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
};
// a beam between two points, so a truss can be described by its geometry
const strut = (a, b, r, mat, seg) => {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const d = B.clone().sub(A), L = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, seg || 8), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  m.castShadow = true;
  return m;
};

// ===========================================================================
// SHELL
// ===========================================================================
const roofY = z => EAVE + (RIDGE - EAVE) * (1 - Math.abs(z) / HW);

// floor, and an apron outside the door so the eye does not fall off the world
{
  const f = new THREE.Mesh(new THREE.PlaneGeometry(2 * HD, 2 * HW), M.floor);
  { const uv = f.geometry.attributes.uv;      // metric uvs (G41)
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, uv.getX(i) * 2 * HD, uv.getY(i) * 2 * HW);
    uv.needsUpdate = true; }
  f.rotation.x = -Math.PI / 2; f.receiveShadow = true;
  put(f);
  const ap = new THREE.Mesh(new THREE.PlaneGeometry(26, 2 * HW),
    new THREE.MeshStandardMaterial({ color: 0x9a958a, roughness: 0.95 }));
  ap.rotation.x = -Math.PI / 2; ap.position.set(-HD - 13, -0.01, 0);
  ap.receiveShadow = true;
  put(ap);
}

// side walls: concrete stem, corrugated above, glazing band between
for (const s of [1, -1]) {
  put(mbox(2 * HD, 1.1, 0.25, M.stem, 0, 0.55, s * HW));
  // lower sheeting to the sill
  put(mbox(2 * HD, 2.1, 0.12, M.wall, 0, 2.15, s * HW));
  // upper sheeting, sill 3.2 to eaves
  put(mbox(2 * HD, EAVE - 5.2, 0.12, M.wall, 0, 5.2 + (EAVE - 5.2) / 2, s * HW));
  // THE OUTER SKIN IS CUT FOR THE GLAZING (user: "can we properly cut into the
  // hangar for the windows?"). It used to be one slab from the ground to the
  // eaves standing OUTSIDE the band, so every window in the room looked at
  // sheet steel with the sky nowhere in it. Now it is the same three bands the
  // inner skin already had, plus a strip on each mullion — the panes are the
  // only thing left open, and they see the sky sphere.
  const nBay = 9, bayW = (2 * HD) / nBay;
  const SILL = 3.2, HEAD = 5.2, zOut = s * (HW + 0.16);
  put(box(2 * HD + 0.4, SILL, 0.06, M.wallOut, 0, SILL / 2, zOut));
  put(box(2 * HD + 0.4, EAVE + 0.4 - HEAD, 0.06, M.wallOut, 0,
          HEAD + (EAVE + 0.4 - HEAD) / 2, zOut));
  for (let i = 0; i <= nBay; i++) {
    // the two ends carry the skin's 0.2 m overhang as well as the mullion
    const end = i === 0 ? -1 : i === nBay ? 1 : 0;
    put(box(0.25 + (end ? 0.2 : 0), HEAD - SILL, 0.06, M.wallOut,
            -HD + bayW * i + end * 0.1, (SILL + HEAD) / 2, zOut));
  }
  // THE GLAZING BAND. Industrial steel windows, 3.2 to 5.2 m: high enough to
  // light the whole floor and clear a wing, which is why real hangars glaze
  // exactly there.
  for (let i = 0; i < nBay; i++) {
    const cx = -HD + bayW * (i + 0.5);
    const gl = box(bayW - 0.25, 2.0, 0.03, M.glass, cx, 4.2, s * HW);
    gl.castShadow = false;
    put(gl);
    put(box(bayW - 0.25, 0.09, 0.16, M.steelDark, cx, 3.2, s * HW),
        box(bayW - 0.25, 0.09, 0.16, M.steelDark, cx, 5.2, s * HW),
        box(0.10, 2.0, 0.16, M.steelDark, cx - (bayW - 0.25) / 2, 4.2, s * HW),
        box(0.10, 2.0, 0.16, M.steelDark, cx + (bayW - 0.25) / 2, 4.2, s * HW));
    for (let k = 1; k < 4; k++)                              // glazing bars
      put(box(0.05, 2.0, 0.13, M.steelDark,
              cx - (bayW - 0.25) / 2 + (bayW - 0.25) * k / 4, 4.2, s * HW));
    put(box(bayW - 0.25, 0.04, 0.13, M.steelDark, cx, 4.2, s * HW));
  }
}

// back wall (+x), with a personnel door and a high window
{
  // CUT FOR THE GABLE WINDOW, in four pieces round the opening — the pane used
  // to be laid on the inside of a solid wall, which is a picture of a window.
  const gwY0 = EAVE - 2.1, gwY1 = EAVE - 0.5, gwZ = 2.1;
  put(mbox(0.14, gwY0, 2 * HW, M.wallBack, HD, gwY0 / 2, 0));
  put(mbox(0.14, EAVE - gwY1, 2 * HW, M.wallBack, HD, gwY1 + (EAVE - gwY1) / 2, 0));
  for (const sd of [-1, 1])
    put(mbox(0.14, gwY1 - gwY0, HW - gwZ, M.wallBack, HD,
             (gwY0 + gwY1) / 2, sd * (HW + gwZ) / 2));
  // THE STEM RUNS ROUND THE BACK TOO (G41, user: "I like the brick
  // bottom on the sides ... add that to the back") — same course, same
  // height, interrupted where the personnel door stands.
  put(mbox(0.25, 1.1, 13.0 + HW, M.stem, HD, 0.55, (13.0 - HW) / 2));
  put(mbox(0.25, 1.1, HW - 14.0, M.stem, HD, 0.55, (14.0 + HW) / 2));
  const gable = new THREE.Shape();
  gable.moveTo(-HW, EAVE); gable.lineTo(HW, EAVE); gable.lineTo(0, RIDGE);
  const gm = new THREE.Mesh(new THREE.ShapeGeometry(gable), M.wallBack);
  gm.rotation.y = Math.PI / 2; gm.position.x = HD;
  gm.receiveShadow = true;
  put(gm);
  // gable window: the one that throws a long shape across the floor
  put(box(0.05, 1.6, 4.2, M.glass, HD - 0.10, EAVE - 1.3, 0));
  for (let k = 0; k <= 4; k++)
    put(box(0.10, 1.7, 0.08, M.steelDark, HD - 0.10, EAVE - 1.3, -2.1 + k * 1.05));
  put(box(0.12, 0.10, 4.3, M.steelDark, HD - 0.10, EAVE - 2.15, 0),
      box(0.12, 0.10, 4.3, M.steelDark, HD - 0.10, EAVE - 0.45, 0));
  put(mbox(0.10, 2.1, 0.95, M.manDoor, HD - 0.08, 1.05, 13.5));
  put(cyl(0.03, 0.03, 0.16, M.brass, HD - 0.16, 1.0, 13.15, 8));
}

// door wall (-x): a big sliding opening, leaves parked open, daylight beyond
{
  const side = (HW - DOOR_W / 2);
  for (const s of [1, -1])
    put(mbox(0.14, EAVE, side, M.wall, -HD, EAVE / 2, s * (DOOR_W / 2 + side / 2)));
  put(mbox(0.14, EAVE - DOOR_H, DOOR_W, M.wall, -HD, DOOR_H + (EAVE - DOOR_H) / 2, 0));
  const gable = new THREE.Shape();
  gable.moveTo(-HW, EAVE); gable.lineTo(HW, EAVE); gable.lineTo(0, RIDGE);
  const gm = new THREE.Mesh(new THREE.ShapeGeometry(gable), M.wall);
  gm.rotation.y = -Math.PI / 2; gm.position.x = -HD;
  put(gm);
  // header beam and the track the leaves hang from
  put(box(0.5, 0.55, DOOR_W + 1.2, M.steel, -HD + 0.1, DOOR_H + 0.28, 0));
  put(box(0.22, 0.14, 2 * HW - 1, M.steelDark, -HD + 0.45, DOOR_H + 0.62, 0));
  // THE LEAVES. Three a side, and three TRACKS a side, because that is the only
  // way a door this wide opens: each leaf needs its own rail to pass in front of
  // its neighbour, so they nest at the jamb three deep. The x offsets below ARE
  // those rails — 0.24 m apart, which is what the rollers and the hangers take.
  // Parked open, so the outermost leaf of each stack is the one you see.
  for (let t = 0; t < 3; t++)
    put(box(0.22, 0.14, 2 * HW - 1, M.steelDark, -HD + 0.34 + t * 0.24, DOOR_H + 0.62, 0));
  const LW = 5.15;                                   // leaf width
  for (const s of [1, -1]) for (let t = 0; t < 3; t++) {
    const x = -HD + 0.42 + t * 0.24;
    // PARKED, i.e. NESTED at the jamb: three leaves standing one behind another
    // in their own tracks, not spread across the opening. Each is 0.30 m further
    // in than the last, which is the stagger the hangers give.
    const leafZ = s * (DOOR_W / 2 - LW / 2 - t * 0.30);
    const g = new THREE.Group(); g.position.set(x, 0, leafZ);
    // the skin, on its own material so the corrugation runs vertically like a
    // real door and not horizontally like the wall behind it
    g.add(mbox(0.10, DOOR_H, LW, M.door, 0, DOOR_H / 2, 0));
    // frame: sill channel, head channel, two stiles, and the diagonal brace
    // every sliding leaf carries against racking
    g.add(box(0.14, 0.18, LW, M.doorTrim, 0.01, 0.11, 0),
          box(0.14, 0.20, LW, M.doorTrim, 0.01, DOOR_H - 0.12, 0));
    for (const e of [-1, 1])
      g.add(box(0.14, DOOR_H, 0.20, M.doorTrim, 0.01, DOOR_H / 2, e * (LW / 2 - 0.10)));
    for (const k of [1, 2])                          // two intermediate rails
      g.add(box(0.13, 0.13, LW - 0.4, M.doorTrim, 0.01, k * DOOR_H / 3, 0));
    for (const [y0, y1] of [[0.3, DOOR_H / 3 - 0.1], [DOOR_H / 3 + 0.1, 2 * DOOR_H / 3 - 0.1]])
      put(strut([x + 0.02, y0, leafZ - LW / 2 + 0.3], [x + 0.02, y1, leafZ + LW / 2 - 0.3],
                0.03, M.steelDark));
    // hangers and rollers up top, guide shoe at the foot
    for (const o of [-1, 1]) {
      g.add(box(0.10, 0.34, 0.12, M.steelDark, 0.01, DOOR_H + 0.30, o * LW * 0.3));
      const w = cyl(0.09, 0.09, 0.05, M.steel, 0.01, DOOR_H + 0.52, o * LW * 0.3, 12);
      w.rotation.x = Math.PI / 2; g.add(w);
      g.add(box(0.16, 0.10, 0.14, M.steelDark, 0.01, 0.05, o * LW * 0.34));
    }
    // one leaf a side gets the wicket door everybody actually uses
    if (t === 0) {
      g.add(box(0.06, 2.05, 0.86, M.doorTrim, -0.06, 1.03, s * 0.9));
      g.add(box(0.05, 1.92, 0.76, M.door, -0.10, 1.02, s * 0.9));
      const knob = cyl(0.028, 0.028, 0.12, M.brass, -0.16, 1.02, s * 0.9 - s * 0.30, 10);
      g.add(knob);
    }
    G.add(g);
  }
  // the daylight itself: a bright card in the opening, which is what the
  // environment bake reads as a big soft source from that end
  // faces INTO the shed only: from outside it was a white card hanging in the
  // air beside the building
  const day = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_W + 1, DOOR_H + 0.6), M.daylight);
  day.rotation.y = Math.PI / 2;
  day.position.set(-HD - 3.0, DOOR_H / 2, 0);
  put(day);
  M.dayCardMesh = day;      // the caller hides it once a real sky stands
}

// the quarter turn the single alps sky was hung at, and the fallback for a row
// that carries no yaw of its own
const SKY_YAW0 = Math.PI / 2;

// THE SKY (G41, user: "we need a proper HDRI ... something to look at
// outside"; a SET of them at G62). A tone-mapped equirect on a backdrop
// sphere round the shed — visible through the door, the glazing band and
// the gable window. Unlit and unfogged (the room fog would eat it). The
// daylight CARD stays for the environment bake (it is the big soft source
// that bake reads); the caller hides it after baking so the eye gets the
// mountains instead — see app.js.
//
// ONE SPHERE, FIVE SKIES (G62). The picture is not built here any more: it
// belongs to the mood, and `setSky` swaps it. The rows come from
// hangar_sky.js, they decode one at a time (a 4k equirect is 33 MB of
// bitmap), and the outgoing texture is disposed — a mood cycled round the
// clock a dozen times must not leave a dozen of them on the GPU.
const SKY_ROWS = (typeof HANGAR_SKIES !== 'undefined' && HANGAR_SKIES &&
                  HANGAR_SKIES.length) ? HANGAR_SKIES : null;
let skyMat = null, skyMesh = null, skyOnReady = null;
if (SKY_ROWS && THREE.MeshBasicMaterial && THREE.SphereGeometry) {
  skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false });
  // radius 600 (G44): far enough that the field and strip below never
  // poke through; the 4k equirect carries the extra screen coverage
  skyMesh = new THREE.Mesh(new THREE.SphereGeometry(600, 48, 24), skyMat);
  skyMesh.scale.x = -1;           // equirect reads right-way-round inside
  skyMesh.rotation.y = SKY_YAW0;  // per row; see setSky
  put(skyMesh);
}
function setSky(row) {
  if (!skyMat || !row || typeof row.img !== 'function') return;
  // WHICH WAY THE PANORAMA FACES is the row's, not the room's (G62). It used
  // to be a fixed quarter turn chosen to frame the alps' mountains out of the
  // door; each sky now carries the yaw that puts ITS sun where the row asked
  // for it (tools/sky_prep.py solves it from the measured sun and a wanted
  // offset off the door axis), and the alps' number is exactly the quarter
  // turn it always had.
  if (skyMesh) skyMesh.rotation.y = (row.yaw !== undefined) ? row.yaw : SKY_YAW0;
  const img = row.img();
  if (!img) return;
  const st = new THREE.Texture(img);
  st.encoding = THREE.sRGBEncoding;
  // the data URI decodes asynchronously; whoever baked an environment off
  // the old picture is told when the new one has actually landed
  const ok = () => { st.needsUpdate = true; if (skyOnReady) skyOnReady(); };
  if (img.complete && img.naturalWidth) ok();
  else img.addEventListener('load', ok);
  const was = skyMat.map;
  skyMat.map = st;
  skyMat.needsUpdate = true;      // a material that gains a map recompiles
  if (was && was.dispose) was.dispose();
}

// THE QUICK RUNWAY (G44, user: "model a quick runway ... put it
// outside"). The honest destination is the GAME's own scenery seen from
// the hangar (the P11 consistency goal, recorded at G41); until then, a
// grass field and a strip off the apron give the door somewhere to look.
// Canvas-baked like the rest of the room — no payload weight. The strip
// runs the door axis (-x), threshold just past the apron.
{
  const grassAlb = sheet(512, 512, (g, W2, H2) => {
    g.fillStyle = '#6d7c4e'; g.fillRect(0, 0, W2, H2);
    for (let i = 0; i < 2600; i++) {
      g.globalAlpha = rr(0.04, 0.14);
      g.fillStyle = rand() < 0.5 ? '#5c6b40' : '#87925c';
      g.beginPath();
      g.arc(rand() * W2, rand() * H2, rr(2, 14), 0, 7); g.fill();
    }
    g.globalAlpha = 1;
  }, false);
  grassAlb.repeat.set(1 / 9, 1 / 9);          // 9 m of grass per tile
  // THE HORIZON ROLL-OFF (G44.2, user: "you've made the terrain fade
  // into black ... curve it so we don't see the seams"). The black was
  // the room fog — tinted to the mood's dark INTERIOR colour — eating
  // the outdoors; the outdoor pieces now carry fog:false (real lights
  // dim them with the moods instead) and the ground CURVES down past
  // r0 = 160 m, so its edge rolls under the sky sphere's horizon and
  // there is no seam to see from the door.
  const R0 = 160, KDROP = 3.5e-4;
  const rollOff = (geo, posX, posZ) => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const wx = p.getX(i) + posX, wz = -p.getY(i) + posZ;
      const r = Math.hypot(wx, wz);
      if (r > R0) p.setZ(i, p.getZ(i) - KDROP * (r - R0) * (r - R0));
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();
  };
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(500, 500, 28, 28),
    new THREE.MeshStandardMaterial({ map: grassAlb, roughness: 0.96,
      metalness: 0, fog: false }));
  { const uv = grass.geometry.attributes.uv;   // metric, like the floor
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, uv.getX(i) * 500, uv.getY(i) * 500);
    uv.needsUpdate = true; }
  rollOff(grass.geometry, -150, 0);
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(-150, -0.05, 0);
  grass.receiveShadow = true;
  put(grass);
  // the strip: mown grass runway, edge-marked, a centreline of worn dirt
  const stripAlb = sheet(256, 1024, (g, W2, H2) => {
    g.fillStyle = '#77855a'; g.fillRect(0, 0, W2, H2);     // mown, lighter
    for (let i = 0; i < 900; i++) {
      g.globalAlpha = rr(0.05, 0.12);
      g.fillStyle = rand() < 0.5 ? '#6a7850' : '#8a9663';
      g.beginPath(); g.arc(rand() * W2, rand() * H2, rr(2, 10), 0, 7); g.fill();
    }
    g.globalAlpha = 0.5; g.fillStyle = '#9aa27a';           // wheel-worn pair
    g.fillRect(W2 * 0.40, 0, W2 * 0.055, H2);
    g.fillRect(W2 * 0.545, 0, W2 * 0.055, H2);
    g.globalAlpha = 1; g.fillStyle = '#e8e4d8';             // edge markers
    for (let k = 0; k < 10; k++) {
      g.fillRect(W2 * 0.03, (k + 0.45) * H2 / 10, W2 * 0.05, H2 / 46);
      g.fillRect(W2 * 0.92, (k + 0.45) * H2 / 10, W2 * 0.05, H2 / 46);
    }
    // threshold bar at the near end
    g.fillRect(W2 * 0.08, H2 - H2 / 60, W2 * 0.84, H2 / 90);
  }, false);
  // long axis along x (out the door): the geometry carries the length,
  // the texture turns 90° to follow it — no compound rotations to argue
  // with
  stripAlb.center.set(0.5, 0.5);
  stripAlb.rotation = Math.PI / 2;
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(320, 24, 22, 2),
    new THREE.MeshStandardMaterial({ map: stripAlb, roughness: 0.95,
      metalness: 0, fog: false }));
  rollOff(strip.geometry, -HD - 26 - 160, 0);   // rides the same curve
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(-HD - 26 - 160, -0.03, 0);
  strip.receiveShadow = true;
  put(strip);
}

// ---- roof: portal trusses, purlins, deck, roof lights ---------------------
{
  const NT = 7;
  for (let i = 0; i < NT; i++) {
    const x = -HD + 0.6 + (2 * HD - 1.2) * i / (NT - 1);
    // top chords to the ridge, bottom tie, king post, web diagonals —
    // the MAIN BEAMS of the part system (G41), on their own material
    put(strut([x, EAVE, -HW], [x, RIDGE, 0], 0.10, M.beamMain, 6),
        strut([x, EAVE, HW], [x, RIDGE, 0], 0.10, M.beamMain, 6),
        strut([x, EAVE - 0.05, -HW], [x, EAVE - 0.05, HW], 0.085, M.beamMain, 6),
        strut([x, EAVE, 0], [x, RIDGE - 0.1, 0], 0.06, M.beamMain, 6));
    for (const s of [1, -1]) for (const f of [0.34, 0.67]) {
      const zt = s * HW * f, yt = EAVE + (RIDGE - EAVE) * (1 - f);
      put(strut([x, EAVE, zt], [x, yt, zt], 0.045, M.beamMain, 6));
      put(strut([x, EAVE, s * HW * (f - 0.33)], [x, yt, zt], 0.04, M.beamMain, 6));
    }
    // stanchion down the wall, so the frame reads as a portal
    for (const s of [1, -1]) put(box(0.34, EAVE, 0.30, M.beamMain, x, EAVE / 2, s * (HW - 0.3)));
  }
  // THE SLOPE, as one function. Every roof surface, opening, pane and glazing
  // bar is placed through it, so none of them can drift out of the plane.
  const slopeP = (s, x, t) =>
    [x, RIDGE + (EAVE - RIDGE) * t, s * (HW + 0.5) * t];
  const LT0 = 0.30, LT1 = 0.62, LHW = 1.8, NLIGHT = 4;
  const lightX = k => -HD + 3.4 + k * (2 * HD - 6.8) / 3;
  // purlins and the deck underside — the SECONDARY BEAMS (G41)
  for (const s of [1, -1]) {
    for (let k = 0; k <= 6; k++) {
      const f = k / 6, z = s * HW * f, y = EAVE + (RIDGE - EAVE) * (1 - f) - 0.14;
      put(box(2 * HD - 1, 0.14, 0.10, M.beamSec, 0, y, z));
    }
    // ridge to eave, running the full depth. Wound so the normal faces DOWN
    // into the shed, which is the side anything in here can see.
    // THE DECK IS CUT FOR THE ROOF LIGHTS (G55, user: "the top windows could
    // also be properly cut plus a semi transparent surface and an
    // outline/chassis"). It used to be ONE quad per slope with four glowing
    // panels laid on top of it — a picture of a roof light, not a hole, and
    // the same mistake the side glazing had before G52. Now the slope is
    // emitted as a grid with the four openings missing from it, so what is
    // behind a roof light is the sky.
    //
    // t runs 0 at the ridge to 1 at the eave, and EVERYTHING on this slope —
    // deck, opening, glazing, frame — is placed through the same slopeP, so a
    // roof light cannot end up in a different plane from the hole it is in.
    const SLOPE = Math.hypot(RIDGE - EAVE, HW + 0.5), RW = 2 * HD + 0.6;
    const SX0 = -HD - 0.3, SX1 = HD + 0.3;
    const deck = (x0, x1, t0, t1) => {
      const a = slopeP(s, x0, t0), b = slopeP(s, x1, t0),
            c = slopeP(s, x1, t1), d = slopeP(s, x0, t1);
      const uv = [(x1 - x0) / RW * RW, (t1 - t0) * SLOPE];
      put(s > 0 ? quad(a, b, c, d, M.roofIn, uv) : quad(b, a, d, c, M.roofIn, uv));
      put(s > 0 ? quad(d, c, b, a, M.roofOut, 6) : quad(c, d, a, b, M.roofOut, 6));
    };
    deck(SX0, SX1, 0, LT0);                       // above the openings
    deck(SX0, SX1, LT1, 1);                       // below them
    let xc = SX0;                                 // and the piers between them
    for (let k = 0; k < NLIGHT; k++) {
      deck(xc, lightX(k) - LHW, LT0, LT1);
      xc = lightX(k) + LHW;
    }
    deck(xc, SX1, LT0, LT1);
  }
  put(box(2 * HD, 0.3, 0.7, M.beamSec, 0, RIDGE + 0.05, 0));
  // ROOF LIGHTS. Four openings down each slope — the reason the middle of a
  // hangar is not a cave, and the softest light in the scene. Each is a hole in
  // the deck (above), a semi-transparent pane sitting in it, a kerb round its
  // edge and two bars across: the frame is what makes a rooflight read as a
  // fitting rather than as a rectangle of brighter roof.
  for (const s of [1, -1]) for (let k = 0; k < NLIGHT; k++) {
    const x = lightX(k);
    const P = (dx, t) => slopeP(s, x + dx, t);
    // the pane, a hair below the deck plane so it never z-fights the kerb
    const drop = v => [v[0], v[1] - 0.02, v[2]];
    const a = drop(P(-LHW, LT0)), b = drop(P(LHW, LT0)),
          c = drop(P(LHW, LT1)), d = drop(P(-LHW, LT1));
    const p = s > 0 ? quad(a, b, c, d, M.skyPanel) : quad(b, a, d, c, M.skyPanel);
    p.castShadow = false;
    put(p);
    // THE KERB: a flat band inside the opening's edge, all four sides. Drawn as
    // quads in the slope's own plane rather than as boxes, because a box on a
    // sloping plane needs a rotation to be got wrong.
    const KX = 0.16, KT = 0.022, up = v => [v[0], v[1] + 0.015, v[2]];
    const band = (x0, x1, t0, t1) => {
      const q = [up(P(x0, t0)), up(P(x1, t0)), up(P(x1, t1)), up(P(x0, t1))];
      put(s > 0 ? quad(q[0], q[1], q[2], q[3], M.steelDark, 2)
                : quad(q[1], q[0], q[3], q[2], M.steelDark, 2));
    };
    band(-LHW, LHW, LT0, LT0 + KT);               // head
    band(-LHW, LHW, LT1 - KT, LT1);               // sill
    band(-LHW, -LHW + KX, LT0, LT1);              // jambs
    band(LHW - KX, LHW, LT0, LT1);
    for (let j = 1; j < 3; j++)                   // glazing bars across
      band(-LHW + 2 * LHW * j / 3 - 0.05, -LHW + 2 * LHW * j / 3 + 0.05, LT0, LT1);
  }
}

// ===========================================================================
// FITTINGS — the things that make it a place where aeroplanes get built
// ===========================================================================





// ---- THE PROP LIBRARY (G51) ------------------------------------------------
// The shed's furniture is no longer drawn. Every fitting that had a real prop
// in the library is placed from it instead — the drawn bench(), pegboard(),
// shelving(), toolChest(), drum(), tyreStack(), bottleRack(), stepladder(),
// partsTrolley() and the old stove corner are gone, and their calls below name
// a prop key instead. What is still drawn is what has no prop: the engine
// stand, the wing jig, the leaning propeller, the drawing board, the work
// platforms, the stock rack and the jack stands.
//
// Every prop was baked with its origin where it meets the world (see
// tools/props_table.py `place`), so a placement site gives x, z, a heading and
// — only for the wall and ceiling props — the height of the thing it hangs on.
// ASK, DO NOT ASSUME, exactly as the room does with THREE: a build without the
// prop packs still stands, it is just an emptier shed.
const PROPS_OK = typeof propPlace === 'function' &&
                 typeof PROP_REG !== 'undefined' && PROP_REG.order.length > 0;
// Everything that should print a ground shadow. prop() and the workshop feed
// it; the drawn fittings are pushed at their call sites. The BUILDING is not
// in it — a floor that occludes itself is a black floor.
const FURN = [];
function prop(key, x, z, ry, y, parent) {
  if (!PROPS_OK) return null;
  if (!PROP_REG.props[key]) { console.warn('hangar: no prop ' + key); return null; }
  const g = propPlace(THREE, key, x, z, ry, y);
  (parent || G).add(g);
  FURN.push(g);
  return g;
}

// ---- THE MOBILE KIT --------------------------------------------------------
// Everything else in this room is nailed to a wall, because that is what makes
// the middle of the floor read as the aeroplane's. These four are the
// exception the user asked for: the kit you actually walk over to the
// aeroplane with. The caller hands in the aeroplane's FOOTPRINT in the room's
// own frame (x aft, z spanwise, nose at -x) and they are placed on a clearance
// ring outside it — never inside the box, never further than a step from it,
// and re-placed whenever the aeroplane changes, so a DC-3 pushes them out and
// a drone lets them back in.
const MOBILE = new THREE.Group();
G.add(MOBILE);
function placeMobile(bb) {
  for (let i = MOBILE.children.length - 1; i >= 0; i--)
    MOBILE.remove(MOBILE.children[i]);
  if (!PROPS_OK || !bb || !isFinite(bb.x0)) return 0;
  const CLR = 1.15;                       // metres of daylight round the box
  // lim takes a MAGNITUDE, so the port side passes HW - 2.2, not its negative:
  // handing it -(HW - 2.2) made max(-m, ...) return +15.8 and put the ladder,
  // the sack truck and the jerrycan against the far wall on the wrong side.
  const lim = (v, m) => Math.max(-m, Math.min(m, v));
  const zR = lim(Math.max(bb.z1, 0.6) + CLR, HW - 2.2);
  const zL = lim(Math.min(bb.z0, -0.6) - CLR, HW - 2.2);
  const xN = lim(bb.x0 - CLR * 0.7, HD - 2.0);      // ahead of the nose (-x)
  const xT = lim(bb.x1 + CLR * 0.7, HD - 2.0);      // behind the tail (+x)
  const xM = lim((bb.x0 + bb.x1) / 2, HD - 2.0);    // abeam
  // the cart lives under the starboard wing root, where the work is
  prop('cart_tool', xM - 0.9, zR, Math.PI / 2 - 0.18, 0, MOBILE);
  prop('toolbox_open', xM - 0.9, zR + 0.06, 0.5, 0.90, MOBILE);
  prop('toolchest_metal', xM + 0.8, zR + 0.15, Math.PI / 2 + 0.22, 0, MOBILE);
  // the ladder stands off the port wing, the sack truck by the nose
  prop('stepladder', xM + 0.4, zL, -Math.PI / 2 + 0.3, 0, MOBILE);
  prop('handtruck', xN, zL * 0.45, 1.9, 0, MOBILE);
  prop('jerrycan', xN + 0.5, zL * 0.45 + 0.7, 0.8, 0, MOBILE);
  return mobileList();
}
// Where the kit ended up, and whether it is shown at all. The editor offers
// both: the kit is the room's only clutter that stands IN the open floor, and
// when the question is about the shape it is in the way.
function mobileList() {
  return MOBILE.children.map(o => ({
    key: o.name.replace('prop:', ''),
    x: +o.position.x.toFixed(2), z: +o.position.z.toFixed(2),
  }));
}
function mobileShow(on) { MOBILE.visible = on !== false; return MOBILE.visible; }

// THE COSY CORNER. The stove is a prop now; the flue is not, and cannot be —
// scandinavian_masonry_heater is a DOMESTIC heater with a 2.4 m stub, and this
// shed is 8.4 m to the eaves, so the pipe has to be drawn on up through the
// roof or it ends in mid-air. The glow, the log basket and the rug's chair
// come with it.
function stoveCorner(x, z, ry) {
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.rotation.y = ry || 0;
  g.add(box(1.7, 0.06, 1.7, M.stem, 0, 0.03, 0));          // the hearth slab
  if (!prop('stove_masonry', x, z, ry)) {                   // fallback: a drum
    g.add(cyl(0.30, 0.34, 0.78, M.steelDark, 0, 0.42, 0, 16));
    g.add(cyl(0.36, 0.36, 0.05, M.steelDark, 0, 0.83, 0, 16));
  }
  // the flue, from the heater's own stub up through the roof
  {
    const y0 = 2.36, top = EAVE + 0.6;
    g.add(cyl(0.09, 0.09, top - y0, M.steelDark, 0, y0 + (top - y0) / 2, 0, 12));
    g.add(cyl(0.16, 0.16, 0.10, M.steelDark, 0, top - 0.9, 0, 12));   // roof collar
  }
  const glow = new THREE.PointLight(0xff7a2a, 14, 7, 2);
  glow.position.set(0, 0.6, 0.75); g.add(glow);
  // log basket + logs, still drawn: nothing in the library is a log
  g.add(cyl(0.30, 0.26, 0.34, M.wood, 1.15, 0.17, 0.35, 14));
  for (let k = 0; k < 5; k++) {
    const l = cyl(0.055, 0.055, rr(0.28, 0.38), M.wood, 1.15 + rr(-0.1, 0.1),
                  0.36 + k * 0.05, 0.35 + rr(-0.1, 0.1), 8);
    l.rotation.set(rand() * 3, rand() * 3, Math.PI / 2 + rr(-0.4, 0.4));
    g.add(l);
  }
  G.add(g);
  return g;
}



// a drawing board with plans, under a lamp
function planTable(x, z, ry) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0;
  const TILT = 0.22;
  const top = box(1.5, 0.05, 1.0, M.woodPale, 0, 0.95, 0);
  top.rotation.x = -TILT; g.add(top);
  // EACH LEG IS AS LONG AS THE BOARD IS HIGH ABOVE IT. The top is tilted, so
  // one height for all four left the raised side standing 18 cm clear of the
  // board it is supposed to be holding up.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const h = 0.95 + sz * 0.42 * Math.sin(TILT) - 0.026;
    g.add(box(0.07, h, 0.07, M.wood, sx * 0.65, h / 2, sz * 0.42));
  }
  const paper = box(1.2, 0.006, 0.82,
    new THREE.MeshStandardMaterial({ color: 0xe8e3d6, roughness: 0.95 }), 0, 1.0, 0.02);
  paper.rotation.x = -0.22; g.add(paper);
  for (let k = 0; k < 3; k++) {
    const r = cyl(0.035, 0.035, 0.9, new THREE.MeshStandardMaterial({ color: 0xded7c6, roughness: 0.95 }),
                  0.4 + k * 0.09, 1.06, -0.3, 10);
    r.rotation.z = Math.PI / 2; r.rotation.y = 0.1; g.add(r);
  }
  G.add(g); return g;
}

// a rolling work platform — the thing you actually stand on to reach a wing
function workPlatform(x, z, ry) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0;
  const H = 1.55, W2 = 0.95, D = 2.0;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(cyl(0.035, 0.035, H, M.paintBlue, sx * (W2 / 2 - 0.05), H / 2, sz * (D / 2 - 0.05), 8));
    const w = cyl(0.08, 0.08, 0.05, M.rubber, sx * (W2 / 2 - 0.05), 0.08, sz * (D / 2 - 0.05), 10);
    w.rotation.x = Math.PI / 2; g.add(w);
  }
  for (const sz of [-1, 1]) for (const y of [0.55, 1.05])
    g.add(box(W2, 0.035, 0.035, M.paintBlue, 0, y, sz * (D / 2 - 0.05)));
  for (const sx of [-1, 1])
    g.add(box(0.035, 0.035, D, M.paintBlue, sx * (W2 / 2 - 0.05), 1.05, 0));
  g.add(box(W2 - 0.06, 0.05, D - 0.06, M.woodPale, 0, H + 0.03, 0));
  // handrail on three sides, and the ladder up the fourth
  for (const [px, pz] of [[-W2 / 2 + 0.05, 0], [W2 / 2 - 0.05, 0]]) {
    g.add(cyl(0.025, 0.025, 1.0, M.paintBlue, px, H + 0.5, pz - D / 2 + 0.05, 8));
    g.add(cyl(0.025, 0.025, 1.0, M.paintBlue, px, H + 0.5, pz + D / 2 - 0.05, 8));
    g.add(box(0.03, 0.03, D, M.paintBlue, px, H + 1.0, 0));
  }
  g.add(box(W2, 0.03, 0.03, M.paintBlue, 0, H + 1.0, -D / 2 + 0.05));
  for (let k = 0; k < 4; k++)
    g.add(box(W2 - 0.14, 0.03, 0.05, M.paintBlue, 0, 0.30 + k * 0.42, D / 2 - 0.04));
  G.add(g); return g;
}
// stock rack: tube, spruce and sheet, which is what an aeroplane starts as
function stockRack(x, z, ry) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0;
  for (const cz of [-2.4, 0, 2.4]) {
    g.add(box(0.10, 2.6, 0.10, M.steelDark, 0, 1.3, cz));
    for (let k = 0; k < 4; k++)
      g.add(box(0.75, 0.06, 0.06, M.steelDark, 0.30, 0.5 + k * 0.65, cz));
  }
  for (let k = 0; k < 4; k++) {
    const y = 0.57 + k * 0.65, n = 3 + Math.floor(rand() * 5);
    for (let i = 0; i < n; i++) {
      if (k < 2) {
        const t = cyl(rr(0.012, 0.030), rr(0.012, 0.030), rr(3.2, 5.4), M.steel,
                      rr(0.05, 0.55), y + rr(0, 0.05), rr(-2.5, 2.5), 8);
        t.rotation.x = Math.PI / 2; g.add(t);
      } else {
        g.add(box(rr(0.06, 0.22), rr(0.02, 0.05), rr(3.0, 5.2), M.woodPale,
                  rr(0.05, 0.55), y + 0.03, rr(-2.4, 2.4)));
      }
    }
  }
  G.add(g); return g;
}

// ---- placement ------------------------------------------------------------
// EVERYTHING STANDS AGAINST A WALL. A working shed keeps the middle of the
// floor clear — that is where the aeroplane goes, and it is the only way it
// reads as the subject rather than as one more object in a cluttered room.
// The shed is x in [-HD, HD] (door at -HD) and z in [-HW, HW]; the two long
// runs are the z = +-HW walls and the back wall is x = +HD.
//
// MEASURED SURFACES, not guessed ones. A prop that something else stands on
// was measured off its own decoded geometry (upward-facing triangle area,
// binned by height) rather than eyeballed, because a mug 3 cm above a bench
// top is the one mistake that makes a whole room look wrong:
const TOP = {
  bench: 0.96,      // workbench_wood
  desk: 0.78,       // metal_office_desk
  table: 0.68,      // table_wood
  cartTool: 0.90,   // cart_tool, top tray  (lower shelf 0.20)
  cartCab: 0.90,    // cart_tool_cab
  cartStore: 1.28,  // cart_storage, top    (middle 0.78, bottom 0.18)
  crate: 0.41,      // crate_wood_a
  drum: 0.90,       // drum_steel
};
const SHELVES = [0.44, 0.92, 1.42, 1.90];       // rack_steel, measured

// A LOADED RACK. Bare shelving reads as a showroom; what makes a rack look
// used is that the shelves are full and not tidy. Only props that fit the
// 0.48 m gap and the 0.60 m depth go on one, and the seeded PRNG picks, so
// the same shed comes back every time.
// Only what FITS: the shelf is 0.92 x 0.60 with a 0.48 m gap above it, so
// toolbox_open (0.77 m wide) was tried and dropped out — on the rack it hung
// off both ends and read as a landslide.
const SHELF_STOCK = ['box_cardboard', 'crate_wood_a', 'jerrycan',
                     'instrument_panel'];   // boxes_cardboard was dismissed
function loadedRack(x, z, ry) {
  prop('rack_steel', x, z, ry);
  const c = Math.cos(ry), sn = Math.sin(ry);
  for (const y of SHELVES) {
    if (y > 1.5 && rand() < 0.45) continue;     // the top shelf is half empty
    let u = -0.24;                              // along the rack, local x
    while (u < 0.26) {
      const k = SHELF_STOCK[Math.floor(rand() * SHELF_STOCK.length)];
      const v = rr(-0.05, 0.05);                // in and out, local z
      prop(k, x + u * c + v * sn, z - u * sn + v * c, rand() * 3, y);
      u += rr(0.26, 0.36);
    }
  }
}

// ===== THE SHOP RUN (z = +HW): benches, boards, tool storage ================
prop('workbench_wood', FX(-5.0), HW - 1.00, Math.PI);
prop('vice_bench', FX(-5.95), HW - 1.10, Math.PI * 0.5, TOP.bench);
prop('toolbox_open', FX(-4.25), HW - 1.00, Math.PI - 0.35, TOP.bench);
prop('radio_bench', FX(-3.95), HW - 1.05, Math.PI + 0.25, TOP.bench);
prop('toolrack_wall', FX(-5.0), HW - 0.12, Math.PI, 1.62);
prop('stool_wood', FX(-3.2), HW - 2.10, 0.6);

prop('table_wood', FX(-1.7), HW - 1.05, Math.PI);
prop('box_cardboard', FX(-2.1), HW - 1.00, 0.4, TOP.table);
prop('crate_wood_a', FX(-1.2), HW - 1.05, -0.25, TOP.table);
prop('jerrycan', FX(-0.9), HW - 1.85, 0.8);

loadedRack(FX(1.5), HW - 0.55, Math.PI);
loadedRack(FX(2.6), HW - 0.55, Math.PI);
loadedRack(FX(3.7), HW - 0.55, Math.PI);
prop('cart_storage', FX(5.7), HW - 1.10, Math.PI + 0.08);
prop('box_cardboard', FX(5.4), HW - 1.10, 0.3, TOP.cartStore);
prop('crate_wood_a', FX(6.1), HW - 1.05, -0.5, TOP.cartStore);
prop('toolchest_metal', FX(7.3), HW - 0.95, Math.PI + 0.12);
prop('cart_tool_cab', FX(8.7), HW - 0.95, Math.PI - 0.08);
prop('bottle_lpg', FX(9.9), HW - 0.85, 0.5);
prop('handtruck', FX(10.8), HW - 0.55, Math.PI + 0.15);

// ===== THE BUILD RUN (z = -HW): the desk, the machines, the work ===========
prop('desk_metal', FX(2.6), -HW + 0.90, 0);
prop('lamp_desk', FX(3.35), -HW + 1.15, -0.55, TOP.desk);   // clamps to the top
prop('instrument_panel', FX(1.95), -HW + 1.05, 0.35, TOP.desk);
prop('stool_wood', FX(2.4), -HW + 1.95, -0.4);
prop('toolrack_wall', FX(2.6), -HW + 0.12, 0, 1.62);

loadedRack(FX(-1.2), -HW + 0.55, 0);
loadedRack(FX(-2.3), -HW + 0.55, 0);
prop('toolchest_metal', FX(0.5), -HW + 0.85, 0.15);
prop('cart_tool', FX(-8.2), -HW + 1.40, -0.30);
prop('drillpress', FX(7.4), -HW + 0.95, 0.10);
prop('barrel_plastic', FX(9.0), -HW + 0.85, 0);
prop('bin_metal', FX(10.2), -HW + 0.90, 0.3);

// STILL DRAWN: nothing in the library is an aero engine, a wing under
// construction, a propeller, a drawing board or a rolling scaffold.
FURN.push(planTable(FX(-9.2), FZ(8.4), 0.4));
FURN.push(workPlatform(FX(6.6), HW - 3.1, 0.10));
FURN.push(workPlatform(FX(-6.6), -HW + 3.2, -0.10));
// ry = PI, not -PI/2: the long stock lies along local z, so a quarter turn put
// every length of tube and spruce straight through the end wall
FURN.push(stockRack(HD - 1.6, -8.5, Math.PI));

// ===== THE BACK WALL (x = +HD): gas, air, fuel and the bins ================
prop('weldingcart', HD - 1.15, 15.0, -Math.PI / 2 - 0.20);
prop('bottle_propane', HD - 0.85, 13.9, 0.4);
prop('bottle_propane', HD - 0.90, 13.2, -0.9);
prop('bottle_lpg', HD - 1.65, 13.6, 0.2);
prop('compressor', HD - 1.25, 6.2, -Math.PI / 2);
prop('hosereel_wall', HD - 0.14, 3.6, -Math.PI / 2, 2.20);
prop('drum_steel', HD - 0.95, -14.6, 0.5);
prop('drum_steel', HD - 0.95, -15.4, -0.3);
prop('barrel_plastic', HD - 1.75, -15.0, 0);
prop('jerrycan', HD - 1.9, -13.9, 0.9);
prop('jerrycan', HD - 2.3, -14.2, -0.4);
prop('bin_metal', HD - 1.05, -3.2, 0.3);
prop('bin_metal_rust', HD - 1.05, -4.2, -0.5);
prop('crate_wood_c', HD - 1.10, -10.6, Math.PI / 2 + 0.1);
prop('crate_wood_b', HD - 1.05, -11.7, Math.PI / 2 - 0.2);

// ===== THE DOOR END (x = -HD): tyres, crates and the unfinished car ========
// A TYRE IS ONE PROP AND A STACK IS A STACK: 0.165 m of tread per lift, and a
// turn on each, so no two read as the same casting.
const tyreStack = (x, z, n) => {
  for (let k = 0; k < n; k++)
    prop('tyre', x + rr(-0.03, 0.03), z + rr(-0.03, 0.03), rand() * 3, k * 0.165);
};
tyreStack(FX(-11.3), HW - 1.7, 4);
tyreStack(FX(-12.0), HW - 2.6, 3);
tyreStack(FX(-11.6), HW - 3.4, 2);
tyreStack(FX(-11.4), -HW + FZ(8.4), 3);
prop('car_covered', FX(-9.9), HW - FZ(5.6), Math.PI / 2 + 0.05);

prop('crate_wood_c', FX(-11.6), -HW + 3.6, 0.15);
prop('crate_wood_a', FX(-11.6), -HW + 3.6, -0.20, TOP.crate);
prop('crate_wood_b', FX(-11.8), -HW + 4.7, 0.35);
prop('box_cardboard', FX(-10.7), -HW + 3.9, 0.8);
prop('box_cardboard', FX(-10.8), -HW + 3.95, -0.4, 0.34);
// the delivered "cardboard box set" was dismissed (no lids, no thickness: flat
// card from any angle but dead ahead) — the Poly Haven box and the crates take
// its place, and they stack
prop('box_cardboard', FX(-11.4), -HW + 6.0, 0.1);
prop('box_cardboard', FX(-11.5), -HW + 6.05, 1.2, 0.34);
prop('crate_wood_a', FX(-10.8), -HW + 6.6, -0.3);
prop('crate_wood_c', FX(-11.5), -HW + 7.6, 0.5);
prop('stepladder', FX(-11.9), -HW + FZ(11.6), 1.4);
prop('stepladder', FX(-8.6), -HW + 3.9, 0.5);

// ===== WORK IN PROGRESS ====================================================
// The shed had furniture and no WORK in it. These three come out of the game's
// own generator rather than the prop library (see src/viewer/workshop.js), so
// when the generator learns a new tip shape or a better truss, the aeroplanes
// half-built on this floor learn it too.
{
  // the stands are a PROP now (user: "your stands are still really shaky"), so
  // the height the pieces rest at is the trestle's own top, measured off the
  // baked payload rather than agreed between two files
  const trestleTop = (PROPS_OK && PROP_REG.props.work_trestle)
    ? PROP_REG.props.work_trestle.bb[4] : 0.82;
  const wsMats = { wood: M.woodPale, steel: M.steel, trestleTop: trestleTop,
                   stand: (x, z, ry) => prop('work_trestle', x, z, ry) };
  const place = (kind, x, z, ry) => {
    const g = (typeof wsPiece === 'function') ? wsPiece(THREE, kind, wsMats) : null;
    if (!g) return null;
    g.position.set(x, 0, z); g.rotation.y = ry || 0;
    G.add(g);
    FURN.push(g);
    return g;
  };
  // the whole wing along the shop wall, the welded fuselage down the build
  // side, the wooden cabin by the door and the engine on its bench
  place('wing', FX(-2.4), FZ(12.4), 0.05);
  place('frame', FX(3.6), FZ(-12.2), 0.04);
  place('cabin', FX(-8.2), FZ(-10.4), -0.30);
  place('engine', FX(9.2), FZ(-6.4), -Math.PI / 2 + 0.2);
}

// ===== THE COSY CORNER =====================================================
FURN.push(stoveCorner(FX(11.1), FZ(12.4), -0.5));
// 4 mm off the slab: the rug was baked with its underside on y = 0 and so
// is the floor, and two coplanar double-sided faces are a z-fight
prop('rug_persian', FX(8.6), FZ(13.8), 0.30, 0.004);
prop('chair_lounge', FX(8.9), FZ(13.6), 2.35);
prop('stool_wood', FX(7.6), FZ(12.5), 1.1);
prop('drum_steel', FX(9.6), FZ(15.9), 0);          // the log drum, doubling as a table
prop('barrel_plastic', FX(10.6), FZ(16.2), 0.4);

// NO PENDANTS OVER THE BENCHES. Four of them used to hang here at eaves
// height with nothing above them — a lamp needs a rod to hang from, and the
// six that have one are placed with the shop lamps further down.

// ---- lighting -------------------------------------------------------------
// The room is a GROUP, not a scene: the viewer owns the scene, and the garage
// swaps this whole thing in and out of it. Lights live in the group too, so one
// add/remove carries the room and its lighting together and neither can be left
// behind — which is what happens the first time they are tracked separately.
const ROOT = new THREE.Group();
const BG = new THREE.Color(0x14120f);
const FOG = new THREE.Fog(0x1a1712, 40, 120);
ROOT.add(G);

const hemi = new THREE.HemisphereLight(0xbfd2e6, 0x3a3128, 0.30);
ROOT.add(hemi);

// THE DOOR. One shadow-casting key, angled the way a low afternoon sun comes
// through an open hangar door — long shapes down the floor, the aeroplane lit
// from the nose.
// THE SUN COMES OUT OF THE SKY IMAGE (G56, user: "the HDRI sun vector";
// measured off the HDR itself at G62). The equirect is the only thing in this
// room that knows where the light actually is; the key light used to point the
// way the shed was drawn, so the shadows on the floor disagreed with the
// daylight in the windows above them.
//
// The (u, v) is no longer scanned off the LDR picture at run time — it is
// integrated off the float HDR by tools/sky_prep.py, which is strictly better
// on two counts: a clipped LDR bloom has no centroid (every pixel of it reads
// 255, so the scan returned whichever corner it met first), and a small hard
// moon over a bright horizon is found for the same reason. What is left here
// is the conversion, and the sphere's own orientation (scale.x = -1, then a
// quarter turn about y) has to be applied to the direction to match how the
// backdrop is hung — the one part that is easy to get backwards, which is why
// it is still written out longhand.
function sunDir(uv, yaw) {
  if (!uv || uv.length !== 2) return null;
  // equirect: u wraps the horizon, v runs top (zenith) to bottom
  const phi = (uv[0] - 0.5) * 2 * Math.PI, theta = uv[1] * Math.PI;
  let x = Math.sin(theta) * Math.cos(phi), y = Math.cos(theta),
      z = Math.sin(theta) * Math.sin(phi);
  x = -x;                                        // scale.x = -1
  const a = (yaw !== undefined) ? yaw : SKY_YAW0;    // ...then rotation.y = a
  const c = Math.cos(a), sn = Math.sin(a), rx = x, rz = z;
  x = rx * c + rz * sn; z = -rx * sn + rz * c;
  const L = Math.hypot(x, y, z) || 1;
  return [x / L, Math.max(0.12, y / L), z / L];  // never below the horizon
}

const key = new THREE.DirectionalLight(0xffe0b0, 2.6);
key.position.set(-(HD + 17), EAVE * 0.6, FZ(7.5));
key.target.position.set(FX(6), 0.6, FZ(-3));
// AIM IS PER SKY, so it is a function and not a one-off: the sun moves when
// the mood does, and so must every shadow on the floor. Stand the light off at
// a distance that keeps the whole shed in its shadow frustum, aimed at the
// middle of the floor.
function aimKey(uv, yaw) {
  const sun = sunDir(uv, yaw);
  if (!sun) return;
  const R = 2 * HD + 22;
  key.target.position.set(0, 0.6, 0);
  key.position.set(sun[0] * R, Math.max(EAVE * 0.8, sun[1] * R), sun[2] * R);
  key.target.updateMatrixWorld();
}
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
// the shadow box is the SHED, not a remembered number: a frustum sized for a
// room twice this one spends its depth precision on empty air and the contact
// shadow under the wheels goes soft
key.shadow.camera.left = -(HW + 8); key.shadow.camera.right = HW + 8;
key.shadow.camera.top = HD + 3; key.shadow.camera.bottom = -(HD + 3);
key.shadow.camera.near = 1; key.shadow.camera.far = 2 * HD + 64;
key.shadow.bias = 0; key.shadow.normalBias = 0.02;
key.shadow.normalBias = 0.02;
ROOT.add(key, key.target);

// the glazing bands as light: two soft fills, one per flank, no shadows
const winFill = [];
for (const s of [1, -1]) {
  const w = new THREE.DirectionalLight(0xcfe0f2, 0.34);
  winFill.push(w);
  w.position.set(FX(-4), EAVE + 0.6, s * (HW + 12));
  w.target.position.set(0, 1, 0);
  ROOT.add(w, w.target);
}
// the roof lights, from straight above
const top = new THREE.DirectionalLight(0xe6eef8, 0.46);
top.position.set(FX(2), 2 * RIDGE + 8, FZ(1)); ROOT.add(top);

// SHOP LAMPS. The shade is hanging_industrial_lamp now, not a drawn cone; what
// is still drawn is the LIGHT (a light is not a model) and the drop rod, since
// the prop's own chain is 1.36 m and the roof over the lamp rows is at 9.9 m.
// The prop hangs BELOW its origin, so the origin goes up at the rod's foot.
const lamps = [];
for (const s of [1, -1]) for (let k = 0; k < 3; k++) {
  const x = FX(-8 + k * 8), z = s * FZ(9.5), y = EAVE * 0.74;
  const g = new THREE.Group(); g.position.set(x, y, z);
  const hook = 1.30;                       // prop origin, above the group
  prop('lamp_pendant', x, z, rr(-3, 3), y + hook);
  const roof = roofY(z), rodH = roof - (y + hook);   // NOT `top`: that is a light
  const drop = cyl(0.012, 0.012, rodH, M.steelDark, 0, hook + rodH / 2, 0, 6);
  g.add(drop);
  // A LIT LAMP NEEDS A LIT BULB. The prop's shade carries an emissive map but
  // nothing inside it glows, so the fitting read as a cold shell with light
  // arriving from an invisible point. This is that point, made visible.
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), M.bulb);
  bulb.position.y = 0.12; bulb.castShadow = false;
  g.add(bulb);
  // THE CENTRE PAIR CASTS (G42, user: "the plane does not emit any cast
  // shadow"). The stand sits in the centre aisle, between the lamp rows,
  // where the only shadow-caster (the door sun) never reaches — so the
  // two lamps nearest the stand become SpotLights aimed at it, each with
  // its own shadow map. Same colour, same candela, same mood scaling;
  // the cost is two 1024 maps, and the aeroplane finally stands ON the
  // floor instead of hovering over it.
  // EVERY LAMP CASTS (G60, user: "fix the shadowless lamps"). Four of the six
  // were PointLights with no shadow map — their light went straight through
  // everything, which is why the floor bake had to carry the whole grounding
  // job alone. All six are now the same fitting the G42 centre pair proved
  // out; the cost is four more 1024 maps. The centre pair keeps its G42 aim
  // at the stand, and the outer four aim into their own bay, tipped a little
  // toward the aisle the way a hung shade actually throws.
  const L = new THREE.SpotLight(0xffd9a0, 90, 26, 0.62, 0.45, 2);
  L.castShadow = true;
  L.shadow.mapSize.set(1024, 1024);
  L.shadow.camera.near = 1; L.shadow.camera.far = 30;
  L.shadow.normalBias = 0.03;
  L.target.position.set(x, 0, k === 1 ? s * 1.5 : z * 0.75);
  G.add(L.target);
  L.position.y = 0.12;                     // inside the prop's shade
  g.add(L);
  lamps.push(L);
  G.add(g);
}

// ---- light shafts ---------------------------------------------------------
// Cheap, and worth every triangle: a pair of crossed cards per opening, fading
// out along their length. It is the dust in the air, which is the one thing a
// big daylit shed always has.
const shaftTex = sheet(4, 128, (g, W, H) => {
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.55, 'rgba(255,255,255,.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
}, true);
const shaftMat = new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true,
  opacity: 0.055, depthWrite: false, blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide, color: 0xffe9c8 });
const shafts = new THREE.Group();
// ONE card per shaft, turned about its own axis each frame to face the camera.
// Two crossed cards is the usual cheap trick and it is wrong here: additive
// quads that cross each other draw a bright lattice on whatever wall is behind,
// which read as stripes painted on the sheeting.
const shaftList = [];
const shaft = (from, dir, len, w) => {
  const d = new THREE.Vector3(...dir).normalize();
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, len), shaftMat);
  p.position.set(...from).addScaledVector(d, len / 2);
  p.renderOrder = 3;
  shafts.add(p);
  shaftList.push({ m: p, up: d.clone().negate() });
};
const _m4 = new THREE.Matrix4(), _r = new THREE.Vector3(), _n = new THREE.Vector3(),
      _v = new THREE.Vector3();
const faceShafts = cam => {
  for (const s of shaftList) {
    _v.copy(cam.position).sub(s.m.position);
    _r.crossVectors(s.up, _v);
    if (_r.lengthSq() < 1e-8) continue;
    _r.normalize();
    _n.crossVectors(_r, s.up).normalize();
    _m4.makeBasis(_r, s.up, _n);
    s.m.quaternion.setFromRotationMatrix(_m4);
  }
};

for (const s of [1, -1]) for (let k = 0; k < 4; k++) {
  const x = -HD + 3.4 + k * (2 * HD - 6.8) / 3;
  shaft([x, EAVE + 1.2, s * HW * 0.45], [0.14, -1, -s * 0.12], 7.2, 3.0);
}
// The door opening had a shaft of its own. It failed for a reason worth
// keeping: a roof light is a SMALL aperture, so a card standing in its beam is
// a fair stand-in for the cone of lit dust. A 31 m door is not an aperture, it
// is the missing half of a wall — the light through it does not form a beam at
// all, and one enormous additive quad across the shed read as a sheet of fog
// hanging in the doorway. Removed; the roof shafts stay.
ROOT.add(shafts);

// ---- moods ----------------------------------------------------------------
// A MOOD IS A SKY (G62, user: "HDRI of several day conditions ... the lighting
// conditions harmonized"). The four hand-authored rows this room shipped with
// were a light rig with no picture behind it: the sun outside stayed the alpine
// afternoon whichever one you picked, so GOLDEN lit the shed orange under a
// blue midday sky. Now each row IS a sky — the picture in the doorway and the
// rig are the same row, and the rig was measured off that picture's own HDR by
// tools/sky_prep.py (where the sun is, what colour it is, how directional it
// is; see that tool for what is measured and what is authored). Nothing in
// this file decides a lighting number any more; it applies one.
//
// The alps/AFTERNOON row is the anchor and comes back exactly as it was — the
// user asked to keep it — except that its key light now points where the sun
// in that picture actually is rather than at the brightest clipped pixel of
// its bloom.
//
// `env` was `scene.environmentIntensity`, which r128 does not have — so each
// material's own envMapIntensity is scaled from the value it was authored
// with. Authored values are captured once, here, because scaling a scaled
// value compounds every time the mood changes.
const ENV0 = new Map();
for (const k in M) if (M[k] && M[k].envMapIntensity !== undefined)
  ENV0.set(M[k], M[k].envMapIntensity);
// WITHOUT THE PAYLOAD there is still a room: the headless gate and any
// core-only build get the alps row's numbers with no picture to hang behind
// them, which is exactly what this shed was before G41.
const MOODS = SKY_ROWS || [
  { key: 'alps', name: 'AFTERNOON', keyI: 2.8, kc: 0xffdca8, hemi: 0.274,
    hemiSky: 0xc5d9ff, hemiGnd: 0x343422, top: 0.567, env: 0.55, lamp: 70,
    ex: 0.92, bg: 0x151511, card: 0xf2ecdc, panel: 2.6, shaft: 0.055 },
];
let moodI = -1;
const setMood = i => {
  const j = Math.max(0, Math.min(MOODS.length - 1, i | 0));
  const m = MOODS[j];
  // THE SKY AND THE SUN MOVE ONLY WHEN THE ROW DOES: a re-apply of the same
  // mood (applyEnv runs on every editor slider drag) must not re-decode a 4k
  // equirect or re-aim a light that is already aimed.
  if (j !== moodI) { moodI = j; setSky(m); aimKey(m.sunUV, m.yaw); }
  key.intensity = m.keyI; key.color.setHex(m.kc);
  hemi.intensity = m.hemi;
  if (m.hemiSky !== undefined) hemi.color.setHex(m.hemiSky);
  if (m.hemiGnd !== undefined) hemi.groundColor.setHex(m.hemiGnd);
  for (const L of lamps) L.intensity = m.lamp;
  top.intensity = m.top;
  if (m.hemiSky !== undefined) top.color.setHex(m.hemiSky);
  // the glazing bands ARE the sky seen through a wall, so they wear its
  // colour too. (The anchor's authored 0xcfe0f2 and its measured sky chroma
  // differ by about 1% of luminance — below anything the eye can find, and
  // worth it not to leave one light burning daylight-blue at dusk.)
  for (const w of winFill) {
    w.intensity = m.env * 0.6;
    if (m.hemiSky !== undefined) w.color.setHex(m.hemiSky);
  }
  // the environment is baked in ONE sky, so it has to be scaled with
  // everything else or the room stays lit by a sun that has gone
  for (const [mat, e0] of ENV0) mat.envMapIntensity = e0 * (m.env / 0.55);
  // the props are materials too, and they were built after ENV0 was
  // captured — propSetEnv scales the ones already built AND the ones
  // the editor builds later, from the factory's own record
  if (typeof propSetEnv === 'function') propSetEnv(m.env / 0.55);
  BG.setHex(m.bg); FOG.color.setHex(m.bg);
  M.daylight.color.setHex(m.card);
  M.skyPanel.emissiveIntensity = m.panel;
  // the filaments follow the lamps they are in, or a night shed has cold bulbs
  // burning in it
  M.bulb.emissiveIntensity = 0.5 + m.lamp / 70;
  shaftMat.opacity = m.shaft;
  return m;
};

// ---- THE MATERIAL LIBRARY AND THE PART SYSTEM (G41, supersedes G40's
// wall-only wardrobe; user: "manage a material library and assign them
// to parts of the hangar"). The LIBRARY is every payload texture set
// (hangar_walls.js + the floor slab); every PART owns one material
// instance, registered below with its baked originals captured, so any
// part can wear any set — or its baked self — with an independent tile
// size, a roughness multiplier and a normal-influence multiplier.
// Materials stay the SAME OBJECTS in M throughout, so the moods'
// envMapIntensity scaling covers whatever a part wears. r128's one
// uv-transform-per-material (from .map) means tile size is one number
// per part and every map follows. The unused sets get deleted once
// choices settle.
const LIB = {};
if (typeof HANGAR_WALL_SETS !== 'undefined' && HANGAR_WALL_SETS)
  for (const k in HANGAR_WALL_SETS) LIB[k] = HANGAR_WALL_SETS[k];
if (typeof HANGAR_FLOOR_IMG !== 'undefined' && HANGAR_FLOOR_IMG)
  LIB.slabfloor = { name: 'damaged concrete (floor)',
    diff: HANGAR_FLOOR_IMG.diff, nor: HANGAR_FLOOR_IMG.nor,
    rough: HANGAR_FLOOR_IMG.rough, tile: 5 };
const PARTS = {
  ground:    { name: 'ground',            mat: M.floor,    tile: 5 },
  wallSides: { name: 'walls · sides',     mat: M.wall,     tile: 2 },
  wallBack:  { name: 'wall · back',       mat: M.wallBack, tile: 2 },
  stem:      { name: 'brick stem',        mat: M.stem,     tile: 2 },
  roof:      { name: 'roof',              mat: M.roofIn,   tile: 2 },
  beamsMain: { name: 'beams · main',      mat: M.beamMain, tile: 2 },
  beamsSec:  { name: 'beams · secondary', mat: M.beamSec,  tile: 2 },
  windows:   { name: 'windows',           mat: M.glass,    tile: 2 },
  doorMan:   { name: 'man door',          mat: M.manDoor,  tile: 2 },
  doorMain:  { name: 'hangar doors',      mat: M.door,     tile: 2 },
};
for (const k in PARTS) {
  const p = PARTS[k], m = p.mat;
  p.baked = { map: m.map || null, nor: m.normalMap || null,
    rough: m.roughnessMap || null, rough0: m.roughness,
    ns: m.normalScale ? m.normalScale.clone() : null };
  p.state = { set: 'baked', tile: p.tile, rough: 1, nrm: 1 };
  p.cache = {};
}
const partTex = (img, srgb) => {
  const t = new THREE.Texture(img);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = (typeof window !== "undefined" && window.FLYDIY_ANISO) || 8;
  if (srgb) t.encoding = THREE.sRGBEncoding;
  const ok = () => { t.needsUpdate = true; };
  if (img.complete && img.naturalWidth) ok(); else img.onload = ok;
  return t;
};
const setPart = (key, st) => {
  const p = PARTS[key];
  if (!p) return null;
  const s = p.state;
  if (st) {
    if (st.set && (st.set === 'baked' || LIB[st.set])) s.set = st.set;
    if (+st.tile > 0) s.tile = Math.max(0.25, Math.min(12, +st.tile));
    if (+st.rough >= 0) s.rough = Math.max(0, Math.min(2, +st.rough));
    if (+st.nrm >= 0) s.nrm = Math.max(0, Math.min(2, +st.nrm));
  }
  const m = p.mat;
  if (s.set === 'baked') {
    m.map = p.baked.map; m.normalMap = p.baked.nor;
    m.roughnessMap = p.baked.rough;
    // ceiling 2, not 1 (G42): a rough map is a MULTIPLICAND, so a
    // multiplier above 1 is the only way to be DULLER than the map
    m.roughness = Math.min(2, p.baked.rough0 * s.rough);
    if (m.normalScale && p.baked.ns)
      m.normalScale.copy(p.baked.ns).multiplyScalar(s.nrm);
  } else {
    let c = p.cache[s.set];
    if (!c) {
      const L = LIB[s.set];
      c = p.cache[s.set] = { map: partTex(L.diff, true),
        nor: partTex(L.nor), rough: partTex(L.rough) };
    }
    m.map = c.map; m.normalMap = c.nor; m.roughnessMap = c.rough;
    m.roughness = Math.min(2, s.rough);
    if (m.normalScale) m.normalScale.set(s.nrm, s.nrm);
    c.map.repeat.set(1 / s.tile, 1 / s.tile);
    c.nor.repeat.copy(c.map.repeat); c.rough.repeat.copy(c.map.repeat);
  }
  m.needsUpdate = true;
  return Object.assign({}, s);
};

// ---- THE GROUND SHADOW BAKE (G58) ------------------------------------------
// The user's diagnosis was right: the car and the drawing table floated,
// because four of the six lamps are PointLights with no shadow map — their
// light goes straight through everything — and SSAO's 0.2 m radius cannot see
// an occluder the size of a car. The floor itself was never the problem (it
// has receiveShadow and shows the window patches); what was missing is the
// AMBIENT shadow, the one a big object prints on the ground under any light.
//
// This is the user's projection idea, generalised: ONE orthographic camera
// UNDER the floor looking up renders every piece of furniture with a depth
// material, so each texel records the height of the LOWEST surface above it —
// which is exactly what a contact shadow depends on. That height becomes an
// intensity (near the floor = dark, 2.6 m up = nothing, above that clipped by
// the camera's own far plane, so the pendant lamps and the roof never print),
// a separable blur gives it a penumbra, and the result is one darkening quad
// laid on the slab. Four draws at 1024^2, once per room build and once per
// mobile-kit move — not per frame.
//
// FROM BELOW, not above: from above the camera sees a table's TOP and a tall
// object would print by its lid; from below it sees the underside — legs
// print hard little feet, the tabletop prints a soft pool, and a car cover
// whose skirt nearly touches the ground prints near-black. That is the
// "truncated to the bottom" in the user's ask, done by the depth test itself.
const GS = { on: true };
const CS = { on: true };   // the aeroplane's own print, below
{
  const SIZE = 1024, CUT = 2.6, LAYER = 3;
  const mk = () => new THREE.WebGLRenderTarget(SIZE, SIZE, {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat });
  GS.rtA = mk(); GS.rtB = mk();
  GS.depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.BasicDepthPacking });
  GS.depthMat.side = THREE.DoubleSide;      // undersides face the camera
  GS.cam = new THREE.OrthographicCamera(-HD, HD, HW, -HW, 0.02, CUT);
  GS.cam.up.set(0, 0, 1);
  GS.cam.layers.set(LAYER);
  const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  // BasicDepthPacking writes 1 - fragCoordZ, and an ortho camera's depth is
  // LINEAR — so the sample IS (1 - height/CUT), and the shaping curve turns it
  // into an intensity. pow on the first pass only; the second just blurs.
  GS.blur = new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2(1 / SIZE, 1 / SIZE) },
                uDir: { value: new THREE.Vector2(1, 0) }, uPow: { value: 1 } },
    vertexShader: VERT,
    fragmentShader: [
      'precision highp float; varying vec2 vUv;',
      'uniform sampler2D tSrc; uniform vec2 uTexel, uDir; uniform float uPow;',
      'void main() {',
      '  float w[5]; w[0]=0.227; w[1]=0.194; w[2]=0.121; w[3]=0.054; w[4]=0.016;',
      '  float s = pow(texture2D(tSrc, vUv).r, uPow) * w[0];',
      '  for (int i = 1; i < 5; i++) {',
      '    vec2 o = uDir * uTexel * float(i) * 2.6;',
      '    s += pow(texture2D(tSrc, vUv + o).r, uPow) * w[i];',
      '    s += pow(texture2D(tSrc, vUv - o).r, uPow) * w[i];',
      '  }',
      '  gl_FragColor = vec4(vec3(s), 1.0);',
      '}'].join('\n'),
  });
  GS.fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), GS.blur);
  GS.fsScene = new THREE.Scene(); GS.fsScene.add(GS.fsQuad);
  GS.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  // THE OVERLAY: a black quad whose alpha is the baked occlusion. alphaMap
  // reads the GREEN channel; the bake writes all three the same. fog off, or
  // the room fog tints the darkening grey.
  const geo = new THREE.PlaneGeometry(2 * HD, 2 * HW);
  {  // the framebuffer's v runs +z -> -z once the plane lies flat; flip to match
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  }
  GS.quad = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: 0x000000, alphaMap: GS.rtA.texture, transparent: true,
    opacity: 0.9, depthWrite: false, fog: false }));
  GS.quad.rotation.x = -Math.PI / 2;
  GS.quad.position.y = 0.012;               // above the slab AND the rug
  GS.quad.renderOrder = 1;
  GS.quad.visible = false;                  // nothing to show until a bake ran
  G.add(GS.quad);

  GS.bake = function (renderer, scene) {
    if (!renderer || !scene || !renderer.setRenderTarget) return false;
    try {
      for (const f of FURN)
        if (f) f.traverse(o => { if (o.isMesh) o.layers.enable(LAYER); });
      const gy = ROOT.position.y;
      GS.cam.position.set(0, gy - 0.01, 0);
      GS.cam.lookAt(0, gy + 1, 0);
      const prevT = renderer.getRenderTarget();
      const prevC = renderer.getClearColor(new THREE.Color());
      const prevA = renderer.getClearAlpha();
      const prevO = scene.overrideMaterial;
      renderer.setClearColor(0x000000, 1);
      scene.overrideMaterial = GS.depthMat;
      renderer.setRenderTarget(GS.rtA);
      renderer.clear();
      renderer.render(scene, GS.cam);
      scene.overrideMaterial = prevO;
      GS.blur.uniforms.tSrc.value = GS.rtA.texture;   // shape + blur across
      GS.blur.uniforms.uDir.value.set(1, 0);
      GS.blur.uniforms.uPow.value = 1.6;
      renderer.setRenderTarget(GS.rtB);
      renderer.render(GS.fsScene, GS.fsCam);
      GS.blur.uniforms.tSrc.value = GS.rtB.texture;   // blur down
      GS.blur.uniforms.uDir.value.set(0, 1);
      GS.blur.uniforms.uPow.value = 1.0;
      renderer.setRenderTarget(GS.rtA);
      renderer.render(GS.fsScene, GS.fsCam);
      // A SECOND PASS-PAIR. One gaussian leaves the fringe around a car-sized
      // occluder ~20 cm wide, which vanishes under the object's own sides; a
      // contact shadow reads by the ring that PEEKS OUT, so the ring has to be
      // wide enough to peek. Two iterations ~= 40 cm of penumbra.
      GS.blur.uniforms.tSrc.value = GS.rtA.texture;
      GS.blur.uniforms.uDir.value.set(1, 0);
      renderer.setRenderTarget(GS.rtB);
      renderer.render(GS.fsScene, GS.fsCam);
      GS.blur.uniforms.tSrc.value = GS.rtB.texture;
      GS.blur.uniforms.uDir.value.set(0, 1);
      renderer.setRenderTarget(GS.rtA);
      renderer.render(GS.fsScene, GS.fsCam);
      renderer.setRenderTarget(prevT);
      renderer.setClearColor(prevC, prevA);
      GS.quad.visible = GS.on;
      return true;
    } catch (e) {
      if (window.console) console.warn('ground shadow bake:', e.message);
      return false;
    }
  };
  GS.dispose = function () {
    GS.rtA.dispose(); GS.rtB.dispose();
    CS.rtA.dispose(); CS.rtB.dispose();
    if (CS.quad.geometry) CS.quad.geometry.dispose();
    GS.blur.dispose(); GS.depthMat.dispose(); GS.fsQuad.geometry.dispose();
  };

  // ---- THE AEROPLANE'S OWN PRINT (G59) -------------------------------------
  // The furniture bake deliberately leaves the aeroplane out: it changes with
  // every slider, and re-baking the whole room per drag is the wrong trade.
  // This is the user's counter-proposal — a SMALL sprite just for the plane,
  // dynamic. Same recipe end to end (under-floor ortho, lowest surface,
  // pow + blur), but the camera and the quad are sized to the CRAFT's own
  // footprint and the target is 256^2, so a bake is four small draws and the
  // sliders never feel it. Layer 4, so the room bake (layer 3) never sees the
  // plane and this one never sees the room.
  {
    const SIZE = 256, CUT = 2.6, LAYER = 4, PAD = 0.9;
    const mk = () => new THREE.WebGLRenderTarget(SIZE, SIZE, {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat });
    CS.rtA = mk(); CS.rtB = mk();
    CS.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.02, CUT);
    CS.cam.up.set(0, 0, 1);
    CS.cam.layers.set(LAYER);
    const geo = new THREE.PlaneGeometry(1, 1);
    { const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)); }
    CS.quad = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0x000000, alphaMap: CS.rtA.texture, transparent: true,
      opacity: 0.9, depthWrite: false, fog: false }));
    CS.quad.rotation.x = -Math.PI / 2;
    // a hair above the furniture quad, so the two never z-fight where the
    // mobile kit's print runs under a wing
    CS.quad.position.y = 0.016;
    CS.quad.renderOrder = 1;
    CS.quad.visible = false;
    G.add(CS.quad);

    CS.bake = function (renderer, scene, craft) {
      if (!renderer || !scene || !craft || !renderer.setRenderTarget) return false;
      try {
        const bb = new THREE.Box3().setFromObject(craft);
        if (!isFinite(bb.min.x) || bb.max.x <= bb.min.x) {
          CS.quad.visible = false;
          return false;
        }
        craft.traverse(o => { if (o.isMesh) o.layers.enable(LAYER); });
        const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
        const hw = (bb.max.x - bb.min.x) / 2 + PAD, hh = (bb.max.z - bb.min.z) / 2 + PAD;
        const gy = ROOT.position.y;
        CS.cam.left = -hw; CS.cam.right = hw; CS.cam.top = hh; CS.cam.bottom = -hh;
        CS.cam.updateProjectionMatrix();
        CS.cam.position.set(cx, gy - 0.01, cz);
        CS.cam.lookAt(cx, gy + 1, cz);
        const prevT = renderer.getRenderTarget();
        const prevC = renderer.getClearColor(new THREE.Color());
        const prevA = renderer.getClearAlpha();
        const prevO = scene.overrideMaterial;
        renderer.setClearColor(0x000000, 1);
        scene.overrideMaterial = GS.depthMat;
        renderer.setRenderTarget(CS.rtA);
        renderer.clear();
        renderer.render(scene, CS.cam);
        scene.overrideMaterial = prevO;
        // the shared blur, retuned to this target's texel and put back after
        GS.blur.uniforms.uTexel.value.set(1 / SIZE, 1 / SIZE);
        const pass = (src, dst, dir, pw) => {
          GS.blur.uniforms.tSrc.value = src.texture;
          GS.blur.uniforms.uDir.value.set(dir[0], dir[1]);
          GS.blur.uniforms.uPow.value = pw;
          renderer.setRenderTarget(dst);
          renderer.render(GS.fsScene, GS.fsCam);
        };
        pass(CS.rtA, CS.rtB, [1, 0], 1.6);
        pass(CS.rtB, CS.rtA, [0, 1], 1.0);
        GS.blur.uniforms.uTexel.value.set(1 / 1024, 1 / 1024);
        renderer.setRenderTarget(prevT);
        renderer.setClearColor(prevC, prevA);
        // the quad wears the print exactly where the camera looked
        CS.quad.scale.set(2 * hw, 2 * hh, 1);
        CS.quad.position.x = cx; CS.quad.position.z = cz;
        CS.quad.visible = CS.on;
        return true;
      } catch (e) {
        if (window.console) console.warn('craft shadow bake:', e.message);
        return false;
      }
    };
  }
}

// A ROOM IS NEVER SKYLESS. The sky belongs to the mood now, so a caller that
// forgets to set one would get a backdrop sphere with no picture on it — this
// is the room's own default, and any caller's own setMood immediately replaces
// it. (`moodI` starts at -1 so the first call always installs.)
setMood(0);

return {
  group: ROOT, background: BG, fog: FOG,
  library: [{ key: 'baked', name: '(part’s own)' }].concat(
    Object.keys(LIB).map(k => ({ key: k, name: LIB[k].name || k }))),
  parts: Object.keys(PARTS).map(k => ({ key: k, name: PARTS[k].name })),
  setPart, partState: k => (PARTS[k] ? Object.assign({}, PARTS[k].state) : null),
  dayCard: M.dayCardMesh || null, hasSky: !!skyMat,
  // the aeroplane stands on the floor at y = 0 in the room's own frame, nose
  // toward the door at -x. The caller lines the room up with the aeroplane
  // rather than moving the aeroplane, so the sim keeps its own coordinates.
  doorAxis: -1, floorY: 0,
  dims: { HW: HW, HD: HD, EAVE: EAVE, RIDGE: RIDGE },
  lights: { key: key, hemi: hemi, top: top, winFill: winFill, lamps: lamps },
  mats: M, shafts: shafts, faceShafts: faceShafts,
  // the kit that follows the aeroplane, and the equirect the caller may bake
  // an environment from instead of the room's own cube pass
  placeMobile: placeMobile, mobile: mobileList, mobileShow: mobileShow,
  // the baked floor shadow: re-run after anything on the floor moves
  bakeGroundShadow: GS.bake, disposeGroundShadow: GS.dispose,
  bakeCraftShadow: CS.bake,
  _gs: GS,                           // dev handle: the bake's own targets
  groundShadow: v => {
    if (v !== undefined) {
      GS.on = CS.on = v > 0;
      GS.quad.material.opacity = CS.quad.material.opacity = Math.max(0, Math.min(1, v));
      GS.quad.visible = GS.on && GS.quad.material.alphaMap === GS.rtA.texture;
      if (!CS.on) CS.quad.visible = false;
    }
    return GS.on ? GS.quad.material.opacity : 0;
  },
  // THE SKY IS LIVE NOW (G62): it changes with the mood, so the caller that
  // PMREMs it has to be able to ask for the current one rather than being
  // handed one at build time — and to be told when a swapped-in equirect has
  // finished decoding, since a bake against a blank texture is a black room.
  skyTexture: () => (skyMat ? skyMat.map : null),
  onSkyReady: fn => { skyOnReady = fn; },
  moods: MOODS.map(m => m.name || m.n), setMood: setMood,
  mood: () => moodI,
};
}
