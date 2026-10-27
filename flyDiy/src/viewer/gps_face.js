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
//   touch(u, v)    G2813: a tap on the glass at its uv (cockpit.js: the screen's hit) - a key's label, the map's zoom,
//                  the PFD's bars; returns true when the tap did something
// G2813: the GLASS unit (a G3X Touch class display with its ADAHRS) powers up on its PFD - see THE PFD below.
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
  // G2813: the glass unit's PFD - its page, the synthetic vision and its terrain colours (switches), the V speeds
  pfd: false, svt: true, terr: true, vsp: null,
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
const NAME = { portable: 'PORTABLE GPS', panel: 'GPS NAVIGATOR', glass: 'PFD · MFD' };
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
  // G2813: the zoom, to the finger (the units are touch screens): + and - under north's arrow
  zoomBtns(mTop);
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
// G2813: on the PFD the same four keys switch its own things: the synthetic vision, its terrain colours, (none), the page
const KEY_PFD = ['SVT', 'TERR', '', 'MAP'];
const PAGE_NEXT = { pfd: 'MAP', map: 'NAV', nav: 'PFD' };
function keyText(i) {
  const k = KEYS[i];
  if (S.page === 'pfd') return KEY_PFD[i];
  if (k === 'orient') return KEY_TXT.orient[S.trkUp ? 0 : 1];      // (what the key does: to the other mode)
  if (k === 'page') return S.pfd ? PAGE_NEXT[S.page] : KEY_TXT.page[S.page === 'map' ? 0 : 1];
  return KEY_TXT[k];
}
// a key whose switch is on (its label lit, as a Garmin softkey's)
function keyLit(i) { return S.page === 'pfd' && ((i === 0 && S.svt) || (i === 1 && S.terr && S.svt)); }
function paintKeys(kL) {
  const g = S.g; if (!g || !kL) return;
  const n = KEYS.length, left = S.keysAt === 'left';
  g.fillStyle = '#0a0c0f';
  if (left) g.fillRect(0, 0, kL, S.H); else g.fillRect(0, S.H - kL, CW, kL);
  g.font = FONT_LAB[Math.min(80, Math.round(left ? S.H / n * 0.30 : kL * 0.56))]; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < n; i++) {
    const x0 = left ? 0 : i * CW / n, y0 = left ? i * S.H / n : S.H - kL, w = left ? kL : CW / n, h = left ? S.H / n : kL;
    if (keyLit(i)) { g.fillStyle = '#1d4f6e'; g.fillRect(Math.round(x0) + 3, Math.round(y0) + 3, Math.round(w) - 6, Math.round(h) - 6); }
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

// ---- G2813: THE PFD ----------------------------------------------------------------------------------------------------
// The user, 27 Oct: "an easy version of a PFD, the typical Garmin glass cockpit with the attitude, possibly even a virtual
// ground, and everything? Taking inspiration from the actual small devices and their current software? Touch enabled if
// possible". The glass unit (GEN_AVIONICS.gps.glass: a G3X Touch class display WITH its ADAHRS) powers up on it:
//  - the synthetic vision: the island's ground in perspective (a fan of rings and columns ahead, its heights read off a
//    coarse grid baked once a flight from the page's ground, shaded by a sun in the north-west and hazed with distance;
//    the sea blue; the strips drawn on it; the ground near or above the aeroplane yellow and red in flight), the
//    heading marks along the horizon and the flight path marker; without it, the blue over brown of a plain attitude;
//  - the pitch ladder, the roll scale with its pointer and the slip / skid wedge, the aircraft symbol;
//  - the airspeed tape with its bands (white flaps, green, yellow, red: the build's own speeds), its trend over 6 s and
//    the ground speed; the altitude tape with its trend, the vertical speed beside it, the baro box;
//  - a heading arc with the desired track, the ground track and the deviation off the active leg; the waypoint bar.
// Repainted at PFD_HZ (an attitude at 4 Hz is not an attitude) and allocation-free like the pages above. The ground is
// never read per frame: terrainH can bake a raster tile on a far read (G1436), so the grid is baked a few hundred samples
// a frame after the bind (src.ground) and the fan reads the grid.
const PFD_HZ = 20;
const PK = 6, PKR = PK * 57.29578;               // px a degree (pitch and azimuth alike: conformal), px a radian
const PFD_TOP = 20;                              // the waypoint bar's height, px
// the fan: SV_NA columns over +-SV_AZ of the nose, SV_NR rings from SV_D0 out, each SV_DK further (120 m to 11 km)
const SV_NA = 33, SV_NR = 22, SV_AZ = 54 / 57.29578, SV_D0 = 120, SV_DK = 1.24;
const SV_A = new Float32Array(SV_NA), SV_D = new Float32Array(SV_NR);
for (let a = 0; a < SV_NA; a++) SV_A[a] = -SV_AZ + 2 * SV_AZ * a / (SV_NA - 1);
for (let r = 0; r < SV_NR; r++) SV_D[r] = SV_D0 * Math.pow(SV_DK, r);
// the grid: HF_N x HF_N over the map's box (24 km: 150 m cells), HF_STEP samples a frame
const HF_N = 160, HF_STEP = 320;
const SVG = { hf: new Float32Array(HF_N * HF_N), i: 0, ready: false, x0: 0.5, z0: 0.5, cell: 1.5,
  sy: new Int16Array(SV_NA * SV_NR), h: new Float32Array(SV_NA * SV_NR),
  sx: new Int16Array(SV_NA), sb: new Float32Array(SV_NA), cb: new Float32Array(SV_NA) };
for (let a = 0; a < SV_NA; a++) SVG.sx[a] = Math.round(SV_A[a] * PKR);
// the ground's colours, made once: an elevation band (green low, tan, rock, snow) x a light level x a haze level
const SV_BANDS = [[46, 92, 40], [62, 104, 44], [90, 112, 52], [122, 116, 62], [132, 106, 72], [122, 104, 92], [150, 144, 138], [216, 216, 220]];
const SV_BAND_H = [15, 80, 180, 320, 520, 800, 1200];          // the bands' tops, m
const SV_L = 8, SV_Z = 4, SV_HAZE = [168, 190, 210], SV_HZK = [0, 0.22, 0.42, 0.62];
const rgbS = (c, f, z) => 'rgb(' + Math.round(Math.min(255, c[0] * f) * (1 - z) + SV_HAZE[0] * z) + ',' +
  Math.round(Math.min(255, c[1] * f) * (1 - z) + SV_HAZE[1] * z) + ',' + Math.round(Math.min(255, c[2] * f) * (1 - z) + SV_HAZE[2] * z) + ')';
const SV_PAL = [], SV_SEA = [], SV_RED = [], SV_YEL = [];
for (let b = 0; b < SV_BANDS.length; b++) for (let l = 0; l < SV_L; l++) for (let z = 0; z < SV_Z; z++)
  SV_PAL[(b * SV_L + l) * SV_Z + z] = rgbS(SV_BANDS[b], 0.55 + 0.75 * l / (SV_L - 1), SV_HZK[z]);
for (let z = 0; z < SV_Z; z++) SV_SEA[z] = rgbS([30, 78, 128], 1, SV_HZK[z] * 0.8);
for (let l = 0; l < SV_L; l++) { SV_RED[l] = rgbS([170, 30, 26], 0.7 + 0.5 * l / (SV_L - 1), 0); SV_YEL[l] = rgbS([170, 150, 30], 0.7 + 0.5 * l / (SV_L - 1), 0); }
// the roll scale's marks (deg) and the compass's labels
const ROLL_T = [10, 20, 30, 45, 60], ROLL_S = new Float32Array(10), ROLL_C = new Float32Array(10);
for (let i = 0; i < 5; i++) { const a = ROLL_T[i] / 57.29578; ROLL_S[2 * i] = Math.sin(a); ROLL_S[2 * i + 1] = -Math.sin(a); ROLL_C[2 * i] = ROLL_C[2 * i + 1] = Math.cos(a); }
const HSI_TXT = ['N', '3', '6', 'E', '12', '15', 'S', '21', '24', 'W', '30', '33'];
const BARO_TXT = { aviation: '29.92IN', metric: '1013HPA' };
const UNIT_SPD = { aviation: 'KT', metric: 'KM/H' }, UNIT_ALT = { aviation: 'FT', metric: 'M' };
const F_PFD_S = '500 11px "IBM Plex Mono", monospace', F_PFD_M = '600 13px "IBM Plex Mono", monospace';
const F_PFD_L = '600 19px "IBM Plex Mono", monospace', F_PFD_B = '600 15px "IBM Plex Mono", monospace';
const C_MAG = '#ff4fd8', C_CY = '#30d8ff', C_TAPE = 'rgba(16,22,30,0.62)', C_BOX = '#000000', C_GRN = '#38e05a';
// what the PFD reads, once a paint (module state: doubles from the start, kept unboxed)
const PF = { x: 0.5, z: 0.5, alt: 0.5, hLoc: 0.5, ias: 0.5, iasP: 0.5, acc: 0.5, vs: 0.5, roll: 0.5, pitch: 0.5, hdg: 0.5,
  beta: 0.5, gam: 0.5, drift: 0.5, rr: 0.5, dt: 0.5, have: false };
// the gradients (made with the canvas; a gradient is the context's, so a new canvas makes its own)
const GR = { g: null, sky: null, skyS: null, gnd: null };
function grads(g) {
  if (GR.g === g || !g.createLinearGradient) return;
  GR.g = g;
  GR.sky = g.createLinearGradient(0, -600, 0, 0); GR.sky.addColorStop(0, '#0b3f99'); GR.sky.addColorStop(1, '#3c86e0');
  GR.skyS = g.createLinearGradient(0, -400, 0, 0); GR.skyS.addColorStop(0, '#1d55b0'); GR.skyS.addColorStop(0.75, '#6aa4e2'); GR.skyS.addColorStop(1, '#b9d6f0');
  GR.gnd = g.createLinearGradient(0, 0, 0, 500); GR.gnd.addColorStop(0, '#8a5a24'); GR.gnd.addColorStop(1, '#4a2c0c');
}
// THE GRID, baked a slice a frame: src.ground(x, z) on HF_N x HF_N points over the map's box
function svBake() {
  const src = S.src;
  if (SVG.ready || !src || !src.ground || !src.box) return;
  const box = src.box(); if (!box || !(box.size > 0)) return;
  if (SVG.i === 0) { SVG.x0 = box.x0; SVG.z0 = box.z0; SVG.cell = box.size / (HF_N - 1); }
  const n = HF_N * HF_N, e = Math.min(n, SVG.i + HF_STEP);
  for (let i = SVG.i; i < e; i++) {
    const h = +src.ground(SVG.x0 + (i % HF_N) * SVG.cell, SVG.z0 + ((i / HF_N) | 0) * SVG.cell);
    SVG.hf[i] = h === h ? h : -10;
  }
  SVG.i = e;
  if (e >= n) SVG.ready = true;
}
// the grid's height under a world point (bilinear; outside the box, the sea floor). Module state in, module state out
const HQ = { x: 0.5, z: 0.5, h: 0.5 };
function hfAt() {
  const fx = (HQ.x - SVG.x0) / SVG.cell, fz = (HQ.z - SVG.z0) / SVG.cell;
  if (!(fx >= 0 && fz >= 0 && fx < HF_N - 1 && fz < HF_N - 1)) { HQ.h = -10; return; }
  const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, k = iz * HF_N + ix, hf = SVG.hf;
  HQ.h = (hf[k] * (1 - tx) + hf[k + 1] * tx) * (1 - tz) + (hf[k + HF_N] * (1 - tx) + hf[k + HF_N + 1] * tx) * tz;
}
// the PFD's numbers off the cockpit (sim.out: the ADAHRS; cg: the position), once a paint
function pfdRead(CK) {
  const o = CK.sim && CK.sim.out, dtP = PF.dt;
  PF.x = CK.cg[0]; PF.z = CK.cg[2]; PF.alt = CK.cg[1];
  if (o) {
    const ias = o.Veas != null ? +o.Veas : +(o.V || 0);
    if (PF.have && dtP > 0) PF.acc += ((ias - PF.iasP) / dtP - PF.acc) * Math.min(1, dtP / 0.6);
    PF.iasP = ias; PF.ias = ias;
    PF.vs = +(o.vs || 0); PF.roll = +(o.roll || 0); PF.pitch = +(o.pitch || 0); PF.beta = +(o.beta || 0);
    // the heading clockwise from north (north -z, east +x: the map's and the strips' numbers - 38_nav.js navDeg is
    // 0 = +x, so the compass is its angle + 90)
    let h = +(o.hdg || 0) * 57.29578 + 90; h = h % 360; if (h < 0) h += 360;
    PF.hdg = h;
    PF.have = true;
  }
  PF.rr = -PF.roll;
  // the flight path: the climb angle off the ground speed, the drift off the ground track
  PF.gam = S.gs > 3 ? Math.atan2(PF.vs, S.gs) : 0;
  let d = S.trk * 57.29578 - PF.hdg; while (d > 180) d -= 360; while (d < -180) d += 360;
  PF.drift = S.gs > 3 ? d : 0;
  if (SVG.ready) { HQ.x = PF.x; HQ.z = PF.z; hfAt(); PF.hLoc = HQ.h > 0 ? HQ.h : 0; } else PF.hLoc = 0;
}
function paintPfd() {
  const g = S.g; if (!g) return;
  grads(g);
  const kL = keyStrip(), X0 = S.keysAt === 'left' ? kL : 0, PW = CW - X0, PH = S.H - (S.keysAt === 'left' ? 0 : kL);
  const cx = Math.round(X0 + PW / 2), cy = Math.round(PFD_TOP + (PH - PFD_TOP) * 0.40);
  const pp = Math.round(PF.pitch * PKR);
  const svt = S.svt && SVG.ready;
  // THE ATTITUDE: the sky and the ground (or the synthetic vision), turned with the roll, moved with the pitch
  g.save();
  g.beginPath(); g.rect(X0, PFD_TOP, PW, PH - PFD_TOP); g.clip();
  g.translate(cx, cy); g.rotate(PF.rr); g.translate(0, pp);
  g.fillStyle = svt ? GR.skyS || '#3c86e0' : GR.sky || '#2a6fd6'; g.fillRect(-700, -1200, 1400, 1200);
  if (svt) paintSvt(g); else { g.fillStyle = GR.gnd || '#7a4a1c'; g.fillRect(-700, 0, 1400, 1200); }
  g.fillStyle = '#ffffff'; g.fillRect(-700, -1, 1400, 2);
  if (svt) {
    // the heading marks along the horizon, every 10 deg, the 30s numbered
    g.font = F_PFD_S; g.textAlign = 'center'; g.textBaseline = 'bottom';
    const m0 = Math.ceil((PF.hdg - 50) / 10) * 10;
    for (let m = m0; m <= PF.hdg + 50; m += 10) {
      const xm = Math.round((m - PF.hdg) * PK);
      g.fillRect(xm, -7, 1, 7);
      if (((m % 30) + 30) % 30 === 0) g.fillText(sDeg(Math.round(m)), xm, -9);
    }
    // the flight path marker (where the aeroplane is going: the climb angle up, the drift across)
    if (S.gs > 15) {
      const fx = Math.round(PF.drift * PK), fy = Math.round(-PF.gam * PKR);
      g.strokeStyle = C_GRN; g.lineWidth = 2;
      g.beginPath(); g.arc(fx, fy, 6, 0, 6.283); g.stroke();
      g.beginPath(); g.moveTo(fx - 16, fy); g.lineTo(fx - 6, fy); g.moveTo(fx + 6, fy); g.lineTo(fx + 16, fy); g.moveTo(fx, fy - 6); g.lineTo(fx, fy - 12); g.stroke();
    }
  }
  g.restore();
  // THE PITCH LADDER: every 2.5 deg, the tens numbered, inside the attitude's middle
  g.save();
  g.beginPath(); g.rect(cx - 90, PFD_TOP + 30, 180, PH - PFD_TOP - 96); g.clip();
  g.translate(cx, cy); g.rotate(PF.rr); g.translate(0, pp);
  g.fillStyle = '#ffffff'; g.font = F_PFD_S; g.textBaseline = 'middle';
  const pd = PF.pitch * 57.29578, q0 = Math.ceil((pd - 22) / 2.5), q1 = Math.floor((pd + 22) / 2.5);
  for (let q = q0; q <= q1; q++) {
    if (q === 0) continue;
    const y = Math.round(-q * 2.5 * PK), w = q % 4 === 0 ? 34 : q % 2 === 0 ? 17 : 8;
    g.fillRect(-w, y, 2 * w, 1);
    if (q % 4 === 0) { const t = sInt(Math.abs(q) * 2.5 | 0); g.textAlign = 'right'; g.fillText(t, -w - 4, y); g.textAlign = 'left'; g.fillText(t, w + 4, y); }
  }
  g.restore();
  // THE ROLL SCALE: the marks turn with the horizon (the sky pointer), the pointer and the slip wedge stay put
  const RR = cy - PFD_TOP - 14;
  g.save();
  g.translate(cx, cy); g.rotate(PF.rr);
  g.strokeStyle = '#ffffff'; g.lineWidth = 2;
  g.beginPath(); g.arc(0, 0, RR, -2.618, -0.524); g.stroke();
  for (let i = 0; i < 10; i++) {
    const L = (i >> 1) === 2 || (i >> 1) === 4 ? 11 : 7, sn = ROLL_S[i], cs = ROLL_C[i];
    g.beginPath(); g.moveTo(Math.round(sn * RR), Math.round(-cs * RR)); g.lineTo(Math.round(sn * (RR + L)), Math.round(-cs * (RR + L))); g.stroke();
  }
  g.fillStyle = '#ffffff';
  g.beginPath(); g.moveTo(0, -RR - 1); g.lineTo(-7, -RR - 11); g.lineTo(7, -RR - 11); g.closePath(); g.fill();
  g.restore();
  const sl = Math.max(-16, Math.min(16, Math.round(-PF.beta * 57.29578 * 2)));
  g.fillStyle = '#ffffff'; g.strokeStyle = '#000000'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(cx, cy - RR + 1); g.lineTo(cx - 8, cy - RR + 12); g.lineTo(cx + 8, cy - RR + 12); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(cx + sl - 9, cy - RR + 14); g.lineTo(cx + sl + 9, cy - RR + 14); g.lineTo(cx + sl + 11, cy - RR + 18); g.lineTo(cx + sl - 11, cy - RR + 18); g.closePath(); g.fill(); g.stroke();
  // THE AIRCRAFT SYMBOL: yellow wings with their tabs, the dot between
  g.fillStyle = '#ffd400'; g.strokeStyle = '#000000'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(cx - 78, cy - 3); g.lineTo(cx - 30, cy - 3); g.lineTo(cx - 30, cy + 9); g.lineTo(cx - 36, cy + 9); g.lineTo(cx - 36, cy + 3); g.lineTo(cx - 78, cy + 3); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(cx + 78, cy - 3); g.lineTo(cx + 30, cy - 3); g.lineTo(cx + 30, cy + 9); g.lineTo(cx + 36, cy + 9); g.lineTo(cx + 36, cy + 3); g.lineTo(cx + 78, cy + 3); g.closePath(); g.fill(); g.stroke();
  g.fillRect(cx - 4, cy - 4, 8, 8); g.strokeRect(cx - 4, cy - 4, 8, 8);
  paintSpeedTape(g, X0 + 6, cy, PH);
  paintAltTape(g, X0 + PW - 110, cy, PH);
  paintHsi(g, cx, PH);
  paintPfdBar(g, X0, PW);
  if (S.svt && !SVG.ready) { g.fillStyle = C_CY; g.font = F_PFD_S; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText('SVT LOADING', cx, PFD_TOP + 44); }
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  paintKeys(kL);
}
// the synthetic vision, in the horizon's frame (y down from the horizon line, x across from the nose; px)
function paintSvt(g) {
  const alt = PF.alt, hd = PF.hdg / 57.29578, H = SVG.h, SY = SVG.sy, SX = SVG.sx, SB = SVG.sb, CB = SVG.cb;
  for (let a = 0; a < SV_NA; a++) { const b = hd + SV_A[a]; SB[a] = Math.sin(b); CB[a] = Math.cos(b); }
  for (let r = 0; r < SV_NR; r++) {
    const D = SV_D[r];
    for (let a = 0; a < SV_NA; a++) {
      const i = r * SV_NA + a;
      HQ.x = PF.x + SB[a] * D; HQ.z = PF.z - CB[a] * D; hfAt();
      const h = HQ.h; H[i] = h;
      let y = -Math.atan2((h > 0 ? h : 0) - alt, D) * PKR;
      SY[i] = y > 3000 ? 3000 : y < -3000 ? -3000 : Math.round(y);
    }
  }
  // past the fan to the horizon: the haze; then the fan far to near, each quad shaded by its slope against the sun
  g.fillStyle = SV_PAL[(1 * SV_L + 4) * SV_Z + 3]; g.fillRect(-700, 0, 1400, 1200);
  const alerts = S.terr && S.gs > 15 && alt - PF.hLoc > 60, dA = SV_A[1] - SV_A[0];
  g.lineWidth = 1; g.lineJoin = 'round';
  for (let r = SV_NR - 2; r >= 0; r--) {
    const zi = r < 8 ? 0 : r < 13 ? 1 : r < 17 ? 2 : 3, dR = SV_D[r + 1] - SV_D[r], dL = (SV_D[r] + SV_D[r + 1]) * 0.5 * dA;
    for (let a = 0; a < SV_NA - 1; a++) {
      const i0 = r * SV_NA + a, i1 = i0 + 1, i2 = i0 + SV_NA + 1, i3 = i0 + SV_NA;
      const h0 = H[i0], h1 = H[i1], h2 = H[i2], h3 = H[i3];
      let col;
      if (h0 < 0.5 && h1 < 0.5 && h2 < 0.5 && h3 < 0.5) col = SV_SEA[zi];
      else {
        const sr = ((h3 + h2) - (h0 + h1)) * 0.5 / dR, sa = ((h1 + h2) - (h0 + h3)) * 0.5 / dL;
        const ge = sr * SB[a] + sa * CB[a], gn = sr * CB[a] - sa * SB[a];
        const lt = (0.5 * ge - 0.5 * gn + 0.707) / Math.sqrt(ge * ge + gn * gn + 1);
        let li = Math.round((lt - 0.25) / 0.7 * (SV_L - 1)); li = li < 0 ? 0 : li > SV_L - 1 ? SV_L - 1 : li;
        let hx = h0; if (h1 > hx) hx = h1; if (h2 > hx) hx = h2; if (h3 > hx) hx = h3;
        if (alerts && hx > alt - 30) col = SV_RED[li];
        else if (alerts && hx > alt - 150) col = SV_YEL[li];
        else {
          const hm = (h0 + h1 + h2 + h3) * 0.25;
          let b = 0; while (b < SV_BAND_H.length && hm > SV_BAND_H[b]) b++;
          col = SV_PAL[(b * SV_L + li) * SV_Z + zi];
        }
      }
      g.fillStyle = col; g.strokeStyle = col;
      g.beginPath(); g.moveTo(SX[a], SY[i0]); g.lineTo(SX[a + 1], SY[i1]); g.lineTo(SX[a + 1], SY[i2]); g.lineTo(SX[a], SY[i3]); g.closePath();
      g.fill(); g.stroke();
    }
  }
  // under the nearest ring: the ground the aeroplane is over
  {
    let b = 0; while (b < SV_BAND_H.length && PF.hLoc > SV_BAND_H[b]) b++;
    g.fillStyle = PF.hLoc < 0.5 ? SV_SEA[0] : SV_PAL[(b * SV_L + 4) * SV_Z]; g.beginPath(); g.moveTo(SX[0], SY[0]);
    for (let a = 1; a < SV_NA; a++) g.lineTo(SX[a], SY[a]);
    g.lineTo(SX[SV_NA - 1], 1500); g.lineTo(SX[0], 1500); g.closePath(); g.fill();
  }
  // the strips: each one in reach, its four corners on the ground at its elevation
  const F = S.src && S.src.fields ? S.src.fields() : null;
  if (F) for (let i = 0; i < F.length; i++) {
    const A = F[i];
    if (!A || A.kind === 'water' || A.kind === 'meadow' || !(A.len > 0) || !(A.wid > 0)) continue;
    const ex = A.x - PF.x, ez = A.z - PF.z;
    if (ex * ex + ez * ez > 1.6e8) continue;
    const ux = Math.cos(+A.hdg || 0), uz = Math.sin(+A.hdg || 0), hl = A.len * 0.5, hw = Math.max(A.wid, 18) * 0.5, el = +A.elev || 0;
    // its ends, cut 30 m ahead of the aeroplane where they run behind it (lined up on it, the strip runs away ahead)
    const fx = Math.sin(hd), fz = -Math.cos(hd);
    let l0 = -hl, l1 = hl;
    const s0 = (ex - ux * hl) * fx + (ez - uz * hl) * fz, s1 = (ex + ux * hl) * fx + (ez + uz * hl) * fz;
    if (s0 < 30 && s1 < 30) continue;
    if (s0 < 30) l0 = -hl + 2 * hl * (30 - s0) / (s1 - s0);
    else if (s1 < 30) l1 = hl - 2 * hl * (30 - s1) / (s0 - s1);
    let ok = true;
    for (let c = 0; c < 4 && ok; c++) {
      const sl = c === 0 || c === 3 ? l0 : l1, sw = c < 2 ? -hw : hw;
      RW.x = A.x + ux * sl - uz * sw; RW.z = A.z + uz * sl + ux * sw; RW.h = el;
      ok = rwProj(c);
    }
    if (!ok) continue;
    g.fillStyle = '#c9ccd0'; g.strokeStyle = '#ffffff';
    g.beginPath(); g.moveTo(RW.px[0], RW.py[0]); g.lineTo(RW.px[1], RW.py[1]); g.lineTo(RW.px[2], RW.py[2]); g.lineTo(RW.px[3], RW.py[3]); g.closePath();
    g.fill(); g.stroke();
  }
}
// a strip's corner (RW.x, RW.z, RW.h) to the horizon frame; false when it is not in front
const RW = { x: 0.5, z: 0.5, h: 0.5, px: new Int16Array(4), py: new Int16Array(4) };
function rwProj(c) {
  const dx = RW.x - PF.x, dz = RW.z - PF.z, d = Math.sqrt(dx * dx + dz * dz);
  if (d < 1) return false;
  let az = Math.atan2(dx, -dz) * 57.29578 - PF.hdg; while (az > 180) az -= 360; while (az < -180) az += 360;
  if (az > 75 || az < -75) return false;
  RW.px[c] = Math.round(az * PK);
  const y = -Math.atan2(RW.h - PF.alt, d) * PKR;
  RW.py[c] = y > 3000 ? 3000 : y < -3000 ? -3000 : Math.round(y);
  return true;
}
// THE AIRSPEED TAPE: the build's bands, the pointer box, the trend over 6 s, the ground speed under it
function paintSpeedTape(g, x0, cy, PH) {
  const metric = S.units === 'metric', k = metric ? 3.6 : 1.943844, ppu = metric ? 1.5 : 3;
  const half = Math.min(cy - PFD_TOP - 14, PH - 64 - cy), w = 62, top = cy - half, bot = cy + half;
  const v = PF.ias * k, live = PF.ias > 10;
  g.fillStyle = C_TAPE; g.fillRect(x0, top, w, bot - top);
  g.save(); g.beginPath(); g.rect(x0, top, w + 4, bot - top); g.clip();
  // the bands, along the tape's right edge
  const V = S.vsp;
  if (V) {
    if (live) band(g, x0 + w - 6, cy, v, ppu, 0, V.Vs0 ? V.Vs0 * k : 0, '#e8332a', 6);   // (the low band in the air)
    if (V.Vs0 && V.Vfe) band(g, x0 + w - 6, cy, v, ppu, V.Vs0 * k, V.Vfe * k, '#f2f2f0', 3);
    if (V.Vs1 && V.Vh) band(g, x0 + w - 3, cy, v, ppu, V.Vs1 * k, V.Vh * k, '#3dbb5e', 3);
    if (V.Vh && V.Vne) band(g, x0 + w - 6, cy, v, ppu, V.Vh * k, V.Vne * k, '#f0c23a', 6);
    if (V.Vne) band(g, x0 + w - 6, cy, v, ppu, V.Vne * k, V.Vne * k + 400, '#e8332a', 6);
  }
  // the ticks, every 5 (10 km/h), the tens (20s) numbered
  const st = metric ? 10 : 5, lab = metric ? 20 : 10;
  g.fillStyle = '#ffffff'; g.font = F_PFD_M; g.textAlign = 'right'; g.textBaseline = 'middle';
  for (let s = Math.max(0, Math.floor((v - half / ppu) / st) * st); s <= v + half / ppu; s += st) {
    const y = Math.round(cy + (v - s) * ppu);
    g.fillRect(x0 + w - 16, y, s % lab === 0 ? 10 : 6, 1);
    if (s % lab === 0 && s > 0) g.fillText(sInt(s), x0 + w - 19, y);
  }
  g.restore();
  // the trend: where the speed will be in 6 s, magenta from the pointer
  if (live) {
    const tr = Math.max(-half, Math.min(half, Math.round(PF.acc * 6 * k * ppu)));
    if (tr > 2 || tr < -2) { g.fillStyle = C_MAG; g.fillRect(x0 + w - 2, tr > 0 ? cy - tr : cy, 3, tr > 0 ? tr : -tr); }
  }
  // the pointer box
  g.fillStyle = C_BOX; g.strokeStyle = '#ffffff'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(x0 + 2, cy - 14); g.lineTo(x0 + w - 8, cy - 14); g.lineTo(x0 + w - 8, cy - 6); g.lineTo(x0 + w, cy); g.lineTo(x0 + w - 8, cy + 6); g.lineTo(x0 + w - 8, cy + 14); g.lineTo(x0 + 2, cy + 14); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#ffffff'; g.font = F_PFD_L; g.textAlign = 'right';
  g.fillText(live ? sInt(Math.round(v)) : '---', x0 + w - 11, cy + 1);
  // the unit over it, the ground speed under it
  g.font = F_PFD_S; g.fillStyle = '#9fb0bc'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillText(UNIT_SPD[S.units] || 'KT', x0 + 4, top - 3);
  g.fillStyle = C_BOX; g.fillRect(x0, bot + 2, w, 16);
  g.fillStyle = '#9fb0bc'; g.fillText('GS', x0 + 4, bot + 14);
  g.fillStyle = '#ffffff'; g.font = F_PFD_M; g.fillText(sInt(Math.round(S.gs * k)), x0 + 24, bot + 15);
}
function band(g, x, cy, v, ppu, lo, hi, col, bw) {
  const yA = Math.round(cy + (v - hi) * ppu), yB = Math.round(cy + (v - lo) * ppu);
  if (yB <= yA) return;
  g.fillStyle = col; g.fillRect(x, yA, bw, yB - yA);
}
// THE ALTITUDE TAPE and the vertical speed beside it; the baro box under it
function paintAltTape(g, x0, cy, PH) {
  const metric = S.units === 'metric', k = metric ? 1 : 3.28084, ppu = metric ? 1.2 : 0.35;
  const half = Math.min(cy - PFD_TOP - 14, PH - 64 - cy), w = 64, top = cy - half, bot = cy + half;
  const a = PF.alt * k;
  g.fillStyle = C_TAPE; g.fillRect(x0, top, w, bot - top);
  g.save(); g.beginPath(); g.rect(x0, top, w, bot - top); g.clip();
  const st = metric ? 5 : 20, lab = metric ? 20 : 100;
  g.fillStyle = '#ffffff'; g.font = F_PFD_M; g.textAlign = 'left'; g.textBaseline = 'middle';
  for (let s = Math.floor((a - half / ppu) / st) * st; s <= a + half / ppu; s += st) {
    const y = Math.round(cy + (a - s) * ppu);
    g.fillRect(x0, y, s % lab === 0 ? 10 : 5, 1);
    if (s % lab === 0 && s >= 0) g.fillText(sInt(s), x0 + 13, y);
  }
  g.restore();
  // the trend (6 s of the vertical speed)
  const tr = Math.max(-half, Math.min(half, Math.round(PF.vs * 6 * k * ppu)));
  if (tr > 2 || tr < -2) { g.fillStyle = C_MAG; g.fillRect(x0 - 1, tr > 0 ? cy - tr : cy, 3, tr > 0 ? tr : -tr); }
  // the pointer box (to the ten feet, to the metre)
  g.fillStyle = C_BOX; g.strokeStyle = '#ffffff'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(x0 + w, cy - 14); g.lineTo(x0 + 9, cy - 14); g.lineTo(x0 + 9, cy - 6); g.lineTo(x0 + 2, cy); g.lineTo(x0 + 9, cy + 6); g.lineTo(x0 + 9, cy + 14); g.lineTo(x0 + w, cy + 14); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#ffffff'; g.font = F_PFD_L; g.textAlign = 'right';
  g.fillText(sInt(metric ? Math.round(a) : Math.round(a / 10) * 10), x0 + w - 3, cy + 1);
  g.font = F_PFD_S; g.fillStyle = '#9fb0bc'; g.textAlign = 'right'; g.textBaseline = 'alphabetic';
  g.fillText(UNIT_ALT[S.units] || 'FT', x0 + w - 3, top - 3);
  g.fillStyle = C_BOX; g.fillRect(x0, bot + 2, w, 16);
  g.fillStyle = C_CY; g.textAlign = 'left'; g.fillText(BARO_TXT[S.units] || BARO_TXT.aviation, x0 + 4, bot + 14);
  // THE VERTICAL SPEED: 2000 fpm (10 m/s) to the scale's end, the needle a pointer with its value
  const vx = x0 + w + 2, vw = 20, vh = Math.round(half * 0.85), fpm = metric ? PF.vs : PF.vs * 196.85, full = metric ? 10 : 2000;
  g.fillStyle = C_TAPE; g.fillRect(vx, cy - vh, vw, 2 * vh);
  g.fillStyle = '#ffffff'; g.font = F_PFD_S; g.textAlign = 'left'; g.textBaseline = 'middle';
  for (let q = -4; q <= 4; q++) {
    if (!q) continue;
    const y = Math.round(cy - q / 4 * vh);
    g.fillRect(vx, y, q % 2 ? 4 : 7, 1);
    if (!(q % 2)) g.fillText(sInt(Math.abs(q) * (metric ? 5 : 1) / 2), vx + 9, y);
  }
  const yv = Math.round(cy - Math.max(-1, Math.min(1, fpm / full)) * vh);
  g.fillStyle = C_BOX; g.strokeStyle = '#ffffff'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(vx, yv); g.lineTo(vx + 8, yv - 7); g.lineTo(vx + vw + 18, yv - 7); g.lineTo(vx + vw + 18, yv + 7); g.lineTo(vx + 8, yv + 7); g.closePath(); g.fill(); g.stroke();
  const av = metric ? Math.round(Math.abs(fpm) * 10) : Math.round(Math.abs(fpm) / 50) * 50;
  if (metric ? av >= 3 : av >= 100) { g.fillStyle = '#ffffff'; g.font = F_PFD_S; g.fillText(metric ? sTenth(av) : sInt(av), vx + 9, yv + 1); }
  g.textBaseline = 'alphabetic';
}
// THE HEADING ARC: the compass turning under the heading box, the desired track (magenta bug), the ground track
// (magenta diamond), the deviation off the active leg (1 nm / 2 km to the scale's end)
function paintHsi(g, cx, PH) {
  const R = 112, hy = PH + 70, hd = PF.hdg;
  g.save();
  g.beginPath(); g.rect(0, 0, CW, PH); g.clip();
  g.fillStyle = 'rgba(8,12,16,0.80)'; g.beginPath(); g.arc(cx, hy, R + 2, 0, 6.283); g.fill();
  g.strokeStyle = '#ffffff'; g.fillStyle = '#ffffff'; g.lineWidth = 1.5; g.font = F_PFD_M; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let d = 0; d < 360; d += 5) {
    let rel = d - hd; while (rel > 180) rel -= 360; while (rel < -180) rel += 360;
    if (rel > 62 || rel < -62) continue;
    const t = rel / 57.29578, sn = Math.sin(t), cs = Math.cos(t), L = d % 10 === 0 ? 10 : 5;
    g.beginPath(); g.moveTo(Math.round(cx + sn * R), Math.round(hy - cs * R)); g.lineTo(Math.round(cx + sn * (R - L)), Math.round(hy - cs * (R - L))); g.stroke();
    if (d % 30 === 0) g.fillText(HSI_TXT[d / 30], Math.round(cx + sn * (R - 21)), Math.round(hy - cs * (R - 21)));
  }
  const W = waypoint();
  if (W.on) {
    let rel = W.dtk - hd; while (rel > 180) rel -= 360; while (rel < -180) rel += 360;
    if (rel < 62 && rel > -62) {
      const t = rel / 57.29578, sn = Math.sin(t), cs = Math.cos(t);
      g.fillStyle = C_MAG; g.beginPath();
      g.moveTo(Math.round(cx + sn * (R - 1)), Math.round(hy - cs * (R - 1)));
      g.lineTo(Math.round(cx + sn * (R - 14) - cs * 6), Math.round(hy - cs * (R - 14) - sn * 6));
      g.lineTo(Math.round(cx + sn * (R - 14) + cs * 6), Math.round(hy - cs * (R - 14) + sn * 6)); g.closePath(); g.fill();
    }
  }
  if (S.gs > 3) {
    let rel = PF.drift; const t = rel / 57.29578, px = Math.round(cx + Math.sin(t) * (R + 1)), py = Math.round(hy - Math.cos(t) * (R + 1));
    g.fillStyle = C_MAG; g.beginPath(); g.moveTo(px, py - 5); g.lineTo(px + 4, py); g.lineTo(px, py + 5); g.lineTo(px - 4, py); g.closePath(); g.fill();
  }
  // the deviation: four dots and the needle, the leg's cross-track (right of course: the needle left)
  const yd = PH - 12;
  g.fillStyle = '#ffffff';
  for (let q = -2; q <= 2; q++) if (q) { g.beginPath(); g.arc(cx + q * 20, yd, 2.5, 0, 6.283); g.fill(); }
  if (W.on) {
    const c = W.dtk / 57.29578, ex = PF.x - W.ax, en = -(PF.z - W.az), xt = ex * Math.cos(c) - en * Math.sin(c);
    const fs = S.units === 'metric' ? 2000 : 1852, dv = Math.max(-46, Math.min(46, Math.round(-xt / fs * 40)));
    g.fillStyle = C_MAG; g.fillRect(cx + dv - 2, yd - 9, 4, 18);
  }
  g.restore();
  // the lubber line and the heading box over the arc's top
  g.fillStyle = '#ffffff';
  g.beginPath(); g.moveTo(cx, hy - R + 9); g.lineTo(cx - 5, hy - R); g.lineTo(cx + 5, hy - R); g.closePath(); g.fill();
  g.fillStyle = C_BOX; g.strokeStyle = '#ffffff'; g.lineWidth = 1.5;
  g.fillRect(cx - 24, hy - R - 21, 48, 20); g.strokeRect(cx - 24, hy - R - 21, 48, 20);
  g.fillStyle = '#ffffff'; g.font = F_PFD_B; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(sDeg(Math.round(hd)), cx, hy - R - 10);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
}
// THE WAYPOINT BAR along the top: the active waypoint, its distance, the desired track, the ground track, the time
function paintPfdBar(g, X0, PW) {
  g.fillStyle = '#0a0c0f'; g.fillRect(X0, 0, PW, PFD_TOP);
  const W = waypoint(), metric = S.units === 'metric', x = PF.x, z = PF.z;
  const ddx = W.bx - x, ddz = W.bz - z;
  FR.dis = W.on ? Math.sqrt(ddx * ddx + ddz * ddz) : 0;
  FR.ete = W.on && S.gs > 1 ? FR.dis / S.gs : -1;
  const yb = PFD_TOP - 6, c = Math.round(PW / 6);
  g.font = F_PFD_M; g.fillStyle = C_MAG; g.fillText(W.on ? (W.name || 'WPT') : 'NO ROUTE', X0 + 6, yb);
  g.font = F_PFD_S; g.fillStyle = '#9fb0bc';
  g.fillText('DIS', X0 + 2 * c, yb); g.fillText('DTK', X0 + 3 * c, yb); g.fillText('TRK', X0 + 4 * c, yb); g.fillText('ETE', X0 + 5 * c, yb);
  g.font = F_PFD_M; g.fillStyle = '#ffffff';
  g.fillText(W.on ? sTenth(Math.round(metric ? FR.dis / 100 : FR.dis / 185.2)) : '--.-', X0 + 2 * c + 26, yb);
  g.fillText(W.on ? sDeg(Math.round(W.dtk)) : '---', X0 + 3 * c + 26, yb);
  g.fillText(S.gs > 1 ? sDeg(Math.round(S.trk * 57.29578)) : '---', X0 + 4 * c + 26, yb);
  const ete = FR.ete;
  if (ete >= 0 && ete < 6000) { const mm = Math.floor(ete / 60), ss = Math.floor(ete - 60 * mm);
    g.fillText(sTwo(mm), X0 + 5 * c + 26, yb); g.fillText(':', X0 + 5 * c + 42, yb); g.fillText(sTwo(ss), X0 + 5 * c + 50, yb); }
  else g.fillText('--:--', X0 + 5 * c + 26, yb);
}
// G2813: the map's zoom buttons, for the finger: + (the range a step in) and - (out), under north's arrow
const ZB = { x: CW - 34, y1: 0, y2: 0, s: 30 };
function zoomBtns(mTop) {
  const g = S.g; ZB.y1 = mTop + 40; ZB.y2 = mTop + 74;
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(ZB.x, ZB.y1, ZB.s, ZB.s); g.fillRect(ZB.x, ZB.y2, ZB.s, ZB.s);
  g.fillStyle = '#ffffff';
  g.fillRect(ZB.x + 8, ZB.y1 + 14, 14, 2); g.fillRect(ZB.x + 14, ZB.y1 + 8, 2, 14);
  g.fillRect(ZB.x + 8, ZB.y2 + 14, 14, 2);
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
  // G2813: the glass unit powers up on its PFD, the synthetic vision on; its grid is baked anew for this flight
  S.pfd = S.kind === 'glass'; S.svt = true; S.terr = true; S.vsp = o.speeds || null;
  if (S.pfd) S.page = 'pfd';
  SVG.i = 0; SVG.ready = false; PF.have = false; PF.acc = 0;
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
  if (S.pfd && !SVG.ready) svBake();             // G2813: the synthetic vision's grid, a slice a frame
  const hz = S.page === 'pfd' ? PFD_HZ : HZ;     // G2813: the attitude at 20 Hz, the map and the numbers at 4
  // the screen's own glow: the cockpit's night dimmer for what is read up close (CK.nightK, the faces' law)
  const glow = CK.nightK ? CK.nightK(0.92) : 1;
  S.mat.emissiveIntensity = 0.9 * glow;
  S.acc += dt; S.pT += dt;
  // (a tolerance: fifteen 1/60 s steps can sum to a hair under 1/4 s, and the cadence would slip to 3.75 Hz; the
  // remainder carries, so the repaints keep 4 Hz at any frame rate, and a long stall does not owe a burst)
  if (S.acc + 1e-6 < 1 / hz) return false;
  S.acc = S.acc > 2 / hz ? 0 : Math.max(0, S.acc - 1 / hz);
  if (S.boot < BOOT_S) return false;
  // ground speed and track over the paint interval, smoothed (half a step at 4 Hz; as fast in time at 20 Hz)
  PF.dt = S.pT;                                  // (G2813: the interval to the PFD in module state - a double handed to a call is boxed)
  if (S.pT > 0) {
    const dx = x - S.px, dz = z - S.pz, v = Math.sqrt(dx * dx + dz * dz) / S.pT;
    if (v < 250) {                                // (a jump - a new start, a reset - is not a speed)
      S.gs += (v - S.gs) * Math.min(1, 2 * S.pT);
      if (v > 1) S.trk = Math.atan2(dx, -dz);
    }
  }
  S.px = x; S.pz = z; S.pT = 0;
  if (S.pfd) pfdRead(CK);
  FR.x = x; FR.z = z;
  paintPage();
  S.paints++;
  upload();
  return true;
}
function paintPage() { if (S.page === 'nav') paintNav(); else if (S.page === 'pfd') paintPfd(); else paintMap(); }
// G2812: A SOFTKEY PRESSED (cockpit.js, the `gpskey` law; the switching functions only): the range a step down or up,
// north-up / track-up, the page. Only a unit that is on and past its boot answers; the glass repaints at once (the
// next 4 Hz repaint would leave a press unanswered for up to a quarter second). Returns true when it took the press
function key(k) {
  if (!S.on || S.boot < BOOT_S || !S.g) return false;
  const n = (RANGES[S.units] || RANGES.aviation).length;
  // G2813: on the PFD the keys are its own: the synthetic vision, its terrain colours, (none), the page
  if (S.page === 'pfd') {
    if (k === 'rngDn') S.svt = !S.svt;
    else if (k === 'rngUp') { if (!S.svt) return false; S.terr = !S.terr; }
    else if (k === 'page') S.page = 'map';
    else return false;
  }
  else if (k === 'rngDn') S.rngI = Math.max(0, S.rngI - 1);
  else if (k === 'rngUp') S.rngI = Math.min(n - 1, S.rngI + 1);
  else if (k === 'orient') S.trkUp = !S.trkUp;
  else if (k === 'page') S.page = S.page === 'map' ? 'nav' : S.pfd ? 'pfd' : 'map';
  else return false;
  FR.x = S.px; FR.z = S.pz;
  paintPage(); upload();
  return true;
}
// G2813: A TAP ON THE GLASS (cockpit.js: the screen's hit, its uv - u across from the pilot's left, v up). A key's label
// is the key; on the map, + and - zoom; on the PFD the waypoint bar opens the nav page, the heading arc the map; on the
// nav page a tap goes back. Only a unit on and past its boot answers
function touch(u, v) {
  if (!S.on || S.boot < BOOT_S || !S.g || !(u >= 0 && u <= 1 && v >= 0 && v <= 1)) return false;
  const px = u * CW, py = (1 - v) * S.H, kL = keyStrip(), n = KEYS.length;
  if (kL && (S.keysAt === 'left' ? px < kL : py > S.H - kL))
    return key(KEYS[Math.max(0, Math.min(n - 1, Math.floor(S.keysAt === 'left' ? py / (S.H / n) : px / (CW / n))))]);
  const PH = S.H - (S.keysAt === 'left' ? 0 : kL);
  let to = null;
  if (S.page === 'map') {
    if (px >= ZB.x && px <= ZB.x + ZB.s && py >= ZB.y1 && py <= ZB.y1 + ZB.s) return key('rngDn');
    if (px >= ZB.x && px <= ZB.x + ZB.s && py >= ZB.y2 && py <= ZB.y2 + ZB.s) return key('rngUp');
    return false;
  }
  if (S.page === 'pfd') {
    if (py < PFD_TOP) to = 'nav';
    else if (py > PH - 64 && Math.abs(px - CW / 2) < 110) to = 'map';
    else return false;
  } else to = S.pfd ? 'pfd' : 'map';
  S.page = to; FR.x = S.px; FR.z = S.pz;
  paintPage(); upload();
  return true;
}
const API = {
  HZ, TRACK_N, TRACK_DT, RANGE, BOOT_S,
  KEYS, RANGES,
  material, bind, tick, key, touch, state: () => S,
  PFD_HZ, sv: () => SVG, pf: () => PF,              // G2813 (GATE GPSFACE, gps_shots.js)
  paintPfd: (x, z) => { FR.x = x; FR.z = z; paintPfd(); },
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
