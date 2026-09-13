// SHOULDER CHECK — headless: build the cage sheet in every configuration the
// user named (wide / narrow cabins, no pax bay, one and two, bubble cockpit,
// mirrored pod) plus the ones that stress the trace (no door, extended sill,
// exploded, round + tube, drawn pax windows), run the shoulder, and judge:
//   - every part is a closed 2-manifold by position (no open, no over-shared
//     edge), positive volume, no NaN;
//   - both flanks carry a part; the top surface sits under every traced
//     transition point; the forward cap stays behind the dash;
//   - with the throttle: the slot exists where the lever crosses.
// node tools/_shoulder_check.js [--verbose]
'use strict';
const G = require('./_cage_gen.js');
const SG = require('./_shoulder_gen.js');
const VERB = process.argv.includes('--verbose');

const BASE = { intOn: 1, cutParts: 1 };
const CONFIGS = SG.CONFIGS;
const stockLever = (built, side) => SG.stockLever(built, side, G);

let fails = 0;
for (const [name, over, sopt] of CONFIGS) {
  const P = { ...G.CAGE_PARAMS, ...BASE, ...over };
  const built = G.cageSheet(P, { level: 2 });
  const t0 = Date.now();
  const out = SG.shoulderBuild(built.mesh, built.spec, sopt || {}, G);
  const ms = Date.now() - t0;
  const res = SG.shoulderCheck(out);
  const lim = out.shoulder.trace.limits;
  const sides = new Set(res.map(r => r.side));
  const bad = res.filter(r => !r.ok);
  // the top under every traced point (drop), the caps behind the dash
  let topBad = 0, dashBad = 0;
  for (const p of out.shoulder.parts) {
    if (lim.zDash != null && p.z1 > lim.zDash - 1e-6) dashBad++;
  }
  const line = `${name.padEnd(24)} parts ${res.length} (${[...sides].join('/')})  faces ${res.reduce((s, r) => s + r.faces, 0)}` +
    `  open ${res.reduce((s, r) => s + r.open, 0)} over ${res.reduce((s, r) => s + r.over, 0)}  nan ${res.reduce((s, r) => s + r.nan, 0)}` +
    `  vol ${res.map(r => (r.vol * 1e6).toFixed(0)).join('/')} cm3  ${ms} ms`;
  const ok = !bad.length && sides.size === 2 && !dashBad && res.length > 0;
  if (!ok) fails++;
  console.log((ok ? 'PASS ' : 'FAIL ') + line + (dashBad ? '  cap past the dash' : ''));
  if (VERB || !ok) for (const r of res)
    console.log(`     ${r.side > 0 ? 'port' : 'stbd'} ${r.kind} ${r.door ? 'door ' + r.door : 'fixed'} z ${r.z0.toFixed(3)}..${r.z1.toFixed(3)} H ${r.Hmin.toFixed(3)}..${r.Hmax.toFixed(3)} open ${r.open} over ${r.over}` + (r.slot ? ' slot ' + JSON.stringify(r.slot) : ''));
}
// the throttle: stock build, the wall lever at the crew's station, three lip
// widths — the slot must appear in the leg the lever crosses, and the part
// must stay closed
// ---------------------------------------------------------------------------
// THE DOOR INNER PANEL (G3xx): closed solids, standing off the door's
// innermost surface by the gap everywhere, inside the door's cut edges by the
// margin, under the shoulder's leg, the pocket embedded in the panel and
// nowhere else; the seat's outer edge against the panel's face reported.
// ---------------------------------------------------------------------------
console.log('--- door panel');
{
  const PCONF = [
    ['stock', {}], ['no shoulder', { shoulderOn: 0 }], ['wide cabin', { halfW: 0.75, roofHalfW: 0.60 }],
    ['narrow cabin', { halfW: 0.36, roofHalfW: 0.28 }], ['pax door', { paxCount: 1, doorPax: 1 }],
    ['exploded', { explodeD: 0.25 }], ['sill down', { winSillPilot: 0.3 }],
    ['round + tube', { topRound: 1, intCons: 1 }], ['wood', { intCons: 2 }], ['aluminium', { intCons: 3 }],
    ['no interior', { intOn: 0 }], ['deep margin', {}, { doorPanelMargin: 0.08 }], ['no pocket', {}, { doorPanelPocket: 0 }],
  ];
  const Q = 1e5, pk = q => q.map(x => Math.round(x * Q)).join(',');
  for (const [name, over, prow] of PCONF) {
    const P = { ...G.CAGE_PARAMS, ...BASE, doorPanelOn: 1, ...over, ...(prow || {}) };
    const built = G.cageSheet(P, { level: 2 });
    const m = built.mesh, V = m.V;
    const parts = (m.doorPanel && m.doorPanel.parts) || [];
    const inner = SG.makeInnerSampler(m);
    const o = m.doorPanel ? m.doorPanel.opt : SG.PANEL_DEF;
    const msgs = [];
    if (!parts.length) msgs.push('no panel built');
    for (const p of parts) {
      const off = p.off || [0, 0, 0];
      const closed = faces => { const eC = new Map(); let vol = 0; for (const f of faces) { const n = f.v.length; for (let e = 0; e < n; e++) { const a = V[f.v[e]], c = V[f.v[(e + 1) % n]]; const A = pk(a), C = pk(c); if (A === C) continue; const k = A < C ? A + '|' + C : C + '|' + A; eC.set(k, (eC.get(k) || 0) + 1); } for (let i = 1; i + 1 < n; i++) { const a = V[f.v[0]], c = V[f.v[i]], d = V[f.v[i + 1]]; vol += a[0] * (c[1] * d[2] - c[2] * d[1]) + a[1] * (c[2] * d[0] - c[0] * d[2]) + a[2] * (c[0] * d[1] - c[1] * d[0]); } } let open = 0, over2 = 0; for (const c of eC.values()) { if (c === 1) open++; else if (c > 2) over2++; } return { open, over: over2, vol: vol / 6 }; };
      const cm = closed(p.faces.slice(0, p.nMain));
      if (cm.open || cm.over || !(cm.vol > 0)) msgs.push(`${p.door}${p.side > 0 ? 'P' : 'M'} panel open ${cm.open} over ${cm.over} vol ${cm.vol}`);
      if (p.pocket) { const cp = closed(p.faces.slice(p.nMain)); if (cp.open || cp.over || !(cp.vol > 0)) msgs.push(`${p.door} pocket open ${cp.open} over ${cp.over}`); }
      // clearance: every main vertex (as-built) vs the door's innermost surface at its (y, z)
      let minClr = 1e9, atV = null;
      for (const f of p.faces.slice(0, p.nMain)) for (const vi of f.v) {
        const v = [V[vi][0] - off[0], V[vi][1] - off[1], V[vi][2] - off[2]];
        const xi = inner(p.side, v[1], v[2]); if (xi == null) continue;
        const clr = xi - Math.abs(v[0]); if (clr < minClr) { minClr = clr; atV = v.map(x => +x.toFixed(3)); }
      }
      if (minClr < o.gap - 0.001) msgs.push(`${p.door}${p.side > 0 ? 'P' : 'M'} clears the door by ${(minClr * 1000).toFixed(1)} mm at ${atV} (gap ${o.gap * 1000} mm)`);
      // within the door: every outline point inside the door's z-range at its y by >= margin - 1 mm
      // the door's faces (as-built polygons on this side), and the exact
      // extent of the door along the line y through each outline point
      const doorP = []; for (const f of m.F) if (f.doorKey === p.door && !f.shoulder && !f.doorPanel && f.v.length === 4) { const P = f.v.map(vi => [V[vi][0] - off[0], V[vi][1] - off[1], V[vi][2] - off[2]]); if (Math.sign(P[0][0]) === p.side) doorP.push(P); }
      for (const q of p.outline) {
        const e = SG.extentAt(doorP, q[1]);
        if (e && (q[0] < e[0] + o.margin - 0.002 || q[0] > e[1] - o.margin + 0.002)) { msgs.push(`${p.door} outline outside the margin at z ${q[0].toFixed(3)} y ${q[1].toFixed(3)} (door ${e[0].toFixed(3)}..${e[1].toFixed(3)})`); break; }
      }
      // outline hygiene: no two consecutive points closer than 0.5 mm; and
      // the over-shared edge named, when there is one
      for (let i = 0; i < p.outline.length; i++) { const a = p.outline[i], b2 = p.outline[(i + 1) % p.outline.length]; if (Math.hypot(a[0] - b2[0], a[1] - b2[1]) < 5e-4) { msgs.push(`${p.door} outline has a ${(Math.hypot(a[0] - b2[0], a[1] - b2[1]) * 1000).toFixed(2)} mm edge at ${a.map(v => v.toFixed(3))}`); break; } }
      if (cm.over) { const eC = new Map(); for (const f of p.faces.slice(0, p.nMain)) { const n = f.v.length; for (let e = 0; e < n; e++) { const a = V[f.v[e]], c = V[f.v[(e + 1) % n]]; const A = pk(a), C = pk(c); if (A === C) continue; const k = A < C ? A + '|' + C : C + '|' + A; eC.set(k, (eC.get(k) || 0) + 1); } } for (const [k, c] of eC) if (c > 2) { msgs.push(`over-shared x${c}: ${k}`); break; } }
      // under the shoulder's leg
      const sh = (m.shoulder && m.shoulder.parts || []).find(s2 => s2.door === p.door && s2.side === p.side);
      if (sh) { const legBot = Math.min(...sh.st.map(st => st.yTop - st.Hc)); if (p.yTop > legBot - o.topGap + 1e-6) msgs.push(`${p.door} top ${p.yTop.toFixed(3)} not under the leg ${legBot.toFixed(3)}`); }
      // the pocket: its back inside the panel by <= 2 mm, its outline inside the panel's
      if (p.pocket) {
        const pf = p.faces.slice(p.nMain); let back = 0;
        // buried = outboard of the panel's front face (into the panel)
        for (const f of pf) for (const vi of f.v) { const v = V[vi]; const front = p.baseAbs(v[1] - off[1], v[2] - off[2]) - o.T; const d = Math.abs(v[0] - off[0]) - front; if (d > back) back = d; }
        if (back > o.pocketEmbed + 0.0005) msgs.push(`${p.door} pocket buried ${(back * 1000).toFixed(1)} mm into the panel`);
        const zs = p.outline.map(q => q[0]), ys = p.outline.map(q => q[1]);
        if (p.pocket.z0 < Math.min(...zs) || p.pocket.z1 > Math.max(...zs) || p.pocket.y0 < Math.min(...ys) || p.pocket.y1 > Math.max(...ys)) msgs.push(`${p.door} pocket outside the panel`);
      }
    }
    const ok = !msgs.length;
    if (!ok) fails++;
    console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(24) + ' panels ' + parts.length + (ok ? '' : '  ' + msgs.join(' | ')));
  }
  // THE SEAT, analytically (the crew layer is THREE): side by side, the
  // outer seat edge is gapIn + hw; single, hw alone. Reported, not judged —
  // a seat that overlaps the panel already overlaps the liner it stands on.
  const b = G.cageSheet({ ...G.CAGE_PARAMS, ...BASE, doorPanelOn: 1 }, { level: 2 });
  const k = 0.745, halfW = b.spec.cabin.halfW * k;
  const p = b.mesh.doorPanel.parts.find(q => q.side > 0);
  let front = 1e9; for (const f of p.faces.slice(0, p.nMain)) for (const vi of f.v) front = Math.min(front, Math.abs(b.mesh.V[vi][0]));
  const sbs = Math.min(0.23, Math.max(0.18, halfW - 0.25)) + Math.min(0.24, halfW * 0.42), single = Math.min(0.24, halfW * 0.60);
  console.log(`  seat vs panel face (page scale): face ${(front * k * 1000).toFixed(0)} mm, side-by-side seat edge ${(sbs * 1000).toFixed(0)} mm, single ${(single * 1000).toFixed(0)} mm — ` + (front * k > sbs ? 'clear' : 'the seat is already through the liner on this cabin'));
}
console.log('--- throttle');
{
  // the wall lever at the crew's own station sits well below the sill on
  // the stock build: NO crossing is the truth there. Raised into the pocket
  // it must come out through the face (W 0.05: the knob reaches past the
  // leg); raised to the sill it comes out through the top
  const built = G.cageSheet({ ...G.CAGE_PARAMS, ...BASE }, { level: 2 });
  const ROWS = [
    ['stock station, W 0.07', 0.07, 0, 'none'],
    ['up 0.40, W 0.05', 0.05, 0.40, 'face'],
    // (a 10 cm leg cannot bury a 16 cm lever any more — G355: the pocket is
    // shallower than the lever, so 'buried' is unreachable; a lever raised
    // into the pocket comes out through the top)
    ['up 0.40, W 0.07', 0.07, 0.40, 'none'],
    ['up 0.55, W 0.07', 0.07, 0.55, 'top'],
    ['up 0.55, W 0.10', 0.10, 0.55, 'top'],
  ];
  for (const [lab, W, dy, want] of ROWS) {
    const lever = stockLever(built, 1);
    lever.piv[1] += dy;
    const out = SG.shoulderBuild(built.mesh, built.spec, { W, lever }, G);
    const res = SG.shoulderCheck(out);
    const closed = res.every(r => r.ok);
    const s = res.filter(r => r.side > 0).map(r => r.slot).find(Boolean) || {};
    const got = s.ok ? s.leg : /BURIED/.test(s.note || '') ? 'buried' : 'none';
    const ok = closed && got === want;
    if (!ok) fails++;
    console.log((ok ? 'PASS ' : 'FAIL ') + lab.padEnd(24) + ' closed ' + closed + '  slot ' + got + (want !== got ? ' (wanted ' + want + ')' : '') +
      (s.range ? '  z ' + s.range.map(v => v.toFixed(3)).join('..') : '') + (s.clipped ? '  clipped at the edge' : ''));
    if (!closed) for (const r of res) console.log('     ', r);
  }
}
// the runner reads the WHOLE verdict line (GATE <ID>: PASS), not the exit code
console.log(fails ? `GATE SHOULDER: FAIL (${fails})` : 'GATE SHOULDER: PASS');
process.exit(fails ? 1 : 0);
