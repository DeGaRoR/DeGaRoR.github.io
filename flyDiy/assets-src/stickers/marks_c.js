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
  m += P('M162,92 C160,86 157,82 152,79 C140,77 120,76 106,72 C100,70 96,66 94,60 L102,61 L98,50 L108,57 L108,44 L117,53 L120,39 L127,50 L133,36 L139,48 L147,35 L150,48 L158,40 L160,52 ' +
    'C164,56 166,60 168,64 L176,54 L178,62 L188,58 L182,70 C177,76 171,82 168,88 C166,90 165,91 164,92 Z');  // the palm, tines raked back, brow palm forward
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
{
  let m = '';
  const k = 10.6, X = lon => r2((lon + 180) * 0.47 * k + 4), Y = lat => r2((72 - lat) * k + 4);
  const coast = [[-156.8, 71.4], [-154.5, 70.9], [-152, 70.8], [-150, 70.45], [-148.3, 70.3], [-145.5, 70.1], [-143, 70.1], [-141, 69.65], [-141, 60.3],
    [-139.2, 60.35], [-138.6, 59.8], [-137.4, 59.2], [-135.5, 59.8], [-134.6, 59.4], [-133.6, 58.5], [-132.6, 57.6], [-131.6, 56.8], [-130.0, 56.0], [-130.0, 55.3],
    [-131.0, 54.75], [-132.6, 54.7], [-133.6, 55.3], [-134.6, 56.0], [-135.3, 56.8], [-136, 57.3], [-136.6, 58.2], [-138, 58.8], [-139.7, 59.55], [-141.4, 59.9],
    [-143.5, 60.05], [-145.5, 60.4], [-146.6, 60.6], [-147.7, 60.85], [-148.6, 60.4], [-149.6, 59.8], [-150.6, 59.4], [-151.8, 59.2], [-151.6, 59.7], [-151.3, 60.5],
    [-150.4, 61.0], [-149.9, 61.3], [-150.9, 61.2], [-152.0, 60.6], [-152.8, 60.0], [-153.6, 59.4], [-154.3, 58.8], [-155.4, 58.0], [-156.6, 57.2], [-158.0, 56.5],
    [-159.4, 55.8], [-161.0, 55.3], [-162.6, 54.9], [-164.0, 54.6], [-163.0, 55.2], [-161.8, 55.8], [-160.2, 56.3], [-158.8, 57.0], [-157.6, 57.6], [-157.0, 58.4],
    [-158.0, 58.7], [-159.4, 58.8], [-161.5, 58.6], [-162.0, 59.4], [-162.6, 59.9], [-163.6, 60.0], [-164.8, 60.6], [-165.2, 61.2], [-165.6, 61.8], [-165.2, 62.4],
    [-164.6, 63.0], [-163.4, 63.1], [-161.6, 63.4], [-160.8, 63.8], [-161.3, 64.4], [-162.6, 64.5], [-164.0, 64.5], [-165.4, 64.5], [-166.4, 64.7], [-167.2, 65.2],
    [-168.1, 65.6], [-167.0, 66.0], [-166.0, 66.3], [-164.3, 66.6], [-162.0, 66.1], [-161.2, 66.5], [-162.0, 67.0], [-163.6, 67.6], [-164.8, 68.0], [-166.8, 68.35],
    [-166.2, 68.9], [-164.6, 69.0], [-163.2, 69.6], [-162.0, 70.3], [-160.0, 70.7], [-158.4, 70.95]];
  m += P(poly(coast.map(([lo, la]) => [X(lo), Y(la)])));
  m += `<ellipse cx="${X(-153.4)}" cy="${Y(57.4)}" rx="10" ry="5.4" transform="rotate(-38 ${X(-153.4)} ${Y(57.4)})" fill="${I}"/>`;   // Kodiak
  for (const [a, b, w] of [[[-165.0, 54.4], [-167.0, 53.6], 5], [[-167.6, 53.4], [-169.6, 52.8], 4.6], [[-170.4, 52.6], [-172.4, 52.2], 4.2], [[-173.2, 52.1], [-175.4, 51.9], 3.8], [[-176.2, 51.8], [-178.4, 51.7], 3.4]])
    m += swoosh([X(a[0]), Y(a[1])], [X(b[0]), Y(b[1])], -1, w, 0.5);
  // the plane, climbing out, and its trail: holes
  const tf = `translate(${X(-151.5)},${Y(66.2)}) rotate(-9) scale(0.5) translate(-70,-14)`;
  m += G(tf, cubMark({ F: H, detail: false, lw: 6, tyre: 12 }));
  m += swooshC([X(-155.4), Y(61.8)], [X(-157.4), Y(63.4)], [X(-158.8), Y(65)], [X(-158.8), Y(66.2)], 6.4, 0.5, H);
  M.push({ id: 'alaska', name: 'Alaska', theme: 'flying, the map', w: 262, h: 228, defs: '', mask: m,
    idea: 'The map of Alaska, the Aleutians trailing off as swooshes; a bush plane and its climbing trail are cut through it.' });
}
module.exports = M;
if (require.main === module) console.log(M.map(d => d.id + ' ' + d.mask.length).join('\n'));
