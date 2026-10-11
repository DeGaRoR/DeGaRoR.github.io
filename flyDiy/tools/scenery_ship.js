// SCENERY SHIP (G3010-G3019): the user's saved scenery into the shipped fixture, as saved - minus what they hold back.
//   node tools/scenery_ship.js SAVE.json --except w1,w4 [--fixture tools/fixtures/island_jolene.json] --out PATCH.json
//   node tools/scenery_ship.js SAVE.json --except w1,w4 --verify     (the fixture already patched: shipped == save?)
//   --remove id,id: the save's removals the user confirmed (none go otherwise); --record pavement: its record settings;
//   --trim r25:w5: a road stopped at a strip's edge
// A save is record v2 (every polygon an AREA) and has no Metlakatla (the town switch cuts it at load); the fixture is
// record v1 and carries the town. The patch keeps the fixture v1 - its raw readers (contracts, the game premises, the
// town kit, the fleet's spots) read it as before:
//   - a road, a strip, a site, a zone (not a clear zone), an object, a link: the save's entry as written, in place of the
//     fixture's when they differ (compared normalised), appended when new, removed when the save has it no more;
//   - an AREA the migration made (it names its v1 sources, `src`): its v1 entries (areaEntries) written back in their
//     sources' places when they changed, its sources removed when the save has it no more;
//   - a NEW area (no `src`): into the fixture's `areas` layer as written (the migration keeps it as it is).
// A SAVE IS THE SANDBOX'S VIEW (v1.33 STAGES): the editor saves the record as it stands with every track at its max -
// an entry's `stage` (and a site item's) is not in it, and an entry that stands only below the max (`sg_` - a
// construction phase) is not either. So a `stage` is compared away and put back on what ships, and an entry that carries
// one is never taken out. A REMOVAL is the user's to confirm: nothing the save removed goes unless named in --remove.
// Nothing of a place the save cut (the town, `mk_`) is touched. --verify: the patched fixture, migrated, the town cut,
// equals the save minus the held-back entries, entry by entry (normalised) - GATE SCENERYED holds it.
'use strict';
const fs = require('fs');
const path = require('path');
const PG = require(path.join(__dirname, '..', 'src', 'core', '27_premises.js'));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SAVE = process.argv[2], FIX = arg('--fixture', path.join(__dirname, 'fixtures', 'island_jolene.json'));
const EXCEPT = new Set(String(arg('--except', '')).split(',').filter(Boolean)), CUTP = ['mk_'];
// --remove a,b: the removals the user confirmed (every other entry the save has no more stays shipped)
const REMOVE = new Set(String(arg('--remove', '')).split(',').filter(Boolean));
// --record pavement,theme,life: the record's own settings the user confirmed
const RECK = new Set(String(arg('--record', '')).split(',').filter(Boolean));
// --trim road:strip,...: a road the user stops at a strip's edge (PG.roadCutAtPoly on the strip's box) - the rest of it as saved
const TRIM = new Map(String(arg('--trim', '')).split(',').filter(Boolean).map(q => q.split(':')));
const trimmed = (e) => { const w = TRIM.get(e.id); if (!w) return e; const S = (RS.runways || []).find(q => q.id === w); if (!S) throw new Error('--trim: no strip ' + w + ' in the save');
  const cut = PG.roadCutAtPoly(e, PG.runwayBox(Object.assign({}, PG.RUNWAY_DEF, S), 0)); if (!cut) throw new Error('--trim: ' + e.id + ' never meets ' + w); return cut; };
const rawSave = JSON.parse(fs.readFileSync(SAVE, 'utf8')), RS = (rawSave.premises || rawSave).layers;
const B = PG.unwrap(fs.readFileSync(SAVE, 'utf8')).rec;
const rawFix = JSON.parse(fs.readFileSync(FIX, 'utf8')), RF = (rawFix.premises || rawFix).layers;
const N = e => JSON.stringify(e);
const cutId = id => CUTP.some(p => String(id || '').startsWith(p));
const normEntry = (layer, e) => { const r = PG.DEF(); r.layers[layer] = [JSON.parse(JSON.stringify(e))]; return N(PG.normalise(r).layers[layer][0]); };
// an entry without its stages (its own and its items'): what the sandbox's view of it is
const unstage = e => { const c = JSON.parse(JSON.stringify(e)); delete c.stage; if (Array.isArray(c.items)) for (const it of c.items) if (it) delete it.stage; return c; };
// the save's entry with the fixture's stages put back (its own, and each item's by id)
const restage = (saved, fx) => { const c = JSON.parse(JSON.stringify(saved)); if (fx && fx.stage !== undefined) c.stage = fx.stage;
  if (fx && Array.isArray(fx.items) && Array.isArray(c.items)) for (const it of c.items) { const f = fx.items.find(q => q && q.id === it.id); if (f && f.stage !== undefined) it.stage = f.stage; } return c; };
const staged = e => !!(e && (e.stage || (Array.isArray(e.items) && e.items.some(it => it && it.stage)) || /^sg_/.test(String(e.id || ''))));

function verify() {
  const A = PG.dropPlaces(PG.unwrap(fs.readFileSync(FIX, 'utf8')).rec, CUTP).rec, bad = [];
  for (const L of PG.LAYERS) {
    const a = new Map((A.layers[L] || []).map(e => [e.id, e])), b = new Map((B.layers[L] || []).filter(e => !EXCEPT.has(e.id)).map(e => [e.id, e]));
    for (const [id, e] of b) if (!a.has(id)) bad.push(L + ' ' + id + ': not shipped'); else if (N(unstage(a.get(id))) !== N(unstage(e))) bad.push(L + ' ' + id + ': differs');
    for (const [id, e] of a) if (!b.has(id) && REMOVE.has(id)) bad.push(L + ' ' + id + ': confirmed removed, still shipped');
  }
  return bad;
}
if (process.argv.indexOf('--verify') > 0) { const bad = verify(); console.log(bad.length ? 'SHIP VERIFY: ' + bad.length + ' difference(s)\n  ' + bad.slice(0, 40).join('\n  ') : 'SHIP VERIFY: the shipped record is the save minus ' + Array.from(EXCEPT).join(', ') + ', entry by entry'); process.exit(bad.length ? 1 : 0); }

const ops = [], why = [];
const set = (layer, entry, note) => { ops.push({ layer, op: 'set', entry }); why.push('set ' + layer + ' ' + entry.id + (note ? ' (' + note + ')' : '')); };
const del = (layer, id, note) => { ops.push({ layer, op: 'del', id }); why.push('del ' + layer + ' ' + id + (note ? ' (' + note + ')' : '')); };
// 1. the layers a v1 record holds as a v2 one does
for (const L of ['roads', 'runways', 'sites', 'zones', 'objects', 'links', 'junctions']) {
  const sv = (RS[L] || []).filter(e => e && !EXCEPT.has(e.id) && !(L === 'zones' && e.kind === 'clear'));
  const fx = new Map((RF[L] || []).filter(e => e && !cutId(e.id) && !(L === 'zones' && e.kind === 'clear')).map(e => [e.id, e]));
  for (const e0 of sv) { const e = L === 'roads' ? trimmed(e0) : e0, f = fx.get(e.id); if (!f) set(L, e, 'new' + (e !== e0 ? ', stopped at ' + TRIM.get(e.id) + ' (' + e0.pts.length + ' -> ' + e.pts.length + ' points)' : '')); else if (normEntry(L, unstage(f)) !== normEntry(L, unstage(e))) set(L, restage(e, f), 'changed' + (staged(f) ? ', its stages kept' : '')); }
  const ids = new Set(sv.map(e => e.id));
  for (const [id, f] of fx) if (!ids.has(id) && !EXCEPT.has(id)) { if (staged(f)) why.push('stage ' + L + ' ' + id + ' (not in the sandbox view: kept)'); else if (REMOVE.has(id)) del(L, id, 'removed by the user, confirmed'); else why.push('REMOVED IN THE SAVE, kept until confirmed: ' + L + ' ' + id); }
}
// 2. the areas: the migrated ones back into their v1 sources, the new ones as areas
const A0 = PG.unwrap(fs.readFileSync(FIX, 'utf8')).rec, fixAreas = new Map(A0.layers.areas.map(a => [a.id, a]));
const savedAreas = new Map((B.layers.areas || []).map(a => [a.id, a])), rawAreas = new Map((RS.areas || []).map(a => [a.id, a]));
for (const [id, a] of savedAreas) {
  if (EXCEPT.has(id) || cutId(id)) continue;
  const f = fixAreas.get(id);
  if (f && N(Object.assign({}, f, { src: null })) === N(Object.assign({}, a, { src: null }))) continue;   // (the sources' indexes are the migration's bookkeeping)
  if (a.src && Object.keys(a.src).length) {
    // its v1 entries, in their sources' layers and ids; a source it no longer makes goes
    const made = PG.areaEntries(a), mk = new Set();
    for (const q of made) { const L = q.layer, e = q.entry; mk.add(L + ':' + e.id); const old = (RF[L] || []).find(x => x.id === e.id); if (!old || normEntry(L, old) !== normEntry(L, e)) set(L, e, 'area ' + id + (old ? ' changed' : ' new source')); }
    for (const L of Object.keys(f ? f.src || {} : {})) { const sid = f.src[L][0]; if (!mk.has(L + ':' + sid)) del(L, sid, 'area ' + id + ' no longer makes it'); }
  } else set('areas', rawAreas.get(id) || a, f ? 'changed' : 'new area');
}
for (const [id, f] of fixAreas) if (!savedAreas.has(id) && !cutId(id) && !EXCEPT.has(id)) {
  const v1 = f.src ? Object.keys(f.src).map(L => (RF[L] || []).find(x => x.id === f.src[L][0])).filter(Boolean) : [];
  if (staged(f) || v1.some(staged)) { why.push('stage area ' + id + ' (not in the sandbox view: kept)'); continue; }
  if (!REMOVE.has(id)) { why.push('REMOVED IN THE SAVE, kept until confirmed: area ' + id); continue; }
  if (f.src) for (const L of Object.keys(f.src)) del(L, f.src[L][0], 'area ' + id + ' removed by the user, confirmed'); else del('areas', id, 'removed by the user, confirmed');
}
// the record's own fields the user can change (not its frame: the composed extent grows over what is drawn)
const recOps = {};
for (const k of ['theme', 'pavement', 'life']) if (N((rawSave.premises || rawSave)[k]) !== N((rawFix.premises || rawFix)[k]) && (rawSave.premises || rawSave)[k] !== undefined) {
  // (the record's own settings reach every pavement, every theme's plot: shipped only when named - --record pavement,theme)
  if (RECK.has(k)) { recOps[k] = (rawSave.premises || rawSave)[k]; why.push('record.' + k + ' changed'); } else why.push('THE SAVE CHANGES record.' + k + ', kept until confirmed: ' + JSON.stringify((rawSave.premises || rawSave)[k]).slice(0, 120)); }
const OUT = arg('--out', null);
console.log('SCENERY SHIP ' + path.basename(SAVE) + ' -> ' + path.relative(process.cwd(), FIX) + ' (held back: ' + Array.from(EXCEPT).join(', ') + '): ' + ops.length + ' op(s)');
for (const w of why) console.log('  ' + w);
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ save: path.basename(SAVE), except: Array.from(EXCEPT), ops, rec: recOps }));
