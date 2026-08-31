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
  // FINISH. A bare airframe carries no scheme, so the trim sweep and its
  // highlight are SKIPPED rather than drawn zero-wide: a degenerate band still
  // closes a path and fills a hairline where its two edges meet.
  const FIN = (typeof GEN_FINISH !== 'undefined' && GEN_FINISH[P.job]) || null;
  const sweep = 0.045 * P.sweep * (FIN ? FIN.sweep : 1);
  if (sweep > 0) for (const [uc, sg] of [[0.30, -1], [0.70, 1]]) {
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

// The COWL sheet. Its UV is u = angle around (0 top, 0.25 the +z side, 0.5 the
// belly), v = firewall (0) to nose face, with the top 12% of the sheet being the
// flat nose face as a rim strip — see GEN_COWL_V in 63_gen_skin.js.
//
// It has to read as the SAME AEROPLANE as the body, which shares no pixels with
// it, so the livery features that cross the joint are drawn here at the same u:
// the belly shade and the cheat line. Get those wrong and the cowl joint becomes
// a visible seam in the paint even though the geometry matches.
function genCowlDataURI(spec) {
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const hex = n => '#' + (n >>> 0).toString(16).padStart(6, '0');
  const mix = (a, b, t) => {
    const A = [(a>>16)&255, (a>>8)&255, a&255], Bc = [(b>>16)&255, (b>>8)&255, b&255];
    return hex(((A[0]+(Bc[0]-A[0])*t)|0)<<16 | ((A[1]+(Bc[1]-A[1])*t)|0)<<8 | ((A[2]+(Bc[2]-A[2])*t)|0));
  };
  const P = spec.paint, yOf = v => S * (1 - v);      // texture v is bottom-up
  g.fillStyle = hex(P.base); g.fillRect(0, 0, S, S);
  // the two features that cross the firewall joint, at the body's own u
  g.fillStyle = mix(P.base, 0x000000, 0.13);
  g.fillRect(0.435 * S, 0, 0.13 * S, S);                       // belly, darker
  g.fillStyle = hex(P.trim);
  for (const u of [0.30, 0.70]) g.fillRect((u - 0.013) * S, 0, 0.026 * S, S);
  // the NOSE FACE strip: a shade darker, so the front reads as a face and not as
  // more of the same tube, and a spinner ring at the very top of it
  g.fillStyle = mix(P.base, 0x000000, 0.22);
  g.fillRect(0, 0, S, yOf(0.88));
  g.fillStyle = mix(P.base, 0x000000, 0.42);
  g.fillRect(0, 0, S, yOf(0.965));
  // INTAKES. A louvred slot: the opening is nearly black because it IS a hole,
  // with a lighter lip above it (the eye reads the lip as depth) and n louvres
  // across. Drawn on the forward part of the cover, which is where a real one is.
  const IN = (typeof GEN_INTAKES !== 'undefined' && GEN_INTAKES[spec.cowl.intake])
             || { slots: [] };
  for (const s of IN.slots) {
    const x0 = (s.u - s.w) * S, x1 = (s.u + s.w) * S;
    const yTop = yOf(0.845), yBot = yOf(0.60);
    g.fillStyle = mix(P.base, 0xffffff, 0.30);                 // lip
    g.fillRect(x0 - 2, yTop - 3, x1 - x0 + 4, yBot - yTop + 6);
    g.fillStyle = '#0d0e10';                                   // the opening
    g.fillRect(x0, yTop, x1 - x0, yBot - yTop);
    g.strokeStyle = mix(P.base, 0x000000, 0.55);               // louvres
    g.lineWidth = 2;
    for (let i = 1; i < s.n; i++) {
      const y = yTop + (yBot - yTop) * i / s.n;
      g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
    }
  }
  // cooling gills along the joint: every cowl has them and they read as scale
  g.strokeStyle = 'rgba(0,0,0,.20)'; g.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const y = yOf(0.10 + 0.055 * i) + 0.5;
    g.beginPath(); g.moveTo(0.06 * S, y); g.lineTo(0.94 * S, y); g.stroke();
  }
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
// THE SHELF + the spec handle. api is the bridge app.js hands over (see its
// GARAGE bridge block).
//
// THE PANEL IS GONE (G35, user: "that's the last time we'll see the old
// editor"). The slider tree, the shakedown readout, the badges, the test
// and roll buttons — all of it — was retired when the CAGE EDITOR became
// the game's editor; the last build carrying it is
// earlierVersions/2026-08-28-preP3-last-old-garage.html. What remains
// here is what was never the editor: the paint bakers above, and below —
// THE SHELF (G63) and window.GARAGE_SPEC, the external handle on a build.
//
// THE SHELF is what the BUILDS bar became. Three stores used to hold a
// design — this one, the cage editor's own `cageCfg:<pathname>` map, and a
// hardcoded preset list that was literally the user's own exports pasted into
// _cage_page5.js because there was no working way to load a build back into
// the editor. Two of them wrote files both tagged `flydiy-build` with
// incompatible payloads, and each silently destroyed the other's data on
// import. Now: ONE store, ONE format, and the stock designs are rows in the
// same list as your own aeroplanes.
// ---------------------------------------------------------------------------
function garageInit(api) {
  const $ = id => document.getElementById(id);
  const host = $('edShelf');
  if (!host) return;

  // =====================================================================
  // SAVING, LOADING, AND THE FILE ON DISK.
  //
  // WHAT IS SAVED IS THE SPEC, NULLS AND ALL. A field left null is one the
  // generator DERIVES, and it has to stay null: freeze the derived number into
  // the save and it stops following whatever it was derived from, so a build
  // reloaded after a cabin change quietly stops fitting its own cabin. It is
  // also what lets an old save benefit from later generator work — the fields
  // nobody set are recomputed by the rules as they are today. `genNormaliseSpec`
  // fills anything a save predates, so a partial or older file loads rather
  // than being rejected.
  //
  // Storage is best-effort throughout: a browser with storage disabled must
  // still be able to build an aeroplane, so every call is guarded and a failure
  // costs the save, not the session.
  const LS = (() => { try { return window.localStorage; } catch (e) { return null; } })();
  const SLOT = 'flydiy.build.';          // one key per named build
  const WIP  = 'flydiy.wip';             // the working build, written every rebuild
  const lsGet = k => { try { return LS && LS.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { if (LS) LS.setItem(k, v); return true; }
                            catch (e) { return false; } };
  const lsDel = k => { try { if (LS) LS.removeItem(k); } catch (e) {} };
  const slotNames = () => {
    const out = [];
    try {
      for (let i = 0; i < (LS ? LS.length : 0); i++) {
        const k = LS.key(i);
        if (k && k.lastIndexOf(SLOT, 0) === 0) out.push(k.slice(SLOT.length));
      }
    } catch (e) {}
    return out.sort();
  };
  // The envelope carries the spec version so a future migration has something
  // to branch on. Nothing reads it today — genNormaliseSpec does the work — and
  // that is deliberate; see the note on GEN_SPEC_V in 60_gen_spec.js.
  //
  // `plaque` and `log` ride BESIDE the spec, never inside it (G63): a test
  // result is not a design decision, and putting one in the spec would make it
  // an input to the generator that produced it. `log` is the logbook stub the
  // fleet grows out of — when it was built, what has been tested, what it has
  // flown.
  const newLog = () => ({ built: null, tests: [], flights: [] });
  const envelope = (name, s, pq, lg) => JSON.stringify({
    what: 'flydiy-build', v: (typeof GEN_SPEC_V === 'number' ? GEN_SPEC_V : null),
    // NULL when the build has no slot yet, never a placeholder: the working
    // build used to be written under the literal name 'working', so a user
    // who saved a build actually called `working` had every later unnamed
    // session silently adopt it as its slot.
    name: name || null, spec: s,
    plaque: pq || null, log: lg || newLog(),
  });
  // Accepts an envelope OR a bare spec, because a spec pasted out of a console
  // is a perfectly good thing to want to load.
  const unwrap = txt => {
    const o = JSON.parse(txt);
    if (o && o.spec && typeof o.spec === 'object')
      return { name: o.name, spec: o.spec, plaque: o.plaque || null,
               log: o.log || newLog() };
    if (o && (o.wings || o.fuselage || o.cabin || o.cage))
      return { name: null, spec: o, plaque: null, log: newLog() };
    throw new Error('not a flyDiy build');
  };

  // ---- THE EDITOR, as a load target -------------------------------------
  // The one thing the game could never do (G63). `CAGE_UI.applySpec` is the
  // editor's own route in — cageFromSpec from the TEMPLATE, not from the
  // page's defaults — so a build fully determines the aeroplane instead of
  // inheriting whatever sliders it did not mention.
  const ed = () => (window.CAGE_UI && window.CAGE_UI.applySpec) ? window.CAGE_UI : null;
  const join = () => (window.CAGE_JOIN && window.CAGE_JOIN.export) ? window.CAGE_JOIN : null;

  // ---- THE UPDATE (G63) -------------------------------------------------
  // `build & fly` used to hand the join's output to `set`, which replaces
  // wholesale — so every field the join does not write was silently reset to
  // the generator's defaults on every single build: the name, the registration,
  // the whole paint, the propeller, the cowl, the fuel, the systems, the
  // baggage, the elevator and rudder chords, and every un-measured key of the
  // cabin, gear and tail sections. A build was therefore un-paintable: the
  // colours came back yellow the moment you touched a slider.
  //
  // The join is an UPDATE to the build you already have, which is a different
  // operation from loading a file. `set` keeps its "load replaces, never
  // merges" ruling (a build is a whole aeroplane); `update` merges per KEY, so
  // `gear.x` moves while `gear.fairing` stays.
  //
  // DECLARED HAZARD: a key the join writes only when it can MEASURE it keeps
  // its previous value when the measurement is missing, rather than reverting
  // to derived. That is the right answer when a measurement fails (the last
  // good number beats a silent revert) and the wrong one if a design could
  // lose a part mid-session — which it cannot, because switching designs goes
  // through `set`, not through here.
  const isPlain = o => o && typeof o === 'object' && !Array.isArray(o);
  function merge(base, over) {
    if (!isPlain(over)) return over;
    const out = isPlain(base) ? Object.assign({}, base) : {};
    for (const k in over) {
      if (Array.isArray(over[k])) {
        // WINGS merge element-wise: the join writes nearly every wing key but
        // not `place`, and a wholesale replace loses it. Every other array —
        // the boom profile, the engine list — is a measurement of a whole
        // thing and replaces as a whole.
        out[k] = (k === 'wings' && Array.isArray(base && base[k]))
          ? over[k].map((w, i) => merge(base[k][i], w))
          : over[k];
      } else if (k === 'finish') {
        // THE FINISH REPLACES AS A WHOLE (G105), like the arrays above and for
        // the same reason: it is one measurement of one thing. It is also
        // written as DEVIATIONS, so "this section has no tint any more" is
        // said by the section's absence — merged, an override could be put on
        // and never taken off again.
        out[k] = over[k];
      } else if (isPlain(over[k])) out[k] = merge(base && base[k], over[k]);
      else out[k] = over[k];
    }
    return out;
  }

  // ---- THE STOCK DESIGNS ------------------------------------------------
  // What the editor's `presets` menu was. They are BAKED here into ordinary
  // builds so that stock and saved designs travel one code path: a preset used
  // to be applied over `CAGE_PARAMS + PAGE.defaults` while an import started
  // from `CAGE_PARAMS` alone, so the same aeroplane arrived DIFFERENT depending
  // on which door it came through — the sailplane row carried a hand-written
  // patch for exactly that and the piper cub did not.
  //
  // Baking is `template + page defaults + the preset's own overrides`, taken
  // back out through `cageToSpec` as deviations from the template. Read-only:
  // saving a stock design makes your own copy, which is what a stock design is
  // for.
  const STOCK = (() => {
    const out = [];
    try {
      const C = window.CAGE2, PG = window.CAGE_PAGE;
      if (!C || !C.cageToSpec || !PG || !PG.presets) return out;
      for (const nm in PG.presets) {
        const full = Object.assign(C.cageDefaults(), PG.defaults || {},
                                   PG.presets[nm] || {});
        out.push({ name: nm, spec: { cage: C.cageToSpec(full) } });
      }
    } catch (e) {}
    return out;
  })();
  const stockByName = n => {
    for (const s of STOCK) if (s.name === n) return s;
    return null;
  };

  let spec = api.defaults();
  let slotName = '';
  let plaque = null, log = newLog();
  // RESTORE THE WORKING BUILD. A reload used to be destructive — the spec lived
  // only in this closure and nothing wrote it anywhere — which is exactly how a
  // build gets lost. Anything unreadable is ignored rather than thrown: a
  // corrupt autosave must not stop the garage opening.
  {
    const wip = lsGet(WIP);
    if (wip) try {
      const got = unwrap(wip);
      spec = got.spec; plaque = got.plaque; log = got.log;
      try { if (typeof genNormaliseSpec === 'function') spec = genNormaliseSpec(spec); }
      catch (e) {}
      // and WHICH BUILD it was, so Save still knows its target after a reload.
      // Only if that slot still exists — a name pointing at a build that was
      // deleted would make Save silently resurrect it.
      if (got.name && lsGet(SLOT + got.name) != null) slotName = got.name;
    } catch (e) {}
  }

  // REBUILD, post-panel: the bridge apply plus the WIP autosave the old
  // panel's rebuild always did. Loading a build still rebuilds the
  // aeroplane; nothing refreshes rows that no longer exist.
  //
  // The WIP is written with a NULL name when the build is unnamed. It used to
  // be written with the literal string 'working', which meant a user who saved
  // a build actually called `working` had every later unnamed session silently
  // adopt it as its slot.
  const writeWip = () => lsSet(WIP, envelope(slotName, spec, plaque, log));
  function rebuild() {
    api.apply(spec);
    writeWip();
  }

  // ---- the shelf --------------------------------------------------------
  // Load replaces the spec wholesale and rebuilds from it. It does NOT merge:
  // a build is a whole aeroplane, and merging one into another gives you a
  // third thing that nobody designed.
  //
  // ...and it now loads THE EDITOR TOO. That was the missing half: the game
  // rebuilt its aeroplane and the editor went on showing the page template, so
  // the next export overwrote the build you had just opened with the template
  // you never asked for. When the editor is up, the load runs back OUT through
  // the join as well, so the flying spec and the editor cannot disagree about
  // what you just opened — which is also how a stock design, whose file is a
  // cage and nothing else, arrives as a whole aeroplane.
  // A LOADED FILE IS NORMALISED ON THE WAY IN (G63). A build file may be
  // PARTIAL — a stock design is a cage and nothing else, a hand-written one
  // might be a paint and nothing else — and the generator fills the rest at
  // build time, so the aeroplane looked right. What was wrong was the spec the
  // shelf then held: it carried only the sections the file mentioned, so the
  // next export through the join had no paint, no name and no propeller to
  // preserve, and `update`'s whole point evaporated. Normalising here fills
  // every missing section from GEN_DEFAULT while KEEPING every derived null,
  // which is the one thing that must not be frozen.
  const whole = s => {
    try { return (typeof genNormaliseSpec === 'function') ? genNormaliseSpec(s) : s; }
    catch (e) { return s; }
  };
  function loadSpec(s, name, pq, lg) {
    spec = whole(s);
    slotName = name || '';
    plaque = pq || null;
    log = lg || newLog();
    // clampSpec runs inside the build, so an out-of-envelope or partial file
    // is pulled straight rather than refused — what flies is the honest
    // readout of what the file asked for.
    rebuild();
    const E = ed();
    if (E) {
      E.applySpec(spec);
      // ...and then straight back out through the join (G65), which also
      // FREEZES THE VISUAL. That is the declared G46 gap closed — "the visual
      // is not in the save, a reload flies the generated skin until the next
      // build & fly" — without a single mesh byte in localStorage: the save
      // carries `spec.cage`, the editor is seeded from it, and the snapshot is
      // regenerated from what the editor then built. Fix the construction,
      // not the output.
      if (typeof window.BUILD_SYNC === 'function') window.BUILD_SYNC();
      else { const J = join();
             if (J) { try { spec = merge(spec, J.export()); rebuild(); } catch (e) {} } }
    }
    fillSlots();
  }
  const slotSel = $('gSlot');
  const STOCK_TAG = '⚙ ';       // the shelf marks what it did not build
  function fillSlots() {
    if (!slotSel) return;
    const names = slotNames();
    slotSel.innerHTML = '';
    const opt = (v, t) => { const o = document.createElement('option');
                            o.value = v; o.textContent = t; slotSel.appendChild(o); };
    opt('', names.length ? '— designs —' : '— stock designs —');
    for (const s of STOCK) opt(STOCK_TAG + s.name, STOCK_TAG + s.name);
    for (const n of names) opt(n, n);
    slotSel.value = names.indexOf(slotName) >= 0 ? slotName : '';
    // storage unavailable is not an error worth a dialog, but the controls
    // should not pretend to work. The SELECT stays live either way — the stock
    // designs are in the bundle, not in storage.
    const dis = !LS;
    for (const id of ['gSave', 'gSaveAs', 'gDel'])
      if ($(id)) $(id).disabled = dis;
  }
  const saveAs = name => {
    if (!name) return;
    if (!log.built) log.built = new Date().toISOString().slice(0, 10);
    // NAMING IT IS NAMING IT (G65). The shelf's name and the aeroplane's own
    // `meta.name` were two different strings for one thing, so the plaque
    // headed a build "Garage Special" while the shelf called it yours. The
    // shelf row wins, because it is the one you typed.
    if (!spec.meta || typeof spec.meta !== 'object') spec.meta = {};
    spec.meta.name = name;
    if (!lsSet(SLOT + name, envelope(name, spec, plaque, log)))
      return void alert('Could not save — browser storage is full or disabled.');
    slotName = name;
    // the working build now belongs to a slot, and has to say so: that
    // association is what makes a reload come back as unsaved changes TO THIS
    // AEROPLANE rather than as an orphan.
    writeWip();
    fillSlots();
  };
  if (slotSel) slotSel.addEventListener('change', () => {
    const n = slotSel.value; if (!n) return;
    if (n.lastIndexOf(STOCK_TAG, 0) === 0) {
      const st = stockByName(n.slice(STOCK_TAG.length));
      // a stock design opens UNNAMED: it is a starting point, and the first
      // Save asks what you have made of it
      if (st) loadSpec(JSON.parse(JSON.stringify(st.spec)), '');
      return void fillSlots();
    }
    const txt = lsGet(SLOT + n);
    if (!txt) return void fillSlots();
    try { const g = unwrap(txt); loadSpec(g.spec, n, g.plaque, g.log); }
    catch (e) { alert('That saved build could not be read: ' + e.message); }
  });
  if ($('gSave')) $('gSave').addEventListener('click', () =>
    saveAs(slotName || (prompt('Name this aeroplane:', 'My aeroplane') || '').trim()));
  if ($('gSaveAs')) $('gSaveAs').addEventListener('click', () =>
    saveAs((prompt('Save as:', slotName || 'My aeroplane') || '').trim()));
  if ($('gDel')) $('gDel').addEventListener('click', () => {
    const n = slotSel && slotSel.value; if (!n) return;
    if (n.lastIndexOf(STOCK_TAG, 0) === 0) return;   // stock is not yours to delete
    if (!confirm('Delete the saved build "' + n + '"?')) return;
    lsDel(SLOT + n);
    if (slotName === n) slotName = '';
    fillSlots();
  });
  // EXPORT is a file, because a build you cannot hand to somebody else is not
  // really saved. The name is the build's, so a folder of them reads as a fleet.
  if ($('gExport')) $('gExport').addEventListener('click', () => {
    const name = slotName || 'flydiy-build';
    const blob = new Blob([envelope(name, spec, plaque, log)],
                          { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name.replace(/[^\w.-]+/g, '_') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  });
  const fileIn = $('gFile');
  const readFile = f => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const got = unwrap(String(r.result));
        loadSpec(got.spec, got.name || f.name.replace(/\.json$/i, ''),
                 got.plaque, got.log);
      } catch (e) { alert('That file is not a flyDiy build: ' + e.message); }
    };
    r.readAsText(f);
  };
  if ($('gImport') && fileIn) {
    $('gImport').addEventListener('click', () => { fileIn.value = ''; fileIn.click(); });
    fileIn.addEventListener('change', () => readFile(fileIn.files && fileIn.files[0]));
  }
  // drop a build anywhere on the shelf
  host.addEventListener('dragover', e => { e.preventDefault(); });
  host.addEventListener('drop', e => {
    e.preventDefault();
    readFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
  });
  fillSlots();

  // THE HANDLE THE COMMENT IN app.js ALWAYS CLAIMED EXISTED. It never did, and
  // that is precisely how a build ends up trapped in this closure with no way
  // to get it out. Now it is real: read it, set it, update it, save it, or
  // dump it.
  try {
    window.GARAGE_SPEC = {
      get: () => JSON.parse(JSON.stringify(spec)),
      set: s => loadSpec(JSON.parse(JSON.stringify(s)), slotName, plaque, log),
      // THE JOIN'S DOOR. Merges rather than replaces — see `merge` above.
      update: j => { spec = merge(spec, JSON.parse(JSON.stringify(j))); rebuild(); },
      resolved: () => api.resolved(),
      json: () => envelope(slotName || 'build', spec, plaque, log),
      list: slotNames,
      stock: () => STOCK.map(s => s.name),
      name: () => slotName,
      log: () => log,
      // the plaque and the logbook are WRITTEN here and read by the bench
      // (G64): one place a result about a build is kept, beside the build.
      // They persist WITHOUT rebuilding — a result is not a design change, and
      // routing it through `rebuild` would tear down and re-derive the whole
      // aeroplane every time a test wrote down what it found.
      plaque: v => (v === undefined ? plaque : (plaque = v, writeWip(), plaque)),
      note: row => { log.tests.push(row); writeWip(); },
      save: saveAs,
      load: n => { const t = lsGet(SLOT + n); if (!t) return;
                   const g = unwrap(t); loadSpec(g.spec, n, g.plaque, g.log); },
    };
  } catch (e) {}

  // the shelf only makes sense while the garage build is selected — but it
  // lives INSIDE the editor panel now, which is garage-only already, so this
  // only has to follow the aircraft select for the case where the panel is
  // left open over a fleet aeroplane.
  const acSel = $('selAc');
  const sync = () => { host.style.display = api.isGen() ? '' : 'none'; };
  if (acSel) acSel.addEventListener('change', () => setTimeout(sync, 0));
  sync();
}
