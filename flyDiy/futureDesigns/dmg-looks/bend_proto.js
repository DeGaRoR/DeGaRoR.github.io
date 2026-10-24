// DMG-LOOKS prototype 2 (node only): A CRUSHED MEMBER DRAWN BENT, NOT SHORTENED.
//
// Today a drawn frame tube is bound to its member's two end nodes by its station t (skin_break.js 'tube' class,
// G1855): pos = (1-t) a + t b + the ends' turn. When the solver crushes the member (TREE-CRASH / DMG-D1a: perfectly
// plastic to the 3 % kink, then a compression floor) or bends it round a trunk (b.dk, b.kt1, b.dN*), the chord gets
// shorter and the DRAWN TUBE GETS SHORTER WITH IT: straight, telescoped. Steel does not vanish; it folds.
// Proposal: keep the drawn length. A crushed member is drawn as two legs meeting at a hinge at station kt1 (0.5 for an
// Euler kink, the trunk's contact station for a trunk bend), the hinge pushed sideways (the solver's bend direction
// where it has one, else a seeded side) so the legs keep L0 = their rest length. One closed form per riding vertex:
//   legs a = kt1 L0, b = (1 - kt1) L0, chord c;  x = (a^2 - b^2 + c^2) / 2c;  h = sqrt(max(a^2 - x^2, 0))
//   the vertex at station t is on leg 1 (t <= kt1) or leg 2, offset h * tent(t) along the bend direction.
// It fits the GPU riding (skin_gpu.js RIDE_VS): a tube place blends only its member's 2 end nodes, so 6 of its 8 slots
// are free to carry L0, kt1 and the direction. Nothing new per frame but a sqrt.
//   node bend_proto.js   -> bend_members.svg (rest / today / proposed) and the length table
'use strict';
const fs = require('fs'), path = require('path'), N = require('./noise.js');

// a fuselage side bay, Warren-braced: two longerons, verticals, diagonals (m; x aft, y up)
const nodes = [], beams = [];
for (let i = 0; i <= 4; i++) { nodes.push([i * 0.5, 0]); nodes.push([i * 0.5, 0.6]); }
for (let i = 0; i < 4; i++) { const b0 = 2 * i, t0 = b0 + 1, b1 = b0 + 2, t1 = b0 + 3; beams.push([b0, b1], [t0, t1], [b1, t1], i % 2 ? [b0, t1] : [t0, b1]); }
beams.push([0, 1]);
const rest = nodes.map(p => p.slice());
// the crash: the nose end pushed aft 9 cm and the lower longeron's front bay folded up (a nose-in on soft ground)
const live = nodes.map(([x, y], i) => { const f = Math.max(0, 1 - x / 1.0); return [x + 0.09 * f * (y > 0.3 ? 0.4 : 1), y + 0.02 * f]; });
const L = (P, b) => Math.hypot(P[b[1]][0] - P[b[0]][0], P[b[1]][1] - P[b[0]][1]);

function drawToday(b, P) { return [P[b[0]], P[b[1]]]; }       // straight, whatever the chord
function drawBent(b, P, bi) {
  const A = P[b[0]], B = P[b[1]], L0 = L(rest, b), c = L(P, b);
  if (c >= L0 * 0.9995) return [A, B];
  const kt1 = 0.5 + 0.15 * (N.h1(bi, 7) - 0.5), a = kt1 * L0, bb = (1 - kt1) * L0;
  const x = (a * a - bb * bb + c * c) / (2 * c), h = Math.sqrt(Math.max(a * a - x * x, 0));
  const ux = (B[0] - A[0]) / c, uy = (B[1] - A[1]) / c, side = N.h1(bi, 11) < 0.5 ? 1 : -1;
  const H = [A[0] + ux * x - uy * h * side, A[1] + uy * x + ux * h * side];
  // a short flattened knuckle at the hinge (a plastic hinge is a crease, not a point): 4 points
  const k = 0.04, p1 = [H[0] + (A[0] - H[0]) * k / a, H[1] + (A[1] - H[1]) * k / a], p2 = [H[0] + (B[0] - H[0]) * k / bb, H[1] + (B[1] - H[1]) * k / bb];
  return [A, p1, [(p1[0] + p2[0]) / 2 * 0.5 + H[0] * 0.5, (p1[1] + p2[1]) / 2 * 0.5 + H[1] * 0.5], p2, B];
}
const plen = pts => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);

const S = 300, OX = 30, OY = 260, panelW = 2 * S + 60;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${panelW * 3}" height="300" font-family="sans-serif" font-size="14">\n<rect width="100%" height="100%" fill="#1e2024"/>\n`;
const tx = (p, ox) => `${(OX + ox + p[0] * S).toFixed(1)},${(OY - p[1] * S).toFixed(1)}`;
const panel = (title, ox, P, fn) => {
  svg += `<text x="${ox + OX}" y="24" fill="#ddd">${title}</text>\n`;
  beams.forEach((b, bi) => { const pts = fn(b, P, bi), c = L(P, b), L0 = L(rest, b), crushed = c < L0 * 0.9995;
    svg += `<polyline fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="7" stroke="${crushed && fn !== drawToday ? '#b9b39a' : crushed ? '#c7a07a' : '#8a9aa6'}" points="${pts.map(p => tx(p, ox)).join(' ')}"/>\n`; });
  P.forEach(p => { svg += `<circle cx="${tx(p, ox).split(',')[0]}" cy="${tx(p, ox).split(',')[1]}" r="4" fill="#e8e8e8"/>\n`; });
};
panel('rest', 0, rest, drawToday);
panel('today: chord shortened, drawn straight (telescoped)', panelW, live, drawToday);
panel('proposed: same physics, drawn length kept (kinked)', 2 * panelW, live, drawBent);
svg += '</svg>\n';
fs.writeFileSync(path.join(__dirname, 'bend_members.svg'), svg);

console.log('member      rest L0   chord   today drawn   proposed drawn   kink depth h');
beams.forEach((b, bi) => { const L0 = L(rest, b), c = L(live, b); if (c >= L0 * 0.9995) return;
  const pb = drawBent(b, live, bi), kt1 = 0.5 + 0.15 * (N.h1(bi, 7) - 0.5), a = kt1 * L0, x = (a * a - ((1 - kt1) * L0) ** 2 + c * c) / (2 * c);
  console.log(`${String(b).padEnd(10)} ${L0.toFixed(3).padStart(7)} ${c.toFixed(3).padStart(7)} ${c.toFixed(3).padStart(10)} ${plen(pb).toFixed(3).padStart(14)}   ${(Math.sqrt(Math.max(a * a - x * x, 0)) * 100).toFixed(1).padStart(6)} cm  (${((1 - c / L0) * 100).toFixed(1)} % short)`); });
console.log('wrote bend_members.svg');
