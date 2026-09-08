// HOUSE KIT — the geometry primitives the wooden-house bench is built from
// (G229). Sister to _gear_kit.js: same shape of module, same Bag contract, so
// the headless checker can measure a house exactly the way GATE GEAR measures
// an undercarriage — by recording what the bench's own builders emit.
//
// WHY IT IS NOT THE GEAR KIT. That kit is a SWEEP-and-REVOLVE kit, because
// undercarriage hardware is tubes and turned parts. A house is none of those.
// A house is BOARDS AND PANELS: rectangular members cut to length, flat panels
// with holes in them, and roof planes. Two primitives carry almost the whole
// building — `beam` (any stick of timber between two points) and `wall` (a
// panel of given thickness with rectangular openings, reveals and caps) — and
// the third, `plate`, is a planar polygon given a thickness, which is what a
// roof surface is.
//
// TWO RULES THIS KIT ENFORCES, both of them things that go wrong by hand:
//
//   1 EVERY FACE IS EMITTED THROUGH `face(bag, pts, wantN)`, which computes the
//     polygon's own Newell normal and reverses the ring if it disagrees with
//     the normal the caller asked for. Winding bugs are then impossible rather
//     than merely unlikely — and on a building, where every surface is a plain
//     rectangle, a flipped quad is invisible until you walk round it.
//   2 EVERY VERTEX CARRIES A UV IN METRES, projected on the surface's own
//     frame. Materials come later (the user's ruling: clean geometry first),
//     but a lap-siding or standing-seam texture only ever works if u and v are
//     real distances along the wall and up the slope — retrofitting that means
//     rewriting every builder, so it is done at the source.
'use strict';
(() => {
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- vector kit (names match _gear_kit.js on purpose) ---------------------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const len = a => Math.hypot(a[0], a[1], a[2]);
const nrm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2],
                       a[0] * b[1] - a[1] * b[0]];
const off = (p, d, k) => [p[0] + d[0] * k, p[1] + d[1] * k, p[2] + d[2] * k];
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t,
                            a[2] + (b[2] - a[2]) * t];

// ---- geometry bag ---------------------------------------------------------
// One indexed buffer per MATERIAL. `data()` hands back the plain arrays, which
// is what makes the headless gate possible without a THREE stub: the checker
// measures the very arrays the renderer would have been given.
function Bag(name) {
  const pos = [], uv = [], idx = [], ao = [];
  // SMOOTH SHADING, WHERE A SURFACE IS ACTUALLY CURVED (the user: "for the
  // rounded pillars, you may want to use smooth shading"). Every face here
  // gets its own vertices, so computeVertexNormals gives flat shading — right
  // for a board, wrong for a pile, which is a nine-sided prism pretending to
  // be a tree and reads as one. A caller that KNOWS the true normal (a
  // cylinder does: it is the radial direction) hands it over per vertex and
  // it overrides the computed one. Sparse on purpose: the override array is
  // only touched by the few builders that have a curve.
  const nOv = new Map();
  return {
    name: name || '',
    v: (p, u, n) => { pos.push(p[0], p[1], p[2]);
                      uv.push(u ? u[0] : 0, u ? u[1] : 0);
                      ao.push(1);           // lit until the bake says otherwise
                      const i = pos.length / 3 - 1;
                      if (n) nOv.set(i, n);
                      return i; },
    quad: (a, b, c, d) => { idx.push(a, b, c, a, c, d); },
    tri: (a, b, c) => { idx.push(a, b, c); },
    get tris() { return idx.length / 3; },
    get verts() { return pos.length / 3; },
    data: () => ({ pos, uv, idx, ao }),
    mesh: (parent, mat) => {
      if (!idx.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position',
        new THREE.BufferAttribute(new Float32Array(pos), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
      // the baked occlusion rides as an attribute, not a map: a procedural
      // building has no lightmap UV set and does not want one
      g.setAttribute('aHouseAO',
        new THREE.BufferAttribute(new Float32Array(ao), 1));
      g.setIndex(idx);
      g.computeVertexNormals();
      if (nOv.size) {
        const na = g.attributes.normal.array;
        nOv.forEach((n, i) => {
          na[i * 3] = n[0]; na[i * 3 + 1] = n[1]; na[i * 3 + 2] = n[2];
        });
        g.attributes.normal.needsUpdate = true;
      }
      const m = new THREE.Mesh(g, mat);
      m.castShadow = true; m.receiveShadow = true;
      parent.add(m);
      return m;
    },
  };
}

// ---- the one door every face goes through --------------------------------
// pts: a planar convex ring. wantN: the direction it must face. uvf: point ->
// [u,v] in metres; omitted means the caller has nothing meaningful to say and
// the face gets (0,0) — never silently a wrong tiling.
function face(bag, pts, wantN, uvf, nf) {
  // A quad whose two corners have collapsed onto one another is a TRIANGLE —
  // it happens at every hip apex and at every wedge under a sloping wall top,
  // and fanning it as written would emit a zero-area triangle each time. The
  // ring is deduped here rather than at the twenty call sites.
  if (pts.length > 3) {
    const keep = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) +
          Math.abs(a[2] - b[2]) > 1e-6) keep.push(a);
    }
    pts = keep;
  }
  if (pts.length < 3) return;
  // Newell: robust for any planar ring, and it does not care about convexity
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  if (!isFinite(nx + ny + nz)) return;
  const ring = (wantN && (nx * wantN[0] + ny * wantN[1] + nz * wantN[2]) < 0)
    ? pts.slice().reverse() : pts;
  // NO FACE LEAVES HERE WITHOUT A UV. A caller with nothing to say about its
  // mapping used to get (0,0) on every corner — zero texture area, which is a
  // fully stretched face and exactly what GATE HOUSE's angle rule now catches.
  // Derive the polygon's OWN in-plane frame instead: first edge as u, the
  // normal crossed with it as v. Metres, like everything else.
  let uvfn = uvf;
  if (!uvfn) {
    const n2 = nrm([nx, ny, nz]);
    let ax = sub(ring[1], ring[0]);
    if (len(ax) < 1e-9) ax = sub(ring[2], ring[0]);
    const U2 = nrm(ax), V2 = nrm(crs(n2, U2));
    uvfn = uvFrame(ring[0], U2, V2);
  }
  const ids = ring.map(p => bag.v(p, uvfn(p), nf ? nf(p) : null));
  for (let i = 1; i + 1 < ids.length; i++) bag.tri(ids[0], ids[i], ids[i + 1]);
}

// A UV PROJECTOR: metres along X and Y of an arbitrary frame, from an origin.
//
// THE RULE THIS FILE NOW OBEYS EVERYWHERE (the user: "You should avoid
// stretched textures that you project under an angle, and it gets fully
// stretched along the perpendicular axis. You should map your boxes
// rigorously, and one by one. That includes every depth."):
//
//   X AND Y MUST BOTH LIE IN THE FACE. Project a horizontal window sill with
//   Y = world up and every point on it gets v = the same number: the texture
//   is smeared infinitely along the depth of the reveal. Project a 34-degree
//   roof from above and it is stretched by 1/cos(34) up the slope. Neither is
//   visible on a checker and both are obvious on a plank.
//
// `uvOff` shifts the origin in TEXTURE space, which is how two deck boards cut
// from the same scan stop being the same board.
const uvFrame = (o, X, Y, uvOff) => p => {
  const d = sub(p, o);
  return uvOff ? [dot(d, X) + uvOff[0], dot(d, Y) + uvOff[1]]
               : [dot(d, X), dot(d, Y)];
};

// ---- boards, sticks and blocks -------------------------------------------
// An axis-aligned block. min/max in world metres — wall plates, sills, the
// floor slab, a masonry chimney.
function boxAB(bag, mn, mx, skip, uvo) {
  const x0 = mn[0], y0 = mn[1], z0 = mn[2];
  const x1 = mx[0], y1 = mx[1], z1 = mx[2];
  const S = skip || {};
  const P = (x, y, z) => [x, y, z];
  if (!S.px) face(bag, [P(x1,y0,z0),P(x1,y1,z0),P(x1,y1,z1),P(x1,y0,z1)], [1,0,0],
                  uvFrame([x1,y0,z0], [0,0,1], [0,1,0], uvo));
  if (!S.nx) face(bag, [P(x0,y0,z1),P(x0,y1,z1),P(x0,y1,z0),P(x0,y0,z0)], [-1,0,0],
                  uvFrame([x0,y0,z1], [0,0,-1], [0,1,0], uvo));
  if (!S.py) face(bag, [P(x0,y1,z0),P(x1,y1,z0),P(x1,y1,z1),P(x0,y1,z1)], [0,1,0],
                  uvFrame([x0,y1,z0], [1,0,0], [0,0,1], uvo));
  if (!S.ny) face(bag, [P(x0,y0,z1),P(x1,y0,z1),P(x1,y0,z0),P(x0,y0,z0)], [0,-1,0],
                  uvFrame([x0,y0,z1], [1,0,0], [0,0,-1], uvo));
  if (!S.pz) face(bag, [P(x0,y0,z1),P(x1,y0,z1),P(x1,y1,z1),P(x0,y1,z1)], [0,0,1],
                  uvFrame([x0,y0,z1], [1,0,0], [0,1,0], uvo));
  if (!S.nz) face(bag, [P(x1,y0,z0),P(x0,y0,z0),P(x0,y1,z0),P(x1,y1,z0)], [0,0,-1],
                  uvFrame([x1,y0,z0], [-1,0,0], [0,1,0], uvo));
}

// THE STICK OF TIMBER. a -> b, section 2*hw across by 2*ht along `up`; `up` is
// orthogonalised against the axis, so a raking stringer or a diagonal brace
// keeps its face square to the world without the caller doing any frame maths.
// This is the primitive every post, joist, rail, baluster, tread, corner board
// and casing in the house is made of — one call, six faces, correct UVs.
// `o` (optional): { swap, uv } — `swap` runs u ACROSS the stick and v ALONG
// it, which is what a round pole wants (the user: "these poles are not made of
// planks, but maybe well mapped it can be OK (put the seam on the corners)");
// `uv` offsets the whole mapping so two identical boards are not identical.
// Every face still starts its u at its OWN corner, so the seam lands on the
// arris and never in the middle of a face.
function beam(bag, a, b, hw, ht, up, ext, o) {
  const sw = o && o.swap, uvo = (o && o.uv) || null;
  const F = (org, A, B) => (sw ? uvFrame(org, B, A, uvo) : uvFrame(org, A, B, uvo));
  const ax = sub(b, a);
  const L = len(ax);
  if (L < 1e-6) return null;
  const X = mul(ax, 1 / L);
  let U = up || [0, 1, 0];
  U = sub(U, mul(X, dot(U, X)));
  if (len(U) < 1e-6) U = sub([0, 0, 1], mul(X, dot([0, 0, 1], X)));
  U = nrm(U);
  const W = nrm(crs(X, U));
  const e = ext || 0;
  const A = off(a, X, -e), B = off(b, X, e);
  const c = (p, s, t) => add(add(p, mul(W, s * hw)), mul(U, t * ht));
  // A VERY SMALL CHAMFER ON THE ARRISES (the user: "For the square pillars,
  // you may want to do a very small bevel on the harsh corners. The finish
  // could also use a small bevel to catch light better in the high poly
  // version"). A sawn post has no mathematically sharp edge and neither does
  // a milled casing; what the bevel buys is not the silhouette, it is the
  // HIGHLIGHT — a 6 mm facet at 45 degrees catches the sky along the whole
  // length of a member and draws its line, which is most of what makes timber
  // read as timber under a raking sun. Eight faces instead of four, at lod 0
  // only, and only where a caller asks.
  const bv = Math.min((o && o.bevel) || 0, hw * 0.45, ht * 0.45);
  if (bv > 0.0005) {
    const sec = [[-(hw - bv), -ht], [hw - bv, -ht], [hw, -(ht - bv)],
                 [hw, ht - bv], [hw - bv, ht], [-(hw - bv), ht],
                 [-hw, ht - bv], [-hw, -(ht - bv)]];
    const pA = sec.map(q => add(add(A, mul(W, q[0])), mul(U, q[1])));
    const pB = sec.map(q => add(add(B, mul(W, q[0])), mul(U, q[1])));
    for (let i = 0; i < sec.length; i++) {
      const j = (i + 1) % sec.length;
      const dv = nrm(sub(pA[j], pA[i]));
      const nf2 = nrm(crs(dv, X));
      face(bag, [pA[i], pB[i], pB[j], pA[j]],
           dot(nf2, sub(pA[i], A)) > 0 ? nf2 : mul(nf2, -1), F(pA[i], X, dv));
    }
    face(bag, pB, X, uvFrame(pB[0], W, U, uvo));
    face(bag, pA.slice().reverse(), mul(X, -1), uvFrame(pA[0], W, U, uvo));
    return { X: X, U: U, W: W, A: A, B: B, L: L + 2 * e };
  }
  const P = [c(A,-1,-1), c(A,1,-1), c(A,1,1), c(A,-1,1),
             c(B,-1,-1), c(B,1,-1), c(B,1,1), c(B,-1,1)];
  face(bag, [P[1],P[5],P[6],P[2]], W, F(P[1], X, U));          // +W
  face(bag, [P[0],P[3],P[7],P[4]], mul(W,-1), F(P[0], X, U));
  face(bag, [P[3],P[2],P[6],P[7]], U, F(P[3], X, W));          // +U
  face(bag, [P[0],P[4],P[5],P[1]], mul(U,-1), F(P[0], X, W));
  face(bag, [P[4],P[7],P[6],P[5]], X, uvFrame(P[4], W, U, uvo));  // ends
  face(bag, [P[0],P[1],P[2],P[3]], mul(X,-1), uvFrame(P[0], W, U, uvo));
  return { X: X, U: U, W: W, A: A, B: B, L: L + 2 * e };
}

// THE ROOF SURFACE. A planar ring given a thickness, dropped along `dir`
// (default straight down, which is what makes the eave edge read as a fascia
// board of exactly the roof's own depth). Convex rings only — every facet this
// bench produces is a quad or a triangle.
function plate(bag, ring, drop, dir, uvf, opt2) {
  const d = dir || [0, -1, 0];
  const top = ring.slice();
  // orient the ring so it faces AWAY from the drop, then the sides follow
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < top.length; i++) {
    const a = top[i], b = top[(i + 1) % top.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const up = [-d[0], -d[1], -d[2]];
  if (nx * up[0] + ny * up[1] + nz * up[2] < 0) top.reverse();
  const bot = top.map(p => off(p, d, drop));
  // A ROOF FACET IS ONE QUAD AND THE BAKE NEEDS MORE THAN FOUR CORNERS: with
  // `sub` the two big faces are laid out as a grid instead. Bilinear on the
  // ring, so a trapezoid (a hip end, a saltbox slope) subdivides correctly.
  const subLen = opt2 && opt2.sub;      // NOT named `sub`: that is the vector op
  if (subLen && top.length === 4) {
    const nu = Math.max(1, Math.ceil(len(sub(top[1], top[0])) / subLen));
    const nv = Math.max(1, Math.ceil(len(sub(top[3], top[0])) / subLen));
    const bl = (r, u, v) => {
      const a = lerp3(r[0], r[1], u), b = lerp3(r[3], r[2], u);
      return lerp3(a, b, v);
    };
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const u0 = i / nu, u1 = (i + 1) / nu, v0 = j / nv, v1 = (j + 1) / nv;
      face(bag, [bl(top, u0, v0), bl(top, u1, v0), bl(top, u1, v1),
                 bl(top, u0, v1)], up, uvf);
      face(bag, [bl(bot, u0, v0), bl(bot, u0, v1), bl(bot, u1, v1),
                 bl(bot, u1, v0)], d, uvf);
    }
  } else {
    face(bag, top, up, uvf);
    face(bag, bot.slice().reverse(), d, uvf);
  }
  for (let i = 0; i < top.length; i++) {
    const j = (i + 1) % top.length;
    if (len(sub(top[j], top[i])) < 1e-6) continue;
    const eN = nrm(crs(sub(top[j], top[i]), d));
    face(bag, [top[i], bot[i], bot[j], top[j]], eN,
         uvFrame(top[i], nrm(sub(top[j], top[i])), mul(d, -1)));
  }
  return { top: top, bot: bot };
}

// ---- THE STRAIGHT RUN OF A SHAPED SECTION ---------------------------------
// A closed 2D profile, given in (across, up) metres of the run's own frame,
// extruded from a to b. The gutter is a C, the downpipe's bracket is a strap,
// and an ogee gutter is four more points in the same list — none of them a
// special case in the caller.
//
// The profile must be wound COUNTER-CLOCKWISE in (W, U); each side face then
// takes its outward normal from cross(X, edge), which is the identity
// X x W = -U at work, and `face` cannot flip it back.
function sweepProfile(bag, a, b, prof, up, cap) {
  const ax = sub(b, a);
  const L = len(ax);
  if (L < 1e-6 || prof.length < 3) return null;
  // WIND IT HERE, not at the call site. A half-round gutter section is
  // naturally written as an arc from one lip to the other, which comes out
  // CLOCKWISE and turns the trough inside out; the signed area says so and the
  // fix is one reverse. (`face` cannot save this one — the normal it is handed
  // is derived from the ring's own direction.)
  let area = 0;
  for (let i = 0; i < prof.length; i++) {
    const q = prof[i], r2 = prof[(i + 1) % prof.length];
    area += q[0] * r2[1] - r2[0] * q[1];
  }
  if (area < 0) prof = prof.slice().reverse();
  const X = mul(ax, 1 / L);
  let U = up || [0, 1, 0];
  U = sub(U, mul(X, dot(U, X)));
  if (len(U) < 1e-6) U = sub([0, 0, 1], mul(X, dot([0, 0, 1], X)));
  U = nrm(U);
  const W = nrm(crs(X, U));
  const at = (i, end) => {
    const p = prof[i];
    const o = end ? b : a;
    return [o[0] + W[0] * p[0] + U[0] * p[1],
            o[1] + W[1] * p[0] + U[1] * p[1],
            o[2] + W[2] * p[0] + U[2] * p[1]];
  };
  const A = prof.map((_, i) => at(i, false));
  const B = prof.map((_, i) => at(i, true));
  // THE SECTION'S ARC LENGTH IS ACCUMULATED, not restarted per face. A gutter
  // mapped face by face repeats the same 4 cm of texture round every facet of
  // its own section — the user watched it do exactly that — and the fix is the
  // same one the cylinder needed: walk the profile and carry v with you.
  let vAcc = 0;
  for (let i = 0; i < prof.length; i++) {
    const j = (i + 1) % prof.length;
    const e = sub(A[j], A[i]);
    const el = len(e);
    if (el < 1e-7) continue;
    const eu = mul(e, 1 / el);
    const n = nrm(crs(X, eu));
    const v0 = vAcc;
    vAcc += el;
    face(bag, [A[i], A[j], B[j], B[i]], n,
         p => [dot(sub(p, A[i]), X), v0 + dot(sub(p, A[i]), eu)]);
  }
  // CAPPING A SHELL IS NOT A FAN. A gutter's section is a C: fanning it from
  // one corner lays triangles straight across the open trough and puts two
  // collinear degenerates at the lips. 'shell' pairs point i with point
  // len-1-i — which for any two-sided section IS the matching point on the
  // other face — and caps it as a strip of quads, the thickness of the metal.
  if (cap === 'shell' && prof.length % 2 === 0) {
    const n = prof.length;
    for (let i = 0; i + 1 < n / 2; i++) {
      face(bag, [A[i], A[i + 1], A[n - 2 - i], A[n - 1 - i]], mul(X, -1),
           uvFrame(A[i], W, U));
      face(bag, [B[i], B[n - 1 - i], B[n - 2 - i], B[i + 1]], X,
           uvFrame(B[i], W, U));
    }
  } else if (cap) {
    face(bag, A.slice().reverse(), mul(X, -1), uvFrame(A[0], W, U));
    face(bag, B, X, uvFrame(B[0], W, U));
  }
  return { X: X, U: U, W: W, L: L, A: A, B: B, prof: prof };
}

// a half-round gutter's section: the trough, with a bead on the outer lip.
// r is the inside radius, t the sheet thickness. Returned CCW in (W, U) with
// the open top at U = 0, so `sweepProfile` can run it along an eave.
function troughSection(r, t, segs) {
  const N = Math.max(4, segs || 9);
  const out = [];
  for (let i = 0; i <= N; i++) {            // inside face, right to left
    const a = Math.PI * i / N;
    out.push([r * Math.cos(a), -r * Math.sin(a)]);
  }
  for (let i = N; i >= 0; i--) {            // outside face, back again
    const a = Math.PI * i / N;
    out.push([(r + t) * Math.cos(a), -(r + t) * Math.sin(a)]);
  }
  return out;
}

// a cylinder — the stove pipe, and nothing else in this house
// `o.uvSwap` puts u ALONG THE AXIS instead of round the circumference, which
// is what makes a round pile agree with a square post (the user: "the rough
// raw wood used for the pillars should be rotated 90degrees in all mappings").
// beam() lays u along the stick; cyl() laid it round the stick; so one scan
// could not be right on both, and the frame is drawn with both. A pipe still
// wants the arc-length mapping — u follows the eye round it — so this is an
// option and not a change.
function cyl(bag, base, dir, r, h, segs, cap, o) {
  const X = nrm(dir);
  let U = Math.abs(X[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  U = nrm(sub(U, mul(X, dot(U, X))));
  const W = nrm(crs(X, U));
  const N = Math.max(3, segs | 0);
  const ring = t => {
    const out = [];
    for (let i = 0; i < N; i++) {
      const a = 2 * Math.PI * i / N;
      out.push(add(add(base, mul(X, h * t)),
                   add(mul(U, Math.cos(a) * r), mul(W, Math.sin(a) * r))));
    }
    return out;
  };
  const r0 = ring(0), r1 = ring(1);
  // ARC LENGTH, ACCUMULATED — not atan2. A polar u wraps at the seam, and the
  // one quad that straddles it gets a u span of the whole circumference: seven
  // times its own area in texture, which is a compressed smear exactly where
  // the eye follows a pipe round. Walking the ring adds up instead.
  let uAcc = 0;
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    const n = nrm(sub(r0[i], base));
    const eu = nrm(sub(r0[j], r0[i]));
    const u0 = uAcc;
    uAcc += len(sub(r0[j], r0[i]));
    const sw = !!(o && o.uvSwap);
    const uo = (o && o.uv) || [0, 0];
    // the TRUE normal of a cylinder is radial, and it is known exactly — no
    // averaging, no smoothing groups, no welding: each vertex is handed the
    // direction it actually faces
    const rad = (o && o.smooth)
      ? p => { const d2 = sub(p, base); return nrm(sub(d2, mul(X, dot(d2, X)))); }
      : null;
    face(bag, [r0[i], r0[j], r1[j], r1[i]], n, p => {
      const a2 = u0 + dot(sub(p, r0[i]), eu), b2 = dot(sub(p, base), X);
      return sw ? [b2 + uo[0], a2 + uo[1]] : [a2 + uo[0], b2 + uo[1]];
    }, rad);
  }
  if (cap) {
    face(bag, r1, X, uvFrame(r1[0], U, W));
    face(bag, r0.slice().reverse(), mul(X, -1), uvFrame(r0[0], U, W));
  }
  return { X: X, U: U, W: W };
}

// ---- THE N-GON: TOWERS, SPIRES AND ROUND POSTS ---------------------------
// An octagonal belfry is the one shape on an Alaskan church a box kit cannot
// fake, and a spire is the same ring closed to a point. Both are built from
// RINGS rather than from a primitive with a height, because a ring's vertices
// carry their own y — which is what lets a tower's base sit DOWN on a pitched
// roof instead of hovering over it with a gap at the eaves.
//
// Outward is taken from the ring's own centroid, so a ring wound either way
// comes out facing the right side (and `face` does the rest).
const ringCentre = ring => {
  let x = 0, y = 0, z = 0;
  for (const p of ring) { x += p[0]; y += p[1]; z += p[2]; }
  const n = ring.length || 1;
  return [x / n, y / n, z / n];
};

const ringN = (cx, cz, r, n, rot, y) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (rot || 0) + 2 * Math.PI * i / n;
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    out.push([x, (typeof y === 'function') ? y(x, z) : (y || 0), z]);
  }
  return out;
};

// two rings of the same length, stitched: a tower body, a curb, a pile cap
function prismRings(bag, bot, top, capBot, capTop) {
  const n = Math.min(bot.length, top.length);
  const c = ringCentre(bot);
  let u = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const e = sub(bot[j], bot[i]);
    const el = len(e);
    if (el < 1e-7) continue;
    const mid = lerp3(bot[i], bot[j], 0.5);
    const outN = nrm([mid[0] - c[0], 0, mid[2] - c[2]]);
    const u0 = u; u += el;
    const eu = nrm(e);
    face(bag, [bot[i], bot[j], top[j], top[i]], outN,
         p => [u0 + dot(sub(p, bot[i]), eu), p[1]]);
  }
  if (capTop) face(bag, top.slice(), [0, 1, 0], p => [p[0], p[2]]);
  if (capBot) face(bag, bot.slice(), [0, -1, 0], p => [p[0], p[2]]);
}

// a ring closed to a point: the spire, and the pyramid cap of a pile
function apexTo(bag, ring, apex) {
  const c = ringCentre(ring);
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    const mid = lerp3(ring[i], ring[j], 0.5);
    const outN = nrm([mid[0] - c[0], 0.35, mid[2] - c[2]]);
    const eu = nrm(sub(ring[j], ring[i]));
    const vu = nrm(sub(apex, mid));            // up the face, not up the world
    face(bag, [ring[i], ring[j], apex], outN, uvFrame(ring[i], eu, vu));
  }
}

// ---- THE WALL -------------------------------------------------------------
// A panel of thickness `t` standing on the plan segment A -> B, from y0 up to
// a top that is a FUNCTION of the distance along it. That last part is the
// whole trick: a gable end wall and an eave wall are then the same call, with
// the roof's own underside handed in as `topAt` — so the wall meets the roof
// exactly, at every pitch, with no gap to caulk and no triangle to hand-build.
//
// Holes are rectangles in (s, y). The panel is split into COLUMNS at every
// hole edge and every extra split the caller names (the ridge, for one), and
// each column into BANDS at the hole edges it contains; a band inside a hole
// is simply not emitted. No ear clipping, no T-junctions, every face a quad.
//
// Exterior is the +N side, N = [-dz, 0, dx]: walk the footprint so that the
// outside is on your left and every wall comes out facing the right way.
// `ext` (optional, [start, end] in metres) lengthens the panel at each end
// WITHOUT moving its A/B: four walls run round a plan rectangle on their own
// centrelines, so each one has to reach half a thickness past the corner or
// the shell has a t/2 notch at all four corners — which is exactly the gap
// the user found by changing a dimension.
function wall(bag, o) {
  const A0 = o.A, B0 = o.B, y0 = o.y0, t = o.t;
  const ex = o.ext || [0, 0];
  const ddx = B0[0] - A0[0], ddz = B0[1] - A0[1];
  const dL = Math.hypot(ddx, ddz) || 1;
  const A = [A0[0] - ddx / dL * ex[0], A0[1] - ddz / dL * ex[0]];
  const B = [B0[0] + ddx / dL * ex[1], B0[1] + ddz / dL * ex[1]];
  const dx = B[0] - A[0], dz = B[1] - A[1];
  const L = Math.hypot(dx, dz);
  if (L < 1e-6) return null;
  const X = [dx / L, 0, dz / L];
  const N = [-dz / L, 0, dx / L];
  // THE TOP IS A FUNCTION OF (s, side). Under a sloping roof the outer face
  // of a thick wall is cut higher than the inner one — read at the centreline
  // instead, a 40 cm wall under a 50-degree pitch stands 24 cm through its own
  // roof. The caller hands in the roof's underside; this asks it twice.
  const topFn = o.topAt || (() => y0 + 2.4);
  const topAt = (s, side) => topFn(s - ex[0], side === undefined ? 1 : side);
  // shifted COPIES: the caller keeps its own coordinates (it still has to
  // dress these openings after the panel is built)
  const holes = (o.holes || []).filter(h => h.s1 > h.s0 + 1e-4)
    .map(h => ({ s0: h.s0 + ex[0], s1: h.s1 + ex[0], y0: h.y0, y1: h.y1,
                 kind: h.kind }));
  const half = t / 2;
  const P = (s, y, side) => [A[0] + X[0] * s + N[0] * half * side, y,
                             A[1] + X[2] * s + N[2] * half * side];
  const oOut = P(0, y0, 1), oIn = P(0, y0, -1);
  const uvOut = p => [dot(sub(p, oOut), X), p[1] - y0];
  const uvIn = p => [-dot(sub(p, oIn), X), p[1] - y0];

  // column boundaries
  const sSet = [0, L];
  const sh = v => v + ex[0];                 // caller's s -> panel's s
  for (const h of holes) sSet.push(clamp(h.s0, 0, L), clamp(h.s1, 0, L));
  for (const s of (o.splits || []))
    if (sh(s) > 1e-4 && sh(s) < L - 1e-4) sSet.push(sh(s));
  sSet.sort((a, b) => a - b);
  const cols = [];
  for (let i = 0; i + 1 < sSet.length; i++)
    if (sSet[i + 1] - sSet[i] > 1e-4) cols.push([sSet[i], sSet[i + 1]]);

  for (const col of cols) {
    const sa = col[0], sb = col[1], mid = (sa + sb) / 2;
    const taO = topAt(sa, 1), tbO = topAt(sb, 1);
    const taI = topAt(sa, -1), tbI = topAt(sb, -1);
    const tMin = Math.min(taO, tbO, taI, tbI);
    const inCol = holes.filter(h => h.s0 <= mid && h.s1 >= mid &&
                                    h.y0 < tMin - 1e-4);
    const yEdges = [y0];
    for (const h of inCol) yEdges.push(clamp(h.y0, y0, tMin),
                                       clamp(h.y1, y0, tMin));
    yEdges.push(tMin);
    yEdges.sort((a, b) => a - b);
    for (let i = 0; i + 1 < yEdges.length; i++) {
      const ya = yEdges[i], yb = yEdges[i + 1];
      if (yb - ya < 1e-4) continue;
      const c = (ya + yb) / 2;
      if (inCol.some(h => h.y0 < c && h.y1 > c)) continue;      // it is a hole
      // THE OUTER FACE IS SUBDIVIDED, the inner one is not. Occlusion is baked
      // PER VERTEX, so a wall drawn as four big quads can only shade at its
      // corners: the band under a window came out flat and the columns beside
      // it came out banded, which is exactly what the screenshot showed. A
      // grid no coarser than the bake's own reach gives it somewhere to land.
      // The inner face is never seen and stays one quad.
      const sub = o.sub || 0;
      const nu = sub > 0.05 ? Math.max(1, Math.ceil((sb - sa) / sub)) : 1;
      const nv = sub > 0.05 ? Math.max(1, Math.ceil((yb - ya) / sub)) : 1;
      for (let a = 0; a < nu; a++) for (let b = 0; b < nv; b++) {
        const s0 = sa + (sb - sa) * a / nu, s1 = sa + (sb - sa) * (a + 1) / nu;
        const y0b = ya + (yb - ya) * b / nv, y1b = ya + (yb - ya) * (b + 1) / nv;
        face(bag, [P(s0,y0b,1), P(s1,y0b,1), P(s1,y1b,1), P(s0,y1b,1)], N, uvOut);
      }
      if (o.inner !== false)
        face(bag, [P(sa,ya,-1), P(sa,yb,-1), P(sb,yb,-1), P(sb,ya,-1)],
             mul(N, -1), uvIn);
    }
    // the wedge under a sloping top, above the last square band
    if (Math.abs(taO - tMin) > 1e-4 || Math.abs(tbO - tMin) > 1e-4) {
      const sub = o.sub || 0;
      const nu = sub > 0.05 ? Math.max(1, Math.ceil((sb - sa) / sub)) : 1;
      for (let a = 0; a < nu; a++) {
        const s0 = sa + (sb - sa) * a / nu, s1 = sa + (sb - sa) * (a + 1) / nu;
        const t0 = tMin + (taO - tMin) * (1 - a / nu) +
                   (tbO - tMin) * (a / nu);
        const t1 = tMin + (taO - tMin) * (1 - (a + 1) / nu) +
                   (tbO - tMin) * ((a + 1) / nu);
        face(bag, [P(s0,tMin,1), P(s1,tMin,1), P(s1,t1,1), P(s0,t0,1)], N, uvOut);
      }
    }
    if (o.inner !== false &&
        (Math.abs(taI - tMin) > 1e-4 || Math.abs(tbI - tMin) > 1e-4))
      face(bag, [P(sa,tMin,-1), P(sa,taI,-1), P(sb,tbI,-1), P(sb,tMin,-1)],
           mul(N, -1), uvIn);
    // top cap (the plate) and bottom cap (the sole)
    if (o.capTop !== false)
      face(bag, [P(sa,taO,1), P(sb,tbO,1), P(sb,tbI,-1), P(sa,taI,-1)], [0,1,0],
           uvFrame(oOut, X, mul(N, -1)));
    if (o.capBot !== false)
      face(bag, [P(sa,y0,-1), P(sb,y0,-1), P(sb,y0,1), P(sa,y0,1)], [0,-1,0],
           uvFrame(oOut, X, N));
  }
  // reveals: the four returns into each opening, which is what gives a window
  // its depth and what makes wall thickness READ from outside
  for (const h of holes) {
    const s0 = clamp(h.s0, 0, L), s1 = clamp(h.s1, 0, L);
    const hy1 = Math.min(h.y1, topAt(s0, 1), topAt(s1, 1),
                         topAt(s0, -1), topAt(s1, -1));
    if (hy1 <= h.y0 + 1e-4) continue;
    // EVERY DEPTH MAPPED IN ITS OWN PLANE. A jamb runs (through the wall, up);
    // a sill and a head run (along the wall, through the wall). Projecting
    // either of the horizontal ones with world-up — which is what the first
    // cut did — smears one texel across the whole thickness of the wall.
    const jam = (a, b, c, d, n, o2) => face(bag, [a, b, c, d], n,
      uvFrame(o2, mul(N, -1), [0, 1, 0]));
    const lin = (a, b, c, d, n, o2) => face(bag, [a, b, c, d], n,
      uvFrame(o2, X, mul(N, -1)));
    jam(P(s0,h.y0,1), P(s0,h.y0,-1), P(s0,hy1,-1), P(s0,hy1,1), X,
        P(s0,h.y0,1));
    jam(P(s1,h.y0,-1), P(s1,h.y0,1), P(s1,hy1,1), P(s1,hy1,-1), mul(X,-1),
        P(s1,h.y0,1));
    lin(P(s0,h.y0,-1), P(s0,h.y0,1), P(s1,h.y0,1), P(s1,h.y0,-1), [0,1,0],
        P(s0,h.y0,1));
    lin(P(s0,hy1,1), P(s0,hy1,-1), P(s1,hy1,-1), P(s1,hy1,1), [0,-1,0],
        P(s0,hy1,1));
  }
  // end caps, so a wall run that stops in mid-air is still a solid
  const endCap = o.endCap || [true, true];
  if (endCap[0])
    face(bag, [P(0,y0,-1), P(0,y0,1), P(0,topAt(0,1),1), P(0,topAt(0,-1),-1)],
         mul(X, -1), uvFrame(P(0,y0,1), mul(N,-1), [0,1,0]));
  if (endCap[1])
    face(bag, [P(L,y0,1), P(L,y0,-1), P(L,topAt(L,-1),-1), P(L,topAt(L,1),1)],
         X, uvFrame(P(L,y0,-1), N, [0,1,0]));
  return { X: X, N: N, L: L, ext: ex,
           P: (s, y, side) => P(s + ex[0], y, side) };
}

// ---- THE ROOF'S OWN EDGE, AS ONE CLOSED SOLID ----------------------------
// (the user: "Your finish around the roof is discontinuous, and not a closed
// volume. Shoot for closed geometry for the roof outline finish.")
//
// A fascia drawn as one board and a barge board drawn as another meet at the
// eave corner in a butt joint that is neither mitred nor closed — and every
// time the pitch or the overhang moved, the two slid past each other. This
// takes the POLYLINE of the roof edge instead (rake, eave, rake) and builds a
// single solid round it: inner face on the roof's own edge, outer face pushed
// out along each segment's outward normal, top and bottom caps, and an end cap
// at each end of the run. The corner vertex is SHARED between its two
// segments and pushed along their bisector by 1/cos(half-angle), which is a
// true mitre — the joint cannot open, whatever the roof does.
function rimLoop(bag, pts, outs, drop, thick, closed) {
  const n = pts.length;
  if (n < 2) return;
  const dirAt = i => {
    const a = outs[Math.max(0, i - 1)], b = outs[Math.min(outs.length - 1, i)];
    const m = nrm([a[0] + b[0], 0, a[2] + b[2]]);
    const k = Math.max(0.35, Math.abs(dot(m, b)));    // the mitre's own gain
    return mul(m, 1 / k);
  };
  const inT = pts.slice();
  const outT = pts.map((p, i) => off(p, dirAt(i), thick));
  const dn = v => [v[0], v[1] - drop, v[2]];
  // THE BOARD IS MAPPED AT ITS OWN ANGLE (the user: "If possible, the angled
  // roof finish should be mapped at their angle, not projected horizontally").
  // v used to be a plumb line, which is a PROJECTION: on a 40 degree rake the
  // grain ran across the board and the texture was squashed by cos(40), so
  // every barge board disagreed with the fascia it met at the eave. In the
  // board's own plane there is nothing to choose - v is simply what is left of
  // the frame once u runs along the board: perpendicular to the run, pointing
  // down the face. On a level fascia that IS the plumb line, so nothing that
  // was right changes.
  const downOf = (eu, oN) => {
    const d = nrm(crs(eu, oN));
    return d[1] > 0 ? mul(d, -1) : d;
  };
  for (let i = 0; i + 1 < n; i++) {
    const j = i + 1, oN = outs[i];
    const eu = nrm(sub(pts[j], pts[i])), dvv = downOf(eu, oN);
    face(bag, [outT[i], outT[j], dn(outT[j]), dn(outT[i])], oN,
         uvFrame(outT[i], eu, dvv));                       // the face you see
    face(bag, [dn(inT[i]), dn(inT[j]), inT[j], inT[i]], mul(oN, -1),
         uvFrame(inT[i], eu, dvv));                        // against the roof
    face(bag, [dn(outT[i]), dn(outT[j]), dn(inT[j]), dn(inT[i])], [0, -1, 0],
         uvFrame(dn(inT[i]), eu, oN));                     // the soffit edge
    face(bag, [inT[i], inT[j], outT[j], outT[i]], [0, 1, 0],
         uvFrame(inT[i], eu, oN));                         // under the roof
  }
  if (!closed) {
    const cap = (i, sgn) => {
      const eu = nrm(sub(pts[Math.min(i + 1, n - 1)], pts[Math.max(0, i - 1)]));
      const oN = outs[Math.min(i, outs.length - 1)];
      face(bag, [inT[i], outT[i], dn(outT[i]), dn(inT[i])], mul(eu, sgn),
           uvFrame(inT[i], oN, downOf(oN, eu)));
    };
    cap(0, -1); cap(n - 1, 1);
  }
}

// ---- BAKED AMBIENT OCCLUSION ---------------------------------------------
// (the user: "Do you think we could bake some occlusion in there?")
//
// A generated building is the one case where AO is cheap and honest: the
// geometry is already in hand, in metres, and the occluders that matter are
// SHORT RANGE — under the eave, inside a reveal, between two deck boards, in
// the corner where two walls meet, under the floor between the piles, in the
// gaps of a stacked cord of wood. None of that needs a path tracer; it needs
// to know what is within half a metre.
//
// SO: voxelise the whole model into a coarse occupancy grid (plus the GROUND,
// which is the largest occluder any of these buildings has), then march a
// fixed hemisphere of rays a few cells out of every vertex. Fixed directions
// and a fixed grid mean the result is DETERMINISTIC — the same house bakes the
// same shadows, which is what lets a gate hold it.
//
// It is stored per VERTEX, not in a map. A procedural building has no second
// UV set and would need an atlas to get one; per-vertex is free, it costs one
// float, and at this geometry density (a board is four vertices across) the
// interpolation is finer than a 512 lightmap would be anyway.
//
// The cost is one pass over the triangles and 16 short marches per vertex:
// single-digit milliseconds on the whole house, so the bench still rebuilds
// live while a slider moves.
const AO_DIRS = (() => {
  // 16 cosine-weighted directions in tangent space, from a spiral: no RNG, so
  // two runs cannot differ
  const out = [];
  const N = 12;
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N;
    const r = Math.sqrt(t), z = Math.sqrt(Math.max(0, 1 - t));
    const a = i * 2.399963;                    // the golden angle
    out.push([Math.cos(a) * r, Math.sin(a) * r, z]);
  }
  return out;
})();

function bakeAO(bags, o) {
  const opt = o || {};
  const strength = opt.strength === undefined ? 0.85 : opt.strength;
  if (strength <= 0.001) return null;
  const range = opt.range || 0.55;            // metres the occlusion reaches
  const list = bags.filter(b => b && b.tris > 0);
  if (!list.length) return null;

  // ---- the box everything lives in ----------------------------------------
  let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
  for (const b of list) {
    const d = b.data();
    for (let i = 0; i < d.pos.length; i += 3) {
      const x = d.pos[i], y = d.pos[i + 1], z = d.pos[i + 2];
      if (!isFinite(x) || !isFinite(y) || !isFinite(z)) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
  }
  if (!(x1 > x0)) return null;
  const pad = range * 1.5;
  x0 -= pad; y0 -= pad; z0 -= pad; x1 += pad; y1 += pad; z1 += pad;
  // the cell is a fraction of the reach, but the grid is capped: a 22 m
  // cannery must not ask for forty million cells
  let cell = opt.cell || range / 3.0;
  let nx, ny, nz, cells;
  for (let guard = 0; guard < 12; guard++) {
    nx = Math.max(2, Math.ceil((x1 - x0) / cell));
    ny = Math.max(2, Math.ceil((y1 - y0) / cell));
    nz = Math.max(2, Math.ceil((z1 - z0) / cell));
    cells = nx * ny * nz;
    if (cells <= 2200000) break;
    cell *= 1.25;
  }
  const grid = new Uint8Array(cells);
  // THE INNER LOOPS ARE WRITTEN FLAT ON PURPOSE. This is a million samples and
  // a couple of hundred thousand ray steps; through closures it was 380 ms on
  // a cabin, which is not a thing you can leave in a live rebuild. Same maths,
  // no calls: one reciprocal, three multiplies, one bounds test.
  const inv = 1 / cell;
  const at = (i, j, k) => (k * ny + j) * nx + i;

  // ---- fill: every triangle, sampled at half a cell ------------------------
  for (const b of list) {
    const d = b.data();
    for (let t = 0; t < d.idx.length; t += 3) {
      const a = d.idx[t] * 3, b2 = d.idx[t + 1] * 3, c = d.idx[t + 2] * 3;
      const ax = d.pos[a], ay = d.pos[a + 1], az = d.pos[a + 2];
      const bx = d.pos[b2], by = d.pos[b2 + 1], bz = d.pos[b2 + 2];
      const cx = d.pos[c], cy = d.pos[c + 1], cz = d.pos[c + 2];
      const e1 = Math.max(Math.abs(bx - ax), Math.abs(by - ay), Math.abs(bz - az));
      const e2 = Math.max(Math.abs(cx - ax), Math.abs(cy - ay), Math.abs(cz - az));
      const n1 = Math.min(48, Math.max(1, Math.ceil(e1 / (cell * 0.85))));
      const n2 = Math.min(48, Math.max(1, Math.ceil(e2 / (cell * 0.85))));
      const ux = bx - ax, uy2 = by - ay, uz2 = bz - az;
      const vx = cx - ax, vy2 = cy - ay, vz2 = cz - az;
      let last = -1;
      for (let p2 = 0; p2 <= n1; p2++) {
        const u = p2 / n1;
        const m = Math.ceil(n2 * (1 - u));
        for (let q = 0; q <= m; q++) {
          const v = (m ? q / m : 0) * (1 - u);
          const i = ((ax + ux * u + vx * v) - x0) * inv | 0;
          const j = ((ay + uy2 * u + vy2 * v) - y0) * inv | 0;
          const k = ((az + uz2 * u + vz2 * v) - z0) * inv | 0;
          if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) continue;
          const ix = (k * ny + j) * nx + i;
          if (ix !== last) { grid[ix] = 1; last = ix; }
        }
      }
    }
  }
  // ---- and the ground, which is the biggest occluder a house has ----------
  if (opt.ground) {
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
      const gy = opt.ground(x0 + (i + 0.5) * cell, z0 + (k + 0.5) * cell);
      const jTop = Math.min(ny - 1, Math.floor((gy - y0) * inv));
      const base = k * ny * nx + i;
      for (let j = 0; j <= jTop; j++) grid[base + j * nx] = 1;
    }
  }

  // ---- per-vertex normals, then march -------------------------------------
  const steps = Math.max(2, Math.round(range / cell));
  let sum = 0, n = 0, lo = 1;
  for (const b of list) {
    const d = b.data();
    const nv = d.pos.length / 3;
    const nrmA = new Float32Array(nv * 3);
    for (let t = 0; t < d.idx.length; t += 3) {
      const ia = d.idx[t], ib = d.idx[t + 1], ic = d.idx[t + 2];
      const a = ia * 3, b2 = ib * 3, c = ic * 3;
      const ux = d.pos[b2] - d.pos[a], uy = d.pos[b2 + 1] - d.pos[a + 1],
            uz = d.pos[b2 + 2] - d.pos[a + 2];
      const vx = d.pos[c] - d.pos[a], vy = d.pos[c + 1] - d.pos[a + 1],
            vz = d.pos[c + 2] - d.pos[a + 2];
      const px = uy * vz - uz * vy, py = uz * vx - ux * vz,
            pz = ux * vy - uy * vx;
      for (const ii of [ia, ib, ic]) {
        nrmA[ii * 3] += px; nrmA[ii * 3 + 1] += py; nrmA[ii * 3 + 2] += pz;
      }
    }
    for (let vi = 0; vi < nv; vi++) {
      let nx2 = nrmA[vi * 3], ny2 = nrmA[vi * 3 + 1], nz2 = nrmA[vi * 3 + 2];
      const nl = Math.hypot(nx2, ny2, nz2) || 1;
      nx2 /= nl; ny2 /= nl; nz2 /= nl;
      // a tangent basis, without a branch that can pick a parallel axis
      let tx = 0, ty = 0, tz = 0;
      if (Math.abs(nx2) < 0.9) { tx = 1; } else { ty = 1; }
      let ux2 = ty * nz2 - tz * ny2, uy2 = tz * nx2 - tx * nz2,
          uz2 = tx * ny2 - ty * nx2;
      const ul = Math.hypot(ux2, uy2, uz2) || 1;
      ux2 /= ul; uy2 /= ul; uz2 /= ul;
      const wx = ny2 * uz2 - nz2 * uy2, wy = nz2 * ux2 - nx2 * uz2,
            wz = nx2 * uy2 - ny2 * ux2;
      // START WELL CLEAR OF THE SURFACE. At three quarters of a cell a ray
      // leaving near-tangentially lands back in the vertex's OWN voxel and the
      // whole model reads as half occluded — the mean came out at 0.53 before
      // this line, which is a model in a cave rather than a house in a field.
      const px = d.pos[vi * 3] + nx2 * cell * 1.35;
      const py = d.pos[vi * 3 + 1] + ny2 * cell * 1.35;
      const pz = d.pos[vi * 3 + 2] + nz2 * cell * 1.35;
      let occ = 0;
      const wsum = AO_DIRS.length;
      for (let di = 0; di < wsum; di++) {
        const D = AO_DIRS[di];
        const dx = (ux2 * D[0] + wx * D[1] + nx2 * D[2]) * cell;
        const dy = (uy2 * D[0] + wy * D[1] + ny2 * D[2]) * cell;
        const dz = (uz2 * D[0] + wz * D[1] + nz2 * D[2]) * cell;
        let sx = px, sy = py, sz = pz;
        for (let st = 1; st <= steps; st++) {
          sx += dx; sy += dy; sz += dz;
          const i = (sx - x0) * inv | 0, j = (sy - y0) * inv | 0,
                k = (sz - z0) * inv | 0;
          if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) break;
          if (grid[(k * ny + j) * nx + i]) { occ += 1 - (st - 1) / steps; break; }
        }
      }
      const a2 = Math.max(0, 1 - strength * (occ / (wsum || 1)));
      d.ao[vi] = a2;
      sum += a2; n++; if (a2 < lo) lo = a2;
    }
  }
  return { mean: n ? sum / n : 1, min: lo, cell: cell, cells: cells,
           steps: steps, verts: n };
}

window.HOUSE_KIT = {
  clamp: clamp, sub: sub, add: add, mul: mul, len: len, nrm: nrm, dot: dot,
  crs: crs, off: off, lerp: lerp, lerp3: lerp3,
  Bag: Bag, face: face, uvFrame: uvFrame, boxAB: boxAB, beam: beam,
  plate: plate, cyl: cyl, wall: wall, sweepProfile: sweepProfile,
  troughSection: troughSection, ringN: ringN, prismRings: prismRings,
  apexTo: apexTo, ringCentre: ringCentre, rimLoop: rimLoop, bakeAO: bakeAO,
};
})();
