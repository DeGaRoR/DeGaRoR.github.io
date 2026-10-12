#!/usr/bin/env node
// GATE STOL — THE STOL WING (G2820, 2026-10-12).
//
//   node tools/_stol_check.js              -> "GATE STOL: PASS|FAIL"
//   node tools/_stol_check.js --selftest   -> negative verification (each
//                                             section must catch its break)
//   node tools/_stol_check.js --bench      -> the published-figures table only
//
// The user (2026-10-10): "it's a bush flying game, and there were plans for
// STOL wing features back in the day ... Could we resurrect that?" — slats
// ("the mini wing on the leading edge"), endplates ("the large flat surfaces
// at the wingtips"), fences / vortex generators ("the longitudinal ribs").
// 60_gen_spec GEN_SLATS / GEN_STOL hold the numbers and their sources; this
// gate holds what can be held about them in node:
//
//   1 OFF IS THE BITS   every card (the JOINED bake, 27 of them) rebuilds,
//                       flies 4 s and draws exactly as master f353a0f8 did
//                       before the STOL wing existed (fixtures/
//                       stol_baseline.json.gz), and a record that says
//                       "nothing" (null, {}, every device 0) is the absent
//                       key - the resolved spec, the strips and the
//                       certificate's fingerprint do not see it.
//   2 THE SPEC          the record normalises and clamps; the two new tips
//                       are APPENDED (the cage saves a tip as an index);
//                       the cage rows -> the record; the machine-shop flag.
//   3 THE PHYSICS       each device on the Savannah-alike, measured in the
//                       tunnel the AP is tuned from: a stall-angle device
//                       lowers the MEASURED stall and moves the stall
//                       attitude up by about its own dAs; the fixed slot
//                       pays cruise drag, the automatic slat only its seam
//                       until it runs out; fences and endplates price their
//                       area; drooped ailerons and Fowler area growth add
//                       lift on the flap lever only; the strips' and the
//                       analytic CLmax agree.
//   4 THE DRAWING       the devices are drawn where they fly: the slat
//                       ahead of the leading edge over its own span, the
//                       VG row on the upper skin, the fences at the strips'
//                       stations, the endplate beyond the tip and standing
//                       above and below it, the drooped tip below the
//                       plane, the drooping ailerons on the flap lever.
//   5 THE BENCH         Savannah, Super Cub, Highlander against the figures
//                       their makers publish (Vs, take-off roll, landing
//                       roll): the devices move every one TOWARD the sheet
//                       and none past it by more than the bound. Printed in
//                       full; the residual gaps are the model's known ones
//                       (HANDOVER perf study: the taildraggers' unstick,
//                       the generous sheets) and are reported, not gated.
'use strict';
const PHY = {};
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');
const T = __dirname;
const C = require(path.join(T, 'flight_core.js'));
const { ballast } = require(path.join(T, '_perf_probe.js'));
const SELF = process.argv.includes('--selftest');
const BENCH_ONLY = process.argv.includes('--bench');
let fails = 0, checks = 0;
const failed = [];
const ok = (cond, msg) => {
  checks++;
  if (!cond) { fails++; failed.push(msg); console.log('  FAIL ' + msg); } else console.log('  ok   ' + msg);
  return !!cond;
};
const h = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);
const rep = (k, v) => typeof v === 'function' ? undefined : v;
const clone = o => JSON.parse(JSON.stringify(o));
const FIX = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(T, 'fixtures', 'stol_baseline.json.gz'))));
const CARDS = FIX.cards;
const RHO = C.RHO;

// ---- the instruments ------------------------------------------------------
function fpDef(def) { return h(JSON.stringify({ n: def.nodes, b: def.beams, s: def.strips, p: def.params }, rep)); }
function fpFly(def) {
  const sim = C.makeSim(def, null); sim.reset(0); sim.ctl.thr = 0.7;
  for (let i = 0; i < 240; i++) {
    if (i === 60) sim.ctl.flap = 1;
    if (i === 120) { sim.ctl.da = 0.3; sim.ctl.de = -0.2; }
    sim.step(1 / 60);
  }
  return h(Array.from(sim.p).join(','));
}
function fpDraw(def) {
  const w = C.genWing(def), parts = [];
  for (const [g, m] of Object.entries(w.groups))
    parts.push(g, Array.from(m.pos).join(','), Array.from(m.idx).join(','), Array.from(m.ww).join(','));
  parts.push(JSON.stringify(w.moving));
  return h(parts.join('|'));
}
// free-air CL sweep (64_gen_build genClMax's, to 36 deg): CLmax, the stall
// attitude, and the drag at a cruise attitude
function tunnel(def, flap) {
  const sim = C.makeSim(def, null); sim.reset(0); sim.ctl.flap = flap || 0;
  let Sw = 0; for (const st of def.strips) if (st.kind === 'wing') Sw += st.area;
  const V = 30, W = sim.totalM * 9.81;
  let CLmax = 0, aSt = 0;
  const at = a => { const al = a * Math.PI / 180, r = sim.probe([-V * Math.cos(al), -V * Math.sin(al), 0]);
    return { L: -r.Fx * Math.sin(al) + r.Fy * Math.cos(al), D: r.Fx * Math.cos(al) + r.Fy * Math.sin(al) }; };
  for (let a = -2; a <= 36; a += 0.25) {
    const CL = at(a).L / (0.5 * RHO * V * V * Sw);
    if (CL > CLmax) { CLmax = CL; aSt = a; }
  }
  const q = 0.5 * RHO * V * V * Sw, CL8 = at(8).L / q, CL4 = at(4).L / q, CL12 = at(12).L / q;
  return { CLmax, aSt, Sw, W, Vs: Math.sqrt(2 * W / (RHO * Sw * CLmax)), D2: at(2).D, D12: at(12).D, CL8, CL4, CL12 };
}
const build = (key, mod) => { const s = clone(CARDS[key].spec); if (mod) mod(s); return C.buildGen(s); };
const W0 = s => s.wings[0];

// =========================================================================
if (!BENCH_ONLY) {
console.log('1. OFF IS THE BITS (' + Object.keys(CARDS).length + ' cards against ' + 'fixtures/stol_baseline.json.gz)');
{
  const bad = [];
  for (const k of Object.keys(CARDS)) {
    const def = C.buildGen(clone(CARDS[k].spec));
    const d = fpDef(def), f = fpFly(def), w = fpDraw(def);
    if (d !== CARDS[k].def || f !== CARDS[k].fly || w !== CARDS[k].draw)
      bad.push(k + (d !== CARDS[k].def ? ' def' : '') + (f !== CARDS[k].fly ? ' fly' : '') + (w !== CARDS[k].draw ? ' draw' : ''));
  }
  ok(!bad.length, 'every card builds, flies 4 s and draws to the bit it did before G2820' + (bad.length ? ': ' + bad.join(', ') : ''));
  // "nothing" is the absent key, in every spelling a save or the join can write
  const ref = CARDS.savannah;
  for (const [lbl, v] of [['null', null], ['{}', {}], ['every device 0', { slat: 'none', vg: 0, fences: 0, cuff: 0, droop: 0, grow: 0 }]]) {
    const def = build('savannah', s => { W0(s).stol = clone(v); });
    ok(fpDef(def) === ref.def && fpDraw(def) === ref.draw && !('stol' in def.spec.wings[0]),
       'a stol record of ' + lbl + ' is the absent key (strips, params, drawing; gone from the resolved spec)');
  }
  // the certificate's fingerprint (bench.js) and the procurement's: null hashes as absent
  const vm = require('vm');
  const m = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(T, '..', 'src', 'viewer', 'bench.js'), 'utf8'),
    { module: m, exports: m.exports, console, Math, JSON, parseFloat, isFinite, Number, String, Array, Object,
      Uint8ClampedArray, Infinity, setTimeout, clearTimeout, setInterval, clearInterval, performance: { now: () => 0 }, Date, Symbol });
  const BE = m.exports;
  const sp = clone(ref.spec), spN = clone(ref.spec); spN.wings[0].stol = null;
  const spOn = clone(ref.spec); spOn.wings[0].stol = { slat: 'slot', slatSpan: 1 };
  if (BE.benchFingerprint) {
    ok(BE.benchFingerprint(sp) === BE.benchFingerprint(spN), 'the certificate fingerprint: stol null === absent (no certificate withdrawn)');
    ok(BE.benchFingerprint(sp) !== BE.benchFingerprint(spOn), '...and a slat IS a different aeroplane');
  } else ok(false, 'bench.js exports benchFingerprint');
  ok(C.procureFp(sp) === C.procureFp(spN) && C.procureFp(sp) !== C.procureFp(spOn), 'the procurement fingerprint: the same rule');
  // through the garage's merge: a slat put on and taken back off is gone
  const on = C.genSpecMerge(clone(ref.spec), { wings: [{ stol: { slat: 'slot' } }] });
  const off = C.genSpecMerge(on, { wings: [{ stol: null }] });
  ok(on.wings[0].stol && off.wings[0].stol === null && fpDef(C.buildGen(off)) === ref.def,
     'the merge takes a device back off (the join states null, A3) and the aeroplane is the old one');
}

console.log('2. THE SPEC');
{
  const tips = Object.keys(C.GEN_TIPS);
  ok(tips.slice(0, 6).join() === 'square,clipped,rounded,elliptic,hoerner,winglet' && tips[6] === 'endplate' && tips[7] === 'drooped',
     'the tips are APPENDED (every saved wgTip index keeps its meaning): ' + tips.join(' '));
  ok(Object.keys(C.GEN_SLATS).join() === 'none,slot,auto', 'GEN_SLATS: none, slot, auto (the cage index)');
  const n = C.genStolOf({ slat: 'slot', slatSpan: 7, vg: 3, fences: 9, cuff: 1, cuffSpan: -1, droop: 3, grow: 1, junk: 4 });
  ok(n.slatSpan === 1 && n.vg === 1 && n.fences === 2 && n.cuffSpan === 0.2 && n.droop === C.GEN_STOL.droopMax && n.grow === 1 && !('junk' in n),
     'genStolOf clamps every field and drops what it does not know: ' + JSON.stringify(n));
  ok(C.genStolOf({ slat: 'bogus' }) === null && C.genStolOf(null) === null && C.genStolOf(5) === null, 'an unknown slat or a non-object is "off"');
  // the cage rows
  ok(C.genStolCage({ wgSpan: 10 }) === undefined, 'genStolCage: a P without the rows says nothing (undefined)');
  ok(C.genStolCage({ wgSlat: 0, wgVG: 0, wgFence: 0, wgCuff: 0, wgDroop: 0, wgFowlerGrow: 0 }) === null, '...the default rows say null (STATED, A3)');
  const c2 = C.genStolCage({ wgSlat: 2, wgSlatSpan: 0.6, wgVG: 1, wgFence: 1, wgCuff: 0, wgDroop: 0.35, wgFowlerGrow: 1 });
  ok(c2 && c2.slat === 'auto' && c2.slatSpan === 0.6 && c2.vg === 1 && c2.fences === 1 && !c2.cuff && c2.droop === 0.35 && c2.grow === 1,
     '...and a set of rows the record: ' + JSON.stringify(c2));
  // the join writes it (A3), from the same rows
  global.GEN_TIPS = C.GEN_TIPS; global.GEN_FLAPS = C.GEN_FLAPS; global.genStolCage = C.genStolCage;
  const J = require(path.join(T, '_cage_join.js'));
  const P0 = { wgSpan: 10, wgChord: 1.6, wgChordTip: 1.6, wgCamber: 2, wgThick: 12, wgTip: 2, wgFlapType: 0, wgPos: 0, wgPanels: 3, wgBrace: 0, wgAilSpan: 0.38, wgAilChord: 0.22 };
  const jA = J.cageJoinSpec(P0, {}, { TIP_KEYS: Object.keys(C.GEN_TIPS), FLAP_KEYS: Object.keys(C.GEN_FLAPS) });
  const jB = J.cageJoinSpec(Object.assign({}, P0, { wgSlat: 0, wgVG: 0 }), {}, { TIP_KEYS: Object.keys(C.GEN_TIPS), FLAP_KEYS: Object.keys(C.GEN_FLAPS) });
  const jC = J.cageJoinSpec(Object.assign({}, P0, { wgSlat: 1, wgVG: 1 }), {}, { TIP_KEYS: Object.keys(C.GEN_TIPS), FLAP_KEYS: Object.keys(C.GEN_FLAPS) });
  ok(!('stol' in jA.wings[0]) && jB.wings[0].stol === null && jC.wings[0].stol && jC.wings[0].stol.slat === 'slot',
     'the join: no rows -> no key; default rows -> null; a slat -> the record');
  // the machine shop's flag
  ok(C.genStolLocked('slat', undefined) === null && C.genStolLocked('slat', ['stol-kit']) === null
     && C.genStolLocked('slat', []) === 'stol-kit' && C.genStolLocked('drooped', []) === null,
     'genStolLocked: nothing locked without a shop; the pack named when it is missing; ungated options never lock');
  // the design rows grey a locked tile (and the tile never writes)
  global.window = global.window || {};
  const D = require(path.join(T, '_cage_design.js'));
  const rowOpts = key => { const r = D.DESIGN_ROWS.find(x => x.key === key); return r ? (typeof r.options === 'function' ? r.options() : r.options) : null; };
  global.MACHINE_SHOP_OWNS = []; global.window.MACHINE_SHOP_OWNS = [];
  global.genStolLocked = C.genStolLocked; global.GEN_SLATS = C.GEN_SLATS;
  const locked = rowOpts('wgSlat');
  global.MACHINE_SHOP_OWNS = ['stol-kit']; global.window.MACHINE_SHOP_OWNS = ['stol-kit'];
  const owned = rowOpts('wgSlat');
  delete global.MACHINE_SHOP_OWNS; delete global.window.MACHINE_SHOP_OWNS;
  const free = rowOpts('wgSlat');
  ok(locked && locked.length === 3 && !locked[0].inactive && locked[1].inactive && locked[2].inactive
     && owned.every(o => !o.inactive) && free.every(o => !o.inactive),
     'the Leading-edge tiles: greyed without the pack, live with it, live with no shop at all');
  for (const k of ['wgSlat', 'wgVG', 'wgFence', 'wgCuff', 'wgDroop', 'wgFowlerGrow'])
    ok((rowOpts(k) || []).every(o => o.icon && o.icon.paths && o.icon.paths.length), 'design row ' + k + ': every tile has its drawing');
  ok(rowOpts('wgTip').length === 8 && rowOpts('wgTip')[6].label === 'Endplate' && rowOpts('wgTip')[7].label === 'Drooped',
     'the Wing tips row offers Endplate and Drooped, in table order');
}

console.log('3. THE PHYSICS (the Savannah-alike, as baked)');
{
  const base = tunnel(build('savannah'));
  PHY.base = base;
  const dev = (lbl, mod) => { const d = build('savannah', mod); return Object.assign(tunnel(d), { def: d }); };
  const slot = dev('slot', s => { W0(s).stol = { slat: 'slot' }; });
  const auto = dev('auto', s => { W0(s).stol = { slat: 'auto' }; });
  const vg = dev('vg', s => { W0(s).stol = { vg: 1 }; });
  const cuff = dev('cuff', s => { W0(s).stol = { cuff: 1 }; });
  const fen = dev('fences', s => { W0(s).stol = { fences: 2 }; });
  const ep = dev('endplate', s => { W0(s).tip = 'endplate'; });
  const sq = dev('square', s => { W0(s).tip = 'square'; });
  const r = (x, y) => x / y;
  const line = (lbl, t) => console.log('       ' + lbl.padEnd(10) + ' CLmax ' + t.CLmax.toFixed(2) + ' at ' + t.aSt.toFixed(2) + ' deg, Vs ' + (t.Vs * 3.6).toFixed(1) +
    ' km/h, D(2 deg) ' + t.D2.toFixed(1) + ' N, D(12 deg) ' + t.D12.toFixed(1) + ' N');
  for (const [l, t] of [['clean', base], ['slot', slot], ['auto slat', auto], ['VGs', vg], ['cuff', cuff], ['fences x2', fen], ['endplate', ep], ['(square)', sq]]) line(l, t);
  const deg = x => x * 180 / Math.PI;
  ok(r(slot.Vs, base.Vs) < 0.92 && r(slot.Vs, base.Vs) > 0.80, `the fixed slot: Vs x${r(slot.Vs, base.Vs).toFixed(3)} (in 0.80..0.92 - the 701 / Storch class)`);
  ok(Math.abs((slot.aSt - base.aSt) - deg(C.GEN_SLATS.slot.dAs)) < 2.5, `...its stall attitude moves by its dAs (${(slot.aSt - base.aSt).toFixed(2)} deg, ${deg(C.GEN_SLATS.slot.dAs).toFixed(1)} declared)`);
  ok(r(auto.Vs, base.Vs) < r(slot.Vs, base.Vs), 'the automatic slat out-lifts the fixed slot once it is out (Vs ' + r(auto.Vs, base.Vs).toFixed(3) + ')');
  ok(slot.D2 > base.D2 * 1.02, `the fixed slot pays its gap drag at cruise (D x${r(slot.D2, base.D2).toFixed(3)} at 2 deg)`);
  ok(auto.D2 < slot.D2 && auto.D2 > base.D2 && auto.D2 < base.D2 * 1.01, `the automatic slat pays only its seam at cruise (D x${r(auto.D2, base.D2).toFixed(4)})`);
  ok(r(vg.Vs, base.Vs) < 0.98 && r(vg.Vs, base.Vs) > 0.92, `VGs: Vs x${r(vg.Vs, base.Vs).toFixed(3)} (the kit sheets' 3-5 mph on a Cub: 0.92..0.98)`);
  ok(vg.D2 > base.D2 && vg.D2 < base.D2 * 1.02, `...for under 2 % of cruise drag (x${r(vg.D2, base.D2).toFixed(4)})`);
  ok(cuff.Vs <= base.Vs * 1.0001 && cuff.CL8 > base.CL8, `the cuff: no worse a stall (x${r(cuff.Vs, base.Vs).toFixed(3)}) and its nose camber lifts below it`);
  ok(fen.D2 > base.D2 && fen.def.params.gen.drag.stol > 0, `fences price their area (CdA ${(fen.def.params.gen.drag.stol || 0).toFixed(4)} m2)`);
  ok(ep.def.params.gen.drag.stol > 0 && ep.def.params.polarWing.eAR > sq.def.params.polarWing.eAR,
     `the endplate: span efficiency up (eAR ${ep.def.params.polarWing.eAR.toFixed(2)} vs square ${sq.def.params.polarWing.eAR.toFixed(2)}), its plates priced (CdA ${ep.def.params.gen.drag.stol.toFixed(4)} m2)`);
  ok(ep.D12 < sq.D12, `...and at climb alpha the endplate wing is the cheaper one (D(12) ${ep.D12.toFixed(1)} vs ${sq.D12.toFixed(1)} N)`);
  // the analytic CLmax (the AP's speed ladder) against the tunnel's
  for (const [l, t] of [['slot', slot], ['auto', auto], ['VGs', vg]]) {
    const gA = t.def.params.gen, kA = gA.Vs / Math.max(1e-6, gA.VsMeas), kB = PHY.base && build('savannah').params.gen;
    const k0 = kB.Vs / kB.VsMeas;
    ok(Math.abs(kA / k0 - 1) < 0.04, `${l}: the analytic stall moves with the measured one (analytic/measured ${kA.toFixed(3)} vs ${k0.toFixed(3)} clean)`);
  }
  // the auto slat is a FUNCTION of alpha: nothing below its opening band
  const sa = auto.def.strips.find(s => s.stol && s.stol.sa);
  ok(sa && !(sa.stol.dAs > 0), 'the automatic slat\'s strips carry its gain as `sa` (deploys), not as a fixed dAs');
  // drooped ailerons and Fowler growth: the flap lever only
  const fl = s => { s.controls.flap.type = 'fowler'; };
  const F0 = build('savannah', fl), Fd = build('savannah', s => { fl(s); W0(s).stol = { droop: 0.35 }; }), Fg = build('savannah', s => { fl(s); W0(s).stol = { grow: 1 }; });
  const t0c = tunnel(F0, 0), tdc = tunnel(Fd, 0), tgc = tunnel(Fg, 0);
  const t0f = tunnel(F0, 1), tdf = tunnel(Fd, 1), tgf = tunnel(Fg, 1);
  ok(Math.abs(tdc.CLmax - t0c.CLmax) < 1e-9 && Math.abs(tgc.CLmax - t0c.CLmax) < 1e-9 && tdc.D2 === t0c.D2,
     'droop and growth do nothing flaps-up (clean CLmax and drag the same bits)');
  ok(tdf.CLmax > t0f.CLmax + 0.04 && tdf.D2 > t0f.D2, `drooped ailerons: + ${(tdf.CLmax - t0f.CLmax).toFixed(3)} CLmax flaps-down, and their drag`);
  const sl0 = (t0f.CL12 - t0f.CL4) / 8, slg = (tgf.CL12 - tgf.CL4) / 8;
  ok(Math.abs(tgf.CLmax / t0f.CLmax - 1) < 0.08 && slg > sl0 * 1.02,
     `Fowler growth: the same CLmax to within 8 % (${tgf.CLmax.toFixed(2)} vs ${t0f.CLmax.toFixed(2)} - the stand-in dCl was fitted to it) on a steeper lift curve, the grown chord's (${slg.toFixed(4)} vs ${sl0.toFixed(4)} /deg)`);
  ok(Fg.params.flaps.dCl0 < F0.params.flaps.dCl0 && Fg.strips.some(s => s.fg > 0) && !F0.strips.some(s => 'fg' in s),
     'growth swaps the Fowler\'s stand-in camber for the slotted row\'s and grows the flapped strips only');
  // the solver's stall cap
  const allOn = build('savannah', s => { W0(s).stol = { slat: 'auto', vg: 1, cuff: 1, fences: 2 }; });
  const ta = tunnel(allOn);
  ok(ta.aSt - base.aSt <= deg(C.GEN_STOL.dAsMax) + 1.0, `everything at once is capped (the stall moves ${(ta.aSt - base.aSt).toFixed(2)} deg, cap ${deg(C.GEN_STOL.dAsMax).toFixed(1)})`);
}

console.log('4. THE DRAWING');
{
  const geo = def => {
    const w = C.genWing(def), g = w.groups.skin, P = [];
    for (let i = 0; i < g.nv; i++) P.push([g.pos[i * 3], g.pos[i * 3 + 1], g.pos[i * 3 + 2]]);
    return { w, P, nv: g.nv };
  };
  const b = geo(build('savannah'));
  // what a device ADDED to the skin: the vertices the plain wing does not
  // have (the devices are emitted side by side with each wing's own loft)
  const keyOf = p => p.map(x => x.toFixed(5)).join(',');
  const baseKeys = new Set(b.P.map(keyOf));
  const added = G => G.P.filter(p => !baseKeys.has(keyOf(p)));
  const xMin = Math.min(...b.P.map(p => p[0])), xMax = Math.max(...b.P.map(p => p[0]));
  const zMax = Math.max(...b.P.map(p => Math.abs(p[2]))), yMax = Math.max(...b.P.map(p => p[1])), yMin = Math.min(...b.P.map(p => p[1]));
  // the model frame's fore/aft sign, read off the drawing (the nose is the end the LE sits nearer)
  const sl = geo(build('savannah', s => { W0(s).stol = { slat: 'slot', slatSpan: 0.5 }; }));
  const ext = added(sl);
  const fore = ext.length ? (Math.abs(Math.min(...ext.map(p => p[0])) - xMin) < Math.abs(Math.max(...ext.map(p => p[0])) - xMax) ? -1 : 1) : 0;
  const leX = fore < 0 ? xMin : xMax;
  ok(ext.length > 0 && ext.some(p => fore < 0 ? p[0] < leX - 0.02 : p[0] > leX + 0.02),
     `the fixed slot stands proud of the leading edge (${ext.length} vertices)`);
  const semi = zMax, zIn = Math.min(...ext.map(p => Math.abs(p[2])));
  ok(Math.abs(zIn - 0.5 * semi) < 0.25, `...over its own span: inboard edge at ${zIn.toFixed(2)} m, half the ${semi.toFixed(2)} m semispan`);
  const v = geo(build('savannah', s => { W0(s).stol = { vg: 1 }; }));
  const vx = added(v);
  ok(vx.length > 60 && vx.length % 6 === 0, `the VG row: ${vx.length / 6} vanes, each a two-faced blade`);
  ok(Math.min(...vx.map(p => p[1])) > yMin + 0.5 * (yMax - yMin) - 0.6, '...standing on the upper skin');
  const f2 = geo(build('savannah', s => { W0(s).stol = { fences: 2 }; }));
  const fz = [...new Set(added(f2).map(p => Math.round(Math.abs(p[2]) * 50) / 50))];
  const def2 = build('savannah', s => { W0(s).stol = { fences: 2 }; });
  const want = C.genStolFences(def2.spec.wings[0].stol, def2.spec.geom.semi, def2.parts.zRoot, (1 - def2.spec.controls.aileron.span) * def2.spec.geom.semi, def2.spec.controls.aileron.span);
  ok(want.length === 2 && want.every(z => fz.some(q => Math.abs(q - z) < 0.03)), `two fences a side, drawn at the strips' stations (${want.map(z => z.toFixed(2)).join(', ')} m)`);
  const e = geo(build('savannah', s => { W0(s).tip = 'endplate'; }));
  const ex = added(e);
  ok(ex.length && Math.min(...ex.map(p => Math.abs(p[2]))) > semi - 0.01, 'the endplate stands at the tip, outboard of the skin');
  const ey = ex.map(p => p[1]);
  ok(Math.max(...ey) - Math.min(...ey) > 0.6 * 1.45 * 0.5, `...a plate ${(Math.max(...ey) - Math.min(...ey)).toFixed(2)} m tall, above and below the chord`);
  const dr = geo(build('savannah', s => { W0(s).tip = 'drooped'; }));
  const rd = geo(build('savannah', s => { W0(s).tip = 'hoerner'; }));
  const tipY = G => { let best = null; for (const p of G.P) if (Math.abs(p[2]) > zMax - 0.06 && (best === null || p[1] < best)) best = p[1]; return best; };
  ok(dr.nv === rd.nv && tipY(dr) < tipY(rd) - 0.05, `the drooped tip bends down (${(tipY(rd) - tipY(dr)).toFixed(3)} m below the Hoerner tip at the very end)`);
  const da = build('savannah', s => { W0(s).stol = { droop: 0.35 }; s.controls.flap.type = 'slotted'; });
  const mv = C.genWing(da).moving.filter(m => /^ail/.test(m.group));
  ok(mv.length === 2 && mv.every(m => m.drive2 === 'flap' && m.k2 > 0.2 && m.k2 < 0.3) && mv[0].sgn2 === -mv[1].sgn2,
     `drooping ailerons ride the flap lever (drive2 flap, ${(mv[0].k2 * 57.3).toFixed(1)} deg at full flap, the flap's own sense each side)`);
}
}

// =========================================================================
// 5. THE BENCH: three STOL aeroplanes against their makers' figures.
// Built from the cards (the Savannah-alike as it is; the Cub-alike with the
// Super Cub's O-320 and slotted flaps; the Cub-alike with the Highlander's
// Rotax 912 and its big slotted flaps), loaded to the sheet's weight, with
// and without the devices that aeroplane is sold with. Vs is the MEASURED
// stall (the tunnel); the take-off roll is genTORunAt (the plaque's, the
// pilot's take-off notch); the landing roll is Vtd^2 / 2a with Vtd = 1.10 x
// the landing-configuration stall and a = 0.30 g of braking (an estimate of
// the bench's own, stated as such - the flown landing is perf_study's
// --fly). Sources: the makers' sheets as commonly published (+-10 %, and
// generous - see HANDOVER G2820).
const BENCH = {
  // `sheetHas`: the published figures are the aeroplane WITH its devices
  // (the Savannah's slats, the Highlander's VGs) or WITHOUT (the Super Cub's
  // POH predates every VG kit - the kit's own claim is `kitDVs`, km/h)
  savannah: { name: 'ICP Savannah S (Rotax 912, 100 hp)', card: 'savannah', mtow: 600, sheetHas: true,
              Vs1: 52, Vs0: 45, TO: 60, LDG: 70, devices: { slat: 'slot' },
              src: 'ICP data (perf_study REAL.savannah): Vs 52 km/h clean / 45 flaps, TO run 60 m, landing 70 m at 600 kg; the family flies a slatted wing (the classic) or a VG wing (the VG / S) - measured here with the fixed slot' },
  supercub: { name: 'Piper PA-18-150 Super Cub', card: 'cub', mtow: 794, engine: 'o320_mccauley', flap: 'slotted', sheetHas: false, kitDVs: [3, 8],
              Vs1: 76, Vs0: 69, TO: 61, LDG: 107, devices: { vg: 1 },
              src: 'POH PA-18-150: stall 47 mph flaps up / 43 mph flaps 50 deg at 1750 lb, ground roll 200 ft, landing roll 350 ft; the usual Micro VG kit' },
  highlander: { name: 'Just Aircraft Highlander (Rotax 912 ULS)', card: 'cub', mtow: 599, engine: 'rotax912_warp', flap: 'slotted', flapSpan: 0.58, sheetHas: true,
              Vs1: null, Vs0: 45, TO: 30, LDG: 46, devices: { vg: 1, droop: 0.35 },
              src: 'Just Aircraft: stall 28 mph (flaps; no clean figure published), take-off 100 ft, landing 150 ft at 1320 lb; VGs and drooping ailerons stand in for its STOL kit' },
};
function benchRow(B, withDev) {
  const s = clone(CARDS[B.card].spec);
  if (B.engine) for (const e of s.engines) e.type = B.engine;
  if (B.flap) { s.controls.flap.type = B.flap; if (B.flapSpan) s.controls.flap.span = B.flapSpan; }
  if (withDev) s.wings[0].stol = clone(B.devices);
  const def = C.buildGen(s);
  const sim = C.makeSim(def, null); sim.reset(0);
  const asBaked = sim.totalM;
  ballast(sim, Math.max(0, B.mtow - asBaked));
  const W = sim.totalM * 9.81, k = Math.sqrt(sim.totalM / asBaked);
  const c = tunnel(def, 0), f = def.params.flaps ? tunnel(def, 1) : c;
  const Vs1 = c.Vs * k, Vs0 = f.Vs * k;
  const to = C.genTORunAt(sim, def, W);
  const VsL = (def.params.flaps && def.params.flaps.ldg > 0) ? Vs0 : Vs1;
  const ldg = Math.pow(1.10 * VsL, 2) / (2 * 0.30 * 9.81);
  return { Vs1: Vs1 * 3.6, Vs0: Vs0 * 3.6, TO: to.sRoll, LDG: ldg, mass: sim.totalM, ldgFlaps: !!(def.params.flaps && def.params.flaps.ldg > 0) };
}
console.log('5. THE BENCH (the makers\' figures; Vs km/h, rolls m; measured / published (gap))');
const pct = (a, b) => (a >= b ? '+' : '') + Math.round(100 * (a / b - 1)) + ' %';
for (const [key, B] of Object.entries(BENCH)) {
  const a = benchRow(B, false), b = benchRow(B, true);
  console.log('   ' + B.name + ' at ' + Math.round(b.mass) + ' kg, devices ' + JSON.stringify(B.devices) + (b.ldgFlaps ? '' : ' (lands flapless - the trim solver\'s verdict)'));
  for (const [lbl, k] of [['Vs1 clean', 'Vs1'], ['Vs0 flaps', 'Vs0'], ['TO roll', 'TO'], ['LDG roll~', 'LDG']])
    console.log('     ' + lbl.padEnd(10) + ' without ' + a[k].toFixed(1).padStart(6) + ' (' + (B[k] ? pct(a[k], B[k]) : '-').padStart(6) + ')   with ' + b[k].toFixed(1).padStart(6) +
                ' (' + (B[k] ? pct(b[k], B[k]) : '-').padStart(6) + ')   sheet ' + (B[k] || '-'));
  console.log('     src: ' + B.src);
  if (BENCH_ONLY) continue;
  // what is gated: the devices never take the aeroplane AWAY from a sheet
  // that includes them (2 % of slack: a slot's drag is a real cost on a
  // roll the wing cannot shorten), never more than 15 % past it; the take-
  // off roll never grows by more than the device's drag; a kit's claimed
  // stall gain is met. The absolute gaps are the model's, and are printed.
  if (B.sheetHas) {
    for (const k of ['Vs1', 'Vs0', 'LDG'].filter(k => B[k])) {
      const gA = Math.abs(a[k] / B[k] - 1), gB = Math.abs(b[k] / B[k] - 1);
      ok(gB <= gA + 0.02 && b[k] / B[k] >= 0.85,
         `${key} ${k}: the devices move it toward the sheet (gap ${Math.round(100 * gA)} -> ${Math.round(100 * gB)} %) and not 15 % past it`);
    }
  } else {
    const d = a.Vs1 - b.Vs1;
    ok(d >= B.kitDVs[0] && d <= B.kitDVs[1], `${key}: the kit buys ${d.toFixed(1)} km/h of clean stall (its claim: ${B.kitDVs[0]}-${B.kitDVs[1]})`);
    ok(Math.abs(a.Vs1 / B.Vs1 - 1) < 0.10, `${key}: the stock aeroplane is the POH's (Vs1 ${pct(a.Vs1, B.Vs1)})`);
  }
  ok(b.TO <= a.TO * 1.03, `${key}: the take-off roll is not lengthened past the devices' drag (${a.TO} -> ${b.TO} m)`);
}

// =========================================================================
if (SELF) {
  console.log('SELFTEST (each break must be caught)');
  const t = [];
  // a: a strip that carries a zero stol record is NOT the bits (section 1's instrument sees it)
  { const def = build('savannah'); def.strips.find(s => s.kind === 'wing').stol = { dAs: 0, dCl: 0, cd: 0, mx: 0.22 };
    t.push(['an empty stol key on one strip moves the def hash', fpDef(def) !== CARDS.savannah.def]); }
  // b: a tip inserted (not appended) would renumber the saved indices
  { const keys = ['square', 'endplate', 'clipped', 'rounded', 'elliptic', 'hoerner', 'winglet', 'drooped'];
    t.push(['an inserted tip is caught by the append rule', !(keys.slice(0, 6).join() === 'square,clipped,rounded,elliptic,hoerner,winglet')]); }
  // c: a slot with no stall gain would fail the Vs band
  { const save = C.GEN_SLATS.slot.dAs; C.GEN_SLATS.slot.dAs = 0;
    const tt = tunnel(build('savannah', s => { W0(s).stol = { slat: 'slot' }; }));
    C.GEN_SLATS.slot.dAs = save;
    const b0 = PHY.base || tunnel(build('savannah'));
    t.push(['a slot with no dAs fails the Vs band', !(tt.Vs / b0.Vs < 0.92)]); }
  // d: the fingerprint without the null strip would move
  { const sp = clone(CARDS.savannah.spec), spN = clone(sp); spN.wings[0].stol = null;
    t.push(['a null stol hashed raw differs from the absent key (what bench.js strips)', JSON.stringify(sp) !== JSON.stringify(spN)]); }
  for (const [lbl, caught] of t) ok(caught, 'selftest: ' + lbl);
}

if (fails) console.log('FAILED CHECKS: ' + failed.join(' | '));
console.log(`(${checks} checks)`);
console.log(fails ? 'GATE STOL: FAIL' : 'GATE STOL: PASS');
process.exitCode = fails ? 1 : 0;
