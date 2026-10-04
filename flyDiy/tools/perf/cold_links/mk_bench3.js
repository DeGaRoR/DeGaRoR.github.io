// COLD-LINKS bench 3: the pools' mask hoisted out of the candidate loop (exact), grass / veg as selects (exact)
const fs = require('fs');
const S = __dirname;
const b = JSON.parse(fs.readFileSync(S + '/progs_v2.json', 'utf8'));
const rep = (s, a, c) => { if (s.indexOf(a) < 0) throw new Error('missing ' + a.slice(0, 80)); return s.split(a).join(c); };
const cut = (s, from, to) => { const i = s.indexOf(from), j = s.indexOf(to, i); if (i < 0 || j < 0) throw new Error('cut ' + from.slice(0, 60)); return [s.slice(0, i), s.slice(i, j), s.slice(j)]; };
function hoist(s) {
  // the block in sMatPass: from its `if` to `gSOut = o; return true;`
  const [pre, blk, post] = cut(s, 'if ((i == 3 || i == 7) && uSPud.y > 0.0) {', '    gSOut = o; return true;');
  const body = blk.slice(blk.indexOf('float pd = distance('), blk.indexOf('o.c.rgb = mix(o.c.rgb, mix(o.c.rgb * uSPud2.z'));
  let s2 = pre + 'if ((i == 3 || i == 7) && uSPud.y > 0.0) {\n'
    + '      o.c.rgb = mix(o.c.rgb, mix(o.c.rgb * uSPud2.z, vec3(0.022, 0.030, 0.034), gSPoolD), gSPoolM);   // still water, linear\n'
    + '      o.n = mix(o.n, vec4(0.0, 0.0, 0.0, 0.03), gSPoolM * gSPoolD);\n    }\n' + post;
  s2 = rep(s2, 'Smp gSNear, gSFar, gSOut;', 'Smp gSNear, gSFar, gSOut;\n  float gSPoolM = 0.0, gSPoolD = 1.0;');
  const hoisted = '    if (uSPud.y > 0.0 && (w[3] >= 0.004 || w[7] >= 0.004)) {\n      vec3 P = vWPi;\n      ' + body.replace(/\n\s*\/\/[^\n]*/g, '') + '\n      gSPoolM = m; gSPoolD = deep;\n    }\n';
  return rep(s2, '    for (int j = 0; j < uSNCode * 2; j++) {', hoisted + '    for (int j = 0; j < uSNCode * 2; j++) {');
}
const grassSel = s => {
  const [pre, blk, post] = cut(s, '{ float gr = uSGrass[int(layer + 0.5)];', '    if (uSVeg.x > 0.001) {');
  return pre + '{ float gr = uSGrass[int(layer + 0.5)];\n'
    + '      float l = gLuma(o.c.rgb), lm = max(uSLum[int(layer + 0.5)], 1e-4);\n'
    + '      float dark = 1.0 - smoothstep(lm * 0.55, lm * 1.25, l);\n'
    + '      vec3 hue = uSGrassC.rgb / max(gLuma(uSGrassC.rgb), 1e-4);\n'
    + '      o.c.rgb = mix(o.c.rgb, hue * l, gr > 0.001 ? dark * gr : 0.0); }\n' + post;
};
const vegSel = s => {
  const [pre, blk, post] = cut(s, '    if (uSVeg.x > 0.001) {', '    return o;');
  return pre + '    { float veg = clamp((o.c.g - max(o.c.r, o.c.b)) / max(max(o.c.r, max(o.c.g, o.c.b)), 1e-4) * 3.0, 0.0, 1.0);\n'
    + '      o.c.rgb = mix(o.c.rgb, o.c.rgb * vec3(0.96, 1.08, 0.92), uSVeg.x > 0.001 ? veg * uSVeg.x : 0.0); }\n' + post;
};
const ring = b.find(p => p.name === 'island-ring'), outer = b.find(p => p.name === 'island-outer');
const V = [
  ['ring PROD2', ring, s => s], ['ring pools hoisted', ring, hoist], ['ring hoist+grass sel', ring, s => grassSel(hoist(s))],
  ['ring hoist+veg sel', ring, s => vegSel(hoist(s))], ['ring hoist+grass+veg sel', ring, s => vegSel(grassSel(hoist(s)))],
  ['outer PROD2', outer, s => s], ['outer pools hoisted', outer, hoist],
];
const out = V.map(([n, p, f]) => ({ name: n, vs: p.vs, fs: f(p.fs) }));
fs.writeFileSync(S + '/bench3.json', JSON.stringify(out));
fs.writeFileSync(S + '/ring_hoist.glsl', out[1].fs);
console.log(out.map(o => o.name + ' ' + o.fs.length).join('\n'));
