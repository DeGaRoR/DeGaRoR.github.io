// v3 marks 1-4
const K = require('./core_v3.js');
const { I, H, r2, P, C, G, poly, halo, swoosh, swooshC, ctx, CLIP, peak, tree, ring, cubMark, sliver } = K;
const M = [];

// 1 STOL CUB: nose-high on tundra tyres over a winding river; the peak behind stands on one long swoosh
{
  const cx = ctx('m1'); let m = '';
  m += peak(cx, [112, 58], [64, 132], [160, 132], { f: 0.32, n: 4, t: 3.6, amp: 4 });
  m += peak(cx, [168, 20], [94, 134], [240, 134], { f: 0.3, n: 5, t: 4.2, amp: 5 });
  m += swoosh([4, 142], [238, 133], 4, 10, 0.25);
  // the river winding out of the valley towards you
  m += swooshC([206, 152], [80, 150], [176, 198], [14, 200], 12, 0.5);
  m += swoosh([150, 164], [236, 158], 3, 5.4, 0.5);
  const tf = 'translate(118,102) rotate(-13) scale(0.82) translate(-110,-40)';
  m += halo(G(tf, cubMark({ detail: false })), r2(7 / 0.82)) + G(tf, cubMark());
  M.push({ id: 'stol-river', name: 'Off the river bar', theme: 'STOL, mountains, rivers', w: 240, h: 204, defs: cx.defs.join(''), mask: m,
    idea: 'A Cub-type taildragger on big tundra tyres lifts off nose-high over a winding river; the peak behind stands on one long swoosh.' });
}

// 2 GRIZZLY RANGE: the bear's head in profile; its neck and hump run on into the peaks and curl down into a wave
// LIVERY-STICKERS (9 Nov, the user: "the head is too long and light, and the mass doesn't read as a bear"): a grizzly's
// own hump over the shoulders is now the highest thing on the back, the head carried below it, short and deep - a dished
// face, a blunt muzzle, a heavy jaw and a ruff under it; the peaks stay on the back and the mass still curls into a wave
{
  const cx = ctx('m2'); let m = '';
  const body = 'M8,172 C26,164 38,146 44,124 L62,90 L76,106 L96,66 L110,88 ' +
    'C116,72 126,56 140,50 C150,46 160,48 166,56 C169,60 171,64 172,68 ' +                    // the hump, then down to the nape
    'C172,60 178,54 185,56 C191,58 192,66 188,70 ' +                                          // the ear
    'C195,70 200,73 204,77 C207,80 210,81 214,81 ' +                                          // the brow, the dish of the face
    'C219,81 223,82 226,84 C229,86 230,90 229,94 C228,97 226,98 223,98 ' +                   // the muzzle, the blunt nose
    'C219,98 216,99 213,100 C214,105 212,110 206,114 C200,117 194,119 188,120 ' +            // the mouth, the heavy jaw
    'C183,121 179,124 177,128 C176,130 175,132 174,134 ' +                                    // the ruff under the jaw
    'C170,144 168,154 168,164 C150,177 110,186 70,186 C46,186 22,182 8,172 Z';
  m += P(body);
  m += peak(cx, [62, 90], [40, 134], [86, 134], { f: 0.32, n: 3, t: 3.6, amp: 4 });
  m += peak(cx, [96, 66], [68, 122], [124, 122], { f: 0.3, n: 4, t: 4.2, amp: 5 });
  // the shoulder under the hump and the ruff, cut as swooshes that run down into the water lines
  m += swooshC([136, 64], [152, 84], [156, 122], [148, 156], 5.4, 0.5, H);
  m += swooshC([184, 76], [186, 92], [184, 108], [178, 120], 4.4, 0.5, H);
  m += swoosh([22, 172], [140, 168], 6, 5, 0.5, H);
  m += swoosh([46, 154], [138, 150], 5, 4.4, 0.5, H);
  m += swooshC([30, 160], [20, 134], [48, 120], [64, 138], 4.4, 0.5, H);       // the curl of the wave
  m += `<ellipse cx="203" cy="83" rx="3.2" ry="2.6" fill="${H}"/>`;
  m += swoosh([222, 100.6], [209, 104.4], -1, 2.8, 0.5, H);                     // mouth
  m += swoosh([180, 62], [185.4, 66], -1.6, 2.6, 0.5, H);                       // ear
  M.push({ id: 'grizzly-range', name: 'Grizzly range', theme: 'bear, mountains', w: 240, h: 196, defs: cx.defs.join(''), mask: m,
    idea: 'A grizzly head in profile, dished face and small round ear under the big shoulder hump; the hump runs on into two snow peaks and the whole mass curls away like a wave.' });
}

// 3 ORCA: leaping clear of a curling wave
{
  let m = '';
  const ORCA = 'M196,55 C200.6,50 197.6,41 184,37 C168,33.4 146,32 124,32 L112,30 C108,14 104,-4 100,-18 C96,-8 92,14 86,32 ' +
    'C70,36 56,42 44,48 C36,51 28,52 22,52 L8,38 C4,35 -1,37 2,41.6 L12,56 L0,70 C-2.6,74 1.6,76.6 6,73 L22,60 ' +
    'C34,62 50,66 70,72 C100,80 140,80 164,72 C178,67 189,62 196,55 Z';
  let o = P(ORCA) + P('M150,73 C147,86 139,97 127,99.6 C125,92 131,82 137,75 Z');
  o += `<ellipse cx="157" cy="45.4" rx="11.6" ry="4.6" transform="rotate(-10 157 45.4)" fill="${H}"/>`;
  o += P('M186,60.6 C176,67 162,71.4 140,73.4 C122,75 106,73.6 94,70.4 C106,68 120,66 134,64.4 C152,62.6 170,61.6 186,60.6 Z', H);
  o += swoosh([98, 64], [60, 51], -2.6, 5.4, 0.5, H);
  const tf = 'translate(120,110) rotate(-32) scale(0.9) translate(-100,-50)';
  m += G(tf, o);
  // the wave it leaves: a crest curling over, and the swell running out in swooshes
  m += P('M4,208 C28,202 46,184 54,164 C60,148 76,138 94,141 C82,144 75,153 77,165 C79,177 93,181 105,173 C122,189 164,197 236,195 C182,206 92,214 4,214 Z');
  m += swoosh([28, 224], [226, 219], 3, 6.4, 0.5);
  m += swoosh([118, 186], [236, 184], 3, 5, 0.5);
  // spray off the tail
  m += swoosh([30, 150], [42, 132], 2, 5, 0.5) + swoosh([18, 160], [22, 142], 1.4, 4.2, 0.5) + swoosh([44, 160], [62, 150], 1.4, 4.2, 0.5);
  M.push({ id: 'orca', name: 'Orca', theme: 'the sea, orca', w: 240, h: 230, defs: '', mask: m,
    idea: 'An orca leaping clear of a curling wave, eye patch and belly cut out; the swell runs away in long swooshes.' });
}

// 4 WINGED PROPELLER: the prop and its hub ring in front of a ring of peaks, stepped wing bars either side
{
  const cx = ctx('m4'); let m = '';
  const X = 140, Y = 74, R = 44, Ri = 36.6;
  // the wing bars: four steps each side, merging into the ring, the tips cut on a slant
  [[45, 88], [57, 74], [69, 60], [81, 46]].forEach(([yt, len]) => {
    const yb = yt + 8, ym = yt + 4, xin = Math.sqrt(Math.max(0, R * R - (ym - Y) ** 2)) - 3;
    for (const s of [1, -1]) {
      const a = X + s * xin, e = X + s * (R + len);
      m += P(poly([[a, yt], [e, yt], [e - s * 9, yb], [a, yb]]));
    }
  });
  m += ring(X, Y, R, Ri);
  m += C(X, Y, Ri, H);
  // peaks inside the ring
  const inner = `M${X - Ri},${Y} a${Ri},${Ri} 0 1,0 ${2 * Ri},0 a${Ri},${Ri} 0 1,0 ${-2 * Ri},0Z`;
  const id = cx.clip(inner);
  m += CLIP(id, peak(cx, [124, 46], [88, 120], [162, 120], { f: 0.3, n: 4, t: 3.6, amp: 4 }) + peak(cx, [158, 62], [126, 120], [196, 120], { f: 0.32, n: 3, t: 3.4, amp: 3.6 }) + P(`M90,${Y + 22} H190 V130 H90 Z`));
  // the propeller in front: two blades and the hub ring, separated from the peaks by a gap
  const blades = swoosh([X, Y], [X + 18, Y - 64], 4, 13, 0.35) + swoosh([X, Y], [X - 18, Y + 64], 4, 13, 0.35) + C(X, Y, 12);
  m += halo(blades, 6.4) + blades;
  m += ring(X, Y, 8, 4.6, H);
  M.push({ id: 'winged-prop', name: 'Winged prop', theme: 'flying, mountains', w: 280, h: 148, defs: cx.defs.join(''), mask: m,
    idea: 'A propeller and its hub ring in front of a ring of snow peaks, stepped wing bars spreading out either side.' });
}
module.exports = M;
if (require.main === module) console.log(M.map(d => d.id + ' ' + d.mask.length).join('\n'));
