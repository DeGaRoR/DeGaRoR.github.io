// proto/skin/anatomy.js — BodyPlan -> one continuous animal.
//
// PROTOTYPE. Nothing here is imported by the app.
//
// THE CHANGE OF PREMISE. The first attempt took the boxes morphogenesis places,
// wrote them as signed distances, and fished a surface out of the union. It
// worked, in the sense that it produced one closed mesh — and it was the wrong
// lever. A reconstruction can only ever approximate shapes nobody designed: a
// fin, which is a membrane, came out of a uniform sampling grid as a ragged
// square sheet, and no amount of resolution fixes that, because the grid has no
// idea what a fin is.
//
// So this builds the body instead of recovering it. The plan is read as ANATOMY:
//
//   SPINE       the longest chain from the root, lofted as one tube. Continuous
//               because it is built continuous — consecutive rings are stitched
//               to each other and there is no seam anywhere to hide.
//   APPENDAGES  every other branch, lofted the same way and flared into the
//               trunk from a point inside it, so a limb grows out of the body
//               rather than being parked against it.
//   PART CLASS  chooses the PROFILE, not the code path. The existing
//               partClass() test (render/creature.js:267) already separates
//               strand from vane from mass off the dimensions alone; here a vane
//               gets a chord that widens outward and a thickness that tapers to
//               an edge, and it comes out a membrane.
//
// LICENCE. The rendered body is an interpretation, not a tracing. The centreline
// is a spline through the body centres rather than a chain of segments, the head
// gets a bulge, the tail gets a taper, and each junction gets a waist. This is
// the standing rule of the project taken one step further: 10 §A10 already says
// physics uses boxes and the render uses capsules "because boxes read as
// furniture". Measurement, hydrodynamics and the Atlas keep reading the boxes.
// What changes is only what the eye is given.

import { qrot, add, sub, scale, dot } from '../../engine/l1/vecmath.js';
import { makeBuilder, resample, frames, loft, smoothstep } from './geom.js';

/**
 * Is this body a BLADE — a fin, a membrane, something with two big axes and one
 * small one?
 *
 * NOT render/creature.js partClass(), deliberately, and this was measured rather
 * than assumed. That function answers a different question — which MATERIAL a
 * body gets — and its `--creature-vane-flat: 0.34` threshold is relative to the
 * body's middle axis AND gated on the animal's largest girth, because a material
 * decision has to be scale-free across a whole creature. Run the Paddletail's
 * caudal fin through it, dims [1.08, 0.19, 0.46], and it comes back `mass`:
 * 0.19 is not below 0.34 x 0.46. It is nonetheless obviously a fin, and it has
 * to be built as one.
 *
 * The anatomical question is only "is it flat", so the test is only that: the
 * thinnest axis against the middle one, at a half rather than a third.
 */
function isBlade(dims) {
  const [mn, mid] = [...dims].sort((a, b) => a - b);
  return mn < 0.5 * mid;
}

/* ── shape constants ──────────────────────────────────────────────────────
 * The dials an art pass would touch. Not tokens: proto/ is outside the gate,
 * and a token per curve coefficient would be a token set nobody can read.
 * ------------------------------------------------------------------------ */
const RADIAL = 14;          // vertices around a section
const STATIONS_PER_BODY = 7;
const BLEND_HALF = 0.30;    // skin-weight crossover half-width, in body units
const WAIST = 0.16;         // how far a junction pinches in
const WAIST_HALF = 0.26;    // ...and over what span
const HEAD_BULGE = 0.16;    // the root body reads as a head, not as segment zero
const TAIL_TAPER = 0.55;    // how far the last body narrows before its cap
const CAP = 0.55;           // cap extension, as a fraction of local girth
const FLARE = 1.5;          // collar where an appendage leaves the trunk
const FLARE_DEPTH = 0.75;   // how far inside the parent the appendage starts

/**
 * Split the tree into chains. A chain is the longest path from its root — by
 * accumulated LENGTH, not by body count, because a two-body trunk of long
 * segments is the animal and a five-body chain of stubs hanging off it is not.
 *
 * AND BY ALIGNMENT, which was not obvious until sixteen random genomes were on
 * screen at once. morphogenesis attaches a child to any of six parent faces, so
 * "the longest path" can be a staircase — the library keeps a seed called
 * `staircase` precisely because a chain of ninety-degree turns is a thing this
 * generator does. Lofted, that path becomes a continuous zigzag ribbon, which is
 * worse than the segmented version it replaced: separate capsules at least read
 * as a mistake, whereas a smooth zigzag reads as a design.
 *
 * So a child that keeps going the way its parent was pointing is worth more than
 * a slightly longer one that turns a corner. What turns off the spine becomes a
 * branch, and a branch gets a flared collar and reads as a limb — which is what
 * a body sticking out sideways IS.
 */
function chains(plan) {
  const n = plan.bodies.length;
  const kids = plan.bodies.map(() => []);
  for (const b of plan.bodies) if (b.parent >= 0) kids[b.parent].push(b.index);

  // Reach = the longest run of body length below this node, inclusive. Bodies
  // are breadth-first with parent < child, so one backward pass resolves it.
  const reach = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let best = 0;
    for (const k of kids[i]) best = Math.max(best, reach[k]);
    reach[i] = plan.bodies[i].dims[2] + best;
  }

  const out = [];
  const queue = [{ start: 0, attach: -1 }];
  while (queue.length) {
    const { start, attach } = queue.shift();
    const seq = [start];
    let cur = start;
    for (;;) {
      const ks = kids[cur];
      if (!ks.length) break;
      const zc = zAxis(plan.bodies[cur]);
      const score = (k) => {
        const align = Math.max(0, dot(zc, zAxis(plan.bodies[k])));
        return reach[k] * (0.25 + 0.75 * align * align);
      };
      let main = ks[0], best = score(ks[0]);
      for (const k of ks) { const s = score(k); if (s > best) { best = s; main = k; } }
      for (const k of ks) if (k !== main) queue.push({ start: k, attach: cur });
      seq.push(main);
      cur = main;
    }
    out.push({ bodies: seq, attach });
  }
  return out;
}

/** Quarter-circle falloff: 1 at u=1, 0 at u=0, meeting the axis at a right
 *  angle so the cap closes as a dome and not as a cone. */
const round01 = (u) => Math.sqrt(Math.max(0, 1 - (1 - Math.max(0, Math.min(1, u))) ** 2));

const zAxis = (body) => qrot(body.rotation, [0, 0, 1]);
const xAxis = (body) => qrot(body.rotation, [1, 0, 0]);
/** Where a body meets its parent: the centre of its own -Z face, which is the
 *  attachment convention morphogenesis fixes and never revisits. */
const entryOf = (body) => sub(body.position, scale(zAxis(body), body.dims[2] * 0.5));
const exitOf = (body) => add(body.position, scale(zAxis(body), body.dims[2] * 0.5));

/**
 * @param {object} plan
 * @param {object} genome
 * @param {object} [opts]
 * @returns {{ geometry: THREE.BufferGeometry, stats: object }}
 */
export function buildAnatomy(plan, genome, opts = {}) {
  const t0 = performance.now();
  const radial = opts.radial ?? RADIAL;
  const waist = opts.waist ?? WAIST;
  const headBulge = opts.headBulge ?? HEAD_BULGE;
  const uvRef = opts.uvRef ?? 0.55;

  const B = makeBuilder();
  const blade = plan.bodies.map((b) => isBlade(b.dims));
  const list = chains(plan);

  for (const chain of list) buildChain(B, plan, chain, {
    radial, waist, headBulge, uvRef, blade,
    // A uniform outward offset, added AFTER every profile multiplier so the
    // shaping cannot cancel it. This is what makes the same builder produce a
    // shell around the shipped render instead of a replacement for it.
    inflate: opts.inflate ?? 0,
  });

  const geometry = B.build();
  return {
    geometry,
    stats: {
      chains: list.length,
      spineLength: list[0].bodies.length,
      vertices: B.vertexCount,
      triangles: B.triangleCount,
      msTotal: performance.now() - t0,
    },
  };
}

function buildChain(B, plan, chain, cfg) {
  const seq = chain.bodies;
  const m = seq.length;
  const body = (k) => plan.bodies[seq[k]];
  const isBranch = chain.attach >= 0;

  const halfX = seq.map((i) => plan.bodies[i].dims[0] * 0.5);
  const halfY = seq.map((i) => plan.bodies[i].dims[1] * 0.5);
  const girth = seq.map((i, k) => (halfX[k] + halfY[k]) * 0.5);

  /* ── control polyline ───────────────────────────────────────────────────
   * t is the chain coordinate: integer k is body k's centre, k - 0.5 is where
   * body k meets what came before it. Everything downstream — radius, skin
   * weight, waist — is a function of t, which is what keeps them consistent
   * with each other.
   * -------------------------------------------------------------------- */
  const pts = [];
  const ts = [];

  const first = body(0);
  const startExt = isBranch
    // Into the parent. An appendage that starts at the surface ends in a visible
    // disc; one that starts inside it reads as having grown from it.
    ? FLARE_DEPTH * girth[0] * 2
    : CAP * girth[0] * 2;
  pts.push(sub(entryOf(first), scale(zAxis(first), startExt)));
  ts.push(-0.85);

  for (let k = 0; k < m; k++) {
    pts.push(entryOf(body(k)));
    ts.push(k - 0.5);
    pts.push(body(k).position.slice());
    ts.push(k);
  }
  const last = body(m - 1);
  const endExt = CAP * girth[m - 1] * 2;
  pts.push(exitOf(last));
  ts.push(m - 0.5 + 0.5);
  pts.push(add(exitOf(last), scale(zAxis(last), endExt)));
  ts.push(m - 0.5 + 0.85);

  // Stations follow the section detail: a coarse ring around a coarse spacing
  // along, or the mesh is fine one way and faceted the other.
  const S = Math.max(18, Math.min(220,
    Math.round((10 + STATIONS_PER_BODY * m) * (cfg.radial / 14))));
  const path = resample(pts, [ts], S);
  const T = path.p;
  const tAt = path.c[0];
  const fr = frames(T, xAxis(first));

  // v runs on arclength so the section spacing is even and a future texture
  // repeats at a physical size rather than per station.
  const v = [0];
  for (let i = 1; i < S; i++) v.push(v[i - 1] + Math.hypot(...sub(T[i], T[i - 1])));
  const totalLen = v[S - 1] || 1;
  const vTex = v.map((x) => x / cfg.uvRef);

  /* ── binding: which bodies own this station, and how much ─────────────── */
  function bind(t) {
    const w = t + 0.5;
    const J = Math.round(w);
    const off = w - J;                       // -0.5 .. 0.5 from the nearest joint
    const lowIdx = J - 1, upIdx = J;
    const low = lowIdx < 0 ? chain.attach : (lowIdx > m - 1 ? seq[m - 1] : seq[lowIdx]);
    const up = upIdx > m - 1 ? seq[m - 1] : (upIdx < 0 ? seq[0] : seq[upIdx]);
    if (low < 0) return { a: up, b: up, w: 1, off, joint: false };
    if (low === up) return { a: up, b: up, w: 1, off, joint: false };
    const wUp = smoothstep(0, 1, (off / BLEND_HALF + 1) * 0.5);
    return { a: low, b: up, w: wUp, off, joint: true };
  }

  /** Half-extents at a station, blended across the joint the same way the skin
   *  weights are — one function of t, so the surface narrows exactly where the
   *  bones hand over. */
  function halfAt(t) {
    const k = Math.max(0, Math.min(m - 1, Math.round(t)));
    const bnd = bind(t);
    const idxOf = (bodyIndex) => seq.indexOf(bodyIndex);
    const ka = idxOf(bnd.a), kb = idxOf(bnd.b);
    const ax = ka < 0 ? halfX[kb] : halfX[ka], ay = ka < 0 ? halfY[kb] : halfY[ka];
    const bx = halfX[kb < 0 ? k : kb], by = halfY[kb < 0 ? k : kb];
    return [ax + (bx - ax) * bnd.w, ay + (by - ay) * bnd.w, bnd];
  }

  const rx = [], ry = [];
  const tailIsVane = cfg.blade[seq[m - 1]];
  // The last body's span in chain coordinates, including the closing extension.
  const tailSpan = ts[ts.length - 1] - (m - 1) + 0.5;

  for (let i = 0; i < S; i++) {
    const t = tAt[i];
    const [hx, hy, bnd] = halfAt(t);
    let mx = 1, my = 1;

    // WAIST — the "soft constriction". A bell centred on each joint, scaled by
    // nothing else: it is what keeps a fused animal legibly segmented instead of
    // reading as one extruded sausage.
    if (bnd.joint) {
      const g = Math.exp(-(bnd.off / WAIST_HALF) * (bnd.off / WAIST_HALF) * 2.2);
      mx *= 1 - cfg.waist * g;
      my *= 1 - cfg.waist * g;
    }

    // HEAD — the root body is a head, so it swells slightly before the cap
    // closes it. Branches get a collar instead: they are leaving a body, not
    // starting one.
    if (!isBranch) {
      const s = Math.max(0, Math.min(1, t + 0.5));           // 0 at the snout
      const bulge = 1 + cfg.headBulge * Math.sin(Math.PI * Math.min(1, s * 1.6));
      mx *= bulge; my *= bulge;
    } else {
      const inward = Math.max(0, -(tAt[i] + 0.5)) / 0.35;     // 0 at the surface
      const collar = 1 + (FLARE - 1) * smoothstep(0, 1, Math.min(1, inward));
      mx *= collar; my *= collar;
    }

    // TAIL.
    const tailT = t - (m - 1);
    if (tailIsVane) {
      // A MEMBRANE, and this is where a built body earns its keep. s runs across
      // the vane's own span including the closing extension. The chord opens out
      // fast, holds, then rounds off; the thickness falls away to an edge. Swept
      // along the span that is a leaf-shaped blade with a thin rim — a fin. The
      // reconstruction this replaced could only ever have produced a slab of
      // whatever its sampling grid could hold.
      const s = Math.max(0, Math.min(1, (tailT + 0.5) / tailSpan));
      const rim = round01((1 - s) / 0.30);
      mx *= (0.45 + 0.9 * smoothstep(0, 0.32, s)) * rim;
      my *= (1 - 0.5 * s) * rim;
    } else if (tailT > -0.5) {
      const s = Math.max(0, Math.min(1, tailT + 0.5));
      const k = 1 - TAIL_TAPER * smoothstep(0.25, 1, s);
      mx *= k; my *= k;
    }

    // CAPS — a hemispherical falloff over EXACTLY the extension stations added
    // beyond the first and last body, and no further. A cap sized as a fixed
    // fraction of the whole animal is a snout half a body long on an eel and a
    // sliver on a two-body blob; sized from the extension it added, it closes the
    // surface and touches nothing else. A vane skips the tail cap: its own rim
    // already closes it, and a dome on top of that eats the blade.
    const vN = v[i] / totalLen;
    const capHead = startExt / totalLen, capTail = endExt / totalLen;
    let capK = 1;
    if (vN < capHead) capK = round01(vN / capHead);
    if (!tailIsVane && vN > 1 - capTail) capK = Math.min(capK, round01((1 - vN) / capTail));
    mx *= capK; my *= capK;

    // The offset tapers away over the caps, or the shell ends in a blunt dome
    // floating past the animal's nose. capK is the cap falloff already computed
    // above, reused so the two cannot drift apart.
    const off = (cfg.inflate ?? 0) * capK;
    rx.push(Math.max(1e-4, hx * mx + off));
    ry.push(Math.max(1e-4, hy * my + off));
  }

  loft(B, { p: T, T: fr.T, N: fr.N, B: fr.B }, {
    rx, ry, v: vTex, radial: cfg.radial,
    bonesAt: (i) => {
      const bnd = bind(tAt[i]);
      if (!bnd.joint) return [[bnd.b, 1]];
      return [[bnd.a, 1 - bnd.w], [bnd.b, bnd.w]];
    },
  });
}
