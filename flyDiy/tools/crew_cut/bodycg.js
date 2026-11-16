#!/usr/bin/env node
// crew_cut/bodycg.js - WHERE THE DRAWN PILOT'S MASS IS (16 Nov 2026, SEAT-CG): the seated pilot's mass centre from its
// posed bones and Winter's segment fractions (probe_bodycg.js, in the load chain), against its seat's back - what the
// crew layer's seatsAt[].cgFwd rule (_cage_crew.js, SEAT-CG) was fitted on.
//   node tools/crew_cut/bodycg.js <build.json> [--over JSON] [--sweep '[{"seatRake":13},{"seatRake":50}]']
'use strict';
const path = require('path'), fs = require('fs');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const pos = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
if (!pos.length) { console.error('usage: node tools/crew_cut/bodycg.js <build.json> [--over JSON] [--sweep JSON]'); process.exit(2); }
const FLY = path.resolve(__dirname, '..', '..');
const raw = JSON.parse(fs.readFileSync(path.resolve(pos[0]), 'utf8'));
process.chdir(FLY);
process.env.FLYDIY_JOIN_PROBE = path.join(__dirname, 'probe_bodycg.js'); process.env.FLYDIY_JOIN_NOCACHE = '1';
const LB = require(path.join(FLY, 'tools', '_load_build.js'));
const base = JSON.parse(opt('over', '{}')), cases = JSON.parse(opt('sweep', '[{}]'));
for (const o of cases) {
  const b = JSON.parse(JSON.stringify(raw.spec ? raw : { what: 'flydiy-build', v: 10, spec: raw }));
  b.spec.cage = Object.assign({}, b.spec.cage || {}, base, o);
  const tmp = path.join(FLY, 'builds', 'candidates', '_crewcg_' + process.pid + '.json');
  fs.writeFileSync(tmp, JSON.stringify(b));
  try { const p = LB.loadBuild(path.relative(FLY, tmp)).probe;
    const C = b.spec.cage;
    console.log(JSON.stringify(o) + '  back ' + C.seatRake + ' + recline ' + (C.pilRecline || 0) + ', pedals ' + C.pedalZ +
      ': body mass centre ' + (p.cg ? (p.cg[2] - p.zBack).toFixed(3) + ' m ahead of the back' : p.err) + ' (the old rule 0.200)');
  } finally { try { fs.unlinkSync(tmp); } catch (e) {} }
}
