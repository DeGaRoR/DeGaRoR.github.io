// dt_core.js - THE DRAFTING TABLE'S PURE HALF: views, the parted outline, the key measurements, the comparison.
// No THREE, no DOM, no garage: arrays in, numbers out. The page, its worker and the node CLI all run this same file.
// Design: tools/DRAFTING_TABLE.md.
//
// FRAMES
//   table frame (metres): a = aft of the spinner's tip, h = above the thrust line, s = to starboard
//   view frame (metres):  side  X = a, Y = h      top  X = a, Y = s      front  X = s, Y = h
//   sheet pixels:         the blueprint image as loaded, x right, y down
// A VIEW on the sheet maps view metres to sheet pixels: px = o + R(rot) . diag(k, -k) . (X, Y)
//   o = the sheet pixel of the view's origin (the spinner's tip; for the front view, the hub), k = pixels a metre,
//   rot = 0 / 90 / 180 / 270 degrees (the drawing's own turn of that view), flip = mirror across the view's X axis.
(function (root) {
  'use strict';
  const VIEWS = ['side', 'top', 'front'];
  // PRIORITY when two parts meet at a pixel edge: the line belongs to the higher (glass and seams over skin)
  const PARTS = ['none', 'body', 'glass', 'pillar', 'waist', 'wing', 'strut', 'fin', 'stab', 'cowl', 'engine',
    'gear', 'float', 'other'];
  const PID = {}; PARTS.forEach((p, i) => { PID[p] = i; });
  const COLOURS = { body: '#1f6feb', glass: '#e8590c', pillar: '#7048e8', waist: '#7048e8', wing: '#0ca678',
    strut: '#0ca678', fin: '#d6336c', stab: '#d6336c', cowl: '#f59f00', engine: '#f59f00', gear: '#495057',
    float: '#1098ad', other: '#868e96' };
  // which parts make up "the fuselage" for profiles
  const FUSE = new Set([PID.body, PID.glass, PID.pillar, PID.waist, PID.cowl]);

  // ---- view mapping -------------------------------------------------------------------------------------------
  function proj(view, a, h, s) {         // table frame -> view metres, plus depth (bigger = nearer the eye)
    if (view === 'side') return [a, h, s];          // seen from starboard
    if (view === 'top') return [a, s, h];           // seen from above
    return [s, h, -a];                               // front: seen from ahead
  }
  function rotM(rot, flip) {
    const r = ((rot || 0) % 360 + 360) % 360;
    const c = Math.round(Math.cos(r * Math.PI / 180)), sn = Math.round(Math.sin(r * Math.PI / 180));
    const f = flip ? -1 : 1;
    // screen: X right, Y up -> pixels y down; then the drawing's turn (clockwise on screen)
    return [c, -sn * f, sn, c * f];   // applied to (X, -Y)
  }
  function toPx(V, X, Y) {
    const M = rotM(V.rot, V.flip), k = V.k, x = X * k, y = -Y * k;
    return [V.ox + M[0] * x + M[1] * y, V.oy + M[2] * x + M[3] * y];
  }
  function fromPx(V, px, py) {
    const M = rotM(V.rot, V.flip), k = V.k, dx = px - V.ox, dy = py - V.oy;
    const det = M[0] * M[3] - M[1] * M[2];
    const x = (M[3] * dx - M[1] * dy) / det, y = (-M[2] * dx + M[0] * dy) / det;
    return [x / k, -y / k];
  }

  // ---- the raster: the plane's parts drawn into a view's pixel grid, front-most part a pixel ------------------
  // V: the view (ox, oy, k, rot, flip); W x H the grid; x0, y0 the grid's top-left in sheet pixels
  function raster(view, tris, parts, V, W, H, x0, y0) {
    x0 = x0 || 0; y0 = y0 || 0;
    const id = new Uint8Array(W * H), zb = new Float32Array(W * H).fill(-1e9);
    const nT = parts.length, P = new Float32Array(9);
    for (let t = 0; t < nT; t++) {
      for (let e = 0; e < 3; e++) {
        const o = t * 9 + e * 3;
        const q = proj(view, tris[o], tris[o + 1], tris[o + 2]);
        const p = toPx(V, q[0], q[1]);
        P[e * 3] = p[0] - x0; P[e * 3 + 1] = p[1] - y0; P[e * 3 + 2] = q[2];
      }
      fillTri(P, parts[t], id, zb, W, H);
    }
    return id;
  }
  function fillTri(P, pid, id, zb, W, H) {
    const ax = P[0], ay = P[1], bx = P[3], by = P[4], cx = P[6], cy = P[7];
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 1e-9) {          // edge-on: still a line on the drawing (a thin strut, a fin seen ahead)
      drawSeg(ax, ay, bx, by, P[2], P[5], pid, id, zb, W, H);
      drawSeg(bx, by, cx, cy, P[5], P[8], pid, id, zb, W, H);
      return;
    }
    let minX = Math.max(0, Math.floor(Math.min(ax, bx, cx))), maxX = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
    let minY = Math.max(0, Math.floor(Math.min(ay, by, cy))), maxY = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
    if (minX > maxX || minY > maxY) return;
    // tiny triangles (smaller than a pixel): one sample at their centre, so thin parts never vanish
    if (maxX - minX <= 1 && maxY - minY <= 1) {
      const x = Math.round((ax + bx + cx) / 3), y = Math.round((ay + by + cy) / 3);
      if (x >= 0 && y >= 0 && x < W && y < H) { const z = (P[2] + P[5] + P[8]) / 3, i = y * W + x; if (z > zb[i]) { zb[i] = z; id[i] = pid; } }
      return;
    }
    const inv = 1 / area;
    for (let y = minY; y <= maxY; y++) {
      const py = y + 0.5;
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) * inv;
        const w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) * inv;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        const z = w0 * P[2] + w1 * P[5] + w2 * P[8], i = y * W + x;
        if (z > zb[i]) { zb[i] = z; id[i] = pid; }
      }
    }
  }
  function drawSeg(ax, ay, bx, by, za, zb0, pid, id, zb, W, H) {
    const n = Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))) + 1;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = Math.floor(ax + (bx - ax) * t), y = Math.floor(ay + (by - ay) * t);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const z = za + (zb0 - za) * t, k = y * W + x;
      if (z > zb[k]) { zb[k] = z; id[k] = pid; }
    }
  }
  // the outline: every pixel whose right or lower neighbour is another part (or empty) carries the line of the
  // higher-priority of the two (an edge against the empty sheet is the part's own)
  function edges(id, W, H) {
    const out = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, a = id[i];
      const r = x + 1 < W ? id[i + 1] : 0, d = y + 1 < H ? id[i + W] : 0;
      const l = x > 0 ? id[i - 1] : 0, u = y > 0 ? id[i - W] : 0;
      if (a && (a !== r || a !== d || a !== l || a !== u)) {
        const other = a !== r ? r : a !== d ? d : a !== l ? l : u;
        out[i] = other && other > a ? other : a;
      }
    }
    return out;
  }

  // ---- slices: the precise measurements, off the triangles -----------------------------------------------------
  // the triangles of a part set cut by the plane axis = value: the [min, max] of each other axis over the cut
  // axis: 0 a, 1 h, 2 s
  function slice(tris, parts, set, axis, value) {
    const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; let n = 0;
    const nT = parts.length;
    for (let t = 0; t < nT; t++) {
      if (!set.has(parts[t])) continue;
      const o = t * 9;
      for (let e = 0; e < 3; e++) {
        const p = o + e * 3, q = o + ((e + 1) % 3) * 3;
        const va = tris[p + axis] - value, vb = tris[q + axis] - value;
        if ((va < 0 && vb < 0) || (va > 0 && vb > 0)) continue;
        const f = va === vb ? 0 : va / (va - vb);
        for (let k = 0; k < 3; k++) {
          const c = tris[p + k] + (tris[q + k] - tris[p + k]) * f;
          if (c < lo[k]) lo[k] = c; if (c > hi[k]) hi[k] = c;
        }
        n++;
      }
    }
    return n ? { lo, hi } : null;
  }
  function extent(tris, parts, set, filt) {
    const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; let n = 0;
    for (let t = 0; t < parts.length; t++) {
      if (!set.has(parts[t])) continue;
      for (let e = 0; e < 3; e++) {
        const o = t * 9 + e * 3, a = tris[o], h = tris[o + 1], s = tris[o + 2];
        if (filt && !filt(a, h, s)) continue;
        if (a < lo[0]) lo[0] = a; if (a > hi[0]) hi[0] = a;
        if (h < lo[1]) lo[1] = h; if (h > hi[1]) hi[1] = h;
        if (s < lo[2]) lo[2] = s; if (s > hi[2]) hi[2] = s;
        n++;
      }
    }
    return n ? { lo, hi } : null;
  }
  // connected components of one part in a raster: their boxes in pixels
  function components(id, W, H, pid, minPx) {
    const seen = new Uint8Array(W * H), out = [], st = [];
    for (let i = 0; i < W * H; i++) {
      if (id[i] !== pid || seen[i]) continue;
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0; st.length = 0; st.push(i); seen[i] = 1;
      while (st.length) {
        const j = st.pop(), x = j % W, y = (j - x) / W; n++;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (const k of [j - 1, j + 1, j - W, j + W]) {
          if (k < 0 || k >= W * H || seen[k] || id[k] !== pid) continue;
          if ((k === j - 1 && x === 0) || (k === j + 1 && x === W - 1)) continue;
          seen[k] = 1; st.push(k);
        }
      }
      if (n >= (minPx || 1)) out.push({ x0, y0, x1, y1, n });
    }
    return out;
  }

  // ---- OUR key measurements (the plane as the generator built it) ------------------------------------------------
  // stations: the table's own list of profile stations (metres aft of the tip), from the reference's marks
  function measure(B, opts) {
    opts = opts || {};
    const T = B.tris, Pt = B.parts, S = n => new Set(n.map(x => PID[x]));
    const all = extent(T, Pt, S(PARTS.slice(1)));
    const M = {};
    const put = (k, v) => { if (v != null && isFinite(v)) M[k] = +v.toFixed(4); };
    if (!all) return M;
    put('length', all.hi[0] - all.lo[0]);
    const wingE = extent(T, Pt, S(['wing']));
    if (wingE) {
      put('span', wingE.hi[2] - wingE.lo[2]);
      const body = extent(T, Pt, FUSE);
      const sRoot = body ? body.hi[2] + 0.15 : 1;            // just outboard of the body
      const r = slice(T, Pt, S(['wing']), 2, sRoot);
      if (r) { put('wing.le', r.lo[0]); put('wing.te', r.hi[0]); put('wing.chord', r.hi[0] - r.lo[0]); put('wing.top', r.hi[1]); put('wing.bottom', r.lo[1]); }
      const sTip = wingE.hi[2] - 0.4;
      const t = slice(T, Pt, S(['wing']), 2, sTip);
      if (t) { put('wing.tip.le', t.lo[0]); put('wing.tip.te', t.hi[0]); put('wing.tip.top', t.hi[1]); }
      if (r && t) put('wing.dihedral', Math.atan2(t.hi[1] - r.hi[1], sTip - sRoot) * 180 / Math.PI);
    }
    const body = extent(T, Pt, S(['body', 'glass', 'pillar', 'waist']));
    if (body) { put('body.front', body.lo[0]); put('tailpost', body.hi[0]); put('body.halfw', body.hi[2]); }
    const fin = extent(T, Pt, S(['fin']));
    if (fin) { put('fin.top', fin.hi[1]); put('fin.te', fin.hi[0]); put('fin.le', fin.lo[0]); }
    const stab = extent(T, Pt, S(['stab']));
    if (stab) { put('stab.span', stab.hi[2] - stab.lo[2]); put('stab.le', stab.lo[0]); put('stab.te', stab.hi[0]); }
    const eng = extent(T, Pt, S(['engine']));
    if (eng) put('prop.dia', Math.max(eng.hi[2] - eng.lo[2], eng.hi[1] - eng.lo[1]));
    const cowl = extent(T, Pt, S(['cowl']));
    if (cowl) { put('cowl.back', cowl.hi[0]); put('cowl.front', cowl.lo[0]); }
    // the wheels: the gear's lowest parts, fore half (mains) and aft half (tail or nose wheel)
    const gear = extent(T, Pt, S(['gear']));
    if (gear && body) {
      const mid = (body.lo[0] + body.hi[0]) / 2;
      const fore = extent(T, Pt, S(['gear']), (a, h, s) => a < mid && s > 0.05);
      if (fore) {
        const w = extent(T, Pt, S(['gear']), (a, h, s) => a < mid && s > 0.05 && h < fore.lo[1] + 0.7);
        const tyre = extent(T, Pt, S(['gear']), (a, h, s) => a < mid && s > 0.05 && h < fore.lo[1] + 0.12);
        if (w && tyre) {
          const ac = (tyre.lo[0] + tyre.hi[0]) / 2;
          // the tyre's diameter: the gear's points within 4 cm (fore / aft) of the wheel's centre, top to bottom
          const col = extent(T, Pt, S(['gear']), (a, h, s) => a < mid && s > 0.05 && Math.abs(a - ac) < 0.04 && h < fore.lo[1] + 1.2);
          put('wheel.a', ac); put('wheel.bottom', fore.lo[1]);
          if (col) { const top = Math.min(col.hi[1], fore.lo[1] + 1.2); put('wheel.dia', Math.min(1.5, top - fore.lo[1])); }
          put('track', 2 * (tyre.lo[2] + tyre.hi[2]) / 2);
        }
      }
      const aft = extent(T, Pt, S(['gear']), (a, h, s) => a > mid);
      if (aft) { put('tailwheel.a', (aft.lo[0] + aft.hi[0]) / 2); put('tailwheel.bottom', aft.lo[1]); }
      const nose = extent(T, Pt, S(['gear']), (a, h, s) => a < mid && Math.abs(s) < 0.05);
      if (nose && !(fore && Math.abs(nose.lo[1] - fore.lo[1]) > 0.5)) { /* a nose wheel reads here when there is one */ }
    }
    put('height', all.hi[1] - all.lo[1]);
    // the fuselage profile at the reference's stations
    for (const st of (opts.stations || [])) {
      const c = slice(T, Pt, FUSE, 0, st);
      if (!c) continue;
      put('profile.' + st.toFixed(2) + '.top', c.hi[1]); put('profile.' + st.toFixed(2) + '.bottom', c.lo[1]);
      put('profile.' + st.toFixed(2) + '.halfw', Math.max(c.hi[2], -c.lo[2]));
    }
    return M;
  }
  // the windows as the side view shows them (starboard): boxes in view metres, from a 1 cm raster
  function windows(B) {
    const res = 100;
    const all = extent(B.tris, B.parts, new Set([PID.glass]));
    if (!all) return [];
    const V = { ox: -all.lo[0] * res + 4, oy: all.hi[1] * res + 4, k: res, rot: 0 };
    const W = Math.ceil((all.hi[0] - all.lo[0]) * res) + 8, H = Math.ceil((all.hi[1] - all.lo[1]) * res) + 8;
    // the whole plane drawn, so a window hidden behind the wing or a strut is not counted as glass
    const id = raster('side', B.tris, B.parts, V, W, H, 0, 0);
    return components(id, W, H, PID.glass, 20).map(c => {
      const p0 = fromPx(V, c.x0, c.y1 + 1), p1 = fromPx(V, c.x1 + 1, c.y0);
      return { a0: +p0[0].toFixed(3), a1: +p1[0].toFixed(3), h0: +p0[1].toFixed(3), h1: +p1[1].toFixed(3) };
    }).sort((x, y) => x.a0 - y.a0);
  }

  // ---- THE REFERENCE'S key measurements, from its marks on the blueprint -------------------------------------------
  // ref.views[view] = { ox, oy, k, rot, flip, box: [x0, y0, x1, y1] }
  // ref.marks[id]  = { view, pts: [[px, py], ...] }      (sheet pixels)
  // a mark's value: the KM table says which coordinate of which point (or the distance between two points)
  const KM = [
    // id,               label,                          unit, tol,    from: figure | mark rule
    ['span',             'span',                         'm',  '1%',   { fig: 'geometry.span' }],
    ['length',           'length',                       'm',  '1%',   { fig: 'geometry.length' }],
    ['wing.chord',       'wing chord (root)',            'm',  0.02,   { fig: 'geometry.chord' }],
    ['wing.le',          'wing LE, aft of the tip',      'm',  0.02,   { mark: 'wing.le', view: 'side', c: 'X' }],
    ['wing.te',          'wing TE, aft of the tip',      'm',  0.02,   { mark: 'wing.te', view: 'side', c: 'X' }],
    ['wing.top',         'wing top at the root',         'm',  0.02,   { mark: 'wing.top', view: 'side', c: 'Y' }],
    ['wing.dihedral',    'dihedral',                     'deg', 0.5,   { fig: 'geometry.dihedral' }],
    ['body.front',       'body front (cowl face)',       'm',  0.03,   { mark: 'body.front', view: 'side', c: 'X' }],
    ['cowl.back',        'cowl back edge',               'm',  0.03,   { mark: 'cowl.back', view: 'side', c: 'X' }],
    ['tailpost',         'tail post',                    'm',  0.01,   { mark: 'tailpost', view: 'side', c: 'X' }],
    ['body.halfw',       'body half-width (max)',        'm',  0.02,   { mark: 'body.halfw', view: 'top', c: 'absY' }],
    ['fin.top',          'fin top',                      'm',  0.03,   { mark: 'fin.top', view: 'side', c: 'Y' }],
    ['fin.te',           'rudder trailing edge',         'm',  0.03,   { mark: 'fin.te', view: 'side', c: 'X' }],
    ['stab.span',        'tailplane span',               'm',  0.03,   { fig: 'geometry.stabSpan' }],
    ['stab.le',          'tailplane LE (root)',          'm',  0.03,   { mark: 'stab.le', view: 'top', c: 'X' }],
    ['prop.dia',         'propeller diameter',           'm',  0.02,   { fig: 'geometry.propDia' }],
    ['wheel.a',          'main wheel centre, aft',       'm',  0.01,   { mark: 'wheel', view: 'side', c: 'X' }],
    ['wheel.bottom',     'main wheel bottom',            'm',  0.01,   { mark: 'wheel.bottom', view: 'side', c: 'Y' }],
    ['wheel.dia',        'main wheel diameter',          'm',  0.02,   { mark: 'wheel.dia', view: 'side', c: 'dist' }],
    ['track',            'track',                        'm',  0.01,   { fig: 'geometry.track' }],
    ['tailwheel.a',      'tail wheel, aft',              'm',  0.03,   { mark: 'tailwheel', view: 'side', c: 'X' }],
  ];
  function markValue(ref, m, rule) {
    const V = ref.views && ref.views[rule.view];
    if (!V || !m || !m.pts || !m.pts.length) return null;
    const p = m.pts.map(q => fromPx(V, q[0], q[1]));
    if (rule.c === 'X') return p[0][0];
    if (rule.c === 'Y') return p[0][1];
    if (rule.c === 'absY') return Math.abs(p[0][1]);
    if (rule.c === 'dist' && p.length > 1) return Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]);
    return null;
  }
  function figValue(ref, path) {
    const r = ref.figures && ref.figures[path];
    if (!r) return null;
    return Array.isArray(r.v) ? (r.v[0] + r.v[1]) / 2 : r.v;
  }
  // the reference's own profile stations: marks 'profile.<i>' = [top point, bottom point] side view (+ halfw in top)
  function refProfiles(ref) {
    const out = [];
    for (const k of Object.keys(ref.marks || {})) {
      const mm = /^profile\.(\d+)$/.exec(k); if (!mm) continue;
      const m = ref.marks[k], V = ref.views.side;
      if (!V || !m.pts || m.pts.length < 2) continue;
      const p = m.pts.map(q => fromPx(V, q[0], q[1]));
      const a = (p[0][0] + p[1][0]) / 2;
      const o = { i: +mm[1], a, top: Math.max(p[0][1], p[1][1]), bottom: Math.min(p[0][1], p[1][1]) };
      const w = ref.marks['profileW.' + mm[1]];
      if (w && ref.views.top && w.pts && w.pts.length) o.halfw = Math.abs(fromPx(ref.views.top, w.pts[0][0], w.pts[0][1])[1]);
      out.push(o);
    }
    return out.sort((x, y) => x.a - y.a);
  }
  function refWindows(ref) {
    const out = [], V = ref.views && ref.views.side;
    for (const k of Object.keys(ref.marks || {})) {
      if (!/^window\./.test(k) || !V) continue;
      const p = ref.marks[k].pts.map(q => fromPx(V, q[0], q[1]));
      if (p.length < 2) continue;
      const xs = p.map(q => q[0]), ys = p.map(q => q[1]);
      out.push({ id: k, a0: Math.min(...xs), a1: Math.max(...xs), h0: Math.min(...ys), h1: Math.max(...ys) });
    }
    return out.sort((x, y) => x.a0 - y.a0);
  }
  // THE TABLE: ours against the reference's, row by row
  function compare(ref, ours, oursWin) {
    const rows = [];
    for (const [id, label, unit, tol, rule] of KM) {
      const o = ours[id];
      let r = null, src = '';
      if (rule.fig) { r = figValue(ref, rule.fig); src = r != null ? 'figure' : ''; }
      if (r == null && rule.mark) { r = markValue(ref, ref.marks && ref.marks[rule.mark], rule); src = r != null ? 'mark' : ''; }
      if (r == null && rule.fig) { // a figure-less row can still be marked
        const mk = ref.marks && ref.marks[id];
        if (mk) { r = markValue(ref, mk, { view: mk.view, c: mk.c || 'dist' }); src = r != null ? 'mark' : ''; }
      }
      const t = typeof tol === 'string' ? (r != null ? Math.abs(r) * parseFloat(tol) / 100 : null) : tol;
      const d = (o != null && r != null) ? o - r : null;
      rows.push({ id, label, unit, ours: o == null ? null : o, ref: r, src, diff: d, tol: t,
                  ok: d == null ? null : Math.abs(d) <= t + 1e-9 });
    }
    for (const p of refProfiles(ref)) {
      const k = 'profile.' + p.a.toFixed(2);
      for (const [c, lab] of [['top', 'top'], ['bottom', 'bottom'], ['halfw', 'half-width']]) {
        if (p[c] == null) continue;
        const o = ours[k + '.' + c], d = o == null ? null : o - p[c];
        rows.push({ id: k + '.' + c, label: 'profile at ' + p.a.toFixed(2) + ' m: ' + lab, unit: 'm', ours: o == null ? null : o,
                    ref: p[c], src: 'mark', diff: d, tol: 0.02, ok: d == null ? null : Math.abs(d) <= 0.02 });
      }
    }
    // windows: each reference window against our nearest by centre
    const W = oursWin || [];
    for (const rw of refWindows(ref)) {
      const cx = (rw.a0 + rw.a1) / 2, cy = (rw.h0 + rw.h1) / 2;
      let best = null, bd = 1e9;
      for (const w of W) { const d = Math.hypot((w.a0 + w.a1) / 2 - cx, (w.h0 + w.h1) / 2 - cy); if (d < bd) { bd = d; best = w; } }
      for (const c of ['a0', 'a1', 'h0', 'h1']) {
        const o = best ? best[c] : null, d = o == null ? null : o - rw[c];
        rows.push({ id: rw.id + '.' + c, label: rw.id.replace('window.', 'window ') + ' ' + ({ a0: 'fore edge', a1: 'aft edge', h0: 'bottom', h1: 'top' })[c],
                    unit: 'm', ours: o, ref: rw[c], src: 'mark', diff: d, tol: 0.03, ok: d == null ? null : Math.abs(d) <= 0.03 });
      }
    }
    const scored = rows.filter(r => r.ok != null);
    return { rows, n: scored.length, pass: scored.filter(r => r.ok).length };
  }
  function stations(ref) { return refProfiles(ref).map(p => +p.a.toFixed(2)); }

  const api = { VIEWS, PARTS, PID, COLOURS, FUSE, proj, toPx, fromPx, raster, edges, slice, extent, components,
    measure, windows, KM, markValue, figValue, refProfiles, refWindows, compare, stations };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DT_CORE = api;
})(typeof self !== 'undefined' ? self : this);
