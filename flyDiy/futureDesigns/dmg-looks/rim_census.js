// DMG-LOOKS stretch (node only, nothing in src/ touched): WHAT THE P2 RIM OVERLAY (option B, the user's ruling) WOULD DRAW,
// counted on the real thing - the flown cage snapshot built headless and ridden by skin_break.js exactly as GATE DMGWALL
// rides it (tools/_dmg_wall_study.js prepare / run, the 'inh' binding), on the standard crashes. After the crash, per
// record (one snapshot group: a section or a colour, ~ one of the page's drawers):
//   dead   triangles removed by the event (dead 1: spans a break) or torn / cut (dead 2)
//   rim    live triangles within RIM_RINGS rings of a dead one (welded places: skin_break's rep) - the overlay's index
//   edge   the torn edge's length (m): edges of live triangles shared with a dead one
// and the overlay's cost: rim triangles in total, groups with any (each such group = one overlay draw, if the overlay
// is drawn per drawer), index bytes (Uint32), the per-place attribute (one float a rim place).
//   node rim_census.js [--builds cub,jodel,metal] [--cases trunk-0,trunk-2.5,noseover]   -> rim_census.txt
'use strict';
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..', '..');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const BUILDS = opt('builds', 'cub,jodel,metal').split(','), CASES = opt('cases', 'trunk-0,trunk-2.5,noseover').split(',');
// ONE BUILD A PROCESS (tools/_load_build.js, G1106.2: the editor's layers keep state across builds - a second build in
// the same process drew a different snapshot, measured: the metal Cessna 47 groups first, 55 third)
if (BUILDS.length > 1) {
  const { execFileSync } = require('child_process'), all = ['rim overlay census (rim = live triangles within 2 rings of a removed / torn one; one build a process)'];
  for (const b of BUILDS) { const o = execFileSync(process.execPath, [__filename, '--builds', b, '--cases', CASES.join(','), '--child', '1'], { encoding: 'utf8', maxBuffer: 1 << 26 });
    for (const l of o.split('\n')) if (/^(cub|jodel|metal|floats|twinFloats) /.test(l)) { all.push(l); console.log(l); } }
  fs.writeFileSync(path.join(__dirname, 'rim_census.txt'), all.join('\n') + '\n'); process.exit(0);
}
process.argv.push('--schemes', 'inh');                                  // the study reads its own argv: the inherited binding only
process.chdir(ROOT);
const SB = require(path.join(ROOT, 'src', 'viewer', 'skin_break.js'));
const WS = require(path.join(ROOT, 'tools', '_dmg_wall_study.js'));
const RIM_RINGS = 2;
let seen = null; const ev0 = SB.event;
SB.event = function (R) { if (seen) seen.add(R); return ev0.apply(this, arguments); };   // keep the records the run makes

const lines = [], log = s => { lines.push(s); console.log(s); };
log(`rim overlay census (rim = live triangles within ${RIM_RINGS} rings of a removed / torn one)`);
for (const k of BUILDS) {
  const P = WS.prepare(k);
  for (const cid of CASES) {
    seen = new Set(); const t0 = Date.now(); const r = WS.run(P, cid); const ms = Date.now() - t0;
    let dead = 0, rim = 0, edge = 0, groups = 0, places = 0; const byRole = {}; const tr0 = process.hrtime.bigint();
    for (const R of seen) {
      if (!R.dead) continue; const i0 = R.idx0, nt = R.nt, rep = R.rep, pl = v => rep ? rep[v] : v, pos = R.g.pos;
      let d = 0; const hot = new Set();
      for (let t = 0; t < nt; t++) if (R.dead[t]) { d++; for (let q = 0; q < 3; q++) hot.add(pl(i0[t * 3 + q])); }
      if (!d) continue;
      // grow the rim by rings over the live triangles
      let front = hot; const inRim = new Uint8Array(nt);
      for (let ring = 0; ring < RIM_RINGS; ring++) { const next = new Set();
        for (let t = 0; t < nt; t++) { if (R.dead[t] || inRim[t]) continue; const a = pl(i0[t * 3]), b = pl(i0[t * 3 + 1]), c = pl(i0[t * 3 + 2]);
          if (front.has(a) || front.has(b) || front.has(c)) { inRim[t] = 1; next.add(a); next.add(b); next.add(c); } }
        for (const v of front) next.add(v); front = next; }
      let rr = 0; const rp = new Set();
      for (let t = 0; t < nt; t++) if (inRim[t]) { rr++; for (let q = 0; q < 3; q++) rp.add(pl(i0[t * 3 + q])); }
      // the torn edge: live-triangle edges whose both ends are hot places (on a dead triangle)
      for (let t = 0; t < nt; t++) { if (R.dead[t]) continue; for (let q = 0; q < 3; q++) { const a = i0[t * 3 + q], b = i0[t * 3 + (q + 1) % 3];
        if (hot.has(pl(a)) && hot.has(pl(b))) edge += Math.hypot(pos[a * 3] - pos[b * 3], pos[a * 3 + 1] - pos[b * 3 + 1], pos[a * 3 + 2] - pos[b * 3 + 2]) / 2; } }
      dead += d; rim += rr; places += rp.size; if (rr) groups++;
      const role = (R.gk && (R.gk.role || R.gk.key)) || '?'; byRole[role] = (byRole[role] || 0) + rr;
    }
    const rimMs = Number(process.hrtime.bigint() - tr0) / 1e6;
    const top = Object.entries(byRole).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([a, b]) => a + ' ' + b).join(', ');
    log(`${k.padEnd(6)} ${cid.padEnd(10)} broken ${String(r.broken).padStart(3)}  removed/torn tris ${String(dead).padStart(6)}  torn edge ${edge.toFixed(1).padStart(6)} m  RIM tris ${String(rim).padStart(6)} (${(rim / Math.max(edge, 1e-6)).toFixed(0)} a metre)  rim places ${places}  groups with a rim ${groups} / ${seen.size}  index ${(rim * 12 / 1024).toFixed(0)} kB  rim pass ${rimMs.toFixed(0)} ms (naive, whole crash at once)  [${top}]  (${(ms / 1000).toFixed(0)} s)`);
  }
}
if (!opt('child', null)) fs.writeFileSync(path.join(__dirname, 'rim_census.txt'), lines.join('\n') + '\n');
