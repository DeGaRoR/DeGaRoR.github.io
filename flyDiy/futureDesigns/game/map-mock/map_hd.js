// HD bakes of the island map for the user to repaint (not the game's media): MPP from argv, a CLEAN variant without the
// grid, plots, runways and labels. Writes to the scratchpad only.
const fs = require('fs'), path = require('path'), Module = require('module');
const TOOLS = 'D:/Dev/DeGaRoR.github.io/.claude/worktrees/charming-lichterman-3a3f8b/flyDiy/tools';
const OUT = path.join(__dirname, 'map_hd');
const mpp = +process.argv[2] || 6, clean = process.argv.includes('--clean');
let src = fs.readFileSync(path.join(TOOLS, 'map_bake.js'), 'utf8');
src = src.replace('const MPP = 12;', 'const MPP = ' + mpp + ';');
if (process.argv.includes('--bold')) {
  const rep = (re, to) => { if (!re.test(src)) throw new Error('bold anchor ' + re); src = src.replace(re, to); };
  rep(/const LAND = \[[\s\S]*?\]\];/, 'const LAND = [[96,160,72],[106,168,74],[118,174,76],[134,178,78],[152,180,82],[170,178,90],[182,170,104],[178,156,112],[170,150,130],[190,182,170],[228,226,222],[250,250,252]];');
  rep(/const FOREST = \[[^\]]*\];/, 'const FOREST = [0.62, 0.80, 0.55];');
  rep(/deep: \[[^\]]*\], mid: \[[^\]]*\], shallow: \[[^\]]*\], lake: \[[^\]]*\], lane: \[[^\]]*\]/, 'deep: [22, 92, 150], mid: [38, 128, 186], shallow: [86, 182, 214], lake: [52, 150, 214], lane: [150, 214, 236]');
  rep(/paved: \[[^\]]*\], gravel: \[[^\]]*\], track: \[[^\]]*\]/, 'paved: [70, 60, 55], gravel: [150, 95, 55], track: [175, 120, 70]');
}
if (clean) {
  const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); if (i < 0 || j < 0) throw new Error('anchor ' + a); src = src.slice(0, i) + src.slice(j); };
  cut('  // 3. the grid:', '  // 4. the roads');
  cut('  // 5. the plots:', '  const png = encodePNG(');
  src = src.replace('  const png = encodePNG(', '  const aeros = [], plots = [];\n  const png = encodePNG(');
}
src = src.replace(/if \(require\.main === module\) \{[\s\S]*$/, '');
const m = new Module(path.join(TOOLS, 'map_bake_hd.js'), null);
m.filename = path.join(TOOLS, 'map_bake_hd.js'); m.paths = Module._nodeModulePaths(TOOLS);
m._compile(src, m.filename);
const t0 = Date.now(); const r = m.exports.bake();
fs.mkdirSync(OUT, { recursive: true });
const name = 'jolene_map_' + mpp + 'm' + (clean ? '_clean' : '') + (process.argv.includes('--bold') ? '_bold' : '') + '.png';
fs.writeFileSync(path.join(OUT, name), r.png);
fs.writeFileSync(path.join(OUT, name.replace('.png', '.json')), JSON.stringify({ w: r.w, h: r.h, mpp, x0: r.proj.x0, z0: r.proj.z0, x1: r.proj.x1, z1: r.proj.z1, rule: r.proj.rule }, null, 1));
console.log(name, r.w + 'x' + r.h, (r.png.length / 1048576).toFixed(1) + ' MB', ((Date.now() - t0) / 1000).toFixed(1) + ' s');
