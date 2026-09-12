// GATE CLIP — no fitting inside the skin, at rest or posed (P0 of the
// fitment study, 2026-09-12; the user: "I want no clipping").
//
// WHAT IT MEASURES. Every drawing layer runs headless over the page's own
// sheet (_scene_headless.js), the scene is sorted into SKINS (the fuselage
// covering and glass, the cowl shell, the wing lofts, the tail skins, the
// booms, the control surfaces) and FITTINGS (the access layer's hatches and
// aerials, the lights, the hinge hardware and links, the gear legs and
// castor, the struts, the pitot), and every fitting vertex is asked how far
// it stands from the nearest skin — SIGNED, against the drawn triangles
// (_mesh_query.js), not the airframe table the layers placed it with. A
// vertex further inside than its family's allowance is a red, and the line
// says which fitting, which skin, how deep, and in which pose.
//
// THE POSES ARE THE FLOWN MODEL'S MEMBERSHIP (_pose_headless.js): the
// surfaces at full declared travel both ways about the hinge the join
// bakes, a synthetic wing-flex parabola over the viewer's binding box, and
// on twin booms a synthetic tail-anchor throw over the parts the join
// anchors. A fitting the join would leave static while its surface travels
// moves apart from it here, before it is flown.
//
// CROSS-LAYER: a fitting inside another layer's solid (the tie-down that
// was 100 % inside the tailwheel castor and passed GATE FIT, HANDOVER
// G81-G85) — parity vote of three rays plus edge crossings, over pairs whose
// boxes touch; contacts the layers intend are listed in ALLOWED.
//
// THE TAIL POSES ARE ENFORCED SINCE G300 (the fitment study P1): fixed hinge
// halves, lamps and boom fittings name the part they are bolted to
// (`userData.partOf`) and the join bakes them into it, so nothing on the
// twin's tail parts from its fin, stab or boom under the anchor throw.
//
// ECONOMY: four builds (stock, rod boom, twin boom, stock+IFR wing tank),
// one headless scene each, trees built once per skin and rebuilt only for a
// skin that moved in the pose. Timing is printed, never a verdict.
//
//   node tools/_clip_check.js            the gate
//   node tools/_clip_check.js --report   every fitting's worst depth per pose
//   node tools/_clip_check.js --selftest five defects, each caught alone
//
// The runner's contract: exactly one `GATE CLIP: PASS|FAIL`, exit code to match.
'use strict';
const path = require('path');
const fs = require('fs');
const SH = require('./_scene_headless.js');
const MQ = require('./_mesh_query.js');
const PH = require('./_pose_headless.js');

const ARGS = new Set(process.argv.slice(2));
const REPORT = ARGS.has('--report'), SELFTEST = ARGS.has('--selftest'), REBASE = ARGS.has('--rebase');
// THE RATCHET. The first run of this gate found 300-odd reds on four builds,
// every one of them real and every one of them somebody else's chantier
// (P1-P3 of the fitment study). A gate that is red for a month is a gate
// nobody reads, so the known set is written down — build, pose, fitting,
// skin, depth — and a run is red only for a finding that is NEW or DEEPER
// than its line by more than 0.5 mm. A finding that disappears is printed
// as CLEARED and stays in the file until `--rebase` rewrites it, which is
// how the debt is meant to go: down, visibly, and never up.
const BASE_FILE = path.join(__dirname, 'fixtures', 'clip_baseline.json');
const RATCHET = 0.0005;
let fails = 0, checks = 0;
const check = (ok, msg) => { checks++; if (!ok) fails++; console.log((ok ? '  ok   ' : '  FAIL ') + msg); return ok; };
const mm = v => (v * 1000).toFixed(1) + ' mm';

// ---- what is skin, what is a fitting, what is a solid --------------------
// the covering the airframe contract measures from (+ glass): one description
const GLASS = new Set(['windshield', 'skyWindows', 'pilotWindow', 'pasengerWindow']);
const SKIN_MATS = new Set([...SH.context().ctx.GEAR_GEN.CAGE_MATS, ...GLASS]);

// ALLOWANCES, metres below the skin, each with its reason
const ALLOW = {
  default: 0.0015,        // 0.4-0.8 mm proud by construction + the L2 sagitta on a 40 mm quad
  staticPort: 0.0050,     // _fit_gen.js: a deliberate 4 mm recess
  gear: 0.0015,           // fitPad's inner sheet at 0.8 mm
  strut: 0.0015,
  link: 1,                // a pushrod comes OUT of the wing and a cable runs INTO the fuselage, by design
  hingeMoving: 0.0015,
  hingeFixed: 0.0015,
  hingeInner: 1,          // the bellcrank and the torque-tube pivot live inside the wing
};
// contacts the layers intend: [fitting kind, solid kind] -> skip
const ALLOWED = new Set([
  'link|hingeMoving',     // the link's tip is in the horn's eye
  'link|hingeFixed',      // its pin is in the bellcrank
  'hingeMoving|surf',     // the moving half lies on its own surface's nose
  'hingeFixed|surf',      // the pin runs through the moving knuckles
  'light|anchor', 'light|fin',   // the lamp's fairing is sunk by `buried`
  'gear|wheel', 'strut|wing',    // same assembly
  'link|gear',                   // G326: the tailwheel steering spring hooks the castor's ear
]);

// BY ANCESTOR NAME, never by the pose kind: a fitting tagged `partOf`
// (G300) takes its host's KIND — a boom collar is kind 'boom' — and would
// otherwise be its own skin, at distance zero from itself
function skinOf(o) {
  if (o.layer === 'cowl') return o.ud.innerTwin ? null : 'cowl';
  if (o.layer === 'wing' && o.kind === 'static' && !o.name) return 'wing';
  if (o.layer === 'access' || o.layer === 'light' || o.layer === 'hinge') return null;
  if (o.name.startsWith('edHinge_') || o.name.startsWith('edLamp_')) return null;
  if (o.chain.some(a => a.startsWith('edSurf_'))) return 'surf';
  if (o.chain.some(a => a.startsWith('edBoom'))) return 'boom';
  // (not the root FILLET: a thin double-sided strip over the fin-body
  // junction, wound either way — the farthest-vertex rule cannot orient it
  // and it read a strap 3 mm OUTSIDE it as inside; a fitting inside the
  // fillet is inside the fin or the body it covers)
  for (const a of o.chain)
    if (/^(edFinSkin|edFinVentral|edStabSkin)/.test(a)) return 'tail';
  return null;
}
function fittingOf(o) {
  if (o.layer === 'access') return 'access';
  if (o.layer === 'light') return 'light';
  if (o.layer === 'hinge') return o.kind === 'link' ? 'link' : 'hingeFixed';
  if (o.name.startsWith('edHinge_')) return 'hingeMoving';
  if (o.kind === 'gear') return 'gear';
  if (o.kind === 'strut') return 'strut';
  if (o.name === 'edFit_pitot') return 'pitot';
  if (o.chain.some(a => a.startsWith('edSaddle'))) return 'saddle';   // G307
  return null;
}
// the solids a fitting may not be inside that are NOT skins (skins are the
// signed-distance test above; a wing loft is open at its cove and would
// vote wrong here)
function solidOf(o) {
  if (o.kind === 'wheel') return 'wheel';
  if (o.kind === 'gear') return 'gear';
  if (o.kind === 'strut') return 'strut';
  if (o.name.startsWith('edHinge_')) return 'hingeMoving';
  if (o.layer === 'hinge' && o.kind !== 'link' && o.ud.hingeBag !== 'inner') return 'hingeFixed';
  return null;
}

// ---- identity: a fitting's own name inside a merged mesh -------------------
// the access layer records each site's triangle range per bag; the hinge
// layer each surface's fixed-half range; a lamp's meshes carry its key
function identities(o, W) {
  const out = [];             // [{ label, t0, t1 }] over the object's triangles (t = index/3)
  const nT = o.idx.length / 3;
  if (o.layer === 'access' && o.ud.fitBag && W.CAGE_ACCESS) {
    for (const p of W.CAGE_ACCESS.placed) {
      if ((p.host || '') !== (o.ud.fitHost || '')) continue;      // G300: bags per host
      const r = p.tris && p.tris[o.ud.fitBag];
      if (r && r[1] > r[0]) out.push({ label: p.key + '/' + (p.side || '') + ' [access' + (p.on ? ', on ' + p.on : '') + (p.mat ? ' ' + p.mat : '') + ']', t0: r[0], t1: r[1], key: p.key });
    }
  } else if (o.layer === 'hinge' && o.ud.hingeBag && W.CAGE_HINGE) {
    for (const p of W.CAGE_HINGE.placed) {
      if ((p.host || '') !== (o.ud.hingeHost || '')) continue;    // G300: bags per host
      const r = p.trisF && p.trisF[o.ud.hingeBag];
      if (r && r[1] > r[0]) out.push({ label: 'hinge ' + p.key + ' fixed ' + o.ud.hingeBag + ' [hinge]', t0: r[0], t1: r[1], key: p.key });
    }
  } else if (o.layer === 'light' && (o.ud.lampKey || /^liRotor_/.test(o.chain[1] || ''))) {
    const key = o.ud.lampKey || o.chain[1].slice(8);
    out.push({ label: 'lamp ' + key + ' [light]', t0: 0, t1: nT, key });
  }
  if (!out.length) out.push({ label: (o.name || ('(' + (o.chain.find(c => c) || 'mesh') + ')')) + ' [' + (o.layer || o.kind) + ']', t0: 0, t1: nT, key: o.name });
  // ...and what no record claims (the access layer's rod and boom COLLARS
  // are drawn before the site's range is taken): every triangle outside the
  // claimed ranges, as one identity, so nothing drawn goes unmeasured
  if (o.layer === 'access' || o.layer === 'hinge') {
    const claimed = new Uint8Array(nT);
    for (const id of out) for (let t = id.t0; t < id.t1; t++) claimed[t] = 1;
    let free = 0; for (let t = 0; t < nT; t++) if (!claimed[t]) free++;
    if (free) out.push({ label: '(unclaimed: collars etc.) [' + o.layer + ']', t0: 0, t1: nT, key: 'unclaimed', mask: claimed });
  }
  return out;
}
// the lamp's own allowance: the pod's sunk depth (+ the default)
function lightAllow(o, W, cen) {
  const S = W.CAGE_LIGHT && W.CAGE_LIGHT.sites;
  if (!S) return ALLOW.default;
  let best = null, bd = Infinity;
  const walk = s => { if (!s || !s.p) return; const d = Math.hypot(s.p[0] - cen[0], s.p[1] - cen[1], s.p[2] - cen[2]); if (d < bd) { bd = d; best = s; } };
  for (const k in S) { const v = S[k]; if (Array.isArray(v)) v.forEach(walk); else walk(v); }
  if (!best) return ALLOW.default;
  if (best.recess) return 1;                  // behind the wing's own glass, by design
  return (best.buried || 0) + ALLOW.default;
}

// ---- one build ---------------------------------------------------------------
function runBuild(B) {
  const t0 = Date.now();
  const S = SH.sceneBuild(B.spec || null, { over: B.over, garage: B.garage });
  const THREE = SH.context().THREE, W = S.W;
  for (const e of S.errors) console.log('  (layer) ' + e);
  const objects = PH.collect(S, THREE);
  const skinsObj = [], fittings = [], solids = [];
  for (const o of objects) {
    const sk = skinOf(o); if (sk) skinsObj.push(Object.assign(o, { skinKind: sk }));
    const ft = fittingOf(o); if (ft) fittings.push(Object.assign(o, { fitKind: ft }));
    const so = solidOf(o); if (so) solids.push(Object.assign(o, { solidKind: so }));
  }
  // the fuselage: the sheet's covering, scaled to metres, display culls applied
  const P = S.P, sheet = S.built.sheet;
  const skinOn = P.skinOn == null || +P.skinOn, glazeOn = P.glazeOn == null || +P.glazeOn;
  const fuse = MQ.triSet(sheet, { scale: S.FS, faces: f => {
    const m = f.m;
    if (!SKIN_MATS.has(m)) return false;
    if (GLASS.has(m)) return glazeOn;
    return skinOn;
  } });
  const orient = fuse.orient();
  const tB = Date.now();
  // the skins as trees, per pose only those that moved are rebuilt
  const mkSet = (o, pos) => { const s = MQ.build(Float64Array.from(pos), o.idx.slice(), {}); s.orient(); return s; };
  const skins = [{ name: 'fuselage', kind: 'fuselage', set: fuse, box: fuse.bounds() }];
  for (const o of skinsObj) {
    if (o.kind === 'prop' || o.kind === 'eng') continue;
    const set = mkSet(o, o.base);
    skins.push({ name: (o.name || o.chain.find(c => c) || 'skin'), kind: o.skinKind, set, box: set.bounds(), obj: o });
  }
  const solidSets = solids.map(o => ({ o, set: null, box: boundsOf(o.base) }));
  const PS = PH.poses(S, objects);
  const tT = Date.now();
  const findings = [];           // { build, pose, label, depth, frac, skin, at, kind, declared }
  const worst = {};              // label -> worst over all poses (for --report)
  const bump = (label, pose, d) => { const w = worst[label]; if (!w || d < w.d) worst[label] = { d, pose }; };
  let nQ = 0;

  for (const pose of PS.list) {
    // pose every object once; skins that moved get a new tree
    const posed = new Map();
    for (const o of objects) { const p = pose.apply(o); if (p) posed.set(o, p); }
    const skinsP = skins.map(s => {
      if (!s.obj || !posed.has(s.obj)) return s;
      const set = mkSet(s.obj, posed.get(s.obj));
      return Object.assign({}, s, { set, box: set.bounds() });
    });
    // ---- the skin test ----
    for (const o of fittings) {
      const pos = posed.get(o) || o.base;
      const ids = identities(o, W);
      for (const id of ids) {
        // the vertices this identity's triangles use
        const vs = new Set();
        for (let t = id.t0; t < id.t1; t++) { if (id.mask && id.mask[t]) continue; vs.add(o.idx[3 * t]); vs.add(o.idx[3 * t + 1]); vs.add(o.idx[3 * t + 2]); }
        if (!vs.size) continue;
        let cen = [0, 0, 0];
        for (const v of vs) { cen[0] += pos[3 * v]; cen[1] += pos[3 * v + 1]; cen[2] += pos[3 * v + 2]; }
        cen = cen.map(c => c / vs.size);
        const allow = o.fitKind === 'light' ? lightAllow(o, W, cen)
                    : /staticPort/.test(id.key || '') ? ALLOW.staticPort
                    : o.ud.hingeBag === 'inner' ? ALLOW.hingeInner
                    : (ALLOW[o.fitKind] || ALLOW.default);
        let wd = Infinity, wSkin = null, wAt = null, buried = 0;
        for (const v of vs) {
          const p = [pos[3 * v], pos[3 * v + 1], pos[3 * v + 2]];
          // THE NEAREST SKIN DECIDES. Not the most negative: an open patch
          // (the fin fillet, the cowl's aft ring) folds its rim at 45 deg and
          // reads "inside" for a point two metres away on its far side
          let d = Infinity, sk = null, ad = Infinity;
          for (const s of skinsP) {
            if (s.kind === 'surf' && o.name.startsWith('edHinge_') && s.obj && s.obj.surf === o.surf) continue;  // the moving half on its own surface
            // A HINGE DIVES INTO ITS OWN SURFACE'S NOSE BY DESIGN: the pin and
            // the eye sit on the axis, inside the nose cylinder the surface
            // draws solid (a real nose is cut away at the hinge stations, and
            // that cut is not drawn). The fixed half against the FIXED side's
            // skin is still measured.
            if (s.kind === 'surf' && o.fitKind === 'hingeFixed' && s.obj && s.obj.surf === id.key) continue;
            if (!nearBox(p, s.box, 0.15) && s.kind !== 'fuselage') continue;
            const q = s.set.signedDist(p); nQ++;
            if (q && Math.abs(q.d) < ad) { ad = Math.abs(q.d); d = q.d; sk = s; }
          }
          if (d < wd) { wd = d; wSkin = sk; wAt = p; }
          if (d < -allow) buried++;
        }
        bump(id.label, pose.name, wd);
        if (wd < -allow)
          findings.push({ build: B.name, pose: pose.name, label: id.label, depth: -wd, allow,
                          frac: buried / vs.size, nv: vs.size, skin: wSkin ? wSkin.name : '?', at: wAt,
                          moved: !!posed.get(o), skinMoved: !!(wSkin && wSkin.obj && posed.has(wSkin.obj)),
                          declared: false });
      }
    }
    // ---- cross-layer: a fitting inside another layer's solid ----
    for (const o of fittings) {
      const pos = posed.get(o) || o.base;
      const bo = boundsOf(pos);
      for (const sl of solidSets) {
        if (sl.o === o) continue;
        if (sl.o.layer === o.layer && o.layer) continue;             // a layer's own composition
        if (o.fitKind === 'hingeMoving' && sl.o.surf === o.surf) continue;
        if (ALLOWED.has(o.fitKind + '|' + sl.o.solidKind)) continue;
        const sp = posed.get(sl.o) || sl.o.base;
        const sb = posed.get(sl.o) ? boundsOf(sp) : sl.box;
        if (!boxTouch(bo, sb, 0.002)) continue;
        if (!sl.set || sl.posed !== (posed.get(sl.o) || null)) { sl.set = MQ.build(Float64Array.from(sp), sl.o.idx.slice(), {}); sl.set.orient(); sl.posed = posed.get(sl.o) || null; }
        const ids = identities(o, W);
        for (const id of ids) {
          const vs = new Set();
          for (let t = id.t0; t < id.t1; t++) { vs.add(o.idx[3 * t]); vs.add(o.idx[3 * t + 1]); vs.add(o.idx[3 * t + 2]); }
          let inside = 0, deep = 0, at = null;
          for (const v of vs) {
            const p = [pos[3 * v], pos[3 * v + 1], pos[3 * v + 2]];
            if (!nearBox(p, sb, 0.002)) continue;
            // signed distance, not ray parity: the wing loft is open at the
            // cove and the fin at the slot, and a ray through a hole votes wrong
            const q = sl.set.signedDist(p); nQ++;
            // ...and inside the nearest triangle's OWN component's box: a
            // kit mesh is dozens of small closed parts, and one wound wrong
            // must not claim a point half a metre away (a static port read
            // 520 mm inside the strut fitting)
            if (q && q.d < -0.0015 && nearBox(p, sl.set.compBox[sl.set.compOf[q.tri]], 0.002)) {
              inside++; if (-q.d > deep) { deep = -q.d; at = p; }
            }
          }
          if (inside && deep > 0.0015)
            findings.push({ build: B.name, pose: pose.name, label: id.label, depth: deep, allow: 0.0015,
                            frac: inside / vs.size, nv: vs.size, skin: (sl.o.name || sl.o.chain.find(c => c)) + ' (' + sl.o.solidKind + ')',
                            at, cross: true, moved: !!posed.get(o), skinMoved: !!posed.get(sl.o),
                            declared: false });
        }
      }
    }
  }
  const ms = Date.now() - t0;
  return { S, findings, worst, ms, msBuild: tB - t0, msTrees: tT - tB, nQ, poses: PS,
           nFit: fittings.length, nSkin: skins.length, orient, fuseTris: fuse.nt };
}
function boundsOf(pos) {
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { if (pos[i + k] < b[k]) b[k] = pos[i + k]; if (pos[i + k] > b[3 + k]) b[3 + k] = pos[i + k]; }
  return b;
}
const nearBox = (p, b, m) => p[0] >= b[0] - m && p[0] <= b[3] + m && p[1] >= b[1] - m && p[1] <= b[4] + m && p[2] >= b[2] - m && p[2] <= b[5] + m;
const boxTouch = (a, b, m) => a[0] <= b[3] + m && b[0] <= a[3] + m && a[1] <= b[4] + m && b[1] <= a[4] + m && a[2] <= b[5] + m && b[2] <= a[5] + m;

// ---- the builds ------------------------------------------------------------
const FIX = f => SH.loadFixture(path.join(__dirname, 'fixtures', f)).spec;
const IFR = { fuel: { litres: 90, tank: 'wing' }, systems: { fit: 'ifr' } };
const BUILDS = [
  { name: 'stock' },
  { name: 'rod', over: { boomStyle: 1 } },
  { name: 'twin', spec: FIX('build_v8_twin-boom_2026-09-11.json') },
  { name: 'stock+ifr', garage: IFR },
];

function fmt(f) {
  return (f.declared ? 'GAP  ' : 'FAIL ') + f.build + '/' + f.pose + ': ' + f.label + ' ' + mm(f.depth) +
    (f.cross ? ' INSIDE ' : ' INTO ') + f.skin + ' (allow ' + mm(f.allow) + '), ' +
    (f.frac * 100).toFixed(0) + '% of ' + f.nv + ' v buried, at (' + f.at.map(v => v.toFixed(2)).join(', ') + ')' +
    (f.pose !== 'rest' ? (f.moved === f.skinMoved ? '' : (f.moved ? ' — the fitting moves, the skin does not' : ' — the skin moves, the fitting stays')) : '');
}

const keyOf = f => f.build + '|' + f.pose + '|' + f.label + '|' + (f.cross ? 'INSIDE ' : 'INTO ') + f.skin;

function main() {
  console.log('GATE CLIP — fittings against the drawn skin, at rest and posed');
  let base = {};
  try { base = JSON.parse(fs.readFileSync(BASE_FILE, 'utf8')); } catch (e) {}
  let total = 0, allF = [];
  const summary = [];
  for (const B of BUILDS) {
    const r = runBuild(B);
    total += r.ms;
    console.log(`  ${B.name}: ${r.nFit} fitting objects, ${r.nSkin} skins (fuselage ${r.fuseTris} t, orient ${r.orient.flipped} flipped/${r.orient.outFlips} turned), ` +
      `${r.poses.list.length} poses [${r.poses.list.map(p => p.name).join(' ')}], ${r.nQ} queries — ${r.ms} ms (build ${r.msBuild}, trees ${r.msTrees})`);
    if (REPORT) {
      const rows = Object.entries(r.worst).sort((a, b) => a[1].d - b[1].d);
      for (const [label, w] of rows) console.log('    ' + (w.d < 0 ? mm(-w.d) + ' in  ' : mm(w.d) + ' out ') + label + ' @' + w.pose);
    }
    // one line per (fitting, skin, pose): the worst depth
    const byKey = new Map();
    for (const f of r.findings) { const k = keyOf(f); const g = byKey.get(k); if (!g || f.depth > g.depth) byKey.set(k, f); }
    const fs2 = [...byKey.values()].sort((a, b) => b.depth - a.depth);
    let nRed = 0, nKnown = 0, nGap = 0;
    for (const f of fs2) {
      const k = keyOf(f), b = base[k];
      f.known = b != null && f.depth <= b / 1000 + RATCHET;
      if (f.declared) nGap++; else if (f.known) nKnown++; else nRed++;
      if (f.declared || !f.known || REPORT) console.log('  ' + (f.known && !f.declared ? 'KNOWN ' : '') + fmt(f));
    }
    summary.push({ build: B.name, reds: nRed, known: nKnown, gaps: nGap, worst: fs2.length ? fs2[0].depth : 0 });
    allF = allF.concat(fs2);
  }
  console.log('  ---- summary ----');
  for (const s of summary) console.log(`  ${s.build}: ${s.reds} NEW red, ${s.known} known, ${s.gaps} declared, worst ${mm(s.worst)}`);
  const reds = allF.filter(f => !f.declared && !f.known);
  check(reds.length === 0, 'no NEW fitting inside a skin or another layer at rest, at full travel or under flex (' + reds.length + ' new, ' + allF.filter(f => f.known).length + ' known in the baseline)');
  const seen = new Set(allF.map(keyOf));
  const cleared = Object.keys(base).filter(k => !seen.has(k));
  if (cleared.length) console.log('  CLEARED since the baseline (' + cleared.length + '): ' + cleared.slice(0, 8).join('; ') + (cleared.length > 8 ? ' ...' : '') + ' — run --rebase to drop them');
  const gaps = allF.filter(f => f.declared);
  if (gaps.length) console.log('  DECLARED GAP: ' + gaps.length + ' lines, not counted');
  if (REBASE) {
    const out = {};
    for (const f of allF) if (!f.declared) out[keyOf(f)] = +(f.depth * 1000).toFixed(1);
    fs.writeFileSync(BASE_FILE, JSON.stringify(out, null, 1) + String.fromCharCode(10));
    console.log('  baseline rewritten: ' + Object.keys(out).length + ' lines -> ' + path.relative(process.cwd(), BASE_FILE));
  }
  console.log('  wall ' + total + ' ms over ' + BUILDS.length + ' builds');
}

// ---- self-test: five defects, each caught alone ------------------------------
function selftest() {
  console.log('GATE CLIP --selftest');
  // 1. a fitting sunk 6 mm: move the access layer's paint bag inward on the stock build
  {
    const r = runBuild({ name: 'st1' });
    const base = r.findings.filter(f => f.pose === 'rest' && !f.cross).length;
    console.log('  baseline rest reds on stock: ' + base);
  }
  const S = SH.sceneBuild(null, {});
  const THREE = SH.context().THREE;
  // synthetic: a box 20 mm inside the fuselage flank must be red; the same box 20 mm outside must not
  const box = (cx, cy, cz, h) => {
    const g = new THREE.BoxGeometry(h, h, h);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial());
    m.position.set(cx, cy, cz); return m;
  };
  const acc = S.scene.getObjectByName('cageLayer:access');
  const fuse = MQ.triSet(S.built.sheet, { scale: S.FS, faces: f => SKIN_MATS.has(f.m) });
  fuse.orient();
  // the flank at the cabin: the surface point at station z=1.0 m, +x, and
  // the MESH's own outward normal there (the oriented set's, not the table's)
  const AF = S.W.CAGE_GEAR && S.W.CAGE_GEAR.AF;
  const sp0 = AF ? AF.surf(1.0, Math.PI / 2) : [0.5, 0, 1.0];
  const q0 = fuse.signedDist(sp0);
  const sp = q0.c, nL = Math.hypot(q0.n[0], q0.n[1], q0.n[2]) || 1;
  const n = [q0.n[0] / nL, q0.n[1] / nL, q0.n[2] / nL];
  const inBox = box(sp[0] - n[0] * 0.02, sp[1] - n[1] * 0.02, sp[2] - n[2] * 0.02, 0.01);
  const outBox = box(sp[0] + n[0] * 0.02, sp[1] + n[1] * 0.02, sp[2] + n[2] * 0.02, 0.01);
  acc.add(inBox); acc.add(outBox); S.scene.updateMatrixWorld(true);
  const probe = (mesh, want, what) => {
    const o = PH.collect(S, THREE).find(x => x.mesh === mesh);
    let wd = Infinity;
    for (let i = 0; i < o.nv; i++) { const q = fuse.signedDist([o.base[3 * i], o.base[3 * i + 1], o.base[3 * i + 2]]); if (q.d < wd) wd = q.d; }
    check((wd < -ALLOW.default) === want, what + ' (worst ' + mm(wd) + ')');
  };
  probe(inBox, true, 'a 10 mm box 20 mm inside the flank reads inside');
  probe(outBox, false, 'the same box 20 mm outside reads outside');
  acc.remove(inBox); acc.remove(outBox);
  // 3. deleted faces round a fitting must NOT make it red: the door's faces
  // taken out of the skin set (what doorGone does to the sheet), then a point
  // over the hole outside the skin line, and one deep inside
  {
    const S2 = SH.sceneBuild(null, {});
    let doorFaces = 0;
    const f2 = MQ.triSet(S2.built.sheet, { scale: S2.FS, faces: f => { if (f.doorKey) { doorFaces++; return false; } return SKIN_MATS.has(f.m); } });
    f2.orient();
    check(doorFaces > 20, 'the stock sheet has a door zone to remove (' + doorFaces + ' faces)');
    // the door is on the flank at the cabin: the closed envelope's point over it
    const AF2 = S2.W.CAGE_GEAR && S2.W.CAGE_GEAR.AF;
    const z = 2.2, sp2 = AF2.surf(z, Math.PI / 2);
    const cy = AF2.cyAt(z);
    const n2 = [sp2[0], sp2[1] - cy, 0]; const L2 = Math.hypot(n2[0], n2[1]) || 1; n2[0] /= L2; n2[1] /= L2;
    const p = [sp2[0] + n2[0] * 0.03, sp2[1] + n2[1] * 0.03, sp2[2]];
    const q = f2.signedDist(p);
    check(q.d > 0, 'a point 30 mm outside the doorway line reads OUTSIDE on the open mesh (' + mm(q.d) + ', rim ' + q.rim + ')');
    // THE RULE, STATED: a rim never votes beyond itself, so the doorway's own
    // column — inside the fuselage, nearer to the door's rim than to any
    // skin — reads outside (unknown, conservatively). The same depth away
    // from the hole reads inside.
    const pin = [sp2[0] - n2[0] * 0.30, sp2[1] - n2[1] * 0.30, sp2[2]];
    const qi = f2.signedDist(pin);
    check(qi.d > 0 && qi.rim, 'a point 300 mm inside, in the doorway column, reads OUTSIDE by the rim rule (' + mm(qi.d) + ', rim ' + qi.rim + ')');
    const sp3 = AF2.surf(0.6, Math.PI / 2), cy3 = AF2.cyAt(0.6);
    const n3 = [sp3[0], sp3[1] - cy3, 0]; const L3 = Math.hypot(n3[0], n3[1]) || 1; n3[0] /= L3; n3[1] /= L3;
    const pin3 = [sp3[0] - n3[0] * 0.03, sp3[1] - n3[1] * 0.03, sp3[2]];
    const q3 = f2.signedDist(pin3);
    check(q3.d < 0, 'a point 30 mm inside the flank away from the hole reads INSIDE (' + mm(q3.d) + ')');
  }
  // 4. a static tail fitting on the twin must be flagged at tail+ (a box glued to the fin, unnamed => static)
  {
    const S3 = SH.sceneBuild(FIX('build_v8_twin-boom_2026-09-11.json'), {});
    const fin = S3.scene.getObjectByName('edFinSkin');
    check(!!fin && !!S3.W.CAGE_BOOMS, 'twin fixture has edFinSkin and CAGE_BOOMS');
    const objs = PH.collect(S3, THREE);
    const finO = objs.find(o => o.chain.includes('edFinSkin') && o.kind === 'anchor');
    const bx = boundsOf(finO.base);
    // a 30 mm box sitting on the fin's flank, its inner face 1 mm proud of the max-x flank
    const gl = box(bx[3] + 0.016, (bx[1] + bx[4]) / 2, (bx[2] + bx[5]) / 2, 0.03);
    S3.scene.getObjectByName('cageLayer:light').add(gl); S3.scene.updateMatrixWorld(true);
    const objs2 = PH.collect(S3, THREE);
    const g2 = objs2.find(o => o.mesh === gl);
    check(g2.kind === 'static', 'an unnamed box under the light layer classifies static on the twin');
    const PS = PH.poses(S3, objs2);
    const tp = PS.list.find(p => p.name === 'tail+');
    check(!!tp && tp.apply(finO) && !tp.apply(g2), 'tail+ moves the fin and not the box');
    gl.userData.partOf = 'edFinSkin';
    const g3 = PH.collect(S3, THREE).find(o => o.mesh === gl);
    check(g3.kind === 'anchor', 'tagged partOf=edFinSkin, the same box rides the fin (the P1 contract)');
  }
  // 5. k = 0 removes a surface finding: with no travel, +full equals rest
  // (a fresh build: the layers dispose their previous groups on every post,
  // so the first scene above is empty by now — one context, one live scene)
  {
    const S5 = SH.sceneBuild(null, {});
    const objs = PH.collect(S5, THREE);
    const PS = PH.poses(S5, objs);
    const rud = objs.find(o => o.kind === 'surf' && o.surf === 'rud' && !o.name.startsWith('edHinge_'));
    const full = PS.list.find(p => p.name === '+full');
    const moved = full.apply(rud);
    let dmax = 0; for (let i = 0; i < rud.nv; i++) dmax = Math.max(dmax, Math.hypot(moved[3 * i] - rud.base[3 * i], moved[3 * i + 1] - rud.base[3 * i + 1], moved[3 * i + 2] - rud.base[3 * i + 2]));
    check(dmax > 0.05, 'the rudder turns at +full (max travel ' + mm(dmax) + ')');
    PS.hinges.rud.k = 0;
    check(full.apply(rud) === null, 'with k = 0 the rudder does not move');
    const h = PS.hinges.rud;
    check(h.hingeFrom === 'declared', 'the rudder hinge is the fin layer\'s declared line (' + h.hingeFrom + ')');
  }
}

if (SELFTEST) selftest(); else main();
console.log(`  ${checks - fails}/${checks} checks`);
console.log(`GATE CLIP: ${fails ? 'FAIL' : 'PASS'}`);
process.exit(fails ? 1 : 0);
