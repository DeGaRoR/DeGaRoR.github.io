// blueprint.js — THE BLUEPRINT (G573, the user: "I need the blueprint import
// functionality. The base case is a single blueprint image").
//
// A three-view drawing, cut up and pinned in the shed around the aeroplane you
// are building, the way a modeller pins one up in a 3D package. The reference
// plane's SECOND SOURCE: refplane.js stands a baked 3D model beside the build,
// this stands the drawing the model would have been made from.
//
// THE WORKFLOW IS THE USER'S, step for step, and each step is one tab of THE
// DESK (a full-screen 2D sheet over the shed):
//
//   1 SCALE    two points on the sheet and the real length between them.
//              One number for the whole sheet: a three-view is drawn at one
//              scale, so every view inherits it (metres a sheet pixel, `mpp`).
//   2 VIEWS    each view isolated with a box or a lasso and named: side, top,
//              front, rear, or `other` with a free label.
//   3 ORIENT   rotation (a slider, the right angles, or "level": two points
//              that should be horizontal), mirror, and the drawing's EXTENT —
//              the box the view's outline fills, which is what registers the
//              views against one another (auto-trimmed off the ink, draggable).
//   4 GROUND   the ground line on the side view: the two tyres' contact
//              points. It sets the parked attitude — a taildragger drawn
//              datum-level comes out nose-up, exactly as the build stands —
//              and it puts the wheels on the shed's floor.
//   5 PLACE    the views go up in 3D, laid out automatically in one body frame
//              (nose at the origin, the side view on the centreline, the top
//              view on the floor, the front view ahead of the nose), and the
//              panel moves them and turns them from there with sliders.
//
// TRANSPARENCY is a first-class control: an opacity for the whole set and one
// per view, and PAPER: `clear` turns the sheet's own paper colour transparent
// so only the linework hangs in the air, optionally re-inked in a colour that
// reads against the build.
//
// ---------------------------------------------------------------------------
// THE ONE ROOT RULE HOLDS HERE EXACTLY AS IN refplane.js. This file never
// writes the spec: its whole state is display state, the sheet and its cuts,
// kept in IndexedDB (an image does not fit in localStorage). GATE REF scans
// this file's source for the same forbidden doors it scans refplane.js for.
// ---------------------------------------------------------------------------
//
// THE FRAMES, once, because every function below speaks them:
//   SHEET px     the image as loaded: x right, y down.
//   ORIENTED px  one view after its rotation and mirror, on a canvas W x H
//                that bounds the rotated crop box: u right, v down. Same pixel
//                size as the sheet — a rotation does not scale.
//   BODY m       x AFT from the nose, y UP, z LEFT — the reference model's own
//                frame (refplane.js), so the two sources stand the same way.
//   WORLD        the shed. The body frame is pitched to its parked attitude,
//                yawed, and dropped so its wheels are on the build's floor.

(function () {
'use strict';

// ===========================================================================
// THE NODE HALF — pure, no THREE, no DOM. tools/_blueprint_check.js holds it.
// ===========================================================================

var UNITS = [['m', 1], ['cm', 0.01], ['mm', 0.001], ['ft', 0.3048], ['in', 0.0254]];
function bpUnit(u) {
  for (var i = 0; i < UNITS.length; i++) if (UNITS[i][0] === u) return UNITS[i][1];
  return 1;
}
var KINDS = ['side', 'top', 'front', 'rear', 'other'];
var FACINGS = ['side', 'top', 'front'];

// where the automatic layout puts what, in metres
var FRONT_GAP = 0.5;       // the front view stands this far ahead of the nose
var REAR_GAP = 0.5;        // ...and the rear view this far behind the tail
var FLOOR_LIFT = 0.005;    // the top view floats this far over the floor (no z-fight)
var ASIDE = 1.0;           // an `other` view stands this far clear of the aeroplane

function bpBox(pts) {
  if (!pts || !pts.length) return null;
  var b = [1e9, 1e9, -1e9, -1e9];
  for (var i = 0; i < pts.length; i++) {
    var p = pts[i];
    if (p[0] < b[0]) b[0] = p[0];
    if (p[1] < b[1]) b[1] = p[1];
    if (p[0] > b[2]) b[2] = p[0];
    if (p[1] > b[3]) b[3] = p[1];
  }
  return (b[2] > b[0] && b[3] > b[1]) ? b : null;
}

// METRES A SHEET PIXEL, off the two scale points and the length between them
function bpMpp(sc) {
  if (!sc || !sc.a || !sc.b || !(sc.len > 0)) return null;
  var d = Math.hypot(sc.b[0] - sc.a[0], sc.b[1] - sc.a[1]);
  return d > 0 ? sc.len * bpUnit(sc.unit) / d : null;
}

// the oriented canvas of a view: the crop box rotated, bounded again
function bpDims(view) {
  var b = bpBox(view && view.pts);
  if (!b) return null;
  var w = b[2] - b[0], h = b[3] - b[1];
  var r = (view.rot || 0) * Math.PI / 180;
  var c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r));
  return { W: w * c + h * s, H: w * s + h * c,
           cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2, w: w, h: h, box: b };
}

// SHEET -> ORIENTED. Rotate about the crop box's centre (degrees, clockwise
// on screen, because y is down), then mirror in the oriented frame.
function bpToOriented(view, p, d) {
  d = d || bpDims(view);
  var r = (view.rot || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  var dx = p[0] - d.cx, dy = p[1] - d.cy;
  var u = dx * c - dy * s, v = dx * s + dy * c;
  if (view.flipH) u = -u;
  if (view.flipV) v = -v;
  return [u + d.W / 2, v + d.H / 2];
}
// ...and back
function bpFromOriented(view, q, d) {
  d = d || bpDims(view);
  var u = q[0] - d.W / 2, v = q[1] - d.H / 2;
  if (view.flipH) u = -u;
  if (view.flipV) v = -v;
  var r = (view.rot || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  return [d.cx + u * c + v * s, d.cy - u * s + v * c];
}

function bpNormDeg(a) {
  a = a % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return a;
}
// LEVEL: the rotation that lays the sheet segment p -> q horizontal ('h') or
// vertical ('v'), the shorter way round. A view drawn at 45 degrees is two
// clicks along its datum.
function bpLevelRot(p, q, axis) {
  var a = Math.atan2(q[1] - p[1], q[0] - p[0]) * 180 / Math.PI;
  var base = axis === 'v' ? 90 - a : -a;
  var c1 = bpNormDeg(base), c2 = bpNormDeg(base + 180);
  return Math.abs(c1) <= Math.abs(c2) ? c1 : c2;
}

// THE EXTENT: the box the drawing fills, in oriented px. Declared (auto-trimmed
// or dragged) or, failing that, the whole oriented canvas.
function bpExt(view, d) {
  d = d || bpDims(view);
  var e = view.ext;
  if (e && e.length === 4 && e[2] > e[0] && e[3] > e[1]) return e;
  return [0, 0, d.W, d.H];
}

function bpFirst(bp, kind) {
  for (var i = 0; i < bp.views.length; i++)
    if (bp.views[i].kind === kind) return bp.views[i];
  return null;
}

// the mean oriented v of a view's ground line, or null
function groundV(view, d) {
  var g = view.ground;
  if (!g || !g.a) return null;
  var a = bpToOriented(view, g.a, d);
  if (!g.b) return a[1];
  var b = bpToOriented(view, g.b, d);
  return (a[1] + b[1]) / 2;
}

// a rotation of the vector `p` about the unit axis `n` by `deg` (Rodrigues)
function rotAbout(p, n, deg) {
  var t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
  var d = p[0] * n[0] + p[1] * n[1] + p[2] * n[2];
  var x = [n[1] * p[2] - n[2] * p[1], n[2] * p[0] - n[0] * p[2],
           n[0] * p[1] - n[1] * p[0]];
  return [p[0] * c + x[0] * s + n[0] * d * (1 - c),
          p[1] * c + x[1] * s + n[1] * d * (1 - c),
          p[2] * c + x[2] * s + n[2] * d * (1 - c)];
}

// the height of a body point after the rig's pitch (nose-up positive, a
// rotation about z — refplane.js's refLowestY, the same formula)
function pitchedY(x, y, deg) {
  var t = deg * Math.PI / 180;
  return y * Math.cos(t) - x * Math.sin(t);
}
function pitchedX(x, y, deg) {
  var t = deg * Math.PI / 180;
  return x * Math.cos(t) + y * Math.sin(t);
}

// THE LAYOUT. Every view as a plane in the body frame: its centre, its size
// in metres and the body directions of the image's +u and +v. Pure: the same
// state always lays out the same way, which is what lets the gate hold it.
//
// REGISTRATION IS BY EXTENT. The side view's extent defines the body frame —
// its left edge is the nose (x = 0), its bottom the lowest point (y = 0) — and
// every other view is registered against it by its own extent: the top view's
// left edge on the nose and its middle on the centreline, the front view's
// middle on the centreline and its bottom (or its own ground line) on the
// wheels. One scale, one frame, no view placed by hand unless you want to.
function bpLayout(bp) {
  var m = bpMpp(bp.scale);
  var rig = bp.rig || {};
  var out = { ok: !!m, mpp: m, groundPitch: 0, pitch: 0, gA: null, gB: null,
              len: null, span: null, floorRef: 0, nose: [0, 0], views: [] };
  if (!m) return out;
  var side = bpFirst(bp, 'side'), top = bpFirst(bp, 'top');
  var front = bpFirst(bp, 'front');
  var sd = side && bpDims(side), se = side && sd && bpExt(side, sd);
  var td = top && bpDims(top), te = top && td && bpExt(top, td);
  var fd = front && bpDims(front), fe = front && fd && bpExt(front, fd);
  if (se) out.len = (se[2] - se[0]) * m;
  else if (te) out.len = (te[2] - te[0]) * m;
  if (te) out.span = (te[3] - te[1]) * m;
  else if (fe) out.span = (fe[2] - fe[0]) * m;
  var span = out.span || 10, len = out.len || 7;

  if (se && side.ground && side.ground.a && side.ground.b) {
    var ga = bpToOriented(side, side.ground.a, sd);
    var gb = bpToOriented(side, side.ground.b, sd);
    out.gA = [(ga[0] - se[0]) * m, (se[3] - ga[1]) * m];
    out.gB = [(gb[0] - se[0]) * m, (se[3] - gb[1]) * m];
    var dx = out.gB[0] - out.gA[0];
    if (Math.abs(dx) > 1e-6)
      out.groundPitch = Math.atan((out.gB[1] - out.gA[1]) / dx) * 180 / Math.PI;
  }
  // THE ATTITUDE. `ground` stands it on its ground line, as the build stands
  // on its wheels; `level` keeps the drawing's own datum horizontal. The pitch
  // trim rides on either.
  var th = (rig.attitude === 'level' ? 0 : out.groundPitch) + (rig.pitch || 0);
  out.pitch = th;
  // what touches the floor: the lower tyre of the ground line, or, with none,
  // the lower bottom corner of the side view's extent
  if (out.gA) out.floorRef = Math.min(pitchedY(out.gA[0], out.gA[1], th),
                                      pitchedY(out.gB[0], out.gB[1], th));
  else if (se) out.floorRef = Math.min(pitchedY(0, 0, th), pitchedY(len, 0, th));
  // the nose, where "snap to nose" lines the build up: the middle of the side
  // view's leading edge, pitched
  var ny = se ? (se[3] - se[1]) * m / 2 : 0;
  out.nose = [pitchedX(0, ny, th), pitchedY(0, ny, th)];
  // the body height of the main wheels' contact, for the front and rear views
  var yMain = out.gA ? Math.min(out.gA[1], out.gB[1]) : 0;

  for (var i = 0; i < bp.views.length; i++) {
    var v = bp.views[i], d = bpDims(v);
    if (!d) continue;
    var e = bpExt(v, d);
    var face = v.kind === 'other' ? (FACINGS.indexOf(v.faces) >= 0 ? v.faces : 'side')
                                  : v.kind;
    var W = d.W, H = d.H, c, U, V, flat = false, xs = 1;
    var eu = (e[0] + e[2]) / 2, ev = (e[1] + e[3]) / 2;
    if (face === 'side') {
      // image +u is aft, +v is down; seen from the aeroplane's left
      U = [1, 0, 0]; V = [0, -1, 0];
      c = [(W / 2 - e[0]) * m, (e[3] - H / 2) * m, 0];
      if (v.kind === 'other') c[2] = span / 2 + ASIDE;
    } else if (face === 'top') {
      // nose left, seen from above: image down is the aeroplane's LEFT (+z)
      U = [1, 0, 0]; V = [0, 0, 1];
      // THE PLAN LIES FLAT ON THE FLOOR, and it is the one view that is not
      // pitched with the body. Pitched, a top view is a plane through the
      // fuselage, floor at the tail and 1.4 m up at the nose on a 12 degree
      // taildragger (measured on the test sheet). Flat, it is what a plan IS:
      // the parked aeroplane seen from straight above — so its length is
      // foreshortened by cos(pitch), exactly as the build's own outline is
      // from above, and its nose sits under the pitched nose.
      flat = true;
      xs = Math.cos(th * Math.PI / 180);
      c = [out.nose[0] + (W / 2 - e[0]) * m * xs, out.floorRef + FLOOR_LIFT,
           (H / 2 - ev) * m];
      if (v.kind === 'other') c[2] += span + ASIDE;
    } else if (face === 'front' || face === 'rear') {
      var rear = v.kind === 'rear';
      // seen from ahead, the aeroplane's left wing is on the viewer's right
      U = rear ? [0, 0, -1] : [0, 0, 1]; V = [0, -1, 0];
      var vg = groundV(v, d);
      var bottom = vg != null ? vg : e[3];
      c = [rear ? len + REAR_GAP : -FRONT_GAP,
           (bottom - H / 2) * m + yMain,
           (rear ? -1 : 1) * (W / 2 - eu) * m];
      if (v.kind === 'other') c[0] -= 2 * ASIDE;
    }
    var N = [U[1] * -V[2] - U[2] * -V[1], U[2] * -V[0] - U[0] * -V[2],
             U[0] * -V[1] - U[1] * -V[0]];   // U x (image up)
    // THE USER'S HAND, on top of the automatic answer: a turn about the view's
    // own normal, a size, and a move along the body's three axes
    if (v.spin) { U = rotAbout(U, N, v.spin); V = rotAbout(V, N, v.spin); }
    var k = v.size > 0 ? v.size : 1;
    c = [c[0] - (v.dx || 0), c[1] + (v.dy || 0), c[2] + (v.dz || 0)];
    // `flat`: the plane is in the RIG's frame (after the pitch), not the body's
    out.views.push({ id: v.id, kind: v.kind, face: face, W: W, H: H, flat: flat,
                     wM: W * m * k * xs, hM: H * m * k, c: c, u: U, v: V, n: N });
  }
  return out;
}

// THE PAPER, off the pixels: the most common colour among the opaque ones,
// quantised to 4 bits a channel. A blueprint is mostly paper, so the mode is
// the paper whatever colour it is — white, cream, or the blue of a real one.
function bpPaper(data) {
  var hist = new Uint32Array(4096), best = 0, bi = 0, i, q;
  for (i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    q = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    if (++hist[q] > best) { best = hist[q]; bi = q; }
  }
  if (!best) return [255, 255, 255];
  // the mean of the pixels in the winning bin, not its corner
  var r = 0, g = 0, b = 0, n = 0;
  for (i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    q = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    if (q === bi) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
  }
  return [r / n, g / n, b / n];
}

// how far a pixel is from the paper, 0..1
function inkOf(data, i, paper) {
  var dr = data[i] - paper[0], dg = data[i + 1] - paper[1], db = data[i + 2] - paper[2];
  return Math.sqrt(dr * dr + dg * dg + db * db) / 441.673;
}

// THE AUTO EXTENT: the box of the ink, in the pixels given (w x h). An edge
// is where a RUN of inked columns (rows) starts: three neighbours carrying at
// least three inked pixels between them. A one-pixel line still counts (three
// columns of one pixel each), a speck of dust on the scan does not — measured:
// a single stray pixel in a corner stretched the box across the whole cut.
function bpInkBox(data, w, h, paper, thr) {
  thr = thr || 0.18;
  var cols = new Uint32Array(w), rows = new Uint32Array(h), x, y, i;
  for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
    i = (y * w + x) * 4;
    if (data[i + 3] < 128 || inkOf(data, i, paper) < thr) continue;
    cols[x]++; rows[y]++;
  }
  var edges = function (a, n) {
    var lo = -1, hi = -1, k;
    var run = function (j) { var t = 0; for (var q = j - 2; q <= j + 2; q++) if (q >= 0 && q < n) t += a[q]; return t; };
    for (k = 0; k < n; k++) if (a[k] && run(k) >= 3 && (a[k + 1] || a[k - 1])) { lo = k; break; }
    for (k = n - 1; k >= 0; k--) if (a[k] && run(k) >= 3 && (a[k + 1] || a[k - 1])) { hi = k; break; }
    return lo < 0 ? null : [lo, hi + 1];
  };
  var ex = edges(cols, w), ey = edges(rows, h);
  if (!ex || !ey) return null;
  return [ex[0], ey[0], ex[1], ey[1]];
}

// THE CLEARED PAPER: alpha from the distance to the paper (a soft ramp from
// `cut` to twice it), the colour kept or re-inked. In place.
var INKS = { drawn: null, white: [245, 245, 240], black: [20, 20, 20],
             amber: [255, 176, 32], cyan: [90, 210, 255], red: [255, 80, 70] };
function bpClear(data, paper, cut, ink) {
  cut = cut > 0 ? cut : 0.12;
  var col = INKS[ink] || null;
  for (var i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    var t = (inkOf(data, i, paper) - cut) / cut;
    var a = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
    data[i + 3] = Math.round(data[i + 3] * a);
    if (col) { data[i] = col[0]; data[i + 1] = col[1]; data[i + 2] = col[2]; }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { bpBox: bpBox, bpMpp: bpMpp, bpUnit: bpUnit, bpDims: bpDims,
    bpToOriented: bpToOriented, bpFromOriented: bpFromOriented,
    bpLevelRot: bpLevelRot, bpNormDeg: bpNormDeg, bpExt: bpExt,
    bpLayout: bpLayout, bpPaper: bpPaper, bpInkBox: bpInkBox, bpClear: bpClear,
    pitchedY: pitchedY, KINDS: KINDS,
    GAPS: { FRONT_GAP: FRONT_GAP, REAR_GAP: REAR_GAP, FLOOR_LIFT: FLOOR_LIFT } };
  return;
}

// ===========================================================================
// THE VIEWER HALF
// ===========================================================================

var DBN = 'flydiy-blueprint', STORE = 'bp';
var LS_FOLD = 'flydiy.bp.folds';
var TEX_MAX = 3072;              // a view's texture, longest side, px
var PREV_MAX = 2048;             // a view's desk preview, longest side, px
var SHEET_MAX = 8192;            // a sheet larger than this is scaled down on import
var VCOL = { side: '#ffb020', top: '#5ad2ff', front: '#9be07a', rear: '#e08aff',
             other: '#f2f2f2' };

function fresh() {
  return { v: 1, on: true, sheet: null, scale: null, views: [], nextId: 1,
           sel: null, step: 'scale',
           rig: { fore: 0, lat: 0, up: 0, pitch: 0, yaw: 0, alpha: 0.85,
                  attitude: 'ground', over: false, placed: false } };
}
var BP = fresh();
var IMG = null;                  // the sheet, decoded (an Image or ImageBitmap)
var booted = false, bootP = null;
var folds = {};
try { folds = JSON.parse(localStorage.getItem(LS_FOLD) || '{}') || {}; } catch (e) {}

// ---- storage: IndexedDB, two keys (the config and the image) --------------
function idb(fn) {
  return new Promise(function (res) {
    try {
      var rq = indexedDB.open(DBN, 1);
      rq.onupgradeneeded = function () { rq.result.createObjectStore(STORE); };
      rq.onsuccess = function () {
        try { fn(rq.result, res); } catch (e) { res(null); }
      };
      rq.onerror = function () { res(null); };
    } catch (e) { res(null); }
  });
}
function dbGet(key) {
  return idb(function (db, res) {
    var t = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    t.onsuccess = function () { res(t.result == null ? null : t.result); };
    t.onerror = function () { res(null); };
  });
}
function dbPut(key, val) {
  return idb(function (db, res) {
    var tx = db.transaction(STORE, 'readwrite');
    if (val == null) tx.objectStore(STORE).delete(key);
    else tx.objectStore(STORE).put(val, key);
    tx.oncomplete = function () { res(true); };
    tx.onerror = function () { res(false); };
  });
}
var saveT = 0;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(function () { dbPut('cfg', JSON.stringify(BP)); }, 300);
}

function decodeBlob(blob) {
  return new Promise(function (res) {
    var url = URL.createObjectURL(blob), im = new Image();
    im.onload = function () { res(im); };
    im.onerror = function () { URL.revokeObjectURL(url); res(null); };
    im.src = url;
  });
}

function boot() {
  if (bootP) return bootP;
  bootP = Promise.all([dbGet('cfg'), dbGet('img')]).then(function (r) {
    if (r[0]) {
      try {
        var j = JSON.parse(r[0]), f = fresh();
        for (var k in f) if (!(k in j)) j[k] = f[k];
        for (var k2 in f.rig) if (!(k2 in j.rig)) j.rig[k2] = f.rig[k2];
        BP = j;
      } catch (e) {}
    }
    if (!r[1]) { if (BP.sheet) BP.sheet = null; return null; }
    return decodeBlob(r[1]);
  }).then(function (im) {
    IMG = im;
    booted = true;
    sync3D();
    repaintPanel();
  });
  return bootP;
}

// ---- loading a sheet --------------------------------------------------------
function loadFile(file) {
  if (!file || !/^image\//.test(file.type || '')) {
    note('That is not an image. A blueprint is loaded as a PNG, JPEG or WebP.');
    return;
  }
  if (BP.views.length && !confirm('Replace the sheet? Its scale and its ' +
      BP.views.length + ' view(s) are cleared.')) return;
  decodeBlob(file).then(function (im) {
    if (!im) { note('That image could not be read.'); return; }
    var w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
    var k = Math.min(1, SHEET_MAX / Math.max(w, h));
    var store = function (blob, img, W, H) {
      var keepRig = BP.rig;
      BP = fresh();
      BP.rig = keepRig; BP.rig.placed = false;
      BP.sheet = { w: W, h: H, name: file.name || 'blueprint' };
      IMG = img;
      dbPut('img', blob);
      disposeTex();
      save();
      if (desk) { setStep('scale'); fit(); }
      sync3D(); repaintPanel();
    };
    if (k >= 1) { store(file, im, w, h); return; }
    // too large for a canvas on some machines: scaled down ONCE, here, so every
    // pixel coordinate after this is in the stored image's own pixels
    var cv = document.createElement('canvas');
    cv.width = Math.round(w * k); cv.height = Math.round(h * k);
    cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
    cv.toBlob(function (b) {
      decodeBlob(b).then(function (im2) { store(b, im2, cv.width, cv.height); });
    }, 'image/png');
  });
}
function pickFile() {
  var i = document.createElement('input');
  i.type = 'file'; i.accept = 'image/*';
  i.onchange = function () { if (i.files && i.files[0]) loadFile(i.files[0]); };
  i.click();
}

function clearAll() {
  if (!confirm('Take the blueprint down? The sheet, its scale and its views are deleted.'))
    return;
  BP = fresh(); IMG = null;
  dbPut('img', null); dbPut('cfg', null);
  disposeTex(); sync3D(); repaintPanel();
  if (desk) closeDesk();
}

// ---- views -----------------------------------------------------------------
function viewById(id) {
  for (var i = 0; i < BP.views.length; i++) if (BP.views[i].id === id) return BP.views[i];
  return null;
}
function selView() { return viewById(BP.sel) || BP.views[0] || null; }
function nextKind() {
  var have = {};
  BP.views.forEach(function (v) { have[v.kind] = 1; });
  for (var i = 0; i < 3; i++) if (!have[KINDS[i]]) return KINDS[i];
  return 'other';
}
function addView(shape, pts) {
  var k = nextKind();
  var v = { id: BP.nextId++, kind: k, label: k, faces: 'side', shape: shape,
            pts: pts, rot: 0, flipH: false, flipV: false, ext: null, extAuto: true,
            ground: null, on: true, alpha: 1,
            // CLEAR BY DEFAULT: a view's cut is mostly paper, and kept, a 45
            // degree cut stood in the shed as a 15 m opaque sheet (measured on
            // the test sheet). Cleared, only the linework hangs in the air —
            // re-inked cyan, because as drawn it is dark ink in a dark shed.
            paper: 'clear', cut: 0.12, ink: 'cyan',
            dx: 0, dy: 0, dz: 0, spin: 0, size: 1 };
  BP.views.push(v);
  BP.sel = v.id;
  autoExt(v);
  save();
  return v;
}
function delView(id) {
  BP.views = BP.views.filter(function (v) { return v.id !== id; });
  if (BP.sel === id) BP.sel = BP.views.length ? BP.views[0].id : null;
  dropTex(id);
  save();
}
function viewName(v) {
  var l = (v.label || '').trim();
  return l && l !== v.kind ? v.kind + ' · ' + l : v.kind;
}

// ---- rendering a view to a canvas --------------------------------------------
// The crop, rotated and mirrored, at `k` of its sheet pixels; clipped to the
// lasso when it is one. Returns { cv, k }.
function renderView(v, maxSide, processed) {
  var d = bpDims(v);
  if (!d || !IMG) return null;
  var k = Math.min(1, maxSide / Math.max(d.W, d.H));
  var cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(d.W * k));
  cv.height = Math.max(1, Math.round(d.H * k));
  var x = cv.getContext('2d');
  x.scale(k, k);
  x.translate(d.W / 2, d.H / 2);
  x.scale(v.flipH ? -1 : 1, v.flipV ? -1 : 1);
  x.rotate((v.rot || 0) * Math.PI / 180);
  x.translate(-d.cx, -d.cy);
  x.beginPath();
  v.pts.forEach(function (p, i) { if (i) x.lineTo(p[0], p[1]); else x.moveTo(p[0], p[1]); });
  x.closePath();
  x.clip();
  x.drawImage(IMG, 0, 0);
  if (processed && v.paper === 'clear') {
    var id = x.getImageData(0, 0, cv.width, cv.height);
    bpClear(id.data, bpPaper(id.data), v.cut, v.ink);
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.putImageData(id, 0, 0);
  }
  return { cv: cv, k: k };
}
// the auto extent, off a small render (the ink box of 1024 px is plenty)
function autoExt(v) {
  if (!v.extAuto) return;
  var r = renderView(v, 1024, false);
  if (!r) { v.ext = null; return; }
  var x = r.cv.getContext('2d'), id = x.getImageData(0, 0, r.cv.width, r.cv.height);
  var b = bpInkBox(id.data, r.cv.width, r.cv.height, bpPaper(id.data));
  v.ext = b ? [b[0] / r.k, b[1] / r.k, b[2] / r.k, b[3] / r.k] : null;
}
// geometry of a view changed (crop, rotation, mirror): its extent follows
function reshaped(v) {
  if (v.extAuto) autoExt(v);
  else {
    // a hand-set extent does not survive a new orientation — it was drawn
    // around a picture that is no longer there
    v.extAuto = true; autoExt(v);
  }
  prevCache = null;
  save();
}

// ===========================================================================
// 3D — one plane a view, in a body group pitched and placed in the shed
// ===========================================================================
var rigG = null, bodyG = null, planes = {};     // id -> { mesh, tex, sig }

function mountG() { var m = window.REF_MOUNT; return (m && m.bpGroup) || null; }
function texSig(v) {
  return JSON.stringify([BP.sheet && BP.sheet.name, BP.sheet && BP.sheet.w, v.pts,
                         v.rot, v.flipH, v.flipV, v.paper, v.cut, v.ink]);
}
function dropTex(id) {
  var p = planes[id];
  if (!p) return;
  if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
  p.mesh.geometry.dispose(); p.mesh.material.dispose();
  if (p.tex) p.tex.dispose();
  delete planes[id];
}
function disposeTex() { for (var id in planes) dropTex(+id); }

function sync3D() {
  var M = mountG();
  if (!M || typeof THREE === 'undefined') return;
  if (!rigG) {
    rigG = new THREE.Group(); bodyG = new THREE.Group();
    rigG.add(bodyG); M.add(rigG);
  }
  var L = bpLayout(BP);
  var show = BP.on && !!IMG && L.ok && BP.rig.placed;
  rigG.visible = show;
  // views that went away
  for (var id in planes) if (!viewById(+id)) dropTex(+id);
  if (!show) return;
  var R = BP.rig, m = window.REF_MOUNT;
  bodyG.rotation.set(0, 0, -L.pitch * Math.PI / 180);
  rigG.rotation.set(0, R.yaw * Math.PI / 180, 0);
  var gy = m && m.groundY ? m.groundY() : 0;
  rigG.position.set(-R.fore, gy + R.up - L.floorRef, R.lat);
  var mx = new THREE.Matrix4(), X = new THREE.Vector3(), Y = new THREE.Vector3(),
      Z = new THREE.Vector3();
  L.views.forEach(function (lv) {
    var v = viewById(lv.id), p = planes[lv.id], sig = texSig(v);
    if (!p || p.sig !== sig) {
      if (p) dropTex(lv.id);
      var r = renderView(v, TEX_MAX, true);
      if (!r) return;
      var tex = new THREE.CanvasTexture(r.cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = window.FLYDIY_ANISO || 4;
      var mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true,
        side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
      mat.name = 'blueprint:' + v.kind;
      var mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = false;
      mesh.castShadow = false; mesh.receiveShadow = false;
      mesh.userData.bpView = lv.id;
      p = planes[lv.id] = { mesh: mesh, tex: tex, sig: sig };
    }
    // a plan lies in the rig (flat on the floor); every other view is pitched
    // with the body. A view whose kind changed changes parent.
    var host = lv.flat ? rigG : bodyG;
    if (p.mesh.parent !== host) host.add(p.mesh);
    // the plane's local x is the image's +u, its local y the image's UP
    X.set(lv.u[0], lv.u[1], lv.u[2]).multiplyScalar(lv.wM);
    Y.set(-lv.v[0], -lv.v[1], -lv.v[2]).multiplyScalar(lv.hM);
    Z.set(lv.n[0], lv.n[1], lv.n[2]);
    mx.makeBasis(X, Y, Z).setPosition(lv.c[0], lv.c[1], lv.c[2]);
    p.mesh.matrix.copy(mx);
    p.mesh.matrixWorldNeedsUpdate = true;
    p.mesh.visible = !!v.on;
    var mat2 = p.mesh.material;
    mat2.opacity = Math.max(0, Math.min(1, (v.alpha == null ? 1 : v.alpha) * R.alpha));
    // OVER THE BUILD draws the linework through everything, which is how you
    // trace; otherwise the build hides the drawing where it stands in front
    mat2.depthTest = !R.over;
    p.mesh.renderOrder = R.over ? 10 : 4;
  });
}

// ===========================================================================
// THE DESK — the 2D sheet, full screen, one step at a time
// ===========================================================================
var desk = null;
var prevCache = null;            // { id, sig, cv, k } — the selected view's preview
var STEPS = [['scale', '1', 'scale'], ['views', '2', 'views'],
             ['orient', '3', 'orient'], ['ground', '4', 'ground'],
             ['place', '5', 'place in 3D']];

function E(tag, cls, txt) {
  var d = document.createElement(tag);
  if (cls) d.className = cls;
  if (txt != null) d.textContent = txt;
  return d;
}
function btn(host, label, fn, title, cls) {
  var b = E('button', 'pill' + (cls ? ' ' + cls : ''), label);
  b.type = 'button';
  if (title) b.title = title;
  b.onclick = fn;
  host.appendChild(b);
  return b;
}
function note(txt) {
  if (desk && desk.msg) { desk.msg.textContent = txt; desk.msg.hidden = !txt; }
  else if (txt) console.warn('blueprint: ' + txt);
}

function openDesk(step) {
  boot().then(function () {
    if (!desk) buildDesk();
    desk.el.hidden = false;
    document.body.classList.add('bpOpen');
    setStep(step || (BP.sheet ? BP.step : 'scale'));
    requestAnimationFrame(function () { resize(); fit(); });
  });
}
function closeDesk() {
  if (!desk) return;
  desk.el.hidden = true;
  document.body.classList.remove('bpOpen');
  desk.tool = null; desk.pend = null; desk.meas = null;
  sync3D(); repaintPanel();
}

function buildDesk() {
  var el = E('div'); el.id = 'bpDesk'; el.hidden = true;
  var hd = E('header', 'bpHead');
  hd.appendChild(E('b', 'bpTitle', 'Blueprint'));
  var st = E('nav', 'bpSteps');
  var stepBtns = {};
  STEPS.forEach(function (s) {
    var b = E('button', 'bpStep'); b.type = 'button';
    b.appendChild(E('i', null, s[1])); b.appendChild(E('span', null, s[2]));
    b.onclick = function () { setStep(s[0]); };
    st.appendChild(b); stepBtns[s[0]] = b;
  });
  hd.appendChild(st);
  var tools = E('div', 'bpTools');
  btn(tools, 'load image', pickFile, 'Open a blueprint image (PNG, JPEG, WebP) — or drop one on the sheet, or paste it');
  var mBtn = btn(tools, 'measure', function () {
    desk.measOn = !desk.measOn; desk.meas = null;
    mBtn.classList.toggle('on', desk.measOn); draw();
  }, 'Click two points to read the distance between them, in metres and feet');
  btn(tools, 'fit', function () { fit(); }, 'Fit the sheet to the window');
  btn(tools, 'close', closeDesk, 'Back to the shed — nothing is lost, the desk keeps its state');
  hd.appendChild(tools);
  el.appendChild(hd);

  var main = E('div', 'bpMain');
  var stage = E('div', 'bpStage');
  var cv = E('canvas'); stage.appendChild(cv);
  var msg = E('div', 'bpMsg'); msg.hidden = true; stage.appendChild(msg);
  var drop = E('div', 'bpDrop', 'Drop a blueprint image here, paste one, or press LOAD IMAGE');
  stage.appendChild(drop);
  main.appendChild(stage);
  var side = E('aside', 'bpSide');
  main.appendChild(side);
  el.appendChild(main);
  var host = document.getElementById('wsUI') || document.body;
  host.appendChild(el);

  desk = { el: el, cv: cv, ctx: cv.getContext('2d'), side: side, stage: stage,
           msg: msg, drop: drop, steps: stepBtns, measBtn: mBtn,
           zoom: 1, px: 0, py: 0, tool: 'box', drag: null, pend: null,
           measOn: false, meas: null, space: false, hover: null };

  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerup', onUp);
  cv.addEventListener('pointercancel', onUp);
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  cv.addEventListener('wheel', onWheel, { passive: false });
  cv.addEventListener('dblclick', function () { fit(); });
  stage.addEventListener('dragover', function (e) { e.preventDefault(); });
  stage.addEventListener('drop', function (e) {
    e.preventDefault();
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) loadFile(f);
  });
  window.addEventListener('paste', function (e) {
    if (!desk || desk.el.hidden) return;
    var it = (e.clipboardData && e.clipboardData.items) || [];
    for (var i = 0; i < it.length; i++)
      if (/^image\//.test(it[i].type)) { loadFile(it[i].getAsFile()); e.preventDefault(); return; }
  });
  window.addEventListener('keydown', function (e) {
    if (!desk || desk.el.hidden) return;
    var typing = /INPUT|SELECT|TEXTAREA/.test((e.target && e.target.tagName) || '');
    if (e.key === ' ' && !typing) { desk.space = true; e.preventDefault(); }
    if (e.key === 'Escape') {
      if (desk.pend || desk.drag || desk.meas) { desk.pend = null; desk.drag = null; desk.meas = null; draw(); }
      else closeDesk();
      e.stopPropagation();
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !typing && BP.step === 'views' && selView()) {
      delView(selView().id); paintSide(); draw(); e.preventDefault();
    }
  }, true);
  window.addEventListener('keyup', function (e) { if (e.key === ' ') desk && (desk.space = false); });
  window.addEventListener('resize', function () { if (desk && !desk.el.hidden) { resize(); draw(); } });
}

function setStep(s) {
  BP.step = s; save();
  desk.pend = null; desk.drag = null;
  // a tool belongs to its step: the lasso is not armed on the ground line
  desk.tool = s === 'views' ? (desk.tool === 'lasso' ? 'lasso' : 'box') : null;
  if (s === 'place') {
    // placing is an ACT, not a page: the views go up and the desk steps aside
    if (!bpMpp(BP.scale)) { note('Set the scale first (step 1).'); BP.step = 'scale'; }
    else if (!BP.views.length) { note('Cut at least one view first (step 2).'); BP.step = 'views'; }
    else { place3D(); closeDesk(); return; }
  } else note('');
  for (var k in desk.steps) desk.steps[k].classList.toggle('on', k === BP.step);
  paintSteps();
  prevCache = null;
  paintSide();
  fit();
}
function paintSteps() {
  var done = { scale: !!bpMpp(BP.scale), views: BP.views.length > 0,
               orient: BP.views.length > 0,
               ground: !!((bpFirst(BP, 'side') || {}).ground), place: !!BP.rig.placed };
  for (var k in desk.steps) desk.steps[k].classList.toggle('done', !!done[k]);
}

// the first placement snaps the nose to the build's; after that, the
// blueprint is where you left it — a build that grows must not drag it along
function place3D() {
  if (!BP.rig.placed) { BP.rig.placed = true; snapNose(true); }
  save(); sync3D(); repaintPanel();
  if (window.REFPLANE && window.REFPLANE.showSource) window.REFPLANE.showSource('bp');
}
function snapNose(quiet) {
  var m = window.REF_MOUNT, bb = m && m.buildBox && m.buildBox();
  var L = bpLayout(BP);
  if (!bb) { if (!quiet) note('No build standing to line up with.'); return; }
  // the rig's world x is -fore; the nose sits L.nose[0] aft of it (pitched)
  BP.rig.fore = -(bb.min.x - L.nose[0]);
  BP.rig.lat = 0;
  save(); sync3D();
}

// ---- the document on the stage: the sheet, or one oriented view -------------
function docOf() {
  var s = BP.step;
  if ((s === 'orient' || s === 'ground') && selView() && IMG) {
    var v = selView(), sig = texSig(v) + '|' + v.id;
    if (!prevCache || prevCache.sig !== sig) {
      var r = renderView(v, PREV_MAX, false);
      prevCache = r ? { sig: sig, cv: r.cv, k: r.k } : null;
    }
    var d = bpDims(v);
    return prevCache ? { kind: 'view', v: v, d: d, w: d.W, h: d.H, src: prevCache.cv } : null;
  }
  if (!IMG || !BP.sheet) return null;
  return { kind: 'sheet', w: BP.sheet.w, h: BP.sheet.h, src: IMG };
}
function resize() {
  var r = desk.stage.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  desk.cv.width = Math.max(1, Math.round(r.width * dpr));
  desk.cv.height = Math.max(1, Math.round(r.height * dpr));
  desk.cv.style.width = r.width + 'px'; desk.cv.style.height = r.height + 'px';
  desk.dpr = dpr;
}
function fit() {
  if (!desk) return;
  resize();
  var D = docOf(), W = desk.cv.width / desk.dpr, H = desk.cv.height / desk.dpr;
  if (!D) { draw(); return; }
  desk.zoom = Math.min(W / D.w, H / D.h) * 0.9;
  desk.px = (W - D.w * desk.zoom) / 2;
  desk.py = (H - D.h * desk.zoom) / 2;
  draw();
}
function toDoc(e) {
  var r = desk.cv.getBoundingClientRect();
  return [(e.clientX - r.left - desk.px) / desk.zoom, (e.clientY - r.top - desk.py) / desk.zoom];
}
function scr(p) { return [p[0] * desk.zoom + desk.px, p[1] * desk.zoom + desk.py]; }
function near(a, b, px) { return a && b && Math.hypot(a[0] - b[0], a[1] - b[1]) * desk.zoom < (px || 9); }

function inPoly(p, pts) {
  var c = false;
  for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    var a = pts[i], b = pts[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) &&
        p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
function boxPts(a, b) {
  var x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]);
  var y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
}

// ---- pointer --------------------------------------------------------------
function onDown(e) {
  var D = docOf();
  try { desk.cv.setPointerCapture(e.pointerId); } catch (er) { /* synthetic */ }
  if (e.button === 1 || e.button === 2 || desk.space || !D) {
    desk.drag = { pan: true, x: e.clientX, y: e.clientY, px: desk.px, py: desk.py };
    return;
  }
  var p = toDoc(e), s = BP.step, v = selView();
  if (desk.measOn) {
    if (!desk.meas || desk.meas.b) desk.meas = { a: p, b: null, h: p };
    else desk.meas.b = p;
    draw(); return;
  }
  if (s === 'scale') {
    var sc = BP.scale;
    if (sc && near(p, sc.a)) { desk.drag = { h: 'a' }; return; }
    if (sc && sc.b && near(p, sc.b)) { desk.drag = { h: 'b' }; return; }
    if (desk.pend) { BP.scale.b = p; desk.pend = null; save(); paintSide(); draw(); return; }
    BP.scale = { a: p, b: p, len: (sc && sc.len) || null, unit: (sc && sc.unit) || 'm' };
    desk.drag = { h: 'b', fresh: true, at: p };
    draw(); return;
  }
  if (s === 'views') {
    // a corner of the selected box
    if (v && v.shape === 'box') {
      for (var i = 0; i < 4; i++) if (near(p, v.pts[i])) {
        desk.drag = { corner: i, v: v, was: v.pts.map(function (q) { return q.slice(); }) };
        return;
      }
    }
    // inside a view: select it, and move it
    for (var j = BP.views.length - 1; j >= 0; j--) {
      var w = BP.views[j];
      if (inPoly(p, w.pts)) {
        BP.sel = w.id; paintSide();
        desk.drag = { move: w, at: p, pts: w.pts.map(function (q) { return q.slice(); }) };
        draw(); return;
      }
    }
    if (desk.tool === 'lasso') desk.drag = { lasso: [p] };
    else desk.drag = { box: p, to: p };
    draw(); return;
  }
  if (s === 'orient' && v) {
    var e2 = bpExt(v, D.d);
    if (desk.tool === 'level' || desk.tool === 'plumb') {
      if (!desk.pend) { desk.pend = { a: p, h: p }; draw(); return; }
      var a = bpFromOriented(v, desk.pend.a, D.d), b = bpFromOriented(v, p, D.d);
      desk.pend = null;
      v.rot = bpLevelRot(a, b, desk.tool === 'plumb' ? 'v' : 'h');
      desk.tool = null;
      reshaped(v); paintSide(); fit(); return;
    }
    // an edge of the extent
    var ed = extEdge(p, e2);
    if (ed >= 0) { desk.drag = { edge: ed, v: v }; return; }
    desk.drag = { pan: true, x: e.clientX, y: e.clientY, px: desk.px, py: desk.py };
    return;
  }
  if (s === 'ground' && v) {
    var g = v.ground;
    var ga = g && g.a && bpToOriented(v, g.a, D.d), gb = g && g.b && bpToOriented(v, g.b, D.d);
    if (ga && near(p, ga)) { desk.drag = { gnd: 'a', v: v }; return; }
    if (gb && near(p, gb)) { desk.drag = { gnd: 'b', v: v }; return; }
    if (desk.pend) {
      v.ground = { a: bpFromOriented(v, desk.pend.a, D.d), b: bpFromOriented(v, p, D.d) };
      desk.pend = null; save(); paintSide(); paintSteps(); draw(); return;
    }
    desk.pend = { a: p, h: p }; draw(); return;
  }
}
function extEdge(p, e) {
  var t = 7 / desk.zoom;
  var inY = p[1] > e[1] - t && p[1] < e[3] + t, inX = p[0] > e[0] - t && p[0] < e[2] + t;
  if (inY && Math.abs(p[0] - e[0]) < t) return 0;
  if (inX && Math.abs(p[1] - e[1]) < t) return 1;
  if (inY && Math.abs(p[0] - e[2]) < t) return 2;
  if (inX && Math.abs(p[1] - e[3]) < t) return 3;
  return -1;
}
function onMove(e) {
  var dr = desk.drag;
  if (dr && dr.pan) {
    desk.px = dr.px + e.clientX - dr.x; desk.py = dr.py + e.clientY - dr.y;
    draw(); return;
  }
  var p = toDoc(e);
  desk.hover = p;
  if (desk.meas && !desk.meas.b) { desk.meas.h = p; draw(); }
  if (desk.pend) { desk.pend.h = p; draw(); }
  if (BP.step === 'scale' && desk.pend && BP.scale) { BP.scale.b = p; draw(); }
  if (!dr) { cursor(p); return; }
  if (dr.h) { BP.scale[dr.h] = p; draw(); paintScaleOut(); return; }
  if (dr.corner != null) {
    var o = dr.v.pts[(dr.corner + 2) % 4];
    dr.v.pts = boxPts(o, p);
    // keep dragging the corner nearest the pointer
    for (var i = 0; i < 4; i++) if (dr.v.pts[i][0] === p[0] && dr.v.pts[i][1] === p[1]) dr.corner = i;
    draw(); return;
  }
  if (dr.move) {
    var dx = p[0] - dr.at[0], dy = p[1] - dr.at[1];
    dr.move.pts = dr.pts.map(function (q) { return [q[0] + dx, q[1] + dy]; });
    dr.moved = true; draw(); return;
  }
  if (dr.lasso) {
    var l = dr.lasso[dr.lasso.length - 1];
    if (Math.hypot(p[0] - l[0], p[1] - l[1]) * desk.zoom > 4) dr.lasso.push(p);
    draw(); return;
  }
  if (dr.box) { dr.to = p; draw(); return; }
  if (dr.edge != null) {
    var v = dr.v, e2 = bpExt(v).slice();
    e2[dr.edge] = p[dr.edge % 2];
    if (e2[2] - e2[0] > 2 && e2[3] - e2[1] > 2) { v.ext = e2; v.extAuto = false; }
    draw(); return;
  }
  if (dr.gnd) {
    var D = docOf();
    dr.v.ground[dr.gnd] = bpFromOriented(dr.v, p, D.d);
    draw(); paintGroundOut(); return;
  }
}
function onUp(e) {
  var dr = desk.drag;
  desk.drag = null;
  if (!dr) return;
  if (dr.h) {
    if (dr.fresh && near(BP.scale.a, BP.scale.b, 4)) { desk.pend = { scale: true }; return; }
    save(); paintSide(); paintSteps(); return;
  }
  if (dr.corner != null || dr.move) {
    var v = dr.v || dr.move;
    // a corner dragged onto its neighbour leaves no view: put it back
    var nb = dr.corner != null && bpBox(v.pts);
    if (dr.corner != null && (!nb || (nb[2] - nb[0]) * desk.zoom < 12 ||
        (nb[3] - nb[1]) * desk.zoom < 12)) v.pts = dr.was;
    if (dr.corner != null || dr.moved) reshaped(v);
    paintSide(); draw(); return;
  }
  if (dr.box) {
    var pts = boxPts(dr.box, dr.to), b = bpBox(pts);
    if (b && (b[2] - b[0]) * desk.zoom > 12 && (b[3] - b[1]) * desk.zoom > 12) {
      addView('box', pts); paintSide(); paintSteps();
    }
    draw(); return;
  }
  if (dr.lasso) {
    var bb = bpBox(dr.lasso);
    if (dr.lasso.length > 3 && bb && (bb[2] - bb[0]) * desk.zoom > 12) {
      addView('lasso', dr.lasso); paintSide(); paintSteps();
    }
    draw(); return;
  }
  if (dr.edge != null) { save(); paintSide(); return; }
  if (dr.gnd) { save(); paintSide(); return; }
}
function onWheel(e) {
  e.preventDefault();
  var r = desk.cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
  var f = Math.exp(-e.deltaY * 0.0015), z = Math.max(0.01, Math.min(40, desk.zoom * f));
  desk.px = mx - (mx - desk.px) * z / desk.zoom;
  desk.py = my - (my - desk.py) * z / desk.zoom;
  desk.zoom = z;
  draw();
}
function cursor(p) {
  var c = 'crosshair', v = selView(), D = docOf();
  if (desk.space) c = 'grab';
  else if (BP.step === 'views' && v) {
    if (v.shape === 'box' && v.pts.some(function (q) { return near(p, q); })) c = 'nwse-resize';
    else if (BP.views.some(function (w) { return inPoly(p, w.pts); })) c = 'move';
  } else if (BP.step === 'orient' && v && D && !desk.tool) {
    var ed = extEdge(p, bpExt(v, D.d));
    c = ed === 0 || ed === 2 ? 'ew-resize' : ed === 1 || ed === 3 ? 'ns-resize' : 'grab';
  }
  desk.cv.style.cursor = c;
}

// ---- drawing the stage ---------------------------------------------------------
var drawQ = 0;
function draw() {
  if (drawQ || !desk) return;
  drawQ = requestAnimationFrame(function () { drawQ = 0; paint(); });
}
function seg(x, a, b, col, w, dash) {
  var A = scr(a), B = scr(b);
  x.save(); x.strokeStyle = col; x.lineWidth = w || 2;
  if (dash) x.setLineDash(dash);
  x.beginPath(); x.moveTo(A[0], A[1]); x.lineTo(B[0], B[1]); x.stroke(); x.restore();
}
function dot(x, p, col) {
  var P = scr(p);
  x.save(); x.fillStyle = col; x.strokeStyle = '#000'; x.lineWidth = 1.5;
  x.beginPath(); x.arc(P[0], P[1], 5, 0, 7); x.fill(); x.stroke(); x.restore();
}
function tag(x, p, txt, col) {
  var P = scr(p);
  x.save(); x.font = '600 11px "IBM Plex Sans", sans-serif';
  var w = x.measureText(txt).width + 10;
  x.fillStyle = 'rgba(20,18,16,.85)'; x.fillRect(P[0], P[1] - 18, w, 17);
  x.fillStyle = col; x.fillText(txt, P[0] + 5, P[1] - 5); x.restore();
}
function fmtM(m) {
  if (m == null || !isFinite(m)) return '—';
  var ti = Math.round(m / 0.0254), ft = Math.floor(ti / 12);
  return m.toFixed(3) + ' m · ' + ft + '′ ' + (ti % 12) + '″';
}
function paint() {
  var x = desk.ctx, dpr = desk.dpr || 1, W = desk.cv.width, H = desk.cv.height;
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.fillStyle = '#141210'; x.fillRect(0, 0, W, H);
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  var D = docOf();
  desk.drop.hidden = !!IMG;
  if (!D) return;
  // the document
  x.save();
  x.imageSmoothingQuality = 'high';
  x.translate(desk.px, desk.py); x.scale(desk.zoom, desk.zoom);
  if (D.kind === 'view') {
    // a faint checker says where the view is transparent (outside the lasso)
    x.fillStyle = '#2a2622'; x.fillRect(0, 0, D.w, D.h);
  }
  x.drawImage(D.src, 0, 0, D.w, D.h);
  x.restore();
  var s = BP.step, v = selView(), m = bpMpp(BP.scale);
  if (D.kind === 'sheet') {
    // every view, in its colour
    BP.views.forEach(function (w) {
      var col = VCOL[w.kind] || '#fff', sel = v && w.id === v.id;
      x.save(); x.strokeStyle = col; x.lineWidth = sel ? 2.5 : 1.5;
      if (!sel) x.setLineDash([6, 4]);
      x.fillStyle = sel ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,0)';
      x.beginPath();
      w.pts.forEach(function (q, i) { var P = scr(q); if (i) x.lineTo(P[0], P[1]); else x.moveTo(P[0], P[1]); });
      x.closePath(); x.fill(); x.stroke(); x.restore();
      // the name at the view's topmost point (a lasso's box corner can be
      // far from anything it holds)
      var tp = w.pts[0];
      w.pts.forEach(function (q) { if (q[1] < tp[1]) tp = q; });
      tag(x, tp, viewName(w), col);
      if (sel && s === 'views' && w.shape === 'box') w.pts.forEach(function (q) { dot(x, q, col); });
    });
    var dr = desk.drag;
    if (dr && dr.box) {
      var bp2 = boxPts(dr.box, dr.to);
      for (var i = 0; i < 4; i++) seg(x, bp2[i], bp2[(i + 1) % 4], '#fff', 1.5, [5, 4]);
    }
    if (dr && dr.lasso) for (var j = 1; j < dr.lasso.length; j++)
      seg(x, dr.lasso[j - 1], dr.lasso[j], '#fff', 1.5);
    // the scale bar
    var sc = BP.scale;
    if (sc && sc.a && (s === 'scale' || m)) {
      var col2 = s === 'scale' ? '#ff5a48' : 'rgba(255,90,72,.5)';
      if (sc.b) seg(x, sc.a, sc.b, col2, s === 'scale' ? 2.5 : 1.5);
      if (s === 'scale') { dot(x, sc.a, col2); if (sc.b) dot(x, sc.b, col2); }
      if (sc.b && sc.len) tag(x, [(sc.a[0] + sc.b[0]) / 2, (sc.a[1] + sc.b[1]) / 2],
        sc.len + ' ' + (sc.unit || 'm'), col2);
    }
  } else {
    var d = D.d, e2 = bpExt(v, d), col3 = VCOL[v.kind] || '#fff';
    // the extent: what registers this view against the others
    x.save(); x.strokeStyle = col3; x.lineWidth = 1.5; x.setLineDash([7, 5]);
    var A = scr([e2[0], e2[1]]), B = scr([e2[2], e2[3]]);
    x.strokeRect(A[0], A[1], B[0] - A[0], B[1] - A[1]); x.restore();
    tag(x, [e2[0], e2[1]], 'extent' + (v.extAuto ? ' (auto)' : ''), col3);
    // the orientation guides
    if (s === 'orient') {
      x.save(); x.strokeStyle = 'rgba(255,255,255,.12)'; x.lineWidth = 1;
      var step = Math.max(20, Math.round(Math.max(d.W, d.H) / 16));
      for (var gx = 0; gx <= d.W; gx += step) { var P1 = scr([gx, 0]), P2 = scr([gx, d.H]); x.beginPath(); x.moveTo(P1[0], P1[1]); x.lineTo(P2[0], P2[1]); x.stroke(); }
      for (var gy = 0; gy <= d.H; gy += step) { var Q1 = scr([0, gy]), Q2 = scr([d.W, gy]); x.beginPath(); x.moveTo(Q1[0], Q1[1]); x.lineTo(Q2[0], Q2[1]); x.stroke(); }
      x.restore();
      var hint = { side: '◀ nose to the left · wheels down', top: '◀ nose to the left · seen from above',
                   front: 'seen from ahead · wheels down', rear: 'seen from behind · wheels down',
                   other: 'as it should stand' }[v.kind];
      tag(x, [0, d.H + 26 / desk.zoom], hint, '#e6dbc9');
    }
    // the ground line, extended across the view
    var g = v.ground;
    if (s === 'ground' || g) {
      var ga = g && g.a && bpToOriented(v, g.a, d), gb = g && g.b && bpToOriented(v, g.b, d);
      if (ga && gb) {
        var dx = gb[0] - ga[0], dy = gb[1] - ga[1], L = Math.hypot(dx, dy) || 1;
        var far = Math.max(d.W, d.H) * 2;
        seg(x, [ga[0] - dx / L * far, ga[1] - dy / L * far], [ga[0] + dx / L * far, ga[1] + dy / L * far],
            s === 'ground' ? '#ff5a48' : 'rgba(255,90,72,.45)', 2);
        if (s === 'ground') { dot(x, ga, '#ff5a48'); dot(x, gb, '#ff5a48'); }
      }
    }
    if (desk.pend && desk.pend.a) {
      seg(x, desk.pend.a, desk.pend.h, '#ff5a48', 2, [6, 4]);
      dot(x, desk.pend.a, '#ff5a48');
    }
  }
  // the measure
  var ms = desk.meas;
  if (ms && ms.a) {
    var b2 = ms.b || ms.h;
    seg(x, ms.a, b2, '#5ad2ff', 2); dot(x, ms.a, '#5ad2ff'); dot(x, b2, '#5ad2ff');
    var px = Math.hypot(b2[0] - ms.a[0], b2[1] - ms.a[1]);
    tag(x, [(ms.a[0] + b2[0]) / 2, (ms.a[1] + b2[1]) / 2],
        m ? fmtM(px * m) : Math.round(px) + ' px (no scale yet)', '#5ad2ff');
  }
}

// ---- the side bar -----------------------------------------------------------
// It uses the editor's own row grammar (div.r > span.k + control), and the
// desk lives inside #wsUI, so the sliders, toggles and selects wear the
// column's look without a line restated.
function rowEl(host, label, title) {
  var d = E('div', 'r');
  var k = E('span', 'k', label);
  if (title) { d.title = title; k.title = title; }
  d.appendChild(k); host.appendChild(d);
  return d;
}
function numIn(host, get, set, w) {
  var i = E('input', 'bpNum'); i.type = 'text'; i.value = get();
  if (w) i.style.width = w;
  i.onchange = function () { var n = parseFloat(i.value); if (isFinite(n)) set(n); i.value = get(); };
  host.appendChild(i);
  return i;
}
function selIn(host, opts, get, set) {
  var s = E('select');
  opts.forEach(function (o) {
    var op = E('option', null, o[1]); op.value = o[0]; s.appendChild(op);
  });
  s.value = get();
  s.onchange = function () { set(s.value); };
  host.appendChild(s);
  return s;
}
function chk(host, get, set) {
  var c = E('input'); c.type = 'checkbox'; c.checked = !!get();
  c.onchange = function () { set(c.checked); };
  host.appendChild(c);
  return c;
}
function para(host, txt, cls) { var p = E('p', cls || 'bpHelp', txt); host.appendChild(p); return p; }
function sideHead(host, txt, meta) {
  var h = E('div', 'bpH'); h.appendChild(E('span', null, txt));
  if (meta) h.appendChild(E('em', null, meta));
  host.appendChild(h); return h;
}
// the view chips, for the steps that work on one view at a time
function chips(host, filter) {
  var c = E('div', 'bpChips');
  BP.views.forEach(function (w) {
    if (filter && !filter(w)) return;
    var b = E('button', 'bpChip' + (selView() && selView().id === w.id ? ' on' : ''), viewName(w));
    b.type = 'button';
    b.style.borderColor = VCOL[w.kind];
    b.onclick = function () { BP.sel = w.id; save(); prevCache = null; paintSide(); fit(); };
    c.appendChild(b);
  });
  host.appendChild(c);
}

var scaleOutEl = null, groundOutEl = null;
function paintScaleOut() {
  if (!scaleOutEl) return;
  var m = bpMpp(BP.scale), sc = BP.scale;
  if (!sc || !sc.b) { scaleOutEl.textContent = 'Click the two ends of a length you know.'; return; }
  var px = Math.hypot(sc.b[0] - sc.a[0], sc.b[1] - sc.a[1]);
  scaleOutEl.textContent = m
    ? '1 px = ' + (m * 1000).toFixed(2) + ' mm · the sheet is ' + (BP.sheet.w * m).toFixed(2) +
      ' × ' + (BP.sheet.h * m).toFixed(2) + ' m'
    : Math.round(px) + ' px between the points — now type the real length';
}
function paintGroundOut() {
  if (!groundOutEl) return;
  var L = bpLayout(BP), v = selView();
  if (!v) { groundOutEl.textContent = ''; return; }
  if (v.kind === 'side') {
    groundOutEl.textContent = !v.ground ? 'No ground line: the lowest point of the drawing stands on the floor, datum level.'
      : 'Ground attitude ' + Math.abs(L.groundPitch).toFixed(1) + '° ' +
        (L.groundPitch >= 0 ? 'nose-up' : 'nose-down') +
        (L.gA ? ' · tyres ' + Math.abs(L.gB[0] - L.gA[0]).toFixed(2) + ' m apart' : '');
  } else groundOutEl.textContent = v.ground
    ? 'This view\'s ground line puts its wheels on the side view\'s.'
    : 'No ground line: the bottom of its extent stands on the wheels.';
}

function paintSide() {
  var S = desk.side;
  S.textContent = '';
  scaleOutEl = groundOutEl = null;
  var s = BP.step, v = selView();
  if (!IMG) {
    sideHead(S, 'the sheet');
    para(S, 'A blueprint is one image — a three-view on one sheet is the base case. ' +
      'Load it, drop it on the stage, or paste it (Ctrl+V).');
    var b0 = E('div', 'bpBtns'); btn(b0, 'load image', pickFile); S.appendChild(b0);
    return;
  }
  var sh = E('div', 'bpSheet', BP.sheet.name + ' · ' + BP.sheet.w + ' × ' + BP.sheet.h + ' px');
  S.appendChild(sh);

  if (s === 'scale') {
    sideHead(S, 'scale the sheet', 'one scale for every view');
    para(S, 'Click the two ends of something whose length you know — a scale bar, the span, ' +
      'the overall length — then type that length. Drag a point to refine it; zoom in with the wheel.');
    var r = rowEl(S, 'real length');
    numIn(r, function () { return BP.scale && BP.scale.len ? BP.scale.len : ''; },
      function (n) { if (!BP.scale) return; BP.scale.len = n > 0 ? n : null; save(); paintScaleOut(); paintSteps(); draw(); }, '80px');
    selIn(r, UNITS.map(function (u) { return [u[0], u[0]]; }),
      function () { return (BP.scale && BP.scale.unit) || 'm'; },
      function (u) { if (!BP.scale) BP.scale = { a: null, b: null, len: null, unit: u }; BP.scale.unit = u; save(); paintScaleOut(); draw(); });
    scaleOutEl = para(S, '', 'bpOut');
    paintScaleOut();
    var nb = E('div', 'bpBtns'); btn(nb, 'next: views', function () { setStep('views'); }); S.appendChild(nb);
    return;
  }
  if (s === 'views') {
    sideHead(S, 'cut the views', 'box or lasso');
    para(S, 'Drag a box around each view — or draw round it with the lasso when a label or a ' +
      'dimension line crowds it. Name each one. Drag a view to move it, a corner to resize it; Delete removes it.');
    var tb = E('div', 'bpBtns');
    var bx = btn(tb, 'box', function () { desk.tool = 'box'; paintSide(); }, 'Drag a rectangle');
    var ls = btn(tb, 'lasso', function () { desk.tool = 'lasso'; paintSide(); }, 'Draw round the view, freehand');
    bx.classList.toggle('on', desk.tool !== 'lasso'); ls.classList.toggle('on', desk.tool === 'lasso');
    S.appendChild(tb);
    BP.views.forEach(function (w) {
      var card = E('div', 'bpView' + (v && v.id === w.id ? ' on' : ''));
      card.style.borderLeftColor = VCOL[w.kind];
      card.onclick = function (e) {
        if (e.target.closest('select,input,button')) return;
        BP.sel = w.id; save(); paintSide(); draw();
      };
      var r1 = rowEl(card, 'view');
      selIn(r1, KINDS.map(function (k) { return [k, k]; }), function () { return w.kind; },
        function (k) {
          if (w.label === w.kind) w.label = k;
          w.kind = k; save(); paintSide(); paintSteps(); draw();
        });
      var del = E('button', 'bpX', '×'); del.type = 'button'; del.title = 'Delete this view';
      del.onclick = function () { delView(w.id); paintSide(); paintSteps(); draw(); };
      r1.appendChild(del);
      var r2 = rowEl(card, 'label');
      var li = E('input', 'bpText'); li.type = 'text'; li.value = w.label || '';
      li.placeholder = w.kind;
      li.onchange = function () { w.label = li.value.trim() || w.kind; save(); draw(); };
      r2.appendChild(li);
      if (w.kind === 'other') {
        var r3 = rowEl(card, 'faces', 'Which way this view stands in 3D');
        selIn(r3, FACINGS.map(function (f) { return [f, 'like a ' + f + ' view']; }),
          function () { return w.faces || 'side'; }, function (f) { w.faces = f; save(); });
      }
      var b = bpBox(w.pts), m = bpMpp(BP.scale);
      if (b && m) card.appendChild(E('div', 'bpMeta', ((b[2] - b[0]) * m).toFixed(2) + ' × ' +
        ((b[3] - b[1]) * m).toFixed(2) + ' m cut · ' + w.shape));
      S.appendChild(card);
    });
    if (!BP.views.length) para(S, 'No views yet.', 'bpOut');
    var nb2 = E('div', 'bpBtns'); btn(nb2, 'next: orient', function () { setStep('orient'); }); S.appendChild(nb2);
    return;
  }
  if (s === 'orient') {
    sideHead(S, 'orient each view', 'rotate · mirror · extent');
    if (!v) { para(S, 'Cut a view first.', 'bpOut'); return; }
    chips(S);
    para(S, {
      side: 'The side view stands with its NOSE TO THE LEFT and its wheels down.',
      top: 'The top view lies with its NOSE TO THE LEFT, seen from above.',
      front: 'The front view is seen from ahead, wheels down.',
      rear: 'The rear view is seen from behind, wheels down.',
      other: 'Stand it the way it should hang.' }[v.kind] +
      ' A view drawn at an angle: press LEVEL and click two points along a line that should be horizontal.');
    var r = rowEl(S, 'rotation');
    var rg = E('input'); rg.type = 'range'; rg.min = -180; rg.max = 180; rg.step = 0.1; rg.value = v.rot || 0;
    var ni = numIn(r, function () { return (+(v.rot || 0)).toFixed(1); }, function (n) {
      v.rot = bpNormDeg(n); rg.value = v.rot; reshaped(v); fit(); }, '52px');
    rg.oninput = function () { v.rot = +rg.value; ni.value = v.rot.toFixed(1); prevCache = null; draw(); };
    rg.onchange = function () { reshaped(v); fit(); };
    r.insertBefore(rg, ni);
    var rb = E('div', 'bpBtns');
    [[-90, '−90°'], [-45, '−45°'], [45, '+45°'], [90, '+90°']].forEach(function (q) {
      btn(rb, q[1], function () { v.rot = bpNormDeg((v.rot || 0) + q[0]); reshaped(v); paintSide(); fit(); });
    });
    btn(rb, '0°', function () { v.rot = 0; reshaped(v); paintSide(); fit(); });
    S.appendChild(rb);
    var lb = E('div', 'bpBtns');
    var lv = btn(lb, 'level', function () { desk.tool = desk.tool === 'level' ? null : 'level'; desk.pend = null; paintSide(); },
      'Click two points along a line that should be HORIZONTAL (a datum, a wing chord line)');
    var pl = btn(lb, 'plumb', function () { desk.tool = desk.tool === 'plumb' ? null : 'plumb'; desk.pend = null; paintSide(); },
      'Click two points along a line that should be VERTICAL');
    lv.classList.toggle('on', desk.tool === 'level'); pl.classList.toggle('on', desk.tool === 'plumb');
    S.appendChild(lb);
    var r4 = rowEl(S, 'mirror left / right');
    chk(r4, function () { return v.flipH; }, function (c) { v.flipH = c; reshaped(v); draw(); });
    var r5 = rowEl(S, 'mirror up / down');
    chk(r5, function () { return v.flipV; }, function (c) { v.flipV = c; reshaped(v); draw(); });
    sideHead(S, 'extent', 'what lines the views up');
    para(S, 'The dashed box is the aeroplane\'s outline: nose to tail, tip to tip, top to wheels. ' +
      'It is trimmed off the ink automatically — drag an edge onto the nose or a tip when a ' +
      'ground line or a note has stretched it.');
    var eb = E('div', 'bpBtns');
    btn(eb, 'auto extent', function () { v.extAuto = true; autoExt(v); save(); paintSide(); draw(); },
      'Trim the box to the ink again');
    btn(eb, 'whole cut', function () { v.ext = null; v.extAuto = false; save(); paintSide(); draw(); },
      'Use the whole cut as the extent');
    S.appendChild(eb);
    var m2 = bpMpp(BP.scale), e2 = bpExt(v);
    if (m2) para(S, 'extent ' + ((e2[2] - e2[0]) * m2).toFixed(2) + ' × ' + ((e2[3] - e2[1]) * m2).toFixed(2) + ' m', 'bpOut');
    var nb3 = E('div', 'bpBtns'); btn(nb3, 'next: ground', function () { setStep('ground'); }); S.appendChild(nb3);
    return;
  }
  if (s === 'ground') {
    sideHead(S, 'the ground line', 'where the tyres touch');
    var gv = function (w) { return w.kind !== 'top'; };
    if (v && !gv(v)) { var f = BP.views.filter(gv)[0]; if (f) { BP.sel = f.id; v = f; prevCache = null; } }
    if (!v || !gv(v)) { para(S, 'Cut a side view first.', 'bpOut'); return; }
    chips(S, gv);
    para(S, v.kind === 'side'
      ? 'Click where the MAIN tyre touches the ground, then where the TAIL (or nose) tyre does. ' +
        'On a taildragger drawn level, this is what stands it nose-up on its wheels, the way your build stands.'
      : 'Click the bottom of the tyres (two points, left and right). It sets how high this view hangs.');
    groundOutEl = para(S, '', 'bpOut');
    paintGroundOut();
    var gb = E('div', 'bpBtns');
    btn(gb, 'clear line', function () { v.ground = null; save(); paintSide(); paintSteps(); draw(); });
    S.appendChild(gb);
    var nb4 = E('div', 'bpBtns');
    btn(nb4, 'place in 3D', function () { setStep('place'); }, 'Pin the views up in the shed', 'go');
    S.appendChild(nb4);
    return;
  }
}

// ===========================================================================
// THE PANEL SECTION — what the reference plane's BLUEPRINT tab shows. Built
// with refplane.js's row helpers (REFPLANE.ui) so both sources read alike.
// ===========================================================================
var panelEl = null;
function repaintPanel() {
  if (!panelEl) return;
  var U = window.REFPLANE && window.REFPLANE.ui;
  if (!U) return;
  panelEl.textContent = '';
  fillPanel(panelEl, U);
  // the Blueprint heading and the tree row say what is pinned up
  if (window.REFPLANE && window.REFPLANE.showSource) window.REFPLANE.showSource();
}
function onRig() { save(); sync3D(); }
function fold(U, host, key, title, meta, dflt) {
  return U.fold(host, title, meta, key in folds ? folds[key] : dflt, function (open) {
    folds[key] = open;
    try { localStorage.setItem(LS_FOLD, JSON.stringify(folds)); } catch (e) {}
  });
}
function fillPanel(host, U) {
  if (!booted) {
    U.note(host, 'Opening the blueprint…');
    boot();
    return;
  }
  if (!IMG) {
    U.note(host, 'No blueprint pinned up. Load a three-view drawing and cut it into views: ' +
      'scale, views, orientation, ground line — then it stands in 3D around your build.');
    var b = U.pills(host);
    U.pill(b, 'open the blueprint desk', function () { openDesk('scale'); },
      'The 2D desk: load the sheet and prepare its views');
    return;
  }
  var L = bpLayout(BP);
  var top = U.pills(host);
  U.pill(top, 'open the desk', function () { openDesk(); }, 'Scale, views, orientation, ground line');
  if (L.ok && BP.views.length && !BP.rig.placed)
    U.pill(top, 'place in 3D', function () { place3D(); }, 'Pin the views up in the shed');
  var m = L.mpp;
  U.note(host, BP.sheet.name + (m ? ' · 1 px = ' + (m * 1000).toFixed(1) + ' mm' : ' · not scaled yet') +
    ' · ' + BP.views.length + ' view' + (BP.views.length === 1 ? '' : 's') +
    (L.len ? ' · ' + L.len.toFixed(2) + ' m long' : '') + (L.span ? ' · ' + L.span.toFixed(2) + ' m span' : ''));
  if (!L.ok || !BP.views.length || !BP.rig.placed) return;
  var R = BP.rig;
  U.check(host, 'show', function () { return BP.on; }, function (c) { BP.on = c; onRig(); },
    'Show the blueprint in the shed');

  var pl = fold(U, host, 'place', 'placement', 'metres, the whole set', true);
  U.slider(pl, { label: 'fore / aft', lo: -8, hi: 8, step: 0.01, dflt: 0,
    get: function () { return R.fore; }, set: function (v) { R.fore = v; onRig(); },
    fmt: function (v) { return v.toFixed(2) + ' m'; } });
  U.slider(pl, { label: 'lateral', lo: -6, hi: 6, step: 0.01, dflt: 0,
    get: function () { return R.lat; }, set: function (v) { R.lat = v; onRig(); },
    fmt: function (v) { return v.toFixed(2) + ' m'; } });
  U.slider(pl, { label: 'up / down', lo: -1, hi: 1, step: 0.005, dflt: 0,
    get: function () { return R.up; }, set: function (v) { R.up = v; onRig(); },
    fmt: function (v) { return v.toFixed(3) + ' m'; } });
  U.select(pl, 'attitude', [['ground', 'on its ground line · ' + L.groundPitch.toFixed(1) + '°'],
    ['level', 'datum level']], function () { return R.attitude; },
    function (v) { R.attitude = v; onRig(); repaintPanel(); },
    'Stand it the way it parks (the ground line), or with the drawing\'s own datum level');
  U.slider(pl, { label: 'pitch trim', lo: -15, hi: 15, step: 0.1, dflt: 0,
    get: function () { return R.pitch; }, set: function (v) { R.pitch = v; onRig(); },
    fmt: function (v) { return v.toFixed(1) + '°'; } });
  U.slider(pl, { label: 'yaw', lo: -180, hi: 180, step: 1, dflt: 0,
    get: function () { return R.yaw; }, set: function (v) { R.yaw = v; onRig(); },
    fmt: function (v) { return v.toFixed(0) + '°'; } });
  var pb = U.pills(pl);
  U.pill(pb, 'snap to nose', function () { snapNose(); repaintPanel(); },
    'Line the blueprint\'s nose up with your build\'s');
  U.pill(pb, 'reset', function () {
    R.lat = 0; R.up = 0; R.pitch = 0; R.yaw = 0; snapNose(true); repaintPanel();
  }, 'Back to the automatic placement');

  var lk = fold(U, host, 'look', 'look', 'transparency', true);
  U.slider(lk, { label: 'opacity', lo: 0, hi: 1, step: 0.05, dflt: 0.85,
    get: function () { return R.alpha; }, set: function (v) { R.alpha = v; onRig(); },
    fmt: function (v) { return v.toFixed(2); } });
  U.check(lk, 'over the build', function () { return R.over; },
    function (c) { R.over = c; onRig(); },
    'Draw the linework through everything, the build included — for tracing');

  BP.views.forEach(function (v) {
    var lv = null;
    for (var i = 0; i < L.views.length; i++) if (L.views[i].id === v.id) lv = L.views[i];
    var f = fold(U, host, 'v' + v.id, viewName(v),
      lv ? lv.wM.toFixed(2) + ' × ' + lv.hM.toFixed(2) + ' m' : '', false);
    U.check(f, 'show', function () { return v.on; }, function (c) { v.on = c; onRig(); });
    U.slider(f, { label: 'opacity', lo: 0, hi: 1, step: 0.05, dflt: 1,
      get: function () { return v.alpha; }, set: function (x) { v.alpha = x; onRig(); },
      fmt: function (x) { return x.toFixed(2); } });
    U.select(f, 'paper', [['keep', 'keep the paper'], ['clear', 'clear · lines only']],
      function () { return v.paper; }, function (x) { v.paper = x; onRig(); repaintPanel(); },
      'Clear turns the sheet\'s own paper colour transparent, so only the linework hangs in the air');
    if (v.paper === 'clear') {
      U.slider(f, { label: 'clear level', lo: 0.03, hi: 0.4, step: 0.01, dflt: 0.12, commit: true,
        get: function () { return v.cut; }, set: function (x) { v.cut = x; onRig(); },
        fmt: function (x) { return x.toFixed(2); },
        title: 'How different from the paper a pixel has to be to stay — raise it for a yellowed scan' });
      U.select(f, 'ink', [['drawn', 'as drawn'], ['white', 'white'], ['amber', 'amber'],
        ['cyan', 'cyan'], ['red', 'red'], ['black', 'black']],
        function () { return v.ink; }, function (x) { v.ink = x; onRig(); },
        'Re-ink the lines in a colour that reads against the build and the shed');
    }
    U.slider(f, { label: 'fore / aft', lo: -3, hi: 3, step: 0.005, dflt: 0,
      get: function () { return v.dx; }, set: function (x) { v.dx = x; onRig(); },
      fmt: function (x) { return x.toFixed(3) + ' m'; } });
    U.slider(f, { label: 'up / down', lo: -3, hi: 3, step: 0.005, dflt: 0,
      get: function () { return v.dy; }, set: function (x) { v.dy = x; onRig(); },
      fmt: function (x) { return x.toFixed(3) + ' m'; } });
    U.slider(f, { label: 'lateral', lo: -6, hi: 6, step: 0.005, dflt: 0,
      get: function () { return v.dz; }, set: function (x) { v.dz = x; onRig(); },
      fmt: function (x) { return x.toFixed(3) + ' m'; } });
    U.slider(f, { label: 'turn', lo: -180, hi: 180, step: 0.1, dflt: 0,
      get: function () { return v.spin; }, set: function (x) { v.spin = x; onRig(); },
      fmt: function (x) { return x.toFixed(1) + '°'; },
      title: 'Turn the view in its own plane, about its centre' });
    U.slider(f, { label: 'size', lo: 0.8, hi: 1.25, step: 0.001, dflt: 1,
      get: function () { return v.size; }, set: function (x) { v.size = x; onRig(); },
      fmt: function (x) { return '×' + x.toFixed(3); },
      title: 'A view drawn at its own scale on the sheet — detail views often are' });
  });
  var fb = U.pills(host);
  U.pill(fb, 'take the blueprint down', clearAll, 'Delete the sheet and its views');
}

window.BLUEPRINT = {
  boot: function () { boot(); },
  open: openDesk,
  panel: function () {
    if (!panelEl) { panelEl = E('div', 'bpPanel'); }
    repaintPanel();
    return panelEl;
  },
  refresh: function () { sync3D(); },
  badge: function () {
    return IMG && BP.rig.placed ? BP.views.length + ' view' + (BP.views.length === 1 ? '' : 's') : '';
  },
  // the Blueprint heading's meta line
  summary: function () {
    if (!IMG || !BP.sheet) return 'none pinned up';
    return BP.sheet.name + ' · ' + BP.views.length + ' view' +
      (BP.views.length === 1 ? '' : 's') + (BP.rig.placed ? '' : ' · not placed');
  },
  standing: function () { return !!(IMG && BP.rig.placed && BP.on); },
  layout: function () { return bpLayout(BP); },
  state: function () { return BP; },
  // for the screenshot rig and the console: load a File, and where a
  // document point is on screen (to drive the desk with pointer events)
  _load: loadFile,
  _toClient: function (p) {
    if (!desk) return null;
    var r = desk.cv.getBoundingClientRect(), q = scr(p);
    return [q[0] + r.left, q[1] + r.top];
  },
};

})();
