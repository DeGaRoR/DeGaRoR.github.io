// v3 marks 5-8 (landscape, shield, paw, compass)
const K = require('./core_v3.js');
const { I, H, r2, P, C, G, poly, halo, swoosh, swooshC, ctx, CLIP, peak, tree, ring, star, cubMark, headOn, sliver } = K;
const M = [];

// 5 MIDNIGHT VALLEY: sun disc behind layered peaks, a river winding out, islands, spruce on a rocky point (round)
{
  const cx = ctx('m5'); let m = '';
  m += ring(120, 120, 118, 110);
  const id = cx.clip('M10,120 a110,110 0 1,0 220,0 a110,110 0 1,0 -220,0Z');
  let s = C(156, 92, 40);
  const mts = peak(cx, [92, 44], [4, 152], [176, 152], { f: 0.28, n: 5, t: 4.4, amp: 5 }) + peak(cx, [178, 76], [124, 152], [252, 152], { f: 0.3, n: 4, t: 4, amp: 4.4 });
  s += halo(P(poly([[92, 44], [4, 152], [252, 152], [178, 76], [149, 113]])), 7) + mts;
  s += swoosh([0, 154], [240, 150], 2, 8, 0.4);
  // the river: from the foot of the range out to the bottom right
  s += swooshC([120, 158], [190, 166], [110, 188], [210, 222], 11, 0.5);
  // islands
  s += swoosh([150, 172], [186, 171], 5, 7, 1) + swoosh([196, 190], [224, 189], 4, 6, 1);
  // the rocky point with its spruce
  s += P('M24,240 L36,202 C52,194 72,194 88,200 C104,205 118,212 128,220 C134,226 138,234 140,240 Z');
  s += tree(62, 200, 50, 21, 4) + tree(80, 203, 38, 16, 4) + tree(46, 202, 32, 14, 3) + tree(98, 207, 28, 13, 3);
  // swell lines
  s += swoosh([70, 172], [126, 170], 2, 4.4, 0.5) + swoosh([110, 190], [150, 188], 2, 4, 0.5);
  m += CLIP(id, s);
  M.push({ id: 'midnight-valley', name: 'Midnight valley', theme: 'mountains, rivers, lakes, forests', w: 240, h: 240, defs: cx.defs.join(''), mask: m,
    idea: 'A big sun disc behind layered snow peaks, a river swoosh winding out to you, small islands and a spruce stand on a rocky point.' });
}

// 6 NORTHERN SHIELD: arched shield, aurora swirls and stars, peaks, a high-wing plane, a row of spruce
{
  const cx = ctx('m6'); let m = '';
  const W = 200, Hh = 262;
  const ARCH = i => `M${i},${Hh - i} L${i},100 A${100 - i},${100 - i} 0 0 1 ${W - i},100 L${W - i},${Hh - i} Z`;
  m += `<path fill-rule="evenodd" fill="${I}" d="${ARCH(0)} ${ARCH(7)}"/>`;
  const id = cx.clip(ARCH(11));
  let s = '';
  // aurora: three swirling ribbons
  s += swooshC([14, 76], [60, 30], [110, 96], [190, 42], 11, 0.5);
  s += swooshC([30, 96], [80, 62], [130, 112], [196, 70], 7, 0.5);
  s += swooshC([60, 46], [92, 26], [130, 52], [170, 28], 6, 0.5);
  for (const [x, y, r] of [[52, 34, 5], [150, 92, 4.4], [32, 112, 4], [172, 120, 3.6], [100, 22, 3.6]]) s += star(x, y, r);
  // peaks
  s += peak(cx, [62, 140], [16, 196], [110, 196], { f: 0.32, n: 3, t: 3.6, amp: 4 });
  s += peak(cx, [138, 112], [80, 196], [204, 196], { f: 0.3, n: 4, t: 4.2, amp: 5 });
  s += swoosh([0, 198], [200, 194], 2, 8, 0.3);
  // the plane over the range
  const tf = 'translate(64,118) rotate(-6) scale(0.46) translate(-110,-40)';
  s += halo(G(tf, cubMark({ detail: false, lw: 6, tyre: 12 })), r2(6 / 0.46)) + G(tf, cubMark({ lw: 6, tyre: 12 }));
  // spruce row and the ground
  for (let x = 16; x < 196; x += 15) s += tree(x, 246, 32 + 18 * Math.abs(Math.sin(x * 0.53)), 19, 4);
  s += P(`M0,240 H200 V262 H0 Z`);
  m += CLIP(id, s);
  M.push({ id: 'northern-shield', name: 'Northern shield', theme: 'aurora, mountains, flying, forests', w: W, h: Hh, defs: cx.defs.join(''), mask: m,
    idea: 'An arched shield: aurora swirls and stars, a high-wing plane over the snow peaks, a row of spruce at the foot.' });
}

// 7 BEAR PAW: toe pads and long claws; the main pad holds peaks and a winding river, cut out
{
  const cx = ctx('m7'); let m = '';
  const PAD = 'M38,158 C38,124 74,108 110,108 C146,108 182,124 182,158 C182,190 162,214 140,208 C126,204 94,204 80,208 C58,214 38,190 38,158 Z';
  m += P(PAD);
  const toes = [[36, 98, 13, 16.4, -28], [66, 74, 13.6, 17.4, -13], [102, 64, 14.4, 18.4, 0], [138, 66, 13.6, 17.4, 12], [168, 86, 13, 16.4, 26]];
  for (const [x, y, rx, ry, a] of toes) {
    m += `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${I}" transform="rotate(${a} ${x} ${y})"/>`;
    // the claw: from just above the toe, long and curving forward (up), a gap between toe and claw
    const r = a * Math.PI / 180, ux = Math.sin(r), uy = -Math.cos(r);
    const b0 = [x + ux * (ry + 4.6), y + uy * (ry + 4.6)], tip = [x + ux * (ry + 34), y + uy * (ry + 34)];
    m += sliver([b0, [b0[0] + ux * 14 + uy * -2.6, b0[1] + uy * 14 + ux * 2.6], tip], 11, I, 'end');
  }
  // the landscape inside the pad, kept inside a rim
  cx.defs.push('<clipPath id="ID_m7_in"><path d="' + PAD + '" transform="translate(110,160) scale(0.88) translate(-110,-160)"/></clipPath>');
  const id = 'm7_in';
  let s = '';
  s += P('M20,90 H200 V150 L170,150 L150,126 L134,142 L108,110 L82,140 L70,128 L48,150 L20,150 Z', H);
  s += peak(cx, [108, 110], [78, 147], [138, 147], { f: 0.34, n: 3, t: 3.6, amp: 3.6 });
  s += swooshC([96, 202], [140, 186], [80, 170], [112, 146], 9, 0.5, H);
  s += swoosh([52, 172], [86, 168], 3, 4, 0.5, H) + swoosh([136, 170], [168, 172], 3, 4, 0.5, H);
  m += CLIP(id, s);
  M.push({ id: 'bear-paw', name: 'Bear paw', theme: 'bear, mountains, rivers', w: 220, h: 222, defs: cx.defs.join(''), mask: m,
    idea: 'A grizzly forepaw: five toe pads and long claws; the main pad holds a snow peak and a winding river, cut out of it.' });
}

// 8 TRUE NORTH: a compass ring with a long north needle; a peak inside and a plane head-on at the centre
{
  const cx = ctx('m8'); let m = '';
  const X = 120, Y = 138, R = 78, Ri = 70;
  m += ring(X, Y, R, Ri);
  m += P(poly([[X, 4], [X + 13, Y - R + 2], [X - 13, Y - R + 2]]));
  m += P(poly([[X, 256], [X + 10, Y + R - 2], [X - 10, Y + R - 2]]));
  m += P(poly([[X + R - 2, Y - 8], [X + R + 24, Y], [X + R - 2, Y + 8]])) + P(poly([[X - R + 2, Y - 8], [X - R - 24, Y], [X - R + 2, Y + 8]]));
  m += sliver([[X, 14], [X, 40], [X, Y - R - 2]], 3, H, 'start');                    // the needle's split
  const id = cx.clip(`M${X - Ri},${Y} a${Ri},${Ri} 0 1,0 ${2 * Ri},0 a${Ri},${Ri} 0 1,0 ${-2 * Ri},0Z`);
  let s = peak(cx, [X - 26, Y + 22], [X - 100, Y + 80], [X + 50, Y + 80], { f: 0.32, n: 4, t: 3.8, amp: 4.2 }) + peak(cx, [X + 34, Y + 34], [X - 10, Y + 80], [X + 100, Y + 80], { f: 0.34, n: 3, t: 3.6, amp: 4 });
  s += P(`M0,${Y + 58} H240 V${Y + 90} H0 Z`);
  const pl = G(`translate(${X},${Y - 6})`, headOn(56));
  s += halo(G(`translate(${X},${Y - 6})`, headOn(56)), 6.4) + pl;
  m += CLIP(id, s);
  M.push({ id: 'true-north', name: 'True north', theme: 'flying, mountains', w: 240, h: 260, defs: cx.defs.join(''), mask: m,
    idea: 'A compass ring with a long north needle; inside, a snow peak and a high-wing bush plane coming straight at you on its big tyres.' });
}
module.exports = M;
if (require.main === module) console.log(M.map(d => d.id + ' ' + d.mask.length).join('\n'));
