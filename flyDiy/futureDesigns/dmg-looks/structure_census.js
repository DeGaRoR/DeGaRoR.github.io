// DMG-LOOKS brief 2 (node only, nothing in src/ touched): WHAT THE SOLVER DOES TO THE STRUCTURE, MEMBER BY MEMBER.
//
// Flies the treecrash rig's standard crashes (tools/_treecrash_lib.js STANDARD: the 3 m/s taxi into a trunk, the 12 m/s
// nose-over on a stump, the 30 m/s trunk on the centreline and 2.5 m out) on the user's three validated builds as the
// game flies them (tools/_load_build.js, with the certificate stamped: opts.cert), and reads every member at the end:
// its material row (GEN_CRASH: tubeFabric = 4130 steel tube, alloy = 2024 / 6061 sections, wood = spruce / ply), its
// section, its seam tag, its plastic set (L0 against Lr), the trunk bend (dk, kt1, the bend direction dTx/dTz/dNx/dNz),
// whether it kinked, and HOW it broke. The solver does not keep `how` per member (beamBreak(bi, how) books only the
// FIRST break's), so it is read back here from each member's state at the frame it broke:
//   kink    b.kink (compression past ecu: a floor at its crushed length)
//   fold    a trunk bend past thf (dk > 0)
//   ragged  wood's staged break (rgS > 0)
//   tension plastic stretch at etu, or a brittle member at its yield (ep >= etu - eps, or etu == 0 and ep == 0 and the set 0)
//   release none of those: its break group or its cluster let it go (G1894 / G1840) - it broke with no strain of its own
// Writes structure_census.json (per run: the members bent or broken, with their state)
// and prints the tables the HANDOVER entry carries.
//   node structure_census.js            (~2-4 min: three builds' join + certificate, cached by the rig after the first)
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
process.chdir(ROOT);
const L = require(path.join(ROOT, 'tools', '_treecrash_lib.js'));
const RUNS = ['taxi', 'noseover', 'trunk0', 'trunk25'];
const BUILDS = ['cub', 'jodel', 'metal'];

function run(key, id) {
  const sc = L.STANDARD[id].o, broke = new Map();
  const r = L.atTrunk(key, Object.assign({ cert: true }, sc, {
    onFrame: sim => {
      const D = sim.damage(); if (!D || D.broken.length === broke.size) return;
      for (const bi of D.broken) { if (broke.has(bi)) continue; const b = sim.beams[bi];
        const set = b.Lr > 0 ? (b.L0 - (b.ks || 0) - b.Lr) / b.Lr : 0;
        let how = 'release';
        if (b.kink) how = 'kink'; else if (b.dk > 0) how = 'fold'; else if (b.rgS > 0) how = 'ragged';
        else if ((b.etu > 0 && b.ep >= b.etu - 1e-9) || (!(b.etu > 0) && Math.abs(set) < 1e-4 && b.yielded !== false)) how = 'tension';
        broke.set(bi, { how, t: +sim.t.toFixed(3), set: +set.toFixed(4), dk: +(b.dk || 0).toFixed(4), ep: +(b.ep || 0).toFixed(4), ec: +(b.ec || 0).toFixed(4) }); }
    } }));
  const sim = r.sim, out = [];
  sim.beams.forEach((b, bi) => {
    const set = b.Lr > 0 ? (b.L0 - (b.ks || 0) - b.Lr) / b.Lr : 0, bent = Math.abs(set) > 1e-4 || b.dk > 0;
    if (!bent && !b.broken) return;
    const d = r.def.beams[bi];
    out.push({ bi, a: b.a, b: b.b, mat: d.mat, cls: d.cls, sec: d.sec, seam: d.seam || null, grp: d.grp, Lr: +b.Lr.toFixed(4),
      set: +set.toFixed(4), dk: +(b.dk || 0).toFixed(4), kt1: +(b.kt1 || 0).toFixed(3), dN: [+(b.dNx || 0).toFixed(3), +(b.dNz || 0).toFixed(3)],
      kink: !!b.kink, broken: !!b.broken, brk: broke.get(bi) || null });
  });
  return { key, id, label: L.STANDARD[id].label, nBeams: sim.beams.length, members: out, crashed: r.dmg.crashed, reason: r.dmg.reason };
}

const all = [];
for (const k of BUILDS) for (const id of RUNS) {
  const t0 = Date.now(), R = run(k, id); all.push(R);
  const br = R.members.filter(m => m.broken), bent = R.members.filter(m => !m.broken), hows = {};
  for (const m of br) { const h = m.mat + ':' + (m.brk ? m.brk.how : '?'); hows[h] = (hows[h] || 0) + 1; }
  console.log(`${k.padEnd(6)} ${id.padEnd(9)} bent ${String(bent.length).padStart(3)}  broken ${String(br.length).padStart(3)} / ${R.nBeams}  ${JSON.stringify(hows)}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
fs.writeFileSync(path.join(__dirname, 'structure_census.json'), JSON.stringify(all));
console.log('wrote structure_census.json');
