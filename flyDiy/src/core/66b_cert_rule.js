// ===========================================================================
// THE CERTIFICATE'S RULE (G3780 CERT-RULE; the user 26 Oct: "R1-R6 yes, 3b"; CERT-REVIEW-2026-10.md §6).
// ONE LIST, three readers - the bench (src/viewer/bench.js), the career's factory certificate (76_procure.js procureFp)
// and the acceptance legs (72_accept.js, signed with the bench's fingerprint) - so the copies cannot drift apart again
// (the G3449 light switches were state on the bench and a MODIFIED, billed airframe in the career).
//
// R1  THE CERTIFICATE BELONGS TO THE DESIGN'S MAJOR ROWS. `f3` hashes what the player designed, grouped:
//       structure  the fuselage (the cage's rows), the wing, the bracing, the cowl
//       engine     the engines and the propeller
//       gear       the landing gear (type, geometry, floats)
//       tail       the tail and the control surfaces
//       wb         the tanks (bay, capacity, form, station), the seats' CAPACITY, the belly pod
//     and nothing else: no version tag (a game update is not a change to the aeroplane - R3), no cosmetics, no
//     MINOR rows (avionics and instruments, lamps and switches, who sits and whether the crew is shown, the cargo,
//     the fuel aboard - R2), and no row the join MEASURES off the others (the floats' station follows the CG, the
//     glazed area follows the windows, the seats' stations and occupancy follow the cabin: CERT-REVIEW T3/T4).
// R2  minor changes and loading never withdraw: they move the weight & balance; a loading outside the certified
//     envelope is an operating limit (the flight notice), not a withdrawal.
// R4  a change of a MAJOR group names itself (certGroupsChanged) and the instant checks re-run.
// Pure: no window, no DOM. The page's own deviation rules (a cage row at the default aeroplane's value, the frames
// as deviations, the dash as certified) are bench.js's, applied BEFORE this (benchStripCosmetic); a core caller with
// no defaults hashes every non-minor row as written, as procureFp always did.
// ===========================================================================
const CERT_FP_SCHEME = 'f3';
// what is not the aeroplane at all (as BENCH_COSMETIC + the procure's readouts; `v` is the file's version)
const CERT_COSMETIC = ['paint', 'finish', 'meta', 'v'];
// the LOOK of a block: weighs nothing (60_gen_spec "THE LOOK")
const CERT_LOOK = { energy: ['finish', 'hue', 'tint'], vessel: ['finish', 'hue', 'tint'] };
// MINOR blocks (R2): the avionics, instruments and electrics (a logbook entry and a W&B update in the real world),
// the cargo aboard, the fuel aboard (the tanks' DESIGN is energy.vessels)
const CERT_MINOR_BLOCKS = ['systems', 'cargo', 'fuel'];
// the cage's STATE and MINOR rows - views, the explode, who is aboard and whether the crew is shown, the lamps'
// switches and dimmers, the lamps FITTED (li_*Fit: minor, a W&B update), the reflector glow, the fastener density
// (BENCH_STATE_ROWS and PROCURE_STATE_ROWS, now one).
// The crew's names: pilotWho / copWho / cabWho / crewOn (master), pil* after G3700 (the racer), dum* before it.
const CERT_STATE_ROWS = /^_view|^(explodeD|dumOn|pilOn|crewOn|pilotWho|copWho|cabWho|cabOcc|paxOcc\d+|lightOn|li_reflect|li_beaconRpm|accDetail|li_(?:nav|beacon|taxi|land|flood|instr|pedal|pax)|li_[a-z]+Fit)$/;
// rows the JOIN MEASURES off the design (never the player's): a block -> its measured keys
const CERT_MEASURED = {
  cabin: ['glazedM2', 'glazingMat', 'seatsX', 'occupied', 'pilots', 'pax'],
  gear: [],                         // the floats' station: gear.floats.{x, y} (below)
};
// the groups, in the order the bench names them
const CERT_GROUPS = {
  structure: { label: 'the wing or the structure', blocks: ['cage', 'wings', 'bracing', 'fuselage', 'cowl'] },
  engine:    { label: 'the engine or the propeller', blocks: ['engines', 'prop'] },
  gear:      { label: 'the landing gear', blocks: ['gear'] },
  tail:      { label: 'the tail or the controls', blocks: ['tail', 'controls'] },
  wb:        { label: 'the tanks, the seats or the pod', blocks: ['energy', 'cabin', 'outfit', 'pod'] },
};
const CERT_GROUP_KEYS = Object.keys(CERT_GROUPS);
function certCanon(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return '[' + v.map(certCanon).join(',') + ']';
  const ks = Object.keys(v).filter(k => v[k] !== undefined).sort();
  return '{' + ks.map(k => JSON.stringify(k) + ':' + certCanon(v[k])).join(',') + '}';
}
function certHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return ('0000000' + h.toString(16)).slice(-8);
}
// the spec -> the design's major rows only (a clone; the caller's spec untouched)
function certStrip(spec) {
  if (!spec || typeof spec !== 'object') return null;
  const c = JSON.parse(JSON.stringify(spec));
  for (const k of CERT_COSMETIC.concat(CERT_MINOR_BLOCKS)) delete c[k];
  if (c.energy && typeof c.energy === 'object') {
    for (const k of CERT_LOOK.energy) delete c.energy[k];
    if (Array.isArray(c.energy.vessels)) for (const v of c.energy.vessels) if (v && typeof v === 'object') for (const k of CERT_LOOK.vessel) delete v[k];
  }
  for (const b in CERT_MEASURED) if (c[b] && typeof c[b] === 'object') for (const k of CERT_MEASURED[b]) delete c[b][k];
  if (c.gear && c.gear.floats && typeof c.gear.floats === 'object') { delete c.gear.floats.x; delete c.gear.floats.y; }
  if (c.cage && typeof c.cage === 'object') for (const k of Object.keys(c.cage)) if (CERT_STATE_ROWS.test(k)) delete c.cage[k];
  return c;
}
// a stripped spec -> { fp, groups: { structure: h, ... } }. A block no group names counts with the structure: an
// unknown row is a change to the aeroplane until someone lists it as minor.
function certMajorOf(stripped) {
  if (!stripped) return null;
  const by = {}; for (const g of CERT_GROUP_KEYS) by[g] = {};
  const owner = {}; for (const g of CERT_GROUP_KEYS) for (const b of CERT_GROUPS[g].blocks) owner[b] = g;
  for (const k of Object.keys(stripped)) by[owner[k] || 'structure'][k] = stripped[k];
  const groups = {}; for (const g of CERT_GROUP_KEYS) groups[g] = certHash(g + '|' + certCanon(by[g]));
  return { fp: certHash(CERT_FP_SCHEME + '|' + CERT_GROUP_KEYS.map(g => groups[g]).join('|')), groups };
}
function certMajor(spec) { return certMajorOf(certStrip(spec)); }
// which groups moved between two stamps (both carry `groups`); null when either cannot say
function certGroupsChanged(a, b) {
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return null;
  return CERT_GROUP_KEYS.filter(g => a[g] !== b[g]);
}
// the bench's one line naming a change: "the wing or the structure changed"
function certChangeLine(keys) {
  if (!keys || !keys.length) return 'the aeroplane changed';
  const L = keys.map(k => (CERT_GROUPS[k] || {}).label || k);
  return (L.length > 1 ? L.slice(0, -1).join(', ') + ' and ' + L[L.length - 1] : L[0]) + ' changed';
}
