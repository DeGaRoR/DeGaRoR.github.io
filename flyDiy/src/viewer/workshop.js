// ============================================================
// WORKSHOP PIECES — half-built aeroplanes, from the game's own generator.
//
// The shed had furniture but nothing being BUILT in it, which is the one thing
// a builder's hangar is for. These are not baked props: they are the same
// buildGen -> genSkin pipeline the flying aeroplane comes out of, run on canned
// specs and then shown in PART. A wing on trestles is the aeroplane's own wing
// with the fuselage left out; the tube fuselage is the aeroplane's own
// structure with the covering, the wheels and the fittings left off.
//
// That is the point of doing it this way rather than modelling four more props:
// when the generator learns something — a new tip shape, a different truss,
// better paint — the work in progress on the floor learns it too, for free.
// The cost is that these pieces are built at hangar time, not baked, so they
// are a few tenths of a second and no payload at all.
//
// WHAT IS TAKEN FROM WHERE
//   THE SKIN comes out of genSkin's MESH groups — the wing, the engine, the
//     covering. THE CAGE is re-lofted from the beam list at workshop
//     resolution (wsTubeCage): the generator's frame mesh is 8-sided with
//     members that simply intersect, which is right at aeroplane distance and
//     wrong at two metres. Drawing def.beams AS STICKS is what looked like a
//     physics debug view; drawing them as 12-sided tube with a welded sphere
//     at every joint is a fuselage.
//   groups are keyed by MATERIAL (skin, frame, engine, tyre, seat, dumm, ...),
//     so a part is one group plus a spatial filter — and everything a piece
//     should NOT have (wheels, seats, crew, dash, cowl, engine) is simply a
//     group that is never asked for.
//   THE BANDS ARE MEASURED off the mesh, not read from the spec. The spec's
//     wing chord is 1.6 and the mesh's wing is a metre across: they are
//     different quantities in different frames, and the one that matters is
//     the frame the triangles are actually in.
//   The sheets are the editor's own — genPaintDataURI / genBumpDataURI /
//     genMrDataURI out of garage.js. Absent them (the smoke gate stubs the
//     viewer) every piece falls back to flat colour rather than to white,
//     which is the same rule buildModel follows and for the same reason.
// ============================================================

const WS_OK = () => typeof buildGen === 'function' && typeof genSkin === 'function'
  && typeof GEN_DEFAULT !== 'undefined';

// ANISOTROPY. A wing lies almost edge-on to the eye for most of a walk round
// it, and that is exactly the case a trilinear mip chain blurs to mush: at a
// grazing angle the footprint of one pixel is long and thin, mip selection
// takes the LONG axis, and the whole texture goes soft. Anisotropic filtering
// is the fix and it is nearly free — but three defaults to 1 and this file used
// to ask for 4. FLYDIY_ANISO is whatever the card actually allows, published by
// app.js once the renderer exists.
const wsAniso = () => (typeof window !== 'undefined' && window.FLYDIY_ANISO) || 8;

// A spec is the default with a few fields moved. Deep-copied, because the
// generator is allowed to normalise what it is handed and GEN_DEFAULT is
// everyone's starting point.
function wsSpec(over) {
  const s = JSON.parse(JSON.stringify(GEN_DEFAULT));
  for (const k in over) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]))
      Object.assign(s[k], over[k]);
    else s[k] = over[k];
  }
  return s;
}

const WS_CACHE = new Map();
function wsDef(key, over) {
  let d = WS_CACHE.get(key);
  if (!d) { const sp = wsSpec(over); d = { spec: sp, def: buildGen(sp) }; WS_CACHE.set(key, d); }
  return d;
}

// ---- geometry helpers ------------------------------------------------------
// A genSkin group, optionally keeping only the triangles every vertex of which
// passes `keep`. The kept triangles are COMPACTED — a new position and uv array
// holding only the vertices they actually reference.
//
// The obvious shortcut is to keep the original arrays and just write a shorter
// index, and it is wrong: computeBoundingBox() reads the POSITION ATTRIBUTE and
// knows nothing about the index, so a wing panel cut out of the skin group
// still reports the whole aeroplane's box. Everything downstream that grounds
// or centres the piece then does it against a box four times too big — the
// panel ends up beside its trestles with a slice of fuselage on them.
function wsGeo(THREE, g, keep) {
  const tri = [];
  for (let t = 0; t < g.nt; t++) {
    const a = g.idx[t * 3], b = g.idx[t * 3 + 1], c = g.idx[t * 3 + 2];
    if (!keep || (keep(g.pos, a) && keep(g.pos, b) && keep(g.pos, c))) tri.push(a, b, c);
  }
  if (!tri.length) return null;
  const map = new Map(), pos = [], uv = [], idx = new Uint32Array(tri.length);
  for (let i = 0; i < tri.length; i++) {
    const v = tri[i];
    let n = map.get(v);
    if (n === undefined) {
      n = map.size; map.set(v, n);
      pos.push(g.pos[v * 3], g.pos[v * 3 + 1], g.pos[v * 3 + 2]);
      if (g.uv) uv.push(g.uv[v * 2], g.uv[v * 2 + 1]);
    }
    idx[i] = n;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  if (g.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  return geo;
}

// The editor's own sheets, when garage.js is there to bake them. A named sheet
// that is not there is NOT a white one — flat colour is the honest fallback.
function wsSkinMat(THREE, spec) {
  const load = (fn, srgb) => {
    if (typeof fn !== 'function') return null;
    const t = new THREE.TextureLoader().load(fn(spec));
    t.anisotropy = wsAniso();
    if (srgb) t.encoding = THREE.sRGBEncoding;
    return t;
  };
  const map = load(typeof genPaintDataURI === 'function' ? genPaintDataURI : null, true);
  const bump = load(typeof genBumpDataURI === 'function' ? genBumpDataURI : null, false);
  const mr = load(typeof genMrDataURI === 'function' ? genMrDataURI : null, false);
  const o = { side: THREE.DoubleSide, roughness: 0.62, metalness: 0.04,
              envMapIntensity: 1 };
  if (map) { o.map = map; o.color = 0xffffff; }
  else o.color = (spec.paint && spec.paint.base) || 0xc8c3b4;
  if (bump) { o.normalMap = bump; o.normalScale = new THREE.Vector2(0.9, 0.9); }
  if (mr) { o.roughnessMap = mr; o.metalnessMap = mr; }
  return new THREE.MeshStandardMaterial(o);
}

// ---- the pieces ------------------------------------------------------------
// Each returns a group whose ORIGIN is where the piece meets the floor, and
// which is centred on its own footprint — the same contract the baked props
// carry, so a placement site treats a wing on trestles exactly like a barrel.
function wsGround(THREE, g) {
  const bb = new THREE.Box3().setFromObject(g);
  if (!isFinite(bb.min.x)) return g;
  const wrap = new THREE.Group();
  g.position.set(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  wrap.add(g);
  wrap.userData.dim = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z];
  return wrap;
}

// A TRESTLE whose TOP SURFACE is at exactly `h`. That matters: the first pass
// measured to the top slab's CENTRE, so every piece stood 7 cm inside its own
// stands.
function wsTrestle(THREE, mat, x, z, w, h) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, h - 0.07, 0.06), mat);
    m.position.set(sx * (w / 2 - 0.05), (h - 0.07) / 2, sz * 0.20);
    m.rotation.z = -sx * 0.10;
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, 0.16), mat);
  top.position.y = h - 0.035;
  top.castShadow = top.receiveShadow = true;
  g.add(top);
  return g;
}

// STANDS GO UNDER THE PIECE, which is the whole of what went wrong the first
// time: they were placed at fractions of the span either side of the ORIGIN,
// and a piece is not centred on its origin — a fuselage runs 0 to 5 m aft, so
// both stands ended up under its nose. Measure the piece, then put n stands
// evenly along ITS OWN footprint, on its own centre-line.
//
// THE STAND IS A REAL TRESTLE now: the work_trestle prop, handed in by the room
// along with the height of its own top, so the contact point is the prop's
// MEASURED top surface and not a number two files agreed on. Its beam runs
// along the prop's own z, so it is turned a quarter to lie ACROSS whatever it
// is carrying. Absent the library the drawn horse is still there.
function wsOnStands(THREE, piece, mats, n) {
  const H = mats.trestleTop || 0.82;
  const bb = new THREE.Box3().setFromObject(piece);
  const inner = new THREE.Group();
  inner.add(piece);
  inner.position.y = H - bb.min.y;            // its LOWEST point rests on a top
  const out = new THREE.Group();
  out.add(inner);
  const len = bb.max.x - bb.min.x, cz = (bb.min.z + bb.max.z) / 2;

  // EACH STAND IS AS TALL AS THE PIECE IS HIGH ABOVE IT. A wing has dihedral,
  // so its underside climbs toward the tips and a row of equal trestles leaves
  // the outer two hanging in the air. Ray the piece downward at each stand's
  // station, take the lowest surface there, and stretch the trestle to reach
  // it. The prop is one mesh at a fixed height, so "stretch" is a scale on y —
  // which is what a builder does with a packing block anyway.
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const meshes = [];
  inner.updateMatrixWorld(true);
  inner.traverse(o => { if (o.isMesh) meshes.push(o); });
  const under = x => {
    ray.set(new THREE.Vector3(x, bb.max.y + H + 2, cz), down);
    const hit = ray.intersectObjects(meshes, false);
    return hit.length ? hit[hit.length - 1].point.y : H;
  };

  for (let i = 0; i < n; i++) {
    const x = bb.min.x + len * (i + 0.5) / n;
    const want = Math.max(H * 0.5, under(x));
    // THE STAND IS TURNED A QUARTER from where it was (user): its beam runs
    // ALONG whatever it carries now, not across it.
    const g = mats.stand ? mats.stand(x, cz, 0) : null;
    if (g) {
      if (Math.abs(want - H) > 0.005) g.scale.y = want / H;
      out.add(g);
    } else {
      out.add(wsTrestle(THREE, mats.wood, x, cz,
        Math.max(0.5, Math.min(1.15, (bb.max.z - bb.min.z) * 0.75)), want));
    }
  }
  return wsGround(THREE, out);
}

// WHERE THE WING IS, measured. Outboard of any tail surface only the wing
// exists, so the vertices past 55% of the half-span give its chord and its
// height directly; a tapered wing's root chord is longer than its tip's, so
// the band is opened a little fore and aft of what the tip reports.
function wsWingBand(g) {
  let zmax = 0;
  for (let i = 0; i < g.nv; i++) zmax = Math.max(zmax, Math.abs(g.pos[i * 3 + 2]));
  const far = zmax * 0.55;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, n = 0;
  for (let i = 0; i < g.nv; i++) {
    if (Math.abs(g.pos[i * 3 + 2]) < far) continue;
    n++;
    const x = g.pos[i * 3], y = g.pos[i * 3 + 1];
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
  }
  return n ? { x0: x0 - 0.35, x1: x1 + 0.50, y0: y0 - 0.14 } : null;
}

// 1. THE WHOLE WING — both panels and the centre section, which is what comes
//    off the jig in one piece — with the ailerons and the flaps left off,
//    because they are hung last and they are their own groups anyway.
function wsWing(THREE, mats) {
  // FLAPS CUT IN (user). They are their own group once the spec asks for them,
  // so asking is all it takes — and the cut-out they leave in the covering is
  // the point: a wing on trestles with its flaps still to hang.
  const { spec, def } = wsDef('wing', { wings: [Object.assign(
    {}, GEN_DEFAULT.wings[0], { flap: 'plain' })] });
  const g = genSkin(def).groups.skin;
  const band = wsWingBand(g);
  if (!band) return null;
  const geo = wsGeo(THREE, g, (p, i) => {
    const x = p[i * 3], y = p[i * 3 + 1];
    return x > band.x0 && x < band.x1 && y > band.y0;
  });
  if (!geo) return null;
  const m = new THREE.Mesh(geo, wsSkinMat(THREE, def.spec || spec));
  m.castShadow = m.receiveShadow = true;
  const piece = new THREE.Group();
  piece.add(m);
  // span along the room's x, and turned round from where it was so the LEADING
  // EDGE is the side you walk past (user)
  piece.rotation.y = -Math.PI / 2;
  return wsOnStands(THREE, piece, mats, 4);
}

// ---------------------------------------------------------------------------
// A WELDED TUBE CAGE, built from the beam list rather than lifted out of the
// structure mesh (G56, user: "replace the square sections of the cages with
// proper tubes, ideally rounded at the corners and properly joined").
//
// The generator's own frame mesh is 8-sided and its members simply intersect
// at the nodes — at aeroplane distance that is right and cheap, but a fuselage
// standing on trestles two metres from the eye shows every facet and every
// unmitred end. So the CAGE is re-lofted here at workshop resolution: 12-sided
// tubes, and a sphere at every node big enough to swallow the ends of
// everything meeting there, which is what a welded cluster looks like.
//
// This is the beam list used as a SKELETON, not as a picture. What was wrong
// with drawing def.beams directly was drawing them AS STICKS; the members and
// their endpoints are the only place a joint is described at all.
function wsTubeCage(THREE, def, mat, opt) {
  const N = def.nodes, POS = [], IDX = [], NRM = [];
  const push = (p, n) => { POS.push(p[0], p[1], p[2]); NRM.push(n[0], n[1], n[2]); };
  const keep = opt.keep;
  const seg = opt.seg || 12;
  const nodes = new Map();                   // node -> the fattest tube on it
  const beams = [];
  for (const b of def.beams) {
    if (opt.cls && b.cls !== opt.cls) continue;
    if (b.vis === 'leg') continue;           // the suspension is not cage
    const A = N[b.a].p, C = N[b.b].p;
    if (!keep(A) || !keep(C)) continue;
    const r = b.vis === 'wire' ? (opt.rWire || 0.005) : (opt.r || 0.017);
    beams.push({ A, C, r, a: b.a, b: b.b });
    nodes.set(b.a, Math.max(nodes.get(b.a) || 0, r));
    nodes.set(b.b, Math.max(nodes.get(b.b) || 0, r));
  }
  if (!beams.length) return null;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const nrm = v => { const L = Math.hypot(v[0], v[1], v[2]) || 1;
                     return [v[0] / L, v[1] / L, v[2] / L]; };
  const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2],
                         a[0] * b[1] - a[1] * b[0]];
  for (const bm of beams) {
    const ax = nrm(sub(bm.C, bm.A));
    const up = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const e1 = nrm(crs(ax, up)), e2 = crs(ax, e1);
    const base = POS.length / 3;
    for (let e = 0; e < 2; e++) {
      const P0 = e ? bm.C : bm.A;
      for (let h = 0; h < seg; h++) {
        const t = 2 * Math.PI * h / seg, c = Math.cos(t), sn = Math.sin(t);
        const n = [e1[0] * c + e2[0] * sn, e1[1] * c + e2[1] * sn, e1[2] * c + e2[2] * sn];
        push([P0[0] + n[0] * bm.r, P0[1] + n[1] * bm.r, P0[2] + n[2] * bm.r], n);
      }
    }
    for (let h = 0; h < seg; h++) {
      const h2 = (h + 1) % seg;
      IDX.push(base + h, base + seg + h, base + seg + h2,
               base + h, base + seg + h2, base + h2);
    }
  }
  // THE JOINTS. One sphere per node, 1.35x the fattest tube on it, so every
  // end that meets there is inside it — that is the rounded corner.
  const RS = 8;
  for (const [ni, r] of nodes) {
    const P0 = N[ni].p, R = r * 1.35, base = POS.length / 3;
    for (let j = 0; j <= RS; j++) {
      const th = Math.PI * j / RS, sy = Math.cos(th), sr = Math.sin(th);
      for (let i = 0; i <= RS * 2; i++) {
        const ph = 2 * Math.PI * i / (RS * 2);
        const n = [sr * Math.cos(ph), sy, sr * Math.sin(ph)];
        push([P0[0] + n[0] * R, P0[1] + n[1] * R, P0[2] + n[2] * R], n);
      }
    }
    const W = RS * 2 + 1;
    for (let j = 0; j < RS; j++) for (let i = 0; i < RS * 2; i++) {
      const a = base + j * W + i, b = a + W;
      IDX.push(a, b, b + 1, a, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(POS, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(NRM, 3));
  geo.setIndex(IDX);
  geo.computeBoundingBox();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// 2. THE WELDED TUBE FUSELAGE, Cub fashion.
function wsTubeFrame(THREE, mats) {
  const { def } = wsDef('frame', {});
  const halfW = ((def.spec && def.spec.cabin && def.spec.cabin.halfW) || 0.36) + 0.14;
  const m = wsTubeCage(THREE, def, mats.steel, {
    cls: 'fus', r: 0.017, rWire: 0.005, seg: 12,
    keep: p => Math.abs(p[2]) < halfW && p[1] > -0.48 && p[0] > -0.75,
  });
  if (!m) return null;
  const piece = new THREE.Group();
  piece.add(m);
  return wsOnStands(THREE, piece, mats, 3);
}

// 3. THE WOODEN CABIN. Same extraction with `fuselage.material = 'wood'` — the
//    generator answers with spruce box section instead of welded tube — cut at
//    the back of the cabin, because a cabin structure is what comes out of the
//    jig, not a whole hull.
function wsWoodCabin(THREE, mats) {
  const { def } = wsDef('cabin', { fuselage: { material: 'wood' } });
  const halfW = ((def.spec && def.spec.cabin && def.spec.cabin.halfW) || 0.36) + 0.16;
  // spruce is a fatter section than 4130 and its corners are eased rather than
  // turned, so: a bigger radius on fewer sides
  const m = wsTubeCage(THREE, def, mats.wood, {
    cls: 'fus', r: 0.026, rWire: 0.007, seg: 8,
    keep: p => Math.abs(p[2]) < halfW && p[1] > -0.48 &&
               p[0] > -0.75 && p[0] < 2.45,
  });
  if (!m) return null;
  const piece = new THREE.Group();
  piece.add(m);
  return wsOnStands(THREE, piece, mats, 2);
}

// 4. AN ENGINE ON A BENCH. The A65 out of the registry, taken as the `engine`
//    group alone — no cowl, no prop, no spinner: an engine on a bench is a
//    bare engine.
function wsEngineBench(THREE, mats) {
  const { def } = wsDef('engine', {
    engines: [{ type: 'a65_sensenich74', mount: 'nose', place: { dx: 0, dy: 0 } }],
  });
  const g = genSkin(def).groups.engine;
  if (!g) return null;
  const geo = wsGeo(THREE, g, null);
  if (!geo) return null;
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: 0x6a6f74, roughness: 0.52, metalness: 0.62, side: THREE.DoubleSide }));
  m.castShadow = m.receiveShadow = true;
  const piece = new THREE.Group();
  piece.add(m);
  const bb = new THREE.Box3().setFromObject(piece);
  const H = 0.72;
  const inner = new THREE.Group();
  inner.add(piece);
  inner.position.y = H - bb.min.y;
  const out = new THREE.Group();
  out.add(inner);
  const bw = Math.max(0.9, (bb.max.x - bb.min.x) + 0.55);
  const bd = Math.max(0.7, (bb.max.z - bb.min.z) + 0.40);
  const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
  const top = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.07, bd), mats.wood);
  top.position.set(cx, H - 0.035, cz);
  top.castShadow = top.receiveShadow = true;
  out.add(top);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, H - 0.07, 0.07), mats.wood);
    leg.position.set(cx + sx * (bw / 2 - 0.07), (H - 0.07) / 2,
                     cz + sz * (bd / 2 - 0.07));
    leg.castShadow = leg.receiveShadow = true;
    out.add(leg);
  }
  return wsGround(THREE, out);
}

// The one entry point. `mats` supplies the room's own wood and steel so a
// trestle in here matches a bench out there.
function wsPiece(THREE, kind, mats) {
  if (!WS_OK()) return null;
  try {
    if (kind === 'wing') return wsWing(THREE, mats);
    if (kind === 'frame') return wsTubeFrame(THREE, mats);
    if (kind === 'cabin') return wsWoodCabin(THREE, mats);
    if (kind === 'engine') return wsEngineBench(THREE, mats);
  } catch (e) {
    if (typeof console !== 'undefined')
      console.warn('workshop piece ' + kind + ':', e.message);
  }
  return null;
}

if (typeof module !== 'undefined' && module.exports)
  module.exports = { wsPiece, wsSpec, wsGeo, wsWingBand };
