#!/usr/bin/env node
// tank_refit.js - THE STOCK DESIGNS' DEFAULT TANKS, REFITTED (G1109, CUB-COCKPIT 2026-09-30)
//
// The user's decision ("refit the tanks", relayed by A0): every stock design
// whose default tank the energy layer's own fit rejects (`ok: false` - through
// the skin, the frame, the dash, the crew or the engine; GATE TANKMOUNT's
// table in HANDOVER G1105-G1109) gets a default tank that FITS, with the
// SMALLEST change: first a shape / placement within its bay at the SAME
// capacity, and only when nothing fits, the largest capacity that does.
//
// This builds each card AS THE GAME FLIES IT (the joined bake, the energy
// layer handed the built spec, the CREW layer loaded - its feet and pedals
// are what a nose tank meets) and asks the layer itself, CAGE_ENERGY.fitOf,
// with nothing drawn and nothing written back:
//   shapes   box and cylinder; width x height on a 4 x 4 grid of the bay's
//            section, the length solved for the capacity (the layer's own
//            capacityFromDims); rot 0 and 90
//   places   a 5 x 5 grid of station (along) and level (lv) in the bay
//   order    by how far the vessel's centre moves from where it is now (the
//            fuel's mass is billed where the vessel stands: the CG moves by
//            what the tank moves), the vessel's own form and turn first
//   capacity the design's own; then down 10 % a step until something fits
// One card a process (the layers carry state across builds: G1106.2).
//
//   node tools/tank_refit.js [--only cub,jodel] [--json out.json] [--jobs 3] [--sweep]
// No --help: an unknown flag is ignored.
'use strict';
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ONLY = opt('only', null);
const JSON_OUT = opt('json', null);
const JOBS = +opt('jobs', 3);
const T = __dirname;

if (!argv.includes('--child')) {
  const { spawn } = require('child_process');
  const os = require('os');
  const keys = ONLY ? ONLY.split(',') : require(path.join(T, '_bake_joined.js')).loadPanel().D.ARCHETYPES.map(a => a.key);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tankrefit_'));
  const out = new Array(keys.length);
  let next = 0;
  const one = () => new Promise(res => {
    const i = next++; if (i >= keys.length) return res(false);
    const jf = path.join(tmp, keys[i] + '.json');
    const ch = spawn(process.execPath, ['--max-old-space-size=4096', __filename, '--child', '--only', keys[i], '--json', jf].concat(argv.includes('--sweep') ? ['--sweep'] : []), { stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    ch.stdout.on('data', d => { log += d; }); ch.stderr.on('data', d => { log += d; });
    ch.on('close', code => {
      let j = null; try { j = JSON.parse(fs.readFileSync(jf, 'utf8')); } catch (e) {}
      out[i] = { key: keys[i], code, j, log };
      const r = j && j.vessels || [];
      console.log('  ' + keys[i].padEnd(14) + (j ? r.map(v => v.how + ' ' + (v.design != null ? v.design : v.old.capacity) + ' -> ' + (v.new ? v.new.capacity : '-') + (v.shift != null ? ' (moved ' + (v.shift * 1000).toFixed(0) + ' mm)' : '') +
        (v.sweep ? ' [sweep: max ' + v.sweep.maxFit + ', monotone ' + v.sweep.monotone + ', agrees ' + v.sweep.agrees + ']' : '')).join('; ') || 'no body tank' : 'FAILED exit ' + code + ' ' + log.split('\n').slice(-3).join(' | ')));
      res(true);
    });
  });
  const lane = async () => { while (await one()) {} };
  Promise.all(Array.from({ length: JOBS }, lane)).then(() => {
    const all = out.map(o => o.j || { key: o.key, error: 'exit ' + o.code });
    if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(all, null, 1));
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  });
  return;
}

// ---- one card -------------------------------------------------------------
const SH = require(path.join(T, '_scene_headless.js'));
for (const f of ['_bay_site.js', '_vessel_gen.js', '_vessel_mesh.js', '_cage_energy.js',
                 '_cage_crew.js', '_cage_char.js', '_panel_gen.js', '_cage_panel.js']) SH.EXCLUDE.delete(f);
const BJ = require(path.join(T, '_bake_joined.js'));
const { D, C } = BJ.loadPanel();
const X = SH.context();
const W = X.ctx;
SH.stubCanvas();
const quiet = console.error; console.error = () => {};     // the panel's atlas wants a canvas; the crew draws without it
const key = ONLY;
// THE DESIGN'S CAPACITY is the card's (its birth spec: the J-3's 45 L), not
// what the layer wrote back after shaping a box that never fitted (35)
const card = D.ARCHETYPES.find(x => x.key === key);
const birth = C.genNormaliseSpec(D.designBake(card.sel, card.over));
// THE CARD'S OWN TANKS (G1109): the energy layer is loaded here, and on the
// first build it seeds ITSELF when nothing has (not in the game: no
// GARAGE_SPEC to read, no prefs) - a 45 L nose tank, which the join then
// exported as every card's energy. Seeded from the card's birth spec first,
// the layer and the join carry what the design declares (the Caravan's 1257 L
// in the wings, not a nose tank it does not have).
W.CAGE_ENERGY.fromSpec(birth.energy, birth);
const spec = BJ.bakeCard(key).spec;
const birthCap = i => { const b = birth.energy && birth.energy.vessels && birth.energy.vessels[i]; return b && b.capacity > 0 ? +b.capacity : null; };
const def = C.buildGen(spec);
W.CAGE_ENERGY.fromSpec(spec.energy);
const SCENE = SH.sceneBuild(spec, { garage: spec, resolved: () => def.spec, inGame: true });
const E = W.CAGE_ENERGY, EN = E.EN, VG = W.VESSEL_GEN || W.VESSEL_GEN;
const out = { key, kind: EN.kind, vessels: [] };
const bays = E.bays();

const res0 = E.results() || [];
EN.vessels.forEach((v0, i) => {
  const r0 = res0.find(r => r.v === v0);
  const bay = bays.find(b => b.key === v0.bay);
  if (!r0 || r0.on !== 'body' || !bay) return;
  const old = JSON.parse(JSON.stringify(v0));
  const rec = { i, bay: v0.bay, old: { capacity: old.capacity, along: old.along, lv: old.lv, rot: old.rot || 0, form: old.form || 'box', dims: old.dims || null },
                oldFit: { ok: !!r0.ok, why: r0.why.slice(), c: r0.c } };
  out.vessels.push(rec);
  if (r0.ok) { rec.how = 'kept'; rec.new = rec.old; rec.shift = 0; return; }
  // the bay's room: the section's inner width and the band's height at the
  // tank's own station, the bay's length
  const sec = r0.section || {};
  const Wmax = Math.max(0.1, (sec.xHi - sec.xLo) || 0.5);
  const Hmax = Math.max(0.08, sec.band ? sec.band[1] - sec.band[0] : 0.3);
  const Lbay = Math.max(0.05, bay.x1 - bay.x0);
  const c0 = r0.c || [0, 0, 0];
  const band = sec.band || [c0[1] - 0.1, c0[1] + 0.1];
  const zOf = along => c0[2] - (along - (old.along != null ? old.along : 0.5 * (bay.x0 + bay.x1)));
  const capOf = (dims, form) => E.capacityFromDims(dims, form);
  // the length that holds `cap` for a width, height and form (the layer's
  // capacity is monotonic in L): bisection
  const lenFor = (cap, Wd, Hd, form) => {
    let lo = 0.02, hi = 3;
    if (capOf({ L: hi, W: Wd, H: Hd }, form) < cap) return null;
    for (let k = 0; k < 30; k++) { const m = 0.5 * (lo + hi); if (capOf({ L: m, W: Wd, H: Hd }, form) >= cap) hi = m; else lo = m; }
    return hi;
  };
  const tryCap = cap => {
    const cands = [];
    for (const form of [rec.old.form, rec.old.form === 'cyl' ? 'box' : 'cyl'])
      for (const fw of [0.35, 0.5, 0.65, 0.8, 0.92]) for (const fh of [0.3, 0.45, 0.6, 0.75, 0.9]) {
        // the cylinder is an ELLIPSE (VESSEL_MESH's cyl takes ex and ey
        // apart): wide and shallow follows a curved deck where a box's
        // corners stand out (the Cub: the bay's columns hold 62 L, a box 16)
        const Wd = +(fw * Wmax).toFixed(3), Hd = +(fh * Hmax).toFixed(3);
        const Wd2 = Wd;
        const L = lenFor(cap, Wd2, Hd, form);
        if (!L) continue;
        for (const rot of [rec.old.rot, rec.old.rot ? 0 : 90]) {
          const along_ext = rot ? Wd2 : L;                  // the extent along the body
          if (along_ext > Lbay + 1e-6) continue;
          const lat_ext = rot ? L : Wd2;
          if (lat_ext > Wmax + 1e-6) continue;
          if (Hd > Hmax + 1e-6) continue;
          for (let ia = 0; ia < 5; ia++) for (let il = 0; il < 5; il++) {
            const a0 = bay.x0 + along_ext / 2, a1 = bay.x1 - along_ext / 2;
            const along = a1 > a0 ? a0 + (a1 - a0) * ia / 4 : 0.5 * (bay.x0 + bay.x1);
            const lv = il / 4;
            const yEst = Math.max(band[0] + Hd / 2, Math.min(band[1] - Hd / 2, band[0] + lv * (band[1] - band[0])));
            const est = Math.hypot(zOf(along) - c0[2], yEst - c0[1]) + (form !== rec.old.form ? 0.02 : 0) + (rot !== rec.old.rot ? 0.01 : 0);
            cands.push({ est, v: { bay: v0.bay, capacity: cap, along: +along.toFixed(4), lv: +lv.toFixed(3), rot, form,
                                   dims: { L: +L.toFixed(3), W: Wd2, H: Hd } } });
          }
        }
      }
    cands.sort((a, b) => a.est - b.est);
    let n = 0;
    for (const cd of cands) {
      n++;
      const f = E.fitOf(Object.assign({}, old, cd.v), { fast: true });
      if (f && f.ok) return { v: f.v, fit: f, tried: n };
    }
    return { v: null, tried: n };
  };
  const design = birthCap(i) || old.capacity;
  let got = null, tried = 0;
  rec.design = design;
  // the design's capacity first; then DOWN in 2 % steps, the first that fits.
  // Not a bisection (A0's check, --sweep, 2026-10-01): "something fits" is
  // NOT monotone at a fine grain - the candidate grid moves with the tank's
  // length - and on the Cub a bisection stopped at 15 L where 18 fits
  // (16.x failed). The descending scan finds the largest on its grid.
  { const g = tryCap(design); tried += g.tried; if (g.v) got = g; }
  for (let k = 49; !got && k >= 1; k--) {
    const c = Math.round(design * k / 50 * 10) / 10;
    const g = tryCap(c); tried += g.tried;
    if (g.v) got = g;
  }
  rec.tried = tried;
  // --sweep (A0, 2026-10-01): THE BISECTION IS ONLY VALID IF "SOMETHING FITS" IS
  // MONOTONE IN CAPACITY - the candidate grid is laid out from the bay less the
  // tank's own extent, so it moves with the length, and nothing guarantees it.
  // A linear sweep, 20 levels from the design down, every level asked in
  // full: the fitting levels must be one run from the bottom up, and the
  // bisected answer within one step of the sweep's largest
  if (argv.includes('--sweep')) {
    const lv = [];
    for (let k = 20; k >= 1; k--) { const c = Math.round(design * k / 20 * 10) / 10; lv.push({ cap: c, fits: !!tryCap(c).v }); }
    const fit = lv.filter(q => q.fits).map(q => q.cap);
    const maxFit = fit.length ? Math.max(...fit) : 0;
    const monotone = lv.every(q => q.fits === (q.cap <= maxFit));
    rec.sweep = { levels: lv, maxFit, monotone, bisected: got ? got.v.capacity : 0,
                  agrees: Math.abs((got ? got.v.capacity : 0) - maxFit) <= design / 20 + 0.05 };
  }
  // THE DECK FORM (G1152): the bay's own columns (tank_bay_probe.measureBay),
  // the largest straight tank whose section fits under the deck and over the
  // crew at every station it spans, built as a deck tank at a few insets off
  // the top and the flanks and asked the layer's own fit. The best SHAPE ships
  // (the user's ruling): a box / cylinder at the design's capacity is the
  // smallest change and stays; otherwise the deck tank when it holds more -
  // shortened to the design's capacity when it could hold more than that.
  {
    const PB = require(path.join(T, 'tank_bay_probe.js'));
    const m = PB.measureBay({ W, THREE: X.THREE, r: SCENE, res: r0, bay });
    let deckGot = null;
    rec.deck = { prism: m && m.prism ? { litres: m.prism.litres, fuel: m.prism.fuel } : null };
    const band = (r0.section && r0.section.band) || null;
    const lvOf = (yc, H) => band ? Math.max(0, Math.min(1, (yc - band[0]) / Math.max(1e-6, band[1] - band[0]))) : 0.5;
    const askDeck = dk => {
      const cand = { bay: v0.bay, form: 'deck', rot: 0, dims: dk.dims, along: +dk.along.toFixed(4), lv: +lvOf(dk.yc, dk.dims.H).toFixed(4) };
      cand.capacity = E.capacityFromDims(cand.dims, 'deck');
      const f = E.fitOf(Object.assign({}, old, cand), { fast: true });
      return f && f.ok ? { v: f.v, fit: f } : null;
    };
    if (m && m.prism && m.prism.litres > 0) {
      // the top and the sides inset separately, the candidates in falling capacity: the first that fits is the largest
      const cands = [];
      for (const ti of [0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.07]) for (const si of [0, 0.01, 0.02, 0.035]) for (const li of [0, 0.005, 0.01, 0.02, 0.035]) {
        const dk = PB.deckFromPrism(m.prism, si, 9, ti, li);
        if (dk && dk.dims.L > 0.05) cands.push({ dk, ti, si, li, cap: E.capacityFromDims(dk.dims, 'deck') });
      }
      cands.sort((p, q) => q.cap - p.cap);
      for (const cd of cands) { const g = askDeck(cd.dk); if (g) { deckGot = g; rec.deck.inset = cd.si; rec.deck.topInset = cd.ti; rec.deck.endInset = cd.li; break; } }
    }
    if (deckGot) {
      rec.deck.max = deckGot.v.capacity;
      const boxCap = got ? got.v.capacity : 0;
      if (boxCap < design - 0.05 && deckGot.v.capacity > boxCap) {
        if (deckGot.v.capacity > design + 0.05) {
          // more than the design: the same section, shortened to the design's litres
          const d2 = JSON.parse(JSON.stringify(deckGot.v.dims));
          d2.L = +(d2.L * design / deckGot.v.capacity).toFixed(3);
          for (let k = 0; k < 6 && E.capacityFromDims(d2, 'deck') < design; k++) d2.L = +(d2.L * 1.01).toFixed(3);
          const g2 = askDeck({ dims: d2, along: deckGot.v.along, yc: (band ? band[0] + deckGot.v.lv * (band[1] - band[0]) : 0) });
          got = g2 || deckGot;
        } else got = deckGot;
      }
    }
  }
  if (!got) { rec.how = 'none'; rec.new = null; return; }
  const v = got.v;
  rec.how = v.capacity >= rec.design - 0.05 ? 'placement' : 'capacity';
  if (v.form === 'deck') rec.how += ' (deck form)';
  rec.new = { capacity: v.capacity, along: v.along, lv: v.lv, rot: v.rot, form: v.form, dims: v.dims };
  rec.newFit = { ok: true, c: got.fit.c, why: got.fit.why };
  rec.shift = Math.hypot(got.fit.c[0] - c0[0], got.fit.c[1] - c0[1], got.fit.c[2] - c0[2]);
});
console.error = quiet;
fs.writeFileSync(opt('json'), JSON.stringify(out, null, 1));
