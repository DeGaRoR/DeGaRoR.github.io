// the page's per-frame skin pose with nothing broken: poseSkinGen (the base's loop, frozen in GATE DMGSKIN) against this
// branch's (an idle record passed, as app.js hands it), the Cub's generated wing groups, a flown frame's nodes; plus the
// damage state's hop a frame (app.js dmgNow, inline: what brkGen / brkCage ask before returning)
const ROOT = process.argv[2];
const L = require(ROOT + '/tools/_treecrash_lib.js'), C = L.core(), SB = require(ROOT + '/src/viewer/skin_break.js'), SH = require(ROOT + '/src/viewer/sim_host.js');
const src = require('fs').readFileSync(ROOT + '/tools/_dmg_skin_check.js', 'utf8');
const base = new Function('return ' + src.slice(src.indexOf('function poseSkinGenBase'), src.indexOf('\n}\n', src.indexOf('function poseSkinGenBase')) + 2))();
const out = {};
for (const k of ['cub', 'metal']) {
  const d0 = L.defOf(k), W = C.genWing(d0), FR = C.genRestFrame(d0), rest = W.rest, oNode = FR.to(C.defOrigin(d0)), n = d0.nodes.length;
  const { W: Wd, strip } = L.flatWorld(0); const sim = C.makeSim(d0, Wd); sim.reset(0); C.placeAtAerodrome(sim, Object.assign({}, strip, { elev: 0, spawnElev: 300 }));
  for (let i = 0; i < sim.n; i++) { sim.v[i*3] = 40 * Math.cos(strip.hdg); sim.v[i*3+2] = 40 * Math.sin(strip.hdg); }
  for (let f = 0; f < 60; f++) sim.step(1 / 60);
  const live = C.genNodeBody(sim, new Float32Array(n * 3), oNode);
  const G = Object.values(W.groups), P = G.map(g => g.pos.slice()), IDLE = { R: { active: false }, NF: {}, down: [0, -1, 0], poseGen: SB.poseGen };
  const frameA = () => { for (let j = 0; j < G.length; j++) base(G[j], rest, live, G[j].pos, P[j], 1, null, C.GEN_INFL); };
  const frameB = () => { for (let j = 0; j < G.length; j++) C.poseSkinGen(G[j], rest, live, G[j].pos, P[j], 1, null, IDLE); };
  const frameC = () => { for (let j = 0; j < G.length; j++) C.poseSkinGen(G[j], rest, live, G[j].pos, P[j], 1, null, null); };
  const time = fn => { const t = process.hrtime.bigint(); for (let i = 0; i < 200; i++) fn(); return Number(process.hrtime.bigint() - t) / 1e6 / 200; };
  for (let w = 0; w < 30; w++) { frameA(); frameB(); frameC(); }
  const a = [], b = [], c = [];
  for (let r = 0; r < 15; r++) { a.push(time(frameA)); b.push(time(frameB)); c.push(time(frameC)); }
  const med = x => x.slice().sort((p, q) => p - q)[x.length >> 1];
  const hop = SH.simDmgHop0(); const t0 = process.hrtime.bigint(); for (let i = 0; i < 100000; i++) SH.simDmgHop(sim, hop, 0, 0); const hopUs = Number(process.hrtime.bigint() - t0) / 1e3 / 100000;
  out[k] = { verts: G.reduce((s, g) => s + g.nv, 0), baseMs: med(a), idleMs: med(b), nullMs: med(c), dIdle: med(b) / med(a) - 1, dNull: med(c) / med(a) - 1, hopUs };
  console.log(k, out[k].verts, 'vertices: the base loop', med(a).toFixed(4), 'ms, this branch (idle record)', med(b).toFixed(4), 'ms (' + ((med(b) / med(a) - 1) * 100).toFixed(1) + ' %), (no record)', med(c).toFixed(4), 'ms (' + ((med(c) / med(a) - 1) * 100).toFixed(1) + ' %); the hop a frame', hopUs.toFixed(3), 'us');
}
console.log('POSEJSON ' + JSON.stringify(out));
