// THE VEHICLES CATEGORY (A0 for the user, 15 Nov 2026: "Ensure the cars have their own category for loading into the
// garage for now, so we can easily hide two layers if need be"). Run by GATE VEHICLE (tools/_vehicle_check.js, row LIST):
//   - every row of builds/lists/vehicles.json with a garage build lands in the Vehicles category, in exactly one layer
//     (validated | candidate), and its build is a car by VEHICLE_KIND (never a plane);
//   - no vehicle file is listed among the planes (builds/candidates/index.json, builds/lists/plane_lists.json);
//   - the switches: showVehicles false empties the category, showCandidates false empties the candidate layer only;
//   - the user's statuses (15 Nov): the van's three liveries and the roadster validated, the UTV and the Dune Bug
//     candidates, the Conquer pickup selectable (no garage build: in neither layer);
//   - the Fleet (fleet_screen.js's Vehicles tab) gets the category through the garage's vehicleLists door, two headed layers.
// check(ROOT) -> [{ ok, msg }]
'use strict';
const fs = require('fs'), path = require('path');
function check(ROOT) {
  const out = [], row = (ok, msg) => out.push({ ok: !!ok, msg });
  const VK = require(path.join(ROOT, 'src/viewer/vehicle_kind.js'));
  const J = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds/lists/vehicles.json'), 'utf8'));
  const L = VK.layers(J), withFile = J.vehicles.filter(v => v && typeof v.file === 'string' && v.file);
  const inL = new Set(L.validated.concat(L.candidate).map(v => v.file));
  const kinds = withFile.map(v => { try { return VK.vehicleKind(JSON.parse(fs.readFileSync(path.join(ROOT, v.file), 'utf8'))); } catch (e) { return 'unreadable'; } });
  row(J.showVehicles !== false && J.showCandidates !== false && withFile.every(v => inL.has(v.file)) && inL.size === withFile.length && kinds.every(k => k === 'car' || k === 'trailer'),
    'every garage-built row in the Vehicles category (' + L.validated.length + ' validated + ' + L.candidate.length + ' candidate of ' + withFile.length + '), each a car by VEHICLE_KIND (' + kinds.join(' ') + ')');
  const cand = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds/candidates/index.json'), 'utf8')).planes || [];
  const pl = fs.readFileSync(path.join(ROOT, 'builds/lists/plane_lists.json'), 'utf8');
  const leak = withFile.filter(v => cand.some(p => 'builds/candidates/' + p.file === v.file) || pl.includes(v.file));
  row(!leak.length, 'no vehicle among the planes (the candidates index, plane_lists.json)' + (leak.length ? ': ' + leak.map(v => v.file).join(', ') : ''));
  const off = VK.layers(Object.assign({}, J, { showVehicles: false })), noCand = VK.layers(Object.assign({}, J, { showCandidates: false }));
  row(!off.validated.length && !off.candidate.length && !noCand.candidate.length && noCand.validated.length === L.validated.length && L.candidate.length > 0,
    'the switches: showVehicles false -> ' + (off.validated.length + off.candidate.length) + ' rows; showCandidates false -> ' + noCand.candidate.length + ' candidates, ' + noCand.validated.length + ' validated kept');
  const st = f => (J.vehicles.find(v => v.file === f) || {}).status;
  const want = { 'builds/vehicles/utility_retro_2026-11.json': 'validated', 'builds/vehicles/utility_2026-11.json': 'validated',
    'builds/vehicles/utility_mountain_2026-11.json': 'validated', 'builds/candidates/roadster_2026-11.json': 'validated',
    'builds/vehicles/utv_2026-11.json': 'candidate', 'builds/candidates/buggy_2026-11.json': 'candidate' };
  const bad = Object.keys(want).filter(f => st(f) !== want[f]);
  const conq = J.vehicles.find(v => v && /conquer/i.test(v.name || ''));
  row(!bad.length && conq && conq.status === 'selectable' && !conq.file,
    'the user\'s statuses (15 Nov): van x3 + roadster validated, UTV + Dune Bug candidates, the Conquer selectable with no garage build' + (bad.length ? ' - WRONG: ' + bad.join(', ') : ''));
  // (L40e: the garage's popup Fleet went - fleet_screen.js draws the Fleet; its Vehicles tab reads the garage's
  // vehicleLists door, which is VEHICLE_KIND.layers, and heads the two layers)
  const G = fs.readFileSync(path.join(ROOT, 'src/viewer/garage.js'), 'utf8');
  const FS = fs.readFileSync(path.join(ROOT, 'src/viewer/fleet_screen.js'), 'utf8');
  row(/VEHICLE_KIND\.layers\(j\)/.test(G) && /vehicleLists: vehicleList/.test(G) && /g\.vehicleLists/.test(FS) &&
      /layer === 'candidate' \? 'Candidates/.test(FS),
    'the Fleet\'s Vehicles tab (fleet_screen.js) reads the garage\'s vehicleLists door (VEHICLE_KIND.layers) and heads the layers: Validated, Candidates');
  return out;
}
module.exports = { check };
if (require.main === module) { const r = check(path.resolve(__dirname, '..')); for (const q of r) console.log((q.ok ? 'PASS ' : 'FAIL ') + q.msg); process.exitCode = r.every(q => q.ok) ? 0 : 1; }
