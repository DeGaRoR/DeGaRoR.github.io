#!/usr/bin/env node
// GARAGE-VIEW: THE SITE FILES - which airfield a cooked outdoor scene is for (the user, 22 Nov: "generalise this so we
// can update / re-use on other hangars automatically or semi automatically, using a toolset").
//
// A SITE is one airfield's hangars sharing one scene: tools/garage_view/sites/<pack>.json
//   { pack, world, fixture, field, sheds: [{ id, shell, name }], trees (m), mid: { u, v, out }, near: { out, in, side }, times }
//     pack     the scene's name (media/garage_view/<pack>/, src/core/garage_view_packs.json)
//     world    the island (tools/island_node.js); fixture: its premises record under tools/fixtures/
//     field    the runway's id in the record (its `hangar` is the main plot, its `plots` the others)
//     sheds    the rooms that look out on this scene: the plot's id and the shell the views are measured for (the widest
//              door the plot offers: the scene itself is the world, any shell stands in it)
//     trees    every drawn tree within this of the sheds' middle becomes a card
//     mid      the low-resolution ground picture: u x v metres, its centre `out` metres out of the first shed's door
//     near     the high-resolution one in front of each door: `out` metres out, `in` metres inside the sill, `side` each side
//     far      the band of the game's own pixels past the trees' radius: from `low` to `top` degrees of elevation, `w` texels round
//              (a plain: -1.6 .. 13; a valley wants its summits and its floor: measure.js prints the skyline's highest angle)
//     slices   (optional) the low vegetation's rings of distance (m, from the sheds' middle) and the lens that shoots them
//              (default 60 .. 700 m at 30 degrees: an apron on a plain; a small shed in a valley wants nearer rings and 60)
//
//   node tools/garage_view/site.js list [--world jolene]            every field with hangar plots, and the packs that exist
//   node tools/garage_view/site.js new <field> [--pack name] [--world jolene] [--fixture island_jolene.json]
//   node tools/garage_view/site.js show <pack>
// read(pack | path) is what the other tools call.
'use strict';
const fs = require('fs'), path = require('path');
const T = path.join(__dirname, '..'), DIR = path.join(__dirname, 'sites');
const DEF = { trees: 700, mid: { u: 560, v: 460, out: 110 }, near: { out: 46, in: 6, side: 10 }, far: { low: -1.6, top: 13, w: 8192 }, times: ['now', 'noon', 'golden', 'night'] };
const SHELL_NAME = { club: 'club hangar', works: 'large hangar', field: 'small hangar' };

function read(p) {
  const f = fs.existsSync(p) ? p : path.join(DIR, p.replace(/\.json$/, '') + '.json');
  if (!fs.existsSync(f)) throw new Error('garage_view site: no site file ' + p + ' (node tools/garage_view/site.js list)');
  const S = Object.assign({}, DEF, JSON.parse(fs.readFileSync(f, 'utf8')));
  S.mid = Object.assign({}, DEF.mid, S.mid || {}); S.near = Object.assign({}, DEF.near, S.near || {}); S.far = Object.assign({}, DEF.far, S.far || {});
  for (const k of ['pack', 'world', 'fixture', 'field']) if (!S[k]) throw new Error('garage_view site ' + f + ': no "' + k + '"');
  if (!Array.isArray(S.sheds) || !S.sheds.length) throw new Error('garage_view site ' + f + ': no sheds');
  return S;
}
// the fields of a record that have hangar plots: [{ field, name, sheds: [{ id, shell, name }] }]
function fields(fixture) {
  const F = JSON.parse(fs.readFileSync(path.join(T, 'fixtures', fixture), 'utf8'));
  let OFF = null; try { const C = require(path.join(T, 'flight_core.js')); OFF = C.BASE_OFFERS || null; } catch (e) {}
  const shellsOf = (field, id) => { const B = OFF && OFF[field], P = B && B.plots && B.plots[id]; return (P && P.shells) || null; };
  const widest = L => !L ? 'club' : L.includes('works') ? 'works' : L.includes('club') ? 'club' : L[0];
  const out = [];
  for (const r of F.layers.runways) { const ids = []; if (r.hangar) ids.push(r.id); for (const p of r.plots || []) if (p.id && !ids.includes(p.id)) ids.push(p.id);
    if (!ids.length) continue;
    out.push({ field: r.id, name: r.name, water: +r.surface === 4, sheds: ids.map(id => { const sh = widest(shellsOf(r.id, id)); return { id, shell: sh, name: SHELL_NAME[sh] + (ids.length > 1 ? ' ' + id : '') }; }) }); }
  return out;
}
// WHAT A SCENE WAS COOKED FROM: the record's rev and every shed's place and yaw (install.js writes it, GATE GARAGEVIEW compares it)
const sigOf = (rev, sheds) => require('crypto').createHash('sha1').update(JSON.stringify([rev, sheds.map(s => [s.id, +(+s.x).toFixed(2), +(+s.z).toFixed(2), +(+s.ry).toFixed(4)])])).digest('hex').slice(0, 12);
module.exports = { read, fields, sigOf, DIR, DEF };

if (require.main === module) {
  const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
  const world = opt('world', 'jolene'), fixture = opt('fixture', 'island_' + world + '.json'), cmd = argv[0];
  const packs = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(f => f.endsWith('.json')).map(f => read(path.join(DIR, f))) : [];
  if (cmd === 'list') {
    for (const f of fields(fixture)) { const p = packs.find(q => q.world === world && q.field === f.field);
      console.log((p ? 'pack ' + p.pack.padEnd(16) : 'no pack'.padEnd(21)) + ' ' + f.field.padEnd(10) + ' ' + f.name.padEnd(30) + ' ' + f.sheds.map(s => s.id + ' (' + s.shell + ')').join(', ') + (f.water ? '  [water]' : '')); }
  } else if (cmd === 'new' && argv[1]) {
    const f = fields(fixture).find(q => q.field === argv[1]); if (!f) { console.error('site: no field "' + argv[1] + '" with hangar plots in ' + fixture); process.exit(1); }
    const pack = opt('pack', world + '_' + f.field.toLowerCase().replace(/\W/g, '_')), file = path.join(DIR, pack + '.json');
    if (fs.existsSync(file)) { console.error('site: ' + file + ' exists (edit it, or pick another --pack)'); process.exit(1); }
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(Object.assign({ pack, world, fixture, field: f.field, sheds: f.sheds }, DEF), null, 2) + '\n');
    console.log('site: wrote ' + file + '\n' + fs.readFileSync(file, 'utf8'));
  } else if (cmd === 'show' && argv[1]) console.log(JSON.stringify(read(argv[1]), null, 2));
  else { console.error('usage: site.js list | new <field> [--pack name] | show <pack>'); process.exit(2); }
}
