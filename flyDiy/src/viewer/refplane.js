// refplane.js — THE REFERENCE PLANE (G89-G92, ROADMAP F1).
//
// A real aeroplane, standing in the shed beside the one you are building, so
// you can build a PARTICULAR aeroplane instead of an aeroplane-shaped one. It
// is the ROADMAP's "3D model import instead of blueprints", and it lands here
// rather than in the bench because the editor IS the garage screen (G35/G78).
//
// ---------------------------------------------------------------------------
// ONE ROOT, AND THIS FILE IS WHERE THAT RULE IS MOST LIKELY TO ROT.
//
// The 2026-08-08 scope decision (HANDOVER line 1074) says it plainly: "the
// spec is the source of truth and the mesh is never an input". A model you can
// measure against is one small step from a model you can build FROM, and that
// step would quietly make the mesh an input to the aeroplane. So:
//
//   THIS FILE NEVER WRITES THE SPEC. It does not touch GARAGE_SPEC, it does
//   not call setParam, it does not reach cageToSpec or BUILD_SYNC, and no
//   value it holds ever enters CAGE_UI.P or a save file. Its whole state is
//   display state and lives in one localStorage key.
//
// GATE REF asserts that by READING THIS FILE'S OWN SOURCE, so it is a checked
// property rather than a promise in a comment.
// ---------------------------------------------------------------------------
//
// WHAT THE ROADMAP ENTRY GOT WRONG, and it is why this started cheap: there is
// no GLB to load, and r128 loads none — no loader is vendored anywhere in the
// project. The Cub and the C172 are ALREADY BAKED payloads (MODEL_PA18 /
// MODEL_C172, src/models/), already inlined in the artifact, already decoded
// by decodeModel for the flight side. Those two cost ZERO NEW BYTES.
//
// AND THAT IS NO LONGER THE WHOLE STORY (G138). The seven aeroplanes added
// beside them are here ONLY to be looked at — nothing else in the game flies
// them, so every byte they carry is a byte the reference itself is spending.
// They are baked by tools/ref_prep.py, which exists precisely because a
// reference needs so much less than a flyable aeroplane: no control surfaces,
// no hinge lines, no sid tags, no hub. Their cost, and which of them the
// ARTIFACT can afford to carry, is a build decision — see build.js
// MANIFEST.models and GATE REF's licence check.
//
// THE SIT IS COMPUTED, NEVER READ. Measured on decode: the C172's frame has
// minY = +0.0098 (it sits on its wheels) and the PA-18's has minY = -1.3516
// (it does not). So "rests on its wheels like ours" is groundY - bb.min.y, off
// the decoded box, every time. The SKIN_CFG mount offsets in app.js are the
// wrong tool here — those are calibrated for the FLIGHT body frame, where the
// model is bound to a node truss.
//
// THE ROWS ARE HAND-BUILT, and that is deliberate. They use _cage_ui.js's own
// DOM grammar (div.r > span.k + control) so they read identically and inherit
// editor.css for free, but they are NOT _cage_ui rows: they never enter P,
// never trigger a build, and never appear in the part table. Four sessions
// share this tree and _cage_ui.js is live in three of them.

(function () {
'use strict';

// ===========================================================================
// THE DECLARED TABLE, and the pure math over it. Everything above the node
// guard runs in node with no THREE and no DOM, which is what lets GATE REF be
// a real verdict instead of a smoke test.
// ===========================================================================

// `pub` is what the aeroplane ACTUALLY MEASURES in the world, from its type
// certificate — not what the model measures. GATE REF holds the decoded box
// against these, and that check is what makes the scale slider and the
// match-a-dimension solver trustworthy: a mis-declared preset would silently
// corrupt every measurement anyone ever took against it.
//
// HEIGHT IS DELIBERATELY ABSENT. The PA-18's payload y-extent reads 2.699 m
// against a published 2.02 m, because its frame is not wheels-at-zero and the
// extent is not measured from the ground. A height here would be a number that
// does not mean what it says, and the panel reports it as measured rather than
// checking it.
//
// `sit` IS THE GROUND ATTITUDE, in degrees nose-up, and it exists because a
// payload is modelled in whatever attitude the modeller drew it in. Measured
// off the lower convex hull of each payload (see refLowerHull), as the pitch
// that puts the aeroplane's two contact patches on ONE plane:
//
//   PA-18   main wheel  x -1.85  y -1.347      tailwheel  x 3.22  y -0.262
//           1.085 m apart over a 5.07 m base -> 12.09 deg nose-up
//   C172    nose wheel  x -2.99  y  0.010      mains      x -1.25  y  0.016
//           6 mm over 1.74 m -> 0.20 deg, i.e. drawn on the ground already
//
// That is the whole of the user's report: the Cub is drawn FUSELAGE-LEVEL, so
// dropping its bounding box put the mains on the floor and left the tailwheel
// a metre in the air. The C172 is the case the old formula was written for.
// Declared here rather than derived at runtime, and GATE REF re-derives it
// from the payload and holds the declaration to it — the same contract `pub`
// has, for the same reason: a number nothing checks is a number that rots.
//
// `node tools/_ref_sit.js [key]` IS THE INSTRUMENT that produces these numbers
// (G138), and it deliberately writes nothing: it lists EVERY local maximum of
// the stance and leaves the choice to a person. It has to, because the widest
// stance is not the parked one — the C172's widest is 12.22 deg nose-up, where
// it balances on its mains and the bottom of its tailcone over 5.1 m, half a
// metre wider than the 1.83 m nose-to-mains stance it actually parks on. The
// reading is: a taildragger's pair is mains-forward + tailwheel-aft, several
// degrees nose-up; a tricycle's is nosewheel-forward + mains-aft, near level.
//
// `pub.tol` is a PER-ROW tolerance on the scale check, and it exists for one
// aeroplane. Most types have one published span; the Pioneer 200 has three
// (7.30 / 7.55 / 7.65 m) and three lengths (6.09 / 6.15 / 6.20 m), because
// nobody agrees. Widening the global tolerance to swallow that would weaken
// the check for the other eight, and quietly picking whichever published pair
// the model happens to match would be measuring the ruler with the object. So
// the row declares the disagreement, in `pub.note`, and buys exactly as much
// slack as the disagreement is worth. GATE REF requires a note wherever there
// is a tol — a loosened check with no reason on it is the one that rots.
var REF_PRESETS = [
  { key: 'none', name: '— none —', model: null },
  { key: 'pa18', name: 'Piper PA-18 Super Cub', model: 'pa18',
    pub: { span: 10.73, len: 6.88 }, sit: { pitch: 12.09 } },
  { key: 'c172', name: 'Cessna 172', model: 'c172',
    pub: { span: 11.00, len: 8.28 }, sit: { pitch: 0.20 } },
  // ---- helijah's aeroplanes (G138). Sit pitches derived by tools/_ref_sit.js
  // off each payload's own lower hull, then declared here; GATE REF re-derives
  // them. Some park level on a nosewheel and some are taildraggers, which is
  // the whole reason the sit is computed at all.
  // FOUR ROWS DELETED 2026-09-01 (a22, p68, rv8, sr22): their listings said
  // "SKETCHFAB Standard", which never permits redistribution, so the user had
  // their GLBs, payloads and presets removed outright — see ref_table.py.
  { key: 'd112', name: 'Jodel D.112', model: 'd112',
    pub: { span: 8.22, len: 6.50 }, sit: { pitch: 7.72 } },
  { key: 'pio200', name: 'Alpi Pioneer 200', model: 'pio200',
    pub: { span: 7.55, len: 6.15, tol: 0.025,
           note: 'published sources disagree: span 7.30 / 7.55 / 7.65 m, ' +
                 'length 6.09 / 6.15 / 6.20 m. The model is inside that ' +
                 'spread; the spread is wider than the model is wrong.' },
    sit: { pitch: 0.33 } },
  { key: 'c195', name: 'Cessna 195 Businessliner', model: 'c195',
    pub: { span: 11.02, len: 8.33 }, sit: { pitch: 14.15 } },
  // ---- the second batch (G142), seven of the user's eight. The eighth is
  // DRACO, and it is baked but has NO PRESET: Mike Patey's turbine Wilga is a
  // one-off with a lengthened nose and a re-spanned wing, and nobody has ever
  // published its dimensions. Against the stock Wilga 2000 the model is 12%
  // long, which is not an error — it is a different aeroplane. A reference
  // whose scale nothing can hold is worse than no reference at all, because
  // every measurement taken against it is confidently wrong. See
  // tools/ref_table.py's `draco` row.
  { key: 'da40', name: 'Diamond DA40', model: 'da40',
    pub: { span: 11.90, len: 8.10 }, sit: { pitch: 2.76 } },
  { key: 'g115', name: 'Grob G 115', model: 'g115',
    pub: { span: 10.00, len: 7.79,
           note: 'the G115E/Tutor figures — the model is the long-nosed E, ' +
                 'and the early upright-fin G115/G115A is shorter.' },
    sit: { pitch: -0.04 } },
  { key: 'stemme', name: 'Stemme S6 Sky Sportster', model: 'stemme',
    pub: { span: 18.00, len: 8.52 }, sit: { pitch: 0.01 } },
  { key: 'guepard', name: 'Super Guépard 912', model: 'guepard',
    pub: { span: 9.70, len: 6.00,
           note: 'the manufacturer/ULM-press figures (span 9.70 m, "six ' +
                 'metres to the tail"). English Wikipedia says 8.5 m span, ' +
                 'which is 15% under this model and under every French ' +
                 'source; it is the outlier, not the model.' },
    sit: { pitch: -0.41 } },
  { key: 'yak18t', name: 'Yakovlev Yak-18T', model: 'yak18t',
    pub: { span: 11.16, len: 8.354 }, sit: { pitch: 0.58 } },
  { key: 'eiii', name: 'Fokker E.III Eindecker', model: 'eiii',
    pub: { span: 9.52, len: 7.20 }, sit: { pitch: 10.01 } },
  { key: 'pa28', name: 'Piper PA-28-161 Cadet', model: 'pa28',
    pub: { span: 10.67, len: 7.25 }, sit: { pitch: 0.00 } },
];

// THE SIT. The reference's lowest point lands on the floor the build stands
// on. `trim` is the user's own correction on top, and it is a separate term on
// purpose: "sit on wheels" has to be able to zero it without losing the drop.
//
// `lowY` is the lowest point AT THE ATTITUDE THE AEROPLANE IS IN — see
// refLowestY. It used to be the authored box's own min y, which is only the
// same thing for an aeroplane drawn sitting level on its wheels.
function refSitY(lowY, scale, groundY, trim) {
  return groundY - lowY * scale + (trim || 0);
}

// THE LOWER CONVEX HULL of the payload projected onto (x = fore/aft, y = up).
// A pitch changes which point is lowest, and re-walking 120 000 vertices on
// every pixel of a slider drag to find out would be silly — the minimum of a
// linear functional over a point set is always attained ON THE HULL, so this
// is computed once at build time and the runtime answer is a loop over ~30
// points. Monotone chain, lower half only; returns [[x, y], ...] left to right.
function refLowerHull(dec) {
  var pts = [], g, p, i;
  for (g in dec) {
    p = dec[g].pos;
    for (i = 0; i < p.length; i += 3) pts.push([p[i], p[i + 1]]);
  }
  if (!pts.length) return null;
  pts.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
  var h = [];
  var cross = function (o, a, b) {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  };
  for (i = 0; i < pts.length; i++) {
    while (h.length >= 2 &&
           cross(h[h.length - 2], h[h.length - 1], pts[i]) <= 0) h.pop();
    h.push(pts[i]);
  }
  return h;
}

// THE LOWEST POINT AT A GIVEN ATTITUDE, in the payload's own units.
// The model frame is x AFT, y UP, z LEFT, so a PITCH is a rotation about z —
// which is what `place` applies. Nose-up positive means the nose (x negative)
// rises, so the rotated height is y*cos - x*sin. At pitch 0 this is exactly
// the old bb.min.y, which is what makes the change invisible for a payload
// that really was drawn on its wheels.
function refLowestY(hull, pitchDeg) {
  if (!hull || !hull.length) return 0;
  var t = (pitchDeg || 0) * Math.PI / 180;
  var c = Math.cos(t), s = Math.sin(t), lo = 1e9, i, v;
  for (i = 0; i < hull.length; i++) {
    v = hull[i][1] * c - hull[i][0] * s;
    if (v < lo) lo = v;
  }
  return lo;
}

// the declared ground attitude of a preset, in degrees nose-up. 0 for a preset
// that declares none — which is the old behaviour, not a guess dressed up.
function refSitPitch(preset) {
  return (preset && preset.sit && typeof preset.sit.pitch === 'number')
    ? preset.sit.pitch : 0;
}

// MATCH A DIMENSION. You know the aeroplane's span; the model measures
// something else; this is the scale that closes the gap. Faster and more
// honest than dragging a slider against a number you already have.
function refMatchScale(targetM, measuredAtScale1) {
  if (!(targetM > 0) || !(measuredAtScale1 > 0)) return null;
  return targetM / measuredAtScale1;
}

// metres / feet-inches / inches. A four-line copy of _cage_ui.js:650, which is
// closed over inside that file and not exported. COPIED rather than exported
// because _cage_ui.js is live in three other sessions, and a merge conflict
// there costs more than four lines do. OWED: lift both to one place when the
// tree quiets down.
function refFmtLen(m) {
  var ti = Math.round(m / 0.0254), ft = Math.floor(ti / 12), inch = ti % 12;
  return { m: m.toFixed(2) + ' m', imp: ft + '′ ' + inch + '″',
           inch: ti + '″' };
}

// the box of a decoded payload, in its own frame, at scale 1.
// Model frame is x AFT, y UP, z LEFT — so LENGTH is x and SPAN is z.
function refDecodedBox(dec) {
  var lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], any = false;
  for (var g in dec) {
    var p = dec[g].pos;
    for (var i = 0; i < p.length; i += 3) {
      any = true;
      for (var c = 0; c < 3; c++) {
        if (p[i + c] < lo[c]) lo[c] = p[i + c];
        if (p[i + c] > hi[c]) hi[c] = p[i + c];
      }
    }
  }
  if (!any) return null;
  return { min: lo, max: hi,
           len: hi[0] - lo[0], hgt: hi[1] - lo[1], span: hi[2] - lo[2] };
}

// ---- the node half ends here ---------------------------------------------
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { REF_PRESETS: REF_PRESETS, refSitY: refSitY,
                     refMatchScale: refMatchScale, refFmtLen: refFmtLen,
                     refDecodedBox: refDecodedBox, refLowerHull: refLowerHull,
                     refLowestY: refLowestY, refSitPitch: refSitPitch };
  return;
}

// ===========================================================================
// THE VIEWER HALF
// ===========================================================================

var LS = 'flydiy.ref';          // display state, and ONLY display state
var MODES = [['clay', 'white clay'], ['authored', 'as authored'],
             ['ghost', 'ghost'], ['wire', 'wireframe']];

// THE CUT (G142, user: "a view where half of our lane is cutout, but the
// other half compared to the reference plane").
//
//   'off'    two whole aeroplanes, one standing beside or inside the other.
//   'ref'    the REFERENCE loses its right half. What the G91 checkbox did.
//   'split'  ONE AEROPLANE, HALF EACH. The reference keeps its left half and
//            the build loses its left half, so the two meet on the centreline
//            and you are looking at a single composite machine: your cowl and
//            their cowl in the same photograph, sharing a spine.
//
// WHY THAT IS WORTH A MODE OF ITS OWN, and not just two checkboxes. Comparing
// two overlaid aeroplanes is comparing two silhouettes and hoping; comparing
// two HALVES of one aeroplane puts every difference on a seam a few
// centimetres wide, where the eye is extremely good. A canopy 40 mm too tall
// is invisible as a ghost and unmissable as a step in a roofline.
//
// BOTH HALVES ARE CUT BY THE SAME WORLD PLANE, z = 0, and that only means
// anything because both aeroplanes are symmetric about it: the build's mount
// is turned to face -x so its own centreline lies on z = 0, and every
// reference payload is z-symmetric to the millimetre (GATE REF asserts it —
// the one delivered model that was not is the Guepard, whose frame was
// translated, and it is corrected in the bake rather than here).
var CUTS = [['off', 'off'],
            ['ref', 'reference: left half only'],
            ['split', 'split: your right, theirs left']];

// the whole of this feature's state. None of it is the aeroplane's.
var S = {
  preset: 'none', scale: 1,
  fore: 0, lat: 0, trim: 0, yaw: 0, pitch: 0,
  mode: 'clay', alpha: 1, occlude: false, cut: 'off', half: false, showBox: false,
  off: {},                      // matKey -> true when hidden
  matA: {},                     // matKey -> its own alpha
};
try {
  var raw = localStorage.getItem(LS);
  if (raw) {
    var j = JSON.parse(raw);
    for (var k in j) if (k in S) S[k] = j[k];
    // the G91 checkbox became a three-way (G142). A save written before that
    // carries `half` and no `cut`, and losing somebody's half-view because the
    // control grew a third option would be a rude way to ship a feature.
    if (j.half && !j.cut) S.cut = 'ref';
  }
} catch (e) { /* a private window is not a reason to have no reference */ }
function save() {
  try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {}
}

var body = null;                // THREE.Group holding the meshes, under refSit
var built = null;               // { key, model, dec, payload, box, mats, meshes }
var texCache = {};              // model key -> { texName: Texture }
var panelEl = null, dimsEl = null, matsEl = null;
// G153: WHAT THE PANEL SAYS WHILE THE BYTES ARE IN THE AIR. Since G149 the
// geometry is an external file, so a preset lands a beat after you pick it —
// and on a slow link, several beats. Throughout that the panel said
// "No reference standing.", which is a statement about the AEROPLANE and reads
// as "that one is not available". These two make it a statement about the
// PANEL instead, and give a failed fetch its own words rather than letting it
// look identical to having picked nothing.
var loadingKey = null;          // the preset whose bytes are in flight
var failedKey = null;           // ...and one whose fetch came back empty
var boxHelper = null, CLIP = null, CLIP_B = null;

function M() { return window.REF_MOUNT || null; }

function presetOf(key) {
  for (var i = 0; i < REF_PRESETS.length; i++)
    if (REF_PRESETS[i].key === key) return REF_PRESETS[i];
  return null;
}

// ===========================================================================
// BUILD. One mesh per payload group, one material per NAMED MATERIAL, sharing
// the payload's own typed arrays. The reference is rigid and never writes to
// them — no skin flex, no hinges, no per-frame work of any kind — so the
// geometry costs nothing beyond the decode the flight side was going to do.
// ===========================================================================

// the same resolution app.js's own grpMat does for imported payloads
function matKeyOf(payload, name) {
  var g = payload.groups[name];
  return (payload.texs && g && g.mat) || (name === 'glass' ? 'glass' : 'skin');
}

function disposeBuilt() {
  var m = M();
  if (boxHelper) {
    if (boxHelper.parent) boxHelper.parent.remove(boxHelper);
    boxHelper.geometry.dispose(); boxHelper = null;
  }
  if (!body) { built = null; return; }
  body.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
  if (built) for (var mk in built.mats) built.mats[mk].dispose();
  if (m) m.group.remove(body);
  body = null; built = null;
}

function build(key) {
  disposeBuilt();
  // G153: a new ask clears the last one's verdict — a stale "could not be
  // loaded" under a different aeroplane's name is worse than no note at all.
  failedKey = null;
  if (loadingKey !== key) loadingKey = null;
  var pre = presetOf(key);
  if (!pre || !pre.model) {
    var m0 = M();
    if (m0) {
      m0.group.visible = false;
      // AND GIVE THE BUILD ITS OTHER HALF BACK. With no reference standing
      // there is nothing for the missing half to be compared against, so a
      // build left cut open would just be a broken aeroplane — and the control
      // that did it is on a panel that is no longer showing anything.
      if (m0.setBuildClip) m0.setBuildClip(null);
      if (m0.setClipping) m0.setClipping(false);
    }
    return;
  }
  // THE ONE DECODE (G89, app.js). Never decodeModel() from here: the payload's
  // b64 is destroyed by whoever decodes first, so a second independent decode
  // works or does not depending on whether you have flown that aeroplane yet.
  if (typeof window.MODEL_DECODE !== 'function') return;
  var dec = window.MODEL_DECODE(pre.model);
  var payload = window.MODEL_PAYLOAD(pre.model);
  // EXTERNAL GEOMETRY (2026-09-01): a payload that names a bin may not have
  // its bytes yet — decode says null, MODEL_LOAD owns the fetch. Build again
  // when they land, IF this preset is still the one asked for (the user may
  // have moved on) and nothing built it meanwhile. A null resolve is a failed
  // fetch: the aeroplane is absent, exactly as if it had not shipped.
  if (!dec && payload && payload.bin && typeof window.MODEL_LOAD === 'function') {
    loadingKey = key; failedKey = null; paintDims();
    window.MODEL_LOAD(pre.model).then(function (d2) {
      if (loadingKey === key) loadingKey = null;
      // the user may have moved on, or something may have built it meanwhile:
      // in both cases this resolve is stale and only the status is repainted
      if (S.preset !== key || built) { paintDims(); return; }
      if (!d2) { failedKey = key; paintDims(); return; }
      build(key); paintMats(); paintDims();
    });
    return;
  }
  if (!dec || !payload) return;

  body = new THREE.Group();
  var mats = {}, meshes = [];
  for (var name in dec) {
    var g = dec[name];
    var mk = matKeyOf(payload, name);
    if (!mats[mk]) mats[mk] = new THREE.MeshStandardMaterial({ name: 'ref:' + mk });
    var geo = new THREE.BufferGeometry();
    // NOT a copy: nothing here ever mutates a position, so the reference and
    // the flight model share one set of arrays and the second aeroplane in
    // the room costs no geometry memory at all.
    geo.setAttribute('position', new THREE.BufferAttribute(g.pos, 3));
    if (g.uv) geo.setAttribute('uv', new THREE.BufferAttribute(g.uv, 2));
    geo.setIndex(new THREE.BufferAttribute(g.idx, 1));
    geo.computeVertexNormals();
    var mesh = new THREE.Mesh(geo, mats[mk]);
    mesh.frustumCulled = false;
    mesh.userData.refMat = mk;
    body.add(mesh);
    meshes.push(mesh);
  }
  // the hull is computed ONCE here, beside the box, for exactly the same
  // reason the box is: `place` runs on every pixel of a slider drag.
  built = { key: key, model: pre.model, dec: dec, payload: payload,
            box: refDecodedBox(dec), hull: refLowerHull(dec),
            sitPitch: refSitPitch(pre), mats: mats, meshes: meshes };
  var m = M();
  if (m) m.group.add(body);
  applyFinish();
  place();
}

// ---- textures (lazy, and only for `as authored`) --------------------------
// White clay is the DEFAULT because it is what a reference actually wants, and
// because the C172 carries 18 maps there is no reason to decode until somebody
// asks to see the livery.
function loadTexs(modelKey, payload, done) {
  if (texCache[modelKey]) return done(texCache[modelKey]);
  var out = {}, srcs = payload.texs || {}, n = 0, t;
  for (t in srcs) n++;
  texCache[modelKey] = out;
  if (!n) return done(out);
  var landed = function () { if (--n <= 0) done(out); };
  for (t in srcs) {
    out[t] = new THREE.TextureLoader().load(srcs[t], landed, undefined, landed);
    out[t].anisotropy = window.FLYDIY_ANISO || 4;
  }
}

// ===========================================================================
// FINISH
// ===========================================================================
function applyFinish() {
  if (!built) return;
  var mt = built.payload.mats || {}, m = M();
  var wantClip = S.cut !== 'off';
  if (wantClip && !CLIP) {
    // the model frame has z LEFT, so a plane with normal +z and constant 0
    // keeps the aeroplane's LEFT half and cuts the right away
    CLIP = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    // ...and its opposite, which is the half the BUILD keeps. Same plane,
    // other side: together they tile the world exactly once, so the composite
    // has no gap down its spine and no double-drawn sliver.
    CLIP_B = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
  }
  // clipping is a RENDERER setting; app.js owns the touch and it is on only
  // while this view is asked for
  if (m && m.setClipping) m.setClipping(wantClip);
  // AND THE BUILD'S HALF, WHICH IS THE MOUNT'S TO CUT AND NOT OURS (G142).
  // refplane.js may not reach the editor's materials — see ONE ROOT — so the
  // split is a request, and app.js is the only thing that touches them.
  if (m && m.setBuildClip)
    m.setBuildClip(S.cut === 'split' ? [CLIP_B] : null);

  for (var mk in built.mats) {
    var mat = built.mats[mk], decl = mt[mk] || {};
    var own = (S.matA[mk] != null) ? S.matA[mk]
            : (decl.opacity != null ? decl.opacity : 1);
    var a = own * S.alpha;

    mat.wireframe = (S.mode === 'wire');
    mat.side = THREE.DoubleSide;
    mat.clippingPlanes = wantClip ? [CLIP] : null;
    mat.map = null;

    if (S.mode === 'authored') {
      mat.color.setHex(decl.color != null ? decl.color : 0xffffff);
      mat.roughness = decl.rough != null ? decl.rough : 0.7;
      mat.metalness = decl.metal != null ? decl.metal : 0;
      var tx = texCache[built.model];
      if (tx && decl.tex && tx[decl.tex]) {
        mat.map = tx[decl.tex];
        mat.color.setHex(0xffffff);
      }
    } else {
      // clay, ghost and wireframe are all ONE COLOUR — the point of a
      // reference is its SHAPE, and a livery is the thing most likely to stop
      // you seeing it. This is the "all white materials" the feature was
      // asked for; `glass` keeps its own alpha through the materials rows,
      // which is the other half of that sentence.
      mat.color.setHex(S.mode === 'ghost' ? 0x9fd0ff : 0xf2f2f2);
      mat.roughness = 0.85;
      mat.metalness = 0;
      if (S.mode === 'ghost') a = Math.min(a, 0.45);
    }

    mat.opacity = a;
    mat.transparent = a < 0.999;
    // OCCLUDES OFF is what makes it a ghost you can read your build through;
    // on, it hides what is behind it, which is what you want when you are
    // comparing a silhouette rather than tracing inside one.
    mat.depthWrite = S.occlude ? true : !mat.transparent;
    mat.visible = !S.off[mk];
    mat.needsUpdate = true;
  }
  for (var i = 0; i < built.meshes.length; i++) {
    var msh = built.meshes[i];
    msh.visible = !S.off[msh.userData.refMat];
    msh.renderOrder = built.mats[msh.userData.refMat].transparent ? 3 : 0;
  }
  if (S.mode === 'authored' && !texCache[built.model]) {
    var want = built.model;
    loadTexs(want, built.payload, function () {
      if (built && built.model === want && S.mode === 'authored') applyFinish();
    });
  }
}

// ===========================================================================
// PLACE
// ===========================================================================
function place() {
  var m = M();
  if (!m) return;
  var g = m.group;
  if (!built || !built.box) { g.visible = false; paintDims(); return; }
  g.visible = true;
  body.scale.setScalar(S.scale);
  // A PITCH IS A ROTATION ABOUT Z, and it was about X. The model frame is
  // x AFT, y UP, z LEFT (refDecodedBox says so: length is x, span is z), so
  // rotation.x turns the wings — the "pitch trim" slider was rolling the
  // aeroplane. About z, and negated because +z points LEFT, so a positive
  // rotation drops the nose and we want nose-up positive.
  var pitch = built.sitPitch + S.pitch;
  body.rotation.set(0, 0, -pitch * Math.PI / 180);
  g.rotation.set(0, S.yaw * Math.PI / 180, 0);
  // The model frame is x AFT, so its nose already points at -x — the door, the
  // way the game craft noses. That is why this mount has NO base yaw where the
  // editor's own has -PI/2: the cage builds z-forward and has to be turned;
  // an imported aeroplane does not.
  // fore/aft is therefore the room's -x, and lateral is z.
  // AND THE DROP FOLLOWS THE ATTITUDE. Dropping the AUTHORED box's floor is
  // only right for a payload drawn sitting level on its wheels; the Cub is
  // drawn fuselage-level, so that put its mains down and its tailwheel a
  // metre up (user, 2026-08-31: "the piper cub reference plane is not resting
  // on its wheels").
  g.position.set(-S.fore,
                 refSitY(refLowestY(built.hull, pitch), S.scale,
                         m.groundY(), S.trim),
                 S.lat);
  drawBox();
  paintDims();
}

function drawBox() {
  var m = M();
  if (!m) return;
  if (boxHelper) {
    if (boxHelper.parent) boxHelper.parent.remove(boxHelper);
    boxHelper.geometry.dispose(); boxHelper = null;
  }
  if (!built || !body || !S.showBox || !m.group.visible) return;
  m.group.updateMatrixWorld(true);
  var b = new THREE.Box3().setFromObject(body);
  if (!isFinite(b.min.x) || b.min.x > b.max.x) return;
  // AMBER, and not the build's own 0x5db3ff blue. Two boxes in one room is
  // exactly the situation where "which one is that" must never be a question.
  boxHelper = new THREE.Box3Helper(b, 0xffb020);
  boxHelper.material.transparent = true;
  boxHelper.material.opacity = 0.75;
  boxHelper.material.depthTest = false;
  if (m.group.parent) m.group.parent.add(boxHelper);
}

// ===========================================================================
// THE PANEL. Hand-built, in _cage_ui.js's row grammar, owning nothing of the
// aeroplane.
// ===========================================================================
function el(tag, cls, html) {
  var d = document.createElement(tag);
  if (cls) d.className = cls;
  if (html != null) d.innerHTML = html;
  return d;
}
function head(host, name, meta) {
  var h = el('div', 'edH');
  h.appendChild(el('span', null, name));
  h.appendChild(el('i'));
  h.appendChild(el('em', null, meta || ''));
  host.appendChild(h);
  return h;
}
function row(host, label) {
  var d = el('div', 'r');
  d.appendChild(el('span', 'k', label));
  host.appendChild(d);
  return d;
}
// `dflt` is what double-clicking the label goes back to — the same gesture the
// editor's own rows have carried since G27. It is a parameter and not a
// hardcoded zero because "reset the scale" is 1, not 0, and a scale of 0 is an
// aeroplane you cannot see.
function slider(host, label, lo, hi, step, dflt, get, set, fmt) {
  var d = row(host, label);
  var i = document.createElement('input');
  i.type = 'range'; i.min = lo; i.max = hi; i.step = step; i.value = get();
  var v = el('span', 'v', fmt(get()));
  var fire = function () {
    var n = parseFloat(i.value);
    set(n); v.textContent = fmt(n); save(); place();
  };
  i.oninput = fire;
  d.firstChild.ondblclick = function () { i.value = dflt; fire(); };
  d.appendChild(i); d.appendChild(v);
  return i;
}
function check(host, label, get, set) {
  var d = row(host, label);
  var i = document.createElement('input');
  i.type = 'checkbox'; i.checked = !!get();
  i.onchange = function () { set(i.checked); save(); applyFinish(); place(); };
  d.appendChild(i);
  return i;
}
function pill(host, label, fn, title) {
  var b = el('button', 'pill', label);
  if (title) b.title = title;
  b.onclick = fn;
  host.appendChild(b);
  return b;
}

function paintMats() {
  if (!matsEl) return;
  matsEl.textContent = '';
  if (!built) {
    matsEl.appendChild(el('div', 'refNote', 'Pick an aeroplane first.'));
    return;
  }
  var mt = built.payload.mats || {};
  var keys = Object.keys(built.mats).sort();
  keys.forEach(function (mk) {
    var d = row(matsEl, mk);
    var c = document.createElement('input');
    c.type = 'checkbox'; c.checked = !S.off[mk];
    c.onchange = function () {
      if (c.checked) delete S.off[mk]; else S.off[mk] = true;
      save(); applyFinish();
    };
    var decl = mt[mk] || {};
    var a = document.createElement('input');
    a.type = 'range'; a.min = 0; a.max = 1; a.step = 0.05;
    a.value = (S.matA[mk] != null) ? S.matA[mk]
            : (decl.opacity != null ? decl.opacity : 1);
    var v = el('span', 'v', (+a.value).toFixed(2));
    a.oninput = function () {
      S.matA[mk] = parseFloat(a.value);
      v.textContent = (+a.value).toFixed(2);
      save(); applyFinish();
    };
    d.appendChild(c); d.appendChild(a); d.appendChild(v);
  });
}

function paintDims() {
  if (!dimsEl) return;
  if (!built || !built.box) {
    // G153: three different silences, told apart. Names come from REF_PRESETS,
    // our own declared table, so they are safe to write into the note.
    var w = presetOf(loadingKey || failedKey);
    var nm = w ? w.name : '';
    dimsEl.innerHTML = '<div class="refNote">' +
      (loadingKey ? 'Loading ' + nm + '…'
       : failedKey ? nm + ' could not be loaded.'
       : 'No reference standing.') + '</div>';
    return;
  }
  var b = built.box, s = S.scale, m = M();
  var r = function (label, val) {
    var f = refFmtLen(val);
    return '<div class="refD"><span>' + label + '</span><b>' + f.m +
           '</b><i>' + f.imp + '</i><em>' + f.inch + '</em></div>';
  };

  // SPAN AND LENGTH COME FROM THE MODEL FRAME, not from the world box, so
  // they stay true when the reference is yawed — a turned aeroplane is not a
  // longer one. HEIGHT IS MEASURED FROM THE FLOOR, which is what height means
  // for something standing on the ground, and is the only definition under
  // which the two tables below compare like with like: the build's own cage
  // reaches ~0.22 m BELOW the wheels it stands on, so its box height and the
  // reference's box height are not the same measurement.
  var gy = m ? m.groundY() : 0;
  var refTop = null;
  if (body) {
    body.updateMatrixWorld(true);
    var rb = new THREE.Box3().setFromObject(body);
    if (isFinite(rb.max.y)) refTop = rb.max.y - gy;
  }
  var html = '<div class="refCap">REFERENCE</div>' +
    r('span', b.span * s) + r('length', b.len * s) +
    r('height', refTop != null ? refTop : b.hgt * s);

  // THE DISCREPANCY LINE. This is the number the whole feature exists to move,
  // so it is not buried: your build beside the reference, and the gap.
  var bb = m && m.buildBox && m.buildBox();
  if (bb) {
    // The build stands turned 90 deg into the room (edSit's -PI/2 maps the
    // cage's +z-forward onto world -x), so in WORLD axes its LENGTH is x and
    // its SPAN is z — the same two axes the reference reports above.
    var mine = { span: bb.max.z - bb.min.z, len: bb.max.x - bb.min.x,
                 hgt: bb.max.y - gy };
    var dl = function (label, ours, theirs) {
      var d2 = ours - theirs, sg = d2 >= 0 ? '+' : '−';
      var pc = theirs ? sg + (Math.abs(d2) / theirs * 100).toFixed(1) + '%' : '';
      return '<div class="refD"><span>' + label + '</span><b>' +
        ours.toFixed(2) + ' m</b><i>' + sg + Math.abs(d2).toFixed(2) +
        ' m</i><em>' + pc + '</em></div>';
    };
    html += '<div class="refCap">YOUR BUILD, AND THE GAP</div>' +
      dl('span', mine.span, b.span * s) +
      dl('length', mine.len, b.len * s) +
      dl('height', mine.hgt, refTop != null ? refTop : b.hgt * s);
  }
  var pre = presetOf(S.preset);
  if (pre && pre.pub) {
    var out = Math.abs(b.span - pre.pub.span) / pre.pub.span * 100;
    html += '<div class="refNote">published ' + pre.pub.span.toFixed(2) +
      ' m span · the model measures ' + b.span.toFixed(3) + ' m (' +
      out.toFixed(2) + '% out) · scale ×' + s.toFixed(3) + '</div>';
  }
  dimsEl.innerHTML = html;
}

function buildPanel() {
  var host = el('div');
  host.id = 'edRef';

  head(host, 'reference', 'display only · never the spec');
  var pr = row(host, 'aeroplane');
  var sel = document.createElement('select');
  // ONLY WHAT SHIPPED. build.js MANIFEST.models decides which payloads the
  // artifact carries, and the table here lists every aeroplane that HAS one
  // baked — the two are allowed to differ, so the list is filtered against
  // what actually loaded rather than promising a row that would select
  // nothing. A saved preset whose payload is gone falls back to none.
  var have = function (key) {
    return !key || (typeof window.MODEL_PAYLOAD === 'function' &&
                    !!window.MODEL_PAYLOAD(key));
  };
  REF_PRESETS.forEach(function (p) {
    if (!have(p.model)) return;
    var o = document.createElement('option');
    o.value = p.key; o.textContent = p.name;
    sel.appendChild(o);
  });
  if (!have((presetOf(S.preset) || {}).model)) S.preset = 'none';
  sel.value = S.preset;
  sel.onchange = function () {
    S.preset = sel.value; save();
    build(S.preset); paintMats(); paintDims();
    if (typeof window.REF_ON_CHANGE === 'function') window.REF_ON_CHANGE();
  };
  pr.appendChild(sel);

  head(host, 'placement', 'metres, from where your build stands');
  slider(host, 'fore/aft', -6, 6, 0.01, 0,
    function () { return S.fore; }, function (v) { S.fore = v; },
    function (v) { return v.toFixed(2) + ' m'; });
  slider(host, 'lateral', -4, 4, 0.01, 0,
    function () { return S.lat; }, function (v) { S.lat = v; },
    function (v) { return v.toFixed(2) + ' m'; });
  slider(host, 'vertical trim', -1, 1, 0.005, 0,
    function () { return S.trim; }, function (v) { S.trim = v; },
    function (v) { return v.toFixed(3) + ' m'; });
  slider(host, 'yaw', -180, 180, 1, 0,
    function () { return S.yaw; }, function (v) { S.yaw = v; },
    function (v) { return v.toFixed(0) + '°'; });
  // A TRIM, and now it says so: the preset's declared attitude is the zero,
  // and this is the correction on top for a model drawn slightly off.
  slider(host, 'pitch trim', -15, 15, 0.1, 0,
    function () { return S.pitch; }, function (v) { S.pitch = v; },
    function (v) { return v.toFixed(1) + '°'; });
  var pb = el('div', 'refBtns');
  // THE BUTTON'S NAME IS TRUE NOW. Both of these are TRIMS ON the preset's
  // declared ground attitude, so zeroing them returns the aeroplane to the
  // attitude it actually parks in — which for a taildragger is not level.
  // Before the attitude was declared, zeroing `pitch` was the very move that
  // lifted the Cub's tailwheel off the floor.
  pill(pb, 'sit on wheels', function () {
    S.trim = 0; S.pitch = 0; save(); rebuildPanel();
  }, 'Back onto the floor your build stands on, in its own parked attitude');
  pill(pb, 'snap to nose', function () {
    var m = M(), bb = m && m.buildBox && m.buildBox();
    if (!bb || !built) return;
    // both noses at the same world x. The reference's nose is its box min in
    // the model's own x, scaled; the mount's position is what moves.
    S.fore = -(bb.min.x - built.box.min[0] * S.scale);
    save(); rebuildPanel();
  }, 'Line the reference’s nose up with your build’s');
  pill(pb, 'centre', function () {
    S.fore = 0; S.lat = 0; S.yaw = 0; save(); rebuildPanel();
  }, 'Back to where it lands by default');
  host.appendChild(pb);

  head(host, 'finish', 'what it is drawn as');
  var mr = row(host, 'mode');
  var ms = document.createElement('select');
  MODES.forEach(function (m2) {
    var o = document.createElement('option');
    o.value = m2[0]; o.textContent = m2[1];
    ms.appendChild(o);
  });
  ms.value = S.mode;
  ms.onchange = function () { S.mode = ms.value; save(); applyFinish(); };
  mr.appendChild(ms);
  slider(host, 'opacity', 0, 1, 0.05, 1,
    function () { return S.alpha; },
    function (v) { S.alpha = v; applyFinish(); },
    function (v) { return v.toFixed(2); });
  check(host, 'occludes', function () { return S.occlude; },
    function (v) { S.occlude = v; });
  // THE CUT (G142). A select rather than two checkboxes, because 'reference
  // half' and 'split' are mutually exclusive views of the same plane and a
  // pair of tick-boxes would let you ask for a state that has no meaning.
  var cr = row(host, 'cut');
  var cs = document.createElement('select');
  CUTS.forEach(function (c) {
    var o = document.createElement('option');
    o.value = c[0]; o.textContent = c[1];
    cs.appendChild(o);
  });
  cs.value = S.cut;
  cs.onchange = function () { setCut(cs.value); };
  cr.appendChild(cs);

  head(host, 'materials', 'the model’s own, one row each');
  matsEl = el('div', 'refMats');
  host.appendChild(matsEl);

  head(host, 'measure', 'the reference’s own box');
  check(host, 'reference box', function () { return S.showBox; },
    function (v) { S.showBox = v; });
  slider(host, 'scale', 0.5, 2, 0.001, 1,
    function () { return S.scale; }, function (v) { S.scale = v; },
    function (v) { return '×' + v.toFixed(3); });
  var mm = row(host, 'match span');
  var ti = document.createElement('input');
  ti.type = 'text'; ti.className = 'v'; ti.placeholder = 'm';
  var solve = function () {
    if (!built) return;
    var sc = refMatchScale(parseFloat(ti.value), built.box.span);
    if (sc) { S.scale = sc; save(); rebuildPanel(); }
  };
  ti.onchange = solve;
  mm.appendChild(ti);
  pill(mm, 'solve', solve,
    'Set the scale so the reference’s span is the number you typed');
  dimsEl = el('div', 'refDims');
  host.appendChild(dimsEl);

  return host;
}

// THE CUT, FROM EITHER DOOR (2026-09-03). The panel's select and the editor's
// quick-action button both land here, so the extra thing this control does
// happens whichever one you press and the panel always shows what is true.
//
// SPLIT ONLY MEANS ANYTHING ON ONE CENTRELINE. The two halves are cut by the
// same world plane, so a reference dragged sideways would have the cut running
// through a wing instead of down its spine. Zeroing `lat` is the one thing
// this control does beyond its own name, and it is the difference between a
// comparison and a puzzle.
function setCut(v) {
  S.cut = v; save();
  if (S.cut === 'split') S.lat = 0;
  applyFinish(); place(); rebuildPanel();
  if (typeof window.REF_ON_CHANGE === 'function') window.REF_ON_CHANGE();
}

function rebuildPanel() {
  var old = panelEl, parent = old && old.parentElement;
  var next = old && old.nextSibling;
  panelEl = buildPanel();
  if (parent) parent.insertBefore(panelEl, next);
  if (old) old.remove();
  paintMats(); place(); paintDims();
}

// ===========================================================================
// THE HANDLE editor.js talks to. Four calls, and not one of them can move a
// parameter of the aeroplane.
// ===========================================================================
window.REFPLANE = {
  presets: REF_PRESETS,
  // the tree row's badge: what is standing there, or nothing
  badge: function () {
    if (S.preset === 'none') return '';
    var p = presetOf(S.preset);
    return p ? p.name.split(' ').slice(-2).join(' ') : '';
  },
  // The panel is built ONCE and REUSED. render() drops it out of #edRows on
  // every selection change and hands it back on the next — rebuilding it there
  // would throw away a slider mid-drag and re-read localStorage for no reason.
  panel: function () {
    if (!panelEl) { panelEl = buildPanel(); paintMats(); }
    return panelEl;
  },
  // THE GAP FOLLOWS THE BUILD. Every editor rebuild ends in applyVis, and the
  // discrepancy line is measured off geometry that has just been replaced — so
  // without this it would go stale the moment you moved a slider, which is
  // precisely when you are watching it.
  refresh: function () {
    if (panelEl && dimsEl) paintDims();
  },
  // THE CUT, CYCLED — the editor's quick-action button, and the reason the
  // three ways of looking at a reference are reachable without opening the
  // panel at all. It goes through the same setCut the select does (CUTS is
  // the order, so the button walks the list the panel shows), which is why
  // the panel is never left disagreeing with the bar.
  cycleCut: function () {
    if (S.preset === 'none') return S.cut;      // nothing standing to cut
    var i = 0;
    for (var j = 0; j < CUTS.length; j++) if (CUTS[j][0] === S.cut) i = j;
    setCut(CUTS[(i + 1) % CUTS.length][0]);
    return S.cut;
  },
  // the reference row was selected (or left)
  shown: function (on) {
    if (!on) return;
    if (!built && S.preset !== 'none') build(S.preset);
    place(); paintMats(); paintDims();
  },
  // first garage entry: put back whatever was standing here last session
  boot: function () {
    if (S.preset !== 'none' && !built) { build(S.preset); place(); }
  },
  state: S,
};

})();
