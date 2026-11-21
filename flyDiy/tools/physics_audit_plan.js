#!/usr/bin/env node
// PHYSICS AUDIT - THE PLAN'S TABLES (21 Nov 2026): every live plane's real-figures verdicts today, and after each stage
// of the plan, judged by real_check's OWN verdict rule (inside / near / outside its band at the reference's weights).
// Today's column is real_check --quick itself (the JSONs in --rc); a stage's column is today's figure times the ratio
// the audit's prototype moves it by (tools/physics_audit.js + physics_audit_proto.js), at each of the three loads. So a
// stage's number is "what real_check would read if that change landed", without a line of the core changed.
//
//   node tools/real_check.js <key> --quick --json=<dir>/<key>.json     (each live plane; ~25 s a plane)
//   node tools/physics_audit_plan.js --rc=<dir> [--out=<dir>]           -> plan.json, plan.md
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname;
const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const RC = require(path.join(T, 'real_check.js'));
const PA = require(path.join(T, 'physics_audit.js'));
const { PLANES, REFS } = RC;

// THE STAGES, cumulative. I = how the aeroplane is READ (no model change); M = a model change
const STAGES = [
  { id: 'today', label: 'today (real_check --quick)', protos: [] },
  { id: 'I', label: 'I: read right (wheels up, the row\'s altitude and power)', protos: ['gearup', 'alt', 'power'] },
  { id: 'M2', label: '+ M2 span efficiency above AR 8', protos: ['gearup', 'alt', 'power', 'oswald'] },
  { id: 'M4', label: '+ M4 wires (streamline flying wires, no tail wires on a cantilever tail)', protos: ['gearup', 'alt', 'power', 'oswald', 'wires'] },
  { id: 'M1', label: '+ M1 propeller (fixed pitch by its design speed and material; constant speed on the actuator disc)', protos: ['gearup', 'alt', 'power', 'oswald', 'wires', 'prop'] },
  { id: 'M3', label: '+ M3 the idle propeller in a FLOWN glide row (the 172R\'s and the Velis\'s handbooks)', protos: ['gearup', 'alt', 'power', 'oswald', 'wires', 'prop', 'idleprop'] },
  { id: 'M5t', label: 'TARGET, not a prototype: + M5 the drag rows brought to the parent\'s implied drag area (9 planes, physics_audit_proto.js TARGET_F)', protos: ['gearup', 'alt', 'power', 'oswald', 'wires', 'prop', 'idleprop', 'targetf'] },
];
// a glide row that is a COMPUTED clean polar (Loftin's (L/D)max, a maker's drag polar, a glider): no propeller in it
// A FLOWN glide row with the propeller idling: the two handbooks that state it. Every other glide row is read CLEAN, as
// today: a computed polar (Loftin's (L/D)max for the Cub and the DC-3, the Ruckus maker's drag polar), a glider, or a
// brochure "10:1" whose propeller nobody states (the D.112, the Chinook, the Petrel)
const LD_FLOWN = { c172r: '172R POH section 3 (engine out, propeller windmilling)', velis: 'POH-128 (motor off)' };

function stageCases(rc, aud, si) {
  // today's cases times the stage's ratios, per load
  return rc.cases.filter(c => aud[c.id]).map(c => {
    const a = aud[c.id], b = a.fig, p = si === 0 ? null : a.protos[si].fig;
    const r = (k, inv) => (!p || !(b[k] > 0) || !(p[k] > 0)) ? 1 : p[k] / b[k];
    const ld = !p ? 1 : (!LD_FLOWN[rc.ref] ? (() => { const q = a.protosClean[si].fig; return q.LD / b.LD; })() : r('LD'));
    return Object.assign({}, c, { Vs: c.Vs * r('Vs'), V75: c.V75 && c.V75 * r('V75'), Vmax: c.Vmax && c.Vmax * r('Vmax'), roc: c.roc * r('roc'), LD: c.LD * ld,
                                  TOgrass: c.TOgrass && p ? c.TOgrass * (isFinite(p.rollRatio) ? p.rollRatio : 1) : c.TOgrass });
  });
}
const mid = v => 0.5 * (v[0] + v[1]);
function run() {
  const dir = opt('rc'); if (!dir) { console.log('usage: node tools/physics_audit_plan.js --rc=<dir of real_check --quick JSONs> [--out=<dir>]'); process.exit(2); }
  const out = opt('out', dir), keys = require(path.join(T, '_real_stamp.js')).liveKeys(PLANES).filter(k => fs.existsSync(path.join(dir, k + '.json')));
  const res = [];
  for (const key of keys) {
    const rc = JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8'));
    const aud = {};
    for (const c of rc.cases) {
      if (!['min', 'typ', 'mtow'].includes(c.id)) continue;
      const a = PA.auditPlane(key, c.id, STAGES.map(s => s.protos.length ? s.protos : ['none']));
      // the clean-glide variant (no idle propeller) for a computed-polar glide row
      a.protosClean = PA.auditPlane(key, c.id, STAGES.map(s => { const p = s.protos.filter(n => n !== 'idleprop'); return p.length ? p : ['none']; })).protos;
      aud[c.id] = a;
    }
    const rows = {};
    STAGES.forEach((st, si) => {
      const o = Object.assign({}, rc, { cases: stageCases(rc, aud, si), flights: {}, water: {}, sweep: null });
      for (const v of RC.verdicts(o)) {
        if (v.src !== 'ledger' && !/^airframe/.test(v.src)) continue;
        const id = v.k;
        (rows[id] = rows[id] || { k: id, ref: v.ref, band: v.refBand, kg: v.kg, st: [] }).st.push({ ours: v.ours, verdict: v.verdict, err: mid(v.ours) / mid(v.ref) - 1 });
      }
    });
    const m = aud.mtow || aud.typ;
    res.push({ key, ref: rc.ref, refName: rc.refName, rows, notes: m.protos[STAGES.length - 1].notes, base: { CdS: m.CdS, CD0: m.CD0, e: m.e, CLmax: m.CLmax, CLmaxTrim: m.CLmaxTrim, etaVy: m.fig.etaVy, etaVmax: m.fig.etaVmax, mass: m.mass, S: m.S, AR: m.AR, drag: m.drag, empty: m.empty },
               plan: { etaVy: m.protos[STAGES.length - 2].fig.etaVy, etaVmax: m.protos[STAGES.length - 2].fig.etaVmax, rollRatio: m.protos[STAGES.length - 2].fig.rollRatio,
                       Vy: m.protos[STAGES.length - 2].fig.Vy, Vbg: m.protos[STAGES.length - 2].fig.Vbg, sink: m.protos[STAGES.length - 2].fig.sink },
               today: { Vy: m.fig.Vy, Vx: m.fig.Vx, Vbg: m.fig.Vbg, sink: m.fig.sink, Vms: m.fig.Vms, VsTrim: m.figT.Vs, Vs: m.fig.Vs, Vs0: m.Vs0, Vs0Trim: m.Vs0Trim } });
    console.log(key + ' done');
  }
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'plan.json'), JSON.stringify({ stages: STAGES, planes: res }, null, 1) + '\n');
  // THE TABLE
  const f = (v, d) => v == null || !isFinite(v) ? '-' : (+v).toFixed(d);
  const DEC = { roc: 2, roc2: 2, LD: 1 }, mark = { inside: '', near: ' ~', outside: ' !!' };
  const L = ['| plane | figure | real (band) | ' + STAGES.map(s => s.id).join(' | ') + ' | move |', '|---|---|---|' + STAGES.map(() => '---').join('|') + '|---|'];
  const tally = { stays: 0, toward: 0, away: 0, into: 0, out: 0 };
  for (const p of res) for (const id of Object.keys(p.rows)) {
    const r = p.rows[id]; if (r.st.length < STAGES.length) continue;
    const d = DEC[id] || 0, a = r.st[0], z = r.st[r.st.length - 2];      // the move: today -> the prototyped plan (M3); the target column is beside it
    const cell = s => f(mid(s.ours), d) + ' (' + (s.err >= 0 ? '+' : '') + f(100 * s.err, 0) + ' %)' + mark[s.verdict];
    const same = Math.abs(z.err - a.err) < 0.005;
    const mv = same ? '=' : (a.verdict === 'inside' && z.verdict === 'inside') ? 'stays in' : (a.verdict !== 'inside' && z.verdict === 'inside') ? 'INTO the band'
             : (a.verdict === 'inside' && z.verdict !== 'inside') ? 'OUT of the band' : Math.abs(z.err) < Math.abs(a.err) ? 'toward' : 'AWAY';
    r.move = mv;
    if (!same) tally[mv === 'stays in' ? 'stays' : mv === 'INTO the band' ? 'into' : mv === 'OUT of the band' ? 'out' : mv === 'toward' ? 'toward' : 'away']++;
    L.push('| ' + p.key + ' | ' + id + ' | ' + f(r.ref[0], d) + (r.ref[1] !== r.ref[0] ? '-' + f(r.ref[1], d) : '') + ' (' + f(r.band[0], d) + '-' + f(r.band[1], d) + ') | ' + r.st.map(cell).join(' | ') + ' | ' + mv + ' |');
  }
  const head = '# PHYSICS AUDIT - the plan, stage by stage (generated by tools/physics_audit_plan.js)\n\n' + STAGES.map(s => '- **' + s.id + '**: ' + s.label).join('\n') +
    '\n\nA cell: our figure at the reference\'s weight (the middle of our range), its error against the reference\'s middle, `~` near, `!!` outside (real_check\'s own verdict rule).\n' +
    'Moved rows: ' + JSON.stringify(tally) + '\n\n';
  fs.writeFileSync(path.join(out, 'plan.md'), head + L.join('\n') + '\n');
  fs.writeFileSync(path.join(out, 'plan.json'), JSON.stringify({ stages: STAGES, tally, planes: res }, null, 1) + '\n');
  console.log('moved rows: ' + JSON.stringify(tally) + '\nwrote ' + path.join(out, 'plan.md'));
}
if (require.main === module) run();
module.exports = { STAGES, LD_FLOWN };
