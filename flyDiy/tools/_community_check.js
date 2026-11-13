#!/usr/bin/env node
// GATE COMMUNITY (COMMUNITY-AIRPORT, 13 Nov 2026) - THE COMMUNITY FIELD AT w7 IN THREE STAGES, AS DATA, THE PHYSICS FOLLOWING.
//
// The user (13 Nov): today's New Community Runway (w7, 1 020 m dirt, 9 m) is the MIDDLE stage; before it a shorter,
// narrower, bumpier strip on sticky mud, on the same axis, with a plain path on that axis to both ends; after the last pass
// a wider, smoother gravel strip with minimal infrastructure. Each stage is data a project's step switches (the `community`
// track: 76_stages.js STAGE_SITE_TRACKS, read off career.sites.community - 73b careerProjectsTick's site { id, state }); the
// strip's rows are w7's stage.vary (tools/jolene_stages.json, written by tools/community_author.py), the Skyline
// altiport's precedent (resort:3, 320 -> 380 m).
//
//   node tools/_community_check.js            -> "GATE COMMUNITY: PASS|FAIL"
//   node tools/_community_check.js --show     -> every line, passed ones too, and the table per stage
//   node tools/_community_check.js --selftest -> each rule red on a doctored input (negative verification)
//
//   1 THE TRACK: `community` is a site's track, max 2, in stageMaxes; stageTracksOf reads career.sites.community (clamped
//     0..2; absent: 0, the project not begun); its two unlocks reveal at w7 with a camera target and captions that resolve
//   2 THE STRIP AT EACH STAGE, READ OFF THE COMPOSED WORLD (the physics, not the record): w7's aerodrome row (length,
//     width, surface code, look, the micro's chaos) is the stage's - 0: 600 x 8 m MUD_FIRM (11) 'mud' chaos 0.45;
//     1: 1 020 x 9 m GRAVEL (6) 'dirt' chaos 0.25 (today's strip); 2 (the sandbox): 1 020 x 15 m GRAVEL 'gravel', no
//     bumps - its centre and heading the same at every stage (one axis); the wheels' surface (W.surface) on the centreline
//     and just inside each edge is the stage's code over the strip's length; the ground's 2 m bump (terrainH) falls with
//     each pass (0 > 1 > 2, the last under 2 mm: the raster's own lattice)
//   3 THE AXIS AND ITS PATHS: at stage 0 a plain track on the axis (a 3.6 m ground band - the dirt look and the wheels'
//     gravel surface - its centreline within 0.5 m of the axis) from each end of the mud strip to the full length's end, where the roads to the village (r37) and to the east (r38) begin -
//     so the axis and the ways to it exist from the start; at 1 and 2 no path (the strip covers the axis); r37 / r38 begin
//     at the full ends at every stage
//   4 THE SCENERY AT EACH STAGE: every sg_ca_ entry of the record stands at the stage its band says and only then; every
//     building a catalogue entry, every prop a registry prop with a box (no new asset); no tree object (trees only by the
//     tree system: the yard is an exclude); every solid thing 25 m or more off the centreline but the drum markers, which
//     stand 8 m off the edge of the stage's strip; each stage adds things (the reveal shows progress) and the count per
//     stage stays under 70 solid things (instanced props and the catalogue's own LODs; nothing per frame)
//   5 THE SANDBOX: every track at its max is the last stage (gravel, 15 m) - the island's record as it ships
// ~40 s (the island composed 3 times).
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname;
const SELF = process.argv.includes('--selftest'), SHOW = process.argv.includes('--show');
const K = require(path.join(T, 'premises_cook.js'));
const { C, PG, GENS, CAT } = K.headless();
const L = require(path.join(T, '_taxiclear_lib.js'));
const FX = path.join(T, 'fixtures', 'island_jolene.json');

let bad = 0;
const check = (ok, what, detail) => {
  if (!ok) bad++;
  if (!ok || SHOW) console.log((ok ? '  ok   ' : '  FAIL ') + what + (detail ? '  (' + detail + ')' : ''));
  return ok;
};
const MAX = C.stageMaxes();
// THE STAGES' ROWS (the user's brief, 13 Nov; the numbers tools/community_author.py writes)
const WANT = [
  { len: 600, wid: 8, surface: 11, look: 'mud', chaos: 0.45 },
  { len: 1020, wid: 9, surface: 6, look: 'dirt', chaos: 0.25 },
  { len: 1020, wid: 15, surface: 6, look: 'gravel', chaos: 0 },
];
const MARK_OFF = 8, SOLID_OFF = 25, PER_STAGE_MAX = 70;
const PROPS = (() => { const f = n => new Set((fs.readFileSync(path.join(T, n), 'utf8').match(/P\('([a-z0-9_]+)'/g) || []).map(s => s.slice(3, -1))); return new Set([...f('props_table.py'), ...f('pier_table.py')]); })();
const BB = L.propBoxes(C);

// ---- the rules, each a function of its inputs ------------------------------------------------------------------------
const R = {};
// 1
R.track = (C0) => {
  const why = [], M = C0.stageMaxes();
  if (!C0.STAGE_SITE_TRACKS || !C0.STAGE_SITE_TRACKS.community) why.push('no site track community');
  if (M.community !== 2) why.push('community max ' + M.community + ', not 2');
  const tr = sites => C0.stageTracksOf({ career: { tracks: {}, sites } });
  if (tr(undefined).community !== 0) why.push('a career with no project reads ' + tr(undefined).community + ', not 0');
  for (const [s, w] of [[0, 0], [1, 1], [2, 2], [5, 2], [-1, 0]]) if (tr({ community: s }).community !== w) why.push('career.sites.community ' + s + ' reads ' + tr({ community: s }).community + ', not ' + w);
  for (const u of ['community:1', 'community:2']) {
    const E = C0.STAGE_REVEALS[u];
    if (!E || E.at !== 'w7' || E.world !== true) why.push(u + ': no reveal at w7 that says the world changes');
    else if (!C0.contractTextOk(E.caption)) why.push(u + ': its caption ' + E.caption + ' does not resolve');
  }
  return why;
};
// 2: a composed world at stage n -> its rows and what the wheels read
R.strip = (O, W, n) => {
  const why = [], w = WANT[n], a = O.aerodromes.find(q => q.id === 'w7');
  if (!a) return { why: ['no w7'], row: null };
  const chaos = a.micro ? a.micro.chaos : 0;
  const row = { len: a.len, wid: a.wid, surface: a.surface, look: a.look, chaos, x: +a.x.toFixed(2), z: +a.z.toFixed(2), hdg: +a.hdg.toFixed(5) };
  for (const k of ['len', 'wid', 'surface', 'look']) if (row[k] !== w[k]) why.push('stage ' + n + ': ' + k + ' ' + row[k] + ', not ' + w[k]);
  if (Math.abs(chaos - w.chaos) > 1e-9) why.push('stage ' + n + ': chaos ' + chaos + ', not ' + w.chaos);
  const ux = Math.cos(a.hdg), uz = Math.sin(a.hdg), nx = -uz, nz = ux;
  let on = 0, tot = 0;
  const hs = [];
  for (let s = -a.len / 2 + 6; s <= a.len / 2 - 6; s += 2) {
    for (const v of [0, a.wid / 2 - 0.6, -(a.wid / 2 - 0.6)]) { tot++; if (W.surface(a.x + ux * s + nx * v, a.z + uz * s + nz * v) === w.surface) on++; }
    hs.push(W.terrainH(a.x + ux * s, a.z + uz * s));
  }
  let d2 = 0, m = 0; for (let i = 1; i < hs.length - 1; i++) { const e = hs[i] - (hs[i - 1] + hs[i + 1]) / 2; d2 += e * e; m++; }
  row.onSurf = +(on / tot).toFixed(4); row.bumpMm = +(1000 * Math.sqrt(d2 / m)).toFixed(2);
  if (row.onSurf < 0.98) why.push('stage ' + n + ': the wheels read the stage\'s surface ' + w.surface + ' on ' + (100 * row.onSurf).toFixed(1) + ' % of the strip (centreline and inside both edges)');
  return { why, row, a };
};
R.ordered = rows => {
  const why = [];
  if (!(rows[0].bumpMm > rows[1].bumpMm && rows[1].bumpMm > rows[2].bumpMm)) why.push('the bumps do not fall with each pass: ' + rows.map(r => r.bumpMm).join(' > ') + ' mm');
  if (!(rows[2].bumpMm < 2)) why.push('the last pass is not graded smooth: ' + rows[2].bumpMm + ' mm');
  for (const k of ['x', 'z', 'hdg']) if (!(rows[0][k] === rows[1][k] && rows[1][k] === rows[2][k])) why.push('the axis moves between the stages (' + k + ' ' + rows.map(r => r[k]).join(' / ') + ')');
  return why;
};
// 3: the record at stage n (stageView) and the composed strip
R.paths = (rec, a, n, full) => {
  const why = [], ux = Math.cos(a.hdg), uz = Math.sin(a.hdg);
  const along = p => (p[0] - a.x) * ux + (p[1] - a.z) * uz, across = p => -(p[0] - a.x) * uz + (p[1] - a.z) * ux;
  // a path is a ground band (material sg_ca_path_*, a 4-point polygon along the axis): its centreline the mids of its ends
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const P = (rec.layers.material || []).filter(r => /^sg_ca_path_/.test(String(r.id))).map(r => ({ id: r.id, pts: r.poly.length === 4 ? [mid(r.poly[0], r.poly[3]), mid(r.poly[1], r.poly[2])] : r.poly }));
  if (n === 0) for (const m of P) if (!(rec.layers.surface || []).some(y => y.id === 'sg_ca_y_' + m.id.slice(6) && y.surface === 6)) why.push(m.id + ': no wheels\' surface under it');
  if (n > 0) { if (P.length) why.push('stage ' + n + ': ' + P.length + ' axis path(s) stand - the strip covers the axis'); }
  else {
    if (P.length !== 2) why.push('stage 0: ' + P.length + ' axis paths, not 2');
    let ends = 0;
    for (const r of P) {
      for (const p of r.pts) if (Math.abs(across(p)) > 0.5) why.push(r.id + ': a point ' + across(p).toFixed(2) + ' m off the axis');
      // one side of the axis: from the mud strip's end (within 3 m) to the full end (within 1 m)
      const s = r.pts.map(along), lo = Math.min(...s), hi = Math.max(...s);
      const sideOk = sg => Math.abs(sg * (sg > 0 ? lo : hi) - a.len / 2) < 3 && Math.abs(sg * (sg > 0 ? hi : lo) - full / 2) < 1;
      if (sideOk(1)) ends |= 1;
      else if (sideOk(-1)) ends |= 2;
      else why.push(r.id + ': runs ' + lo.toFixed(1) + ' .. ' + hi.toFixed(1) + ' m along, not the strip\'s end (' + (a.len / 2) + ') to the full end (' + (full / 2) + ')');
    }
    if (P.length === 2 && ends !== 3) why.push('stage 0: the paths do not join both ends of the mud strip to the full ends');
  }
  for (const id of ['r37', 'r38']) {
    const r = (rec.layers.roads || []).find(q => q.id === id);
    if (!r) { why.push('no road ' + id); continue; }
    const p = r.pts[0];
    if (Math.abs(across(p)) > 1.5 || Math.abs(Math.abs(along(p)) - full / 2) > 1.5) why.push(id + ' no longer begins at a full end of the axis (' + along(p).toFixed(1) + ', ' + across(p).toFixed(1) + ')');
  }
  return why;
};
// 4: what stands at stage n (the staged record), against the bands written in the whole record
R.scenery = (whole, rec, a, n) => {
  const why = [], ux = Math.cos(a.hdg), uz = Math.sin(a.hdg);
  const across = (x, z) => Math.abs(-(x - a.x) * uz + (z - a.z) * ux);
  const inBand = st => !st || (n >= st.show[0] && (st.show[1] === null || n <= st.show[1]));
  // every sg_ca_ entry stands exactly when its band says
  const wantIds = new Set(), haveIds = new Set();
  for (const Lr of Object.keys(whole.layers)) for (const e of whole.layers[Lr] || []) {
    if (!e || !/^sg_ca_/.test(String(e.id))) continue;
    if (!e.stage || e.stage.track !== 'community') why.push(e.id + ': no community band');
    if (inBand(e.stage)) wantIds.add(e.id);
    if (Lr === 'sites') for (const it of e.items || []) if (inBand(e.stage) && inBand(it.stage)) wantIds.add(e.id + '/' + it.id);
  }
  for (const Lr of Object.keys(rec.layers)) for (const e of rec.layers[Lr] || []) {
    if (!e || !/^sg_ca_/.test(String(e.id))) continue;
    haveIds.add(e.id);
    if (Lr === 'sites') for (const it of e.items || []) haveIds.add(e.id + '/' + it.id);
  }
  for (const id of wantIds) if (!haveIds.has(id)) why.push('stage ' + n + ': ' + id + ' should stand and does not');
  for (const id of haveIds) if (!wantIds.has(id)) why.push('stage ' + n + ': ' + id + ' stands outside its band');
  // the things: assets that exist, where they may stand
  let solid = 0;
  const yard = (rec.layers.sites || []).find(s => s.id === 'sg_ca_y');
  for (const o of rec.layers.objects || []) {
    if (!/^sg_ca_/.test(String(o.id))) continue;
    if (o.kind === 'tree') { why.push(o.id + ': a tree object - trees only by the tree system'); continue; }
    if (o.kind !== 'prop') { why.push(o.id + ': kind ' + o.kind + ', not a prop'); continue; }
    if (!PROPS.has(o.key) || !BB.has(o.key)) { why.push(o.id + ': ' + o.key + ' is not an existing prop with a registry box'); continue; }
    solid++;
    const d = across(o.x, o.z);
    if (o.key === 'drum_steel' && Math.abs(d - (a.wid / 2 + MARK_OFF)) < 0.05) continue;    // a marker on the stage's edge
    if (d < SOLID_OFF) why.push('stage ' + n + ': ' + o.id + ' (' + o.key + ') ' + d.toFixed(1) + ' m off the centreline');
  }
  if (yard) {
    const at = yard.at, c = Math.cos(at.yaw || 0), s = Math.sin(at.yaw || 0);
    for (const it of yard.items || []) {
      solid++;
      if (!CAT.entries.get(CAT.aliases[it.key] || it.key)) why.push('sg_ca_y/' + it.id + ': ' + it.key + ' is no catalogue entry');
      const x = at.x + it.x * c + it.z * s, z = at.z - it.x * s + it.z * c;
      if (across(x, z) < SOLID_OFF) why.push('stage ' + n + ': sg_ca_y/' + it.id + ' ' + across(x, z).toFixed(1) + ' m off the centreline');
    }
  }
  if (solid > PER_STAGE_MAX) why.push('stage ' + n + ': ' + solid + ' solid things, over ' + PER_STAGE_MAX);
  return { why, solid, ids: haveIds.size };
};

function compose(W, rec, tracks) {
  return W.premises.set(rec, { catalogue: CAT, globals: GENS, build: r => (GENS[r.gen] ? GENS[r.gen].build(r.P, 0) : null), pool: [], tracks });
}

function main() {
  console.log('GATE COMMUNITY');
  const t0 = Date.now(), txt = fs.readFileSync(FX, 'utf8'), whole = PG.unwrap(txt).rec;
  const r1 = R.track(C);
  check(!r1.length, '1 the community track: a site\'s track (max 2) read off career.sites.community, its two reveals at w7', r1[0] || '0 / 1 / 2, absent 0');
  const VD = K.VARIANTS.find(v => v.name === 'default');
  const W = K.islandWorld('jolene', VD, txt), recD = K.dropOf(PG, whole, VD);
  const full = (whole.layers.runways.find(r => r.id === 'w7') || {}).len;
  const rows = [], scen = [];
  for (let n = 0; n <= 2; n++) {
    const t = Object.assign({}, MAX, { community: n }), SV = PG.stageView(recD, t), O = compose(W, recD, t);
    const S = R.strip(O, W, n);
    rows.push(S.row);
    check(!S.why.length, '2 [stage ' + n + '] w7 is ' + WANT[n].len + ' x ' + WANT[n].wid + ' m ' + WANT[n].look + ' (surface ' + WANT[n].surface + ', chaos ' + WANT[n].chaos + ') - the wheels read it', S.why[0] || ('on ' + (100 * S.row.onSurf).toFixed(1) + ' %, bump ' + S.row.bumpMm + ' mm'));
    const p3 = R.paths(SV.rec, S.a, n, full);
    check(!p3.length, '3 [stage ' + n + '] the axis: ' + (n ? 'no path on it (the strip covers it)' : 'a track on it from each end of the mud strip to the full ends') + '; r37 / r38 begin at the full ends', p3[0] || '');
    const s4 = R.scenery(whole, SV.rec, S.a, n);
    scen.push(s4);
    check(!s4.why.length, '4 [stage ' + n + '] the scenery stands by its bands; existing assets; 25 m off the centreline but the edge markers; under ' + PER_STAGE_MAX + ' solid things', s4.why[0] || s4.ids + ' entries, ' + s4.solid + ' solid things');
    const iss = PG.issues(SV.rec);
    check(!iss.length, '4 [stage ' + n + '] the staged record is valid', iss[0] || '');
  }
  const ro = R.ordered(rows);
  check(!ro.length, '2 one axis at every stage; the bumps fall with each pass, the last graded smooth', ro[0] || rows.map(r => r.bumpMm).join(' > ') + ' mm');
  check(scen[0].ids < scen[1].ids + 20 && scen[1].solid > scen[0].solid - 20 && scen[2].solid >= scen[1].solid - 25, '4 each stage shows the work: the yard grows (the solid things per stage)', scen.map(s => s.solid).join(' / '));
  const OM = compose(W, recD, Object.assign({}, MAX)), OS = compose(W, recD, undefined);
  const aM = OM.aerodromes.find(q => q.id === 'w7'), aS = OS.aerodromes.find(q => q.id === 'w7');
  check(aS && aM && aS.len === 1020 && aS.wid === 15 && aS.look === 'gravel' && !aS.micro && JSON.stringify(aM) === JSON.stringify(aS), '5 the sandbox is the last stage: w7 1 020 x 15 m gravel, graded smooth, = every track at its max', aS ? aS.len + ' x ' + aS.wid + ' ' + aS.look : 'missing');
  if (SHOW) {
    console.log('  stage | len  | wid | surface | look   | chaos | bump (2 m) | solid things');
    rows.forEach((r, n) => console.log('  ' + n + '     | ' + String(r.len).padEnd(4) + ' | ' + String(r.wid).padEnd(3) + ' | ' + String(r.surface).padEnd(7) + ' | ' + r.look.padEnd(6) + ' | ' + String(r.chaos).padEnd(5) + ' | ' + (r.bumpMm + ' mm').padEnd(10) + ' | ' + scen[n].solid));
  }
  compose(W, recD, undefined);
  console.log('  3 stages composed in ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
  console.log('GATE COMMUNITY: ' + (bad ? 'FAIL (' + bad + ')' : 'PASS'));
  process.exit(bad ? 1 : 0);
}

// ---- NEGATIVE VERIFICATION -----------------------------------------------------------------------------------------
function selftest() {
  console.log('GATE COMMUNITY --selftest');
  let n = 0, red = 0;
  const must = (isRed, what) => { n++; if (isRed) red++; console.log((isRed ? '  red  ' : '  MISS ') + what); };
  // 1: a track whose site is read wrong / whose reveal is missing
  const C1 = Object.assign({}, C, { stageTracksOf: d => Object.assign(C.stageTracksOf(d), { community: 1 }) });
  must(R.track(C1).length > 0, '1 a career with no project read at stage 1');
  const C2 = Object.assign({}, C, { STAGE_REVEALS: Object.assign({}, C.STAGE_REVEALS, { 'community:2': undefined }) });
  must(R.track(C2).length > 0, '1 a stage with no reveal');
  // 2: the strip's rows - a wrong width, a surface the wheels do not read, bumps that do not fall
  const fakeA = (o) => ({ aerodromes: [Object.assign({ id: 'w7', x: 0, z: 0, hdg: 0, len: 600, wid: 8, surface: 11, look: 'mud', micro: { chaos: 0.45 } }, o)] });
  const W11 = { surface: () => 11, terrainH: () => 0 }, W6 = { surface: () => 6, terrainH: () => 0 };
  must(!R.strip(fakeA({}), W11, 0).why.length && R.strip(fakeA({ wid: 9 }), W11, 0).why.length > 0, '2 the mud strip 9 m wide (the record kept today\'s width)');
  must(R.strip(fakeA({}), W6, 0).why.length > 0, '2 the record says mud and the wheels read gravel (the physics not following)');
  must(R.strip(fakeA({ micro: null }), W11, 0).why.length > 0, '2 the mud strip with no bumps');
  must(R.ordered([{ bumpMm: 5, x: 0, z: 0, hdg: 0 }, { bumpMm: 6, x: 0, z: 0, hdg: 0 }, { bumpMm: 0.1, x: 0, z: 0, hdg: 0 }]).length > 0, '2 a pass that makes the strip bumpier');
  must(R.ordered([{ bumpMm: 5, x: 0, z: 0, hdg: 0 }, { bumpMm: 2, x: 3, z: 0, hdg: 0 }, { bumpMm: 0.1, x: 0, z: 0, hdg: 0 }]).length > 0, '2 a stage off the axis');
  // 3: a path off the axis, a path at stage 1, a path that stops short
  const a = { x: 0, z: 0, hdg: 0, len: 600 };
  const road = (id, pts) => ({ id, pts });
  const band = (id, a, b) => ({ id, poly: [[a[0], a[1] - 1.8], [b[0], b[1] - 1.8], [b[0], b[1] + 1.8], [a[0], a[1] + 1.8]] });
  const L3 = (bands, roads) => ({ layers: { roads: roads || base, material: bands, surface: bands.map(b => ({ id: 'sg_ca_y_' + b.id.slice(6), surface: 6 })) } });
  const base = [road('r37', [[510, 0], [600, 0]]), road('r38', [[-510, 0], [-600, 0]])];
  const ok3 = L3([band('sg_ca_path_e', [-510, 0], [-302, 0]), band('sg_ca_path_w', [302, 0], [510, 0])]);
  must(!R.paths(ok3, a, 0, 1020).length, '3 (the calibration: the right paths pass)');
  must(R.paths(L3([band('sg_ca_path_e', [-510, 2], [-302, 0]), band('sg_ca_path_w', [302, 0], [510, 0])]), a, 0, 1020).length > 0, '3 a path 2 m off the axis');
  must(R.paths(L3([band('sg_ca_path_e', [-450, 0], [-302, 0]), band('sg_ca_path_w', [302, 0], [510, 0])]), a, 0, 1020).length > 0, '3 a path that stops 60 m short of the full end');
  { const nos = L3([band('sg_ca_path_e', [-510, 0], [-302, 0]), band('sg_ca_path_w', [302, 0], [510, 0])]); nos.layers.surface = [];
    must(R.paths(nos, a, 0, 1020).length > 0, '3 a path drawn with no wheels\' surface under it'); }
  must(R.paths(ok3, Object.assign({}, a, { len: 1020 }), 1, 1020).length > 0, '3 a path still standing on the full strip');
  must(R.paths(L3([], [road('r37', [[540, 30]]), base[1]]), Object.assign({}, a, { len: 1020 }), 1, 1020).length > 0, '3 the road to the village moved off the end');
  // 4: a tree object, a prop too close, a new asset, an entry outside its band
  const whole = { layers: { objects: [], sites: [] } };
  const recO = o => ({ layers: { objects: [o], sites: [] } });
  const A4 = { x: 0, z: 0, hdg: 0, wid: 15 };
  const st = { track: 'community', show: [0, null] };
  must(R.scenery({ layers: { objects: [Object.assign({ id: 'sg_ca_t', kind: 'tree', key: 'spruce', x: 0, z: 40 }, { stage: st })], sites: [] } }, recO({ id: 'sg_ca_t', kind: 'tree', key: 'spruce', x: 0, z: 40 }), A4, 2).why.length > 0, '4 a mesh tree');
  must(R.scenery({ layers: { objects: [{ id: 'sg_ca_p', kind: 'prop', key: 'tractor_farm', x: 0, z: 12, stage: st }], sites: [] } }, recO({ id: 'sg_ca_p', kind: 'prop', key: 'tractor_farm', x: 0, z: 12 }), A4, 2).why.length > 0, '4 a tractor 12 m off the centreline');
  must(R.scenery({ layers: { objects: [{ id: 'sg_ca_p', kind: 'prop', key: 'wind_turbine', x: 0, z: 40, stage: st }], sites: [] } }, recO({ id: 'sg_ca_p', kind: 'prop', key: 'wind_turbine', x: 0, z: 40 }), A4, 2).why.length > 0, '4 a new asset (no such prop)');
  must(R.scenery({ layers: { objects: [{ id: 'sg_ca_p', kind: 'prop', key: 'tyre', x: 0, z: 40, stage: { track: 'community', show: [0, 0] } }], sites: [] } }, recO({ id: 'sg_ca_p', kind: 'prop', key: 'tyre', x: 0, z: 40 }), A4, 2).why.length > 0, '4 a stage-0 prop standing at stage 2');
  must(R.scenery(whole, { layers: { objects: [{ id: 'sg_ca_p', kind: 'prop', key: 'drum_steel', x: 0, z: 12.5 }], sites: [] } }, A4, 2).why.length > 0, '4 a drum marker at stage 1\'s edge on the wider strip (and outside its band)');
  console.log('  ' + red + ' of ' + n + ' red');
  console.log('GATE COMMUNITY --selftest: ' + (red === n ? 'PASS' : 'FAIL'));
  process.exit(red === n ? 0 : 1);
}

if (SELF) selftest(); else main();
module.exports = { R, WANT };
