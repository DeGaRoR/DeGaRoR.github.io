#!/usr/bin/env node
// tank_fit_probe.js - THE TANK VERDICT, SWEPT AND TIMED, ON A BUILD AS THE GAME LOADS IT (TANK-FIT, 2026-11-03)
//
// The build goes through the page's own load door (tools/_load_build.js: the join, the crew with its characters,
// the energy layer's own fit), then, in the page context, each tank (or a candidate) is moved along one slider -
// fore/aft, up/down, a size - and asked CAGE_ENERGY.fitOf at every step, under the drawn clearance (TANK-FIT) and
// under the legacy four (window.TANK_FIT_LEGACY), side by side. Also timed: a full relayout (median of 5), a drag
// tick (relayout per tick, the legacy way, and the throttled drag layout), and fitOf.
//
//   node tools/tank_fit_probe.js <build.json | --key <archetype>> [--sweep '<json>'] [--json out.json] [--quiet]
//     --sweep  a list of sweeps: [{"v": 1, "key": "lv", "lo": 0, "hi": 1, "step": 0.03}, ...]
//              v: the vessel's index in the build's list, or a vessel object (a candidate); key: along | lv | rot |
//              L | W | H (a size: the vessel's dims, or the drawn ones when it has none); keep: true on an along
//              sweep moves the tank as the editor's fore/aft slider does (its height kept: CAGE_ENERGY.lvKeepingHeight)
//              default: every body tank's lv over its band and along over its hand's range
//   -> per step: the value, the tank's centre height, both verdicts and their reasons; then the timings
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const pos = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
const KEY = opt('key', null), FILE = KEY ? null : pos[0];
if (!FILE && !KEY) { console.error('usage: node tools/tank_fit_probe.js <build.json | --key <archetype>> [--sweep JSON] [--json out]'); process.exit(2); }
const T = __dirname;
const LB = require(path.join(T, '_load_build.js'));

const probe = `
const E = window.CAGE_ENERGY, L = E.last();
// THE PAGE'S FRAME: _load_build hangs the layers under two identity groups for the join (as the page does), and the
// layer's ctx.scene is then no longer their parent - the crew and the engine would not be found. Point it back.
{ let host = null; L.ctx.scene.traverse(o => { if (!host && o.children && o.children.some(c => /^cageLayer:/.test(c.name || ''))) host = o; });
  if (host) L.ctx.scene = host; }
E.relayout();
const SW = ${opt('sweep', 'null')};
const out = { lines: [], rows: [] };
const now = () => performance.now();
const med = a => a.slice().sort((x, y) => x - y)[a.length >> 1];
const base = E.EN.vessels.map(v => JSON.parse(JSON.stringify(v)));
const res0 = E.results();
const sweeps = SW || [].concat(...base.map((v, i) => {
  const r = res0[i], b = E.bays().find(x => x.key === v.bay);
  if (!r || r.on !== 'body' || !b) return [];
  const lv = b.lv || [0, 1];
  return [{ v: i, key: 'lv', lo: lv[0], hi: lv[1], step: 0.05 },
          { v: i, key: 'along', lo: b.hx0 != null ? b.hx0 : b.x0, hi: b.hx1 != null ? b.hx1 : b.x1, step: 0.03 }];
}));
const ask = (cand, legacy) => { window.TANK_FIT_LEGACY = !!legacy; try { return E.fitOf(cand); } finally { window.TANK_FIT_LEGACY = false; } };
for (const sw of sweeps) {
  const v0 = typeof sw.v === 'number' ? base[sw.v] : sw.v;
  const r0 = typeof sw.v === 'number' ? res0[sw.v] : null;
  out.lines.push('== ' + (typeof sw.v === 'number' ? 'tank ' + sw.v : 'candidate') + ' ' + v0.bay + ' ' + sw.key + ' ' + sw.lo.toFixed(2) + '..' + sw.hi.toFixed(2));
  const tN = [], tL = [];
  for (let x = sw.lo; x <= sw.hi + 1e-9; x += sw.step) {
    const c = JSON.parse(JSON.stringify(v0));
    if (['L', 'W', 'H'].includes(sw.key)) { const d = c.dims || (r0 && r0.dims ? { L: r0.dims.L, W: r0.dims.W, H: r0.dims.H } : { L: 0.4, W: 0.4, H: 0.25 }); c.dims = { L: d.L, W: d.W, H: d.H }; c.dims[sw.key] = +x.toFixed(4); }
    else c[sw.key] = +x.toFixed(4);
    // keep: the editor's fore/aft hand (TANK-FIT) - the level that keeps the tank's height, as the slider writes it
    if (sw.keep && sw.key === 'along' && typeof sw.v === 'number' && E.lvKeepingHeight) { const l = E.lvKeepingHeight(sw.v, +x.toFixed(4)); if (l != null) c.lv = l; }
    let t = now(); const fn = ask(c, false); tN.push(now() - t);
    t = now(); const fl = ask(c, true); tL.push(now() - t);
    const row = { key: sw.key, x: +x.toFixed(3), y: fn && fn.c ? +fn.c[1].toFixed(3) : null, ok: !!(fn && fn.ok), why: fn ? fn.why : ['no answer'],
                  legacyOk: !!(fl && fl.ok), legacyWhy: fl ? fl.why : ['no answer'], clear: fn && fn.clear != null ? +(fn.clear * 1000).toFixed(1) : null, clearTo: fn && fn.clearTo };
    out.rows.push(Object.assign({ sweep: out.lines.length }, row));
    out.lines.push('  ' + sw.key + '=' + x.toFixed(3) + (row.y != null ? ' y=' + row.y.toFixed(3) : '') + '  NOW ' + (row.ok ? 'fits' + (row.clear != null ? ' (' + row.clear.toFixed(0) + ' mm to ' + (row.clearTo || '-') + ')' : '') : 'RED ' + row.why.join('; ')) +
                   '  |  LEGACY ' + (row.legacyOk ? 'fits' : 'RED ' + row.legacyWhy.join('; ')));
  }
  out.lines.push('  fitOf ms median: now ' + med(tN).toFixed(1) + ', legacy ' + med(tL).toFixed(1));
}
// THE TIMINGS: a full relayout (the release), both ways; a drag tick both ways
const timeIt = (legacy) => { window.TANK_FIT_LEGACY = !!legacy; const a = [];
  for (let k = 0; k < 5; k++) { const t = now(); E.relayout(); a.push(now() - t); }
  const ms = E.last().ms || {}; window.TANK_FIT_LEGACY = false; return { med: med(a), parts: ms }; };
const tl = timeIt(true), tn = timeIt(false);
out.lines.push('relayout (release) ms: legacy ' + tl.med.toFixed(1) + ' ' + JSON.stringify(tl.parts, (k, x) => typeof x === 'number' ? +x.toFixed(1) : x) +
               ' | now ' + tn.med.toFixed(1) + ' ' + JSON.stringify(tn.parts, (k, x) => typeof x === 'number' ? +x.toFixed(1) : x));
const vi = E.EN.vessels.findIndex((v, i) => E.results()[i] && E.results()[i].on === 'body');
if (vi >= 0) {
  const v = E.EN.vessels[vi], a0 = v.along;
  const tick = (legacy, fn) => { window.TANK_FIT_LEGACY = !!legacy; const a = [];
    for (let k = 0; k < 20; k++) { v.along = a0 + 0.01 * (k - 10); const t = now(); fn(); a.push(now() - t); }
    v.along = a0; E.relayout(); window.TANK_FIT_LEGACY = false; return a; };
  const dl = tick(true, () => E.relayout()), dn = tick(false, () => E.relayout());
  const dd = E.dragLayout ? tick(false, () => E.dragLayout(true, vi)) : null;
  out.lines.push('drag tick ms (tank ' + vi + ', 20 ticks of 1 cm): legacy relayout median ' + med(dl).toFixed(1) + ' max ' + Math.max(...dl).toFixed(1) +
                 ' | now relayout median ' + med(dn).toFixed(1) + ' max ' + Math.max(...dn).toFixed(1) +
                 (dd ? ' | now drag layout median ' + med(dd).toFixed(1) + ' max ' + Math.max(...dd).toFixed(1) : ''));
  out.timing = { relayoutLegacy: tl.med, relayoutNow: tn.med, dragLegacy: med(dl), dragNow: med(dn), dragLayout: dd ? med(dd) : null, dragLayoutMax: dd ? Math.max(...dd) : null };
}
out.verdicts = E.results().map(r => ({ bay: r.v.bay, ok: !!r.ok, why: r.why, cap: r.v.capacity, along: r.v.along, lv: r.v.lv, dims: r.v.dims }));
out.lines.push('the build\\'s own tanks now: ' + out.verdicts.map(q => q.bay + ' ' + Math.round(q.cap) + ' L ' + (q.ok ? 'fits' : 'RED ' + q.why.join('; '))).join(' | '));
return JSON.stringify(out);
`;
const pf = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tankprobe_')), 'probe.js');
fs.writeFileSync(pf, probe);
process.env.FLYDIY_JOIN_PROBE = pf;
process.env.FLYDIY_JOIN_NOCACHE = '1';
let raw;
if (KEY) {
  const BJ = require(path.join(T, '_bake_joined.js'));
  const { D } = BJ.loadPanel();
  const a = D.ARCHETYPES.find(x => x.key === KEY);
  if (!a) { console.error('no archetype ' + KEY); process.exit(2); }
  const s0 = D.designBake(a.sel, a.over);
  raw = { v: s0.v, birth: 1, spec: s0 };
} else raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const r = LB.gameSpecFull(raw);
let P;
try { P = JSON.parse(r.probe); } catch (e) { console.error('the probe failed: ' + String(r.probe).slice(0, 3000)); process.exit(1); }
if (!argv.includes('--quiet')) for (const l of P.lines) console.log(l);
else console.log(P.lines.filter(l => !/^  [a-zA-Z]+=/.test(l)).join('\n'));
if (opt('json', null)) fs.writeFileSync(opt('json'), JSON.stringify(P, null, 1));
