#!/usr/bin/env node
// tank_bay_probe.js - WHAT A BODY BAY REALLY HOLDS (G1109/G1152, CUB-COCKPIT 2026-10-01)
//
// A0's doubt, before any capacity cut: the J-3 carries 12 US gal (45 L) in
// exactly the Cub's nose bay - high, above the pilot's feet, the firewall
// ahead and the panel aft - so if our search finds 16 L, suspect the SHAPES
// (a box or a cylinder cannot fill a curved deck) or the crew's envelope
// before the bay. This measures the bay itself, as the game builds it (the
// joined card, the crew layer loaded), on a grid in the energy layer's frame:
//   per station z in the bay (firewall .. panel) and lateral x:
//     yTop    the deck's inner surface (the sheet, first hit going up from
//             the bay's band floor), less the 35 mm wall the fit keeps
//     yCrew   the crew's highest point in that column (feet, pedals, seat)
//     yDash   the dash's lowest point in that column, if the dash is there
//   and the room between max(yCrew + 20 mm, band floor) and the top (under
//   the dash less 20 mm where the dash is).
// THE DECK FORM (G1152): the largest STRAIGHT tank - one section along its
// length, centred on the centreline (a symmetric run of columns), a flat floor
// at the highest floor among them and a top following each column's lowest
// ceiling over the run of stations - with the run, the floor and the column
// tops it was cut from, so tank_refit can build that deck tank and ask the
// layer's own fit.
//
//   measureBay({ W, THREE, r, res, bay })   (r = sceneBuild's result, res = the vessel's placement)
//   node tools/tank_bay_probe.js --only cub [--bay nose] [--json out.json]
'use strict';
const fs = require('fs');
const path = require('path');
const WALL = 0.035, MARGIN = 0.02, NZ = 12, NX = 16;

function measureBay(env) {
  const { W, THREE, r, res, bay } = env;
  const sec = res && res.section, c0 = res && res.c;
  if (!bay || !sec || !c0) return null;
  const FS = r.FS;
  const along0 = res.along != null ? res.along : 0;
  const zOf = along => c0[2] - (along - along0);
  const alongOf = z => along0 + (c0[2] - z);
  const z0 = zOf(bay.x1), z1 = zOf(bay.x0);               // aft (panel side) .. forward (firewall side)
  // the sheet as a raycast mesh, split: dash faces apart
  const M = r.built.sheet, posAll = [], posDash = [];
  for (const f of M.F) { const v = f.v; if (!v || v.length < 3) continue;
    const dst = (f.m === 'dash' || f.m === 'dashFace') ? posDash : posAll;
    for (let i = 1; i + 1 < v.length; i++) for (const k of [v[0], v[i], v[i + 1]]) { const q = M.V[k]; dst.push(q[0] * FS, q[1] * FS, q[2] * FS); } }
  const meshOf = pos => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); m.updateMatrixWorld(true); return m; };
  const skin = meshOf(posAll), dash = meshOf(posDash);
  const crew = []; const V = new THREE.Vector3();
  for (const ch of r.scene.children) if (ch.name === 'cageLayer:crew') ch.traverse(o => { if (!o.isMesh) return; const P = o.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) { V.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); crew.push([V.x, V.y, V.z]); } });
  // the ENGINE's and the COWL's vertices: a radial's accessories reach back into
  // a nose bay (the Stearman-alike's deck tank met 400-700 of them)
  const obst = [];
  for (const ch of r.scene.children) if (ch.name === 'cageLayer:eng' || ch.name === 'cageLayer:cowl') ch.traverse(o => { if (!o.isMesh || o.visible === false) return; const P = o.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) { V.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); obst.push([V.x, V.y, V.z]); } });
  // THE FIT'S OWN WALLS: the bay's inset sections (BAY_SITE.bayProfile at the
  // fit's 35 mm wall), per station - a column's room is also the section's
  // vertical extent at its x, so a tank's lower corners do not stand in the
  // wall where the fuselage narrows (the rays alone measured the ceiling only)
  const B = W.BAY_SITE, wallU = WALL / FS;
  let profs = [];
  if (B && B.bayProfile && res.samples && res.samples.length) {
    const sLs = res.samples.map(q => q[2]).filter(v => isFinite(v) && Math.abs(v) < 1e5);
    const lo = Math.min(...sLs), hi = Math.max(...sLs), span = hi - lo, pad = Math.max(0.05 / FS, span);
    try { profs = (B.bayProfile(M, lo - pad, hi + pad, wallU, 24) || []).filter(q => q && q.poly && q.poly.length >= 3); } catch (e) { profs = []; }
  }
  const extentAt = (x, z) => {
    if (!profs.length) return null;
    let best = null, bd = Infinity;
    for (const q of profs) { const d = Math.abs(q.z * FS - z); if (d < bd) { bd = d; best = q; } }
    const xu = x / FS, P = best.poly; let y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      if ((a[0] - xu) * (b[0] - xu) > 0 || a[0] === b[0]) continue;
      const y = a[1] + (b[1] - a[1]) * (xu - a[0]) / (b[0] - a[0]);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    return isFinite(y0) ? [y0 * FS, y1 * FS] : [Infinity, -Infinity];
  };
  const rc = new THREE.Raycaster();
  // the columns, symmetric about the centreline
  const half = Math.max(Math.abs(sec.xLo), Math.abs(sec.xHi)), dx = 2 * half / NX;
  const floor0 = sec.band[0];
  let litres = 0; const rows = [];
  for (let iz = 0; iz < NZ; iz++) {
    const z = z0 + (z1 - z0) * (iz + 0.5) / NZ, dz = (z1 - z0) / NZ;
    let rowL = 0; const cols = [];
    for (let ix = 0; ix < NX; ix++) {
      const x = -half + dx * (ix + 0.5);
      // the CEILING is the lowest of a 3 x 3 grid of rays over the cell - one
      // ray at its centre slipped between frame tubes the tank then met
      let yTop = Infinity, miss = false;
      for (const fx of [-1 / 3, 0, 1 / 3]) for (const fz of [-1 / 3, 0, 1 / 3]) {
        rc.set(new THREE.Vector3(x + fx * dx, floor0, z + fz * dz), new THREE.Vector3(0, 1, 0)); rc.far = 3;
        const up = rc.intersectObject(skin, false);
        if (!up.length) { miss = true; break; }
        yTop = Math.min(yTop, up[0].point.y - WALL);
      }
      if (miss || !isFinite(yTop)) { cols.push(null); continue; }
      let yCrew = -Infinity;
      for (const p of crew) if (Math.abs(p[0] - x) <= dx / 2 && Math.abs(p[2] - z) <= dz / 2 && p[1] < yTop + 0.2 && p[1] > yCrew) yCrew = p[1];
      rc.set(new THREE.Vector3(x, floor0, z), new THREE.Vector3(0, 1, 0));
      const dh = rc.intersectObject(dash, false).filter(h => h.point.y < yTop + WALL);
      let yLo = Math.max(floor0, isFinite(yCrew) ? yCrew + MARGIN : floor0);
      let yHi = dh.length ? Math.min(yTop, dh[0].point.y - MARGIN) : yTop;
      // the section's own walls, at the cell's two flanks (its outer x is the tighter)
      for (const fx of [-0.5, 0.5]) {
        const ex = extentAt(x + fx * dx, z);
        if (ex) { yLo = Math.max(yLo, ex[0]); yHi = Math.min(yHi, ex[1]); }
      }
      // an engine / cowl point in the cell's room: in its upper half it lowers
      // the ceiling, in its lower half it raises the floor
      for (const q of obst) {
        if (Math.abs(q[0] - x) > dx / 2 || Math.abs(q[2] - z) > dz / 2 || q[1] < yLo - MARGIN || q[1] > yHi + MARGIN) continue;
        if (q[1] > 0.5 * (yLo + yHi)) yHi = Math.min(yHi, q[1] - MARGIN); else yLo = Math.max(yLo, q[1] + MARGIN);
      }
      const h = Math.max(0, yHi - yLo);
      rowL += h * dx * dz * 1000;
      cols.push({ x: +x.toFixed(4), yTop: +yTop.toFixed(4), yCrew: isFinite(yCrew) ? +yCrew.toFixed(4) : null, yDash: dh.length ? +dh[0].point.y.toFixed(4) : null,
                  yLo: +yLo.toFixed(4), yHi: +yHi.toFixed(4), h: +h.toFixed(4) });
    }
    litres += rowL;
    rows.push({ z: +z.toFixed(4), litres: +rowL.toFixed(2), cols });
  }
  // the largest straight deck-following tank on a SYMMETRIC run of columns
  let prism = { litres: 0 };
  const dzr = Math.abs(rows.length > 1 ? rows[1].z - rows[0].z : 0.02);
  for (let a = 0; a < rows.length; a++) for (let b = a; b < rows.length; b++) {
    const room = [];
    for (let i = 0; i < NX; i++) {
      let hi = Infinity, lo = -Infinity, ok = true;
      for (let k = a; k <= b; k++) {
        const c = rows[k].cols[i];
        if (!c || !(c.h > 0)) { ok = false; break; }
        hi = Math.min(hi, c.yHi); lo = Math.max(lo, c.yLo);
      }
      room.push(ok && hi > lo ? [lo, hi] : null);
    }
    for (let m = 0; m < NX / 2; m++) {                   // columns m .. NX-1-m
      const i0 = m, i1 = NX - 1 - m;
      let ok = true, fl = -Infinity;
      for (let i = i0; i <= i1; i++) { if (!room[i]) { ok = false; break; } fl = Math.max(fl, room[i][0]); }
      if (!ok) continue;
      let area = 0; for (let i = i0; i <= i1; i++) area += Math.max(0, room[i][1] - fl) * dx;
      const L = (b - a + 1) * dzr, lit = area * L * 1000;
      if (lit > prism.litres) {
        // the column tops over the run, folded about the centreline (the lower of each pair)
        const tops = [];
        for (let i = i0; i <= i1; i++) tops.push(Math.min(room[i][1], room[NX - 1 - i][1]));
        prism = { litres: +lit.toFixed(1), fuel: +(lit * 0.94).toFixed(1), len: +L.toFixed(3), W: +((i1 - i0 + 1) * dx).toFixed(3), floor: +fl.toFixed(4),
                  zMid: +(0.5 * (rows[a].z + rows[b].z)).toFixed(4), along: +alongOf(0.5 * (rows[a].z + rows[b].z)).toFixed(4),
                  xs: rows[a].cols.slice(i0, i1 + 1).map(c => c.x), tops: tops.map(t => +t.toFixed(4)) };
      }
    }
  }
  return { rows, litres, prism, sec, bay: { key: bay.key, x0: bay.x0, x1: bay.x1 } };
}

// the deck tank a prism describes: dims (L along, W across, H), its profile
// (the top's height fraction from the centreline out, K samples), its station
// (along) and its centre height; `inset` metres off the top and the flanks
// `inset` off the flanks and the ends, `topInset` (default the same) off the top: the
// probe's ceiling (rays to the sheet, less the wall) stands 15-20 mm over the fit's own
// (the bay's inset section) at the crown, so the top is the dimension that gives
function deckFromPrism(prism, inset, K, topInset, endInset) {
  if (!prism || !(prism.litres > 0) || !prism.tops) return null;
  const d = inset || 0, n = K || 9, dt = topInset == null ? d : topInset, de = endInset == null ? d : endInset;
  const half = prism.W / 2 - d;
  if (!(half > 0.03)) return null;
  const xs = prism.xs, tops = prism.tops;
  // the half-profile: the columns at x >= 0 (tops already folded to the lower
  // of each symmetric pair), sorted outward; linear between column centres,
  // flat inside the innermost and beyond the outermost
  const halfCols = xs.map((x, i) => [Math.abs(x), tops[i]]).filter((q, i) => xs[i] >= 0).sort((p, q) => p[0] - q[0]);
  const topAt = x => {
    const ax = Math.abs(x), H = halfCols;
    if (!H.length) return Math.min(...tops) - d;
    if (ax <= H[0][0]) return H[0][1] - d;
    for (let i = 1; i < H.length; i++) if (ax <= H[i][0]) { const f = (ax - H[i - 1][0]) / Math.max(1e-9, H[i][0] - H[i - 1][0]); return H[i - 1][1] + (H[i][1] - H[i - 1][1]) * f - d; }
    return H[H.length - 1][1] - d;
  };
  const topAtT = x => topAt(x) + d - dt;
  const yTopC = topAtT(0), H = yTopC - prism.floor;
  if (!(H > 0.04)) return null;
  const profile = [];
  for (let k = 0; k < n; k++) profile.push(+Math.max(0, Math.min(1, (topAtT(half * k / (n - 1)) - prism.floor) / H)).toFixed(4));
  return { dims: { L: +(prism.len - 2 * de).toFixed(3), W: +(2 * half).toFixed(3), H: +H.toFixed(3), profile },
           along: prism.along, yc: prism.floor + H / 2, floor: prism.floor };
}

module.exports = { measureBay, deckFromPrism };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
  const key = opt('only', 'cub'), bayKey = opt('bay', 'nose');
  const T = __dirname;
  const SH = require(path.join(T, '_scene_headless.js'));
  for (const f of ['_bay_site.js', '_vessel_gen.js', '_vessel_mesh.js', '_cage_energy.js',
                   '_cage_crew.js', '_cage_char.js', '_panel_gen.js', '_cage_panel.js']) SH.EXCLUDE.delete(f);
  const BJ = require(path.join(T, '_bake_joined.js'));
  const { D, C } = BJ.loadPanel();
  const X = SH.context(); const W = X.ctx, THREE = X.THREE;
  SH.stubCanvas(); console.error = () => {};
  // the card's own tanks (G1109): seeded from its birth spec before the bake
  const card = D.ARCHETYPES.find(x => x.key === key);
  const birth = C.genNormaliseSpec(D.designBake(card.sel, card.over)); W.CAGE_ENERGY.fromSpec(birth.energy, birth);
  const spec = BJ.bakeCard(key).spec, def = C.buildGen(spec);
  W.CAGE_ENERGY.fromSpec(spec.energy, spec);
  const r = SH.sceneBuild(spec, { garage: spec, resolved: () => def.spec, inGame: true });
  const E = W.CAGE_ENERGY;
  const res = (E.results() || []).find(q => q.v && q.v.bay === bayKey) || (E.results() || [])[0];
  const bay = E.bays().find(b => b.key === bayKey);
  const m = measureBay({ W, THREE, r, res, bay });
  if (!m) { console.log('no bay / placement for ' + key + ' ' + bayKey); process.exit(1); }
  console.log(key + ' ' + bayKey + ': bay x ' + bay.x0.toFixed(3) + '..' + bay.x1.toFixed(3) + ' m (' + ((bay.x1 - bay.x0) * 1000).toFixed(0) + ' mm), band ' + m.sec.band.map(v => v.toFixed(3)).join('..'));
  for (const rw of m.rows) console.log('  z ' + rw.z.toFixed(3) + '  ' + rw.litres.toFixed(1) + ' L   h(mm) ' + rw.cols.map(c => c ? (c.h * 1000).toFixed(0) : '-').join(' '));
  console.log('  the columns hold ' + m.litres.toFixed(1) + ' L; the largest straight deck-following tank: ' + m.prism.litres + ' L gross (' + m.prism.fuel + ' L of fuel)');
  if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify({ key, bay: bayKey, rows: m.rows, litres: m.litres, prism: m.prism }, null, 1));
}
