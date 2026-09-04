// BALANCE (G101) — THE WEIGHT-AND-BALANCE CHART, and the numbers under it.
//
// The user, at the start of the energy arc: "we need things physically
// correct... we need to see how the CG is changing with the amount of fuel".
// G100 gave that a slider; this is the chart a real aeroplane's flight manual
// has — CG across, mass up — with the loading drawn on it: the four corners,
// the stability limits, and the LINE the CG walks as the fuel burns at the
// loading you choose (occupants, baggage), from full through reserves to dry.
//
// TWO HALVES, ONE FILE. `compute` is pure and node-loadable: it takes the
// RESOLVED spec and the core's own functions and returns the points; GATE
// ENERGY runs it headless. `draw` puts those points on a 2-D canvas in the
// editor's panel. Nothing here estimates anything — every point is
// genShakedown over genSpecAtFuel, the same door the reserve sheet and the
// envelope's corners go through.
//
// THE LIMITS ARE WHAT THE MODEL KNOWS. The aft limit is the neutral point
// (static margin 0) and a caution line sits 5% of the mean chord ahead of it,
// the fleet's own "twitchy" band. There is NO FORWARD LIMIT drawn: the model
// has no elevator-authority rule to place one, and a line the aeroplane
// cannot justify would be a decoration. The forward corner is marked instead.
'use strict';
(() => {

// the mean chord and the wing's leading edge, from what the shakedown gives:
// staticMargin = (npX - cgX) / cBar, so cBar is exact; xLE is the wing's own
function scale(S, sh) {
  const cBar = (sh.staticMargin && isFinite(sh.staticMargin) && Math.abs(sh.staticMargin) > 1e-6)
    ? (sh.npX - sh.cgX) / sh.staticMargin : null;
  const w0 = S && S.wings && S.wings[0];
  const xLE = (w0 && typeof w0.xLE === 'number' && isFinite(w0.xLE)) ? w0.xLE : null;
  return { cBar, xLE, pct: x => (cBar && xLE != null) ? (x - xLE) / cBar : null };
}

// compute(S, core, opts) -> the chart's data
//   S      the RESOLVED (built) spec — `GARAGE_SPEC.resolved()` in the game
//   core   { buildGen, genShakedown, genSpecAtFuel }
//   opts   { occupants, baggage, fill, envelope }  (envelope: the full
//          shakedown's, when the caller already has it; else computed)
function compute(S, core, opts) {
  const o = opts || {};
  const seats = Math.max(1, S.seats | 0);
  const occ = Math.max(1, Math.min(seats, o.occupants != null ? o.occupants : (S.occupants || 1)));
  const bag = Math.max(0, o.baggage != null ? o.baggage : (S.cabin && S.cabin.baggage) || 0);
  const litresFull = (S.fuel && S.fuel.litres > 0) ? S.fuel.litres : 0;
  const litresRes = litresFull > 10 ? Math.max(4, 0.15 * litresFull) : litresFull;
  const battery = S.energy && S.energy.kind === 'battery';

  const at = L => {
    const cs = core.genSpecAtFuel(S, L);
    cs.cabin.pilots = 1;
    cs.cabin.pax = Math.max(0, occ - 1);
    cs.cabin.baggage = bag;
    const sh = core.genShakedown(core.buildGen(cs), { slim: true });
    return { litres: L, mass: sh.mass, cgX: sh.cgX, npX: sh.npX, staticMargin: sh.staticMargin };
  };
  // the full point first: it fixes the scale and the limits
  const full = at(litresFull);
  const sc = scale(S, full);
  const fills = battery ? [1] : [1, 0.75, 0.5, 0.25, litresFull > 0 ? litresRes / litresFull : 0, 0];
  const seen = new Set();
  const burn = [];
  for (const f of fills) {
    const k = +Math.max(0, Math.min(1, f)).toFixed(4);
    if (seen.has(k)) continue;
    seen.add(k);
    const p = k === 1 ? full : at(litresFull * k);
    p.fill = k; p.cgPct = sc.pct(p.cgX);
    p.reserve = !battery && litresFull > 10 && Math.abs(litresFull * k - litresRes) < 1e-6;
    burn.push(p);
  }
  burn.sort((a, b) => b.fill - a.fill);
  // the point the slider is at
  const fill = Math.max(0, Math.min(1, o.fill != null ? o.fill : 1));
  const now = battery ? full : at(litresFull * fill);
  now.fill = fill; now.cgPct = sc.pct(now.cgX);
  // the envelope's corners, the caller's or fresh
  let corners = o.envelope && o.envelope.corners;
  if (!corners) {
    const corner = (label, n, L) => {
      const cs = core.genSpecAtFuel(S, L);
      cs.cabin.pilots = 1; cs.cabin.pax = Math.max(0, n - 1);
      const sh = core.genShakedown(core.buildGen(cs), { slim: true });
      return { label, occupants: n, litres: L, mass: sh.mass, cgX: sh.cgX,
               staticMargin: sh.staticMargin, cgPct: sc.pct(sh.cgX) };
    };
    corners = [corner('solo · full fuel', 1, litresFull), corner('solo · reserves', 1, litresRes),
               corner('full cabin · full fuel', seats, litresFull),
               corner('full cabin · reserves', seats, litresRes)];
  }
  // the limits, as CG positions: the neutral point (SM 0) and 5% ahead of it
  const limits = { npX: full.npX, cautionX: sc.cBar ? full.npX - 0.05 * sc.cBar : null,
                   npPct: sc.pct(full.npX), cautionPct: sc.cBar ? sc.pct(full.npX - 0.05 * sc.cBar) : null };
  return { occupants: occ, seats, baggage: bag, battery, litresFull, litresRes,
           cBar: sc.cBar, xLE: sc.xLE, burn, now, corners, limits };
}

// ---------------------------------------------------------------------------
// draw(canvas, D) — the chart. CG in % MAC across (metres when the wing's
// leading edge is unknown), mass up. Deliberately plain: the numbers are the
// content, and every mark on it is a measurement.
// ---------------------------------------------------------------------------
function draw(cv, D, style) {
  if (!cv || !cv.getContext || !D) return;
  const st = Object.assign({ fg: '#dfe7f0', dim: 'rgba(223,231,240,.45)',
    grid: 'rgba(223,231,240,.10)', np: '#ff6b5a', caution: '#ffb24a',
    burn: '#5aa0ff', now: '#ffd35a', corner: '#dfe7f0', font: '10px system-ui, sans-serif' }, style || {});
  const dp = (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1) || 1;
  const Wc = cv.clientWidth || 260, Hc = cv.clientHeight || 150;
  cv.width = Math.round(Wc * dp); cv.height = Math.round(Hc * dp);
  const g = cv.getContext('2d');
  g.setTransform(dp, 0, 0, dp, 0, 0);
  g.clearRect(0, 0, Wc, Hc);
  const usePct = D.cBar && D.xLE != null;
  const X = p => usePct ? p.cgPct * 100 : p.cgX;
  // the x range: every point and both limits, with room either side
  const xs = [], ys = [];
  for (const p of D.burn.concat(D.corners, [D.now])) { if (p && isFinite(X(p))) { xs.push(X(p)); ys.push(p.mass); } }
  const lim = usePct ? [D.limits.npPct * 100, D.limits.cautionPct != null ? D.limits.cautionPct * 100 : null]
                     : [D.limits.npX, D.limits.cautionX];
  for (const v of lim) if (v != null && isFinite(v)) xs.push(v);
  if (!xs.length || !ys.length) return;
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const px = Math.max(usePct ? 4 : 0.08, (x1 - x0) * 0.18), py = Math.max(20, (y1 - y0) * 0.25);
  x0 -= px; x1 += px; y0 -= py; y1 += py;
  const L = 34, R = 8, T = 8, B = 20;
  const sx = v => L + (v - x0) / (x1 - x0) * (Wc - L - R);
  const sy = v => Hc - B - (v - y0) / (y1 - y0) * (Hc - T - B);
  g.font = st.font; g.lineWidth = 1;
  // grid and axes
  g.strokeStyle = st.grid; g.fillStyle = st.dim; g.textAlign = 'center'; g.textBaseline = 'top';
  const xstep = usePct ? (x1 - x0 > 30 ? 10 : 5) : 0.1;
  for (let v = Math.ceil(x0 / xstep) * xstep; v <= x1 + 1e-9; v += xstep) {
    g.beginPath(); g.moveTo(sx(v), T); g.lineTo(sx(v), Hc - B); g.stroke();
    g.fillText(usePct ? v.toFixed(0) + '%' : v.toFixed(1), sx(v), Hc - B + 3);
  }
  g.textAlign = 'right'; g.textBaseline = 'middle';
  const ystep = (y1 - y0) > 400 ? 100 : 50;
  for (let v = Math.ceil(y0 / ystep) * ystep; v <= y1 + 1e-9; v += ystep) {
    g.beginPath(); g.moveTo(L, sy(v)); g.lineTo(Wc - R, sy(v)); g.stroke();
    g.fillText(v.toFixed(0), L - 3, sy(v));
  }
  g.textAlign = 'left'; g.textBaseline = 'bottom';
  g.fillText(usePct ? 'CG, % MAC' : 'CG, m', L + 2, T + 10);
  g.save(); g.translate(8, Hc - B); g.rotate(-Math.PI / 2); g.textAlign = 'left';
  g.fillText('kg', 0, 0); g.restore();
  // the limits
  const vline = (v, col, label) => {
    if (v == null || !isFinite(v)) return;
    g.strokeStyle = col; g.setLineDash([4, 3]);
    g.beginPath(); g.moveTo(sx(v), T); g.lineTo(sx(v), Hc - B); g.stroke();
    g.setLineDash([]);
    g.fillStyle = col; g.textAlign = 'right'; g.textBaseline = 'top';
    g.fillText(label, sx(v) - 3, T + 2);
  };
  vline(lim[1], st.caution, 'caution');
  vline(lim[0], st.np, 'neutral');
  // the burn line, full to dry, the reserve point hollow
  if (D.burn.length > 1) {
    g.strokeStyle = st.burn; g.lineWidth = 1.5; g.beginPath();
    D.burn.forEach((p, i) => { if (i) g.lineTo(sx(X(p)), sy(p.mass)); else g.moveTo(sx(X(p)), sy(p.mass)); });
    g.stroke(); g.lineWidth = 1;
    for (const p of D.burn) {
      g.beginPath(); g.arc(sx(X(p)), sy(p.mass), p.reserve ? 3.5 : 2, 0, Math.PI * 2);
      if (p.reserve) { g.strokeStyle = st.burn; g.stroke(); } else { g.fillStyle = st.burn; g.fill(); }
    }
    const a = D.burn[0], z = D.burn[D.burn.length - 1];
    g.fillStyle = st.dim; g.textAlign = 'left'; g.textBaseline = 'bottom';
    g.fillText('full', sx(X(a)) + 4, sy(a.mass) - 2);
    g.fillText('dry', sx(X(z)) + 4, sy(z.mass) - 2);
  }
  // the corners, hollow, labelled by their short names
  const short = { 'solo · full fuel': 'S/F', 'solo · reserves': 'S/R',
                  'full cabin · full fuel': 'C/F', 'full cabin · reserves': 'C/R' };
  for (const c of D.corners) {
    if (!isFinite(X(c))) continue;
    g.strokeStyle = st.corner; g.beginPath(); g.arc(sx(X(c)), sy(c.mass), 3, 0, Math.PI * 2); g.stroke();
    g.fillStyle = st.dim; g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillText(short[c.label] || c.label, sx(X(c)) + 4, sy(c.mass) + 1);
  }
  // where the slider is
  if (D.now && isFinite(X(D.now))) {
    g.fillStyle = st.now; g.beginPath(); g.arc(sx(X(D.now)), sy(D.now.mass), 4, 0, Math.PI * 2); g.fill();
  }
}

const API = { compute, draw, scale };
if (typeof window !== 'undefined') window.BALANCE = API;
if (typeof module !== 'undefined') module.exports = API;
})();
