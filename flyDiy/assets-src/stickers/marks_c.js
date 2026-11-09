// v3 marks 9-12 (moose, lighthouse, panorama, Alaska)
const K = require('./core_v3.js');
const { I, H, r2, P, C, G, poly, halo, swoosh, swooshC, ctx, CLIP, peak, tree, ring, star, cubMark, beaver, sliver } = K;
const M = [];

// 9 BULL MOOSE: head in profile with the broad palm; the neck runs down into a mountain swoosh (drawn facing right, then mirrored)
{
  const cx = ctx('m9'); let m = '';
  const body = 'M6,190 C30,184 46,170 54,152 L72,112 L86,132 L104,96 L118,118 C126,108 134,100 142,96 C150,92 156,90 160,90 ' +
    'C170,92 186,104 198,116 C206,122 212,130 210,140 C209,146 204,148 200,146 C196,149 191,149 188,146 C180,142 170,136 162,134 ' +
    'C158,134 156,137 155,141 L154,158 C153.6,162 149,162 148.6,158 L147,142 C144,150 142,164 144,178 C120,190 70,196 40,196 C26,196 14,194 6,190 Z';
  m += P(body);
  m += P('M158,93 C152,88 147,84 142,80 C150,80 157,84 164,90 Z');                      // the ear, laid back
  // LIVERY-STICKERS (9 Nov, the user: "the antlers read as a crown when small. Make broad palms"): one broad solid blade
  // swept back, its rim with four short points (6-7 deep; there were seven, 12-14 deep), a notch, and a smaller brow palm forward
  m += P('M162,92 C158,84 150,80 140,78 C126,76 112,72 102,66 C94,61 89,55 90,49 C94,46 98,44 101,40 L109,45 ' +
    'L117,36 L125,42 L134,35 L142,42 L150,37 C153,40 157,41 159,42 C160,47 160,53 160,58 C163,58 166,60 168,62 ' +
    'L174,54 L178,59 L185,55 L184,62 L190,62 C186,70 178,78 172,84 C168,88 166,90 164,92 Z');  // the palm, the brow palm
  m += peak(cx, [72, 112], [50, 160], [92, 144], { f: 0.32, n: 3, t: 3.6, amp: 4 });
  m += peak(cx, [104, 96], [80, 146], [126, 130], { f: 0.3, n: 3, t: 4, amp: 4.6 });
  m += `<ellipse cx="177" cy="105" rx="3.2" ry="2.6" fill="${H}"/>`;
  m += swoosh([209, 141.6], [192, 144.6], -1.2, 3.2, 0.5, H);                            // mouth
  m += swooshC([136, 104], [148, 120], [150, 150], [146, 180], 5, 0.5, H);              // the neck's line, on down into the swell
  m += swoosh([20, 188], [128, 182], 5, 5, 0.5, H) + swoosh([48, 172], [124, 166], 4, 4.4, 0.5, H);
  M.push({ id: 'bull-moose', name: 'Bull moose', theme: 'moose, mountains', w: 240, h: 202, defs: cx.defs.join(''), mask: G('translate(240,0) scale(-1,1)', m),
    idea: 'A bull moose head in profile, broad palmate antlers raked back, the bell under the jaw; the neck runs on into two snow peaks and a swoosh.' });
}

// 10 LIGHTHOUSE: on a rocky islet with spruce, the sun behind, beams cut through it, curling waves
{
  const cx = ctx('m10'); let m = '';
  m += C(100, 94, 64);
  // beams of light cut through the sun
  m += P(poly([[92, 55], [20, 36], [24, 58]]), H) + P(poly([[108, 55], [180, 36], [176, 58]]), H);
  let tw = '';
  tw += P('M83,198 L89.6,76 H110.4 L117,198 Z');                       // tower
  tw += P('M82,69 H118 V76 H82 Z');                                      // gallery
  tw += P('M89,46 H111 V69 H89 Z');                                      // lantern room
  tw += P('M86.6,47 C88,40 93,35 100,33.4 C107,35 112,40 113.4,47 Z') + P('M98.4,26 H101.6 V35 H98.4 Z');   // dome, vent
  m += halo(tw, 7) + tw;
  m += P('M93,50 H98 V65 H93 Z', H) + P('M102,50 H107 V65 H102 Z', H);  // lantern windows
  m += P('M86.6,118 L113.4,118 L114.2,132 L85.8,132 Z', H) + P('M84.6,160 L115.4,160 L116.2,174 L83.8,174 Z', H);   // the bands
  m += P('M95,198 V188 C95,184 105,184 105,188 V198 Z', H);             // door
  // the islet and its spruce
  m += P('M26,214 C42,200 62,194 80,196 L120,196 C136,192 156,196 176,212 C150,218 56,220 26,214 Z');
  m += tree(140, 200, 30, 14, 4) + tree(154, 203, 24, 12, 3) + tree(128, 199, 20, 10, 3) + tree(56, 201, 18, 10, 3);
  // waves: a curling crest at each side, swooshes between
  m += P('M2,226 C12,214 22,204 36,203 C48,202 56,210 53,219 C50,212 42,210 38,214 C34,218 38,224 46,226 Z');
  m += P('M198,228 C190,218 182,210 170,210 C160,210 154,217 157,224 C160,218 166,217 169,221 C172,225 168,229 162,230 Z');
  m += swoosh([40, 230], [176, 226], 3, 7, 0.5) + swoosh([20, 244], [110, 241], 2, 5, 0.5) + swoosh([100, 241], [190, 238], 2, 4.6, 0.5);
  M.push({ id: 'lighthouse', name: 'Lighthouse', theme: 'the coast, the sea, forests', w: 200, h: 250, defs: cx.defs.join(''), mask: m,
    idea: 'A lighthouse on a rocky islet with spruce, the sun behind it; its beams are cut through the sun, and curling waves run below.' });
}

// 11 GLASSY PANORAMA: a range of snow peaks, spruce islands, a floatplane on the water, reflection lines
{
  const cx = ctx('m11'); let m = '';
  const pk = [[[56, 40], [4, 98], [104, 98]], [[112, 14], [56, 98], [170, 98]], [[166, 46], [128, 98], [204, 98]], [[226, 24], [172, 98], [282, 98]], [[284, 54], [246, 98], [318, 98]]];
  let mts = ''; pk.forEach(([A, L, R], i) => { mts += peak(cx, A, L, R, { f: 0.3, n: i % 2 ? 4 : 3, t: 3.8, amp: 4.4 }); });
  m += mts + swoosh([2, 100], [318, 96], 2, 8, 0.3);
  // spruce islands
  m += swoosh([4, 116], [74, 114], 5, 8, 1) + tree(18, 112, 26, 12, 4) + tree(32, 112, 34, 15, 4) + tree(46, 113, 24, 11, 3) + tree(60, 114, 18, 9, 3);
  m += swoosh([252, 116], [316, 114], 5, 8, 1) + tree(268, 113, 22, 11, 3) + tree(282, 112, 30, 14, 4) + tree(298, 113, 24, 11, 3);
  // the floatplane on the water, a gap where it stands in front of the range
  const s = 0.52, tf = `translate(${r2(160 - 110 * s)},${r2(122 - 111.4 * s)}) scale(${s})`;
  m += halo(G(tf, beaver({ lw: 6, detail: false })), r2(7 / s)) + G(tf, beaver({ lw: 6 }).replace(/<path d="M60,99.4[^>]*>/, ''));
  // reflection lines
  m += swoosh([104, 130], [222, 130], 0, 5.4, 0.5) + swoosh([122, 139], [204, 139], 0, 4.6, 0.5) + swoosh([140, 147], [186, 147], 0, 3.8, 0.5);
  m += swoosh([10, 126], [70, 125], 0, 4.4, 0.5) + swoosh([24, 134], [56, 134], 0, 3.6, 0.5) + swoosh([254, 126], [312, 125], 0, 4.4, 0.5) + swoosh([268, 134], [300, 134], 0, 3.6, 0.5);
  M.push({ id: 'glassy-panorama', name: 'Glassy panorama', theme: 'floatplanes, lakes, mountains, forests', w: 320, h: 152, defs: cx.defs.join(''), mask: m,
    idea: 'A long range of snow peaks over a still lake: spruce islands either side, a radial floatplane resting on the water, its reflection in swooshes.' });
}

// 12 ALASKA: the map silhouette, the Aleutians trailing off as swooshes, a climbing plane and its trail cut through it
// LIVERY-STICKERS (9 Nov): THE OUTLINE IS NATURAL EARTH'S (1:50m, public domain), on the Alaska Albers conic, simplified for
// a sticker by alaska_ne.py (the panhandle's islands closed into it, the fjords taken off) - it was drawn from memory
{
  let m = '';
  const A = require('./alaska_ne.json'), pl = A.places;
  m += P(poly(A.body));
  for (const isl of A.islands) m += P(poly(isl));
  // the chain: tapering swooshes laid along the real islands, east to west
  const ch = A.chain;
  // (five swooshes between six stations interpolated along the centroids' polyline, the gaps a fifth of each step)
  const along = t => { const L = []; let T = 0; for (let i = 1; i < ch.length; i++) { const d = Math.hypot(ch[i][0] - ch[i - 1][0], ch[i][1] - ch[i - 1][1]); L.push(d); T += d; }
    let s = t * T; for (let i = 1; i < ch.length; i++) { if (s <= L[i - 1]) { const u = s / L[i - 1]; return [ch[i - 1][0] + (ch[i][0] - ch[i - 1][0]) * u, ch[i - 1][1] + (ch[i][1] - ch[i - 1][1]) * u]; } s -= L[i - 1]; } return ch[ch.length - 1]; };
  [5, 4.6, 4.2, 3.8, 3.4].forEach((w, i) => { m += swoosh(along(i / 5 + 0.02), along((i + 1) / 5 - 0.04), -1, w, 0.5); });
  // the plane, climbing out over the interior, and its trail up from the Alaska Range: holes
  const tf = `translate(${r2(pl.fairbanks[0] - 18)},${r2(pl.fairbanks[1] - 14)}) rotate(-12) scale(0.4) translate(-70,-14)`;
  m += G(tf, cubMark({ F: H, detail: false, lw: 6, tyre: 12 }));
  m += swooshC([pl.mcgrath[0] - 4, pl.mcgrath[1] + 16], [pl.mcgrath[0] - 16, pl.mcgrath[1] + 2], [pl.mcgrath[0] - 16, pl.fairbanks[1] + 6], [pl.fairbanks[0] - 43, pl.fairbanks[1] - 4], 5.6, 0.5, H);
  M.push({ id: 'alaska', name: 'Alaska', theme: 'flying, the map', w: A.w, h: A.h, defs: '', mask: m,
    idea: 'The map of Alaska, the Aleutians trailing off as swooshes; a bush plane and its climbing trail are cut through it.' });
}
module.exports = M;
if (require.main === module) console.log(M.map(d => d.id + ' ' + d.mask.length).join('\n'));
