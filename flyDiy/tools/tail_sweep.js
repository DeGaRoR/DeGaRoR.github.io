// TAIL SWEEP — a BENCH, not a gate (TAIL CHANTIER 2, P0).
//
// For every archetype: the DRAWN tail (the card's own cage params through
// _tail_headless.js — the same sheets the page's fin and stab layers draw,
// the same `measure` they publish), the RULED tail (designBake ->
// resolveSpec: what the aeroplane FLIES until P1 wires the measure into the
// join), and the static margin if the drawn tail flew (Sh/Sv/hSpan/hChord/
// vHeight/vChord set before resolve, so `put` stands down). Prints the plan's
// §1 table and writes $HOME/tail_sweep.json with every number behind it.
//
// Conventions (TAIL-CHANTIER-2 §2.1, ruling (l)): Sh GROSS = both panels +
// the carry-through 2·rootX·chordRoot; Sv = the fin proper + its rudder +
// the keel tab, the DORSAL excluded (a stall-delay device, measured apart).
// A twin-boom card's fin roots on the fuselage centreline here (no wing
// layer): its row is marked ~.
//
//   FD=<flyDiy dir> node tools/tail_sweep.js [--json]
'use strict';
const path = require('path');
const T = process.env.FD ? process.env.FD + '/tools' : __dirname;
function loadPanel() {
  const CORE = require(path.join(T, 'flight_core.js'));
  for (const k of Object.keys(CORE)) global[k] = CORE[k];
  const noop = function () { return this; };
  class Obj { constructor() { this.children = []; this.position = { set: noop }; this.rotation = {}; this.scale = { set: noop, setScalar: noop }; } add() { return this; } remove() {} traverse() {} }
  global.THREE = new Proxy({}, { get: (t, k) => { if (k === 'Vector3') return function () { return { set: noop, x: 0, y: 0, z: 0 }; }; return class extends Obj {}; } });
  global.window = { THREE: global.THREE };
  for (const f of ['_cage_parts.js', '_cage_page5.js', '_cage_gen.js', '_cage_crew.js', '_gear_kit.js', '_gear_gen.js', '_gear_page.js', '_cage_gear.js', '_fit_site.js', '_fit_gen.js', '_eng_gen.js', '_eng_mesh.js', '_eng_page.js', '_cowl_gen.js', '_cowl_rows.js', '_cage_cowl.js', '_cage_eng.js', '_strut_gen.js', '_cage_wing.js', '_cage_brace.js', '_fin_gen.js', '_cage_fin.js', '_cage_stab.js', '_cage_access.js', '_cage_light.js'])
    require(path.join(T, f));
  global.window.CAGE_JOIN_ENGINES = require(path.join(T, '_cage_join.js')).CAGE_JOIN_ENGINES;
}
loadPanel();
const D = require(path.join(T, '_cage_design.js'));
const C = require(path.join(T, 'flight_core.js'));
const TH = require(path.join(T, '_tail_headless.js'));
const CG2 = window.CAGE2;
const clone = o => JSON.parse(JSON.stringify(o));

// the drawn tail's spec-side numbers, as the join writes them (P1) — the
// one arithmetic in _tail_headless.js tailRows (P5)
function drawnTail(P) {
  const t = TH.tailBuild(P, { level: 2 });
  const r = TH.tailRows(t);
  const out = { FS: t.FS, planeScale: P.planeScale || 1, approx: t.approx,
                stOn: !!t.stab, finOn: !!t.fin, boomStyle: P.boomStyle, rows: r,
                stab: t.stab ? TH.measurePlain(t.stab.measure) : null,
                fin: t.fin ? TH.measurePlain(t.fin.measure) : null };
  if (t.stab) {
    out.hSpan = r.hSpan; out.ShGross = r.Sh != null ? r.Sh : r.Svt;
    out.hChordMean = r.hChord; out.hChordBox = t.stab.measure.chordBox;
    out.elevFrac = t.stab.measure.ctlFrac; out.cant = t.stab.cant;
  }
  if (t.fin) {
    out.Sv = r.Sv; out.SvDorsal = r.dorsalArea; out.vHeight = r.vHeight;
    out.vChordMean = r.vChord; out.vChordBox = t.fin.measure.chordBox;
    out.rudFrac = t.fin.measure.ctlFrac;
  }
  return out;
}

const out = [];
for (const a of D.ARCHETYPES) {
  const row = { key: a.key, name: a.name };
  try {
    const inactive = D.archInactive(a); if (inactive) { row.skipped = inactive; out.push(row); continue; }
    const P0 = D.designFull(a.sel, a.over).full;
    const spec = D.designBake(a.sel, a.over);
    // P5: designBake SEEDS the drawn tail off the rule (the macro rows); the
    // drawn tail here is what the game draws at birth — the seeded cage read
    // back off the baked spec — and the seed factors ride along
    const P = Object.assign({}, P0, CG2.cageFromSpec(spec.cage));
    row.seed = { stSpan: P.stSpan, stChord: P.stChord, finHeight: P.finHeight, finChord: P.finChord };
    const dt = drawnTail(P); row.drawn = dt;
    const R = C.resolveSpec(clone(spec)).spec.tail;
    row.ruled = { Sh: R.Sh, Sv: R.Sv, hSpan: R.hSpan, hChord: R.hChord, vHeight: R.vHeight, vChord: R.vChord, lh: R.lh, lv: R.lv, type: R.type };
    const t0 = Date.now();
    const sk0 = C.genShakedown(C.buildGen(clone(spec)), { slim: true, corners: false });
    row.base = { SM: sk0.staticMargin, stabTrim: sk0.stabTrim, cgPct: sk0.cgX, npX: sk0.npX };
    // the drawn tail flown: the measure's Sh/Sv plus the join-style extents
    if (R.type !== 'v' && dt.stab) {
      const s2 = clone(spec); s2.tail = Object.assign({}, s2.tail || {});
      s2.tail.Sh = dt.ShGross; s2.tail.hSpan = dt.hSpan; s2.tail.hChord = dt.hChordMean;
      if (dt.fin) { s2.tail.Sv = dt.Sv; s2.tail.vHeight = dt.vHeight; s2.tail.vChord = dt.vChordMean; }
      const R2 = C.resolveSpec(clone(s2)).spec.tail;
      const sk1 = C.genShakedown(C.buildGen(s2), { slim: true, corners: false });
      row.drawnFlown = { Sh: R2.Sh, Sv: R2.Sv, SM: sk1.staticMargin, stabTrim: sk1.stabTrim, npX: sk1.npX };
    }
    row.ms = Date.now() - t0;
  } catch (e) { row.error = String(e && e.stack || e).split('\n').slice(0, 3).join(' | '); }
  out.push(row);
  process.stderr.write(row.key + (row.error ? ' ERR ' + row.error : ' ok') + ' ' + (row.ms || '') + '\n');
}
require('fs').writeFileSync((process.env.HOME || process.env.USERPROFILE) + '/tail_sweep.json', JSON.stringify(out, null, 1));

// the table (the plan's §1)
const f = (v, d = 2) => v == null || !Number.isFinite(v) ? '   -  ' : v.toFixed(d).padStart(6);
const pc = v => v == null || !Number.isFinite(v) ? '   -  ' : (100 * v).toFixed(1).padStart(6);
console.log('key            | drawnSh ruledSh ratio | drawnSv ruledSv ratio | elev%  rud%  | SM base SM drawn  dSM');
for (const r of out) {
  if (r.skipped) { console.log(r.key.padEnd(15) + '| skipped: ' + r.skipped); continue; }
  if (r.error) { console.log(r.key.padEnd(15) + '| ERROR ' + r.error); continue; }
  const d = r.drawn, R = r.ruled;
  const mark = d.approx.length ? '~' : (R.type === 'v' ? '*' : ' ');
  console.log((r.key + mark).padEnd(15) + '| ' + f(d.ShGross) + ' ' + f(R.Sh) + ' ' + f(d.ShGross / R.Sh) +
    ' | ' + f(d.Sv) + ' ' + f(R.Sv) + ' ' + f(d.Sv != null ? d.Sv / R.Sv : null) +
    ' | ' + pc(d.elevFrac) + pc(d.rudFrac) + ' | ' + pc(r.base.SM) + '  ' +
    (r.drawnFlown ? pc(r.drawnFlown.SM) + ' ' + pc(r.drawnFlown.SM - r.base.SM) : '   -      -  '));
}
console.log('  ~ twin-boom card: the fin roots on the fuselage centreline here (no wing layer)');
console.log('  * V-tail: bakes conventional in node (G209\'s own trap); indicative only');
