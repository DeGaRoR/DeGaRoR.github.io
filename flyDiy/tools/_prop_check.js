#!/usr/bin/env node
// _prop_check.js — GATE PROPS. The verdict on the baked hangar props.
//
// The pipeline is: tools/props_table.py (the declared table) -> tools/prop_prep.py
// -> src/props/props_*.js -> src/core/51_prop_codec.js. This gate stands at the
// end of it and asserts the BAKED payload against the DECLARED table, not
// against itself: the G48 lesson is that an assertion which reads the same
// object the code just wrote proves nothing. The table is parsed out of the
// python source, so there is still exactly one authority for what exists.
//
// TWO BAKERS, TWO TABLES, ONE REGISTRY (G62.10). The Jodel airframes come from
// OBJ rather than glTF and so from a second baker, tools/jodel_prep.py, with
// its own declared table. That is a widening of the contract, not a hole in
// it: this gate reads BOTH declarations and the registry must equal their
// union exactly, in order. It caught the airframes the moment they were
// registered without being declared here, which is the gate doing its job.
//
// Run: node tools/_prop_check.js        (contract: one final `GATE PROPS: ...`)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const PROPS_DIR = path.join(ROOT, 'src', 'props');
const CORE = require('./flight_core.js');

let fails = 0;
const fail = (m) => { console.log('  FAIL ' + m); fails++; };
const ok = (m) => console.log('  ok   ' + m);

// ---- the DECLARED table, read from the python source -----------------------
const tableSrc = fs.readFileSync(path.join(__dirname, 'props_table.py'), 'utf8');
const declared = [];
for (const m of tableSrc.matchAll(/^\s{4}P\('([a-z0-9_]+)',\s*'([a-z]+)',\s*'([^']*)'/gm))
  declared.push({ key: m[1], group: m[2], label: m[3] });
const declaredGroups = [];
for (const m of tableSrc.matchAll(/^\s{4}\('([a-z]+)',\s+'([^']*)'\),$/gm))
  declaredGroups.push(m[1]);

// ...and the airframe table, whose rows are dicts rather than P() calls
const airSrc = fs.readFileSync(path.join(__dirname, 'jodel_prep.py'), 'utf8');
const airGroup = (airSrc.match(/^GROUP = \('([a-z]+)',/m) || [])[1];
for (const m of airSrc.matchAll(/dict\(key='([a-z0-9_]+)',\s*label='([^']*)'/g))
  declared.push({ key: m[1], group: airGroup, label: m[2] });
if (airGroup && !declaredGroups.includes(airGroup)) declaredGroups.push(airGroup);
console.log(`declared: ${declared.length} props in ${declaredGroups.length} groups`);
if (declared.length < 5) { console.log('GATE PROPS: FAIL (could not read the table)'); process.exit(1); }

// ---- load the packs the build would load -----------------------------------
const packs = JSON.parse(fs.readFileSync(path.join(PROPS_DIR, 'props_packs.json'), 'utf8'));
const sandbox = { registerPropPack: CORE.registerPropPack, console };
vm.createContext(sandbox);
for (const f of packs)
  vm.runInContext(fs.readFileSync(path.join(PROPS_DIR, f), 'utf8'), sandbox, { filename: f });
const REG = CORE.PROP_REG;

// THE BYTES ARE EXTERNAL (2026-09-01): a prop names its bin under media/geo/
// and the decoders take those bytes as their last argument. The viewer
// fetches; this gate reads the same file with fs — same codec, same slices.
// The sandbox has no FLYDIY_ASSET_BASE, so the paths arrive unprefixed and
// resolve against the repo, which is exactly what is being checked.
const binCache = {};
function binOf(p) {
  if (!p || !p.bin) return undefined;                 // legacy b64 packs
  if (!(p.bin in binCache)) {
    const f = path.join(__dirname, '..', ...p.bin.split('/'));
    if (!fs.existsSync(f)) {
      fail(`${p.key}: names ${p.bin}, which is not on disk — bake and pack disagree`);
      return undefined;
    }
    binCache[p.bin] = new Uint8Array(fs.readFileSync(f));
  }
  return binCache[p.bin];
}

// ---- 1. the bake carries the whole table, in order --------------------------
if (REG.order.length !== declared.length)
  fail(`registry holds ${REG.order.length} props, the table declares ${declared.length}`);
else ok(`${REG.order.length} props registered`);
{
  // The registry is grouped, the table is written in group order, so the two
  // sequences must agree once the table is sorted by the declared group order.
  const want = declaredGroups
    .flatMap(g => declared.filter(d => d.group === g).map(d => d.key));
  const got = REG.order.join(',');
  if (want.join(',') !== got) fail(`order mismatch\n    want ${want.join(',')}\n    got  ${got}`);
  else ok('order matches the table, grouped');
}
for (const d of declared) {
  const p = REG.props[d.key];
  if (!p) { fail(`${d.key}: missing from the bake`); continue; }
  if (p.group !== d.group) fail(`${d.key}: group ${p.group} != declared ${d.group}`);
  if (p.label !== d.label) fail(`${d.key}: label "${p.label}" != declared "${d.label}"`);
}
if (!fails) ok('every declared key, group and label survived the bake');

// ---- 2. every prop decodes, and decodes to something physical ---------------
let tris = 0, verts = 0, parts = 0;
for (const key of REG.order) {
  const p = REG.props[key];
  let dec;
  try { dec = CORE.decodeProp(p, binOf(p)); }
  catch (e) { fail(`${key}: decode threw ${e.message}`); continue; }

  if (!/^[a-z][a-z0-9_]*$/.test(key)) fail(`${key}: key is not lowercase snake`);
  let nv = 0, nt = 0;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const part of dec.parts) {
    parts++;
    nv += part.nv; nt += part.nt;
    // material record present, and the maps it names are in the pack
    const rec = p.mats[part.mat];
    if (!rec) { fail(`${key}/${part.mat}: no material record`); continue; }
    for (const slot of ['map', 'arm', 'nor', 'emisMap'])
      if (rec[slot] && !REG.texs[rec[slot]]) fail(`${key}/${part.mat}: ${slot} points at a missing texture`);
    // THE ONE MATERIAL's invariant: occlusion is a channel of arm or nothing
    if (rec.ao && !rec.arm) fail(`${key}/${part.mat}: ao set with no arm map to read R from`);
    if (rec.nor && !(rec.norScl > 0)) fail(`${key}/${part.mat}: normal map with no scale`);
    // NOTHING HERE IS A PERFECT MIRROR. roughness 0 with no map to vary it is
    // what a lost conversion looks like — the trestle's spec-gloss glossiness
    // was read from an alpha channel its texture did not have, and it baked to
    // chrome. Glass is exempt: it is transparent and it is meant to be sharp.
    if (!rec.blend && rec.rough < 0.04 && !rec.arm)
      fail(`${key}/${part.mat}: roughness ${rec.rough} with no roughness map — a mirror`);

    for (let i = 0; i < part.nv; i++) {
      for (let k = 0; k < 3; k++) {
        const v = part.pos[i * 3 + k];
        if (!Number.isFinite(v)) { fail(`${key}: non-finite position`); i = part.nv; break; }
        lo[k] = Math.min(lo[k], v); hi[k] = Math.max(hi[k], v);
      }
    }
    // normals survived the int8 round trip as unit vectors
    let worst = 0;
    for (let i = 0; i < part.nv; i++) {
      const x = part.nrm[i * 3], y = part.nrm[i * 3 + 1], z = part.nrm[i * 3 + 2];
      worst = Math.max(worst, Math.abs(Math.hypot(x, y, z) - 1));
    }
    if (worst > 0.02) fail(`${key}/${part.mat}: normals off unit by ${worst.toFixed(4)}`);
    // indices address the vertices they were packed with
    let bad = 0;
    for (let i = 0; i < part.idx.length; i++) if (part.idx[i] >= part.nv) bad++;
    if (bad) fail(`${key}/${part.mat}: ${bad} indices past the vertex count`);
    if (part.idx.length !== part.nt * 3) fail(`${key}/${part.mat}: index count != 3 * nt`);
    // the uint16 index range is a PER-PART limit: the parts are separate
    // buffers, so a prop may hold far more than 65 536 vertices in total
    // (cart_tool_cab holds 70 012 across nine of them).
    if (part.nv > 65536) fail(`${key}/${part.mat}: ${part.nv} verts, past the uint16 index range`);
    if (!Number.isFinite(part.uv[0])) fail(`${key}/${part.mat}: non-finite uv`);
  }
  if (nv !== p.nv || nt !== p.nt)
    fail(`${key}: decoded ${nv}v/${nt}t, payload header says ${p.nv}v/${p.nt}t`);

  // the declared bb really bounds the decoded geometry
  const step = [0, 1, 2].map(k => (p.bb[k + 3] - p.bb[k]) / 65535 * 1.5 + 1e-6);
  for (let k = 0; k < 3; k++) {
    if (lo[k] < p.bb[k] - step[k] || hi[k] > p.bb[k + 3] + step[k])
      fail(`${key}: axis ${k} decodes to ${lo[k].toFixed(4)}..${hi[k].toFixed(4)}, bb says ${p.bb[k].toFixed(4)}..${p.bb[k + 3].toFixed(4)}`);
    const d = p.bb[k + 3] - p.bb[k];
    if (Math.abs(d - p.dim[k]) > 1e-3) fail(`${key}: dim[${k}] ${p.dim[k]} != bb extent ${d.toFixed(4)}`);
  }
  // THE ORIGIN RULE. A prop that stands on something was baked with its
  // footprint centred and its underside on y=0 — this is the promise every
  // placement site relies on, so it is asserted here and nowhere else.
  if (p.place === 'floor' || p.place === 'surface') {
    if (Math.abs(p.bb[1]) > 2e-3) fail(`${key}: place=${p.place} but the base sits at y=${p.bb[1]}`);
    if (Math.abs(p.bb[0] + p.bb[3]) > 2e-3 || Math.abs(p.bb[2] + p.bb[5]) > 2e-3)
      fail(`${key}: place=${p.place} but the footprint is off centre`);
  }
  // nothing in a hangar is a millimetre or a hundred metres
  const big = Math.max(p.dim[0], p.dim[1], p.dim[2]);
  if (big < 0.05 || big > 12) fail(`${key}: ${big.toFixed(3)} m is not hangar furniture`);
  tris += nt; verts += nv;
}

// ---- 3. the pack files are what the build will inline ----------------------
{
  const seen = new Set();
  for (const key of REG.order) {
    if (seen.has(key)) fail(`${key}: duplicate key across packs`);
    seen.add(key);
  }
  let bytes = 0;
  for (const f of packs) bytes += fs.statSync(path.join(PROPS_DIR, f)).size;
  ok(`${packs.length} packs, ${(bytes / 1048576).toFixed(2)} MB of payload`);
  const gone = declaredGroups.filter(g => !REG.groups.some(x => x[0] === g)
    && declared.some(d => d.group === g));
  if (gone.length) fail(`groups declared with props but not baked: ${gone.join(', ')}`);
}

console.log(`props ${REG.order.length}, parts ${parts}, ${verts} verts, ${tris} tris, ` +
            `${Object.keys(REG.texs).length} unique textures`);
console.log(`GATE PROPS: ${fails ? 'FAIL (' + fails + ' check' + (fails > 1 ? 's' : '') + ')' : 'PASS'}`);
process.exit(fails ? 1 : 0);
