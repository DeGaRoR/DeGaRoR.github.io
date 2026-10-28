#!/usr/bin/env node
// GATE HANDLE (DOOR-HINGES-2, 2026-10-27) — no handle is on the glass.
//
//   node tools/_handle_check.js            -> "GATE HANDLE: PASS|FAIL"
//   node tools/_handle_check.js --selftest -> negative verification
//
// A0 and the user, on the door stills: "The door handle is wrongly placed. It
// must NEVER sit on top of a window or any glazing. Place it on the door's
// solid (skinned) panel: below the window's sill, at a sensible hand height,
// near the edge opposite the hinges. If the door has no solid area big
// enough, put it on the frame or rail, not on the glass."
//
// Measured on the master placement (FIT_SITE.doorHandleSite at 0.62 of the
// opposite run): the door handle's U stood across the sill on the page
// default, the Cub, the Jodel, the stock and player builds, the pusher, the
// STOL Cub - 53 to 142 of its 321 vertices over glass; the PA-18's and the
// STOL Cub's grab handle 12.
//
// WHAT IT HOLDS, on the page default, every build under builds/ and
// bugReports/, every versioned build / player / showcase fixture, and every
// archetype card (CAGE_DESIGN.designBake, the birth flow's own path):
//   ON GLASS   no vertex of any handle (every GEN_ACCESS row drawn by the
//              `handleGrab` form: the door handle, the grab handle) is nearer
//              a glazed face of the sheet (`win`) than a solid one, within
//              8 cm - the handle's own triangles, read back out of the
//              access layer's merged bags by its recorded range
//   PLACED     every door side gets its handle (no silent loss to the rule)
//   BELOW THE SILL  a door handle on a door with a window: its highest
//              vertex under the window's lowest point
//   HAND HEIGHT  its centre in the door's upper three quarters below the
//              sill (not dropped to the belly by the search)
//   OPPOSITE   nearer the edge opposite the hinges than the hinge edge
// NEGATIVES (the rule's other two branches, on the stock Cub):
//   ALL GLASS  the door's own faces forced to glass (the layer run over a
//              sheet whose door is glazed whole) -> the handle stands on the
//              frame (onFrame), off the door's faces, still off all glass
//   NO ROOM    the door and the frame round it all glass -> no site (the row
//              is reported unplaced), never a handle on the glass
'use strict';
const fs = require('fs');
const path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const CORE = require(path.join(T, 'flight_core.js'));
const SH = require(path.join(T, '_scene_headless.js'));
const MQ = require(path.join(T, '_mesh_query.js'));
// the user's validated builds come in through THE ONE LOAD PATH (GATE
// JOINPARITY): the spec the game builds from the file, its cage riding along
const LB = require(path.join(T, '_load_build.js'));
const VALID = new Map(Object.entries(LB.VALIDATED).filter(([, b]) => !b.patch).map(([k, b]) => [path.normalize(b.build), k]));
const specOf = rel => {
  const raw = SH.loadFixture(path.join(ROOT, rel)).spec;
  if (!VALID.has(path.normalize(rel))) return raw;
  const g = LB.loadValidated(VALID.get(path.normalize(rel))).spec;
  if (!g.cage) g.cage = raw.cage;
  return g;
};

const SELF = process.argv.includes('--selftest');
const VERBOSE = process.argv.includes('--verbose');
const fails = [];
const check = (ok, label, extra) => { if (!ok) fails.push(label + (extra != null ? ' — ' + extra : '')); return ok; };

const W0 = SH.context().ctx;
const HANDLES = new Set(Object.keys(CORE.GEN_ACCESS).filter(k => CORE.GEN_ACCESS[k].form === 'handleGrab'));
check(HANDLES.has('doorHandle') && HANDLES.has('grabHandle'), 'the handle rows are not both handleGrab forms', [...HANDLES].join());

// every vertex of one placed fitting, out of the access layer's merged bags
function verticesOf(S, rec, move) {
  const grp = S.scene.children.find(o => o.name === 'cageLayer:access');
  const out = [];
  if (!grp) return out;
  grp.traverse(m => {
    if (!m.isMesh || !m.userData.fitBag || (m.userData.fitHost || '') !== (rec.host || '')) return;
    const r = rec.tris && rec.tris[m.userData.fitBag];
    if (!r || r[1] <= r[0]) return;
    const pos = m.geometry.attributes.position, idx = m.geometry.index.array, seen = new Set();
    for (let t = r[0]; t < r[1]; t++) for (let k = 0; k < 3; k++) {
      const vi = idx[3 * t + k];
      if (seen.has(vi)) continue; seen.add(vi);
      const v = [pos.getX(vi), pos.getY(vi), pos.getZ(vi)];
      out.push(move ? move(v) : v);
    }
  });
  return out;
}
// the vertices nearer glass than solid skin (within 8 cm)
function overGlass(S, verts) {
  const M = S.built.sheet;
  if (!S._glass) {
    S._glass = MQ.triSet(M, { scale: S.FS, faces: f => !!f.win });
    S._solid = MQ.triSet(M, { scale: S.FS, faces: f => !f.win && !f.shoulder && !f.doorPanel });
  }
  let n = 0;
  for (const v of verts) {
    const g = S._glass.nearest(v, 0.08), s = S._solid.nearest(v, 0.08);
    const dg = g ? Math.abs(g.d) : Infinity, ds = s ? Math.abs(s.d) : Infinity;
    if (dg < 0.08 && dg <= ds + 0.0005) n++;
  }
  return n;
}

function holdBuild(id, S) {
  const W = S.W;
  if (!W.CAGE_ACCESS) { check(false, id + ': the access layer did not run'); return null; }
  const placed = W.CAGE_ACCESS.placed.filter(p => HANDLES.has(p.key));
  const recs = W.CAGE2.cageDoorEdges(S.built.sheet);
  const wantDoor = (W.CAGE_ACCESS.rows || []).some(r => r.key === 'doorHandle') || placed.some(p => p.key === 'doorHandle');
  const doorH = placed.filter(p => p.key === 'doorHandle');
  if (wantDoor && recs.length)
    check(doorH.length === recs.length, id + ': a door side lost its handle', doorH.length + ' handles, ' + recs.length + ' door sides' +
          (W.CAGE_ACCESS.unplaced.some(r => r.key === 'doorHandle') ? ' (reported unplaced)' : ''));
  const lines = [];
  for (const p of placed) {
    const verts = verticesOf(S, p);
    const n = overGlass(S, verts);
    check(verts.length > 20, id + ': ' + p.key + '/' + p.side + ' drew no geometry', verts.length);
    check(n === 0, id + ': ' + p.key + '/' + p.side + ' is on the glass', n + ' of ' + verts.length + ' vertices over a glazed face');
    let tag = p.key + '/' + p.side + ' ' + n + '/' + verts.length;
    if (p.key === 'doorHandle' && !p.onFrame) {
      const rec = recs.find(r => (r.sgn > 0 ? 'star' : 'port') === p.side) || recs[0];
      if (rec) {
        const FS = S.FS, yTop = Math.max(...verts.map(v => v[1]));
        const ys = [].concat(rec.top.pts, rec.bot.pts).map(q => q[1] * FS), y0 = Math.min(...ys), y1 = Math.max(...ys);
        const sill = rec.winLo != null ? rec.winLo * FS : null;
        if (sill != null) check(yTop < sill, id + ': ' + p.key + '/' + p.side + ' reaches over the window sill', (yTop * 1000).toFixed(0) + ' vs sill ' + (sill * 1000).toFixed(0) + ' mm');
        const top = sill != null ? Math.min(sill, y1) : y1;
        check(p.p[1] > y0 + 0.25 * (top - y0), id + ': ' + p.key + '/' + p.side + ' sits too low for a hand', ((p.p[1] - y0) / (top - y0)).toFixed(2) + ' of the solid panel');
        const edge = Math.round(+S.P.hgDoorEdge || 0);
        const near = edge === 2 ? rec.fwd : rec.aft, far = edge === 2 ? rec.aft : rec.fwd;
        const zN = (near.A[2] + near.B[2]) * 0.5 * FS, zF = (far.A[2] + far.B[2]) * 0.5 * FS;
        check(Math.abs(p.p[2] - zN) < Math.abs(p.p[2] - zF), id + ': ' + p.key + '/' + p.side + ' is on the hinge edge, not opposite it');
        tag += ' ' + ((p.p[1] - y0) / (top - y0)).toFixed(2) + 'h';
      }
    }
    if (p.onFrame) tag += ' (frame)';
    lines.push(tag);
  }
  if (VERBOSE) console.log('   ' + id.padEnd(58) + (lines.join('  ') || '(no handles)'));
  return placed;
}

const items = [['page default', () => SH.sceneBuild(null, {})]];
const listFiles = (dir, re) => { const d = path.join(ROOT, dir); return fs.existsSync(d) ? fs.readdirSync(d).filter(f => re.test(f)).sort().map(f => path.join(dir, f)) : []; };
for (const f of [].concat(listFiles('builds', /\.json$/i), listFiles('bugReports', /\.json$/i),
                          listFiles('tools/fixtures', /^(build_v|player_v|stol_cub).*\.json$/i))) {
  let spec = null;
  try { spec = specOf(f); } catch (e) { check(false, f + ': did not load', e.message); continue; }
  if (!spec || !spec.cage) continue;
  items.push([f, () => SH.sceneBuild(spec, {})]);
}
// the archetype table: _cage_design.js is not in the scene harness's set
// (EXCLUDE), so it is run into the same context here
if (!W0.CAGE_DESIGN) require('vm').runInContext(fs.readFileSync(path.join(T, '_cage_design.js'), 'utf8'), W0, { filename: '_cage_design.js' });
const D = W0.CAGE_DESIGN;
check(!!(D && D.ARCHETYPES && D.ARCHETYPES.length), 'no archetype table (CAGE_DESIGN.ARCHETYPES)');
for (const a of (D && D.ARCHETYPES) || []) items.push(['arch: ' + a.name, () => SH.sceneBuild(D.designBake(a.sel, a.over), {})]);

let nB = 0, nH = 0, nD = 0;
if (!SELF) for (const [id, fn] of items) {
  let S;
  try { S = fn(); } catch (e) { check(false, id + ': did not build', e.message); continue; }
  const P = holdBuild(id, S);
  if (P) { nB++; nH += P.length; nD += P.filter(p => p.key === 'doorHandle').length; }
}

// ---- the negatives, through the real layer ----------------------------------
// the user's Cub (LB.VALIDATED.cub), its sheet glazed at the build: the layer
// itself runs over it (CAGE2.cageSheet wrapped for one build)
const CUB_SPEC = () => specOf(LB.VALIDATED.cub.build);
function glazedBuild(mark) {
  const CG2 = W0.CAGE2, orig = CG2.cageSheet;
  CG2.cageSheet = function (P, o) {
    const b = orig.call(this, P, o);
    const recs = CG2.cageDoorEdges(b.sheet);
    for (const f of b.sheet.F) if (mark(f, b.sheet, recs)) f.win = 1;
    return b;
  };
  try { return SH.sceneBuild(CUB_SPEC(), {}); }
  finally { CG2.cageSheet = orig; }
}
let negA = null, negB = null;
if (!SELF) {
  // ALL GLASS: every face of the door is glass
  const SA = glazedBuild(f => !!f.doorKey && !f.shoulder && !f.doorPanel);
  const dA = SA.W.CAGE_ACCESS.placed.filter(p => p.key === 'doorHandle');
  const recsA = SA.W.CAGE2.cageDoorEdges(SA.built.sheet);
  check(dA.length === recsA.length && recsA.length > 0, 'ALL GLASS: a door side lost its handle', dA.length + ' of ' + recsA.length);
  for (const p of dA) {
    check(p.onFrame === true, 'ALL GLASS: ' + p.side + ' handle did not go to the frame');
    const n = overGlass(SA, verticesOf(SA, p));
    check(n === 0, 'ALL GLASS: ' + p.side + ' handle is on the glass', n);
    // off the door: its site is not on a door face (the nearest face of the sheet to it is not the door's)
    const doorSet = MQ.triSet(SA.built.sheet, { scale: SA.FS, faces: f => !!f.doorKey && !f.shoulder && !f.doorPanel });
    const offSet = MQ.triSet(SA.built.sheet, { scale: SA.FS, faces: f => !f.doorKey && !f.shoulder && !f.doorPanel });
    const a = doorSet.nearest(p.p, 0.1), b = offSet.nearest(p.p, 0.1);
    check(!!b && (!a || Math.abs(b.d) < Math.abs(a.d)), 'ALL GLASS: ' + p.side + ' handle is not on the frame', (a ? (Math.abs(a.d) * 1000).toFixed(1) : '-') + ' mm to the door, ' + (b ? (Math.abs(b.d) * 1000).toFixed(1) : '-') + ' to the frame');
  }
  negA = dA.length;
  // NO ROOM: the door's whole side is glass from 0.6 m ahead of the door to
  // 0.6 m behind it (further than the frame search reaches)
  const SB = glazedBuild((f, M, recs) => {
    if (f.shoulder || f.doorPanel) return false;
    const c = f.v.reduce((a, i) => [a[0] + M.V[i][0], a[1] + M.V[i][1], a[2] + M.V[i][2]], [0, 0, 0]).map(x => x / f.v.length);
    return recs.some(r => {
      if (c[0] * r.sgn <= 0) return false;
      const zs = [].concat(r.fwd.pts, r.aft.pts).map(q => q[2]);
      const m = 0.6 / (SH.context().ctx.CAGE2.CAGE_UNIT || 1);
      return c[2] > Math.min(...zs) - m && c[2] < Math.max(...zs) + m;
    });
  });
  const dB = SB.W.CAGE_ACCESS.placed.filter(p => p.key === 'doorHandle');
  check(dB.length === 0, 'NO ROOM: a handle was drawn with no clear skin round the door', dB.map(p => p.side + (p.onFrame ? ' frame' : ' door')).join());
  check(SB.W.CAGE_ACCESS.unplaced.some(r => r.key === 'doorHandle'), 'NO ROOM: the handle is not reported unplaced');
  negB = dB.length;
}

// ---- selftest ----------------------------------------------------------------
if (SELF) {
  const probes = [];
  const say = (ok, what) => probes.push((ok ? '  ok   ' : '  MISS ') + what);
  const S = SH.sceneBuild(CUB_SPEC(), {});
  const p = S.W.CAGE_ACCESS.placed.find(q => q.key === 'doorHandle');
  const rec = S.W.CAGE2.cageDoorEdges(S.built.sheet).find(r => (r.sgn > 0 ? 'star' : 'port') === p.side);
  const lift = rec.winLo * S.FS - p.p[1] + 0.03;      // the handle carried 30 mm up past the sill: onto the glass
  say(overGlass(S, verticesOf(S, p)) === 0, 'the placed handle reads clear');
  say(overGlass(S, verticesOf(S, p, v => [v[0], v[1] + lift, v[2]])) > 0, 'a handle moved onto the window is caught by ON GLASS');
  // the master placement's site (no sheet handed over: the 0.62 rule) straddles the sill
  const old = S.W.FIT_SITE.doorHandleSite(rec, { edge: Math.round(+S.P.hgDoorEdge || 0), inset: 0.06 / S.FS });
  say(old && Math.abs(old.p[1] * S.FS - rec.winLo * S.FS) < 0.115 * 0.5, 'the old rule\'s site is within half a handle of the sill (the bug this gate holds)');
  const n0 = fails.length;
  holdBuild('selftest', Object.assign({}, S, { W: Object.assign({}, S.W, { CAGE_ACCESS: Object.assign({}, S.W.CAGE_ACCESS,
    { placed: S.W.CAGE_ACCESS.placed.filter(q => q.key !== 'doorHandle' || q.side !== 'port') }) }) }));
  say(fails.length > n0, 'a door side with its handle dropped is caught by PLACED');
  fails.length = n0;
  console.log(probes.join('\n'));
  if (probes.some(l => l.indexOf('MISS') >= 0)) fails.push('selftest: a probe missed');
}

if (fails.length) {
  console.log('  FAIL ' + fails.join('\n  FAIL '));
  console.log('GATE HANDLE: FAIL (' + fails.length + ')');
  process.exit(1);
}
if (!SELF) console.log('  ' + nB + ' builds and cards, ' + nH + ' handles (' + nD + ' on doors), none on the glass; ALL GLASS -> the frame (' + negA + '), NO ROOM -> unplaced (' + negB + ')');
console.log('GATE HANDLE: PASS');
