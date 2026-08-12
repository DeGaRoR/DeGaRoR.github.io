// ============================================================
// GARAGE — the builder's panel, and the paint.
//
// The panel edits the SPEC (src/core/60_gen_spec.js); everything visible and
// everything the solver reads is regenerated from it. Fields the player has not
// touched stay null and are derived — tail size from volume coefficients, gear
// position from the CG, prop clearance from the propeller — so a build that
// nobody has fiddled with is still a coherent aeroplane. The readout marks
// those AUTO, which is the whole "procedural by default, editable everywhere"
// contract made visible.
//
// The paint is baked here rather than in core because it needs a canvas. Two UV
// zones (see 63_gen_skin.js): the lower half of the texture wraps the body, the
// upper half tiles the flying surfaces.
// ============================================================

// ============================================================
// G5 LOOK PASS — THE PAINT. Four baked sheets instead of one:
//   paint  the livery (sRGB)
//   reg    the registration decal (sRGB)
//   bump   a NORMAL map: rib tape, stringers, formers, fabric weave (LINEAR)
//   mr     roughness in G, metalness in B, glTF's packing (LINEAR)
// The last two are why a fabric aeroplane now reads as fabric: the shape of a
// covered airframe is carried almost entirely by the ridge of every rib tape
// catching the light, and no amount of painted line-work substitutes for it.
//
// The UV contract is unchanged (63_gen_skin.js): BODY takes v 0.03..0.47 with
// u = angle around the section (0 top, .25 the +z side, .5 the belly) and
// v = station nose->tail; PANEL takes v 0.53..0.97 with u = chord fraction
// (0 = leading edge) and v = span fraction (0 root, 1 tip).
// ============================================================

const GEN_TEX = 1024;                     // paint sheet, up from 512
const GEN_RIBS = 13;                      // rib tapes across the semispan

// shared zone helpers, so every sheet lands its features in the same place
function genZones(S) {
  const yOf = v => S * (1 - v);
  const bT = yOf(0.47), bB = yOf(0.03), pT = yOf(0.97), pB = yOf(0.53);
  return {
    S, uX: u => u * S,
    bodyY: t => bB - (bB - bT) * Math.max(0, Math.min(1, t)),   // station 0..1
    panY:  t => pB - (pB - pT) * Math.max(0, Math.min(1, t)),   // span 0..1
    bT, bB, pT, pB,
  };
}
const genHex = n => '#' + (n >>> 0).toString(16).padStart(6, '0');
function genMixN(a, b, t) {
  const A = [(a>>16)&255, (a>>8)&255, a&255], C = [(b>>16)&255, (b>>8)&255, b&255];
  return (((A[0]+(C[0]-A[0])*t)|0)<<16) | (((A[1]+(C[1]-A[1])*t)|0)<<8)
       | ((A[2]+(C[2]-A[2])*t)|0);
}
const genMix = (a, b, t) => genHex(genMixN(a, b, t));

function genPaintDataURI(spec) {
  const S = GEN_TEX, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const Z = genZones(S), P = spec.paint;
  const base = P.base, trim = P.trim;
  const light = genMixN(base, 0xffffff, 0.55);
  g.fillStyle = genHex(base); g.fillRect(0, 0, S, S);

  // ---------------- BODY ----------------
  // The belly is a shade darker, which is what reads as form from below, and
  // the boundary is soft: a hard edge there looks like a paint scheme nobody
  // would choose.
  {
    const grd = g.createLinearGradient(0.36 * S, 0, 0.64 * S, 0);
    grd.addColorStop(0.00, genMix(base, 0x000000, 0.00));
    grd.addColorStop(0.22, genMix(base, 0x000000, 0.14));
    grd.addColorStop(0.78, genMix(base, 0x000000, 0.14));
    grd.addColorStop(1.00, genMix(base, 0x000000, 0.00));
    g.fillStyle = grd;
    g.fillRect(0.36 * S, Z.bT, 0.28 * S, Z.bB - Z.bT);
  }
  // COWL + ANTI-GLARE. The cowl group's own v sits in the first 2% of the body
  // zone, so the cowl and the deck ahead of the windscreen paint as one dark
  // panel — which is what an anti-glare panel IS, and it gives the nose the
  // horizontal line that a single-colour fuselage never has.
  g.fillStyle = genMix(trim, 0x000000, 0.35);
  for (const u0 of [-0.075, 0.925]) {
    g.fillRect(Z.uX(u0), Z.bodyY(0), 0.15 * S, Z.bodyY(0.072) - Z.bodyY(0));
  }
  // its aft edge feathers into the base colour rather than stopping square
  {
    const y0 = Z.bodyY(0.055), y1 = Z.bodyY(0.076);
    const grd = g.createLinearGradient(0, y0, 0, y1);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, genHex(base));
    g.fillStyle = grd;
    for (const u0 of [-0.075, 0.925]) g.fillRect(Z.uX(u0), y1, 0.15 * S, y0 - y1);
  }
  // CHEAT LINE. Thin, straight-ish, at the waterline: a wide swept band reads
  // as a grey slab wrapped round a flat-sided aeroplane. Now doubled — trim
  // stripe plus a light pinstripe — because two lines read as a scheme and one
  // reads as a seam.
  const band = (uc0, uc1, halfW, t0, t1, fill) => {
    g.fillStyle = fill;
    g.beginPath();
    const N = 32;
    for (let i = 0; i <= N; i++) {
      const t = i / N, u = uc0 + (uc1 - uc0) * t;
      g.lineTo(Z.uX(u + halfW), Z.bodyY(t0 + (t1 - t0) * t));
    }
    for (let i = N; i >= 0; i--) {
      const t = i / N, u = uc0 + (uc1 - uc0) * t;
      g.lineTo(Z.uX(u - halfW), Z.bodyY(t0 + (t1 - t0) * t));
    }
    g.closePath(); g.fill();
  };
  const sweep = 0.045 * P.sweep;
  for (const [uc, sg] of [[0.30, -1], [0.70, 1]]) {
    band(uc, uc + sg * sweep, 0.014, 0.03, 1.0, genHex(trim));
    band(uc + sg * 0.021, uc + sg * (0.021 + sweep), 0.0035, 0.05, 1.0, genHex(light));
  }
  // SPINE. A faint darker line along the top from the cabin aft: the turtledeck
  // has a crown and this is where its highlight rolls over.
  g.fillStyle = genMix(base, 0x000000, 0.10);
  for (const u0 of [-0.014, 0.986]) g.fillRect(Z.uX(u0), Z.bodyY(1), 0.028 * S, Z.bodyY(0.28) - Z.bodyY(1));
  // EXHAUST SOOT down the belly behind the cowl, and dust up from the wheels.
  // Nothing on an aeroplane that flies is uniformly clean, and this is the one
  // cue that separates a rendered object from a machine.
  {
    const grd = g.createLinearGradient(0, Z.bodyY(0.04), 0, Z.bodyY(0.42));
    grd.addColorStop(0.0, 'rgba(28,24,20,0.30)');
    grd.addColorStop(1.0, 'rgba(28,24,20,0)');
    g.fillStyle = grd;
    g.fillRect(0.44 * S, Z.bodyY(0.42), 0.12 * S, Z.bodyY(0.04) - Z.bodyY(0.42));
  }
  // ---------------- FLYING SURFACES ----------------
  // POLISHED LEADING EDGE. A fabric wing has a metal leading-edge skin, and it
  // is the brightest line on the aeroplane in any raking light.
  {
    const grd = g.createLinearGradient(0, 0, 0.075 * S, 0);
    grd.addColorStop(0.00, genMix(base, 0xdfe3e8, 0.80));
    grd.addColorStop(0.62, genMix(base, 0xdfe3e8, 0.55));
    grd.addColorStop(1.00, genHex(base));
    g.fillStyle = grd;
    g.fillRect(0, Z.pT, 0.075 * S, Z.pB - Z.pT);
  }
  // trailing edge, a touch darker: it is a thin edge in shadow
  g.fillStyle = genMix(base, 0x000000, 0.16);
  g.fillRect(0.962 * S, Z.pT, 0.038 * S, Z.pB - Z.pT);
  // TIP: trim band with a light pinstripe inboard of it
  // The tip band has to start where the TIP BOW does (span fraction ~0.86 on a
  // rounded tip) or the whole band lands inside the bow's own rows and reads as
  // a smudge on the very last centimetre.
  g.fillStyle = genHex(trim);
  g.fillRect(0, Z.panY(0.875), S, Z.panY(1) - Z.panY(0.875));
  g.fillStyle = genHex(light);
  g.fillRect(0, Z.panY(0.855), S, Z.panY(0.875) - Z.panY(0.855));
  // WING WALK at the root: dark, matte, only where a boot would go — and only
  // on a LOW or MID wing. On a high wing nobody stands on the wing, and the
  // patch landed on the carry-through over the cabin roof, which is the one
  // place on the aeroplane the eye is already looking.
  if (spec.wings && spec.wings[0] && spec.wings[0].position !== 'high') {
    g.fillStyle = genMix(base, 0x14120f, 0.72);
    g.fillRect(0.14 * S, Z.panY(0.085), 0.42 * S, Z.panY(0) - Z.panY(0.085));
  }
  // RIB TAPES. Every rib is taped over and doped, and the tape catches light on
  // its ridge and shades on both sides of it. The paint carries the shading;
  // the normal map carries the ridge.
  for (let i = 1; i < GEN_RIBS; i++) {
    const v = i / GEN_RIBS, y = Z.panY(v);
    g.fillStyle = genMix(base, 0x000000, 0.065);
    g.fillRect(0.03 * S, y - 1, 0.94 * S, 3);
    g.fillStyle = genMix(base, 0xffffff, 0.12);
    g.fillRect(0.03 * S, y + 2, 0.94 * S, 1.5);
  }
  // FORMER LINES, and only in the BODY zone. They used to run across the whole
  // sheet at a fixed pixel pitch, which put a line every 15 cm of SPAN on the
  // wing — on top of the rib tapes, so the wing read as corrugated iron rather
  // than as doped fabric. On the fuselage the same pitch is right: that is
  // roughly where the formers are.
  g.strokeStyle = 'rgba(0,0,0,.040)'; g.lineWidth = 1;
  for (let y = Math.ceil(Z.bT); y < Z.bB; y += 13) {
    g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(S, y + 0.5); g.stroke();
  }
  return c.toDataURL('image/png');
}

// The registration sheet: transparent, one line of text, on its own undistorted
// 0..1 grid (the decal in 63_gen_skin.js). u runs nose-to-tail, so the text is
// drawn straight across this canvas. Bigger and letter-spaced now: it was
// legible only from two metres, and a registration you cannot read is a smudge.
function genRegDataURI(spec) {
  const W = 1024, H = 256, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  if (!spec.reg) return c.toDataURL('image/png');
  const P = spec.paint || { trim: 0x1b3a5c, base: 0xf2c437 };
  g.translate(W / 2, H * 0.54);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 150px "IBM Plex Mono", ui-monospace, monospace';
  if ('letterSpacing' in g) g.letterSpacing = '14px';
  // a hairline of the base colour behind the glyphs, so the registration holds
  // its edge against a dark scheme as well as a light one
  g.lineWidth = 10; g.strokeStyle = genMix(P.base, 0xffffff, 0.35);
  g.strokeText(spec.reg, 0, 0);
  g.fillStyle = genHex(P.trim);
  g.fillText(spec.reg, 0, 0);
  return c.toDataURL('image/png');
}


// ---------------------------------------------------------------------------
// THE GLAZING SHEET (G6, the `projected` route). Drawn in SIDE ELEVATION and
// projected onto the body by 63_gen_skin.js, so:
//   - the artwork cannot distort, whatever the fuselage's parameterisation is
//   - the window shape is a drawing, so a new cockpit style is a canvas call
//     rather than a re-topologised mesh
//   - there is no second surface to sort: it is an alphaTest CUT-OUT that sits
//     4 mm off the covering and writes depth like anything else opaque
// u = station / tailpost, v = height over the body's vertical extent — the same
// projection the mesh uses, and the only two numbers the two files share.
// ---------------------------------------------------------------------------
function genGlazeDataURI(spec) {
  const W = 1024, H = 256, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  const cb = spec.cabin || spec.cab, fu = spec.fuselage || spec.fuse;
  if (!cb || !fu || !fu.postX) return c.toDataURL('image/png');
  const yLo = -0.10, ySpan = Math.max(0.5, cb.h * 1.25 - yLo);
  const X = x => (x / fu.postX) * W;
  const Y = y => (1 - (y - yLo) / ySpan) * H;
  const deck = cb.h * fu.cowlDeck, roof = cb.h;
  const xW = cb.noseGap - fu.windRun, xF = cb.noseGap, xR = cb.noseGap + cb.len;
  const trim = (spec.paint && spec.paint.trim) || 0x1b3a5c;

  // one pane: a rounded path, filled with glass and stroked with frame. The
  // glass is a gradient — a flat dark fill reads as a hole, and the one thing
  // every real window does is carry a reflection of the sky down its top third.
  const pane = (pts, r) => {
    g.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], n = pts[(i + 2) % pts.length];
      g.arcTo(b[0], b[1], n[0], n[1], r);
    }
    g.closePath();
    const bb = pts.reduce((o, q) => [Math.min(o[0], q[1]), Math.max(o[1], q[1])],
                          [1e9, -1e9]);
    const gr = g.createLinearGradient(0, bb[0], 0, bb[1]);
    gr.addColorStop(0.00, '#9fb6c4');
    gr.addColorStop(0.28, '#3f5462');
    gr.addColorStop(0.60, '#22313a');
    gr.addColorStop(1.00, '#101a20');
    g.fillStyle = gr; g.fill();
    g.lineJoin = 'round';
    g.strokeStyle = genHex(trim); g.lineWidth = 9; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 2.5; g.stroke();
  };

  const st = cb.glazeStyle || 'side';
  // WINDSCREEN: the deck step is the windscreen, on every style
  pane([[X(xW + 0.02), Y(deck + 0.03)], [X(xF - 0.015), Y(roof - 0.02)],
        [X(xF + 0.10), Y(roof - 0.02)], [X(xF + 0.10), Y(deck + 0.03)]], 10);
  if (st === 'side') {
    // a door light and a quarter light behind it: the two-window cabin
    pane([[X(xF + 0.16), Y(0.47 * cb.h)], [X(xF + 0.16), Y(0.90 * cb.h)],
          [X(xR - 0.10), Y(0.90 * cb.h)], [X(xR - 0.10), Y(0.47 * cb.h)]], 14);
    pane([[X(xR + 0.03), Y(0.52 * cb.h)], [X(xR + 0.03), Y(0.88 * cb.h)],
          [X(xR + 0.34), Y(0.84 * cb.h)], [X(xR + 0.30), Y(0.52 * cb.h)]], 12);
  } else if (st === 'full') {
    // one long band from the windscreen to well aft of the cabin: the
    // greenhouse look, without a single extra triangle
    pane([[X(xF + 0.15), Y(0.45 * cb.h)], [X(xF + 0.15), Y(roof - 0.02)],
          [X(xR + 0.52), Y(0.92 * cb.h)], [X(xR + 0.58), Y(0.50 * cb.h)]], 16);
  }
  return c.toDataURL('image/png');
}

// ---------------------------------------------------------------------------
// THE NORMAL MAP. Built as a height field and differentiated, because that is
// the only honest way to keep the ridges consistent with the paint: both are
// drawn in the same UV space by the same feature list.
//   body zone   formers around the section, stringers along it, fabric weave
//   panel zone  rib tape ridges with the fabric sagging between them
// ---------------------------------------------------------------------------
function genBumpDataURI(spec) {
  const S = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const Z = genZones(S);
  g.fillStyle = '#808080'; g.fillRect(0, 0, S, S);
  // ---- height field, greyscale ----
  const H = new Float32Array(S * S);
  const at = (x, y) => H[(y | 0) * S + (x | 0)];
  const put = (x, y, v) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    H[(y | 0) * S + (x | 0)] += v;
  };
  // fabric weave: fine, isotropic, and low — it is a texture, not a pattern
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++)
      H[y * S + x] = 0.16 * (Math.sin(x * 1.9) * Math.sin(y * 2.3))
                   + 0.10 * (Math.sin((x + y) * 0.7));
  // PANEL: rib tape ridges, and the fabric pulling in between them
  const pv0 = Z.panY(0), pv1 = Z.panY(1);
  for (let y = Math.min(pv0, pv1) | 0; y <= (Math.max(pv0, pv1) | 0); y++) {
    const v = (pv0 - y) / (pv0 - pv1);
    const ph = v * GEN_RIBS;
    const f = Math.abs(ph - Math.round(ph));            // 0 at a rib
    const ridge = Math.exp(-(f * f) / 0.0016) * 2.6;    // the tape
    const sag = -1.5 * Math.pow(Math.sin(Math.PI * f), 1.4);
    for (let x = 0; x < S; x++) {
      const u = x / S;
      // no sag through the leading-edge skin: that part is metal
      const k = u < 0.09 ? 0 : Math.min(1, (u - 0.09) / 0.10);
      H[y * S + x] += ridge + sag * k;
    }
  }
  // BODY: formers around the section (lines of constant station) and stringers
  // along it (lines of constant angle)
  const bv0 = Z.bodyY(0), bv1 = Z.bodyY(1);
  for (let y = Math.min(bv0, bv1) | 0; y <= (Math.max(bv0, bv1) | 0); y++) {
    const t = (bv0 - y) / (bv0 - bv1);
    const ph = t * 22, f = Math.abs(ph - Math.round(ph));
    const former = Math.exp(-(f * f) / 0.0022) * 2.2;
    for (let x = 0; x < S; x++) {
      const u = x / S, pu = u * 16, fu = Math.abs(pu - Math.round(pu));
      const stringer = Math.exp(-(fu * fu) / 0.010) * 1.1;
      H[y * S + x] += former + stringer;
    }
  }
  void at; void put;
  // ---- differentiate into a tangent-space normal map ----
  const img = g.createImageData(S, S);
  const hAt = (x, y) => H[((y + S) % S) * S + ((x + S) % S)];
  const SC = 0.55;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (hAt(x + 1, y) - hAt(x - 1, y)) * SC;
      const dy = (hAt(x, y + 1) - hAt(x, y - 1)) * SC;
      const L = Math.hypot(dx, dy, 1);
      const o = (y * S + x) * 4;
      img.data[o]     = Math.round(255 * (0.5 - 0.5 * dx / L));
      img.data[o + 1] = Math.round(255 * (0.5 + 0.5 * dy / L));
      img.data[o + 2] = Math.round(255 * (0.5 + 0.5 / L));
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

// ---------------------------------------------------------------------------
// ROUGHNESS / METALNESS, packed glTF-style: G = roughness, B = metalness. Both
// MULTIPLY the material's own scalar, so this sheet only ever takes roughness
// away — which is exactly what a polished leading edge, a doped panel and a
// scuffed wing walk differ by.
// ---------------------------------------------------------------------------
function genMrDataURI(spec) {
  const S = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const Z = genZones(S);
  // base: 0.92 roughness so dirt has somewhere to go, no metal
  g.fillStyle = 'rgb(0,235,0)'; g.fillRect(0, 0, S, S);
  const rough = (r, x, y, w, h) => {
    g.fillStyle = 'rgb(0,' + Math.round(255 * r) + ',0)';
    g.fillRect(x, y, w, h);
  };
  // polished leading edge, glossiest thing on the aeroplane
  {
    const grd = g.createLinearGradient(0, 0, 0.075 * S, 0);
    grd.addColorStop(0.0, 'rgb(0,90,0)');
    grd.addColorStop(1.0, 'rgb(0,235,0)');
    g.fillStyle = grd; g.fillRect(0, Z.pT, 0.075 * S, Z.pB - Z.pT);
  }
  if (spec.wings && spec.wings[0] && spec.wings[0].position !== 'high')
    rough(1.00, 0.14 * S, Z.panY(0.085), 0.42 * S, Z.panY(0) - Z.panY(0.085));  // wing walk
  rough(0.62, 0, Z.bodyY(0), S, Z.bodyY(0.15) - Z.bodyY(0));                   // cowl panel
  rough(1.00, 0.42 * S, Z.bodyY(0.42), 0.16 * S, Z.bodyY(0.02) - Z.bodyY(0.42)); // sooty belly
  return c.toDataURL('image/png');
}

// The TYRE sheet. The wheel's UV is u = angle around, v = arc length across the
// section (63_gen_skin.js genRevolveInto), so this canvas is a flattened tyre:
// v = 0.5 is the crown, v = 0 and 1 are the two beads, and nothing stretches.
//
// The tread is CIRCUMFERENTIAL RIBS, which is what aviation tyres wear — so it
// draws as horizontal lines here, is invariant along u, and a wheel that never
// spins still reads right. A block tread would be periodic in u and its
// stillness would be obvious at every taxi speed.
// The CABIN sheet. The liner's own UV: u runs fore-and-aft, v from the floor up
// the side walls (0..0.34 floor, 0.36..0.96 walls), so a band drawn here is a
// band along the cabin and nothing stretches round a corner.
// The INSIDE sheet. Two zones, because the two halves of an aeroplane's inside
// are trimmed by different trades: v 0.03..0.47 is the FUSELAGE (bare structure
// aft of the cabin — dope over fabric, frames showing through) and v 0.53..0.97
// is the CABIN (upholstered panels, ply floor, a trim line at the sill). u is the
// angle round the section in both, exactly as on the outside, so a band drawn
// here runs fore-and-aft on the aeroplane.
function genCabinDataURI(spec) {
  const S = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const yOf = v => S * (1 - v);
  const hex = n => '#' + (n >>> 0).toString(16).padStart(6, '0');
  const band = (v0, v1, fill) => { g.fillStyle = fill; g.fillRect(0, yOf(v1), S, yOf(v0) - yOf(v1)); };
  g.fillStyle = '#2e2b26'; g.fillRect(0, 0, S, S);
  // ---- fuselage zone: unfinished. Dope on the back of the fabric, and the
  // longerons and diagonals showing through it.
  band(0.03, 0.47, '#4a4339');
  g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 2;
  for (let i = 0; i <= 10; i++) {
    const x = S * i / 10;
    g.beginPath(); g.moveTo(x, yOf(0.47)); g.lineTo(x, yOf(0.03)); g.stroke();
  }
  g.strokeStyle = 'rgba(0,0,0,.10)'; g.lineWidth = 1;
  for (let y = yOf(0.47); y < yOf(0.03); y += 6) {
    g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(S, y + 0.5); g.stroke();
  }
  // ---- cabin zone: finished. u 0 is the roof, 0.25 / 0.75 the sides, 0.5 the
  // floor, so the bands below are laid out round the section the same way the
  // livery's are on the outside.
  band(0.53, 0.97, '#514a41');
  const uBand = (u0, u1, fill) => { g.fillStyle = fill; g.fillRect(u0 * S, yOf(0.97), (u1 - u0) * S, yOf(0.53) - yOf(0.97)); };
  uBand(0.42, 0.58, '#241f1a');                       // floor: ply, darker
  uBand(0.00, 0.10, '#5a5348'); uBand(0.90, 1.00, '#5a5348');   // headlining
  g.fillStyle = hex(spec && spec.paint ? spec.paint.trim : 0x1b3a5c);
  for (const u of [0.135, 0.845]) g.fillRect(u * S, yOf(0.97), 0.012 * S, yOf(0.53) - yOf(0.97));
  // upholstery seams down the sides, and the ply's own joints on the floor
  g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 2;
  for (let i = 1; i < 7; i++) {
    const y = yOf(0.97) + (yOf(0.53) - yOf(0.97)) * i / 7;
    g.beginPath(); g.moveTo(0.10 * S, y); g.lineTo(0.42 * S, y); g.stroke();
    g.beginPath(); g.moveTo(0.58 * S, y); g.lineTo(0.90 * S, y); g.stroke();
  }
  g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 1;
  for (let i = 1; i < 14; i++) {
    const y = yOf(0.97) + (yOf(0.53) - yOf(0.97)) * i / 14;
    g.beginPath(); g.moveTo(0.42 * S, y); g.lineTo(0.58 * S, y); g.stroke();
  }
  return c.toDataURL('image/png');
}

function genTyreDataURI() {
  const W = 128, H = 256, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const yOf = v => H * (1 - v);                    // texture v is bottom-up
  const band = (v0, v1, fill) => {
    g.fillStyle = fill;
    g.fillRect(0, yOf(v1), W, yOf(v0) - yOf(v1));
  };
  band(0, 1, '#26282d');                           // rubber
  // sidewalls: a shade darker in the hollow beside the bead, with the moulding
  // ring every tyre carries where the sidewall turns into the shoulder
  band(0.00, 0.10, '#1d1f23'); band(0.90, 1.00, '#1d1f23');
  band(0.16, 0.18, '#31343a'); band(0.82, 0.84, '#31343a');
  band(0.25, 0.27, '#1b1d21'); band(0.73, 0.75, '#1b1d21');
  // crown: four ribs, so three grooves. The shoulders stay plain, which is
  // where a ribbed tyre's tread actually stops.
  for (const v of [0.385, 0.50, 0.615]) band(v - 0.011, v + 0.011, '#15161a');
  band(0.325, 0.335, '#1b1d21'); band(0.665, 0.675, '#1b1d21');
  return c.toDataURL('image/png');
}

// ---------------------------------------------------------------------------
// The panel. api is the bridge app.js hands over (see its GARAGE bridge block).
// ---------------------------------------------------------------------------
function garageInit(api) {
  const $ = id => document.getElementById(id);
  const host = $('garage'), rows = $('gRows'), read = $('gRead');
  if (!host || !rows) return;

  const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const set = (o, path, v) => {
    const ks = path.split('.'), last = ks.pop();
    ks.reduce((a, k) => (a[k] = a[k] || {}), o)[last] = v;
  };
  // naca digits are one field in the spec but two knobs to a builder
  const nacaGet = (s, which) => {
    const d = String(s.wings[0].naca | 0).padStart(4, '0');
    return which === 'm' ? +d[0] : +d.slice(2);
  };
  const nacaSet = (s, which, v) => {
    const d = String(s.wings[0].naca | 0).padStart(4, '0');
    s.wings[0].naca = which === 'm' ? (v * 1000 + +d.slice(1))
                                    : (+d.slice(0, 2) * 100 + v);
  };

  // power and weight in the label: choosing an engine without them is choosing
  // blind, and engine mass is the single biggest lever on where the CG ends up
  const engLabel = k => {
    const e = POWERPLANTS[k].engine;
    const hp = e.powerW / 745.7;
    const m = e.mass >= 1 ? e.mass.toFixed(0) + ' kg' : (e.mass * 1000).toFixed(0) + ' g';
    return `${e.name} · ${hp < 10 ? hp.toFixed(1) : hp.toFixed(0)} hp · ${m}`;
  };

  // ---------------------------------------------------------------------
  // THE SECTIONS (G3.1). One block per component, in the order the generator
  // builds it: what the part IS, then how big, then where it sits. Each
  // carries its own line of the ledger, so the weight and the price of a
  // decision are next to the control that makes it rather than buried in a
  // single all-up number at the bottom.
  //
  // `p` is a path into the sectioned spec; the two `@` paths are the NACA
  // digits, which are one field to the generator and two knobs to a builder.
  // ---------------------------------------------------------------------
  const SECTIONS = [
    { L: 'Fuselage', led: ['fuselage'], items: [
      { t: 'sel', L: 'Structure', p: 'fuselage.material',
        o: () => Object.keys(GEN_MATERIALS).map(k =>
              [k, `${GEN_MATERIALS[k].name} · ${GEN_MATERIALS[k].price} cr/kg`]) },
      { t: 'sel', L: 'Shape', p: 'fuselage.shape',
        o: () => Object.keys(GEN_SHAPES).map(k => [k, GEN_SHAPES[k].name]) },
      { L: 'Tail arm',    p: 'fuselage.tailArm',   min: 2.0,  max: 6.5,  st: 0.05, u: ' m' },
      { L: 'Bays aft',    p: 'fuselage.tailBays',  min: 3,    max: 6,    st: 1,    u: '' },
      { L: 'Turtledeck',  p: 'fuselage.crownTop',  min: 0,    max: 1,    st: 0.05, u: '' },
      { L: 'Crown sides', p: 'fuselage.crownSide', min: 0,    max: 0.6,  st: 0.02, u: '' },
      { L: 'Windscreen',  p: 'fuselage.windRun',   min: 0.10, max: 0.60, st: 0.02, u: '' },
      { L: 'Tail width',  p: 'fuselage.tailW',     min: 0.06, max: 0.45, st: 0.01, u: ' m' },
      { L: 'Tail floor',  p: 'fuselage.tailBot',   min: 0,    max: 0.80, st: 0.02, u: ' m' },
      { L: 'Tail deck',   p: 'fuselage.tailTop',   min: 0.10, max: 1.20, st: 0.02, u: ' m' },
    ] },
    { L: 'Cabin & cargo', led: ['cabin', 'cargo'], items: [
      { t: 'sel', L: 'Seats', p: 'cabin.seating',
        o: [['single', 'Single'], ['tandem2', 'Tandem 2'], ['side2', 'Side by side 2'],
            ['drone', 'Drone (no cabin)']] },
      { L: 'Length',    p: 'cabin.len',   min: 0.60, max: 2.60, st: 0.05, u: ' m' },
      { L: 'Height',    p: 'cabin.h',     min: 0.75, max: 1.45, st: 0.02, u: ' m' },
      { L: 'Half width', p: 'cabin.halfW', min: 0.28, max: 0.75, st: 0.01, u: ' m' },
      { L: 'Cargo bay', p: 'cargo.len',   min: 0,    max: 2.5,  st: 0.1,  u: ' m' },
      { L: 'Freight',   p: 'cargo.kg',    min: 0,    max: 400,  st: 10,   u: ' kg' },
    ] },
    { L: 'Wings', led: ['wings'], items: [
      { t: 'sel', L: 'Position', p: 'wings.0.position',
        o: [['high', 'High wing'], ['mid', 'Mid wing'], ['low', 'Low wing']] },
      { L: 'Span',      p: 'wings.0.span',      min: 6.5,  max: 14,   st: 0.1,  u: ' m' },
      { L: 'Chord root', p: 'wings.0.chord',    min: 1.15, max: 2.10, st: 0.05, u: ' m' },
      { L: 'Chord tip',  p: '@chordTip',        min: 0.55, max: 2.10, st: 0.05, u: ' m' },
      { t: 'sel', L: 'Tips', p: 'wings.0.tip',
        o: () => Object.keys(GEN_TIPS).map(k => [k, GEN_TIPS[k].name]) },
      { L: 'Crank at',  p: 'wings.0.crankAt',     min: 0,    max: 0.85, st: 0.05, u: '' },
      { L: 'Dih. outer', p: 'wings.0.dihedralOut', min: 0,   max: 20,   st: 0.5,  u: '°' },
      { L: 'Sweep',     p: 'wings.0.sweep',     min: -15,  max: 30,   st: 1,    u: '°', sign: 1 },
      { L: 'Dihedral',  p: 'wings.0.dihedral',  min: 0,    max: 6,    st: 0.5,  u: '°' },
      { L: 'Incidence', p: 'wings.0.incidence', min: -1,   max: 4,    st: 0.1,  u: '°' },
      { L: 'Washout',   p: 'wings.0.washout',   min: 0,    max: 4,    st: 0.1,  u: '°' },
      { L: 'Camber',    p: '@camber',           min: 0,    max: 6,    st: 1,    u: '%' },
      { L: 'Thickness', p: '@thick',            min: 9,    max: 18,   st: 1,    u: '%' },
      // WHERE IT SITS. Offsets from the derived position, so they ride along
      // when something upstream moves. Deliberately generous — the shakedown
      // block below tells you what you have built.
      { L: 'Fore/aft',  p: 'wings.0.place.dx',  min: -1.2, max: 1.8,  st: 0.05, u: ' m', sign: 1 },
      { L: 'Height',    p: 'wings.0.place.dy',  min: -0.25, max: 0.6, st: 0.02, u: ' m', sign: 1 },
    ] },
    { L: 'Struts & fixation', led: ['bracing'], items: [
      { t: 'sel', L: 'Fixation', p: 'bracing.type',
        o: [['strut', 'Lift struts'], ['cantilever', 'Cantilever']] },
    ] },
    { L: 'Engine, cowl & blades', led: ['engines'], items: [
      { t: 'sel', L: 'Engine', p: 'engines.0.type',
        o: () => Object.keys(POWERPLANTS).map(k => [k, engLabel(k)]) },
      { L: 'Cowl fillet', p: 'cowl.fillet',        min: 0.02, max: 0.22, st: 0.01, u: ' m' },
      { L: 'Cowl taper',  p: 'cowl.taper',         min: 0.70, max: 1.0,  st: 0.02, u: '' },
      { L: 'Cowl deck',   p: 'fuselage.cowlDeck',  min: 0.50, max: 0.95, st: 0.02, u: '' },
      { L: 'Fore/aft',    p: 'engines.0.place.dx', min: -0.6, max: 0.45, st: 0.02, u: ' m', sign: 1 },
      { L: 'Thrustline',  p: 'engines.0.place.dy', min: -0.3, max: 0.4,  st: 0.02, u: ' m', sign: 1 },
    ] },
    { L: 'Tail', led: ['tail'], items: [
      { t: 'sel', L: 'Type', p: 'tail.type',
        o: [['conventional', 'Conventional'], ['v', 'V-tail (ruddervators)']] },
      { L: 'V angle',    p: 'tail.vAngle',  min: 20,   max: 55,   st: 1,    u: '°' },
      { L: 'Stab span',  p: 'tail.hSpan',   min: 1.5,  max: 4.5,  st: 0.05, u: ' m' },
      { L: 'Stab root',  p: '@stabRoot',    min: 0.40, max: 2.20, st: 0.02, u: ' m' },
      { L: 'Stab tip',   p: '@stabTip',     min: 0.20, max: 2.20, st: 0.02, u: ' m' },
      { t: 'sel', L: 'Tips', p: 'tail.tip',
        o: () => Object.keys(GEN_TIPS).map(k => [k, GEN_TIPS[k].name]) },
      { L: 'Fin height', p: 'tail.vHeight', min: 0.60, max: 2.20, st: 0.05, u: ' m' },
      { L: 'Fin chord',  p: 'tail.vChord',  min: 0.40, max: 1.80, st: 0.02, u: ' m' },
      { L: 'Fore/aft',   p: 'tail.place.dx', min: -1.5, max: 1.5, st: 0.05, u: ' m', sign: 1 },
    ] },
    { L: 'Wheels & suspension', led: ['gear'], items: [
      { t: 'sel', L: 'Gear', p: 'gear.type',
        o: [['taildragger', 'Taildragger'], ['tricycle', 'Tricycle']] },
      { t: 'sel', L: 'Springing', p: 'gear.suspension',
        o: () => Object.keys(GEN_SUSPENSION).map(k =>
              [k, `${GEN_SUSPENSION[k].name} · ${GEN_SUSPENSION[k].price} cr`]) },
      { L: 'Stiffness', p: 'gear.stiffness',      min: 0.35, max: 3,   st: 0.05, u: '×' },
      { L: 'Tyre',      p: 'gear.wheelR',         min: 0.10, max: 0.40, st: 0.01, u: ' m' },
      { L: 'Track',     p: 'gear.track',          min: 0.90, max: 3.50, st: 0.05, u: ' m' },
      { L: 'Fore/aft',  p: 'gear.place.dx',       min: -0.8, max: 1.2, st: 0.02, u: ' m', sign: 1 },
      { L: 'Widen',     p: 'gear.place.dtrack',   min: -0.8, max: 1.5, st: 0.05, u: ' m', sign: 1 },
    ] },
    { L: 'Control surfaces', led: [], items: [
      { t: 'sel', L: 'Flaps', p: 'controls.flap.type',
        o: () => Object.keys(GEN_FLAPS).map(k => [k, GEN_FLAPS[k].name]) },
      { L: 'Flap span',  p: 'controls.flap.span',     min: 0.10, max: 0.60, st: 0.02, u: '' },
      { L: 'Flap chord', p: 'controls.flap.chord',    min: 0.10, max: 0.40, st: 0.01, u: '' },
      { L: 'Ail. span',  p: 'controls.aileron.span',  min: 0.15, max: 0.55, st: 0.01, u: '' },
      { L: 'Ail. chord', p: 'controls.aileron.chord', min: 0.10, max: 0.35, st: 0.01, u: '' },
      { L: 'Elevator',   p: 'controls.elevator.chord', min: 0.20, max: 0.55, st: 0.01, u: '' },
      { L: 'Rudder',     p: 'controls.rudder.chord',  min: 0.20, max: 0.60, st: 0.01, u: '' },
    ] },
    { L: 'Fuel & systems', led: ['fuel', 'systems'], items: [
      { L: 'Fuel',    p: 'fuel.litres',  min: 0, max: 140, st: 5, u: ' l' },
      { t: 'sel', L: 'Tank', p: 'fuel.tank',
        o: () => Object.keys(GEN_TANKS).map(k => [k, GEN_TANKS[k].name]) },
      { t: 'sel', L: 'Panel', p: 'systems.fit',
        o: () => Object.keys(GEN_SYSTEMS).map(k =>
              [k, `${GEN_SYSTEMS[k].name} · ${GEN_SYSTEMS[k].mass} kg`]) },
      { L: 'Baggage', p: 'cabin.baggage', min: 0, max: 60, st: 5, u: ' kg' },
    ] },
    { L: 'Paint & finish', led: ['paint'], items: [{ t: 'paint' }] },
  ];
  const ITEMS = SECTIONS.flatMap(s => s.items.filter(i => !i.t));
  // A builder thinks in ROOT CHORD and TIP CHORD; the spec stores a root chord
  // and a taper RATIO. These are the translation, and they are derived controls
  // rather than spec fields so there is still exactly one number for the shape.
  // `hChord` is the stabiliser's MEAN chord (Sh = hSpan * hChord), so its root
  // is 2c/(1+lambda) — writing the root holds the taper, writing the tip holds
  // the root, which is what each knob means to the person turning it.
  const stabRoot = s => 2 * s.tail.hChord / (1 + s.tail.hTaper);
  const DERIVED = {
    '@camber':   { get: s => nacaGet(s, 'm'), set: (s, v) => nacaSet(s, 'm', v) },
    '@thick':    { get: s => nacaGet(s, 't'), set: (s, v) => nacaSet(s, 't', v) },
    '@chordTip': { get: s => s.wings[0].chord * s.wings[0].taper,
                   set: (s, v) => { s.wings[0].taper = v / Math.max(0.2, s.wings[0].chord); } },
    '@stabRoot': { get: stabRoot,
                   set: (s, v) => { s.tail.hChord = v * (1 + s.tail.hTaper) / 2; } },
    '@stabTip':  { get: s => stabRoot(s) * s.tail.hTaper,
                   set: (s, v) => { const r = stabRoot(s);
                                    s.tail.hTaper = v / Math.max(0.2, r);
                                    s.tail.hChord = r * (1 + s.tail.hTaper) / 2; } },
  };
  const readVal = (s, p) => (DERIVED[p] ? DERIVED[p].get(s) : get(s, p));
  const writeVal = (s, p, v) => (DERIVED[p] ? DERIVED[p].set(s, v) : set(s, p, v));

  let spec = api.defaults();
  const els = {};
  const row = (host, label, node, valNode) => {
    const d = document.createElement('div');
    d.className = 'grow';
    const l = document.createElement('span'); l.textContent = label;
    d.appendChild(l); d.appendChild(node);
    if (valNode) d.appendChild(valNode);
    host.appendChild(d);
    return d;
  };

  // an offset reads much better with its sign shown: "+0.40 m" is a nudge aft,
  // "0.40 m" looks like an absolute position
  const fmt = S => v => (S.sign && v > 0 ? '+' : '') +
    (+v).toFixed(S.st < 1 ? 2 : 0) + S.u;
  // a slider on a field the player has not set shows the DERIVED value and says
  // so; the moment they drag it, it becomes theirs and stops being auto
  const isAuto = p => p[0] !== '@' && get(spec, p) == null;
  const shown = p => {
    const v = readVal(spec, p);
    if (v != null) return +v;
    const b = api.resolved();
    const d = b ? readVal(b, p) : null;
    return d == null ? null : +d;
  };

  // paint: a few schemes rather than a colour picker — one tap, always legible
  const SCHEMES = [
    [0xf2c437, 0x1b3a5c], [0xe8e3d8, 0xb5342c], [0x2f6f52, 0xe8e3d8],
    [0xd8562e, 0x2a2724], [0x9fb3c8, 0x22304a],
  ];

  // ROLL OUT (G3.2). While you build, the solver is stopped and the aeroplane
  // stands on the apron; this is the commit. It sits above the sections because
  // it is the one thing you do to the whole aeroplane rather than to a part.
  const rollBtn = document.createElement('button');
  rollBtn.id = 'gRoll'; rollBtn.className = 'pri';
  rollBtn.textContent = 'Roll out to the strip';
  rollBtn.addEventListener('click', () => { if (api.rollOut) api.rollOut(); syncRoll(); });
  rows.appendChild(rollBtn);
  const syncRoll = () => {
    const on = !api.inGarage || api.inGarage();
    rollBtn.disabled = !on;
    rollBtn.textContent = on ? 'Roll out to the strip' : 'On the strip — flying';
  };

  // THE SHAKEDOWN, as a section like any other. Its header carries the four
  // numbers you judge an aeroplane by before opening anything — what it costs,
  // what it weighs, what pulls it and how much wing it has — so the panel can
  // be fully collapsed and still tell you what you have built.
  const shakeSec = document.createElement('details');
  shakeSec.className = 'gsec'; shakeSec.open = false;
  {
    const sum = document.createElement('summary');
    const nm = document.createElement('span'); nm.textContent = 'Shakedown';
    const bd = document.createElement('i'); bd.id = 'gShakeBadge';
    sum.appendChild(nm); sum.appendChild(bd);
    shakeSec.appendChild(sum);
    rows.appendChild(shakeSec);
    if (read && read.parentNode) shakeSec.appendChild(read);
  }
  const shakeBadge = shakeSec.querySelector('i');

  const badges = {};
  for (const SEC of SECTIONS) {
    const det = document.createElement('details');
    // closed by default: nine section headers each showing what that part
    // weighs and costs IS the most useful view of an aeroplane, and open-all
    // runs several screens deep. Open the one you are working on.
    det.className = 'gsec'; det.open = false;
    const sum = document.createElement('summary');
    const nm = document.createElement('span'); nm.textContent = SEC.L;
    const bd = document.createElement('i');            // mass · cost, filled by report()
    sum.appendChild(nm); sum.appendChild(bd);
    det.appendChild(sum);
    rows.appendChild(det);
    badges[SEC.L] = bd;

    for (const I of SEC.items) {
      if (I.t === 'paint') {
        const wrap = document.createElement('div');
        wrap.className = 'gsw';
        SCHEMES.forEach(([base, trim]) => {
          const b = document.createElement('button');
          b.style.background = '#' + base.toString(16).padStart(6, '0');
          b.style.borderColor = '#' + trim.toString(16).padStart(6, '0');
          b.title = 'paint scheme';
          b.addEventListener('click', () => {
            spec.paint = Object.assign({}, spec.paint, { base, trim });
            rebuild();
          });
          wrap.appendChild(b);
        });
        row(det, 'Scheme', wrap);
        continue;
      }
      if (I.t === 'sel') {
        const s = document.createElement('select');
        for (const [v, t] of (typeof I.o === 'function' ? I.o() : I.o)) {
          const o = document.createElement('option');
          o.value = v; o.textContent = t; s.appendChild(o);
        }
        s.value = get(spec, I.p);
        s.addEventListener('change', () => { set(spec, I.p, s.value); rebuild(); });
        row(det, I.L, s);
        els[I.p] = { s };
        continue;
      }
      const r = document.createElement('input');
      r.type = 'range'; r.min = I.min; r.max = I.max; r.step = I.st;
      const b = document.createElement('b');
      const show = fmt(I);
      const v0 = shown(I.p);
      if (v0 != null) { r.value = v0; b.textContent = show(v0); }
      b.classList.toggle('auto', isAuto(I.p));
      r.addEventListener('input', () => {
        writeVal(spec, I.p, +r.value);      // dragging always claims the field
        b.textContent = show(r.value);
        b.classList.remove('auto');
        queue();
      });
      row(det, I.L, r, b);
      els[I.p] = { r, b, S: I, show };
    }
  }

  // ---- rebuild, debounced: a slider drag would otherwise regenerate the
  // structure, re-trim it in the tunnel and re-upload the mesh every pixel ----
  let timer = 0;
  const queue = () => { clearTimeout(timer); timer = setTimeout(rebuild, 140); };
  function rebuild() {
    clearTimeout(timer);
    api.apply(spec);
    refresh();
  }
  // show what was actually BUILT: clampSpec may have pulled a value back inside
  // the envelope (span is tied to chord), and every field left null has just
  // been derived from the ones around it.
  function refresh() {
    const built = api.resolved();
    if (built) {
      for (const I of ITEMS) {
        const e = els[I.p]; if (!e || !e.r) continue;
        // An AUTO field shows what the generator DERIVED; a field the player
        // owns shows what the player set. Reading the built value for an owned
        // field was a real bug, not a nicety: gear.track is recomputed as
        // (your track + place.dtrack), so displaying that and copying it back
        // added the offset again on every rebuild and the track ran away to its
        // clamp on each slider touch. gear.x had the same flaw.
        const v = isAuto(I.p) ? readVal(built, I.p) : readVal(spec, I.p);
        if (v == null || !isFinite(v)) continue;
        if (Math.abs(+e.r.value - v) > 1e-9) {
          e.r.value = v;
          e.b.textContent = e.show(v);
        }
        e.b.classList.toggle('auto', isAuto(I.p));
      }
      for (const I of SECTIONS.flatMap(x => x.items).filter(i => i.t === 'sel')) {
        const e = els[I.p]; if (e && e.s) e.s.value = get(built, I.p);
      }
    }
    report();
    syncRoll();
  }

  function report() {
    const s = api.shake(), b = api.resolved();
    if (!s || !b) { read.innerHTML = ''; return; }
    const n = (v, d) => (v == null || !isFinite(v)) ? '—' : v.toFixed(d == null ? 1 : d);
    const flag = (ok, warn) => ok ? 'ok' : (warn ? 'warn' : 'bad');
    const smOK = s.staticMargin > 0.05 && s.staticMargin < 0.35;
    const cell = (k, v, cls) => `<div class="gc ${cls || ''}"><span>${k}</span><b>${v}</b></div>`;

    // ---- the ledger, back onto the section headers it came from ----
    // money in the header, mass in the header: the two costs of every decision,
    // at the control that makes it. Prices are round numbers, so 'k' reads fine.
    const money = c => c >= 10000 ? (c / 1000).toFixed(0) + 'k'
                    : c >= 1000 ? (c / 1000).toFixed(1) + 'k' : c.toFixed(0);
    shakeBadge.textContent = [
      s.cost != null ? money(s.cost) + ' cr' : '',
      n(s.mass, 0) + ' kg',
      s.hp != null ? n(s.hp, 0) + ' hp' : '',
      b.wing ? n(b.wing.span, 1) + ' m' : '',
    ].filter(Boolean).join(' · ');
    const L = s.ledger || {};
    for (const SEC of SECTIONS) {
      const bd = badges[SEC.L]; if (!bd) continue;
      let m = 0, c = 0;
      for (const k of SEC.led) if (L[k]) { m += L[k].mass; c += L[k].cost; }
      bd.textContent = (m >= 0.05 ? n(m, m < 10 ? 1 : 0) + ' kg' : '') +
                       (m >= 0.05 && c > 0 ? ' · ' : '') +
                       (c > 0 ? money(c) + ' cr' : '');
    }

    read.innerHTML =
      `<div class="ggrid">` +
      cell('all-up', n(s.mass, 0) + ' kg') +
      cell('price', (s.cost == null ? '—' : money(s.cost) + ' cr')) +
      cell('wing', n(s.Sw) + ' m²') +
      cell('loading', n(s.wingLoad) + ' kg/m²') +
      cell('stall', n(s.Vs * 3.6, 0) + ' km/h') +
      (s.VsFlap != null
        ? cell('stall, flap', n(s.VsFlap * 3.6, 0) + ' km/h', flag(s.VsRatio < 0.94))
        : '') +
      cell('cruise', n(s.VCruise * 3.6, 0) + ' km/h') +
      cell('L/D', n(s.LD, 1)) +
      cell('static margin', n(s.staticMargin * 100) + '%', flag(smOK)) +
      cell('cruise power', n(s.thrCruise * 100, 0) + '%', flag(s.thrCruise < 0.85, s.thrCruise < 0.95)) +
      cell('take-off run', n(s.TORun, 0) + ' m') +
      cell('3-point', n(s.deckAngle) + '°', flag(s.deckAngle > 8 && s.deckAngle < 15)) +
      cell('prop clear', n(s.propClear, 2) + ' m', flag(s.propClear > 0.20)) +
      `</div>` +
      // the undercarriage block: whether it stands up at all comes FIRST,
      // because every aerodynamic number above stays healthy on an aeroplane
      // that is lying on its nose
      `<h3>On the ground</h3><div class="ggrid">` +
      cell('stands on', s.onWheels ? 'wheels' : s.restsOn, flag(s.onWheels)) +
      // the tipping criterion inverts with the gear: a taildragger must keep
      // its CG behind the mains, a tricycle ahead of them
      (s.gearType === 'tricycle'
        ? cell('nose load', n(-s.noseOver) + '°', flag(s.noseOver < -8 && s.noseOver > -35))
        : cell('nose-over', n(s.noseOver) + '°', flag(s.noseOver > 16 && s.noseOver < 26,
                                                      s.noseOver > 13 && s.noseOver < 32))) +
      cell('gear at rest', n(s.gearStrain * 100, 0) + '%', flag(s.gearStrain < 0.15, s.gearStrain < 0.25)) +
      cell('engine', n(s.hp, 0) + ' hp / ' + n(s.engineMass, 0) + ' kg') +
      cell('power loading', n(s.powerLoad, 1) + ' kg/hp', flag(s.powerLoad < 14, s.powerLoad < 22)) +
      `</div>` +
      // AUTO is per FIELD, from resolveSpec's own record of what it filled in —
      // a field the player has overridden must stop claiming to be derived
      `<h3>Shape</h3><div class="ggrid">` +
      ((k, A) => k('stab', n(b.tail.hSpan) + ' × ' + n(b.tail.hChord, 2) + ' m', A('tail.hSpan')) +
                 k('fin', n(b.tail.vHeight) + ' × ' + n(b.tail.vChord, 2) + ' m', A('tail.vHeight')) +
                 k('tail arm', n(b.fuse.tailArm) + ' m', A('fuse.tailArm')) +
                 k('gear track', n(b.gear.track) + ' m', A('gear.track')) +
                 k('main axle', n(b.gear.x, 2) + ' m aft', A('gear.x')) +
                 k('aspect ratio', n(b.geom.AR, 2), '') +
                 // the generator refuses a strut it knows cannot brace, and
                 // says so rather than building one that quietly does nothing
                 k('bracing', s.bracing || '—',
                   (b.wing.strut && s.bracing !== 'strut') ? 'warn' : '')
      )(cell, f => (b._auto && b._auto[f]) ? 'auto' : '') +
      `</div><p class="gnote">italic = derived for you; set it yourself and it stops.</p>`;
  }

  // the panel only makes sense while the garage build is selected
  const acSel = $('selAc');
  const sync = () => {
    const on = api.isGen();
    host.style.display = on ? '' : 'none';
    if (on) refresh();
  };
  if (acSel) acSel.addEventListener('change', () => setTimeout(sync, 0));
  const close = $('gClose');
  if (close) close.addEventListener('click', () => { host.style.display = 'none'; });
  sync();
}
