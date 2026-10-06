// G1883-G1884 (DMG-WINDBREAK): the 3 m/s taxi into a trunk IN A WIND, node only - what GATE DMGWIND
// (_dmg_wind_check.js) and its evidence (dmg_windbreak_evidence.js) fly.
// DMG-D4b measured on the box (reports/evidence/DMG-D4b/taxi_parity_cub.json): the page's Cub, staged at its stand
// (settled 2 s, then 3 m/s with the throttle shut at a trunk 6 m ahead), broke its whole engine mount with the page's
// wind (~5.5 m/s, the climate's gust field) and nothing without it. The staging here is that one, on node's flat world
// (_treecrash_lib.atTrunk): the wind blows through the settle and the roll as it did on the page.
//   windVec(U, th)       a steady wind of U m/s FROM th deg off the nose (0 ahead, 90 the right, 180 behind), on
//                        node's strip (HOME, heading pi)
//   PAGE_WIND            the page's own vector (D4b's log, sim.t 2.0), turned from its strip's heading onto node's
//   gustField(w, gust)   the climate's legacy field (09_climate.js: base x the surface layer's power law + the four
//                        gust sines at sim.t) over the flat world, its base set so it blows `w` 1 m over the CG at rest
//   taxi(key, o)         one run: o.D (m to the trunk), o.wind (a vector or a field), o.off (the trunk across), o.trace
//                        (per substep: every mount member's force over its limit, the trunks' push on the engine's
//                        nodes, the CG's speed) -> what broke, the mount's peak over its limits, the impact speed
'use strict';
const L = require('./_treecrash_lib.js');

const HDG = Math.PI;                      // node's HOME strip (flatWorld): the nose along -x
const ELEV = 300;                         // atTrunk's flat world
function windVec(U, th) {
  if (!U) return null;
  const fx = Math.cos(HDG), fz = Math.sin(HDG), rx = -fz, rz = fx;      // the nose's way, and its right (body +z is the left)
  const c = Math.cos(th * Math.PI / 180), s = Math.sin(th * Math.PI / 180);
  return [-U * (c * fx + s * rx), 0, -U * (c * fz + s * rz)];          // FROM th: the air moves the other way
}
// the page's: [4.883, -0.005, -2.495] at its strip's heading 0.7156 (taxi_parity_cub.json, runs.staged.start) - 2.05 m/s
// along the nose's way (from behind) and 5.09 m/s across, 5.49 m/s in all
const PAGE = { hdg: 0.7156, w: [4.883188006623665, -0.005345044161147237, -2.4947388679332962] };
const PAGE_WIND = (() => {
  const fp = [Math.cos(PAGE.hdg), Math.sin(PAGE.hdg)], w = PAGE.w;
  const along = w[0] * fp[0] + w[2] * fp[1], side = -w[0] * fp[1] + w[2] * fp[0];
  const fx = Math.cos(HDG), fz = Math.sin(HDG);
  return [along * fx - side * fz, w[1], along * fz + side * fx];
})();
const pageFrom = () => { const w = PAGE_WIND, fx = Math.cos(HDG), fz = Math.sin(HDG);
  const along = -(w[0] * fx + w[2] * fz), right = -(w[0] * -fz + w[2] * fx);
  return { U: Math.hypot(w[0], w[2]), th: ((Math.atan2(right, along) * 180 / Math.PI) + 360) % 360 }; };
// the climate's own field (the page's source), flat ground at ELEV: refH 10 m, the grass's alpha, `gust` (the field's
// amplitude: the weather panel's 0..1), its base scaled so the column 1 m over the parked Cub's CG reads `w`
function gustField(w, gust) {
  const C = L.core(), K = C.CLIMATE.make({ terrainH: () => ELEV, bounds: { x0: -2e4, z0: -2e4, x1: 2e4, z1: 2e4 } });
  const k = Math.pow(1.48 / 10, C.CLIMATE.WIND_ALPHA);                 // the Cub's CG + 1 m, over the ground
  K.setWind({ base: [w[0] / k, w[1] / k, w[2] / k], gust: gust || 0, refH: 10 });
  return K.wind;
}
// the engine mount: the members that break an engine's mount group (its type 0: the bearer's tubes, which ARE its
// bolts in the lattice - D1a's fittings); a pair's own link it only takes along (type 1: a Jodel's flange bar) is not one
const mountOf = (def) => {
  const G = (def.parts && def.parts.dmg && def.parts.dmg.groups) || [];
  const s = new Set(); for (const g of G) if (/:mount$/.test(g.key)) for (const j of g.t0) s.add(j);
  return [...s];
};
const tagOf = def => i => def.nodes[i].tag || String(i);
const nameOf = (def, b) => { const tg = tagOf(def); return tg(b.a) + '-' + tg(b.b); };

function taxi(key, o) {
  o = o || {};
  const D = o.D || 6, V = o.V || 3;
  let def = null, mount = null, caps = null, peak = 0, peakAt = null, peakWho = null, vLast = 0, vImp = null, tHit = null, push = null;
  const engN = [], trace = o.trace ? [] : null;
  const r = L.atTrunk(key, { D, V, thr: 0, secs: o.secs || 3, cert: true, wind: o.wind || null, off: o.off || 0,
    onStart: (sim, d) => {
      def = d; mount = mountOf(d); caps = sim.damageCaps ? sim.damageCaps() : null;
      for (const i of (d.refs.engine || [])) engN.push(i);
      { const cg = d.nodes.findIndex(n => n.tag === 'CGE'); if (cg >= 0) engN.push(cg); }
      if (o.trace && sim.damagePush) push = sim.damagePush(true);
      if (caps && sim.damageCaps) sim.onSubstep = () => {
        const p = sim.p, B = sim.beams;
        let mx = 0, who = -1; const row = trace ? { t: sim.t, m: [], push: 0, v: 0 } : null;
        for (const bi of mount) {
          const b = B[bi]; if (b.broken) { if (row) row.m.push(null); continue; }
          const ia = b.a * 3, ib = b.b * 3, Lb = Math.hypot(p[ib] - p[ia], p[ib+1] - p[ia+1], p[ib+2] - p[ia+2]);
          const Fs = b.k * (Lb - b.L0), q = Fs > 0 ? Fs / caps.FY[bi] : -Fs / caps.FC[bi];
          if (q > mx) { mx = q; who = bi; }
          if (row) row.m.push(+q.toFixed(4) * (Fs < 0 ? -1 : 1));
        }
        if (mx > peak) { peak = mx; peakAt = sim.t; peakWho = who; }
        if (row) {
          if (push) { let s = 0; for (const i of engN) s += push[i]; row.push = Math.round(s); push.fill(0); }
          const v = sim.cgVel(); row.v = +(v[0] * Math.cos(HDG) + v[2] * Math.sin(HDG)).toFixed(4);
          trace.push(row);
        }
      };
    },
    onFrame: (sim) => {
      const v = sim.cgVel(), Va = v[0] * Math.cos(HDG) + v[2] * Math.sin(HDG);
      if (vImp === null && sim.trunkHits() > 0) { vImp = vLast; tHit = sim.t; }
      vLast = Va;
    } });
  const sim = r.sim, Dm = sim.damage(), B = sim.beams, mset = new Set(mount);
  const fb = Dm.firstBreak;
  const out = {
    key, D, off: o.off || 0, hit: r.hits > 0, vImp, tHit, crashed: Dm.crashed, reason: Dm.reason,
    broken: Dm.broken.length, mountBroken: Dm.broken.filter(i => mset.has(i)).length, work: Dm.work, dents: Dm.dents,
    first: fb ? { who: nameOf(def, B[fb.beam]), how: fb.how, seam: fb.seam, t: fb.t, mount: mset.has(fb.beam) } : null,
    groups: (Dm.groups || []).map(g => g.key), mountOff: (Dm.groups || []).some(g => /:mount$/.test(g.key)),
    peak, peakAt, peakWho: peakWho >= 0 && peakWho !== null ? nameOf(def, B[peakWho]) : null,
    hash: r.hash, finite: r.finite, propStrike: Dm.propStrike,
  };
  if (trace) { out.trace = trace; out.mountNames = mount.map(bi => nameOf(def, B[bi])); out.mountLim = mount.map(bi => [caps.FY[bi], caps.FC[bi]]); }
  return out;
}
module.exports = { L, HDG, ELEV, windVec, PAGE_WIND, pageFrom, gustField, taxi, mountOf };
