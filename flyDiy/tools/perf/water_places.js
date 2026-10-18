// water_places.js - THE WATER'S PLACES, FOUND FROM THE TERRAIN (WATER-STEADY G2836, the ring study)
//
// Page-side JS (strings for Runtime.evaluate) shared by tools/perf/water_look.js and tools/frame_perf.js:
//   FIND        -> window.__WP = { nearLand, dock, seaward(P, D), lake, level(x, z) }: the water aerodrome nearest a shore
//                  ('dock'), a point D m from the nearest land walking out to sea from it, and a point ON a drawn lake (a
//                  level over the sea's, the terrain under it) with its shore near - water_shot's (-604, -1150) is an EYE
//                  point, not a lake: the P0 look's lake stills were taken under the terrain from it (17 Oct)
//   placeJS(kind, a, b) -> the aircraft held there, paused (frame_perf's place contract: returns JSON { at })
//     coast:<d>:<agl>  d m from land (seaward of the dock), agl m over the water (agl <= 0.5: afloat at the rest height)
//     lake:<agl>       on the lake point, agl m over its water
'use strict';
const FIND = `(() => {
  if (window.__WP) return 'have';
  const w = FLIGHT_PROBE.world(), WF = window.WORLD;
  const land = (x, z) => w.terrainH(x, z) > 0.5;
  const level = (x, z) => { const y = WF && WF.waterDrawY ? WF.waterDrawY(x, z) : null; return Number.isFinite(y) ? y : 0; };
  const nearLand = (x, z, R, isL) => { let best = null; const L = isL || land;
    for (let k = 0; k < 32; k++) { const a = k / 32 * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a);
      for (let r = 20; r <= R; r += 20) if (L(x + dx * r, z + dz * r)) { if (!best || r < best.r) best = { r, dx, dz }; break; } }
    return best; };
  const A = (w.aerodromes || []).filter(a => a.kind === 'water' && !land(a.x, a.z));
  let dock = null;
  for (const a of A) { const n = nearLand(a.x, a.z, 1500); if (n && (!dock || n.r < dock.n.r)) dock = { x: a.x, z: a.z, n, id: a.id }; }
  if (!dock) { for (let x = 2600; x < 4000 && !dock; x += 20) if (!land(x, 0)) { const n = nearLand(x + 60, 0, 1500); if (n) dock = { x: x + 60, z: 0, n, id: 'east coast' }; } }
  const seaward = (P, D) => { let x = P.x, z = P.z, n = P.n; for (let i = 0; i < 400; i++) { const m = nearLand(x, z, D + 40); if (!m || m.r >= D) return { x, z, n: m || n, r: m ? m.r : Infinity }; n = m; x -= m.dx * 20; z -= m.dz * 20; } return { x, z, n, r: NaN }; };
  // a DRAWN lake: its level over the sea's, the terrain at least 0.5 m under it, its shore within 400 m (a lake you can see the bank of)
  let lake = null;
  for (let r = 0; r <= 5000 && !lake; r += 40) for (let k = 0; k < (r ? 48 : 1) && !lake; k++) {
    const a = k / 48 * Math.PI * 2, x = -604 + Math.sin(a) * r, z = -1150 + Math.cos(a) * r;
    const y = WF && WF.waterDrawY ? WF.waterDrawY(x, z) : null;
    if (!(Number.isFinite(y) && y > 1.5 && w.terrainH(x, z) < y - 0.5)) continue;
    const n = nearLand(x, z, 400, (qx, qz) => w.terrainH(qx, qz) > y + 0.3);
    if (n && n.r >= 60) lake = { x, z, y, n };
  }
  window.__WP = { nearLand, dock, seaward, lake, level, land };
  return JSON.stringify({ dock: dock && { x: dock.x | 0, z: dock.z | 0, id: dock.id, shore: dock.n.r }, lake: lake && { x: lake.x | 0, z: lake.z | 0, y: +lake.y.toFixed(2), shore: lake.n.r } });
})()`;

// the CG's rest height over what it stands or floats on, read once at the roll-out (H0)
const REST = `(() => { if (window.__WP_H0 != null) return window.__WP_H0; const s = FLIGHT_PROBE.sim(), w = FLIGHT_PROBE.world(), c = s.cgPos();
  const wy = WORLD.waterDrawY ? WORLD.waterDrawY(c[0], c[2]) : null; const base = Math.max(w.terrainH(c[0], c[2]), Number.isFinite(wy) ? wy : -1e9);
  return (window.__WP_H0 = Math.max(0.5, c[1] - base)); })()`;

function placeJS(kind, a, b) {
  const pick = kind === 'lake' ? `const P = __WP.lake; if (!P) throw new Error('no drawn lake found'); const lvl = P.y; const agl = ${+a || 0};`
                               : `const P = __WP.seaward(__WP.dock, ${+a || 300}); const lvl = __WP.level(P.x, P.z); const agl = ${+b || 0};`;
  return `(async () => { ${FIND}; const H0 = ${REST};
    ${pick}
    const y = agl > 0.5 ? lvl + agl : lvl + H0 - 0.25;
    const b = document.getElementById('bPause'); if (b && /pause/i.test(b.textContent)) b.click();
    const s = FLIGHT_PROBE.sim(), c = s.cgPos();
    await FLIGHT_PROBE.place({ by: [P.x - c[0], y - c[1], P.z - c[2]], zeroV: true });
    return JSON.stringify({ at: [P.x | 0, +y.toFixed(1), P.z | 0], kind: '${kind}', shore: P.n ? P.n.r : null, land: P.r !== undefined ? P.r : null }); })()`;
}
module.exports = { FIND, REST, placeJS };
