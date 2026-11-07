#!/usr/bin/env node
// cowl_study/gen_matrix.js - PROPER-COWLS (7 Nov 2026): one generated aeroplane per (engine type x mount), born by the
// new-plane chooser's own path (_newplane_lib.js joinedOf: bake -> the cowl's birth preset -> the joined spec ->
// the stance fit), saved as a build file plane_shot / quickshot can draw. The "what our cowl does today" column.
//
//   node tools/cowl_study/gen_matrix.js <outdir> [--only=flat:nose,radial:nose] [--over='{"cw_x":1}']
//
// The class per engine type is the one the type is offered on with a sensible model (modelFor's nearest by power);
// every other choice is the chooser's default for it (NP.complete).
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const OUT = argv.find(a => !a.startsWith('--'));
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
if (!OUT) { console.error('usage: gen_matrix.js <outdir> [--only=type:mount,...]'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const NL = require('../_newplane_lib.js'); NL.init();
const NP = NL.NP();
const SHX = require('../_scene_headless.js').context().ctx;
const engName = i => { try { return SHX.ENG_PAGE.presetNames()[Math.round(i)]; } catch (e) { return i; } };
const TYPES = { flat: 'n23', inline: 'ulm', vee: 'eab', radial: 'n23', electric: 'lsa', turbine: 'n23', rotax: 'ulm' };
for (const kv of (arg('types', '') || '').split(',').filter(Boolean)) { const [k, v] = kv.split(':'); TYPES[k] = v; }
const MOUNTS = ['nose', 'pusher', 'wingTop', 'twin', 'pushPull', 'three', 'four'];
const only = arg('only', null);
const over = JSON.parse(arg('over', '{}'));
const rows = [];
for (const t of Object.keys(TYPES)) for (const m of MOUNTS) {
  const id = t + ':' + m;
  if (only && !only.split(',').includes(id)) continue;
  const base = { class: TYPES[t], engArch: m, engType: /^(rotax|flat)/.test(t) ? 'flat' : t, mission: 'trainer', colour: 0xefe6cf };
  if (m === 'pusher') base.booms = 'rod';
  if (m === 'pushPull') base.booms = 'twin';
  if (m === 'wingTop') base.wing = 'high';
  const { choices, cleared } = NP.complete(base);
  if (choices.engArch !== m || (choices.engType !== base.engType)) { rows.push({ id, skip: 'not offered: ' + cleared.join(',') }); continue; }
  const t0 = Date.now();
  try {
    const { b, j } = NL.joinedOf(choices, {});
    const spec = j.spec;
    if (Object.keys(over).length) spec.cage = Object.assign({}, spec.cage, over);
    const file = path.join(OUT, id.replace(':', '_') + '.json');
    fs.writeFileSync(file, JSON.stringify({ what: 'flydiy-build', v: 1, name: 'cowl ' + id, spec }));
    const c = spec.cage;
    rows.push({ id, file, model: engName(spec.cage.engPreset), preset: b.cowlPreset, engMount: c.engMount, fitNose: c.fitNose,
                cowlOn: c.cowlOn, notes: (j.notes || []).filter(n => /cowl|engine/i.test(n)).slice(0, 2), ms: Date.now() - t0 });
  } catch (e) { rows.push({ id, err: String(e && e.message || e).slice(0, 200) }); }
  console.log(JSON.stringify(rows[rows.length - 1]));
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(rows, null, 1));
