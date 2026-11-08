// RETRACT-ROBUST probe (test-only, not game code): one build (a file or an archetype key) + cage rows over it ->
// what the editor offers (the retraction group's rows that show), the gear layer's own verdict (foldFit), the cuts,
// the wells, the doors, the mechanism; then the LOAD DOOR (LB.gameSpecFull) -> does the flown spec retract.
//   node reports/evidence/RETRACT-ROBUST/tools/rr_probe.js <build.json | key:<archetype>> ['{"row":v}'] [--json out.json]
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const T = path.join(ROOT, 'tools');
const argv = process.argv.slice(2);
const SRC = argv[0], OVER = JSON.parse(argv[1] && argv[1][0] === '{' ? argv[1] : '{}');
const JOUT = argv.includes('--json') ? argv[argv.indexOf('--json') + 1] : null;
const LB = require(path.join(T, '_load_build.js'));
let raw;
if (SRC.startsWith('key:')) {
  const BJ = require(path.join(T, '_bake_joined.js')); const { D } = BJ.loadPanel();
  const a = D.ARCHETYPES.find(x => x.key === SRC.slice(4)); if (!a) throw new Error('no archetype ' + SRC);
  const s0 = D.designBake(a.sel, a.over); const r = LB.gameSpecFull({ v: s0.v, birth: 1, spec: s0 });
  raw = { spec: r.spec };
} else { raw = JSON.parse(fs.readFileSync(path.resolve(ROOT, SRC), 'utf8')); if (!raw.spec) raw = { spec: raw }; }
const spec0 = JSON.parse(JSON.stringify(raw.spec));
// the rows over the build, in the spec's own cage (the way a saved build carries them)
const specO = JSON.parse(JSON.stringify(spec0)); specO.cage = Object.assign({}, specO.cage || {}, OVER);
const SH = require(path.join(T, '_scene_headless.js'));
const S = SH.sceneBuild(specO, { over: OVER, garage: specO });
const W = S.W, P = S.P, G = W.CAGE_GEAR || {};
const R = { src: SRC, over: OVER, layerErrors: S.errors.map(e => String(e).split('\n')[0]).slice(0, 4) };
R.P = {}; for (const k of ['wgPos', 'wgY', 's1On', 's2On', 's2Leg', 's1Leg', 'gearFloats', 'hullOn', 'gearRetract', 'gearFold', 'gearFoldNose', 'gearWellCut', 'gearDoors', 'gearLegDoor', 'gearShort', 'gearShortNose', 's1X', 's1Z', 's1R', 's1Drop', 's2Z', 's2R', 's2Drop', 'wgThick', 'engCount', 'engMount', 'planes']) R.P[k] = P[k];
// the rows the retraction group offers (the panel's own `when`)
const PAGE = W.CAGE_PAGE || {}; const groups = (PAGE.groupsOverride || PAGE.groups || []);
const offered = []; const walk = (rows, gWhen) => { for (const r of rows) { if (!Array.isArray(r)) continue;
  if (typeof r[0] === 'string' && Array.isArray(r[1])) { const o = r[2] || {}; const ok = !o.when || safe(() => o.when(P)); if (ok && gWhen) walk(r[1], true); continue; }
  const last = r[r.length - 1]; const o = last && typeof last === 'object' && !Array.isArray(last) ? last : {};
  if (/^gear(Retract|RetT|RetAct|Fold|FoldNose|RetFrac|WellCut|LegDoor|Short|ShortNose|NacFit|KneeDoor|NacPod|Doors)$/.test(r[0]) && gWhen && (!o.when || safe(() => o.when(P)))) offered.push(r[0]); } };
function safe(f) { try { return !!f(); } catch (e) { return false; } }
for (const g of groups) if (Array.isArray(g) && /undercarriage/.test(g[0])) walk(g[1], true);
R.offered = offered;
R.retractable = !!G.swing;
if (G.swing) R.swing = Object.fromEntries(Object.entries(G.swing).map(([k, c]) => [k, { turns: c.turns.length, lift: +c.lift.toFixed(3), frac: c.frac, R: c.R && +c.R.toFixed(3), legR: c.legR, nacelle: !!c.nacelle, onWing: !!c.wing }]));
const F = G.fit;
if (F) { R.fit = { ok: F.ok, why: [...new Set(F.why)], tests: Object.keys(F.tests || {}), rows: Object.keys(F.rows || {}) };
  if (F.ms != null) R.fit.ms = F.ms; }
const cu = c => ({ units: c.units, mode: c.mode, pts: c.outline && c.outline.length, ceil: c.ceil != null ? +(+c.ceil).toFixed(3) : null, side: c.side, frame: !!c.frame });
R.cuts = (G.cuts || []).map(cu); R.cutsSide = (G.cutsSide || []).map(cu); R.cutsWing = (G.cutsM || []).map(cu); R.cutsNac = (G.cutsNacM || []).map(cu);
R.pierceTop = (G.pierceTopM || []).length;
R.wells = (G.wells || []).map(w => ({ unit: w.unit || w.units, where: w.where || w.in || null, size: w.max && w.min ? w.max.map((v, i) => +(v - w.min[i]).toFixed(3)) : null }));
R.doors = (G.doors || []).map(d => ({ name: d.name, kind: d.kind, units: d.units || d.unit, area: d.area != null ? +(+d.area).toFixed(3) : null, closedDown: d.closedDown }));
if (G.mechInfo) R.mech = Object.fromEntries(Object.entries(G.mechInfo).map(([k, I]) => [k, { knee: I.knee != null ? +I.knee.toFixed(3) : null, inside: I.inside != null ? +I.inside.toFixed(3) : null, ok: I.ok }]));

// THE ROOM: per unit the hinge, the axle, the leg's length, the wheel's radius, and the structure round the stowed wheel -
// the wing's depth (over - under) at the well's centre, the body's half width at the hinge's station, the floor
{ const WG = W.CAGE_WING, AF = G.AF, FSm = (W.CAGE2 && W.CAGE2.CAGE_UNIT || 1) * (P.planeScale || 1);
  const depth = (x, z) => { if (!WG || !WG.underAt || !WG.overAt) return null; const u = WG.underAt(x, z), o = WG.overAt(x, z); return u && o ? +(o.y - u.y).toFixed(3) : null; };
  R.room = {};
  for (const k of Object.keys(G.swing || {})) { const c = G.swing[k], w = (G.wells || []).find(q => q.unit === k);
    const h = c.hinge, a = c.axle; const mid = w ? w.min.map((v, i) => (v + w.max[i]) / 2) : null;
    R.room[k] = { hinge: h && h.map(v => +v.toFixed(3)), axle: a && a.map(v => +v.toFixed(3)), legL: h && a ? +Math.hypot(a[0] - h[0], a[1] - h[1], a[2] - h[2]).toFixed(3) : null,
      R: c.R && +c.R.toFixed(3), wheelW: c.W != null ? +(+c.W).toFixed(3) : (c.tw != null ? +(+c.tw).toFixed(3) : null),
      wingDepthAtWell: mid ? depth(mid[0], mid[2]) : null, wingDepthAtHinge: h ? depth(h[0], h[2]) : null,
      bodyHalfWAtHinge: AF && h && AF.halfWAt && h[2] >= AF.z0 && h[2] <= AF.z1 ? +AF.halfWAt(h[2]).toFixed(3) : null,
      stowedBox: w ? { min: w.min.map(v => +v.toFixed(3)), max: w.max.map(v => +v.toFixed(3)) } : null,
      floorY: P.floorY != null ? +(+P.floorY * FSm).toFixed(3) : null,
      chord: WG && WG.leAt && h ? (() => { const le = WG.leAt(h[0]), te = WG.teAt(h[0]); return le && te ? +(le.z - te.z).toFixed(3) : null; })() : null }; } }

// THE STRUCTURE THE CUTS MEET: each body / wing cut's plan box (m), its depth (the ceiling over the lowest skin point is
// not known here: the ceiling alone), and against the wing's spars (GEN_RULES sparFront / sparRear chord fractions at the
// cut's span stations): the chord band the cut covers, and whether it crosses a spar line or the carry-through (a body cut
// inside the body's width at a low wing's root chord)
{ const WG = W.CAGE_WING, F2 = G.fit, AF = G.AF; const sF = 0.15, sR = 0.65;
  const band = (x, z) => { if (!WG || !WG.leAt) return null; const le = WG.leAt(x), te = WG.teAt(x); return le && te && le.z > te.z ? (le.z - z) / (le.z - te.z) : null; };
  const one = (c, kind) => { const h = c.hull || []; let z0 = Infinity, z1 = -Infinity, x0 = Infinity, x1 = -Infinity;
    for (const q of h) { z0 = Math.min(z0, q[0]); z1 = Math.max(z1, q[0]); x0 = Math.min(x0, q[1]); x1 = Math.max(x1, q[1]); }
    let f0 = Infinity, f1 = -Infinity; for (const q of h) { const f = band(Math.abs(q[1]) < 0.05 ? 0.05 : q[1], q[0]); if (f != null) { f0 = Math.min(f0, f); f1 = Math.max(f1, f); } }
    const hw = AF && AF.halfWAt ? AF.halfWAt(Math.max(AF.z0, Math.min(AF.z1, (z0 + z1) / 2))) : null;
    const crossF = f0 < sF && f1 > sF, crossR = f0 < sR && f1 > sR;
    return { kind, units: c.units, mode: c.mode, z: [+z0.toFixed(3), +z1.toFixed(3)], x: [+x0.toFixed(3), +x1.toFixed(3)], len: +(z1 - z0).toFixed(3), wid: +(x1 - x0).toFixed(3),
      ceil: c.ceil != null ? +c.ceil.toFixed(3) : null, chordBand: isFinite(f0) ? [+f0.toFixed(2), +f1.toFixed(2)] : null, crossesFrontSpar: crossF, crossesRearSpar: crossR,
      straddlesCentre: x0 < 0 && x1 > 0, bodyHalfW: hw != null ? +hw.toFixed(3) : null }; };
  R.cutStruct = [];
  if (F2) { for (const c of F2.cuts || []) R.cutStruct.push(one(c, 'body')); for (const c of F2.cutsWing || []) R.cutStruct.push(one(c, 'wing')); }
  R.wgPos = P.wgPos; }
// the LOAD DOOR: what the game flies
if (!argv.includes('--nogame')) try { const r = LB.gameSpecFull({ v: raw.v || 1, spec: specO }); const g = r.spec.gear || {};
  R.game = { type: g.type, retract: g.retract || null, wells: g.wells ? g.wells.length : 0, fairing: g.fairing, errors: (r.errors || []).length, cageRetract: r.spec.cage && r.spec.cage.gearRetract };
} catch (e) { R.game = { error: String(e).slice(0, 200) }; }
if (!argv.includes('--quiet')) console.log(JSON.stringify(R, null, 1));
if (JOUT) fs.writeFileSync(JOUT, JSON.stringify(R, null, 1));
