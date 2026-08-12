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
  'HemisphereLight', 'DirectionalLight', 'PointLight', 'CanvasTexture',
  'Vector2', 'Vector3', 'Matrix4', 'Box3'];
function genHangarSupported(THREE) {
  return !!THREE && GEN_HANGAR_NEEDS.every(k => THREE[k] !== undefined);
}

function genHangarBuild(THREE) {

// ===========================================================================
// THE GARAGE. A working hangar, big enough for a DC-3 (29 m span) with room to
// walk round it: 26 m deep, 36 m wide, 8.4 m to the eaves and 11.6 m to the
// ridge. Long axis is x, doors at -x, which is the end the aeroplane's nose
// points at (model frame: x AFT).
//
// Everything here is built from primitives and canvas-baked sheets — no
// external art. The light is the point: north glazing down both flanks, four
// roof lights, a warm shop lamp over every bay, and the door open on a bright
// afternoon. What sells a big interior is the SOFT half of that, so the scene
// bakes its own environment map off itself (CubeCamera -> PMREM) and every
// material reads its ambient from the room it is standing in.
// ===========================================================================
const HW = 18, HD = 13, EAVE = 8.4, RIDGE = 11.6;   // half-width, half-depth
// The opening is nearly the whole gable end, which is what a hangar door IS: a
// shed you cannot get the aeroplane into is a shed. 31 m clear passes a DC-3's
// 28.96 m span with a metre either side, and the leaves park in the corners.
const DOOR_W = 31, DOOR_H = 6.4;

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
  t.anisotropy = 8;
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
floorAlb.repeat.set(1, 1); floorRgh.repeat.set(1, 1);

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

// pegboard: the shadow board a tidy shop paints behind its tools
const pegAlb = sheet(512, 512, (g, W, H) => {
  g.fillStyle = '#c8bda6'; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(60,52,40,.55)';
  for (let y = 12; y < H; y += 22) for (let x = 12; x < W; x += 22) {
    g.beginPath(); g.arc(x, y, 2.6, 0, 7); g.fill();
  }
});
pegAlb.repeat.set(2, 1);

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
wallAlb.repeat.set(3, 1);
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
blockAlb.repeat.set(6, 1);
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
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
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
doorAlb.repeat.set(2, 1);
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

const M = {
  floor: new THREE.MeshStandardMaterial({ map: floorAlb, roughnessMap: floorRgh,
    normalMap: slabNrm, normalScale: new THREE.Vector2(0.35, 0.35),
    roughness: 1, metalness: 0.12, envMapIntensity: 1.7 }),
  wall: new THREE.MeshStandardMaterial({ map: wallAlb, normalMap: corrNrm,
    normalScale: new THREE.Vector2(0.8, 0.8), roughnessMap: wallRgh,
    roughness: 0.70, metalness: 0.14, side: THREE.DoubleSide }),
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
  peg: new THREE.MeshStandardMaterial({ map: pegAlb, roughness: 0.88 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xdce8f0, roughness: 0.06, metalness: 0,
    // `thickness` is r132+ and this build is r128: transmission alone, with
    // the opacity carrying what the refraction slab would have.
    transmission: 0.90, transparent: true, opacity: 0.5,
    envMapIntensity: 1.4, side: THREE.DoubleSide }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x22242a, roughness: 0.95 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb08d4a, roughness: 0.32, metalness: 0.9 }),
  alu: new THREE.MeshStandardMaterial({ color: 0xa8adb3, roughness: 0.30, metalness: 0.92 }),
  canvasM: new THREE.MeshStandardMaterial({ color: 0xa89a80, roughness: 0.95 }),
  leather: new THREE.MeshStandardMaterial({ color: 0x6b4630, roughness: 0.72 }),
  rug: new THREE.MeshStandardMaterial({ color: 0x74362f, roughness: 0.96 }),
  lampWarm: new THREE.MeshStandardMaterial({ color: 0xffe6b8, emissive: 0xffcf87,
    emissiveIntensity: 3.2, roughness: 0.6 }),
  skyPanel: new THREE.MeshStandardMaterial({ color: 0xdfeaf6, emissive: 0xcfe2f7,
    emissiveIntensity: 1.7, roughness: 0.9, side: THREE.DoubleSide }),
  daylight: new THREE.MeshBasicMaterial({ color: 0xf2ecdc, side: THREE.FrontSide }),
};

// ---- primitive helpers ----------------------------------------------------
const G = new THREE.Group();                 // everything static
const box = (w, h, d, mat, x, y, z, ry) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); if (ry) m.rotation.y = ry;
  m.castShadow = m.receiveShadow = true;
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
  const us = uvScale || 1;
  g2.setAttribute('uv', new THREE.Float32BufferAttribute(
    [0, 0, us, 0, us, us, 0, 0, us, us, 0, us], 2));
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
  put(box(2 * HD, 1.1, 0.25, M.stem, 0, 0.55, s * HW));
  // lower sheeting to the sill
  put(box(2 * HD, 2.1, 0.12, M.wall, 0, 2.15, s * HW));
  // upper sheeting, sill 3.2 to eaves
  put(box(2 * HD, EAVE - 5.2, 0.12, M.wall, 0, 5.2 + (EAVE - 5.2) / 2, s * HW));
  put(box(2 * HD + 0.4, EAVE + 0.4, 0.06, M.wallOut, 0, (EAVE + 0.4) / 2, s * (HW + 0.16)));
  // THE GLAZING BAND. Industrial steel windows, 3.2 to 5.2 m: high enough to
  // light the whole floor and clear a wing, which is why real hangars glaze
  // exactly there.
  const nBay = 9, bayW = (2 * HD) / nBay;
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
  put(box(0.14, EAVE, 2 * HW, M.wall, HD, EAVE / 2, 0));
  const gable = new THREE.Shape();
  gable.moveTo(-HW, EAVE); gable.lineTo(HW, EAVE); gable.lineTo(0, RIDGE);
  const gm = new THREE.Mesh(new THREE.ShapeGeometry(gable), M.wall);
  gm.rotation.y = Math.PI / 2; gm.position.x = HD;
  gm.receiveShadow = true;
  put(gm);
  // gable window: the one that throws a long shape across the floor
  put(box(0.05, 1.6, 4.2, M.glass, HD - 0.10, EAVE - 1.3, 0));
  for (let k = 0; k <= 4; k++)
    put(box(0.10, 1.7, 0.08, M.steelDark, HD - 0.10, EAVE - 1.3, -2.1 + k * 1.05));
  put(box(0.12, 0.10, 4.3, M.steelDark, HD - 0.10, EAVE - 2.15, 0),
      box(0.12, 0.10, 4.3, M.steelDark, HD - 0.10, EAVE - 0.45, 0));
  put(box(0.10, 2.1, 0.95, M.paintGreen, HD - 0.08, 1.05, 13.5));
  put(cyl(0.03, 0.03, 0.16, M.brass, HD - 0.16, 1.0, 13.15, 8));
}

// door wall (-x): a big sliding opening, leaves parked open, daylight beyond
{
  const side = (HW - DOOR_W / 2);
  for (const s of [1, -1])
    put(box(0.14, EAVE, side, M.wall, -HD, EAVE / 2, s * (DOOR_W / 2 + side / 2)));
  put(box(0.14, EAVE - DOOR_H, DOOR_W, M.wall, -HD, DOOR_H + (EAVE - DOOR_H) / 2, 0));
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
    g.add(box(0.10, DOOR_H, LW, M.door, 0, DOOR_H / 2, 0));
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
}

// ---- roof: portal trusses, purlins, deck, roof lights ---------------------
{
  const NT = 7;
  for (let i = 0; i < NT; i++) {
    const x = -HD + 0.6 + (2 * HD - 1.2) * i / (NT - 1);
    // top chords to the ridge, bottom tie, king post, web diagonals
    put(strut([x, EAVE, -HW], [x, RIDGE, 0], 0.10, M.steel, 6),
        strut([x, EAVE, HW], [x, RIDGE, 0], 0.10, M.steel, 6),
        strut([x, EAVE - 0.05, -HW], [x, EAVE - 0.05, HW], 0.085, M.steel, 6),
        strut([x, EAVE, 0], [x, RIDGE - 0.1, 0], 0.06, M.steel, 6));
    for (const s of [1, -1]) for (const f of [0.34, 0.67]) {
      const zt = s * HW * f, yt = EAVE + (RIDGE - EAVE) * (1 - f);
      put(strut([x, EAVE, zt], [x, yt, zt], 0.045, M.steel, 6));
      put(strut([x, EAVE, s * HW * (f - 0.33)], [x, yt, zt], 0.04, M.steel, 6));
    }
    // stanchion down the wall, so the frame reads as a portal
    for (const s of [1, -1]) put(box(0.34, EAVE, 0.30, M.steel, x, EAVE / 2, s * (HW - 0.3)));
  }
  // purlins and the deck underside
  for (const s of [1, -1]) {
    for (let k = 0; k <= 6; k++) {
      const f = k / 6, z = s * HW * f, y = EAVE + (RIDGE - EAVE) * (1 - f) - 0.14;
      put(box(2 * HD - 1, 0.14, 0.10, M.steelDark, 0, y, z));
    }
    // ridge to eave, running the full depth. Wound so the normal faces DOWN
    // into the shed, which is the side anything in here can see.
    const R0 = [-HD - 0.3, RIDGE, 0], R1 = [HD + 0.3, RIDGE, 0];
    const E0 = [-HD - 0.3, EAVE, s * (HW + 0.5)], E1 = [HD + 0.3, EAVE, s * (HW + 0.5)];
    put(s > 0 ? quad(R0, R1, E1, E0, M.roofIn, 6) : quad(R1, R0, E0, E1, M.roofIn, 6));
    put(s > 0 ? quad(E0, E1, R1, R0, M.roofOut, 6) : quad(E1, E0, R0, R1, M.roofOut, 6));
  }
  put(box(2 * HD, 0.3, 0.7, M.steelDark, 0, RIDGE + 0.05, 0));
  // ROOF LIGHTS. Four translucent panels down each slope: the reason the middle
  // of a hangar is not a cave, and the softest light in the scene.
  // t = 0 at the ridge, 1 at the eave: one function, so a roof light cannot end
  // up in a different plane from the roof it is a hole in.
  const onSlope = (s, x, t) => [x, RIDGE + (EAVE - RIDGE) * t - 0.06, s * HW * t];
  for (const s of [1, -1]) for (let k = 0; k < 4; k++) {
    const x = -HD + 3.4 + k * (2 * HD - 6.8) / 3;
    const a = onSlope(s, x - 1.8, 0.30), b = onSlope(s, x + 1.8, 0.30),
          c = onSlope(s, x + 1.8, 0.62), d = onSlope(s, x - 1.8, 0.62);
    const p = s > 0 ? quad(a, b, c, d, M.skyPanel) : quad(b, a, d, c, M.skyPanel);
    p.castShadow = false;
    put(p);
  }
}

// ===========================================================================
// FITTINGS — the things that make it a place where aeroplanes get built
// ===========================================================================

// a bench: top, apron, legs, a shelf under, and whatever is standing on it
function bench(x, z, len, ry, opts) {
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.rotation.y = ry || 0;
  const H = 0.92, D = 0.72;
  const top = box(len, 0.075, D, M.wood, 0, H, 0);
  g.add(top, box(len - 0.1, 0.16, 0.05, M.woodPale, 0, H - 0.12, D / 2 - 0.03));
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    g.add(box(0.09, H - 0.04, 0.09, M.woodPale,
              sx * (len / 2 - 0.14), (H - 0.04) / 2, sz * (D / 2 - 0.12)));
  g.add(box(len - 0.4, 0.04, D - 0.3, M.woodPale, 0, 0.22, 0));
  // drawer bank
  g.add(box(0.62, 0.68, D - 0.12, M.paintBlue, len / 2 - 0.45, 0.55, 0));
  for (let k = 0; k < 3; k++) {
    g.add(box(0.58, 0.18, 0.03, M.steelDark, len / 2 - 0.45, 0.30 + k * 0.22, D / 2 - 0.07));
    // `g.add(x)` returns the GROUP, not x — writing `.rotation` on the end of it
    // laid the whole bench on its side, three times over
    const hdl = cyl(0.012, 0.012, 0.16, M.alu, len / 2 - 0.45, 0.30 + k * 0.22, D / 2 - 0.10, 8);
    hdl.rotation.z = Math.PI / 2;
    g.add(hdl);
  }
  if (opts && opts.vice) {                 // every bench has one, at the left end
    const v = new THREE.Group();
    v.position.set(-len / 2 + 0.35, H + 0.04, 0.10);
    v.add(box(0.26, 0.10, 0.16, M.steelDark, 0, 0.05, 0),
          box(0.10, 0.20, 0.20, M.steelDark, -0.10, 0.14, 0),
          box(0.10, 0.20, 0.20, M.steelDark, 0.06, 0.14, 0));
    const scr = cyl(0.018, 0.018, 0.34, M.alu, 0.16, 0.14, 0, 8);
    scr.rotation.z = Math.PI / 2; v.add(scr);
    v.add(cyl(0.014, 0.014, 0.26, M.steelDark, 0.33, 0.14, 0, 8));
    g.add(v);
  }
  // clutter: jars, tins, offcuts, a mug
  for (let i = 0; i < (opts && opts.clutter != null ? opts.clutter : 6); i++) {
    const cx = rr(-len / 2 + 0.6, len / 2 - 1.0), r = rr(0.045, 0.085);
    const kind = rand();
    if (kind < 0.45) g.add(cyl(r, r, rr(0.09, 0.17), M.alu, cx, H + 0.07, rr(-0.2, 0.2), 12));
    else if (kind < 0.75) g.add(box(rr(0.1, 0.3), rr(0.05, 0.12), rr(0.08, 0.2),
      rand() < 0.5 ? M.woodPale : M.steelDark, cx, H + 0.06, rr(-0.22, 0.22), rand() * 3));
    else g.add(cyl(r * 1.2, r, rr(0.16, 0.26), M.paintRed, cx, H + 0.12, rr(-0.2, 0.2), 12));
  }
  G.add(g);
  return g;
}

// pegboard with a tool shadow-board on it
function pegboard(x, z, w, ry) {
  const g = new THREE.Group();
  g.position.set(x, 1.75, z); g.rotation.y = ry || 0;
  g.add(box(w, 1.5, 0.03, M.peg, 0, 0, 0));
  const tool = (tx, ty, kind) => {
    if (kind === 0) {                       // spanner
      g.add(box(0.035, 0.34, 0.02, M.alu, tx, ty, 0.035));
      g.add(box(0.075, 0.07, 0.02, M.alu, tx, ty + 0.18, 0.035));
      g.add(box(0.065, 0.06, 0.02, M.alu, tx, ty - 0.18, 0.035));
    } else if (kind === 1) {                // hammer
      g.add(cyl(0.014, 0.014, 0.30, M.wood, tx, ty, 0.035, 8));
      g.add(box(0.11, 0.05, 0.05, M.steelDark, tx, ty + 0.16, 0.035));
    } else if (kind === 2) {                // screwdriver
      g.add(cyl(0.011, 0.011, 0.20, M.alu, tx, ty - 0.06, 0.035, 8));
      g.add(cyl(0.021, 0.018, 0.11, M.paintRed, tx, ty + 0.10, 0.035, 8));
    } else if (kind === 3) {                // pliers
      g.add(box(0.03, 0.24, 0.02, M.steelDark, tx - 0.012, ty, 0.035));
      g.add(box(0.03, 0.24, 0.02, M.steelDark, tx + 0.012, ty, 0.035));
      g.add(box(0.055, 0.07, 0.025, M.paintRed, tx, ty - 0.13, 0.035));
    } else {                                // file
      g.add(box(0.022, 0.30, 0.018, M.steelDark, tx, ty, 0.035));
      g.add(cyl(0.016, 0.012, 0.09, M.wood, tx, ty + 0.19, 0.035, 8));
    }
  };
  const n = Math.floor(w / 0.24);
  for (let i = 0; i < n; i++)
    for (const ty of [0.34, -0.14])
      if (rand() < 0.78) tool(-w / 2 + 0.16 + i * 0.24, ty, Math.floor(rand() * 5));
  G.add(g);
  return g;
}

// steel shelving, loaded with boxes and tins
function shelving(x, z, w, ry) {
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.rotation.y = ry || 0;
  const H = 2.3, D = 0.55;
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    g.add(box(0.05, H, 0.05, M.steelDark, sx * (w / 2 - 0.04), H / 2, sz * (D / 2 - 0.04)));
  for (let k = 0; k < 5; k++) {
    const y = 0.25 + k * (H - 0.4) / 4;
    g.add(box(w, 0.03, D, M.steelDark, 0, y, 0));
    let cx = -w / 2 + 0.15;
    while (cx < w / 2 - 0.25) {
      const bw = rr(0.22, 0.55), bh = rr(0.18, 0.34);
      if (rand() < 0.75)
        g.add(box(bw, bh, rr(0.3, D - 0.06),
          [M.canvasM, M.woodPale, M.paintBlue, M.paintRed][Math.floor(rand() * 4)],
          cx + bw / 2, y + bh / 2 + 0.02, rr(-0.05, 0.05)));
      cx += bw + rr(0.04, 0.16);
    }
  }
  G.add(g);
  return g;
}

// an engine on a stand, the centrepiece of any build shop
function engineStand(x, z, ry) {
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.rotation.y = ry || 0;
  // stand
  g.add(box(0.09, 0.09, 1.3, M.paintRed, 0, 0.09, 0),
        box(1.0, 0.09, 0.09, M.paintRed, 0.25, 0.09, 0),
        box(0.14, 0.95, 0.14, M.paintRed, 0, 0.55, 0),
        box(0.5, 0.10, 0.10, M.paintRed, 0.2, 1.0, 0));
  for (const [cx, cz] of [[0.6, 0.55], [0.6, -0.55], [-0.15, 0]]) {
    const w = cyl(0.06, 0.06, 0.04, M.rubber, cx, 0.06, cz, 12);
    w.rotation.x = Math.PI / 2; g.add(w);
  }
  // a flat four: case, jugs, accessories
  const e = new THREE.Group(); e.position.set(0.30, 1.16, 0);
  e.add(box(0.46, 0.30, 0.30, M.steelDark, 0, 0, 0));
  for (const s of [1, -1]) for (const cx of [-0.13, 0.13]) {
    const jug = cyl(0.085, 0.095, 0.26, M.steel, cx, -0.02, s * 0.27, 12);
    jug.rotation.x = Math.PI / 2; e.add(jug);
    for (let f = 0; f < 5; f++) {
      const fin = cyl(0.105, 0.105, 0.012, M.steelDark, cx, -0.02, s * (0.20 + f * 0.045), 12);
      fin.rotation.x = Math.PI / 2; e.add(fin);
    }
  }
  const shaft = cyl(0.04, 0.04, 0.22, M.alu, -0.32, 0, 0, 12);
  shaft.rotation.z = Math.PI / 2; e.add(shaft);
  e.add(box(0.14, 0.16, 0.18, M.brass, 0.22, 0.06, 0));
  for (const s of [1, -1])
    e.add(strut([0.0, -0.14, s * 0.10], [0.30, -0.36, s * 0.12], 0.014, M.alu));
  g.add(e);
  G.add(g);
  return g;
}

// trestles with a wing panel across them, half-covered
function wingJig(x, z, ry) {
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.rotation.y = ry || 0;
  for (const cz of [-1.7, 1.7]) {
    const t = new THREE.Group(); t.position.z = cz;
    for (const s of [-1, 1]) {
      t.add(strut([s * 0.42, 0.02, -0.28], [s * 0.06, 0.88, 0], 0.035, M.woodPale));
      t.add(strut([s * 0.42, 0.02, 0.28], [s * 0.06, 0.88, 0], 0.035, M.woodPale));
    }
    t.add(box(1.0, 0.07, 0.10, M.woodPale, 0, 0.90, 0));
    g.add(t);
  }
  // the panel: ribs on a spar, part covered
  g.add(box(1.25, 0.06, 4.6, M.woodPale, 0, 0.98, 0));
  for (let k = 0; k < 9; k++) {
    const rz = -2.1 + k * 0.52;
    g.add(box(1.15, 0.02, 0.02, M.woodPale, 0, 1.04, rz),
          box(1.15, 0.02, 0.02, M.woodPale, 0, 0.94, rz));
    for (const cx of [-0.4, 0, 0.4])
      g.add(box(0.02, 0.10, 0.02, M.woodPale, cx, 0.99, rz));
  }
  const cov = box(1.22, 0.02, 2.1, M.canvasM, 0, 1.06, -1.15);
  g.add(cov);
  G.add(g);
  return g;
}

// a propeller leaning against the wall — the shop's own ornament
function leaningProp(x, z, ry) {
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.rotation.set(0, ry || 0, 0.22);
  const hub = cyl(0.10, 0.10, 0.09, M.brass, 0, 1.05, 0, 16);
  hub.rotation.x = Math.PI / 2; g.add(hub);
  for (const s of [1, -1]) {
    const bl = new THREE.Group(); bl.position.y = 1.05;
    for (let k = 0; k < 6; k++) {
      const t = k / 5, r = 0.12 + t * 0.9;
      const w = 0.16 * (1 - 0.35 * t) * (t > 0.9 ? (1 - t) / 0.1 : 1);
      const seg = box(w, 0.028, 0.05, M.wood, 0, s * r, 0);
      seg.rotation.y = s * (0.42 - 0.3 * t);
      bl.add(seg);
    }
    g.add(bl);
  }
  G.add(g);
  return g;
}

// drums, cans, a tyre stack, a gas bottle rack — the floor furniture
function drum(x, z, mat) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  g.add(cyl(0.29, 0.29, 0.88, mat, 0, 0.44, 0, 20));
  for (const y of [0.28, 0.60]) g.add(cyl(0.30, 0.30, 0.05, M.steelDark, 0, y, 0, 20));
  g.add(cyl(0.29, 0.29, 0.03, M.steelDark, 0, 0.89, 0, 20));
  G.add(g); return g;
}
function tyreStack(x, z, n) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  for (let k = 0; k < n; k++) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.115, 10, 22), M.rubber);
    t.rotation.x = Math.PI / 2; t.position.set(rr(-0.03, 0.03), 0.12 + k * 0.23, rr(-0.03, 0.03));
    t.rotation.z = rand() * 3; t.castShadow = true;
    g.add(t);
  }
  G.add(g); return g;
}
function bottleRack(x, z, ry) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0;
  g.add(box(1.1, 0.06, 0.5, M.steelDark, 0, 0.05, 0),
        box(1.1, 0.05, 0.05, M.steelDark, 0, 1.15, -0.2));
  for (const [cx, mat] of [[-0.36, M.paintGreen], [-0.02, M.steelDark], [0.34, M.paintRed]]) {
    g.add(cyl(0.115, 0.115, 1.35, mat, cx, 0.72, 0, 14));
    g.add(cyl(0.05, 0.05, 0.14, M.brass, cx, 1.46, 0, 10));
    g.add(cyl(0.09, 0.09, 0.06, M.steelDark, cx, 1.52, 0, 10));
  }
  G.add(g); return g;
}
function toolChest(x, z, ry) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0;
  g.add(box(1.05, 0.95, 0.52, M.paintRed, 0, 0.60, 0));
  g.add(box(1.09, 0.05, 0.56, M.woodPale, 0, 1.10, 0));
  for (let k = 0; k < 4; k++) {
    g.add(box(1.0, 0.16, 0.02, M.steelDark, 0, 0.28 + k * 0.21, 0.27));
    const h = box(0.5, 0.03, 0.03, M.alu, 0, 0.28 + k * 0.21, 0.29);
    g.add(h);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = cyl(0.07, 0.07, 0.04, M.rubber, sx * 0.42, 0.07, sz * 0.18, 10);
    w.rotation.x = Math.PI / 2; g.add(w);
  }
  G.add(g); return g;
}
function stepladder(x, z, ry) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0;
  for (const s of [-1, 1]) {
    g.add(strut([s * 0.24, 0.02, -0.30], [s * 0.16, 2.0, -0.06], 0.032, M.woodPale));
    g.add(strut([s * 0.24, 0.02, 0.42], [s * 0.16, 2.0, 0.06], 0.028, M.woodPale));
  }
  for (let k = 0; k < 6; k++) {
    const t = k / 6;
    g.add(box(0.46 - t * 0.06, 0.03, 0.13, M.woodPale, 0, 0.22 + k * 0.29, -0.28 + t * 0.22));
  }
  g.add(box(0.46, 0.04, 0.24, M.woodPale, 0, 2.0, -0.05));
  G.add(g); return g;
}
// a wood stove and a chair: the cosy corner every real shop has
function stoveCorner(x, z, ry) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0;
  g.add(box(1.3, 0.06, 1.3, M.stem, 0, 0.03, 0));
  g.add(cyl(0.30, 0.34, 0.78, M.steelDark, 0, 0.42, 0, 16));
  g.add(cyl(0.36, 0.36, 0.05, M.steelDark, 0, 0.83, 0, 16));
  const door = cyl(0.16, 0.16, 0.03, M.lampWarm, 0, 0.42, 0.33, 14);
  door.rotation.x = Math.PI / 2; g.add(door);
  const glow = new THREE.PointLight(0xff7a2a, 14, 7, 2);
  glow.position.set(0, 0.45, 0.5); g.add(glow);
  // the flue goes THROUGH the roof, as a flue does — the height comes from the
  // shed's own eave so it cannot end in mid-air when the geometry changes
  {
    const top = EAVE + 0.6, fl = cyl(0.09, 0.09, top - 0.86, M.steelDark, 0, 0.86 + (top - 0.86) / 2, 0, 12);
    g.add(fl);
    g.add(cyl(0.16, 0.16, 0.10, M.steelDark, 0, top - 0.9, 0, 12));   // roof collar
    g.add(cyl(0.13, 0.13, 0.06, M.steelDark, 0, 1.30, 0, 12));        // stove collar
  }
  // log basket + logs
  g.add(cyl(0.30, 0.26, 0.34, M.wood, 0.95, 0.17, 0.2, 14));
  for (let k = 0; k < 5; k++) {
    const l = cyl(0.055, 0.055, rr(0.28, 0.38), M.wood, 0.95 + rr(-0.1, 0.1),
                  0.36 + k * 0.05, 0.2 + rr(-0.1, 0.1), 8);
    l.rotation.set(rand() * 3, rand() * 3, Math.PI / 2 + rr(-0.4, 0.4));
    g.add(l);
  }
  // armchair
  const ch = new THREE.Group(); ch.position.set(-0.2, 0, 1.5); ch.rotation.y = -0.7;
  ch.add(box(0.78, 0.18, 0.72, M.leather, 0, 0.42, 0),
         box(0.78, 0.62, 0.16, M.leather, 0, 0.72, -0.34),
         box(0.14, 0.30, 0.72, M.leather, -0.34, 0.60, 0),
         box(0.14, 0.30, 0.72, M.leather, 0.34, 0.60, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    ch.add(box(0.07, 0.34, 0.07, M.wood, sx * 0.32, 0.17, sz * 0.29));
  g.add(ch);
  const rug = box(2.6, 0.012, 2.0, M.rug, 0.1, 0.006, 1.7);
  g.add(rug);
  G.add(g); return g;
}
// a drawing board with plans, under a lamp
function planTable(x, z, ry) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0;
  const top = box(1.5, 0.05, 1.0, M.woodPale, 0, 0.95, 0);
  top.rotation.x = -0.22; g.add(top);
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    g.add(box(0.07, 0.9, 0.07, M.wood, sx * 0.65, 0.45, sz * 0.42));
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
  // a couple of alloy sheets leaning on the end
  for (let k = 0; k < 3; k++) {
    const s = box(1.5, 2.0, 0.012, M.alu, 0.55 + k * 0.05, 1.0, 3.3 + k * 0.06);
    s.rotation.set(0, Math.PI / 2, 0.12); g.add(s);
  }
  G.add(g); return g;
}
// a parts trolley with a cowling on it, parked by the aeroplane
function partsTrolley(x, z, ry) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0;
  g.add(box(1.2, 0.05, 0.7, M.woodPale, 0, 0.72, 0),
        box(1.1, 0.04, 0.6, M.woodPale, 0, 0.30, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(box(0.05, 0.7, 0.05, M.steelDark, sx * 0.54, 0.36, sz * 0.30));
    const w = cyl(0.075, 0.075, 0.04, M.rubber, sx * 0.54, 0.06, sz * 0.30, 10);
    w.rotation.x = Math.PI / 2; g.add(w);
  }
  g.add(box(1.15, 0.04, 0.04, M.steelDark, 0, 1.0, -0.30));
  for (const sx of [-1, 1]) g.add(cyl(0.02, 0.02, 0.3, M.steelDark, sx * 0.54, 0.87, -0.30, 8));
  // a cowling half, upside down
  const cw = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.40, 0.55, 18, 1, true,
    0, Math.PI), M.paintRed);
  cw.rotation.set(Math.PI / 2, 0, 0.4); cw.position.set(-0.1, 0.86, 0.02);
  cw.castShadow = true; g.add(cw);
  G.add(g); return g;
}
// jack stands and a wheel off the aeroplane
function jackStand(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  g.add(cyl(0.05, 0.05, 0.55, M.paintRed, 0, 0.28, 0, 10));
  for (const a of [0, 2.09, 4.19])
    g.add(strut([0, 0.50, 0], [Math.cos(a) * 0.28, 0.02, Math.sin(a) * 0.28], 0.022, M.paintRed));
  g.add(box(0.16, 0.03, 0.16, M.steelDark, 0, 0.57, 0));
  G.add(g); return g;
}

// ---- placement ------------------------------------------------------------
bench(-4.5, HW - 1.0, 3.2, Math.PI, { vice: true, clutter: 7 });
bench(-0.6, HW - 1.0, 2.6, Math.PI, { clutter: 5 });
pegboard(-4.5, HW - 0.30, 3.0, Math.PI);
pegboard(-0.6, HW - 0.30, 2.4, Math.PI);
shelving(4.4, HW - 0.9, 3.0, Math.PI);
shelving(8.2, HW - 0.9, 2.4, Math.PI);
bench(3.0, -HW + 1.0, 3.0, 0, { vice: true, clutter: 6 });
pegboard(3.0, -HW + 0.30, 2.8, 0);
shelving(-2.4, -HW + 0.9, 2.6, 0);
engineStand(8.4, -HW + 2.4, -0.5);
wingJig(-1.5, -HW + 2.6, 0.06);
leaningProp(10.6, HW - 1.1, Math.PI * 0.5);
toolChest(0.6, -HW + 2.4, 0.2);
toolChest(-6.2, HW - 2.2, Math.PI + 0.15);
stepladder(-8.4, -HW + 3.0, 0.5);
stepladder(9.4, HW - 3.4, -0.6);
drum(11.4, -HW + 1.4, M.paintGreen);
drum(11.4, -HW + 2.3, M.paintBlue);
drum(10.6, -HW + 1.8, M.paintRed);
tyreStack(-10.2, HW - 1.5, 4);
tyreStack(-11.0, HW - 2.3, 3);
bottleRack(11.6, HW - 1.6, -Math.PI / 2);
stoveCorner(10.4, 12.2, -0.5);
planTable(-9.0, 8.6, 0.4);
// EVERYTHING STANDS AGAINST A WALL. A working shed keeps the middle of the
// floor clear — that is where the aeroplane goes, and it is the only way it
// reads as the subject rather than as one more object in a cluttered room.
workPlatform(6.5, HW - 2.6, 0.10);
workPlatform(-7.5, -HW + 2.6, -0.10);
partsTrolley(9.6, HW - 2.4, 0.4);
partsTrolley(-9.4, -HW + 2.6, -0.3);
jackStand(-11.2, HW - 3.6); jackStand(-11.6, HW - 4.4);
toolChest(-8.0, HW - 2.4, Math.PI + 0.1);
// ry = PI, not -PI/2: the long stock lies along local z, so a quarter turn put
// every length of tube and spruce straight through the end wall
stockRack(HD - 1.6, -8.5, Math.PI);
tyreStack(-6.0, -HW + 1.6, 2);
drum(-8.2, -HW + 1.5, M.paintBlue);
// a stack of crates
for (let k = 0; k < 3; k++)
  put(box(rr(0.7, 1.0), 0.55, rr(0.6, 0.9), M.woodPale,
          -11.4, 0.28 + k * 0.56, -HW + 4.0 + rr(-0.2, 0.2), rr(-0.3, 0.3)));
// a compressor under the back bench, and a hose reel on the wall
put(cyl(0.22, 0.22, 1.1, M.paintRed, 11.9, 0.55, 6.2, 14));
put(box(0.5, 0.28, 0.3, M.steelDark, 11.9, 1.22, 6.2));
{
  const reel = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.09, 8, 20), M.paintBlue);
  reel.rotation.y = Math.PI / 2; reel.position.set(HD - 0.4, 2.4, 4.0);
  put(reel);
}
// a workbench radio, because the shop has a radio
put(box(0.34, 0.22, 0.18, M.woodPale, -3.4, 1.07, HW - 1.05));
put(cyl(0.07, 0.07, 0.02, M.steelDark, -3.4, 1.07, HW - 1.15, 12)).rotation.x = Math.PI / 2;

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
const key = new THREE.DirectionalLight(0xffe0b0, 2.6);
key.position.set(-30, 5.0, 7.5);
key.target.position.set(6, 0.6, -3);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -26; key.shadow.camera.right = 26;
key.shadow.camera.top = 16; key.shadow.camera.bottom = -12;
key.shadow.camera.near = 1; key.shadow.camera.far = 90;
key.shadow.bias = 0; key.shadow.normalBias = 0.02;
key.shadow.normalBias = 0.02;
ROOT.add(key, key.target);

// the glazing bands as light: two soft fills, one per flank, no shadows
const winFill = [];
for (const s of [1, -1]) {
  const w = new THREE.DirectionalLight(0xcfe0f2, 0.34);
  winFill.push(w);
  w.position.set(-4, 9, s * 30);
  w.target.position.set(0, 1, 0);
  ROOT.add(w, w.target);
}
// the roof lights, from straight above
const top = new THREE.DirectionalLight(0xe6eef8, 0.46);
top.position.set(2, 30, 1); ROOT.add(top);

// shop lamps: conical shades on a drop, with the bulb doing the work
const lamps = [];
for (const s of [1, -1]) for (let k = 0; k < 3; k++) {
  const x = -8 + k * 8, z = s * 9.5, y = 6.2;
  const g = new THREE.Group(); g.position.set(x, y, z);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.34, 20, 1, true), M.paintGreen);
  cone.rotation.x = Math.PI; cone.material.side = THREE.DoubleSide;
  g.add(cone);
  g.add(cyl(0.05, 0.05, 0.10, M.steelDark, 0, 0.2, 0, 10));
  const bulb = cyl(0.09, 0.09, 0.02, M.lampWarm, 0, -0.16, 0, 14);
  g.add(bulb);
  const drop = cyl(0.012, 0.012, RIDGE - y - 0.2, M.steelDark, 0, (RIDGE - y) / 2, 0, 6);
  g.add(drop);
  const L = new THREE.PointLight(0xffd9a0, 90, 26, 2);
  L.position.y = -0.2;
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
// The same four the session shipped. `env` was `scene.environmentIntensity`,
// which r128 does not have — so each material's own envMapIntensity is scaled
// from the value it was authored with. Authored values are captured once, here,
// because scaling a scaled value compounds every time the mood changes.
const ENV0 = new Map();
for (const k in M) if (M[k] && M[k].envMapIntensity !== undefined)
  ENV0.set(M[k], M[k].envMapIntensity);
const MOODS = [
  { n: 'AFTERNOON', key: 2.8,  hemi: 0.30, lamp: 70,  ex: 0.92, kc: 0xffdca8, bg: 0x14120f, env: 0.55, top: 0.46 },
  { n: 'OVERCAST',  key: 1.1,  hemi: 0.62, lamp: 120, ex: 0.98, kc: 0xdfe7f2, bg: 0x181a1c, env: 0.70, top: 0.66 },
  { n: 'GOLDEN',    key: 3.6,  hemi: 0.16, lamp: 140, ex: 0.90, kc: 0xffa855, bg: 0x140f0a, env: 0.34, top: 0.22 },
  { n: 'NIGHT',     key: 0.06, hemi: 0.05, lamp: 190, ex: 1.02, kc: 0x9fb6d8, bg: 0x0b0a09, env: 0.06, top: 0.03 },
];
let moodI = 0;
const setMood = i => {
  const m = MOODS[moodI = Math.max(0, Math.min(MOODS.length - 1, i | 0))];
  key.intensity = m.key; key.color.setHex(m.kc);
  hemi.intensity = m.hemi;
  for (const L of lamps) L.intensity = m.lamp;
  top.intensity = m.top;
  for (const w of winFill) w.intensity = m.env * 0.6;
  // the environment was baked ONCE, in daylight, so it has to be dimmed with
  // everything else or the room stays lit by a sun that has gone
  for (const [mat, e0] of ENV0) mat.envMapIntensity = e0 * (m.env / 0.55);
  BG.setHex(m.bg); FOG.color.setHex(m.bg);
  M.daylight.color.setHex(i === 3 ? 0x2b3550 : i === 2 ? 0xffd9a2 : 0xf2ecdc);
  M.skyPanel.emissiveIntensity = i === 3 ? 0.15 : i === 1 ? 3.4 : 2.6;
  shaftMat.opacity = i === 3 ? 0.03 : i === 2 ? 0.11 : i === 1 ? 0.035 : 0.055;
  return m;
};

return {
  group: ROOT, background: BG, fog: FOG,
  // the aeroplane stands on the floor at y = 0 in the room's own frame, nose
  // toward the door at -x. The caller lines the room up with the aeroplane
  // rather than moving the aeroplane, so the sim keeps its own coordinates.
  doorAxis: -1, floorY: 0,
  lights: { key: key, hemi: hemi, top: top, winFill: winFill, lamps: lamps },
  mats: M, shafts: shafts, faceShafts: faceShafts,
  moods: MOODS.map(m => m.n), setMood: setMood,
  mood: () => moodI,
};
}
