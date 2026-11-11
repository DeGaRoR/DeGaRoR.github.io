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
// One layout, 1200 x 800 (the share picture's 3:2), two themes:
//   sheet   the fiche's cream sheet (#f3ede0, ink #2b2924): printable; every fill outlined and named, labels in dark ink,
//           colour never the only cue (AIRCRAFT-LOOKS via A0, 11 Nov)
//   screen  the garage's dark --ed-* panel: devlog / Steam pictures
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
    { id: 'load', name: 'Load test' }, { id: 'drag', name: 'Drag' },
    { id: 'xray', name: 'X-ray' }, { id: 'model', name: 'What the sim flies' },
  ];
  // the fiche pages' shared category colours (A0, 11 Nov), and their names (colour is never the only cue)
  const CAT = { structure: '#8fb0c4', engine: '#e2a056', gear: '#a9bd6e', systems: '#b99be0',
                fittings: '#6fc2b0', interior: '#e0868a', finish: '#b7ab9b' };
  const THEMES = {
    sheet: { bg: '#f3ede0', ink: '#2b2924', dim: '#6d675b', faint: '#9a9283', hair: '#d8cdb8', rule: 'rgba(43,41,36,.16)',
             lead: 'rgba(43,41,36,.38)', member: 'rgba(43,41,36,.22)', ghost: 0.55, fillOp: 0.42, edge: 'rgba(43,41,36,.55)',
             ramp: [[0, [201, 191, 174]], [0.3, [176, 160, 134]], [0.6, [208, 138, 79]], [1, [181, 70, 42]]], bad: '#b5462a', warn: '#c27a3e',
             frame: true },
    screen: { bg: '#201d1a', ink: '#f4efe6', dim: '#c0b8ac', faint: '#97907f', hair: 'rgba(255,248,236,.16)', rule: 'rgba(255,248,236,.14)',
              lead: 'rgba(244,239,230,.35)', member: 'rgba(192,184,172,.24)', ghost: 0.3, fillOp: 0.38, edge: null,
              ramp: [[0, [74, 69, 64]], [0.25, [151, 144, 127]], [0.5, [216, 160, 122]], [1, [224, 110, 70]]], bad: '#e06e46', warn: '#d8a07a',
              frame: false },
  };
  const W = 1200, H = 800;
  const r1 = x => (Math.round(x * 10) / 10).toFixed(1), r0 = x => String(Math.round(x));
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const mean = ps => { ps = ps.filter(Boolean); return ps.length ? [0, 1, 2].map(k => ps.reduce((a, p) => a + p[k], 0) / ps.length) : null; };

  // ---- the frame fit ----------------------------------------------------------------------------------------------------
  // view 'side': u from x (nose left), v from -y; 'plan': u from z, v from x (nose up) - plane_fiche.js's ortho cameras
  const proj = (view, p) => (view === 'side' ? [p[0], -p[1]] : [p[2], p[0]]);
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
  function pageLoad(D, o, th, K) {
    const M = D.model, Ld = D.load, Ds = D.destroy;
    const out = head(th, K, o, 'Load test · the certification bench',
      Ld && Ld.verdict === 'HELD' ? 'Held 5.7 g with nothing bent' : (Ld ? Ld.verdict : 'No load test'),
      Ld ? Math.round(Ld.W / 9.81) + ' kg in sandbags at 1 g, the plane on its back on trestles · ' + M.beams.length + ' members, each its own spring' : '');
    if (!Ld || !Ld.shape) return out;
    // the limit: the bent airframe, coloured by the work (left, top)
    const tip = Ld.tipM, Kx = Math.max(5, Math.round(0.11 * Ld.semi / Math.max(1e-4, tip) / 5) * 5);
    const fv = frontView(M, Ld.shape, Kx, { x: 48, y: 196, w: 700, h: 190 });
    out.push(K.T(48, 170, 'At the limit load, 3.8 g · bending drawn ×' + Kx, { sz: 14, w: 600, c: th.dim }));
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
      out.push(K.T(pj[0] + 6, pj[1] + 22, '+' + r1(tip * 100) + ' cm at the tip', { sz: 15, w: 600 })); }
    // the breaking point (left, below)
    if (Ds && Ds.shape) {
      let bt = 0; M.nodes.forEach((n, i) => { if (tagOf(M, i) === 'WF') bt = Math.max(bt, Math.abs(Ds.shape[i][1])); });
      const Kb = bt > 0.1 * M.semi ? 1 : Math.max(5, Math.round(0.11 * M.semi / Math.max(1e-4, bt) / 5) * 5);
      const bv = frontView(M, Ds.shape, Kb, { x: 48, y: 470, w: 700, h: 170 });
      out.push(K.T(48, 446, 'Carried on until a part lets go · ' + (Kb === 1 ? 'drawn true to scale' : 'bending drawn ×' + Kb), { sz: 14, w: 600, c: th.dim }));
      const brk = new Set(Ds.broken), yl = new Set(Ds.yielded);
      M.beams.forEach((b, i) => { if (b[3] || brk.has(i) || yl.has(i)) return; out.push(K.L(bv.P(b[0], 1), bv.P(b[1], 1), th.member, 0.8)); });
      M.beams.forEach((b, i) => { if (b[3] || !yl.has(i)) return; out.push(K.L(bv.P(b[0], 1), bv.P(b[1], 1), th.warn, 1.8)); });
      M.beams.forEach((b, i) => { if (!brk.has(i)) return; out.push(K.L(bv.P(b[0], 1), bv.P(b[1], 1), th.bad, 2.2, '5 4')); });
      if (Ds.firstBreak) { const b = M.beams[Ds.firstBreak.beam], a = bv.P(b[0], 1), c = bv.P(b[1], 1), m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2], left = m[0] < 48 + 350;
        out.push(`<circle cx="${m[0].toFixed(1)}" cy="${m[1].toFixed(1)}" r="11" fill="none" stroke="${th.bad}" stroke-width="1.8"/>`);
        out.push(K.T(m[0] + (left ? -16 : 16), m[1] - 14, Ds.firstBreak.how === 'kink' ? 'first to buckle' : 'first to break', { sz: 13, c: th.bad, w: 600, a: left ? 'end' : 'start' })); }
    }
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
    // the ladder
    if (Ds && Ds.brokeAt != null) {
      const gMax = Math.max(7, Ds.brokeAt * 1.08), lx0 = 48, lx1 = 760, ly = 718, gx = g => lx0 + (lx1 - lx0) * g / gMax;
      out.push(K.L([lx0, ly], [lx1, ly], th.lead, 1));
      for (let g = 0; g <= gMax; g += (gMax > 10 ? 2 : 1)) out.push(K.L([gx(g), ly - 3], [gx(g), ly + 3], th.faint, 1) + K.T(gx(g), ly + 17, g + ' g', { sz: 11, c: th.faint, a: 'middle' }));
      const mk = (g, lab, col, up, anc) => { if (g == null) return; const x = gx(g);
        out.push(`<circle cx="${x.toFixed(1)}" cy="${ly}" r="4.5" fill="${col}"/>` + K.L([x, ly - 6], [x, ly - (up ? 34 : 20)], col, 1) +
          K.T(x + (anc === 'end' ? -5 : anc === 'start' ? 5 : 0), ly - (up ? 38 : 24), lab, { sz: 12.5, c: col, a: anc || 'middle', w: 500 })); };
      const near = g => g != null && Math.abs(g - 5.7) < 1.2;
      const same = Ds.yieldAt != null && Ds.breakAt != null && Math.abs(Ds.yieldAt - Ds.breakAt) < 0.05;
      const bk = Ds.breakAt != null && Math.abs(Ds.brokeAt - Ds.breakAt) > 0.05 && Math.abs(Ds.breakAt - (Ds.yieldAt || 0)) < 1.2;
      mk(3.8, 'limit 3.8', th.dim, false, Ds.yieldAt != null && Math.abs(Ds.yieldAt - 3.8) < 0.8 ? 'end' : null);
      mk(5.7, 'ultimate 5.7', th.dim, true, near(Ds.brokeAt) || near(Ds.breakAt) || near(Ds.yieldAt) ? 'end' : null);
      if (!same && Ds.yieldAt != null) mk(Ds.yieldAt, 'first bend ' + Ds.yieldAt.toFixed(2), th.warn, false, Math.abs(Ds.yieldAt - 3.8) < 0.8 || near(Ds.yieldAt) ? 'start' : bk ? 'end' : null);
      if (Ds.breakAt != null && Math.abs(Ds.brokeAt - Ds.breakAt) > 0.05) mk(Ds.breakAt, 'first ' + (Ds.firstBreak && Ds.firstBreak.how === 'kink' ? 'buckle ' : 'break ') + Ds.breakAt.toFixed(1), th.bad, bk, bk ? 'start' : null);
      mk(Ds.brokeAt, (same ? 'bends and breaks ' : 'lets go ') + Ds.brokeAt.toFixed(2), th.bad, true, near(Ds.brokeAt) ? 'start' : null);
    }
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
  function pageDrag(D, o, th, K) {
    const M = D.model, Dg = D.drag, pic = o.pics && o.pics.side;
    const items = [];
    const at = {};
    { const fus = M.nodes.filter(n => /^S[2-4][TB]/.test(M.tags[n[4]])); at.fuselage = mean(fus);
      at.cooling = mean(byTag(M, 'CGE').concat(byTag(M, 'ENGL'))); at.screen = mean(byTag(M, 'S0TL').concat(byTag(M, 'S1TL')));
      const wr = M.nodes.filter(n => M.tags[n[4]] === 'WF').sort((a, b) => Math.abs(a[2]) - Math.abs(b[2]))[0]; if (wr) at.junct = [wr[0] + 0.25, wr[1] - 0.05, 0];
      const ax = byTag(M, 'AXLEL'); at.mainGear = Dg.floats ? mean(byTag(M, 'FLK')) : ax.length ? mean(ax.concat(ax.map(p => [p[0], p[1] + 0.35, p[2]]))) : null;
      const tw = M.contacts.length > 2 ? P3(M, M.contacts[2]) : null; at.third = tw;
      const st = M.beams.filter(b => isStrut(M, b)); if (st.length) at.struts = mean(st.flatMap(b => [P3(M, b[0]), P3(M, b[1])]));
      const wi = M.beams.filter(b => M.CLS[b[2]] === 'wire'); if (wi.length) at.wires = mean(wi.flatMap(b => [P3(M, b[0]), P3(M, b[1])]));
      at.nacelles = mean(byTag(M, 'ENGL').concat(byTag(M, 'ENGR'))); }
    const big = Object.keys(Dg.groups).filter(g => g !== 'fuselage' && DRAGROW[g]).sort((a, b) => Dg.groups[b].dV - Dg.groups[a].dV)[0];
    const nm = g => g === 'third' && Dg.gearType === 'tricycle' ? 'Nose wheel' : g === 'third' && Dg.floats ? 'Third wheel*' : g === 'mainGear' && Dg.floats ? 'Floats*' : DRAGROW[g][0];
    const out = head(th, K, o, 'Drag · where the speed goes', 'Your ' + nm(big).replace('*', '').toLowerCase() + ' cost ' + r0(Dg.groups[big].dV * 3.6) + ' km/h',
      'Cruise ' + r0(Dg.Vc * 3.6) + ' km/h. Each disc is a flat plate with the same drag, drawn to the plane\'s scale.');
    if (pic && pic.frame) {
      const m = sideMap(pic, { x: 48, y: 210, w: 690, h: 330 });
      out.push(picImg(pic, m, th === THEMES.sheet ? 1 : 0.92));
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
          out.push(K.T(i.x, y, i.name, { sz: 14, a: 'middle', w: 500 }) + K.T(i.x, y + 17, '−' + r1(i.dV) + ' km/h', { sz: 13.5, a: 'middle', c: th === THEMES.sheet ? th.ink : i.col, w: 600 })); } };
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
  // X-RAY: electrics and tanks
  // ===================================================================================================================
  function pageXray(D, o, th, K) {
    const M = D.model, E = D.elec, Tk = D.tanks, pic = o.pics && o.pics.plan;
    const words = E.altA ? (E.elec.alternator === 'gen20' ? 'generator' : 'alternator') : 'battery';
    const out = head(th, K, o, 'X-ray · the electrics and the fuel',
      E.hasBus ? 'Every light on: ' + r1(E.night.A) + ' A of the ' + (E.altA ? E.altA + ' A ' + words : 'battery') : 'No battery, no lights: hand-propped',
      E.hasBus && E.dark.min != null ? 'With the ' + words + ' dead at night, the battery lasts ' + r0(E.dark.min) + ' min (the game\'s own bus, run down to 9 V).' : '');
    if (!pic || !pic.frame) return out;
    const m = planMap(pic, { x: 320, y: 150, w: 420, h: 600 }), N = m.N, SY = CAT.systems, FUEL = CAT.engine;
    out.push(`<defs><filter id="xg"><feColorMatrix type="saturate" values="0"/></filter><pattern id="xf" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="${FUEL}" stroke-width="2"/></pattern></defs>`);
    out.push(picImg(pic, m, th === THEMES.sheet ? 0.35 : 0.2, 'xg'));
    const wf = M.nodes.filter(n => M.tags[n[4]] === 'WF'), wr = M.nodes.filter(n => M.tags[n[4]] === 'WR');
    const near = (arr, z) => arr.slice().sort((a, b) => Math.abs(a[2] - z) - Math.abs(b[2] - z))[0];
    const semi = M.semi;
    // the fuel: the bay outlined, hatched to its tank's share
    const v0 = Tk.vessels[0];
    let fuelP = null;
    if (v0 && v0.bayRes) {
      const B = v0.bayRes;
      if (B.on === 'wing' && B.span) for (const sg of [1, -1]) {
        const z0 = sg * B.span[0] * semi, z1 = sg * B.span[1] * semi;
        const p = [[near(wf, z0)[0] + 0.05, 0, z0], [near(wf, z1)[0] + 0.05, 0, z1], [near(wr, z1)[0] - 0.05, 0, z1], [near(wr, z0)[0] - 0.05, 0, z0]].map(N);
        out.push(`<path d="M${p.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' L')} Z" fill="url(#xf)" fill-opacity=".55" stroke="${FUEL}" stroke-width="1.4" stroke-dasharray="5 4"/>`);
        if (sg > 0) fuelP = N([near(wr, (z0 + z1) / 2)[0], 0, (z0 + z1) / 2]);
      } else if (B.x0 != null) {
        const s0 = byTag(M, 'S0TR')[0] || [0, 0, 0.3], hw = Math.abs(s0[2]);
        const p = [[B.x0, 0, -hw * 0.8], [B.x0, 0, hw * 0.8], [B.x1 - 0.02, 0, hw * 0.95], [B.x1 - 0.02, 0, -hw * 0.95]].map(N);
        out.push(`<path d="M${p.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' L')} Z" fill="url(#xf)" fill-opacity=".7" stroke="${FUEL}" stroke-width="1.4"/>`);
        fuelP = N([(B.x0 + B.x1) / 2, 0, hw]);
      }
    }
    // the electrics: the bus to every lamp, square runs
    const fw = mean(byTag(M, 'S0BL').concat(byTag(M, 'S0BR'))), panel = mean(byTag(M, 'S0TL').concat(byTag(M, 'S0TR')));
    const eng = M.prop.at || fw, fin = byTag(M, 'FIN')[0] || mean(byTag(M, 'VF'));
    const tipL = wf.reduce((a, q) => (q[2] < a[2] ? q : a), wf[0]), tipR = wf.reduce((a, q) => (q[2] > a[2] ? q : a), wf[0]);
    const tail = M.nodes.reduce((a, q) => (q[0] > a[0] && Math.abs(q[2]) < 0.3 ? q : a), [0, 0, 0]);
    const battery = [fw[0] - 0.12, fw[1], 0.12], bus = [panel[0] + 0.25, panel[1], -0.1], bay = E.litePos.bayFrac;
    const wAt = z => { const q = near(wf, z); return [q[0] - 0.05, q[1], z]; };
    const lamp = { nav: [[tipL[0], 0, tipL[2] - 0.05], [tipR[0], 0, tipR[2] + 0.05], [tail[0] + 0.05, 0, 0]], beacon: [[fin[0], 0, 0]],
                   taxi: [wAt(-bay * semi)], land: [wAt(bay * semi)], cabin: [[panel[0] + 0.9, 0, 0]] };
    const fit = k => E.lamps.some(l => (k === 'cabin' ? ['flood', 'instr', 'pedal', 'pax'].includes(l.key) : l.key === k));
    const amps = k => E.lamps.filter(l => (k === 'cabin' ? ['flood', 'instr', 'pedal', 'pax'].includes(l.key) : l.key === k)).reduce((a, l) => a + l.amps, 0);
    const brk = k => (E.breakers.find(b => b.key === k) || {}).A;
    const run = (a, b) => { const A = N(a), B = N(b), m1 = N([a[0], 0, 0]), m2 = N([b[0], 0, 0]); return `<path d="M${A[0].toFixed(1)} ${A[1].toFixed(1)} L${m1[0].toFixed(1)} ${m1[1].toFixed(1)} L${m2[0].toFixed(1)} ${m2[1].toFixed(1)} L${B[0].toFixed(1)} ${B[1].toFixed(1)}" fill="none" stroke="${SY}" stroke-opacity="0.8" stroke-width="1.2"/>`; };
    if (E.hasBus) {
      out.push(run(battery, bus)); if (E.altA) out.push(run(eng, bus));
      for (const k in lamp) if (fit(k)) for (const p of lamp[k]) out.push(run(bus, p));
      for (const k in lamp) if (fit(k)) for (const p of lamp[k]) { const q = N(p);
        out.push(`<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="4.6" fill="${k === 'beacon' ? th.bad : th.bg}" stroke="${th.ink}" stroke-width="1.3"/>`); }
      const bq = N(bus); out.push(`<rect x="${(bq[0] - 8).toFixed(1)}" y="${(bq[1] - 4).toFixed(1)}" width="16" height="8" rx="1.5" ${K.fillAttr(SY, 0.9)}/>`);
      const bt = N(battery); out.push(`<rect x="${(bt[0] - 5).toFixed(1)}" y="${(bt[1] - 6).toFixed(1)}" width="10" height="12" rx="1.5" ${K.fillAttr(SY, 0.9)}/>`);
      // the callouts: the lamps
      const C = (p, lx, ly, a, t1, t2) => K.call(out, N(p), lx, ly, a, t1, t2);
      const wy = Math.max(...wr.map(q => N(q)[1])) + 40;
      if (fit('nav')) C(lamp.nav[1], 1152, 190, 'end', 'Navigation lights ×3', amps('nav') + ' A, ' + brk('navLt') + ' A breaker');
      if (fit('land')) C(lamp.land[0], 1152, wy, 'end', 'Landing light', amps('land') + ' A, ' + brk('landLt') + ' A breaker');
      if (fit('taxi')) C(lamp.taxi[0], 48, wy, 'start', 'Taxi light', amps('taxi') + ' A, ' + brk('taxiLt') + ' A breaker');
      if (fit('beacon')) C(lamp.beacon[0], 1152, 620, 'end', 'Beacon', r1(amps('beacon')) + ' A average (it pulses)');
      if (fit('cabin')) C(lamp.cabin[0], 1152, Math.max(400, wy + 70), 'end', 'Cabin & panel lights', r1(amps('cabin')) + ' A, dimmable');
      // the loupe: the firewall and the panel, the parts at their own size
      const lc = [130, 258], lr = 70, x0 = Math.min(eng[0], battery[0]) - 0.2, x1 = Math.max(panel[0] + 0.55, eng[0] + 0.35), Z = Math.min(260, (2 * lr - 56) / (x1 - x0));
      const Mx = p => [lc[0] + p[2] * Z, lc[1] + (p[0] - (x0 + x1) / 2) * Z];
      out.push(`<clipPath id="xl"><circle cx="${lc[0]}" cy="${lc[1]}" r="${lr}"/></clipPath><circle cx="${lc[0]}" cy="${lc[1]}" r="${lr}" fill="${th.bg}" stroke="${SY}" stroke-width="1.2"/>`);
      const g = [], gl = [];
      for (const b of M.beams) { const A = P3(M, b[0]), B = P3(M, b[1]); if (Math.max(A[0], B[0]) > x1 + 0.4 || b[3]) continue; g.push(K.L(Mx(A), Mx(B), th.member, 0.8)); }
      const part = k => E.parts.find(p => p.key === k);
      const rbox = (p, d, lab) => { const q = Mx(p), w = d[1] * Z, h = d[0] * Z; g.push(`<rect x="${(q[0] - w / 2).toFixed(1)}" y="${(q[1] - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" ${K.fillAttr(SY, 0.9)}/>`); gl.push(K.T(q[0] + w / 2 + 4, q[1] + 4, lab, { sz: 12 })); };
      const rcan = (p, d, ln, lab, left0) => { const q = Mx(p), left = !!left0, w = d * Z, h = ln * Z;
        g.push(`<rect x="${(q[0] - w / 2).toFixed(1)}" y="${(q[1] - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${(w / 2).toFixed(1)}" ${K.fillAttr(SY, 0.9)}/>`);
        gl.push(K.T(left ? q[0] - w / 2 - 4 : q[0] + w / 2 + 4, q[1] + 4, lab, { sz: 12, a: left ? 'end' : 'start' })); };
      const bat = part('battery'), alt = part('alternator'), st = part('starter'), busP = part('bus'), wire = part('wire');
      if (bat) rbox(battery, bat.dims, 'battery');
      if (alt) rcan([eng[0] + 0.15, 0, -0.12], alt.dia, alt.len, words, true);
      if (st) rcan([eng[0] + 0.1, 0, 0.13], st.dia, st.len, 'starter');
      rbox(bus, [0.06, 0.18], 'bus');
      out.push(`<g clip-path="url(#xl)">${g.join('')}</g>` + gl.join(''));
      out.push(K.L([lc[0] + lr * 0.72, lc[1] - lr * 0.7], N([(x0 + x1) / 2, 0, 0]), th.lead, 0.8, '3 4'));
      const lines = [];
      if (bat) lines.push('Battery · ' + bat.name.replace('lead-acid 12 V, ', 'lead-acid, ') + ' · ' + bat.kg + ' kg');
      if (alt) lines.push(alt.name.replace(/^./, c => c.toUpperCase()) + ' · ' + alt.kg + ' kg');
      if (st) lines.push('Starter · 150 A while cranking · ' + st.kg + ' kg');
      if (busP) lines.push('Bus bar & ' + busP.breakers + ' breakers · ' + r1(busP.kg + (wire ? wire.kg : 0)) + ' kg with the wire');
      lines.forEach((t, i) => out.push(K.T(48, lc[1] + lr + 24 + i * 17, t, { sz: 12.5, c: i ? th.dim : th.ink })));
    }
    if (fuelP && v0) K.call(out, fuelP, 1152, 300, 'end', 'Fuel · ' + r0(v0.litres) + ' L' + (v0.bayRes && v0.bayRes.on === 'wing' ? ', ' + r0(v0.litres / 2) + ' L a side' : ' in the nose'),
      r0(v0.contentsKg) + ' kg of fuel; the ' + (v0.bayRes ? v0.bayRes.name.toLowerCase() : 'bay') + ' could take ' + r0(v0.bayRes ? v0.bayRes.litres : 0) + ' L');
    // the budget: one bar, the loads against what the alternator makes
    if (E.hasBus) {
      const by = 714, bx = 48, bw = W - 96, full = Math.max(E.altA, E.night.A) * 1.08, sc = bw / full; let x = bx;
      out.push(K.T(48, by - 12, 'THE POWER BUDGET AT NIGHT', { sz: 11, c: th.faint, w: 600, ls: 1.2 }));
      const seg = (a, col, lab, op) => { const w = a * sc; out.push(`<rect x="${x.toFixed(1)}" y="${by}" width="${Math.max(0, w - 1.5).toFixed(1)}" height="14" rx="2" ${K.fillAttr(col, op)}/>`);
        if (lab && w > lab.length * 6.6 + 6) out.push(K.T(x + 2, by + 32, lab, { sz: 12, c: th.dim })); x += w; };
      seg(E.day.A, SY, 'panel & radios ' + r1(E.day.A), 0.9);
      for (const k of ['land', 'taxi', 'nav', 'beacon', 'cabin']) if (amps(k)) seg(amps(k), k === 'beacon' ? th.bad : th.faint, k + ' ' + r1(amps(k)), k === 'beacon' ? 0.8 : 0.45);
      if (E.altA) { const ax = bx + E.altA * sc; out.push(K.L([ax, by - 10], [ax, by + 22], th.ink, 1.6) + K.T(ax - 4, by - 14, words + ' ' + E.altA + ' A', { sz: 12.5, a: 'end', w: 600 })); }
    }
    return out;
  }

  // ===================================================================================================================
  // WHAT THE SIM FLIES
  // ===================================================================================================================
  function pageModel(D, o, th, K) {
    const M = D.model, n = M.nodes;
    const out = head(th, K, o, 'What the sim flies · the model itself', n.length + ' masses, ' + M.beams.length + ' members, ' + M.strips.length + ' lifting panels',
      'Plan above, side below, one scale. The rendered plane is the faint ghost behind it.');
    const Dp = M.prop.D || 1.8, eng = M.prop.at || [0, 1, 0];
    const xs = n.map(q => q[0]), ys = n.map(q => q[1]), zs = n.map(q => q[2]);
    const xmin = Math.min(...xs, eng[0] - 0.4), xmax = Math.max(...xs) + 0.5, zext = Math.max(...zs.map(Math.abs)) + 0.2;
    const ymin = Math.min(...ys, eng[1] - Dp / 2) - 0.1, ymax = Math.max(...ys, eng[1] + Dp / 2) + 0.1;
    const s = Math.min(640 / (xmax - xmin), 400 / (2 * zext), 560 / (2 * zext + ymax - ymin + 1));
    const X0 = 48 + (680 - (xmax - xmin) * s) / 2 - xmin * s, PY = 160 + zext * s, SY = PY + zext * s + 30 + ymax * s;
    const pl = p => [X0 + p[0] * s, PY + p[2] * s], sd = p => [X0 + p[0] * s, SY - p[1] * s];
    out.push(`<defs><filter id="mg"><feColorMatrix type="saturate" values="0"/></filter><pattern id="mh" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="${CAT.fittings}" stroke-width="1.8"/></pattern></defs>`);
    // the ghosts (the plan turned nose-left by its own frame)
    const pp = o.pics && o.pics.plan, ps = o.pics && o.pics.side;
    if (pp && pp.frame) { const f = s / pp.s; out.push(`<image href="${pp.href}" width="${pp.W}" height="${pp.H}" transform="matrix(0 ${f} ${f} 0 ${(X0 - f * pp.frame.oy).toFixed(2)} ${(PY - f * pp.frame.ox).toFixed(2)})" opacity="${th.ghost}" filter="url(#mg)"/>`); }
    if (ps && ps.frame) { const f = s / ps.s; out.push(`<image href="${ps.href}" width="${ps.W}" height="${ps.H}" transform="matrix(${f} 0 0 ${f} ${(X0 - f * ps.frame.ox).toFixed(2)} ${(SY - f * ps.frame.oy).toFixed(2)})" opacity="${th.ghost}" filter="url(#mg)"/>`); }
    // the lifting panels (front spar at 15 % of the chord), the control share hatched
    const quad = (st, P) => {
      const F0 = P3(M, st[0]), F1 = P3(M, st[1]), R0 = P3(M, st[2]), R1 = P3(M, st[3]), ch = st[4], cs = st[6];
      const at = (F, R, t) => { const d = [0, 1, 2].map(q => R[q] - F[q]), Ln = Math.hypot(...d) || 1; return [0, 1, 2].map(q => F[q] + d[q] / Ln * ch * (t - 0.15)); };
      const hinge = 1 - cs, poly = (pts, attr) => `<path d="M${pts.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' L')} Z" ${attr}/>`;
      return poly([at(F0, R0, 0), at(F1, R1, 0), at(F1, R1, hinge), at(F0, R0, hinge)].map(P), K.fillAttr(CAT.structure, th === THEMES.sheet ? 0.3 : 0.16)) +
        (cs > 0 ? poly([at(F0, R0, hinge), at(F1, R1, hinge), at(F1, R1, 1), at(F0, R0, 1)].map(P), `fill="url(#mh)" stroke="${CAT.fittings}" stroke-width="0.9"`) : '');
    };
    for (const st of M.strips) if (M.KIND[st[5]] !== 'fin') out.push(quad(st, pl));
    for (const st of M.strips) if (M.KIND[st[5]] === 'fin') out.push(quad(st, sd));
    for (const b of M.beams) { if (b[3]) continue; const A = P3(M, b[0]), B = P3(M, b[1]); out.push(K.L(pl(A), pl(B), th.member, 0.6) + K.L(sd(A), sd(B), th.member, 0.6)); }
    // the body's two drag points, flat plates to scale
    const disc = (q, a) => `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${(Math.sqrt(a / Math.PI) * s).toFixed(1)}" fill="${th.ink}" fill-opacity=".1" stroke="${th.ink}" stroke-width="1.3" stroke-dasharray="4 3"/>`;
    if (M.drag.fwd) out.push(disc(sd(M.drag.fwd), M.drag.cda[0]));
    if (M.drag.aft) out.push(disc(sd(M.drag.aft), (M.drag.cdaAft[1] || 0) * 0.25));
    // the propeller disc, edge-on
    const ex = M.prop.pusher ? eng[0] + 0.25 : eng[0] - 0.12;
    out.push(K.L(pl([ex, 0, -Dp / 2]), pl([ex, 0, Dp / 2]), CAT.engine, 2.6) + K.L(sd([ex, eng[1] - Dp / 2, 0]), sd([ex, eng[1] + Dp / 2, 0]), CAT.engine, 2.6));
    for (const i of M.contacts) { const q = sd(P3(M, i)); out.push(`<rect x="${(q[0] - 4).toFixed(1)}" y="${(q[1] - 4).toFixed(1)}" width="8" height="8" ${K.fillAttr(CAT.gear, 0.95)}/>`); }
    if (M.floats) for (const q of byTag(M, 'FLK')) { const p = sd(q); out.push(`<rect x="${(p[0] - 2.5).toFixed(1)}" y="${(p[1] - 2.5).toFixed(1)}" width="5" height="5" ${K.fillAttr(CAT.gear, 0.95)}/>`); }
    const mr = m => Math.max(0.9, Math.sqrt(m) * 0.95);
    for (const q of n) if (q[3] > 0.05) { const a = pl(q), b = sd(q);
      out.push(`<circle cx="${a[0].toFixed(1)}" cy="${a[1].toFixed(1)}" r="${mr(q[3]).toFixed(1)}" fill="${th.ink}" fill-opacity=".75"/><circle cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" r="${mr(q[3]).toFixed(1)}" fill="${th.ink}" fill-opacity=".75"/>`); }
    // the right column: the legend, each kind with its mark and its count
    const cx = 790; let y = 186;
    const nW = M.strips.filter(st => M.KIND[st[5]] === 'wing').length, nC = M.strips.filter(st => st[6] > 0).length, kg = n.reduce((a, q) => a + q[3], 0);
    const row = (mark, t1, t2) => { out.push(mark(cx + 10, y - 5) + K.T(cx + 34, y, t1, { sz: 15, w: 500 }) + K.T(cx + 34, y + 18, t2, { sz: 13, c: th.dim })); y += 62; };
    row((x, yy) => `<circle cx="${x}" cy="${yy}" r="6" fill="${th.ink}" fill-opacity=".75"/>`, n.length + ' mass points, ' + r0(kg) + ' kg', 'the size of a dot is its weight');
    row((x, yy) => K.L([x - 9, yy], [x + 9, yy], th.ink, 1), M.beams.length + ' members', 'each its own spring and damper; each can bend or break');
    row((x, yy) => `<rect x="${x - 9}" y="${yy - 6}" width="18" height="12" ${K.fillAttr(CAT.structure, 0.4)}/>`, nW + ' wing and ' + (M.strips.length - nW) + ' tail panels', 'each its own lift and drag, at its own airflow');
    row((x, yy) => `<rect x="${x - 9}" y="${yy - 6}" width="18" height="12" fill="url(#mh)" stroke="${CAT.fittings}"/>`, nC + ' with a control surface', 'aileron, flap, elevator, rudder: the rear share moves');
    row((x, yy) => `<circle cx="${x}" cy="${yy}" r="8" fill="${th.ink}" fill-opacity=".1" stroke="${th.ink}" stroke-dasharray="3 2"/>`, 'The body: two drag points', 'front ' + (M.drag.cda[0] || 0).toFixed(2) + ' m², the nose, cowl and gear in it');
    row((x, yy) => K.L([x, yy - 9], [x, yy + 9], CAT.engine, 2.6), 'Propeller: a disc ' + Dp.toFixed(2) + ' m across', 'thrust off its curve; the engine is ' + r0(M.engineKg) + ' kg on its mount');
    row((x, yy) => `<rect x="${x - 4}" y="${yy - 4}" width="8" height="8" ${K.fillAttr(CAT.gear, 0.95)}/>`, M.floats ? 'Float keels and wheels' : 'Wheels', 'where the plane touches the ground or the water');
    if (o.note) out.push(K.T(48, H - 32, o.note, { sz: 12, c: th.warn }));
    return out;
  }

  let svgSeq = 0;
  function svg(page, data, opts) {
    const o = opts || {}, th = THEMES[o.theme] || THEMES.sheet, K = kit(th);
    const f = { load: pageLoad, drag: pageDrag, xray: pageXray, model: pageModel }[page];
    if (!f) throw new Error('no physics page ' + page);
    // the ids a page defines (patterns, filters, its clip) made the drawing's own: several pages share one document
    const uid = 'fp' + (++svgSeq) + '_';
    return wrap(f(data, o, th, K), (PAGES.find(p => p.id === page) || {}).name + (o.name ? ' of the ' + o.name : ''))
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
    if (rec.physics) return Promise.resolve(rec.physics);
    if (cache[key]) return cache[key];
    if (rec.baked && rec.pics && typeof rec.pics.side === 'string') {
      const url = rec.pics.side.replace(/[^/]*$/, 'physics.json');
      return (cache[key] = fetch(url).then(r => (r.ok ? r.json() : null)).catch(() => null));
    }
    const spec = o.spec || null, BW = root && root.BENCH_WORKER;
    if (!spec || !BW || typeof BW.start !== 'function') return Promise.resolve(null);
    return (cache[key] = new Promise(res => {
      let w = null;
      w = BW.start(m => { if (m && m.kind === 'fiche') { res(m.data || null); if (w) w.kill(); } }, () => res(null));
      if (!w || !w.post({ kind: 'fiche', seq: 1, spec: JSON.parse(JSON.stringify(spec)) })) { if (w) w.kill(); res(null); }
    }));
  }
  function picsFor(rec, model, inline) {
    const out = {}, s = (rec.data && rec.data.pxPerM) || 0;
    return Promise.all(['side', 'plan'].map(v => {
      const b = rec.pics && rec.pics[v]; if (!b || !s) return null;
      return (inline ? dataUri(b) : Promise.resolve(blobUrl(b))).then(href => new Promise(res => {
        const im = new Image(); im.onload = () => frameOf(model, v, im, s).then(fr => { out[v] = { href, W: im.naturalWidth, H: im.naturalHeight, s, frame: fr }; res(); }, () => res());
        im.onerror = () => res(); im.src = href; }));
    })).then(() => out);
  }
  const sigOf = () => { try { return (root.FICHE_BOARD && root.FICHE_BOARD.sig) ? root.FICHE_BOARD.sig() : ''; } catch (e) { return ''; } };
  // draw `page` of `rec` into `el` (theme 'sheet' on the board); resolves false when there is no data
  function mount(el, rec, page, opts) {
    const o = opts || {};
    el.textContent = 'Working out the physics pages…';
    return dataFor(rec, o).then(D => {
      if (!D) { el.textContent = 'Put this aeroplane on the stand to draw its physics pages.'; return false; }
      return picsFor(rec, D.model, false).then(pics => {
        el.innerHTML = svg(page, D, { theme: o.theme || 'sheet', name: o.title || (rec.data && rec.data.name) || rec.name, reg: rec.data && rec.data.reg, pics, sig: sigOf() });
        const sv = el.querySelector('svg'); if (sv) { sv.style.width = '100%'; sv.style.height = 'auto'; sv.style.display = 'block'; }
        return true;
      });
    });
  }
  // the share's picture of a page: 2400 x 1600 PNG (the fiche's own share size), the pictures inlined so the canvas can read them
  function compose(rec, page, opts) {
    const o = opts || {};
    return dataFor(rec, o).then(D => { if (!D) return null;
      return picsFor(rec, D.model, true).then(pics => new Promise((res, rej) => {
        const text = svg(page, D, { theme: o.theme || 'sheet', name: o.title || (rec.data && rec.data.name) || rec.name, reg: rec.data && rec.data.reg, pics, sig: sigOf() });
        const im = new Image(), url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
        im.onload = () => { const c = document.createElement('canvas'); c.width = 2 * W; c.height = 2 * H; c.getContext('2d').drawImage(im, 0, 0, 2 * W, 2 * H); URL.revokeObjectURL(url); c.toBlob(res, 'image/png'); };
        im.onerror = e => { URL.revokeObjectURL(url); rej(e); }; im.src = url; })); });
  }
  const API = { PAGES, THEMES, CAT, svg, fitFrame, frameOf, GRPNAME, memberName, W, H, mount, compose, dataFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.FICHE_PHYSICS = API;
})(typeof window !== 'undefined' ? window : null);
