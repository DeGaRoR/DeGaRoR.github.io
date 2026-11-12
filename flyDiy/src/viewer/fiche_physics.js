// fiche_physics.js - PHYSICS-PAGES: THE FICHE'S PHYSICS PAGES, drawn (the user, 11 Nov: "advertise how advanced and honest
// the physics model is ... beautiful as much as technical"; on the board, "a version like the fiche, more printable, on the
// off-white background").
//
// Four pages beside the fiche (and AIRCRAFT-LOOKS' Mass & price), each one SVG from the data 66c_gen_fiche_pages.js reads off
// the core (genFichePages) and the fiche's own orthographic pictures:
//   load    LOAD TEST + BREAKING POINT  the airframe bent at the limit load, each member coloured by the share of its yield
//                                      force it carries; the same bench carried on until a part lets go; the g ladder
//   drag    DRAG                       the side view, each drag source a flat plate of the same drag drawn to scale, its
//                                      cost in km/h; the ranked list beside it
//   xray    X-RAY                      the plan, the electrics where the frame bills them (a loupe on the firewall), every
//                                      lamp, the fuel bay and its tank; the power budget beside it
//   model   WHAT THE SIM FLIES         plan above side: the masses, the members, the lifting panels and their control
//                                      surfaces, the body's two drag points, the propeller disc, the contacts
// One layout, 1200 x 800 (the share picture's 3:2), two themes, picked by the SCREEN (the user via A0, 13 Nov: the fiche in
// the fleet screen - cream on the desktop, BLACK on the phone; 12 Nov's "cream only" stands for the desktop):
//   sheet   the fiche's cream sheet (#f3ede0, ink #2b2924): printable; every fill outlined and named, labels in dark ink,
//           colour never the only cue (AIRCRAFT-LOOKS via A0, 11 Nov)
//   dark    the phone's black page: the same drawing, light ink on black
// opts.theme 'dark' | 'phone' (or opts.screen 'phone') draws dark; anything else cream.
// The category colours are the fiche pages' shared set (A0, 11 Nov): one colour per Mass & price category.
//
// WHERE A PART IS ON A PICTURE: the fiche's ortho pictures carry their scale (data.pxPerM) but not their offset; the frame is
// found by fitting the model's nodes onto the picture's alpha (fitFrame: the offset, and on the side view a tilt within
// +-6 degrees, that puts the most nodes on the aeroplane's pixels). Pure, so GATE PHYSPAGES holds it.
//
//   FICHE_PHYSICS.svg(page, data, { theme, name, reg, pics: { side|plan: { href, W, H, s, frame } }, sig }) -> SVG string
//   FICHE_PHYSICS.fitFrame(model, view, alpha, W, H, s) -> { ox, oy, rot, score, n }
//   FICHE_PHYSICS.frameOf(model, view, img, s) -> Promise frame (the page: the picture's alpha off a canvas)
//   FICHE_PHYSICS.mount(el, rec, page, { theme, spec, title }) -> Promise<bool>   the board's hook (fiche_board.js record)
//   FICHE_PHYSICS.compose(rec, page, opts) -> Promise<PNG Blob 2400 x 1600>          the share's picture of a page
//   FICHE_PHYSICS.PAGES, THEMES, CAT
'use strict';
(function (root) {
  const PAGES = [
    // the fiche's sections (the user, 12 Nov), by the board's registry ids (AIRCRAFT-LOOKS' FICHE_BOARD.pages, its slot
    // order main, cutaway, mass, drag, physics, electrics, integrity, reference, log; 'mass' is AIRCRAFT-LOOKS')
    { id: 'drag', name: 'Drag' }, { id: 'physics', name: 'Physics' }, { id: 'electrics', name: 'Electrics' },
    { id: 'cooling', name: 'Cooling' }, { id: 'integrity', name: 'Integrity' }, { id: 'reference', name: 'Reference' },
  ];
  // the fiche pages' shared category colours (A0, 11 Nov), and their names (colour is never the only cue)
  const CAT = { structure: '#8fb0c4', engine: '#e2a056', gear: '#a9bd6e', systems: '#b99be0',
                fittings: '#6fc2b0', interior: '#e0868a', finish: '#b7ab9b' };
  const THEMES = {
    sheet: { bg: '#f3ede0', ink: '#2b2924', dim: '#6d675b', faint: '#9a9283', hair: '#d8cdb8', rule: 'rgba(43,41,36,.16)',
             lead: 'rgba(43,41,36,.38)', member: 'rgba(43,41,36,.22)', ghost: 0.55, fillOp: 0.42, edge: 'rgba(43,41,36,.55)',
             ramp: [[0, [201, 191, 174]], [0.3, [176, 160, 134]], [0.6, [208, 138, 79]], [1, [181, 70, 42]]], bad: '#b5462a', warn: '#c27a3e',
             frame: true },
    dark: { bg: '#000000', ink: '#f2ece2', dim: '#bdb5a8', faint: '#8d877b', hair: 'rgba(255,248,236,.18)', rule: 'rgba(255,248,236,.16)',
            lead: 'rgba(244,239,230,.38)', member: 'rgba(214,206,194,.26)', ghost: 0.36, fillOp: 0.4, edge: null,
            ramp: [[0, [74, 69, 64]], [0.25, [151, 144, 127]], [0.5, [216, 160, 122]], [1, [232, 112, 72]]], bad: '#ec6f49', warn: '#e0a070',
            frame: true },
  };
  // the theme: the registry's ctx.layout ({ screen, theme: 'cream' | 'dark', w, h }, AIRCRAFT-LOOKS 13 Nov), else the older
  // flat fields; then the sheet's own CSS tokens over the base palette when the board hands them (o.tokens, read at mount:
  // --fi-paper, --fi-ink, --fi-dim, --fi-line) - the board's colours, never a cream of ours where it has one
  const themeOf = o => {
    const L = (o && o.layout) || {}, t = L.theme || (o && o.theme), sc = L.screen || (o && o.screen);
    const base = (t === 'dark' || t === 'phone' || (!t && sc === 'phone')) ? THEMES.dark : THEMES.sheet, T = o && o.tokens;
    if (!T) return base;
    const th = Object.assign({}, base);
    if (T.paper) th.bg = T.paper; if (T.ink) th.ink = T.ink; if (T.dim) { th.dim = T.dim; th.faint = T.dim; } if (T.line) { th.hair = T.line; th.rule = T.line; }
    th.base = base;
    return th;
  };
  const W = 1200, H = 800;
  const r1 = x => (Math.round(x * 10) / 10).toFixed(1), r0 = x => String(Math.round(x));
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const mean = ps => { ps = ps.filter(Boolean); return ps.length ? [0, 1, 2].map(k => ps.reduce((a, p) => a + p[k], 0) / ps.length) : null; };

  // ---- the frame fit ----------------------------------------------------------------------------------------------------
  // view 'side': u from x (nose left), v from -y; 'plan': u from z, v from x (nose up) - plane_fiche.js's ortho cameras
  const proj = (view, p) => (view === 'side' ? [p[0], -p[1]] : view === 'front' ? [-p[2], -p[1]] : [p[2], p[0]]);
  function fitFrame(model, view, alpha, w, h, s) {
    const pts = model.nodes.map(n => proj(view, n));
    let best = null;
    const rots = view === 'side' ? [] : [0];
    if (view === 'side') for (let r = -6; r <= 6.001; r += 0.5) rots.push(r);
    for (const rd of rots) {
      const c = Math.cos(rd * Math.PI / 180), sn = Math.sin(rd * Math.PI / 180);
      const A = pts.map(p => (p[0] * c - p[1] * sn) * s), B = pts.map(p => (p[0] * sn + p[1] * c) * s);
      const a0 = Math.min(...A), a1 = Math.max(...A), b0 = Math.min(...B), b1 = Math.max(...B);
      for (let ox = Math.floor(-a0) - 40; ox <= Math.ceil(w - a1) + 40; ox += 2)
        for (let oy = Math.floor(-b0) - 40; oy <= Math.ceil(h - b1) + 40; oy += 2) {
          let sc = 0;
          for (let i = 0; i < A.length; i++) { const u = (A[i] + ox) | 0, v = (B[i] + oy) | 0; if (u >= 0 && u < w && v >= 0 && v < h && alpha[v * w + u]) sc++; }
          if (!best || sc > best.score) best = { ox, oy, rot: rd, score: sc, n: A.length };
        }
    }
    return best;
  }
  function frameOf(model, view, img, s) {
    return new Promise((res, rej) => {
      const go = () => { try {
        const w = img.naturalWidth, h = img.naturalHeight, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const g = cv.getContext('2d'); g.drawImage(img, 0, 0); const px = g.getImageData(0, 0, w, h).data, a = new Uint8Array(w * h);
        for (let i = 0; i < w * h; i++) a[i] = px[i * 4 + 3] > 128 ? 1 : 0;
        res(fitFrame(model, view, a, w, h, s)); } catch (e) { rej(e); } };
      if (img.complete && img.naturalWidth) go(); else { img.onload = go; img.onerror = rej; }
    });
  }

  // ---- drawing helpers ----------------------------------------------------------------------------------------------------
  function kit(th) {
    const T = (x, y, s, o) => { o = o || {}; return `<text x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" font-size="${o.sz || 15}" fill="${o.c || th.ink}"` +
      (o.w ? ` font-weight="${o.w}"` : '') + (o.a ? ` text-anchor="${o.a}"` : '') + (o.ls ? ` letter-spacing="${o.ls}"` : '') + `>${esc(s)}</text>`; };
    const L = (a, b, c, w, d) => `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${c}" stroke-width="${w || 1}"${d ? ` stroke-dasharray="${d}"` : ''} stroke-linecap="round"/>`;
    const ramp = u => { const R = th.ramp; u = Math.max(0, Math.min(1, u));
      for (let i = 1; i < R.length; i++) if (u <= R[i][0]) { const [a, ca] = R[i - 1], [b, cb] = R[i], t = (u - a) / (b - a); return 'rgb(' + ca.map((c, j) => Math.round(c + (cb[j] - c) * t)).join(',') + ')'; }
      return 'rgb(' + R[R.length - 1][1].join(',') + ')'; };
    const eyebrow = (x, y, s) => T(x, y, s.toUpperCase(), { sz: 12.5, c: th.faint, w: 600, ls: 1.8 });
    const fillAttr = (col, op) => `fill="${col}" fill-opacity="${op == null ? th.fillOp : op}"` + (th.edge ? ` stroke="${th.edge}" stroke-width="0.8"` : ` stroke="${col}" stroke-width="1.3"`);
    // a label leader: from a point to a label's edge, never through its text
    const call = (out, q, lx, ly, a, t1, t2, col) => {
      const tx = a === 'end' ? lx - 4 : a === 'start' ? lx + 4 : lx, ty = q[1] > ly ? ly + 22 : ly - 18;
      out.push(L(q, [a === 'middle' ? lx : a === 'end' ? Math.min(q[0] - 8, lx + 10) : Math.max(q[0] + 8, lx - 10), ty], th.lead, 0.8));
      out.push(T(tx, ly, t1, { sz: 15, a, w: 500 }) + (t2 ? T(tx, ly + 18, t2, { sz: 13, a, c: col || th.dim }) : ''));
    };
    return { T, L, ramp, eyebrow, fillAttr, call };
  }
  function head(th, K, o, eyebrowText, title, sub) {
    const out = [];
    out.push(`<rect width="${W}" height="${H}" fill="${th.bg}"/>`);
    if (th.frame) out.push(`<rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="14" fill="none" stroke="${th.hair}" stroke-width="1.5"/>`);
    out.push(K.eyebrow(48, 58, eyebrowText));
    out.push(K.T(48, 94, title, { sz: 28, w: 600 }));
    if (sub) out.push(K.T(48, 120, sub, { sz: 14.5, c: th.dim }));
    const nm = (o.name || '') + (o.reg ? '  ' + o.reg : '');
    if (nm) out.push(K.T(W - 48, 58, nm, { sz: 15, w: 600, a: 'end' }));
    if (o.sig) out.push(K.T(W - 48, H - 32, o.sig, { sz: 12, c: th.faint, a: 'end' }));
    return out;
  }
  const wrap = (out, label) => `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}" xmlns="http://www.w3.org/2000/svg" font-family="'IBM Plex Sans', system-ui, sans-serif">${out.join('')}</svg>`;
  const tagOf = (M, i) => M.tags[M.nodes[i][4]];
  const P3 = (M, i) => M.nodes[i].slice(0, 3);
  const byTag = (M, t) => M.nodes.filter(n => M.tags[n[4]] === t).map(n => n.slice(0, 3));
  const isStrut = (M, b) => { const ta = tagOf(M, b[0]), tb = tagOf(M, b[1]); return M.CLS[b[2]] === 'wing' && ((/^S\d/.test(ta) && /^W/.test(tb)) || (/^S\d/.test(tb) && /^W/.test(ta))); };
  function memberName(M, bi, semi) {
    const b = M.beams[bi], ta = tagOf(M, b[0]), tb = tagOf(M, b[1]);
    const z = Math.max(Math.abs(M.nodes[b[0]][2]), Math.abs(M.nodes[b[1]][2]));
    const where = z < 0.35 * semi ? 'inboard' : z < 0.7 * semi ? 'mid-span' : 'outboard';
    if (isStrut(M, b)) return 'lift strut';
    if (ta === 'WF' && tb === 'WF') return 'front spar, ' + where;
    if (ta === 'WR' && tb === 'WR') return 'rear spar, ' + where;
    if (/^W/.test(ta) && /^W/.test(tb)) return 'wing truss, ' + where;
    return M.CLS[b[2]] + ' member';
  }
  const GRPNAME = key => { const m = /^(wing|boom)(\d?)([LR]):(\w+)$/.exec(key || ''); if (!m) return String(key || '');
    const side = m[3] === 'L' ? 'left' : 'right';
    return m[1] === 'boom' ? side + ' boom attachment' : side + ' ' + (m[4] === 'strut' ? 'lift strut fitting' : m[4] === 'root' ? 'wing root fitting' : m[4]); };

  // a front view of the model in a box, bent by a shape (x K): its points and its scale
  function frontView(M, shape, K, box) {
    const n = M.nodes, cx = box.x + box.w / 2;
    let s = 1, base = 0;
    const P = (i, ex) => { const p = n[i], d = ex && shape ? shape[i] : [0, 0, 0]; return [cx - (p[2] + K * d[2]) * s, base - (p[1] + K * d[1]) * s]; };
    let u = 0, v0 = Infinity, v1 = -Infinity;
    for (let i = 0; i < n.length; i++) for (const ex of [0, 1]) { const q = P(i, ex); u = Math.max(u, Math.abs(q[0] - cx)); v0 = Math.min(v0, q[1]); v1 = Math.max(v1, q[1]); }
    s = Math.min(box.w / 2 / u, box.h / Math.max(0.1, v1 - v0));
    let top = Infinity; for (let i = 0; i < n.length; i++) for (const ex of [0, 1]) top = Math.min(top, P(i, ex)[1]);
    base = box.y - top;
    return { P, s };
  }

  // ===================================================================================================================
  // LOAD TEST + BREAKING POINT
  // ===================================================================================================================
  // INTEGRITY's three drawings into a box (the desktop's, the phone's column): the airframe bent at the limit, coloured by
  // how hard each member works; the bench carried on until a part lets go; the g ladder. Return what the captions need.
  function loadLimitPic(M, Ld, th, K, BX, out, fs) {
    const tip = Ld.tipM, Kx = Math.max(5, Math.round(0.11 * Ld.semi / Math.max(1e-4, tip) / 5) * 5);
    const fv = frontView(M, Ld.shape, Kx, BX);
    for (const b of M.beams) if (M.CLS[b[2]] === 'wing' && tagOf(M, b[0]) === 'WF' && tagOf(M, b[1]) === 'WF') out.push(K.L(fv.P(b[0], 0), fv.P(b[1], 0), th.faint, 1.1, '4 5'));
    const order = M.beams.map((b, i) => i).sort((a, b) => Ld.util[a] - Ld.util[b]);
    for (const i of order) { const b = M.beams[i]; if (b[3]) continue; const u = Ld.util[i], wingish = M.CLS[b[2]] === 'wing' || M.CLS[b[2]] === 'wire';
      out.push(K.L(fv.P(b[0], 1), fv.P(b[1], 1), wingish ? K.ramp(0.08 + u / 0.4) : th.member, wingish ? 1.1 + 3 * Math.min(1, u / 0.4) : 0.7)); }
    { const wb = M.beams[Ld.worst], a = fv.P(wb[0], 1), c = fv.P(wb[1], 1), m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
      out.push(`<circle cx="${m[0].toFixed(1)}" cy="${m[1].toFixed(1)}" r="9" fill="none" stroke="${K.ramp(1)}" stroke-width="1.8"/>`);
      out.push(K.T(m[0] + 14, m[1] - 10, r0(Ld.worstU * 100) + ' %', { sz: 13, c: K.ramp(1), w: 600 })); }
    { const wf = M.nodes.map((n, i) => i).filter(i => tagOf(M, i) === 'WF'), tj = wf.reduce((a, i) => (M.nodes[i][2] > M.nodes[a][2] ? i : a), wf[0]);
      const pj = fv.P(tj, 0), pb = fv.P(tj, 1);
      out.push(K.L([pj[0] - 16, pj[1]], [pj[0] - 4, pj[1]], th.dim, 1) + K.L([pb[0] - 16, pb[1]], [pb[0] - 4, pb[1]], th.dim, 1) + K.L([pj[0] - 10, pj[1]], [pb[0] - 10, pb[1]], th.dim, 1));
      out.push(K.T(pj[0] + 6, pj[1] + 22, '+' + r1(tip * 100) + ' cm at the tip', { sz: fs || 15, w: 600 })); }
    return { Kx };
  }
  function loadBreakPic(M, Ds, th, K, BX, out) {
    let Kb = null;
    if (Ds && Ds.shape) {
      let bt = 0; M.nodes.forEach((n, i) => { if (tagOf(M, i) === 'WF') bt = Math.max(bt, Math.abs(Ds.shape[i][1])); });
      Kb = bt > 0.1 * M.semi ? 1 : Math.max(5, Math.round(0.11 * M.semi / Math.max(1e-4, bt) / 5) * 5);
      const bv = frontView(M, Ds.shape, Kb, BX);
      const brk = new Set(Ds.broken), yl = new Set(Ds.yielded);
      M.beams.forEach((b, i) => { if (b[3] || brk.has(i) || yl.has(i)) return; out.push(K.L(bv.P(b[0], 1), bv.P(b[1], 1), th.member, 0.8)); });
      M.beams.forEach((b, i) => { if (b[3] || !yl.has(i)) return; out.push(K.L(bv.P(b[0], 1), bv.P(b[1], 1), th.warn, 1.8)); });
      M.beams.forEach((b, i) => { if (!brk.has(i)) return; out.push(K.L(bv.P(b[0], 1), bv.P(b[1], 1), th.bad, 2.2, '5 4')); });
      if (Ds.firstBreak) { const b = M.beams[Ds.firstBreak.beam], a = bv.P(b[0], 1), c = bv.P(b[1], 1), m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2], left = m[0] < BX.x + BX.w / 2 && m[0] - 16 - 14 * 13 * 0.56 >= BX.x;   // (the left only where the label fits there)
        out.push(`<circle cx="${m[0].toFixed(1)}" cy="${m[1].toFixed(1)}" r="11" fill="none" stroke="${th.bad}" stroke-width="1.8"/>`);
        out.push(K.T(m[0] + (left ? -16 : 16), m[1] - 14, Ds.firstBreak.how === 'kink' ? 'first to buckle' : 'first to break', { sz: 13, c: th.bad, w: 600, a: left ? 'end' : 'start' })); }
    }
    return { Kb };
  }
  function loadLadder(Ds, th, K, lx0, lx1, ly, out) {
    // the ladder
    if (Ds && Ds.brokeAt != null) {
      const gMax = Math.max(7, Ds.brokeAt * 1.08), gx = g => lx0 + (lx1 - lx0) * g / gMax;
      out.push(K.L([lx0, ly], [lx1, ly], th.lead, 1));
      for (let g = 0; g <= gMax; g += (gMax > 10 ? 2 : 1)) out.push(K.L([gx(g), ly - 3], [gx(g), ly + 3], th.faint, 1) + K.T(gx(g), ly + 17, g + ' g', { sz: 11, c: th.faint, a: 'middle' }));
      // the markers, then their labels stacked: each takes the first height (above the ladder, then below the g numbers)
      // where its text clears every label already placed - events a tenth of a g apart (a Stearman's bend, break and
      // let-go) used to print on one another
      const same = Ds.yieldAt != null && Ds.breakAt != null && Math.abs(Ds.yieldAt - Ds.breakAt) < 0.05;
      const M = [[3.8, 'limit 3.8', th.dim], [5.7, 'ultimate 5.7', th.dim]];
      if (!same && Ds.yieldAt != null) M.push([Ds.yieldAt, 'first bend ' + Ds.yieldAt.toFixed(2), th.warn]);
      if (Ds.breakAt != null && Math.abs(Ds.brokeAt - Ds.breakAt) > 0.05) M.push([Ds.breakAt, 'first ' + (Ds.firstBreak && Ds.firstBreak.how === 'kink' ? 'buckle ' : 'break ') + Ds.breakAt.toFixed(1), th.bad]);
      M.push([Ds.brokeAt, (same ? 'bends and breaks ' : 'lets go ') + Ds.brokeAt.toFixed(2), th.bad]);
      const LV = [-24, -42, 38, -60, 56], placed = [];
      for (const [g, lab, col] of M.sort((a, b) => a[0] - b[0])) {
        const x = gx(g), w = lab.length * 6.9, x0 = Math.max(lx0, Math.min(lx1 + 40 - w, x - w / 2));
        let lv = LV.find(dy => placed.every(p => p.dy !== dy || x0 > p.x1 + 8 || x0 + w < p.x0 - 8));
        if (lv == null) lv = LV[LV.length - 1];
        placed.push({ dy: lv, x0, x1: x0 + w });
        const ty = ly + lv, stem = lv < 0 ? [ly - 6, ty + 4] : [ly + 6, ty - 13];
        out.push(`<circle cx="${x.toFixed(1)}" cy="${ly}" r="4.5" fill="${col}"/>` + K.L([x, stem[0]], [x, stem[1]], col, 1) +
          K.T(x0, ty, lab, { sz: 12.5, c: col, w: 500 }));
      }
    }
  }
  function pageLoad(D, o, th, K) {
    const M = D.model, Ld = D.load, Ds = D.destroy;
    const out = head(th, K, o, 'Integrity · the certification bench',
      Ld && Ld.verdict === 'HELD' ? 'Held 5.7 g with nothing bent' : (Ld ? Ld.verdict : 'No load test'),
      Ld ? Math.round(Ld.W / 9.81) + ' kg in sandbags at 1 g, the plane on its back on trestles · ' + M.beams.length + ' members, each its own spring' : '');
    if (!Ld || !Ld.shape) return out;
    // the limit: the bent airframe, coloured by the work (left, top)
    const tip = Ld.tipM, LP = loadLimitPic(M, Ld, th, K, { x: 48, y: 196, w: 700, h: 190 }, out, 15);
    out.push(K.T(48, 170, 'At the limit load, 3.8 g · bending drawn ×' + LP.Kx, { sz: 14, w: 600, c: th.dim }));
    // the breaking point (left, below)
    if (Ds && Ds.shape) { const BP = loadBreakPic(M, Ds, th, K, { x: 48, y: 470, w: 700, h: 170 }, out);
      out.push(K.T(48, 446, 'Carried on until a part lets go · ' + (BP.Kb === 1 ? 'drawn true to scale' : 'bending drawn ×' + BP.Kb), { sz: 14, w: 600, c: th.dim })); }
    // the right column: the readings
    const cx = 800, rows = [];
    rows.push(['3.8 g', 'limit load', '+' + r1(tip * 100) + ' cm at the tip']);
    rows.push(['5.7 g', 'ultimate, held 1.5 s', '+' + r1(Ld.ultTipM * 100) + ' cm']);
    rows.push([r0(Ld.worstU * 100) + ' %', 'of its yield force', 'works hardest: ' + memberName(M, Ld.worst, M.semi) + (Ld.worstComp ? ', squeezed' : ', pulled')]);
    if (Ds && Ds.brokeAt != null) {
      const first = Ds.groups[0] ? GRPNAME(Ds.groups[0].key) : '';
      rows.push([r1(Ds.brokeAt) + ' g', 'it breaks', 'the ' + first + ' lets go first']);
      if (Ds.groups.length > 1) rows.push(['0.3 s', 'later', Ds.groups.slice(1).map(g => GRPNAME(g.key)).join(', ')]);
    }
    let y = 178;
    for (const r of rows) {
      out.push(K.T(cx, y, r[0], { sz: 24, w: 600 }) + K.T(cx + 112, y - 2, r[1], { sz: 14, c: th.dim }));
      const words = String(r[2]).split(' '); let line = '', ly = y + 20;
      for (const w of words) { if ((line + ' ' + w).length > 40) { out.push(K.T(cx + 112, ly, line.trim(), { sz: 13.5 })); ly += 17; line = ''; } line += ' ' + w; }
      out.push(K.T(cx + 112, ly, line.trim(), { sz: 13.5 }));
      y = ly + 38;
    }
    // the key
    { const ky = Math.max(y, 560); out.push(K.T(cx, ky, 'HOW HARD EACH MEMBER WORKS', { sz: 11, c: th.faint, w: 600, ls: 1.2 }));
      for (let i = 0; i < 40; i++) out.push(`<rect x="${cx + i * 8}" y="${ky + 8}" width="8.4" height="8" fill="${K.ramp(i / 39)}"/>`);
      out.push(K.T(cx, ky + 32, 'idle', { sz: 12, c: th.faint }) + K.T(cx + 320, ky + 32, '40 % of its yield', { sz: 12, c: th.faint, a: 'end' }));
      const k2 = ky + 58; let kx = cx;
      for (const [c, t, d] of [[th.warn, 'bent for good', null], [th.bad, 'broken', '5 4']]) { out.push(K.L([kx, k2 - 4], [kx + 22, k2 - 4], c, 2.2, d) + K.T(kx + 30, k2, t, { sz: 12.5, c: th.dim })); kx += 150; } }
    loadLadder(Ds, th, K, 48, 760, 718, out);
    return out;
  }

  // ===================================================================================================================
  // DRAG
  // ===================================================================================================================
  const DRAGROW = { fuselage: ['Fuselage', 'structure'], cooling: ['Engine cooling & exhaust', 'engine'], screen: ['Windscreen', 'fittings'],
    junct: ['Wing & tail roots', 'structure'], mainGear: ['Main gear', 'gear'], third: ['Tail wheel', 'gear'], struts: ['Lift struts', 'structure'],
    wires: ['Bracing wires', 'structure'], nacelles: ['Engine nacelle', 'engine'], pod: ['Belly pod', 'fittings'], strutPods: ['Strut tanks', 'engine'] };
  function sideMap(pic, box) {
    const fr = pic.frame, f = Math.min(box.w / pic.W, box.h / pic.H), ox = box.x + (box.w - pic.W * f) / 2, oy = box.y + (box.h - pic.H * f) / 2, r = fr.rot * Math.PI / 180;
    const N = p => { const a = p[0], b = -p[1]; return [ox + f * ((a * Math.cos(r) - b * Math.sin(r)) * pic.s + fr.ox), oy + f * ((a * Math.sin(r) + b * Math.cos(r)) * pic.s + fr.oy)]; };
    return { N, f, ox, oy, k: pic.s * f };
  }
  function planMap(pic, box) {
    const fr = pic.frame, f = Math.min(box.w / pic.W, box.h / pic.H), ox = box.x + (box.w - pic.W * f) / 2, oy = box.y + (box.h - pic.H * f) / 2;
    const N = p => [ox + f * (p[2] * pic.s + fr.ox), oy + f * (p[0] * pic.s + fr.oy)];
    return { N, f, ox, oy, k: pic.s * f };
  }
  const picImg = (pic, m, op, filt) => `<image href="${pic.href}" x="${m.ox.toFixed(1)}" y="${m.oy.toFixed(1)}" width="${(pic.W * m.f).toFixed(1)}" height="${(pic.H * m.f).toFixed(1)}" opacity="${op}"${filt ? ` filter="url(#${filt})"` : ''}/>`;
  // where each drag group sits on the side picture (shared by the desktop and the phone)
  function dragAt(D) {
    const M = D.model, Dg = D.drag, at = {};
    { const fus = M.nodes.filter(n => /^S[2-4][TB]/.test(M.tags[n[4]])); at.fuselage = mean(fus);
      at.cooling = mean(byTag(M, 'CGE').concat(byTag(M, 'ENGL'))); at.screen = mean(byTag(M, 'S0TL').concat(byTag(M, 'S1TL')));
      const wr = M.nodes.filter(n => M.tags[n[4]] === 'WF').sort((a, b) => Math.abs(a[2]) - Math.abs(b[2]))[0]; if (wr) at.junct = [wr[0] + 0.25, wr[1] - 0.05, 0];
      const ax = byTag(M, 'AXLEL'); at.mainGear = Dg.floats ? mean(byTag(M, 'FLK')) : ax.length ? mean(ax.concat(ax.map(p => [p[0], p[1] + 0.35, p[2]]))) : null;
      const tw = M.contacts.length > 2 ? P3(M, M.contacts[2]) : null; at.third = tw;
      const st = M.beams.filter(b => isStrut(M, b)); if (st.length) at.struts = mean(st.flatMap(b => [P3(M, b[0]), P3(M, b[1])]));
      const wi = M.beams.filter(b => M.CLS[b[2]] === 'wire'); if (wi.length) at.wires = mean(wi.flatMap(b => [P3(M, b[0]), P3(M, b[1])]));
      at.nacelles = mean(byTag(M, 'ENGL').concat(byTag(M, 'ENGR'))); }
    return at;
  }
  const dragName = Dg => g => g === 'third' && Dg.gearType === 'tricycle' ? 'Nose wheel' : g === 'third' && Dg.floats ? 'Third wheel*' : g === 'mainGear' && Dg.floats ? 'Floats*' : DRAGROW[g][0];
  function pageDrag(D, o, th, K) {
    const M = D.model, Dg = D.drag, pic = o.pics && o.pics.side;
    const items = [];
    const at = dragAt(D);
    const big = Object.keys(Dg.groups).filter(g => g !== 'fuselage' && DRAGROW[g]).sort((a, b) => Dg.groups[b].dV - Dg.groups[a].dV)[0];
    const nm = dragName(Dg);
    const out = head(th, K, o, 'Drag · where the speed goes', 'Your ' + nm(big).replace('*', '').toLowerCase() + ' cost ' + r0(Dg.groups[big].dV * 3.6) + ' km/h',
      'Cruise ' + r0(Dg.Vc * 3.6) + ' km/h · each disc a flat plate of the same drag, to scale');
    if (pic && pic.frame) {
      const m = sideMap(pic, { x: 48, y: 210, w: 690, h: 330 });
      out.push(picImg(pic, m, (th.base || th) === THEMES.sheet ? 1 : 0.92));
      for (const g in Dg.groups) { if (!at[g] || !DRAGROW[g]) continue; const q = m.N(at[g]), cda = Dg.groups[g].cda;
        items.push({ g, q, rad: Math.sqrt(cda / Math.PI) * m.k, cda, dV: Dg.groups[g].dV * 3.6, name: nm(g), col: CAT[DRAGROW[g][1]] }); }
      for (const it of items.slice().sort((a, b) => b.rad - a.rad))
        out.push(`<circle cx="${it.q[0].toFixed(1)}" cy="${it.q[1].toFixed(1)}" r="${Math.max(2.5, it.rad).toFixed(1)}" ${K.fillAttr(it.col)}/>`);
      // labels above and below the plane, spread so none overlaps
      const midY = m.N(at.fuselage)[1];
      const band = (arr, y, dir) => { const s = arr.slice().sort((a, b) => a.q[0] - b.q[0]).map(i => Object.assign(i, { x: i.q[0] }));
        for (let it = 0; it < 80; it++) { for (let i = 1; i < s.length; i++) if (s[i].x - s[i - 1].x < 142) { const c = (s[i].x + s[i - 1].x) / 2; s[i - 1].x = c - 71; s[i].x = c + 71; }
          for (const q of s) q.x = Math.max(120, Math.min(670, q.x)); }
        for (const i of s) { out.push(K.L([i.q[0], i.q[1] + dir * Math.max(3, i.rad)], [i.x, dir < 0 ? y + 8 : y - 30], th.lead, 0.8));
          out.push(K.T(i.x, y, i.name, { sz: 14, a: 'middle', w: 500 }) + K.T(i.x, y + 17, '−' + r1(i.dV) + ' km/h', { sz: 13.5, a: 'middle', c: (th.base || th) === THEMES.sheet ? th.ink : i.col, w: 600 })); } };
      band(items.filter(i => i.q[1] < midY - 4), 186, -1); band(items.filter(i => i.q[1] >= midY - 4), 592, 1);
    }
    // the right column: ranked, each with its colour chip and name (colour never the only cue)
    const cx = 790, rows = Object.keys(Dg.groups).filter(g => DRAGROW[g]).sort((a, b) => Dg.groups[b].dV - Dg.groups[a].dV);
    out.push(K.T(cx, 178, 'WHAT EACH PART COSTS AT CRUISE', { sz: 11, c: th.faint, w: 600, ls: 1.2 }));
    const vmax = Math.max(...rows.map(g => Dg.groups[g].dV)) * 3.6;
    rows.forEach((g, i) => { const y = 206 + i * 36, v = Dg.groups[g].dV * 3.6, col = CAT[DRAGROW[g][1]];
      out.push(`<rect x="${cx}" y="${y - 11}" width="11" height="11" rx="2" ${K.fillAttr(col, 0.9)}/>` + K.T(cx + 18, y, nm(g), { sz: 13.5 }) +
        K.T(cx + 362, y, '−' + r1(v) + ' km/h', { sz: 13.5, w: 600, a: 'end' }) +
        `<rect x="${cx + 18}" y="${y + 5}" width="${(250 * v / vmax).toFixed(1)}" height="4" rx="2" ${K.fillAttr(col, 0.75)}/>` +
        K.T(cx + 362, y + 13, Dg.groups[g].cda.toFixed(3) + ' m²', { sz: 11, c: th.faint, a: 'end' })); });
    // the footer: the whole drag area at cruise
    const tot = Dg.axial + Dg.surf, bx = 48, bw = W - 96, by = 680; let x = bx;
    const seg = (v, col, lab, op) => { const w = bw * v / tot; out.push(`<rect x="${x.toFixed(1)}" y="${by}" width="${Math.max(0, w - 1.5).toFixed(1)}" height="13" rx="2" ${K.fillAttr(col, op)}/>`);
      if (lab && w > 80) out.push(K.T(x + 2, by + 31, lab, { sz: 12, c: th.dim })); x += w; };
    seg(Dg.surf, th.faint, 'wings & tail, lifting ' + r0(100 * Dg.surf / tot) + ' %', 0.3);
    for (const it of items.slice().sort((a, b) => b.cda - a.cda)) seg(it.cda, it.col, it.cda / tot > 0.09 ? it.name.replace('*', '').toLowerCase() + ' ' + r0(100 * it.cda / tot) + ' %' : '');
    const rest = Dg.axial - items.reduce((a, i) => a + i.cda, 0); if (rest > 1e-4) seg(rest, th.faint, '', 0.15);
    out.push(K.T(48, by - 10, 'All of the drag at cruise: ' + tot.toFixed(2) + ' m² of flat plate', { sz: 12.5, c: th.dim }));
    if (Dg.floats) out.push(K.T(48, H - 32, '* the core charges the floats as the wheeled gear they replace: the hulls have no air drag of their own yet', { sz: 12, c: th.warn }));
    else out.push(K.T(48, H - 32, 'Each km/h: the cruise worked out again with only that part\'s drag taken off. They do not add up.', { sz: 12, c: th.faint }));
    return out;
  }

  // ===================================================================================================================
  // X-RAY: electrics and tanks - the plan large on the left (nose up) with its wire runs, and on the right the wiring
  // drawn as a pilot's operating handbook draws it: the sources on the left (the battery through its master, the starter
  // through its contactor, the alternator through its field breaker), one bus bar, every load off it through its own
  // breaker, the radios behind their avionics master. The wires coloured by CIRCUIT (heavy current, charging, lighting,
  // instruments, avionics), their weight by the current they carry; the same colours on the plan's runs and the budget.
  // ===================================================================================================================
  const WIRE = {
    sheet:  { power: '#b23a2a', charge: '#c47a2c', light: '#a8861a', panel: '#3d7a4a', av: '#2f6aa3' },
    dark:   { power: '#ee7258', charge: '#f2a85c', light: '#e8d06a', panel: '#8fd08a', av: '#80b4ea' },
  };
  const LOADNAME = { aiE: 'attitude indicator', turn: 'turn coordinator', fuel: 'fuel gauges', volts: 'voltmeter', hobbs: 'hour meter',
    oilP: 'oil pressure', oilT: 'oil temperature', com: 'radio (COM)', xpdr: 'transponder', nav: 'NAV receiver', gps: 'GPS', gps2: 'second display',
    navLt: 'navigation lights', landLt: 'landing light', taxiLt: 'taxi light', beaconLt: 'beacon', cabinLt: 'cabin & panel lights' };
  const LAMPOF = { navLt: 'nav', landLt: 'land', taxiLt: 'taxi', beaconLt: 'beacon', cabinLt: 'cabin' };
  const badge = (K, th, q, n, sz) => { const r = sz || 10; return `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${r}" fill="${th.bg}" stroke="${th.ink}" stroke-width="1.2"/>` +
    K.T(q[0], q[1] + r * 0.42, String(n), { sz: r * 1.2, w: 600, a: 'middle' }); };
  // the symbols, each at a point, in a colour
  const SYM = {
    cb: (x, y, c) => `<path d="M${x - 6} ${y} A6 6 0 0 1 ${x + 6} ${y}" fill="none" stroke="${c}" stroke-width="1.6"/><circle cx="${x - 6}" cy="${y}" r="1.6" fill="${c}"/><circle cx="${x + 6}" cy="${y}" r="1.6" fill="${c}"/>`,
    sw: (x, y, c, vert) => vert ? `<circle cx="${x}" cy="${y - 7}" r="1.8" fill="${c}"/><circle cx="${x}" cy="${y + 7}" r="1.8" fill="${c}"/><path d="M${x} ${y + 7} L${x - 8} ${y - 6}" stroke="${c}" stroke-width="1.6"/>`
                                : `<circle cx="${x - 7}" cy="${y}" r="1.8" fill="${c}"/><circle cx="${x + 7}" cy="${y}" r="1.8" fill="${c}"/><path d="M${x - 7} ${y} L${x + 6} ${y - 8}" stroke="${c}" stroke-width="1.6"/>`,
    lamp: (x, y, c, bg) => `<circle cx="${x}" cy="${y}" r="6.5" fill="${bg}" stroke="${c}" stroke-width="1.4"/><path d="M${x - 4.6} ${y - 4.6} L${x + 4.6} ${y + 4.6} M${x + 4.6} ${y - 4.6} L${x - 4.6} ${y + 4.6}" stroke="${c}" stroke-width="1.2"/>`,
    box: (x, y, c, bg) => `<rect x="${x - 6.5}" y="${y - 5.5}" width="13" height="11" rx="1.5" fill="${bg}" stroke="${c}" stroke-width="1.4"/>`,
    mach: (x, y, c, bg, t, r) => `<circle cx="${x}" cy="${y}" r="${r || 12}" fill="${bg}" stroke="${c}" stroke-width="1.6"/><text x="${x}" y="${y + 4}" font-size="10.5" font-weight="600" fill="${c}" text-anchor="middle">${t}</text>`,
    gnd: (x, y, c) => `<path d="M${x} ${y} L${x} ${y + 7} M${x - 8} ${y + 7} L${x + 8} ${y + 7} M${x - 5} ${y + 11} L${x + 5} ${y + 11} M${x - 2} ${y + 15} L${x + 2} ${y + 15}" stroke="${c}" stroke-width="1.3"/>`,
    batt: (x, y, c) => [0, 1].map(i => `<path d="M${x - 9 + i * 10} ${y - 10} L${x - 9 + i * 10} ${y + 10} M${x - 5 + i * 10} ${y - 5} L${x - 5 + i * 10} ${y + 5}" stroke="${c}" stroke-width="2"/>`).join(''),
  };
  function schematic(E, th, K, x0, y0, y1, lampNo) {
    const out = [], Wc = (th.base || th) === THEMES.sheet ? WIRE.sheet : WIRE.dark, BX = x0 + 118, ink = th.ink, bg = th.bg;
    const words = E.altA ? (E.elec.alternator === 'gen20' ? 'generator' : 'alternator') : '';
    const part = k => E.parts.find(p => p.key === k);
    const bat = part('battery'), alt = part('alternator'), st = part('starter'), busP = part('bus'), wire = part('wire');
    const W2 = (a, b, c, w) => K.L(a, b, c, w);
    // the loads, in the handbook's order: the panel's instruments, the radios behind their master, the lights
    const amp = cb => { let a = 0; for (const l of E.loads) if (l.cb === cb) a += l.amps; for (const l of E.lamps) if (l.cb === cb) a += l.amps; return a; };
    const rowsP = E.breakers.filter(b => b.group === 'panel'), rowsA = E.breakers.filter(b => b.group === 'avionics'), rowsL = E.breakers.filter(b => b.group === 'lights');
    const nRows = rowsP.length + rowsL.length + (rowsA.length ? rowsA.length + 1 : 0);
    const top = y0 + 30, step = Math.min(34, (y1 - top) / Math.max(1, nRows)), rows = [];
    let y = top;
    for (const b of rowsP) { rows.push({ b, y, c: Wc.panel, kind: 'box' }); y += step; }
    let avY0 = null; if (rowsA.length) { avY0 = y; y += step; for (const b of rowsA) { rows.push({ b, y, c: Wc.av, kind: 'box', av: true }); y += step; } }
    for (const b of rowsL) { rows.push({ b, y, c: Wc.light, kind: 'lamp' }); y += step; }
    const busTop = y0 + 8, busBot = Math.max(y - step + 4, y0 + 150);
    // the bus bar
    out.push(`<rect x="${BX - 2.5}" y="${busTop}" width="5" height="${busBot - busTop}" rx="1" fill="${ink}"/>`);
    out.push(K.T(BX, busTop - 8, 'BUS', { sz: 10.5, w: 600, c: th.faint, a: 'middle', ls: 1.2 }));
    // the sources: the battery through the master
    const by = busTop + 22;
    if (bat) {
      out.push(W2([x0 + 18, by], [x0 + 26, by], Wc.power, 3) + SYM.batt(x0 + 36, by, Wc.power) + W2([x0 + 46, by], [BX - 30, by], Wc.power, 3) + SYM.sw(BX - 22, by, Wc.power) + W2([BX - 15, by], [BX, by], Wc.power, 3));
      out.push(SYM.gnd(x0 + 18, by, ink));
      out.push(K.T(x0 + 36, by - 16, 'battery', { sz: 12, w: 600, a: 'middle' }) + K.T(x0 + 36, by + 25, bat.name.replace('lead-acid 12 V, ', '').replace('lithium 12 V, ', ''), { sz: 11, c: th.dim, a: 'middle' }));
      out.push(K.T(BX - 22, by - 13, 'master', { sz: 11, c: th.dim, a: 'middle' }));
    }
    // the starter, off the battery side, through its contactor
    let sy = by + 58;
    if (st && bat) {
      const nx = x0 + 70;
      out.push(W2([nx, by], [nx, sy - 22], Wc.power, 3.6) + SYM.sw(nx, sy - 14, Wc.power, true) + W2([nx, sy - 7], [nx, sy], Wc.power, 3.6) + SYM.mach(nx, sy + 12, Wc.power, bg, 'M'));
      out.push(K.T(nx - 18, sy + 9, 'starter', { sz: 12, w: 600, a: 'end' }) + K.T(nx - 18, sy + 23, '150 A cranking', { sz: 11, c: th.dim, a: 'end' }));
      sy += 64;
    }
    // the alternator through its field breaker
    if (alt) {
      const ay = Math.max(sy, by + 70);
      out.push(SYM.mach(x0 + 36, ay, Wc.charge, bg, words === 'generator' ? 'GEN' : 'ALT', 14) + W2([x0 + 50, ay], [BX - 34, ay], Wc.charge, 2.4) + SYM.cb(BX - 26, ay, Wc.charge) + W2([BX - 20, ay], [BX, ay], Wc.charge, 2.4));
      out.push(K.T(x0 + 36, ay + 30, E.altA + ' A ' + words, { sz: 11.5, w: 600, a: 'middle' }) + K.T(BX - 26, ay - 12, 'field 5 A', { sz: 11, c: th.dim, a: 'middle' }));
      out.push(SYM.gnd(x0 + 36, ay + 36, ink));
    }
    // the avionics master and its sub-bus
    const AX = BX + 22;
    if (avY0 != null) {
      const ya = rows.filter(r => r.av).map(r => r.y);
      out.push(W2([BX, avY0], [AX - 15, avY0], Wc.av, 2) + SYM.sw(AX - 8, avY0, Wc.av) + `<rect x="${AX - 1.5}" y="${avY0 - 4}" width="3" height="${Math.max(...ya) - avY0 + 8}" rx="1" fill="${Wc.av}"/>`);
      out.push(K.T(AX + 12, avY0 + 4, 'avionics master', { sz: 12, c: th.dim }));
    }
    // the rows: bus -> breaker -> load
    for (const r of rows) {
      const sx = r.av ? AX : BX, a = amp(r.b.key), lw = Math.max(1.1, Math.min(2.6, 0.9 + a * 0.2));
      out.push(W2([sx, r.y], [sx + 12, r.y], r.c, lw) + SYM.cb(sx + 18, r.y, r.c) + W2([sx + 24, r.y], [BX + 70, r.y], r.c, lw) + SYM[r.kind](BX + 78, r.y, r.c, bg));
      const nm = LOADNAME[r.b.key] || r.b.key, ln = lampNo[LAMPOF[r.b.key]];
      const af = a < 0.1 ? a.toFixed(2) : r1(a);
      out.push(K.T(BX + 110, r.y + 4.5, nm, { sz: 12.5 }) + K.T(x0 + 430, r.y + 4.5, af + ' A · ' + r.b.A + ' A', { sz: 12, c: th.dim, a: 'end' }));
      if (ln) out.push(badge(K, th, [BX + 97, r.y], ln, 8));
    }
    out.push(K.T(x0 + 430, top - 14, 'draw · breaker', { sz: 10.5, c: th.faint, a: 'end' }));
    if (busP) out.push(K.T(x0, busBot + 30, 'Bus bar, ' + busP.breakers + ' breakers and the wire: ' + r1(busP.kg + (wire ? wire.kg : 0)) + ' kg. Loads return through the airframe.', { sz: 11.5, c: th.dim }));
    return out;
  }
  // ELECTRICS' plan into a box: the plane from above (its picture faint), the fuel bay hatched, the wire runs by circuit,
  // the lamps numbered (bs: the badges' radius), the battery, the bus, the machines. Returns what the rest needs.
  function xrayPlan(D, o, th, K, pic, box, out, bs) {
    const M = D.model, E = D.elec, Tk = D.tanks, Wc = (th.base || th) === THEMES.sheet ? WIRE.sheet : WIRE.dark;
    const m = planMap(pic, box), N = m.N, FUEL = CAT.engine;
    out.push(`<defs><filter id="xg"><feColorMatrix type="saturate" values="0"/></filter><pattern id="xf" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="${FUEL}" stroke-width="2.2"/></pattern></defs>`);
    out.push(picImg(pic, m, (th.base || th) === THEMES.sheet ? 0.4 : 0.34, 'xg'));
    const wf = M.nodes.filter(n => M.tags[n[4]] === 'WF'), wr = M.nodes.filter(n => M.tags[n[4]] === 'WR');
    const near = (arr, z) => arr.slice().sort((a, b) => Math.abs(a[2] - z) - Math.abs(b[2] - z))[0];
    const semi = M.semi;
    // the fuel bay, hatched
    const v0 = Tk.vessels[0];
    let fuelP = null;
    if (v0 && v0.bayRes) {
      const B = v0.bayRes;
      if (B.on === 'wing' && B.span) for (const sg of [1, -1]) {
        const z0 = sg * B.span[0] * semi, z1 = sg * B.span[1] * semi;
        const p = [[near(wf, z0)[0] + 0.05, 0, z0], [near(wf, z1)[0] + 0.05, 0, z1], [near(wr, z1)[0] - 0.05, 0, z1], [near(wr, z0)[0] - 0.05, 0, z0]].map(N);
        out.push(`<path d="M${p.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' L')} Z" fill="url(#xf)" fill-opacity=".6" stroke="${FUEL}" stroke-width="1.5" stroke-dasharray="5 4"/>`);
        if (sg > 0) fuelP = [(p[1][0] + p[2][0]) / 2 + 14, (p[1][1] + p[2][1]) / 2];
      } else if (B.x0 != null) {
        const s0 = byTag(M, 'S0TR')[0] || [0, 0, 0.3], hw = Math.abs(s0[2]);
        const p = [[B.x0, 0, -hw * 0.8], [B.x0, 0, hw * 0.8], [B.x1 - 0.02, 0, hw * 0.95], [B.x1 - 0.02, 0, -hw * 0.95]].map(N);
        out.push(`<path d="M${p.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' L')} Z" fill="url(#xf)" fill-opacity=".75" stroke="${FUEL}" stroke-width="1.5"/>`);
        fuelP = [Math.max(p[1][0], p[2][0]) + 16, (p[0][1] + p[2][1]) / 2];
      }
    }
    // the plan's runs, by circuit
    const fw = mean(byTag(M, 'S0BL').concat(byTag(M, 'S0BR'))), panel = mean(byTag(M, 'S0TL').concat(byTag(M, 'S0TR')));
    const eng = M.prop.at || fw, fin = byTag(M, 'FIN')[0] || mean(byTag(M, 'VF'));
    const tipL = wf.reduce((a, q) => (q[2] < a[2] ? q : a), wf[0]), tipR = wf.reduce((a, q) => (q[2] > a[2] ? q : a), wf[0]);
    const tail = M.nodes.reduce((a, q) => (q[0] > a[0] && Math.abs(q[2]) < 0.3 ? q : a), [0, 0, 0]);
    const battery = [fw[0] - 0.12, fw[1], 0.12], bus = [panel[0] + 0.25, panel[1], -0.1], bay = E.litePos.bayFrac;
    const wAt = z => { const q = near(wf, z); return [q[0] - 0.05, q[1], z]; };
    const lamp = { nav: [[tipL[0], 0, tipL[2] - 0.05], [tipR[0], 0, tipR[2] + 0.05], [tail[0] + 0.05, 0, 0]], beacon: [[fin[0], 0, 0]],
                   land: [wAt(bay * semi)], taxi: [wAt(-bay * semi)], cabin: [[panel[0] + 0.9, 0, 0]] };
    const CABIN = ['flood', 'instr', 'pedal', 'pax'];
    const fit = k => E.lamps.some(l => (k === 'cabin' ? CABIN.includes(l.key) : l.key === k));
    const amps = k => E.lamps.filter(l => (k === 'cabin' ? CABIN.includes(l.key) : l.key === k)).reduce((a, l) => a + l.amps, 0);
    const run = (a, b, c, w) => { const A = N(a), B = N(b), m1 = N([a[0], 0, 0]), m2 = N([b[0], 0, 0]); return `<path d="M${A[0].toFixed(1)} ${A[1].toFixed(1)} L${m1[0].toFixed(1)} ${m1[1].toFixed(1)} L${m2[0].toFixed(1)} ${m2[1].toFixed(1)} L${B[0].toFixed(1)} ${B[1].toFixed(1)}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linejoin="round"/>`; };
    const lampNo = {};
    if (E.hasBus) {
      for (const k in lamp) if (fit(k)) for (const p of lamp[k]) out.push(run(bus, p, Wc.light, 1.5));
      out.push(run(battery, bus, Wc.power, 3));
      if (E.altA) out.push(run([eng[0] + 0.15, 0, -0.12], bus, Wc.charge, 2.2));
      for (const k in lamp) if (fit(k)) for (const p of lamp[k]) { const q = N(p);
        out.push(SYM.lamp(q[0], q[1], k === 'beacon' ? th.bad : Wc.light, th.bg)); }
      const part = k => E.parts.find(p => p.key === k), alt = part('alternator'), st = part('starter');
      const can = (p, d, ln, c, t) => { const q = N(p); out.push(SYM.mach(q[0], q[1], c, th.bg, t, Math.max(7, d * m.k * 0.9))); };
      if (alt) can([eng[0] + 0.15, 0, -0.12], alt.dia, alt.len, Wc.charge, '');
      if (st) can([eng[0] + 0.1, 0, 0.13], st.dia, st.len, Wc.power, '');
      const bq = N(bus); out.push(`<rect x="${(bq[0] - 2.5).toFixed(1)}" y="${(bq[1] - 10).toFixed(1)}" width="5" height="20" rx="1" fill="${th.ink}"/>`);
      const bt = N(battery); out.push(SYM.batt(bt[0], bt[1], Wc.power));
      // the lamp numbers, beside each lamp
      let num = 0;
      for (const k of ['nav', 'land', 'taxi', 'beacon', 'cabin']) { if (!fit(k)) continue; lampNo[k] = ++num;
        for (const p of lamp[k]) { const q = N(p), dx = k === 'cabin' ? 20 : p[2] > 0.3 ? 17 : p[2] < -0.3 ? -17 : 17, dy = k === 'nav' && Math.abs(p[2]) < 0.3 ? 14 : -15;
          out.push(badge(K, th, [q[0] + dx * bs / 9, q[1] + dy * bs / 9], num, bs)); } }
    }
    return { fuelP, v0, lampNo, amps };
  }
  function pageXray(D, o, th, K) {
    const M = D.model, E = D.elec, Tk = D.tanks, pic = o.pics && o.pics.plan, Wc = (th.base || th) === THEMES.sheet ? WIRE.sheet : WIRE.dark;
    const words = E.altA ? (E.elec.alternator === 'gen20' ? 'generator' : 'alternator') : 'battery';
    const out = head(th, K, o, 'Electrics · and the fuel',
      E.hasBus ? 'Every light on: ' + r1(E.night.A) + ' A of the ' + (E.altA ? E.altA + ' A ' + words : 'battery') : 'No battery, no lights: hand-propped',
      E.hasBus && E.dark.min != null ? 'With the ' + words + ' dead at night, the battery lasts ' + r0(E.dark.min) + ' min (the game\'s own bus, run down to 9 V).' : '');
    if (!pic || !pic.frame) return out;
    const XP = xrayPlan(D, o, th, K, pic, { x: 40, y: 150, w: 640, h: 500 }, out, 9), fuelP = XP.fuelP, v0 = XP.v0, lampNo = XP.lampNo, amps = XP.amps;
    if (E.hasBus) out.push(...schematic(E, th, K, 730, 150, 600, lampNo));
    if (fuelP && v0) {
      out.push(badge(K, th, fuelP, 'F', 9));
      out.push(badge(K, th, [52, 668], 'F', 9) + K.T(68, 672, 'Fuel: ' + r0(v0.litres) + ' L' + (v0.bayRes && v0.bayRes.on === 'wing' ? ' (' + r0(v0.litres / 2) + ' L a side)' : ' in the nose') + ', ' + r0(v0.contentsKg) + ' kg; the ' +
        (v0.bayRes ? v0.bayRes.name.toLowerCase() : 'bay') + ' could take ' + r0(v0.bayRes ? v0.bayRes.litres : 0) + ' L', { sz: 13 }));
    }
    // the budget, by circuit
    if (E.hasBus) {
      const by = 714, bx = 40, bw = W - 80, full = Math.max(E.altA, E.night.A) * 1.08, sc = bw / full; let x = bx;
      out.push(K.T(40, by - 12, 'THE POWER BUDGET AT NIGHT, AMPS', { sz: 11, c: th.faint, w: 600, ls: 1.2 }));
      const seg = (a, col, lab) => { const w = a * sc; out.push(`<rect x="${x.toFixed(1)}" y="${by}" width="${Math.max(0, w - 1.5).toFixed(1)}" height="15" rx="2" ${K.fillAttr(col, 0.85)}/>`);
        if (lab && w > lab.length * 6.8 + 6) out.push(K.T(x + 2, by + 33, lab, { sz: 12.5, c: th.dim })); x += w; };
      const pA = E.loads.filter(l => !l.av).reduce((a, l) => a + l.amps, 0), aA = E.loads.filter(l => l.av).reduce((a, l) => a + l.amps, 0);
      if (pA) seg(pA, Wc.panel, 'instruments ' + r1(pA)); if (aA) seg(aA, Wc.av, 'radios ' + r1(aA));
      for (const k of ['land', 'taxi', 'nav', 'beacon', 'cabin']) if (amps(k)) seg(amps(k), Wc.light, k + ' ' + r1(amps(k)));
      if (E.altA) { const ax = bx + E.altA * sc; out.push(K.L([ax, by - 10], [ax, by + 24], Wc.charge, 2.4) + K.T(ax - 5, by - 14, words + ' makes ' + E.altA + ' A', { sz: 13, a: 'end', w: 600, c: th.ink })); }
    }
    return out;
  }

  // ===================================================================================================================
  // WHAT THE SIM FLIES - the plan large on the left (nose up), the side view and the key on the right
  // ===================================================================================================================
  // the model's three views drawn through the maps V ({ plan, front, side }.f: model point -> page point) at one scale s
  // (the desktop's three-view and the phone's stacked one share it)
  function modelDraw(D, o, th, K, V, s, out) {
    const M = D.model, n = M.nodes, Dp = M.prop.D || 1.8, eng = M.prop.at || [0, 1, 0];
    const discs = (M.prop.discs && M.prop.discs.length) ? M.prop.discs : [[eng[0], eng[1], 0, 0]];
    out.push(`<defs><filter id="mg"><feColorMatrix type="saturate" values="0"/></filter><pattern id="mh" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="${CAT.fittings}" stroke-width="1.8"/></pattern></defs>`);
    // the ghosts: picture pixel = R(rot) proj(p) s + o (fitFrame), so proj(p) = R(-rot)(pixel - o) / s
    for (const vk of ['plan', 'side', 'front']) { const pc = o.pics && o.pics[vk]; if (!pc || !pc.frame) continue;
      const O = V[vk].f([0, 0, 0]), f = V[vk].sc / pc.s;
      out.push(`<image href="${pc.href}" width="${pc.W}" height="${pc.H}" transform="translate(${O[0].toFixed(2)} ${O[1].toFixed(2)}) scale(${f.toFixed(5)}) rotate(${(-(pc.frame.rot || 0)).toFixed(2)}) translate(${-pc.frame.ox} ${-pc.frame.oy})" opacity="${th.ghost}" filter="url(#mg)"/>`); }
    const quad = (st, P, hatch) => {
      const F0 = P3(M, st[0]), F1 = P3(M, st[1]), R0 = P3(M, st[2]), R1 = P3(M, st[3]), ch = st[4], cs = hatch ? st[6] : 0;
      const at = (F, R, t) => { const d = [0, 1, 2].map(q => R[q] - F[q]), Ln = Math.hypot(...d) || 1; return [0, 1, 2].map(q => F[q] + d[q] / Ln * ch * (t - 0.15)); };
      const hinge = 1 - cs, poly = (pts, attr) => `<path d="M${pts.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' L')} Z" ${attr}/>`;
      return poly([at(F0, R0, 0), at(F1, R1, 0), at(F1, R1, hinge), at(F0, R0, hinge)].map(P), K.fillAttr(CAT.structure, (th.base || th) === THEMES.sheet ? 0.32 : 0.18)) +
        (cs > 0 ? poly([at(F0, R0, hinge), at(F1, R1, hinge), at(F1, R1, 1), at(F0, R0, 1)].map(P), `fill="url(#mh)" stroke="${CAT.fittings}" stroke-width="0.9"`) : '');
    };
    const pl = V.plan.f, sd = V.side.f, fr = V.front.f;
    for (const st of M.strips) if (M.KIND[st[5]] !== 'fin') out.push(quad(st, pl, true));
    for (const st of M.strips) if (M.KIND[st[5]] === 'fin') out.push(quad(st, sd, true));
    for (const st of M.strips) out.push(quad(st, fr, false));
    for (const b of M.beams) { if (b[3]) continue; const A = P3(M, b[0]), B = P3(M, b[1]); out.push(K.L(pl(A), pl(B), th.member, 0.7) + K.L(sd(A), sd(B), th.member, 0.6) + K.L(fr(A), fr(B), th.member, 0.6)); }
    const ring = (q, rr) => `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${rr.toFixed(1)}" fill="${th.ink}" fill-opacity=".1" stroke="${th.ink}" stroke-width="1.3" stroke-dasharray="4 3"/>`;
    const drag = (p, a) => { const r = Math.sqrt(Math.max(0, a) / Math.PI); out.push(ring(pl(p), r * s) + ring(sd(p), r * s) + ring(fr(p), r * s)); };
    if (M.drag.fwd) drag(M.drag.fwd, M.drag.cda[0]);
    if (M.drag.aft) drag(M.drag.aft, (M.drag.cdaAft[1] || 0) * 0.25);
    for (const q of discs) { const c = fr([q[0], q[1], q[2]]);
      out.push(K.L(pl([q[0], 0, q[2] - Dp / 2]), pl([q[0], 0, q[2] + Dp / 2]), CAT.engine, 3) + K.L(sd([q[0], q[1] - Dp / 2, 0]), sd([q[0], q[1] + Dp / 2, 0]), CAT.engine, 2.6) +
        `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${(Dp / 2 * s).toFixed(1)}" fill="${CAT.engine}" fill-opacity=".08" stroke="${CAT.engine}" stroke-width="2"/>`); }
    const box = (q, h) => `<rect x="${(q[0] - h).toFixed(1)}" y="${(q[1] - h).toFixed(1)}" width="${2 * h}" height="${2 * h}" ${K.fillAttr(CAT.gear, 0.95)}/>`;
    for (const i of M.contacts) { const p = P3(M, i); out.push(box(pl(p), 4.5) + box(sd(p), 4) + box(fr(p), 4)); }
    if (M.floats) for (const q of byTag(M, 'FLK')) out.push(box(pl(q), 2.5) + box(fr(q), 2.5));
    const dot = (q, r) => `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${r.toFixed(1)}" fill="${th.ink}" fill-opacity=".72"/>`;
    for (const q of n) if (q[3] > 0.05) { const r = Math.sqrt(q[3]); out.push(dot(pl(q), Math.max(1.1, r * 1.1)) + dot(sd(q), Math.max(0.9, r * 0.85)) + dot(fr(q), Math.max(0.9, r * 0.85))); }
  }
  function pageModel(D, o, th, K) {
    // THE THREE VIEWS, as large as the sheet allows: from above (nose up) on the left, the side and the front on the right
    // at one scale, one legend row under them. The rendered plane is the grey ghost behind each view (its fitted frame).
    const M = D.model, n = M.nodes;
    const out = head(th, K, o, 'Physics · what the sim flies', n.length + ' masses, ' + M.beams.length + ' members, ' + M.strips.length + ' lifting panels');
    const Dp = M.prop.D || 1.8, eng = M.prop.at || [0, 1, 0];
    // the discs where the blades are drawn (66c prop.discs); data from before them: one disc at the engine's flange
    const discs = (M.prop.discs && M.prop.discs.length) ? M.prop.discs : [[eng[0], eng[1], 0, 0]];
    const VIEW = { plan: p => [p[2], p[0]], side: p => [p[0], -p[1]], front: p => [-p[2], -p[1]] };
    const ext = vk => { const pts = n.map(q => VIEW[vk](q)), r = Dp / 2;
      for (const q of discs) for (const d of [[0, -r, -r], [0, r, r], [0, r, -r], [0, -r, r]]) pts.push(VIEW[vk]([q[0], q[1] + d[1], q[2] + d[2]]));
      const u = pts.map(q => q[0]), v = pts.map(q => q[1]); return [Math.min(...u), Math.max(...u), Math.min(...v), Math.max(...v)]; };
    const E = { plan: ext('plan'), side: ext('side'), front: ext('front') };
    // A TRUE THREE-VIEW AT ONE SCALE: from above (nose up) over the front view, the two sharing the span's axis; the side
    // view beside the front, the two sharing the height's; the legend above the side view. One scale s for all three,
    // the largest the sheet holds: the span column and the length column side by side, the plan and the front stacked.
    const LEFT = 44, RIGHT = W - 44, TOP = 136, BOT = H - 56, GH = 56, GV = 50;   // (BOT clear of the signature)
    const half = Math.max(Math.abs(E.plan[0]), Math.abs(E.plan[1]), Math.abs(E.front[0]), Math.abs(E.front[1]));
    const lenP = E.plan[3] - E.plan[2], lenS = E.side[1] - E.side[0], hgt = Math.max(E.side[3], E.front[3]) - Math.min(E.side[2], E.front[2]);
    const s = Math.min((RIGHT - LEFT - GH) / (2 * half + lenS), (BOT - TOP - GV) / (lenP + hgt), 90);
    const wL = 2 * half * s, wR = lenS * s, hP = lenP * s, hV = hgt * s, spare = (BOT - TOP - GV) - hP - hV;
    const xc = LEFT + wL / 2, xR = LEFT + wL + GH + Math.max(0, (RIGHT - LEFT - GH - wL - wR) / 2);
    const yP = TOP + Math.max(0, spare) / 3, yV = yP + hP + GV + Math.max(0, spare) / 3, vTop = Math.min(E.side[2], E.front[2]);
    const V = { plan: { sc: s, f: p => [xc + p[2] * s, yP + (p[0] - E.plan[2]) * s] },
                front: { sc: s, f: p => [xc - p[2] * s, yV + (-p[1] - vTop) * s] },
                side: { sc: s, f: p => [xR + (p[0] - E.side[0]) * s, yV + (-p[1] - vTop) * s] } };
    const lab = (x, y, t) => out.push(K.T(x, y, t, { sz: 11, c: th.faint, w: 600, ls: 1.2 }));
    lab(LEFT, yP - 14, 'FROM ABOVE'); lab(LEFT, yV - 14, 'FROM THE FRONT'); lab(xR, yV - 14, 'FROM THE SIDE');
    // the projection lines between the views: faint, the span's ends from the plan down to the front, the height's across
    { const zs2 = [E.plan[0], E.plan[1]], dash = '2 5';
      for (const z of zs2) out.push(K.L([xc + z * s, yP + hP + 6], [xc + z * s, yV - 22], th.member, 0.8, dash));
      for (const y of [E.side[2], E.side[3]]) out.push(K.L([xc + half * s + 8, yV + (y - vTop) * s], [xR - 8, yV + (y - vTop) * s], th.member, 0.8, dash)); }
    modelDraw(D, o, th, K, V, s, out);
    // the legend: a list above the side view, then a scale bar (the three views share it)
    const kg = n.reduce((a, q) => a + q[3], 0);
    let LY = yP + 6;
    const KEY = [
      [(x, y) => `<circle cx="${x + 8}" cy="${y - 4}" r="5.5" fill="${th.ink}" fill-opacity=".72"/>`, n.length + ' masses, ' + r0(kg) + ' kg', 'a dot\'s size is its weight'],
      [(x, y) => K.L([x, y - 4], [x + 16, y - 4], th.ink, 1), M.beams.length + ' members', 'springs that bend and break'],
      [(x, y) => `<rect x="${x}" y="${y - 10}" width="16" height="12" ${K.fillAttr(CAT.structure, 0.4)}/>`, M.strips.length + ' lifting panels', ''],
      [(x, y) => `<rect x="${x}" y="${y - 10}" width="16" height="12" fill="url(#mh)" stroke="${CAT.fittings}"/>`, 'control surfaces', ''],
      [(x, y) => `<circle cx="${x + 8}" cy="${y - 4}" r="7" fill="${th.ink}" fill-opacity=".1" stroke="${th.ink}" stroke-dasharray="3 2"/>`, 'body drag area', ''],
      [(x, y) => K.L([x, y - 4], [x + 16, y - 4], CAT.engine, 3), 'propeller, ' + Dp.toFixed(2) + ' m', ''],
      [(x, y) => `<rect x="${x + 3}" y="${y - 8.5}" width="9" height="9" ${K.fillAttr(CAT.gear, 0.95)}/>`, M.floats ? 'float keels, wheels' : 'wheels', ''],
      [(x, y) => `<rect x="${x}" y="${y - 10}" width="16" height="12" rx="3" fill="${th.ink}" fill-opacity="${Math.min(0.35, th.ghost)}"/>`, 'the rendered plane', '']];
    const room = yV - 34 - LY, step = Math.max(22, Math.min(30, room / (KEY.length + 1.4)));
    for (const [mk, t] of KEY) { out.push(mk(xR, LY) + K.T(xR + 26, LY, t, { sz: 13.5, c: th.ink })); LY += step; }
    { const m = s >= 40 ? 1 : 2, y = LY + 6; out.push(K.L([xR, y], [xR + 2 * m * s, y], th.ink, 1.4) + K.L([xR, y - 4], [xR, y + 4], th.ink, 1.2) + K.L([xR + m * s, y - 3], [xR + m * s, y + 3], th.ink, 1) +
        K.L([xR + 2 * m * s, y - 4], [xR + 2 * m * s, y + 4], th.ink, 1.2) + K.T(xR + 2 * m * s + 8, y + 4, (2 * m) + ' m', { sz: 12.5, c: th.dim })); }
    if (o.note) out.push(K.T(48, H - 32, o.note, { sz: 12, c: th.warn }));
    return out;
  }

  // ===================================================================================================================
  // REFERENCE: the plane against the real one it stands for, scored as REAL-FIGURES scores it (the data baked by
  // tools/fiche_reference_bake.js from real_report.js scorePlane): the global score, the triangle, the three sections,
  // then every item's discrepancy, "ours vs real"
  // ===================================================================================================================
  const REF_LABEL = { span: 'span', S: 'wing area', length: 'length', cRoot: 'root chord', cTip: 'tip chord', hSpan: 'tailplane span', Sh: 'tailplane area', Sv: 'fin area',
    track: 'wheel track', height: 'height', engine: 'engine', hp: 'power', nE: 'engines', propD: 'propeller diameter', blades: 'blades', empty: 'empty weight',
    mtow: 'max weight', fuelL: 'fuel', seats: 'seats', Vs1: 'stall, clean', V75: 'cruise 75 %', Vmax: 'top speed', roc: 'rate of climb', roc2: 'climb, 2nd weight',
    LD: 'best glide', TO: 'take-off roll', TO50: 'take-off to 50 ft', LDG: 'landing roll', LDG50: 'landing from 50 ft', TOW: 'water run', TOW2: 'water run, 2nd weight', TOWs: 'water time', TOW50: 'water to 50 ft' };
  const REF_UNIT = { span: 'm', S: 'm²', length: 'm', cRoot: 'm', cTip: 'm', hSpan: 'm', Sh: 'm²', Sv: 'm²', track: 'm', height: 'm', hp: 'hp', propD: 'm', empty: 'kg', mtow: 'kg',
    fuelL: 'L', Vs1: 'km/h', V75: 'km/h', Vmax: 'km/h', roc: 'm/s', roc2: 'm/s', LD: ':1', TO: 'm', TO50: 'm', LDG: 'm', LDG50: 'm', TOW: 'm', TOW2: 'm', TOWs: 's', TOW50: 'm' };
  const REF_DEC = { span: 2, S: 1, length: 2, cRoot: 2, cTip: 2, hSpan: 2, Sh: 2, Sv: 2, track: 2, height: 2, propD: 2, roc: 1, roc2: 1, LD: 1, TOWs: 1 };
  const REF_TEN = [1, 0.1, 0.01, 0.001];
  const refVal = (v, k) => { const d = REF_DEC[k] || 0; if (Array.isArray(v)) { const a = Math.min(...v), b = Math.max(...v); return Math.abs(a - b) < REF_TEN[d] / 2 ? a.toFixed(d) : a.toFixed(d) + '–' + b.toFixed(d); }
    return typeof v === 'number' ? v.toFixed(d) : String(v == null ? '—' : v); };
  const wrapWords = (s, n) => { const w = String(s).split(' '), out = []; let a = ''; for (const x of w) { if ((a + ' ' + x).trim().length > n) { out.push(a.trim()); a = x; } else a += ' ' + x; } if (a.trim()) out.push(a.trim()); return out; };
  function pageReference(D, o, th, K) {
    const R = D && D.reference;
    const band = s => s == null ? [th.faint, 'no data'] : s >= 80 ? ['#6f8a3a', 'close'] : s >= 60 ? [th.warn, 'fair'] : [th.bad, 'far'];
    if (!R) { const out = head(th, K, o, 'Reference', 'No real aeroplane to set this one against'); return out; }
    const out = head(th, K, o, 'Reference · against the real one · REAL-FIGURES, ' + R.date, 'Against the ' + R.refName);
    const [gc, gw] = band(R.overall), AX = ['geometry', 'specs', 'performance'], NM = { geometry: 'Geometry', specs: 'Specs', performance: 'Performance' };
    out.push(K.T(W - 48, 112, R.overall == null ? '—' : r0(R.overall), { sz: 52, w: 600, c: gc, a: 'end' }) + K.T(W - 48, 134, '/ 100 · ' + gw + (R.conf ? ' · evidence ' + R.conf : ''), { sz: 13, c: th.dim, a: 'end' }));
    // the triangle
    const cx = 190, cy = 290, Rr = 108, ang = i => -Math.PI / 2 + i * 2 * Math.PI / 3, pt = (i, v) => [cx + Math.cos(ang(i)) * Rr * v / 100, cy + Math.sin(ang(i)) * Rr * v / 100];
    for (const lv of [25, 50, 75, 100]) out.push(`<polygon points="${AX.map((a, i) => pt(i, lv).map(v => v.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="${th.rule}" stroke-width="${lv === 100 ? 1.3 : 1}"/>`);
    AX.forEach((a, i) => out.push(K.L([cx, cy], pt(i, 100), th.rule, 1)));
    out.push(`<polygon points="${AX.map((a, i) => pt(i, R[a] || 0).map(v => v.toFixed(1)).join(',')).join(' ')}" fill="${gc}" fill-opacity=".28" stroke="${gc}" stroke-width="2"/>`);
    AX.forEach((a, i) => { const p = pt(i, R[a] || 0), q = pt(i, 128), c = band(R[a])[0]; out.push(`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="5" fill="${c}"/>`);
      out.push(K.T(q[0], q[1] + (i === 0 ? -4 : 6), NM[a], { sz: 13, w: 600, a: 'middle' }) + K.T(q[0], q[1] + (i === 0 ? 12 : 22), R[a] == null ? '—' : r0(R[a]), { sz: 13, c, w: 600, a: 'middle' })); });
    // the sections
    let sy = 196;
    for (const a of AX) { const [c, w] = band(R[a]), nI = (R.items[a] || []).length;
      out.push(K.T(380, sy, NM[a], { sz: 16, w: 600 }) + K.T(710, sy, R[a] == null ? '—' : r0(R[a]), { sz: 26, w: 600, c, a: 'end' }) + K.T(716, sy, '/ 100', { sz: 12, c: th.dim }));
      out.push(`<rect x="380" y="${sy + 10}" width="330" height="8" rx="4" fill="${th.rule}"/><rect x="380" y="${sy + 10}" width="${(3.3 * (R[a] || 0)).toFixed(1)}" height="8" rx="4" fill="${c}"/>`);
      out.push(K.T(380, sy + 36, nI + ' items · ' + w, { sz: 12, c: th.dim })); sy += 74; }
    // the references, by title
    { let by = 196; out.push(K.T(800, by - 22, 'REFERENCES', { sz: 11, c: th.faint, w: 600, ls: 1.2 }));
      const block = (hd, list) => { if (!list || !list.length) return; out.push(K.T(800, by, hd, { sz: 12, w: 600, c: th.dim })); by += 18;
        for (const t of list.slice(0, 4)) { wrapWords(t, 46).forEach((ln, i) => { if (!i) out.push(`<circle cx="804" cy="${by - 4}" r="2.2" fill="${th.dim}"/>`); out.push(K.T(814, by, ln, { sz: 12.5 })); by += 16; }); by += 4; } by += 6; };
      block('Performance', R.refs.performance); block('Dimensions', R.refs.dimensions);
      if (R.engineNote) { out.push(K.T(800, by, 'Not like for like', { sz: 12, w: 600, c: th.warn })); by += 17; for (const ln of wrapWords(R.engineNote, 50).slice(0, 3)) { out.push(K.T(800, by, ln, { sz: 12, c: th.warn })); by += 16; } } }
    // the discrepancy, item by item
    const top = 438; out.push(K.T(48, top - 22, 'THE DISCREPANCY, ITEM BY ITEM · VALUES: OURS VS REAL', { sz: 11, c: th.faint, w: 600, ls: 1.2 }));
    AX.forEach((a, ci) => {
      const x0 = 48 + ci * 372, mid = x0 + 252, span = 0.30, half = 88, X = e => mid + half * Math.max(-1, Math.min(1, e / span)), bot = H - 44;
      out.push(K.T(x0, top, NM[a], { sz: 13, w: 600 }) + K.L([mid, top + 8], [mid, bot], th.lead, 1) + K.T(X(-span), top, '−30 %', { sz: 10, c: th.faint, a: 'middle' }) + K.T(X(span), top, '+30 %', { sz: 10, c: th.faint, a: 'middle' }));
      for (const gg of [-0.3, -0.15, 0.15, 0.3]) out.push(K.L([X(gg), top + 8], [X(gg), bot], th.rule, 1, '2 3'));
      const items = (R.items[a] || []).slice().sort((p, q) => (p.score == null ? 101 : p.score) - (q.score == null ? 101 : q.score));
      const step = Math.min(34, (bot - top - 14) / Math.max(1, items.length));
      items.forEach((it, i) => {
        const y = top + 24 + i * step, e = it.e, c = band(it.score)[0], u = REF_UNIT[it.k] || '';
        const cut = (v, nn) => { v = String(v); return v.length > nn ? v.slice(0, nn - 1) + '…' : v; };
        out.push(K.T(x0, y + 1, (REF_LABEL[it.k] || it.k) + (a === 'performance' && it.src && !/^airframe/.test(it.src) ? ' (handbook)' : ''), { sz: 12.5, w: 500 }));
        const ov = typeof it.ours === 'string' ? cut(it.ours, 15) : refVal(it.ours, it.k), rv = typeof it.ref === 'string' ? cut(it.ref, 15) : refVal(it.ref, it.k);
        out.push(K.T(x0, y + 15, ov + ' vs ' + rv + (u ? ' ' + u : ''), { sz: 11.5, c: th.dim }));
        if (typeof e === 'number' && isFinite(e)) { const xa = X(0), xb = X(e);
          out.push(`<rect x="${Math.min(xa, xb).toFixed(1)}" y="${y - 2}" width="${Math.max(2, Math.abs(xb - xa)).toFixed(1)}" height="9" rx="2" fill="${c}"/>` +
            K.T(Math.abs(e) > span ? (e > 0 ? X(span) + 4 : X(-span) - 4) : xb + (e >= 0 ? 4 : -4), y + 6, (e >= 0 ? '+' : '−') + Math.abs(Math.round(e * 100)) + ' %', { sz: 10.5, c, a: e >= 0 ? 'start' : 'end', w: 600 })); }
        else out.push(K.T(mid, y + 6, it.score >= 100 ? 'the same' : 'different', { sz: 11, c, a: 'middle', w: 600 }));
      });
    });
    return out;
  }

  // ===================================================================================================================
  // COOLING: the engine's heat and the air that takes it away (ENGINE-COOLING's model, 66c genFicheCooling): the nose cut
  // open with the hot-day climb's air through it, where it is on the plane, the openings, the cost, then the three cases
  // ===================================================================================================================
  const COOL = { cold: '#4f86ab', hot: '#c4542c', ok: '#5f7a32', warnC: '#c27a3e', bad: '#b5462a', metal: '#8d877b', heat: '#e2a056' };
  const OPENING = { "the cowl's front openings": 'front openings', 'the scoop': 'scoop', "the nacelle's inlet": "nacelle's inlet",
    'the lowered bottom (the exit)': 'exit at the bottom', 'the gills': 'gills' };
  // THE NOSE CUT OPEN, into the box BX (the desktop's 660 x 376, the phone's column): the cowl, the engine, the propeller,
  // the climb's air through them; lsz the labels' size. Returns where the cowl stands (the plane picture's box)
  function coolNose(Cd, th, K, BX, out, lsz) {
    const H = Cd.cases.hot, cm2 = a => r0(a * 1e4) + ' cm²';
    // ---- THE NOSE, CUT OPEN (side view, the flight to the left), true to scale ----
    // (a pusher's nacelle has no fuselage ring at its firewall end: its cowl's own top and bottom)
    const G = Cd.geom, ey = G.y, top = ey + (G.top || 0.25), bot = ey - (G.bot || 0.4), fus = (!Cd.pushes && G.fus) || { yb: bot, yt: top };
    const xA = Math.min(G.face, G.fw), xB = Math.max(G.face, G.fw), disc = Cd.pushes ? G.face + 0.12 : G.face - 0.12, Dp = G.D || 1.8;
    const x0 = Math.min(xA, disc) - 0.55, x1 = Math.max(xB, disc) + 0.55, yLo = Math.min(bot, fus.yb) - 0.22, yHi = Math.max(top, fus.yt) + 0.22;
    const s = Math.min(BX.w / (x1 - x0), BX.h / (yHi - yLo));
    const ox = BX.x + (BX.w - (x1 - x0) * s) / 2, oy = BX.y + (BX.h - (yHi - yLo) * s) / 2;
    const X = x => ox + (x - x0) * s, Y = y => oy + (yHi - y) * s, P = (x, y) => X(x).toFixed(1) + ' ' + Y(y).toFixed(1);
    out.push(`<clipPath id="cc"><rect x="${BX.x}" y="${BX.y}" width="${BX.w}" height="${BX.h}"/></clipPath><g clip-path="url(#cc)">`);
    // the body behind the firewall, faint
    const aft = Cd.pushes ? -1 : 1, fw = G.fw;
    out.push(`<path d="M${P(fw, fus.yt)} L${P(fw + aft * 0.6, fus.yt)} M${P(fw, fus.yb)} L${P(fw + aft * 0.6, fus.yb)}" stroke="${th.lead}" stroke-width="1.2" fill="none" stroke-dasharray="5 4"/>`);
    out.push(K.L([X(fw), Y(fus.yb)], [X(fw), Y(fus.yt)], th.lead, 1.4) + K.T(X(fw) + aft * 6, Y(fus.yt) - 8, 'firewall', { sz: 11.5, c: th.faint, a: aft > 0 ? 'start' : 'end' }));
    // the engine: its heat as a glow, the crankcase, the heads end on (an air-cooled piston), a radiator (liquid), a drum (electric)
    const L0 = Math.min(Math.abs(fw - G.x) - 0.06, 2 * (G.cylZ || 0.3)), ex0 = G.x, ex1 = G.x + aft * Math.max(0.2, L0), hh = G.halfH || 0.12, cr = G.cylR || 0.08;
    const engAt = out.length;   // (a bare engine's air goes in here, under it: the cylinders stand in the stream)
    out.push(`<ellipse cx="${X((ex0 + ex1) / 2).toFixed(1)}" cy="${Y(ey).toFixed(1)}" rx="${(Math.abs(ex1 - ex0) * s * 0.9).toFixed(1)}" ry="${(hh * s * 3.2).toFixed(1)}" fill="url(#cg)"/>`);
    if (Cd.path === 'electric') out.push(`<rect x="${Math.min(X(ex0), X(ex1)).toFixed(1)}" y="${Y(ey + hh * 1.6).toFixed(1)}" width="${Math.abs(X(ex1) - X(ex0)).toFixed(1)}" height="${(hh * 3.2 * s).toFixed(1)}" rx="${(hh * s).toFixed(1)}" fill="${COOL.metal}" fill-opacity=".55" stroke="${th.ink}" stroke-width="1"/>`);
    else {
      out.push(`<rect x="${Math.min(X(ex0), X(ex1)).toFixed(1)}" y="${Y(ey + hh).toFixed(1)}" width="${Math.abs(X(ex1) - X(ex0)).toFixed(1)}" height="${(2 * hh * s).toFixed(1)}" rx="4" fill="${COOL.metal}" fill-opacity=".55" stroke="${th.ink}" stroke-width="1"/>`);
      if (Cd.path === 'air') for (const f of [0.28, 0.72]) { const cx = X(ex0 + (ex1 - ex0) * f), cy = Y(ey + hh * 0.15), rr = cr * s * 1.15;
        for (let i = 0; i < 5; i++) out.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(rr * (1 - i * 0.17)).toFixed(1)}" fill="${i === 0 ? th.bg : 'none'}" stroke="${th.ink}" stroke-opacity="${i ? 0.45 : 0.8}" stroke-width="${i ? 0.8 : 1.2}"/>`); }
    }
    // the cowl (or none): its outline, the face open where it takes the air
    const face = G.face, fT = top - 0.06, fB = bot + 0.06;
    if (Cd.kind !== 'bare') {
      out.push(`<path d="M${P(fw, fus.yt)} C${P(fw - aft * 0.25, fus.yt)} ${P(face + aft * 0.12, top)} ${P(face + aft * 0.02, fT)} M${P(fw, fus.yb)} C${P(fw - aft * 0.25, fus.yb)} ${P(face + aft * 0.12, bot)} ${P(face + aft * 0.02, fB)}" fill="none" stroke="${th.ink}" stroke-width="2.2"/>`);
      out.push(K.L([X(face), Y(ey + hh * 0.9)], [X(face), Y(fT)], th.ink, 1, '3 3') + K.L([X(face), Y(ey - hh * 0.9)], [X(face), Y(fB)], th.ink, 1, '3 3'));
    }
    // the propeller and its spinner
    out.push(K.L([X(disc), Y(ey - Dp / 2)], [X(disc), Y(ey + Dp / 2)], CAT.engine, 3) + `<ellipse cx="${X((disc + face) / 2).toFixed(1)}" cy="${Y(ey).toFixed(1)}" rx="${(Math.abs(face - disc) * s * 0.75).toFixed(1)}" ry="${(hh * s * 0.85).toFixed(1)}" fill="${th.bg}" stroke="${th.ink}" stroke-width="1.2"/>`);
    // THE AIR: one band per path, its width the air the climb PASSES (kg/s), the dashed band the air it NEEDS
    const kw = 22 / Math.max(H.need, 0.05), wOf = m => Math.max(2, Math.min(70, m * kw));
    // (the bands' gradient in page units along the flow: a straight band's box has no height, and a box-sized gradient
    // paints nothing on it)
    const xIn0 = Math.min(xA, disc) - 0.45, xEnd = Math.max(xB, disc) + 0.4;
    out.push(`<defs><linearGradient id="cf" gradientUnits="userSpaceOnUse" x1="${X(xIn0).toFixed(1)}" x2="${X(xEnd).toFixed(1)}" y1="0" y2="0"><stop offset="0" stop-color="${COOL.cold}"/><stop offset=".4" stop-color="${COOL.cold}"/><stop offset=".85" stop-color="${COOL.hot}"/></linearGradient></defs>`);
    const band = (d, m, grad, mark) => `<path d="${d}" fill="none" stroke="url(#cf)" stroke-width="${wOf(m).toFixed(1)}" stroke-opacity=".8" stroke-linecap="butt" marker-end="url(#${mark})"/>`;
    // the air needed: a dashed band of its own width round the inlet's straight run
    const needBand = (xa, xb, y, m) => { const w = wOf(m); return `<rect x="${Math.min(X(xa), X(xb)).toFixed(1)}" y="${(Y(y) - w / 2).toFixed(1)}" width="${Math.abs(X(xb) - X(xa)).toFixed(1)}" height="${w.toFixed(1)}" fill="none" stroke="${th.ink}" stroke-opacity=".6" stroke-width="1.1" stroke-dasharray="5 4"/>`; };
    const fwdIn = (Cd.parts || []).filter(p => p.faces === 'fwd'), flowM = Math.max(0, H.flow || 0), bareM = Math.max(0, H.bare || 0);
    const xIn = Math.min(xA, disc) - 0.45, labels = [];
    if (Cd.kind === 'bare') {
      // the heads in the wind: the air sweeps past them, outside
      const yy = ey + hh * 0.15, d = `M${P(xIn, yy)} L${P(xB + 0.4, yy)}`;
      out.splice(engAt, 0, band(d, bareM, 'ca', 'cm'));
      labels.push([X(xIn), Y(yy) - wOf(bareM) / 2 - 8, 'the heads in the wind · ' + cm2(Cd.bareA), 'start']);
    } else if (!Cd.pushes) {
      // a tractor: in at the face (and a scoop below it), down through the heads (a baffled cowl's downdraft), out under
      // the cowl just ahead of the firewall
      const share = A => (Cd.inA > 0 ? A / Cd.inA : 0);
      const fFace = fwdIn.filter(p => /front/.test(p.what)).reduce((a, p) => a + p.A, 0), fScoop = fwdIn.filter(p => !/front/.test(p.what)).reduce((a, p) => a + p.A, 0);
      const cx = G.x + aft * Math.max(0.12, Math.abs(ex1 - ex0) * 0.5), yF = ey + hh * 1.5, yS = bot + 0.05, xEx = fw - aft * 0.08, yEx = Math.max(fus.yb, bot) - 0.16;
      const dF = `M${P(xIn, yF)} L${P(face, yF)} C${P(cx, yF)} ${P(cx, yF)} ${P(cx, ey)} C${P(cx, bot + 0.05)} ${P(xEx, bot + 0.12)} ${P(xEx, yEx)}`;
      if (fFace > 0) { const m = flowM * share(fFace); out.push(needBand(xIn, face, yF, H.need * share(fFace)) + band(dF, m, 'ca', 'cm'));
        labels.push([X(xIn), Y(yF) - Math.max(wOf(m), wOf(H.need * share(fFace))) / 2 - 10, 'front openings · ' + cm2(fFace), 'start']); }
      if (fScoop > 0) { const m = flowM * share(fScoop), dS = `M${P(xIn, yS)} L${P(face + 0.05 * aft, yS)} C${P(xEx - aft * 0.2, yS)} ${P(xEx, yS)} ${P(xEx, yEx)}`;
        out.push(band(dS, m, 'ca', 'cm')); labels.push([X(xIn), Y(yS) + wOf(m) / 2 + 17, 'scoop · ' + cm2(fScoop), 'start']); }
      // (left of the way out, in the clear under the cowl: beside it, the label ran off the box or onto the arrow)
      labels.push([X(xEx) - aft * 16, Y(yEx) + 6, Cd.exitSized ? ((lsz || 13) < 12 ? 'out · sized for it' : 'out ahead of the firewall · sized for it') : 'out · ' + cm2(Cd.outA), aft > 0 ? 'end' : 'start']);
    } else {
      // a pusher: in at what faces the flight (a scoop, a cone, the turned bottom), out round the spinner, the propeller sucking
      const yS = bot + 0.06, yOut = ey + hh * 1.2;
      const dP = `M${P(xIn, yS)} L${P(fw, yS)} C${P(fw + 0.3, yS)} ${P(G.x - 0.2, ey - hh)} ${P(G.x, ey)} S${P(face - 0.1, yOut)} ${P(disc + 0.4, yOut)}`;
      out.push(band(dP, flowM, 'ca', 'cm'));
      labels.push([X(xIn), Y(yS) + wOf(flowM) / 2 + 16, fwdIn.map(p => (OPENING[p.what] || p.what) + ' · ' + cm2(p.A)).join(', ') || 'no inlet facing the flight', 'start']);
      labels.push([X(disc + 0.4), Y(yOut) - wOf(flowM) / 2 - 8, 'out round the spinner · ' + cm2(Cd.outA), 'end']);
    }
    out.push('</g>');
    for (const [x, y, t, a] of labels) out.push(K.T(a === 'end' ? Math.max(BX.x + String(t).length * (lsz || 13) * 0.56, Math.min(BX.x + BX.w, x)) : Math.max(BX.x, Math.min(BX.x + BX.w - String(t).length * (lsz || 13) * 0.56, x)), Math.max(BX.y + 12, Math.min(BX.y + BX.h - 4, y)), t, { sz: lsz || 13, w: 500, a }));
    return { xA, xB, top, bot, BX };
  }
  const coolDefs = () => `<defs><linearGradient id="ca" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${COOL.cold}"/><stop offset=".45" stop-color="${COOL.cold}"/><stop offset="1" stop-color="${COOL.hot}"/></linearGradient>` +
      `<linearGradient id="cb" x1="1" x2="0" y1="0" y2="0"><stop offset="0" stop-color="${COOL.cold}"/><stop offset=".45" stop-color="${COOL.cold}"/><stop offset="1" stop-color="${COOL.hot}"/></linearGradient>` +
      `<radialGradient id="cg"><stop offset="0" stop-color="${COOL.heat}" stop-opacity=".55"/><stop offset="1" stop-color="${COOL.heat}" stop-opacity="0"/></radialGradient>` +
      `<marker id="cm" viewBox="0 0 10 10" refX="2" refY="5" markerUnits="userSpaceOnUse" markerWidth="18" markerHeight="18" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="${COOL.hot}"/></marker>` +
      `<marker id="cn" viewBox="0 0 10 10" refX="2" refY="5" markerUnits="userSpaceOnUse" markerWidth="18" markerHeight="18" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="${COOL.cold}"/></marker></defs>`;
  function pageCooling(D, o, th, K) {
    const Cd = D.cooling;
    if (!Cd || Cd.kind === 'legacy' || !Cd.cases || !Cd.cases.hot) {
      return head(th, K, o, 'Cooling', Cd && Cd.kind === 'legacy' ? 'The cowl of this aeroplane was never measured' : 'No cooling to show');
    }
    const H = Cd.cases.hot, L = Cd.lines, cm2 = a => r0(a * 1e4) + ' cm²';
    const dk = (th.base || th) !== THEMES.sheet, okC = dk ? '#a3c96f' : COOL.ok, warnC = dk ? th.warn : COOL.warnC, badC = dk ? th.bad : COOL.bad;
    const mc = m => m < L.pass ? badC : m < L.warn ? warnC : okC;
    const mtxt = m => (m === 'inf' || m > 99) ? 'all the air it needs' : r1(m) + ' × the air it needs';
    const out = head(th, K, o, 'Cooling · the engine\'s heat and the air',
      (H.margin < L.pass ? 'Short of air: ' : 'Hot-day climb: ') + mtxt(H.margin),
      r0(Cd.coolKW) + ' kW of heat to shed at full power, from a ' + r0(Cd.kW) + ' kW engine' + (Cd.nEng > 1 ? ' (each)' : '') +
      ' · ' + (Cd.path === 'liquid' ? 'liquid-cooled' : Cd.path === 'electric' ? 'electric' : Cd.path === 'turbine' ? 'turbine' : 'air-cooled') +
      (Cd.kind === 'bare' ? ', no cowl: the cylinders in the wind' : Cd.pushes ? ', a pusher' : ''));
    out[0] += coolDefs();
    const NOSE = coolNose(Cd, th, K, { x: 48, y: 166, w: 660, h: 376 }, out, 13), BX = NOSE.BX, xA = NOSE.xA, xB = NOSE.xB, top = NOSE.top, bot = NOSE.bot;
    out.push(K.T(48, 156, 'THE NOSE, CUT OPEN · THE 38 °C CLIMB\'S AIR', { sz: 11, c: th.faint, w: 600, ls: 1.2 }));
    // the key under the drawing
    const ky = BX.y + BX.h + 22;
    out.push(`<rect x="48" y="${ky - 9}" width="34" height="10" fill="url(#ca)" fill-opacity=".8"/>` + K.T(90, ky, 'the air the climb passes: cool in, hot out', { sz: 12, c: th.dim }) +
      K.L([370, ky - 4], [404, ky - 4], th.ink, 1.1, '4 3') + K.T(412, ky, 'the air it needs', { sz: 12, c: th.dim }) +
      `<circle cx="540" cy="${ky - 4}" r="7" fill="url(#cg)"/>` + K.T(552, ky, 'the heat', { sz: 12, c: th.dim }));
    // ---- RIGHT: on the plane, the openings, the cost, the remedy ----
    const RX = 752; let ry = 140;
    const pic = o.pics && o.pics.side, Mm = D.model;
    if (pic && pic.frame) { const m = sideMap(pic, { x: RX, y: ry, w: 400, h: 120 }); out.push(picImg(pic, m, 0.95));
      const c0 = m.N([xA, top]), c1 = m.N([xB, bot]); out.push(`<rect x="${Math.min(c0[0], c1[0]).toFixed(1)}" y="${Math.min(c0[1], c1[1]).toFixed(1)}" width="${Math.abs(c1[0] - c0[0]).toFixed(1)}" height="${Math.abs(c1[1] - c0[1]).toFixed(1)}" rx="4" fill="none" stroke="${COOL.hot}" stroke-width="1.8"/>`); ry += 140; }
    out.push(K.T(RX, ry, 'THE OPENINGS', { sz: 11, c: th.faint, w: 600, ls: 1.2 })); ry += 22;
    const rows = (Cd.parts || []).map(p => [OPENING[p.what] || p.what, cm2(p.A), p.faces === 'fwd' ? 'facing the flight' : 'facing aft']);
    if (Cd.bareA > 0) rows.push(['cylinder heads in the wind', cm2(Cd.bareA), 'cooled by the stream']);
    if (Cd.kind !== 'bare' && !Cd.pushes && Cd.exitSized) rows.push(['exit', 'sized for it', 'not drawn']);
    if (!rows.length) rows.push(['none', '', '']);
    for (const [a, b, c] of rows.slice(0, 5)) { out.push(K.T(RX, ry, a, { sz: 13.5 }) + K.T(RX + 250, ry, b, { sz: 13.5, w: 600, a: 'end' }) + K.T(RX + 262, ry, c, { sz: 12, c: th.dim })); ry += 21; }
    ry += 14; out.push(K.T(RX, ry, 'WHAT IT COSTS', { sz: 11, c: th.faint, w: 600, ls: 1.2 })); ry += 24;
    const dg = D.drag && D.drag.groups && D.drag.groups.cooling;
    out.push(K.T(RX, ry, Cd.kind === 'bare' ? 'the cylinders\' own drag' : 'cooling drag, ' + r0((Cd.cdA || 0) * 1e4) + ' cm² of drag area', { sz: 15, w: 600 }));
    if (dg && dg.dV > 0) out.push(K.T(RX + 400, ry, '−' + r1(dg.dV * 3.6) + ' km/h at cruise', { sz: 13.5, w: 600, c: COOL.hot, a: 'end' }));
    ry += 18; if (dg && dg.dV > 0) { out.push(K.T(RX, ry, 'with the heads and the exhaust, on the Drag page', { sz: 12, c: th.dim })); ry += 16; }
    if (H.margin < L.warn && Cd.kind !== 'bare') {
      ry += 18; out.push(K.T(RX, ry, 'TO PASS THE CLIMB (' + L.warn.toFixed(2) + ' ×)', { sz: 11, c: COOL.bad, w: 600, ls: 1.2 })); ry += 22;
      const fix = H.limit === 'outlet' && H.outPass !== 'inf' && H.outPass > 0 ? 'an outlet of ' + cm2(H.outPass) + ' (now ' + cm2(Cd.outA) + ')'
        : H.inPass !== 'inf' && H.inPass > 0 ? 'an inlet facing the flight of ' + cm2(H.inPass) + ' (now ' + cm2(Cd.inA) + ')' : 'more air through the engine';
      out.push(K.T(RX, ry, fix, { sz: 14, w: 600 }));
    }
    // ---- BOTTOM: the three cases ----
    const CS = [['taxi', 'Taxi', 'the ground, ' + r0(H.oatC) + ' °C, 20 % power'], ['hot', 'Climb', r0(H.oatC) + ' °C day, full power'], ['cruise', 'Cruise', r0((Cd.cases.cruise || {}).oatC || 15) + ' °C, 75 % power']];
    const by = 600, bw = 352, mx = Math.max(...CS.map(([k]) => Cd.cases[k] ? Math.max(Cd.cases[k].need, Cd.cases[k].pass) : 0)) || 1;
    out.push(K.L([48, by - 22], [W - 48, by - 22], th.hair, 1));
    CS.forEach(([k, nm, cond], i) => {
      const c = Cd.cases[k]; if (!c) return;
      const x = 48 + i * (bw + 24), col = mc(c.margin === 'inf' ? 99 : c.margin), bl = bw - 120;
      out.push(K.T(x, by, nm, { sz: 16, w: 600 }) + K.T(x + 58, by, cond + (c.V > 0 ? ', ' + r0(c.V * 3.6) + ' km/h' : ''), { sz: 12, c: th.dim }));
      out.push(K.T(x, by + 34, (c.margin === 'inf' || c.margin > 99) ? '—' : r1(c.margin) + ' ×', { sz: 30, w: 600, c: col }));
      out.push(K.T(x + 104, by + 22, r1(c.Q) + ' kW of heat', { sz: 12.5 }) + K.T(x + 104, by + 38, c.margin < L.pass ? 'not enough air' : c.margin < L.warn ? 'just enough' : 'enough air', { sz: 12.5, c: col, w: 600 }));
      // need against passed
      const bx = x, b1 = by + 58, sx = bl / mx;
      out.push(`<rect x="${bx}" y="${b1}" width="${(c.pass * sx).toFixed(1)}" height="11" rx="2" fill="url(#ca)" fill-opacity=".8"/>` + K.T(bx + bl + 8, b1 + 10, r1(c.pass) + ' kg/s passed', { sz: 12 }));
      out.push(`<rect x="${bx}" y="${b1 + 17}" width="${(c.need * sx).toFixed(1)}" height="11" rx="2" fill="none" stroke="${th.ink}" stroke-dasharray="4 3"/>` + K.T(bx + bl + 8, b1 + 27, r1(c.need) + ' kg/s needed', { sz: 12, c: th.dim }));
      // the oil needle against its red line
      if (c.oilC != null) { const o0 = 0, o1 = 140, ox2 = bx, oyy = b1 + 52, ow = bl, ox_ = t => ox2 + ow * Math.max(0, Math.min(1, (t - o0) / (o1 - o0)));
        out.push(`<rect x="${ox2}" y="${oyy - 5}" width="${ow}" height="6" rx="3" fill="${th.rule}"/><rect x="${ox_(L.oilRed).toFixed(1)}" y="${oyy - 5}" width="${(ox2 + ow - ox_(L.oilRed)).toFixed(1)}" height="6" fill="${COOL.bad}" fill-opacity=".6"/>` +
          `<circle cx="${ox_(c.oilC).toFixed(1)}" cy="${oyy - 2}" r="5.5" fill="${c.oilC >= L.oilRed ? COOL.bad : th.ink}"/>` + K.T(bx + bl + 8, oyy + 2, 'oil ' + r0(c.oilC) + ' °C', { sz: 12, w: 600 }));
        out.push(K.T(ox_(L.oilRed), oyy + 16, 'red line ' + L.oilRed + ' °C', { sz: 10.5, c: COOL.bad, a: 'middle' })); }
      out.push(K.T(x, by + 150, c.margin === 'inf' ? '' : 'limited by ' + (c.limit === 'outlet' ? 'the outlet' : c.limit === 'engine' ? 'the engine\'s own passages' : Cd.kind === 'bare' ? 'the heads\' own area' : 'the inlet'), { sz: 12, c: th.dim }));
    });
    return out;
  }
  // THE PHONE (AIRCRAFT-LOOKS' spec, 13 Nov): ctx.layout.screen 'phone' - one column, w wide (320-480, design 360), as tall
  // as it needs, on the black sheet, drawn with the shared kit (fiche_kit.js FICHE_KIT). A section without its phone
  // layout yet draws its desktop sheet scaled to w (the spec's fallback).
  // ===================================================================================================================
  const KIT = () => (root && root.FICHE_KIT) || (typeof require === 'function' ? require('./fiche_kit.js') : null);
  const kitPalette = (th, o) => ({ paper: th.bg, ink: th.ink, dim: th.dim, faint: th.faint, line: th.hair,
                                   acc: (o.tokens && o.tokens.acc) || ((th.base || th) === THEMES.sheet ? '#b5652e' : '#e0915a'), dark: (th.base || th) !== THEMES.sheet });
  function phoneHead(C, o, eyebrowText, title, sub) {
    const nm = (o.name || '') + (o.reg ? '  ' + o.reg : '');
    if (nm) C.text(nm, { sz: 13, w8: 600, gap: 2 });
    C.eyebrow(eyebrowText); C.title(title);
    if (sub) C.text(sub, { sz: 13.5, c: 'dim' });
  }
  function phoneDrag(D, o, th, K, C) {
    const M = D.model, Dg = D.drag, pic = o.pics && o.pics.side, at = dragAt(D), nm = dragName(Dg);
    const rows = Object.keys(Dg.groups).filter(g => DRAGROW[g]).sort((a, b) => Dg.groups[b].dV - Dg.groups[a].dV);
    const big = rows.filter(g => g !== 'fuselage')[0] || rows[0];
    phoneHead(C, o, 'Drag · where the speed goes', 'Your ' + nm(big).replace('*', '').toLowerCase() + ' cost ' + r0(Dg.groups[big].dV * 3.6) + ' km/h',
      'Cruise ' + r0(Dg.Vc * 3.6) + ' km/h · each disc a flat plate of the same drag, to scale');
    // the plane, its discs numbered as the list below ranks them
    if (pic && pic.frame) C.gap(8).figure(C.inner * 0.46, (x, y, w, h) => {
      const m = sideMap(pic, { x, y, w, h }), s = [picImg(pic, m, (th.base || th) === THEMES.sheet ? 1 : 0.92)], its = [];
      rows.forEach((g, i) => { if (!at[g]) return; const q = m.N(at[g]); its.push({ q, r: Math.max(2.5, Math.sqrt(Dg.groups[g].cda / Math.PI) * m.k), col: CAT[DRAGROW[g][1]], n: i + 1 }); });
      for (const it of its.slice().sort((a, b) => b.r - a.r)) s.push(`<circle cx="${it.q[0].toFixed(1)}" cy="${it.q[1].toFixed(1)}" r="${it.r.toFixed(1)}" ${K.fillAttr(it.col)}/>`);
      // the badges off their discs, pushed apart where parts crowd (a leader back to the disc when moved)
      const put = [];
      for (const it of its) { let bx = Math.min(x + w - 9, it.q[0] + it.r * 0.7 + 7), by = Math.max(y + 9, it.q[1] - it.r * 0.7 - 7), k2 = 0;
        while (put.some(p => Math.hypot(p[0] - bx, p[1] - by) < 16.5) && k2++ < 12) { if (k2 % 2) by -= 16; else bx += 16; if (by < y + 9) { by = y + 9; bx += 16; } bx = Math.min(x + w - 9, bx); }
        put.push([bx, by]);
        if (k2) s.push(K.L([it.q[0], it.q[1]], [bx, by], th.lead, 0.8));
        s.push(badge(K, th, [bx, by], it.n, 7.5)); }
      return s.join('');
    });
    C.label('What each part costs at cruise');
    C.rows(rows.map((g, i) => [(i + 1) + '  ' + nm(g), '−' + r1(Dg.groups[g].dV * 3.6) + ' km/h', Dg.groups[g].cda.toFixed(3) + ' m² of flat plate', CAT[DRAGROW[g][1]]]));
    const tot = Dg.axial + Dg.surf;
    C.label('All of the drag at cruise: ' + tot.toFixed(2) + ' m²');
    C.gap(6).figure(14, (x, y, w) => { let xx = x; const s = [];
      const seg = (v, col, op) => { const ww = w * v / tot; s.push(`<rect x="${xx.toFixed(1)}" y="${y}" width="${Math.max(0, ww - 1).toFixed(1)}" height="12" rx="2" ${K.fillAttr(col, op)}/>`); xx += ww; };
      seg(Dg.surf, th.faint, 0.3); for (const g of rows.slice().sort((a, b) => Dg.groups[b].cda - Dg.groups[a].cda)) seg(Dg.groups[g].cda, CAT[DRAGROW[g][1]]);
      return s.join(''); });
    C.text('The grey: the wings and the tail, lifting, ' + r0(100 * Dg.surf / tot) + ' %.', { sz: 12.5, c: 'dim' });
    C.text(Dg.floats ? '* the core charges the floats as the wheeled gear they replace: the hulls have no air drag of their own yet'
      : 'Each km/h: the cruise worked out again with only that part\'s drag taken off. They do not add up.', { sz: 12, c: Dg.floats ? th.warn : 'faint' });
  }
  function phoneCooling(D, o, th, K, C) {
    const Cd = D.cooling;
    if (!Cd || Cd.kind === 'legacy' || !Cd.cases || !Cd.cases.hot) { phoneHead(C, o, 'Cooling', Cd && Cd.kind === 'legacy' ? 'The cowl of this aeroplane was never measured' : 'No cooling to show'); return; }
    const H = Cd.cases.hot, L = Cd.lines, cm2 = a => r0(a * 1e4) + ' cm²';
    const dk = (th.base || th) !== THEMES.sheet, okC = dk ? '#a3c96f' : COOL.ok, warnC = dk ? th.warn : COOL.warnC, badC = dk ? th.bad : COOL.bad;
    const mc = m => (m === 'inf' ? 99 : m) < L.pass ? badC : (m === 'inf' ? 99 : m) < L.warn ? warnC : okC;
    const mtxt = m => (m === 'inf' || m > 99) ? 'all the air it needs' : r1(m) + ' × the air it needs';
    phoneHead(C, o, 'Cooling · the engine\'s heat and the air', (H.margin < L.pass ? 'Short of air: ' : 'Hot-day climb: ') + mtxt(H.margin),
      r0(Cd.coolKW) + ' kW of heat to shed at full power, from a ' + r0(Cd.kW) + ' kW engine · ' +
      (Cd.path === 'liquid' ? 'liquid-cooled' : Cd.path === 'electric' ? 'electric' : Cd.path === 'turbine' ? 'turbine' : 'air-cooled') +
      (Cd.kind === 'bare' ? ', no cowl' : Cd.pushes ? ', a pusher' : ''));
    C.push(coolDefs());
    C.label('The nose, cut open · the 38 °C climb\'s air');
    let NOSE = null;
    C.gap(4).figure(Math.round(C.inner * 0.74), (x, y, w, h) => { const s = []; NOSE = coolNose(Cd, th, K, { x, y, w, h }, s, 11); return s.join(''); });
    C.text('The band: the air the climb passes, cool in, hot out. Dashed: the air it needs. The glow: the heat.', { sz: 12, c: 'dim' });
    const pic = o.pics && o.pics.side;
    if (pic && pic.frame && NOSE) C.gap(6).figure(Math.round(C.inner * 0.3), (x, y, w, h) => {
      const m = sideMap(pic, { x, y, w, h }), c0 = m.N([NOSE.xA, NOSE.top]), c1 = m.N([NOSE.xB, NOSE.bot]);
      return picImg(pic, m, 0.95) + `<rect x="${Math.min(c0[0], c1[0]).toFixed(1)}" y="${Math.min(c0[1], c1[1]).toFixed(1)}" width="${Math.abs(c1[0] - c0[0]).toFixed(1)}" height="${Math.abs(c1[1] - c0[1]).toFixed(1)}" rx="3" fill="none" stroke="${COOL.hot}" stroke-width="1.6"/>`; });
    C.label('The openings');
    const rows = (Cd.parts || []).map(p => [OPENING[p.what] || p.what, cm2(p.A), p.faces === 'fwd' ? 'facing the flight' : 'facing aft']);
    if (Cd.bareA > 0) rows.push(['cylinder heads in the wind', cm2(Cd.bareA), 'cooled by the stream']);
    if (Cd.kind !== 'bare' && !Cd.pushes && Cd.exitSized) rows.push(['exit', 'sized for it', 'not drawn']);
    C.rows(rows.length ? rows : [['none', '']]);
    C.label('What it costs');
    const dg = D.drag && D.drag.groups && D.drag.groups.cooling;
    C.rows([[Cd.kind === 'bare' ? 'the cylinders\' own drag' : 'cooling drag, ' + r0((Cd.cdA || 0) * 1e4) + ' cm² of drag area', dg && dg.dV > 0 ? '−' + r1(dg.dV * 3.6) + ' km/h' : '', 'at cruise, with the heads and the exhaust (the Drag page)']]);
    if (H.margin < L.warn && Cd.kind !== 'bare') {
      C.label('To pass the climb (' + L.warn.toFixed(2) + ' ×)');
      C.text(H.limit === 'outlet' && H.outPass !== 'inf' && H.outPass > 0 ? 'An outlet of ' + cm2(H.outPass) + ' (now ' + cm2(Cd.outA) + ')'
        : H.inPass !== 'inf' && H.inPass > 0 ? 'An inlet facing the flight of ' + cm2(H.inPass) + ' (now ' + cm2(Cd.inA) + ')' : 'More air through the engine', { sz: 15, w8: 600, c: badC });
    }
    // the three cases, one under the other
    const CS = [['taxi', 'Taxi', 'the ground, ' + r0(H.oatC) + ' °C, 20 % power'], ['hot', 'Climb', r0(H.oatC) + ' °C day, full power'], ['cruise', 'Cruise', r0((Cd.cases.cruise || {}).oatC || 15) + ' °C, 75 % power']];
    const mx = Math.max(...CS.map(([k]) => Cd.cases[k] ? Math.max(Cd.cases[k].need, Cd.cases[k].pass) : 0)) || 1;
    for (const [k, nm, cond] of CS) {
      const c = Cd.cases[k]; if (!c) continue;
      C.rule().text(nm + ' · ' + cond + (c.V > 0 ? ', ' + r0(c.V * 3.6) + ' km/h' : ''), { sz: 13, c: 'dim', gap: 0 });
      C.figure(122, (x, y, w) => {
        const col = mc(c.margin), s = [], bl = w - 110, sx = bl / mx;
        s.push(K.T(x, y + 34, (c.margin === 'inf' || c.margin > 99) ? '—' : r1(c.margin) + ' ×', { sz: 28, w: 600, c: col }) +
          K.T(x + 104, y + 21, r1(c.Q) + ' kW of heat', { sz: 13 }) + K.T(x + 104, y + 38, c.margin < L.pass ? 'not enough air' : c.margin < L.warn ? 'just enough' : 'enough air', { sz: 13, c: col, w: 600 }));
        const b1 = y + 54;
        s.push(`<rect x="${x}" y="${b1}" width="${Math.max(1, c.pass * sx).toFixed(1)}" height="10" rx="2" fill="url(#ca)" fill-opacity=".85"/>` + K.T(x + bl + 8, b1 + 9, r1(c.pass) + ' kg/s', { sz: 12 }));
        s.push(`<rect x="${x}" y="${b1 + 15}" width="${Math.max(1, c.need * sx).toFixed(1)}" height="10" rx="2" fill="none" stroke="${th.ink}" stroke-dasharray="4 3"/>` + K.T(x + bl + 8, b1 + 24, r1(c.need) + ' needed', { sz: 12, c: th.dim }));
        if (c.oilC != null) { const oy2 = b1 + 50, ox_ = t => x + bl * Math.max(0, Math.min(1, t / 140));
          s.push(`<rect x="${x}" y="${oy2 - 5}" width="${bl}" height="6" rx="3" fill="${th.rule}"/><rect x="${ox_(L.oilRed).toFixed(1)}" y="${oy2 - 5}" width="${(x + bl - ox_(L.oilRed)).toFixed(1)}" height="6" fill="${badC}" fill-opacity=".6"/>` +
            `<circle cx="${ox_(c.oilC).toFixed(1)}" cy="${oy2 - 2}" r="5" fill="${c.oilC >= L.oilRed ? badC : th.ink}"/>` + K.T(x + bl + 8, oy2 + 2, 'oil ' + r0(c.oilC) + ' °C', { sz: 12, w: 600 }) +
            K.T(ox_(L.oilRed), oy2 + 15, 'red line ' + L.oilRed + ' °C', { sz: 10, c: badC, a: 'middle' })); }
        return s.join('');
      });
    }
  }
  function phoneReference(D, o, th, K, C) {
    const R = D && D.reference;
    const band = s => s == null ? [th.faint, 'no data'] : s >= 80 ? [(th.base || th) === THEMES.sheet ? '#6f8a3a' : '#a3c96f', 'close'] : s >= 60 ? [th.warn, 'fair'] : [th.bad, 'far'];
    if (!R) { phoneHead(C, o, 'Reference', 'No real aeroplane to set this one against'); return; }
    phoneHead(C, o, 'Reference · against the real one · REAL-FIGURES, ' + R.date, 'Against the ' + R.refName);
    const [gc, gw] = band(R.overall), AX = ['geometry', 'specs', 'performance'], NM = { geometry: 'Geometry', specs: 'Specs', performance: 'Performance' };
    // the score and the triangle, side by side
    C.gap(6).figure(150, (x, y, w) => {
      const s = [K.T(x, y + 52, R.overall == null ? '—' : r0(R.overall), { sz: 48, w: 600, c: gc }), K.T(x, y + 74, '/ 100 · ' + gw, { sz: 13, c: th.dim })];
      if (R.conf) s.push(K.T(x, y + 92, 'evidence ' + R.conf, { sz: 13, c: th.dim }));
      const cx = x + w - 78, cy = y + 80, Rr = 50, ang = i => -Math.PI / 2 + i * 2 * Math.PI / 3, pt = (i, v) => [cx + Math.cos(ang(i)) * Rr * v / 100, cy + Math.sin(ang(i)) * Rr * v / 100];
      for (const lv of [50, 100]) s.push(`<polygon points="${AX.map((a, i) => pt(i, lv).map(v => v.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="${th.rule}" stroke-width="1"/>`);
      s.push(`<polygon points="${AX.map((a, i) => pt(i, R[a] || 0).map(v => v.toFixed(1)).join(',')).join(' ')}" fill="${gc}" fill-opacity=".28" stroke="${gc}" stroke-width="2"/>`);
      AX.forEach((a, i) => { const q = pt(i, 122); s.push(K.T(q[0], q[1] + (i === 0 ? -2 : 12), NM[a].slice(0, 4) + '. ' + (R[a] == null ? '—' : r0(R[a])), { sz: 11, a: 'middle', c: band(R[a])[0], w: 600 })); });
      return s.join('');
    });
    for (const a of AX) { const [c, w] = band(R[a]);
      C.figure(44, (x, y, ww) => K.T(x, y + 18, NM[a], { sz: 15, w: 600 }) + K.T(x + ww, y + 18, (R[a] == null ? '—' : r0(R[a])) + ' / 100', { sz: 15, w: 600, c, a: 'end' }) +
        `<rect x="${x}" y="${y + 26}" width="${ww}" height="7" rx="3.5" fill="${th.rule}"/><rect x="${x}" y="${y + 26}" width="${(ww * (R[a] || 0) / 100).toFixed(1)}" height="7" rx="3.5" fill="${c}"/>` +
        K.T(x, y + 44, (R.items[a] || []).length + ' items · ' + w, { sz: 12, c: th.dim })); C.gap(6); }
    if ((R.refs.performance || []).length || (R.refs.dimensions || []).length) {
      C.label('References');
      for (const t of (R.refs.performance || []).slice(0, 4).concat((R.refs.dimensions || []).slice(0, 3))) C.text('· ' + t, { sz: 13, gap: 0 });
      C.gap(4);
      if (R.engineNote) C.text('Not like for like: ' + R.engineNote, { sz: 12.5, c: th.warn });
    }
    // every item, ours vs real, worst first
    for (const a of AX) {
      const items = (R.items[a] || []).slice().sort((p, q) => (p.score == null ? 101 : p.score) - (q.score == null ? 101 : q.score));
      if (!items.length) continue;
      C.label(NM[a] + ' · ours vs real');
      for (const it of items) {
        const u = REF_UNIT[it.k] || '', e = it.e, c = band(it.score)[0];
        const cut = (v, nn) => { v = String(v); return v.length > nn ? v.slice(0, nn - 1) + '…' : v; };
        const ov = typeof it.ours === 'string' ? cut(it.ours, 14) : refVal(it.ours, it.k), rv = typeof it.ref === 'string' ? cut(it.ref, 14) : refVal(it.ref, it.k);
        const pc = (typeof e === 'number' && isFinite(e)) ? (e >= 0 ? '+' : '−') + Math.abs(Math.round(e * 100)) + ' %' : it.score >= 100 ? 'the same' : 'different';
        C.figure(38, (x, y, w) => K.T(x, y + 16, (REF_LABEL[it.k] || it.k) + (a === 'performance' && it.src && !/^airframe/.test(it.src) ? ' (handbook)' : ''), { sz: 13.5 }) +
          K.T(x + w, y + 16, pc, { sz: 13.5, w: 600, c, a: 'end' }) + K.T(x, y + 32, ov + ' vs ' + rv + (u ? ' ' + u : ''), { sz: 12, c: th.dim }));
      }
    }
  }
  function phoneModel(D, o, th, K, C) {
    const M = D.model, n = M.nodes, Dp = M.prop.D || 1.8, eng = M.prop.at || [0, 1, 0];
    const discs = (M.prop.discs && M.prop.discs.length) ? M.prop.discs : [[eng[0], eng[1], 0, 0]];
    phoneHead(C, o, 'Physics · what the sim flies', n.length + ' masses, ' + M.beams.length + ' members, ' + M.strips.length + ' lifting panels');
    const VIEW = { plan: p => [p[2], p[0]], side: p => [p[0], -p[1]], front: p => [-p[2], -p[1]] };
    const ext = vk => { const pts = n.map(q => VIEW[vk](q)), r = Dp / 2;
      for (const q of discs) for (const d of [[0, -r, -r], [0, r, r], [0, r, -r], [0, -r, r]]) pts.push(VIEW[vk]([q[0], q[1] + d[1], q[2] + d[2]]));
      const u = pts.map(q => q[0]), v = pts.map(q => q[1]); return [Math.min(...u), Math.max(...u), Math.min(...v), Math.max(...v)]; };
    const E = { plan: ext('plan'), side: ext('side'), front: ext('front') };
    const half = Math.max(Math.abs(E.plan[0]), Math.abs(E.plan[1]), Math.abs(E.front[0]), Math.abs(E.front[1]));
    const lenP = E.plan[3] - E.plan[2], lenS = E.side[1] - E.side[0], hF = E.front[3] - E.front[2], hS = E.side[3] - E.side[2];
    // one scale: the span across the column (the side view fits under it at the same scale)
    const s = C.inner / Math.max(2 * half, lenS), GAP = 34, xc = C.x0 + C.inner / 2;
    const y0 = C.y + 26, yF = y0 + lenP * s + GAP, yS = yF + hF * s + GAP, xS = C.x0 + (C.inner - lenS * s) / 2, H = (yS + hS * s) - C.y + 6;
    const V = { plan: { sc: s, f: p => [xc + p[2] * s, y0 + (p[0] - E.plan[2]) * s] },
                front: { sc: s, f: p => [xc - p[2] * s, yF + (-p[1] - E.front[2]) * s] },
                side: { sc: s, f: p => [xS + (p[0] - E.side[0]) * s, yS + (-p[1] - E.side[2]) * s] } };
    const lab = (y, t) => K.T(C.x0, y, t, { sz: 11, c: th.faint, w: 600, ls: 1.2 });
    C.figure(H, () => { const out = [lab(y0 - 10, 'FROM ABOVE'), lab(yF - 12, 'FROM THE FRONT'), lab(yS - 12, 'FROM THE SIDE')]; modelDraw(D, o, th, K, V, s, out); return out.join(''); });
    const kg = n.reduce((a, q) => a + q[3], 0);
    C.label('What you see');
    C.rows([[n.length + ' masses, ' + r0(kg) + ' kg', '', 'a dot\'s size is its weight', th.ink], [M.beams.length + ' members', '', 'springs that bend and break', th.member],
            [M.strips.length + ' lifting panels', '', 'control surfaces hatched', CAT.structure], ['body drag area', '', 'the dashed circles', th.faint],
            ['propeller, ' + Dp.toFixed(2) + ' m', '', null, CAT.engine], [M.floats ? 'float keels, wheels' : 'wheels', '', null, CAT.gear],
            ['the rendered plane', '', 'the grey ghost behind', th.dim]]);
    C.text('Scale: ' + (s >= 40 ? 2 : 4) + ' m = ' + r0((s >= 40 ? 2 : 4) * s) + ' px on this page.', { sz: 12, c: 'faint' });
  }
  function phoneLoad(D, o, th, K, C) {
    const M = D.model, Ld = D.load, Ds = D.destroy;
    phoneHead(C, o, 'Integrity · the certification bench', Ld && Ld.verdict === 'HELD' ? 'Held 5.7 g with nothing bent' : (Ld ? Ld.verdict : 'No load test'),
      Ld ? Math.round(Ld.W / 9.81) + ' kg in sandbags at 1 g, the plane on its back on trestles · ' + M.beams.length + ' members, each its own spring' : '');
    if (!Ld || !Ld.shape) return;
    const tip = Ld.tipM;
    let LP = null;
    C.label('At the limit load, 3.8 g');
    C.figure(Math.round(C.inner * 0.3), (x, y, w, h) => { const s = []; LP = loadLimitPic(M, Ld, th, K, { x, y: y + 6, w, h: h - 6 }, s, 12.5); return s.join(''); });
    C.text('Bending drawn ×' + LP.Kx + '. Colour: how hard each member works.', { sz: 12, c: 'faint' });
    const rows = [['limit load, 3.8 g', '+' + r1(tip * 100) + ' cm', 'at the tip'], ['ultimate, 5.7 g, held 1.5 s', '+' + r1(Ld.ultTipM * 100) + ' cm', 'at the tip'],
      ['of its yield force', r0(Ld.worstU * 100) + ' %', 'works hardest: ' + memberName(M, Ld.worst, M.semi) + (Ld.worstComp ? ', squeezed' : ', pulled')]];
    if (Ds && Ds.brokeAt != null) { const first = Ds.groups[0] ? GRPNAME(Ds.groups[0].key) : '';
      rows.push(['it breaks', r1(Ds.brokeAt) + ' g', 'the ' + first + ' lets go first']);
      if (Ds.groups.length > 1) rows.push(['0.3 s later', '', Ds.groups.slice(1).map(gg => GRPNAME(gg.key)).join(', ')]); }
    C.label('The readings'); C.rows(rows, { sz: 14.5 });
    C.gap(12).figure(46, (x, y, w) => { const s = [K.T(x, y + 12, 'how hard each member works', { sz: 12, c: th.dim })];
      for (let i = 0; i < 40; i++) s.push(`<rect x="${(x + i * w / 40).toFixed(1)}" y="${y + 20}" width="${(w / 40 + 0.4).toFixed(1)}" height="8" fill="${K.ramp(i / 39)}"/>`);
      s.push(K.T(x, y + 44, 'idle', { sz: 11.5, c: th.faint }) + K.T(x + w, y + 44, '40 % of its yield', { sz: 11.5, c: th.faint, a: 'end' }));
      return s.join(''); });
    if (Ds && Ds.shape) {
      let BP = null;
      C.label('Carried on until a part lets go');
      C.figure(Math.round(C.inner * 0.32), (x, y, w, h) => { const s = []; BP = loadBreakPic(M, Ds, th, K, { x, y: y + 6, w, h: h - 6 }, s); return s.join(''); });
      C.chips([[th.warn, 'bent for good'], [th.bad, 'broken'], [th.member, 'unharmed']]);
      C.text(BP.Kb === 1 ? 'Drawn true to scale.' : 'Bending drawn ×' + BP.Kb + '.', { sz: 12, c: 'faint' });
    }
    if (Ds && Ds.brokeAt != null) { C.label('The g it takes'); C.gap(64).figure(54, (x, y) => { const s = []; loadLadder(Ds, th, K, x, C.x1 - 36, y + 8, s); return s.join(''); }); }
  }
  function phoneXray(D, o, th, K, C) {
    const E = D.elec, pic = o.pics && o.pics.plan, Wc = (th.base || th) === THEMES.sheet ? WIRE.sheet : WIRE.dark;
    const words = E.altA ? (E.elec.alternator === 'gen20' ? 'generator' : 'alternator') : 'battery';
    phoneHead(C, o, 'Electrics · and the fuel', E.hasBus ? 'Every light on: ' + r1(E.night.A) + ' A of the ' + (E.altA ? E.altA + ' A ' + words : 'battery') : 'No battery, no lights: hand-propped',
      E.hasBus && E.dark.min != null ? 'With the ' + words + ' dead at night, the battery lasts ' + r0(E.dark.min) + ' min (the game\'s own bus, run down to 9 V).' : '');
    if (!pic || !pic.frame) return;
    let XP = null;
    C.gap(6).figure(Math.round(C.inner * 0.86), (x, y, w, h) => { const s = []; XP = xrayPlan(D, o, th, K, pic, { x: x + 16, y, w: w - 32, h }, s, 7.5);
      if (XP.fuelP) s.push(badge(K, th, [Math.min(x + w - 8, XP.fuelP[0]), XP.fuelP[1]], 'F', 7.5)); return s.join(''); });
    if (XP.fuelP && XP.v0) { const v0 = XP.v0;
      C.text('F · Fuel: ' + r0(v0.litres) + ' L' + (v0.bayRes && v0.bayRes.on === 'wing' ? ' (' + r0(v0.litres / 2) + ' L a side)' : ' in the nose') + ', ' + (v0.bayRes ? v0.bayRes.name.toLowerCase() : 'bay') + ' could take ' + r0(v0.bayRes ? v0.bayRes.litres : 0) + ' L', { sz: 13 }); }
    if (!E.hasBus) return;
    C.label('The wiring, as the handbook draws it');
    C.gap(4).fit(458, 470, () => schematic(E, th, K, 20, 14, 460, XP.lampNo).join(''));   // (20 in: the starter's caption sits left of the diagram's origin)
    C.label('The power budget at night, amps');
    const full = Math.max(E.altA, E.night.A) * 1.08, pA = E.loads.filter(l => !l.av).reduce((a, l) => a + l.amps, 0), aA = E.loads.filter(l => l.av).reduce((a, l) => a + l.amps, 0);
    const segs = []; if (pA) segs.push([pA, Wc.panel, 'instruments']); if (aA) segs.push([aA, Wc.av, 'radios']);
    for (const k of ['land', 'taxi', 'nav', 'beacon', 'cabin']) if (XP.amps(k)) segs.push([XP.amps(k), Wc.light, k]);
    C.gap(6).figure(36, (x, y, w) => { const sc = w / full, s = []; let xx = x;
      for (const [a, col] of segs) { s.push(`<rect x="${xx.toFixed(1)}" y="${y + 6}" width="${Math.max(0, a * sc - 1.5).toFixed(1)}" height="13" rx="2" ${K.fillAttr(col, 0.85)}/>`); xx += a * sc; }
      if (E.altA) { const ax = x + E.altA * sc; s.push(K.L([ax, y], [ax, y + 28], Wc.charge, 2.4)); }
      return s.join(''); });
    C.rows(segs.map(([a, col, nm]) => [nm, r1(a) + ' A', null, col]).concat(E.altA ? [[words + ' makes', E.altA + ' A', null, Wc.charge]] : []), { sz: 13.5 });
  }
  const PHONE = { drag: phoneDrag, reference: phoneReference, physics: phoneModel, integrity: phoneLoad, electrics: phoneXray, cooling: phoneCooling };

  let svgSeq = 0;
  function svg(page, data, opts) {
    const o = opts || {}, th = themeOf(o), K = kit(th);
    const L = o.layout || {}, phone = L.screen === 'phone' || (!L.screen && o.screen === 'phone');
    // (the first prototypes' ids stay understood: load, xray, model)
    const f = { integrity: pageLoad, load: pageLoad, drag: pageDrag, electrics: pageXray, xray: pageXray, physics: pageModel, model: pageModel, reference: pageReference, cooling: pageCooling }[page];
    if (!f) throw new Error('no physics page ' + page);
    // the ids a page defines (patterns, filters, its clip) made the drawing's own: several pages share one document
    const uid = 'fp' + (++svgSeq) + '_';
    const ALIAS = { load: 'integrity', xray: 'electrics', model: 'physics' }, pid = ALIAS[page] || page, Kt = phone ? KIT() : null;
    if (phone && Kt && PHONE[pid]) {
      const C = Kt.column({ w: L.w > 0 ? L.w : 360, palette: kitPalette(th, o) });
      PHONE[pid](data, o, th, K, C);
      return C.svg((PAGES.find(p => p.id === pid) || {}).name + (o.name ? ' of the ' + o.name : ''), { sig: o.sig })
        .replace(/id="([a-z]{2})"/g, 'id="' + uid + '$1"').replace(/url\(#([a-z]{2})\)/g, 'url(#' + uid + '$1)');
    }
    return wrap(f(data, o, th, K), (PAGES.find(p => p.id === (ALIAS[page] || page)) || {}).name + (o.name ? ' of the ' + o.name : ''))
      .replace(/id="([a-z]{2})"/g, 'id="' + uid + '$1"').replace(/url\(#([a-z]{2})\)/g, 'url(#' + uid + '$1)');
  }
  // ---- THE PAGE'S GLUE (the board's hook): a fiche record in, a page drawn ---------------------------------------------
  // rec is fiche_board.js's record: { name, baked, data: { name, reg, pxPerM }, pics: { side, plan: url | Blob } }.
  // THE DATA: rec.physics if the record carries it; a baked official plane's physics.json beside its pictures
  // (tools/fiche_physics_bake.js); else the plane on the stand, computed on the bench's thread (bench_worker 'fiche');
  // else null (the board says to put the plane on the stand). Kept per name for the session.
  const cache = {};
  const blobUrl = b => (typeof b === 'string' ? b : URL.createObjectURL(b));
  const dataUri = b => (typeof b === 'string' && b.startsWith('data:')) ? Promise.resolve(b)
    : (typeof b === 'string' ? fetch(b).then(r => r.blob()) : Promise.resolve(b)).then(x => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(x); }));
  function dataFor(rec, opts) {
    const o = opts || {}, key = rec.name;
    if (rec.physics) return refsLoad().then(() => Object.assign({ reference: rec.reference || refOf(rec, o) }, rec.physics));
    if (cache[key]) return cache[key];
    if (rec.baked && rec.pics && typeof rec.pics.side === 'string') {
      const url = rec.pics.side.replace(/[^/]*$/, 'physics.json');
      return (cache[key] = Promise.all([fetch(url).then(r => (r.ok ? r.json() : null)).catch(() => null), refsLoad()])
        .then(([D]) => (D ? Object.assign(D, { reference: refOf(rec, o) }) : null)));
    }
    const spec = o.spec || null, BW = root && root.BENCH_WORKER;
    if (!spec || !BW || typeof BW.start !== 'function') return Promise.resolve(null);
    return (cache[key] = Promise.all([new Promise(res => {
      let w = null;
      w = BW.start(m => { if (m && m.kind === 'fiche') { res(m.data || null); if (w) w.kill(); } }, () => res(null));
      // o.propOff: the drawn hubs (64c genAidPropOff of the editor's CAGE_ENG) when the plane is the one on the stand
      if (!w || !w.post({ kind: 'fiche', seq: 1, spec: JSON.parse(JSON.stringify(spec)), propOff: o.propOff || null })) { if (w) w.kill(); res(null); }
    }), refsLoad()]).then(([D]) => (D ? Object.assign(D, { reference: refOf(rec, o) }) : null)));
  }
  // THE REFERENCES (tools/fiche_reference_bake.js -> media/fiches/references.json): REAL-FIGURES' latest report, one entry
  // per build file it flew, loaded once. A fiche record finds its entry by its list row's build path (rec.listFile), else
  // by the row's id through the canon's aliases (rec.listRow, 'list:50'); none -> no Reference page (visible(rec) false).
  let REFS = null, refsP = null;
  const refsUrl = () => (root && root.FICHE_REFS_URL) || 'media/fiches/references.json';
  function refsLoad() {
    if (refsP) return refsP;
    if (typeof fetch !== 'function') return (refsP = Promise.resolve(null));
    return (refsP = fetch(refsUrl()).then(r => (r.ok ? r.json() : null)).catch(() => null).then(j => (REFS = j)));
  }
  function refOf(rec, ctx) {
    if (!REFS || !rec) return null;
    // the record's (and ctx's) list row (AIRCRAFT-LOOKS, L39b): listFile, its build path; listRow, e.g. 'list:50'. A
    // self-built plane carries neither, and has no Reference
    const c = ctx || {}, cand = [rec.listFile, c.listFile, rec.listRow, c.listRow];
    for (const k of cand) { if (!k || typeof k !== 'string') continue;
      const f = REFS.byFile[k] ? k : (REFS.alias && REFS.alias[k]); if (f && REFS.byFile[f]) return REFS.byFile[f]; }
    return null;
  }
  function picsFor(rec, model, inline) {
    const out = {}, s = (rec.data && rec.data.pxPerM) || 0;
    return Promise.all(['side', 'plan', 'front'].map(v => {
      const b = rec.pics && rec.pics[v]; if (!b || !s) return null;
      return (inline ? dataUri(b) : Promise.resolve(blobUrl(b))).then(href => new Promise(res => {
        const im = new Image(); im.onload = () => frameOf(model, v, im, s).then(fr => { out[v] = { href, W: im.naturalWidth, H: im.naturalHeight, s, frame: fr }; res(); }, () => res());
        im.onerror = () => res(); im.src = href; }));
    })).then(() => out);
  }
  const sigOf = () => { try { return (root.FICHE_BOARD && root.FICHE_BOARD.sig) ? root.FICHE_BOARD.sig() : ''; } catch (e) { return ''; } };
  // a page's data: Reference needs only the references' index (never the physics: a baked fiche without its physics.json,
  // or a plane off the stand, still shows its reference - the live test of 12 Nov); the others the physics data
  const dataOf = (rec, page, o) => page === 'reference' ? refsLoad().then(() => { const R = refOf(rec, o); return R ? { reference: R } : null; }) : dataFor(rec, o);
  // the board's sheet tokens, as the element sees them (AIRCRAFT-LOOKS: --fi-ink, --fi-dim, --fi-paper, --fi-line, --fi-acc)
  function tokensOf(el) {
    try { const cs = root.getComputedStyle(el), v = k => (cs.getPropertyValue(k) || '').trim() || null;
      const T = { paper: v('--fi-paper'), ink: v('--fi-ink'), dim: v('--fi-dim'), line: v('--fi-line'), acc: v('--fi-acc') };
      return (T.paper || T.ink) ? T : null; } catch (e) { return null; }
  }
  // draw `page` of `rec` into `el` (theme 'sheet' on the board); resolves false when there is no data
  function mount(el, rec, page, opts) {
    const o = opts || {};
    el.textContent = 'Working out the physics pages…';
    return dataOf(rec, page, o).then(D => {
      if (!D) { el.textContent = 'Put this aeroplane on the stand to draw its physics pages.'; return false; }
      return (D.model ? picsFor(rec, D.model, false) : Promise.resolve({})).then(pics => {
        el.innerHTML = svg(page, D, { theme: o.theme, screen: o.screen, layout: o.layout, tokens: tokensOf(el), name: o.title || (rec.data && rec.data.name) || rec.name, reg: rec.data && rec.data.reg, pics, sig: sigOf() });
        const sv = el.querySelector('svg'); if (sv) { sv.style.width = '100%'; sv.style.height = 'auto'; sv.style.display = 'block'; }
        return true;
      });
    });
  }
  // the share's picture of a page: 2400 x 1600 PNG (the fiche's own share size), the pictures inlined so the canvas can read them
  function compose(rec, page, opts) {
    const o = opts || {};
    return dataOf(rec, page, o).then(D => { if (!D) return null;
      return (D.model ? picsFor(rec, D.model, true) : Promise.resolve({})).then(pics => new Promise((res, rej) => {
        const text = svg(page, D, { theme: o.theme, screen: o.screen, layout: o.layout, tokens: o.tokens || (root && root.document ? tokensOf(root.document.querySelector('#pfBoard .pfSheet') || root.document.documentElement) : null), name: o.title || (rec.data && rec.data.name) || rec.name, reg: rec.data && rec.data.reg, pics, sig: sigOf() });
        const im = new Image(), url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
        im.onload = () => { const c = document.createElement('canvas'); c.width = 2 * W; c.height = 2 * H; c.getContext('2d').drawImage(im, 0, 0, 2 * W, 2 * H); URL.revokeObjectURL(url); c.toBlob(res, 'image/png'); };
        im.onerror = e => { URL.revokeObjectURL(url); rej(e); }; im.src = url; })); });
  }
  // THE BOARD'S REGISTRY (AIRCRAFT-LOOKS, L39b): FICHE_BOARD.pages.add({ id, label, mount(sheet, rec, ctx), compose }), ctx
  // passed whole ({ spec, title, propOff }). Every section registers itself once the board is there; before it, nothing.
  let registered = false;
  function register() {
    const FB = root && root.FICHE_BOARD;
    if (registered || !FB || !FB.pages || typeof FB.pages.add !== 'function') return false;
    refsLoad();
    for (const p of PAGES) FB.pages.add(Object.assign({ id: p.id, label: p.name,
      mount: (sheet, rec, ctx) => mount(sheet, rec, p.id, ctx || {}),
      compose: (rec, ctx) => compose(rec, p.id, ctx || {}) },
      // Reference only where REAL-FIGURES flew this very card; the others on every baked fiche (their data beside its
      // pictures) and on a plane while it stands in the garage (worked out on the bench's thread) - the registry's
      // visible(rec, ctx), run as each fiche opens
      p.id === 'reference' ? { visible: (rec, ctx) => !!refOf(rec, ctx) } : { visible: (rec, ctx) => !!(rec && (rec.baked || rec.physics)) || !!(ctx && ctx.spec) }));
    return (registered = true);
  }
  if (root && !register() && typeof root.addEventListener === 'function') root.addEventListener('load', register);
  const API = { PAGES, THEMES, CAT, svg, fitFrame, frameOf, GRPNAME, memberName, W, H, mount, compose, dataFor, register, refsLoad, refOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.FICHE_PHYSICS = API;
})(typeof window !== 'undefined' ? window : null);
