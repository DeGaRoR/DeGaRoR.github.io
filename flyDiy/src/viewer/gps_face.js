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
// Node-loadable (GATE GPSFACE): no DOM at module scope; a caller may hand a canvas factory (`setCanvas`).
(() => {
'use strict';
const HZ = 4;                                    // repaints a second
const TRACK_N = 720, TRACK_DT = 2;               // 24 min of track, a sample every 2 s (and only once moved 5 m)
const RANGE = { aviation: 7408, metric: 8000 };  // the map's width, m: 4 nm across, or 8 km
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
  const mTop = bar, mH = H - bar - foot;
  const R = RANGE[S.units] || RANGE.aviation, k = CW / R;
  const src = S.src;
  // the map: the baked island under the aeroplane, north up, the aeroplane in the middle
  g.fillStyle = SEA; g.fillRect(0, mTop, CW, mH);
  const map = src && src.map ? src.map() : null, box = src && src.box ? src.box() : null;
  if (map && box && box.size > 0 && map.width > 0) {
    const s = map.width / box.size;
    let sx = (x - CW / 2 / k - box.x0) * s, sy = (z - mH / 2 / k - box.z0) * s;
    let sw = CW / k * s, sh = mH / k * s, dx = 0, dy = mTop, dw = CW, dh = mH;
    // clip the source to the picture (and the destination with it): a source rect off the image is not drawn
    // the same way by every browser
    if (sx < 0) { const c = -sx / sw * dw; dx += c; dw -= c; sw += sx; sx = 0; }
    if (sy < 0) { const c = -sy / sh * dh; dy += c; dh -= c; sh += sy; sy = 0; }
    if (sx + sw > map.width) { const o = sx + sw - map.width; dw -= o / sw * dw; sw -= o; }
    if (sy + sh > map.height) { const o = sy + sh - map.height; dh -= o / sh * dh; sh -= o; }
    if (sw > 0 && sh > 0 && dw > 0 && dh > 0) g.drawImage(map, sx, sy, sw, sh, dx, dy, dw, dh);
  }
  const cx = CW / 2, cy = mTop + mH / 2;
  FR.cx = cx; FR.cy = cy; FR.k = k;
  g.save();
  g.beginPath(); g.rect(0, mTop, CW, mH); g.clip();
  // the aerodromes in view
  const F = src && src.fields ? src.fields() : null;
  if (F) {
    g.font = '500 13px "IBM Plex Sans", sans-serif';
    for (let i = 0; i < F.length; i++) {
      const a = F[i]; if (!a || a.kind === 'meadow') continue;
      const ax = PX(a.x), ay = PY(a.z);
      if (ax < -20 || ax > CW + 20 || ay < mTop - 20 || ay > mTop + mH + 20) continue;
      g.strokeStyle = '#e8eef2'; g.lineWidth = 2;
      g.beginPath(); g.arc(ax, ay, 5, 0, 6.283); g.stroke();
      g.fillStyle = '#e8eef2';
      if (a.name) g.fillText(a.name, ax + 8, ay + 4);
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
  // the aeroplane: a white arrow along its track
  g.translate(cx, cy); g.rotate(S.trk);
  g.fillStyle = '#ffffff'; g.strokeStyle = '#000000'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(0, -12); g.lineTo(8, 9); g.lineTo(0, 4); g.lineTo(-8, 9); g.closePath(); g.fill(); g.stroke();
  g.restore();
  // north and the range, on the map's corners
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(CW - 34, mTop + 4, 30, 22);
  g.fillStyle = '#ffffff'; g.font = '700 16px "IBM Plex Mono", monospace'; g.fillText('N', CW - 25, mTop + 21);
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(4, mTop + mH - 24, 74, 20);
  g.fillStyle = '#ffffff'; g.font = '500 13px "IBM Plex Mono", monospace';
  g.fillText(S.units === 'metric' ? 'RNG 8 km' : 'RNG 4 nm', 9, mTop + mH - 9);
  // THE DATA BAR: GS, DTK, DIS, ETE (the units the build's panel is painted in)
  g.fillStyle = '#0a0c0f'; g.fillRect(0, 0, CW, bar);
  const metric = S.units === 'metric';
  const gsD = metric ? S.gs * 3.6 : S.gs * 1.943844;
  const ddx = W.bx - x, ddz = W.bz - z;
  const disM = W.on ? Math.sqrt(ddx * ddx + ddz * ddz) : 0;     // (not Math.hypot: a varargs builtin boxes its doubles)
  const ete = W.on && S.gs > 1 ? disM / S.gs : -1;
  const lab = Math.min(80, Math.round(bar * 0.30)), val = Math.min(80, Math.round(bar * 0.52));
  const cell = CW / 4;
  field(0 * cell, bar, lab, val, 'GS', sInt(Math.round(gsD)), metric ? 'km/h' : 'kt');
  field(1 * cell, bar, lab, val, 'DTK', W.on ? sDeg(Math.round(W.dtk)) : '---', '°');
  field(2 * cell, bar, lab, val, 'DIS', W.on ? sTenth(Math.round(metric ? disM / 100 : disM / 185.2)) : '--.-', metric ? 'km' : 'nm');
  if (ete >= 0 && ete < 6000) {
    const mm = Math.floor(ete / 60), ss = Math.floor(ete - 60 * mm);
    field2(3 * cell, bar, lab, val, 'ETE', sTwo(mm), sTwo(ss));
  } else field(3 * cell, bar, lab, val, 'ETE', '--:--', '');
  // THE WAYPOINT BAR
  g.fillStyle = '#0a0c0f'; g.fillRect(0, H - foot, CW, foot);
  g.fillStyle = '#ff4fd8'; g.font = FONT_WPT[foot >= 28 ? 1 : 0];
  g.fillText(W.on ? (W.name || 'WPT') : 'NO ROUTE', 10, H - Math.round(foot * 0.3));
  g.fillStyle = '#8a9aa6'; g.font = FONT_TRK[foot >= 28 ? 1 : 0];
  g.fillText('TRK', CW - 92, H - Math.round(foot * 0.3));
  g.fillStyle = '#ffffff'; g.fillText(S.gs > 1 ? sDeg(Math.round(S.trk * 57.29578)) : '---', CW - 56, H - Math.round(foot * 0.3));
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
const FR = { cx: 0, cy: 0, x: 0, z: 0, k: 1 };
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
  paintMap();
  S.paints++;
  upload();
  return true;
}
const API = {
  HZ, TRACK_N, TRACK_DT, RANGE, BOOT_S,
  material, bind, tick, state: () => S,
  // the shed: the unit off, its standby page, released by the flight (app.js enterGarage)
  standby: () => { S.bound = false; S.on = false; S.dark = false; S.boot = 0; if (S.mat) S.mat.emissiveIntensity = 0; paintStandby(); },
  // GATE GPSFACE: a canvas factory for node, and the page painters by name
  setCanvas: f => { canvasMaker = f; },
  waypoint: (x, z) => { FR.x = x; FR.z = z; return waypoint(); },
  paintMap: (x, z) => { FR.x = x; FR.z = z; paintMap(); },
};
if (W0) W0.FLYDIY_GPS = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
