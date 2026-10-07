#!/usr/bin/env node
// G2377 (DMG-OCCUPANT): THE EVIDENCE'S PICTURES - each occupant's pulse (the seat's specific force in its own frame, CFC 60:
// x forward, y lateral, z spinal) through the standard crashes on the three land builds, with the band the game shows and
// the criteria that set it. EVIDENCE ONLY: nothing here reaches the game (the user: no numbers, no plots in the UI).
//   node tools/dmg_occupant_evidence.js [--out reports/evidence/DMG-OCCUPANT] [--builds cub,jodel,metal] [--cases trunk0,trunk25,taxi]
// Writes <out>/pulse_<build>_<case>.svg and pulses.json (the bands and the criteria per seat).
'use strict';
const path = require('path'), fs = require('fs');
process.env.FLYDIY_CERT = '1';
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const OUT = path.resolve(opt('out', path.join(__dirname, '..', 'reports', 'evidence', 'DMG-OCCUPANT')));
const L = require('./_treecrash_lib.js'), C = L.core();
const CASES = {
  taxi: { label: 'a 3 m/s taxi into a trunk', kind: 'trunk', o: { D: 4, V: 3, thr: 0, secs: 8 } },
  noseover: { label: 'the nose-over (12 m/s into a 35 cm stump)', kind: 'trunk', o: { D: 12, V: 12, thr: 0, secs: 6, trunk: { r: 0.25, h: 0.35, sink: 0 } } },
  far473: { label: 'the drop at FAR 23.473\'s limit sink', kind: 'drop', o: { k473: 1.0, frames: 240 } },
  trunk0: { label: 'a trunk at 30 m/s, the centreline', kind: 'trunk', o: { D: 40, agl: 4, V: 30, thr: 0, secs: 6, off: 0 } },
  trunk25: { label: 'a trunk at 30 m/s, the wing 2.5 m out', kind: 'trunk', o: { D: 40, agl: 4, V: 30, thr: 0, secs: 6, off: 2.5 } },
};
const builds = opt('builds', 'cub,jodel,metal').split(','), cases = opt('cases', 'taxi,noseover,far473,trunk0,trunk25').split(',');
fs.mkdirSync(OUT, { recursive: true });
const all = [];
for (const k of builds) for (const id of cases) {
  const c = CASES[id];
  // the record kept as it closes (the recorder empties its buffer at the close: a copy each frame while it runs); a
  // case the game never records (a taxi, the drop: no event) is flown again with the trigger at 1.5 g (a test setting)
  let keep = null, trig = null;
  const onFrame = sim => { const O = sim.occupants(); if (O && O.state.st === 2) { const S = O.state; keep = { buf: S.buf.slice(), tS: S.tS.slice(), cap: S.cap, head: S.head, count: S.count }; } };
  const T0 = C.GEN_OCC.trigG;
  for (const tg of [T0, 1.5]) {
    C.GEN_OCC.trigG = tg; keep = null; trig = tg;
    try {
      if (c.kind === 'trunk') L.atTrunk(k, Object.assign({}, c.o, { onFrame }));
      else { const s473 = L.far473(k), dd = L.defOf(k); L.hardLanding(k, Object.assign({}, c.o, { sink: c.o.k473 * s473, fwd: dd.params.gen.VsFlap || dd.params.gen.Vs, onFrame })); }
    } finally { C.GEN_OCC.trigG = T0; }
    if (keep && L.lastRun.sim.damage().occ) break;
  }
  const sim = L.lastRun.sim, O = sim.occupants(), R = sim.damage().occ;
  if (!keep || !R) { console.log(k, id, 'no record'); continue; }
  const W = 980, H = 300, PAD = 46;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${(H + 40) * O.spec.seats.length + 30}" font-family="sans-serif" font-size="11"><rect width="100%" height="100%" fill="#fff"/>`;
  svg += `<text x="10" y="18" font-weight="bold">${L.BUILDS[k].label} - ${c.label}: the seat's specific force in its own frame (CFC 60), g - EVIDENCE ONLY${trig !== T0 ? ' (no event at the game\'s trigger: recorded at 1.5 g, a test setting)' : ''}</text>`;
  O.spec.seats.forEach((o, si) => {
    const sr = C.genOccSeries(O.spec, keep, si), ax = C.genOccCFC(Float64Array.from(sr.ax), sr.dt, 60), ay = C.genOccCFC(Float64Array.from(sr.ay), sr.dt, 60), az = C.genOccCFC(Float64Array.from(sr.az), sr.dt, 60);
    const s = R.seats[si], J = s.crit, y0 = 30 + si * (H + 40);
    let lo = -2, hi = 2; for (const a of [ax, ay, az]) for (let i = 0; i < a.length; i++) { lo = Math.min(lo, a[i]); hi = Math.max(hi, a[i]); }
    const X = i => PAD + (W - PAD - 10) * i / Math.max(1, sr.N - 1), Y = g => y0 + 20 + (H - 40) * (1 - (g - lo) / (hi - lo));
    svg += `<text x="10" y="${y0 + 12}">${s.name}: ${C.GEN_OCC.bands[s.band]} (by ${J.by || '-'}) - DRI ${J.dri.toFixed(1)}, Eiband x ${J.eibX.vol.toFixed(2)}/${J.eibX.mod.toFixed(2)} y ${J.eibY.vol.toFixed(2)}/${J.eibY.mod.toFixed(2)}, peaks x ${J.xPk.toFixed(1)} y ${J.yPk.toFixed(1)} z ${J.zPk.toFixed(1)} g, dV x ${J.dvX.toFixed(1)} z ${J.dvZ.toFixed(1)} m/s, space ${J.space == null ? '-' : J.space.toFixed(2)}, cell x${(J.cell || 1).toFixed(2)}</text>`;
    svg += `<line x1="${PAD}" x2="${W - 10}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}" stroke="#bbb"/>`;
    for (const g of [lo, hi]) svg += `<text x="4" y="${(Y(g) + 4).toFixed(1)}" fill="#888">${g.toFixed(0)}</text>`;
    svg += `<text x="${W - 120}" y="${y0 + 30}" fill="#888">${(sr.N * sr.dt).toFixed(2)} s from ${sr.t0.toFixed(2)} s</text>`;
    [[ax, '#c0392b', 'x fwd'], [ay, '#2e6db4', 'y lat'], [az, '#16a085', 'z spinal']].forEach(([a, col, nm], q) => {
      let d = ''; const step = Math.max(1, Math.floor(sr.N / 1500));
      for (let i = 0; i < sr.N; i += step) d += (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(a[i]).toFixed(1);
      svg += `<path d="${d}" fill="none" stroke="${col}" stroke-width="1"/><text x="${PAD + 10 + q * 80}" y="${y0 + 30}" fill="${col}">${nm}</text>`;
    });
    all.push({ build: k, case: id, trigG: trig, seat: s.name, band: C.GEN_OCC.bands[s.band], by: J.by, dri: +J.dri.toFixed(2), eibX: J.eibX, eibY: J.eibY, xPk: +J.xPk.toFixed(1), yPk: +J.yPk.toFixed(1), zPk: +J.zPk.toFixed(1),
      dvX: +J.dvX.toFixed(2), dvZ: +J.dvZ.toFixed(2), far562: J.far562, restraint: J.restraint, space: J.space, cell: J.cell, parted: J.parted, rows: J.rows });
  });
  svg += '</svg>';
  fs.writeFileSync(path.join(OUT, 'pulse_' + k + '_' + id + '.svg'), svg);
  console.log(k, id, R.seats.map(s => s.name + ' ' + C.GEN_OCC.bands[s.band]).join(', '));
}
fs.writeFileSync(path.join(OUT, 'pulses.json'), JSON.stringify(all, null, 1));
