// THE GPS ON THE PANEL (G2803-G2804, AVIONICS-GPS phase 2; futureDesigns/AVIONICS-STATUS-2026-10.md §4.5, §5).
//
// The fitted GPS unit (GEN_AVIONICS.gps: portable / panel / glass; drawn by tools/_cage_panel.js on the plate or in
// its glareshield cradle) has ONE screen, and this file paints it: a moving map of the island from the game's own
// baked map (the minimap's underlay, WF.minimap - the same picture, never a second bake), the aeroplane's track,
// the active leg and the next waypoint of the pilot's published plan (else the destination, direct), and the
// numbers a pilot reads off a GPS: ground speed, desired track, distance and time to the waypoint.
//
// THE HUD MINIMAP IS NOT THIS (the user, 11 Oct): it stays as it is, for every aeroplane, whatever is fitted. This
// is the instrument on the panel of an aeroplane that BOUGHT one; it lives on the avionics bus behind its breaker
// and goes dark with it (cockpit.js CK.gpsOn: 31_elec.js bus.powered('gps')).
//
// THE COST RULES (the brief): a cheap 2D canvas, repainted at HZ (4 Hz) and uploaded only then; tick() runs every
// frame and allocates nothing (numbers, a Float32Array ring, cached strings); the map is drawn canvas to canvas
// and the canvas goes to the GPU as a texture upload - nothing is ever read back (no getImageData, no readPixels).
//
// ONE MATERIAL, one canvas: `material(aspect)` is the instance the shed's panel, the flight and a parked
// aeroplane's capture all share (`userData.panelSet = 'gps'`, the join's bucket key, like the registration tape).
//   bind(o)        a new flight: o = { kind, units, src } - src the page's doors, each returning a reference:
//                  map() the baked map canvas, box() its world box {x0, z0, size}, fields() the aerodromes,
//                  plan() the published plan (ap.intent: legs[], legI), dest() the destination aerodrome
//   tick(dt, CK)   every frame: CK the cockpit instance (CK.gpsOn, CK.cg, CK.nightK)
//   material(a, k) the screen's material (a = the screen's width / height, k the unit's kind for its standby)
//   key(k)         G2812: a softkey (KEYS: rngDn, rngUp, orient, page) - the range, north-up / track-up, the page
// Node-loadable (GATE GPSFACE): no DOM at module scope; a caller may hand a canvas factory (`setCanvas`).
(() => {
'use strict';
const HZ = 4;                                    // repaints a second
const TRACK_N = 720, TRACK_DT = 2;               // 24 min of track, a sample every 2 s (and only once moved 5 m)
const RANGE = { aviation: 7408, metric: 8000 };  // the map's width at power-on, m: 4 nm across, or 8 km
// G2812: THE SOFTKEYS (the user, 27 Oct: "a few generic buttons straight on the GPS, with only switching functions for
// now"): four, left to right as tools/_cage_panel.js GPS_KEYS draws them - the range down and up a step, north-up or
// track-up, and the page (the map, the nav data). Their labels are painted on the glass at each key: a strip along the
// bottom when the keys stand under the screen, a column on its left on a slim navigator (GEN_AVIONICS face.keys)
const KEYS = ['rngDn', 'rngUp', 'orient', 'page'];
const RANGES = { aviation: [1852, 3704, 7408, 14816, 29632], metric: [2000, 4000, 8000, 16000, 32000] };   // 1-16 nm, 2-32 km
const RNG_TXT = { aviation: ['RNG 1 nm', 'RNG 2 nm', 'RNG 4 nm', 'RNG 8 nm', 'RNG 16 nm'], metric: ['RNG 2 km', 'RNG 4 km', 'RNG 8 km', 'RNG 16 km', 'RNG 32 km'] };
const RNG0 = 2;                                  // 4 nm / 8 km at power-on
const BOOT_S = 1.6;                              // the splash after power comes on
const CW = 512;                                  // the canvas's width, px
const SEA = '#20465a', BG = '#000000';

const S = {
  cv: null, g: null, tex: null, mat: null, aspect: 1.6, H: 320,
  kind: 'portable', units: 'aviation', src: null,
  on: false, dark: true, boot: 0, acc: 0, trackAcc: 0,
  bound: false,                                  // a flight holds the unit (bind) until the shed takes it back (standby)
  // the track: x, z pairs, a ring
  tr: new Float32Array(TRACK_N * 2), trHead: 0, trN: 0, lastX: 0, lastZ: 0, have: false,
  // ground speed / track from the position between paints
  px: 0, pz: 0, pT: 0, gs: 0, trk: 0, glow: 1, paints: 0, uploads: 0,
  // G2812: the softkeys' state - the range step, north-up / track-up, the page; where the labels go
  rngI: RNG0, trkUp: false, page: 'map', keysAt: 'below', keys: 0,
};
let canvasMaker = null;
const W0 = typeof window !== 'undefined' ? window : null;
const T3 = () => (typeof THREE !== 'undefined' ? THREE : (W0 && W0.THREE) || null);
function newCanvas(w, h) {
  if (canvasMaker) return canvasMaker(w, h);
  if (typeof document === 'undefined' || !document.createElement) return null;
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

// ---- THE STRINGS, CACHED (a repaint builds none once warm) ---------------------------------------------------------
// Each takes an INTEGER the caller rounded (Math.round at the call site: an integer in the small-integer range is
// passed untagged, where a double handed to a function that is not inlined is boxed - 16 bytes a call)
const INT = [], TENTH = [], DEG = [], TWO = [];
const sInt = i => { i = i < 0 ? 0 : i > 99999 ? 99999 : i; return INT[i] || (INT[i] = String(i)); };
const sTenth = i => { i = i < 0 ? 0 : i > 9999 ? 9999 : i; return TENTH[i] || (TENTH[i] = (i / 10).toFixed(1)); };
const sDeg = i => { i = i % 360; if (i <= 0) i += 360; return DEG[i] || (DEG[i] = (i < 10 ? '00' : i < 100 ? '0' : '') + i); };
const sTwo = i => { i = i < 0 ? 0 : i > 99 ? 99 : i; return TWO[i] || (TWO[i] = (i < 10 ? '0' : '') + i); };

// ---- THE MATERIAL ---------------------------------------------------------------------------------------------------
function material(aspect, kind) {
  const THREE3 = T3();
  if (!THREE3) return null;
  const a = aspect > 0.2 ? aspect : S.aspect;
  // WHILE A FLIGHT HOLDS THE UNIT the panel layer's calls change nothing: a parked aeroplane's capture builds the
  // editor's panel for ANOTHER build (parked.js) and asks this material for its own screen - it gets this one as it
  // stands, never resized or renamed under the flight
  if (S.mat && S.bound) return S.mat;
  // the shed names the unit it drew (its standby page says which); a flight's bind names its own
  if (kind && kind !== S.kind && NAME[kind]) { S.kind = kind; if (S.mat && !S.on) paintStandby(); }
  if (!S.mat) {
    S.mat = new THREE3.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.18, metalness: 0,
      emissive: new THREE3.Color(0xffffff), emissiveIntensity: 0, side: THREE3.FrontSide });
    S.mat.userData.aeroskin = 1;          // never the grey understudy
    S.mat.userData.panelSet = 'gps';      // the join's bucket key
    S.mat.userData.inside = 1;
    sizeTo(a);
  } else if (Math.abs(a - S.aspect) / S.aspect > 0.02) sizeTo(a);
  return S.mat;
}
// a canvas at the screen's own aspect (the quad spans it whole): made at bind, never per frame - a texture's size
// is fixed once uploaded, so a new aspect is a new texture
function sizeTo(a) {
  const THREE3 = T3();
  S.aspect = a; S.H = Math.max(120, Math.round(CW / a));
  S.cv = newCanvas(CW, S.H);
  S.g = S.cv && S.cv.getContext ? S.cv.getContext('2d') : null;
  if (S.tex && S.tex.dispose) S.tex.dispose();
  S.tex = S.cv && THREE3 ? new THREE3.CanvasTexture(S.cv) : null;
  if (S.tex) { S.tex.colorSpace = THREE3.SRGBColorSpace; S.tex.anisotropy = 8; S.tex.flipY = true; }
  if (S.mat) { S.mat.map = S.tex; S.mat.emissiveMap = S.tex; S.mat.needsUpdate = true; }
  paintStandby();
}
function upload() { if (S.tex) { S.tex.needsUpdate = true; S.uploads++; } }

// ---- THE PAGES ------------------------------------------------------------------------------------------------------
const NAME = { portable: 'PORTABLE GPS', panel: 'GPS NAVIGATOR', glass: 'MFD · MAP' };
// in the shed: the unit off, its name on the glass (what you see on a parked aeroplane's panel)
function paintStandby() {
  const g = S.g; if (!g) return;
  g.fillStyle = '#0b0d10'; g.fillRect(0, 0, CW, S.H);
  g.fillStyle = 'rgba(255,255,255,0.10)';
  g.font = '600 26px "IBM Plex Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(NAME[S.kind] || 'GPS', CW / 2, S.H / 2);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  upload();
}
function paintDark() {
  const g = S.g; if (!g) return;
  g.fillStyle = BG; g.fillRect(0, 0, CW, S.H);
  upload();
}
function paintBoot() {
  const g = S.g; if (!g) return;
  g.fillStyle = '#06121c'; g.fillRect(0, 0, CW, S.H);
  g.fillStyle = '#8fd7ff'; g.font = '600 30px "IBM Plex Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(NAME[S.kind] || 'GPS', CW / 2, S.H / 2 - 16);
  g.fillStyle = '#5f8ea6'; g.font = '500 18px "IBM Plex Mono", monospace';
  g.fillText('ACQUIRING SATELLITES', CW / 2, S.H / 2 + 18);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  upload();
}
// the map page: a data bar on top, the map, the waypoint bar under it
// (the aeroplane's position arrives in FR.x / FR.z, module state: a double handed to a call that is not inlined is
// boxed, and this runs four times a second)
function paintMap() {
  const g = S.g; if (!g) return;
  const x = FR.x, z = FR.z;
  const H = S.H, bar = Math.max(30, Math.round(H * 0.15)), foot = Math.max(22, Math.round(H * 0.11));
  const kL = keyStrip(), kB = S.keysAt === 'left' ? 0 : kL, kX = S.keysAt === 'left' ? kL : 0;   // the softkeys' labels
  const mTop = bar, mH = H - bar - foot - kB, mX = kX, mW = CW - kX;
  const R = (RANGES[S.units] || RANGES.aviation)[S.rngI] || RANGE.aviation, k = mW / R;
  const src = S.src;
  // the map: the baked island under the aeroplane, the aeroplane in the middle - north up, or turned to the track
  g.fillStyle = SEA; g.fillRect(mX, mTop, mW, mH);
  const cx = Math.round(mX + mW / 2), cy = Math.round(mTop + mH / 2);
  // (the turn in module state, handed to the canvas from there: a double computed here and handed to a call is boxed)
  FR.rot = S.trkUp ? -S.trk : 0;
  const rot = FR.rot;
  g.save();
  g.beginPath(); g.rect(mX, mTop, mW, mH); g.clip();
  if (S.trkUp) { g.translate(cx, cy); g.rotate(FR.rot); g.translate(-cx, -cy); }
  const map = src && src.map ? src.map() : null, box = src && src.box ? src.box() : null;
  if (map && box && box.size > 0 && map.width > 0) {
    const s = map.width / box.size;
    // (turned, the square the map's diagonal spans, so no corner shows the sea that is not there)
    const span = rot ? Math.sqrt(mW * mW + mH * mH) : 0, vw = rot ? span : mW, vh = rot ? span : mH;
    let sx = (x - vw / 2 / k - box.x0) * s, sy = (z - vh / 2 / k - box.z0) * s;
    let sw = vw / k * s, sh = vh / k * s, dx = cx - vw / 2, dy = cy - vh / 2, dw = vw, dh = vh;
    // clip the source to the picture (and the destination with it): a source rect off the image is not drawn
    // the same way by every browser
    if (sx < 0) { const c = -sx / sw * dw; dx += c; dw -= c; sw += sx; sx = 0; }
    if (sy < 0) { const c = -sy / sh * dh; dy += c; dh -= c; sh += sy; sy = 0; }
    if (sx + sw > map.width) { const o = sx + sw - map.width; dw -= o / sw * dw; sw -= o; }
    if (sy + sh > map.height) { const o = sy + sh - map.height; dh -= o / sh * dh; sh -= o; }
    if (sw > 0 && sh > 0 && dw > 0 && dh > 0) g.drawImage(map, sx, sy, sw, sh, dx, dy, dw, dh);
  }
  FR.cx = cx; FR.cy = cy; FR.k = k;
  // the aerodromes in view: their rings turn with the map, their names stay upright (placed where the ring went)
  const F = src && src.fields ? src.fields() : null;
  const cr = Math.cos(rot), sr = Math.sin(rot), reach = S.trkUp ? Math.sqrt(mW * mW + mH * mH) / 2 + 20 : 0;
  if (F) {
    for (let i = 0; i < F.length; i++) {
      const a = F[i]; if (!a || a.kind === 'meadow') continue;
      const ax = PX(a.x), ay = PY(a.z);
      if (S.trkUp ? (ax - cx) * (ax - cx) + (ay - cy) * (ay - cy) > reach * reach
                  : (ax < mX - 20 || ax > CW + 20 || ay < mTop - 20 || ay > mTop + mH + 20)) continue;
      g.strokeStyle = '#e8eef2'; g.lineWidth = 2;
      g.beginPath(); g.arc(ax, ay, 5, 0, 6.283); g.stroke();
    }
  }
  // the track: the ring, oldest first
  if (S.trN > 1) {
    g.strokeStyle = '#5fe0e8'; g.lineWidth = 2; g.lineJoin = 'round';
    g.beginPath();
    const n = S.trN, i0 = (S.trHead - n + TRACK_N) % TRACK_N;
    for (let j = 0; j < n; j++) {
      const i = (i0 + j) % TRACK_N, tx = PX(S.tr[2 * i]), ty = PY(S.tr[2 * i + 1]);
      if (j === 0) g.moveTo(tx, ty); else g.lineTo(tx, ty);
    }
    g.lineTo(cx, cy);
    g.stroke();
  }
  // the leg: the plan's active one (else the destination, direct from here), magenta, the waypoint a diamond
  const W = waypoint();
  if (W.on) {
    g.strokeStyle = '#ff4fd8'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(PX(W.ax), PY(W.az)); g.lineTo(PX(W.bx), PY(W.bz)); g.stroke();
    const wx = PX(W.bx), wy = PY(W.bz);
    g.fillStyle = '#ff4fd8';
    g.beginPath(); g.moveTo(wx, wy - 7); g.lineTo(wx + 7, wy); g.lineTo(wx, wy + 7); g.lineTo(wx - 7, wy); g.closePath(); g.fill();
  }
  // the aeroplane: a white arrow along its track (the canvas already turned by the map's rotation: up, track-up)
  g.translate(cx, cy); g.rotate(S.trk);
  g.fillStyle = '#ffffff'; g.strokeStyle = '#000000'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(0, -12); g.lineTo(8, 9); g.lineTo(0, 4); g.lineTo(-8, 9); g.closePath(); g.fill(); g.stroke();
  g.restore();
  // the aerodromes' names, upright at their turned rings
  if (F) {
    g.save(); g.beginPath(); g.rect(mX, mTop, mW, mH); g.clip();
    g.font = '500 13px "IBM Plex Sans", sans-serif'; g.fillStyle = '#e8eef2';
    for (let i = 0; i < F.length; i++) {
      const a = F[i]; if (!a || a.kind === 'meadow' || !a.name) continue;
      const ux = PX(a.x) - cx, uy = PY(a.z) - cy, ax = cx + ux * cr - uy * sr, ay = cy + ux * sr + uy * cr;
      if (ax < mX - 20 || ax > CW + 20 || ay < mTop - 20 || ay > mTop + mH + 20) continue;
      g.fillText(a.name, Math.round(ax + 8), Math.round(ay + 4));
    }
    g.restore();
  }
  // north (its arrow turned with the map, track-up) and the range, on the map's corners
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(CW - 34, mTop + 4, 30, 30);
  g.save(); g.translate(CW - 19, mTop + 19); if (S.trkUp) g.rotate(FR.rot);
  g.fillStyle = '#ff6a5a'; g.beginPath(); g.moveTo(0, -12); g.lineTo(4, -5); g.lineTo(-4, -5); g.closePath(); g.fill();
  g.fillStyle = '#ffffff'; g.font = '700 13px "IBM Plex Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('N', 0, 3); g.restore();
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(mX + 4, mTop + mH - 24, 88, 20);
  g.fillStyle = '#ffffff'; g.font = '500 13px "IBM Plex Mono", monospace';
  g.fillText((RNG_TXT[S.units] || RNG_TXT.aviation)[S.rngI], mX + 9, mTop + mH - 9);
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(CW - 64, mTop + mH - 24, 60, 20);
  g.fillStyle = '#8fd7ff'; g.fillText(S.trkUp ? 'TRK UP' : 'N UP', CW - 58, mTop + mH - 9);
  // THE DATA BAR: GS, DTK, DIS, ETE (the units the build's panel is painted in), right of a key column
  g.fillStyle = '#0a0c0f'; g.fillRect(mX, 0, mW, bar);
  const metric = S.units === 'metric';
  const gsD = metric ? S.gs * 3.6 : S.gs * 1.943844;
  const ddx = W.bx - x, ddz = W.bz - z;
  const disM = W.on ? Math.sqrt(ddx * ddx + ddz * ddz) : 0;     // (not Math.hypot: a varargs builtin boxes its doubles)
  const ete = W.on && S.gs > 1 ? disM / S.gs : -1;
  const lab = Math.min(80, Math.round(bar * 0.30)), val = Math.min(80, Math.round(bar * 0.52));
  const cell = mW / 4;
  field(mX + 0 * cell, bar, lab, val, 'GS', sInt(Math.round(gsD)), metric ? 'km/h' : 'kt');
  field(mX + 1 * cell, bar, lab, val, 'DTK', W.on ? sDeg(Math.round(W.dtk)) : '---', '°');
  field(mX + 2 * cell, bar, lab, val, 'DIS', W.on ? sTenth(Math.round(metric ? disM / 100 : disM / 185.2)) : '--.-', metric ? 'km' : 'nm');
  if (ete >= 0 && ete < 6000) {
    const mm = Math.floor(ete / 60), ss = Math.floor(ete - 60 * mm);
    field2(mX + 3 * cell, bar, lab, val, 'ETE', sTwo(mm), sTwo(ss));
  } else field(mX + 3 * cell, bar, lab, val, 'ETE', '--:--', '');
  // THE WAYPOINT BAR
  const fB = H - kB;
  g.fillStyle = '#0a0c0f'; g.fillRect(mX, fB - foot, mW, foot);
  g.fillStyle = '#ff4fd8'; g.font = FONT_WPT[foot >= 28 ? 1 : 0];
  g.fillText(W.on ? (W.name || 'WPT') : 'NO ROUTE', mX + 10, fB - Math.round(foot * 0.3));
  g.fillStyle = '#8a9aa6'; g.font = FONT_TRK[foot >= 28 ? 1 : 0];
  g.fillText('TRK', CW - 92, fB - Math.round(foot * 0.3));
  g.fillStyle = '#ffffff'; g.fillText(S.gs > 1 ? sDeg(Math.round(S.trk * 57.29578)) : '---', CW - 56, fB - Math.round(foot * 0.3));
  paintKeys(kL);
}
// G2812: THE NAV PAGE - the numbers big, the plan's legs under them (the page key: the map and this)
function paintNav() {
  const g = S.g; if (!g) return;
  const x = FR.x, z = FR.z, H = S.H;
  const kL = keyStrip(), kB = S.keysAt === 'left' ? 0 : kL, mX = S.keysAt === 'left' ? kL : 0, mW = CW - mX;
  g.fillStyle = '#06090c'; g.fillRect(mX, 0, mW, H - kB);
  const W = waypoint(), metric = S.units === 'metric';
  const ddx = W.bx - x, ddz = W.bz - z;
  FR.dis = W.on ? Math.sqrt(ddx * ddx + ddz * ddz) : 0;
  FR.ete = W.on && S.gs > 1 ? FR.dis / S.gs : -1;
  // the title row: the page and the active waypoint
  const tH = Math.max(24, Math.round((H - kB) * 0.14));
  g.fillStyle = '#0d1218'; g.fillRect(mX, 0, mW, tH);
  g.fillStyle = '#8fd7ff'; g.font = FONT_WPT[tH >= 30 ? 1 : 0]; g.fillText('NAV', mX + 10, Math.round(tH * 0.72));
  g.fillStyle = '#ff4fd8'; g.fillText(W.on ? (W.name || 'WPT') : 'NO ROUTE', mX + 70, Math.round(tH * 0.72));
  // six fields, two rows of three
  const rows = 2, cols = 3, fh = Math.round((H - kB - tH) * 0.62 / rows);
  const lab = Math.min(80, Math.round(fh * 0.24)), val = Math.min(80, Math.round(fh * 0.46));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x0 = Math.round(mX + c * mW / cols), x1 = Math.round(mX + (c + 1) * mW / cols), y0 = tH + r * fh, i = r * cols + c;
    g.fillStyle = (r + c) % 2 ? '#0b1015' : '#0e141a'; g.fillRect(x0, y0, x1 - x0, fh);
    navField(x0, y0, fh, lab, val, i, W, metric);
  }
  // the plan's legs, the active one marked
  const src = S.src, IT = src && src.plan ? src.plan() : null, legs = IT && IT.legs;
  const y1 = tH + rows * fh, lh = Math.max(16, Math.round((H - kB - y1) / 3));
  g.font = FONT_TRK[lh >= 20 ? 1 : 0];
  if (legs && legs.length) {
    const a = Math.max(0, Math.min(legs.length - 1, IT.legI | 0));
    for (let j = 0; j < 3 && a + j - 1 < legs.length; j++) {
      const L = legs[a + j - 1]; if (!L) continue;
      g.fillStyle = j === 1 ? '#ff4fd8' : '#8a9aa6';
      g.fillText(j === 1 ? '>' : ' ', mX + 10, y1 + (j + 1) * lh - 5);
      g.fillText(L.name || 'WPT', mX + 28, y1 + (j + 1) * lh - 5);
    }
  } else { g.fillStyle = '#8a9aa6'; g.fillText('NO FLIGHT PLAN', mX + 10, y1 + lh - 5); }
  paintKeys(kL);
}
function navField(x0, y0, fh, lab, val, i, W, metric) {
  const disM = FR.dis, ete = FR.ete;
  const g = S.g, ly = y0 + Math.round(fh * 0.34), vy = y0 + fh - Math.round(fh * 0.16);
  g.fillStyle = '#8a9aa6'; g.font = FONT_LAB[lab];
  g.fillText(NAV_LAB[i], x0 + 10, ly);
  g.fillStyle = '#ffffff'; g.font = FONT_VAL[val];
  if (i === 0) g.fillText(sInt(Math.round(metric ? S.gs * 3.6 : S.gs * 1.943844)), x0 + 10, vy);
  else if (i === 1) g.fillText(S.gs > 1 ? sDeg(Math.round(S.trk * 57.29578)) : '---', x0 + 10, vy);
  else if (i === 2) g.fillText(W.on ? sDeg(Math.round(W.dtk)) : '---', x0 + 10, vy);
  else if (i === 3) g.fillText(W.on ? sTenth(Math.round(metric ? disM / 100 : disM / 185.2)) : '--.-', x0 + 10, vy);
  else if (i === 4) {
    if (ete >= 0 && ete < 6000) { const mm = Math.floor(ete / 60), ss = Math.floor(ete - 60 * mm), c2 = Math.round(val * 0.6);
      g.fillText(sTwo(mm), x0 + 10, vy); g.fillText(':', x0 + 10 + 2 * c2, vy); g.fillText(sTwo(ss), x0 + 10 + 3 * c2, vy); }
    else g.fillText('--:--', x0 + 10, vy);
  } else {   // the bearing to the waypoint
    if (W.on && disM > 1) { const b = Math.atan2(W.bx - FR.x, -(W.bz - FR.z)) * 57.29578; g.fillText(sDeg(Math.round(b < 0 ? b + 360 : b)), x0 + 10, vy); }
    else g.fillText('---', x0 + 10, vy);
  }
  // the unit right after the value (its width from its characters, as the data bar's: no text measured, nothing made)
  const u = NAV_UNIT[metric ? 1 : 0][i];
  if (u) { g.fillStyle = '#8a9aa6'; g.font = FONT_LAB[lab]; g.fillText(u, x0 + 14 + Math.round(NAV_W[i] * val * 0.6), vy); }
}
const NAV_W = [3, 3, 3, 4, 5, 3];      // the values' widths in characters (GS 3, the degrees 3, DIS 4, ETE 5)
const NAV_LAB = ['GS', 'TRK', 'DTK', 'DIS', 'ETE', 'BRG'];
const NAV_UNIT = [['kt', '°', '°', 'nm', '', '°'], ['km/h', '°', '°', 'km', '', '°']];
// the softkeys' labels, over their keys: a strip of four cells along the bottom (keys under the screen), or a column
// of four on the left (a slim navigator's keys beside it). Returns the strip's size, px (0: no keys on this unit)
function keyStrip() { return S.keys ? (S.keysAt === 'left' ? Math.round(CW * 0.13) : Math.max(18, Math.round(S.H * 0.085))) : 0; }
const KEY_TXT = { rngDn: 'RNG -', rngUp: 'RNG +', orient: ['N UP', 'TRK UP'], page: ['NAV', 'MAP'] };
function keyText(i) {
  const k = KEYS[i];
  if (k === 'orient') return KEY_TXT.orient[S.trkUp ? 0 : 1];      // (what the key does: to the other mode)
  if (k === 'page') return KEY_TXT.page[S.page === 'map' ? 0 : 1];
  return KEY_TXT[k];
}
function paintKeys(kL) {
  const g = S.g; if (!g || !kL) return;
  const n = KEYS.length, left = S.keysAt === 'left';
  g.fillStyle = '#0a0c0f';
  if (left) g.fillRect(0, 0, kL, S.H); else g.fillRect(0, S.H - kL, CW, kL);
  g.font = FONT_LAB[Math.min(80, Math.round(left ? S.H / n * 0.30 : kL * 0.56))]; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < n; i++) {
    const x0 = left ? 0 : i * CW / n, y0 = left ? i * S.H / n : S.H - kL, w = left ? kL : CW / n, h = left ? S.H / n : kL;
    g.strokeStyle = '#2c3540'; g.lineWidth = 1; g.strokeRect(Math.round(x0) + 2.5, Math.round(y0) + 2.5, Math.round(w) - 5, Math.round(h) - 5);
    g.fillStyle = '#cfe6f5'; g.fillText(keyText(i), Math.round(x0 + w / 2), Math.round(y0 + h / 2) + 1);
  }
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
}
function field(x0, bar, lab, val, label, value, unit) {
  const g = S.g;
  g.fillStyle = '#8a9aa6'; g.font = FONT_LAB[lab];
  g.fillText(label, x0 + 8, Math.round(bar * 0.36));
  g.fillStyle = '#ffffff'; g.font = FONT_VAL[val];
  g.fillText(value, x0 + 8, bar - 5);
  if (unit) {
    g.fillStyle = '#8a9aa6'; g.font = FONT_LAB[lab];
    g.fillText(unit, Math.round(x0 + 12 + value.length * val * 0.6), bar - 5);
  }
}
function field2(x0, bar, lab, val, label, a, b) {      // mm:ss without a joined string
  const g = S.g, cw = Math.round(val * 0.6);
  g.fillStyle = '#8a9aa6'; g.font = FONT_LAB[lab];
  g.fillText(label, x0 + 8, Math.round(bar * 0.36));
  g.fillStyle = '#ffffff'; g.font = FONT_VAL[val];
  g.fillText(a, x0 + 8, bar - 5); g.fillText(':', x0 + 8 + 2 * cw, bar - 5); g.fillText(b, x0 + 8 + 3 * cw, bar - 5);
}
// the font sizes as strings, once (a repaint concatenates the cached pieces it needs; these never change)
// the fonts as whole strings, made once (a repaint assigns them, never builds them)
const FONT_LAB = [], FONT_VAL = [];
for (let i = 0; i <= 80; i++) { FONT_LAB[i] = '500 ' + i + 'px "IBM Plex Mono", monospace';
                                 FONT_VAL[i] = '600 ' + i + 'px "IBM Plex Mono", monospace'; }
const FONT_WPT = ['600 14px "IBM Plex Mono", monospace', '600 18px "IBM Plex Mono", monospace'];
const FONT_TRK = ['500 12px "IBM Plex Mono", monospace', '500 15px "IBM Plex Mono", monospace'];
// the map's frame for the repaint in hand (module state: no closure made per paint)
const FR = { cx: 0, cy: 0, x: 0, z: 0, k: 1, rot: 0.5, dis: 0.5, ete: 0.5 };   // (doubles from the start: fields kept unboxed)
// (whole pixels: an integer reaches the canvas untagged - see the strings above)
function PX(wx) { return Math.round(FR.cx + (wx - FR.x) * FR.k); }
function PY(wz) { return Math.round(FR.cy + (wz - FR.z) * FR.k); }

// THE WAYPOINT: the plan's active leg (ap.intent: legs[legI].A -> .B, its name), else the destination field direct
// from where the aeroplane is now. One record, reused.
const WP = { on: false, ax: 0, az: 0, bx: 0, bz: 0, dtk: 0, name: '' };
function waypoint() {
  const x = FR.x, z = FR.z;
  WP.on = false;
  const src = S.src;
  const IT = src && src.plan ? src.plan() : null;
  const legs = IT && IT.legs;
  if (legs && legs.length) {
    const L = legs[Math.max(0, Math.min(legs.length - 1, IT.legI | 0))];
    if (L && L.B) {
      WP.on = true;
      WP.bx = L.B[0]; WP.bz = L.B[1];
      if (L.A) { WP.ax = L.A[0]; WP.az = L.A[1]; } else { WP.ax = x; WP.az = z; }
      WP.name = L.name === 'FINAL' ? 'FINAL' : (L.name || 'WPT');
    }
  }
  if (!WP.on) {
    const D = src && src.dest ? src.dest() : null;
    const ex = D ? D.x - x : 0, ez = D ? D.z - z : 0;
    if (D && isFinite(D.x) && isFinite(D.z) && ex * ex + ez * ez > 40000) {
      WP.on = true; WP.ax = x; WP.az = z; WP.bx = D.x; WP.bz = D.z; WP.name = D.name || D.id || 'DEST';
    }
  }
  // the desired track: the leg's own bearing, clockwise from north (north is -z, east +x)
  if (WP.on) { const d = Math.atan2(WP.bx - WP.ax, -(WP.bz - WP.az)) * 57.29578; WP.dtk = d < 0 ? d + 360 : d; }
  return WP;
}

// ---- THE FLIGHT -------------------------------------------------------------------------------------------------------
function bind(o) {
  o = o || {};
  S.kind = o.kind || 'portable'; S.units = o.units === 'metric' ? 'metric' : 'aviation';
  S.src = o.src || null;
  S.bound = false;                               // (sized below as the flight's unit, then held)
  const AV = typeof GEN_AVIONICS !== 'undefined' ? GEN_AVIONICS : null;
  const face = AV && AV.gps[S.kind] && AV.gps[S.kind].face;
  if (face && face.sw > 0 && face.sh > 0) material(face.sw / face.sh); else material();
  S.bound = true;
  // G2812: the softkeys this unit has, and where their labels go; a new flight powers up on 4 nm, north up, the map
  S.keysAt = face && face.keys === 'left' ? 'left' : 'below'; S.keys = face && face.keys ? KEYS.length : 0;
  S.rngI = RNG0; S.trkUp = false; S.page = 'map';
  S.trHead = 0; S.trN = 0; S.have = false; S.acc = 0; S.trackAcc = 0; S.gs = 0; S.trk = 0; S.pT = 0;
  S.on = false; S.dark = false; S.boot = 0;
  paintDark(); S.dark = true;
  if (S.mat) S.mat.emissiveIntensity = 0;
}
// every frame: numbers only. CK: the cockpit (gpsOn, cg, nightK)
function tick(dt, CK) {
  if (!S.mat || !CK || !CK.cg) return false;
  const on = !!CK.gpsOn;
  const x = CK.cg[0], z = CK.cg[2];
  // the track keeps being recorded while the unit is on (a GPS logs what it saw)
  if (on) {
    S.trackAcc += dt;
    if (!S.have) { S.lastX = x; S.lastZ = z; S.have = true; S.px = x; S.pz = z; S.pT = 0; }
    if (S.trackAcc >= TRACK_DT) {
      S.trackAcc = 0;
      const dx = x - S.lastX, dz = z - S.lastZ;
      if (dx * dx + dz * dz > 25 || S.trN === 0) {
        S.tr[2 * S.trHead] = x; S.tr[2 * S.trHead + 1] = z;
        S.trHead = (S.trHead + 1) % TRACK_N; if (S.trN < TRACK_N) S.trN++;
        S.lastX = x; S.lastZ = z;
      }
    }
  }
  if (!on) {
    if (!S.dark) { paintDark(); S.dark = true; S.mat.emissiveIntensity = 0; }
    S.on = false; S.boot = 0; S.acc = 0;
    return false;
  }
  if (!S.on) { S.on = true; S.boot = 0; S.dark = false; S.acc = 1 / HZ; paintBoot(); }
  S.boot += dt;
  // the screen's own glow: the cockpit's night dimmer for what is read up close (CK.nightK, the faces' law)
  const glow = CK.nightK ? CK.nightK(0.92) : 1;
  S.mat.emissiveIntensity = 0.9 * glow;
  S.acc += dt; S.pT += dt;
  // (a tolerance: fifteen 1/60 s steps can sum to a hair under 1/4 s, and the cadence would slip to 3.75 Hz; the
  // remainder carries, so the repaints keep 4 Hz at any frame rate, and a long stall does not owe a burst)
  if (S.acc + 1e-6 < 1 / HZ) return false;
  S.acc = S.acc > 2 / HZ ? 0 : Math.max(0, S.acc - 1 / HZ);
  if (S.boot < BOOT_S) return false;
  // ground speed and track over the paint interval, smoothed
  if (S.pT > 0) {
    const dx = x - S.px, dz = z - S.pz, v = Math.sqrt(dx * dx + dz * dz) / S.pT;
    S.gs += (v - S.gs) * 0.5;
    if (v > 1) S.trk = Math.atan2(dx, -dz);
  }
  S.px = x; S.pz = z; S.pT = 0;
  FR.x = x; FR.z = z;
  paintPage();
  S.paints++;
  upload();
  return true;
}
function paintPage() { if (S.page === 'nav') paintNav(); else paintMap(); }
// G2812: A SOFTKEY PRESSED (cockpit.js, the `gpskey` law; the switching functions only): the range a step down or up,
// north-up / track-up, the page. Only a unit that is on and past its boot answers; the glass repaints at once (the
// next 4 Hz repaint would leave a press unanswered for up to a quarter second). Returns true when it took the press
function key(k) {
  if (!S.on || S.boot < BOOT_S || !S.g) return false;
  const n = (RANGES[S.units] || RANGES.aviation).length;
  if (k === 'rngDn') S.rngI = Math.max(0, S.rngI - 1);
  else if (k === 'rngUp') S.rngI = Math.min(n - 1, S.rngI + 1);
  else if (k === 'orient') S.trkUp = !S.trkUp;
  else if (k === 'page') S.page = S.page === 'map' ? 'nav' : 'map';
  else return false;
  FR.x = S.px; FR.z = S.pz;
  paintPage(); upload();
  return true;
}
const API = {
  HZ, TRACK_N, TRACK_DT, RANGE, BOOT_S,
  KEYS, RANGES,
  material, bind, tick, key, state: () => S,
  // the shed: the unit off, its standby page, released by the flight (app.js enterGarage)
  standby: () => { S.bound = false; S.on = false; S.dark = false; S.boot = 0; if (S.mat) S.mat.emissiveIntensity = 0; paintStandby(); },
  // GATE GPSFACE: a canvas factory for node, and the page painters by name
  setCanvas: f => { canvasMaker = f; },
  waypoint: (x, z) => { FR.x = x; FR.z = z; return waypoint(); },
  paintMap: (x, z) => { FR.x = x; FR.z = z; paintMap(); },
  paintNav: (x, z) => { FR.x = x; FR.z = z; paintNav(); },
};
if (W0) W0.FLYDIY_GPS = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
