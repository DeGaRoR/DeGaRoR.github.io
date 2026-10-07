#!/usr/bin/env node
// ============================================================================
// GATE HANGAR — the shells, the kits, the verbs, and the placement contract.
// ============================================================================
// HANGARS.md §9, held in two blocks:
//
// BLOCK A (pure node, no THREE — the reason 26_hangar_fit.js is a core file):
//   rule 3  every prop a kit names exists in the DECLARED tables
//           (props_table.py + jodel_prep.py, re-parsed here the way GATE
//           PROPS does — the G48 lesson: an assertion that reads the same
//           object the code just wrote proves nothing);
//   rule 4  the kit claims PARTITION the furniture table exactly once, and
//           the two baked airframes belong to `wip` alone;
//   rule 5  every capability verb is grantable — a verb nothing can grant is
//           a dead string — and the aeroplane-side wants map speaks only
//           verbs that exist;
//   rule 6  every kit places into every shell or reports what it could not,
//           NEVER silently: the accounting invariant, independent bounds
//           re-derivation, the field shed's honest refusals, and the club's
//           golden room — frozen positions, so the identity conversion from
//           the authored layout stays an identity forever.
//
// BLOCK B (vm, a stubbed THREE): rules 1 and 2 —
//   rule 1  every LIVE shell builds, interior and exterior, at its own dims
//           AND at its slider corners, with every geometry constructor
//           handed finite, positive sizes (the EAVE-5.2 / HW-14 class of
//           negative box is exactly what this instrumentation exists for);
//   rule 2  interior and exterior agree on dims — opts.exterior makes this
//           nearly free and therefore worth asserting.
//
// Negative-verified: --selftest breaks each rule in turn.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const CORE = require('./flight_core.js');

const SELF = process.argv.includes('--selftest');
let fails = [], checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) fails.push(msg); return !!cond; };
const near = (a, b, tol, msg) => ok(Math.abs(a - b) <= tol,
  msg + ' (' + a + ' vs ' + b + ', tol ' + tol + ')');

// ---- the declared tables, re-parsed (GATE PROPS's own regexes) -------------
const tableSrc = fs.readFileSync(path.join(__dirname, 'props_table.py'), 'utf8');
const declared = [];
for (const m of tableSrc.matchAll(/^\s{4}P\('([a-z0-9_]+)',\s*'([a-z]+)',\s*'([^']*)'/gm))
  declared.push(m[1]);
const jodelSrc = fs.readFileSync(path.join(__dirname, 'jodel_prep.py'), 'utf8');
const airframes = [];
for (const m of jodelSrc.matchAll(/key='([a-z0-9_]+)'/g)) airframes.push(m[1]);

// ---- the baked registry, for real footprints (loaded the GATE PROPS way) ---
const packs = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'src', 'props', 'props_packs.json'), 'utf8'));
const pctx = vm.createContext({ registerPropPack: CORE.registerPropPack, console });
for (const f of packs)
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'props', f), 'utf8'),
                  pctx, { filename: f });

function runA() {
  const KITS = CORE.HANGAR_KITS, ORDER = CORE.HANGAR_KITS_DEFAULT;
  const union = new Set(declared.concat(airframes));

  // ---- rule 3: no ghosts ---------------------------------------------------
  for (const k of ORDER) {
    const kit = KITS[k];
    for (const p of kit.props)
      ok(union.has(p), 'kit ' + k + ' claims undeclared prop ' + p);
    for (const s of kit.sites)
      ok(union.has(s.prop), 'kit ' + k + ' sites undeclared prop ' + s.prop);
    for (const r of kit.ring)
      ok(union.has(r.prop), 'kit ' + k + ' rings undeclared prop ' + r.prop);
    for (const r of kit.recipes)
      for (const p of r.props || [])
        ok(union.has(p), 'kit ' + k + ' recipe ' + r.recipe +
           ' names undeclared prop ' + p);
  }

  // ---- rule 4: the partition ----------------------------------------------
  const claims = {};
  for (const k of ORDER)
    for (const p of KITS[k].props) (claims[p] = claims[p] || []).push(k);
  for (const p of declared)
    ok((claims[p] || []).length === 1, 'prop ' + p + ' is claimed by ' +
       ((claims[p] || []).length ? claims[p].join('+') : 'NOBODY') +
       ' — the table partitions exactly once');
  for (const p of airframes)
    ok((claims[p] || []).join() === 'wip',
       'airframe ' + p + ' belongs to wip alone');

  // every shell declares its HDRI family — the association point the user
  // named; today 'alps' everywhere IS the truth (one panorama, graded)
  for (const sk of Object.keys(CORE.SHELLS))
    ok(typeof CORE.SHELLS[sk].sky === 'string' && CORE.SHELLS[sk].sky.length > 0,
       'shell ' + sk + ' declares no sky family');

  // ---- rule 5: no dead verbs ----------------------------------------------
  const grantable = new Set(['park', 'heavy', 'composite', 'engine']);
  for (const k of ORDER) for (const g of KITS[k].grants) grantable.add(g);
  for (const v of CORE.HANGAR_CAPS)
    ok(grantable.has(v), 'capability "' + v + '" is grantable by nothing');
  const wants = CORE.hangarWants({ fuselage: { material: 'wood' },
    wings: [{ material: 'carbon' }],
    tail: { finMaterial: 'alloy', stabMaterial: 'tubeFabric' } });
  ok(wants.every(v => CORE.HANGAR_CAPS.includes(v)) && wants.length === 4,
     'hangarWants speaks only declared verbs, one per material family');

  // ---- rule 6: every kit places into every shell, or reports --------------
  const totalRows = ORDER.reduce((n, k) =>
    n + KITS[k].sites.length + KITS[k].recipes.length, 0);
  for (const sk of Object.keys(CORE.SHELLS)) {
    const dims = CORE.SHELLS[sk].dims;
    const r = CORE.hangarFit(dims, ORDER, { reg: CORE.PROP_REG, shell: sk });
    ok(r.placed.length + r.recipes.length + r.unplaced.length === totalRows,
       sk + ': ' + (r.placed.length + r.recipes.length + r.unplaced.length) +
       ' outcomes for ' + totalRows + ' declared rows — nothing may vanish');
    for (const u of r.unplaced)
      ok(typeof u.reason === 'string' && u.reason.length > 0,
         sk + ': unplaced ' + u.key + ' carries no reason');
    // independent bounds re-derivation: trust the report, verify the placed
    for (const p of r.placed) {
      const rec = CORE.PROP_REG.props[p.prop];
      const f = rec ? [rec.dim[0] / 2, rec.dim[2] / 2] : [0.1, 0.1];
      const q = Math.round((p.ry || 0) / (Math.PI / 2)) & 1;
      const hx = q ? f[1] : f[0], hz = q ? f[0] : f[1];
      ok(Math.abs(p.x) + hx <= dims.HD + 1e-6 &&
         Math.abs(p.z) + hz <= dims.HW + 1e-6,
         sk + ': placed ' + p.prop + ' escapes the walls (' +
         p.x.toFixed(2) + ', ' + p.z.toFixed(2) + ')');
    }
  }

  // the field shed must REFUSE things — a tiny shell that swallows the whole
  // woodshop is the silent failure this mechanism exists to prevent
  const rf = CORE.hangarFit(CORE.SHELLS.field.dims, ORDER,
                            { reg: CORE.PROP_REG, shell: 'field' });
  ok(rf.unplaced.length >= 5,
     'the field shed refuses at least a handful (got ' +
     rf.unplaced.length + ')');
  ok(rf.unplaced.some(u => ['bandsaw', 'panelsaw', 'thicknesser', 'jointer']
       .includes(u.key) || u.reason === 'blocks the aircraft bay'),
     'the field shed cannot take the full machine shop');

  // ---- THE GOLDEN ROOM: club at default dims is today's room --------------
  const rc = CORE.hangarFit(CORE.SHELLS.club.dims, ORDER,
                            { reg: CORE.PROP_REG, shell: 'club' });
  ok(rc.unplaced.length === 0, 'the fully-kitted club at default dims places ' +
     'EVERYTHING (' + rc.unplaced.map(u => u.key + ':' + u.reason).join(', ') + ')');
  const at = k => rc.placed.find(p => p.prop === k);
  const rat = k => rc.recipes.find(p => p.recipe === k);
  // frozen literals, NOT recomputed through the same helpers the table uses:
  // FX(-5.0) at HD 12.5 is -62.5/13, the machine run keeps G66's spacing, the
  // back-wall run stands at its authored-frame intent (weldingcart 12.5 — it
  // was AT the wall, 15.0, before the conversion), the stock rack at -8.5
  // byte-identical to the authored line.
  const GOLD = [
    ['workbench_wood', -62.5 / 13, 14.0],
    ['bandsaw', -6.19 * 12.5 / 13, -13.84],
    ['panelsaw', -4.30 * 12.5 / 13, -9.8],
    ['weldingcart', 11.35, 12.5],
    ['car_covered', -9.9 * 12.5 / 13, 15 - 5.6 * 15 / 18],
  ];
  for (const [k, x, z] of GOLD) {
    const p = at(k);
    if (!ok(!!p, 'golden ' + k + ' is missing from the club')) continue;
    near(p.x, x, 1e-9, 'golden ' + k + ' x');
    near(p.z, z, 1e-9, 'golden ' + k + ' z');
  }
  const sr = rat('stockRack');
  ok(!!sr && Math.abs(sr.z - (-8.5)) < 1e-9,
     'the stock rack stands at the authored -8.5');
  for (const p of rc.placed)
    if (p.prop === 'drum_steel' && p.at === 'back')
      ok(Math.abs(p.z) < 15, 'a back-wall drum is inside the wall (was -15.4)');

  // ---- the ring -----------------------------------------------------------
  const dims = CORE.SHELLS.club.dims;
  for (const bb of [{ x0: -3.4, x1: 3.6, z0: -4.4, z1: 4.4 },
                    { x0: -8, x1: 8, z0: -14.5, z1: 14.5 }]) {
    const rows = CORE.hangarFitRing(dims, ORDER, bb);
    // five since the garage radio (SND-BOOMBOX 2026-10-05): the chest, the
    // jerrycan, the ladder, the sack truck and the boombox
    ok(rows.length === 5, 'the full fit-out walks five things over (' +
       rows.length + ')');
    for (const r of rows) {
      ok(Math.abs(r.x) <= dims.HD - 1.0 && Math.abs(r.z) <= dims.HW - 1.0,
         'ring ' + r.prop + ' stays in the room');
      if (r.prop === 'stepladder' || r.prop === 'handtruck')
        ok(r.z < 0, 'ring ' + r.prop + ' stays PORT — the magnitude-clamp ' +
           'lesson (a negative limit once flung it starboard)');
    }
  }
  const bare = CORE.hangarFitRing(dims, ['park'],
                                  { x0: -1, x1: 1, z0: -1, z1: 1 });
  ok(bare.length === 0, 'a park-only shed walks nothing over');

  runCozy(union);
}

// ---- rule 8 (G2315 WORKS-COZY): THE LAYOUTS ---------------------------------
// A layout stands the same kits otherwise in ONE shell (cozy: the career's
// works, GAME-2026-10-06 §R GQ22). Held: every row names a declared prop (rule
// 3 for layouts); the layout's kits are kits, each with rows; in its shell it
// places EVERYTHING (the accounting invariant, nothing refused - the composed
// room is complete) and no two floor-standing things share floor (the engine
// packs walls, not the floor: this re-derives every footprint independently);
// in ANY OTHER shell it is not there - the club with layout 'cozy' is the club
// without one, position for position (the sandbox's room); the career's main
// hangar is it and the sandbox's default is not; and the two residents park in
// it round the build stand (hangarPark, the stand as `keep`), clear of the
// stand, of the fit-out and of each other.
function runCozy(union) {
  const LY = CORE.HANGAR_LAYOUTS;
  if (!ok(!!LY && !!LY.cozy && !!LY.hearth, 'rule 8: HANGAR_LAYOUTS holds cozy and hearth')) return;
  const W = CORE.SHELLS.works.dims;
  const orient = (f, ry) => (Math.round((ry || 0) / (Math.PI / 2)) & 1) ? [f[1], f[0]] : [f[0], f[1]];
  const hit = (a, b) => a.x0 < b.x1 - 1e-6 && a.x1 > b.x0 + 1e-6 && a.z0 < b.z1 - 1e-6 && a.z1 > b.z0 + 1e-6;
  const cl0 = CORE.hangarFit(CORE.SHELLS.club.dims, CORE.HANGAR_KITS_DEFAULT, { reg: CORE.PROP_REG, shell: 'club' });
  for (const key of Object.keys(LY)) {
    const C = LY[key], T = 'rule 8: ' + key + ' ';
    ok(C.shell === 'works', T + "is the works' layout");
    for (const k of C.kits) {
      ok(!!CORE.HANGAR_KITS[k], T + 'names a kit that exists: ' + k);
      ok(!!C.rows[k], T + 'stands every kit it lists: ' + k);
    }
    for (const k of Object.keys(C.rows)) {
      const R = C.rows[k];
      for (const q of R.sites) ok(union.has(q.prop), T + k + ' sites undeclared prop ' + q.prop);
      for (const r of R.recipes) for (const q of r.props || [])
        ok(union.has(q), T + k + ' recipe ' + r.recipe + ' names undeclared prop ' + q);
    }
    const total = C.kits.reduce((n, k) => n + C.rows[k].sites.length + C.rows[k].recipes.length, 0);
    const r = CORE.hangarFit(W, C.kits, { reg: CORE.PROP_REG, shell: 'works', layout: key });
    ok(r.layout === key, T + 'stands in the works (layout ' + r.layout + ')');
    ok(r.placed.length + r.recipes.length + r.unplaced.length === total,
       T + (r.placed.length + r.recipes.length + r.unplaced.length) + ' outcomes for ' + total + ' rows');
    ok(r.unplaced.length === 0, T + 'places EVERYTHING (' + r.unplaced.map(u => u.kit + '/' + u.key + ':' + u.reason).join(', ') + ')');
    // the floor, re-derived: everything standing ON the floor (no `y`: not a rider, a wall mount, the rug) as its box
    const boxes = [];
    for (const p of r.placed) {
      if (p.y > 0) continue;
      const rec = CORE.PROP_REG.props[p.prop];
      const f = orient(rec ? [rec.dim[0] / 2, rec.dim[2] / 2] : [0.4, 0.4], p.ry);
      boxes.push({ k: p.kit + '/' + p.prop, x0: p.x - f[0], x1: p.x + f[0], z0: p.z - f[1], z1: p.z + f[1] });
    }
    for (const q of r.recipes) {
      const f = orient(q.foot || [0.4, 0.4], q.ry);
      boxes.push({ k: q.kit + '/' + q.recipe, x0: q.x - f[0], x1: q.x + f[0], z0: q.z - f[1], z1: q.z + f[1] });
    }
    const clash = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++)
      if (hit(boxes[i], boxes[j])) clash.push(boxes[i].k + ' x ' + boxes[j].k);
    ok(clash.length === 0, T + 'no two things share floor (' + clash.slice(0, 4).join('; ') + ')');
    for (const b of boxes)
      ok(Math.abs(b.x0) <= W.HD && Math.abs(b.x1) <= W.HD && Math.abs(b.z0) <= W.HW && Math.abs(b.z1) <= W.HW, T + b.k + ' inside the walls');
    // the bay: nothing on the stand's floor (a wide build's span, the bay's own length)
    const bay = { x0: -3, x1: 8, z0: -7.2, z1: 7.2 };
    const inBay = boxes.filter(b => hit(b, bay)).map(b => b.k);
    ok(inBay.length === 0, T + 'leaves the build bay clear (' + inBay.join(', ') + ')');
    // the club: the layout is not there
    const cl1 = CORE.hangarFit(CORE.SHELLS.club.dims, CORE.HANGAR_KITS_DEFAULT, { reg: CORE.PROP_REG, shell: 'club', layout: key });
    ok(cl1.layout === null && JSON.stringify([cl1.placed, cl1.recipes, cl1.unplaced]) === JSON.stringify([cl0.placed, cl0.recipes, cl0.unplaced]),
       T + "named in the club IS the club (the sandbox's room, position for position)");
    // the residents round the stand: a Cub-sized stand, a Cub and a metal Cessna parked
    const H = Object.assign({}, CORE.careerMainShed(), { layout: key });
    const stand = { x0: -2.3, x1: 7.4, z0: -5.9, z1: 5.9 };
    const RP = CORE.hangarPark(H, [{ name: 'Cub', foot: { half: 5.4, fwd: 1.8, aft: 6.9, h: 2.1 } },
                                   { name: 'Cessna', foot: { half: 5.6, fwd: 1.6, aft: 7.2, h: 2.7 } }], { reg: CORE.PROP_REG, keep: [stand] });
    ok(RP.placed.length === 2, T + 'parks both residents beside the stand (' + JSON.stringify(RP.unplaced) + ')');
    const obs = CORE.hangarObstacles(H, CORE.PROP_REG);
    ok(obs.length >= boxes.length - 2, T + "is the residents' obstacles (" + obs.length + ' for ' + boxes.length + ')');
    for (const p of RP.placed) {
      ok(!hit(p.rect, stand), T + 'resident ' + p.name + ' clear of the stand');
      const o = obs.find(b => hit(p.rect, b));
      ok(!o, T + 'resident ' + p.name + ' clear of the fit-out' + (o ? ' (' + o.key + ')' : ''));
    }
    if (RP.placed.length === 2) ok(!hit(RP.placed[0].rect, RP.placed[1].rect), T + 'residents clear of each other');
  }
  // the career's main hangar, and the sandbox's
  const d = CORE.careerNew({ id: 'g2315', seed: 'g2315' }), H = d.sheds.HOME;
  ok(H.shell === 'works' && H.layout === CORE.CAREER_MAIN.layout && !!LY[H.layout] && H.dims && H.dims.HW === W.HW && H.dims.HD === W.HD,
     "rule 8: the career's main hangar is the works in its layout (" + JSON.stringify(H) + ')');
  const P0 = CORE.playerDefault().sheds.HOME;
  ok(P0.shell === 'club' && !P0.layout && !P0.dims, "rule 8: the sandbox's default is still the club");
  const old = CORE.playerDefault(); old.mode = 'career';
  const up = CORE.careerNormalise(JSON.parse(JSON.stringify(old)));
  ok(up.sheds.HOME.layout === CORE.CAREER_MAIN.layout && up.sheds.HOME.shell === 'works', "rule 8: an untouched career club becomes the career's works");
  ok(JSON.stringify(CORE.careerNormalise(JSON.parse(JSON.stringify(up)))) === JSON.stringify(up), 'rule 8: ... once (a fixpoint)');
  const touched = CORE.playerDefault(); touched.mode = 'career'; touched.sheds.HOME.dims = { HW: 14, HD: 11, EAVE: 6.5 };
  ok(CORE.careerNormalise(touched).sheds.HOME.shell === 'club', "rule 8: a touched career club is the player's, kept");
}

// ---- BLOCK B: the shells BUILD -- a stubbed THREE, instrumented ------------
function mkTHREE(bad) {
  const V3 = class {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    copy(v) { return this.set(v.x, v.y, v.z); }
    clone() { return new V3(this.x, this.y, this.z); }
    add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
    sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
    multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
    normalize() { const l = Math.hypot(this.x, this.y, this.z) || 1;
      return this.multiplyScalar(1 / l); }
    length() { return Math.hypot(this.x, this.y, this.z); }
    setScalar(s) { return this.set(s, s, s); }
    distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
    lerp() { return this; } applyMatrix4() { return this; }
    applyQuaternion() { return this; } applyAxisAngle() { return this; }
    addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s;
      this.z += v.z * s; return this; }
    subVectors(a, b) { return this.set(a.x - b.x, a.y - b.y, a.z - b.z); }
    addVectors(a, b) { return this.set(a.x + b.x, a.y + b.y, a.z + b.z); }
    crossVectors(a, b) { return this.set(a.y * b.z - a.z * b.y,
      a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x); }
    dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
    setFromMatrixPosition() { return this; }
    negate() { return this.multiplyScalar(-1); }
    cross(v) { return this.crossVectors(this.clone(), v); }
    projectOnVector() { return this; }
    setFromSpherical() { return this; }
  };
  // a real-enough attribute: the room walks position/normal/uv with the
  // typed accessors (metric uvs, roof slopes, the marking sheet), so these
  // cannot be faked away with an empty object
  class Attr {
    constructor(n, is = 3) { this.count = n; this.itemSize = is;
      this.array = new Float32Array(n * is); this.needsUpdate = false; }
    getX(i) { return this.array[i * this.itemSize]; }
    getY(i) { return this.array[i * this.itemSize + 1]; }
    getZ(i) { return this.array[i * this.itemSize + 2]; }
    setX(i, v) { this.array[i * this.itemSize] = v; }
    setY(i, v) { this.array[i * this.itemSize + 1] = v; }
    setZ(i, v) { this.array[i * this.itemSize + 2] = v; }
    setXY(i, x, y) { this.setX(i, x); this.setY(i, y); }
    setXYZ(i, x, y, z) { this.setX(i, x); this.setY(i, y); this.setZ(i, z); }
  }
  // every geometry records its constructor args; a negative or non-finite
  // size is the EAVE-5.2 / HW-14 class of silent wrongness this block hunts
  const sizeArgs = { BoxGeometry: 3, PlaneGeometry: 2, CylinderGeometry: 3,
                     ConeGeometry: 2, TorusGeometry: 2 };
  class Geo {
    constructor(tag, args) {
      this.tag = tag; this.userData = {}; this.index = null;
      this.attributes = { position: new Attr(4), normal: new Attr(4),
                          uv: new Attr(4, 2) };
      const n = sizeArgs[tag] || 0;
      for (let i = 0; i < n; i++) {
        const v = args[i];
        if (v === undefined) continue;
        if (!isFinite(v)) bad.push(tag + ' arg ' + i + ' = ' + v);
        else if (v < 0) bad.push(tag + ' arg ' + i + ' = ' + v.toFixed(3));
        else if ((tag === 'BoxGeometry' || tag === 'PlaneGeometry') && v === 0)
          bad.push(tag + ' arg ' + i + ' = 0');
      }
    }
    translate() { return this; } rotateX() { return this; }
    rotateY() { return this; } rotateZ() { return this; } scale() { return this; }
    setAttribute(n, a) { this.attributes[n] = a; return this; }
    setIndex() { return this; } computeVertexNormals() { return this; }
    computeBoundingBox() { this.boundingBox =
      { min: new V3(), max: new V3(1, 1, 1) }; return this; }
    clone() { return new Geo(this.tag, []); }
    toNonIndexed() { return this; } center() { return this; }
    applyMatrix4() { return this; } dispose() {}
  }
  const geoCls = tag => class extends Geo {
    constructor(...a) { super(tag, a); }
  };
  class Obj3 {
    constructor() {
      this.position = new V3(); this.scale = new V3(1, 1, 1);
      this.rotation = { x: 0, y: 0, z: 0,
                        set: function (x, y, z) { this.x = x; this.y = y; this.z = z; } };
      this.children = []; this.visible = true; this.userData = {};
      this.castShadow = false; this.receiveShadow = false;
      this.renderOrder = 0; this.layers = { set() {}, enable() {}, disable() {} };
      this.up = new V3(0, 1, 0);
      this.quaternion = { setFromUnitVectors() { return this; },
                          setFromAxisAngle() { return this; },
                          copy() { return this; }, identity() { return this; } };
    }
    add(...o) { for (const c of o) { this.children.push(c); if (c && typeof c === 'object') c.parent = this; } return this; }
    remove(o) { const i = this.children.indexOf(o);
      if (i >= 0) this.children.splice(i, 1); return this; }
    traverse(f) { f(this); this.children.forEach(c => c.traverse && c.traverse(f)); }
    lookAt() {} updateMatrixWorld() {} getWorldPosition(v) { return v || new V3(); }
    clone() { return new Obj3(); }
  }
  class Mesh extends Obj3 {
    constructor(g, m) { super(); this.isMesh = true;
      this.geometry = g || new Geo('none', []); this.material = m || {}; }
  }
  class Col {
    constructor(c) { this.r = this.g = this.b = 1; if (c !== undefined) this.set(c); }
    set() { return this; } setRGB(r, g, b) { this.r = r; this.g = g; this.b = b; return this; }
    setHSL() { return this; } getHSL(t) { t = t || {}; t.h = 0; t.s = 0; t.l = 0.5; return t; }
    getHex() { return ((this.r * 255) << 16) | ((this.g * 255) << 8) | (this.b * 255); }
    copy(c) { return this.setRGB(c.r, c.g, c.b); }
    clone() { return new Col().copy(this); }
    lerp() { return this; } multiplyScalar(s) { this.r *= s; this.g *= s;
      this.b *= s; return this; }
    offsetHSL() { return this; } convertSRGBToLinear() { return this; }
    lerpColors() { return this; } setHex() { return this; }
    setStyle() { return this; } setScalar(s) { return this.setRGB(s, s, s); }
    add() { return this; } multiply() { return this; } equals() { return true; }
  }
  const mat = extra => function (p) {
    const m = Object.assign({
      color: new Col(),
      emissive: new Col().setRGB(0, 0, 0),
      normalScale: { x: 1, y: 1, set() {}, clone() { return { x: 1, y: 1 }; },
                     copy() {} },
      clone: function () { return Object.assign({}, this); },
      dispose() {},
    }, extra || {}, p || {});
    if (typeof m.color === 'number') m.color = new Col();
    if (typeof m.emissive === 'number') m.emissive = new Col();
    return m;
  };
  class Light extends Obj3 {
    constructor(c, i) { super(); this.intensity = i || 1;
      this.color = new Col(); this.groundColor = new Col();
      this.target = new Obj3();
      this.shadow = { mapSize: { set() {} }, camera: {}, bias: 0,
                      normalBias: 0, radius: 1 }; }
  }
  const canvas2d = () => new Proxy({
    createImageData: (w, h) => ({ width: w, height: h,
      data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (x, y, w, h) => ({ width: w, height: h,
      data: new Uint8ClampedArray(w * h * 4) }),
    measureText: () => ({ width: 8 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createPattern: () => ({}),
  }, { get: (t, k) => (k in t) ? t[k] : (typeof k === 'string' ? () => {} : undefined),
       set: () => true });
  return {
    Group: class extends Obj3 {},
    Object3D: Obj3,
    Mesh: Mesh,
    Color: Col,
    Fog: class { constructor(c, n, f) { this.color = new Col();
      this.near = n; this.far = f; } },
    BoxGeometry: geoCls('BoxGeometry'),
    CylinderGeometry: geoCls('CylinderGeometry'),
    PlaneGeometry: geoCls('PlaneGeometry'),
    ConeGeometry: geoCls('ConeGeometry'),
    TorusGeometry: geoCls('TorusGeometry'),
    ShapeGeometry: geoCls('ShapeGeometry'),
    ExtrudeGeometry: geoCls('ExtrudeGeometry'),
    SphereGeometry: geoCls('SphereGeometry'),
    RingGeometry: geoCls('RingGeometry'),
    CircleGeometry: geoCls('CircleGeometry'),
    LatheGeometry: geoCls('LatheGeometry'),
    BufferGeometry: geoCls('BufferGeometry'),
    Shape: class { moveTo() {} lineTo() {} absarc() {} arc() {}
      quadraticCurveTo() {} bezierCurveTo() {} closePath() {}
      holes = []; },
    Path: class { moveTo() {} lineTo() {} absarc() {} arc() {} },
    Float32BufferAttribute: class {
      constructor(a, n) { this.array = a; this.itemSize = n;
        this.count = a.length / n; }
      getX(i) { return this.array[i * this.itemSize]; }
      getY(i) { return this.array[i * this.itemSize + 1]; }
      getZ(i) { return this.array[i * this.itemSize + 2]; }
      setXYZ() {} },
    MeshStandardMaterial: mat({ roughness: 1, metalness: 0 }),
    MeshBasicMaterial: mat(),
    MeshPhysicalMaterial: mat({ roughness: 1 }),
    MeshLambertMaterial: mat(),
    MeshDepthMaterial: mat(), MeshDistanceMaterial: mat(),
    ShaderMaterial: mat({ uniforms: {} }),
    PointsMaterial: mat(), LineBasicMaterial: mat(), SpriteMaterial: mat(),
    HemisphereLight: Light, DirectionalLight: Light,
    PointLight: Light, SpotLight: Light, RectAreaLight: Light,
    AmbientLight: Light,
    CanvasTexture: class { constructor() { this.repeat = { set() {} };
      this.offset = { set() {} }; this.wrapS = 0; this.wrapT = 0;
      this.anisotropy = 1; this.needsUpdate = false; } dispose() {} },
    DataTexture: class { dispose() {} },
    Vector2: class { constructor(x = 0, y = 0) { this.x = x; this.y = y; }
      set(x, y) { this.x = x; this.y = y; return this; }
      clone() { return new this.constructor(this.x, this.y); } },
    Vector3: V3,
    Matrix4: class { compose() { return this; } identity() { return this; }
      makeRotationY() { return this; } multiply() { return this; }
      elements = new Array(16).fill(0); },
    Box3: class { constructor() { this.min = new V3(-1, 0, -1);
        this.max = new V3(1, 1, 1); }
      setFromObject() { return this; }
      getSize(v) { return v.set(2, 1, 2); }
      getCenter(v) { return v.set(0, 0.5, 0); } },
    Sphere: class {},
    WebGLRenderTarget: class { constructor(w, h) { this.width = w; this.height = h;
      this.texture = { dispose() {} }; } setSize() {} dispose() {} },
    WebGLCubeRenderTarget: class { constructor(s) { this.texture =
      { dispose() {} }; } dispose() {} fromEquirectangularTexture() { return this; } },
    CubeCamera: class { constructor() { this.position = { set() {} };
      this.renderTarget = { texture: {} }; } update() {} },
    PerspectiveCamera: class extends Obj3 { updateProjectionMatrix() {} },
    OrthographicCamera: class extends Obj3 { updateProjectionMatrix() {} },
    Scene: class extends Obj3 {},
    RepeatWrapping: 1000, ClampToEdgeWrapping: 1001, DoubleSide: 2,
    FrontSide: 0, BackSide: 1, SRGBColorSpace: 'srgb', LinearSRGBColorSpace: 'srgb-linear', NoColorSpace: '',
    LinearFilter: 1006, LinearMipmapLinearFilter: 1008, NearestFilter: 1003,
    AdditiveBlending: 2, EquirectangularReflectionMapping: 303,
    MathUtils: { degToRad: d => d * Math.PI / 180, clamp:
      (v, a, b) => Math.max(a, Math.min(b, v)) },
    _canvas2d: canvas2d,
  };
}

function runB(mutSrcH) {
  let srcH = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'hangar.js'),
                             'utf8');
  if (mutSrcH) srcH = mutSrcH(srcH);
  // site_ground.js rides along: the manifest loads it before BOTH scenes, so
  // hangar.js calls its factories bare — and payload-less they fall back to
  // the drawn sheets, which is exactly the degrade path this block builds in
  const srcG = fs.readFileSync(
    path.join(ROOT, 'src', 'viewer', 'site_ground.js'), 'utf8');
  srcH = srcG + '\n' + srcH;
  const bad = [];
  const T = mkTHREE(bad);
  const doc = { createElement: tag => tag === 'canvas'
    ? { width: 0, height: 0, getContext: () => T._canvas2d(),
        toDataURL: () => 'data:,' }
    : {} };
  let api = null, err = null;
  try {
    // hangarLayout rides in (G2315): the room reads its layout's light from it, as the page does
    api = new Function('THREE', 'document', 'window', 'console', 'hangarLayout',
      '"use strict";\n' + srcH +
      '\nreturn { genHangarBuild, genHangarSupported };')(
      T, doc, {}, { log() {}, warn() {}, info() {}, error() {} }, CORE.hangarLayout);
  } catch (e) { err = e; }
  if (!ok(!err, 'hangar.js evaluates under the stub' +
          (err ? ' (' + err.message + ')' : ''))) return;
  ok(api.genHangarSupported(T),
     'the stub satisfies GEN_HANGAR_NEEDS — the checklist is the contract');
  // rule 7 (G437): THE CLOCK'S MOOD IS THE PRESET'S ROW. day_clock.js puts
  // each named hour at a sun elevation (afternoon 33.4, golden 8, sunset
  // -0.833, dusk -6, night far below); moodFor(day) must hand each one its
  // own row - the exclusive thresholds sent 'sunset' to DUSK and 'dusk' to
  // NIGHT and the select flipped under the player's hand.
  {
    let room7 = null; try { room7 = api.genHangarBuild(T, CORE.SHELLS.club ? CORE.SHELLS.club.dims : { HW: 12, HD: 18, EAVE: 5 }, { shell: CORE.SHELLS.club ? 'club' : undefined }); } catch (e) {}
    const moodFor = room7 && typeof room7.moodFor === 'function' ? room7.moodFor : null;
    ok(!!moodFor, 'rule 7: the room publishes moodFor');
    const rows = moodFor ? [['afternoon', 33.4, 0], ['golden', 8, 1], ['sunset', -0.833, 2], ['dusk', -6, 3], ['night', -40, 4]] : [];
    for (const [name, el, want] of rows) {
      const got = moodFor({ sunEl: el, cloudCover: 0.2 });
      ok(got === want, 'rule 7: the ' + name + ' preset (sun ' + el + ' deg) lands on mood row ' + want + (got === want ? '' : ' (got ' + got + ')'));
    }
  }

  // rule 8 (G2315): THE COZY ROOM'S LIGHT. The works with layout cozy hangs its five fittings over the rooms (the
  // layout's metres, each at its own height with its own inverse-square factor) at 2700 K; the club - with or without
  // the layout named - hangs the cross at 0.74 of the eave at 4000 K, no per-fitting factor (today's room)
  {
    for (const lk of Object.keys(CORE.HANGAR_LAYOUTS || {})) {
    const LY = CORE.HANGAR_LAYOUTS[lk];
    let cz = null, cl = null, cl2 = null;
    try { cz = api.genHangarBuild(T, CORE.SHELLS.works.dims, { shell: 'works', layout: lk }); } catch (e) { ok(false, 'rule 8: the ' + lk + ' works builds (' + e.message + ')'); }
    try { cl = api.genHangarBuild(T, CORE.SHELLS.club.dims, { shell: 'club' }); cl2 = api.genHangarBuild(T, CORE.SHELLS.club.dims, { shell: 'club', layout: 'cozy' }); } catch (e) { ok(false, 'rule 8: the club builds (' + e.message + ')'); }
    if (cz && cl && cl2 && LY) {
      ok(cz.layout === lk && cl.layout === null && cl2.layout === null, 'rule 8: the room says its layout (' + lk + ' / none / none in the club)');
      const L = cz.lights.lamps, K = cl.lights.lamps;
      ok(L.length === 5 && K.length === 5, 'rule 8: five fittings either way (the shadow-map budget)');
      const at = L.map(l => [+(l.parent.position.x).toFixed(2), +(l.parent.position.z).toFixed(2), +(l.parent.position.y).toFixed(2)]);
      ok(JSON.stringify(at) === JSON.stringify(LY.light.lamps.map(([x, z, y]) => [x, z, y])), 'rule 8: the cozy fittings hang where the layout says ' + JSON.stringify(at));
      ok(L.every(l => l.userData.hk > 0) && K.every(l => l.userData.hk === undefined), 'rule 8: per-fitting hang factors in the cozy works only');
      ok(cz.lampRig().kelvin === LY.light.kelvin && cl.lampRig().kelvin === 4000 && cl2.lampRig().kelvin === 4000, 'rule 8: the warm filament in the ' + lk + ' works, 4000 K in the club');
      ok(cz.lampRig().gain === (LY.light.gain || 1) && cl.lampRig().gain === 1 && cl2.lampRig().gain === 1, 'rule 8: the ' + lk + ' lamp gain ' + (LY.light.gain || 1) + ', the club 1');
      const kz = K.map(l => [l.parent.position.x, l.parent.position.z]), k2 = cl2.lights.lamps.map(l => [l.parent.position.x, l.parent.position.z]);
      ok(JSON.stringify(kz) === JSON.stringify(k2), 'rule 8: the club\'s cross unmoved by a layout it does not stand');
    }
    }
  }

  const corners = lims => {
    const out = [];
    for (const HW of lims.HW) for (const HD of lims.HD)
      for (const EAVE of lims.EAVE) out.push({ HW, HD, EAVE });
    return out;
  };
  for (const sk of Object.keys(CORE.SHELLS)) {
    const sh = CORE.SHELLS[sk];
    if (sh.status !== 'live') continue;      // a declared shell has no build yet
    for (const dims of [sh.dims].concat(corners(sh.lims))) {
      const tag = sk + ' at ' + dims.HW + '/' + dims.HD + '/' + dims.EAVE;
      for (const ext of [false, true]) {
        bad.length = 0;
        let room = null, threw = null;
        try {
          room = api.genHangarBuild(T, dims,
            ext ? { exterior: true, shell: sk } : { shell: sk });
        } catch (e) { threw = e; }
        ok(!threw, tag + (ext ? ' exterior' : ' interior') + ' builds' +
           (threw ? ' (' + threw.message + ')' : ''));
        if (threw) continue;
        ok(bad.length === 0, tag + (ext ? ' exterior' : ' interior') +
           ' draws no negative geometry (' + bad.slice(0, 3).join('; ') + ')');
        near(room.dims.HW, dims.HW, 1e-9, tag + ' echoes HW');
        near(room.dims.HD, dims.HD, 1e-9, tag + ' echoes HD');
        near(room.dims.EAVE, dims.EAVE, 1e-9, tag + ' echoes EAVE');
      }
      // rule 2: the two poses agree — same function, same dims, and the gate
      // says so anyway, because "nearly free" is why it is worth asserting
      const a = api.genHangarBuild(T, dims, { shell: sk });
      const b = api.genHangarBuild(T, dims, { exterior: true, shell: sk });
      ok(a.dims.HW === b.dims.HW && a.dims.HD === b.dims.HD &&
         a.dims.RIDGE === b.dims.RIDGE,
         tag + ': interior and exterior agree on every dimension');
    }
  }
}

function run(mut) {
  fails = []; checks = 0;
  runA();
  runB(mut && mut.srcH);
  return { checks, fails };
}

// ---------------------------------------------------------------------------
const snapshot = () => JSON.parse(JSON.stringify({
  kits: CORE.HANGAR_KITS, caps: CORE.HANGAR_CAPS, layouts: CORE.HANGAR_LAYOUTS }));
const restore = snap => {
  for (const k in CORE.HANGAR_KITS) delete CORE.HANGAR_KITS[k];
  Object.assign(CORE.HANGAR_KITS, snap.kits);
  for (const k in CORE.HANGAR_LAYOUTS) delete CORE.HANGAR_LAYOUTS[k];
  Object.assign(CORE.HANGAR_LAYOUTS, snap.layouts);
  CORE.HANGAR_CAPS.length = 0;
  CORE.HANGAR_CAPS.push(...snap.caps);
};

const base = run(null);
if (!SELF) {
  for (const f of base.fails) console.log('  - ' + f);
  console.log(base.checks + ' checks');
  console.log('GATE HANGAR: ' + (base.fails.length
    ? 'FAIL (' + base.fails.length + ' of ' + base.checks + ')' : 'PASS'));
  process.exit(base.fails.length ? 1 : 0);
}

// ---- negative verification -------------------------------------------------
const realFit = CORE.hangarFit;
const BREAKS = [
  ['a ghost prop in a kit',
   { pre: () => CORE.HANGAR_KITS.bench.props.push('no_such_prop') }],
  ['a prop nobody claims',
   { pre: () => { const i = CORE.HANGAR_KITS.metal.props.indexOf('weldingcart');
       CORE.HANGAR_KITS.metal.props.splice(i, 1); } }],
  ['a prop claimed twice',
   { pre: () => CORE.HANGAR_KITS.bench.props.push('weldingcart') }],
  ['a verb nothing grants',
   { pre: () => CORE.HANGAR_CAPS.push('levitate') }],
  ['a site walks off the wall',
   { pre: () => { CORE.HANGAR_KITS.metal.sites[0].along = 1.4; } }],
  ['the engine drops refusals on the floor',
   { pre: () => { CORE.hangarFit = (d, k, o) => {
       const r = realFit(d, k, o); r.unplaced = []; return r; }; },
     post: () => { CORE.hangarFit = realFit; } }],
  ['a cozy row names a ghost prop',
   { pre: () => CORE.HANGAR_LAYOUTS.cozy.rows.bench.sites.push({ prop: 'no_such_prop', at: 'floor', fx: 0.5, fz: 0.5, dry: 0 }) }],
  ['two cozy things on one floor',
   { pre: () => { const s = CORE.HANGAR_LAYOUTS.cozy.rows.curio.sites.find(q => q.prop === 'car_covered'); s.fx = -16.5 / 20; s.fz = -11.0 / 20; } }],
  ['the cozy layout leaks into the club',
   { pre: () => { CORE.HANGAR_LAYOUTS.cozy.shell = null; }, post: () => { CORE.HANGAR_LAYOUTS.cozy.shell = 'works'; } }],
  ['the cozy works drops a row',
   { pre: () => { CORE.HANGAR_LAYOUTS.cozy.rows.office.sites.push({ prop: 'desk_metal', at: 'shop', along: 1.6, out: 0.9, dry: 0 }); } }],
  ['the career forgets its cozy works',
   { pre: () => { CORE.CAREER_MAIN.layout = 'nope'; }, post: () => { CORE.CAREER_MAIN.layout = 'hearth'; } }],
  ['the hearth parks its lounge on the stand',
   { pre: () => { const r = CORE.HANGAR_LAYOUTS.hearth.rows.comfort.sites.find(q => q.prop === 'chair_lounge'); r.fx = 2 / 20; r.fz = 3 / 20; } }],
  ['the club hangs the cozy lamps',
   { srcH: s => s.replace('const LAYIT = (LAYOUT && LAYOUT.light) || null;', 'const LAYIT = (typeof hangarLayout === "function" && hangarLayout("cozy", "works") || {}).light || null;') }],
  ['a wall drawn with a negative box',
   { srcH: s => s.replace('const DOOR_W = Math.max(6, 2 * HW - 5)',
                          'const DOOR_W = (2 * HW - 55)') }],
];
let bad = 0;
for (const [name, mut] of BREAKS) {
  const snap = snapshot();
  if (mut.pre) mut.pre();
  const r = run(mut);
  if (mut.post) mut.post();
  restore(snap);
  const caught = r.fails.length > base.fails.length;
  console.log((caught ? '  caught  ' : '  MISSED  ') + name +
    (caught ? '  (' + (r.fails.length - base.fails.length) + ' new)' : ''));
  if (!caught) bad++;
}
console.log('GATE HANGAR selftest: ' + (bad ? 'FAIL (' + bad + ' not caught)' : 'PASS'));
process.exit(bad ? 1 : 0);
