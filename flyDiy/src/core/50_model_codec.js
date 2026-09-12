// model_codec.js — decode baked model payloads (see tools/model_prep.py).
// Pure JS, no three.js: same code runs in the artifact and in the node gates.
// Layout per group (little-endian): u32 nVerts, u32 nTris,
//   int16 pos[3*nVerts] (quantized over bb), uint16 uv[2*nVerts], uint16 idx[3*nTris].
//
// THE BYTES LIVE OUTSIDE THE PAYLOAD since 2026-09-01: the payload .js is a
// slim manifest whose groups carry `off`/`len` into ONE binary file per model
// (payload.bin names it, under media/geo/models/), and decodeModel takes that
// file's bytes as its second argument. Who fetches is the caller's business —
// the browser goes through ASSET_FETCH/MODEL_LOAD (src/viewer/assets.js,
// app.js), the gates read the file with fs and hand it in. A group that still
// carries `b64` decodes exactly as before (the selftests' synthetic payloads,
// and any not-yet-rebaked tree), so the container change cannot strand a
// fixture.

function decodeB64(b64) {
  if (typeof atob === 'function') {
    const s = atob(b64), a = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
    return a;
  }
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

// group -> DataView over its bytes, wherever they live (b64 field or a slice
// of the model's own bin). Throws on a bin group with no bin bytes handed in:
// a silent empty decode would be a payload that "loaded" as no aeroplane.
function groupView(g, bin, name) {
  if (g.b64) { const raw = decodeB64(g.b64);
               return new DataView(raw.buffer, raw.byteOffset, raw.byteLength); }
  if (!bin) throw new Error('decodeModel: group "' + name + '" needs the ' +
    'model\'s bin bytes and none were passed — fetch payload.bin first');
  return new DataView(bin.buffer, bin.byteOffset + g.off, g.len);
}

function decodeModel(model, bin) {
  const [x0, y0, z0, x1, y1, z1] = model.bb;
  const sx = (x1 - x0) / 65535, sy = (y1 - y0) / 65535, sz = (z1 - z0) / 65535;
  const out = {};
  for (const name in model.groups) {
    const g = model.groups[name];
    const dv = groupView(g, bin, name);
    const nv = dv.getUint32(0, true), nt = dv.getUint32(4, true);
    let o = 8;
    const pos = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
    for (let i = 0; i < nv; i++, o += 6) {
      pos[i*3]   = x0 + (dv.getInt16(o,     true) + 32768) * sx;
      pos[i*3+1] = y0 + (dv.getInt16(o + 2, true) + 32768) * sy;
      pos[i*3+2] = z0 + (dv.getInt16(o + 4, true) + 32768) * sz;
    }
    for (let i = 0; i < nv * 2; i++, o += 2) uv[i] = dv.getUint16(o, true) / 65535;
    const idx = new Uint16Array(nt * 3);
    for (let i = 0; i < nt * 3; i++, o += 2) idx[i] = dv.getUint16(o, true);
    let sid = null;
    if (g.sid) { sid = new Uint8Array(nv); for (let i = 0; i < nv; i++, o++) sid[i] = dv.getUint8(o); }
    out[name] = { nv, nt, pos, uv, idx, sid };
  }
  return out;
}


// ---------------------------------------------------------------------------
// Skin deformation (see SKIN-PROC.md). Spanwise station binding:
// model wing-band vertices follow the sim's spar stations (tags WF/WR),
// interpolated along |z|. Everything else stays rigid in the body frame.
// Model frame orientation == body frame with z LEFT (zL = xAft x yUp).
// ---------------------------------------------------------------------------

function defCG(def) {
  let x = 0, y = 0, z = 0, M = 0;
  for (const n of def.nodes) { x += n.p[0]*n.m; y += n.p[1]*n.m; z += n.p[2]*n.m; M += n.m; }
  return [x/M, y/M, z/M];
}

// The EXACT projection sparDeltas measures with, taken at the design pose:
// bodyAxes' raw xAft/yUp from the refs (normalized, NOT re-orthogonalized —
// the pair is oblique whenever the design pose is pitched) and zL = xA x yU
// exactly as sparDeltas derives it, origin at defCG. The rest reference MUST
// go through this and nothing cleaner: an orthogonalized or design-axes rest
// leaves a constant millimetre-scale field at zero load — the at-rest
// aft-sheared wing, the crease at the first bound row, the kinked struts.
// The REST ORIGIN is the FIREWALL RING — the structural datum the solver's
// bodyOrigin() averages live, byte for byte (G179). It was the mass centre,
// which is not a point on the aeroplane: a sagging engine or a draining tank
// moves it against the structure, and every bound vertex moved with it.
function defOrigin(def) {
  // G179.3: the wing carry-through where declared, the firewall ring otherwise
  const N = def.nodes, ids = def.refs.origin || def.refs.noseFrame, o = [0, 0, 0];
  for (const i of ids) { o[0] += N[i].p[0]; o[1] += N[i].p[1]; o[2] += N[i].p[2]; }
  return [o[0] / ids.length, o[1] / ids.length, o[2] / ids.length];
}

function defBodyProject(def) {
  const N = def.nodes, R = def.refs;
  const avg = ids => { const o = [0, 0, 0];
    for (const i of ids) { o[0] += N[i].p[0]; o[1] += N[i].p[1]; o[2] += N[i].p[2]; }
    return [o[0] / ids.length, o[1] / ids.length, o[2] / ids.length]; };
  const nrm = a => { const L = Math.hypot(a[0], a[1], a[2]) || 1e-9;
    return [a[0] / L, a[1] / L, a[2] / L]; };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const xA = nrm(sub(avg(R.tailMid), avg(R.noseFrame)));
  const yU = nrm(sub(avg(R.upHi), avg(R.upLo)));
  const zL = [xA[1]*yU[2] - xA[2]*yU[1], xA[2]*yU[0] - xA[0]*yU[2],
              xA[0]*yU[1] - xA[1]*yU[0]];
  const cg = defOrigin(def);                 // G179: the firewall ring, not the CG
  return p => { const d = sub(p, cg);
    return [d[0]*xA[0] + d[1]*xA[1] + d[2]*xA[2],
            d[0]*yU[0] + d[1]*yU[1] + d[2]*yU[2],
            d[0]*zL[0] + d[1]*zL[1] + d[2]*zL[2]]; };
}

// cfg: { tags:['WF','WR'], zRoot, xMax, off:[ox,oy,oz] }  (model-frame thresholds)
// Optional gates (G58.1): xMin and yMin close the wing box from the other two
// sides. The original selector was "outboard of zRoot and forward of xMax" —
// which on the cage visual also caught the cabin SIDEWALL (it sits exactly at
// |z| = zRoot = cab.halfW), the strut roots and the GEAR LEG, and pulled them
// aft with the lifting wing (user's circles, at ×4 flex). Absent fields keep
// the imported fleet's bindings exactly as they were.
function makeSkinBinding(pos, nv, def, cfg) {
  // rest goes through defBodyProject — see its header for why nothing else
  // (design axes, an orthogonalized frame) is allowed to build it.
  const toB = defBodyProject(def);
  const sides = { P: {}, N: {} };            // keyed by |z| station
  def.nodes.forEach((n, i) => {
    if (!cfg.tags.includes(n.tag)) return;
    // G185: one plane per binding — the stations are keyed by |z| per tag,
    // and a biplane's two planes at one station would otherwise AVERAGE
    if (cfg.plane != null && (n.plane || 0) !== cfg.plane) return;
    const s = n.p[2] > 0 ? 'P' : 'N', key = Math.abs(n.p[2]).toFixed(2);
    (sides[s][key] = sides[s][key] || []).push(i);
  });
  const zs = Object.keys(sides.P).map(Number).sort((a, b) => a - b);
  const mkSide = (S) => {
    const st = zs.map(z => sides[S][z.toFixed(2)]);
    const rest = new Float32Array(zs.length * 3);
    st.forEach((ids, k) => {
      for (const i of ids) {
        const q = toB(def.nodes[i].p);
        rest[k*3]   += q[0] / ids.length;
        rest[k*3+1] += q[1] / ids.length;
        rest[k*3+2] += q[2] / ids.length;
      }
    });
    return { st, rest };
  };
  // vertices: model z>0 maps to world +z at rest, i.e. sim nodes with p[2]>0
  const bound = [], seg = [], w = [], side = [];
  for (let i = 0; i < nv; i++) {
    const x = pos[i*3], z = pos[i*3+2], az = Math.abs(z);
    if (az < cfg.zRoot || x > cfg.xMax) continue;
    if (cfg.xMin !== undefined && x < cfg.xMin) continue;
    if (cfg.yMin !== undefined && pos[i*3+1] < cfg.yMin) continue;
    let k = 0;
    while (k < zs.length - 1 && az > zs[k]) k++;
    const zA = k === 0 ? cfg.zRoot : zs[k-1];
    bound.push(i); seg.push(k); side.push(z > 0 ? 1 : 0);
    w.push((az - zA) / (zs[k] - zA));        // may exceed 1 past the tip: extrapolates
  }
  return { zs, P: mkSide('P'), N: mkSide('N'),
           bound: Int32Array.from(bound), seg: Int8Array.from(seg),
           w: Float32Array.from(w), side: Int8Array.from(side) };
}

// Body-frame (z-left) station deltas vs rest. axes = [xAft, yUp]; zL derived.
function sparDeltas(bind, sim, out) {
  const cg = sim.bodyOrigin(), [xA, yU] = sim.axes();   // G179: structural origin
  const zL = [xA[1]*yU[2]-xA[2]*yU[1], xA[2]*yU[0]-xA[0]*yU[2], xA[0]*yU[1]-xA[1]*yU[0]];
  for (const S of ['P', 'N']) {
    const { st, rest } = bind[S], d = out[S];
    st.forEach((ids, k) => {
      let bx = 0, by = 0, bz = 0;
      for (const i of ids) {
        const dx = sim.p[i*3]-cg[0], dy = sim.p[i*3+1]-cg[1], dz = sim.p[i*3+2]-cg[2];
        bx += (dx*xA[0]+dy*xA[1]+dz*xA[2]) / ids.length;
        by += (dx*yU[0]+dy*yU[1]+dz*yU[2]) / ids.length;
        bz += (dx*zL[0]+dy*zL[1]+dz*zL[2]) / ids.length;
      }
      d[k*3] = bx - rest[k*3]; d[k*3+1] = by - rest[k*3+1]; d[k*3+2] = bz - rest[k*3+2];
    });
  }
  return out;
}

// pos <- base + gain * lerp(station deltas) for bound vertices only.
// seg k, weight w: between station k-1 (root: zero delta) and station k;
// w > 1 past the last station extrapolates linearly (model tip 5.36 vs spar 5.0).
// hinged: optional Uint8Array — for those verts the hinge pass already wrote
// pos, so flex is ADDED in place instead of overwriting from base.
function applySkinDeform(bind, base, pos, dP, dN, gain, hinged) {
  const { bound, seg, w, side } = bind;
  for (let j = 0; j < bound.length; j++) {
    const i = bound[j], k = seg[j], d = side[j] ? dP : dN, wj = w[j];
    const w0 = k === 0 ? 0 : gain * (1 - wj), w1 = gain * wj;
    const o0 = (k - 1) * 3, o1 = k * 3;
    const fx = (k === 0 ? 0 : w0 * d[o0])   + w1 * d[o1];
    const fy = (k === 0 ? 0 : w0 * d[o0+1]) + w1 * d[o1+1];
    const fz = (k === 0 ? 0 : w0 * d[o0+2]) + w1 * d[o1+2];
    if (hinged && hinged[i]) { pos[i*3] += fx; pos[i*3+1] += fy; pos[i*3+2] += fz; }
    else { pos[i*3] = base[i*3] + fx; pos[i*3+1] = base[i*3+1] + fy; pos[i*3+2] = base[i*3+2] + fz; }
  }
}

// ---------------------------------------------------------------------------
// Control surface hinges. Per-vertex rigid rotation about baked hinge lines,
// with an optional smoothstep weight ramp along x (fin+rudder fused meshes).
// Runs BEFORE the flex pass; applySkinDeform adds flex on top of hinged verts.
// ---------------------------------------------------------------------------

function makeHingeBinding(skin, surfaces) {
  const per = surfaces.map(() => ({ idx: [], w: [] }));
  for (let i = 0; i < skin.nv; i++) {
    const k = skin.sid[i];
    if (!k) continue;
    const s = surfaces[k - 1];
    let w = 1;
    if (s.ramp) {
      const u = (skin.pos[i*3] - s.ramp[0]) / (s.ramp[1] - s.ramp[0]);
      const c = Math.max(0, Math.min(1, u));
      w = c * c * (3 - 2 * c);
    }
    if (w <= 0) continue;
    per[k - 1].idx.push(i); per[k - 1].w.push(w);
  }
  const hinged = new Uint8Array(skin.nv);
  return { per: per.map(g => ({ idx: Int32Array.from(g.idx), w: Float32Array.from(g.w) })),
           hinged: (() => { for (const g of per) for (const i of g.idx) hinged[i] = 1;
                            return hinged; })() };
}

// Rodrigues rotation of (base - p) about unit axis by (angle * w), + p.
function applyHinges(hb, surfaces, base, pos, ctl) {
  surfaces.forEach((s, si) => {
    // A surface may answer to TWO inputs. A V-tail ruddervator is the reason:
    // it is the elevator and the rudder at once, symmetric in one and
    // antisymmetric in the other, and a vertex can only carry one surface id.
    const ang = s.sgn * (s.k || 1) * (ctl[s.drive] || 0)
      + (s.drive2 ? (s.sgn2 || 1) * (s.k2 || 1) * (ctl[s.drive2] || 0) : 0);
    const g = hb.per[si], [px, py, pz] = s.p, [ax, ay, az] = s.ax;
    for (let j = 0; j < g.idx.length; j++) {
      const i = g.idx[j], a = ang * g.w[j];
      const c = Math.cos(a), s_ = Math.sin(a), C = 1 - c;
      const vx = base[i*3] - px, vy = base[i*3+1] - py, vz = base[i*3+2] - pz;
      const d = ax*vx + ay*vy + az*vz;
      pos[i*3]   = px + vx*c + (ay*vz - az*vy)*s_ + ax*d*C;
      pos[i*3+1] = py + vy*c + (az*vx - ax*vz)*s_ + ay*d*C;
      pos[i*3+2] = pz + vz*c + (ax*vy - ay*vx)*s_ + az*d*C;
    }
  });
}

// ---------------------------------------------------------------------------
// Control linkage model (visual only). Two-pole low-pass between sim.ctl and
// the drawn surfaces: real cable runs and actuators filter exactly like this.
// Motivation: the AP roll/yaw loops limit-cycle at ~3.7 Hz (PD derivative on
// finite-differenced soft-body attitude); tau=0.12 s per pole attenuates that
// ~9x while tracking slewed maneuver commands with invisible lag.
// The HUD keeps showing raw sim.ctl; physics is untouched.
// ---------------------------------------------------------------------------
function makeLinkage(tau) {
  // `thr` rides too (live crew): the throttle lever in the cockpit, and the
  // hand on it, lag the way the stick does
  // G318: the brake (a pull), the trim wheel and the fuel selector ride too —
  // `trim` and `fuel` are the cockpit's own numbers on ctl, which the solver
  // never reads; the linkage carries them to the parts like any drive
  const KEYS = ['de', 'da', 'dr', 'flap', 'thr', 'brake', 'trim', 'fuel'];
  const s1 = {}, s2 = {};
  for (const k of KEYS) { s1[k] = 0; s2[k] = 0; }
  return {
    step(ctl, dt) {
      const a = Math.min(1, dt / tau);
      for (const k of KEYS) {

        s1[k] += a * ((ctl[k] || 0) - s1[k]);
        s2[k] += a * (s1[k] - s2[k]);
      }
      return s2;
    },
  };
}

if (typeof module !== 'undefined')
  module.exports = { decodeModel, decodeB64, defCG, makeSkinBinding, sparDeltas,
                     applySkinDeform, makeHingeBinding, applyHinges, makeLinkage };
